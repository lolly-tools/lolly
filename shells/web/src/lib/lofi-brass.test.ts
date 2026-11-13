// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blowLips, pressure, type Horn, type LipNote } from './lofi-brass.ts';

const SR = 44100;
const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
function seeded(a: number): () => number {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const note = (horn: Horn, midi: number, vel: number, more: Partial<LipNote> = {}): LipNote => ({ sr: SR, f: mtof(midi), vel, dur: 0.8, seconds: 0.95, horn, scoop: 0, fall: 0, vibrato: 0, rate: 5, ...more });
/** A harmonic's level (dB) between `a` and `b` seconds. */
function harmonic(x: Float32Array, f: number, h: number, a = 0.3, b = 0.7): number {
  const w = (2 * Math.PI * f * h) / SR;
  let re = 0, im = 0;
  for (let i = Math.floor(a * SR); i < Math.floor(b * SR); i++) { re += x[i]! * Math.cos(w * i); im += x[i]! * Math.sin(w * i); }
  return 10 * Math.log10(re * re + im * im + 1e-20);
}
/** The fundamental's pitch in cents from `f`, by a fine search over the held part. */
function cents(x: Float32Array, f: number): number {
  let best = -Infinity, at = 0;
  for (let c = -40; c <= 40; c += 0.5) { const p = harmonic(x, f * 2 ** (c / 1200), 1); if (p > best) { best = p; at = c; } }
  return at;
}
function rms(x: Float32Array, a: number, b: number): number {
  let s = 0;
  for (let i = Math.floor(a * SR); i < Math.floor(b * SR); i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / ((b - a) * SR));
}
/** The amplitude-weighted mean harmonic number over the first `k` harmonics: how bright the note is. */
function centroid(x: Float32Array, f: number, k = 14): number {
  let num = 0, den = 0;
  for (let h = 1; h <= k; h++) { const a = 10 ** (harmonic(x, f, h) / 20); num += h * a; den += a; }
  return num / den;
}

test('a trumpet and a trombone speak by themselves, in tune across their range and strengths', () => {
  for (const [horn, notes] of [['trumpet', [55, 62, 70, 77, 84]], ['trombone', [41, 48, 55, 62, 67]]] as const) {
    for (const midi of notes) for (const vel of [0.3, 0.9]) {
      const x = blowLips(note(horn, midi, vel), seeded(midi));
      assert.ok(x.every(Number.isFinite), `${horn} ${midi} ${vel}: finite`);
      assert.ok(rms(x, 0.3, 0.7) > 1e-3, `${horn} ${midi} ${vel}: it sounds (${rms(x, 0.3, 0.7)})`);
      const c = cents(x, mtof(midi));
      assert.ok(Math.abs(c) <= 12, `${horn} ${midi} ${vel}: ${c} cents`);
    }
  }
});

test('blown harder, brass gets brighter, not only louder', () => {
  const f = mtof(70);
  const soft = blowLips(note('trumpet', 70, 0.35), seeded(1));
  const hard = blowLips(note('trumpet', 70, 0.95), seeded(1));
  // A recorded section's held Bb4 sits near the 6th harmonic at ff; softly it is darker by several harmonics.
  assert.ok(centroid(hard, f) > centroid(soft, f) + 1.5, `centroid ${centroid(soft, f).toFixed(2)} -> ${centroid(hard, f).toFixed(2)}`);
  assert.ok(centroid(hard, f) > 5 && centroid(hard, f) < 8, `ff centroid ${centroid(hard, f).toFixed(2)}`);
  // The radiated fundamental sits under the 2nd harmonic, as a bell sends it out.
  assert.ok(harmonic(hard, f, 1) < harmonic(hard, f, 2), 'the bell thins the fundamental');
  // The steady pressure climbs about twentyfold from the softest breath to the hardest.
  assert.ok(pressure('trumpet', 1) / pressure('trumpet', 0) > 15);
});

test('a tongued note speaks within about 40 ms with an accent; a slur glides in without one', () => {
  const f = mtof(70);
  const x = blowLips(note('trumpet', 70, 0.85), seeded(2));
  const steady = rms(x, 0.3, 0.7);
  assert.ok(rms(x, 0.035, 0.045) > steady * 0.7, 'near full by 40 ms');
  assert.ok(rms(x, 0, 0.004) < steady * 0.3, 'not at full at once');
  const peak = Math.max(...[0.03, 0.04, 0.05, 0.06].map((t) => rms(x, t, t + 0.01)));
  assert.ok(peak > steady * 1.05, 'the tongue\'s push stands out at the front');
  const slur = blowLips(note('trumpet', 70, 0.85, { from: mtof(68) }), seeded(2));
  assert.ok(rms(slur, 0.004, 0.012) > rms(x, 0.004, 0.012), 'a slur sounds at once');
  assert.ok(Math.abs(cents(slur, f)) <= 12, 'and arrives in tune');
});

test('the same note blows the same; it ends when the breath stops, or falls off', () => {
  assert.deepEqual(blowLips(note('trumpet', 67, 0.7), seeded(3)), blowLips(note('trumpet', 67, 0.7), seeded(3)));
  const x = blowLips(note('trumpet', 67, 0.7, { dur: 0.3, seconds: 0.6 }), seeded(4));
  assert.ok(rms(x, 0.45, 0.55) < rms(x, 0.15, 0.25) * 0.01, 'silent after the release');
  // A fall slides down from the note as the note ends, well under the written pitch by the end.
  const fall = blowLips(note('trumpet', 72, 0.8, { dur: 0.5, seconds: 0.9, fall: 5 }), seeded(5));
  const f = mtof(72);
  const at = (c: number): number => harmonic(fall, f * 2 ** (c / 1200), 1, 0.55, 0.62);
  assert.ok(at(-300) > at(0), 'well under the note as it falls');
});
