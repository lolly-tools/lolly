// SPDX-License-Identifier: MPL-2.0
/** The same asset page for local folders and shared projects. */
import { tRaw } from '../i18n.ts';

export interface ProjectAssetPageOptions {
  name: string; url: string; contentType: string; backHref: string; metadata?: string;
  download(): Promise<void>;
  downloadError?(error: unknown): string;
}

export function buildProjectAssetPage(opts: ProjectAssetPageOptions): HTMLElement {
  const panel = document.createElement('section'); panel.className = 'team-project-asset project-asset-page';
  const back = document.createElement('a'); back.className = 'btn btn--ghost'; back.href = opts.backHref; back.textContent = tRaw('Back to project');
  const heading = document.createElement('h3'); heading.textContent = opts.name;
  const meta = document.createElement('p'); meta.className = 'team-project-notice'; meta.textContent = opts.metadata ?? '';
  const preview = document.createElement('div'); preview.className = 'team-project-asset-preview';
  if (opts.contentType.startsWith('image/')) {
    const image = document.createElement('img'); image.src = opts.url; image.alt = opts.name; preview.append(image);
  } else if (opts.contentType.startsWith('video/') || opts.contentType.startsWith('audio/')) {
    const media = document.createElement(opts.contentType.startsWith('video/') ? 'video' : 'audio'); media.src = opts.url; media.controls = true; media.preload = 'none'; preview.append(media);
  }
  const download = document.createElement('button'); download.type = 'button'; download.className = 'btn btn--primary'; download.textContent = tRaw('Download');
  const status = document.createElement('p'); status.className = 'team-project-notice'; status.setAttribute('role', 'status');
  download.addEventListener('click', () => { void (async () => {
    download.disabled = true; status.textContent = tRaw('Downloading…');
    try { await opts.download(); if (panel.isConnected) status.textContent = ''; }
    catch (error) { status.textContent = opts.downloadError?.(error) ?? tRaw('Could not download this asset. Try again.'); }
    finally { download.disabled = false; }
  })(); });
  panel.append(back, heading, meta, preview, download, status); return panel;
}
