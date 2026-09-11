// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import type { HostV1, AssetRef } from '@lolly-tools/core/host-v1';
import { assetComparisonMode, comparisonAssetFile, comparisonAssetPair, comparisonAssetRef } from './compare-asset-sources.ts';
import { visualComparisonReport } from './compare-visual-report.ts';
import { compareVisualSources } from '../../../../engine/src/compare-visual.ts';
const ref: AssetRef = { id: 'user/upload/private', source: 'user', type: 'text', format: 'txt', version: 'current', url: 'blob:current', meta: { name: 'CONFIDENTIAL' } };
test('catalog comparison freezes pinned identities and never substitutes a head for missing old bytes', async () => {
  assert.equal(comparisonAssetRef({ ...ref, pin: { version: 'old' } }).version, 'old');
  const calls: unknown[] = [];
  const host = { assets: { get: async (_id: string, options: unknown) => { calls.push(options); throw new Error('private error'); } } } as unknown as HostV1;
  await assert.rejects(comparisonAssetFile({ id: ref.id, version: 'old' }, host), /exact asset version is unavailable/);
  assert.deepEqual(calls, [{ format: undefined, version: 'old' }]);
  host.assets.get = async () => ref;
  await assert.rejects(comparisonAssetFile({ id: ref.id, version: 'old' }, host), /did not return the requested version/);
});
test('catalog text pairs use the shared provider without source writes; format gating is explicit', async () => {
  const host = { assets: { get: async () => ref, bytes: async () => new TextEncoder().encode('private value') } } as unknown as HostV1;
  const result = await comparisonAssetPair([comparisonAssetRef(ref), comparisonAssetRef(ref)], host);
  assert.equal(result.mode, 'text'); assert.equal(result.request.before.identity.label, 'CONFIDENTIAL');
  assert.equal(assetComparisonMode([{ format: 'svg' }, { format: 'pdf' }]), 'visual');
  assert.equal(assetComparisonMode([{ format: 'mp4' }, { format: 'png' }]), undefined);
  assert.equal(assetComparisonMode([{ format: 'json' }, { format: 'json' }]), 'json');
});
test('visual reports omit names by default and always omit pixels, masks and source bytes', () => {
  const source = { identity: { id: 'private-id', label: 'CONFIDENTIAL', kind: 'file' as const }, totalPages: 1, bytes: new Uint8Array([77]), pages: [{ page: 1, width: 1, height: 1, unit: 'px' as const, pixelWidth: 1, pixelHeight: 1, rgba: new Uint8ClampedArray([77, 88, 99, 255]) }] };
  const result = compareVisualSources({ version: 1, before: source, after: source });
  assert.doesNotMatch(visualComparisonReport(result), /CONFIDENTIAL|private-id|77|88|99|mask|rgba/);
  assert.match(visualComparisonReport(result, true), /CONFIDENTIAL/);
  assert.doesNotMatch(visualComparisonReport(result, true), /mask|rgba|"bytes"/);
});
