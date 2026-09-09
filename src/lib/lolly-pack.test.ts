// SPDX-License-Identifier: MPL-2.0
/**
 * `.lolly` share file - headless round-trip (plans/114 Wave 2).
 *
 * Builds a file for a session that references a device-local upload AND two catalog
 * assets (one licensed), then reads it back and asserts the closure rules hold:
 *   - user/* bytes always travel; catalog bytes travel by default;
 *   - a licensed/brand-pack asset travels only with includeLicensed, else it degrades
 *     to a resolve-local ref (never silently dropped);
 *   - the session round-trips byte-for-byte and integrity verifies;
 *   - the creator block honours the useDetails opt-in.
 *
 * Pure + DOM-free, exactly like beam-pack / data-transfer round-trip tests: a real
 * fflate zip, real Blobs, real Web Crypto integrity - no bridge, no browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeAssetVersion } from '../../../../engine/src/asset-version.ts';
import type { BeamAssetRecord, BeamPackHost, BeamSessionRow } from './beam-pack.ts';
import {
  buildLollyFile,
  readLollyFile,
  ingestLollyFile,
  applyLollyRekey,
  creatorFromProfile,
  extractBundledTool,
  LOLLY_FILE_FORMAT,
  LOLLY_MIME,
  type LollyLibraryAsset,
  type LollyToolBundle,
} from './lolly-pack.ts';

/** A tiny in-memory beam host - the same seam beam-pack's own tests use, so the
 *  `.lolly` ingest (which drives ingestBeamItem) runs headlessly end to end. */
function memHost() {
  const userStore = new Map<string, BeamAssetRecord>();
  const slots = new Map<string, { data: unknown; thumb?: string | null }>();
  const host: BeamPackHost = {
    state: {
      list: async (): Promise<BeamSessionRow[]> => [...slots.keys()].map(slot => ({ slot })),
      load: async (slot: string) => slots.get(slot)?.data ?? null,
      save: async (slot: string, data: unknown, thumb?: string | null) => { slots.set(slot, { data, thumb }); },
      delete: async (slot: string) => { slots.delete(slot); },
    },
    assets: {
      _exportUserAssets: async () => [...userStore.values()],
      _uploadUserAsset: async (rec: BeamAssetRecord) => { userStore.set(rec.id, rec); },
      _getUserRecord: async (id: string) => userStore.get(id) ?? null,
      _deleteUserAsset: async (id: string) => { userStore.delete(id); },
    },
  };
  return { host, userStore, slots };
}

const PNG = (tag: number) => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, tag, 0, 0]);

test('.lolly carries two exact versions of one upload and pins each imported copy', async () => {
  const id = 'user/upload/versioned';
  const record = (version: string, tag: number): BeamAssetRecord => ({ id, type: 'raster', format: 'png', version, blob: new Blob([PNG(tag)], { type: 'image/png' }) });
  const old = record('v1', 1), current = record('v2', 2);
  const ref = (version: string) => ({ id, source: 'user', type: 'raster', format: 'png', version, pin: { version, format: 'png' }, url: '' });
  const session = { __toolId: 'design', a: ref('v1'), b: ref('v2') };
  const built = await buildLollyFile({ session, toolId: 'design', userAssets: [current], resolveUser: async (asked, version) => asked === id && version === 'v1' ? old : null });
  assert.deepEqual(built.manifest.assets.map(item => item.id), ['v1', 'v2'].map(version => encodeAssetVersion(id, { version, format: 'png' })));
  const target = memHost();
  const imported = await ingestLollyFile(await built.blob.arrayBuffer(), target.host);
  const out = imported.session as typeof session;
  assert.notEqual(out.a.id, out.b.id);
  for (const [ref, tag] of [[out.a, 1], [out.b, 2]] as const) {
    const saved = target.userStore.get(ref.id)!;
    assert.equal(ref.pin.version, saved.version);
    assert.deepEqual(new Uint8Array(await saved.blob!.arrayBuffer()), PNG(tag));
  }
  const missing = await buildLollyFile({ session, toolId: 'design', userAssets: [current] });
  assert.equal(missing.manifest.assets[0]!.kind, 'asset-ref', 'missing old bytes never embed the current asset');
  assert.equal(missing.manifest.assets[1]!.kind, 'asset');
});

const UPLOAD_ID = 'user/upload/123-logo.png';
const CATALOG_ID = 'lolly-start/pattern/waves';   // ordinary catalog art
const BRAND_ID = 'suse/logo/primary';             // licensed / brand-pack

const uploadBytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 4, 5]);
const catalogBytes = new Uint8Array([60, 115, 118, 103, 62]);          // "<svg>"
const brandBytes = new Uint8Array([66, 82, 65, 78, 68]);               // "BRAND"

function firstZipEntryName(bytes: Uint8Array): string {
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04], 'ZIP begins with a local-file header');
  const nameLength = bytes[26]! | (bytes[27]! << 8);
  return new TextDecoder().decode(bytes.slice(30, 30 + nameLength));
}

function makeSession() {
  return {
    __toolId: 'demo-tool',
    __toolVersion: '3',
    __export_format: 'png',
    title: 'A design after many edits',
    logo: { source: 'user', id: UPLOAD_ID, url: 'blob:whatever' },
    background: { source: 'library', id: CATALOG_ID, url: '' },
    brandmark: { source: 'library', id: BRAND_ID, url: '' },
  };
}

const userAssets: BeamAssetRecord[] = [
  { id: UPLOAD_ID, type: 'raster', format: 'png', blob: new Blob([uploadBytes], { type: 'image/png' }), meta: { name: 'My Logo' } },
];

const resolveLibrary = async (id: string): Promise<LollyLibraryAsset | null> => {
  if (id === CATALOG_ID) return { bytes: catalogBytes, mime: 'image/svg+xml', type: 'vector', format: 'svg', label: 'Waves' };
  if (id === BRAND_ID) return { bytes: brandBytes, mime: 'image/svg+xml', type: 'vector', format: 'svg', label: 'SUSE Logo', licensed: true };
  return null;
};

test('.lolly build → read round-trips the session and carries user + catalog bytes', async () => {
  const { blob, filename, manifest, summary } = await buildLollyFile({
    session: makeSession(), toolId: 'demo-tool', toolVersion: '3', name: 'My Design',
    userAssets, resolveLibrary, appVersion: 'Lolly 1.0.0',
    creator: creatorFromProfile({ firstname: 'Ada', lastname: 'L', email: 'ada@x.io', org: 'ACME', useDetails: true }, { appVersion: 'Lolly 1.0.0', now: '2026-08-13T00:00:00.000Z' }),
  });

  assert.equal(blob.type, LOLLY_MIME);
  assert.equal(filename, 'My-Design.lolly');
  assert.equal(manifest.format, LOLLY_FILE_FORMAT);
  assert.equal(manifest.kind, 'session');
  assert.equal(manifest.tool.id, 'demo-tool');
  assert.equal(manifest.tool.version, '3');

  // Default (no includeLicensed): user + ordinary catalog carry bytes; brand asset is a ref.
  assert.equal(summary.assetCount, 2, 'user upload + ordinary catalog carried');
  assert.equal(summary.byReferenceCount, 1, 'the licensed brand asset is not embedded');
  assert.equal(summary.hasLicensed, true);
  assert.equal(summary.licensedExcluded, 1);
  assert.equal(summary.creatorName, 'Ada L');

  const upload = manifest.assets.find(a => a.id === UPLOAD_ID)!;
  assert.equal(upload.kind, 'asset');
  assert.equal(upload.source, 'user');
  assert.equal(upload.bytes, uploadBytes.length);
  assert.equal(upload.label, 'My Logo');
  // Usable, human-legible path: the asset's own name + an extension matching the bytes.
  assert.equal(upload.path, 'assets/uploads/My-Logo.png');

  const cat = manifest.assets.find(a => a.id === CATALOG_ID)!;
  assert.equal(cat.kind, 'asset');
  assert.equal(cat.source, 'library');

  const brand = manifest.assets.find(a => a.id === BRAND_ID)!;
  assert.equal(brand.kind, 'asset-ref', 'licensed asset is a ref by default');
  assert.equal(brand.licensed, true);
  assert.equal(brand.bytes, undefined);

  // Read back.
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(firstZipEntryName(bytes), 'manifest.json', 'streaming preflight can identify the file immediately');
  const parsed = await readLollyFile(bytes);
  assert.deepEqual(parsed.session, makeSession(), 'session round-trips byte-for-byte');
  assert.ok(parsed.files[upload.path!], 'the upload bytes are in the archive');
  assert.deepEqual([...parsed.files[upload.path!]!], [...uploadBytes], 'upload bytes are byte-exact');
  assert.deepEqual([...parsed.files[cat.path!]!], [...catalogBytes], 'catalog bytes are byte-exact');
  assert.ok(!('assets/blobs' in parsed.files) || !parsed.files[brand.path as string], 'no bytes for the held-back brand asset');

  // Integrity is exercised headlessly (Web Crypto present in the test runtime).
  if (manifest.integrity) {
    assert.ok(manifest.integrity[upload.path!], 'integrity map covers the upload');
    assert.equal(upload.checksum, manifest.integrity[upload.path!], 'asset checksum mirrors the integrity map');
  }
});

test('.lolly carries a licensed brand asset only with includeLicensed', async () => {
  const { manifest, summary } = await buildLollyFile({
    session: makeSession(), toolId: 'demo-tool', userAssets, resolveLibrary, includeLicensed: true,
  });
  const brand = manifest.assets.find(a => a.id === BRAND_ID)!;
  assert.equal(brand.kind, 'asset', 'licensed asset now carries bytes');
  assert.equal(brand.bytes, brandBytes.length);
  assert.equal(summary.assetCount, 3);
  assert.equal(summary.byReferenceCount, 0);
  assert.equal(summary.licensedExcluded, 0);
  assert.equal(summary.hasLicensed, true);
});

test('.lolly records a stale/missing user ref instead of dropping it', async () => {
  // The session references an upload we no longer hold the bytes for.
  const { manifest, summary } = await buildLollyFile({
    session: { logo: { source: 'user', id: 'user/upload/gone.png', url: '' } },
    toolId: 'demo-tool', userAssets: [], resolveLibrary,
  });
  assert.equal(summary.assetCount, 0);
  assert.equal(summary.byReferenceCount, 1);
  const ref = manifest.assets[0]!;
  assert.equal(ref.kind, 'asset-ref');
  assert.equal(ref.source, 'user');
  assert.equal(ref.id, 'user/upload/gone.png');
});

test('.lolly gives carried blobs usable names + extensions, deduped on collision', async () => {
  // Two uploads that share a name, one catalog asset - and an upload whose format is
  // empty so the extension must come from the mime type.
  const session = {
    a: { source: 'user', id: 'user/upload/1-photo.jpg', url: '' },
    b: { source: 'user', id: 'user/upload/2-photo.jpg', url: '' },
    c: { source: 'library', id: 'suse/logo/primary', url: '' },
    d: { source: 'user', id: 'user/upload/3-clip', url: '' },
  };
  const { manifest } = await buildLollyFile({
    session, toolId: 'demo-tool',
    userAssets: [
      { id: 'user/upload/1-photo.jpg', type: 'raster', format: 'webp', blob: new Blob([PNG(1)], { type: 'image/webp' }), meta: { name: 'photo.webp' } },
      { id: 'user/upload/2-photo.jpg', type: 'raster', format: 'webp', blob: new Blob([PNG(2)], { type: 'image/webp' }), meta: { name: 'photo.webp' } },
      // No meta.name and an empty format ⇒ name falls to the id's last segment, ext to the mime.
      { id: 'user/upload/3-clip', type: 'video', format: '', blob: new Blob([PNG(3)], { type: 'video/mp4' }) },
    ],
    resolveLibrary: async (id) => id === 'suse/logo/primary'
      ? { bytes: new Uint8Array([60]), mime: 'image/svg+xml', type: 'vector', format: 'svg', label: 'SUSE Logo' } : null,
  });
  const path = (id: string) => manifest.assets.find(a => a.id === id)!.path;
  assert.equal(path('user/upload/1-photo.jpg'), 'assets/uploads/photo.webp', 'own name + real ext, no double extension');
  assert.equal(path('user/upload/2-photo.jpg'), 'assets/uploads/photo-2.webp', 'the collision is deduped');
  assert.equal(path('suse/logo/primary'), 'assets/catalog/SUSE-Logo.svg', 'catalog asset under assets/catalog/ by its label');
  assert.equal(path('user/upload/3-clip'), 'assets/uploads/3-clip.mp4', 'no name/format ⇒ id segment + mime-derived ext');
});

test('.lolly carries the tool under tool/, integrity-covered, and extracts it back', async () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  const tool: LollyToolBundle = {
    id: 'demo-tool',
    version: '2.0.0',
    trust: 'custom',
    files: {
      'tool.json': enc('{"id":"demo-tool"}'),
      'template.html': enc('<div>{{title}}</div>'),
      'hooks.js': enc('export function onInit(){}'),
      'assets/logo.svg': enc('<svg/>'),
      // A path that tries to escape the folder must be neutralised.
      '../evil.js': enc('bad'),
    },
  };
  const built = await buildLollyFile({
    session: makeSession(), toolId: 'demo-tool', toolVersion: '2.0.0',
    userAssets, resolveLibrary, tool,
  });

  const bt = built.manifest.bundledTool!;
  assert.ok(bt, 'the manifest records the bundled tool');
  assert.equal(bt.id, 'demo-tool');
  assert.equal(bt.version, '2.0.0');
  assert.equal(bt.trust, 'custom');
  assert.equal(built.summary.toolFiles, 4, 'four real files (the ../evil.js escape is dropped)');
  assert.equal(built.summary.toolTrust, 'custom');
  // Every recorded file lives under tool/ and is checksummed via the integrity map.
  for (const f of bt.files) {
    assert.ok(f.path.startsWith('tool/'), `${f.path} is under tool/`);
    assert.equal(f.checksum, built.manifest.integrity![f.path], 'file checksum mirrors integrity');
  }
  assert.ok(!bt.files.some(f => f.path.includes('evil')), 'the folder-escape path never made it in');

  // Read + integrity-verify, then pull the tool out for the installer.
  const parsed = await readLollyFile(new Uint8Array(await built.blob.arrayBuffer()));
  const extracted = extractBundledTool(parsed)!;
  assert.equal(extracted.id, 'demo-tool');
  assert.equal(extracted.trust, 'custom');
  assert.equal(new TextDecoder().decode(extracted.files['template.html']), '<div>{{title}}</div>', 'tool/ prefix stripped, bytes exact');
  assert.equal(new TextDecoder().decode(extracted.files['assets/logo.svg']), '<svg/>');
});

test('.lolly without a tool carries none (backwards-compatible default)', async () => {
  const built = await buildLollyFile({ session: makeSession(), toolId: 'demo-tool', userAssets, resolveLibrary });
  assert.equal(built.manifest.bundledTool, undefined, 'no bundledTool block when the tool is not carried');
  assert.equal(built.summary.toolFiles, 0);
  const parsed = await readLollyFile(new Uint8Array(await built.blob.arrayBuffer()));
  assert.equal(extractBundledTool(parsed), null);
});

test('.lolly import lands assets + session, rewriting user AND carried-library refs', async () => {
  const userPng = PNG(1), libPng = PNG(2);
  const session = {
    __toolId: 'demo-tool', __toolVersion: '3',
    logo: { source: 'user', id: 'user/upload/aaa.png', url: 'blob:x' },
    bg: { source: 'library', id: 'lolly-start/pattern/waves', url: '' },
  };
  const built = await buildLollyFile({
    session, toolId: 'demo-tool', toolVersion: '3',
    userAssets: [{ id: 'user/upload/aaa.png', type: 'raster', format: 'png', blob: new Blob([userPng], { type: 'image/png' }), meta: { name: 'Logo' } }],
    resolveLibrary: async (id) => id === 'lolly-start/pattern/waves'
      ? { bytes: libPng, mime: 'image/png', type: 'raster', format: 'png', label: 'Waves' } : null,
  });
  assert.equal(built.summary.assetCount, 2, 'both the upload and the (non-licensed) catalog asset carry bytes');

  const store = memHost();
  const res = await ingestLollyFile(new Uint8Array(await built.blob.arrayBuffer()), store.host);

  assert.equal(res.imported, 2, 'both assets written to the user store');
  assert.equal(res.deduped, 0);
  assert.equal(res.toolId, 'demo-tool');
  assert.ok(store.slots.has(res.slot), 'a new session slot was minted');

  const s = res.session as { logo: { source: string; id: string }; bg: { source: string; id: string } };
  assert.equal(s.logo.source, 'user');
  assert.notEqual(s.logo.id, 'user/upload/aaa.png');            // re-keyed to a receiver-local id
  assert.ok(store.userStore.has(s.logo.id), 'the upload landed under its new id');
  assert.equal(s.bg.source, 'user', 'the carried catalog asset became a local user asset');
  assert.notEqual(s.bg.id, 'lolly-start/pattern/waves');
  assert.ok(store.userStore.has(s.bg.id));

  const back = store.userStore.get(s.logo.id)!;
  assert.deepEqual([...new Uint8Array(await back.blob!.arrayBuffer())], [...userPng], 'bytes are byte-exact through the round trip');
});

test('.lolly import accepts an already-verified read and reports bounded progress', async () => {
  const built = await buildLollyFile({
    session: { logo: { source: 'user', id: 'user/upload/progress.png', url: '' } },
    toolId: 'demo-tool',
    userAssets: [{ id: 'user/upload/progress.png', type: 'raster', format: 'png', blob: new Blob([PNG(4)], { type: 'image/png' }) }],
  });
  const parsed = await readLollyFile(new Uint8Array(await built.blob.arrayBuffer()));
  const progress: string[] = [];
  const store = memHost();
  await ingestLollyFile(parsed, store.host, {
    onProgress: (p) => progress.push(`${p.phase}:${p.current}/${p.total}`),
  });
  assert.deepEqual(progress, ['assets:1/1', 'session:1/1']);
});

test('.lolly import dedups an asset already on the device (by checksum)', async () => {
  const png = PNG(7);
  const built = await buildLollyFile({
    session: { logo: { source: 'user', id: 'user/upload/dup.png', url: '' } },
    toolId: 'demo-tool',
    userAssets: [{ id: 'user/upload/dup.png', type: 'raster', format: 'png', blob: new Blob([png], { type: 'image/png' }), meta: { name: 'Dup' } }],
  });
  const store = memHost();
  const bytes = new Uint8Array(await built.blob.arrayBuffer());

  const first = await ingestLollyFile(bytes, store.host);
  assert.equal(first.imported, 1);
  const second = await ingestLollyFile(bytes, store.host);
  assert.equal(second.imported, 0, 'the second import writes no new asset row');
  assert.equal(second.deduped, 1, 'it is deduped by checksum');
  assert.equal(store.userStore.size, 1, 'only one copy of the bytes lives on the device');
  // Both imported sessions point at the same, single, receiver-local asset id.
  const a = (first.session as { logo: { id: string } }).logo.id;
  const b = (second.session as { logo: { id: string } }).logo.id;
  assert.equal(a, b);
});

test('applyLollyRekey leaves un-mapped and baked refs untouched', () => {
  const rekey = new Map([['user/upload/x.png', 'user/lolly/1']]);
  const out = applyLollyRekey({
    a: { source: 'user', id: 'user/upload/x.png', url: 'blob:x' },
    b: { source: 'library', id: 'suse/logo/primary', url: '' },          // not carried ⇒ left as a catalog ref
    c: { source: 'user', id: 'user/upload/x.png', url: '', meta: { baked: true } }, // baked ⇒ never rewritten
  }, rekey) as Record<'a' | 'b' | 'c', { source: string; id: string }>;
  assert.equal(out.a.source, 'user');
  assert.equal(out.a.id, 'user/lolly/1');
  assert.equal(out.b.source, 'library');
  assert.equal(out.b.id, 'suse/logo/primary');
  assert.equal(out.c.id, 'user/upload/x.png', 'a baked ref keeps its own bytes');
});

test('creatorFromProfile embeds identity only with the useDetails opt-in', () => {
  const optedOut = creatorFromProfile({ firstname: 'Ada', lastname: 'L', email: 'ada@x.io', org: 'ACME' }, { appVersion: 'Lolly 1.0.0' });
  assert.equal(optedOut.name, undefined, 'no name without opt-in');
  assert.equal(optedOut.email, undefined);
  assert.equal(optedOut.org, undefined);
  assert.equal(optedOut.createdWith, 'Lolly 1.0.0', 'the non-personal "made with" line always travels');

  const optedIn = creatorFromProfile({ firstname: 'Ada', lastname: 'L', useDetails: true }, { orgFallback: 'Contoso Inc' });
  assert.equal(optedIn.name, 'Ada L');
  assert.equal(optedIn.org, 'Contoso Inc', 'the instance name fills the org line when the user has none');
});

test('.lolly carries the sender\'s design system as its own integrity-covered part, and reads it back', async () => {
  const doc = { color: { brand: { $type: 'color', $value: '#30ba78' } } };
  const built = await buildLollyFile({ session: { a: 1 }, toolId: 'design', userAssets: [], designSystem: { doc, label: 'Acme' } });
  assert.deepEqual(built.manifest.designSystem, { label: 'Acme' });
  assert.ok(built.manifest.integrity?.['design-system.json'], 'the part is in the integrity map');
  const parsed = await readLollyFile(new Uint8Array(await built.blob.arrayBuffer()));
  assert.deepEqual(parsed.designSystem, doc);
  // Without one, nothing about the format changes.
  const plain = await buildLollyFile({ session: { a: 1 }, toolId: 'design', userAssets: [] });
  assert.equal(plain.manifest.designSystem, undefined);
  assert.equal((await readLollyFile(new Uint8Array(await plain.blob.arrayBuffer()))).designSystem, undefined);
});
