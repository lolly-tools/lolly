// SPDX-License-Identifier: MPL-2.0
/**
 * Meta Content Seal (Pixel Seal / Video Seal, IMAGE mode) — the pure,
 * message-free consensus decision (DOM-free, no ONNX, no network).
 *
 * The neural half — fetching the converted ONNX extractor, running inference
 * over four augmented views of an image, thresholding each per-view logit map
 * into 256 message bits — lives in the WEB SHELL
 * (shells/web/src/lib/contentseal.ts), which depends on onnxruntime-web and a
 * <canvas>. This module starts AFTER that: it takes the several 256-bit vectors
 * the extractor produced (one per view) and answers the only question the UI
 * asks — "is a single, consistent watermark message present?" — WITHOUT a
 * registered key. That keeps the engine dependency-light and lets the rule be
 * unit-tested in plain node:test against hand-constructed inputs.
 *
 * ── Why a message-free consensus test (not the paper's binomial bound) ──────
 * The Pixel Seal / Video Seal paper (arXiv 2512.16874) anchors detection in a
 * binomial false-positive bound over the Hamming distance to a KNOWN registered
 * message m — sum_{k<=dH(m,m_hat)} C(nbits,k)/2^nbits. We do NOT have a
 * registered message, so that bound doesn't apply. Instead we exploit the
 * watermark's designed robustness: a genuinely watermarked image decodes to the
 * SAME message under heavy augmentation, whereas an un-watermarked image decodes
 * to augmentation-dependent noise. The web shell builds V views of the candidate
 * (original + JPEG q85 + JPEG q60 + a 5% centre crop) and re-runs the extractor
 * on each; this module counts the message-bit positions on which ALL V views
 * agree (all-0 or all-1) and calls the watermark PRESENT only when that count U
 * clears a threshold tau.
 *
 * ── The idealized false-positive math (an APPROXIMATION — see the caveat) ────
 * Under a null of "no watermark, each view's bits i.i.d. Bernoulli(1/2), the V
 * views mutually independent", the chance a given position is unanimous is
 * 2·(1/2)^V. For V=4 that is 1/8, so U ~ Binomial(256, 1/8): mean 32, sd ≈ 5.29.
 * tau ≈ 64 gives P(U>=64) ~ 1e-9 (~6σ); tau ≈ 72 (CONTENTSEAL_DEFAULT_TAU)
 * pushes it to ~1e-13. A truly watermarked image yields U ~ 250+, so the margin
 * is huge and the threshold is not sensitive — for FOUR views. tau is calibrated
 * for the view count; feeding a different number of views with the same tau
 * changes the per-position unanimity chance (2/2^V) and would break the bound,
 * so the caller MUST keep the view count fixed at what tau was chosen for.
 *
 * ── HONESTY CAVEAT (gates any "it works" claim) ─────────────────────────────
 * The Bernoulli(1/2)/independence null is only an approximation. Un-watermarked
 * natural images can make the extractor emit content-correlated bits that agree
 * across views (especially the near-identical original vs JPEG q85), inflating U
 * and the real false-positive rate above the clean binomial tail. The heavy
 * augmentations (q60 + 5% crop) exist to decorrelate content so the null roughly
 * holds, but tau MUST ultimately be calibrated empirically against a large clean
 * corpus, not trusted from the theoretical tail alone. And the whole neural path
 * that produces the per-view bits is UNVERIFIED in this repo (no browser, no ONNX
 * runtime, no real checkpoint) — this module's math is tested; the bits fed into
 * it are not proven to come from a real detection. See the web-shell module's
 * header for that half of the ledger, including the Meta "Muse" proprietary
 * caveat (the open extractor does not read production Muse output).
 */

/** The open Pixel Seal / Video Seal image models carry a 256-bit message
 *  (`nbits: 256` in videoseal's model cards). The neural extractor emits a
 *  [1, 1+nbits, H, W] logit map; the web shell spatially averages and drops the
 *  index-0 detection bit, handing this module exactly this many message bits per
 *  view. */
export const CONTENTSEAL_MESSAGE_BITS = 256;

/** Default unanimity threshold for the FOUR-view test (original + JPEG q85 +
 *  JPEG q60 + 5% crop). ~1e-13 idealized false-positive rate (see the header);
 *  deliberately conservative because the binomial null is only an approximation
 *  and this codebase holds a hard "no false positives" bar for a green pip. Must
 *  be re-tuned if the view count changes, and ideally calibrated empirically. */
export const CONTENTSEAL_DEFAULT_TAU = 72;

export interface ContentSealConsensus {
  /** True iff `unanimous >= tau` with at least 2 equal-length views — a single
   *  consistent message survived all the augmentations. The ONLY field the UI
   *  turns into a positive verdict. */
  present: boolean;
  /** U — the number of message-bit positions on which every view agreed
   *  (all-0 or all-1). Informational; the operating statistic. */
  unanimous: number;
  /** The number of message bits compared (the common view length; 0 for
   *  malformed input). */
  bits: number;
  /** The threshold `unanimous` was compared against (the `tau` used). */
  tau: number;
  /** How many views were compared (4 in the shipped web path). */
  views: number;
  /** The smallest bit-agreement count over all view PAIRS — a stricter,
   *  reported-only diagnostic (a single badly-decoded view drags this down even
   *  when overall unanimity is high). Not part of the verdict. */
  minPairAgreement: number;
  /** The consensus message (per-bit majority across views, ties broken by the
   *  first view) packed MSB-first to lowercase hex. Meaningful only when
   *  `present`; computed always (it is cheap). '' for malformed input. */
  messageHex: string;
}

/** Packs a 0/1 bit array MSB-first into lowercase hex (zero-padded to a nibble). */
function bitsToHex(bits: readonly number[]): string {
  const pad = (4 - (bits.length % 4)) % 4;
  let hex = '';
  for (let i = 0; i < bits.length + pad; i += 4) {
    let nib = 0;
    for (let j = 0; j < 4; j++) nib = (nib << 1) | (bits[i + j] ? 1 : 0);
    hex += nib.toString(16);
  }
  return hex;
}

/**
 * The message-free 4-views unanimity test (see this module's header).
 *
 * Given several equal-length message-bit vectors — one decoded from each
 * augmented view of a candidate image — count the positions on which ALL views
 * agree and decide the watermark is PRESENT iff that count reaches `tau`.
 *
 * Pure and defensive: never throws. Fewer than 2 views, an empty view, or views
 * of differing length are treated as "cannot decide" → `present: false` with
 * `unanimous: 0` (the honest non-answer, never a false positive). Bits are read
 * truthily, so booleans and 0/1 numbers are both accepted.
 */
export function contentSealConsensus(
  views: ReadonlyArray<ArrayLike<number | boolean>>,
  opts: { tau?: number } = {},
): ContentSealConsensus {
  const tau = opts.tau ?? CONTENTSEAL_DEFAULT_TAU;
  const V = views.length;
  const bits = V > 0 ? views[0]!.length : 0;

  // Not enough views, or ragged/empty input → cannot measure agreement. Return
  // the safe non-answer rather than guessing (and never a false "present").
  if (V < 2 || bits === 0 || views.some((v) => v.length !== bits)) {
    return { present: false, unanimous: 0, bits, tau, views: V, minPairAgreement: 0, messageHex: '' };
  }

  // Per-pair agreement tallies, so the weakest pair can be reported alongside
  // the overall unanimity (a single rogue view shows up here, not in U).
  const pairCount = (V * (V - 1)) / 2;
  const pairAgree = new Array<number>(pairCount).fill(0);

  const message: number[] = new Array(bits);
  let unanimous = 0;

  for (let i = 0; i < bits; i++) {
    let ones = 0;
    // Read each view's bit once; count set bits and tally pairwise agreement.
    let pair = 0;
    for (let a = 0; a < V; a++) {
      const ba = views[a]![i] ? 1 : 0;
      if (ba) ones++;
      for (let b = a + 1; b < V; b++) {
        if (ba === (views[b]![i] ? 1 : 0)) pairAgree[pair] = pairAgree[pair]! + 1;
        pair++;
      }
    }
    if (ones === 0 || ones === V) unanimous++;
    // Majority vote, ties (only possible for even V) broken by the first view.
    message[i] = ones * 2 > V ? 1 : ones * 2 < V ? 0 : (views[0]![i] ? 1 : 0);
  }

  const minPairAgreement = pairAgree.length ? Math.min(...pairAgree) : bits;

  return {
    present: unanimous >= tau,
    unanimous,
    bits,
    tau,
    views: V,
    minPairAgreement,
    messageHex: bitsToHex(message),
  };
}
