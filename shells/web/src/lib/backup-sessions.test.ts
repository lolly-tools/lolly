// SPDX-License-Identifier: MPL-2.0
/**
 * The newer-copy rule (plans/277 P7, decided 2026-09-27): when Import data… or
 * Sync's "Bring it to this device" brings a session whose slot is already here,
 * or an upload whose id is already here, the copy saved more recently wins, so an
 * older file never overwrites newer work on this device. Keeping devices in step
 * and restoring an earlier copy pass `sameId: 'incoming'` and still go back in time.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strToU8 } from 'fflate';
import { restoreBackupSessions, incomingIsNewer, assetRecordsToImport, type BackupState } from './backup-sessions.ts';

const OLD = '2026-09-10T00:00:00.000Z';
const MID = '2026-09-20T00:00:00.000Z';
const NEW = '2026-09-25T00:00:00.000Z';

interface Row { data: unknown; updatedAt: string | null }

function makeState(seed: Record<string, Row>, withRestore = false) {
  const rows = new Map<string, Row>(Object.entries(seed));
  const writes: string[] = [];
  const state: BackupState = {
    async list() { return [...rows].map(([slot, r]) => ({ slot, updatedAt: r.updatedAt })); },
    async load(slot) { return rows.get(slot)?.data ?? null; },
    // Like the web bridge, a plain save stamps the time of the write.
    async save(slot, data) { rows.set(slot, { data, updatedAt: '2026-09-27T12:00:00.000Z' }); writes.push(slot); },
    ...(withRestore ? { async restore(slot: string, data: unknown, _thumb: string | null, updatedAt: string) { rows.set(slot, { data, updatedAt }); writes.push(slot); } } : {}),
  };
  return { state, rows, writes };
}

const bundle = (list: Array<{ slot: string; data: unknown; updatedAt?: string | null }>) =>
  ({ 'sessions.json': strToU8(JSON.stringify(list)) }) as Record<string, Uint8Array<ArrayBuffer>>;

test('incomingIsNewer: only a readable, strictly later incoming time wins', () => {
  assert.equal(incomingIsNewer(MID, NEW), true);
  assert.equal(incomingIsNewer(MID, OLD), false);
  assert.equal(incomingIsNewer(MID, MID), false, 'equal times keep this device’s copy');
  assert.equal(incomingIsNewer(null, NEW), false, 'no time here: keep the copy here');
  assert.equal(incomingIsNewer(MID, null), false, 'no incoming time: keep the copy here');
  assert.equal(incomingIsNewer(1000, 2000), true, 'numbers (asset modifiedAt) compare too');
});

test('an older incoming session is kept out; a newer one is taken; a new slot is added', async () => {
  const { state, rows } = makeState({ older: { data: 'here', updatedAt: MID }, newer: { data: 'here', updatedAt: MID } });
  const summary = await restoreBackupSessions(state, bundle([
    { slot: 'older', data: 'incoming', updatedAt: OLD },
    { slot: 'newer', data: 'incoming', updatedAt: NEW },
    { slot: 'fresh', data: 'incoming', updatedAt: OLD },
  ]), {});
  assert.equal(rows.get('older')!.data, 'here', 'an older file never overwrites newer work here');
  assert.equal(rows.get('newer')!.data, 'incoming');
  assert.equal(rows.get('fresh')!.data, 'incoming');
  assert.equal(summary.sessions, 2, 'only the sessions written are counted');
});

test('equal or unreadable times keep this device’s copy, the same way every time', async () => {
  const { state, rows, writes } = makeState({ same: { data: 'here', updatedAt: MID }, untimed: { data: 'here', updatedAt: null } });
  const files = bundle([
    { slot: 'same', data: 'incoming', updatedAt: MID },
    { slot: 'untimed', data: 'incoming', updatedAt: NEW },
  ]);
  // Bring it to this device states the newer-copy rule explicitly (lib/sync-engine.ts).
  await restoreBackupSessions(state, files, { mode: 'sync', sameId: 'newer' });
  await restoreBackupSessions(state, files, { mode: 'sync', sameId: 'newer' });
  assert.equal(rows.get('same')!.data, 'here');
  assert.equal(rows.get('untimed')!.data, 'here');
  assert.deepEqual(writes, [], 'nothing is written, so a repeat import changes nothing');
});

test('sameId "incoming" (keeping devices in step, restoring an earlier copy) still goes back in time', async () => {
  const { state, rows } = makeState({ doc: { data: 'newer work', updatedAt: NEW } });
  await restoreBackupSessions(state, bundle([{ slot: 'doc', data: 'earlier copy', updatedAt: OLD }]), { mode: 'sync', sameId: 'incoming' });
  assert.equal(rows.get('doc')!.data, 'earlier copy');
});

test('a state that can restore keeps the original save time, so a later import compares real save times', async () => {
  const { state, rows } = makeState({}, true);
  await restoreBackupSessions(state, bundle([{ slot: 'doc', data: 'v1', updatedAt: OLD }]), {});
  assert.equal(rows.get('doc')!.updatedAt, OLD);
  // Work saved elsewhere at MID now beats the restored copy from OLD.
  await restoreBackupSessions(state, bundle([{ slot: 'doc', data: 'v2', updatedAt: MID }]), {});
  assert.equal(rows.get('doc')!.data, 'v2');
});

test('a history archive the restore refuses (it failed its own validation) stops the import before any session is written', async () => {
  const { state, rows } = makeState({ doc: { data: 'here', updatedAt: OLD } });
  state.history = { backup: {
    async export() { throw new Error('unused'); },
    async restore() { throw new Error('Invalid revision history in this backup. Nothing from its history was restored.'); },
  } } as unknown as BackupState['history'];
  const files = { ...bundle([{ slot: 'doc', data: 'incoming', updatedAt: NEW }]), 'revision-history.json': strToU8(JSON.stringify({ version: 1, documents: [], revisions: [], recoveries: [] })) } as Record<string, Uint8Array<ArrayBuffer>>;
  await assert.rejects(() => restoreBackupSessions(state, files, { mode: 'manual' }), /Invalid revision history/);
  assert.equal(rows.get('doc')!.data, 'here');
});

test('uploaded assets: the newer copy by meta.modifiedAt wins; equal or untimed keeps this device’s', async () => {
  const here = [
    { id: 'user/a', meta: { modifiedAt: 2000 } },
    { id: 'user/b', meta: { modifiedAt: 2000 } },
    { id: 'user/c', meta: { modifiedAt: 2000 } },
    { id: 'user/d', meta: {} },
  ];
  const assets = { async _exportUserAssets() { return here; } };
  const incoming = [
    { id: 'user/a', meta: { modifiedAt: 1000 } },   // older: kept out
    { id: 'user/b', meta: { modifiedAt: 3000 } },   // newer: taken
    { id: 'user/c', meta: { modifiedAt: 2000 } },   // equal: kept out
    { id: 'user/d', meta: { modifiedAt: 3000 } },   // no time here: kept out
    { id: 'user/e', meta: {} },                     // new id: taken
  ];
  const take = await assetRecordsToImport(assets, incoming, {});
  assert.deepEqual(take.map(r => r.id), ['user/b', 'user/e']);
  const restore = await assetRecordsToImport(assets, incoming, { sameId: 'incoming' });
  assert.equal(restore.length, incoming.length, 'a restore takes every record');
});

test('a sync-mode import with no explicit rule takes the incoming copy; other imports keep the newer one', async () => {
  const { sameIdRule } = await import('./backup-sessions.ts');
  assert.equal(sameIdRule({}), 'newer');
  assert.equal(sameIdRule({ mode: 'manual' }), 'newer');
  assert.equal(sameIdRule({ mode: 'sync' }), 'incoming');
  assert.equal(sameIdRule({ mode: 'sync', sameId: 'newer' }), 'newer', "Bring it to this device states 'newer' and keeps it");
});

// ---- History in backups and sync (plan 277 P4 section 5) -----------------------

/** A browser: the real state bridge and revision store over the in-memory IndexedDB. */
async function browser() {
  const { memoryDb } = await import('../bridge/idb-memory.test-utils.ts');
  const { createStateAPI } = await import('../bridge/state.ts');
  const { createRevisionStore } = await import('../bridge/revision-history.ts');
  const { db: memory, stores } = memoryDb();
  const db = memory as unknown as import('idb').IDBPDatabase;
  const state = createStateAPI(db as unknown as import('../bridge/state.ts').StateDb, createRevisionStore(db));
  return { db, stores, state, history: state.history! };
}
type Browser = Awaited<ReturnType<typeof browser>>;
const doc = (url: string) => ({ __toolId: 'qr-code', __label: 'Launch', payload: 'url', url });
/** The clock the test enabled (context.mock.timers). */
let timers: { setTime(ms: number): void } | null = null;
async function write(b: Browser, slot: string, url: string, reason: 'automatic' | 'save', when: number) {
  timers?.setTime(when);
  const cursor = await b.history.current(slot);
  return b.history.checkpoint(slot, doc(url), { reason, expectedHead: cursor.head, expectedVersion: cursor.version });
}

test('an archive over its limit leaves out the oldest automatic checkpoints and says how many; saves and heads always travel', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-09-01T09:00:00Z') }); timers = context.mock.timers;
  const b = await browser();
  const t = Date.parse('2026-09-01T09:00:00Z'), min = 60_000;
  const saved = await write(b, 'qr-code:a', 'https://example.com/saved', 'save', t);
  const autos = [];
  for (let i = 1; i <= 6; i++) autos.push(await write(b, 'qr-code:a', `https://example.com/auto-${i}`, 'automatic', t + i * 2 * min));
  const whole = await b.history.backup.export();
  assert.equal(whole.revisions.length, 7);
  const full = new TextEncoder().encode(JSON.stringify(whole)).byteLength;
  let leftOut = 0;
  const partial = await b.history.backup.export({ maxBytes: full - 600, leftOut: n => { leftOut = n; } });
  assert.ok(leftOut >= 1, `left out ${leftOut}`);
  const ids = partial.revisions.map(row => row.entry.id);
  assert.equal(ids.length, 7 - leftOut);
  assert.ok(ids.includes(saved.id) && ids.includes(autos.at(-1)!.id), 'the explicit save and the head travel');
  assert.deepEqual(autos.slice(0, leftOut).map(e => e.id).filter(id => ids.includes(id)), [], 'the oldest automatic checkpoints are the ones left out');
  assert.ok(new TextEncoder().encode(JSON.stringify(partial)).byteLength <= full - 600, 'and the archive fits');

  // packBackupSessions reports the count, and the export line gives the number.
  const { packBackupSessions } = await import('./backup-sessions.ts');
  const { backupHistoryNote } = await import('./backup-summary.ts');
  const reporting: BackupState = { ...b.state, history: { backup: { ...b.history.backup,
    export: (options) => b.history.backup.export({ ...options, maxBytes: full - 600 }) } } };
  const packed = await packBackupSessions(reporting, {}, { mode: 'manual' });
  assert.equal(packed.checkpointsLeftOut, leftOut);
  assert.match(backupHistoryNote(packed), leftOut === 1 ? /1 older automatic checkpoint left out/ : new RegExp(`${leftOut} older automatic checkpoints left out`));
  const complete = await packBackupSessions(b.state, {}, { mode: 'manual' });
  assert.equal(complete.checkpointsLeftOut, undefined, 'nothing left out, nothing said');
});

test('device sync carries neither history nor discarded edits kept for History; Trash slots travel as before', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-09-01T09:00:00Z') }); timers = context.mock.timers;
  const { packBackupSessions } = await import('./backup-sessions.ts');
  const { discardUnsaved } = await import('../bridge/revision-discard.ts');
  const { createRevisionRecovery } = await import('../bridge/revision-recovery.ts');
  const { strFromU8 } = await import('fflate');
  const b = await browser();
  const t = Date.parse('2026-09-01T09:00:00Z');
  await write(b, 'qr-code:kept', 'https://example.com/kept', 'save', t);
  await write(b, 'qr-code:auto', 'https://example.com/never-saved', 'automatic', t);
  const discarded = await discardUnsaved(b.db, createRevisionRecovery(b.db), 'qr-code:auto', t);
  await write(b, 'qr-code:bin', 'https://example.com/bin', 'save', t);
  await b.history.move('qr-code:bin', '__trash__:qr-code:bin');

  const entries: Record<string, Uint8Array> = {};
  const packed = await packBackupSessions(b.state, entries as never, { mode: 'sync' });
  assert.equal(entries['revision-history.json'], undefined, 'no history in a sync copy');
  const slots = (JSON.parse(strFromU8(entries['sessions.json']!)) as Array<{ slot: string }>).map(row => row.slot).sort();
  assert.deepEqual(slots, ['__trash__:qr-code:bin', 'qr-code:kept'], 'the discarded slot stays here; the Trash follows the profile');
  assert.deepEqual([...packed.slots].sort(), slots, 'and a later replace sync never counts it as removable');

  // A manual backup carries it, since its checkpoints are History's.
  const manual: Record<string, Uint8Array> = {};
  await packBackupSessions(b.state, manual as never, { mode: 'manual' });
  assert.ok((JSON.parse(strFromU8(manual['sessions.json']!)) as Array<{ slot: string }>).some(row => row.slot === discarded.slot));

  // A sync copy written by an older build that still carries one: applying it leaves the slot out.
  const older = { 'sessions.json': strToU8(JSON.stringify([{ slot: '__discarded__:abc:qr-code:x', data: doc('https://example.com/x'), updatedAt: '2026-09-01T09:00:00Z' }])) } as Record<string, Uint8Array<ArrayBuffer>>;
  const target = await browser();
  const applied = await restoreBackupSessions(target.state, older, { mode: 'sync' });
  assert.equal(applied.sessions, 0);
  assert.deepEqual(await target.state.list(), []);
});

test('a restore stores checkpoints deflated, so restored history costs its deflated size', async (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-09-01T09:00:00Z') }); timers = context.mock.timers;
  const { isRevisionPayload } = await import('../bridge/revision-snapshot.ts');
  const laptop = await browser(), phone = await browser();
  const t = Date.parse('2026-09-01T09:00:00Z');
  const long = 'https://example.com/' + 'campaign/'.repeat(200);
  await write(laptop, 'qr-code:p', `${long}1`, 'save', t);
  const head = await write(laptop, 'qr-code:p', `${long}2`, 'automatic', t + 120_000);
  const archive = JSON.parse(JSON.stringify(await laptop.history.backup.export()));
  await phone.history.backup.restore(archive);
  const rows = [...phone.stores.get('revisions')!.values()].map(row => row.value as { id: string; bytes: number; stored?: number });
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.ok(row.stored && row.stored < row.bytes, `${row.id}: ${row.stored} stored of ${row.bytes}`);
    assert.ok(isRevisionPayload(phone.stores.get('revision-payloads')!.get(JSON.stringify(row.id))!.value), 'the payload is the packed form');
  }
  assert.equal((await phone.history.usage()).checkpoints, rows.reduce((sum, row) => sum + row.stored!, 0));
  assert.equal((await phone.history.read(head.id))?.url, `${long}2`, 'and reads back, verified against its hash');
});
