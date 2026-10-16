// SPDX-License-Identifier: MPL-2.0
/**
 * swatches.ts - the Brand Studio tile's role mark takes the swatch ink.
 *
 * The mark (P, S, Su, T) is a label drawn on the user's colour. It used to be
 * measured twice, by two rules: a WCAG ratio in the palette grid and an OKLCH
 * lightness cut in the in-place refresh. Both now go through swatchInk (APCA,
 * brand-vars.ts), and an in-place recolour re-inks the mark it used to strand.
 *
 * Run directly:  node --test shells/web/src/lib/swatches.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { swatchTile, swatchTakesDarkInk, syncRoleMarkInk } from './swatches.ts';

const markOf = (html: string): Element | null =>
  new JSDOM(`<!doctype html><body>${html}</body>`).window.document.querySelector('.be-swatch-role');

test('a role mark is paper on a dark swatch and ink on a light one, by APCA', () => {
  const cases: Array<[name: string, hex: string, dark: boolean]> = [
    ['Spearmint', '#033633', false],
    ['Bunyapine', '#008657', false],   // white Lc 76.9, black 32.6
    ['Bauxite', '#a43427', false],
    ['Green Apple', '#50c369', true],  // white Lc 48.7, black 60.0
    ['Honey', '#fac044', true],
    ['Avocado', '#edf6e0', true],
    ['Sugar', '#ffffff', true],
    // Where APCA and WCAG 2 disagree: WCAG 2 gives each of these black.
    ['pink', '#cf6ca9', false],        // white Lc 65.4, black 44.1
    ['Persimmon', '#e0542a', false],   // white Lc 70.4, black 39.2
    ['blue', '#3a81f6', false],        // white Lc 69.8, black 39.8
    // A near tie (white 54.55, black 54.54) goes to the WCAG 2 ratio: black.
    ['lilac', '#a5a0b9', true],
  ];
  for (const [name, hex, dark] of cases) {
    assert.equal(swatchTakesDarkInk(hex), dark, `${name} ${hex}`);
    const mark = markOf(swatchTile({ label: name, hex }, { idx: 0, roleGlyph: 'P' }));
    assert.ok(mark, `${name}: the mark is drawn`);
    assert.equal(mark.classList.contains('is-onlight'), dark, `${name}: the tile carries the same answer`);
  }
});

test('a tile with no colour of its own keeps the paper mark, and no glyph means no mark', () => {
  // An unset or transparent tile shows the theme's checkerboard, which a string
  // cannot see: there is no ground to measure, so the mark stays as it was.
  for (const hex of ['', 'transparent']) {
    assert.equal(swatchTakesDarkInk(hex), false, JSON.stringify(hex));
    assert.equal(markOf(swatchTile({ label: 'Unset', hex }, { idx: 0, roleGlyph: 'S' }))?.classList.contains('is-onlight'), false);
  }
  // A translucent swatch is judged at full strength, for the same reason.
  assert.equal(swatchTakesDarkInk('#00000033'), false);
  assert.equal(markOf(swatchTile({ label: 'Plain', hex: '#edf6e0' }, { idx: 0 })), null);
});

test('an in-place recolour re-inks the mark instead of stranding it', () => {
  const { document } = new JSDOM(`<!doctype html><body>${swatchTile({ label: 'Role', hex: '#033633' }, { idx: 3, roleGlyph: 'T' })}</body>`).window;
  const tile = document.querySelector('[data-be-tile="3"]')!;
  const mark = tile.querySelector('.be-swatch-role')!;
  assert.equal(mark.classList.contains('is-onlight'), false, 'paper on Spearmint');
  syncRoleMarkInk(tile, '#fdec9e');
  assert.equal(mark.classList.contains('is-onlight'), true, 'ink once recoloured to Wattle');
  syncRoleMarkInk(tile, '#09141a');
  assert.equal(mark.classList.contains('is-onlight'), false, 'paper again on Liquorice');
});
