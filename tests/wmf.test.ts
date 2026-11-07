// SPDX-License-Identifier: MPL-2.0
/**
 * WMF (placeable, 16-bit) emitter byte-structure contract tests.
 * Run with: node --test tests/wmf.test.ts
 *
 * Ships a small structural WMF parser (below) so the assertions read against the
 * actual placeable header + record stream, not the emitter's own intent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { emitWmf } from '../engine/src/wmf.ts';
import type { VectorIr } from '../engine/src/emf.ts';

const PLACEABLE_KEY = 0x9ac6cdd7;
const META_EOF = 0x0000;
const META_SETWINDOWORG = 0x020b;
const META_SETWINDOWEXT = 0x020c;
const META_SETPOLYFILLMODE = 0x0106;
const META_POLYGON = 0x0324;
const META_POLYLINE = 0x0325;
const META_SELECTOBJECT = 0x012d;
const META_DELETEOBJECT = 0x01f0;
const META_CREATEPENINDIRECT = 0x02fa;
const META_CREATEBRUSHINDIRECT = 0x02fc;

interface WmfRecord { size: number; func: number; off: number; params: number[] }

// Parse the 22-byte placeable header, the 18-byte METAHEADER, and the records.
function parseWmf(bytes: Uint8Array) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const placeable = {
    key: dv.getUint32(0, true),
    hwmf: dv.getUint16(4, true),
    box: [dv.getInt16(6, true), dv.getInt16(8, true), dv.getInt16(10, true), dv.getInt16(12, true)],
    inch: dv.getUint16(14, true),
    reserved: dv.getUint32(16, true),
    checksum: dv.getUint16(20, true),
  };
  let sum = 0;
  for (let i = 0; i < 10; i++) sum ^= dv.getUint16(i * 2, true);
  const checksumOk = (sum & 0xffff) === placeable.checksum;

  const mhOff = 22;
  const meta = {
    type: dv.getUint16(mhOff, true),
    headerSize: dv.getUint16(mhOff + 2, true),
    version: dv.getUint16(mhOff + 4, true),
    size: dv.getUint32(mhOff + 6, true),      // WORDs
    noObjects: dv.getUint16(mhOff + 10, true),
    maxRecord: dv.getUint32(mhOff + 12, true), // WORDs
    noParams: dv.getUint16(mhOff + 16, true),
  };

  const records: WmfRecord[] = [];
  let malformed = false;
  let off = mhOff + 18;
  while (off + 6 <= bytes.length) {
    const size = dv.getUint32(off, true); // WORDs
    const func = dv.getUint16(off + 4, true);
    if (size < 3 || off + size * 2 > bytes.length) { malformed = true; break; }
    const params: number[] = [];
    for (let p = off + 6; p < off + size * 2; p += 2) params.push(dv.getUint16(p, true));
    records.push({ size, func, off, params });
    off += size * 2;
    if (func === META_EOF) break;
  }
  return { placeable, checksumOk, meta, records, malformed, endOff: off };
}

// A filled+stroked path with one cubic, plus a filled-only triangle.
const IR: VectorIr = {
  width: 600,
  height: 600,
  prims: [
    {
      type: 'path',
      subpaths: [{
        segments: [
          { op: 'M', x: 10, y: 10 },
          { op: 'C', x1: 20, y1: 0, x2: 40, y2: 0, x: 50, y: 10 },
          { op: 'L', x: 50, y: 50 },
        ],
        closed: true,
      }],
      fill: { r: 255, g: 0, b: 0 },
      stroke: { r: 0, g: 0, b: 0, width: 2 },
      fillRule: 'nonzero',
    },
    {
      type: 'path',
      subpaths: [{
        segments: [
          { op: 'M', x: 100, y: 100 },
          { op: 'L', x: 200, y: 100 },
          { op: 'L', x: 150, y: 200 },
        ],
        closed: true,
      }],
      fill: { r: 0, g: 128, b: 64 },
      stroke: null,
      fillRule: 'evenodd',
    },
  ],
};

test('placeable header: key, checksum, bounding box, inch', () => {
  const bytes = emitWmf(IR, { width: 600, height: 600 });
  const { placeable, checksumOk } = parseWmf(bytes);
  assert.equal(placeable.key >>> 0, PLACEABLE_KEY);
  assert.ok(checksumOk, 'placeable checksum is the XOR of the ten preceding WORDs');
  assert.deepEqual(placeable.box, [0, 0, 600, 600]);
  assert.equal(placeable.reserved, 0);
  // 600px canvas, no physical size ⇒ CSS 96-DPI ⇒ inch = 96.
  assert.equal(placeable.inch, 96);
});

test('placeable inch tracks physical size', () => {
  // 600px wide asked to be 2in ⇒ inch = 300. (A bare NUMBER is px per
  // parseDimension, so a physical size is expressed as a string + unit.)
  const bytes = emitWmf(IR, { width: '2', height: '2', unit: 'in' });
  const { placeable } = parseWmf(bytes);
  assert.equal(placeable.inch, 300);
});

test('METAHEADER: type/version/headerSize and mtSize matches record stream', () => {
  const bytes = emitWmf(IR, { width: 600, height: 600 });
  const { meta, records, malformed, endOff } = parseWmf(bytes);
  assert.equal(malformed, false);
  assert.equal(meta.type, 1);
  assert.equal(meta.headerSize, 9);
  assert.equal(meta.version, 0x0300);
  assert.equal(meta.noParams, 0);

  // mtSize (WORDs) = METAHEADER (9) + all record words, and it accounts for every
  // byte after the 22-byte placeable prefix.
  assert.equal(22 + meta.size * 2, bytes.length);
  assert.equal(endOff, bytes.length);

  // mtMaxRecord = the largest record, in WORDs.
  const maxRec = Math.max(...records.map(r => r.size));
  assert.equal(meta.maxRecord, maxRec);
});

test('every record size field is right (stream is walkable end to end)', () => {
  const bytes = emitWmf(IR, { width: 600, height: 600 });
  const { records, malformed } = parseWmf(bytes);
  assert.equal(malformed, false);
  // Each record body length equals its declared size (parser only records a row
  // when off + size*2 fit), and the last record is EOF.
  for (const r of records) assert.ok(r.size >= 3);
  assert.equal(records.at(-1)!.func, META_EOF);
  assert.equal(records.at(-1)!.size, 3); // EOF is size-3 WORDs, no params
});

test('window is set up before drawing', () => {
  const bytes = emitWmf(IR, { width: 600, height: 600 });
  const { records } = parseWmf(bytes);
  assert.equal(records[0]!.func, META_SETWINDOWORG);
  assert.deepEqual(records[0]!.params, [0, 0]);
  assert.equal(records[1]!.func, META_SETWINDOWEXT);
  // SetWindowExt stores Y (height) before X (width).
  assert.deepEqual(records[1]!.params, [600, 600]);
});

test('a rectangle path produces a Polygon record', () => {
  const rectIr: VectorIr = {
    width: 100, height: 100,
    prims: [{
      type: 'path',
      subpaths: [{
        segments: [
          { op: 'M', x: 10, y: 10 },
          { op: 'L', x: 90, y: 10 },
          { op: 'L', x: 90, y: 90 },
          { op: 'L', x: 10, y: 90 },
        ],
        closed: true,
      }],
      fill: { r: 12, g: 34, b: 56 },
      stroke: null,
      fillRule: 'nonzero',
    }],
  };
  const { records } = parseWmf(emitWmf(rectIr));
  const poly = records.find(r => r.func === META_POLYGON);
  assert.ok(poly, 'a closed filled rectangle emits a Polygon');
  // NumberOfPoints then the four corners as x,y pairs.
  assert.equal(poly!.params[0], 4);
  assert.deepEqual(poly!.params.slice(1), [10, 10, 90, 10, 90, 90, 10, 90]);

  // Brush created + selected, pen created + selected, both deleted afterwards.
  const funcs = records.map(r => r.func);
  assert.ok(funcs.includes(META_CREATEBRUSHINDIRECT));
  assert.ok(funcs.includes(META_CREATEPENINDIRECT));
  assert.ok(funcs.includes(META_SELECTOBJECT));
  assert.equal(funcs.filter(f => f === META_DELETEOBJECT).length, 2);

  // Solid brush carries the fill colour (0x00BBGGRR split into two WORDs).
  const brush = records.find(r => r.func === META_CREATEBRUSHINDIRECT)!;
  assert.equal(brush.params[0], 0); // BS_SOLID
  const lo = brush.params[1]!, hi = brush.params[2]!;
  assert.equal(lo & 0xff, 12);        // R
  assert.equal((lo >> 8) & 0xff, 34); // G
  assert.equal(hi & 0xff, 56);        // B
});

test('polyfill mode maps evenodd→ALTERNATE(1), nonzero→WINDING(2)', () => {
  const { records } = parseWmf(emitWmf(IR, { width: 600, height: 600 }));
  const modes = records.filter(r => r.func === META_SETPOLYFILLMODE).map(r => r.params[0]);
  assert.deepEqual(modes, [2, 1]); // prim 1 nonzero, prim 2 evenodd
});

test('stroke-only OPEN subpath emits a Polyline, not a Polygon', () => {
  const openIr: VectorIr = {
    width: 100, height: 100,
    prims: [{
      type: 'path',
      subpaths: [{
        segments: [
          { op: 'M', x: 10, y: 10 },
          { op: 'L', x: 90, y: 90 },
        ],
        closed: false,
      }],
      fill: null,
      stroke: { r: 0, g: 0, b: 0, width: 3 },
      fillRule: 'nonzero',
    }],
  };
  const { records } = parseWmf(emitWmf(openIr));
  assert.ok(records.some(r => r.func === META_POLYLINE));
  assert.ok(!records.some(r => r.func === META_POLYGON));
});

test('empty IR still yields a valid single-EOF metafile', () => {
  const bytes = emitWmf({ width: 10, height: 10, prims: [] });
  const { meta, records, malformed } = parseWmf(bytes);
  assert.equal(malformed, false);
  // SetWindowOrg, SetWindowExt, EOF.
  assert.equal(records.at(-1)!.func, META_EOF);
  assert.equal(22 + meta.size * 2, bytes.length);
});

// Optional external cross-check: only runs if ImageMagick can decode WMF.
test('ImageMagick cross-check (skipped unless a WMF delegate is present)', (t) => {
  let magick: string | null = null;
  for (const bin of ['magick', 'convert']) {
    try { execFileSync(bin, ['-version'], { stdio: 'ignore' }); magick = bin; break; } catch { /* next */ }
  }
  if (!magick) return t.skip('no ImageMagick binary');

  const dir = mkdtempSync(join(tmpdir(), 'wmf-'));
  const wmfPath = join(dir, 'out.wmf');
  const pngPath = join(dir, 'out.png');
  writeFileSync(wmfPath, emitWmf(IR, { width: 600, height: 600 }));
  const args = magick === 'magick' ? [wmfPath, pngPath] : [wmfPath, pngPath];
  try {
    execFileSync(magick, args, { stdio: 'pipe' });
  } catch (e) {
    // No WMF delegate (libwmf) compiled in - the byte-structure tests above stand
    // on their own; this is a best-effort renderer check.
    return t.skip(`ImageMagick has no WMF delegate: ${(e as Error).message.split('\n')[0]}`);
  }
  const { execSync } = require('node:child_process');
  const id = execSync(`${magick} identify ${JSON.stringify(pngPath)}`).toString();
  assert.match(id, /PNG/);
});

// ─── Stencil prims: words no font could draw, as a picture painted through their shape ─

const META_STRETCHDIB = 0x0f43;
const SRCPAINT = 0x00ee0086;
const SRCAND = 0x008800c6;

/** A 10 x 2 stencil: the first row inked on its left half, the second row empty. */
function stencilIr(): VectorIr {
  const bits = new Uint8Array([0b11111000, 0b00000000, 0, 0]);
  return {
    width: 100,
    height: 50,
    prims: [{ type: 'stencil', x: 10, y: 20, w: 40, h: 8, pxW: 10, pxH: 2, bits, fill: { r: 0x12, g: 0x34, b: 0x56 } }],
  };
}

test('a stencil is a mask and paint pair of 1-bit DIB blits, so the page under the words shows through', () => {
  const { records, malformed, meta, endOff } = parseWmf(emitWmf(stencilIr()));
  assert.equal(malformed, false);
  const blits = records.filter((r) => r.func === META_STRETCHDIB);
  assert.equal(blits.length, 2);
  const rop = (r: WmfRecord): number => (r.params[0]! | (r.params[1]! << 16)) >>> 0;
  // OR first: the words go white and nothing else changes. AND second: the white takes the ink.
  assert.deepEqual(blits.map(rop), [SRCPAINT, SRCAND]);
  for (const blit of blits) {
    // ColorUsage, SrcHeight, SrcWidth, YSrc, XSrc, DestHeight, DestWidth, yDst, xDst.
    assert.deepEqual(blit.params.slice(2, 11), [0, 2, 10, 0, 0, 8, 40, 20, 10]);
    const dib = blit.params.slice(11);
    assert.equal(dib[0], 40, 'a BITMAPINFOHEADER');
    assert.equal(dib[7], 1, 'one bit per pixel');
  }
  // Colour table words follow the 20-word header: [blue, green][red, 0] per entry.
  const table = (r: WmfRecord): number[] => r.params.slice(11 + 20, 11 + 24);
  assert.deepEqual(table(blits[0]!), [0x0000, 0x0000, 0xffff, 0x00ff], 'mask: 0 black, 1 white');
  assert.deepEqual(table(blits[1]!), [0xffff, 0x00ff, 0x3456, 0x0012], 'paint: 0 white, 1 the ink');
  // Rows are bottom-up and padded to 32 bits: the empty row first, then the inked one.
  const rows = (r: WmfRecord): number[] => r.params.slice(11 + 24, 11 + 28);
  assert.deepEqual(rows(blits[0]!), [0, 0, 0x00f8, 0]);
  assert.equal(meta.size * 2 + 22, endOff, 'mtSize counts the DIBs');
  assert.equal(meta.maxRecord, Math.max(...records.map((r) => r.size)));
});

test('a file with no stencil writes no DIB', () => {
  assert.equal(parseWmf(emitWmf(IR)).records.some((r) => r.func === META_STRETCHDIB), false);
});
