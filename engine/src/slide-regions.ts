// SPDX-License-Identifier: MPL-2.0
/**
 * Region finding for a flattened slide (plan 274 section 6, point 1): a picture
 * of a whole slide in, a list of boxes out, each classed as text, picture, rule
 * or panel with the numbers behind the class. Block detection comes before
 * recognition, because a slide is boxes and whole-page OCR imposes one reading
 * order on it and loses the grouping.
 *
 * The method, in order:
 *
 *   1. Background. The most common colour on the picture's border (5 bits per
 *      channel), or, when the page is a gradient, a quadratic surface fitted
 *      through the border samples; and a threshold raised above the border's
 *      own noise, so a picture with compression speckle does not come back as
 *      one region.
 *   2. Ink mask on a coarse cell grid (at most 480 cells on the long side): a
 *      pixel is ink when its summed channel difference from the background is
 *      over the threshold; a cell is on when it holds at least an eighth of a
 *      cell's pixels of ink, which ignores single noise pixels.
 *   3. Rules. Long runs of on cells whose ink count is even along the run (a
 *      drawn line has a constant thickness, a word does not), stacked no more
 *      than a few cells deep, become rule regions and leave the mask, so a table's
 *      lines do not glue its cells into one block.
 *   4. Coarse blur. A separable dilation, wider than tall, joins letters into
 *      words and words into lines without joining one line to the next.
 *   5. Components. The blurred grid is labelled; each blurred component collects
 *      the unblurred components inside it, which is where "many small parts in
 *      rows" is measured. When one of those parts is a panel by itself (a band
 *      with a caption just under it), it is split off, and the other parts are
 *      grouped again by the blur's reach, so the band's box is the band's.
 *   6. Class. Many colours that are not a blend of one ink and its ground is
 *      continuous tone, a picture (anti-aliased text is only such blends). A dense block
 *      of one colour is a panel, whose inside is searched again against the
 *      panel's own colour (white title text on a coloured band is invisible
 *      against a white page). Small parts in rows is text. A long thin run was
 *      already a rule. Everything else is kept as a picture, the safe answer.
 *      A region lying in a panel's hole (a window knocked out of a band) is left
 *      to the panel's own search, so no pixel has two regions.
 *   7. Proximity merge. Text beside text on one row, and text lines stacked at a
 *      line's gap, merge into blocks when their ink colours agree; boxes that
 *      overlap merge, and a merge with a picture stays a picture, so no pixel is
 *      claimed twice.
 *
 * Work is bounded for a 1920 by 1080 page: every pass reads each pixel of its
 * area once and a panel's inside is read again at most `maxDepth` times (2 by
 * default), so at most 3 x 2,073,600 pixel reads for the masks, plus at most
 * 4,096 sampled pixels per region for the colour statistics (256 regions by
 * default, about 1 million more). The cell grid is at most 480 by 270 cells per
 * pass, and every grid step is linear in cells. Trimming a region's box from
 * cell edges to pixel edges reads at most 2 x cell x (w + h) pixels per region. Splitting a panel from its
 * neighbours is quadratic in the parts of that one blurred component, and proximity merging is quadratic
 * in the regions of one pass, which is capped at four times `maxRegions` before
 * merging starts; past that cap the result says it is incomplete rather than
 * working on.
 *
 * A caller that located the text first (a text detector over the whole page,
 * plan 275 WP10) passes the line boxes as `mask`: every masked pixel reads as a
 * blend of its unmasked neighbours, so the passes find pictures, panels and
 * rules with the text gone. The helpers after the entry point serve that
 * reading: `maskedImageOf` (the same masked pixels), `textBoundsOf` and
 * `outlineColourOf` (a line's own size and ground on a photograph),
 * `largestFreeBox` (the part of a picture no text crosses), `detailShare`
 * (a drawing against plain ground), `inkAbove` (the icon standing over a label)
 * and `outlinedBoxes` (four rules drawing one box).
 *
 * Pure and deterministic: no DOM, no clock, no randomness, integer ids from
 * position order. It reports what it measured; it never runs OCR and never
 * decides what a region should become, which is the caller's review.
 */

/** A plain 8-bit RGBA frame, the shape a canvas `getImageData` gives. */
export interface RgbaImageV1 {
  width: number;
  height: number;
  /** RGBA interleaved, length `width * height * 4`. */
  data: Uint8ClampedArray | Uint8Array;
}

/** An axis-aligned box in the picture's own pixels, origin top left. */
export interface RegionBoxV1 {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type SlideRegionKindV1 = 'text' | 'picture' | 'rule' | 'panel';

/** Why a region got its class, as a stable code. */
export type SlideRegionReasonV1 =
  | 'continuous-tone'
  | 'flat-fill'
  | 'components-in-rows'
  | 'single-line'
  | 'long-thin'
  | 'compact-mark'
  | 'large-mixed'
  | 'merged-overlap';

/** The numbers a class was read from. Every field is a measurement, not a verdict. */
export interface SlideRegionEvidenceV1 {
  reason: SlideRegionReasonV1;
  /** Unblurred ink components inside the region. */
  components: number;
  /** Rows holding two or more of those components. */
  rows: number;
  /** Share of components that sit in such a row. */
  inRowShare: number;
  /** Median component height in px: a line's height for text. */
  lineHeight: number;
  /** Ink pixels over the box area. */
  inkShare: number;
  /** Share of sampled ink pixels close to the most common colour (within 36, summed channels). */
  dominantShare: number;
  /** Distinct colours (4 bits per channel) among the sampled ink pixels. */
  distinctColours: number;
  /** Share of sampled ink pixels that are neither the main ink, the ground nor a blend of the two: high for a photograph. */
  otherColourShare: number;
  /** Ink pixels sampled for the two colour numbers. */
  samples: number;
  /** Long side over short side of the box. */
  aspect: number;
  /** Mean colour of the most common ink colour, `#rrggbb`: text colour, panel fill, rule colour. */
  ink: string;
  /** The ground the region was measured against, `#rrggbb`: the page, or a panel's fill. */
  ground: string;
  /** For a rule. */
  orientation?: 'horizontal' | 'vertical';
}

export interface SlideRegionV1 {
  /** `r<N>` at the top level in position order, `<parent id>.<N>` inside a panel. */
  id: string;
  kind: SlideRegionKindV1;
  box: RegionBoxV1;
  /** 0 at the top level, one more for each panel it was found inside. */
  depth: number;
  /** The panel this region was found inside. */
  parent?: string;
  evidence: SlideRegionEvidenceV1;
}

export interface SlideRegionsV1 {
  width: number;
  height: number;
  /** The page background, `#rrggbb`: the modal border colour. */
  background: string;
  /** `surface` when the ground was a gradient fitted through the border rather than one colour. */
  backgroundModel: 'flat' | 'surface';
  /**
   * With a `surface` ground: the fitted quadratic per channel (red, green, blue),
   * six coefficients each over `1, u, v, u*u, v*v, u*v` with `u` and `v` the
   * position over the page from 0 to 1. `groundOfRegion` turns it back into the
   * ground a top-level region was measured against.
   */
  surface?: number[][];
  /** Summed channel difference over which a pixel counts as ink. */
  threshold: number;
  /** Cell edge in px on the top-level grid. */
  cell: number;
  /** Parent before children, top-level regions in position order. */
  regions: SlideRegionV1[];
  /** False when a cap was reached; the caller should keep the whole picture then. */
  complete: boolean;
  /** Regions left out because a cap was reached. */
  dropped: number;
  /** Isolated specks of one or two cells, ignored as noise. */
  specks: number;
  work: { pixelReads: number; cellVisits: number };
}

export interface SlideRegionOptsV1 {
  /** Exact ink threshold (summed channel difference, 0..765). Absent: adapted to the border's noise, at least 30. */
  threshold?: number;
  /** The page background as `#rrggbb`, when the caller knows it. Absent: read from the border. */
  background?: string;
  /** Most regions returned before the result is marked incomplete. Default 256. */
  maxRegions?: number;
  /** How many panels deep the search goes. Default 2. */
  maxDepth?: number;
  /** Cells on the long side of a pass's grid. Default 480. */
  gridCells?: number;
  /**
   * Boxes whose pixels are left out of every reading, for a caller that already
   * located the text (a text detector's line boxes). Each masked pixel reads as
   * a blend of the nearest unmasked pixels to its left, right, top and bottom, so
   * a panel under masked text stays one fill, a photograph stays continuous
   * tone, and an illustration beside the text is boxed without it. The image
   * passed in is not changed.
   */
  mask?: RegionBoxV1[];
}

// ─── tuning, every number named ─────────────────────────────────────────────

const DEFAULT_GRID_CELLS = 480;
const DEFAULT_MAX_REGIONS = 256;
const DEFAULT_MAX_DEPTH = 2;
/** Lowest adaptive threshold, which a clean page gets. */
const MIN_THRESHOLD = 30;
/** Highest adaptive threshold, so a very noisy border cannot hide real content. */
const MAX_THRESHOLD = 120;
/** The adaptive threshold is this many times the border's 90th percentile noise. */
const NOISE_FACTOR = 2.5;
/** Cell edge in px of a gradient ground's colour grid. */
const SURFACE_STEP = 16;
/** A border sample within this summed difference of a ground counts as explained by it. */
const SURFACE_INLIER = 24;
/** A surface must explain at least this share of the border: a band touching one edge is content, not a gradient. */
const SURFACE_MIN_INLIERS = 0.9;
/** A surface is only tried when the flat ground misses the border by more than this. */
const SURFACE_MIN_GAIN = 6;
/** And only kept when it misses by less than this share of the flat ground's miss. */
const SURFACE_BETTER = 0.6;
/** Border samples further than this from the background are content, not noise. */
const NOISE_CEILING = 96;
/** Border and colour samples per pass or region. */
const SAMPLE_CAP = 4096;
/** Horizontal blur radius as a share of the page width: joins letters and words. */
const BLUR_X_SHARE = 0.006;
/** Vertical blur radius as a share of the page height: keeps lines apart. */
const BLUR_Y_SHARE = 0.004;
/** A rule is at least this share of the page's width (or height, for a vertical rule). */
const RULE_MIN_SHARE = 0.08;
/** A rule is at most this share of the page height thick. */
const RULE_MAX_THICK_SHARE = 0.008;
/** A component filling less of its box than this is searched for grid lines. */
const GRID_MAX_FILL = 0.6;
/** Largest coefficient of variation of ink per cell along a rule. */
const RULE_MAX_CV = 0.5;
/** A panel is at least this dense. */
const PANEL_MIN_INK = 0.8;
/** A panel's most common colour holds at least this share of its ink. */
const PANEL_MIN_DOMINANT = 0.6;
/** A panel covers at least this share of the page. */
const PANEL_MIN_AREA_SHARE = 0.01;
/** Continuous tone: at least this many distinct colours... */
const TONE_MIN_DISTINCT = 24;
/** ...and at least this share of samples off the ink-to-ground blend line. */
const TONE_MIN_OTHER_SHARE = 0.3;
/** A sample this close (summed channels) to the main ink counts as that colour, so a subtle gradient still reads as one fill. */
const NEAR_INK = 36;
/** A sample further than this (summed channels) from the ink-to-ground blend line is another colour. */
const BLEND_MISS = 48;
/** A text line is at most this share of the page height tall. */
const TEXT_MAX_LINE_SHARE = 0.2;
/** Text leaves most of its box empty. */
const TEXT_MAX_INK = 0.7;
/** Share of components that must sit in rows for a text reading. */
const TEXT_MIN_ROW_SHARE = 0.6;
/** One blurred word or line on its own: wider than this... */
const SINGLE_LINE_MIN_ASPECT = 2;
/** ...and no taller than this share of the page. */
const SINGLE_LINE_MAX_SHARE = 0.12;
/** Below this share of the page, a region nothing else claims is a mark kept as a picture. */
const MARK_MAX_AREA_SHARE = 0.02;
/** Text on one row merges across a gap up to this many line heights. */
const ROW_GAP_LINES = 1.5;
/** Stacked text lines merge across a gap up to this many line heights. */
const STACK_GAP_LINES = 1.5;
/** Text regions with more than this share of other colours do not merge by proximity. */
const MERGE_MAX_OTHER = 0.15;
/** Two text regions whose line heights differ by more than this ratio stay apart. */
const MERGE_MAX_HEIGHT_RATIO = 1.6;
/** Two text regions whose ink colours differ by more than this (summed channels) stay apart: a coloured lead-in is its own block. */
const MERGE_MAX_INK_DIFF = 2 * NEAR_INK;
/** Samples of a colour reading over a box handed in by a caller. */
const COLOUR_SAMPLE_CAP = 65536;
/** A rule with at least this share of its box inside a region is part of that region. */
const RULE_ABSORB_SHARE = 0.5;
/** Proximity merge rounds before the merge stops. */
const MAX_MERGE_ROUNDS = 32;
// ─── small helpers ───────────────────────────────────────────────────────────

type Rgb = [number, number, number];

function hexOf(c: Rgb): string {
  const h = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(c[0])}${h(c[1])}${h(c[2])}`;
}

/** `#rrggbb` to a colour, or null when the text is not one. */
function rgbOfHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m || m[1] === undefined) return null;
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function intersects(a: RegionBoxV1, b: RegionBoxV1): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function union(a: RegionBoxV1, b: RegionBoxV1): RegionBoxV1 {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

// ─── background ──────────────────────────────────────────────────────────────

/**
 * The ground a pass measures ink against, as colours on a coarse grid: one cell
 * for a flat page or a panel's fill, a grid of `SURFACE_STEP` px cells for a
 * page whose ground is a gradient.
 */
interface GroundModel {
  cols: number;
  rows: number;
  step: number;
  rgb: Float32Array;
}

function flatGround(c: Rgb): GroundModel {
  return { cols: 1, rows: 1, step: 1 << 30, rgb: Float32Array.from(c) };
}

function groundBase(g: GroundModel, px: number, py: number): number {
  const cx = Math.min(g.cols - 1, Math.max(0, Math.floor(px / g.step)));
  const cy = Math.min(g.rows - 1, Math.max(0, Math.floor(py / g.step)));
  return (cy * g.cols + cx) * 3;
}

function groundRgb(g: GroundModel, px: number, py: number): Rgb {
  const k = groundBase(g, px, py);
  return [g.rgb[k] ?? 0, g.rgb[k + 1] ?? 0, g.rgb[k + 2] ?? 0];
}

interface Ground {
  model: GroundModel;
  /** The surface coefficients, for a `surface` ground. */
  coef?: number[][];
  /** The modal border colour: what `background` reports. */
  base: Rgb;
  kind: 'flat' | 'surface';
  threshold: number;
  reads: number;
}

/** Solve a small dense system by Gaussian elimination with partial pivoting; null when singular. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i] ?? 0]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r]?.[col] ?? 0) > Math.abs(m[pivot]?.[col] ?? 0)) pivot = r;
    const top = m[pivot];
    if (!top || Math.abs(top[col] ?? 0) < 1e-9) return null;
    m[pivot] = m[col] ?? top;
    m[col] = top;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const row = m[r];
      if (!row) continue;
      const f = (row[col] ?? 0) / (top[col] ?? 1);
      for (let k = col; k <= n; k++) row[k] = (row[k] ?? 0) - f * (top[k] ?? 0);
    }
  }
  return m.map((row, i) => (row[n] ?? 0) / (row[i] ?? 1));
}

/** The six terms of the ground surface at a normalised position. */
function terms(u: number, v: number): number[] {
  return [1, u, v, u * u, v * v, u * v];
}

/**
 * A quadratic surface per channel through the border samples, refitted twice
 * without the samples it explains worst, so content touching the edge does not
 * bend it. Null when the system is singular.
 */
function fitSurface(points: Array<{ u: number; v: number; c: Rgb }>): { coef: number[][]; residuals: number[] } | null {
  let kept = points;
  let coef: number[][] = [];
  for (let pass = 0; pass < 3; pass++) {
    if (kept.length < 12) return null;
    const ata = Array.from({ length: 6 }, () => new Array<number>(6).fill(0));
    const atb = [new Array<number>(6).fill(0), new Array<number>(6).fill(0), new Array<number>(6).fill(0)];
    for (const p of kept) {
      const t = terms(p.u, p.v);
      for (let i = 0; i < 6; i++) {
        const ti = t[i] ?? 0;
        const row = ata[i];
        if (row) for (let j = 0; j < 6; j++) row[j] = (row[j] ?? 0) + ti * (t[j] ?? 0);
        for (let ch = 0; ch < 3; ch++) {
          const target = atb[ch];
          if (target) target[i] = (target[i] ?? 0) + ti * (p.c[ch] ?? 0);
        }
      }
    }
    const next: number[][] = [];
    for (let ch = 0; ch < 3; ch++) {
      const solved = solve(ata, atb[ch] ?? []);
      if (!solved) return null;
      next.push(solved);
    }
    coef = next;
    const res = points.map((p) => surfaceResidual(coef, p));
    const cut = Math.max(12, 2.5 * median(res));
    kept = points.filter((_, i) => (res[i] ?? 0) <= cut);
  }
  return { coef, residuals: points.map((p) => surfaceResidual(coef, p)) };
}

function surfaceAt(coef: number[][], u: number, v: number): Rgb {
  const t = terms(u, v);
  const at = (ch: number): number => {
    const c = coef[ch] ?? [];
    let sum = 0;
    for (let i = 0; i < 6; i++) sum += (c[i] ?? 0) * (t[i] ?? 0);
    return Math.max(0, Math.min(255, sum));
  };
  return [at(0), at(1), at(2)];
}

function surfaceResidual(coef: number[][], p: { u: number; v: number; c: Rgb }): number {
  const s = surfaceAt(coef, p.u, p.v);
  return Math.abs(s[0] - p.c[0]) + Math.abs(s[1] - p.c[1]) + Math.abs(s[2] - p.c[2]);
}

/** Mean residual with each sample capped at `NOISE_CEILING`, so content on the edge weighs the same for both grounds. */
function clippedMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + Math.min(NOISE_CEILING, v), 0) / values.length;
}

/** A share of a sorted list, by rank. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
}

/**
 * The page ground: the modal border colour, or a quadratic surface through the
 * border when the page is a gradient and the surface explains the border
 * clearly better. The threshold is set above the chosen model's own noise.
 */
function estimateGround(image: RgbaImageV1, opts: SlideRegionOptsV1): Ground {
  const { width: w, height: h, data } = image;
  const perimeter = 2 * (w + h);
  const step = Math.max(1, Math.ceil(perimeter / SAMPLE_CAP));
  const points: Array<{ u: number; v: number; c: Rgb }> = [];
  const push = (x: number, y: number): void => {
    const i = (y * w + x) * 4;
    if ((data[i + 3] ?? 255) < 128) return;
    points.push({ u: x / Math.max(1, w - 1), v: y / Math.max(1, h - 1), c: [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0] });
  };
  for (let x = 0; x < w; x += step) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y += step) {
    push(0, y);
    push(w - 1, y);
  }
  let base: Rgb = [255, 255, 255];
  const given = opts.background ? rgbOfHex(opts.background) : null;
  if (given) {
    base = given;
  } else if (points.length > 0) {
    const bins = new Map<number, Rgb[]>();
    for (const p of points) {
      const key = ((p.c[0] >> 3) << 10) | ((p.c[1] >> 3) << 5) | (p.c[2] >> 3);
      const list = bins.get(key);
      if (list) list.push(p.c);
      else bins.set(key, [p.c]);
    }
    // The largest bin, ties broken by the lower key, so the answer never rests on map order.
    let bestKey = -1;
    let best: Rgb[] = [];
    for (const [key, list] of bins) {
      if (list.length > best.length || (list.length === best.length && key < bestKey)) {
        best = list;
        bestKey = key;
      }
    }
    const sum = best.reduce<Rgb>((acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]], [0, 0, 0]);
    base = [sum[0] / best.length, sum[1] / best.length, sum[2] / best.length];
  }
  const flatRes = points
    .map((p) => Math.abs(p.c[0] - base[0]) + Math.abs(p.c[1] - base[1]) + Math.abs(p.c[2] - base[2]))
    .sort((a, b) => a - b);
  let model = flatGround(base);
  let coef: number[][] | undefined;
  let kind: Ground['kind'] = 'flat';
  let residuals = flatRes;
  const flatTypical = clippedMean(flatRes);
  if (!given && flatTypical > SURFACE_MIN_GAIN) {
    const fit = fitSurface(points);
    if (fit) {
      const surfaceRes = [...fit.residuals].sort((a, b) => a - b);
      const share = (list: number[]): number => list.filter((d) => d <= SURFACE_INLIER).length / Math.max(1, list.length);
      if (clippedMean(surfaceRes) < SURFACE_BETTER * flatTypical && share(surfaceRes) >= SURFACE_MIN_INLIERS) {
        model = surfaceModel(fit.coef, w, h);
        coef = fit.coef;
        kind = 'surface';
        residuals = surfaceRes;
      }
    }
  }
  let threshold: number;
  if (typeof opts.threshold === 'number' && Number.isFinite(opts.threshold)) {
    threshold = Math.max(1, Math.min(765, opts.threshold));
  } else {
    const noise = residuals.filter((d) => d <= NOISE_CEILING);
    threshold = Math.round(Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, quantile(noise, 0.9) * NOISE_FACTOR)));
  }
  const out: Ground = { model, base, kind, threshold, reads: points.length };
  if (coef) out.coef = coef;
  return out;
}

/** A fitted surface sampled on the `SURFACE_STEP` grid the passes read the ground from. */
function surfaceModel(coef: number[][], w: number, h: number): GroundModel {
  const cols = Math.max(1, Math.ceil(w / SURFACE_STEP));
  const rows = Math.max(1, Math.ceil(h / SURFACE_STEP));
  const rgb = new Float32Array(cols * rows * 3);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const c = surfaceAt(
        coef,
        Math.min(1, ((cx + 0.5) * SURFACE_STEP) / Math.max(1, w - 1)),
        Math.min(1, ((cy + 0.5) * SURFACE_STEP) / Math.max(1, h - 1)),
      );
      rgb.set(c, (cy * cols + cx) * 3);
    }
  }
  return { cols, rows, step: SURFACE_STEP, rgb };
}

// ─── one pass over an area ───────────────────────────────────────────────────

interface PassInput {
  image: RgbaImageV1;
  /** Area in image px. */
  x0: number;
  y0: number;
  w: number;
  h: number;
  ground: GroundModel;
  threshold: number;
  /** Restricts the pass to pixels inside a panel. */
  inside?: (px: number, py: number) => boolean;
  depth: number;
  gridCells: number;
}

interface Stats {
  samples: number;
  dominantShare: number;
  distinct: number;
  ink: Rgb;
  /** Share of samples that are neither the main colour, the ground nor a blend of the two. */
  otherShare: number;
}

/** A region under construction, with the raw facts merging needs. */
interface Candidate {
  kind: SlideRegionKindV1;
  reason: SlideRegionReasonV1;
  box: RegionBoxV1;
  ink: number;
  components: number;
  rows: number;
  inRow: number;
  lineHeight: number;
  stats: Stats;
  orientation?: 'horizontal' | 'vertical';
  /** For a panel: whether a pixel lies inside it (holes filled, surroundings excluded). */
  inside?: (px: number, py: number) => boolean;
}

interface PassResult {
  candidates: Candidate[];
  overflow: boolean;
  /** Components the pass found, including those past a cap. */
  seen: number;
  specks: number;
  reads: number;
  cells: number;
}

/** Summed channel difference of one pixel from the ground under it; a transparent pixel is ground. */
function inkAt(data: RgbaImageV1['data'], i: number, g: GroundModel, px: number, py: number): number {
  if ((data[i + 3] ?? 255) < 128) return 0;
  const k = g.cols === 1 && g.rows === 1 ? 0 : groundBase(g, px, py);
  return (
    Math.abs((data[i] ?? 0) - (g.rgb[k] ?? 0)) +
    Math.abs((data[i + 1] ?? 0) - (g.rgb[k + 1] ?? 0)) +
    Math.abs((data[i + 2] ?? 0) - (g.rgb[k + 2] ?? 0))
  );
}

/**
 * Trim a cell-aligned box to the pixels: each side moves in while its outermost
 * row or column holds no ink, by less than one cell. At most 2 x cell x (w + h)
 * pixel reads.
 */
function tighten(pass: PassInput, box: RegionBoxV1, cell: number, counter: { reads: number }): RegionBoxV1 {
  const { image, ground, threshold, inside } = pass;
  const inkIn = (x0: number, y0: number, x1: number, y1: number): boolean => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        counter.reads++;
        if (inside && !inside(x, y)) continue;
        if (inkAt(image.data, (y * image.width + x) * 4, ground, x, y) > threshold) return true;
      }
    }
    return false;
  };
  let { x, y, w, h } = box;
  for (let k = 0; k < cell - 1 && h > 1 && !inkIn(x, y, x + w, y + 1); k++) {
    y++;
    h--;
  }
  for (let k = 0; k < cell - 1 && h > 1 && !inkIn(x, y + h - 1, x + w, y + h); k++) h--;
  for (let k = 0; k < cell - 1 && w > 1 && !inkIn(x, y, x + 1, y + h); k++) {
    x++;
    w--;
  }
  for (let k = 0; k < cell - 1 && w > 1 && !inkIn(x + w - 1, y, x + w, y + h); k++) w--;
  return { x, y, w, h };
}

/** Colour statistics over the ink pixels of one box, at most `SAMPLE_CAP` samples. */
function colourStats(pass: PassInput, box: RegionBoxV1, counter: { reads: number }): Stats {
  const { image, ground, threshold, inside } = pass;
  const area = box.w * box.h;
  const stride = Math.max(1, Math.ceil(Math.sqrt(area / SAMPLE_CAP)));
  const counts = new Map<number, number>();
  const sums = new Map<number, Rgb>();
  const seen: Array<{ i: number; x: number; y: number }> = [];
  let samples = 0;
  for (let y = box.y; y < box.y + box.h; y += stride) {
    for (let x = box.x; x < box.x + box.w; x += stride) {
      counter.reads++;
      if (inside && !inside(x, y)) continue;
      const i = (y * image.width + x) * 4;
      if (inkAt(image.data, i, ground, x, y) <= threshold) continue;
      const r = image.data[i] ?? 0;
      const g = image.data[i + 1] ?? 0;
      const b = image.data[i + 2] ?? 0;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      const s = sums.get(key);
      if (s) {
        s[0] += r;
        s[1] += g;
        s[2] += b;
      } else {
        sums.set(key, [r, g, b]);
      }
      seen.push({ i, x, y });
      samples++;
    }
  }
  let bestKey = -1;
  let best = 0;
  for (const [key, n] of counts) {
    if (n > best || (n === best && key < bestKey)) {
      best = n;
      bestKey = key;
    }
  }
  const sum = sums.get(bestKey);
  const ink: Rgb = sum && best > 0 ? [sum[0] / best, sum[1] / best, sum[2] / best] : groundRgb(ground, box.x + box.w / 2, box.y + box.h / 2);
  // Anti-aliased text is its ink, its ground and blends between them: points on
  // one segment in colour space. A photograph's colours fall off that segment.
  let other = 0;
  let near = 0;
  for (const { i, x, y } of seen) {
    const r = image.data[i] ?? 0;
    const gg = image.data[i + 1] ?? 0;
    const b = image.data[i + 2] ?? 0;
    if (Math.abs(r - ink[0]) + Math.abs(gg - ink[1]) + Math.abs(b - ink[2]) <= NEAR_INK) near++;
    const g = groundRgb(ground, x, y);
    const d: Rgb = [ink[0] - g[0], ink[1] - g[1], ink[2] - g[2]];
    const p: Rgb = [(image.data[i] ?? 0) - g[0], (image.data[i + 1] ?? 0) - g[1], (image.data[i + 2] ?? 0) - g[2]];
    const len = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
    const t = len > 0 ? Math.max(0, Math.min(1, (p[0] * d[0] + p[1] * d[1] + p[2] * d[2]) / len)) : 0;
    const miss = Math.abs(p[0] - t * d[0]) + Math.abs(p[1] - t * d[1]) + Math.abs(p[2] - t * d[2]);
    if (miss > BLEND_MISS) other++;
  }
  return { samples, dominantShare: samples ? near / samples : 0, distinct: counts.size, ink, otherShare: samples ? other / samples : 0 };
}

/**
 * Label a cell mask. `eight` picks 8-connectivity. Returns the label per cell
 * (-1 off) and per label its cell box and cell count, in first-seen order.
 */
function label(
  on: Uint8Array,
  gw: number,
  gh: number,
  eight: boolean,
): { labels: Int32Array; boxes: Array<{ x0: number; y0: number; x1: number; y1: number; cells: number }> } {
  const labels = new Int32Array(gw * gh).fill(-1);
  const stack = new Int32Array(gw * gh);
  const boxes: Array<{ x0: number; y0: number; x1: number; y1: number; cells: number }> = [];
  for (let start = 0; start < on.length; start++) {
    if (!on[start] || (labels[start] ?? 0) >= 0) continue;
    const id = boxes.length;
    const box = { x0: gw, y0: gh, x1: -1, y1: -1, cells: 0 };
    let top = 0;
    stack[top++] = start;
    labels[start] = id;
    while (top > 0) {
      const c = stack[--top] ?? 0;
      const cx = c % gw;
      const cy = (c - cx) / gw;
      box.cells++;
      if (cx < box.x0) box.x0 = cx;
      if (cx > box.x1) box.x1 = cx;
      if (cy < box.y0) box.y0 = cy;
      if (cy > box.y1) box.y1 = cy;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= gh) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (!eight && dx !== 0 && dy !== 0) continue;
          const nx = cx + dx;
          if (nx < 0 || nx >= gw) continue;
          const n = ny * gw + nx;
          if (on[n] && (labels[n] ?? 0) < 0) {
            labels[n] = id;
            stack[top++] = n;
          }
        }
      }
    }
    boxes.push(box);
  }
  return { labels, boxes };
}

/** Rule cells: long, even runs of ink, stacked no more than `thick` cells deep. */
function ruleCells(
  on: Uint8Array,
  count: Uint16Array,
  gw: number,
  gh: number,
  minRun: number,
  thick: number,
  horizontal: boolean,
): Uint8Array {
  const cand = new Uint8Array(gw * gh);
  const along = horizontal ? gw : gh;
  const across = horizontal ? gh : gw;
  const idx = (a: number, b: number): number => (horizontal ? b * gw + a : a * gw + b);
  for (let b = 0; b < across; b++) {
    let a = 0;
    while (a < along) {
      if (!on[idx(a, b)]) {
        a++;
        continue;
      }
      const start = a;
      let sum = 0;
      let sq = 0;
      while (a < along && on[idx(a, b)]) {
        const v = count[idx(a, b)] ?? 0;
        sum += v;
        sq += v * v;
        a++;
      }
      const len = a - start;
      if (len < minRun) continue;
      const mean = sum / len;
      const sd = Math.sqrt(Math.max(0, sq / len - mean * mean));
      if (mean > 0 && sd / mean <= RULE_MAX_CV) for (let k = start; k < a; k++) cand[idx(k, b)] = 1;
    }
  }
  // Only a thin stack of long runs is a rule: a panel or a photo stacks them deep.
  const out = new Uint8Array(gw * gh);
  for (let a = 0; a < along; a++) {
    let b = 0;
    while (b < across) {
      if (!cand[idx(a, b)]) {
        b++;
        continue;
      }
      const start = b;
      while (b < across && cand[idx(a, b)]) b++;
      if (b - start <= thick) for (let k = start; k < b; k++) out[idx(a, k)] = 1;
    }
  }
  return out;
}

/** Whether a thin component's ink is even along its length, as a drawn line's is. */
function evenAlong(
  labels: Int32Array,
  id: number,
  count: Uint16Array,
  b: { x0: number; y0: number; x1: number; y1: number },
  gw: number,
  horizontal: boolean,
): boolean {
  const sums: number[] = [];
  const along0 = horizontal ? b.x0 : b.y0;
  const along1 = horizontal ? b.x1 : b.y1;
  for (let a = along0; a <= along1; a++) {
    let sum = 0;
    const from = horizontal ? b.y0 : b.x0;
    const to = horizontal ? b.y1 : b.x1;
    for (let k = from; k <= to; k++) {
      const c = horizontal ? k * gw + a : a * gw + k;
      if (labels[c] === id) sum += count[c] ?? 0;
    }
    sums.push(sum);
  }
  const mean = sums.reduce((s, v) => s + v, 0) / Math.max(1, sums.length);
  if (mean <= 0) return false;
  const variance = sums.reduce((s, v) => s + (v - mean) * (v - mean), 0) / sums.length;
  return Math.sqrt(variance) / mean <= RULE_MAX_CV;
}

/** Dilate a mask by `rx` cells across and `ry` cells down, with running sums. */
function dilate(on: Uint8Array, gw: number, gh: number, rx: number, ry: number): Uint8Array {
  const mid = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) {
    let run = 0;
    for (let x = 0; x < Math.min(gw, rx); x++) run += on[y * gw + x] ?? 0;
    for (let x = 0; x < gw; x++) {
      if (x + rx < gw) run += on[y * gw + x + rx] ?? 0;
      if (x - rx - 1 >= 0) run -= on[y * gw + x - rx - 1] ?? 0;
      mid[y * gw + x] = run > 0 ? 1 : 0;
    }
  }
  const out = new Uint8Array(gw * gh);
  for (let x = 0; x < gw; x++) {
    let run = 0;
    for (let y = 0; y < Math.min(gh, ry); y++) run += mid[y * gw + x] ?? 0;
    for (let y = 0; y < gh; y++) {
      if (y + ry < gh) run += mid[(y + ry) * gw + x] ?? 0;
      if (y - ry - 1 >= 0) run -= mid[(y - ry - 1) * gw + x] ?? 0;
      out[y * gw + x] = run > 0 ? 1 : 0;
    }
  }
  return out;
}

/** Group component centres into rows; returns (rows with two or more, components in them). */
function rowsOf(parts: Array<{ cy: number; h: number }>): { rows: number; inRow: number } {
  const sorted = [...parts].sort((a, b) => a.cy - b.cy || a.h - b.h);
  let rows = 0;
  let inRow = 0;
  let current: Array<{ cy: number; h: number }> = [];
  const close = (): void => {
    if (current.length >= 2) {
      rows++;
      inRow += current.length;
    }
  };
  for (const part of sorted) {
    if (current.length > 0) {
      const cy = current.reduce((s, p) => s + p.cy, 0) / current.length;
      const h = median(current.map((p) => p.h));
      if (Math.abs(part.cy - cy) <= 0.5 * Math.max(part.h, h)) {
        current.push(part);
        continue;
      }
      close();
    }
    current = [part];
  }
  close();
  return { rows, inRow };
}

function runPass(pass: PassInput, page: { w: number; h: number }, maxCandidates: number): PassResult {
  const { image, x0, y0, w, h, ground, threshold, inside } = pass;
  const cell = Math.max(1, Math.ceil(Math.max(w, h) / pass.gridCells));
  const gw = Math.max(1, Math.ceil(w / cell));
  const gh = Math.max(1, Math.ceil(h / cell));
  const count = new Uint16Array(gw * gh);
  let reads = 0;
  let cellsSeen = 0;
  const data = image.data;
  for (let py = y0; py < y0 + h; py++) {
    const cy = Math.floor((py - y0) / cell);
    for (let px = x0; px < x0 + w; px++) {
      reads++;
      if (inside && !inside(px, py)) continue;
      if (inkAt(data, (py * image.width + px) * 4, ground, px, py) > threshold) {
        const c = cy * gw + Math.floor((px - x0) / cell);
        count[c] = (count[c] ?? 0) + 1;
      }
    }
  }
  const minCount = Math.max(1, Math.ceil((cell * cell) / 8));
  const on = new Uint8Array(gw * gh);
  for (let c = 0; c < on.length; c++) on[c] = (count[c] ?? 0) >= minCount ? 1 : 0;

  // Rules first, so a table's lines do not join its cells. A component that is
  // thin and long as a whole is a rule when its ink is even along its length; a
  // sparse, long component (a table grid, or an underline that touches letters)
  // gives up its long even runs. A dense component is never searched for rules,
  // so the strips of a band between knocked-out letters stay part of the band.
  const hMin = Math.max(8, Math.round((RULE_MIN_SHARE * page.w) / cell));
  const vMin = Math.max(8, Math.round((RULE_MIN_SHARE * page.h) / cell));
  const thick = Math.max(2, Math.ceil((RULE_MAX_THICK_SHARE * page.h) / cell));
  const hRule = new Uint8Array(gw * gh);
  const vRule = new Uint8Array(gw * gh);
  const sparse = new Uint8Array(gw * gh);
  const pre = label(on, gw, gh, true);
  pre.boxes.forEach((b, id) => {
    const bw = b.x1 - b.x0 + 1;
    const bh = b.y1 - b.y0 + 1;
    const flat = bh <= thick && bw >= hMin && evenAlong(pre.labels, id, count, b, gw, true);
    const upright = !flat && bw <= thick && bh >= vMin && evenAlong(pre.labels, id, count, b, gw, false);
    const grid = !flat && !upright && (bw >= hMin || bh >= vMin) && b.cells / (bw * bh) < GRID_MAX_FILL;
    if (!flat && !upright && !grid) return;
    const target = flat ? hRule : upright ? vRule : sparse;
    for (let cy = b.y0; cy <= b.y1; cy++) {
      for (let cx = b.x0; cx <= b.x1; cx++) if (pre.labels[cy * gw + cx] === id) target[cy * gw + cx] = 1;
    }
  });
  const hGrid = ruleCells(sparse, count, gw, gh, hMin, thick, true);
  const vGrid = ruleCells(sparse, count, gw, gh, vMin, thick, false);
  for (let c = 0; c < on.length; c++) {
    if (hGrid[c]) hRule[c] = 1;
    if (vGrid[c]) vRule[c] = 1;
    if (hRule[c] || vRule[c]) on[c] = 0;
  }
  cellsSeen += 4 * gw * gh;

  const counter = { reads: 0 };
  const cellBox = (b: { x0: number; y0: number; x1: number; y1: number }): RegionBoxV1 => {
    const x = x0 + b.x0 * cell;
    const y = y0 + b.y0 * cell;
    return { x, y, w: Math.min(x0 + w, x0 + (b.x1 + 1) * cell) - x, h: Math.min(y0 + h, y0 + (b.y1 + 1) * cell) - y };
  };
  const candidates: Candidate[] = [];

  for (const [mask, horizontal] of [
    [hRule, true],
    [vRule, false],
  ] as const) {
    const { labels, boxes } = label(mask, gw, gh, true);
    boxes.forEach((b, id) => {
      const len = horizontal ? b.x1 - b.x0 + 1 : b.y1 - b.y0 + 1;
      if (len < (horizontal ? hMin : vMin)) return;
      let ink = 0;
      for (let cy = b.y0; cy <= b.y1; cy++)
        for (let cx = b.x0; cx <= b.x1; cx++) if (labels[cy * gw + cx] === id) ink += count[cy * gw + cx] ?? 0;
      const box = tighten(pass, cellBox(b), cell, counter);
      candidates.push({
        kind: 'rule',
        reason: 'long-thin',
        box,
        ink,
        components: 1,
        rows: 0,
        inRow: 0,
        lineHeight: horizontal ? box.h : box.w,
        stats: colourStats(pass, box, counter),
        orientation: horizontal ? 'horizontal' : 'vertical',
      });
    });
  }

  const raw = label(on, gw, gh, true);
  const rx = Math.max(1, Math.ceil((BLUR_X_SHARE * page.w) / cell));
  const ry = Math.max(1, Math.ceil((BLUR_Y_SHARE * page.h) / cell));
  const blurred = dilate(on, gw, gh, rx, ry);
  const merged = label(blurred, gw, gh, false);
  let cells = cellsSeen + gw * gh * 4;

  if (merged.boxes.length > maxCandidates) {
    return { candidates: [], overflow: true, specks: 0, reads: reads + counter.reads, cells, seen: merged.boxes.length };
  }

  // Each unblurred component belongs to the blurred component over its first cell.
  const members: Array<Array<{ box: RegionBoxV1; ink: number }>> = merged.boxes.map(() => []);
  const rawInk = new Float64Array(raw.boxes.length);
  for (let c = 0; c < on.length; c++) {
    const r = raw.labels[c] ?? -1;
    if (r >= 0) rawInk[r] = (rawInk[r] ?? 0) + (count[c] ?? 0);
  }
  raw.boxes.forEach((b, r) => {
    const first = (b.y0 * gw + b.x0) | 0;
    // The first cell of the box may be off for an L shape, so search the box for a member cell.
    let owner = -1;
    for (let cy = b.y0; cy <= b.y1 && owner < 0; cy++) {
      for (let cx = b.x0; cx <= b.x1; cx++) {
        const c = cy * gw + cx;
        if (raw.labels[c] === r) {
          owner = merged.labels[c] ?? -1;
          break;
        }
      }
    }
    if (owner < 0) owner = merged.labels[first] ?? -1;
    if (owner >= 0) members[owner]?.push({ box: cellBox(b), ink: rawInk[r] ?? 0 });
  });

  let specks = 0;
  const pageArea = page.w * page.h;
  type Member = { box: RegionBoxV1; ink: number };
  type CellBox = { x0: number; y0: number; x1: number; y1: number };

  /** Class one group of unblurred components; null for a speck. */
  const classify = (parts: Member[], blurredId: number, mb: CellBox): Candidate | null => {
    const firstPart = parts[0];
    if (!firstPart) return null;
    let cellAligned = firstPart.box;
    let ink = 0;
    for (const p of parts) {
      cellAligned = union(cellAligned, p.box);
      ink += p.ink;
    }
    const cellsWide = Math.ceil(cellAligned.w / cell);
    const cellsTall = Math.ceil(cellAligned.h / cell);
    if (parts.length === 1 && cellsWide <= 2 && cellsTall <= 2 && ink <= 2 * minCount) {
      specks++;
      return null;
    }
    const box = tighten(pass, cellAligned, cell, counter);
    const stats = colourStats(pass, box, counter);
    const area = Math.max(1, box.w * box.h);
    const inkShare = ink / area;
    const heights = parts.map((p) => p.box.h);
    const lineHeight = median(heights);
    const { rows, inRow } = rowsOf(parts.map((p) => ({ cy: p.box.y + p.box.h / 2, h: p.box.h })));
    let kind: SlideRegionKindV1;
    let reason: SlideRegionReasonV1;
    const continuous = stats.distinct >= TONE_MIN_DISTINCT && stats.otherShare >= TONE_MIN_OTHER_SHARE;
    if (continuous) {
      kind = 'picture';
      reason = 'continuous-tone';
    } else if (inkShare >= PANEL_MIN_INK && stats.dominantShare >= PANEL_MIN_DOMINANT && area >= PANEL_MIN_AREA_SHARE * pageArea) {
      kind = 'panel';
      reason = 'flat-fill';
    } else if (
      parts.length >= 2 &&
      inRow / parts.length >= TEXT_MIN_ROW_SHARE &&
      lineHeight <= TEXT_MAX_LINE_SHARE * page.h &&
      inkShare <= TEXT_MAX_INK
    ) {
      kind = 'text';
      reason = 'components-in-rows';
    } else if (
      box.w / Math.max(1, box.h) >= SINGLE_LINE_MIN_ASPECT &&
      box.h <= SINGLE_LINE_MAX_SHARE * page.h &&
      inkShare <= TEXT_MAX_INK
    ) {
      kind = 'text';
      reason = 'single-line';
    } else if (area <= MARK_MAX_AREA_SHARE * pageArea) {
      kind = 'picture';
      reason = 'compact-mark';
    } else {
      kind = 'picture';
      reason = 'large-mixed';
    }
    const candidate: Candidate = {
      kind,
      reason,
      box,
      ink,
      components: parts.length,
      rows,
      inRow,
      lineHeight: kind === 'text' && reason === 'single-line' ? box.h : lineHeight,
      stats,
    };
    if (kind === 'panel') candidate.inside = panelInside(merged.labels, blurredId, mb, gw, x0, y0, cell, inside);
    return candidate;
  };

  /**
   * The blur that joins letters into lines also joins a caption to a band just
   * above it. When one member is dense and large enough to be a panel by
   * itself, it is split off with the members inside its box, and the others
   * are grouped again by the blur's own reach, so the band's box stays the
   * band's and the caption is found as text. Null when there is nothing to split.
   */
  const splitPanel = (parts: Member[]): Member[][] | null => {
    if (parts.length < 2) return null;
    let core = parts[0];
    for (const p of parts) if (core && p.ink > core.ink) core = p;
    if (!core) return null;
    const coreArea = Math.max(1, core.box.w * core.box.h);
    if (coreArea < PANEL_MIN_AREA_SHARE * pageArea || core.ink / coreArea < PANEL_MIN_INK) return null;
    const inner: Member[] = [];
    const rest: Member[] = [];
    for (const p of parts) (p === core || insideShare(p.box, core.box) >= RULE_ABSORB_SHARE ? inner : rest).push(p);
    if (rest.length === 0) return null;
    // Members join when their boxes, grown by the blur radii, meet: the blur's reach without the panel.
    const reachX = rx * cell;
    const reachY = ry * cell;
    const owner = rest.map((_, i) => i);
    const find = (i: number): number => {
      let r = i;
      while ((owner[r] ?? r) !== r) r = owner[r] ?? r;
      return r;
    };
    for (let i = 0; i < rest.length; i++) {
      const a = rest[i]?.box;
      if (!a) continue;
      const grown = { x: a.x - reachX, y: a.y - reachY, w: a.w + 2 * reachX, h: a.h + 2 * reachY };
      for (let j = i + 1; j < rest.length; j++) {
        const b = rest[j]?.box;
        if (b && intersects(grown, b)) owner[find(j)] = find(i);
      }
    }
    const groups = new Map<number, Member[]>();
    rest.forEach((p, i) => {
      const r = find(i);
      const list = groups.get(r);
      if (list) list.push(p);
      else groups.set(r, [p]);
    });
    return [inner, ...groups.values()];
  };

  merged.boxes.forEach((mb, id) => {
    const parts = members[id] ?? [];
    if (parts.length === 0) return;
    const groups = splitPanel(parts);
    const head = groups?.[0] ? classify(groups[0], id, mb) : null;
    if (groups && head?.kind === 'panel') {
      candidates.push(head);
      for (const group of groups.slice(1)) {
        const c = classify(group, id, mb);
        if (c) candidates.push(c);
      }
      return;
    }
    const whole = classify(parts, id, mb);
    if (whole) candidates.push(whole);
  });

  // Content in a panel's hole (dark text in a white window knocked out of a
  // band) is on the page too, so this pass found it; the panel's own pass finds
  // it again against the panel's colour. The panel's pass owns it, so each pixel
  // has one region.
  const panels = candidates.filter((c) => c.kind === 'panel' && c.inside);
  const owned = (c: Candidate): boolean =>
    panels.some((p) => {
      if (p === c || !p.inside) return false;
      const b = c.box;
      if (b.x < p.box.x || b.y < p.box.y || b.x + b.w > p.box.x + p.box.w || b.y + b.h > p.box.y + p.box.h) return false;
      const xs = [b.x, b.x + (b.w >> 1), b.x + b.w - 1];
      const ys = [b.y, b.y + (b.h >> 1), b.y + b.h - 1];
      return xs.every((x) => ys.every((y) => p.inside?.(x, y) === true));
    });
  const kept = candidates.filter((c) => !owned(c));
  candidates.length = 0;
  candidates.push(...kept);
  if (candidates.length > maxCandidates) {
    return { candidates: [], overflow: true, specks, reads: reads + counter.reads, cells, seen: candidates.length };
  }
  cells += gw * gh;
  return { candidates, overflow: false, specks, reads: reads + counter.reads, cells, seen: candidates.length };
}

/**
 * Whether a pixel lies inside a panel: on the panel's blurred cells or in a hole
 * they enclose (text knocked out of a band), never in the surroundings its box
 * also covers (the page around a rounded card).
 */
function panelInside(
  labels: Int32Array,
  id: number,
  b: { x0: number; y0: number; x1: number; y1: number },
  gw: number,
  x0: number,
  y0: number,
  cell: number,
  parent: ((px: number, py: number) => boolean) | undefined,
): (px: number, py: number) => boolean {
  const bw = b.x1 - b.x0 + 1;
  const bh = b.y1 - b.y0 + 1;
  const outside = new Uint8Array(bw * bh);
  const stack: number[] = [];
  const seed = (cx: number, cy: number): void => {
    const k = cy * bw + cx;
    if (outside[k] || labels[(b.y0 + cy) * gw + b.x0 + cx] === id) return;
    outside[k] = 1;
    stack.push(k);
  };
  for (let cx = 0; cx < bw; cx++) {
    seed(cx, 0);
    seed(cx, bh - 1);
  }
  for (let cy = 0; cy < bh; cy++) {
    seed(0, cy);
    seed(bw - 1, cy);
  }
  while (stack.length) {
    const k = stack.pop() ?? 0;
    const cx = k % bw;
    const cy = (k - cx) / bw;
    if (cx > 0) seed(cx - 1, cy);
    if (cx < bw - 1) seed(cx + 1, cy);
    if (cy > 0) seed(cx, cy - 1);
    if (cy < bh - 1) seed(cx, cy + 1);
  }
  return (px: number, py: number): boolean => {
    const cx = Math.floor((px - x0) / cell) - b.x0;
    const cy = Math.floor((py - y0) / cell) - b.y0;
    if (cx < 0 || cy < 0 || cx >= bw || cy >= bh) return false;
    if (outside[cy * bw + cx]) return false;
    return parent ? parent(px, py) : true;
  };
}

// ─── merging ─────────────────────────────────────────────────────────────────

function heightRatio(a: Candidate, b: Candidate): number {
  const lo = Math.max(1, Math.min(a.lineHeight, b.lineHeight));
  return Math.max(a.lineHeight, b.lineHeight) / lo;
}

/** Whether two text regions belong to one block: one row, or stacked a line's gap apart. */
function textNeighbours(a: Candidate, b: Candidate): boolean {
  if (heightRatio(a, b) > MERGE_MAX_HEIGHT_RATIO) return false;
  // A text reading with many colours off its blend line (a glow, a drawing with
  // labels) stays on its own, so it cannot pull clean text into a picture.
  if (Math.max(a.stats.otherShare, b.stats.otherShare) > MERGE_MAX_OTHER) return false;
  // A line in another colour (a red lead-in, a highlighted phrase) is its own
  // block, so the colour a caller reads per region is the colour of its text.
  const inkDiff = Math.abs(a.stats.ink[0] - b.stats.ink[0]) + Math.abs(a.stats.ink[1] - b.stats.ink[1]) + Math.abs(a.stats.ink[2] - b.stats.ink[2]);
  if (inkDiff > MERGE_MAX_INK_DIFF) return false;
  const vOverlap = Math.min(a.box.y + a.box.h, b.box.y + b.box.h) - Math.max(a.box.y, b.box.y);
  const hGap = Math.max(a.box.x, b.box.x) - Math.min(a.box.x + a.box.w, b.box.x + b.box.w);
  const line = Math.max(a.lineHeight, b.lineHeight);
  if (vOverlap >= 0.5 * Math.min(a.box.h, b.box.h) && hGap <= ROW_GAP_LINES * line) return true;
  const hOverlap = Math.min(a.box.x + a.box.w, b.box.x + b.box.w) - Math.max(a.box.x, b.box.x);
  const vGap = Math.max(a.box.y, b.box.y) - Math.min(a.box.y + a.box.h, b.box.y + b.box.h);
  return hOverlap > 0 && vGap <= STACK_GAP_LINES * Math.min(a.lineHeight, b.lineHeight);
}

function mergeTwo(a: Candidate, b: Candidate): Candidate {
  const big = a.ink >= b.ink ? a : b;
  const kind: SlideRegionKindV1 = a.kind === 'picture' || b.kind === 'picture' ? 'picture' : 'text';
  let reason: SlideRegionReasonV1;
  if (a.kind !== b.kind) reason = 'merged-overlap';
  else if (kind === 'text') reason = a.reason === b.reason ? a.reason : 'components-in-rows';
  else reason = big.reason;
  const components = a.components + b.components;
  return {
    kind,
    reason,
    box: union(a.box, b.box),
    ink: a.ink + b.ink,
    components,
    rows: a.rows + b.rows,
    inRow: a.inRow + b.inRow,
    // A line's height is a per-line fact: the block keeps the larger part's, weighted by its parts.
    lineHeight: (a.lineHeight * a.components + b.lineHeight * b.components) / Math.max(1, components),
    stats: {
      samples: a.stats.samples + b.stats.samples,
      dominantShare: big.stats.dominantShare,
      distinct: Math.max(a.stats.distinct, b.stats.distinct),
      ink: big.stats.ink,
      otherShare: (a.stats.otherShare * a.stats.samples + b.stats.otherShare * b.stats.samples) / Math.max(1, a.stats.samples + b.stats.samples),
    },
  };
}

/** Share of box `a`'s area that lies inside box `b`. */
function insideShare(a: RegionBoxV1, b: RegionBoxV1): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? (w * h) / Math.max(1, a.w * a.h) : 0;
}

/** A rule mostly inside a text or picture region is part of it: an underline, a stroke in a drawing. */
function absorb(region: Candidate, rule: Candidate): Candidate {
  return { ...region, box: union(region.box, rule.box), ink: region.ink + rule.ink };
}

/**
 * Merge text blocks and overlapping boxes until nothing changes. A rule lying
 * mostly inside a text or picture region joins it (an underline, a stroke of a
 * drawing); a rule that only passes by, a rule standing on its own and a panel
 * stay as found, so a table's frame does not swallow its cells.
 */
function mergeCandidates(list: Candidate[]): Candidate[] {
  const panels = list.filter((c) => c.kind === 'panel');
  let rules = list.filter((c) => c.kind === 'rule');
  let open = list.filter((c) => c.kind === 'text' || c.kind === 'picture');
  for (let round = 0; round < MAX_MERGE_ROUNDS; round++) {
    let changed = false;
    const next: Candidate[] = [];
    const used = new Uint8Array(open.length);
    for (let i = 0; i < open.length; i++) {
      if (used[i]) continue;
      let acc = open[i];
      if (!acc) continue;
      used[i] = 1;
      for (let j = i + 1; j < open.length; j++) {
        const other = open[j];
        if (used[j] || !other) continue;
        const both = acc.kind === 'text' && other.kind === 'text';
        if (intersects(acc.box, other.box) || (both && textNeighbours(acc, other))) {
          acc = mergeTwo(acc, other);
          used[j] = 1;
          changed = true;
        }
      }
      next.push(acc);
    }
    const standing: Candidate[] = [];
    for (const rule of rules) {
      const host = next.findIndex((region) => insideShare(rule.box, region.box) >= RULE_ABSORB_SHARE);
      const target = host >= 0 ? next[host] : undefined;
      if (target) {
        next[host] = absorb(target, rule);
        changed = true;
      } else {
        standing.push(rule);
      }
    }
    open = next;
    rules = standing;
    if (!changed) break;
  }
  return [...panels, ...rules, ...open];
}

// ─── masking ─────────────────────────────────────────────────────────────────

/**
 * A copy of the image with every pixel inside a mask box replaced by an
 * inverse-square-distance blend of the nearest unmasked pixels in its row (left and
 * right) and its column (above and below). Boxes are joined into one mask first,
 * so two overlapping boxes never fill from each other's unfilled pixels. Reads
 * each pixel a bounded number of times: one pass per row, one per column, one
 * for the blend, so about 4 reads per pixel.
 */
function fillMasked(image: RgbaImageV1, boxes: RegionBoxV1[]): { image: RgbaImageV1; reads: number } {
  const { width: w, height: h } = image;
  const on = new Uint8Array(w * h);
  let marked = false;
  for (const b of boxes) {
    if (!Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.w) || !Number.isFinite(b.h)) continue;
    const x0 = Math.max(0, Math.floor(b.x));
    const y0 = Math.max(0, Math.floor(b.y));
    const x1 = Math.min(w, Math.ceil(b.x + b.w));
    const y1 = Math.min(h, Math.ceil(b.y + b.h));
    if (x1 <= x0 || y1 <= y0) continue;
    marked = true;
    for (let y = y0; y < y1; y++) on.fill(1, y * w + x0, y * w + x1);
  }
  const data = new Uint8ClampedArray(image.data);
  if (!marked) return { image: { width: w, height: h, data }, reads: 0 };
  const sum = new Float32Array(w * h * 3);
  const weight = new Float32Array(w * h);
  // Inverse square distance: the nearest neighbour decides, so ink just past a
  // box's end (the tail of a dash) stays at that end instead of smearing across.
  const add = (p: number, from: number, d: number): void => {
    const k = 1 / (d * d);
    const i = from * 4;
    sum[p * 3] = (sum[p * 3] ?? 0) + k * (image.data[i] ?? 0);
    sum[p * 3 + 1] = (sum[p * 3 + 1] ?? 0) + k * (image.data[i + 1] ?? 0);
    sum[p * 3 + 2] = (sum[p * 3 + 2] ?? 0) + k * (image.data[i + 2] ?? 0);
    weight[p] = (weight[p] ?? 0) + k;
  };
  let reads = 0;
  // Rows: each masked run takes its left and right neighbours.
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      if (!on[y * w + x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < w && on[y * w + x]) x++;
      for (let k = start; k < x; k++) {
        reads++;
        if (start > 0) add(y * w + k, y * w + start - 1, k - start + 1);
        if (x < w) add(y * w + k, y * w + x, x - k);
      }
    }
  }
  // Columns: the same above and below.
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h) {
      if (!on[y * w + x]) {
        y++;
        continue;
      }
      const start = y;
      while (y < h && on[y * w + x]) y++;
      for (let k = start; k < y; k++) {
        reads++;
        if (start > 0) add(k * w + x, (start - 1) * w + x, k - start + 1);
        if (y < h) add(k * w + x, y * w + x, y - k);
      }
    }
  }
  for (let p = 0; p < w * h; p++) {
    if (!on[p]) continue;
    const k = weight[p] ?? 0;
    // A mask over the whole picture has no neighbour to fill from: it reads as white.
    data[p * 4] = k > 0 ? (sum[p * 3] ?? 0) / k : 255;
    data[p * 4 + 1] = k > 0 ? (sum[p * 3 + 1] ?? 0) / k : 255;
    data[p * 4 + 2] = k > 0 ? (sum[p * 3 + 2] ?? 0) / k : 255;
    data[p * 4 + 3] = 255;
  }
  return { image: { width: w, height: h, data }, reads: reads + w * h };
}

/**
 * The image as `findSlideRegions` reads it under `mask`: every pixel inside a
 * box replaced by the blend of its unmasked neighbours (see `mask`). For a
 * caller that measures ink after the text it located is gone, on the same
 * pixels the region finder saw. The image passed in is not changed.
 */
export function maskedImageOf(image: RgbaImageV1, boxes: RegionBoxV1[]): RgbaImageV1 {
  return fillMasked(image, boxes).image;
}

// ─── the entry point ─────────────────────────────────────────────────────────

function byPosition(a: SlideRegionV1, b: SlideRegionV1): number {
  return a.box.y - b.box.y || a.box.x - b.box.x || a.box.h - b.box.h || a.box.w - b.box.w || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0);
}

/**
 * Find the regions of a flattened slide. See the module header for the method
 * and the work bound.
 */
export function findSlideRegions(source: RgbaImageV1, opts: SlideRegionOptsV1 = {}): SlideRegionsV1 {
  const width = Math.max(0, Math.floor(source.width));
  const height = Math.max(0, Math.floor(source.height));
  if (width === 0 || height === 0 || source.data.length < width * height * 4) {
    throw new Error('findSlideRegions: the image needs a positive size and width * height * 4 bytes of RGBA.');
  }
  const masked = opts.mask?.length ? fillMasked(source, opts.mask) : null;
  const image = masked ? masked.image : source;
  const maxRegions = Math.max(1, Math.floor(opts.maxRegions ?? DEFAULT_MAX_REGIONS));
  const maxDepth = Math.max(0, Math.floor(opts.maxDepth ?? DEFAULT_MAX_DEPTH));
  const gridCells = Math.max(16, Math.floor(opts.gridCells ?? DEFAULT_GRID_CELLS));
  const ground = estimateGround(image, opts);
  const page = { w: width, h: height };
  const work = { pixelReads: ground.reads + (masked?.reads ?? 0), cellVisits: 0 };
  let specks = 0;
  let overflow = false;
  let overflowSeen = 0;

  interface Built {
    region: SlideRegionV1;
    children: Built[];
  }

  const build = (pass: PassInput, parent: string | undefined): Built[] => {
    const result = runPass(pass, page, 4 * maxRegions);
    work.pixelReads += result.reads;
    work.cellVisits += result.cells;
    specks += result.specks;
    if (result.overflow) {
      overflow = true;
      overflowSeen += result.seen;
      return [];
    }
    const merged = mergeCandidates(result.candidates);
    // A panel the search cannot look inside would reach a caller as a flat fill
    // with its content gone, so past the depth limit it is kept as a picture.
    if (pass.depth >= maxDepth) for (const c of merged) if (c.kind === 'panel') c.kind = 'picture';
    const shaped = merged.map((c) => {
      const area = Math.max(1, c.box.w * c.box.h);
      const region: SlideRegionV1 = {
        id: '',
        kind: c.kind,
        box: { ...c.box },
        depth: pass.depth,
        evidence: {
          reason: c.reason,
          components: c.components,
          rows: c.rows,
          inRowShare: round3(c.components ? c.inRow / c.components : 0),
          lineHeight: round3(c.lineHeight),
          inkShare: round3(Math.min(1, c.ink / area)),
          dominantShare: round3(c.stats.dominantShare),
          distinctColours: c.stats.distinct,
          otherColourShare: round3(c.stats.otherShare),
          samples: c.stats.samples,
          aspect: round3(Math.max(c.box.w, c.box.h) / Math.max(1, Math.min(c.box.w, c.box.h))),
          ink: hexOf(c.stats.ink),
          ground: hexOf(groundRgb(pass.ground, c.box.x + c.box.w / 2, c.box.y + c.box.h / 2)),
        },
      };
      if (c.orientation) region.evidence.orientation = c.orientation;
      return { region, candidate: c };
    });
    shaped.sort((a, b) => byPosition(a.region, b.region));
    return shaped.map(({ region, candidate }, i) => {
      region.id = parent ? `${parent}.${i + 1}` : `r${i + 1}`;
      if (parent) region.parent = parent;
      const built: Built = { region, children: [] };
      if (region.kind === 'panel' && pass.depth < maxDepth && candidate.inside) {
        built.children = build(
          {
            image,
            x0: region.box.x,
            y0: region.box.y,
            w: region.box.w,
            h: region.box.h,
            ground: flatGround(candidate.stats.ink),
            threshold: pass.threshold,
            inside: candidate.inside,
            depth: pass.depth + 1,
            gridCells,
          },
          region.id,
        );
      }
      return built;
    });
  };

  const tree = build({ image, x0: 0, y0: 0, w: width, h: height, ground: ground.model, threshold: ground.threshold, depth: 0, gridCells }, undefined);
  const flat: SlideRegionV1[] = [];
  const walk = (nodes: Built[]): void => {
    for (const node of nodes) {
      flat.push(node.region);
      walk(node.children);
    }
  };
  walk(tree);
  const kept = overflow ? [] : flat.slice(0, maxRegions);
  const dropped = overflow ? flat.length + overflowSeen : flat.length - kept.length;
  return {
    width,
    height,
    background: hexOf(ground.base),
    backgroundModel: ground.kind,
    ...(ground.coef ? { surface: ground.coef.map((row) => [...row]) } : {}),
    threshold: ground.threshold,
    cell: Math.max(1, Math.ceil(Math.max(width, height) / gridCells)),
    regions: kept,
    complete: !overflow && dropped === 0,
    dropped,
    specks,
    work,
  };
}

// ─── helpers a caller needs around a region ─────────────────────────────────

/**
 * The ground ink is measured against: one colour as `#rrggbb` (a panel's fill,
 * a flat page), or a page's fitted surface as `findSlideRegions` returned it.
 */
export type InkGroundV1 = string | { surface: number[][]; width: number; height: number };

/** The ground one region was measured against: the page's surface for a top-level region on a gradient, its own ground colour otherwise. */
export function groundOfRegion(regions: Pick<SlideRegionsV1, 'surface' | 'width' | 'height'>, region: SlideRegionV1): InkGroundV1 {
  return region.depth === 0 && regions.surface ? { surface: regions.surface, width: regions.width, height: regions.height } : region.evidence.ground;
}

/** A ground as the model the passes read, falling back to white for a colour or a surface that does not parse. */
function modelOf(ground: InkGroundV1): GroundModel {
  if (typeof ground === 'string') return flatGround(rgbOfHex(ground) ?? [255, 255, 255]);
  const valid =
    ground.surface.length === 3 &&
    ground.surface.every((row) => row.length === 6 && row.every((n) => Number.isFinite(n))) &&
    ground.width > 0 &&
    ground.height > 0;
  return valid ? surfaceModel(ground.surface, ground.width, ground.height) : flatGround([255, 255, 255]);
}

/** A copy of one box of the image, padded and clipped to the image, with where it came from. */
export function cropRgba(
  image: RgbaImageV1,
  box: RegionBoxV1,
  pad = 0,
): { x: number; y: number; width: number; height: number; data: Uint8ClampedArray } {
  const x = Math.max(0, Math.floor(box.x - pad));
  const y = Math.max(0, Math.floor(box.y - pad));
  const x1 = Math.min(image.width, Math.ceil(box.x + box.w + pad));
  const y1 = Math.min(image.height, Math.ceil(box.y + box.h + pad));
  const w = Math.max(1, x1 - x);
  const h = Math.max(1, y1 - y);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) {
    const from = ((y + row) * image.width + x) * 4;
    data.set(image.data.subarray(from, from + w * 4), row * w * 4);
  }
  return { x, y, width: w, height: h, data };
}

/**
 * How much of a region's ink the given boxes cover: ink pixels are those whose
 * summed channel difference from `ground` is over `threshold`. Sampled on a
 * stride, at most 65,536 pixels. A reading below 1 means some ink lies outside
 * every box, which is what an OCR pass that missed an icon or a chart looks like.
 */
export function inkCoverage(
  image: RgbaImageV1,
  box: RegionBoxV1,
  ground: InkGroundV1,
  threshold: number,
  cover: RegionBoxV1[],
): { ink: number; covered: number; share: number } {
  const g = modelOf(ground);
  const stride = Math.max(1, Math.ceil(Math.sqrt((box.w * box.h) / 65536)));
  let ink = 0;
  let covered = 0;
  const x1 = Math.min(image.width, box.x + box.w);
  const y1 = Math.min(image.height, box.y + box.h);
  for (let y = Math.max(0, Math.floor(box.y)); y < y1; y += stride) {
    for (let x = Math.max(0, Math.floor(box.x)); x < x1; x += stride) {
      if (inkAt(image.data, (y * image.width + x) * 4, g, x, y) <= threshold) continue;
      ink++;
      for (const c of cover) {
        if (x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h) {
          covered++;
          break;
        }
      }
    }
  }
  return { ink, covered, share: ink ? covered / ink : 1 };
}

/**
 * The tight box of the ink inside `box`: pixels whose summed channel difference
 * from `ground` is over `threshold`. Null when the box holds no ink. A text
 * detector pads its boxes, so a size read from a detector box is too large; the
 * ink box is what a cap height compares with. Reads every pixel of the box once.
 */
export function inkBounds(image: RgbaImageV1, box: RegionBoxV1, ground: InkGroundV1, threshold: number): RegionBoxV1 | null {
  const g = modelOf(ground);
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(image.width, Math.ceil(box.x + box.w));
  const y1 = Math.min(image.height, Math.ceil(box.y + box.h));
  let minX = x1;
  let minY = y1;
  let maxX = -1;
  let maxY = -1;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (inkAt(image.data, (y * image.width + x) * 4, g, x, y) <= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * The colour of the ink inside `box`: the mean of the most common colour (4 bits
 * per channel) among pixels over `threshold` from `ground`, as `#rrggbb`. Null
 * when the box holds no ink. Sampled on a stride, at most 65,536 pixels, so a
 * caller can read one line's colour rather than its region's.
 */
export function inkColourOf(image: RgbaImageV1, box: RegionBoxV1, ground: InkGroundV1, threshold: number): string | null {
  const g = modelOf(ground);
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(image.width, Math.ceil(box.x + box.w));
  const y1 = Math.min(image.height, Math.ceil(box.y + box.h));
  const stride = Math.max(1, Math.ceil(Math.sqrt(((x1 - x0) * (y1 - y0)) / COLOUR_SAMPLE_CAP)));
  const counts = new Map<number, number>();
  const sums = new Map<number, Rgb>();
  for (let y = y0; y < y1; y += stride) {
    for (let x = x0; x < x1; x += stride) {
      const i = (y * image.width + x) * 4;
      if (inkAt(image.data, i, g, x, y) <= threshold) continue;
      const r = image.data[i] ?? 0;
      const gg = image.data[i + 1] ?? 0;
      const b = image.data[i + 2] ?? 0;
      const key = ((r >> 4) << 8) | ((gg >> 4) << 4) | (b >> 4);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      const sum = sums.get(key);
      if (sum) {
        sum[0] += r;
        sum[1] += gg;
        sum[2] += b;
      } else {
        sums.set(key, [r, gg, b]);
      }
    }
  }
  let bestKey = -1;
  let best = 0;
  for (const [key, n] of counts) {
    if (n > best || (n === best && key < bestKey)) {
      best = n;
      bestKey = key;
    }
  }
  const sum = sums.get(bestKey);
  return sum && best > 0 ? hexOf([sum[0] / best, sum[1] / best, sum[2] / best]) : null;
}

/**
 * One byte per pixel of the whole image, 1 where the pixel is ink against
 * `ground` (over `threshold`), 0 elsewhere. Reads every pixel once.
 */
export function inkMaskOf(image: RgbaImageV1, ground: InkGroundV1, threshold: number): Uint8Array {
  const g = modelOf(ground);
  const mask = new Uint8Array(image.width * image.height);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const p = y * image.width + x;
      if (inkAt(image.data, p * 4, g, x, y) > threshold) mask[p] = 1;
    }
  }
  return mask;
}

/**
 * The ground around a box: the mean of the most common colour (4 bits per
 * channel) on its outline, as `#rrggbb`. A text detector pads its line boxes, so
 * the outline of a line box is the ground the line was set on, which is what its
 * ink is read against on a photograph or a gradient, where no one colour is the
 * page's. Null for an empty box. Reads the outline once, at most 2 x (w + h) pixels.
 */
export function outlineColourOf(image: RgbaImageV1, box: RegionBoxV1): string | null {
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(image.width, Math.ceil(box.x + box.w)) - 1;
  const y1 = Math.min(image.height, Math.ceil(box.y + box.h)) - 1;
  if (x1 < x0 || y1 < y0) return null;
  const counts = new Map<number, number>();
  const sums = new Map<number, Rgb>();
  const take = (x: number, y: number): void => {
    const i = (y * image.width + x) * 4;
    const r = image.data[i] ?? 0;
    const g = image.data[i + 1] ?? 0;
    const b = image.data[i + 2] ?? 0;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const sum = sums.get(key);
    if (sum) {
      sum[0] += r;
      sum[1] += g;
      sum[2] += b;
    } else {
      sums.set(key, [r, g, b]);
    }
  };
  for (let x = x0; x <= x1; x++) {
    take(x, y0);
    if (y1 !== y0) take(x, y1);
  }
  for (let y = y0 + 1; y < y1; y++) {
    take(x0, y);
    if (x1 !== x0) take(x1, y);
  }
  let bestKey = -1;
  let best = 0;
  for (const [key, n] of counts) {
    if (n > best || (n === best && key < bestKey)) {
      best = n;
      bestKey = key;
    }
  }
  const sum = sums.get(bestKey);
  return sum && best > 0 ? hexOf([sum[0] / best, sum[1] / best, sum[2] / best]) : null;
}

/**
 * The largest axis-aligned box inside `box` that meets none of `obstacles`: the
 * part of a photograph under text that can be kept as a picture without drawing
 * that text twice. Every band between two obstacle edges is tried, and inside
 * a band the widest gap between the obstacles crossing it; ties go to the higher,
 * then the further left box. With no obstacle inside, `box` itself. Null when
 * the obstacles leave no area. Quadratic in the obstacle count for the bands,
 * each band sorted once, so a slide's few dozen lines cost well under a million steps.
 */
export function largestFreeBox(box: RegionBoxV1, obstacles: RegionBoxV1[]): RegionBoxV1 | null {
  const inside = obstacles
    .map((o) => {
      const x = Math.max(box.x, o.x);
      const y = Math.max(box.y, o.y);
      return { x, y, w: Math.min(box.x + box.w, o.x + o.w) - x, h: Math.min(box.y + box.h, o.y + o.h) - y };
    })
    .filter((o) => o.w > 0 && o.h > 0);
  if (inside.length === 0) return box.w > 0 && box.h > 0 ? { ...box } : null;
  const ys = [...new Set([box.y, box.y + box.h, ...inside.flatMap((o) => [o.y, o.y + o.h])])].sort((a, b) => a - b);
  let best: RegionBoxV1 | null = null;
  let bestArea = 0;
  for (let i = 0; i < ys.length; i++) {
    for (let j = i + 1; j < ys.length; j++) {
      const top = ys[i] ?? 0;
      const bottom = ys[j] ?? 0;
      const height = bottom - top;
      if (height <= 0 || height * box.w <= bestArea) continue;
      const crossing = inside.filter((o) => o.y < bottom && o.y + o.h > top).sort((a, b) => a.x - b.x);
      let edge = box.x;
      const gaps: Array<[number, number]> = [];
      for (const o of crossing) {
        if (o.x > edge) gaps.push([edge, o.x]);
        edge = Math.max(edge, o.x + o.w);
      }
      if (box.x + box.w > edge) gaps.push([edge, box.x + box.w]);
      for (const [left, right] of gaps) {
        const area = (right - left) * height;
        if (area > bestArea) {
          bestArea = area;
          best = { x: left, y: top, w: right - left, h: height };
        }
      }
    }
  }
  return best;
}

/** Text ink differs from its ground by at least this (summed channels) when a line's bounds are read by colour. */
const TEXT_MIN_CONTRAST = 96;
/** A pixel within this summed channel difference of a line's text colour is that text's ink. */
const TEXT_INK_NEAR = 96;
/** A row or column is part of a line when it holds at least this share of the fullest row's or column's text ink. */
const TEXT_INK_FLOOR = 0.05;

/**
 * The box of a line's text inside `box`, read by its colour: the line's ink
 * colour (as `inkColourOf` reads it against `ground`, counting only pixels at
 * least `TEXT_MIN_CONTRAST` from it), then the rows and columns
 * holding a real share of pixels of that colour. On a photograph or a busy
 * gradient `inkBounds` takes in every textured pixel the box holds and returns
 * the whole box; the text's own colour is what separates it there. Null when
 * the box holds no ink. Reads the box twice.
 */
export function textBoundsOf(image: RgbaImageV1, box: RegionBoxV1, ground: InkGroundV1, threshold: number): RegionBoxV1 | null {
  // Text is set to be read: its ink stands well clear of its ground, where a
  // faded drawing behind it does not, so the colour is read from strong ink only.
  threshold = Math.max(threshold, TEXT_MIN_CONTRAST);
  const hex = inkColourOf(image, box, ground, threshold);
  const ink = hex ? rgbOfHex(hex) : null;
  if (!ink) return null;
  const g = modelOf(ground);
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(image.width, Math.ceil(box.x + box.w));
  const y1 = Math.min(image.height, Math.ceil(box.y + box.h));
  if (x1 <= x0 || y1 <= y0) return null;
  const rows = new Uint32Array(y1 - y0);
  const cols = new Uint32Array(x1 - x0);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * image.width + x) * 4;
      if (inkAt(image.data, i, g, x, y) <= threshold) continue;
      const d = Math.abs((image.data[i] ?? 0) - ink[0]) + Math.abs((image.data[i + 1] ?? 0) - ink[1]) + Math.abs((image.data[i + 2] ?? 0) - ink[2]);
      if (d > TEXT_INK_NEAR) continue;
      rows[y - y0] = (rows[y - y0] ?? 0) + 1;
      cols[x - x0] = (cols[x - x0] ?? 0) + 1;
    }
  }
  const span = (counts: Uint32Array): [number, number] | null => {
    let most = 0;
    for (const c of counts) most = Math.max(most, c);
    if (most === 0) return null;
    const floor = Math.max(1, TEXT_INK_FLOOR * most);
    let first = -1;
    let last = -1;
    counts.forEach((c, k) => {
      if (c < floor) return;
      if (first < 0) first = k;
      last = k;
    });
    return first < 0 ? null : [first, last];
  };
  const down = span(rows);
  const across = span(cols);
  if (!down || !across) return null;
  return { x: x0 + across[0], y: y0 + down[0], w: across[1] - across[0] + 1, h: down[1] - down[0] + 1 };
}

/** An ink colour holding at least this share of the most common ink colour's pixels may be a line's text colour. */
const LINE_INK_CANDIDATE = 0.25;

/** The ground under a line is sampled every this share of its height across. */
const LINE_GROUND_STEP = 1 / 8;
/** ...and each sample is the median over this many samples each side (about half a line). */
const LINE_GROUND_REACH = 4;

/**
 * The ground under a line, across it: one colour every `step` columns of `box`
 * from its left edge (an eighth of the box's height), each the median of the
 * box's top and bottom two rows over about a line's height of columns, channel
 * by channel. A detector's box keeps those rows clear of the letters (it pads
 * above the ascenders and below the descenders), and the window keeps a letter
 * reaching an edge in one column from becoming ground, so the ground follows a
 * gradient or a photograph along the line. Column `x` reads
 * `colours[floor((x - left) / step)]`. Empty for an empty box. Reads four rows.
 */
export function lineGroundOf(image: RgbaImageV1, box: RegionBoxV1): { step: number; colours: Array<[number, number, number]> } {
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(image.width, Math.ceil(box.x + box.w));
  const y1 = Math.min(image.height, Math.ceil(box.y + box.h));
  const step = Math.max(1, Math.round((y1 - y0) * LINE_GROUND_STEP));
  if (x1 <= x0 || y1 <= y0) return { step, colours: [] };
  const edgeRows = [...new Set([y0, Math.min(y1 - 1, y0 + 1), Math.max(y0, y1 - 2), y1 - 1])];
  const columns: number[] = [];
  for (let x = x0; x < x1; x += step) columns.push(x);
  const samples = columns.map((x) => edgeRows.map((y): Rgb => {
    const i = (y * image.width + x) * 4;
    return [image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0];
  }));
  const colours = columns.map((_, k): [number, number, number] => {
    const lo = Math.max(0, k - LINE_GROUND_REACH);
    const hi = Math.min(columns.length - 1, k + LINE_GROUND_REACH);
    const values: number[][] = [[], [], []];
    for (let j = lo; j <= hi; j++) {
      for (const c of samples[j] ?? []) {
        values[0]?.push(c[0]);
        values[1]?.push(c[1]);
        values[2]?.push(c[2]);
      }
    }
    return [median(values[0] ?? []), median(values[1] ?? []), median(values[2] ?? [])];
  });
  return { step, colours };
}

/**
 * A line's text colour and the ground it is set on, read inside the line's box
 * alone. The ground is read column by column from the box's top and bottom two
 * rows, which a detector's box keeps clear of the letters (it pads above the
 * ascenders and below the descenders), as the median over a window a line high,
 * so a letter reaching an edge in one column does not become ground. That
 * follows a gradient or a photograph along the line, where one colour for the
 * whole box (its outline's commonest, or the page's) counts ground as ink. Ink
 * is a pixel at least `TEXT_MIN_CONTRAST` from the ground of its column, and the
 * text colour is, among the ink colours holding a real share of the ink, the one
 * standing furthest from the ground: an anti-aliased edge or a soft drop shadow
 * lies between the text and its ground, so the text colour is never the
 * ground's own (white text with a dark shadow on dark green reads white, dark
 * text on a pale gradient reads dark). Null when no pixel stands that far from
 * its ground. Sampled on a stride, at most 65,536 pixels, and reads the box twice.
 */
export function lineInkColourOf(image: RgbaImageV1, box: RegionBoxV1): { ink: string; ground: string } | null {
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(image.width, Math.ceil(box.x + box.w));
  const y1 = Math.min(image.height, Math.ceil(box.y + box.h));
  if (x1 <= x0 || y1 <= y0) return null;
  const stride = Math.max(1, Math.ceil(Math.sqrt(((x1 - x0) * (y1 - y0)) / COLOUR_SAMPLE_CAP)));
  const px = (x: number, y: number): Rgb => {
    const i = (y * image.width + x) * 4;
    return [image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0];
  };
  const keyOf = (c: Rgb): number => ((c[0] >> 4) << 8) | ((c[1] >> 4) << 4) | (c[2] >> 4);
  const columns: number[] = [];
  for (let x = x0; x < x1; x += stride) columns.push(x);
  const lineGround = lineGroundOf(image, box);
  const groundAt = (x: number): Rgb => lineGround.colours[Math.min(lineGround.colours.length - 1, Math.floor((x - x0) / lineGround.step))] ?? [255, 255, 255];
  const counts = new Map<number, number>();
  const sums = new Map<number, Rgb>();
  const distance = new Map<number, number>();
  columns.forEach((x) => {
    const g = groundAt(x);
    for (let y = y0; y < y1; y += stride) {
      const c = px(x, y);
      const d = Math.abs(c[0] - g[0]) + Math.abs(c[1] - g[1]) + Math.abs(c[2] - g[2]);
      if (d < TEXT_MIN_CONTRAST) continue;
      const key = keyOf(c);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      distance.set(key, (distance.get(key) ?? 0) + d);
      const sum = sums.get(key);
      if (sum) {
        sum[0] += c[0];
        sum[1] += c[1];
        sum[2] += c[2];
      } else {
        sums.set(key, [c[0], c[1], c[2]]);
      }
    }
  });
  let most = 0;
  for (const n of counts.values()) most = Math.max(most, n);
  if (most === 0) return null;
  let bestKey = -1;
  let bestDistance = -1;
  let bestCount = 0;
  for (const [key, n] of counts) {
    if (n < LINE_INK_CANDIDATE * most) continue;
    const d = (distance.get(key) ?? 0) / n;
    if (d > bestDistance || (d === bestDistance && (n > bestCount || (n === bestCount && key < bestKey)))) {
      bestDistance = d;
      bestCount = n;
      bestKey = key;
    }
  }
  const sum = sums.get(bestKey);
  if (!sum || bestCount === 0) return null;
  const mean: Rgb = [0, 0, 0];
  for (const g of lineGround.colours) {
    mean[0] += g[0];
    mean[1] += g[1];
    mean[2] += g[2];
  }
  const n = Math.max(1, lineGround.colours.length);
  return {
    ink: hexOf([sum[0] / bestCount, sum[1] / bestCount, sum[2] / bestCount]),
    ground: hexOf([mean[0] / n, mean[1] / n, mean[2] / n]),
  };
}

/**
 * How heavy a line's letters are: the mean length of the horizontal runs of
 * pixels near its text colour `ink` (within `TEXT_INK_NEAR`), which is a
 * stroke's width, over the height those pixels span. A bold face's strokes are
 * wider for the same height, so the ratio orders the lines of one page by
 * weight; it is not a font weight on its own. Null when the box holds no such
 * pixels. Reads the box once.
 */
export function strokeRatioOf(image: RgbaImageV1, box: RegionBoxV1, ink: string): number | null {
  const rgb = rgbOfHex(ink);
  if (!rgb) return null;
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(image.width, Math.ceil(box.x + box.w));
  const y1 = Math.min(image.height, Math.ceil(box.y + box.h));
  let runs = 0;
  let pixels = 0;
  let top = y1;
  let bottom = y0 - 1;
  for (let y = y0; y < y1; y++) {
    let inRun = false;
    for (let x = x0; x < x1; x++) {
      const i = (y * image.width + x) * 4;
      const near = Math.abs((image.data[i] ?? 0) - rgb[0]) + Math.abs((image.data[i + 1] ?? 0) - rgb[1]) + Math.abs((image.data[i + 2] ?? 0) - rgb[2]) <= TEXT_INK_NEAR;
      if (near) {
        pixels++;
        if (!inRun) runs++;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
      inRun = near;
    }
  }
  return runs && bottom >= top ? pixels / runs / (bottom - top + 1) : null;
}

/** Two neighbouring pixels differing by more than this (summed channels) are detail, not a smooth fill. */
const DETAIL_STEP = 24;

/**
 * The share of a box's pixels that differ sharply from their right or lower
 * neighbour: near 0 for a flat fill or a gradient however steep across the
 * box, a few percent for a strip holding one edge, and a real share for a
 * drawing, an icon or a photograph. Sampled on a stride, at most 65,536 pixels.
 */
export function detailShare(image: RgbaImageV1, box: RegionBoxV1): number {
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(image.width - 1, Math.ceil(box.x + box.w));
  const y1 = Math.min(image.height - 1, Math.ceil(box.y + box.h));
  if (x1 <= x0 || y1 <= y0) return 0;
  const stride = Math.max(1, Math.ceil(Math.sqrt(((x1 - x0) * (y1 - y0)) / COLOUR_SAMPLE_CAP)));
  let samples = 0;
  let detail = 0;
  const d = (i: number, j: number): number =>
    Math.abs((image.data[i] ?? 0) - (image.data[j] ?? 0)) + Math.abs((image.data[i + 1] ?? 0) - (image.data[j + 1] ?? 0)) + Math.abs((image.data[i + 2] ?? 0) - (image.data[j + 2] ?? 0));
  for (let y = y0; y < y1; y += stride) {
    for (let x = x0; x < x1; x += stride) {
      const i = (y * image.width + x) * 4;
      samples++;
      if (d(i, i + 4) > DETAIL_STEP || d(i, i + image.width * 4) > DETAIL_STEP) detail++;
    }
  }
  return samples ? detail / samples : 0;
}

/** Cells of an icon search: a text line's height over this. */
const ICON_CELL_LINES = 8;
/** An icon is no longer than this many times its short side. */
const ICON_MAX_ASPECT = 3;

/**
 * The drawing standing over a label (a card's icon over its heading): the ink in
 * `area` against a local ground (the median of each square a line high), on a grid of cells an eighth
 * of `lineHeight`, joined where parts lie within half a line of each other, and
 * the group standing most squarely over `under` (the label's span across) whose
 * centre lies over it, that keeps off the window's sides (a card's edge runs
 * the whole height), is compact (`ICON_MAX_ASPECT`) and is between half a line
 * and `maxLines` lines on each side. Null when there is
 * none. Reads each pixel of the window about three times.
 */
export function inkAbove(
  image: RgbaImageV1,
  area: RegionBoxV1,
  under: { x: number; w: number },
  lineHeight: number,
  threshold: number,
  maxLines: number,
): RegionBoxV1 | null {
  const x0 = Math.max(0, Math.floor(area.x));
  const y0 = Math.max(0, Math.floor(area.y));
  const x1 = Math.min(image.width, Math.ceil(area.x + area.w));
  const y1 = Math.min(image.height, Math.ceil(area.y + area.h));
  if (x1 - x0 < 4 || y1 - y0 < 4) return null;
  // The ground is local: the median of each square a line high, which is the
  // fill a card shows there however it is lit, and which a drawing's strokes
  // (a fraction of the square) do not move.
  const step = Math.max(4, Math.round(lineHeight));
  const cols = Math.ceil(image.width / step);
  const rows = Math.ceil(image.height / step);
  const rgb = new Float32Array(cols * rows * 3);
  const stride = Math.max(1, Math.floor(step / ICON_CELL_LINES));
  const channel: number[][] = [[], [], []];
  for (let cy = Math.floor(y0 / step); cy <= Math.floor((y1 - 1) / step); cy++) {
    for (let cx = Math.floor(x0 / step); cx <= Math.floor((x1 - 1) / step); cx++) {
      for (const list of channel) list.length = 0;
      for (let y = cy * step; y < Math.min(image.height, (cy + 1) * step); y += stride) {
        for (let x = cx * step; x < Math.min(image.width, (cx + 1) * step); x += stride) {
          const i = (y * image.width + x) * 4;
          channel[0]?.push(image.data[i] ?? 0);
          channel[1]?.push(image.data[i + 1] ?? 0);
          channel[2]?.push(image.data[i + 2] ?? 0);
        }
      }
      rgb.set([median(channel[0] ?? []), median(channel[1] ?? []), median(channel[2] ?? [])], (cy * cols + cx) * 3);
    }
  }
  const ground: GroundModel = { cols, rows, step, rgb };
  const cell = Math.max(2, Math.round(lineHeight / ICON_CELL_LINES));
  const gw = Math.ceil((x1 - x0) / cell);
  const gh = Math.ceil((y1 - y0) / cell);
  const count = new Uint16Array(gw * gh);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (inkAt(image.data, (y * image.width + x) * 4, ground, x, y) <= threshold) continue;
      const c = Math.floor((y - y0) / cell) * gw + Math.floor((x - x0) / cell);
      count[c] = (count[c] ?? 0) + 1;
    }
  }
  const on = new Uint8Array(gw * gh);
  const minCount = Math.max(1, Math.ceil((cell * cell) / 8));
  for (let c = 0; c < on.length; c++) on[c] = (count[c] ?? 0) >= minCount ? 1 : 0;
  // Parts of one drawing within half a line of each other are one group.
  const reach = Math.max(1, Math.round(lineHeight / 2 / cell));
  const { labels, boxes } = label(dilate(on, gw, gh, reach, reach), gw, gh, true);
  let best: RegionBoxV1 | null = null;
  for (const [id, b] of boxes.entries()) {
    // The group's own ink cells, not the dilation's reach.
    let bx0 = gw;
    let by0 = gh;
    let bx1 = -1;
    let by1 = -1;
    for (let cy = b.y0; cy <= b.y1; cy++) {
      for (let cx = b.x0; cx <= b.x1; cx++) {
        const c = cy * gw + cx;
        if (labels[c] !== id || !on[c]) continue;
        bx0 = Math.min(bx0, cx);
        by0 = Math.min(by0, cy);
        bx1 = Math.max(bx1, cx);
        by1 = Math.max(by1, cy);
      }
    }
    if (bx1 < 0) continue;
    if (bx0 === 0 || bx1 === gw - 1) continue;
    const box = { x: x0 + bx0 * cell, y: y0 + by0 * cell, w: (bx1 - bx0 + 1) * cell, h: (by1 - by0 + 1) * cell };
    const centre = box.x + box.w / 2;
    if (centre < under.x || centre > under.x + under.w) continue;
    if (box.w < lineHeight / 2 || box.h < lineHeight / 2 || box.w > maxLines * lineHeight || box.h > maxLines * lineHeight) continue;
    // An icon is compact; a tall thin group is the edge of a card or its shadow.
    if (Math.max(box.w, box.h) > ICON_MAX_ASPECT * Math.min(box.w, box.h)) continue;
    // The group standing most squarely over the label, then the lower one.
    const middle = under.x + under.w / 2;
    const off = Math.abs(centre - middle);
    const bestOff = best ? Math.abs(best.x + best.w / 2 - middle) : Number.POSITIVE_INFINITY;
    if (!best || off < bestOff || (off === bestOff && box.y + box.h > best.y + best.h)) best = box;
  }
  if (!best) return null;
  const box = best;
  // Tighten to the pixels, against the same local ground.
  let minX = box.x + box.w;
  let minY = box.y + box.h;
  let maxX = -1;
  let maxY = -1;
  for (let y = box.y; y < Math.min(y1, box.y + box.h); y++) {
    for (let x = box.x; x < Math.min(x1, box.x + box.w); x++) {
      if (inkAt(image.data, (y * image.width + x) * 4, ground, x, y) <= threshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX < 0 ? box : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** A box outlined by rules: the rectangle, the rules' colour and their thickness, and the rule regions it was made of. */
export interface OutlinedBoxV1 {
  box: RegionBoxV1;
  /** The outline's colour, `#rrggbb`: the colour of its longest rule. */
  line: string;
  /** The outline's thickness in px: the median thickness of its rules. */
  thickness: number;
  /** Ids of the rule regions that draw the outline. */
  rules: string[];
}

/** Rule ends within this share of the page's width or height of each other meet, and fragments of one line join across this gap. */
const OUTLINE_TOLERANCE = 0.03;
/** A side of an outlined box is drawn along at least this share of its length. */
const OUTLINE_SIDE_COVER = 0.6;

/**
 * Boxes drawn as outlines (a callout's frame, a card's border): four rules,
 * fragments of one line joined first, whose top and bottom run between the same
 * two ends and whose left and right stand at those ends along most of the
 * height. A rule longer than the side it would draw (a table's line, running
 * past the cell) draws no box, so a ruled table gives its outer frame at most,
 * never its cells. Pure geometry over the regions `findSlideRegions` returned,
 * at every depth; quadratic in the joined rules.
 */
export function outlinedBoxes(regions: SlideRegionsV1): OutlinedBoxV1[] {
  const tolX = OUTLINE_TOLERANCE * regions.width;
  const tolY = OUTLINE_TOLERANCE * regions.height;
  interface Line { from: number; to: number; at: number; thick: number; ink: string; length: number; ids: string[] }
  const join = (horizontal: boolean): Line[] => {
    const parts = regions.regions
      .filter((r) => r.kind === 'rule' && r.evidence.orientation === (horizontal ? 'horizontal' : 'vertical'))
      .map((r): Line => ({
        from: horizontal ? r.box.x : r.box.y,
        to: horizontal ? r.box.x + r.box.w : r.box.y + r.box.h,
        at: horizontal ? r.box.y + r.box.h / 2 : r.box.x + r.box.w / 2,
        thick: horizontal ? r.box.h : r.box.w,
        ink: r.evidence.ink,
        length: horizontal ? r.box.w : r.box.h,
        ids: [r.id],
      }))
      .sort((a, b) => a.at - b.at || a.from - b.from);
    const across = horizontal ? tolY : tolX;
    const along = horizontal ? tolX : tolY;
    const out: Line[] = [];
    for (const part of parts) {
      const same = out.find((l) => Math.abs(l.at - part.at) <= across / 3 && part.from <= l.to + along && part.to >= l.from - along);
      if (!same) {
        out.push({ ...part, ids: [...part.ids] });
        continue;
      }
      if (part.length > same.length) {
        same.ink = part.ink;
        same.length = part.length;
      }
      same.from = Math.min(same.from, part.from);
      same.to = Math.max(same.to, part.to);
      same.thick = Math.max(same.thick, part.thick);
      same.ids.push(...part.ids);
    }
    return out;
  };
  const rows = join(true);
  const cols = join(false);
  const found: OutlinedBoxV1[] = [];
  for (const top of rows) {
    for (const bottom of rows) {
      if (bottom.at - top.at < 2 * tolY) continue;
      if (Math.abs(top.from - bottom.from) > tolX || Math.abs(top.to - bottom.to) > tolX) continue;
      const x0 = Math.min(top.from, bottom.from);
      const x1 = Math.max(top.to, bottom.to);
      const height = bottom.at - top.at;
      const side = (at: number): Line | undefined => cols.find((c) =>
        Math.abs(c.at - at) <= tolX &&
        c.from >= top.at - tolY && c.to <= bottom.at + tolY &&
        Math.min(c.to, bottom.at) - Math.max(c.from, top.at) >= OUTLINE_SIDE_COVER * height);
      const left = side(x0);
      const right = side(x1);
      if (!left || !right || left === right) continue;
      const box = { x: Math.round(Math.min(x0, left.at - left.thick / 2)), y: Math.round(top.at - top.thick / 2), w: 0, h: 0 };
      box.w = Math.round(Math.max(x1, right.at + right.thick / 2)) - box.x;
      box.h = Math.round(bottom.at + bottom.thick / 2) - box.y;
      const lines = [top, bottom, left, right];
      const longest = lines.reduce((a, b) => (b.length > a.length ? b : a));
      const thick = [...lines.map((l) => l.thick)].sort((a, b) => a - b);
      found.push({ box, line: longest.ink, thickness: ((thick[1] ?? 1) + (thick[2] ?? 1)) / 2, rules: lines.flatMap((l) => l.ids).sort() });
    }
  }
  // A box inside another made of the same rules is not a second box.
  return found
    .sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x || a.box.w * a.box.h - b.box.w * b.box.h)
    .filter((b, i, all) => !all.slice(0, i).some((a) => a.rules.join() === b.rules.join()));
}

// ─── the characters of one line ──────────────────────────────────────────────

/**
 * What the pixels of one read line say about its characters (plan 275 WP10
 * part B): a recogniser returns a line's text and box, and the ink inside the
 * box says which characters are drawn in another colour, which words are set
 * heavier, and whether a plain quote or hyphen it returned is drawn as the
 * typographic character.
 */
export interface LineGlyphsV1 {
  /**
   * The text with a plain quote, apostrophe or hyphen put right where its
   * drawing is the typographic one (a curly quote, an em dash), character for
   * character, so every index of the text the recogniser returned still holds.
   */
  text: string;
  /** Per character (code point) of `text`: the colour its ink is drawn in; null for a space or a character with no ink found. */
  inks: Array<string | null>;
  /**
   * Per character: the width in px of the stems of the word holding it (the
   * middle half of the ink runs along its rows, by length), which a bold face
   * sets wider at the same size; null for a space. A caller compares words of
   * one size, or divides by the size first.
   */
  stems: Array<number | null>;
  /** Characters placed on ink of their own (a word and its letters matched one to one); the others by their usual widths. */
  measured: number;
  /** The height in px of the line's ink, ascenders to descenders, as far as the box holds them. */
  inkHeight: number;
}

/** A word gap is at least this share of the line's ink height... */
const GLYPH_WORD_GAP = 0.12;
/** ...and wider than every letter gap by this factor. */
const GLYPH_WORD_GAP_RATIO = 1.15;
/** A mark whose ink stays in this top share of the line's ink height stands above the letters (a quote, an apostrophe). */
const GLYPH_HIGH_SHARE = 0.5;
/** A quote mark is found within this many ink heights of where its character is estimated to sit. */
const GLYPH_REACH = 0.8;
/** A quote leaning this share of its height from top to bottom is drawn curved; a straight one stands upright. */
const GLYPH_CURL_LEAN = 0.12;
/** ...and its heavy end (the ball of a 9 or a 6) is this much wider than the tail. */
const GLYPH_CURL_BALL = 1.15;
/** A dash's bar is at most this share of the ink height thick... */
const GLYPH_BAR_THICK = 0.24;
/** ...centred between these shares of the ink height from its top. */
const GLYPH_BAR_FROM = 0.28;
const GLYPH_BAR_TO = 0.8;
/** A bar this many ink heights long is an em dash; a hyphen is well under half of it. */
const GLYPH_EM_DASH = 0.75;
/** A character drawn this far (summed channels) from its line's colour is drawn in a colour of its own... */
const GLYPH_APART = 90;
/** ...when that colour stands off the ground at least this share of the distance the line's colour does. */
const GLYPH_STANDS_OFF = 0.5;
/** A colour filling more than this share of the margin above and below a character is the ground behind it. */
const GLYPH_MAX_FILL = 0.5;
/** A character with at least this share of its ink in the line's own colour is drawn in that colour. */
const GLYPH_LINE_SHARE = 0.15;
/** A quote mark smaller than this many pixels tall carries no shape to read. */
const GLYPH_MIN_MARK = 4;
/** The work on one line is bounded: a box larger than this many pixels is read on a stride. */
const GLYPH_PIXEL_CAP = 262_144;

function channelsApart(a: string, b: string): number {
  const x = rgbOfHex(a);
  const y = rgbOfHex(b);
  if (!x || !y) return 0;
  return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]);
}

/**
 * Letters shared out over fewer ink pieces than there are letters (touching
 * letters make one piece): each piece takes a run of the letters, in order,
 * at least one each, the runs chosen so the letters' usual widths, scaled to
 * the pieces' span, fit the pieces' widths best. Dynamic programming over at
 * most a word's letters; returns one `{ from, to }` (letter indexes) per piece.
 */
function fitPieces(pieces: Array<{ a: number; b: number }>, advances: number[]): Array<{ from: number; to: number }> {
  const m = pieces.length;
  const n = advances.length;
  const span = (pieces[m - 1]?.b ?? 0) - (pieces[0]?.a ?? 0) + 1;
  const total = advances.reduce((sum, v) => sum + v, 0) || 1;
  const scale = span / total;
  const prefix = [0];
  for (const v of advances) prefix.push((prefix[prefix.length - 1] ?? 0) + v);
  // cost[i][j]: best cost of the first i pieces taking the first j letters.
  const cost: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(Number.POSITIVE_INFINITY));
  const from: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(-1));
  const row0 = cost[0];
  if (row0) row0[0] = 0;
  for (let i = 1; i <= m; i++) {
    const p = pieces[i - 1];
    const width = p ? p.b - p.a + 1 : 0;
    for (let j = i; j <= n - (m - i); j++) {
      for (let k = i - 1; k < j; k++) {
        const prior = cost[i - 1]?.[k] ?? Number.POSITIVE_INFINITY;
        if (!Number.isFinite(prior)) continue;
        const here = prior + Math.abs(width - scale * ((prefix[j] ?? 0) - (prefix[k] ?? 0)));
        const row = cost[i];
        if (row && here < (row[j] ?? Number.POSITIVE_INFINITY)) {
          row[j] = here;
          const back = from[i];
          if (back) back[j] = k;
        }
      }
    }
  }
  const out: Array<{ from: number; to: number }> = [];
  let j = n;
  for (let i = m; i >= 1; i--) {
    const k = from[i]?.[j] ?? i - 1;
    out.unshift({ from: k, to: j - 1 });
    j = k;
  }
  return out;
}

/** Usual advance widths in ems, by character, for placing characters no ink separated. */
function advanceOf(ch: string): number {
  if (ch === ' ') return 0.28;
  if ('iljI!.,:;|\'`'.includes(ch)) return 0.26;
  if ('ftr()[]"-'.includes(ch)) return 0.36;
  if ('mwMW'.includes(ch)) return 0.86;
  if (ch === '\u2014') return 1;
  if (ch === '\u2013') return 0.5;
  if (/[A-Z]/.test(ch)) return 0.66;
  if (/[0-9]/.test(ch)) return 0.56;
  return 0.54;
}

/**
 * Read one line's characters from its pixels. `box` is the recogniser's box
 * for the line (it pads above and below the letters, which is where the
 * ground is read, column by column, as `lineGroundOf` reads it). Characters are
 * placed on the ink: blank columns split the line into pieces, the widest gaps
 * are the spaces when there are as many of them as the text has, and a word
 * whose pieces match its letters one to one is placed exactly; otherwise the
 * characters take their usual widths across the word's ink. Each character's
 * colour is read from its own columns as `lineInkColourOf` reads a line's: among
 * the colours holding a real share of its ink, the one furthest from the ground.
 *
 * A quote the recogniser read plain becomes curly only on its own evidence: a
 * mark standing clear of the letters close to the quote's estimated place, leaning from
 * top to bottom and heavier at one end, as a 9 or a 6 is drawn; a straight
 * quote stands upright. A hyphen becomes an em dash only when a bar at dash
 * height, close to the hyphen's estimated place, runs at least `GLYPH_EM_DASH` of the
 * ink height. Null when the box holds no ink. Pure; reads the box a bounded
 * number of times.
 */
export function lineGlyphsOf(image: RgbaImageV1, box: RegionBoxV1, text: string): LineGlyphsV1 | null {
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(image.width, Math.ceil(box.x + box.w));
  const y1 = Math.min(image.height, Math.ceil(box.y + box.h));
  const chars = Array.from(text);
  if (x1 <= x0 || y1 <= y0 || chars.length === 0) return null;
  const w = x1 - x0;
  const h = y1 - y0;
  // A very large box is read on a stride across, never down: a character's rows all count.
  const stride = Math.max(1, Math.ceil((w * h) / GLYPH_PIXEL_CAP));
  const ground = lineGroundOf(image, box);
  const groundAt = (x: number): Rgb => ground.colours[Math.min(ground.colours.length - 1, Math.floor((x - x0) / ground.step))] ?? [255, 255, 255];
  const cols = Math.ceil(w / stride);
  // Distance of every read pixel from its column's ground; 0 below the ink floor.
  const dist = new Uint16Array(cols * h);
  const rowInk = new Uint32Array(h);
  for (let c = 0; c < cols; c++) {
    const x = x0 + c * stride;
    const g = groundAt(x);
    for (let r = 0; r < h; r++) {
      const i = ((y0 + r) * image.width + x) * 4;
      const d = Math.abs((image.data[i] ?? 0) - g[0]) + Math.abs((image.data[i + 1] ?? 0) - g[1]) + Math.abs((image.data[i + 2] ?? 0) - g[2]);
      if (d < TEXT_MIN_CONTRAST) continue;
      dist[c * h + r] = d;
      rowInk[r] = (rowInk[r] ?? 0) + 1;
    }
  }
  // The line's ink band: rows holding a real share of the fullest row's ink,
  // so a speck of texture above or below the letters does not stretch it.
  let fullest = 0;
  for (const n of rowInk) fullest = Math.max(fullest, n);
  if (fullest === 0) return null;
  let top = -1;
  let bottom = -1;
  rowInk.forEach((n, r) => {
    if (n < Math.max(1, TEXT_INK_FLOOR * fullest)) return;
    if (top < 0) top = r;
    bottom = r;
  });
  const inkHeight = bottom - top + 1;
  // Per column: ink rows inside the band.
  const colTop = new Int32Array(cols).fill(-1);
  const colBottom = new Int32Array(cols).fill(-1);
  for (let c = 0; c < cols; c++) {
    for (let r = top; r <= bottom; r++) {
      if (!dist[c * h + r]) continue;
      if (colTop[c] === -1) colTop[c] = r;
      colBottom[c] = r;
    }
  }
  // Pieces: runs of columns holding ink, split by blank columns.
  const pieces: Array<{ a: number; b: number }> = [];
  for (let c = 0; c < cols; c++) {
    if (colTop[c] === -1) continue;
    const last = pieces[pieces.length - 1];
    if (last && last.b === c - 1) last.b = c;
    else pieces.push({ a: c, b: c });
  }
  if (pieces.length === 0) return null;
  const heightCols = inkHeight / stride;

  // Words of the text, as [first, last] character indexes.
  const words: Array<{ s: number; e: number }> = [];
  chars.forEach((ch, k) => {
    if (!ch.trim()) return;
    const last = words[words.length - 1];
    if (last && last.e === k - 1) last.e = k;
    else words.push({ s: k, e: k });
  });
  // Word ranges on the ink: the widest gaps when there are enough of them and
  // they stand clear of the letter gaps; else the whole line as one range.
  const gaps = pieces.slice(1).map((p, k) => ({ k, width: p.a - (pieces[k]?.b ?? p.a) - 1 }));
  let ranges: Array<{ a: number; b: number; pieces: Array<{ a: number; b: number }> }> | null = null;
  if (words.length === 1) ranges = [{ a: pieces[0]?.a ?? 0, b: pieces[pieces.length - 1]?.b ?? 0, pieces }];
  else if (words.length > 1 && gaps.length >= words.length - 1) {
    const ranked = [...gaps].sort((p, q) => q.width - p.width || p.k - q.k);
    const chosen = ranked.slice(0, words.length - 1);
    const narrowest = chosen[chosen.length - 1]?.width ?? 0;
    const widestOther = ranked[words.length - 1]?.width ?? 0;
    if (narrowest >= Math.max(1, GLYPH_WORD_GAP * heightCols) && narrowest >= GLYPH_WORD_GAP_RATIO * widestOther) {
      const cuts = new Set(chosen.map((g) => g.k));
      ranges = [];
      let start = 0;
      pieces.forEach((_, k) => {
        if (k === pieces.length - 1 || cuts.has(k)) {
          const own = pieces.slice(start, k + 1);
          ranges?.push({ a: own[0]?.a ?? 0, b: own[own.length - 1]?.b ?? 0, pieces: own });
          start = k + 1;
        }
      });
    }
  }
  // Each character's columns [a, b], placed on its word's ink.
  const place: Array<{ a: number; b: number; exact: boolean } | null> = chars.map(() => null);
  const spread = (from: number, to: number, a: number, b: number): void => {
    let total = 0;
    for (let k = from; k <= to; k++) total += advanceOf(chars[k] ?? ' ');
    let at = a;
    for (let k = from; k <= to; k++) {
      const share = ((b - a + 1) * advanceOf(chars[k] ?? ' ')) / Math.max(1e-6, total);
      if (chars[k]?.trim()) place[k] = { a: Math.round(at), b: Math.max(Math.round(at), Math.round(at + share) - 1), exact: false };
      at += share;
    }
  };
  if (ranges) {
    words.forEach((word, n) => {
      const range = ranges?.[n];
      if (!range) return;
      if (range.pieces.length === word.e - word.s + 1) {
        range.pieces.forEach((p, k) => { place[word.s + k] = { a: p.a, b: p.b, exact: true }; });
      } else if (range.pieces.length > 1 && range.pieces.length < word.e - word.s + 1) {
        // Fewer pieces than letters (letters touching): each piece takes the
        // run of letters whose usual widths fit it best, and shares it out.
        const groups = fitPieces(range.pieces, chars.slice(word.s, word.e + 1).map(advanceOf));
        groups.forEach((group, i) => {
          const p = range.pieces[i];
          if (!p) return;
          if (group.to === group.from) place[word.s + group.from] = { a: p.a, b: p.b, exact: true };
          else spread(word.s + group.from, word.s + group.to, p.a, p.b);
        });
      } else {
        spread(word.s, word.e, range.a, range.b);
      }
    });
  } else {
    const first = words[0]?.s ?? 0;
    const last = words[words.length - 1]?.e ?? chars.length - 1;
    spread(first, last, pieces[0]?.a ?? 0, pieces[pieces.length - 1]?.b ?? 0);
  }

  // The colour of each character, read from its own columns.
  const keyOf = (c: Rgb): number => ((c[0] >> 4) << 8) | ((c[1] >> 4) << 4) | (c[2] >> 4);
  const inkOf = (a: number, b: number): string | null => {
    const counts = new Map<number, number>();
    const sums = new Map<number, Rgb>();
    const far = new Map<number, number>();
    for (let c = Math.max(0, a); c <= Math.min(cols - 1, b); c++) {
      const x = x0 + c * stride;
      for (let r = top; r <= bottom; r++) {
        const d = dist[c * h + r] ?? 0;
        if (!d) continue;
        const i = ((y0 + r) * image.width + x) * 4;
        const px: Rgb = [image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0];
        const key = keyOf(px);
        counts.set(key, (counts.get(key) ?? 0) + 1);
        far.set(key, (far.get(key) ?? 0) + d);
        const sum = sums.get(key);
        if (sum) {
          sum[0] += px[0];
          sum[1] += px[1];
          sum[2] += px[2];
        } else {
          sums.set(key, [px[0], px[1], px[2]]);
        }
      }
    }
    let most = 0;
    for (const n of counts.values()) most = Math.max(most, n);
    if (most === 0) return null;
    let bestKey = -1;
    let bestFar = -1;
    let bestCount = 0;
    for (const [key, n] of counts) {
      if (n < LINE_INK_CANDIDATE * most) continue;
      const d = (far.get(key) ?? 0) / n;
      if (d > bestFar || (d === bestFar && (n > bestCount || (n === bestCount && key < bestKey)))) {
        bestFar = d;
        bestCount = n;
        bestKey = key;
      }
    }
    const sum = sums.get(bestKey);
    return sum && bestCount ? hexOf([sum[0] / bestCount, sum[1] / bestCount, sum[2] / bestCount]) : null;
  };

  // How heavy each word is: the width of its stems, from the runs of stroke
  // pixels along its rows. A stroke pixel stands at least half as far from the
  // ground as the line's strong ink does, so an anti-aliased edge counts once
  // on each side, as a half.
  const strong: number[] = [];
  for (let k = 0; k < dist.length; k += Math.max(1, Math.floor(dist.length / 4096))) if (dist[k]) strong.push(dist[k] ?? 0);
  strong.sort((p, q) => p - q);
  const half = 0.5 * (strong[Math.floor(0.9 * (strong.length - 1))] ?? TEXT_MIN_CONTRAST);
  const weightOf = (a: number, b: number): number | null => {
    // The runs through a stem are its width and outnumber the long runs along a
    // bar or a bowl's top, so the middle half of the runs by length is the stem.
    const runs: number[] = [];
    for (let r = top; r <= bottom; r++) {
      let length = 0;
      for (let c = Math.max(0, a); c <= Math.min(cols - 1, b) + 1; c++) {
        const on = c <= Math.min(cols - 1, b) && (dist[c * h + r] ?? 0) >= half;
        if (on) length += stride;
        else if (length) {
          runs.push(length);
          length = 0;
        }
      }
    }
    if (runs.length === 0) return null;
    runs.sort((p, q) => p - q);
    const from = Math.floor(runs.length / 4);
    const to = Math.max(from + 1, Math.ceil((3 * runs.length) / 4));
    let sum = 0;
    for (let k = from; k < to; k++) sum += runs[k] ?? 0;
    return sum / (to - from);
  };

  // A character holding a real share of pixels in the line's own colour is
  // drawn in it, whatever else its columns hold (a pale button behind a dark
  // word): only a character with next to none is read for a colour of its own.
  const lineInk = inkOf(0, cols - 1);
  const lineRgb = lineInk ? rgbOfHex(lineInk) : null;
  const ownShare = (a: number, b: number): number => {
    if (!lineRgb) return 0;
    let near = 0;
    let all = 0;
    for (let c = Math.max(0, a); c <= Math.min(cols - 1, b); c++) {
      const x = x0 + c * stride;
      for (let r = top; r <= bottom; r++) {
        if (!dist[c * h + r]) continue;
        all++;
        const i = ((y0 + r) * image.width + x) * 4;
        const d = Math.abs((image.data[i] ?? 0) - lineRgb[0]) + Math.abs((image.data[i + 1] ?? 0) - lineRgb[1]) + Math.abs((image.data[i + 2] ?? 0) - lineRgb[2]);
        if (d <= TEXT_INK_NEAR) near++;
      }
    }
    return all ? near / all : 0;
  };
  /**
   * The share of the box's rows above and below the ink band, over a column
   * range, that a colour fills: a ground behind the text (a button, a card)
   * runs on past the letters into that margin, and a letter's own strokes do not.
   */
  const fillOf = (hex: string, a: number, b: number): number => {
    const rgb = rgbOfHex(hex);
    if (!rgb) return 0;
    let near = 0;
    let all = 0;
    for (let c = Math.max(0, a); c <= Math.min(cols - 1, b); c++) {
      const x = x0 + c * stride;
      for (let r = 0; r < h; r++) {
        if (r >= top && r <= bottom) continue;
        all++;
        const i = ((y0 + r) * image.width + x) * 4;
        const d = Math.abs((image.data[i] ?? 0) - rgb[0]) + Math.abs((image.data[i + 1] ?? 0) - rgb[1]) + Math.abs((image.data[i + 2] ?? 0) - rgb[2]);
        if (d <= TEXT_INK_NEAR) near++;
      }
    }
    return all ? near / all : 0;
  };
  // Every character is drawn in the line's colour unless it holds next to
  // none of it and its own colour stands clearly apart (a colour running on
  // into the margin above and below the letters is the ground behind them, a
  // pale button or a card, never their strokes). A stretch of such characters in one colour is emphasis when the
  // colour changes sharply at each end it has a neighbour on; a line whose
  // colour drifts along a gradient changes by a little from letter to letter
  // and stays one colour. One letter apart inside a word is a misreading.
  const raw: Array<string | null> = chars.map(() => null);
  const candidate: boolean[] = chars.map(() => false);
  const inks: Array<string | null> = chars.map(() => null);
  const stems: Array<number | null> = chars.map(() => null);
  let measured = 0;
  chars.forEach((ch, k) => {
    const at = place[k];
    if (!at || !ch.trim()) return;
    if (at.exact) measured++;
    // An estimated place keeps to its middle, clear of its neighbours' ink.
    const trim = at.exact ? 0 : Math.floor((at.b - at.a + 1) * 0.15);
    const own = inkOf(at.a + trim, at.b - trim);
    raw[k] = own;
    inks[k] = lineInk;
    // Text in another colour is set to be read as well as the rest: it stands
    // off the ground about as far as the line's own colour does, where a faint
    // line of a drawing behind the text does not.
    const g = groundAt(x0 + Math.round((at.a + at.b) / 2) * stride);
    const hexOfGround = hexOf(g);
    const standsOff = own !== null && lineInk !== null && channelsApart(own, hexOfGround) >= GLYPH_STANDS_OFF * channelsApart(lineInk, hexOfGround);
    candidate[k] = own !== null && lineInk !== null && standsOff && channelsApart(own, lineInk) > GLYPH_APART
      && ownShare(at.a + trim, at.b - trim) < GLYPH_LINE_SHARE && fillOf(own, at.a + trim, at.b - trim) <= GLYPH_MAX_FILL;
  });
  const solid = (k: number): boolean => Boolean(chars[k]?.trim()) && raw[k] !== null;
  for (let k = 0; k < chars.length;) {
    if (!candidate[k]) {
      k++;
      continue;
    }
    const first = raw[k] ?? '';
    let e = k;
    for (let j = k + 1; j < chars.length; j++) {
      if (!solid(j)) {
        if (chars[j]?.trim()) break;
        continue;
      }
      if (!candidate[j] || channelsApart(raw[j] ?? '', first) > GLYPH_APART) break;
      e = j;
    }
    let before = k - 1;
    while (before >= 0 && !chars[before]?.trim()) before--;
    let after = e + 1;
    while (after < chars.length && !chars[after]?.trim()) after++;
    const sharp = (at: number, edge: number): boolean | null => {
      if (at < 0 || at >= chars.length) return null;
      const there = raw[at];
      return there !== null && there !== undefined && channelsApart(there, raw[edge] ?? '') > GLYPH_APART / 2;
    };
    const ends = [sharp(before, k), sharp(after, e)].filter((v): v is boolean => v !== null);
    const lone = e === k && /\p{L}/u.test(chars[k] ?? '') && /\p{L}/u.test(chars[k - 1] ?? '') && /\p{L}/u.test(chars[k + 1] ?? '');
    if (ends.length > 0 && ends.every(Boolean) && !lone) for (let j = k; j <= e; j++) if (chars[j]?.trim()) inks[j] = first;
    k = e + 1;
  }
  for (const word of words) {
    const a = place[word.s]?.a;
    const b = place[word.e]?.b;
    if (a === undefined || b === undefined) continue;
    const stem = weightOf(a, b);
    for (let k = word.s; k <= word.e; k++) stems[k] = stem;
  }

  // Quotes and dashes, on their own evidence.
  const out = [...chars];
  const centreOf = (k: number): number | null => {
    const at = place[k];
    return at ? (at.a + at.b) / 2 : null;
  };
  /** Pieces standing clear above the letters: every ink row in the top share of the band. */
  const high = pieces.filter((p) => {
    for (let c = p.a; c <= p.b; c++) if ((colBottom[c] ?? -1) > top + GLYPH_HIGH_SHARE * inkHeight) return false;
    return p.b - p.a + 1 <= 0.6 * heightCols;
  });
  /** How a mark is drawn: `close` a 9 (heavy top, leaning), `open` a 6, `straight` upright, null when too small to say. */
  const shapeOf = (p: { a: number; b: number }): 'close' | 'open' | 'straight' | null => {
    const rows: Array<{ r: number; left: number; right: number }> = [];
    for (let r = top; r <= bottom; r++) {
      let left = -1;
      let right = -1;
      for (let c = p.a; c <= p.b; c++) {
        if (!dist[c * h + r]) continue;
        if (left < 0) left = c;
        right = c;
      }
      if (left >= 0) rows.push({ r, left, right });
    }
    if (rows.length < GLYPH_MIN_MARK) return null;
    const third = Math.max(1, Math.floor(rows.length / 3));
    const upper = rows.slice(0, third);
    const lower = rows.slice(rows.length - third);
    const mean = (list: typeof rows, f: (row: (typeof rows)[number]) => number): number => list.reduce((n, row) => n + f(row), 0) / list.length;
    const lean = (mean(upper, (row) => (row.left + row.right) / 2) - mean(lower, (row) => (row.left + row.right) / 2)) * stride / rows.length;
    const topWidth = mean(upper, (row) => row.right - row.left + 1);
    const lowWidth = mean(lower, (row) => row.right - row.left + 1);
    if (lean < GLYPH_CURL_LEAN) return 'straight';
    if (topWidth >= GLYPH_CURL_BALL * lowWidth) return 'close';
    if (lowWidth >= GLYPH_CURL_BALL * topWidth) return 'open';
    return null;
  };
  const used = new Set<{ a: number; b: number }>();
  const nearestHigh = (centre: number, count: number): Array<{ a: number; b: number }> =>
    high
      .filter((p) => !used.has(p) && Math.abs((p.a + p.b) / 2 - centre) <= GLYPH_REACH * heightCols)
      .sort((p, q) => Math.abs((p.a + p.b) / 2 - centre) - Math.abs((q.a + q.b) / 2 - centre) || p.a - q.a)
      .slice(0, count)
      .sort((p, q) => p.a - q.a);
  /** Runs of columns drawing only a thin bar at dash height. */
  const bars: Array<{ a: number; b: number }> = [];
  for (let c = 0; c < cols; c++) {
    const t = colTop[c] ?? -1;
    const bt = colBottom[c] ?? -1;
    const middle = (t + bt) / 2 - top;
    const bar = t >= 0 && bt - t + 1 <= GLYPH_BAR_THICK * inkHeight && middle >= GLYPH_BAR_FROM * inkHeight && middle <= GLYPH_BAR_TO * inkHeight;
    if (!bar) continue;
    const last = bars[bars.length - 1];
    if (last && last.b === c - 1) last.b = c;
    else bars.push({ a: c, b: c });
  }
  /** An opening double quote this line draws curly: its closing partner is drawn in the same face. */
  let openDouble = false;
  chars.forEach((ch, k) => {
    const centre = centreOf(k);
    if (centre === null) return;
    if (ch === "'" || ch === '"') {
      const marks = nearestHigh(centre, ch === '"' ? 2 : 1);
      if (marks.length !== (ch === '"' ? 2 : 1)) {
        // A closing quote run into the letter before it has no marks of its
        // own to read; the curly opening quote it closes is the evidence.
        if (ch === '"' && openDouble && k > 0 && (chars[k - 1]?.trim() ?? '') !== '') {
          out[k] = '\u201d';
          openDouble = false;
        }
        return;
      }
      const shapes = marks.map(shapeOf);
      const shape = shapes[0];
      if (!shape || shape === 'straight' || shapes.some((s) => s !== shape)) return;
      for (const m of marks) used.add(m);
      if (ch === "'") out[k] = shape === 'close' ? '\u2019' : '\u2018';
      else {
        out[k] = shape === 'close' ? '\u201d' : '\u201c';
        openDouble = shape === 'open';
      }
      return;
    }
    if (ch === '-') {
      const bar = bars
        .filter((p) => Math.abs((p.a + p.b) / 2 - centre) <= GLYPH_REACH * heightCols + (p.b - p.a) / 2)
        .sort((p, q) => Math.abs((p.a + p.b) / 2 - centre) - Math.abs((q.a + q.b) / 2 - centre) || p.a - q.a)[0];
      if (bar && (bar.b - bar.a + 1) * stride >= GLYPH_EM_DASH * inkHeight) out[k] = '\u2014';
    }
  });
  return { text: out.join(''), inks, stems, measured, inkHeight };
}

// ─── painting text out of a picture ──────────────────────────────────────────

/**
 * The image with every pixel inside `boxes` painted from the pixels around
 * them, smoothly (plan 275 WP10 part B): a picture kept whole under text set
 * over it (a photograph behind a title) is stored with that text painted out,
 * so the rebuilt text is drawn once and a layout that moves it leaves a soft
 * patch rather than streaks. The fill is push and pull over an image pyramid:
 * each level halves the one below, averaging only the pixels that are not
 * painted out, until every pixel has a value; then each level fills its
 * painted-out pixels from the level above, read between its four nearest
 * pixels. Linear in the pixels; the alpha channel is filled the same way. The
 * image passed in is not changed. Pure and deterministic.
 */
export function paintOutBoxes(image: RgbaImageV1, boxes: RegionBoxV1[]): RgbaImageV1 {
  const { width, height } = image;
  const data = new Uint8ClampedArray(image.data);
  const known = new Float32Array(width * height).fill(1);
  let any = false;
  for (const b of boxes) {
    const x0 = Math.max(0, Math.floor(b.x));
    const y0 = Math.max(0, Math.floor(b.y));
    const x1 = Math.min(width, Math.ceil(b.x + b.w));
    const y1 = Math.min(height, Math.ceil(b.y + b.h));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      known[y * width + x] = 0;
      any = true;
    }
  }
  if (!any || width === 0 || height === 0) return { width, height, data };
  interface Level { w: number; h: number; c: Float32Array; k: Float32Array }
  const base: Level = { w: width, h: height, c: new Float32Array(width * height * 4), k: new Float32Array(known) };
  for (let i = 0; i < width * height * 4; i++) base.c[i] = data[i] ?? 0;
  const levels: Level[] = [base];
  // Push: halve, averaging the known pixels, until nothing is unknown.
  for (let level = base; ;) {
    let unknown = false;
    for (let i = 0; i < level.k.length; i++) if ((level.k[i] ?? 0) === 0) { unknown = true; break; }
    if (!unknown || (level.w === 1 && level.h === 1)) break;
    const w = Math.max(1, Math.ceil(level.w / 2));
    const h = Math.max(1, Math.ceil(level.h / 2));
    const next: Level = { w, h, c: new Float32Array(w * h * 4), k: new Float32Array(w * h) };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let weight = 0;
        const sum = [0, 0, 0, 0];
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const sx = 2 * x + dx;
            const sy = 2 * y + dy;
            if (sx >= level.w || sy >= level.h) continue;
            const j = sy * level.w + sx;
            const kw = level.k[j] ?? 0;
            if (kw <= 0) continue;
            weight += kw;
            for (let ch = 0; ch < 4; ch++) sum[ch] = (sum[ch] ?? 0) + kw * (level.c[j * 4 + ch] ?? 0);
          }
        }
        const j = y * w + x;
        if (weight > 0) {
          for (let ch = 0; ch < 4; ch++) next.c[j * 4 + ch] = (sum[ch] ?? 0) / weight;
          next.k[j] = Math.min(1, weight);
        }
      }
    }
    levels.push(next);
    level = next;
  }
  // Pull: fill each level's unknown share from the level above, read bilinearly.
  for (let n = levels.length - 2; n >= 0; n--) {
    const fine = levels[n];
    const coarse = levels[n + 1];
    if (!fine || !coarse) continue;
    for (let y = 0; y < fine.h; y++) {
      for (let x = 0; x < fine.w; x++) {
        const j = y * fine.w + x;
        const kw = fine.k[j] ?? 0;
        if (kw >= 1) continue;
        const u = Math.min(coarse.w - 1, Math.max(0, (x + 0.5) / 2 - 0.5));
        const v = Math.min(coarse.h - 1, Math.max(0, (y + 0.5) / 2 - 0.5));
        const ux = Math.floor(u);
        const vy = Math.floor(v);
        const fx = u - ux;
        const fy = v - vy;
        const ux1 = Math.min(coarse.w - 1, ux + 1);
        const vy1 = Math.min(coarse.h - 1, vy + 1);
        for (let ch = 0; ch < 4; ch++) {
          const at = (xx: number, yy: number): number => coarse.c[(yy * coarse.w + xx) * 4 + ch] ?? 0;
          const up = (at(ux, vy) * (1 - fx) + at(ux1, vy) * fx) * (1 - fy) + (at(ux, vy1) * (1 - fx) + at(ux1, vy1) * fx) * fy;
          fine.c[j * 4 + ch] = kw * (fine.c[j * 4 + ch] ?? 0) + (1 - kw) * up;
        }
        fine.k[j] = 1;
      }
    }
  }
  for (let i = 0; i < width * height; i++) {
    if ((known[i] ?? 0) >= 1) continue;
    for (let ch = 0; ch < 4; ch++) data[i * 4 + ch] = Math.round(base.c[i * 4 + ch] ?? 0);
  }
  return { width, height, data };
}

/**
 * Which way the ink in a box runs: the principal axis of the pixels standing
 * off `ground` by at least `TEXT_MIN_CONTRAST`, from their second moments, as
 * degrees from the horizontal (positive rising to the right, in (-90, 90]),
 * and how much longer the ink is along that axis than across it (the square
 * root of the ratio of the two spreads). A word set at an angle, or a label
 * running along a curved arrow, reads well off 0 degrees and long; a patch of
 * texture reads short. Null with fewer than a handful of ink pixels. Sampled
 * on a stride, at most 65,536 pixels. Pure.
 */
export function inkAngleOf(image: RgbaImageV1, box: RegionBoxV1, ground: string): { degrees: number; elongation: number } | null {
  const g = rgbOfHex(ground);
  if (!g) return null;
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(image.width, Math.ceil(box.x + box.w));
  const y1 = Math.min(image.height, Math.ceil(box.y + box.h));
  if (x1 <= x0 || y1 <= y0) return null;
  const stride = Math.max(1, Math.ceil(Math.sqrt(((x1 - x0) * (y1 - y0)) / COLOUR_SAMPLE_CAP)));
  let n = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let y = y0; y < y1; y += stride) {
    for (let x = x0; x < x1; x += stride) {
      const i = (y * image.width + x) * 4;
      const d = Math.abs((image.data[i] ?? 0) - g[0]) + Math.abs((image.data[i + 1] ?? 0) - g[1]) + Math.abs((image.data[i + 2] ?? 0) - g[2]);
      if (d < TEXT_MIN_CONTRAST) continue;
      // Image rows run down; the angle is measured with y up.
      const u = x - x0;
      const v = y1 - y;
      n++;
      sx += u;
      sy += v;
      sxx += u * u;
      syy += v * v;
      sxy += u * v;
    }
  }
  if (n < 8) return null;
  const mx = sx / n;
  const my = sy / n;
  const cxx = sxx / n - mx * mx;
  const cyy = syy / n - my * my;
  const cxy = sxy / n - mx * my;
  const theta = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
  const mean = (cxx + cyy) / 2;
  const spread = Math.sqrt(((cxx - cyy) / 2) ** 2 + cxy ** 2);
  const along = mean + spread;
  const across = Math.max(1e-6, mean - spread);
  let degrees = (theta * 180) / Math.PI;
  if (degrees <= -90) degrees += 180;
  return { degrees: Math.round(degrees * 10) / 10, elongation: Math.round(Math.sqrt(along / across) * 100) / 100 };
}
