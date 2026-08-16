// SPDX-License-Identifier: MPL-2.0
/**
 * C2PA stamping of a gain-map (Ultra HDR / ISO 21496-1) JPEG.
 *
 * plans/61-deeprichpixels.md §6 B2, task E1. A gain-map JPEG is TWO JPEGs in one
 * file, and the primary carries an MPF (CIPA DC-007) index whose MP Entries
 * record the byte SIZE of the primary image and the byte OFFSET of the second.
 * `c2pa-containers.ts#placeJpeg` splices its APP11 JUMBF store in after the LAST
 * APP0 - which is BEFORE the MPF segment and before everything the index
 * measures. Stamping therefore grows image 1 without the index noticing, and the
 * file ends up claiming a primary that is `block.length` bytes shorter than it
 * is: a structurally invalid MPF index, in a file that still opens fine
 * everywhere, which is exactly the failure mode that silently loses the HDR
 * rendition.
 *
 * Everything below is read back OUT of the produced bytes by an MPF/TIFF walker
 * written in this file against DC-007, never trusted from the writer. The
 * `naive splice` test is the permanent negative control: it reproduces the
 * pre-fix behaviour byte for byte and asserts the corruption, so the guard
 * cannot rot into a tautology. Where `sharp` is installed it is the external
 * witness that the SDR fallback survives stamping untouched.
 *
 * Run: node --test tests/c2pa-gainmap.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { attachC2paStore, embedC2pa } from '../engine/src/c2pa.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';
import { assembleGainMapJpeg } from '../engine/src/gainmap-jpeg.ts';
import type { GainMapMeta } from '../engine/src/gainmap.ts';
import {
  buildJpegSegment,
  findJpegSegment,
  findJpegSegments,
  JPEG_APP_IDS,
  jpegSegmentBody,
  insertJpegSegments,
  scanJpegSegments,
} from '../engine/src/jpeg-segments.ts';

// ── fixtures ─────────────────────────────────────────────────────────────────
// Two real 8x8 JPEGs (libjpeg-turbo via sharp; no APP0/JFIF), the same bytes
// tests/gainmap-jpeg.test.ts uses so both suites talk about one file shape.
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

const BASE_NO_APP0 = new Uint8Array(Buffer.from(BASE_JPEG_B64, 'base64'));
const MAP = new Uint8Array(Buffer.from(MAP_JPEG_B64, 'base64'));

// The realistic shell input: a canvas-encoded JPEG DOES carry a JFIF APP0, and
// APP0 is precisely what placeJpeg anchors its insertion to. Both shapes are
// exercised (see the parameterised round-trip test).
const JFIF_APP0 = buildJpegSegment(
  0xe0,
  Uint8Array.of(0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0),
)!;
const BASE_APP0 = insertJpegSegments(BASE_NO_APP0, [JFIF_APP0]);

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

const OPTS = {
  title: 'Gain-map fixture',
  claimGenerator: 'Lolly lolly.tools',
  generatorInfo: { name: 'Lolly', version: '1.9.0' },
  environment: { tool: 'Fixture Tool', format: 'jpg', surface: 'test', engine: 'node', os: 'test' },
  author: { name: 'Testy McTestface' },
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

// ── this file's own MPF reader (CIPA DC-007 §5.2.3) ──────────────────────────

interface MpEntry { attribute: number; size: number; offset: number }
interface MpIndex {
  /** Absolute offset of the MP Endian field - the origin every MPF offset is measured from. */
  headerAt: number;
  numberOfImages: number;
  entries: MpEntry[];
}

function readMpIndex(jpeg: Uint8Array): MpIndex | null {
  const seg = findJpegSegment(jpeg, 0xe2, JPEG_APP_IDS.MPF);
  if (!seg) return null;
  const h = seg.start + 4 + 4; // marker+length(4) + "MPF\0"(4)
  const dv = new DataView(jpeg.buffer, jpeg.byteOffset, jpeg.byteLength);
  const be = dv.getUint16(h) === 0x4d4d;
  const u16 = (o: number): number => dv.getUint16(o, !be);
  const u32 = (o: number): number => dv.getUint32(o, !be);
  assert.equal(u16(h + 2), 0x002a, 'MPF payload is a TIFF stream');
  const ifd = h + u32(h + 4);
  const count = u16(ifd);
  let numberOfImages = 0;
  let entriesAt = -1;
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    const tag = u16(e);
    if (tag === 0xb001) numberOfImages = u32(e + 8);
    if (tag === 0xb002) entriesAt = h + u32(e + 8);
  }
  assert.ok(entriesAt > 0, 'MPEntry tag 0xB002 present');
  const entries: MpEntry[] = [];
  for (let i = 0; i < numberOfImages; i++) {
    const at = entriesAt + i * 16;
    entries.push({ attribute: u32(at), size: u32(at + 4), offset: u32(at + 8) });
  }
  return { headerAt: h, numberOfImages, entries };
}

/** Absolute [start, end) of image i as the MPF index itself claims it is. */
function imageRangeFromMpf(idx: MpIndex, i: number, primaryStart = 0): { start: number; end: number } {
  const e = idx.entries[i]!;
  const start = i === 0 ? primaryStart : idx.headerAt + e.offset;
  return { start, end: start + e.size };
}

/** Where the appended second image actually begins (first byte past the primary's EOI). */
function trailerStartOf(jpeg: Uint8Array): number {
  const scan = scanJpegSegments(jpeg);
  assert.ok(scan && scan.trailerStart !== null, 'file has a post-EOI trailer');
  return scan!.trailerStart!;
}

/** The contiguous APP11 JUMBF block placeJpeg inserted, as [start, end). */
function jumbfBlockOf(jpeg: Uint8Array): { start: number; end: number } {
  const segs = findJpegSegments(jpeg, 0xeb, JPEG_APP_IDS.JUMBF);
  assert.ok(segs.length > 0, 'stamped file carries APP11 JUMBF segments');
  return { start: segs[0]!.start, end: segs[segs.length - 1]!.end };
}

/** Assert an MPF index describes the file it is in. Returns the read index. */
function assertMpfDescribes(jpeg: Uint8Array, note: string): MpIndex {
  const idx = readMpIndex(jpeg);
  assert.ok(idx, `${note}: MPF index present`);
  assert.equal(idx!.numberOfImages, 2, `${note}: two images`);
  const trailer = trailerStartOf(jpeg);
  const primary = imageRangeFromMpf(idx!, 0);
  const second = imageRangeFromMpf(idx!, 1);
  assert.equal(idx!.entries[0]!.offset, 0, `${note}: MPEntry[0].offset is 0 by DC-007`);
  assert.equal(primary.end, trailer, `${note}: MPEntry[0].size covers the whole primary image`);
  assert.equal(second.start, trailer, `${note}: MPEntry[1].offset points at the second SOI`);
  assert.equal(second.end, jpeg.length, `${note}: MPEntry[1].size covers the rest of the file`);
  assert.equal(jpeg[second.start], 0xff, `${note}: second image starts with FF`);
  assert.equal(jpeg[second.start + 1], 0xd8, `${note}: second image starts with SOI`);
  return idx!;
}

const gainMapFile = (base: Uint8Array = BASE_APP0): Uint8Array => assembleGainMapJpeg(base, MAP, META);

/**
 * Rewrite an assembled file's MPF index into little-endian ('II') form, byte for
 * byte, so the repair path can be exercised against the foreign layout our own
 * writer never emits. Only the TIFF stream inside the MPF segment is touched.
 */
function toLittleEndianMpf(src: Uint8Array): Uint8Array {
  const out = src.slice();
  const seg = findJpegSegment(out, 0xe2, JPEG_APP_IDS.MPF)!;
  const h = seg.start + 8;                       // past marker+length+"MPF\0"
  const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const ifdOff = dv.getUint32(h + 4);            // still big-endian here
  const ifd = h + ifdOff;
  const count = dv.getUint16(ifd);
  // Collect the BE values first, then rewrite the whole stream as LE.
  const tags = Array.from({ length: count }, (_, i) => {
    const e = ifd + 2 + i * 12;
    return { e, tag: dv.getUint16(e), type: dv.getUint16(e + 2), n: dv.getUint32(e + 4), val: dv.getUint32(e + 8) };
  });
  const entriesAt = h + tags.find(t => t.tag === 0xb002)!.val;
  const nImages = tags.find(t => t.tag === 0xb001)!.val;
  const entries = Array.from({ length: nImages }, (_, i) => {
    const at = entriesAt + i * 16;
    return { at, attr: dv.getUint32(at), size: dv.getUint32(at + 4), off: dv.getUint32(at + 8), dep: dv.getUint32(at + 12) };
  });
  dv.setUint16(h, 0x4949);                       // 'II'
  dv.setUint16(h + 2, 0x002a, true);
  dv.setUint32(h + 4, ifdOff, true);
  dv.setUint16(ifd, count, true);
  for (const t of tags) {
    dv.setUint16(t.e, t.tag, true);
    dv.setUint16(t.e + 2, t.type, true);
    dv.setUint32(t.e + 4, t.n, true);
    dv.setUint32(t.e + 8, t.val, true);
  }
  for (const en of entries) {
    dv.setUint32(en.at, en.attr, true);
    dv.setUint32(en.at + 4, en.size, true);
    dv.setUint32(en.at + 8, en.off, true);
    dv.setUint32(en.at + 12, en.dep, true);
  }
  return out;
}

// ── the fixture itself is sound before anything stamps it ────────────────────

test('the unstamped gain-map fixture has a valid MPF index', () => {
  const file = gainMapFile();
  const idx = assertMpfDescribes(file, 'unstamped');
  // Primary + gain map account for every byte, exactly once.
  assert.equal(idx.entries[0]!.size + idx.entries[1]!.size, file.length);
});

// ── the defect, pinned ───────────────────────────────────────────────────────

test('negative control: a naive splice (the pre-fix placeJpeg) corrupts the MPF index', () => {
  const file = gainMapFile();
  const before = readMpIndex(file)!;
  const stamped = attachC2paStore(file, 'jpg', new Uint8Array(4096).fill(7));
  const block = jumbfBlockOf(stamped);
  const delta = block.end - block.start;

  // Reproduce the old behaviour exactly: the same insertion, MPF left alone.
  const naive = new Uint8Array(file.length + delta);
  naive.set(file.subarray(0, block.start), 0);
  naive.set(stamped.subarray(block.start, block.end), block.start);
  naive.set(file.subarray(block.start), block.end);
  assert.deepEqual(naive.length, stamped.length, 'same length as the real placer');

  const after = readMpIndex(naive)!;
  const trailer = trailerStartOf(naive);
  // The APP11 goes in ahead of the MPF segment, so the index shifted with the
  // thing it is embedded in but its recorded sizes did not grow.
  assert.equal(after.entries[0]!.size, before.entries[0]!.size, 'MPEntry[0].size unchanged by the splice');
  assert.notEqual(after.entries[0]!.size, trailer, 'and so no longer covers the primary');
  assert.equal(trailer - after.entries[0]!.size, delta, 'it under-reports by exactly the inserted block');
  // MPEntry[1].offset is measured FROM the MP Endian field, and both the MPF
  // segment and the trailer moved by the same delta, so the offset survives - 
  // the size field is the one that goes wrong, and one wrong field is enough to
  // make the index invalid.
  assert.equal(imageRangeFromMpf(after, 1).start, trailer, 'MPEntry[1].offset is delta-invariant');
  assert.notEqual(imageRangeFromMpf(after, 0).end, trailer, 'the naive file fails the structural check');
});

// ── the fix ──────────────────────────────────────────────────────────────────

for (const [name, base] of [['with JFIF APP0', BASE_APP0], ['without APP0', BASE_NO_APP0]] as Array<[string, Uint8Array]>) {
  test(`stamping a gain-map JPEG (${name}) keeps the MPF index valid`, async () => {
    const file = gainMapFile(base);
    const out = await embedC2pa(file, 'jpg', OPTS);
    const block = jumbfBlockOf(out);
    assert.ok(block.start < findJpegSegment(out, 0xe2, JPEG_APP_IDS.MPF)!.start, 'APP11 lands ahead of MPF (the risk)');
    const idx = assertMpfDescribes(out, `stamped ${name}`);
    assert.equal(idx.entries[0]!.size + idx.entries[1]!.size, out.length, 'the two images account for the file');
    assert.equal(idx.entries[0]!.size - readMpIndex(file)!.entries[0]!.size, block.end - block.start,
      'MPEntry[0].size grew by exactly the inserted block');
  });
}

test('a stamped gain-map JPEG still verifies, and the gain map is still findable', async () => {
  const file = gainMapFile();
  const out = await embedC2pa(file, 'jpg', OPTS);
  const report = await verifyC2pa(out);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks.filter(c => !c.ok)));
  assert.equal(report.madeWithLolly, true);

  // Follow the MPF index the way a decoder does, and check what it lands on.
  const idx = readMpIndex(out)!;
  const r = imageRangeFromMpf(idx, 1);
  const map = out.subarray(r.start, r.end);
  const mapScan = scanJpegSegments(map);
  assert.ok(mapScan && !mapScan.truncated, 'the indexed second image is a complete JPEG');
  const xmp = findJpegSegment(map, 0xe1, JPEG_APP_IDS.XMP);
  assert.ok(xmp, 'gain map keeps its hdrgm XMP');
  assert.match(new TextDecoder().decode(jpegSegmentBody(map, xmp!)), /hdrgm:GainMapMax="2\.5"/);
  assert.ok(findJpegSegment(map, 0xe2, 'urn:iso:std:iso:ts:21496:-1'), 'gain map keeps its ISO 21496-1 box');
});

test('the hard binding covers the appended gain map: tampering image 2 invalidates it', async () => {
  const file = gainMapFile();
  const out = await embedC2pa(file, 'jpg', OPTS);
  assert.equal((await verifyC2pa(out)).state, 'valid');

  const idx = readMpIndex(out)!;
  const r = imageRangeFromMpf(idx, 1);
  // A byte inside the gain map's entropy-coded data - past its last segment, so
  // unambiguously image-2 CONTENT, not metadata.
  const mapScan = scanJpegSegments(out.subarray(r.start, r.end))!;
  const target = r.start + mapScan.sos! + 8;
  assert.ok(target > r.start && target < r.end, 'tamper target is inside image 2');
  const tampered = out.slice();
  tampered[target] = tampered[target]! ^ 0x01;
  const broken = await verifyC2pa(tampered);
  assert.equal(broken.state, 'invalid', 'gain-map bytes are inside the hard binding');
  assert.ok(broken.checks.some(c => c.code === 'assertion.dataHash.mismatch' && !c.ok), JSON.stringify(broken.checks));
});

test('a multi-segment manifest (>64000 bytes) patches by the whole block, not one segment', async () => {
  const file = gainMapFile();
  const out = await embedC2pa(file, 'jpg', { ...OPTS, environment: { ...OPTS.environment, blob: 'x'.repeat(70000) } });
  assert.ok(findJpegSegments(out, 0xeb, JPEG_APP_IDS.JUMBF).length > 1, 'store really did split');
  assertMpfDescribes(out, 'multi-segment');
  assert.equal((await verifyC2pa(out)).state, 'valid');
});

test('re-stamping a gain-map JPEG replaces the store and leaves the index valid', async () => {
  const file = gainMapFile();
  const once = await embedC2pa(file, 'jpg', OPTS);
  const twice = await embedC2pa(once, 'jpg', { ...OPTS, title: 'Second pass' });
  assertMpfDescribes(twice, 're-stamped');
  const report = await verifyC2pa(twice);
  assert.equal(report.state, 'valid', JSON.stringify(report.checks.filter(c => !c.ok)));
  assert.equal(report.claim?.title, 'Second pass');
});

// ── non-MPF files must be untouched ──────────────────────────────────────────

test('an ordinary JPEG is spliced byte-identically (the fix is inert without MPF)', () => {
  for (const [name, fixture] of [['no APP0', BASE_NO_APP0], ['JFIF APP0', BASE_APP0]] as Array<[string, Uint8Array]>) {
    const store = new Uint8Array(3000).fill(0x5a);
    const out = attachC2paStore(fixture, 'jpg', store);
    const block = jumbfBlockOf(out);
    const stripped = new Uint8Array(out.length - (block.end - block.start));
    stripped.set(out.subarray(0, block.start), 0);
    stripped.set(out.subarray(block.end), block.start);
    assert.deepEqual(stripped, fixture, `${name}: removing the APP11 block returns the original file`);
  }
});

test('a JPEG with a non-JPEG trailer, and one with MPF but no trailer, are left alone', () => {
  // Trailer that is not a SOI: nothing to index, so nothing may be rewritten.
  const junk = new Uint8Array(BASE_NO_APP0.length + 5);
  junk.set(BASE_NO_APP0, 0);
  junk.set(Uint8Array.of(1, 2, 3, 4, 5), BASE_NO_APP0.length);
  const out = attachC2paStore(junk, 'jpg', new Uint8Array(64).fill(9));
  const block = jumbfBlockOf(out);
  const stripped = new Uint8Array(out.length - (block.end - block.start));
  stripped.set(out.subarray(0, block.start), 0);
  stripped.set(out.subarray(block.end), block.start);
  assert.deepEqual(stripped, junk, 'non-JPEG trailer: byte-identical splice');

  // An MPF index with no second image (the primary alone) must not be rewritten
  // into claiming a trailer that does not exist.
  const single = gainMapFile();
  const trailer = trailerStartOf(single);
  const primaryOnly = single.subarray(0, trailer);
  const beforeIdx = readMpIndex(primaryOnly)!;
  const stampedSingle = attachC2paStore(primaryOnly, 'jpg', new Uint8Array(64).fill(9));
  const afterIdx = readMpIndex(stampedSingle)!;
  assert.deepEqual(afterIdx.entries, beforeIdx.entries, 'MPF entries untouched when there is no second image');
});

// ── adversarial-review regressions (2026-07-31) ─────────────────────────────

// patchMpfEntries used to bail on any index that was not 'MM', so a FOREIGN
// little-endian multi-picture JPEG (libjpeg writers emit II) kept the exact
// MPEntry[0].size corruption this whole fix exists to prevent.
test('a little-endian (II) MPF index is repaired too, not silently skipped', () => {
  const be = gainMapFile();
  const le = toLittleEndianMpf(be);
  const before = readMpIndex(le)!;
  assert.equal(before.entries.length, 2, 'the flipped fixture still parses as 2 images');
  const stamped = attachC2paStore(le, 'jpg', new Uint8Array(2048).fill(0x5a));
  const after = readMpIndex(stamped)!;
  const primaryLen = trailerStartOf(stamped);
  assert.equal(after.entries[0]!.size, primaryLen,
    'II index: MPEntry[0].size must cover the stamped primary, not the pre-stamp one');
  assert.ok(after.entries[0]!.size > before.entries[0]!.size, 'the size actually grew');
});

// patchMpfEntries bounded its writes to the FILE, not to the MPF segment, so a
// forged MPEntry offset could steer 16 bytes per image anywhere in a JPEG - on
// the path that runs over user uploads and then C2PA-signs the result.
test('a forged MPEntry offset cannot steer writes outside the MPF segment', () => {
  const file = gainMapFile();
  const seg = findJpegSegment(file, 0xe2, JPEG_APP_IDS.MPF)!;
  const h = seg.start + 8;
  const dv = new DataView(file.buffer, file.byteOffset, file.byteLength);
  // Point tag 0xB002's value at the far end of the file (inside the second
  // image's entropy data) instead of at the entry table inside the segment.
  const ifd = h + dv.getUint32(h + 4);
  const count = dv.getUint16(ifd);
  let patched = false;
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    if (dv.getUint16(e) === 0xb002) { dv.setUint32(e + 8, file.length - h - 40); patched = true; }
  }
  assert.ok(patched, 'fixture carries an MPEntry tag to forge');
  const victim = file.slice(file.length - 40);
  const out = attachC2paStore(file, 'jpg', new Uint8Array(64).fill(9));
  assert.deepEqual(out.slice(out.length - 40), victim,
    'bytes outside the MPF segment must be untouched by the repair');
});

// ── external oracle: the SDR fallback survives stamping ──────────────────────

test('sharp still decodes a stamped gain-map JPEG to exactly the base SDR image', { skip: SKIP_SHARP }, async () => {
  const file = gainMapFile();
  const out = await embedC2pa(file, 'jpg', OPTS);
  const decoded = await sharp!(Buffer.from(out)).raw().toBuffer();
  const reference = await sharp!(Buffer.from(BASE_APP0)).raw().toBuffer();
  assert.deepEqual(new Uint8Array(decoded), new Uint8Array(reference), 'C2PA + MPF + XMP changed no pixel');
  const meta = await sharp!(Buffer.from(out)).metadata();
  assert.equal(meta.width, 8);
  assert.equal(meta.height, 8);
});
