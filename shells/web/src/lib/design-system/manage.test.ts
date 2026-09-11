// SPDX-License-Identifier: MPL-2.0
/**
 * Creating, renaming and removing design systems (plans/186 sections 3.1-3.2).
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/design-system/manage.test.ts
 *
 * The real assets bridge and the real registry over a map-backed store, so the
 * namespace rule ("delete exactly this system's rows") is exercised against the
 * store split rather than a stub's idea of it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAssetsAPI } from '../../bridge/assets.ts';
import { createTokensAPI, USER_TOKENS_ID } from '../../bridge/tokens.ts';
import { createDesignSystemRegistry, type RegistryDb } from './registry.ts';
import { createDesignSystem, removeDesignSystem, renameDesignSystem, uniqueDesignSystemId } from './manage.ts';
import { readDesignSystemIdentity } from '../../../../../engine/src/design-system.ts';

const CATALOG_DOC = { color: { brand: { ink: { $type: 'color', $value: '#1d1d1d' } } } };
const blobOf = (doc: unknown) => new Blob([JSON.stringify(doc)], { type: 'application/json' });

function memDb() {
  const stores = new Map<string, Map<IDBValidKey, unknown>>();
  const of = (s: string) => stores.get(s) ?? (stores.set(s, new Map()), stores.get(s)!);
  const db = {
    stores,
    async get(s: string, k: IDBValidKey) { return of(s).get(k); },
    async put(s: string, v: unknown, k?: IDBValidKey) { const key = k ?? (v as { id: IDBValidKey }).id; of(s).set(key, v); return key; },
    async delete(s: string, k: IDBValidKey) { of(s).delete(k); },
    async getAll(s: string) { return [...of(s).values()]; },
    async getAllKeys(s: string) { return [...of(s).keys()]; },
    async count(s: string) { return of(s).size; },
    async clear(s: string) { of(s).clear(); },
    objectStoreNames: { contains: (n: string) => n !== 'missing' },
    transaction(names: string | string[]) {
      const list = Array.isArray(names) ? names : [names];
      const tx = {
        objectStore: (s: string) => ({
          get: (k: IDBValidKey) => db.get(s, k), put: (v: unknown, k?: IDBValidKey) => db.put(s, v, k),
          delete: (k: IDBValidKey) => db.delete(s, k), getAll: () => db.getAll(s), getAllKeys: () => db.getAllKeys(s),
          clear: () => db.clear(s), count: () => db.count(s),
          // asset-history's dependencyRoots walks the retained-history stores by cursor before a delete
          openCursor: async () => { const vals = [...of(s).values()]; let i = 0; const at = (): { value: unknown; continue: () => Promise<unknown> } | null => (i < vals.length ? { value: vals[i++], continue: async () => at() } : null); return at(); },
        }),
        store: null as unknown, done: Promise.resolve(), abort() {},
      };
      tx.store = tx.objectStore(list[0]!);
      return tx;
    },
  };
  return db;
}

async function rig(opts: { legacy?: boolean } = {}) {
  const db = memDb();
  await db.put('asset-meta', { id: 'lolly/tokens/brand', type: 'tokens', name: 'Lolly Starter Tokens', version: '1.0.0', formats: [{ format: 'json', url: '/x.json' }] });
  await db.put('asset-blob', blobOf(CATALOG_DOC), 'lolly/tokens/brand:json:1.0.0');
  const assets = createAssetsAPI(db as unknown as Parameters<typeof createAssetsAPI>[0]);
  if (opts.legacy) {
    await assets._uploadUserAsset({ id: USER_TOKENS_ID, type: 'tokens', format: 'json', blob: blobOf({ a: 1 }), version: '1.0.0', meta: { name: 'Acme' } });
    await assets._uploadUserAsset({ id: 'user/fonts/inter/0', type: 'font', format: 'woff2', blob: new Blob(['f']), version: '1.0.0', meta: { family: 'Inter' } });
    await assets._uploadUserAsset({ id: 'user/raster/1700000000000-photo', type: 'raster', format: 'png', blob: new Blob(['p']), version: '1.0.0' });
  }
  const registry = createDesignSystemRegistry(db as unknown as RegistryDb, {
    catalogTokens: async () => ({ id: 'lolly/tokens/brand', name: 'Lolly Starter Tokens' }),
    legacyHead: async () => assets._getUserRecord?.(USER_TOKENS_ID) ?? null,
  });
  const host = { assets, designSystems: registry } as { assets: typeof assets; designSystems: typeof registry; tokens?: ReturnType<typeof createTokensAPI> };
  host.tokens = createTokensAPI(host as unknown as Parameters<typeof createTokensAPI>[0]);
  await registry.ensure();
  return { db, assets, registry, host };
}

test('uniqueDesignSystemId slugs the label and steps past taken ids, never landing on default or shipped', async () => {
  const r = await rig();
  assert.equal(await uniqueDesignSystemId(r.registry, 'Acme 2026'), 'acme-2026');
  assert.equal(await uniqueDesignSystemId(r.registry, 'Default'), 'default-2');
  assert.equal(await uniqueDesignSystemId(r.registry, 'Shipped'), 'shipped-2');
});

test('createDesignSystem mints a namespaced record seeded from the shipped doc, with its identity written in', async () => {
  const r = await rig();
  const rec = await createDesignSystem(r.host as unknown as Parameters<typeof createDesignSystem>[0], { label: 'Acme' });
  assert.equal(rec.id, 'acme');
  assert.equal(rec.ns, 'user/ds/acme/');
  assert.equal(rec.headId, 'user/ds/acme/tokens/brand');
  assert.equal(rec.source.kind, 'local');
  const blob = await r.assets._getBlob('user/ds/acme/tokens/brand');
  assert.ok(blob);
  const doc = JSON.parse(await blob!.text());
  assert.equal(doc.color.brand.ink.$value, '#1d1d1d');           // the starter's colours
  assert.deepEqual(readDesignSystemIdentity(doc), { id: 'acme', label: 'Acme' });
  // Creating does not switch.
  assert.equal(await r.registry.activeId(), 'shipped');
  // A second "Acme" gets its own id.
  const again = await createDesignSystem(r.host as unknown as Parameters<typeof createDesignSystem>[0], { label: 'Acme' });
  assert.equal(again.id, 'acme-2');
});

test('a copy of another record records where it came from', async () => {
  const r = await rig({ legacy: true });
  const copy = await createDesignSystem(r.host as unknown as Parameters<typeof createDesignSystem>[0], { label: 'Acme copy', seedFrom: 'default' });
  assert.equal(copy.source.kind, 'local');
  assert.deepEqual((copy.source as { forkedFrom?: unknown }).forkedFrom, { id: 'default' });
  const doc = JSON.parse(await (await r.assets._getBlob(copy.headId))!.text());
  assert.equal(doc.a, 1);
});

test('renameDesignSystem changes the label only', async () => {
  const r = await rig({ legacy: true });
  await renameDesignSystem(r.host as unknown as Parameters<typeof renameDesignSystem>[0], 'default', 'Acme Corp');
  assert.equal((await r.registry.get('default'))!.label, 'Acme Corp');
  assert.equal((await r.registry.get('default'))!.headId, USER_TOKENS_ID);
});

test('removeDesignSystem deletes exactly that namespace and leaves personal uploads and other systems', async () => {
  const r = await rig({ legacy: true });
  const acme = await createDesignSystem(r.host as unknown as Parameters<typeof createDesignSystem>[0], { label: 'Acme' });
  await r.assets._uploadUserAsset({ id: 'user/ds/acme/fonts/inter/0', type: 'font', format: 'woff2', blob: new Blob(['g']), version: '1.0.0', meta: { family: 'Inter' } });
  const res = await removeDesignSystem(r.host as unknown as Parameters<typeof removeDesignSystem>[0], acme.id);
  assert.equal(res.deleted, 2);                                   // its head and its font
  assert.equal(res.wasActive, false);
  assert.equal(await r.assets._getBlob('user/ds/acme/tokens/brand'), null);
  assert.equal(await r.assets._getBlob('user/ds/acme/fonts/inter/0'), null);
  assert.ok(await r.assets._getBlob(USER_TOKENS_ID));             // the default's head stands
  assert.ok(await r.assets._getBlob('user/fonts/inter/0'));       // and its font
  assert.ok(await r.assets._getBlob('user/raster/1700000000000-photo'));  // the upload was never a system's
  assert.equal(await r.registry.get('acme'), null);
});

test('removing the active system moves the pointer to shipped; the shipped system is refused', async () => {
  const r = await rig({ legacy: true });
  assert.equal(await r.registry.activeId(), 'default');
  const res = await removeDesignSystem(r.host as unknown as Parameters<typeof removeDesignSystem>[0], 'default');
  assert.equal(res.wasActive, true);
  assert.equal(res.deleted, 2);                                   // head + font; the raster upload stays
  assert.equal(await r.registry.activeId(), 'shipped');
  await assert.rejects(() => removeDesignSystem(r.host as unknown as Parameters<typeof removeDesignSystem>[0], 'shipped'), /cannot be removed/);
});
