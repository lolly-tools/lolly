// SPDX-License-Identifier: MPL-2.0
/** DAM file variations share a group while keeping distinct document identities. */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { buildFileAssetId, parseFileAssetId, stripAssetModifiers } from '../../../../engine/src/asset-modifiers.ts';
import { instancePath } from './instance.ts';
export interface AssetFile { id: string; format: string; url: string; name: string; size?: number; width?: number; height?: number; thumbnail?: string }
const number = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
export function assetFiles(meta: Record<string, unknown> | undefined): AssetFile[] {
  const raw = meta?.assetFiles; if (!Array.isArray(raw)) return [];
  const files: AssetFile[] = [], seen = new Set<string>();
  for (const item of raw.slice(0, 3000)) {
    if (!item || typeof item !== 'object') continue;
    const f = item as Record<string, unknown>;
    if (typeof f.id !== 'string' || !/^[a-f0-9]{24}$/.test(f.id) || seen.has(f.id)
      || typeof f.format !== 'string' || !/^[a-z0-9-]{1,30}$/.test(f.format)
      || typeof f.url !== 'string' || !f.url.startsWith('/catalog/ext/') || f.url.includes('?') || f.url.includes('#')
      || typeof f.name !== 'string' || f.name.length > 1000) continue;
    seen.add(f.id);
    files.push({ id: f.id, format: f.format, url: f.url, name: f.name,
      ...(number(f.size) ? { size: f.size } : {}), ...(number(f.width) ? { width: f.width } : {}), ...(number(f.height) ? { height: f.height } : {}),
      ...(f.thumbnail === `${f.url}?preview=1` ? { thumbnail: f.thumbnail } : {}) });
  }
  return files;
}
export function fileAssetType(format: string): AssetRef['type'] {
  if (['svg', 'eps', 'ai'].includes(format)) return 'vector';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'tif', 'tiff', 'heic', 'heif', 'jxl'].includes(format)) return 'raster';
  if (['mp4', 'webm', 'mov', 'm4v'].includes(format)) return 'video';
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(format)) return 'audio';
  if (['otf', 'ttf', 'woff', 'woff2'].includes(format)) return 'font';
  if (['txt', 'md', 'srt'].includes(format)) return 'text';
  return 'data';
}
export function selectAssetFile(ref: AssetRef, file: AssetFile): AssetRef {
  const group = stripAssetModifiers(ref.id), selected = assetFiles(ref.meta).find(f => f.id === file.id);
  if (!selected?.url.startsWith(`/catalog/${group}/`)) throw new Error('This file is unavailable');
  return { ...ref, id: buildFileAssetId(group, file.id), type: fileAssetType(selected.format), format: selected.format, url: instancePath(selected.url),
    meta: { ...ref.meta, name: selected.name, assetGroupName: ref.meta?.assetGroupName ?? ref.meta?.name, assetGroupId: group, selectedFile: selected.id,
      size: selected.size, bytes: selected.size, width: selected.width, height: selected.height,
      thumbUrl: selected.thumbnail ? instancePath(selected.thumbnail) : ref.meta?.thumbUrl, posterUrl: selected.thumbnail ? instancePath(selected.thumbnail) : ref.meta?.posterUrl } };
}
export function selectedAssetFile(ref: AssetRef): string | null { return parseFileAssetId(ref.id).file; }
