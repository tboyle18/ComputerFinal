import { ChevronLeft, ChevronRight, ImagePlus, Star, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState, type DragEvent } from 'react'
import { toast } from 'sonner'
import { listingImageUrl } from '../../lib/images'
import { cn } from '../../lib/utils'

export type UploadItem =
  | { id: string; kind: 'existing'; path: string }
  | { id: string; kind: 'new'; file: File; preview: string }

export const MAX_IMAGES = 8
const MAX_BYTES = 15 * 1024 * 1024

export function previewOf(item: UploadItem) {
  return item.kind === 'new' ? item.preview : (listingImageUrl(item.path, 400) ?? '')
}

export function ImageUploader({ value, onChange, error }: { value: UploadItem[]; onChange: (items: UploadItem[]) => void; error?: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files)
    const images = list.filter((f) => f.type.startsWith('image/'))
    if (images.length < list.length) toast.error('Only image files can be uploaded')
    const tooBig = images.filter((f) => f.size > MAX_BYTES)
    if (tooBig.length) toast.error('Images must be under 15MB')
    const room = MAX_IMAGES - value.length
    const accepted = images.filter((f) => f.size <= MAX_BYTES).slice(0, Math.max(0, room))
    if (images.length > room) toast.message(`You can add up to ${MAX_IMAGES} photos`)
    if (!accepted.length) return
    onChange([
      ...value,
      ...accepted.map((file) => ({ id: crypto.randomUUID(), kind: 'new' as const, file, preview: URL.createObjectURL(file) })),
    ])
  }

  const remove = (id: string) => {
    const item = value.find((v) => v.id === id)
    if (item?.kind === 'new') URL.revokeObjectURL(item.preview)
    onChange(value.filter((v) => v.id !== id))
  }

  const move = (index: number, dir: -1 | 1) => {
    const next = [...value]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const makeCover = (index: number) => {
    const next = [...value]
    const [item] = next.splice(index, 1)
    onChange([item, ...next])
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'grid grid-cols-3 gap-3 rounded-3xl border-2 border-dashed p-3 transition-colors sm:grid-cols-4',
          dragging ? 'border-ink bg-accent/10' : error ? 'border-danger/50' : 'border-line-strong bg-surface/60',
          value.length === 0 && 'grid-cols-1 sm:grid-cols-1',
        )}
      >
        <AnimatePresence initial={false}>
          {value.map((item, i) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              className={cn('group relative aspect-square overflow-hidden rounded-2xl bg-surface-2', i === 0 && 'ring-2 ring-ink ring-offset-2 ring-offset-surface')}
            >
              <img src={previewOf(item)} alt="" className="size-full object-cover" />
              {i === 0 && (
                <span className="absolute top-2 left-2 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold tracking-wide text-canvas uppercase">
                  Cover
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white opacity-100 backdrop-blur transition hover:bg-black/80 sm:opacity-0 sm:group-hover:opacity-100"
                aria-label="Remove photo"
              >
                <X className="size-3.5" />
              </button>
              <div className="absolute inset-x-2 bottom-2 flex justify-between opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="flex size-7 items-center justify-center rounded-full bg-white/90 text-neutral-900 transition hover:bg-white disabled:opacity-40"
                    aria-label="Move left"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === value.length - 1}
                    className="flex size-7 items-center justify-center rounded-full bg-white/90 text-neutral-900 transition hover:bg-white disabled:opacity-40"
                    aria-label="Move right"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => makeCover(i)}
                    className="flex h-7 items-center gap-1 rounded-full bg-white/90 px-2 text-[11px] font-medium text-neutral-900 transition hover:bg-white"
                  >
                    <Star className="size-3" /> Cover
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {value.length < MAX_IMAGES && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-2xl text-center transition hover:bg-surface-2',
              value.length === 0 ? 'py-14' : 'aspect-square border border-line bg-surface',
            )}
          >
            <span
              className={cn(
                'flex items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-soft',
                value.length === 0 ? 'size-14' : 'size-10',
              )}
            >
              <ImagePlus className={value.length === 0 ? 'size-6' : 'size-5'} />
            </span>
            {value.length === 0 ? (
              <>
                <span className="mt-2 text-[15px] font-semibold">Add photos</span>
                <span className="max-w-xs text-sm text-muted">
                  Drag & drop or click to browse. Up to {MAX_IMAGES} photos — the first one is your cover.
                </span>
              </>
            ) : (
              <span className="text-xs font-medium text-muted">
                {value.length}/{MAX_IMAGES}
              </span>
            )}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files)
          e.target.value = ''
        }}
      />
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
    </div>
  )
}
