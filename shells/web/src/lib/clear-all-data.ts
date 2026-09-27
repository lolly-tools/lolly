// SPDX-License-Identifier: MPL-2.0
/**
 * "Clear all my data" (plan 277 P2, decided 2026-09-27: "we should clear all,
 * removing models, caches etc. Fix this in the app rather than re-writing the
 * promise"). Settings → Storage's dialog and the privacy policy both promise that
 * the button wipes what Lolly keeps here; this is the code that keeps the promise.
 *
 * It used to empty eight named IndexedDB stores and leave version history, the
 * download log, file results, design systems, downloaded models and every cache
 * behind. It now clears by ENUMERATION, never by a list, so a store or cache added
 * later is covered without anyone remembering to add it here:
 *
 *   0. every other tab of the app is told to stop writing, and the clear waits
 *      until each one has (and for this tab's own writes under way), so nothing
 *      is written back after it (lib/clear-signal.ts, plan 277 review B6);
 *   1. automatic sync is switched off first, in memory and on disk, and this
 *      browser's sync bookkeeping is forgotten, so no pending push can upload the
 *      emptied device over the person's synced copy, and a later push is a first
 *      join that never replaces a synced copy by itself;
 *   2. places outside the browser's storage: a loaded brand pack's store, the
 *      state bridge's own files (the Tauri apps keep saved sessions as files), and
 *      whatever each shell registered (lib/device-data-clearers.ts);
 *   3. every object store in the app's IndexedDB database, read from the
 *      database's own store list (bridge/db.ts creates them; nothing here names
 *      one), then any other database on the origin where the browser can list them;
 *   4. every Cache Storage cache on the origin (offline app, docs, pinned tools,
 *      installed tools, models, the share inbox);
 *   5. every entry in the origin-private file system (file results, sequence
 *      audio, recorder and mux scratch);
 *   6. localStorage and sessionStorage. The whole origin is Lolly's, and the app
 *      keeps keys with and without its `lolly-`, `lolly.` and `lolly:` prefixes
 *      (theme, lang, sidebarWidth, the catalog ETags), so both are cleared whole,
 *      except the clear marker the other tabs compare against;
 *   7. the other tabs are told the clear is done, and reload.
 *
 * The caller then reloads, which is what makes the app start as on a first run:
 * in-memory caches go, the database is re-opened empty at the current schema, and
 * the welcome shows again. Each step is best-effort and reported, so one refusal
 * (a blocked database, a file in use) never stops the rest.
 *
 * Every browser API is reached through `env`, so a node test can hand in fakes and
 * prove that everything is emptied, including a store or cache it adds itself.
 */
import { deviceDataClearers } from './device-data-clearers.ts';
import { clearSignal, sealWebStorage, type ClearSignal } from './clear-signal.ts';

/** The app's own IndexedDB database (bridge/db.ts DB_NAME). */
export const APP_DB_NAME = 'lolly';

/** A readwrite transaction as `idb` hands one out: a store's clear() and `done`. */
interface ClearTx {
  objectStore(name: string): { clear(): Promise<unknown> | unknown };
  done: Promise<unknown>;
}
/** The open app database: its store names and a transaction over them. */
export interface ClearableDb {
  objectStoreNames: ArrayLike<string> & Iterable<string>;
  transaction(names: string[], mode: 'readwrite'): ClearTx;
  close?(): void;
}
/** The slice of IDBFactory the clear uses. */
export interface ClearableIdbFactory {
  databases?(): Promise<Array<{ name?: string }>>;
  deleteDatabase(name: string): { onsuccess: unknown; onerror: unknown; onblocked: unknown };
}
/** The slice of CacheStorage the clear uses. */
export interface ClearableCaches {
  keys(): Promise<string[]>;
  delete(name: string): Promise<boolean>;
}
/** The slice of an OPFS directory handle the clear uses. */
export interface ClearableDirectory {
  keys(): AsyncIterable<string>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
}
/** The slice of Storage the clear uses. With `key` and `removeItem` it removes
 *  every key but the ones it must keep; without them it clears whole and puts
 *  those back. */
export interface ClearableStorage {
  readonly length: number;
  clear(): void;
  key?(index: number): string | null;
  getItem?(key: string): string | null;
  setItem?(key: string, value: string): void;
  removeItem?(key: string): void;
}

/** The other tabs of the app (lib/clear-signal.ts). */
export interface ClearCoordinator {
  /** Tell every other tab to stop writing; wait for each, and for this tab's own writes under way. */
  begin(): Promise<{ tabs: number; ready: number }>;
  /** Close this tab's shared database connection and refuse new ones, so nothing queues a write behind the clear. */
  sealDatabase(): void;
  /** Tell the other tabs the clear is over, so they reload. */
  finish(): void;
  /** localStorage keys the clear keeps: the marker the other tabs compare against. */
  keptKeys(): string[];
}

export interface ClearAllEnv {
  tabs: ClearCoordinator;
  stopSync(): Promise<void>;
  clearPackStore(): Promise<void>;
  openAppDb(): Promise<ClearableDb | null>;
  indexedDB: ClearableIdbFactory | null;
  caches: ClearableCaches | null;
  storageRoot(): Promise<ClearableDirectory | null>;
  localStorage: ClearableStorage | null;
  sessionStorage: ClearableStorage | null;
}

export interface ClearAllReport {
  /** Object stores emptied in the app database. */
  stores: string[];
  /** Other databases deleted. */
  databases: string[];
  caches: string[];
  /** Top-level OPFS entries removed. */
  files: string[];
  localKeys: number;
  sessionKeys: number;
  /** Names of the shell clearers that ran (plus 'state' and 'pack-store'). */
  cleared: string[];
  /** Other tabs of the app that answered, and how many of them confirmed they stopped writing. */
  tabs: { seen: number; ready: number };
  /** One line per step that did not finish; the rest still ran. */
  errors: string[];
}

/** Anything that may clear the state bridge's own saved sessions (the Tauri files). */
export interface ClearableState { _clearAll?(): Promise<void> }

const DELETE_DB_TIMEOUT_MS = 3000;

/** The coordinator over one tab's clear signal (lib/clear-signal.ts). */
export function coordinatorFor(signal: ClearSignal): ClearCoordinator {
  return {
    begin: () => signal.beginClear(),
    sealDatabase: () => signal.sealDatabase(),
    finish: () => signal.finishClear(),
    keptKeys: () => signal.keptKeys(),
  };
}

function browserEnv(): ClearAllEnv {
  const g = globalThis as typeof globalThis & { caches?: ClearableCaches; indexedDB?: ClearableIdbFactory };
  return {
    tabs: coordinatorFor(clearSignal),
    stopSync: async () => {
      const { resetSyncForClear } = await import('./sync-config.ts');
      await resetSyncForClear();
    },
    clearPackStore: async () => {
      const { clearInstancePack } = await import('./pack-store.ts');
      await clearInstancePack();
    },
    // A connection of its own: by this step the shared one is sealed (see step 3).
    openAppDb: async () => {
      const { openUnsharedDB } = await import('../bridge/db.ts');
      const db = await openUnsharedDB();
      return { objectStoreNames: db.objectStoreNames, transaction: (names, mode) => db.transaction(names, mode), close: () => db.close() };
    },
    indexedDB: g.indexedDB ?? null,
    caches: g.caches ?? null,
    storageRoot: async () => {
      const storage = (globalThis.navigator as Navigator | undefined)?.storage;
      if (!storage?.getDirectory) return null;
      // keys() is in the DOM async-iterable typings this project does not load (as in
      // bridge/recorder-storage.ts), so it is read as optional and checked.
      const root: FileSystemDirectoryHandle & Partial<ClearableDirectory> = await storage.getDirectory();
      const keys = root.keys?.bind(root);
      return keys ? { keys, removeEntry: (name, options) => root.removeEntry(name, options) } : null;
    },
    localStorage: (() => { try { return globalThis.localStorage ?? null; } catch { return null; } })(),
    sessionStorage: (() => { try { return globalThis.sessionStorage ?? null; } catch { return null; } })(),
  };
}

/** Delete one database, giving up (not failing) if another tab holds it open. */
function deleteDatabase(factory: ClearableIdbFactory, name: string): Promise<'deleted' | 'blocked' | 'failed'> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: 'deleted' | 'blocked' | 'failed'): void => { if (!settled) { settled = true; resolve(v); } };
    const timer = setTimeout(() => done('blocked'), DELETE_DB_TIMEOUT_MS);
    try {
      const req = factory.deleteDatabase(name);
      req.onsuccess = () => { clearTimeout(timer); done('deleted'); };
      req.onerror = () => { clearTimeout(timer); done('failed'); };
      req.onblocked = () => { /* keep waiting until the timeout: the holder may still close */ };
    } catch { clearTimeout(timer); done('failed'); }
  });
}

/** Remove every key but `keep`; returns how many went. */
function clearStorageKeeping(storage: ClearableStorage, keep: readonly string[]): number {
  if (storage.key && storage.removeItem) {
    const doomed: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key !== null && !keep.includes(key)) doomed.push(key);
    }
    for (const key of doomed) storage.removeItem(key);
    return doomed.length;
  }
  const kept = keep.map((key) => [key, storage.getItem?.(key) ?? null] as const).filter(([, value]) => value !== null);
  const count = storage.length - kept.length;
  storage.clear();
  for (const [key, value] of kept) storage.setItem?.(key, value!);
  return count;
}

/** Empty every object store the app database has, in one transaction when it
 *  can and one store at a time when that fails. Returns the stores emptied. */
async function clearAppDatabase(db: ClearableDb, errors: string[]): Promise<string[]> {
  const names = [...db.objectStoreNames];
  if (!names.length) return [];
  try {
    const tx = db.transaction(names, 'readwrite');
    await Promise.all(names.map(n => tx.objectStore(n).clear()));
    await tx.done;
    return names;
  } catch {
    const cleared: string[] = [];
    for (const n of names) {
      try {
        const tx = db.transaction([n], 'readwrite');
        await tx.objectStore(n).clear();
        await tx.done;
        cleared.push(n);
      } catch (error) { errors.push(`store ${n}: ${String(error)}`); }
    }
    return cleared;
  }
}

/**
 * Clear everything Lolly keeps on this device for this origin. Does not reload:
 * the caller does, once the dialog is closed. `state` is the host's state bridge,
 * whose `_clearAll` removes saved sessions a shell keeps outside the browser.
 */
export async function clearAllLollyData(opts: { state?: ClearableState; env?: Partial<ClearAllEnv> } = {}): Promise<ClearAllReport> {
  const env: ClearAllEnv = { ...browserEnv(), ...opts.env };
  const report: ClearAllReport = { stores: [], databases: [], caches: [], files: [], localKeys: 0, sessionKeys: 0, cleared: [], tabs: { seen: 0, ready: 0 }, errors: [] };
  const step = async (label: string, run: () => Promise<void>): Promise<void> => {
    try { await run(); } catch (error) { report.errors.push(`${label}: ${String((error as Error)?.message ?? error)}`); }
  };

  // 0. Every other tab stops writing, and writes under way finish, before anything
  //    is emptied (see the header).
  await step('tabs', async () => {
    const { tabs, ready } = await env.tabs.begin();
    report.tabs = { seen: tabs, ready };
    if (ready < tabs) report.errors.push(`tabs: ${tabs - ready} of ${tabs} did not confirm they stopped writing`);
  });
  try {
    await clearEverything(env, opts, report, step);
  } finally {
    // 7. The other tabs reload now, even when a step above failed.
    try { env.tabs.finish(); } catch (error) { report.errors.push(`tabs: ${String(error)}`); }
  }
  return report;
}

async function clearEverything(
  env: ClearAllEnv,
  opts: { state?: ClearableState },
  report: ClearAllReport,
  step: (label: string, run: () => Promise<void>) => Promise<void>,
): Promise<void> {
  // 1. Sync off before anything is emptied (see the header).
  await step('sync', () => env.stopSync());

  // 2. Places outside the browser's storage.
  await step('pack-store', async () => { await env.clearPackStore(); report.cleared.push('pack-store'); });
  if (opts.state?._clearAll) await step('state', async () => { await opts.state!._clearAll!(); report.cleared.push('state'); });
  for (const clearer of deviceDataClearers()) {
    await step(clearer.name, async () => { await clearer.run(); report.cleared.push(clearer.name); });
  }

  // 3. IndexedDB: every store of the app database, then any other database. The
  //    shared connection is sealed first: a write this tab already queued runs
  //    before the clear's transaction, and none can queue after.
  try { env.tabs.sealDatabase(); } catch (error) { report.errors.push(`seal: ${String(error)}`); }
  await step('indexeddb', async () => {
    const db = await env.openAppDb();
    if (!db) return;
    try { report.stores = await clearAppDatabase(db, report.errors); }
    finally { try { db.close?.(); } catch { /* already closed */ } }
  });
  const factory = env.indexedDB;
  if (factory?.databases) {
    await step('databases', async () => {
      for (const { name } of await factory.databases!()) {
        if (!name || name === APP_DB_NAME) continue;
        const outcome = await deleteDatabase(factory, name);
        if (outcome === 'deleted') report.databases.push(name);
        else report.errors.push(`database ${name}: ${outcome}`);
      }
    });
  }

  // 4. Cache Storage, every cache on the origin.
  const cacheStorage = env.caches;
  if (cacheStorage) {
    await step('caches', async () => {
      for (const key of await cacheStorage.keys()) {
        if (await cacheStorage.delete(key)) report.caches.push(key);
        else report.errors.push(`cache ${key}: not deleted`);
      }
    });
  }

  // 5. The origin-private file system, every top-level entry.
  await step('opfs', async () => {
    const root = await env.storageRoot();
    if (!root) return;
    const names: string[] = [];
    for await (const name of root.keys()) names.push(name);
    for (const name of names) {
      try { await root.removeEntry(name, { recursive: true }); report.files.push(name); }
      catch (error) { report.errors.push(`file ${name}: ${String(error)}`); }
    }
  });

  // 6. Web storage, whole, but for the marker the other tabs compare against.
  await step('localStorage', async () => {
    if (!env.localStorage) return;
    report.localKeys = clearStorageKeeping(env.localStorage, env.tabs.keptKeys());
  });
  await step('sessionStorage', async () => {
    if (!env.sessionStorage) return;
    report.sessionKeys = env.sessionStorage.length;
    env.sessionStorage.clear();
  });
}

/**
 * Keep web storage empty until the reload that follows a clear: a view that saves
 * a preference on `pagehide` would otherwise write a key back after the clear.
 * Refusing the write in this page is better than clearing again on the way out,
 * which used to be the approach: by then another tab may already have reloaded
 * and written its own first-run keys, and the marker must stay.
 */
export function sealWebStorageUntilReload(): void {
  sealWebStorage();
}
