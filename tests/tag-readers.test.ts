// SPDX-License-Identifier: MPL-2.0
// The tag carriers of tag-readers.ts, read through extractFileMetadata: ID3v2,
// Vorbis comments, Matroska tags and Office property parts. Every fixture is built
// here from bytes; each carrier has a hostile case showing the bounds hold.
// tests/file-metadata-rights.test.ts covers XMP, EXIF, IPTC, SVG, MP4 and WAV.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractFileMetadata, type FileMetadata, type MetaField } from '../engine/src/file-metadata.ts';
import { storeZip } from '../engine/src/zip.ts';
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
const u24be = (n: number): number[] => [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const u32be = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const u16le = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff];
const u32le = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];

/** The one field with this label, as [value, source]; fails when there are none or several. */
function stated(meta: FileMetadata, label: string): [string, string | undefined] {
  const hits = meta.fields.filter((f) => f.label === label);
  assert.equal(hits.length, 1, `${meta.format}: expected one "${label}" field, got ${JSON.stringify(hits)}`);
  return [hits[0]!.value, hits[0]!.source];
}
const bounded = (fields: MetaField[]): void => {
  assert.ok(fields.length <= 64, `field cap: ${fields.length}`);
  for (const f of fields) {
    assert.ok(f.value.length <= 2049, `value cap on ${f.label}: ${f.value.length}`);
    if (f.group === 'authorship') assert.doesNotMatch(f.value, /\p{Cc}/u, `control character in ${f.label}`);
  }
};

// ── ID3v2 ────────────────────────────────────────────────────────────────────

const syncsafe = (n: number): number[] => [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
const MPEG_FRAME = cat([0xff, 0xfb, 0x90, 0x00], new Uint8Array(413));
const id3Frame = (version: 3 | 4, id: string, ...data: Part[]): Uint8Array => { const d = cat(...data); return cat(id, version === 4 ? syncsafe(d.length) : u32be(d.length), [0, 0], d); };
const id3 = (version: 2 | 3 | 4, ...frames: Uint8Array[]): Uint8Array => { const body = cat(...frames); return cat('ID3', [version, 0, 0], syncsafe(body.length), body, MPEG_FRAME); };

test('rights carriers: ID3v2.3 TCOP, WCOP, USER and TPE1', () => {
  const meta = extractFileMetadata(id3(3,
    id3Frame(3, 'TPE1', [0], 'Ada Example'),
    id3Frame(3, 'TCOP', [0], '2026 Example Records'),
    id3Frame(3, 'WCOP', 'https://creativecommons.org/licenses/by/4.0/'),
    id3Frame(3, 'USER', [0], 'eng', 'Free to share with credit'),
  ));
  assert.equal(meta.format, 'MP3');
  assert.deepEqual(stated(meta, 'Copyright'), ['2026 Example Records', 'ID3 TCOP']);
  assert.deepEqual(stated(meta, 'Rights statement'), ['https://creativecommons.org/licenses/by/4.0/', 'ID3 WCOP']);
  assert.deepEqual(stated(meta, 'Usage terms'), ['Free to share with credit', 'ID3 USER']);
  assert.deepEqual(stated(meta, 'Artist'), ['Ada Example', 'ID3 TPE1']);
  assert.equal(meta.fields.find((f) => f.label === 'Artist')?.sensitive, true);
});

test('rights carriers: ID3v2.4 UTF-8 and UTF-16 text, and the ID3v2.2 three-letter frames', () => {
  const utf16 = (s: string): number[] => [0xff, 0xfe, ...[...s].flatMap((ch) => u16le(ch.charCodeAt(0)))];
  const v4 = extractFileMetadata(id3(4, id3Frame(4, 'TCOP', [3], '2026 Éxample'), id3Frame(4, 'USER', [1], 'eng', utf16('Ask first'))));
  assert.deepEqual(stated(v4, 'Copyright'), ['2026 Éxample', 'ID3 TCOP']);
  assert.deepEqual(stated(v4, 'Usage terms'), ['Ask first', 'ID3 USER']);
  const tcr = cat('TCR', u24be(9), [0], '2001 Old');
  const wcp = cat('WCP', u24be(19), 'https://example.org');
  const v2 = extractFileMetadata(id3(2, tcr, wcp));
  assert.deepEqual(stated(v2, 'Copyright'), ['2001 Old', 'ID3 TCR']);
  assert.deepEqual(stated(v2, 'Rights statement'), ['https://example.org', 'ID3 WCP']);
});

test('rights carriers: hostile ID3 tags neither throw nor escape their bounds', () => {
  const good = id3Frame(3, 'TCOP', [0], 'kept');
  const cases: Uint8Array[] = [
    // The tag claims 256 MB; the file ends after one frame.
    cat('ID3', [3, 0, 0], [0x7f, 0x7f, 0x7f, 0x7f], good),
    // A frame whose size runs far past the tag.
    id3(3, good, cat('TCOP', u32be(0x7fffffff), [0, 0], [0], 'lost')),
    // Control characters, markup and an oversized value.
    id3(3, id3Frame(3, 'TCOP', [0], `a\u0000b\u0001 <img src=x onerror=1>\r\n${'z'.repeat(9000)}`)),
    // More frames than any field cap.
    id3(3, ...Array.from({ length: 3000 }, (_, i) => id3Frame(3, 'TCOP', [0], `c${i}`))),
    // A size byte with the high bit set is not a tag; a truncated header is nothing.
    cat('ID3', [3, 0, 0], [0xff, 0, 0, 1], good),
    cat('ID3', [3, 0]),
    // An extended header that claims more than the tag holds.
    cat('ID3', [3, 0, 0x40], syncsafe(8), u32be(0xfffffff0), [0, 0, 0, 0]),
  ];
  for (const bytes of cases) {
    const meta = extractFileMetadata(bytes);
    bounded(meta.fields);
  }
  assert.deepEqual(stated(extractFileMetadata(cases[0]!), 'Copyright'), ['kept', 'ID3 TCOP']);
  assert.deepEqual(stated(extractFileMetadata(cases[1]!), 'Copyright'), ['kept', 'ID3 TCOP']);
  const values = extractFileMetadata(cases[2]!).fields.filter((f) => f.label === 'Copyright').map((f) => f.value);
  assert.equal(values[0], 'a');
  assert.match(values[1]!, /^b <img src=x onerror=1> z{100,}…$/);
});

// ── Vorbis comments: FLAC, Ogg Opus, Ogg Vorbis ──────────────────────────────

const vorbisList = (...comments: string[]): Uint8Array =>
  cat(u32le(4), 'test', u32le(comments.length), ...comments.map((c) => { const b = text.encode(c); return cat(u32le(b.length), b); }));
const COMMENTS = vorbisList('TITLE=Song', 'artist=Ada Example', 'COPYRIGHT=2026 Example Records', 'LICENSE=https://creativecommons.org/licenses/by/4.0/');
const flac = (list: Uint8Array): Uint8Array => cat('fLaC', [0], u24be(34), new Uint8Array(34), [0x84], u24be(list.length), list);
function oggPage(serial: number, seq: number, body: Uint8Array, htype = 0): Uint8Array {
  const lacing: number[] = [];
  for (let n = body.length; ; n -= 255) { if (n >= 255) lacing.push(255); else { lacing.push(n); break; } }
  return cat('OggS', [0, htype], new Uint8Array(8), u32le(serial), u32le(seq), [0, 0, 0, 0], [lacing.length], lacing, body);
}
const opus = (list: Uint8Array): Uint8Array => cat(oggPage(7, 0, cat('OpusHead', new Uint8Array(11)), 2), oggPage(7, 1, cat('OpusTags', list)), oggPage(7, 2, new Uint8Array(40)));
const vorbis = (list: Uint8Array): Uint8Array => cat(oggPage(9, 0, cat([1], 'vorbis', new Uint8Array(23)), 2), oggPage(9, 1, cat([3], 'vorbis', list, [1], [5], 'vorbis', new Uint8Array(20))));

for (const [format, bytes] of [['FLAC', flac(COMMENTS)], ['Ogg', opus(COMMENTS)], ['Ogg Vorbis', vorbis(COMMENTS)], ['FLAC', cat('ID3', [3, 0, 0], syncsafe(0), flac(COMMENTS))]] as const) {
  test(`rights carriers: Vorbis comments LICENSE and COPYRIGHT in ${format} (${bytes.length} bytes)`, () => {
    const meta = extractFileMetadata(bytes);
    assert.equal(meta.format, format);
    assert.deepEqual(stated(meta, 'Licence'), ['https://creativecommons.org/licenses/by/4.0/', 'Vorbis LICENSE']);
    assert.deepEqual(stated(meta, 'Copyright'), ['2026 Example Records', 'Vorbis COPYRIGHT']);
    assert.deepEqual(stated(meta, 'Artist'), ['Ada Example', 'Vorbis ARTIST']);
  });
}

test('rights carriers: a comment packet that spans Ogg pages still reads', () => {
  const list = vorbisList(`COMMENT=${'p'.repeat(70000)}`, 'LICENSE=CC-BY-4.0');
  const packet = cat('OpusTags', list);
  const first = packet.subarray(0, 255 * 255); // every lacing value 255: the packet continues
  const page1 = cat('OggS', [0, 0], new Uint8Array(8), u32le(7), u32le(1), [0, 0, 0, 0], [255], new Array(255).fill(255), first);
  const bytes = cat(oggPage(7, 0, cat('OpusHead', new Uint8Array(11)), 2), page1, oggPage(7, 2, packet.subarray(255 * 255), 1));
  assert.deepEqual(stated(extractFileMetadata(bytes), 'Licence'), ['CC-BY-4.0', 'Vorbis LICENSE']);
});

test('rights carriers: hostile Vorbis comment blocks neither throw nor escape their bounds', () => {
  const cases: Uint8Array[] = [
    // A comment count of four billion with one real comment.
    flac(cat(u32le(0), u32le(0xffffffff), u32le(12), 'LICENSE=kept')),
    // A comment length past the block, and a vendor length past the block.
    flac(cat(u32le(0), u32le(2), u32le(12), 'LICENSE=kept', u32le(0xfffffff0), 'COPYRIGHT=lost')),
    flac(cat(u32le(0xffffffff), u32le(1))),
    // A block length past the file, then a truncated block header.
    cat('fLaC', [0x04], u24be(0xffffff), u32le(0), u32le(1), u32le(12), 'LICENSE=kept'),
    cat('fLaC', [0x04, 0xff]),
    // Control characters, markup, an oversized value and a key with no value.
    flac(vorbisList(`LICENSE=a\u0000\u0007<a href="javascript:1">b</a>${'q'.repeat(9000)}`, 'COPYRIGHT', '=nokey')),
    // An Ogg page whose segment table and body run past the file.
    opus(COMMENTS).subarray(0, 60),
    cat(oggPage(7, 0, cat('OpusHead', new Uint8Array(11)), 2), 'OggS', [0, 0], new Uint8Array(20), [255], [255, 255]),
    cat('OggS'),
  ];
  for (const bytes of cases) bounded(extractFileMetadata(bytes).fields);
  for (const i of [0, 1, 3]) assert.deepEqual(stated(extractFileMetadata(cases[i]!), 'Licence'), ['kept', 'Vorbis LICENSE']);
  const [value] = stated(extractFileMetadata(cases[5]!), 'Licence');
  assert.match(value, /^a <a href="javascript:1">b<\/a>q{100,}…$/);
  assert.equal(extractFileMetadata(cases[5]!).fields.some((f) => f.label === 'Copyright'), false);
});

// ── Matroska and WebM ────────────────────────────────────────────────────────

const el = (id: number[], ...parts: Part[]): Uint8Array => {
  const body = cat(...parts);
  return cat(id, body.length < 127 ? [0x80 | body.length] : [0x10 | (body.length >>> 24), (body.length >> 16) & 0xff, (body.length >> 8) & 0xff, body.length & 0xff], body);
};
const EBML = [0x1a, 0x45, 0xdf, 0xa3], DOCTYPE = [0x42, 0x82], SEGMENT = [0x18, 0x53, 0x80, 0x67], TAGS = [0x12, 0x54, 0xc3, 0x67];
const TAG = [0x73, 0x73], TARGETS = [0x63, 0xc0], SIMPLE = [0x67, 0xc8], NAME = [0x45, 0xa3], STRING = [0x44, 0x87], CLUSTER = [0x1f, 0x43, 0xb6, 0x75];
const simpleTag = (name: string, value: string): Uint8Array => el(SIMPLE, el(NAME, name), el(STRING, value));
const matroska = (docType: string, ...segment: Uint8Array[]): Uint8Array => cat(el(EBML, el(DOCTYPE, docType)), el(SEGMENT, ...segment));

test('rights carriers: Matroska tags COPYRIGHT, LICENSE, TERMS_OF_USE and ARTIST, after the clusters', () => {
  const tags = el(TAGS, el(TAG, el(TARGETS), simpleTag('TITLE', 'Film'), simpleTag('COPYRIGHT', '(c) Example Films'),
    simpleTag('LICENSE', 'https://creativecommons.org/licenses/by-nc/4.0/'), simpleTag('TERMS_OF_USE', 'Festival screenings only'), simpleTag('ARTIST', 'Ada Example')));
  const mkv = extractFileMetadata(matroska('matroska', el(CLUSTER, new Uint8Array(300)), el(CLUSTER, new Uint8Array(20)), tags));
  assert.equal(mkv.format, 'Matroska');
  assert.deepEqual(stated(mkv, 'Copyright'), ['(c) Example Films', 'Matroska COPYRIGHT']);
  assert.deepEqual(stated(mkv, 'Licence'), ['https://creativecommons.org/licenses/by-nc/4.0/', 'Matroska LICENSE']);
  assert.deepEqual(stated(mkv, 'Usage terms'), ['Festival screenings only', 'Matroska TERMS_OF_USE']);
  assert.deepEqual(stated(mkv, 'Artist'), ['Ada Example', 'Matroska ARTIST']);
  assert.equal(extractFileMetadata(matroska('webm', tags)).format, 'WebM');
});

test('rights carriers: hostile Matroska structure neither throws nor escapes its bounds', () => {
  const kept = el(TAGS, el(TAG, simpleTag('LICENSE', 'kept')));
  const cases: Uint8Array[] = [
    // A Segment of unknown size, and one that claims more than the file holds.
    cat(el(EBML, el(DOCTYPE, 'webm')), SEGMENT, [0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], kept),
    cat(el(EBML, el(DOCTYPE, 'webm')), SEGMENT, [0x01, 0, 0, 0, 0x7f, 0xff, 0xff, 0xff], kept),
    // A cluster of unknown size ends the walk; a tag string that claims a terabyte is dropped.
    matroska('webm', cat(CLUSTER, [0xff], new Uint8Array(10)), kept),
    matroska('webm', el(TAGS, el(TAG, el(SIMPLE, el(NAME, 'LICENSE'), cat(STRING, [0x01, 0, 0, 0xff, 0xff, 0xff, 0xff, 0xff], 'lost'))))),
    // Control characters, markup and an oversized value; a zero id byte; a bare header.
    matroska('webm', el(TAGS, el(TAG, simpleTag('COPYRIGHT', `a\u0001\u001b[31m<i>b</i>${'k'.repeat(9000)}`)))),
    matroska('webm', cat([0, 0, 0, 0]), kept),
    cat(EBML),
    // Deep nesting of SimpleTag inside SimpleTag.
    matroska('webm', el(TAGS, el(TAG, Array.from({ length: 200 }).reduce<Uint8Array>((inner) => el(SIMPLE, el(NAME, 'LICENSE'), inner), el(STRING, 'deep'))))),
  ];
  for (const bytes of cases) bounded(extractFileMetadata(bytes).fields);
  for (const i of [0, 1]) assert.deepEqual(stated(extractFileMetadata(cases[i]!), 'Licence'), ['kept', 'Matroska LICENSE']);
  for (const i of [2, 3, 5]) assert.equal(extractFileMetadata(cases[i]!).fields.some((f) => f.label === 'Licence'), false);
  assert.match(stated(extractFileMetadata(cases[4]!), 'Copyright')[0], /^a \[31m<i>b<\/i>k{100,}…$/);
});

// ── Office packages ──────────────────────────────────────────────────────────

const CORE_XML = '<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"'
  + ' xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>Ada Example</dc:creator><dc:rights>(c) 2026 Example Ltd</dc:rights><dc:title>Report</dc:title></cp:coreProperties>';
const customXml = (...props: [name: string, value: string][]): string => '<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties"'
  + ' xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
  + props.map(([name, value], i) => `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${i + 2}" name="${name}"><vt:lpwstr>${value}</vt:lpwstr></property>`).join('') + '</Properties>';
const office = (main: string, core: string, custom: string): Uint8Array => storeZip([
  { name: '[Content_Types].xml', bytes: text.encode('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>') },
  { name: main, bytes: text.encode('<x/>') },
  { name: 'docProps/core.xml', bytes: text.encode(core) },
  { name: 'docProps/custom.xml', bytes: text.encode(custom) },
]);

for (const [format, main] of [['DOCX', 'word/document.xml'], ['PPTX', 'ppt/presentation.xml']] as const) {
  test(`rights carriers: ${format} core rights and custom licence and copyright properties`, () => {
    const meta = extractFileMetadata(office(main, CORE_XML, customXml(['License', 'CC BY 4.0'], ['Copyright', '2026 Example Ltd'], ['Department', 'Brand'])));
    assert.equal(meta.format, format);
    assert.deepEqual(stated(meta, 'Rights'), ['(c) 2026 Example Ltd', `${format} core.xml dc:rights`]);
    assert.deepEqual(stated(meta, 'Author'), ['Ada Example', `${format} core.xml dc:creator`]);
    assert.deepEqual(stated(meta, 'Licence'), ['CC BY 4.0', `${format} custom.xml License`]);
    assert.deepEqual(stated(meta, 'Copyright'), ['2026 Example Ltd', `${format} custom.xml Copyright`]);
    assert.equal(meta.fields.some((f) => f.value === 'Brand'), false);
  });
}

test('rights carriers: hostile Office packages neither throw nor escape their bounds', () => {
  const many = customXml(...Array.from({ length: 400 }, (_, i): [string, string] => ['Licence', `terms ${i}`]));
  const cases: Uint8Array[] = [
    // Malformed XML, a DTD, a property part over the size limit, and four hundred licence properties.
    office('word/document.xml', '<cp:coreProperties><dc:rights>unbound', customXml(['Copyright', 'kept'])),
    office('word/document.xml', `<!DOCTYPE x [<!ENTITY a "aaaa">]>${CORE_XML}`, '<Properties'),
    office('word/document.xml', `${CORE_XML}<!--${'c'.repeat(3 * 1024 * 1024)}-->`, customXml(['Copyright', 'kept'])),
    office('word/document.xml', CORE_XML, many),
    // Control characters by reference, markup as text and an oversized value.
    office('ppt/presentation.xml', CORE_XML, customXml(['Copyright', `a&#9;&lt;b&gt;x&lt;/b&gt; ${'m'.repeat(9000)}`])),
    // A package cut short, and a ZIP that is not an Office file.
    office('word/document.xml', CORE_XML, customXml(['Copyright', 'cut'])).subarray(0, 200),
    storeZip([{ name: 'docProps/core.xml', bytes: text.encode(CORE_XML) }]),
  ];
  for (const bytes of cases) bounded(extractFileMetadata(bytes).fields);
  for (const i of [0, 2]) assert.deepEqual(stated(extractFileMetadata(cases[i]!), 'Copyright'), ['kept', 'DOCX custom.xml Copyright']);
  assert.match(stated(extractFileMetadata(cases[4]!), 'Copyright')[0], /^a <b>x<\/b> m{100,}…$/);
  for (const i of [5, 6]) assert.deepEqual(extractFileMetadata(cases[i]!), { format: '', fields: [] });
});

// ── The licence band ─────────────────────────────────────────────────────────

test("rights carriers: Verify's licence band keeps each statement with its source, and nothing else", () => {
  const band = (bytes: Uint8Array): string[] =>
    verifyRights({ found: false } as Parameters<typeof verifyRights>[0], extractFileMetadata(bytes)).flatMap((r) => r.evidence.map((e) => `${e.label} | ${e.source} | ${e.value}`)).sort();
  assert.deepEqual(band(id3(3, id3Frame(3, 'TPE1', [0], 'Ada'), id3Frame(3, 'TCOP', [0], '2026 Ada'), id3Frame(3, 'WCOP', 'https://creativecommons.org/licenses/by/4.0/'))), [
    'Copyright | ID3 TCOP | 2026 Ada',
    'Rights statement | ID3 WCOP | https://creativecommons.org/licenses/by/4.0/',
  ]);
  assert.deepEqual(band(flac(COMMENTS)), [
    'Copyright | Vorbis COPYRIGHT | 2026 Example Records',
    'Licence | Vorbis LICENSE | https://creativecommons.org/licenses/by/4.0/',
  ]);
  assert.deepEqual(band(matroska('webm', el(TAGS, el(TAG, simpleTag('TERMS_OF_USE', 'Ask first'), simpleTag('ARTIST', 'Ada'))))), ['Usage terms | Matroska TERMS_OF_USE | Ask first']);
  assert.deepEqual(band(office('word/document.xml', CORE_XML, customXml(['License', 'CC BY 4.0']))), [
    'Licence | DOCX custom.xml License | CC BY 4.0',
    'Rights | DOCX core.xml dc:rights | (c) 2026 Example Ltd',
  ]);
});
