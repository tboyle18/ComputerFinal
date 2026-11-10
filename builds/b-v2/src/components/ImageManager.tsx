import { useEffect, useRef, useState, type DragEvent } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, X } from 'lucide-react';
import { imageUrl } from '../lib/images';
import { cx } from './ui';

export const MAX_PHOTOS = 8;

export type PhotoItem =
  | { kind: 'existing'; key: string; path: string }
  | { kind: 'new'; key: string; file: File; preview: string };

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif';

export function ImageManager({
  items,
  onChange,
  error,
}: {
  items: PhotoItem[];
  onChange: (items: PhotoItem[]) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Revoke object URLs we created when the component unmounts.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(
    () => () => {
      for (const it of itemsRef.current) if (it.kind === 'new') URL.revokeObjectURL(it.preview);
    },
    [],
  );

  const addFiles = (files: FileList | File[]) => {
    setLocalError(null);
    const incoming = Array.from(files).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    const room = MAX_PHOTOS - items.length;
    if (incoming.length > room) setLocalError(`You can add up to ${MAX_PHOTOS} photos.`);
    const added: PhotoItem[] = incoming.slice(0, Math.max(0, room)).map((file) => ({
      kind: 'new',
      key: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }));
    if (added.length) onChange([...items, ...added]);
  };

  const removeAt = (i: number) => {
    const it = items[i];
    if (it?.kind === 'new') URL.revokeObjectURL(it.preview);
    onChange(items.filter((_, j) => j !== i));
  };

  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {items.map((it, i) => {
          const src = it.kind === 'new' ? it.preview : imageUrl('listing-images', it.path);
          return (
            <div key={it.key} className="group relative aspect-square overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line animate-pop">
              {src && <img src={src} alt={`Photo ${i + 1}`} className="size-full object-cover" />}
              {i === 0 && (
                <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[11px] font-semibold text-bg">Cover</span>
              )}
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                aria-label={`Remove photo ${i + 1}`}
              >
                <X className="size-4" />
              </button>
              <div className="absolute inset-x-2 bottom-2 flex justify-between opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="flex size-7 items-center justify-center rounded-full bg-surface/90 shadow disabled:opacity-0"
                  aria-label="Move earlier"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  className="flex size-7 items-center justify-center rounded-full bg-surface/90 shadow disabled:opacity-0"
                  aria-label="Move later"
                >
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          );
        })}
        {items.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cx(
              'flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm font-medium transition',
              dragging ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line text-muted hover:border-brand hover:text-brand-ink',
              error && 'border-danger',
            )}
          >
            <ImagePlus className="size-6" />
            <span>{items.length === 0 ? 'Add photos' : 'Add more'}</span>
            <span className="text-xs font-normal">
              {items.length}/{MAX_PHOTOS}
            </span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {(error || localError) && <p className="mt-2 text-sm text-danger">{error ?? localError}</p>}
      <p className="mt-2 text-xs text-muted">
        JPEG, PNG or WebP. Photos are resized and stripped of hidden metadata (like GPS location) before upload.
      </p>
    </div>
  );
}
