// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFeaturedVariant, renderMissingLook, isManifestLook } from './featured-render.ts';
import { previewContextSignature } from './preview-context.ts';

const THUMB = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>';
const VALUES = { headline: 'demo' };

function spyHost(keys: string[]) {
  const host = {
    previews: {
      get: async (key: string) => {
        keys.push(key);
        return { thumb: THUMB, sig: JSON.stringify([VALUES, await previewContextSignature(host)]) };
      },
      put: async () => {},
    },
  } as unknown as Parameters<typeof renderFeaturedVariant>[0];
  return host;
}

test('isManifestLook separates a manifest URL from a live render', () => {
  assert.equal(isManifestLook('/catalog/previews/demo.look0.svg'), true);
  assert.equal(isManifestLook(THUMB), false);
});

test('previews reuse the active-brand cache without requesting build-time artwork', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected build-time preview request'); });
  const keys: string[] = [];
  assert.equal(await renderFeaturedVariant(spyHost(keys), 'demo', ['svg'], 0, VALUES), THUMB);
  assert.deepEqual(keys, ['featured:demo:0:svg']);
});

test('legacy missing-look callers also reuse a brand-scoped render', async () => {
  const keys: string[] = [];
  assert.equal(await renderMissingLook(spyHost(keys), 'demo', ['svg'], 0, VALUES), THUMB);
  assert.deepEqual(keys, ['featured-missing:demo:0:svg']);
});
