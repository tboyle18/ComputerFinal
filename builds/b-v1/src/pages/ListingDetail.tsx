import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleCheck,
  Eye,
  Link2,
  MapPin,
  MessageCircle,
  Pencil,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { PageContainer } from '../components/layout/Layout'
import { Gallery } from '../components/listings/Gallery'
import { ListingGrid } from '../components/listings/ListingCard'
import { SaveButton } from '../components/listings/SaveButton'
import { Avatar } from '../components/ui/Avatar'
import { Button, ButtonLink } from '../components/ui/Button'
import { Badge, EmptyState, Skeleton } from '../components/ui/Feedback'
import { ConfirmDialog } from '../components/ui/Modal'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { getCategory } from '../lib/categories'
import { removeListingImages } from '../lib/images'
import { supabase } from '../lib/supabase'
import { LISTING_CARD_SELECT, type Listing, type ListingWithSeller, type Profile } from '../lib/types'
import { conditionLabel, CONDITIONS, displayName, errorMessage, formatDate, formatPrice, timeAgo } from '../lib/utils'

type Seller = Pick<Profile, 'id' | 'username' | 'full_name' | 'avatar_url' | 'location' | 'created_at' | 'bio'>
type DetailListing = Listing & { seller: Seller | null }

export default function ListingDetail() {
  const { id } = useParams()
  const { user, isAdmin } = useAuth()
  const cart = useCart()
  const navigate = useNavigate()
  const location = useLocation()

  const [listing, setListing] = useState<DetailListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [sellerStats, setSellerStats] = useState({ active: 0, sold: 0 })
  const [moreFromSeller, setMoreFromSeller] = useState<ListingWithSeller[]>([])
  const [similar, setSimilar] = useState<ListingWithSeller[]>([])
  const [busy, setBusy] = useState<null | 'cart' | 'buy' | 'message' | 'status'>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const { data } = await supabase
        .from('listings')
        .select('*, seller:profiles!listings_seller_id_fkey(id, username, full_name, avatar_url, location, created_at, bio)')
        .eq('id', id)
        .maybeSingle()
      if (cancelled) return
      const l = data as unknown as DetailListing | null
      setListing(l)
      setLoading(false)
      if (!l) return

      const [active, sold, more, sim] = await Promise.all([
        supabase.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', l.seller_id).eq('status', 'active'),
        supabase.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', l.seller_id).eq('status', 'sold'),
        supabase
          .from('listings')
          .select(LISTING_CARD_SELECT)
          .eq('seller_id', l.seller_id)
          .eq('status', 'active')
          .neq('id', l.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('listings')
          .select(LISTING_CARD_SELECT)
          .eq('category', l.category)
          .eq('status', 'active')
          .neq('id', l.id)
          .neq('seller_id', l.seller_id)
          .order('created_at', { ascending: false })
          .limit(5),
      ])
      if (cancelled) return
      setSellerStats({ active: active.count ?? 0, sold: sold.count ?? 0 })
      setMoreFromSeller((more.data ?? []) as unknown as ListingWithSeller[])
      setSimilar((sim.data ?? []) as unknown as ListingWithSeller[])
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) return <DetailSkeleton />
  if (!listing) {
    return (
      <PageContainer className="py-16">
        <EmptyState
          icon={Tag}
          title="This listing isn’t available"
          description="It may have been removed by the seller. Plenty more where that came from, though."
          action={<ButtonLink to="/">Browse listings</ButtonLink>}
        />
      </PageContainer>
    )
  }

  const isOwner = user?.id === listing.seller_id
  const sold = listing.status === 'sold'
  const inCart = cart.has(listing.id)
  const category = getCategory(listing.category)
  const condition = CONDITIONS.find((c) => c.value === listing.condition)

  const requireLogin = () => {
    navigate('/login', { state: { from: location.pathname } })
  }

  const addToCart = async () => {
    if (!user) return requireLogin()
    setBusy('cart')
    await cart.add(listing.id)
    setBusy(null)
  }

  const buyNow = async () => {
    if (!user) return requireLogin()
    setBusy('buy')
    const ok = await cart.add(listing.id, { silent: true })
    setBusy(null)
    if (ok) navigate('/checkout')
  }

  const messageSeller = async () => {
    if (!user) return requireLogin()
    setBusy('message')
    const { data, error } = await supabase.rpc('start_conversation', { p_listing_id: listing.id })
    setBusy(null)
    if (error || !data) return toast.error(errorMessage(error))
    navigate(`/messages/${data}`)
  }

  const toggleStatus = async () => {
    setBusy('status')
    const next = sold ? 'active' : 'sold'
    const { error } = await supabase.from('listings').update({ status: next }).eq('id', listing.id)
    setBusy(null)
    if (error) return toast.error(errorMessage(error))
    setListing({ ...listing, status: next })
    toast.success(next === 'sold' ? 'Marked as sold' : 'Listing is live again')
  }

  const deleteListing = async () => {
    const { error } = await supabase.from('listings').delete().eq('id', listing.id)
    if (error) {
      toast.error(errorMessage(error))
      throw error
    }
    await removeListingImages(listing.images)
    toast.success(isOwner ? 'Listing deleted' : 'Listing removed from the marketplace')
    navigate(isOwner ? `/u/${listing.seller?.username ?? ''}` : '/admin?tab=listings', { replace: true })
  }

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: listing.title, url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied to clipboard')
      }
    } catch {
      /* user cancelled */
    }
  }

  return (
    <PageContainer className="pt-6">
      <nav className="flex items-center gap-1.5 text-[13px] text-muted" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-ink">
          Home
        </Link>
        <ChevronRight className="size-3.5" />
        <Link to={`/?category=${category.slug}`} className="hover:text-ink">
          {category.name}
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="truncate text-ink-2">{listing.title}</span>
      </nav>

      <div className="mt-5 grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
        <Gallery images={listing.images} title={listing.title} category={listing.category} sold={sold} />

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>
              <category.icon /> {category.name}
            </Badge>
            <Badge tone={listing.condition === 'new' ? 'accent' : 'neutral'}>{conditionLabel(listing.condition)}</Badge>
            {sold && <Badge tone="ink">Sold</Badge>}
          </div>

          <h1 className="mt-4 text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-[34px]">{listing.title}</h1>

          <div className="mt-4 flex items-end gap-3">
            <p className="text-4xl font-semibold tracking-tight tabular-nums">{formatPrice(listing.price)}</p>
            {!sold && <p className="pb-1.5 text-sm text-muted">+ $4.99 shipping</p>}
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            {listing.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" /> {listing.location}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Zap className="size-4" /> Listed {timeAgo(listing.created_at)}
            </span>
          </div>

          {/* Actions */}
          <div className="mt-7 space-y-3">
            {isOwner ? (
              <div className="rounded-3xl border border-line bg-surface p-5">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Eye className="size-4 text-muted" /> This is your listing
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <ButtonLink to={`/listing/${listing.id}/edit`} variant="primary">
                    <Pencil /> Edit
                  </ButtonLink>
                  <Button variant="outline" onClick={toggleStatus} loading={busy === 'status'}>
                    {sold ? (
                      <>
                        <RotateCcw /> Relist
                      </>
                    ) : (
                      <>
                        <CircleCheck /> Mark sold
                      </>
                    )}
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <ButtonLink to="/messages" variant="soft">
                    <MessageCircle /> Messages
                  </ButtonLink>
                  <Button variant="soft" className="text-danger" onClick={() => setConfirmDelete(true)}>
                    <Trash2 /> Delete
                  </Button>
                </div>
              </div>
            ) : sold ? (
              <div className="rounded-3xl border border-line bg-surface-2/60 p-5 text-sm text-muted">
                This item has found a new home. Check out similar listings below, or message the seller to ask if they have
                anything like it.
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" onClick={messageSeller} loading={busy === 'message'}>
                    <MessageCircle /> Message seller
                  </Button>
                  <SaveButton listingId={listing.id} variant="outline" className="size-10" />
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Button size="lg" variant="accent" className="flex-1" onClick={buyNow} loading={busy === 'buy'}>
                    Buy now <ArrowRight />
                  </Button>
                  <SaveButton listingId={listing.id} variant="outline" />
                </div>
                <div className="flex gap-2">
                  {inCart ? (
                    <ButtonLink to="/cart" size="lg" variant="outline" className="flex-1">
                      <Check /> In your cart
                    </ButtonLink>
                  ) : (
                    <Button size="lg" variant="primary" className="flex-1" onClick={addToCart} loading={busy === 'cart'}>
                      <ShoppingBag /> Add to cart
                    </Button>
                  )}
                  <Button size="lg" variant="outline" className="flex-1" onClick={messageSeller} loading={busy === 'message'}>
                    <MessageCircle /> Message
                  </Button>
                </div>
              </>
            )}

            {isAdmin && !isOwner && (
              <Button variant="outline" className="w-full border-danger/40 text-danger hover:bg-danger/5" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Remove listing (admin)
              </Button>
            )}
          </div>

          {!isOwner && !sold && (
            <div className="mt-5 grid grid-cols-2 gap-3 text-[13px]">
              <div className="flex items-start gap-2.5 rounded-2xl bg-surface-2/70 p-3.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
                <span className="text-ink-2">Secure checkout — pay once for everything in your cart</span>
              </div>
              <div className="flex items-start gap-2.5 rounded-2xl bg-surface-2/70 p-3.5">
                <Truck className="mt-0.5 size-4 shrink-0 text-ink-2" />
                <span className="text-ink-2">Tracked delivery, usually within 2–4 days</span>
              </div>
            </div>
          )}

          {/* Seller */}
          {listing.seller && (
            <Link
              to={`/u/${listing.seller.username}`}
              className="group mt-6 flex items-center gap-4 rounded-3xl border border-line bg-surface p-4 transition hover:border-line-strong hover:shadow-soft"
            >
              <Avatar src={listing.seller.avatar_url} name={displayName(listing.seller)} seed={listing.seller.id} size={52} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{displayName(listing.seller)}</p>
                <p className="truncate text-[13px] text-muted">
                  @{listing.seller.username} · {sellerStats.active} for sale · {sellerStats.sold} sold
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[12px] text-muted">
                  <CalendarDays className="size-3" /> Member since {formatDate(listing.seller.created_at, { month: 'short', year: 'numeric' })}
                </p>
              </div>
              <ChevronRight className="size-5 text-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
            </Link>
          )}

          <button onClick={share} className="mt-4 flex items-center gap-1.5 text-[13px] font-medium text-muted transition hover:text-ink">
            <Link2 className="size-4" /> Share this listing
          </button>
        </div>
      </div>

      {/* Description & details */}
      <div className="mt-12 grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
        <section>
          <h2 className="text-lg font-semibold tracking-tight">About this item</h2>
          <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line text-ink-2">
            {listing.description || 'The seller hasn’t added a description yet.'}
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold tracking-tight">Details</h2>
          <dl className="mt-3 divide-y divide-line rounded-3xl border border-line bg-surface text-sm">
            {[
              ['Category', category.name],
              ['Condition', condition ? `${condition.label} — ${condition.hint.toLowerCase()}` : listing.condition],
              ['Location', listing.location || '—'],
              ['Listed', formatDate(listing.created_at)],
              ['Last updated', timeAgo(listing.updated_at)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-6 px-5 py-3.5">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {moreFromSeller.length > 0 && listing.seller && (
        <section className="mt-16">
          <div className="flex items-end justify-between">
            <h2 className="text-xl font-semibold tracking-tight">More from {displayName(listing.seller).split(' ')[0]}</h2>
            <Link to={`/u/${listing.seller.username}`} className="text-sm font-medium text-muted hover:text-ink">
              View shop →
            </Link>
          </div>
          <ListingGrid listings={moreFromSeller} className="mt-5" />
        </section>
      )}

      {similar.length > 0 && (
        <section className="mt-16">
          <div className="flex items-end justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Similar in {category.name}</h2>
            <Link to={`/?category=${category.slug}`} className="text-sm font-medium text-muted hover:text-ink">
              See all →
            </Link>
          </div>
          <ListingGrid listings={similar} className="mt-5" />
        </section>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={deleteListing}
        title={isOwner ? 'Delete this listing?' : 'Remove this listing?'}
        description={
          isOwner
            ? 'It will disappear from the marketplace and any carts. This can’t be undone.'
            : `This permanently removes “${listing.title}” and its photos from Trove. The seller will no longer see it.`
        }
        confirmLabel={isOwner ? 'Delete listing' : 'Remove listing'}
      />
    </PageContainer>
  )
}

function DetailSkeleton() {
  return (
    <PageContainer className="pt-6">
      <Skeleton className="h-4 w-56" />
      <div className="mt-5 grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
        <Skeleton className="aspect-square rounded-3xl" />
        <div>
          <Skeleton className="h-6 w-40 rounded-full" />
          <Skeleton className="mt-5 h-9 w-4/5" />
          <Skeleton className="mt-4 h-10 w-32" />
          <Skeleton className="mt-8 h-12 w-full rounded-full" />
          <Skeleton className="mt-3 h-12 w-full rounded-full" />
          <Skeleton className="mt-6 h-24 w-full rounded-3xl" />
        </div>
      </div>
    </PageContainer>
  )
}
