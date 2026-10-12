// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createMockHost } from '../../../../packages/core/src/mock-host.ts';
import { operationComparisonPair, verifyComparisonOriginal } from './compare-operation-sources.ts';
import { compareSources } from '../../../../engine/src/compare.ts';
import { comparisonReport } from './compare-report.ts';
import { comparisonFileSource, comparisonRequest } from './compare-sources.ts';
import { comparisonAssetPair } from './compare-asset-sources.ts';

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
  await assert.rejects(operationComparisonPair(new File(['x'], 'original.doc'), new File(['x'], 'copy.doc'), host), /not supported/);
  await assert.rejects(operationComparisonPair(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.txt'), new File(['x'], 'small.txt'), host), /2 MiB/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(operationComparisonPair(new File(['x'], 'a.txt'), new File(['x'], 'b.txt'), host, controller.signal), { name: 'AbortError' });
});
test('utility, catalog and operation YAML requests share semantic options and immutable JSON/YAML sources', async () => {
  const files = [new File(['{"items":[{"id":"a","value":1}]}'], 'before.json'), new File(['items:\n  - id: a\n    value: 2\n'], 'after.yaml')];
  const host = createMockHost();
  const sources = await Promise.all(files.map(file => comparisonFileSource(file, 'yaml')));
  const utility = comparisonRequest(sources[0]!, sources[1]!, 'yaml'), operation = await operationComparisonPair(files[0]!, files[1]!, host);
  const assetHost = { assets: {
    get: async (id: string) => ({ id, format: Number(id) ? 'yaml' : 'json', version: 'captured' }),
    bytes: async (asset: { id: string }) => new Uint8Array(await files[Number(asset.id)]!.arrayBuffer()),
  } } as unknown as typeof host;
  const asset = await comparisonAssetPair([{ id: '0' }, { id: '1' }], assetHost);
  if (operation.mode === 'visual' || asset.mode === 'visual') assert.fail();
  assert.equal(operation.mode, 'yaml'); assert.equal(asset.mode, 'yaml');
  const requests = [utility, operation.request, asset.request];
  for (const request of requests) {
    assert.deepEqual(request.options, { mode: 'structure' });
    assert.equal(request.before.content.kind, 'yaml'); assert.equal(request.after.content.kind, 'yaml');
  }
  const results = requests.map(request => compareSources({ ...request, options: { ...request.options, arrayAlignment: 'id' } }));
  const comparable = results.map(({ mode, options, summary, changes, completeness, limitations }) => ({ mode, options, summary, changes, completeness, limitations }));
  assert.deepEqual(comparable[0], comparable[1]); assert.deepEqual(comparable[1], comparable[2]);
  assert.equal(results[0]!.summary.changed, 1);
  const text = await operationComparisonPair(files[0]!, files[1]!, host, undefined, 'text');
  if (text.mode === 'visual') assert.fail();
  assert.equal(text.mode, 'text'); assert.equal(text.request.before.content.kind, 'text');
  assert.deepEqual(text.request.before.bytes, utility.before.bytes);
  assert.equal(await files[0]!.text(), '{"items":[{"id":"a","value":1}]}');
  assert.equal(host.inspect.state.size, 0); assert.equal(host.inspect.logs.length, 0);
});
