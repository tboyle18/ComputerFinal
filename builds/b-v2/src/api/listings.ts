import { supabase } from '../lib/supabase';
import type { Enums, Tables } from '../types/database';
import { removeImages } from '../lib/images';

export type Listing = Tables<'listings'>;
export type Condition = Enums<'item_condition'>;
export type ListingStatus = Enums<'listing_status'>;
export type Sort = 'newest' | 'price_asc' | 'price_desc' | 'relevance';

export const CARD_COLUMNS =
  'id, title, price_cents, image_paths, status, condition, location, category, created_at, seller_id' as const;
export type ListingCard = Pick<
  Listing,
  'id' | 'title' | 'price_cents' | 'image_paths' | 'status' | 'condition' | 'location' | 'category' | 'created_at' | 'seller_id'
>;

export interface ListingFilters {
  q?: string;
  category?: string;
  sort?: Sort;
  minPrice?: number;
  maxPrice?: number;
  condition?: Condition;
  seller?: string;
  status?: ListingStatus;
}

export const PAGE_SIZE = 24;

export async function searchListings(filters: ListingFilters, page = 0, pageSize = PAGE_SIZE): Promise<ListingCard[]> {
  const { data, error } = await supabase
    .rpc('search_listings', {
      p_query: filters.q || undefined,
      p_category: filters.category || undefined,
      p_min_price: filters.minPrice,
      p_max_price: filters.maxPrice,
      p_condition: filters.condition,
      p_sort: filters.sort ?? 'newest',
      p_limit: pageSize,
      p_offset: page * pageSize,
      p_status: filters.status ?? 'active',
      p_seller: filters.seller,
    })
    .select(CARD_COLUMNS);
  if (error) throw error;
  return data ?? [];
}

const DETAIL_COLUMNS =
  'id, title, description, price_cents, category, condition, location, image_paths, status, removed_reason, created_at, updated_at, sold_at, seller_id, seller:profiles!listings_seller_fkey(id, display_name, avatar_path, location, created_at)' as const;

export async function getListing(id: string) {
  const { data, error } = await supabase.from('listings').select(DETAIL_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}
export type ListingDetail = NonNullable<Awaited<ReturnType<typeof getListing>>>;

export async function getMyListings(userId: string, status: ListingStatus) {
  const { data, error } = await supabase
    .from('listings')
    .select(`${CARD_COLUMNS}, removed_reason, sold_at`)
    .eq('seller_id', userId)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export interface ListingInput {
  title: string;
  description: string;
  price_cents: number;
  category: string;
  condition: Condition;
  location: string;
  image_paths: string[];
}

export async function createListing(input: ListingInput): Promise<string> {
  // seller_id is NOT sent: the database fills it from the session (auth.uid()).
  const { data, error } = await supabase.from('listings').insert(input).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function updateListing(id: string, input: ListingInput): Promise<void> {
  const { data, error } = await supabase.from('listings').update(input).eq('id', id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw Object.assign(new Error('This listing can no longer be edited.'), { code: 'P0001' });
}

export async function deleteListing(listing: Pick<Listing, 'id' | 'image_paths' | 'status'>): Promise<void> {
  const { data, error } = await supabase.from('listings').delete().eq('id', listing.id).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw Object.assign(new Error('Listing not found.'), { code: 'PT404' });
  // Sold items keep their photos so the buyer's order history still shows them.
  if (listing.status !== 'sold') await removeImages('listing-images', listing.image_paths);
}

export async function getCategories() {
  const { data, error } = await supabase.from('categories').select('slug, name').order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function reportListing(listingId: string, reason: Enums<'report_reason'>, details: string) {
  const { error } = await supabase.from('reports').insert({ listing_id: listingId, reason, details });
  if (error) {
    if (error.code === '23505') throw Object.assign(new Error('You’ve already reported this listing.'), { code: 'P0001' });
    throw error;
  }
}
