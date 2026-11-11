// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blowReed, type ReedNote } from './lofi-reeds.ts';

const SR = 44100;
const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
function seeded(a: number): () => number {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const note = (bore: ReedNote['bore'], midi: number, vel: number): ReedNote => ({ sr: SR, f: mtof(midi), vel, dur: 0.8, seconds: 0.9, bore, vibrato: 0, rate: 5.4, scoop: 0, attack: 0.04 });
/** A harmonic's level (dB) over the held part of the note. */
function harmonic(x: Float32Array, f: number, h: number): number {
  const w = (2 * Math.PI * f * h) / SR;
  let re = 0, im = 0;
  for (let i = Math.floor(0.3 * SR); i < Math.floor(0.7 * SR); i++) { re += x[i]! * Math.cos(w * i); im += x[i]! * Math.sin(w * i); }
  return 10 * Math.log10(re * re + im * im + 1e-20);
}
/** The fundamental's pitch in cents from `f`, by a fine search over the held part. */
function cents(x: Float32Array, f: number): number {
  let best = -1, at = 0;
  for (let c = -40; c <= 40; c += 0.5) { const p = harmonic(x, f * 2 ** (c / 1200), 1); if (p > best) { best = p; at = c; } }
  return at;
}

test('a sax and a clarinet sound by themselves, in tune across their range', () => {
  for (const [bore, notes, within] of [['cone', [49, 56, 63, 70, 77], 8], ['cylinder', [52, 58, 64, 72], 2]] as const) {
    for (const midi of notes) for (const vel of [0.4, 0.9]) {
      const x = blowReed(note(bore, midi, vel), seeded(midi));
      let rms = 0;
      for (let i = Math.floor(0.3 * SR); i < Math.floor(0.7 * SR); i++) rms += x[i]! * x[i]!;
      rms = Math.sqrt(rms / (0.4 * SR));
      assert.ok(x.every(Number.isFinite) && rms > 0.2, `${bore} ${midi} ${vel}: it speaks (${rms.toFixed(2)})`);
      assert.ok(Math.abs(cents(x, mtof(midi))) <= within, `${bore} ${midi} ${vel}: ${cents(x, mtof(midi))} cents`);
    }
  }
});

test('a clarinet\'s low notes lead with the odd harmonics; a sax has them all, and is brighter blown harder', () => {
  const f = mtof(55);
  const clarinet = blowReed(note('cylinder', 55, 0.6), seeded(1));
  for (const h of [2, 4]) assert.ok(harmonic(clarinet, f, h) < harmonic(clarinet, f, h + 1) - 15, `even harmonic ${h} well under ${h + 1}`);
  const fs = mtof(63);
  const soft = blowReed(note('cone', 63, 0.35), seeded(2));
  const hard = blowReed(note('cone', 63, 0.95), seeded(2));
  for (const h of [2, 3]) assert.ok(harmonic(soft, fs, h) > harmonic(soft, fs, 1) - 20, `the sax's harmonic ${h} sounds`);
  const top = (x: Float32Array) => harmonic(x, fs, 6) + harmonic(x, fs, 7) - 2 * harmonic(x, fs, 1);
  assert.ok(top(hard) > top(soft) + 3, 'blown harder, the top comes up');
});

test('the same note blows the same; a slurred note glides in without starting again', () => {
  assert.deepEqual(blowReed(note('cone', 60, 0.7), seeded(3)), blowReed(note('cone', 60, 0.7), seeded(3)));
  const slur = blowReed({ ...note('cone', 62, 0.7), from: mtof(60) }, seeded(4));
  const fresh = blowReed(note('cone', 62, 0.7), seeded(4));
  // Both start with the bore ringing (the tongue), but a slur's breath is already full while
  // a fresh note's is still swelling in over its attack.
  const early = (x: Float32Array) => { let s = 0; for (let i = Math.floor(0.015 * SR); i < Math.floor(0.03 * SR); i++) s += x[i]! * x[i]!; return s; };
  assert.ok(early(slur) > early(fresh) * 3, 'a slur is at full breath by 15 ms; a fresh note is still swelling in');
});
