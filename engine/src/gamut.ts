// SPDX-License-Identifier: MPL-2.0
/**
 * Display-gamut classification for OKLCH colours - which of sRGB, Display-P3 or
 * Rec.2020 can actually show a given lightness/chroma/hue.
 *
 * brand-derive.ts owns the sRGB↔Oklab pipeline and maps out-of-gamut requests
 * back into sRGB. That answers "what will this become?"; this module answers
 * "how far out is it, and would a wider display carry it?" - the information
 * behind the brand studio's gamut bands, where a swatch that clips on an old
 * monitor but survives on P3 is a different decision from one no display can
 * hold.
 *
 * The maths reuses brand-derive's Oklab core: Oklab → linear sRGB → XYZ(D65) →
 * linear P3 / Rec.2020. Chaining through XYZ costs one extra 3×3 per test and
 * keeps a single set of Oklab matrices in the codebase; the composed matrices
 * are pre-multiplied in gamut-source.ts so the hot path (per-pixel slice
 * painting) is still two matrix applies, not three.
 *
 * Every function here takes its gamut as a {@link GamutLimit} - one of the three
 * names, or any {@link GamutSource} (an ICC print profile, say). The three names
 * resolve to sources over the original matrices, so the display path is
 * unchanged arithmetic.
 *
 * Pure and deterministic: no Date, no Math.random, no IO.
 */

import { oklabToLinearSrgb, linearToSrgb, GAMUT_EPSILON } from './brand-derive.ts';
import {
  GAMUT_PROBE_MAX, GAMUT_PROBE_START, gamutInputSane, resolveGamutSource, linearSrgbToLinearP3,
  fastRgbContains, gamutSourceId,
} from './gamut-source.ts';
import type { BuiltinGamutName, GamutLimit, GamutSource } from './gamut-source.ts';

/** Display gamuts, narrowest first. `none` = outside even Rec.2020. */
export type GamutName = BuiltinGamutName | 'none';

/** The three real gamuts, narrowest first - iterate this, don't hand-order. */
export const GAMUTS: readonly Exclude<GamutName, 'none'>[] = ['srgb', 'p3', 'rec2020'];

// The membership test itself - matrices, cube slack and all - now lives in
// gamut-source.ts, so an ICC profile can answer the same question the three RGB
// matrices do. Everything below is built on `GamutSource.contains` and does not
// know which kind it was handed.

/** Guard first, then ask the source: a custom source never sees NaN or l > 1. */
const holds = (src: GamutSource, l: number, c: number, h: number): boolean =>
  gamutInputSane(l, c, h) && src.contains(l, c, h);

/**
 * Whether this OKLCH colour fits `limit` - tested DIRECTLY against that gamut.
 *
 * ## The gamuts do not nest, and this is why the function exists
 *
 * It is natural to assume sRGB ⊂ Display-P3 ⊂ Rec.2020 and answer "does Rec.2020
 * hold it?" by classifying once and comparing sizes. The first two do nest. The
 * last pair does NOT: Display-P3's red primary lies marginally OUTSIDE the
 * Rec.2020 triangle (P3 red is xy 0.680,0.320; the Rec.2020 red–green edge runs
 * from 0.708,0.292 to 0.170,0.797, and P3's red falls on the far side of it). So
 * a thin sliver of deep reds near hue 30 is displayable on a P3 screen and NOT
 * within Rec.2020.
 *
 * Inferring membership from order therefore over-reports Rec.2020 near red - and
 * worse, it makes a chroma search stop at P3's ceiling and call it Rec.2020's.
 * Ask each gamut its own question instead.
 *
 * `l` is 0–1 (brand-derive's convention, not the CSS percent), `h` in degrees.
 *
 * `limit` is a gamut NAME or any {@link GamutSource} - a profile-backed source
 * answers here exactly as a display matrix does.
 */
export function inGamut(l: number, c: number, h: number, limit: GamutLimit): boolean {
  return holds(resolveGamutSource(limit), l, c, h);
}

/**
 * The narrowest gamut that contains this OKLCH colour, or `'none'` when none of
 * them do. A summary for labels and badges; use {@link inGamut} to ask about one
 * specific gamut, since the answer is not recoverable from this one (see the
 * non-nesting note there).
 *
 * Lightness outside [0,1] is out of every gamut - it isn't a colour a display can
 * be asked for - rather than silently clamped.
 */
export function oklchGamut(l: number, c: number, h: number): GamutName {
  for (const g of GAMUTS) if (inGamut(l, c, h, g)) return g;
  return 'none';
}

/**
 * True when `gamut` is no WIDER than `limit`, by area order.
 *
 * This is an ordering question, not a membership one, and the two part company
 * for P3 vs Rec.2020 (see {@link inGamut}). Use it to sort or to gate UI by
 * "how demanding is this?"; never to decide whether a colour fits a display.
 */
export function gamutWithin(gamut: GamutName, limit: Exclude<GamutName, 'none'>): boolean {
  if (gamut === 'none') return false;
  return GAMUTS.indexOf(gamut) <= GAMUTS.indexOf(limit);
}

/**
 * The highest chroma at this lightness and hue that still fits `limit`, found by
 * bisection to `GAMUT_EPSILON`. The grey axis (chroma 0) is inside every gamut
 * for l ∈ (0,1), so the search always converges; l at or past the extremes has
 * no chroma to give and returns 0.
 *
 * This is the boundary the slice charts trace, and the honest answer to "how
 * much punch can this hue actually carry?" - unlike a fixed chroma ceiling, it
 * tells you yellow reaches far further than blue.
 */
export function maxChroma(l: number, h: number, limit: GamutLimit = 'srgb'): number {
  if (!(l > 0) || l >= 1 || !Number.isFinite(h)) return 0;
  const src = resolveGamutSource(limit);
  let lo = 0;
  let hi = GAMUT_PROBE_START; // past every RGB display gamut's ceiling at every hue
  // …but not necessarily past an arbitrary source's, so bracket upward first
  // rather than clamp at 0.5 and draw a flat boundary that is really our own
  // starting guess. For the three built-ins the first probe is outside and this
  // loop never runs, leaving the bisection below bit-for-bit as it always was.
  let outside = !holds(src, l, hi, h);
  while (!outside && hi < GAMUT_PROBE_MAX) {
    lo = hi;
    hi *= 2;
    outside = !holds(src, l, hi, h);
  }
  if (!outside) return hi; // the source never said no - report the bound honestly
  while (hi - lo > GAMUT_EPSILON) {
    const mid = (lo + hi) / 2;
    // Directly, not via oklchGamut + ordering: the gamuts do not nest (see
    // inGamut), and the ordering form silently returns P3's ceiling for Rec.2020
    // across a sliver of deep reds.
    if (holds(src, l, mid, h)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Reduce an OKLCH colour into `limit`, holding LIGHTNESS and HUE constant and
 * giving up CHROMA - CSS Color 4 section 14.2's form of "keep the request, yield the
 * only channel that can give". An already-in-gamut colour is returned UNCHANGED
 * (the same object reference), so this is safe to call unconditionally.
 *
 * The ceiling is {@link maxChroma}, which is `GamutLimit`-parameterised, so this
 * works for `srgb`/`p3`/`rec2020` and for any {@link GamutSource} (an ICC print
 * profile) alike. Against `srgb` the result is bit-for-bit the shell's former
 * `clampIntoGamut` (shells/web/src/lib/gamut-slider.ts) - `{...o, c:
 * Math.min(o.c, maxChroma(o.l, o.h, 'srgb'))}` - which now delegates here.
 *
 * `mode` is reserved for a future MINDE (min-ΔE) refinement; only the default
 * `'exact'` ceiling is implemented today (see the note in the test file).
 */
export function clipToGamut(
  o: { l: number; c: number; h: number },
  limit: GamutLimit,
  _mode: 'exact' = 'exact',
): { l: number; c: number; h: number } {
  if (inGamut(o.l, o.c, o.h, limit)) return o;
  return { ...o, c: Math.min(o.c, maxChroma(o.l, o.h, limit)) };
}

// ─── Slice rendering ──────────────────────────────────────────────────────────

/**
 * Which 2D plane through OKLCH space to paint. In every name the FIRST letter is
 * the vertical axis and the SECOND is the horizontal one:
 *
 *   'lc' - lightness (y, 1 at the top) × chroma (x, 0 at the left), at a fixed hue
 *   'ch' - chroma    (y, 0 at the BOTTOM) × hue (x, 0–360°), at a fixed lightness
 *   'lh' - lightness (y, 1 at the top) × hue (x, 0–360°), at a fixed chroma
 */
export type SlicePlane = 'lc' | 'ch' | 'lh';

export interface SliceOptions {
  plane: SlicePlane;
  /** The third channel's value: hue in degrees for 'lc', lightness 0–1 for 'ch', chroma for 'lh'. */
  fixed: number;
  width: number;
  height: number;
  /** Ceiling of the chroma axis (or the chroma the whole 'lh' plane sits at). Default 0.4. */
  cMax?: number;
  /**
   * Space to encode the bytes in. Default 'srgb'.
   *
   * Pass 'display-p3' together with a `getContext('2d', { colorSpace: 'display-p3' })`
   * canvas and a matching ImageData, and the P3 band is painted as REAL colour
   * rather than gamut-mapped. Mismatching the two silently shifts every pixel, so
   * the caller must set both or neither.
   */
  encode?: EncodeSpace;
  /** Paint nothing beyond this gamut - a name or any {@link GamutSource}.
   *  Default 'rec2020', the widest gamut we classify by name. */
  limit?: GamutLimit;
}

export interface SliceImage {
  /** RGBA bytes, row-major from the TOP row - ready for `new ImageData(data, width)`. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const SLICE_C_MAX = 0.4; // the practical sRGB/P3 ceiling the colour picker's C slider uses

/** An encode space → the gamut name whose ceiling it should clamp to. The two
 *  vocabularies differ because one comes from the canvas API and the other from
 *  this module's own gamut set. */
const ENCODE_GAMUT: Record<EncodeSpace, BuiltinGamutName> = {
  srgb: 'srgb',
  'display-p3': 'p3',
};

/**
 * Which space the returned bytes are ENCODED in.
 *
 * Only these two, because they are the only values a canvas 2D context accepts
 * for `colorSpace` - offering rec2020 here would be a promise no browser can
 * keep. Both use the sRGB transfer curve, so only the primaries differ.
 *
 * This is the difference between showing someone their own display's colour and
 * showing them an sRGB approximation of it. On a wide-gamut screen - which most
 * people who open a colour tool are using - 'display-p3' is the honest choice.
 */
export type EncodeSpace = 'srgb' | 'display-p3';

/**
 * A coarse (lightness × hue) grid of a gamut's chroma ceiling, bilinearly
 * sampled - how the painter avoids running a bisection 64,000 times.
 *
 * It serves two jobs, and they are worth telling apart:
 *
 *  - **Desaturation target.** The grid for the ENCODE space decides the fill
 *    colour of pixels already outside it and therefore already an approximation
 *    on that surface. Sampling is obviously legitimate there.
 *  - **Membership**, for a source with no fast matrix path - an ICC profile. A
 *    profile's `contains` costs ~1.4 µs against a matrix's ~0.1, so a 320×200
 *    slice would be ~85 ms per chart, per repaint, under a drag. Testing
 *    `c <= sampleCeiling(grid, l, h)` instead brings the per-pixel cost back to
 *    the RGB path's, and pays the ~9.4k bisections once per (profile × intent).
 *
 * **The assumption membership adds**, stated because it is now essential: a
 * gamut is treated as an INTERVAL [0, cmax] in chroma at fixed (L, h) -
 * star-shaped in chroma. The engine already assumes this, because `maxChroma`
 * bisects; the grid only extends it from the boundary to the fill. The
 * consequence is that a genuine hole inside a press gamut is drawn filled. Do
 * not add a hole search: it multiplies the cost of every pixel to chase
 * something no real output profile exhibits at this scale.
 *
 * Every line the user actually READS - the contours from `sliceGamutRegion` -
 * still comes from exact `maxChroma` calls. The ceiling is smooth in both axes
 * away from L→1, so a 2.5° / 0.016-lightness grid lands well inside a JND.
 *
 * Keyed by `gamutSourceId`, so a profile gets its own table and two profiles
 * cannot collide (a source stringifies to '[object Object]'). The cache is
 * unbounded in principle; in practice its keys are the three built-in names plus
 * one per profile-intent the user has mounted, which is a handful.
 */
const GRID_L = 65;  // lightness samples, 0…1 inclusive
const GRID_H = 145; // hue samples, 0…360 inclusive (2.5° apart, wrapping at both ends)

// Built once on first use and reused: a gamut is a constant, so this is a lookup
// table, not state. Keeping it module-level takes the ~9,400 bisections out of
// every repaint.
const CEILINGS = new Map<string, Float64Array>();

function ceilingGrid(limit: GamutLimit): Float64Array {
  const id = gamutSourceId(limit);
  const cached = CEILINGS.get(id);
  if (cached) return cached;
  const src = resolveGamutSource(limit);
  const g = new Float64Array(GRID_L * GRID_H);
  for (let i = 0; i < GRID_L; i++) {
    const l = i / (GRID_L - 1);
    for (let j = 0; j < GRID_H; j++) g[i * GRID_H + j] = maxChroma(l, (j / (GRID_H - 1)) * 360, src);
  }
  CEILINGS.set(id, g);
  return g;
}

/**
 * The highest chroma on this gamut's ceiling grid, and its location.
 *
 * The coarse stage of `chromaAxisMax`'s peak search (gamut-axis.ts), shared with
 * the painter rather than swept a second time: the grid is already built for any
 * gamut being charted, so an axis ceiling costs only the local refinement around
 * the winner. Grid-resolution, so a caller wanting the true peak must refine.
 */
export function gamutCeilingPeak(limit: GamutLimit): { c: number; l: number; h: number } {
  const g = ceilingGrid(limit);
  let best = 0, bi = 0, bj = 0;
  for (let i = 0; i < GRID_L; i++) {
    for (let j = 0; j < GRID_H; j++) {
      const c = g[i * GRID_H + j] as number;
      if (c > best) { best = c; bi = i; bj = j; }
    }
  }
  return { c: best, l: bi / (GRID_L - 1), h: (bj / (GRID_H - 1)) * 360 };
}

/** Grid spacing, so a refinement step knows how wide one cell is. */
export const GAMUT_GRID_STEP = { l: 1 / (GRID_L - 1), h: 360 / (GRID_H - 1) } as const;

function sampleCeiling(grid: Float64Array, l: number, h: number): number {
  const fi = Math.min(GRID_L - 1, Math.max(0, l * (GRID_L - 1)));
  const fj = Math.min(GRID_H - 1, Math.max(0, (((h % 360) + 360) % 360) / 360 * (GRID_H - 1)));
  const i0 = Math.floor(fi), j0 = Math.floor(fj);
  const i1 = Math.min(GRID_L - 1, i0 + 1), j1 = Math.min(GRID_H - 1, j0 + 1);
  const ti = fi - i0, tj = fj - j0;
  const at = (i: number, j: number): number => grid[i * GRID_H + j] as number;
  const a = at(i0, j0), b = at(i0, j1);
  const c = at(i1, j0), d = at(i1, j1);
  return (a + (b - a) * tj) * (1 - ti) + (c + (d - c) * tj) * ti;
}

/**
 * Paint one plane of OKLCH space as RGBA pixels: in-gamut colour where the plane
 * has a colour, fully transparent outside `limit`. This is the fill behind the
 * brand studio's gamut charts and the Colour Lab tool - one implementation, so
 * the two can't drift, and it lives here because it is pure arithmetic with no
 * canvas, DOM or worker anywhere in it.
 *
 * Honesty note: the output is 8-bit sRGB, so a P3 or Rec.2020 pixel is painted
 * *gamut-mapped* - the nearest sRGB colour, not the real one. That is the best
 * an sRGB surface can do, and it is why the caller draws the gamut BOUNDARIES on
 * top: the boundary line is the information, the colour past it is an
 * approximation. Callers wanting the real thing on a wide-gamut display should
 * composite this against a `display-p3` canvas of their own.
 *
 * Cost is one gamut classification plus one gamut map per pixel, so a 320×200
 * slice is ~64k of each - single-digit milliseconds against one of the three RGB
 * names, no worker needed. Repaint on rAF while a slider drags.
 *
 * A profile-backed `limit` costs the SAME per pixel, because membership comes
 * from that source's `ceilingGrid` rather than from `contains` (which runs two
 * CLUT interpolations, ~1.4µs against a matrix's ~0.1µs - 400,000 of those is
 * what made a profile chart unpaintable under a drag). The grid is built once
 * per profile × intent, ~9.4k bisections, and memoised; read `ceilingGrid` for
 * the assumption that trade makes.
 */
export function oklchSlice(opts: SliceOptions): SliceImage {
  const width = Math.max(1, Math.floor(opts.width));
  const height = Math.max(1, Math.floor(opts.height));
  const cMax = opts.cMax != null && opts.cMax > 0 ? opts.cMax : SLICE_C_MAX;
  const src = resolveGamutSource(opts.limit ?? 'rec2020');
  const data = new Uint8ClampedArray(width * height * 4);
  // The hoisted test for a built-in gamut; for anything else - an ICC profile -
  // its own ceiling grid, because `contains` costs ~14x a matrix apply and this
  // is a per-PIXEL call, so the difference IS the cost of the paint. See
  // `ceilingGrid` for the star-shaped-in-chroma assumption that buys.
  const fast = fastRgbContains(src);
  let inside: (l: number, c: number, h: number) => boolean;
  if (fast) inside = fast;
  else {
    const own = ceilingGrid(src);
    inside = (l, c, h) => c <= sampleCeiling(own, l, h);
  }
  const encode: EncodeSpace = opts.encode ?? 'srgb';
  const ceiling = ceilingGrid(ENCODE_GAMUT[encode]);

  // Sample at pixel CENTRES, so the leftmost column is not exactly 0 and the
  // plane doesn't shift by half a pixel when the width changes.
  const across = (i: number, span: number): number => (i + 0.5) / span;

  for (let y = 0; y < height; y++) {
    const v = 1 - across(y, height); // 0 at the bottom row, 1 at the top
    for (let x = 0; x < width; x++) {
      const u = across(x, width);
      let l: number, c: number, h: number;
      switch (opts.plane) {
        case 'lc': l = v; c = u * cMax; h = opts.fixed; break;
        case 'ch': l = opts.fixed; c = v * cMax; h = u * 360; break;
        default:   l = v; c = opts.fixed; h = u * 360; break;
      }
      const o = (y * width + x) * 4;
      if (!inside(l, c, h)) continue; // leave it transparent
      // Desaturate past the ENCODE space's ceiling before encoding, so the encode
      // below is the whole cost - no per-pixel gamut-map bisection.
      const cUse = Math.min(c, sampleCeiling(ceiling, l, h));
      const hr = (h * Math.PI) / 180;
      let lin = oklabToLinearSrgb(l, cUse * Math.cos(hr), cUse * Math.sin(hr));
      // Into the encode space's primaries while still linear; the transfer curve
      // below is shared (Display-P3 uses sRGB's).
      if (encode === 'display-p3') lin = linearSrgbToLinearP3(lin[0], lin[1], lin[2]);
      data[o] = linearToSrgb(Math.min(1, Math.max(0, lin[0]))) * 255;
      data[o + 1] = linearToSrgb(Math.min(1, Math.max(0, lin[1]))) * 255;
      data[o + 2] = linearToSrgb(Math.min(1, Math.max(0, lin[2]))) * 255;
      data[o + 3] = 255;
    }
  }
  return { data, width, height };
}

/**
 * One OKLCH colour as components in an encode space, each 0–1.
 *
 * The single-colour twin of what {@link oklchSlice} does per pixel, and
 * deliberately built on the SAME desaturation grid rather than on an independent
 * `maxChroma` bisection: a vector shape filled with this and a slice pixel at the
 * same coordinates have to agree, and two ceilings that are merely both correct
 * would still disagree in the last decimal - which shows up as a visible seam
 * where a filled surface meets a painted one.
 *
 * Chroma past the encode space's ceiling is reduced (L and H preserved, CSS
 * Color 4 section 14.2's shape), because a surface cannot show what it cannot show. That
 * makes the result a PAINTING value: never read a position, a stored token or a
 * round-trip back out of it - see the gamut-map caveat on `oklchToHex`.
 */
export function encodeOklch(
  l: number, c: number, h: number, encode: EncodeSpace = 'srgb',
): [number, number, number] {
  const cUse = Math.min(c, sampleCeiling(ceilingGrid(ENCODE_GAMUT[encode]), l, h));
  const hr = (h * Math.PI) / 180;
  let lin = oklabToLinearSrgb(l, cUse * Math.cos(hr), cUse * Math.sin(hr));
  if (encode === 'display-p3') lin = linearSrgbToLinearP3(lin[0], lin[1], lin[2]);
  return [
    linearToSrgb(Math.min(1, Math.max(0, lin[0]))),
    linearToSrgb(Math.min(1, Math.max(0, lin[1]))),
    linearToSrgb(Math.min(1, Math.max(0, lin[2]))),
  ];
}

/**
 * The `limit` gamut's boundary across a plane, as `steps + 1` points in the
 * plane's own 0–1 unit square (x rightward, y DOWNWARD - SVG/canvas convention,
 * so a caller multiplies by its pixel box and draws a polyline).
 *
 * For 'lc' the boundary is the maximum chroma at each lightness - the horseshoe
 * that shows yellow reaching much further than blue. For 'ch' it is the maximum
 * chroma at each hue. 'lh' has no such curve (chroma is fixed across the whole
 * plane, so the in-gamut region is bounded top and bottom, not by a single
 * function of x) and returns an empty array - draw that one's edge by painting
 * the slice's own alpha instead.
 */
export function sliceGamutEdge(
  plane: SlicePlane,
  fixed: number,
  limit: GamutLimit = 'srgb',
  steps = 96,
  cMax = SLICE_C_MAX,
): { x: number; y: number }[] {
  const n = Math.max(2, Math.floor(steps));
  const src = resolveGamutSource(limit);
  const pts: { x: number; y: number }[] = [];
  if (plane === 'lc') {
    for (let i = 0; i <= n; i++) {
      const l = 1 - i / n;                       // top (L 1) downward
      pts.push({ x: Math.min(1, maxChroma(l, fixed, src) / cMax), y: i / n });
    }
  } else if (plane === 'ch') {
    for (let i = 0; i <= n; i++) {
      const h = (i / n) * 360;
      const c = Math.min(1, maxChroma(fixed, h, src) / cMax);
      pts.push({ x: i / n, y: 1 - c });          // chroma grows upward
    }
  }
  return pts;
}

/**
 * The in-gamut REGION of a plane, as closed rings in the plane's unit square
 * (x right, y down) - what an SVG `clipPath` or a filled `<path>` needs, where
 * {@link sliceGamutEdge} gives only the open curve to stroke. A vector export
 * (the Colour Lab tool's poster) has to FILL the displayable area; a raster
 * surface can just leave the rest of the buffer transparent.
 *
 * Returns an ARRAY of rings, because the region is not always connected. On the
 * 'lh' plane the chroma is fixed across the whole plane, so at, say, C 0.15 the
 * displayable area breaks into islands - one per stretch of hue that can hold
 * that much chroma at some lightness, with real gaps between them where no
 * lightness can. One ring would have to bridge those gaps, claiming colours
 * that do not exist.
 *
 * 'lc' and 'ch' always come back as exactly one ring: their boundary is a
 * single-valued function of one axis, so the region is simply the area between
 * that curve and the achromatic edge.
 */
export function sliceGamutRegion(
  plane: SlicePlane,
  fixed: number,
  limit: GamutLimit = 'srgb',
  steps = 96,
  cMax = SLICE_C_MAX,
): { x: number; y: number }[][] {
  const n = Math.max(2, Math.floor(steps));
  const src = resolveGamutSource(limit);

  if (plane === 'lc') {
    // Down the grey axis (c = 0), then back up along the chroma ceiling.
    const edge = sliceGamutEdge('lc', fixed, src, n, cMax);
    return [[{ x: 0, y: 0 }, { x: 0, y: 1 }, ...edge.slice().reverse()]];
  }
  if (plane === 'ch') {
    // Along the achromatic bottom, then back along the ceiling.
    const edge = sliceGamutEdge('ch', fixed, src, n, cMax);
    return [[{ x: 0, y: 1 }, { x: 1, y: 1 }, ...edge.slice().reverse()]];
  }

  // 'lh': at each hue, the lightness window that can hold this chroma. Scan
  // coarsely for the window, then bisect each end into the gap beside it - one
  // bisection per end per column rather than per sample.
  const c = Math.max(0, fixed);
  const SCAN = 64;
  const fits = (l: number, h: number): boolean => holds(src, l, c, h);
  const window = (h: number): { lo: number; hi: number } | null => {
    let first = -1, last = -1;
    for (let i = 0; i <= SCAN; i++) {
      if (fits(i / SCAN, h)) { if (first < 0) first = i; last = i; }
    }
    if (first < 0) return null;
    const refine = (inside: number, outside: number): number => {
      let a = inside, b = outside;
      for (let k = 0; k < 20; k++) {
        const mid = (a + b) / 2;
        if (fits(mid, h)) a = mid; else b = mid;
      }
      return a;
    };
    return {
      lo: first === 0 ? 0 : refine(first / SCAN, (first - 1) / SCAN),
      hi: last === SCAN ? 1 : refine(last / SCAN, (last + 1) / SCAN),
    };
  };

  const rings: { x: number; y: number }[][] = [];
  let run: { x: number; lo: number; hi: number }[] = [];
  const flush = (): void => {
    if (run.length >= 2) {
      rings.push([
        ...run.map(p => ({ x: p.x, y: 1 - p.hi })),                    // out along the top
        ...run.slice().reverse().map(p => ({ x: p.x, y: 1 - p.lo })),  // back along the bottom
      ]);
    }
    run = [];
  };
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    const w = window(x * 360);
    if (w) run.push({ x, ...w }); else flush();
  }
  flush();
  return rings;
}
