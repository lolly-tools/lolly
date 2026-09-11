// SPDX-License-Identifier: MPL-2.0
/**
 * Rasterise a render blob to a downscaled data-URL usable as an <img> src.
 *
 * Shared by the profile-personalized gallery previews (personalize-previews.ts)
 * and the cinematic featured row (components/featured-row.ts): both take a full
 * -resolution render blob from renderRowToBlob and need a gallery-weight thumbnail.
 * Kept here so the two callers can't drift on the size ceiling or the decode dance.
 */

/**
 * Downscale a raster render blob to a PNG data-URL. Mirrors the 720×560 ceiling
 * captureThumbnail uses, so a generated preview is the same weight as a committed
 * one. Never upscales (scale is clamped to ≤ 1).
 */
export async function rasterToThumbnailDataUrl(blob: Blob, maxW = 720, maxH = 560): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const nw = img.naturalWidth || maxW;
    const nh = img.naturalHeight || maxH;
    const scale = Math.min(maxW / nw, maxH / nh, 1);
    const w = Math.max(1, Math.round(nw * scale));
    const h = Math.max(1, Math.round(nh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
