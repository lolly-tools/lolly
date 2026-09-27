// SPDX-License-Identifier: MPL-2.0
/**
 * "Clear all my data" across tabs (lib/clear-signal.ts, plan 277 review B6).
 * Each "tab" here is its own clear signal over one shared fake localStorage and
 * the real BroadcastChannel (Node delivers between channels in one process), and
 * each tab's host writes go to one shared store, as two tabs share IndexedDB:
 *
 *   - a clear waits for a save another tab already had under way, then empties
 *     the store, and a save that tab tries after the clear started is refused;
 *   - a clear waits for its own tab's save under way too;
 *   - a tab that misses the message still stops, on the marker;
 *   - a tab that opens while a clear runs waits, then reloads; a marker left by a
 *     clear that never finished does not stop a later tab;
 *   - the other tab reloads only once the clear is done.
 *
 * The sync side, with the app's own sync-config and sync-service modules, is in
 * clear-all-tabs.test.ts.
 *
 * Run directly:  node --test shells/web/src/lib/clear-signal.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClearSignal, CLEAR_MARKER_KEY, CLEAR_DONE_KEY, CLEAR_CHANNEL, type ClearSignal, type ClearSignalEnv, type MessageChannelLike } from './clear-signal.ts';
import { clearAllLollyData, coordinatorFor, type ClearAllEnv } from './clear-all-data.ts';
import { guardHostWrites, ClearedElsewhereError } from './clear-elsewhere.ts';

/** A BroadcastChannel that never keeps the test process alive on its own, so a
 *  failed assertion cannot leave the run waiting on an open channel. */
function channelOf(name: string): BroadcastChannel {
  const channel = new BroadcastChannel(name);
  (channel as unknown as { unref?(): void }).unref?.();
  return channel;
}

/** One localStorage shared by every tab. */
function sharedStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    key: (i: number) => [...map.keys()][i] ?? null,
    clear: () => { map.clear(); },
    get length() { return map.size; },
  };
}

// seenMs stays generous: under a loaded test run a tab's first answer can take a
// few hundred milliseconds, and a tab that answers late is not waited for.
const FAST = { seenMs: 1000, readyMs: 5000, settleMs: 5000, doneMs: 15_000, abandonedMs: 60_000, pollMs: 50 };

interface Tab { signal: ClearSignal; reloads: number; channels: MessageChannelLike[] }

function tab(storage: ReturnType<typeof sharedStorage>, over: Partial<ClearSignalEnv> = {}): Tab {
  const t: Tab = { signal: null as unknown as ClearSignal, reloads: 0, channels: [] };
  t.signal = createClearSignal({
    storage: () => storage,
    channel: (name) => {
      const c = channelOf(name);
      t.channels.push(c as unknown as MessageChannelLike);
      return c as unknown as MessageChannelLike;
    },
    onStorage: () => () => {},
    now: () => Date.now(),
    reload: () => { t.reloads++; },
    timings: FAST,
    ...over,
  });
  t.signal.listen();
  return t;
}

/** The part of the fake environment the clear needs besides the tabs: `db` is the
 *  shared store, emptied by the IndexedDB step. */
function clearEnv(db: Map<string, unknown>, order: string[], signal: ClearSignal): ClearAllEnv {
  return {
    tabs: coordinatorFor(signal),
    stopSync: async () => { order.push('sync'); },
    clearPackStore: async () => {},
    openAppDb: async () => {
      order.push('indexeddb');
      return {
        objectStoreNames: ['state'],
        transaction: () => ({ objectStore: () => ({ clear: () => { db.clear(); } }), done: Promise.resolve() }),
      };
    },
    indexedDB: null,
    caches: null,
    storageRoot: async () => null,
    localStorage: null,
    sessionStorage: null,
  };
}

/** A host whose save waits for `gate` (when given) before it writes to `db`. */
function slowHost(db: Map<string, unknown>, order: string[]) {
  let gate: Promise<void> | null = null;
  const host = {
    state: {
      async save(slot: string, data: unknown) {
        if (gate) await gate;
        db.set(slot, data);
        order.push(`saved ${slot}`);
      },
      async delete(slot: string) { db.delete(slot); },
    },
    profile: { async set() { order.push('profile written'); } },
  };
  const hold = (): (() => void) => { let open!: () => void; gate = new Promise((r) => { open = r; }); return () => { gate = null; open(); }; };
  return { host, hold };
}

const until = async (cond: () => boolean, ms = 5000): Promise<void> => {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
};

const dispose = (...tabs: Tab[]): void => { for (const t of tabs) t.signal.dispose(); };

test('a clear waits for a save another tab already had under way, then empties the store', async () => {
  const storage = sharedStorage();
  const db = new Map<string, unknown>();
  const order: string[] = [];
  const a = tab(storage);
  const b = tab(storage);
  const { host, hold } = slowHost(db, order);
  guardHostWrites(host, b.signal);

  const release = hold();
  const inFlight = host.state.save('qr-code:1', { v: 'typed before the clear' });
  const clearing = clearAllLollyData({ env: clearEnv(db, order, a.signal) });

  await until(() => b.signal.phase() === 'stale');
  // Tab B has stopped: a new save is refused and never reaches the store.
  await assert.rejects(host.state.save('qr-code:2', { v: 'typed after' }), ClearedElsewhereError);
  await assert.rejects(host.profile.set(), ClearedElsewhereError);
  await new Promise((r) => setTimeout(r, FAST.seenMs + 300)); // past the window for answers: now only the save holds the clear back
  assert.ok(!order.includes('indexeddb'), 'the clear does not empty anything while the other tab is still saving');

  release();
  await inFlight;
  const report = await clearing;
  assert.deepEqual(report.tabs, { seen: 1, ready: 1 });
  assert.ok(order.indexOf('saved qr-code:1') < order.indexOf('indexeddb'), 'the save finished first');
  assert.equal(db.size, 0, 'nothing is left in the store after the clear');
  assert.ok(!order.includes('saved qr-code:2') && !order.includes('profile written'));
  assert.equal(storage.getItem(CLEAR_DONE_KEY), storage.getItem(CLEAR_MARKER_KEY), 'the clear is recorded as done');
  await until(() => b.reloads === 1);
  assert.equal(a.reloads, 0, 'the tab that cleared reloads itself, from the dialog');
  dispose(a, b);
});

/** A channel that hands this tab the clear's `start` late, as a tab busy with a
 *  long task (building a sync copy, an export) reads it late. */
function lateForStart(delayMs: number): ClearSignalEnv['channel'] {
  return (name) => {
    const real = channelOf(name);
    const wrapper: MessageChannelLike = { postMessage: (m) => real.postMessage(m), onmessage: null, close: () => real.close() };
    real.onmessage = (event) => {
      const deliver = (): void => wrapper.onmessage?.({ data: event.data });
      if ((event.data as { type?: string }).type === 'start') setTimeout(deliver, delayMs); else deliver();
    };
    return wrapper;
  };
}

test('a tab too busy to answer at once is still waited for, because it announced itself when it opened', async () => {
  const storage = sharedStorage();
  const db = new Map<string, unknown>();
  const order: string[] = [];
  const a = tab(storage);
  const busy = tab(storage, { channel: lateForStart(FAST.seenMs + 800) });
  const { host, hold } = slowHost(db, order);
  guardHostWrites(host, busy.signal);
  await new Promise((r) => setTimeout(r, 50)); // hello and here cross
  const release = hold();
  const inFlight = host.state.save('qr-code:1', { v: 'mid-save' });
  const clearing = clearAllLollyData({ env: clearEnv(db, order, a.signal) });
  setTimeout(release, FAST.seenMs + 300); // the save finishes after the answer window has closed
  await inFlight;
  const report = await clearing;
  assert.deepEqual(report.tabs, { seen: 1, ready: 1 });
  assert.ok(order.indexOf('saved qr-code:1') < order.indexOf('indexeddb'), 'the clear waited for the busy tab');
  assert.equal(db.size, 0);
  dispose(a, busy);
});

test('a tab that closes while the clear waits for it is not waited for any longer', async () => {
  const storage = sharedStorage();
  const a = tab(storage);
  const closing = tab(storage, { channel: lateForStart(60_000) });
  await new Promise((r) => setTimeout(r, 50));
  const started = Date.now();
  const clearing = clearAllLollyData({ env: clearEnv(new Map(), [], a.signal) });
  setTimeout(() => closing.signal.dispose(), FAST.seenMs + 200); // says bye
  const report = await clearing;
  assert.ok(Date.now() - started < FAST.readyMs, 'no wait for the ready timeout');
  assert.deepEqual(report.tabs, { seen: 0, ready: 0 });
  dispose(a);
});

test("a clear waits for its own tab's save under way", async () => {
  const storage = sharedStorage();
  const db = new Map<string, unknown>();
  const order: string[] = [];
  const a = tab(storage);
  const { host, hold } = slowHost(db, order);
  guardHostWrites(host, a.signal);
  const release = hold();
  const inFlight = host.state.save('qr-code:1', { v: 1 });
  const clearing = clearAllLollyData({ env: clearEnv(db, order, a.signal) });
  await new Promise((r) => setTimeout(r, FAST.seenMs + 300));
  assert.ok(!order.includes('sync'), 'nothing is cleared while this tab is saving');
  await assert.rejects(host.state.save('qr-code:2', { v: 2 }), ClearedElsewhereError, 'and a new save is refused');
  release();
  await inFlight;
  await clearing;
  assert.ok(order.indexOf('saved qr-code:1') < order.indexOf('indexeddb'));
  assert.equal(db.size, 0);
  dispose(a);
});

test('a tab that misses the message still stops, on the marker', async () => {
  const storage = sharedStorage();
  const db = new Map<string, unknown>();
  const a = tab(storage);
  const deaf = tab(storage, { channel: () => null }); // frozen, or no BroadcastChannel
  const { host } = slowHost(db, []);
  guardHostWrites(host, deaf.signal);
  await clearAllLollyData({ env: clearEnv(db, [], a.signal) });
  assert.equal(deaf.signal.writesBlocked(), true);
  assert.equal(deaf.signal.databaseSealed(), true);
  await assert.rejects(host.state.save('qr-code:1', { v: 1 }), ClearedElsewhereError);
  assert.equal(db.size, 0);
  await until(() => deaf.reloads === 1); // the done marker, read by the poll
  dispose(a, deaf);
});

test('the other tab reloads only once the clear is done', async () => {
  const storage = sharedStorage();
  const db = new Map<string, unknown>([['qr-code:1', {}]]);
  const a = tab(storage);
  const b = tab(storage);
  let reloadsDuringClear = -1;
  const env = clearEnv(db, [], a.signal);
  const open = env.openAppDb;
  env.openAppDb = async () => { reloadsDuringClear = b.reloads; return open(); };
  await clearAllLollyData({ env });
  assert.equal(reloadsDuringClear, 0, 'still waiting while the store is emptied');
  await until(() => b.reloads === 1);
  dispose(a, b);
});

test('a tab that opens while a clear is running waits for it, then reloads', async () => {
  const storage = sharedStorage();
  storage.setItem(CLEAR_MARKER_KEY, `${Date.now().toString(36)}.running`);
  const late = tab(storage);
  assert.equal(late.signal.phase(), 'stale');
  assert.equal(late.signal.databaseSealed(), true, 'it never opens the database mid-clear');
  let sealed = false;
  late.signal.onSealDatabase(() => { sealed = true; });
  assert.ok(sealed, 'a seal hook registered later still runs');
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(late.reloads, 0);
  storage.setItem(CLEAR_DONE_KEY, storage.getItem(CLEAR_MARKER_KEY)!);
  await until(() => late.reloads === 1);
  dispose(late);
});

test('a marker left by a clear that never finished does not stop a later tab', () => {
  const storage = sharedStorage();
  storage.setItem(CLEAR_MARKER_KEY, `${(Date.now() - 5 * 60_000).toString(36)}.abandoned`);
  const later = tab(storage);
  assert.equal(later.signal.phase(), 'live');
  assert.equal(later.signal.writesBlocked(), false);
  dispose(later);
});

test('after a clear the marker is kept, and a tab started since is an ordinary tab', async () => {
  const storage = sharedStorage();
  storage.setItem('lolly-theme', 'dark');
  const a = tab(storage);
  const env: ClearAllEnv = { ...clearEnv(new Map(), [], a.signal), localStorage: storage };
  const report = await clearAllLollyData({ env });
  assert.equal(report.localKeys, 1);
  assert.deepEqual([...storage.map.keys()].sort(), [CLEAR_DONE_KEY, CLEAR_MARKER_KEY], 'only the marker stays');
  const fresh = tab(storage);
  assert.equal(fresh.signal.phase(), 'live');
  assert.equal(fresh.signal.writesBlocked(), false);
  dispose(a, fresh);
});

test('the channel name is the one every tab listens on', () => {
  assert.equal(CLEAR_CHANNEL, 'lolly-clear-all');
});
