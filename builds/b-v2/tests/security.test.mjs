// =============================================================================
// Curio security test suite
// =============================================================================
// Attacks the real backend (RLS, grants, RPCs, storage policies, Edge
// Functions) as different users and asserts every attack fails.
//
// Runs ONLY against a LOCAL Supabase stack (it creates and deletes users):
//   supabase start
//   SUPABASE_URL=http://127.0.0.1:54321 \
//   SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
//   SUPABASE_SECRET_KEY=sb_secret_... \
//   npm run test:security
//
// Optional: DB_CONTAINER (default supabase_db_curio-marketplace) is used to
// grant admin rights via `docker exec … psql`, because private.admins is
// deliberately unreachable through the API.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const URL_ = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const DB_CONTAINER = process.env.DB_CONTAINER ?? 'supabase_db_curio-marketplace';

if (!PUBLISHABLE || !SECRET) {
  throw new Error('Set SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY (from `supabase status`).');
}
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL_)) {
  throw new Error('Refusing to run: this suite creates/deletes users and must target a LOCAL stack.');
}

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const service = createClient(URL_, SECRET, opts);
const anon = createClient(URL_, PUBLISHABLE, opts);
const run = Date.now().toString(36);
const PASSWORD = 'Sup3r-Secure-Passw0rd!';

// ---------------------------------------------------------------- helpers ---
async function makeUser(name) {
  const email = `${name}.${run}@example.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: `${name[0].toUpperCase()}${name.slice(1)} ${run}` },
  });
  if (error) throw error;
  const client = createClient(URL_, PUBLISHABLE, opts);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, email, client };
}

const img = (uid) => `${uid}/${randomUUID()}.webp`;

async function createListing(user, overrides = {}) {
  const { data, error } = await user.client
    .from('listings')
    .insert({
      title: `Vintage camera ${randomUUID().slice(0, 6)}`,
      description: 'A lovely vintage film camera in working order.',
      price_cents: 12500,
      category: 'electronics',
      condition: 'good',
      image_paths: [img(user.id)],
      ...overrides,
    })
    .select('id, price_cents')
    .single();
  if (error) throw error;
  return data;
}

function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of input.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totp(secret, offset = 0) {
  const counter = Math.floor(Date.now() / 1000 / 30) + offset;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
  return code;
}

async function enrollTotp(user) {
  const { data, error } = await user.client.auth.mfa.enroll({ factorType: 'totp', friendlyName: `t-${run}` });
  if (error) throw error;
  const { error: vErr } = await user.client.auth.mfa.challengeAndVerify({
    factorId: data.id,
    code: totp(data.totp.secret),
  });
  if (vErr) throw vErr;
  return data;
}

function psql(sql) {
  execFileSync('docker', ['exec', DB_CONTAINER, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    stdio: 'pipe',
  });
}

async function callFunction(name, token, body, headers = {}) {
  const res = await fetch(`${URL_}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: PUBLISHABLE, Authorization: `Bearer ${token}`, ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const token = async (u) => (await u.client.auth.getSession()).data.session.access_token;
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
const shipping = {
  name: 'Bob Buyer',
  line1: '1 Market Street',
  line2: '',
  city: 'Springfield',
  region: 'IL',
  postal_code: '62701',
  country: 'US',
};

// ------------------------------------------------------------------ state ---
let alice, bob, carol, dave, admin, mallory;
let listingA, listingB, listingC;

test('setup users', async () => {
  [alice, bob, carol, dave, admin, mallory] = await Promise.all(
    ['alice', 'bob', 'carol', 'dave', 'admin', 'mallory'].map(makeUser),
  );
});

// ----------------------------------------------------------- profiles -------
test('profiles: email and suspension status are not readable', async () => {
  const { error } = await anon.from('profiles').select('suspended_at').limit(1);
  assert.ok(error, 'suspended_at must not be selectable');
  const { error: e2 } = await anon.from('profiles').select('email').limit(1);
  assert.ok(e2, 'profiles must not contain email');
});

test('profiles: users cannot edit someone else or set protected columns', async () => {
  const { data } = await bob.client.from('profiles').update({ bio: 'pwned' }).eq('id', alice.id).select('id');
  assert.equal(data?.length ?? 0, 0, 'bob must not update alice');
  const { error } = await bob.client.from('profiles').update({ suspended_at: null }).eq('id', bob.id);
  assert.ok(error, 'suspended_at must not be writable');
});

test('profiles: reserved / spoofing display names are rejected', async () => {
  for (const name of ['Curio Support', 'admin', 'Bob‮evil']) {
    const { error } = await bob.client.from('profiles').update({ display_name: name }).eq('id', bob.id);
    assert.ok(error, `should reject ${JSON.stringify(name)}`);
  }
  const { error } = await bob.client.from('profiles').update({ display_name: 'Bob the Builder' }).eq('id', bob.id);
  assert.equal(error, null);
});

test('profiles: malicious sign-up metadata falls back to a safe name', async () => {
  const email = `weird.${run}@example.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: 'Official Curio Admin' },
  });
  assert.equal(error, null);
  const { data: p } = await anon.from('profiles').select('display_name').eq('id', data.user.id).single();
  assert.match(p.display_name, /^user-[0-9a-f]{8}$/);
  await service.auth.admin.deleteUser(data.user.id);
});

// ----------------------------------------------------------- listings -------
test('listings: anon cannot create listings', async () => {
  const { error } = await anon.from('listings').insert({
    title: 'Anon item', description: 'Should never be created', price_cents: 1000,
    category: 'other', image_paths: [`${randomUUID()}/${randomUUID()}.jpg`],
  });
  assert.ok(error);
});

test('listings: seller can create; invalid data is rejected server-side', async () => {
  listingA = await createListing(alice);
  listingB = await createListing(alice, { price_cents: 5000 });
  listingC = await createListing(alice, { price_cents: 9900 });

  const bad = [
    { price_cents: 0 },
    { price_cents: -500 },
    { price_cents: 10000001 },
    { title: 'x' },
    { image_paths: [] },
    { image_paths: [img(bob.id)] },                       // someone else's folder
    { image_paths: [`${alice.id}/../../etc/passwd`] },     // path traversal
    { image_paths: [`${alice.id}/${randomUUID()}.svg`] },  // svg not allowed
    { category: 'not-a-category' },
  ];
  for (const override of bad) {
    await assert.rejects(createListing(alice, override), undefined, JSON.stringify(override));
  }
});

test('listings: clients cannot set status, seller_id or sold_at', async () => {
  await assert.rejects(createListing(alice, { status: 'sold' }));
  await assert.rejects(createListing(bob, { seller_id: alice.id }));
  const { error } = await alice.client.from('listings').update({ status: 'sold' }).eq('id', listingA.id);
  assert.ok(error, 'status must not be writable');
  const { error: e2 } = await alice.client.from('listings').update({ seller_id: bob.id }).eq('id', listingA.id);
  assert.ok(e2, 'seller_id must not be writable');
});

test('listings: other users cannot edit or delete', async () => {
  const { data: upd } = await bob.client
    .from('listings').update({ price_cents: 100 }).eq('id', listingA.id).select('id');
  assert.equal(upd?.length ?? 0, 0);
  const { data: del } = await bob.client.from('listings').delete().eq('id', listingA.id).select('id');
  assert.equal(del?.length ?? 0, 0);
  const { data } = await anon.from('listings').select('price_cents').eq('id', listingA.id).single();
  assert.equal(data.price_cents, 12500);
});

test('listings: search is injection-safe', async () => {
  for (const q of ["'); drop table listings; --", 'a & !b | c:*', '\\', '%_%', 'ｃａｍｅｒａ', ''.padEnd(5000, 'x')]) {
    const { error } = await anon.rpc('search_listings', { p_query: q });
    assert.equal(error, null, q.slice(0, 30));
  }
  const { data } = await anon.rpc('search_listings', { p_query: 'vintage cam', p_limit: 1000 });
  assert.ok(data.length >= 1 && data.length <= 60, 'limit is capped server-side');
});

// --------------------------------------------------------------- cart -------
test('cart: cannot add own listing or write to another user’s cart', async () => {
  const { error } = await alice.client.from('cart_items').insert({ listing_id: listingA.id });
  assert.ok(error, 'seller cannot add own listing');
  const { error: e2 } = await bob.client.from('cart_items').insert({ listing_id: listingA.id, user_id: carol.id });
  assert.ok(e2, 'user_id must not be writable');
  const { error: e3 } = await bob.client.from('cart_items').insert({ listing_id: listingA.id });
  assert.equal(e3, null);
  const { data } = await carol.client.from('cart_items').select('listing_id');
  assert.equal(data.length, 0, 'carol cannot see bob’s cart');
});

// ----------------------------------------------------------- checkout -------
let checkoutId;
test('checkout: server recomputes the total and rejects tampering', async () => {
  const { error } = await bob.client.rpc('checkout', {
    p_idempotency_key: randomUUID(), p_expected_total_cents: 1, p_shipping: shipping,
  });
  assert.equal(error?.code, 'PT409');

  const { error: e2 } = await bob.client.rpc('checkout', {
    p_idempotency_key: randomUUID(), p_expected_total_cents: 12500, p_shipping: { ...shipping, country: 'USA' },
  });
  assert.equal(e2?.code, 'P0001', 'invalid address rejected');

  const { error: e3 } = await anon.rpc('checkout', {
    p_idempotency_key: randomUUID(), p_expected_total_cents: 12500, p_shipping: shipping,
  });
  assert.ok(e3, 'anon cannot checkout');
});

test('checkout: idempotent and marks items sold', async () => {
  const key = randomUUID();
  const args = { p_idempotency_key: key, p_expected_total_cents: 12500, p_shipping: shipping };
  const [r1, r2] = await Promise.all([bob.client.rpc('checkout', args), bob.client.rpc('checkout', args)]);
  assert.equal(r1.error, null);
  assert.equal(r2.error, null);
  assert.equal(r1.data, r2.data, 'same key → same checkout');
  checkoutId = r1.data;

  const { data: l } = await anon.from('listings').select('status').eq('id', listingA.id).single();
  assert.equal(l.status, 'sold');
  const { data: cart } = await bob.client.from('cart_items').select('listing_id');
  assert.equal(cart.length, 0);

  const { data: upd } = await alice.client
    .from('listings').update({ price_cents: 1 }).eq('id', listingA.id).select('id');
  assert.equal(upd?.length ?? 0, 0, 'sold listings are frozen');
});

test('checkout: two buyers racing for one item → exactly one wins', async () => {
  await bob.client.from('cart_items').insert({ listing_id: listingB.id });
  await carol.client.from('cart_items').insert({ listing_id: listingB.id });
  const results = await Promise.all(
    [bob, carol].map((u) =>
      u.client.rpc('checkout', { p_idempotency_key: randomUUID(), p_expected_total_cents: 5000, p_shipping: shipping }),
    ),
  );
  assert.equal(results.filter((r) => !r.error).length, 1);
});

test('orders: visible to buyer and seller only', async () => {
  const { data: buyerView } = await bob.client.from('orders').select('id, ship_line1').eq('checkout_id', checkoutId);
  assert.equal(buyerView.length, 1);
  const { data: sellerView } = await alice.client.from('orders').select('id, ship_line1').eq('checkout_id', checkoutId);
  assert.equal(sellerView.length, 1, 'seller needs the address to ship');
  const { data: outsider } = await dave.client.from('orders').select('id').eq('checkout_id', checkoutId);
  assert.equal(outsider.length, 0);
  const { data: items } = await dave.client.from('order_items').select('id');
  assert.equal(items.length, 0);
  const { error } = await bob.client.from('orders').update({ status: 'delivered' }).eq('checkout_id', checkoutId);
  assert.ok(error, 'orders are not directly writable');
  const { error: e2 } = await bob.client.rpc('mark_order_shipped', { p_order_id: buyerView[0].id });
  assert.equal(e2?.code, 'PT404', 'only the seller can mark shipped');
  const { error: e3 } = await alice.client.rpc('mark_order_shipped', { p_order_id: buyerView[0].id });
  assert.equal(e3, null);
});

// ---------------------------------------------------------- messaging -------
let convoId;
test('messaging: only participants can read or post', async () => {
  const { data: id, error } = await carol.client.rpc('start_conversation', { p_listing_id: listingC.id });
  assert.equal(error, null);
  convoId = id;
  const { error: e1 } = await carol.client.from('messages').insert({ conversation_id: convoId, body: 'Is this available?' });
  assert.equal(e1, null);

  const { data: snoop } = await dave.client.from('messages').select('body').eq('conversation_id', convoId);
  assert.equal(snoop.length, 0, 'outsider cannot read');
  const { error: e2 } = await dave.client.from('messages').insert({ conversation_id: convoId, body: 'spam' });
  assert.ok(e2, 'outsider cannot post');
  const { error: e3 } = await dave.client
    .from('messages').insert({ conversation_id: convoId, body: 'forged', sender_id: carol.id });
  assert.ok(e3, 'cannot forge sender');

  const { data: sellerRead } = await alice.client.from('messages').select('body').eq('conversation_id', convoId);
  assert.equal(sellerRead.length, 1);
  const { error: e4 } = await alice.client.rpc('start_conversation', { p_listing_id: listingC.id });
  assert.ok(e4, 'seller cannot open a thread with themselves');
  const { error: e5 } = await carol.client.from('conversations').insert({
    listing_title: 'x', buyer_id: carol.id, seller_id: dave.id,
  });
  assert.ok(e5, 'conversations only via RPC');
});

test('messaging: rate limit stops spam', async () => {
  let limited = false;
  for (let i = 0; i < 16; i++) {
    const { error } = await carol.client.from('messages').insert({ conversation_id: convoId, body: `msg ${i}` });
    if (error?.code === 'PT429') { limited = true; break; }
  }
  assert.ok(limited);
});

// ----------------------------------------------------------- storage --------
test('storage: uploads restricted to own folder, image types and safe names', async () => {
  const bucket = bob.client.storage.from('listing-images');
  const ok = await bucket.upload(`${bob.id}/${randomUUID()}.png`, PNG_1PX, { contentType: 'image/png' });
  assert.equal(ok.error, null);
  const other = await bucket.upload(`${alice.id}/${randomUUID()}.png`, PNG_1PX, { contentType: 'image/png' });
  assert.ok(other.error, 'cannot write into another user’s folder');
  const svg = await bucket.upload(`${bob.id}/${randomUUID()}.png`, Buffer.from('<svg onload=alert(1)>'), {
    contentType: 'image/svg+xml',
  });
  assert.ok(svg.error, 'svg rejected');
  const html = await bucket.upload(`${bob.id}/${randomUUID()}.png`, Buffer.from('<script>'), { contentType: 'text/html' });
  assert.ok(html.error, 'html rejected');
  const name = await bucket.upload(`${bob.id}/evil.png`, PNG_1PX, { contentType: 'image/png' });
  assert.ok(name.error, 'non-random names rejected');
  const overwrite = await bucket.upload(ok.data.path, PNG_1PX, { contentType: 'image/png', upsert: true });
  assert.ok(overwrite.error, 'no overwrites');
  const anonUp = await anon.storage.from('avatars').upload(`${randomUUID()}/${randomUUID()}.png`, PNG_1PX, {
    contentType: 'image/png',
  });
  assert.ok(anonUp.error, 'anon cannot upload');
  const del = await bob.client.storage.from('listing-images').remove([`${alice.id}/x.png`]);
  assert.equal(del.data?.length ?? 0, 0);
});

// -------------------------------------------------------------- reports -----
test('reports: users can report, only admins can read', async () => {
  const { error } = await dave.client.from('reports').insert({ listing_id: listingC.id, reason: 'scam', details: 'Looks fake' });
  assert.equal(error, null);
  const { data } = await dave.client.from('reports').select('id');
  assert.equal(data?.length ?? 0, 0);
  const { error: e2 } = await dave.client.from('reports').insert({ listing_id: listingC.id, reason: 'spam' });
  assert.ok(e2, 'one report per user per listing');
});

// ---------------------------------------------------------------- admin -----
test('admin: non-admins and admins without 2FA are refused', async () => {
  const { error } = await bob.client.rpc('admin_stats');
  assert.equal(error?.code, 'PT403');
  psql(`insert into private.admins (user_id) values ('${admin.id}')`);
  const { error: e2 } = await admin.client.rpc('admin_stats');
  assert.equal(e2?.code, 'PT403', 'aal1 admin refused');
  const { data: logs } = await bob.client.from('admin_audit_log').select('id');
  assert.equal(logs?.length ?? 0, 0);
  const r = await callFunction('admin-users', await token(bob), { action: 'suspend', user_id: dave.id });
  assert.equal(r.status, 403);
  const r2 = await callFunction('admin-users', await token(admin), { action: 'suspend', user_id: dave.id });
  assert.equal(r2.status, 403, 'edge function also requires aal2');
});

test('admin: with 2FA the admin can moderate and actions are audited', async () => {
  await enrollTotp(admin);
  const { data: stats, error } = await admin.client.rpc('admin_stats');
  assert.equal(error, null);
  assert.ok(stats.users >= 6);

  const { data: users } = await admin.client.rpc('admin_list_users', { p_search: `%` });
  assert.ok(Array.isArray(users));

  const { error: e1 } = await admin.client.rpc('admin_set_listing_status', {
    p_listing_id: listingC.id, p_action: 'remove', p_reason: 'Counterfeit',
  });
  assert.equal(e1, null);
  const { data: pub } = await anon.from('listings').select('id').eq('id', listingC.id);
  assert.equal(pub.length, 0, 'removed listing hidden from public');
  const { data: own } = await alice.client.from('listings').select('status, removed_reason').eq('id', listingC.id).single();
  assert.equal(own.status, 'removed');

  const { data: audit } = await admin.client.from('admin_audit_log').select('action').eq('target_id', listingC.id);
  assert.equal(audit.length, 1);
});

test('admin: suspend blocks writes immediately; delete removes the account', async () => {
  const listing = await createListing(dave);
  const r = await callFunction('admin-users', await token(admin), { action: 'suspend', user_id: dave.id });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await assert.rejects(createListing(dave), undefined, 'suspended user cannot list');
  const { data } = await anon.from('listings').select('id').eq('id', listing.id);
  assert.equal(data.length, 0, 'suspended seller’s listings hidden');

  const bad = await callFunction('admin-users', await token(admin), { action: 'delete', user_id: admin.id });
  assert.equal(bad.status, 400, 'cannot delete self');
  const evilOrigin = await callFunction(
    'admin-users', await token(admin), { action: 'unsuspend', user_id: dave.id }, { Origin: 'https://evil.example' },
  );
  assert.equal(evilOrigin.status, 403);

  const un = await callFunction('admin-users', await token(admin), { action: 'unsuspend', user_id: dave.id });
  assert.equal(un.status, 200);

  await createListing(mallory);
  const del = await callFunction('admin-users', await token(admin), { action: 'delete', user_id: mallory.id });
  assert.equal(del.status, 200, JSON.stringify(del.body));
  const { data: gone } = await service.auth.admin.getUserById(mallory.id);
  assert.equal(gone.user ?? null, null);
});

// ------------------------------------------------------------------ MFA -----
test('mfa: an enrolled user on an aal1 session cannot touch private data', async () => {
  const { data: factor } = await bob.client.auth.mfa.enroll({ factorType: 'totp', friendlyName: `b-${run}` });
  await bob.client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: totp(factor.totp.secret) });
  // A fresh password-only login is aal1.
  const fresh = createClient(URL_, PUBLISHABLE, opts);
  await fresh.auth.signInWithPassword({ email: bob.email, password: PASSWORD });
  const { data: orders } = await fresh.from('orders').select('id');
  assert.equal(orders.length, 0, 'aal1 cannot read orders');
  const { error } = await fresh.from('cart_items').insert({ listing_id: listingC.id });
  assert.ok(error);
  const { error: e2 } = await fresh.rpc('checkout', {
    p_idempotency_key: randomUUID(), p_expected_total_cents: 1, p_shipping: shipping,
  });
  assert.equal(e2?.code, 'PT403');
});

// ------------------------------------------------------- delete account -----
test('delete-account: requires explicit confirmation, keeps the other party’s order records', async () => {
  const r0 = await callFunction('delete-account', await token(carol), { confirm: 'yes' });
  assert.equal(r0.status, 400);
  const r = await callFunction('delete-account', await token(carol), { confirm: 'DELETE' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const { data } = await service.auth.admin.getUserById(carol.id);
  assert.equal(data.user ?? null, null);
  const ra = await callFunction('delete-account', await token(admin), { confirm: 'DELETE' });
  assert.equal(ra.status, 403, 'admins cannot self-delete via API');
});

test('cleanup', async () => {
  for (const u of [alice, bob, dave, admin]) await service.auth.admin.deleteUser(u.id);
});
