/**
 * Animated WebP packer byte-structure contract tests.
 * Run with: node --test tests/webp-anim.test.ts
 *
 * Builds tiny still WebPs (real RIFF framing; the image chunks carry dummy
 * payload — the packer never decodes the bitstream) and ships its own
 * little-endian RIFF walker so assertions read the packed bytes, not internals.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { packWebpAnim } from '../engine/src/webp-anim.ts';

const ascii = (s: string): Uint8Array => Uint8Array.from([...s].map(c => c.charCodeAt(0)));
function concat(parts: Uint8Array[]): Uint8Array {
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const u16 = (b: Uint8Array, o: number): number => b[o]! | (b[o + 1]! << 8);
const u24 = (b: Uint8Array, o: number): number => b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16);
const u32 = (b: Uint8Array, o: number): number => (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;
const fourcc = (b: Uint8Array, o: number): string => String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);

// One RIFF chunk: fourcc + u32LE size + payload + pad(0x00 iff odd).
function riffChunk(cc: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(8 + payload.length + (payload.length & 1));
  out.set(ascii(cc), 0);
  const n = payload.length;
  out[4] = n & 0xff; out[5] = (n >>> 8) & 0xff; out[6] = (n >>> 16) & 0xff; out[7] = (n >>> 24) & 0xff;
  out.set(payload, 8);
  return out;
}
// Wrap chunks in a RIFF/WEBP container (a "still" WebP for input).
function stillWebp(chunks: Uint8Array[]): Uint8Array {
  const inner = concat(chunks);
  const out = new Uint8Array(12 + inner.length);
  out.set(ascii('RIFF'), 0);
  const size = 4 + inner.length;
  out[4] = size & 0xff; out[5] = (size >>> 8) & 0xff; out[6] = (size >>> 16) & 0xff; out[7] = (size >>> 24) & 0xff;
  out.set(ascii('WEBP'), 8);
  out.set(inner, 12);
  return out;
}

interface Chunk { cc: string; payload: Uint8Array; full: Uint8Array; }
// Walk an animated WebP's top-level chunks (after the 12-byte RIFF/WEBP header).
function walk(bytes: Uint8Array): Chunk[] {
  assert.equal(fourcc(bytes, 0), 'RIFF', 'RIFF signature');
  assert.equal(fourcc(bytes, 8), 'WEBP', 'WEBP signature');
  assert.equal(u32(bytes, 4), bytes.length - 8, 'RIFF size == total − 8');
  const chunks: Chunk[] = [];
  let p = 12;
  while (p + 8 <= bytes.length) {
    const cc = fourcc(bytes, p);
    const size = u32(bytes, p + 4);
    const full = 8 + size + (size & 1);
    chunks.push({ cc, payload: bytes.subarray(p + 8, p + 8 + size), full: bytes.subarray(p, p + full) });
    p += full;
  }
  assert.equal(p, bytes.length, 'chunks exactly fill the RIFF');
  return chunks;
}

const VP8 = (payload: number[]): Uint8Array => riffChunk('VP8 ', Uint8Array.from(payload));
const VP8L = (payload: number[]): Uint8Array => riffChunk('VP8L', Uint8Array.from(payload));
const ALPH = (payload: number[]): Uint8Array => riffChunk('ALPH', Uint8Array.from(payload));

test('single opaque frame → VP8X(anim) + ANIM + one ANMF, geometry & framing correct', () => {
  const src = stillWebp([VP8([1, 2, 3, 4])]);
  const out = packWebpAnim([src], { width: 40, height: 30, delayMs: 100, loops: 0 });
  const cs = walk(out);
  assert.deepEqual(cs.map(c => c.cc), ['VP8X', 'ANIM', 'ANMF']);

  const vp8x = cs[0]!.payload;
  assert.equal(vp8x.length, 10);
  assert.equal(vp8x[0]! & 0x02, 0x02, 'VP8X animation flag set');
  assert.equal(vp8x[0]! & 0x10, 0, 'no alpha flag (opaque VP8)');
  assert.equal(u24(vp8x, 4), 39, 'canvas width − 1');
  assert.equal(u24(vp8x, 7), 29, 'canvas height − 1');

  const anim = cs[1]!.payload;
  assert.equal(anim.length, 6);
  assert.equal(u16(anim, 4), 0, 'loop_count 0 = infinite');

  const anmf = cs[2]!.payload;
  assert.equal(u24(anmf, 0), 0, 'frame X/2 = 0');
  assert.equal(u24(anmf, 3), 0, 'frame Y/2 = 0');
  assert.equal(u24(anmf, 6), 39, 'frame width − 1');
  assert.equal(u24(anmf, 9), 29, 'frame height − 1');
  assert.equal(u24(anmf, 12), 100, 'frame duration ms');
  assert.equal(anmf[15], 0x02, 'blending=overwrite, disposal=none');
  // Frame data (bytes 16..) is the source VP8 chunk copied verbatim.
  assert.deepEqual([...anmf.subarray(16)], [...VP8([1, 2, 3, 4])], 'ANMF wraps the source VP8 chunk verbatim');
});

test('alpha: VP8X-alpha + ALPH + VP8 → alpha flag set, ALPH kept before VP8 in the ANMF', () => {
  const vp8xIn = riffChunk('VP8X', Uint8Array.from([0x10, 0, 0, 0, /*w-1*/ 9, 0, 0, /*h-1*/ 9, 0, 0]));
  const alph = ALPH([0xaa, 0xbb]);
  const vp8 = VP8([1, 2, 3]);
  const src = stillWebp([vp8xIn, alph, vp8]);
  const out = packWebpAnim([src], { width: 10, height: 10 });
  const cs = walk(out);
  assert.equal(cs[0]!.payload[0]! & 0x10, 0x10, 'VP8X alpha flag propagated');
  const frameData = cs[2]!.payload.subarray(16);
  // ALPH must come before VP8 (libwebp demux requirement) and both verbatim.
  assert.deepEqual([...frameData], [...concat([alph, vp8])], 'ALPH before VP8, both verbatim');
});

test('multi-frame: per-frame delay array + loop count; each ANMF carries its own image', () => {
  const a = stillWebp([VP8([10])]);
  const b = stillWebp([VP8L([0x2f, 1, 2, 3, 4, 9])]);
  const out = packWebpAnim([a, b], { width: 8, height: 8, delayMs: [40, 250], loops: 3 });
  const cs = walk(out);
  assert.deepEqual(cs.map(c => c.cc), ['VP8X', 'ANIM', 'ANMF', 'ANMF']);
  assert.equal(u16(cs[1]!.payload, 4), 3, 'loop_count = 3');
  assert.equal(u24(cs[2]!.payload, 12), 40, 'frame 0 delay');
  assert.equal(u24(cs[3]!.payload, 12), 250, 'frame 1 delay');
  assert.deepEqual([...cs[2]!.payload.subarray(16)], [...VP8([10])]);
  assert.deepEqual([...cs[3]!.payload.subarray(16)], [...VP8L([0x2f, 1, 2, 3, 4, 9])]);
});

test('VP8L alpha + dimension fallback when opts.width/height omitted', () => {
  // VP8L header: 0x2f, then 32-bit LE with 14-bit(w-1), 14-bit(h-1), 1-bit alpha.
  // w=4,h=3,alpha=1: bits = 3 | (2<<14) | (1<<28) = 3 + 32768 + 268435456.
  const bits = 3 | (2 << 14) | (1 << 28);
  const vp8l = VP8L([0x2f, bits & 0xff, (bits >>> 8) & 0xff, (bits >>> 16) & 0xff, (bits >>> 24) & 0xff]);
  const out = packWebpAnim([stillWebp([vp8l])], {});   // no explicit dims
  const vp8x = walk(out)[0]!.payload;
  assert.equal(u24(vp8x, 4), 3, 'width−1 parsed from VP8L = 3 (w=4)');
  assert.equal(u24(vp8x, 7), 2, 'height−1 parsed from VP8L = 2 (h=3)');
  assert.equal(vp8x[0]! & 0x10, 0x10, 'alpha_is_used bit propagates to VP8X');
});

test('odd-size sub-chunk gets its RIFF pad byte and the container stays even', () => {
  const src = stillWebp([VP8([1, 2, 3])]);      // 3-byte payload → padded to 4
  const out = packWebpAnim([src], { width: 5, height: 5 });
  assert.equal(out.length % 2, 0, 'total length even');
  assert.equal(u32(out, 4), out.length - 8);
  // The ANMF payload = 16-byte header + the padded 12-byte VP8 chunk (8+3+1).
  const anmf = walk(out).find(c => c.cc === 'ANMF')!;
  assert.equal(anmf.payload.length, 16 + 12);
});

test('background colour is written BGRA', () => {
  const out = packWebpAnim([stillWebp([VP8([1])])], { width: 2, height: 2, background: [0x11, 0x22, 0x33, 0x44] });
  const anim = walk(out).find(c => c.cc === 'ANIM')!.payload;
  assert.deepEqual([anim[0], anim[1], anim[2], anim[3]], [0x33, 0x22, 0x11, 0x44], 'RGBA→BGRA');
});

test('rejects empty, non-WebP, truncated, and negative loops', () => {
  assert.throws(() => packWebpAnim([], {}), /non-empty array/);
  assert.throws(() => packWebpAnim([Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])], {}), /bad RIFF\/WEBP signature/);
  const noImage = stillWebp([riffChunk('EXIF', Uint8Array.from([1, 2]))]);
  assert.throws(() => packWebpAnim([noImage], {}), /no VP8\/VP8L image data/);
  assert.throws(() => packWebpAnim([stillWebp([VP8([1])])], { width: 2, height: 2, loops: -1 }), /non-negative integer/);
  // truncated: claim a huge size the buffer can't satisfy
  const bad = stillWebp([VP8([1, 2])]);
  bad[16] = 0xff; bad[17] = 0xff;   // corrupt the first chunk's size field
  assert.throws(() => packWebpAnim([bad], { width: 2, height: 2 }), /truncated/);
});
