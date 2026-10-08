// SPDX-License-Identifier: MPL-2.0
/** A disposed viewer cannot read or paint a subsequently selected file. */
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { AssetViewerReadError, assetViewerSource, detectedViewerKind, readAssetViewerBytes } from '../lib/asset-viewer-source.ts';
import { beginPreviewActivity } from '../lib/preview-activity.ts';
import { t } from '../i18n.ts';
import './asset-format-viewer.css';
export interface AssetFormatViewerHandle { ready: Promise<void>; destroy(): void }
export function mountAssetFormatViewer(into: HTMLElement, ref: AssetRef, host?: HostV1): AssetFormatViewerHandle {
  const source = assetViewerSource(ref), controller = new AbortController();
  const endActivity = beginPreviewActivity();
  let dispose: (() => void) | undefined;
  const frame = document.createElement('section'); frame.className = 'asset-format-viewer'; frame.setAttribute('aria-label', source.name);
  const status = document.createElement('p'); status.className = 'asset-viewer-status'; status.setAttribute('role', 'status'); status.textContent = t('Loading preview…'); frame.append(status); into.replaceChildren(frame);
  const ready = (async () => {
    try {
      if (source.kind === 'converted') {
        const { mountConvertedAssetViewer } = await import('./converted-asset-viewer.ts'); controller.signal.throwIfAborted();
        dispose = await mountConvertedAssetViewer(frame, source, controller.signal);
        return;
      }
      const bytes = await readAssetViewerBytes(source.originalUrl, controller.signal, source.kind === 'font' ? 32 * 1024 * 1024 : undefined);
      const detected = detectedViewerKind(bytes);
      controller.signal.throwIfAborted();
      if (source.kind === 'pdf' && detected !== 'pdf' || source.kind === 'font' && detected !== 'font') throw new Error('The file content does not match its declared format.');
      if (detected === 'vector' || source.kind === 'vector' && source.format === 'svgz') {
        const { mountVectorAssetViewer } = await import('./vector-asset-viewer.ts'); controller.signal.throwIfAborted();
        dispose = mountVectorAssetViewer(frame, bytes, source, controller.signal);
      } else if (detected === 'pdf') {
        const { mountPdfAssetViewer } = await import('./pdf-asset-viewer.ts'); controller.signal.throwIfAborted();
        dispose = await mountPdfAssetViewer(frame, bytes, controller.signal);
      } else if (detected === 'font') {
        const { mountFontAssetViewer } = await import('./font-asset-viewer.ts'); controller.signal.throwIfAborted();
        dispose = await mountFontAssetViewer(frame, bytes, source, controller.signal, host);
      } else throw new Error('A full preview is unavailable for this file.');
      if (controller.signal.aborted) { dispose?.(); dispose = undefined; }
    } catch (error) {
      if (controller.signal.aborted) return;
      frame.replaceChildren(status); status.setAttribute('role', 'alert');
      status.textContent = t(error instanceof Error ? error.message : 'This file could not be previewed.');
      if (source.thumbnail && !(error instanceof AssetViewerReadError && [401, 403, 410].includes(error.status))) { const image = document.createElement('img'); image.className = 'asset-viewer-fallback'; image.src = source.thumbnail; image.alt = t('Provider preview'); frame.append(image); }
    }
  })();
  return { ready, destroy() { endActivity(); controller.abort(); dispose?.(); dispose = undefined; frame.remove(); } };
}
