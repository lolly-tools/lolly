/**
 * JPEG APP11 / JUMBF reassembly regression tests.
 * Run with: node --test tests/c2pa-jpeg-segments.test.ts
 *
 * C2PA stores its manifest as a JUMBF box split across APP11 (0xFFEB) segments
 * that share one box-instance number (En) and increment a 1-based sequence
 * counter (Z). The reader must reassemble by (En, Z) order — NOT by scanning for
 * the "c2pa" store-UUID marker on every segment, because an assertion URL such
 * as `self#jumbf=/c2pa/…` plants the bytes "c2pa" at that exact offset inside a
 * *continuation* chunk. Reading a real 24-manifest export (Layout Studio.jpg)
 * used to reject that as "JPEG has more than one manifest store". These craft
 * that exact byte pattern so the regression can't silently return.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractC2paStore } from '../engine/src/c2pa-verify.ts';

const bytesOf = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

// The c2pa manifest-store JUMBF UUID begins with the ASCII bytes "c2pa".
const C2PA_UUID = Uint8Array.from([
  0x63, 0x32, 0x70, 0x61, 0x00, 0x11, 0x00, 0x10,
  0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71,
]);

// Build a JUMBF manifest-store box: LBox(4) + 'jumb' + a jumd description box
// (LBox + 'jumd' + the c2pa UUID) + `contentLen` bytes of filler. `decoyAt`, if
// set, writes the ASCII "c2pa" into the filler at that box offset — used to plant
// the false-positive marker inside what will become a continuation chunk.
function buildManifestBox(contentLen: number, decoyAt?: number): Uint8Array {
  const jumdLen = 8 + C2PA_UUID.length;           // LBox + 'jumd' + UUID
  const total = 8 + jumdLen + contentLen;         // outer LBox + 'jumb' + jumd + filler
  const box = new Uint8Array(total);
  const dv = new DataView(box.buffer);
  dv.setUint32(0, total);                          // outer LBox
  box.set(bytesOf('jumb'), 4);                     // outer TBox
  dv.setUint32(8, jumdLen);                        // jumd LBox
  box.set(bytesOf('jumd'), 12);                    // jumd TBox
  box.set(C2PA_UUID, 16);                          // store UUID (starts "c2pa")
  for (let i = 8 + jumdLen; i < total; i++) box[i] = 0x58; // 'X' filler
  if (decoyAt != null) box.set(bytesOf('c2pa'), decoyAt);
  return box;
}

// Split a JUMBF box across APP11 segments exactly as c2pa-rs writes them: the
// first segment carries the box's LBox/TBox header + the first content slice; each
// continuation REPEATS the 8-byte LBox/TBox and appends the next slice. Every
// segment is prefixed with CI("JP") + En + Z(1-based). `boundaries` are box-content
// offsets (past the 8-byte header) at which to cut.
function splitToApp11(box: Uint8Array, en: number, boundaries: number[]): Uint8Array[] {
  const header = box.subarray(0, 8);              // LBox + TBox, repeated in every segment
  const content = box.subarray(8);
  const cuts = [0, ...boundaries, content.length];
  const segs: Uint8Array[] = [];
  for (let k = 0; k + 1 < cuts.length; k++) {
    const slice = content.subarray(cuts[k]!, cuts[k + 1]!);
    const body = new Uint8Array(8 + header.length + slice.length);
    const dv = new DataView(body.buffer);
    body[0] = 0x4a; body[1] = 0x50;              // CI = "JP"
    dv.setUint16(2, en);                          // En (box instance)
    dv.setUint32(4, k + 1);                       // Z (1-based sequence)
    body.set(header, 8);
    body.set(slice, 16);
    segs.push(body);
  }
  return segs;
}

// Wrap APP11 bodies into a minimal JPEG: SOI + each APP11 marker segment + EOI.
function assembleJpeg(app11Bodies: Uint8Array[]): Uint8Array {
  const out: number[] = [0xff, 0xd8];             // SOI
  for (const body of app11Bodies) {
    const len = body.length + 2;                  // length field includes itself
    out.push(0xff, 0xeb, (len >> 8) & 0xff, len & 0xff, ...body);
  }
  out.push(0xff, 0xd9);                           // EOI
  return Uint8Array.from(out);
}

test('reassembles a manifest split across APP11 segments (Z order), ignoring a "c2pa" decoy in a continuation chunk', () => {
  // Content = 240 bytes; cut at 100 → chunk0 carries content[0:100], chunk1
  // carries content[100:240]. Placing "c2pa" at box offset 8+108 lands it at
  // chunk1 body offset 24 — the position the old scanner misread as a 2nd store.
  const box = buildManifestBox(240, /* decoyAt */ 8 + 108);
  assert.equal(String.fromCharCode(...box.subarray(8 + 108, 8 + 112)), 'c2pa', 'decoy planted');

  const segs = splitToApp11(box, /* en */ 529, /* boundaries */ [100]);
  const jpeg = assembleJpeg(segs);

  const ex = extractC2paStore(jpeg);
  assert.ok(ex, 'store extracted (no false "more than one manifest store")');
  assert.equal(ex!.format, 'jpeg');
  assert.deepEqual(ex!.store, box, 'reassembled bytes are the original JUMBF box');
});

test('single-segment manifest still reads back byte-for-byte', () => {
  const box = buildManifestBox(40);
  const jpeg = assembleJpeg(splitToApp11(box, 1, []));
  const ex = extractC2paStore(jpeg);
  assert.ok(ex);
  assert.deepEqual(ex!.store, box);
});

test('out-of-order APP11 segments are reassembled by their Z sequence', () => {
  const box = buildManifestBox(200);
  const segs = splitToApp11(box, 7, [60, 130]);   // Z = 1, 2, 3
  const jpeg = assembleJpeg([segs[2]!, segs[0]!, segs[1]!]); // shuffled on the wire
  const ex = extractC2paStore(jpeg);
  assert.ok(ex);
  assert.deepEqual(ex!.store, box);
});

test('two distinct c2pa box instances are still rejected as more than one store', () => {
  // Different En, each a self-contained c2pa store → genuinely ambiguous. The
  // reader throws internally; extractC2paStore surfaces that as null.
  const a = assembleJpeg([...splitToApp11(buildManifestBox(30), 100, []),
                          ...splitToApp11(buildManifestBox(30), 200, [])]);
  assert.equal(extractC2paStore(a), null);
});

test('a JPEG with no APP11 JUMBF carries no store', () => {
  assert.equal(extractC2paStore(assembleJpeg([])), null);
});
