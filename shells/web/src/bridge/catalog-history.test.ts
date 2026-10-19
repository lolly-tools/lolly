// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createAssetsAPI, type AssetMetaRecord } from './assets.ts';
import { memoryDb } from './idb-memory.test-utils.ts';
import { retainCatalogRead, readCatalogContent } from './catalog-history.ts';
import { captureRevision } from './revision-capture.ts';
import { collectAssetRefs } from './asset-ref-collector.ts';
import { encodeAssetVersion } from '../../../../engine/src/asset-version.ts';

const entry = (license: string): AssetMetaRecord => ({ id: 'ext/test/photo', version: 'unchanged-token', type: 'raster', name: 'Photo', license,
  tier: 'on-demand', formats: [{ format: 'png', url: '/catalog/ext/test/photo/original' }] });
test('an overwritten source with an unchanged token cannot replace a saved byte pin or its observed attributes', async () => {
  const { db } = memoryDb();
  await db.put('asset-meta', entry('CC-BY-4.0'));
  await db.put('asset-blob', new Blob(['old']), 'ext/test/photo:png:unchanged-token');
  const api = createAssetsAPI(db as never);
  const first = await api.get('ext/test/photo');
  assert.ok(first.pin);
  const saved = captureRevision({ image: first });
  await db.put('asset-meta', entry('private-replacement'));
  await db.put('asset-blob', new Blob(['new']), 'ext/test/photo:png:unchanged-token');
  const replacement = await api.get('ext/test/photo');
  assert.notEqual(replacement.pin?.version, first.pin?.version);
  const old = await api.get('ext/test/photo', first.pin);
  assert.equal(await (await api._getBlob(old.id, old.pin))!.text(), 'old');
  assert.equal(old.meta?.license, 'CC-BY-4.0');
  assert.ok(old.meta);
  const observation = old.meta.sourceObservation as Record<string, unknown>;
  assert.equal(observation.metadataScope, 'observed-at-read');
  assert.equal(observation.currentAuthority, 'not-checked');
  assert.deepEqual((saved.data.image as any).pin, first.pin);
  const roots = new Set<string>(); collectAssetRefs({ src: encodeAssetVersion(first.id, first.pin) }, roots);
  await api._pruneStale([], roots, new Set());
  await db.delete('asset-meta', first.id);
  assert.equal(await (await api._getBlob(first.id, first.pin))!.text(), 'old');
  assert.equal((await api.get(first.id, first.pin)).meta?.license, 'CC-BY-4.0');
});
test('same bytes and a changed policy are distinct observations; missing or corrupt retained bytes never fetch latest', async t => {
  const { db } = memoryDb();
  const ref = { source: 'library' as const, id: 'photo?file=aaaaaaaaaaaaaaaaaaaaaaaa', type: 'raster' as const, format: 'png', url: '', version: 'cache', meta: { license: 'old', fileRole: 'original' } };
  const first = await retainCatalogRead(db as never, ref, new Blob(['pixels']));
  const later = await retainCatalogRead(db as never, { ...ref, meta: { ...ref.meta, license: 'changed' } }, new Blob(['pixels']));
  assert.notEqual(first.pin?.version, later.pin?.version);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Must not contact the source'); });
  const key = `${first.id}:png:${first.pin!.version}`;
  await db.put('asset-blob', new Blob(['corrupt']), key);
  await assert.rejects(readCatalogContent(db as never, first.id, first.pin!), /integrity/);
  await assert.rejects(readCatalogContent(db as never, 'photo?file=bbbbbbbbbbbbbbbbbbbbbbbb', first.pin!), /unavailable/);
  await db.delete('asset-blob', key);
  await assert.rejects(readCatalogContent(db as never, first.id, first.pin!), /unavailable/);
});

test('legacy byte caches cannot acquire current attributes; digest pins verify hex-indexed instance originals', async () => {
  const { db } = memoryDb(), api = createAssetsAPI(db as never);
  const current = entry('current-private-terms'); current.width = 4096; current.height = 4096;
  await db.put('asset-meta', current); await db.put('asset-blob', new Blob(['old']), `${current.id}:png:legacy`);
  const legacy = await api.get(current.id, { version: 'legacy', format: 'png' });
  assert.equal(legacy.meta?.license, undefined); assert.equal(legacy.meta?.historicalMetadata, 'unavailable');
  assert.equal(legacy.width, undefined); assert.equal(legacy.height, undefined);
  const bytes = 'verified instance original', checksum = createHash('sha256').update(bytes).digest('hex');
  await db.put('asset-meta', { ...current, formats: [{ ...current.formats[0], checksum }] });
  await db.put('asset-blob', new Blob([bytes]), `${current.id}:png:${current.version}`);
  assert.ok((await api.get(current.id)).pin);
  await db.put('asset-blob', new Blob(['corrupt']), `${current.id}:png:${current.version}`);
  await assert.rejects(api.get(current.id), /checksum mismatch/);
});

test('credential lookup follows the saved upload version and never attaches the replacement credential', async () => {
  const { db } = memoryDb(), api = createAssetsAPI(db as never), id = 'user/upload/credential';
  const old = { id, type: 'raster', format: 'png', version: 'old', blob: new Blob(['old']), credential: new Uint8Array([1]), credentialFormat: 'png' };
  await db.put('user-assets', { ...old, version: 'new', credential: new Uint8Array([2]) });
  await db.put('user-asset-versions', { assetId: id, version: 'old', sha256: createHash('sha256').update('old').digest('hex'), bytes: 3, savedAt: 1, record: old });
  assert.deepEqual((await api.credential(encodeAssetVersion(id, { version: 'old', format: 'png' })))?.store, new Uint8Array([1]));
  assert.equal(await api.credential(encodeAssetVersion(id, { version: 'missing', format: 'png' })), null);
});
