import { supabase } from './supabase';
import { UserFacingError } from './errors';

export type Bucket = 'listing-images' | 'avatars';

const MAX_INPUT_BYTES = 20 * 1024 * 1024; // what we're willing to decode
const MAX_PIXELS = 40_000_000; // reject "decompression bomb" images
const OUTPUT_LIMIT: Record<Bucket, number> = {
  'listing-images': 5 * 1024 * 1024,
  avatars: 2 * 1024 * 1024,
};
const MAX_DIMENSION: Record<Bucket, number> = { 'listing-images': 1600, avatars: 512 };

// Matches the server-side check: <user uuid>/<random uuid>.<ext>
const PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/**
 * Public URL for a stored image. Only well-formed storage paths are turned
 * into URLs, so the app never renders an arbitrary URL taken from the DB.
 */
export function imageUrl(bucket: Bucket, path: string | null | undefined): string | null {
  if (!path || !PATH_RE.test(path)) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Re-encode a user's photo in the browser before upload.
 *
 * SECURITY / PRIVACY: drawing the image onto a canvas and exporting a fresh
 * file strips ALL metadata, most importantly the GPS coordinates phones embed
 * in EXIF, which would otherwise reveal where the seller lives. It also means
 * we only ever upload a clean JPEG/WebP that we produced ourselves. (The
 * bucket independently enforces type and size on the server.)
 */
export async function processImage(file: File, bucket: Bucket): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new UserFacingError(`“${file.name}” isn’t an image.`);
  if (file.size > MAX_INPUT_BYTES) throw new UserFacingError(`“${file.name}” is larger than 20 MB.`);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new UserFacingError(`We couldn’t read “${file.name}”. Try a JPEG, PNG or WebP photo.`);
  }

  try {
    if (bitmap.width * bitmap.height > MAX_PIXELS) {
      throw new UserFacingError(`“${file.name}” has too many pixels.`);
    }
    const max = MAX_DIMENSION[bucket];
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new UserFacingError('Your browser couldn’t process this image.');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);

    for (const quality of [0.85, 0.75, 0.6]) {
      let blob = await canvasToBlob(canvas, 'image/webp', quality);
      // Some browsers can't encode WebP and silently return PNG; use JPEG then.
      if (!blob || blob.type !== 'image/webp') blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      if (blob && blob.size <= OUTPUT_LIMIT[bucket]) return blob;
    }
    throw new UserFacingError(`“${file.name}” is too large even after compression.`);
  } finally {
    bitmap.close();
  }
}

/** Upload a processed image to the user's own folder under a random name. */
export async function uploadImage(bucket: Bucket, userId: string, blob: Blob): Promise<string> {
  const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) {
    if (/row-level security|unauthorized|403/i.test(error.message)) {
      throw new UserFacingError('Upload refused. You may be uploading too quickly. Please wait and try again.');
    }
    throw new UserFacingError('Upload failed. Please try again.');
  }
  return path;
}

export async function removeImages(bucket: Bucket, paths: string[]): Promise<void> {
  const valid = paths.filter((p) => PATH_RE.test(p));
  if (valid.length === 0) return;
  // Best effort: an orphaned file is harmless, so don't block the user on it.
  await supabase.storage.from(bucket).remove(valid);
}
