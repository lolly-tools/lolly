// SPDX-License-Identifier: MPL-2.0
/**
 * The onion-ring classifier: which gamut OUT a colour sits in, relative to the
 * active limit.
 *
 * Every assertion here is about MEMBERSHIP — "this colour, under that limit, gets
 * that tier". None of them assert index arithmetic over `GAMUT_TIER_LADDER`, and
 * that is the point: the bug this classifier replaces ranked gamuts by their
 * position in an ordering, which is wrong because Display-P3 is not a subset of
 * Rec.2020, and the test that let it ship asserted the arithmetic rather than the
 * colours.
 */

import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  gamutTier, gamutTierProbe, BEYOND_TIER, GAMUT_TIER_LADDER,
  inGamut, parseColor, convertColor,
} from '../engine/src/index.ts';
import type { CssColor, GamutSource } from '../engine/src/index.ts';

const ok = (c: CssColor): [number, number, number] => {
  const o = convertColor(c, 'oklch');
  return [o.components[0] ?? 0, o.components[1] ?? 0, o.components[2] ?? 0];
};

/** The P3 red corner — the colour the index-arithmetic version got wrong. It is
 *  inside Display-P3 by construction and OUTSIDE Rec.2020: its red primary lies
 *  past the Rec.2020 red–green edge. */
const P3_RED = ok(parseColor('color(display-p3 1 0 0)')!);
/** Inside Rec.2020, outside both narrower gamuts. */
const REC_GREEN = ok(parseColor('color(rec2020 0.1 1 0.1)')!);
const SRGB_GREEN = ok(parseColor('#30ba78')!);

test('the premise: P3 red is in P3 and NOT in Rec.2020', () => {
  // If this ever fails, every tier expectation below is measuring the wrong thing.
  assert.equal(inGamut(...P3_RED, 'p3'), true);
  assert.equal(inGamut(...P3_RED, 'rec2020'), false, 'P3 is not a subset of Rec.2020');
  assert.equal(inGamut(...REC_GREEN, 'rec2020'), true);
  assert.equal(inGamut(...REC_GREEN, 'p3'), false);
});

test('under an sRGB limit the rings run outward by membership', () => {
  assert.equal(gamutTier(...SRGB_GREEN, 'srgb'), 0, 'the limit itself is tier 0');
  assert.equal(gamutTier(...P3_RED, 'srgb'), 1, 'P3 red is the FIRST ring out');
  assert.equal(gamutTier(...REC_GREEN, 'srgb'), 2, 'a Rec.2020-only green is the second');
  // Past every display gamut: chroma no primary set reaches.
  assert.equal(gamutTier(0.6, 0.9, 140, 'srgb'), BEYOND_TIER);
});

test('under a Rec.2020 limit the P3-only region is a RING, not "beyond"', () => {
  // The case the ordering bug got wrong: Rec.2020 is nominally the widest, so an
  // index-ranked classifier had no ring left to hand P3 red and called it beyond.
  assert.equal(gamutTier(...REC_GREEN, 'rec2020'), 0);
  assert.equal(gamutTier(...P3_RED, 'rec2020'), 2,
    'P3 red is outside Rec.2020 but inside P3 — the second candidate asked');
  assert.notEqual(gamutTier(...P3_RED, 'rec2020'), BEYOND_TIER);
});

test('under a P3 limit sRGB never appears as a ring', () => {
  // sRGB IS a true subset of P3, so every sRGB colour answers tier 0 first and the
  // sRGB candidate can never be reached. Asserted over a sweep rather than one
  // colour, because "never" is the claim.
  const probe = gamutTierProbe('p3');
  for (let l = 0.05; l < 1; l += 0.05) {
    for (let h = 0; h < 360; h += 15) {
      for (let c = 0; c < 0.36; c += 0.03) {
        if (inGamut(l, c, h, 'srgb')) assert.equal(probe(l, c, h), 0, `sRGB colour ${l} ${c} ${h}`);
      }
    }
  }
  assert.equal(probe(...P3_RED), 0, 'P3 red is the limit itself here');
  assert.equal(probe(...REC_GREEN), 2, 'Rec.2020-only is the second candidate asked');
});

test('a foreign source (an ICC press profile) ranks against all three', () => {
  // A press limit shares no id with the built-ins, so none of them is dropped as
  // "the limit itself": tier 1 sRGB, tier 2 P3-not-sRGB, tier 3 Rec.2020-only.
  // "Your press cannot put it down; your screen can show it."
  const press: GamutSource = {
    id: 'icc:deadbeef:perceptual',
    label: 'Test press (perceptual)',
    // A deliberately small region: mid lightness, low chroma.
    contains: (l, c) => l > 0.3 && l < 0.8 && c < 0.06,
    inkCoverage: () => 2.5,
  };
  const probe = gamutTierProbe(press);
  assert.equal(probe(0.5, 0.02, 140), 0, 'inside the press gamut');
  assert.equal(probe(...SRGB_GREEN), 1, 'displayable on any screen, not on this press');
  assert.equal(probe(...P3_RED), 2);
  assert.equal(probe(...REC_GREEN), 3);
  assert.equal(probe(0.6, 0.9, 140), BEYOND_TIER);
});

test('a hue sweep interleaves tiers in an order no ordering could produce', () => {
  const probe = gamutTierProbe('srgb');
  const seq: number[] = [];
  for (let h = 0; h < 360; h += 15) seq.push(probe(0.6, 0.22, h));
  const shown = seq.map(v => (v === BEYOND_TIER ? 'x' : String(v))).join('');
  // All four answers occur on ONE sweep at a fixed lightness and chroma: reachable
  // hues, first-ring hues, second-ring hues, and hues no display holds.
  for (const want of ['0', '1', '2', 'x']) {
    assert.ok(shown.includes(want), `expected a '${want}' somewhere in ${shown}`);
  }
  // …and the sweep comes back IN after going out, in both directions. Distance from
  // the limit is a property of each colour, not of its position in a sequence.
  assert.match(shown, /x[12]/, 'a ring must reappear after an unreachable stretch');
  assert.match(shown, /[12]0/, 'and the axis must come back inside the limit');
});

test('non-finite input is beyond, never a ring', () => {
  for (const [l, c, h] of [[NaN, 0.1, 200], [0.5, Infinity, 200], [0.5, 0.1, NaN]] as const) {
    assert.equal(gamutTier(l, c, h, 'srgb'), BEYOND_TIER, `${l} ${c} ${h}`);
  }
});

test('the ladder is a question order, and the three display gamuts are on it', () => {
  assert.deepEqual(GAMUT_TIER_LADDER.map(g => g.id), ['srgb', 'p3', 'rec2020']);
  // Its LENGTH bounds how many rings can exist; its ORDER is which candidate is
  // asked first. Nothing may read a tier off it as a position.
  assert.ok(GAMUT_TIER_LADDER.every(g => typeof g.contains === 'function'));
});

test('the module comment\'s worked examples reproduce', () => {
  // They did not. The P3 red corner was quoted rounded to 4 decimals, which pushes it
  // OFF the P3 hull it sits on (`inGamut(…, 'p3')` false, tier BEYOND), and the hue
  // sweep was illustrated with a `3` — an answer no sRGB limit can return, since its
  // ladder has two candidates. A reader who pasted either into a debug session would
  // conclude the classifier is broken. So the doc is now read back from the source and
  // checked, which also keeps it honest if the hulls are ever revised.
  const src = readFileSync(new URL('../engine/src/gamut-tier.ts', import.meta.url), 'utf8');
  const corner = /L (-?[\d.]+), C (-?[\d.]+),\s*\*?\s*h (-?[\d.]+)/.exec(src.replace(/\n \*/g, ''));
  assert.ok(corner, 'the quoted P3 red corner moved — find it before deleting this test');
  const lch = [Number(corner[1]), Number(corner[2]), Number(corner[3])] as [number, number, number];
  assert.equal(inGamut(...lch, 'p3'), true, `the quoted corner is not in P3: ${lch.join(' ')}`);
  assert.equal(gamutTier(...lch, 'srgb'), 1, 'the doc calls it tier 1');
  assert.equal(gamutTier(...lch, 'rec2020'), 2, 'the doc calls it tier 2 under Rec.2020');

  const quoted = /`([012.]{20,})`/.exec(src);
  assert.ok(quoted, 'the quoted hue sweep moved');
  const probe = gamutTierProbe('srgb');
  const measured = Array.from({ length: quoted[1]!.length }, (_, i) => {
    const t = probe(0.6, 0.25, (i / (quoted[1]!.length - 1)) * 360);
    return t === BEYOND_TIER ? '.' : String(t);
  }).join('');
  assert.equal(quoted[1], measured, 'the illustrated sweep must be the one the code produces');
});
