// SPDX-License-Identifier: MPL-2.0
/**
 * "Saved more recently" compares the time the work was last explicitly saved
 * (plan 277 P7, review S2). The web state bridge keeps `savedAt` on each record:
 * an explicit save sets it; a recovery draft, an automatic checkpoint and a
 * rename leave it alone. The newer-copy import rule (lib/backup-sessions.ts)
 * compares it, so none of those writes can make an old copy beat a newer explicit
 * save made in another browser.
 *
 * Driven through the real state bridge and revision store over the in-memory
 * IndexedDB. The clock is pinned, and each step runs at a time of its own.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/bridge/state-saved-at.test.ts
 */
import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { IDBPDatabase } from 'idb';
import { memoryDb } from './idb-memory.test-utils.ts';
import type { SavedStateData, StateDb } from './state.ts';

const { createStateAPI } = await import('./state.ts');
const { createRevisionStore } = await import('./revision-history.ts');
const { packBackupSessions, restoreBackupSessions } = await import('../lib/backup-sessions.ts');

const T1 = Date.parse('2026-09-20T09:00:00.000Z');
const T2 = Date.parse('2026-09-21T09:00:00.000Z');
const T3 = Date.parse('2026-09-22T09:00:00.000Z');
const T4 = Date.parse('2026-09-23T09:00:00.000Z');
const at = (ms: number): void => { mock.timers.setTime(ms); };
afterEach(() => { mock.timers.reset(); });

function browser() {
  const { db: memory } = memoryDb();
  const db = memory as unknown as IDBPDatabase;
  return createStateAPI(db as unknown as StateDb, createRevisionStore(db));
}
type Browser = ReturnType<typeof browser>;

const qr = (url: string): SavedStateData => ({ __toolId: 'qr-code', __label: 'Launch QR', payload: 'url', url });
const SLOT = 'qr-code:launch';

/** Export `from` the way a sync copy or a history-less backup carries sessions, and
 *  import it into `into` with Import data…'s defaults. */
async function carry(from: Browser, into: Browser): Promise<void> {
  const entries: Record<string, Uint8Array> = {};
  await packBackupSessions(from, entries as never, { mode: 'sync' });
  await restoreBackupSessions(into, entries as Record<string, Uint8Array<ArrayBuffer>>, {});
}

test('an automatic draft or checkpoint does not beat a newer explicit save in another browser', async () => {
  mock.timers.enable({ apis: ['Date'], now: T1 });
  const a = browser(), b = browser();

  at(T1);                                              // A saves explicitly
  const saved = await a.history!.checkpoint(SLOT, qr('https://a.example/saved'), { reason: 'save', expectedHead: null });
  at(T2);                                              // B saves its own version later
  await b.save(SLOT, qr('https://b.example/newer'));
  at(T3);                                              // A keeps editing: a draft, then a checkpoint
  const opened = await a.history!.open(SLOT);
  await a.history!.recovery!.save(SLOT, qr('https://a.example/draft'), { writerId: 'tab-1', expectedHead: opened.head, expectedVersion: opened.version });
  assert.equal((await a.load(SLOT))?.url, 'https://a.example/draft', 'the draft is what A holds now');
  await a.history!.checkpoint(SLOT, qr('https://a.example/auto'), { reason: 'automatic', expectedHead: saved.id, expectedVersion: (await a.history!.open(SLOT)).version });

  const row = (await a.list()).find(r => r.slot === SLOT)!;
  assert.equal(row.updatedAt, new Date(T3).toISOString(), 'the write time moved');
  assert.equal(row.savedAt, new Date(T1).toISOString(), 'the save time did not');

  await carry(a, b);
  assert.equal((await b.load(SLOT))?.url, 'https://b.example/newer', 'B keeps its newer explicit save');
});

test('a Projects rename does not beat a newer explicit save in another browser; a real save does', async () => {
  mock.timers.enable({ apis: ['Date'], now: T1 });
  const a = browser(), b = browser();

  at(T1);
  await a.save(SLOT, qr('https://a.example/v1'));
  await carry(a, b);                                   // B now holds A's copy, saved at T1
  assert.equal((await b.list())[0]!.savedAt, new Date(T1).toISOString(), 'an import keeps the copy’s own save time');
  at(T2);
  await b.save(SLOT, qr('https://b.example/v2'));      // B edits and saves
  at(T3);                                              // A renames, the way views/projects.ts does
  const data = (await a.load(SLOT))!;
  data.__label = 'Launch QR (final)';
  data.__export_filename = 'Launch QR (final)';
  await a.save(SLOT, data);
  assert.equal((await a.list())[0]!.savedAt, new Date(T1).toISOString(), 'a rename is not new work');

  await carry(a, b);
  assert.equal((await b.load(SLOT))?.url, 'https://b.example/v2', 'the renamed old copy is kept out');

  at(T4);                                              // A really edits and saves
  await a.save(SLOT, { ...(await a.load(SLOT))!, url: 'https://a.example/v3' });
  await carry(a, b);
  assert.equal((await b.load(SLOT))?.url, 'https://a.example/v3', 'a newer explicit save is taken');
});

test('restore keeps the given update and save times, and list reports the save time', async () => {
  mock.timers.enable({ apis: ['Date'], now: T4 });
  const b = browser();
  await b.restore!(SLOT, qr('https://a.example/v1'), null, new Date(T2).toISOString(), new Date(T1).toISOString());
  const row = (await b.list())[0]!;
  assert.equal(row.updatedAt, new Date(T2).toISOString());
  assert.equal(row.savedAt, new Date(T1).toISOString());
});
