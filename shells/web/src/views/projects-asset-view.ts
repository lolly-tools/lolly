// SPDX-License-Identifier: MPL-2.0
/** Local folder assets use the same page and save action as shared assets. */
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { buildProjectAssetPage } from '../components/project-asset-page.ts';
import { tRaw } from '../i18n.ts';
import type { Folder } from '../folders.ts';

export function localProjectAssetHref(folderId: string | null, assetId: string): string {
  return `#/p${folderId ? '/' + encodeURIComponent(folderId) : ''}?asset=${encodeURIComponent(assetId)}`;
}

export function mountLocalProjectAsset(view: HTMLElement, host: HostV1, folderId: string | null, assetId: string, folders: readonly Folder[], assets: ReadonlyMap<string, AssetRef>): void {
  const slot = view.querySelector<HTMLElement>('.projects-grid');
  if (!slot) return;
  slot.className = 'projects-asset-view';
  const asset = assets.get(assetId), belongs = folders.find(folder => folder.id === folderId)?.items.some(item => item.type === 'image' && item.ref === assetId);
  if (asset && belongs) slot.replaceChildren(buildLocalProjectAsset(host, folderId, asset));
  else {
    const notice = document.createElement('p'); notice.textContent = tRaw('This asset is unavailable. Return to the project or refresh to check your access.');
    const back = document.createElement('a'); back.href = `#/p${folderId ? '/' + encodeURIComponent(folderId) : ''}`; back.textContent = tRaw('Back to project');
    slot.replaceChildren(notice, back);
  }
}

export function buildLocalProjectAsset(host: HostV1, folderId: string | null, asset: AssetRef): HTMLElement {
  const contentType = asset.type === 'vector' ? 'image/svg+xml' : asset.type === 'raster' ? 'image/' + asset.format
    : asset.type === 'video' ? 'video/' + asset.format : asset.type === 'audio' ? 'audio/' + asset.format : 'application/octet-stream';
  const name = String(asset.meta?.name || tRaw('Asset'));
  return buildProjectAssetPage({ asset, host, name, url: asset.url, contentType, backHref: `#/p${folderId ? '/' + encodeURIComponent(folderId) : ''}`,
    metadata: asset.format,
    async download() {
      const response = await fetch(asset.url);
      if (!response.ok) throw Error('Asset file is unavailable');
      await host.export.download(await response.blob(), name);
    },
  });
}
