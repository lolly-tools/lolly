// SPDX-License-Identifier: MPL-2.0
/**
 * Ownership - "which of this did a person choose?" (plan 182 section 4.1).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/ownership.test.ts"
 *
 * Every case here runs against the REAL shipped starter document
 * (brands/lolly-start/catalog/assets/lolly/tokens/brand.json), read off disk,
 * the same way census.test.ts proves `censusToUsage` against the real
 * brand-propose output rather than a hand-rolled stand-in. A hand-built doc
 * would prove the module is self-consistent; only the shipped bytes prove that
 * a fresh install reports zero colours of its own, which is the whole claim.
 *
 * jsdom-free on purpose: nothing in the module touches a DOM.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { TOKEN_EXT } from '@lolly/engine';
import { addSwatch, walkSwatches } from '../brand-doc.ts';
import { assignRole } from './roles.ts';
import { withFontRoleToken, withRadiusToken } from '../../user-fonts.ts';
import {
  FONT_ROLES, colorIdentity, docColorRefs, fontRoleFamily, isRoleKey,
  radiusValue, reportOwnership, starterColorIds,
} from './ownership.ts';

// ── The shipped starter ──────────────────────────────────────────────────────

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const STARTER_PATH = join(REPO, 'brands/lolly-start/catalog/assets/lolly/tokens/brand.json');
const STARTER_JSON = readFileSync(STARTER_PATH, 'utf8');

/** A fresh parse every time - every write path below mutates in place. */
const starter = (): Record<string, unknown> => JSON.parse(STARTER_JSON) as Record<string, unknown>;

/** How many of the starter's colours are SWATCHES (everything the walker finds,
 *  minus the theme roles). Read off the pack rather than pinned: how many ramps
 *  the blank brand ships is brand-doc.test.ts's contract to hold, and pinning
 *  the same number twice only means the second copy goes stale. What is pinned
 *  here is that a fresh install owns NONE of them. */
const STARTER_SWATCHES = walkSwatches(starter(), 'light').filter(s => s.kind !== 'semantic').length;

type Rec = Record<string, unknown>;

test('the fixture is the real starter, not a stand-in', () => {
  const doc = starter();
  assert.ok(Array.isArray(doc.$themes) && doc.$themes.length === 2, 'light + dark themes');
  const light = walkSwatches(doc, 'light');
  assert.ok(STARTER_SWATCHES > 0, 'the pack ships a ramp');
  assert.ok(light.some(s => s.kind === 'semantic'), 'and per-theme roles aliasing into it');
  assert.equal(fontRoleFamily(doc, 'brand'), 'SUSE');
  assert.equal(fontRoleFamily(doc, 'mono'), 'SUSE Mono');
  assert.equal(fontRoleFamily(doc, 'display'), '', 'the starter declares no heading face');
  assert.equal(radiusValue(doc), '', 'and no radius');
});

// ── Colours ──────────────────────────────────────────────────────────────────

test('a fresh install owns nothing: every colour is the starter\'s, roles are not colours', () => {
  const doc = starter();
  const report = reportOwnership({ doc, starterDoc: starter() });

  assert.equal(report.counts.ownColors, 0, 'nobody has chosen a colour yet');
  assert.equal(report.counts.starterColors, STARTER_SWATCHES, 'the shipped ramp, and only it');
  assert.equal(report.colors.size, STARTER_SWATCHES);
  assert.equal([...report.colors.values()].every(v => v === 'inherited'), true);
  assert.equal([...report.colors.keys()].some(isRoleKey), false, 'a role never gets an entry');
  assert.equal(report.colors.get('color.ramp.neutral.4'), 'inherited', 'a named ramp step, by key');
});

test('one added colour is one own colour', () => {
  const doc = starter();
  const path = addSwatch(doc, 'custom', 'Vivid Red', '#e0452b');
  assert.ok(path);

  const report = reportOwnership({ doc, starterDoc: starter() });
  assert.equal(report.counts.ownColors, 1);
  assert.equal(report.counts.starterColors, STARTER_SWATCHES);
  assert.equal(report.colors.get('color.custom.vivid-red'), 'own');
});

test('giving that colour a role never adds a second one - plan 182 C5', () => {
  const doc = starter();
  addSwatch(doc, 'custom', 'Vivid Red', '#e0452b');
  assert.equal(assignRole(doc, 'primary', 'color.custom.vivid-red'), true);

  const report = reportOwnership({ doc, starterDoc: starter() });
  assert.equal(report.counts.ownColors, 1, 'a role re-points; it does not create material');
  assert.equal(report.counts.starterColors, STARTER_SWATCHES);
  assert.equal(report.colors.size, STARTER_SWATCHES + 1);
  assert.equal(report.colors.has('color.semantic.primary'), false);
});

test('a starter colour someone recoloured is theirs, at the same key', () => {
  const doc = starter();
  const ramp = ((doc.base as Rec).color as Rec).ramp as Rec;
  ((ramp.neutral as Rec)['4'] as Rec).$value = '#e0452b';

  const report = reportOwnership({ doc, starterDoc: starter() });
  assert.equal(report.colors.get('color.ramp.neutral.4'), 'own');
  assert.equal(report.counts.ownColors, 1);
  assert.equal(report.counts.starterColors, STARTER_SWATCHES - 1);
});

test('a brand that ships no starter attributes nothing to a starter', () => {
  const doc = starter();
  const report = reportOwnership({ doc, starterDoc: null });
  assert.equal(report.counts.starterColors, 0);
  assert.equal(report.counts.ownColors, STARTER_SWATCHES, 'with nothing shipped to compare against, it is all theirs');
});

test('a swatch hidden from the palette is not counted either', () => {
  const doc = starter();
  doc.$extensions = { [TOKEN_EXT]: { excluded: ['color.ramp.neutral.1'] } };

  const report = reportOwnership({ doc, starterDoc: starter() });
  assert.equal(report.colors.has('color.ramp.neutral.1'), false, 'a tile that is not on screen is not a colour');
  assert.equal(report.counts.starterColors, STARTER_SWATCHES - 1);
});

test('a caller\'s own value space is compared against the starter in the SAME space', () => {
  // The Overview reads RESOLVED swatches (hexes off host.tokens.colors()), not
  // the stored `oklch()`/`{alias}` spellings the Colours room walks. Handing in
  // both halves is what keeps one comparison serving both.
  const report = reportOwnership({
    doc: starter(),
    starterDoc: starter(),
    palette: {
      colors: [
        { key: 'color.ramp.primary.1', value: '#111111' },
        { key: 'color.custom.mine', value: '#ff6600' },
        { key: 'color.semantic.primary', value: '#111111' },
      ],
      starter: [{ key: 'color.ramp.primary.1', value: '#111111' }],
    },
  });
  assert.equal(report.counts.starterColors, 1);
  assert.equal(report.counts.ownColors, 1, 'the role is neither, because a role is not a swatch');
  assert.equal(report.colors.size, 2);
});

test('colorIdentity needs both halves, and isRoleKey knows a role from a ramp', () => {
  assert.notEqual(
    colorIdentity('color.ramp.primary.4', '#30ba78'),
    colorIdentity('color.ramp.primary.4', '#e0452b'),
    'the same key, recoloured, is a different colour',
  );
  assert.equal(isRoleKey('color.semantic.primary'), true);
  assert.equal(isRoleKey('color.ramp.primary.4'), false);
  assert.equal(isRoleKey('color.custom.semantically-red'), false, 'a word is not a segment');
});

test('starterColorIds carries both theme spellings of a role', () => {
  const ids = starterColorIds(starter());
  // The two spellings of one role, from the pack itself - so this stays true
  // whichever ramp step the starter happens to point each theme at.
  const light = walkSwatches(starter(), 'light').find(s => s.key === 'color.semantic.primary');
  const dark = walkSwatches(starter(), 'dark').find(s => s.key === 'color.semantic.primary');
  assert.ok(light && dark && light.raw !== dark.raw, 'the themes do not agree, which is the point');
  assert.ok(ids.has(colorIdentity(light.key, light.raw)), 'light');
  assert.ok(ids.has(colorIdentity(dark.key, dark.raw)), 'dark');
  assert.equal(starterColorIds(null).size, 0);
});

test('docColorRefs reports what the walker stores, not what it resolves', () => {
  const refs = docColorRefs(starter(), 'light');
  const role = refs.find(r => r.key === 'color.semantic.primary');
  assert.match(role?.value ?? '', /^\{color\.ramp\./, 'the alias as written, not what it resolves to');
  assert.ok(refs.length > STARTER_SWATCHES, 'roles are still walked; reportOwnership is what drops them');
});

// ── Faces ────────────────────────────────────────────────────────────────────

test('a fresh install has two inherited faces and two that follow the primary', () => {
  const report = reportOwnership({
    doc: starter(),
    starterDoc: starter(),
    userFontFamilies: [],
    resolvedFaces: { brand: 'SUSE', mono: 'SUSE Mono', display: 'SUSE', italic: 'SUSE' },
  });

  assert.deepEqual(report.faces.brand, { family: 'SUSE', state: 'inherited' });
  assert.deepEqual(report.faces.mono, { family: 'SUSE Mono', state: 'inherited' });
  // display and italic fall back through `var(--font-brand)`; mono does NOT -
  // its own tail is the platform mono (brand-vars.ts FONT_SLOTS).
  assert.deepEqual(report.faces.display, { family: 'SUSE', state: 'follows', follows: 'brand' });
  assert.deepEqual(report.faces.italic, { family: 'SUSE', state: 'follows', follows: 'brand' });
  assert.equal(report.counts.ownFaces, 0);
});

test('a face installed on this device is the person\'s own, wherever it is pointed', () => {
  const doc = withFontRoleToken(starter(), 'display', 'Inter');
  const report = reportOwnership({
    doc,
    starterDoc: starter(),
    userFontFamilies: ['Inter'],
    resolvedFaces: { brand: 'SUSE', mono: 'SUSE Mono', display: 'Inter', italic: 'SUSE' },
  });

  assert.deepEqual(report.faces.display, { family: 'Inter', state: 'own' });
  assert.equal(report.faces.brand.state, 'inherited', 'the primary is still nobody\'s choice');
  assert.equal(report.faces.italic.state, 'follows');
  assert.equal(report.counts.ownFaces, 1);
});

test('a pack\'s built-in face is inherited, not own - nobody uploaded it', () => {
  // The SUSE profile declares the same tokens, and they ARE that person's design
  // system there. Neither is a face somebody added on this device.
  const doc = withFontRoleToken(starter(), 'display', 'Some Pack Face');
  const report = reportOwnership({
    doc, starterDoc: starter(), userFontFamilies: ['Inter'],
    resolvedFaces: { display: 'Some Pack Face' },
  });
  assert.deepEqual(report.faces.display, { family: 'Some Pack Face', state: 'inherited' });
  assert.equal(report.counts.ownFaces, 0);
});

test('an unresolved role still reports its declared family rather than nothing', () => {
  const doc = withFontRoleToken(starter(), 'brand', 'Inter');
  const report = reportOwnership({ doc, starterDoc: starter(), userFontFamilies: ['inter'] });
  assert.deepEqual(report.faces.brand, { family: 'Inter', state: 'own' }, 'match is case-insensitive');
});

test('every role gets an entry, in FONT_ROLES order', () => {
  const report = reportOwnership({ doc: starter(), starterDoc: starter() });
  assert.deepEqual(Object.keys(report.faces), [...FONT_ROLES]);
});

// ── Logos and radius ─────────────────────────────────────────────────────────

test('a logo slot is own when a mark is in it, and empty otherwise', () => {
  const report = reportOwnership({
    doc: starter(), starterDoc: starter(),
    logoSlots: [
      { variant: 'horizontal-primary', filled: true },
      { variant: 'icon', filled: false },
    ],
  });
  assert.deepEqual(report.logos, { 'horizontal-primary': 'own', icon: 'empty' });
  assert.equal(report.counts.logos, 1);
});

test('the radius reads as the starter\'s until somebody moves it', () => {
  assert.equal(reportOwnership({ doc: starter(), starterDoc: starter() }).radius, 'inherited');

  const moved = withRadiusToken(starter(), '1rem');
  assert.equal(radiusValue(moved), '1rem');
  assert.equal(reportOwnership({ doc: moved, starterDoc: starter() }).radius, 'own');

  // A starter that ships its own radius, matched exactly, is still inherited.
  const shipped = withRadiusToken(starter(), '1rem');
  assert.equal(reportOwnership({ doc: withRadiusToken(starter(), '1rem'), starterDoc: shipped }).radius, 'inherited');
});

test('nothing here throws on a document that is not one', () => {
  for (const doc of [null, undefined, 'not a doc', 42, []]) {
    const report = reportOwnership({ doc, starterDoc: null });
    assert.equal(report.counts.ownColors, 0);
    assert.equal(report.faces.brand.state, 'unset');
    assert.equal(report.radius, 'inherited');
  }
});
