// SPDX-License-Identifier: MPL-2.0
import { Gunzip } from 'fflate';
import type { AssetViewerSource } from '../lib/asset-viewer-source.ts';
import { viewerButton } from './asset-viewer-controls.ts';
import { t } from '../i18n.ts';
export function mountVectorAssetViewer(root: HTMLElement, bytes: Uint8Array, source: AssetViewerSource, signal: AbortSignal): () => void {
  if (source.format === 'svgz') {
    const footer = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); if (bytes.length < 18 || footer.getUint32(bytes.length - 4, true) > 16 * 1024 * 1024) throw new Error('The compressed vector is too large for an inline preview.'); const chunks: Uint8Array[] = []; let size = 0; const reader = new Gunzip(chunk => { size += chunk.length; if (size > 16 * 1024 * 1024) throw new Error('The expanded vector is too large.'); chunks.push(chunk); }); reader.push(bytes, true); bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  }
  signal.throwIfAborted(); root.replaceChildren();
  const toolbar = document.createElement('div'); toolbar.className = 'asset-viewer-toolbar'; const stage = document.createElement('div'); stage.className = 'asset-vector-stage';
  const image = document.createElement('img'); image.alt = source.name; image.draggable = false;
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/svg+xml' })); image.src = url; stage.append(image); let zoom = 1;
  const repaint = () => { image.style.width = `${zoom * 100}%`; image.style.maxWidth = 'none'; };
  viewerButton('Fit', () => { zoom = 1; repaint(); }, toolbar); viewerButton('Zoom in', () => { zoom = Math.min(8, zoom * 1.25); repaint(); }, toolbar); viewerButton('Zoom out', () => { zoom = Math.max(0.25, zoom / 1.25); repaint(); }, toolbar);
  image.addEventListener('error', () => { const p = document.createElement('p'); p.className = 'asset-viewer-status'; p.textContent = t('This vector could not be displayed. Download the original or try Convert.'); stage.replaceChildren(p); }, { signal });
  root.append(toolbar, stage); const dispose = () => { image.removeAttribute('src'); URL.revokeObjectURL(url); }; signal.addEventListener('abort', dispose, { once: true });
  return () => { signal.removeEventListener('abort', dispose); dispose(); };
}
