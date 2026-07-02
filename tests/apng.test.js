/**
 * APNG packer byte-structure contract tests.
 * Run with: node --test tests/apng.test.js
 *
 * Builds tiny REAL PNGs (deflateSync scanlines, real CRCs) and ships its own
 * chunk parser + CRC so assertions read against the packed byte stream, not
 * the packer's internals.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync, inflateSync } from 'node:zlib';

import { packApng } from '../engine/src/apng.js';

const PNG_SIG = Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

// ─── independent CRC / chunk helpers (mirror the PNG spec, not apng.js) ──────
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c;
}
function crc32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

const u32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const u16 = (b, o) => (b[o] << 8) | b[o + 1];

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  out[0] = (data.length >>> 24) & 0xff; out[1] = (data.length >>> 16) & 0xff;
  out[2] = (data.length >>> 8) & 0xff; out[3] = data.length & 0xff;
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  const crc = crc32(out.subarray(4, 8 + data.length));
  out[8 + data.length] = (crc >>> 24) & 0xff; out[9 + data.length] = (crc >>> 16) & 0xff;
  out[10 + data.length] = (crc >>> 8) & 0xff; out[11 + data.length] = crc & 0xff;
  return out;
}

// Minimal real PNG: RGBA8, filter 0 scanlines, one pixel value throughout.
// idatSplit chops the deflate stream into that many IDAT chunks; extraChunks
// = [{type, data, afterIdat}] injects ancillary chunks around the IDATs.
function makePng({ width = 2, height = 1, pixel = [255, 0, 0, 255], idatSplit = 1, extraChunks = [] } = {}) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 4);
    raw[row] = 0; // filter: none
    for (let x = 0; x < width; x++) raw.set(pixel, row + 1 + x * 4);
  }
  const zdata = deflateSync(raw);
  const ihdr = new Uint8Array(13);
  ihdr[0] = (width >>> 24) & 0xff; ihdr[1] = (width >>> 16) & 0xff; ihdr[2] = (width >>> 8) & 0xff; ihdr[3] = width & 0xff;
  ihdr[4] = (height >>> 24) & 0xff; ihdr[5] = (height >>> 16) & 0xff; ihdr[6] = (height >>> 8) & 0xff; ihdr[7] = height & 0xff;
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const parts = [PNG_SIG, chunk('IHDR', ihdr)];
  for (const e of extraChunks) if (!e.afterIdat) parts.push(chunk(e.type, e.data));
  const step = Math.ceil(zdata.length / idatSplit);
  for (let o = 0; o < zdata.length; o += step) parts.push(chunk('IDAT', Uint8Array.from(zdata.subarray(o, o + step))));
  for (const e of extraChunks) if (e.afterIdat) parts.push(chunk(e.type, e.data));
  parts.push(chunk('IEND', new Uint8Array(0)));
  return Uint8Array.from(Buffer.concat(parts));
}

// Structural parser: returns [{type, data, crcOk}] and asserts overall framing.
function parseChunks(bytes) {
  assert.deepEqual(Array.from(bytes.subarray(0, 8)), Array.from(PNG_SIG), 'PNG signature intact');
  const chunks = [];
  let off = 8;
  while (off < bytes.length) {
    assert.ok(off + 12 <= bytes.length, 'chunk header fits');
    const len = u32(bytes, off);
    assert.ok(off + 12 + len <= bytes.length, 'chunk body fits');
    const type = String.fromCharCode(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7]);
    const data = bytes.subarray(off + 8, off + 8 + len);
    const crcOk = crc32(bytes.subarray(off + 4, off + 8 + len)) === u32(bytes, off + 8 + len);
    chunks.push({ type, data, crcOk });
    off += 12 + len;
  }
  return chunks;
}

const text = (s) => Uint8Array.from(Buffer.from(s, 'latin1'));

// ─── tests ────────────────────────────────────────────────────────────────────

test('packs frames into a structurally valid APNG', () => {
  const frames = [
    makePng({ pixel: [255, 0, 0, 255], extraChunks: [{ type: 'tEXt', data: text('Software\0lolly') }] }),
    makePng({ pixel: [0, 255, 0, 255] }),
    makePng({ pixel: [0, 0, 255, 255], idatSplit: 2 }),
  ];
  const out = packApng(frames, { delayMs: 100, loops: 0 });
  assert.ok(out instanceof Uint8Array);
  const chunks = parseChunks(out);

  for (const c of chunks) assert.ok(c.crcOk, `${c.type} CRC valid`);

  // acTL immediately after IHDR, correct counts.
  assert.equal(chunks[0].type, 'IHDR');
  assert.equal(chunks[1].type, 'acTL');
  assert.equal(u32(chunks[1].data, 0), 3, 'num_frames');
  assert.equal(u32(chunks[1].data, 4), 0, 'num_plays: infinite');

  // Frame 0's ancillary chunk preserved in position (between acTL and fcTL 0).
  assert.equal(chunks[2].type, 'tEXt');

  // fcTL 0 directly before frame 0's first IDAT; frame 0 data stays IDAT.
  assert.equal(chunks[3].type, 'fcTL');
  assert.equal(chunks[4].type, 'IDAT');

  // One fcTL per frame; frame 2's split IDAT became two fdAT chunks.
  const types = chunks.map((c) => c.type);
  assert.equal(types.filter((t) => t === 'fcTL').length, 3);
  assert.equal(types.filter((t) => t === 'IDAT').length, 1);
  assert.equal(types.filter((t) => t === 'fdAT').length, 3);
  assert.deepEqual(types.slice(-1), ['IEND']);
  assert.equal(types.filter((t) => t === 'IEND').length, 1);

  // Sequence numbers: shared fcTL/fdAT counter, strictly increasing from 0.
  const seqs = chunks.filter((c) => c.type === 'fcTL' || c.type === 'fdAT').map((c) => u32(c.data, 0));
  assert.deepEqual(seqs, [0, 1, 2, 3, 4, 5]);

  // fcTL contract: full-frame region, den 1000, dispose 0, blend 0.
  for (const c of chunks.filter((c) => c.type === 'fcTL')) {
    assert.equal(c.data.length, 26);
    assert.equal(u32(c.data, 4), 2, 'width');
    assert.equal(u32(c.data, 8), 1, 'height');
    assert.equal(u32(c.data, 12), 0, 'x_offset');
    assert.equal(u32(c.data, 16), 0, 'y_offset');
    assert.equal(u16(c.data, 20), 100, 'delay_num');
    assert.equal(u16(c.data, 22), 1000, 'delay_den');
    assert.equal(c.data[24], 0, 'dispose_op NONE');
    assert.equal(c.data[25], 0, 'blend_op SOURCE');
  }
});

test('fdAT payload round-trips the source frame IDAT data', () => {
  const f0 = makePng({ pixel: [10, 20, 30, 255] });
  const f1 = makePng({ pixel: [40, 50, 60, 255], idatSplit: 2 });
  const out = packApng([f0, f1]);
  const fdats = parseChunks(out).filter((c) => c.type === 'fdAT');
  const zdata = Buffer.concat(fdats.map((c) => c.data.subarray(4))); // strip sequence prefixes
  const raw = inflateSync(zdata);
  assert.deepEqual(Array.from(raw), [0, 40, 50, 60, 255, 40, 50, 60, 255]);
});

test('per-frame delayMs array is honored', () => {
  const frames = [makePng(), makePng(), makePng()];
  const out = packApng(frames, { delayMs: [100, 40, 250] });
  const fctls = parseChunks(out).filter((c) => c.type === 'fcTL');
  assert.deepEqual(fctls.map((c) => u16(c.data, 20)), [100, 40, 250]);
  assert.deepEqual(fctls.map((c) => u16(c.data, 22)), [1000, 1000, 1000]);
});

test('default delay is 67ms; loops encodes into num_plays', () => {
  const out = packApng([makePng(), makePng()], { loops: 3 });
  const chunks = parseChunks(out);
  assert.equal(u32(chunks[1].data, 4), 3, 'num_plays');
  for (const c of chunks.filter((c) => c.type === 'fcTL')) assert.equal(u16(c.data, 20), 67);
});

test('single frame still yields a valid one-frame APNG', () => {
  const chunks = parseChunks(packApng([makePng()]));
  assert.equal(u32(chunks[1].data, 0), 1, 'num_frames');
  assert.equal(chunks.filter((c) => c.type === 'fcTL').length, 1);
  assert.equal(chunks.filter((c) => c.type === 'fdAT').length, 0);
  for (const c of chunks) assert.ok(c.crcOk, `${c.type} CRC valid`);
});

test('mismatched frame geometry throws', () => {
  assert.throws(
    () => packApng([makePng({ width: 2 }), makePng({ width: 3 })]),
    /frame 1 IHDR .*does not match frame 0/,
  );
});

test('garbage input throws', () => {
  assert.throws(() => packApng([Uint8Array.from(Buffer.from('not a png at all'))]), /bad PNG signature/);
  assert.throws(() => packApng([makePng().subarray(0, 20)]), /truncated/);
  assert.throws(() => packApng(['nope']), /not a Uint8Array/);
  assert.throws(() => packApng([]), /non-empty array/);
  assert.throws(() => packApng([makePng()], { loops: -1 }), /loops/);
});
