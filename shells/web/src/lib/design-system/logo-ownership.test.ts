// SPDX-License-Identifier: MPL-2.0
/**
 * The logo ownership pass (logo-ownership.ts) and the paths around it, against
 * the cases a review found: published versions, restores, removals, a full disk,
 * the brand studio's save and the Versions panel.
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/design-system/logo-ownership.test.ts
 *
 * Every case runs on the REAL assets bridge, registry and tokens bridge over one
 * map-backed store (the rig lib/design-system/manage.test.ts uses); the ones
 * about published versions put the real pin preserver behind the upload path,
 * as the web bridge does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { createAssetsAPI } from '../../bridge/assets.ts';
import { createTokensAPI, installUserTokens, USER_TOKENS_ID } from '../../bridge/tokens.ts';
import { createPinPreserver } from '../../bridge/version-assets.ts';
import { createDesignSystemRegistry, type RegistryDb } from './registry.ts';
import { createDesignSystem, removeDesignSystem } from './manage.ts';
import { ensureOwnLogos } from './logo-ownership.ts';
import { readVersionIndex, withVersionIndex } from './versions.ts';
import { headAhead, publishPreview, publishVersion, restoreLatestFrom, type VersionsIoCtx } from './versions-io.ts';
import { installLogo, listLogos, removeLogo, saveWithStoredLogos, withLogoGroupFrom } from '../brand-logos.ts';
import { exportBrandPack } from '../../brand-transfer.ts';
import { sha256Hex } from '../../../../../engine/src/index.ts';

// ── The device ────────────────────────────────────────────────────────────────

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

type LogoRig = Awaited<ReturnType<typeof logoRig>>;

/** A one-colour SVG mark: the fill is how a test tells two marks apart. */
const svg = (fill: string, name: string): File =>
  new File([`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="${fill}"/></svg>`], name, { type: 'image/svg+xml' });

/** The fill a stored mark was drawn with, or null when there is no such row. */
async function fillOf(r: LogoRig, id: string | null | undefined): Promise<string | null> {
  if (!id) return null;
  const blob = await r.assets._getBlob(id);
  return blob ? (await blob.text()).match(/#[0-9a-f]{6}/)?.[0] ?? null : null;
}

/** The asset id the ACTIVE system's render resolves for a slot, or null. */
async function drawnId(r: LogoRig, variant: string): Promise<string | null> {
  const id = await r.host.tokens.resolve(`{asset.logo.${variant}}`);
  return typeof id === 'string' && !id.startsWith('{') ? id : null;
}

/** The fill the ACTIVE system draws for a slot. */
const drawnFill = async (r: LogoRig, variant: string): Promise<string | null> => fillOf(r, await drawnId(r, variant));

/** A stored head (or any JSON asset). */
async function headOf(r: LogoRig, id: string): Promise<{ asset?: { logo?: Record<string, { $value?: string } & Record<string, { $value?: string }>> } } & Record<string, unknown>> {
  const blob = await r.assets._getBlob(id);
  if (!blob) throw new Error(`expected an asset at ${id}`);
  return JSON.parse(await blob.text());
}

/** Every stored row id, sorted. */
const rowIds = async (r: LogoRig): Promise<string[]> => (await r.assets._exportUserAssets()).map(row => row.id).sort();

/** What the ACTIVE system's Logos room lists, as `identity/variant=assetId`. */
async function listed(r: LogoRig): Promise<string[]> {
  const slots = await listLogos(r.logoHost);
  for (const s of slots) URL.revokeObjectURL(s.url);
  return slots.map(s => `${s.identity}/${s.variant}=${s.assetId}`).sort();
}

const logoToken = (id: string) => ({ $type: 'asset', $value: id });

/** A logo row the way the pre-fix installLogo wrote it (the legacy id), or at
 *  any id given. */
async function storedLogo(r: LogoRig, variant: string, fill: string, id = `user/logo/${variant}`): Promise<string> {
  await r.assets._uploadUserAsset({
    id, type: 'vector', format: 'svg', blob: svg(fill, `${variant}.svg`),
    meta: { format: 'svg', variant, identity: 'default', kind: 'logo' },
  });
  return id;
}

/** Write a head document as the app does (to the active system, or `system`). */
const writeHead = (r: LogoRig, doc: unknown, opts: Parameters<typeof installUserTokens>[2] = {}): Promise<void> =>
  installUserTokens(r.tokensHost, doc, opts);

/** An in-memory stand-in for localStorage. */
function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
}

// ── The cases ─────────────────────────────────────────────────────────────────

const ALPHA_HEAD = 'user/ds/alpha/tokens/brand';
const ctxOf = (r: LogoRig): VersionsIoCtx => ({ host: r.host as unknown as VersionsIoCtx['host'] });
const logoOf = (head: Awaited<ReturnType<typeof headOf>>, variant: string): string | undefined =>
  head.asset?.logo?.[variant]?.$value;

/** What a published version draws for a slot, through the render path's pins. */
async function versionFill(r: LogoRig, slug: string, variant: string): Promise<string | null> {
  const id = await r.host.tokens.forVersion(slug).resolve(`{asset.logo.${variant}}`);
  return typeof id === 'string' ? fillOf(r, id) : null;
}

/** Every frozen row, and whether a pin in the version list still points at that row. */
async function frozenRows(r: LogoRig, headId: string): Promise<Array<{ id: string; fill: string | null; pinned: boolean }>> {
  const pins = new Set(readVersionIndex(await headOf(r, headId)).versions.flatMap(v => (v.assets ?? []).map(p => p.frozenId)));
  return Promise.all((await r.assets._exportUserAssets())
    .filter(row => row.id.startsWith('user/frozen/'))
    .map(async row => ({ id: row.id, fill: await fillOf(r, row.id), pinned: pins.has(row.id) })));
}

/** Uploads under `user/ds/<id>/logo/` fail as a full disk would. */
function fillTheDisk(r: LogoRig): void {
  const real = r.assets._uploadUserAsset.bind(r.assets);
  r.assets._uploadUserAsset = async (record, opts) => {
    if (/^user\/ds\/[^/]+\/logo\//.test(record.id)) throw Object.assign(new Error('Storage is full'), { name: 'QuotaExceededError' });
    return real(record, opts);
  };
}

/** A named system Alpha whose head borrows the legacy row `user/logo/<slot>`,
 *  as every upload before the fix left that head. */
async function borrowingAlpha(r: LogoRig, fill = '#aaaaaa', variant = 'horizontal-primary'): Promise<string> {
  const legacy = await storedLogo(r, variant, fill);
  await createDesignSystem(r.manageHost, { label: 'Alpha' });
  await writeHead(r, { color: { x: 2 }, asset: { logo: { [variant]: logoToken(legacy) } } }, { system: 'alpha' });
  return legacy;
}

// ── Published versions keep their bytes ───────────────────────────────────────

test('a version published after the repair still draws its own mark after a restore and a second pass', async () => {
  const r = await logoRig({ pins: true });
  await borrowingAlpha(r);
  await r.activate('alpha');
  const ctx = ctxOf(r);
  await publishVersion(ctx, { label: 'V1' });                         // pins the legacy row (A)
  await listLogos(r.logoHost);                                        // the update: the pass runs
  await installLogo(r.logoHost, 'horizontal-primary', svg('#cccccc', 'b.svg'));
  await publishVersion(ctx, { label: 'V2' });                         // pins Alpha's own row (B)
  r.host.tokens.bust();
  await restoreLatestFrom(ctx, 'v1');                                 // the head points at the legacy row again
  await listLogos(r.logoHost);                                        // the Logos room opens: the pass runs again
  r.host.tokens.bust();

  assert.equal(await versionFill(r, 'v2', 'horizontal-primary'), '#cccccc', 'V2 draws the mark it was published with');
  assert.equal(await versionFill(r, 'v1', 'horizontal-primary'), '#aaaaaa', 'V1 too');
  assert.equal(await drawnFill(r, 'horizontal-primary'), '#aaaaaa', 'the restored head draws V1’s mark');
  assert.equal(await fillOf(r, 'user/ds/alpha/logo/horizontal-primary'), '#cccccc', 'Alpha’s own newer mark was not replaced');
  for (const row of await frozenRows(r, ALPHA_HEAD)) assert.ok(row.pinned, `no orphaned preserved copy (${row.id})`);
});

test('the pass writes the head as it stands after its copies, not the copy it read before them', async () => {
  const r = await logoRig();
  await borrowingAlpha(r);
  // Something else writes Alpha's head while the copy is being made - the pin
  // preserver updating the version list, or the studio saving.
  const real = r.assets._uploadUserAsset.bind(r.assets);
  let injected = false;
  r.assets._uploadUserAsset = async (record, opts) => {
    await real(record, opts);
    if (!injected && record.id.startsWith('user/ds/alpha/logo/')) {
      injected = true;
      const head = await headOf(r, ALPHA_HEAD);
      await writeHead(r, { ...head, color: { x: 2, written: 'meanwhile' } }, { system: 'alpha' });
    }
  };
  assert.equal(await ensureOwnLogos(r.ownHost), 1);
  const head = await headOf(r, ALPHA_HEAD);
  assert.deepEqual(head.color, { x: 2, written: 'meanwhile' }, 'the write made during the copy survives');
  assert.equal(logoOf(head, 'horizontal-primary'), 'user/ds/alpha/logo/horizontal-primary');
});

/** Alpha owns a row for the slot (a targeted .lolly import) that V1 pins, and
 *  then an upload before the fix pointed its head at the legacy row instead. */
async function alphaWithItsOwnPinnedRow(r: LogoRig): Promise<{ legacy: string; own: string }> {
  const legacy = await storedLogo(r, 'horizontal-primary', '#aaaaaa');
  await createDesignSystem(r.manageHost, { label: 'Alpha' });
  const own = await storedLogo(r, 'horizontal-primary', '#bbbbbb', 'user/ds/alpha/logo/horizontal-primary');
  const ownRow = await r.assets._getUserRecord(own);
  const sha = await sha256Hex(new Uint8Array(await (await r.assets._getBlob(own))!.arrayBuffer()));
  await writeHead(r, { asset: { logo: { 'horizontal-primary': logoToken(own) } } }, { system: 'alpha', versionSlug: 'v1', allowVersionWrite: true });
  const ledger = { versions: [{ slug: 'v1', label: 'V1', date: '2026-01-01', checksum: 'x', assets: [{ id: own, version: ownRow!.version!, sha256: sha }] }], active: null };
  await writeHead(r, withVersionIndex({ asset: { logo: { 'horizontal-primary': logoToken(legacy) } } }, ledger), { system: 'alpha' });
  return { legacy, own };
}

for (const activeDuringPass of ['shipped', 'alpha'] as const) {
  test(`the pass never replaces a row that holds other bytes (${activeDuringPass} active): the borrowed mark goes to a kept copy beside it`, async () => {
    const r = await logoRig({ pins: true });
    const { own } = await alphaWithItsOwnPinnedRow(r);
    await r.activate(activeDuringPass);
    assert.equal(await ensureOwnLogos(r.ownHost), 1);

    assert.equal(await fillOf(r, own), '#bbbbbb', 'Alpha’s own row keeps its bytes');
    const head = await headOf(r, ALPHA_HEAD);
    const kept = logoOf(head, 'horizontal-primary')!;
    assert.match(kept, /^user\/ds\/alpha\/logo\/horizontal-primary-[0-9a-f]{8}$/);
    assert.equal(await fillOf(r, kept), '#aaaaaa', 'the head draws what it drew before, from a row of its own');
    assert.equal((await r.assets._getUserRecord(kept))?.meta?.kept, true);
    assert.deepEqual(await frozenRows(r, ALPHA_HEAD), [], 'nothing needed preserving, because nothing was replaced');

    await r.activate('alpha');
    assert.equal(await versionFill(r, 'v1', 'horizontal-primary'), '#bbbbbb', 'V1 still draws the row it pinned');
    assert.equal(await drawnFill(r, 'horizontal-primary'), '#aaaaaa');
    assert.deepEqual(await listed(r), [`default/horizontal-primary=${kept}`], 'the Logos room shows the mark the system draws');
  });
}

test('two different borrowed marks that would land on one id get a row each', async () => {
  const r = await logoRig();
  const a = await storedLogo(r, 'icon', '#111111');
  await createDesignSystem(r.manageHost, { label: 'Beta' });
  const b = await storedLogo(r, 'icon', '#222222', 'user/ds/beta/logo/icon');
  await createDesignSystem(r.manageHost, { label: 'Alpha' });
  await writeHead(r, { asset: { logo: { icon: logoToken(a), 'icon-alt': logoToken(b) } } }, { system: 'alpha' });
  await ensureOwnLogos(r.ownHost);
  const head = await headOf(r, ALPHA_HEAD);
  assert.notEqual(logoOf(head, 'icon'), logoOf(head, 'icon-alt'));
  assert.equal(await fillOf(r, logoOf(head, 'icon')), '#111111');
  assert.equal(await fillOf(r, logoOf(head, 'icon-alt')), '#222222');
});

test('restoring a version from before the update keeps the system’s newer mark, and undoing the restore brings it back', async () => {
  const r = await logoRig();
  await borrowingAlpha(r);
  await r.activate('alpha');
  const ctx = ctxOf(r);
  await publishVersion(ctx, { label: 'V1' });
  await listLogos(r.logoHost);
  await installLogo(r.logoHost, 'horizontal-primary', svg('#cccccc', 'b.svg'));
  const beforeRestore = await headOf(r, ALPHA_HEAD);                  // what the studio's undo writes back
  r.host.tokens.bust();
  await restoreLatestFrom(ctx, 'v1');
  const slots = await listed(r);                                      // the pass runs here
  r.host.tokens.bust();

  assert.equal(await fillOf(r, 'user/ds/alpha/logo/horizontal-primary'), '#cccccc', 'the newer mark was not overwritten');
  assert.equal(await drawnFill(r, 'horizontal-primary'), '#aaaaaa', 'the restore draws V1’s mark');
  assert.deepEqual(slots, [`default/horizontal-primary=${logoOf(await headOf(r, ALPHA_HEAD), 'horizontal-primary')}`]);
  await writeHead(r, beforeRestore);
  r.host.tokens.bust();
  assert.equal(await drawnFill(r, 'horizontal-primary'), '#cccccc', 'undoing the restore draws the newer mark again');
});

test('removing a slot drawn from a kept copy empties the slot: its kept row and its own row go, other systems’ rows stay', async () => {
  const r = await logoRig();
  const { own, legacy } = await alphaWithItsOwnPinnedRow(r);
  await r.activate('alpha');
  await listLogos(r.logoHost);
  const kept = logoOf(await headOf(r, ALPHA_HEAD), 'horizontal-primary')!;
  await removeLogo(r.logoHost, 'horizontal-primary');
  assert.deepEqual(await listed(r), []);
  assert.equal(await r.assets._getBlob(kept), null);
  assert.equal(await r.assets._getBlob(own), null);
  assert.ok(await r.assets._getBlob(legacy), 'the legacy row is not Alpha’s to delete');
});

// ── The Versions panel ────────────────────────────────────────────────────────

test('moving a borrowed mark to the system’s own row is not an edit the Versions panel reports', async () => {
  const r = await logoRig();
  await borrowingAlpha(r);
  await r.activate('alpha');
  const ctx = ctxOf(r);
  await publishVersion(ctx, { label: 'V1', activate: true });
  assert.equal((await headAhead(ctx)).ahead, false);
  assert.equal(await ensureOwnLogos(r.ownHost), 1);
  r.host.tokens.bust();
  assert.deepEqual(await headAhead(ctx), { slug: 'v1', label: 'V1', ahead: false, changes: 0 });
  const preview = await publishPreview(ctx, 'V2');
  assert.deepEqual(preview.diff, { added: [], changed: [], removed: [] });
  assert.deepEqual(preview.assetChanges, []);

  // A real change is still one.
  await installLogo(r.logoHost, 'horizontal-primary', svg('#cccccc', 'b.svg'));
  r.host.tokens.bust();
  const ahead = await headAhead(ctx);
  assert.equal(ahead.ahead, true);
  assert.equal(ahead.changes, 1);
  assert.deepEqual((await publishPreview(ctx, 'V2')).assetChanges.map(c => c.kind).sort(), ['added', 'removed']);
});

// ── Brand packs ───────────────────────────────────────────────────────────────

const packOf = async (blob: Blob) => {
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const json = (path: string) => JSON.parse(new TextDecoder().decode(files[path]!));
  return { files, json };
};

test('an export of a system the pass has not reached yet carries its mark under the slot’s own name', async () => {
  for (const opts of [{}, { system: 'alpha' }]) {
    const r = await logoRig();
    await borrowingAlpha(r, '#0000ff');
    await r.activate('alpha');
    const out = await exportBrandPack({ host: r.host as never, storage: memoryStorage() }, opts);
    const { json } = await packOf(out.blob);
    assert.equal(out.summary.logos, 1, JSON.stringify(opts));
    assert.deepEqual(json('logos.json').map((row: { id: string }) => row.id), ['user/logo/horizontal-primary']);
    assert.equal(json('tokens.json').asset.logo['horizontal-primary'].$value, 'user/logo/horizontal-primary');
  }
});

test('an export on a full disk, where the pass cannot copy, still carries the borrowed mark', async () => {
  const r = await logoRig();
  await borrowingAlpha(r, '#0000ff');
  await r.activate('alpha');
  fillTheDisk(r);
  const out = await exportBrandPack({ host: r.host as never, storage: memoryStorage() });
  const { files, json } = await packOf(out.blob);
  assert.equal(out.summary.logos, 1);
  const [row] = json('logos.json') as Array<{ id: string; file: string }>;
  assert.match(row!.id, /^user\/logo\/imported-[0-9a-f]{12}$/);
  assert.equal(json('tokens.json').asset.logo['horizontal-primary'].$value, row!.id, 'the token names the carried row');
  assert.match(new TextDecoder().decode(files[row!.file]!), /#0000ff/);
});

// ── Removing a system ─────────────────────────────────────────────────────────

test('removing the default system on a full disk keeps the row a named system still draws', async () => {
  const r = await logoRig();
  const legacy = await storedLogo(r, 'horizontal-primary', '#0000ff');
  await writeHead(r, { asset: { logo: { 'horizontal-primary': logoToken(legacy) } } });
  await createDesignSystem(r.manageHost, { label: 'Alpha' });
  await writeHead(r, { asset: { logo: { 'horizontal-primary': logoToken(legacy) } } }, { system: 'alpha' });
  fillTheDisk(r);
  const res = await removeDesignSystem(r.manageHost, 'default');
  assert.deepEqual({ deleted: res.deleted, kept: res.kept }, { deleted: 1, kept: 1 }, 'its head goes, the shared row stays');
  assert.ok(await r.assets._getBlob(legacy));
  await r.activate('alpha');
  assert.equal(await drawnFill(r, 'horizontal-primary'), '#0000ff');
});

for (const activeDuringRemove of ['default', 'alpha'] as const) {
  test(`removing the default system (${activeDuringRemove} active) keeps the rows another system’s published version pins`, async () => {
    const r = await logoRig({ pins: true });
    await writeHead(r, { color: { x: 1 } });
    await borrowingAlpha(r);
    await r.activate('alpha');
    await publishVersion(ctxOf(r), { label: 'V1' });
    await r.activate(activeDuringRemove);
    await removeDesignSystem(r.manageHost, 'default');
    await r.activate('alpha');
    assert.equal(await versionFill(r, 'v1', 'horizontal-primary'), '#aaaaaa', 'V1 still draws its mark');
    assert.equal(await drawnFill(r, 'horizontal-primary'), '#aaaaaa');
  });
}

// ── The Logos room ────────────────────────────────────────────────────────────

test('a mark in the Trash is not listed, as a brand pack leaves it out', async () => {
  const r = await logoRig();
  await createDesignSystem(r.manageHost, { label: 'Alpha' });
  await r.activate('alpha');
  await installLogo(r.logoHost, 'horizontal-primary', svg('#ff0000', 'a.svg'));
  await r.assets._setUserAssetTrashed('user/ds/alpha/logo/horizontal-primary', new Date().toISOString());
  assert.deepEqual(await listed(r), []);
});

test('a borrowed mark in the Trash is left where it is, not copied back out', async () => {
  const r = await logoRig();
  const legacy = await borrowingAlpha(r);
  await r.assets._setUserAssetTrashed(legacy, new Date().toISOString());
  assert.equal(await ensureOwnLogos(r.ownHost), 0);
  assert.equal(logoOf(await headOf(r, ALPHA_HEAD), 'horizontal-primary'), legacy);
  assert.equal(await r.assets._getBlob('user/ds/alpha/logo/horizontal-primary'), null);
});

test('a system’s own row that no token names still shows, so it can be replaced or removed', async () => {
  // The default system after the update: a legacy row a named system uploaded
  // before it (and now has its own copy of) is the default system's by its id.
  const r = await logoRig();
  await writeHead(r, { color: { x: 1 } });
  await borrowingAlpha(r, '#0000ff');
  await ensureOwnLogos(r.ownHost);
  await r.activate('default');
  assert.equal(await drawnId(r, 'horizontal-primary'), null, 'the default system draws no logo');
  assert.deepEqual(await listed(r), ['default/horizontal-primary=user/logo/horizontal-primary']);
  await removeLogo(r.logoHost, 'horizontal-primary');
  assert.deepEqual(await listed(r), []);
  await r.activate('alpha');
  assert.equal(await drawnFill(r, 'horizontal-primary'), '#0000ff', 'Alpha draws its own copy');
});

test('an upload and a brand-studio save made at the same moment both land', async () => {
  const r = await logoRig();
  await createDesignSystem(r.manageHost, { label: 'Alpha' });
  await r.activate('alpha');
  const opened = await headOf(r, ALPHA_HEAD);                         // the copy the studio opened with
  const edited = { ...opened, color: { ...(opened.color as object), added: { $type: 'color', $value: '#123456' } } };
  // The save reads the head, then takes a while to write it; the upload starts meanwhile.
  const save = saveWithStoredLogos(r.logoHost, edited, async (doc) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    await writeHead(r, doc);
  });
  const upload = installLogo(r.logoHost, 'horizontal-primary', svg('#ff0000', 'a.svg'));
  await Promise.all([save, upload]);
  const head = await headOf(r, ALPHA_HEAD);
  assert.equal((head.color as Record<string, { $value: string }>).added?.$value, '#123456', 'the colour edit landed');
  assert.equal(logoOf(head, 'horizontal-primary'), 'user/ds/alpha/logo/horizontal-primary', 'and so did the logo token');
});

test('the studio save grafts logo groups set by set on a themed document', () => {
  const stored = {
    $themes: [{ name: 'light' }, { name: 'dark' }],
    base: { color: {} },
    light: { asset: { logo: { p: logoToken('user/ds/a/logo/p') } } },
    dark: { asset: { logo: { p: logoToken('user/ds/a/logo/p-rev') } } },
  };
  const edited = structuredClone(stored) as Record<string, unknown>;
  (edited.base as Record<string, unknown>).color = { edited: 1 };
  (edited.dark as { asset: { logo: unknown } }).asset.logo = { p: logoToken('stale') };
  const out = withLogoGroupFrom(edited, stored) as Record<string, { asset?: { logo?: unknown }; color?: unknown }>;
  assert.deepEqual(out.base!.color, { edited: 1 }, 'the edit stays');
  assert.equal(out.base!.asset, undefined, 'no logo group appears where there was none');
  assert.deepEqual(out.light!.asset?.logo, stored.light.asset.logo);
  assert.deepEqual(out.dark!.asset?.logo, stored.dark.asset.logo, 'each set keeps its own stored group');
});

test('a head known to borrow nothing is not read again until it changes', async () => {
  const r = await logoRig();
  await createDesignSystem(r.manageHost, { label: 'Alpha' });
  await createDesignSystem(r.manageHost, { label: 'Beta' });
  await ensureOwnLogos(r.ownHost);
  const reads: string[] = [];
  const real = r.assets._getBlob.bind(r.assets);
  r.assets._getBlob = async (id, ...rest) => { reads.push(id); return real(id, ...rest); };
  await ensureOwnLogos(r.ownHost);
  assert.deepEqual(reads.filter(id => id.endsWith('/tokens/brand')), [], 'two clean heads, no head read');
  await writeHead(r, { asset: { logo: { icon: logoToken(await storedLogo(r, 'icon', '#010101')) } } }, { system: 'beta' });
  reads.length = 0;
  assert.equal(await ensureOwnLogos(r.ownHost), 1, 'a changed head is looked at again');
  assert.ok(reads.includes('user/ds/beta/tokens/brand'));
  assert.deepEqual(await rowIds(r).then(ids => ids.filter(id => id.includes('/logo/'))), ['user/ds/beta/logo/icon', 'user/logo/icon']);
});

test('the default system and its legacy ids are never rewritten by the pass', async () => {
  const r = await logoRig();
  const legacy = await storedLogo(r, 'horizontal-primary', '#0000ff');
  await writeHead(r, { asset: { logo: { 'horizontal-primary': logoToken(legacy) } } });
  const before = await r.assets._getBlob(USER_TOKENS_ID).then(b => b!.text());
  await borrowingAlpha(r, '#0000ff', 'vertical-mono');
  await ensureOwnLogos(r.ownHost);
  assert.equal(await r.assets._getBlob(USER_TOKENS_ID).then(b => b!.text()), before);
});
