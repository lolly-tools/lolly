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

test('a tongued note puffs as the jet is let go, every puff its own; a slur does not; a quick note stays airy', () => {
  // The air above about 3 kHz (a second difference) in a window, as energy.
  const high = (y: Float32Array, a: number, b: number): number => { let e = 0, p1 = 0, p2 = 0; for (let i = Math.floor(a * SR); i < Math.floor(b * SR); i++) { const h = y[i]! - 2 * p1 + p2; p2 = p1; p1 = y[i]!; e += h * h; } return e / ((b - a) * SR); };
  const quick = (more: Partial<JetNote>, seed: number): Float32Array => blowFlute(note('open', 76, 0.6, { dur: 0.15, seconds: 0.3, ...more }), seeded(seed));
  // Recorded runs: the air above 4 kHz jumps 3 to 7 dB over the note's own for a few milliseconds at each tongued onset.
  const tu = quick({ burst: {} }, 14);
  const jump = 10 * Math.log10(high(tu, 0.001, 0.009) / high(tu, 0.06, 0.12));
  assert.ok(jump > 3, `the puff stands ${jump.toFixed(1)} dB over the note's own air`);
  const slur = quick({ from: mtof(74) }, 14);
  assert.ok(10 * Math.log10(high(slur, 0.001, 0.009) / high(slur, 0.06, 0.12)) < jump - 3, 'a slur keeps the jet going: no puff');
  const other = quick({ burst: {} }, 15);
  assert.notEqual(high(tu, 0.001, 0.009).toFixed(6), high(other, 0.001, 0.009).toFixed(6), 'each puff is its own');
  // An unsettled jet keeps a quick note airy: recorded quick notes carry 4 to 9 dB more air against the tone than slow ones.
  const settled = quick({ burst: null }, 16), unsettled = quick({ burst: null, unsettled: 2.5 }, 16);
  const f = mtof(76);
  assert.ok(breath(unsettled, f, 0.03, 0.14) > breath(settled, f, 0.03, 0.14) + 3, 'the unsettled jet is airier');
});

test('a breath running out: more air against the tone, and the breath wobbling more', () => {
  const f = mtof(74);
  const held = (more: Partial<JetNote>): Float32Array => blowFlute(note('open', 74, 0.5, { dur: 1.2, seconds: 1.3, burst: null, ...more }), seeded(21));
  const fresh = held({}), spent = held({ airDb: 4 });
  const more = breath(spent, f, 0.3, 1.1) - breath(fresh, f, 0.3, 1.1);
  assert.ok(more > 2.5 && more < 5.5, `the air rises ${more.toFixed(1)} dB against the tone`);
  // The level's wobble over the held part (50 ms frames, dB).
  const wobble = (x: Float32Array): number => { const L: number[] = []; for (let a = 0.3; a < 1.1; a += 0.05) L.push(20 * Math.log10(rms(x, a, a + 0.05))); const m = L.reduce((p, v) => p + v, 0) / L.length; return Math.sqrt(L.reduce((p, v) => p + (v - m) ** 2, 0) / L.length); };
  assert.ok(wobble(held({ shake: 0.7 })) > 1.2 * wobble(fresh), `wobble ${wobble(fresh).toFixed(2)} dB fresh, ${wobble(held({ shake: 0.7 })).toFixed(2)} running out`);
});

test('the flute\'s low notes are rich and its harmonics fall away over the tone holes\' cutoff, as recorded flutes\' do', () => {
  // Recorded at mezzo-forte: C4 to F#4 carry their 2nd to 5th harmonics 3 to 10 dB under the 1st; over about 1.5 kHz the harmonics drop away.
  const low = blowFlute(note('open', 60, 0.5, { burst: null }), seeded(31)), f = mtof(60);
  const h = (x: Float32Array, fr: number, k: number): number => harmonic(x, fr, k) - harmonic(x, fr, 1);
  for (const k of [2, 3, 4, 5]) assert.ok(h(low, f, k) > -18, `C4's harmonic ${k} at ${h(low, f, k).toFixed(1)} dB`);
  const mid = blowFlute(note('open', 74, 0.5, { burst: null }), seeded(32)), g = mtof(74);
  // D5: its 3rd (1.76 kHz) still rings; its 4th (2.35 kHz) is over the cutoff.
  assert.ok(h(mid, g, 3) - h(mid, g, 4) > 8, `D5's 4th ${(h(mid, g, 3) - h(mid, g, 4)).toFixed(1)} dB under its 3rd`);
});
