-- =============================================================================
--  Curio Marketplace: database schema, Row Level Security and storage
-- =============================================================================
--  Run this ONCE on a fresh Supabase project, either:
--    * Dashboard → SQL Editor → paste this file → Run, or
--    * `supabase db push` (it lives in supabase/migrations/).
--
--  Security model, in short:
--  1. Row Level Security (RLS) is enabled on every table. The browser holds only
--     the publishable key, so RLS + grants are the *real* access control and
--     the React app's route guards are just UX.
--  2. Browser roles (anon, authenticated) get no privileges by default. Every
--     privilege below is granted explicitly, column-by-column where it matters
--     (for example, sellers can never write `status`, `seller_id` or
--     `sold_at`).
--  3. Anything that moves money or crosses users (checkout, starting a
--     conversation, moderation) runs in a SECURITY DEFINER function that
--     validates everything itself, uses `set search_path = ''` (blocks
--     search-path hijacking) and fully-qualifies every object.
--  4. Helpers used by policies live in the `private` schema. That schema is not
--     exposed by the Data API, so nobody can call them over HTTP.
--  5. Admin power requires BOTH membership in private.admins (which no API
--     role can write) AND a two-factor (aal2) session.
--  6. Users who enrolled 2FA must complete it before they can touch any
--     private data (enforced with RESTRICTIVE policies, not just in the UI).
--  7. Abuse limits (listings/day, messages/minute, uploads/hour, …) are
--     enforced in the database, where a scripted client can't skip them.
--
--  User-facing errors use these SQLSTATEs (PostgREST maps PTxyz → HTTP xyz):
--    P0001 validation (400) · PT401 · PT403 · PT404 · PT409 conflict · PT429
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Schemas and secure-by-default privileges
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- Objects created later in `public` are not exposed to the browser roles
-- automatically. New tables/functions must be granted deliberately.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;


-- -----------------------------------------------------------------------------
-- 1. Types
-- -----------------------------------------------------------------------------
create type public.listing_status as enum ('active', 'sold', 'removed');
create type public.item_condition as enum ('new', 'like_new', 'good', 'fair', 'for_parts');
create type public.order_status   as enum ('paid', 'shipped', 'delivered', 'cancelled');
create type public.report_reason  as enum ('prohibited', 'scam', 'counterfeit', 'offensive', 'spam', 'other');


-- -----------------------------------------------------------------------------
-- 2. Admin membership (private: unreachable through the API)
-- -----------------------------------------------------------------------------
create table private.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  note       text
);
revoke all on private.admins from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 3. Generic helpers
-- -----------------------------------------------------------------------------

-- Keeps updated_at honest (clients can't set it).
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- True when the caller's session satisfies 2FA: either they never enrolled a
-- verified factor, or the current JWT is aal2.
create or replace function private.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
         where f.user_id = (select auth.uid())
           and f.status = 'verified'
      );
$$;

-- Admin = listed in private.admins AND signed in with 2FA (aal2).
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
     and exists (select 1 from private.admins a where a.user_id = (select auth.uid()));
$$;

create or replace function private.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Admin access requires an admin account signed in with two-factor authentication.'
      using errcode = 'PT403';
  end if;
end;
$$;

-- Listing photos must live in the seller's own storage folder and use a
-- server-checkable name: <seller uuid>/<random uuid>.<jpg|png|webp>
create or replace function private.valid_image_paths(p_paths text[], p_owner uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_paths is not null
     and array_position(p_paths, null) is null
     and coalesce(bool_and(
           p ~ ('^' || p_owner::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$')
         ), true)
     and cardinality(p_paths) = (select count(distinct x) from unnest(p_paths) as x)
    from unnest(p_paths) as p;
$$;


-- -----------------------------------------------------------------------------
-- 4. Profiles (public-facing user data; NO email or other private PII here)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  bio          text not null default '',
  location     text not null default '',
  avatar_path  text,
  suspended_at timestamptz,               -- never granted to browser roles
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint profiles_display_name_length check (char_length(display_name) between 2 and 40),
  -- No control chars, zero-width or bidi-override characters (used for spoofing).
  constraint profiles_display_name_clean check (
    display_name = btrim(display_name)
    and display_name !~ '[[:cntrl:]​-‏‪-‮⁠-⁩﻿]'
  ),
  -- Anti-impersonation: users can't call themselves "Curio Support" etc.
  constraint profiles_display_name_reserved check (
    lower(display_name) !~ '\m(admin|administrator|moderator|staff|support|official|curio)\M'
  ),
  constraint profiles_bio_length check (
    char_length(bio) <= 500 and bio !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f‪-‮]'
  ),
  constraint profiles_location_length check (
    char_length(location) <= 80 and location !~ '[[:cntrl:]‪-‮]'
  ),
  constraint profiles_avatar_path_format check (
    avatar_path is null
    or avatar_path ~ ('^' || id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$')
  )
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Needs profiles to exist (SQL function bodies are validated at creation).
create or replace function private.is_active_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = p_user_id and p.suspended_at is null
  );
$$;

-- Caller may write: signed in, not suspended, 2FA satisfied.
create or replace function private.can_write()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and private.is_active_user((select auth.uid()))
     and private.mfa_ok();
$$;

-- Same check for RPCs, but with a helpful error. Returns the caller's id.
create or replace function private.require_writer()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Please sign in to continue.' using errcode = 'PT401';
  end if;
  if not private.is_active_user(v_uid) then
    raise exception 'Your account is suspended. Contact support if you think this is a mistake.'
      using errcode = 'PT403';
  end if;
  if not private.mfa_ok() then
    raise exception 'Please complete two-factor verification first.' using errcode = 'PT403';
  end if;
  return v_uid;
end;
$$;

-- Create a profile for every new auth user. The display name comes from
-- user-controlled sign-up metadata, so it's sanitised and falls back to a
-- generated name rather than letting a bad value break sign-up.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name     text;
  v_fallback text := 'user-' || substr(replace(new.id::text, '-', ''), 1, 8);
begin
  v_name := regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    '[[:cntrl:]​-‏‪-‮⁠-⁩﻿]', '', 'g');
  v_name := btrim(left(btrim(regexp_replace(v_name, '\s+', ' ', 'g')), 40));
  if char_length(v_name) < 2 then
    v_name := v_fallback;
  end if;

  begin
    insert into public.profiles (id, display_name) values (new.id, v_name);
  exception when check_violation then
    insert into public.profiles (id, display_name) values (new.id, v_fallback);
  end;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();


-- -----------------------------------------------------------------------------
-- 5. Categories (read-only reference data)
-- -----------------------------------------------------------------------------
create table public.categories (
  slug       text primary key check (slug ~ '^[a-z0-9-]{2,32}$'),
  name       text not null,
  sort_order integer not null default 0
);

insert into public.categories (slug, name, sort_order) values
  ('electronics',  'Electronics',        10),
  ('fashion',      'Fashion',            20),
  ('home',         'Home & Living',      30),
  ('sports',       'Sports & Outdoors',  40),
  ('books',        'Books & Media',      50),
  ('toys',         'Toys & Games',       60),
  ('collectibles', 'Collectibles',       70),
  ('art',          'Art & Crafts',       80),
  ('music',        'Music Gear',         90),
  ('vehicles',     'Vehicles & Parts',  100),
  ('other',        'Other',             999);


-- -----------------------------------------------------------------------------
-- 6. Listings
-- -----------------------------------------------------------------------------
create table public.listings (
  id             uuid primary key default gen_random_uuid(),
  -- Defaults to the caller; clients have no privilege to write this column.
  seller_id      uuid not null default auth.uid(),
  title          text not null,
  description    text not null,
  price_cents    integer not null,
  currency       text not null default 'USD' check (currency = 'USD'),
  category       text not null references public.categories (slug),
  condition      public.item_condition not null default 'good',
  location       text not null default '',
  image_paths    text[] not null default '{}',
  status         public.listing_status not null default 'active',
  removed_reason text,
  sold_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  search         tsvector generated always as (
                   setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
                   setweight(to_tsvector('simple', coalesce(description, '')), 'B')
                 ) stored,

  constraint listings_seller_fkey foreign key (seller_id) references public.profiles (id) on delete cascade,
  constraint listings_title_check check (
    char_length(title) between 3 and 100
    and title = btrim(title)
    and title !~ '[[:cntrl:]​-‏‪-‮⁠-⁩﻿]'
  ),
  constraint listings_description_check check (
    char_length(description) between 10 and 5000
    and description !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f‪-‮]'
  ),
  -- Integer cents (never floats for money). $1.00 – $100,000.00
  constraint listings_price_check check (price_cents between 100 and 10000000),
  constraint listings_location_check check (char_length(location) <= 80 and location !~ '[[:cntrl:]‪-‮]'),
  constraint listings_images_count check (cardinality(image_paths) between 1 and 8),
  constraint listings_images_valid check (private.valid_image_paths(image_paths, seller_id)),
  constraint listings_removed_reason_check check (removed_reason is null or char_length(removed_reason) <= 500)
);

create index listings_active_created_idx  on public.listings (created_at desc) where status = 'active';
create index listings_active_category_idx on public.listings (category, created_at desc) where status = 'active';
create index listings_active_price_idx    on public.listings (price_cents) where status = 'active';
create index listings_seller_idx          on public.listings (seller_id, status, created_at desc);
create index listings_search_idx          on public.listings using gin (search);

create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function private.set_updated_at();

-- Defence in depth: even if someone later grants a client more columns by
-- mistake, browser roles still can't change ownership or lifecycle fields.
create or replace function private.protect_listing_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.seller_id      is distinct from old.seller_id
    or new.status         is distinct from old.status
    or new.sold_at        is distinct from old.sold_at
    or new.removed_reason is distinct from old.removed_reason
    or new.created_at     is distinct from old.created_at
    or new.id             is distinct from old.id then
      raise exception 'You can''t change that field.' using errcode = 'PT403';
    end if;
  end if;
  return new;
end;
$$;

create trigger listings_protect_columns
  before update on public.listings
  for each row execute function private.protect_listing_columns();

-- Anti-spam: max 25 new listings per day and 200 active listings per seller.
-- The advisory lock makes the check race-free for parallel requests.
create or replace function private.enforce_listing_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('listing-limit:' || new.seller_id::text, 0));
  if (select count(*) from public.listings l
       where l.seller_id = new.seller_id and l.created_at > now() - interval '24 hours') >= 25 then
    raise exception 'You''ve reached the limit of 25 new listings per day. Please try again tomorrow.'
      using errcode = 'PT429';
  end if;
  if (select count(*) from public.listings l
       where l.seller_id = new.seller_id and l.status = 'active') >= 200 then
    raise exception 'You can have at most 200 active listings.' using errcode = 'PT429';
  end if;
  return new;
end;
$$;

create trigger listings_enforce_limits
  before insert on public.listings
  for each row execute function private.enforce_listing_limits();


-- -----------------------------------------------------------------------------
-- 7. Cart
-- -----------------------------------------------------------------------------
create table public.cart_items (
  user_id    uuid not null default auth.uid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (user_id, listing_id),
  constraint cart_items_user_fkey foreign key (user_id) references public.profiles (id) on delete cascade
);
create index cart_items_listing_idx on public.cart_items (listing_id);

create or replace function private.enforce_cart_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.cart_items c where c.user_id = new.user_id) >= 50 then
    raise exception 'Your cart can hold at most 50 items.' using errcode = 'PT429';
  end if;
  return new;
end;
$$;

create trigger cart_items_enforce_limit
  before insert on public.cart_items
  for each row execute function private.enforce_cart_limit();


-- -----------------------------------------------------------------------------
-- 8. Messaging
-- -----------------------------------------------------------------------------
create table public.conversations (
  id                     uuid primary key default gen_random_uuid(),
  listing_id             uuid references public.listings (id) on delete set null,
  listing_title          text not null,           -- snapshot, survives deletion
  buyer_id               uuid not null,
  seller_id              uuid not null,
  last_message_at        timestamptz not null default now(),
  last_message_preview   text not null default '',
  last_message_sender_id uuid,
  buyer_last_read_at     timestamptz not null default now(),
  seller_last_read_at    timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  constraint conversations_buyer_fkey  foreign key (buyer_id)  references public.profiles (id) on delete cascade,
  constraint conversations_seller_fkey foreign key (seller_id) references public.profiles (id) on delete cascade,
  constraint conversations_distinct_parties check (buyer_id <> seller_id),
  constraint conversations_unique_thread unique (listing_id, buyer_id)
);
create index conversations_buyer_idx  on public.conversations (buyer_id, last_message_at desc);
create index conversations_seller_idx on public.conversations (seller_id, last_message_at desc);

create table public.messages (
  id              bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null default auth.uid(),
  body            text not null,
  created_at      timestamptz not null default now(),
  constraint messages_sender_fkey foreign key (sender_id) references public.profiles (id) on delete cascade,
  constraint messages_body_check check (
    char_length(btrim(body)) between 1 and 2000
    and body !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f‪-‮]'
  )
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_sender_recent_idx on public.messages (sender_id, created_at desc);

-- Anti-spam: 15 messages/minute and 300/day per sender.
create or replace function private.enforce_message_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.messages m
       where m.sender_id = new.sender_id and m.created_at > now() - interval '1 minute') >= 15 then
    raise exception 'You''re sending messages too quickly. Please wait a moment.' using errcode = 'PT429';
  end if;
  if (select count(*) from public.messages m
       where m.sender_id = new.sender_id and m.created_at > now() - interval '24 hours') >= 300 then
    raise exception 'Daily message limit reached. Please try again tomorrow.' using errcode = 'PT429';
  end if;
  return new;
end;
$$;

create trigger messages_enforce_limits
  before insert on public.messages
  for each row execute function private.enforce_message_limits();

-- Keep the conversation list ordering/preview fresh (clients can't write
-- conversations directly).
create or replace function private.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations c
     set last_message_at        = new.created_at,
         last_message_preview   = left(regexp_replace(new.body, '\s+', ' ', 'g'), 140),
         last_message_sender_id = new.sender_id,
         buyer_last_read_at  = case when new.sender_id = c.buyer_id  then new.created_at else c.buyer_last_read_at  end,
         seller_last_read_at = case when new.sender_id = c.seller_id then new.created_at else c.seller_last_read_at end
   where c.id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function private.touch_conversation();


-- -----------------------------------------------------------------------------
-- 9. Orders (one checkout → one order per seller)
-- -----------------------------------------------------------------------------
create table public.checkouts (
  id              uuid primary key default gen_random_uuid(),
  buyer_id        uuid references public.profiles (id) on delete set null,
  idempotency_key uuid not null,
  total_cents     integer not null check (total_cents > 0),
  payment_ref     text not null,                -- simulated payment reference
  created_at      timestamptz not null default now(),
  constraint checkouts_idempotency unique (buyer_id, idempotency_key)
);

create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  checkout_id      uuid not null references public.checkouts (id) on delete cascade,
  buyer_id         uuid,
  seller_id        uuid,
  subtotal_cents   integer not null check (subtotal_cents > 0),
  status           public.order_status not null default 'paid',
  ship_name        text not null,
  ship_line1       text not null,
  ship_line2       text not null default '',
  ship_city        text not null,
  ship_region      text not null default '',
  ship_postal_code text not null,
  ship_country     text not null check (ship_country ~ '^[A-Z]{2}$'),
  created_at       timestamptz not null default now(),
  shipped_at       timestamptz,
  delivered_at     timestamptz,
  -- Order records outlive account deletion (the other party still needs them).
  constraint orders_buyer_fkey  foreign key (buyer_id)  references public.profiles (id) on delete set null,
  constraint orders_seller_fkey foreign key (seller_id) references public.profiles (id) on delete set null
);
create index orders_buyer_idx    on public.orders (buyer_id, created_at desc);
create index orders_seller_idx   on public.orders (seller_id, created_at desc);
create index orders_checkout_idx on public.orders (checkout_id);

create table public.order_items (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  listing_id  uuid references public.listings (id) on delete set null,
  title       text not null,          -- snapshot at purchase time
  price_cents integer not null check (price_cents > 0),
  image_path  text
);
create index order_items_order_idx   on public.order_items (order_id);
create index order_items_listing_idx on public.order_items (listing_id);


-- -----------------------------------------------------------------------------
-- 10. Reports (users flag listings for moderators)
-- -----------------------------------------------------------------------------
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid default auth.uid(),
  listing_id  uuid not null references public.listings (id) on delete cascade,
  reason      public.report_reason not null,
  details     text not null default '',
  status      text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint reports_reporter_fkey foreign key (reporter_id) references public.profiles (id) on delete set null,
  constraint reports_details_check check (
    char_length(details) <= 1000 and details !~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f‪-‮]'
  ),
  constraint reports_one_per_user unique (reporter_id, listing_id)
);
create index reports_status_idx on public.reports (status, created_at desc);

create or replace function private.enforce_report_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.reports r
       where r.reporter_id = new.reporter_id and r.created_at > now() - interval '24 hours') >= 20 then
    raise exception 'You''ve reached the daily report limit. Thank you for helping keep Curio safe.'
      using errcode = 'PT429';
  end if;
  return new;
end;
$$;

create trigger reports_enforce_limits
  before insert on public.reports
  for each row execute function private.enforce_report_limits();


-- -----------------------------------------------------------------------------
-- 11. Admin audit log (append-only; written only by trusted server code)
-- -----------------------------------------------------------------------------
create table public.admin_audit_log (
  id          bigint generated always as identity primary key,
  admin_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  target_type text not null,
  target_id   text not null,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);


-- =============================================================================
-- 12. Row Level Security
-- =============================================================================
alter table public.profiles        enable row level security;
alter table public.categories      enable row level security;
alter table public.listings        enable row level security;
alter table public.cart_items      enable row level security;
alter table public.conversations   enable row level security;
alter table public.messages        enable row level security;
alter table public.checkouts       enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.reports         enable row level security;
alter table public.admin_audit_log enable row level security;

-- Enforce 2FA for users who enrolled it: until they verify (aal2), they can't
-- read or write ANY private data. RESTRICTIVE policies are AND-ed with every
-- permissive policy, so this can't be bypassed by another policy.
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'listings', 'cart_items', 'conversations', 'messages',
                           'checkouts', 'orders', 'order_items', 'reports', 'admin_audit_log']
  loop
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated
         using ((select private.mfa_ok())) with check ((select private.mfa_ok()))',
      t || '_require_mfa_when_enrolled', t);
  end loop;
end;
$$;

-- profiles ---------------------------------------------------------------------
create policy profiles_select_public on public.profiles
  for select to anon, authenticated using (true);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and (select private.can_write()))
  with check (id = (select auth.uid()));

-- categories -------------------------------------------------------------------
create policy categories_select_public on public.categories
  for select to anon, authenticated using (true);

-- listings ---------------------------------------------------------------------
-- Everyone sees active + sold listings of non-suspended sellers.
create policy listings_select_public on public.listings
  for select to anon, authenticated
  using (status in ('active', 'sold') and private.is_active_user(seller_id));

-- Sellers always see their own listings (including removed ones).
create policy listings_select_own on public.listings
  for select to authenticated
  using (seller_id = (select auth.uid()));

create policy listings_select_admin on public.listings
  for select to authenticated
  using ((select private.is_admin()));

create policy listings_insert_own on public.listings
  for insert to authenticated
  with check (
    seller_id = (select auth.uid())
    and status = 'active'
    and (select private.can_write())
  );

-- Only active listings are editable (sold/removed are frozen).
create policy listings_update_own on public.listings
  for update to authenticated
  using (seller_id = (select auth.uid()) and status = 'active' and (select private.can_write()))
  with check (seller_id = (select auth.uid()) and status = 'active');

create policy listings_delete_own on public.listings
  for delete to authenticated
  using (seller_id = (select auth.uid()) and (select private.can_write()));

-- cart_items -------------------------------------------------------------------
create policy cart_select_own on public.cart_items
  for select to authenticated using (user_id = (select auth.uid()));

create policy cart_insert_own on public.cart_items
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.can_write())
    and exists (
      select 1 from public.listings l
       where l.id = cart_items.listing_id
         and l.status = 'active'
         and l.seller_id <> (select auth.uid())
         and private.is_active_user(l.seller_id)
    )
  );

create policy cart_delete_own on public.cart_items
  for delete to authenticated using (user_id = (select auth.uid()));

-- conversations (created/updated only through RPCs) ---------------------------
create policy conversations_select_participant on public.conversations
  for select to authenticated
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));

create policy conversations_select_admin on public.conversations
  for select to authenticated using ((select private.is_admin()));

-- messages ---------------------------------------------------------------------
create policy messages_select_participant on public.messages
  for select to authenticated
  using (exists (
    select 1 from public.conversations c
     where c.id = messages.conversation_id
       and (c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid()))
  ));

create policy messages_insert_participant on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (select private.can_write())
    and exists (
      select 1 from public.conversations c
       where c.id = messages.conversation_id
         and (c.buyer_id = (select auth.uid()) or c.seller_id = (select auth.uid()))
    )
  );

-- checkouts / orders / order_items (written only by checkout()) ---------------
create policy checkouts_select_own on public.checkouts
  for select to authenticated using (buyer_id = (select auth.uid()));

create policy orders_select_party on public.orders
  for select to authenticated
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));

create policy orders_select_admin on public.orders
  for select to authenticated using ((select private.is_admin()));

create policy order_items_select_party on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
     where o.id = order_items.order_id
       and (o.buyer_id = (select auth.uid()) or o.seller_id = (select auth.uid()) or (select private.is_admin()))
  ));

-- reports ----------------------------------------------------------------------
create policy reports_insert_own on public.reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and status = 'open'
    and (select private.can_write())
    and exists (select 1 from public.listings l
                 where l.id = reports.listing_id and l.seller_id <> (select auth.uid()))
  );

create policy reports_select_admin on public.reports
  for select to authenticated using ((select private.is_admin()));

-- audit log --------------------------------------------------------------------
create policy audit_select_admin on public.admin_audit_log
  for select to authenticated using ((select private.is_admin()));


-- =============================================================================
-- 13. Table privileges (explicit, least privilege)
-- =============================================================================
revoke all on public.profiles, public.categories, public.listings, public.cart_items,
              public.conversations, public.messages, public.checkouts, public.orders,
              public.order_items, public.reports, public.admin_audit_log
  from anon, authenticated;

grant select (id, display_name, bio, location, avatar_path, created_at) on public.profiles to anon, authenticated;
grant update (display_name, bio, location, avatar_path)                  on public.profiles to authenticated;

grant select on public.categories to anon, authenticated;

grant select on public.listings to anon, authenticated;
grant insert (title, description, price_cents, category, condition, location, image_paths) on public.listings to authenticated;
grant update (title, description, price_cents, category, condition, location, image_paths) on public.listings to authenticated;
grant delete on public.listings to authenticated;

grant select, delete       on public.cart_items to authenticated;
grant insert (listing_id)  on public.cart_items to authenticated;

grant select on public.conversations to authenticated;
grant select on public.messages      to authenticated;
grant insert (conversation_id, body) on public.messages to authenticated;

grant select on public.checkouts   to authenticated;
grant select on public.orders      to authenticated;
grant select on public.order_items to authenticated;

grant insert (listing_id, reason, details) on public.reports to authenticated;
grant select on public.reports to authenticated;

grant select on public.admin_audit_log to authenticated;


-- =============================================================================
-- 14. RPC functions (the only way to do cross-user / money operations)
-- =============================================================================

-- Search -----------------------------------------------------------------------
-- SECURITY INVOKER: runs with the caller's RLS, so it can never reveal rows the
-- caller couldn't read directly. User text is reduced to alphanumeric words
-- before it reaches to_tsquery, so tsquery operators can't be injected.
create or replace function public.search_listings(
  p_query     text default null,
  p_category  text default null,
  p_min_price integer default null,
  p_max_price integer default null,
  p_condition public.item_condition default null,
  p_sort      text default 'newest',
  p_limit     integer default 24,
  p_offset    integer default 0,
  p_status    public.listing_status default 'active',
  p_seller    uuid default null
)
returns setof public.listings
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_tsq tsquery;
begin
  p_limit  := least(greatest(coalesce(p_limit, 24), 1), 60);
  p_offset := least(greatest(coalesce(p_offset, 0), 0), 5000);

  if p_query is not null and btrim(p_query) <> '' then
    select to_tsquery('simple', string_agg(w || ':*', ' & '))
      into v_tsq
      from (
        select w
          from regexp_split_to_table(lower(left(p_query, 100)), '[^[:alnum:]]+') as w
         where w <> ''
         limit 8
      ) words;
  end if;

  return query
    select l.*
      from public.listings l
     where l.status = coalesce(p_status, 'active')
       and (p_category  is null or l.category = p_category)
       and (p_condition is null or l.condition = p_condition)
       and (p_min_price is null or l.price_cents >= p_min_price)
       and (p_max_price is null or l.price_cents <= p_max_price)
       and (p_seller    is null or l.seller_id = p_seller)
       and (v_tsq       is null or l.search @@ v_tsq)
     order by
       case when p_sort = 'price_asc'  then l.price_cents end asc nulls last,
       case when p_sort = 'price_desc' then l.price_cents end desc nulls last,
       case when p_sort = 'relevance' and v_tsq is not null then ts_rank(l.search, v_tsq) end desc nulls last,
       l.created_at desc,
       l.id
     limit p_limit offset p_offset;
end;
$$;

-- Checkout (simulated payment) ----------------------------------------------
-- The client never sends prices. The server re-reads the cart, locks the
-- listings (so two buyers can't buy the same item), recomputes the total and
-- refuses if it differs from what the buyer saw. An idempotency key makes a
-- double-click or network retry return the original checkout, not a second one.
create or replace function public.checkout(
  p_idempotency_key      uuid,
  p_expected_total_cents integer,
  p_shipping             jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid;
  v_checkout_id uuid;
  v_order_id    uuid;
  v_total       bigint;
  v_items       integer;
  v_unavailable integer;
  v_seller      uuid;
  v_name        text;
  v_line1       text;
  v_line2       text;
  v_city        text;
  v_region      text;
  v_postal      text;
  v_country     text;
begin
  v_uid := private.require_writer();

  if p_idempotency_key is null or p_expected_total_cents is null then
    raise exception 'Invalid checkout request.' using errcode = 'P0001';
  end if;
  if p_shipping is null or jsonb_typeof(p_shipping) <> 'object' then
    raise exception 'Please enter a shipping address.' using errcode = 'P0001';
  end if;

  -- One checkout at a time per buyer: makes idempotency airtight.
  perform pg_advisory_xact_lock(hashtextextended('checkout:' || v_uid::text, 0));

  select c.id into v_checkout_id
    from public.checkouts c
   where c.buyer_id = v_uid and c.idempotency_key = p_idempotency_key;
  if found then
    return v_checkout_id;
  end if;

  v_name    := btrim(coalesce(p_shipping ->> 'name', ''));
  v_line1   := btrim(coalesce(p_shipping ->> 'line1', ''));
  v_line2   := btrim(coalesce(p_shipping ->> 'line2', ''));
  v_city    := btrim(coalesce(p_shipping ->> 'city', ''));
  v_region  := btrim(coalesce(p_shipping ->> 'region', ''));
  v_postal  := upper(btrim(coalesce(p_shipping ->> 'postal_code', '')));
  v_country := upper(btrim(coalesce(p_shipping ->> 'country', '')));

  if char_length(v_name)   not between 2 and 100
  or char_length(v_line1)  not between 3 and 200
  or char_length(v_line2)  > 200
  or char_length(v_city)   not between 2 and 100
  or char_length(v_region) > 100
  or v_postal  !~ '^[A-Z0-9][A-Z0-9 -]{1,10}$'
  or v_country !~ '^[A-Z]{2}$'
  or concat_ws(' ', v_name, v_line1, v_line2, v_city, v_region) ~ '[[:cntrl:]‪-‮]'
  then
    raise exception 'Please check your shipping address.' using errcode = 'P0001';
  end if;

  -- Lock every listing in the cart (stable order avoids deadlocks).
  perform 1
     from public.listings l
    where l.id in (select ci.listing_id from public.cart_items ci where ci.user_id = v_uid)
    order by l.id
      for update;

  select count(*),
         count(*) filter (where l.status <> 'active'
                             or l.seller_id = v_uid
                             or not private.is_active_user(l.seller_id)),
         coalesce(sum(l.price_cents), 0)
    into v_items, v_unavailable, v_total
    from public.cart_items ci
    join public.listings l on l.id = ci.listing_id
   where ci.user_id = v_uid;

  if v_items = 0 then
    raise exception 'Your cart is empty.' using errcode = 'P0001';
  end if;
  if v_unavailable > 0 then
    raise exception 'Some items in your cart are no longer available. Please review your cart.'
      using errcode = 'PT409';
  end if;
  if v_total <> p_expected_total_cents then
    raise exception 'Prices in your cart have changed. Please review the updated total.'
      using errcode = 'PT409';
  end if;

  -- Simulated payment: no card data is ever collected or stored.
  insert into public.checkouts (buyer_id, idempotency_key, total_cents, payment_ref)
  values (v_uid, p_idempotency_key, v_total,
          'SIM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)))
  returning id into v_checkout_id;

  for v_seller in
    select distinct l.seller_id
      from public.cart_items ci
      join public.listings l on l.id = ci.listing_id
     where ci.user_id = v_uid
  loop
    insert into public.orders (checkout_id, buyer_id, seller_id, subtotal_cents,
                               ship_name, ship_line1, ship_line2, ship_city,
                               ship_region, ship_postal_code, ship_country)
    select v_checkout_id, v_uid, v_seller, sum(l.price_cents),
           v_name, v_line1, v_line2, v_city, v_region, v_postal, v_country
      from public.cart_items ci
      join public.listings l on l.id = ci.listing_id
     where ci.user_id = v_uid and l.seller_id = v_seller
    returning id into v_order_id;

    insert into public.order_items (order_id, listing_id, title, price_cents, image_path)
    select v_order_id, l.id, l.title, l.price_cents, l.image_paths[1]
      from public.cart_items ci
      join public.listings l on l.id = ci.listing_id
     where ci.user_id = v_uid and l.seller_id = v_seller;
  end loop;

  update public.listings l
     set status = 'sold', sold_at = now()
   where l.id in (select ci.listing_id from public.cart_items ci where ci.user_id = v_uid);

  -- Sold items disappear from everyone's carts.
  delete from public.cart_items ci
   where ci.listing_id in (
     select oi.listing_id
       from public.order_items oi
       join public.orders o on o.id = oi.order_id
      where o.checkout_id = v_checkout_id
   );

  return v_checkout_id;
end;
$$;

-- Order lifecycle ---------------------------------------------------------------
create or replace function public.mark_order_shipped(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_writer();
begin
  update public.orders o
     set status = 'shipped', shipped_at = now()
   where o.id = p_order_id and o.seller_id = v_uid and o.status = 'paid';
  if not found then
    raise exception 'Order not found or already shipped.' using errcode = 'PT404';
  end if;
end;
$$;

create or replace function public.confirm_order_delivered(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_writer();
begin
  update public.orders o
     set status = 'delivered', delivered_at = now()
   where o.id = p_order_id and o.buyer_id = v_uid and o.status = 'shipped';
  if not found then
    raise exception 'Order not found or not shipped yet.' using errcode = 'PT404';
  end if;
end;
$$;

-- Messaging ---------------------------------------------------------------------
create or replace function public.start_conversation(p_listing_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := private.require_writer();
  v_id      uuid;
  v_seller  uuid;
  v_title   text;
  v_status  public.listing_status;
begin
  -- Re-use an existing thread for this listing.
  select c.id into v_id
    from public.conversations c
   where c.listing_id = p_listing_id and c.buyer_id = v_uid;
  if found then
    return v_id;
  end if;

  select l.seller_id, l.title, l.status into v_seller, v_title, v_status
    from public.listings l
   where l.id = p_listing_id;

  if not found or v_status <> 'active' or not private.is_active_user(v_seller) then
    raise exception 'This listing isn''t available.' using errcode = 'PT404';
  end if;
  if v_seller = v_uid then
    raise exception 'You can''t message yourself about your own listing.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.conversations c
       where c.buyer_id = v_uid and c.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'You''re starting conversations too quickly. Please wait a little while.'
      using errcode = 'PT429';
  end if;

  insert into public.conversations (listing_id, listing_title, buyer_id, seller_id)
  values (p_listing_id, v_title, v_uid, v_seller)
  on conflict (listing_id, buyer_id) do nothing
  returning id into v_id;

  if v_id is null then
    select c.id into v_id from public.conversations c
     where c.listing_id = p_listing_id and c.buyer_id = v_uid;
  end if;
  return v_id;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not private.mfa_ok() then
    return;
  end if;
  update public.conversations c
     set buyer_last_read_at  = case when c.buyer_id  = v_uid then now() else c.buyer_last_read_at  end,
         seller_last_read_at = case when c.seller_id = v_uid then now() else c.seller_last_read_at end
   where c.id = p_conversation_id
     and (c.buyer_id = v_uid or c.seller_id = v_uid);
end;
$$;

create or replace function public.unread_conversation_count()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer
    from public.conversations c
   where c.last_message_sender_id is distinct from (select auth.uid())
     and c.last_message_sender_id is not null
     and (
       (c.buyer_id  = (select auth.uid()) and c.last_message_at > c.buyer_last_read_at)
    or (c.seller_id = (select auth.uid()) and c.last_message_at > c.seller_last_read_at)
     );
$$;

-- Admin ------------------------------------------------------------------------
-- Tells the UI whether to show the admin area / prompt for 2FA. Reveals only
-- the caller's own status.
create or replace function public.admin_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'is_admin', exists (select 1 from private.admins a where a.user_id = (select auth.uid())),
    'aal',      coalesce((select auth.jwt()) ->> 'aal', 'aal1')
  );
$$;

create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  return jsonb_build_object(
    'users',            (select count(*) from public.profiles),
    'users_7d',         (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'suspended_users',  (select count(*) from public.profiles where suspended_at is not null),
    'active_listings',  (select count(*) from public.listings where status = 'active'),
    'sold_listings',    (select count(*) from public.listings where status = 'sold'),
    'removed_listings', (select count(*) from public.listings where status = 'removed'),
    'orders',           (select count(*) from public.orders),
    'gmv_cents',        (select coalesce(sum(total_cents), 0) from public.checkouts),
    'open_reports',     (select count(*) from public.reports where status = 'open')
  );
end;
$$;

create or replace function public.admin_list_users(
  p_search text default null,
  p_limit  integer default 25,
  p_offset integer default 0
)
returns table (
  id              uuid,
  display_name    text,
  email           text,
  created_at      timestamptz,
  last_sign_in_at timestamptz,
  suspended_at    timestamptz,
  is_admin        boolean,
  active_listings bigint,
  total_count     bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_like text;
  v_term text := nullif(btrim(left(coalesce(p_search, ''), 100)), '');
begin
  perform private.assert_admin();
  p_limit  := least(greatest(coalesce(p_limit, 25), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  if v_term is not null then
    -- Escape LIKE wildcards so the search is literal.
    v_like := '%' || replace(replace(replace(v_term, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
    select p.id, p.display_name, u.email::text, p.created_at, u.last_sign_in_at, p.suspended_at,
           exists (select 1 from private.admins a where a.user_id = p.id),
           (select count(*) from public.listings l where l.seller_id = p.id and l.status = 'active'),
           count(*) over ()
      from public.profiles p
      join auth.users u on u.id = p.id
     where v_like is null
        or p.display_name ilike v_like
        or u.email ilike v_like
        or p.id::text = v_term
     order by p.created_at desc
     limit p_limit offset p_offset;
end;
$$;

-- Used by the admin Edge Function to authorise the caller and inspect the target.
create or replace function public.admin_get_user(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.assert_admin();
  select jsonb_build_object(
           'id', p.id,
           'display_name', p.display_name,
           'suspended_at', p.suspended_at,
           'is_admin', exists (select 1 from private.admins a where a.user_id = p.id))
    into v_result
    from public.profiles p
   where p.id = p_user_id;
  if v_result is null then
    raise exception 'User not found.' using errcode = 'PT404';
  end if;
  return v_result;
end;
$$;

create or replace function public.admin_set_listing_status(
  p_listing_id uuid,
  p_action     text,
  p_reason     text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(btrim(left(coalesce(p_reason, ''), 500)), '');
  v_title  text;
begin
  perform private.assert_admin();

  if p_action = 'remove' then
    update public.listings l
       set status = 'removed', removed_reason = coalesce(v_reason, 'Removed by a moderator.')
     where l.id = p_listing_id and l.status = 'active'
    returning l.title into v_title;
    if not found then
      raise exception 'Listing not found or not active.' using errcode = 'PT404';
    end if;
    delete from public.cart_items ci where ci.listing_id = p_listing_id;
  elsif p_action = 'restore' then
    update public.listings l
       set status = 'active', removed_reason = null
     where l.id = p_listing_id and l.status = 'removed'
    returning l.title into v_title;
    if not found then
      raise exception 'Listing not found or not removed.' using errcode = 'PT404';
    end if;
  else
    raise exception 'Unknown action.' using errcode = 'P0001';
  end if;

  insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'listing.' || p_action, 'listing', p_listing_id::text,
          jsonb_build_object('title', v_title, 'reason', v_reason));
end;
$$;

create or replace function public.admin_resolve_report(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_admin();
  update public.reports r
     set status = 'resolved', resolved_by = (select auth.uid()), resolved_at = now()
   where r.id = p_report_id and r.status = 'open';
  if not found then
    raise exception 'Report not found or already resolved.' using errcode = 'PT404';
  end if;
  insert into public.admin_audit_log (admin_id, action, target_type, target_id)
  values ((select auth.uid()), 'report.resolve', 'report', p_report_id::text);
end;
$$;


-- =============================================================================
-- 15. Function privileges
-- =============================================================================
-- Postgres lets PUBLIC execute every new function by default. Revoke it all,
-- then grant back exactly what each role needs.
revoke execute on all functions in schema public  from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

-- Helpers referenced inside RLS policies / constraints must be executable by
-- the roles those policies apply to (they still aren't reachable over HTTP).
grant execute on function private.mfa_ok()                        to anon, authenticated;
grant execute on function private.is_admin()                      to anon, authenticated;
grant execute on function private.is_active_user(uuid)            to anon, authenticated;
grant execute on function private.can_write()                     to anon, authenticated;
grant execute on function private.valid_image_paths(text[], uuid) to authenticated;

-- Public API.
grant execute on function public.search_listings(text, text, integer, integer, public.item_condition, text, integer, integer, public.listing_status, uuid)
  to anon, authenticated;
grant execute on function public.checkout(uuid, integer, jsonb)         to authenticated;
grant execute on function public.mark_order_shipped(uuid)               to authenticated;
grant execute on function public.confirm_order_delivered(uuid)          to authenticated;
grant execute on function public.start_conversation(uuid)               to authenticated;
grant execute on function public.mark_conversation_read(uuid)           to authenticated;
grant execute on function public.unread_conversation_count()            to authenticated;
grant execute on function public.admin_status()                         to authenticated;
grant execute on function public.admin_stats()                          to authenticated;
grant execute on function public.admin_list_users(text, integer, integer) to authenticated;
grant execute on function public.admin_get_user(uuid)                   to authenticated;
grant execute on function public.admin_set_listing_status(uuid, text, text) to authenticated;
grant execute on function public.admin_resolve_report(uuid)             to authenticated;


-- =============================================================================
-- 16. Realtime (new-message notifications; delivery respects RLS)
-- =============================================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages')
  then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;


-- =============================================================================
-- 17. Storage: buckets and object policies
-- =============================================================================
-- * Only JPEG/PNG/WebP are accepted. SVG is deliberately excluded (it can carry
--   script). The app also re-encodes every photo in the browser, which strips
--   EXIF metadata such as GPS location before upload.
-- * Size limits are enforced by Storage itself, not just by the UI.
-- * Files are served from the Supabase domain, never from the app's origin, so
--   even a malicious upload can't run script with access to the app's session.
-- * Users can only write inside a folder named after their own user id, using
--   random file names; there is no UPDATE policy, so files can't be overwritten.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-images', 'listing-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars',        'avatars',        true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Upload rate limit helper (runs as the caller, so it only counts their files).
create or replace function private.recent_upload_count(p_bucket text)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)
    from storage.objects o
   where o.bucket_id = p_bucket
     and o.name like ((select auth.uid())::text || '/%')
     and o.created_at > now() - interval '1 hour';
$$;
revoke execute on function private.recent_upload_count(text) from public, anon;
grant  execute on function private.recent_upload_count(text) to authenticated;

-- listing-images ---------------------------------------------------------------
create policy "listing-images: upload to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-images'
    and name ~ ('^' || (select auth.uid())::text
                || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$')
    and (select private.can_write())
    and (select private.recent_upload_count('listing-images')) < 60
  );

create policy "listing-images: read own folder"
  on storage.objects for select to authenticated
  using (bucket_id = 'listing-images' and name like ((select auth.uid())::text || '/%'));

create policy "listing-images: delete own files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-images'
    and name like ((select auth.uid())::text || '/%')
    and (select private.mfa_ok())
  );

-- avatars ----------------------------------------------------------------------
create policy "avatars: upload to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and name ~ ('^' || (select auth.uid())::text
                || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$')
    and (select private.can_write())
    and (select private.recent_upload_count('avatars')) < 10
  );

create policy "avatars: read own folder"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and name like ((select auth.uid())::text || '/%'));

create policy "avatars: delete own files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and name like ((select auth.uid())::text || '/%')
    and (select private.mfa_ok())
  );
