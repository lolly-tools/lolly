// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decayRate, electricString, partialsOf, type ElectricSpec } from './lofi-electric.ts';
import { fretFor } from './lofi-perform.ts';
import { composeLofiTune, ELECTRIC_CHOKE, ELECTRIC_FRET, ELECTRIC_UP } from '../../../../engine/src/lofi-compose.ts';

const SR = 44100;
function seeded(a: number): () => number {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const A2: ElectricSpec = { sr: SR, f: 110, seconds: 2.5, fret: 5, pick: 0.15, layer: 1 };

/** RMS (dB) of `x` from `a` to `b` seconds. */
function rms(x: Float32Array, a: number, b: number): number {
  let s = 0;
  const from = Math.floor(a * SR), to = Math.floor(b * SR);
  for (let i = from; i < to; i++) s += x[i]! * x[i]!;
  return 10 * Math.log10(s / (to - from) + 1e-20);
}

test('a stroke renders the same from the same seed, and differs a little from another', () => {
  const a = electricString(A2, seeded(1)), b = electricString(A2, seeded(1)), c = electricString(A2, seeded(2));
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('the partials decay as measured: a low partial rings far longer than one at 4 kHz, and a palm mute kills the string', () => {
  // 3.5 + 0.6 log2(f0 / 110) + 4.8 f dB a second, f in kHz.
  assert.ok(Math.abs(decayRate(110, 110) - (3.5 + 4.8 * 0.11)) < 1e-9);
  assert.ok(decayRate(110, 4000) > 5 * decayRate(110, 110));
  assert.ok(decayRate(110, 110, 'palm') > 30 * decayRate(110, 110));
  assert.ok(decayRate(110, 110, 'dead') > decayRate(110, 110, 'palm'));
  const ring = electricString(A2, seeded(3));
  const palm = electricString({ ...A2, damp: 'palm' }, seeded(3));
  assert.ok(rms(palm, 0.4, 0.6) < rms(ring, 0.4, 0.6) - 30, 'a palm-muted note is gone by half a second');
});

test('the string is stiff: its partials run sharp of whole multiples, more so on a low string', () => {
  const low = partialsOf({ ...A2, f: 82.4, fret: 0 }, seeded(4));
  const high = partialsOf({ ...A2, f: 659, fret: 12 }, seeded(4));
  const stretch = (p: ReturnType<typeof partialsOf>, f: number): number => p[7]!.hz / (8 * f);
  assert.ok(stretch(low, 82.4) > 1.002);
  assert.ok(stretch(low, 82.4) > stretch(high, 659));
});

test('a harder stroke is brighter', () => {
  const share = (layer: 0 | 1 | 2): number => {
    const p = partialsOf({ ...A2, layer }, seeded(5));
    const top = p.filter(x => x.hz > 1500).reduce((s, x) => s + x.amp * x.amp, 0);
    return top / p.reduce((s, x) => s + x.amp * x.amp, 0);
  };
  assert.ok(share(0) < share(1) && share(1) < share(2));
});

test('a single note is fingered on the string nearest the hand', () => {
  assert.equal(fretFor(64, 0), 0);      // the open high E
  assert.equal(fretFor(64, 5), 5);      // or the B string's fifth fret
  assert.equal(fretFor(69, 5), 5);      // A4: the high E's fifth fret
  assert.equal(fretFor(40, 7), 0);      // the low E has nowhere else to go
});

test('ska skanks the electric on the offbeats; reggae chops it on two and four', () => {
  const offbeat = (beat: number): boolean => Math.abs(((beat % 1) + 1) % 1 - 0.5) < 0.02;
  const notesOf = (mood: 'ska' | 'reggae') => composeLofiTune(7, mood, { keys: 'electric' })
    .filter(b => b.section === 'drop')
    .flatMap(b => b.notes.filter(n => n.voice === 'keys'));
  const ska = notesOf('ska');
  assert.ok(ska.length > 0);
  for (const n of ska) {
    assert.ok(offbeat(n.beat), `ska keys note at beat ${n.beat}`);
    assert.equal((n.mod ?? 0) % ELECTRIC_FRET & (ELECTRIC_UP | ELECTRIC_CHOKE), ELECTRIC_UP | ELECTRIC_CHOKE);
  }
  const reggae = notesOf('reggae');
  assert.ok(reggae.length > 0);
  for (const n of reggae) {
    const sixteenth = Math.round(n.beat * 4) % 16;
    assert.ok([4, 12, 13].includes(sixteenth), `reggae keys note at sixteenth ${sixteenth}`);
    assert.ok((n.mod ?? 0) & ELECTRIC_CHOKE);
  }
});
