// SPDX-License-Identifier: MPL-2.0
/**
 * Technical-metadata parsers - lib/asset-metadata.ts.
 *
 * Run directly:  node --test shells/web/src/lib/asset-metadata.test.ts
 *
 * These exercise the PURE container readers with tiny hand-built fixtures - no
 * real image/AV decode (jsdom/node has no createImageBitmap or WebCodecs, which
 * is exactly why dimensions degrade gracefully). The one integration case feeds
 * a garbage buffer through the top-level extractor to pin the two invariants the
 * whole feature rests on: it NEVER throws, and it always returns File size +
 * Format even when every type-specific field is unreadable.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePngMeta,
  parseJpegMeta,
  parseTiffTags,
  parseId3v2,
  parseSvgMeta,
  lottieMetaFromJson,
  extractAssetMetadata,
  leavesOriginalUnread,
  recordedMetadata,
  metadataFromBytes,
} from './asset-metadata.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { formatMetaInstant, formatWrittenDate } from './meta-dates.ts';

test('large assets and provider originals of unknown size show recorded facts without downloading the original', async (t) => {
  let downloads = 0;
  t.mock.method(globalThis, 'fetch', async () => { downloads++; throw new Error('Unexpected original download'); });
  for (const meta of [{ provider: 'brandfolder', bytes: 64_000_000 }, { provider: 'brandfolder' }, { bytes: 64_000_000 }]) {
    const fields = await extractAssetMetadata({ source: 'library', id: 'large', type: 'raster', format: 'png', url: 'https://example.test/large.png', width: 4000, height: 3000, meta });
    assert.ok(fields.some(field => field.label === 'Dimensions' && field.value === '4000 × 3000'));
    assert.ok(fields.some(field => field.label === 'Format' && field.value === 'PNG'));
  }
  assert.equal(downloads, 0);
});

test('recorded facts are keyed rows the Details list can show before the file is read', () => {
  const ref = { source: 'library', id: 'clip', type: 'audio', format: 'opus', url: 'https://example.test/clip.opus', width: 1080, height: 1920, meta: { bytes: 705_536, durationMs: 90_000 } } as unknown as AssetRef;
  assert.deepEqual(recordedMetadata(ref), [
    { key: 'dimensions', label: 'Dimensions', value: '1080 × 1920' },
    { key: 'duration', label: 'Duration', value: '1:30' },
    { key: 'fileSize', label: 'File size', value: '689 KB' },
  ]);
  assert.deepEqual(recordedMetadata({ source: 'library', id: 'bare', type: 'vector', url: '' } as unknown as AssetRef), []);
});

test('a catalog PDF or font shows its recorded size and facts before, and without, a file read', () => {
  // The web bridge lifts the primary file's formats[].size into meta.size; an entry's
  // own meta block may add a page count. A PDF or font preview reads the file through
  // its own viewer, so these rows are all the Details list has until that read finishes.
  const pdf = { source: 'library', id: 'lolly/guide/brand-book', type: 'data', format: 'pdf', url: 'https://example.test/book.pdf', width: 595, height: 842, meta: { size: 2_400_000, pages: 48 } } as unknown as AssetRef;
  assert.deepEqual(recordedMetadata(pdf).map(field => [field.key, field.value]), [['dimensions', '595 × 842'], ['pages', '48'], ['fileSize', '2.29 MB']]);
  const font = { source: 'remote', id: 'ext/dam/face', type: 'font', format: 'woff2', url: 'https://example.test/face.woff2', meta: { provider: 'dam', size: 48_200 } } as unknown as AssetRef;
  assert.deepEqual(recordedMetadata(font).map(field => [field.key, field.value]), [['fileSize', '47 KB']]);
  // An upload's own byte count wins over a stale catalog size, and nonsense is no fact.
  assert.equal(recordedMetadata({ ...pdf, meta: { bytes: 1024, size: 9_999_999 } }).at(-1)?.value, '1 KB');
  assert.deepEqual(recordedMetadata({ ...font, meta: { size: 'large', pages: 2.5, fps: -1 } } as unknown as AssetRef), []);
});

test('a viewer\'s own read gives the file size, and for a PDF its pages and page size', () => {
  const pdf = new TextEncoder().encode('%PDF-1.7\n1 0 obj << /Type /Page /MediaBox [0 0 595.28 841.89] >> endobj\n2 0 obj << /Type /Page >> endobj\n3 0 obj << /Type /Pages /Count 2 >> endobj\n%%EOF');
  assert.deepEqual(metadataFromBytes(pdf).map(field => [field.key, field.value]), [['pages', '2'], ['dimensions', '595 × 842 pt'], ['fileSize', `${pdf.byteLength} B`]]);
  const font = new Uint8Array([0x77, 0x4f, 0x46, 0x32, ...new Array(2044).fill(0)]);
  assert.deepEqual(metadataFromBytes(font).map(field => [field.key, field.value]), [['fileSize', '2 KB']]);
  assert.deepEqual(metadataFromBytes(new Uint8Array()), []);
});

test('every extracted row carries the stable key its glyph and rank are chosen by', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"/>'));
  const fields = await extractAssetMetadata({ source: 'library', id: 'mark', type: 'vector', format: 'svg', url: 'https://example.test/mark.svg' } as AssetRef);
  assert.deepEqual(fields.map(field => field.key), ['viewBox', 'dimensions', 'fileSize', 'format']);
});

test('an upload is read whatever its size: its bytes are already on this device', async (t) => {
  // Plan 302 gave every upload its true size. A large upload must still get its
  // full Details panel, as it did when uploads carried no size at all.
  const reads: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => { reads.push(url); return new Response(new Uint8Array([1, 2, 3])); });
  const fields = await extractAssetMetadata({ source: 'user', id: 'user/upload/1800000000000-big', type: 'raster', format: 'png', url: 'blob:https://lolly.tools/big', width: 4000, height: 3000, meta: { bytes: 64_000_000 } });
  assert.deepEqual(reads, ['blob:https://lolly.tools/big']);
  assert.ok(fields.some(field => field.label === 'Format' && field.value === 'PNG'));
});

test('import and capture dates use the one date style: the camera clock as written, the import as an instant', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('offline'); });
  const importedAt = '2026-10-31T09:15:00.000Z';
  const fields = await extractAssetMetadata({ source: 'user', id: 'user/upload/1', type: 'data', format: 'bin', url: 'blob:x',
    meta: { provenance: { importedAt, originalFilename: 'IMG_0412.JPG', metaDigest: { captureDate: '2026:10:12 09:41:07' } } } } as unknown as AssetRef);
  const value = (key: string) => fields.find(field => field.key === key)?.value;
  assert.equal(value('taken'), formatWrittenDate('2026:10:12 09:41:07'));
  assert.match(value('taken') ?? '', /2026/, 'the raw EXIF colon form is not shown');
  assert.doesNotMatch(value('taken') ?? '', /2026:10:12/);
  assert.equal(value('imported'), formatMetaInstant(importedAt));
});

test('leavesOriginalUnread: large and unknown-size provider originals stay unread, uploads never do', () => {
  assert.equal(leavesOriginalUnread({ source: 'library', meta: { size: 12_000_000 } }), true);
  assert.equal(leavesOriginalUnread({ source: 'library', meta: { bytes: 64_000_000 } }), true);
  assert.equal(leavesOriginalUnread({ source: 'remote', meta: { provider: 'brandfolder' } }), true);
  assert.equal(leavesOriginalUnread({ source: 'library', meta: { size: 11_999_999 } }), false);
  assert.equal(leavesOriginalUnread({ source: 'library', meta: {} }), false);
  assert.equal(leavesOriginalUnread({ source: 'remote', meta: { provider: 'brandfolder', size: 2048 } }), false);
  for (const meta of [{ bytes: 64_000_000 }, { size: 64_000_000 }, { provider: 'brandfolder' }]) {
    assert.equal(leavesOriginalUnread({ source: 'user', meta }), false, JSON.stringify(meta));
  }
});

// ── little-endian / big-endian byte helpers for the fixtures ────────────────
const le16 = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff];
const le32 = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
const be32 = (n: number): number[] => [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const chars = (s: string): number[] => [...s].map(c => c.charCodeAt(0));

test('parsePngMeta: IHDR dims/depth and pHYs → DPI', () => {
  const pngChunk = (type: string, data: number[]): number[] =>
    [...be32(data.length), ...chars(type), ...data, 0, 0, 0, 0 /* CRC (unchecked) */];
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdr = [...be32(800), ...be32(600), 8, 6, 0, 0, 0]; // 800×600, 8-bit, colour type 6 (RGBA)
  const phys = [...be32(2835), ...be32(2835), 1];           // 2835 ppm ≈ 72 dpi, unit = metre
  const bytes = new Uint8Array([...sig, ...pngChunk('IHDR', ihdr), ...pngChunk('pHYs', phys), ...pngChunk('IDAT', [0])]);

  const meta = parsePngMeta(bytes);
  assert.ok(meta, 'should parse a valid PNG head');
  assert.equal(meta.width, 800);
  assert.equal(meta.height, 600);
  assert.equal(meta.bitDepth, 8);
  assert.equal(meta.colorType, 6);
  assert.equal(meta.dpi, 72);
  assert.equal(meta.hasIcc, undefined);

  assert.equal(parsePngMeta(new Uint8Array([1, 2, 3])), null, 'non-PNG → null');
});

test('parseJpegMeta: JFIF density → DPI, both unit codes', () => {
  const jfif = (units: number, xden: number): Uint8Array => {
    const seg = [...chars('JFIF'), 0x00, 1, 1, units, ...[(xden >> 8) & 0xff, xden & 0xff], ...[(xden >> 8) & 0xff, xden & 0xff], 0, 0];
    const len = seg.length + 2;
    return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, (len >> 8) & 0xff, len & 0xff, ...seg, 0xff, 0xd9]);
  };
  assert.equal(parseJpegMeta(jfif(1, 300))?.dpi, 300, 'units=1 (DPI) read verbatim');
  assert.equal(parseJpegMeta(jfif(2, 118))?.dpi, Math.round(118 * 2.54), 'units=2 (dpcm) → ×2.54');
  assert.equal(parseJpegMeta(new Uint8Array([1, 2, 3, 4])), null, 'non-JPEG → null');
});

test('parseTiffTags: EXIF IFD0 with Make (ASCII), Orientation (SHORT), XResolution (RATIONAL)', () => {
  const II = [0x49, 0x49];
  const magic = le16(0x2a);
  const ifd0Off = le32(8);
  const count = le16(3);
  const eMake = [...le16(0x010f), ...le16(2), ...le32(6), ...le32(50)];      // ASCII, 6 bytes, at offset 50
  const eOrient = [...le16(0x0112), ...le16(3), ...le32(1), 6, 0, 0, 0];     // SHORT=6, inline
  const eXRes = [...le16(0x011a), ...le16(5), ...le32(1), ...le32(56)];      // RATIONAL, at offset 56
  const nextIfd = le32(0);
  const makeData = [...chars('Nikon'), 0x00];                               // 6 bytes at 50
  const xres = [...le32(72), ...le32(1)];                                    // 72/1 at 56
  const bytes = new Uint8Array([...II, ...magic, ...ifd0Off, ...count, ...eMake, ...eOrient, ...eXRes, ...nextIfd, ...makeData, ...xres]);

  const tags = parseTiffTags(bytes);
  assert.ok(tags, 'should parse the TIFF header');
  assert.equal(tags.ifd0[0x010f], 'Nikon');
  assert.equal(tags.ifd0[0x0112], 6);
  assert.equal(tags.ifd0[0x011a], 72);

  assert.equal(parseTiffTags(new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0])), null, 'no II/MM → null');
});

test('parseId3v2: ID3v2.3 TIT2 → title', () => {
  const frameData = [0x00, ...chars('Hello')];                              // encoding 0 (latin1) + text
  const frame = [...chars('TIT2'), ...be32(frameData.length), 0x00, 0x00, ...frameData];
  const bytes = new Uint8Array([...chars('ID3'), 3, 0, 0, 0, 0, 0, frame.length, ...frame]);

  const tags = parseId3v2(bytes);
  assert.ok(tags, 'should parse the ID3v2 header');
  assert.equal(tags.title, 'Hello');

  assert.equal(parseId3v2(new Uint8Array([1, 2, 3])), null, 'no ID3 magic → null');
});

test('parseSvgMeta: viewBox and width/height off the opening tag', () => {
  assert.deepEqual(parseSvgMeta('<svg viewBox="0 0 120 80" xmlns="x"><rect/></svg>'), { viewBox: '0 0 120 80' });
  const withDims = parseSvgMeta('<svg width="64" height="48"></svg>');
  assert.equal(withDims?.width, 64);
  assert.equal(withDims?.height, 48);
  assert.equal(parseSvgMeta('not svg'), null);
});

test('lottieMetaFromJson: dims, frame count and duration', () => {
  const m = lottieMetaFromJson({ w: 512, h: 512, ip: 0, op: 60, fr: 30 });
  assert.ok(m);
  assert.equal(m.width, 512);
  assert.equal(m.height, 512);
  assert.equal(m.frames, 60);
  assert.equal(m.durationSec, 2);
  assert.equal(m.fps, 30);
  assert.equal(lottieMetaFromJson(null), null);
  assert.equal(lottieMetaFromJson('nope'), null);
});

test('extractAssetMetadata: never throws on garbage, always returns File size + Format', async () => {
  const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const url = `data:application/octet-stream;base64,${Buffer.from(garbage).toString('base64')}`;
  const ref = { source: 'user', id: 'junk', type: 'raster', format: 'png', url, meta: {} } as unknown as AssetRef;

  const fields = await extractAssetMetadata(ref);
  assert.ok(Array.isArray(fields));
  assert.ok(fields.some(f => f.label === 'File size'), 'File size row present');
  const fmt = fields.find(f => f.label === 'Format');
  assert.ok(fmt, 'Format row present');
  assert.equal(fmt.value, 'PNG');
  // No throw on a totally empty buffer either.
  const empty = { source: 'user', id: 'e', type: 'data', format: '', url: 'data:,', meta: {} } as unknown as AssetRef;
  const f2 = await extractAssetMetadata(empty);
  assert.ok(Array.isArray(f2));
});
