// SPDX-License-Identifier: MPL-2.0
/**
 * The steel-string acoustic: the measured body, the decay, and the playing noises.
 *
 * Run directly:  node --test shells/web/src/lib/lofi-acoustic.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acousticDecay, acousticString, bodyAt, stringFor, type AcousticSpec } from './lofi-acoustic.ts';

const SR = 22050;
const db = (x: number): number => 20 * Math.log10(x);
function mulberry(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const stroke = (over: Partial<AcousticSpec>, seed = 3): Float32Array =>
  acousticString({ sr: SR, f: 82.41, seconds: 2, string: 0, fret: 0, pickMm: 150, layer: 1, ...over }, mulberry(seed));
const rms = (x: Float32Array, from: number, to: number): number => { let e = 0; const a = Math.round(from * SR), b = Math.round(to * SR); for (let i = a; i < b; i++) e += x[i]! ** 2; return Math.sqrt(e / Math.max(1, b - a)); };
/** A frequency's level in a stretch of `x` (a single-bin DFT under a Hann window). */
function at(x: Float32Array, hz: number, from: number, to: number): number {
  const a = Math.round(from * SR), n = Math.round((to - from) * SR);
  let re = 0, im = 0;
  for (let i = 0; i < n; i++) { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n); const v = x[a + i]! * w; re += v * Math.cos((2 * Math.PI * hz * i) / SR); im -= v * Math.sin((2 * Math.PI * hz * i) / SR); }
  return Math.hypot(re, im) / n;
}
/** Energy in a band (Hz) of a stretch, by DFT bins. */
function band(x: Float32Array, lo: number, hi: number, from: number, to: number): number {
  let e = 0;
  for (let f = lo; f <= hi; f += 25) e += at(x, f, from, to) ** 2;
  return Math.sqrt(e);
}

test('the body: strongest from the air resonance to 300 Hz, falling above, and hardly radiating below the air resonance', () => {
  const peak = Math.max(...[100, 109, 150, 205, 248, 296].map(bodyAt));
  assert.ok(db(bodyAt(248) / peak) > -1.5, 'the 248 Hz mode is about the strongest');
  assert.ok(db(bodyAt(109) / peak) > -6, 'the air resonance');
  assert.ok(db(bodyAt(70) / bodyAt(109)) < -12, 'below the air resonance the body hardly radiates');
  const fall = db(bodyAt(2000) / bodyAt(250));
  assert.ok(fall < -8 && fall > -22, `falling ${fall.toFixed(1)} dB from 250 Hz to 2 kHz`);
  // Rich, not three peaks: between 500 Hz and 4 kHz the response rises and falls many times.
  let turns = 0, last = 0;
  for (let f = 500; f < 4000; f *= 1.004) {
    const d = bodyAt(f * 1.004) - bodyAt(f);
    if (last && Math.sign(d) !== Math.sign(last)) turns++;
    last = d;
  }
  assert.ok(turns >= 40, `${turns} turns between 500 Hz and 4 kHz`);
});

test('the decay: a low partial rings for seconds, the top goes in a fraction of one, faster on a wound string', () => {
  assert.ok(acousticDecay(82, 0) > 1 && acousticDecay(82, 0) < 4, 'the low E\'s fundamental, 1.8 to 3.5 dB/s measured');
  const k1 = acousticDecay(1000, 5);
  assert.ok(k1 > 15 && k1 < 32, `1 kHz at ${k1.toFixed(1)} dB/s`);
  assert.ok(acousticDecay(3000, 5) > 30 && acousticDecay(3000, 5) < 60, 'a plain string\'s 3 kHz');
  assert.ok(acousticDecay(3000, 0) > acousticDecay(3000, 5) + 10, 'a wound string\'s top dies sooner');
  assert.ok(acousticDecay(300, 5, true) > 400, 'a muted string dies at once');
});

test('a stroke is the same every time for its seed, and a muted rake is a thud that is gone in a moment', () => {
  const a = stroke({}), b = stroke({});
  assert.deepEqual(a, b);
  assert.ok(a.every(Number.isFinite));
  assert.notDeepEqual(stroke({}, 4), a, 'another take differs');
  const dead = stroke({ dead: true });
  assert.ok(rms(dead, 0.4, 0.8) < rms(a, 0.4, 0.8) * 0.02, 'the muted string stops');
  // What is left of a muted stroke after its click is the body's knock: its low modes.
  const low = band(dead, 90, 320, 0.02, 0.15), high = band(dead, 600, 3000, 0.02, 0.15);
  assert.ok(low > high, 'the knock rings in the body\'s low modes');
});

test('the open strings ring in sympathy after a fretted note is let go', () => {
  // A2 fretted on the low E: its fundamental is the open A string's, which keeps ringing once the hand lifts.
  const x = acousticString({ sr: SR, f: 110, seconds: 2, string: 0, fret: 5, pickMm: 150, layer: 1, end: 0.5 }, mulberry(9));
  const ring = acousticString({ sr: SR, f: 110, seconds: 2, string: 0, fret: 5, pickMm: 150, layer: 1 }, mulberry(9));
  assert.ok(rms(x, 1, 1.5) < rms(ring, 1, 1.5) * 0.5, 'the fretted note is damped');
  assert.ok(rms(x, 1, 1.5) > 1e-4, 'but not silent');
  assert.ok(at(x, 110, 1, 1.5) > at(x, 220, 1, 1.5), 'what rings on is the open string');
});

test('a slide squeaks on a wound string, and a fret buzz rattles the first moments of a hard stroke', () => {
  const plain = stroke({ f: 196, string: 3, fret: 0, layer: 2 }, 5), slid = stroke({ f: 196, string: 3, fret: 0, layer: 2, slide: true }, 5);
  assert.ok(band(slid, 1400, 2700, 0, 0.09) > band(plain, 1400, 2700, 0, 0.09) * 1.3, 'the squeak');
  const slidPlain = stroke({ f: 329.63, string: 5, fret: 0, layer: 2, slide: true }, 5), noSlide = stroke({ f: 329.63, string: 5, fret: 0, layer: 2 }, 5);
  assert.ok(band(slidPlain, 1400, 2700, 0, 0.09) / band(noSlide, 1400, 2700, 0, 0.09) < band(slid, 1400, 2700, 0, 0.09) / band(plain, 1400, 2700, 0, 0.09), 'fainter on a plain string');
  const buzz = stroke({ layer: 2, buzz: true }, 6), clean = stroke({ layer: 2 }, 6);
  assert.ok(band(buzz, 3000, 4800, 0.01, 0.07) > band(clean, 3000, 4800, 0.01, 0.07) * 1.3, 'the buzz');
});

test('a melody note is fingered on the highest string that reaches it within twelve frets', () => {
  assert.deepEqual(stringFor(64), { string: 5, fret: 0 });
  assert.deepEqual(stringFor(60), { string: 4, fret: 1 });
  assert.deepEqual(stringFor(57), { string: 3, fret: 2 });
  assert.deepEqual(stringFor(40), { string: 0, fret: 0 });
  assert.deepEqual(stringFor(84), { string: 5, fret: 20 });
});
