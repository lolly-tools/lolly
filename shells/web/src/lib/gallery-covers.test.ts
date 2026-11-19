// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { bakedCover, bakedCoverSet, coverContextHash, pickBakedCover, type BakedCoverManifest } from './gallery-covers.ts';
import { previewContextSignature } from './preview-context.ts';

const manifest: BakedCoverManifest = {
  v: 1,
  contexts: { aaa: 'light', bbb: 'dark' },
  covers: {
    design: {
      version: '1.0.0',
      light: { templateId: 'cover', file: '/catalog/previews/covers/design.light.webp' },
      dark: { templateId: 'cover-dark', file: '/catalog/previews/covers/design.dark.webp' },
    },
    plain: { version: '2.0.0', light: { file: '/catalog/previews/covers/plain.light.svg' } },
  },
};
const design = { id: 'design', version: '1.0.0' };

test('a visitor in a baked context gets the file for the cover of that theme', () => {
  assert.equal(pickBakedCover(manifest, 'aaa', design, 0, 'cover'), '/catalog/previews/covers/design.light.webp');
  assert.equal(pickBakedCover(manifest, 'bbb', design, 0, 'cover-dark'), '/catalog/previews/covers/design.dark.webp');
});

test('a theme that hides earlier looks still finds its cover by template id', () => {
  assert.equal(pickBakedCover(manifest, 'aaa', design, 1, 'cover'), '/catalog/previews/covers/design.light.webp');
});

test('a tool whose first look has no template matches a file with no template', () => {
  assert.equal(pickBakedCover(manifest, 'aaa', { id: 'plain', version: '2.0.0' }, 0), '/catalog/previews/covers/plain.light.svg');
});

test('anything that differs from what was baked renders live', () => {
  assert.equal(pickBakedCover(manifest, 'other-brand', design, 0, 'cover'), null, 'another design system');
  assert.equal(pickBakedCover(manifest, 'aaa', { id: 'design', version: '1.0.1' }, 0, 'cover'), null, 'a newer tool version');
  assert.equal(pickBakedCover(manifest, 'aaa', design, 0, 'another-template'), null, 'a different cover');
  assert.equal(pickBakedCover(manifest, 'aaa', { id: 'plain', version: '2.0.0' }, 1), null, 'only the first default look is baked');
  assert.equal(pickBakedCover(manifest, 'bbb', { id: 'plain', version: '2.0.0' }, 0), null, 'not baked in this theme');
  assert.equal(pickBakedCover(manifest, 'aaa', { id: 'unknown', version: '1.0.0' }, 0), null, 'an unknown tool');
  assert.equal(pickBakedCover(null, 'aaa', design, 0, 'cover'), null, 'no manifest');
});

test('the context hash is stable and hides the tokens it covers', async () => {
  const hash = await coverContextHash('{"tokens":["secret"]}');
  assert.equal(hash, await coverContextHash('{"tokens":["secret"]}'));
  assert.notEqual(hash, await coverContextHash('{"tokens":["other"]}'));
  assert.match(hash, /^[0-9a-f]{32}$/);
});

/** A clean visitor of one design system: the pack's tokens, no colourway, no details. */
function visitor(brand: string, reads = { tokens: 0 }) {
  return {
    reads,
    tokens: {
      get: async () => { reads.tokens += 1; return { query: () => [{ path: 'color.primary', type: 'color', value: '#0c322c' }] }; },
      active: async () => ({ id: brand }),
      colors: async () => [],
    },
    profile: { get: async () => null },
  } as unknown as Parameters<typeof bakedCoverSet>[0] & { reads: { tokens: number } };
}

test('one context read and one manifest serve every cover of a gallery paint', async (t) => {
  const baked = visitor('pack');
  const hash = await coverContextHash(await previewContextSignature(baked));
  let fetched = 0;
  const realFetch = globalThis.fetch;
  const hadImage = 'Image' in globalThis;
  // The lookup needs a browser's Image to exist; nothing here decodes one.
  if (!hadImage) Object.assign(globalThis, { Image: class { decode(): Promise<void> { return Promise.reject(new Error('no decoder here')); } } });
  globalThis.fetch = (async () => {
    fetched += 1;
    return new Response(JSON.stringify({ ...manifest, source: { fingerprint: 'abc' }, contexts: { [hash]: 'light' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = realFetch;
    if (!hadImage) delete (globalThis as { Image?: unknown }).Image;
    delete globalThis.__lollyBakeCovers; delete globalThis.__lollyCoverContext;
  });

  baked.reads.tokens = 0;
  const set = await bakedCoverSet(baked);
  assert.ok(set, 'a visitor in the baked context gets a set');
  assert.equal(baked.reads.tokens, 1, 'the tokens are read once for the whole grid');
  assert.equal(set.fileFor(design, 0, 'cover'), '/catalog/previews/covers/design.light.webp');
  assert.equal(set.fileFor({ id: 'plain', version: '2.0.0' }, 0), '/catalog/previews/covers/plain.light.svg');
  assert.equal(set.fileFor({ id: 'design', version: '9.9.9' }, 0, 'cover'), null, 'a newer tool version renders live');
  assert.equal(set.fileFor(design, 0, 'another-template'), null);
  assert.equal(baked.reads.tokens, 1, 'looking a cover up reads nothing');

  assert.equal(await bakedCoverSet(visitor('another-design-system')), null, 'a visitor outside the baked context gets nothing baked');
  assert.equal(fetched, 1, 'the manifest is fetched once');
  assert.equal(await bakedCover(baked, design, 0, 'cover'), null, 'the per-look path still refuses a file that does not decode');

  // The bake itself must always render live, and reports the context it drew under.
  globalThis.__lollyBakeCovers = true;
  assert.equal(await bakedCoverSet(baked), null);
  assert.equal(globalThis.__lollyCoverContext, hash);
});
