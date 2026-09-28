// SPDX-License-Identifier: MPL-2.0
/**
 * Logos belong to the design system they were uploaded in (plans/186 section 6).
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/brand-logos-per-system.test.ts
 *
 * The REAL assets bridge, the REAL registry and the REAL tokens bridge over one
 * map-backed store (the rig lib/design-system/manage.test.ts uses), so the id a logo is
 * stored under, the token that records it and the bytes a render resolves are
 * read the way the app reads them. The edge cases a review found (published
 * versions, restores, removals, a full disk) are in
 * design-system/logo-ownership.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { createAssetsAPI } from '../bridge/assets.ts';
import { createTokensAPI, installUserTokens, USER_TOKENS_ID } from '../bridge/tokens.ts';
import { createPinPreserver } from '../bridge/version-assets.ts';
import { createDesignSystemRegistry, type RegistryDb } from './design-system/registry.ts';
import { createDesignSystem, removeDesignSystem } from './design-system/manage.ts';
import { ensureOwnLogos } from './design-system/logo-ownership.ts';
import { readVersionIndex, withVersionIndex } from './design-system/versions.ts';
import { installLogo, listLogos, removeLogo } from './brand-logos.ts';
import { exportBrandPack, importBrandPack } from '../brand-transfer.ts';

const CATALOG_DOC = { color: { brand: { ink: { $type: 'color', $value: '#1d1d1d' } } } };
const blobOf = (doc: unknown) => new Blob([JSON.stringify(doc)], { type: 'application/json' });

/** The idb slice the assets bridge, its history and the registry read. */
function memDb() {
  const stores = new Map<string, Map<IDBValidKey, unknown>>();
  const of = (s: string) => {
    if (!stores.has(s)) stores.set(s, new Map());
    return stores.get(s) as Map<IDBValidKey, unknown>;
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
          add: (v: unknown, k?: IDBValidKey) => db.put(s, v, k),
          delete: (k: IDBValidKey) => db.delete(s, k), getAll: () => db.getAll(s), getAllKeys: () => db.getAllKeys(s),
          clear: () => db.clear(s), count: () => db.count(s),
          openCursor: async () => {
            const vals = [...of(s).values()];
            let i = 0;
            const at = (): { value: unknown; continue: () => Promise<unknown> } | null =>
              (i < vals.length ? { value: vals[i++], continue: async () => at() } : null);
            return at();
          },
        }),
        store: null as unknown, done: Promise.resolve(), abort() {},
      };
      tx.store = tx.objectStore(list[0] as string);
      return tx;
    },
  };
  return db;
}

/** A device holding the shipped catalog tokens and a registry. `pins` puts the
 *  real copy-on-write pin preserver behind every upload and delete, as the web
 *  bridge does. */
async function logoRig(opts: { pins?: boolean } = {}) {
  const db = memDb();
  await db.put('asset-meta', { id: 'lolly/tokens/brand', type: 'tokens', name: 'Lolly Starter Tokens', version: '1.0.0', formats: [{ format: 'json', url: '/x.json' }] });
  await db.put('asset-blob', blobOf(CATALOG_DOC), 'lolly/tokens/brand:json:1.0.0');
  let preserve: ((id: string, o?: { reclaiming?: boolean }) => Promise<void>) | null = null;
  const assets = createAssetsAPI(db as unknown as Parameters<typeof createAssetsAPI>[0], opts.pins
    ? { preservePinned: (id, o) => preserve?.(id, o) ?? Promise.resolve() }
    : {});
  const registry = createDesignSystemRegistry(db as unknown as RegistryDb, {
    catalogTokens: async () => ({ id: 'lolly/tokens/brand', name: 'Lolly Starter Tokens' }),
    legacyHead: async () => assets._getUserRecord?.(USER_TOKENS_ID) ?? null,
  });
  const host = { assets, designSystems: registry } as {
    assets: typeof assets; designSystems: typeof registry; tokens: ReturnType<typeof createTokensAPI>;
  };
  host.tokens = createTokensAPI(host as unknown as Parameters<typeof createTokensAPI>[0]);
  if (opts.pins) preserve = createPinPreserver(host as unknown as Parameters<typeof createPinPreserver>[0]);
  await registry.ensure();
  /** The pointer move and the cache drop a real switch starts with (switch.ts step 1). */
  const activate = async (id: string) => { await registry.setActive(id); host.tokens.bust({ lock: true }); };
  const logoHost = host as unknown as Parameters<typeof installLogo>[0];
  const manageHost = host as unknown as Parameters<typeof createDesignSystem>[0];
  const ownHost = host as unknown as Parameters<typeof ensureOwnLogos>[0];
  const tokensHost = host as unknown as Parameters<typeof installUserTokens>[0];
  return { db, assets, registry, host, logoHost, manageHost, ownHost, tokensHost, activate };
}

const rig = logoRig;

const svg = (fill: string, name: string): File =>
  new File([`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="${fill}"/></svg>`], name, { type: 'image/svg+xml' });

/** The bytes a render of the ACTIVE system draws for a slot: the token, then the asset. */
async function drawnBytes(r: Awaited<ReturnType<typeof rig>>, variant: string): Promise<string | null> {
  const id = await r.host.tokens.resolve(`{asset.logo.${variant}}`);
  if (typeof id !== 'string' || id.startsWith('{')) return null;
  const blob = await r.assets._getBlob(id);
  return blob ? blob.text() : null;
}

test('two design systems filling the same slot keep their own logo', async () => {
  const r = await rig();
  await createDesignSystem(r.manageHost, { label: 'Alpha' });
  await createDesignSystem(r.manageHost, { label: 'Beta' });

  await r.activate('alpha');
  await installLogo(r.logoHost, 'horizontal-primary', svg('#ff0000', 'alpha.svg'));
  const alphaBytes = await drawnBytes(r, 'horizontal-primary');
  assert.match(alphaBytes ?? '', /#ff0000/, 'Alpha draws its own upload');

  await r.activate('beta');
  await installLogo(r.logoHost, 'horizontal-primary', svg('#0000ff', 'beta.svg'));
  assert.match(await drawnBytes(r, 'horizontal-primary') ?? '', /#0000ff/, 'Beta draws its own upload');

  // Back to Alpha: its token must still reach Alpha's bytes, not Beta's.
  await r.activate('alpha');
  assert.match(await drawnBytes(r, 'horizontal-primary') ?? '', /#ff0000/,
    'Alpha still draws the red logo after Beta filled the same slot');

  // The Logos room lists the active system's marks, and only those.
  const alphaList = await listLogos(r.logoHost);
  for (const s of alphaList) URL.revokeObjectURL(s.url);
  assert.equal(alphaList.length, 1, 'Alpha lists one logo');
  assert.match(await (await r.assets._getBlob(alphaList[0]!.assetId))!.text(), /#ff0000/, 'and it is Alpha’s');

  await r.activate('beta');
  const betaList = await listLogos(r.logoHost);
  for (const s of betaList) URL.revokeObjectURL(s.url);
  assert.equal(betaList.length, 1, 'Beta lists one logo');
  assert.match(await (await r.assets._getBlob(betaList[0]!.assetId))!.text(), /#0000ff/, 'and it is Beta’s');
});

// ── Helpers for the tests below ───────────────────────────────────────────────

type R = Awaited<ReturnType<typeof rig>>;
const text = async (r: R, id: string): Promise<string | null> => {
  const blob = await r.assets._getBlob(id);
  return blob ? blob.text() : null;
};
const headOf = async (r: R, id: string): Promise<any> => JSON.parse((await text(r, id))!);
const ids = async (r: R): Promise<string[]> => (await r.assets._exportUserAssets()).map(row => row.id).sort();
const listed = async (r: R): Promise<string[]> => {
  const slots = await listLogos(r.logoHost);
  for (const s of slots) URL.revokeObjectURL(s.url);
  return slots.map(s => s.assetId).sort();
};
const storage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
};
const logoToken = (id: string) => ({ $type: 'asset', $value: id });
/** A logo row the way the pre-fix installLogo wrote it: always the legacy id. */
async function legacyLogo(r: R, variant: string, fill: string): Promise<string> {
  const id = `user/logo/${variant}`;
  await r.assets._uploadUserAsset({
    id, type: 'vector', format: 'svg', blob: svg(fill, `${variant}.svg`),
    meta: { format: 'svg', variant, identity: 'default', kind: 'logo' },
  });
  return id;
}

// ── The Logos room lists the active system's set ──────────────────────────────

test('listLogos shows the active system its own marks, including a targeted import’s, and nobody else’s', async () => {
  const r = await rig();
  await createDesignSystem(r.manageHost, { label: 'Alpha' });
  await createDesignSystem(r.manageHost, { label: 'Beta' });
  await r.activate('alpha');
  await installLogo(r.logoHost, 'horizontal-primary', svg('#ff0000', 'a.svg'));
  // A row a targeted .lolly import writes straight into the namespace.
  await r.assets._uploadUserAsset({ id: 'user/ds/alpha/logo/vertical-mono', type: 'vector', format: 'svg', blob: svg('#111111', 'v.svg'), meta: { kind: 'logo' } });
  // A default-system row nobody else should see.
  await legacyLogo(r, 'horizontal-mono', '#00ff00');

  assert.deepEqual(await listed(r), ['user/ds/alpha/logo/horizontal-primary', 'user/ds/alpha/logo/vertical-mono']);
  await r.activate('beta');
  assert.deepEqual(await listed(r), [], 'Beta has none of its own');
  await r.activate('shipped');
  assert.deepEqual(await listed(r), ['user/logo/horizontal-mono'], 'the legacy rows are the default system’s');
});

test('placing a mark does not rename the design system', async () => {
  const r = await rig();
  await createDesignSystem(r.manageHost, { label: 'Alpha' });
  await r.activate('alpha');
  await installLogo(r.logoHost, 'horizontal-primary', svg('#ff0000', 'a.svg'));
  await removeLogo(r.logoHost, 'horizontal-primary');
  assert.equal((await r.registry.get('alpha'))!.label, 'Alpha');
});

test('removeLogo removes the active system’s mark and leaves the same slot in another system', async () => {
  const r = await rig();
  await createDesignSystem(r.manageHost, { label: 'Alpha' });
  await createDesignSystem(r.manageHost, { label: 'Beta' });
  await r.activate('alpha');
  await installLogo(r.logoHost, 'horizontal-primary', svg('#ff0000', 'a.svg'));
  await r.activate('beta');
  await installLogo(r.logoHost, 'horizontal-primary', svg('#0000ff', 'b.svg'));
  await removeLogo(r.logoHost, 'horizontal-primary');
  assert.equal(await r.assets._getBlob('user/ds/beta/logo/horizontal-primary'), null);
  assert.equal((await headOf(r, 'user/ds/beta/tokens/brand')).asset?.logo?.['horizontal-primary'], undefined);
  await r.activate('alpha');
  assert.match(await drawnBytes(r, 'horizontal-primary') ?? '', /#ff0000/, 'Alpha keeps its mark');
});

// ── The repair pass for devices that already share rows ───────────────────────

/** A device in the state the old installLogo left behind: a default system, and
 *  two named systems whose heads point at legacy rows - one row shared by all
 *  three (the collision already happened: it holds Beta's bytes), one only
 *  Alpha's. Alpha also published a version that pins the shared row. */
async function sharedRig() {
  const r = await rig();
  const shared = await legacyLogo(r, 'horizontal-primary', '#0000ff');
  const own = await legacyLogo(r, 'vertical-mono', '#ff00ff');
  const defaultHead = { color: { x: 1 }, asset: { logo: { 'horizontal-primary': logoToken(shared) } } };
  await installUserTokens(r.host as unknown as Parameters<typeof installUserTokens>[0], defaultHead);
  assert.equal(await r.registry.activeId(), 'default');
  await createDesignSystem(r.manageHost, { label: 'Alpha' });
  await createDesignSystem(r.manageHost, { label: 'Beta' });
  const ledger = { versions: [{ slug: 'v1', label: 'V1', date: '2026-01-01', checksum: 'c0ffee', assets: [{ id: shared, version: '1.0.0', sha256: 'deadbeef' }] }], active: null };
  const alphaDoc = { color: { x: 2 }, asset: { logo: { 'horizontal-primary': logoToken(shared), 'vertical-mono': logoToken(own) } } };
  // Publish the way the studio does: the version payload first, then the head
  // whose version list includes v1.
  await installUserTokens(r.host as unknown as Parameters<typeof installUserTokens>[0], { asset: { logo: { 'horizontal-primary': logoToken(shared) } } }, { system: 'alpha', versionSlug: 'v1', allowVersionWrite: true });
  await installUserTokens(r.host as unknown as Parameters<typeof installUserTokens>[0], withVersionIndex(alphaDoc, ledger), { system: 'alpha' });
  await installUserTokens(r.host as unknown as Parameters<typeof installUserTokens>[0], { color: { x: 3 }, asset: { logo: { 'horizontal-primary': logoToken(shared) } } }, { system: 'beta' });
  return { r, shared, own };
}

test('the repair pass gives each named system its own copy and repoints only its head', async () => {
  const { r, shared, own } = await sharedRig();
  const defaultBefore = await text(r, USER_TOKENS_ID);
  const v1Before = await text(r, 'user/ds/alpha/tokens/brand/v1');

  const moved = await ensureOwnLogos(r.host as unknown as Parameters<typeof ensureOwnLogos>[0]);
  assert.equal(moved, 3, 'two references in Alpha, one in Beta');

  const alpha = await headOf(r, 'user/ds/alpha/tokens/brand');
  assert.equal(alpha.asset.logo['horizontal-primary'].$value, 'user/ds/alpha/logo/horizontal-primary');
  assert.equal(alpha.asset.logo['vertical-mono'].$value, 'user/ds/alpha/logo/vertical-mono');
  assert.equal(alpha.color.x, 2, 'nothing else in the head moved');
  const beta = await headOf(r, 'user/ds/beta/tokens/brand');
  assert.equal(beta.asset.logo['horizontal-primary'].$value, 'user/ds/beta/logo/horizontal-primary');

  // The collision case: both copies hold the CURRENT bytes of the shared row.
  assert.match(await text(r, 'user/ds/alpha/logo/horizontal-primary') ?? '', /#0000ff/);
  assert.match(await text(r, 'user/ds/beta/logo/horizontal-primary') ?? '', /#0000ff/);
  assert.match(await text(r, 'user/ds/alpha/logo/vertical-mono') ?? '', /#ff00ff/);
  // The copy keeps what the Logos room reads off the row.
  const copy = await r.assets._getUserRecord('user/ds/alpha/logo/vertical-mono');
  assert.equal(copy?.meta?.variant, 'vertical-mono');
  assert.equal(copy?.format, 'svg');

  // The legacy rows stay, the default system is untouched, and so is the
  // published version: its payload, and its pin in the version list, still point at the legacy row.
  assert.ok(await r.assets._getBlob(shared));
  assert.ok(await r.assets._getBlob(own));
  assert.equal(await text(r, USER_TOKENS_ID), defaultBefore);
  assert.equal(await text(r, 'user/ds/alpha/tokens/brand/v1'), v1Before);
  assert.equal(readVersionIndex(alpha).versions[0]!.assets![0]!.id, shared);

  // From here an upload in one system cannot reach the other.
  await r.activate('beta');
  await installLogo(r.logoHost, 'horizontal-primary', svg('#00aa00', 'b2.svg'));
  await r.activate('alpha');
  assert.match(await drawnBytes(r, 'horizontal-primary') ?? '', /#0000ff/);
  await r.activate('default');
  assert.match(await drawnBytes(r, 'horizontal-primary') ?? '', /#0000ff/);
});

test('the repair pass is idempotent: a second run moves and writes nothing', async () => {
  const { r } = await sharedRig();
  const host = r.host as unknown as Parameters<typeof ensureOwnLogos>[0];
  await ensureOwnLogos(host);
  const rowsAfterFirst = await ids(r);
  const heads = await Promise.all(['user/ds/alpha/tokens/brand', 'user/ds/beta/tokens/brand', USER_TOKENS_ID].map(id => text(r, id)));
  // The asset history store, read directly: a second copy of the same bytes
  // would snapshot the first one here.
  const history = () => r.db.stores.get('user-asset-versions')?.size ?? 0;
  const historyBefore = history();

  assert.equal(await ensureOwnLogos(host), 0);
  assert.deepEqual(await ids(r), rowsAfterFirst);
  assert.deepEqual(await Promise.all(['user/ds/alpha/tokens/brand', 'user/ds/beta/tokens/brand', USER_TOKENS_ID].map(id => text(r, id))), heads);
  assert.equal(history(), historyBefore, 'no second copy in the asset history');

  // A pass whose head write was lost (the copies were written, the head still names
  // the legacy rows) finishes on the next run without writing the bytes again.
  await installUserTokens(r.host as unknown as Parameters<typeof installUserTokens>[0], { asset: { logo: { 'horizontal-primary': logoToken('user/logo/horizontal-primary') } } }, { system: 'beta' });
  assert.equal(await ensureOwnLogos(host), 1);
  assert.equal((await headOf(r, 'user/ds/beta/tokens/brand')).asset.logo['horizontal-primary'].$value, 'user/ds/beta/logo/horizontal-primary');
  assert.equal(history(), historyBefore, 'the copy already in place is not written twice');
});

test('the Logos room runs the repair before it lists, so a named system sees its borrowed marks as its own', async () => {
  const { r } = await sharedRig();
  await r.activate('alpha');
  assert.deepEqual(await listed(r), ['user/ds/alpha/logo/horizontal-primary', 'user/ds/alpha/logo/vertical-mono']);
  await r.activate('default');
  assert.deepEqual(await listed(r), ['user/logo/horizontal-primary', 'user/logo/vertical-mono'], 'the default system keeps its legacy ids');
});

test('a copy of a system gets its own logo rows', async () => {
  const r = await rig();
  await createDesignSystem(r.manageHost, { label: 'Alpha' });
  await r.activate('alpha');
  await installLogo(r.logoHost, 'horizontal-primary', svg('#ff0000', 'a.svg'));
  const copy = await createDesignSystem(r.manageHost, { label: 'Alpha copy', seedFrom: 'alpha' });
  const head = await headOf(r, copy.headId);
  assert.equal(head.asset.logo['horizontal-primary'].$value, `user/ds/${copy.id}/logo/horizontal-primary`);
  assert.match(await text(r, `user/ds/${copy.id}/logo/horizontal-primary`) ?? '', /#ff0000/);
  // Removing the original leaves the copy drawing its mark.
  await removeDesignSystem(r.manageHost, 'alpha');
  await r.activate(copy.id);
  assert.match(await drawnBytes(r, 'horizontal-primary') ?? '', /#ff0000/);
});

// ── Removing a system ─────────────────────────────────────────────────────────

test('removing a design system removes its logos and nothing else', async () => {
  const r = await rig();
  await legacyLogo(r, 'vertical-mono', '#333333');
  await installUserTokens(r.host as unknown as Parameters<typeof installUserTokens>[0], { asset: { logo: { 'vertical-mono': logoToken('user/logo/vertical-mono') } } });
  await createDesignSystem(r.manageHost, { label: 'Alpha' });
  await createDesignSystem(r.manageHost, { label: 'Beta' });
  await r.activate('alpha');
  await installLogo(r.logoHost, 'horizontal-primary', svg('#ff0000', 'a.svg'));
  await installLogo(r.logoHost, 'icon', svg('#ff8800', 'i.svg'), { identity: 'event' });
  await r.activate('beta');
  await installLogo(r.logoHost, 'horizontal-primary', svg('#0000ff', 'b.svg'));
  await r.assets._uploadUserAsset({ id: 'user/raster/1700000000000-photo', type: 'raster', format: 'png', blob: new Blob(['p'], { type: 'image/png' }) });

  const res = await removeDesignSystem(r.manageHost, 'alpha');
  assert.equal(res.deleted, 3, 'its head and its two marks');
  assert.deepEqual(await ids(r), [
    'user/ds/beta/logo/horizontal-primary', 'user/ds/beta/tokens/brand',
    'user/logo/vertical-mono', 'user/raster/1700000000000-photo', 'user/tokens/brand',
  ]);
});

test('removing the default system first hands a named system that still borrows its rows a copy', async () => {
  const r = await rig();
  const shared = await legacyLogo(r, 'horizontal-primary', '#0000ff');
  await installUserTokens(r.host as unknown as Parameters<typeof installUserTokens>[0], { asset: { logo: { 'horizontal-primary': logoToken(shared) } } });
  await createDesignSystem(r.manageHost, { label: 'Alpha' });
  await installUserTokens(r.host as unknown as Parameters<typeof installUserTokens>[0], { asset: { logo: { 'horizontal-primary': logoToken(shared) } } }, { system: 'alpha' });
  await removeDesignSystem(r.manageHost, 'default');
  assert.equal(await r.assets._getBlob(shared), null, 'the default system’s rows went with it');
  await r.activate('alpha');
  assert.match(await drawnBytes(r, 'horizontal-primary') ?? '', /#0000ff/, 'Alpha still draws the mark it borrowed');
});

// ── Brand packs ───────────────────────────────────────────────────────────────

const packParts = async (blob: Blob) => {
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  return { files, json: (path: string) => JSON.parse(new TextDecoder().decode(files[path]!)) };
};

test('an untargeted export of a named system carries its own logos in the portable shape, and an untargeted import lands them in the active system', async () => {
  const src = await rig();
  await createDesignSystem(src.manageHost, { label: 'Alpha' });
  await createDesignSystem(src.manageHost, { label: 'Beta' });
  await src.activate('beta');
  await installLogo(src.logoHost, 'horizontal-primary', svg('#0000ff', 'b.svg'));
  await src.activate('alpha');
  await installLogo(src.logoHost, 'horizontal-primary', svg('#ff0000', 'a.svg'));
  await installLogo(src.logoHost, 'icon', svg('#ff8800', 'i.svg'), { identity: 'event' });

  const out = await exportBrandPack({ host: src.host as never, storage: storage() });
  assert.equal(out.summary.logos, 2, 'Alpha’s two marks, not Beta’s');
  const { files, json } = await packParts(out.blob);
  assert.deepEqual(json('logos.json').map((row: { id: string }) => row.id).sort(), ['user/logo/event/icon', 'user/logo/horizontal-primary']);
  assert.match(new TextDecoder().decode(files['logos/horizontal-primary.svg']!), /#ff0000/);
  assert.equal(json('tokens.json').asset.logo['horizontal-primary'].$value, 'user/logo/horizontal-primary');
  assert.equal(json('tokens.json').asset.logo.event.icon.$value, 'user/logo/event/icon');

  // Into another device whose active system is a named one.
  const dst = await rig();
  await createDesignSystem(dst.manageHost, { label: 'Gamma' });
  await dst.activate('gamma');
  const imported = await importBrandPack({ host: dst.host as never, storage: storage() }, await out.blob.arrayBuffer());
  assert.equal(imported.logos, 2);
  assert.equal(await dst.assets._getBlob('user/logo/horizontal-primary'), null, 'nothing lands in the default system');
  const head = await headOf(dst, 'user/ds/gamma/tokens/brand');
  assert.equal(head.asset.logo['horizontal-primary'].$value, 'user/ds/gamma/logo/horizontal-primary');
  assert.equal(head.asset.logo.event.icon.$value, 'user/ds/gamma/logo/event/icon');
  assert.match(await drawnBytes(dst, 'horizontal-primary') ?? '', /#ff0000/);
  assert.deepEqual(await listed(dst), ['user/ds/gamma/logo/event/icon', 'user/ds/gamma/logo/horizontal-primary']);
});

test('a targeted export of a named system round-trips its logos into a targeted import', async () => {
  const src = await rig();
  await createDesignSystem(src.manageHost, { label: 'Alpha' });
  await src.activate('alpha');
  await installLogo(src.logoHost, 'vertical-mono', svg('#ff0000', 'a.svg'));
  await src.activate('shipped');   // exporting a system that is not on screen
  const out = await exportBrandPack({ host: src.host as never, storage: storage() }, { system: 'alpha' });
  assert.equal(out.summary.logos, 1);

  const dst = await rig();
  await createDesignSystem(dst.manageHost, { label: 'Delta' });
  await importBrandPack({ host: dst.host as never, storage: storage() }, await out.blob.arrayBuffer(), { target: { system: 'delta' } });
  assert.match(await text(dst, 'user/ds/delta/logo/vertical-mono') ?? '', /#ff0000/);
  assert.equal((await headOf(dst, 'user/ds/delta/tokens/brand')).asset.logo['vertical-mono'].$value, 'user/ds/delta/logo/vertical-mono');
});

test('a logo in the Trash stays out of a brand pack, as a trashed font does', async () => {
  const r = await rig();
  await createDesignSystem(r.manageHost, { label: 'Alpha' });
  await r.activate('alpha');
  await installLogo(r.logoHost, 'horizontal-primary', svg('#ff0000', 'a.svg'));
  await installLogo(r.logoHost, 'vertical-mono', svg('#00ff00', 'v.svg'));
  assert.ok(await r.assets._setUserAssetTrashed('user/ds/alpha/logo/vertical-mono', new Date().toISOString()));

  for (const opts of [{}, { system: 'alpha' }]) {
    const out = await exportBrandPack({ host: r.host as never, storage: storage() }, opts);
    const { files, json } = await packParts(out.blob);
    assert.equal(out.summary.logos, 1, `only the live mark travels (${JSON.stringify(opts)})`);
    assert.deepEqual(json('logos.json').map((row: { id: string }) => row.id), ['user/logo/horizontal-primary']);
    assert.equal(Object.keys(files).some(f => f.startsWith('logos/vertical-mono')), false);
  }
  // The default system's legacy rows follow the same rule.
  await r.activate('shipped');
  await legacyLogo(r, 'horizontal-mono', '#222222');
  await installUserTokens(r.host as unknown as Parameters<typeof installUserTokens>[0], { asset: { logo: { 'horizontal-mono': logoToken('user/logo/horizontal-mono') } } });
  await r.assets._setUserAssetTrashed('user/logo/horizontal-mono', new Date().toISOString());
  assert.equal((await exportBrandPack({ host: r.host as never, storage: storage() })).summary.logos, 0);
});
