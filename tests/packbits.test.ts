// SPDX-License-Identifier: MPL-2.0
/**
 * PackBits (engine/src/packbits.ts) - encode/decode identity, worst-case
 * expansion bound, and the never-throw refusal contract of the decoder.
 *
 * Run with: node --test tests/packbits.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packBitsDecode, packBitsEncode } from '../engine/src/packbits.ts';

function roundTrip(src: Uint8Array): Uint8Array {
  const packed = packBitsEncode(src);
  const out = new Uint8Array(src.length);
  const n = packBitsDecode(packed, 0, packed.length, out, 0, src.length);
  assert.equal(n, src.length, 'decode must fill the destination exactly');
  return out;
}

test('packbits: empty input', () => {
  assert.equal(packBitsEncode(new Uint8Array(0)).length, 0);
  const dst = new Uint8Array(0);
  assert.equal(packBitsDecode(new Uint8Array(0), 0, 0, dst, 0, 0), 0);
});

test('packbits: round-trip identity across shapes', () => {
  const cases: Uint8Array[] = [
    new Uint8Array([7]),
    new Uint8Array([1, 2, 3, 4, 5]),                       // pure literal
    new Uint8Array(300).fill(0xaa),                         // long run (spans packets)
    new Uint8Array([1, 1, 2, 2, 3, 3]),                     // 2-runs stay literal
    new Uint8Array([9, 9, 9, 5, 5, 5, 5, 1, 2, 3]),        // runs + tail literal
    // Deterministic pseudo-random: literals with occasional short runs.
    Uint8Array.from({ length: 4096 }, (_, i) => (i * 197 + ((i >> 3) * 31)) & 0xff),
    // Alternating byte pairs - worst case for run finding.
    Uint8Array.from({ length: 257 }, (_, i) => i & 1),
  ];
  for (const src of cases) {
    assert.deepEqual(roundTrip(src), src, `round-trip failed for length ${src.length}`);
  }
});

test('packbits: worst-case expansion bound holds', () => {
  // No two adjacent equal bytes anywhere → all literal packets.
  const src = Uint8Array.from({ length: 10_000 }, (_, i) => i & 0xff ? (i & 0xff) : 1 + (i % 2));
  const packed = packBitsEncode(src);
  assert.ok(
    packed.length <= src.length + Math.ceil(src.length / 128) + 1,
    `expanded beyond bound: ${packed.length} for ${src.length}`,
  );
});

test('packbits: run of exactly 128 and literal of exactly 128', () => {
  assert.deepEqual(roundTrip(new Uint8Array(128).fill(3)), new Uint8Array(128).fill(3));
  const lit = Uint8Array.from({ length: 128 }, (_, i) => (i * 7 + 1) & 0xff);
  assert.deepEqual(roundTrip(lit), lit);
});

test('packbits: decoder skips the -128 no-op header', () => {
  // [no-op, literal of 2 bytes]
  const stream = new Uint8Array([128, 1, 0x41, 0x42]);
  const dst = new Uint8Array(2);
  assert.equal(packBitsDecode(stream, 0, stream.length, dst, 0, 2), 2);
  assert.deepEqual(dst, new Uint8Array([0x41, 0x42]));
});

test('packbits: decoder refuses damage with -1, never throws', () => {
  const dst = new Uint8Array(16);
  // Truncated: literal header promises 4 bytes, stream has 1.
  assert.equal(packBitsDecode(new Uint8Array([3, 9]), 0, 2, dst, 0, 4), -1);
  // Truncated: run header with no value byte.
  assert.equal(packBitsDecode(new Uint8Array([255]), 0, 1, dst, 0, 2), -1);
  // Destination overrun: run of 128 into a 16-byte window.
  assert.equal(packBitsDecode(new Uint8Array([129, 7]), 0, 2, dst, 0, 16), -1);
  // Stream ends before the destination fills.
  assert.equal(packBitsDecode(new Uint8Array([0, 5]), 0, 2, dst, 0, 4), -1);
  // Incoherent bounds.
  assert.equal(packBitsDecode(new Uint8Array([0, 5]), 2, 1, dst, 0, 1), -1);
  assert.equal(packBitsDecode(new Uint8Array([0, 5]), 0, 2, dst, 12, 8), -1);
});

test('packbits: decode within a larger source window (srcStart/srcEnd honoured)', () => {
  const packed = packBitsEncode(new Uint8Array([1, 2, 3]));
  const framed = new Uint8Array(packed.length + 6);
  framed.fill(0xee);
  framed.set(packed, 3);
  const dst = new Uint8Array(3);
  assert.equal(packBitsDecode(framed, 3, 3 + packed.length, dst, 0, 3), 3);
  assert.deepEqual(dst, new Uint8Array([1, 2, 3]));
});
