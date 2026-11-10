import type { Database } from './database.types'

type Tables = Database['public']['Tables']
export type Row<T extends keyof Tables> = Tables[T]['Row']

export type Profile = Row<'profiles'>
export type Listing = Row<'listings'>
export type Order = Row<'orders'>
export type OrderItem = Row<'order_items'>
export type Conversation = Row<'conversations'>
export type Message = Row<'messages'>

export type Condition = 'new' | 'like_new' | 'good' | 'fair'
export type ListingStatus = 'active' | 'sold'

export type SellerSummary = Pick<Profile, 'id' | 'username' | 'full_name' | 'avatar_url'>

export type ListingWithSeller = Listing & { seller: SellerSummary | null }

/** Select string used everywhere a listing card is rendered. */
export const LISTING_CARD_SELECT = '*, seller:profiles!listings_seller_id_fkey(id, username, full_name, avatar_url)'

export type AdminUser = Database['public']['Functions']['admin_list_users']['Returns'][number]

export type AdminStats = {
  users: number
  new_users_7d: number
  active_listings: number
  sold_listings: number
  orders: number
  revenue: number
  messages: number
}
