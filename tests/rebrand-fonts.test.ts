// SPDX-License-Identifier: MPL-2.0
/**
 * Font assignment for a renovation (plan 274 section 3.3, work package 4).
 *
 * The alias table answers first, `brand-map.ts`'s family class table second,
 * and a theme reference takes the brand face because it names no family of its
 * own. `available` is the design system's own faces: a target it does not carry
 * falls back to the brand face rather than back to the source, because renovate
 * mode never keeps a source typeface.
 *
 * Run with: node --test "tests/rebrand-fonts.test.ts"
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FONT_ALIASES, mapFonts, normaliseFamily } from '../engine/src/rebrand-fonts.ts';
import type { FontMappingV1, FontUseV1 } from '../packages/core/src/index.ts';

const BRAND = 'Inter';
const SERIF = 'Source Serif 4';
const MONO = 'JetBrains Mono';

function use(family: string, provenance: FontUseV1['provenance'] = 'literal', runs = 1): FontUseV1 {
  return { family, provenance, runs, roles: {} };
}

function mapping(rows: FontMappingV1[], from: string): FontMappingV1 {
  const found = rows.find((row) => row.from === from);
  assert.ok(found, `no mapping for ${from}`);
  return found;
}

test('the alias table covers the families plan 274 section 3.3 names', () => {
  const named = [
    'Calibri', 'Arial', 'Helvetica', 'Segoe UI', 'Aptos', 'Verdana', 'Tahoma', 'Trebuchet',
    'Century Gothic', 'Gill Sans', 'Open Sans', 'Roboto', 'Lato', 'Source Sans',
    'Cambria', 'Times New Roman', 'Georgia', 'Garamond', 'Book Antiqua', 'Palatino',
    'Consolas', 'Courier New', 'Menlo', 'Monaco',
  ];
  for (const family of named) {
    assert.ok(FONT_ALIASES[normaliseFamily(family)], `${family} is named in the plan and missing from the table`);
  }
});

test('sans, serif and mono go to the three design-system faces', () => {
  const rows = mapFonts({
    fonts: [use('Calibri'), use('Arial'), use('Cambria'), use('Times New Roman'), use('Consolas'), use('Menlo')],
    brand: BRAND,
    serif: SERIF,
    mono: MONO,
  });
  assert.equal(mapping(rows, 'Calibri').to, BRAND);
  assert.equal(mapping(rows, 'Arial').to, BRAND);
  assert.equal(mapping(rows, 'Cambria').to, SERIF);
  assert.equal(mapping(rows, 'Times New Roman').to, SERIF);
  assert.equal(mapping(rows, 'Consolas').to, MONO);
  assert.equal(mapping(rows, 'Menlo').to, MONO);
  for (const row of rows) assert.equal(row.source, 'alias');
});

test('a design system with no serif or mono face sends everything to the brand face', () => {
  const rows = mapFonts({ fonts: [use('Cambria'), use('Consolas')], brand: BRAND });
  assert.equal(mapping(rows, 'Cambria').to, BRAND);
  assert.equal(mapping(rows, 'Consolas').to, BRAND);
});

test('a theme reference takes the brand face and records the class route', () => {
  const rows = mapFonts({ fonts: [use('+mn-lt', 'theme'), use('Corporate Display', 'theme')], brand: BRAND, serif: SERIF });
  assert.equal(mapping(rows, '+mn-lt').to, BRAND);
  assert.equal(mapping(rows, '+mn-lt').source, 'class');
  assert.equal(mapping(rows, 'Corporate Display').to, BRAND);
  assert.equal(mapping(rows, 'Corporate Display').source, 'class');
});

test('a family the table does not name goes through the family class table', () => {
  const rows = mapFonts({ fonts: [use('Lucida Console'), use('Wingdings 2')], brand: BRAND, mono: MONO });
  // Lucida Console is a mono family the engine's own table knows.
  assert.equal(mapping(rows, 'Lucida Console').to, MONO);
  assert.equal(mapping(rows, 'Lucida Console').source, 'class');
  // A family nobody knows still gets the brand face, never the source face.
  assert.equal(mapping(rows, 'Wingdings 2').to, BRAND);
  assert.equal(mapping(rows, 'Wingdings 2').source, 'class');
});

test('a target the design system does not carry falls back to the brand face', () => {
  const rows = mapFonts({
    fonts: [use('Cambria'), use('Consolas'), use('Calibri')],
    brand: BRAND,
    serif: SERIF,
    mono: MONO,
    available: [BRAND],
  });
  assert.equal(mapping(rows, 'Cambria').to, BRAND);
  assert.equal(mapping(rows, 'Consolas').to, BRAND);
  assert.equal(mapping(rows, 'Calibri').to, BRAND);
});

test('a family stack, quotes and odd spacing all reach the same alias', () => {
  const rows = mapFonts({ fonts: [use('"Segoe UI", sans-serif'), use('  SEGOE   UI  ')], brand: BRAND });
  assert.equal(rows.length, 2, 'two spellings are two source families, each with its own mapping');
  for (const row of rows) {
    assert.equal(row.to, BRAND);
    assert.equal(row.source, 'alias');
  }
});

test('one mapping per source family, sorted by the source name, and repeatable', () => {
  const fonts = [use('Verdana', 'literal', 9), use('Calibri', 'literal', 40), use('Verdana', 'literal', 2)];
  const rows = mapFonts({ fonts, brand: BRAND });
  assert.deepEqual(rows.map((row) => row.from), ['Calibri', 'Verdana']);
  assert.deepEqual(rows, mapFonts({ fonts, brand: BRAND }));
});

test('an empty census gives an empty table rather than an invented one', () => {
  assert.deepEqual(mapFonts({ fonts: [], brand: BRAND }), []);
});
