// SPDX-License-Identifier: MPL-2.0
/**
 * Embedded-metadata reader tests (the /verify view's "reveal" side).
 * Run with: node --test tests/file-metadata.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { appendedIsExpected, extractFileMetadata, readMpfIndex } from '../engine/src/file-metadata.ts';
import { assembleGainMapJpeg } from '../engine/src/gainmap-jpeg.ts';
import type { GainMapMeta } from '../engine/src/gainmap.ts';

const u16le = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff];
const u32le = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
const u16be = (n: number): number[] => [(n >> 8) & 0xff, n & 0xff];
const bytesOf = (...parts: (number[] | string)[]): Uint8Array => {
  const arrs = parts.map((p) => (typeof p === 'string' ? [...new TextEncoder().encode(p)] : p));
  return new Uint8Array(arrs.flat());
};

// A minimal EXIF/TIFF block with a single ASCII IFD0 entry, no Make/Model - 
// the shape that used to crash the reader (see below).
function tiffWithSingleAsciiTag(tag: number, value: string): Uint8Array {
  const str = value + '\0';
  return bytesOf(
    'II', u16le(42), u32le(8), // header, IFD0 offset = 8
    u16le(1),                  // 1 entry
    u16le(tag), u16le(2), u32le(str.length), u32le(26), // ASCII entry, value at offset 26
    u32le(0),                  // next IFD = 0
    str,
  );
}

function jpegWithExif(tiff: Uint8Array): Uint8Array {
  const app1payload = bytesOf('Exif\0\0', [...tiff]);
  const app1 = bytesOf([0xff, 0xe1], u16be(app1payload.length + 2), [...app1payload]);
  const app0 = bytesOf([0xff, 0xe0, 0x00, 0x10], 'JFIF\0', [1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const sos = bytesOf([0xff, 0xda], [0, 0x3f, 0], [0xff, 0xd9]);
  return bytesOf([0xff, 0xd8], [...app0], [...app1], [...sos]);
}

test('extractFileMetadata: JPEG EXIF with no Make/Model still yields other fields', () => {
  // Regression: readExif used to call asciiVal() unconditionally for tags
  // 0x010f/0x0110 even when absent from the IFD, throwing inside the reader
  // and (caught by the outer try/catch) silently discarding every field - 
  // Artist, Software, GPS, all of it - for any EXIF block without a camera.
  const jpeg = jpegWithExif(tiffWithSingleAsciiTag(0x013b, 'Ada Lovelace')); // Artist
  const meta = extractFileMetadata(jpeg);
  assert.equal(meta.format, 'JPEG');
  const artist = meta.fields.find((f) => f.label === 'Artist');
  assert.ok(artist, 'Artist field should survive a Make/Model-less EXIF block');
  assert.equal(artist!.value, 'Ada Lovelace');
  assert.equal(artist!.sensitive, true);
});

test('extractFileMetadata: JPEG EXIF with a camera Make still reads Camera', () => {
  const jpeg = jpegWithExif(tiffWithSingleAsciiTag(0x010f, 'ACME'));
  const meta = extractFileMetadata(jpeg);
  const camera = meta.fields.find((f) => f.label === 'Camera');
  assert.ok(camera);
  assert.equal(camera!.value, 'ACME');
});

test('extractFileMetadata: unrecognised bytes never throw', () => {
  assert.doesNotThrow(() => extractFileMetadata(new Uint8Array([1, 2, 3])));
  assert.deepEqual(extractFileMetadata(new Uint8Array([1, 2, 3])).fields, []);
});

// ── AI declaration (IPTC DigitalSourceType in XMP) ───────────────────────────

const u32be = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

const DST_NS = 'http://cv.iptc.org/newscodes/digitalsourcetype';
// Attribute-form XMP, the shape Gemini/Imagen write (DigitalSourceType + Credit).
const xmpPacket = (sourceType: string, credit?: string): string =>
  `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
  `<rdf:Description xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" xmlns:photoshop="http://ns.adobe.com/photoshop/1.0/" ` +
  `Iptc4xmpExt:DigitalSourceType="${DST_NS}/${sourceType}"${credit ? ` photoshop:Credit="${credit}"` : ''}/></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;

function jpegWithXmp(packet: string): Uint8Array {
  const payload = bytesOf('http://ns.adobe.com/xap/1.0/\0', packet);
  const app1 = bytesOf([0xff, 0xe1], u16be(payload.length + 2), [...payload]);
  const sos = bytesOf([0xff, 0xda], [0, 0x3f, 0], [0xff, 0xd9]);
  return bytesOf([0xff, 0xd8], [...app1], [...sos]);
}

test('extractFileMetadata: JPEG XMP DigitalSourceType flags AI-generated + credit', () => {
  const meta = extractFileMetadata(jpegWithXmp(xmpPacket('trainedAlgorithmicMedia', 'Made with Google AI')));
  assert.equal(meta.ai?.kind, 'generated');
  assert.equal(meta.ai?.sourceType, `${DST_NS}/trainedAlgorithmicMedia`);
  assert.equal(meta.ai?.credit, 'Made with Google AI');
  assert.equal(meta.fields.find((f) => f.label === 'Digital source type')?.value, 'trainedAlgorithmicMedia');
  assert.equal(meta.fields.find((f) => f.label === 'Credit')?.value, 'Made with Google AI');
});

test('extractFileMetadata: composite source type flags composite; capture flags nothing', () => {
  assert.equal(extractFileMetadata(jpegWithXmp(xmpPacket('compositeWithTrainedAlgorithmicMedia'))).ai?.kind, 'composite');
  const capture = extractFileMetadata(jpegWithXmp(xmpPacket('digitalCapture')));
  assert.equal(capture.ai, undefined);
  assert.equal(capture.fields.find((f) => f.label === 'Digital source type')?.value, 'digitalCapture');
});

test('extractFileMetadata: element-form DigitalSourceType also parses', () => {
  const packet = `<rdf:Description><Iptc4xmpExt:DigitalSourceType>${DST_NS}/trainedAlgorithmicMedia</Iptc4xmpExt:DigitalSourceType></rdf:Description>`;
  assert.equal(extractFileMetadata(jpegWithXmp(packet)).ai?.kind, 'generated');
});

// PNG: the XMP packet rides in an iTXt chunk under the reserved keyword - the
// Midjourney / Google-AI-PNG shape. It must parse as XMP, not dump as prose.
function pngWithXmpItxt(packet: string): Uint8Array {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const chunk = (type: string, data: number[]): number[] =>
    [...u32be(data.length), ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0]; // CRC unchecked by the reader
  const itxtData = [...new TextEncoder().encode('XML:com.adobe.xmp'), 0, 0, 0, 0, 0, ...new TextEncoder().encode(packet)];
  return bytesOf(sig, chunk('iTXt', itxtData), chunk('IEND', []));
}

test('extractFileMetadata: PNG iTXt XMP packet parses as XMP (AI flag, no raw dump)', () => {
  const meta = extractFileMetadata(pngWithXmpItxt(xmpPacket('trainedAlgorithmicMedia')));
  assert.equal(meta.format, 'PNG');
  assert.equal(meta.ai?.kind, 'generated');
  assert.ok(!meta.fields.some((f) => f.label === 'XML:com.adobe.xmp'), 'raw XMP packet must not be dumped as a text field');
});

// MP4: XMP lives in a top-level uuid box (XMP spec part 3); a big mdat routinely
// uses a 64-bit largesize, which the walker must step over, not bail on.
const XMP_UUID = [0xbe, 0x7a, 0xcf, 0xcb, 0x97, 0xa9, 0x42, 0xe8, 0x9c, 0x71, 0x99, 0x94, 0x91, 0xe3, 0xaf, 0xac];
function mp4WithXmp(packet: string, brand = 'isom'): Uint8Array {
  const box = (type: string, data: number[]): number[] => [...u32be(8 + data.length), ...[...type].map((c) => c.charCodeAt(0)), ...data];
  const ftyp = box('ftyp', [...new TextEncoder().encode(brand), ...u32be(0)]);
  const mdatPayload = [1, 2, 3, 4];
  const mdat64 = [...u32be(1), ...[...'mdat'].map((c) => c.charCodeAt(0)), ...u32be(0), ...u32be(16 + mdatPayload.length), ...mdatPayload];
  const uuid = box('uuid', [...XMP_UUID, ...new TextEncoder().encode(packet)]);
  return bytesOf(ftyp, mdat64, uuid);
}

test('extractFileMetadata: MP4 uuid-box XMP flags AI-generated (past a 64-bit mdat)', () => {
  const meta = extractFileMetadata(mp4WithXmp(xmpPacket('trainedAlgorithmicMedia', 'Made with Google AI')));
  assert.equal(meta.format, 'MP4');
  assert.equal(meta.ai?.kind, 'generated');
  assert.equal(meta.ai?.credit, 'Made with Google AI');
});

// ── Appended payloads (bytes after the container ends) ───────────────────────

// A well-formed minimal JPEG whose SOS header length is honest, with FF00
// stuffing in the entropy data, ending at a real EOI - then `trailing`.
function jpegThen(trailing: number[]): Uint8Array {
  const sos = bytesOf([0xff, 0xda], u16be(8), [1, 1, 0, 0, 63, 0], [0x12, 0x34, 0xff, 0x00, 0x56], [0xff, 0xd9]);
  return bytesOf([0xff, 0xd8], [...sos], trailing);
}

function pngThen(trailing: number[]): Uint8Array {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const iend = [...u32be(0), ...[...'IEND'].map((c) => c.charCodeAt(0)), 0, 0, 0, 0];
  return bytesOf(sig, iend, trailing);
}

test('extractFileMetadata: zip appended after PNG IEND is surfaced and sniffed', () => {
  const meta = extractFileMetadata(pngThen([...new TextEncoder().encode('PK\x03\x04'), 1, 2, 3, 4]));
  assert.equal(meta.appended?.kind, 'zip archive');
  assert.equal(meta.appended?.bytes, 8);
  const field = meta.fields.find((f) => f.label === 'Appended data');
  assert.ok(field?.sensitive, 'a smuggled zip is a sensitive finding');
});

test('extractFileMetadata: data after JPEG EOI is surfaced; clean files are not', () => {
  const meta = extractFileMetadata(jpegThen([...new TextEncoder().encode('hidden payload here!')]));
  assert.equal(meta.appended?.kind, 'text');
  assert.equal(extractFileMetadata(jpegThen([])).appended, undefined);
});

test('extractFileMetadata: FF D9 inside a metadata segment does not fake an early EOI', () => {
  // An APP1 whose payload contains the EOI byte pair (as a real EXIF thumbnail
  // would) - the end-of-image scan starts at the SOS entropy data, so this must
  // NOT read as "appended data after the image".
  const app1 = bytesOf([0xff, 0xe1], u16be(8), [0xff, 0xd9, 0, 0, 0, 0]);
  const sos = bytesOf([0xff, 0xda], u16be(8), [1, 1, 0, 0, 63, 0], [0x12, 0x34], [0xff, 0xd9]);
  const meta = extractFileMetadata(bytesOf([0xff, 0xd8], [...app1], [...sos]));
  assert.equal(meta.appended, undefined);
});

test('extractFileMetadata: motion-photo video append is disclosed but not sensitive', () => {
  const mp4 = [...u32be(24), ...[...'ftypisom'].map((c) => c.charCodeAt(0)), 0, 0, 0, 0];
  const meta = extractFileMetadata(jpegThen(mp4));
  assert.equal(meta.appended?.kind, 'video (motion photo)');
  assert.equal(meta.fields.find((f) => f.label === 'Appended data')?.sensitive, false);
});

test('extractFileMetadata: QuickTime brand sniffs as QuickTime; truncated boxes never throw', () => {
  assert.equal(extractFileMetadata(mp4WithXmp(xmpPacket('trainedAlgorithmicMedia'), 'qt  ')).format, 'QuickTime');
  const ftyp = bytesOf(u32be(16), 'ftypisom', u32be(0));
  const truncated = bytesOf([...ftyp], u32be(9999), 'uuid', [1, 2, 3]); // declared size runs past EOF
  assert.doesNotThrow(() => extractFileMetadata(truncated));
  assert.equal(extractFileMetadata(truncated).format, 'MP4');
});

// ── GIF (block-walk to the trailer 0x3B) ──────────────────────────────────────

// A minimal, well-formed GIF89a stream: header + logical screen descriptor (no
// global colour table) + one trivial image (no local colour table, a single
// one-byte LZW sub-block) + trailer - then `trailing`.
function gifThen(trailing: number[]): Uint8Array {
  const header = 'GIF89a';
  const lsd = [...u16le(1), ...u16le(1), 0, 0, 0]; // 1x1 canvas, no GCT, bg 0, aspect 0
  const image = [
    0x2c, ...u16le(0), ...u16le(0), ...u16le(1), ...u16le(1), 0, // image descriptor, no LCT
    2,    // LZW minimum code size
    1, 0, // one sub-block: 1 byte of data
    0,    // block terminator
  ];
  return bytesOf(header, lsd, image, [0x3b], trailing);
}

test('extractFileMetadata: zip appended after GIF trailer is surfaced with correct offset', () => {
  const cleanLen = gifThen([]).length;
  const meta = extractFileMetadata(gifThen([...new TextEncoder().encode('PK\x03\x04'), 9, 9]));
  assert.equal(meta.format, 'GIF');
  assert.equal(meta.appended?.kind, 'zip archive');
  assert.equal(meta.appended?.bytes, 6);
  assert.equal(meta.appended?.offset, cleanLen, 'offset must point exactly at the first trailing byte');
});

test('extractFileMetadata: clean GIF (nothing past the trailer) has no appended payload', () => {
  const meta = extractFileMetadata(gifThen([]));
  assert.equal(meta.format, 'GIF');
  assert.equal(meta.appended, undefined);
});

test('extractFileMetadata: truncated or malformed GIF never throws and records nothing', () => {
  // Chopped off mid-image-data - the trailer never appears.
  const full = gifThen([1, 2, 3]);
  const truncated = full.subarray(0, full.length - 10);
  assert.doesNotThrow(() => extractFileMetadata(truncated));
  assert.equal(extractFileMetadata(truncated).appended, undefined);

  // An unrecognised block introducer mid-stream (not 0x2C / 0x21 / 0x3B).
  const header = 'GIF89a';
  const lsd = [...u16le(1), ...u16le(1), 0, 0, 0];
  const garbage = bytesOf(header, lsd, [0xff, 1, 2, 3]);
  assert.doesNotThrow(() => extractFileMetadata(garbage));
  assert.equal(extractFileMetadata(garbage).appended, undefined);

  // Too short to even carry a logical screen descriptor.
  const tiny = bytesOf('GIF89a', [1, 2]);
  assert.doesNotThrow(() => extractFileMetadata(tiny));
  assert.equal(extractFileMetadata(tiny).appended, undefined);
});

// ── APNG (structurally a PNG - regression, not a new code path) ───────────────
// APNG reuses the PNG signature and IEND terminator; readPng's chunk walk steps
// over every chunk generically by its length field, so acTL/fcTL/fdAT (which
// match none of its known chunk-type branches) are skipped exactly like any
// other unrecognised chunk and the walk still reaches IEND correctly. This
// locks in that the existing PNG path needs no APNG-specific code.
function apngThen(trailing: number[]): Uint8Array {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const chunk = (type: string, data: number[]): number[] =>
    [...u32be(data.length), ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0]; // CRC unchecked by the reader
  const acTL = chunk('acTL', [...u32be(2), ...u32be(0)]); // 2 frames, loop forever
  const fcTL = chunk('fcTL', new Array(26).fill(0));      // frame control (content unchecked by the walker)
  const idat = chunk('IDAT', [1, 2, 3, 4]);               // default-image data
  const fdat = chunk('fdAT', [0, 0, 0, 1, 5, 6, 7, 8]);   // frame data (sequence number + bytes)
  const iend = chunk('IEND', []);
  return bytesOf(sig, acTL, fcTL, idat, fdat, iend, trailing);
}

test('extractFileMetadata: APNG (acTL/fcTL/fdAT) already catches appended data via the PNG IEND path', () => {
  const clean = apngThen([]);
  const cleanMeta = extractFileMetadata(clean);
  assert.equal(cleanMeta.format, 'PNG');
  assert.equal(cleanMeta.appended, undefined);

  const dirty = extractFileMetadata(apngThen([...new TextEncoder().encode('PK\x03\x04'), 1, 2, 3]));
  assert.equal(dirty.appended?.kind, 'zip archive');
  assert.equal(dirty.appended?.bytes, 7);
  assert.equal(dirty.appended?.offset, clean.length, 'offset must point exactly at the first trailing byte');
});

// ─── Multi-picture JPEGs: an HDR gain map is DECLARED content, not a payload ──
//
// plans/61-deeprichpixels.md section 6 B2 / task E2. Lolly's own `hdr=1` JPEG export is a
// gain-map file: an ordinary SDR JPEG with a second (gain-map) JPEG past its
// EOI, described by a CIPA DC-007 MPF index. Before this coverage the reveal
// called that "JPEG image - N KB after the image ends", flagged `sensitive` - 
// i.e. Lolly accusing its own export of smuggling. These tests pin the honest
// report AND the negative control that an UNdeclared trailer is still flagged.

const SOS_HDR = [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00];

/** A structurally-valid JPEG: SOI, an SOS whose length field is honest, entropy bytes, EOI. */
function minimalJpeg(entropy: number[]): Uint8Array {
  return bytesOf([0xff, 0xd8], SOS_HDR, entropy, [0xff, 0xd9]);
}

const GM_META: GainMapMeta = {
  channels: 1,
  gainMapMin: 0,
  gainMapMax: 2,
  gamma: 1,
  offsetSdr: 0,
  offsetHdr: 0,
  hdrCapacityMin: 0,
  hdrCapacityMax: 2,
  baseRendition: 'sdr',
  useBaseColorSpace: true,
};

const GAINMAP_JPEG = assembleGainMapJpeg(minimalJpeg([1, 2, 3]), minimalJpeg([4, 5, 6]), GM_META);

test('extractFileMetadata: an HDR gain-map JPEG is named, not accused', () => {
  const meta = extractFileMetadata(GAINMAP_JPEG);
  assert.equal(meta.format, 'JPEG');

  // The bytes are still disclosed - sized, offset, and typed. That is the point
  // of the reveal; suppressing the field would be the wrong fix.
  assert.ok(meta.appended, 'the second image must still be disclosed');
  assert.match(meta.appended!.kind, /HDR gain map/);
  assert.ok(meta.appended!.bytes > 0);

  const appended = meta.fields.find((f) => f.label === 'Appended data');
  assert.ok(appended, 'the Appended data field is still emitted');
  assert.ok(!appended!.sensitive, 'declared, named content must not be flagged as hidden data');
  assert.match(appended!.value, /MPF/, 'the value must say what accounts for the bytes');
  // The exact defect: the pre-fix reader sniffed the trailer's magic bytes.
  assert.ok(!/^JPEG image/.test(appended!.value), 'must not report a bare "JPEG image" append');

  const gm = meta.fields.find((f) => f.label === 'HDR gain map');
  assert.ok(gm, 'a gain map earns its own plain-language field');
  assert.ok(!gm!.sensitive);
  assert.equal(gm!.group, 'technical');
});

test('extractFileMetadata: an UNdeclared JPEG after the EOI is still flagged sensitive', () => {
  // Negative control for the fix above: same shape (a JPEG past the EOI), no
  // MPF index accounting for it. This is the smuggling pattern and must stay loud.
  const smuggled = bytesOf([...minimalJpeg([1, 2, 3])], [...minimalJpeg([4, 5, 6])]);
  const meta = extractFileMetadata(smuggled);
  assert.equal(meta.appended?.kind, 'JPEG image');
  const f = meta.fields.find((x) => x.label === 'Appended data');
  assert.equal(f?.sensitive, true);
  assert.equal(meta.fields.some((x) => x.label === 'HDR gain map'), false);
});

// ── an independent, LITTLE-ENDIAN MPF writer (our own writer only emits MM) ──

function leMpfSegment(sizes: [number, number], offsets: [number, number]): Uint8Array {
  const payload = 4 + 82;            // "MPF\0" + TIFF stream (50 header/IFD + 32 entries)
  const seg = new Uint8Array(4 + payload);
  const dv = new DataView(seg.buffer);
  seg[0] = 0xff; seg[1] = 0xe2;
  dv.setUint16(2, seg.length - 2);   // JPEG segment lengths are ALWAYS big-endian
  seg.set(new TextEncoder().encode('MPF\0'), 4);
  const h = 8;
  seg[h] = 0x49; seg[h + 1] = 0x49;  // "II" - little-endian TIFF
  dv.setUint16(h + 2, 0x002a, true);
  dv.setUint32(h + 4, 8, true);
  const ifd = h + 8;
  dv.setUint16(ifd, 3, true);
  const put = (i: number, tag: number, type: number, count: number, value: number) => {
    const e = ifd + 2 + i * 12;
    dv.setUint16(e, tag, true); dv.setUint16(e + 2, type, true);
    dv.setUint32(e + 4, count, true); dv.setUint32(e + 8, value, true);
  };
  const valuesAt = 8 + 2 + 3 * 12 + 4; // 50, relative to h
  put(0, 0xb000, 7, 4, 0x30303130);    // MPFVersion "0100" inline (LE byte order)
  put(1, 0xb001, 4, 1, 2);             // NumberOfImages
  put(2, 0xb002, 7, 32, valuesAt);     // MPEntry
  dv.setUint32(ifd + 2 + 3 * 12, 0, true); // next IFD
  for (let i = 0; i < 2; i++) {
    const at = h + valuesAt + i * 16;
    dv.setUint32(at, i === 0 ? 0x030000 : 0, true);
    dv.setUint32(at + 4, sizes[i]!, true);
    dv.setUint32(at + 8, offsets[i]!, true);
  }
  return seg;
}

/** A two-image MPF file with no gain-map metadata anywhere - a plain MPO. */
function plainMpoJpeg(secondEntropy: number[], breakIt?: 'offset' | 'notJpeg'): Uint8Array {
  const second = minimalJpeg(secondEntropy);
  const tail = bytesOf(SOS_HDR, [7, 7, 7], [0xff, 0xd9]);
  const segLen = 4 + 4 + 82;
  const primaryLen = 2 + segLen + tail.length;
  const h = 2 + 8; // SOI, then the MPF segment's MP Endian field
  let offset = primaryLen - h;
  if (breakIt === 'offset') offset = 0x7ffffff0; // an offset that lies about the buffer
  const seg = leMpfSegment([primaryLen, second.length], [0, offset]);
  const body = breakIt === 'notJpeg' ? bytesOf([0x00, 0x00], [...second.subarray(2)]) : second;
  return bytesOf([0xff, 0xd8], [...seg], [...tail], [...body]);
}

test('readMpfIndex: reads a little-endian MPF index; a plain MPO is declared but not a gain map', () => {
  const mpo = plainMpoJpeg([9, 9, 9]);
  const idx = readMpfIndex(mpo);
  assert.ok(idx, 'a valid little-endian MPF index must parse');
  assert.equal(idx!.images.length, 2);
  assert.equal(idx!.images[0]!.start, 0);
  assert.equal(idx!.images[1]!.start, idx!.trailerStart, 'the declared offset must land on the real trailer');
  assert.equal(idx!.gainMap, false, 'no hdrgm/ISO metadata anywhere - not a gain map');

  const meta = extractFileMetadata(mpo);
  const f = meta.fields.find((x) => x.label === 'Appended data');
  assert.ok(!f?.sensitive, 'a declared second image is not hidden data');
  assert.match(meta.appended!.kind, /MPF multi-picture/);
  assert.equal(meta.fields.some((x) => x.label === 'HDR gain map'), false);
});

test('readMpfIndex: a lying index is refused, and the trailer goes back to being suspicious', () => {
  for (const how of ['offset', 'notJpeg'] as const) {
    const bad = plainMpoJpeg([9, 9, 9], how);
    assert.equal(readMpfIndex(bad), null, `${how}: nothing an index CLAIMS is trusted`);
    const f = extractFileMetadata(bad).fields.find((x) => x.label === 'Appended data');
    assert.equal(f?.sensitive, true, `${how}: unaccounted trailing bytes stay flagged`);
  }
});

test('readMpfIndex: our own gain-map file parses, and non-MPF inputs return null', () => {
  const idx = readMpfIndex(GAINMAP_JPEG);
  assert.ok(idx);
  assert.equal(idx!.gainMap, true);
  assert.equal(idx!.images.length, 2);
  assert.equal(idx!.images[1]!.start, idx!.trailerStart);
  assert.equal(idx!.images[0]!.start + idx!.images[0]!.length, idx!.trailerStart);
  assert.equal(idx!.images[1]!.start + idx!.images[1]!.length, GAINMAP_JPEG.length);

  assert.equal(readMpfIndex(minimalJpeg([1, 2, 3])), null, 'an ordinary JPEG has no MPF index');
  assert.equal(readMpfIndex(new Uint8Array([1, 2, 3, 4])), null, 'not a JPEG at all');
  assert.equal(readMpfIndex(new Uint8Array(0)), null);
  assert.equal(readMpfIndex(null), null);
  assert.equal(readMpfIndex(GAINMAP_JPEG.subarray(0, 40)), null, 'a truncated file has no EOI to trust');
});

test('extractFileMetadata: the MPF change leaves ordinary and motion-photo JPEGs alone', () => {
  // Negative control 1: an ordinary EXIF JPEG gains no new field and no trailer.
  const plain = extractFileMetadata(jpegWithExif(tiffWithSingleAsciiTag(0x013b, 'Ada Lovelace')));
  assert.equal(plain.appended, undefined);
  assert.equal(plain.fields.some((f) => f.label === 'HDR gain map'), false);
  assert.equal(plain.fields.some((f) => f.label === 'Appended data'), false);

  // Negative control 2: the motion-photo precedent this fix was modelled on is
  // unchanged - disclosed, sniffed as video, not sensitive, no MPF claim.
  const mp4 = bytesOf([0, 0, 0, 0x18], 'ftypmp42', [0, 0, 0, 0], 'mp42isom');
  const motion = extractFileMetadata(bytesOf([...minimalJpeg([1, 2, 3])], [...mp4]));
  assert.equal(motion.appended?.kind, 'video (motion photo)');
  const f = motion.fields.find((x) => x.label === 'Appended data');
  assert.equal(!!f?.sensitive, false);
  assert.match(f!.value, /after the image ends/, 'unchanged wording for the non-MPF case');
});

test('appendedIsExpected: one rule for "these bytes are accounted for"', () => {
  // The predicate exists because the verify view had its own copy of this rule,
  // spelled as `kind !== 'video (motion photo)'` - which is exactly why a
  // gain-map export still drew a "Hidden data appended" pip. Shells call this.
  assert.equal(appendedIsExpected(extractFileMetadata(GAINMAP_JPEG).appended), true);
  assert.equal(appendedIsExpected(extractFileMetadata(plainMpoJpeg([9, 9, 9])).appended), true);

  const mp4 = bytesOf([0, 0, 0, 0x18], 'ftypmp42', [0, 0, 0, 0], 'mp42isom');
  assert.equal(appendedIsExpected(extractFileMetadata(bytesOf([...minimalJpeg([1, 2, 3])], [...mp4])).appended), true);

  const zip = extractFileMetadata(bytesOf([...minimalJpeg([1, 2, 3])], 'PK\x03\x04', [1, 2, 3])).appended;
  assert.equal(zip?.kind, 'zip archive');
  assert.equal(zip?.declared, false);
  assert.equal(appendedIsExpected(zip), false);

  assert.equal(appendedIsExpected(undefined), false, 'no payload is not an "expected payload"');
  // A hand-forged record cannot claim exemption by kind alone.
  assert.equal(appendedIsExpected({ bytes: 1, kind: 'HDR gain map (ISO 21496-1 / Ultra HDR)', offset: 0 }), false);
});

// ── ISO BMFF (MP4/M4A) container metadata ───────────────────────────────────
// Synthetic-box builders. Every box is length-prefixed big-endian, so a tree
// assembles inside-out; '©' maps to 0xA9 through the &0xff in bmffBox().

const zeros = (n: number): number[] => new Array(n).fill(0);
function bmffBox(type: string, ...parts: (number[] | string)[]): number[] {
  const body = parts.flatMap((p) => (typeof p === 'string' ? [...new TextEncoder().encode(p)] : p));
  return [...u32be(8 + body.length), ...[...type].map((c) => c.charCodeAt(0) & 0xff), ...body];
}
const bmffHdlr = (kind: string, name: string): number[] =>
  bmffBox('hdlr', u32be(0), u32be(0), kind, zeros(12), `${name}\0`);
const bmffVideoTrak = (note: string): number[] =>
  bmffBox('trak', bmffBox('mdia', bmffHdlr('vide', note), bmffBox('minf', bmffBox('stbl',
    bmffBox('stsd', u32be(0), u32be(1),
      bmffBox('avc1', zeros(6), u16be(1), zeros(16), u16be(720), u16be(1280), zeros(50))),
  ))));
const bmffAudioTrak = (note: string): number[] =>
  bmffBox('trak', bmffBox('mdia', bmffHdlr('soun', note), bmffBox('minf', bmffBox('stbl',
    bmffBox('stsd', u32be(0), u32be(1),
      bmffBox('mp4a', zeros(6), u16be(1), zeros(8), u16be(2), u16be(16), zeros(4), u32be(44100 << 16))),
  ))));
const bmffIlstMeta = (...entries: number[][]): number[] =>
  bmffBox('meta', u32be(0), bmffHdlr('mdir', 'appl'), bmffBox('ilst', ...entries));
const bmffIlstText = (tag: string, value: string): number[] =>
  bmffBox(tag, bmffBox('data', u32be(1), u32be(0), value));
const GOOGLE_NOTE = 'ISO Media file produced by Google Inc.';
// 2026-08-19T14:02:10Z in the BMFF epoch (seconds since 1904-01-01).
const BMFF_CREATED = 2082844800 + Math.floor(Date.parse('2026-08-19T14:02:10Z') / 1000);
const bmffMvhd = (created: number, timescale: number, duration: number): number[] =>
  bmffBox('mvhd', u32be(0), u32be(created), u32be(created), u32be(timescale), u32be(duration), zeros(80));

test('extractFileMetadata: BMFF reads tracks, tags, timestamps and the Google AI fingerprint', () => {
  // A Gemini/Veo video download in miniature: mp42 brand, Google handler note
  // on the tracks, an ilst ©too of exactly "Google", no XMP and no C2PA.
  const mp4 = bytesOf(
    bmffBox('ftyp', 'mp42', u32be(0), 'isommp42'),
    bmffBox('moov',
      bmffMvhd(BMFF_CREATED, 1000, 73816),
      bmffVideoTrak(GOOGLE_NOTE),
      bmffAudioTrak(GOOGLE_NOTE),
      bmffBox('udta', bmffIlstMeta(bmffIlstText('©too', 'Google'))),
    ),
  );
  const meta = extractFileMetadata(mp4);
  assert.equal(meta.format, 'MP4');
  const by = (label: string) => meta.fields.find((f) => f.label === label);
  assert.equal(by('Encoded with')?.value, 'Google');
  assert.equal(by('Handler description')?.value, GOOGLE_NOTE);
  assert.equal(by('Video track')?.value, 'H.264 (avc1) - 720 × 1280 px');
  assert.equal(by('Audio track')?.value, 'AAC (mp4a) - 44.1 kHz stereo');
  assert.equal(by('Created')?.value, '2026-08-19 14:02 UTC');
  assert.equal(by('Duration')?.value, '1 min 14 s');
  assert.equal(by('Container profile')?.value, 'mp42');
  assert.equal(meta.producer?.vendor, 'Google');
  assert.equal(meta.producer?.signature, 'ai-download');
  assert.equal(meta.producer?.hint, 'Gemini or Veo');
  assert.ok(meta.producer?.markers.includes(GOOGLE_NOTE));
});

test('extractFileMetadata: audio-only DASH m4a maps to the Gemini/NotebookLM hint', () => {
  const m4a = bytesOf(
    bmffBox('ftyp', 'dash', u32be(0), 'iso6mp41'),
    bmffBox('moov',
      bmffMvhd(0, 44100, 64011264),
      bmffAudioTrak(GOOGLE_NOTE),
      bmffBox('udta', bmffIlstMeta(bmffIlstText('©too', 'Google'))),
    ),
  );
  const meta = extractFileMetadata(m4a);
  assert.equal(meta.producer?.signature, 'ai-download');
  assert.equal(meta.producer?.hint, 'Gemini or NotebookLM');
  assert.equal(meta.fields.find((f) => f.label === 'Container profile')?.value, 'dash - fragmented (streaming delivery)');
  assert.equal(meta.fields.find((f) => f.label === 'Duration')?.value, '24 min 12 s');
  assert.equal(meta.fields.find((f) => f.label === 'Created'), undefined, 'a zero created stamp is unset, not 1904');
});

test('extractFileMetadata: the dated YouTube handler note is a re-encode, never the AI hint', () => {
  const mp4 = bytesOf(
    bmffBox('ftyp', 'mp42', u32be(0), 'isommp42'),
    bmffBox('moov', bmffVideoTrak(`${GOOGLE_NOTE} Created on: 10/09/2015.`)),
  );
  const meta = extractFileMetadata(mp4);
  assert.equal(meta.producer?.vendor, 'Google');
  assert.equal(meta.producer?.signature, 'reencode');
});

test('extractFileMetadata: a non-Google BMFF file carries no producer fingerprint', () => {
  const mp4 = bytesOf(
    bmffBox('ftyp', 'mp42', u32be(0), 'isommp42'),
    bmffBox('moov',
      bmffVideoTrak('VideoHandler'),
      bmffBox('udta', bmffIlstMeta(bmffIlstText('©too', 'Lavf61.1.100'))),
    ),
  );
  const meta = extractFileMetadata(mp4);
  assert.equal(meta.producer, undefined);
  assert.equal(meta.fields.find((f) => f.label === 'Encoded with')?.value, 'Lavf61.1.100');
});

test('extractFileMetadata: Android ©xyz GPS becomes a fix with a map link', () => {
  const mp4 = bytesOf(
    bmffBox('ftyp', 'mp42', u32be(0), 'isommp42'),
    bmffBox('moov', bmffBox('udta', bmffBox('©xyz', u16be(22), u16be(0x15c7), '+37.421800-122.084000/'))),
  );
  const meta = extractFileMetadata(mp4);
  assert.ok(meta.gps);
  assert.ok(Math.abs(meta.gps!.lat - 37.4218) < 1e-6);
  assert.ok(Math.abs(meta.gps!.lon - -122.084) < 1e-6);
  assert.ok(meta.mapUrl?.startsWith('https://www.openstreetmap.org/'));
  assert.equal(meta.fields.find((f) => f.label === 'Coordinates')?.sensitive, true);
});

test('extractFileMetadata: QuickTime mdta keys yield device, software and location rows', () => {
  const key = (name: string): number[] => [...u32be(8 + name.length), ...[...'mdta'].map((c) => c.charCodeAt(0)), ...[...new TextEncoder().encode(name)]];
  const idxEntry = (i: number, value: string): number[] =>
    bmffBox(String.fromCharCode((i >>> 24) & 0xff, (i >>> 16) & 0xff, (i >>> 8) & 0xff, i & 0xff),
      bmffBox('data', u32be(1), u32be(0), value));
  const mov = bytesOf(
    bmffBox('ftyp', 'qt  ', u32be(0), 'qt  '),
    bmffBox('moov',
      bmffBox('meta', u32be(0), bmffHdlr('mdta', ''),
        bmffBox('keys', u32be(0), u32be(3),
          key('com.apple.quicktime.model'), key('com.apple.quicktime.software'), key('com.apple.quicktime.location.ISO6709')),
        bmffBox('ilst', idxEntry(1, 'iPhone 15 Pro'), idxEntry(2, '18.1'), idxEntry(3, '-33.8688+151.2093/')),
      ),
    ),
  );
  const meta = extractFileMetadata(mov);
  assert.equal(meta.format, 'QuickTime');
  assert.equal(meta.fields.find((f) => f.label === 'Device model')?.value, 'iPhone 15 Pro');
  assert.equal(meta.fields.find((f) => f.label === 'Software')?.value, '18.1');
  assert.ok(meta.gps && Math.abs(meta.gps.lat - -33.8688) < 1e-6);
});

test('extractFileMetadata: hostile BMFF sizes neither throw nor hang', () => {
  const cases = [
    // A child whose declared size overruns its parent.
    bytesOf(bmffBox('ftyp', 'mp42', u32be(0), 'isommp42'), [0, 0xff, 0xff, 0xff], 'moov'),
    // A size smaller than its own header.
    bytesOf(bmffBox('ftyp', 'mp42', u32be(0), 'isommp42'), u32be(5), 'moov'),
    // A largesize box truncated before the 64-bit length.
    bytesOf(bmffBox('ftyp', 'mp42', u32be(0), 'isommp42'), u32be(1), 'moov', [0, 0]),
    // A keys box declaring far more entries than it holds.
    bytesOf(bmffBox('ftyp', 'mp42', u32be(0), 'isommp42'),
      bmffBox('moov', bmffBox('meta', u32be(0), bmffHdlr('mdta', ''), bmffBox('keys', u32be(0), u32be(0xffffffff)), bmffBox('ilst')))),
  ];
  for (const bytes of cases) {
    const meta = extractFileMetadata(bytes);
    assert.equal(meta.format, 'MP4');
  }
});
