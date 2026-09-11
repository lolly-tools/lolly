// SPDX-License-Identifier: MPL-2.0
/**
 * THE TWO BLUR LANES - how a composited layer gets blurred on a canvas (plan 104
 * section 5.5, and the answer to section 11 S1).
 *
 * The sequence compositor owns the whole blur now: `PlanItem.blur` is authored +
 * keyframe `b` + depth-of-field, plates are shot with the element's own `filter`
 * neutralised, and the executor applies the number exactly once. Which leaves one
 * question - HOW does a canvas blur?
 *
 *   • THE FILTER LANE. `ctx.filter = 'blur(Npx) drop-shadow(...)'`, one property
 *     write, the engine's own separable Gaussian. Available wherever
 *     `lib/canvas-filter-probe.ts` says it is - and ONLY there. section 11 S1 measured
 *     WebKit 26.5 with no `ctx.filter` on any of the three context kinds, and with an
 *     assign-and-read-back check that reports success anyway (the value is stored as
 *     an expando). The probe is the only support truth in this codebase.
 *
 *   • THE MIP LANE. Downscale to a mip level whose residual blur is a couple of
 *     pixels, run a three-pass box blur there (three boxes approximate a Gaussian to
 *     within ~3 % - Wells' construction), and scale back up. This is the SAFARI
 *     MAINLINE, not a legacy corner: on a WebKit build it is the only lane there is,
 *     so it is built to the same bar and golden-compared against the filter lane
 *     (`tests/canvas-blur-lanes.browser.test.ts` states the measured tolerance).
 *
 * Both lanes run at IDENTITY TRANSFORM on a scratch of the plate's own resolution,
 * and the filtered result is then drawn through the executor's transform like any
 * other image. That is deliberate and it is the reason the filter lane bothers with a
 * scratch at all: `ctx.filter` inside a `ctx.scale(...)` is interpreted differently by
 * different engines (user space vs device space), which would make the two lanes
 * disagree the moment a layer had a scale transition - and would make the tolerance
 * golden meaningless. Blurring at plate resolution also matches the CSS the DOM
 * evaluator writes, where `filter` applies in the element's own box before `transform`
 * magnifies the result.
 *
 * WHAT THE MIP LANE REPRODUCES. The authored vocabulary is exactly `blur(Npx)` and
 * `drop-shadow(x y b color)` - those are the only two filter functions the tool hooks
 * ever write (`blurCss`, `shadowCss`, merged blur-first so the shadow follows the
 * blurred silhouette). Both are reproduced. Any OTHER filter function in the authored
 * remainder rides the filter lane verbatim and is DROPPED on the mip lane; that is a
 * stated limit rather than a hidden one, and it is unreachable from the shipping
 * tools.
 *
 * SIGMA, NOT RADIUS. `blur(Npx)` is a Gaussian of standard deviation N (Filter
 * Effects section blur). `drop-shadow`'s third length is a blur RADIUS and its standard
 * deviation is half of it. Getting that factor of two backwards is the classic way to
 * make a shadow twice as soft as the browser draws it, so the two are separate types
 * here and the halving happens in exactly one place.
 *
 * DOM-FREE AT IMPORT. Every global is reached behind a `typeof` guard inside a
 * function, so this module loads in a Worker, in jsdom and in bare Node - which is
 * what lets `canvas-blur.test.ts` drive the whole decision table headlessly, and what
 * lets the executor import it without giving up its DOM-free contract.
 */

import { canvasFilterWorks } from './canvas-filter-probe.ts';

export type BlurCanvas = HTMLCanvasElement | OffscreenCanvas;
export type BlurCtx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Which lane a composite took. Exposed so a caller can log or assert on it. */
export type BlurLane = 'filter' | 'mip';

/** A scratch canvas and its context, handed out by the pool. */
export interface BlurStage {
  canvas: BlurCanvas;
  ctx: BlurCtx;
  /** True when the context was created with `willReadFrequently` (the mip scratch). */
  readback: boolean;
}

// ── the canvas factory (and the seam a headless test drives) ────────────────

/** Makes a canvas of this realm's own kind, or null where the realm has none. */
export type BlurCanvasFactory = (w: number, h: number, readback: boolean) => BlurCanvas | null;

function defaultFactory(w: number, h: number): BlurCanvas | null {
  const cw = Math.max(1, Math.ceil(w));
  const ch = Math.max(1, Math.ceil(h));
  if (typeof OffscreenCanvas !== 'undefined') {
    try { return new OffscreenCanvas(cw, ch); } catch { /* refused: try the DOM kind */ }
  }
  if (typeof document !== 'undefined') {
    try {
      const el = document.createElement('canvas');
      el.width = cw;
      el.height = ch;
      return el;
    } catch { /* no document canvas either */ }
  }
  return null;
}

let factory: BlurCanvasFactory = defaultFactory;

/**
 * Replace the canvas factory. TESTS ONLY - it is what lets the Node tier drive the
 * restructured `drawItem` against a recording canvas and assert the ORDER of the
 * passes, which is the part of section 5.5 that is a contract rather than a pixel.
 */
export function _setBlurCanvasFactory(f: BlurCanvasFactory | null): void {
  factory = f ?? defaultFactory;
  _resetBlurPool();
}

// ── the scratch pool ────────────────────────────────────────────────────────
//
// A blurred layer needs two to four scratch canvases per draw, and a 300-frame export
// draws it 300 times. Allocating them per frame is how a compositor ends up spending
// its export in the allocator, so they are pooled and RESIZED rather than remade.
// Two pools, because the mip lane reads pixels back (`getImageData`) and the filter
// lane must not: `willReadFrequently` asks an engine for a CPU-backed canvas, which is
// exactly right for the box-blur pass and exactly wrong for a GPU filter.

const POOL: BlurStage[] = [];
const READ_POOL: BlurStage[] = [];
/**
 * Retained scratches in the main pool.
 *
 * Sized for the DEEPEST chain, not the average one: a sigma-30 blur walks five levels
 * down and five back up, and a pool shorter than that re-allocates the difference on
 * every frame - which is the exact cost pooling exists to avoid. The chain's own sizes
 * fall away geometrically (w, w/2, w/4, …), so twelve slots is well under three
 * full-size canvases in the steady state, and the whole pool is dropped at the end of
 * a render (`releaseBlurScratches`) rather than kept warm for a frame that is not
 * coming.
 */
export const BLUR_POOL_MAX = 12;
/** The readback pool only ever holds the deepest (smallest) mip level. */
export const BLUR_READ_POOL_MAX = 2;

/**
 * Drop every retained scratch.
 *
 * A render that has finished should call this: the pool is holding up to eight
 * plate-sized canvases against a next frame that is not coming, and a finished export
 * has no business keeping tens of megabytes warm.
 */
export function releaseBlurScratches(): void {
  POOL.length = 0;
  READ_POOL.length = 0;
}

/** The same thing under the name the tests reach for. */
export const _resetBlurPool = releaseBlurScratches;

function contextOf(canvas: BlurCanvas, readback: boolean): BlurCtx | null {
  try {
    return canvas.getContext('2d', readback ? { willReadFrequently: true } : undefined) as BlurCtx | null;
  } catch {
    return null;
  }
}

/**
 * A cleared scratch of at least `w × h`, at identity transform with neutral
 * alpha/composite/filter, or null when this realm cannot make a canvas at all.
 *
 * Null is a legitimate answer, not a failure to handle later: in a jsdom test or a
 * headless CLI there is no canvas, and every caller here degrades to drawing the
 * unfiltered picture rather than losing the layer.
 */
export function takeStage(w: number, h: number, readback = false): BlurStage | null {
  const cw = Math.max(1, Math.ceil(w));
  const ch = Math.max(1, Math.ceil(h));
  const pool = readback ? READ_POOL : POOL;
  let stage = pool.pop() ?? null;
  if (!stage) {
    const canvas = factory(cw, ch, readback);
    if (!canvas) return null;
    const ctx = contextOf(canvas, readback);
    if (!ctx) return null;
    stage = { canvas, ctx, readback };
  }
  if (stage.canvas.width !== cw || stage.canvas.height !== ch) {
    // Assigning width/height also clears the bitmap, which is why the else-branch
    // has to clear by hand.
    stage.canvas.width = cw;
    stage.canvas.height = ch;
  } else {
    stage.ctx.setTransform(1, 0, 0, 1, 0, 0);
    stage.ctx.clearRect(0, 0, cw, ch);
  }
  stage.ctx.setTransform(1, 0, 0, 1, 0, 0);
  stage.ctx.globalAlpha = 1;
  stage.ctx.globalCompositeOperation = 'source-over';
  setFilter(stage.ctx, 'none');
  return stage;
}

/** Hand a scratch back. Safe to call with null (the "no canvas in this realm" path). */
export function releaseStage(stage: BlurStage | null | undefined): void {
  if (!stage) return;
  const pool = stage.readback ? READ_POOL : POOL;
  const max = stage.readback ? BLUR_READ_POOL_MAX : BLUR_POOL_MAX;
  if (pool.length < max && !pool.includes(stage)) pool.push(stage);
}

/** `ctx.filter = v` where the property exists. On an engine without it the assignment
 *  would only mint an expando, and `canvasFilterWorks` has already routed us away. */
function setFilter(ctx: BlurCtx, v: string): void {
  if ('filter' in (ctx as object)) (ctx as { filter: string }).filter = v;
}

// ── the authored filter, parsed ─────────────────────────────────────────────

/** One `drop-shadow()` term. `blur` is the CSS BLUR RADIUS; its sigma is half of it. */
export interface DropShadow {
  dx: number;
  dy: number;
  /** CSS blur radius, px. Never negative. */
  blur: number;
  color: string;
}

/** A drop-shadow's Gaussian standard deviation - the radius halved, once, here. */
export function shadowSigma(s: DropShadow): number {
  return s.blur > 0 ? s.blur / 2 : 0;
}

/** `name(args)` terms of a filter declaration, in order, parens-aware. */
export function parseFilterTerms(filter: string): { name: string; args: string }[] {
  const s = String(filter ?? '');
  const out: { name: string; args: string }[] = [];
  let i = 0;
  while (i < s.length) {
    const open = s.indexOf('(', i);
    if (open < 0) break;
    let depth = 1;
    let j = open + 1;
    while (j < s.length && depth > 0) {
      const c = s[j];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      j++;
    }
    if (depth !== 0) break;                       // unbalanced: stop, keep what parsed
    const name = s.slice(i, open).trim().toLowerCase();
    if (name) out.push({ name, args: s.slice(open + 1, j - 1) });
    i = j;
  }
  return out;
}

/** Whitespace-separated tokens, parens-aware (so `rgba(0, 0, 0, .3)` stays one token). */
function argTokens(args: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const c of args) {
    if (c === '(') depth++;
    if (c === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && /\s/.test(c)) {
      if (cur) { out.push(cur); cur = ''; }
      continue;
    }
    cur += c;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Every `drop-shadow()` in a filter declaration, in authored order.
 *
 * Lengths are read as px - the only unit the hooks author, and the only one a
 * compositor could resolve without a layout box. A missing length is 0 and a missing
 * colour is black, matching the CSS initial values.
 */
export function parseDropShadows(filter: string): DropShadow[] {
  const out: DropShadow[] = [];
  for (const term of parseFilterTerms(filter)) {
    if (term.name !== 'drop-shadow') continue;
    const nums: number[] = [];
    let color = '';
    for (const tok of argTokens(term.args)) {
      const v = parseFloat(tok);
      if (Number.isFinite(v) && /^[-+.\d]/.test(tok)) nums.push(v);
      else if (!color) color = tok;
    }
    out.push({
      dx: nums[0] ?? 0,
      dy: nums[1] ?? 0,
      blur: Math.max(0, nums[2] ?? 0),
      color: color || '#000000',
    });
  }
  return out;
}

/** Terms of `filter` that the mip lane cannot reproduce (anything but drop-shadow). */
export function unreproducibleTerms(filter: string): string[] {
  return parseFilterTerms(filter).filter((t) => t.name !== 'drop-shadow').map((t) => t.name);
}

/** One drop-shadow back as CSS. Lengths at 0.001 px, the wire's own quantum. */
export function serialiseDropShadow(s: DropShadow): string {
  const n = (v: number): string => `${Math.round(v * 1000) / 1000}px`;
  return `drop-shadow(${n(s.dx)} ${n(s.dy)} ${n(s.blur)} ${s.color})`;
}

/**
 * An authored filter remainder scaled from stage-native px to EXPORT px, in order.
 *
 * The authored `drop-shadow(0px 2px 10px …)` is written against the stage's own
 * coordinates. It used to be scaled for free - the plate was photographed at S with the
 * filter still on the element, so the engine scaled it. Now the plate is shot clean and
 * the compositor owns the effect, so the lengths have to be scaled here or every export
 * above 1× would draw a shadow at 1× while the picture around it grew.
 *
 * Non-drop-shadow terms pass through VERBATIM and unscaled: they are outside the
 * authored vocabulary (the hooks write blur and drop-shadow and nothing else), the mip
 * lane cannot reproduce them at all, and inventing a scaling rule for a term nobody can
 * author would be guessing.
 */
export function scaleFilter(filter: string, k: number): { rest: string; shadows: DropShadow[] } {
  const s = String(filter ?? '').trim();
  if (!s || s === 'none') return { rest: '', shadows: [] };
  const mul = Number.isFinite(k) && k > 0 ? k : 1;
  const shadows: DropShadow[] = [];
  const parts: string[] = [];
  for (const term of parseFilterTerms(s)) {
    if (term.name !== 'drop-shadow') { parts.push(`${term.name}(${term.args})`); continue; }
    const one = parseDropShadows(`drop-shadow(${term.args})`)[0];
    if (!one) continue;
    const scaled: DropShadow = { dx: one.dx * mul, dy: one.dy * mul, blur: one.blur * mul, color: one.color };
    shadows.push(scaled);
    parts.push(serialiseDropShadow(scaled));
  }
  return { rest: parts.join(' '), shadows };
}

// ── spill: how far outside its box a filtered layer paints ──────────────────

/**
 * How many sigmas of a Gaussian are worth capturing. Three carries 99.7 % of the
 * energy; beyond it the contribution is below one 8-bit level for any realistic
 * source, and every extra sigma costs (w + 2·pad)(h + 2·pad) pixels of scratch.
 */
export const BLUR_SPREAD_SIGMAS = 3;

/**
 * The margin, in the SAME px as the inputs, that a layer's effects paint outside its
 * own box - the pad `drawItem` grows its scratch by, and the number the plate budget
 * prices (plan 104 section 5.5).
 *
 * `max(blur spill, shadow spill)`, where the shadow's reach is measured from the
 * BLURRED silhouette: a filter chain applies drop-shadow to the result of the blur
 * before it, so a soft box casts a shadow that starts one blur-spill out and then
 * travels its own offset and softness on top of that.
 */
export function spillPad(sigma: number, shadows: readonly DropShadow[] = []): number {
  const blur = sigma > 0 ? BLUR_SPREAD_SIGMAS * sigma : 0;
  let shadow = 0;
  for (const s of shadows) {
    const reach = Math.max(Math.abs(s.dx), Math.abs(s.dy)) + BLUR_SPREAD_SIGMAS * shadowSigma(s);
    if (reach > shadow) shadow = reach;
  }
  const total = Math.max(blur, shadows.length ? blur + shadow : 0);
  return Number.isFinite(total) && total > 0 ? Math.ceil(total) : 0;
}

/**
 * Longest side any COMPOSITE SCRATCH may take, device px.
 *
 * The plate budget prices plates; the blur lanes' scratches live in the same heap and
 * nothing prices those. `pad = spillPad(sigma)` is `3σ` with σ up to `KF_MAX_BLUR ×
 * S` - a 640×360 box at S = 2 with a 300 px blur asks for a 4880×4320 scratch (~84 MB)
 * that the per-plate cap never sees, and `takeStage`'s failure mode is a silent
 * unfiltered draw. Clipping the spill at a stated distance is the better failure: it
 * is what every export before this feature did anyway (the spill was clipped at the
 * box edge), only far further out.
 */
export const BLUR_SCRATCH_MAX_SIDE = 8192;

/**
 * …and how many pixels one may cover. The binding constraint in practice: Safari
 * refuses a canvas by AREA long before either side reaches 8192 (16.7 Mpx is the
 * documented ceiling), and `renderFx` holds three to four scratches of this size at
 * once, so 16.7 Mpx of RGBA is already ~67 MB × 4 in flight.
 */
export const BLUR_SCRATCH_MAX_PIXELS = 16 << 20;

/**
 * The largest pad that keeps a `w × h` scratch inside both caps. Floors at 0.
 *
 * The area constraint is the quadratic `4p² + 2p(w+h) + (wh − A) ≤ 0`, solved for its
 * positive root - a padded scratch grows on both axes, so its cost is quadratic in the
 * pad and a side-only cap would let a modest box with a huge blur through.
 */
export function scratchPadCap(
  w: number, h: number, cap = BLUR_SCRATCH_MAX_SIDE, area = BLUR_SCRATCH_MAX_PIXELS,
): number {
  const bw = Math.max(0, w);
  const bh = Math.max(0, h);
  let p = Infinity;
  if (cap > 0) p = Math.min(p, (cap - Math.max(bw, bh)) / 2);
  if (area > 0) {
    const s = bw + bh;
    const disc = s * s - 4 * (bw * bh - area);
    p = Math.min(p, disc > 0 ? (Math.sqrt(disc) - s) / 4 : 0);
  }
  return Number.isFinite(p) ? Math.max(0, Math.floor(p)) : 0;
}

// ── the mip ladder (pure: the whole quality decision, testable in Node) ─────

/** Below this sigma a blur moves no 8-bit level anywhere; skip the lane entirely. */
export const BLUR_MIN_SIGMA = 0.25;
/** Deepest mip level. 32× is already 1/1024 of the pixels; deeper buys nothing. */
export const BLUR_MAX_SHRINK = 32;
/**
 * How many pixels the JS box-blur pass is willing to touch at full resolution.
 *
 * Above it the ladder drops another level even though the sigma did not ask for one,
 * because the alternative is a 2 Mpx three-pass separable blur per layer per frame.
 */
export const BLUR_DIRECT_PIXELS = 1 << 20;
/**
 * How far the AREA rule may push the ladder past what the sigma asked for, as a
 * multiple of sigma.
 *
 * The bound is exactly where the resample stops being subtractable: a round trip at
 * `shrink` supplies `MIP_RESAMPLE_SIGMA_PER_SHRINK · shrink` of blur on its own, so the
 * residual `sqrt((sigma/shrink)² − 0.5²)` is real precisely while
 * `shrink ≤ sigma / 0.5 = 2·sigma`. AT the bound the residual is exactly zero: the two
 * resamples ARE the blur, and the box pass - the expensive one, `getImageData` plus two
 * `Float32Array(w·h·4)` - is skipped entirely.
 *
 * It was 1.8, a safety margin below the real bound, and that margin was the whole
 * defect: a sigma of 1 on a 3840×2160 layer got `kHard = floor(log2(1.8)) = 0`, so the
 * area rule could not fire at all and the box pass ran at FULL resolution - 8 M mip px
 * against a 1 M budget and ~265 MB of transient Float32, per layer per frame, on the
 * lane that IS the Safari mainline. At 2.0 the same case takes one level (2 M px, no
 * box pass) and sigma 2 takes two (518 k px). Nothing over-blurs: the bound is derived
 * from the residual, not chosen.
 */
export const BLUR_AREA_SHRINK_PER_SIGMA = 2;
/**
 * The blur a downscale-then-upscale round trip contributes on its own, as a fraction
 * of the shrink factor. A box average over `s` px (variance s²/12) followed by a
 * bilinear tent of width 2s (variance s²/6) is a variance of s²/4, i.e. sigma = s/2.
 * It is a MODEL of two resamples that belong to the engine, not to us.
 *
 * MEASURED 2026-08-11 (plans/104 section 9.2 M1 obligation 2, both engines on macOS 27 via
 * Playwright 1.62.1): a step edge through the chain with the box pass suppressed,
 * fitted to a gaussian, averaged in VARIANCE over every edge phase - because what the
 * round trip delivers depends on where the edge falls on the mip grid, and real content
 * lands on all of them.
 *
 *     shrink        2      4      8     16     32
 *     Chromium 151  0.508  0.541  0.549  0.550  0.550
 *     WebKit 26.5   0.474  0.531  0.543  0.546  0.548
 *     per-phase range (both engines): 0.27 .. 0.65
 *
 * So the model is within 10 % of both engines at every depth, and the phase spread is
 * six times wider than the error - a per-engine constant would be fitting noise. It
 * stays 0.5, for three reasons beyond the 10 %: the delivered sigma end to end
 * (residual + resample) came out 1.02–1.07× of the request, inside the "good to
 * roughly a tenth of a sigma" claim; the integer three-box construction quantises the
 * residual so coarsely that 0.5 and 0.55 pick the SAME box widths in most cases (a
 * 512 px layer at sigma 4: `[1,1,3]` either way); and `BLUR_AREA_SHRINK_PER_SIGMA` is
 * derived as `1/this`, so raising it to the measured 0.55 would drop the area bound to
 * 1.82 and reinstate exactly the full-resolution box pass that bound was fixed to
 * remove. The browser tier keeps measuring the model's value
 * (tests/canvas-blur-lanes.browser.test.ts).
 */
export const MIP_RESAMPLE_SIGMA_PER_SHRINK = 0.5;

/** The ladder one blur takes: how far down, and what is left to do once there. */
export interface BlurLadder {
  /** Power-of-two downscale factor, ≥ 1. */
  shrink: number;
  /** Standard deviation still to apply AT THE MIP LEVEL, after the resample's own. */
  sigma: number;
  /** Box widths for the three-pass approximation of `sigma`; empty means no pass. */
  sizes: number[];
}

/**
 * The smallest blur an integer box pass can express: ONE width-3 box, variance
 * (3² − 1)/12 = 2/3.
 *
 * Below it the construction has nothing between "identity" and this, which is what
 * makes the band below required rather than a rounding detail.
 */
export const BOX_MIN_SIGMA = Math.sqrt(2 / 3);

/**
 * Box widths whose n-fold convolution best approximates a Gaussian of `sigma`
 * (Wells 1986, in the integer form popularised by Ivan Kutskir).
 *
 * Three boxes is the standard trade - the error against a true Gaussian is a few
 * tenths of a percent, and a box blur is O(1) per pixel regardless of width.
 *
 * THE DEGENERATE BAND, and why it is not simply `[]` (plans/104 P1 obligation 5a,
 * measured in M1's browser-verify run). The Wells construction collapses to all-width-1
 * boxes - i.e. to the identity - for every sigma ≤ 0.577, and returning `[]` there means
 * the caller's residual is DROPPED. That is invisible while the residual is tiny and
 * very visible when the area rule put it there: a 3840×2160 layer asking for sigma 3
 * takes shrink 4, leaving a residual of 0.559 that landed exactly in this band, so the
 * two resamples became the whole blur and the layer was delivered at 0.72× / 0.82× the
 * asked-for softness (Chromium / WebKit).
 *
 * So the band picks the NEAREST of the two answers the quantiser can give - nothing, or
 * one width-3 box (sigma 0.8165) - and it measures nearness in SIGMA, the quantity the
 * caller asked for and the quantity an eye compares, rather than in variance.
 *
 * `carried` is what makes that comparison honest, and it is the P1 review's correction
 * (LENS 1, MEDIUM 6). The caller of this function inside a mip ladder is not starting
 * from zero: the resample round trip has ALREADY supplied
 * `MIP_RESAMPLE_SIGMA_PER_SHRINK` of blur, in quadrature, and it will be there whichever
 * answer is picked. So the two candidates are `carried` and `hypot(carried, 0.8165)`,
 * and the crossover between them sits where those two are equidistant from
 * `hypot(carried, sigma)` - at `carried = 0.5` that is a residual of ≈ 0.530, not the
 * bare `BOX_MIN_SIGMA / 2` ≈ 0.408. Comparing residuals alone made the promotion fire
 * across the whole band, including the low end where it is far WORSE than doing nothing:
 * at residual 0.41 it delivered 1.48× the request where the identity delivers 0.78×.
 * With `carried` absent (0) the crossover is `BOX_MIN_SIGMA / 2` exactly as before, so
 * a direct caller is unaffected.
 *
 * WHAT THIS IS NOT. It does not rescue the measured case, and the P1 review is right
 * that the first version's comment claimed it did: at residual 0.559 the two candidates
 * are 0.72× and 1.31× of the request on the MEASURED resample constant (0.541 at
 * shrink 4), i.e. |error| 0.28 → 0.31. The quantiser has no third answer there. The one
 * exact answer is to drop a mip level - at shrink 2 the same case leaves a residual of
 * 1.41, which is expressible, and delivers 1.00× - and it is NOT taken on purpose: that
 * level is where `BLUR_DIRECT_PIXELS` put the ladder in the first place, so going back
 * up costs 4× the box-pass pixels (2.07 Mpx against a 1 Mpx budget) plus ~66 MB of
 * transient Float32, per layer per frame, on the lane that IS the Safari mainline. Cost,
 * not quality, is the reason - stated here rather than implied.
 *
 * Below the crossover the answer is still `[]`, and that is honest: it IS the closest
 * expressible blur, and it costs nothing to deliver (no scratch, no readback). It is
 * also the documented sub-`BLUR_MIN_SIGMA` divergence from the `ctx.filter` lane, which
 * the same run measured as smaller than the comment used to claim - Chromium's own
 * filter delivers nothing below sigma 0.7 either. What does NOT become continuous is the
 * delivered blur: the step from nothing to one width-3 box is 0.8165 wide wherever the
 * crossover is put, because that is the smallest thing three integer boxes can say.
 */
export function boxSizesForGauss(sigma: number, n = 3, carried = 0): number[] {
  if (!(sigma > 0) || n <= 0) return [];
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  if (wl < 1) wl = 1;
  const wu = wl + 2;
  const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
  const m = Math.round(mIdeal);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(i < m ? wl : wu);
  if (!out.every((v) => v <= 1)) return out;
  // Degenerate: every box came out width 1, which convolves to nothing. Pick whichever
  // of the two expressible DELIVERED blurs lands nearer the one that was asked for - 
  // which is the same `BOX_MIN_SIGMA / 2` midpoint when nothing is carried.
  const c = Number.isFinite(carried) && carried > 0 ? carried : 0;
  const want = Math.hypot(c, sigma);
  if (Math.abs(want - c) < Math.abs(Math.hypot(c, BOX_MIN_SIGMA) - want)) return [];
  // One width-3 box, the smallest thing this construction can actually say. Kept in the
  // n-length shape the normal path returns (width-1 passes are identity, and the box
  // blur already runs them in the ordinary `[1,1,3]` case), so a caller counting passes
  // sees the same arity either way.
  const promoted = out.slice(0, Math.max(0, n - 1));
  promoted.push(3);
  return promoted;
}

/**
 * Which mip level to blur at, and with what residual sigma.
 *
 * `shrink` never exceeds sigma (so the resample contributes at most half the asked-for
 * softness) except under the pixel-budget rule, which is itself capped at
 * `BLUR_AREA_SHRINK_PER_SIGMA · sigma`; and never takes an axis below 2 px, because a
 * 1 px mip level has no gradient left to blur. The residual is
 * `sqrt((sigma/shrink)² − resample²)` - the asked-for variance minus the variance the
 * round trip supplies for free.
 *
 * Null means "this lane cannot express that blur", and there are two ways to get it.
 * Below `BLUR_MIN_SIGMA` nothing moves an 8-bit level anywhere. Between it and
 * `BOX_MIN_SIGMA / 2` (≈ 0.41) the ladder cannot shrink (any level would over-blur) and
 * the three-box construction's nearest expressible answer IS the identity - so the mip
 * lane applies no blur where a filter lane would apply a sub-pixel one. That is a
 * stated, bounded divergence between the lanes, not a hidden one: returning null makes
 * it cost nothing (no scratch, no copy) instead of allocating a full-size canvas to
 * change nothing. It used to run all the way to ≈ 0.87; `boxSizesForGauss` now answers
 * the band above 0.41 with one width-3 box, which is the nearer of the two answers the
 * quantiser can give, so the divergence is half as wide as it was.
 *
 * THE RESIDUAL IS NEVER STRANDED (plans/104 P1 obligation 5a). `shrink` is chosen by
 * the area rule up to `BLUR_AREA_SHRINK_PER_SIGMA · sigma`, and at that bound the
 * residual is only exactly zero when `2·sigma` happens to be a power of two - otherwise
 * a real residual is left over, and before the band fix a residual under 0.577 was
 * silently dropped and the two resamples became the whole blur. That is the measured
 * 0.72× / 0.82× under-delivery on a 3840×2160 layer at sigma 3. The fix is in the
 * quantiser, not here: this function's choice of level is unchanged, so nothing that
 * was already expressible moves.
 *
 * The quantiser is told what the resample already CARRIES (`resample`, in quadrature),
 * because the choice it makes in the band is between two DELIVERED blurs, not between
 * two residuals - see `boxSizesForGauss`. And the ladder deliberately does not climb
 * back down a level to make the residual expressible: at sigma 3 on 3840×2160 that is
 * exact (1.00×) and costs 4× the box-pass pixels against a budget this same function
 * enforces two lines up. The trade is stated in the quantiser's docblock; the level
 * chosen here is the area rule's, unchanged.
 */
export function blurLadder(sigma: number, w: number, h: number): BlurLadder | null {
  if (!(sigma > BLUR_MIN_SIGMA) || !(w > 0) || !(h > 0)) return null;
  const log2 = (v: number): number => Math.log(v) / Math.LN2;
  const kAxis = Math.max(0, Math.floor(log2(Math.max(1, Math.min(w, h) / 2))));
  const kMax = Math.min(kAxis, Math.round(log2(BLUR_MAX_SHRINK)));
  const kSigma = Math.max(0, Math.floor(log2(sigma)));
  const kHard = Math.max(0, Math.floor(log2(BLUR_AREA_SHRINK_PER_SIGMA * sigma)));
  const kArea = Math.max(0, Math.ceil(log2(Math.sqrt((w * h) / BLUR_DIRECT_PIXELS))));
  const k = Math.min(kMax, Math.max(kSigma, Math.min(kArea, kHard)));
  const shrink = 2 ** k;
  const inner = sigma / shrink;
  const resample = shrink > 1 ? MIP_RESAMPLE_SIGMA_PER_SHRINK : 0;
  const residual = Math.sqrt(Math.max(0, inner * inner - resample * resample));
  const sizes = boxSizesForGauss(residual, 3, resample);
  if (shrink === 1 && !sizes.length) return null;
  return { shrink, sigma: residual, sizes };
}

// ── the box blur itself (exact, engine-independent, testable) ───────────────

/**
 * Three-pass separable box blur of straight-alpha RGBA, in place.
 *
 * PREMULTIPLIED throughout. Blurring straight alpha channel-wise pulls the colour of
 * fully transparent pixels into their visible neighbours, which is how a blurred cut-out
 * grows a dark halo; premultiplying first, blurring, then dividing alpha back out is
 * the only correct order and costs one pass either side.
 */
export function boxBlurRgba(data: Uint8ClampedArray, w: number, h: number, sizes: readonly number[]): void {
  if (!sizes.length || w <= 0 || h <= 0) return;
  const n = w * h * 4;
  if (data.length < n) return;
  let src = new Float32Array(n);
  let dst = new Float32Array(n);
  for (let i = 0; i < n; i += 4) {
    const a = data[i + 3] as number;
    const f = a / 255;
    src[i] = (data[i] as number) * f;
    src[i + 1] = (data[i + 1] as number) * f;
    src[i + 2] = (data[i + 2] as number) * f;
    src[i + 3] = a;
  }
  for (const size of sizes) {
    const r = (size - 1) / 2;
    if (r < 0.5) continue;
    const ri = Math.round(r);
    boxPassH(src, dst, w, h, ri);
    boxPassV(dst, src, w, h, ri);
  }
  for (let i = 0; i < n; i += 4) {
    const a = src[i + 3] as number;
    const f = a > 0.001 ? 255 / a : 0;
    data[i] = (src[i] as number) * f;
    data[i + 1] = (src[i + 1] as number) * f;
    data[i + 2] = (src[i + 2] as number) * f;
    data[i + 3] = a;
  }
  // Keep the allocator honest about what escapes: nothing does.
  src = dst = new Float32Array(0);
}

/** One horizontal box pass with edge clamping and a running sum (O(1) per pixel). */
function boxPassH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const inv = 1 / (r + r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) {
        const x = i < 0 ? 0 : i >= w ? w - 1 : i;
        sum += src[row + x * 4 + c] as number;
      }
      for (let x = 0; x < w; x++) {
        dst[row + x * 4 + c] = sum * inv;
        const add = x + r + 1;
        const drop = x - r;
        sum += (src[row + (add >= w ? w - 1 : add) * 4 + c] as number)
          - (src[row + (drop < 0 ? 0 : drop) * 4 + c] as number);
      }
    }
  }
}

/** One vertical box pass. Same shape, striding by the row instead of by the pixel. */
function boxPassV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const inv = 1 / (r + r + 1);
  const stride = w * 4;
  for (let x = 0; x < w; x++) {
    const col = x * 4;
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) {
        const y = i < 0 ? 0 : i >= h ? h - 1 : i;
        sum += src[col + y * stride + c] as number;
      }
      for (let y = 0; y < h; y++) {
        dst[col + y * stride + c] = sum * inv;
        const add = y + r + 1;
        const drop = y - r;
        sum += (src[col + (add >= h ? h - 1 : add) * stride + c] as number)
          - (src[col + (drop < 0 ? 0 : drop) * stride + c] as number);
      }
    }
  }
}

// ── the lanes ───────────────────────────────────────────────────────────────

/** What one layer's effects amount to, in DEVICE px, at the instant being drawn. */
export interface FxSpec {
  /** Gaussian standard deviation of the layer blur (authored + kf `b` + DOF) × S. */
  sigma: number;
  /** The authored filter remainder, verbatim and already scaled - the filter lane's string. */
  rest: string;
  /** `rest` as drop-shadow terms, scaled - the mip lane's reproduction of it. */
  shadows: DropShadow[];
}

/** True when there is nothing for either lane to do. */
export function isFxEmpty(fx: FxSpec | null | undefined): boolean {
  return !fx || (!(fx.sigma > 0) && !fx.rest && !fx.shadows.length);
}

/** The filter declaration the filter lane writes for a spec. */
export function fxFilterString(fx: FxSpec): string {
  const parts: string[] = [];
  if (fx.sigma > 0) parts.push(`blur(${Math.round(fx.sigma * 1000) / 1000}px)`);
  if (fx.rest) parts.push(fx.rest);
  return parts.join(' ') || 'none';
}

/**
 * Which lane a destination context may use. The probe is asked about the DESTINATION's
 * kind rather than the scratch's because section 11 S1 measured support to be per-engine, and
 * because the scratch is made in the same realm anyway.
 */
export function laneFor(dst: BlurCtx | null | undefined): BlurLane {
  return canvasFilterWorks(dst as Parameters<typeof canvasFilterWorks>[0]) ? 'filter' : 'mip';
}

/**
 * Blur one scratch into a NEW scratch. Returns `src` untouched when the sigma is
 * below the visible threshold or no scratch could be had.
 *
 * Every intermediate is pushed onto `held` and released by the caller AFTER the result
 * has been consumed. Releasing them as the chain walks would be tempting and wrong:
 * a released scratch is immediately re-takeable, and the next level's `takeStage`
 * would hand back - and CLEAR - the very canvas the next `drawImage` reads from.
 */
function mipBlurStage(src: BlurCanvas, sigma: number, held: BlurStage[]): BlurCanvas {
  const w = src.width;
  const h = src.height;
  const ladder = blurLadder(sigma, w, h);
  if (!ladder) return src;

  // Down the chain by halves: one wide drawImage downscale aliases on some engines,
  // and successive halves are the "mip chain" this lane is named for.
  let work: BlurStage | null = null;
  let cw = w;
  let ch = h;
  for (let s = 2; s <= ladder.shrink; s *= 2) {
    const nw = Math.max(1, Math.round(w / s));
    const nh = Math.max(1, Math.round(h / s));
    const step = takeStage(nw, nh, s === ladder.shrink);
    if (!step) break;
    held.push(step);
    smooth(step.ctx);
    step.ctx.drawImage((work?.canvas ?? src) as CanvasImageSource, 0, 0, nw, nh);
    work = step;
    cw = nw;
    ch = nh;
  }
  if (!work) {
    // shrink === 1 (or the chain could not allocate): the box pass still needs a
    // scratch of its own, because it reads and writes pixels and the source belongs
    // to the caller.
    const flat = takeStage(w, h, true);
    if (!flat) return src;
    held.push(flat);
    flat.ctx.drawImage(src as CanvasImageSource, 0, 0);
    work = flat;
  }

  // The exact part: a three-pass box blur at the mip level, in JS, so the standard
  // deviation is ours and not the engine's.
  if (ladder.sizes.length) {
    try {
      const img = work.ctx.getImageData(0, 0, cw, ch);
      boxBlurRgba(img.data, cw, ch, ladder.sizes);
      work.ctx.putImageData(img, 0, 0);
    } catch { /* tainted or refused: the resample chain alone is the blur */ }
  }

  // …and back up, doubling, so the tent reconstruction lands in stages instead of one
  // wide facet-showing stretch.
  for (let s = ladder.shrink / 2; s >= 1; s /= 2) {
    const nw = s === 1 ? w : Math.max(1, Math.round(w / s));
    const nh = s === 1 ? h : Math.max(1, Math.round(h / s));
    const step = takeStage(nw, nh);
    if (!step) break;
    held.push(step);
    smooth(step.ctx);
    step.ctx.drawImage(work.canvas as CanvasImageSource, 0, 0, nw, nh);
    work = step;
  }
  return work.canvas;
}

function smooth(ctx: BlurCtx): void {
  ctx.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in (ctx as object)) {
    (ctx as { imageSmoothingQuality: string }).imageSmoothingQuality = 'high';
  }
}

/**
 * `src` with the effects applied, on a scratch the caller must `releaseStage`.
 *
 * Returns null when this realm has no canvas to work on - the caller then draws the
 * unfiltered picture, which is a visibly softer-than-intended frame rather than a
 * missing layer.
 *
 * THE PASS ORDER IS THE CONTRACT (section 5.5). The content arrives already clipped (radius /
 * clip-path applied by the caller into `src`), the blur is applied to the clipped
 * result, and each drop-shadow is cast by everything before it and painted UNDER it.
 * That is the DOM's own order - clip first, filter after - which is why a blurred
 * rounded box spills softly OUTSIDE its radius instead of being shaved off at it.
 */
export function renderFx(src: BlurCanvas, fx: FxSpec, lane: BlurLane): BlurStage | null {
  const w = src.width;
  const h = src.height;
  if (w <= 0 || h <= 0) return null;

  if (lane === 'filter') {
    const out = takeStage(w, h);
    if (!out) return null;
    setFilter(out.ctx, fxFilterString(fx));
    out.ctx.drawImage(src as CanvasImageSource, 0, 0);
    setFilter(out.ctx, 'none');
    return out;
  }

  const held: BlurStage[] = [];
  const drop = (): void => { for (const s of held.splice(0)) releaseStage(s); };
  try {
    let cur: BlurCanvas = fx.sigma > 0 ? mipBlurStage(src, fx.sigma, held) : src;
    for (const shadow of fx.shadows) {
      const next = shadowPass(cur, shadow, held);
      if (!next) break;
      cur = next;
    }
    if (cur === src) {
      // Nothing was reproduced (sub-threshold blur, no shadows, or a shadow pass that
      // could not allocate): hand back a copy so the caller's release contract stays
      // uniform. `drop()` FIRST - `shadowPass` pushes its silhouette onto `held` before
      // it can fail to allocate its output, so this path is reachable with scratches
      // still held, and leaving them would garbage-collect plate-sized canvases the
      // pool exists to keep.
      drop();
      const out = takeStage(w, h);
      if (!out) return null;
      out.ctx.drawImage(src as CanvasImageSource, 0, 0);
      return out;
    }
    // The result is one of the held scratches. Keep it, release the rest.
    const keep = held.find((s) => s.canvas === cur) ?? null;
    for (const s of held) if (s !== keep) releaseStage(s);
    held.length = 0;
    return keep;
  } catch {
    drop();
    return null;
  }
}

/** One `drop-shadow()`: silhouette of everything so far, blurred, offset, painted under. */
function shadowPass(src: BlurCanvas, shadow: DropShadow, held: BlurStage[]): BlurCanvas | null {
  const w = src.width;
  const h = src.height;
  const sil = takeStage(w, h);
  if (!sil) return null;
  held.push(sil);
  sil.ctx.drawImage(src as CanvasImageSource, 0, 0);
  // `source-in` keeps the fill only where the silhouette has alpha - the alpha outline of
  // the layer tinted with the shadow colour, which is exactly what drop-shadow casts.
  sil.ctx.globalCompositeOperation = 'source-in';
  sil.ctx.fillStyle = shadow.color;
  sil.ctx.fillRect(0, 0, w, h);
  sil.ctx.globalCompositeOperation = 'source-over';

  const blurred = mipBlurStage(sil.canvas, shadowSigma(shadow), held);
  const out = takeStage(w, h);
  if (!out) return null;
  held.push(out);
  out.ctx.drawImage(blurred as CanvasImageSource, shadow.dx, shadow.dy);
  out.ctx.drawImage(src as CanvasImageSource, 0, 0);
  return out.canvas;
}
