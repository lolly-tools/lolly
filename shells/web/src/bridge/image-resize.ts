// SPDX-License-Identifier: MPL-2.0
/**
 * Raster image downscaling for user uploads (web shell).
 *
 * User-uploaded photos can be huge (12 MP+ phone cameras). We cap them at
 * MAX_LONGEST_EDGE px on the longest side and re-encode. This:
 *   - keeps IndexedDB usage bounded (re-encoded WebP, under the quota guard),
 *   - strips EXIF/GPS metadata (privacy — phone photos carry location),
 *   - normalises orientation (EXIF rotation is baked in at decode time).
 *
 * SVG / vector inputs are resolution-independent and must NOT reach here — the
 * caller passes them through untouched.
 *
 * Only computeResize() is pure. downscaleRaster() touches browser APIs
 * (createImageBitmap, canvas) and must run in a DOM context.
 */

/** Longest-edge cap, in px, applied to stored user rasters (4K — high enough to
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

export interface ResizeResult {
  width: number;
  height: number;
  scale: number;
}

/** Pure: compute target dimensions for a longest-edge cap. Never upscales. */
export function computeResize(width: number, height: number, max: number = MAX_LONGEST_EDGE): ResizeResult {
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

export interface DownscaledRaster {
  blob: Blob;
  width: number;
  height: number;
  format: 'webp' | 'png' | 'jpg';
}

/**
 * Downscale + re-encode a raster image file. Returns a new Blob plus its final
 * dimensions and format. Vector files must never be passed here.
 */
export async function downscaleRaster(file: Blob): Promise<DownscaledRaster> {
  // Decode with EXIF orientation baked in so the stored bytes are upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
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
    bitmap.close();
  }
}

/**
 * Encode a canvas to WebP, reading back the actual type — browsers that can't
 * encode the requested type fall back to PNG per the toBlob spec, so we don't
 * assume WebP just because we asked for it.
 */
function encodeCanvas(canvas: HTMLCanvasElement): Promise<{ blob: Blob; format: DownscaledRaster['format'] }> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) return reject(new Error('Image encoding failed.'));
        const format: DownscaledRaster['format'] = blob.type.includes('webp') ? 'webp'
          : blob.type.includes('png') ? 'png'
          : 'jpg';
        resolve({ blob, format });
      },
      OUTPUT_TYPE,
      OUTPUT_QUALITY,
    );
  });
}
