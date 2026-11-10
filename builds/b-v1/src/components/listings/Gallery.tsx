import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { listingImageUrl } from '../../lib/images'
import { cn } from '../../lib/utils'
import { ListingImage } from './ListingImage'

export function Gallery({ images, title, category, sold }: { images: string[]; title: string; category: string; sold?: boolean }) {
  const [index, setIndex] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const count = images.length

  const go = useCallback((dir: number) => setIndex((i) => (i + dir + count) % count), [count])

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false)
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [lightbox, go])

  return (
    <div>
      <div className="group relative overflow-hidden rounded-3xl border border-line bg-surface-2">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <ListingImage
              path={images[index]}
              alt={`${title} — photo ${index + 1}`}
              category={category}
              width={1400}
              eager
              className="aspect-square sm:aspect-[5/4] lg:aspect-square"
              imgClassName={cn(sold && 'grayscale-[50%]')}
            />
          </motion.div>
        </AnimatePresence>

        {count > 0 && (
          <button
            onClick={() => setLightbox(true)}
            className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-white/85 text-neutral-900 opacity-0 shadow-soft backdrop-blur transition group-hover:opacity-100 hover:bg-white"
            aria-label="View full screen"
          >
            <Expand className="size-4" />
          </button>
        )}

        {count > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              className="absolute top-1/2 left-4 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-neutral-900 shadow-soft backdrop-blur transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
              aria-label="Previous photo"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={() => go(1)}
              className="absolute top-1/2 right-4 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-neutral-900 shadow-soft backdrop-blur transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
              aria-label="Next photo"
            >
              <ChevronRight className="size-5" />
            </button>
            <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <span key={i} className={cn('h-1.5 rounded-full bg-white transition-all', i === index ? 'w-5' : 'w-1.5 opacity-60')} />
              ))}
            </div>
          </>
        )}
        {sold && (
          <div className="absolute top-4 left-4 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold tracking-wider text-canvas uppercase">
            Sold
          </div>
        )}
      </div>

      {count > 1 && (
        <div className="no-scrollbar mt-3 flex gap-2.5 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img + i}
              onClick={() => setIndex(i)}
              className={cn(
                'size-20 shrink-0 overflow-hidden rounded-2xl border-2 transition',
                i === index ? 'border-ink' : 'border-transparent opacity-70 hover:opacity-100',
              )}
              aria-label={`Show photo ${i + 1}`}
            >
              <ListingImage path={img} alt="" category={category} width={200} className="size-full" />
            </button>
          ))}
        </div>
      )}

      {createPortal(
        <AnimatePresence>
          {lightbox && (
            <motion.div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLightbox(false)}
            >
              <motion.img
                key={index}
                src={listingImageUrl(images[index], 2000) ?? ''}
                alt={title}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain"
                onClick={(e) => e.stopPropagation()}
              />
              <button className="absolute top-5 right-5 rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20" aria-label="Close">
                <X className="size-5" />
              </button>
              {count > 1 && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      go(-1)
                    }}
                    className="absolute left-5 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="size-6" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      go(1)
                    }}
                    className="absolute right-5 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="size-6" />
                  </button>
                  <p className="absolute bottom-6 text-sm text-white/60 tabular-nums">
                    {index + 1} / {count}
                  </p>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
