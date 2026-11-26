// SPDX-License-Identifier: MPL-2.0
/**
 * The grand piano (lib/lofi-piano.ts), on its pure rendering: a note's partials sit sharp of
 * the harmonic series by the string's stiffness, the partial whose node the hammer strikes
 * is weak, a harder stroke brightens the top and not the bottom, each partial decays in two
 * stages (the prompt sound and the aftersound), and the treble dies sooner than the middle
 * did not: each against the numbers measured on recorded grands.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/lofi-piano.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hammerCutoff, inharmonicity, pianoNote, stretch, PIANO_KEYS } from './lofi-piano.ts';
import { LOFI_KEYS } from '../../../../engine/src/lofi-compose.ts';

const SR = 44100;
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** The magnitude of `x` at `f` Hz over [t0, t1) seconds (Hann window). */
function at(x: Float32Array, f: number, t0: number, t1: number): number {
  let re = 0, im = 0;
  const a = Math.floor(t0 * SR), b = Math.min(x.length, Math.floor(t1 * SR));
  for (let n = a; n < b; n++) { const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * (n - a)) / (b - a)); re += x[n]! * w * Math.cos((2 * Math.PI * f * n) / SR); im -= x[n]! * w * Math.sin((2 * Math.PI * f * n) / SR); }
  return Math.hypot(re, im);
}
const db = (v: number): number => 20 * Math.log10(v + 1e-12);
const mtof = (m: number): number => 440 * 2 ** ((m - 69) / 12);
/** The strongest frequency within `cents` of `f`, to a tenth of a hertz. */
function peakNear(x: Float32Array, f: number, cents: number, t0 = 0.1, t1 = 0.6): number {
  let best = f, top = 0;
  for (let c = -cents; c <= cents; c += 0.5) { const g = f * 2 ** (c / 1200); const m = at(x, g, t0, t1); if (m > top) { top = m; best = g; } }
  return best;
}

test('the grand is a keys instrument the composer offers', () => {
  assert.ok((LOFI_KEYS as readonly string[]).includes('grand'));
  assert.ok(PIANO_KEYS.has('grand'));
});

test('the partials sit sharp of the harmonic series by the string\'s stiffness (B about 2.9e-4 at middle C, 8e-4 at C5)', () => {
  assert.ok(Math.abs(inharmonicity(60) / 2.9e-4 - 1) < 0.15, `B at C4 ${inharmonicity(60)}`);
  assert.ok(Math.abs(inharmonicity(72) / 8.4e-4 - 1) < 0.25, `B at C5 ${inharmonicity(72)}`);
  assert.ok(inharmonicity(84) > inharmonicity(72) * 3, 'rising faster up the treble');
  const x = pianoNote(SR, 60, 0.8, seeded(1), 1);
  const f0 = mtof(60) * 2 ** (stretch(60) / 1200);
  const f6 = peakNear(x, 6 * f0, 40);
  const harmonic = 6 * peakNear(x, f0, 20);
  const cents = 1200 * Math.log2(f6 / harmonic);
  const want = 1200 * Math.log2(Math.sqrt(1 + inharmonicity(60) * 36));
  assert.ok(cents > 2 && Math.abs(cents - want) < 2.5, `the 6th partial is ${cents.toFixed(1)} cents sharp (B says ${want.toFixed(1)})`);
});

test('the hammer strikes near an eighth of the string: at middle C the 8th partial is far under the 7th', () => {
  const x = pianoNote(SR, 60, 0.8, seeded(2), 1);
  const f0 = mtof(60) * 2 ** (stretch(60) / 1200);
  const B = inharmonicity(60);
  const p = (n: number): number => db(at(x, n * f0 * Math.sqrt(1 + B * n * n), 0.02, 0.12));
  assert.ok(p(8) < p(7) - 12, `7th ${p(7).toFixed(1)} dB, 8th ${p(8).toFixed(1)} dB`);
});

test('a harder stroke brightens the top of the note and leaves its bottom', () => {
  const f0 = mtof(60) * 2 ** (stretch(60) / 1200);
  const B = inharmonicity(60);
  const level = (vel: number, n: number): number => {
    const x = pianoNote(SR, 60, vel, seeded(3), 0.5);
    let top = 0;
    for (const v of x) top = Math.max(top, Math.abs(v));
    return db(at(x, n * f0 * Math.sqrt(1 + B * n * n), 0, 0.1)) - db(at(x, f0, 0, 0.1));
  };
  // Measured on the recorded grand, soft to hard: the 2nd to 4th partials stay within a
  // few dB, the 10th to 13th rise 15 to 25 dB.
  assert.ok(Math.abs(level(1, 2) - level(0.3, 2)) < 6, 'the 2nd barely moves');
  assert.ok(level(1, 12) - level(0.3, 12) > 12, `the 12th rises ${(level(1, 12) - level(0.3, 12)).toFixed(1)} dB`);
  assert.ok(hammerCutoff(60, 1) > hammerCutoff(60, 0.3), 'the push reaches higher');
});

test('two decays: the prompt sound falls in about 2 s at middle C, then the aftersound rings on', () => {
  const x = pianoNote(SR, 60, 0.7, seeded(4), 5);
  const f0 = mtof(60) * 2 ** (stretch(60) / 1200);
  const lv = (t: number): number => db(at(x, f0, t, t + 0.1));
  const early = (lv(0.6) - lv(0.05)) / 0.55;   // dB a second
  const late = (lv(4.2) - lv(2.6)) / 1.6;
  const t60 = -60 / early;
  assert.ok(t60 > 1.5 && t60 < 4, `the prompt T60 ${t60.toFixed(2)} s (recorded 1.7 to 2.3)`);
  assert.ok(late > early * 0.5, `the aftersound falls slower (${late.toFixed(1)} against ${early.toFixed(1)} dB a second)`);
});

test('a note renders the same each time, and starts at once', () => {
  const a = pianoNote(SR, 67, 0.6, seeded(5), 0.4), b = pianoNote(SR, 67, 0.6, seeded(5), 0.4);
  assert.deepEqual(a, b);
  let first = 0;
  while (Math.abs(a[first]!) < 0.05) first++;
  assert.ok(first < SR * 0.004, `sounding within 4 ms (${(first / SR * 1000).toFixed(1)} ms)`);
  for (const v of a) assert.ok(Number.isFinite(v) && Math.abs(v) <= 1);
});
