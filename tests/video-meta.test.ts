// SPDX-License-Identifier: MPL-2.0
// Byte-structure contract for engine/src/video-meta.js — the MP4 udta/ilst and
// Matroska Tags provenance writers used on webm/mp4 exports. Same pattern as
// apng.test.js / tiff.test.js: synthetic minimal containers, own mini-parsers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { videoProvenanceTags, embedMp4Meta, embedWebmMeta } from '../engine/src/video-meta.ts';

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
const ascii = (b: Uint8Array, off: number, len: number): string => new TextDecoder().decode(b.subarray(off, off + len));

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

const META = {
  software: 'Lolly',
  source: 'https://lolly.tools',
  tool: 'Animated Ad',
  author: 'Andy Fitzsimon',
  contact: 'andy@example.com',
  description: 'Made with https://lolly.tools — Animated Ad by Andy Fitzsimon',
};
const DATE = new Date('2026-07-02T12:00:00Z');
const TAGS = videoProvenanceTags(META, DATE);

// ── videoProvenanceTags ───────────────────────────────────────────────────────

test('provenance tags map the ExportMeta record onto container fields', () => {
  assert.equal(TAGS.title, 'Animated Ad');
  assert.equal(TAGS.artist, 'Andy Fitzsimon');
  assert.equal(TAGS.date, '2026-07-02T12:00:00.000Z');
  assert.equal(TAGS.encoder, 'Lolly (https://lolly.tools)');
  assert.equal(TAGS.encodedBy, 'https://lolly.tools');
  assert.equal(TAGS.publisher, 'https://lolly.tools');
  // Comment matches the GIF credit line: description · contact · source.
  assert.equal(TAGS.comment, `${META.description} · ${META.contact} · ${META.source}`);
});

test('empty profile fields stay empty (omitted by the writers), platform tags remain', () => {
  const t = videoProvenanceTags({ software: 'Lolly', source: 'https://lolly.tools', tool: 'QR Code', author: '', contact: '', description: 'Made with https://lolly.tools — QR Code' }, DATE);
  assert.equal(t.artist, '');
  assert.equal(t.publisher, 'https://lolly.tools');
});

// ── MP4 ───────────────────────────────────────────────────────────────────────

const be32 = (n: number): Uint8Array => new Uint8Array([n >>> 24 & 0xff, n >>> 16 & 0xff, n >>> 8 & 0xff, n & 0xff]);
const mp4box = (type: string, ...parts: Uint8Array[]): Uint8Array => {
  const payload = concat(...parts);
  return concat(be32(8 + payload.length), utf8(type), payload);
};
const readU32 = (b: Uint8Array, off: number): number => (b[off]! << 24 | b[off + 1]! << 16 | b[off + 2]! << 8 | b[off + 3]!) >>> 0;

interface Box { off: number; size: number; }

function findBox(b: Uint8Array, start: number, end: number, type: string): Box | null {
  let off = start;
  while (off < end) {
    const size = readU32(b, off) || (end - off);
    if (ascii(b, off + 4, 4) === type) return { off, size };
    off += size;
  }
  return null;
}

function syntheticMp4(): Uint8Array {
  const ftyp = mp4box('ftyp', utf8('isom'), be32(0x200), utf8('isommp42'));
  const moov = mp4box('moov', mp4box('mvhd', new Uint8Array(100)));
  const mdat = mp4box('mdat', utf8('fake-video-payload'));
  return concat(ftyp, moov, mdat);
}

test('mp4: udta/meta/ilst appended inside moov, sizes patched, siblings untouched', () => {
  const src = syntheticMp4();
  const out = embedMp4Meta(src, TAGS);
  assert.notEqual(out, src);
  assert.equal(out.length, src.length + (findBox(out, findBox(out, 0, out.length, 'moov')!.off + 8,
    findBox(out, 0, out.length, 'moov')!.off + findBox(out, 0, out.length, 'moov')!.size, 'udta')?.size ?? 0));

  const ftyp = findBox(out, 0, out.length, 'ftyp')!;
  assert.equal(ftyp.off, 0); // prefix preserved
  const moov = findBox(out, 0, out.length, 'moov')!;
  const udta = findBox(out, moov.off + 8, moov.off + moov.size, 'udta');
  assert.ok(udta, 'udta present in moov');
  const metaBox = findBox(out, udta.off + 8, udta.off + udta.size, 'meta');
  assert.ok(metaBox, 'meta fullbox present');
  const ilst = findBox(out, metaBox.off + 12, metaBox.off + metaBox.size, 'ilst'); // +12 skips fullbox ver/flags
  assert.ok(ilst, 'ilst present');

  // mdat still intact after the grown moov.
  const mdat = findBox(out, 0, out.length, 'mdat')!;
  assert.equal(ascii(out, mdat.off + 8, 18), 'fake-video-payload');
});

function ilstValue(b: Uint8Array, key: string): string | null {
  const moov = findBox(b, 0, b.length, 'moov')!;
  const udta = findBox(b, moov.off + 8, moov.off + moov.size, 'udta')!;
  const meta = findBox(b, udta.off + 8, udta.off + udta.size, 'meta')!;
  const ilst = findBox(b, meta.off + 12, meta.off + meta.size, 'ilst')!;
  let off = ilst.off + 8;
  while (off < ilst.off + ilst.size) {
    const size = readU32(b, off);
    const type = Array.from(b.subarray(off + 4, off + 8), (c) => String.fromCharCode(c)).join('');
    if (type === key) {
      const data = findBox(b, off + 8, off + size, 'data')!;
      return new TextDecoder().decode(b.subarray(data.off + 16, data.off + data.size)); // skip size+type+dataType+locale
    }
    off += size;
  }
  return null;
}

test('mp4: iTunes keys carry encoder, artist, date, title, comment', () => {
  const out = embedMp4Meta(syntheticMp4(), TAGS);
  assert.equal(ilstValue(out, '©too'), 'Lolly (https://lolly.tools)');
  assert.equal(ilstValue(out, '©ART'), 'Andy Fitzsimon');
  assert.equal(ilstValue(out, '©day'), '2026-07-02T12:00:00.000Z');
  assert.equal(ilstValue(out, '©nam'), 'Animated Ad');
  assert.equal(ilstValue(out, '©cmt'), TAGS.comment);
  // Freeform PUBLISHER item present with the mean/name pair.
  const raw = new TextDecoder().decode(out);
  assert.ok(raw.includes('com.apple.iTunes'));
  assert.ok(raw.includes('PUBLISHER'));
});

// ── MP4 fast-start offset patching (regression, ex video-meta-mp4.test.ts) ───
// Regression test for the MP4 provenance corruption fix (engine/src/video-meta.ts).
// A fast-start MP4 has `moov` BEFORE `mdat`; embedding a `udta` into `moov` shifts
// `mdat`, so every stco/co64 chunk offset must be bumped by udta.length or the
// file is unplayable. Progressive files (mdat before moov) must be left alone.

// Minimal tag set — enough to make embedMp4Meta insert a udta.
const STCO_TAGS = { title: '', artist: '', date: '', comment: '', encoder: 'Lolly', encodedBy: '', publisher: '' };
const findStcoOffset = (b: Uint8Array): number => {
  for (let i = 0; i + 16 < b.length; i++) {
    if (b[i] === 115 && b[i + 1] === 116 && b[i + 2] === 99 && b[i + 3] === 111) return readU32(b, i + 12); // 'stco' → first offset
  }
  return -1;
};
const moovWithStco = (chunkOff: number): Uint8Array =>
  mp4box('moov', mp4box('trak', mp4box('mdia', mp4box('minf', mp4box('stbl', mp4box('stco', be32(0), be32(1), be32(chunkOff)))))));

test('fast-start (moov before mdat): stco chunk offset is shifted by udta.length', () => {
  const mdatData = utf8('SAMPLEDATA');
  const moovLen = moovWithStco(0).length;          // length is offset-independent
  const chunkOff = moovLen + 8;                     // first mdat data byte (after mdat's 8-byte header)
  const file = concat(moovWithStco(chunkOff), mp4box('mdat', mdatData));
  assert.equal(file[chunkOff], mdatData[0], 'fixture: offset points at mdat data');

  const out = embedMp4Meta(file, STCO_TAGS);
  const delta = out.length - file.length;
  assert.ok(delta > 0, 'udta was inserted');
  const patched = findStcoOffset(out);
  assert.equal(patched, chunkOff + delta, 'chunk offset bumped by udta.length');
  assert.equal(out[patched], mdatData[0], 'patched offset still lands on the sample data');
});

test('progressive (mdat before moov): offsets left untouched', () => {
  const mdatData = utf8('SAMPLEDATA');
  const mdat = mp4box('mdat', mdatData);
  const chunkOff = 8;                               // mdat data start (mdat is first)
  const file = concat(mdat, moovWithStco(chunkOff));
  const out = embedMp4Meta(file, STCO_TAGS);
  assert.ok(out.length > file.length, 'udta inserted');
  assert.equal(findStcoOffset(out), chunkOff, 'offset unchanged (nothing shifted before mdat)');
});

test('mp4: bails untouched on missing moov, existing udta, or 64-bit sizes', () => {
  const noMoov = concat(mp4box('ftyp', utf8('isom')), mp4box('mdat', utf8('x')));
  assert.equal(embedMp4Meta(noMoov, TAGS), noMoov);

  const withUdta = concat(mp4box('moov', mp4box('mvhd', new Uint8Array(8)), mp4box('udta', new Uint8Array(0))));
  assert.equal(embedMp4Meta(withUdta, TAGS), withUdta);

  // size===1 (64-bit largesize) at top level → conservative bail.
  const largesize = concat(be32(1), utf8('moov'), new Uint8Array(8));
  assert.equal(embedMp4Meta(largesize, TAGS), largesize);

  const junk = utf8('definitely not an mp4');
  assert.equal(embedMp4Meta(junk, TAGS), junk);
});

// ── WebM / Matroska ───────────────────────────────────────────────────────────

const EBML_HEAD = concat(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x84]), new Uint8Array([0x42, 0x86, 0x81, 0x01])); // EBMLVersion=1
const SEG_ID = new Uint8Array([0x18, 0x53, 0x80, 0x67]);
const UNKNOWN_8 = new Uint8Array([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

interface Vint { width: number; value: number; }

function readVint(b: Uint8Array, off: number): Vint {
  const first = b[off]!;
  let width = 1;
  while (!(first & (0x80 >> (width - 1)))) width++;
  let value = first & (0xff >> width);
  for (let i = 1; i < width; i++) value = value * 256 + b[off + i]!;
  return { width, value };
}

// Walk elements in [start,end) matching a 2-byte id; return [{payloadOff, size}].
function findEbml(b: Uint8Array, start: number, end: number, id: number[]): Array<{ payloadOff: number; size: number }> {
  const hits: Array<{ payloadOff: number; size: number }> = [];
  for (let off = start; off + id.length < end; off++) {
    if (id.every((x, i) => b[off + i] === x)) {
      const v = readVint(b, off + id.length);
      hits.push({ payloadOff: off + id.length + v.width, size: v.value });
    }
  }
  return hits;
}

test('webm: Tags element appended to an unknown-size Segment (MediaRecorder shape)', () => {
  const payload = utf8('fake-cluster-bytes');
  const src = concat(EBML_HEAD, SEG_ID, UNKNOWN_8, payload);
  const out = embedWebmMeta(src, TAGS);
  assert.notEqual(out, src);
  // Original bytes form an untouched prefix; Tags rides at EOF inside the open segment.
  assert.deepEqual(out.subarray(0, src.length), src);
  assert.deepEqual(out.subarray(src.length, src.length + 4), new Uint8Array([0x12, 0x54, 0xc3, 0x67]));

  const names = findEbml(out, src.length, out.length, [0x45, 0xa3])
    .map(h => new TextDecoder().decode(out.subarray(h.payloadOff, h.payloadOff + h.size)));
  assert.deepEqual(names, ['TITLE', 'ARTIST', 'DATE_RELEASED', 'COMMENT', 'ENCODER', 'ENCODED_BY', 'PUBLISHER']);

  const strings = findEbml(out, src.length, out.length, [0x44, 0x87])
    .map(h => new TextDecoder().decode(out.subarray(h.payloadOff, h.payloadOff + h.size)));
  assert.equal(strings[names.indexOf('ENCODED_BY')], 'https://lolly.tools');
  assert.equal(strings[names.indexOf('PUBLISHER')], 'https://lolly.tools');
  assert.equal(strings[names.indexOf('ARTIST')], 'Andy Fitzsimon');
  assert.equal(strings[names.indexOf('ENCODER')], 'Lolly (https://lolly.tools)');
});

test('webm: known-size Segment gets its size VINT patched in the same width', () => {
  const payload = utf8('0123456789');
  const sizeVint = new Uint8Array([0x40, payload.length]); // 2-byte width VINT
  const src = concat(EBML_HEAD, SEG_ID, sizeVint, payload);
  const out = embedWebmMeta(src, TAGS);
  assert.notEqual(out, src);

  const segAt = EBML_HEAD.length;
  const v = readVint(out, segAt + 4);
  assert.equal(v.width, 2); // width preserved — no offsets shifted
  assert.equal(v.value, payload.length + (out.length - src.length));
  // Tags element sits inside the (now larger) segment, right after the payload.
  const tagsOff = segAt + 4 + 2 + payload.length;
  assert.deepEqual(out.subarray(tagsOff, tagsOff + 4), new Uint8Array([0x12, 0x54, 0xc3, 0x67]));
});

// Chrome-shaped finalised recording: SeekHead (Info+Cluster entries) + reserved
// Void + Info + Cluster + Cues, known-size Segment. The embed must index the
// appended Tags in the SeekHead by growing it into the Void — with no byte of
// the file moving (demuxers only find trailing elements through the SeekHead).
function chromeShapedWebm(): { src: Uint8Array; payload: Uint8Array; shVoidSpan: number } {
  const seek = (idBytes: number[], pos: number): Uint8Array => concat(
    new Uint8Array([0x4d, 0xbb, 0x80 | 11]),                         // Seek, payload 11
    new Uint8Array([0x53, 0xab, 0x84]), new Uint8Array(idBytes),     // SeekID (4-byte id)
    new Uint8Array([0x53, 0xac, 0x81, pos]),                         // SeekPosition (1-byte uint)
  );
  const sh      = concat(new Uint8Array([0x11, 0x4d, 0x9b, 0x74, 0x80 | 28]),
    seek([0x15, 0x49, 0xa9, 0x66], 77), seek([0x1f, 0x43, 0xb6, 0x75], 86));
  const voidEl  = concat(new Uint8Array([0xec, 0x80 | 42]), new Uint8Array(42));
  const info    = concat(new Uint8Array([0x15, 0x49, 0xa9, 0x66, 0x84]), utf8('info'));
  const cluster = concat(new Uint8Array([0x1f, 0x43, 0xb6, 0x75, 0x86]), utf8('frames'));
  const cues    = concat(new Uint8Array([0x1c, 0x53, 0xbb, 0x6b, 0x83]), utf8('cue'));
  const payload = concat(sh, voidEl, info, cluster, cues);
  const sizeVint = new Uint8Array([0x40, payload.length]);
  return { src: concat(EBML_HEAD, SEG_ID, sizeVint, payload), payload, shVoidSpan: sh.length + voidEl.length };
}

test('webm: appended Tags gets a SeekHead entry grown into the reserved Void, positions preserved', () => {
  const { src, payload, shVoidSpan } = chromeShapedWebm();
  const out = embedWebmMeta(src, TAGS);
  assert.notEqual(out, src);

  const segAt = EBML_HEAD.length;
  const payloadAt = segAt + 4 + 2;
  // File grew by exactly the Tags element (SeekHead+Void swap is size-neutral).
  const tagsLen = out.length - src.length;
  const v = readVint(out, segAt + 4);
  assert.equal(v.value, payload.length + tagsLen);

  // SeekHead grew by one Seek entry: SeekID = Tags (1254C367), SeekPosition =
  // the original payload length (where the Tags element was appended).
  const expectedEntry = concat(
    new Uint8Array([0x4d, 0xbb, 0x80 | 11]),
    new Uint8Array([0x53, 0xab, 0x84, 0x12, 0x54, 0xc3, 0x67]),
    new Uint8Array([0x53, 0xac, 0x81, payload.length]),
  );
  const shSize = readVint(out, payloadAt + 4);
  assert.equal(shSize.value, 28 + expectedEntry.length);
  const entryAt = payloadAt + 4 + 1 + 28; // after the two original entries
  assert.deepEqual(out.subarray(entryAt, entryAt + expectedEntry.length), expectedEntry);

  // Void shrank by the entry size, keeping the SeekHead+Void span constant, so
  // everything after it is byte-identical and existing SeekPositions resolve.
  const voidAt = entryAt + expectedEntry.length;
  assert.equal(out[voidAt], 0xec);
  const voidSize = readVint(out, voidAt + 1);
  assert.equal(1 + voidSize.width + voidSize.value, (1 + 1 + 42) - expectedEntry.length);
  assert.deepEqual(
    out.subarray(payloadAt + shVoidSpan, payloadAt + payload.length),
    src.subarray(payloadAt + shVoidSpan, payloadAt + payload.length),
  );
  // Tags element sits at the original payload end.
  assert.deepEqual(out.subarray(payloadAt + payload.length, payloadAt + payload.length + 4),
    new Uint8Array([0x12, 0x54, 0xc3, 0x67]));
});

test('webm: streaming (unknown-size, unindexed) gets Tags inserted before the first Cluster', () => {
  const info    = concat(new Uint8Array([0x15, 0x49, 0xa9, 0x66, 0x84]), utf8('info'));
  const cluster = concat(new Uint8Array([0x1f, 0x43, 0xb6, 0x75]), new Uint8Array([0xff]), utf8('open-ended-frames'));
  const src = concat(EBML_HEAD, SEG_ID, UNKNOWN_8, info, cluster);
  const out = embedWebmMeta(src, TAGS);
  const clusterAt = EBML_HEAD.length + 4 + 8 + info.length;
  // Tags element starts exactly where the Cluster used to.
  assert.deepEqual(out.subarray(clusterAt, clusterAt + 4), new Uint8Array([0x12, 0x54, 0xc3, 0x67]));
  // The Cluster follows, shifted intact by the Tags length.
  const shifted = clusterAt + (out.length - src.length);
  assert.deepEqual(out.subarray(shifted, out.length), cluster);
});

test('webm: bails untouched on non-EBML input and empty tag sets', () => {
  const junk = utf8('RIFF not matroska');
  assert.equal(embedWebmMeta(junk, TAGS), junk);
  const src = concat(EBML_HEAD, SEG_ID, UNKNOWN_8, utf8('x'));
  assert.equal(embedWebmMeta(src, { title: '', artist: '' } as any), src);
});
