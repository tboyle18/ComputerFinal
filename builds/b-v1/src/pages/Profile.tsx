import { CalendarDays, MapPin, Pencil, Plus, Store, UserX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { PageContainer } from '../components/layout/Layout'
import { ListingGrid } from '../components/listings/ListingCard'
import { Avatar } from '../components/ui/Avatar'
import { ButtonLink } from '../components/ui/Button'
import { Badge, EmptyState, Skeleton } from '../components/ui/Feedback'
import { Tabs } from '../components/ui/Tabs'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import type { Listing, Profile as ProfileRow } from '../lib/types'
import { displayName, formatDate } from '../lib/utils'

export default function Profile() {
  const { username } = useParams()
  const { user } = useAuth()
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'active' | 'sold'>('active')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const { data: p } = await supabase.from('profiles').select('*').eq('username', username ?? '').maybeSingle()
      if (cancelled) return
      setProfile(p)
      if (p) {
        const { data } = await supabase.from('listings').select('*').eq('seller_id', p.id).order('created_at', { ascending: false })
        if (!cancelled) setListings(data ?? [])
      }
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [username])

  if (!loading && !profile) {
    return (
      <PageContainer className="py-16">
        <EmptyState icon={UserX} title="User not found" description={`There’s nobody called @${username} on Trove.`} action={<ButtonLink to="/">Browse listings</ButtonLink>} />
      </PageContainer>
    )
  }

  const isMe = profile && user?.id === profile.id
  const active = listings.filter((l) => l.status === 'active')
  const sold = listings.filter((l) => l.status === 'sold')
  const shown = tab === 'active' ? active : sold
  const name = displayName(profile)

  return (
    <PageContainer className="pt-6">
      <section className="relative overflow-hidden rounded-[28px] border border-line bg-surface">
        <div className="hero-glow relative h-36 sm:h-44">
          <div className="dotted-bg absolute inset-0" />
        </div>
        <div className="relative px-6 pb-7 sm:px-10">
          <div className="-mt-14 flex flex-col gap-5 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              {loading || !profile ? (
                <Skeleton className="size-28 rounded-full ring-4 ring-surface sm:size-32" />
              ) : (
                <Avatar src={profile.avatar_url} name={name} seed={profile.id} size={128} className="ring-4 ring-surface max-sm:!size-28" />
              )}
              <div className="pb-1">
                {loading || !profile ? (
                  <>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="mt-2 h-4 w-28" />
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-3xl font-semibold tracking-tight">{name}</h1>
                      {profile.role === 'admin' && <Badge tone="accent">Admin</Badge>}
                    </div>
                    <p className="mt-0.5 text-muted">@{profile.username}</p>
                  </>
                )}
              </div>
            </div>
            {isMe && (
              <div className="flex gap-2 pb-1">
                <ButtonLink to="/settings" variant="outline">
                  <Pencil /> Edit profile
                </ButtonLink>
                <ButtonLink to="/sell" variant="accent">
                  <Plus /> New listing
                </ButtonLink>
              </div>
            )}
          </div>

          {profile && (
            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_auto]">
              <div>
                {profile.bio ? (
                  <p className="max-w-2xl text-[15px] leading-relaxed text-ink-2">{profile.bio}</p>
                ) : isMe ? (
                  <p className="text-[15px] text-muted">Add a short bio so buyers know who they’re dealing with.</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                  {profile.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-4" /> {profile.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-4" /> Joined {formatDate(profile.created_at, { month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                {[
                  ['For sale', active.length],
                  ['Sold', sold.length],
                ].map(([label, value]) => (
                  <div key={label} className="min-w-28 rounded-2xl bg-surface-2/70 px-5 py-3.5">
                    <p className="text-2xl font-semibold tabular-nums">{value}</p>
                    <p className="text-[13px] text-muted">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mt-10">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'active', label: 'For sale', count: active.length },
            { value: 'sold', label: 'Sold', count: sold.length },
          ]}
        />
        <div className="mt-6">
          {!loading && shown.length === 0 ? (
            <EmptyState
              icon={Store}
              title={tab === 'active' ? 'Nothing for sale right now' : 'No sales yet'}
              description={
                isMe
                  ? tab === 'active'
                    ? 'List your first item — it only takes a minute.'
                    : 'Items you sell will show up here.'
                  : 'Check back soon.'
              }
              action={isMe && tab === 'active' ? <ButtonLink to="/sell" variant="accent">List an item</ButtonLink> : undefined}
            />
          ) : (
            <ListingGrid listings={shown} loading={loading} skeletons={5} />
          )}
        </div>
      </section>
    </PageContainer>
  )
}
