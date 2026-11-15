// SPDX-License-Identifier: MPL-2.0
/**
 * The dizi (lib/lofi-dizi.ts): the jet flute through the dimo. The membrane brings up the
 * odd harmonics in the upper middle, as recorded dizi carry them, and leaves the note in
 * tune; the player's ornaments go where the composer bends a note.
 *
 * Run directly: node --test shells/web/src/lib/lofi-dizi.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blowFlute, FLUTE_BREATH, FLUTE_PLAYED, FLUTE_SCOOP, type JetNote } from './lofi-flutes.ts';
import { blowDizi, diziPlay, flutterTongue, DIZI_PLAYER } from './lofi-dizi.ts';

const SR = 44100;
const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
function seeded(a: number): () => number {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const jet = (midi: number, vel: number): Omit<JetNote, 'pipe'> => ({ sr: SR, f: mtof(midi), vel, dur: 1.2, seconds: 1.4, vibrato: 0, rate: 5, scoop: 0 });

function goertzel(x: Float32Array, hz: number, a: number, b: number): number {
  const w = (2 * Math.PI * hz) / SR, c = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = a; i < b; i++) { const s0 = x[i]! + c * s1 - s2; s2 = s1; s1 = s0; }
  return 10 * Math.log10(s1 * s1 + s2 * s2 - c * s1 * s2 + 1e-30);
}
/** Harmonic `h`'s level (dB) over the steady part: its power in 0.1 s windows, each the best of five filters a few cents apart, averaged. */
function harmonic(x: Float32Array, f: number, h: number): number {
  let p = 0, n = 0;
  for (let t = 0.4; t + 0.1 <= 1.0 + 1e-9; t += 0.1, n++) {
    let best = -Infinity;
    for (const c of [-10, -5, 0, 5, 10]) best = Math.max(best, goertzel(x, f * h * 2 ** (c / 1200), Math.floor(t * SR), Math.floor((t + 0.1) * SR)));
    p += 10 ** (best / 10);
  }
  return 10 * Math.log10(p / n);
}
/** Harmonics 1 to 8 against their total (dB). */
function shape(x: Float32Array, f: number): number[] {
  const lv = [1, 2, 3, 4, 5, 6, 7, 8].map(h => harmonic(x, f, h));
  const total = 10 * Math.log10(lv.reduce((s, v) => s + 10 ** (v / 10), 0));
  return lv.map(v => v - total);
}

test('the dimo brings up the odd harmonics in the upper middle, as recorded dizi carry them', () => {
  // Recorded dizi (the FolkMusic dataset's clips and CC0 Freesound phrases and notes), E5 to A♯5, harmonics 1 to 8 against
  // their total: the fifth and the seventh stand up where a Western flute's fall away, the even ones stay near a flute's.
  const want = [-1.2, -13.3, -13.7, -26.8, -16.7, -28.4, -15.8, -30.9];
  const dizi = new Array(8).fill(0), flute = new Array(8).fill(0);
  const midis = [76, 77, 79, 81];
  for (const midi of midis) for (const vel of [0.6, 0.85]) {
    const f = mtof(midi);
    shape(blowDizi(jet(midi, vel), seeded(midi)), f).forEach((v, k) => { dizi[k] += 10 ** (v / 20); });
    shape(blowFlute({ ...jet(midi, vel), pipe: 'open' }, seeded(midi)), f).forEach((v, k) => { flute[k] += 10 ** (v / 20); });
  }
  const d = dizi.map(v => 20 * Math.log10(v / (midis.length * 2))), fl = flute.map(v => 20 * Math.log10(v / (midis.length * 2)));
  const rms = Math.sqrt(d.reduce((s, v, k) => s + (v - want[k]!) ** 2, 0) / 8);
  const rmsFlute = Math.sqrt(fl.reduce((s, v, k) => s + (v - want[k]!) ** 2, 0) / 8);
  assert.ok(rms < 6, `the dizi ${rms.toFixed(1)} dB rms from the recordings\n got  ${d.map(v => v.toFixed(1)).join(' ')}\n want ${want.join(' ')}`);
  assert.ok(rmsFlute - rms > 4, `nearer the recordings than the flute it is built on (${rmsFlute.toFixed(1)} dB)`);
  assert.ok((d[4]! - fl[4]!) + (d[6]! - fl[6]!) > 2 * ((d[3]! - fl[3]!) + (d[5]! - fl[5]!)) / 2 + 8, 'the odd harmonics come up more than the even');
});

test('the membrane leaves the note in tune', () => {
  for (const midi of [74, 79, 86]) {
    const f = mtof(midi);
    const x = blowDizi(jet(midi, 0.7), seeded(midi));
    let best = 0, at = 0;
    for (let c = -20; c <= 20; c += 1) { const v = goertzel(x, f * 2 ** (c / 1200), Math.floor(0.4 * SR), Math.floor(1.0 * SR)); if (c === -20 || v > best) { best = v; at = c; } }
    assert.ok(Math.abs(at) <= 6, `${midi}: ${at} cents`);
  }
});

test('the player slides only into the notes the composer bends, graces some plain ones, flutters only long loud notes, and falls only before a breath', () => {
  const rand = seeded(11);
  let graces = 0, marked = 0, flutters = 0, free = 0;
  for (let i = 0; i < 1500; i++) {
    const bent = rand() < 0.5, breath = rand() < 0.3, held = 0.1 + rand() * 1.4, vel = rand();
    const flags = FLUTE_PLAYED | (bent ? FLUTE_SCOOP : 0) | (breath ? FLUTE_BREATH : 0);
    const p = diziPlay({ midi: 76, held, vel, flags, slurred: false }, rand);
    if (!bent) assert.ok(!p.scoop, 'no slide on a plain note');
    if (bent) { marked++; if (p.bend && p.bend(0.01) > 100) graces++; }
    if (p.flutter) { flutters++; assert.ok(held >= DIZI_PLAYER.flutterFrom && vel >= DIZI_PLAYER.flutterVel, 'a flutter on a long, loud note'); }
    if (!breath && p.bend) assert.ok(p.bend(held - 0.01) > -50, 'a fall only before a breath');
    if (!bent && p.bend && p.bend(0.01) > 100) { free++; assert.ok(held >= DIZI_PLAYER.graceFrom, 'a free grace note on a held note'); }
  }
  assert.ok(graces / marked > 0.25 && graces / marked < 0.55, `grace notes on ${(100 * graces / marked).toFixed(0)}% of the bent notes`);
  assert.ok(flutters > 10, `some flutter-tongued notes (${flutters})`);
  assert.ok(free > 20 && free < 150, `grace notes on some plain notes too (${free})`);
});

test('a flutter-tongue interrupts the tone at its rate', () => {
  const x = new Float32Array(SR).fill(1);
  flutterTongue(SR, x, 18, seeded(2));
  let crossings = 0;
  for (let i = 1; i < x.length; i++) if ((x[i - 1]! < 0.7) !== (x[i]! < 0.7)) crossings++;
  assert.ok(Math.abs(crossings / 2 - 18) < 3, `${crossings / 2} interruptions a second`);
});

test('a note is the same every time for the same seed', () => {
  const one = blowDizi(jet(81, 0.6), seeded(7)), two = blowDizi(jet(81, 0.6), seeded(7));
  assert.deepEqual(one, two);
  assert.ok(one.every(Number.isFinite));
});
