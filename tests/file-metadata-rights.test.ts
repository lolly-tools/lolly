// SPDX-License-Identifier: MPL-2.0
// Licence and rights statements, carrier by carrier: what extractFileMetadata
// reports for each, under which label and from which exact field. Every fixture
// is built here from bytes. A field is evidence of what the file states, so the
// assertions are on the literal value and the source, never on an interpretation.
// tests/tag-readers.test.ts covers ID3v2, Vorbis comments, Matroska and Office files.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractFileMetadata, type FileMetadata, type MetaField } from '../engine/src/file-metadata.ts';
import { verifyRights } from '../engine/src/verify-findings.ts';

type Part = Uint8Array | number[] | string;
const text = new TextEncoder();
function cat(...parts: Part[]): Uint8Array {
  const chunks = parts.map((p) => typeof p === 'string' ? text.encode(p) : p instanceof Uint8Array ? p : Uint8Array.from(p));
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
const u16be = (n: number): number[] => [(n >> 8) & 0xff, n & 0xff];
const u32be = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const u16le = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff];
const u32le = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

/** The one field with this label, as [value, source]; fails when there are none or several. */
function stated(meta: FileMetadata, label: string): [string, string | undefined] {
  const hits = meta.fields.filter((f) => f.label === label);
  assert.equal(hits.length, 1, `${meta.format}: expected one "${label}" field, got ${JSON.stringify(hits)}`);
  return [hits[0]!.value, hits[0]!.source];
}
/** The labels Verify's licence band keeps for these fields (verifyRights in engine/src/verify-findings.ts). */
const bandLabels = (meta: FileMetadata): string[] =>
  [...new Set(verifyRights({ found: false } as Parameters<typeof verifyRights>[0], meta).flatMap((r) => r.evidence.map((e) => e.label)))].sort();
const bounded = (fields: MetaField[]): void => {
  assert.ok(fields.length <= 64, `field cap: ${fields.length}`);
  for (const f of fields) {
    assert.ok(f.value.length <= 2049, `value cap on ${f.label}: ${f.value.length}`);
    if (f.group === 'authorship') assert.doesNotMatch(f.value, /\p{Cc}/u, `control character in ${f.label}`);
  }
};

// ── XMP, in every container that carries a packet ────────────────────────────

const XMP = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
  + '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/"'
  + ' xmlns:cc="http://creativecommons.org/ns#" xmlns:plus="http://ns.useplus.org/ldf/xmp/1.0/"'
  + ' xmpRights:Marked="True" xmpRights:WebStatement="https://example.org/terms">'
  + '<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">(c) 2026 Example Studio</rdf:li></rdf:Alt></dc:rights>'
  + '<xmpRights:UsageTerms><rdf:Alt><rdf:li xml:lang="x-default">Editorial use only</rdf:li></rdf:Alt></xmpRights:UsageTerms>'
  + '<cc:license rdf:resource="https://creativecommons.org/licenses/by/4.0/"/>'
  + '<cc:attributionName>Example Studio</cc:attributionName>'
  + '<cc:attributionURL rdf:resource="https://example.org/work"/>'
  + '<plus:Licensor><rdf:Seq><rdf:li rdf:parseType="Resource"><plus:LicensorURL>https://example.org/licensing</plus:LicensorURL></rdf:li></rdf:Seq></plus:Licensor>'
  + '</rdf:Description></rdf:RDF></x:xmpmeta>';

const riff = (form: string, ...chunks: Part[]): Uint8Array => {
  const body = cat(form, ...chunks);
  return cat('RIFF', u32le(body.length), body);
};
const riffChunk = (id: string, data: Part): Uint8Array => {
  const d = cat(data);
  return cat(id, u32le(d.length), d, d.length & 1 ? [0] : []);
};
const pngChunk = (type: string, data: Part): Uint8Array => { const d = cat(data); return cat(u32be(d.length), type, d, [0, 0, 0, 0]); };
const box = (type: Part, ...parts: Part[]): Uint8Array => { const body = cat(...parts); return cat(u32be(8 + body.length), type, body); };
const XMP_UUID = [0xbe, 0x7a, 0xcf, 0xcb, 0x97, 0xa9, 0x42, 0xe8, 0x9c, 0x71, 0x99, 0x94, 0x91, 0xe3, 0xaf, 0xac];
const ftyp = (brand: string): Uint8Array => box('ftyp', brand, [0, 0, 0, 0], brand);

/** A little-endian TIFF whose only IFD holds these tags; ASCII values and byte blobs sit after the IFD. */
function tiff(tags: [tag: number, type: number, value: Uint8Array][]): Uint8Array {
  const dataAt = 8 + 2 + tags.length * 12 + 4;
  const entries: number[] = [];
  const blobs: Uint8Array[] = [];
  let at = dataAt;
  for (const [tag, type, value] of tags) {
    entries.push(...u16le(tag), ...u16le(type), ...u32le(value.length), ...u32le(at));
    blobs.push(value);
    at += value.length;
  }
  return cat([0x49, 0x49, 0x2a, 0x00], u32le(8), u16le(tags.length), entries, u32le(0), ...blobs);
}
const jpeg = (...segments: Uint8Array[]): Uint8Array => cat([0xff, 0xd8], ...segments, [0xff, 0xd9]);
const jpegSegment = (marker: number, ...parts: Part[]): Uint8Array => { const d = cat(...parts); return cat([0xff, marker], u16be(d.length + 2), d); };

const XMP_CARRIERS: Record<string, Uint8Array> = {
  JPEG: jpeg(jpegSegment(0xe1, 'http://ns.adobe.com/xap/1.0/\0', XMP)),
  PNG: cat([137, 80, 78, 71, 13, 10, 26, 10], pngChunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0]), pngChunk('iTXt', cat('XML:com.adobe.xmp\0\0\0\0\0', XMP)), pngChunk('IEND', [])),
  WebP: riff('WEBP', riffChunk('XMP ', XMP)),
  TIFF: tiff([[0x02bc, 1, text.encode(XMP)]]),
  SVG: text.encode(`<svg xmlns="http://www.w3.org/2000/svg"><metadata>${XMP}</metadata></svg>`),
  WAV: riff('WAVE', riffChunk('fmt ', new Uint8Array(16)), riffChunk('_PMX', XMP)),
  MP4: cat(ftyp('isom'), box('uuid', XMP_UUID, XMP)),
};

for (const [format, bytes] of Object.entries(XMP_CARRIERS)) {
  test(`rights carriers: XMP in ${format} states its rights fields with exact sources`, () => {
    const meta = extractFileMetadata(bytes);
    assert.equal(meta.format, format);
    assert.deepEqual(stated(meta, 'Rights'), ['(c) 2026 Example Studio', 'XMP/RDF dc:rights']);
    assert.deepEqual(stated(meta, 'Usage terms'), ['Editorial use only', 'XMP/RDF xmpRights:UsageTerms']);
    assert.deepEqual(stated(meta, 'Rights statement'), ['https://example.org/terms', 'XMP/RDF xmpRights:WebStatement']);
    assert.deepEqual(stated(meta, 'Licence'), ['https://creativecommons.org/licenses/by/4.0/', 'XMP/RDF cc:license']);
    assert.deepEqual(stated(meta, 'Attribution name'), ['Example Studio', 'XMP/RDF cc:attributionName']);
    assert.deepEqual(stated(meta, 'Attribution URL'), ['https://example.org/work', 'XMP/RDF cc:attributionURL']);
    // A flag and a contact address are not licence statements: own labels, outside the band.
    assert.deepEqual(stated(meta, 'Rights marked'), ['True', 'XMP/RDF xmpRights:Marked']);
    assert.deepEqual(stated(meta, 'Licensor URL'), ['https://example.org/licensing', 'XMP/RDF plus:LicensorURL']);
    assert.deepEqual(bandLabels(meta), ['Licence', 'Rights', 'Rights statement', 'Usage terms']);
    bounded(meta.fields);
  });
}

test('rights carriers: a hostile XMP packet stays bounded and loses its markup', () => {
  const packet = '<x:xmpmeta xmlns:x="adobe:ns:meta/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xmpRights="http://ns.adobe.com/xap/1.0/rights/">'
    + `<dc:rights>All \u0001rights\u0007 <script>alert(1)</script> ${'x'.repeat(5000)}</dc:rights>`
    + '<xmpRights:Marked>'; // never closed
  const meta = extractFileMetadata(jpeg(jpegSegment(0xe1, 'http://ns.adobe.com/xap/1.0/\0', packet)));
  const [value] = stated(meta, 'Rights');
  assert.match(value, /^All rights alert\(1\) x+/);
  assert.doesNotMatch(value, /[<>]/);
  assert.equal(meta.fields.some((f) => f.label === 'Rights marked'), false);
  bounded(meta.fields);
});

// ── EXIF and IPTC ────────────────────────────────────────────────────────────

test('rights carriers: EXIF Copyright and Artist carry their tag as the source', () => {
  const exif = tiff([[0x013b, 2, text.encode('Ada Example\0')], [0x8298, 2, text.encode('(c) Ada Example\0')]]);
  const meta = extractFileMetadata(jpeg(jpegSegment(0xe1, 'Exif\0\0', exif)));
  assert.deepEqual(stated(meta, 'Copyright'), ['(c) Ada Example', 'EXIF Copyright']);
  assert.deepEqual(stated(meta, 'Artist'), ['Ada Example', 'EXIF Artist']);
  // The same tags in a bare TIFF.
  assert.deepEqual(stated(extractFileMetadata(exif), 'Copyright'), ['(c) Ada Example', 'EXIF Copyright']);
});

const iptcRecord = (dataset: number, value: string): number[] => { const v = [...text.encode(value)]; return [0x1c, 2, dataset, ...u16be(v.length), ...v]; };
const iptcSegment = (...records: number[][]): Uint8Array => {
  const data = records.flat();
  return jpegSegment(0xed, 'Photoshop 3.0\0', '8BIM', [0x04, 0x04, 0, 0], u32be(data.length), data, data.length & 1 ? [0] : []);
};

test('rights carriers: IPTC copyright notice, credit line and by-line carry their dataset', () => {
  const meta = extractFileMetadata(jpeg(iptcSegment(iptcRecord(116, '(c) Example Agency'), iptcRecord(110, 'Example Agency / Ada'), iptcRecord(80, 'Ada Example'))));
  assert.deepEqual(stated(meta, 'Copyright'), ['(c) Example Agency', 'IPTC 2:116 Copyright Notice']);
  assert.deepEqual(stated(meta, 'Credit'), ['Example Agency / Ada', 'IPTC 2:110 Credit']);
  assert.deepEqual(stated(meta, 'By-line'), ['Ada Example', 'IPTC 2:80 By-line']);
});

test('rights carriers: hostile EXIF and IPTC values stay bounded and lose control characters', () => {
  const long = `(c)\u0001\u0002 <b>Ada</b>\n${'y'.repeat(9000)}`;
  const exif = tiff([[0x8298, 2, text.encode(long)]]);
  // An ASCII tag that claims the whole file and more.
  const lying = tiff([[0x8298, 2, text.encode('short\0')]]);
  lying.set(u32le(0x7fffffff), 8 + 2 + 4);
  // An IPTC record whose length runs past its resource block.
  const cut = iptcSegment(iptcRecord(116, 'kept'), [0x1c, 2, 116, 0x7f, 0xff, 65, 66]);
  for (const bytes of [jpeg(jpegSegment(0xe1, 'Exif\0\0', exif)), lying, jpeg(cut), jpeg(iptcSegment(iptcRecord(116, long)))]) {
    const meta = extractFileMetadata(bytes);
    bounded(meta.fields);
    for (const f of meta.fields.filter((x) => x.label === 'Copyright')) assert.match(f.value, /^(?:\(c\) <b>Ada<\/b> y+…?|short|kept)$/);
  }
});

// ── SVG ──────────────────────────────────────────────────────────────────────

test('rights carriers: an SVG cc:Work states its licence and rights holder', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    + '<metadata><rdf:RDF><cc:Work rdf:about=""><dc:rights><cc:Agent><dc:title>Example Studio</dc:title></cc:Agent></dc:rights>'
    + '<cc:license rdf:resource="http://creativecommons.org/licenses/by-sa/4.0/"/></cc:Work>'
    + '<cc:License rdf:about="http://creativecommons.org/licenses/by-sa/4.0/"><cc:permits rdf:resource="http://creativecommons.org/ns#Reproduction"/></cc:License>'
    + '</rdf:RDF></metadata><rect width="1" height="1"/></svg>';
  const meta = extractFileMetadata(text.encode(svg));
  assert.equal(meta.format, 'SVG');
  // The URL is recorded as stated; the cc:License description block is not a second statement.
  assert.deepEqual(stated(meta, 'Licence'), ['http://creativecommons.org/licenses/by-sa/4.0/', 'XMP/RDF cc:license']);
  assert.deepEqual(stated(meta, 'Rights'), ['Example Studio', 'XMP/RDF dc:rights']);
});

test('rights carriers: the older Creative Commons namespace in an SVG still reads', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:cc="http://web.resource.org/cc/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    + '<metadata><rdf:RDF><cc:Work rdf:about=""><cc:license rdf:resource="http://creativecommons.org/licenses/by/2.5/"/></cc:Work></rdf:RDF></metadata></svg>';
  assert.deepEqual(stated(extractFileMetadata(text.encode(svg)), 'Licence'), ['http://creativecommons.org/licenses/by/2.5/', 'XMP/RDF cc:license']);
});

// ── MP4 and QuickTime ────────────────────────────────────────────────────────

const hdlr = (kind: string): Uint8Array => box('hdlr', new Uint8Array(8), kind, new Uint8Array(13));
const ilstText = (tag: Part, value: string): Uint8Array => cat(u32be(8 + 16 + text.encode(value).length), tag, box('data', [0, 0, 0, 1, 0, 0, 0, 0], value));
const COPY = [0xa9];

test('rights carriers: MP4 iTunes cprt, the ISO udta cprt box and the QuickTime copyright atoms', () => {
  const itunes = extractFileMetadata(cat(ftyp('M4A '), box('moov', box('udta', box('meta', [0, 0, 0, 0], hdlr('mdir'), box('ilst',
    ilstText('cprt', '2026 Example Records'), ilstText(cat(COPY, 'ART'), 'Ada Example')))))));
  assert.equal(itunes.format, 'MP4');
  assert.deepEqual(stated(itunes, 'Copyright'), ['2026 Example Records', 'MP4 ilst cprt']);
  assert.deepEqual(stated(itunes, 'Artist'), ['Ada Example', 'MP4 ilst ©ART']);

  const iso = extractFileMetadata(cat(ftyp('isom'), box('moov', box('udta', box('cprt', [0, 0, 0, 0], [0x15, 0xc7], '(c) Example Films\0')))));
  assert.deepEqual(stated(iso, 'Copyright'), ['(c) Example Films', 'MP4 udta cprt']);

  const qt = extractFileMetadata(cat(ftyp('qt  '), box('moov', box('udta', box(cat(COPY, 'cpy'), u16be(17), [0, 0], '(c) Example Films')))));
  assert.equal(qt.format, 'QuickTime');
  assert.deepEqual(stated(qt, 'Copyright'), ['(c) Example Films', 'QuickTime udta ©cpy']);

  const key = 'com.apple.quicktime.copyright';
  const mdta = extractFileMetadata(cat(ftyp('qt  '), box('moov', box('meta', hdlr('mdta'),
    box('keys', [0, 0, 0, 0], u32be(1), u32be(8 + key.length), 'mdta', key),
    box('ilst', cat(u32be(8 + 16 + 9), u32be(1), box('data', [0, 0, 0, 1, 0, 0, 0, 0], '(c) Apple')))))));
  assert.deepEqual(stated(mdta, 'Copyright'), ['(c) Apple', `QuickTime mdta ${key}`]);
});

test('rights carriers: hostile MP4 copyright boxes neither throw nor escape their bounds', () => {
  const long = `(c)\u0001 <b>x</b> ${'w'.repeat(9000)}`;
  const cases: Uint8Array[] = [
    cat(ftyp('isom'), box('moov', box('udta', box('cprt', [0, 0, 0, 0], [0x15, 0xc7], long)))),
    // Too short to hold its version, flags and language.
    cat(ftyp('isom'), box('moov', box('udta', box('cprt', [0, 0, 0])))),
    // A QuickTime text atom whose length field claims more than the atom holds.
    cat(ftyp('qt  '), box('moov', box('udta', box(cat(COPY, 'cpy'), u16be(0xffff), [0, 0], 'short')))),
    // A udta whose child claims four gigabytes.
    cat(ftyp('isom'), box('moov', box('udta', cat(u32be(0xfffffff0), 'cprt', [0, 0, 0, 0])))),
    cat(ftyp('M4A '), box('moov', box('udta', box('meta', [0, 0, 0, 0], hdlr('mdir'), box('ilst', ilstText('cprt', long)))))),
  ];
  for (const bytes of cases) bounded(extractFileMetadata(bytes).fields);
  assert.match(stated(extractFileMetadata(cases[0]!), 'Copyright')[0], /^\(c\) <b>x<\/b> w{100,}…$/);
  assert.deepEqual(stated(extractFileMetadata(cases[2]!), 'Copyright'), ['short', 'QuickTime udta ©cpy']);
});

// ── WAV ──────────────────────────────────────────────────────────────────────

test('rights carriers: WAV INFO ICOP and IART', () => {
  const info = riffChunk('LIST', cat('INFO', riffChunk('ICOP', '2026 Example Records\0'), riffChunk('IART', 'Ada Example\0')));
  const meta = extractFileMetadata(riff('WAVE', riffChunk('fmt ', new Uint8Array(16)), info));
  assert.deepEqual(stated(meta, 'Copyright'), ['2026 Example Records', 'WAV INFO ICOP']);
  assert.deepEqual(stated(meta, 'Artist'), ['Ada Example', 'WAV INFO IART']);
});
