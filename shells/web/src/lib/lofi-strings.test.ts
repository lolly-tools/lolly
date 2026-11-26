// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pluckString, type StringSpec } from './lofi-strings.ts';

const SR = 44100;
const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
function seeded(a: number): () => number {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const NYLON: Omit<StringSpec, 'f'> = { sr: SR, seconds: 1.2, pickAt: 0.2, bright: 9, mellow: 6, decay: 3, noise: 0.15 };

/**
 * The fundamental's pitch in cents from `f`: the strongest frequency within 15 cents of it
 * over 0.2 to 1 s, in quarter-cent steps. (Autocorrelation reads a decaying, nearly pure
 * tone sharp, so it would blame the string for the measurement.)
 */
function cents(x: Float32Array, f: number): number {
  let best = -1, at = 0;
  for (let c = -15; c <= 15; c += 0.25) {
    const w = (2 * Math.PI * f * 2 ** (c / 1200)) / SR;
    let re = 0, im = 0;
    for (let i = Math.floor(0.2 * SR); i < Math.min(x.length, SR); i++) { re += x[i]! * Math.cos(w * i); im += x[i]! * Math.sin(w * i); }
    if (re * re + im * im > best) { best = re * re + im * im; at = c; }
  }
  return at;
}
/** A harmonic's level (dB) in a window starting at `at` seconds. */
function harmonic(x: Float32Array, f: number, h: number, at: number): number {
  const n = 4096, s = Math.floor(at * SR), w = (2 * Math.PI * f * h) / SR;
  let re = 0, im = 0;
  for (let i = 0; i < n; i++) { const v = x[s + i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n)); re += v * Math.cos(w * i); im -= v * Math.sin(w * i); }
  return 10 * Math.log10(re * re + im * im + 1e-20);
}

test('a modelled string is in tune across the range, from a bass to a high string', () => {
  for (const midi of [28, 36, 40, 52, 57, 64, 76, 84]) {
    const x = pluckString({ ...NYLON, f: mtof(midi) }, seeded(midi));
    assert.ok(Math.abs(cents(x, mtof(midi))) < 2.5, `midi ${midi}: ${cents(x, mtof(midi)).toFixed(2)} cents`);
  }
});

test('the same pluck renders the same; another seed is another pluck of the same note', () => {
  const a = pluckString({ ...NYLON, f: 220 }, seeded(1));
  assert.deepEqual(a, pluckString({ ...NYLON, f: 220 }, seeded(1)));
  assert.notDeepEqual(a, pluckString({ ...NYLON, f: 220 }, seeded(2)));
});

test('no click: a pluck starts and wraps round its first period smoothly', () => {
  for (const midi of [31, 36, 57, 64]) {
    const x = pluckString({ ...NYLON, f: mtof(midi), plane: 0.5 }, seeded(3));
    let peak = 0, sum = 0;
    const n = Math.round(0.25 * SR);
    for (let i = 0; i < n; i++) { peak = Math.max(peak, Math.abs(x[i]!)); sum += x[i]! * x[i]!; }
    const crest = 20 * Math.log10(peak / Math.sqrt(sum / n));
    assert.ok(crest < 20, `midi ${midi}: crest factor ${crest.toFixed(1)} dB`);
  }
});

test('the top dies first, and a dark string loses it sooner than a bright one', () => {
  const f = 196;
  const fall = (spec: Partial<StringSpec>, h: number): number => {
    const x = pluckString({ ...NYLON, f, ...spec }, seeded(4));
    return harmonic(x, f, h, 0.02) - harmonic(x, f, h, 0.6);
  };
  assert.ok(fall({}, 8) > fall({}, 1) + 6, 'the eighth harmonic falls faster than the fundamental');
  assert.ok(fall({ mellow: 3 }, 6) > fall({ mellow: 14 }, 6) + 3, 'a dark (flatwound, nylon) string loses its top sooner');
});

test('the bridge pickup hears less fundamental than the neck pickup', () => {
  const f = 110;
  const balance = (pickup: number): number => {
    const x = pluckString({ ...NYLON, f, pickup, mellow: 12, bright: 18 }, seeded(5));
    return harmonic(x, f, 1, 0.05) - harmonic(x, f, 4, 0.05);
  };
  assert.ok(balance(0.08) < balance(0.3) - 3, 'the bridge pickup is thinner and brighter');
});
