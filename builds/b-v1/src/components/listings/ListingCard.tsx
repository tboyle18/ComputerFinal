import { MapPin } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import type { Listing } from '../../lib/types'
import { cn, conditionLabel, formatPrice, timeAgo } from '../../lib/utils'
import { Skeleton } from '../ui/Feedback'
import { ListingImage } from './ListingImage'
import { SaveButton } from './SaveButton'

type CardListing = Pick<Listing, 'id' | 'title' | 'price' | 'images' | 'location' | 'created_at' | 'condition' | 'status' | 'category'>

export function ListingCard({ listing, index = 0, hideSave }: { listing: CardListing; index?: number; hideSave?: boolean }) {
  const sold = listing.status === 'sold'

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index, 12) * 0.035, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link to={`/listing/${listing.id}`} className="group block focus-visible:outline-none">
        <div className="relative overflow-hidden rounded-2xl ring-1 ring-line/60 transition-shadow duration-300 group-hover:shadow-lift group-focus-visible:ring-2 group-focus-visible:ring-ink">
          <ListingImage
            path={listing.images[0]}
            alt={listing.title}
            category={listing.category}
            width={600}
            className="aspect-[4/5]"
            imgClassName={cn('transition-transform duration-700 ease-out group-hover:scale-[1.045]', sold && 'grayscale-[60%]')}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-linear-to-b from-black/15 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          {!hideSave && <SaveButton listingId={listing.id} className="absolute top-2.5 right-2.5" />}
          <div className="absolute bottom-2.5 left-2.5 flex gap-1.5">
            {sold ? (
              <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold tracking-wide text-canvas uppercase">Sold</span>
            ) : listing.condition === 'new' || listing.condition === 'like_new' ? (
              <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-neutral-900 backdrop-blur">
                {conditionLabel(listing.condition)}
              </span>
            ) : null}
            {listing.images.length > 1 && (
              <span className="rounded-full bg-black/45 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
                1/{listing.images.length}
              </span>
            )}
          </div>
        </div>
        <div className="mt-3 px-0.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className={cn('text-[17px] font-semibold tracking-tight tabular-nums', sold && 'text-muted line-through decoration-1')}>
              {formatPrice(listing.price)}
            </p>
            <span className="shrink-0 text-xs text-muted">{timeAgo(listing.created_at)}</span>
          </div>
          <h3 className="mt-0.5 line-clamp-1 text-sm text-ink-2 transition-colors group-hover:text-ink">{listing.title}</h3>
          {listing.location && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted">
              <MapPin className="size-3" />
              <span className="truncate">{listing.location}</span>
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

export function ListingCardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-[4/5] rounded-2xl" />
      <Skeleton className="mt-3 h-5 w-20" />
      <Skeleton className="mt-2 h-4 w-3/4" />
      <Skeleton className="mt-2 h-3 w-1/3" />
    </div>
  )
}

export function ListingGrid({
  listings,
  loading,
  skeletons = 10,
  className,
}: {
  listings: CardListing[]
  loading?: boolean
  skeletons?: number
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5', className)}>
      {listings.map((l, i) => (
        <ListingCard key={l.id} listing={l} index={i} />
      ))}
      {loading && Array.from({ length: skeletons }).map((_, i) => <ListingCardSkeleton key={`s${i}`} />)}
    </div>
  )
}
