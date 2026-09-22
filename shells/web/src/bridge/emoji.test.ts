// SPDX-License-Identifier: MPL-2.0
/**
 * The web emoji bridge over a stand-in assets surface holding the REAL generated
 * bundle from the shared emoji-packs root, so the bytes under test are the bytes
 * every profile's catalog serves.
 *
 * Run directly:  node --test shells/web/src/bridge/emoji.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { EmojiPackBundleV1, EmojiPackPinV1 } from '@lolly-tools/core/emoji-v1';
import { createEmojiAPI, type EmojiAssets } from './emoji.ts';

const repo = new URL('../../../../', import.meta.url);
const indexPath = fileURLToPath(new URL('community/emoji-packs/index.json', repo));
const ASSET_ID = 'community/emoji/twemoji/color';

interface CatalogAsset {
  id: string;
  tags?: string[];
  formats?: { format?: string; url?: string; size?: number }[];
  meta?: Record<string, unknown>;
}

const index = JSON.parse(readFileSync(indexPath, 'utf8')) as { assets: CatalogAsset[] };
const entry = index.assets.find((asset) => asset.id === ASSET_ID)!;
const bundleUrl = entry.formats!.find((format) => format.format === 'json')!.url!;
// The url is the shared namespace, /catalog/packs/emoji-packs/<file>, and the file
// itself lives in the root that namespace is served from.
const bundleBytes = readFileSync(fileURLToPath(new URL(`community/emoji-packs/${bundleUrl.split('/').at(-1)}`, repo)));
const bundle = JSON.parse(bundleBytes.toString('utf8')) as EmojiPackBundleV1;
const entryMeta = (entry.meta as { emoji: { id: string; version: string; checksum: string; glyphs: number } }).emoji;
const pin: EmojiPackPinV1 = { id: entryMeta.id, pin: { version: entryMeta.version }, checksum: entryMeta.checksum };
const sha256 = (bytes: Uint8Array | string): string => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

/** The query/get/bytes slice of the assets bridge, over the real index entry and file. */
function fakeAssets(overrides: { bytes?: () => Promise<Uint8Array>; assets?: CatalogAsset[] } = {}): EmojiAssets & { gets: number } {
  const listed = overrides.assets ?? [entry];
  const api = {
    gets: 0,
    async query(filter: { tags?: string[] } = {}): Promise<AssetRef[]> {
      const tags = filter.tags ?? [];
      return listed
        .filter((asset) => tags.every((tag) => asset.tags?.includes(tag)))
        .map((asset) => ({
          source: 'library' as const,
          id: asset.id,
          type: 'data' as const,
          format: 'json',
          url: asset.formats?.[0]?.url ?? '',
          // The real bridge rides the entry's own `meta` block first, then its
          // computed keys; this mirrors that order.
          meta: {
            ...(asset.meta ?? {}),
            name: 'x', tags: asset.tags,
            // The real bridge puts the primary format's byte length here, which is
            // the only size a caller can read before the download.
            ...(typeof asset.formats?.[0]?.size === 'number' ? { size: asset.formats[0].size } : {}),
          },
        }));
    },
    async get(id: string): Promise<AssetRef> {
      api.gets++;
      const asset = listed.find((candidate) => candidate.id === id);
      if (!asset) throw new Error(`Asset not in catalog: ${id}`);
      return { source: 'library', id, type: 'data', format: 'json', url: asset.formats?.[0]?.url ?? '' };
    },
    async bytes(): Promise<Uint8Array> {
      return overrides.bytes ? overrides.bytes() : new Uint8Array(bundleBytes);
    },
  };
  return api;
}

test('sets() lists the catalog pack from its index entry alone', async () => {
  const api = createEmojiAPI(fakeAssets());
  const sets = await api.sets();
  assert.equal(sets.length, 1);
  const [set] = sets;
  assert.deepEqual(set!.pin, pin);
  assert.equal(set!.family, 'Twemoji');
  assert.equal(set!.style, 'Color');
  assert.equal(set!.label, 'Twemoji Color');
  assert.equal(set!.license, 'CC-BY-4.0');
  assert.equal(set!.glyphs, entryMeta.glyphs);
  assert.equal(set!.coverageComplete, true, 'the shipped pack covers every canonical entry');
});

test('sets() skips an entry whose meta.emoji is incomplete', async () => {
  const broken: CatalogAsset = { id: 'x/y/z', tags: ['emoji-pack'], formats: [{ format: 'json', url: '/catalog/assets/emoji/x.json' }], meta: { emoji: { id: 'x/y/z', version: '1.0.0' } } };
  const api = createEmojiAPI(fakeAssets({ assets: [broken, entry] }));
  const sets = await api.sets();
  assert.deepEqual(sets.map((set) => set.pin.id), [ASSET_ID]);
});

test('manifest() returns the exact bytes the pin names, and nothing for another pin', async () => {
  const assets = fakeAssets();
  const api = createEmojiAPI(assets);
  const bytes = await api.manifest(pin);
  assert.ok(bytes, 'the exact pin resolves');
  assert.equal(sha256(bytes!), pin.checksum, 'the returned bytes hash to the pin');
  assert.equal(new TextDecoder().decode(bytes!), bundle.manifest);

  assert.equal(await api.manifest({ ...pin, pin: { version: '9.9.9' } }), null, 'another version is not substituted');
  assert.equal(await api.manifest({ ...pin, checksum: sha256('nope') }), null, 'another checksum is not substituted');
  assert.equal(await api.manifest({ ...pin, id: 'community/emoji/openmoji/color' }), null, 'another set is not substituted');
});

test('a second read of the same pin reuses the parsed bundle', async () => {
  const assets = fakeAssets();
  const api = createEmojiAPI(assets);
  await api.manifest(pin);
  await api.manifest(pin);
  assert.equal(assets.gets, 1, 'the bundle is fetched once per pin');
});

test('artwork() returns bytes that hash to the glyph checksum the manifest pins', async () => {
  const api = createEmojiAPI(fakeAssets());
  const manifest = JSON.parse(bundle.manifest) as { glyphs: { asset: { url: string; checksum: string }; label: string }[] };
  assert.ok(manifest.glyphs.length >= 100, 'the pack carries a real repertoire');
  for (const glyph of [manifest.glyphs[0]!, manifest.glyphs[42]!, manifest.glyphs.at(-1)!]) {
    const bytes = await api.artwork(pin, glyph.asset as never);
    assert.ok(bytes, `artwork for ${glyph.label}`);
    assert.equal(sha256(bytes!), glyph.asset.checksum);
  }
  assert.equal(await api.artwork(pin, { url: 'not-a-glyph.svg' } as never), null, 'an unknown url is not invented');
});

test('a failed bundle download can be retried without reloading the catalog', async () => {
  let attempts = 0;
  const assets = fakeAssets({ bytes: async () => {
    if (++attempts === 1) throw new Error('Offline');
    return new Uint8Array(bundleBytes);
  } });
  const api = createEmojiAPI(assets);
  assert.equal(await api.manifest(pin), null);
  assert.equal(sha256((await api.manifest(pin))!), pin.checksum);
  assert.equal(attempts, 2);
  await api.manifest(pin);
  assert.equal(attempts, 2, 'the successful retry stays cached');
});

test('a tampered manifest text is refused, so a rewritten bundle cannot be served', async () => {
  const tampered = JSON.stringify({ ...bundle, manifest: `${bundle.manifest} ` });
  const api = createEmojiAPI(fakeAssets({ bytes: async () => new TextEncoder().encode(tampered) }));
  assert.equal(await api.manifest(pin), null, 'one extra byte breaks the pin');
  assert.equal(await api.artwork(pin, { url: 'not-checked.svg' } as never), null, 'and no artwork rides in on it');
});

test('a bundle that is not an emoji-pack-bundle is refused', async () => {
  const wrong = JSON.stringify({ schemaVersion: 1, kind: 'something-else', manifest: bundle.manifest, artwork: {} });
  const api = createEmojiAPI(fakeAssets({ bytes: async () => new TextEncoder().encode(wrong) }));
  assert.equal(await api.manifest(pin), null);
});

test('a bundle whose index entry states too many bytes is refused before it downloads', async () => {
  // The 64 MiB ceiling is worth nothing after the fetch: bytes() materialises the
  // whole file, then the decode and the parse each copy it again.
  let fetched = 0;
  const huge: CatalogAsset = {
    ...entry,
    formats: [{ ...entry.formats![0], size: 64 * 1024 * 1024 + 1 }],
  };
  const assets = fakeAssets({ assets: [huge], bytes: async () => { fetched++; return new Uint8Array(bundleBytes); } });
  const api = createEmojiAPI(assets);
  // Compared as a boolean: a failing assert.equal against a multi-megabyte
  // Uint8Array builds a diff big enough to take the runner out.
  assert.equal(await api.manifest(pin) === null, true, 'an oversized pack is not loaded');
  assert.equal(fetched, 0, 'and its bytes were never asked for');
});

test('artwork is read as an own property, never off the prototype', async () => {
  const api = createEmojiAPI(fakeAssets());
  for (const key of ['toString', 'constructor', 'hasOwnProperty', '__proto__']) {
    assert.equal(await api.artwork(pin, { url: key } as never), null, `${key} names no glyph`);
  }
});

test('sets() reports the download size the index entry states', async () => {
  const api = createEmojiAPI(fakeAssets());
  const [set] = await api.sets();
  assert.equal(set!.bytes, entry.formats![0]!.size, 'the web host reports the same bytes the Node host does');
});
