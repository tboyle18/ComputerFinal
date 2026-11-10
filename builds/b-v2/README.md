# Curio: a secure peer-to-peer marketplace

**Find something worth keeping.** Curio is a full-stack marketplace where people buy and sell pre-loved and new items. It's built to go live with real users, real personal data and real money, so security takes priority over everything else.

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, React Router |
| Hosting | **Cloudflare Workers** (static assets plus a small Worker that adds security headers) |
| Backend | **Supabase**: Postgres with Row Level Security, Auth (email + TOTP 2FA), Storage, Realtime, Edge Functions |

> Read [SECURITY.md](SECURITY.md) for the threat model and every security decision.

---

## Features

- **Accounts**: sign up with email confirmation, log in and log out, password reset, optional authenticator-app 2FA, "sign out of all devices", self-service account deletion
- **Profiles**: a public profile (name, avatar, bio, city, listings). Email addresses are never public.
- **Listings**: create, edit and delete listings with a title, description, price, category, condition, location and up to 8 photos. Photos are resized and stripped of EXIF/GPS data in the browser.
- **Browse**: full-text search, category chips, price and condition filters, sorting and paging
- **Listing page**: photo gallery, seller card, "more from this seller", report listing
- **Messaging**: buyer ↔ seller conversations per listing, with live updates through Realtime and unread badges
- **Cart and checkout**: simulated payment. The server re-prices the cart, locks the items, uses idempotency keys and creates one order per seller.
- **Orders**: order history for buyers ("I received it") and a Sales page for sellers ("Mark as shipped")
- **Admin dashboard**: stats, users (search, suspend, restore, delete), listings (remove or restore with a reason), a reports queue and an append-only audit log. It requires 2FA.

---

## Project structure

```
├── src/                      React app
│   ├── api/                  All data access (goes through RLS)
│   ├── auth/                 Session + 2FA context, route guards (UX only)
│   ├── components/           UI kit, layout, listing card, image manager…
│   ├── lib/                  supabase client, env guard, validation, image processing…
│   ├── pages/                Routes (home, listing, sell, cart, checkout, orders, messages, account, admin, auth)
│   └── types/database.ts     Generated from the schema
├── worker/index.ts           Cloudflare Worker: serves the app + security headers (CSP, HSTS…)
├── wrangler.jsonc            Cloudflare config
├── supabase/
│   ├── migrations/…_init.sql Database: tables, RLS, grants, RPCs, storage buckets & policies
│   ├── functions/            Edge Functions: admin-users, delete-account
│   ├── snippets/make_admin.sql
│   └── config.toml           Local stack config (hardened auth settings)
├── tests/security.test.mjs   25 attack tests against a real local Supabase stack
└── scripts/seed-local.mjs    Demo data for local development
```

---

## 1. Run it locally

**Prerequisites:** Node 20.19+ (22 or 24 recommended), Docker Desktop, and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) (`brew install supabase/tap/supabase`).

```bash
npm ci
```

Start a local Supabase stack. The migration is applied automatically.

```bash
supabase start
```

`supabase status` prints the local **API URL**, **Publishable key** and **Secret key**. Create `.env.local` with the two public values:

```bash
cp .env.example .env.local
# VITE_SUPABASE_URL=http://127.0.0.1:54321
# VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   (never the secret key)
```

Allow the dev server to call the Edge Functions, then restart the stack so it picks this up:

```bash
cp supabase/functions/.env.example supabase/functions/.env
```

```bash
supabase stop && supabase start
```

Optionally add demo users and listings. It uses the local keys from `supabase status`:

```bash
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_PUBLISHABLE_KEY=sb_publishable_... SUPABASE_SECRET_KEY=sb_secret_... node scripts/seed-local.mjs
```

Run the app:

```bash
npm run dev
```

Open http://localhost:5173. Confirmation and reset emails land in Mailpit at http://127.0.0.1:54324.

To make yourself an admin locally, open the local Studio SQL editor at http://127.0.0.1:54323 and run `supabase/snippets/make_admin.sql` with your email. Then go to **Settings → Two-factor authentication** in the app and set up an authenticator.

### Run the security test suite

The suite refuses to run against anything but localhost.

```bash
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_PUBLISHABLE_KEY=sb_publishable_... SUPABASE_SECRET_KEY=sb_secret_... npm run test:security
```

It signs in as anon, buyers, sellers, outsiders and admins (with and without 2FA) and tries things such as editing other people's listings, forging message senders, tampering with checkout totals, racing two buyers for one item, uploading SVG/HTML or writing into another user's folder, calling admin APIs, and bypassing 2FA. All 25 tests must pass.

### Preview the production build with the Worker

This serves the app exactly as Cloudflare will, with the CSP and other headers:

```bash
npx vite build --mode development && npx wrangler dev --var SUPABASE_URL:http://127.0.0.1:54321
```

---

## 2. Set up Supabase (production)

### 2.1 Create the project and the database

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard). Use a strong database password and keep it in a password manager.
2. Apply the schema. **Either** use the CLI (recommended):

   ```bash
   supabase login
   ```

   ```bash
   supabase link --project-ref YOUR-PROJECT-REF
   ```

   ```bash
   supabase db push
   ```

   **or** open **SQL Editor**, paste the whole of `supabase/migrations/20261109000000_init.sql` and click **Run**. It runs as a single transaction.

   This creates every table, the RLS policies, grants, functions, the realtime publication and both storage buckets (`listing-images` and `avatars`, each with a size limit, an image-only MIME allow-list and owner-only write policies).

### 2.2 Deploy the Edge Functions

```bash
supabase secrets set ALLOWED_ORIGINS=https://your-domain.com
```

```bash
supabase functions deploy admin-users --no-verify-jwt
```

```bash
supabase functions deploy delete-account --no-verify-jwt
```

`--no-verify-jwt` is deliberate. Both functions verify the caller themselves with `auth.getUser()` plus database-side checks, and the platform's built-in check doesn't support the new publishable/secret keys. The secret key is injected by Supabase and never leaves it.

### 2.3 Harden Auth (Dashboard → Authentication)

| Setting | Value |
| --- | --- |
| **URL Configuration → Site URL** | `https://your-domain.com` |
| **URL Configuration → Redirect URLs** | `https://your-domain.com/auth/callback` and `https://your-domain.com/reset-password` (exact URLs, no wildcards) |
| **Sign In / Providers → Email** | Confirm email **on** · Secure email change **on** · Secure password change **on** |
| **Password requirements** | Minimum length **10** · letters + digits · **Leaked password protection on** (Pro plan) |
| **Multi-Factor** | TOTP (authenticator app) **enabled** |
| **Attack Protection → CAPTCHA** | Turnstile, with your Turnstile **secret** key (see §3.3) |
| **Sessions / JWT** | Access token expiry **900 s** · refresh token rotation **on** (reuse interval 10 s) |
| **Rate Limits** | Review the defaults; lower them if you see abuse |
| **Emails → SMTP** | Configure your own SMTP provider. The built-in sender is for testing only. |
| **Emails → Templates** | Brand them, and keep `{{ .ConfirmationURL }}` (works with the PKCE flow) |

Also check:

- **Project Settings → Data API**: expose only `public`, and set **Max rows** to `200`.
- **Database → Extensions**: if `pg_graphql` is enabled, disable it. The app doesn't use GraphQL, so this removes an API surface.
- **Advisors → Security Advisor**: should report no errors.
- **Database → Backups**: enable Point-in-Time Recovery for real data (Pro).
- **Database → Settings**: enforce SSL, and add network restrictions for direct database access.
- **API Keys**: use the **publishable** key in the frontend. Never put the **secret** key anywhere outside Supabase.

### 2.4 Create the first admin

1. Sign up in the deployed app and confirm your email.
2. In **SQL Editor**, run `supabase/snippets/make_admin.sql` with your email. There's intentionally no way to grant admin rights from the app or API.
3. In the app, go to **Settings → Two-factor authentication** and set up an authenticator. The admin dashboard and all admin APIs refuse sessions without 2FA.

---

## 3. Deploy the frontend to Cloudflare Workers

### 3.1 Configure

Create `.env.production.local`. It isn't committed (see `.gitignore`):

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_TURNSTILE_SITE_KEY=          # optional, see 3.3
```

Edit `wrangler.jsonc` → `vars`:

```jsonc
"SUPABASE_URL": "https://YOUR-PROJECT-REF.supabase.co",  // used to build the CSP
"TURNSTILE_ENABLED": "false"                              // "true" if you use Turnstile
```

The build **fails on purpose** if a secret/service-role key is placed in any `VITE_` variable, or if the Supabase URL isn't `https://`.

### 3.2 Deploy

```bash
npx wrangler login
```

```bash
npm run deploy
```

This builds the app and runs `wrangler deploy`. Then:

1. **Add a custom domain**: Workers & Pages → `curio-marketplace` → Settings → Domains & Routes.
2. In the zone's **SSL/TLS** settings, set mode to **Full (strict)**, minimum TLS version to **1.2**, and turn on **Always Use HTTPS**.
3. Put the final domain into Supabase **Site URL / Redirect URLs** (§2.3) and into `ALLOWED_ORIGINS` (§2.2).
4. Check the headers:

   ```bash
   curl -sI https://your-domain.com
   ```

   You should see `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY` and the rest. You can also scan the site with [securityheaders.com](https://securityheaders.com).

### 3.3 Optional: Cloudflare Turnstile (bot protection)

1. In the Cloudflare dashboard, go to **Turnstile → Add widget** for your domain.
2. Put the **site key** in `VITE_TURNSTILE_SITE_KEY`.
3. Put the **secret key** in Supabase → Authentication → Attack Protection → CAPTCHA (provider: Turnstile).
4. Set `"TURNSTILE_ENABLED": "true"` in `wrangler.jsonc`. This allows `challenges.cloudflare.com` in the CSP.
5. Redeploy. Sign-up, log-in, password reset and re-authentication will now require the check, and Supabase verifies it on the server.

---

## 4. Go-live checklist

- [ ] `npm audit` is clean and `npm run typecheck` passes
- [ ] `npm run test:security` passes against a local stack with the same migration
- [ ] Supabase Auth settings from §2.3 applied, with custom SMTP configured
- [ ] Supabase Security Advisor shows no errors, `pg_graphql` disabled, max rows 200
- [ ] Edge Functions deployed and `ALLOWED_ORIGINS` set to the production domain only
- [ ] The first admin has 2FA enabled; no other admins
- [ ] Custom domain on HTTPS with strict TLS; security headers verified
- [ ] `public/.well-known/security.txt` contact details updated
- [ ] Backups (PITR) enabled
- [ ] **Before taking real money**: replace the simulated checkout with a PCI-compliant processor such as Stripe Checkout or Payment Element, confirming payment with **server-side webhooks**, never from the browser. See SECURITY.md.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on :5173 |
| `npm run typecheck` | TypeScript project build (app, Worker, Vite config) |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Build + run the Worker locally with `wrangler dev` |
| `npm run deploy` | Build + `wrangler deploy` |
| `npm run test:security` | Security test suite (local Supabase only) |
| `npm run audit` | `npm audit` for production dependencies |

After changing the schema, regenerate the TypeScript types:

```bash
supabase gen types typescript --local --schema public > src/types/database.ts
```
