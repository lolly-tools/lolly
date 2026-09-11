// SPDX-License-Identifier: MPL-2.0
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { comparisonFileSource } from './compare-sources.ts';
import { comparisonVisualSource, VISUAL_FORMATS } from './compare-visual-sources.ts';
export interface ComparisonAsset { id: string; format?: string; version?: string; label?: string }
const TEXT_FORMATS = new Set(['txt', 'md', 'markdown', 'csv', 'tsv', 'json', 'har', 'yaml', 'yml', 'xml', 'html', 'css', 'js', 'ts', 'log', 'ini', 'toml']);
export function assetComparisonMode(refs: readonly Pick<AssetRef, 'format'>[]): 'visual' | 'json' | 'text' | undefined {
  if (refs.length !== 2) return undefined;
  const formats = refs.map(r => r.format.toLowerCase());
  if (formats.every(f => VISUAL_FORMATS.has(f))) return 'visual';
  if (formats.every(f => f === 'json' || f === 'har')) return 'json';
  if (formats.every(f => TEXT_FORMATS.has(f))) return 'text';
  return undefined;
}
/** A selected/pinned version is explicit. Failure never retries against the head. */
export function comparisonAssetRef(ref: AssetRef): ComparisonAsset {
  return { id: ref.id, format: ref.pin?.format ?? ref.format, version: ref.pin?.version ?? ref.version, label: String(ref.meta?.name || ref.id) };
}
export async function comparisonAssetFile(source: ComparisonAsset, host: HostV1, signal?: AbortSignal): Promise<{ file: File; identity: { id: string; kind: 'asset'; label: string; revision?: string }; format: string }> {
  signal?.throwIfAborted();
  let ref: AssetRef;
  try { ref = await host.assets.get(source.id, { format: source.format, version: source.version }); }
  catch { throw new Error(source.version ? 'This exact asset version is unavailable on this device. No current copy was substituted.' : 'The current asset is unavailable on this device.'); }
  signal?.throwIfAborted();
  if (source.version && ref.version !== source.version) throw new Error('The asset provider did not return the requested version.');
  if (!host.assets.bytes) throw new Error('Asset byte access is unavailable in this host.');
  let bytes: Uint8Array;
  try { bytes = await host.assets.bytes(ref); } catch { throw new Error('These asset bytes are unavailable on this device.'); }
  signal?.throwIfAborted();
  if (bytes.length > 32 * 1024 * 1024) throw new Error('Choose assets up to 32 MiB per side.');
  const label = source.label ?? String(ref.meta?.name || ref.id), format = ref.format.toLowerCase();
  return { file: new File([bytes as BlobPart], `source.${format}`), identity: { id: ref.id, kind: 'asset', label, revision: ref.version }, format };
}
export async function comparisonAssetPair(sources: readonly ComparisonAsset[], host: HostV1, signal?: AbortSignal) {
  if (sources.length !== 2) throw new Error('Select two compatible assets.');
  const files = await Promise.all(sources.map(source => comparisonAssetFile(source, host, signal)));
  const mode = assetComparisonMode(files);
  if (!mode) throw new Error('Choose two images/PDFs or two text/JSON assets.');
  if (mode === 'visual') {
    const pair = await Promise.all(files.map(({ file, identity }) => comparisonVisualSource(file, host, signal, identity)));
    return { mode, request: { version: 1 as const, before: pair[0]!, after: pair[1]! } };
  }
  const pair = await Promise.all(files.map(async ({ file, identity }) => ({ ...await comparisonFileSource(file, mode, signal), identity })));
  return { mode, request: { version: 1 as const, before: pair[0]!, after: pair[1]! } };
}
