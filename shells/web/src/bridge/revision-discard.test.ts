// SPDX-License-Identifier: MPL-2.0
/**
 * Leave without saving discards the work (plan 277 P1). Driven through the real
 * state bridge and revision store over a small in-memory IndexedDB, so the saved
 * pointer, the adopt path, the discard and the History listing are the shipping
 * transactions, not stand-ins.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/bridge/revision-discard.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IDBPDatabase } from 'idb';

import { memoryDb } from './idb-memory.test-utils.ts';
const fakeDb = (): { db: IDBPDatabase; stores: ReturnType<typeof memoryDb>['stores'] } => {
  const { db, stores } = memoryDb();
  return { db: db as unknown as IDBPDatabase, stores };
};

const { createStateAPI } = await import('./state.ts');
const { createRevisionStore } = await import('./revision-history.ts');
const { createRevisionRecovery } = await import('./revision-recovery.ts');
const { discardUnsaved, restoredRecord } = await import('./revision-discard.ts');
const { isHiddenSlot, discardedAt, DISCARD_RETENTION_MS } = await import('../lib/batch-slots.ts');
import type { StateDb, StateRecord } from './state.ts';
import type { RevisionEntry } from './revision-history.ts';

function setup() {
  const { db, stores } = fakeDb();
  const state = createStateAPI(db as unknown as StateDb, createRevisionStore(db));
  return { db, stores, state, history: state.history! };
}
const doc = (url: string, extra: Record<string, unknown> = {}) => ({ __toolId: 'qr-code', __label: 'Launch QR', url, ...extra });
const THUMB = 'data:image/png;base64,iVBORw0KGgo=';
const visible = async (state: ReturnType<typeof setup>['state']) => (await state.list()).filter(row => !isHiddenSlot(row.slot)).map(row => row.slot);

/** An explicit save, as the tool's Save as does it (automatic history's save). */
async function explicitSave(history: ReturnType<typeof setup>['history'], slot: string, data: Record<string, unknown>) {
  const cursor = await history.current(slot);
  return history.checkpoint(slot, data, { reason: 'save', expectedHead: cursor.head, expectedVersion: cursor.version });
}
/** An edit protected the way the editor protects one: a recovery draft, then a checkpoint. */
async function autoEdit(history: ReturnType<typeof setup>['history'], slot: string, data: Record<string, unknown>) {
  let cursor = await history.current(slot);
  await history.recovery.save(slot, data, { writerId: `writer-${slot}`, expectedHead: cursor.head, expectedVersion: cursor.version });
  cursor = await history.current(slot);
  return history.checkpoint(slot, data, { reason: 'automatic', expectedHead: cursor.head, expectedVersion: cursor.version });
}

test('a saved creation goes back to its last explicit save, picture and time included, and keeps the discarded checkpoints', async () => {
  const { state, history } = setup();
  const saved = await explicitSave(history, 'qr-code:a', doc('https://example.com/saved'));
  await history.attachPreview(saved.id, THUMB);
  const edited = await autoEdit(history, 'qr-code:a', doc('https://example.com/edited', { __label: 'Renamed in passing' }));
  assert.equal((await state.load('qr-code:a'))?.url, 'https://example.com/edited', 'recovery wrote the edit into the saved record');
  assert.equal((await history.open('qr-code:a')).unsaved, true);
  const typing = await history.current('qr-code:a');
  await history.recovery.save('qr-code:a', doc('https://example.com/typed-after-the-checkpoint'), { writerId: 'typing', expectedHead: typing.head, expectedVersion: typing.version });

  assert.deepEqual(await history.discard('qr-code:a'), { outcome: 'restored', slot: 'qr-code:a' });
  const row = (await state.list()).find(r => r.slot === 'qr-code:a')!;
  assert.equal((await state.load('qr-code:a'))?.url, 'https://example.com/saved');
  assert.equal(row.label, 'Launch QR');
  assert.equal(row.thumb, THUMB, 'the thumbnail of the save comes back with its data');
  assert.equal(row.updatedAt, saved.at);
  const opened = await history.open('qr-code:a');
  assert.equal(opened.unsaved, false, 'the next open shows the saved state as saved');
  assert.equal(opened.head, saved.id);
  const kept = (await history.list({ slot: 'qr-code:a' })).entries.map(e => e.id);
  assert.ok(kept.includes(edited.id) && kept.includes(saved.id), 'the discarded checkpoint stays in History');
  assert.equal((await history.read(edited.id))?.url, 'https://example.com/edited');
  const branches = (await history.recovery.list({ slot: 'qr-code:a' })).entries;
  assert.ok(branches.length > 0 && branches.every(row => row.diverged), "the discarded edits' drafts are kept as a branch a later checkpoint cannot clear");
  // Nothing left to undo: a second discard changes nothing.
  assert.deepEqual(await history.discard('qr-code:a'), { outcome: 'unchanged', slot: 'qr-code:a' });
});

test('a creation that was never explicitly saved leaves Projects, not for the trash, and its checkpoints stay in History', async () => {
  const { state, history } = setup();
  const first = await autoEdit(history, 'qr-code:n', doc('https://example.com/first-change'));
  assert.deepEqual(await visible(state), ['qr-code:n'], 'the first change auto-filed the creation');
  assert.equal((await history.open('qr-code:n')).unsaved, true, 'a never-saved creation counts as unsaved');

  const result = await history.discard('qr-code:n');
  assert.equal(result.outcome, 'removed');
  assert.match(result.slot, /^__discarded__:[0-9a-z]+:qr-code:n$/);
  assert.ok(!result.slot.startsWith('__trash__:'));
  assert.deepEqual(await visible(state), [], 'gone from every session list');
  assert.equal(await state.load('qr-code:n'), null);
  const entries = (await history.list({ slot: result.slot })).entries;
  assert.deepEqual(entries.map(e => e.id), [first.id], 'Versions still lists the checkpoint');
  assert.equal((await history.read(first.id))?.url, 'https://example.com/first-change', 'so it can be opened as a copy');
  const changes = await history.activity!.list({ view: 'changes' }, { folders: [] });
  assert.ok(changes.entries.some(row => row.kind === 'revision' && row.slot === result.slot), 'History > Changes keeps the checkpoint');
  const recent = await history.activity!.list({ view: 'recent' }, { folders: [] });
  assert.ok(!recent.entries.some(row => row.slot === result.slot), 'History > Recent does not offer to resume it');
  // The document still exports: every history document keeps a current state.
  const archive = await history.backup.export();
  assert.ok(archive.documents.some(row => row.document.slot === result.slot));
});

test('a state saved outside the editor counts as saved, and an editor that adopts it keeps its picture and time', async () => {
  const { state, history } = setup();
  await explicitSave(history, 'qr-code:r', doc('https://example.com/v1'));
  await autoEdit(history, 'qr-code:r', doc('https://example.com/v1-edit'));
  // A rename in Projects, an import or a sync writes through state.save.
  await state.save('qr-code:r', doc('https://example.com/v1-edit', { __label: 'Renamed in Projects' }), THUMB);
  const opened = await history.open('qr-code:r');
  assert.equal(opened.unsaved, false);
  assert.equal(opened.workingHash, '', 'the editor is told to adopt the replaced state');
  assert.deepEqual(await history.discard('qr-code:r'), { outcome: 'unchanged', slot: 'qr-code:r' }, 'nothing an editor wrote to undo');

  const before = (await state.list()).find(r => r.slot === 'qr-code:r')!;
  const adopted = await history.checkpoint('qr-code:r', (await state.load('qr-code:r'))!, { reason: 'save', adopt: true, expectedHead: opened.head, expectedVersion: opened.version });
  const after = (await state.list()).find(r => r.slot === 'qr-code:r')!;
  assert.equal(after.thumb, THUMB); assert.equal(after.updatedAt, before.updatedAt, 'opening does not reorder Projects');
  assert.equal(adopted.at, before.updatedAt);
  assert.equal(await history.preview(adopted.id), THUMB);
  await autoEdit(history, 'qr-code:r', doc('https://example.com/after-rename-edit'));
  assert.equal((await history.discard('qr-code:r')).outcome, 'restored');
  const back = (await state.list()).find(r => r.slot === 'qr-code:r')!;
  assert.equal(back.label, 'Renamed in Projects', 'the rename survives a later discard');
  assert.equal(back.thumb, THUMB);
});

test('a record saved before history existed is adopted on open instead of being rewritten', async () => {
  const { state, history } = setup();
  await state.save('qr-code:old', doc('https://example.com/legacy'), THUMB);
  const before = (await state.list()).find(r => r.slot === 'qr-code:old')!;
  const entry = await history.checkpoint('qr-code:old', (await state.load('qr-code:old'))!, { reason: 'save', adopt: true, expectedHead: null, expectedVersion: null });
  const after = (await state.list()).find(r => r.slot === 'qr-code:old')!;
  assert.equal(after.thumb, THUMB); assert.equal(after.updatedAt, before.updatedAt);
  assert.equal((await history.open('qr-code:old')).unsaved, false);
  await autoEdit(history, 'qr-code:old', doc('https://example.com/legacy-edit'));
  assert.equal((await history.discard('qr-code:old')).outcome, 'restored');
  assert.equal((await state.load('qr-code:old'))?.url, 'https://example.com/legacy');
  assert.equal((await history.open('qr-code:old')).head, entry.id);
});

test('a document written before the saved pointer existed counts as saved and is never reverted or removed (review B7)', async () => {
  const { stores, state, history } = setup();
  await explicitSave(history, 'qr-code:l', doc('https://example.com/l-saved'));
  await autoEdit(history, 'qr-code:l', doc('https://example.com/l-edit'));
  await autoEdit(history, 'qr-code:m', doc('https://example.com/m-edit'));
  for (const slot of ['qr-code:l', 'qr-code:m']) {
    const row = stores.get('revision-documents')!.get(JSON.stringify(slot))!;
    const { saved: _gone, ...older } = row.value as Record<string, unknown>;
    row.value = older;
  }
  for (const slot of ['qr-code:l', 'qr-code:m']) {
    const opened = await history.open(slot);
    assert.equal(opened.unsaved, false, `${slot} opens as saved`);
    assert.equal(opened.adopt, true, 'and the editor records that state as saved');
    assert.equal((await history.discard(slot)).outcome, 'unchanged');
  }
  assert.equal((await state.load('qr-code:l'))?.url, 'https://example.com/l-edit');
  assert.equal((await state.load('qr-code:m'))?.url, 'https://example.com/m-edit', 'still in Projects');
});

test('discarded creations are cleared for good after the retention period, on a later discard', async () => {
  const { db, state, history } = setup();
  const recovery = createRevisionRecovery(db);
  await autoEdit(history, 'qr-code:x', doc('https://example.com/x'));
  const start = Date.parse('2026-09-01T00:00:00Z');
  const old = await discardUnsaved(db, recovery, 'qr-code:x', start);
  assert.equal(discardedAt(old.slot), start);
  await autoEdit(history, 'qr-code:y', doc('https://example.com/y'));
  const recent = await discardUnsaved(db, recovery, 'qr-code:y', start + DISCARD_RETENTION_MS + 1);
  const slots = (await state.list()).map(r => r.slot);
  assert.ok(!slots.includes(old.slot), 'the old discard is gone with its history');
  assert.deepEqual((await history.list({ slot: old.slot })).entries, []);
  assert.ok(slots.includes(recent.slot), 'the new one is kept');
});

test('a restored record takes the emoji set and licence choices the save recorded, or keeps the current ones when unknown', () => {
  const record = { slot: 's', toolId: 'qr-code', toolVersion: '1', label: 'Edited', data: {}, thumb: null, updatedAt: 'now',
    emoji: { emoji: 'set@2', emojifx: 'mono' }, designSystem: { id: 'later', label: 'Later' } } as StateRecord;
  const entry = { at: 'then', formatVersion: 4, engineVersion: '1.2' } as RevisionEntry;
  const data = { __toolId: 'qr-code', __label: 'Saved' };
  const known = restoredRecord(record, data, entry, { id: 'r', hash: 'h', emoji: { emoji: 'set@1', emojifx: 'original' } }, true, undefined);
  assert.deepEqual(known.emoji, { emoji: 'set@1', emojifx: 'original' });
  assert.equal(known.designSystem, undefined, 'the save had no design system stamp');
  assert.equal(known.label, 'Saved'); assert.equal(known.updatedAt, 'then'); assert.equal(known.thumb, null);
  const legacy = restoredRecord(record, data, entry, { id: 'r', hash: 'h' }, false, undefined);
  assert.deepEqual(legacy.emoji, record.emoji);
});
