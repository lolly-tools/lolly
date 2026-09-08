// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeVersionedUserAsset, type VersionedUserAsset } from './asset-history.ts';

function database(id: string, type: VersionedUserAsset['type']) {
  const current = new Map<string, VersionedUserAsset>([[id, { id, type, format: 'json', version: 'current', blob: new Blob(['original']) }]]);
  const snapshots = Array.from({ length: 20 }, (_, i) => ({ assetId: id, version: `saved-${i}`, bytes: 8, record: {} }));
  const store = (name: string) => ({
    get: async (key: string | string[]) => name === 'user-assets' ? current.get(String(key)) : snapshots.find(s => s.assetId === key[0] && s.version === key[1]),
    getAll: async () => snapshots,
    put: async (record: VersionedUserAsset) => { current.set(record.id, record); },
    add: async (record: any) => { snapshots.push(record); },
  });
  return {
    current, snapshots,
    db: { objectStoreNames: { contains: () => true }, get: (name: string, key: string) => store(name).get(key), getAll: async () => snapshots, put: async (_name: string, record: VersionedUserAsset) => { current.set(record.id, record); }, delete: async () => {}, transaction: () => ({ objectStore: store, done: Promise.resolve() }) },
  };
}

test('continuous colour saves stay writable after 20 legacy snapshots, without deleting history', async () => {
  for (const id of ['user/tokens/brand', 'user/ds/summer/tokens/brand']) {
    const { db, current, snapshots } = database(id, 'tokens');
    const before = structuredClone(snapshots);
    for (let i = 0; i < 25; i++) await writeVersionedUserAsset(db, { id, type: 'tokens', format: 'json', version: '1.0.0', blob: new Blob([JSON.stringify({ group: `Palette ${i}` })]) });
    assert.equal(await current.get(id)?.blob?.text(), '{"group":"Palette 24"}');
    assert.deepEqual(snapshots, before, 'existing recoverable versions are neither removed nor overwritten');
  }
});

test('the change does not weaken imported-version collisions or other assets’ history limits', async () => {
  const tokens = database('user/tokens/brand', 'tokens');
  await assert.rejects(writeVersionedUserAsset(tokens.db, { id: 'user/tokens/brand', type: 'tokens', format: 'json', version: 'current', blob: new Blob(['changed']) }, undefined, 'import'), /already identifies different bytes/);
  for (const [id, type] of [['user/upload/colours', 'tokens'], ['user/tokens/brand/v1', 'tokens'], ['user/upload/photo', 'raster']] as const) {
    const { db, current } = database(id, type);
    await assert.rejects(writeVersionedUserAsset(db, { id, type, format: 'json', blob: new Blob(['changed']) }), /versions are full/);
    assert.equal(await current.get(id)?.blob?.text(), 'original');
  }
});
