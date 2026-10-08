// SPDX-License-Identifier: MPL-2.0
/** Selected files can be inspected before the picker commits them. */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { AssetFormatViewerHandle } from './asset-format-viewer.ts';
import { assetViewerKind } from '../lib/asset-viewer-source.ts';
import { mountAssetFileList } from './asset-file-list.ts';
import { tRaw } from '../i18n.ts';
export function mountAssetFilePicker(card: HTMLElement, ref: AssetRef, o: {
  back(): void; current(): boolean; accepts(ref: AssetRef): boolean;
  resolve(ref: AssetRef): Promise<AssetRef>; picked(ref: AssetRef): Promise<boolean>;
}): { destroy(): void } {
  let viewer: AssetFormatViewerHandle | undefined, selected = ref, revision = 0, disposed = false, busy = false;
  const back = document.createElement('button'); back.type = 'button'; back.className = 'btn btn--ghost btn--sm'; back.textContent = tRaw('Back to assets');
  back.addEventListener('click', o.back);
  const heading = document.createElement('h2'); heading.textContent = String(ref.meta?.assetGroupName ?? ref.meta?.name ?? ref.id);
  const status = document.createElement('p'); status.setAttribute('role', 'status');
  const preview = document.createElement('div'); preview.className = 'asset-file-inspection';
  const use = document.createElement('button'); use.type = 'button'; use.className = 'btn btn--primary'; use.textContent = tRaw('Use this file');
  const choose = async (file: AssetRef) => {
    const version = ++revision; selected = file; viewer?.destroy(); viewer = undefined; preview.replaceChildren(); use.disabled = !o.accepts(file);
    status.textContent = String(file.meta?.name ?? file.id);
    const kind = assetViewerKind(file.format);
    if (kind === 'pdf' || kind === 'font' || kind === 'converted' || kind === 'vector') {
      const module = await import('./asset-format-viewer.ts'); if (disposed || revision !== version || !o.current()) return; viewer = module.mountAssetFormatViewer(preview, file);
    } else if (file.type === 'raster') { const image = document.createElement('img'); image.src = file.url; image.alt = String(file.meta?.name ?? ''); preview.append(image); }
  };
  use.addEventListener('click', () => { void (async () => {
    if (busy || disposed || !o.accepts(selected)) return; busy = true; use.disabled = true; status.textContent = tRaw('Loading selected file…');
    try { const resolved = await o.resolve(selected); if (disposed || !card.isConnected || !o.current()) return; if (await o.picked(resolved)) status.textContent = tRaw('File added.'); }
    catch { if (!disposed && o.current()) status.textContent = tRaw('Could not load this file. Try again or choose another variation.'); }
    finally { busy = false; use.disabled = !o.accepts(selected); }
  })(); });
  card.append(back, heading, status); mountAssetFileList(card, ref, file => { void choose(file); }); card.append(preview, use);
  use.disabled = !o.accepts(ref); back.focus();
  return { destroy() { disposed = true; revision++; viewer?.destroy(); } };
}
