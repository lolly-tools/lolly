// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the DOM-free image-metadata byte-stampers extracted from
 * bridge/export.ts (stage 1 of the export.ts split).
 * Run directly:  node --test shells/web/src/bridge/export-image-meta.test.ts
 *
 * These live next to the bridge because they cover shell-side byte splicing.
 * Every assertion round-trips: stamp real container bytes (a decodable 1×1 PNG,
 * a minimal JFIF JPEG, a GIF89a header), re-parse the result with an
 * INDEPENDENT parser written here (bitwise reference CRC, DataView reads), and
 * verify structure + values - not just "bytes changed".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync, inflateSync } from 'node:zlib';
import { crc32 } from '@lolly/engine';
import {
  patchJpegDpi, readU32, writeU32, pngChunk, insertPngPhys, insertPngCicp, setAvifCicp, iTXtChunk,
  insertPngMeta, buildExifTiff, insertJpegExif, iccWanted, insertPngIcc,
  insertJpegIcc, svgMetaBlock, injectSvgMeta, withGifComment,
  inflateBytes, deflateBytes,
} from './export-image-meta.ts';

const enc = new TextEncoder();
const ascii = (s: string) => enc.encode(s);

// Bitwise reference CRC-32 (no table) - independent of the engine implementation
// under test: reflected poly 0xEDB88320, init/xorout 0xFFFFFFFF.
function refCrc32(bytes: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// Independent chunk builder for constructing the input PNG (mirrors the spec,
// not the module: length/type/data/CRC with the CRC over type+data).
function refChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  writeU32(out, 0, data.length);
  out.set(ascii(type), 4);
  out.set(data, 8);
  writeU32(out, 8 + data.length, refCrc32(out.subarray(4, 8 + data.length)));
  return out;
}

const PNG_SIG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

// A REAL, decodable 1×1 RGBA PNG: IHDR + one zlib-compressed scanline + IEND.
function minimalPng(): Uint8Array {
  const ihdr = new Uint8Array(13);
  writeU32(ihdr, 0, 1); writeU32(ihdr, 4, 1); // 1×1
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  const scanline = Uint8Array.from([0, 255, 0, 0, 255]); // filter 0 + red pixel
  const idat = new Uint8Array(deflateSync(scanline));
  return concat(PNG_SIG, refChunk('IHDR', ihdr), refChunk('IDAT', idat), refChunk('IEND', new Uint8Array(0)));
}

interface ParsedChunk { type: string; data: Uint8Array; crcOk: boolean }
function parsePngChunks(png: Uint8Array): ParsedChunk[] {
  assert.deepEqual([...png.subarray(0, 8)], [...PNG_SIG], 'PNG signature intact');
  const out: ParsedChunk[] = [];
  let o = 8;
  while (o < png.length) {
    const len = readU32(png, o);
    const type = String.fromCharCode(...png.subarray(o + 4, o + 8));
    const data = png.subarray(o + 8, o + 8 + len);
    const crc = readU32(png, o + 8 + len);
    out.push({ type, data, crcOk: crc === refCrc32(png.subarray(o + 4, o + 8 + len)) });
    o += 12 + len;
  }
  return out;
}

// ── CRC-32: the engine-barrel swap is only safe if it is bit-identical ───────

test('engine crc32 matches the reference implementation (poly/init/xorout)', () => {
  // The standard CRC-32 check value.
  assert.equal(crc32(ascii('123456789')), 0xCBF43926);
  assert.equal(crc32(new Uint8Array(0)), 0);
  // Pseudorandom buffer: table-driven engine CRC == bitwise reference CRC.
  const buf = new Uint8Array(4096);
  let seed = 0x1234_5678;
  for (let i = 0; i < buf.length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    buf[i] = seed & 0xFF;
  }
  assert.equal(crc32(buf), refCrc32(buf));
});

test('readU32/writeU32 round-trip big-endian', () => {
  const b = new Uint8Array(4);
  writeU32(b, 0, 0xDEADBEEF);
  assert.deepEqual([...b], [0xDE, 0xAD, 0xBE, 0xEF]);
  assert.equal(readU32(b, 0), 0xDEADBEEF);
});

test('pngChunk emits length/type/data/CRC with a valid CRC over type+data', () => {
  const data = ascii('hello');
  const c = pngChunk('teXt', data);
  assert.equal(c.length, 12 + 5);
  assert.equal(readU32(c, 0), 5);
  assert.equal(String.fromCharCode(...c.subarray(4, 8)), 'teXt');
  assert.deepEqual([...c.subarray(8, 13)], [...data]);
  assert.equal(readU32(c, 13), refCrc32(c.subarray(4, 13)));
});

// ── PNG pHYs (DPI) ───────────────────────────────────────────────────────────

test('insertPngPhys splices a valid pHYs right after IHDR with 300dpi → 11811 ppm', () => {
  const png = minimalPng();
  const out = insertPngPhys(png, 300);
  assert.ok(out, 'valid PNG accepted');
  assert.equal(out.length, png.length + 21); // 12-byte framing + 9-byte payload
  const chunks = parsePngChunks(out);
  assert.deepEqual(chunks.map(c => c.type), ['IHDR', 'pHYs', 'IDAT', 'IEND']);
  for (const c of chunks) assert.ok(c.crcOk, `${c.type} CRC valid`);
  const phys = chunks[1]!;
  assert.equal(phys.data.length, 9);
  const ppm = Math.round(300 / 0.0254); // 11811 px/metre
  assert.equal(ppm, 11811);
  assert.equal(readU32(phys.data, 0), ppm); // X
  assert.equal(readU32(phys.data, 4), ppm); // Y
  assert.equal(phys.data[8], 1);            // unit: metres
  // The original chunks are byte-identical around the splice.
  assert.deepEqual([...out.subarray(0, 8 + 25)], [...png.subarray(0, 8 + 25)], 'sig+IHDR untouched');
  assert.deepEqual([...out.subarray(8 + 25 + 21)], [...png.subarray(8 + 25)], 'IDAT+IEND untouched');
});

test('insertPngPhys rejects non-PNG bytes with null', () => {
  assert.equal(insertPngPhys(ascii('not a png at all'), 300), null);
  const corrupt = minimalPng(); corrupt[0] = 0;
  assert.equal(insertPngPhys(corrupt, 300), null);
});

test('insertPngCicp splices a valid Rec.2100-PQ cICP chunk after IHDR', () => {
  const png = minimalPng();
  const out = insertPngCicp(png, { primaries: 9, transfer: 16, matrix: 0, fullRange: 1 });
  assert.equal(out.length, png.length + 16); // 12-byte framing + 4-byte payload
  const chunks = parsePngChunks(out);
  assert.deepEqual(chunks.map(c => c.type), ['IHDR', 'cICP', 'IDAT', 'IEND']);
  for (const c of chunks) assert.ok(c.crcOk, `${c.type} CRC valid`);
  assert.deepEqual([...chunks[1]!.data], [9, 16, 0, 1]);
  // Non-PNG bytes pass through untouched (best-effort).
  assert.deepEqual([...insertPngCicp(ascii('nope'), { primaries: 9, transfer: 16, matrix: 0, fullRange: 1 })], [...ascii('nope')]);
});

test('setAvifCicp overwrites the nclx colr box with the PQ CICP, in place', () => {
  // Minimal ISOBMFF: an ftyp box (avif brand) + a colr/nclx box seeded sRGB-ish.
  const be16 = (n: number) => [(n >> 8) & 255, n & 255];
  const ftyp = [0, 0, 0, 16, ...ascii('ftyp'), ...ascii('avif'), 0, 0, 0, 0];
  const colr = [0, 0, 0, 19, ...ascii('colr'), ...ascii('nclx'), ...be16(1), ...be16(13), ...be16(6), 0x00];
  const avif = new Uint8Array([...ftyp, ...colr]);
  const before = avif.length;
  const out = setAvifCicp(avif, { primaries: 9, transfer: 16 });
  assert.equal(out.length, before, 'no size change → offsets stay valid');
  assert.notEqual(out, avif, 'returns a copy, input untouched');
  // Locate the nclx payload and check the rewritten CICP.
  const i = [...out].findIndex((_, k) => String.fromCharCode(out[k]!, out[k + 1]!, out[k + 2]!, out[k + 3]!) === 'colr');
  const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
  assert.equal(dv.getUint16(i + 8), 9, 'BT.2020 primaries (rewritten)');
  assert.equal(dv.getUint16(i + 10), 16, 'PQ transfer (rewritten)');
  // matrix + full-range are the encoder's YCbCr choice - must be PRESERVED.
  assert.equal(dv.getUint16(i + 12), 6, 'matrix coefficients preserved');
  assert.equal(out[i + 14], 0x00, 'full-range flag preserved');
  // Non-AVIF (no ftyp) and AVIF-without-colr both pass through untouched.
  assert.deepEqual([...setAvifCicp(ascii('not an avif!!'), { primaries: 9, transfer: 16 })], [...ascii('not an avif!!')]);
});

// ── PNG iTXt provenance metadata ─────────────────────────────────────────────

test('iTXtChunk lays out keyword NUL + 4 flag/terminator bytes + UTF-8 text', () => {
  const c = iTXtChunk('Author', 'Ada');
  assert.equal(String.fromCharCode(...c.subarray(4, 8)), 'iTXt');
  const data = c.subarray(8, c.length - 4);
  // keyword, NUL, compression flag 0, compression method 0, empty language NUL,
  // empty translated keyword NUL, then the text.
  assert.deepEqual([...data], [...ascii('Author'), 0, 0, 0, 0, 0, ...ascii('Ada')]);
  assert.equal(readU32(c, c.length - 4), refCrc32(c.subarray(4, c.length - 4)));
});

test('insertPngMeta stamps one iTXt per field after IHDR and round-trips values', () => {
  const png = minimalPng();
  const meta = {
    software: 'Lolly 1.0', author: 'Ada Lovelace', source: 'https://lolly.tools/t/x',
    description: 'A test asset', contact: 'ada@example.com', tool: 'x',
  } as any;
  const out = insertPngMeta(png, meta);
  const chunks = parsePngChunks(out);
  assert.deepEqual(chunks.map(c => c.type), ['IHDR', 'iTXt', 'iTXt', 'iTXt', 'iTXt', 'iTXt', 'IDAT', 'IEND']);
  const parsed = chunks.filter(c => c.type === 'iTXt').map(c => {
    assert.ok(c.crcOk, 'iTXt CRC valid');
    const nul = c.data.indexOf(0);
    const keyword = String.fromCharCode(...c.data.subarray(0, nul));
    const text = new TextDecoder().decode(c.data.subarray(nul + 5));
    return [keyword, text];
  });
  assert.deepEqual(parsed, [
    ['Software', 'Lolly 1.0'], ['Author', 'Ada Lovelace'],
    ['Source', 'https://lolly.tools/t/x'], ['Description', 'A test asset'],
    ['Comment', 'ada@example.com'],
  ]);
});

test('insertPngMeta is a no-op for null meta or empty fields', () => {
  const png = minimalPng();
  assert.equal(insertPngMeta(png, null), png);
  assert.equal(insertPngMeta(png, {} as any), png);
});

// ── JPEG JFIF DPI + EXIF ─────────────────────────────────────────────────────

// SOI + APP0 JFIF v1.1 (units 0, density 1×1, no thumbnail) + EOI.
function minimalJfif(): Uint8Array {
  return Uint8Array.from([
    0xFF, 0xD8,                                     // SOI
    0xFF, 0xE0, 0x00, 0x10,                         // APP0, length 16
    0x4A, 0x46, 0x49, 0x46, 0x00,                   // "JFIF\0"
    0x01, 0x01,                                     // version 1.1
    0x00,                                           // units: aspect only
    0x00, 0x01, 0x00, 0x01,                         // X/Y density 1
    0x00, 0x00,                                     // no thumbnail
    0xFF, 0xD9,                                     // EOI
  ]);
}

test('patchJpegDpi rewrites the JFIF density fields to dots-per-inch', () => {
  const jpeg = minimalJfif();
  const out = patchJpegDpi(jpeg, 300);
  assert.notEqual(out, jpeg, 'returns a copy');
  assert.equal(out[13], 1, 'density unit: dpi');
  assert.equal((out[14]! << 8) | out[15]!, 300, 'X density');
  assert.equal((out[16]! << 8) | out[17]!, 300, 'Y density');
  // Everything outside bytes 13–17 is untouched, and the input is not mutated.
  assert.deepEqual([...out.subarray(0, 13)], [...jpeg.subarray(0, 13)]);
  assert.deepEqual([...out.subarray(18)], [...jpeg.subarray(18)]);
  assert.equal(jpeg[13], 0, 'input untouched');
});

test('patchJpegDpi returns input unchanged for non-JFIF or bad dpi', () => {
  const jpeg = minimalJfif();
  assert.equal(patchJpegDpi(jpeg, 0), jpeg);
  assert.equal(patchJpegDpi(jpeg, -1), jpeg);
  const app1First = Uint8Array.from([0xFF, 0xD8, 0xFF, 0xE1, 0x00, 0x02, 0xFF, 0xD9]);
  assert.equal(patchJpegDpi(app1First, 300), app1First);
});

// Little-endian TIFF/IFD0 parser for the EXIF payload built by buildExifTiff.
function parseExifTiff(tiff: Uint8Array): Map<number, string> {
  const dv = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  assert.equal(String.fromCharCode(tiff[0]!, tiff[1]!), 'II', 'little-endian');
  assert.equal(dv.getUint16(2, true), 0x002A);
  const ifd: number = dv.getUint32(4, true);
  assert.equal(ifd, 8, 'IFD0 directly after header');
  const n = dv.getUint16(ifd, true);
  const out = new Map<number, string>();
  for (let i = 0; i < n; i++) {
    const at: number = ifd + 2 + i * 12;
    const tag = dv.getUint16(at, true);
    assert.equal(dv.getUint16(at + 2, true), 2, 'type ASCII');
    const count = dv.getUint32(at + 4, true);
    const start = count <= 4 ? at + 8 : dv.getUint32(at + 8, true);
    const bytes = tiff.subarray(start, start + count);
    assert.equal(bytes[count - 1], 0, 'NUL-terminated');
    // Values are UTF-8 bytes in an ASCII-typed tag (the module's TextEncoder output).
    out.set(tag, new TextDecoder().decode(bytes.subarray(0, count - 1)));
  }
  assert.equal(dv.getUint32(ifd + 2 + n * 12, true), 0, 'next IFD = none');
  return out;
}

test('buildExifTiff assembles a parseable little-endian IFD0 (inline + offset values)', () => {
  const tiff = buildExifTiff([
    { tag: 0x010E, value: 'A description long enough to be out-of-line' },
    { tag: 0x0131, value: 'abc' }, // 4 bytes with NUL → inlined
  ]);
  assert.ok(tiff);
  const tags = parseExifTiff(tiff);
  assert.equal(tags.get(0x010E), 'A description long enough to be out-of-line');
  assert.equal(tags.get(0x0131), 'abc');
});

test('buildExifTiff returns null when no field has content', () => {
  assert.equal(buildExifTiff([]), null);
  assert.equal(buildExifTiff([{ tag: 0x0131, value: '' }]), null);
});

test('insertJpegExif inserts an APP1 EXIF segment after APP0 and round-trips tags', () => {
  const jpeg = minimalJfif();
  const meta = {
    description: 'Poster', contact: 'ada@example.com',
    software: 'Lolly', author: 'Ada', source: 's', tool: 't',
  } as any;
  const out = insertJpegExif(jpeg, meta);
  const at = 20; // SOI (2) + APP0 (2 + 16)
  assert.equal(out[at], 0xFF);
  assert.equal(out[at + 1], 0xE1, 'APP1 marker after APP0');
  const segLen = (out[at + 2]! << 8) | out[at + 3]!;
  assert.equal(String.fromCharCode(...out.subarray(at + 4, at + 10)), 'Exif\0\0');
  const tiff = out.subarray(at + 10, at + 2 + segLen);
  assert.equal(segLen, 2 + 6 + tiff.length, 'length field includes itself + id');
  const tags = parseExifTiff(tiff);
  assert.equal(tags.get(0x010E), 'Poster · ada@example.com', 'ImageDescription joins description+contact');
  assert.equal(tags.get(0x0131), 'Lolly', 'Software');
  assert.equal(tags.get(0x013B), 'Ada', 'Artist');
  // The rest of the stream is intact around the splice.
  assert.deepEqual([...out.subarray(0, at)], [...jpeg.subarray(0, at)]);
  assert.deepEqual([...out.subarray(out.length - 2)], [0xFF, 0xD9]);
});

test('insertJpegExif leaves non-JPEG and metaless input untouched', () => {
  const jpeg = minimalJfif();
  assert.equal(insertJpegExif(jpeg, null), jpeg);
  const notJpeg = ascii('plain');
  assert.equal(insertJpegExif(notJpeg, { software: 'x' } as any), notJpeg);
});

// ── ICC profile embedding ────────────────────────────────────────────────────

test('iccWanted: default on, off for colorProfile none or thumbnails', () => {
  assert.equal(iccWanted({}), true);
  assert.equal(iccWanted({ colorProfile: 'srgb' }), true);
  assert.equal(iccWanted({ colorProfile: 'none' }), false);
  assert.equal(iccWanted({ thumbnail: true }), false);
});

test('insertPngIcc splices an iCCP chunk after IHDR whose payload inflates back', async () => {
  const png = minimalPng();
  const profile = new Uint8Array(600).map((_, i) => (i * 7) & 0xFF);
  const out = await insertPngIcc(png, profile);
  const chunks = parsePngChunks(out);
  assert.deepEqual(chunks.map(c => c.type), ['IHDR', 'iCCP', 'IDAT', 'IEND']);
  const iccp = chunks[1]!;
  assert.ok(iccp.crcOk, 'iCCP CRC valid');
  assert.deepEqual([...iccp.data.subarray(0, 6)], [...ascii('sRGB'), 0, 0], 'name + NUL + method 0');
  const inflated = new Uint8Array(inflateSync(iccp.data.subarray(6)));
  assert.deepEqual([...inflated], [...profile], 'zlib payload inflates to the profile');
});

test('insertPngIcc returns non-PNG input unchanged', async () => {
  const junk = ascii('junk');
  assert.equal(await insertPngIcc(junk, new Uint8Array(4)), junk);
});

test('insertJpegIcc emits a single APP2 ICC_PROFILE segment for a small profile', () => {
  const jpeg = minimalJfif();
  const profile = new Uint8Array(100).map((_, i) => i & 0xFF);
  const out = insertJpegIcc(jpeg, profile);
  const at = 20; // after APP0
  assert.equal(out[at], 0xFF);
  assert.equal(out[at + 1], 0xE2, 'APP2');
  const segLen = (out[at + 2]! << 8) | out[at + 3]!;
  assert.equal(segLen, 2 + 12 + 2 + 100);
  assert.equal(String.fromCharCode(...out.subarray(at + 4, at + 16)), 'ICC_PROFILE\0');
  assert.equal(out[at + 16], 1, 'chunk 1');
  assert.equal(out[at + 17], 1, 'of 1');
  assert.deepEqual([...out.subarray(at + 18, at + 18 + 100)], [...profile]);
});

test('insertJpegIcc splits a large profile across APP2 segments in order', () => {
  const jpeg = minimalJfif();
  const MAX = 0xFFFF - 2 - 12 - 2; // per-segment payload room (matches the module)
  const profile = new Uint8Array(MAX + 500).map((_, i) => (i * 13) & 0xFF);
  const out = insertJpegIcc(jpeg, profile);
  // Walk the segments and reassemble the payload.
  const parts: Uint8Array[] = [];
  let o = 20, seq = 0;
  while (out[o] === 0xFF && out[o + 1] === 0xE2) {
    const segLen = (out[o + 2]! << 8) | out[o + 3]!;
    assert.equal(String.fromCharCode(...out.subarray(o + 4, o + 16)), 'ICC_PROFILE\0');
    assert.equal(out[o + 16], ++seq, 'sequence number');
    assert.equal(out[o + 17], 2, 'total chunks');
    parts.push(out.subarray(o + 18, o + 2 + segLen));
    o += 2 + segLen;
  }
  assert.equal(seq, 2);
  assert.deepEqual([...concat(...parts)], [...profile], 'payloads reassemble the profile');
});

// ── SVG metadata + GIF comment ───────────────────────────────────────────────

test('injectSvgMeta inserts title/desc/Dublin-Core after the opening svg tag, escaped', () => {
  const xml = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect/></svg>';
  const meta = {
    tool: 'QR & Friends', author: 'Ada <L>', software: 'Lolly', source: 's',
    description: 'a&b', contact: 'c',
  } as any;
  const out = injectSvgMeta(xml, meta);
  const openEnd = out.indexOf('>') + 1;
  assert.ok(out.slice(openEnd).startsWith('\n<title>QR &amp; Friends</title>'), 'title right after the open tag');
  assert.ok(out.includes('<desc>a&amp;b · c</desc>'));
  assert.ok(out.includes('<dc:creator>Ada &lt;L&gt;</dc:creator>'));
  assert.ok(out.includes('<dc:publisher>Lolly</dc:publisher>'));
  assert.ok(out.includes('<dc:source>s</dc:source>'));
  assert.ok(out.endsWith('<rect/></svg>'), 'document body untouched');
  // svgMetaBlock alone omits the title when no tool name is present.
  assert.ok(!svgMetaBlock({ software: 'x', source: 'y' } as any).includes('<title>'));
});

test('injectSvgMeta is identity without meta or without an <svg> tag', () => {
  const xml = '<svg viewBox="0 0 1 1"/>';
  assert.equal(injectSvgMeta(xml, null), xml);
  assert.equal(injectSvgMeta('<div/>', { software: 'x' } as any), '<div/>');
});

// GIF89a header + logical screen descriptor (13 bytes) + optional GCT + trailer.
function minimalGif(gctSizeBits: number | null = null): Uint8Array {
  const packed = gctSizeBits === null ? 0 : 0x80 | gctSizeBits;
  const gct = gctSizeBits === null ? new Uint8Array(0) : new Uint8Array(3 * (1 << (gctSizeBits + 1)));
  return concat(
    ascii('GIF89a'),
    Uint8Array.from([1, 0, 1, 0, packed, 0, 0]), // 1×1, bg 0, aspect 0
    gct,
    Uint8Array.from([0x3B]), // trailer
  );
}

test('withGifComment inserts a comment extension after the header (no GCT)', () => {
  const gif = minimalGif();
  const out = withGifComment(gif, 'hi');
  assert.deepEqual([...out.subarray(13, 13 + 5)], [0x21, 0xFE, 2, ...ascii('hi')]);
  assert.equal(out[13 + 5], 0x00, 'block terminator');
  assert.equal(out[out.length - 1], 0x3B, 'trailer preserved');
  assert.deepEqual([...out.subarray(0, 13)], [...gif.subarray(0, 13)]);
});

test('withGifComment skips past a global colour table and chunks long text', () => {
  const gif = minimalGif(1); // GCT: 3 × 2^2 = 12 bytes
  const text = 'x'.repeat(600);
  const out = withGifComment(gif, text);
  const at = 13 + 12;
  assert.equal(out[at], 0x21);
  assert.equal(out[at + 1], 0xFE);
  // Sub-blocks: 255 + 255 + 90, then the 0x00 terminator.
  assert.equal(out[at + 2], 255);
  assert.equal(out[at + 2 + 1 + 255], 255);
  assert.equal(out[at + 2 + (1 + 255) * 2], 90);
  assert.equal(out[at + 2 + (1 + 255) * 2 + 1 + 90], 0x00);
  const body = [
    ...out.subarray(at + 3, at + 3 + 255),
    ...out.subarray(at + 4 + 255, at + 4 + 510),
    ...out.subarray(at + 5 + 510, at + 5 + 600),
  ];
  assert.equal(String.fromCharCode(...body), text);
});

test('withGifComment is identity for empty text or truncated bytes', () => {
  const gif = minimalGif();
  assert.equal(withGifComment(gif, undefined), gif);
  assert.equal(withGifComment(gif, ''), gif);
  const stub = gif.subarray(0, 10);
  assert.equal(withGifComment(stub, 'hi'), stub);
});

// ── zlib helpers (Streams API) ───────────────────────────────────────────────

test('deflateBytes/inflateBytes round-trip against node:zlib', async () => {
  const data = new Uint8Array(3000).map((_, i) => (i * 31) & 0xFF);
  const deflated = await deflateBytes(data);
  assert.deepEqual([...new Uint8Array(inflateSync(deflated))], [...data], 'deflateBytes → zlib inflate');
  const inflated = await inflateBytes(new Uint8Array(deflateSync(data)));
  assert.deepEqual([...inflated], [...data], 'zlib deflate → inflateBytes');
});
