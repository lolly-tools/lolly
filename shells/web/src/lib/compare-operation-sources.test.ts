// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createMockHost } from '../../../../packages/core/src/mock-host.ts';
import { operationComparisonPair, verifyComparisonOriginal } from './compare-operation-sources.ts';
import { compareSources } from '../../../../engine/src/compare.ts';
import { comparisonReport } from './compare-report.ts';

test('operation review compares exact snapshots and summary reports omit removed content', async () => {
  const host = createMockHost(), before = new File(['{"secret":"CONFIDENTIAL_REMOVED"}'], 'private.json'), after = new File(['{"secret":"removed"}'], 'copy.json');
  const pair = await operationComparisonPair(before, after, host);
  if (pair.mode === 'visual') assert.fail('Expected JSON');
  assert.equal(pair.mode, 'json');
  const result = compareSources(pair.request);
  assert.equal(result.equality, 'different'); assert.equal(result.summary.total, 1);
  assert.equal(await before.text(), '{"secret":"CONFIDENTIAL_REMOVED"}');
  assert.doesNotMatch(comparisonReport(result), /CONFIDENTIAL|private.json/);
  assert.match(comparisonReport(result, true), /CONFIDENTIAL_REMOVED/);
  assert.equal(host.inspect.state.size, 0); assert.equal(host.inspect.logs.length, 0);
});

test('history requires the recorded original and refuses a same-size substitution or absent hash', async () => {
  const original = new File(['before'], 'renamed.txt');
  const expected = { name: 'original.txt', mime: 'text/plain', format: 'txt', size: 6, sha256: createHash('sha256').update('before').digest('hex') };
  await verifyComparisonOriginal(original, expected);
  await assert.rejects(verifyComparisonOriginal(new File(['SECRET'], 'original.txt'), expected), /does not match/);
  await assert.rejects(verifyComparisonOriginal(original, { ...expected, sha256: undefined }), /not recorded/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(verifyComparisonOriginal(original, expected, controller.signal), { name: 'AbortError' });
});

test('operation comparison refuses unsupported or oversized pairs without claiming equality', async () => {
  const host = createMockHost();
  await assert.rejects(operationComparisonPair(new File(['x'], 'original.docx'), new File(['x'], 'copy.docx'), host), /not supported/);
  await assert.rejects(operationComparisonPair(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.txt'), new File(['x'], 'small.txt'), host), /2 MiB/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(operationComparisonPair(new File(['x'], 'a.txt'), new File(['x'], 'b.txt'), host, controller.signal), { name: 'AbortError' });
});
