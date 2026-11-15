// SPDX-License-Identifier: MPL-2.0
/**
 * The coast's birds (lib/lofi-coast-birds.ts and lib/coast-birds.ts), checked by the traits they
 * were fitted to (the recordings' numbers are in docs/generated-music.md).
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/lofi-coast-birds.test.ts
 *
 * What is pinned:
 *  - a whipbird call is the same bytes for the same seed; its whistle is a pure tone at the
 *    note's pitch, then the crack is a burst far broader and brighter than the whistle, and an
 *    answered call goes on after the crack where an unanswered one falls quiet;
 *  - lorikeets are the same bytes for the same seed, sit between 2 and 8 kHz, and a flock flying
 *    over gets louder and then quieter, crossing from one side of the field to the other;
 *  - the Aussie birds chip may bring the coast's birds into another style, rarely, and only
 *    whipbird or lorikeet notes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lorikeets, whipbird } from './lofi-coast-birds.ts';
import { coastBirdsFor } from './coast-birds.ts';
import { composeLofiTune } from '../../../../engine/src/lofi-compose.ts';

const SR = 22050;
const rms = (x: Float32Array, a: number, b: number): number => { let s = 0; for (let i = a; i < b; i++) s += x[i]! * x[i]!; return Math.sqrt(s / Math.max(1, b - a)); };
/** A brightness in Hz from the first difference's energy against the signal's (a centroid's cheap cousin). */
function bright(x: Float32Array, a: number, b: number): number {
  let d = 0, e = 0;
  for (let i = a + 1; i < b; i++) { d += (x[i]! - x[i - 1]!) ** 2; e += x[i]! * x[i]!; }
  return (Math.asin(Math.min(1, Math.sqrt(d / Math.max(1e-20, e)) / 2)) * SR) / Math.PI;
}

test('a whipbird pair: a pure whistle at the note, cracking into a broad burst, and her answer after', () => {
  assert.deepEqual(whipbird(SR, 95, 7)[0].slice(0, 4000), whipbird(SR, 95, 7)[0].slice(0, 4000));
  const [l] = whipbird(SR, 95, 11, true, 0);
  assert.ok(l.every(Number.isFinite));
  // The whistle: from 0.35 s, a tone near the note's 1976 Hz.
  const w = bright(l, Math.round(0.4 * SR), Math.round(0.6 * SR));
  assert.ok(w > 1700 && w < 2300, `the whistle near 2 kHz (${w.toFixed(0)} Hz)`);
  // Find the crack: the loudest 20 ms after the whistle.
  let best = 0, at = 0;
  for (let i = Math.round(0.8 * SR); i < l.length - SR / 50; i += SR / 100) { const v = rms(l, i, i + SR / 50); if (v > best) { best = v; at = i; } }
  assert.ok(bright(l, at, at + Math.round(0.05 * SR)) > w * 1.5, 'the crack is far brighter than the whistle');
  const after = (seed: number, answered: boolean): number => { const [x] = whipbird(SR, 95, seed, answered, 0); let m = 0, k = 0; for (let i = Math.round(0.8 * SR); i < x.length - SR / 50; i += SR / 100) { const v = rms(x, i, i + SR / 50); if (v > m) { m = v; k = i; } } return rms(x, k + Math.round(0.45 * SR), k + Math.round(1.1 * SR)) / m; };
  assert.ok(after(21, true) > after(21, false) * 1.5, 'an answered call goes on after the crack');
});

test('lorikeets: between 2 and 8 kHz, and a flock flying over comes and goes across the field', () => {
  const [a] = lorikeets(SR, 4, 'screech', 2, 95, 3);
  assert.deepEqual(a.slice(0, 3000), lorikeets(SR, 4, 'screech', 2, 95, 3)[0].slice(0, 3000));
  const b = bright(a, 0, a.length);
  assert.ok(b > 1800 && b < 6500, `screeches between 2 and 8 kHz (${b.toFixed(0)} Hz)`);
  const [fl, fr] = lorikeets(SR, 12, 'flypast', 8, 95, 4);
  const thirds = [0, 1, 2].map(k => rms(fl, (k * fl.length) / 3, ((k + 1) * fl.length) / 3) + rms(fr, (k * fl.length) / 3, ((k + 1) * fl.length) / 3));
  assert.ok(thirds[1]! > thirds[0]! && thirds[1]! > thirds[2]!, `louder as it passes (${thirds.map(v => v.toFixed(3)).join(', ')})`);
  const side = (k: number): number => 20 * Math.log10(rms(fl, (k * fl.length) / 3, ((k + 1) * fl.length) / 3) / rms(fr, (k * fl.length) / 3, ((k + 1) * fl.length) / 3));
  assert.ok(Math.abs(side(0) - side(2)) > 6, `crossing the field (${side(0).toFixed(1)} then ${side(2).toFixed(1)} dB left against right)`);
});

test('the Aussie birds chip brings the coast\'s birds in rarely, and only whipbirds and lorikeets', () => {
  let tunes = 0, with_ = 0;
  for (const mood of ['warm', 'rainy', 'dnb', 'jazz'] as const) for (let seed = 1; seed <= 15; seed++) {
    const bars = composeLofiTune(seed, mood);
    tunes++;
    const notes = bars.flatMap(b => coastBirdsFor(b, b.tune));
    if (notes.length) with_++;
    for (const n of notes) assert.ok(n.voice === 'whipbird' || n.voice === 'lorikeet', n.voice);
    assert.deepEqual(notes, bars.flatMap(b => coastBirdsFor(b, b.tune)), 'the same each time');
  }
  assert.ok(with_ >= 1 && with_ <= tunes * 0.45, `the coast's birds in ${with_} of ${tunes} tunes`);
});
