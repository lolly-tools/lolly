// SPDX-License-Identifier: MPL-2.0
/**
 * Brand-pack round-trip tests: export on one in-memory install, import on a
 * fresh one, and the refusal paths (not-a-pack, future minReader, corruption).
 * Run directly:  node --test shells/web/src/brand-transfer.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { exportBrandPack, importBrandPack, BRAND_FORMAT } from './brand-transfer.ts';
import type { BrandTransferHost } from './brand-transfer.ts';
import { USER_FONT_PREFIX } from './user-fonts.ts';
import { createAssetsAPI } from './bridge/assets.ts';
import { createTokensAPI, USER_TOKENS_ID } from './bridge/tokens.ts';
import { createDesignSystemRegistry, type RegistryDb } from './lib/design-system/registry.ts';
import { createDesignSystem } from './lib/design-system/manage.ts';
import { readVersionIndex, withVersionIndex } from './lib/design-system/versions.ts';
import { readDesignSystemIdentity } from '../../../engine/src/design-system.ts';

function memoryHost(): BrandTransferHost & { store: Map<string, any> } {
  const store = new Map<string, any>();
  return {
    store,
    assets: {
      async _uploadUserAsset(record: any) { store.set(record.id, record); },
      async _deleteUserAsset(id: string) { store.delete(id); },
      async _exportUserAssets() { return [...store.values()]; },
      async _getBlob(id: string) { return store.get(id)?.blob ?? null; },
      // Brand discovery fallback - these tests always install user tokens.
      async _findMetaByType() { return null; },
    } as BrandTransferHost['assets'],
    profile: { async get() { return { firstname: 'Bilbo' }; } },
  };
}

function memoryStorage(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    dump: () => Object.fromEntries(m),
  };
}

const TOKENS = {
  color: { semantic: { primary: { $type: 'color', $value: '#4f83cc' } } },
  font: { brand: { $type: 'fontFamily', $value: ['Inter'] } },
};

function firstZipEntryName(bytes: Uint8Array): string {
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04], 'ZIP begins with a local-file header');
  const nameLength = bytes[26]! | (bytes[27]! << 8);
  return new TextDecoder().decode(bytes.slice(30, 30 + nameLength));
}

async function seededHost() {
  const host = memoryHost();
  await host.assets._uploadUserAsset({
    id: 'user/tokens/brand', type: 'tokens', format: 'json',
    blob: new Blob([JSON.stringify(TOKENS)], { type: 'application/json' }),
  });
  await host.assets._uploadUserAsset({
    id: `${USER_FONT_PREFIX}inter/0`, type: 'font', format: 'woff2',
    blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'font/woff2' }),
    version: '2026-07-09',
    meta: { family: 'Inter', weight: '100 900', style: 'normal', subset: 'latin', unicodeRange: 'U+0000-00FF' },
  });
  await host.assets._uploadUserAsset({
    id: `${USER_FONT_PREFIX}inter/1`, type: 'font', format: 'woff2',
    blob: new Blob([new Uint8Array([5, 6, 7, 8])], { type: 'font/woff2' }),
    meta: { family: 'Inter', weight: '100 900', style: 'normal', subset: 'latin-ext' },
  });
  // A user image that must NOT travel in a brand pack.
  await host.assets._uploadUserAsset({
    id: 'user/upload/1', type: 'raster', format: 'png',
    blob: new Blob([new Uint8Array(16)], { type: 'image/png' }),
  });
  return host;
}

test('round-trip: tokens + fonts + theme land intact on a fresh install', async () => {
  const src = await seededHost();
  const { blob, filename, summary } = await exportBrandPack(
    { host: src, storage: memoryStorage({ theme: 'dark' }) });
  assert.equal(summary.tokens, true);
  assert.equal(summary.fontFamilies, 1);
  assert.equal(summary.fontFiles, 2);
  assert.equal(summary.prefs, 1);
  assert.match(filename, /^LollyBrand-Bilbo-\d{4}-\d{2}-\d{2}\.lolly$/);
  assert.equal(blob.type, 'application/vnd.lolly+zip');

  const exportedBytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(firstZipEntryName(exportedBytes), 'manifest.json', 'streaming preflight can identify the pack immediately');

  const dst = memoryHost();
  const storage = memoryStorage();
  const imported = await importBrandPack({ host: dst, storage }, exportedBytes);
  assert.equal(imported.tokens, true);
  assert.equal(imported.fontFiles, 2);
  assert.equal(imported.fontFamilies, 1);
  assert.equal(imported.failedFonts, 0);
  assert.equal(imported.skipped, 0);
  assert.equal(storage.dump().theme, 'dark');

  const doc = JSON.parse(await dst.store.get('user/tokens/brand').blob.text());
  assert.deepEqual(doc.font.brand.$value, ['Inter']);
  const face = dst.store.get(`${USER_FONT_PREFIX}inter/0`);
  assert.equal(face.meta.unicodeRange, 'U+0000-00FF');
  assert.deepEqual(new Uint8Array(await face.blob.arrayBuffer()), new Uint8Array([1, 2, 3, 4]));
  assert.equal(dst.store.has('user/upload/1'), false); // images stay personal
});

test('logos round-trip: default keeps flat names, identities get <identity>__<variant>', async () => {
  const src = await seededHost();
  // As installLogo writes them: a canonical slot, a labelled custom variant
  // (both default identity) and a second-identity mark.
  await src.assets._uploadUserAsset({
    id: 'user/logo/horizontal-primary', type: 'vector', format: 'svg',
    blob: new Blob([new Uint8Array([10, 11])], { type: 'image/svg+xml' }),
    meta: { format: 'svg', variant: 'horizontal-primary', identity: 'default', kind: 'logo' },
  });
  await src.assets._uploadUserAsset({
    id: 'user/logo/crest', type: 'raster', format: 'png',
    blob: new Blob([new Uint8Array([12, 13])], { type: 'image/png' }),
    meta: { format: 'png', variant: 'crest', identity: 'default', label: 'Crest mark', kind: 'logo' },
  });
  await src.assets._uploadUserAsset({
    id: 'user/logo/acme/icon', type: 'raster', format: 'png',
    blob: new Blob([new Uint8Array([14, 15])], { type: 'image/png' }),
    meta: { format: 'png', variant: 'icon', identity: 'acme', label: 'Acme icon', kind: 'logo' },
  });

  const { blob, summary } = await exportBrandPack({ host: src, storage: memoryStorage() });
  assert.equal(summary.logos, 3);
  const { unzipSync } = await import('fflate');
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  assert.ok(files['logos/horizontal-primary.svg'], 'canonical slot keeps the flat name');
  assert.ok(files['logos/crest.png'], 'custom default-identity variant keeps the flat name');
  assert.ok(files['logos/acme__icon.png'], 'second identity is namespaced');

  const dst = memoryHost();
  const imported = await importBrandPack({ host: dst, storage: memoryStorage() }, await blob.arrayBuffer());
  assert.equal(imported.logos, 3);
  assert.equal(imported.skipped, 0, 'logos/ entries are known parts');
  assert.equal(dst.store.get('user/logo/crest').meta.label, 'Crest mark', 'label travels on the row');
  const icon = dst.store.get('user/logo/acme/icon');
  assert.equal(icon.meta.identity, 'acme');
  assert.deepEqual(new Uint8Array(await icon.blob.arrayBuffer()), new Uint8Array([14, 15]));
});

test('an old pack (flat logo names, no identity meta) still imports verbatim', async () => {
  // Hand-built to the pre-identity writer's shape: `logos/<variant>.<ext>`
  // rows whose meta has no identity/label fields.
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const zipBytes = zipSync({
    'manifest.json': strToU8(JSON.stringify({ format: BRAND_FORMAT, formatVersion: 1, minReader: 1 })),
    'logos.json': strToU8(JSON.stringify([{
      id: 'user/logo/horizontal-primary', format: 'png',
      file: 'logos/horizontal-primary.png', mime: 'image/png',
      meta: { format: 'png', variant: 'horizontal-primary', kind: 'logo' },
    }])),
    'logos/horizontal-primary.png': bytes,
  });
  const dst = memoryHost();
  const summary = await importBrandPack({ host: dst, storage: memoryStorage() }, zipBytes);
  assert.equal(summary.logos, 1);
  assert.equal(summary.skipped, 0);
  const mark = dst.store.get('user/logo/horizontal-primary');
  assert.equal(mark.meta.variant, 'horizontal-primary');
  assert.deepEqual(new Uint8Array(await mark.blob.arrayBuffer()), bytes);
});

test('a data backup (different format) is refused with a clear message', async () => {
  const zipBytes = zipSync({ 'manifest.json': strToU8(JSON.stringify({ format: 'lolly-backup' })) });
  await assert.rejects(
    importBrandPack({ host: memoryHost(), storage: memoryStorage() }, zipBytes),
    /doesn't look like a Lolly brand file/,
  );
});

test('a future minReader is refused (update-first message)', async () => {
  const zipBytes = zipSync({
    'manifest.json': strToU8(JSON.stringify({ format: BRAND_FORMAT, formatVersion: 99, minReader: 99 })),
  });
  await assert.rejects(
    importBrandPack({ host: memoryHost(), storage: memoryStorage() }, zipBytes),
    /newer version of the app/,
  );
});

test('a corrupted part fails its integrity check loudly', async () => {
  const src = await seededHost();
  const { blob } = await exportBrandPack({ host: src, storage: memoryStorage() });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  // Flip one byte inside a STORED (level 0) font entry - the woff2 payload.
  const marker = new TextEncoder().encode('fonts/inter-0.woff2');
  const at = bytes.findIndex((_, i) => marker.every((b, j) => bytes[i + j] === b));
  assert.ok(at > 0, 'font entry present in the zip');
  const flipAt = at + marker.length + 2; // a payload byte just past the local header name
  bytes[flipAt] = (bytes[flipAt] ?? 0) ^ 0xff;
  await assert.rejects(
    importBrandPack({ host: memoryHost(), storage: memoryStorage() }, bytes),
    /corrupted|unzipped|integrity/i,
  );
});

test('unknown parts from a newer writer are counted, not dropped silently', async () => {
  const src = await seededHost();
  const { blob } = await exportBrandPack({ host: src, storage: memoryStorage() });
  // Re-zip with an extra part a future writer might add.
  const { unzipSync } = await import('fflate');
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']!));
  delete manifest.integrity; // adding a part would break the map; a newer writer re-signs
  files['manifest.json'] = strToU8(JSON.stringify(manifest));
  files['motion.json'] = strToU8('{}');
  const rezip = zipSync(files);
  const summary = await importBrandPack({ host: memoryHost(), storage: memoryStorage() }, rezip);
  assert.equal(summary.skipped, 1);
});

// ── Targeted import and export (plans/186 section 3.6) ───────────────────────
// A pack is always written in the portable `user/…` shape. Naming a target on
// import re-keys it into that record's namespace and rewrites the references
// with it; naming a system on export normalises the ids back out again. These
// compose the REAL assets bridge and the REAL registry over one in-memory idb,
// the way tokens-registry.test.ts and lib/design-system/manage.test.ts do, so
// the store split and the id grammar are exercised rather than restated.

const CATALOG_DOC = { color: { brand: { ink: { $type: 'color', $value: '#1d1d1d' } } } };
const LOGO_ID = 'user/logo/horizontal-primary';
const FONT_ID = `${USER_FONT_PREFIX}inter/0`;
const blobOf = (doc: unknown) => new Blob([JSON.stringify(doc)], { type: 'application/json' });

/** The head the source device publishes from: a logo token pointing at a stored
 *  logo row, and one published version pinning that same row. */
const SOURCE_HEAD = withVersionIndex({
  color: { semantic: { primary: { $type: 'color', $value: '#4f83cc' } } },
  font: { brand: { $type: 'fontFamily', $value: ['Inter'] } },
  asset: { logo: { 'horizontal-primary': { $type: 'asset', $value: LOGO_ID } } },
}, {
  versions: [{
    slug: 'v1', label: 'V1', date: '2026-01-01', checksum: 'c0ffee',
    assets: [{ id: LOGO_ID, version: '1.0.0', sha256: 'deadbeef' }],
  }],
  active: null,
});
const SOURCE_V1 = { asset: { logo: { 'horizontal-primary': { $type: 'asset', $value: LOGO_ID } } } };

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

/** A device with the shipped catalog tokens and a registry, holding no design
 *  system of its own yet. */
async function registryRig() {
  const db = memDb();
  await db.put('asset-meta', {
    id: 'lolly/tokens/brand', type: 'tokens', name: 'Lolly Starter Tokens', version: '1.0.0',
    formats: [{ format: 'json', url: '/catalog/assets/lolly/tokens/brand.json' }],
  });
  await db.put('asset-blob', blobOf(CATALOG_DOC), 'lolly/tokens/brand:json:1.0.0');
  const assets = createAssetsAPI(db as unknown as Parameters<typeof createAssetsAPI>[0]);
  const registry = createDesignSystemRegistry(db as unknown as RegistryDb, {
    catalogTokens: async () => ({ id: 'lolly/tokens/brand', name: 'Lolly Starter Tokens' }),
    legacyHead: async () => assets._getUserRecord?.(USER_TOKENS_ID) ?? null,
  });
  const host = { assets, designSystems: registry } as {
    assets: typeof assets; designSystems: typeof registry; tokens?: ReturnType<typeof createTokensAPI>;
  };
  host.tokens = createTokensAPI(host as unknown as Parameters<typeof createTokensAPI>[0]);
  await registry.ensure();
  return { db, assets, registry, host: host as unknown as BrandTransferHost };
}

/** One pack carrying a font, a logo, a head that references the logo, and a
 *  published version that pins it - exported the ordinary (untargeted) way, so
 *  every id in it is in the portable legacy shape. */
async function sourcePack(): Promise<ArrayBuffer> {
  const src = memoryHost();
  await src.assets._uploadUserAsset({ id: USER_TOKENS_ID, type: 'tokens', format: 'json', blob: blobOf(SOURCE_HEAD) });
  await src.assets._uploadUserAsset({ id: `${USER_TOKENS_ID}/v1`, type: 'tokens', format: 'json', blob: blobOf(SOURCE_V1), meta: { kind: 'design-version', slug: 'v1' } });
  await src.assets._uploadUserAsset({
    id: FONT_ID, type: 'font', format: 'woff2',
    blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'font/woff2' }), meta: { family: 'Inter' },
  });
  await src.assets._uploadUserAsset({
    id: LOGO_ID, type: 'vector', format: 'svg',
    blob: new Blob([new Uint8Array([10, 11])], { type: 'image/svg+xml' }),
    meta: { format: 'svg', variant: 'horizontal-primary', identity: 'default', kind: 'logo' },
  });
  const { blob, summary } = await exportBrandPack({ host: src, storage: memoryStorage({ theme: 'dark' }) });
  assert.equal(summary.versions, 1, 'the source pack carries its published version');
  return blob.arrayBuffer();
}

const docAt = async (assets: { _getBlob(id: string): Promise<Blob | null> }, id: string) => {
  const blob = await assets._getBlob(id);
  assert.ok(blob, `expected an asset at ${id}`);
  return JSON.parse(await blob!.text());
};

test('a targeted import re-keys the pack into the named system, references and all', async () => {
  const bytes = await sourcePack();
  const r = await registryRig();
  const acme = await createDesignSystem(
    r.host as unknown as Parameters<typeof createDesignSystem>[0], { label: 'Acme' });
  assert.equal(acme.ns, 'user/ds/acme/');

  const storage = memoryStorage();
  const imported = await importBrandPack({ host: r.host, storage }, bytes, { target: { system: 'acme' } });
  assert.equal(imported.tokens, true);
  assert.equal(imported.fontFiles, 1);
  assert.equal(imported.logos, 1);
  assert.equal(imported.versions, 1);

  // The material sits in the record's namespace...
  assert.ok(await r.assets._getBlob('user/ds/acme/fonts/inter/0'));
  assert.ok(await r.assets._getBlob('user/ds/acme/logo/horizontal-primary'));
  // ...and the legacy one is untouched, records included.
  assert.equal(await r.assets._getBlob(FONT_ID), null);
  assert.equal(await r.assets._getBlob(LOGO_ID), null);
  assert.equal(await r.assets._getBlob(USER_TOKENS_ID), null);
  assert.equal(await r.registry.get('default'), null);

  // The head: at the record's id, carrying the record's identity, with the logo
  // token and the pinned version id both pointing at the re-keyed row.
  const head = await docAt(r.assets, 'user/ds/acme/tokens/brand');
  assert.deepEqual(readDesignSystemIdentity(head), { id: 'acme', label: 'Acme' });
  assert.equal(head.asset.logo['horizontal-primary'].$value, 'user/ds/acme/logo/horizontal-primary');
  const index = readVersionIndex(head);
  assert.deepEqual(index.versions.map(v => v.slug), ['v1']);
  assert.equal(index.versions[0]!.assets![0]!.id, 'user/ds/acme/logo/horizontal-primary');

  // The version payload is re-keyed too, and it is a sibling of the new head.
  const v1 = await docAt(r.assets, 'user/ds/acme/tokens/brand/v1');
  assert.equal(v1.asset.logo['horizontal-primary'].$value, 'user/ds/acme/logo/horizontal-primary');

  // The theme comes back for the caller to store on the record; nothing was
  // written to storage, because the system is not the active one.
  assert.equal(imported.theme, 'dark');
  assert.deepEqual(storage.dump(), {});
});

test('an untargeted import of the same pack still writes the legacy ids', async () => {
  const bytes = await sourcePack();
  const r = await registryRig();
  const storage = memoryStorage();
  const imported = await importBrandPack({ host: r.host, storage }, bytes);
  assert.equal(imported.tokens, true);
  assert.equal(imported.versions, 1);
  assert.equal(imported.theme, undefined, 'the theme is applied, not handed back');
  assert.equal(storage.dump().theme, 'dark');

  const ids = (await r.assets._exportUserAssets()).map(row => row.id).sort();
  assert.deepEqual(ids, [
    'user/fonts/inter/0', 'user/logo/horizontal-primary',
    'user/tokens/brand', 'user/tokens/brand/v1',
  ]);
  const head = await docAt(r.assets, USER_TOKENS_ID);
  assert.equal(head.asset.logo['horizontal-primary'].$value, LOGO_ID);
  assert.equal(readVersionIndex(head).versions[0]!.assets![0]!.id, LOGO_ID);
});

test('exporting a namespaced system normalises its ids back, and a round trip lands in the next one', async () => {
  const acmeRig = await registryRig();
  await createDesignSystem(
    acmeRig.host as unknown as Parameters<typeof createDesignSystem>[0], { label: 'Acme' });
  await importBrandPack(
    { host: acmeRig.host, storage: memoryStorage() }, await sourcePack(), { target: { system: 'acme' } });

  const out = await exportBrandPack(
    { host: acmeRig.host, storage: memoryStorage() }, { system: 'acme' });
  assert.equal(out.summary.fontFiles, 1);
  assert.equal(out.summary.logos, 1);
  assert.equal(out.summary.versions, 1);

  const { unzipSync } = await import('fflate');
  const files = unzipSync(new Uint8Array(await out.blob.arrayBuffer()));
  const part = (path: string) => JSON.parse(new TextDecoder().decode(files[path]!));
  assert.equal(part('manifest.json').label, 'Acme', 'the record names its own pack');
  assert.deepEqual(part('fonts.json').map((row: { id: string }) => row.id), [FONT_ID]);
  assert.deepEqual(part('logos.json').map((row: { id: string }) => row.id), [LOGO_ID]);
  assert.ok(files['fonts/inter-0.woff2'], 'the file names follow the normalised ids');
  assert.ok(files['logos/horizontal-primary.svg']);
  assert.equal(part('tokens.json').asset.logo['horizontal-primary'].$value, LOGO_ID);
  assert.equal(part('versions/v1.json').asset.logo['horizontal-primary'].$value, LOGO_ID);
  assert.equal(part('versions.json').list[0].assets[0].id, LOGO_ID);

  // …and the same pack re-keys into whichever system it is imported into next.
  const betaRig = await registryRig();
  await createDesignSystem(
    betaRig.host as unknown as Parameters<typeof createDesignSystem>[0], { label: 'Beta' });
  const imported = await importBrandPack(
    { host: betaRig.host, storage: memoryStorage() }, await out.blob.arrayBuffer(), { target: { system: 'beta' } });
  assert.equal(imported.versions, 1);
  assert.ok(await betaRig.assets._getBlob('user/ds/beta/fonts/inter/0'));
  assert.ok(await betaRig.assets._getBlob('user/ds/beta/logo/horizontal-primary'));
  const head = await docAt(betaRig.assets, 'user/ds/beta/tokens/brand');
  assert.deepEqual(readDesignSystemIdentity(head), { id: 'beta', label: 'Beta' });
  assert.equal(head.asset.logo['horizontal-primary'].$value, 'user/ds/beta/logo/horizontal-primary');
  assert.equal(readVersionIndex(head).versions[0]!.assets![0]!.id, 'user/ds/beta/logo/horizontal-primary');
  const v1 = await docAt(betaRig.assets, 'user/ds/beta/tokens/brand/v1');
  assert.equal(v1.asset.logo['horizontal-primary'].$value, 'user/ds/beta/logo/horizontal-primary');
});

test('a targeted import names the system it cannot find', async () => {
  const r = await registryRig();
  await assert.rejects(
    importBrandPack({ host: r.host, storage: memoryStorage() }, await sourcePack(), { target: { system: 'nope' } }),
    /no design system .nope./,
  );
});
