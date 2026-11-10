// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as K from './lofi-kit.ts';

function seeded(a: number): () => number {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const SR = 44100;
const peak = (x: Float32Array) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
/** Energy above `hz`, against all energy, by a one-pole high-pass. */
function highShare(x: Float32Array, hz: number): number {
  const a = Math.exp((-2 * Math.PI * hz) / SR);
  let hp = 0, prev = 0, hi = 0, all = 0;
  for (const v of x) { hp = a * (hp + v - prev); prev = v; hi += hp * hp; all += v * v; }
  return hi / all;
}
/** RMS of a window, in seconds. */
function rms(x: Float32Array, from: number, to: number): number {
  let s = 0; const a = Math.floor(from * SR), b = Math.floor(to * SR);
  for (let i = a; i < b; i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / (b - a));
}

test('a piece renders the same from the same seed, and differently from another', () => {
  const base = K.cymbalBase(K.RIDE, seeded(1));
  const a = K.cymbal(SR, K.RIDE, base, 0.8, seeded(2));
  const b = K.cymbal(SR, K.RIDE, K.cymbalBase(K.RIDE, seeded(1)), 0.8, seeded(2));
  assert.deepEqual(a, b);
  const c = K.cymbal(SR, K.RIDE, base, 0.8, seeded(3));
  assert.notDeepEqual(a, c);
});

test('every piece is finite and peaks inside full scale, a soft stroke below a hard one', () => {
  for (const spec of [K.RIDE, K.CRASH, K.SPLASH, K.CHINA, K.HAT_CLOSED, K.HAT_OPEN]) {
    const base = K.cymbalBase(spec, seeded(4));
    const soft = K.cymbal(SR, spec, base, 0.4, seeded(5));
    const hard = K.cymbal(SR, spec, base, 0.95, seeded(5));
    for (const x of [soft, hard]) assert.ok(x.every(Number.isFinite) && peak(x) <= 0.9001);
    assert.ok(peak(soft) < peak(hard));
  }
  for (const x of [K.snareStroke(SR, 200, 0.9, 1, 1, seeded(6)), K.tomStroke(SR, 110, 0.8, seeded(6)), K.kickStroke(SR, 55, 0.9, 1, 0.3, seeded(6))]) {
    assert.ok(x.every(Number.isFinite) && peak(x) <= 0.951 && peak(x) > 0.3);
  }
});

test('a hard stroke is brighter than a soft one', () => {
  const base = K.cymbalBase(K.CRASH, seeded(7));
  const soft = highShare(K.cymbal(SR, K.CRASH, base, 0.35, seeded(8)), 6000);
  const hard = highShare(K.cymbal(SR, K.CRASH, base, 0.95, seeded(8)), 6000);
  assert.ok(hard > soft * 1.3, `hard ${hard.toFixed(3)} against soft ${soft.toFixed(3)}`);
  const ghost = highShare(K.snareStroke(SR, 200, 0.2, 1, 1, seeded(9)), 4000);
  const accent = highShare(K.snareStroke(SR, 200, 0.95, 1, 1, seeded(9)), 4000);
  assert.ok(accent > ghost, `accent ${accent.toFixed(3)} against ghost ${ghost.toFixed(3)}`);
});

test('cymbals ring and hats choke: a ride is still sounding after a second, a closed hat is gone in a fifth', () => {
  const ride = K.cymbal(SR, K.RIDE, K.cymbalBase(K.RIDE, seeded(10)), 0.7, seeded(11));
  const hat = K.cymbal(SR, K.HAT_CLOSED, K.cymbalBase(K.HAT_CLOSED, seeded(10)), 0.7, seeded(11));
  const open = K.cymbal(SR, K.HAT_OPEN, K.cymbalBase(K.HAT_OPEN, seeded(10)), 0.7, seeded(11));
  assert.ok(rms(ride, 1, 1.2) > rms(ride, 0, 0.05) * 0.05, 'the ride keeps its wash');
  assert.ok(rms(hat, 0.2, 0.25) < rms(hat, 0, 0.02) * 0.01, 'the closed hat is choked');
  assert.ok(rms(open, 0.25, 0.3) > rms(hat, 0.25, 0.3) * 10, 'the open hat rings on');
});

test('a snare rings out and drops off; a floor tom rings longer than a high one', () => {
  const snare = K.snareStroke(SR, 200, 0.9, 1, 1, seeded(12));
  const attack = rms(snare, 0, 0.02);
  assert.ok(rms(snare, 0.08, 0.12) > attack * 0.02, 'the wires keep buzzing after the hit');
  assert.ok(rms(snare, 0.45, 0.6) < attack * 0.01, 'and drop off');
  const high = K.tomStroke(SR, 190, 0.8, seeded(13));
  const floor = K.tomStroke(SR, 85, 0.8, seeded(13));
  assert.ok(rms(floor, 0.4, 0.5) / rms(floor, 0, 0.02) > rms(high, 0.4, 0.5) / rms(high, 0, 0.02));
});
