// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { airBurst, inhale, noteSpeed, preAttack, seededRandom, type BurstShape } from './lofi-breath.ts';

const SR = 44100;
function rms(x: Float32Array, a: number, b: number): number {
  let s = 0;
  for (let i = Math.floor(a * SR); i < Math.floor(b * SR); i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / ((b - a) * SR));
}
const db = (r: number): number => 20 * Math.log10(r);
/** Energy at `hz` (a DFT bin, summed over a few neighbours). */
function around(x: Float32Array, lo: number, hi: number): number {
  let e = 0;
  for (let hz = lo; hz < hi; hz += 25) {
    const w = (2 * Math.PI * hz) / SR;
    let re = 0, im = 0;
    for (let i = 0; i < x.length; i++) { re += x[i]! * Math.cos(w * i); im += x[i]! * Math.sin(w * i); }
    e += re * re + im * im;
  }
  return e / ((hi - lo) / 25);
}
/** A long, steady burst (no fall, no spread), so its level can be read. */
const steady: BurstShape = { centre: 2000, width: 1.5, level: -6, length: 100, rise: 0.0001 };

test('the same seed gives the same air; another seed, other air', () => {
  const shape: BurstShape = { ...steady, length: 0.01, spread: 2, lengthSpread: 0.3, centreSpread: 0.2 };
  const a = airBurst(SR, shape, { strength: 0.5, speed: 0, seed: 7 });
  const b = airBurst(SR, shape, { strength: 0.5, speed: 0, seed: 7 });
  const c = airBurst(SR, shape, { strength: 0.5, speed: 0, seed: 8 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(a.every(Number.isFinite));
  const r = seededRandom(3), s = seededRandom(3);
  for (let i = 0; i < 5; i++) assert.equal(r(), s());
});

test('a burst comes out at its stated level, moved by the strength and the speed', () => {
  const level = (strength: number, speed: number, shape: BurstShape = steady): number =>
    db(rms(airBurst(SR, { ...shape, perStrength: 8, perSpeed: 5 }, { strength, speed, seed: 21 }, 0.25), 0.02, 0.24));
  assert.ok(Math.abs(level(0.5, 0) - -6) < 0.6, `at strength 0.5 and settled: ${level(0.5, 0).toFixed(2)} dB, stated -6`);
  assert.ok(Math.abs(level(1, 0) - level(0.5, 0) - 4) < 0.6, 'half a unit of strength more is 4 dB more');
  assert.ok(Math.abs(level(0.5, 1) - level(0.5, 0) - 5) < 0.6, 'the quickest note is 5 dB more');
  // The level reads the same whatever the band.
  const wide = level(0.5, 0, { ...steady, centre: 4000, width: 3, top: 0.5, topHz: 6000 });
  assert.ok(Math.abs(wide - -6) < 0.6, `a wider, brighter band: ${wide.toFixed(2)} dB`);
});

test('a burst sits round its centre and falls away over its length', () => {
  const x = airBurst(SR, { ...steady, centre: 2500, width: 1 }, { strength: 0.5, speed: 0, seed: 4 }, 0.2);
  const at = around(x, 2200, 2800), under = around(x, 500, 700), over = around(x, 9000, 11000);
  assert.ok(at > under * 10 && at > over * 10, 'its air is round 2.5 kHz');
  const short = airBurst(SR, { ...steady, length: 0.005 }, { strength: 0.5, speed: 0, seed: 4 });
  assert.equal(short.length, Math.round(0.04 * SR), 'long enough for its fall by default');
  assert.ok(db(rms(short, 0.001, 0.004)) - db(rms(short, 0.025, 0.035)) > 30, 'gone within a few lengths');
  // Spread: each note's burst differs in level from the next.
  const levels = [1, 2, 3, 4, 5, 6].map((seed) => db(rms(airBurst(SR, { ...steady, spread: 3 }, { strength: 0.5, speed: 0, seed }, 0.1), 0.01, 0.09)));
  assert.ok(Math.max(...levels) - Math.min(...levels) > 2, `six notes spread ${(Math.max(...levels) - Math.min(...levels)).toFixed(1)} dB`);
});

test('the air before a note swells into the onset', () => {
  const x = preAttack(SR, { centre: 1500, width: 2, level: -10, length: 0.08, curve: 2 }, { strength: 0.5, speed: 0, seed: 5 });
  assert.equal(x.length, Math.round(0.08 * SR));
  assert.ok(x.every(Number.isFinite));
  assert.ok(db(rms(x, 0.07, 0.08)) - db(rms(x, 0, 0.02)) > 12, 'quiet at first, loudest at the onset');
  // At the onset its level is the one stated (the last 10 ms are within 1.5 dB of it under the swell).
  assert.ok(Math.abs(db(rms(x, 0.07, 0.08)) - -10) < 1.5, `at the onset: ${db(rms(x, 0.07, 0.08)).toFixed(1)} dB`);
});

test('a breath in a rest swells and fades, its loudest 50 ms at the stated level, in the middle of its band', () => {
  const x = inhale(SR, 0.3, { bands: [{ centre: 1400, width: 1.5 }, { centre: 3500, width: 1, level: -7 }] }, 13);
  assert.equal(x.length, Math.round(0.3 * SR));
  assert.ok(x.every(Number.isFinite));
  assert.ok(rms(x, 0.1, 0.18) > rms(x, 0, 0.02) * 2 && rms(x, 0.1, 0.18) > rms(x, 0.28, 0.3) * 2, 'it swells and fades');
  let loudest = 0;
  for (let a = 0; a + 0.05 <= 0.3; a += 0.005) loudest = Math.max(loudest, rms(x, a, a + 0.05));
  assert.ok(Math.abs(db(loudest)) < 0.3, `its loudest 50 ms: ${db(loudest).toFixed(2)} dB`);
  assert.ok(around(x, 1100, 1700) > around(x, 100, 700) * 4, 'its rush sits in the middle, not the bottom');
});

test('a note is quick by its length', () => {
  assert.equal(noteSpeed(0.05), 1);
  assert.equal(noteSpeed(0.1), 1);
  assert.ok(Math.abs(noteSpeed(0.2) - 0.5) < 1e-9);
  assert.equal(noteSpeed(0.3), 0);
  assert.equal(noteSpeed(2), 0);
  assert.ok(Math.abs(noteSpeed(0.3, 0.2, 0.4) - 0.5) < 1e-9);
});
