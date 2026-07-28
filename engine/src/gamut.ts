// SPDX-License-Identifier: MPL-2.0
/**
 * Display-gamut classification for OKLCH colours — which of sRGB, Display-P3 or
 * Rec.2020 can actually show a given lightness/chroma/hue.
 *
 * brand-derive.ts owns the sRGB↔Oklab pipeline and maps out-of-gamut requests
 * back into sRGB. That answers "what will this become?"; this module answers
 * "how far out is it, and would a wider display carry it?" — the information
 * behind the brand studio's gamut bands, where a swatch that clips on an old
 * monitor but survives on P3 is a different decision from one no display can
 * hold.
 *
 * The maths reuses brand-derive's Oklab core: Oklab → linear sRGB → XYZ(D65) →
 * linear P3 / Rec.2020. Chaining through XYZ costs one extra 3×3 per test and
 * keeps a single set of Oklab matrices in the codebase; the composed matrices
 * are pre-multiplied here so the hot path (per-pixel slice painting) is still
 * two matrix applies, not three.
 *
 * Pure and deterministic: no Date, no Math.random, no IO.
 */

import { oklabToLinearSrgb, linearToSrgb, GAMUT_EPSILON } from './brand-derive.ts';

/** Display gamuts, narrowest first. `none` = outside even Rec.2020. */
export type GamutName = 'srgb' | 'p3' | 'rec2020' | 'none';

/** The three real gamuts, narrowest first — iterate this, don't hand-order. */
export const GAMUTS: readonly Exclude<GamutName, 'none'>[] = ['srgb', 'p3', 'rec2020'];

type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

const apply3 = (m: Mat3, x: number, y: number, z: number): [number, number, number] => [
  m[0] * x + m[1] * y + m[2] * z,
  m[3] * x + m[4] * y + m[5] * z,
  m[6] * x + m[7] * y + m[8] * z,
];

// Linear sRGB → linear Display-P3 and → linear Rec.2020, pre-composed from the
// CSS Color 4 primaries (sRGB→XYZ(D65) then XYZ→the target's inverse matrix).
// Both share sRGB's D65 white point, so no chromatic adaptation is involved and
// pure white/black map to themselves — worth knowing when reading the numbers:
// each row sums to 1.
const SRGB_TO_P3: Mat3 = [
  0.8224621, 0.1775380, 0.0000000,
  0.0331941, 0.9668058, 0.0000000,
  0.0170827, 0.0723974, 0.9105199,
];
const SRGB_TO_REC2020: Mat3 = [
  0.6274040, 0.3292820, 0.0433136,
  0.0690970, 0.9195400, 0.0113612,
  0.0163916, 0.0880132, 0.8955953,
];

// Slack on the cube test, in LINEAR light. Deliberately far tighter than
// brand-derive's `GAMUT_EPSILON` (1e-4), which is a bisection tolerance rather
// than a shape query: an absolute epsilon in linear light is negligible at the
// top of the range but enormous near black, where every channel is a few
// thousandths. At 1e-4 the near-black boundary visibly bulges — maxChroma at
// hue 30 spiked to 0.070 around L 0.012 before falling back to 0.034, a hook in
// the chart that is an artefact of the slack, not a property of sRGB.
//
// 1e-6 is two orders of magnitude clear of reality: the worst out-of-cube
// excursion for an actual 8-bit sRGB colour round-tripped through hexToOklch is
// 2e-7 (at #ffffff), so nothing displayable is misclassified.
// GAMUT_EPSILON keeps its own job below, as maxChroma's bisection tolerance.
const EPS = 1e-6;

const inUnitCube = (rgb: readonly [number, number, number]): boolean =>
  rgb[0] >= -EPS && rgb[0] <= 1 + EPS
  && rgb[1] >= -EPS && rgb[1] <= 1 + EPS
  && rgb[2] >= -EPS && rgb[2] <= 1 + EPS;

/**
 * The narrowest gamut that contains this OKLCH colour, or `'none'`.
 *
 * `l` is 0–1 (brand-derive's convention, not the CSS percent) and `h` is in
 * degrees. Lightness outside [0,1] is out of every gamut — it isn't a colour a
 * display can be asked for — rather than silently clamped.
 */
export function oklchGamut(l: number, c: number, h: number): GamutName {
  if (!(l >= 0) || l > 1 || !(c >= 0) || !Number.isFinite(h)) return 'none';
  const hr = (h * Math.PI) / 180;
  const lin = oklabToLinearSrgb(l, c * Math.cos(hr), c * Math.sin(hr));
  if (inUnitCube(lin)) return 'srgb';
  if (inUnitCube(apply3(SRGB_TO_P3, lin[0], lin[1], lin[2]))) return 'p3';
  if (inUnitCube(apply3(SRGB_TO_REC2020, lin[0], lin[1], lin[2]))) return 'rec2020';
  return 'none';
}

/** True when `gamut` is inside (or equal to) `limit` — 'none' is inside nothing. */
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
 * much punch can this hue actually carry?" — unlike a fixed chroma ceiling, it
 * tells you yellow reaches far further than blue.
 */
export function maxChroma(l: number, h: number, limit: Exclude<GamutName, 'none'> = 'srgb'): number {
  if (!(l > 0) || l >= 1 || !Number.isFinite(h)) return 0;
  let lo = 0;
  let hi = 0.5; // past the Rec.2020 ceiling at every hue, so the first probe is outside
  while (hi - lo > GAMUT_EPSILON) {
    const mid = (lo + hi) / 2;
    if (gamutWithin(oklchGamut(l, mid, h), limit)) lo = mid;
    else hi = mid;
  }
  return lo;
}

// ─── Slice rendering ──────────────────────────────────────────────────────────

/**
 * Which 2D plane through OKLCH space to paint. In every name the FIRST letter is
 * the vertical axis and the SECOND is the horizontal one:
 *
 *   'lc' — lightness (y, 1 at the top) × chroma (x, 0 at the left), at a fixed hue
 *   'ch' — chroma    (y, 0 at the BOTTOM) × hue (x, 0–360°), at a fixed lightness
 *   'lh' — lightness (y, 1 at the top) × hue (x, 0–360°), at a fixed chroma
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
  /** Paint nothing beyond this gamut. Default 'rec2020' — the widest we classify. */
  limit?: Exclude<GamutName, 'none'>;
}

export interface SliceImage {
  /** RGBA bytes, row-major from the TOP row — ready for `new ImageData(data, width)`. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const SLICE_C_MAX = 0.4; // the practical sRGB/P3 ceiling the colour picker's C slider uses

/**
 * A coarse (lightness × hue) grid of the sRGB chroma ceiling, bilinearly
 * sampled — how the painter desaturates an out-of-sRGB pixel back to something
 * showable without running a bisection 64,000 times.
 *
 * Sampling is legitimate here and only here: the grid decides the FILL colour
 * of pixels that are already outside sRGB and therefore already an
 * approximation on an 8-bit surface. Every line the user actually reads — the
 * gamut boundaries from `sliceGamutEdge` — comes from exact `maxChroma` calls.
 * The ceiling is smooth in both axes away from L→1, so a 2.5° / 0.016-lightness
 * grid lands well inside a JND.
 */
const GRID_L = 65;  // lightness samples, 0…1 inclusive
const GRID_H = 145; // hue samples, 0…360 inclusive (2.5° apart, wrapping at both ends)

// Built once on first use and reused: the sRGB gamut is a constant, so this is a
// lookup table, not state. Keeping it module-level takes the ~2,400 bisections
// out of every repaint — the difference between a hue drag at 9ms and at 12ms.
let CEILING: Float64Array | null = null;

function srgbCeilingGrid(): Float64Array {
  if (CEILING) return CEILING;
  const g = new Float64Array(GRID_L * GRID_H);
  for (let i = 0; i < GRID_L; i++) {
    const l = i / (GRID_L - 1);
    for (let j = 0; j < GRID_H; j++) g[i * GRID_H + j] = maxChroma(l, (j / (GRID_H - 1)) * 360, 'srgb');
  }
  CEILING = g;
  return g;
}

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
 * brand studio's gamut charts and the Colour Lab tool — one implementation, so
 * the two can't drift, and it lives here because it is pure arithmetic with no
 * canvas, DOM or worker anywhere in it.
 *
 * Honesty note: the output is 8-bit sRGB, so a P3 or Rec.2020 pixel is painted
 * *gamut-mapped* — the nearest sRGB colour, not the real one. That is the best
 * an sRGB surface can do, and it is why the caller draws the gamut BOUNDARIES on
 * top: the boundary line is the information, the colour past it is an
 * approximation. Callers wanting the real thing on a wide-gamut display should
 * composite this against a `display-p3` canvas of their own.
 *
 * Cost is one gamut classification plus one gamut map per pixel, so a 320×200
 * slice is ~64k of each — single-digit milliseconds, no worker needed. Repaint
 * on rAF while a slider drags.
 */
export function oklchSlice(opts: SliceOptions): SliceImage {
  const width = Math.max(1, Math.floor(opts.width));
  const height = Math.max(1, Math.floor(opts.height));
  const cMax = opts.cMax != null && opts.cMax > 0 ? opts.cMax : SLICE_C_MAX;
  const limit = opts.limit ?? 'rec2020';
  const data = new Uint8ClampedArray(width * height * 4);
  const ceiling = srgbCeilingGrid();

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
      if (!gamutWithin(oklchGamut(l, c, h), limit)) continue; // leave it transparent
      // Desaturate anything past sRGB down to the ceiling before encoding, so
      // the encode below is the whole cost — no per-pixel gamut-map bisection.
      const cUse = Math.min(c, sampleCeiling(ceiling, l, h));
      const hr = (h * Math.PI) / 180;
      const lin = oklabToLinearSrgb(l, cUse * Math.cos(hr), cUse * Math.sin(hr));
      data[o] = linearToSrgb(Math.min(1, Math.max(0, lin[0]))) * 255;
      data[o + 1] = linearToSrgb(Math.min(1, Math.max(0, lin[1]))) * 255;
      data[o + 2] = linearToSrgb(Math.min(1, Math.max(0, lin[2]))) * 255;
      data[o + 3] = 255;
    }
  }
  return { data, width, height };
}

/**
 * The `limit` gamut's boundary across a plane, as `steps + 1` points in the
 * plane's own 0–1 unit square (x rightward, y DOWNWARD — SVG/canvas convention,
 * so a caller multiplies by its pixel box and draws a polyline).
 *
 * For 'lc' the boundary is the maximum chroma at each lightness — the horseshoe
 * that shows yellow reaching much further than blue. For 'ch' it is the maximum
 * chroma at each hue. 'lh' has no such curve (chroma is fixed across the whole
 * plane, so the in-gamut region is bounded top and bottom, not by a single
 * function of x) and returns an empty array — draw that one's edge by painting
 * the slice's own alpha instead.
 */
export function sliceGamutEdge(
  plane: SlicePlane,
  fixed: number,
  limit: Exclude<GamutName, 'none'> = 'srgb',
  steps = 96,
  cMax = SLICE_C_MAX,
): { x: number; y: number }[] {
  const n = Math.max(2, Math.floor(steps));
  const pts: { x: number; y: number }[] = [];
  if (plane === 'lc') {
    for (let i = 0; i <= n; i++) {
      const l = 1 - i / n;                       // top (L 1) downward
      pts.push({ x: Math.min(1, maxChroma(l, fixed, limit) / cMax), y: i / n });
    }
  } else if (plane === 'ch') {
    for (let i = 0; i <= n; i++) {
      const h = (i / n) * 360;
      const c = Math.min(1, maxChroma(fixed, h, limit) / cMax);
      pts.push({ x: i / n, y: 1 - c });          // chroma grows upward
    }
  }
  return pts;
}

/**
 * The in-gamut REGION of a plane, as closed rings in the plane's unit square
 * (x right, y down) — what an SVG `clipPath` or a filled `<path>` needs, where
 * {@link sliceGamutEdge} gives only the open curve to stroke. A vector export
 * (the Colour Lab tool's poster) has to FILL the displayable area; a raster
 * surface can just leave the rest of the buffer transparent.
 *
 * Returns an ARRAY of rings, because the region is not always connected. On the
 * 'lh' plane the chroma is fixed across the whole plane, so at, say, C 0.15 the
 * displayable area breaks into islands — one per stretch of hue that can hold
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
  limit: Exclude<GamutName, 'none'> = 'srgb',
  steps = 96,
  cMax = SLICE_C_MAX,
): { x: number; y: number }[][] {
  const n = Math.max(2, Math.floor(steps));

  if (plane === 'lc') {
    // Down the grey axis (c = 0), then back up along the chroma ceiling.
    const edge = sliceGamutEdge('lc', fixed, limit, n, cMax);
    return [[{ x: 0, y: 0 }, { x: 0, y: 1 }, ...edge.slice().reverse()]];
  }
  if (plane === 'ch') {
    // Along the achromatic bottom, then back along the ceiling.
    const edge = sliceGamutEdge('ch', fixed, limit, n, cMax);
    return [[{ x: 0, y: 1 }, { x: 1, y: 1 }, ...edge.slice().reverse()]];
  }

  // 'lh': at each hue, the lightness window that can hold this chroma. Scan
  // coarsely for the window, then bisect each end into the gap beside it — one
  // bisection per end per column rather than per sample.
  const c = Math.max(0, fixed);
  const SCAN = 64;
  const holds = (l: number, h: number): boolean => gamutWithin(oklchGamut(l, c, h), limit);
  const window = (h: number): { lo: number; hi: number } | null => {
    let first = -1, last = -1;
    for (let i = 0; i <= SCAN; i++) {
      if (holds(i / SCAN, h)) { if (first < 0) first = i; last = i; }
    }
    if (first < 0) return null;
    const refine = (inside: number, outside: number): number => {
      let a = inside, b = outside;
      for (let k = 0; k < 20; k++) {
        const mid = (a + b) / 2;
        if (holds(mid, h)) a = mid; else b = mid;
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
