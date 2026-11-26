// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { holdCatalogAssets, holdFallbackFonts, pruneAssetCache, syncAssetIndex } from './asset-cache-maintenance.ts';
import type { AssetsDb, AssetMetaRecord } from './assets.ts';
const id = 'ext/dam/example', file = 'a'.repeat(24), variant = `${id}?file=${file}`;
function group(version = '2'): AssetMetaRecord {
  const url = `/catalog/${id}/file.jpg`;
  return { id, type: 'raster', version, tier: 'on-demand', formats: [{ format: 'jpg', url }],
    meta: { assetFiles: [{ id: file, name: 'Variation.jpg', format: 'jpg', url }] } };
}
function fixture(keys: string[], metas: AssetMetaRecord[] = []) {
  const blobs = new Set(keys), records = new Map(metas.map(m => [m.id, m])), profile = new Map<string, unknown>();
  const db = { get: async (s: string, key: string) => s === 'profile' ? profile.get(key) : records.get(key), getAllKeys: async (s: string) => [...(s === 'asset-blob' ? blobs : records.keys())], getAll: async () => [...records.values()],
    delete: async (_s: string, key: string) => { blobs.delete(key); }, put: async (s: string, value: unknown, key: string) => { if (s === 'profile') profile.set(key, value); },
    transaction: (s: string) => ({ store: { delete: async (key: string) => { if (s === 'asset-blob') blobs.delete(key); else records.delete(key); },
      put: async (value: AssetMetaRecord) => { records.set(value.id, value); } }, done: Promise.resolve() }) } as unknown as AssetsDb;
  const evicted: string[] = [], urls = { evict: (key: string) => { evicted.push(key); }, evictPrefix: (key: string) => { evicted.push(key); } };
  return { db, blobs, records, profile, evicted, urls };
}
const pack = (id: string, version = '1'): AssetMetaRecord => ({ id, type: 'data', version, tier: 'on-demand', formats: [{ format: 'json', url: `/catalog/packs/emoji-packs/${id}.json` }] });
test('saved variation bytes survive pruning while unreferenced bytes and removed metadata leave', async () => {
  const current = `${variant}:jpg:2`, f = fixture([current, `${id}:jpg:2`, 'gone:jpg:1'], [group(), { ...group(), id: 'gone' }]);
  assert.deepEqual(await pruneAssetCache(f.db, [group()], new Set([current]), new Set(), f.urls), { blobs: 2, meta: 1 });
  assert.deepEqual([...f.blobs], [current]); assert.equal(f.records.has('gone'), false);
  assert.ok(f.evicted.includes(`library:${id}:jpg:2:look:`));
});
test('an explicit download keeps the previous variation until replacement bytes are present', async () => {
  const old = `${variant}:jpg:1`, current = `${variant}:jpg:2`, f = fixture([old]);
  await pruneAssetCache(f.db, [group()], new Set(), new Set([id]), f.urls); assert.ok(f.blobs.has(old));
  f.blobs.add(current); await pruneAssetCache(f.db, [group()], new Set(), new Set([id]), f.urls);
  assert.deepEqual([...f.blobs], [current]);
});
test('a DAM URL change at the same version retires old group and variation bytes', async () => {
  const f = fixture([`${id}:jpg:2`, `${variant}:jpg:2`], [group()]); const changed = group();
  changed.formats[0]!.url += '?new'; const invalidated: string[] = [];
  await syncAssetIndex(f.db, [changed], undefined, key => { invalidated.push(key); });
  assert.deepEqual([...f.blobs], []); assert.deepEqual(new Set(invalidated), new Set([`${id}:jpg:2`, `${variant}:jpg:2`]));
  assert.equal(f.records.get(id), changed);
});

test('a partial index keeps saved provider files without retaining unselected catalog pages', async () => {
  const saved = `${variant}:jpg:2`, held = { ...group(), provider: 'dam' };
  const unused = { ...held, id: 'ext/dam/unused' };
  const f = fixture([saved, 'ext/dam/unused:jpg:2'], [held, unused]);
  await pruneAssetCache(f.db, [], new Set([saved]), new Set(), f.urls, ['dam']);
  assert.equal(f.records.has(id), true); assert.equal(f.blobs.has(saved), true);
  assert.equal(f.records.has(unused.id), false); assert.equal(f.blobs.has('ext/dam/unused:jpg:2'), false);
  await pruneAssetCache(f.db, [], new Set([saved]), new Set(), f.urls, []);
  assert.equal(f.records.has(id), false, 'a removed source is not mistaken for a deferred page');
  const downloaded = fixture([saved], [held]);
  await pruneAssetCache(downloaded.db, [], new Set(), new Set([variant]), downloaded.urls, ['dam']);
  assert.equal(downloaded.records.has(id), true, 'an explicit selected-file download retains its group metadata');
  assert.equal(downloaded.blobs.has(saved), true);
});

test('a held emoji pack survives the prune of files nothing saved refers to', async () => {
  const current = [pack('set/held'), pack('set/browsed')];
  const f = fixture(['set/held:json:1', 'set/browsed:json:1'], current);
  await holdCatalogAssets(f.db, ['set/held']);
  await pruneAssetCache(f.db, current, new Set(), new Set(), f.urls);
  assert.deepEqual([...f.blobs], ['set/held:json:1'], 'without this the set is gone at the next catalog sync, and offline draws placeholders');
});

test('a saved document keeps the exact pack file it names, past a new release', async () => {
  const f = fixture(['set/a:json:1', 'set/a:json:2'], [pack('set/a', '2')]);
  await pruneAssetCache(f.db, [pack('set/a', '2')], new Set(['set/a:json:1']), new Set(), f.urls);
  assert.deepEqual([...f.blobs], ['set/a:json:1'], 'the pinned release stays, and an unreferenced current file leaves');
});

test('a new release replaces a held pack only once its file has arrived', async () => {
  const f = fixture(['set/a:json:1'], [pack('set/a', '2')]);
  await holdCatalogAssets(f.db, ['set/a']);
  await pruneAssetCache(f.db, [pack('set/a', '2')], new Set(), new Set(), f.urls);
  assert.ok(f.blobs.has('set/a:json:1'), 'nothing is dropped before its replacement is on the device');
  f.blobs.add('set/a:json:2');
  await pruneAssetCache(f.db, [pack('set/a', '2')], new Set(), new Set(), f.urls);
  assert.deepEqual([...f.blobs], ['set/a:json:2']);
});

test('the held list stays short, newest first, so trying every set does not keep every set', async () => {
  const f = fixture([]);
  for (const id of ['one', 'two', 'three', 'four']) await holdCatalogAssets(f.db, [id]);
  assert.deepEqual(f.profile.get('held-catalog-assets'), ['four', 'three', 'two']);
  await holdCatalogAssets(f.db, ['two']);
  assert.deepEqual(f.profile.get('held-catalog-assets'), ['two', 'four', 'three'], 'using a set moves it to the front');
  await holdCatalogAssets(f.db, ['a', 'b', 'c', 'd']);
  assert.deepEqual(f.profile.get('held-catalog-assets'), ['a', 'b', 'c', 'd'], 'a style with many fallbacks still keeps all of them');
});

test('a fallback font used once survives prunes, and trying emoji sets never evicts it', async () => {
  const font = (id: string): AssetMetaRecord => ({ id, type: 'data', version: '2.12.0', tier: 'on-demand', formats: [{ format: 'woff2', url: `/catalog/packs/fallback-fonts/${id}.woff2` }] });
  const arabic = font('community/fallback-font/noto-sans-arabic'), browsed = font('community/fallback-font/noto-sans-thai');
  const sets = ['set/a', 'set/b', 'set/c', 'set/d'].map((id) => pack(id));
  const keys = [`${arabic.id}:woff2:2.12.0`, `${browsed.id}:woff2:2.12.0`, ...sets.map((s) => `${s.id}:json:1`)];
  const f = fixture(keys, [arabic, browsed, ...sets]);
  await holdFallbackFonts(f.db, [arabic.id]);
  for (const s of sets) await holdCatalogAssets(f.db, [s.id]);
  await pruneAssetCache(f.db, [arabic, browsed, ...sets], new Set(), new Set(), f.urls);
  assert.ok(f.blobs.has(`${arabic.id}:woff2:2.12.0`), 'a script drawn once still draws offline');
  assert.equal(f.blobs.has(`${browsed.id}:woff2:2.12.0`), false, 'a font no document used is not kept');
  assert.deepEqual(f.profile.get('held-fallback-fonts'), [arabic.id], 'on a list of its own, never an upload');
});
