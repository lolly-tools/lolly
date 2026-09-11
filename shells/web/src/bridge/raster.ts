// SPDX-License-Identifier: MPL-2.0
/**
 * host.raster (v1.105) - web implementation.
 *
 * Raster primitives for tool hooks that do their own canvas pixel work: the
 * realm-correct capability probe, decode-to-bitmap, measure, and
 * encode-to-bytes. See the RasterAPI contract in `@lolly-tools/core/host-v1`
 * for the shape and the why. This is the DOM/OffscreenCanvas-backed shell impl;
 * the headless CLI leaves `host.raster` undefined and tools feature-detect it
 * (plans/86-worker-isolation-hooks.md section 6.1).
 *
 * Built on the same codec glue `host.images` uses - `decodeImageBitmap` (native
 * decode + the lazy bundled-libheif HEIC fallback, EXIF orientation baked in)
 * and the `OffscreenCanvas`/`convertToBlob` encode path - plus ONE tier
 * `host.images` does not have: an `<img>` fallback in `decode`. Decoding an SVG
 * blob straight through `createImageBitmap` is unreliable across browsers, so on
 * failure we load it through an `<img>` and re-wrap - the same reason redact and
 * the old shared `loadImage` used an `<img>`. The result is always an
 * `ImageBitmap`, so nothing DOM-only ever leaves this surface.
 *
 * Everything runs locally; nothing is uploaded. The module is imported lazily by
 * the bridge index on the first async `host.raster` call; `canRaster()` is
 * answered synchronously at the index without touching this module.
 */
import type {
  RasterAPI, RasterSource, RasterFrame, ImageInfo, ImageEncodeOpts, ImageResult,
  ImageEncodeFormat, AssetRef,
} from '@lolly-tools/core/host-v1';
import { decodeImageBitmap, MAX_SOURCE_PIXELS } from './image-resize.ts';
import { makeCanvas } from './pdf.ts';
import { sniffImageMime } from './images.ts';
import { sniffAnimatedRaster } from '@lolly/engine';

/** How much extra resolution a vector source is rasterised at (see decodeViaImg). */
const SVG_DECODE_SCALE = 12;

const MIME_OF: Record<ImageEncodeFormat, string> = {
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

function isAssetRef(v: RasterSource): v is AssetRef {
  return typeof v === 'object' && v !== null &&
    !(v instanceof Uint8Array) && !(v instanceof Blob) &&
    typeof (v as AssetRef).url === 'string';
}

/** SVG is text, so the byte-magic sniffer misses it - recognise the opening
 *  tag so decode's `<img>` fallback gets a Blob with the right MIME (an `<img>`
 *  renders by the Blob's declared type, never by content sniffing). */
function sniffSvg(bytes: Uint8Array): boolean {
  let i = 0;
  // skip UTF-8 BOM + leading whitespace
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) i = 3;
  while (i < bytes.length && i < 64 && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)) i++;
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(i, i + 256)).toLowerCase();
  return head.startsWith('<?xml') ? head.includes('<svg') : head.startsWith('<svg');
}

function sniffMime(bytes: Uint8Array): string | null {
  return sniffImageMime(bytes) ?? (sniffSvg(bytes) ? 'image/svg+xml' : null);
}

/** Normalise any RasterSource to bytes + a typed Blob. URLs/AssetRefs are
 *  fetched (blob:/data:/same-origin - no `network` capability needed for those);
 *  a Blob keeps its own declared type. */
async function normaliseSource(src: RasterSource): Promise<{ bytes: Uint8Array; blob: Blob; mime: string | null }> {
  if (src instanceof Blob) {
    const bytes = new Uint8Array(await src.arrayBuffer());
    return { bytes, blob: src, mime: src.type || sniffMime(bytes) };
  }
  let bytes: Uint8Array;
  if (src instanceof Uint8Array) {
    bytes = src;
  } else {
    const url = typeof src === 'string' ? src : (isAssetRef(src) ? src.url : null);
    if (!url) throw new Error('host.raster: source has no URL or bytes.');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`host.raster: could not fetch source (${res.status}).`);
    bytes = new Uint8Array(await res.arrayBuffer());
  }
  const mime = sniffMime(bytes);
  return { bytes, blob: new Blob([bytes as BlobPart], mime ? { type: mime } : undefined), mime };
}

/** The `<img>` fallback tier decode adds over host.images - for SVG and any
 *  vector the native `createImageBitmap` rejects. Load through an `<img>` (which
 *  the browser orients and rasterises reliably), then re-wrap to an ImageBitmap
 *  so the contract's return type holds in every case. */
async function decodeViaImg(blob: Blob): Promise<ImageBitmap> {
  if (typeof Image === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
    throw new Error('host.raster: no image decoder available in this realm.');
  }
  // A SIZELESS SVG (uploads strip the root width/height so the art scales by its viewBox)
  // rasterises at the browser's 150×150 default, throwing away the artwork's resolution
  // AND aspect ratio - which then propagates as a tiny/mis-sized decode (e.g. a filter
  // source that renders in a corner, and a 150×150 export box). Give it an intrinsic size
  // from its viewBox so the <img> decodes it crisply at full size. Best-effort: an
  // unreadable or already-sized SVG falls through to the browser default.
  if (/svg/i.test(blob.type)) {
    try {
      const text = await blob.text();
      if (!/<svg[^>]*\b(?:width|height)\s*=/i.test(text)) {
        const m = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text);
        const w = parseFloat(m?.[1] ?? '0'), h = parseFloat(m?.[2] ?? '0');
        if (w > 0 && h > 0) blob = new Blob([text.replace(/<svg\b/i, `<svg width="${w}" height="${h}"`)], { type: 'image/svg+xml' });
      }
    } catch { /* unreadable - keep the original blob and its default rasterisation */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('host.raster: that source could not be decoded as an image.'));
      im.src = url;
    });
    // An SVG has no native resolution, so its intrinsic size is an arbitrary floor - the
    // demo lolly's 286px viewBox rasterised at 286px made every pixel tool (darkroom,
    // filter) visibly soft. Re-render the vector at SVG_DECODE_SCALE (capped by the pixel guard) so
    // downstream drawImage always downsamples. createImageBitmap's resize re-rasterises
    // from the vector source, not from a 1x bitmap.
    if (/svg/i.test(blob.type)) {
      const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      const scale = Math.min(SVG_DECODE_SCALE, Math.sqrt(MAX_SOURCE_PIXELS / Math.max(1, w * h)));
      if (scale > 1) {
        try {
          return await createImageBitmap(img, {
            resizeWidth: Math.round(w * scale),
            resizeHeight: Math.round(h * scale),
            resizeQuality: 'high',
          });
        } catch { /* resize options unsupported - fall through to the 1x decode */ }
      }
    }
    return await createImageBitmap(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The shared decode ladder for measure() and decode(). SVG goes STRAIGHT to the `<img>`
 *  tier - never through `createImageBitmap(blob)` - both because that's the reliable SVG
 *  path and because the `<img>` tier is where the vector upsample lives; a sized SVG
 *  that happened to decode natively would come back at its arbitrary intrinsic size, and
 *  measure/decode must agree on the dimensions they report. */
async function decodeAny(blob: Blob, mime: string | null): Promise<ImageBitmap> {
  if (mime === 'image/svg+xml') return decodeViaImg(blob);
  try { return await decodeImageBitmap(blob as Blob & { name?: string }); }
  catch { return decodeViaImg(blob); }
}

function guardPixels(width: number, height: number): void {
  if (width * height > MAX_SOURCE_PIXELS) {
    throw new Error(`host.raster: image is too large to process (${width}×${height} px).`);
  }
}

function clampQuality(q: number | undefined): number | undefined {
  const n = Number(q);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(1, Math.max(0, n));
}

async function canvasToBlob(canvas: HTMLCanvasElement | OffscreenCanvas, type: string, quality?: number): Promise<Blob | null> {
  if (typeof (canvas as OffscreenCanvas).convertToBlob === 'function') {
    return (canvas as OffscreenCanvas).convertToBlob({ type, quality });
  }
  return new Promise((resolve) => (canvas as HTMLCanvasElement).toBlob(resolve, type, quality));
}

export function createRasterAPI(): RasterAPI {
  const api: RasterAPI = {
    // Not read through this module in practice (the index answers canRaster
    // synchronously so a hook needn't await the import), but present so the
    // object is a complete RasterAPI and a direct importer gets the real probe.
    canRaster(): boolean {
      return typeof createImageBitmap === 'function' &&
        (typeof OffscreenCanvas === 'function' ||
          (typeof document !== 'undefined' && !!document.createElement));
    },

    async measure(src: RasterSource): Promise<ImageInfo> {
      const { bytes, blob, mime } = await normaliseSource(src);
      const bitmap = await decodeAny(blob, mime);
      try {
        const info: ImageInfo = {
          width: bitmap.width,
          height: bitmap.height,
          mime: mime ?? (blob.type || 'application/octet-stream'),
        };
        if (mime === 'image/gif' || mime === 'image/png' || mime === 'image/webp') {
          info.animated = sniffAnimatedRaster(bytes, { mime }) != null;
        }
        return info;
      } finally {
        bitmap.close?.();
      }
    },

    async decode(src: RasterSource): Promise<ImageBitmap> {
      const { blob, mime } = await normaliseSource(src);
      const bitmap = await decodeAny(blob, mime);
      try { guardPixels(bitmap.width, bitmap.height); }
      catch (e) { bitmap.close?.(); throw e; }
      return bitmap;
    },

    async encode(source: ImageBitmap | RasterFrame, opts: ImageEncodeOpts): Promise<ImageResult> {
      const type = MIME_OF[opts.format];
      if (!type) throw new Error(`host.raster: unsupported format "${opts.format}" - use webp, jpeg or png.`);
      const width = source.width;
      const height = source.height;
      const canvas = makeCanvas(width, height);
      const cx = (canvas as HTMLCanvasElement).getContext('2d');
      if (!cx) throw new Error('host.raster: canvas 2D context unavailable.');
      if (opts.format === 'jpeg') { cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, width, height); }
      if ('data' in source) {
        // Fresh Uint8ClampedArray so the ImageData ctor gets an ArrayBuffer-backed
        // view (TS 5.7 generic-buffer typing; same wrap as lib/matter.ts).
        cx.putImageData(new ImageData(new Uint8ClampedArray(source.data), width, height), 0, 0);
      } else {
        cx.imageSmoothingEnabled = true;
        cx.imageSmoothingQuality = 'high';
        cx.drawImage(source, 0, 0, width, height);
      }
      const blob = await canvasToBlob(canvas, type, clampQuality(opts.quality));
      if (!blob) throw new Error('host.raster: image encoding failed.');
      // Report the ACTUAL type back - a canvas encoder falls back to PNG where
      // the requested type is unsupported.
      return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: blob.type || type, width, height };
    },
  };
  return api;
}
