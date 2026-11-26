// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bowString, bowSource, type BowNote } from './lofi-bowed.ts';

const SR = 44100;
const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
function seeded(a: number): () => number {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const note = (midi: number, vel: number, more: Partial<BowNote> = {}): BowNote => ({ sr: SR, f: mtof(midi), vel, dur: 0.8, seconds: 1.1, vibrato: 0, rate: 5.6, slide: 0, ...more });
/** A harmonic's level (dB) between `a` and `b` seconds. */
function harmonic(x: Float32Array, f: number, h: number, a = 0.35, b = 0.75): number {
  const w = (2 * Math.PI * f * h) / SR;
  let re = 0, im = 0;
  for (let i = Math.floor(a * SR); i < Math.floor(b * SR); i++) { re += x[i]! * Math.cos(w * i); im += x[i]! * Math.sin(w * i); }
  return 10 * Math.log10(re * re + im * im + 1e-20);
}
/** The fundamental's pitch in cents from `f`, by a fine search over the held part. */
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
/** The amplitude-weighted mean harmonic number over the first `k` harmonics: how bright the note is. */
function centroid(x: Float32Array, f: number, k = 12): number {
  let num = 0, den = 0;
  for (let h = 1; h <= k; h++) { const a = 10 ** (harmonic(x, f, h) / 20); num += h * a; den += a; }
  return num / den;
}

test('the bowed string speaks at its note across the fiddle\'s range and strengths, in Helmholtz motion', () => {
  for (const midi of [60, 64, 69, 74, 79, 84]) for (const vel of [0.25, 0.85]) {
    const x = bowString(note(midi, vel), seeded(midi));
    assert.ok(x.every(Number.isFinite), `${midi} ${vel}: finite`);
    assert.ok(rms(x, 0.35, 0.75) > 1e-3, `${midi} ${vel}: it sounds`);
    const c = cents(x, mtof(midi));
    assert.ok(Math.abs(c) <= 10, `${midi} ${vel}: ${c} cents`);
    // The string's own force on the bridge is a sawtooth: the fundamental leads (not the octave, as in a double slip).
    const s = bowSource(note(midi, vel), seeded(midi));
    assert.ok(harmonic(s, mtof(midi), 1) > harmonic(s, mtof(midi), 2), `${midi} ${vel}: the fundamental leads the string`);
  }
});

test('bowed harder, the fiddle gets brighter (recorded violins: the upper harmonics climb about 8 dB from pp to ff)', () => {
  let soft = 0, loud = 0, n = 0;
  for (const midi of [67, 72, 77]) for (const seed of [1, 2]) {
    const f = mtof(midi);
    const s = bowString(note(midi, 0.25), seeded(seed)), l = bowString(note(midi, 0.85), seeded(seed));
    // The 5th to 8th harmonics against the first two.
    const top = (x: Float32Array): number => [5, 6, 7, 8].reduce((a, h) => a + harmonic(x, f, h), 0) / 4 - (harmonic(x, f, 1) + harmonic(x, f, 2)) / 2;
    soft += top(s); loud += top(l); n++;
  }
  soft /= n; loud /= n;
  assert.ok(loud > soft + 3, `upper harmonics ${soft.toFixed(1)} -> ${loud.toFixed(1)} dB`);
  const f = mtof(74), c = centroid(bowString(note(74, 0.6), seeded(3)), f);
  assert.ok(c > 1.6 && c < 3.8, `centroid ${c.toFixed(2)}`);
});

test('a stroke starts under the note and takes tens of milliseconds to speak', () => {
  const x = bowString(note(74, 0.6, { dur: 0.6, seconds: 0.8 }), seeded(4));
  const steady = rms(x, 0.3, 0.5);
  assert.ok(rms(x, 0, 0.005) < steady * 0.5, 'under the note at the very start');
  assert.ok(rms(x, 0.01, 0.03) < steady * 0.5, 'still well under the note 30 ms in');
  assert.ok(rms(x, 0.15, 0.2) > steady * 0.6, 'near full by 150 ms');
  // A slurred note changes under the same bow: it sounds at once.
  const slur = bowString(note(74, 0.6, { from: mtof(72), dur: 0.6, seconds: 0.8 }), seeded(4));
  assert.ok(rms(slur, 0.005, 0.02) > rms(x, 0.005, 0.02) * 2, 'a slur sounds at once');
  assert.ok(Math.abs(cents(slur, mtof(74))) <= 10, 'and arrives in tune');
});

test('vibrato makes the harmonics rise and fall through the body (a still note barely moves)', () => {
  const f = mtof(76);
  const flux = (x: Float32Array): number => {
    // How much the 3rd to 6th harmonics' levels swing against each other, frame to frame.
    const frames: number[][] = [];
    for (let a = 0.4; a < 1.3; a += 0.02) frames.push([3, 4, 5, 6].map((h) => harmonic(x, f, h, a, a + 0.04) - harmonic(x, f, 1, a, a + 0.04)));
    let s = 0;
    for (let h = 0; h < 4; h++) { const v = frames.map((r) => r[h]!); const m = v.reduce((p, q) => p + q, 0) / v.length; s += Math.sqrt(v.reduce((p, q) => p + (q - m) ** 2, 0) / v.length); }
    return s / 4;
  };
  const still = bowString(note(76, 0.6, { dur: 1.4, seconds: 1.5 }), seeded(5));
  const sung = bowString(note(76, 0.6, { dur: 1.4, seconds: 1.5, vibrato: 12 }), seeded(5));
  assert.ok(flux(sung) > flux(still) + 0.8, `flux ${flux(still).toFixed(2)} -> ${flux(sung).toFixed(2)} dB`);
});

test('the same note bows the same; the string rings on into the body and dies away when the bow lifts', () => {
  assert.deepEqual(bowString(note(72, 0.6), seeded(6)), bowString(note(72, 0.6), seeded(6)));
  const x = bowString(note(72, 0.6, { dur: 0.3, seconds: 1 }), seeded(7));
  const held = rms(x, 0.15, 0.28);
  assert.ok(rms(x, 0.32, 0.36) > held * 0.05, 'it rings a moment after the bow lifts');
  assert.ok(rms(x, 0.85, 0.95) < held * 0.01, 'and is gone well within a second');
});

/** A harmonic's level (dB) over samples a..b, by Goertzel's recurrence (no trig per sample). */
function goertzel(x: Float32Array, hz: number, a: number, b: number): number {
  const w = (2 * Math.PI * hz) / SR, c = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = a; i < b; i++) { const s0 = x[i]! + c * s1 - s2; s2 = s1; s1 = s0; }
  return 10 * Math.log10(s1 * s1 + s2 * s2 - c * s1 * s2 + 1e-30);
}

/**
 * Whether the string's force on the bridge has left Helmholtz motion anywhere from `from`
 * s on: in a window, the 2nd harmonic over the fundamental by more than 1 dB, or the wave
 * nearly repeating at half its period (an octave). A sawtooth's fundamental leads by 6 dB
 * and its half-period correlation is about -0.5.
 */
function jumped(x: Float32Array, f: number, from: number): string | undefined {
  const T = SR / f, win = Math.max(Math.round(4 * T), Math.round(0.03 * SR));
  const L = Math.floor(T / 2), fr = T / 2 - L;
  for (let a = Math.round(from * SR); a + win + L + 2 < x.length; a += win) {
    const d = goertzel(x, f, a, a + win) - goertzel(x, 2 * f, a, a + win);
    let xy = 0, xx = 0, yy = 0;
    for (let i = a; i < a + win; i++) { const y = x[i + L]! * (1 - fr) + x[i + L + 1]! * fr; xy += x[i]! * y; xx += x[i]! * x[i]!; yy += y * y; }
    const half = xy / Math.sqrt(xx * yy + 1e-30);
    if (d < -1 || half > 0.5) return `at ${(a / SR).toFixed(2)} s: 2nd harmonic ${(-d).toFixed(1)} dB over the fundamental, half-period correlation ${half.toFixed(2)}`;
  }
  return undefined;
}

test('the fiddle never jumps an octave: every semitone it plays, every strength, slurred, slid and plain', () => {
  // What the composer hands the fiddle (country, straya, or any style a link chooses it for):
  // E4 to C6, at strengths 0.27 to 0.9 (0.1 to 1 here), 4 in 10 notes slurred, many slid.
  // Odd seeds slur in from one of eight intervals; even seeds start a stroke, every other
  // one slid up from a semitone under, every fourth with vibrato.
  const intervals = [-2, 3, -5, 7, -12, 1, 4, -3];
  const bad: string[] = [];
  for (let midi = 64; midi <= 84; midi++) for (let v = 1; v <= 10; v++) for (let seed = 1; seed <= 8; seed++) {
    const vel = v / 10, f = mtof(midi), rand = seeded(seed * 7919 + midi * 31 + v);
    const slurred = seed % 2 === 1, slide = !slurred && seed % 4 === 2 ? 1 : 0;
    const from = slurred ? mtof(midi + intervals[(seed + midi) % 8]!) : undefined;
    const x = bowSource(note(midi, vel, { dur: 0.25, seconds: 0.25, from, slide, vibrato: seed % 8 === 0 ? 13 : 0 }), rand);
    const why = jumped(x, f, slide ? 0.16 : 0.06);
    if (why) bad.push(`${midi} at ${vel}${slurred ? ' slurred' : slide ? ' slid' : ''}, seed ${seed}: ${why}`);
  }
  assert.deepEqual(bad, [], `${bad.length} notes left Helmholtz motion:\n${bad.slice(0, 12).join('\n')}`);
});
