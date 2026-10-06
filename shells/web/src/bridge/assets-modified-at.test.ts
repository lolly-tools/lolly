// SPDX-License-Identifier: MPL-2.0
/**
 * Every content or metadata edit to an upload stamps `meta.modifiedAt` (plan 277
 * P7, review S2), so the newer-copy import rule (lib/backup-sessions.ts
 * assetRecordsToImport) carries a rename, an alt-text or credit edit, or a
 * regenerated speech take to another browser. A provenance heal is not an edit
 * and keeps the stamp, so a copy healed here cannot beat a take regenerated elsewhere.
 *
 * Run directly:  node --test shells/web/src/bridge/assets-modified-at.test.ts
 */
import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAssetsAPI } from './assets.ts';

function fakeDb(seed: Record<string, unknown>) {
  const rows = new Map<string, Record<string, unknown>>([[String(seed.id), seed as Record<string, unknown>]]);
  return {
    rows,
    db: {
      get: async (_store: string, id: string) => rows.get(id),
      put: async (_store: string, record: { id: string }) => { rows.set(record.id, record as Record<string, unknown>); },
    },
  };
}
const upload = () => ({ id: 'user/upload/1-a', type: 'raster', format: 'png', version: '1', blob: new Blob(['png']), meta: { name: 'Hero', modifiedAt: 1000 } });
const stamp = (rows: Map<string, Record<string, unknown>>) => (rows.get('user/upload/1-a')!.meta as { modifiedAt?: number }).modifiedAt;

afterEach(() => { mock.timers.reset(); });

test('a rename, a metadata edit and new bytes each stamp modifiedAt', async () => {
  mock.timers.enable({ apis: ['Date'], now: 5000 });
  const { rows, db } = fakeDb(upload());
  const api = createAssetsAPI(db as never, {});
  await api._renameUserAsset('user/upload/1-a', 'Hero shot');
  assert.equal(stamp(rows), 5000);

  mock.timers.setTime(6000);
  await api._updateUserAssetMeta('user/upload/1-a', { ...(rows.get('user/upload/1-a')!.meta as object), alt: 'A lorikeet' });
  assert.equal(stamp(rows), 6000, 'the caller’s old stamp does not survive a metadata edit');

  mock.timers.setTime(7000);
  await api._replaceUserAssetBytes('user/upload/1-a', { blob: new Blob(['new take']) });
  assert.equal(stamp(rows), 7000);
});

test('a provenance heal keeps modifiedAt', async () => {
  mock.timers.enable({ apis: ['Date'], now: 9000 });
  const { rows, db } = fakeDb(upload());
  const api = createAssetsAPI(db as never, {});
  await api._restampUserAsset('user/upload/1-a', { blob: new Blob(['healed']), credential: new Uint8Array([1]), credentialFormat: 'wav' });
  assert.equal(stamp(rows), 1000);
});

test('head lookups preserve uploaded bytes and metadata with or without the current version', async () => {
  const record = upload();
  const { db } = fakeDb(record);
  const api = createAssetsAPI(db as never, {});
  assert.equal(await api._getUserRecord(record.id), record);
  assert.equal(await api._getUserRecord(record.id, record.version), record);
  assert.equal(await api._getUserRecord('user/missing'), null);
});
