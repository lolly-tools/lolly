// SPDX-License-Identifier: MPL-2.0
/**
 * The chroma AXIS ceiling (engine/src/gamut-axis.ts) - how high a chroma scale
 * has to reach for the gamut it is drawn against.
 *
 * The bug this replaces was a flat 0.4 for every gamut, which is wrong in both
 * directions at once: it CLIPS Rec.2020 (whose green spike reaches 0.464, so the
 * chart drew a flat top that looked like a property of the gamut) and leaves a
 * fifth of an sRGB chart permanently empty (sRGB stops at 0.321), squashing the
 * envelope into the lower half and doubling the chroma a given mouse move covers.
 *
 * So every assertion here is made against `maxChroma` itself - a dense sweep over
 * lightness × hue - never against a number typed into this file. A tabulated
 * expectation would pass while the derivation rotted, and would say nothing about
 * a gamut that is an ICC press profile rather than one of the three names.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { maxChroma, GAMUTS } from '../engine/src/gamut.ts';
import { peakChroma, chromaAxisMax, chromaTickStep } from '../engine/src/gamut-axis.ts';
import type { GamutSource } from '../engine/src/gamut-source.ts';

/**
 * The true peak, by brute force: 200 lightnesses × every degree of hue. This is
 * the oracle - deliberately far denser than the coarse-then-refine search the
 * module ships, so it can catch that search settling on a local maximum.
 */
function bruteforcePeak(limit: Parameters<typeof maxChroma>[2]): { c: number; l: number; h: number } {
  let best = { c: 0, l: 0, h: 0 };
  for (let i = 1; i < 200; i++) {
    const l = i / 200;
    for (let h = 0; h < 360; h++) {
      const c = maxChroma(l, h, limit);
      if (c > best.c) best = { c, l, h };
    }
  }
  return best;
}

const PEAKS = new Map<string, { c: number; l: number; h: number }>();
const peakOf = (g: 'srgb' | 'p3' | 'rec2020'): { c: number; l: number; h: number } => {
  const hit = PEAKS.get(g);
  if (hit) return hit;
  const p = bruteforcePeak(g);
  PEAKS.set(g, p);
  return p;
};

test('peakChroma finds the real peak, not a local one', () => {
  for (const g of GAMUTS) {
    const brute = peakOf(g);
    const got = peakChroma(g);
    // AGREEMENT, both ways - not `got >= brute.c`.
    //
    // Neither figure is the truth: both are sampled, the oracle at 200 L × 1° and the
    // shipped search on a coarser grid with a local refine, so either can come out a
    // hair above the other and which one does is a property of the sample counts. A
    // one-sided assertion would therefore be held up by the oracle's coarseness - bump
    // this file's density and it fails with the module untouched, which is a statement
    // about the test rather than about the code. Two-sided at 2% still fails a search
    // that settles on a genuinely different local maximum (the gamuts' second-highest
    // ridges are tens of percent down), and the required property - the CEILING
    // clears the true peak - is asserted in the next test.
    const off = Math.abs(got - brute.c) / brute.c;
    assert.ok(off <= 0.02, `${g}: peakChroma ${got} disagrees with brute force ${brute.c} by ${(off * 100).toFixed(2)}%`);
  }
});

test('nothing clips: every gamut fits inside its own ceiling, Rec.2020 included', () => {
  for (const g of GAMUTS) {
    const brute = peakOf(g);
    const ceiling = chromaAxisMax(g);
    assert.ok(
      ceiling > brute.c,
      `${g}: ceiling ${ceiling} does not clear its peak ${brute.c} (L ${brute.l}, h ${brute.h})`,
    );
  }
  // The one the flat 0.4 got wrong. Stated separately so a regression names it.
  assert.ok(chromaAxisMax('rec2020') > peakOf('rec2020').c);
  assert.ok(chromaAxisMax('rec2020') > 0.4, 'Rec.2020 needs more axis than the old flat 0.4');
});

test('no dead band: a ceiling sits close above its gamut, sRGB tightest of all', () => {
  for (const g of GAMUTS) {
    const ceiling = chromaAxisMax(g);
    const peak = peakOf(g).c;
    // Headroom is 5% plus rounding to a readable 0.02 step, so at most ~12% of the
    // axis can be unreachable. The old flat 0.4 left 25% dead on sRGB.
    assert.ok(ceiling <= peak * 1.12, `${g}: ceiling ${ceiling} leaves a dead band above ${peak}`);
  }
  assert.ok(chromaAxisMax('srgb') < 0.4, 'sRGB no longer borrows Rec.2020 headroom');
});

test('the ceiling is a property of the GAMUT ONLY — no lightness or hue in it', () => {
  // Same call, same answer, whatever else is going on: this is what keeps the axis
  // from rescaling under the cursor mid-drag.
  const a = chromaAxisMax('p3');
  maxChroma(0.2, 20, 'p3');
  assert.equal(chromaAxisMax('p3'), a);
  // …and the three are genuinely different scales, widest gamut widest axis.
  assert.ok(chromaAxisMax('srgb') < chromaAxisMax('p3'));
  assert.ok(chromaAxisMax('p3') < chromaAxisMax('rec2020'));
});

test('a ceiling is DERIVED, so an arbitrary source (an ICC press profile) gets one too', () => {
  // A source no name tabulates, and lumpy in BOTH l and h the way a press profile
  // is - so the search has to find the ridge rather than read a table.
  const cap = (l: number, h: number): number =>
    0.10 + 0.03 * Math.sin((2 * h * Math.PI) / 180) * Math.sin(l * Math.PI);
  const timid: GamutSource = {
    id: 'test:timid',
    label: 'timid',
    contains: (l, c, h) => c <= cap(l, h),
  };
  const peak = bruteforcePeak(timid);
  const ceiling = chromaAxisMax(timid);
  assert.ok(ceiling > peak.c, `ceiling ${ceiling} clips the source's ${peak.c}`);
  assert.ok(ceiling <= peak.c * 1.35, `ceiling ${ceiling} is far above ${peak.c}`);
  assert.ok(ceiling < chromaAxisMax('srgb'), 'a third of sRGB should need less axis than sRGB');
});

test('memoised by identity: two sources with different ids get their own answers', () => {
  const wide: GamutSource = { id: 'test:wide', label: 'wide', contains: (_l, c) => c <= 0.8 };
  const narrow: GamutSource = { id: 'test:narrow', label: 'narrow', contains: (_l, c) => c <= 0.1 };
  assert.ok(chromaAxisMax(wide) > chromaAxisMax(narrow));
  // Second call is the cache; it must answer the same, not '[object Object]'s.
  assert.equal(chromaAxisMax(wide), chromaAxisMax(wide));
  assert.equal(chromaAxisMax(narrow), chromaAxisMax(narrow));
});

test('tick steps are round numbers that fit a few times across the axis', () => {
  for (const g of GAMUTS) {
    const cMax = chromaAxisMax(g);
    const step = chromaTickStep(cMax);
    const n = Math.floor(cMax / step + 1e-9);
    assert.ok(n >= 3 && n <= 8, `${g}: ${n} ticks of ${step} across ${cMax}`);
    // Round: printable at two decimals without losing anything.
    assert.equal(Number(step.toFixed(2)), step, `${g}: step ${step} is not a 2dp number`);
  }
  // Degenerate input answers with the finest step rather than NaN or 0.
  assert.ok(chromaTickStep(0) > 0);
  assert.ok(chromaTickStep(-1) > 0);
});
