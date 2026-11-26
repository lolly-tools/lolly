// SPDX-License-Identifier: MPL-2.0
/**
 * The lean list of sessions and the move of old pictures into the preview store
 * (plan 373) over the in-memory IndexedDB, starting from libraries shaped the way
 * earlier builds left them: state records with data-URL thumbnails, History's
 * `revision-previews` strings and the export log's inline pictures.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/bridge/state-list.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IDBPDatabase } from 'idb';
import { memoryDb } from './idb-memory.test-utils.ts';
import type { StateDb, StateRecord } from './state.ts';

const list = await import('./state-list.ts');
const { createStateAPI } = await import('./state.ts');
const { createRevisionStore } = await import('./revision-history.ts');

const PNG_HEAD = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==');
const png = (tag: string): string => `data:image/png;base64,${btoa(PNG_HEAD + tag)}`;
const svg = (label: string): string => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><text>${label}</text></svg>`)}`;

function library(count: number, pictureOf: (i: number) => string | null) {
  const { db: memory, stores } = memoryDb();
  const db = memory as unknown as IDBPDatabase;
  for (let i = 0; i < count; i++) {
    const slot = `poster:${1000 + i}`;
    const record = {
      slot, toolId: 'poster', toolVersion: '1.0.0', label: `Poster ${i}`, data: { __toolId: 'poster', title: `T${i}`, __export_filename: `poster-${i}`, big: 'x'.repeat(200) },
      thumb: pictureOf(i), updatedAt: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(), createdAt: '2026-10-01T00:00:00.000Z',
      savedAt: '2026-10-01T00:00:00.000Z', formatVersion: 4, engineVersion: '1.349.0', designSystem: { id: 'ds', label: 'Demo' },
    };
    stores.get('state')!.set(JSON.stringify(slot), { key: slot, value: record });
  }
  return { db, stores };
}
const fullRows = (stores: ReturnType<typeof memoryDb>['stores']) => [...stores.get('state')!.values()].map(row => row.value as StateRecord);

test('before the pass, list() reads records whole and shows their legacy pictures, exactly as before', async () => {
  const { db } = library(3, i => png(`p${i}`));
  const state = createStateAPI(db as unknown as StateDb);
  assert.equal(await list.leanList(db), null, 'no lean list until every record is visited');
  const rows = await state.list();
  assert.equal(rows.length, 3);
  assert.equal(rows[0]!.thumb, png('p0'));
});

test('the pass moves every legacy picture, record by record, and the lean list then equals the full list on every field it carries', async () => {
  const { db, stores } = library(25, i => (i % 5 === 0 ? null : i % 2 ? svg(`s${i}`) : png(`p${i}`)));
  const state = createStateAPI(db as unknown as StateDb);
  const before = await state.list();
  const picturesBefore = before.filter(row => row.thumb).length;
  assert.equal(await list.migrateSessions(db, { batch: 4 }), true);
  assert.equal(await list.leanListReady(db), true);
  const after = await state.list();
  assert.equal(after.length, before.length);
  for (const row of after) {
    const was = before.find(r => r.slot === row.slot)!;
    for (const field of ['toolId', 'toolVersion', 'label', 'filename', 'updatedAt', 'createdAt', 'savedAt', 'designSystem'] as const) {
      assert.deepEqual(row[field], was[field], `${row.slot}.${field}`);
    }
    assert.equal(row.thumb, null, 'no legacy picture left on the row');
    assert.equal(!!row.preview, !!was.thumb, 'every picture is still there, by reference');
    if (was.thumb) assert.equal(await state.pictureDataUrl!(row.preview!), was.thumb, 'byte for byte the picture it was');
  }
  assert.equal(after.filter(row => row.preview).length, picturesBefore, 'the count of pictures is the count before the pass');
  assert.equal(fullRows(stores).filter(r => r.thumb).length, 0, 'no record keeps a thumb');
  assert.ok(fullRows(stores).every(r => !('preview' in r) || (r.preview as { route?: string }).route === 'legacy'), 'each moved picture says it is legacy');
});

test('an interrupted pass resumes where it stopped and loses nothing', async () => {
  const { db, stores } = library(12, i => png(`p${i}`));
  let steps = 0;
  assert.equal(await list.migrateSessions(db, { batch: 3, stop: () => ++steps > 2 }), false, 'stopped part way');
  const moved = fullRows(stores).filter(r => r.preview).length;
  assert.ok(moved > 0 && moved < 12, `part done (${moved})`);
  assert.equal(fullRows(stores).filter(r => r.thumb || r.preview).length, 12, 'every record still has its picture in one form or the other');
  // A new session saved while the pass is paused is written the new way.
  const state = createStateAPI(db as unknown as StateDb);
  await state.save('poster:new', { __toolId: 'poster', title: 'fresh' }, png('fresh'));
  assert.equal(await list.migrateSessions(db, { batch: 3 }), true, 'the next call finishes');
  assert.equal(fullRows(stores).filter(r => r.thumb).length, 0);
  assert.equal(fullRows(stores).filter(r => r.preview).length, 13);
  assert.equal((await state.list()).length, 13);
});

test('a record written while the pass holds a stale copy is read again, never moved from the stale copy', async () => {
  const { db, stores } = library(2, i => png(`p${i}`));
  const original = db.getAll.bind(db);
  let interfered = false;
  (db as unknown as { getAll: typeof db.getAll }).getAll = (async (...args: Parameters<typeof db.getAll>) => {
    const out = await original(...args);
    if (!interfered && args[0] === 'state') {
      interfered = true;
      // Another tab saves poster:1000 with a new picture after the pass read that record.
      const row = stores.get('state')!.get(JSON.stringify('poster:1000'))!;
      row.value = { ...(row.value as object), thumb: png('newer'), updatedAt: '2026-11-21T00:00:00.000Z' };
    }
    return out;
  }) as typeof db.getAll;
  assert.equal(await list.migrateSessions(db, { batch: 8 }), true);
  const state = createStateAPI(db as unknown as StateDb);
  const row = (await state.list()).find(r => r.slot === 'poster:1000')!;
  assert.equal(await state.pictureDataUrl!(row.preview!), png('newer'), 'the newer picture, not the one read first');
});

test('the lean list repairs itself: a record with no row gets one, a row with no record goes', async () => {
  const { db, stores } = library(3, () => null);
  await list.migrateSessions(db);
  stores.get('state')!.set(JSON.stringify('poster:extra'), { key: 'poster:extra', value: { slot: 'poster:extra', toolId: 'poster', toolVersion: '1', label: 'X', data: {}, thumb: null, updatedAt: '2026-11-21T00:00:00.000Z' } });
  stores.get('state')!.delete(JSON.stringify('poster:1000'));
  const rows = (await list.leanList(db))!;
  assert.deepEqual(rows.map(r => r.slot).sort(), ['poster:1001', 'poster:1002', 'poster:extra']);
  assert.equal(stores.get('state-list')!.has(JSON.stringify('poster:1000')), false);
});

test('a legacy picture that does not decode stays on its record and is still shown', async () => {
  const { db, stores } = library(1, () => 'data:image/png;base64,AAAA');
  assert.equal(await list.migrateSessions(db), true);
  assert.equal(fullRows(stores)[0]!.thumb, 'data:image/png;base64,AAAA', 'never deleted without a new form');
  const state = createStateAPI(db as unknown as StateDb);
  assert.equal((await state.list())[0]!.thumb, 'data:image/png;base64,AAAA');
});

test("History's data-URL previews move into the store; usage moves from text size to byte size", async () => {
  const { db: memory, stores } = memoryDb();
  const db = memory as unknown as IDBPDatabase;
  const state = createStateAPI(db as unknown as StateDb, createRevisionStore(db));
  const history = state.history!;
  const cursor = await history.current('qr-code:h');
  const entry = await history.checkpoint('qr-code:h', { __toolId: 'qr-code', url: 'a' }, { reason: 'save', expectedHead: cursor.head, expectedVersion: cursor.version });
  // As an earlier build left it: the preview as a string, counted by its text.
  const legacy = png('history');
  stores.get('revision-previews')!.set(JSON.stringify(entry.id), { key: entry.id, value: legacy });
  stores.get('revision-previews')!.set(JSON.stringify('gone'), { key: 'gone', value: png('orphan') });
  const text = new TextEncoder().encode(legacy).byteLength + new TextEncoder().encode(png('orphan')).byteLength;
  stores.get('revision-usage')!.set(JSON.stringify('total'), { key: 'total', value: { bytes: 0, previews: text } });
  assert.ok(await history.preview(entry.id), 'shown before the move, from the legacy store');
  assert.equal(await list.migrateRevisionPreviews(db), true);
  assert.equal(stores.get('revision-previews')!.size, 0, 'the legacy store emptied');
  assert.equal(stores.get('preview-index')!.has(JSON.stringify(`rev:${entry.id}`)), true);
  assert.ok(await history.preview(entry.id), 'shown after the move, from the store');
  assert.equal((await history.usage()).previews, PNG_HEAD.length + 'history'.length, 'counted by bytes now; the orphan went');
});

test('the export log moves its inline pictures and keeps every entry', async () => {
  const { db: memory, stores } = memoryDb();
  const db = memory as unknown as IDBPDatabase;
  stores.get('exports')!.set(JSON.stringify('e1'), { key: 'e1', value: { id: 'e1', toolId: 'poster', label: 'P', filename: 'p.png', format: 'png', thumb: png('export'), query: '', at: 1 } });
  stores.get('exports')!.set(JSON.stringify('e2'), { key: 'e2', value: { id: 'e2', toolId: 'poster', label: 'P', filename: 'q.png', format: 'png', thumb: null, query: '', at: 2 } });
  assert.equal(await list.migrateExportPictures(db), true);
  const e1 = stores.get('exports')!.get(JSON.stringify('e1'))!.value as { thumb: unknown; preview?: { key: string } };
  assert.equal(e1.thumb, null);
  assert.ok(e1.preview?.key);
  assert.equal(stores.get('exports')!.size, 2);
});

test('pictures nothing points at are swept only after an hour', async () => {
  const { db, stores } = library(0, () => null);
  stores.get('preview-blobs')!.set(JSON.stringify('a'.repeat(32)), { key: 'a'.repeat(32), value: { key: 'a'.repeat(32), size: 1, at: Date.now() } });
  stores.get('preview-blobs')!.set(JSON.stringify('b'.repeat(32)), { key: 'b'.repeat(32), value: { key: 'b'.repeat(32), size: 1, at: Date.now() - 2 * 3_600_000 } });
  assert.equal(await list.sweepOrphanPictures(db), 1);
  assert.equal(stores.get('preview-blobs')!.has(JSON.stringify('a'.repeat(32))), true, 'a write in flight keeps its bytes');
});

test('a thousand sessions: the lean list hands the page at most 0.5 MB, a small fraction of the full list', async () => {
  const { db } = library(1000, i => (i % 2 ? svg(`picture ${i} `.repeat(400)) : png('x'.repeat(4000 + i))));
  const state = createStateAPI(db as unknown as StateDb);
  const { serialize } = await import('node:v8');
  const fullBytes = serialize(await db.getAll('state')).byteLength;
  await list.migrateSessions(db, { batch: 50 });
  const leanBytes = serialize(await state.list()).byteLength;
  assert.ok(leanBytes <= 512 * 1024, `the plan's bound: ${leanBytes} bytes`);
  assert.ok(leanBytes * 10 < fullBytes, `lean ${leanBytes} against full ${fullBytes}`);
});

test('a picture attached while the pass prepares the old one is kept; the old picture is never moved over it', async () => {
  const { db } = library(1, () => png('old'));
  const store = await import('./preview-store.ts');
  const { attachSessionPicture } = await import('../lib/preview-cache.ts');
  const newer = await store.preparePicture(png('newer'), 'legacy');
  assert.ok(newer && store.isPrepared(newer));
  let attached = false;
  assert.equal(await list.migrateSessions(db, {
    batch: 4,
    // Between the pass reading the record and writing it, a capture attaches a
    // picture. Attaching keeps the record's times.
    beforeWrite: async () => {
      if (attached) return;
      const read = await db.get('state', 'poster:1000') as StateRecord;
      attached = !!await attachSessionPicture(db, 'poster:1000', { updatedAt: read.updatedAt, thumb: read.thumb, preview: read.preview }, newer);
    },
  }), true);
  assert.ok(attached);
  const state = createStateAPI(db as unknown as StateDb);
  const row = (await state.list())[0]!;
  assert.equal(row.preview?.key, newer.ref.key, 'the newer picture');
  assert.equal(await state.pictureDataUrl!(row.preview!), png('newer'));
});
