// SPDX-License-Identifier: MPL-2.0
// Round-trip + edge coverage for the USTAR reader: pack with the existing writer,
// read back with tar-read, and hand-assemble a few awkward archives the writer
// never produces (long paths via prefix, skipped non-file entries, .tar.gz,
// truncation) to prove the parser's bounds and skip logic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packTar, type TarFile } from '../engine/src/tar.ts';
import { gzip } from '../engine/src/gzip.ts';
import { readTar, readTarGz } from '../engine/src/tar-read.ts';

const enc = (s: string) => new TextEncoder().encode(s);

test('round-trips names and bytes exactly through packTar → readTar', () => {
  const files: TarFile[] = [
    { name: 'logo.svg', data: enc('<svg>hi</svg>') },
    { name: 'brand/tokens.json', data: enc('{"color":"#0c322c"}') },
    // A payload whose length is an exact multiple of 512 (no padding).
    { name: 'exact.bin', data: new Uint8Array(512).fill(0xab) },
    // A payload that forces padding (not a 512 multiple).
    { name: 'odd.bin', data: new Uint8Array(700).map((_, i) => i & 0xff) },
    // Empty file: header only, zero data blocks.
    { name: 'empty', data: new Uint8Array(0) },
  ];

  const archive = packTar(files);
  const out = readTar(archive);

  assert.equal(out.length, files.length);
  for (let i = 0; i < files.length; i++) {
    assert.equal(out[i]!.name, files[i]!.name, `name[${i}]`);
    assert.deepEqual(out[i]!.data, files[i]!.data, `data[${i}]`);
  }
});

test('readTarGz gunzips then reads', () => {
  const files: TarFile[] = [{ name: 'a.txt', data: enc('alpha') }, { name: 'b.txt', data: enc('beta') }];
  const gz = gzip(packTar(files));
  const out = readTarGz(gz);
  assert.equal(out.length, 2);
  assert.equal(out[0]!.name, 'a.txt');
  assert.deepEqual(out[1]!.data, enc('beta'));
});

// ── Hand-assembled archives the writer never emits ──────────────────────────

/** Build one raw USTAR block with the given fields; caller sets typeflag/name/prefix. */
function buildHeader(opts: {
  name: string;
  size: number;
  typeflag: number;
  prefix?: string;
  magic?: boolean;
}): Uint8Array {
  const h = new Uint8Array(BLOCK);
  h.set(enc(opts.name), 0);
  writeOctal(h, 124, 12, opts.size);
  h[156] = opts.typeflag;
  if (opts.magic !== false) {
    h.set(enc('ustar\0'), 257);
    h[263] = 0x30;
    h[264] = 0x30;
  }
  if (opts.prefix) h.set(enc(opts.prefix), 345);
  // Checksum: sum of all bytes with the chksum field as spaces.
  for (let i = 0; i < 8; i++) h[148 + i] = 0x20;
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += h[i]!;
  // 6 octal digits, NUL, space.
  let v = sum >>> 0;
  for (let i = 5; i >= 0; i--) { h[148 + i] = 0x30 + (v & 7); v >>>= 3; }
  h[154] = 0x00;
  h[155] = 0x20;
  return h;
}

const BLOCK = 512;
function writeOctal(out: Uint8Array, off: number, width: number, value: number): void {
  const digits = width - 1;
  let v = Math.floor(value);
  for (let i = digits - 1; i >= 0; i--) { out[off + i] = 0x30 + (v % 8); v = Math.floor(v / 8); }
  out[off + digits] = 0x20;
}

function padTo512(n: number): number { return (n + 511) & ~511; }

/** Concatenate header+data members and the two-zero-block trailer into one archive. */
function assemble(members: { header: Uint8Array; data: Uint8Array }[]): Uint8Array {
  let total = 0;
  for (const m of members) total += BLOCK + padTo512(m.data.length);
  total += 2 * BLOCK;
  const out = new Uint8Array(total);
  let off = 0;
  for (const m of members) {
    out.set(m.header, off);
    off += BLOCK;
    out.set(m.data, off);
    off += padTo512(m.data.length);
  }
  return out;
}

test('reconstructs a long path from the prefix field', () => {
  const data = enc('deep');
  const header = buildHeader({ name: 'tokens.json', size: data.length, typeflag: 0x30, prefix: 'brands/suse/catalog' });
  const out = readTar(assemble([{ header, data }]));
  assert.equal(out.length, 1);
  assert.equal(out[0]!.name, 'brands/suse/catalog/tokens.json');
  assert.deepEqual(out[0]!.data, data);
});

test('skips directory, link and pax entries but keeps regular files', () => {
  const dir = buildHeader({ name: 'sub/', size: 0, typeflag: 0x35 }); // '5' directory
  const link = buildHeader({ name: 'ln', size: 0, typeflag: 0x32 });  // '2' symlink
  const paxData = enc('30 mtime=1700000000.0\n');
  const pax = buildHeader({ name: 'PaxHeaders/x', size: paxData.length, typeflag: 0x78 }); // 'x' pax
  const realData = enc('kept');
  const real = buildHeader({ name: 'real.txt', size: realData.length, typeflag: 0x30 });

  const out = readTar(assemble([
    { header: dir, data: new Uint8Array(0) },
    { header: link, data: new Uint8Array(0) },
    { header: pax, data: paxData },      // pax payload must be consumed to stay aligned
    { header: real, data: realData },
  ]));

  assert.equal(out.length, 1);
  assert.equal(out[0]!.name, 'real.txt');
  assert.deepEqual(out[0]!.data, realData);
});

test("reads a NUL-typeflag regular file (v7 archive, no magic)", () => {
  const data = enc('legacy');
  const header = buildHeader({ name: 'old.txt', size: data.length, typeflag: 0x00, magic: false });
  const out = readTar(assemble([{ header, data }]));
  assert.equal(out.length, 1);
  assert.deepEqual(out[0]!.data, data);
});

test('throws on a declared size that overruns the archive', () => {
  // Header claims 4096 bytes but the archive has none following.
  const header = buildHeader({ name: 'lie.bin', size: 4096, typeflag: 0x30 });
  const bad = new Uint8Array(BLOCK); // header only, no data, no trailer
  bad.set(header, 0);
  assert.throws(() => readTar(bad), /overruns/);
});

test('throws on a corrupt header checksum', () => {
  const data = enc('x');
  const header = buildHeader({ name: 'f', size: data.length, typeflag: 0x30 });
  header[10] = (header[10]! ^ 0xff) & 0xff; // flip a byte in the name field, invalidating the stored checksum
  assert.throws(() => readTar(assemble([{ header, data }])), /checksum/);
});

test('empty archive (two zero blocks) reads as no files', () => {
  assert.deepEqual(readTar(new Uint8Array(2 * BLOCK)), []);
});

test('member, payload and whole-archive budgets are enforced before copying output', () => {
  const archive = packTar([
    { name: 'a', data: enc('alpha') },
    { name: 'b', data: enc('beta') },
  ]);
  assert.throws(() => readTar(archive, { maxMembers: 1 }), /more than 1 members/);
  assert.throws(() => readTar(archive, { maxPayloadBytes: 8 }), /payloads exceed 8/);
  assert.throws(() => readTar(archive, { maxArchiveBytes: archive.length - 1 }), /archive size .* exceeds/);
  assert.throws(() => readTar(archive, { maxMembers: -1 }), /non-negative safe integer/);
});

test('readTarGz applies the uncompressed archive budget before allocating the tar result', () => {
  const archive = packTar([{ name: 'a', data: enc('alpha') }]);
  assert.throws(() => readTarGz(gzip(archive), { maxArchiveBytes: archive.length - 1 }), /declared output .* exceeds/);
});
