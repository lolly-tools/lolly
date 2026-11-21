// SPDX-License-Identifier: MPL-2.0
/**
 * The one preview store (plan 373) over the in-memory IndexedDB: pictures stored
 * once by content, owners pointing at them, a picture leaving with its last
 * owner, and the session record, lean row and picture row moving together.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/bridge/preview-store.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IDBPDatabase } from 'idb';
import { memoryDb, PREVIEW_STORE_NAMES } from './idb-memory.test-utils.ts';
import type { StateDb, StateRecord } from './state.ts';

const store = await import('./preview-store.ts');
const rows = await import('./state-rows.ts');
const { createStateAPI } = await import('./state.ts');

const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
/** A real PNG data URL, made distinct by bytes after its end chunk. */
export function png(tag = ''): string {
  const bytes = [...atob(PNG_1x1)].map(c => c.charCodeAt(0)).concat([...new TextEncoder().encode(tag)]);
  return `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`;
}
const svg = (label: string): string => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48"><text>${label}</text></svg>`)}`;

function setup(options: { without?: readonly string[] } = {}) {
  const { db: memory, stores } = memoryDb(options);
  const db = memory as unknown as IDBPDatabase;
  return { db, stores, count: (name: string) => stores.get(name)?.size ?? 0 };
}
async function prepared(url: string) {
  const picture = await store.preparePicture(url, 'legacy');
  assert.ok(picture && store.isPrepared(picture), `prepared ${url.slice(0, 30)}`);
  return picture;
}

test('equal bytes are stored once; owners share them and the picture leaves with the last owner', async () => {
  const { db, count } = setup();
  const picture = await prepared(png('a'));
  let tx = db.transaction([...store.PREVIEW_STORES], 'readwrite') as unknown as import('./preview-store.ts').PictureTx;
  await store.bindOwner(tx, store.sessionOwner('one'), 'session', picture);
  await store.bindOwner(tx, store.revisionOwner('r1'), 'revision', picture);
  await store.bindOwner(tx, store.exportOwner('e1'), 'export', picture.ref);
  await tx.done;
  assert.equal(count('preview-blobs'), 1, 'one picture for three owners');
  assert.equal(count('preview-index'), 3);
  tx = db.transaction([...store.PREVIEW_STORES], 'readwrite') as unknown as import('./preview-store.ts').PictureTx;
  await store.releaseOwner(tx, store.sessionOwner('one'));
  await store.releaseOwner(tx, store.revisionOwner('r1'));
  await tx.done;
  assert.equal(count('preview-blobs'), 1, 'still held by the export');
  tx = db.transaction([...store.PREVIEW_STORES], 'readwrite') as unknown as import('./preview-store.ts').PictureTx;
  await store.releaseOwner(tx, store.exportOwner('e1'));
  await tx.done;
  assert.equal(count('preview-blobs'), 0, 'gone with its last owner');
});

test('rebinding an owner frees the picture it held, and a bare reference binds only to bytes that are here', async () => {
  const { db, count } = setup();
  const a = await prepared(png('a')), b = await prepared(png('b'));
  let tx = db.transaction([...store.PREVIEW_STORES], 'readwrite') as unknown as import('./preview-store.ts').PictureTx;
  await store.bindOwner(tx, 'session:x', 'session', a);
  await store.bindOwner(tx, 'session:x', 'session', b);
  await tx.done;
  assert.equal(count('preview-blobs'), 1, 'the replaced picture went');
  tx = db.transaction([...store.PREVIEW_STORES], 'readwrite') as unknown as import('./preview-store.ts').PictureTx;
  const bound = await store.bindOwner(tx, 'session:y', 'session', { ...a.ref });
  await tx.done;
  assert.equal(bound, null, 'a reference to bytes that are not here binds nothing');
});

test('preparePicture: data URLs become bytes with a route; junk is null; a received SVG is refused without a sanitiser', async () => {
  const p = await store.preparePicture(png('x'), 'legacy');
  assert.ok(p && store.isPrepared(p));
  assert.equal(p.ref.route, 'legacy');
  assert.equal(await store.preparePicture('data:image/png;base64,AAAA', 'legacy'), null, 'zeros are not a PNG');
  assert.equal(await store.preparePicture('https://tracker.example/pixel.png'), null);
  assert.equal(await store.preparePicture(null), null);
  // Node has no DOM, so the SVG sanitiser cannot run: an SVG from outside is not
  // stored at all (fail closed). This device's own legacy SVG needs no sanitiser.
  assert.equal(await store.preparePicture(svg('hi'), 'received'), null);
  const own = await store.preparePicture(svg('hi'), 'legacy');
  assert.ok(own && store.isPrepared(own) && own.ref.type === 'image/svg+xml');
});

test('putStateRecord writes the record, its lean row and its picture row together', async () => {
  const { db, stores } = setup();
  const picture = await prepared(svg('lean'));
  const tx = db.transaction(store.scopeFor(db, ['state']), 'readwrite') as unknown as import('./preview-store.ts').PictureTx;
  const record = { slot: 's1', toolId: 'poster', toolVersion: '1', label: 'Hello', data: { __toolId: 'poster', title: 'x', __export_filename: 'hello' }, thumb: null, updatedAt: '2026-11-21T10:00:00.000Z' } as StateRecord;
  await rows.putStateRecord(tx, await rows.withPicture(tx, record, picture));
  await tx.done;
  const lean = stores.get('state-list')!.get(JSON.stringify('s1'))!.value as Record<string, unknown>;
  assert.equal(lean.label, 'Hello');
  assert.equal(lean.filename, 'hello');
  assert.equal((lean.preview as { key: string }).key, picture.ref.key);
  assert.ok(!('data' in lean), 'the lean row carries no document');
  assert.equal(stores.get('preview-index')!.has(JSON.stringify('session:s1')), true);
  const tx2 = db.transaction(store.scopeFor(db, ['state']), 'readwrite') as unknown as import('./preview-store.ts').PictureTx;
  await rows.deleteStateRecord(tx2, 's1');
  await tx2.done;
  assert.equal(stores.get('state-list')!.size, 0);
  assert.equal(stores.get('preview-blobs')!.size, 0, 'the picture left with the session');
});

test('a session write whose transaction left out the lean list is refused, so the two never drift', async () => {
  const { db } = setup();
  const tx = db.transaction(['state'], 'readwrite') as unknown as import('./preview-store.ts').PictureTx;
  await assert.rejects(() => rows.putStateRecord(tx, { slot: 'z', toolId: 'a', toolVersion: '1', label: 'z', data: {}, thumb: null, updatedAt: 'x' } as unknown as StateRecord), /scopeFor/);
});

test('state API: save stores a picture by reference; a rename keeps it; new work drops it; a copy shares it', async () => {
  const { db, count } = setup();
  const state = createStateAPI(db as unknown as StateDb);
  const picture = await prepared(png('save'));
  await state.save('poster:1', { __toolId: 'poster', title: 'a' }, picture);
  let [row] = await state.list();
  assert.equal(row!.thumb, null);
  assert.equal(row!.preview?.key, picture.ref.key);
  await state.save('poster:1', { __toolId: 'poster', title: 'a', __label: 'Renamed' });
  [row] = await state.list();
  assert.equal(row!.preview?.key, picture.ref.key, 'a rename keeps the picture');
  await state.save('poster:2', { __toolId: 'poster', title: 'a', __label: 'Copy' }, row!.preview);
  assert.equal(count('preview-blobs'), 1, 'the copy names the same bytes');
  await state.save('poster:1', { __toolId: 'poster', title: 'changed' });
  const list = await state.list();
  assert.equal(list.find(r => r.slot === 'poster:1')!.preview, undefined, 'new work does not keep an old picture');
  assert.equal(list.find(r => r.slot === 'poster:2')!.preview?.key, picture.ref.key);
  assert.equal(count('preview-blobs'), 1);
  const blob = await state.picture!({ slot: 'poster:2' });
  assert.equal(blob?.type, 'image/png');
  assert.equal(await state.pictureDataUrl!({ slot: 'poster:2' }), png('save'), 'the data URL a pack carries is rebuilt exactly');
});

test('state API on a database without the preview store keeps pictures on the record, as before', async () => {
  const { db, stores } = setup({ without: PREVIEW_STORE_NAMES });
  const state = createStateAPI(db as unknown as StateDb);
  const picture = await prepared(png('old'));
  await state.save('poster:1', { __toolId: 'poster' }, picture);
  const record = stores.get('state')!.get(JSON.stringify('poster:1'))!.value as StateRecord;
  assert.equal(record.thumb, png('old'), 'a data URL on the record');
  assert.equal(record.preview, undefined);
  const [row] = await state.list();
  assert.equal(row!.thumb, png('old'));
});

test('a save keeps its picture when another tab lets go of the picture\'s only other owner between storing the bytes and writing the record', async () => {
  const { db, count } = setup();
  const here = createStateAPI(db as unknown as StateDb);
  const otherTab = createStateAPI(db as unknown as StateDb);
  const picture = await prepared(png('shared'));
  await otherTab.save('poster:1', { __toolId: 'poster', title: 'first' }, picture);
  // The bytes a save stores in a transaction of its own; once that commits, the
  // other tab deletes poster:1, the picture's only owner, and the bytes go with it.
  const original = db.transaction.bind(db);
  let interfere = true;
  (db as unknown as { transaction: typeof db.transaction }).transaction = ((names: string | string[], mode?: IDBTransactionMode) => {
    const tx = original(names as never, mode);
    if (interfere && Array.isArray(names) && names.length === 1 && names[0] === 'preview-blobs') {
      interfere = false;
      const done = tx.done.then(() => otherTab.delete('poster:1'));
      return Object.assign(Object.create(Object.getPrototypeOf(tx)), tx, { done });
    }
    return tx;
  }) as typeof db.transaction;
  await here.save('poster:2', { __toolId: 'poster', title: 'second' }, picture);
  assert.equal(interfere, false, 'the other tab did let go in between');
  const [row] = await here.list();
  assert.equal(row!.slot, 'poster:2');
  assert.equal(row!.preview?.key, picture.ref.key, 'the record still points at its picture');
  assert.equal(count('preview-blobs'), 1, 'and the bytes are there');
  assert.equal(await here.pictureDataUrl!({ slot: 'poster:2' }), png('shared'));
});

test('an idle redraw is not attached over a picture that arrived while it drew', async () => {
  const { db } = setup();
  const state = createStateAPI(db as unknown as StateDb);
  const { attachSessionPicture } = await import('../lib/preview-cache.ts');
  await state.save('poster:1', { __toolId: 'poster', title: 'a' }, await prepared(png('first')));
  const before = await db.get('state', 'poster:1') as StateRecord;
  // A capture attaches a new picture meanwhile; attaching keeps the record's times.
  const capture = await prepared(png('capture'));
  const tx = db.transaction(store.scopeFor(db, ['state']), 'readwrite');
  await rows.putStateRecord(tx, await rows.withPicture(tx, await tx.objectStore('state').get('poster:1') as StateRecord, capture));
  await tx.done;
  assert.equal((await db.get('state', 'poster:1') as StateRecord).updatedAt, before.updatedAt);
  const redraw = await prepared(png('redraw'));
  assert.equal(await attachSessionPicture(db, 'poster:1', { updatedAt: before.updatedAt, thumb: before.thumb, preview: before.preview }, redraw), null);
  assert.equal(await state.pictureDataUrl!({ slot: 'poster:1' }), png('capture'), 'the capture stays');
  // Unchanged since it was read: the redraw is attached.
  const now = await db.get('state', 'poster:1') as StateRecord;
  assert.ok(await attachSessionPicture(db, 'poster:1', { updatedAt: now.updatedAt, thumb: now.thumb, preview: now.preview }, redraw));
  assert.equal(await state.pictureDataUrl!({ slot: 'poster:1' }), png('redraw'));
});
