// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 277 review B6, the sync side: "Clear all my data" in one tab while a second
 * tab of the same browser is open with sync on.
 *
 * Before the fix, the second tab kept its cached sync config (on, last synced at
 * r1). Its next change pushed a snapshot of the now-empty database, the rev still
 * matched, so the store took it: the synced copy went from three sessions to none,
 * and other devices then removed their own copies.
 *
 * Tab B here is this process's real app modules: the clear signal singleton,
 * sync-config and sync-service, over a host guarded exactly as bridge/index.ts
 * guards the app's host. Tab A is a second clear signal on the same localStorage
 * and the real BroadcastChannel, running the real clearAllLollyData. Their shared
 * "database" is one sessions map: tab A's IndexedDB step empties that map, as the
 * real clear empties the store both tabs read.
 *
 * Run directly:  node --test shells/web/src/lib/clear-all-tabs.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { MemoryRemote, type SyncRemote } from './sync-remote.ts';

// The browser globals tab B's singleton reads. Set before the app modules load,
// because the signal remembers the marker it saw when it started.
const map = new Map<string, string>();
const shared = {
  getItem: (k: string) => map.get(k) ?? null,
  setItem: (k: string, v: string) => { map.set(k, v); },
  removeItem: (k: string) => { map.delete(k); },
  key: (i: number) => [...map.keys()][i] ?? null,
  clear: () => { map.clear(); },
  get length() { return map.size; },
};
let reloads = 0;
const g = globalThis as Record<string, unknown>;
g.localStorage = shared;
g.location = { pathname: '/', search: '', reload: () => { reloads++; } };
g.history = { replaceState: () => {} };

const { clearSignal, createClearSignal } = await import('./clear-signal.ts');
const { clearAllLollyData, coordinatorFor } = await import('./clear-all-data.ts');
const { guardHostWrites, ClearedElsewhereError } = await import('./clear-elsewhere.ts');
const svc = await import('./sync-service.ts');
const cfg = await import('./sync-config.ts');
const { openDB } = await import('../bridge/db.ts');

const until = async (cond: () => boolean, ms = 8000): Promise<void> => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
};

test('two tabs: one clears, the other cannot write, cannot turn sync back on or upload, and reloads', async () => {
  clearSignal.listen(); // bridge boot does this in a browser (the module listens when a window exists)

  // Tab B: three saved sessions, synced (the store holds r1).
  const sessions = new Map<string, unknown>([1, 2, 3].map((n) => [`qr-code:work-${n}`, { __toolId: 'qr-code', v: n }]));
  const profile = { value: { firstname: 'Ada' } as Record<string, unknown> };
  const host = {
    profile: { async get() { return profile.value; }, async set(p: Record<string, unknown>) { profile.value = p; } },
    state: {
      async list() { return [...sessions.keys()].map((slot) => ({ slot })); },
      async load(slot: string) { return sessions.get(slot) ?? null; },
      async save(slot: string, data: unknown) { sessions.set(slot, data); },
      async delete(slot: string) { sessions.delete(slot); },
    },
    assets: { async _exportUserAssets() { return []; }, async _importUserAsset() {}, async _listUserAssets() { return []; }, async _deleteUserAsset() {} },
    log() {},
  };
  guardHostWrites(host);
  const deps = { host: host as never, storage: { getItem: () => null, setItem: () => {} } };

  const store = new MemoryRemote(() => new Date(Date.UTC(2026, 8, 27, 9)).toISOString());
  let holdHead: Promise<void> | null = null;
  let headWaiting = false;
  const slow: SyncRemote = {
    kind: 'memory',
    head: async () => { if (holdHead) { headWaiting = true; await holdHead; } return store.head(); },
    get: () => store.get(),
    put: (bytes, opts) => store.put(bytes, opts),
  };
  svc.setSyncRemoteForTests('mem', (path) => (path ? new MemoryRemote() : slow));
  await cfg.saveSyncConfig({ enabled: true, providerKind: 'mem' });
  assert.equal((await svc.syncNow(deps)).status, 'pushed');
  const synced = async () => {
    const got = await store.get();
    return { rev: got!.meta.rev, sessions: (JSON.parse(strFromU8(unzipSync(got!.bytes)['sessions.json']!)) as Array<{ slot: string }>).map((s) => s.slot) };
  };
  const before = await synced();
  assert.equal(before.sessions.length, 3);

  // A push is under way in tab B when the clear starts (held at its first request).
  let openHead!: () => void;
  holdHead = new Promise((r) => { openHead = r; });
  const pushing = svc.syncNow(deps);
  pushing.catch(() => {}); // awaited below; this only keeps the early rejection from reading as unhandled
  await until(() => headWaiting);

  // Tab A: "Clear all my data".
  const tabA = createClearSignal({
    storage: () => shared,
    channel: (name) => { const c = new BroadcastChannel(name); (c as unknown as { unref?(): void }).unref?.(); return c as never; },
    onStorage: () => () => {},
    now: () => Date.now(),
    reload: () => {},
    timings: { seenMs: 1000, readyMs: 5000 },
  });
  const report = await clearAllLollyData({
    env: {
      tabs: coordinatorFor(tabA),
      stopSync: async () => {},
      clearPackStore: async () => {},
      openAppDb: async () => ({
        objectStoreNames: ['state', 'profile'],
        transaction: () => ({ objectStore: () => ({ clear: () => { sessions.clear(); profile.value = {}; } }), done: Promise.resolve() }),
      }),
      indexedDB: null, caches: null, storageRoot: async () => null, localStorage: shared, sessionStorage: null,
    },
  });
  assert.deepEqual(report.tabs, { seen: 1, ready: 1 }, 'tab B answered and confirmed it stopped');
  assert.equal(sessions.size, 0);
  assert.equal(clearSignal.phase(), 'stale');

  // The push under way resumes over the emptied database: it must not upload.
  holdHead = null;
  openHead();
  await assert.rejects(pushing, /cleared in another tab/);
  assert.deepEqual(await synced(), before, 'the synced copy still holds the three sessions');

  // Tab B cannot write the profile or a session back.
  await assert.rejects(host.profile.set({ firstname: 'Ada', city: 'London' }), ClearedElsewhereError);
  await assert.rejects(host.state.save('qr-code:work-4', { v: 4 }), ClearedElsewhereError);
  assert.deepEqual(profile.value, {});
  assert.equal(sessions.size, 0);

  // Sync reads as off in tab B and cannot be switched back on from there.
  assert.equal((await cfg.getSyncConfig()).enabled, false);
  await cfg.saveSyncConfig({ enabled: true, providerKind: 'mem' });
  assert.equal((await cfg.getSyncConfig()).enabled, false, 'turning sync on from the stale tab does nothing');
  await assert.rejects(svc.syncNow(deps), /cleared in another tab/, 'a manual Sync now is refused with a reason');
  await assert.rejects(svc.keepThisDevice(deps), /cleared in another tab/, 'and so is Keep this device');
  assert.deepEqual(await synced(), before);

  // Nothing opens the database again in tab B.
  await assert.rejects(openDB(), (error: Error & { code?: string }) => error.code === 'DB_SEALED');

  // Once the clear is done, tab B reloads.
  await until(() => reloads === 1);
  tabA.dispose();
  clearSignal.dispose();
});
