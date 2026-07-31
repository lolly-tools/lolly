// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/exr.ts — the Phase B3 OpenEXR writer (plans/deeprichpixels.md §4.2).
 *
 * Four independent ways of being right, because a writer with no reader is a
 * writer with no test:
 *
 *  1. A HAND-WRITTEN PARSER, in this file, built from the OpenEXR file-layout
 *     specification rather than from the encoder's source. It walks the magic,
 *     the version flags, every header attribute, the chunk offset table and
 *     every chunk, and it undoes the ZIP predictor itself. Nothing is shared
 *     with the encoder except `node:zlib` for the inflate.
 *  2. CROSS-CONTAINER IDENTITY. A NONE-compressed file's chunk bodies ARE the
 *     raw, un-preprocessed block bytes. So inflating a ZIP chunk and running the
 *     predictor inverse must land on exactly the bytes the NONE file already
 *     wrote for the same scan lines — which is what proves the byte
 *     reorder/delta pair is not merely self-consistent but *correct*, and it
 *     proves NONE vs ZIP is a container choice and not a pixel one.
 *  3. THE FLOAT16 CONTRACT. Every HALF sample in the file is compared, bit for
 *     bit, against `packF16` over the source floats — so the writer cannot have
 *     grown a second, subtly-different half-float conversion.
 *  4. AN EXTERNAL ORACLE: the Academy Software Foundation's own OpenEXR library
 *     via its Python bindings, which is the definition of a correct reader.
 *     Skipped with a reason when it is not installed (the `sharp` precedent in
 *     tests/png.test.ts), so a plain clone is not punished.
 *
 * ── Oracle status, recorded honestly (2026-07-31) ────────────────────────────
 * The oracle WAS run during development and every file this suite builds decoded
 * bit-exactly: `OpenEXR` 3.4.13 + numpy in a throwaway venv, reading zip / zips /
 * none / float / rgb / rec2020 files and reporting `array_equal == True` against
 * the expected half-rounded pixels, plus the right compression enum, data
 * window, channel names, dtypes, chromaticities and string attributes. That venv
 * is not a repo dependency, so the test below re-runs the same check only when a
 * Python with `OpenEXR` is reachable — set `EXR_ORACLE_PYTHON=/path/to/python`
 * (or have `python3 -c "import OpenEXR"` succeed) to make it run in CI.
 *
 * DCC oracle (2026-07-31): Blender 5.1 DOES now open these files and agrees on
 * every sample, half and float — see the Blender test at the bottom, which runs
 * headless whenever Blender is installed. That is a second independent reader
 * (OpenImageIO, not the ASWF bindings) AND the app a designer actually has.
 * Still not claimable: Nuke, Resolve, Flame and RV have not seen a file, and
 * nothing has been checked on an HDR display.
 *
 * Run: node --test tests/exr.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync, deflateSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { packExr, EXR_MAGIC, type PackExrOptions } from '../engine/src/exr.ts';
import { createDeepFrame, packF16, unpackF16, type DeepFrame, type PixelSpace } from '../engine/src/pixels.ts';

// ── an independent EXR reader, written from the spec ────────────────────────

interface ExrChannel { name: string; pixelType: number; pLinear: number; reserved: number[]; xSampling: number; ySampling: number }
interface ExrAttr { name: string; type: string; data: Uint8Array }
interface ExrChunk { offset: number; y: number; dataSize: number; body: Uint8Array }
interface ExrFile {
  magic: number;
  version: number;
  flags: number;
  attrs: ExrAttr[];
  attr(name: string): ExrAttr | undefined;
  channels: ExrChannel[];
  compression: number;
  dataWindow: [number, number, number, number];
  displayWindow: [number, number, number, number];
  lineOrder: number;
  pixelAspectRatio: number;
  screenWindowCenter: [number, number];
  screenWindowWidth: number;
  chromaticities: number[] | null;
  strings: Record<string, string>;
  headerEnd: number;
  tableStart: number;
  offsets: number[];
  chunks: ExrChunk[];
  width: number;
  height: number;
}

const dec = new TextDecoder();

function parseExr(buf: Uint8Array): ExrFile {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let p = 0;
  const magic = v.getInt32(p, true); p += 4;
  const versionField = v.getInt32(p, true); p += 4;

  const readName = (): string => {
    const start = p;
    while (buf[p] !== 0) {
      p++;
      if (p > buf.length) throw new Error('unterminated name');
    }
    const s = dec.decode(buf.subarray(start, p));
    p++;
    return s;
  };

  const attrs: ExrAttr[] = [];
  for (;;) {
    if (buf[p] === 0) { p++; break; }
    const name = readName();
    const type = readName();
    const size = v.getInt32(p, true); p += 4;
    attrs.push({ name, type, data: buf.subarray(p, p + size) });
    p += size;
  }
  const headerEnd = p;
  const attr = (n: string): ExrAttr | undefined => attrs.find((a) => a.name === n);

  const need = (n: string): ExrAttr => {
    const a = attr(n);
    if (!a) throw new Error(`missing required attribute ${n}`);
    return a;
  };

  // chlist
  const chBuf = need('channels').data;
  const chv = new DataView(chBuf.buffer, chBuf.byteOffset, chBuf.byteLength);
  const channels: ExrChannel[] = [];
  let q = 0;
  while (chBuf[q] !== 0) {
    const start = q;
    while (chBuf[q] !== 0) q++;
    const name = dec.decode(chBuf.subarray(start, q));
    q++;
    const pixelType = chv.getInt32(q, true); q += 4;
    const pLinear = chBuf[q]!; q += 1;
    const reserved = [chBuf[q]!, chBuf[q + 1]!, chBuf[q + 2]!]; q += 3;
    const xSampling = chv.getInt32(q, true); q += 4;
    const ySampling = chv.getInt32(q, true); q += 4;
    channels.push({ name, pixelType, pLinear, reserved, xSampling, ySampling });
  }

  const box = (a: ExrAttr): [number, number, number, number] => {
    const d = new DataView(a.data.buffer, a.data.byteOffset, a.data.byteLength);
    return [d.getInt32(0, true), d.getInt32(4, true), d.getInt32(8, true), d.getInt32(12, true)];
  };
  const f32at = (a: ExrAttr, i: number): number =>
    new DataView(a.data.buffer, a.data.byteOffset, a.data.byteLength).getFloat32(i * 4, true);

  const dataWindow = box(need('dataWindow'));
  const displayWindow = box(need('displayWindow'));
  const compression = need('compression').data[0]!;
  const lineOrder = need('lineOrder').data[0]!;
  const pixelAspectRatio = f32at(need('pixelAspectRatio'), 0);
  const swc = need('screenWindowCenter');
  const chromaAttr = attr('chromaticities');
  const chromaticities = chromaAttr ? Array.from({ length: 8 }, (_, i) => f32at(chromaAttr, i)) : null;

  const strings: Record<string, string> = {};
  for (const a of attrs) if (a.type === 'string') strings[a.name] = dec.decode(a.data);

  const width = dataWindow[2] - dataWindow[0] + 1;
  const height = dataWindow[3] - dataWindow[1] + 1;
  const linesPerBlock = compression === 3 ? 16 : 1;
  const numBlocks = Math.ceil(height / linesPerBlock);

  const tableStart = p;
  const offsets: number[] = [];
  for (let i = 0; i < numBlocks; i++) { offsets.push(Number(v.getBigUint64(p, true))); p += 8; }

  const chunks: ExrChunk[] = offsets.map((off) => {
    const y = v.getInt32(off, true);
    const dataSize = v.getInt32(off + 4, true);
    return { offset: off, y, dataSize, body: buf.subarray(off + 8, off + 8 + dataSize) };
  });

  return {
    magic, version: versionField & 0xff, flags: versionField & ~0xff,
    attrs, attr, channels, compression, dataWindow, displayWindow, lineOrder,
    pixelAspectRatio, screenWindowCenter: [f32at(swc, 0), f32at(swc, 1)],
    screenWindowWidth: f32at(need('screenWindowWidth'), 0),
    chromaticities, strings, headerEnd, tableStart, offsets, chunks, width, height,
  };
}

/**
 * Undo `Imf::Zip`'s preprocessing: delta first, then interleave back — the exact
 * inverse of the encoder's reorder-then-delta, written here from the C in
 * ImfZip.cpp's `uncompress` rather than from the encoder.
 */
function zipUnpreprocess(pre: Uint8Array): Uint8Array {
  const n = pre.length;
  const tmp = new Uint8Array(pre);
  for (let i = 1; i < n; i++) tmp[i] = (tmp[i - 1]! + tmp[i]! - 128) & 0xff;
  const out = new Uint8Array(n);
  let t1 = 0;
  let t2 = (n + 1) >> 1;
  let s = 0;
  for (;;) {
    if (s < n) out[s++] = tmp[t1++]!; else break;
    if (s < n) out[s++] = tmp[t2++]!; else break;
  }
  return out;
}

/** A chunk's raw (pre-predictor, pre-deflate) block bytes. */
function rawBlock(f: ExrFile, chunk: ExrChunk): Uint8Array {
  const bps = f.channels[0]!.pixelType === 1 ? 2 : 4;
  const linesPerBlock = f.compression === 3 ? 16 : 1;
  const lines = Math.min(linesPerBlock, f.height - chunk.y);
  const expected = lines * f.width * bps * f.channels.length;
  if (f.compression === 0) return chunk.body;
  // A chunk not smaller than the uncompressed block is stored raw
  // (ImfScanLineInputFile.cpp's rule, mirrored by the writer).
  if (chunk.dataSize >= expected) return chunk.body;
  return zipUnpreprocess(new Uint8Array(inflateSync(chunk.body)));
}

/** Decode a whole file to an interleaved RGBA Float32Array (missing A = 1). */
function decodeExr(bytes: Uint8Array): { width: number; height: number; data: Float32Array; file: ExrFile } {
  const f = parseExr(bytes);
  const { width, height } = f;
  const bps = f.channels[0]!.pixelType === 1 ? 2 : 4;
  const data = new Float32Array(width * height * 4);
  const slot: Record<string, number> = { R: 0, G: 1, B: 2, A: 3 };
  if (!f.channels.some((c) => c.name === 'A')) for (let i = 3; i < data.length; i += 4) data[i] = 1;

  const linesPerBlock = f.compression === 3 ? 16 : 1;
  for (const chunk of f.chunks) {
    const raw = rawBlock(f, chunk);
    const rv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const lines = Math.min(linesPerBlock, height - chunk.y);
    let off = 0;
    for (let dy = 0; dy < lines; dy++) {
      for (const c of f.channels) {
        const s = slot[c.name];
        for (let x = 0; x < width; x++) {
          const val = bps === 2
            ? unpackF16(Uint16Array.of(rv.getUint16(off, true)))[0]!
            : rv.getFloat32(off, true);
          off += bps;
          if (s !== undefined) data[((chunk.y + dy) * width + x) * 4 + s] = val;
        }
      }
    }
  }
  return { width, height, data, file: f };
}

// ── fixtures ────────────────────────────────────────────────────────────────

/** 37x21 (deliberately not a multiple of 16, so the last ZIP block is partial). */
const W = 37, H = 21;

function makeFrame(space: PixelSpace = 'srgb-linear'): DeepFrame {
  const f = createDeepFrame(W, H, space);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      f.data[i] = (x / (W - 1)) * 4;        // HDR headroom: values well above 1
      f.data[i + 1] = y / (H - 1);
      f.data[i + 2] = -0.05 + x * 0.001;    // out-of-gamut: values below 0
      f.data[i + 3] = 1;
    }
  }
  return f;
}

/** What a HALF round trip must produce: packF16 then back, nothing else. */
const halfRound = (src: Float32Array): Float32Array => unpackF16(packF16(src));

/**
 * The classic bug: delta-encode first, THEN reorder. Same two operations, wrong
 * order, and the result inflates perfectly while decoding to garbage. Used as a
 * negative control in two places.
 */
function deltaThenReorder(src: Uint8Array): Uint8Array {
  const n = src.length;
  const d = new Uint8Array(src);
  let p = d[0]!;
  for (let i = 1; i < n; i++) { const cur = d[i]!; d[i] = (cur - p + 384) & 0xff; p = cur; }
  const out = new Uint8Array(n);
  let t1 = 0, t2 = (n + 1) >> 1, s = 0;
  for (;;) { if (s < n) out[t1++] = d[s++]!; else break; if (s < n) out[t2++] = d[s++]!; else break; }
  return out;
}

// ── header + layout ─────────────────────────────────────────────────────────

test('magic, version and flags are the spec bytes', () => {
  const bytes = packExr(makeFrame());
  // File Layout, "Magic Number": 0x76 0x2f 0x31 0x01.
  assert.deepEqual(Array.from(bytes.subarray(0, 4)), [0x76, 0x2f, 0x31, 0x01]);
  const f = parseExr(bytes);
  assert.equal(f.magic, EXR_MAGIC);
  assert.equal(f.version, 2);
  // No tile (bit 9), long-name (10), deep (11) or multipart (12) flag.
  assert.equal(f.flags, 0);
});

test('every required attribute is present, correctly typed and correctly valued', () => {
  const f = parseExr(packExr(makeFrame()));
  const types = Object.fromEntries(f.attrs.map((a) => [a.name, a.type]));
  assert.deepEqual(types, {
    channels: 'chlist',
    compression: 'compression',
    dataWindow: 'box2i',
    displayWindow: 'box2i',
    lineOrder: 'lineOrder',
    pixelAspectRatio: 'float',
    screenWindowCenter: 'v2f',
    screenWindowWidth: 'float',
  });
  // box2i bounds are INCLUSIVE.
  assert.deepEqual(f.dataWindow, [0, 0, W - 1, H - 1]);
  assert.deepEqual(f.displayWindow, [0, 0, W - 1, H - 1]);
  assert.equal(f.lineOrder, 0);           // INCREASING_Y
  assert.equal(f.pixelAspectRatio, 1);
  assert.deepEqual(f.screenWindowCenter, [0, 0]);
  assert.equal(f.screenWindowWidth, 1);
  assert.equal(f.compression, 3);         // ZIP is the default
  // Attribute names are written sorted, which is what makes output deterministic.
  const names = f.attrs.map((a) => a.name);
  assert.deepEqual(names, [...names].sort());
});

test('channels are alphabetical A,B,G,R with the spec sub-fields', () => {
  const f = parseExr(packExr(makeFrame()));
  assert.deepEqual(f.channels.map((c) => c.name), ['A', 'B', 'G', 'R']);
  for (const c of f.channels) {
    assert.equal(c.pixelType, 1);         // HALF
    assert.equal(c.pLinear, 0);
    assert.deepEqual(c.reserved, [0, 0, 0]);
    assert.equal(c.xSampling, 1);
    assert.equal(c.ySampling, 1);
  }
  const rgb = parseExr(packExr(makeFrame(), { channels: 'rgb' }));
  assert.deepEqual(rgb.channels.map((c) => c.name), ['B', 'G', 'R']);
  const flt = parseExr(packExr(makeFrame(), { pixelType: 'float' }));
  for (const c of flt.channels) assert.equal(c.pixelType, 2);   // FLOAT
});

test('compression ids and scan lines per block match the spec table', () => {
  const cases: [PackExrOptions['compression'], number, number][] = [
    ['none', 0, 1], ['zips', 2, 1], ['zip', 3, 16],
  ];
  for (const [name, code, lines] of cases) {
    const f = parseExr(packExr(makeFrame(), { compression: name }));
    assert.equal(f.compression, code, `${name} id`);
    assert.equal(f.chunks.length, Math.ceil(H / lines), `${name} chunk count`);
    assert.deepEqual(f.chunks.map((c) => c.y), Array.from({ length: Math.ceil(H / lines) }, (_, i) => i * lines));
  }
});

test('the offset table points at real chunk starts and the file ends on the last one', () => {
  for (const compression of ['none', 'zips', 'zip'] as const) {
    const bytes = packExr(makeFrame(), { compression });
    const f = parseExr(bytes);
    // First entry sits immediately after the table, which sits after the header.
    assert.equal(f.tableStart, f.headerEnd, `${compression}: table follows header`);
    assert.equal(f.offsets[0], f.headerEnd + f.chunks.length * 8, `${compression}: first offset`);
    let expected = f.offsets[0]!;
    for (const c of f.chunks) {
      assert.equal(c.offset, expected, `${compression}: chunk at y=${c.y} offset`);
      // The entry points at the chunk's FIRST byte (the y field), not the data.
      assert.equal(new DataView(bytes.buffer, bytes.byteOffset).getInt32(c.offset, true), c.y);
      assert.ok(c.dataSize > 0 && c.offset + 8 + c.dataSize <= bytes.length, `${compression}: y=${c.y} in bounds`);
      expected += 8 + c.dataSize;
    }
    assert.equal(expected, bytes.length, `${compression}: last chunk ends at EOF, no slack`);
    // Strictly increasing (INCREASING_Y, no interleaving).
    for (let i = 1; i < f.offsets.length; i++) assert.ok(f.offsets[i]! > f.offsets[i - 1]!);
  }
});

test('the last ZIP block is partial when height is not a multiple of 16', () => {
  const f = parseExr(packExr(makeFrame()));
  assert.equal(H % 16, 5);
  assert.deepEqual(f.chunks.map((c) => c.y), [0, 16]);
  const bps = 2, chans = 4;
  // NONE gives one raw scan line per chunk, so we can size the blocks exactly.
  const none = parseExr(packExr(makeFrame(), { compression: 'none' }));
  assert.equal(none.chunks[0]!.dataSize, W * bps * chans);
  assert.equal(rawBlock(f, f.chunks[0]!).length, 16 * W * bps * chans);
  assert.equal(rawBlock(f, f.chunks[1]!).length, 5 * W * bps * chans);
});

// ── pixels ──────────────────────────────────────────────────────────────────

test('HALF pixels round-trip exactly through the half-float contract', () => {
  const frame = makeFrame();
  const { width, height, data } = decodeExr(packExr(frame));
  assert.equal(width, W);
  assert.equal(height, H);
  assert.deepEqual(Array.from(data), Array.from(halfRound(frame.data)));
});

test('every HALF sample in the file is byte-identical to packF16', () => {
  const frame = makeFrame();
  const bytes = packExr(frame, { compression: 'none' });   // raw chunks: no inflate needed
  const f = parseExr(bytes);
  const expect = packF16(frame.data);                       // packF16 over the whole RGBA buffer
  const slot: Record<string, number> = { A: 3, B: 2, G: 1, R: 0 };
  for (const chunk of f.chunks) {
    const rv = new DataView(chunk.body.buffer, chunk.body.byteOffset, chunk.body.byteLength);
    let off = 0;
    for (const c of f.channels) {
      for (let x = 0; x < W; x++) {
        const got = rv.getUint16(off, true); off += 2;
        assert.equal(got, expect[(chunk.y * W + x) * 4 + slot[c.name]!]!, `y=${chunk.y} x=${x} ch=${c.name}`);
      }
    }
  }
});

test('FLOAT pixels round-trip at float32 precision (no half rounding)', () => {
  const frame = makeFrame();
  const { data } = decodeExr(packExr(frame, { pixelType: 'float' }));
  assert.deepEqual(Array.from(data), Array.from(frame.data));
  // Negative control: the same frame at HALF must NOT be exact here.
  const half = decodeExr(packExr(frame)).data;
  assert.notDeepEqual(Array.from(half), Array.from(frame.data));
});

test('HDR headroom and out-of-gamut negatives survive; nothing is clamped', () => {
  const f = createDeepFrame(4, 1);
  f.data.set([
    12.5, -3.25, 0.5, 1,
    65504, -65504, 1e-7, 1,          // 65504 = largest finite half
    100000, -0.0, 6.1e-5, 0.5,       // 100000 overflows half to +Inf (IEEE 754 RNE)
    Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 0, 1,
  ]);
  const straight = { alpha: 'straight' } as const;
  const half = decodeExr(packExr(f, { compression: 'none', ...straight })).data;
  assert.equal(half[0], 12.5);
  assert.equal(half[1], -3.25);
  assert.equal(half[4], 65504);
  assert.equal(half[5], -65504);
  assert.equal(half[8], Number.POSITIVE_INFINITY);
  assert.equal(half[12], Number.POSITIVE_INFINITY);
  assert.equal(half[13], Number.NEGATIVE_INFINITY);
  const flt = decodeExr(packExr(f, { pixelType: 'float', ...straight })).data;
  assert.equal(flt[8], 100000);      // float32 holds it
  assert.equal(flt[10], Math.fround(6.1e-5));
});

test('NONE, ZIPS and ZIP produce identical PIXELS - a container choice, not a pixel one', () => {
  const frame = makeFrame();
  const none = decodeExr(packExr(frame, { compression: 'none' })).data;
  const zips = decodeExr(packExr(frame, { compression: 'zips' })).data;
  const zip = decodeExr(packExr(frame, { compression: 'zip' })).data;
  assert.deepEqual(Array.from(zips), Array.from(none));
  assert.deepEqual(Array.from(zip), Array.from(none));
  // ...and the bytes are genuinely different (otherwise the above is vacuous).
  assert.notEqual(packExr(frame, { compression: 'zip' }).length, packExr(frame, { compression: 'none' }).length);
});

// ── the ZIP predictor, the part people get wrong ─────────────────────────────

test('a ZIP chunk inflates to the pre-predictor bytes and then to the NONE blocks', () => {
  const frame = makeFrame();
  const zip = parseExr(packExr(frame, { compression: 'zip' }));
  const none = parseExr(packExr(frame, { compression: 'none' }));
  const rowBytes = W * 2 * 4;

  for (const chunk of zip.chunks) {
    const lines = Math.min(16, H - chunk.y);
    // The NONE file's chunk bodies ARE the raw block bytes for those scan lines.
    const wantRaw = new Uint8Array(lines * rowBytes);
    for (let i = 0; i < lines; i++) wantRaw.set(none.chunks[chunk.y + i]!.body, i * rowBytes);

    assert.ok(chunk.dataSize < wantRaw.length, `y=${chunk.y}: chunk actually compressed`);
    const inflated = new Uint8Array(inflateSync(chunk.body));
    assert.equal(inflated.length, wantRaw.length, `y=${chunk.y}: inflated size`);
    // Step 1: inflate gives the PREPROCESSED bytes, which are NOT the raw ones.
    assert.notDeepEqual(Array.from(inflated), Array.from(wantRaw), `y=${chunk.y}: predictor was applied`);
    // Step 2: undoing delta-then-interleave lands exactly on the raw bytes.
    assert.deepEqual(Array.from(zipUnpreprocess(inflated)), Array.from(wantRaw), `y=${chunk.y}: predictor inverse`);
  }
});

test('the preprocessing is reorder-THEN-delta, not delta-then-reorder', () => {
  // Negative control against the classic bug. Build the wrong-order transform
  // and assert the writer did not produce it.
  const frame = makeFrame();
  const zip = parseExr(packExr(frame, { compression: 'zip' }));
  const none = parseExr(packExr(frame, { compression: 'none' }));
  const rowBytes = W * 2 * 4;
  const chunk = zip.chunks[0]!;
  const raw = new Uint8Array(16 * rowBytes);
  for (let i = 0; i < 16; i++) raw.set(none.chunks[i]!.body, i * rowBytes);

  const inflated = new Uint8Array(inflateSync(chunk.body));
  assert.notDeepEqual(Array.from(inflated), Array.from(deltaThenReorder(raw)));
  // And the delta must be first-order over the ORIGINAL bytes, not a running
  // sum of deltas: the reorder halves must appear as byte pairs 0,2,4,... then
  // 1,3,5,... which the inverse above already proved. Spot-check byte 0 is the
  // untouched first reordered byte (the predictor starts at index 1).
  assert.equal(inflated[0], raw[0]);
});

test('a block larger than one deflate slab streams correctly across pushes', () => {
  // 1000 x 16 x 4 channels x 2 bytes = 128000 raw bytes per ZIP block: one full
  // 64 KiB slab plus a 62464-byte remainder, so the streaming compressor's
  // cross-slab window and its lazy-match state actually have to survive a push
  // boundary in the middle of a block.
  const w = 1000, h = 20;
  const f = createDeepFrame(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      f.data[i] = Math.sin(x * 0.01) * 2;
      f.data[i + 1] = (x % 97) / 96;
      f.data[i + 2] = y / h;
      f.data[i + 3] = 1;
    }
  }
  const bytes = packExr(f, { alpha: 'straight' });
  const parsed = parseExr(bytes);
  assert.equal(parsed.chunks.length, 2);
  assert.equal(rawBlock(parsed, parsed.chunks[0]!).length, 128000, 'block spans a slab boundary');
  assert.ok(parsed.chunks[0]!.dataSize < 128000, 'and it compressed');
  assert.deepEqual(Array.from(decodeExr(bytes).data), Array.from(halfRound(f.data)));
});

test('an incompressible block is stored raw rather than growing the file', () => {
  // Random float32 noise: deflate cannot shrink it, so the writer must fall back
  // to the raw block (a chunk whose dataSize is NOT smaller than the block would
  // otherwise be read as raw by a conforming reader and decode to garbage).
  let seed = 12345;
  const rnd = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const f = createDeepFrame(64, 16);
  for (let i = 0; i < f.data.length; i++) f.data[i] = rnd() * 1000 - 500;
  const bytes = packExr(f, { pixelType: 'float', alpha: 'straight' });
  const parsed = parseExr(bytes);
  const expected = 16 * 64 * 4 * 4;
  assert.equal(parsed.chunks.length, 1);
  assert.equal(parsed.chunks[0]!.dataSize, expected, 'stored raw at exactly the block size');
  // ...and it still decodes.
  assert.deepEqual(Array.from(decodeExr(bytes).data), Array.from(f.data));
  // Negative control: the smooth gradient DOES compress, so the branch above is
  // not the only one ever taken.
  const smooth = parseExr(packExr(makeFrame(), { pixelType: 'float', alpha: 'straight' }));
  assert.ok(smooth.chunks[0]!.dataSize < 16 * W * 4 * 4);
});

// ── alpha ───────────────────────────────────────────────────────────────────

test('alpha is premultiplied by default and left alone on request', () => {
  const f = createDeepFrame(2, 1);
  f.data.set([0.8, 0.4, 0.2, 0.5, 1.0, 0.5, 0.25, 0.0]);
  const pre = decodeExr(packExr(f, { compression: 'none' })).data;
  const half = (v: number): number => unpackF16(packF16(Float32Array.of(v)))[0]!;
  assert.equal(pre[0], half(0.4));   // 0.8 * 0.5
  assert.equal(pre[1], half(0.2));
  assert.equal(pre[2], half(0.1));
  assert.equal(pre[3], half(0.5));   // alpha itself is never scaled
  assert.equal(pre[4], 0);           // alpha 0 zeroes the colour, as associated alpha means
  assert.equal(pre[7], 0);

  const straight = decodeExr(packExr(f, { compression: 'none', alpha: 'straight' })).data;
  assert.equal(straight[0], half(0.8));
  assert.equal(straight[4], half(1.0));

  // The caller's frame is never mutated by either path.
  assert.deepEqual(Array.from(f.data), [0.8, 0.4, 0.2, 0.5, 1.0, 0.5, 0.25, 0.0].map(Math.fround));

  // channels:'rgb' drops A and does not premultiply against a channel it dropped.
  const rgb = decodeExr(packExr(f, { compression: 'none', channels: 'rgb' })).data;
  assert.equal(rgb.length, 2 * 4);
  assert.equal(rgb[3], 1, 'decoder default alpha, no A channel in the file');
  assert.equal(rgb[0], half(0.8), 'rgb output is not premultiplied');
});

// ── colour tagging ──────────────────────────────────────────────────────────

test('chromaticities: absent for sRGB, written for wide spaces, overridable', () => {
  // Absent MEANS Rec.709/D65 in the format, so writing it for srgb-linear would
  // be redundant bytes saying the same thing.
  assert.equal(parseExr(packExr(makeFrame('srgb-linear'))).chromaticities, null);

  const p3 = parseExr(packExr(makeFrame('display-p3-linear'))).chromaticities!;
  assert.deepEqual(p3.map((v) => Number(v.toFixed(4))), [0.68, 0.32, 0.265, 0.69, 0.15, 0.06, 0.3127, 0.329]);

  const r2020 = parseExr(packExr(makeFrame('rec2020-linear'))).chromaticities!;
  assert.deepEqual(r2020.map((v) => Number(v.toFixed(4))), [0.708, 0.292, 0.17, 0.797, 0.131, 0.046, 0.3127, 0.329]);

  // 'always' spells Rec.709 out; 'never' suppresses even a wide tag.
  const forced = parseExr(packExr(makeFrame('srgb-linear'), { chromaticities: 'always' })).chromaticities!;
  assert.deepEqual(forced.map((v) => Number(v.toFixed(4))), [0.64, 0.33, 0.3, 0.6, 0.15, 0.06, 0.3127, 0.329]);
  assert.equal(parseExr(packExr(makeFrame('rec2020-linear'), { chromaticities: 'never' })).chromaticities, null);

  // An explicit tuple wins (ACES AP0, SMPTE ST 2065-1, as a worked example).
  const ap0 = [0.7347, 0.2653, 0.0, 1.0, 0.0001, -0.077, 0.32168, 0.33767];
  const got = parseExr(packExr(makeFrame(), { chromaticities: ap0 })).chromaticities!;
  assert.deepEqual(got.map((v) => Number(v.toFixed(5))), ap0.map((v) => Number(v.toFixed(5))));

  // The attribute stays in its alphabetical slot, right after channels.
  const f = parseExr(packExr(makeFrame('rec2020-linear')));
  assert.deepEqual(f.attrs.slice(0, 2).map((a) => a.name), ['channels', 'chromaticities']);
});

test('non-RGB spaces are refused rather than mis-tagged', () => {
  for (const space of ['lab', 'xyz-d50'] as const) {
    assert.throws(() => packExr(makeFrame(space)), /not an RGB space/, space);
  }
});

// ── extra attributes ────────────────────────────────────────────────────────

test('string attributes are written sorted, unterminated, and cannot shadow ours', () => {
  const bytes = packExr(makeFrame(), { attributes: { zed: 'last', comments: 'made with lolly', owner: 'andy' } });
  const f = parseExr(bytes);
  assert.deepEqual(f.strings, { comments: 'made with lolly', owner: 'andy', zed: 'last' });
  // A string attribute's size IS its length: no trailing NUL.
  const a = f.attr('owner')!;
  assert.equal(a.data.length, 4);
  assert.equal(a.data[3], 'y'.charCodeAt(0));
  // Extras come after the required set, in sorted order.
  const names = f.attrs.map((n) => n.name);
  assert.deepEqual(names.slice(-3), ['comments', 'owner', 'zed']);
  assert.ok(names.indexOf('comments') > names.indexOf('screenWindowWidth'));

  assert.throws(() => packExr(makeFrame(), { attributes: { compression: 'nope' } }), /cannot be overridden/);
  assert.throws(() => packExr(makeFrame(), { attributes: { '': 'x' } }), /must not be empty/);
});

test('the long-name flag is set only when a name actually needs it', () => {
  const short = 'a'.repeat(31);
  const long = 'a'.repeat(32);
  assert.equal(parseExr(packExr(makeFrame(), { attributes: { [short]: 'v' } })).flags, 0);
  // File Layout, "Version Field" bit 10.
  assert.equal(parseExr(packExr(makeFrame(), { attributes: { [long]: 'v' } })).flags, 0x400);
  assert.throws(() => packExr(makeFrame(), { attributes: { ['a'.repeat(256)]: 'v' } }), /exceeds 255 bytes/);
});

test('UTF-8 attribute values survive byte-for-byte', () => {
  const f = parseExr(packExr(makeFrame(), { attributes: { comments: 'scène linéaire \u{1F3AC}' } }));
  assert.equal(f.strings.comments, 'scène linéaire \u{1F3AC}');
});

// ── negative controls ───────────────────────────────────────────────────────

test('bad inputs throw instead of writing a broken file', () => {
  const f = makeFrame();
  assert.throws(() => packExr({ ...f, width: 0 }), /invalid frame dimensions/);
  assert.throws(() => packExr({ ...f, height: -1 }), /invalid frame dimensions/);
  assert.throws(() => packExr({ ...f, width: 1.5 }), /invalid frame dimensions/);
  assert.throws(() => packExr({ ...f, width: W + 1 }), /buffer length/);
  assert.throws(() => packExr(f, { pixelType: 'double' as never }), /unknown pixelType/);
  assert.throws(() => packExr(f, { compression: 'piz' as never }), /unknown compression/);
  assert.throws(() => packExr(f, { pixelAspectRatio: 0 }), /pixelAspectRatio/);
  assert.throws(() => packExr(f, { pixelAspectRatio: Number.NaN }), /pixelAspectRatio/);
  assert.throws(() => packExr(f, { chromaticities: [1, 2, 3] }), /8 numbers/);
  assert.throws(() => packExr(f, { chromaticities: [1, 2, 3, 4, 5, 6, 7, Number.NaN] }), /finite/);
});

test('a 1x1 frame is a valid file (no off-by-one in the block maths)', () => {
  const f = createDeepFrame(1, 1);
  f.data.set([0.25, 0.5, 0.75, 1]);
  for (const compression of ['none', 'zips', 'zip'] as const) {
    const parsed = parseExr(packExr(f, { compression }));
    assert.equal(parsed.chunks.length, 1);
    assert.deepEqual(parsed.dataWindow, [0, 0, 0, 0]);
    assert.deepEqual(Array.from(decodeExr(packExr(f, { compression })).data), Array.from(halfRound(f.data)));
  }
});

test('output is byte-deterministic across runs and independent of the input object', () => {
  const a = packExr(makeFrame(), { attributes: { comments: 'x' } });
  const b = packExr(makeFrame(), { attributes: { comments: 'x' } });
  assert.deepEqual(Array.from(a), Array.from(b));
  // Insertion order of `attributes` must not change the bytes.
  const c = packExr(makeFrame(), { attributes: { b: '2', a: '1' } });
  const d = packExr(makeFrame(), { attributes: { a: '1', b: '2' } });
  assert.deepEqual(Array.from(c), Array.from(d));
});

// ── external oracle: the OpenEXR reference library ──────────────────────────

/**
 * Re-encode a real ZIP file's chunks through `transform` instead of the
 * writer's preprocessing, keeping the header identical and repairing the offset
 * table. Used to build a file that is structurally perfect and preprocessed
 * WRONG, so the oracle's verdict on the good file is demonstrably not vacuous.
 */
function reencodeZipChunks(frame: DeepFrame, transform: (raw: Uint8Array) => Uint8Array): Uint8Array {
  const bytes = packExr(frame, { compression: 'zip', alpha: 'straight' });
  const f = parseExr(bytes);
  const bodies = f.chunks.map((c) => new Uint8Array(deflateSync(transform(rawBlock(f, c)))));
  const total = f.headerEnd + f.chunks.length * 8 + bodies.reduce((n, b) => n + 8 + b.length, 0);
  const out = new Uint8Array(total);
  out.set(bytes.subarray(0, f.headerEnd));
  const v = new DataView(out.buffer);
  let cursor = f.headerEnd + f.chunks.length * 8;
  let t = f.headerEnd;
  for (const b of bodies) { v.setBigUint64(t, BigInt(cursor), true); t += 8; cursor += 8 + b.length; }
  let at = f.headerEnd + f.chunks.length * 8;
  for (let i = 0; i < bodies.length; i++) {
    v.setInt32(at, f.chunks[i]!.y, true); at += 4;
    v.setInt32(at, bodies[i]!.length, true); at += 4;
    out.set(bodies[i]!, at); at += bodies[i]!.length;
  }
  return out;
}


function findOraclePython(): string | null {
  const candidates = [process.env.EXR_ORACLE_PYTHON, 'python3', 'python'].filter(Boolean) as string[];
  for (const py of candidates) {
    try {
      execFileSync(py, ['-c', 'import OpenEXR, numpy'], { stdio: 'ignore' });
      return py;
    } catch { /* not this one */ }
  }
  return null;
}

test('the OpenEXR reference library decodes every variant bit-exactly', (t) => {
  const py = findOraclePython();
  if (!py) {
    t.skip('no python with the OpenEXR + numpy bindings (set EXR_ORACLE_PYTHON=/path/to/python)');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'lolly-exr-'));
  try {
    const frame = makeFrame();
    const variants: [string, PackExrOptions][] = [
      ['zip.exr', {}],
      ['zips.exr', { compression: 'zips' }],
      ['none.exr', { compression: 'none' }],
      ['float.exr', { pixelType: 'float' }],
      ['rgb.exr', { channels: 'rgb' }],
    ];
    for (const [name, opts] of variants) {
      writeFileSync(join(dir, name), packExr(frame, { alpha: 'straight', ...opts }));
    }
    // Negative control ON THE ORACLE: structurally identical, preprocessed in
    // the wrong order. If the reference library reads this as the same pixels,
    // every "bit-exact" claim above is measuring nothing.
    writeFileSync(join(dir, 'wrongorder.exr'), reencodeZipChunks(frame, deltaThenReorder));
    writeFileSync(join(dir, 'expected.raw'), Buffer.from(halfRound(frame.data).buffer));
    writeFileSync(join(dir, 'expected32.raw'), Buffer.from(new Float32Array(frame.data).buffer));

    const script = `
import OpenEXR, numpy as np, sys, os
d = sys.argv[1]
W, H = ${W}, ${H}
half = np.fromfile(os.path.join(d,'expected.raw'), dtype=np.float32).reshape(H,W,4)
full = np.fromfile(os.path.join(d,'expected32.raw'), dtype=np.float32).reshape(H,W,4)
codes = {'zip.exr':3,'zips.exr':2,'none.exr':0,'float.exr':3,'rgb.exr':3}
for name, code in codes.items():
    f = OpenEXR.File(os.path.join(d,name))
    hdr = f.header()
    assert int(hdr['compression'].value) == code, (name,'compression',hdr['compression'])
    dw = hdr['dataWindow']
    assert list(np.ravel(dw[0])) == [0,0] and list(np.ravel(dw[1])) == [W-1,H-1], (name,'dataWindow',dw)
    assert 'chromaticities' not in hdr, (name,'unexpected chromaticities')
    ch = f.channels()
    key = list(ch.keys())[0]
    assert key in ('RGBA','RGB'), (name,'channels',list(ch.keys()))
    got = np.asarray(ch[key].pixels).astype(np.float32)
    want = (full if name == 'float.exr' else half)[:,:,:got.shape[-1]]
    assert got.shape == want.shape, (name,'shape',got.shape,want.shape)
    assert np.array_equal(got, want), (name,'pixels differ, max', np.abs(got-want).max())
    exp = np.float32 if name == 'float.exr' else np.float16
    assert ch[key].pixels.dtype == exp, (name,'dtype',ch[key].pixels.dtype)
# chromaticities + string attributes on a wide-gamut file
f = OpenEXR.File(os.path.join(d,'wide.exr'))
c = f.header()['chromaticities']
assert [round(float(v),4) for v in np.ravel(c)] == [0.708,0.292,0.17,0.797,0.131,0.046,0.3127,0.329], c
assert f.header()['comments'] == 'made with lolly', f.header()['comments']
# negative control: the wrong-order predictor must NOT decode to the same pixels
try:
    bad = np.asarray(OpenEXR.File(os.path.join(d,'wrongorder.exr')).channels()['RGBA'].pixels).astype(np.float32)
    assert not np.array_equal(bad, half), 'wrong-order predictor decoded identically - the oracle proves nothing'
except OSError as e:
    pass  # the reference reader rejecting it outright is an equally good verdict
print('OK')
`;
    writeFileSync(join(dir, 'wide.exr'), packExr(makeFrame('rec2020-linear'), { attributes: { comments: 'made with lolly' } }));
    const out = execFileSync(py, ['-c', script, dir], { encoding: 'utf8' });
    assert.match(out, /OK/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── DCC oracle: Blender ──────────────────────────────────────────────────────
// The gap the header used to name ("no file here has been opened in Nuke,
// Resolve, Blender or any other DCC") — closed for Blender, which is the one a
// designer is most likely to have. Blender's EXR path is OpenImageIO, i.e. a
// SECOND independent implementation from the ASWF reference bindings above, and
// it is what actually matters: a file being spec-legal and a file opening in the
// app someone uses are different claims.
//
// Gated like the Python oracle: set LOLLY_BLENDER=/path/to/blender, or have it
// at the default macOS location. Runs headless (--background), so it never
// touches an open GUI session.
function findBlender(): string | null {
  const candidates = [
    process.env.LOLLY_BLENDER,
    '/Applications/Blender.app/Contents/MacOS/Blender',
    'blender',
  ].filter(Boolean) as string[];
  for (const b of candidates) {
    try {
      execFileSync(b, ['--version'], { stdio: 'ignore' });
      return b;
    } catch { /* not this one */ }
  }
  return null;
}

const BLENDER = findBlender();
const SKIP_BLENDER = BLENDER ? false : 'Blender not found (set LOLLY_BLENDER to run the DCC oracle)';

test('DCC oracle: Blender reads our EXR with the exact pixels, half and float', { skip: SKIP_BLENDER }, () => {
  // Values chosen so the test would fail on the classic mistakes: real HDR
  // headroom (>1.0) that only a float container can hold, exact powers of two
  // that survive half rounding, and a bottom-left/top-right asymmetry that
  // catches a flipped or transposed image.
  const px = [
    [0.25, 0.5, 0.75, 1], [1, 1, 1, 1], [4, 2, 0.5, 1], [12.5, 0.125, 0.0625, 1],
    [0, 0, 0, 1], [0.5, 0.25, 0.125, 1], [2.5, 2.5, 2.5, 1], [0.75, 8, 1.5, 1],
  ];
  const f = createDeepFrame(4, 2, 'rec2020-linear');
  px.forEach((p, i) => { for (let c = 0; c < 4; c++) f.data[i * 4 + c] = p[c]!; });

  const dir = mkdtempSync(join(tmpdir(), 'lolly-blender-'));
  try {
    writeFileSync(join(dir, 'half.exr'), packExr(f, { compression: 'zip' }));
    writeFileSync(join(dir, 'float.exr'), packExr(f, { compression: 'zip', pixelType: 'float' }));
    const script = join(dir, 'check.py');
    writeFileSync(script, [
      'import bpy',
      `D = ${JSON.stringify(dir)} + "/"`,
      `EXPECT = ${JSON.stringify(px)}`,
      'bad = []',
      'for name, tol in (("half.exr", 1e-3), ("float.exr", 1e-6)):',
      '    img = bpy.data.images.load(D + name)',
      '    img.colorspace_settings.name = "Non-Color"',
      '    p = list(img.pixels); w, h = img.size',
      '    if (w, h) != (4, 2): bad.append(name + ": size %dx%d" % (w, h))',
      '    for i in range(8):',
      '        row, col = divmod(i, 4)',
      '        b = ((h - 1 - row) * w + col) * 4   # Blender stores bottom-up',
      '        for c in range(4):',
      '            got, exp = p[b + c], EXPECT[i][c]',
      '            if abs(got - exp) > tol * max(1.0, abs(exp)):',
      '                bad.append("%s px%d ch%d exp %g got %g" % (name, i, c, exp, got))',
      'print("BLENDER_RESULT:" + ("OK" if not bad else "FAIL " + "; ".join(bad)))',
    ].join('\n'));
    const out = execFileSync(BLENDER!, ['--background', '--python', script], { encoding: 'utf8' });
    const line = out.split('\n').find(l => l.startsWith('BLENDER_RESULT:')) ?? '(no result line)';
    assert.equal(line, 'BLENDER_RESULT:OK', `Blender disagreed: ${line}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
