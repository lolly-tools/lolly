// SPDX-License-Identifier: MPL-2.0
/** Converted previews retain the selected original and require an available instance. */
import type { AssetViewerSource } from '../lib/asset-viewer-source.ts';
import { readAssetViewerBytes, readAssetViewerResponse } from '../lib/asset-viewer-source.ts';
import { instanceFetch } from '../lib/instance.ts';
import { viewerButton } from './asset-viewer-controls.ts';
import { t } from '../i18n.ts';
export async function mountConvertedAssetViewer(root: HTMLElement, source: AssetViewerSource, signal: AbortSignal): Promise<() => void> {
  root.replaceChildren(); const status = document.createElement('p'); status.className = 'asset-viewer-status'; status.setAttribute('role', 'status');
  status.textContent = t('Create a converted preview on your connected Lolly instance. The original stays unchanged.'); root.append(status);
  let childDispose: (() => void) | undefined;
  const preview = async () => {
    button.disabled = true; status.textContent = t('Creating preview…');
    try {
      let result: Uint8Array;
      if (/\/catalog\/ext\//.test(source.originalUrl)) {
        const url = new URL(source.originalUrl, location.href); url.searchParams.set('view', '1'); result = await readAssetViewerBytes(url.href, signal);
      } else {
        const bytes = await readAssetViewerBytes(source.originalUrl, signal, 16 * 1024 * 1024);
        const response = await instanceFetch('/api/v1/catalog/file-preview', { method: 'POST', body: new Blob([bytes as Uint8Array<ArrayBuffer>]), signal,
          headers: { 'content-type': 'application/octet-stream', 'x-lolly-preview-format': source.format } });
        if (!response.ok) throw new Error('This instance cannot create a preview for this format.');
        result = await readAssetViewerResponse(response, signal, 32 * 1024 * 1024);
      }
      signal.throwIfAborted(); const { mountPdfAssetViewer } = await import('./pdf-asset-viewer.ts'); signal.throwIfAborted();
      childDispose = await mountPdfAssetViewer(root, result, signal);
      const note = document.createElement('p'); note.className = 'asset-viewer-status'; note.textContent = t('Converted preview. Fonts and effects may differ from the original.'); root.prepend(note);
    } catch (error) { if (!signal.aborted) { status.textContent = t(error instanceof Error ? error.message : 'This preview could not be created.'); button.disabled = false; } }
  };
  const button = viewerButton('Create converted preview', () => { void preview(); }, root);
  return () => { childDispose?.(); };
}
