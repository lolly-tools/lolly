/**
 * Preview-SVG optimisation helpers (build-time, thumbnail-only).
 *
 * The build previews (scripts/build-previews.ts) capture a tool's SVG thumbnail via
 * the app's own export path. That serialised SVG can carry two kinds of dead weight
 * that never affect how the thumbnail LOOKS but bloat the file:
 *
 *   1. HTML comments copied verbatim from the tool's template.html — e.g.
 *      filter-duotone's ~674 KB commented-out declarative fallback <image>. Comments
 *      never render, so a thumbnail can drop them wholesale.
 *   2. Full-resolution embedded rasters (data: URIs) — e.g. diagram-builder embeds
 *      six source photos at capture resolution (~831 KB) into a card shown a few
 *      hundred px wide. Downscaling them (done in-browser by build-previews.ts, which
 *      has a real canvas) is the single biggest win.
 *
 * These helpers are the pure string half (comment strip + data-URI find/replace) so
 * they're unit-testable without a browser; the actual pixel downscaling lives in the
 * previews script where a Playwright page is available. Precision reduction of path
 * coordinates is deliberately NOT done here — the heavy offenders use integer coords
 * (which rounding can't touch) so it buys almost nothing for real risk.
 *
 * Thumbnail-scoped on purpose: real exports keep full fidelity. (The same template
 * comments do ride along in real SVG exports too — worth stripping there separately.)
 */

import { optimize as svgoOptimize, type Config } from 'svgo';

// svgo config for thumbnails. preset-default gives whitespace/attribute/structure
// cleanup + path-data restructuring; floatPrecision:2 rounds the full-precision
// coordinates that dominate text-outlined-to-path previews (multi-page-pdf was 61
// paths / 672 KB) — 0.01 units is sub-pixel even at the catalog zoom inspector's
// 1600%. viewBox is KEPT (svgo 4 keeps it by default; the inspector needs it), and
// cleanupIds is OFF so filter/gradient/clip url(#id) refs can never break.
const SVGO_THUMB_CONFIG: Config = {
  multipass: true,
  floatPrecision: 2,
  plugins: [{ name: 'preset-default', params: { overrides: { cleanupIds: false } } }],
};

/** Final minification pass: path-precision + structure/whitespace cleanup the
 *  comment/raster passes don't touch (~35–80% on vector-heavy previews). Fail-safe:
 *  any svgo hiccup returns the input unchanged, so it can only shrink or no-op. */
export function svgoThumb(svg: string): string {
  try { return svgoOptimize(svg, SVGO_THUMB_CONFIG).data; }
  catch { return svg; }
}

/** A gallery tile paints its preview by rasterising the SVG on the client every
 *  frame. Cheap for most, but three shapes are expensive REGARDLESS of byte size
 *  (svgo can't help): feGaussianBlur (a full convolution — the priciest SVG op),
 *  thousands of elements (a halftone's ~4k dots), or one enormous tessellated path
 *  (a street map). For these, build-previews ships a pre-rasterised PNG instead —
 *  it decodes in ~1ms no matter how complex the source. viewBox crispness is only
 *  wanted by the zoom inspector, not the tile, so the trade is worth it here. */
export function isExpensiveThumbSvg(svg: string): boolean {
  if (/<feGaussianBlur|<feDropShadow/.test(svg)) return true;      // blur/shadow filter
  const elems = (svg.match(/<(path|rect|circle|ellipse|polygon|polyline|line|use)\b/g) ?? []).length;
  if (elems > 800) return true;                                    // dense synthetic vector
  if (svg.length > 140_000) return true;                           // huge single/few paths
  return false;
}

/** Longest edge, in px, an embedded raster is downscaled to for a thumbnail. A card
 *  is shown a few hundred px wide and an embedded image occupies only a fraction of
 *  the whole canvas thumbnail, so 512 stays crisp even at 2× while cutting bytes. */
export const MAX_RASTER_DIM = 512;
/** JPEG quality used when re-encoding an opaque embedded raster. */
export const RASTER_JPEG_QUALITY = 0.82;
/** Only embedded rasters whose data-URI is at least this many chars are touched —
 *  small inlined marks (icons/logos) aren't worth the round-trip and re-encode. */
export const MIN_RASTER_URI_CHARS = 30_000;

/** Drop every HTML/XML comment. Comments never paint, so a thumbnail loses nothing. */
export function stripSvgComments(svg: string): string {
  return svg.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Unique embedded RASTER data-URIs at least MIN_RASTER_URI_CHARS long, as referenced
 * by href / xlink:href. Deduped so an image reused N times is shrunk once and
 * substituted everywhere. Deliberately restricted to raster mimes (png/jpeg/webp/…):
 * an embedded `image/svg+xml` is vector, and rasterising it to shrink the file would
 * destroy exactly the resolution-independence a preview SVG exists to keep.
 */
export function listEmbeddedRasters(svg: string, minChars = MIN_RASTER_URI_CHARS): string[] {
  const out = new Set<string>();
  for (const m of svg.matchAll(/(?:xlink:href|href)\s*=\s*"(data:image\/(?:png|jpe?g|webp|gif|bmp|avif)[^"]*)"/gi)) {
    const uri = m[1]!;
    if (uri.length >= minChars) out.add(uri);
  }
  return [...out];
}

/**
 * Replace each old data-URI with its shrunk replacement, but only when the
 * replacement is actually smaller (a shrink that grew the bytes is discarded, so
 * this never regresses a file). data-URIs are long unique strings, so a literal
 * split/join is safe (no regex-escape hazard).
 */
export function substituteDataUris(svg: string, map: Record<string, string>): string {
  let out = svg;
  for (const [oldUri, newUri] of Object.entries(map)) {
    if (newUri && newUri.length < oldUri.length) out = out.split(oldUri).join(newUri);
  }
  return out;
}
