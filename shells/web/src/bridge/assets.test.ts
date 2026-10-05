// SPDX-License-Identifier: MPL-2.0
/**
 * host.assets query type-matching (plans/162). The asset picker's catalog rail
 * used to hide items an input could accept - a motion (onFrame) tool's image slot
 * hid every catalog VIDEO while showing the user's own video uploads. The fix
 * threads `motion` through typeMatches so an `image` query admits video for a
 * motion slot, and the picker now trusts this narrowing instead of re-filtering.
 *
 * Run: node --test shells/web/src/bridge/assets.test.ts
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createAssetsAPI, typeMatches, withoutReservedMeta } from './assets.ts';

test('provider catalog queries retain small thumbnails and source metadata without fetching originals', async context => {
  context.mock.method(globalThis, 'fetch', async () => { throw new Error('A catalog query must not download files'); });
  const common = { provider: 'brand', tier: 'on-demand', version: 'upstream1', description: 'From the shared brand library', tags: ['provider:brand'], meta: { providerLabel: 'Brand library', providerSections: ['Logos'], providerTags: ['Launch'], providerCollections: ['Launch Kit'] } };
  const rows = [
    { ...common, id: 'ext/brand/photo', type: 'raster', name: 'Photo', formats: [{ format: 'jpeg', url: '/photo.jpeg' }, { format: 'thumb', url: '/photo-thumb' }] },
    { ...common, id: 'ext/brand/logo', type: 'vector', name: 'Logo', formats: [{ format: 'eps', url: '/source.eps' }, { format: 'svg', url: '/logo.svg' }, { format: 'thumb', url: '/logo-thumb' }] },
    { ...common, id: 'ext/brand/movie', type: 'video', name: 'Movie', formats: [{ format: 'mp4', url: '/movie.mp4' }, { format: 'thumb', url: '/movie-thumb' }] },
  ];
  const refs = await createAssetsAPI({ getAll: async () => rows } as never).query();
  assert.deepEqual(refs.map(ref => ref.url), ['/photo.jpeg', '/logo.svg', '/movie.mp4']);
  assert.deepEqual(refs.map(ref => ref.meta?.thumbUrl), ['/photo-thumb', '/logo-thumb', '/movie-thumb']);
  assert.equal(refs[2]?.meta?.posterUrl, '/movie-thumb');
  for (const ref of refs) {
    assert.equal(ref.meta?.provider, 'brand');
    assert.equal(ref.meta?.description, common.description);
    assert.deepEqual(ref.meta?.providerSections, ['Logos']);
    assert.deepEqual(ref.meta?.providerCollections, ['Launch Kit']);
    assert.deepEqual(ref.meta?.providerTags, ['Launch']);
    assert.equal(ref.version, 'upstream1');
  }
});

test('verified catalog bytes remain usable when the browser cannot cache a Blob', async context => {
  const body = '{"emoji":"pack"}';
  const checksum = `sha256-${createHash('sha256').update(body).digest('base64')}`;
  const readObjectUrl = globalThis.fetch;
  context.mock.method(globalThis, 'fetch', async () => new Response(body, { headers: { 'Content-Type': 'application/json' } }));
  const warning = context.mock.method(console, 'warn', () => {});
  const meta = { id: 'test/cache-refusal', type: 'data', version: '1', tier: 'on-demand', meta: { providerLabel: 'Brand library', providerSections: ['Logos'], providerTags: ['Launch'] }, formats: [{ format: 'json', url: '/pack.json', checksum }] };
  const db = { get: async (store: string) => store === 'asset-meta' ? meta : undefined,
    put: async () => { throw new Error('Error preparing Blob/File data to be stored in object store'); } };
  const ref = await createAssetsAPI(db as never).get(meta.id, { format: 'json' });
  // Read the actual returned object URL, bypassing the download mock.
  const response = await readObjectUrl(ref.url);
  assert.ok(ref.url.startsWith('blob:'));
  assert.deepEqual(ref.meta?.providerSections, ['Logos']);
  assert.deepEqual(ref.meta?.providerTags, ['Launch']);
  assert.equal(await response.text(), body);
  assert.equal(warning.mock.callCount(), 1);
  URL.revokeObjectURL(ref.url);
});

test('a corrupt catalog download is refused before any cache write', async context => {
  context.mock.method(globalThis, 'fetch', async () => new Response('changed bytes'));
  let writes = 0;
  const meta = { id: 'test/corrupt-cache', type: 'data', version: '1', tier: 'on-demand', formats: [{ format: 'json', url: '/pack.json', checksum: 'sha256-invalid' }] };
  const db = { get: async (store: string) => store === 'asset-meta' ? meta : undefined,
    put: async () => { ++writes; } };
  await assert.rejects(createAssetsAPI(db as never).get(meta.id), /Asset checksum mismatch/);
  assert.equal(writes, 0);
});

test('an untyped query admits every type', () => {
  for (const t of ['raster', 'vector', 'video', 'audio', 'text', 'data', 'font']) {
    assert.equal(typeMatches(t, undefined), true, `${t} under no filter`);
  }
});

test('an exact type matches only itself', () => {
  assert.equal(typeMatches('audio', 'audio'), true);
  assert.equal(typeMatches('text', 'text'), true);
  assert.equal(typeMatches('data', 'data'), true);
  assert.equal(typeMatches('raster', 'audio'), false);
  assert.equal(typeMatches('video', 'audio'), false);
});

test('an image slot is the still-image superset (raster OR vector), not video', () => {
  assert.equal(typeMatches('raster', 'image'), true);
  assert.equal(typeMatches('vector', 'image'), true);
  assert.equal(typeMatches('video', 'image'), false, 'a still-image slot excludes video');
  assert.equal(typeMatches('audio', 'image'), false);
});

test('motion widens an image slot to also admit video (the catalog-video fix)', () => {
  assert.equal(typeMatches('video', 'image', true), true, 'a motion tool takes catalog video');
  assert.equal(typeMatches('raster', 'image', true), true, 'still images still admitted');
  assert.equal(typeMatches('vector', 'image', true), true);
  assert.equal(typeMatches('audio', 'image', true), false, 'motion does not admit audio');
  // motion only widens `image`; it never loosens an exact type.
  assert.equal(typeMatches('video', 'audio', true), false);
});

// ── _replaceUserAssetBytes: new bytes at the same id (plans/181 section 5.2) ──

/** The two stores this method touches, as a Map the assertions can read. */
function fakeDb(seed: Record<string, Record<string, unknown>>) {
  const rows = new Map<string, Record<string, unknown>>(Object.entries(seed));
  return {
    rows,
    db: {
      get: async (_store: string, id: string) => rows.get(id),
      put: async (_store: string, record: { id: string }) => { rows.set(record.id, record); },
    },
  };
}

function ttsRow() {
  return {
    id: 'user/tts/1-hello',
    type: 'audio',
    format: 'wav',
    blob: new Blob(['old'], { type: 'audio/wav' }),
    version: '1.0.0',
    aiGenerated: 'full',
    credential: new Uint8Array([1, 2, 3]),
    credentialFormat: 'wav',
    meta: { name: 'Hello', tags: ['audio', 'tts'], bytes: 3, durationMs: 1000, tts: { voice: 'bf_lily' } },
  };
}

describe('_replaceUserAssetBytes', () => {
  test('swaps bytes, credential and the changed meta, and bumps version', async () => {
    const { rows, db } = fakeDb({ 'user/tts/1-hello': ttsRow() });
    const pinned: string[] = [];
    const api = createAssetsAPI(db as never, { preservePinned: async (id) => { pinned.push(id); } });

    const blob = new Blob(['much longer bytes'], { type: 'audio/wav' });
    await api._replaceUserAssetBytes('user/tts/1-hello', {
      blob,
      credential: new Uint8Array([9, 9]),
      credentialFormat: 'wav',
      meta: { durationMs: 2500, tts: { voice: 'af_heart+bf_lily:0.3' } },
    });

    const rec = rows.get('user/tts/1-hello') as Record<string, unknown>;
    assert.equal(rec.blob, blob, 'the new bytes are stored');
    assert.deepEqual(rec.credential, new Uint8Array([9, 9]));
    assert.equal(rec.credentialFormat, 'wav');
    assert.notEqual(rec.version, '1.0.0', 'version bumps so cached object URLs are dropped');
    assert.equal(rec.aiGenerated, 'full', 'the AI disclosure rides along untouched');
    // meta MERGES: what the take changed is replaced, the rest survives.
    const meta = rec.meta as Record<string, unknown>;
    assert.equal(meta.name, 'Hello');
    assert.deepEqual(meta.tags, ['audio', 'tts']);
    assert.equal(meta.durationMs, 2500);
    assert.deepEqual(meta.tts, { voice: 'af_heart+bf_lily:0.3' });
    assert.equal(meta.bytes, blob.size, 'bytes always comes from the blob, never the caller');
    // The bytes a published version checksummed are preserved before the swap.
    assert.deepEqual(pinned, ['user/tts/1-hello']);
  });

  test('a patch with no credential drops the stored one, because it no longer binds the file', async () => {
    const { rows, db } = fakeDb({ 'user/tts/1-hello': ttsRow() });
    const api = createAssetsAPI(db as never, {});
    await api._replaceUserAssetBytes('user/tts/1-hello', { blob: new Blob(['new']) });
    const rec = rows.get('user/tts/1-hello') as Record<string, unknown>;
    assert.equal('credential' in rec, false);
    assert.equal('credentialFormat' in rec, false);
  });

  test('the id never moves, and a missing asset is a no-op', async () => {
    const { rows, db } = fakeDb({ 'user/tts/1-hello': ttsRow() });
    const api = createAssetsAPI(db as never, {});
    await api._replaceUserAssetBytes('user/tts/1-hello', { blob: new Blob(['new']) });
    assert.deepEqual([...rows.keys()], ['user/tts/1-hello'], 'no second row was written');

    await api._replaceUserAssetBytes('user/tts/gone', { blob: new Blob(['new']) });
    assert.equal(rows.size, 1, 'nothing is created for an asset that is not there');
  });

  test('the object URL for the old bytes is revoked, not left resolving', async () => {
    const { db } = fakeDb({ 'user/tts/1-hello': ttsRow() });
    const api = createAssetsAPI(db as never, {});
    const revoked: string[] = [];
    let n = 0;
    const realCreate = URL.createObjectURL;
    const realRevoke = URL.revokeObjectURL;
    URL.createObjectURL = () => `blob:take-${++n}`;
    URL.revokeObjectURL = (url: string) => { revoked.push(url); };
    try {
      const before = await api.get('user/tts/1-hello');
      await api._replaceUserAssetBytes('user/tts/1-hello', { blob: new Blob(['new bytes']) });
      // The version bump alone only stops a NEW ref reusing the URL. The old
      // one stayed in the cache and kept resolving to bytes that no longer
      // exist, so anything still holding it played the previous take.
      assert.deepEqual(revoked, [before.url]);
      const after = await api.get('user/tts/1-hello');
      assert.notEqual(after.url, before.url, 'and the next read mints a fresh one');
    } finally {
      URL.createObjectURL = realCreate;
      URL.revokeObjectURL = realRevoke;
    }
  });

  test('_restampUserAsset is the same write with only a credential to change', async () => {
    const { rows, db } = fakeDb({ 'user/tts/1-hello': ttsRow() });
    const pinned: string[] = [];
    const api = createAssetsAPI(db as never, { preservePinned: async (id) => { pinned.push(id); } });
    const blob = new Blob(['stamped bytes']);
    await api._restampUserAsset('user/tts/1-hello', {
      blob, credential: new Uint8Array([7]), credentialFormat: 'wav',
    });
    const rec = rows.get('user/tts/1-hello') as Record<string, unknown>;
    assert.equal(rec.blob, blob);
    assert.deepEqual(rec.credential, new Uint8Array([7]));
    assert.equal((rec.meta as Record<string, unknown>).bytes, blob.size);
    assert.deepEqual((rec.meta as Record<string, unknown>).tts, { voice: 'bf_lily' }, 'the heal changes no meta of its own');
    assert.deepEqual(pinned, ['user/tts/1-hello']);
  });
});

// ── The entry's free-form meta blob may not answer a rights question ──────────

test("a catalog entry's unvalidated meta blob never shadows a validated field", () => {
  // schemas/asset.schema.json declares this blob as "not validated beyond being
  // an object", and it is spread ahead of the computed keys so the type-specific
  // facts a shell needs before download (an emoji pack's pin, glyph count) ride
  // along. The rights and identity keys are stripped out of it first: they are
  // top-level fields of the entry, validated, and an entry whose blob answered
  // one of them could state a licence nothing checked and disagree with the same
  // asset's resolved ref.
  const out = withoutReservedMeta({
    emoji: { pin: 'x', glyphs: 3953 },
    license: 'CC0-1.0',
    attribution: 'whatever the blob says',
    rights: { works: [] },
    brandLock: true,
    name: 'not the name',
    tags: ['not the tags'],
  });
  assert.deepEqual(out, { emoji: { pin: 'x', glyphs: 3953 } });
});

test('a meta blob that is not an object at all is read as empty', () => {
  for (const value of [null, undefined, 'a string', 42, ['an', 'array']]) {
    assert.deepEqual(withoutReservedMeta(value), {});
  }
});
