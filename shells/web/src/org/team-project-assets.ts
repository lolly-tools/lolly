// SPDX-License-Identifier: MPL-2.0
/** Project assets use the ordinary folder cards and open on their own project page. */
import { imageTile } from '../folder-tiles.ts';
import { instancePath } from '../lib/instance.ts';
import { getHostRef } from '../lib/host-ref.ts';
import { anchorSave } from '../bridge/anchor-save.ts';
import { fmtBytes } from '../lib/format.ts';
import { tRaw } from '../i18n.ts';
import { downloadTeamFile, teamFileMessage, type TeamFile } from './team-files.ts';

export function projectFileUrl(projectId: string, fileId: string): string {
  return instancePath(`/api/v1/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}`);
}

export function projectAssetHref(projectId: string, fileId: string): string {
  return `#/p?team=${encodeURIComponent(projectId)}&asset=${encodeURIComponent(fileId)}`;
}

export function teamAssetTiles(projectId: string, files: readonly TeamFile[]): string {
  return files.map(file => imageTile({ id: file.id,
    ...(file.contentType.startsWith('image/') ? { url: projectFileUrl(projectId, file.id) } : {}),
    format: typeof file.asset.format === 'string' ? file.asset.format : file.name.split('.').at(-1),
    meta: { name: file.name } }, {
    sub: `${tRaw('Shared asset')} · ${fmtBytes(file.size)}`,
    shared: { href: projectAssetHref(projectId, file.id), openLabel: tRaw('Open shared asset {name}', { name: file.name }) },
  })).join('');
}

export function buildProjectAsset(projectId: string, file: TeamFile): HTMLElement {
  const panel = document.createElement('section'); panel.className = 'team-project-asset';
  const back = document.createElement('a'); back.className = 'btn btn--ghost'; back.href = `#/p?team=${encodeURIComponent(projectId)}`; back.textContent = tRaw('Back to project');
  const heading = document.createElement('h3'); heading.textContent = file.name;
  const meta = document.createElement('p'); meta.className = 'team-project-notice'; meta.textContent = [fmtBytes(file.size), file.createdByName].filter(Boolean).join(' · ');
  const url = projectFileUrl(projectId, file.id), preview = document.createElement('div'); preview.className = 'team-project-asset-preview';
  if (file.contentType.startsWith('image/')) {
    const image = document.createElement('img'); image.src = url; image.alt = file.name; preview.append(image);
  } else if (file.contentType.startsWith('video/') || file.contentType.startsWith('audio/')) {
    const media = document.createElement(file.contentType.startsWith('video/') ? 'video' : 'audio'); media.src = url; media.controls = true; media.preload = 'none'; preview.append(media);
  }
  const download = document.createElement('button'); download.type = 'button'; download.className = 'btn btn--primary'; download.textContent = tRaw('Download');
  const status = document.createElement('p'); status.className = 'team-project-notice'; status.setAttribute('role', 'status');
  download.addEventListener('click', () => { void (async () => {
    download.disabled = true; status.textContent = tRaw('Downloading…');
    try {
      const blob = await downloadTeamFile(projectId, file);
      if (!panel.isConnected) return;
      const host = getHostRef();
      if (host?.export.download) await host.export.download(blob, file.name);
      else anchorSave(blob, file.name);
      status.textContent = '';
    } catch (error) { status.textContent = teamFileMessage(error, 'read'); }
    finally { download.disabled = false; }
  })(); });
  panel.append(back, heading, meta, preview, download, status); return panel;
}
