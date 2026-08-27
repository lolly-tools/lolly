// SPDX-License-Identifier: MPL-2.0
/**
 * Preview-SVG optimisation helpers (build-time, thumbnail-only).
 *
 * The build previews (scripts/build-previews.ts) capture a tool's SVG thumbnail via
 * the app's own export path. That serialised SVG can carry two kinds of dead weight
 * that never affect how the thumbnail LOOKS but bloat the file:
 *
 *   1. HTML comments copied verbatim from the tool's template.html - e.g.
 *      filter-duotone's ~674 KB commented-out declarative fallback <image>. Comments
 *      never render, so a thumbnail can drop them wholesale.
 *   2. Full-resolution embedded rasters (data: URIs) - e.g. diagram-builder embeds
 *      six source photos at capture resolution (~831 KB) into a card shown a few
 *      hundred px wide. Downscaling them (done in-browser by build-previews.ts, which
 *      has a real canvas) is the single biggest win.
 *
 * These helpers are the pure string half (comment strip + data-URI find/replace) so
 * they're unit-testable without a browser; the actual pixel downscaling lives in the
 * previews script where a Playwright page is available. Precision reduction of path
 * coordinates is deliberately NOT done here - the heavy offenders use integer coords
 * (which rounding can't touch) so it buys almost nothing for real risk.
 *
 * Thumbnail-scoped on purpose: real exports keep full fidelity. (The same template
 * comments do ride along in real SVG exports too - worth stripping there separately.)
 */

import { optimize as svgoOptimize, type Config } from 'svgo';

// svgo config for thumbnails. preset-default gives whitespace/attribute/structure
// cleanup + path-data restructuring; floatPrecision:2 rounds the full-precision
// coordinates that dominate text-outlined-to-path previews (multi-page-pdf was 61
// paths / 672 KB) - 0.01 units is sub-pixel even at the catalog zoom inspector's
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

/**
 * Per-pixel filter work in an SVG, counted in "noise octaves equivalent".
 *
 * Most SVG filter primitives are cheap: feColorMatrix / feComponentTransfer /
 * feBlend / feOffset / feFlood are per-pixel arithmetic the compositor does at
 * memory speed, and feGaussianBlur / feDropShadow are the separable three-pass box
 * approximation every engine implements - fast enough that no blur in this catalog
 * measured above 10 ms (see the table on isExpensiveThumbSvg).
 *
 * Two families are not:
 *   - feTurbulence SYNTHESISES the whole filter region from Perlin/fractal noise,
 *     re-evaluating the lattice once per `numOctaves`. So its cost is octaves, not
 *     one filter - a 2-octave turbulence and a 6-octave one differ threefold.
 *     Per the SVG spec numOctaves defaults to 1 when the attribute is absent.
 *   - feDisplacementMap / feMorphology / feConvolveMatrix / feDiffuseLighting /
 *     feSpecularLighting each read a NEIGHBOURHOOD (or a second input buffer) per
 *     output pixel and cannot be separated into passes the way a blur can. Counted
 *     as one octave-equivalent apiece - none of them appears alone in this catalog,
 *     so a finer weight would be fitting noise rather than measuring it.
 */
function perPixelFilterWork(svg: string): number {
  let work = 0;
  for (const m of svg.matchAll(/<feTurbulence\b[^>]*>/g)) {
    const oct = /numOctaves\s*=\s*"([\d.]+)"/.exec(m[0]);
    work += oct ? Math.max(1, Number(oct[1])) : 1;
  }
  work += (svg.match(
    /<(feDisplacementMap|feMorphology|feConvolveMatrix|feDiffuseLighting|feSpecularLighting)\b/g,
  ) ?? []).length;
  return work;
}

/** A gallery tile paints its preview by rasterising the SVG on the client. Cheap for
 *  most, but some shapes are expensive REGARDLESS of byte size (svgo can't help):
 *  thousands of elements (a halftone's ~4k dots), one enormous tessellated path (a
 *  street map), or heavy per-pixel filter work. For these, build-previews ships a
 *  pre-rasterised tile instead - it decodes in ~1ms no matter how complex the source.
 *  viewBox crispness is only wanted by the zoom inspector, not the tile, so the trade
 *  is worth it here.
 *
 *  THE FILTER CLAUSE USED TO BE `if (/<feGaussianBlur|<feDropShadow/) return true` and
 *  that single line is why 30 of the 39 multi-MB PNGs in plans/155 finding 3 existed.
 *  Presence of a filter is not expense. Measured 2026-08-26, median of 3 decode+draw
 *  passes at 600 px (fresh blob URL each pass - Chromium caches the decoded bitmap per
 *  URL, so a reused Image measures nothing after the first draw):
 *
 *    ms   file                    per-pixel work   blurs  bytes
 *    61.9 filter.look4.svg        3×feTurbulence@2 + feDisplacementMap = 7   1   47,669
 *    17.6 gradient.svg       1×feTurbulence@2 = 2                       1    6,016
 *     9.6 design.svg              0                                          2    3,273
 *     8.7 snippet.svg         0                                          2   24,396
 *     8.1 doc-studio.svg          0                                          1   68,343
 *     7.5 frame.svg    0                                          1    7,819
 *     4.4 deck-studio.svg         0                                          1   15,005
 *
 *  So: blur alone never crossed 10 ms, and gradient - the worst offender the old
 *  clause produced, a 3,430 B SVG of real <radialGradient> stops answered by a
 *  7,881,038 B committed PNG, 2298× - paints in a sixth of the time of the one look
 *  that genuinely is expensive. Bytes and element count separate them no better than
 *  blur does (gradient 6 KB / 6 elems vs filter.look4 47 KB / 3 elems; doc-studio
 *  is 68 KB and paints in 8 ms). The thing that actually differs is the per-pixel
 *  filter work, and the gate is set on that, at >3 octave-equivalents - clear of
 *  gradient's 2 in both directions and well under filter.look4's 7.
 *
 *  If this ever needs re-tuning, re-measure; do not go back to presence-testing. A
 *  workaround with no expiry is exactly how the docs' `format=png` allowlist rotted
 *  (CLAUDE.md "Docs screenshots are vector"), and RASTER_PREVIEWS in
 *  scripts/validate-catalog.ts now makes every surviving raster say why out loud. */
export function isExpensiveThumbSvg(svg: string): boolean {
  const elems = (svg.match(/<(path|rect|circle|ellipse|polygon|polyline|line|use)\b/g) ?? []).length;
  if (elems > 800) return true;                                    // dense synthetic vector
  if (svg.length > 140_000) return true;                           // huge single/few paths
  if (perPixelFilterWork(svg) > 3) return true;                    // synthesised noise / neighbourhood ops
  return false;
}

/** Longest edge, in px, an embedded raster is downscaled to for a thumbnail. A card
 *  is shown a few hundred px wide and an embedded image occupies only a fraction of
 *  the whole canvas thumbnail, so 512 stays crisp even at 2× while cutting bytes. */
export const MAX_RASTER_DIM = 512;
/** JPEG quality used when re-encoding an opaque embedded raster. */
export const RASTER_JPEG_QUALITY = 0.82;
/** Only embedded rasters whose data-URI is at least this many chars are touched - 
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
