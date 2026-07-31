// SPDX-License-Identifier: MPL-2.0
/**
 * Raw DEFLATE compressor + zlib wrapper (engine/src/deflate.ts).
 *
 * The compressor is never tested only against itself: every stream is decoded
 * by node:zlib (an independent, battle-tested inflater) and a representative
 * set also by the platform DecompressionStream — the exact codec that backs
 * url-pack's `z` tokens — so "our bytes are spec-valid RFC 1951/1950" is
 * checked against two implementations we did not write. Reference values:
 * the canonical empty fixed-Huffman stream (0x03 0x00), Adler-32 of
 * "Wikipedia" = 0x11E60398 (the RFC 1950 §8 example value), and node:zlib's
 * own deflate trailer as an Adler-32 oracle.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/deflate.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync, inflateSync, deflateSync } from 'node:zlib';
import { deflateRaw, zlibCompress, adler32 } from '../engine/src/deflate.ts';
import { mulberry32 } from './fuzz/prng.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

function inflateRawOracle(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(inflateRawSync(bytes));
}

async function inflateRawPlatform(bytes: Uint8Array): Promise<Uint8Array> {
  // Same platform codec path url-pack.ts uses to decode `z` tokens.
  const ds = new DecompressionStream('deflate-raw');
  const stream = new Blob([bytes.slice().buffer]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function randomBytes(rng: ReturnType<typeof mulberry32>, n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = rng.byte();
  return out;
}

function assertRoundTrip(data: Uint8Array, label: string): Uint8Array {
  const out = deflateRaw(data);
  const back = inflateRawOracle(out);
  assert.equal(back.length, data.length, `${label}: length after round-trip`);
  assert.deepEqual(back, data, `${label}: bytes after round-trip`);
  return out;
}

// ── reference values / negative controls ────────────────────────────────────

test('deflate: empty input emits the canonical minimal fixed block (0x03 0x00)', () => {
  // BFINAL=1, BTYPE=01, then the 7-bit end-of-block code 0000000, zero-padded:
  // LSB-first that is exactly the two bytes 0x03 0x00 — the same stream every
  // canonical encoder (zlib -9 raw, etc.) produces for empty input.
  const out = deflateRaw(new Uint8Array(0));
  assert.deepEqual(Array.from(out), [0x03, 0x00]);
  assert.equal(inflateRawOracle(out).length, 0);
});

test('adler32: reference values and node:zlib as an independent oracle', () => {
  // RFC 1950 §8: seeded s1=1, so empty input -> 1.
  assert.equal(adler32(new Uint8Array(0)), 1);
  // The classic published example: Adler-32("Wikipedia") = 0x11E60398.
  assert.equal(adler32(new TextEncoder().encode('Wikipedia')), 0x11e60398);
  // Oracle: node:zlib's deflate trailer IS the Adler-32 of the input (RFC 1950
  // §2.3), so compare our checksum against a checksum we did not implement.
  const rng = mulberry32(0xad1e432);
  for (const n of [1, 7, 5551, 5552, 5553, 70000]) {
    const data = randomBytes(rng, n);
    const z = deflateSync(data);
    const trailer = (z[z.length - 4]! << 24 | z[z.length - 3]! << 16 | z[z.length - 2]! << 8 | z[z.length - 1]!) >>> 0;
    assert.equal(adler32(data), trailer, `adler32 vs zlib trailer, n=${n}`);
  }
});

test('zlib wrapper: valid header, adler trailer, inflateSync round-trip, corrupt trailer rejected', () => {
  const data = new TextEncoder().encode('the quick brown fox jumps over the lazy dog '.repeat(20));
  const out = zlibCompress(data);
  // RFC 1950 §2.2: CM=8 (deflate), CMF*256+FLG divisible by 31.
  assert.equal(out[0]! & 0x0f, 8, 'CM=8');
  assert.equal(((out[0]! << 8) | out[1]!) % 31, 0, 'FCHECK');
  assert.equal(out[1]! & 0x20, 0, 'no FDICT');
  // inflateSync verifies the Adler-32 itself — an independent checksum check.
  assert.deepEqual(new Uint8Array(inflateSync(out)), data);
  const a = adler32(data);
  const o = out.length - 4;
  assert.equal(((out[o]! << 24) | (out[o + 1]! << 16) | (out[o + 2]! << 8) | out[o + 3]!) >>> 0, a, 'trailer is adler32(data)');
  // Negative control: a corrupted checksum must be REJECTED by the oracle.
  const bad = out.slice();
  bad[bad.length - 1] = bad[bad.length - 1]! ^ 0xff;
  assert.throws(() => inflateSync(bad), /checksum|check/i);
});

// ── shapes and sizes ─────────────────────────────────────────────────────────

test('deflate: 1-byte input round-trips', () => {
  for (const b of [0, 0x41, 0xff]) {
    const out = assertRoundTrip(Uint8Array.of(b), `single byte ${b}`);
    assert.ok(out.length <= 6, `tiny output for one byte, got ${out.length}`);
  }
});

test('deflate: 1 MB of zeros compresses hugely (LZ77 window + 258-byte matches)', () => {
  const data = new Uint8Array(1024 * 1024);
  const out = assertRoundTrip(data, '1MB zeros');
  // ~13 bits per 258-byte run under fixed codes -> ~6.6 KB. Anything vaguely
  // near stored size would mean the matcher is broken.
  assert.ok(out.length < 8 * 1024, `1MB zeros -> ${out.length} bytes (expected < 8192)`);
  assert.equal(out[0]! & 0b111, 0b011, 'single final fixed-Huffman block');
});

test('deflate: random 64 KB falls back to stored blocks (bounded overhead)', () => {
  const rng = mulberry32(0x5eed64);
  const data = randomBytes(rng, 64 * 1024);
  const out = assertRoundTrip(data, 'random 64KB');
  const blocks = Math.ceil(data.length / 65535);
  assert.ok(out.length <= data.length + 5 * blocks, `stored fallback bound: ${out.length} <= ${data.length + 5 * blocks}`);
  // 65536 bytes -> two stored blocks; the FIRST block is not final:
  // low 3 bits = BFINAL 0, BTYPE 00.
  assert.equal(out[0]! & 0b111, 0b000, 'first stored block, not final');
});

test('deflate: random 4 KB single stored block is marked final', () => {
  const rng = mulberry32(0x5eed04);
  const data = randomBytes(rng, 4096);
  const out = assertRoundTrip(data, 'random 4KB');
  assert.equal(out[0]! & 0b111, 0b001, 'BFINAL=1, BTYPE=00');
  assert.equal(out.length, data.length + 5, 'exactly LEN/NLEN header overhead');
});

test('deflate: text corpus (repo README) compresses below 60%', () => {
  const data = new Uint8Array(readFileSync(join(HERE, '..', 'README.md')));
  assert.ok(data.length > 4096, 'corpus is non-trivial');
  const out = assertRoundTrip(data, 'README.md');
  const ratio = out.length / data.length;
  assert.ok(ratio < 0.6, `README ratio ${(ratio * 100).toFixed(1)}% (expected < 60%)`);
});

test('deflate: stored-block boundary lengths (65534/65535/65536/131071)', () => {
  const rng = mulberry32(0xb0da11);
  for (const n of [65534, 65535, 65536, 131071]) {
    const data = randomBytes(rng, n);
    const out = assertRoundTrip(data, `random ${n}B`);
    assert.ok(out.length <= n + 5 * Math.ceil(n / 65535), `bound at n=${n}`);
  }
});

test('deflate: compressible data spanning the 64 KB edge stays one fixed block', () => {
  // Repetitive text longer than a stored block: fixed-Huffman LZ77 has no
  // 65535 limit, so this must be a single final block and much smaller.
  const data = new TextEncoder().encode('lolly '.repeat(20000)); // 120000 bytes
  const out = assertRoundTrip(data, 'repetitive 120KB');
  assert.equal(out[0]! & 0b111, 0b011, 'single final fixed block');
  assert.ok(out.length < 2048, `LZ77 collapses repetition: ${out.length} bytes`);
});

test('deflate: matches reach across the full 32 KB window', () => {
  // Two copies of the same 24 KB random block separated by 6 KB of noise:
  // the second copy sits ~30 KB behind — inside the window — so it must
  // compress to far less than a stored copy.
  const rng = mulberry32(0x37f00d);
  const blockA = randomBytes(rng, 24 * 1024);
  const gap = randomBytes(rng, 6 * 1024);
  const data = new Uint8Array(blockA.length * 2 + gap.length);
  data.set(blockA, 0);
  data.set(gap, blockA.length);
  data.set(blockA, blockA.length + gap.length);
  const out = assertRoundTrip(data, 'far-back duplicate block');
  assert.ok(out.length < blockA.length + gap.length + 4096, `second copy matched at distance ~30KB: ${out.length}`);
});

// ── options and cross-codec agreement ────────────────────────────────────────

test('deflate: lazy off and maxChain=1 still emit valid streams', () => {
  const data = new TextEncoder().encode('abcabcabcx'.repeat(500) + 'tail bytes');
  for (const opts of [{ lazy: false }, { maxChain: 1 }, { lazy: false, maxChain: 1 }]) {
    const out = deflateRaw(data, opts);
    assert.deepEqual(inflateRawOracle(out), data, `opts ${JSON.stringify(opts)}`);
  }
  // Lazy matching should never be LARGER than greedy on this classic
  // lazy-win pattern (greedy takes 'abc', lazy defers into a longer match).
  const lazyOut = deflateRaw(data, { lazy: true });
  const greedyOut = deflateRaw(data, { lazy: false });
  assert.ok(lazyOut.length <= greedyOut.length, `lazy ${lazyOut.length} <= greedy ${greedyOut.length}`);
});

test('deflate: DecompressionStream (the url-pack codec path) decodes our streams', async () => {
  const rng = mulberry32(0xdec0de);
  const samples = [
    new Uint8Array(0),
    Uint8Array.of(7),
    new TextEncoder().encode('lolly tools '.repeat(1000)),
    randomBytes(rng, 70000),
    new Uint8Array(4096), // zeros
  ];
  for (const data of samples) {
    const back = await inflateRawPlatform(deflateRaw(data));
    assert.deepEqual(back, data, `platform inflate, n=${data.length}`);
  }
  const wrapped = zlibCompress(samples[2]!);
  const ds = new DecompressionStream('deflate');
  const stream = new Blob([wrapped.slice().buffer]).stream().pipeThrough(ds);
  assert.deepEqual(new Uint8Array(await new Response(stream).arrayBuffer()), samples[2]!, 'platform zlib inflate');
});

test('deflate: seeded property sweep — inflate(deflate(x)) === x across shapes', () => {
  // The compressor's fuzz-style property lives HERE rather than in
  // tests/fuzz/targets.ts: that runner treats any thrown Error as a desired
  // parser rejection, which inverts for a compressor (a round-trip mismatch
  // must FAIL, not be classified as controlled behaviour).
  const rng = mulberry32(0xf00fba11 | 0);
  const patterns: Array<(n: number) => Uint8Array> = [
    (n) => randomBytes(rng, n),
    (n) => new Uint8Array(n), // zeros
    (n) => { const d = new Uint8Array(n); for (let i = 0; i < n; i++) d[i] = i & 0xff; return d; }, // ramp
    (n) => { // short period — hash-chain stress
      const p = 2 + rng.int(6);
      const d = new Uint8Array(n);
      for (let i = 0; i < n; i++) d[i] = (i % p) * 40 & 0xff;
      return d;
    },
    (n) => { // random runs of random bytes
      const d = new Uint8Array(n);
      let i = 0;
      while (i < n) { const run = 1 + rng.int(300); const b = rng.byte(); d.fill(b, i, Math.min(n, i + run)); i += run; }
      return d;
    },
  ];
  for (let iter = 0; iter < 120; iter++) {
    const n = rng.int(3000) + (rng.chance(0.1) ? 65530 : 0); // some near the stored edge
    const data = patterns[rng.int(patterns.length)]!(n);
    for (const opts of [undefined, { lazy: false } as const]) {
      const out = deflateRaw(data, opts);
      assert.deepEqual(inflateRawOracle(out), data, `iter ${iter} n=${n} lazy=${opts?.lazy !== false}`);
    }
  }
});
