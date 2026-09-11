// SPDX-License-Identifier: MPL-2.0
/**
 * archive-ingest - explode a plain .zip / .tar / .tar.gz to member files, and REFUSE
 * to shred an OOXML/OCF package that merely shares the PK magic. Fixtures are built
 * by the engine's own writers so the read side is proven against real bytes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { storeZip, packTar, gzip, writeXlsx } from '@lolly/engine';
import {
  readArchiveMembers,
  looksLikePlainArchiveName,
  expandArchiveFiles,
  isIgnoredUploadName,
  ArchiveIngestError,
  MAX_ARCHIVE_MEMBERS,
  archiveBudgetFor, readUploadZip, readUploadArchiveBytes,
} from './archive-ingest.ts';

const enc = new TextEncoder();
const dec = new TextDecoder();

test('nested packages spend the enclosing archive budget', async () => {
  const nested = storeZip([{ name: 'image.png', bytes: new Uint8Array(32) }]);
  const parent = new File([storeZip([{ name: 'animation.lottie', bytes: nested }]) as BlobPart], 'assets.zip');
  const [child] = await expandArchiveFiles([parent]);
  assert.equal(archiveBudgetFor(child!).bytes, 256 * 1024 * 1024 - nested.length);
  assert.equal(archiveBudgetFor(child!), archiveBudgetFor(child!));
  assert.notEqual(archiveBudgetFor(parent), archiveBudgetFor(parent), 'a retried root file starts a fresh operation');
  archiveBudgetFor(child!).bytes = 31;
  assert.throws(() => readUploadZip(nested, archiveBudgetFor(child!)), /maximum|expands|limit/);
});

test('oversized archive is refused before arrayBuffer is called', async () => {
  let read = false;
  const file = { size: 321 * 1024 * 1024, arrayBuffer() { read = true; return Promise.resolve(new ArrayBuffer(0)); } } as File;
  await assert.rejects(readUploadArchiveBytes(file), /input limit/);
  assert.equal(read, false);
});

test('a plain zip explodes to its member files (dirs and empties dropped)', () => {
  const zip = storeZip([
    { name: 'readme.txt', bytes: enc.encode('hello') },
    { name: 'data/', bytes: new Uint8Array(0) },
    { name: 'data/points.csv', bytes: enc.encode('a,b\n1,2') },
  ]);
  const members = readArchiveMembers(zip, 'bundle.zip');
  assert.deepEqual(members.map((m) => m.name).sort(), ['data/points.csv', 'readme.txt']);
  assert.equal(dec.decode(members.find((m) => m.name === 'readme.txt')!.bytes), 'hello');
});

test('a tar explodes to its members', () => {
  const tar = packTar([
    { name: 'a.txt', data: enc.encode('AAA') },
    { name: 'b.txt', data: enc.encode('BBB') },
  ]);
  const members = readArchiveMembers(tar, 'bundle.tar');
  assert.deepEqual(members.map((m) => m.name).sort(), ['a.txt', 'b.txt']);
});

test('a .tar.gz gunzips then untars', () => {
  const tar = packTar([{ name: 'note.txt', data: enc.encode('gz') }]);
  const targz = gzip(tar);
  const members = readArchiveMembers(targz, 'bundle.tar.gz');
  assert.equal(members.length, 1);
  assert.equal(dec.decode(members[0]!.bytes), 'gz');
});

test('an XLSX is REFUSED, not shredded into raw parts', () => {
  const xlsx = writeXlsx({ rows: [['h1', 'h2'], [1, 2]] });
  assert.throws(
    () => readArchiveMembers(xlsx, 'sheet.xlsx'),
    (e: unknown) => e instanceof ArchiveIngestError && /XLSX/.test((e as Error).message),
  );
});

test('non-archive bytes are refused', () => {
  assert.throws(() => readArchiveMembers(enc.encode('just text'), 'x.txt'), ArchiveIngestError);
});

test('an over-large member count is refused', () => {
  const entries = Array.from({ length: MAX_ARCHIVE_MEMBERS + 5 }, (_, i) => ({
    name: `f${i}.txt`,
    bytes: enc.encode(String(i)),
  }));
  const zip = storeZip(entries);
  assert.throws(() => readArchiveMembers(zip, 'many.zip'), /more than/);
});

test('expandArchiveFiles explodes archives, passes non-archives and office files through', async () => {
  const zip = storeZip([
    { name: 'a.png', bytes: enc.encode('PNG-ish') },
    { name: 'b.txt', bytes: enc.encode('text') },
  ]);
  const xlsx = writeXlsx({ rows: [['x']] });
  const files = [
    new File([zip as BlobPart], 'bundle.zip'),
    new File([enc.encode('hello')], 'note.txt'),
    new File([xlsx as BlobPart], 'sheet.xlsx'), // not archive-named → passes through untouched
  ];
  const out = await expandArchiveFiles(files);
  const names = out.map((f) => f.name).sort();
  // zip exploded into 2 members; note.txt + sheet.xlsx passed through → 4 files.
  assert.deepEqual(names, ['a.png', 'b.txt', 'note.txt', 'sheet.xlsx']);
});

test('expandArchiveFiles keeps a broken/renamed archive as-is (byte guard refuses it)', async () => {
  // A .zip-named file that is actually an XLSX must NOT be exploded - it passes
  // through so the normal ingest path handles/reports it.
  const xlsx = writeXlsx({ rows: [['x']] });
  const out = await expandArchiveFiles([new File([xlsx as BlobPart], 'sneaky.zip')]);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.name, 'sneaky.zip');
});

test('a macOS-made zip drops its __MACOSX/._ AppleDouble stubs and .DS_Store', () => {
  // Finder / `zip` on macOS puts a `__MACOSX/` tree of `._name` resource-fork stubs
  // beside every real file, plus a `.DS_Store`. Left in, each became its own blank
  // "VECTOR .bin" upload - an `._foo.svg` matches the .svg name test but holds
  // AppleDouble binary. Only the real files should survive the explode.
  const zip = storeZip([
    { name: 'hlc-color-atlas-01.svg', bytes: enc.encode('<svg viewBox="0 0 1 1"></svg>') },
    { name: 'hlc-color-atlas-02.svg', bytes: enc.encode('<svg viewBox="0 0 1 1"></svg>') },
    { name: '__MACOSX/._hlc-color-atlas-01.svg', bytes: enc.encode('\x00\x05\x16\x07 applefile') },
    { name: '__MACOSX/._hlc-color-atlas-02.svg', bytes: enc.encode('\x00\x05\x16\x07 applefile') },
    { name: '._hlc-color-atlas-01.svg', bytes: enc.encode('\x00\x05\x16\x07 applefile') },
    { name: '.DS_Store', bytes: enc.encode('Bud1 junk') },
  ]);
  const members = readArchiveMembers(zip, 'Archive.zip');
  assert.deepEqual(members.map((m) => m.name).sort(), ['hlc-color-atlas-01.svg', 'hlc-color-atlas-02.svg']);
});

test('isIgnoredUploadName flags OS bookkeeping, keeps real files', () => {
  assert.equal(isIgnoredUploadName('__MACOSX/._art.svg'), true);
  assert.equal(isIgnoredUploadName('._art.svg'), true);         // AppleDouble beside a real file
  assert.equal(isIgnoredUploadName('folder/._art.svg'), true);  // nested AppleDouble
  assert.equal(isIgnoredUploadName('.DS_Store'), true);
  assert.equal(isIgnoredUploadName('sub/.DS_Store'), true);
  assert.equal(isIgnoredUploadName('Thumbs.db'), true);
  assert.equal(isIgnoredUploadName('art.svg'), false);
  assert.equal(isIgnoredUploadName('_underscore.svg'), false);  // single underscore is a real name
  assert.equal(isIgnoredUploadName('folder/photo.png'), false);
});

test('looksLikePlainArchiveName accepts archives, excludes design bundles', () => {
  assert.equal(looksLikePlainArchiveName('bundle.zip'), true);
  assert.equal(looksLikePlainArchiveName('logs.tar'), true);
  assert.equal(looksLikePlainArchiveName('backup.tar.gz'), true);
  assert.equal(looksLikePlainArchiveName('backup.tgz'), true);
  assert.equal(looksLikePlainArchiveName('brand.penpot'), false); // design bundle
  assert.equal(looksLikePlainArchiveName('art.fig'), false);      // design bundle
  assert.equal(looksLikePlainArchiveName('photo.png'), false);
});
