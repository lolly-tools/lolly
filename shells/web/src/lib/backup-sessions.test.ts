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
