// SPDX-License-Identifier: MPL-2.0
// ─── Lolly pixel watermark — multi-scale + offset recovery search ─────────────
//
// A DOM-free wrapper around the UNCHANGED `detectWatermark` (pixel-watermark.ts)
// that recovers a Lolly Imprint from a candidate whose 8×8 embed grid no longer
// starts at pixel (0,0) — because the file was CROPPED (phase shift) or MODERATELY
// RESIZED (pitch change). It never re-implements the DCT/correlation: it only
// re-slices / re-samples the RGBA buffer and re-applies a family-wise-corrected
// presence decision to the score `detectWatermark` returns for each hypothesis.
//
// TWO ORTHOGONAL HYPOTHESIS AXES
//   1) 8×8 block-phase offset (crop/border recovery, CHEAP). detectWatermark
//      always starts its grid at (0,0); a crop or padding by any amount shifts the
//      true grid's phase by (cropLeft mod 8, cropTop mod 8), so trying all 64
//      (dx,dy) in 0..7 is EXHAUSTIVE for pure translation. No resample, no new DCT.
//   2) Scale (moderate-resize recovery, EXPENSIVE and honestly bounded). A pure
//      bilinear resample of the CANDIDATE (we never see the original) by S ≈ 1/P
//      roughly restores the original 8px pitch a platform resize by P disturbed.
//      Candidate scales are quarter-octave, 0.5×–2×. This is NOT aggressive-social-
//      downscale recovery: a heavy downscale is a low-pass filter AT EMBED TIME that
//      destroys the mid-band outright, and our undo pass compounds a second lossy
//      resample on top — so scale-recovered true positives sit BELOW the pristine
//      crop/JPEG calibration range and the band deliberately stops at 2×.
//
// NON-GOALS (keep the hypothesis space bounded and the claim honest): no rotation,
// no aspect-distorting (non-uniform x/y) scale, no aggressive-downscale recovery
// (that needs a resize-invariant embedding scheme — "Path B", out of scope).
//
// FALSE-POSITIVE CONTROL. Trying K quasi-independent hypotheses against the same
// null and taking the max inflates the family-wise FP rate ~K-fold at the single-
// hypothesis threshold — unacceptable, since a false "made with Lolly" is a trust
// claim, worse than a miss (which just reads "inconclusive"). Two guards, both
// required: (1) a Bonferroni-corrected σ term via the engine's `detectionThreshold(
// nCoef, K)`, and (2) an EMPIRICALLY-calibrated flat floor SEARCH_DETECT_FLOOR
// that replaces the 0.035 single-hypothesis floor in the large-image regime — the
// 0.035 floor bounds a STRUCTURED resize-artifact bias the Gaussian model doesn't
// capture, and a max over many re-croppings/resamplings of the same image raises
// the chance of hitting that bias's own peak. SEARCH_DETECT_FLOOR was measured by
// running the FULL grid over a battery of unmarked images + their crop/JPEG/resize
// derivatives and setting the floor a safety margin above the observed max — see
// tests/watermark-search.test.ts (the same way DETECT_THRESHOLD=0.035 itself was
// calibrated against a measured 0.017 in the robustness suite).
//
// Pure array math, mirroring the rest of engine/src — but ASYNC, so it can yield
// cooperatively during a long grid (setTimeout exists in Node too, so this stays
// DOM-free; it just isn't purely synchronous like detectWatermark).

import {
  detectWatermark, detectionThreshold, V2_BAND_SIZE,
  type DetectResult, type WatermarkGeometry,
} from './pixel-watermark.ts';

export interface SearchResult extends DetectResult {
  /** Resample factor of the winning (or best) hypothesis; 1 ⇒ no resample. */
  scale: number;
  /** Recovered block-phase X offset (0..7) in the resampled buffer's space. */
  offsetX: number;
  /** Recovered block-phase Y offset (0..7) in the resampled buffer's space. */
  offsetY: number;
  /** Total hypotheses evaluated (a detectWatermark call each). */
  hypothesesTried: number;
  /** 0 ⇒ the fast-path single detect fired; 1 ⇒ offset search; 2 ⇒ scale×offset. */
  tier: 0 | 1 | 2;
}

// ── Empirically-calibrated flat detection floor for the search path ───────────
// MEASURED, not derived. Over a 320-trial adversarial sweep at the worst regime
// (256² — the σ/floor crossover — photoLike + white-noise + flat, each crossed with
// JPEG q55/q80, crop and resize derivatives, full 576-cell grid) the max normalized-
// correlation score seen ANYWHERE on the grid was ~0.0804 (and, tellingly, the
// Bonferroni σ term ALONE let 2 of those clear its bar — the structured resize-
// artifact bias the Gaussian model doesn't capture, exactly the caveat that makes
// this empirical floor load-bearing rather than decorative). 0.12 sits ~1.5× above
// that observed max and produced 0 false positives across the whole sweep. It's a
// deliberately TIGHT choice: the weakest MODERATE true positive (a half-block crop,
// ~0.21) is only ~2.6× above the FP max, so a full 2× margin on both sides is
// impossible — and a false "made with Lolly" (a trust claim) is worse than a miss
// (which reads "inconclusive"), so the margin is spent on the FP side. Moderate crop
// (~0.21, ×1.75) and resize (~0.50, ×4) still clear it; heavy COMPOUND degradation
// (crop + aggressive JPEG on a large image) can fall below and is honestly not
// recovered. Recalibrate here (only here) if the grid/fixtures change — the pin test
// (tests/watermark-search.test.ts) fails loudly if the measured max nears this value.
export const SEARCH_DETECT_FLOOR = 0.12;

// ── Hypothesis grid ───────────────────────────────────────────────────────────
// Quarter-octave scales S = 2^(k/4), k = -4..4. 1.00 is the fast-path identity and
// is excluded from the PAID (resample) search. Non-unity scales are ordered nearest-
// to-1 first: moderate resize is both more common and more recoverable than extreme.
const SCALE_ORDER: readonly number[] = [0.84, 1.19, 0.71, 1.41, 0.59, 1.68, 0.5, 2.0];

// Family sizes for the Bonferroni σ term (fpControl). Tier 1 = 64 scale-1 offsets.
// Tier 2 = the WHOLE family tried by the time it runs (Tier 1's 64 + Tier 2's 512),
// since a false positive in EITHER tier counts against the same file's claim.
const TIER1_HYPOTHESES = 64;
const TIER2_HYPOTHESES = 576;

// Circuit breaker: bounds hypotheses evaluated independent of the theoretical grid.
// Set just above the full 576-cell grid so a Tier-2 call can complete its designed
// sweep, while a pathological/adversarial call can't run unbounded.
const DEFAULT_HYPOTHESIS_BUDGET = 640;

// One-time working-resolution cap (pure performance, NOT correctness). More native
// pixels only add redundant blocks; capping the long edge bounds worst-case wall-
// clock. Applied ONCE via the same bilinear primitive before either tier. NB: on an
// image ABOVE this cap the cap is itself a resample, so integer-exact crop recovery
// (Tier 1) degrades slightly there — the common case (≤ this size) is unaffected.
const MAX_WORK_EDGE = 2000;

// Cooperative yield cadence (mirrors valid.ts scanRgbaImages' YIELD_EVERY) so a
// worst-case grid doesn't freeze the tab / event loop.
const YIELD_EVERY = 16;

/**
 * Standard separable bilinear resample of an RGBA buffer, edge-clamped, all four
 * channels (alpha carried for primitive correctness even though only luma feeds the
 * detector). Pure + DOM-free. dstW/H = round(srcW/H × scale), each floored to ≥ 1.
 */
export function bilinearResampleRgba(
  src: Uint8Array | Uint8ClampedArray, srcW: number, srcH: number, scale: number,
): { data: Uint8Array; width: number; height: number } {
  const dstW = Math.max(1, Math.round(srcW * scale));
  const dstH = Math.max(1, Math.round(srcH * scale));
  const out = new Uint8Array(dstW * dstH * 4);
  const maxX = srcW - 1, maxY = srcH - 1;
  for (let dy = 0; dy < dstH; dy++) {
    // Center-aligned inverse map: srcY of this dst row.
    let sy = (dy + 0.5) / scale - 0.5;
    if (sy < 0) sy = 0; else if (sy > maxY) sy = maxY;
    const y0 = Math.floor(sy);
    const y1 = y0 < maxY ? y0 + 1 : y0;
    const fy = sy - y0;
    const row0 = y0 * srcW, row1 = y1 * srcW;
    for (let dx = 0; dx < dstW; dx++) {
      let sx = (dx + 0.5) / scale - 0.5;
      if (sx < 0) sx = 0; else if (sx > maxX) sx = maxX;
      const x0 = Math.floor(sx);
      const x1 = x0 < maxX ? x0 + 1 : x0;
      const fx = sx - x0;
      const p00 = (row0 + x0) * 4, p01 = (row0 + x1) * 4;
      const p10 = (row1 + x0) * 4, p11 = (row1 + x1) * 4;
      const w00 = (1 - fx) * (1 - fy), w01 = fx * (1 - fy);
      const w10 = (1 - fx) * fy, w11 = fx * fy;
      const o = (dy * dstW + dx) * 4;
      for (let c = 0; c < 4; c++) {
        out[o + c] = (src[p00 + c]! * w00 + src[p01 + c]! * w01 +
          src[p10 + c]! * w10 + src[p11 + c]! * w11 + 0.5) | 0;
      }
    }
  }
  return { data: out, width: dstW, height: dstH };
}

/**
 * Drop the first `dx` columns and `dy` rows of an RGBA buffer into a new
 * (w−dx)×(h−dy) buffer — the phase-offset primitive Tier 1 uses to realign a
 * cropped candidate's 8×8 grid. dx,dy in 0..7; (0,0) returns a plain copy view.
 */
function cropOrigin(
  src: Uint8Array | Uint8ClampedArray, w: number, h: number, dx: number, dy: number,
): { data: Uint8Array; width: number; height: number } {
  const nw = w - dx, nh = h - dy;
  const out = new Uint8Array(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    const srcStart = ((y + dy) * w + dx) * 4;
    out.set(src.subarray(srcStart, srcStart + nw * 4), y * nw * 4);
  }
  return { data: out, width: nw, height: nh };
}

// The K-adjusted presence decision for one hypothesis: the correlation must clear
// BOTH the empirical flat floor AND the Bonferroni σ term (the latter dominates on
// small images where the null is wide). nCoef ≈ blocks × V2_BAND_SIZE — accurate
// when the v2 scheme is the one correlating (the common case; a legacy v1-only mark
// would be scored against v2's block count, a pre-existing DetectResult limitation).
function passes(r: DetectResult, hypotheses: number): boolean {
  if (r.blocks <= 0) return false;
  const nCoef = r.blocks * V2_BAND_SIZE;
  const threshold = Math.max(SEARCH_DETECT_FLOOR, detectionThreshold(nCoef, hypotheses));
  return r.score > threshold;
}

/**
 * Recover a Lolly Imprint from a cropped or moderately-resized candidate by
 * searching block-phase offsets (Tier 1) and, opt-in, quarter-octave rescales
 * (Tier 2), applying the family-wise-corrected presence decision at each. Returns
 * the FIRST hypothesis that clears its bar (hard early-exit), else the best-scoring
 * cell seen as an honest miss. Async only so it can yield cooperatively.
 *
 * @param searchOpts.tier  1 (offsets only, no resample) or 2 (add the rescale grid). Default 1.
 * @param searchOpts.hypothesisBudget  hard cap on hypotheses evaluated. Default 640 (> full grid).
 */
export async function detectWatermarkSearch(
  rgba: Uint8Array | Uint8ClampedArray,
  opts: WatermarkGeometry,
  searchOpts?: { tier?: 1 | 2; hypothesisBudget?: number },
): Promise<SearchResult> {
  const tier = searchOpts?.tier ?? 1;
  const budget = Math.max(1, searchOpts?.hypothesisBudget ?? DEFAULT_HYPOTHESIS_BUDGET);

  // One-time working-resolution cap (perf only).
  let data: Uint8Array | Uint8ClampedArray = rgba;
  let w = opts.width, h = opts.height;
  const longEdge = Math.max(w, h);
  if (longEdge > MAX_WORK_EDGE && w * h * 4 <= rgba.length) {
    const capped = bilinearResampleRgba(rgba, w, h, MAX_WORK_EDGE / longEdge);
    data = capped.data; w = capped.width; h = capped.height;
  }

  let tried = 0;
  const best: SearchResult = { present: false, score: 0, blocks: 0, scale: 1, offsetX: 0, offsetY: 0, hypothesesTried: 0, tier };
  const consider = (r: DetectResult, scale: number, dx: number, dy: number): void => {
    if (r.score > best.score) { best.score = r.score; best.blocks = r.blocks; best.scale = scale; best.offsetX = dx; best.offsetY = dy; }
  };
  const yieldMaybe = async (): Promise<void> => { if (tried % YIELD_EVERY === 0) await new Promise((res) => setTimeout(res, 0)); };

  // ── Tier 1: block-phase offsets at scale 1 (no resample) ───────────────────
  for (let dy = 0; dy < 8 && tried < budget; dy++) {
    for (let dx = 0; dx < 8 && tried < budget; dx++) {
      if (w - dx < 8 || h - dy < 8) continue; // too small once shifted
      const cand = (dx === 0 && dy === 0) ? { data, width: w, height: h } : cropOrigin(data, w, h, dx, dy);
      const r = detectWatermark(cand.data, { width: cand.width, height: cand.height });
      tried++;
      consider(r, 1, dx, dy);
      if (passes(r, TIER1_HYPOTHESES)) {
        return { present: true, score: r.score, blocks: r.blocks, scale: 1, offsetX: dx, offsetY: dy, hypothesesTried: tried, tier: 1 };
      }
      await yieldMaybe();
    }
  }

  if (tier < 2) { best.hypothesesTried = tried; best.tier = 1; return best; }

  // ── Tier 2: quarter-octave rescales × offsets (opt-in, resample-heavy) ─────
  for (const scale of SCALE_ORDER) {
    if (tried >= budget) break;
    const rs = bilinearResampleRgba(data, w, h, scale);
    if (rs.width < 8 || rs.height < 8) continue;
    for (let dy = 0; dy < 8 && tried < budget; dy++) {
      for (let dx = 0; dx < 8 && tried < budget; dx++) {
        if (rs.width - dx < 8 || rs.height - dy < 8) continue;
        const cand = (dx === 0 && dy === 0) ? rs : cropOrigin(rs.data, rs.width, rs.height, dx, dy);
        const r = detectWatermark(cand.data, { width: cand.width, height: cand.height });
        tried++;
        consider(r, scale, dx, dy);
        if (passes(r, TIER2_HYPOTHESES)) {
          return { present: true, score: r.score, blocks: r.blocks, scale, offsetX: dx, offsetY: dy, hypothesesTried: tried, tier: 2 };
        }
        await yieldMaybe();
      }
    }
  }

  best.hypothesesTried = tried; best.tier = 2;
  return best;
}
