// SPDX-License-Identifier: MPL-2.0
/**
 * The sea on a sandy shore (lib/lofi-waves.ts): the wave model and the shore's roar, checked
 * by the traits it was fitted to (the recordings' numbers are in docs/generated-music.md).
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/lofi-waves.test.ts
 *
 * What is pinned:
 *  - a wave is the same bytes for the same seed, finite, and its loudest moment is the break,
 *    WAVE_SWELL[size] seconds in, after a swell that rises out of near silence;
 *  - each wave is its own: two takes differ, and the channels are far from alike up close;
 *  - a wave further off is quieter, duller and more alike in both ears;
 *  - the foam fades: a few seconds after the break the wave is well down from its peak;
 *  - the shore's roar is steady (a few decibels of breathing) and dark (most of it under 2 kHz).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shoreBed, waveBreak, waveSeconds } from './lofi-waves.ts';
import { WAVE_SWELL } from '../../../../engine/src/lofi-waves-notes.ts';

const SR = 22050;
const rms = (x: Float32Array, a = 0, b = x.length): number => { let s = 0; for (let i = a; i < b; i++) s += x[i]! * x[i]!; return Math.sqrt(s / Math.max(1, b - a)); };
const db = (v: number): number => 20 * Math.log10(Math.max(1e-9, v));
const peakOf = (...xs: Float32Array[]): number => { let p = 0; for (const x of xs) for (const v of x) p = Math.max(p, Math.abs(v)); return p; };
const most = (xs: readonly number[]): number => xs.reduce((m, v) => Math.max(m, v), -Infinity);
/** The level of 0.25 s windows through a channel. */
function windows(x: Float32Array, w = Math.round(0.25 * SR)): number[] {
  const out: number[] = [];
  for (let i = 0; i + w <= x.length; i += w) out.push(rms(x, i, i + w));
  return out;
}
/** A spectral centroid by zero crossings' cheaper cousin: the ratio of the first difference's energy to the signal's, as a frequency. */
function brightness(x: Float32Array): number {
  let d = 0, e = 0;
  for (let i = 1; i < x.length; i++) { d += (x[i]! - x[i - 1]!) ** 2; e += x[i]! * x[i]!; }
  return (Math.asin(Math.min(1, Math.sqrt(d / Math.max(1e-12, e)) / 2)) * SR) / Math.PI;
}
function corr(a: Float32Array, b: Float32Array): number {
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { ab += a[i]! * b[i]!; aa += a[i]! * a[i]!; bb += b[i]! * b[i]!; }
  return ab / Math.sqrt(aa * bb);
}

test('a wave: the same bytes for the same seed, its swell rising out of quiet, its loudest moment the break', () => {
  assert.deepEqual(waveBreak(SR, 2, 1, 42), waveBreak(SR, 2, 1, 42));
  for (const size of [0, 1, 2, 3]) {
    const [l, r] = waveBreak(SR, size, 1, 100 + size);
    assert.equal(l.length, Math.ceil(waveSeconds(size) * SR));
    assert.ok(l.every(Number.isFinite) && r.every(Number.isFinite), `size ${size}: finite`);
    const rw = windows(r);
    const lv = windows(l).map((v, i) => v + rw[i]!);
    const peakAt = lv.indexOf(most(lv)) * 0.25;
    assert.ok(peakAt >= WAVE_SWELL[size]! - 0.5 && peakAt <= WAVE_SWELL[size]! + 1, `size ${size}: breaks at ${peakAt} s (WAVE_SWELL ${WAVE_SWELL[size]})`);
    assert.ok(db(lv[0]!) < db(most(lv)) - 15, `size ${size}: the swell starts quiet`);
    const peak = peakOf(l, r);
    assert.ok(peak > 0.05 && peak < 0.9, `size ${size}: peak ${peak.toFixed(3)}`);
    // Three seconds after the break the foam has thinned well below the crash.
    const after = Math.round((WAVE_SWELL[size]! + 3) * SR);
    assert.ok(db(rms(l, after, after + SR / 4)) < db(most(windows(l))) - 6, `size ${size}: the foam fades`);
  }
});

test('each wave is its own, wide up close, and duller, quieter and narrower further off', () => {
  const [a] = waveBreak(SR, 2, 1, 1), [b] = waveBreak(SR, 2, 1, 2);
  assert.notDeepEqual(a.slice(SR * 2, SR * 3), b.slice(SR * 2, SR * 3), 'two takes differ');
  const [nl, nr] = waveBreak(SR, 2, 0, 7), [fl, fr] = waveBreak(SR, 2, 3, 7);
  assert.ok(corr(nl, nr) < 0.85, `up close the ears differ (${corr(nl, nr).toFixed(2)})`);
  assert.ok(corr(fl, fr) > corr(nl, nr), `further off they are more alike (${corr(fl, fr).toFixed(2)} against ${corr(nl, nr).toFixed(2)})`);
  assert.ok(db(rms(fl) + rms(fr)) < db(rms(nl) + rms(nr)) - 6, 'further off is quieter');
  assert.ok(brightness(fl) < brightness(nl) * 0.85, `further off is duller (${brightness(fl).toFixed(0)} against ${brightness(nl).toFixed(0)} Hz)`);
});

test('the shore: a steady roar, breathing a few decibels, most of it under 2 kHz', () => {
  const [l, r] = shoreBed(SR, 30, 5);
  assert.deepEqual(shoreBed(SR, 4, 5)[0].slice(0, 2000), shoreBed(SR, 4, 5)[0].slice(0, 2000));
  const lv = windows(l, SR).slice(2).map(db).sort((x, y) => x - y);
  const spread = lv[Math.floor(lv.length * 0.9)]! - lv[Math.floor(lv.length * 0.1)]!;
  assert.ok(spread > 1 && spread < 8, `breathing ${spread.toFixed(1)} dB`);
  assert.ok(brightness(l) < 2000 && brightness(l) > 300, `dark: about ${brightness(l).toFixed(0)} Hz`);
  const c = corr(l, r);
  assert.ok(c > 0.1 && c < 0.7, `two ears, partly alike (${c.toFixed(2)})`);
});
