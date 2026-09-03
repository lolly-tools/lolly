// SPDX-License-Identifier: MPL-2.0
/**
 * Image redaction for the Node shells - the raster repaint the `redact` utility
 * does in the browser, without one.
 *
 * The recipe is the tool's own (community/redact/hooks.js `drawRedacted` +
 * `exportFile`'s raster branch), step for step: decode with EXIF orientation
 * applied, composite onto opaque WHITE (which kills alpha-hidden content),
 * optionally drain the colour, then paint every bar at 100% opacity, and
 * re-encode in the SAME family so the metadata goes with the old container.
 *
 * WHAT THE OUTPUT DOES NOT CARRY: EXIF, XMP, IPTC, ICC, a C2PA manifest,
 * an APP comment, extra frames, anything after the terminator. Not by stripping
 * them - by never writing them: the pixels leave the canvas and sharp encodes a
 * fresh container from them. That is the same guarantee the browser's
 * `canvas.toBlob` gives, arrived at the same way.
 *
 * `paintBars` is exported because pdf-redact.ts burns the identical mark onto a
 * rasterised page: one painter, so an image bar and a PDF bar can never drift in
 * shape, colour or stamp placement.
 */
import {
  REDACT_INK_FALLBACK, inflateForRadius, normaliseInk, stampLayout,
} from './pdf-redact-core.ts';
import type { PixelRect, RoundedPixelRect } from './pdf-redact-core.ts';
import { decodeToCanvas, nodeCanvas, sniffImageMime } from './canvas.ts';
import type { NodeCanvas, NodeCanvasCtx } from './canvas.ts';

/** How a mark looks, resolved once per export. Pixel units throughout. */
export interface BarMark {
  /** Fill as a 6-digit hex. Anything unreadable or translucent falls back to the
   *  neutral ink - a canvas silently ignores a bad fillStyle, and the previous
   *  fill here is the white page, i.e. bars that redact nothing. */
  color?: string;
  /** Corner radius in DEVICE PIXELS. The painted box is inflated by it first, so
   *  the requested rect stays entirely covered (see inflateForRadius). */
  radius?: number;
  /** A short attribution stamp painted ON TOP of the finished bar. */
  label?: string;
  /** Stamp colour as a 6-digit hex. Default white. */
  labelColor?: string;
  /** Cap on the stamp's type size in device pixels. Default 14. */
  labelMaxSize?: number;
}

/**
 * Fill a rounded rectangle with per-corner radii. Traced by hand rather than via
 * `roundRect`, for the reason both shipped copies give: a corner that had to
 * clamp to the canvas edge must stay SQUARE, and roundRect takes a uniform
 * radius list that cannot express that.
 */
export function fillRounded(cx: NodeCanvasCtx, s: RoundedPixelRect, color: string): void {
  cx.fillStyle = color;
  const [tl, tr, br, bl] = s.radii;
  if (!tl && !tr && !br && !bl) { cx.fillRect(s.x, s.y, s.w, s.h); return; }
  const x1 = s.x + s.w, y1 = s.y + s.h;
  cx.beginPath();
  cx.moveTo(s.x + tl, s.y);
  cx.lineTo(x1 - tr, s.y);
  if (tr) cx.arcTo(x1, s.y, x1, s.y + tr, tr);
  cx.lineTo(x1, y1 - br);
  if (br) cx.arcTo(x1, y1, x1 - br, y1, br);
  cx.lineTo(s.x + bl, y1);
  if (bl) cx.arcTo(s.x, y1, s.x, y1 - bl, bl);
  cx.lineTo(s.x, s.y + tl);
  if (tl) cx.arcTo(s.x, s.y, s.x + tl, s.y, tl);
  cx.closePath();
  cx.fill();
}

/**
 * Burn every bar onto the context at FULL opacity, then stamp the label.
 *
 * The one painter both halves use. `rects` are final device-pixel rectangles -
 * the caller owns whatever mapping got them there (points→pixels for a PDF page,
 * the preview's own frame for an image), so this function has no coordinate
 * system to get wrong.
 */
export function paintBars(cx: NodeCanvasCtx, rects: PixelRect[], mark: BarMark, cw: number, ch: number): void {
  const ink = normaliseInk(mark.color) ?? REDACT_INK_FALLBACK;
  const labelInk = normaliseInk(mark.labelColor) ?? '#ffffff';
  const radius = Math.max(0, Math.round(Number(mark.radius) || 0));
  const label = String(mark.label || '').trim();
  const maxLabel = Math.max(1, Math.round(Number(mark.labelMaxSize) || 14));
  cx.globalAlpha = 1;
  for (const r of rects) {
    const shape = inflateForRadius(r, radius, cw, ch);
    fillRounded(cx, shape, ink);
    // Painted ON TOP of a shape that is already fully opaque, so the stamp can
    // never reveal anything: the pixels beneath it are already gone.
    const lay = label ? stampLayout(shape, label, maxLabel) : null;
    if (lay) {
      cx.fillStyle = labelInk;
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.font = `600 ${lay.size}px SUSE, system-ui, sans-serif`;
      cx.fillText(label, lay.cx, lay.cy);
    }
  }
}

/**
 * Drain colour from tightly-packed RGBA pixels, in place.
 *
 * Rec. 601 weights, and DELIBERATELY not the Rec. 709 ones `grayscaleInPlace`
 * uses for a PDF page. Each matches what it is a port of: the PDF half mirrors
 * the CSS `grayscale()` filter, the image half mirrors community/redact's own
 * `drawRedacted`. Aligning them would silently change one shipped output, so
 * they stay as they are with the difference written down.
 */
export function grayscale601InPlace(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const y = Math.round(0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!);
    data[i] = data[i + 1] = data[i + 2] = y;
    data[i + 3] = 255;
  }
}

/** Encodings this path can WRITE. A source in anything else (HEIC, AVIF, TIFF,
 *  SVG) decodes fine and lands as PNG - the same read-broad/write-web-safe split
 *  host.images draws. */
export type RedactImageFormat = 'png' | 'jpeg' | 'webp';

export interface RedactImageOpts extends BarMark {
  /** Bars in DEVICE PIXELS of the decoded (EXIF-oriented) image. */
  bars: PixelRect[];
  /** Drop all colour - for a scan, the yellow channel printer tracking dots live in. */
  grayscale?: boolean;
  /** Output encoding. Default: the source's own family, else PNG. */
  format?: RedactImageFormat;
  /** Quality 0..1 for the lossy formats. Default 0.92 for JPEG, lossless for WebP. */
  quality?: number;
}

export interface RedactImageResult {
  /** The rebuilt image - pixels only, no metadata of any kind. */
  bytes: Uint8Array;
  /** MIME type of `bytes`. */
  mime: string;
  /** Output pixel width (the ORIENTED width, which is what the bars were measured in). */
  width: number;
  /** Output pixel height. */
  height: number;
  /** Bars that fell entirely outside the image and could not be painted. A caller
   *  must treat a non-zero count as a failure, not a warning: the region it names
   *  ships fully visible. */
  unplaced: number;
}

/** Which family a set of bytes should come back out as. */
function outputFormat(mime: string, want?: RedactImageFormat): RedactImageFormat {
  if (want) return want;
  if (mime === 'image/jpeg') return 'jpeg';
  if (mime === 'image/webp') return 'webp';
  return 'png';
}

type SharpPipe = {
  png(opts?: object): SharpPipe;
  jpeg(opts?: object): SharpPipe;
  webp(opts?: object): SharpPipe;
  toBuffer(): Promise<Buffer>;
};
type SharpFn = (input: Buffer, opts?: { raw: { width: number; height: number; channels: 4 } }) => SharpPipe;
let sharpModule: Promise<SharpFn | null> | null = null;
function loadSharp(): Promise<SharpFn | null> {
  sharpModule ??= import('sharp')
    .then((m) => ((m as { default?: unknown }).default ?? m) as unknown as SharpFn)
    .catch(() => null);
  return sharpModule;
}

/**
 * Rebuild an image with its bars burned in. See the module header for the
 * guarantee. Throws when there is no canvas here (the caller then refuses, or
 * escalates to a shell that has one) or when the bytes do not decode.
 */
export async function redactImage(bytes: Uint8Array, opts: RedactImageOpts): Promise<RedactImageResult> {
  const mod = await nodeCanvas();
  if (!mod) throw new Error('Redacting an image needs a canvas, which this install does not provide.');
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const mime = sniffImageMime(input);
  const src = await decodeToCanvas(input, mime);
  if (!src) throw new Error('That file could not be decoded as an image.');
  const W = src.width, H = src.height;

  const canvas: NodeCanvas = mod.createCanvas(W, H);
  const cx = canvas.getContext('2d');
  // Opaque white first: an alpha-hidden layer cannot survive a composite onto it.
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, W, H);
  cx.drawImage(src, 0, 0);

  // Colour drain runs BEFORE the marks: the scanned-page mode is about the
  // SOURCE's colour, and the mark is ours to keep.
  if (opts.grayscale) {
    const img = cx.getImageData(0, 0, W, H);
    grayscale601InPlace(img.data);
    cx.putImageData(img, 0, 0);
  }

  // A bar entirely off the image is REPORTED, never dropped quietly - the region
  // it names would otherwise ship fully visible.
  const placed: PixelRect[] = [];
  let unplaced = 0;
  for (const b of opts.bars ?? []) {
    const x0 = Math.max(0, Math.floor(Number(b.x)));
    const y0 = Math.max(0, Math.floor(Number(b.y)));
    const x1 = Math.min(W, Math.ceil(Number(b.x) + Number(b.w)));
    const y1 = Math.min(H, Math.ceil(Number(b.y) + Number(b.h)));
    if (!Number.isFinite(x1) || !Number.isFinite(y1) || x1 <= x0 || y1 <= y0) { unplaced++; continue; }
    placed.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }
  paintBars(cx, placed, opts, W, H);

  const fmt = outputFormat(mime, opts.format);
  const q = typeof opts.quality === 'number' && Number.isFinite(opts.quality)
    ? Math.max(1, Math.min(100, Math.round(opts.quality <= 1 ? opts.quality * 100 : opts.quality)))
    : undefined;

  // sharp writes the container when it is installed, because it writes NOTHING
  // but pixels unless asked - no metadata block, no ICC. Skia's own encoder is
  // the fallback and behaves the same way; the raw RGBA never carried any.
  const px = cx.getImageData(0, 0, W, H);
  const sharp = await loadSharp();
  if (sharp) {
    const raw = Buffer.from(px.data.buffer, px.data.byteOffset, px.data.byteLength);
    let pipe = sharp(raw, { raw: { width: W, height: H, channels: 4 } });
    if (fmt === 'jpeg') pipe = pipe.jpeg({ quality: q ?? 92 });
    else if (fmt === 'webp') pipe = pipe.webp(q !== undefined ? { quality: q } : { lossless: true });
    else pipe = pipe.png();
    const buf = await pipe.toBuffer();
    return {
      bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
      mime: `image/${fmt}`, width: W, height: H, unplaced,
    };
  }
  // Skia's binding refuses an explicit `undefined` quality, so PNG passes none.
  const buf = fmt === 'png' ? canvas.toBuffer('image/png') : canvas.toBuffer(`image/${fmt}`, q ?? 92);
  return {
    bytes: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
    mime: `image/${fmt}`, width: W, height: H, unplaced,
  };
}
