// SPDX-License-Identifier: MPL-2.0
/**
 * Unpack - the PowerPoint (.pptx) extraction passes (shells/web/src/views/pptx-import.ts).
 * The passes are pure functions over the engine's read model (PptxReadSlide/deck), so
 * these test them against synthetic decks rather than a real .pptx binary.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slideText, deckPalette, deckImages, deckFonts } from '../shells/web/src/views/pptx-import.ts';
import type { PptxReadSlide, PptxReadTheme } from '../engine/src/pptx-read.ts';

const PNG_16x9 = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 16, 0, 0, 0, 9, 8, 6, 0, 0, 0,
]);
// A NodeBox stub - the extraction passes never read geometry.
const box = { xEmu: 0, yEmu: 0, cxEmu: 0, cyEmu: 0 };

test('pptx slideText: paragraphs then table rows, in node order, weight/size read', () => {
  const slide = {
    index: 0,
    nodes: [
      { ...box, type: 'text', paras: [{ runs: [{ text: 'Title here', bold: true, sizePt: 32 }] }, { runs: [{ text: 'A body line.' }] }] },
      { ...box, type: 'table', rows: [['Name', 'Role'], ['Ada', 'Eng']] },
    ],
  } as unknown as PptxReadSlide;
  const pt = slideText(slide);
  assert.deepEqual(pt.blocks.map((b) => b.text), ['Title here', 'A body line.', 'Name  ·  Role', 'Ada  ·  Eng']);
  assert.equal(pt.blocks[0]!.bold, true);
  assert.equal(pt.blocks[0]!.size, 32);
  assert.ok(pt.text.startsWith('Title here'));
});

test('pptx deckPalette: theme colours plus literal fills, deduped and lower-cased', () => {
  const deck = {
    theme: { colors: { dk1: '000000', accent1: '2453FF' } } as PptxReadTheme,
    slides: [{
      index: 0,
      nodes: [
        { ...box, type: 'shape', fill: { hex: '30BA78' }, line: { hex: '0C322C' } },
        { ...box, type: 'text', fill: { hex: '30BA78' }, paras: [{ runs: [{ text: 'x', color: { hex: 'E2231A' } }] }] },
      ],
    }] as unknown as PptxReadSlide[],
  };
  const pal = deckPalette(deck);
  for (const c of ['#000000', '#2453ff', '#30ba78', '#0c322c', '#e2231a']) {
    assert.ok(pal.includes(c), `expected ${c}, got ${pal.join(', ')}`);
  }
  // #30ba78 appears in a fill AND a text fill - deduped to one entry.
  assert.equal(pal.filter((c) => c === '#30ba78').length, 1);
});

test('pptx deckImages: raster media round-trips; a vector metafile is not reported as an image', () => {
  const deck = {
    slides: [{
      index: 0,
      nodes: [
        { ...box, type: 'pic', media: 'ppt/media/image1.png' },
        { ...box, type: 'pic', media: 'ppt/media/logo.emf' },
        { ...box, type: 'pic' },
      ],
    }] as unknown as PptxReadSlide[],
  };
  const parts = { 'ppt/media/image1.png': PNG_16x9, 'ppt/media/logo.emf': Uint8Array.from([1, 2, 3, 4]) };
  const scan = deckImages(deck, parts);
  assert.equal(scan.images.length, 1);
  assert.equal(scan.images[0]!.mime, 'image/png');
  assert.equal(scan.images[0]!.width, 16);
  assert.equal(scan.images[0]!.height, 9);
  assert.deepEqual([...scan.images[0]!.bytes], [...PNG_16x9]);
});

test('pptx deckFonts: theme and run families come back names-only; theme refs like +mn-lt are dropped', () => {
  const deck = {
    theme: { colors: {}, majorFont: 'Georgia', minorFont: 'Arial' } as PptxReadTheme,
    slides: [{
      index: 0,
      nodes: [{ ...box, type: 'text', paras: [{ runs: [{ text: 'x', font: 'Custom Sans' }, { text: 'y', font: '+mn-lt' }] }] }],
    }] as unknown as PptxReadSlide[],
  };
  const fonts = deckFonts(deck, {});
  const families = fonts.map((f) => f.family).sort();
  assert.deepEqual(families, ['Arial', 'Custom Sans', 'Georgia']);
  for (const f of fonts) {
    assert.equal(f.installable, false);
    assert.equal(f.bytes.length, 0);
  }
});
