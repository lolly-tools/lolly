// SPDX-License-Identifier: MPL-2.0
/**
 * The filesystem pack-store backend (plans/132 wave 3,
 * shells/tauri-shared/bridge-overrides/pack-store-fs.ts) - driven through the
 * REAL web pack-store against a Map-backed fake fs, so what is pinned is the
 * two modules' agreement: the import's clear-then-put transaction ordering,
 * the base64url path-key encoding, and meta surviving a fresh init (the
 * whole point - fs persistence where IndexedDB gets purged). The one-shot
 * legacy-IndexedDB migration needs a browser IDB and is device-verified, not
 * unit-tested here.
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { createFsPackDb, type PackFs } from '../shells/tauri-shared/bridge-overrides/pack-store-fs.ts';
import {
  _resetPackStoreForTests, _setDbForTests, _setPinnedKeyForTests,
  getPackMeta, importInstancePackParts, initPackStore, packActive, packFetch,
  type PackToolInstaller,
} from '../shells/web/src/lib/pack-store.ts';

const enc = new TextEncoder();

/** Map-backed fake of the PackFs adapter surface. */
function fakeFs() {
  const files = new Map<string, Uint8Array | string>();
  const dirs = new Set<string>();
  const fs: PackFs = {
    async exists(path) { return files.has(path) || dirs.has(path) || [...files.keys()].some(k => k.startsWith(`${path}/`)); },
    async mkdirRecursive(path) { dirs.add(path); },
    async readFile(path) {
      const v = files.get(path);
      if (!(v instanceof Uint8Array)) throw new Error(`no file ${path}`);
      return v;
    },
    async writeFile(path, bytes) { files.set(path, bytes); },
    async readTextFile(path) {
      const v = files.get(path);
      if (typeof v !== 'string') throw new Error(`no text file ${path}`);
      return v;
    },
    async writeTextFile(path, text) { files.set(path, text); },
    async readDirNames(path) {
      const prefix = `${path}/`;
      return [...files.keys()].filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length));
    },
    async removeFile(path) { files.delete(path); },
    async removeDirRecursive(path) {
      dirs.delete(path);
      for (const k of [...files.keys()]) if (k.startsWith(`${path}/`)) files.delete(k);
    },
  };
  return { fs, files };
}

const installer = (): PackToolInstaller => ({
  async installTool() { /* tools ride installed-tools; not under test here */ },
  async uninstallTool() {},
});

function packFiles(): Record<string, Uint8Array> {
  return {
    'manifest.json': enc.encode(JSON.stringify({ format: 'lolly-brand', formatVersion: 3, minReader: 1 })),
    'instance.json': enc.encode(JSON.stringify({ kind: 'instance-pack', name: 'FS Brand', version: '1.0.0' })),
    'tools.json': enc.encode(JSON.stringify({ tools: [], files: {} })),
    'catalog.json': enc.encode(JSON.stringify({ assets: [{ id: 'x/logo/a', formats: [{ url: '/catalog/assets/x/a.svg' }] }] })),
    'catalog/assets/x/a.svg': enc.encode('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    'catalog/fonts/webfonts/Face-Regular.woff2': enc.encode('woff2-bytes'),
  };
}

beforeEach(() => {
  _resetPackStoreForTests();
  _setPinnedKeyForTests('');
});
afterEach(() => {
  _setDbForTests(null);
  _setPinnedKeyForTests('');
  _resetPackStoreForTests();
});

test('import lands on the filesystem and survives a fresh init', async () => {
  const { fs, files } = fakeFs();
  _setDbForTests(createFsPackDb(fs));
  const result = await importInstancePackParts(packFiles(), installer());
  assert.equal(result.assets, 1);
  assert.ok(packActive());

  // Bytes are on the "disk", meta as JSON text beside them.
  assert.ok(typeof files.get('pack-store/meta.json') === 'string');
  assert.ok([...files.keys()].filter(k => k.startsWith('pack-store/files/')).length >= 3);

  // A fresh session over the same fs: init restores meta + the path set.
  _resetPackStoreForTests();
  _setDbForTests(createFsPackDb(fs));
  assert.ok(!packActive());
  await initPackStore();
  assert.ok(packActive());
  assert.equal(getPackMeta()?.name, 'FS Brand');
  const svg = await packFetch('/catalog/assets/x/a.svg');
  assert.equal(svg?.headers.get('content-type'), 'image/svg+xml');
});

test('path keys with slashes round-trip through the filename encoding', async () => {
  const { fs } = fakeFs();
  _setDbForTests(createFsPackDb(fs));
  await importInstancePackParts(packFiles(), installer());
  const woff = await packFetch('/catalog/fonts/webfonts/Face-Regular.woff2');
  assert.equal(woff?.headers.get('content-type'), 'font/woff2');
  assert.equal(new TextDecoder().decode(new Uint8Array(await woff!.arrayBuffer())), 'woff2-bytes');
});

test('re-importing replaces the store whole: clear lands before the new puts', async () => {
  const { fs } = fakeFs();
  _setDbForTests(createFsPackDb(fs));
  await importInstancePackParts(packFiles(), installer());

  const next = packFiles();
  delete next['catalog/fonts/webfonts/Face-Regular.woff2'];
  next['catalog/assets/x/b.svg'] = enc.encode('<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>');
  next['catalog.json'] = enc.encode(JSON.stringify({ assets: [{ id: 'x/logo/b', formats: [{ url: '/catalog/assets/x/b.svg' }] }] }));
  await importInstancePackParts(next, installer());

  assert.equal(await packFetch('/catalog/fonts/webfonts/Face-Regular.woff2'), null, 'stale file gone');
  assert.ok(await packFetch('/catalog/assets/x/b.svg'), 'new file present');
});
