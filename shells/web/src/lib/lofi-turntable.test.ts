// SPDX-License-Identifier: MPL-2.0
/**
 * The turntable (lib/lofi-turntable.ts) and its scratches (lib/lofi-scratches.ts).
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/lofi-turntable.test.ts
 *
 * What is pinned:
 *  - the hand: a baby scratch goes forwards and back and comes home, a chirp's fader cuts
 *    each stroke short, a transformer's taps in time, a flare clicks shut inside a stroke,
 *    a crab taps fast, a stab is one push, a rewind pulls back and slows, a backspin flicks
 *    back and comes round; the fader's edges are a few milliseconds and it leaks a little shut;
 *  - the record: still is silent, its own speed plays the sound as it is, twice the speed
 *    an octave up, and backwards plays it backwards; the fader clicks as it cuts in;
 *  - the Turntable lead: a note's length chooses its scratch, and a tune's record is its own.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handMotion, motionShape, turntable, HAND } from './lofi-turntable.ts';
import { leadScratch, leadSource } from './lofi-scratches.ts';
import { mulberry32 } from '../../../../engine/src/zzfx-compose.ts';
import type { LofiTuneInfo } from '../../../../engine/src/lofi-compose.ts';

const SR = 8000;
const sum = (a: Float32Array, from = 0, to = a.length): number => { let s = 0; for (let i = from; i < to; i++) s += a[i]!; return s; };

test('a baby scratch goes forwards and back and comes home; a stroke rises and falls', () => {
  const m = handMotion('baby', 0.5, 0.1, SR, mulberry32(1));
  const n = SR * 0.1;
  assert.ok(sum(m.speed, 0, n) > 0 && sum(m.speed, n, 2 * n) < 0, 'forwards, then back');
  assert.ok(Math.abs(sum(m.speed, 0, 2 * n)) / SR < 0.05, 'home after a pair of strokes');
  assert.ok(m.gate.every(g => g > 0.99), 'the fader open');
  assert.equal(motionShape(0), 0);
  assert.equal(motionShape(1), 0);
  assert.ok(Math.abs(motionShape(HAND.peakAt) - 1) < 1e-9, 'the speed peaks where the hand peaks');
});

test('the fader: a chirp cuts each stroke short, a transformer taps, a flare clicks shut once a stroke, a crab taps fast', () => {
  const stroke = 0.12, n = Math.round(stroke * SR);
  const open = (g: Float32Array, from: number, to: number): number => { let s = 0; for (let i = from; i < to; i++) s += g[i]! > 0.5 ? 1 : 0; return s / (to - from); };
  const edges = (g: Float32Array, from: number, to: number): number => { let e = 0; for (let i = from + 1; i < to; i++) if (g[i]! > 0.5 && g[i - 1]! <= 0.5) e++; return e; };
  const chirp = handMotion('chirp', 0.48, stroke, SR, mulberry32(2)).gate;
  assert.ok(open(chirp, 0, Math.round(n * 0.6)) > 0.95 && open(chirp, Math.round(n * 0.7), n) < 0.05, 'a chirp: open, then cut before the stroke ends');
  const trans = handMotion('transformer', 0.48, stroke, SR, mulberry32(3)).gate;
  assert.equal(edges(trans, 0, trans.length), 3, 'a transformer taps once a stroke, in time');
  const flare = handMotion('flare', 0.24, stroke, SR, mulberry32(4)).gate;
  assert.equal(edges(flare, Math.round(n * 0.25), Math.round(n * 0.75)), 1, 'a flare clicks shut once inside a stroke');
  const crab = handMotion('crab', 0.24, stroke, SR, mulberry32(5)).gate;
  assert.ok(edges(crab, 0, n) >= 2, `a crab's fingers tap fast (${edges(crab, 0, n)})`);
  // The fader's edge: from shut to open in about three milliseconds, and a little sound leaks past it shut.
  const i = chirp.findIndex((g, k) => k > n && g > 0.01);
  const j = chirp.findIndex((g, k) => k > i && g > 0.99);
  assert.ok((j - i) / SR <= 0.0035, `a fast cut-in (${((j - i) / SR * 1000).toFixed(2)} ms)`);
  assert.ok(Math.min(...chirp) > 0 && Math.min(...chirp) < 0.01, 'shut, with a leak 48 dB down');
});

test('a stab is one push; a rewind pulls back and slows; a backspin flicks back and comes round', () => {
  const stab = handMotion('stab', 0.4, 0.1, SR, mulberry32(6));
  assert.ok(stab.speed.slice(0, SR * 0.09).some(v => v > 2), 'a hard push');
  assert.ok(stab.gate.slice(Math.round(SR * 0.12)).every(g => g < 0.01), 'then silence');
  const rew = handMotion('rewind', 0.8, 0.1, SR, mulberry32(7)).speed;
  const minAt = rew.indexOf(Math.min(...rew));
  assert.ok(rew[10]! > 0.5 && rew[minAt]! < -2.5, 'playing, then pulled hard back');
  assert.ok(Math.abs(rew[rew.length - 1]!) < Math.abs(rew[minAt]!) / 3, 'and slowing');
  const spin = handMotion('backspin', 1.5, 0.1, SR, mulberry32(8)).speed;
  assert.ok(Math.min(...spin) < -5 && spin[spin.length - 1]! > 0.3, 'spun back, let go, and the motor brings it round');
});

test('the record: still is silent, its own speed plays the sound, twice the speed an octave up, backwards backwards', () => {
  const hz = 200;
  const src = Float32Array.from({ length: SR * 2 }, (_, i) => Math.sin((2 * Math.PI * hz * i) / SR));
  const steady = (v: number, n = SR / 2) => ({ speed: new Float32Array(n).fill(v), gate: new Float32Array(n).fill(1) });
  const crossings = (x: Float32Array, from: number): number => { let c = 0; for (let i = from + 1; i < x.length; i++) if (x[i - 1]! < 0 && x[i]! >= 0) c++; return c / ((x.length - from) / SR); };
  const still = turntable(src, SR, 0.5, steady(0), 1, SR);
  assert.ok(still.slice(400).every(v => Math.abs(v) < 0.02), 'a still record is silent');
  const own = turntable(src, SR, 0.5, steady(1), 1, SR);
  assert.ok(Math.abs(crossings(own, 400) - hz) < 6, `its own speed, its own pitch (${crossings(own, 400).toFixed(1)})`);
  const twice = turntable(src, SR, 0.2, steady(2), 1, SR);
  assert.ok(Math.abs(crossings(twice, 400) - 2 * hz) < 10, `twice the speed, an octave up (${crossings(twice, 400).toFixed(1)})`);
  const pitched = turntable(src, SR, 0.2, steady(1), 1.5, SR);
  assert.ok(Math.abs(crossings(pitched, 400) - 1.5 * hz) < 8, 'the source played at a pitch');
  const back = turntable(src, SR, 1.5, steady(-1), 1, SR);
  assert.ok(Math.abs(crossings(back, 400) - hz) < 6, 'backwards at its own speed');
  // The click as the fader cuts in on a quiet record.
  const quiet = Float32Array.from({ length: SR }, () => 0.001);
  const gate = new Float32Array(SR / 4); gate.fill(1, SR / 8);
  const clicked = turntable(quiet, SR, 0.1, { speed: new Float32Array(SR / 4).fill(1), gate }, 1, SR);
  assert.ok(clicked[SR / 8 + 1]! > clicked[SR / 8 + 200]! * 1.1, 'a click over the sound as the fader closes its contact');
});

test('the Turntable lead: a note\'s length chooses its scratch, and each tune draws its own record', () => {
  assert.deepEqual([0.1, 0.25, 0.5, 1, 2].map(leadScratch), ['stab', 'chirp', 'flare', 'baby', 'transformer']);
  const tune = (seed: number): LofiTuneInfo => ({ seed, mood: 'hiphop', bpm: 90, swing: 0.5, swing8: 0.5, key: 'C minor', progressions: [[], []], style: {} as LofiTuneInfo['style'], bars: 1 });
  assert.equal(leadSource(tune(5)), leadSource(tune(5)));
  const seen = new Set(Array.from({ length: 40 }, (_, s) => leadSource(tune(s))));
  assert.ok(seen.has('voice') && seen.has('horn') && seen.has('bass'), `the voice, the horn and the bass all come up (${[...seen].join(', ')})`);
});
