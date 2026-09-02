// SPDX-License-Identifier: MPL-2.0
/**
 * audio-loudness.ts - ITU-R BS.1770-4 integrated loudness (plans/101 section 2.5,
 * plans/165's deferred tier).
 *
 * The measurement behind the export bar's "Normalize loudness" targets and the
 * inspector's per-clip Normalize: K-weighting (the standard's two fixed biquads),
 * 400 ms blocks at 75% overlap, a -70 LKFS absolute gate, then a -10 LU relative
 * gate over the surviving blocks. Pure, deterministic, streaming - the meter is
 * fed the same 0.1 s windows the mix feeder produces and never retains PCM, so
 * measuring a mix costs one extra analytic evaluation, not an O(duration) buffer.
 *
 * The K-weighting coefficients are the standard's own published values for
 * 48 kHz - the ONE rate every mix runs at (MIX_RATE) - and the meter refuses any
 * other rate rather than quietly measuring with wrong filters. The calibration
 * property the tests pin: the K-filter carries +0.691 dB at ~1 kHz and the
 * -0.691 offset cancels it, so a full-scale 997 Hz sine in both stereo channels
 * reads 0.0 LKFS and a -20 dBFS one reads -20.0.
 */

/** The one sample rate the coefficients below are published for. */
export const LOUDNESS_RATE = 48_000;

// BS.1770-4 stage 1: the high-shelf ("head") filter, 48 kHz.
const S1_B = [1.53512485958697, -2.69169618940638, 1.19839281085285];
const S1_A = [1, -1.69065929318241, 0.73248077421585];
// BS.1770-4 stage 2: the RLB high-pass, 48 kHz.
const S2_B = [1.0, -2.0, 1.0];
const S2_A = [1, -1.99004745483398, 0.99007225036621];

/** One direct-form-I biquad with its own state. (No constructor parameter
 *  properties: node's strip-only TypeScript loader refuses that syntax.) */
class Biquad {
  private b: readonly number[];
  private a: readonly number[];
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0;
  constructor(b: readonly number[], a: readonly number[]) {
    this.b = b;
    this.a = a;
  }
  step(x: number): number {
    const y = this.b[0]! * x + this.b[1]! * this.x1 + this.b[2]! * this.x2
      - this.a[1]! * this.y1 - this.a[2]! * this.y2;
    this.x2 = this.x1; this.x1 = x;
    this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

export interface LoudnessMeter {
  /** Feed one stereo chunk (any length; mono callers pass the same array twice). */
  push(left: Float32Array, right: Float32Array): void;
  /**
   * Integrated loudness of everything pushed so far, LKFS - or null when no
   * block survived the absolute gate (silence has no loudness).
   */
  integrated(): number | null;
}

/**
 * A streaming BS.1770-4 meter. Blocks are 400 ms hopping every 100 ms (75%
 * overlap); each block's energy is kept (a few numbers per 100 ms), never the
 * samples, so a feature-length mix meters in constant memory.
 */
export function createLoudnessMeter(rate: number = LOUDNESS_RATE): LoudnessMeter {
  if (rate !== LOUDNESS_RATE) {
    throw new Error(`BS.1770 coefficients are published for ${LOUDNESS_RATE} Hz; got ${rate}`);
  }
  const hop = Math.round(rate * 0.1);          // 100 ms
  const HOPS_PER_BLOCK = 4;                    // 400 ms of them
  const filters = [
    { s1: new Biquad(S1_B, S1_A), s2: new Biquad(S2_B, S2_A) },
    { s1: new Biquad(S1_B, S1_A), s2: new Biquad(S2_B, S2_A) },
  ];
  // Per-channel running energy of the CURRENT 100 ms hop, plus the finished hops.
  let hopSum = [0, 0];
  let hopFill = 0;
  const hopEnergies: number[][] = [[], []];    // per channel, one entry per hop
  const blocks: number[] = [];                 // per-block loudness, LKFS

  const closeHop = (): void => {
    hopEnergies[0]!.push(hopSum[0]!);
    hopEnergies[1]!.push(hopSum[1]!);
    hopSum = [0, 0];
    hopFill = 0;
    const hops = hopEnergies[0]!.length;
    if (hops >= HOPS_PER_BLOCK) {
      let ms = 0;
      for (let c = 0; c < 2; c++) {
        const e = hopEnergies[c]!;
        ms += (e[hops - 4]! + e[hops - 3]! + e[hops - 2]! + e[hops - 1]!) / (hop * HOPS_PER_BLOCK);
      }
      blocks.push(-0.691 + 10 * Math.log10(Math.max(ms, 1e-15)));
    }
  };

  return {
    push(left: Float32Array, right: Float32Array): void {
      for (let i = 0; i < left.length; i++) {
        const kl = filters[0]!.s2.step(filters[0]!.s1.step(left[i]!));
        const kr = filters[1]!.s2.step(filters[1]!.s1.step(right[i] ?? left[i]!));
        hopSum[0]! += kl * kl;
        hopSum[1]! += kr * kr;
        hopFill++;
        if (hopFill === hop) closeHop();
      }
    },
    integrated(): number | null {
      // Absolute gate at -70 LKFS, then the relative gate 10 LU under the mean
      // of what survived - both over the 400 ms block loudnesses, per the standard.
      const abs = blocks.filter((b) => b > -70);
      if (!abs.length) return null;
      const meanEnergy = (list: number[]): number =>
        list.reduce((a, b) => a + 10 ** ((b + 0.691) / 10), 0) / list.length;
      const relGate = -0.691 + 10 * Math.log10(meanEnergy(abs)) - 10;
      const rel = abs.filter((b) => b > relGate);
      if (!rel.length) return null;
      return -0.691 + 10 * Math.log10(meanEnergy(rel));
    },
  };
}

/** Whole-buffer convenience over the streaming meter. */
export function integratedLoudness(channels: readonly Float32Array[], rate: number = LOUDNESS_RATE): number | null {
  const m = createLoudnessMeter(rate);
  m.push(channels[0] ?? new Float32Array(0), channels[1] ?? channels[0] ?? new Float32Array(0));
  return m.integrated();
}

/**
 * The gain (linear) that moves a measured loudness onto a target, clamped so a
 * mis-measure can never produce a silent or absurd master: +-24 dB.
 */
export function normalizeGain(measuredLkfs: number, targetLkfs: number): number {
  const db = Math.max(-24, Math.min(24, targetLkfs - measuredLkfs));
  return 10 ** (db / 20);
}
