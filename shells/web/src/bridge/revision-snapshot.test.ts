// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'fflate';
import {
  canonicalRevisionData, deflateBound, isRevisionPayload, packedRevisionSnapshot,
  revisionSnapshot, unpackRevision, type RevisionPayload,
} from './revision-snapshot.ts';
import { MAX_RECOVERY_BYTES, MAX_REVISION_BYTES, MAX_REVISION_EXPANDED, MAX_REVISION_SNAPSHOT } from './revision-limits.ts';
import type { SavedStateData } from './state.ts';

const TOO_LARGE = /too large for automatic history/;

/** Seeded, so the synthetic deck is the same on every run. */
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

/** 32 slides of chart-like vector boxes, about 7 MB of JSON, the size the
 * Downloads deck (31 charts) reaches in Design once every chart stays a shape. */
function chartDeck(): SavedStateData {
  const next = random(31);
  const boxes: Array<Record<string, unknown>> = [];
  for (let slide = 0; slide < 32; slide++) {
    for (let run = 0; run < 70; run++) {
      let d = '';
      for (let glyph = 0; glyph < 60; glyph++) {
        const x = (next() * 1920).toFixed(2), y = (next() * 1080).toFixed(2);
        d += `M${x} ${y}c${(next() * 9).toFixed(2)} ${(next() * 9).toFixed(2)} ${(next() * 9).toFixed(2)} -${(next() * 9).toFixed(2)} ${(next() * 9).toFixed(2)} 0z`;
      }
      boxes.push({ id: `s${slide}-v${run}`, kind: 'path', slide, d, fill: '#30ba78', x: run * 10, y: run * 4, w: 400, h: 300 });
    }
  }
  return { __toolId: 'design', __label: 'Global Collaboration in AI', boxes };
}

function noise(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(length);
  for (let at = 0; at < length; at += 65536) crypto.getRandomValues(bytes.subarray(at, at + 65536));
  return bytes;
}

test('a packed checkpoint restores to the same document, hash and JSON length, and stores fewer bytes', async () => {
  const doc = { __toolId: 'design', __label: 'Packed', boxes: Array.from({ length: 200 }, (_, i) => ({ id: `b${i}`, text: 'Quarterly results', x: i })) };
  const packed = await packedRevisionSnapshot(doc);
  assert.ok(isRevisionPayload(packed.payload));
  assert.equal(packed.payload.size, packed.bytes);
  assert.equal(packed.stored, packed.payload.deflated.byteLength);
  assert.ok(packed.stored < packed.bytes / 4, `${packed.stored} of ${packed.bytes}`);
  const plain = await revisionSnapshot(doc);
  const read = await revisionSnapshot(packed.payload);
  assert.equal(read.hash, plain.hash);
  assert.equal(read.bytes, plain.bytes);
  assert.deepEqual(read.data, plain.data);
  assert.deepEqual(unpackRevision(packed.payload), plain.data);
});

test('a checkpoint written before compression still verifies against the hash and length it was stored with', async () => {
  // Stored, hashed and measured by the uncompressed snapshot code at HEAD
  // before this change: the payload row held the canonical document itself.
  const stored = { __label: 'Before compression', __toolId: 'design',
    boxes: [{ fill: '#0c322c', id: 'b1', kind: 'shape', path: 'M0 0L10 10Z' }, { id: 'b2', kind: 'text', text: 'Hello' }],
    image: { format: 'png', id: 'user/media/abc', source: 'user', version: 'v1' } };
  const entry = { hash: 'b2ad4b2396e6b3b7e44a8edfa0b1b40d98eecb47f3cc37d266faa0e62ec9d103', bytes: 246 };
  const read = await revisionSnapshot(stored);
  assert.equal(read.hash, entry.hash);
  assert.equal(read.bytes, entry.bytes);
  assert.deepEqual(read.data, stored);
  // The same document checkpointed now keeps the same identity, so the old
  // head and the new write deduplicate instead of forking.
  const now = await packedRevisionSnapshot({ ...stored, image: { ...stored.image, url: 'blob:gone' } });
  assert.equal(now.hash, entry.hash);
  assert.equal(now.bytes, entry.bytes);
});

test('the size check measures deflated bytes: a 7 MB chart deck keeps history, incompressible data over the budget does not', async () => {
  const deck = chartDeck();
  const packed = await packedRevisionSnapshot(deck);
  assert.ok(packed.bytes > MAX_REVISION_SNAPSHOT, `the deck is ${packed.bytes} bytes of JSON`);
  assert.ok(packed.stored <= MAX_REVISION_SNAPSHOT, `the deck deflates to ${packed.stored} bytes`);
  assert.equal((await revisionSnapshot(deck)).hash, packed.hash);
  assert.equal((await revisionSnapshot(packed.payload)).hash, packed.hash);

  const blob = { __toolId: 'design', noise: Buffer.from(noise(4 * 1024 * 1024 + 4096)).toString('base64') };
  await assert.rejects(revisionSnapshot(blob), TOO_LARGE);
  await assert.rejects(packedRevisionSnapshot(blob), TOO_LARGE);
});

test('JSON under the deflate bound is admitted without compressing it, and the bound holds for incompressible bytes', async () => {
  const random = noise(200_000);
  assert.ok(deflateSync(random, { level: 6 }).byteLength <= deflateBound(random.byteLength));
  const saved = globalThis.CompressionStream;
  let streams = 0;
  try {
    globalThis.CompressionStream = class extends saved { constructor(format: CompressionFormat) { super(format); streams++; } };
    await revisionSnapshot({ __toolId: 'design', text: 'recovery draft '.repeat(1000) });
    assert.equal(streams, 0);
    await packedRevisionSnapshot({ __toolId: 'design', text: 'checkpoint '.repeat(1000) });
    assert.equal(streams, 1);
  } finally {
    globalThis.CompressionStream = saved;
  }
});

test('a stored payload that is damaged, resized or oversized is refused, and a read never trusts its declared size alone', async () => {
  const packed = await packedRevisionSnapshot({ __toolId: 'design', text: 'x'.repeat(5000) });
  const damaged: RevisionPayload = { ...packed.payload, deflated: packed.payload.deflated.slice(0, 8) };
  assert.throws(() => unpackRevision(damaged));
  assert.throws(() => unpackRevision({ ...packed.payload, size: packed.payload.size - 1 }), /could not be read/);
  assert.throws(() => unpackRevision({ ...packed.payload, size: packed.payload.size + 10 }), /could not be read/);
  assert.throws(() => unpackRevision({ ...packed.payload, size: MAX_REVISION_EXPANDED + 1 }), /could not be read/);
  const array: RevisionPayload = { revisionPayload: 1, encoding: 'deflate-raw', size: 2, deflated: deflateSync(new TextEncoder().encode('[]')) };
  assert.throws(() => unpackRevision(array), /could not be read/);
  await assert.rejects(revisionSnapshot(damaged));
});

test('a document can never pass for a payload: bytes are refused in documents and a lookalike without bytes stays data', async () => {
  const lookalike = { revisionPayload: 1, encoding: 'deflate-raw', size: 2, deflated: 'e30=' };
  assert.equal(isRevisionPayload(lookalike), false);
  assert.deepEqual((await revisionSnapshot(lookalike)).data, { deflated: 'e30=', encoding: 'deflate-raw', revisionPayload: 1, size: 2 });
  await assert.rejects(revisionSnapshot({ ...lookalike, deflated: new Uint8Array(2), extra: true }));
});

test('canonical comparison reads through a stored payload, including a spread copy of the row', async () => {
  const doc = { __toolId: 'design', blocks: [{ id: 'a', text: 'hello' }] };
  const packed = await packedRevisionSnapshot(doc);
  assert.deepEqual(canonicalRevisionData(packed.payload), canonicalRevisionData(doc));
  assert.deepEqual(canonicalRevisionData({ ...packed.payload }), canonicalRevisionData(doc));
});

test('without the browser compressor the fflate fallback writes a payload the same reader restores', async () => {
  const saved = globalThis.CompressionStream;
  try {
    Reflect.deleteProperty(globalThis, 'CompressionStream');
    assert.equal(typeof globalThis.CompressionStream, 'undefined');
    const doc = { __toolId: 'design', text: 'fallback '.repeat(4000) };
    const packed = await packedRevisionSnapshot(doc);
    assert.deepEqual(unpackRevision(packed.payload), (await revisionSnapshot(doc)).data);
  } finally {
    globalThis.CompressionStream = saved;
  }
});

test('the budgets nest: one checkpoint fits the history store, and its inflated JSON fits a recovery draft', () => {
  assert.ok(MAX_REVISION_SNAPSHOT < MAX_REVISION_EXPANDED);
  assert.ok(MAX_REVISION_EXPANDED <= MAX_RECOVERY_BYTES);
  assert.ok(MAX_REVISION_SNAPSHOT * 32 <= MAX_REVISION_BYTES);
});
