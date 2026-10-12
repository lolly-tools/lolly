// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonFileSource, comparisonTextSource, comparisonRequest } from './compare-sources.ts';
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
test('YAML sources retain raw text and bytes for the shared parser; Text is an explicit alternative', async () => {
  const text = '# CONFIDENTIAL_COMMENT\nname: café\ncount: 2\n';
  const file = new File([text], 'CONFIDENTIAL.yaml');
  const before = await comparisonFileSource(file, 'yaml');
  const after = comparisonTextSource('count: 2\nname: café\n', identity, 'yaml');
  assert.deepEqual(before.content, { kind: 'yaml', text });
  assert.deepEqual(before.bytes, new TextEncoder().encode(text));
  const request = comparisonRequest(before, after, 'yaml');
  assert.deepEqual(request.options, { mode: 'structure' });
  const result = compareSources(request);
  assert.equal(result.equality, 'equivalent-content');
  assert.equal(result.summary.total, 0);
  assert.doesNotMatch(comparisonReport(result), /CONFIDENTIAL|café|name/);
  const fallback = await comparisonFileSource(file, 'text');
  assert.deepEqual(fallback.content, { kind: 'text', text });
  assert.deepEqual(fallback.bytes, before.bytes);
  assert.equal(await file.text(), text);
});
test('refused YAML reaches the engine unchanged and never silently becomes Text', async () => {
  const invalid = 'value: [CONFIDENTIAL_PARSER_FRAGMENT';
  const source = await comparisonFileSource(new File([invalid], 'CONFIDENTIAL.yml'), 'yaml');
  assert.deepEqual(source.content, { kind: 'yaml', text: invalid });
  const result = compareSources(comparisonRequest(source, source, 'yaml'));
  assert.equal(result.equality, 'undetermined');
  assert.equal(result.completeness, 'partial');
  assert.equal(result.summary.total, 0);
  assert.doesNotMatch(result.limitations.join('\n'), /CONFIDENTIAL|PARSER_FRAGMENT|\[/);
  assert.doesNotMatch(comparisonReport(result), /CONFIDENTIAL|PARSER_FRAGMENT/);
  await assert.rejects(comparisonFileSource(new File([new Uint8Array([255])], 'bad.yaml'), 'yaml'), /not UTF-8/);
  await assert.rejects(comparisonFileSource(new File(['\0PRIVATE'], 'bad.yaml'), 'yaml'), error => error instanceof Error && !error.message.includes('PRIVATE'));
});
