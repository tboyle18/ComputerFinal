import { useState } from 'react'
import { getCategory } from '../../lib/categories'
import { listingImageUrl } from '../../lib/images'
import { cn } from '../../lib/utils'

type Props = {
  path: string | null | undefined
  alt: string
  category?: string
  width?: number
  className?: string
  imgClassName?: string
  eager?: boolean
}

/** Listing photo with a soft placeholder while loading and a category glyph if missing. */
export function ListingImage({ path, alt, category, width = 800, className, imgClassName, eager }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const src = listingImageUrl(path, width)
  const cat = getCategory(category)
  const Icon = cat.icon

  return (
    <div className={cn('relative overflow-hidden bg-surface-2', className)}>
      {src && !failed ? (
        <>
          {!loaded && <div className="skeleton absolute inset-0 rounded-none" />}
          <img
            src={src}
            alt={alt}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={cn('size-full object-cover transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0', imgClassName)}
          />
        </>
      ) : (
        <div
          className="flex size-full items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${cat.tint}22, ${cat.tint}44)` }}
        >
          <Icon className="size-1/4 max-h-16 max-w-16 opacity-50" style={{ color: cat.tint }} strokeWidth={1.5} />
        </div>
      )}
    </div>
  )
}
