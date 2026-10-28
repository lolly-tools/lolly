// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TarScanner, entryPath, pack, scan, unpack } from '../scripts/artifact-archive.ts';

// A hand-written ustar header, so each refusal case is exactly the bytes it claims to be.
function header(name: string, type: string, size = 0, extra: { linkname?: string; prefix?: string } = {}): Buffer {
  const block = Buffer.alloc(512);
  block.write(name, 0, 100, 'utf8');
  block.write('0000644\0', 100);
  block.write('0000000\0', 108);
  block.write('0000000\0', 116);
  block.write(size.toString(8).padStart(11, '0') + '\0', 124);
  block.write('00000000000\0', 136);
  block.write('        ', 148);
  block.write(type, 156);
  block.write(extra.linkname ?? '', 157, 100);
  block.write('ustar\0', 257);
  block.write('00', 263);
  block.write(extra.prefix ?? '', 345, 155);
  let sum = 0;
  for (const byte of block) sum += byte;
  block.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  return block;
}
const body = (bytes: Buffer) => Buffer.concat([bytes, Buffer.alloc((512 - (bytes.length % 512)) % 512)]);
const file = (name: string, content: string) => [header(name, '0', Buffer.byteLength(content)), body(Buffer.from(content))];
const pax = (records: Record<string, string>) => {
  const text = Object.entries(records).map(([key, value]) => {
    const line = ` ${key}=${value}\n`;
    let length = line.length + 1;
    while (String(length).length + line.length !== length) length = String(length).length + line.length;
    return `${length}${line}`;
  }).join('');
  return [header('PaxHeader', 'x', Buffer.byteLength(text)), body(Buffer.from(text))];
};
const tar = (...entries: Buffer[][]) => Buffer.concat([...entries.flat(), Buffer.alloc(1024)]);

function scanBytes(bytes: Buffer, chunk = 777) {
  const scanner = new TarScanner();
  for (let offset = 0; offset < bytes.length; offset += chunk) scanner.write(bytes.subarray(offset, offset + chunk));
  return scanner.end();
}

test('the scanner reads files, directories, prefixes, pax paths and long names across odd chunk sizes', () => {
  const long = 'deep/'.repeat(30) + 'file.json';
  const summary = scanBytes(tar(
    [header('./', '5')],
    [header('assets/', '5')],
    file('./index.html', '<!doctype html>'),
    file('name.js', 'x'.repeat(1300)),
    file('sub/b.css', 'b'),
    [header('a.txt', '0', 3, { prefix: 'very/long/prefix' }), body(Buffer.from('abc'))],
    pax({ path: long }), file('ignored-by-pax', '{}'),
    [header('././@LongLink', 'L', 21), body(Buffer.from('gnu/long/name.txt\0pad'))], file('ignored-by-L', 'z'),
    pax({ size: '2' }), [header('pax-size.txt', '0', 99), body(Buffer.from('ok'))],
  ));
  assert.deepEqual(summary, { files: 7, directories: 2, bytes: 15 + 1300 + 1 + 3 + 2 + 1 + 2 });
  for (const chunk of [1, 511, 512, 513, 100000]) assert.equal(scanBytes(tar(file('a', 'b'), [header('d/', '5')]), chunk).files, 1);
});

test('the scanner refuses links, devices, escapes, repeats and damaged archives', () => {
  const cases: [string, Buffer, RegExp][] = [
    ['symbolic link', tar([header('link', '2', 0, { linkname: '/etc/passwd' })]), /symbolic link "link"/],
    ['hard link', tar(file('a', 'x'), [header('b', '1', 0, { linkname: 'a' })]), /hard link "b"/],
    ['character device', tar([header('dev', '3')]), /character device/],
    ['FIFO', tar([header('pipe', '6')]), /FIFO/],
    ['global pax', tar([header('g', 'g', 0)]), /global pax header/],
    ['sparse', tar([header('s', 'S', 0)]), /sparse file/],
    ['parent step', tar(file('../escape.txt', 'x')), /"\.\." step/],
    ['inner parent step', tar(file('a/../../escape.txt', 'x')), /"\.\." step/],
    ['parent through pax', tar(pax({ path: 'ok/../../x' }), file('fine', 'x')), /"\.\." step/],
    ['parent through prefix', tar([header('x', '0', 0, { prefix: '..' })]), /"\.\." step/],
    ['absolute', tar(file('/etc/cron.d/x', 'x')), /absolute path/],
    ['absolute through L', tar([header('././@LongLink', 'L', 7), body(Buffer.from('/x/y.z\0'))], file('n', 'x')), /absolute path/],
    ['pax link path', tar(pax({ linkpath: 'x' }), file('a', 'b')), /linkpath is not allowed/],
    ['repeated path', tar(file('a', 'x'), file('./a', 'y')), /appears twice/],
    ['directory with data', tar([header('d/', '5', 4)]), /directory entry carries data/],
    ['control character', tar(file('a\nb', 'x')), /control character/],
    ['empty name', tar(file('', 'x')), /control character|no name/],
    ['bad checksum', (() => { const bytes = tar(file('a', 'x')); bytes[0] = 0x62; return bytes; })(), /checksum/],
    ['truncated data', tar(file('a', 'x')).subarray(0, 600), /truncated|no end marker/],
    ['no end marker', Buffer.concat(file('a', 'x')), /no end marker/],
    ['data after end', Buffer.concat([tar(file('a', 'x')), header('late', '0')]), /follows the end/],
  ];
  for (const [name, bytes, expected] of cases) assert.throws(() => scanBytes(bytes), expected, name);
  assert.equal(entryPath('./a/b/', true), 'a/b');
  assert.equal(entryPath('./', true), '');
  assert.throws(() => entryPath('./', false), /no name/);
});

const tools = ['tar', 'zstd'].every(command => spawnSync(command, ['--version'], { stdio: 'ignore' }).status === 0);
const skip = tools ? false : 'needs tar and zstd on PATH';

function workspace(t: { after(fn: () => void): void }): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'lolly-artifact-archive-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test('pack and unpack keep bytes, hidden files, empty directories and the epoch stamp', { skip }, async t => {
  const root = workspace(t), source = join(root, 'source');
  const deep = join(source, 'a'.repeat(60), 'b'.repeat(60), 'c'.repeat(60));
  mkdirSync(deep, { recursive: true });
  mkdirSync(join(source, '.well-known'));
  mkdirSync(join(source, 'empty'));
  writeFileSync(join(source, 'index.html'), '<!doctype html>');
  writeFileSync(join(source, '.delivery-etags.conf'), 'map {}\n');
  writeFileSync(join(source, '.well-known', 'security.txt'), 'Contact: x');
  writeFileSync(join(deep, 'd'.repeat(90) + '.json'), JSON.stringify({ deep: true }));
  writeFileSync(join(root, 'outside.txt'), 'followed, not linked');
  symlinkSync(join(root, 'outside.txt'), join(source, 'linked.txt'));
  utimesSync(join(source, 'index.html'), 0, 0);

  const archive = join(root, 'frontend.tar.zst');
  const packed = await pack(source, archive);
  assert.equal(packed.files, 5);
  assert.deepEqual(await scan(archive), packed);
  await assert.rejects(pack(source, archive), /already exists/);
  await assert.rejects(pack(source, join(root, 'frontend.zip')), /\.tar\.zst/);

  const out = join(root, 'out');
  assert.deepEqual(await unpack(archive, out), packed);
  for (const path of ['index.html', '.delivery-etags.conf', '.well-known/security.txt', 'linked.txt']) {
    assert.equal(readFileSync(join(out, path), 'utf8'), readFileSync(join(source, path), 'utf8'), path);
  }
  assert.ok(statSync(join(out, 'linked.txt')).isFile(), 'a followed link arrives as a regular file');
  assert.ok(statSync(join(out, 'empty')).isDirectory());
  assert.equal(statSync(join(out, 'index.html')).mtimeMs, 0, 'the epoch stamp scripts/build-delivery.ts sets survives');
  await assert.rejects(unpack(archive, out), /already exists/);
});

test('unpack writes nothing when any entry is refused', { skip }, async t => {
  const root = workspace(t);
  for (const [name, bytes] of [
    ['link', tar(file('first.txt', 'x'), [header('escape', '2', 0, { linkname: '../../outside' })])],
    ['parent', tar(file('first.txt', 'x'), file('../escape.txt', 'x'))],
  ] as const) {
    const archive = join(root, `${name}.tar.zst`);
    const compressed = spawnSync('zstd', ['-q', '-c'], { input: bytes });
    assert.equal(compressed.status, 0);
    writeFileSync(archive, compressed.stdout);
    const out = join(root, `out-${name}`);
    await assert.rejects(unpack(archive, out), /Artifact archive refused/, name);
    assert.equal(existsSync(out), false, `${name}: nothing was extracted`);
    assert.equal(existsSync(join(root, 'escape.txt')), false);
  }
});
