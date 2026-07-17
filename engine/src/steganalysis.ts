// SPDX-License-Identifier: MPL-2.0
// ─── Classical LSB steganalysis — Westfeld–Pfitzmann chi-square attack ────────
//
// Detects the dominant *steganography* method in the wild: least-significant-bit
// substitution (CTF payloads, stego-loader malware configs — always in lossless
// formats, because one recompression erases it). The insight: natural images
// have ROUGH histograms — adjacent values genuinely differ — while LSB embedding
// equalises each value PAIR (2k, 2k+1) toward its mean, leaving the pair
// boundaries untouched. A chi-square statistic over the pairs separates the two:
// large (histogram roughness) → natural; small (pairs equalised) → embedded.
//
// Honesty limits, stated up front: this detects near-full sequential/random
// LSB *substitution* — the naive-but-common case. LSB *matching* (±1) and
// low-rate embedding evade it; a smooth synthetic gradient can false-positive
// (its histogram is genuinely flat). Callers gate it to formats where LSB stego
// actually exists (PNG-family lossless) and surface it as an amber HEURISTIC,
// never a verdict. Pure + DOM-free, mirroring pixel-watermark.ts.

export interface LsbAnalysis {
  /** True when the pair statistics match LSB embedding (see thresholds below). */
  suspicious: boolean;
  /** Max embedding probability seen across the scanned prefixes, in [0, 1]. */
  score: number;
  /** Pixels examined (0 ⇒ image too small to judge — never suspicious). */
  pixels: number;
}

// Below this many pixels the chi-square has too few samples per bin to mean
// anything — report unsuspicious rather than guess.
const MIN_PIXELS = 64 * 64;
// Embedding probability a prefix must reach, on every colour channel, before
// the image is flagged. 0.95 is the classic operating point for this test.
const P_THRESHOLD = 0.95;
// Sequential embedding fills the image from the start, so a partially-filled
// carrier looks natural over the whole image but saturated over its head —
// scan nested prefixes and keep the worst (highest-probability) result.
const PREFIXES = [0.25, 0.5, 1];

// Regularized upper incomplete gamma Q(a, x) — the chi-square survival function
// (p-value machinery). Series for x < a+1, Lentz continued fraction otherwise;
// the standard Numerical-Recipes-style pair, accurate far beyond what a 0.95
// threshold needs.
function gammaQ(a: number, x: number): number {
  if (x < 0 || a <= 0) return 1;
  if (x === 0) return 1;
  const gln = lnGamma(a);
  if (x < a + 1) {
    // series for P(a,x), return 1 - P
    let ap = a, sum = 1 / a, del = sum;
    for (let i = 0; i < 200; i++) {
      ap++; del *= x / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-9) break;
    }
    return Math.max(0, 1 - sum * Math.exp(-x + a * Math.log(x) - gln));
  }
  // continued fraction for Q(a,x) directly
  let b = x + 1 - a, c = 1 / 1e-30, d = 1 / b, h = d;
  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-9) break;
  }
  return Math.min(1, Math.exp(-x + a * Math.log(x) - gln) * h);
}

function lnGamma(x: number): number {
  // Lanczos, g=7 — plenty for half-integer chi-square dof.
  const c = [676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < 8; i++) a += c[i]! / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// Chi-square embedding probability for ONE channel over the first `n` pixels:
// histogram → pair statistic r = Σ (h[2k] − e)² / e with e = (h[2k]+h[2k+1])/2,
// r ~ χ²(k−1) under embedding (small) — p = Q((k−1)/2, r/2) is the probability
// the pairs are equalised, i.e. of embedding. Pairs with e < 5 are skipped
// (classic validity rule for the test).
function channelP(rgba: Uint8Array | Uint8ClampedArray, channel: number, n: number): number {
  const h = new Float64Array(256);
  for (let i = 0; i < n; i++) h[rgba[i * 4 + channel]!]!++;
  let chi2 = 0, k = 0;
  for (let v = 0; v < 256; v += 2) {
    const e = (h[v]! + h[v + 1]!) / 2;
    if (e < 5) continue;
    chi2 += ((h[v]! - e) * (h[v]! - e)) / e;
    k++;
  }
  if (k < 2) return 0; // degenerate histogram — nothing to say
  return gammaQ((k - 1) / 2, chi2 / 2);
}

/**
 * Chi-square LSB steganalysis over an RGBA buffer. Scans nested prefixes (25%,
 * 50%, 100% of pixels — sequential embedding saturates the head first) and
 * flags `suspicious` when every colour channel of some prefix reads as
 * pair-equalised with probability ≥ 0.95. Never throws; a fault or a
 * too-small image reports unsuspicious.
 */
export function analyzeLsb(rgba: Uint8Array | Uint8ClampedArray, opts: { width: number; height: number }): LsbAnalysis {
  const total = Math.min(opts.width * opts.height, Math.floor(rgba.length / 4));
  if (total < MIN_PIXELS) return { suspicious: false, score: 0, pixels: total };
  try {
    let best = 0;
    for (const f of PREFIXES) {
      const n = Math.floor(total * f);
      if (n < MIN_PIXELS) continue;
      // ALL of R, G, B must read embedded — the min across channels is the
      // prefix's probability. (Grey images have identical channels; colour
      // stego payloads touch all three.)
      const p = Math.min(channelP(rgba, 0, n), channelP(rgba, 1, n), channelP(rgba, 2, n));
      if (p > best) best = p;
    }
    return { suspicious: best >= P_THRESHOLD, score: best, pixels: total };
  } catch {
    return { suspicious: false, score: 0, pixels: total };
  }
}
