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
import { createAssetsAPI, typeMatches } from './assets.ts';

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
