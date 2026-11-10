import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import type { ListingWithSeller } from '../lib/types'
import { errorMessage } from '../lib/utils'
import { useAuth } from './AuthContext'

export type CartItem = { listing_id: string; created_at: string; listing: ListingWithSeller | null }

type CartState = {
  items: CartItem[]
  count: number
  loading: boolean
  has: (listingId: string) => boolean
  add: (listingId: string, opts?: { silent?: boolean }) => Promise<boolean>
  remove: (listingId: string) => Promise<void>
  refresh: () => Promise<void>
}

const CartContext = createContext<CartState | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)
  const userId = user?.id

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([])
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('cart_items')
      .select(
        'listing_id, created_at, listing:listings(*, seller:profiles!listings_seller_id_fkey(id, username, full_name, avatar_url))',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (!error) setItems((data ?? []) as unknown as CartItem[])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const has = useCallback((listingId: string) => items.some((i) => i.listing_id === listingId), [items])

  const add = useCallback(
    async (listingId: string, opts?: { silent?: boolean }) => {
      if (!userId) return false
      if (items.some((i) => i.listing_id === listingId)) return true
      const { error } = await supabase.from('cart_items').insert({ user_id: userId, listing_id: listingId })
      if (error && error.code !== '23505') {
        toast.error(
          error.code === '42501' ? "This item can't be added — it may have sold or be your own listing." : errorMessage(error),
        )
        return false
      }
      await refresh()
      if (!opts?.silent) toast.success('Added to your cart')
      return true
    },
    [userId, items, refresh],
  )

  const remove = useCallback(
    async (listingId: string) => {
      if (!userId) return
      setItems((prev) => prev.filter((i) => i.listing_id !== listingId))
      const { error } = await supabase.from('cart_items').delete().eq('user_id', userId).eq('listing_id', listingId)
      if (error) {
        toast.error(errorMessage(error))
        refresh()
      }
    },
    [userId, refresh],
  )

  const value = useMemo(
    () => ({ items, count: items.length, loading, has, add, remove, refresh }),
    [items, loading, has, add, remove, refresh],
  )

  return <CartContext value={value}>{children}</CartContext>
}

export function useCart() {
  const ctx = use(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
