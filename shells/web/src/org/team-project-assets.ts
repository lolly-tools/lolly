// SPDX-License-Identifier: MPL-2.0
/** Project assets use the ordinary folder cards and open on their own project page. */
import { imageTile } from '../folder-tiles.ts';
import { instancePath } from '../lib/instance.ts';
import { getHostRef } from '../lib/host-ref.ts';
import { anchorSave } from '../bridge/anchor-save.ts';
import { buildProjectAssetPage } from '../components/project-asset-page.ts';
import type { ProjectAssetPage, ProjectAssetPageOptions } from '../components/project-asset-page.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { defaultSanitizeSvg, safeMeta, sniffBeamAsset } from '../lib/beam-pack.ts';
import { fmtBytes } from '../lib/format.ts';
import { tRaw } from '../i18n.ts';
import { downloadTeamFile, teamFileMessage, type TeamFile } from './team-files.ts';

export function projectFileUrl(projectId: string, fileId: string): string {
  return instancePath(`/api/v1/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`);
}

export function projectAssetHref(projectId: string, fileId: string): string {
  return `#/p?team=${encodeURIComponent(projectId)}&asset=${encodeURIComponent(fileId)}`;
}

export function teamAssetTiles(projectId: string, files: readonly TeamFile[], folderId?: string | null): string {
  return files.map(file => imageTile({ id: file.id,
    ...(file.contentType.startsWith('image/') ? { url: projectFileUrl(projectId, file.id) } : {}),
    format: typeof file.asset.format === 'string' ? file.asset.format : file.name.split('.').at(-1),
    meta: { name: file.name } }, {
    sub: `${tRaw('Shared asset')} · ${fmtBytes(file.size)}`,
    shared: { href: projectAssetHref(projectId, file.id) + (folderId ? `&folder=${encodeURIComponent(folderId)}` : ''), openLabel: tRaw('Open shared asset {name}', { name: file.name }) },
  })).join('');
}

export function buildProjectAsset(projectId: string, file: TeamFile, folderId?: string | null, preview?: ProjectAssetPageOptions['preview']): ProjectAssetPage {
  return buildProjectAssetPage({ name: file.name, url: projectFileUrl(projectId, file.id), contentType: file.contentType,
    backHref: `#/p?team=${encodeURIComponent(projectId)}${folderId ? `&folder=${encodeURIComponent(folderId)}` : ''}`, metadata: [fmtBytes(file.size), file.createdByName].filter(Boolean).join(' · '),
    downloadError: error => teamFileMessage(error, 'read'),
    preview,
    async download() {
      const blob = await downloadTeamFile(projectId, file);
      const host = getHostRef();
      if (host?.export.download) await host.export.download(blob, file.name);
      else anchorSave(blob, file.name);
    },
  });
}

export async function prepareProjectAsset(projectId: string, file: TeamFile): Promise<{ ref: AssetRef; dispose(): void }> {
  const blob = await downloadTeamFile(projectId, file);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const kind = sniffBeamAsset(bytes, file.asset);
  const meta = safeMeta(file.asset.meta) ?? {};
  const tags = Array.isArray(meta.tags) ? meta.tags.filter((tag): tag is string => typeof tag === 'string') : [];
  const safe = kind.markup ? await defaultSanitizeSvg(bytes) : bytes;
  const url = URL.createObjectURL(new Blob([safe as BlobPart], { type: kind.mime }));
  const originalUrl = kind.markup ? URL.createObjectURL(blob) : url;
  const dimension = (key: 'width' | 'height') => {
    const value = file.asset[key];
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
  };
  return { ref: { source: 'remote', id: file.id, type: kind.type as AssetRef['type'], format: kind.format, url,
    ...(kind.markup ? { original: { url: originalUrl, format: kind.format } } : {}),
    width: dimension('width'), height: dimension('height'), version: file.checksum, checksum: file.checksum,
    meta: { ...meta, name: file.name, tags, bytes: file.size },
  }, dispose() { URL.revokeObjectURL(url); if (originalUrl !== url) URL.revokeObjectURL(originalUrl); } };
}
