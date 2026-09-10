// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonFileSource, comparisonTextSource } from './compare-sources.ts';
import { comparisonReport } from './compare-report.ts';
import { compareSources } from '../../../../engine/src/compare.ts';
const identity = { id: 'secret-id', kind: 'text' as const, label: 'CONFIDENTIAL_NAME' };
test('file adapters retain exact bytes and parse JSON as data, never parser snippets', async () => {
  const file = new File(['{"__proto__":{"x":1},"a":2}'], 'private.json');
  const source = await comparisonFileSource(file, 'json');
  assert.equal(source.content.kind, 'structure'); assert.equal(source.bytes?.length, file.size);
  assert.throws(() => comparisonTextSource('{SECRET_BROKEN', identity, 'json'), error => error instanceof Error && !error.message.includes('SECRET'));
  await assert.rejects(comparisonFileSource(new File([new Uint8Array([255])], 'binary'), 'text'), /not UTF-8/);
  await assert.rejects(comparisonFileSource(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large'), 'text'), /2 MiB/);
});
test('summary reports omit source names, paths and removed values; content export is explicit', () => {
  const before = comparisonTextSource('{"CONFIDENTIAL_FIELD":"CONFIDENTIAL_BEFORE"}', identity, 'json');
  const after = comparisonTextSource('{"CONFIDENTIAL_FIELD":"CONFIDENTIAL_AFTER"}', identity, 'json');
  const result = compareSources({ version: 1, before, after });
  assert.doesNotMatch(comparisonReport(result), /CONFIDENTIAL|secret-id/);
  assert.match(comparisonReport(result, true), /CONFIDENTIAL_BEFORE/);
});
