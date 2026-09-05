// SPDX-License-Identifier: MPL-2.0
/**
 * tests/cpio.test.ts - the newc (SVR4) cpio writer: header layout + field values,
 * 4-byte padding, the TRAILER!!! sentinel, byte-for-byte determinism, and - when a
 * system reader (bsdtar/libarchive or cpio) exists - a real list + extract of our
 * archive so we know a consumer, not just our own asserts, accepts it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { packCpio, type CpioFile } from '../engine/src/cpio.ts';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
const dec = (b: Uint8Array): string => new TextDecoder().decode(b);
const eq = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
const hexField = (b: Uint8Array, off: number): number => parseInt(dec(b.subarray(off, off + 8)), 16);

test('packCpio writes valid newc headers, 4-byte padding, and a trailer', () => {
  const files: CpioFile[] = [
    { name: './usr/share/x/a.txt', data: enc('alpha') },
    { name: './usr/share/x/b.bin', data: Uint8Array.of(1, 2, 3, 4, 5, 6, 7) },
  ];
  const out = packCpio(files);

  let off = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    assert.equal(dec(out.subarray(off, off + 6)), '070701', 'newc magic');
    assert.equal(hexField(out, off + 6), i + 1, 'ino is sequential from 1');
    assert.equal(hexField(out, off + 14), 0o100000 | 0o644, 'mode = S_IFREG|0644');
    const filesize = hexField(out, off + 54);
    assert.equal(filesize, f.data.length, 'filesize field');
    const namesize = hexField(out, off + 94);
    assert.equal(hexField(out, off + 102), 0, 'check field is 0 for newc');
    const name = dec(out.subarray(off + 110, off + 110 + namesize - 1)); // minus the NUL
    assert.equal(name, f.name);
    // header+name padded to 4, then data padded to 4
    const afterName = (off + 110 + namesize + 3) & ~3;
    assert.ok(eq(out.subarray(afterName, afterName + f.data.length), f.data), 'data present');
    off = (afterName + f.data.length + 3) & ~3;
    assert.equal(off % 4, 0, '4-byte aligned after data');
  }
  // trailer
  assert.equal(dec(out.subarray(off, off + 6)), '070701');
  const tnamesize = hexField(out, off + 94);
  assert.equal(dec(out.subarray(off + 110, off + 110 + tnamesize - 1)), 'TRAILER!!!');
  assert.equal(hexField(out, off + 54), 0, 'trailer filesize 0');
});

test('directory members carry S_IFDIR and zero data', () => {
  const out = packCpio([{ name: './usr/share/x', data: new Uint8Array(0), mode: 0o040000 | 0o755 }]);
  assert.equal(hexField(out, 14), 0o040000 | 0o755, 'mode = S_IFDIR|0755');
  assert.equal(hexField(out, 54), 0, 'directory filesize 0');
});

test('packCpio is deterministic (same input → identical bytes)', () => {
  const files: CpioFile[] = [
    { name: './a', data: enc('one') },
    { name: './b', data: enc('two') },
  ];
  assert.ok(eq(packCpio(files), packCpio(files)));
});

test('packCpio rejects an empty member name', () => {
  assert.throws(() => packCpio([{ name: '', data: new Uint8Array(0) }]), /empty member name/);
});

test('a system reader can list + extract our cpio (if available)', (t) => {
  // libarchive's bsdtar auto-detects newc; fall back to cpio; skip if neither.
  let reader: 'bsdtar' | 'cpio' | '' = '';
  for (const [bin, arg] of [['bsdtar', '--version'], ['cpio', '--version']] as const) {
    try { execFileSync(bin, [arg], { stdio: 'ignore' }); reader = bin as 'bsdtar' | 'cpio'; break; } catch { /* next */ }
  }
  if (!reader) { t.skip('no bsdtar or cpio'); return; }

  const files: CpioFile[] = [
    { name: './hello.txt', data: enc('hello from lolly') },
    { name: './nested/data.bin', data: Uint8Array.from({ length: 300 }, (_, i) => i & 0xff) },
  ];
  const dir = mkdtempSync(join(tmpdir(), 'lolly-cpio-'));
  try {
    const path = join(dir, 'a.cpio');
    writeFileSync(path, packCpio(files));
    if (reader === 'bsdtar') {
      const list = execFileSync('bsdtar', ['-tf', path], { encoding: 'utf8' }).trim().split('\n').sort();
      assert.deepEqual(list, files.map((f) => f.name).sort());
      execFileSync('bsdtar', ['-xf', path, '-C', dir]);
    } else {
      execFileSync('cpio', ['-idm', '-I', path], { cwd: dir, stdio: 'ignore' });
    }
    for (const f of files) {
      const got = new Uint8Array(readFileSync(join(dir, f.name.replace(/^\.\//, ''))));
      assert.ok(eq(got, f.data), `extracted content mismatch: ${f.name}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
