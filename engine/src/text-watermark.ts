// SPDX-License-Identifier: MPL-2.0
/**
 * Statistical text watermark - the green-list scheme of Kirchenbauer et al.,
 * "A Watermark for Large Language Models" (arXiv:2301.10226), as Lolly's own
 * generation paths embed it and /verify detects it.
 *
 * The scheme, in the paper's terms: at each generation step a hash of the
 * PREVIOUS token id (keyed by the scheme key) partitions the vocabulary into a
 * "green" fraction `gamma` and a "red" rest; the sampler adds `delta` to every
 * green logit, so generated text over-selects green tokens in a way invisible
 * to a reader. Detection needs no model: re-tokenize the text, count how many
 * tokens are green given their predecessor, and test the null hypothesis "no
 * watermark" with a one-proportion z-test,
 *
 *     z = (green - gamma*T) / sqrt(T * gamma * (1 - gamma))
 *
 * where T is the number of scored tokens. z >= 4 is the paper's operating
 * point (one-sided p ~ 3e-5).
 *
 * Three departures from the paper, all deliberate:
 *  - Detection thresholds on the EXACT binomial tail, not the z line: a lone
 *    reworded sentence is 10-15 scorable tokens, and at that length the normal
 *    approximation understates the chance of a lucky green run by an order of
 *    magnitude - exactly where a false accusation would land. `z` is still
 *    reported for display.
 *  - Detection scores each UNIQUE (prev, token) bigram once. Repeated bigrams
 *    re-test the same green/red coin flip, so degenerate repetitive text (a
 *    word repeated hundreds of times) would otherwise random-walk to a huge
 *    |z| and convict a human. The paper suggests exactly this guard.
 *  - A windowed pass (best z over sliding windows of deduped tokens) catches a
 *    few reworded sentences inside a longer human document, where the
 *    whole-document average would dilute below threshold. Windows multiply the
 *    tests run, so the windowed threshold is stricter than the whole-text one.
 *
 * The key is PUBLIC by design - detection happens on other people's devices,
 * so this is the paper's "public mode": anyone can verify, and anyone who
 * cares to could also deliberately write green-heavy text. A match is
 * therefore a provenance disclosure ("this matches what Lolly's reword model
 * leaves behind"), not a cryptographic guarantee. It survives copy/paste,
 * plain-text export and even OCR (the signal is the visible word choice, not
 * bytes), but not a thorough human rewrite - and low-entropy text (code,
 * boilerplate) carries it weakly, since a finite `delta` cannot move a
 * near-deterministic token onto the green list.
 *
 * Pure and DOM-free: token ids in, numbers out. The tokenizer lives with the
 * shell that owns the model (the reword worker); this module is the single
 * source of the hash, the bias and the test, so an embedder and a detector can
 * never drift. The native desktop sampler (shells/tauri-desktop reword.rs)
 * mirrors `mix32`/`isGreenToken` in Rust against the pinned vectors in
 * tests/text-watermark.test.ts.
 */

/** One named green-list watermark: everything an embedder or detector needs. */
export interface WatermarkScheme {
  /** Stable id, recorded on detections. */
  id: string;
  /** Keys the vocabulary partition. Public - see the module header. */
  key: number;
  /** Green fraction of the vocabulary (the paper's gamma). */
  gamma: number;
  /** Logit bias on green tokens at generation (the paper's delta). Applied
   *  BEFORE temperature in both samplers, so the effective bias at sampling
   *  time is delta/temperature. */
  delta: number;
  /** Fewer scored tokens than this and no whole-text claim is made. */
  minTokens: number;
  /** Whole-text one-sided p at or below this detects. The p is an EXACT
   *  binomial tail at realistic lengths (see `binomialTailP`) - at the 10-15
   *  scorable tokens of a lone reworded sentence the normal z overstates the
   *  evidence, which is precisely where a false "Reworded with Lolly" would
   *  land on a human. */
  pThreshold: number;
  /** Sliding-window width, in scored tokens. */
  windowTokens: number;
  /** Window stride, in scored tokens. */
  windowStride: number;
  /** Windowed p threshold - much stricter, because a long document tests many
   *  windows (a 3000-token text at stride 8 is ~370 of them). */
  windowPThreshold: number;
}

/** The watermark Lolly's on-device reword model embeds (plans/127). gamma 0.25
 *  with a strong delta because rewrites are SHORT - a lone reworded sentence
 *  measures 10-15 scorable tokens end to end, and detection needs nearly all
 *  of them green; the reword gate, not delta, owns output quality (a mangled
 *  candidate is simply never offered). */
export const REWORD_WATERMARK: WatermarkScheme = {
  id: 'lolly-reword-v1',
  key: 0x4c4f4c4c, // 'LOLL'
  gamma: 0.25,
  delta: 6,
  minTokens: 10,
  pThreshold: 1e-4,
  windowTokens: 32,
  windowStride: 8,
  windowPThreshold: 3e-7,
};

/** 32-bit finalizer (Wellons' prospected mix) - full avalanche, so a gamma
 *  slice of its range is an unbiased vocabulary partition. */
export function mix32(x: number): number {
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x21f0aaad) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 0x735a2d97) >>> 0;
  return (x ^ (x >>> 15)) >>> 0;
}

/** Is `tokenId` on the green list when it follows `prevId`? */
export function isGreenToken(scheme: WatermarkScheme, prevId: number, tokenId: number): boolean {
  return mix32(mix32((prevId ^ scheme.key) >>> 0) ^ tokenId) < scheme.gamma * 0x100000000;
}

/**
 * The embedder: add `delta` to every green logit in one next-token row, given
 * the previous token. In-place; returns how many logits moved (the green count,
 * for tests). O(vocab) hashing per step - microseconds against a model step.
 */
export function addGreenBias(logits: Float32Array, prevId: number, scheme: WatermarkScheme): number {
  const seed = mix32((prevId ^ scheme.key) >>> 0);
  const cut = scheme.gamma * 0x100000000;
  let green = 0;
  for (let i = 0; i < logits.length; i++) {
    if (mix32(seed ^ i) < cut) {
      logits[i]! += scheme.delta;
      green++;
    }
  }
  return green;
}

/** The paper's detection statistic over a green count. */
export function greenListZ(green: number, total: number, gamma: number): number {
  if (total <= 0) return 0;
  return (green - gamma * total) / Math.sqrt(total * gamma * (1 - gamma));
}

/** One-sided normal tail P(Z >= z), Abramowitz & Stegun 26.2.17. */
function normalTailP(z: number): number {
  if (z < 0) return 1 - normalTailP(-z);
  const t = 1 / (1 + 0.2316419 * z);
  const poly = t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI) * poly;
}

/**
 * One-sided P(Bin(total, gamma) >= green) - EXACT for the totals a detection
 * actually sees, the normal tail beyond that. The exactness matters at the
 * short end: at total=12 the z=4 line is crossed by 9 greens, whose true tail
 * is ~4e-4, an order looser than the ~3e-5 the normal approximation claims.
 */
export function binomialTailP(green: number, total: number, gamma: number): number {
  if (total <= 0 || green <= 0) return 1;
  if (green > total) return 0;
  if (total > 200) return normalTailP(greenListZ(green, total, gamma));
  // First term C(total, green) gamma^green (1-gamma)^(total-green) in logs,
  // then the term ratio walks the rest of the tail.
  let logC = 0;
  for (let k = 1; k <= green; k++) logC += Math.log((total - green + k) / k);
  let term = Math.exp(logC + green * Math.log(gamma) + (total - green) * Math.log(1 - gamma));
  let sum = 0;
  for (let k = green; k <= total; k++) {
    sum += term;
    term *= ((total - k) / (k + 1)) * (gamma / (1 - gamma));
  }
  return Math.min(1, sum);
}

/** One detection result. `tokens`/`green` are UNIQUE bigrams scored (see the
 *  module header); `window` is the strongest sliding window when the text was
 *  long enough to window. `z` is reported for display; `detected` rides the
 *  exact tails `p`/`window.p` against the scheme's thresholds. */
export interface TextWatermarkScore {
  scheme: string;
  tokens: number;
  green: number;
  z: number;
  /** One-sided tail probability of `green` under no watermark. */
  p: number;
  window?: { tokens: number; green: number; z: number; p: number };
  detected: boolean;
}

/**
 * The detector: score a tokenized text against a scheme. Token ids come from
 * the SAME tokenizer the embedder generated with; the first token has no
 * predecessor and is never scored.
 */
export function scoreTokenWatermark(ids: ArrayLike<number>, scheme: WatermarkScheme): TextWatermarkScore {
  // Green flags per unique bigram, in first-occurrence order.
  const seen = new Set<string>();
  const flags: number[] = [];
  for (let i = 1; i < ids.length; i++) {
    const prev = ids[i - 1]!;
    const id = ids[i]!;
    const key = `${prev},${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    flags.push(isGreenToken(scheme, prev, id) ? 1 : 0);
  }
  const total = flags.length;
  let green = 0;
  for (const f of flags) green += f;
  const z = greenListZ(green, total, scheme.gamma);
  const p = binomialTailP(green, total, scheme.gamma);

  let window: TextWatermarkScore['window'];
  if (total > scheme.windowTokens) {
    const prefix = new Array<number>(total + 1);
    prefix[0] = 0;
    for (let i = 0; i < total; i++) prefix[i + 1] = prefix[i]! + flags[i]!;
    const w = scheme.windowTokens;
    for (let start = 0; start + w <= total; start += scheme.windowStride) {
      const g = prefix[start + w]! - prefix[start]!;
      if (!window || g > window.green) {
        window = { tokens: w, green: g, z: greenListZ(g, w, scheme.gamma), p: binomialTailP(g, w, scheme.gamma) };
      }
    }
  }

  const detected = (total >= scheme.minTokens && p <= scheme.pThreshold)
    || (window !== undefined && window.p <= scheme.windowPThreshold);
  return { scheme: scheme.id, tokens: total, green, z, p, ...(window ? { window } : {}), detected };
}
