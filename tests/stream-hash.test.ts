// SPDX-License-Identifier: MPL-2.0
/**
 * The chunked hashes behind streamed archives (shells/web/src/lib/stream-hash.ts):
 * the same SHA-256 and CRC-32 as node:crypto and zlib however the input is cut,
 * and Blob reads that never take more than one chunk at a time.
 *
 * Run with: node --test tests/stream-hash.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { crc32 } from 'node:zlib';
import { Crc32, READ_CHUNK_BYTES, Sha256, hashBlob, readBlobChunks, sha256HexOfBlob, sha256Of } from '../shells/web/src/lib/stream-hash.ts';

function pattern(n: number): Uint8Array {
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (i * 31 + (i >> 8) * 7) & 255;
  return out;
}

test('SHA-256 and CRC-32 match node:crypto and zlib at every block boundary and cut', () => {
  for (const n of [0, 1, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 129, 1000, 70_001]) {
    const data = pattern(n);
    const want = createHash('sha256').update(data).digest('hex');
    for (const step of [1, 7, 63, 64, 65, 4096, n || 1]) {
      const sha = new Sha256(), crc = new Crc32();
      for (let o = 0; o < n; o += step) { sha.update(data.subarray(o, o + step)); crc.update(data.subarray(o, o + step)); }
      assert.equal(Buffer.from(sha.digest()).toString('hex'), want, `sha256 n=${n} step=${step}`);
      assert.equal(crc.value(), crc32(data), `crc32 n=${n} step=${step}`);
    }
  }
});

test('a finished hash refuses more input rather than answering wrongly', () => {
  const sha = new Sha256().update(pattern(10));
  sha.digest();
  assert.throws(() => sha.update(pattern(1)), /already finished/);
  assert.throws(() => sha.digest(), /already finished/);
});

test('sha256Of agrees with the streamed hash', async () => {
  const data = pattern(5000);
  assert.deepEqual(await sha256Of(data), new Sha256().update(data).digest());
});

test('hashBlob reads a large Blob in bounded slices and gives the same digests as a whole read', async () => {
  const data = pattern(300_000);
  const reads: number[] = [];
  class Watched extends Blob {
    override slice(start?: number, end?: number, type?: string): Blob { reads.push((end ?? this.size) - (start ?? 0)); return super.slice(start, end, type); }
    override arrayBuffer(): Promise<ArrayBuffer> { throw new Error('the whole Blob must not be read'); }
  }
  const blob = new Watched([data as BlobPart]);
  const { crc, sha256 } = await hashBlob(blob, true, 64 * 1024);
  assert.equal(crc, crc32(data));
  assert.equal(Buffer.from(sha256!).toString('hex'), createHash('sha256').update(data).digest('hex'));
  assert.ok(reads.length === 5 && reads.every(n => n <= 64 * 1024), `slices ${reads}`);
  // Without a digest asked for, only the checksum is computed.
  assert.equal((await hashBlob(new Blob([data as BlobPart]), false, 64 * 1024)).sha256, null);
  // A small Blob is one read, hashed by Web Crypto.
  const small = await hashBlob(new Blob([pattern(10) as BlobPart]), true);
  assert.equal(Buffer.from(small.sha256!).toString('hex'), createHash('sha256').update(pattern(10)).digest('hex'));
  assert.equal(READ_CHUNK_BYTES, 4 * 1024 * 1024);
});

test('sha256HexOfBlob gives the hex digest from slices for a large Blob and one read for a small one', async () => {
  const data = pattern(300_000);
  const reads: number[] = [];
  class Watched extends Blob {
    override slice(start?: number, end?: number, type?: string): Blob { reads.push((end ?? this.size) - (start ?? 0)); return super.slice(start, end, type); }
    override arrayBuffer(): Promise<ArrayBuffer> { throw new Error('the whole Blob must not be read'); }
  }
  assert.equal(await sha256HexOfBlob(new Watched([data as BlobPart]), 64 * 1024), createHash('sha256').update(data).digest('hex'));
  assert.ok(reads.length === 5 && reads.every(n => n <= 64 * 1024), `slices ${reads}`);
  for (const n of [0, 10, 64 * 1024]) {
    assert.equal(await sha256HexOfBlob(new Blob([pattern(n) as BlobPart]), 64 * 1024), createHash('sha256').update(pattern(n)).digest('hex'), `n=${n}`);
  }
});

test('readBlobChunks hands out the bytes in order and fails on a short read', async () => {
  const data = pattern(10_000);
  const seen: number[] = [];
  const parts: Uint8Array[] = [];
  await readBlobChunks(new Blob([data as BlobPart]), chunk => { seen.push(chunk.length); parts.push(chunk); }, 4096);
  assert.deepEqual(seen, [4096, 4096, 1808]);
  assert.deepEqual(Buffer.concat(parts), Buffer.from(data));
  class Shrunk extends Blob {
    override slice(start?: number, end?: number): Blob { return super.slice(start, Math.max(start ?? 0, (end ?? this.size) - 1)); }
  }
  await assert.rejects(readBlobChunks(new Shrunk([data as BlobPart]), () => {}, 4096), /changed while it was being read/);
});
