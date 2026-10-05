// SPDX-License-Identifier: MPL-2.0
/** Resolve a DAM file only after it is needed; keep variation UI off the boot path. */
import type { AssetMetaRecord } from './assets.ts';
import { assetFiles, fileAssetType } from '../lib/asset-files.ts';
import { buildFileAssetId } from '../../../../engine/src/asset-modifiers.ts';
import { instancePath } from '../lib/instance.ts';
/** Choose only a declared format; same-extension attachments keep separate cache keys. */
export function selectedFileMeta(meta: AssetMetaRecord, file: string | null): AssetMetaRecord {
  if (!file) return meta;
  const selected = assetFiles(meta.meta).find(f => f.id === file && f.url.startsWith(`/catalog/${meta.id}/`));
  const format = selected && meta.formats.find(f => (f.url === selected.url || f.url === instancePath(selected.url)) && f.format === selected.format);
  if (!selected || !format) throw new Error('Asset file unavailable');
  return { ...meta, id: buildFileAssetId(meta.id, file), type: fileAssetType(format.format), name: selected.name,
    width: selected.width, height: selected.height, formats: [format], checksum: format.checksum,
    meta: { ...meta.meta, assetGroupId: meta.id, assetGroupName: meta.name, selectedFile: file, size: selected.size, bytes: selected.size,
      ...(selected.thumbnail ? { thumbUrl: selected.thumbnail, posterUrl: selected.thumbnail } : {}) } };
}


export function assetFileMetas(meta: AssetMetaRecord): AssetMetaRecord[] {
  return [meta, ...assetFiles(meta.meta).flatMap(f => { try { return [selectedFileMeta(meta, f.id)]; } catch { return []; } })];
}
