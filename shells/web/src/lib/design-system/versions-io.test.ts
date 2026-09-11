// SPDX-License-Identifier: MPL-2.0
/**
 * versions-io.ts - publishing, activating and restoring design-system versions
 * (plans/97 section 6a), over the REAL assets + tokens bridges.
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/versions-io.test.ts"
 *
 * Composed rather than stubbed, following bridge/tokens.test.ts: the whole point
 * of M7 is that publish → immutability → copy-on-write → version-scoped
 * resolution hold END TO END across three modules, and a stub of any one of them
 * would test the stub. The only fake is the idb slice underneath, which also
 * counts its reads so the byte-identity claim ("an unversioned system pays
 * nothing") is measured rather than asserted.
 */

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAssetsAPI } from '../../bridge/assets.ts';
import { createTokensAPI, installUserTokens, USER_TOKENS_ID } from '../../bridge/tokens.ts';
import { createPinPreserver, FROZEN_PREFIX } from '../../bridge/version-assets.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import {
  buildAssetManifest, headAhead, publishPreview, publishVersion, readIndex, readVersionDoc,
  restoreLatestFrom, setActiveVersion, versionStorage,
} from './versions-io.ts';
import { docChecksum, frozenAssetId, readVersionIndex, sha256Hex, versionAssetId, withVersionIndex } from './versions.ts';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/** Every catalog probe 404s: these tests are about the user's own system. */
function stubFetch(): void {
  globalThis.fetch = (async () => new Response('not found', { status: 404 })) as typeof fetch;
}

/** In-memory stand-in for the idb slice bridge/assets.ts consumes, counting
 *  reads so a "does no work" claim can be measured. */
function memDb() {
  const stores: Record<string, Map<string, unknown>> = {
    'user-assets': new Map(), 'asset-meta': new Map(), 'asset-blob': new Map(),
  };
  const reads = { n: 0 };
  const db = {
    async get(store: string, key: string) { reads.n++; return stores[store]!.get(key); },
    async getAll(store: string) { reads.n++; return [...stores[store]!.values()]; },
    async getAllKeys(store: string) { reads.n++; return [...stores[store]!.keys()]; },
    async put(store: string, value: unknown, key?: string) {
      stores[store]!.set(key ?? String((value as { id: string }).id), value);
    },
    async delete(store: string, key: string) { stores[store]!.delete(key); },
  };
  return { db: db as unknown as Parameters<typeof createAssetsAPI>[0], reads, stores };
}

/** The web bridge as main.ts assembles it: assets ← preserver ← tokens. */
function makeHost() {
  const { db, reads, stores } = memDb();
  // Mirrors bridge/index.ts, `reclaiming` flag and all: the delete path tells the
  // preserver its copy replaces the bytes rather than joining them.
  let preserve: ((id: string, o?: { reclaiming?: boolean }) => Promise<void>) | null = null;
  const assets = createAssetsAPI(db, { preservePinned: (id, o) => preserve?.(id, o) ?? Promise.resolve() });
  const host = { assets, log: () => { /* quiet */ } } as unknown as {
    assets: ReturnType<typeof createAssetsAPI>; tokens: ReturnType<typeof createTokensAPI>;
  };
  host.tokens = createTokensAPI(host as unknown as Parameters<typeof createTokensAPI>[0]);
  preserve = createPinPreserver(host as unknown as Parameters<typeof createPinPreserver>[0]);
  return { host, assets, tokens: host.tokens, reads, stores, ctx: { host: host as unknown as HostV1 } };
}

const LOGO_ID = 'user/logo/horizontal-primary';
const FONT_ID = 'user/font/acme-sans-400';
const bytes = (s: string) => new Blob([s], { type: 'image/png' });

/** A head document shaped like a real one: colour, a logo asset token, a font family. */
const doc = (jungle = '#30ba78') => ({
  color: { brand: { jungle: { $type: 'color', $value: jungle } } },
  asset: { logo: { 'horizontal-primary': { $type: 'asset', $value: LOGO_ID } } },
  font: { brand: { $type: 'fontFamily', $value: ['Acme Sans'] } },
});

/**
 * Edit the head the way the studio does: every committed action installs a
 * document DERIVED from the current head (studio-state clones it, the brand-doc
 * helpers mutate the clone), so the ledger rides along. A caller that installs a
 * document built from nothing replaces the head wholesale, ledger included - 
 * which is why importing a pack has to merge rather than overwrite (section 8.1).
 */
async function editHead(h: ReturnType<typeof makeHost>, next: Record<string, unknown>): Promise<void> {
  const index = readVersionIndex(await h.tokens.raw());
  await installUserTokens(
    h.host as unknown as Parameters<typeof installUserTokens>[0],
    withVersionIndex(next, index),
    { label: 'My brand' },
  );
}

/** Install a head document plus the two files it names. */
async function seedSystem(h: ReturnType<typeof makeHost>, jungle?: string): Promise<void> {
  await h.assets._uploadUserAsset({ id: LOGO_ID, type: 'raster', format: 'png', blob: bytes('LOGO-A'), meta: { name: 'Logo' } });
  await h.assets._uploadUserAsset({
    id: FONT_ID, type: 'font', format: 'woff2', blob: bytes('FONT-A'),
    version: '1.0.0', meta: { family: 'Acme Sans', weight: '400' },
  });
  await installUserTokens(h.host as unknown as Parameters<typeof installUserTokens>[0], doc(jungle), { label: 'My brand' });
}

test('publish writes the version asset first, then the ledger - and the version carries no ledger of its own', async () => {
  stubFetch();
  const h = makeHost();
  await seedSystem(h);

  const entry = await publishVersion(h.ctx, { label: 'v1', note: 'launch', activate: true });
  assert.equal(entry.slug, 'v1');
  assert.equal(entry.label, 'v1');
  assert.equal(entry.note, 'launch');

  const stored = await readVersionDoc(h.ctx, 'v1');
  assert.ok(stored, 'the version asset exists at the sibling id');
  assert.equal((await h.assets._getBlob(versionAssetId(USER_TOKENS_ID, 'v1'))) !== null, true);
  assert.deepEqual(readVersionIndex(stored).versions, [], 'a version never stores the list it belongs to');
  assert.equal(await docChecksum(stored), entry.checksum, 'the checksum is of what was actually stored');

  const index = await readIndex(h.ctx);
  assert.deepEqual(index.versions.map(v => v.slug), ['v1']);
  assert.equal(index.active, 'v1');

  // The head is still the design system: a version must never shadow it.
  assert.equal((await h.assets._findMetaByType('tokens'))?.id, USER_TOKENS_ID);
});

test('the manifest pins the logo the doc names and every face of the family it names', async () => {
  stubFetch();
  const h = makeHost();
  await seedSystem(h);
  // A second face of the same family, and one unrelated file the doc never names.
  await h.assets._uploadUserAsset({
    id: 'user/font/acme-sans-700', type: 'font', format: 'woff2', blob: bytes('FONT-B'),
    meta: { family: 'acme sans', weight: '700' },
  });
  await h.assets._uploadUserAsset({ id: 'user/upload/1-holiday', type: 'raster', format: 'png', blob: bytes('SNAP') });

  const pins = await buildAssetManifest(h.ctx, doc());
  assert.deepEqual(pins.map(p => p.id), ['user/font/acme-sans-400', 'user/font/acme-sans-700', LOGO_ID],
    'both faces of the named family, the named logo, and nothing else');
  assert.equal(pins[2]?.sha256, await sha256Hex(new Uint8Array(await bytes('LOGO-A').arrayBuffer())));
  assert.equal(pins[2]?.version, '0.0.0', 'a record with no version records 0.0.0 rather than inventing one');
  assert.equal(pins[0]?.version, '1.0.0');
});

test('a token naming a file this device does not have is skipped, not faked', async () => {
  stubFetch();
  const h = makeHost();
  const pins = await buildAssetManifest(h.ctx, doc());
  assert.deepEqual(pins, [], 'a dangling token is not a pin');
});

test('republishing a name is refused - a published version is permanent', async () => {
  stubFetch();
  const h = makeHost();
  await seedSystem(h);
  await publishVersion(h.ctx, { label: 'v1' });

  await assert.rejects(publishVersion(h.ctx, { label: 'v1' }), /already used/);
  await assert.rejects(publishVersion(h.ctx, { label: 'V1' }), /already used/,
    'the slug is what is permanent, so a differently-cased label collides too');
  // …and the stored version is untouched by the attempt.
  const stored = await readVersionDoc(h.ctx, 'v1') as Record<string, unknown>;
  assert.equal(await docChecksum(stored), (await readIndex(h.ctx)).versions[0]?.checksum);
});

test('a name with no letters or numbers is refused before anything is written', async () => {
  stubFetch();
  const h = makeHost();
  await seedSystem(h);
  await assert.rejects(publishVersion(h.ctx, { label: '🎨🎨' }), /letters or numbers/);
  assert.deepEqual((await readIndex(h.ctx)).versions, []);
});

test('activate, then follow the latest again', async () => {
  stubFetch();
  const h = makeHost();
  await seedSystem(h);
  await publishVersion(h.ctx, { label: 'v1' });
  assert.equal((await readIndex(h.ctx)).active, null, 'publish-only does not activate');
  assert.equal(await h.tokens.activeSlug(), 'latest');

  await setActiveVersion(h.ctx, 'v1');
  assert.equal((await readIndex(h.ctx)).active, 'v1');
  assert.equal(await h.tokens.activeSlug(), 'v1');

  await setActiveVersion(h.ctx, null);
  assert.equal((await readIndex(h.ctx)).active, null);
  assert.equal(await h.tokens.activeSlug(), 'latest');

  await assert.rejects(setActiveVersion(h.ctx, 'nope'), /not on this device/);
});

test('restoring from a version keeps the ledger - the history is not what gets overwritten', async () => {
  stubFetch();
  const h = makeHost();
  await seedSystem(h, '#30ba78');
  await publishVersion(h.ctx, { label: 'v1', activate: true });
  // Move the head on, then publish a second version so the ledger has something to lose.
  await editHead(h, doc('#123456'));
  await publishVersion(h.ctx, { label: 'v2' });

  assert.equal(await restoreLatestFrom(h.ctx, 'v1'), true);
  const head = await h.tokens.raw();
  assert.equal(await h.tokens.resolve('{color.brand.jungle}'), '#30ba78', 'the head is v1 again');
  const index = readVersionIndex(head);
  assert.deepEqual(index.versions.map(v => v.slug), ['v1', 'v2'], 'both versions survive the restore');
  assert.equal(index.active, 'v1');
  assert.equal(await restoreLatestFrom(h.ctx, 'ghost'), false);
});

test('headAhead is false right after publishing and flips on the next edit', async () => {
  stubFetch();
  const h = makeHost();
  await seedSystem(h);
  await publishVersion(h.ctx, { label: 'v1', activate: true });
  assert.deepEqual(await headAhead(h.ctx), { slug: 'v1', label: 'v1', ahead: false, changes: 0 });

  await editHead(h, doc('#123456'));
  const ahead = await headAhead(h.ctx);
  assert.equal(ahead.ahead, true);
  assert.equal(ahead.changes, 1, 'one colour leaf moved');
  assert.equal(ahead.label, 'v1');
});

test('with nothing active there is nothing to be ahead of', async () => {
  stubFetch();
  const h = makeHost();
  await seedSystem(h);
  await publishVersion(h.ctx, { label: 'v1' }); // published, not activated
  assert.deepEqual(await headAhead(h.ctx), { slug: null, label: '', ahead: false, changes: 0 });
});

test('publishPreview reports the name, the token diff and which files changed', async () => {
  stubFetch();
  const h = makeHost();
  await seedSystem(h);
  const first = await publishPreview(h.ctx, 'v1');
  assert.equal(first.slug, 'v1');
  assert.equal(first.taken, false);
  assert.equal(first.diff.added.length > 0, true, 'a first publish honestly adds everything');
  assert.deepEqual(first.assetChanges.map(c => c.kind), ['added', 'added']);

  await publishVersion(h.ctx, { label: 'v1', activate: true });
  // Change a colour, drop a token, and replace the logo bytes.
  await editHead(h, {
    color: { brand: { jungle: { $type: 'color', $value: '#123456' } } },
    asset: { logo: { 'horizontal-primary': { $type: 'asset', $value: LOGO_ID } } },
  });
  await h.assets._uploadUserAsset({ id: LOGO_ID, type: 'raster', format: 'png', blob: bytes('LOGO-B') });

  const next = await publishPreview(h.ctx, 'v1');
  assert.equal(next.taken, true, 'the name is gone for good');
  assert.deepEqual(next.diff.changed, ['color.brand.jungle']);
  assert.deepEqual(next.diff.removed, ['font.brand'], 'a dropped path is the breaking set');
  assert.deepEqual(next.assetChanges, [
    { id: FONT_ID, kind: 'removed' },
    { id: LOGO_ID, kind: 'replaced' },
  ]);
});

// ── Copy-on-write: the M7 acceptance ─────────────────────────────────────────

test('a pinned logo survives being replaced - the version renders the old bytes, the head the new', async () => {
  stubFetch();
  const h = makeHost();
  await seedSystem(h);
  await publishVersion(h.ctx, { label: 'v1' });
  const oldHex = await sha256Hex(new Uint8Array(await bytes('LOGO-A').arrayBuffer()));
  const frozenId = frozenAssetId(oldHex);

  // The user replaces their logo - the ordinary upload path, same id.
  await h.assets._uploadUserAsset({ id: LOGO_ID, type: 'raster', format: 'png', blob: bytes('LOGO-B'), meta: { name: 'Logo' } });

  // The published bytes were preserved, content-keyed…
  const preserved = await h.assets._getBlob(frozenId);
  assert.ok(preserved, 'the pinned bytes were copied before they could be lost');
  assert.equal(await preserved.text(), 'LOGO-A');
  // …and only the head's LEDGER learned where they went.
  const pin = readVersionIndex(await h.tokens.raw()).versions[0]?.assets?.find(p => p.id === LOGO_ID);
  assert.equal(pin?.frozenId, frozenId);
  assert.equal(pin?.sha256, oldHex, 'the pin still records what was published');
  const stored = await readVersionDoc(h.ctx, 'v1') as Record<string, unknown>;
  assert.equal(await docChecksum(stored), (await readIndex(h.ctx)).versions[0]?.checksum,
    'the version asset itself is untouched - that is what immutable means');

  // Resolution: the version sees the preserved copy, the head sees the new file.
  assert.equal(await h.tokens.forVersion('v1').resolve('{asset.logo.horizontal-primary}'), frozenId);
  assert.equal(await h.tokens.resolve('{asset.logo.horizontal-primary}'), LOGO_ID);
  assert.equal(await (await h.assets._getBlob(frozenId))?.text(), 'LOGO-A');
  assert.equal(await (await h.assets._getBlob(LOGO_ID))?.text(), 'LOGO-B');
});

test('two versions pinning identical bytes share one preserved copy, and deleting preserves too', async () => {
  stubFetch();
  const h = makeHost();
  await seedSystem(h);
  await publishVersion(h.ctx, { label: 'v1' });
  // v2 publishes the same logo bytes under a different colour.
  await editHead(h, doc('#123456'));
  await publishVersion(h.ctx, { label: 'v2' });

  await h.assets._deleteUserAsset(LOGO_ID);

  const frozenId = frozenAssetId(await sha256Hex(new Uint8Array(await bytes('LOGO-A').arrayBuffer())));
  const frozenRows = [...h.stores['user-assets']!.keys()].filter(k => k.startsWith(FROZEN_PREFIX));
  assert.deepEqual(frozenRows, [frozenId], 'content-keyed, so identical bytes are stored once');
  for (const entry of (await readIndex(h.ctx)).versions) {
    assert.equal(entry.assets?.find(p => p.id === LOGO_ID)?.frozenId, frozenId);
  }
  // Both versions still resolve the logo; the head no longer has one.
  assert.equal(await h.tokens.forVersion('v2').resolve('{asset.logo.horizontal-primary}'), frozenId);
  assert.equal(await h.assets._getBlob(LOGO_ID), null);
});

test('preserved rows are hidden from the library listing but counted in storage', async () => {
  stubFetch();
  const h = makeHost();
  await seedSystem(h);
  await publishVersion(h.ctx, { label: 'v1' });
  await h.assets._uploadUserAsset({ id: LOGO_ID, type: 'raster', format: 'png', blob: bytes('LOGO-B') });

  const listed = (await h.assets._listUserAssets()).map(r => r.id);
  assert.equal(listed.some(id => id.startsWith(FROZEN_PREFIX)), false, 'machine-owned rows are not the user’s library');
  assert.equal(listed.includes(LOGO_ID), true);
  assert.equal((await h.assets._exportUserAssets()).some(r => r.id.startsWith(FROZEN_PREFIX)), true,
    'a backup still round-trips them');

  const storage = await versionStorage(h.ctx);
  assert.equal(storage.versions, 1);
  assert.equal(storage.frozen, 1);
  assert.equal(storage.bytes > 0, true);
});

test('a FONT pin is recorded but never frozen - nothing could ever read the copy', async () => {
  stubFetch();
  const h = makeHost();
  await seedSystem(h);
  await publishVersion(h.ctx, { label: 'v1' });
  const pins = (await readIndex(h.ctx)).versions[0]?.assets ?? [];
  assert.equal(pins.some(p => p.id === FONT_ID), true, 'the manifest still says which face the version used');

  // Replace the face. Version-scoped indirection is a rewrite of `$type: 'asset'`
  // leaves; a font is resolved by FAMILY out of the user font store, which no
  // `user/frozen/*` id can join - so a frozen copy would be storage billed to the
  // user for fidelity they do not get.
  await h.assets._uploadUserAsset({
    id: FONT_ID, type: 'font', format: 'woff2', blob: bytes('FONT-B'), meta: { family: 'Acme Sans' },
  });
  assert.deepEqual([...h.stores['user-assets']!.keys()].filter(k => k.startsWith(FROZEN_PREFIX)), [],
    'no unreachable copy was made');
  const after = (await readIndex(h.ctx)).versions[0]?.assets?.find(p => p.id === FONT_ID);
  assert.equal(after?.frozenId, undefined, 'and the pin does not claim one');
  assert.equal((await versionStorage(h.ctx)).frozen, 0);
});

test('repointing a pin does not rename the design system', async () => {
  stubFetch();
  const h = makeHost();
  await h.assets._uploadUserAsset({ id: LOGO_ID, type: 'raster', format: 'png', blob: bytes('LOGO-A') });
  await installUserTokens(h.host as unknown as Parameters<typeof installUserTokens>[0], doc(), { label: 'Acme' });
  await publishVersion(h.ctx, { label: 'v1' });
  assert.equal((h.stores['user-assets']!.get(USER_TOKENS_ID) as { meta?: { name?: string } }).meta?.name, 'Acme');

  await h.assets._uploadUserAsset({ id: LOGO_ID, type: 'raster', format: 'png', blob: bytes('LOGO-B') });
  assert.equal((h.stores['user-assets']!.get(USER_TOKENS_ID) as { meta?: { name?: string } }).meta?.name, 'Acme',
    'replacing one pinned logo is not the moment to rename somebody’s design system');
});

test('deleting a pinned file is never refused for want of space', async () => {
  stubFetch();
  const h = makeHost();
  await seedSystem(h);
  await publishVersion(h.ctx, { label: 'v1' });

  // A device at 99% of quota: any ordinary upload is refused from here on.
  const real = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { storage: { estimate: async () => ({ usage: 99, quota: 100 }) } },
  });
  try {
    await assert.rejects(
      h.assets._uploadUserAsset({ id: 'user/upload/2-big', type: 'raster', format: 'png', blob: bytes('X') }),
      /Not enough local storage space/, 'the quota guard is genuinely live');
    // The delete preserves the pinned bytes first, and that copy replaces the bytes
    // it is saving rather than joining them - so charging quota for it would leave
    // the user unable to free the very space the refusal is about.
    await h.assets._deleteUserAsset(LOGO_ID);
  } finally {
    if (real) Object.defineProperty(globalThis, 'navigator', real);
  }
  assert.equal(await h.assets._getBlob(LOGO_ID), null, 'the delete went through');
  const frozenId = frozenAssetId(await sha256Hex(new Uint8Array(await bytes('LOGO-A').arrayBuffer())));
  assert.equal(await (await h.assets._getBlob(frozenId))?.text(), 'LOGO-A', 'and the version kept its bytes');
});

test('bytes that already drifted are reported, not rewritten as history', async () => {
  stubFetch();
  const h = makeHost();
  await seedSystem(h);
  await publishVersion(h.ctx, { label: 'v1' });
  // Simulate a pre-hook drift: rewrite the stored row behind the bridge's back.
  h.stores['user-assets']!.set(LOGO_ID, {
    id: LOGO_ID, type: 'raster', format: 'png', blob: bytes('LOGO-X'),
  });

  await h.assets._uploadUserAsset({ id: LOGO_ID, type: 'raster', format: 'png', blob: bytes('LOGO-B') });
  const frozenRows = [...h.stores['user-assets']!.keys()].filter(k => k.startsWith(FROZEN_PREFIX));
  assert.deepEqual(frozenRows, [], 'freezing the wrong bytes under a published name would fabricate history');
  const pin = readVersionIndex(await h.tokens.raw()).versions[0]?.assets?.find(p => p.id === LOGO_ID);
  assert.equal(pin?.frozenId, undefined, 'the pin stays honest about having no preserved copy');
});

// ── Byte-identity: an unversioned system behaves exactly as before ────────────

test('with nothing published the copy-on-write hook reads nothing and writes nothing', async () => {
  stubFetch();
  const h = makeHost();
  await seedSystem(h);
  await h.tokens.raw();                       // boot has always warmed this
  const before = h.reads.n;
  const rows = h.stores['user-assets']!.size;

  await h.assets._uploadUserAsset({ id: LOGO_ID, type: 'raster', format: 'png', blob: bytes('LOGO-B') });
  await h.assets._deleteUserAsset('user/upload/1-nothing');

  assert.equal(h.reads.n - before, 1, 'only _deleteUserAsset’s own record read - the hook adds none');
  assert.equal(h.stores['user-assets']!.size, rows, 'no frozen row was minted');
  assert.equal(readVersionIndex(await h.tokens.raw()).versions.length, 0);
});

test('a version is read relative to the head it belongs to, not to the user id', async () => {
  // A device whose design system came from a PACK: the head is a catalogue id and
  // its versions ship beside it. Addressing them under `user/tokens/brand` makes
  // every read here return null while the panel cheerfully lists them - restore
  // says "could not be read", the compat card diffs against nothing and reports
  // the whole system as added, and storage reports zero bytes.
  stubFetch();
  const h = makeHost();
  const HEAD = 'acme/tokens/brand';
  const entry = { slug: 'v1', label: 'v1', date: '2026-08-01T00:00:00.000Z', checksum: '' };
  const head = withVersionIndex(doc('#30ba78'), { versions: [entry], active: 'v1' });
  // Synced catalog metadata + the two cached blobs, exactly as boot sync leaves them.
  h.stores['asset-meta']!.set(HEAD, {
    id: HEAD, type: 'tokens', version: '1.0.0', tier: 'core',
    formats: [{ format: 'json', url: `/catalog/assets/${HEAD}.json` }],
  });
  h.stores['asset-blob']!.set(`${HEAD}:json:1.0.0`, new Blob([JSON.stringify(head)]));
  h.stores['asset-meta']!.set(`${HEAD}/v1`, {
    id: `${HEAD}/v1`, type: 'tokens', version: '1.0.0', tier: 'core', formats: [{ format: 'json', url: '/x.json' }],
  });
  h.stores['asset-blob']!.set(`${HEAD}/v1:json:1.0.0`, new Blob([JSON.stringify(doc('#ff0000'))]));

  assert.equal(await h.tokens.headId(), HEAD, 'the head is the pack’s, not the user id');
  const stored = await readVersionDoc(h.ctx, 'v1') as Record<string, unknown>;
  assert.ok(stored, 'the version document is reachable');
  assert.equal(await h.tokens.forVersion('v1').resolve('{color.brand.jungle}'), '#ff0000');
  assert.equal((await versionStorage(h.ctx)).bytes > 0, true, 'and its bytes are billed honestly');
  const preview = await publishPreview(h.ctx, 'v2');
  assert.deepEqual(preview.diff.removed, [], 'a real baseline, so nothing reads as breaking');
  assert.deepEqual(preview.diff.changed, ['color.brand.jungle']);
});

// ── Chrome follows active-or-latest (section 6a / brand-vars.ts) ────────────────────

test('the app’s own accent follows the ACTIVE version, not the draft head', async () => {
  stubFetch();
  const { JSDOM } = await import('jsdom');
  const { applyChromeBrandVars } = await import('../../brand-vars.ts');
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'https://lolly.test/' });
  const prev = { document: globalThis.document, localStorage: globalThis.localStorage };
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  const accent = () => dom.window.document.documentElement.style.getPropertyValue('--brand-primary');
  const semantic = (hex: string) => ({ color: { semantic: { primary: { $type: 'color', $value: hex } } } });
  try {
    const h = makeHost();
    const host = h.host as unknown as Parameters<typeof applyChromeBrandVars>[0];

    // Nothing published: the head paints the chrome, exactly as before section 6a.
    await installUserTokens(h.host as unknown as Parameters<typeof installUserTokens>[0], semantic('#30ba78'), { label: 'My brand' });
    await applyChromeBrandVars(host);
    assert.equal(accent(), '#30ba78');

    // Published and active, then the head moves on: the app wears the version.
    await publishVersion(h.ctx, { label: 'v1', activate: true });
    await editHead(h, semantic('#123456'));
    await applyChromeBrandVars(host);
    assert.equal(accent(), '#30ba78', 'experiments on the head stop repainting the app once a version is live');

    // Follow the latest again and the draft is live everywhere once more.
    await setActiveVersion(h.ctx, null);
    await applyChromeBrandVars(host);
    assert.equal(accent(), '#123456');
  } finally {
    globalThis.document = prev.document;
    globalThis.localStorage = prev.localStorage;
  }
});

// ── The hook has to be unforgeable, so its wiring is asserted, not assumed ────

test('every user-asset write path that destroys bytes calls the preserver, and the bridge wires it', async () => {
  const src = await readFile(new URL('../../bridge/assets.ts', import.meta.url), 'utf8');
  const calls = src.match(/preservePinned\?\.\(/g) ?? [];
  assert.equal(calls.length, 4,
    'upload / delete / restamp / import - a fifth way to overwrite user bytes must call it too');
  // The upload guard has to run BEFORE the quota check, or a tight device would
  // refuse the replacement having already lost the version's bytes.
  const upload = src.slice(src.indexOf('async _uploadUserAsset('));
  assert.ok(upload.indexOf('await opts.preservePinned?.(') < upload.indexOf('await assertQuotaRoom('),
    'preserve first, then quota');

  const wiring = await readFile(new URL('../../bridge/index.ts', import.meta.url), 'utf8');
  assert.match(wiring, /createAssetsAPI\([\s\S]{0,200}preservePinned/,
    'the assembled bridge passes the hook - an unwired guard guards nothing');
  assert.match(wiring, /createPinPreserver\(/);
});

test('an unversioned head write is the same record it always was', async () => {
  stubFetch();
  const h = makeHost();
  await installUserTokens(h.host as unknown as Parameters<typeof installUserTokens>[0], doc(), { label: 'My brand' });
  const rec = h.stores['user-assets']!.get(USER_TOKENS_ID) as Record<string, unknown>;
  assert.equal(rec.id, USER_TOKENS_ID);
  assert.equal(rec.type, 'tokens');
  assert.equal(rec.format, 'json');
  assert.equal(rec.version, '1.0.0');
  // The bridge stamps meta.modifiedAt on every record write (plans/132 WP-A) -
  // the ONLY field the write path may add; everything else is the caller's record.
  const { modifiedAt, ...meta } = rec.meta as Record<string, unknown>;
  assert.equal(typeof modifiedAt, 'number');
  assert.deepEqual(meta, { name: 'My brand' });
  assert.equal(await (rec.blob as Blob).text(), JSON.stringify(doc()),
    'no ledger, no marker, nothing added to the document');
});
