// SPDX-License-Identifier: MPL-2.0
/**
 * Deterministic test signals for the audio DSP module: analytic tones plus the pink-noise,
 * speech-like and gated-stereo programmes that the upstream FilmCraft loudness oracle used,
 * regenerated here in TypeScript (written from the upstream test's description of each
 * signal, not copied code). `scripts/audio-dsp-oracle.ts` measures them with ffmpeg once
 * and stores the numbers in ebur128-reference.json, so ordinary test runs need no ffmpeg.
 */

/** xorshift64 on BigInt: identical on every platform. Uniform in [-1, 1). */
export class Rng {
  private s: bigint;
  constructor(seed: bigint) { this.s = BigInt.asUintN(64, seed); }
  next(): number {
    let x = this.s;
    x ^= BigInt.asUintN(64, x << 13n);
    x ^= x >> 7n;
    x ^= BigInt.asUintN(64, x << 17n);
    this.s = x;
    return Number(x >> 11n) / 2 ** 53 * 2 - 1;
  }
}

export const db = (x: number): number => 10 ** (x / 20);

export function sine(freq: number, amp: number, rate: number, seconds: number, phase = 0): Float32Array {
  const out = new Float32Array(Math.floor(seconds * rate));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin(2 * Math.PI * freq * i / rate + phase);
  return out;
}

/** Pink noise from Paul Kellet's refined filter on white noise. */
export function pink(rate: number, seconds: number, amp: number, seed: bigint): Float32Array {
  const r = new Rng(seed);
  const out = new Float32Array(Math.floor(seconds * rate));
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < out.length; i++) {
    const w = r.next();
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11 * amp;
    b6 = w * 0.115926;
  }
  return out;
}

/** Syllable bursts of a pitched, formant-shaped signal with pauses and phrase-level changes. */
export function speech(rate: number, seconds: number, seed: bigint): Float32Array {
  const r = new Rng(seed);
  const n = Math.floor(seconds * rate);
  const out = new Float32Array(n);
  let pos = 0, phraseGain = 1;
  while (pos < n) {
    if (r.next() > 0.7) phraseGain = db(-12 * (r.next() + 1) / 2);
    const syl = Math.floor((0.08 + 0.22 * (r.next() + 1) / 2) * rate);
    const f0 = 110 + 60 * (r.next() + 1) / 2;
    const f1 = 500 + 400 * r.next(), f2 = 1500 + 700 * r.next();
    for (let i = 0; i < Math.min(syl, n - pos); i++) {
      const t = i / rate;
      const env = Math.sin(Math.PI * i / syl) ** 2;
      let v = 0;
      for (let h = 1; h <= 20; h++) {
        const f = f0 * h;
        if (f > rate / 2.2) break;
        const formant = Math.exp(-(((f - f1) / 200) ** 2)) + 0.5 * Math.exp(-(((f - f2) / 300) ** 2)) + 0.05;
        v += formant * Math.sin(2 * Math.PI * f * t) / h;
      }
      out[pos + i] = 0.3 * phraseGain * env * v + 0.003 * r.next();
    }
    pos += syl;
    pos += Math.floor((0.05 + 0.55 * (r.next() + 1) / 2) * rate);
  }
  return out;
}

export function concat(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

export interface Programme { name: string; rate: number; channels: Float32Array[]; analyticTruePeakDb?: number }

/** The programmes the reference file covers. */
export function programmes(): Programme[] {
  const rate = 48_000;
  const sp = speech(rate, 25, 7n);
  const s997 = sine(997, db(-20), rate, 10);
  const gatedL = concat([
    sine(440, db(-18), rate, 5), new Float32Array(3 * rate), sine(1000, db(-30), rate, 5),
    pink(rate, 4, db(-50), 3n), pink(rate, 4, db(-80), 4n),
  ]);
  const gatedR = concat([
    sine(440, db(-18), rate, 5, 0.3), new Float32Array(3 * rate), new Float32Array(5 * rate),
    pink(rate, 4, db(-50), 5n), pink(rate, 4, db(-80), 6n),
  ]);
  const fs4 = sine(rate / 4, 0.9, rate, 5, Math.PI / 4);
  return [
    { name: 'sine_997', rate, channels: [s997, s997], analyticTruePeakDb: -20 },
    { name: 'pink_noise', rate, channels: [pink(rate, 15, 0.5, 1n), pink(rate, 15, 0.5, 2n)] },
    { name: 'speech_like', rate, channels: [sp, sp.map(v => v * 0.7)] },
    { name: 'gated_stereo', rate, channels: [gatedL, gatedR] },
    { name: 'intersample_peak', rate, channels: [fs4, fs4], analyticTruePeakDb: 20 * Math.log10(0.9) },
    { name: 'speech_mono_44k', rate: 44_100, channels: [speech(44_100, 20, 11n)] },
  ];
}
