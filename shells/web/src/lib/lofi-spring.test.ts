// SPDX-License-Identifier: MPL-2.0
/**
 * The spring tank (lib/lofi-spring.ts) against the recorded tanks it was fitted to: its echoes
 * where the measured two-spring tank's came, each echo a chirp whose top arrives later than
 * its low end as the recorded tank's did, its decay and its tone.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/lofi-spring.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fftInPlace } from '../../../../engine/src/audio-analyse.ts';
import { LONG_TANK, passDelay, springImpulse, tableAt, type SpringTank } from './lofi-spring.ts';

const SR = 16000;
/** The measured tank's decay, for the medium tank the long one is fitted against. */
const MEDIUM: SpringTank = { ...LONG_TANK, t60: LONG_TANK.t60.map(([hz, s]) => [hz, s / 1.42] as const) };
const ir = springImpulse(SR, MEDIUM, 1);

/** The spectrum of `x` (zero-padded to a power of two): re, im and the bin width. */
function spectrum(x: Float32Array): { re: Float64Array; im: Float64Array; df: number } {
  let n = 1;
  while (n < x.length) n <<= 1;
  const re = new Float64Array(n), im = new Float64Array(n);
  re.set(x);
  fftInPlace(re, im);
  return { re, im, df: SR / n };
}
/** `x` through a smooth band (a raised cosine over `octaves` either side of `hz`, in log frequency). */
function band(x: Float32Array, hz: number, octaves: number): Float64Array {
  const { re, im, df } = spectrum(x);
  const n = re.length;
  for (let k = 0; k < n; k++) {
    const f = (k <= n / 2 ? k : n - k) * df;
    const u = Math.log2(Math.max(f, 1) / hz) / octaves;
    const w = Math.abs(u) < 1 ? 0.5 + 0.5 * Math.cos(Math.PI * u) : 0;
    re[k] = re[k]! * w; im[k] = -im[k]! * w;
  }
  fftInPlace(re, im);
  return re.map(v => v / n).subarray(0, x.length);
}
/** The time (s) of the most energy in `x` between `a` and `b` seconds, over 2 ms windows. */
function peakAt(x: Float64Array, a: number, b: number): number {
  const hop = Math.round(0.002 * SR);
  let best = a, most = -1;
  for (let i = Math.round(a * SR); i + hop <= Math.round(b * SR); i += hop / 2) {
    let e = 0;
    for (let j = i; j < i + hop; j++) e += x[j]! * x[j]!;
    if (e > most) { most = e; best = (i + hop / 2) / SR; }
  }
  return best;
}
/** T60 (s) from the backward-integrated energy's slope between `a` and `b` seconds. */
function t60(x: Float64Array, a: number, b: number): number {
  const edc = new Float64Array(x.length);
  let acc = 0;
  for (let i = x.length - 1; i >= 0; i--) { acc += x[i]! * x[i]!; edc[i] = acc; }
  let sx = 0, sy = 0, sxx = 0, sxy = 0, n = 0;
  for (let i = Math.round(a * SR); i < Math.round(b * SR); i += 8) {
    const t = i / SR, y = 10 * Math.log10(edc[i]! / edc[0]!);
    sx += t; sy += y; sxx += t * t; sxy += t * y; n++;
  }
  return -60 / ((n * sxy - sx * sy) / (n * sxx - sx * sx));
}

test('each spring echoes at its own round trip, as the measured tank did: every 58.5 and 76.7 ms', () => {
  const low = band(ir, 350, 1);
  assert.ok(Math.abs(peakAt(low, 0.045, 0.068) - 0.0585) < 0.003, `the first spring at ${peakAt(low, 0.045, 0.068)}`);
  assert.ok(Math.abs(peakAt(low, 0.068, 0.09) - 0.0767) < 0.003, `the second at ${peakAt(low, 0.068, 0.09)}`);
  assert.ok(Math.abs(peakAt(low, 0.105, 0.13) - 0.117) < 0.004, 'the first spring again, a round trip on');
});

test('an echo is a chirp: its top arrives after its low end, as the recorded tank\'s did', () => {
  // The recorded RE-301's chirp against 1 kHz (ms): +2.2 at 2 kHz, +6.9 at 3, +11.3 at 3.5, +21.8 at 4.4, fitted with a 23.8 ms dispersion.
  for (const [hz, ms] of [[2000, 2.2], [3000, 6.9], [3500, 11.3], [4400, 21.8]] as const) {
    const fit = (passDelay(hz, LONG_TANK.fc, LONG_TANK.shape, 0.0238) - passDelay(1000, LONG_TANK.fc, LONG_TANK.shape, 0.0238)) * 1000;
    assert.ok(Math.abs(fit - ms) < 2, `${hz} Hz: ${fit.toFixed(1)} ms against ${ms}`);
  }
  // In the model's own echo: the 3 kHz band arrives several milliseconds after the 1 kHz band.
  const late = peakAt(band(ir, 3000, 0.25), 0.05, 0.085) - peakAt(band(ir, 1000, 0.25), 0.05, 0.085);
  assert.ok(late > 0.002 && late < 0.012, `3 kHz ${(late * 1000).toFixed(1)} ms after 1 kHz`);
});

test('the tank decays as the measured one did, slower in the lows than at the top', () => {
  // The measured tank (backward-integrated, octave bands, 0.15 to 1 s): 2.32 s at 250 Hz, 2.17 at 1 kHz, 1.88 at 4 kHz.
  for (const [hz, s] of [[250, 2.32], [1000, 2.17], [2000, 2.09]] as const) {
    const got = t60(band(ir, hz, 1), 0.15, 1);
    assert.ok(Math.abs(got - s) < 0.25, `${hz} Hz: ${got.toFixed(2)} s against ${s}`);
  }
  assert.ok(t60(band(ir, 4000, 1), 0.15, 1) < t60(band(ir, 250, 1), 0.15, 1), 'the top dies first');
  const long = springImpulse(SR, LONG_TANK, 1);
  assert.ok(t60(band(long, 1000, 1), 0.15, 1) > 2.9, 'the long tank rings a third longer');
});

test('the tank\'s tone: strong in the lows, falling away above 2 kHz, as measured', () => {
  const { re, im, df } = spectrum(ir);
  const third = (hz: number): number => {
    let e = 0, n = 0;
    for (let k = Math.ceil(hz / 2 ** (1 / 6) / df); k * df < hz * 2 ** (1 / 6); k++, n++) e += re[k]! ** 2 + im[k]! ** 2;
    return 10 * Math.log10(e / n);
  };
  const ref = third(1000);
  for (const hz of [125, 250, 500, 2000, 3150, 4000]) {
    const want = tableAt(LONG_TANK.response, hz);
    assert.ok(Math.abs(third(hz) - ref - want) < 3, `${hz} Hz: ${(third(hz) - ref).toFixed(1)} dB against ${want}`);
  }
});

test('the impulse is the same for the same seed, finite, and of unit energy', () => {
  const again = springImpulse(SR, MEDIUM, 1);
  assert.deepEqual(again, ir);
  let e = 0;
  for (const v of ir) { assert.ok(Number.isFinite(v)); e += v * v; }
  assert.ok(Math.abs(e - 1) < 1e-3, `energy ${e}`);
  assert.notDeepEqual(springImpulse(SR, MEDIUM, 2), ir, 'another seed scatters differently');
});
