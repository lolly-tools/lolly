// SPDX-License-Identifier: MPL-2.0
/**
 * The headless time-stretch primitive (plans/165 WP-7, plans/101 section 5): PCM in,
 * PCM out, through the vendored Signalsmith Stretch WASM. ONE driver serves the
 * export mix, the preview bounce worker AND node:test - the golden PCM tests run
 * the real stretcher, so there is no browser tier for the math and no second
 * implementation to drift.
 *
 * Contract:
 *   - `speed` is the clip's playback rate: 2 halves the duration, 0.5 doubles it.
 *     Pitch is PRESERVED across the change (the NLE expectation) unless a
 *     transpose is asked for on top.
 *   - The output length is EXACTLY round(inputLength / speed) per channel: the
 *     engine's own latency (2880 samples each side at the default preset) is fed
 *     through with silence and trimmed here, so callers place the result like any
 *     other decoded clip.
 *   - Deterministic: a fresh WASM instance per call, and the spike measured
 *     sha256-identical output across re-runs (28.6x realtime including init).
 *
 * The output can overshoot unity even from safe inputs (the spike's 0.5x stretch
 * peaked at 1.004 from 0.99) - which is exactly why the mix's master true-peak
 * limiter (engine audio-dynamics.ts) went in first and always runs.
 */
import factory from '../vendor/signalsmith-stretch/SignalsmithStretch.mjs';

export interface StretchOpts {
  /** Playback rate, 0.25..4 - the clip's own `speed`. */
  speed: number;
  /** Extra transpose in semitones (-12..12), on top of the pitch-preserve. 0 = none. */
  semitones?: number;
  /** Transpose as a raw frequency MULTIPLIER (varispeed: pass the clip's speed so
   *  pitch follows it tape-style). Takes precedence over `semitones`. */
  factor?: number;
  /** Sample rate, Hz. Default 48000. */
  rate?: number;
}

const BLOCK = 4096;

/**
 * Stretch one clip's PCM to `round(length / speed)` samples per channel,
 * preserving pitch (plus an optional transpose).
 */
export async function stretchPcm(channels: readonly Float32Array[], opts: StretchOpts): Promise<Float32Array[]> {
  const speed = Math.min(4, Math.max(0.25, opts.speed));
  const rate = opts.rate && opts.rate > 0 ? opts.rate : 48_000;
  const ch = Math.max(1, channels.length);
  const total = channels[0]?.length ?? 0;
  const expected = Math.round(total / speed);
  if (!total || (speed === 1 && !(opts.semitones ?? 0) && !(opts.factor && opts.factor !== 1))) {
    return channels.map((c) => Float32Array.from(c));
  }

  const m = await factory();
  m._main();
  m._presetDefault(ch, rate);
  const inLat = m._inputLatency();
  const outLat = m._outputLatency();
  // The tonality limit Signalsmith's own worklet wrapper uses: 8 kHz scaled to rate.
  const tonality = 8000 / rate;
  if (opts.factor && opts.factor !== 1) {
    // Varispeed: pitch as a raw multiplier (the clip's speed), formants riding
    // along - the tape sound is the point when preserve-pitch is switched off.
    m._setTransposeFactor(opts.factor, tonality);
  } else {
    m._setTransposeSemitones(opts.semitones ?? 0, tonality);
    // Formant preservation on an explicit transpose (plans/165 WP-7b): hold the
    // formants at their recorded place while the pitch moves - the engine's own
    // compensation flag, the same pair the upstream worklet wrapper passes.
    if (opts.semitones) m._setFormantSemitones(0, 1);
  }

  const bufLen = Math.max(Math.ceil(BLOCK * Math.max(1, speed)) + 16, inLat + outLat, BLOCK + 16);
  const ptr = m._setBuffers(ch, bufLen);
  const bytesPerCh = bufLen * 4;
  const heap = (): ArrayBufferLike => m.HEAP8.buffer;

  const out: Float32Array[][] = Array.from({ length: ch }, () => []);
  const pull = (outN: number): void => {
    for (let c = 0; c < ch; c++) {
      const view = new Float32Array(heap(), ptr + bytesPerCh * (ch + c), outN);
      out[c]!.push(new Float32Array(view));   // copy out of the heap before it moves
    }
  };

  let read = 0;
  while (read < total) {
    const inN = Math.min(Math.round(BLOCK * speed) || 1, total - read);
    const outN = Math.max(1, Math.round(inN / speed));
    for (let c = 0; c < ch; c++) {
      const view = new Float32Array(heap(), ptr + bytesPerCh * c, inN);
      view.set((channels[Math.min(c, channels.length - 1)] as Float32Array).subarray(read, read + inN));
    }
    m._process(inN, outN);
    pull(outN);
    read += inN;
  }
  // Feed the engine's input latency through as silence, then flush: that is what
  // pushes the real tail out of the pipeline.
  let silence = inLat;
  while (silence > 0) {
    const inN = Math.min(BLOCK, silence);
    const outN = Math.max(1, Math.round(inN / speed));
    for (let c = 0; c < ch; c++) new Float32Array(heap(), ptr + bytesPerCh * c, inN).fill(0);
    m._process(inN, outN);
    pull(outN);
    silence -= inN;
  }
  const flushN = Math.min(bufLen, Math.max(1, Math.round(outLat / speed) + BLOCK));
  m._flush(flushN);
  pull(flushN);

  // Trim the engine's output latency from the head and cut to the exact contract
  // length, zero-padding the (rare, sub-block) shortfall.
  return out.map((chunks) => {
    const n = chunks.reduce((a, b) => a + b.length, 0);
    const flat = new Float32Array(n);
    let o = 0;
    for (const part of chunks) { flat.set(part, o); o += part.length; }
    const trimmed = flat.subarray(Math.min(outLat, n), Math.min(outLat + expected, n));
    if (trimmed.length === expected) return Float32Array.from(trimmed);
    const exact = new Float32Array(expected);
    exact.set(trimmed, 0);
    return exact;
  });
}
