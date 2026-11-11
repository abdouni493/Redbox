import { v4 as uuidv4 } from 'uuid';
import { supabase, PRODUCT_IMAGES_BUCKET } from './supabase';
import { useSettingsStore } from '@/store/settingsStore';

// ============================================================
// Image optimisation + upload to Supabase Storage
// ------------------------------------------------------------
// Every picture picked in the app (products, fiches techniques, productions,
// store logo) is:
//   1. decoded in the browser,
//   2. resized so its largest side is <= `imageMaxSize` px,
//   3. re-encoded as WebP (JPEG fallback) at `imageQuality`, lowering the
//      quality step by step until it fits under the target weight,
//   4. uploaded to a public Supabase bucket — only the URL is stored in the
//      database row.
// ============================================================

export const IMAGE_DEFAULTS = { imageOptimize: true, imageMaxSize: 800, imageQuality: 0.72 };
// Target weight: we keep lowering the quality until the file is under this.
const TARGET_BYTES = 120 * 1024;
const MIN_QUALITY = 0.4;

export interface OptimizeOptions {
  maxSize?: number;
  quality?: number;
}

function imageSettings(): Required<OptimizeOptions> & { enabled: boolean } {
  const s = useSettingsStore.getState().settings;
  return {
    enabled: s.imageOptimize ?? IMAGE_DEFAULTS.imageOptimize,
    maxSize: s.imageMaxSize || IMAGE_DEFAULTS.imageMaxSize,
    quality: s.imageQuality || IMAGE_DEFAULTS.imageQuality,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Resize + compress an image (File, Blob or data/http URL) to the smallest reasonable size. */
export async function optimizeImage(input: Blob | string, opts: OptimizeOptions = {}): Promise<Blob> {
  const cfg = imageSettings();
  const maxSize = opts.maxSize ?? cfg.maxSize;
  let quality = opts.quality ?? cfg.quality;

  const objectUrl = typeof input === 'string' ? null : URL.createObjectURL(input);
  try {
    const img = await loadImage(objectUrl ?? (input as string));
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponible');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);

    // WebP gives the smallest files; browsers without WebP encoding return PNG,
    // in which case we fall back to JPEG (white background for transparency).
    let type = 'image/webp';
    let blob = await canvasToBlob(canvas, type, quality);
    if (!blob || blob.type !== 'image/webp') {
      type = 'image/jpeg';
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      blob = await canvasToBlob(canvas, type, quality);
    }
    while (blob && blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - 0.1);
      blob = await canvasToBlob(canvas, type, quality);
    }
    if (!blob) throw new Error("Échec de l'optimisation");
    // Never return something heavier than the original file.
    if (typeof input !== 'string' && input.size <= blob.size && input.type.startsWith('image/')) return input;
    return blob;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

function extFor(type: string) {
  if (type === 'image/webp') return 'webp';
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/png') return 'png';
  if (type === 'image/gif') return 'gif';
  return 'img';
}

/** Upload a blob to a Supabase bucket and return its public URL. */
export async function uploadImageBlob(blob: Blob, folder = 'misc', bucket = PRODUCT_IMAGES_BUCKET): Promise<string> {
  const path = `${folder}/${uuidv4()}.${extFor(blob.type)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/**
 * Optimise (when enabled in Settings) and upload an image picked by the user.
 * Returns the public URL of the stored file. If the upload fails (offline,
 * bucket missing…) the optimised image is returned as a data URL so the user
 * does not lose the picture.
 */
export async function processAndUploadImage(file: Blob, folder = 'misc', bucket = PRODUCT_IMAGES_BUCKET): Promise<string> {
  const { enabled } = imageSettings();
  const blob = enabled ? await optimizeImage(file) : file;
  try {
    return await uploadImageBlob(blob, folder, bucket);
  } catch (e) {
    console.error('[images] upload failed, keeping the image inline', e);
    return blobToDataUrl(blob);
  }
}

/** Remove a previously uploaded image from its bucket (best effort). */
export async function deleteStoredImage(url: string | null | undefined) {
  if (!url || !url.includes('/storage/v1/object/public/')) return;
  const after = url.split('/storage/v1/object/public/')[1];
  const [bucket, ...rest] = after.split('/');
  if (!bucket || !rest.length) return;
  await supabase.storage.from(bucket).remove([decodeURIComponent(rest.join('/').split('?')[0])]);
}

export function isInlineImage(v: string | null | undefined): v is string {
  return !!v && v.startsWith('data:');
}

/** Convert an inline (base64) image into an optimised file in the bucket. */
export async function migrateInlineImage(dataUrl: string, folder: string, bucket = PRODUCT_IMAGES_BUCKET): Promise<string> {
  const blob = await optimizeImage(dataUrl);
  return uploadImageBlob(blob, folder, bucket);
}
