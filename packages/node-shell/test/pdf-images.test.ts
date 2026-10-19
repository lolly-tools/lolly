// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32 } from 'node:zlib';
import { PDFDocument, PDFName } from 'pdf-lib';
import { packPng } from '@lolly/engine';
import { createPdfAPI, organizePdf } from '../src/pdf.ts';
import { cleanJpeg, layoutImagePage, orientationMatrix, readExifFacts, readPngFacts } from '../src/pdf-images.ts';
import { scanPdfPages } from '../src/pdf-pages.ts';

// A 16 x 8 baseline JPEG, red on the left half and blue on the right, with a
// JFIF header that declares no resolution. Synthetic, made for this test.
const JPEG = new Uint8Array(Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAIABADASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAcI/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/EABUBAQEAAAAAAAAAAAAAAAAAAAcI/8QAGBEAAgMAAAAAAAAAAAAAAAAAAAhFg8P/2gAMAwEAAhEDEQA/AM6IEBwWWYo2KNYaKuyP/9k=', 'base64'));

function segment(marker: number, payload: Uint8Array | string): number[] {
  const body = typeof payload === 'string' ? [...Buffer.from(payload, 'latin1')] : [...payload];
  return [0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body];
}

/** A big-endian Exif block with an orientation and a 72 ppi resolution. */
function exif(orientation: number): number[] {
  const entries = [
    [0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0],
    [0x01, 0x1a, 0, 5, 0, 0, 0, 1, 0, 0, 0, 62],
    [0x01, 0x1b, 0, 5, 0, 0, 0, 1, 0, 0, 0, 62],
    [0x01, 0x28, 0, 3, 0, 0, 0, 1, 0, 2, 0, 0],
  ];
  // IFD0 at 8: count, 4 entries, next-IFD offset, then 72/1 at 62 for both resolutions.
  const tiff = [0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, entries.length, ...entries.flat(), 0, 0, 0, 0, 0, 0, 0, 72, 0, 0, 0, 1];
  return segment(0xe1, new Uint8Array([...Buffer.from('Exif\0\0', 'latin1'), ...tiff]));
}

/** The fixture with a phone camera's extras: Exif, XMP, IPTC, a comment, an ICC profile and a second picture after EOI. */
function phoneJpeg(orientation: number): Uint8Array {
  return new Uint8Array([
    ...JPEG.subarray(0, 2),
    ...exif(orientation),
    ...segment(0xe1, 'http://ns.adobe.com/xap/1.0/\0<x:xmpmeta><exif:GPSLatitude>51,30N</exif:GPSLatitude></x:xmpmeta>'),
    ...segment(0xed, 'Photoshop 3.0\0IPTC-CITY-SECRET'),
    ...segment(0xfe, 'COMMENT-SECRET'),
    ...segment(0xe2, 'ICC_PROFILE\0\x01\x01PROFILE-BYTES'),
    ...JPEG.subarray(2),
    ...JPEG.subarray(0, 2), ...segment(0xe1, 'GAINMAP-SECRET'), ...JPEG.subarray(2),
  ]);
}

/** Offset of a two-byte marker, searched as a pair so table data cannot match. */
function markerAt(bytes: Uint8Array, marker: number): number {
  for (let i = 2; i + 1 < bytes.length; i++) if (bytes[i] === 0xff && bytes[i + 1] === marker) return i;
  return -1;
}

function contains(haystack: Uint8Array, needle: Uint8Array | string): boolean {
  return Buffer.from(haystack).includes(typeof needle === 'string' ? Buffer.from(needle, 'latin1') : Buffer.from(needle));
}

test('a JPEG keeps its scan data byte for byte and loses its metadata and appended pictures', () => {
  const clean = cleanJpeg(phoneJpeg(6));
  assert.equal(clean.width, 16);
  assert.equal(clean.height, 8);
  assert.equal(clean.orientation, 6);
  assert.equal(clean.ppiX, 72);
  assert.equal(clean.droppedMetadata, true);
  assert.equal(clean.droppedTrailing, true);
  for (const secret of ['GPSLatitude', 'IPTC-CITY', 'COMMENT-SECRET', 'GAINMAP', 'Exif']) assert.equal(contains(clean.bytes, secret), false, secret);
  assert.equal(contains(clean.bytes, 'PROFILE-BYTES'), true, 'the colour profile is kept');
  const scan = JPEG.subarray(markerAt(JPEG, 0xda));
  assert.ok(contains(clean.bytes, scan), 'the entropy-coded data and end marker are copied unchanged');
  assert.equal(clean.bytes.at(-1), 0xd9);
  assert.equal(cleanJpeg(JPEG).droppedMetadata, false, 'a plain JPEG has nothing to leave out');
});

test('scan data with stuffed bytes, restart markers and a table between two scans is copied whole', () => {
  const scanHeader = segment(0xda, new Uint8Array([1, 1, 0, 0, 63, 0]));
  const frame = segment(0xc2, new Uint8Array([8, 0, 2, 0, 2, 1, 1, 0x11, 0]));
  const table = segment(0xc4, new Uint8Array([0, ...new Array(16).fill(0)]));
  const data1 = [0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56];
  const data2 = [0x78, 0xff, 0x00, 0x9a];
  const src = new Uint8Array([0xff, 0xd8, ...frame, ...scanHeader, ...data1, ...table, ...segment(0xfe, 'X'), ...scanHeader, ...data2, 0xff, 0xd9]);
  const clean = cleanJpeg(src);
  assert.deepEqual([...clean.bytes], [0xff, 0xd8, ...frame, ...scanHeader, ...data1, ...table, ...scanHeader, ...data2, 0xff, 0xd9]);
  assert.equal(clean.droppedTrailing, false);
  assert.throws(() => cleanJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00])), /damaged/);
});

test('Exif readers accept both byte orders and ignore an out-of-range orientation', () => {
  const little = new Uint8Array([...Buffer.from('Exif\0\0', 'latin1'), 0x49, 0x49, 42, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, 8, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(readExifFacts(little).orientation, 8);
  little[6 + 18] = 9;
  assert.equal(readExifFacts(little).orientation, 1);
  assert.equal(readExifFacts(new Uint8Array([...Buffer.from('Exif\0\0', 'latin1'), 1, 2])).orientation, 1);
});

test('every orientation maps the stored image onto the upright box', () => {
  const apply = (m: number[], u: number, v: number) => [m[0]! * u + m[2]! * v + m[4]!, m[1]! * u + m[3]! * v + m[5]!];
  // Where the first pixel of the first row, stored (u, v) = (0, 1), is drawn in a 10 x 20 box at (5, 7).
  const firstPixel: Record<number, [number, number]> = {
    1: [5, 27], 2: [15, 27], 3: [15, 7], 4: [5, 7], 5: [5, 27], 6: [15, 27], 7: [15, 7], 8: [5, 7],
  };
  for (let o = 1; o <= 8; o++) {
    const m = orientationMatrix(o, 5, 7, 10, 20);
    assert.deepEqual(apply(m, 0, 1), firstPixel[o], `orientation ${o}`);
    const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => apply(m, u!, v!));
    assert.deepEqual([Math.min(...corners.map(c => c[0]!)), Math.max(...corners.map(c => c[0]!))], [5, 15], `orientation ${o} spans the box width`);
    assert.deepEqual([Math.min(...corners.map(c => c[1]!)), Math.max(...corners.map(c => c[1]!))], [7, 27], `orientation ${o} spans the box height`);
  }
});

test('page layout clamps oversized pages and fits paper sizes with a margin', () => {
  assert.deepEqual(layoutImagePage(28800, 100, 'image', 0), { width: 14400, height: 50, box: { x: 0, y: 0, w: 14400, h: 50 } });
  assert.equal(layoutImagePage(1, 2, 'image', 0).width, 3);
  const landscape = layoutImagePage(20, 10, 'a4', 36);
  assert.deepEqual([landscape.width, landscape.height], [841.89, 595.28]);
  assert.ok(Math.abs(landscape.box.x - 36) < 1e-9 && Math.abs(landscape.box.w - 769.89) < 1e-9);
  assert.ok(Math.abs(landscape.box.y + landscape.box.h / 2 - 595.28 / 2) < 1e-9, 'centred vertically');
  assert.deepEqual([layoutImagePage(10, 20, 'letter', 0).width, layoutImagePage(10, 20, 'letter', 0).height], [612, 792]);
});

test('images become pages in order, sized from their resolution, with JPEG orientation applied', async () => {
  const png = packPng(new Uint8Array(40 * 20 * 4).fill(200), { width: 40, height: 20, dpi: 144 });
  const res = await createPdfAPI().fromImages!([{ bytes: phoneJpeg(6) }, { bytes: png }, { bytes: JPEG }]);
  assert.equal(res.pages, 3);
  assert.deepEqual([res.turned, res.metadataLeftOut, res.extraPicturesLeftOut], [1, 1, 1]);
  assert.deepEqual(res.notes, [
    'Turned 1 photo upright using the camera orientation.',
    'Left out photo details such as location and camera data from 1 image.',
    'Left out extra pictures stored after the main image in 1 file.',
  ]);
  for (const secret of ['GPSLatitude', 'IPTC-CITY', 'COMMENT-SECRET', 'GAINMAP']) assert.equal(contains(res.bytes, secret), false, secret);
  const doc = await PDFDocument.load(res.bytes, { updateMetadata: false });
  const round = (n: number) => Math.round(n * 100) / 100;
  // 16 x 8 px at 72 ppi turned upright; 40 x 20 px at 144 ppi; 16 x 8 px at the 96 ppi default.
  assert.deepEqual(doc.getPages().map(p => [round(p.getWidth()), round(p.getHeight())]), [[8, 16], [20, 10], [12, 6]]);
  assert.equal(doc.getProducer(), undefined, 'no producer credit');
  assert.equal(doc.getCreationDate(), undefined, 'no invented dates');
  const scan = await scanPdfPages(res.bytes);
  const placed = scan.pages.map(page => page.nodes.find(node => node.kind === 'image'));
  // Lolly's own page reader reports an image as its stored box plus a turn about the centre.
  const boxes = placed.map(n => [n!.x! + n!.w! / 2, n!.y! + n!.h! / 2, n!.w!, n!.h!, (n as { rot?: number }).rot ?? 0].map(round));
  assert.deepEqual(boxes, [[4, 8, 16, 8, 90], [10, 5, 20, 10, 0], [6, 3, 12, 6, 0]]);
});

test('paper sizes fit each image and turn the page to match it', async () => {
  const res = await createPdfAPI().fromImages!([{ bytes: JPEG }, { bytes: phoneJpeg(6) }], { pageSize: 'a4', margin: 36 });
  const doc = await PDFDocument.load(res.bytes);
  assert.deepEqual(doc.getPages().map(p => [p.getWidth(), p.getHeight()]), [[841.89, 595.28], [595.28, 841.89]]);
});

/** A one-pixel PNG with an acTL chunk after IHDR, which is how an APNG announces its animation. */
function animatedPng(): Uint8Array {
  const still = packPng(new Uint8Array(4), { width: 1, height: 1 });
  const body = [...Buffer.from('acTL', 'latin1'), 0, 0, 0, 2, 0, 0, 0, 0];
  const crc = crc32(new Uint8Array(body));
  return new Uint8Array([...still.subarray(0, 33), 0, 0, 0, 8, ...body, crc >>> 24, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255, ...still.subarray(33)]);
}

test('images refuse what they cannot place, without decoding oversized PNGs', async () => {
  const api = createPdfAPI();
  await assert.rejects(() => api.fromImages!([]), /at least one PNG or JPEG/);
  await assert.rejects(() => api.fromImages!([{ bytes: new Uint8Array([...Buffer.from('GIF89a'), 1, 0, 1, 0, 0, 0, 0]) }]), /image 1 is not a PNG or JPEG/);
  const header = packPng(new Uint8Array(4), { width: 1, height: 1 });
  header.set([0, 0, 0x27, 0x10, 0, 0, 0x27, 0x10], 16);
  await assert.rejects(() => api.fromImages!([{ bytes: header }]), /100 million pixels/);
  // pdf-lib would throw a bare error on an animated PNG; it is refused by name first.
  assert.equal(readPngFacts(animatedPng()).animated, true);
  assert.equal(readPngFacts(packPng(new Uint8Array(4), { width: 1, height: 1 })).animated, false);
  await assert.rejects(() => api.fromImages!([{ bytes: JPEG }, { bytes: animatedPng() }]),
    (error: Error) => error.name === 'PdfTransformError' && /image 2 is an animated PNG/.test(error.message));
});

test('image pages go through Pages like any PDF and leave no producer credit', async () => {
  const api = createPdfAPI();
  const first = await api.fromImages!([{ bytes: JPEG }]);
  const second = await api.fromImages!([{ bytes: phoneJpeg(8) }]);
  const res = await organizePdf(first.bytes, { operation: 'reorder', pages: '2,1', extras: [second.bytes] });
  assert.deepEqual(res.effects, []);
  const doc = await PDFDocument.load(res.bytes!, { updateMetadata: false });
  assert.deepEqual(doc.getPages().map(p => [p.getWidth(), p.getHeight()]), [[8, 16], [12, 6]]);
  assert.equal(doc.getProducer(), undefined);
  assert.equal(doc.catalog.get(PDFName.of('Metadata')), undefined);
});

test('corrupted JPEG and PNG bytes are refused by name or read within bounds, never thrown raw', () => {
  let seed = 2026;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
  const png = packPng(new Uint8Array(4 * 4 * 4), { width: 4, height: 4, dpi: 72 });
  for (let round = 0; round < 400; round++) {
    const source = round % 2 ? phoneJpeg(1 + (round % 8)) : png;
    const bytes = source.slice(0, round % 7 === 0 ? next() % source.length : source.length);
    for (let k = 0; k < 6; k++) if (bytes.length) bytes[next() % bytes.length] = next() % 256;
    for (const read of [cleanJpeg, readPngFacts]) {
      try {
        const facts = read(bytes) as { width: number; height: number };
        assert.ok(facts.width > 0 && facts.height > 0);
      } catch (error) {
        assert.equal((error as Error).name, 'PdfTransformError', String(error));
      }
    }
    if (round % 2) {
      const facts = readExifFacts(bytes.subarray(6));
      assert.ok(facts.orientation >= 1 && facts.orientation <= 8);
    }
  }
});
