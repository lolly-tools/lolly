// SPDX-License-Identifier: MPL-2.0
/**
 * "Bulk from files" straight into a ZIP (plan 203 R4): zipBulkFiles frames each
 * output as it is made instead of holding every result and zipping at the end.
 * The archive must be the one the engine's storeZip writes for the same entries,
 * byte for byte, so nothing a reader or a C2PA check sees changes.
 *
 * Run with: node --test tests/bulk-files-stream.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { StoreZipStream, collectBulkFiles, zipBulkFiles, type BulkExportItem } from '../shells/web/src/lib/bulk-files.ts';
import { readZip, storeZip } from '../engine/src/zip.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';

const SIGNED = new Uint8Array(readFileSync(new URL('./fixtures/c2patool-signed.png', import.meta.url)));
const hex = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
function noise(n: number, seed: number): Uint8Array {
  const out = new Uint8Array(n);
  let x = seed >>> 0;
  for (let i = 0; i < n; i++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; out[i] = x >>> 24; }
  return out;
}
const bytesOf = async (blob: Blob): Promise<Uint8Array> => new Uint8Array(await blob.arrayBuffer());

// Recorded from storeZip on main (37214183d) for these four entries.
const REFERENCE_ARCHIVE = '29f3c600a0a7b82b3105859c63de5d14da7f7347cf6f6b3afacb2eab66552554';
const REFERENCE_ENTRIES = () => [
  { name: 'signed.png', bytes: SIGNED },
  { name: 'noise.bin', bytes: noise(300_000, 5) },
  { name: 'notes/日本.txt', bytes: new TextEncoder().encode('text '.repeat(1000)) },
  { name: 'empty.txt', bytes: new Uint8Array(0) },
];

test('the streamed archive matches the reference recorded from storeZip', async () => {
  const zip = new StoreZipStream(storeZip);
  for (const e of REFERENCE_ENTRIES()) zip.add(e.name, e.bytes);
  assert.equal(zip.count, 4);
  assert.equal(hex(await bytesOf(zip.finish())), REFERENCE_ARCHIVE);
  assert.equal(hex(storeZip(REFERENCE_ENTRIES())), REFERENCE_ARCHIVE, 'and storeZip itself still writes it');
});

test('zipBulkFiles writes what collectBulkFiles plus storeZip wrote, skipping the files that fail', async () => {
  const files = [{ name: 'a.png' }, { name: 'bad.png' }, { name: 'c.png' }, { name: 'd.png' }];
  const outputs: Record<number, BulkExportItem[]> = {
    0: [{ bytes: SIGNED, filename: 'out.png' }],
    2: [{ bytes: noise(50_000, 9).buffer as ArrayBuffer, filename: 'out.png' }, { bytes: [1, 2, 3], filename: 'notes.txt' }],
    3: [{ bytes: new TextEncoder().encode('again '.repeat(300)) }],
  };
  const runOne = async (i: number): Promise<BulkExportItem[]> => {
    if (!outputs[i]) throw new Error('unreadable');
    return outputs[i]!;
  };
  const progress: string[] = [];
  const streamed = await zipBulkFiles(files, runOne, storeZip, (done, total) => progress.push(`${done}/${total}`));
  const collected = await collectBulkFiles(files, runOne);
  assert.deepEqual(streamed.failed, ['bad.png']);
  assert.deepEqual(collected.failed, ['bad.png']);
  assert.equal(streamed.count, 4);
  assert.deepEqual(collected.entries.map(e => e.name), ['out.png', 'out-2.png', 'notes.txt', 'd.png']);
  assert.equal(hex(await bytesOf(streamed.blob!)), hex(storeZip(collected.entries)));
  assert.deepEqual(progress, ['0/4', '1/4', '2/4', '3/4', '4/4']);
});

test('a C2PA-signed output comes back out of the archive with its credential intact', async () => {
  const { blob } = await zipBulkFiles([{ name: 'photo.png' }], async () => [{ bytes: SIGNED, filename: 'photo.png' }], storeZip);
  const [entry] = readZip(await bytesOf(blob!));
  assert.equal(entry!.name, 'photo.png');
  assert.deepEqual(entry!.bytes, SIGNED);
  const report = await verifyC2pa(entry!.bytes);
  assert.equal(report.state, 'valid');
  assert.ok(report.checks.some(c => c.ok && c.code === 'assertion.dataHash.match'));
});

test('every file failing gives no archive', async () => {
  const result = await zipBulkFiles([{ name: 'x' }, { name: 'y' }], async () => { throw new Error('no'); }, storeZip);
  assert.equal(result.blob, null);
  assert.equal(result.count, 0);
  assert.deepEqual(result.failed, ['x', 'y']);
});

test('each output is framed once and only its framed member is kept', async () => {
  const framed: number[] = [];
  const counting = (entries: { name: string; bytes: Uint8Array }[]): Uint8Array => { framed.push(entries.length); return storeZip(entries); };
  const zip = new StoreZipStream(counting);
  zip.add('one.bin', noise(10, 1));
  zip.add('two.bin', noise(10, 2));
  assert.deepEqual(framed, [1, 1], 'storeZip is called with one entry at a time');
  assert.throws(() => zip.add('one.bin', noise(1, 3)), /duplicate entry name/);
  const names = readZip(await bytesOf(zip.finish())).map(e => e.name);
  assert.deepEqual(names, ['one.bin', 'two.bin']);
  // A framing function that writes anything but one plain member is refused.
  assert.throws(() => new StoreZipStream(() => storeZip([{ name: 'a', bytes: new Uint8Array(1) }, { name: 'b', bytes: new Uint8Array(1) }])).add('a', new Uint8Array(1)), /cannot extend/);
});
