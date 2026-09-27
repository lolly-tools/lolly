// SPDX-License-Identifier: MPL-2.0
/**
 * The durable filesystem mirror for user uploads (plan 216 item 2,
 * shells/tauri-shared/bridge-overrides/user-assets-fs.ts) - driven through the
 * REAL web asset-history writer/reader against a Map-backed fake IndexedDB and a
 * Map-backed fake fs, so what is pinned is the two modules' agreement: an upload's
 * bytes AND metadata reach disk, a purged IndexedDB is rebuilt from that disk
 * (the whole point - WKWebView purges site data under storage pressure), version
 * snapshots survive the same way, and a delete clears the mirror.
 *
 * The one-shot native round-trip against @tauri-apps/plugin-fs is device-verified,
 * not unit-tested here (the same boundary pack-store-fs.test.ts draws).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createFsMirroredAssetsDb, clearUserAssetsFs, type UserAssetsFs, type RealAssetsDb } from '../shells/tauri-shared/bridge-overrides/user-assets-fs.ts';
import { writeVersionedUserAsset, readUserAssetVersion, type VersionedUserAsset } from '../shells/web/src/bridge/asset-history.ts';

// ── a Map-backed fake IndexedDB, the slice the assets bridge + asset-history use ──
const vkey = (k: unknown): string => Array.isArray(k) ? `${k[0]}\u0000${k[1]}` : String(k);

function fakeIdb() {
  const heads = new Map<string, VersionedUserAsset>();
  const versions = new Map<string, { assetId: string; version: string; savedAt: number; sha256: string; bytes: number; record: VersionedUserAsset }>();

  const inRange = (range: { lower?: unknown }, assetId: string): boolean =>
    Array.isArray(range.lower) && range.lower[0] === assetId;

  const storeOps = (name: string) => ({
    async get(key: unknown) { return name === 'user-assets' ? heads.get(String(key)) : versions.get(vkey(key)); },
    async getAll(query?: unknown) {
      if (name === 'user-assets') return [...heads.values()];
      const all = [...versions.values()];
      if (query && typeof query === 'object' && 'lower' in (query as object)) {
        return all.filter(v => inRange(query as { lower?: unknown }, v.assetId));
      }
      return all;
    },
    async put(value: any) { name === 'user-assets' ? heads.set(value.id, value) : versions.set(vkey([value.assetId, value.version]), value); },
    async add(value: any) { name === 'user-assets' ? heads.set(value.id, value) : versions.set(vkey([value.assetId, value.version]), value); },
    async delete(key: unknown) {
      if (name === 'user-assets') { heads.delete(String(key)); return; }
      if (key && typeof key === 'object' && !Array.isArray(key) && 'lower' in (key as object)) {
        for (const [k, v] of versions) if (inRange(key as { lower?: unknown }, v.assetId)) versions.delete(k);
      } else versions.delete(vkey(key));
    },
  });

  const db: RealAssetsDb = {
    objectStoreNames: { contains: (n: string) => n === 'user-assets' || n === 'user-asset-versions' },
    get: (store, key) => storeOps(store).get(key),
    getAll: (store, query) => storeOps(store).getAll(query),
    getAllKeys: async (store) => store === 'user-assets' ? [...heads.keys()] : [...versions.keys()],
    put: async (store, value) => { await storeOps(store).put(value); },
    add: async (store, value) => { await storeOps(store).add(value); },
    delete: async (store, key) => { await storeOps(store).delete(key); },
    transaction: (_stores, _mode) => ({ store: undefined, objectStore: storeOps, done: Promise.resolve() }),
  };
  return { db, heads, versions };
}

// ── a Map-backed fake fs, the UserAssetsFs surface ───────────────────────────────
function fakeFs() {
  const files = new Map<string, Uint8Array | string>();
  const dirs = new Set<string>();
  const fs: UserAssetsFs = {
    async exists(path) { return files.has(path) || dirs.has(path) || [...files.keys()].some(k => k.startsWith(`${path}/`)); },
    async mkdirRecursive(path) { dirs.add(path); },
    async readFile(path) { const v = files.get(path); if (!(v instanceof Uint8Array)) throw new Error(`no file ${path}`); return v; },
    async writeFile(path, bytes) { files.set(path, bytes.slice()); },
    async readTextFile(path) { const v = files.get(path); if (typeof v !== 'string') throw new Error(`no text ${path}`); return v; },
    async writeTextFile(path, text) { files.set(path, text); },
    async readDirNames(path) {
      const prefix = `${path}/`;
      const names = new Set<string>();
      for (const k of files.keys()) if (k.startsWith(prefix)) names.add(k.slice(prefix.length).split('/')[0]!);
      return [...names];
    },
    async removeFile(path) { files.delete(path); },
    async removeDirRecursive(path) { dirs.delete(path); for (const k of [...files.keys()]) if (k.startsWith(`${path}/`)) files.delete(k); },
  };
  return { fs, files };
}

const bytesOf = async (b: Blob): Promise<string> => new TextDecoder().decode(new Uint8Array(await b.arrayBuffer()));

test('an upload lands its bytes and metadata on disk, and survives a purged IndexedDB', async () => {
  const { fs, files } = fakeFs();
  const id = 'user/upload/1700000000000-0-sig';
  const credential = new Uint8Array([1, 2, 3, 4, 5]);

  // 1) Upload through the wrapper - the real asset-history writer, mirrored to fs.
  {
    const { db } = fakeIdb();
    const wrapped = createFsMirroredAssetsDb(db, fs);
    await writeVersionedUserAsset(wrapped as unknown as Parameters<typeof writeVersionedUserAsset>[0], {
      id, type: 'raster', format: 'png', blob: new Blob(['INITIALS-PNG']),
      meta: { name: 'My initials' }, credential, credentialFormat: 'png',
    });
    // bytes as a .bin, metadata as a .json sidecar beside them.
    assert.ok([...files.keys()].some(k => k.startsWith('user-assets/heads/') && k.endsWith('.bin')), 'head bytes on disk');
    const sidecarKey = [...files.keys()].find(k => k.startsWith('user-assets/heads/') && k.endsWith('.json'))!;
    const side = JSON.parse(files.get(sidecarKey) as string);
    assert.equal(side.id, id);
    assert.equal(side.format, 'png');
    assert.equal(side.meta.name, 'My initials');
    assert.ok(typeof side.credentialB64 === 'string', 'credential preserved in the sidecar');
  }

  // 2) A fresh session over a PURGED (empty) IndexedDB, same disk: reconcile
  //    rebuilds the record - bytes and metadata both - from the mirror alone.
  {
    const { db, heads } = fakeIdb();
    assert.equal(heads.size, 0, 'IndexedDB starts empty (the purge)');
    const wrapped = createFsMirroredAssetsDb(db, fs);
    const restored = await readUserAssetVersion(wrapped as unknown as Parameters<typeof readUserAssetVersion>[0], id);
    assert.ok(restored, 'the upload came back after the purge');
    assert.equal(await bytesOf(restored!.blob!), 'INITIALS-PNG');
    assert.equal(restored!.format, 'png');
    assert.equal((restored!.meta as { name?: string }).name, 'My initials');
    assert.deepEqual([...(restored!.credential ?? [])], [1, 2, 3, 4, 5], 'credential bytes restored');
  }
});

test('replacing an upload preserves the prior version, and it too survives a purge', async () => {
  const { fs } = fakeFs();
  const id = 'user/upload/1700000000000-1-photo';
  let v1: string | undefined;

  {
    const { db } = fakeIdb();
    const wrapped = createFsMirroredAssetsDb(db, fs) as unknown as Parameters<typeof writeVersionedUserAsset>[0];
    await writeVersionedUserAsset(wrapped, { id, type: 'raster', format: 'png', blob: new Blob(['VERSION-A']), meta: { name: 'Photo' } });
    v1 = (await readUserAssetVersion(wrapped, id))!.version;
    // Replace the bytes - asset-history snapshots the previous head into history.
    await writeVersionedUserAsset(wrapped, { id, type: 'raster', format: 'png', blob: new Blob(['VERSION-B']), meta: { name: 'Photo' } });
    assert.equal(await bytesOf((await readUserAssetVersion(wrapped, id))!.blob!), 'VERSION-B', 'head is the new bytes');
    assert.equal(await bytesOf((await readUserAssetVersion(wrapped, id, v1))!.blob!), 'VERSION-A', 'the old version is still readable');
  }

  // Purge, then reopen over the same disk: BOTH the head and the old version return.
  {
    const { db } = fakeIdb();
    const wrapped = createFsMirroredAssetsDb(db, fs) as unknown as Parameters<typeof readUserAssetVersion>[0];
    assert.equal(await bytesOf((await readUserAssetVersion(wrapped, id))!.blob!), 'VERSION-B', 'head restored after purge');
    assert.equal(await bytesOf((await readUserAssetVersion(wrapped, id, v1!))!.blob!), 'VERSION-A', 'version restored after purge');
  }
});

test('a write already in IndexedDB but missing on disk is caught up on boot', async () => {
  const { fs, files } = fakeFs();
  const id = 'user/upload/1700000000000-2-legacy';
  const { db, heads } = fakeIdb();
  // Simulate a pre-mirror record that only ever reached IndexedDB (or a write whose
  // mirror crashed): put it straight into the fake IDB, bypassing the wrapper.
  heads.set(id, { id, type: 'raster', format: 'png', version: 'x', blob: new Blob(['ONLY-IN-IDB']), meta: { name: 'Legacy' } });
  assert.equal([...files.keys()].length, 0, 'nothing on disk yet');

  // Building the wrapper runs boot reconcile, which mirrors it to disk.
  const wrapped = createFsMirroredAssetsDb(db, fs);
  await (wrapped as unknown as { get(s: string, k: string): Promise<unknown> }).get('user-assets', id); // awaits `ready` (reconcile)
  assert.ok([...files.keys()].some(k => k.startsWith('user-assets/heads/') && k.endsWith('.bin')), 'the IDB-only record was mirrored to disk');
});

test('deleting an upload clears its mirror; the versions delete-all range clears the version dir', async () => {
  const { fs, files } = fakeFs();
  const id = 'user/upload/1700000000000-3-gone';
  const { db } = fakeIdb();
  const wrapped = createFsMirroredAssetsDb(db, fs);
  const w = wrapped as unknown as Parameters<typeof writeVersionedUserAsset>[0];

  await writeVersionedUserAsset(w, { id, type: 'raster', format: 'png', blob: new Blob(['A']) });
  await writeVersionedUserAsset(w, { id, type: 'raster', format: 'png', blob: new Blob(['B']) }); // snapshots A into versions
  assert.ok([...files.keys()].some(k => k.startsWith('user-assets/heads/')), 'head mirrored');
  assert.ok([...files.keys()].some(k => k.startsWith('user-assets/versions/')), 'version mirrored');

  const wdb = wrapped as unknown as { delete(store: string, key: unknown): Promise<unknown> };
  await wdb.delete('user-assets', id);
  assert.equal([...files.keys()].filter(k => k.startsWith('user-assets/heads/')).length, 0, 'head files removed');

  // The "remove all versions of this id" path, keyed by an IDBKeyRange-shaped bound.
  await wdb.delete('user-asset-versions', { lower: [id, ''], upper: [id, '￿'] });
  assert.equal([...files.keys()].filter(k => k.startsWith('user-assets/versions/')).length, 0, 'version files removed');
});

test('non-user stores pass straight through - no mirror, no gating', async () => {
  const { fs, files } = fakeFs();
  const { db } = fakeIdb();
  // Give the fake a catalog store so the passthrough has somewhere to land.
  const extra = new Map<string, unknown>();
  const realWithCatalog: RealAssetsDb = {
    ...db,
    put: async (store, value, key) => { if (store === 'asset-blob') extra.set(String(key), value); else return db.put(store, value, key); },
    get: async (store, key) => store === 'asset-blob' ? extra.get(String(key)) : db.get(store, key),
  };
  const wrapped = createFsMirroredAssetsDb(realWithCatalog, fs);
  await (wrapped as unknown as { put(s: string, v: unknown, k?: unknown): Promise<unknown> }).put('asset-blob', new Blob(['x']), 'k:png:1');
  assert.equal(extra.size, 1, 'catalog blob stored via passthrough');
  assert.equal([...files.keys()].length, 0, 'a non-user store write mirrors nothing to disk');
});

// ── plan 277: the Trash mark and "Clear all my data" ─────────────────────────────

test('an upload in the Trash stays in the Trash after a purged IndexedDB is rebuilt', async () => {
  const { fs } = fakeFs();
  const id = 'user/upload/1700000000000-2-trashed';
  {
    const { db } = fakeIdb();
    const wrapped = createFsMirroredAssetsDb(db, fs);
    await writeVersionedUserAsset(wrapped as unknown as Parameters<typeof writeVersionedUserAsset>[0], { id, type: 'raster', format: 'png', blob: new Blob(['PIC']), meta: { name: 'Pic' } });
    // What bridge/assets.ts _setUserAssetTrashed writes: the same record, marked.
    const rec = await wrapped.get('user-assets', id) as Record<string, unknown>;
    await wrapped.put('user-assets', { ...rec, trashedAt: '2026-09-27T00:00:00.000Z' });
  }
  const { db } = fakeIdb();
  const wrapped = createFsMirroredAssetsDb(db, fs);
  const restored = await wrapped.get('user-assets', id) as { trashedAt?: string } | undefined;
  assert.equal(restored?.trashedAt, '2026-09-27T00:00:00.000Z', 'the mark rides the sidecar, so a purge does not quietly restore it');
});

test('clearUserAssetsFs removes the whole mirror, so a cleared device does not refill on launch', async () => {
  const { fs, files } = fakeFs();
  const id = 'user/upload/1700000000000-3-gone';
  {
    const { db } = fakeIdb();
    const wrapped = createFsMirroredAssetsDb(db, fs);
    await writeVersionedUserAsset(wrapped as unknown as Parameters<typeof writeVersionedUserAsset>[0], { id, type: 'raster', format: 'png', blob: new Blob(['A']), meta: { name: 'A' } });
    await writeVersionedUserAsset(wrapped as unknown as Parameters<typeof writeVersionedUserAsset>[0], { id, type: 'raster', format: 'png', blob: new Blob(['B']), meta: { name: 'A' } });
  }
  assert.ok([...files.keys()].some(k => k.startsWith('user-assets/')));
  await clearUserAssetsFs(fs);
  assert.deepEqual([...files.keys()].filter(k => k.startsWith('user-assets/')), []);
  const { db, heads } = fakeIdb();
  const wrapped = createFsMirroredAssetsDb(db, fs);
  assert.equal(await wrapped.get('user-assets', id), undefined, 'nothing comes back from disk');
  assert.equal(heads.size, 0);
  await clearUserAssetsFs(fs); // a second clear of an empty mirror is fine
});
