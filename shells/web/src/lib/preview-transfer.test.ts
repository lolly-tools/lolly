// SPDX-License-Identifier: MPL-2.0
/**
 * Formats that leave the device do not change (plan 373, section 5.9): a backup, a
 * device sync record and a `.lolly` still carry each session's picture as the data
 * URL they always carried. Pictures now live once in the preview store, so these
 * pin both directions: what an older build wrote comes in and shows, and what this
 * build writes from stored bytes is byte for byte what an older build wrote (so an
 * older build reads the file). Raster pictures are compared byte for byte; an SVG from
 * outside is sanitised before it is stored, so it is compared as a picture.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/preview-transfer.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strToU8 } from 'fflate';
import type { IDBPDatabase } from 'idb';
import { memoryDb } from '../bridge/idb-memory.test-utils.ts';
import type { StateDb } from '../bridge/state.ts';

const { createStateAPI } = await import('../bridge/state.ts');
const { restoreBackupSessions, packBackupSessions } = await import('./backup-sessions.ts');
const { rowPictureDataUrl, rowPicture } = await import('./session-picture.ts');

const PNG_HEAD = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==');
const png = (tag: string): string => `data:image/png;base64,${btoa(PNG_HEAD + tag)}`;
const T = '2026-10-01T09:00:00.000Z';

function device() {
  const { db: memory, stores } = memoryDb();
  const db = memory as unknown as IDBPDatabase;
  return { db, stores, state: createStateAPI(db as unknown as StateDb) };
}

test('a backup an older build wrote restores with its pictures, and a backup this build writes carries the same field byte for byte', async () => {
  const older = [
    { slot: 'poster:1', toolId: 'poster', toolVersion: '1', label: 'One', thumb: png('one'), updatedAt: T, data: { __toolId: 'poster', title: 'one' } },
    { slot: 'poster:2', toolId: 'poster', toolVersion: '1', label: 'Two', thumb: null, updatedAt: T, data: { __toolId: 'poster', title: 'two' } },
  ];
  const { state, stores } = device();
  await restoreBackupSessions(state as never, { 'sessions.json': strToU8(JSON.stringify(older)) as Uint8Array<ArrayBuffer> }, { mode: 'sync', sameId: 'incoming' });
  const rows = await state.list();
  assert.equal(rows.find(r => r.slot === 'poster:1')!.thumb, null, 'stored by reference here');
  assert.ok(rows.find(r => r.slot === 'poster:1')!.preview);
  assert.equal(stores.get('preview-blobs')!.size, 1);
  const entries: Record<string, unknown> = {};
  await packBackupSessions(state as never, entries as never, { mode: 'sync', sameId: 'incoming' });
  const written = JSON.parse(new TextDecoder().decode(entries['sessions.json'] as Uint8Array)) as typeof older;
  assert.equal(written.find(r => r.slot === 'poster:1')!.thumb, png('one'), 'the same data URL an older build wrote');
  assert.equal(written.find(r => r.slot === 'poster:2')!.thumb, null);
  assert.ok(written.every(r => 'thumb' in r) && written.every(r => !('preview' in r)), 'the row keeps its shape: a thumb field, no reference');
});

test('a session from an older peer (sync or beam, picture inline) shows its picture, and goes back out unchanged', async () => {
  const { state } = device();
  await state.restore!('poster:peer', { __toolId: 'poster', title: 'from an older phone' }, png('peer'), T, T);
  const row = (await state.list())[0]!;
  assert.ok(row.preview, 'kept by reference');
  assert.equal(await state.picture!(row.preview!).then(b => b?.type), 'image/png', 'the reader gets its bytes');
  assert.equal(await rowPictureDataUrl(state, row), png('peer'), 'what this device pushes back is what it received');
});

test('a rename, a copy and a move to the Trash keep the stored picture without reading it', async () => {
  const { state, stores } = device();
  await state.save('poster:1', { __toolId: 'poster', title: 'x' }, png('kept'));
  const row = (await state.list())[0]!;
  await state.save('__trash__:poster:1', { __toolId: 'poster', title: 'x' }, rowPicture(row));
  await state.delete('poster:1');
  const moved = (await state.list())[0]!;
  assert.equal(moved.slot, '__trash__:poster:1');
  assert.equal(moved.preview?.key, row.preview?.key);
  assert.equal(stores.get('preview-blobs')!.size, 1, 'one picture throughout');
});
