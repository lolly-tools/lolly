// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileOperationRequestSchemaV1, fileOperationReportSchemaV1 } from '../src/file-operation-v1.ts';
import { executeFileOperationV1, assertFileOperationReport, assertFileOperationRequest, fileBatchReportV1 } from '../src/file-operation-v1.ts';
const request = { version: 1 as const, operation: 'convert', target: 'png', options: {} };
test('published JSON schemas match the validators used at execution boundaries', async () => {
  for (const [kind, schema] of Object.entries({ request: fileOperationRequestSchemaV1, report: fileOperationReportSchemaV1 })) {
    assert.deepEqual(JSON.parse(await readFile(new URL(`../schema/file-operation-${kind}-v1.schema.json`, import.meta.url), 'utf8')), schema);
    assert.deepEqual(JSON.parse(await readFile(new URL(`../../../schemas/file-operation-${kind}-v1.schema.json`, import.meta.url), 'utf8')), schema);
  }
});
const adapter = { describe: async (n: number) => ({ name: 'file.png', format: 'png', mime: 'image/png', size: n }), execute: async () => 20, effects: () => ({ metadata: 'removed' as const, findings: [] }) };
test('one executor produces validated success, failure and cancellation receipts', async () => {
  const success = await executeFileOperationV1(10, request, adapter); assert.equal(success.output, 20); assertFileOperationReport(success.report);
  const failure = await executeFileOperationV1(10, request, { ...adapter, execute: async () => { throw new Error('codec unavailable'); } });
  assert.equal(failure.report.state, 'failed'); assert.equal(failure.output, undefined);
  const controller = new AbortController(); controller.abort();
  const cancelled = await executeFileOperationV1(10, request, adapter, { signal: controller.signal });
  assert.equal(cancelled.report.state, 'cancelled');
  assert.deepEqual(fileBatchReportV1([success.report, failure.report, cancelled.report]).counts, { succeeded: 1, failed: 1, cancelled: 1 });
});
test('untrusted requests and misleading reports fail validation', () => {
  assert.throws(() => assertFileOperationRequest({ ...request, version: 2 }));
  assert.throws(() => assertFileOperationRequest({ ...request, options: { quality: Infinity } }));
  assert.throws(() => assertFileOperationRequest({ ...request, options: JSON.parse('{"__proto__":true}') }));
  assert.throws(() => assertFileOperationReport({ version: 1, state: 'succeeded' }));
});
