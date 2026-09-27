// SPDX-License-Identifier: MPL-2.0
/**
 * "Clear all my data" clears ALL of Lolly's data (lib/clear-all-data.ts, plan 277
 * P2). The dialog and the privacy policy promise it; these tests hold the code to
 * the promise with fakes for every browser API the clear reaches:
 *
 *   - every object store in the app database is emptied, read from the database's
 *     own store list: the test builds its fake from the stores bridge/db.ts really
 *     creates, plus one no code has made yet, so a store added later is covered;
 *   - every other database, every Cache Storage cache (known names and an unknown
 *     one), every entry in the origin-private file system, and web storage;
 *   - every other tab is told to stop writing and the clear waits for them
 *     (lib/clear-signal.ts; the two-tab runs are clear-signal.test.ts and
 *     clear-all-tabs.test.ts), and sync is switched off BEFORE anything is
 *     emptied, so no pending push can upload the empty device over the person's
 *     synced copy;
 *   - the shells' own places outside the browser: the state bridge's files (the
 *     Tauri saved-state folder), the pack store, and registered clearers;
 *   - one refusal never stops the rest.
 *
 * Run directly:  node --test shells/web/src/lib/clear-all-data.test.ts
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clearAllLollyData, type ClearAllEnv, type ClearableDb, type ClearableDirectory } from './clear-all-data.ts';
import { registerDeviceDataClearer, resetDeviceDataClearersForTests } from './device-data-clearers.ts';

const src = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8');

/** Every store bridge/db.ts creates, read from its upgrade code. */
const SCHEMA_STORES = [...new Set([...src('../bridge/db.ts').matchAll(/createObjectStore\('([^']+)'/g)].map(m => m[1]!))];

function fakeDb(names: string[], opts: { failWholeTx?: boolean; failStore?: string } = {}) {
  const rows = new Map(names.map(n => [n, new Map<string, unknown>([['row', { n }]])]));
  const db: ClearableDb = {
    objectStoreNames: names,
    transaction(stores, _mode) {
      if (opts.failWholeTx && stores.length > 1) throw new Error('too many stores');
      return {
        objectStore(name: string) {
          return { clear: async () => { if (name === opts.failStore) throw new Error('refused'); rows.get(name)!.clear(); } };
        },
        done: Promise.resolve(),
      };
    },
  };
  return { db, rows };
}

function fakeStorage(keys: string[]) {
  const map = new Map(keys.map(k => [k, '1']));
  return { map, api: { get length() { return map.size; }, clear() { map.clear(); } } };
}

function fakeDir(names: string[]) {
  const entries = new Set(names);
  const dir: ClearableDirectory = {
    async *keys() { for (const n of [...entries]) yield n; },
    async removeEntry(name) { entries.delete(name); },
  };
  return { entries, dir };
}

function fakeEnv(order: string[], over: Partial<ClearAllEnv> = {}) {
  const extraStore = 'a-store-added-later';
  const app = fakeDb([...SCHEMA_STORES, extraStore]);
  const caches = new Map(['lolly-v17', 'lolly-pins', 'lolly-installed', 'lolly-app', 'lolly-ort', 'lolly-ort-hf', 'lolly-info', 'transformers-cache', 'lolly-speech', 'lolly-share-inbox', 'lolly-some-future-cache'].map(k => [k, true]));
  const dbNames = new Set(['lolly', 'some-library-cache']);
  const opfs = fakeDir(['lolly-file-results-v1', 'lolly-preview-pcm-v1', 'recorder-scratch']);
  const local = fakeStorage(['lolly-theme', 'lolly.flags', 'lolly:projectsViewPrefs', 'theme', 'lang', 'sidebarWidth', 'sbt-catalog:assets-index']);
  const session = fakeStorage(['lolly:file-into']);
  const env: ClearAllEnv = {
    tabs: {
      begin: async () => { order.push('tabs'); return { tabs: 1, ready: 1 }; },
      sealDatabase: () => { order.push('seal'); },
      finish: () => { order.push('finish'); },
      keptKeys: () => ['lolly-clear-marker', 'lolly-clear-done'],
    },
    stopSync: async () => { order.push('sync'); },
    clearPackStore: async () => { order.push('pack-store'); },
    openAppDb: async () => { order.push('indexeddb'); return app.db; },
    indexedDB: {
      databases: async () => [...dbNames].map(name => ({ name })),
      deleteDatabase(name: string) {
        const req = { onsuccess: null as null | (() => void), onerror: null as null | (() => void), onblocked: null as null | (() => void) };
        queueMicrotask(() => { dbNames.delete(name); req.onsuccess?.(); });
        return req;
      },
    },
    caches: { keys: async () => { order.push('caches'); return [...caches.keys()]; }, delete: async (k: string) => caches.delete(k) },
    storageRoot: async () => { order.push('opfs'); return opfs.dir; },
    localStorage: local.api,
    sessionStorage: session.api,
    ...over,
  };
  return { env, app, caches, dbNames, opfs, local, session, extraStore };
}

afterEach(() => resetDeviceDataClearersForTests());

test('the fake app database is built from the real schema', () => {
  // A guard on the guard: if this parse ever found nothing, every test below
  // would pass without proving anything about the real stores.
  assert.ok(SCHEMA_STORES.length >= 30, `found ${SCHEMA_STORES.length} stores in bridge/db.ts`);
  for (const name of ['state', 'profile', 'user-assets', 'revisions', 'revision-recovery', 'exports', 'file-operations', 'design-systems', 'upscale-models', 'identity']) {
    assert.ok(SCHEMA_STORES.includes(name), `${name} is in the schema`);
  }
});

test('every store, database, cache, file and storage key goes, including ones added later', async () => {
  const order: string[] = [];
  const f = fakeEnv(order);
  const report = await clearAllLollyData({ env: f.env });
  for (const [name, rows] of f.app.rows) assert.equal(rows.size, 0, `${name} is empty`);
  assert.ok(report.stores.includes(f.extraStore), 'a store no code names is still emptied');
  assert.equal(report.stores.length, SCHEMA_STORES.length + 1);
  assert.deepEqual([...f.dbNames], ['lolly'], 'other databases are deleted; the app database is emptied, not deleted');
  assert.deepEqual(report.databases, ['some-library-cache']);
  assert.equal(f.caches.size, 0, 'every cache is deleted');
  assert.ok(report.caches.includes('lolly-some-future-cache'));
  assert.equal(f.opfs.entries.size, 0, 'the private file system is empty');
  assert.equal(f.local.map.size, 0, 'localStorage is empty, prefixed keys and the rest');
  assert.equal(f.session.map.size, 0);
  assert.equal(report.localKeys, 7);
  assert.deepEqual(report.errors, []);
});

test('the other tabs stop first, then sync goes off, before anything is emptied; they reload last', async () => {
  const order: string[] = [];
  const report = await clearAllLollyData({ env: fakeEnv(order).env });
  assert.deepEqual(order.slice(0, 2), ['tabs', 'sync']);
  assert.ok(order.indexOf('seal') < order.indexOf('indexeddb'), "this tab's shared connection is sealed before the database is emptied");
  assert.equal(order.at(-1), 'finish');
  assert.deepEqual(report.tabs, { seen: 1, ready: 1 });
});

test('a tab that did not confirm is reported, and the others still reload when a step throws', async () => {
  const order: string[] = [];
  const f = fakeEnv(order);
  const report = await clearAllLollyData({
    env: { ...f.env, tabs: { ...f.env.tabs, begin: async () => ({ tabs: 2, ready: 1 }) }, storageRoot: async () => { throw new Error('opfs gone'); } },
  });
  assert.ok(report.errors.includes('tabs: 1 of 2 did not confirm they stopped writing'));
  assert.equal(order.at(-1), 'finish');
});

test('web storage keeps only the clear marker, so every tab can still compare it', async () => {
  const order: string[] = [];
  const f = fakeEnv(order);
  const map = new Map([['lolly-theme', 'dark'], ['lang', 'fr'], ['lolly-clear-marker', 'm1'], ['lolly-clear-done', 'm0']]);
  const local = {
    get length() { return map.size; }, clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null, removeItem: (k: string) => { map.delete(k); },
  };
  const report = await clearAllLollyData({ env: { ...f.env, localStorage: local } });
  assert.deepEqual([...map.keys()], ['lolly-clear-marker', 'lolly-clear-done']);
  assert.equal(report.localKeys, 2);
});

test("the shell's own files go too: the state bridge's saved sessions and every registered clearer", async () => {
  const order: string[] = [];
  const ran: string[] = [];
  registerDeviceDataClearer('user-assets-fs', async () => { ran.push('user-assets-fs'); });
  registerDeviceDataClearer('user-assets-fs', async () => { ran.push('user-assets-fs (replaced)'); });
  const report = await clearAllLollyData({ state: { _clearAll: async () => { ran.push('saved-state'); } }, env: fakeEnv(order).env });
  assert.deepEqual(ran, ['saved-state', 'user-assets-fs (replaced)'], 'one registration per name, the latest wins');
  assert.deepEqual(report.cleared, ['pack-store', 'state', 'user-assets-fs']);
});

test('one refusal never stops the rest', async () => {
  const order: string[] = [];
  const f = fakeEnv(order);
  const failing = fakeDb(['state', 'profile', 'stuck'], { failWholeTx: true, failStore: 'stuck' });
  registerDeviceDataClearer('broken', async () => { throw new Error('disk says no'); });
  const report = await clearAllLollyData({
    env: { ...f.env, openAppDb: async () => failing.db, stopSync: async () => { throw new Error('offline'); } },
  });
  assert.deepEqual(report.stores, ['state', 'profile'], 'a failed transaction falls back to one store at a time');
  assert.equal(failing.rows.get('state')!.size, 0);
  assert.equal(failing.rows.get('stuck')!.size, 1);
  assert.equal(f.caches.size, 0, 'caches still cleared');
  assert.equal(f.local.map.size, 0, 'web storage still cleared');
  assert.ok(report.errors.some(e => e.startsWith('sync:')));
  assert.ok(report.errors.some(e => e.startsWith('broken:')));
  assert.ok(report.errors.some(e => e.startsWith('store stuck:')));
});

test('a database another tab holds open is reported, not waited on forever', async () => {
  const order: string[] = [];
  const f = fakeEnv(order);
  const report = await clearAllLollyData({
    env: { ...f.env, indexedDB: { databases: async () => [{ name: 'held-elsewhere' }], deleteDatabase: () => ({ onsuccess: null, onerror: null, onblocked: null }) } },
  });
  assert.deepEqual(report.errors, ['database held-elsewhere: blocked']);
  assert.equal(f.caches.size, 0);
});

test('Settings → Storage clears through this module, never through a list of store names', () => {
  const storage = src('../views/profile/storage.ts');
  const clearBlock = storage.slice(storage.indexOf("viewEl.querySelector('#clear-storage-btn')"), storage.indexOf('// Export everything to a portable .zip'));
  assert.match(clearBlock, /clearAllLollyData\(/);
  assert.doesNotMatch(clearBlock, /clearIdbStores\(/, 'the old eight-store list is gone');
  assert.doesNotMatch(clearBlock, /localStorage\.clear\(\)/, 'web storage is cleared by the module');
  assert.match(clearBlock, /sealWebStorageUntilReload\(\)/, 'and kept empty until the reload by refusing writes, not by clearing again on the way out');
  const module = src('./clear-all-data.ts');
  assert.doesNotMatch(module, /objectStore\('/, 'the module names no store: it enumerates');
});

test('the dialog says what goes, in a short list, and keeps the typed confirmation', () => {
  const storage = src('../views/profile/storage.ts');
  for (const line of ['your profile, settings and Content Credentials', 'saved sessions, their history and the Trash', 'uploads, fonts and design systems', 'the download log, file results, downloaded models and offline copies']) {
    assert.ok(storage.includes(`t('${line}')`), line);
  }
  assert.match(storage, /CLEAR_CONFIRM_WORDS\[/);
  assert.match(storage, /Type <strong>\{word\}<\/strong> to confirm/);
});

test('every tab is wired to stop: host writes guarded outside change tracking, a sealed database, sync refused', () => {
  const bridge = src('../bridge/index.ts');
  assert.ok(bridge.indexOf('guardHostWrites(host)') > bridge.indexOf('trackHostChanges(host)'), 'the guard is the outer layer, so a refused write never schedules a push');
  const db = src('../bridge/db.ts');
  assert.match(db, /clearSignal\.databaseSealed\(\)/);
  assert.match(db, /clearSignal\.onSealDatabase\(/);
  const service = src('./sync-service.ts');
  assert.match(service, /if \(clearSignal\.writesBlocked\(\)\) return null;/, 'no remote resolves in a stopped tab');
  assert.match(service, /refuseAfterClear\(testLoader/, 'and the upload is checked again, test remotes included');
  const config = src('./sync-config.ts');
  assert.equal((config.match(/if \(clearSignal\.writesBlocked\(\)\)/g) ?? []).length, 3, 'getSyncConfig, saveSyncConfig and saveSyncBase');
});
