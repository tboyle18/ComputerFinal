-- Generated from 20261109000000_trove_schema.sql by make_schema_sql.py. Do not edit by hand.
create schema if not exists b_v1;
set search_path = b_v1, extensions;

-- =============================================================================
--  Trove marketplace: schema, row-level security, RPCs, realtime and storage
--  Run this once in the Supabase SQL editor (or via `supabase db push`).
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function b_v1.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =============================================================================
--  PROFILES  (one row per auth user, created automatically on sign-up)
-- =============================================================================
create table b_v1.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  full_name   text not null default '' check (char_length(full_name) <= 80),
  avatar_url  text,
  bio         text not null default '' check (char_length(bio) <= 500),
  location    text not null default '' check (char_length(location) <= 80),
  role        text not null default 'user' check (role in ('user', 'admin')),
  created_at  timestamptz not null default now()
);

-- Is the current user an admin?  SECURITY DEFINER so it can be used inside
-- policies without recursing through profiles' own RLS.
create or replace function b_v1.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from b_v1.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Create a profile row whenever someone signs up.
create or replace function b_v1.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_name text;
  candidate text;
  attempts  int := 0;
begin
  base_name := lower(coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    split_part(coalesce(new.email, ''), '@', 1),
    'user'
  ));
  base_name := regexp_replace(base_name, '[^a-z0-9_]', '', 'g');
  if char_length(base_name) < 3 then
    base_name := base_name || 'user';
  end if;
  base_name := left(base_name, 19);
  candidate := base_name;

  while exists (select 1 from b_v1.profiles where username = candidate) loop
    attempts := attempts + 1;
    candidate := base_name || (floor(random() * 9000) + 1000)::int::text;
    exit when attempts > 25;
  end loop;

  insert into b_v1.profiles (id, username, full_name)
  values (
    new.id,
    candidate,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 80)
  );
  return new;
end;
$$;

create trigger on_auth_user_created_b_v1
  after insert on auth.users
  for each row execute function b_v1.handle_new_user();

alter table b_v1.profiles enable row level security;

create policy "Profiles are public"
  on b_v1.profiles for select
  using (true);

create policy "Users update their own profile"
  on b_v1.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Users may edit these columns only. `role` can only change through
-- admin_set_role(), so nobody can promote themselves.
revoke all on b_v1.profiles from anon, authenticated;
grant select on b_v1.profiles to anon, authenticated;
grant update (username, full_name, avatar_url, bio, location) on b_v1.profiles to authenticated;

-- =============================================================================
--  CATEGORIES
-- =============================================================================
create table b_v1.categories (
  slug        text primary key,
  name        text not null,
  icon        text not null,
  sort_order  int  not null default 0
);

insert into b_v1.categories (slug, name, icon, sort_order) values
  ('electronics',  'Electronics',        'laptop',     1),
  ('fashion',      'Fashion',            'shirt',      2),
  ('home',         'Home & Living',      'sofa',       3),
  ('sports',       'Sports & Outdoors',  'bike',       4),
  ('collectibles', 'Collectibles & Art', 'gem',        5),
  ('books',        'Books',              'book-open',  6),
  ('gaming',       'Gaming',             'gamepad-2',  7),
  ('music',        'Music',              'music',      8),
  ('kids',         'Kids & Baby',        'baby',       9),
  ('other',        'Other',              'package',   10);

alter table b_v1.categories enable row level security;

create policy "Categories are public"
  on b_v1.categories for select
  using (true);

revoke all on b_v1.categories from anon, authenticated;
grant select on b_v1.categories to anon, authenticated;

-- =============================================================================
--  LISTINGS
-- =============================================================================
create table b_v1.listings (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references b_v1.profiles (id) on delete cascade,
  title        text not null check (char_length(title) between 3 and 100),
  description  text not null default '' check (char_length(description) <= 5000),
  price        numeric(10, 2) not null check (price >= 0 and price <= 1000000),
  category     text not null references b_v1.categories (slug) on update cascade,
  condition    text not null default 'good'
               check (condition in ('new', 'like_new', 'good', 'fair')),
  location     text not null default '' check (char_length(location) <= 80),
  -- Storage paths inside the `listing-images` bucket (or absolute URLs).
  images       text[] not null default '{}' check (cardinality(images) <= 8),
  status       text not null default 'active' check (status in ('active', 'sold')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index listings_status_created_idx on b_v1.listings (status, created_at desc);
create index listings_seller_idx         on b_v1.listings (seller_id);
create index listings_category_idx       on b_v1.listings (category);
create index listings_title_trgm_idx     on b_v1.listings using gin (title extensions.gin_trgm_ops);

create trigger listings_set_updated_at
  before update on b_v1.listings
  for each row execute function b_v1.set_updated_at();

alter table b_v1.listings enable row level security;

create policy "Listings are public"
  on b_v1.listings for select
  using (true);

create policy "Sellers create their own listings"
  on b_v1.listings for insert
  to authenticated
  with check (seller_id = (select auth.uid()) and status = 'active');

create policy "Sellers update their own listings"
  on b_v1.listings for update
  to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));

create policy "Sellers and admins delete listings"
  on b_v1.listings for delete
  to authenticated
  using (seller_id = (select auth.uid()) or b_v1.is_admin());

revoke all on b_v1.listings from anon, authenticated;
grant select on b_v1.listings to anon, authenticated;
grant insert, delete on b_v1.listings to authenticated;
grant update (title, description, price, category, condition, location, images, status)
  on b_v1.listings to authenticated;

-- =============================================================================
--  FAVORITES  ("saved" items)
-- =============================================================================
create table b_v1.favorites (
  user_id     uuid not null references b_v1.profiles (id) on delete cascade,
  listing_id  uuid not null references b_v1.listings (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index favorites_listing_idx on b_v1.favorites (listing_id);

alter table b_v1.favorites enable row level security;

create policy "Users see their own favorites"
  on b_v1.favorites for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users add their own favorites"
  on b_v1.favorites for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users remove their own favorites"
  on b_v1.favorites for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on b_v1.favorites from anon, authenticated;
grant select, insert, delete on b_v1.favorites to authenticated;

-- =============================================================================
--  CART
-- =============================================================================
create table b_v1.cart_items (
  user_id     uuid not null references b_v1.profiles (id) on delete cascade,
  listing_id  uuid not null references b_v1.listings (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create index cart_items_listing_idx on b_v1.cart_items (listing_id);

alter table b_v1.cart_items enable row level security;

create policy "Users see their own cart"
  on b_v1.cart_items for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users add available items they don't own"
  on b_v1.cart_items for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from b_v1.listings l
      where l.id = listing_id
        and l.status = 'active'
        and l.seller_id <> (select auth.uid())
    )
  );

create policy "Users remove items from their own cart"
  on b_v1.cart_items for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on b_v1.cart_items from anon, authenticated;
grant select, insert, delete on b_v1.cart_items to authenticated;

-- =============================================================================
--  ORDERS  (created only through place_order(); payment is simulated)
-- =============================================================================
create table b_v1.orders (
  id                 uuid primary key default gen_random_uuid(),
  order_number       text not null unique
                     default ('TRV-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))),
  buyer_id           uuid references b_v1.profiles (id) on delete set null,
  subtotal           numeric(10, 2) not null,
  shipping_fee       numeric(10, 2) not null default 0,
  total              numeric(10, 2) not null,
  status             text not null default 'paid' check (status in ('paid', 'cancelled')),
  shipping_name      text not null,
  shipping_address   text not null,
  shipping_city      text not null,
  shipping_postcode  text not null,
  shipping_country   text not null,
  payment_brand      text not null,
  payment_last4      text not null check (payment_last4 ~ '^[0-9]{4}$'),
  created_at         timestamptz not null default now()
);

create index orders_buyer_idx on b_v1.orders (buyer_id, created_at desc);

create table b_v1.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references b_v1.orders (id) on delete cascade,
  listing_id  uuid references b_v1.listings (id) on delete set null,
  buyer_id    uuid references b_v1.profiles (id) on delete set null,
  seller_id   uuid references b_v1.profiles (id) on delete set null,
  -- Snapshot of the listing at purchase time, so history survives edits/deletes.
  title       text not null,
  price       numeric(10, 2) not null,
  image       text,
  status      text not null default 'processing'
              check (status in ('processing', 'shipped', 'delivered')),
  created_at  timestamptz not null default now()
);

create index order_items_order_idx  on b_v1.order_items (order_id);
create index order_items_seller_idx on b_v1.order_items (seller_id, created_at desc);
create index order_items_buyer_idx  on b_v1.order_items (buyer_id);

alter table b_v1.orders      enable row level security;
alter table b_v1.order_items enable row level security;

create policy "Buyers, sellers and admins see orders"
  on b_v1.orders for select to authenticated
  using (
    buyer_id = (select auth.uid())
    or b_v1.is_admin()
    or exists (
      select 1 from b_v1.order_items oi
      where oi.order_id = orders.id and oi.seller_id = (select auth.uid())
    )
  );

create policy "Buyers, sellers and admins see order items"
  on b_v1.order_items for select to authenticated
  using (
    buyer_id = (select auth.uid())
    or seller_id = (select auth.uid())
    or b_v1.is_admin()
  );

revoke all on b_v1.orders      from anon, authenticated;
revoke all on b_v1.order_items from anon, authenticated;
grant select on b_v1.orders      to authenticated;
grant select on b_v1.order_items to authenticated;

-- Simulated checkout: turns the caller's cart into an order atomically.
create or replace function b_v1.place_order(
  p_shipping_name     text,
  p_shipping_address  text,
  p_shipping_city     text,
  p_shipping_postcode text,
  p_shipping_country  text,
  p_payment_brand     text,
  p_payment_last4     text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := auth.uid();
  v_order_id  uuid;
  v_subtotal  numeric(10, 2);
  v_sellers   int;
  v_items     int;
  v_shipping  numeric(10, 2);
begin
  if v_uid is null then
    raise exception 'You need to be signed in to check out';
  end if;

  if coalesce(trim(p_shipping_name), '') = ''
     or coalesce(trim(p_shipping_address), '') = ''
     or coalesce(trim(p_shipping_city), '') = ''
     or coalesce(trim(p_shipping_postcode), '') = ''
     or coalesce(trim(p_shipping_country), '') = '' then
    raise exception 'Please complete your shipping details';
  end if;

  if coalesce(p_payment_last4, '') !~ '^[0-9]{4}$' then
    raise exception 'Invalid payment details';
  end if;

  -- Lock the listings in this cart so two buyers can't purchase the same item.
  perform 1
  from b_v1.listings l
  join b_v1.cart_items c on c.listing_id = l.id
  where c.user_id = v_uid
  for update of l;

  select count(*), coalesce(sum(l.price), 0), count(distinct l.seller_id)
    into v_items, v_subtotal, v_sellers
  from b_v1.cart_items c
  join b_v1.listings l on l.id = c.listing_id
  where c.user_id = v_uid;

  if v_items = 0 then
    raise exception 'Your cart is empty';
  end if;

  if exists (
    select 1
    from b_v1.cart_items c
    join b_v1.listings l on l.id = c.listing_id
    where c.user_id = v_uid
      and (l.status <> 'active' or l.seller_id = v_uid)
  ) then
    raise exception 'Some items in your cart are no longer available';
  end if;

  -- Flat $4.99 shipping per seller (each seller ships separately).
  v_shipping := v_sellers * 4.99;

  insert into b_v1.orders (
    buyer_id, subtotal, shipping_fee, total,
    shipping_name, shipping_address, shipping_city, shipping_postcode, shipping_country,
    payment_brand, payment_last4
  ) values (
    v_uid, v_subtotal, v_shipping, v_subtotal + v_shipping,
    trim(p_shipping_name), trim(p_shipping_address), trim(p_shipping_city),
    trim(p_shipping_postcode), trim(p_shipping_country),
    left(coalesce(nullif(trim(p_payment_brand), ''), 'Card'), 20), p_payment_last4
  )
  returning id into v_order_id;

  insert into b_v1.order_items (order_id, listing_id, buyer_id, seller_id, title, price, image)
  select v_order_id, l.id, v_uid, l.seller_id, l.title, l.price, l.images[1]
  from b_v1.cart_items c
  join b_v1.listings l on l.id = c.listing_id
  where c.user_id = v_uid;

  update b_v1.listings
  set status = 'sold'
  where id in (select listing_id from b_v1.order_items where order_id = v_order_id);

  -- The items are gone: remove them from every cart, not just the buyer's.
  delete from b_v1.cart_items
  where listing_id in (select listing_id from b_v1.order_items where order_id = v_order_id);

  return v_order_id;
end;
$$;

-- Fulfilment: sellers mark items shipped, buyers confirm delivery.
create or replace function b_v1.update_order_item_status(p_item_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_item b_v1.order_items;
begin
  select * into v_item from b_v1.order_items where id = p_item_id for update;
  if not found then
    raise exception 'Order item not found';
  end if;

  if p_status = 'shipped' and v_item.seller_id = v_uid and v_item.status = 'processing' then
    update b_v1.order_items set status = 'shipped' where id = p_item_id;
  elsif p_status = 'delivered' and v_item.buyer_id = v_uid and v_item.status = 'shipped' then
    update b_v1.order_items set status = 'delivered' where id = p_item_id;
  else
    raise exception 'That status change is not allowed';
  end if;
end;
$$;

-- =============================================================================
--  MESSAGING
-- =============================================================================
create table b_v1.conversations (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid references b_v1.listings (id) on delete set null,
  buyer_id         uuid not null references b_v1.profiles (id) on delete cascade,
  seller_id        uuid not null references b_v1.profiles (id) on delete cascade,
  last_message     text,
  last_message_at  timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  unique (listing_id, buyer_id),
  check (buyer_id <> seller_id)
);

create index conversations_buyer_idx  on b_v1.conversations (buyer_id, last_message_at desc);
create index conversations_seller_idx on b_v1.conversations (seller_id, last_message_at desc);

create table b_v1.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references b_v1.conversations (id) on delete cascade,
  sender_id        uuid not null references b_v1.profiles (id) on delete cascade,
  body             text not null check (char_length(btrim(body)) between 1 and 2000),
  read_at          timestamptz,
  created_at       timestamptz not null default now()
);

create index messages_conversation_idx on b_v1.messages (conversation_id, created_at);
create index messages_unread_idx on b_v1.messages (conversation_id) where read_at is null;

create or replace function b_v1.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from b_v1.conversations c
    where c.id = p_conversation_id
      and (select auth.uid()) in (c.buyer_id, c.seller_id)
  );
$$;

alter table b_v1.conversations enable row level security;
alter table b_v1.messages      enable row level security;

create policy "Members see their conversations"
  on b_v1.conversations for select to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));

create policy "Members read messages"
  on b_v1.messages for select to authenticated
  using (b_v1.is_conversation_member(conversation_id));

create policy "Members send messages as themselves"
  on b_v1.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and b_v1.is_conversation_member(conversation_id)
  );

revoke all on b_v1.conversations from anon, authenticated;
revoke all on b_v1.messages      from anon, authenticated;
grant select on b_v1.conversations to authenticated;
grant select, insert on b_v1.messages to authenticated;

-- Keep the inbox preview up to date.
create or replace function b_v1.handle_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update b_v1.conversations
  set last_message = left(new.body, 160),
      last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger on_message_created
  after insert on b_v1.messages
  for each row execute function b_v1.handle_new_message();

-- Find or create the conversation between the caller and a listing's seller.
create or replace function b_v1.start_conversation(p_listing_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_seller uuid;
  v_id     uuid;
begin
  if v_uid is null then
    raise exception 'Sign in to message sellers';
  end if;

  select seller_id into v_seller from b_v1.listings where id = p_listing_id;
  if v_seller is null then
    raise exception 'Listing not found';
  end if;
  if v_seller = v_uid then
    raise exception 'This is your own listing';
  end if;

  insert into b_v1.conversations (listing_id, buyer_id, seller_id)
  values (p_listing_id, v_uid, v_seller)
  on conflict (listing_id, buyer_id) do nothing;

  select id into v_id
  from b_v1.conversations
  where listing_id = p_listing_id and buyer_id = v_uid;

  return v_id;
end;
$$;

-- Mark the other person's messages in a conversation as read.
create or replace function b_v1.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not b_v1.is_conversation_member(p_conversation_id) then
    raise exception 'Not a member of this conversation';
  end if;

  update b_v1.messages
  set read_at = now()
  where conversation_id = p_conversation_id
    and sender_id <> auth.uid()
    and read_at is null;
end;
$$;

-- Live chat & inbox updates.
alter publication supabase_realtime add table b_v1.messages;
alter publication supabase_realtime add table b_v1.conversations;

-- =============================================================================
--  ADMIN
-- =============================================================================
create or replace function b_v1.admin_list_users()
returns table (
  id               uuid,
  email            text,
  username         text,
  full_name        text,
  avatar_url       text,
  role             text,
  created_at       timestamptz,
  last_sign_in_at  timestamptz,
  listing_count    bigint,
  order_count      bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not b_v1.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  return query
  select p.id,
         u.email::text,
         p.username,
         p.full_name,
         p.avatar_url,
         p.role,
         p.created_at,
         u.last_sign_in_at,
         (select count(*) from b_v1.listings l where l.seller_id = p.id),
         (select count(*) from b_v1.orders o where o.buyer_id = p.id)
  from b_v1.profiles p
  join auth.users u on u.id = p.id
  order by p.created_at desc;
end;
$$;

create or replace function b_v1.admin_stats()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not b_v1.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  return json_build_object(
    'users',           (select count(*) from b_v1.profiles),
    'new_users_7d',    (select count(*) from b_v1.profiles where created_at > now() - interval '7 days'),
    'active_listings', (select count(*) from b_v1.listings where status = 'active'),
    'sold_listings',   (select count(*) from b_v1.listings where status = 'sold'),
    'orders',          (select count(*) from b_v1.orders),
    'revenue',         (select coalesce(sum(total), 0) from b_v1.orders),
    'messages',        (select count(*) from b_v1.messages)
  );
end;
$$;

create or replace function b_v1.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not b_v1.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot delete your own account from the admin dashboard';
  end if;

  -- Cascades to the profile, listings, carts, favorites and conversations.
  -- Orders are kept (buyer/seller set to null) for bookkeeping.
  delete from auth.users where id = p_user_id;
end;
$$;

create or replace function b_v1.admin_set_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not b_v1.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_role not in ('user', 'admin') then
    raise exception 'Unknown role';
  end if;
  if p_user_id = auth.uid() and p_role <> 'admin' then
    raise exception 'You cannot remove your own admin access';
  end if;

  update b_v1.profiles set role = p_role where id = p_user_id;
end;
$$;

-- RPC permissions: signed-in users only (nothing for anonymous visitors).
revoke execute on function b_v1.place_order(text, text, text, text, text, text, text) from public, anon;
revoke execute on function b_v1.update_order_item_status(uuid, text)                  from public, anon;
revoke execute on function b_v1.start_conversation(uuid)                              from public, anon;
revoke execute on function b_v1.mark_conversation_read(uuid)                          from public, anon;
revoke execute on function b_v1.admin_list_users()                                    from public, anon;
revoke execute on function b_v1.admin_stats()                                         from public, anon;
revoke execute on function b_v1.admin_delete_user(uuid)                               from public, anon;
revoke execute on function b_v1.admin_set_role(uuid, text)                            from public, anon;
revoke execute on function b_v1.handle_new_user()                                     from public, anon, authenticated;
revoke execute on function b_v1.handle_new_message()                                  from public, anon, authenticated;

grant execute on function b_v1.place_order(text, text, text, text, text, text, text) to authenticated;
grant execute on function b_v1.update_order_item_status(uuid, text)                  to authenticated;
grant execute on function b_v1.start_conversation(uuid)                              to authenticated;
grant execute on function b_v1.mark_conversation_read(uuid)                          to authenticated;
grant execute on function b_v1.admin_list_users()                                    to authenticated;
grant execute on function b_v1.admin_stats()                                         to authenticated;
grant execute on function b_v1.admin_delete_user(uuid)                               to authenticated;
grant execute on function b_v1.admin_set_role(uuid, text)                            to authenticated;
grant execute on function b_v1.is_admin()                                            to anon, authenticated;
grant execute on function b_v1.is_conversation_member(uuid)                          to authenticated;

-- =============================================================================
--  STORAGE  (public image buckets; users write only inside their own folder)
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('b-v1-listing-images', 'b-v1-listing-images', true, 5242880,
     array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']),
  ('b-v1-avatars', 'b-v1-avatars', true, 2097152,
     array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Files live at <bucket>/<user id>/<file>. Public URLs work for everyone
-- because the buckets are public; these policies govern the API itself.
create policy "b-v1: Trove: users read their own files"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('b-v1-listing-images', 'b-v1-avatars')
    and ((storage.foldername(name))[1] = (select auth.uid())::text or b_v1.is_admin())
  );

create policy "b-v1: Trove: users upload into their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('b-v1-listing-images', 'b-v1-avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "b-v1: Trove: users update their own files"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('b-v1-listing-images', 'b-v1-avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "b-v1: Trove: owners and admins delete files"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('b-v1-listing-images', 'b-v1-avatars')
    and ((storage.foldername(name))[1] = (select auth.uid())::text or b_v1.is_admin())
  );

-- Supabase only grants API roles access to `public` by default; mirror that here.
grant usage on schema b_v1 to anon, authenticated, service_role;
grant all on all tables in schema b_v1 to anon, authenticated, service_role;
grant all on all routines in schema b_v1 to anon, authenticated, service_role;
grant all on all sequences in schema b_v1 to anon, authenticated, service_role;
alter default privileges in schema b_v1 grant all on tables to anon, authenticated, service_role;
alter default privileges in schema b_v1 grant all on routines to anon, authenticated, service_role;
alter default privileges in schema b_v1 grant all on sequences to anon, authenticated, service_role;
