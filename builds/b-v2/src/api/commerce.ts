import { supabase } from '../lib/supabase';
import type { Shipping } from '../lib/validation';

/* ------------------------------------------------------------------ cart --- */
export async function getCart(userId: string) {
  const { data, error } = await supabase
    .from('cart_items')
    .select(
      'listing_id, added_at, listing:listings(id, title, price_cents, image_paths, status, seller_id, seller:profiles!listings_seller_fkey(id, display_name, avatar_path))',
    )
    .eq('user_id', userId)
    .order('added_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
export type CartRow = Awaited<ReturnType<typeof getCart>>[number];

export function isAvailable(row: CartRow): boolean {
  return !!row.listing && row.listing.status === 'active';
}

export async function addToCart(listingId: string) {
  const { error } = await supabase.from('cart_items').insert({ listing_id: listingId });
  // Already in the cart is fine.
  if (error && error.code !== '23505') throw error;
}

export async function removeFromCart(userId: string, listingId: string) {
  const { error } = await supabase.from('cart_items').delete().eq('user_id', userId).eq('listing_id', listingId);
  if (error) throw error;
}

/* -------------------------------------------------------------- checkout --- */
/**
 * SECURITY: the client sends only what the buyer SAW as the total; the server
 * recomputes it from current prices and refuses on mismatch. The idempotency
 * key makes retries/double-clicks safe. No payment card data is collected.
 */
export async function checkout(idempotencyKey: string, expectedTotalCents: number, shipping: Shipping) {
  const { data, error } = await supabase.rpc('checkout', {
    p_idempotency_key: idempotencyKey,
    p_expected_total_cents: expectedTotalCents,
    p_shipping: shipping,
  });
  if (error) throw error;
  return data;
}

const ORDER_COLUMNS =
  'id, checkout_id, status, subtotal_cents, created_at, shipped_at, delivered_at, buyer_id, seller_id, ship_name, ship_line1, ship_line2, ship_city, ship_region, ship_postal_code, ship_country, order_items(id, listing_id, title, price_cents, image_path), seller:profiles!orders_seller_fkey(id, display_name, avatar_path), buyer:profiles!orders_buyer_fkey(id, display_name, avatar_path)' as const;

export async function getOrders(userId: string, role: 'buyer' | 'seller') {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq(role === 'buyer' ? 'buyer_id' : 'seller_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}
export type Order = Awaited<ReturnType<typeof getOrders>>[number];

export async function getCheckout(checkoutId: string) {
  const { data, error } = await supabase
    .from('checkouts')
    .select('id, total_cents, payment_ref, created_at')
    .eq('id', checkoutId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('checkout_id', checkoutId);
  if (ordersError) throw ordersError;
  return { ...data, orders: orders ?? [] };
}

export async function markShipped(orderId: string) {
  const { error } = await supabase.rpc('mark_order_shipped', { p_order_id: orderId });
  if (error) throw error;
}

export async function confirmDelivered(orderId: string) {
  const { error } = await supabase.rpc('confirm_order_delivered', { p_order_id: orderId });
  if (error) throw error;
}
