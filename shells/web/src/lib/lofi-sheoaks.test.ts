// SPDX-License-Identifier: MPL-2.0
/**
 * The breeze in the she-oaks (lib/lofi-sheoaks.ts), checked by the traits it was fitted to
 * (the recordings' numbers are in docs/generated-music.md).
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/lofi-sheoaks.test.ts
 *
 * What is pinned: the same bytes for the same seed; a soft band centred in the high hundreds
 * of hertz; the band singing higher as a gust gets louder; a breeze that comes and goes a few
 * decibels, not a gale; and two ears that hear different trees.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sheOaks } from './lofi-sheoaks.ts';

const SR = 22050;

/** A frame's level and its brightness (a centroid from the first difference's energy against the signal's). */
function frame(x: Float32Array, a: number, b: number): { level: number; hz: number } {
  let e = 0, d = 0;
  for (let i = a + 1; i < b; i++) { e += x[i]! * x[i]!; d += (x[i]! - x[i - 1]!) ** 2; }
  return { level: 10 * Math.log10(e / (b - a) + 1e-20), hz: (Math.asin(Math.min(1, Math.sqrt(d / Math.max(1e-20, e)) / 2)) * SR) / Math.PI };
}

test('the she-oaks sing: a soft band in the high hundreds of hertz, higher in a gust, a breeze that comes and goes', () => {
  const [l, r] = sheOaks(SR, 40, 9);
  assert.deepEqual(sheOaks(SR, 3, 9)[0].slice(0, 4000), sheOaks(SR, 3, 9)[0].slice(0, 4000));
  assert.ok(l.every(Number.isFinite) && r.every(Number.isFinite));
  const w = SR / 2;
  const frames = Array.from({ length: Math.floor(l.length / w) - 2 }, (_, k) => frame(l, (k + 2) * w, (k + 3) * w));
  const hz = frames.map(f => f.hz).sort((a, b) => a - b);
  const median = hz[hz.length >> 1]!;
  assert.ok(median > 450 && median < 1100, `centred about ${median.toFixed(0)} Hz`);
  const lv = frames.map(f => f.level), mean = (xs: number[]): number => xs.reduce((s, v) => s + v, 0) / xs.length;
  const ml = mean(lv), mh = mean(frames.map(f => f.hz));
  const cov = mean(frames.map(f => (f.level - ml) * (f.hz - mh)));
  assert.ok(cov > 0, 'a louder gust sings higher');
  const sorted = [...lv].sort((a, b) => a - b);
  const spread = sorted[Math.floor(sorted.length * 0.9)]! - sorted[Math.floor(sorted.length * 0.1)]!;
  assert.ok(spread > 2 && spread < 14, `comes and goes ${spread.toFixed(1)} dB`);
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < l.length; i++) { ab += l[i]! * r[i]!; aa += l[i]! * l[i]!; bb += r[i]! * r[i]!; }
  assert.ok(ab / Math.sqrt(aa * bb) < 0.7, 'two ears, different trees');
});
