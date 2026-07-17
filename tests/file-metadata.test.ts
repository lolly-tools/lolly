/**
 * Embedded-metadata reader tests (the /verify view's "reveal" side).
 * Run with: node --test tests/file-metadata.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractFileMetadata } from '../engine/src/file-metadata.ts';

const u16le = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff];
const u32le = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff];
const u16be = (n: number): number[] => [(n >> 8) & 0xff, n & 0xff];
const bytesOf = (...parts: (number[] | string)[]): Uint8Array => {
  const arrs = parts.map((p) => (typeof p === 'string' ? [...new TextEncoder().encode(p)] : p));
  return new Uint8Array(arrs.flat());
};

// A minimal EXIF/TIFF block with a single ASCII IFD0 entry, no Make/Model —
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
  // and (caught by the outer try/catch) silently discarding every field —
  // Artist, Software, GPS, all of it — for any EXIF block without a camera.
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

// PNG: the XMP packet rides in an iTXt chunk under the reserved keyword — the
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
// stuffing in the entropy data, ending at a real EOI — then `trailing`.
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
  // would) — the end-of-image scan starts at the SOS entropy data, so this must
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
// one-byte LZW sub-block) + trailer — then `trailing`.
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
  // Chopped off mid-image-data — the trailer never appears.
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

// ── APNG (structurally a PNG — regression, not a new code path) ───────────────
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
