// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import { exportBackup, importBackup } from '../shells/web/src/data-transfer.ts';
import { packFileHistory, unpackFileHistory, type FileHistorySnapshot } from '../shells/web/src/lib/file-history-backup.ts';
import type { PortableFileOperation } from '../shells/web/src/lib/file-operation-store.ts';
import type { BundleEntry } from '../shells/web/src/lib/bundle.ts';
import type { FileFactsV1 } from '../packages/core/src/file-v1.ts';
import { MemoryRemote } from '../shells/web/src/lib/sync-remote.ts';
import { pushSnapshot, pullAndApply, checkForNewer, INITIAL_SYNC_STATE } from '../shells/web/src/lib/sync-engine.ts';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const request = { version: 1 as const, operation: 'convert', target: 'txt', options: {} };
const facts = (value: string): FileFactsV1 => ({ name: 'proof.txt', format: 'txt', mime: 'text/plain', size: value.length, sha256: digest(value) });
function fixture(): FileHistorySnapshot {
  const operation: PortableFileOperation = { id: '6b0b1437-f729-4b69-b021-32c80f463fb0', state: 'succeeded', input: facts('source'), request, createdAt: 100, updatedAt: 200,
    report: { version: 1, operation: 'convert', state: 'succeeded', inputs: [facts('source')], outputs: [facts('copy')], options: { target: 'txt' }, changes: [], findings: [], metadata: 'not-checked', execution: 'device' },
    output: new File(['copy'], 'proof.txt', { type: 'text/plain' }) };
  return { assetVersions: [{ assetId: 'user/upload/proof', version: 'first', savedAt: 50, bytes: 8, sha256: digest('original'), record: { id: 'user/upload/proof', version: 'first', type: 'text', format: 'txt', blob: new Blob(['original'], { type: 'text/plain' }), credential: new Uint8Array([0, 255, 3]), credentialFormat: 'png', meta: { name: 'Proof.txt', tags: ['work'] } } }], operations: [operation] };
}
const storage = { getItem: () => null, setItem: () => {} };
function host(snapshot = fixture()) {
  const imported: FileHistorySnapshot[] = [];
  const current: Record<string, unknown>[] = [];
  const writes: object[] = [];
  return { imported, writes, current,
    profile: { get: async () => ({ firstname: 'Test' }), set: async (value: object) => { writes.push(value); } },
    state: { list: async () => [], load: async () => null, save: async () => {} },
    assets: { _exportUserAssets: async () => current, _importUserAsset: async (record: Record<string, unknown>) => { current.push(record); } },
    fileHistory: { export: async () => snapshot, restore: async (value: FileHistorySnapshot) => { imported.push(value); return { assetVersions: value.assetVersions.length, fileOperations: value.operations.length, failedHistory: 0 }; } },
  };
}
test('portable backup round-trips exact result, version and credential bytes; old hosts count unsupported parts', async () => {
  const source = host();
  source.current.push({ ...fixture().assetVersions[0]!.record });
  const { blob, summary } = await exportBackup({ host: source, storage });
  assert.equal(summary.assetVersions, 1); assert.equal(summary.fileOperations, 1);
  const target = host();
  const restored = await importBackup({ host: target, storage }, await blob.arrayBuffer());
  assert.equal(restored.failedHistory, 0); assert.equal(restored.skipped, 0);
  const snapshot = target.imported[0]!;
  assert.equal(await snapshot.operations[0]!.output!.text(), 'copy');
  assert.equal(await snapshot.assetVersions[0]!.record.blob!.text(), 'original');
  assert.deepEqual(snapshot.assetVersions[0]!.record.credential, new Uint8Array([0, 255, 3]));
  assert.deepEqual(target.current[0]!.credential, new Uint8Array([0, 255, 3]));
  const { fileHistory: _unused, ...older } = host();
  const partial = await importBackup({ host: older, storage }, await blob.arrayBuffer());
  assert.equal(partial.skipped, 4); assert.equal(partial.userAssets, 1);
});

test('history semantic corruption without envelope integrity fails before any profile writes', async () => {
  const { blob } = await exportBackup({ host: host(), storage });
  const base = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const manifest = JSON.parse(strFromU8(base['manifest.json']!)); delete manifest.integrity;
  base['manifest.json'] = strToU8(JSON.stringify(manifest));
  for (const mutation of ['wrong-result', 'missing-version', 'duplicate-id', 'running-lease', 'bad-json']) {
    const files = { ...base };
    const meta = JSON.parse(strFromU8(files['file-history.json']!));
    if (mutation === 'wrong-result') files['file-history/results/0.bin'] = strToU8('fake');
    if (mutation === 'missing-version') delete files['file-history/versions/0.bin'];
    if (mutation === 'duplicate-id') meta.operations.push(meta.operations[0]);
    if (mutation === 'running-lease') meta.operations[0].state = 'running';
    files['file-history.json'] = strToU8(mutation === 'bad-json' ? '{broken' : JSON.stringify(meta));
    const target = host();
    await assert.rejects(importBackup({ host: target, storage }, zipSync(files)), /integrity|missing|Duplicate|Invalid/);
    assert.equal(target.writes.length, 0, mutation); assert.equal(target.imported.length, 0, mutation);
  }
});

test('history size and per-record limits are checked before blob reads; invalid report states cannot escape', async () => {
  const snapshot = fixture();
  snapshot.assetVersions[0]!.record.blob = { size: 257 * 1024 * 1024, arrayBuffer: async () => { throw new Error('must not read'); } } as unknown as Blob;
  await assert.rejects(packFileHistory(snapshot, {}), /256 MB/);
  const terminal = fixture(); terminal.operations[0]!.report!.state = 'failed';
  await assert.rejects(packFileHistory(terminal, {}), /unsuccessful/);
  const entries: Record<string, BundleEntry> = {};
  const interrupted = fixture(); interrupted.operations = [{ ...interrupted.operations[0]!, output: undefined, report: undefined, state: 'interrupted' }];
  await packFileHistory(interrupted, entries);
  const plain = Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, v instanceof Uint8Array ? new Uint8Array(v) : new Uint8Array(v[0])]));
  assert.equal((await unpackFileHistory(plain))!.operations[0]!.state, 'interrupted');
});

test('failed history imports are counted and legacy credential JSON restores as bytes', async () => {
  const source = host();
  const { blob } = await exportBackup({ host: source, storage });
  const target = host();
  target.fileHistory.restore = async () => ({ assetVersions: 0, fileOperations: 0, failedHistory: 2 });
  assert.equal((await importBackup({ host: target, storage }, await blob.arrayBuffer())).failedHistory, 2);
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const manifest = JSON.parse(strFromU8(files['manifest.json']!)); delete manifest.integrity;
  files['manifest.json'] = strToU8(JSON.stringify(manifest));
  files['assets.json'] = strToU8(JSON.stringify([{ id: 'user/test', format: 'txt', credential: { 0: 9, 1: 255 } }]));
  const legacy = host();
  await importBackup({ host: legacy, storage }, zipSync(files));
  assert.deepEqual(legacy.current[0]!.credential, new Uint8Array([9, 255]));
  files['assets.json'] = strToU8(JSON.stringify([{ id: 'user/test', _file: 'assets/blobs/missing.bin' }]));
  const absent = host(); await assert.rejects(importBackup({ host: absent, storage }, zipSync(files)), /missing/);
  assert.equal(absent.writes.length, 0);
});

test('partial history recovery does not advance the cloud revision or hide a retry', async () => {
  const remote = new MemoryRemote();
  await pushSnapshot({ host: host(), storage }, remote);
  const target = host();
  target.fileHistory.restore = async () => ({ assetVersions: 0, fileOperations: 0, failedHistory: 2 });
  await assert.rejects(pullAndApply({ host: target, storage }, remote), /only partly restored/);
  assert.equal((await checkForNewer(remote, INITIAL_SYNC_STATE)).hasNewer, true);
});
