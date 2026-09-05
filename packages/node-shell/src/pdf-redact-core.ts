// SPDX-License-Identifier: MPL-2.0
/**
 * The DOM-free core of redaction (host.pdf.redact) - everything that can be
 * asserted without a canvas. A shell's canvas half (render page SVG, burn bars,
 * encode JPEG) calls in here for the maths and for the rebuild:
 *
 * - point→pixel bar mapping (integer-snapped, inflated, clamped to the canvas),
 * - the DPI clamp,
 * - the grayscale pass over raw RGBA pixels,
 * - buildImagePdf: a BRAND-NEW pdf-lib document whose pages contain only the
 *   supplied page images at the original sizes in points. Nothing is copied
 *   from the source document - no Info values, no XMP, no annotations,
 *   attachments, layers or scripts - so removed content cannot survive by
 *   construction.
 *
 * It lives in the shared node-shell package, not in shells/web, because BOTH
 * canvas halves need it byte-for-byte: shells/web/src/bridge/pdf-redact.ts over
 * a browser canvas, and packages/node-shell/src/pdf-redact.ts over resvg +
 * @napi-rs/canvas. Same rule as pptx.ts - the terminal shells must not reach
 * across a submodule boundary to typecheck. shells/web/src/bridge/pdf-redact-core.ts
 * stays as a re-export so every web import site is unchanged.
 */

/** Raster resolution bounds for the rebuilt pages. */
export const REDACT_DPI_DEFAULT = 200;
export const REDACT_DPI_MIN = 72;
export const REDACT_DPI_MAX = 300;

/** Bars are inflated by this many device pixels on every side before burning,
 *  so chroma subsampling in the JPEG encode cannot bleed covered ink past the
 *  bar's edge. */
export const BAR_INFLATE_PX = 2;

/** Clamp a requested DPI into the supported window; non-numbers get the default. */
export function clampDpi(dpi: unknown): number {
  const n = Number(dpi);
  if (!isFinite(n)) return REDACT_DPI_DEFAULT;
  return Math.min(REDACT_DPI_MAX, Math.max(REDACT_DPI_MIN, n));
}

/** Page cap for host.pdf.pages previews when the caller names none. */
export const PAGES_MAX_DEFAULT = 40;

/** Clamp a requested page cap: a whole number of at least 1; anything else gets the default. */
export function clampMaxPages(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 1 ? n : PAGES_MAX_DEFAULT;
}

/**
 * Drive the per-page loop of host.pdf.pages: run `renderOne` for the first
 * `maxPages` of `count` pages, SKIPPING any page whose render throws - one
 * broken page must not kill the whole preview. A skipped page is never silent:
 * its 1-based number goes into `failed` so the caller can say which pages have
 * no preview. `truncated` reports that the document has more pages than the
 * cap allowed.
 */
export async function collectPages<T>(
  count: number,
  maxPages: number,
  renderOne: (index: number) => Promise<T>,
  pageNumbers?: number[],
): Promise<{ pages: T[]; truncated: boolean; failed: number[] }> {
  const indices = pageNumbers
    ? [...new Set(pageNumbers)].filter(n => Number.isInteger(n) && n >= 1 && n <= count).slice(0, maxPages).map(n => n - 1)
    : Array.from({ length: Math.min(count, maxPages) }, (_, i) => i);
  const pages: T[] = [];
  const failed: number[] = [];
  for (const i of indices) {
    try { pages.push(await renderOne(i)); } catch { failed.push(i + 1); }
  }
  return { pages, truncated: count > indices.length, failed };
}

/** A pixel-space rectangle, integer coordinates, ready for fillRect. */
export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Map one bar from PDF point space (y from the TOP of the page) onto a page
 * raster of `cw`×`ch` device pixels rendered at `dpi`. The result is snapped
 * OUTWARD to whole pixels, inflated by BAR_INFLATE_PX on every side, and
 * clamped to the canvas. Returns null for a bar that is degenerate, not finite,
 * or entirely off the page - the caller skips it.
 */
export function barToPixels(
  bar: { x: number; y: number; w: number; h: number },
  dpi: number,
  cw: number,
  ch: number,
): PixelRect | null {
  const s = dpi / 72;
  if (![bar.x, bar.y, bar.w, bar.h].every((v) => isFinite(v))) return null;
  if (bar.w <= 0 || bar.h <= 0) return null;
  const x0 = Math.max(0, Math.floor(bar.x * s) - BAR_INFLATE_PX);
  const y0 = Math.max(0, Math.floor(bar.y * s) - BAR_INFLATE_PX);
  const x1 = Math.min(cw, Math.ceil((bar.x + bar.w) * s) + BAR_INFLATE_PX);
  const y1 = Math.min(ch, Math.ceil((bar.y + bar.h) * s) + BAR_INFLATE_PX);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * The bar fill used when the caller names none, or names one that cannot be
 * painted honestly. Not pure #000 on purpose: a redaction mark is a deliberate,
 * attributable edit, and a slightly-warm near-black reads as ink rather than as
 * a hole punched in the page. Any fully opaque fill destroys the pixels beneath
 * it equally, so this choice is aesthetic, never a security property.
 */
export const REDACT_INK_FALLBACK = '#14161a';

/**
 * Read a caller-supplied fill as a canonical `#rrggbb`, or null.
 *
 * TRANSLUCENCY IS REFUSED. Colour is security-neutral; alpha is not - a bar at
 * 90% opacity leaves the covered ink faintly recoverable, and a canvas
 * `fillStyle` assignment silently IGNORES an unreadable string, leaving whatever
 * colour was set before it (in the page rebuild that is the opaque white
 * background, i.e. bars that redact nothing at all). So anything that is not a
 * fully opaque hex comes back null and the caller falls back to the neutral ink.
 */
export function normaliseInk(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  const short = /^#([0-9a-f]{3})([0-9a-f])?$/.exec(s);
  if (short) {
    if (short[2] && short[2] !== 'f') return null;      // #rgba below full opacity
    return `#${short[1]!.split('').map((c) => c + c).join('')}`;
  }
  const long = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s);
  if (long) {
    if (long[2] && long[2] !== 'ff') return null;       // #rrggbbaa below full opacity
    return `#${long[1]}`;
  }
  return null;
}

/** A pixel rect plus its four corner radii, clockwise from the top-left. */
export interface RoundedPixelRect extends PixelRect {
  radii: [number, number, number, number];
}

/**
 * The shape a rounded bar actually paints.
 *
 * A rounded rectangle does NOT cover the corners of the box it is inscribed in,
 * so rounding a redaction bar in place would uncover four slivers of whatever
 * the user marked. The fix is geometric rather than cosmetic: the painted box is
 * INFLATED by the radius on every side, and the corner arcs then have their
 * centres exactly on the requested rectangle's own corners. Every point of the
 * requested rect is at most `radius` from such a centre and lies inside the
 * enclosing box, so the requested rect is contained in the rounded shape by
 * construction - no sampling, no epsilon.
 *
 * The inflated box is clamped to the canvas afterwards, and a corner whose
 * sides had to clamp is painted SQUARE: with the arc centre pulled inward by the
 * clamp it would otherwise cut back into the requested rect, which is the exact
 * failure the inflation exists to prevent.
 */
export function inflateForRadius(r: PixelRect, radius: number, cw: number, ch: number): RoundedPixelRect {
  const rad = Math.max(0, Math.floor(Number(radius) || 0));
  if (!rad) return { ...r, radii: [0, 0, 0, 0] };
  const wantX0 = r.x - rad, wantY0 = r.y - rad;
  const wantX1 = r.x + r.w + rad, wantY1 = r.y + r.h + rad;
  const x0 = Math.max(0, wantX0), y0 = Math.max(0, wantY0);
  const x1 = Math.min(cw, wantX1), y1 = Math.min(ch, wantY1);
  const clampedL = x0 > wantX0, clampedT = y0 > wantY0;
  const clampedR = x1 < wantX1, clampedB = y1 < wantY1;
  // Opposite corners must not overlap on a hairline bar; a SMALLER radius only
  // ever paints more, so capping can never break containment.
  const cap = Math.max(0, Math.min(rad, Math.floor(Math.min(x1 - x0, y1 - y0) / 2)));
  return {
    x: x0,
    y: y0,
    w: x1 - x0,
    h: y1 - y0,
    radii: [
      clampedL || clampedT ? 0 : cap,
      clampedR || clampedT ? 0 : cap,
      clampedR || clampedB ? 0 : cap,
      clampedL || clampedB ? 0 : cap,
    ],
  };
}

/**
 * The place of an attribution stamp on a finished bar: centred, at a size the bar
 * can actually hold. Returns null when the bar is too small for the label to be
 * legible - a stamp is decoration on an already-opaque mark, so it is dropped
 * rather than squeezed. Width is estimated at 0.62em per character, which is
 * wide enough for the condensed sans a canvas falls back to.
 */
export function stampLayout(r: PixelRect, text: string, maxSize: number): { size: number; cx: number; cy: number } | null {
  const t = String(text || '').trim();
  if (!t) return null;
  const size = Math.floor(Math.min(maxSize, r.h * 0.5));
  if (size < 7) return null;
  if (t.length * size * 0.62 > r.w * 0.86) return null;
  return { size, cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
}

/**
 * Convert tightly-packed RGBA pixels to grayscale IN PLACE, using the CSS
 * `grayscale()` luminance weights (Rec. 709) so the result matches what a
 * canvas filter would produce. Alpha is left alone - the caller has already
 * composited onto an opaque background.
 */
export function grayscaleInPlace(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const y = 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
    data[i] = data[i + 1] = data[i + 2] = Math.round(y);
  }
}

/** One rebuilt page: its JPEG bytes and the original page size in points. */
export interface RedactedPageImage {
  jpeg: Uint8Array;
  widthPt: number;
  heightPt: number;
}

/**
 * Build the output document: one page per source page at the original MediaBox
 * size in points, containing only the page image, scaled to fill the page
 * exactly. The document is created from scratch, and the Info dictionary
 * pdf-lib pre-fills at create() is emptied before save, so the result carries
 * no metadata at all - a redacted file must not even say what wrote it beyond
 * its own bytes.
 */
export async function buildImagePdf(pages: RedactedPageImage[]): Promise<Uint8Array> {
  if (!pages.length) throw new Error('This PDF has no pages.');
  const { PDFDocument, PDFName } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  for (const p of pages) {
    const img = await doc.embedJpg(p.jpeg);
    const page = doc.addPage([p.widthPt, p.heightPt]);
    page.drawImage(img, { x: 0, y: 0, width: p.widthPt, height: p.heightPt });
  }
  // PDFDocument.create() pre-fills Producer/Creator/dates - remove every entry,
  // the same way stripPdf does, so the output's Info dictionary is empty.
  const infoRef = doc.context.trailerInfo && doc.context.trailerInfo.Info;
  if (infoRef) {
    let info: { keys(): unknown[]; delete(key: unknown): void } | null;
    try { info = doc.context.lookup(infoRef) as unknown as { keys(): unknown[]; delete(key: unknown): void }; } catch { info = null; }
    if (info && typeof info.keys === 'function' && typeof info.delete === 'function') {
      for (const key of [...info.keys()]) info.delete(key);
    }
  }
  try { doc.catalog.delete(PDFName.of('Metadata')); } catch { /* none present */ }
  return doc.save({ useObjectStreams: true, updateFieldAppearances: false });
}
