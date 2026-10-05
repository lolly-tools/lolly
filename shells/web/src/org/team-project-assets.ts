// SPDX-License-Identifier: MPL-2.0
/** Project assets use the ordinary folder cards and open on their own project page. */
import { imageTile } from '../folder-tiles.ts';
import { instancePath } from '../lib/instance.ts';
import { getHostRef } from '../lib/host-ref.ts';
import { anchorSave } from '../bridge/anchor-save.ts';
import { buildProjectAssetPage } from '../components/project-asset-page.ts';
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

export function buildProjectAsset(projectId: string, file: TeamFile, folderId?: string | null): HTMLElement {
  return buildProjectAssetPage({ name: file.name, url: projectFileUrl(projectId, file.id), contentType: file.contentType,
    backHref: `#/p?team=${encodeURIComponent(projectId)}${folderId ? `&folder=${encodeURIComponent(folderId)}` : ''}`, metadata: [fmtBytes(file.size), file.createdByName].filter(Boolean).join(' · '),
    downloadError: error => teamFileMessage(error, 'read'),
    async download() {
      const blob = await downloadTeamFile(projectId, file);
      const host = getHostRef();
      if (host?.export.download) await host.export.download(blob, file.name);
      else anchorSave(blob, file.name);
    },
  });
}
