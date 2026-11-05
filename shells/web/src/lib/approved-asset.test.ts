// SPDX-License-Identifier: MPL-2.0
/**
 * lib/approved-asset.ts - an approved file kept in a person's own library, with its link
 * back to the request.
 *
 * Run directly:  node --test shells/web/src/lib/approved-asset.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { approvalLinkOf, approvedAssetId, storeApprovedFile, type ApprovedAssetHost } from './approved-asset.ts';

const link = { id: 'apr_1', instance: 'https://i', sha256: 'a'.repeat(64), decidedAt: '2026-11-02T00:00:00Z' };
type Stored = Parameters<ApprovedAssetHost['assets']['_uploadUserAsset']>[0];

function host(held: string[] = []): { host: ApprovedAssetHost; stored: Stored[] } {
  const stored: Stored[] = [];
  return { stored, host: { assets: {
    _uploadUserAsset: async (record) => { stored.push(record); },
    _listUserAssets: async () => held.map(id => ({ id })),
  } } };
}

test('the file is stored as given, naming its request', async () => {
  const blob = new Blob(['bytes'], { type: 'image/png' });
  const { host: h, stored } = host();
  const id = await storeApprovedFile(h, { blob, name: 'card.png', format: 'png', toolId: 'card', width: 600, height: 400, link });
  assert.equal(id, 'user/approved/apr_1');
  assert.equal(stored.length, 1);
  const [record] = stored;
  assert.equal(record!.blob, blob, 'the same bytes, not a copy made here');
  assert.equal(record!.type, 'raster');
  assert.equal(record!.checksum, link.sha256);
  assert.equal(record!.width, 600);
  assert.deepEqual(record!.meta.tags, ['approved']);
  assert.deepEqual(record!.meta.approval, link);
});

test('one request keeps one copy', async () => {
  const { host: h, stored } = host([approvedAssetId('apr_1')]);
  assert.equal(await storeApprovedFile(h, { blob: new Blob(['x']), name: 'c.png', format: 'png', toolId: 'c', link }), 'user/approved/apr_1');
  assert.equal(stored.length, 0);
});

test('the asset id is safe whatever the request id holds', () => {
  assert.equal(approvedAssetId('apr/../x y'), 'user/approved/apr____x_y');
});

test('a record reads back its link, or says there is none', () => {
  assert.deepEqual(approvalLinkOf({ approval: link }), link);
  assert.equal(approvalLinkOf({}), null);
  assert.equal(approvalLinkOf(undefined), null);
  assert.equal(approvalLinkOf({ approval: { id: 'apr_1' } }), null, 'a partial record is not a link');
  assert.equal(approvalLinkOf({ approval: 'apr_1' }), null);
});
