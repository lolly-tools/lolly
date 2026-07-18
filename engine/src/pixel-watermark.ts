// SPDX-License-Identifier: MPL-2.0
// ─── Lolly pixel watermark — block-DCT spread-spectrum ────────────────────────
//
// A second, much weaker provenance signal that lives IN THE PIXELS, so it
// survives what strips Lolly's C2PA credential: a screenshot, a re-save, a
// JPEG recompress, a resize, an EXIF strip. Where C2PA answers "is this file
// byte-for-byte what Lolly signed" (strong, dies to any container change), this
// answers only "did these pixels pass through Lolly's export at some point"
// (weak, but durable). It is a COMPLEMENT to C2PA, never a replacement — when a
// credential is intact, trust that; this is the fallback signal for when it isn't.
//
// Technique: classic spread-spectrum (Cox/Kilian/Leighton/Shamoon 1997). On the
// SAME 8×8 grid JPEG's own DCT uses, a fixed ±1 chip sequence is added to a set
// of mid-band luma coefficients of every block, scaled by a perceptual mask so
// busy blocks carry more and flat ones stay clean. Detection re-reads the luma,
// forward-DCTs each block, and correlates the mid-band against the chip — summed
// over every block, so cropping/overlay/partial loss degrades the score
// gracefully instead of destroying it. Presence-only (yes/no + score); no payload.
//
// SECURITY POSTURE — read `plans/lollys-own-synth.md`. This is
// security-through-obscurity: the chip key ships in this (public) source and in
// the on-device detector, so a motivated adversary who reads it can subtract the
// mark out cleanly. It is honest cover against CASUAL stripping / re-encoding,
// NOT a hardened defense — same framing as the self-signed on-device C2PA key.
//
// Pure + DOM-free (no dependency beyond a hand-rolled 8×8 DCT), mirroring the
// engine's other byte/pixel modules (tiff.ts, apng.ts). The shell owns pixel
// decode/encode; this owns the transform math on a raw RGBA buffer.

export interface WatermarkGeometry {
  /** Pixel width of the RGBA buffer. */
  width: number;
  /** Pixel height of the RGBA buffer. */
  height: number;
}

export interface EmbedOptions extends WatermarkGeometry {
  /**
   * Perturbation magnitude in the orthonormal-DCT domain. Higher = more robust,
   * less imperceptible. Defaults to DEFAULT_STRENGTH (tuned via the sharp
   * calibration suite — see tests/pixel-watermark-robustness.test.ts).
   */
  strength?: number;
}

export interface DetectResult {
  /** True when the correlation score clears DETECT_THRESHOLD. */
  present: boolean;
  /** Normalized correlation in roughly [-1, 1]; ~0 for unmarked content. */
  score: number;
  /** Number of full 8×8 blocks scanned (0 ⇒ image too small to carry a mark). */
  blocks: number;
}

// Which scheme the embedder writes. Versioned so a detector can try recent keys
// and an old key can be retired — buys nothing against someone reading THIS
// source, but bounds how long an extracted key stays live. v2 (2026-07-18)
// RE-CALIBRATED for lower visibility: the mid-band was widened 15→22 coefficients
// at a lower per-coefficient strength, and the mark was pushed off smooth-but-not-
// flat blocks (higher activity gate) so it no longer reads as JPEG-like texture in
// skies/skin/gradients. `detectWatermark` reads BOTH v2 AND the original v1 scheme
// and takes the max, so files imprinted before this change still detect.
export const WATERMARK_VERSION = 2;

// Default embed strength and detection threshold. Both are CALIBRATED against
// real photos through real JPEG/crop/resize round-trips (via sharp), not guessed
// — see tests/pixel-watermark-robustness.test.ts. Measured at the v2 scheme
// (strength 3.8, 22 mid-band coefficients):
//   marked, non-resized true positives:  0.11 – 0.66   (JPEG q50→q95, PNG, 8px crop)
//   unmarked false-positive ceiling:     ~0.017        (worst positive correlation)
// so 0.035 sits cleanly between, with margin on both sides (min true-positive
// ≈ ×3.3 the threshold; worst false-positive ≈ ×0.5). Resize is NOT reliably
// detected (the 8×8 grid shifts) — a documented v1/v2 limitation, not a threshold
// to be tuned around. Lowering strength 5.5→3.8 + spreading over more coefficients
// + a higher activity gate raised PSNR (imprinted-vs-original) by ~1–2 dB and
// concentrated the mark in textured blocks; see the robustness suite for the numbers.
export const DEFAULT_STRENGTH = 3.8;
export const DETECT_THRESHOLD = 0.035;

// The normalized-correlation score's null distribution has std ≈ 1/√n (n =
// mid-band coefficients scanned), so a FIXED threshold is too lax on small
// images — few blocks ⇒ a wide null ⇒ chance correlations. The effective
// threshold is therefore the fixed floor OR a σ-based floor, whichever is
// higher: large images use 0.035 (which also rejects the resize artifact, whose
// score scales with √n too); small images demand more. At the crossover (~594
// scanned blocks, a ~195² image, with the v2 22-coefficient band) both terms meet.
//
// DETECT_MIN_SIGMA encodes a single-hypothesis ~4-σ one-sided bar (present fires
// on score > threshold, not |score| > threshold), so α₀ ≈ 1 − Φ(4) ≈ 3.2e-5.
const DETECT_MIN_SIGMA = 4.0;

/**
 * The size- AND family-adjusted detection floor for a normalized-correlation
 * score. Generalizes the single-hypothesis floor with a Bonferroni term so a
 * SEARCH wrapper (watermark-search.ts) that tries K quasi-independent
 * hypotheses against the same null and keeps the max can hold the family-wise
 * false-positive rate at the same α₀ the single-hypothesis path targets.
 *
 * Derivation (union bound): for K hypotheses want K·(1−Φ(z*)) ≤ α₀, and with the
 * upper-tail approximation Φ⁻¹(1−p) ≈ √(2·ln(1/p)) plus z₀² ≈ 2·ln(1/α₀) (self-
 * consistent with the existing z₀ = DETECT_MIN_SIGMA choice) this collapses to
 *   z*(K) ≈ √(DETECT_MIN_SIGMA² + 2·ln K).
 * The σ term below uses that z*; the flat DETECT_THRESHOLD floor is deliberately
 * NOT scaled here (it bounds a structured resize-artifact bias, not just Gaussian
 * noise — a search that needs a raised floor must calibrate it empirically, e.g.
 * SEARCH_DETECT_FLOOR in watermark-search.ts, rather than trust this formula for
 * the floor-dominated regime).
 *
 * @param nCoef  mid-band COEFFICIENTS read (= scanned blocks × band length), not blocks.
 * @param hypotheses  family size K (default 1 ⇒ numerically identical to the legacy floor).
 */
export function detectionThreshold(nCoef: number, hypotheses = 1): number {
  const sigma = Math.sqrt(DETECT_MIN_SIGMA ** 2 + 2 * Math.log(Math.max(1, hypotheses)));
  return Math.max(DETECT_THRESHOLD, sigma / Math.sqrt(nCoef));
}

// Legacy name kept for the internal K=1 call sites (both schemes, inside
// detectWatermark). √(16 + 2·ln 1) = 4 = DETECT_MIN_SIGMA, so this is BYTE-for-byte
// the old max(DETECT_THRESHOLD, DETECT_MIN_SIGMA/√n) — the recalibration adds a
// parameter without moving any existing decision.
function thresholdForCoefficients(nCoef: number): number {
  return detectionThreshold(nCoef, 1);
}

// PSNR floor (dB) the embed must stay above; it backs strength off and retries
// if a first pass would perturb the image past this.
const PSNR_FLOOR = 40;
const MAX_STRENGTH_RETRIES = 3;

const N = 8;
const BLOCK = N * N;

// ── Orthonormal 8×8 DCT-II basis ─────────────────────────────────────────────
// M[u*8+x] = α(u)·cos((2x+1)uπ/16), α(0)=√(1/8), α(u>0)=√(2/8). M is orthonormal
// so the inverse transform is Mᵀ — a 2D block round-trips to itself (float-exact).
const M = (() => {
  const m = new Float64Array(BLOCK);
  for (let u = 0; u < N; u++) {
    const a = u === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
    for (let x = 0; x < N; x++) m[u * N + x] = a * Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N));
  }
  return m;
})();

// Forward 2D DCT of a row-major 8×8 block: C = M · B · Mᵀ, i.e.
// C[v][u] = Σ_y Σ_x M[v][y] M[u][x] B[y][x]. Reuses two scratch buffers.
function dct2(block: Float64Array, tmp: Float64Array, out: Float64Array): void {
  // rows: tmp[y][u] = Σ_x M[u][x] B[y][x]
  for (let y = 0; y < N; y++) {
    for (let u = 0; u < N; u++) {
      let s = 0;
      for (let x = 0; x < N; x++) s += M[u * N + x]! * block[y * N + x]!;
      tmp[y * N + u] = s;
    }
  }
  // cols: out[v][u] = Σ_y M[v][y] tmp[y][u]
  for (let v = 0; v < N; v++) {
    for (let u = 0; u < N; u++) {
      let s = 0;
      for (let y = 0; y < N; y++) s += M[v * N + y]! * tmp[y * N + u]!;
      out[v * N + u] = s;
    }
  }
}

// Inverse: B = Mᵀ · C · M (transpose because M is orthonormal).
function idct2(coef: Float64Array, tmp: Float64Array, out: Float64Array): void {
  // cols: tmp[y][u] = Σ_v M[v][y] C[v][u]
  for (let y = 0; y < N; y++) {
    for (let u = 0; u < N; u++) {
      let s = 0;
      for (let v = 0; v < N; v++) s += M[v * N + y]! * coef[v * N + u]!;
      tmp[y * N + u] = s;
    }
  }
  // rows: out[y][x] = Σ_u M[u][x] tmp[y][u]
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let s = 0;
      for (let u = 0; u < N; u++) s += M[u * N + x]! * tmp[y * N + u]!;
      out[y * N + x] = s;
    }
  }
}

// Mid-band coefficient positions (linear v*8+u), by JPEG zig-zag rank: past DC and
// the lowest AC (visible blocking) but below the highest frequencies (which JPEG
// quantizes to zero first). The current scheme (v2) marks and reads V2_MIDBAND;
// V1_MIDBAND is kept only so the detector can still read pre-v2 imprints.
//
// v1 = ranks 6..20 (15 coefficients). v2 = ranks 6..27 (22 coefficients) — a
// SUPERSET of v1's band extended with ranks 21..27, so the mark's energy spreads
// over more coefficients at a lower per-coefficient magnitude (each perturbation
// smaller and less visible) while the summed correlation stays comfortably
// detectable. Ranks past ~27 were measured to HURT: they die under JPEG q50 yet
// still inflate the /√n normalization, so the band deliberately stops at 27.
const V1_MIDBAND: readonly number[] = [3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40];
const V2_MIDBAND: readonly number[] = [3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6];
// The current embed/detect band. MIN_IMPRINT_BLOCKS and the embed path key off this.
const MIDBAND = V2_MIDBAND;

// The v2 mid-band length (derived, so it can never drift from the table). Exported
// so a search wrapper (watermark-search.ts) can derive nCoef = blocks × V2_BAND_SIZE
// from a DetectResult without duplicating the band contents (which stay private).
export const V2_BAND_SIZE = V2_MIDBAND.length;

// ── Imprint-on-embed size floor ──────────────────────────────────────────────
// The fewest full 8×8 blocks an image needs before embedding a mark is worth it
// at all. thresholdForCoefficients raises the detection bar as 1/√n for small n
// (few blocks ⇒ a wide null distribution), so below the crossover — where the
// σ-floor DETECT_MIN_SIGMA/√n overtakes the fixed DETECT_THRESHOLD — a mark has no
// robustness margin left once the image is JPEG-recompressed / resized /
// screenshotted in the wild (a CLEAN embed still round-trips on tiny images, but
// that's not the case this protects). Solve n = (DETECT_MIN_SIGMA/DETECT_THRESHOLD)²
// for the mid-band coefficients scanned, then divide by MIDBAND.length for the
// non-flat-block count: ≈ 594 blocks, a ~195×195 px image (the same crossover noted
// on thresholdForCoefficients). The v2 band (22 coefficients, up from v1's 15) lowered
// this floor — more coefficients per block means fewer blocks reach the σ-crossover.
//
// Callers that bake MANY small decorative rasters into a container (a PDF/PPTX
// embed) gate on this so they never imprint icons that couldn't carry a durable
// mark anyway; the standalone raster encoders skip the check — the user chose a
// raster format outright, and embedWatermark already no-ops flat/sub-block input.
// It is a NECESSARY, not sufficient, floor: flat blocks don't count toward
// detection, so a real image needs at least this many blocks and usually more.
export const MIN_IMPRINT_BLOCKS = Math.ceil((DETECT_MIN_SIGMA / DETECT_THRESHOLD) ** 2 / MIDBAND.length);

/**
 * True when an RGBA raster is large enough that embedding a Lolly watermark is
 * worth it — it spans at least MIN_IMPRINT_BLOCKS full 8×8 blocks. Pure and
 * DOM-free: a size predicate only, it neither reads nor writes pixels.
 */
export function canCarryWatermark(width: number, height: number): boolean {
  const bw = Math.floor(width / N);
  const bh = Math.floor(height / N);
  return bw >= 1 && bh >= 1 && bw * bh >= MIN_IMPRINT_BLOCKS;
}

// Deterministic ±1 chip sequence for the mid-band, derived from a fixed key.
// mulberry32 keeps this reproducible across every shell with no dependency.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Fixed keys, one per scheme version. Rotating a key (and bumping
// WATERMARK_VERSION) retires an old one; the detector still tries the last key so
// files imprinted under it keep detecting. Each chip is the SAME mulberry32
// derivation over its own MIDBAND, so extending the band naturally extends the chip.
const CHIP_KEY_V1 = 0x10_11_1e_5c;
const CHIP_KEY_V2 = 0x20_22_2d_6e;
const deriveChip = (key: number, band: readonly number[]): readonly number[] => {
  const rnd = mulberry32(key);
  return band.map(() => (rnd() < 0.5 ? -1 : 1));
};
const V1_CHIP = deriveChip(CHIP_KEY_V1, V1_MIDBAND);
const V2_CHIP = deriveChip(CHIP_KEY_V2, V2_MIDBAND);
// The current embed/detect chip pairs with MIDBAND (= V2_MIDBAND).
const CHIP = V2_CHIP;

// Per-block AC-RMS "activity" — how textured the block is. Drives both the
// flat-block gate and the perceptual mask below.
function blockActivity(coef: Float64Array): number {
  let acEnergy = 0;
  for (let i = 1; i < BLOCK; i++) acEnergy += coef[i]! * coef[i]!; // skip DC (i=0)
  return Math.sqrt(acEnergy / (BLOCK - 1));
}

// Below this AC-RMS a block is treated as flat: it carries NO mark (banding
// would show and the signal would be weak) and is skipped by the detector. Also
// sidesteps a degenerate case — bit-identical flat blocks whose float-residual
// mid-band could otherwise correlate with the chip by chance. v2 raises this from
// v1's 1.5 to 2.5 so SMOOTH-BUT-NOT-FLAT blocks (skies/skin/gradients, activity
// 1.5–2.5) — where a mid-band mark reads as visible JPEG-like texture — now carry
// nothing; the mark rides only in genuinely textured blocks that hide it. The v1
// detection pass still uses the old 1.5 gate (V1_ACTIVITY_FLOOR) so it reads back
// blocks the v1 embedder marked.
const ACTIVITY_FLOOR = 2.5;
const V1_ACTIVITY_FLOOR = 1.5;

// Perceptual mask: scale the per-block perturbation by texture energy so busy
// blocks (which hide noise) carry more of the mark. Returns 0 for flat blocks.
// v2 drops MASK_MIN from 0.35 to 0.12 so the smoothest blocks that DO clear the
// gate ramp up gently from the floor instead of being stamped at a fixed 0.35 (the
// old ~0.35×5.5≈1.9-magnitude perturbation that made smooth regions look noisy).
const MASK_MIN = 0.12;
const MASK_MAX = 2.5;
const MASK_REF = 9; // reference AC-RMS mapped to mask 1.0
function blockMask(activity: number): number {
  if (activity < ACTIVITY_FLOOR) return 0;
  const m = activity / MASK_REF;
  return m < MASK_MIN ? MASK_MIN : m > MASK_MAX ? MASK_MAX : m;
}

// Rec.601 luma — matches JPEG's own luma weighting (and where a pixel-domain mark
// survives best). Returned as a Float64 plane, one sample per pixel.
function lumaPlane(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number): Float64Array {
  const Y = new Float64Array(w * h);
  for (let i = 0, p = 0; i < Y.length; i++, p += 4) {
    Y[i] = 0.299 * rgba[p]! + 0.587 * rgba[p + 1]! + 0.114 * rgba[p + 2]!;
  }
  return Y;
}

/**
 * Embed the Lolly watermark into an RGBA buffer, returning a new buffer. Only the
 * luma is perturbed (an equal delta added to R/G/B preserves hue exactly); alpha
 * and chroma are untouched. Images narrower/shorter than one 8×8 block are
 * returned unchanged. Best-effort: never throws — a fault returns the input copy.
 */
export function embedWatermark(rgba: Uint8Array | Uint8ClampedArray, opts: EmbedOptions): Uint8Array {
  const { width: w, height: h } = opts;
  const out = new Uint8Array(rgba.length);
  out.set(rgba);
  const bw = Math.floor(w / N);
  const bh = Math.floor(h / N);
  if (bw < 1 || bh < 1 || w * h * 4 > rgba.length) return out;

  try {
    const Y = lumaPlane(rgba, w, h);
    const base = opts.strength ?? DEFAULT_STRENGTH;
    for (let attempt = 0; attempt <= MAX_STRENGTH_RETRIES; attempt++) {
      const eps = base * Math.pow(0.7, attempt);
      const delta = applyMark(Y, w, bw, bh, eps); // per-pixel luma delta for full blocks
      const marked = writeLumaDelta(rgba, delta, w, h);
      if (psnrRgb(rgba, marked) >= PSNR_FLOOR || attempt === MAX_STRENGTH_RETRIES) return marked;
    }
    return out;
  } catch {
    return out;
  }
}

// Compute the per-pixel luma delta (only inside full 8×8 blocks) for a given eps.
function applyMark(Y: Float64Array, w: number, bw: number, bh: number, eps: number): Float64Array {
  const delta = new Float64Array(Y.length);
  const block = new Float64Array(BLOCK);
  const tmp = new Float64Array(BLOCK);
  const coef = new Float64Array(BLOCK);
  const marked = new Float64Array(BLOCK);
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      const ox = bx * N, oy = by * N;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) block[y * N + x] = Y[(oy + y) * w + (ox + x)]!;
      dct2(block, tmp, coef);
      const mask = blockMask(blockActivity(coef));
      if (mask === 0) continue; // flat block — leave it pristine
      for (let k = 0; k < MIDBAND.length; k++) coef[MIDBAND[k]!]! += eps * CHIP[k]! * mask;
      idct2(coef, tmp, marked);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        delta[(oy + y) * w + (ox + x)] = marked[y * N + x]! - block[y * N + x]!;
      }
    }
  }
  return delta;
}

// Add a luma delta back to RGB (equal to each channel → hue-preserving), clamped.
function writeLumaDelta(rgba: Uint8Array | Uint8ClampedArray, delta: Float64Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(rgba.length);
  out.set(rgba);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    const d = delta[i]!;
    if (d === 0) continue;
    out[p] = clamp8(rgba[p]! + d);
    out[p + 1] = clamp8(rgba[p + 1]! + d);
    out[p + 2] = clamp8(rgba[p + 2]! + d);
  }
  return out;
}

function clamp8(v: number): number {
  const r = Math.round(v);
  return r < 0 ? 0 : r > 255 ? 255 : r;
}

function psnrRgb(a: Uint8Array | Uint8ClampedArray, b: Uint8Array): number {
  let sse = 0, n = 0;
  for (let p = 0; p < a.length; p += 4) {
    for (let c = 0; c < 3; c++) { const d = a[p + c]! - b[p + c]!; sse += d * d; n++; }
  }
  if (n === 0 || sse === 0) return Infinity;
  const mse = sse / n;
  return 10 * Math.log10((255 * 255) / mse);
}

/**
 * Detect the Lolly watermark in an RGBA buffer. Reads luma, forward-DCTs every
 * full 8×8 block, and accumulates a normalized correlation of the mid-band
 * against the chip sequence across all blocks.
 *
 * BOTH schemes are read in one DCT pass: the current v2 band/chip AND the legacy
 * v1 band/chip (each with its own activity gate, since v1 marked down to activity
 * 1.5 and v2 only down to 2.5). `present` fires if EITHER scheme clears its own
 * size-adjusted threshold, and `score` is the larger of the two — so a file
 * imprinted under v1 (a `?imprint=1` export from before the v2 re-calibration)
 * still detects. Never throws — a fault reports absent.
 */
export function detectWatermark(rgba: Uint8Array | Uint8ClampedArray, opts: WatermarkGeometry): DetectResult {
  const { width: w, height: h } = opts;
  const bw = Math.floor(w / N);
  const bh = Math.floor(h / N);
  if (bw < 1 || bh < 1 || w * h * 4 > rgba.length) return { present: false, score: 0, blocks: 0 };

  try {
    const Y = lumaPlane(rgba, w, h);
    const block = new Float64Array(BLOCK);
    const tmp = new Float64Array(BLOCK);
    const coef = new Float64Array(BLOCK);
    let acc2 = 0, energy2 = 0, n2 = 0, scanned2 = 0; // v2 (current) scheme
    let acc1 = 0, energy1 = 0, n1 = 0;               // v1 (legacy) scheme
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        const ox = bx * N, oy = by * N;
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) block[y * N + x] = Y[(oy + y) * w + (ox + x)]!;
        dct2(block, tmp, coef);
        const activity = blockActivity(coef);
        if (activity >= ACTIVITY_FLOOR) { // v2 gate (2.5) — the current scheme
          scanned2++;
          for (let k = 0; k < V2_MIDBAND.length; k++) {
            const c = coef[V2_MIDBAND[k]!]!;
            acc2 += V2_CHIP[k]! * c; energy2 += c * c; n2++;
          }
        }
        if (activity >= V1_ACTIVITY_FLOOR) { // v1 gate (1.5) — legacy read-back only
          for (let k = 0; k < V1_MIDBAND.length; k++) {
            const c = coef[V1_MIDBAND[k]!]!;
            acc1 += V1_CHIP[k]! * c; energy1 += c * c; n1++;
          }
        }
      }
    }
    // Normalized correlation ∈ [-1, 1]: acc / √(energy · n). ~0 for unmarked
    // content (mid-band uncorrelated with the chip); positive when marked. Each
    // scheme uses its own size-adjusted threshold (see thresholdForCoefficients).
    const score2 = energy2 > 0 ? acc2 / Math.sqrt(energy2 * n2) : 0;
    const score1 = energy1 > 0 ? acc1 / Math.sqrt(energy1 * n1) : 0;
    const present2 = n2 > 0 && score2 > thresholdForCoefficients(n2);
    const present1 = n1 > 0 && score1 > thresholdForCoefficients(n1);
    return { present: present2 || present1, score: Math.max(score1, score2), blocks: scanned2 };
  } catch {
    return { present: false, score: 0, blocks: 0 };
  }
}
