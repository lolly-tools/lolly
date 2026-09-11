// SPDX-License-Identifier: MPL-2.0
/**
 * The Tools + Utilities spotlight providers (plans/99 section 2b) over a fake
 * window.__toolIndex: the utility/tool split mirrors the gallery, unlisted
 * tools never surface, the localized name is displayed while the pristine
 * English stash (section 2e) stays searchable, tag/name weighting orders hits, and
 * the WeakMap haystack cache refreshes when a re-sync swaps the index object.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/search/providers/tools.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// jsdom globals BEFORE the dynamic import (the co-located suite convention).
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;

const { createToolsProvider, createUtilitiesProvider } = await import('./tools.ts');
const { tokenize } = await import('../match.ts');

type FakeTool = Record<string, unknown>;
const setIndex = (tools: FakeTool[]): void => {
  (window as unknown as { __toolIndex?: { tools: FakeTool[] } }).__toolIndex = { tools };
};

// A localized index: compress-pdf carries a German active name with the
// pristine English stashed on `en` (what localizeToolIndex does off-English).
const TOOLS: FakeTool[] = [
  { id: 'compress-pdf', name: 'PDF verkleinern', description: 'Verkleinert ein PDF', tags: ['pdf'], category: 'utility', en: { name: 'Compress PDF', description: 'Shrink a PDF on device' } },
  { id: 'qr-code', name: 'QR code', description: 'Make a QR code', tags: ['qr', 'link'], category: 'everyone' },
  { id: 'asset-export', name: 'Asset export', description: 'Crop a catalog asset', category: 'everyone', listed: false },
  { id: 'chart-creator', name: 'Chart Creator', description: 'Data charts', tags: [], category: 'designer' },
  { id: 'imperfections', name: 'Imperfections', description: 'Print texture', tags: ['chart'], category: 'designer' },
];
setIndex(TOOLS);

const tools = createToolsProvider();
const utilities = createUtilitiesProvider();

test('utility split mirrors the gallery: category utility goes to Utilities only', async () => {
  assert.equal((await tools.search(tokenize('pdf'), 5)).length, 0);
  const hits = await utilities.search(tokenize('pdf'), 5);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.href, '#/tool/compress-pdf');
  // And the other way: a non-utility never shows under Utilities.
  assert.equal((await utilities.search(tokenize('qr'), 5)).length, 0);
  assert.equal((await tools.search(tokenize('qr'), 5))[0]!.href, '#/tool/qr-code');
});

test('the English stash is searchable; the LOCALIZED name is what displays (section 2e)', async () => {
  const hits = await utilities.search(tokenize('compress'), 5);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.title, 'PDF verkleinern');
});

test('listed:false tools never surface', async () => {
  const hits = await tools.search(tokenize('asset export'), 5);
  assert.ok(!hits.some((h) => h.href === '#/tool/asset-export'));
});

test('weighting: a name hit outranks a tag-only hit; both surface', async () => {
  const hits = await tools.search(tokenize('chart'), 5);
  assert.deepEqual(hits.map((h) => h.href), ['#/tool/chart-creator', '#/tool/imperfections']);
  assert.ok(hits[0]!.score > hits[1]!.score);
});

test('limit slices after ranking', async () => {
  const hits = await tools.search(tokenize('chart'), 1);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.href, '#/tool/chart-creator');
});

test('hits carry a glyph and no subtitle (raw category ids read poorly)', async () => {
  const [hit] = await tools.search(tokenize('qr'), 5);
  assert.ok(hit!.icon.includes('<svg'));
  assert.equal(hit!.subtitle, undefined);
});

test('a re-sync (new index OBJECT) invalidates the WeakMap haystack cache', async () => {
  setIndex([{ id: 'street-map', name: 'Street Map', tags: ['map'], category: 'designer' }]);
  const hits = await tools.search(tokenize('street'), 5);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.href, '#/tool/street-map');
  // The old index's tools went with the old object.
  assert.equal((await tools.search(tokenize('qr'), 5)).length, 0);
  setIndex(TOOLS); // restore for any later test
});

test('no index at all → empty, never a throw', async () => {
  (window as unknown as { __toolIndex?: unknown }).__toolIndex = undefined;
  assert.deepEqual(await tools.search(tokenize('qr'), 5), []);
  setIndex(TOOLS);
});
