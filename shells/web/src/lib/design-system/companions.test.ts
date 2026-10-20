// SPDX-License-Identifier: MPL-2.0
/**
 * The design systems a catalog offers beside its own (companions.ts).
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/design-system/companions.test.ts
 *
 * The real assets bridge, tokens bridge and registry over a map-backed store,
 * the same rig as manage.test.ts: lolly.tools ships Lolly Demo and lists the
 * bundled starter as its companion.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAssetsAPI } from '../../bridge/assets.ts';
import { createTokensAPI, USER_TOKENS_ID } from '../../bridge/tokens.ts';
import { createDesignSystemRegistry, type RegistryDb } from './registry.ts';
import { readCompanionDesignSystems, seedCompanionDesignSystems, type CompanionHost } from './companions.ts';
import { removeDesignSystem } from './manage.ts';
import { readDesignSystemIdentity } from '../../../../../engine/src/design-system.ts';
import bundledStarter from '../../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json' with { type: 'json' };

const CATALOG_DOC = { color: { brand: { ink: { $type: 'color', $value: '#1d1d1d' } } } };
const DEMO = { id: 'lolly/tokens/demo', name: 'Lolly Demo', doc: { color: { brand: { mint: { $type: 'color', $value: '#3fd1a4' } } } } };
const STARTER = [{ tokens: 'lolly/tokens/brand', label: 'Lolly Starter' }];
const blobOf = (doc: unknown) => new Blob([JSON.stringify(doc)], { type: 'application/json' });

function memDb() {
  const stores = new Map<string, Map<IDBValidKey, unknown>>();
  const of = (s: string) => {
    let store = stores.get(s);
    if (!store) { store = new Map(); stores.set(s, store); }
    return store;
  };
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

async function rig(opts: { legacy?: boolean; catalog?: { id: string; name: string; doc: unknown }; logos?: string[] } = {}) {
  const db = memDb();
  const catalog = opts.catalog ?? { id: 'lolly/tokens/brand', name: 'Lolly Starter Tokens', doc: CATALOG_DOC };
  await db.put('asset-meta', { id: catalog.id, type: 'tokens', name: catalog.name, version: '1.0.0', formats: [{ format: 'json', url: '/x.json' }] });
  await db.put('asset-blob', blobOf(catalog.doc), `${catalog.id}:json:1.0.0`);
  for (const id of opts.logos ?? []) {
    await db.put('asset-meta', { id, type: 'vector', name: id, version: '1.0.0', formats: [{ format: 'svg', url: '/logo.svg' }] });
  }
  const assets = createAssetsAPI(db as unknown as Parameters<typeof createAssetsAPI>[0]);
  if (opts.legacy) {
    await assets._uploadUserAsset({ id: USER_TOKENS_ID, type: 'tokens', format: 'json', blob: blobOf({ a: 1 }), version: '1.0.0', meta: { name: 'Acme' } });
    await assets._uploadUserAsset({ id: 'user/fonts/inter/0', type: 'font', format: 'woff2', blob: new Blob(['f']), version: '1.0.0', meta: { family: 'Inter' } });
    await assets._uploadUserAsset({ id: 'user/raster/1700000000000-photo', type: 'raster', format: 'png', blob: new Blob(['p']), version: '1.0.0' });
  }
  const registry = createDesignSystemRegistry(db as unknown as RegistryDb, {
    catalogTokens: async () => ({ id: catalog.id, name: catalog.name }),
    legacyHead: async () => assets._getUserRecord?.(USER_TOKENS_ID) ?? null,
  });
  const host = { assets, designSystems: registry } as { assets: typeof assets; designSystems: typeof registry; tokens?: ReturnType<typeof createTokensAPI> };
  host.tokens = createTokensAPI(host as unknown as Parameters<typeof createTokensAPI>[0]);
  await registry.ensure();
  return { db, assets, registry, host };
}

const seed = (host: unknown, list = STARTER) => seedCompanionDesignSystems(host as CompanionHost, list);

test('the index list keeps well-formed entries once each, in order', () => {
  assert.deepEqual(readCompanionDesignSystems([
    { tokens: 'lolly/tokens/brand', label: ' Lolly Starter ' }, { tokens: 'lolly/tokens/brand', label: 'Again' },
    { tokens: '', label: 'x' }, { tokens: 'a/tokens/b' }, null, 'lolly/tokens/demo', { tokens: 'acme/tokens/brand', label: 'Acme' },
  ]), [{ tokens: 'lolly/tokens/brand', label: 'Lolly Starter' }, { tokens: 'acme/tokens/brand', label: 'Acme' }]);
  assert.deepEqual(readCompanionDesignSystems({ tokens: 'x', label: 'y' }), []);
});

test('lolly.tools gets Lolly Starter beside Lolly Demo: editable, removable, not switched to', async () => {
  const r = await rig({ catalog: DEMO, logos: ['lolly/logo/primary'] });
  const [made] = await seed(r.host);
  assert.ok(made);
  assert.equal(made.label, 'Lolly Starter');
  assert.equal(made.id, 'lolly-starter');
  assert.deepEqual(made.source, { kind: 'local', from: 'app' });
  assert.equal(made.locked, false);
  assert.deepEqual((await r.registry.visible()).map(x => x.label), ['Lolly Demo', 'Lolly Starter']);
  assert.equal(await r.registry.activeId(), 'shipped', 'seeding never switches');
  const doc = JSON.parse(await (await r.assets._getBlob(made.headId))!.text());
  assert.deepEqual(doc.base.color, bundledStarter.base.color, "the starter's palette");
  assert.deepEqual(readDesignSystemIdentity(doc), { id: 'lolly-starter', label: 'Lolly Starter' });
});

test('a companion is seeded once: a second sync adds nothing, and a removed one stays removed', async () => {
  const r = await rig({ catalog: DEMO });
  assert.equal((await seed(r.host)).length, 1);
  assert.equal((await seed(r.host)).length, 0);
  await removeDesignSystem(r.host as unknown as Parameters<typeof removeDesignSystem>[0], 'lolly-starter');
  assert.equal((await seed(r.host)).length, 0);
  assert.deepEqual((await r.registry.visible()).map(x => x.id), ['shipped']);
});

test('a locked build gets no companion, and nor does a catalog naming its own system', async () => {
  const locked = await rig({ catalog: DEMO });
  await locked.db.put('asset-meta', { id: DEMO.id, type: 'tokens', name: DEMO.name, version: '1.0.0', brandLock: true, formats: [{ format: 'json', url: '/x.json' }] });
  const lockedRegistry = createDesignSystemRegistry(locked.db as unknown as RegistryDb, {
    catalogTokens: async () => ({ id: DEMO.id, name: DEMO.name, brandLock: true }),
    legacyHead: async () => null,
  });
  assert.deepEqual(await seed({ ...locked.host, designSystems: lockedRegistry }), []);
  const start = await rig();   // lolly-start ships the starter itself
  assert.deepEqual(await seed(start.host), []);
});

test('a companion held in the catalog is copied from its own document', async () => {
  const r = await rig({ catalog: DEMO });
  await r.db.put('asset-meta', { id: 'acme/tokens/brand', type: 'tokens', name: 'Acme Tokens', version: '1.0.0', formats: [{ format: 'json', url: '/acme.json' }] });
  await r.db.put('asset-blob', blobOf(CATALOG_DOC), 'acme/tokens/brand:json:1.0.0');
  const [made] = await seed(r.host, [{ tokens: 'acme/tokens/brand', label: 'Acme' }]);
  const doc = JSON.parse(await (await r.assets._getBlob(made!.headId))!.text());
  assert.equal(doc.color.brand.ink.$value, '#1d1d1d');
  // One that cannot be read yet is left for the next sync, not marked done.
  assert.deepEqual(await seed(r.host, [{ tokens: 'missing/tokens/brand', label: 'Missing' }]), []);
  assert.deepEqual(await r.registry.seeded(), ['acme/tokens/brand']);
});
