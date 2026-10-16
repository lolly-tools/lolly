// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createAssetsAPI } from '../shells/web/src/bridge/assets.ts';
import { memoryDb } from '../shells/web/src/bridge/idb-memory.test-utils.ts';
import { retainCatalogRead, catalogSourceHistory } from '../shells/web/src/bridge/catalog-history.ts';
import { buildLollyFile, readLollyFile, LOLLY_MIN_READER } from '../shells/web/src/lib/lolly-pack.ts';
import { lollyLibraryResolver } from '../shells/web/src/views/tool-lolly-vehicle.ts';
import { executeFileOperationV1 } from '../packages/core/src/file-operation-v1.ts';
import { FileOperationStore } from '../shells/web/src/lib/file-operation-store.ts';
import { createFileHistoryBackup } from '../shells/web/src/lib/file-history-backup.ts';

test('the existing package vehicle carries exact selected bytes or preserves an unavailable pin; private observations never become parts', async () => {
  const { db } = memoryDb(), assets = createAssetsAPI(db as never);
  const id = `ext/library/photo?file=${'a'.repeat(24)}`;
  const ref = await retainCatalogRead(db as never, { id, source: 'library', type: 'raster', format: 'png', version: 'source-v1', url: '', meta: { license: 'CC0-1.0', name: 'Selected' } }, new Blob(['selected old bytes']));
  const session = { __toolId: 'design', image: ref };
  const built = await buildLollyFile({ session, toolId: 'design', userAssets: [], resolveLibrary: lollyLibraryResolver(assets as never) });
  const carried = built.manifest.assets[0]!;
  assert.equal(carried.kind, 'asset'); assert.equal(built.manifest.minReader, LOLLY_MIN_READER);
  const read = await readLollyFile(await built.blob.arrayBuffer());
  assert.doesNotMatch(Object.keys(read.files).join('\n'), /asset-observations|source-review|recipe/);
  assert.ok(Object.values(read.files).some(bytes => new TextDecoder().decode(bytes) === 'selected old bytes'));
  await db.delete('asset-blob', `${id}:png:${ref.pin!.version}`);
  const missing = await buildLollyFile({ session, toolId: 'design', userAssets: [], resolveLibrary: lollyLibraryResolver(assets as never) });
  assert.equal(missing.manifest.assets[0]!.kind, 'asset-ref');
  assert.equal(missing.manifest.assets[0]!.id, carried.id);
});
test('existing operation receipts join held byte digests and imported reports never acquire local execution origin', async () => {
  const { db } = memoryDb(), operations = new FileOperationStore(db as never);
  const file = new File(['old bytes'], 'source.txt', { type: 'text/plain' });
  const describe = async (value: File) => ({ name: value.name, format: 'txt', mime: value.type, size: value.size, sha256: createHash('sha256').update(new Uint8Array(await value.arrayBuffer())).digest('hex') });
  const request = { version: 1 as const, operation: 'copy', target: 'txt', options: {} };
  const job = await operations.begin(await describe(file), request, 1024);
  const executed = await executeFileOperationV1(file, request, { describe, execute: async value => new File([value], 'copy.txt', { type: value.type }), effects: () => ({ metadata: 'preserved', findings: [] }) });
  await operations.finish(job.id, executed.report, executed.output);
  await retainCatalogRead(db as never, { id: 'file/source', source: 'library', type: 'text', format: 'txt', url: '' }, file);
  const local = await catalogSourceHistory(db as never, 'file/source');
  assert.equal(local.reports[0]?.origin, 'observed-here');
  const backup = await createFileHistoryBackup(db as never, async () => operations).export();
  assert.equal('origin' in backup.operations[0]!, false, 'the local observation label is outside the portable report');
  const other = memoryDb(), receiver = new FileOperationStore(other.db as never);
  await receiver.importRecord(backup.operations[0]!);
  assert.equal((await receiver.list())[0]?.origin, 'imported');
  await retainCatalogRead(other.db as never, { id: 'file/source', source: 'library', type: 'text', format: 'txt', url: '' }, file);
  assert.equal((await catalogSourceHistory(other.db as never, 'file/source')).reports[0]?.origin, 'imported');
});
