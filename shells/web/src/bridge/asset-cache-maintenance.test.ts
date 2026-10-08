// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { pruneAssetCache, syncAssetIndex } from './asset-cache-maintenance.ts';
import type { AssetsDb, AssetMetaRecord } from './assets.ts';
const id = 'ext/dam/example', file = 'a'.repeat(24), variant = `${id}?file=${file}`;
function group(version = '2'): AssetMetaRecord {
  const url = `/catalog/${id}/file.jpg`;
  return { id, type: 'raster', version, tier: 'on-demand', formats: [{ format: 'jpg', url }],
    meta: { assetFiles: [{ id: file, name: 'Variation.jpg', format: 'jpg', url }] } };
}
function fixture(keys: string[], metas: AssetMetaRecord[] = []) {
  const blobs = new Set(keys), records = new Map(metas.map(m => [m.id, m]));
  const db = { getAllKeys: async (s: string) => [...(s === 'asset-blob' ? blobs : records.keys())], getAll: async () => [...records.values()],
    delete: async (_s: string, key: string) => { blobs.delete(key); }, put: async () => {},
    transaction: (s: string) => ({ store: { delete: async (key: string) => { if (s === 'asset-blob') blobs.delete(key); else records.delete(key); },
      put: async (value: AssetMetaRecord) => { records.set(value.id, value); } }, done: Promise.resolve() }) } as unknown as AssetsDb;
  const evicted: string[] = [], urls = { evict: (key: string) => { evicted.push(key); }, evictPrefix: (key: string) => { evicted.push(key); } };
  return { db, blobs, records, evicted, urls };
}
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
