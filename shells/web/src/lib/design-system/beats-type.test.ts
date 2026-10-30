// SPDX-License-Identifier: MPL-2.0
/**
 * Which beat the Type room shows (plan 182 section 3a).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/beats-type.test.ts"
 *
 * The whole point of the beat is that a first-time user meets ONE decision, so
 * the two cases that matter are "nothing here is mine" (0) and "something is"
 * (1). The third case is the one a naive read gets wrong: a face installed on
 * this device that holds no role. Beat 0 hides the fonts list, so answering 0
 * there would hide the only surface that can manage that face.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { typeBeat } from './beats-type.ts';
import { reportOwnership } from './ownership.ts';
import type { OwnershipReport } from './ownership.ts';

/** A document declaring the faces a starter ships with. Plain DTCG (no
 *  `$themes`), so the font group sits at the top level - see ownership.ts's
 *  `groupOf`, which is what the layered Tokens-Studio shape needs a set for. */
const starterish = { font: { brand: { $value: 'SUSE' }, mono: { $value: 'SUSE Mono' } } };

function report(doc: unknown, userFonts: readonly string[] = []): OwnershipReport {
  return reportOwnership({
    doc,
    starterDoc: null,
    palette: { colors: [], starter: [] },
    userFontFamilies: userFonts,
    resolvedFaces: { brand: 'SUSE', display: '', mono: 'SUSE Mono', italic: '' },
  });
}

test('a room wearing only the starter faces is at beat 0', () => {
  assert.equal(typeBeat(report(starterish)), 0);
  // …and so is a document that declares no face at all.
  assert.equal(typeBeat(report({})), 0);
});

test("one face of the person's own moves the room to beat 1", () => {
  const doc = { font: { brand: { $value: 'SUSE' }, display: { $value: 'Inter' } } };
  const r = report(doc, ['Inter']);
  assert.equal(r.faces.display.state, 'own');
  assert.equal(typeBeat(r), 1);
});

test('a face installed but holding no role still opens the room', () => {
  // Nothing points at Inter, so every role reads inherited or follows - but the
  // face is on the device and its row lives at beat 1.
  const r = report(starterish, ['Inter']);
  assert.equal(r.counts.ownFaces, 0);
  assert.equal(typeBeat(r), 0, 'the report alone cannot see an unassigned face');
  assert.equal(typeBeat(r, 1), 1, 'the installed count is the other half of the question');
});

test('a design system that chose faces beyond the starter opens on all four roles', () => {
  // Lolly Demo: the starter's SUSE and SUSE Mono, plus Outfit for headings.
  const demo = { font: { brand: { $value: 'SUSE' }, display: { $value: 'Outfit' }, mono: { $value: 'SUSE Mono' } } };
  const r = reportOwnership({
    doc: demo,
    starterDoc: starterish,
    palette: { colors: [], starter: [] },
    userFontFamilies: [],
    resolvedFaces: { brand: 'SUSE', display: 'Outfit', mono: 'SUSE Mono', italic: '' },
  });
  assert.equal(r.faces.brand.starter, true, 'SUSE is the starter\'s own face');
  assert.equal(r.faces.display.starter, false, 'Outfit is the design system\'s choice');
  assert.equal(typeBeat(r), 1);
  // The same document read against itself as the starter stays at the first decision.
  const self = reportOwnership({ doc: starterish, starterDoc: starterish, palette: { colors: [], starter: [] }, userFontFamilies: [] });
  assert.equal(typeBeat(self), 0);
});
