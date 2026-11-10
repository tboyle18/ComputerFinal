import { Heart } from 'lucide-react'
import { motion } from 'motion/react'
import { useSaved } from '../../context/SavedContext'
import { cn } from '../../lib/utils'

export function SaveButton({ listingId, className, variant = 'overlay' }: { listingId: string; className?: string; variant?: 'overlay' | 'outline' }) {
  const { isSaved, toggle } = useSaved()
  const saved = isSaved(listingId)

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(listingId)
      }}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from saved' : 'Save item'}
      className={cn(
        'flex items-center justify-center rounded-full transition active:scale-90',
        variant === 'overlay'
          ? 'size-9 bg-white/85 text-neutral-900 shadow-soft backdrop-blur hover:bg-white'
          : 'size-12 border border-line-strong bg-surface text-ink hover:bg-surface-2',
        className,
      )}
    >
      <motion.span
        key={String(saved)}
        initial={{ scale: saved ? 0.5 : 1 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
        className="flex"
      >
        <Heart className={cn(variant === 'overlay' ? 'size-4' : 'size-5', saved && 'fill-[#ff4d6d] text-[#ff4d6d]')} strokeWidth={2} />
      </motion.span>
    </button>
  )
}
