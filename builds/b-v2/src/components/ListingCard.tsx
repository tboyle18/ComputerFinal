import { Link } from 'react-router';
import { ImageOff, MapPin } from 'lucide-react';
import type { ListingCard as ListingCardData } from '../api/listings';
import { CONDITION_LABELS, formatPrice, timeAgo } from '../lib/format';
import { imageUrl } from '../lib/images';
import { cx } from './ui';

export function ListingCard({ listing, index = 0 }: { listing: ListingCardData; index?: number }) {
  const cover = imageUrl('listing-images', listing.image_paths[0]);
  const sold = listing.status === 'sold';
  return (
    <Link
      to={`/listing/${listing.id}`}
      className="group block animate-rise"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line/60">
        {cover ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            decoding="async"
            className={cx(
              'size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]',
              sold && 'opacity-60 grayscale',
            )}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted">
            <ImageOff className="size-8" />
          </div>
        )}
        <span className="absolute bottom-2.5 left-2.5 rounded-full bg-surface/95 px-2.5 py-1 text-sm font-bold text-ink shadow-soft backdrop-blur">
          {formatPrice(listing.price_cents, { round: true })}
        </span>
        {sold && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-ink px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-bg">
            Sold
          </span>
        )}
        {listing.condition === 'new' && !sold && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-white">New</span>
        )}
      </div>
      <div className="mt-2.5 px-0.5">
        <h3 className="line-clamp-1 font-medium text-ink group-hover:text-brand-ink">{listing.title}</h3>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
          {listing.location ? (
            <>
              <MapPin className="size-3" />
              <span className="truncate">{listing.location}</span>
              <span aria-hidden>·</span>
            </>
          ) : (
            <>
              <span>{CONDITION_LABELS[listing.condition]}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <span className="shrink-0">{timeAgo(listing.created_at)}</span>
        </p>
      </div>
    </Link>
  );
}

export function ListingGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="skeleton aspect-square rounded-2xl" />
          <div className="skeleton mt-3 h-4 w-3/4 rounded" />
          <div className="skeleton mt-2 h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}
