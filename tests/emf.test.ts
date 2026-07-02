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

interface ParsedRecord {
  iType: number;
  size: number;
  off: number;
  malformed?: boolean;
}

interface ParsedHeader {
  iType: number;
  nSize: number;
  rclBounds: number[];
  rclFrame: number[];
  signature: number;
  nVersion: number;
  nBytes: number;
  nRecords: number;
  nHandles: number;
  szlDevice: number[];
  szlMillimeters: number[];
}

// Minimal structural parser: returns {header, records[]}.
function parseEmf(bytes: Uint8Array): {
  header: ParsedHeader;
  records: ParsedRecord[];
  dv: DataView;
  endOff: number;
} {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const records: ParsedRecord[] = [];
  let off = 0;
  while (off + 8 <= bytes.length) {
    const iType = dv.getUint32(off, true);
    const size = dv.getUint32(off + 4, true);
    if (size < 8 || off + size > bytes.length) {
      records.push({ iType, size, off, malformed: true });
      break;
    }
    records.push({ iType, size, off });
    off += size;
  }
  const header: ParsedHeader = {
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
  assert.equal(records[0]?.iType, EMR_HEADER);
  const eof = records[records.length - 1];
  assert.ok(eof, 'has records');
  assert.equal(eof.iType, EMR_EOF);
  assert.equal(eof.size, 20);
  assert.equal(dv.getUint32(eof.off + 16, true), 20, 'nSizeLast');
});

test('every POLYBEZIERTO point count is a multiple of 3', () => {
  const bytes = emitEmf(IR, { width: 600, height: 600 });
  const { records, dv } = parseEmf(bytes);
  for (const r of records) {
    if (r.iType === EMR_POLYBEZIERTO) {
      const count = dv.getUint32(r.off + 8 + 16, true); // after iType,nSize,rclBounds
      assert.equal(count % 3, 0, 'bezier points multiple of 3');
    }
    if (r.iType === EMR_POLYLINETO) {
      const count = dv.getUint32(r.off + 8 + 16, true);
      assert.ok(count >= 1);
    }
  }
});

test('physical units drive rclFrame (.01mm) and szlMillimeters', () => {
  const bytes = emitEmf({ ...IR, width: 1, height: 1 }, { width: '210mm', height: '297mm' });
  const { header } = parseEmf(bytes);
  // 210mm = 21000 (.01mm); 297mm = 29700
  assert.ok(Math.abs((header.rclFrame[2] ?? 0) - 21000) <= 2, 'A4 width frame');
  assert.ok(Math.abs((header.rclFrame[3] ?? 0) - 29700) <= 2, 'A4 height frame');
  assert.deepEqual(header.szlMillimeters, [210, 297]);
});

test('px-only default: frame derived at 96 DPI, mm clamped ≥ 1', () => {
  const bytes = emitEmf({ width: 96, height: 96, prims: [] }, {});
  const { header } = parseEmf(bytes);
  // 96px @ 96dpi = 1 inch = 2540 (.01mm), 25.4 mm
  assert.ok(Math.abs((header.rclFrame[2] ?? 0) - 2540) <= 2);
  assert.deepEqual(header.szlMillimeters, [25, 25]);
});

test('empty IR still produces a valid header+EOF file', () => {
  const bytes = emitEmf({ width: 10, height: 10, prims: [] }, {});
  const { header, records } = parseEmf(bytes);
  assert.equal(records.length, 2, 'header + EOF only');
  assert.equal(header.nRecords, 2);
  assert.equal(header.nBytes, bytes.length);
});
