// SPDX-License-Identifier: MPL-2.0
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import type { AssetFormatViewerHandle } from './asset-format-viewer.ts';
import { mountAssetFileList } from './asset-file-list.ts';
import { instanceFetch } from '../lib/instance.ts';
import { assetViewerKind } from '../lib/asset-viewer-source.ts';
/** The same asset page for local folders and shared projects. */
import { tRaw } from '../i18n.ts';

export interface AssetPreviewHandle { ready: Promise<void>; destroy(): void; }

export interface ProjectAssetPage extends HTMLElement { dispose(): void; }

export interface ProjectAssetPageOptions {
  asset?: AssetRef; host?: HostV1;
  name: string; url: string; contentType: string; backHref: string; metadata?: string;
  download(): Promise<void>;
  downloadError?(error: unknown): string;
  preview?: { open(onClose: (ref: AssetRef) => void): AssetPreviewHandle; link(ref: AssetRef): string };
}

export function buildProjectAssetPage(opts: ProjectAssetPageOptions): ProjectAssetPage {
  let selectedAsset = opts.asset;
  const panel = document.createElement('section') as ProjectAssetPage; panel.className = 'team-project-asset project-asset-page';
  const back = document.createElement('a'); back.className = 'btn btn--ghost'; back.href = opts.backHref; back.textContent = tRaw('Back to project');
  const heading = document.createElement('h3'); heading.textContent = opts.name;
  const meta = document.createElement('p'); meta.className = 'team-project-notice'; meta.textContent = opts.metadata ?? '';
  const preview = document.createElement('div'); preview.className = 'team-project-asset-preview';
  if (!opts.preview && opts.contentType.startsWith('image/')) {
    const image = document.createElement('img'); image.src = opts.url; image.alt = opts.name; preview.append(image);
  } else if (!opts.preview && (opts.contentType.startsWith('video/') || opts.contentType.startsWith('audio/'))) {
    const media = document.createElement(opts.contentType.startsWith('video/') ? 'video' : 'audio'); media.src = opts.url; media.controls = true; media.preload = 'none'; preview.append(media);
  }
  const download = document.createElement('button'); download.type = 'button'; download.className = 'btn btn--primary'; download.textContent = tRaw('Download');
  const status = document.createElement('p'); status.className = 'team-project-notice'; status.setAttribute('role', 'status');
  download.addEventListener('click', () => { void (async () => {
    download.disabled = true; status.textContent = tRaw('Downloading…');
    try {
      if (opts.host && selectedAsset && selectedAsset.url !== opts.asset?.url) { const response = await instanceFetch(selectedAsset.url); if (!response.ok) throw new Error('Asset file is unavailable'); await opts.host.export.download(await response.blob(), String(selectedAsset.meta?.name ?? opts.name)); }
      else await opts.download();
      if (panel.isConnected) status.textContent = ''; }
    catch (error) { status.textContent = opts.downloadError?.(error) ?? tRaw('Could not download this asset. Try again.'); }
    finally { download.disabled = false; }
  })(); });
  let previewHandle: AssetPreviewHandle | undefined;
  let disposed = false;
  let handle: AssetFormatViewerHandle | undefined, revision = 0;
  let observer: MutationObserver | undefined;
  panel.dispose = () => { if (disposed) return; disposed = true; revision++; previewHandle?.destroy(); handle?.destroy(); observer?.disconnect(); };
  if (opts.preview) {
    preview.dataset.assetPreview = '';
    const open = document.createElement('button'); open.type = 'button'; open.className = 'btn'; open.textContent = tRaw('Preview');
    const show = () => {
      if (disposed || !panel.isConnected || previewHandle) return;
      status.textContent = '';
      open.disabled = true;
      previewHandle = opts.preview!.open(ref => {
        if (!disposed && panel.isConnected && window.location.hash === opts.preview!.link(ref)) window.location.hash = opts.backHref;
      });
      void previewHandle.ready.catch(error => {
        previewHandle?.destroy(); previewHandle = undefined;
        if (!disposed && panel.isConnected) status.textContent = opts.downloadError?.(error) ?? tRaw('Could not open the preview. Try again.');
      }).finally(() => { open.disabled = false; });
    };
    open.addEventListener('click', show);
    preview.append(open);
    queueMicrotask(show);
  }
  if (!opts.preview) {
    const format = opts.asset?.format ?? opts.name.split('.').pop()?.toLowerCase() ?? '';
    const kind = opts.asset?.type === 'font' ? 'font' : opts.contentType === 'application/pdf' ? 'pdf' : opts.contentType.startsWith('font/') ? 'font' : assetViewerKind(format);
    const open = async (ref: AssetRef) => {
      const version = ++revision; selectedAsset = ref; heading.textContent = String(ref.meta?.name ?? opts.name); meta.textContent = ref.format; handle?.destroy(); handle = undefined;
      if (ref.type === 'raster') { const image = document.createElement('img'); image.src = ref.url; image.alt = heading.textContent; preview.replaceChildren(image); return; }
      const module = await import('./asset-format-viewer.ts'); if (disposed || version !== revision || !panel.isConnected) return;
      handle = module.mountAssetFormatViewer(preview, ref, opts.host);
    };
    if (kind === 'pdf' || kind === 'font' || kind === 'converted' || (opts.asset?.meta?.assetFiles as unknown[] | undefined)?.length) {
      const ref = opts.asset ?? { id: opts.url, source: 'user' as const, type: kind === 'font' ? 'font' as const : 'data' as const, format: kind === 'pdf' ? 'pdf' : format, url: opts.url, meta: { name: opts.name } };
      let mounted = false;
      observer = new MutationObserver(() => {
        if (panel.isConnected && !mounted) { mounted = true; if (kind === 'pdf' || kind === 'font' || kind === 'converted') void open(ref); }
        else if (mounted && !panel.isConnected) panel.dispose();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      if (opts.asset) mountAssetFileList(panel, ref, selected => { void open(selected); });
    }
  }
  panel.append(back, heading, meta, preview, download, status); return panel;
}
