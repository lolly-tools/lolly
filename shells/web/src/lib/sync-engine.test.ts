// SPDX-License-Identifier: MPL-2.0
/**
 * lib/sync-engine.ts + sync-remote.ts + snapshot-crypto.ts (plans/138 B1).
 * The continuity-snapshot loop, exercised end-to-end against MemoryRemote and a
 * pair of in-memory hosts: push → detect-newer → pull+apply, last-write-wins rev
 * tracking, optional passphrase encryption, and the debounced push scheduler.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MemoryRemote } from './sync-remote.ts';
import {
  pushSnapshot, checkForNewer, pullAndApply, makeSyncScheduler, INITIAL_SYNC_STATE,
} from './sync-engine.ts';
import { encryptSnapshot, decryptSnapshot, isEncryptedSnapshot } from './snapshot-crypto.ts';

// A minimal in-memory BackupHost + BackupStorage - the surface exportBackup /
// importBackup actually touch (profile, state.list/load/save, assets export/import).
function makeHost(seed: { profile?: Record<string, unknown>; sessions?: Record<string, { data: unknown; thumb?: string | null }> } = {}) {
  const profile: Record<string, unknown> = { ...(seed.profile ?? {}) };
  const sessions = new Map<string, { data: unknown; thumb?: string | null }>(Object.entries(seed.sessions ?? {}));
  const assets: Array<Record<string, unknown>> = [];
  const store = new Map<string, string>();
  const host = {
    profile: {
      async get() { return profile; },
      async set(p: Record<string, unknown>) { for (const k of Object.keys(profile)) delete profile[k]; Object.assign(profile, p); },
    },
    state: {
      async list() { return [...sessions.entries()].map(([slot]) => ({ slot })); },
      async load(slot: string) { return sessions.get(slot)?.data ?? null; },
      async save(slot: string, data: unknown, thumb?: string | null) { sessions.set(slot, { data, thumb }); },
    },
    assets: {
      async _exportUserAssets() { return assets; },
      async _importUserAsset(rec: Record<string, unknown>) { assets.push(rec); },
    },
    log() { /* silent in tests */ },
  };
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
  return { host, storage, profile, sessions };
}
const deps = (h: ReturnType<typeof makeHost>) => ({ host: h.host as never, storage: h.storage });

test('a fresh device sees the first snapshot as newer; the writer does not', async () => {
  const a = makeHost({ profile: { name: 'A' }, sessions: { 's1': { data: { v: 1 } } } });
  const remote = new MemoryRemote();

  // Nothing pushed yet.
  assert.deepEqual(await checkForNewer(remote, INITIAL_SYNC_STATE), { hasNewer: false, meta: null });

  const { state: writerState } = await pushSnapshot(deps(a), remote);
  // The writer's own push is not "newer" to itself...
  assert.equal((await checkForNewer(remote, writerState)).hasNewer, false);
  // ...but a second device that has never synced sees it.
  const seen = await checkForNewer(remote, INITIAL_SYNC_STATE);
  assert.equal(seen.hasNewer, true);
  assert.equal(seen.meta?.rev, writerState.lastSyncedRev);
});

test('pull applies the snapshot over another device (last-write-wins)', async () => {
  const a = makeHost({ profile: { name: 'A' }, sessions: { 's1': { data: { v: 1 } }, 's2': { data: { v: 2 } } } });
  const b = makeHost({ profile: { name: 'B-old' } }); // different, older device
  const remote = new MemoryRemote();

  await pushSnapshot(deps(a), remote);
  const { summary, state } = await pullAndApply(deps(b), remote, {});

  assert.equal(summary.sessions, 2);
  assert.deepEqual([...b.sessions.keys()].sort(), ['s1', 's2']);
  assert.deepEqual(b.sessions.get('s1')!.data, { v: 1 });
  assert.equal(b.profile.name, 'A');            // A's profile replaced B's
  assert.equal(state.lastSyncedRev, (await remote.head())!.rev); // B now tracks the applied rev
  // Having applied it, B no longer sees it as newer.
  assert.equal((await checkForNewer(remote, state)).hasNewer, false);
});

test('rev tracking: a later push is newer to a device that applied the earlier one', async () => {
  const a = makeHost({ sessions: { 's1': { data: { v: 1 } } } });
  const remote = new MemoryRemote();
  await pushSnapshot(deps(a), remote);
  const b = makeHost();
  const { state: bState } = await pullAndApply(deps(b), remote, {});

  // A edits and pushes again → new rev.
  a.sessions.set('s1', { data: { v: 2 } });
  await pushSnapshot(deps(a), remote);

  const seen = await checkForNewer(remote, bState);
  assert.equal(seen.hasNewer, true, 'B should see A’s second push as newer');
});

test('no snapshot yet → pull throws, nothing applied', async () => {
  const b = makeHost();
  const remote = new MemoryRemote();
  await assert.rejects(() => pullAndApply(deps(b), remote, {}), /no snapshot/i);
});

test('passphrase encryption: cloud holds ciphertext; only the right passphrase restores', async () => {
  const a = makeHost({ sessions: { 's1': { data: { secret: true } } } });
  const remote = new MemoryRemote();
  await pushSnapshot(deps(a), remote, { passphrase: 'correct horse' });

  // What sits in the cloud is encrypted, not a readable zip.
  const stored = await remote.get();
  assert.ok(isEncryptedSnapshot(stored!.bytes), 'stored snapshot must be encrypted');

  const b = makeHost();
  await assert.rejects(() => pullAndApply(deps(b), remote, {}), /encrypted/i, 'no passphrase → refuse');
  await assert.rejects(() => pullAndApply(deps(b), remote, { passphrase: 'wrong' }), /wrong passphrase/i);

  const c = makeHost();
  const { summary } = await pullAndApply(deps(c), remote, { passphrase: 'correct horse' });
  assert.equal(summary.sessions, 1);
  assert.deepEqual(c.sessions.get('s1')!.data, { secret: true });
});

test('snapshot-crypto: round-trips, rejects wrong passphrase and tampering', async () => {
  const bytes = new TextEncoder().encode('the whole-person bundle bytes');
  const enc = await encryptSnapshot(bytes, 'pw');
  assert.ok(isEncryptedSnapshot(enc));
  assert.ok(!isEncryptedSnapshot(bytes));
  assert.deepEqual(await decryptSnapshot(enc, 'pw'), bytes);
  assert.equal(await decryptSnapshot(enc, 'nope'), null, 'wrong passphrase → null');
  const tampered = enc.slice(); const last = tampered.length - 1; tampered[last] = (tampered[last] ?? 0) ^ 0xff;
  assert.equal(await decryptSnapshot(tampered, 'pw'), null, 'tamper → null (GCM auth)');
});

// A controllable timer so the debounce is deterministic (no wall-clock waits).
function fakeTimers() {
  let cb: (() => void) | null = null;
  return {
    timers: { set: (fn: () => void) => { cb = fn; return 1 as unknown as ReturnType<typeof setTimeout>; }, clear: () => { cb = null; } },
    fire: () => { const f = cb; cb = null; f?.(); },
    pending: () => cb !== null,
  };
}

test('scheduler coalesces a burst into one push, and flush forces it', async () => {
  let pushes = 0;
  const ft = fakeTimers();
  const sched = makeSyncScheduler(async () => { pushes++; }, 1000, { timers: ft.timers });

  sched.notifyChange(); sched.notifyChange(); sched.notifyChange(); // one debounce window
  assert.equal(pushes, 0, 'nothing until the window elapses');
  ft.fire();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(pushes, 1, 'a burst collapses to a single push');

  await sched.flush();
  assert.equal(pushes, 2, 'flush forces a push now');
});

test('scheduler: a change during an in-flight push triggers exactly one more', async () => {
  let pushes = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const ft = fakeTimers();
  const sched = makeSyncScheduler(async () => { pushes++; if (pushes === 1) await gate; }, 1000, { timers: ft.timers });

  const first = sched.flush();            // starts push #1, which blocks on the gate
  sched.notifyChange(); ft.fire();        // change arrives mid-push → should defer, not race
  await Promise.resolve();
  assert.equal(pushes, 1, 'no second concurrent push while one is in flight');
  release();
  await first;
  await Promise.resolve(); await Promise.resolve();
  assert.equal(pushes, 2, 'the deferred change pushes once after the first settles');
});
