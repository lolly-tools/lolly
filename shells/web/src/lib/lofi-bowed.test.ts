// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bowString, bowSource, type BowNote } from './lofi-bowed.ts';

const SR = 44100;
const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
function seeded(a: number): () => number {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const note = (midi: number, vel: number, more: Partial<BowNote> = {}): BowNote => ({ sr: SR, f: mtof(midi), vel, dur: 0.8, seconds: 1.1, vibrato: 0, rate: 5.6, slide: 0, ...more });
/** A harmonic's level (dB) between `a` and `b` seconds. */
function harmonic(x: Float32Array, f: number, h: number, a = 0.35, b = 0.75): number {
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
function centroid(x: Float32Array, f: number, k = 12): number {
  let num = 0, den = 0;
  for (let h = 1; h <= k; h++) { const a = 10 ** (harmonic(x, f, h) / 20); num += h * a; den += a; }
  return num / den;
}

test('the bowed string speaks at its note across the fiddle\'s range and strengths, in Helmholtz motion', () => {
  for (const midi of [60, 64, 69, 74, 79, 84]) for (const vel of [0.25, 0.85]) {
    const x = bowString(note(midi, vel), seeded(midi));
    assert.ok(x.every(Number.isFinite), `${midi} ${vel}: finite`);
    assert.ok(rms(x, 0.35, 0.75) > 1e-3, `${midi} ${vel}: it sounds`);
    const c = cents(x, mtof(midi));
    assert.ok(Math.abs(c) <= 10, `${midi} ${vel}: ${c} cents`);
    // The string's own force on the bridge is a sawtooth: the fundamental leads (not the octave, as in a double slip).
    const s = bowSource(note(midi, vel), seeded(midi));
    assert.ok(harmonic(s, mtof(midi), 1) > harmonic(s, mtof(midi), 2), `${midi} ${vel}: the fundamental leads the string`);
  }
});

test('bowed harder, the fiddle gets brighter (recorded violins: the upper harmonics climb about 8 dB from pp to ff)', () => {
  let soft = 0, loud = 0, n = 0;
  for (const midi of [67, 72, 77]) for (const seed of [1, 2]) {
    const f = mtof(midi);
    const s = bowString(note(midi, 0.25), seeded(seed)), l = bowString(note(midi, 0.85), seeded(seed));
    // The 5th to 8th harmonics against the first two.
    const top = (x: Float32Array): number => [5, 6, 7, 8].reduce((a, h) => a + harmonic(x, f, h), 0) / 4 - (harmonic(x, f, 1) + harmonic(x, f, 2)) / 2;
    soft += top(s); loud += top(l); n++;
  }
  soft /= n; loud /= n;
  assert.ok(loud > soft + 3, `upper harmonics ${soft.toFixed(1)} -> ${loud.toFixed(1)} dB`);
  const f = mtof(74), c = centroid(bowString(note(74, 0.6), seeded(3)), f);
  assert.ok(c > 1.6 && c < 3.8, `centroid ${c.toFixed(2)}`);
});

test('a stroke scratches before the string catches and takes tens of milliseconds to speak', () => {
  const x = bowString(note(74, 0.6, { dur: 0.6, seconds: 0.8 }), seeded(4));
  const steady = rms(x, 0.3, 0.5);
  assert.ok(rms(x, 0, 0.005) < steady * 0.2, 'quiet at the very start');
  assert.ok(rms(x, 0.01, 0.03) < steady * 0.5, 'still well under the note 30 ms in');
  assert.ok(rms(x, 0.15, 0.2) > steady * 0.6, 'near full by 150 ms');
  // A slurred note changes under the same bow: it sounds at once.
  const slur = bowString(note(74, 0.6, { from: mtof(72), dur: 0.6, seconds: 0.8 }), seeded(4));
  assert.ok(rms(slur, 0.005, 0.02) > rms(x, 0.005, 0.02) * 2, 'a slur sounds at once');
  assert.ok(Math.abs(cents(slur, mtof(74))) <= 10, 'and arrives in tune');
});

test('vibrato makes the harmonics rise and fall through the body (a still note barely moves)', () => {
  const f = mtof(76);
  const flux = (x: Float32Array): number => {
    // How much the 3rd to 6th harmonics' levels swing against each other, frame to frame.
    const frames: number[][] = [];
    for (let a = 0.4; a < 1.3; a += 0.02) frames.push([3, 4, 5, 6].map((h) => harmonic(x, f, h, a, a + 0.04) - harmonic(x, f, 1, a, a + 0.04)));
    let s = 0;
    for (let h = 0; h < 4; h++) { const v = frames.map((r) => r[h]!); const m = v.reduce((p, q) => p + q, 0) / v.length; s += Math.sqrt(v.reduce((p, q) => p + (q - m) ** 2, 0) / v.length); }
    return s / 4;
  };
  const still = bowString(note(76, 0.6, { dur: 1.4, seconds: 1.5 }), seeded(5));
  const sung = bowString(note(76, 0.6, { dur: 1.4, seconds: 1.5, vibrato: 12 }), seeded(5));
  assert.ok(flux(sung) > flux(still) + 0.8, `flux ${flux(still).toFixed(2)} -> ${flux(sung).toFixed(2)} dB`);
});

test('the same note bows the same; the string rings on into the body and dies away when the bow lifts', () => {
  assert.deepEqual(bowString(note(72, 0.6), seeded(6)), bowString(note(72, 0.6), seeded(6)));
  const x = bowString(note(72, 0.6, { dur: 0.3, seconds: 1 }), seeded(7));
  const held = rms(x, 0.15, 0.28);
  assert.ok(rms(x, 0.32, 0.36) > held * 0.05, 'it rings a moment after the bow lifts');
  assert.ok(rms(x, 0.85, 0.95) < held * 0.01, 'and is gone well within a second');
});
