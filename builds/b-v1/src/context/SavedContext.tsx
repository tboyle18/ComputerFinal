import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

type SavedState = {
  ids: Set<string>
  isSaved: (listingId: string) => boolean
  toggle: (listingId: string) => Promise<void>
}

const SavedContext = createContext<SavedState | null>(null)

export function SavedProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [ids, setIds] = useState<Set<string>>(new Set())
  const userId = user?.id

  useEffect(() => {
    if (!userId) {
      setIds(new Set())
      return
    }
    supabase
      .from('favorites')
      .select('listing_id')
      .eq('user_id', userId)
      .then(({ data }) => setIds(new Set((data ?? []).map((r) => r.listing_id))))
  }, [userId])

  const isSaved = useCallback((id: string) => ids.has(id), [ids])

  const toggle = useCallback(
    async (listingId: string) => {
      if (!userId) {
        toast('Sign in to save items', { action: { label: 'Sign in', onClick: () => navigate('/login') } })
        return
      }
      const saved = ids.has(listingId)
      setIds((prev) => {
        const next = new Set(prev)
        if (saved) next.delete(listingId)
        else next.add(listingId)
        return next
      })
      const { error } = saved
        ? await supabase.from('favorites').delete().eq('user_id', userId).eq('listing_id', listingId)
        : await supabase.from('favorites').insert({ user_id: userId, listing_id: listingId })
      if (error && error.code !== '23505') {
        toast.error('Could not update saved items')
        setIds((prev) => {
          const next = new Set(prev)
          if (saved) next.add(listingId)
          else next.delete(listingId)
          return next
        })
      }
    },
    [userId, ids, navigate],
  )

  const value = useMemo(() => ({ ids, isSaved, toggle }), [ids, isSaved, toggle])
  return <SavedContext value={value}>{children}</SavedContext>
}

export function useSaved() {
  const ctx = use(SavedContext)
  if (!ctx) throw new Error('useSaved must be used inside SavedProvider')
  return ctx
}
