// SPDX-License-Identifier: MPL-2.0
/**
 * The Catalogue spotlight provider (plans/99 section 2b) over fake assets: recall via
 * the shared catalog-filter haystack (name/id/tags/category/format) with
 * diacritic folding on top, the view-mirroring visibility rules (visual types
 * only, user audio + neurospicy audio, no profile headshot), the #/c?asset=
 * focus href, category/format subtitles, and the short-lived load cache.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/search/providers/catalog.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// jsdom globals BEFORE the dynamic import (the co-located suite convention).
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;

const { createCatalogProvider } = await import('./catalog.ts');
const { tokenize } = await import('../match.ts');

const catalogAssets = [
  { source: 'library', id: 'suse/logo/primary', type: 'vector', format: 'svg', url: '', meta: { name: 'Primary Logo', tags: ['logo'] } },
  { source: 'library', id: 'suse/font/main', type: 'font', format: 'woff2', url: '', meta: { name: 'Main Brandfont' } },      // non-visual → never listed
  { source: 'library', id: 'suse/music/lofi', type: 'audio', format: 'mp3', url: '', meta: { name: 'Lofi Loop', tags: ['neurospicy'] } }, // focus music → listed
  { source: 'library', id: 'suse/music/bed', type: 'audio', format: 'mp3', url: '', meta: { name: 'Musicbed' } },             // plain catalog audio → not listed
];
const userAssets = [
  { source: 'user', id: 'user/naive-photo', type: 'raster', format: 'png', url: '', meta: { name: 'Naïve Photo' } },
  { source: 'user', id: 'user/headshot', type: 'raster', format: 'png', url: '', meta: { name: 'Headshot' } },
  { source: 'user', id: 'user/hum', type: 'audio', format: 'wav', url: '', meta: { name: 'Voice Hum' } }, // the user's OWN audio → listed
];
let queryCalls = 0;
const host = {
  assets: {
    query: async () => { queryCalls++; return catalogAssets as never[]; },
    _listUserAssets: async () => userAssets as never[],
  },
};

const provider = createCatalogProvider(host);

test('a catalog asset matches by name; hit shape carries the scoped-list deep link + category subtitle', async () => {
  const hits = await provider.search(tokenize('primary'), 5);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.title, 'Primary Logo');
  // plans/99 section 5 locked target: the #/c?q= scoped list keyed on the asset's
  // name - never #/c?asset=, which opens the per-asset details modal.
  assert.equal(hits[0]!.href, '#/c?q=Primary%20Logo');
  assert.equal(hits[0]!.subtitle, 'Logos'); // lib/asset-category off the 'logo' tag
  assert.ok(hits[0]!.icon.includes('<svg'));
});

test('diacritics fold; an uncategorised asset subtitles with its format', async () => {
  const hits = await provider.search(tokenize('naive'), 5);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.title, 'Naïve Photo');
  assert.equal(hits[0]!.subtitle, 'png');
});

test('visibility mirrors the catalogue view: no fonts, no plain catalog audio, no headshot', async () => {
  assert.deepEqual(await provider.search(tokenize('brandfont'), 5), []);
  assert.deepEqual(await provider.search(tokenize('musicbed'), 5), []);
  assert.deepEqual(await provider.search(tokenize('headshot'), 5), []);
  // …but neurospicy focus audio and the user's own audio DO list.
  assert.equal((await provider.search(tokenize('lofi'), 5)).length, 1);
  assert.equal((await provider.search(tokenize('hum'), 5)).length, 1);
});

test('the load cache holds for a burst: one assets.query across calls', async () => {
  const n = queryCalls;
  await provider.search(tokenize('primary'), 5);
  await provider.search(tokenize('naive'), 5);
  assert.equal(queryCalls, n);
});

test('a host without _listUserAssets still serves catalog hits', async () => {
  const bare = createCatalogProvider({ assets: { query: async () => catalogAssets as never[] } });
  assert.equal((await bare.search(tokenize('primary'), 5)).length, 1);
});

test('a failing host yields empty, never a throw', async () => {
  const broken = createCatalogProvider({
    assets: {
      query: async () => { throw new Error('down'); },
      _listUserAssets: async () => { throw new Error('down'); },
    },
  });
  assert.deepEqual(await broken.search(tokenize('primary'), 5), []);
});
