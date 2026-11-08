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

test('agent metadata discovery includes dimensions and formats without fetching a JXL original', async context => {
  context.mock.method(globalThis, 'fetch', async () => { throw new Error('Metadata listing fetched an original'); });
  const api = createAssetsAPI({ getAll: async () => [{ id: 'photo', type: 'raster', name: 'Photo',
    formats: [{ format: 'jxl', url: '/photo.jxl', width: 1200, height: 800 }, { format: 'png', url: '/photo.png' }, { format: 'thumb', url: '/thumb.webp' }] }] } as never);
  const [ref] = await api._queryMetadata();
  assert.equal(ref!.width, 1200); assert.equal(ref!.height, 800);
  assert.deepEqual(ref!.meta?.formats, ['jxl', 'png']);
});

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

// A link export (`?format=png&export`) and a framed tool never run the idle warming pass
// that fills the core tier, so on a fresh browser the brand logo was "not cached" and
// every Certificate, Stationery or Agenda exported from a link came out without one.
test('a core-tier asset missing from the cache is fetched, verified and stored on first read', async context => {
  const body = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 2"/>';
  const checksum = `sha256-${createHash('sha256').update(body).digest('base64')}`;
  const readObjectUrl = globalThis.fetch;
  const fetched: string[] = [];
  context.mock.method(globalThis, 'fetch', async (url: string) => { fetched.push(String(url)); return new Response(body, { headers: { 'Content-Type': 'image/svg+xml' } }); });
  const meta = { id: 'demo/logo/horizontal', type: 'vector', version: '3', tier: 'core', formats: [{ format: 'svg', url: '/logo.svg', checksum }] };
  const stored = new Map<string, unknown>();
  const db = {
    get: async (store: string, key: string) => store === 'asset-meta' ? meta : store === 'asset-blob' ? stored.get(key) : undefined,
    put: async (store: string, value: unknown, key: string) => { if (store === 'asset-blob') stored.set(key, value); },
  };
  const api = createAssetsAPI(db as never);
  const ref = await api.get(meta.id);
  assert.deepEqual(fetched, ['/logo.svg']);
  assert.ok(stored.has('demo/logo/horizontal:svg:3'), 'the bytes are kept under the key the warming pass checks');
  assert.equal(await (await readObjectUrl(ref.url)).text(), body);
  // A second read is served from the cache.
  await api.get(meta.id);
  assert.equal(fetched.length, 1);
  URL.revokeObjectURL(ref.url);
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

// ── Sizes and durations a listing can show without reading bytes (plan 302) ──

/** One stored upload record, the shape `_listUserAssets` and `get()` read. */
const upload = (id: string, bytes: string, meta: Record<string, unknown> = {}) =>
  ({ id, type: 'raster', format: 'png', version: '1', blob: new Blob([bytes]), meta: { name: id, ...meta } as Record<string, unknown> });

/** A fake asset db holding these upload records and no catalog rows. */
const uploadsDb = (records: ReturnType<typeof upload>[]) => ({
  getAll: async (store: string) => (store === 'user-assets' ? records : []),
  get: async (store: string, id: string) => (store === 'user-assets' ? records.find(r => r.id === id) : undefined),
});

test('an upload ref carries its stored byte length, read off the blob, on every path', async () => {
  const records = [upload('user/upload/1800000000000-a', 'twelve bytes')];
  const api = createAssetsAPI(uploadsDb(records) as never);
  const [listed] = await api._listUserAssets();
  assert.equal(listed?.meta?.bytes, 12, 'the listing (Assets and the picker)');
  const resolved = await api.get('user/upload/1800000000000-a');
  assert.equal(resolved.meta?.bytes, 12, 'and get()');
  assert.equal(records[0]!.meta.bytes, undefined, 'the stored record is not written to');
  for (const ref of [listed!, resolved]) URL.revokeObjectURL(ref.url);
});

test('a byte length a writer already recorded is kept', async () => {
  // Some ingest paths record the size of the file as it arrived, before a
  // re-encode; the stamp only fills the gap where nothing was recorded.
  const api = createAssetsAPI(uploadsDb([upload('user/upload/1800000000000-b', 'xyz', { bytes: 4096 })]) as never);
  const [ref] = await api._listUserAssets();
  assert.equal(ref?.meta?.bytes, 4096);
  URL.revokeObjectURL(ref!.url);
});

test('a catalog listing carries the primary format\'s authored duration and refuses a placeholder', async () => {
  const entry = (id: string, durationMs: unknown) => ({ id, type: 'audio', name: id, version: '1',
    formats: [{ format: 'xm', url: `/${id}.xm`, size: 2048, durationMs }] });
  const rows = [entry('song/good', 193333), entry('song/zero', 0), entry('song/nan', Number.NaN),
    entry('song/inf', Number.POSITIVE_INFINITY), entry('song/negative', -5), entry('song/text', '193333')];
  const refs = await createAssetsAPI({ getAll: async () => rows } as never).query();
  assert.deepEqual(refs.map(ref => ref.meta?.durationMs), [193333, undefined, undefined, undefined, undefined, undefined]);
  for (const ref of refs.slice(1)) assert.equal('durationMs' in (ref.meta ?? {}), false, `${ref.id} has no durationMs key`);
  assert.equal(refs[0]?.meta?.size, 2048, 'beside the byte length the index already carried');
});

test('a catalog listing reads the duration off the format it points at, not a companion still', async () => {
  const rows = [{ id: 'clip/intro', type: 'video', name: 'Intro', version: '1',
    formats: [{ format: 'png', url: '/intro.png' }, { format: 'mp4', url: '/intro.mp4', durationMs: 4200 }] }];
  const [ref] = await createAssetsAPI({ getAll: async () => rows } as never).query();
  assert.equal(ref?.url, '/intro.mp4');
  assert.equal(ref?.meta?.durationMs, 4200);
});

test('an upload asked for with a look the catalog does not offer still carries its stored size', async () => {
  // No photo-treatments palette is synced, so the look is unknown and the plain
  // upload comes back under the treated id: its own blob, so its own size.
  const api = createAssetsAPI(uploadsDb([upload('user/upload/1800000000000-c', 'nine byte')]) as never);
  const ref = await api.get('user/upload/1800000000000-c?treatment=not-a-look');
  assert.equal(ref.id, 'user/upload/1800000000000-c?treatment=not-a-look');
  assert.equal(ref.meta?.bytes, 9);
  URL.revokeObjectURL(ref.url);
});

// The icon colours a design system offers are its colourways (engine brand-treatments.ts
// colourwayIconThemes). A colourway id is offered and baked; a hand-written palette id is
// no longer offered but still bakes, so a piece made with one keeps its colours.
test('colourway icon colours are offered and baked, and a palette id still bakes', async context => {
  const { readFileSync } = await import('node:fs');
  const demo = JSON.parse(readFileSync(new URL('../../../../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json', import.meta.url), 'utf8'));
  const sri = (body: string): string => `sha256-${createHash('sha256').update(body).digest('base64')}`;
  const icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><style>.c1{fill:#50c369}.c2{fill:#033633}</style></defs><path class="c1" d="M0 0h5v5H0z"/><path class="c2" d="M5 5h5v5H5z"/></svg>';
  const palette = JSON.stringify({ themes: [{ id: 'brand', label: 'Green Apple', c1: '#50c369', c2: '#033633' }, { id: 'ember', label: 'Outback', c1: '#ee9138', c2: '#72251c' }] });
  const bodies: Record<string, string> = { '/star.svg': icon, '/icon-themes.json': palette };
  const metas = [
    { id: 'demo/icons/star', type: 'vector', version: '1', tier: 'core', tags: ['icon', 'themable'], formats: [{ format: 'svg', url: '/star.svg', checksum: sri(icon) }] },
    { id: 'demo/palette/icon-themes', type: 'palette', version: '1', tier: 'core', tags: ['palette', 'icon-themes'], formats: [{ format: 'json', url: '/icon-themes.json', checksum: sri(palette) }] },
  ];
  const readObjectUrl = globalThis.fetch;
  context.mock.method(globalThis, 'fetch', async (url: string) => new Response(bodies[String(url)] ?? '', { headers: { 'Content-Type': String(url).endsWith('.svg') ? 'image/svg+xml' : 'application/json' } }));
  // The palette is core tier, so catalog sync has already cached it, as on a device.
  const stored = new Map<string, unknown>([['demo/palette/icon-themes:json:1', new Blob([palette], { type: 'application/json' })]]);
  const db = {
    get: async (store: string, key: string) => store === 'asset-meta' ? metas.find((m) => m.id === key) : store === 'asset-blob' ? stored.get(key) : undefined,
    getAll: async (store: string) => store === 'asset-meta' ? metas : [],
    put: async (store: string, value: unknown, key: string) => { if (store === 'asset-blob') stored.set(key, value); },
  };
  const api = createAssetsAPI(db as never, { designSystemDocument: async () => demo }) as unknown as ReturnType<typeof createAssetsAPI> & {
    _iconThemes(): Promise<Array<{ id: string }>>; _knownIconThemes(): Promise<Array<{ id: string }>>;
  };
  const offered = (await api._iconThemes()).map((t) => t.id);
  assert.deepEqual(offered, ['colourway-spearmint', 'colourway-morning', 'colourway-spring', 'colourway-beach', 'colourway-afternoon', 'colourway-midnight']);
  const { colourwaySurfaceIconThemes } = await import('../../../../engine/src/brand-treatments.ts');
  assert.deepEqual((await api._knownIconThemes()).map((t) => t.id), [...colourwaySurfaceIconThemes(demo).map((t) => t.id), 'brand', 'ember'],
    'every colourway pairing resolves, dark ones included, then a palette a catalog still ships');

  const morning = await api.get('demo/icons/star?theme=colourway-morning');
  const baked = await (await readObjectUrl(morning.url)).text();
  assert.match(baked, /fill="#fac044"/, 'the Morning accent');
  assert.match(baked, /fill="#c55123"/, 'the Morning base');
  assert.equal(morning.id, 'demo/icons/star?theme=colourway-morning', 'the pick keeps its id');

  const ember = await api.get('demo/icons/star?theme=ember');
  assert.match(await (await readObjectUrl(ember.url)).text(), /fill="#ee9138"/, 'an older palette pick keeps its colours');

  const none = createAssetsAPI(db as never) as unknown as { _iconThemes(): Promise<unknown[]> };
  assert.deepEqual(await none._iconThemes(), [], 'no design system document: no colourways, nothing offered');

  // "Colourway asset treatments" off: nothing is offered, and a piece that names a
  // colourway look still bakes its colours.
  const { overrideFlagInMemory, COLOURWAY_ASSET_TREATMENTS_FLAG } = await import('../feature-flags.ts');
  overrideFlagInMemory(COLOURWAY_ASSET_TREATMENTS_FLAG.id, false);
  try {
    const off = createAssetsAPI(db as never, { designSystemDocument: async () => demo }) as unknown as typeof api & { _photoTreatments(): Promise<unknown[]> };
    assert.deepEqual(await off._iconThemes(), [], 'no icon colours offered');
    assert.deepEqual(await off._photoTreatments(), [], 'no photo washes offered');
    const kept = await off.get('demo/icons/star?theme=colourway-morning');
    assert.match(await (await readObjectUrl(kept.url)).text(), /fill="#fac044"/, 'an existing pick keeps its colours');
  } finally {
    overrideFlagInMemory(COLOURWAY_ASSET_TREATMENTS_FLAG.id, true);
  }
  for (const ref of [morning, ember]) URL.revokeObjectURL(ref.url);
});
