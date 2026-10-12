// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import type { HostV1, AssetRef } from '@lolly-tools/core/host-v1';
import { assetComparisonMode, comparisonAssetFile, comparisonAssetPair, comparisonAssetRef, captureComparisonAssets, capturedAssetComparisonPair } from './compare-asset-sources.ts';
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
test('YAML mode uses resolved formats and captured current bytes through explicit Text fallback', async () => {
  let current = 'count: 2\n', reads = 0, resolutions = 0;
  const host = { assets: {
    get: async (id: string, options: { version?: string }) => { resolutions++; return { ...ref, id, format: options.version ? 'yml' : 'yaml', version: options.version ?? 'current-at-capture' }; },
    bytes: async (asset: AssetRef) => { reads++; return new TextEncoder().encode(asset.version === 'old' ? 'count: 1\n' : current); },
  } } as unknown as HostV1;
  const captured = await captureComparisonAssets([{ id: 'source', version: 'old' }, { id: 'source' }], host);
  assert.deepEqual(captured.map(source => source.format), ['yml', 'yaml']);
  assert.deepEqual(captured.map(source => source.identity.revision), ['old', 'current-at-capture']);
  current = 'count: 999\n';
  const semantic = await capturedAssetComparisonPair(captured, host), fallback = await capturedAssetComparisonPair(captured, host, undefined, 'text');
  if (semantic.mode === 'visual' || fallback.mode === 'visual') assert.fail();
  assert.equal(semantic.mode, 'yaml'); assert.deepEqual(semantic.request.options, { mode: 'structure' });
  assert.deepEqual(semantic.request.after.content, { kind: 'yaml', text: 'count: 2\n' });
  assert.equal(fallback.mode, 'text'); assert.deepEqual(fallback.request.after.content, { kind: 'text', text: 'count: 2\n' });
  assert.deepEqual(fallback.request.after.bytes, semantic.request.after.bytes);
  assert.deepEqual(fallback.request.after.identity, semantic.request.after.identity);
  assert.equal(resolutions, 2); assert.equal(reads, 2);
  assert.equal(assetComparisonMode([{ format: 'JSON' }, { format: 'yml' }]), 'yaml');
  assert.equal(assetComparisonMode([{ format: 'yaml' }, { format: 'yaml' }]), 'yaml');
  assert.equal(assetComparisonMode([{ format: 'json' }, { format: 'har' }]), 'json');
  assert.equal(assetComparisonMode([{ format: 'yaml' }, { format: 'txt' }]), 'text');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(capturedAssetComparisonPair(captured, host, controller.signal, 'text'), { name: 'AbortError' });
  assert.equal(reads, 2);
});
