import { Heart } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageContainer } from '../components/layout/Layout'
import { ListingGrid } from '../components/listings/ListingCard'
import { ButtonLink } from '../components/ui/Button'
import { EmptyState } from '../components/ui/Feedback'
import { useAuth } from '../context/AuthContext'
import { useSaved } from '../context/SavedContext'
import { supabase } from '../lib/supabase'
import type { Listing } from '../lib/types'

export default function Saved() {
  const { user } = useAuth()
  const { ids } = useSaved()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('favorites')
      .select('created_at, listing:listings(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setListings((data ?? []).map((r) => r.listing).filter((l): l is Listing => Boolean(l)))
        setLoading(false)
      })
  }, [user])

  // Hide items the user un-hearts on this page straight away.
  const visible = listings.filter((l) => ids.has(l.id))

  return (
    <PageContainer className="pt-8">
      <h1 className="text-3xl font-semibold tracking-tight">Saved items</h1>
      <p className="mt-1.5 text-muted">Things you’ve got your eye on. We’ll keep them here until they sell.</p>
      <div className="mt-8">
        {!loading && visible.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="No saved items yet"
            description="Tap the heart on any listing to save it for later."
            action={<ButtonLink to="/">Start browsing</ButtonLink>}
          />
        ) : (
          <ListingGrid listings={visible} loading={loading} skeletons={5} />
        )}
      </div>
    </PageContainer>
  )
}
