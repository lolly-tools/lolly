// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { runSavedFileOperation } from '../shells/web/src/lib/saved-file-operation.ts';
import { fileBatchReportV1 } from '../packages/core/src/file-operation-v1.ts';
import type { FileOperationReportV1 } from '../packages/core/src/file-v1.ts';
import type { LocalFileOperation } from '../shells/web/src/lib/file-operation-store.ts';
const request = { version: 1 as const, operation: 'convert', target: 'txt', options: {} };
const file = new File(['original'], 'original.txt', { type: 'text/plain' });
const facts = { name: file.name, format: 'txt', size: file.size, mime: file.type };
function deps() {
  const abandoned: FileOperationReportV1[] = [];
  const saved: FileOperationReportV1[] = [];
  const report: FileOperationReportV1 = { version: 1, operation: 'convert', state: 'succeeded', inputs: [facts], outputs: [facts], options: {}, changes: [], findings: [], metadata: 'not-checked', execution: 'device' };
  const store = {
    begin: async () => ({ id: crypto.randomUUID() } as LocalFileOperation),
    heartbeat: async () => {},
    finish: async (_id: string, value: FileOperationReportV1) => { saved.push(value); },
    abandon: async (_id: string, _reason: string, value?: FileOperationReportV1) => { if (value) abandoned.push(value); },
  };
  return { abandoned, saved, storeImpl: store, store: async () => store, describe: async () => facts, execute: async (): Promise<{ report: FileOperationReportV1; output?: File }> => ({ report, output: file }) };
}
test('a saving failure replaces encoder success in both journal and batch reports', async () => {
  const adapter = deps(); adapter.storeImpl.finish = async () => { throw new Error('Storage is full.'); };
  const result = await runSavedFileOperation(file, request, adapter);
  assert.equal(result.output, undefined); assert.equal(result.report.state, 'failed');
  assert.deepEqual(result.report.outputs, []); assert.equal(result.report.findings[0]!.code, 'result-not-saved');
  assert.deepEqual(adapter.abandoned, [result.report]);
  assert.deepEqual(fileBatchReportV1([result.report]).counts, { succeeded: 0, failed: 1, cancelled: 0 });
  const unreadAgain = deps();
  const previousExecute = unreadAgain.execute;
  unreadAgain.execute = async () => {
    const outcome = await previousExecute();
    return { report: { ...outcome.report, state: 'failed', inputs: [], outputs: [] } };
  };
  const failedRead = await runSavedFileOperation(file, request, unreadAgain);
  assert.deepEqual(failedRead.report.inputs, [await unreadAgain.describe()]);
  assert.equal(failedRead.output, undefined); assert.equal(unreadAgain.saved[0]!.state, 'failed');
});
test('unstarted cancelled files produce complete batch membership without reading or reserving bytes', async () => {
  const adapter = deps(); const controller = new AbortController(); controller.abort();
  adapter.describe = async () => { throw new Error('must not read'); };
  adapter.store = async () => { throw new Error('must not reserve'); };
  const reports = [];
  for (const name of ['one.txt', 'two.txt', 'three.txt']) reports.push((await runSavedFileOperation(new File(['x'], name), request, adapter, controller.signal)).report);
  const batch = fileBatchReportV1(reports);
  assert.deepEqual(batch.counts, { succeeded: 0, failed: 0, cancelled: 3 });
  assert.deepEqual(batch.results.map(r => r.inputs[0]!.name), ['one.txt', 'two.txt', 'three.txt']);
  assert.ok(batch.results.every(r => r.inputs[0]!.formatSource === 'declared' && !r.inputs[0]!.sha256 && r.findings[0]!.code === 'not-started'));
});
test('cancellation after encoding is fenced before persistence and quota failures are receipts too', async () => {
  const adapter = deps(); const controller = new AbortController();
  const execute = adapter.execute;
  adapter.execute = async () => { controller.abort(); return execute(); };
  const cancelled = await runSavedFileOperation(file, request, adapter, controller.signal);
  assert.equal(cancelled.report.state, 'cancelled'); assert.equal(adapter.saved.length, 0); assert.equal(adapter.abandoned.length, 1);
  const quota = deps(); quota.storeImpl.begin = async () => { throw new Error('History is full.'); };
  const failure = await runSavedFileOperation(file, request, quota);
  assert.equal(failure.report.state, 'failed'); assert.equal(quota.abandoned.length, 0);
  const success = deps(); const ready = await runSavedFileOperation(file, request, success);
  assert.equal(ready.output, file); assert.equal(success.saved.length, 1);
});
