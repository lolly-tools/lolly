// SPDX-License-Identifier: MPL-2.0
/**
 * The one preview writer (plan 373, section 5.5): every picture the web shell
 * keeps of a tool render is made here, by one rule.
 *
 *  1. SVG first. A tool that exports SVG gets the tool's own SVG export (the
 *     walker, or drawing operations for an admitted Design frame), kept as SVG
 *     text when it is at or below 256 KiB. Route `export-svg`.
 *  2. Otherwise a raster, fitted inside 720 x 560 (never enlarged here), encoded
 *     as WebP at quality 0.9. Route `export-raster`.
 *  3. Quality wins over size. The WebP is decoded again and compared with the
 *     pixels it was made from; when the alpha-weighted difference at the 99.9th
 *     percentile passes 16 levels (thin saturated lines on a dark ground are the
 *     case lossy WebP's colour sampling cannot keep), lossless WebP is stored
 *     instead. A WebP over 256 KiB steps down to 0.85, 0.8 and 0.75 while it stays
 *     under the same difference bound; when nothing within the limit passes, the
 *     faithful picture is kept over the limit rather than a worse one under it.
 *  4. Where the browser cannot encode WebP (Safari and the WebKit apps return PNG
 *     when asked), the picture is PNG, and an opaque PNG over the limit is tried as
 *     JPEG at 0.92 under the same bound.
 *
 * Measured on 221 public pictures (plans/373-evidence-preview-store): quality 0.9
 * with the check sent 11 of 109 rasters to lossless and none over the limit;
 * median 20.8 KB against 145 KB for today's PNG. The numbers belong to that
 * corpus; the bound and the fallbacks are what keep the rule honest elsewhere.
 */
import {
  PREVIEW_MAX_BYTES, PREVIEW_TILE, previewRefFor,
  type PreviewRoute, type PreviewType,
} from '../../../../engine/src/session-preview.ts';
import type { PreparedPicture } from '../bridge/preview-store.ts';

/** The lossy WebP quality: identical to the eye on every sampled photo, gradient,
 *  UI capture and transparency edge at the sizes the interface shows, 1x and 2x. */
export const WEBP_QUALITY = 0.9;
/** Steps tried when the picture at WEBP_QUALITY is over the limit. */
const STEP_DOWN = [0.85, 0.8, 0.75];
/** Above this alpha-weighted difference (levels of 255, 99.9th percentile) a lossy
 *  picture is not identical to the eye, and the lossless form is used. */
export const DIFFERENCE_BOUND = 16;
const JPEG_QUALITY = 0.92;

export interface WriterFacts {
  route?: PreviewRoute;
  recipe?: string;
  /** The source is vector (an SVG too large to keep as SVG): draw it at the full
   *  tile size even when its own size is smaller, so the raster stays sharp. */
  vector?: boolean;
}

/** Bytes of a Blob as a Uint8Array. */
async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** An SVG export as a picture when it fits one entry, else null (the caller then
 *  draws the raster fallback). */
export async function svgPicture(svg: Blob | string, facts: WriterFacts = {}): Promise<PreparedPicture | null> {
  const bytes = typeof svg === 'string' ? new TextEncoder().encode(svg) : await bytesOf(svg);
  if (!bytes.length || bytes.byteLength > PREVIEW_MAX_BYTES) return null;
  const ref = await previewRefFor(bytes, 'image/svg+xml', { route: facts.route ?? 'export-svg', ...(facts.recipe ? { recipe: facts.recipe } : {}) });
  return ref ? { ref, bytes } : null;
}

type Pixels = { data: Uint8ClampedArray; width: number; height: number };

function canvasOf(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  return canvas;
}

function context2d(canvas: HTMLCanvasElement | OffscreenCanvas): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error('No 2D canvas for the preview.');
  return ctx;
}

async function encode(canvas: HTMLCanvasElement | OffscreenCanvas, type: string, quality?: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, ...(quality !== undefined ? { quality } : {}) });
  return new Promise<Blob>((resolve, reject) => (canvas as HTMLCanvasElement).toBlob(b => (b ? resolve(b) : reject(new Error('The preview could not be encoded.'))), type, quality));
}

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob); } catch { /* an SVG in some engines: fall through */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('The preview could not be decoded.'));
      img.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}

const sizeOf = (image: ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas): { width: number; height: number } =>
  'naturalWidth' in image ? { width: image.naturalWidth || image.width, height: image.naturalHeight || image.height } : { width: image.width, height: image.height };

async function pixelsOf(blob: Blob, width: number, height: number): Promise<Pixels> {
  const image = await decode(blob);
  const canvas = canvasOf(width, height);
  const ctx = context2d(canvas);
  ctx.drawImage(image as CanvasImageSource, 0, 0, width, height);
  if ('close' in image && typeof image.close === 'function') image.close();
  return { data: ctx.getImageData(0, 0, width, height).data, width, height };
}

/**
 * The difference between two renderings of one picture, in levels of 255: per
 * pixel the largest channel difference with colour weighted by alpha (so an edge
 * that is nearly transparent counts for little), and of those the 99.9th
 * percentile. Pure: exported for tests.
 */
export function pictureDifference(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  const histogram = new Uint32Array(256);
  const n = Math.min(a.length, b.length) >> 2;
  for (let i = 0; i < n; i++) {
    const o = i << 2;
    const aa = a[o + 3]!, ba = b[o + 3]!;
    let worst = Math.abs(aa - ba);
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(a[o + c]! * aa - b[o + c]! * ba) / 255;
      if (d > worst) worst = d;
    }
    histogram[Math.min(255, Math.round(worst))]!++;
  }
  const target = Math.ceil(n * 0.999);
  let seen = 0;
  for (let level = 0; level < 256; level++) { seen += histogram[level]!; if (seen >= target) return level; }
  return 255;
}

function opaque(data: Uint8ClampedArray): boolean {
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) return false;
  return true;
}

/** A fitted size: inside the tile box, never enlarged unless `enlarge` (a vector
 *  source, which loses nothing by being drawn larger). */
export function fitTile(width: number, height: number, box = PREVIEW_TILE, enlarge = false): { width: number; height: number } {
  const scale = Math.min(box.width / width, box.height / height, enlarge ? Infinity : 1);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * A raster picture from a render: a Blob (PNG from the export path, or an SVG to
 * rasterise), a canvas, or a decoded image. Fitted inside 720 x 560 and encoded by
 * the rule in the header.
 */
export async function rasterPicture(source: Blob | HTMLCanvasElement | OffscreenCanvas | ImageBitmap | HTMLImageElement, facts: WriterFacts = {}): Promise<PreparedPicture | null> {
  const image = source instanceof Blob ? await decode(source) : source;
  const natural = sizeOf(image);
  if (!natural.width || !natural.height) return null;
  const { width, height } = fitTile(natural.width, natural.height, PREVIEW_TILE, facts.vector === true);
  const canvas = canvasOf(width, height);
  const ctx = context2d(canvas);
  ctx.drawImage(image as CanvasImageSource, 0, 0, width, height);
  if (source instanceof Blob && 'close' in image && typeof image.close === 'function') image.close();
  const original = ctx.getImageData(0, 0, width, height).data;
  const route: PreviewRoute = facts.route ?? 'export-raster';
  const finish = async (blob: Blob): Promise<PreparedPicture | null> => {
    const bytes = await bytesOf(blob);
    const ref = await previewRefFor(bytes, blob.type as PreviewType, { route, ...(facts.recipe ? { recipe: facts.recipe } : {}) });
    return ref ? { ref, bytes } : null;
  };
  const faithful = async (blob: Blob): Promise<boolean> =>
    pictureDifference(original, (await pixelsOf(blob, width, height)).data) <= DIFFERENCE_BOUND;

  const lossy = await encode(canvas, 'image/webp', WEBP_QUALITY);
  if (lossy.type !== 'image/webp') {
    // No WebP encoder (WebKit): PNG is exact. An opaque PNG over the limit may be a
    // JPEG that passes the same bound; anything else stays PNG over the limit.
    const png = lossy.type === 'image/png' ? lossy : await encode(canvas, 'image/png');
    if (png.size <= PREVIEW_MAX_BYTES || !opaque(original)) return finish(png);
    const jpeg = await encode(canvas, 'image/jpeg', JPEG_QUALITY);
    if (jpeg.type === 'image/jpeg' && jpeg.size <= PREVIEW_MAX_BYTES && await faithful(jpeg)) return finish(jpeg);
    return finish(png);
  }
  if (!await faithful(lossy)) {
    const lossless = await encode(canvas, 'image/webp', 1);
    // Quality 1.0 is lossless WebP in Chromium; where it is not, the check below
    // still decides, and the PNG is the exact form to fall back to.
    if (lossless.type === 'image/webp' && await faithful(lossless)) return finish(lossless);
    return finish(await encode(canvas, 'image/png'));
  }
  if (lossy.size <= PREVIEW_MAX_BYTES) return finish(lossy);
  for (const quality of STEP_DOWN) {
    const smaller = await encode(canvas, 'image/webp', quality);
    if (smaller.size <= PREVIEW_MAX_BYTES && await faithful(smaller)) return finish(smaller);
  }
  // Nothing under the limit is identical to the eye: keep the faithful one.
  return finish(lossy);
}
