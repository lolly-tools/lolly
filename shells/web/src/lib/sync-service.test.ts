// SPDX-License-Identifier: MPL-2.0
/**
 * lib/sync-service.ts (plans/138 Tier D): the person-facing rules over the engine,
 * run against in-memory stores. A new device never overwrites an existing copy by
 * itself; a device with its own changes is never replaced without a choice; every
 * apply leaves an undo copy; restore makes the device and the store match an
 * earlier copy; a local change marks the device as waiting.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { MemoryRemote } from './sync-remote.ts';
import {
  syncNow, applyNewer, joinBringHere, keepThisDevice, listRestorePoints, restoreFrom,
  existingCopyForFirstJoin, initSyncAutoPush, markSyncDirty,
  setSyncRemoteForTests, resetSyncServiceForTests,
} from './sync-service.ts';
import { getSyncConfig, saveSyncConfig, getSyncBase, saveSyncBase, resetSyncConfigForTests } from './sync-config.ts';
import type { BackupIds } from '../data-transfer.ts';
import { resetSyncChangesForTests } from './sync-changes.ts';

function makeHost(sessions: Record<string, unknown> = {}, profile: Record<string, unknown> = {}) {
  const sess = new Map<string, unknown>(Object.entries(sessions));
  const store = new Map<string, string>();
  const me = { value: profile };
  const host = {
    profile: { async get() { return me.value; }, async set(p: Record<string, unknown>) { me.value = p; } },
    state: {
      async list() { return [...sess.keys()].map((slot) => ({ slot })); },
      async load(slot: string) { return sess.get(slot) ?? null; },
      async save(slot: string, data: unknown) { sess.set(slot, data); },
      async delete(slot: string) { sess.delete(slot); },
    },
    assets: {
      async _exportUserAssets() { return []; },
      async _importUserAsset() {},
      async _listUserAssets() { return []; },
      async _deleteUserAsset() {},
    },
    log() {},
  };
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
  return { deps: { host: host as never, storage }, sess, keys: () => [...sess.keys()].sort(), profile: () => me.value };
}

/** One in-memory store per path, shared by every "device" in a test. */
function memoryStores(): Map<string, MemoryRemote> {
  const stores = new Map<string, MemoryRemote>();
  let tick = 0;
  // Each write gets a later timestamp on a fixed day, so daily copies stay on one slot.
  const now = () => new Date(Date.UTC(2026, 8, 16, 8, 0, tick++)).toISOString();
  setSyncRemoteForTests('mem', (path) => {
    const key = path ?? 'snapshot';
    if (!stores.has(key)) stores.set(key, new MemoryRemote(now));
    return stores.get(key)!;
  });
  return stores;
}

/** Everything one device keeps locally about sync. */
interface DeviceSync { cfg: Awaited<ReturnType<typeof getSyncConfig>>; base: BackupIds | null }

async function current(): Promise<DeviceSync> {
  return { cfg: await getSyncConfig(), base: await getSyncBase() };
}

/** Switch "devices": each device has its own device-local sync settings. */
async function asDevice(device: DeviceSync | null): Promise<void> {
  resetSyncConfigForTests();
  resetSyncServiceForTests();
  if (!device) { await saveSyncConfig({ enabled: true, providerKind: 'mem' }); return; }
  await saveSyncConfig(device.cfg);
  if (device.base) await saveSyncBase(device.base);
}

beforeEach(async () => {
  resetSyncChangesForTests();
  await asDevice(null);
});

test('a new device meets the existing copy as a choice, never an overwrite', async () => {
  const stores = memoryStores();
  const laptop = makeHost({ a: { v: 1 } });
  assert.equal((await syncNow(laptop.deps)).status, 'pushed');
  const laptopSettings = await current();

  await asDevice(null);                                  // the phone
  const phone = makeHost();
  assert.ok(await existingCopyForFirstJoin(), 'the phone is asked first');
  const result = await syncNow(phone.deps);
  assert.equal(result.status, 'conflict');
  const cfg = await getSyncConfig();
  assert.ok(cfg.conflict, 'the conflict is recorded');
  assert.equal(cfg.conflictCount, 1);

  // "Bring it here": the phone gets the laptop's work, then the store gets the union.
  phone.sess.set('p', { phone: true });
  await joinBringHere(phone.deps);
  assert.deepEqual(phone.keys(), ['a', 'p']);
  assert.equal((await getSyncConfig()).conflict, null);

  await asDevice(laptopSettings);
  const check = makeHost();
  await applyNewer(check.deps, { useSynced: true });
  assert.deepEqual(check.keys(), ['a', 'p']);
  assert.ok(stores.get('lolly-backup/before-apply.lolly'), 'an undo copy was written');
});

test('a device with its own changes is not replaced without a choice', async () => {
  memoryStores();
  const laptop = makeHost({ a: { v: 1 } });
  await syncNow(laptop.deps);
  const laptopSettings = await current();

  await asDevice(null);
  const phone = makeHost();
  await joinBringHere(phone.deps);
  const phoneSettings = await current();

  // The laptop first takes the phone's join (which pushed), then deletes `a` and adds `b`.
  await asDevice(laptopSettings);
  assert.equal((await syncNow(laptop.deps)).status, 'newer', 'the laptop has not seen the phone’s push, and has nothing of its own');
  assert.equal((await getSyncConfig()).conflict, null, 'that is not a conflict');
  assert.deepEqual(await applyNewer(laptop.deps), { status: 'applied' });
  laptop.sess.delete('a');
  laptop.sess.set('b', { v: 2 });
  assert.equal((await syncNow(laptop.deps)).status, 'pushed');

  // The phone has an unsynced change: applying is refused and recorded.
  await asDevice({ ...phoneSettings, cfg: { ...phoneSettings.cfg, dirty: true } });
  phone.sess.set('c', { v: 3 });
  assert.deepEqual(await applyNewer(phone.deps), { status: 'conflict' });
  assert.deepEqual(phone.keys(), ['a', 'c']);
  assert.ok((await getSyncConfig()).conflict);

  // The person chooses the synced copy: `a` goes, `b` arrives, `c` (never synced) stays.
  assert.deepEqual(await applyNewer(phone.deps, { useSynced: true }), { status: 'applied' });
  assert.deepEqual(phone.keys(), ['b', 'c']);
  const after = await getSyncConfig();
  assert.equal(after.dirty, false);
  assert.equal(after.conflict, null);
  assert.deepEqual((await getSyncBase())!.sessions, ['b']);
});

test('"Keep this device" replaces the synced copy and clears the conflict', async () => {
  memoryStores();
  await syncNow(makeHost({ a: 1 }).deps);
  await asDevice(null);
  const phone = makeHost({ mine: { v: 1 } });
  assert.equal((await syncNow(phone.deps)).status, 'conflict');
  await keepThisDevice(phone.deps);
  const cfg = await getSyncConfig();
  assert.equal(cfg.conflict, null);
  assert.ok(cfg.lastSyncedRev);

  await asDevice(null);
  const third = makeHost();
  await joinBringHere(third.deps);
  assert.deepEqual(third.keys(), ['mine']);
});

test('restore lists the copies and makes the device and the store match one', async () => {
  memoryStores();
  const laptop = makeHost({ a: { v: 1 } });
  await syncNow(laptop.deps);
  const laptopSettings = await current();

  await asDevice(null);
  const phone = makeHost({ old: { v: 0 } });
  await joinBringHere(phone.deps);                       // writes the before-apply copy (just `old`)
  assert.deepEqual(phone.keys(), ['a', 'old']);

  const points = await listRestorePoints();
  const slots = points.map((p) => p.slot).sort();
  assert.ok(slots.includes('before-apply'));
  assert.ok(slots.includes('day-3'), '16 Sep 2026 is a Wednesday');

  await restoreFrom(phone.deps, 'before-apply');
  assert.deepEqual(phone.keys(), ['old']);

  await asDevice(laptopSettings);
  const check = makeHost();
  await applyNewer(check.deps, { useSynced: true });
  assert.deepEqual(check.keys(), ['old'], 'the restored state is now the synced copy');
});

// plans/277 P7: "Bring it to this device" merges the profile record, so the
// joining device keeps its folders, favourites and templates; the ordinary apply
// that keeps devices in step still takes the synced record.
test('"Bring it to this device" keeps this device’s folders, favourites and templates; a later apply converges', async () => {
  memoryStores();
  const folder = (id: string, ref: string) => ({ id, name: id, parentId: null, items: [{ type: 'session', ref }], createdAt: 'a', updatedAt: 'a' });
  const laptop = makeHost({ a: { v: 1 } }, {
    firstname: 'Ada', favourites: ['chart'], folders: [folder('laptop-folder', 'a')],
    userTemplates: [{ id: 'tpl-laptop' }],
  });
  await syncNow(laptop.deps);
  const laptopSettings = await current();

  await asDevice(null);
  const phone = makeHost({ p: { phone: true } }, {
    firstname: 'Grace', favourites: ['qr-code'], folders: [folder('phone-folder', 'p')],
    userTemplates: [{ id: 'tpl-phone' }],
  });
  await joinBringHere(phone.deps);
  const joined = phone.profile() as Record<string, any>;
  assert.equal(joined.firstname, 'Grace');
  assert.deepEqual(joined.favourites, ['qr-code', 'chart']);
  assert.deepEqual(joined.folders.map((f: { id: string }) => f.id), ['phone-folder', 'laptop-folder']);
  assert.deepEqual(joined.userTemplates.map((t: { id: string }) => t.id), ['tpl-phone', 'tpl-laptop']);

  // The join pushed the union; the laptop's ordinary apply takes that record whole.
  await asDevice(laptopSettings);
  assert.deepEqual(await applyNewer(laptop.deps), { status: 'applied' });
  const applied = laptop.profile() as Record<string, any>;
  assert.equal(applied.firstname, 'Grace', 'keeping devices in step takes the synced record');
  assert.deepEqual(applied.folders.map((f: { id: string }) => f.id), ['phone-folder', 'laptop-folder']);
});

test('"Bring it to this device" keeps this device’s copy of a shared session; Restore still goes back in time', async () => {
  memoryStores();
  await syncNow(makeHost({ doc: { from: 'laptop' } }).deps);
  await asDevice(null);
  const phone = makeHost({ doc: { from: 'phone' } });
  await joinBringHere(phone.deps);                       // no readable times: this device's copy stays
  assert.deepEqual(phone.sess.get('doc'), { from: 'phone' });

  phone.sess.set('doc', { from: 'phone, edited later' });
  await restoreFrom(phone.deps, 'before-apply');         // the copy saved before the join
  assert.deepEqual(phone.sess.get('doc'), { from: 'phone' }, 'a restore replaces newer work on purpose');
});

test('a local change marks the device as waiting once sync is wired', async () => {
  memoryStores();
  const host = makeHost();
  initSyncAutoPush(() => host.deps);
  markSyncDirty();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal((await getSyncConfig()).dirty, true);
  resetSyncServiceForTests();
});
