// SPDX-License-Identifier: MPL-2.0
/**
 * Images capability (host.images) - on-device image decode / resize / re-encode.
 *
 * Wraps machinery the upload path already ships - decodeImageBitmap (native
 * decoder + the lazy bundled-libheif HEIC fallback, orientation baked in, from
 * image-resize.ts/heic-decode.ts) and a browser canvas re-encode - behind the
 * DOM-free ImagesAPI contract: encoded bytes (or a Blob) in, encoded bytes +
 * dimensions out. HEIC/AVIF/TIFF decode where the platform (or bundled WASM)
 * can; output is always a web-safe format (webp/jpeg/png).
 *
 * Everything runs locally; nothing is uploaded. The module itself is loaded
 * lazily by the bridge index (first host.images call), and the heavy HEIC WASM
 * inside decodeImageBitmap is a further dynamic import - so boot cost is zero.
 *
 * Honesty rules (per the contract): the result's mime/width/height are read
 * back from what the encoder actually produced - canvas encoders fall back to
 * PNG where a requested type is unsupported - and resize never upscales.
 */
import type {
  ImagesAPI, ImageInfo, ImageResizeOpts, ImageEncodeOpts, ImageResult, ImageEncodeFormat,
} from '@lolly-tools/core/host-v1';
import { decodeImageBitmap, MAX_SOURCE_PIXELS } from './image-resize.ts';
import { sniffAnimatedRaster, carryImageMetadata } from '@lolly/engine';

const MIME_OF: Record<ImageEncodeFormat, string> = {
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

// ─── Byte sniffing ───────────────────────────────────────────────────────────
// The contract requires the reported MIME to come from the bytes, never a
// filename - same stance as engine/src/media-sniff.ts (whose helpers aren't
// exported, hence the tiny local copies).

function has(bytes: Uint8Array, offset: number, ...sig: number[]): boolean {
  if (offset + sig.length > bytes.length) return false;
  for (let i = 0; i < sig.length; i++) if (bytes[offset + i] !== sig[i]) return false;
  return true;
}

function fourcc(bytes: Uint8Array, offset: number, cc: string): boolean {
  if (offset + 4 > bytes.length) return false;
  for (let i = 0; i < 4; i++) if (bytes[offset + i] !== cc.charCodeAt(i)) return false;
  return true;
}

// ISOBMFF 'ftyp' brands: the HEIF-family stills (mirrors heic-decode.ts) vs AVIF.
const HEIC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevm', 'hevs']);
const HEIF_BRANDS = new Set(['mif1', 'msf1']);
const AVIF_BRANDS = new Set(['avif', 'avis']);

/** MIME type from magic bytes, or null when unrecognised. */
export function sniffImageMime(bytes: Uint8Array): string | null {
  if (has(bytes, 0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (has(bytes, 0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (fourcc(bytes, 0, 'RIFF') && fourcc(bytes, 8, 'WEBP')) return 'image/webp';
  if (fourcc(bytes, 0, 'GIF8')) return 'image/gif';
  if (has(bytes, 0, 0x49, 0x49, 0x2a, 0x00) || has(bytes, 0, 0x4d, 0x4d, 0x00, 0x2a)) return 'image/tiff';
  if (has(bytes, 0, 0x42, 0x4d)) return 'image/bmp';
  if (fourcc(bytes, 4, 'ftyp')) {
    const brand = String.fromCharCode(bytes[8] ?? 0, bytes[9] ?? 0, bytes[10] ?? 0, bytes[11] ?? 0);
    if (AVIF_BRANDS.has(brand)) return 'image/avif';
    if (HEIC_BRANDS.has(brand)) return 'image/heic';
    if (HEIF_BRANDS.has(brand)) return 'image/heif';
  }
  return null;
}

// ─── Input normalisation ─────────────────────────────────────────────────────

interface NormalisedInput {
  blob: Blob;
  bytes: Uint8Array;
  mime: string | null;
}

async function normalise(input: Uint8Array | Blob): Promise<NormalisedInput> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer());
  const mime = sniffImageMime(bytes);
  // Rebuild the Blob from the sniffed bytes even when a Blob came in, so a wrong
  // caller-supplied Blob.type can't steer the decoder; content decides.
  const blob = new Blob([bytes as BlobPart], mime ? { type: mime } : undefined);
  return { blob, bytes, mime };
}

/** Decode-bomb guard - same cap as the upload path (image-resize.ts). */
function guardPixels(width: number, height: number): void {
  if (width * height > MAX_SOURCE_PIXELS) {
    throw new Error(`Image is too large to process (${width}×${height} px).`);
  }
}

// ─── Sizing ──────────────────────────────────────────────────────────────────

/** A positive finite dimension constraint, or null when absent/nonsense. */
function dim(v: number | undefined): number | null {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? n : null;
}

/** Fit within maxEdge/width/height, aspect preserved, never upscaling. */
function fitWithin(w: number, h: number, opts: ImageResizeOpts): { width: number; height: number } {
  const ratios: number[] = [1];
  const edge = dim(opts.maxEdge);
  if (edge) ratios.push(edge / Math.max(w, h));
  const tw = dim(opts.width);
  if (tw) ratios.push(tw / w);
  const th = dim(opts.height);
  if (th) ratios.push(th / h);
  const scale = Math.min(...ratios);
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

// ─── Canvas encode (OffscreenCanvas where available, like bridge/pdf.ts) ─────

type Canvas2D = HTMLCanvasElement | OffscreenCanvas;

function makeCanvas(w: number, h: number): Canvas2D {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

async function canvasToBlob(canvas: Canvas2D, type: string, quality?: number): Promise<Blob | null> {
  if (typeof (canvas as OffscreenCanvas).convertToBlob === 'function') {
    return (canvas as OffscreenCanvas).convertToBlob({ type, quality });
  }
  return new Promise((resolve) => (canvas as HTMLCanvasElement).toBlob(resolve, type, quality));
}

function normaliseFormat(format: ImageEncodeFormat): ImageEncodeFormat {
  if (!MIME_OF[format]) {
    throw new Error(`Unsupported image format "${format}" - use webp, jpeg or png.`);
  }
  return format;
}

/** Quality 0..1 when given and sane, else undefined (the encoder's default). */
function clampQuality(q: number | undefined): number | undefined {
  const n = Number(q);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(1, Math.max(0, n));
}

async function drawAndEncode(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  format: ImageEncodeFormat,
  quality: number | undefined,
): Promise<ImageResult> {
  const canvas = makeCanvas(width, height);
  // Cast picks the HTMLCanvasElement getContext overload; erased at runtime, so
  // the OffscreenCanvas path is unaffected (same trick as bridge/pdf.ts).
  const cx = (canvas as HTMLCanvasElement).getContext('2d');
  if (!cx) throw new Error('Canvas 2D context unavailable.');
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = 'high';
  // JPEG has no alpha channel - composite on white so transparency doesn't go black.
  if (format === 'jpeg') {
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, width, height);
  }
  cx.drawImage(bitmap, 0, 0, width, height);
  const blob = await canvasToBlob(canvas, MIME_OF[format], clampQuality(quality));
  if (!blob) throw new Error('Image encoding failed.');
  // Read the ACTUAL type back - canvas encoders fall back to PNG where the
  // requested type is unsupported, and the contract reports what really happened.
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    mime: blob.type || MIME_OF[format],
    width,
    height,
  };
}

/** Output default when a resize doesn't pin one: keep a web-safe source format,
 *  otherwise WebP (the upload path's re-encode choice - image-resize.ts). */
function defaultFormatFor(mime: string | null): ImageEncodeFormat {
  if (mime === 'image/jpeg') return 'jpeg';
  if (mime === 'image/png') return 'png';
  return 'webp';
}

async function transform(
  input: Uint8Array | Blob,
  size: (w: number, h: number) => { width: number; height: number },
  format: (mime: string | null) => ImageEncodeFormat,
  quality: number | undefined,
  carry?: boolean | { gps?: boolean },
): Promise<ImageResult> {
  const { blob, bytes: srcBytes, mime } = await normalise(input);
  const bitmap = await decodeImageBitmap(blob);
  try {
    guardPixels(bitmap.width, bitmap.height);
    const { width, height } = size(bitmap.width, bitmap.height);
    const res = await drawAndEncode(bitmap, width, height, format(mime), quality);
    if (!carry) return res;
    // Metadata carry (v1.149): rebuild the source's descriptive metadata into
    // the fresh container; the report says what carried / what dropped.
    const gps = typeof carry === 'object' && carry.gps === true;
    const { bytes, carried } = carryImageMetadata(
      { bytes: srcBytes, mime: mime ?? undefined },
      { bytes: res.bytes, mime: res.mime },
      { gps },
    );
    return { ...res, bytes, carried };
  } finally {
    bitmap.close?.();
  }
}

export function createImagesAPI(): ImagesAPI {
  return {
    async decode(input: Uint8Array | Blob): Promise<ImageInfo> {
      const { blob, bytes, mime } = await normalise(input);
      // Full decode (orientation baked in) - the dimensions reported must match
      // what resize/encode will produce. Rejects with decodeImageBitmap's clear,
      // format-named error when this shell can't read the bytes.
      const bitmap = await decodeImageBitmap(blob);
      try {
        const info: ImageInfo = {
          width: bitmap.width,
          height: bitmap.height,
          mime: mime ?? (blob.type || 'application/octet-stream'),
        };
        // Animation is knowable only for the three animatable raster containers;
        // elsewhere the flag stays absent per the contract.
        if (mime === 'image/gif' || mime === 'image/png' || mime === 'image/webp') {
          info.animated = sniffAnimatedRaster(bytes, { mime }) != null;
        } else if (mime === 'image/avif') {
          info.animated = fourcc(bytes, 8, 'avis') || undefined;
        }
        return info;
      } finally {
        bitmap.close?.();
      }
    },

    resize(input: Uint8Array | Blob, opts: ImageResizeOpts): Promise<ImageResult> {
      const fmt = opts.format === undefined ? defaultFormatFor : () => normaliseFormat(opts.format!);
      return transform(input, (w, h) => fitWithin(w, h, opts), fmt, opts.quality, opts.carryMetadata);
    },

    encode(input: Uint8Array | Blob, opts: ImageEncodeOpts): Promise<ImageResult> {
      const format = normaliseFormat(opts.format);
      return transform(input, (w, h) => ({ width: w, height: h }), () => format, opts.quality, opts.carryMetadata);
    },
  };
}
