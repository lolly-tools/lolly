// SPDX-License-Identifier: MPL-2.0
/** Open the Assets inspector over another view, with the caller owning its lifetime. */
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import type { AssetPreviewOptions } from './assets/context.ts';
import type { AssetPreviewHandle } from '../components/project-asset-page.ts';

export interface PreparedAssetPreview {
  ref: AssetRef;
  dispose?(): void;
}

export function mountAssetPreview(host: HostV1, load: () => Promise<PreparedAssetPreview>, options: Omit<AssetPreviewOptions, 'ref'> = {}): AssetPreviewHandle {
  const mount = document.createElement('div') as HTMLElement & { _cleanup?: () => void };
  let disposed = false;
  let prepared: PreparedAssetPreview | undefined;
  const ready = (async () => {
    const { mountCatalog } = await import('./assets.ts');
    if (disposed) return;
    const asset = await load();
    if (disposed) { asset.dispose?.(); return; }
    prepared = asset;
    await mountCatalog(mount, host, '', { ...options, ref: asset.ref });
  })();
  return { ready, destroy() {
    if (disposed) return;
    disposed = true;
    mount._cleanup?.();
    prepared?.dispose?.();
  } };
}
