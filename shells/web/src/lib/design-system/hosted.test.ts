// SPDX-License-Identifier: MPL-2.0
/**
 * Hosted design systems (plans/186 section 3.6): the manifest shape, the add
 * flow against a stubbed instance (pack-less, from its catalog index), the
 * refresh check, and the honest outcomes when the host is away.
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/design-system/hosted.test.ts
 *
 * The real assets bridge, registry and tokens API over an in-memory idb; the
 * network is a url → response table on global fetch (instanceFetch passes an
 * absolute URL straight through outside Tauri).
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createAssetsAPI } from '../../bridge/assets.ts';
import { createTokensAPI } from '../../bridge/tokens.ts';
import { createDesignSystemRegistry, type RegistryDb } from './registry.ts';
import { addHostedDesignSystem, checkHostedDesignSystems, refreshHostedDesignSystem, shapeHostedManifest } from './hosted.ts';
import { readDesignSystemIdentity } from '../../../../../engine/src/design-system.ts';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function stubFetch(routes: Record<string, unknown | (() => Response)>, log: string[] = []): void {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input).replace(/\?.*$/, '');
    log.push(url);
    if (!(url in routes)) return new Response('not found', { status: 404 });
    const r = routes[url];
    if (typeof r === 'function') return (r as () => Response)();
    if (r instanceof Blob) return new Response(r, { status: 200 });
    return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

const BASE = 'https://brand.example.com';
const TOKENS_DOC = {
  color: { brand: { jungle: { $type: 'color', $value: '#30ba78' } } },
  asset: { logo: { 'horizontal-primary': { $type: 'asset', $value: 'acme/logo/hor-pos' } } },
};
const INDEX = {
  assets: [
    { id: 'acme/tokens/brand', type: 'tokens', name: 'Acme Brand Tokens', version: '1.0.0', checksum: 'sha256-abc', formats: [{ format: 'json', url: '/catalog/assets/acme/tokens/brand.json' }] },
    { id: 'acme/logo/hor-pos', type: 'vector', version: '1.0.0', formats: [{ format: 'svg', url: '/catalog/assets/acme/logo/hor-pos.svg' }] },
  ],
};
const manifest = (over: Record<string, unknown> = {}) => ({
  name: 'Acme', accessMode: 'open', engineVersion: '1.173.0',
  brand: { profile: null, label: 'Acme', version: null, checksum: 'sha256-abc', locked: true, packUrl: null },
  ...over,
});
function routes(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    [`${BASE}/api/v1/instance`]: manifest(),
    [`${BASE}/catalog/assets/index.json`]: INDEX,
    [`${BASE}/catalog/assets/acme/tokens/brand.json`]: TOKENS_DOC,
    [`${BASE}/catalog/assets/acme/logo/hor-pos.svg`]: new Blob(['<svg/>'], { type: 'image/svg+xml' }),
    ...over,
  };
}

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
          get: (k: IDBValidKey) => db.get(s, k), put: (v: unknown, k?: IDBValidKey) => db.put(s, v, k), add: (v: unknown, k?: IDBValidKey) => db.put(s, v, k),
          delete: (k: IDBValidKey) => db.delete(s, k), getAll: () => db.getAll(s), getAllKeys: () => db.getAllKeys(s),
          clear: () => db.clear(s), count: () => db.count(s),
        }),
        store: null as unknown, done: Promise.resolve(),
      };
      tx.store = tx.objectStore(list[0]!);
      return tx;
    },
  };
  return db;
}

async function rig() {
  const db = memDb();
  await db.put('asset-meta', { id: 'lolly/tokens/brand', type: 'tokens', name: 'Lolly Starter Tokens', version: '1.0.0', formats: [{ format: 'json', url: '/x.json' }] });
  await db.put('asset-blob', new Blob([JSON.stringify({ a: 1 })]), 'lolly/tokens/brand:json:1.0.0');
  const assets = createAssetsAPI(db as unknown as Parameters<typeof createAssetsAPI>[0]);
  const registry = createDesignSystemRegistry(db as unknown as RegistryDb, {
    catalogTokens: async () => ({ id: 'lolly/tokens/brand', name: 'Lolly Starter Tokens' }),
    legacyHead: async () => null,
  });
  const host = { assets, designSystems: registry, log() {} } as { assets: typeof assets; designSystems: typeof registry; tokens?: ReturnType<typeof createTokensAPI>; log(): void };
  host.tokens = createTokensAPI(host as unknown as Parameters<typeof createTokensAPI>[0]);
  await registry.ensure();
  return { db, assets, registry, host };
}

test('shapeHostedManifest reads the brand block and tolerates an older manifest without one', () => {
  const m = shapeHostedManifest(manifest());
  assert.equal(m?.name, 'Acme');
  assert.equal(m?.brand?.checksum, 'sha256-abc');
  assert.equal(m?.brand?.locked, true);
  assert.equal(m?.packUrl, null);
  const old = shapeHostedManifest({ name: 'Old', connect: { packUrl: 'https://old/connect/pack.lolly' } });
  assert.equal(old?.brand, null);
  assert.equal(old?.packUrl, 'https://old/connect/pack.lolly');
  assert.equal(shapeHostedManifest({ nope: 1 }), null);
});

test('adding a pack-less instance builds the core from its catalog: tokens with identity, logos re-keyed into the namespace', async () => {
  const r = await rig();
  const log: string[] = [];
  stubFetch(routes(), log);
  const rec = await addHostedDesignSystem(r.host as unknown as Parameters<typeof addHostedDesignSystem>[0], 'https://brand.example.com/');
  assert.equal(rec.id, 'acme');
  assert.equal(rec.label, 'Acme');
  assert.equal(rec.locked, true);
  assert.equal(rec.source.kind, 'hosted');
  if (rec.source.kind !== 'hosted') throw new Error('unreachable');
  assert.equal(rec.source.instance, BASE);
  assert.equal(rec.source.checksum, 'sha256-abc');
  assert.ok(rec.source.lastSyncedAt);
  // The head is in the namespace, carries the identity, and points at the LOCAL logo.
  const head = JSON.parse(await (await r.assets._getBlob('user/ds/acme/tokens/brand'))!.text());
  assert.deepEqual(readDesignSystemIdentity(head), { id: 'acme', label: 'Acme' });
  assert.equal(head.asset.logo['horizontal-primary'].$value, 'user/ds/acme/logo/hor-pos');
  assert.ok(await r.assets._getBlob('user/ds/acme/logo/hor-pos'));
  // Adding does not switch; nothing outside the namespace moved.
  assert.equal(await r.registry.activeId(), 'shipped');
  assert.ok(log.some(u => u.endsWith('/api/v1/instance')));
});

test('an instance already on the device is refused, and an unreachable one leaves no half record', async () => {
  const r = await rig();
  stubFetch(routes());
  await addHostedDesignSystem(r.host as unknown as Parameters<typeof addHostedDesignSystem>[0], BASE);
  await assert.rejects(() => addHostedDesignSystem(r.host as unknown as Parameters<typeof addHostedDesignSystem>[0], BASE), /already on this device/);
  stubFetch({});
  await assert.rejects(() => addHostedDesignSystem(r.host as unknown as Parameters<typeof addHostedDesignSystem>[0], 'https://gone.example.com'), /gone\.example\.com/);
  assert.deepEqual((await r.registry.list()).map(x => x.id), ['shipped', 'acme']);
});

test('refresh: unchanged within the interval, updated when the host checksum moves, unreachable when it is away', async () => {
  const r = await rig();
  stubFetch(routes());
  const rec = await addHostedDesignSystem(r.host as unknown as Parameters<typeof addHostedDesignSystem>[0], BASE);
  assert.equal(await refreshHostedDesignSystem(r.host as unknown as Parameters<typeof refreshHostedDesignSystem>[0], rec.id), 'unchanged');
  // The host publishes a new document.
  const NEW_DOC = { ...TOKENS_DOC, color: { brand: { jungle: { $type: 'color', $value: '#123456' } } } };
  stubFetch(routes({
    [`${BASE}/api/v1/instance`]: manifest({ brand: { profile: null, label: 'Acme', version: null, checksum: 'sha256-def', locked: true, packUrl: null } }),
    [`${BASE}/catalog/assets/acme/tokens/brand.json`]: NEW_DOC,
    [`${BASE}/catalog/assets/index.json`]: { assets: INDEX.assets.map(a => a.id === 'acme/tokens/brand' ? { ...a, checksum: 'sha256-def' } : a) },
  }));
  assert.equal(await refreshHostedDesignSystem(r.host as unknown as Parameters<typeof refreshHostedDesignSystem>[0], rec.id, { force: true }), 'updated');
  const after = await r.registry.get('acme');
  assert.equal(after?.source.kind === 'hosted' ? after.source.checksum : null, 'sha256-def');
  const head = JSON.parse(await (await r.assets._getBlob('user/ds/acme/tokens/brand'))!.text());
  assert.equal(head.color.brand.jungle.$value, '#123456');
  // Away: the copy on the device stands, nothing is marked stale.
  stubFetch({});
  assert.equal(await refreshHostedDesignSystem(r.host as unknown as Parameters<typeof refreshHostedDesignSystem>[0], rec.id, { force: true }), 'unreachable');
  const away = (await r.registry.get('acme'))!.source;
  assert.equal(away.kind === 'hosted' ? away.stale : null, false);
});

test('a change that cannot be brought down marks the record stale; checkHostedDesignSystems visits every hosted record', async () => {
  const r = await rig();
  stubFetch(routes());
  const rec = await addHostedDesignSystem(r.host as unknown as Parameters<typeof addHostedDesignSystem>[0], BASE);
  stubFetch({
    [`${BASE}/api/v1/instance`]: manifest({ brand: { profile: null, label: 'Acme', version: null, checksum: 'sha256-zzz', locked: true, packUrl: null } }),
    // the catalog is gone: the change is seen, the download fails
  });
  const outcomes = await checkHostedDesignSystems(r.host as unknown as Parameters<typeof checkHostedDesignSystems>[0], { force: true });
  assert.deepEqual(outcomes, { [rec.id]: 'stale' });
  const after = await r.registry.get('acme');
  assert.equal(after?.source.kind === 'hosted' ? after.source.stale : null, true);
  // The material on the device is untouched.
  const head = JSON.parse(await (await r.assets._getBlob('user/ds/acme/tokens/brand'))!.text());
  assert.equal(head.color.brand.jungle.$value, '#30ba78');
});
