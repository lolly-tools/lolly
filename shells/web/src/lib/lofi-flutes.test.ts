// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blowFlute, type JetNote, type Pipe } from './lofi-flutes.ts';

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
