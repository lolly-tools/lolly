// SPDX-License-Identifier: MPL-2.0
/**
 * c2pa-containers.ts contract tests: the per-format byte-splicing PLACEMENT
 * side of the C2PA writer (png/jpeg/gif/svg/tiff/webp/mp4/webm placers, the
 * classic-xref PDF incremental update, and the format dispatch table).
 * Run with: node --test tests/c2pa-containers.test.ts
 *
 * This module was split out of c2pa.ts so the container byte grammar is
 * reviewable apart from the manifest/claim builder, but its coverage stayed with
 * the parent suites (tests/c2pa.test.ts, tests/c2pa-formats.test.ts) - nothing
 * named it. These cases exercise it DIRECTLY and cheaply through
 * `attachC2paStore`, the one export that runs a placer with no signing, no
 * hashing and no async: place a store verbatim, then read it back with
 * c2pa-extract's own extractors. Those suites are left untouched and still
 * cover the full embed → verify loop; the overlap is deliberate.
 *
 * CONTRACT (discovered by reading the module): every placer is SYNCHRONOUS and
 * THROWS on a container it cannot splice safely, with a message prefixed
 * `C2PA embed:` / `C2PA attach:`. Refusing is the correct outcome - a placer
 * that "succeeded" on a container it mis-read would emit a file that either
 * fails to decode or verifies while being corrupt. `embedC2pa`/`embedC2paInPdf`
 * are async (they sign), but every grammar rejection below happens before any
 * signing work.
 *
 * The placer contract the two-pass hard binding depends on is also asserted:
 * bytes outside the exclusion ranges depend only on the manifest LENGTH, never
 * its content.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  attachC2paStore, embedC2paInPdf, C2PA_FORMATS, C2PA_BMFF_UUID, bmffHashExclusions, C2PA_ATTACHMENT_MIME,
} from '../engine/src/c2pa-containers.ts';
import { extractC2paStore, sniffFormat, EXTRACTORS, extractC2paFromPdf } from '../engine/src/c2pa-extract.ts';
import { packTiff } from '../engine/src/tiff.ts';
import { walkOggPages } from '../engine/src/ogg.ts';

// ─── fixture helpers (structure-valid minimal containers) ─────────────────────

const bytesOf = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
const binOf = (b: Uint8Array): string => Array.from(b, (x) => String.fromCharCode(x)).join('');

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
const u32be = (n: number): Uint8Array => Uint8Array.of(n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
const u32le = (n: number): Uint8Array => Uint8Array.of(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);

const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (b: Uint8Array): number => { let c = 0xffffffff; for (const x of b) c = CRC_T[(c ^ x) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const pngChunk = (type: string, data: Uint8Array): Uint8Array => {
  const td = concat([bytesOf(type), data]);
  return concat([u32be(data.length), td, u32be(crc32(td))]);
};
const PNG_SIG = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const IHDR = pngChunk('IHDR', Uint8Array.of(0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0));
const IEND = pngChunk('IEND', new Uint8Array(0));
const tinyPng = (): Uint8Array => concat([PNG_SIG, IHDR, pngChunk('IDAT', Uint8Array.of(1, 2, 3)), IEND]);

const APP0 = concat([Uint8Array.of(0xff, 0xe0, 0x00, 0x10), bytesOf('JFIF\0'), Uint8Array.of(1, 1, 0, 0, 1, 0, 1, 0, 0)]);
const tinyJpeg = (): Uint8Array => concat([Uint8Array.of(0xff, 0xd8), APP0, Uint8Array.of(0xff, 0xd9)]);

const tinyGif = ({ gct = false }: { gct?: boolean } = {}): Uint8Array => concat([
  bytesOf('GIF87a'),
  Uint8Array.of(1, 0, 1, 0, gct ? 0x80 : 0x00, 0, 0),
  gct ? Uint8Array.of(0, 0, 0, 255, 255, 255) : new Uint8Array(0),
  Uint8Array.of(0x3b),
]);

const tinySvg = (): Uint8Array => bytesOf('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>');
const tinyTiff = (): Uint8Array => packTiff(Uint8Array.of(48, 186, 120), { width: 1, height: 1, samplesPerPixel: 3, dpi: 72 });
const tinyWebp = (): Uint8Array => {
  const body = concat([bytesOf('WEBP'), bytesOf('VP8 '), u32le(2), Uint8Array.of(0, 0)]);
  return concat([bytesOf('RIFF'), u32le(body.length), body]);
};

// The smallest honest WAV: fmt (16-byte PCM header) + a 4-byte data chunk - 
// placeWav refuses a container with no data chunk, so the fixture carries one.
const tinyWav = (): Uint8Array => {
  const body = concat([
    bytesOf('WAVE'),
    bytesOf('fmt '), u32le(16), new Uint8Array(16),
    bytesOf('data'), u32le(4), Uint8Array.of(1, 2, 3, 4),
  ]);
  return concat([bytesOf('RIFF'), u32le(body.length), body]);
};

const mp4box = (type: string, ...parts: Uint8Array[]): Uint8Array => {
  const p = concat(parts);
  return concat([u32be(8 + p.length), bytesOf(type), p]);
};
const tinyMp4 = (): Uint8Array => concat([
  mp4box('ftyp', bytesOf('isom'), u32be(0x200), bytesOf('isommp42')),
  mp4box('moov', mp4box('mvhd', new Uint8Array(40))),
  mp4box('mdat', bytesOf('fake-video-payload')),
]);
// AVIF is ISO BMFF with an image major brand - the same placer/binding as mp4.
const tinyAvif = (): Uint8Array => concat([
  mp4box('ftyp', bytesOf('avif'), u32be(0), bytesOf('avifmif1')),
  mp4box('meta', new Uint8Array(8)),
  mp4box('mdat', bytesOf('fake-avif-payload')),
]);
// M4A (AAC audio) is ISO BMFF too - same placer/binding as mp4.
const tinyM4a = (): Uint8Array => concat([
  mp4box('ftyp', bytesOf('M4A '), u32be(0), bytesOf('M4A mp42isom')),
  mp4box('moov', mp4box('mvhd', new Uint8Array(40))),
  mp4box('mdat', bytesOf('fake-aac-payload')),
]);

const ebVint = (n: number): Uint8Array => {
  let w = 1;
  while (w < 8 && n > 2 ** (7 * w) - 2) w++;
  const out = new Uint8Array(w);
  let v = n;
  for (let i = w - 1; i >= 0; i--) { out[i] = v & 0xff; v = Math.floor(v / 256); }
  out[0] = out[0]! | (0x80 >> (w - 1));
  return out;
};
const eb = (id: number[], payload: Uint8Array): Uint8Array => concat([Uint8Array.from(id), ebVint(payload.length), payload]);
const EBML_HEAD = concat([Uint8Array.of(0x1a, 0x45, 0xdf, 0xa3, 0x84), eb([0x42, 0x86], Uint8Array.of(1))]);
const SEG_ID = Uint8Array.of(0x18, 0x53, 0x80, 0x67);
const UNKNOWN_8 = Uint8Array.of(0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff);
const knownSegment = (payload: Uint8Array): Uint8Array =>
  concat([EBML_HEAD, SEG_ID, Uint8Array.of(0x40 | (payload.length >> 8), payload.length & 0xff), payload]);
const tinyWebm = (): Uint8Array => knownSegment(concat([
  eb([0x15, 0x49, 0xa9, 0x66], new Uint8Array(6)),                // Info
  eb([0x1f, 0x43, 0xb6, 0x75], bytesOf('fake-cluster-data')),     // Cluster
]));

// Ogg Opus: OpusHead (BOS) + OpusTags (the comment header where the credential
// lands) + one audio page. Pages carry a real libogg CRC (non-reflected, poly
// 0x04c11db7), so the fixture is a structurally valid, decodable stream.
const u16le = (n: number): Uint8Array => Uint8Array.of(n & 0xff, (n >>> 8) & 0xff);
const OGG_CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let r = i << 24; for (let j = 0; j < 8; j++) r = (r & 0x80000000) ? ((r << 1) ^ 0x04c11db7) : (r << 1); t[i] = r >>> 0; }
  return t;
})();
const oggCrc = (b: Uint8Array): number => { let c = 0; for (const x of b) c = ((c << 8) ^ OGG_CRC_T[((c >>> 24) ^ x) & 0xff]!) >>> 0; return c >>> 0; };
const oggPage = (htype: number, seq: number, packet: Uint8Array): Uint8Array => {
  const nseg = Math.floor(packet.length / 255) + 1;
  const seg = new Uint8Array(nseg);
  for (let i = 0; i < nseg - 1; i++) seg[i] = 255;
  seg[nseg - 1] = packet.length % 255;
  const head = new Uint8Array(27);
  head.set(bytesOf('OggS'), 0); head[5] = htype; head[26] = nseg;
  const dvh = new DataView(head.buffer);
  dvh.setUint32(14, 0xcafe, true); // serial
  dvh.setUint32(18, seq, true);    // page sequence
  const page = concat([head, seg, packet]);
  new DataView(page.buffer, page.byteOffset).setUint32(22, oggCrc(page), true);
  return page;
};
const OPUS_HEAD = concat([bytesOf('OpusHead'), Uint8Array.of(1, 1), u16le(0), u32le(48000), u16le(0), Uint8Array.of(0)]);
const OPUS_TAGS = concat([bytesOf('OpusTags'), u32le(0), u32le(0)]); // empty vendor + 0 comments
const tinyOpus = (): Uint8Array => concat([
  oggPage(0x02, 0, OPUS_HEAD),               // BOS
  oggPage(0x00, 1, OPUS_TAGS),               // comment header
  oggPage(0x04, 2, bytesOf('fake-opus-audio')), // EOS audio
]);

// A JUMBF store shaped like a real c2pa manifest store: the outer 'jumb' box
// with a 'jumd' description whose UUID begins with the ASCII bytes "c2pa" (the
// JPEG reader identifies its start segment by that marker), plus filler long
// enough to cross the GIF 255-byte sub-block boundary.
const C2PA_JUMBF_UUID = Uint8Array.of(0x63, 0x32, 0x70, 0x61, 0x00, 0x11, 0x00, 0x10, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71);
function fakeStore(contentLen = 300, fill = 0x58): Uint8Array {
  const jumd = concat([u32be(8 + 16), bytesOf('jumd'), C2PA_JUMBF_UUID]);
  return concat([u32be(8 + jumd.length + contentLen), bytesOf('jumb'), jumd, new Uint8Array(contentLen).fill(fill)]);
}
const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
const indexOfBytes = (hay: Uint8Array, needle: Uint8Array): number => {
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
};

const FIXTURES: Array<[string, Uint8Array]> = [
  ['png', tinyPng()],
  ['apng', tinyPng()],
  ['jpg', tinyJpeg()],
  ['jpeg', tinyJpeg()],
  ['gif', tinyGif()],
  ['svg', tinySvg()],
  ['tiff', tinyTiff()],
  ['cmyk-tiff', tinyTiff()],
  ['webp', tinyWebp()],
  ['mp4', tinyMp4()],
  ['avif', tinyAvif()],
  ['m4a', tinyM4a()],
  ['webm', tinyWebm()],
  ['wav', tinyWav()],
  ['ogg', tinyOpus()],
  ['opus', tinyOpus()],
];

// ─── dispatch table ───────────────────────────────────────────────────────────

test('C2PA_FORMATS covers every dispatchable format and nothing else', () => {
  // APPEND-ONLY. Slots are a contract: shells key export formats off this list,
  // so an id may join the END of it and none may move or leave. The five text
  // formats (C2PA 2.4 section A.7 / section A.9 + the Lolly fragment profile) are the 2026-08-11
  // addition - see tests/c2pa-text-write.test.ts for their round-trips.
  assert.deepEqual([...C2PA_FORMATS], ['pdf', 'pdf-cmyk', 'png', 'apng', 'jpg', 'jpeg', 'gif', 'svg', 'tiff', 'cmyk-tiff', 'webp', 'mp4', 'avif', 'm4a', 'webm', 'mp3', 'wav', 'ogg', 'opus', 'html', 'js', 'css', 'md', 'html-fragment']);
  assert.ok(Object.isFrozen(C2PA_FORMATS));
  for (const [fmt] of FIXTURES) assert.ok(C2PA_FORMATS.includes(fmt), `${fmt} is declared stampable`);
});

test('attachC2paStore validates its arguments and the format key before touching bytes', () => {
  const store = fakeStore(16);
  assert.throws(() => attachC2paStore('nope' as unknown as Uint8Array, 'png', store), /bytes must be a Uint8Array/);
  assert.throws(() => attachC2paStore(tinyPng(), 'png', 'nope' as unknown as Uint8Array), /store must be a Uint8Array/);
  assert.throws(() => attachC2paStore(tinyPng(), 'bmp', store), /no container for format 'bmp'/);
  assert.throws(() => attachC2paStore(tinyPng(), '', store), /no container for format ''/);
  // PDF is NOT a container placer - it routes through the incremental-update
  // embedder, which needs a signed manifest, so re-attachment is not offered.
  assert.throws(() => attachC2paStore(bytesOf('%PDF-1.4\n'), 'pdf', store), /no container for format 'pdf'/);
  // ...but the key is case-insensitive for the placers it does have.
  assert.ok(attachC2paStore(tinyPng(), 'PNG', store).length > tinyPng().length);
});

// ─── placement round-trips (walk in, walk back out) ───────────────────────────

test('every container places a store verbatim and reads it back byte-for-byte', () => {
  const store = fakeStore();
  for (const [fmt, fixture] of FIXTURES) {
    const out = attachC2paStore(fixture, fmt, store);
    assert.ok(out.length > fixture.length, `${fmt}: output grew`);
    const ex = extractC2paStore(out);
    assert.ok(ex, `${fmt}: a store extracts back out`);
    assert.ok(sameBytes(ex.store, store), `${fmt}: reassembled store is byte-identical`);
    // the container still sniffs as the same format it went in as
    assert.equal(sniffFormat(out), sniffFormat(fixture), `${fmt}: format survives placement`);
  }
});

test('placement is content-independent: only the manifest LENGTH moves other bytes', () => {
  // The two-pass hard binding depends on this exactly (embedC2pa asserts it at
  // run time too): place two stores of equal length but different content and
  // every byte outside the exclusion range must be identical.
  for (const [fmt, fixture] of FIXTURES) {
    const a = attachC2paStore(fixture, fmt, fakeStore(300, 0x58));
    const b = attachC2paStore(fixture, fmt, fakeStore(300, 0x59));
    assert.equal(a.length, b.length, `${fmt}: same length in, same length out`);
    let differing = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) differing++;
    // Differences are confined to the store bytes (svg carries them base64'd,
    // so its differing count is larger than the raw payload; tiff/webp also
    // carry a length-derived checksum-free header, unchanged here).
    assert.ok(differing > 0 && differing < a.length - fixture.length + 8, `${fmt}: ${differing} differing bytes`);
  }
});

test('png: the caBX chunk lands immediately after IHDR and is CRC-correct', () => {
  const store = fakeStore(64);
  const out = attachC2paStore(tinyPng(), 'png', store);
  const at = 8 + IHDR.length;
  assert.equal(binOf(out.subarray(at + 4, at + 8)), 'caBX', 'chunk sits right after IHDR');
  const len = new DataView(out.buffer, out.byteOffset).getUint32(at);
  assert.equal(len, store.length);
  const crcAt = at + 8 + len;
  assert.equal(new DataView(out.buffer, out.byteOffset).getUint32(crcAt), crc32(concat([bytesOf('caBX'), store])));
  // The original chunks are otherwise untouched, in order.
  assert.ok(sameBytes(out.subarray(0, at), concat([PNG_SIG, IHDR])));
  assert.ok(sameBytes(out.subarray(crcAt + 4), tinyPng().subarray(at)));
});

test('gif: the extension goes after the preamble (GCT included) and forces 89a', () => {
  for (const gct of [false, true]) {
    const fixture = tinyGif({ gct });
    const out = attachC2paStore(fixture, 'gif', fakeStore(64));
    assert.equal(out[4], 0x39, 'version byte forced to 9');
    const pre = gct ? 13 + 6 : 13;
    assert.equal(out[pre], 0x21, 'extension introducer at the end of the preamble');
    assert.equal(binOf(out.subarray(pre + 3, pre + 11)), 'C2PA_GIF');
    assert.ok(sameBytes(out.subarray(0, 4), fixture.subarray(0, 4)));
    assert.ok(sameBytes(out.subarray(5, pre), fixture.subarray(5, pre)), 'preamble otherwise intact');
  }
});

test('gif: a store longer than 255 bytes is split into sub-blocks and rejoined', () => {
  const store = fakeStore(700); // > 2 sub-blocks
  const out = attachC2paStore(tinyGif(), 'gif', store);
  const ex = EXTRACTORS.gif(out);
  assert.ok(ex && sameBytes(ex.manifest, store));
  // ...and every sub-block length byte is a real length, terminated by 0x00.
  let j = 13 + 14; // preamble + 21 FF 0B 'C2PA_GIF' 01 00 00
  let blocks = 0;
  while (out[j] !== 0x00) { j += 1 + out[j]!; blocks++; }
  assert.equal(blocks, Math.ceil(store.length / 255));
});

test('svg: the manifest is one unbroken base64 run inside a metadata child', () => {
  const out = attachC2paStore(tinySvg(), 'svg', fakeStore(64));
  const text = binOf(out);
  assert.match(text, /xmlns:c2pa="http:\/\/c2pa\.org\/manifest"/);
  assert.match(text, /<metadata><c2pa:manifest>[A-Za-z0-9+/]+={0,2}<\/c2pa:manifest><\/metadata>/);
  // An existing metadata element is reused rather than duplicated.
  const withMeta = bytesOf('<svg xmlns="http://www.w3.org/2000/svg"><metadata><x/></metadata><rect/></svg>');
  const reused = binOf(attachC2paStore(withMeta, 'svg', fakeStore(16)));
  assert.equal((reused.match(/<metadata/g) ?? []).length, 1);
  assert.match(reused, /<metadata><c2pa:manifest>[^<]+<\/c2pa:manifest><x\/><\/metadata>/);
});

test('tiff: a single-entry IFD is appended and the previous next-IFD pointer patched', () => {
  const fixture = tinyTiff();
  const store = fakeStore(64);
  const out = attachC2paStore(fixture, 'tiff', store);
  // Original bytes are a prefix except for the 4-byte next-IFD pointer patch.
  let patched = 0;
  for (let i = 0; i < fixture.length; i++) if (out[i] !== fixture[i]) patched++;
  assert.ok(patched > 0 && patched <= 4, `only the next-IFD pointer moved (${patched} bytes)`);
  const ex = EXTRACTORS.tiff(out);
  assert.ok(ex && sameBytes(ex.manifest, store));
});

test('webp: the C2PA chunk is appended last, RIFF size updated, odd lengths padded', () => {
  for (const len of [64, 65]) {
    const store = fakeStore(len);
    const out = attachC2paStore(tinyWebp(), 'webp', store);
    assert.equal(new DataView(out.buffer, out.byteOffset).getUint32(4, true), out.length - 8, 'RIFF size field');
    assert.equal(out.length % 2, 0, 'chunk padded to an even length');
    const ex = EXTRACTORS.webp(out);
    assert.ok(ex && sameBytes(ex.manifest, store), `len ${store.length}`);
  }
});

test('mp4: the C2PA uuid box is appended last, every original byte a prefix', () => {
  const fixture = tinyMp4();
  const store = fakeStore(64);
  const out = attachC2paStore(fixture, 'mp4', store);
  assert.ok(sameBytes(out.subarray(0, fixture.length), fixture), 'no stco/co64 offset can go stale');
  assert.equal(binOf(out.subarray(fixture.length + 4, fixture.length + 8)), 'uuid');
  assert.ok(sameBytes(out.subarray(fixture.length + 8, fixture.length + 24), C2PA_BMFF_UUID));
  assert.equal(binOf(out.subarray(fixture.length + 28, fixture.length + 36)), 'manifest');
  const ex = EXTRACTORS.mp4(out);
  assert.ok(ex && sameBytes(ex.manifest, store));
});

test('webm: the attachment declares application/c2pa and nothing before it moves', () => {
  const fixture = tinyWebm();
  const out = attachC2paStore(fixture, 'webm', fakeStore(64));
  assert.notEqual(indexOfBytes(out, bytesOf(C2PA_ATTACHMENT_MIME)), -1);
  assert.notEqual(indexOfBytes(out, bytesOf('manifest.c2pa')), -1);
  assert.equal(indexOfBytes(out, bytesOf('fake-cluster-data')), indexOfBytes(fixture, bytesOf('fake-cluster-data')));
});

test('ogg: the store rides in the OpusTags comment header, audio pages untouched, every page CRC valid', () => {
  const fixture = tinyOpus();
  const store = fakeStore(300);
  const out = attachC2paStore(fixture, 'opus', store);
  // The credential lands between OpusTags and the audio - i.e. inside the rebuilt
  // comment page, never in the BOS header or the sound.
  const tagsAt = indexOfBytes(out, bytesOf('OpusTags'));
  const audioAt = indexOfBytes(out, bytesOf('fake-opus-audio'));
  const credAt = indexOfBytes(out, bytesOf('C2PA='));
  assert.ok(tagsAt >= 0 && credAt > tagsAt && audioAt > credAt, 'C2PA field sits in the comment header, before the audio');
  // The OpusHead BOS page (page 0) is byte-identical, and the audio page is
  // present verbatim - only the comment page changed.
  const inPages = walkOggPages(fixture);
  const outPages = walkOggPages(out);
  assert.equal(outPages.length, inPages.length, 'page count preserved (comment rebuilt in place, no renumber)');
  assert.ok(sameBytes(out.subarray(0, inPages[1]!.start), fixture.subarray(0, inPages[1]!.start)), 'OpusHead page unchanged');
  assert.ok(indexOfBytes(out, fixture.subarray(inPages[2]!.start)) === out.length - (fixture.length - inPages[2]!.start), 'audio pages carried verbatim as the tail');
  // Every rebuilt page still checksums - the file stays a valid, playable Ogg.
  const OGG = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let r = i << 24; for (let j = 0; j < 8; j++) r = (r & 0x80000000) ? ((r << 1) ^ 0x04c11db7) : (r << 1); t[i] = r >>> 0; } return t; })();
  const crc = (b: Uint8Array): number => { let c = 0; for (const x of b) c = ((c << 8) ^ OGG[((c >>> 24) ^ x) & 0xff]!) >>> 0; return c >>> 0; };
  for (const p of outPages) {
    const page = out.slice(p.start, p.end);
    const stored = new DataView(page.buffer, page.byteOffset).getUint32(22, true);
    new DataView(page.buffer, page.byteOffset).setUint32(22, 0, true);
    assert.equal(crc(page), stored, `page seq ${p.seq} CRC valid`);
  }
  // ...and the store reads straight back out.
  const ex = extractC2paStore(out);
  assert.ok(ex && ex.format === 'ogg' && sameBytes(ex.store, store), 'store extracts back byte-for-byte, sniffed as ogg');
});

// ─── malformed / truncated containers (every placer refuses) ──────────────────

test('malformed and truncated containers are refused, per format, with a named reason', () => {
  const store = fakeStore(16);
  const cases: Array<[string, string, Uint8Array, RegExp]> = [
    ['png', 'wrong signature', bytesOf('not a png file!!!!'), /not a PNG/],
    ['png', 'chunk length overruns the file', concat([PNG_SIG, u32be(9999), bytesOf('IHDR'), new Uint8Array(4)]), /malformed PNG chunk/],
    ['png', 'no IHDR', concat([PNG_SIG, IEND]), /PNG has no IHDR/],
    ['jpg', 'wrong signature', bytesOf('\x00\x00 not jpeg'), /not a JPEG/],
    ['jpg', 'segment length overruns the file', concat([Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0x7f, 0xff), Uint8Array.of(1, 2, 3)]), /malformed JPEG segment/],
    ['gif', 'wrong signature', bytesOf('PNG89a padding'), /not a GIF/],
    ['gif', 'unknown block introducer', concat([bytesOf('GIF89a'), Uint8Array.of(1, 0, 1, 0, 0, 0, 0), Uint8Array.of(0x55)]), /malformed GIF block/],
    ['gif', 'extension header at EOF', concat([bytesOf('GIF89a'), Uint8Array.of(1, 0, 1, 0, 0, 0, 0), Uint8Array.of(0x21, 0xf9)]), /truncated GIF block/],
    ['gif', 'sub-block chain runs off the end', concat([bytesOf('GIF89a'), Uint8Array.of(1, 0, 1, 0, 0, 0, 0), Uint8Array.of(0x21, 0xfe, 0x05), bytesOf('abcde')]), /truncated GIF sub-blocks/],
    ['svg', 'no svg root', bytesOf('<html><body/></html>'), /not an SVG/],
    ['svg', 'unterminated root tag', bytesOf('<svg xmlns="http://x"'), /unterminated <svg> tag/],
    ['svg', 'self-closing root', bytesOf('<svg xmlns="http://x"/>'), /self-closing/],
    ['tiff', 'wrong byte order mark', bytesOf('XXXX padding..'), /not a TIFF/],
    ['tiff', 'BigTIFF', concat([Uint8Array.of(0x49, 0x49), Uint8Array.of(43, 0), u32le(8), new Uint8Array(16)]), /BigTIFF is not supported/],
    ['tiff', 'no first IFD', concat([Uint8Array.of(0x49, 0x49, 0x2a, 0x00), u32le(0), new Uint8Array(8)]), /TIFF has no IFD/],
    ['tiff', 'IFD entry count overruns the file', concat([Uint8Array.of(0x49, 0x49, 0x2a, 0x00), u32le(8), Uint8Array.of(0x40, 0x00), new Uint8Array(6)]), /malformed TIFF IFD/],
    ['webp', 'RIFF without WEBP', bytesOf('RIFFxxxxNOPEyyyy'), /not a WebP/],
    ['webp', 'chunk size overruns the file', concat([bytesOf('RIFF'), u32le(100), bytesOf('WEBP'), bytesOf('VP8 '), u32le(9999), new Uint8Array(4)]), /malformed WebP chunk/],
    ['mp4', 'box size overruns EOF', concat([u32be(100), bytesOf('ftyp')]), /malformed MP4/],
    ['mp4', 'no leading ftyp', concat([u32be(12), bytesOf('moov'), new Uint8Array(4)]), /no leading ftyp box/],
    ['webm', 'not EBML', bytesOf('no ebml magic here'), /not a WebM\/Matroska file/],
    ['webm', 'Segment size overruns EOF', concat([EBML_HEAD, SEG_ID, Uint8Array.of(0x41, 0x00), bytesOf('x')]), /truncated Matroska Segment/],
    ['webm', 'no Segment after the header', concat([EBML_HEAD, bytesOf('junk')]), /no Matroska Segment/],
    ['opus', 'not an Ogg stream', bytesOf('not an ogg stream at all!!'), /not an Ogg Opus stream/],
    ['opus', 'Ogg but not Opus', concat([oggPage(0x02, 0, bytesOf('\x01vorbis fake id header')), oggPage(0x00, 1, bytesOf('\x03vorbis'))]), /not an Ogg Opus stream/],
  ];
  for (const [fmt, why, bytes, want] of cases) {
    assert.throws(() => attachC2paStore(bytes, fmt, store), want, `${fmt}: ${why}`);
  }
});

test('a container truncated at every prefix either places or throws - never hangs, never a TypeError', () => {
  // /valid and the share target take arbitrary files, so the placers see
  // truncations of real containers constantly. Each must reach a decision.
  const store = fakeStore(16);
  for (const [fmt, fixture] of FIXTURES) {
    for (let cut = 0; cut <= fixture.length; cut++) {
      const bytes = fixture.subarray(0, cut);
      try {
        const out = attachC2paStore(bytes, fmt, store);
        assert.ok(out.length >= bytes.length, `${fmt}@${cut}: output is not shorter than its input`);
      } catch (err) {
        assert.ok(err instanceof Error, `${fmt}@${cut}: threw a non-Error`);
        assert.match((err as Error).message, /^C2PA (embed|attach):/, `${fmt}@${cut}: ${(err as Error).message}`);
      }
    }
  }
});

test('trailing data past a container end is neither consumed nor mistaken for structure', () => {
  const store = fakeStore(64);
  // PNG: bytes appended past IEND (the classic appended-payload case). The
  // walk stops at IEND, so the trailing bytes stay put, after the credential.
  const withTail = concat([tinyPng(), bytesOf('APPENDED-PAYLOAD-NOT-A-CHUNK')]);
  const out = attachC2paStore(withTail, 'png', store);
  assert.equal(binOf(out.subarray(out.length - 28)), 'APPENDED-PAYLOAD-NOT-A-CHUNK');
  const ex = EXTRACTORS.png(out);
  assert.ok(ex && sameBytes(ex.manifest, store), 'the credential still reads back');

  // WebM: bytes past the known-size Segment end are preserved verbatim after
  // the attachment (the placer splices at segEnd, not at EOF).
  const webmTail = concat([tinyWebm(), bytesOf('TRAILING')]);
  const webmOut = attachC2paStore(webmTail, 'webm', store);
  assert.equal(binOf(webmOut.subarray(webmOut.length - 8)), 'TRAILING');

  // MP4: trailing bytes that do not form a box are structure the walker cannot
  // read, so placement is refused rather than guessed at.
  assert.throws(() => attachC2paStore(concat([tinyMp4(), bytesOf('tail')]), 'mp4', store), /malformed MP4/);
});

// ─── re-stamping (existing credentials are replaced, never stacked) ───────────

test('re-attaching replaces the prior credential instead of stacking a second one', () => {
  const first = fakeStore(120, 0x41);
  const second = fakeStore(200, 0x42);
  for (const [fmt, fixture] of FIXTURES) {
    const once = attachC2paStore(fixture, fmt, first);
    const twice = attachC2paStore(once, fmt, second);
    const ex = extractC2paStore(twice);
    assert.ok(ex, `${fmt}: still exactly one readable store`);
    assert.ok(sameBytes(ex.store, second), `${fmt}: the newest store wins`);
    const thrice = attachC2paStore(twice, fmt, first);
    if (fmt === 'tiff' || fmt === 'cmyk-tiff') {
      // TIFF is the one format that CHAINS instead of replacing: each stamp
      // appends a new last IFD and patches the previous next-IFD pointer, and
      // the reader prefers the LAST IFD's entry (then falls back to the first,
      // as c2pa-rs does). Correct, but it means a re-stamped TIFF grows by the
      // superseded store each time.
      assert.ok(thrice.length > twice.length, 'tiff re-stamps chain a new IFD');
      assert.ok(sameBytes(extractC2paStore(thrice)!.store, first), 'and the newest IFD still wins');
    } else {
      // Everywhere else the prior credential is spliced out first, so a third
      // stamp of the FIRST store returns to the size the first stamp produced.
      assert.equal(thrice.length, once.length, `${fmt}: no growth across re-stamps`);
    }
  }
});

test('mp4: a non-trailing C2PA uuid box is refused rather than silently corrupted', () => {
  // c2patool places its box right after ftyp and patches stco/co64. Stripping
  // it without that patching would shift mdat and break playback while still
  // verifying - so the placer must refuse.
  const prior = concat([
    u32be(8 + 16 + 4 + 9 + 8 + 4), bytesOf('uuid'), C2PA_BMFF_UUID,
    new Uint8Array(4), bytesOf('manifest\0'), new Uint8Array(8), bytesOf('fake'),
  ]);
  const parts = tinyMp4();
  const midUuid = concat([parts.subarray(0, 24), prior, parts.subarray(24)]);
  assert.throws(() => attachC2paStore(midUuid, 'mp4', fakeStore(16)), /not the last box/);
});

test('mp4: a to-EOF (size 0) last box is finalised so the appended credential stays discoverable', () => {
  const sized = tinyMp4();
  const zeroed = sized.slice();
  const mdatOff = sized.length - (8 + 'fake-video-payload'.length);
  zeroed.set(u32be(0), mdatOff);
  const out = attachC2paStore(zeroed, 'mp4', fakeStore(64));
  assert.deepEqual(Array.from(out.subarray(mdatOff, mdatOff + 4)), Array.from(u32be(8 + 'fake-video-payload'.length)));
  assert.ok(EXTRACTORS.mp4(out), 'the credential is reachable by a top-level box walk');
});

test('webm: shapes whose byte positions would go stale are refused, not rewritten', () => {
  const store = fakeStore(16);
  // Foreign attachments (cover art): Matroska allows only one Attachments
  // element, and it is not ours to edit.
  const cover = eb([0x19, 0x41, 0xa4, 0x69], eb([0x61, 0xa7], concat([
    eb([0x46, 0x6e], bytesOf('cover.jpg')),
    eb([0x46, 0x60], bytesOf('image/jpeg')),
    eb([0x46, 0xae], Uint8Array.of(7)),
    eb([0x46, 0x5c], bytesOf('jpegbytes')),
  ])));
  assert.throws(() => attachC2paStore(knownSegment(concat([eb([0x15, 0x49, 0xa9, 0x66], new Uint8Array(6)), cover])), 'webm', store), /already has attachments/);
  assert.throws(() => attachC2paStore(concat([EBML_HEAD, SEG_ID, UNKNOWN_8, cover]), 'webm', store), /already has attachments/);

  // Unknown-size Segment carrying an index anywhere: inserting would stale it.
  const indexed = concat([
    EBML_HEAD, SEG_ID, UNKNOWN_8,
    eb([0x15, 0x49, 0xa9, 0x66], new Uint8Array(6)),
    eb([0x1f, 0x43, 0xb6, 0x75], bytesOf('cluster-one')),
    eb([0x1c, 0x53, 0xbb, 0x6b], new Uint8Array(8)), // Cues
  ]);
  assert.throws(() => attachC2paStore(indexed, 'webm', store), /unknown-size Segment with an index/);

  // An unmeasurable tail would hide an EOF-appended attachment from the walk.
  const soup = concat([EBML_HEAD, SEG_ID, UNKNOWN_8, Uint8Array.of(0x12, 0x54, 0xc3, 0x67), UNKNOWN_8, bytesOf('tag-soup')]);
  assert.throws(() => attachC2paStore(soup, 'webm', store), /unmeasurable Segment tail/);

  // A crafted oversized Attachments size VINT must clamp to the file, not loop.
  const bogus = concat([
    EBML_HEAD, SEG_ID, UNKNOWN_8,
    Uint8Array.of(0x19, 0x41, 0xa4, 0x69), Uint8Array.of(0x01, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00),
    bytesOf('xyz'),
  ]);
  assert.throws(() => attachC2paStore(bogus, 'webm', store), /already has attachments|malformed|unsupported/);
});

// ─── JPEG APP11 chunking (the >64 KB segment grammar) ─────────────────────────

test('jpeg: a store over 64000 bytes splits across APP11 segments that reassemble', () => {
  const store = fakeStore(140_000);
  const out = attachC2paStore(tinyJpeg(), 'jpg', store);
  // Count APP11 segments up to EOI by walking the marker chain.
  let app11 = 0;
  const zs: number[] = [];
  for (let i = 2; i + 4 <= out.length; ) {
    if (out[i] !== 0xff) break;
    const marker = out[i + 1]!;
    const end = i + 2 + ((out[i + 2]! << 8) | out[i + 3]!);
    if (marker === 0xeb) {
      app11++;
      // Segment body starts at i+4: CI "JP" (2), En box instance (2), Z (u32BE).
      assert.equal(binOf(out.subarray(i + 4, i + 6)), 'JP', 'CI marker');
      assert.deepEqual(Array.from(out.subarray(i + 6, i + 8)), [0x02, 0x11], 'En box instance');
      zs.push(((out[i + 8]! << 24) | (out[i + 9]! << 16) | (out[i + 10]! << 8) | out[i + 11]!) >>> 0);
      assert.ok(end - i - 2 <= 0xffff, 'segment fits JPEG\'s 16-bit length field');
    }
    if (marker === 0xd9) break;
    i = end;
  }
  assert.equal(app11, 3, '140000 bytes at 64000 per segment');
  assert.deepEqual(zs, [1, 2, 3], 'Z is 1-based and sequential');
  const ex = EXTRACTORS.jpeg(out);
  assert.ok(ex && sameBytes(ex.manifest, store), 'reassembly is byte-exact');
});

test('jpeg: the block is placed after the LAST APP0, before SOS', () => {
  const twoApp0 = concat([Uint8Array.of(0xff, 0xd8), APP0, APP0, Uint8Array.of(0xff, 0xda, 0x00, 0x02), Uint8Array.of(0xff, 0xd9)]);
  const out = attachC2paStore(twoApp0, 'jpg', fakeStore(32));
  const at = 2 + APP0.length * 2;
  assert.equal(out[at], 0xff);
  assert.equal(out[at + 1], 0xeb, 'APP11 follows both APP0 segments');
  assert.ok(EXTRACTORS.jpeg(out));
});

// ─── BMFF binding surface ─────────────────────────────────────────────────────

test('the BMFF usertype and exclusion set are the c2pa-rs defaults', () => {
  assert.equal(
    Array.from(C2PA_BMFF_UUID, (b) => b.toString(16).padStart(2, '0')).join(''),
    'd8fec3d61b0e483c92975828877ec481',
  );
  const ex = bmffHashExclusions();
  assert.deepEqual(ex.map((e) => e.xpath), ['/uuid', '/ftyp', '/mfra', '/free', '/skip']);
  // Only the C2PA uuid box is excluded - matched by usertype at offset 8, so
  // other uuid boxes stay hashed.
  assert.deepEqual(ex[0]!.data, [{ offset: 8, value: C2PA_BMFF_UUID }]);
  assert.equal(C2PA_ATTACHMENT_MIME, 'application/c2pa');
});

// ─── PDF incremental update (classic xref grammar) ────────────────────────────

function buildTestPdf({ names = '', extraCatalog = '' }: { names?: string; extraCatalog?: string } = {}): Uint8Array {
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  const push = (s: string): void => { offsets.push(out.length); out += s; };
  push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R${names}${extraCatalog} >>\nendobj\n`);
  push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n');
  const xrefOff = out.length;
  out += 'xref\n0 4\n0000000000 65535 f \n';
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xrefOff}\n%%EOF\n`;
  return bytesOf(out);
}

test('pdf: the incremental update keeps the original bytes as a byte-identical prefix', async () => {
  const pdf = buildTestPdf();
  const out = await embedC2paInPdf(pdf, { title: 'Container Fixture', claimGenerator: 'LollyTest/1.0' });
  assert.ok(sameBytes(out.subarray(0, pdf.length), pdf), 'original bytes untouched');
  const tail = binOf(out.subarray(pdf.length));
  assert.match(tail, /\/AFRelationship \/C2PA_Manifest/);
  assert.match(tail, /\/Type \/EmbeddedFile/);
  assert.match(tail, /\/Prev \d+/, 'the new xref section chains to the old one');
  assert.match(tail, /startxref\n\d+\n%%EOF\n$/);
  // The manifest reads back at the offset the layout promised.
  const found = extractC2paFromPdf(out);
  assert.ok(found, 'extractC2paFromPdf locates the embedded file');
  assert.ok(found.start >= pdf.length, 'the manifest lives in the appended revision');
});

test('pdf: an existing inline /Names dict is merged, not replaced', async () => {
  const out = await embedC2paInPdf(buildTestPdf({ names: ' /Names << /Dests 4 0 R >>' }), { title: 'Merged' });
  // The appended revision only: the original bytes are kept verbatim as a
  // prefix, so the un-merged first-revision catalog is still in the file.
  const tail = binOf(out).slice(binOf(buildTestPdf({ names: ' /Names << /Dests 4 0 R >>' })).length);
  // Assert the STRUCTURE the merge has to produce, not the incidental spacing
  // (catalogWithAttachment splices the new entry in before the closing `>>`,
  // which leaves a harmless double space, and appends /AF after it).
  const catalog = /1 0 obj\s*(<<[\s\S]*?)\nendobj/.exec(tail);
  assert.ok(catalog, 'the appended revision carries a replacement catalog');
  const src = catalog[1]!;
  // The pre-existing /Dests key survives beside the new /EmbeddedFiles key.
  assert.match(src, /\/Names\s*<<[\s\S]*\/Dests\s+4 0 R/, 'the existing /Names entries are preserved');
  const ef = /\/EmbeddedFiles\s*<<\s*\/Names\s*\[\s*\(manifest\.c2pa\)\s+(\d+) 0 R\s*\]\s*>>/.exec(src);
  assert.ok(ef, 'an /EmbeddedFiles name tree names manifest.c2pa');
  // ...and it is nested INSIDE the merged /Names dict, not appended after it.
  // A plain index comparison is not enough: an /EmbeddedFiles key appended
  // AFTER the closing `>>` of /Names also sits at a higher index. Walk the
  // dict nesting from the /Names value to find where that dict really ends.
  const names = /\/Names\s*<</.exec(src)!;
  let depth = 0;
  let namesEnd = -1;
  for (let i = names.index + names[0].length - 2; i < src.length - 1; i++) {
    const pair = src.slice(i, i + 2);
    if (pair === '<<') {
      depth++;
      i++;
    } else if (pair === '>>') {
      depth--;
      i++;
      if (depth === 0) {
        namesEnd = i + 1;
        break;
      }
    }
  }
  assert.ok(namesEnd > names.index, 'the merged /Names dict is balanced');
  assert.ok(
    ef.index > names.index && ef.index < namesEnd,
    '/EmbeddedFiles is nested inside the merged /Names dict, not appended after it',
  );
  // /AF points at the same filespec object as the name tree.
  const af = /\/AF\s*\[\s*(\d+) 0 R\s*\]/.exec(src);
  assert.ok(af, '/AF is an inline array of filespec refs');
  assert.equal(af[1], ef[1], '/AF and /EmbeddedFiles reference the same filespec object');
  // The named object really is the C2PA filespec.
  assert.match(tail, new RegExp(`${ef[1]!} 0 obj\\n<< /Type /Filespec [^\\n]*/AFRelationship /C2PA_Manifest`));
  assert.ok(extractC2paFromPdf(out));
});

test('pdf: unsupported and malformed PDF grammar is refused before any signing work', async () => {
  await assert.rejects(() => embedC2paInPdf(bytesOf('not a pdf at all')), /not a PDF/);
  await assert.rejects(() => embedC2paInPdf('nope' as unknown as Uint8Array), /must be a Uint8Array/);
  await assert.rejects(() => embedC2paInPdf(bytesOf('%PDF-1.4\n1 0 obj\n<< >>\nendobj\n')), /missing startxref/);
  // A cross-reference STREAM (PDF 1.5+) gets the distinct "cannot attach" error
  // the shell maps to a user-facing refusal.
  const xrefStream = bytesOf('%PDF-1.5\n4 0 obj\n<< /Type /XRef >>\nstream\nx\nendstream\nendobj\nstartxref\n9\n%%EOF\n');
  await assert.rejects(() => embedC2paInPdf(xrefStream), /cross-reference stream/);
  // startxref pointing at neither a table nor an object head.
  await assert.rejects(() => embedC2paInPdf(bytesOf('%PDF-1.4\n%junk\nstartxref\n9\n%%EOF\n')), /does not point at a cross-reference table/);
  // A pre-existing /EmbeddedFiles name tree is out of scope.
  await assert.rejects(
    () => embedC2paInPdf(buildTestPdf({ names: ' /Names << /EmbeddedFiles << /Names [] >> >>' })),
    /already has an \/EmbeddedFiles name tree/,
  );
  // An indirect /Names or /AF cannot be edited in place.
  await assert.rejects(() => embedC2paInPdf(buildTestPdf({ names: ' /Names 9 0 R' })), /\/Names is an indirect object/);
  await assert.rejects(() => embedC2paInPdf(buildTestPdf({ extraCatalog: ' /AF 9 0 R' })), /\/AF is not an inline array/);
});

// The REAL contract for a truncated stamped PDF, established by reading the
// code and confirming the behaviour (it is not a writer-side rejection):
//
//   * The WRITE side does not throw. A PDF whose appended revision is cut off
//     mid-way has no complete `startxref` for that revision, so parsePdf falls
//     back to the last intact cross-reference chain - the pre-stamp revision.
//     Re-stamping therefore appends a fresh revision over the dead bytes,
//     which is exactly how a conforming reader resolves an interrupted
//     incremental update. Nothing is half-parsed.
//   * The READ side is where truncation is refused: extractC2paFromPdf throws
//     rather than returning a short manifest, and verifyC2pa turns that into
//     an `invalid` verdict. Fail-closed either way.
test('pdf: a truncated stamped PDF fails closed on read, and re-stamping ignores the dead revision', async () => {
  const base = buildTestPdf();
  const out = await embedC2paInPdf(base, { title: 'Truncate me' });

  // Cut into the manifest stream itself: the declared /Length now overruns.
  const cutIntoStream = out.subarray(0, out.length - 400);
  assert.throws(() => extractC2paFromPdf(cutIntoStream), /manifest stream overruns the file/);

  // Cut further, past the stream keyword: still a refusal, never a partial read.
  assert.throws(() => extractC2paFromPdf(out.subarray(0, out.length - 1800)), /C2PA manifest object has no stream/);

  // Cut so far that no filespec survives: honestly "no credential here".
  assert.equal(extractC2paFromPdf(out.subarray(0, out.length - 2000)), null);

  // Only the trailer chopped: the manifest bytes are intact and still read
  // back, so refusing here would be wrong. The verdict is settled by the hard
  // binding (tests/c2pa-verify.ts covers that), not by the container parser.
  const trailerCut = out.subarray(0, out.length - 40);
  assert.ok(extractC2paFromPdf(trailerCut), 'an intact stream still reads back');

  // Write side: re-stamping a truncated file succeeds and produces a readable
  // credential, because the incomplete revision is unreachable.
  const restamped = await embedC2paInPdf(cutIntoStream, { title: 'Re-stamped' });
  assert.ok(sameBytes(restamped.subarray(0, base.length), base), 'the original revision is still a byte-identical prefix');
  const found = extractC2paFromPdf(restamped);
  assert.ok(found, 'the newest revision wins');
  assert.ok(found.start >= cutIntoStream.length, 'the manifest read back is the freshly appended one, not the dead one');
  // The dead revision is not chained: the new trailer /Prev points at the
  // ORIGINAL startxref, the only one the file still resolves.
  const origStartxref = +/startxref\n(\d+)\n%%EOF\n$/.exec(binOf(base))![1]!;
  assert.match(binOf(restamped.subarray(cutIntoStream.length)), new RegExp(`/Prev ${origStartxref}\\b`));
});

// ── TIFF IFD pointer bounds (fuzz finding, 2026-07-29) ──────────────────────
//
// placeTiff walks the IFD chain using offsets read STRAIGHT OUT OF THE FILE, so
// every one of them is attacker controlled. Two bugs were found by the
// c2pa-containers fuzz target and fixed together; this test pins both, because
// the fuzz gate alone cannot: its contract treats any throw as success, so a
// regression to a raw DataView RangeError would still pass it. What matters
// here is that the module refuses malformed input with ITS OWN named error.
//
// Reproducer for the first bug is kept at
// tests/fuzz/regressions/c2pa-containers-tiff-forged-ifd-pointer.bin
test('tiff: a forged IFD pointer is refused with a named error, not a RangeError', () => {
  const store = Uint8Array.of(1, 2, 3);

  // A first-IFD pointer far past EOF. Before the fix, u16(ifd) dereferenced
  // this before the bounds check below it could fire.
  const farPast = new Uint8Array(16);
  farPast.set(bytesOf('II'), 0);
  farPast.set(Uint8Array.of(42, 0), 2);
  farPast.set(u32le(0xff_fff0), 4);
  assert.throws(
    () => attachC2paStore(farPast, 'tiff', store),
    (e: unknown) => e instanceof Error && /malformed TIFF IFD/.test(e.message) && !(e instanceof RangeError),
    'a pointer past EOF is the module\'s own malformed-input error',
  );

  // The same, big-endian, to prove the guard is not endianness-specific.
  const beFarPast = new Uint8Array(16);
  beFarPast.set(bytesOf('MM'), 0);
  beFarPast.set(Uint8Array.of(0, 42), 2);
  beFarPast.set(u32be(0xff_fff0), 4);
  assert.throws(() => attachC2paStore(beFarPast, 'tiff', store), /malformed TIFF IFD/);

  // The header itself must be present before any of it is read: 'II' alone
  // satisfies the magic check but leaves offsets 2..7 out of range.
  assert.throws(() => attachC2paStore(bytesOf('II'), 'tiff', store), /truncated TIFF header/);

  // A subarray view whose forged pointer lands INSIDE the parent ArrayBuffer but
  // past the logical end of the file. This is the second bug: the DataView was
  // built without a byteLength, so these reads silently returned neighbouring
  // bytes instead of throwing, and the walk proceeded on data that is not part
  // of the file at all.
  const parent = new Uint8Array(512).fill(0xab);
  const view = parent.subarray(0, 16);
  view.set(bytesOf('II'), 0);
  view.set(Uint8Array.of(42, 0), 2);
  view.set(u32le(100), 4); // < parent.length, but > view.length
  assert.throws(
    () => attachC2paStore(view, 'tiff', store),
    /malformed TIFF IFD/,
    'a subarray must not be able to read past its own end into the parent buffer',
  );

  // Control: a well-formed TIFF still stamps, so the guards above did not
  // simply break the happy path. (Byte-level read-back of a real signed store
  // is covered by the round-trip cases earlier in this file; `store` here is
  // three arbitrary bytes, which is deliberately not a valid JUMBF store, so
  // extractC2paStore would correctly decline to return it.)
  const valid = packTiff(new Uint8Array(3), { width: 1, height: 1 });
  const ok = attachC2paStore(valid, 'tiff', store);
  assert.ok(ok.length > valid.length, 'a valid TIFF still gains the appended IFD and manifest');
  // Not a byte-identical prefix: appending the new IFD patches the previous
  // last IFD's next-pointer in place, which is the whole point of the chain
  // walk above. The header must survive untouched though.
  assert.ok(sameBytes(ok.subarray(0, 4), valid.subarray(0, 4)), 'the TIFF header is preserved');
});
