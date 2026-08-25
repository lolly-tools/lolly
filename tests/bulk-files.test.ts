// SPDX-License-Identifier: MPL-2.0
/**
 * plans/147 M2 - the "Bulk from files" loop (shells/web/src/lib/bulk-files.ts).
 * Pure logic: per-file error isolation, name de-duplication, progress. No engine,
 * no DOM - `runOne` is faked.
 *
 * Run with: node --test tests/bulk-files.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectBulkFiles } from '../shells/web/src/lib/bulk-files.ts';
import { singleFileInputId } from '../shells/web/src/capabilities.ts';

const b = (n: number) => new Uint8Array([n]);

// ── the gate: which tools get "Bulk from files" ─────────────────────────────
const transform = (inputs: Array<{ id?: string; type?: string; multiple?: boolean }>) => ({ render: { export: false }, inputs });

test('gate: a pure transform tool (render.export:false, one single file input) qualifies', () => {
  assert.equal(singleFileInputId(transform([{ id: 'source', type: 'file' }])), 'source');
  assert.equal(singleFileInputId(transform([{ id: 'q', type: 'number' }, { id: 'source', type: 'file' }])), 'source');
});

test('gate: a render tool with a secondary file input is excluded (canvas export, not a transform)', () => {
  // darkroom shape: renders a canvas (render.export not false) + an optional file (LUT).
  assert.equal(singleFileInputId({ render: {}, inputs: [{ id: 'image', type: 'asset' }, { id: 'lutFile', type: 'file' }] }), null);
  // no render block at all → not a declared transform.
  assert.equal(singleFileInputId({ inputs: [{ id: 'modelUpload', type: 'file' }] }), null);
});

test('gate: a multiple file input is excluded (already N-in-one-render), as is zero or two file inputs', () => {
  assert.equal(singleFileInputId(transform([{ id: 'files', type: 'file', multiple: true }])), null);
  assert.equal(singleFileInputId(transform([{ id: 'a', type: 'file' }, { id: 'b', type: 'file' }])), null);
  assert.equal(singleFileInputId(transform([{ id: 'x', type: 'text' }])), null);
  assert.equal(singleFileInputId(null), null);
});

test('one output per file, in order', async () => {
  const files = [{ name: 'a.png' }, { name: 'b.png' }, { name: 'c.png' }];
  const { entries, failed } = await collectBulkFiles(files, async (i) => [{ bytes: b(i), filename: `out-${i}.webp` }]);
  assert.deepEqual(failed, []);
  assert.deepEqual(entries.map((e) => e.name), ['out-0.webp', 'out-1.webp', 'out-2.webp']);
  assert.deepEqual([...entries[1]!.bytes], [1]);
});

test('a file that throws is skipped and reported, the rest still convert', async () => {
  const files = [{ name: 'good1' }, { name: 'bad' }, { name: 'good2' }];
  const { entries, failed } = await collectBulkFiles(files, async (i) => {
    if (i === 1) throw new Error('unreadable');
    return [{ bytes: b(i) }];
  });
  assert.deepEqual(failed, ['bad']);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((e) => e.name), ['good1', 'good2']);
});

test('colliding output names are disambiguated (storeZip rejects duplicates)', async () => {
  const files = [{ name: 'x' }, { name: 'y' }, { name: 'z' }];
  const { entries } = await collectBulkFiles(files, async () => [{ bytes: b(0), filename: 'same.pdf' }]);
  assert.deepEqual(entries.map((e) => e.name), ['same.pdf', 'same-2.pdf', 'same-3.pdf']);
});

test('a file whose exportFile returns several outputs contributes all of them', async () => {
  const { entries } = await collectBulkFiles([{ name: 'multi' }], async () => [
    { bytes: b(1), filename: 'a.svg' },
    { bytes: b(2), filename: 'b.svg' },
  ]);
  assert.deepEqual(entries.map((e) => e.name), ['a.svg', 'b.svg']);
});

test('every file failing yields no entries (caller turns this into an error)', async () => {
  const { entries, failed } = await collectBulkFiles([{ name: 'a' }, { name: 'b' }], async () => { throw new Error('x'); });
  assert.equal(entries.length, 0);
  assert.deepEqual(failed, ['a', 'b']);
});

test('progress reports each start and a final done==total tick', async () => {
  const ticks: Array<[number, number]> = [];
  await collectBulkFiles([{ name: 'a' }, { name: 'b' }], async () => [{ bytes: b(0) }], (done, total) => ticks.push([done, total]));
  assert.deepEqual(ticks, [[0, 2], [1, 2], [2, 2]]);
});
