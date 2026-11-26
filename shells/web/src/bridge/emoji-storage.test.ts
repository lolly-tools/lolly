// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeVersionedUserAsset, type VersionedUserAsset } from './asset-history.ts';
import { storeEmojiBundle, writeOnce, type EmojiStorage } from './emoji-storage.ts';
import type { EmojiPackBundleV1, EmojiPackManifestV1, EmojiSetInfoV1 } from '@lolly-tools/core/emoji-v1';

/** The asset store's real write path over one in-memory table, as two tabs share one database. */
function sharedStore() {
  const current = new Map<string, VersionedUserAsset>();
  const history: Array<{ assetId: string; version: string }> = [];
  const store = (name: string) => ({
    get: async (key: string | string[]) => name === 'user-assets'
      ? current.get(String(key))
      : history.find(entry => entry.assetId === key[0] && entry.version === key[1]),
    getAll: async () => history,
    put: async (record: VersionedUserAsset) => { current.set(record.id, record); },
    add: async (record: { assetId: string; version: string }) => { history.push(record); },
  });
  const db = {
    objectStoreNames: { contains: () => true },
    get: (name: string, key: string) => store(name).get(key),
    getAll: async () => history,
    put: async (_name: string, record: VersionedUserAsset) => { current.set(record.id, record); },
    transaction: () => ({ objectStore: store, done: Promise.resolve() }),
  };
  const assets = {
    query: async () => [],
    get: async () => { throw new Error('not used'); },
    bytes: async () => new Uint8Array(),
    _getUserRecord: async (id: string) => current.get(id) ?? null,
    _uploadUserAsset: (record: VersionedUserAsset) => writeVersionedUserAsset(db as never, record),
  } as unknown as EmojiStorage;
  return { assets, current };
}

const manifest = { source: { license: 'MIT' }, glyphs: [] } as unknown as EmojiPackManifestV1;
const bundle = { schemaVersion: 1, kind: 'emoji-pack-bundle', manifest: JSON.stringify(manifest), artwork: {} } as unknown as EmojiPackBundleV1;
const info = {
  pin: { id: 'test/set', pin: { version: '1.0.0' }, checksum: 'sha256:abc' }, family: 'Test', style: 'color', label: 'Test set', license: 'MIT',
  licenseUrl: '', attribution: '', glyphs: 0, coverageComplete: false,
} as unknown as EmojiSetInfoV1;

test('two writers storing the same pack at once both succeed', async () => {
  const { assets, current } = sharedStore();
  const [first, second] = await Promise.all([storeEmojiBundle(assets, bundle, info), storeEmojiBundle(assets, bundle, info)]);
  assert.equal(first.id, second.id, 'the id comes from the bytes');
  assert.equal(current.size, 1);
  assert.equal(current.get(first.id)!.version, first.pin!.version);
});

test('storing a pack that is already there writes nothing', async () => {
  const { assets, current } = sharedStore();
  const ref = await storeEmojiBundle(assets, bundle, info);
  const written = current.get(ref.id);
  await storeEmojiBundle(assets, bundle, info);
  assert.equal(current.get(ref.id), written);
});

test('a write that fails with no record to show for it still reports the failure', async () => {
  const assets = {
    _getUserRecord: async () => null,
    _uploadUserAsset: async () => { throw new Error('Not enough local storage space'); },
  } as unknown as EmojiStorage;
  await assert.rejects(writeOnce(assets, { id: 'user/emoji/x', type: 'data', format: 'json' }), /Not enough local storage space/);
});
