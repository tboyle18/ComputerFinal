# Trove — a marketplace for things worth keeping

Trove is a full-stack marketplace for buying and selling pre-loved items. It's a React single-page app hosted on **Cloudflare**, with **Supabase** providing the database, user accounts, file storage and real-time chat.

**Features**

| | |
|---|---|
| **Accounts** | Sign up (live username availability check, password strength meter), log in, log out, forgot/reset password |
| **Profiles** | Public profile page with bio, location, stats and listings; settings page with avatar upload |
| **Listings** | Create, edit and delete listings with title, description, price, category, condition, location and up to 8 photos. Photos are resized to WebP in the browser before upload, and there's a live preview card while you write |
| **Browse** | Home page with a hero, category rail, text search, price and condition filters, sorting, and "show more" pagination. All filters live in the URL, so results can be shared |
| **Listing page** | Photo gallery with full-screen lightbox, seller card, details, "more from this seller", and similar items. Sellers get edit / mark-sold / delete buttons on their own listings |
| **Messaging** | Real-time buyer ↔ seller chat for each listing: inbox, unread badges, read receipts, quick replies, and a pop-up when a message arrives on another page |
| **Cart & checkout** | Multi-seller cart, shipping charged per seller, and a simulated card payment with validation. Payment is processed atomically in Postgres, so two buyers can't buy the same item |
| **Orders** | Purchases (with status tracking and a "confirm delivery" button) and Sales (earnings, and "mark shipped") |
| **Saved items** | Heart any listing; it shows up on your Saved page |
| **Admin** | Dashboard with marketplace stats, recent activity, and searchable tables of users (with email; promote/demote/delete) and listings (remove), plus all orders |
| **Polish** | Light & dark themes, smooth animations, skeleton loaders, toasts, mobile tab bar, and lazy-loaded pages |

**Tech:** React 19 · TypeScript · Vite · Tailwind CSS v4 · React Router · Motion · Lucide icons · Sonner · Supabase (Postgres, Auth, Storage, Realtime) · Cloudflare Workers static assets

---

## 1. Set up Supabase

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard) (the free tier is fine).
2. Open **SQL Editor → New query**, paste the whole of
   [`supabase/migrations/20261109000000_trove_schema.sql`](supabase/migrations/20261109000000_trove_schema.sql), and click **Run**.
   This creates every table, row-level security policy, database function, the realtime publication and both storage buckets (`listing-images`, `avatars`).
3. *(Optional but recommended)* Run [`supabase/seed.sql`](supabase/seed.sql) the same way. It adds 4 demo sellers and 28 listings with photos so the marketplace isn't empty. The demo accounts have no password, so nobody can sign in as them.
4. **Authentication → URL Configuration**
   - **Site URL**: your production URL (e.g. `https://trove-marketplace.<you>.workers.dev`). Use `http://localhost:5173` until you deploy.
   - **Redirect URLs**: add `http://localhost:5173/**` and `https://<your-domain>/**`.
5. **Authentication → Sign In / Providers → Email**: email confirmation is **on** by default. New users then see a "check your inbox" screen and must click the link before logging in. For quick testing you can turn **Confirm email** off. The built-in email sender is heavily rate-limited, so add custom SMTP before you launch.
6. **Project Settings → API Keys**: copy the **Project URL** and the **publishable key** (`sb_publishable_…`). The legacy `anon` key also works. **Never** use the secret / `service_role` key in this app.

### Make yourself an admin

Sign up in the app first, then run this in the SQL editor:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'you@example.com');
```

Reload the app. **Admin dashboard** now appears in your avatar menu at `/admin`. Admins can promote other users from the dashboard.

---

## 2. Run it locally

You need Node.js 20 or newer.

```bash
cd trove
```

```bash
npm install
```

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

```bash
npm run dev
```

Open http://localhost:5173. If the variables are missing, the app shows a setup screen instead of crashing.

### Optional: a fully local Supabase (Docker)

The repo includes a Supabase CLI config. With Docker running:

```bash
npm run db:start
```

```bash
npm run db:reset
```

`db:start` prints a local API URL (`http://127.0.0.1:54321`) and a publishable key; put those in `.env.local`. `db:reset` reapplies the migration and seed at any time. Local auth doesn't require email confirmation. Studio runs at http://127.0.0.1:54323.

After you change the schema, regenerate the TypeScript types with `npm run db:types`.

---

## 3. Deploy to Cloudflare

The app builds to static files in `dist/`. [`wrangler.jsonc`](wrangler.jsonc) serves them with **Cloudflare Workers static assets** and sends every unknown path to `index.html`, so deep links like `/listing/123` work.

> **Important:** Vite bakes `VITE_*` variables in **at build time**, so they must be available wherever `npm run build` runs.

### Option A — from your machine (quickest)

1. Create `.env.production.local` with your **hosted** Supabase URL and key. In production builds this overrides `.env.local`, which may point at your local database.
2. Log in to Cloudflare and deploy:

```bash
npx wrangler login
```

```bash
npm run deploy
```

Wrangler prints your URL, e.g. `https://trove-marketplace.<subdomain>.workers.dev`.

### Option B — Git integration (auto-deploy on push)

1. Push the `trove/` folder to GitHub or GitLab.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Import a repository**.
3. Settings:
   - **Root directory**: `trove` (if the repo contains other folders)
   - **Build command**: `npm run build`
   - **Deploy command**: `npx wrangler deploy`
   - **Build variables**: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
4. Save and deploy. Every push to your main branch redeploys.

### Option C — Cloudflare Pages

**Workers & Pages → Create → Pages → Connect to Git**, then set:

- Framework preset: **Vite** (or none)
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: the same two `VITE_*` variables

Pages treats a site with no `404.html` as a single-page app automatically, so no redirect rules are needed.

### After the first deploy

Go back to **Supabase → Authentication → URL Configuration**. Set **Site URL** to the deployed URL and add `https://<your-domain>/**` to **Redirect URLs**, so confirmation and password-reset emails link to the live site. If you add a custom domain in Cloudflare, add it here too.

---

## Using the app

- **Sell:** click **Sell**, add photos (drag to upload; the first photo is the cover), fill in the details and publish.
- **Buy:** **Add to cart** or **Buy now** → **Checkout**. The payment is simulated:
  - `4242 4242 4242 4242`, any future expiry, any CVC → succeeds (the **Use test card** button fills this in)
  - `4000 0000 0000 0002` → declined
  - Only the brand and last four digits are stored. Card numbers never leave the browser.
- **Chat:** **Message** on any listing opens a thread with the seller. Replies appear instantly.
- **Fulfil:** sellers mark items **shipped** under **Orders → Sales**. Buyers then **confirm delivery** on the order page.

---

## How it's built

```
trove/
├── supabase/
│   ├── migrations/…_trove_schema.sql   # tables, RLS, RPCs, realtime, storage
│   ├── seed.sql                        # optional demo sellers + listings
│   └── config.toml                     # local Supabase CLI config
├── src/
│   ├── App.tsx                         # router + providers (pages are lazy-loaded)
│   ├── index.css                       # design tokens (light/dark) + Tailwind theme
│   ├── lib/                            # supabase client, types, image helpers, utils
│   ├── context/                        # Auth, Cart, Saved, Inbox (realtime), Theme
│   ├── components/
│   │   ├── ui/                         # Button, Field, Modal, Dropdown, Tabs, Avatar…
│   │   ├── layout/                     # Navbar, Footer, MobileTabBar, guards
│   │   ├── listings/                   # ListingCard, Gallery, ImageUploader…
│   │   └── orders/
│   └── pages/                          # Home, ListingDetail, ListingEditor, Messages,
│                                       # Cart, Checkout, Orders, Admin, auth/…
├── wrangler.jsonc                      # Cloudflare deploy config
└── .env.example
```

### Database

| Table | Purpose |
|---|---|
| `profiles` | One row per user, created automatically by a trigger on sign-up. Has `role` (`user` / `admin`) |
| `categories` | The 10 marketplace categories |
| `listings` | Items for sale. `images` stores storage paths; `status` is `active` / `sold` |
| `favorites` | Saved items |
| `cart_items` | One row per item in a user's cart |
| `orders`, `order_items` | Created only by `place_order()`. Items keep a snapshot of title, price and photo, so history survives later edits or deletes |
| `conversations`, `messages` | One conversation per listing per buyer. `messages` is published to Realtime |

**Database functions (RPCs):**

- `place_order` — atomic checkout: locks the items, checks they're still available, creates the order, marks items sold, and clears them from every cart
- `start_conversation`, `mark_conversation_read`
- `update_order_item_status` — seller: processing → shipped; buyer: shipped → delivered
- `admin_stats`, `admin_list_users`, `admin_set_role`, `admin_delete_user` — all check `is_admin()` first

### Security model

Every table has row-level security (RLS), so the public key is safe to ship in the browser:

- Anyone can read profiles, categories and listings. Only the seller can create or edit their listings; the seller or an admin can delete them.
- Carts, favorites, orders and messages are visible only to the people involved. Sellers see only their own line items.
- Column-level grants stop users from changing their own `role`, a listing's `seller_id`, and similar fields. Promotion is only possible through `admin_set_role()`.
- Storage: both buckets are public-read. Users can upload, replace and delete files only inside their own `<user-id>/` folder; admins can delete any file.
- Deleting a user (admin) cascades to their profile, listings, cart, favorites and conversations. Orders are kept with the buyer or seller set to null.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Almost there — connect your Supabase project" screen | `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` were missing at build time. Add them and rebuild (or restart `npm run dev`) |
| Sign-up says "check your inbox" but no email arrives | Turn off **Confirm email** for testing, or configure custom SMTP (the default sender is rate-limited) |
| Email links go to localhost in production | Update **Site URL** and **Redirect URLs** in Supabase Auth settings |
| Admin page says "Admins only" | Run the `update public.profiles set role = 'admin' …` SQL above, then reload |
| Photo upload fails | Make sure the whole migration ran (it creates the buckets and storage policies). Files must be images under 5 MB after compression |
| Chat doesn't update live | Check that `messages` is in **Database → Publications → `supabase_realtime`** (the migration adds it) |
