# Curio security design

Curio is built on the assumption that **every client is hostile**. The browser holds only a public key. Anyone can open devtools and send any request to Supabase directly, so the frontend is never trusted for authorisation, validation or pricing.

To report a vulnerability, see `/.well-known/security.txt`.

---

## 1. Architecture and trust boundaries

```
 Browser (React SPA)
   │  publishable key + user's JWT ── untrusted ──┐
   │                                              ▼
   │                     Supabase API gateway ─► PostgREST ─► Postgres (RLS, grants, triggers, RPCs)
   │                                         ├─► Auth (email, TOTP 2FA, CAPTCHA, rate limits)
   │                                         ├─► Storage (bucket MIME/size limits + RLS)
   │                                         ├─► Realtime (delivers rows only if RLS allows)
   │                                         └─► Edge Functions (admin user moderation, account deletion)
   │                                                 └─ secret key lives ONLY here
   ▼
 Cloudflare Worker: serves static files, adds CSP/HSTS/etc. Holds no secrets.
```

- **The database is the security boundary.** Every table has RLS enabled, and browser roles get only the privileges granted explicitly, column by column where it matters.
- **The secret (service-role) key never leaves Supabase.** It isn't in the frontend, the repository or Cloudflare. Only the two Edge Functions use it, and only after authorising the caller.

---

## 2. Decisions by area

### Authentication and sessions

| Decision | Why |
| --- | --- |
| Email confirmation required | Proves address ownership; stops throwaway sign-ups. |
| Min 10-character passwords (letters + digits), 72-character max | Length beats complexity rules (NIST 800-63B). bcrypt only uses 72 bytes. |
| PKCE auth flow | Email links carry a one-time code that only the requesting browser can redeem, so tokens never appear in URLs or referrers. |
| Generic login / reset / sign-up responses | "Wrong email or password" and "If an account exists…" prevent account enumeration. |
| Optional TOTP 2FA, **enforced by the database** | RESTRICTIVE RLS policies block all private data for users who enrolled 2FA until the session is `aal2`. Skipping the UI prompt doesn't help an attacker. |
| Admin requires `aal2` | `private.is_admin()` checks both membership and the 2FA level of the current JWT. A stolen admin password alone gets nothing. |
| Re-authentication for sensitive actions | Changing the password or deleting the account requires the current password (+ 2FA code). The delete Edge Function also checks that the token's `amr` timestamp is less than 10 minutes old, so an old stolen token can't wipe an account. |
| Password change or reset signs out other sessions | Evicts anyone who may have hijacked a session. |
| 15-minute access tokens, rotating refresh tokens with reuse detection | Limits the value of a leaked token and makes suspensions effective quickly. |
| Cloudflare Turnstile CAPTCHA (optional), verified by Supabase | Stops credential stuffing and sign-up bots server-side. |
| Query cache wiped when the user changes | One person's orders and messages never flash up for the next person on a shared computer. |
| Sessions stored by supabase-js in `localStorage` | The SPA calls Supabase directly, so JS needs the token. The trade-off is mitigated by the strict CSP below (no inline or third-party script, so XSS can't easily run) and short token lifetimes. A cookie-based backend-for-frontend would be the next step if your threat model needs it. |

### Authorisation (Postgres)

| Decision | Why |
| --- | --- |
| `revoke all` from `anon`/`authenticated`, then explicit grants | Least privilege. New tables aren't exposed by default (`alter default privileges`). |
| **Column-level** insert/update grants | Sellers can't write `status`, `seller_id`, `sold_at` or `removed_reason`. Users can't write `profiles.suspended_at`. Message senders can't set `sender_id`. A trigger double-checks listing columns as defence in depth. |
| Ownership columns default to `auth.uid()` | The client never sends a user id. RLS `WITH CHECK` also verifies it. |
| Cross-user and money operations only through `SECURITY DEFINER` RPCs | `checkout`, `start_conversation`, `mark_order_shipped` and the admin functions each validate everything, use `set search_path = ''` (blocking search-path hijacking) and fully qualify every object. |
| Helpers in a non-exposed `private` schema | They can't be called over HTTP. |
| `EXECUTE` revoked from `PUBLIC` on every function, then granted per role | Postgres lets anyone execute new functions by default. |
| Admin membership in `private.admins` | No API role can read or write it. Admins are granted only via the SQL editor. |
| Admins can't moderate themselves or other admins via the API | Prevents lock-outs and privilege fights through a compromised admin session. |
| Append-only `admin_audit_log` | Every moderation action is recorded. There are no update or delete grants, and it stores no PII beyond display names. |
| Suspension = DB flag **and** Auth ban | The flag blocks writes immediately through RLS, even while an existing token is still valid. The ban stops new sign-ins and refreshes. Suspended sellers' listings are hidden. |

### Payments and orders (simulated)

| Decision | Why |
| --- | --- |
| No card data collected at all | Handling card numbers without a PCI-DSS processor is a liability. The demo checkout is clearly labelled "simulated". |
| Server-side pricing | The client sends only the total it displayed. The server recomputes it from current prices and refuses on mismatch (`PT409`), which also protects buyers from last-second price changes. |
| `SELECT … FOR UPDATE` on cart listings | Two buyers can't both buy the same one-off item (tested). |
| Per-buyer advisory lock + idempotency key | Double-clicks and retries return the original checkout, never a second order (tested). |
| Integer cents everywhere, price range constraints | No float rounding bugs; no $0 or negative prices. |
| One order per seller | Each seller sees only their own items and the buyer's shipping address, nothing from other sellers' orders. |
| Order records survive account deletion (`ON DELETE SET NULL`) | The other party keeps their records. |

**Before taking real money:** use Stripe Checkout or Payment Element, create PaymentIntents in an Edge Function, and mark orders paid **only from a verified webhook** (signature checked). Never mark an order paid because the browser says so.

### Input validation and content safety

| Decision | Why |
| --- | --- |
| CHECK constraints on every user field | Lengths, price range, allowed categories, ISO country codes, and no control, zero-width or bidi-override characters (blocks spoofing like `"Bob‮evil"`). The client mirrors them for UX only. |
| Reserved display names | Blocks impersonation like "Curio Support" or "Admin". Sign-up metadata is sanitised, with a safe fallback name. |
| React escaping only; no `dangerouslySetInnerHTML` anywhere | User text renders as text. Descriptions use `white-space: pre-wrap`, not HTML. |
| Image URLs built only from validated storage paths | The app never renders an arbitrary URL taken from the database. |
| Injection-safe search | Parameterised RPC. User text is reduced to alphanumeric words before reaching `to_tsquery`, so tsquery operators can't be injected. Limit and offset are capped server-side, and admin search escapes `LIKE` wildcards. |
| Error messages | Only messages we wrote (SQLSTATE `P0001`/`PTxxx`) are shown. Other database errors become generic text so internals don't leak. URL `error_description` parameters are never displayed (they could carry phishing text). |
| Open-redirect protection | `?next=` must be a same-origin relative path. |

### File uploads

| Decision | Why |
| --- | --- |
| Bucket-level MIME allow-list (JPEG/PNG/WebP) and size limit (5 MB / 2 MB) | Enforced by Storage, not the UI. **SVG is excluded** because it can carry script. |
| Owner-only folder, regex-checked random filenames | Users can only write `<their uid>/<uuid>.<ext>`. There is no UPDATE policy, so files can't be overwritten. Anonymous users can't list buckets. |
| Re-encoded in the browser before upload | Strips EXIF metadata, including the **GPS location** phones embed, which would otherwise reveal where sellers live. Very large or "decompression bomb" images are rejected. |
| Served from the Supabase domain | A malicious file can never run script on the app's origin. |
| Listing photos must be in the seller's own folder | Enforced by a CHECK constraint, so nobody can attach someone else's files. |

### Abuse and rate limits (in the database)

| Limit | Value |
| --- | --- |
| New listings | 25 per day, 200 active per seller (advisory-locked, race-free) |
| Messages | 15 per minute, 300 per day |
| New conversations | 20 per hour |
| Uploads | 60 listing photos / 10 avatars per hour |
| Cart size | 50 items |
| Reports | 20 per day, one per listing per user |
| API rows per request | 200 (`max_rows`) |

Supabase Auth adds its own rate limits for sign-ups, logins, emails and token refreshes.

### Frontend and edge (Cloudflare Worker)

| Header | Value / purpose |
| --- | --- |
| `Content-Security-Policy` | `default-src 'none'`; scripts and styles only from `'self'` (no inline, no eval); connections and images only to self and your Supabase project; `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'none'`; `form-action 'self'`. Fonts are self-hosted, so there are no third-party origins. |
| `Strict-Transport-Security` | 2 years, includeSubDomains |
| `X-Frame-Options: DENY` | Clickjacking (legacy browsers) |
| `X-Content-Type-Options: nosniff` | MIME sniffing |
| `Referrer-Policy: strict-origin-when-cross-origin` | No path or query leakage to other sites |
| `Permissions-Policy` | Camera, mic, geolocation, payment etc. disabled |
| `Cross-Origin-Opener-Policy: same-origin` | Isolates the window from cross-origin popups |
| Only GET/HEAD accepted; fail closed on misconfiguration | The Worker refuses to serve without a valid CSP. |

The build **fails** if a secret or service-role key is placed in a `VITE_` variable (those are public). Production builds don't ship source maps.

CSRF isn't applicable: auth uses bearer tokens in headers, not cookies. Edge Function CORS uses an explicit origin allow-list, as defence in depth.

### Privacy

- Email addresses live only in `auth.users`. Profiles are public and contain no email. Only admins (with 2FA) can see emails.
- Shipping addresses are visible only to the buyer and the seller of that order, and are never stored in browser storage.
- Users can delete their account and data. Photos are deleted from Storage, and order records are anonymised for the other party.

### Supply chain

- Exact dependency versions, a committed lockfile, `npm audit` clean at build time.
- `.npmrc` sets `ignore-scripts=true`, so a compromised package can't run code at install time.
- Dependencies were resolved to releases at least ~3 weeks old where possible. Security fixes (e.g. wrangler's undici advisory) take precedence over that cooldown.

---

## 3. Verified by tests

`tests/security.test.mjs` runs 25 attack scenarios against a real Supabase stack, including:

- Anonymous users can't write anything or read emails or suspension flags.
- Users can't edit or delete others' listings, set `status`/`seller_id`, attach others' photos, or use path traversal.
- Users can't use reserved or spoofed names (bidi override).
- Checkout rejects tampered totals and invalid addresses, is idempotent under concurrent double submits, and two racing buyers result in exactly one sale.
- Orders are visible only to buyer and seller; only the seller can mark shipped.
- Outsiders can't read, post into, or forge senders in conversations; spam is rate-limited.
- Storage rejects foreign folders, SVG, HTML, non-random names, overwrites and anonymous uploads.
- Admin APIs and Edge Functions refuse non-admins **and admins without 2FA**; with 2FA, actions work and are audited; a disallowed CORS origin is refused.
- Suspension blocks writes immediately and hides listings; admin delete removes the account.
- A 2FA-enrolled user on a password-only session can't read orders or check out.
- Account deletion requires explicit confirmation, and admins can't self-delete through the API.

---

## 4. Known limitations and next steps

- **Payments are simulated.** See the Stripe guidance above before handling money.
- **Orphaned uploads.** If someone uploads photos and abandons the form, files can remain (failed saves clean up after themselves). Add a scheduled Edge Function that deletes objects not referenced by any listing or profile and older than 24 hours.
- **Homoglyph names.** Look-alike Unicode (e.g. a Cyrillic "о") can't be fully prevented by regex. Moderators can suspend impersonators.
- **No user blocking yet.** Users can't block each other in messages. Reports and moderation cover abuse for now.
- **Token in `localStorage`.** Acceptable with the strict CSP, but a cookie-based backend-for-frontend (HttpOnly, SameSite=strict) would remove token access from JavaScript entirely.
- **Monitoring.** Set up alerts on Supabase Auth and API logs (spikes in 401/403/429) and Cloudflare analytics.
- **Penetration test.** Before handling real money or large volumes of personal data, commission an independent security review.
