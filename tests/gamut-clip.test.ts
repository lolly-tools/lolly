// SPDX-License-Identifier: MPL-2.0
/**
 * clipToGamut (engine/src/gamut.ts) - gamut-clip contract tests.
 *
 * The engine primitive promoted from the web shell's `clampIntoGamut`
 * (shells/web/src/lib/gamut-slider.ts). Contract: hold L and H constant, reduce
 * C to the in-gamut ceiling (`maxChroma(l, h, limit)`), for ANY GamutLimit - 
 * srgb / p3 / rec2020. An already-in-gamut colour passes through unchanged.
 *
 * Coverage:
 *   (1) known out-of-gamut colours per limit → result is in-gamut (within tol),
 *       L and H preserved exactly, C strictly reduced
 *   (2) in-gamut input returned unchanged (same reference)
 *   (3) sRGB result matches the old clampIntoGamut formula bit-for-bit
 *
 * MINDE note: the optional `mode:'minde'` refinement was NOT implemented here - 
 * a correct min-ΔE correction for an ARBITRARY GamutLimit needs a generic
 * per-source RGB clip + ΔEOK (brand-derive's gamutMapOklch has these for sRGB
 * only, via inSrgbGamut/clipSrgb/deltaEOkSrgb). Only the exact-ceiling default
 * ships; see notesForIntegration.
 *
 * NOTE: the first bytes of every console.log line must be ASCII.
 *
 * Run with: node --test tests/gamut-clip.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clipToGamut, inGamut, maxChroma } from '../engine/src/gamut.ts';
import type { BuiltinGamutName } from '../engine/src/gamut-source.ts';

const LIMITS: BuiltinGamutName[] = ['srgb', 'p3', 'rec2020'];
const TOL = 1e-6; // maxChroma bisects to GAMUT_EPSILON; allow the boundary a hair

// Deliberately extreme chroma at mid lightness across the hue wheel - well past
// every RGB display gamut's ceiling, so each is out of gamut for all three.
const OUT_OF_GAMUT = [
  { l: 0.6, c: 0.4, h: 0 },
  { l: 0.5, c: 0.5, h: 30 },
  { l: 0.7, c: 0.45, h: 145 },
  { l: 0.5, c: 0.4, h: 264 },
  { l: 0.8, c: 0.35, h: 330 },
];

test('clipToGamut: out-of-gamut colours land in-gamut, L+H preserved, C reduced', () => {
  for (const limit of LIMITS) {
    for (const o of OUT_OF_GAMUT) {
      assert.equal(inGamut(o.l, o.c, o.h, limit), false, `precondition: ${JSON.stringify(o)} out of ${limit}`);
      const r = clipToGamut(o, limit);
      // L and H held EXACTLY constant - the whole point of the contract.
      assert.equal(r.l, o.l, `L preserved (${limit})`);
      assert.equal(r.h, o.h, `H preserved (${limit})`);
      // Chroma strictly reduced.
      assert.ok(r.c < o.c, `C reduced ${o.c} -> ${r.c} (${limit})`);
      // Result is in gamut (the ceiling minus the bisection tolerance certainly is).
      assert.ok(inGamut(r.l, Math.max(0, r.c - TOL), r.h, limit), `result in-gamut (${limit}, ${JSON.stringify(o)})`);
      // And the clipped chroma equals the honest ceiling.
      assert.ok(Math.abs(r.c - maxChroma(o.l, o.h, limit)) <= TOL, `C == ceiling (${limit})`);
    }
  }
});

test('clipToGamut: in-gamut input returned unchanged (same reference)', () => {
  // A muted mid-grey-ish colour that fits even sRGB.
  const inside = { l: 0.6, c: 0.05, h: 200 };
  for (const limit of LIMITS) {
    assert.equal(inGamut(inside.l, inside.c, inside.h, limit), true, `precondition in ${limit}`);
    const r = clipToGamut(inside, limit);
    assert.strictEqual(r, inside, `same object reference (${limit})`);
  }
});

test('clipToGamut: chroma-0 grey axis is inside every gamut and untouched', () => {
  const grey = { l: 0.5, c: 0, h: 120 };
  for (const limit of LIMITS) {
    const r = clipToGamut(grey, limit);
    assert.strictEqual(r, grey, `grey unchanged (${limit})`);
  }
});

// The former shell helper: {...o, c: Math.min(o.c, maxChroma(o.l,o.h,'srgb'))}
// with in-gamut passthrough. clipToGamut must reproduce it bit-for-bit for sRGB.
function oldClampIntoGamutSrgb(o: { l: number; c: number; h: number }) {
  if (inGamut(o.l, o.c, o.h, 'srgb')) return o;
  return { ...o, c: Math.min(o.c, maxChroma(o.l, o.h, 'srgb')) };
}

test('clipToGamut: sRGB result matches the old clampIntoGamut formula exactly', () => {
  const cases = [
    ...OUT_OF_GAMUT,
    { l: 0.6, c: 0.05, h: 200 }, // in-gamut
    { l: 0.5, c: 0, h: 0 },      // grey
    { l: 0.9, c: 0.3, h: 90 },   // out
  ];
  for (const o of cases) {
    const got = clipToGamut(o, 'srgb');
    const want = oldClampIntoGamutSrgb(o);
    assert.equal(got.l, want.l, `L match ${JSON.stringify(o)}`);
    assert.equal(got.h, want.h, `H match ${JSON.stringify(o)}`);
    assert.equal(got.c, want.c, `C match ${JSON.stringify(o)}`);
  }
});
