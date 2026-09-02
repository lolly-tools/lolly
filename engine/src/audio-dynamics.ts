// SPDX-License-Identifier: MPL-2.0
/**
 * audio-dynamics.ts - the master true-peak limiter (plans/165 Slice E, plans/101
 * section 2.5).
 *
 * Pure, deterministic, streaming DSP - NEVER a DynamicsCompressorNode: the Web Audio
 * spec leaves that node's detector adaptive behaviour implementation-defined, and a
 * mix must render byte-identically on every machine. This module is the gate WP-7
 * (time-stretch) waits on: the spike measured a 0.5x phase-vocoder stretch of a
 * 0.99-peak input peaking at 1.004, so the sum feeding the encoder needs an
 * always-on ceiling, not caution.
 *
 * What it does, per sample:
 *
 *   1. TRUE-PEAK detection: each channel is 4x oversampled through a 48-tap
 *      Kaiser-windowed sinc interpolator (4 phases x 12 taps), and the detector
 *      takes the largest magnitude across both channels' phases. A sine parked
 *      between samples carries an inter-sample peak up to ~3 dB above its sample
 *      peak; sample-peak limiting alone would let the DAC clip it.
 *   2. LOOKAHEAD gain: the required gain (ceiling / truePeak, capped at 1) runs
 *      through a sliding-window minimum over the lookahead, so the gain is already
 *      down when the peak ARRIVES - anticipatory, never a click. Release is a
 *      one-pole exponential back toward unity, always bounded by the window
 *      minimum, so the output cannot exceed the ceiling on any peak the
 *      interpolator resolves.
 *   3. The signal is delayed internally by the same lookahead and multiplied, but
 *      the STREAM stays time-aligned: output sample i is input sample i, decided
 *      with knowledge of samples i..i+look - no added latency at the seam. While
 *      the window minimum is 1 the samples are COPIED, not multiplied - content
 *      that never approaches the ceiling comes out byte-identical, which is what
 *      keeps every existing mix, golden hash and RMS measurement unchanged.
 *
 * Streaming contract: `process()` consumes any chunk length and returns whatever
 * is emittable so far (the first calls run a lookahead's worth short); `flush()`
 * returns the tail, so total out equals total in. All state is a pure function of
 * the sample stream consumed, so ANY chunking of the same stream concatenates to
 * the identical output - the property that keeps the 0.1 s windowed feeder and
 * the worker's whole-range call byte-identical (the worker-SHA golden).
 */

/** 4x oversampling for true-peak detection (BS.1770-4's own factor at 48 kHz). */
const TP_OVERSAMPLE = 4;
/** Taps per polyphase branch; total FIR length = TP_PHASE_TAPS * TP_OVERSAMPLE. */
const TP_PHASE_TAPS = 12;

/** Modified Bessel function of the first kind, order zero (for the Kaiser window). */
function besselI0(x: number): number {
  let sum = 1;
  let term = 1;
  for (let k = 1; k < 32; k++) {
    term *= (x / (2 * k)) * (x / (2 * k));
    sum += term;
    if (term < 1e-12 * sum) break;
  }
  return sum;
}

/**
 * The interpolator's polyphase branches: a 48-tap Kaiser(beta 8) windowed sinc,
 * cutoff at the input Nyquist, split into 4 phases of 12 taps. GENERATED, not
 * transcribed - a hand-copied coefficient table is the kind of silent wrongness
 * no test would localise.
 */
function tpPhases(): Float64Array[] {
  const N = TP_PHASE_TAPS * TP_OVERSAMPLE;
  const beta = 8;
  const denom = besselI0(beta);
  const centre = (N - 1) / 2;
  const h = new Float64Array(N);
  for (let n = 0; n < N; n++) {
    const x = (n - centre) / TP_OVERSAMPLE;
    const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
    const w = besselI0(beta * Math.sqrt(Math.max(0, 1 - ((n - centre) / centre) ** 2))) / denom;
    h[n] = sinc * w;
  }
  const phases: Float64Array[] = [];
  for (let p = 0; p < TP_OVERSAMPLE; p++) {
    const taps = new Float64Array(TP_PHASE_TAPS);
    for (let k = 0; k < TP_PHASE_TAPS; k++) taps[k] = h[k * TP_OVERSAMPLE + p]!;
    phases.push(taps);
  }
  return phases;
}

const PHASES = tpPhases();

export interface TruePeakLimiterOpts {
  /** Sample rate, Hz. Default 48000. */
  rate?: number;
  /** Output ceiling in dBTP. Default -1. */
  ceilingDb?: number;
  /** Lookahead, ms. Default 2.5 (floored at the interpolator's own group delay). */
  lookaheadMs?: number;
  /** Release toward unity, ms (one-pole time constant). Default 60. */
  releaseMs?: number;
}

export interface TruePeakLimiter {
  /** Consume one stereo chunk; returns the samples emittable so far (possibly empty). */
  process(left: Float32Array, right: Float32Array): [Float32Array, Float32Array];
  /** Emit the buffered tail. After it, total emitted equals total consumed. */
  flush(): [Float32Array, Float32Array];
  /** True once any sample actually had its gain reduced. */
  engaged(): boolean;
}

/**
 * A streaming -1 dBTP (by default) lookahead limiter. One instance per render;
 * feed the mix in order, concatenate what comes back.
 */
export function createTruePeakLimiter(opts: TruePeakLimiterOpts = {}): TruePeakLimiter {
  const rate = opts.rate && opts.rate > 0 ? opts.rate : 48_000;
  const ceiling = 10 ** ((opts.ceilingDb ?? -1) / 20);
  // The interpolator's estimate is centred half its support behind the newest
  // sample; the lookahead must cover that plus a real anticipation window.
  const look = Math.max(TP_PHASE_TAPS / 2 + 1, Math.round(((opts.lookaheadMs ?? 2.5) / 1000) * rate));
  const relCoef = Math.exp(-1 / (((opts.releaseMs ?? 60) / 1000) * rate));

  const cap = look + 2;
  const delayL = new Float32Array(cap);
  const delayR = new Float32Array(cap);
  const req = new Float32Array(cap);
  // Sliding-window minimum over req[i .. i+look]: a monotonic deque of absolute
  // stream indices whose req values strictly increase front to back.
  const dqCap = cap + 1;
  const deque = new Float64Array(dqCap);
  let dqHead = 0;
  let dqTail = 0;
  // FIR history: the last TP_PHASE_TAPS input samples per channel, ring-indexed.
  const histL = new Float32Array(TP_PHASE_TAPS);
  const histR = new Float32Array(TP_PHASE_TAPS);
  let written = 0;
  let emitted = 0;
  let gain = 1;
  let didEngage = false;

  /** True-peak magnitude around the newest consumed sample. */
  function truePeakOfNewest(): number {
    let peak = 0;
    for (let p = 0; p < TP_OVERSAMPLE; p++) {
      const taps = PHASES[p]!;
      let accL = 0;
      let accR = 0;
      for (let k = 0; k < TP_PHASE_TAPS; k++) {
        const h = (((written - 1 - k) % TP_PHASE_TAPS) + TP_PHASE_TAPS) % TP_PHASE_TAPS;
        accL += taps[k]! * histL[h]!;
        accR += taps[k]! * histR[h]!;
      }
      const m = Math.max(Math.abs(accL), Math.abs(accR));
      if (m > peak) peak = m;
    }
    return peak;
  }

  /** Consume one input sample; emit into out[oi] when the lookahead is full. */
  function consume(l: number, r: number, outL: Float32Array, outR: Float32Array, oi: number): number {
    const i = written;
    delayL[i % cap] = l;
    delayR[i % cap] = r;
    histL[i % TP_PHASE_TAPS] = l;
    histR[i % TP_PHASE_TAPS] = r;
    written++;
    // The required gain at the instant this write resolves. The raw sample peak folds in too,
    // so a one-sample spike narrower than the interpolator's support still counts.
    const tp = Math.max(truePeakOfNewest(), Math.abs(l), Math.abs(r));
    req[i % cap] = tp > ceiling ? ceiling / tp : 1;
    while (dqHead < dqTail && deque[dqHead % dqCap]! < i - look) dqHead++;
    while (dqHead < dqTail && req[deque[(dqTail - 1) % dqCap]! % cap]! >= req[i % cap]!) dqTail--;
    deque[dqTail % dqCap] = i;
    dqTail++;
    if (written <= look) return oi;
    const winMin = req[deque[dqHead % dqCap]! % cap]!;
    gain = Math.min(winMin, 1 - (1 - gain) * relCoef);
    const j = emitted % cap;
    if (gain < 1) {
      didEngage = true;
      outL[oi] = delayL[j]! * gain;
      outR[oi] = delayR[j]! * gain;
    } else {
      outL[oi] = delayL[j]!;
      outR[oi] = delayR[j]!;
    }
    emitted++;
    return oi + 1;
  }

  return {
    process(left: Float32Array, right: Float32Array): [Float32Array, Float32Array] {
      const n = left.length;
      const emittable = Math.max(0, written + n - look) - emitted;
      const outL = new Float32Array(emittable);
      const outR = new Float32Array(emittable);
      let oi = 0;
      for (let i = 0; i < n; i++) oi = consume(left[i]!, right[i] ?? left[i]!, outL, outR, oi);
      return [outL, outR];
    },
    flush(): [Float32Array, Float32Array] {
      // Push a lookahead of silence through so a peak at the very end still limits,
      // then hand back exactly the real remainder.
      const remain = written - emitted;
      const outL = new Float32Array(remain);
      const outR = new Float32Array(remain);
      let oi = 0;
      for (let i = 0; i < look && oi < remain; i++) oi = consume(0, 0, outL, outR, oi);
      emitted = written;   // the silence padding never comes back out
      return [outL, outR];
    },
    engaged(): boolean { return didEngage; },
  };
}

// ── signal activity detection (plans/165 WP-6 v2, plans/101) ────────────────────

export interface ActivitySpanOpts {
  /** Sample rate, Hz. Default 48000. */
  rate?: number;
  /** RMS level that OPENS a span, dBFS. Default -45. */
  openDb?: number;
  /** RMS level that CLOSES one, dBFS - lower than openDb, the hysteresis. Default -51. */
  closeDb?: number;
  /** Analysis block, ms. Default 50. */
  blockMs?: number;
  /** Spans shorter than this are dropped, ms. Default 150. */
  minSpanMs?: number;
  /** Gaps shorter than this merge their neighbours, ms. Default 300. */
  minGapMs?: number;
}

/**
 * Where a clip actually MAKES SOUND (plans/165 WP-6 v2): block-RMS gating with
 * hysteresis over decoded PCM, in seconds from the clip's own start. This is what
 * upgrades clip-presence ducking to signal-derived ducking - a voiceover clip with
 * two sentences and a long pause ducks the bed twice, not once across the whole
 * window. Pure and deterministic: the same PCM yields the same spans everywhere.
 *
 * The gate opens at `openDb` and closes at `closeDb` (lower), so a syllable's dip
 * does not flap the gate; gaps shorter than `minGapMs` merge, spans shorter than
 * `minSpanMs` drop - the same smoothing the duck envelope would otherwise fight.
 */
export function activitySpans(channels: readonly Float32Array[], opts: ActivitySpanOpts = {}): { from: number; to: number }[] {
  const rate = opts.rate && opts.rate > 0 ? opts.rate : 48_000;
  const block = Math.max(1, Math.round(((opts.blockMs ?? 50) / 1000) * rate));
  const open = 10 ** ((opts.openDb ?? -45) / 20);
  const close = 10 ** ((opts.closeDb ?? -51) / 20);
  const minSpan = (opts.minSpanMs ?? 150) / 1000;
  const minGap = (opts.minGapMs ?? 300) / 1000;
  const n = channels[0]?.length ?? 0;
  if (!n) return [];

  const raw: { from: number; to: number }[] = [];
  let openAt = -1;
  const blocks = Math.ceil(n / block);
  for (let b = 0; b < blocks; b++) {
    const s = b * block;
    const e = Math.min(s + block, n);
    let sum = 0;
    for (const ch of channels) {
      for (let i = s; i < e; i++) sum += (ch[i] as number) * (ch[i] as number);
    }
    const rms = Math.sqrt(sum / ((e - s) * channels.length));
    const t = s / rate;
    if (openAt < 0) {
      if (rms >= open) openAt = t;
    } else if (rms < close) {
      raw.push({ from: openAt, to: t });
      openAt = -1;
    }
  }
  if (openAt >= 0) raw.push({ from: openAt, to: n / rate });

  // Merge near-misses, then drop the too-short - in that order, so two syllables
  // either side of a small gap survive as one span rather than dying separately.
  const merged: { from: number; to: number }[] = [];
  for (const s of raw) {
    const last = merged[merged.length - 1];
    if (last && s.from - last.to < minGap) last.to = s.to;
    else merged.push({ ...s });
  }
  return merged.filter((s) => s.to - s.from >= minSpan);
}
