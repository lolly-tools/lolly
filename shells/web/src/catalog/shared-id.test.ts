// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSharedCatalogId } from './asset-record.ts';
import { CatalogCurationError, inspectCatalogAsset, saveCatalogFields, sharedAssetId } from './curation.ts';

test('a shared catalog id is ext/ or inst/ and plain path segments, never one that steps to another route', () => {
  for (const id of ['inst/abc', 'inst/a1_b-c.d', 'ext/dam/folder/x.png']) assert.equal(isSharedCatalogId(id), true, id);
  for (const id of ['inst/../admin', 'inst/a/../../x', 'inst/./x', 'inst//x', 'inst/x/', 'inst/', 'user/x', 'inst/a?b', 'inst/a%2e%2e', 'inst/a b', '/inst/x'])
    assert.equal(isSharedCatalogId(id), false, id);
  assert.equal(sharedAssetId({ id: 'inst/../admin', url: '', format: 'png', type: 'image' } as never), null);
});

test('curation refuses a malformed id before any request is made', async () => {
  let calls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => { calls++; return new Response('{}'); }) as typeof fetch;
  try {
    for (const run of [() => inspectCatalogAsset('inst/../admin'), () => saveCatalogFields('inst/./x', {})]) {
      await assert.rejects(run(), (error: unknown) => error instanceof CatalogCurationError && error.status === 404);
    }
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});
