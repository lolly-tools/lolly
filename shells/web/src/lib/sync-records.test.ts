// SPDX-License-Identifier: MPL-2.0
/**
 * Per-record sync (plans/138 B2, plan 203 rank 9): lib/sync-engine.ts `syncRecords`
 * over lib/sync-records.ts, end to end against an in-memory store and in-memory
 * devices. The acceptance case is two devices editing offline and reconciling
 * without loss; around it, conflict copies, field merges, tombstones that do not
 * resurrect, deduplication, encryption, a lost race, rollback, and history that
 * never leaves its device.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MemoryRemote, SyncConflictError, type SyncRemote } from './sync-remote.ts';
import {
  syncRecords, collectRecordGarbage, RECORD_INDEX_PATH, recordObjectPath, SyncRollbackError, SnapshotPassphraseError,
  type RecordSyncBase, type RecordSyncOpts, type RecordIndex,
} from './sync-engine.ts';
import { collectLocalRecords, conflictCopyId, mergeFields } from './sync-records.ts';
import { isSealedObject } from './sync-keys.ts';

// ── An in-memory store and in-memory devices ────────────────────────────────────

interface Clock { now: string }
const at = (iso: string): Clock => ({ now: iso });
const tick = (clock: Clock, minutes: number): void => { clock.now = new Date(Date.parse(clock.now) + minutes * 60_000).toISOString(); };
const DAY = 24 * 60;

function makeStore(clock: Clock) {
  const objects = new Map<string, MemoryRemote>();
  const open = (path: string): MemoryRemote => {
    let remote = objects.get(path);
    if (!remote) { remote = new MemoryRemote(() => clock.now); objects.set(path, remote); }
    return remote;
  };
  const stored = async (): Promise<Map<string, Uint8Array>> => {
    const out = new Map<string, Uint8Array>();
    for (const [path, remote] of objects) { const got = await remote.get(); if (got) out.set(path, got.bytes); }
    return out;
  };
  const objectCount = async (): Promise<number> => [...(await stored()).keys()].filter((p) => p.startsWith('lolly-sync/v2/objects/')).length;
  const index = async (): Promise<RecordIndex> => JSON.parse(new TextDecoder().decode((await open(RECORD_INDEX_PATH).get())!.bytes)) as RecordIndex;
  return { open, objects, stored, objectCount, index };
}
type Store = ReturnType<typeof makeStore>;

type SessionRow = { data: Record<string, unknown>; thumb: string | null; updatedAt: string; savedAt?: string };

function makeDevice(name: string, clock: Clock) {
  let profile: Record<string, unknown> = {};
  const sessions = new Map<string, SessionRow>();
  const assets = new Map<string, Record<string, unknown>>();
  const prefs = new Map<string, string>();
  const systems = new Map<string, Record<string, unknown>>();
  let active = 'shipped';
  const spies = { history: 0, fileHistory: 0 };
  const host = {
    fileHistory: {
      async export() { spies.fileHistory++; throw new Error('file history must stay on this device'); },
      async restore() { spies.fileHistory++; throw new Error('file history must stay on this device'); },
    },
    profile: {
      async get() { return profile; },
      async set(p: Record<string, unknown>) { profile = structuredClone(p); },
    },
    state: {
      history: { backup: {
        async export() { spies.history++; throw new Error('revision history must stay on this device'); },
        async restore() { spies.history++; throw new Error('revision history must stay on this device'); },
      } },
      // Like the web bridge, the tool id and label come from the saved data.
      async list() {
        return [...sessions].map(([slot, r]) => ({
          slot, toolId: r.data.__toolId, label: r.data.__label, thumb: r.thumb, updatedAt: r.updatedAt, ...(r.savedAt ? { savedAt: r.savedAt } : {}),
        }));
      },
      async load(slot: string) { return sessions.get(slot)?.data ?? null; },
      async save(slot: string, data: Record<string, unknown>, thumb: string | null = null) {
        sessions.set(slot, { data: structuredClone(data), thumb, updatedAt: clock.now, savedAt: clock.now });
      },
      async restore(slot: string, data: Record<string, unknown>, thumb: string | null, updatedAt: string, savedAt?: string) {
        sessions.set(slot, { data: structuredClone(data), thumb, updatedAt, ...(savedAt ? { savedAt } : {}) });
      },
      async delete(slot: string) { sessions.delete(slot); },
    },
    assets: {
      async _exportUserAssets() { return [...assets.values()].map((r) => ({ ...r })); },
      async _importUserAsset(rec: Record<string, unknown>) { assets.set(String(rec.id), { ...rec }); },
      async _listUserAssets() { return [...assets.keys()].map((id) => ({ id })); },
      async _deleteUserAsset(id: string) { assets.delete(id); },
    },
    designSystems: {
      async list() { return [{ id: 'shipped', source: { kind: 'shipped' } }, ...[...systems.values()].map((r) => structuredClone(r))]; },
      async activeId() { return active; },
      async put(r: Record<string, unknown>) { systems.set(String(r.id), structuredClone(r)); },
      async remove(id: string) { systems.delete(id); },
      // Like the real registry: an unknown id is refused, and choosing one stamps its use.
      async setActive(id: string) {
        const rec = systems.get(id);
        if (id !== 'shipped' && !rec) throw new Error(`no system ${id}`);
        if (rec) systems.set(id, { ...rec, lastUsedAt: Date.parse(clock.now) });
        active = id;
      },
    },
    log() { /* quiet */ },
  };
  const storage = {
    getItem: (k: string) => prefs.get(k) ?? null,
    setItem: (k: string, v: string) => { prefs.set(k, v); },
    removeItem: (k: string) => { prefs.delete(k); },
  };
  const device = {
    name, host, storage, sessions, assets, prefs, systems, spies,
    base: null as RecordSyncBase | null,
    passphrase: undefined as string | undefined,
    get profile() { return profile; },
    set profile(p: Record<string, unknown>) { profile = p; },
    get active() { return active; },
    deps: () => ({ host: host as never, storage }),
    /** Save a session the way the editor does: stamped now. */
    save: (slot: string, data: Record<string, unknown>) => host.state.save(slot, { __toolId: 'qr-code', ...data }),
    data: (slot: string) => { const d = sessions.get(slot)?.data; if (!d) return undefined; const { __toolId: _t, ...rest } = d; return rest; },
    addAsset: (id: string, content: string, meta: Record<string, unknown> = {}) => {
      assets.set(id, { id, type: 'image', format: 'png', meta: { name: id.split('/').pop(), modifiedAt: Date.parse(clock.now), ...meta }, blob: new Blob([content], { type: 'image/png' }) });
    },
    assetText: async (id: string) => { const b = assets.get(id)?.blob; return b instanceof Blob ? b.text() : undefined; },
  };
  return device;
}
type Device = ReturnType<typeof makeDevice>;

async function sync(dev: Device, store: Store, clock: Clock, extra: Partial<RecordSyncOpts> = {}) {
  const result = await syncRecords(dev.deps(), {
    open: store.open, base: dev.base, now: () => clock.now, device: dev.name, passphrase: dev.passphrase, ...extra,
  });
  dev.base = result.base;
  return result;
}

/** What a person would compare between two devices. */
async function view(dev: Device) {
  const assets: Record<string, string | undefined> = {};
  for (const id of [...dev.assets.keys()].sort()) assets[id] = await dev.assetText(id);
  const sessions: Record<string, unknown> = {};
  for (const slot of [...dev.sessions.keys()].sort()) sessions[slot] = dev.data(slot);
  return { sessions, assets, prefs: Object.fromEntries([...dev.prefs].sort()), profile: dev.profile };
}

// ── The acceptance case ─────────────────────────────────────────────────────────

test('two devices edit offline and reconcile without loss', async () => {
  const clock = at('2026-10-17T09:00:00.000Z');
  const store = makeStore(clock);
  const a = makeDevice('Laptop', clock);
  const b = makeDevice('Phone', clock);
  a.profile = { name: 'Ann', favourites: ['qr-code'] };
  await a.save('qr-code:one', { text: 'v1' });
  await a.save('qr-code:two', { text: 'v1' });
  await sync(a, store, clock);
  const joined = await sync(b, store, clock);
  assert.deepEqual(joined.conflicts, []);
  assert.deepEqual(await view(b), await view(a), 'the second device joins with everything');

  // Both go offline and change different things.
  tick(clock, 10);
  await a.save('qr-code:one', { text: 'laptop edit' });
  a.addAsset('user/raster/1760000000000-0001', 'logo bytes');
  tick(clock, 10);
  await b.save('qr-code:two', { text: 'phone edit' });
  b.storage.setItem('theme', 'dark');
  b.profile = { ...b.profile, favourites: ['qr-code', 'chart'] };

  const first = await sync(a, store, clock);
  assert.deepEqual(first.pushed.sort(), ['asset/user/raster/1760000000000-0001', 'session/qr-code:one']);
  const second = await sync(b, store, clock);
  assert.deepEqual(second.conflicts, []);
  assert.deepEqual(second.pulled.sort(), ['asset/user/raster/1760000000000-0001', 'session/qr-code:one']);
  const third = await sync(a, store, clock);
  assert.deepEqual(third.pulled.sort(), ['pref/theme', 'profile', 'session/qr-code:two']);

  const expected = {
    sessions: { 'qr-code:one': { text: 'laptop edit' }, 'qr-code:two': { text: 'phone edit' } },
    assets: { 'user/raster/1760000000000-0001': 'logo bytes' },
    prefs: { theme: 'dark' },
    profile: { name: 'Ann', favourites: ['qr-code', 'chart'] },
  };
  assert.deepEqual(await view(a), expected);
  assert.deepEqual(await view(b), expected);

  // Settled: another round moves nothing and writes no index.
  const rev = (await store.open(RECORD_INDEX_PATH).head())!.rev;
  for (const dev of [a, b]) {
    const again = await sync(dev, store, clock);
    assert.deepEqual([again.pushed, again.pulled, again.tombstoned, again.removedHere], [[], [], [], []]);
  }
  assert.equal((await store.open(RECORD_INDEX_PATH).head())!.rev, rev);
});

test('the same project edited on both devices: the later save stays, the other is kept as a copy on both', async () => {
  for (const laterSyncsFirst of [true, false]) {
    const clock = at('2026-10-17T09:00:00.000Z');
    const store = makeStore(clock);
    const a = makeDevice('Laptop', clock);
    const b = makeDevice('Phone', clock);
    await a.save('qr-code:one', { text: 'v1' });
    await sync(a, store, clock);
    await sync(b, store, clock);

    tick(clock, 5);
    await a.save('qr-code:one', { text: 'earlier edit' });
    tick(clock, 5);
    await b.save('qr-code:one', { text: 'later edit' });
    const [first, second] = laterSyncsFirst ? [b, a] : [a, b];
    await sync(first, store, clock);
    const settled = await sync(second, store, clock);
    await sync(first, store, clock);

    assert.equal(settled.conflicts.length, 1);
    const [conflict] = settled.conflicts;
    assert.equal(conflict!.kept, 'both');
    assert.match(conflict!.copy!, /^session\/qr-code:[0-9a-f-]{36}$/);
    const copySlot = conflict!.copy!.slice('session/'.length);
    for (const dev of [a, b]) {
      assert.deepEqual(dev.data('qr-code:one'), { text: 'later edit' }, `${dev.name}: the later save stays at the project`);
      assert.deepEqual(dev.data(copySlot), { text: 'earlier edit' }, `${dev.name}: the other edit is kept`);
    }
    assert.deepEqual(await view(a), await view(b));
  }
});

test('the profile record merges field by field, keeping list additions from both', async () => {
  const clock = at('2026-10-17T09:00:00.000Z');
  const store = makeStore(clock);
  const a = makeDevice('Laptop', clock);
  const b = makeDevice('Phone', clock);
  a.profile = { name: 'Ann', lang: 'en', favourites: ['qr-code'] };
  await sync(a, store, clock);
  await sync(b, store, clock);

  a.profile = { ...a.profile, name: 'Ann B', favourites: ['qr-code', 'chart'] };
  b.profile = { ...b.profile, lang: 'fr', favourites: ['qr-code', 'design'] };
  await sync(a, store, clock);
  const merged = await sync(b, store, clock);
  await sync(a, store, clock);
  assert.deepEqual(merged.conflicts, [{ key: 'profile', kept: 'merged' }]);
  const expected = { name: 'Ann B', lang: 'fr', favourites: ['qr-code', 'chart', 'design'] };
  assert.deepEqual(a.profile, expected);
  assert.deepEqual(b.profile, expected);
});

test('a design-system record merges: the later use, both tag sets, and a one-sided rename', async () => {
  const clock = at('2026-10-17T09:00:00.000Z');
  const store = makeStore(clock);
  const a = makeDevice('Laptop', clock);
  const b = makeDevice('Phone', clock);
  const record = { id: 'acme', label: 'Acme', ns: 'user/ds/acme/', headId: 'user/ds/acme/tokens/brand', source: { kind: 'import' }, locked: false, createdAt: 1, lastUsedAt: 1 };
  await a.host.designSystems.put(record);
  await a.host.designSystems.setActive('acme');
  await sync(a, store, clock);
  await sync(b, store, clock);
  assert.equal(b.active, 'acme', 'the active choice travels');

  await a.host.designSystems.put({ ...record, label: 'Acme Co', lastUsedAt: 5 });
  await b.host.designSystems.put({ ...record, lastUsedAt: 9, tags: ['print'] });
  await sync(a, store, clock);
  await sync(b, store, clock);
  await sync(a, store, clock);
  for (const dev of [a, b]) {
    const got = dev.systems.get('acme')!;
    assert.equal(got.label, 'Acme Co');
    assert.equal(got.lastUsedAt, 9);
    assert.deepEqual(got.tags, ['print']);
  }
});

// ── Deletions ───────────────────────────────────────────────────────────────────

test('a deletion reaches the other device, and the deleted copy does not come back', async () => {
  const clock = at('2026-10-17T09:00:00.000Z');
  const store = makeStore(clock);
  const a = makeDevice('Laptop', clock);
  const b = makeDevice('Phone', clock);
  await a.save('qr-code:one', { text: 'keep' });
  await a.save('qr-code:gone', { text: 'delete me' });
  const oldRow = structuredClone(a.sessions.get('qr-code:gone')!);
  await sync(a, store, clock);
  await sync(b, store, clock);

  await a.host.state.delete('qr-code:gone');
  const deleted = await sync(a, store, clock);
  assert.deepEqual(deleted.tombstoned, ['session/qr-code:gone']);
  const applied = await sync(b, store, clock);
  assert.deepEqual(applied.removedHere, ['session/qr-code:gone']);
  assert.equal(b.sessions.has('qr-code:gone'), false);
  assert.deepEqual((await sync(b, store, clock)).pushed, [], 'B does not send it back');

  // A third device restored from an old backup holds the exact deleted copy.
  const c = makeDevice('Old tablet', clock);
  c.sessions.set('qr-code:gone', oldRow);
  const joined = await sync(c, store, clock);
  assert.deepEqual(joined.removedHere, ['session/qr-code:gone']);
  assert.equal(c.sessions.has('qr-code:gone'), false);
  assert.ok((await store.index()).records['session/qr-code:gone']!.deletedAt, 'still a tombstone');
  assert.deepEqual(c.data('qr-code:one'), { text: 'keep' });
});

test('an edit that meets a deletion is kept, whichever device syncs first', async () => {
  for (const editorFirst of [true, false]) {
    const clock = at('2026-10-17T09:00:00.000Z');
    const store = makeStore(clock);
    const a = makeDevice('Laptop', clock);
    const b = makeDevice('Phone', clock);
    await a.save('qr-code:one', { text: 'v1' });
    await sync(a, store, clock);
    await sync(b, store, clock);

    tick(clock, 5);
    await a.host.state.delete('qr-code:one');
    await b.save('qr-code:one', { text: 'edited while deleted elsewhere' });
    const [first, second] = editorFirst ? [b, a] : [a, b];
    await sync(first, store, clock);
    const met = await sync(second, store, clock);
    await sync(first, store, clock);
    assert.equal(met.conflicts[0]?.editMetDelete, editorFirst ? 'store' : 'here');
    for (const dev of [a, b]) assert.deepEqual(dev.data('qr-code:one'), { text: 'edited while deleted elsewhere' });
  }
});

test('a tombstone leaves the index after its retention; a device that knew the record still removes it', async () => {
  const clock = at('2026-10-17T09:00:00.000Z');
  const store = makeStore(clock);
  const a = makeDevice('Laptop', clock);
  const b = makeDevice('Phone', clock);
  await a.save('qr-code:one', { text: 'v1' });
  await a.save('qr-code:two', { text: 'v1' });
  await sync(a, store, clock);
  await sync(b, store, clock);
  await a.host.state.delete('qr-code:one');
  await sync(a, store, clock);

  tick(clock, 91 * DAY);
  await a.save('qr-code:two', { text: 'v2' });
  await sync(a, store, clock);
  assert.equal((await store.index()).records['session/qr-code:one'], undefined, 'the tombstone was pruned');
  const late = await sync(b, store, clock);
  assert.deepEqual(late.removedHere, ['session/qr-code:one']);
  assert.deepEqual(b.data('qr-code:two'), { text: 'v2' });
});

// ── Assets: deduplication, copies, design material ──────────────────────────────

test('identical bytes are stored once, and a rename moves no image bytes', async () => {
  const clock = at('2026-10-17T09:00:00.000Z');
  const store = makeStore(clock);
  const a = makeDevice('Laptop', clock);
  a.addAsset('user/raster/1760000000000-0001', 'the same picture');
  a.addAsset('user/raster/1760000000000-0002', 'the same picture');
  await sync(a, store, clock);
  assert.equal(await store.objectCount(), 3, 'one picture and two records');

  const rec = a.assets.get('user/raster/1760000000000-0001')!;
  a.assets.set(rec.id as string, { ...rec, meta: { ...(rec.meta as object), name: 'renamed' } });
  const renamed = await sync(a, store, clock);
  assert.deepEqual(renamed.uploaded.objects, 1, 'only the new record body');
  assert.ok(renamed.reused >= 1, 'the picture is reused');

  const b = makeDevice('Phone', clock);
  await sync(b, store, clock);
  assert.equal(await b.assetText('user/raster/1760000000000-0002'), 'the same picture');
  assert.equal((b.assets.get('user/raster/1760000000000-0001')!.meta as { name: string }).name, 'renamed');
});

test('an upload edited on both devices keeps both; design material keeps the later copy only', async () => {
  const clock = at('2026-10-17T09:00:00.000Z');
  const store = makeStore(clock);
  const a = makeDevice('Laptop', clock);
  const b = makeDevice('Phone', clock);
  a.addAsset('user/raster/1760000000000-0001', 'original');
  a.addAsset('user/ds/acme/tokens/brand', '{"color":"red"}');
  await sync(a, store, clock);
  await sync(b, store, clock);

  tick(clock, 5);
  a.addAsset('user/raster/1760000000000-0001', 'laptop crop');
  a.addAsset('user/ds/acme/tokens/brand', '{"color":"blue"}');
  tick(clock, 5);
  b.addAsset('user/raster/1760000000000-0001', 'phone crop');
  b.addAsset('user/ds/acme/tokens/brand', '{"color":"green"}');
  await sync(a, store, clock);
  const settled = await sync(b, store, clock);
  await sync(a, store, clock);

  const upload = settled.conflicts.find((c) => c.key === 'asset/user/raster/1760000000000-0001')!;
  assert.equal(upload.kept, 'both');
  assert.match(upload.copy!, /^asset\/user\/raster\/1760000000000-[0-9a-f]{12}-copy$/);
  const material = settled.conflicts.find((c) => c.key === 'asset/user/ds/acme/tokens/brand')!;
  assert.equal(material.kept, 'here', 'the later copy stays, and no loose copy of design material is made');
  assert.equal(material.copy, undefined);
  for (const dev of [a, b]) {
    assert.equal(await dev.assetText('user/raster/1760000000000-0001'), 'phone crop');
    assert.equal(await dev.assetText(upload.copy!.slice('asset/'.length)), 'laptop crop');
    assert.equal(await dev.assetText('user/ds/acme/tokens/brand'), '{"color":"green"}');
  }
});

test('an object too large for this shell waits; everything else syncs', async () => {
  const clock = at('2026-10-17T09:00:00.000Z');
  const store = makeStore(clock);
  const a = makeDevice('Phone app', clock);
  a.addAsset('user/video/1760000000000-0001', 'x'.repeat(5000));
  await a.save('qr-code:one', { text: 'small' });
  const limited = await sync(a, store, clock, { maxUploadBytes: 2000 });
  assert.deepEqual(limited.deferred, [{ key: 'asset/user/video/1760000000000-0001', reason: 'too-large' }]);
  assert.deepEqual(limited.pushed, ['session/qr-code:one']);
  const later = await sync(a, store, clock);
  assert.deepEqual(later.pushed, ['asset/user/video/1760000000000-0001']);
});

// ── History stays on its device ─────────────────────────────────────────────────

test('history and discarded edits never leave the device', async () => {
  const clock = at('2026-10-17T09:00:00.000Z');
  const store = makeStore(clock);
  const a = makeDevice('Laptop', clock);
  await a.save('qr-code:one', { text: 'saved work' });
  await a.host.state.save('__discarded__:mfw1x2:qr-code:two', { __toolId: 'qr-code', text: 'discarded edit' });
  await sync(a, store, clock);
  assert.deepEqual(Object.keys((await store.index()).records), ['session/qr-code:one']);
  for (const [, bytes] of await store.stored()) assert.equal(new TextDecoder().decode(bytes).includes('discarded edit'), false);
  assert.deepEqual(a.spies, { history: 0, fileHistory: 0 });

  const b = makeDevice('Phone', clock);
  await sync(b, store, clock);
  assert.deepEqual([...b.sessions.keys()], ['qr-code:one']);
  assert.deepEqual(b.spies, { history: 0, fileHistory: 0 });
  // The discarded edit is still here: sync never removes one.
  assert.equal(a.sessions.has('__discarded__:mfw1x2:qr-code:two'), true);
});

// ── Encryption ──────────────────────────────────────────────────────────────────

test('with a passphrase the store holds sealed objects under keyed names', async () => {
  const clock = at('2026-10-17T09:00:00.000Z');
  const store = makeStore(clock);
  const a = makeDevice('Laptop', clock);
  a.passphrase = 'correct horse battery';
  await a.save('qr-code:one', { text: 'a private note' });
  a.addAsset('user/raster/1760000000000-0001', 'private picture');
  await sync(a, store, clock);

  const plainHashes = [...(await collectLocalRecords(a.deps())).values()].map((r) => r.hash);
  for (const [path, bytes] of await store.stored()) {
    assert.ok(isSealedObject(bytes), `${path} is sealed`);
    const text = new TextDecoder().decode(bytes);
    assert.equal(text.includes('private'), false);
    assert.equal(text.includes('qr-code:one'), false, 'record ids are inside the sealed index');
    for (const hash of plainHashes) assert.equal(path.endsWith(hash), false, 'names do not reveal content hashes');
  }

  const b = makeDevice('Phone', clock);
  await assert.rejects(() => sync(b, store, clock), (err) => err instanceof SnapshotPassphraseError && err.reason === 'missing');
  b.passphrase = 'wrong';
  await assert.rejects(() => sync(b, store, clock), (err) => err instanceof SnapshotPassphraseError && err.reason === 'wrong');
  b.passphrase = 'correct horse battery';
  await sync(b, store, clock);
  assert.deepEqual(await view(b), await view(a));

  // A plain device never applies a sealed store, and a passphrase never meets a plain one.
  const plainStore = makeStore(clock);
  const c = makeDevice('Desktop', clock);
  await c.save('qr-code:one', { text: 'plain' });
  await sync(c, plainStore, clock);
  const d = makeDevice('Other', clock);
  d.passphrase = 'set by mistake';
  await assert.rejects(() => sync(d, plainStore, clock), /not encrypted/);
});

// ── Races, rollback, a forced replace ───────────────────────────────────────────

test('another device writing between the read and the write: read again, merge again', async () => {
  const clock = at('2026-10-17T09:00:00.000Z');
  const store = makeStore(clock);
  const a = makeDevice('Laptop', clock);
  const b = makeDevice('Phone', clock);
  await a.save('qr-code:one', { text: 'v1' });
  await a.save('qr-code:two', { text: 'v1' });
  await sync(a, store, clock);
  await sync(b, store, clock);
  await a.save('qr-code:one', { text: 'laptop' });
  await b.save('qr-code:two', { text: 'phone' });

  let raced = false;
  const racingOpen = (path: string): SyncRemote => {
    const real = store.open(path);
    if (path !== RECORD_INDEX_PATH) return real;
    return {
      kind: real.kind, head: () => real.head(), get: () => real.get(),
      put: async (bytes, opts) => {
        if (!raced) { raced = true; await sync(b, store, clock); }
        return real.put(bytes, opts);
      },
    };
  };
  const result = await sync(a, store, clock, { open: racingOpen });
  assert.ok(raced);
  assert.deepEqual(result.pulled, ['session/qr-code:two']);
  await sync(b, store, clock);
  for (const dev of [a, b]) assert.deepEqual([dev.data('qr-code:one'), dev.data('qr-code:two')], [{ text: 'laptop' }, { text: 'phone' }]);
});

test('a store that keeps losing the race gives up with a conflict, changing nothing here', async () => {
  const clock = at('2026-10-17T09:00:00.000Z');
  const store = makeStore(clock);
  const a = makeDevice('Laptop', clock);
  await a.save('qr-code:one', { text: 'v1' });
  const busyOpen = (path: string): SyncRemote => {
    const real = store.open(path);
    if (path !== RECORD_INDEX_PATH) return real;
    return { kind: real.kind, head: () => real.head(), get: () => real.get(), put: async () => { throw new SyncConflictError(); } };
  };
  await assert.rejects(() => sync(a, store, clock, { open: busyOpen }), SyncConflictError);
  assert.deepEqual(a.data('qr-code:one'), { text: 'v1' });
});

test('an older index served again is refused; replacing the synced copy recovers', async () => {
  const clock = at('2026-10-17T09:00:00.000Z');
  const store = makeStore(clock);
  const a = makeDevice('Laptop', clock);
  await a.save('qr-code:one', { text: 'v1' });
  await sync(a, store, clock);
  const old = (await store.open(RECORD_INDEX_PATH).get())!.bytes;
  await a.save('qr-code:one', { text: 'v2' });
  await sync(a, store, clock);
  await store.open(RECORD_INDEX_PATH).put(old);
  await assert.rejects(() => sync(a, store, clock), SyncRollbackError);
  assert.deepEqual(a.data('qr-code:one'), { text: 'v2' }, 'nothing was applied');
  await sync(a, store, clock, { force: true });
  const b = makeDevice('Phone', clock);
  await sync(b, store, clock);
  assert.deepEqual(b.data('qr-code:one'), { text: 'v2' });
});

test('"replace the synced copy with this device" removes what only the store had, on every device', async () => {
  const clock = at('2026-10-17T09:00:00.000Z');
  const store = makeStore(clock);
  const a = makeDevice('Laptop', clock);
  const b = makeDevice('Phone', clock);
  await a.save('qr-code:one', { text: 'v1' });
  await sync(a, store, clock);
  await sync(b, store, clock);
  await b.save('qr-code:extra', { text: 'only on the phone' });
  await sync(b, store, clock);

  const forced = await sync(a, store, clock, { force: true });
  assert.deepEqual(forced.tombstoned, ['session/qr-code:extra']);
  assert.deepEqual(forced.pulled, [], 'a forced sync brings nothing here');
  const applied = await sync(b, store, clock);
  assert.deepEqual(applied.removedHere, ['session/qr-code:extra']);
});

test('a change made here during the sync is not overwritten; the next sync settles it', async () => {
  const clock = at('2026-10-17T09:00:00.000Z');
  const store = makeStore(clock);
  const a = makeDevice('Laptop', clock);
  const b = makeDevice('Phone', clock);
  await a.save('qr-code:one', { text: 'v1' });
  await sync(a, store, clock);
  await sync(b, store, clock);
  tick(clock, 5);
  await a.save('qr-code:one', { text: 'laptop' });
  await sync(a, store, clock);

  // The person edits on the phone while its sync is reading the store.
  tick(clock, 5);
  const editingOpen = (path: string): SyncRemote => {
    const real = store.open(path);
    if (path !== RECORD_INDEX_PATH) return real;
    return {
      kind: real.kind, head: () => real.head(), put: (bytes, opts) => real.put(bytes, opts),
      get: async () => { const got = await real.get(); await b.save('qr-code:one', { text: 'phone, typed during sync' }); return got; },
    };
  };
  const during = await sync(b, store, clock, { open: editingOpen });
  assert.deepEqual(during.deferred, [{ key: 'session/qr-code:one', reason: 'changed-here' }]);
  assert.deepEqual(b.data('qr-code:one'), { text: 'phone, typed during sync' });

  const settled = await sync(b, store, clock);
  assert.equal(settled.conflicts[0]?.kept, 'both');
  await sync(a, store, clock);
  for (const dev of [a, b]) {
    assert.deepEqual(dev.data('qr-code:one'), { text: 'phone, typed during sync' });
    const copy = settled.conflicts[0]!.copy!.slice('session/'.length);
    assert.deepEqual(dev.data(copy), { text: 'laptop' });
  }
});

// ── Clearing objects nothing names ──────────────────────────────────────────────

test('objects nothing names are removed after the grace period, never the live ones', async () => {
  const clock = at('2026-10-17T09:00:00.000Z');
  const store = makeStore(clock);
  const a = makeDevice('Laptop', clock);
  await a.save('qr-code:one', { text: 'first version' });
  await sync(a, store, clock);
  await a.save('qr-code:one', { text: 'second version' });
  await sync(a, store, clock);
  assert.equal(Object.keys((await store.index()).retired).length, 1, 'the first version is retired');
  assert.equal(await store.objectCount(), 2);

  const now = () => clock.now;
  assert.equal(await collectRecordGarbage(store.open, { now }), 0, 'not before the grace period');
  tick(clock, 8 * DAY);
  assert.equal(await collectRecordGarbage(store.open, { now }), 1);
  const index = await store.index();
  assert.deepEqual([index.retired, index.removing], [{}, {}]);
  assert.equal(await store.objectCount(), 1);
  const b = makeDevice('Phone', clock);
  await sync(b, store, clock);
  assert.deepEqual(b.data('qr-code:one'), { text: 'second version' });
});

test('a name being removed is never reused: the content goes up under another name', async () => {
  const clock = at('2026-10-17T09:00:00.000Z');
  const store = makeStore(clock);
  const a = makeDevice('Laptop', clock);
  await a.save('qr-code:one', { text: 'content' });
  const [rec] = [...(await collectLocalRecords(a.deps())).values()];
  const index = { format: 'lolly-sync-index', version: 1, minReader: 1, store: 'test-store', seq: 1, records: {}, retired: {}, removing: { [rec!.hash]: clock.now } };
  await store.open(RECORD_INDEX_PATH).put(new TextEncoder().encode(JSON.stringify(index)));
  await store.open(recordObjectPath(rec!.hash)).put(new Uint8Array([1, 2, 3]));   // about to go
  await sync(a, store, clock);
  assert.equal((await store.index()).records['session/qr-code:one']!.object, `${rec!.hash}.1`);
  await store.open(recordObjectPath(rec!.hash)).remove();
  const b = makeDevice('Phone', clock);
  await sync(b, store, clock);
  assert.deepEqual(b.data('qr-code:one'), { text: 'content' });
});

test('an index entry that points outside the objects folder is refused, and nothing changes here', async () => {
  const clock = at('2026-10-17T09:00:00.000Z');
  const store = makeStore(clock);
  const a = makeDevice('Laptop', clock);
  await a.save('qr-code:one', { text: 'mine' });
  const bad = { format: 'lolly-sync-index', version: 1, minReader: 1, store: 's', seq: 1, retired: {}, removing: {},
    records: { 'session/qr-code:one': { hash: 'ab'.repeat(32), object: '../../secrets', size: 1, updatedAt: clock.now } } };
  await store.open(RECORD_INDEX_PATH).put(new TextEncoder().encode(JSON.stringify(bad)));
  await assert.rejects(() => sync(a, store, clock), /could not be read/);
  assert.deepEqual(a.data('qr-code:one'), { text: 'mine' });
  // An index from a newer build that this one cannot read is never replaced, even by force.
  await store.open(RECORD_INDEX_PATH).put(new TextEncoder().encode(JSON.stringify({ ...bad, records: {}, minReader: 9 })));
  await assert.rejects(() => sync(a, store, clock, { force: true }), /newer version/);
});

test('a store that cannot remove objects keeps them listed and removes nothing', async () => {
  const clock = at('2026-10-17T09:00:00.000Z');
  const store = makeStore(clock);
  const noRemove = (path: string): SyncRemote => {
    const real = store.open(path);
    return { kind: real.kind, head: () => real.head(), get: () => real.get(), put: (b, o) => real.put(b, o) };
  };
  assert.equal(await collectRecordGarbage(noRemove, { now: () => clock.now }), 0);
});

// ── Helpers ─────────────────────────────────────────────────────────────────────

test('a three-way field merge takes one-sided changes and settles two-sided ones', () => {
  const base = { a: 1, b: 1, c: 1, gone: true };
  const here = { a: 2, b: 1, c: 5 };
  const store = { a: 1, b: 3, c: 7, gone: true, added: 'x' };
  assert.deepEqual(mergeFields(base, here, store, (f) => `both:${f}`), { a: 2, b: 3, c: 'both:c', added: 'x' });
  assert.deepEqual(mergeFields(null, { a: 1 }, { a: 2 }, () => 'both'), { a: 'both' });
});

test('conflict copy ids are stable for the same loss and stay out of hidden slots and design material', async () => {
  const loser = { value: { toolId: 'chart' }, hash: 'ab'.repeat(32) };
  const id = await conflictCopyId('session', 'chart:1', loser);
  assert.equal(await conflictCopyId('session', 'chart:1', loser), id);
  assert.notEqual(await conflictCopyId('session', 'chart:2', loser), id);
  assert.notEqual(await conflictCopyId('session', 'chart:1', loser, 1), id);
  assert.match(id!, /^chart:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(await conflictCopyId('session', '__trash__:chart:1', loser), null);
  assert.equal(await conflictCopyId('asset', 'user/ds/acme/tokens/brand', loser), null);
  assert.equal(await conflictCopyId('asset', 'user/frozen/abc', loser), null);
  assert.equal(await conflictCopyId('profile', '', loser), null);
});
