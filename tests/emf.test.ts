/**
 * EMF emitter byte-structure contract tests.
 * Run with: node --test tests/emf.test.ts
 *
 * Ships a small structural EMF parser (below) so the assertions read against the
 * actual record stream, not the emitter's own intent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emitEmf } from '../engine/src/emf.ts';
import type { VectorIr } from '../engine/src/emf.ts';

const ENHMETA_SIGNATURE = 0x464D4520;
const EMR_HEADER = 0x01;
const EMR_EOF = 0x0E;
const EMR_POLYBEZIERTO = 0x05;
const EMR_POLYLINETO = 0x06;

interface EmfRecord {
  iType: number;
  size: number;
  off?: number;
  malformed?: boolean;
}

// Minimal structural parser: returns {header, records[]}.
function parseEmf(bytes: Uint8Array) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const records: EmfRecord[] = [];
  let off = 0;
  while (off + 8 <= bytes.length) {
    const iType = dv.getUint32(off, true);
    const size = dv.getUint32(off + 4, true);
    if (size < 8 || off + size > bytes.length) {
      records.push({ iType, size, malformed: true });
      break;
    }
    records.push({ iType, size, off });
    off += size;
  }
  const header = {
    iType: dv.getUint32(0, true),
    nSize: dv.getUint32(4, true),
    rclBounds: [dv.getInt32(8, true), dv.getInt32(12, true), dv.getInt32(16, true), dv.getInt32(20, true)],
    rclFrame: [dv.getInt32(24, true), dv.getInt32(28, true), dv.getInt32(32, true), dv.getInt32(36, true)],
    signature: dv.getUint32(0x28, true),
    nVersion: dv.getUint32(0x2C, true),
    nBytes: dv.getUint32(0x30, true),
    nRecords: dv.getUint32(0x34, true),
    nHandles: dv.getUint16(0x38, true),
    szlDevice: [dv.getInt32(0x48, true), dv.getInt32(0x4C, true)],
    szlMillimeters: [dv.getInt32(0x50, true), dv.getInt32(0x54, true)],
  };
  return { header, records, dv, endOff: off };
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

test('valid header: signature, version, sizes', () => {
  const bytes = emitEmf(IR, { width: 600, height: 600 });
  const { header } = parseEmf(bytes);
  assert.equal(header.iType, EMR_HEADER);
  assert.equal(header.nSize, 88);
  assert.equal(header.signature, ENHMETA_SIGNATURE);
  assert.equal(header.nVersion, 0x00010000);
  assert.equal(header.nBytes, bytes.length, 'nBytes == file length');
  assert.equal(header.nHandles, 3);
  assert.deepEqual(header.rclBounds, [0, 0, 599, 599]);
  assert.deepEqual(header.szlDevice, [600, 600]);
});

test('nRecords matches the walked record count', () => {
  const bytes = emitEmf(IR, { width: 600, height: 600 });
  const { header, records } = parseEmf(bytes);
  assert.ok(!records.some(r => r.malformed), 'no malformed record');
  assert.equal(header.nRecords, records.length);
});

test('every record is 4-byte aligned and sizes sum to nBytes', () => {
  const bytes = emitEmf(IR, { width: 600, height: 600 });
  const { records, endOff } = parseEmf(bytes);
  for (const r of records) assert.equal(r.size % 4, 0, `record ${r.iType.toString(16)} size aligned`);
  assert.equal(endOff, bytes.length, 'records tile the whole buffer');
});

test('first record is HEADER, last is EOF with SizeLast == 20', () => {
  const bytes = emitEmf(IR, { width: 600, height: 600 });
  const { records, dv } = parseEmf(bytes);
  assert.equal(records[0]!.iType, EMR_HEADER);
  const eof = records[records.length - 1]!;
  assert.equal(eof.iType, EMR_EOF);
  assert.equal(eof.size, 20);
  assert.equal(dv.getUint32(eof.off! + 16, true), 20, 'nSizeLast');
});

test('every POLYBEZIERTO point count is a multiple of 3', () => {
  const bytes = emitEmf(IR, { width: 600, height: 600 });
  const { records, dv } = parseEmf(bytes);
  for (const r of records) {
    if (r.iType === EMR_POLYBEZIERTO) {
      const count = dv.getUint32(r.off! + 8 + 16, true); // after iType,nSize,rclBounds
      assert.equal(count % 3, 0, 'bezier points multiple of 3');
    }
    if (r.iType === EMR_POLYLINETO) {
      const count = dv.getUint32(r.off! + 8 + 16, true);
      assert.ok(count >= 1);
    }
  }
});

test('physical units drive rclFrame (.01mm) and szlMillimeters', () => {
  const bytes = emitEmf({ ...IR, width: 1, height: 1 }, { width: '210mm', height: '297mm' });
  const { header } = parseEmf(bytes);
  // 210mm = 21000 (.01mm); 297mm = 29700
  assert.ok(Math.abs(header.rclFrame[2]! - 21000) <= 2, 'A4 width frame');
  assert.ok(Math.abs(header.rclFrame[3]! - 29700) <= 2, 'A4 height frame');
  assert.deepEqual(header.szlMillimeters, [210, 297]);
});

test('px-only default: frame derived at 96 DPI, mm clamped ≥ 1', () => {
  const bytes = emitEmf({ width: 96, height: 96, prims: [] }, {});
  const { header } = parseEmf(bytes);
  // 96px @ 96dpi = 1 inch = 2540 (.01mm), 25.4 mm
  assert.ok(Math.abs(header.rclFrame[2]! - 2540) <= 2);
  assert.deepEqual(header.szlMillimeters, [25, 25]);
});

test('empty IR still produces a valid header+EOF file', () => {
  const bytes = emitEmf({ width: 10, height: 10, prims: [] }, {});
  const { header, records } = parseEmf(bytes);
  assert.equal(records.length, 2, 'header + EOF only');
  assert.equal(header.nRecords, 2);
  assert.equal(header.nBytes, bytes.length);
});

// ── Image escape-hatch: EMR_STRETCHDIBITS ────────────────────────────────────
const EMR_STRETCHDIBITS = 0x51;
// 2×2 RGB, top-first: red, green, blue, white.
const IMG_IR: VectorIr = {
  width: 100, height: 80,
  prims: [{
    type: 'image', x: 10, y: 20, w: 40, h: 30, pxW: 2, pxH: 2,
    rgb: Uint8Array.from([255, 0, 0,  0, 255, 0,  0, 0, 255,  255, 255, 255]),
  }],
};

test('image prim → EMR_STRETCHDIBITS: header fields, BITMAPINFOHEADER, BGRX pixels', () => {
  const bytes = emitEmf(IMG_IR, { width: 100, height: 80 });
  const { records, dv, header } = parseEmf(bytes);
  assert.equal(header.nBytes, bytes.length, 'nBytes == file length with an image record');
  const rec = records.find(r => r.iType === EMR_STRETCHDIBITS);
  assert.ok(rec && rec.off !== undefined, 'STRETCHDIBITS record present');
  const o = rec!.off!;
  assert.equal(rec!.size, 120 + 2 * 2 * 4, 'size = 120 + 4·pxW·pxH');
  assert.equal(rec!.size % 4, 0, '4-aligned');
  assert.deepEqual([dv.getInt32(o + 8, true), dv.getInt32(o + 12, true), dv.getInt32(o + 16, true), dv.getInt32(o + 20, true)], [10, 20, 50, 50], 'rclBounds = [x,y,x+w,y+h]');
  assert.equal(dv.getInt32(o + 24, true), 10, 'xDest');
  assert.equal(dv.getInt32(o + 28, true), 20, 'yDest');
  assert.equal(dv.getInt32(o + 32, true), 0, 'xSrc');
  assert.equal(dv.getInt32(o + 36, true), 0, 'ySrc');
  assert.equal(dv.getInt32(o + 40, true), 2, 'cxSrc');
  assert.equal(dv.getInt32(o + 44, true), 2, 'cySrc');
  assert.equal(dv.getUint32(o + 48, true), 80, 'offBmiSrc');
  assert.equal(dv.getUint32(o + 52, true), 40, 'cbBmiSrc');
  assert.equal(dv.getUint32(o + 56, true), 120, 'offBitsSrc');
  assert.equal(dv.getUint32(o + 60, true), 16, 'cbBitsSrc = 4·pxW·pxH');
  assert.equal(dv.getUint32(o + 64, true), 0, 'iUsageSrc = DIB_RGB_COLORS');
  assert.equal(dv.getUint32(o + 68, true), 0x00CC0020, 'dwRop = SRCCOPY');
  assert.equal(dv.getInt32(o + 72, true), 40, 'cxDest');
  assert.equal(dv.getInt32(o + 76, true), 30, 'cyDest');
  // BITMAPINFOHEADER @ o+80
  assert.equal(dv.getUint32(o + 80, true), 40, 'biSize');
  assert.equal(dv.getInt32(o + 84, true), 2, 'biWidth');
  assert.equal(dv.getInt32(o + 88, true), -2, 'biHeight negative = top-down');
  assert.equal(dv.getUint16(o + 92, true), 1, 'biPlanes');
  assert.equal(dv.getUint16(o + 94, true), 32, 'biBitCount = 32');
  assert.equal(dv.getUint32(o + 96, true), 0, 'biCompression = BI_RGB');
  assert.equal(dv.getUint32(o + 100, true), 16, 'biSizeImage');
  // Pixels @ o+120: BGRX, first-row first. red → B0 G0 R255 X0; green; blue; white.
  const p = o + 120;
  assert.deepEqual([dv.getUint8(p), dv.getUint8(p + 1), dv.getUint8(p + 2), dv.getUint8(p + 3)], [0, 0, 255, 0], 'px0 red → BGRX');
  assert.deepEqual([dv.getUint8(p + 4), dv.getUint8(p + 5), dv.getUint8(p + 6), dv.getUint8(p + 7)], [0, 255, 0, 0], 'px1 green → BGRX');
  assert.deepEqual([dv.getUint8(p + 8), dv.getUint8(p + 9), dv.getUint8(p + 10), dv.getUint8(p + 11)], [255, 0, 0, 0], 'px2 blue → BGRX');
  assert.deepEqual([dv.getUint8(p + 12), dv.getUint8(p + 13), dv.getUint8(p + 14), dv.getUint8(p + 15)], [255, 255, 255, 0], 'px3 white → BGRX');
});
