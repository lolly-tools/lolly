// SPDX-License-Identifier: MPL-2.0
/**
 * _uploadUserAsset captures what the incoming bytes already carry (plans/130).
 *
 * WHY THIS IS A TEST AND NOT A COMMENT. `credential(id)` is the ONLY route a
 * `user/` id has to its Content Credentials: it reads a field off the stored
 * record, and there is no byte-scan behind it, because an upload's pixels were
 * re-encoded at ingest and the store was moved beside the record. So any writer
 * that lands a record without that field writes an asset whose provenance is gone
 * the moment anything asks - and two of them did exactly that: a video job, which
 * signs its output INTO the bytes it then uploads, and the audio/MIDI/Lottie
 * uploads the picker's own extraction skips. The bridge boundary is the one place
 * every writer passes, so that is where the capture belongs, and this file proves
 * a store put in comes back out.
 *
 * The fixture is signed by the engine's own embedder and read by the engine's own
 * extractor, following sequence-ingredients.test.ts next door: a passing
 * round-trip here is one the C2PA writer would actually accept as an ingredient.
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/bridge/assets-credential-capture.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { createAssetsAPI, MAX_CREDENTIAL_SCAN_BYTES } from './assets.ts';
import { embedC2pa } from '../../../../engine/src/c2pa.ts';
import { extractC2paStore, prepareC2paIngredientFromStore } from '../../../../engine/src/c2pa-verify.ts';

// ── fixtures ────────────────────────────────────────────────────────────────

/** A minimal RIFF/WAVE - all the grammar the embedder and the extractor read. */
function tinyWav(frames = 32, sampleRate = 24000): Uint8Array {
  const dataLen = frames * 2;
  const u8 = new Uint8Array(44 + dataLen);
  const dv = new DataView(u8.buffer);
  const put = (at: number, s: string): void => { for (let i = 0; i < s.length; i++) u8[at + i] = s.charCodeAt(i); };
  put(0, 'RIFF'); dv.setUint32(4, 36 + dataLen, true); put(8, 'WAVE');
  put(12, 'fmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true); dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  put(36, 'data'); dv.setUint32(40, dataLen, true);
  for (let i = 0; i < frames; i++) dv.setInt16(44 + i * 2, ((i % 16) - 8) * 1024, true);
  return u8;
}

/** Signing mints a key pair per call, so the one fixture is built once and shared. */
const SIGNED = await (async () => {
  const bytes = await embedC2pa(tinyWav(), 'wav', {
    title: 'Graded clip',
    claimGenerator: 'LollyTest/1.0',
    generatorInfo: { name: 'Lolly', version: '1.9.0' },
    environment: { tool: 'Fixture Tool', format: 'wav', surface: 'test', engine: 'node', os: 'test' },
  });
  const ex = extractC2paStore(bytes);
  assert.ok(ex, 'the fixture must carry an extractable store');
  return { bytes, store: ex!.store, format: ex!.format };
})();

/** In-memory stand-in for the idb slice bridge/assets.ts consumes (memDb, as
 *  lib/design-system/versions-io.test.ts builds it). */
function makeApi() {
  const stores: Record<string, Map<string, unknown>> = {
    'user-assets': new Map(), 'asset-meta': new Map(), 'asset-blob': new Map(),
  };
  const db = {
    async get(store: string, key: string) { return stores[store]!.get(key); },
    async getAll(store: string) { return [...stores[store]!.values()]; },
    async getAllKeys(store: string) { return [...stores[store]!.keys()]; },
    async put(store: string, value: unknown, key?: string) {
      stores[store]!.set(key ?? String((value as { id: string }).id), value);
    },
    async delete(store: string, key: string) { stores[store]!.delete(key); },
  };
  return createAssetsAPI(db as unknown as Parameters<typeof createAssetsAPI>[0]);
}

const VIDEO_JOB_ID = 'user/video/1755600000000-graded';

// ── the round trip ──────────────────────────────────────────────────────────

test('a signed blob uploaded with no credential field still answers credential(id)', async () => {
  // The video-job record, field for field: the op stamps its C2PA into the output
  // bytes and hands the bridge a blob, a size and a name - and nothing else.
  const assets = makeApi();
  await assets._uploadUserAsset({
    id: VIDEO_JOB_ID, type: 'video', format: 'wav', version: '1.0.0',
    blob: new Blob([SIGNED.bytes as BlobPart]),
    meta: { name: 'Graded clip' },
  });

  const cred = await assets.credential(VIDEO_JOB_ID);
  assert.ok(cred, 'the store the bytes carried is served back by id');
  assert.equal(cred!.format, SIGNED.format);
  assert.deepEqual(Array.from(cred!.store), Array.from(SIGNED.store), 'verbatim, not re-signed');

  // And it is an ingredient the export writer would accept, which is the whole
  // point of keeping it: original → graded → final survives the timeline.
  const ing = prepareC2paIngredientFromStore(cred!.store, cred!.format);
  assert.ok(ing, 'the served store parses as an ingredient');
  assert.equal(ing!.title, 'Graded clip');
});

test('bytes carrying nothing leave the record clean, quietly', async () => {
  const assets = makeApi();
  await assets._uploadUserAsset({
    id: 'user/upload/1755600000001-plain', type: 'audio', format: 'wav',
    blob: new Blob([tinyWav() as BlobPart]),
  });
  assert.equal(await assets.credential('user/upload/1755600000001-plain'), null,
    'carrying no credential is the ordinary case, not a failure');
});

test('a caller that already extracted wins - the capture never overwrites it', async () => {
  // The picker can fall back to the ORIGINAL file's manifest when a re-encode
  // dropped it (SVG sanitisation strips the in-file store), and these bytes cannot
  // show that. A capture that overwrote the record would launder it back out.
  const assets = makeApi();
  const stated = new Uint8Array([9, 9, 9, 9]);
  await assets._uploadUserAsset({
    id: 'user/upload/1755600000002-resized', type: 'raster', format: 'webp',
    blob: new Blob([SIGNED.bytes as BlobPart]),
    credential: stated, credentialFormat: 'jpeg',
  });
  const cred = await assets.credential('user/upload/1755600000002-resized');
  assert.deepEqual(Array.from(cred!.store), [9, 9, 9, 9], 'the ingest-time store stands');
  assert.equal(cred!.format, 'jpeg');
});

test('a blob over the scan cap is never read', async () => {
  // A timeline's worth of half-gigabyte clips is exactly what the cap exists to
  // refuse, and an upload must not pay a full read to find that out.
  const assets = makeApi();
  let read = 0;
  const huge = {
    size: MAX_CREDENTIAL_SCAN_BYTES + 1,
    arrayBuffer: async () => { read++; return new ArrayBuffer(0); },
  } as unknown as Blob;
  await assets._uploadUserAsset({ id: 'user/video/1755600000003-huge', type: 'video', format: 'mp4', blob: huge });
  assert.equal(read, 0, 'the cap is checked before the bytes are pulled into memory');
  assert.equal(await assets.credential('user/video/1755600000003-huge'), null);
});

test('a record with no blob at all is not a failure', async () => {
  const assets = makeApi();
  await assets._uploadUserAsset({ id: 'user/upload/1755600000004-empty', type: 'raster', format: 'png' });
  assert.equal(await assets.credential('user/upload/1755600000004-empty'), null);
});
