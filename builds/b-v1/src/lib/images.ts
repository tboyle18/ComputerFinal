import { AVATAR_BUCKET, LISTING_BUCKET, supabase } from './supabase'

/**
 * Listing images are stored as paths inside the `listing-images` bucket
 * (e.g. "<user-id>/<uuid>.webp"). Seed data uses absolute URLs instead.
 */
export function listingImageUrl(path: string | null | undefined, width = 800): string | null {
  if (!path) return null
  if (/^https?:\/\//.test(path)) {
    if (path.includes('images.unsplash.com')) {
      const u = new URL(path)
      u.searchParams.set('w', String(width))
      u.searchParams.set('q', '80')
      u.searchParams.set('auto', 'format')
      u.searchParams.set('fit', 'crop')
      return u.toString()
    }
    return path
  }
  return supabase.storage.from(LISTING_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Storage path for a listing image, or null if it's an external URL. */
export function storagePathOf(path: string) {
  return /^https?:\/\//.test(path) ? null : path
}

/** Downscale and re-encode images in the browser before upload (max 1600px, WebP). */
export async function compressImage(file: File, maxSize = 1600, quality = 0.85): Promise<Blob> {
  if (file.type === 'image/gif') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
    if (!blob || blob.type !== 'image/webp') return file
    return blob.size < file.size || scale < 1 ? blob : file
  } catch {
    return file
  }
}

function extensionFor(blob: Blob, fallbackName: string) {
  const fromType: Record<string, string> = {
    'image/webp': 'webp',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/avif': 'avif',
  }
  return fromType[blob.type] ?? fallbackName.split('.').pop()?.toLowerCase() ?? 'jpg'
}

export async function uploadListingImage(userId: string, file: File): Promise<string> {
  const blob = await compressImage(file)
  const path = `${userId}/${crypto.randomUUID()}.${extensionFor(blob, file.name)}`
  const { error } = await supabase.storage
    .from(LISTING_BUCKET)
    .upload(path, blob, { contentType: blob.type || file.type, cacheControl: '31536000', upsert: false })
  if (error) throw error
  return path
}

export async function removeListingImages(paths: string[]) {
  const storagePaths = paths.map(storagePathOf).filter((p): p is string => Boolean(p))
  if (storagePaths.length === 0) return
  await supabase.storage.from(LISTING_BUCKET).remove(storagePaths)
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const blob = await compressImage(file, 512, 0.9)
  const path = `${userId}/${crypto.randomUUID()}.${extensionFor(blob, file.name)}`
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { contentType: blob.type || file.type, cacheControl: '31536000', upsert: false })
  if (error) throw error
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Remove a previous avatar we uploaded (only if it lives in our bucket). */
export async function removeAvatarByUrl(url: string | null | undefined) {
  if (!url) return
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return
  await supabase.storage.from(AVATAR_BUCKET).remove([decodeURIComponent(url.slice(idx + marker.length))])
}
