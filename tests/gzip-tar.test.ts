// SPDX-License-Identifier: MPL-2.0
/**
 * tests/gzip-tar.test.ts - gzip/gunzip round-trips + a self-decode oracle for the
 * in-tree inflater, cross-checked against node:zlib where available, and a USTAR
 * writer verified block-by-block (magic, checksum, layout) and, when a system
 * `tar` binary exists, listed/extracted by it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync, gunzipSync, gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { gzip, gunzip, inflateRaw } from '../engine/src/gzip.ts';
import { packTar, type TarFile } from '../engine/src/tar.ts';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const eq = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

// A spread of inputs: empty, tiny, binary, highly-compressible, and large/random.
function corpus(): { name: string; data: Uint8Array }[] {
  const cases: { name: string; data: Uint8Array }[] = [];
  cases.push({ name: 'empty', data: new Uint8Array(0) });
  cases.push({ name: 'one byte', data: Uint8Array.of(0x41) });
  cases.push({ name: 'ascii', data: enc('Hello, gzip + tar!') });
  cases.push({ name: 'svg text', data: enc('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'.repeat(50)) });
  // All 256 byte values, several times over - exercises literals + matches.
  const bin = new Uint8Array(4096);
  for (let i = 0; i < bin.length; i++) bin[i] = (i * 31 + (i >> 3)) & 0xff;
  cases.push({ name: 'binary ramp', data: bin });
  // Highly compressible run.
  cases.push({ name: 'zeros 100k', data: new Uint8Array(100_000) });
  // Large pseudo-random (a mulberry-ish PRNG for determinism) - forces stored fallback paths.
  const big = new Uint8Array(200_000);
  let s = 0x12345678 >>> 0;
  for (let i = 0; i < big.length; i++) {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 1) >>> 0;
    big[i] = s & 0xff;
  }
  cases.push({ name: 'random 200k', data: big });
  return cases;
}

test('gzip → gunzip round-trips every input exactly', () => {
  for (const { name, data } of corpus()) {
    const out = gunzip(gzip(data));
    assert.ok(eq(out, data), `round-trip mismatch: ${name} (in ${data.length}, out ${out.length})`);
  }
});

test('gzip header + trailer are RFC 1952 correct', () => {
  const data = enc('provenance');
  const g = gzip(data);
  assert.equal(g[0], 0x1f, 'ID1');
  assert.equal(g[1], 0x8b, 'ID2');
  assert.equal(g[2], 8, 'CM=deflate');
  assert.equal(g[3], 0, 'FLG=0');
  assert.equal(g[8], 0, 'XFL');
  assert.equal(g[9], 0xff, 'OS=unknown');
  // ISIZE (last 4 bytes, LE) equals input length.
  const isize = g[g.length - 4]! | (g[g.length - 3]! << 8) | (g[g.length - 2]! << 16) | (g[g.length - 1]! << 24);
  assert.equal(isize >>> 0, data.length);
});

test('our gzip decodes in node:zlib (cross-check)', () => {
  for (const { name, data } of corpus()) {
    const roundTripped = new Uint8Array(gunzipSync(Buffer.from(gzip(data))));
    assert.ok(eq(roundTripped, data), `node zlib could not verify: ${name}`);
  }
});

test('our gunzip decodes a gzip produced by node:zlib', () => {
  for (const { name, data } of corpus()) {
    const foreign = new Uint8Array(gzipSync(Buffer.from(data))); // carries OS + MTIME, maybe FNAME-less
    const out = gunzip(foreign);
    assert.ok(eq(out, data), `could not read node-produced gzip: ${name}`);
  }
});

test('inflateRaw handles all three block types (fixed, dynamic, stored)', () => {
  // node:zlib with level 0 forces stored blocks; default level exercises dynamic Huffman.
  const text = enc('the quick brown fox jumps over the lazy dog. '.repeat(200));
  for (const level of [0, 1, 6, 9]) {
    const raw = new Uint8Array(deflateRawSync(Buffer.from(text), { level }));
    const out = inflateRaw(raw, text.length);
    assert.ok(eq(out, text), `inflateRaw failed at zlib level ${level}`);
  }
});

test('gunzip rejects corrupt / truncated / bad-magic input', () => {
  const g = gzip(enc('payload here'));
  assert.throws(() => gunzip(g.subarray(0, 8)), /too short/);
  const badMagic = g.slice(); badMagic[0] = 0;
  assert.throws(() => gunzip(badMagic), /bad magic/);
  const badCrc = g.slice(); const ci = g.length - 8; badCrc[ci] = (badCrc[ci]! ^ 0xff) & 0xff; // flip a trailer CRC byte
  assert.throws(() => gunzip(badCrc), /CRC-32 mismatch/);
  const truncBody = g.slice(0, g.length - 10); // chop body + trailer
  assert.throws(() => gunzip(truncBody));
});

test('inflateRaw refuses to over-allocate on a hostile size hint', () => {
  const raw = new Uint8Array(deflateRawSync(Buffer.from(new Uint8Array(50_000))));
  // Declaring a smaller size than the stream decodes to must fail, not silently truncate.
  assert.throws(() => inflateRaw(raw, 10), /exceeds declared size/);
});

// ── tar ─────────────────────────────────────────────────────────────────────

const readOctal = (b: Uint8Array, off: number, len: number): number =>
  parseInt(new TextDecoder().decode(b.subarray(off, off + len)).replace(/[\0 ]+$/g, '').trim() || '0', 8);

test('packTar lays out valid 512-byte USTAR blocks with a correct checksum', () => {
  const files: TarFile[] = [
    { name: 'a.txt', data: enc('alpha') },
    { name: 'dir/b.bin', data: Uint8Array.of(1, 2, 3, 4, 5, 6, 7) },
    { name: 'empty', data: new Uint8Array(0) },
  ];
  const tar = packTar(files);
  assert.equal(tar.length % 512, 0, 'archive is a whole number of blocks');

  let off = 0;
  for (const f of files) {
    const hdr = tar.subarray(off, off + 512);
    // name
    const name = new TextDecoder().decode(hdr.subarray(0, 100)).replace(/\0.*$/, '');
    assert.equal(name, f.name);
    // magic "ustar\0" at 257, version "00" at 263
    assert.equal(new TextDecoder().decode(hdr.subarray(257, 263)), 'ustar\0');
    assert.equal(new TextDecoder().decode(hdr.subarray(263, 265)), '00');
    // typeflag '0'
    assert.equal(hdr[156], 0x30);
    // size octal
    assert.equal(readOctal(hdr, 124, 12), f.data.length);
    // checksum: recompute with the chksum field as spaces
    const stored = readOctal(hdr, 148, 8);
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 0x20 : hdr[i]!;
    assert.equal(stored, sum, `checksum mismatch for ${f.name}`);
    // data present + block-aligned
    assert.ok(eq(tar.subarray(off + 512, off + 512 + f.data.length), f.data));
    off += 512 + Math.ceil(f.data.length / 512) * 512;
  }
  // two zero blocks at the end
  const tail = tar.subarray(off);
  assert.equal(tail.length, 1024);
  assert.ok(tail.every((v) => v === 0), 'trailing two blocks are zero');
});

test('packTar rejects an over-long name', () => {
  assert.throws(() => packTar([{ name: 'x'.repeat(101), data: new Uint8Array(0) }]), /too long/);
});

test('a system tar can list and extract our archive (if available)', (t) => {
  let tarBin = '';
  try { execFileSync('tar', ['--version'], { stdio: 'ignore' }); tarBin = 'tar'; }
  catch { t.skip('no system tar'); return; }

  const files: TarFile[] = [
    { name: 'hello.txt', data: enc('hello from lolly') },
    { name: 'nested/data.bin', data: Uint8Array.from({ length: 300 }, (_, i) => i & 0xff) },
  ];
  const dir = mkdtempSync(join(tmpdir(), 'lolly-tar-'));
  try {
    const path = join(dir, 'a.tar');
    writeFileSync(path, packTar(files));
    // List
    const list = execFileSync(tarBin, ['-tf', path], { encoding: 'utf8' }).trim().split('\n');
    assert.deepEqual(list.sort(), files.map((f) => f.name).sort());
    // Extract + compare
    execFileSync(tarBin, ['-xf', path, '-C', dir]);
    for (const f of files) {
      const got = new Uint8Array(readFileSync(join(dir, f.name)));
      assert.ok(eq(got, f.data), `extracted content mismatch: ${f.name}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('.tar.gz round-trips through gzip + a system tar (if available)', (t) => {
  try { execFileSync('tar', ['--version'], { stdio: 'ignore' }); }
  catch { t.skip('no system tar'); return; }
  const files: TarFile[] = [{ name: 'readme.md', data: enc('# Lolly\n'.repeat(100)) }];
  const targz = gzip(packTar(files));
  // Our own gunzip recovers the tar; a system tar can also read the .tar.gz.
  const tar = gunzip(targz);
  assert.equal(tar.length % 512, 0);
  const dir = mkdtempSync(join(tmpdir(), 'lolly-targz-'));
  try {
    const path = join(dir, 'a.tar.gz');
    writeFileSync(path, targz);
    const list = execFileSync('tar', ['-tzf', path], { encoding: 'utf8' }).trim();
    assert.equal(list, 'readme.md');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
