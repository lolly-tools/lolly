// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { addFileResultToLibrary, canDesignWithFile, fileResultType, fileResultDesignSeed, type FileResultLibraryHost } from '../shells/web/src/lib/file-result-library.ts';
import type { LocalFileOperation } from '../shells/web/src/lib/file-operation-store.ts';
import type { FileFactsV1 } from '../packages/core/src/file-v1.ts';
import type { AssetRef } from '../packages/core/src/host-v1.ts';

const facts: FileFactsV1 = { name: 'proof.png', mime: 'image/png', format: 'png', size: 4, width: 300, height: 150, sha256: createHash('sha256').update('copy').digest('hex') };
function fixture() {
  type Record = Parameters<FileResultLibraryHost['assets']['_uploadUserAsset']>[0];
  const records = new Map<string, Record>(); const writes: Record[] = [];
  const id = crypto.randomUUID();
  const file = new File(['copy'], 'proof.png', { type: 'image/png' });
  const record: LocalFileOperation = { id, state: 'succeeded', input: { ...facts, name: 'original.svg' }, request: { version: 1, operation: 'convert', target: 'png', options: {} }, createdAt: 1, updatedAt: 1, leaseUntil: 0, reservedBytes: 0, storedBytes: 4,
    report: { version: 1, operation: 'convert', state: 'succeeded', inputs: [facts], outputs: [facts], changes: [], findings: [], options: { target: 'png' }, metadata: 'removed', execution: 'device' } };
  const store = { list: async () => [record], getOutput: async () => file as File | null };
  const host: FileResultLibraryHost = { assets: {
    _getUserRecord: async id => records.get(id) ?? null,
    _uploadUserAsset: async (record, options) => { assert.equal(options.expectedVersion, null); assert.equal(records.has(record.id), false); writes.push(record); records.set(record.id, record); },
    get: async (id, options) => { const r = records.get(id)!; assert.equal(options?.version, r.version); return { id, source: 'user', type: r.type, format: r.format, version: r.version, url: 'blob:local', checksum: r.checksum }; },
  } };
  return { host, store, id, records, writes, file };
}
test('explicit reuse keeps exact bytes, source/output lineage and stable identity; repeat clicks deduplicate', async () => {
  const f = fixture(); const first = await addFileResultToLibrary(f.store, f.id, f.host);
  const twice = await addFileResultToLibrary(f.store, f.id, f.host);
  assert.equal(first.id, twice.id); assert.equal(first.version, twice.version); assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0]!.blob, f.file); assert.equal(f.writes[0]!.checksum, facts.sha256);
  assert.deepEqual(f.writes[0]!.meta.fileReference, { id: first.id, version: first.version, role: 'output', facts, derivedFrom: { id: `file-source:${f.id}`, sha256: facts.sha256 } });
  assert.equal(f.writes[0]!.meta.sourceBytesRetained, false);
  assert.equal(fileResultDesignSeed(first, facts).__export_width, 300);
  assert.equal(fileResultDesignSeed(first, facts).__export_height, 150);
  const boxes = fileResultDesignSeed(first, facts).boxes as Array<{ image?: { id: string }; w: number; h: number }>;
  assert.equal(boxes.length, 2); assert.deepEqual(boxes[1]!.image, { id: first.id });
  assert.deepEqual([boxes[0]!.w, boxes[0]!.h], [300, 150]);
});
test('missing results and edited library copies are not overwritten or represented as success', async () => {
  const f = fixture(); const first = await addFileResultToLibrary(f.store, f.id, f.host);
  f.records.get(first.id)!.blob = new Blob(['edited']);
  await assert.rejects(addFileResultToLibrary(f.store, f.id, f.host), /edited/);
  assert.equal(await f.records.get(first.id)!.blob.text(), 'edited'); assert.equal(f.writes.length, 1);
  f.store.getOutput = async () => null;
  await assert.rejects(addFileResultToLibrary(f.store, f.id, f.host), /missing/);
});
test('opaque files never become active vector content or counterfeit animation; design requires bounded image geometry', () => {
  assert.equal(fileResultType({ ...facts, format: 'json', mime: 'application/json' }), 'text');
  assert.equal(fileResultType({ ...facts, format: 'svg', mime: 'image/svg+xml' }), 'data');
  assert.equal(fileResultType({ ...facts, format: 'html', mime: 'text/html' }), 'data');
  assert.equal(canDesignWithFile({ ...facts, width: undefined }), false);
  assert.equal(canDesignWithFile({ ...facts, width: 17000 }), false);
  assert.throws(() => fileResultDesignSeed({ id: 'user/test' } as AssetRef, { ...facts, width: undefined }), /verified/);
});
