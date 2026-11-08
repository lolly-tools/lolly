// SPDX-License-Identifier: MPL-2.0
/**
 * The icon colours and photo washes a design system offers come from its colourways
 * (engine/src/brand-treatments.ts colourwayIconThemes / colourwayPhotoTreatments): one of
 * each per colourway, canonical first, named as the colourway is, and none for a system
 * with no colourways. Read against the shipped Lolly Demo system and the blank starter, so
 * public CI covers what the private SUSE pack carries too.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COLOURWAY_LOOK_PREFIX, colourwayIconThemes, colourwayInks, colourwayPhotoTreatments, isColourwayLookId, withColourwayLooks,
} from '../engine/src/brand-treatments.ts';
import { addColourway, colourwayAxis, liftToColourways } from '../engine/src/colourway.ts';
import { contrastRatio, deriveBrandTokens } from '../engine/src/brand-derive.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { applyIconTheme, parseIconThemesDoc } from '../engine/src/icon-theme.ts';
import { parsePhotoTreatmentsDoc } from '../engine/src/photo-treatment.ts';
import { brandCheckCatalog } from '../engine/src/design-brief.ts';
import { guestRecolourFrom } from '../engine/src/partner-kit-check.ts';

type Rec = Record<string, unknown>;
const load = (path: string): Rec => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const DEMO = load('../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json');
const START = load('../brands/lolly-start/catalog/assets/lolly/tokens/brand.json');

test('one icon pairing and one photo wash per colourway, canonical first, named as the colourway', () => {
  const axis = colourwayAxis(DEMO)!;
  const themes = colourwayIconThemes(DEMO);
  const washes = colourwayPhotoTreatments(DEMO);
  assert.equal(themes.length, axis.options.length);
  assert.equal(washes.length, axis.options.length);
  assert.equal(themes[0]!.id, `${COLOURWAY_LOOK_PREFIX}${axis.canonical}`, 'the canonical colourway leads');
  assert.deepEqual(themes.map((t) => t.label), [axis.options.find((o) => o.id === axis.canonical)!.name, ...axis.options.filter((o) => o.id !== axis.canonical).map((o) => o.name)]);
  assert.deepEqual(washes.map((w) => w.id), themes.map((t) => t.id), 'the photo washes follow the same order');
  for (const t of themes) assert.ok(isColourwayLookId(t.id), t.id);
  assert.equal(isColourwayLookId('waterhole'), false, 'a palette id is never read as a colourway look');
});

test('every look parses through the readers the bridges use, and bakes into a contract icon', () => {
  const themes = colourwayIconThemes(DEMO);
  assert.deepEqual(parseIconThemesDoc({ themes }), themes);
  assert.deepEqual(parsePhotoTreatmentsDoc({ treatments: colourwayPhotoTreatments(DEMO) }).map((t) => t.id), themes.map((t) => t.id));
  const icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><style>.c1{fill:#30ba78}.c2{fill:#0c322c}</style></defs><path class="c1" d="M0 0h5v5H0z"/><path class="c2" d="M5 5h5v5H5z"/></svg>';
  const baked = applyIconTheme(icon, themes[1]!)!;
  assert.match(baked, new RegExp(`fill="${themes[1]!.c1}"`));
  assert.match(baked, new RegExp(`fill="${themes[1]!.c2}"`));
});

test('the canonical colourway reproduces the colours the brand bakes into its own icons', () => {
  // Lolly Demo's Etiquette icons carry Green Apple on Spearmint: the Spearmint colourway's
  // two leads, the lighter as the accent and the deeper as the base.
  assert.deepEqual(colourwayIconThemes(DEMO)[0], { id: 'colourway-spearmint', label: 'Spearmint', c1: '#50c369', c2: '#033633' });
});

test('a pairing reads as two tones, and its base holds on the surface', () => {
  for (const ink of colourwayInks(DEMO)) {
    assert.ok(contrastRatio(ink.accent, ink.base) >= 2, `${ink.id}: accent and base stand apart`);
    assert.ok(contrastRatio(ink.base, '#ffffff') >= 4.5, `${ink.id}: the base holds as an outline on white`);
    assert.ok(contrastRatio(ink.shadow, '#ffffff') >= 7, `${ink.id}: the photo shadow is dark`);
    assert.ok(contrastRatio(ink.highlight, '#ffffff') < 1.4, `${ink.id}: the photo highlight is pale`);
  }
});

test('a colourway whose two leads are one colour pairs its lead with its ink', () => {
  // SUSE's shape: Jungle and Persimmon keep one lead in light and dark, so the icon base is
  // the system's text colour, as the brand's own icons do.
  const lifted = liftToColourways(deriveBrandTokens({ primary: '#30ba78', name: 'Fixture' }) as Rec, { id: 'jungle', name: 'Jungle' });
  assert.ok(lifted.ok, lifted.ok ? '' : lifted.reasons.join(' '));
  const same = { primary: '#fe7c3f', 'on-primary': '#0c322c', secondary: '#008657' };
  const added = addColourway(lifted.doc, { id: 'persimmon', name: 'Persimmon', values: { light: same, dark: same } });
  assert.ok(added.ok, added.ok ? '' : added.reasons.join(' '));
  const text = createTokenSet(added.doc, { selection: { [colourwayAxis(added.doc)!.group]: 'persimmon' } }).colors().find((s) => s.path === 'color.semantic.text')?.value;
  const persimmon = colourwayIconThemes(added.doc).find((t) => t.id === 'colourway-persimmon')!;
  assert.equal(persimmon.c1, '#fe7c3f', 'the lead is the accent');
  assert.equal(persimmon.c2, String(text).toLowerCase(), 'the ink is the base');
});

test('a system with no colourways offers no looks, and an unreadable input offers none either', () => {
  assert.equal(colourwayAxis(START), null, 'the starter has no colourways');
  for (const input of [START, null, {}, 'not a doc', 42]) {
    assert.deepEqual(colourwayIconThemes(input), []);
    assert.deepEqual(colourwayPhotoTreatments(input), []);
  }
});

test('the same document gives the same looks every time', () => {
  assert.deepEqual(colourwayInks(DEMO), colourwayInks(structuredClone(DEMO)));
});

test('checks still know a palette id after the colourway looks, so older pieces are not flagged', () => {
  const catalog = {
    assets: [],
    iconThemes: { themes: [{ id: 'brand', label: 'Green Apple', c1: '#50c369', c2: '#033633' }, { id: 'ember', label: 'Outback', c1: '#ee9138', c2: '#72251c' }] },
    photoTreatments: { treatments: [{ id: 'greyscale', kind: 'greyscale' }] },
  };
  const known = brandCheckCatalog(withColourwayLooks(catalog, DEMO));
  const ours = colourwayIconThemes(DEMO).map((t) => t.id);
  assert.deepEqual(known.iconThemes, [...ours, 'brand', 'ember'], 'colourway looks first, then the palette');
  assert.deepEqual(known.treatments, [...ours, 'greyscale']);
  assert.ok(guestRecolourFrom(withColourwayLooks(catalog, DEMO))({ theme: 'colourway-morning' }), 'a colourway look resolves to colours');
  assert.equal(withColourwayLooks(catalog, START), catalog, 'no colourways: the catalog is handed back as it was');
});
