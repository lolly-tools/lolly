// SPDX-License-Identifier: MPL-2.0
/**
 * Raw DEFLATE compressor + zlib wrapper (engine/src/deflate.ts).
 *
 * The compressor is never tested only against itself: every stream is decoded
 * by node:zlib (an independent, battle-tested inflater) and a representative
 * set also by the platform DecompressionStream - the exact codec that backs
 * url-pack's `z` tokens - so "our bytes are spec-valid RFC 1951/1950" is
 * checked against two implementations we did not write. Reference values:
 * the canonical empty fixed-Huffman stream (0x03 0x00), Adler-32 of
 * "Wikipedia" = 0x11E60398 (the RFC 1950 §8 example value), and node:zlib's
 * own deflate trailer as an Adler-32 oracle.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/deflate.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { inflateRawSync, inflateSync, deflateSync } from 'node:zlib';
import { deflateRaw, zlibCompress, adler32, createDeflateStream, createZlibStream } from '../engine/src/deflate.ts';
import { packPng } from '../engine/src/png.ts';
import { unfilterPng } from '../engine/src/png-unfilter.ts';
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
  // LSB-first that is exactly the two bytes 0x03 0x00 - the same stream every
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
  // inflateSync verifies the Adler-32 itself - an independent checksum check.
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
  // the second copy sits ~30 KB behind - inside the window - so it must
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

// ────────────────────────────────────────────────────────────────────────────
// Slab-fed streaming deflate (createDeflateStream / createZlibStream)
//
// The point of this API is that WHERE a slab boundary falls must not change
// what comes out: one LZ77 window is carried across pushes, blocks are emitted
// as they are produced, and BFINAL is written only by finish(). Every claim
// below is checked against node:zlib AND, for a representative set, the
// platform DecompressionStream - never against our own inflater.
// ────────────────────────────────────────────────────────────────────────────

/** Feed `data` through the raw stream in fixed-size slabs; concatenate output. */
function streamDeflate(data: Uint8Array, slab: number, opts?: Parameters<typeof createDeflateStream>[0]): Uint8Array {
  const z = createDeflateStream(opts);
  const parts: Uint8Array[] = [];
  for (let o = 0; o < data.length; o += slab) parts.push(z.push(data.subarray(o, Math.min(o + slab, data.length))));
  parts.push(z.finish());
  assert.equal(z.bytesIn, data.length, 'bytesIn accounting');
  let n = 0;
  for (const p of parts) n += p.length;
  assert.equal(z.bytesOut, n, 'bytesOut accounting');
  const out = new Uint8Array(n);
  let k = 0;
  for (const p of parts) { out.set(p, k); k += p.length; }
  return out;
}

test('stream: empty input emits the same canonical minimal block as the one-shot', () => {
  const z = createDeflateStream();
  const out = z.finish();
  assert.deepEqual(Array.from(out), [0x03, 0x00]);
  assert.equal(inflateRawOracle(out).length, 0);
});

test('stream: slab-boundary cases round-trip (node:zlib) — under/exact/+1/many', async () => {
  const rng = mulberry32(0x51ab5);
  // Mixed content: compressible runs AND incompressible noise, so both block
  // types are exercised, plus a repeated 4 KB motif that spans slab edges.
  const motif = randomBytes(rng, 4096);
  const build = (n: number): Uint8Array => {
    const d = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const phase = Math.floor(i / 8192) % 3;
      d[i] = phase === 0 ? motif[i % motif.length]! : phase === 1 ? 0x2a : rng.byte();
    }
    return d;
  };
  const SLAB = 8192;
  const cases: Array<[string, number]> = [
    ['under one slab', SLAB - 1],
    ['exactly one slab', SLAB],
    ['slab + 1', SLAB + 1],
    ['two slabs exactly', SLAB * 2],
    ['many slabs', SLAB * 37 + 123],
    ['one 32 KB window', 32768],
    ['window + 1', 32769],
    ['past the first window slide', 200000],
  ];
  for (const [label, n] of cases) {
    const data = build(n);
    const out = streamDeflate(data, SLAB);
    assert.deepEqual(inflateRawOracle(out), data, `${label} (n=${n}) via node:zlib`);
    assert.deepEqual(await inflateRawPlatform(out), data, `${label} (n=${n}) via DecompressionStream`);
  }
});

test('stream: slab size itself is irrelevant — 1-byte pushes decode identically', () => {
  const rng = mulberry32(0x51ab5123);
  const data = new Uint8Array(70000);
  for (let i = 0; i < data.length; i++) data[i] = i % 4096 < 2000 ? (i % 7) * 30 : rng.byte();
  for (const slab of [1, 2, 3, 5, 257, 4096, 65535, 65536, 65537, 1 << 20]) {
    const out = streamDeflate(data, slab);
    assert.deepEqual(inflateRawOracle(out), data, `slab=${slab}`);
  }
  // Zero-length pushes are legal no-ops and must not close a block or a stream.
  const z = createDeflateStream();
  const parts = [z.push(new Uint8Array(0)), z.push(data.subarray(0, 100)), z.push(new Uint8Array(0)), z.push(data.subarray(100)), z.finish()];
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let k = 0;
  for (const p of parts) { out.set(p, k); k += p.length; }
  assert.deepEqual(inflateRawOracle(out), data, 'empty pushes interleaved');
});

test('stream: a boundary landing mid-match and mid-window is invisible in the output', () => {
  // A 300-byte run (longer than MAX_MATCH=258) preceded by its own copy, so the
  // matcher is mid-match exactly where the slab ends. Sweep the boundary across
  // every offset inside the match and demand identical BYTES each time.
  const rng = mulberry32(0x31d114c8);
  const block = randomBytes(rng, 1024);
  const data = new Uint8Array(4096);
  data.set(block, 0);
  data.set(block, 1024);              // an exact 1024-byte repeat at distance 1024
  for (let i = 2048; i < 4096; i++) data[i] = block[i % 1024]!;
  const reference = streamDeflate(data, data.length);   // one push
  for (let cut = 1020; cut < 1120; cut++) {
    const z = createDeflateStream();
    const a = z.push(data.subarray(0, cut));
    const b = z.push(data.subarray(cut));
    const c = z.finish();
    const out = new Uint8Array(a.length + b.length + c.length);
    out.set(a); out.set(b, a.length); out.set(c, a.length + b.length);
    assert.deepEqual(inflateRawOracle(out), data, `cut=${cut} round-trip`);
    assert.deepEqual(out, reference, `cut=${cut} produces the SAME bytes as a single push`);
  }
  // ...and across a window slide (>64 KB in, where the window physically moves).
  const long = new Uint8Array(150000);
  for (let i = 0; i < long.length; i++) long[i] = block[i % 1024]!;
  const ref2 = streamDeflate(long, long.length);
  for (const cut of [65535, 65536, 65537, 98304, 131071]) {
    const z = createDeflateStream();
    const a = z.push(long.subarray(0, cut));
    const b = z.push(long.subarray(cut));
    const c = z.finish();
    const out = new Uint8Array(a.length + b.length + c.length);
    out.set(a); out.set(b, a.length); out.set(c, a.length + b.length);
    assert.deepEqual(inflateRawOracle(out), long, `window-slide cut=${cut}`);
    assert.deepEqual(out, ref2, `window-slide cut=${cut} produces the SAME bytes`);
  }
});

test('stream: BFINAL is written once, at the end (a truncation would show as short output)', () => {
  const rng = mulberry32(0xbf17a1);
  const data = new Uint8Array(400000);
  for (let i = 0; i < data.length; i++) data[i] = i % 2048 < 1500 ? (i * 7) & 0xff : rng.byte();
  const out = streamDeflate(data, 16384);
  // Many blocks (400 KB at the 32 KB default block size), so the FIRST one must
  // not be final; if any interior block were, node:zlib would stop early and the
  // round-trip length would be short.
  assert.equal(out[0]! & 1, 0, 'first block is not BFINAL');
  const back = inflateRawOracle(out);
  assert.equal(back.length, data.length, 'nothing was cut short by an early BFINAL');
  assert.deepEqual(back, data);
  // node:zlib is strict about trailing garbage in a raw stream only when asked,
  // so also confirm the stream ends exactly where we said: re-inflating a
  // 1-byte-truncated stream must FAIL (negative control on the final block).
  assert.throws(() => inflateRawOracle(out.subarray(0, out.length - 1)), /unexpected end|Error/i);
});

test('stream: the window really carries across slabs (ratio vs one-shot, and vs a per-slab reset)', () => {
  // 20 KB random block repeated 40 times: within any 4 KB slab there is NO
  // repetition, so a naive per-slab deflater cannot compress it at all, while a
  // carried 32 KB window collapses it. This is the test a window reset fails.
  const rng = mulberry32(0x1d0e);
  const block = randomBytes(rng, 20 * 1024);
  const data = new Uint8Array(block.length * 40);
  for (let i = 0; i < 40; i++) data.set(block, i * block.length);

  const oneShot = deflateRaw(data).length;
  const streamed = streamDeflate(data, 4096).length;
  assert.deepEqual(inflateRawOracle(streamDeflate(data, 4096)), data, 'streamed round-trip');

  // Negative control: independent per-slab compression (the bug this guards).
  let naive = 0;
  for (let o = 0; o < data.length; o += 4096) naive += deflateRaw(data.subarray(o, Math.min(o + 4096, data.length))).length;

  assert.ok(streamed < naive / 10, `carried window ${streamed} vs per-slab reset ${naive} (expected < 1/10)`);
  assert.ok(streamed <= oneShot * 1.10, `streamed ${streamed} within 10% of one-shot ${oneShot}`);

  // Text is the other regime: block overhead, not match reach, is the cost.
  const text = new Uint8Array(readFileSync(join(HERE, '..', 'README.md')));
  const tOne = deflateRaw(text).length;
  const tStream = streamDeflate(text, 8192).length;
  assert.deepEqual(inflateRawOracle(streamDeflate(text, 8192)), text, 'README streamed round-trip');
  assert.ok(tStream <= tOne * 1.05, `README streamed ${tStream} within 5% of one-shot ${tOne}`);
});

test('stream: incompressible slabs still fall back to stored blocks (bounded expansion)', () => {
  const rng = mulberry32(0x5707ed);
  const data = randomBytes(rng, 300000);
  const out = streamDeflate(data, 7000);
  assert.deepEqual(inflateRawOracle(out), data, 'random round-trip');
  // Stored costs 5 bytes per block; the default block is 32768 input bytes.
  const blocks = Math.ceil(data.length / 32768) + 2;
  assert.ok(out.length <= data.length + 5 * blocks, `bounded overhead: ${out.length} vs ${data.length}`);
});

test('stream: createZlibStream emits a valid RFC 1950 stream (header, adler, node:zlib verify)', async () => {
  const rng = mulberry32(0x21ab);
  const data = new Uint8Array(120000);
  for (let i = 0; i < data.length; i++) data[i] = i % 1000 < 700 ? (i % 13) * 19 : rng.byte();
  const z = createZlibStream();
  const parts: Uint8Array[] = [];
  for (let o = 0; o < data.length; o += 9999) parts.push(z.push(data.subarray(o, Math.min(o + 9999, data.length))));
  parts.push(z.finish());
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let k = 0;
  for (const p of parts) { out.set(p, k); k += p.length; }
  assert.equal(out[0]! & 0x0f, 8, 'CM=8');
  assert.equal(((out[0]! << 8) | out[1]!) % 31, 0, 'FCHECK');
  // inflateSync checks the Adler-32 itself - the trailer is verified by an
  // implementation we did not write.
  assert.deepEqual(new Uint8Array(inflateSync(out)), data);
  const o = out.length - 4;
  assert.equal(((out[o]! << 24) | (out[o + 1]! << 16) | (out[o + 2]! << 8) | out[o + 3]!) >>> 0, adler32(data), 'trailer is adler32 of everything pushed');
  // Negative control: corrupt the trailer and the oracle must reject it.
  const bad = out.slice();
  bad[bad.length - 2] = bad[bad.length - 2]! ^ 0xff;
  assert.throws(() => inflateSync(bad), /checksum|check/i);
  // Platform codec agrees too.
  const ds = new DecompressionStream('deflate');
  const stream = new Blob([out.slice().buffer]).stream().pipeThrough(ds);
  assert.deepEqual(new Uint8Array(await new Response(stream).arrayBuffer()), data, 'DecompressionStream("deflate")');
  // A zlib stream with no data at all is still well-formed.
  const empty = createZlibStream().finish();
  assert.equal(new Uint8Array(inflateSync(empty)).length, 0);
});

test('stream: misuse is refused, not silently wrong', () => {
  const z = createDeflateStream();
  z.push(Uint8Array.of(1, 2, 3));
  z.finish();
  assert.throws(() => z.push(Uint8Array.of(4)), /push after finish/);
  assert.throws(() => z.finish(), /finish called twice/);
});

test('stream: option sweep (lazy off, maxChain=1, tiny/huge blockBytes) stays valid', () => {
  const rng = mulberry32(0x0b7);
  const data = new Uint8Array(180000);
  for (let i = 0; i < data.length; i++) data[i] = i % 900 < 600 ? (i % 5) * 50 : rng.byte();
  for (const opts of [{ lazy: false }, { maxChain: 1 }, { blockBytes: 1 }, { blockBytes: 1 << 20 }, { lazy: false, maxChain: 1, blockBytes: 4096 }]) {
    const out = streamDeflate(data, 3333, opts);
    assert.deepEqual(inflateRawOracle(out), data, `opts ${JSON.stringify(opts)}`);
  }
});

test('stream: seeded property sweep — inflate(stream(x)) === x across shapes and slabs', () => {
  const rng = mulberry32(0x57ea11 | 0);
  const patterns: Array<(n: number) => Uint8Array> = [
    (n) => randomBytes(rng, n),
    (n) => new Uint8Array(n),
    (n) => { const d = new Uint8Array(n); for (let i = 0; i < n; i++) d[i] = i & 0xff; return d; },
    (n) => { const p = 2 + rng.int(6); const d = new Uint8Array(n); for (let i = 0; i < n; i++) d[i] = ((i % p) * 40) & 0xff; return d; },
    (n) => { const d = new Uint8Array(n); let i = 0; while (i < n) { const run = 1 + rng.int(300); const b = rng.byte(); d.fill(b, i, Math.min(n, i + run)); i += run; } return d; },
  ];
  for (let iter = 0; iter < 120; iter++) {
    const n = rng.int(9000) + (rng.chance(0.15) ? 70000 : 0);
    const data = patterns[rng.int(patterns.length)]!(n);
    const slab = 1 + rng.int(rng.chance(0.3) ? 64 : 20000);
    assert.deepEqual(inflateRawOracle(streamDeflate(data, slab)), data, `iter ${iter} n=${n} slab=${slab}`);
  }
});

// ── memory: the whole reason this API exists ────────────────────────────────

/** Bytes of live/pending ArrayBuffer memory, as node accounts for it. */
function abBytes(): number {
  const m = process.memoryUsage();
  return m.arrayBuffers + m.external;
}

test('stream: peak scratch is bounded by the window, not by the input (measured)', () => {
  // 24 MiB fed as 64 KiB slabs from ONE reused buffer - the shape png.ts uses,
  // and the size at which the one-shot path would allocate ~192 MiB of tokenizer
  // scratch on top of a 24 MiB input buffer.
  //
  // The payload is filtered-PNG-shaped (a gradient with a little noise), which
  // compresses hard, so the bytes this loop PRODUCES are a rounding error. That
  // matters for the measurement: process.memoryUsage() counts every drained
  // output slice until GC runs, and produced bytes are the caller's, not the
  // compressor's scratch. Keeping them tiny is what makes the delta below an
  // honest reading of scratch alone (the mixed-entropy case is the next test,
  // where the one-shot comparison controls for exactly this).
  const TOTAL = 24 * 1024 * 1024;
  const SLAB = 64 * 1024;
  const slab = new Uint8Array(SLAB);
  const z = createDeflateStream();
  const base = abBytes();
  let peak = 0;
  let produced = 0;
  for (let off = 0; off < TOTAL; off += SLAB) {
    for (let i = 0; i < SLAB; i++) slab[i] = ((off + i) >> 4) & 0xff;
    produced += z.push(slab).length;          // result deliberately not retained
    const d = abBytes() - base;
    if (d > peak) peak = d;
  }
  produced += z.finish().length;
  assert.ok(produced > 0 && produced < TOTAL / 50, `sanity: produced ${produced} from ${TOTAL}`);
  // Measured 2026-07-31 on this machine: peak delta 0.54 MiB for a 24 MiB input
  // (which produced 282 KB of stream - ~1.1%, so output garbage is not the reading)
  // (window 64 KiB + head 128 KiB + prev 128 KiB + tokens ~132 KiB + the 64 KiB
  // writer buffer + drained slices awaiting GC). The bound is 2 MiB: ~1/12 of
  // the INPUT and ~1/96 of the 192 MiB the one-shot tokenizer would have taken.
  // A per-image allocation of any kind blows straight through it.
  const bound = 2 * 1024 * 1024;
  assert.ok(peak < bound, `peak scratch ${(peak / 1048576).toFixed(2)} MiB must stay under ${bound / 1048576} MiB for a ${TOTAL / 1048576} MiB input`);
  // Negative control on the measurement itself: allocating one image-sized
  // buffer inside the same loop WOULD be caught.
  const b2 = abBytes();
  const hog = new Uint8Array(TOTAL);
  hog[0] = 1;
  assert.ok(abBytes() - b2 > bound, 'the meter does register an image-sized allocation');
});

test('stream: the same payload one-shot costs several times the peak RSS (external oracle)', () => {
  // In-process memoryUsage() cannot see the one-shot path's peak: tokenize()
  // allocates and releases its scratch INSIDE deflateRaw, so by the time the
  // call returns the delta shows only the retained output (it can even read
  // negative if a GC lands mid-call). The honest instrument is the OS's own
  // peak: run each path in its own child and read process.resourceUsage().maxRSS
  // - monotonic, measured by the kernel, and not ours to fool.
  //
  // Same 64 MiB input, materialised the same way in both children, so the only
  // difference is the compressor. Measured 2026-07-31 on this machine (maxRSS,
  // in MiB): idle node 41, one-shot 404, streamed 148 - i.e. 363 MiB of overhead
  // (5.7x the input, the ~8x tokenizer scratch minus what is never touched)
  // against 107 MiB (the 64 MiB input plus V8's own growth).
  const script = join(tmpdir(), `deflate-rss-probe-${process.pid}.mjs`);
  writeFileSync(script, `
const mode = process.argv[2];
const N = 64 * 1024 * 1024;
if (mode !== 'base') {
  const { deflateRaw, createDeflateStream } = await import(${JSON.stringify(join(HERE, '..', 'engine', 'src', 'deflate.ts'))});
  const data = new Uint8Array(N);
  for (let i = 0; i < N; i++) data[i] = (i >> 4) & 0xff;
  let out = 0;
  if (mode === 'one') out = deflateRaw(data).length;
  else {
    const z = createDeflateStream();
    for (let o = 0; o < N; o += 65536) out += z.push(data.subarray(o, Math.min(o + 65536, N))).length;
    out += z.finish().length;
  }
  if (out <= 0) throw new Error('probe produced nothing');
}
console.log(JSON.stringify({ rssKb: process.resourceUsage().maxRSS }));
`);
  const rss = (mode: string): number =>
    JSON.parse(execFileSync(process.execPath, [script, mode], { encoding: 'utf8' })).rssKb * 1024;
  try {
    const base = rss('base');
    const oneShot = rss('one') - base;
    const streamed = rss('stream') - base;
    const N = 64 * 1024 * 1024;
    const mib = (b: number): string => (b / 1048576).toFixed(0);
    assert.ok(oneShot > 4 * N, `one-shot overhead ${mib(oneShot)} MiB should exceed 4x the ${mib(N)} MiB input (its scratch is ~8 bytes/byte)`);
    assert.ok(streamed < 2 * N, `streamed overhead ${mib(streamed)} MiB should stay under 2x the ${mib(N)} MiB input (which the child holds in full)`);
    assert.ok(oneShot > streamed * 2.5, `one-shot ${mib(oneShot)} MiB vs streamed ${mib(streamed)} MiB`);
  } finally {
    rmSync(script, { force: true });
  }
});

// ── the consumer this unblocks: png.ts past its old 16 MiB ceiling ──────────

test('png: a filtered payload past the old 16 MiB ceiling now COMPRESSES (it used to refuse)', () => {
  // 2048x2048 RGBA8 = 2048 * (2048*4 + 1) = 16,779,264 filtered bytes - just
  // past the 16 MiB guard that made packPng throw (plan §9b) and past the 4 MiB
  // point where this writer switches to createZlibStream.
  const W = 2048;
  const px = new Uint8Array(W * W * 4);
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      px[o] = x & 0xff; px[o + 1] = y & 0xff; px[o + 2] = (x ^ y) & 0xff; px[o + 3] = 255;
    }
  }
  const filteredLen = W * (W * 4 + 1);
  assert.ok(filteredLen > 16 * 1024 * 1024, `payload is past the old ceiling: ${filteredLen}`);

  const png = packPng(px, { width: W, height: W });
  // It is genuinely COMPRESSED, not stored: stored would be >= filteredLen.
  assert.ok(png.length < filteredLen / 4, `compressed to ${png.length} from ${filteredLen} filtered bytes`);

  // node:zlib decodes the concatenated IDAT payload back to exactly the
  // filtered scanlines (independent inflater over a multi-block stream).
  let idat = 0;
  const idatParts: Uint8Array[] = [];
  for (let o = 8; o + 8 <= png.length;) {
    const len = (png[o]! << 24 | png[o + 1]! << 16 | png[o + 2]! << 8 | png[o + 3]!) >>> 0;
    const type = String.fromCharCode(png[o + 4]!, png[o + 5]!, png[o + 6]!, png[o + 7]!);
    if (type === 'IDAT') { idatParts.push(png.subarray(o + 8, o + 8 + len)); idat += len; }
    o += 12 + len;
  }
  assert.ok(idat > 0, 'IDAT present');
  const joined = new Uint8Array(idat);
  let k = 0;
  for (const p of idatParts) { joined.set(p, k); k += p.length; }
  const inflated = new Uint8Array(inflateSync(Buffer.from(joined)));
  assert.equal(inflated.length, filteredLen, 'inflated scanlines match the declared size');

  // ...and unfiltering those scanlines gives back exactly the pixels we passed
  // in. Every sample, not a spot check - the whole point is that a streamed,
  // multi-block IDAT is lossless.
  const back = unfilterPng(inflated, W, W, 4);
  assert.ok(back, 'unfilterPng returned null');
  assert.equal(back!.length, px.length, 'sample count');
  for (let i = 0; i < px.length; i++) {
    if (back![i] !== px[i]) assert.fail(`sample ${i} is ${back![i]}, expected ${px[i]}`);
  }

  // Negative control: an explicit small cap still refuses loudly.
  assert.throws(
    () => packPng(px, { width: W, height: W, maxDeflateBytes: 1024 }),
    /exceeds maxDeflateBytes/,
  );
});
