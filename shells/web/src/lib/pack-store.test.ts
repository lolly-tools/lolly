// SPDX-License-Identifier: MPL-2.0
/**
 * Instance-pack store + overlay (plans/131 WP-D).
 *
 * Headless via the _setDbForTests seam (a Map-backed idb fake - node has no
 * IndexedDB) plus an injected installed-tools fake (pack TOOLS ride the plan
 * 114 sideload system, which needs Cache Storage) and a stubbed global fetch
 * for the underlying-index legs. The signature suite exercises the
 * FAIL-CLOSED path with a real P-256 keypair: pinned+unsigned refuses,
 * pinned+wrong-key refuses, pinned+right-key verifies - the properties the
 * trust story actually rests on.
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

import {
  _resetPackStoreForTests, _setDbForTests, _setPinnedKeyForTests,
  clearInstancePack, getPackMeta, importInstancePackParts, initPackStore,
  packActive, packAssetEntries, packFetch,
  type PackToolInstaller,
} from './pack-store.ts';
import { _setBaseForTests, instanceFetch } from './instance.ts';

const enc = new TextEncoder();

/** Map-backed fake of the narrow idb surface pack-store uses. */
function fakeDb() {
  const stores = new Map<string, Map<string, unknown>>();
  const store = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  };
  return {
    stores,
    async get(s: string, key: string) { return store(s).get(key); },
    async put(s: string, value: unknown, key: string) { store(s).set(key, value); },
    async delete(s: string, key: string) { store(s).delete(key); },
    async clear(s: string) { store(s).clear(); },
    async getAllKeys(s: string) { return [...store(s).keys()]; },
    transaction(names: string[], _mode: 'readwrite') {
      return {
        objectStore: (name: string) => ({
          put: (value: unknown, key: string) => { store(name).set(key, value); },
          clear: () => { store(name).clear(); },
        }),
        done: Promise.resolve(),
      };
    },
  };
}

/** Recording fake of the installed-tools surface pack-store drives. */
function fakeInstaller(opts: { refuse?: string[] } = {}) {
  const installed: Array<{ id: string; files: string[]; trust: string }> = [];
  const uninstalled: string[] = [];
  const it: PackToolInstaller = {
    async installTool(input) {
      const id = input.manifest.id;
      if (opts.refuse?.includes(id)) throw new Error('module hooks');
      installed.push({ id, files: Object.keys(input.files), trust: input.trust });
    },
    async uninstallTool(id) { uninstalled.push(id); },
  };
  return { it, installed, uninstalled };
}

/** A minimal instance-pack file set (already-unzipped shape). */
function packFiles(opts: { instance?: string; sig?: Uint8Array; toolIds?: string[] } = {}): Record<string, Uint8Array> {
  const toolIds = opts.toolIds ?? ['brand-x'];
  const manifest = enc.encode(JSON.stringify({ format: 'lolly-brand', formatVersion: 3, minReader: 1 }));
  const files: Record<string, Uint8Array> = {
    'manifest.json': manifest,
    'instance.json': enc.encode(JSON.stringify({
      kind: 'instance-pack', name: 'Test Brand', publisher: 'Testers', version: '1.0.0',
      ...(opts.instance ? { instance: opts.instance } : {}),
    })),
    'tools.json': enc.encode(JSON.stringify({
      tools: toolIds.map(id => ({ id })),
      files: Object.fromEntries(toolIds.map(id => [id, ['tool.json', 'template.html']])),
    })),
    'catalog.json': enc.encode(JSON.stringify({
      assets: [{ id: 'test/logo/a', formats: [{ url: '/catalog/assets/test/a.svg' }] }],
    })),
    'catalog/assets/test/a.svg': enc.encode('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    'tokens.json': enc.encode('{}'), // brand part - must NOT land in the pack store
  };
  for (const id of toolIds) {
    files[`tools/${id}/tool.json`] = enc.encode(JSON.stringify({ id, name: id }));
    files[`tools/${id}/template.html`] = enc.encode('<div></div>');
  }
  if (opts.sig) files['pack.sig'] = opts.sig;
  return files;
}

let db: ReturnType<typeof fakeDb>;
const realFetch = globalThis.fetch;

beforeEach(() => {
  db = fakeDb();
  _resetPackStoreForTests();
  _setDbForTests(db);
  _setPinnedKeyForTests('');
  _setBaseForTests('');
});

afterEach(() => {
  _setDbForTests(null);
  _setPinnedKeyForTests('');
  _resetPackStoreForTests();
  globalThis.fetch = realFetch;
});

test('import: tools go to the sideload system, catalog bytes to the store, brand parts to neither', async () => {
  const { it, installed } = fakeInstaller();
  const result = await importInstancePackParts(packFiles({ instance: 'https://packs.example.com' }), it);
  assert.equal(result.tools, 1);
  assert.deepEqual(result.toolsSkipped, []);
  assert.equal(result.assets, 1);
  assert.equal(result.name, 'Test Brand');
  assert.equal(result.signature, 'unsigned');
  assert.equal(result.instance, 'https://packs.example.com');

  // The tool went through installTool - never into the pack-files store.
  assert.deepEqual(installed.map(t => t.id), ['brand-x']);
  assert.deepEqual(installed[0]!.files.sort(), ['template.html', 'tool.json']);
  assert.equal(installed[0]!.trust, 'custom');
  assert.equal(await packFetch('/tools/brand-x/tool.json'), null);

  assert.ok(packActive());
  assert.deepEqual(getPackMeta()?.toolIds, ['brand-x']);

  const svg = await packFetch('/catalog/assets/test/a.svg');
  assert.equal(svg?.headers.get('content-type'), 'image/svg+xml');
  assert.equal(await packFetch('/tokens.json'), null);
  assert.deepEqual((await packAssetEntries()).map(a => a.id), ['test/logo/a']);
});

test('replacing a pack uninstalls the tools the new pack no longer carries', async () => {
  const first = fakeInstaller();
  await importInstancePackParts(packFiles({ toolIds: ['brand-x', 'brand-y'] }), first.it);
  const second = fakeInstaller();
  const result = await importInstancePackParts(packFiles({ toolIds: ['brand-y'] }), second.it);
  assert.equal(result.tools, 1);
  assert.deepEqual(second.uninstalled, ['brand-x']);
  assert.deepEqual(getPackMeta()?.toolIds, ['brand-y']);
});

test('a tool the sideloader refuses is skipped and reported, never fatal', async () => {
  const { it } = fakeInstaller({ refuse: ['brand-x'] });
  const result = await importInstancePackParts(packFiles({ toolIds: ['brand-x', 'brand-y'] }), it);
  assert.equal(result.tools, 1);
  assert.deepEqual(result.toolsSkipped, ['brand-x']);
  assert.deepEqual(getPackMeta()?.toolIds, ['brand-y']);
});

test('meta + paths survive a fresh init (new session over the same DB)', async () => {
  await importInstancePackParts(packFiles(), fakeInstaller().it);
  _resetPackStoreForTests();
  _setDbForTests(db);
  assert.ok(!packActive());
  await initPackStore();
  assert.ok(packActive());
  assert.equal(getPackMeta()?.name, 'Test Brand');
});

test('clearInstancePack removes the store and uninstalls the pack tools', async () => {
  await importInstancePackParts(packFiles(), fakeInstaller().it);
  const { it, uninstalled } = fakeInstaller();
  await clearInstancePack(it);
  assert.ok(!packActive());
  assert.deepEqual(uninstalled, ['brand-x']);
  assert.equal(await packFetch('/catalog/assets/test/a.svg'), null);
  assert.equal(db.stores.get('pack-files')?.size, 0);
});

test('instanceFetch serves pack catalog files before any transport', async () => {
  await importInstancePackParts(packFiles(), fakeInstaller().it);
  let fetched = 0;
  globalThis.fetch = (async () => { fetched++; return new Response('nope', { status: 404 }); }) as typeof fetch;
  const resp = await instanceFetch('/catalog/assets/test/a.svg');
  assert.equal(resp.status, 200);
  assert.equal(fetched, 0);
});

test('the TOOL index passes through unmerged - the signed-envelope check stays honest', async () => {
  await importInstancePackParts(packFiles(), fakeInstaller().it);
  const remote = JSON.stringify({ version: '9', tools: [{ id: 'community-a' }] });
  globalThis.fetch = (async () => new Response(remote, { headers: { 'content-type': 'application/json' } })) as typeof fetch;
  const text = await (await instanceFetch('/catalog/tools/index.json')).text();
  assert.equal(text, remote, 'tool-index bytes must arrive exactly as the remote signed them');
});

test('instanceFetch merges the ASSET index - pack wins on id collision', async () => {
  await importInstancePackParts(packFiles(), fakeInstaller().it);
  globalThis.fetch = (async () => new Response(JSON.stringify({
    version: '9',
    assets: [{ id: 'community/x' }, { id: 'test/logo/a', stale: true }],
  }), { headers: { 'content-type': 'application/json' } })) as typeof fetch;
  const index = await (await instanceFetch('/catalog/assets/index.json')).json();
  assert.deepEqual(index.assets.map((a: { id: string }) => a.id), ['community/x', 'test/logo/a']);
  assert.equal(index.assets[1].stale, undefined, 'the pack entry replaced the underlying one');
});

test('asset-index merge degrades to pack-only entries when the underlying source is down', async () => {
  await importInstancePackParts(packFiles(), fakeInstaller().it);
  globalThis.fetch = (async () => { throw new TypeError('offline'); }) as typeof fetch;
  const index = await (await instanceFetch('/catalog/assets/index.json')).json();
  assert.deepEqual(index.assets.map((a: { id: string }) => a.id), ['test/logo/a']);
});

test('with no pack loaded, instanceFetch is a passthrough', async () => {
  let fetched = 0;
  globalThis.fetch = (async () => { fetched++; return new Response('{}'); }) as typeof fetch;
  await instanceFetch('/catalog/tools/index.json');
  assert.equal(fetched, 1);
});

test('beforeIngest runs before any tool installs (the base-then-install order)', async () => {
  const order: string[] = [];
  const it: PackToolInstaller = {
    async installTool() { order.push('install'); },
    async uninstallTool() { order.push('uninstall'); },
  };
  await importInstancePackParts(packFiles({ instance: 'https://packs.example.com' }), it, ({ instance }) => {
    order.push(`base:${instance}`);
  });
  assert.deepEqual(order, ['base:https://packs.example.com', 'install']);
});

// ── signature policy ─────────────────────────────────────────────────────────

async function keypair() {
  const kp = await webcrypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'],
  ) as CryptoKeyPair;
  const pub = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  return { kp, pubJson: JSON.stringify(pub) };
}

async function signed(files: Record<string, Uint8Array>, key: CryptoKey): Promise<Record<string, Uint8Array>> {
  const sig = await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, files['manifest.json'] as unknown as NodeJS.BufferSource,
  );
  return {
    ...files,
    'pack.sig': enc.encode(JSON.stringify({
      alg: 'ECDSA-P256-SHA256',
      signature: Buffer.from(sig).toString('base64'),
    })),
  };
}

test('no pinned key: signed pack reads as unverified, unsigned as unsigned', async () => {
  const { kp } = await keypair();
  const result = await importInstancePackParts(await signed(packFiles(), kp.privateKey), fakeInstaller().it);
  assert.equal(result.signature, 'unverified');
});

test('pinned key: an unsigned pack is refused before anything lands', async () => {
  const { pubJson } = await keypair();
  _setPinnedKeyForTests(pubJson);
  const { it, installed } = fakeInstaller();
  let baseMoved = false;
  await assert.rejects(
    () => importInstancePackParts(packFiles({ instance: 'https://evil.example.com' }), it, () => { baseMoved = true; }),
    /signed packs/,
  );
  assert.ok(!packActive());
  assert.equal(installed.length, 0, 'no tool may install from a refused pack');
  assert.equal(baseMoved, false, 'a refused pack must never move the instance base');
});

test('pinned key: the matching signature verifies', async () => {
  const { kp, pubJson } = await keypair();
  _setPinnedKeyForTests(pubJson);
  const result = await importInstancePackParts(await signed(packFiles(), kp.privateKey), fakeInstaller().it);
  assert.equal(result.signature, 'verified');
});

test('pinned key: a foreign signature is refused', async () => {
  const { pubJson } = await keypair();
  const other = await keypair();
  _setPinnedKeyForTests(pubJson);
  const files = await signed(packFiles(), other.kp.privateKey);
  await assert.rejects(() => importInstancePackParts(files, fakeInstaller().it), /doesn't match/);
  assert.ok(!packActive());
});

test('pinned key: tampered manifest bytes are refused', async () => {
  const { kp, pubJson } = await keypair();
  _setPinnedKeyForTests(pubJson);
  const files = await signed(packFiles(), kp.privateKey);
  files['manifest.json'] = enc.encode(JSON.stringify({ format: 'lolly-brand', formatVersion: 3, minReader: 1, evil: true }));
  await assert.rejects(() => importInstancePackParts(files, fakeInstaller().it), /doesn't match/);
});
