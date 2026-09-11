// SPDX-License-Identifier: MPL-2.0
/**
 * The tokens bridge with a design-system REGISTRY in the host slice (plans/186
 * sections 3.1 and 3.3): the head follows the active record, a first install
 * creates the default record, and a switch-grade bust drops the lock verdict.
 * Run directly:  node --test shells/web/src/bridge/tokens-registry.test.ts
 *
 * Composes the REAL assets bridge over an in-memory idb stand-in (the same
 * pattern tokens.test.ts uses for the user-tokens cases) plus the real registry
 * over a map-backed store, so the pointer, the store split and the head read
 * are exercised together rather than restated in a stub.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTokensAPI, installUserTokens, USER_TOKENS_ID } from './tokens.ts';
import { createAssetsAPI } from './assets.ts';
import {
  ACTIVE_DESIGN_SYSTEM_KEY, DESIGN_SYSTEMS_STORE, createDesignSystemRegistry,
  type DesignSystemRecord, type DesignSystemRegistry, type RegistryDb,
} from '../lib/design-system/registry.ts';

const DOC  = { color: { brand: { jungle: { $type: 'color', $value: '#30ba78' } } } };
const DOC2 = { color: { brand: { jungle: { $type: 'color', $value: '#123456' } } } };
const CATALOG_DOC = { color: { brand: { jungle: { $type: 'color', $value: '#0c322c' } } } };
const blobOf = (doc: unknown) => new Blob([JSON.stringify(doc)], { type: 'application/json' });

/** The idb slice the assets bridge and the registry read: named stores as maps. */
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
    transaction(names: string | string[], _mode?: string) {
      const list = Array.isArray(names) ? names : [names];
      const tx = {
        objectStore: (s: string) => ({
          get: (k: IDBValidKey) => db.get(s, k),
          put: (v: unknown, k?: IDBValidKey) => db.put(s, v, k), add: (v: unknown, k?: IDBValidKey) => db.put(s, v, k),
          delete: (k: IDBValidKey) => db.delete(s, k),
          getAll: () => db.getAll(s),
          getAllKeys: () => db.getAllKeys(s),
          clear: () => db.clear(s),
          count: () => db.count(s),
        }),
        store: null as unknown,
        done: Promise.resolve(),
      };
      tx.store = tx.objectStore(list[0]!);
      return tx;
    },
  };
  return db;
}

interface Rig {
  db: ReturnType<typeof memDb>;
  assets: ReturnType<typeof createAssetsAPI>;
  registry: DesignSystemRegistry;
  tokens: ReturnType<typeof createTokensAPI>;
  host: { assets: ReturnType<typeof createAssetsAPI>; tokens?: ReturnType<typeof createTokensAPI>; designSystems: DesignSystemRegistry };
}

/** A device whose shipped catalog carries CATALOG_DOC, with an optional legacy user head. */
async function rig(opts: { legacyHead?: unknown; brandLock?: boolean } = {}): Promise<Rig> {
  const db = memDb();
  await db.put('asset-meta', {
    id: 'lolly/tokens/brand', type: 'tokens', name: 'Lolly Starter Tokens', version: '1.0.0',
    formats: [{ format: 'json', url: '/catalog/assets/lolly/tokens/brand.json' }],
    ...(opts.brandLock ? { brandLock: true } : {}),
  });
  // The assets bridge keys a cached catalog blob `id:format:version`.
  await db.put('asset-blob', blobOf(CATALOG_DOC), 'lolly/tokens/brand:json:1.0.0');
  const assets = createAssetsAPI(db as unknown as Parameters<typeof createAssetsAPI>[0]);
  if (opts.legacyHead) {
    await assets._uploadUserAsset({ id: USER_TOKENS_ID, type: 'tokens', format: 'json', blob: blobOf(opts.legacyHead), version: '1.0.0', meta: { name: 'Acme' } });
  }
  const registry = createDesignSystemRegistry(db as unknown as RegistryDb, {
    catalogTokens: async () => {
      const m = await assets._findMetaByType('tokens', { catalogOnly: true }) as { id: string; name?: string; brandLock?: boolean } | null;
      return m ? { id: m.id, name: m.name, brandLock: m.brandLock } : null;
    },
    legacyHead: async () => assets._getUserRecord?.(USER_TOKENS_ID) ?? null,
  });
  const host: Rig['host'] = { assets, designSystems: registry };
  const tokens = createTokensAPI(host as unknown as Parameters<typeof createTokensAPI>[0]);
  host.tokens = tokens;
  await registry.ensure();
  return { db, assets, registry, tokens, host };
}

test('a fresh device resolves the shipped catalog doc, and active() says shipped', async () => {
  const r = await rig();
  assert.equal(await r.tokens.resolve('{color.brand.jungle}'), '#0c322c');
  const active = await r.tokens.active();
  assert.equal(active?.id, 'shipped');
  assert.equal(active?.source, 'shipped');
  assert.equal(active?.headId, 'lolly/tokens/brand');
  assert.deepEqual((await r.tokens.list()).map(s => s.id), ['shipped']);
});

test('a legacy user head migrates to the default record and the head follows the pointer', async () => {
  const r = await rig({ legacyHead: DOC });
  assert.equal(await r.tokens.resolve('{color.brand.jungle}'), '#30ba78');
  assert.equal(await r.tokens.headId(), USER_TOKENS_ID);
  const active = await r.tokens.active();
  assert.equal(active?.id, 'default');
  assert.equal(active?.label, 'Acme');
  assert.equal(active?.source, 'local');
});

test('switching the pointer to shipped serves the catalog doc without touching the user head', async () => {
  const r = await rig({ legacyHead: DOC });
  await r.registry.setActive('shipped');
  r.tokens.bust();
  assert.equal(await r.tokens.resolve('{color.brand.jungle}'), '#0c322c');
  assert.equal(await r.tokens.headId(), 'lolly/tokens/brand');
  // The user head is still there, untouched, for switching back.
  assert.ok(await r.assets._getBlob(USER_TOKENS_ID));
  await r.registry.setActive('default');
  r.tokens.bust();
  assert.equal(await r.tokens.resolve('{color.brand.jungle}'), '#30ba78');
});

test('a first install while shipped is active creates and activates the default record', async () => {
  const r = await rig();
  assert.equal((await r.tokens.active())?.id, 'shipped');
  await installUserTokens(r.host as unknown as Parameters<typeof installUserTokens>[0], DOC, { label: 'Acme' });
  const active = await r.tokens.active();
  assert.equal(active?.id, 'default');
  assert.equal(active?.label, 'Acme');
  assert.equal(await r.tokens.resolve('{color.brand.jungle}'), '#30ba78');
  assert.ok(await r.assets._getBlob(USER_TOKENS_ID));   // the legacy id, so nothing else on the device moves
});

test('a head write with no label keeps the record label - the studio no longer renames the system', async () => {
  const r = await rig({ legacyHead: DOC });
  await installUserTokens(r.host as unknown as Parameters<typeof installUserTokens>[0], DOC2);
  assert.equal((await r.tokens.active())?.label, 'Acme');
  assert.equal(await r.tokens.resolve('{color.brand.jungle}'), '#123456');
  // And an explicit label renames the record too.
  await installUserTokens(r.host as unknown as Parameters<typeof installUserTokens>[0], DOC2, { label: 'Acme 2026' });
  assert.equal((await r.tokens.active())?.label, 'Acme 2026');
});

test('a namespaced system writes and resolves under its own head id', async () => {
  const r = await rig({ legacyHead: DOC });
  const rec: DesignSystemRecord = {
    id: 'acme', label: 'Acme', ns: 'user/ds/acme/', headId: 'user/ds/acme/tokens/brand',
    source: { kind: 'local' }, locked: false, createdAt: 1, lastUsedAt: 1,
  };
  await r.registry.put(rec);
  await installUserTokens(r.host as unknown as Parameters<typeof installUserTokens>[0], DOC2, { system: 'acme' });
  assert.ok(await r.assets._getBlob('user/ds/acme/tokens/brand'));
  // Writing to a named system does not move the pointer; switching does.
  assert.equal((await r.tokens.active())?.id, 'default');
  assert.equal(await r.tokens.resolve('{color.brand.jungle}'), '#30ba78');
  await r.registry.setActive('acme');
  r.tokens.bust();
  assert.equal(await r.tokens.headId(), 'user/ds/acme/tokens/brand');
  assert.equal(await r.tokens.resolve('{color.brand.jungle}'), '#123456');
});

test('a material-locked record refuses head writes, while the build lock stays a catalog fact', async () => {
  const r = await rig({ legacyHead: DOC });
  const rec: DesignSystemRecord = {
    id: 'suse', label: 'SUSE', ns: 'user/ds/suse/', headId: 'user/ds/suse/tokens/brand',
    source: { kind: 'hosted', instance: 'https://brand.suse.com', packUrl: null, signature: 'verified' },
    locked: true, createdAt: 1, lastUsedAt: 1,
  };
  await r.registry.put(rec);
  // Naming the target is the sync path: that is how a locked system gets its bytes.
  await installUserTokens(r.host as unknown as Parameters<typeof installUserTokens>[0], DOC2, { system: 'suse' });
  assert.ok(await r.assets._getBlob('user/ds/suse/tokens/brand'));
  // The studio's path (no target, the active system) is what the lock refuses.
  await r.registry.setActive('suse');
  r.tokens.bust();
  await assert.rejects(() => installUserTokens(r.host as unknown as Parameters<typeof installUserTokens>[0], DOC), /fixed/);
  assert.equal(await r.tokens.isLocked(), false);   // the BUILD is not locked
  await r.registry.setActive('default');
  r.tokens.bust();
  await installUserTokens(r.host as unknown as Parameters<typeof installUserTokens>[0], DOC2);   // the default still writes
  assert.equal(await r.tokens.resolve('{color.brand.jungle}'), '#123456');
});

test('the build lock wins over any record: the catalog doc is served and writes are refused', async () => {
  const r = await rig({ legacyHead: DOC, brandLock: true });
  assert.equal(await r.tokens.isLocked(), true);
  assert.equal(await r.tokens.resolve('{color.brand.jungle}'), '#0c322c');
  await assert.rejects(() => installUserTokens(r.host as unknown as Parameters<typeof installUserTokens>[0], DOC2), /fixed/);
});

test('bust({ lock: true }) drops the memoised lock verdict; a plain bust keeps it', async () => {
  const r = await rig();
  assert.equal(await r.tokens.isLocked(), false);
  // Flip the shipped asset's flag under the bridge, as a pack import would.
  await r.db.put('asset-meta', { id: 'lolly/tokens/brand', type: 'tokens', name: 'Lolly Starter Tokens', version: '1.0.0', brandLock: true, formats: [{ format: 'json', url: '/x.json' }] });
  r.tokens.bust();
  assert.equal(await r.tokens.isLocked(), false);
  r.tokens.bust({ lock: true });
  assert.equal(await r.tokens.isLocked(), true);
});

test('the pointer key lives in the profile store and the records in their own store', async () => {
  const r = await rig({ legacyHead: DOC });
  assert.equal(r.db.stores.get('profile')!.get(ACTIVE_DESIGN_SYSTEM_KEY), 'default');
  assert.equal(r.db.stores.get(DESIGN_SYSTEMS_STORE)!.size, 2);
});
