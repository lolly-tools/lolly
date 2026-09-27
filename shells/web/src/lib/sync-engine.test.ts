// SPDX-License-Identifier: MPL-2.0
/**
 * lib/sync-engine.ts + sync-remote.ts + snapshot-crypto.ts (plans/138 B1).
 * The continuity-snapshot loop, exercised end-to-end against MemoryRemote and a
 * pair of in-memory hosts: push → detect-newer → pull+apply, last-write-wins rev
 * tracking, optional passphrase encryption, and the debounced push scheduler.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MemoryRemote, SyncConflictError, preconditionHeaders, type SnapshotMeta, type SyncRemote } from './sync-remote.ts';
import {
  pushSnapshot, checkForNewer, pullAndApply, makeSyncScheduler, INITIAL_SYNC_STATE,
  saveCopy, writeDailyCopy, isoWeekdayUtc, utcDate, SyncTooLargeError, buildSnapshot, type SyncState,
} from './sync-engine.ts';
import { encryptSnapshot, decryptSnapshot, isEncryptedSnapshot } from './snapshot-crypto.ts';

/** The pushed half of a push result, or a failed assertion. */
function pushed<T extends { status: string }>(result: T): Extract<T, { status: 'pushed' }> {
  assert.equal(result.status, 'pushed');
  return result as Extract<T, { status: 'pushed' }>;
}
const fresh = { state: INITIAL_SYNC_STATE };

// A minimal in-memory BackupHost + BackupStorage - the surface exportBackup /
// importBackup actually touch (profile, state.list/load/save, assets export/import).
function makeHost(seed: {
  profile?: Record<string, unknown>;
  sessions?: Record<string, { data: unknown; thumb?: string | null; updatedAt?: string }>;
  assets?: string[];
} = {}) {
  const profile: Record<string, unknown> = { ...(seed.profile ?? {}) };
  const sessions = new Map<string, { data: unknown; thumb?: string | null; updatedAt?: string }>(Object.entries(seed.sessions ?? {}));
  const assets: Array<Record<string, unknown>> = (seed.assets ?? []).map((id) => ({ id, type: 'image', format: 'png' }));
  const store = new Map<string, string>();
  const host = {
    profile: {
      async get() { return profile; },
      async set(p: Record<string, unknown>) { for (const k of Object.keys(profile)) delete profile[k]; Object.assign(profile, p); },
    },
    state: {
      async list() { return [...sessions.entries()].map(([slot, r]) => ({ slot, updatedAt: r.updatedAt ?? null })); },
      async load(slot: string) { return sessions.get(slot)?.data ?? null; },
      async save(slot: string, data: unknown, thumb?: string | null) { sessions.set(slot, { data, thumb }); },
      async delete(slot: string) { sessions.delete(slot); },
    },
    assets: {
      async _exportUserAssets() { return assets; },
      async _importUserAsset(rec: Record<string, unknown>) {
        const at = assets.findIndex((a) => a.id === rec.id);
        if (at >= 0) assets[at] = rec; else assets.push(rec);
      },
      async _listUserAssets() { return assets.map((a) => ({ id: String(a.id) })); },
      async _deleteUserAsset(id: string) { const at = assets.findIndex((a) => a.id === id); if (at >= 0) assets.splice(at, 1); },
    },
    log() { /* silent in tests */ },
  };
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
  const assetIds = (): string[] => assets.map((a) => String(a.id)).sort();
  return { host, storage, profile, sessions, assets, assetIds };
}
const deps = (h: ReturnType<typeof makeHost>) => ({ host: h.host as never, storage: h.storage });

test('a fresh device sees the first snapshot as newer; the writer does not', async () => {
  const a = makeHost({ profile: { name: 'A' }, sessions: { 's1': { data: { v: 1 } } } });
  const remote = new MemoryRemote();

  // Nothing pushed yet.
  assert.deepEqual(await checkForNewer(remote, INITIAL_SYNC_STATE), { hasNewer: false, meta: null });

  const { state: writerState } = pushed(await pushSnapshot(deps(a), remote, fresh));
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

  pushed(await pushSnapshot(deps(a), remote, fresh));
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
  const first = pushed(await pushSnapshot(deps(a), remote, fresh));
  const b = makeHost();
  const { state: bState } = await pullAndApply(deps(b), remote, {});

  // A edits and pushes again → new rev.
  a.sessions.set('s1', { data: { v: 2 } });
  pushed(await pushSnapshot(deps(a), remote, { state: first.state }));

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
  pushed(await pushSnapshot(deps(a), remote, { ...fresh, passphrase: 'correct horse' }));

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

// ── plans/138 Tier D: check before write (WP-S1) ─────────────────────────────────

test('a device that never synced cannot overwrite an existing copy; force can', async () => {
  const a = makeHost({ sessions: { 's1': { data: { v: 1 } } } });
  const phone = makeHost();                                  // a new, empty device
  const remote = new MemoryRemote();
  const first = pushed(await pushSnapshot(deps(a), remote, fresh));

  const refused = await pushSnapshot(deps(phone), remote, fresh);
  assert.equal(refused.status, 'conflict');
  assert.equal(refused.status === 'conflict' && refused.remote?.rev, first.meta.rev);
  assert.equal((await remote.head())!.rev, first.meta.rev, 'the store keeps the full copy');

  const forced = pushed(await pushSnapshot(deps(phone), remote, { ...fresh, force: true }));
  assert.notEqual(forced.meta.rev, first.meta.rev);
});

test('a device that missed a push gets a conflict, not an overwrite', async () => {
  const a = makeHost({ sessions: { 's1': { data: { v: 1 } } } });
  const remote = new MemoryRemote();
  const aFirst = pushed(await pushSnapshot(deps(a), remote, fresh));
  const b = makeHost();
  const { state: bState } = await pullAndApply(deps(b), remote);

  pushed(await pushSnapshot(deps(a), remote, { state: aFirst.state }));   // B was offline
  b.sessions.set('s9', { data: { offline: true } });
  assert.equal((await pushSnapshot(deps(b), remote, { state: bState })).status, 'conflict');
});

test('the conditional write closes the gap between the check and the write', async () => {
  const a = makeHost({ sessions: { 's1': { data: { v: 1 } } } });
  const inner = new MemoryRemote();
  const first = pushed(await pushSnapshot(deps(a), inner, fresh));
  // A store whose head still shows the old copy while another device writes a new one.
  let raced = false;
  const racing: SyncRemote = {
    kind: 'racing',
    head: () => inner.head(),
    get: () => inner.get(),
    async put(bytes, opts) {
      if (!raced) { raced = true; await inner.put(new Uint8Array([7])); }  // the other device wins the race
      return inner.put(bytes, opts);
    },
  };
  const result = await pushSnapshot(deps(a), racing, { state: first.state });
  assert.equal(result.status, 'conflict');
  assert.deepEqual([...(await inner.get())!.bytes], [7], 'the other device’s copy is intact');
});

test('MemoryRemote honours ifRev, and preconditionHeaders maps revs to HTTP', async () => {
  const remote = new MemoryRemote();
  await assert.rejects(() => remote.put(new Uint8Array([1]), { ifRev: 'r9' }), SyncConflictError);
  const meta = await remote.put(new Uint8Array([1]), { ifRev: null });
  await assert.rejects(() => remote.put(new Uint8Array([1]), { ifRev: null }), SyncConflictError);
  await remote.put(new Uint8Array([2]), { ifRev: meta.rev });

  assert.deepEqual(preconditionHeaders(), {});
  assert.deepEqual(preconditionHeaders({}), {});
  assert.deepEqual(preconditionHeaders({ ifRev: null }), { 'If-None-Match': '*' });
  assert.deepEqual(preconditionHeaders({ ifRev: 'abc' }), { 'If-Match': '"abc"' });
  assert.deepEqual(preconditionHeaders({ ifRev: '' }), {});
  assert.deepEqual(preconditionHeaders({ ifRev: 'W/"abc' }), {});
  assert.deepEqual(preconditionHeaders({ ifRev: 'Wed, 01 Jan 2025 00:00:00 GMT' }), {});
});

// ── plans/138 Tier D: applying makes this device match (WP-S2) ───────────────────

test('a sync apply removes what another device deleted and keeps what this device made since', async () => {
  const laptop = makeHost({ sessions: { 'keep': { data: 1 }, 'gone': { data: 2 } }, assets: ['user/a', 'user/b'] });
  const remote = new MemoryRemote();
  const first = pushed(await pushSnapshot(deps(laptop), remote, fresh));

  const phone = makeHost();
  const joined = await pullAndApply(deps(phone), remote);
  assert.deepEqual(joined.ids.sessions.sort(), ['gone', 'keep']);
  // The phone makes something of its own, never synced.
  phone.sessions.set('phone-only', { data: 3 });
  phone.assets.push({ id: 'user/phone', type: 'image', format: 'png' });

  // The laptop deletes one session and one image, then pushes.
  laptop.sessions.delete('gone');
  laptop.assets.splice(laptop.assets.findIndex((r) => r.id === 'user/b'), 1);
  pushed(await pushSnapshot(deps(laptop), remote, { state: first.state }));

  const { summary } = await pullAndApply(deps(phone), remote, { replace: { removable: joined.ids } });
  assert.deepEqual([...phone.sessions.keys()].sort(), ['keep', 'phone-only']);
  assert.deepEqual(phone.assetIds(), ['user/a', 'user/phone']);
  assert.equal(summary.removed, 2);
  assert.equal(summary.failedRemovals, 0);
});

// plans/277 P7: "Bring it to this device" (profile 'merge') keeps the newer copy of
// a session on both sides; keeping devices in step takes the synced copy.
test('a merge apply keeps the newer session here; an ordinary apply takes the synced copy', async () => {
  const source = makeHost({ sessions: { 'doc': { data: 'synced', updatedAt: '2026-09-10T00:00:00.000Z' } } });
  const remote = new MemoryRemote();
  pushed(await pushSnapshot(deps(source), remote, fresh));
  const newerHere = () => makeHost({ sessions: { 'doc': { data: 'newer here', updatedAt: '2026-09-20T00:00:00.000Z' } } });

  const joined = newerHere();
  await pullAndApply(deps(joined), remote, { profile: 'merge' });
  assert.equal(joined.sessions.get('doc')!.data, 'newer here');

  const inStep = newerHere();
  await pullAndApply(deps(inStep), remote);
  assert.equal(inStep.sessions.get('doc')!.data, 'synced');
});

test('a plain apply only adds; replace "all" matches the copy exactly', async () => {
  const source = makeHost({ sessions: { 'a': { data: 1 } } });
  const remote = new MemoryRemote();
  pushed(await pushSnapshot(deps(source), remote, fresh));

  const merged = makeHost({ sessions: { 'local': { data: 0 } } });
  await pullAndApply(deps(merged), remote);
  assert.deepEqual([...merged.sessions.keys()].sort(), ['a', 'local']);

  const restored = makeHost({ sessions: { 'local': { data: 0 } }, assets: ['user/x'] });
  await pullAndApply(deps(restored), remote, { replace: 'all' });
  assert.deepEqual([...restored.sessions.keys()], ['a']);
  assert.deepEqual(restored.assetIds(), []);
});

test('a partial restore removes nothing', async () => {
  const source = makeHost({ sessions: { 'a': { data: 1 } }, assets: ['user/new'] });
  const remote = new MemoryRemote();
  pushed(await pushSnapshot(deps(source), remote, fresh));

  const target = makeHost({ sessions: { 'old': { data: 0 } } });
  target.host.assets._importUserAsset = async () => { throw new Error('quota'); };
  await assert.rejects(() => pullAndApply(deps(target), remote, { replace: 'all' }), /only partly restored/);
  assert.equal(target.sessions.has('old'), true);
});

// ── plans/138 Tier D: undo copy and daily copies (WP-S3) ─────────────────────────

test('beforeApply runs after the download and before any write; its failure changes nothing', async () => {
  const source = makeHost({ sessions: { 'a': { data: 1 } } });
  const remote = new MemoryRemote();
  pushed(await pushSnapshot(deps(source), remote, fresh));

  const target = makeHost({ sessions: { 'mine': { data: { v: 0 } } } });
  await assert.rejects(
    () => pullAndApply(deps(target), remote, { replace: 'all', beforeApply: async () => { throw new Error('no space'); } }),
    /no space/,
  );
  assert.deepEqual([...target.sessions.keys()], ['mine']);

  const undo = new MemoryRemote();
  await pullAndApply(deps(target), remote, { replace: 'all', beforeApply: async () => { await saveCopy(deps(target), undo); } });
  assert.deepEqual([...target.sessions.keys()], ['a']);
  const back = makeHost();
  await pullAndApply(deps(back), undo);
  assert.deepEqual([...back.sessions.keys()], ['mine'], 'the undo copy holds the device as it was');
});

test('weekday and UTC date helpers', () => {
  assert.equal(isoWeekdayUtc('2026-09-14T23:59:59Z'), 1);            // a Monday
  assert.equal(isoWeekdayUtc('Sun, 20 Sep 2026 10:00:00 GMT'), 7);
  assert.equal(isoWeekdayUtc('not a date'), null);
  assert.equal(utcDate('2026-09-15T00:30:00+02:00'), '2026-09-14');
});

test('the daily copy is written once per UTC day, into that weekday’s slot', async () => {
  let clock = '2026-09-16T08:00:00Z';                                  // a Wednesday
  const slots = new Map<number, MemoryRemote>();
  const slotFor = (day: number): MemoryRemote => {
    if (!slots.has(day)) slots.set(day, new MemoryRemote(() => clock));
    return slots.get(day)!;
  };
  const meta = (when: string): SnapshotMeta => ({ rev: 'x', updatedAt: when, size: 1 });

  assert.equal(await writeDailyCopy(new Uint8Array([1]), meta(clock), slotFor), true);
  clock = '2026-09-16T20:00:00Z';
  assert.equal(await writeDailyCopy(new Uint8Array([2]), meta(clock), slotFor), false, 'same day: kept');
  assert.deepEqual([...(await slotFor(3).get())!.bytes], [1]);

  clock = '2026-09-23T09:00:00Z';                                      // next Wednesday
  assert.equal(await writeDailyCopy(new Uint8Array([3]), meta(clock), slotFor), true, 'a week later: rotated');
  assert.deepEqual([...(await slotFor(3).get())!.bytes], [3]);
  assert.deepEqual([...slots.keys()], [3]);
  assert.equal(await writeDailyCopy(new Uint8Array([4]), meta('garbage'), slotFor), false);
});

// ── plans/138 Tier D: size limits (WP-S4) ─────────────────────────────────────────

test('a snapshot over the upload limit is refused before anything is sent', async () => {
  const a = makeHost({ sessions: { 's1': { data: 'x'.repeat(2000) } } });
  const remote = new MemoryRemote();
  await assert.rejects(
    () => pushSnapshot(deps(a), remote, { ...fresh, maxUploadBytes: 64 }),
    (err: unknown) => err instanceof SyncTooLargeError && err.limit === 'upload' && err.max === 64,
  );
  assert.equal(await remote.head(), null);
  const { bytes } = await buildSnapshot(deps(a));
  assert.ok(bytes.length > 64);
});

// ── plans/138 Tier D: retry with backoff (R4) ─────────────────────────────────────

test('scheduler retries a failed push after the next wait, and a success resets the waits', async () => {
  const waits: number[] = [];
  let cb: (() => void) | null = null;
  const timers = {
    set: (fn: () => void, ms: number) => { cb = fn; waits.push(ms); return 1 as unknown as ReturnType<typeof setTimeout>; },
    clear: () => { cb = null; },
  };
  const fire = async (): Promise<void> => { const f = cb; cb = null; f?.(); for (let i = 0; i < 5; i++) await Promise.resolve(); };
  let fail = 3;
  let pushes = 0;
  const errors: unknown[] = [];
  const sched = makeSyncScheduler(async () => { pushes++; if (fail-- > 0) throw new Error('offline'); }, 1000,
    { timers, retryDelays: [10, 20], onError: (e) => errors.push(e) });

  await sched.flush();                  // fails → waits 10
  assert.deepEqual(waits, [10]);
  await fire();                         // fails → waits 20
  await fire();                         // fails → waits 20 (the last wait repeats)
  assert.deepEqual(waits, [10, 20, 20]);
  await fire();                         // succeeds → no further wait
  assert.equal(pushes, 4);
  assert.equal(errors.length, 3);
  assert.equal(cb, null);

  fail = 1;
  await sched.flush();                  // a new failure starts from the first wait again
  assert.deepEqual(waits, [10, 20, 20, 10]);
});

test('no retry without retryDelays (the old behaviour)', async () => {
  let armed = 0;
  const timers = { set: () => { armed++; return 1 as unknown as ReturnType<typeof setTimeout>; }, clear: () => {} };
  const sched = makeSyncScheduler(async () => { throw new Error('x'); }, 1000, { timers, onError: () => {} });
  await sched.flush();
  assert.equal(armed, 0);
});

// Keep the SyncState type in use for readers of this file.
const _typed: SyncState = INITIAL_SYNC_STATE;
void _typed;
