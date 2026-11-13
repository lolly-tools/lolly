// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blowFlute, inhale, type JetNote, type Pipe } from './lofi-flutes.ts';

const SR = 44100;
const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
function seeded(a: number): () => number {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const note = (pipe: Pipe, midi: number, vel: number, more: Partial<JetNote> = {}): JetNote => ({ sr: SR, f: mtof(midi), vel, dur: 0.8, seconds: 1, pipe, vibrato: 0, rate: 5, scoop: 0, ...more });
/** A harmonic's level (dB) between `a` and `b` seconds. */
function harmonic(x: Float32Array, f: number, h: number, a = 0.3, b = 0.7): number {
  const w = (2 * Math.PI * f * h) / SR;
  let re = 0, im = 0;
  for (let i = Math.floor(a * SR); i < Math.floor(b * SR); i++) { re += x[i]! * Math.cos(w * i); im += x[i]! * Math.sin(w * i); }
  return 10 * Math.log10(re * re + im * im + 1e-20);
}
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
/** Energy between the harmonics against energy on them, 1 to 8 kHz (dB): how breathy the note is. */
function breath(x: Float32Array, f: number, a: number, b: number): number {
  let on = 0, off = 0, nOn = 0, nOff = 0;
  const n = Math.floor((b - a) * SR), i0 = Math.floor(a * SR);
  for (let hz = 1000; hz < 8000; hz += 10) {
    const w = (2 * Math.PI * hz) / SR;
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) { const win = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n); re += x[i0 + i]! * win * Math.cos(w * i); im += x[i0 + i]! * win * Math.sin(w * i); }
    const p = re * re + im * im, h = hz / f;
    if (Math.abs(h - Math.round(h)) * f < Math.max(25, 0.08 * f)) { on += p; nOn++; } else { off += p; nOff++; }
  }
  return 10 * Math.log10((off / nOff) / (on / nOn));
}

test('the flute and the pan flute speak at their notes over the leads\' range and strengths', () => {
  for (const pipe of ['open', 'stopped'] as const) for (const midi of [60, 65, 70, 75, 80, 84]) for (const vel of [0.25, 0.8]) {
    const x = blowFlute(note(pipe, midi, vel), seeded(midi));
    assert.ok(x.every(Number.isFinite), `${pipe} ${midi} ${vel}: finite`);
    assert.ok(rms(x, 0.3, 0.7) > 1e-3, `${pipe} ${midi} ${vel}: it sounds`);
    const c = cents(x, mtof(midi));
    assert.ok(Math.abs(c) <= 10, `${pipe} ${midi} ${vel}: ${c} cents`);
  }
});

test('blown harder, the flute fills out (recorded: 2nd harmonic about -18 dB softly, -7 loud)', () => {
  const f = mtof(76);
  const h2 = (vel: number): number => { const x = blowFlute(note('open', 76, vel), seeded(3)); return harmonic(x, f, 2) - harmonic(x, f, 1); };
  const h3 = (vel: number): number => { const x = blowFlute(note('open', 76, vel), seeded(3)); return harmonic(x, f, 3) - harmonic(x, f, 1); };
  assert.ok(h2(0.85) > h2(0.2) + 3, `h2 ${h2(0.2).toFixed(1)} -> ${h2(0.85).toFixed(1)}`);
  assert.ok(h3(0.85) > h3(0.2) + 3, `h3 ${h3(0.2).toFixed(1)} -> ${h3(0.85).toFixed(1)}`);
  assert.ok(h2(0.2) < -10 && h2(0.85) > -14, 'within the recorded range');
});

test('the pan flute\'s stopped pipe favours the odd harmonics, and it is breathier than the flute', () => {
  const f = mtof(74);
  const pan = blowFlute(note('stopped', 74, 0.5), seeded(4));
  assert.ok(harmonic(pan, f, 3) > harmonic(pan, f, 2) + 4, 'the 3rd over the 2nd');
  assert.ok(harmonic(pan, f, 3) > harmonic(pan, f, 4) + 4, 'the 3rd over the 4th');
  const fl = blowFlute(note('open', 74, 0.5), seeded(4));
  assert.ok(harmonic(fl, f, 2) > harmonic(fl, f, 3), 'the flute\'s 2nd over its 3rd');
  // Recorded: the flute's breath about -30 dB under its harmonics (1 to 8 kHz), the pan flute's about -15.
  const bf = breath(fl, f, 0.3, 0.6), bp = breath(pan, f, 0.3, 0.6);
  assert.ok(bf > -40 && bf < -22, `flute breath ${bf.toFixed(1)} dB`);
  assert.ok(bp > bf + 8, `pan flute breath ${bp.toFixed(1)} dB`);
});

test('a tongued note starts with a puff of air and speaks within about a tenth of a second; a slur glides in', () => {
  const f = mtof(76);
  const x = blowFlute(note('open', 76, 0.5), seeded(5));
  const steady = rms(x, 0.3, 0.6);
  assert.ok(rms(x, 0.15, 0.2) > steady * 0.6, 'near full by 150 ms');
  assert.ok(breath(x, f, 0.005, 0.035) > breath(x, f, 0.3, 0.6) + 8, 'the chiff: the front is breathier than the held note');
  const slur = blowFlute(note('open', 76, 0.5, { from: mtof(74) }), seeded(5));
  assert.ok(rms(slur, 0.003, 0.02) > rms(x, 0.003, 0.02), 'a slur sounds at once');
  assert.ok(Math.abs(cents(slur, f)) <= 10, 'and arrives in tune');
});

test('the same note blows the same; it ends when the breath stops', () => {
  assert.deepEqual(blowFlute(note('open', 72, 0.6), seeded(6)), blowFlute(note('open', 72, 0.6), seeded(6)));
  for (const pipe of ['open', 'stopped'] as const) {
    const x = blowFlute(note(pipe, 72, 0.6, { dur: 0.3, seconds: 0.8 }), seeded(7));
    assert.ok(rms(x, 0.6, 0.7) < rms(x, 0.15, 0.25) * 0.01, `${pipe}: silent after the release`);
  }
});

/** Energy between the harmonics in a band (Hz), against the note's harmonics, from a whole-window DFT (dB). */
function band(x: Float32Array, f: number, a: number, b: number, lo: number, hi: number): number {
  const n = Math.floor((b - a) * SR), i0 = Math.floor(a * SR);
  let off = 0, nOff = 0, harm = 0;
  for (let hz = 200; hz < 12000; hz += 5) {
    const w = (2 * Math.PI * hz) / SR;
    let re = 0, im = 0;
    for (let i = 0; i < n; i += 2) { const win = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n); re += x[i0 + i]! * win * Math.cos(w * i); im += x[i0 + i]! * win * Math.sin(w * i); }
    const p = re * re + im * im, h = hz / f, near = Math.abs(h - Math.round(h)) * f < Math.max(25, 0.08 * f);
    if (near) harm += p; else if (hz >= lo && hz < hi) { off += p; nOff++; }
  }
  return 10 * Math.log10((off / Math.max(1, nOff)) * ((hi - lo) / 5) / harm);
}

test('the flute\'s breath sits in the middle, as a player\'s does, and pulses with the pitch', () => {
  const f = mtof(76);
  const x = blowFlute(note('open', 76, 0.5, { dur: 0.9, seconds: 1 }), seeded(9));
  // Recorded: the breath between the harmonics peaks near 1.6 to 2.5 kHz, 13 dB over 500 Hz and 5 to 9 over 8 kHz.
  const low = band(x, f, 0.3, 0.8, 450, 560), mid = band(x, f, 0.3, 0.8, 1600, 2500), top = band(x, f, 0.3, 0.8, 7000, 9000);
  assert.ok(mid > low + 6, `the middle over 500 Hz (${mid.toFixed(1)} against ${low.toFixed(1)})`);
  assert.ok(mid > top + 3, `the middle over 8 kHz (${mid.toFixed(1)} against ${top.toFixed(1)})`);
  // The breath above 4 kHz swells and fades once a period (recorded 20 to 43 dB at the pitch; a steady hiss reads under 25).
  const a = Math.floor(0.3 * SR), n = Math.floor(0.5 * SR);
  const env = new Float64Array(n);
  let hp1 = 0, hp2 = 0;
  for (let i = 0; i < n; i++) { const v = x[a + i]!; const h = v - 2 * hp1 + hp2; hp2 = hp1; hp1 = v; env[i] = h * h; }
  const pulse = (hz: number): number => { const w = (2 * Math.PI * hz) / SR; let re = 0, im = 0; for (let i = 0; i < n; i++) { re += env[i]! * Math.cos(w * i); im += env[i]! * Math.sin(w * i); } return re * re + im * im; };
  const at = pulse(f), beside = (pulse(f * 0.73) + pulse(f * 1.31)) / 2;
  assert.ok(10 * Math.log10(at / beside) > 15, `the breath pulses at the pitch (${(10 * Math.log10(at / beside)).toFixed(1)} dB over its neighbours)`);
});

test('a tongued note starts a little sharp; a tongue stop ends it at once; let go, the air outlasts the tone', () => {
  const f = mtof(74);
  const x = blowFlute(note('open', 74, 0.5, { dur: 0.5, seconds: 0.8 }), seeded(10));
  const at = (c: number, a: number, b: number): number => harmonic(x, f * 2 ** (c / 1200), 1, a, b);
  let best = -Infinity, sharp = 0;
  for (let c = -30; c <= 40; c += 1) { const p = at(c, 0.005, 0.04); if (p > best) { best = p; sharp = c; } }
  assert.ok(sharp >= 3 && sharp <= 30, `the tongue's push starts it ${sharp} cents sharp (recorded 3 to 30)`);
  const stopped = blowFlute(note('open', 74, 0.5, { dur: 0.5, seconds: 0.8, stop: true }), seeded(10));
  const held = rms(x, 0.3, 0.45);
  // Recorded tongued changes dip 7 to 30 dB in 5 to 60 ms; the pipe rings on a moment after the tongue blocks the jet.
  assert.ok(rms(stopped, 0.53, 0.56) < held * 0.3, 'stopped by the tongue, it is 10 dB down within 60 ms');
  assert.ok(rms(x, 0.53, 0.56) > rms(stopped, 0.53, 0.56) * 1.8, 'let go, it fades more slowly');
  // After the breath is let go the tone dies faster than the air: the breath's share of what is left rises.
  assert.ok(breath(x, f, 0.56, 0.62) > breath(x, f, 0.3, 0.45) + 6, 'the air outlasts the tone');
});

test('a half-tongued note speaks more softly than a tongued one; a swell rises and a taper falls', () => {
  const tu = blowFlute(note('open', 76, 0.5), seeded(11)), du = blowFlute(note('open', 76, 0.5, { tongue: 0.4 }), seeded(11));
  // The air above 3 kHz in the first 30 ms (a second difference): the "du" lets less of the chiff through.
  const front = (y: Float32Array): number => { let s2 = 0, p1 = 0, p2 = 0; for (let i = 0; i < 0.03 * SR; i++) { const h = y[i]! - 2 * p1 + p2; p2 = p1; p1 = y[i]!; s2 += h * h; } return s2; };
  assert.ok(front(du) < front(tu), 'the "du" puffs less at the front');
  assert.ok(rms(du, 0, 0.02) < rms(tu, 0, 0.02), 'and comes in more gently');
  const swell = blowFlute(note('open', 76, 0.5, { dur: 1.2, seconds: 1.3, contour: 3 }), seeded(12));
  const taper = blowFlute(note('open', 76, 0.5, { dur: 1.2, seconds: 1.3, contour: -4 }), seeded(12));
  const rise = (x: Float32Array): number => 20 * Math.log10(rms(x, 0.95, 1.15) / rms(x, 0.2, 0.4));
  assert.ok(rise(swell) > 1 && rise(taper) < -1.5, `swell ${rise(swell).toFixed(1)} dB, taper ${rise(taper).toFixed(1)} dB`);
});

test('a breath between phrases is a soft rush of air in the middle of the band', () => {
  const x = inhale(SR, 0.3, seeded(13));
  assert.equal(x.length, Math.round(0.3 * SR));
  assert.ok(x.every(Number.isFinite));
  assert.ok(rms(x, 0.1, 0.18) > rms(x, 0, 0.02) * 2 && rms(x, 0.1, 0.18) > rms(x, 0.28, 0.3) * 2, 'it swells and fades');
  const level = (hz: number): number => { const w = (2 * Math.PI * hz) / SR; let re = 0, im = 0; for (let i = 0; i < x.length; i++) { re += x[i]! * Math.cos(w * i); im += x[i]! * Math.sin(w * i); } return re * re + im * im; };
  let mid = 0, low = 0;
  for (let hz = 1100; hz < 1700; hz += 20) mid += level(hz);
  for (let hz = 100; hz < 700; hz += 20) low += level(hz);
  assert.ok(mid > low * 4, 'its rush sits in the middle, not the bottom');
});
