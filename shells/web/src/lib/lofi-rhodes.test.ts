// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HARMONIC_FALL, rhodesHarmonics, rhodesNote, rhodesTine, VEL_REF } from './lofi-rhodes.ts';

const SR = 44100;
function seeded(a: number): () => number {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
const db = (v: number): number => 20 * Math.log10(v);

/** The level (dB) of the component at `hz` in `x` from `a` to `b` seconds, through a Hann window. */
function at(x: Float32Array, hz: number, a: number, b: number): number {
  const from = Math.floor(a * SR), n = Math.floor((b - a) * SR);
  let re = 0, im = 0, w = 0;
  for (let i = 0; i < n; i++) {
    const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    const v = x[from + i]! * h;
    re += v * Math.cos((2 * Math.PI * hz * i) / SR);
    im -= v * Math.sin((2 * Math.PI * hz * i) / SR);
    w += h;
  }
  return 20 * Math.log10((2 * Math.hypot(re, im)) / w + 1e-12);
}

test('the pickup makes the harmonics by register, as measured: a low note barks, the middle sits 15 to 23 dB down, the top is nearly a sine', () => {
  const level = (midi: number, n: number): number => db(rhodesHarmonics(midi, VEL_REF)[n - 1]!.level);
  assert.ok(level(34, 2) > -10 && level(34, 3) > -12, 'a low note barks on its own');
  for (const midi of [52, 60, 64]) {
    assert.ok(level(midi, 2) <= -15 && level(midi, 2) >= -20, `H2 at ${midi}: ${level(midi, 2).toFixed(1)}`);
    assert.ok(level(midi, 3) <= -15 && level(midi, 3) >= -24, `H3 at ${midi}: ${level(midi, 3).toFixed(1)}`);
    assert.ok(level(midi, 4) < -30, `H4 at ${midi}`);
  }
  assert.ok(level(90, 2) < -30 && level(90, 3) < -60, 'the top is nearly a sine');
});

test('a harder stroke barks: each decibel of swing lifts harmonic n by n - 1 decibels, under a ceiling', () => {
  const at60 = (vel: number, n: number): number => db(rhodesHarmonics(60, vel)[n - 1]!.level);
  const swing = db(1 / VEL_REF);
  assert.ok(Math.abs(at60(1, 2) - at60(VEL_REF, 2) - swing) < 0.5, 'H2 rises a decibel a decibel');
  assert.ok(Math.abs(at60(1, 3) - at60(VEL_REF, 3) - 2 * swing) < 1, 'H3 rises two');
  assert.ok(at60(0.2, 2) < -25, 'a soft note is nearly a sine');
  for (let vel = 0.1; vel <= 1; vel += 0.1) for (const p of rhodesHarmonics(36, vel)) assert.ok(db(p.level) <= 2.5, 'never far over the fundamental');
});

test('the tone darkens as the note rings: the harmonics fall faster than the fundamental, the fourth and above about five times as fast', () => {
  const h = rhodesHarmonics(60, VEL_REF);
  const d1 = h[0]!.decay;
  assert.ok(d1 > 3 && d1 < 4.5, `the middle sustains: ${d1.toFixed(1)} dB a second`);
  assert.ok(Math.abs(h[1]!.decay / d1 - (1 + HARMONIC_FALL)) < 1e-9);
  assert.ok(h[1]!.decay / d1 > 2 && h[1]!.decay / d1 < 2.6, 'the second 2.3 times');
  for (const p of h.slice(3)) assert.ok(p.decay / d1 > 4.5 && p.decay / d1 < 5.5, `H${p.ratio} about 5 times`);
  assert.ok(rhodesHarmonics(86, VEL_REF)[0]!.decay > 12, 'a high note dies far sooner');
});

test('the tine rings its bell 7.3 to 7.6 times the fundamental, about 37 dB down, gone within a tenth of a second', () => {
  const t = rhodesTine(60, VEL_REF);
  assert.ok(t.ratio > 7.3 && t.ratio < 7.6);
  assert.ok(Math.abs(db(t.level) + 37) < 0.5);
  assert.ok(t.decay > 200, 'gone 20 dB within a tenth of a second');
  assert.ok(rhodesTine(86, VEL_REF).ratio < 7, 'shorter and lower in ratio at the top');
});

test('a rendered note is what the tables say: its harmonics, its bell fading, its long sustain, the same from the same seed', () => {
  const f = mtof(60);
  const x = rhodesNote({ sr: SR, midi: 60, vel: VEL_REF, seconds: 2 }, seeded(1));
  assert.deepEqual(x, rhodesNote({ sr: SR, midi: 60, vel: VEL_REF, seconds: 2 }, seeded(1)));
  const h1 = at(x, f, 0.03, 0.09);
  const want = db(rhodesHarmonics(60, VEL_REF)[1]!.level);
  assert.ok(Math.abs(at(x, 2 * f, 0.03, 0.09) - h1 - want) < 1.5, 'H2 as the table says, a little decayed');
  const tine = rhodesTine(60, VEL_REF).ratio * f;
  assert.ok(at(x, tine, 0.003, 0.033) - at(x, tine, 0.15, 0.18) > 25, 'the bell fades fast');
  const fall = at(x, f, 0.3, 0.5) - at(x, f, 1.3, 1.5);
  assert.ok(fall > 2.5 && fall < 5, `the fundamental falls ${fall.toFixed(1)} dB in a second`);
  // The upper part alone, for the oscillators to add the two lowest harmonics to.
  const upper = rhodesNote({ sr: SR, midi: 60, vel: VEL_REF, seconds: 1, from: 3 }, seeded(1));
  assert.ok(at(upper, f, 0.03, 0.09) < h1 - 50 && at(upper, 2 * f, 0.03, 0.09) < h1 - 50, 'no fundamental or second harmonic');
  assert.ok(Math.abs(at(upper, 3 * f, 0.03, 0.09) - at(x, 3 * f, 0.03, 0.09)) < 0.5, 'the third as in the whole note');
});

test('the strike: full level within two milliseconds, the hammer a brief burst well under the note', () => {
  const x = rhodesNote({ sr: SR, midi: 60, vel: VEL_REF, seconds: 0.5 }, seeded(2));
  let peak = 0, at2 = 0;
  for (let i = 0; i < 0.05 * SR; i++) peak = Math.max(peak, Math.abs(x[i]!));
  for (let i = 0; i < 0.0025 * SR; i++) at2 = Math.max(at2, Math.abs(x[i]!));
  assert.ok(at2 > peak * 0.5, 'up within two milliseconds');
  const f = mtof(60);
  assert.ok(at(x, 4000, 0, 0.01) < at(x, f, 0, 0.01) - 35, 'the hammer is far under the fundamental');
});
