// SPDX-License-Identifier: MPL-2.0
/**
 * A Print Sheet cell sent from multi-edit or the batch grid carries its design's theme
 * choices (plans/319 A6), with plain light and dark and with a colourway, and a design
 * with none keeps the link it always had.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/print-sheet-cell.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEmbedUrl, buildInputModel, parseEmbedUrl, parseUrlState } from '@lolly/engine';
import { printSheetCellUrl } from './print-sheet-cell.ts';
import { shareUrlState } from './share-privacy.ts';
import type { ToolManifest } from '../../../../engine/src/loader.ts';

const MANIFEST = {
  id: 'poster', name: 'Poster', version: '1.0.0',
  render: { width: 400, height: 300, formats: ['png', 'svg'] },
  inputs: [{ id: 'headline', type: 'text', default: 'Hello' }],
} as unknown as ToolManifest;
const model = (headline: string) => buildInputModel(MANIFEST, { initial: { headline } });
const DARK = { '': 'dark' };
const PERSIMMON_DARK = { '': 'dark', colourway: 'persimmon' };

test('each cell link carries its design\'s theme choices and reads back', () => {
  for (const tokenSelection of [DARK, PERSIMMON_DARK]) {
    for (const keepUserIds of [false, true]) {
      const url = printSheetCellUrl(MANIFEST, model('Night'), { tokenSelection, keepUserIds });
      const parsed = parseEmbedUrl(url!);
      assert.ok(parsed, 'the link parses back as an embed');
      assert.equal(parsed!.format, 'svg', 'vector where the tool offers it');
      const state = parseUrlState(parsed!.query, MANIFEST);
      assert.deepEqual(state.tokenSelection, tokenSelection);
      assert.equal(state.values.headline, 'Night');
    }
  }
});

test('a design with no choices, or an empty map, keeps the link it always had', () => {
  // The link both senders built inline before theme choices were added to the link.
  const expected = buildEmbedUrl({ toolId: 'poster', format: 'svg', query: shareUrlState(model('Day')) });
  assert.ok(expected?.startsWith('https://lolly.tools/tool/poster.svg?headline=Day'));
  assert.equal(printSheetCellUrl(MANIFEST, model('Day')), expected);
  assert.equal(printSheetCellUrl(MANIFEST, model('Day'), { tokenSelection: {} }), expected, 'no `_themes={}` in the link');
});

test('a tool without SVG is sent as a raster still', () => {
  const raster = { ...MANIFEST, render: { ...MANIFEST.render, formats: ['jpeg', 'pdf'] } } as unknown as ToolManifest;
  assert.equal(parseEmbedUrl(printSheetCellUrl(raster, model('x'), { tokenSelection: DARK })!)!.format, 'jpg');
  const none = { ...MANIFEST, render: { ...MANIFEST.render, formats: ['pdf'] } } as unknown as ToolManifest;
  assert.equal(parseEmbedUrl(printSheetCellUrl(none, model('x'))!)!.format, 'png');
});
