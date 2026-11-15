// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kookaburra, kookaburraFamily, magpie, magpieFamily, outdoors } from './lofi-bush-birds.ts';

const SR = 44100;
/** The level (dB) in 10 ms frames. */
function frames(x: Float32Array): number[] {
  const n = Math.round(0.01 * SR), out: number[] = [];
  for (let i = 0; i + n <= x.length; i += n) { let s = 0; for (let j = i; j < i + n; j++) s += x[j]! ** 2; out.push(10 * Math.log10(s / n + 1e-20)); }
  return out;
}
/** Runs of frames within 25 dB of the loudest: [start, length] in frames. */
function runs(x: Float32Array): Array<[number, number]> {
  const f = frames(x), top = Math.max(...f), out: Array<[number, number]> = [];
  let i = 0;
  while (i < f.length) { if (f[i]! > top - 25) { const j0 = i; while (i < f.length && f[i]! > top - 25) i++; out.push([j0, i - j0]); } else i++; }
  return out;
}

test('a magpie carols in short notes and phrases, two voices, round its pitch', () => {
  for (const seed of [1, 2, 3, 4]) {
    const x = magpie(SR, 8, 1080, seed);
    assert.ok(x.every(Number.isFinite), 'finite');
    const r = runs(x);
    // Phrases of notes with rests between: several runs of sound, none of them the whole song.
    assert.ok(r.length >= 3, `seed ${seed}: ${r.length} stretches of song`);
    assert.ok(Math.max(...r.map(([, n]) => n)) < 400, `seed ${seed}: no stretch runs four seconds`);
  }
  // The warble is quieter than the carol.
  const rms = (y: Float32Array): number => Math.sqrt(y.reduce((s, v) => s + v * v, 0) / y.length);
  assert.ok(rms(magpie(SR, 6, 1080, 5, 'warble')) < rms(magpie(SR, 6, 1080, 5, 'carol')), 'the warble is softer');
});

test('a magpie family carols across the stereo field, and the place rings on after the song', () => {
  const [l, r] = magpieFamily(SR, 5, 1050, 8, 3);
  let diff = 0; for (let i = 0; i < l.length; i++) diff += Math.abs(l[i]! - r[i]!);
  assert.ok(diff > 0, 'the birds sit apart');
  assert.ok(l.length > 5 * SR, 'the ring carries past the song');
});

test('a kookaburra laughs for about ten seconds, chuckling, building, laughing and falling away', () => {
  const x = kookaburra(SR, 600, 9);
  const seconds = x.length / SR;
  assert.ok(seconds > 7 && seconds < 16, `a laugh of ${seconds.toFixed(1)} s (recorded: 7 to 15)`);
  const f = frames(x);
  const third = Math.floor(f.length / 3);
  const mean = (a: number[]): number => a.reduce((s, v) => s + v, 0) / a.length;
  // Louder in the middle (the full laugh) than in the chuckles that open the laugh.
  assert.ok(mean(f.slice(third, 2 * third)) > mean(f.slice(0, Math.floor(third / 2))), 'the laugh builds');
  const shorter = kookaburra(SR, 600, 9, 0.5);
  assert.ok(shorter.length < x.length * 0.7, 'a shorter laugh when asked');
  const [l, r] = kookaburraFamily(SR, 600, 3, 3);
  assert.ok(l.length > x.length * 0.8 && r.length === l.length, 'a family laughs together');
});

test('outdoors adds a ring after a note, about as a field recording keeps', () => {
  const n = SR, l = new Float32Array(n), r = new Float32Array(n);
  for (let i = 0; i < 0.15 * SR; i++) { const v = Math.sin((2 * Math.PI * 1100 * i) / SR); l[i] = v; r[i] = v; }
  outdoors([l, r], SR, 1);
  let note = 0, tail = 0;
  for (let i = Math.round(0.03 * SR); i < Math.round(0.14 * SR); i++) note += l[i]! ** 2;
  for (let i = Math.round(0.17 * SR); i < Math.round(0.21 * SR); i++) tail += l[i]! ** 2;
  const db = 10 * Math.log10((tail / 0.04) / (note / 0.11));
  assert.ok(db > -30 && db < -8, `the ring 20 to 60 ms after the note: ${db.toFixed(1)} dB`);
});

test('the same seed sings the same song', () => {
  assert.deepEqual(magpie(SR, 2, 1000, 42), magpie(SR, 2, 1000, 42));
  assert.deepEqual(kookaburra(SR, 550, 42, 0.5), kookaburra(SR, 550, 42, 0.5));
});
