// SPDX-License-Identifier: MPL-2.0
/** Project assets use the ordinary folder cards and open on their own project page. */
import { imageTile } from '../folder-tiles.ts';
import { getInstanceBase, instancePath } from '../lib/instance.ts';
import { fmtBytes } from '../lib/format.ts';
import { tRaw } from '../i18n.ts';
import type { TeamFile } from './team-files.ts';

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
  const download = document.createElement('a'); download.href = url; download.download = file.name; download.className = 'btn btn--primary'; download.textContent = tRaw('Download');
  // A browser connected to another origin cannot use the download attribute there.
  if (getInstanceBase()) { download.target = '_blank'; download.rel = 'noopener'; }
  panel.append(back, heading, meta, preview, download); return panel;
}
