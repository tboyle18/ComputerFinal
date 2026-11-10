// =============================================================================
// Seed a LOCAL Supabase stack with demo users and listings.
//
//   SUPABASE_URL=http://127.0.0.1:54321 \
//   SUPABASE_PUBLISHABLE_KEY=sb_publishable_... \
//   SUPABASE_SECRET_KEY=sb_secret_... \
//   node scripts/seed-local.mjs
//
// Refuses to run against anything but localhost. Demo accounts below are for
// local development only (they're created with confirmed emails).
// Listings are created through each seller's OWN session, so the seed goes
// through the same RLS policies, triggers and storage rules as real users.
// =============================================================================
import { deflateSync, crc32 } from 'node:zlib';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const URL_ = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;
if (!PUBLISHABLE || !SECRET) throw new Error('Set SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY (see `supabase status`).');
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL_)) throw new Error('Refusing to seed a non-local project.');

const DEMO_PASSWORD = 'curio-demo-2026';
const SELLERS = [
  { email: 'maya@demo.curio.test', name: 'Maya Chen', location: 'Brooklyn, NY', bio: 'Film photographer and serial thrifter. Everything tested before listing.' },
  { email: 'leo@demo.curio.test', name: 'Leo Martins', location: 'Austin, TX', bio: 'Musician, cyclist, occasional furniture restorer.' },
  { email: 'ava@demo.curio.test', name: 'Ava Thompson', location: 'Portland, OR', bio: 'Decluttering one shelf at a time. Smoke-free home.' },
];
const BUYER = { email: 'sam@demo.curio.test', name: 'Sam Rivera', location: 'Chicago, IL', bio: 'Collector of good things.' };

const PALETTES = {
  electronics: [[40, 44, 80], [120, 110, 255]],
  fashion: [[255, 196, 170], [214, 90, 120]],
  home: [[236, 214, 180], [150, 110, 80]],
  sports: [[170, 230, 200], [30, 130, 110]],
  books: [[245, 230, 200], [180, 120, 60]],
  toys: [[255, 220, 120], [240, 100, 80]],
  collectibles: [[200, 190, 255], [90, 60, 160]],
  art: [[180, 220, 255], [255, 150, 190]],
  music: [[30, 30, 40], [255, 120, 80]],
  vehicles: [[200, 210, 220], [60, 80, 110]],
};

const LISTINGS = [
  [0, 'Canon AE-1 film camera with 50mm f/1.8 lens', 'electronics', 'good', 18500, 'Classic 35mm SLR in great working order. Light seals replaced last year, meter is accurate, shutter fires at all speeds. Includes the original 50mm f/1.8 lens, strap and front cap. Minor brassing on the top plate (see photos).'],
  [0, 'Polaroid SX-70 Land Camera, refurbished', 'electronics', 'like_new', 32000, 'Fully refurbished SX-70 with new leather skins. Tested with a fresh pack of film: perfect exposures. A true design icon that still takes beautiful photos.'],
  [0, 'Hand-thrown ceramic vase set (3 pieces)', 'art', 'new', 9000, 'Set of three stoneware vases in a speckled oat glaze. Made in a small studio, food-safe and watertight. Heights 6", 8" and 11".'],
  [0, 'Original watercolor landscape, 12×16', 'art', 'new', 14500, 'Original watercolor of the Hudson Valley in late autumn on 300gsm cold-press paper. Signed. Ships flat and protected, unframed.'],
  [0, 'Vintage Levi’s trucker jacket, size M', 'fashion', 'good', 7800, 'Classic type III denim jacket with a beautiful natural fade. No rips or stains. Fits like a modern medium.'],
  [1, 'Fender Player Stratocaster, Tidepool', 'music', 'like_new', 62000, 'Barely played Player Strat in Tidepool with a maple neck. Fresh 10s, low action, no fret wear. Comes with a gig bag and tremolo arm.'],
  [1, 'Vinyl: Fleetwood Mac – Rumours (1977 pressing)', 'music', 'good', 3500, 'Original 1977 US pressing. Sleeve shows light ring wear; vinyl plays with minimal surface noise. Inner sleeve included.'],
  [1, 'Trek Domane AL 2 road bike, 56cm', 'sports', 'good', 54000, 'Reliable aluminium endurance road bike. Shimano Claris groupset, new tyres and bar tape in the spring. Serviced and ready to ride.'],
  [1, 'Mid-century teak side table', 'home', 'fair', 12000, 'Danish-style teak side table with a lower shelf. Solid and sturdy with some surface scratches consistent with age. Could be refinished or loved as is.'],
  [1, 'Yoga mat + blocks bundle', 'sports', 'like_new', 4500, 'Thick 6mm non-slip mat with two cork blocks and a cotton strap. Used a handful of times and cleaned.'],
  [2, 'Le Creuset Dutch oven, 5.5 qt, Flame', 'home', 'like_new', 21000, 'Signature round Dutch oven in Flame orange. Interior enamel is spotless, no chips. Moving and downsizing my kitchen.'],
  [2, 'Kindle Paperwhite (11th gen), 16GB', 'electronics', 'like_new', 8500, 'Warm light, waterproof, ad-free. Battery health is excellent. Factory reset and ready for a new reader. Includes USB-C cable.'],
  [2, 'LEGO Star Wars Millennium Falcon 75257, complete', 'toys', 'good', 11000, 'Built once and displayed in a smoke-free home. 100% complete with all minifigures and the instruction booklet. Box has some shelf wear.'],
  [2, 'First edition paperback set: classic sci-fi', 'books', 'good', 6500, 'Five classic science-fiction paperbacks from the 1970s. Spines lightly creased, pages tanned but tight. A lovely shelf set.'],
  [2, 'Patagonia Down Sweater jacket, women’s S', 'fashion', 'good', 9500, 'Warm, packable and in good condition. One tiny repaired spot on the left sleeve (pictured). Washed with down-safe detergent.'],
  [2, 'Nintendo Switch OLED + 2 games', 'toys', 'like_new', 29000, 'White OLED model with dock, Joy-Cons and all cables. Includes two physical games. Screen protector applied from day one.'],
];

// ---------------------------------------------------------------- PNG maker --
function png(width, height, pixel) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (width * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function artwork(category, seed) {
  const [a, b] = PALETTES[category] ?? [[200, 200, 220], [80, 80, 120]];
  const S = 640;
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const blobs = Array.from({ length: 4 }, () => ({ x: rand() * S, y: rand() * S, r: 90 + rand() * 180, t: rand() }));
  return png(S, S, (x, y) => {
    const t = (x + y) / (2 * S);
    let c = [0, 1, 2].map((i) => a[i] * (1 - t) + b[i] * t);
    for (const bl of blobs) {
      const d = Math.hypot(x - bl.x, y - bl.y) / bl.r;
      if (d < 1) {
        const k = (1 - d * d) * 0.35;
        c = c.map((v, i) => v * (1 - k) + (bl.t > 0.5 ? 255 : b[i] * 0.6) * k);
      }
    }
    return c.map((v) => Math.max(0, Math.min(255, Math.round(v))));
  });
}

// -------------------------------------------------------------------- seed --
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL_, SECRET, opts);

async function ensureUser({ email, name, location, bio }) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  let user = list.users.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: name },
    });
    if (error) throw error;
    user = data.user;
  }
  const client = createClient(URL_, PUBLISHABLE, opts);
  const { error } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw error;
  await client.from('profiles').update({ location, bio }).eq('id', user.id);
  return { id: user.id, client };
}

const sellers = [];
for (const s of SELLERS) sellers.push(await ensureUser(s));
await ensureUser(BUYER);

let created = 0;
for (const [i, [sellerIdx, title, category, condition, price, description]] of LISTINGS.entries()) {
  const seller = sellers[sellerIdx];
  const { data: existing } = await seller.client.from('listings').select('id').eq('title', title).maybeSingle();
  if (existing) continue;
  const paths = [];
  for (let n = 0; n < 2; n++) {
    const path = `${seller.id}/${randomUUID()}.png`;
    const { error } = await seller.client.storage
      .from('listing-images')
      .upload(path, artwork(category, (i + 1) * 7919 + n * 104729), { contentType: 'image/png' });
    if (error) throw error;
    paths.push(path);
  }
  const { error } = await seller.client.from('listings').insert({
    title,
    description,
    category,
    condition,
    price_cents: price,
    location: SELLERS[sellerIdx].location,
    image_paths: paths,
  });
  if (error) throw error;
  created++;
}

console.log(`Seeded ${created} listings. Demo accounts (local only): ${[...SELLERS, BUYER].map((u) => u.email).join(', ')}`);
console.log('Demo password is defined at the top of scripts/seed-local.mjs.');
