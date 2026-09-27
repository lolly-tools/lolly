// SPDX-License-Identifier: MPL-2.0
/**
 * The assets bridge's half of the Trash (plan 277 P3): moving an upload to the
 * Trash is a mark on its record, not a move, so the id, the bytes and every saved
 * design that uses the picture stay intact while each list leaves the upload out.
 *
 * Run directly:  node --test shells/web/src/bridge/assets-trash.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAssetsAPI } from './assets.ts';

function fakeDb(seed: Array<Record<string, unknown>>) {
  const rows = new Map<string, Record<string, unknown>>(seed.map(r => [String(r.id), r]));
  return {
    rows,
    db: {
      get: async (_store: string, id: string) => rows.get(id),
      getAll: async (_store: string) => [...rows.values()],
      put: async (_store: string, record: { id: string }) => { rows.set(record.id, record as Record<string, unknown>); },
      delete: async (_store: string, id: string) => { rows.delete(id); },
    },
  };
}

const upload = (id: string, name: string) => ({
  id, type: 'raster', format: 'png', version: 'v1', aiGenerated: 'partial',
  blob: new Blob(['png-bytes'], { type: 'image/png' }), meta: { name },
});

test('a trashed upload leaves the list, keeps its record and bytes, and lists in the Trash', async () => {
  const { rows, db } = fakeDb([upload('user/upload/2-a', 'Hero'), upload('user/upload/1-b', 'Map')]);
  const api = createAssetsAPI(db as never, {});
  assert.equal(await api._setUserAssetTrashed('user/upload/2-a', '2026-09-27T01:00:00.000Z'), true);
  assert.deepEqual((await api._listUserAssets()).map(r => r.id), ['user/upload/1-b']);
  const rec = rows.get('user/upload/2-a')!;
  assert.equal(rec.trashedAt, '2026-09-27T01:00:00.000Z');
  assert.ok(rec.blob instanceof Blob, 'the bytes stay until the Trash is emptied');
  assert.equal(rec.version, 'v1', 'no version bump: nothing about the picture changed');
  assert.deepEqual(await api._listTrashedUserAssets(), [
    { id: 'user/upload/2-a', type: 'raster', name: 'Hero', trashedAt: '2026-09-27T01:00:00.000Z', bytes: 9 },
  ]);
});

test('restore clears the mark and the upload is back in the list', async () => {
  const { rows, db } = fakeDb([upload('user/upload/2-a', 'Hero')]);
  const api = createAssetsAPI(db as never, {});
  await api._setUserAssetTrashed('user/upload/2-a', '2026-09-27T01:00:00.000Z');
  await api._setUserAssetTrashed('user/upload/2-a', null);
  assert.equal('trashedAt' in rows.get('user/upload/2-a')!, false);
  assert.deepEqual((await api._listUserAssets()).map(r => r.id), ['user/upload/2-a']);
  assert.deepEqual(await api._listTrashedUserAssets(), []);
});

test('marking an upload that is gone reports false and writes nothing', async () => {
  const { rows, db } = fakeDb([]);
  const api = createAssetsAPI(db as never, {});
  assert.equal(await api._setUserAssetTrashed('user/upload/9-x', '2026-09-27T01:00:00.000Z'), false);
  assert.equal(rows.size, 0);
});

test('review B3: the Trash deletes an upload only while it still carries that mark', async () => {
  const { rows, db } = fakeDb([upload('user/upload/2-a', 'Hero')]);
  const api = createAssetsAPI(db as never, {});
  await api._setUserAssetTrashed('user/upload/2-a', '2026-09-27T01:00:00.000Z');
  await api._setUserAssetTrashed('user/upload/2-a', null);            // restored meanwhile
  assert.equal(await api._deleteTrashedUserAsset('user/upload/2-a', '2026-09-27T01:00:00.000Z'), false);
  assert.ok(rows.has('user/upload/2-a'), 'a live upload is never deleted');
  await api._setUserAssetTrashed('user/upload/2-a', '2026-09-27T02:00:00.000Z');   // deleted again
  assert.equal(await api._deleteTrashedUserAsset('user/upload/2-a', '2026-09-27T01:00:00.000Z'), false, 'nor under an older mark');
  assert.ok(rows.has('user/upload/2-a'));
  assert.equal(await api._deleteTrashedUserAsset('user/upload/2-a', '2026-09-27T02:00:00.000Z'), true);
  assert.equal(rows.has('user/upload/2-a'), false);
});

test('review B3: a mark is set or cleared only against the mark expected', async () => {
  const { rows, db } = fakeDb([upload('user/upload/2-a', 'Hero')]);
  const api = createAssetsAPI(db as never, {});
  assert.equal(await api._setUserAssetTrashed('user/upload/2-a', '2026-09-27T01:00:00.000Z', { expect: null }), true);
  assert.equal(await api._setUserAssetTrashed('user/upload/2-a', '2026-09-27T09:00:00.000Z', { expect: null }), false, 'an upload already in the Trash keeps its date');
  assert.equal(await api._setUserAssetTrashed('user/upload/2-a', null, { expect: '2026-09-27T09:00:00.000Z' }), false, 'a stale restore unmarks nothing');
  assert.equal(rows.get('user/upload/2-a')!.trashedAt, '2026-09-27T01:00:00.000Z');
});
