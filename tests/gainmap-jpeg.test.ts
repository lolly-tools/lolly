// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/gainmap-jpeg.ts - MPF + Ultra HDR XMP + ISO 21496-1 assembly.
 *
 * plans/61-deeprichpixels.md section 6 B2. Everything asserted here is READ BACK OUT of
 * the produced bytes by readers written in this file - an independent MPF/TIFF
 * walker, an independent ISO 21496-1 parser, and a tiny XML well-formedness
 * checker - never trusted from the writer's own intermediate values. Where
 * `sharp` is installed it decodes the finished file as a third-party oracle:
 * it knows nothing about gain maps, which is precisely why it is the right
 * witness for "the fallback is a perfect ordinary SDR JPEG".
 *
 * Run: node --test tests/gainmap-jpeg.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assembleGainMapJpeg,
  buildGainMapXmp,
  buildIsoGainMapMetadata,
  buildPrimaryXmp,
  buildXmpApp1,
  ISO_GAINMAP_URN,
  repairMpfOffsets,
  XMP_APP1_MAX,
} from '../engine/src/gainmap-jpeg.ts';
import type { GainMapMeta } from '../engine/src/gainmap.ts';
import {
  buildJpegSegment,
  findJpegSegment,
  insertJpegSegments,
  JPEG_APP_IDS,
  jpegSegmentBody,
  scanJpegSegments,
} from '../engine/src/jpeg-segments.ts';

// ── fixtures: two real 8x8 JPEGs (libjpeg-turbo via sharp, no APP0/JFIF) ─────

const BASE_JPEG_B64 =
  '/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBD' +
  'AQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAgD' +
  'ASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAA' +
  'BQf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCKAAK2/9k=';
const MAP_JPEG_B64 =
  '/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBD' +
  'AQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAgD' +
  'ASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA' +
  '/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AAA//2Q==';

const BASE = new Uint8Array(Buffer.from(BASE_JPEG_B64, 'base64'));
const MAP = new Uint8Array(Buffer.from(MAP_JPEG_B64, 'base64'));

const META: GainMapMeta = {
  channels: 1,
  gainMapMin: -0.25,
  gainMapMax: 2.5,
  gamma: 1,
  offsetSdr: 0,
  offsetHdr: 0,
  hdrCapacityMin: 0,
  hdrCapacityMax: 2.5,
  baseRendition: 'sdr',
  useBaseColorSpace: true,
};

// ── optional external oracle ─────────────────────────────────────────────────

interface SharpImage { raw(): SharpImage; toBuffer(): Promise<Buffer>; metadata(): Promise<{ width?: number; height?: number }> }
type SharpFactory = (input: Buffer) => SharpImage;
let sharp: SharpFactory | null = null;
try {
  const specifier = 'sharp';
  sharp = ((await import(specifier)) as { default: SharpFactory }).default;
} catch {
  sharp = null;
}
const SKIP_SHARP = sharp ? false : 'sharp is not installed (optional external-decoder oracle)';

// ── the test's OWN MPF reader (CIPA DC-007), written against the spec ────────

interface MpEntry { attribute: number; size: number; offset: number; dep1: number; dep2: number }
interface MpIndex { bigEndian: boolean; version: string; numberOfImages: number; entries: MpEntry[]; uids: Uint8Array[] | null; mpHeaderAt: number }

function readMpIndex(jpeg: Uint8Array): MpIndex | null {
  const seg = findJpegSegment(jpeg, 0xe2, 'MPF');
  if (!seg) return null;
  const body = jpegSegmentBody(jpeg, seg);
  // body = "MPF\0" + MP header
  assert.equal(String.fromCharCode(body[0]!, body[1]!, body[2]!), 'MPF');
  assert.equal(body[3], 0, 'MPF identifier is NUL-terminated');
  const h = seg.start + 4 + 4; // absolute offset of the MP Endian field
  const dv = new DataView(jpeg.buffer, jpeg.byteOffset, jpeg.byteLength);
  const endian = dv.getUint16(h);
  assert.ok(endian === 0x4d4d || endian === 0x4949, 'MP Endian field is II or MM');
  const be = endian === 0x4d4d;
  const u16 = (o: number) => dv.getUint16(o, !be);
  const u32 = (o: number) => dv.getUint32(o, !be);
  assert.equal(u16(h + 2), 0x002a, 'TIFF magic');
  const ifd = h + u32(h + 4);
  const count = u16(ifd);
  let version = '';
  let numberOfImages = 0;
  let entriesAt = -1;
  let entriesCount = 0;
  let uidsAt = -1;
  let uidsCount = 0;
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    const tag = u16(e);
    const type = u16(e + 2);
    const n = u32(e + 4);
    if (tag === 0xb000) {
      assert.equal(type, 7, 'MPFVersion is UNDEFINED');
      assert.equal(n, 4);
      version = String.fromCharCode(jpeg[e + 8]!, jpeg[e + 9]!, jpeg[e + 10]!, jpeg[e + 11]!);
    } else if (tag === 0xb001) {
      assert.equal(type, 4, 'NumberOfImages is LONG');
      numberOfImages = u32(e + 8);
    } else if (tag === 0xb002) {
      assert.equal(type, 7, 'MPEntry is UNDEFINED');
      entriesCount = n / 16;
      entriesAt = h + u32(e + 8);
    } else if (tag === 0xb003) {
      uidsCount = n / 33;
      uidsAt = h + u32(e + 8);
    }
  }
  assert.equal(u32(ifd + 2 + count * 12), 0, 'MP Index IFD has no next IFD');
  assert.equal(entriesCount, numberOfImages, 'one MP Entry per image');
  const entries: MpEntry[] = [];
  for (let i = 0; i < numberOfImages; i++) {
    const at = entriesAt + i * 16;
    entries.push({
      attribute: u32(at), size: u32(at + 4), offset: u32(at + 8),
      dep1: u16(at + 12), dep2: u16(at + 14),
    });
  }
  const uids = uidsAt < 0 ? null : Array.from({ length: uidsCount }, (_, i) => jpeg.subarray(uidsAt + i * 33, uidsAt + (i + 1) * 33));
  return { bigEndian: be, version, numberOfImages, entries, uids, mpHeaderAt: h };
}

// ── the test's OWN ISO 21496-1 reader ────────────────────────────────────────

interface IsoMeta {
  minimumVersion: number; writerVersion: number;
  isMultiChannel: boolean; useBaseColourSpace: boolean;
  baseHeadroom: number; alternateHeadroom: number;
  channels: { min: number; max: number; gamma: number; baseOffset: number; alternateOffset: number }[];
}

function readIsoGainMap(payload: Uint8Array): IsoMeta {
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  let o = 0;
  const minimumVersion = dv.getUint16(o); o += 2;
  const writerVersion = dv.getUint16(o); o += 2;
  const flags = payload[o]!; o += 1;
  const isMultiChannel = (flags & 0x80) !== 0;
  const useBaseColourSpace = (flags & 0x40) !== 0;
  const uRat = () => { const n = dv.getUint32(o); const d = dv.getUint32(o + 4); o += 8; assert.ok(d > 0, 'rational denominator is non-zero'); return n / d; };
  const sRat = () => { const n = dv.getInt32(o); const d = dv.getUint32(o + 4); o += 8; assert.ok(d > 0, 'rational denominator is non-zero'); return n / d; };
  const baseHeadroom = uRat();
  const alternateHeadroom = uRat();
  const n = isMultiChannel ? 3 : 1;
  const channels = [];
  for (let c = 0; c < n; c++) {
    channels.push({ min: sRat(), max: sRat(), gamma: uRat(), baseOffset: sRat(), alternateOffset: sRat() });
  }
  assert.equal(o, payload.length, 'ISO metadata consumed exactly');
  return { minimumVersion, writerVersion, isMultiChannel, useBaseColourSpace, baseHeadroom, alternateHeadroom, channels };
}

// ── a tiny XML well-formedness checker (tag stack + attribute syntax) ────────

function assertWellFormedXmp(packet: string): void {
  assert.ok(packet.startsWith('<?xpacket begin='), 'starts with the xpacket header PI');
  assert.ok(packet.trimEnd().endsWith('<?xpacket end="w"?>'), 'ends with the xpacket trailer PI');
  const stack: string[] = [];
  const re = /<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[A-Za-z_][\w.:-]*\s*=\s*"[^"<]*")*)\s*(\/?)>|<\?[\s\S]*?\?>/g;
  let consumed = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(packet))) {
    // Everything between markup must be text without a raw '<'.
    const between = packet.slice(consumed, m.index);
    assert.ok(!between.includes('<'), `unescaped '<' in text at ${consumed}`);
    consumed = m.index + m[0].length;
    if (m[2] === undefined) continue; // processing instruction
    if (m[1] === '/') {
      assert.equal(stack.pop(), m[2], `close tag </${m[2]}> matches the open tag`);
    } else if (m[4] !== '/') {
      stack.push(m[2]);
    }
  }
  assert.ok(!packet.slice(consumed).includes('<'), 'no unparsed markup at the tail');
  assert.deepEqual(stack, [], 'every element is closed');
}

/** Pull `ns:name="value"` attributes out of a packet (flat - the packets are attribute-shaped). */
function xmpAttrs(packet: string, ns: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = new RegExp(`\\b${ns}:([A-Za-z]\\w*)\\s*=\\s*"([^"]*)"`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(packet))) out[m[1]!] = m[2]!;
  return out;
}

function xmpPacketOf(jpeg: Uint8Array): string | null {
  const seg = findJpegSegment(jpeg, 0xe1, JPEG_APP_IDS.XMP);
  if (!seg) return null;
  const body = jpegSegmentBody(jpeg, seg);
  return new TextDecoder().decode(body.subarray(JPEG_APP_IDS.XMP.length + 1));
}

function isoPayloadOf(jpeg: Uint8Array): Uint8Array | null {
  const seg = findJpegSegment(jpeg, 0xe2, ISO_GAINMAP_URN);
  if (!seg) return null;
  return jpegSegmentBody(jpeg, seg).subarray(ISO_GAINMAP_URN.length + 1);
}

/** Split an assembled file at the primary's EOI. */
function split(file: Uint8Array): { primary: Uint8Array; map: Uint8Array } {
  const scan = scanJpegSegments(file);
  assert.ok(scan, 'assembled file is a JPEG');
  assert.ok(scan.trailerStart !== null, 'assembled file has a post-EOI trailer');
  return { primary: file.subarray(0, scan.trailerStart!), map: file.subarray(scan.trailerStart!) };
}

// ── tests ────────────────────────────────────────────────────────────────────

test('the fixtures are ordinary JPEGs with no APP0 and no trailer', () => {
  for (const [name, b] of [['base', BASE], ['map', MAP]] as const) {
    const scan = scanJpegSegments(b)!;
    assert.ok(scan, `${name} is a JPEG`);
    assert.equal(scan.truncated, false, `${name} reaches EOI`);
    assert.equal(scan.trailerStart, null, `${name} has no trailer`);
    assert.equal(scan.segments.some(s => s.marker === 0xe0), false, `${name} has no APP0 (libjpeg-turbo output)`);
  }
});

test('assembled file: structure, and the base survives byte for byte', () => {
  const out = assembleGainMapJpeg(BASE, MAP, META);
  const { primary, map } = split(out);

  // The gain-map image is a complete JPEG of its own.
  assert.equal(map[0], 0xff);
  assert.equal(map[1], 0xd8);
  const mapScan = scanJpegSegments(map)!;
  assert.equal(mapScan.truncated, false, 'the appended image reaches its own EOI');

  // Removing exactly the two segments we added to the primary must restore the
  // original base bytes - that is what makes the SDR fallback perfect.
  const xmp = findJpegSegment(primary, 0xe1, JPEG_APP_IDS.XMP)!;
  const mpf = findJpegSegment(primary, 0xe2, 'MPF')!;
  assert.ok(xmp && mpf, 'primary carries the XMP and MPF segments');
  assert.ok(xmp.end <= mpf.start, 'XMP precedes MPF');
  const stripped = new Uint8Array([
    ...primary.subarray(0, xmp.start),
    ...primary.subarray(xmp.end, mpf.start),
    ...primary.subarray(mpf.end),
  ]);
  assert.deepEqual(stripped, BASE, 'primary minus our two segments == the input base JPEG');

  // Likewise the gain-map image minus its two metadata segments.
  const mxmp = findJpegSegment(map, 0xe1, JPEG_APP_IDS.XMP)!;
  const miso = findJpegSegment(map, 0xe2, ISO_GAINMAP_URN)!;
  const mStripped = new Uint8Array([
    ...map.subarray(0, mxmp.start),
    ...map.subarray(mxmp.end, miso.start),
    ...map.subarray(miso.end),
  ]);
  assert.deepEqual(mStripped, MAP, 'gain-map image minus its metadata == the input map JPEG');
});

test('MPF index parses back with the right image count, sizes and offsets', () => {
  const out = assembleGainMapJpeg(BASE, MAP, META);
  const { primary, map } = split(out);
  const idx = readMpIndex(out)!;
  assert.ok(idx, 'MPF index found');
  assert.equal(idx.bigEndian, true, 'big-endian MP header, as libultrahdr writes');
  assert.equal(idx.version, '0100');
  assert.equal(idx.numberOfImages, 2);
  assert.equal(idx.uids, null, 'no MPImageUIDList by default');

  const [first, second] = idx.entries;
  // Sizes are the real image lengths, and together they are the whole file.
  assert.equal(first!.size, primary.length);
  assert.equal(second!.size, map.length);
  assert.equal(first!.size + second!.size, out.length);
  // Offsets: DC-007 measures from the MP Endian field, and image 0's is zero.
  assert.equal(first!.offset, 0, 'first image offset is 0 by definition');
  assert.equal(second!.offset, primary.length - idx.mpHeaderAt);
  // And the offset really lands on the second image's SOI.
  const at = idx.mpHeaderAt + second!.offset;
  assert.equal(at, primary.length, 'the offset resolves to the trailer boundary');
  assert.equal(out[at], 0xff);
  assert.equal(out[at + 1], 0xd8, 'the offset points at a SOI');
  // Attributes: primary is "Baseline MP Primary Image" (0x030000), the map is undefined.
  assert.equal(first!.attribute, 0x00030000);
  assert.equal(second!.attribute, 0);
  assert.equal(first!.dep1, 0); assert.equal(second!.dep2, 0);
});

test('MPImageUIDList is written only when the caller supplies real UIDs', () => {
  const uids = ['lolly-primary-0000000000000000000', 'lolly-gainmap-0000000000000000000'];
  const out = assembleGainMapJpeg(BASE, MAP, META, { imageUids: uids });
  const idx = readMpIndex(out)!;
  assert.equal(idx.numberOfImages, 2);
  assert.ok(idx.uids, 'UID list present');
  assert.equal(idx.uids!.length, 2);
  assert.equal(new TextDecoder().decode(idx.uids![0]!), uids[0]!.slice(0, 33));
  // Offsets must still be right with the extra tag widening the segment.
  const { primary } = split(out);
  assert.equal(idx.entries[1]!.offset, primary.length - idx.mpHeaderAt);
  assert.equal(idx.entries[0]!.size + idx.entries[1]!.size, out.length);
});

test('primary XMP is a well-formed GContainer directory naming the gain map', () => {
  const out = assembleGainMapJpeg(BASE, MAP, META);
  const { primary, map } = split(out);
  const packet = xmpPacketOf(primary)!;
  assert.ok(packet, 'primary carries an XMP packet');
  assertWellFormedXmp(packet);
  assert.match(packet, /xmlns:Container="http:\/\/ns\.google\.com\/photos\/1\.0\/container\/"/);
  assert.match(packet, /Item:Semantic="Primary"/);
  assert.match(packet, /Item:Semantic="GainMap"/);
  assert.equal(xmpAttrs(packet, 'hdrgm').Version, '1.0');
  const len = /Item:Semantic="GainMap"[^>]*Item:Length="(\d+)"/.exec(packet);
  assert.ok(len, 'the GainMap item declares a length');
  assert.equal(Number(len![1]), map.length, 'Item:Length == the appended image length');
});

test('gain-map XMP carries the hdrgm fields, matching the metadata exactly', () => {
  const meta: GainMapMeta = { ...META, gainMapMin: -0.125, gainMapMax: 3.25, gamma: 1.5, offsetSdr: 0.015625, offsetHdr: 0.03125, hdrCapacityMin: 0.5, hdrCapacityMax: 3.25 };
  const out = assembleGainMapJpeg(BASE, MAP, meta);
  const { map } = split(out);
  const packet = xmpPacketOf(map)!;
  assertWellFormedXmp(packet);
  const a = xmpAttrs(packet, 'hdrgm');
  assert.equal(a.Version, '1.0');
  assert.equal(a.BaseRenditionIsHDR, 'False');
  assert.equal(Number(a.GainMapMin), meta.gainMapMin);
  assert.equal(Number(a.GainMapMax), meta.gainMapMax);
  assert.equal(Number(a.Gamma), meta.gamma);
  assert.equal(Number(a.OffsetSDR), meta.offsetSdr);
  assert.equal(Number(a.OffsetHDR), meta.offsetHdr);
  assert.equal(Number(a.HDRCapacityMin), meta.hdrCapacityMin);
  assert.equal(Number(a.HDRCapacityMax), meta.hdrCapacityMax);
  // The primary must NOT carry the gain-map fields (they belong to the map image).
  const primaryPacket = xmpPacketOf(split(out).primary)!;
  assert.equal(xmpAttrs(primaryPacket, 'hdrgm').GainMapMax, undefined);
});

test('ISO 21496-1 metadata parses back to the same numbers as the XMP', () => {
  const meta: GainMapMeta = { ...META, gainMapMin: -0.125, gainMapMax: 3.25, gamma: 1.5, offsetSdr: 0.015625, offsetHdr: 0.03125, hdrCapacityMin: 0.5, hdrCapacityMax: 3.25 };
  const out = assembleGainMapJpeg(BASE, MAP, meta);
  const { map, primary } = split(out);
  assert.equal(isoPayloadOf(primary), null, 'the ISO metadata lives in the gain-map image, not the primary');
  const payload = isoPayloadOf(map)!;
  assert.ok(payload, 'gain-map image carries the ISO 21496-1 APP2');
  assert.equal(payload.length, 61, 'single-channel GainMapMetadata is 61 bytes');
  const iso = readIsoGainMap(payload);
  assert.equal(iso.minimumVersion, 0);
  assert.equal(iso.writerVersion, 0);
  assert.equal(iso.isMultiChannel, false, 'channels: 1 -> flag clear');
  assert.equal(iso.useBaseColourSpace, true);
  assert.equal(iso.baseHeadroom, meta.hdrCapacityMin);
  assert.equal(iso.alternateHeadroom, meta.hdrCapacityMax);
  assert.equal(iso.channels.length, 1);
  const c = iso.channels[0]!;
  // The two metadata forms are two spellings of ONE fit, to 6 decimals.
  assert.equal(c.min, meta.gainMapMin);
  assert.equal(c.max, meta.gainMapMax);
  assert.equal(c.gamma, meta.gamma);
  assert.equal(c.baseOffset, meta.offsetSdr);
  assert.equal(c.alternateOffset, meta.offsetHdr);
});

test('ISO rationals: integers stay exact, fractions round-trip to 6 decimals', () => {
  const p = buildIsoGainMapMetadata({ ...META, gamma: 1, gainMapMin: 0, gainMapMax: 4, hdrCapacityMax: 4 });
  const dv = new DataView(p.buffer, p.byteOffset, p.byteLength);
  assert.equal(dv.getUint32(5 + 8), 4, 'alternate headroom numerator');
  assert.equal(dv.getUint32(5 + 12), 1, 'integer values use denominator 1');
  const q = buildIsoGainMapMetadata({ ...META, gainMapMin: -0.3333333333 });
  const r = readIsoGainMap(q);
  assert.ok(Math.abs(r.channels[0]!.min - -0.3333333333) < 1e-6, 'fraction within 1e-6');
  assert.ok(r.channels[0]!.min < 0, 'signed numerator stayed negative');
});

test('use_base_colour_space and multichannel flags follow the metadata', () => {
  const off = readIsoGainMap(buildIsoGainMapMetadata({ ...META, useBaseColorSpace: false }));
  assert.equal(off.useBaseColourSpace, false);
  const on = readIsoGainMap(buildIsoGainMapMetadata({ ...META, useBaseColorSpace: true }));
  assert.equal(on.useBaseColourSpace, true);
  assert.equal(on.isMultiChannel, false);
});

test('byte-determinism across two runs', () => {
  const a = assembleGainMapJpeg(BASE, MAP, META);
  const b = assembleGainMapJpeg(BASE, MAP, META);
  assert.deepEqual(a, b, 'same inputs -> byte-identical file');
  const c = assembleGainMapJpeg(BASE, MAP, { ...META, gainMapMax: 2.75 });
  assert.notDeepEqual(a, c, 'different metadata -> different bytes');
});

test('negative control: a plain JPEG is left completely alone', () => {
  // repairMpfOffsets is the one function a non-gain-map file can reach (a C2PA
  // stamp path would call it on everything). It must be a no-op there.
  assert.deepEqual(repairMpfOffsets(BASE), BASE);
  assert.deepEqual(repairMpfOffsets(MAP), MAP);
  assert.deepEqual(repairMpfOffsets(new Uint8Array([1, 2, 3])), new Uint8Array([1, 2, 3]));
  assert.deepEqual(repairMpfOffsets(new Uint8Array(0)), new Uint8Array(0));
  // A JPEG with a trailer that is NOT a JPEG is not an MPF file either.
  const withJunk = new Uint8Array([...BASE, 1, 2, 3, 4]);
  assert.deepEqual(repairMpfOffsets(withJunk), withJunk);
});

test('repairMpfOffsets fixes a file whose primary grew after assembly (the C2PA case)', () => {
  const out = assembleGainMapJpeg(BASE, MAP, META);
  const before = readMpIndex(out)!;
  const { primary, map } = split(out);

  // Simulate a C2PA APP11 JUMBF store spliced into the primary AFTER assembly:
  // it ranks after MPF, so the second image moves and MPF's offset goes stale.
  const jumbf = buildJpegSegment(0xeb, new Uint8Array([0x4a, 0x50, ...new Uint8Array(64)]))!;
  const grown = insertJpegSegments(primary, [jumbf]);
  assert.ok(grown.length > primary.length, 'the primary really grew');
  const broken = new Uint8Array([...grown, ...map]);

  const stale = readMpIndex(broken)!;
  assert.equal(stale.entries[1]!.offset, before.entries[1]!.offset, 'the recorded offset did not move with the image');
  assert.notEqual(stale.mpHeaderAt + stale.entries[1]!.offset, grown.length, 'so it no longer points at the second image');

  const fixed = repairMpfOffsets(broken);
  const idx = readMpIndex(fixed)!;
  assert.equal(idx.mpHeaderAt + idx.entries[1]!.offset, grown.length, 'repaired offset lands on the trailer');
  assert.equal(fixed[grown.length], 0xff);
  assert.equal(fixed[grown.length + 1], 0xd8, 'and that is a SOI');
  assert.equal(idx.entries[0]!.size, grown.length);
  assert.equal(idx.entries[1]!.size, map.length);
  assert.deepEqual(repairMpfOffsets(fixed), fixed, 'idempotent');
  // Repair copies: the broken input is untouched.
  assert.notEqual(readMpIndex(broken)!.entries[1]!.offset, idx.entries[1]!.offset);
});

test('refusals are loud: bad inputs throw rather than emit a broken file', () => {
  const notJpeg = new Uint8Array([0, 1, 2, 3, 4, 5]);
  assert.throws(() => assembleGainMapJpeg(notJpeg, MAP, META), /base image is not a JPEG/);
  assert.throws(() => assembleGainMapJpeg(BASE, notJpeg, META), /gain-map image is not a JPEG/);
  // Truncated (no EOI) on either side.
  assert.throws(() => assembleGainMapJpeg(BASE.subarray(0, BASE.length - 8), MAP, META), /truncated/);
  assert.throws(() => assembleGainMapJpeg(BASE, MAP.subarray(0, MAP.length - 8), META), /truncated/);
  // Assembling twice would nest multi-picture files.
  const once = assembleGainMapJpeg(BASE, MAP, META);
  assert.throws(() => assembleGainMapJpeg(once, MAP, META), /already has a post-EOI trailer/);
  assert.throws(() => assembleGainMapJpeg(BASE, MAP, META, { imageUids: ['only-one'] }), /exactly 2 entries/);
});

test('an oversized XMP packet REFUSES instead of silently truncating', () => {
  const huge = `${'x'.repeat(XMP_APP1_MAX + 1)}`;
  assert.throws(() => buildXmpApp1(huge), /extended-XMP GUID chain is not implemented/);
  // One byte under the limit still fits.
  const ok = buildXmpApp1('y'.repeat(XMP_APP1_MAX));
  assert.equal(ok.length, 0xffff + 2);
  assert.equal(ok[1], 0xe1);
  // And the packets we actually write are nowhere near it.
  assert.ok(buildPrimaryXmp(123456).length < 2000);
  assert.ok(buildGainMapXmp(META).length < 2000);
});

test('non-finite metadata degrades to zeros rather than emitting NaN', () => {
  const bad: GainMapMeta = { ...META, gainMapMin: Number.NaN, gainMapMax: Number.POSITIVE_INFINITY, gamma: Number.NaN };
  const packet = buildGainMapXmp(bad);
  assert.equal(packet.includes('NaN'), false);
  assert.equal(packet.includes('Infinity'), false);
  assertWellFormedXmp(packet);
  const iso = readIsoGainMap(buildIsoGainMapMetadata(bad));
  assert.equal(iso.channels[0]!.min, 0);
  assert.equal(iso.channels[0]!.max, 0);
});

test('sharp decodes the finished file to EXACTLY the base SDR image', { skip: SKIP_SHARP }, async () => {
  // The perfect-fallback proof. sharp/libvips knows nothing about gain maps - 
  // that is the point: it must see the ordinary SDR JPEG and nothing else.
  const out = assembleGainMapJpeg(BASE, MAP, META);
  const decoded = await sharp!(Buffer.from(out)).raw().toBuffer();
  const reference = await sharp!(Buffer.from(BASE)).raw().toBuffer();
  assert.deepEqual(new Uint8Array(decoded), new Uint8Array(reference), 'assembled file decodes to the base image, pixel for pixel');
  const meta = await sharp!(Buffer.from(out)).metadata();
  assert.equal(meta.width, 8);
  assert.equal(meta.height, 8);
  // And the gain-map image, pulled out of the trailer, is a decodable JPEG too.
  const { map } = split(out);
  const mapDecoded = await sharp!(Buffer.from(map)).raw().toBuffer();
  const mapReference = await sharp!(Buffer.from(MAP)).raw().toBuffer();
  assert.deepEqual(new Uint8Array(mapDecoded), new Uint8Array(mapReference));
});
