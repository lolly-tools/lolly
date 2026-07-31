// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/jpeg-segments.ts — the one shared JPEG marker walker/writer
 * (plans/deeprichpixels.md §6 Phase B2, task F2).
 *
 * Three independent kinds of evidence, because this module both READS hostile
 * files and WRITES bytes a decoder has to keep accepting:
 *
 *  1. REAL FILES. `sharp` (libvips → libjpeg-turbo) encodes the fixtures —
 *     baseline, progressive, with EXIF, with an ICC profile — so the scanner is
 *     exercised against segment layouts a browser or camera actually produces
 *     rather than ones this test invented. Skipped with a reason where sharp is
 *     absent (the `tests/png.test.ts` pattern), and every scanner claim is ALSO
 *     asserted against hand-built fixtures so a plain clone still proves it.
 *  2. AN EXTERNAL DECODER AS ORACLE. sharp decodes the spliced file and must
 *     return pixels identical to the original's. Metadata insertion that a real
 *     decoder chokes on, or that shifts a pixel, fails here.
 *  3. BYTE-LEVEL ASSERTIONS on the splice itself: exact output length, the
 *     untouched suffix compared byte for byte, and the resulting marker ORDER
 *     — which is the whole reason the module exists (MPF must precede ICC).
 *
 * Plus hostile input: truncation, lengths of 0/1, a length past EOF, no SOS, no
 * EOI, exact 64 KiB boundary lengths, fill-byte runs, and a few hundred seeded
 * mutations of a real JPEG — with a structural invariant (`no segment may end
 * past the buffer`) checked on every single scan, which is what "no over-read"
 * means operationally.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  scanJpegSegments, findJpegSegment, findJpegSegments, jpegSegmentBody,
  buildJpegSegment, insertJpegSegments, jpegSegmentRank, JPEG_APP_IDS,
} from '../engine/src/jpeg-segments.ts';
import type { JpegScan } from '../engine/src/jpeg-segments.ts';

// ── optional external oracle ────────────────────────────────────────────────

interface SharpImage {
  jpeg(opts?: { progressive?: boolean }): SharpImage;
  withMetadata(opts: { icc?: string }): SharpImage;
  withExif(opts: Record<string, Record<string, string>>): SharpImage;
  raw(): SharpImage;
  toBuffer(): Promise<Buffer>;
}
type SharpFactory = (input: Buffer, opts?: { raw: { width: number; height: number; channels: number } }) => SharpImage;

let sharp: SharpFactory | null = null;
try {
  const specifier = 'sharp';
  sharp = ((await import(specifier)) as { default: SharpFactory }).default;
} catch {
  sharp = null;
}
const SKIP_SHARP = sharp ? false : 'sharp is not installed (optional external JPEG encoder/decoder oracle)';

const W = 24, H = 16;
function rawPixels(): Buffer {
  const b = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      b[i] = (x * 10) & 0xff; b[i + 1] = (y * 16) & 0xff; b[i + 2] = 128;
    }
  }
  return b;
}
const RAW_OPTS = { raw: { width: W, height: H, channels: 3 } };

async function realJpeg(kind: 'plain' | 'icc' | 'exif' | 'progressive'): Promise<Uint8Array> {
  const s = sharp!(rawPixels(), RAW_OPTS);
  const withMeta = kind === 'icc' ? s.withMetadata({ icc: 'srgb' })
    : kind === 'exif' ? s.withExif({ IFD0: { Software: 'lolly-test' } })
    : s;
  const buf = await withMeta.jpeg({ progressive: kind === 'progressive' }).toBuffer();
  return new Uint8Array(buf);
}

async function decodePixels(jpeg: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await sharp!(Buffer.from(jpeg)).raw().toBuffer());
}

// ── hand-built fixtures (no sharp needed) ───────────────────────────────────

function bodyOf(id: string, terminator: number, extra: number[] = []): Uint8Array {
  const idb = [...id].map(c => c.charCodeAt(0));
  return Uint8Array.from([...idb, ...new Array<number>(terminator).fill(0), ...extra]);
}
const APP0_JFIF = buildJpegSegment(0xe0, bodyOf('JFIF', 1, [1, 1, 0, 0, 1, 0, 1, 0, 0]))!;
const DQT = buildJpegSegment(0xdb, Uint8Array.from([0, ...new Array<number>(64).fill(16)]))!;
const SOF0 = buildJpegSegment(0xc0, Uint8Array.from([8, 0, H, 0, W, 1, 1, 0x11, 0]))!;
const SOS = buildJpegSegment(0xda, Uint8Array.from([1, 1, 0, 0, 63, 0]))!;
/** Entropy data containing a stuffed FF and a restart marker — both must be walked over, not mistaken for segments. */
const ENTROPY = Uint8Array.from([0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0x78, 0xff, 0x00]);
const EOI = Uint8Array.from([0xff, 0xd9]);

function cat(...parts: Uint8Array[]): Uint8Array {
  const n = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const SOI = Uint8Array.from([0xff, 0xd8]);

/** A structurally valid JPEG marker stream. The entropy data is not real Huffman output — nothing here decodes it. */
function synthJpeg(extra: Uint8Array[] = [], opts: { app0?: boolean; eoi?: boolean; sos?: boolean } = {}): Uint8Array {
  const { app0 = true, eoi = true, sos = true } = opts;
  return cat(
    SOI,
    ...(app0 ? [APP0_JFIF] : []),
    ...extra,
    DQT, SOF0,
    ...(sos ? [SOS, ENTROPY] : []),
    ...(eoi ? [EOI] : []),
  );
}

const EXIF_SEG = buildJpegSegment(0xe1, bodyOf('Exif', 2, [0x49, 0x49, 0x2a, 0x00]))!;
const XMP_SEG = buildJpegSegment(0xe1, bodyOf(JPEG_APP_IDS.XMP, 1, [0x3c, 0x78, 0x3e]))!; // "<x>"
const MPF_SEG = buildJpegSegment(0xe2, bodyOf('MPF', 1, [0x4d, 0x4d, 0x00, 0x2a]))!;
const ICC_SEG = buildJpegSegment(0xe2, bodyOf('ICC_PROFILE', 1, [1, 1, 0xde, 0xad]))!;
const COM_SEG = buildJpegSegment(0xfe, Uint8Array.from([0x68, 0x69]))!;

// ── the structural invariant every scan must satisfy ────────────────────────

function assertNoOverRead(scan: JpegScan | null, bytes: Uint8Array, label: string): void {
  if (!scan) return;
  let prevEnd = 2;
  for (const s of scan.segments) {
    assert.ok(s.start >= 0 && s.end <= bytes.length, `${label}: segment out of bounds`);
    assert.ok(s.end > s.start, `${label}: empty/negative segment`);
    assert.ok(s.start >= prevEnd - 2, `${label}: segments out of order`);
    prevEnd = s.end;
    assert.ok(s.marker >= 0x01 && s.marker <= 0xfe, `${label}: bogus marker`);
    if (s.appId !== null) assert.ok(/^[\x20-\x7e]+$/.test(s.appId), `${label}: non-printable appId`);
  }
  if (scan.eoi !== null) assert.ok(scan.eoi + 2 <= bytes.length, `${label}: EOI past end`);
  if (scan.sos !== null) assert.ok(scan.sos + 2 <= bytes.length, `${label}: SOS past end`);
  if (scan.trailerStart !== null) assert.ok(scan.trailerStart < bytes.length, `${label}: trailer past end`);
}

const markers = (bytes: Uint8Array): number[] => (scanJpegSegments(bytes)?.segments ?? []).map(s => s.marker);
const appOrder = (bytes: Uint8Array): string[] =>
  (scanJpegSegments(bytes)?.segments ?? [])
    .filter(s => s.marker >= 0xe0 && s.marker <= 0xef)
    .map(s => `${s.marker.toString(16)}:${s.appId ?? '-'}`);

// ── 1. scanning ─────────────────────────────────────────────────────────────

test('scan: hand-built JPEG — every segment, SOS, EOI, no trailer', () => {
  const bytes = synthJpeg([EXIF_SEG, ICC_SEG]);
  const scan = scanJpegSegments(bytes)!;
  assertNoOverRead(scan, bytes, 'synth');
  assert.deepEqual(scan.segments.map(s => s.marker), [0xe0, 0xe1, 0xe2, 0xdb, 0xc0, 0xda, 0xd9]);
  assert.deepEqual(scan.segments.map(s => s.appId), ['JFIF', 'Exif', 'ICC_PROFILE', null, null, null, null]);
  assert.equal(scan.truncated, false);
  assert.equal(scan.sos, bytes.length - ENTROPY.length - EOI.length - SOS.length);
  assert.equal(scan.eoi, bytes.length - 2);
  assert.equal(scan.trailerStart, null);
});

test('scan: entropy data with stuffed FF00 and a restart marker is walked, not mis-parsed', () => {
  const bytes = synthJpeg();
  const scan = scanJpegSegments(bytes)!;
  // The FF D0 inside ENTROPY must NOT appear as a segment — only SOS then EOI.
  const after = scan.segments.filter(s => s.start >= scan.sos!);
  assert.deepEqual(after.map(s => s.marker), [0xda, 0xd9]);
  assert.equal(scan.eoi, bytes.length - 2);
});

test('scan: appId identification — Exif/XMP/MPF/ICC, APP11 JUMBF (no NUL), binary payload', () => {
  const jumbf = buildJpegSegment(0xeb, Uint8Array.from([0x4a, 0x50, 0x02, 0x11, 0, 0, 0, 1]))!; // "JP" + En + Z
  const binary = buildJpegSegment(0xe4, Uint8Array.from([0x00, 0x01, 0x02]))!;
  const bytes = synthJpeg([EXIF_SEG, XMP_SEG, MPF_SEG, ICC_SEG, jumbf, binary]);
  assert.equal(findJpegSegment(bytes, 0xe1, 'Exif')!.appId, 'Exif');
  assert.equal(findJpegSegment(bytes, 0xe1, JPEG_APP_IDS.XMP)!.appId, JPEG_APP_IDS.XMP);
  assert.equal(findJpegSegment(bytes, 0xe2, 'MPF')!.appId, 'MPF');
  assert.equal(findJpegSegment(bytes, 0xe2, 'ICC_PROFILE')!.appId, 'ICC_PROFILE');
  assert.equal(findJpegSegment(bytes, 0xeb)!.appId, 'JP'); // stops at the binary En field
  assert.equal(findJpegSegment(bytes, 0xe4)!.appId, null); // no printable prefix at all
  assert.equal(findJpegSegment(bytes, 0xe1, 'nope'), null);
  assert.equal(findJpegSegments(bytes, 0xe1).length, 2);
});

test('scan: segment body excludes the marker+length and includes the id', () => {
  const bytes = synthJpeg([MPF_SEG]);
  const seg = findJpegSegment(bytes, 0xe2, 'MPF')!;
  assert.deepEqual([...jpegSegmentBody(bytes, seg)], [...MPF_SEG.subarray(4)]);
  const eoiSeg = scanJpegSegments(bytes)!.segments.at(-1)!;
  assert.equal(eoiSeg.marker, 0xd9);
  assert.equal(jpegSegmentBody(bytes, eoiSeg).length, 0); // standalone marker: no payload
});

test('scan: fill bytes before a marker code are tolerated', () => {
  const bytes = cat(SOI, Uint8Array.from([0xff, 0xff, 0xff]), APP0_JFIF.subarray(1), DQT, SOF0, SOS, ENTROPY, EOI);
  const scan = scanJpegSegments(bytes)!;
  assertNoOverRead(scan, bytes, 'fill');
  assert.equal(scan.truncated, false);
  assert.deepEqual(scan.segments.map(s => s.marker), [0xe0, 0xdb, 0xc0, 0xda, 0xd9]);
});

test('scan: post-EOI trailer is reported, not swallowed (the MPF second-image case)', () => {
  const base = synthJpeg([MPF_SEG]);
  const second = synthJpeg(); // a whole second JPEG appended after EOI
  const bytes = cat(base, second);
  const scan = scanJpegSegments(bytes)!;
  assertNoOverRead(scan, bytes, 'trailer');
  assert.equal(scan.eoi, base.length - 2);
  assert.equal(scan.trailerStart, base.length);
  assert.equal(scan.truncated, false);
  // The walk stops at the first EOI: the appended image's segments are NOT reported.
  assert.deepEqual(scan.segments.map(s => s.marker), [0xe0, 0xe2, 0xdb, 0xc0, 0xda, 0xd9]);
  assert.deepEqual([...bytes.subarray(scan.trailerStart!)], [...second]);
});

test('scan: real sharp-encoded JPEGs (baseline, progressive, EXIF, ICC)', { skip: SKIP_SHARP }, async () => {
  for (const kind of ['plain', 'icc', 'exif', 'progressive'] as const) {
    const bytes = await realJpeg(kind);
    const scan = scanJpegSegments(bytes)!;
    assert.ok(scan, `${kind}: recognised as JPEG`);
    assertNoOverRead(scan, bytes, kind);
    assert.equal(scan.truncated, false, `${kind}: reached EOI`);
    assert.equal(scan.eoi, bytes.length - 2, `${kind}: EOI is the last marker`);
    assert.equal(scan.trailerStart, null, `${kind}: no trailer`);
    assert.ok(scan.sos !== null, `${kind}: found SOS`);
    const ms = markers(bytes);
    assert.ok(ms.includes(0xdb), `${kind}: DQT`);
    assert.ok(ms.includes(0xc4), `${kind}: DHT`);
    assert.ok(ms.includes(kind === 'progressive' ? 0xc2 : 0xc0), `${kind}: SOF`);
    assert.ok(ms.includes(0xda), `${kind}: SOS`);
  }
  // A progressive JPEG has several scans; all of them must be walked over.
  const prog = await realJpeg('progressive');
  assert.ok(markers(prog).filter(m => m === 0xda).length > 1, 'progressive: multiple SOS segments walked');

  assert.ok(findJpegSegment(await realJpeg('icc'), 0xe2, 'ICC_PROFILE'), 'ICC_PROFILE APP2 found in a real file');
  assert.ok(findJpegSegment(await realJpeg('exif'), 0xe1, 'Exif'), 'Exif APP1 found in a real file');
});

test('scan: a real libjpeg-turbo JPEG has NO APP0 — the exact case the ad-hoc inserters get wrong', { skip: SKIP_SHARP }, async () => {
  const bytes = await realJpeg('exif');
  assert.equal(findJpegSegment(bytes, 0xe0), null, 'no JFIF APP0');
  assert.equal(scanJpegSegments(bytes)!.segments[0]!.marker, 0xe1, 'first segment is APP1 Exif');
  // insertJpegExif's "skip one APP0" rule would splice at offset 2, i.e. AHEAD
  // of this existing APP1; the shared walker places it after instead.
  const out = insertJpegSegments(bytes, [ICC_SEG]);
  const order = appOrder(out);
  assert.ok(order.indexOf('e1:Exif') < order.indexOf('e2:ICC_PROFILE'), 'ICC lands after the existing Exif');
});

// ── 2. insertion ────────────────────────────────────────────────────────────

test('insert: canonical order APP0 -> Exif -> XMP -> MPF -> ICC regardless of call order', () => {
  const base = synthJpeg();
  const out = insertJpegSegments(base, [ICC_SEG, MPF_SEG, XMP_SEG, EXIF_SEG]);
  assert.deepEqual(appOrder(out), [
    'e0:JFIF',
    'e1:Exif',
    `e1:${JPEG_APP_IDS.XMP}`,
    'e2:MPF',
    'e2:ICC_PROFILE',
  ]);
  // ...and every APPn still precedes the image segments.
  const ms = markers(out);
  assert.ok(Math.max(...ms.map((m, i) => (m >= 0xe0 && m <= 0xef ? i : -1))) < ms.indexOf(0xdb));
});

test('insert: byte-level — exact length, prefix and suffix preserved verbatim', () => {
  const base = synthJpeg();
  const out = insertJpegSegments(base, [ICC_SEG, MPF_SEG]);
  assert.equal(out.length, base.length + ICC_SEG.length + MPF_SEG.length);
  const at = 2 + APP0_JFIF.length;
  assert.deepEqual([...out.subarray(0, at)], [...base.subarray(0, at)], 'bytes before the splice unchanged');
  assert.deepEqual([...out.subarray(at, at + MPF_SEG.length)], [...MPF_SEG]);
  assert.deepEqual([...out.subarray(at + MPF_SEG.length, at + MPF_SEG.length + ICC_SEG.length)], [...ICC_SEG]);
  assert.deepEqual([...out.subarray(at + MPF_SEG.length + ICC_SEG.length)], [...base.subarray(at)], 'suffix byte-identical');
});

test('insert: MPF goes BEFORE an ICC profile that is already in the file', () => {
  const base = synthJpeg([ICC_SEG]);
  const out = insertJpegSegments(base, [MPF_SEG]);
  const order = appOrder(out);
  assert.ok(order.indexOf('e2:MPF') < order.indexOf('e2:ICC_PROFILE'), 'MPF precedes existing ICC');
  const shared = findJpegSegment(out, 0xe2, 'MPF')!.start;
  // NEGATIVE CONTROL on the rule this replaces: insertJpegIcc's "advance over
  // leading APP0/APP1 only" stops AT the existing APP2, so the same insertion
  // done that way lands MPF *after* the ICC profile it must precede.
  let legacyAt = 2;
  while (base[legacyAt] === 0xff && (base[legacyAt + 1] === 0xe0 || base[legacyAt + 1] === 0xe1)) {
    legacyAt += 2 + ((base[legacyAt + 2]! << 8) | base[legacyAt + 3]!);
  }
  assert.equal(legacyAt, 2 + APP0_JFIF.length, 'legacy rule stops before the APP2');
  assert.equal(shared, legacyAt, 'here the two agree...');
  // ...but add a second ICC chunk and they diverge: the legacy rule would put a
  // NEW APP1 (XMP) ahead of MPF, which is the ordering bug.
  const withXmp = insertJpegSegments(base, [XMP_SEG, MPF_SEG]);
  const o2 = appOrder(withXmp);
  assert.deepEqual(o2, ['e0:JFIF', `e1:${JPEG_APP_IDS.XMP}`, 'e2:MPF', 'e2:ICC_PROFILE']);
});

test('insert: multiple chunks of one identity stay contiguous and in the given order', () => {
  const chunks = [1, 2, 3].map(i => buildJpegSegment(0xe2, bodyOf('ICC_PROFILE', 1, [i, 3, i * 9]))!);
  const out = insertJpegSegments(synthJpeg(), [...chunks]);
  const found = findJpegSegments(out, 0xe2, 'ICC_PROFILE');
  assert.equal(found.length, 3);
  assert.deepEqual(found.map(s => jpegSegmentBody(out, s)[12]), [1, 2, 3], 'sequence numbers in order');
  assert.equal(found[1]!.start, found[0]!.end, 'contiguous');
  assert.equal(found[2]!.start, found[1]!.end, 'contiguous');
});

test('insert: round-trip — what goes in comes back out byte-identical (idempotent re-scan)', () => {
  const out = insertJpegSegments(synthJpeg(), [EXIF_SEG, XMP_SEG, MPF_SEG, ICC_SEG, COM_SEG]);
  const scan = scanJpegSegments(out)!;
  assertNoOverRead(scan, out, 'roundtrip');
  assert.equal(scan.truncated, false);
  for (const [marker, appId, seg] of [
    [0xe1, 'Exif', EXIF_SEG], [0xe1, JPEG_APP_IDS.XMP, XMP_SEG],
    [0xe2, 'MPF', MPF_SEG], [0xe2, 'ICC_PROFILE', ICC_SEG],
  ] as const) {
    const found = findJpegSegment(out, marker, appId)!;
    assert.ok(found, `${appId} found after insert`);
    assert.deepEqual([...out.subarray(found.start, found.end)], [...seg], `${appId} byte-identical`);
  }
  const exif = findJpegSegment(out, 0xe1, 'Exif')!;
  assert.deepEqual([...jpegSegmentBody(out, exif)], [...EXIF_SEG.subarray(4)]);
  const com = findJpegSegments(out, 0xfe)[0]!;
  assert.deepEqual([...out.subarray(com.start, com.end)], [...COM_SEG]);
  // Inserting again into the result appends a second copy (default is append).
  const twice = insertJpegSegments(out, [EXIF_SEG]);
  assert.equal(findJpegSegments(twice, 0xe1, 'Exif').length, 2);
});

test('insert: replace drops the existing segment of the same identity', () => {
  const base = insertJpegSegments(synthJpeg(), [EXIF_SEG, ICC_SEG]);
  const newExif = buildJpegSegment(0xe1, bodyOf('Exif', 2, [0x4d, 0x4d, 0x00, 0x2a, 0x99]))!;
  const out = insertJpegSegments(base, [newExif], { replace: true });
  const found = findJpegSegments(out, 0xe1, 'Exif');
  assert.equal(found.length, 1, 'exactly one Exif');
  assert.deepEqual([...out.subarray(found[0]!.start, found[0]!.end)], [...newExif]);
  assert.equal(out.length, base.length - EXIF_SEG.length + newExif.length);
  assert.equal(findJpegSegments(out, 0xe2, 'ICC_PROFILE').length, 1, 'untouched identities survive');
  assert.deepEqual(appOrder(out), ['e0:JFIF', 'e1:Exif', 'e2:ICC_PROFILE'], 'order preserved after replace');
});

test('insert: a post-EOI trailer and the entropy data survive the splice', () => {
  const base = cat(synthJpeg(), synthJpeg());
  const out = insertJpegSegments(base, [XMP_SEG]);
  const scan = scanJpegSegments(out)!;
  assert.equal(out.length, base.length + XMP_SEG.length);
  assert.deepEqual([...out.subarray(scan.trailerStart!)], [...synthJpeg()], 'trailer byte-identical');
  const at = 2 + APP0_JFIF.length;
  assert.deepEqual([...out.subarray(at, at + XMP_SEG.length)], [...XMP_SEG], 'spliced at the canonical offset');
  assert.deepEqual([...out.subarray(at + XMP_SEG.length)], [...base.subarray(at)], 'everything after is verbatim');
});

test('insert: nothing is inserted past SOS, even with a COM already after it', () => {
  const withTrailingCom = cat(SOI, APP0_JFIF, DQT, SOF0, SOS, ENTROPY, COM_SEG, EOI);
  const out = insertJpegSegments(withTrailingCom, [ICC_SEG]);
  const scan = scanJpegSegments(out)!;
  const icc = findJpegSegment(out, 0xe2, 'ICC_PROFILE')!;
  assert.ok(icc.start < scan.sos!, 'ICC placed before SOS despite the post-SOS COM');
  assert.equal(scan.truncated, false);
});

test('insert: all-or-nothing — malformed inputs return the original bytes', () => {
  const base = synthJpeg();
  const badLen = Uint8Array.from([0xff, 0xe2, 0x00, 0x40, 1, 2, 3]); // declares 64, is 5
  assert.equal(insertJpegSegments(base, [badLen]), base, 'self-inconsistent length');
  assert.equal(insertJpegSegments(base, [Uint8Array.from([0xe2, 0x00, 0x04, 0])]), base, 'no 0xFF frame');
  assert.equal(insertJpegSegments(base, [Uint8Array.from([0xff, 0xe2])]), base, 'too short');
  assert.equal(insertJpegSegments(base, [ICC_SEG, badLen]), base, 'one bad segment poisons the batch');
  const notJpeg = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
  assert.equal(insertJpegSegments(notJpeg, [ICC_SEG]), notJpeg, 'not a JPEG');
  assert.equal(insertJpegSegments(base, []), base, 'nothing to insert');
  assert.equal(buildJpegSegment(0xe2, new Uint8Array(0xfffe)), null, 'body too large for one segment');
  assert.equal(buildJpegSegment(0xff, new Uint8Array(4)), null, 'bogus marker');
  assert.ok(buildJpegSegment(0xe2, new Uint8Array(0xfffd)), '65533-byte body is the largest that fits');
});

test('insert: sharp decodes the spliced file to identical pixels (external oracle)', { skip: SKIP_SHARP }, async () => {
  const base = await realJpeg('plain');
  const before = await decodePixels(base);
  const out = insertJpegSegments(base, [ICC_SEG, MPF_SEG, XMP_SEG, EXIF_SEG, COM_SEG]);
  assert.ok(out.length > base.length);
  const after = await decodePixels(out);
  assert.deepEqual([...after], [...before], 'metadata insertion moved no pixel');
  assert.deepEqual(appOrder(out).slice(0, 4), [
    'e1:Exif', `e1:${JPEG_APP_IDS.XMP}`, 'e2:MPF', 'e2:ICC_PROFILE',
  ]);
  // ...and the same is true when replacing an existing real ICC profile.
  const iccFile = await realJpeg('icc');
  const replaced = insertJpegSegments(iccFile, [ICC_SEG], { replace: true });
  assert.equal(findJpegSegments(replaced, 0xe2, 'ICC_PROFILE').length, 1);
  assert.deepEqual([...await decodePixels(replaced)], [...await decodePixels(iccFile)]);
});

// ── 3. rank ─────────────────────────────────────────────────────────────────

test('rank: the documented order, with unknown APPn kept in marker order', () => {
  const r = jpegSegmentRank;
  const seq = [
    r(0xe0, 'JFIF'), r(0xe1, 'Exif'), r(0xe1, JPEG_APP_IDS.XMP), r(0xe1, JPEG_APP_IDS.XMP_EXT),
    r(0xe1, null), r(0xe2, 'MPF'), r(0xe2, 'ICC_PROFILE'), r(0xe2, null), r(0xeb, 'JP'),
    r(0xed, 'Photoshop 3.0'), r(0xfe, null), r(0xdb, null),
  ];
  assert.deepEqual(seq, [...seq].sort((a, b) => a - b), 'ranks ascend in the documented order');
  assert.ok(r(0xe2, 'MPF') < r(0xe2, 'ICC_PROFILE'), 'MPF before ICC — the offsets rule');
  assert.ok(r(0xe1, 'Exif') < r(0xe1, JPEG_APP_IDS.XMP), 'EXIF before XMP');
  assert.ok(r(0xec, null) < r(0xed, null), 'unknown APPn stay in marker order');
  assert.equal(r(0xc0, null), 100);
  assert.equal(r(0xda, null), 100);
});

// ── 4. hostile input ────────────────────────────────────────────────────────

test('hostile: not-a-JPEG and degenerate buffers return null, never throw', () => {
  for (const b of [
    new Uint8Array(0), Uint8Array.from([0xff]), Uint8Array.from([0xff, 0xd9]),
    Uint8Array.from([0x00, 0x00, 0xff, 0xd8]), new Uint8Array(64),
  ]) {
    assert.equal(scanJpegSegments(b), null);
    assert.deepEqual(findJpegSegments(b, 0xe1), []);
    assert.equal(findJpegSegment(b, 0xe1), null);
  }
  assert.equal(scanJpegSegments(null), null);
  assert.equal(scanJpegSegments(undefined), null);
  assert.deepEqual([...scanJpegSegments(SOI)!.segments], []);
  assert.equal(scanJpegSegments(SOI)!.truncated, true);
});

test('hostile: segment length 0, 1 and 2 stop the walk cleanly', () => {
  for (const len of [0, 1]) {
    const bytes = cat(SOI, Uint8Array.from([0xff, 0xe1, 0x00, len, 9, 9, 9, 9]), DQT, EOI);
    const scan = scanJpegSegments(bytes)!;
    assertNoOverRead(scan, bytes, `len${len}`);
    assert.deepEqual([...scan.segments], [], `len=${len}: nothing accepted`);
    assert.equal(scan.truncated, true);
    assert.equal(scan.eoi, null, 'a bogus length must not let the walk claim it reached EOI');
  }
  // len === 2 is an empty but LEGAL segment; the walk continues past it.
  const ok = cat(SOI, Uint8Array.from([0xff, 0xe1, 0x00, 0x02]), DQT, SOF0, SOS, ENTROPY, EOI);
  const scan = scanJpegSegments(ok)!;
  assert.equal(scan.truncated, false);
  assert.equal(scan.segments[0]!.end, 6);
  assert.equal(scan.segments[0]!.appId, null, 'empty payload has no id');
});

test('hostile: a length reaching past EOF is refused, not trusted', () => {
  const bytes = cat(SOI, Uint8Array.from([0xff, 0xe1, 0xff, 0xff, 1, 2, 3]), EOI);
  const scan = scanJpegSegments(bytes)!;
  assertNoOverRead(scan, bytes, 'past-eof');
  assert.deepEqual([...scan.segments], []);
  assert.equal(scan.truncated, true);
  assert.equal(insertJpegSegments(bytes, [ICC_SEG]).length, bytes.length + ICC_SEG.length, 'insert still safe on a short scan');
});

test('hostile: exact 64 KiB boundary lengths — the largest legal segment, and one byte too far', () => {
  const maxBody = new Uint8Array(0xffff - 2); // segment length field == 0xFFFF
  maxBody.set([0x4d, 0x50, 0x46, 0x00], 0);   // "MPF\0"
  const seg = buildJpegSegment(0xe2, maxBody)!;
  assert.equal(seg.length, 0x10001);
  assert.equal((seg[2]! << 8) | seg[3]!, 0xffff);
  const bytes = synthJpeg([seg]);
  const scan = scanJpegSegments(bytes)!;
  assertNoOverRead(scan, bytes, 'max-seg');
  assert.equal(scan.truncated, false);
  const found = findJpegSegment(bytes, 0xe2, 'MPF')!;
  assert.equal(found.end - found.start, 0x10001);
  // One byte short of what it declares: refused, and nothing past it is read.
  const clipped = bytes.subarray(0, found.end - 1);
  const bad = scanJpegSegments(clipped)!;
  assertNoOverRead(bad, clipped, 'max-seg-clipped');
  assert.equal(bad.segments.some(s => s.marker === 0xe2), false);
  assert.equal(bad.truncated, true);
});

test('hostile: no SOS, no EOI, truncation at every offset', () => {
  const noSos = synthJpeg([], { sos: false });
  assert.equal(scanJpegSegments(noSos)!.sos, null);
  assert.equal(scanJpegSegments(noSos)!.eoi, noSos.length - 2);

  const noEoi = synthJpeg([], { eoi: false });
  const scan = scanJpegSegments(noEoi)!;
  assert.equal(scan.eoi, null);
  assert.equal(scan.trailerStart, null);
  assert.equal(scan.truncated, true);
  assert.ok(scan.sos !== null, 'segments before the missing EOI are still reported');

  const full = synthJpeg([EXIF_SEG, ICC_SEG]);
  for (let n = 0; n <= full.length; n++) {
    const cut = full.subarray(0, n);
    const s = scanJpegSegments(cut);
    assertNoOverRead(s, cut, `truncated@${n}`);
    const out = insertJpegSegments(cut, [MPF_SEG]);
    assert.ok(out instanceof Uint8Array, `truncated@${n}: insert returned bytes`);
  }
});

test('hostile: seeded mutations of a real JPEG never throw and never over-read', { skip: SKIP_SHARP }, async () => {
  const base = await realJpeg('icc');
  let seed = 0x1234abcd;
  const rnd = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 0x100000000;
  };
  for (let i = 0; i < 400; i++) {
    const b = base.slice(0, 1 + Math.floor(rnd() * base.length));
    const flips = 1 + Math.floor(rnd() * 8);
    for (let f = 0; f < flips; f++) b[Math.floor(rnd() * b.length)] = Math.floor(rnd() * 256);
    const scan = scanJpegSegments(b);
    assertNoOverRead(scan, b, `fuzz#${i}`);
    const out = insertJpegSegments(b, [MPF_SEG, ICC_SEG]);
    assert.ok(out instanceof Uint8Array, `fuzz#${i}: insert returned bytes`);
    assertNoOverRead(scanJpegSegments(out), out, `fuzz#${i}-out`);
  }
});

test('hostile: a 0xFF run and a stray FF00 outside entropy data terminate the walk without hanging', () => {
  const ffRun = cat(SOI, new Uint8Array(4096).fill(0xff));
  const scan = scanJpegSegments(ffRun)!;
  assertNoOverRead(scan, ffRun, 'ff-run');
  assert.deepEqual([...scan.segments], []);
  assert.equal(scan.truncated, true);

  const stuffed = cat(SOI, Uint8Array.from([0xff, 0x00]), DQT, EOI);
  assert.deepEqual([...scanJpegSegments(stuffed)!.segments], [], 'FF 00 before any SOS is corruption');
});

test('hostile: the segment cap bounds the walk', () => {
  const tiny = buildJpegSegment(0xfe, Uint8Array.from([0]))!; // 5 bytes each
  const many: Uint8Array[] = [];
  for (let i = 0; i < 5000; i++) many.push(tiny);
  const bytes = cat(SOI, ...many, EOI);
  const scan = scanJpegSegments(bytes)!;
  assert.equal(scan.segments.length, 4096, 'capped');
  assert.equal(scan.truncated, true, 'the cap is reported as a short scan, not silently');
  assertNoOverRead(scan, bytes, 'cap');
});
