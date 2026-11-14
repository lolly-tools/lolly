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

test('every piece is finite and peaks inside full scale; soft and hard strokes share a peak (the player sets loudness)', () => {
  for (const spec of [K.RIDE, K.CRASH, K.SPLASH, K.CHINA, K.HAT_CLOSED, K.HAT_OPEN]) {
    const base = K.cymbalBase(spec, seeded(4));
    const soft = K.cymbal(SR, spec, base, 0.4, seeded(5));
    const hard = K.cymbal(SR, spec, base, 0.95, seeded(5));
    for (const x of [soft, hard]) assert.ok(x.every(Number.isFinite) && Math.abs(peak(x) - 0.9) < 1e-3);
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
  // The recorded ride is 27 dB under its first 50 ms at 1 to 1.2 s.
  const wash = 20 * Math.log10(rms(ride, 1, 1.2) / rms(ride, 0, 0.05));
  assert.ok(wash > -34 && wash < -20, `the ride keeps its wash: ${wash.toFixed(1)} dB at a second`);
  assert.ok(rms(hat, 0.2, 0.25) < rms(hat, 0, 0.02) * 0.01, 'the closed hat is choked');
  assert.ok(rms(open, 0.25, 0.3) > rms(hat, 0.25, 0.3) * 10, 'the open hat rings on');
});

test('a snare rings out and drops off; a floor tom rings longer than a high one', () => {
  const snare = K.snareStroke(SR, 200, 0.9, 1, 1, seeded(12));
  const attack = rms(snare, 0, 0.02);
  assert.ok(rms(snare, 0.08, 0.12) > attack * 0.02, 'the wires keep buzzing after the hit');
  // The recorded snare is 47 dB under its first 20 ms by 0.2 to 0.25 s.
  assert.ok(rms(snare, 0.2, 0.25) < attack * 0.01, 'and drop off');
  const high = K.tomStroke(SR, 190, 0.8, seeded(13));
  const floor = K.tomStroke(SR, 85, 0.8, seeded(13));
  assert.ok(rms(floor, 0.4, 0.5) / rms(floor, 0, 0.02) > rms(high, 0.4, 0.5) / rms(high, 0, 0.02));
});

test('a stroke\'s loudness follows its velocity, whichever recording plays it', async () => {
  const { strokeLevel } = await import('./lofi-drums.ts');
  let last = 0;
  for (let v = 0.05; v <= 1; v += 0.05) {
    const level = strokeLevel(v);
    assert.ok(level > last, `louder at ${v.toFixed(2)} than just below`);
    last = level;
  }
  // A ghost note at 0.25 sits 12 to 20 dB under an accent at 0.95.
  const under = 20 * Math.log10(strokeLevel(0.95) / strokeLevel(0.25));
  assert.ok(under > 12 && under < 20, `${under.toFixed(1)} dB under`);
});

/** How far a spectrum's strongest bins stand above its median between 2 and 8 kHz (dB), at `at` seconds: lines stand far above, a cymbal's dense modes do not (white noise is about 8). */
function lineStrength(x: Float32Array, at: number): number {
  const n = 4096, s = Math.floor(at * SR);
  const mags: number[] = [];
  for (let k = Math.ceil((2000 * n) / SR); k <= Math.floor((8000 * n) / SR); k += 2) {
    let re = 0, im = 0;
    const w = (2 * Math.PI * k) / n;
    for (let i = 0; i < n; i++) { const v = x[s + i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n)); re += v * Math.cos(w * i); im -= v * Math.sin(w * i); }
    mags.push(10 * Math.log10(re * re + im * im + 1e-20));
  }
  mags.sort((a, b) => a - b);
  return mags[Math.floor(mags.length * 0.99)]! - mags[Math.floor(mags.length / 2)]!;
}

test('a cymbal\'s spectrum holds lines over its dense partials, as a recorded one does: neither noise nor a few pure tones', () => {
  // Measured on a recorded kit: the ride's lines stand 30 to 31 dB over the median, the
  // crash's 24 to 28, at 0.05 and 0.3 s. White noise reads about 8; a handful of pure tones, over 40.
  const crash = K.cymbal(SR, K.CRASH, K.cymbalBase(K.CRASH, seeded(20)), 0.9, seeded(21));
  const ride = K.cymbal(SR, K.RIDE, K.cymbalBase(K.RIDE, seeded(20)), 0.65, seeded(21));
  for (const at of [0.05, 0.3]) {
    for (const [name, x] of [['crash', crash], ['ride', ride]] as const) {
      const lines = lineStrength(x, at);
      assert.ok(lines > 18 && lines < 36, `${name} at ${at} s: lines ${lines.toFixed(1)} dB`);
    }
  }
});

test('a press roll bounces as a recorded one does: the second contact as loud as the first, then about 16 a second, falling away', () => {
  const roll = K.buzzStroke(SR, 194, 0.95, 1, 1, seeded(24));
  assert.ok(roll.every(Number.isFinite) && peak(roll) <= 0.951);
  // The recorded fast roll: contacts at 10, 96, 156, 220 and 286 ms, the second level with the first, 20 dB down by 0.24 s.
  const first = rms(roll, 0, 0.02), second = rms(roll, 0.085, 0.105);
  assert.ok(second > first * 0.5, `the press: ${(20 * Math.log10(second / first)).toFixed(1)} dB`);
  assert.ok(rms(roll, 0.3, 0.34) < first * 0.1, 'and the bounces die away');
  // The stick held on the head damps its lowest motion: the recorded roll's band under 90 Hz
  // is some 15 dB further down than a single stroke's. Measured by four one-pole low-passes at 60 Hz.
  const lowShare = (x: Float32Array): number => {
    const k = 1 - Math.exp((-2 * Math.PI * 60) / SR);
    const y = [0, 0, 0, 0];
    let lo = 0, all = 0;
    for (const v of x) {
      y[0]! += k * (v - y[0]!); y[1]! += k * (y[0]! - y[1]!); y[2]! += k * (y[1]! - y[2]!); y[3]! += k * (y[2]! - y[3]!);
      lo += y[3]! * y[3]!; all += v * v;
    }
    return lo / all;
  };
  const under = 10 * Math.log10(lowShare(roll) / lowShare(K.snareStroke(SR, 194, 0.95, 1, 1, seeded(24))));
  assert.ok(under < -10, `the roll's low end against a single stroke's: ${under.toFixed(1)} dB`);
});

test('a tom struck hard starts well sharp and falls back into pitch, as a recorded tom does', () => {
  // Measured on an acoustic kit's toms: a hard stroke averages 30 to 44 per cent sharp over its
  // first 50 ms, a soft one a few per cent, and both are back within a few per cent by 0.4 s.
  const pitchOf = (x: Float32Array, at: number, lo: number, hi: number): number => {
    let best = 0, bf = 0;
    for (let f = lo; f <= hi; f += 0.5) {
      const w = (2 * Math.PI * f) / SR; let re = 0, im = 0;
      for (let i = Math.floor(at * SR); i < Math.floor((at + 0.04) * SR); i++) { re += x[i]! * Math.cos(w * i); im += x[i]! * Math.sin(w * i); }
      if (re * re + im * im > best) { best = re * re + im * im; bf = f; }
    }
    return bf;
  };
  const hard = K.tomStroke(SR, 110, 0.95, seeded(22));
  const soft = K.tomStroke(SR, 110, 0.3, seeded(22));
  const sharp = (x: Float32Array) => pitchOf(x, 0.002, 100, 170) / 110 - 1;
  assert.ok(sharp(hard) > 0.15, `a hard stroke starts ${(sharp(hard) * 100).toFixed(1)} per cent sharp`);
  assert.ok(sharp(soft) < sharp(hard) * 0.75, `a soft one less: ${(sharp(soft) * 100).toFixed(1)} per cent`);
  const settled = pitchOf(hard, 0.4, 100, 130);
  assert.ok(Math.abs(settled / 110 - 1) < 0.03, `settled at ${settled} Hz`);
});

test('a tom has a stick attack above 1 kHz, more for a hard stroke, and a low ring after', () => {
  const hard = K.tomStroke(SR, 110, 0.95, seeded(23));
  const soft = K.tomStroke(SR, 110, 0.3, seeded(23));
  const early = (x: Float32Array) => highShare(x.subarray(0, Math.floor(0.03 * SR)), 1000);
  assert.ok(early(hard) > 0.03, `${(early(hard) * 100).toFixed(1)} per cent of a hard stroke's first 30 ms is above 1 kHz`);
  assert.ok(early(soft) < early(hard) * 0.5, `a soft stroke's is less: ${(early(soft) * 100).toFixed(1)} per cent`);
  // The one-pole high-pass lets the 110 Hz ring through at about 1 per cent, so the late share is set against the attack's.
  const late = highShare(hard.subarray(Math.floor(0.3 * SR), Math.floor(0.6 * SR)), 1000);
  assert.ok(late < early(hard) * 0.2, `after a few tenths of a second only the low ring is left (${(late * 100).toFixed(1)} per cent)`);
});

/** Energy (dB) between `lo` and `hi` Hz over `from` to `to` s, by a DFT in 2 Hz steps. */
function bandDb(x: Float32Array, lo: number, hi: number, from: number, to: number): number {
  let sum = 0;
  for (let f = lo; f <= hi; f += 2) {
    const w = (2 * Math.PI * f) / SR; let re = 0, im = 0;
    for (let i = Math.floor(from * SR); i < Math.floor(to * SR); i++) { re += x[i]! * Math.cos(w * i); im += x[i]! * Math.sin(w * i); }
    sum += re * re + im * im;
  }
  return 10 * Math.log10(sum + 1e-30);
}

test('a tom rings about a second and a half, as the recorded FW toms do, not two and a half', () => {
  for (const f0 of [129, 98]) {
    const x = K.tomStroke(SR, f0, 0.75, seeded(31));
    const fall = 20 * Math.log10(rms(x, 0.05, 0.1) / rms(x, 1.1, 1.3));
    assert.ok(fall > 35, `${f0} Hz: ${fall.toFixed(1)} dB down by 1.1 s`);
  }
});

test('a medium tom stroke starts about 12 per cent sharp, as the recorded FW toms do', () => {
  const x = K.tomStroke(SR, 129, 0.75, seeded(32));
  let best = 0, bf = 0;
  for (let f = 120; f <= 175; f += 0.5) {
    const w = (2 * Math.PI * f) / SR; let re = 0, im = 0;
    for (let i = Math.floor(0.005 * SR); i < Math.floor(0.035 * SR); i++) { re += x[i]! * Math.cos(w * i); im += x[i]! * Math.sin(w * i); }
    if (re * re + im * im > best) { best = re * re + im * im; bf = f; }
  }
  const sharp = bf / 129 - 1;
  assert.ok(sharp > 0.06 && sharp < 0.2, `${(sharp * 100).toFixed(1)} per cent sharp (recorded: 12.5)`);
});

test('a high tom leads with its fundamental; a floor tom with the modes near twice its pitch', () => {
  const high = K.tomStroke(SR, 129, 0.75, seeded(33));
  assert.ok(bandDb(high, 118, 150, 0.01, 0.07) > bandDb(high, 240, 300, 0.01, 0.07) + 6, 'the high tom: the fundamental over the second');
  const floor = K.tomStroke(SR, 70, 0.75, seeded(33));
  assert.ok(bandDb(floor, 130, 200, 0.01, 0.07) > bandDb(floor, 62, 82, 0.01, 0.07), 'the floor tom: the modes near twice its pitch over its fundamental');
});
