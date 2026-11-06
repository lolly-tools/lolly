// SPDX-License-Identifier: MPL-2.0
/**
 * A pack the catalog serves is catalog material. Opening a tool used to copy the whole
 * pack into the person's uploads, and that copy was also the only thing that kept it
 * on the device. These tests hold both halves: nothing lands in the uploads, and the
 * set still draws with the network off.
 *
 * The device here behaves as the asset bridge does, over the REAL generated bundle:
 * `_getBlob` answers from the catalog cache and fetches only a current on-demand file
 * it lacks, and `get` plus `bytes` is the placement route that records a read.
 *
 * Run directly: node --test shells/web/src/bridge/emoji-catalog-pack.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { EmojiPackBundleV1, EmojiPackPinV1 } from '@lolly-tools/core/emoji-v1';
import { createEmojiAPI } from './emoji.ts';
import type { EmojiAssetRecord, EmojiStorage } from './emoji-storage.ts';
import { DEFAULT_EMOJI_PIN } from '../../../../engine/src/emoji-default.ts';

const repo = new URL('../../../../', import.meta.url);
interface IndexAsset { id: string; version: string; tags: string[]; formats: { format: string; url: string; size: number }[]; meta: { emoji: { id: string; version: string; checksum: string } } & Record<string, unknown> }
const index = JSON.parse(readFileSync(fileURLToPath(new URL('community/emoji-packs/index.json', repo)), 'utf8')) as { assets: IndexAsset[] };
const entry = index.assets.find(asset => asset.id === DEFAULT_EMOJI_PIN.id)!;
const fileBytes = new Uint8Array(readFileSync(fileURLToPath(new URL(`community/emoji-packs/${entry.formats[0]!.url.split('/').at(-1)}`, repo))));
const bundle = JSON.parse(new TextDecoder().decode(fileBytes)) as EmojiPackBundleV1;
const pin: EmojiPackPinV1 = structuredClone(DEFAULT_EMOJI_PIN) as EmojiPackPinV1;
const glyph = (JSON.parse(bundle.manifest) as { glyphs: { asset: { url: string; checksum: string } }[] }).glyphs[0]!;
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/** What the bug wrote, and what a person's own import of the same file writes too. */
function copyOfCatalogPack(): EmojiAssetRecord {
  const bytes = new TextEncoder().encode(JSON.stringify(bundle));
  const digest = sha256(bytes);
  return { id: `user/emoji/${digest}`, type: 'data', format: 'json', version: digest, blob: new Blob([bytes], { type: 'application/json' }),
    meta: { name: 'Fluent Emoji High Contrast', tags: ['emoji-pack'], size: bytes.length,
      emoji: { ...entry.meta.emoji, family: 'Fluent Emoji', style: 'High Contrast', label: 'Fluent Emoji High Contrast',
        license: 'MIT', licenseUrl: 'https://opensource.org/license/mit', attribution: 'Microsoft', glyphs: 1586, coverageComplete: false } } };
}

const photo = (): EmojiAssetRecord => ({ id: 'user/holiday-1', type: 'raster', format: 'png', version: 'v1', blob: new Blob([new Uint8Array([1, 2, 3])]), meta: { name: 'Holiday' } });

function device(opts: { uploads?: EmojiAssetRecord[]; cached?: Record<string, Uint8Array>; online?: boolean; listed?: IndexAsset[] } = {}) {
  const uploads = new Map((opts.uploads ?? []).map(record => [record.id, record]));
  const cache = new Map(Object.entries(opts.cached ?? {}));
  const listed = opts.listed ?? [entry];
  const seen = { online: opts.online ?? true, downloads: [] as string[], blobReads: [] as string[], placementReads: 0, writes: [] as string[], held: [] as string[][] };
  const assets: EmojiStorage = {
    async query() {
      return listed.map(asset => ({ source: 'library', id: asset.id, type: 'data', format: 'json', url: asset.formats[0]!.url, version: asset.version,
        meta: { ...asset.meta, name: 'x', tags: asset.tags, size: asset.formats[0]!.size } } as unknown as AssetRef));
    },
    // The route that fetches its url from the network, as the bridge's byte reader
    // does for a catalog file. A pack must not depend on it.
    async get(id) { seen.placementReads++; return { source: 'library', id, type: 'data', format: 'json', url: `/catalog/${id}` } as AssetRef; },
    async bytes(target) {
      const id = typeof target === 'string' ? target : target.id;
      const record = uploads.get(id);
      if (record) return new Uint8Array(await record.blob!.arrayBuffer());
      if (!seen.online) throw new Error('Failed to fetch');
      seen.downloads.push(id);
      return fileBytes;
    },
    async _getBlob(id, read = {}) {
      seen.blobReads.push(id);
      const asset = listed.find(item => item.id === id);
      if (!asset) return null;
      const version = read.version ?? asset.version;
      const key = `${id}:json:${version}`;
      const held = cache.get(key);
      if (held) return new Blob([held as unknown as BlobPart]);
      if (version !== asset.version) return null;
      if (!seen.online) throw new Error('Failed to fetch');
      seen.downloads.push(id);
      cache.set(key, fileBytes);
      return new Blob([fileBytes as unknown as BlobPart]);
    },
    async _holdCatalogAssets(ids) { seen.held.push([...ids]); },
    async _exportUserAssets() { return [...uploads.values()]; },
    async _uploadUserAsset(record) { seen.writes.push(record.id); uploads.set(record.id, record); },
    async _getUserRecord(id) { return uploads.get(id) ?? null; },
  };
  return { assets, uploads, cache, seen };
}

/** Holds the idle work until the test releases it, so "before" can be asserted. */
function idleQueue() {
  const queue: (() => void)[] = [];
  return { whenIdle: (run: () => void) => { queue.push(run); }, async flush() { for (const run of queue.splice(0)) run(); await new Promise(resolve => setTimeout(resolve, 0)); } };
}

test('opening a tool pins a catalog pack without copying it or downloading it', async () => {
  const d = device();
  const idle = idleQueue();
  const api = createEmojiAPI(d.assets, idle);
  const refs = await api.dependencies!([pin]);
  assert.deepEqual(d.seen.writes, [], 'nothing is written to the uploads');
  assert.equal(d.uploads.size, 0);
  assert.deepEqual(d.seen.downloads, [], 'and nothing is downloaded before the tool has painted');
  assert.deepEqual(refs, [{ source: 'library', id: entry.id, type: 'data', format: 'json', version: entry.version, pin: { version: entry.version, format: 'json' } }],
    'the document names the exact catalog file, which is what keeps it through the prune');
  assert.deepEqual(d.seen.held, [[entry.id]], 'and this device is told to keep the file');
});

test('the set comes onto the device once, later, as one catalog file with no parse', async () => {
  const d = device();
  const idle = idleQueue();
  const api = createEmojiAPI(d.assets, idle);
  await api.dependencies!([pin]);
  await api.dependencies!([pin]);
  await idle.flush();
  assert.deepEqual(d.seen.downloads, [entry.id], 'two tool opens, one download');
  assert.deepEqual([...d.cache.keys()], [`${entry.id}:json:${entry.version}`], 'one row, keyed as the catalog cache keys it');
  assert.equal(d.seen.placementReads, 0, 'the placement route writes a second row for its read, so a pack stays off it');
  await api.dependencies!([pin]);
  await idle.flush();
  assert.deepEqual(d.seen.downloads, [entry.id], 'a later open adds nothing');
  assert.equal(d.uploads.size, 0);
});

test('an offline device or Save-Data leaves the download for later', async () => {
  const offline = device({ online: false });
  const idle = idleQueue();
  const quiet = createEmojiAPI(offline.assets, idle);
  const nav = globalThis.navigator as unknown as Record<string, unknown>;
  const set = (key: string, value: unknown) => Object.defineProperty(nav, key, { value, configurable: true });
  set('onLine', false);
  try {
    await quiet.dependencies!([pin]);
    await idle.flush();
    assert.deepEqual(offline.seen.blobReads, [], 'offline does not even try');
    set('onLine', true);
    set('connection', { saveData: true });
    const saving = device();
    const later = idleQueue();
    await createEmojiAPI(saving.assets, later).dependencies!([pin]);
    await later.flush();
    assert.deepEqual(saving.seen.downloads, [], 'Save-Data is respected');
    assert.deepEqual(saving.seen.held, [[entry.id]], 'the choice is still recorded, for a later open');
  } finally { delete nav.onLine; delete nav.connection; }
});

test('a set on the device draws with the network off, from the catalog cache alone', async () => {
  const d = device({ online: false, cached: { [`${entry.id}:json:${entry.version}`]: fileBytes } });
  const api = createEmojiAPI(d.assets, idleQueue());
  const manifest = await api.manifest(pin);
  assert.ok(manifest, 'the exact pin resolves offline');
  assert.equal(`sha256:${sha256(manifest!)}`, pin.checksum);
  const art = await api.artwork(pin, glyph.asset as never);
  assert.equal(`sha256:${sha256(art!)}`, glyph.asset.checksum);
  assert.equal(d.seen.placementReads, 0, 'the route that needs the network is never taken');
});

test('offline with nothing held answers null, and the same pin works once back online', async () => {
  const d = device({ online: false });
  const api = createEmojiAPI(d.assets, idleQueue());
  assert.equal(await api.manifest(pin), null);
  d.seen.online = true;
  assert.ok(await api.manifest(pin), 'a failed read is not remembered as a refusal');
});

test('a person\'s uploads are untouched, including one byte-identical to the catalog pack', async () => {
  const copy = copyOfCatalogPack(), holiday = photo();
  const d = device({ uploads: [copy, holiday], online: false });
  const before = await copy.blob!.arrayBuffer();
  const metaBefore = structuredClone(copy.meta);
  const api = createEmojiAPI(d.assets, idleQueue());
  await api.sets();
  const refs = await api.dependencies!([pin]);
  await api.manifest(pin);
  assert.deepEqual(d.seen.writes, [], 'nothing is written');
  assert.deepEqual([...d.uploads.keys()], [copy.id, holiday.id], 'and nothing is removed: no rule can tell this copy from a person\'s own import');
  assert.strictEqual(d.uploads.get(copy.id), copy, 'the record itself is left alone');
  assert.deepEqual(new Uint8Array(await copy.blob!.arrayBuffer()), new Uint8Array(before));
  assert.deepEqual(copy.meta, metaBefore);
  assert.strictEqual(d.uploads.get(holiday.id), holiday);
  assert.equal(refs[0]!.source, 'library', 'new saves stop leaning on the copy');
});

test('someone who already holds a copy still draws offline with the catalog file gone', async () => {
  const copy = copyOfCatalogPack();
  const d = device({ uploads: [copy], online: false });
  const api = createEmojiAPI(d.assets, idleQueue());
  const manifest = await api.manifest(pin);
  assert.equal(`sha256:${sha256(manifest!)}`, pin.checksum, 'a device with only the copy keeps its set');
  assert.equal(`sha256:${sha256((await api.artwork(pin, glyph.asset as never))!)}`, glyph.asset.checksum);
});

test('a pack a person imported stays theirs and is still pinned by its own record', async () => {
  const dom = new JSDOM('');
  const previous = globalThis.DOMParser;
  globalThis.DOMParser = dom.window.DOMParser;
  try {
    const { fixture } = await import('../../../../tests/helpers/emoji-fixtures.ts');
    const f = await fixture();
    const own = new TextEncoder().encode(JSON.stringify({ schemaVersion: 1, kind: 'emoji-pack-bundle', manifest: new TextDecoder().decode(f.bytes), artwork: { '1f600.svg': new TextDecoder().decode(f.artwork) } }));
    const d = device({ listed: [] });
    const api = createEmojiAPI(d.assets, idleQueue());
    const info = await api.install!(own);
    assert.equal(d.uploads.size, 1, 'an import is what a person added, so it does belong in the uploads');
    const [ref] = await api.dependencies!([info.pin]);
    assert.equal(ref!.source, 'user');
    assert.equal(ref!.id, [...d.uploads.keys()][0]);
    assert.deepEqual(d.seen.held, [], 'and it is not catalog material to keep');
  } finally { globalThis.DOMParser = previous; dom.window.close(); }
});

test('a release the catalog has moved on from still draws from the file a document kept', async () => {
  const moved: IndexAsset = { ...entry, version: '2099.1.1', meta: { ...entry.meta, emoji: { ...entry.meta.emoji, version: '2099.1.1', checksum: `sha256:${'0'.repeat(64)}` } } };
  const d = device({ listed: [moved], online: false, cached: { [`${entry.id}:json:${entry.version}`]: fileBytes } });
  const api = createEmojiAPI(d.assets, idleQueue());
  const manifest = await api.manifest(pin);
  assert.equal(`sha256:${sha256(manifest!)}`, pin.checksum, 'the exact artwork the document pinned');
  const refs = await api.dependencies!([pin]);
  assert.deepEqual(refs.map(ref => ref.pin), [{ version: entry.version, format: 'json' }], 'and a new save keeps naming it');
  assert.deepEqual((await api.sets()).map(set => set.pin.pin.version), ['2099.1.1'], 'it is not offered as a new choice');
});

test('a link cannot read another catalog file by naming it as a pack', async () => {
  const d = device({ online: false });
  const api = createEmojiAPI(d.assets, idleQueue());
  const reads = d.seen.blobReads;
  assert.equal(await api.manifest({ id: 'lolly/photo/hero', pin: { version: '1.0.0' }, checksum: pin.checksum }), null);
  assert.deepEqual(reads, [], 'an id the catalog does not list as a set is never read');
  assert.equal(await api.manifest({ ...pin, checksum: `sha256:${'f'.repeat(64)}` }), null, 'and the current release under another checksum is no substitute');
});
