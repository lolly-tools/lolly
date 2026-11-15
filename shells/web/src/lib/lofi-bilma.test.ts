// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bilma } from './lofi-bilma.ts';

const SR = 44100;
/** The level (dB) of a frequency between two times (a Hann-windowed DFT bin). */
function level(x: Float32Array, hz: number, a: number, b: number): number {
  const w = (2 * Math.PI * hz) / SR, i0 = Math.floor(a * SR), i1 = Math.floor(b * SR);
  let re = 0, im = 0;
  for (let i = i0; i < i1; i++) { const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i - i0)) / (i1 - i0)); re += x[i]! * h * Math.cos(w * i); im += x[i]! * h * Math.sin(w * i); }
  return 10 * Math.log10(re * re + im * im + 1e-30);
}
const rms = (x: Float32Array, a: number, b: number): number => { let s = 0; for (let i = Math.floor(a * SR); i < Math.floor(b * SR); i++) s += x[i]! ** 2; return 10 * Math.log10(s / ((b - a) * SR) + 1e-30); };

test('a bilma hit is a bright, dry, pitched click with a short ring, as recorded hardwood sticks are', () => {
  const f = 2500;
  const x = bilma(SR, f, 0.8, 7);
  assert.ok(x.every(Number.isFinite));
  // The stick's pitch rings over its neighbours (recorded claves: one clear pitch, the next peaks 12 to 20 dB down).
  assert.ok(level(x, f, 0, 0.1) > level(x, f * 0.8, 0, 0.1) + 12, 'pitched');
  // The ring falls about 20 dB in 30 ms and 40 dB in about 200 ms (claves: 34 and 210 ms).
  const peak = rms(x, 0, 0.004);
  assert.ok(peak - rms(x, 0.03, 0.036) > 14 && peak - rms(x, 0.03, 0.036) < 30, `20 dB down near 30 ms: ${(peak - rms(x, 0.03, 0.036)).toFixed(1)}`);
  assert.ok(peak - rms(x, 0.2, 0.21) > 34, `about 40 dB down by 200 ms: ${(peak - rms(x, 0.2, 0.21)).toFixed(1)}`);
});

test('a harder hit is louder and brighter, and the same seed strikes the same bytes', () => {
  const soft = bilma(SR, 2600, 0.3, 4), hard = bilma(SR, 2600, 0.95, 4);
  assert.ok(rms(hard, 0, 0.02) > rms(soft, 0, 0.02) + 4);
  assert.ok(level(hard, 2600 * 2.756, 0, 0.03) - level(hard, 2600, 0, 0.03) > level(soft, 2600 * 2.756, 0, 0.03) - level(soft, 2600, 0, 0.03));
  assert.deepEqual(bilma(SR, 2400, 0.7, 11), bilma(SR, 2400, 0.7, 11));
});
