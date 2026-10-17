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
const utf16 = (text: string) => { const out = new Uint8Array(text.length * 2), data = new DataView(out.buffer); for (let i = 0; i < text.length; i++) data.setUint16(i * 2, text.charCodeAt(i)); return out; };
const latin1 = (text: string) => Uint8Array.from(text, char => char.charCodeAt(0));
const joined = (...parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0)); let at = 0; for (const part of parts) { out.set(part, at); at += part.length; } return out; };

type NameRecord = [platform: number, encoding: number, language: number, id: number, at: number, length: number];
/** A name table whose records point into one string store, given as offsets from the start of that store. */
function nameTable(records: NameRecord[], storage: Uint8Array): Uint8Array {
  const out = new Uint8Array(6 + records.length * 12 + storage.length), data = new DataView(out.buffer);
  data.setUint16(2, records.length); data.setUint16(4, 6 + records.length * 12);
  records.forEach(([platform, encoding, language, id, at, length], i) => {
    const record = 6 + i * 12;
    data.setUint16(record, platform); data.setUint16(record + 2, encoding); data.setUint16(record + 4, language); data.setUint16(record + 6, id); data.setUint16(record + 8, length); data.setUint16(record + 10, at);
  });
  out.set(storage, 6 + records.length * 12);
  return out;
}
const namedFace = (name: Uint8Array): SfntFace => ({ version: 0x00010000, tables: [{ tag: 'head', checksum: 0, data: new Uint8Array(54) }, { tag: 'name', checksum: 0, data: name }] });

/** A collection whose faces all point at one table directory of zeroed records. */
function sharedDirectory(faces: number, tables: number): Uint8Array {
  const at = 12 + faces * 4, out = new Uint8Array(at + 12 + tables * 16), data = new DataView(out.buffer);
  out.set([0x74, 0x74, 0x63, 0x66]); data.setUint16(4, 1); data.setUint32(8, faces);
  for (let i = 0; i < faces; i++) data.setUint32(12 + i * 4, at);
  data.setUint32(at, 0x00010000); data.setUint16(at + 4, tables);
  return out;
}

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
  const outside = collection.slice(); view(outside).setUint32(12, collection.length); assert.throws(() => extractCollectionFace(outside, 0), /damaged/);
  assert.throws(() => extractCollectionFace(collection, 3), /not in the collection/);
  const directory = collectionFaceOffsets(collection)[0]!;
  const longTable = collection.slice(); view(longTable).setUint32(directory + 12 + 12, collection.length); assert.throws(() => extractCollectionFace(longTable, 0), /damaged/);
  const duplicate = collection.slice(); duplicate.set(duplicate.subarray(directory + 12, directory + 16), directory + 28); assert.throws(() => extractCollectionFace(duplicate, 0), /damaged/);
  const version = collection.slice(); view(version).setUint32(directory, 0x12345678); assert.throws(() => extractCollectionFace(version, 0), /damaged/);
  assert.throws(() => extractCollectionFace(collection, 0, 1024), /too large/);
});

test('a face whose directory cannot be read is listed as damaged and the other faces stay available', () => {
  const mixed = collection.slice(), data = new DataView(mixed.buffer), [first] = collectionFaceOffsets(mixed);
  data.setUint32(first!, 0x12345678); data.setUint32(16, mixed.length);
  assert.deepEqual(collectionFaces(mixed).map(face => [face.extension, face.label]), [[null, ''], [null, ''], ['ttf', 'Outfit Thin']]);
  assert.throws(() => extractCollectionFace(mixed, 0), /damaged/); assert.throws(() => extractCollectionFace(mixed, 1), /damaged/);
  assert.equal(sfntFace(extractCollectionFace(mixed, 2)).tables.length, outfit.tables.length);
  data.setUint32(20, 4); assert.throws(() => collectionFaces(mixed), /collection is damaged/);
});

test('faces that share a directory of more than 128 tables are refused before anything parses them', () => {
  assert.throws(() => collectionFaces(sharedDirectory(COLLECTION_FACE_LIMIT, 65535)), /damaged/);
  assert.throws(() => collectionFaces(sharedDirectory(2, 129)), /damaged/);
  assert.deepEqual(collectionFaces(sharedDirectory(2, 128)).map(face => face.extension), ['ttf', 'ttf']);
});

test('faces that share a name table of many long records are each labelled from one short record', () => {
  const name = utf16('Shared Face'), german = utf16('Geteilt'), mac = latin1('Mac Name'), long = 8000, junk = name.length + german.length + mac.length;
  // Mac and German full names sort first; the US English Windows one wins. A full parse decodes the 1000 long records for every face.
  const records: NameRecord[] = [[1, 0, 0, 4, name.length + german.length, mac.length], [3, 1, 0x407, 4, name.length, german.length], [3, 1, 0x409, 4, 0, name.length], ...Array.from({ length: 1000 }, (): NameRecord => [3, 1, 0x409, 0, junk, long])];
  const shared = namedFace(nameTable(records, joined(name, german, mac, new Uint8Array(long))));
  const started = performance.now(), faces = collectionFaces(packCollection(Array.from({ length: 8 }, () => shared)));
  assert.ok(performance.now() - started < 100, 'labelling read more than the chosen records');
  assert.deepEqual(faces.map(face => face.label), Array<string>(8).fill('Shared Face'));
});

test('labels fall back to family and subfamily, then the PostScript name, and only the first 512 records are read', () => {
  const family = latin1('Family'), bold = latin1('Bold'), postscript = utf16('Family-Bold');
  const pair = namedFace(nameTable([[1, 0, 0, 1, 0, family.length], [1, 0, 0, 2, family.length, bold.length]], joined(family, bold)));
  // The record claims more bytes than the table holds, so the read stops at the end of the table.
  const clipped = namedFace(nameTable([[3, 1, 0x409, 6, 0, 200]], postscript));
  const late = namedFace(nameTable([...Array.from({ length: 512 }, (): NameRecord => [3, 1, 0x409, 0, 0, 2]), [3, 1, 0x409, 4, 0, postscript.length]], postscript));
  assert.deepEqual(collectionFaces(packCollection([pair, clipped, late])).map(face => face.label), ['Family Bold', 'Family-Bold', '']);
});
