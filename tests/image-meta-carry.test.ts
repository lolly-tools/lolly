// SPDX-License-Identifier: MPL-2.0
// plans/144 Wave 1: the metadata carry. Golden sources are built with the
// engine's own writers, then every assertion reads back through
// extractFileMetadata / the container walkers - an independent parse path -
// so a writer bug cannot vouch for itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  carryImageMetadata, buildCarryExifTiff, insertWebpMeta, META_CARRY_FIELDS,
  pngChunk, readU32,
} from '../engine/src/image-meta.ts';
import { extractFileMetadata, extractXmpPacket } from '../engine/src/file-metadata.ts';
import { insertJpegSegments, scanJpegSegments } from '../engine/src/jpeg-segments.ts';
import { extractC2paStore } from '../engine/src/c2pa-verify.ts';
import { embedC2pa } from '../engine/src/c2pa-containers.ts';
import { crc32 } from '../engine/src/zip-crypto.ts';

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** Structurally minimal JPEG: SOI, an SOS, one entropy byte, EOI. */
function tinyJpeg(): Uint8Array {
  return Uint8Array.of(0xFF, 0xD8, 0xFF, 0xDA, 0x00, 0x02, 0x00, 0xFF, 0xD9);
}

/** Minimal PNG: signature + IHDR (1x1 grey) + empty IDAT + IEND. Chunk CRCs real. */
function tinyPng(): Uint8Array {
  const sig = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
  const ihdrData = new Uint8Array(13);
  const dv = new DataView(ihdrData.buffer);
  dv.setUint32(0, 1); dv.setUint32(4, 1);
  ihdrData[8] = 8; // bit depth
  const parts = [sig, pngChunk('IHDR', ihdrData), pngChunk('IDAT', new Uint8Array(0)), pngChunk('IEND', new Uint8Array(0))];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Minimal WebP: RIFF/WEBP + a VP8L header declaring 1x1, no alpha. */
function tinyWebp(): Uint8Array {
  const payload = Uint8Array.of(0x2F, 0x00, 0x00, 0x00, 0x00); // signature + 1x1
  const out = new Uint8Array(12 + 8 + payload.length + 1); // odd payload → pad
  const cc = (o: number, s: string): void => { for (let i = 0; i < 4; i++) out[o + i] = s.charCodeAt(i); };
  cc(0, 'RIFF');
  const riffSize = out.length - 8;
  out[4] = riffSize & 0xFF; out[5] = (riffSize >>> 8) & 0xFF; out[6] = (riffSize >>> 16) & 0xFF; out[7] = (riffSize >>> 24) & 0xFF;
  cc(8, 'WEBP');
  cc(12, 'VP8L');
  out[16] = payload.length;
  out.set(payload, 20);
  return out;
}

const XMP_PLAIN =
  '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
  '<rdf:Description xmlns:dc="http://purl.org/dc/elements/1.1/">' +
  '<dc:creator><rdf:Seq><rdf:li>Ana Kovac</rdf:li></rdf:Seq></dc:creator>' +
  '</rdf:Description></rdf:RDF></x:xmpmeta>';

const XMP_WITH_GPS = XMP_PLAIN.replace(
  '</rdf:Description>',
  '<exif:GPSLatitude xmlns:exif="http://ns.adobe.com/exif/1.0/">27,10.5N</exif:GPSLatitude></rdf:Description>',
);

function jpegApp1Segment(id: string, payload: Uint8Array): Uint8Array {
  const idBytes = new TextEncoder().encode(id + '\0');
  const segLen = 2 + idBytes.length + payload.length;
  const seg = new Uint8Array(2 + segLen);
  seg[0] = 0xFF; seg[1] = 0xE1;
  seg[2] = (segLen >> 8) & 0xFF; seg[3] = segLen & 0xFF;
  seg.set(idBytes, 4);
  seg.set(payload, 4 + idBytes.length);
  return seg;
}

const FIELDS = {
  description: 'Sunset over the bay',
  software: 'CameraOS 9.1',
  author: 'Ana Kovac',
  copyright: '© 2026 Ana Kovac',
  'capture date': '2026:08:20 17:31:02',
};
const GPS = { lat: 27.175, lon: -78.042 };

/** A JPEG source carrying full EXIF (incl. GPS) + an XMP packet. */
function goldenJpeg(xmp: string = XMP_PLAIN): Uint8Array {
  const tiff = buildCarryExifTiff({ ...FIELDS }, GPS)!;
  const exifSeg = jpegApp1Segment('Exif\0', tiff);
  const xmpSeg = jpegApp1Segment('http://ns.adobe.com/xap/1.0/', new TextEncoder().encode(xmp));
  return insertJpegSegments(tinyJpeg(), [exifSeg, xmpSeg]);
}

/** Walk a PNG and verify every chunk CRC; returns the chunk type list. */
function pngWalk(bytes: Uint8Array): string[] {
  const types: string[] = [];
  let p = 8;
  while (p + 12 <= bytes.length) {
    const len = readU32(bytes, p);
    const type = String.fromCharCode(bytes[p + 4]!, bytes[p + 5]!, bytes[p + 6]!, bytes[p + 7]!);
    assert.ok(p + 12 + len <= bytes.length, `chunk ${type} runs past the buffer`);
    const crc = readU32(bytes, p + 8 + len);
    assert.equal(crc, crc32(bytes.subarray(p + 4, p + 8 + len)), `chunk ${type} CRC`);
    types.push(type);
    p += 12 + len;
    if (type === 'IEND') break;
  }
  return types;
}

/** Walk a RIFF/WebP; asserts the declared RIFF size matches; returns fourccs. */
function webpWalk(bytes: Uint8Array): string[] {
  const cc = (o: number): string => String.fromCharCode(bytes[o]!, bytes[o + 1]!, bytes[o + 2]!, bytes[o + 3]!);
  assert.equal(cc(0), 'RIFF');
  assert.equal(cc(8), 'WEBP');
  const declared = (bytes[4]! | (bytes[5]! << 8) | (bytes[6]! << 16) | (bytes[7]! * 0x1000000)) >>> 0;
  assert.equal(declared, bytes.length - 8, 'RIFF size field');
  const out: string[] = [];
  let p = 12;
  while (p + 8 <= bytes.length) {
    const size = (bytes[p + 4]! | (bytes[p + 5]! << 8) | (bytes[p + 6]! << 16) | (bytes[p + 7]! * 0x1000000)) >>> 0;
    assert.ok(p + 8 + size <= bytes.length, `chunk ${cc(p)} runs past the buffer`);
    out.push(cc(p));
    p += 8 + size + (size & 1);
  }
  return out;
}

const fieldOf = (bytes: Uint8Array, label: string): string | undefined =>
  extractFileMetadata(bytes).fields.find((f) => f.label === label)?.value;

// ─── The golden source round-trips through the independent reader ────────────

test('goldenJpeg: buildCarryExifTiff output reads back via extractFileMetadata', () => {
  const src = goldenJpeg();
  const meta = extractFileMetadata(src);
  assert.equal(meta.format, 'JPEG');
  assert.equal(fieldOf(src, 'Image description'), FIELDS.description);
  assert.equal(fieldOf(src, 'Software'), FIELDS.software);
  assert.equal(fieldOf(src, 'Artist'), FIELDS.author);
  assert.equal(fieldOf(src, 'Copyright'), FIELDS.copyright);
  assert.equal(fieldOf(src, 'Taken'), FIELDS['capture date']);
  assert.ok(meta.gps, 'GPS IFD read back');
  assert.ok(Math.abs(meta.gps!.lat - GPS.lat) < 1e-4, `lat ${meta.gps!.lat}`);
  assert.ok(Math.abs(meta.gps!.lon - GPS.lon) < 1e-4, `lon ${meta.gps!.lon}`);
  assert.equal(extractXmpPacket(src), XMP_PLAIN);
});

// ─── Carry into each output container ────────────────────────────────────────

test('carry JPEG → PNG: fields + XMP carried, GPS dropped by default, chunks valid', () => {
  const src = goldenJpeg();
  const { bytes, carried } = carryImageMetadata({ bytes: src }, { bytes: tinyPng(), mime: 'image/png' });
  const types = pngWalk(bytes);
  assert.ok(types.includes('eXIf'), 'eXIf chunk present');
  assert.ok(types.includes('iTXt'), 'iTXt chunks present');
  assert.equal(types[0], 'IHDR');
  assert.equal(types.at(-1), 'IEND');
  // Independent read-back.
  assert.equal(fieldOf(bytes, 'Artist'), FIELDS.author);       // via eXIf
  assert.equal(fieldOf(bytes, 'Author'), FIELDS.author);       // via iTXt
  assert.equal(fieldOf(bytes, 'Copyright'), FIELDS.copyright);
  assert.equal(extractXmpPacket(bytes), XMP_PLAIN);
  // GPS honoured per opts: absent by default, and the drop is disclosed.
  assert.equal(extractFileMetadata(bytes).gps, undefined);
  assert.ok(carried.dropped.some((d) => d.field === 'location' && d.why === 'off'));
  for (const key of ['description', 'author', 'copyright', 'software', 'capture date']) {
    assert.ok(carried.carried.includes(key), `carried ${key}`);
  }
  assert.ok(carried.carried.includes('embedded metadata (XMP)'));
});

test('carry with { gps: true }: the fix survives into the PNG eXIf', () => {
  const src = goldenJpeg();
  const { bytes, carried } = carryImageMetadata({ bytes: src }, { bytes: tinyPng(), mime: 'image/png' }, { gps: true });
  const meta = extractFileMetadata(bytes);
  assert.ok(meta.gps, 'GPS carried on opt-in');
  assert.ok(Math.abs(meta.gps!.lat - GPS.lat) < 1e-4);
  assert.ok(Math.abs(meta.gps!.lon - GPS.lon) < 1e-4);
  assert.ok(carried.carried.includes('location'));
  assert.ok(!carried.dropped.some((d) => d.field === 'location'));
});

test('carry JPEG → WebP: EXIF chunk + VP8X flag + XMP chunk, sizes exact', () => {
  const src = goldenJpeg();
  const { bytes, carried } = carryImageMetadata({ bytes: src }, { bytes: tinyWebp(), mime: 'image/webp' });
  const fourccs = webpWalk(bytes);
  assert.equal(fourccs[0], 'VP8X', 'VP8X first');
  assert.ok(fourccs.includes('EXIF'));
  assert.ok(fourccs.includes('XMP '));
  assert.ok(fourccs.includes('VP8L'), 'image data kept');
  // VP8X flags: EXIF (0x08) + XMP (0x04) set; canvas still 1x1.
  const flags = bytes[20]!;
  assert.ok(flags & 0x08, 'EXIF flag');
  assert.ok(flags & 0x04, 'XMP flag');
  assert.equal(fieldOf(bytes, 'Artist'), FIELDS.author);
  assert.equal(extractXmpPacket(bytes), XMP_PLAIN);
  assert.ok(carried.carried.includes('author'));
});

test('carry JPEG → JPEG: rebuilt EXIF + XMP, segment walk stays valid', () => {
  const src = goldenJpeg();
  const { bytes, carried } = carryImageMetadata({ bytes: src }, { bytes: tinyJpeg(), mime: 'image/jpeg' });
  const scan = scanJpegSegments(bytes);
  assert.ok(scan && scan.eoi !== null, 'still a walkable JPEG');
  assert.equal(fieldOf(bytes, 'Artist'), FIELDS.author);
  assert.equal(fieldOf(bytes, 'Taken'), FIELDS['capture date']);
  assert.equal(extractXmpPacket(bytes), XMP_PLAIN);
  assert.equal(extractFileMetadata(bytes).gps, undefined, 'no GPS by default');
  assert.ok(carried.carried.includes('capture date'));
});

// ─── The floors: C2PA never copies; XMP-with-GPS drops when location is off ──

test('a source credential is never copied across the re-encode, and the drop is reported', async () => {
  const signed = await embedC2pa(goldenJpeg(), 'jpeg', { title: 'golden' });
  assert.ok(extractC2paStore(signed), 'precondition: source carries a credential');
  const { bytes, carried } = carryImageMetadata({ bytes: signed }, { bytes: tinyPng(), mime: 'image/png' });
  assert.equal(extractC2paStore(bytes), null, 'no credential in the output');
  assert.ok(carried.dropped.some((d) => d.field === 'content credential' && /bound to the original/.test(d.why)));
});

test('an XMP packet containing GPS tags drops (reported) when location is off', () => {
  const src = goldenJpeg(XMP_WITH_GPS);
  const { bytes, carried } = carryImageMetadata({ bytes: src }, { bytes: tinyPng(), mime: 'image/png' });
  assert.equal(extractXmpPacket(bytes), null, 'no XMP in the output');
  assert.ok(carried.dropped.some((d) => d.field === 'embedded metadata (XMP)' && /location/.test(d.why)));
  assert.equal(fieldOf(bytes, 'Artist'), FIELDS.author, 'EXIF fields still carry');
});

test('XMP with GPS carries intact when { gps: true }', () => {
  const src = goldenJpeg(XMP_WITH_GPS);
  const { bytes } = carryImageMetadata({ bytes: src }, { bytes: tinyPng(), mime: 'image/png' }, { gps: true });
  assert.equal(extractXmpPacket(bytes), XMP_WITH_GPS);
});

// ─── Degenerate inputs stay honest ───────────────────────────────────────────

test('a metadata-free source carries nothing and reports nothing dropped-but-credential-free', () => {
  const { bytes, carried } = carryImageMetadata({ bytes: tinyJpeg() }, { bytes: tinyPng(), mime: 'image/png' });
  assert.deepEqual(Array.from(bytes), Array.from(tinyPng()), 'output untouched');
  assert.deepEqual(carried.carried, []);
  assert.ok(!carried.dropped.some((d) => d.field === 'location'));
});

test('an unsupported output container reports the drop instead of failing', () => {
  const { bytes, carried } = carryImageMetadata({ bytes: goldenJpeg() }, { bytes: Uint8Array.of(1, 2, 3), mime: 'image/gif' });
  assert.deepEqual(Array.from(bytes), [1, 2, 3]);
  assert.ok(carried.dropped.some((d) => d.field === 'metadata' && /no carrier/.test(d.why)));
});

test('garbage bytes never throw', () => {
  const junk = Uint8Array.from({ length: 64 }, (_, i) => (i * 37) & 0xFF);
  const { bytes } = carryImageMetadata({ bytes: junk }, { bytes: junk.slice(), mime: 'image/png' });
  assert.equal(bytes.length, 64);
});

// ─── Wave 2 G2: the export-side WebP stamper ─────────────────────────────────

test('insertWebpMeta: ExportMeta fields land as a readable EXIF chunk', () => {
  const meta = {
    software: 'Lolly', source: 'https://lolly.tools', tool: 'Poster',
    author: 'Ana Kovac', contact: '', description: 'A poster', copyright: '© Ana',
  };
  const out = insertWebpMeta(tinyWebp(), meta);
  const fourccs = webpWalk(out);
  assert.equal(fourccs[0], 'VP8X');
  assert.ok(fourccs.includes('EXIF'));
  assert.ok(fourccs.includes('XMP '), 'authorship also declared as XMP (Wave 5 O2)');
  assert.equal(fieldOf(out, 'Artist'), 'Ana Kovac');
  assert.equal(fieldOf(out, 'Software'), 'Lolly');
  assert.ok(extractXmpPacket(out)?.includes('<photoshop:Credit>Ana Kovac</photoshop:Credit>'));
  // Non-WebP input passes through untouched.
  const png = tinyPng();
  assert.equal(insertWebpMeta(png, meta), png);
});

test('META_CARRY_FIELDS: the mapping table names the five carried keys', () => {
  assert.deepEqual(META_CARRY_FIELDS.map((f) => f.key),
    ['description', 'software', 'author', 'copyright', 'capture date']);
});

// ─── Wave 5 O2: IPTC-IIM read + the pro-photo XMP write ──────────────────────

function app13Iptc(records: [number, string][]): Uint8Array {
  const enc = new TextEncoder();
  const recs: number[] = [];
  for (const [dataset, value] of records) {
    const v = enc.encode(value);
    recs.push(0x1C, 2, dataset, (v.length >> 8) & 0xFF, v.length & 0xFF, ...v);
  }
  const data = Uint8Array.from(recs);
  const head = enc.encode('Photoshop 3.0\0');
  const bim = enc.encode('8BIM');
  const payload = new Uint8Array(head.length + 4 + 2 + 2 + 4 + data.length + (data.length & 1));
  let o = 0;
  payload.set(head, o); o += head.length;
  payload.set(bim, o); o += 4;
  payload[o++] = 0x04; payload[o++] = 0x04; // resource 0x0404 (IPTC-NAA)
  payload[o++] = 0; payload[o++] = 0;       // empty pascal name, even
  payload[o++] = (data.length >>> 24) & 0xFF; payload[o++] = (data.length >>> 16) & 0xFF;
  payload[o++] = (data.length >>> 8) & 0xFF; payload[o++] = data.length & 0xFF;
  payload.set(data, o);
  const segLen = 2 + payload.length;
  const seg = new Uint8Array(2 + segLen);
  seg[0] = 0xFF; seg[1] = 0xED;
  seg[2] = (segLen >> 8) & 0xFF; seg[3] = segLen & 0xFF;
  seg.set(payload, 4);
  return seg;
}

test('IPTC-IIM: by-line, credit, copyright, caption and keywords read out of APP13', () => {
  const jpeg = insertJpegSegments(tinyJpeg(), [app13Iptc([
    [80, 'Ana Kovac'],
    [110, 'Kovac Studio'],
    [116, '© 2026 Ana Kovac'],
    [120, 'Boats at dusk'],
    [25, 'harbour'], [25, 'dusk'], [25, 'boats'],
  ])]);
  assert.equal(fieldOf(jpeg, 'By-line'), 'Ana Kovac');
  assert.equal(fieldOf(jpeg, 'Credit'), 'Kovac Studio');
  assert.equal(fieldOf(jpeg, 'Copyright'), '© 2026 Ana Kovac');
  assert.equal(fieldOf(jpeg, 'Caption'), 'Boats at dusk');
  assert.equal(fieldOf(jpeg, 'Keywords'), 'harbour, dusk, boats');
  const byline = extractFileMetadata(jpeg).fields.find((f) => f.label === 'By-line');
  assert.equal(byline?.sensitive, true, 'a by-line is personal data');
});

test('dc:subject keywords read out of an XMP packet', () => {
  const xmp = XMP_PLAIN.replace('</rdf:Description>',
    '<dc:subject><rdf:Bag><rdf:li>alpine</rdf:li><rdf:li>lake</rdf:li></rdf:Bag></dc:subject></rdf:Description>');
  const jpeg = goldenJpeg(xmp);
  assert.equal(fieldOf(jpeg, 'Keywords'), 'alpine, lake');
});

test('buildExportXmp: authorship namespaces present, empty meta yields null', async () => {
  const { buildExportXmp, insertPngXmp, insertJpegXmp } = await import('../engine/src/image-meta.ts');
  const meta = {
    software: 'Lolly', source: 'https://lolly.tools', tool: 'Poster',
    author: 'Ana Kovac', contact: '', description: '', copyright: '© Ana', license: 'CC BY 4.0',
  };
  const xmp = buildExportXmp(meta)!;
  for (const bit of ['<photoshop:Credit>Ana Kovac</photoshop:Credit>', '<plus:LicensorName>Ana Kovac</plus:LicensorName>',
    'CC BY 4.0', '<dc:rights>', 'xmp:CreatorTool>Lolly<']) {
    assert.ok(xmp.includes(bit), `xmp carries ${bit}`);
  }
  assert.equal(buildExportXmp({ software: '', source: '', tool: '', author: '', contact: '', description: '' }), null);

  // The stamped packets read back through the independent reader.
  const png = insertPngXmp(tinyPng(), meta);
  pngWalk(png);
  assert.equal(fieldOf(png, 'Creator'), 'Ana Kovac');
  const jpeg = insertJpegXmp(tinyJpeg(), meta);
  assert.equal(fieldOf(jpeg, 'Creator'), 'Ana Kovac');
  assert.ok(extractXmpPacket(jpeg)?.includes('plus:Licensor'));
});

// ─── AVIF EXIF item write (closes the recorded Wave 2 follow-up) ─────────────

test('insertAvifExif: non-AVIF input and metadata-free meta pass through untouched', async () => {
  const { insertAvifExif } = await import('../engine/src/image-meta.ts');
  const png = tinyPng();
  const meta = {
    software: 'Lolly', source: 'https://lolly.tools', tool: 'Poster',
    author: 'Ana Kovac', contact: '', description: '', copyright: '',
  };
  assert.equal(insertAvifExif(png, meta), png);
  const jpeg = tinyJpeg();
  assert.equal(insertAvifExif(jpeg, meta), jpeg);
  const empty = { software: '', source: '', tool: '', author: '', contact: '', description: '' };
  assert.equal(insertAvifExif(png, empty), png);
});

test('insertAvifExif: the item lands, offsets rewritten, pixels survive (sharp-gated)', async (t) => {
  let sharp: typeof import('sharp')['default'];
  try { sharp = (await import('sharp')).default; } catch { t.skip('sharp unavailable on this platform'); return; }
  const { insertAvifExif } = await import('../engine/src/image-meta.ts');
  const plain = new Uint8Array(await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 200, g: 50, b: 25 } } }).avif().toBuffer());
  const meta = {
    software: 'Lolly', source: 'https://lolly.tools', tool: 'Poster',
    author: 'Ana Kovac', contact: '', description: 'A poster', copyright: '© Ana',
  };
  const stamped = insertAvifExif(plain, meta);
  assert.notEqual(stamped, plain, 'the stamp actually wrote');
  // Read back through the independent reader.
  const m = extractFileMetadata(stamped);
  assert.equal(m.format, 'AVIF');
  assert.equal(fieldOf(stamped, 'Artist'), 'Ana Kovac');
  assert.equal(fieldOf(stamped, 'Software'), 'Lolly');
  assert.equal(fieldOf(stamped, 'Copyright'), '© Ana');
  // The primary image survived the iloc offset rewrite: identical decoded pixels.
  const before = await sharp(Buffer.from(plain)).raw().toBuffer({ resolveWithObject: true });
  const after = await sharp(Buffer.from(stamped)).raw().toBuffer({ resolveWithObject: true });
  assert.equal(after.info.width, before.info.width);
  assert.equal(after.info.height, before.info.height);
  assert.deepEqual(Array.from(after.data), Array.from(before.data), 'pixels byte-identical');
  // A file already carrying an Exif item is never touched again.
  assert.equal(insertAvifExif(stamped, meta), stamped);
});

test('HEIC/AVIF read: a foreign writer\'s EXIF reads back (sharp-gated)', async (t) => {
  let sharp: typeof import('sharp')['default'];
  try { sharp = (await import('sharp')).default; } catch { t.skip('sharp unavailable on this platform'); return; }
  const buf = new Uint8Array(await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } } })
    .withExif({ IFD0: { Artist: 'Ana Kovac', ImageDescription: 'Boats' } }).avif().toBuffer());
  const m = extractFileMetadata(buf);
  assert.equal(m.format, 'AVIF');
  assert.equal(fieldOf(buf, 'Artist'), 'Ana Kovac');
  assert.equal(fieldOf(buf, 'Image description'), 'Boats');
});
