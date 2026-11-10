-- Generated from 001_init_marketplace.sql by make_schema_sql.py. Do not edit by hand.
create schema if not exists a_v2;
set search_path = a_v2, extensions;

-- Create marketplace schema with security-first design
-- All tables use RLS (Row Level Security) to enforce access control

-- Categories table (public reference data)
CREATE TABLE categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users profile (extends Supabase auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Listings table
CREATE TABLE listings (
  id BIGSERIAL PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category_id BIGINT NOT NULL REFERENCES categories(id),
  price DECIMAL(10, 2) NOT NULL CHECK (price > 0),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Listing images
CREATE TABLE listing_images (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Messages (for seller-buyer communication)
CREATE TABLE messages (
  id BIGSERIAL PRIMARY KEY,
  listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shopping cart
CREATE TABLE cart_items (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, listing_id)
);

-- Orders
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id BIGINT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_price DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_listings_seller_id ON listings(seller_id);
CREATE INDEX idx_listings_category_id ON listings(category_id);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listing_images_listing_id ON listing_images(listing_id);
CREATE INDEX idx_messages_listing_id ON messages(listing_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX idx_orders_seller_id ON orders(seller_id);

-- Row Level Security (RLS) policies
-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- User profiles: users can read all, update only their own
CREATE POLICY "User profiles are viewable by all" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Listings: anyone can read active listings, owners can CRUD their own
CREATE POLICY "Active listings are viewable by all" ON listings FOR SELECT
  USING (status = 'active' OR auth.uid() = seller_id);
CREATE POLICY "Users can create listings" ON listings FOR INSERT
  WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Users can update their own listings" ON listings FOR UPDATE
  USING (auth.uid() = seller_id);
CREATE POLICY "Users can delete their own listings" ON listings FOR DELETE
  USING (auth.uid() = seller_id);

-- Listing images: viewable if listing is visible
CREATE POLICY "Images are viewable with listing" ON listing_images FOR SELECT
  USING (EXISTS (SELECT 1 FROM listings WHERE id = listing_id AND (status = 'active' OR auth.uid() = seller_id)));
CREATE POLICY "Users can manage images for their listings" ON listing_images FOR ALL
  USING (EXISTS (SELECT 1 FROM listings WHERE id = listing_id AND auth.uid() = seller_id));

-- Messages: participants and admins can view, only sender and recipient can access
CREATE POLICY "Users can view their messages" ON messages FOR SELECT
  USING (auth.uid() IN (sender_id, recipient_id) OR (SELECT is_admin FROM user_profiles WHERE id = auth.uid()));
CREATE POLICY "Users can send messages" ON messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Cart: users can only manage their own cart
CREATE POLICY "Users can view their cart" ON cart_items FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their cart" ON cart_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their cart" ON cart_items FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete from their cart" ON cart_items FOR DELETE
  USING (auth.uid() = user_id);

-- Orders: buyers and sellers can view their orders, admins can view all
CREATE POLICY "Users can view their orders" ON orders FOR SELECT
  USING (auth.uid() IN (buyer_id, seller_id) OR (SELECT is_admin FROM user_profiles WHERE id = auth.uid()));
CREATE POLICY "Users can create orders" ON orders FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Buyers can update their pending orders" ON orders FOR UPDATE
  USING (auth.uid() = buyer_id AND status = 'pending');

-- Insert default categories
INSERT INTO categories (name, slug) VALUES
  ('Electronics', 'electronics'),
  ('Furniture', 'furniture'),
  ('Clothing', 'clothing'),
  ('Books', 'books'),
  ('Sports', 'sports'),
  ('Home & Garden', 'home-garden'),
  ('Toys & Games', 'toys-games'),
  ('Collectibles', 'collectibles'),
  ('Art & Crafts', 'art-crafts'),
  ('Other', 'other');

insert into storage.buckets (id, name, public) values ('a-v2-listing-images', 'a-v2-listing-images', true)
on conflict (id) do nothing;
create policy "a-v2: public read" on storage.objects for select using (bucket_id = 'a-v2-listing-images');
create policy "a-v2: signed-in upload" on storage.objects for insert to authenticated with check (bucket_id = 'a-v2-listing-images');
create policy "a-v2: owner delete" on storage.objects for delete to authenticated using (bucket_id = 'a-v2-listing-images' and owner = auth.uid());

-- Supabase only grants API roles access to `public` by default; mirror that here.
grant usage on schema a_v2 to anon, authenticated, service_role;
grant all on all tables in schema a_v2 to anon, authenticated, service_role;
grant all on all routines in schema a_v2 to anon, authenticated, service_role;
grant all on all sequences in schema a_v2 to anon, authenticated, service_role;
alter default privileges in schema a_v2 grant all on tables to anon, authenticated, service_role;
alter default privileges in schema a_v2 grant all on routines to anon, authenticated, service_role;
alter default privileges in schema a_v2 grant all on sequences to anon, authenticated, service_role;
