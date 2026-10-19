// SPDX-License-Identifier: MPL-2.0
/**
 * Swatch cards in Assets: every card's ref is the colour's place in the palette
 * list that selection, downloads and paging read. The section builds its ramp
 * grids before the brand grid, so a counter taken while building numbered the
 * cards in a different order from that list: the ticked cards and the file you
 * downloaded named different colours. This renders the real section and checks
 * each ref against the colour on the card.
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/assets/swatch-set.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { swatchesSectionHtml } from './sections.ts';
import { cardHtml, fitNotes, selectedEntries, swatchList } from './swatch-set.ts';
import { swatchFit, type SwatchExportFormat } from '../../lib/swatch-export.ts';
import type { CatCtx } from './context.ts';
import type { PaletteEntry } from '../../palette.ts';

const palette: PaletteEntry[] = [
  { hex: 'transparent', label: 'Transparent', cmyk: null },
  { hex: '#0c322c', label: 'Pine', cmyk: [65, 0, 35, 85] },
  { hex: '#30ba78', label: 'Jungle', cmyk: null },
  { hex: '#025937', label: 'Jungle 2', cmyk: null },
  { hex: '#008657', label: 'Jungle 3', cmyk: null },
  { hex: '#00bda7', label: 'Teal', cmyk: null, group: 'spectrum' },
  { hex: '#000000', label: 'Black', cmyk: [0, 0, 0, 100], group: 'Fog' },
  { hex: '#efefef', label: 'Fog 1', cmyk: null },
];

function fakeCat(selected: string[] = []): CatCtx {
  const cat = {
    palette,
    favSet: new Set<string>(),
    swatchSelected: new Set(selected),
    SWATCH_DOWNLOADS: [],
    filters: { swatchFavKey: (label: string) => `swatch:${label}` },
    tiles: { groupSection: (_key: string, _label: string, _count: number, body: string) => body },
  } as unknown as CatCtx;
  cat.swatchSet = { cardHtml: (c: PaletteEntry, i: number) => cardHtml(cat, c, i) } as unknown as CatCtx['swatchSet'];
  return cat;
}

/** Each card in page order: its ref and the name it shows. */
const cards = (html: string): { ref: number; name: string }[] =>
  [...html.matchAll(/data-swatch-ref="(-?\d+)"[\s\S]*?class="cat-tile-name" title="([^"]*)"/g)]
    .map(m => ({ ref: Number(m[1]), name: m[2]! }));

test('every card names the colour its ref points at in the palette list', () => {
  const cat = fakeCat();
  const list = swatchList(cat);
  const shown = cards(swatchesSectionHtml(cat));
  assert.equal(shown.length, list.length, 'one card per colour');
  for (const { ref, name } of shown) assert.equal(list[ref]?.label, name, `card ${ref}`);
  // The panel leads with the brand colours, so its refs run in page order.
  assert.deepEqual(shown.map(c => c.ref), list.map((_, i) => i));
});

test('the ticked cards are the colours a download writes', () => {
  const cat = fakeCat(['1', '3']);
  const html = swatchesSectionHtml(cat);
  const ticked = [...html.matchAll(/cat-swatch-tile is-selected[^>]*data-swatch-ref="(\d+)"[\s\S]*?class="cat-tile-name" title="([^"]*)"/g)].map(m => m[2]);
  assert.deepEqual(ticked, selectedEntries(cat).map(e => e.label));
});

test('a card is an asset card: the whole body opens it and a separate dot selects it', () => {
  const html = cardHtml(fakeCat(), palette[1]!, 1);
  assert.match(html, /class="cat-tile cat-swatch-tile"/);
  assert.match(html, /<button type="button" class="cat-check" data-swatch-select="1"/);
  assert.match(html, /<button type="button" class="cat-tile-open" data-swatch-open="1"[\s\S]*cat-tile-fig[\s\S]*cat-tile-cap/);
  assert.match(html, /CMYK/, 'a locked ink is flagged on the colour');
  assert.doesNotMatch(html, /data-id=/, 'never mistaken for an asset tile');
});

test('Transparent shows the checkerboard rather than a fill', () => {
  const html = cardHtml(fakeCat(), palette[0]!, 0);
  assert.match(html, /class="cat-tile-fig cat-swatch-fig" style=""/);
  assert.match(html, /No colour/);
});

test('the format menu says which formats fall back to sRGB and which carry the print values', () => {
  const formats: { fmt: SwatchExportFormat; label: string }[] = [
    { fmt: 'tokens-json', label: 'Design tokens (JSON)' }, { fmt: 'css-vars', label: 'CSS variables' },
    { fmt: 'scss', label: 'SCSS variables' }, { fmt: 'ase', label: 'Adobe swatches (.ase)' }, { fmt: 'gpl', label: 'GIMP palette (.gpl)' },
  ];
  const entries: PaletteEntry[] = [
    { hex: '#00ff00', label: 'Vivid', cmyk: null, token: { ref: '{color.brand.vivid}', path: 'color.brand.vivid', css: 'color(display-p3 0 1 0)' } },
    palette[1]!,   // Pine, CMYK-locked
    palette[0]!,   // Transparent
  ];
  const notes = fitNotes(formats.map(f => ({ ...f, fit: swatchFit(entries, f.fmt) })));
  assert.equal(notes.length, 3, notes.join(' | '));
  assert.match(notes[0]!, /Left out: Transparent/);
  assert.match(notes[1]!, /^SCSS variables(,| and) GIMP palette \(\.gpl\) save Vivid as the sRGB fallback\./);
  assert.match(notes[2]!, /^The CMYK and spot values of Pine go into Design tokens \(JSON\)(,| and) Adobe swatches \(\.ase\) only\./);
});
