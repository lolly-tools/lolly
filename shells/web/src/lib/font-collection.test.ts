// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fontkit from '@pdf-lib/fontkit';
import { COLLECTION_FACE_LIMIT, collectionFaceOffsets, collectionFaces, extractCollectionFace, isFontCollection } from './font-collection.ts';
import { parseFontMetadata } from './font-utils.ts';
import { NOTO_HEBREW, OUTFIT, packCollection, sfntFace, type SfntFace } from './font-collection.test-utils.ts';

const outfit = sfntFace(OUTFIT), hebrew = sfntFace(NOTO_HEBREW);
const signed: SfntFace = { version: hebrew.version, tables: [...hebrew.tables, { tag: 'DSIG', checksum: 0, data: new Uint8Array([0, 0, 0, 1, 0, 0, 0, 0]) }] };
// The third face reuses the first face's table objects, so the packer shares them.
const collection = packCollection([outfit, signed, outfit]);
const buffer = (bytes: Uint8Array) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

test('every face of a collection is listed with its own name and flavour', () => {
  assert.equal(isFontCollection(collection), true); assert.equal(isFontCollection(OUTFIT), false);
  const faces = collectionFaces(collection);
  assert.deepEqual(faces.map(face => face.label), ['Outfit Thin', fontkit.create(NOTO_HEBREW).fullName, 'Outfit Thin']);
  assert.deepEqual(faces.map(face => face.extension), ['ttf', 'ttf', 'ttf']);
  const [first, , third] = collectionFaceOffsets(collection); assert.notEqual(first, third);
});

test('an extracted face is a standalone sfnt with the same tables and a valid file checksum', () => {
  for (const [index, source] of [[0, outfit], [1, hebrew], [2, outfit]] as const) {
    const face = extractCollectionFace(collection, index), parsed = sfntFace(face), view = new DataView(face.buffer);
    assert.equal(parsed.version, source.version);
    assert.deepEqual(parsed.tables.map(table => table.tag), source.tables.map(table => table.tag).sort());
    // head.checkSumAdjustment (bytes 8 to 11) is recomputed for the new file; every other byte is copied.
    const comparable = (tag: string, data: Uint8Array) => { const copy = data.slice(); if (tag === 'head') copy.fill(0, 8, 12); return copy; };
    for (const table of parsed.tables) {
      const original = source.tables.find(entry => entry.tag === table.tag)!;
      assert.deepEqual(comparable(table.tag, table.data), comparable(table.tag, original.data), table.tag); assert.equal(table.checksum, original.checksum);
    }
    const count = parsed.tables.length, selector = Math.floor(Math.log2(count));
    assert.deepEqual([view.getUint16(6), view.getUint16(8), view.getUint16(10)], [16 * 2 ** selector, selector, count * 16 - 16 * 2 ** selector]);
    for (let i = 0; i < count; i++) assert.equal(view.getUint32(12 + i * 16 + 8) % 4, 0);
    let sum = 0; for (let i = 0; i < face.length; i += 4) sum = (sum + view.getUint32(i)) >>> 0;
    assert.equal(sum, 0xb1b0afba);
  }
  assert.equal(parseFontMetadata(buffer(extractCollectionFace(collection, 0)))?.family, 'Outfit');
  assert.equal(fontkit.create(extractCollectionFace(collection, 1)).familyName, fontkit.create(NOTO_HEBREW).familyName);
});

test('a signature for the collection is not copied into an extracted face', () => {
  assert.equal(sfntFace(extractCollectionFace(collection, 1)).tables.some(table => table.tag === 'DSIG'), false);
});

test('a CFF face keeps its OTTO version and is offered as OTF', () => {
  const head = new Uint8Array(54), cff: SfntFace = { version: 0x4f54544f, tables: [{ tag: 'head', checksum: 0, data: head }, { tag: 'CFF ', checksum: 0, data: new Uint8Array([1, 0, 4, 1]) }] };
  const otc = packCollection([cff]);
  assert.equal(collectionFaces(otc)[0]!.extension, 'otf');
  assert.equal(new DataView(extractCollectionFace(otc, 0).buffer).getUint32(0), 0x4f54544f);
});

test('damaged or oversized collections are refused before any copy', () => {
  const view = (bytes: Uint8Array) => new DataView(bytes.buffer);
  assert.throws(() => collectionFaceOffsets(collection.slice(0, 10)), /damaged/);
  const empty = collection.slice(); view(empty).setUint32(8, 0); assert.throws(() => collectionFaceOffsets(empty), /no faces/);
  const many = collection.slice(); view(many).setUint32(8, COLLECTION_FACE_LIMIT + 1); assert.throws(() => collectionFaceOffsets(many), /too many faces/);
  const outside = collection.slice(); view(outside).setUint32(12, collection.length); assert.throws(() => collectionFaceOffsets(outside), /damaged/);
  assert.throws(() => extractCollectionFace(collection, 3), /not in the collection/);
  const directory = collectionFaceOffsets(collection)[0]!;
  const longTable = collection.slice(); view(longTable).setUint32(directory + 12 + 12, collection.length); assert.throws(() => extractCollectionFace(longTable, 0), /damaged/);
  const duplicate = collection.slice(); duplicate.set(duplicate.subarray(directory + 12, directory + 16), directory + 28); assert.throws(() => extractCollectionFace(duplicate, 0), /damaged/);
  const version = collection.slice(); view(version).setUint32(directory, 0x12345678); assert.throws(() => extractCollectionFace(version, 0), /damaged/);
  assert.throws(() => extractCollectionFace(collection, 0, 1024), /too large/);
});
