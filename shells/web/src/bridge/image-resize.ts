// SPDX-License-Identifier: MPL-2.0
/**
 * Raster image downscaling for user uploads (web shell).
 *
 * User-uploaded photos can be huge (12 MP+ phone cameras). We cap them at
 * MAX_LONGEST_EDGE px on the longest side and re-encode. This:
 *   - keeps IndexedDB usage bounded (re-encoded WebP, under the quota guard),
 *   - strips EXIF/GPS metadata (privacy - phone photos carry location),
 *   - normalises orientation (EXIF rotation is baked in at decode time).
 *
 * SVG / vector inputs are resolution-independent and must NOT reach here - the
 * caller passes them through untouched.
 *
 * Bit depth: createImageBitmap + a 2D canvas flatten ANY deeper source (a
 * 16-bit PNG/TIFF, a 10-bit HEIC) to 8 bits per channel, and so does every
 * editing/export surface downstream. That crush is reported rather than
 * hidden: the ingest funnel (views/picker.ts storeUserUpload) sniffs the
 * source's declared depth first via depthHint() in lib/image-sample.ts and
 * tells the user when it exceeds 8 (plans/61-deeprichpixels.md Phase A).
 *
 * Only computeResize() is pure. downscaleRaster() touches browser APIs
 * (createImageBitmap, canvas) and must run in a DOM context.
 */

import { looksLikeHeic, decodeHeicBitmap } from './heic-decode.ts';

/** Longest-edge cap, in px, applied to stored user rasters (4K - high enough to
 *  stay crisp when a tool exports at 2×–3× on a large canvas). */
export const MAX_LONGEST_EDGE = 3840;

/**
 * Reject absurdly large decodes before allocating a canvas (decode-bomb guard).
 * 64 MP comfortably covers any real camera while bounding memory.
 */
export const MAX_SOURCE_PIXELS = 64 * 1024 * 1024;

// WebP gives the best size for both photos and flat graphics, preserves alpha,
// and decodes everywhere we render/export.
const OUTPUT_TYPE = 'image/webp';
const OUTPUT_QUALITY = 0.85;

/**
 * Pure: compute target dimensions for a longest-edge cap. Never upscales.
 *
 * @param {number} width   source width in px
 * @param {number} height  source height in px
 * @param {number} [max]   longest-edge cap (defaults to MAX_LONGEST_EDGE)
 * @returns {{ width: number, height: number, scale: number }}
 */
export function computeResize(
  width: number,
  height: number,
  max: number = MAX_LONGEST_EDGE,
): { width: number; height: number; scale: number } {
  const longest = Math.max(width, height);
  if (!Number.isFinite(longest) || longest <= 0 || longest <= max) {
    return { width, height, scale: 1 };
  }
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

/**
 * Human-readable, format-named reason a raster couldn't be decoded. The upload
 * accept lists advertise more image types than every browser can decode (HEIC is
 * Safari-only; AVIF/GIF are broad but not universal), so on a `createImageBitmap`
 * failure we surface THIS instead of an opaque DOMException. Pure - unit-testable.
 *
 * Seam: a bundled WASM decoder (e.g. libheif) would slot into downscaleRaster as a
 * fallback BEFORE this message is ever reached, at which point HEIC works everywhere.
 *
 * @param {Blob & {name?: string}} file
 * @returns {string}
 */
export function describeDecodeFailure(file: Blob & { name?: string }): string {
  const type = String(file?.type || '');
  const ext = (String(file?.name || '').match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  const is = (re: RegExp, ...exts: string[]): boolean => re.test(type) || exts.includes(ext);
  if (is(/heic|heif/, 'heic', 'heif')) {
    // Reached only when the bundled HEIC decoder ALSO failed (native + libheif both
    // gave up), so the file itself is the problem - not a missing capability.
    return 'This HEIC image couldn’t be read - the file may be damaged or use an unsupported feature.';
  }
  if (is(/avif/, 'avif')) return 'This browser can’t read AVIF images. Try converting it to JPEG, PNG or WebP first.';
  if (is(/tiff?/, 'tif', 'tiff')) return 'This browser can’t read TIFF images. Try converting it to JPEG, PNG or WebP first.';
  return 'This image couldn’t be read. Try a JPEG, PNG, WebP or GIF.';
}

/**
 * Decode any supported image file to an ImageBitmap (orientation baked in). Tries
 * the browser's native decoder first; on failure, if the file is HEIC/HEIF, falls
 * back to the bundled libheif decoder (lazy-loaded) so iPhone photos come in on
 * Chrome/Firefox too. Throws a clear, coded (`DECODE_UNSUPPORTED`) error only when
 * both paths give up. Shared by downscaleRaster and the headshot cropper.
 *
 * @param {Blob & {name?: string}} file
 * @returns {Promise<ImageBitmap>}
 */
export async function decodeImageBitmap(file: Blob & { name?: string }): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    if (await looksLikeHeic(file)) {
      try { return await decodeHeicBitmap(file); }
      catch { /* libheif couldn't handle it either - fall through to the message */ }
    }
    throw Object.assign(new Error(describeDecodeFailure(file)), { code: 'DECODE_UNSUPPORTED' });
  }
}

/**
 * Downscale + re-encode a raster image file. Returns a new Blob plus its final
 * dimensions and format. Vector files must never be passed here.
 *
 * @param {Blob} file  the raw uploaded raster
 * @returns {Promise<{ blob: Blob, width: number, height: number, format: string }>}
 */
export async function downscaleRaster(
  file: Blob,
): Promise<{ blob: Blob; width: number; height: number; format: string }> {
  // Decode with orientation baked in so the stored bytes are upright - natively, or
  // via the bundled libheif fallback when the browser can't (iPhone HEIC on Chrome/
  // Firefox). decodeImageBitmap throws a clear, coded message if both paths fail.
  const bitmap = await decodeImageBitmap(file);
  try {
    const srcW = bitmap.width;
    const srcH = bitmap.height;
    if (srcW * srcH > MAX_SOURCE_PIXELS) {
      throw new Error(`Image is too large to process (${srcW}×${srcH} px).`);
    }

    const { width, height } = computeResize(srcW, srcH, MAX_LONGEST_EDGE);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);

    const { blob, format } = await encodeCanvas(canvas);
    return { blob, width, height, format };
  } finally {
    bitmap.close?.();
  }
}

/**
 * Read a video's intrinsic dimensions (and duration) by loading only its metadata
 * into a detached <video>. The sibling of readDimensions for the verbatim-video
 * ingest path - <img>/naturalWidth is 0 for a video, so it needs its own reader.
 * Resolves with {} (never rejects) when the browser can't decode the container, so
 * a stored video simply carries no dimensions rather than failing the whole upload.
 * Always revokes the object URL. Capped so a slow/renderless context can't wedge.
 */
export function readVideoDimensions(
  file: Blob,
): Promise<{ width?: number; height?: number; duration?: number }> {
  return new Promise((resolve) => {
    let settled = false;
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const done = (dims: { width?: number; height?: number; duration?: number }) => {
      if (settled) return;
      settled = true;
      clearTimeout(cap);
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      resolve(dims);
    };
    const cap = setTimeout(() => done({}), 5000);
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => done({
      width: video.videoWidth || undefined,
      height: video.videoHeight || undefined,
      duration: Number.isFinite(video.duration) ? video.duration : undefined,
    });
    video.onerror = () => done({});
    video.src = url;
  });
}

/**
 * Encode a canvas to WebP, reading back the actual type - browsers that can't
 * encode the requested type fall back to PNG per the toBlob spec, so we don't
 * assume WebP just because we asked for it.
 */
function encodeCanvas(canvas: HTMLCanvasElement): Promise<{ blob: Blob; format: string }> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) return reject(new Error('Image encoding failed.'));
        const format = blob.type.includes('webp') ? 'webp'
          : blob.type.includes('png') ? 'png'
          : 'jpg';
        resolve({ blob, format });
      },
      OUTPUT_TYPE,
      OUTPUT_QUALITY,
    );
  });
}
