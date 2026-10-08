// SPDX-License-Identifier: MPL-2.0
import type { AssetRef } from '@lolly-tools/core/host-v1';

/** A detail inspector owns the live studio and releases it as soon as it closes. */
export function mountModelPreview(container: HTMLElement, ref: AssetRef): () => void {
  const controller = new AbortController();
  const fallback = Array.from(container.childNodes);
  let teardown: (() => void) | undefined;
  void (async () => {
    const studio = await import('./studio3d/mount.ts');
    if (controller.signal.aborted) return;
    const marker = document.createElement('div');
    marker.style.cssText = 'position:relative;width:100%;height:360px;';
    marker.dataset.lollyStudio = JSON.stringify({
      version: 1,
      values: {
        source: 'model',
        modelFormat: ref.format || 'auto',
        modelAsset: { ...ref, name: String(ref.meta?.name || ref.id) },
        materialMode: 'source',
        motion: 'still',
      },
    });
    const status = document.createElement('p');
    status.dataset.studioStatus = '';
    status.textContent = 'Loading 3D preview…';
    status.style.cssText =
      'position:absolute;inset:0;display:grid;place-content:center;z-index:1;pointer-events:none;';
    marker.append(status);
    container.replaceChildren(marker);
    teardown = () => studio.destroyToolStudio(container);
    await studio.mountToolStudio(container, {
      read: async (url, signal) => {
        const response = await fetch(url, { signal: AbortSignal.any([signal, controller.signal]) });
        if (!response.ok) throw new Error('The model could not be loaded.');
        return new Uint8Array(await response.arrayBuffer());
      },
    });
    if (marker.dataset.studioState === 'error')
      throw studio.studioCaptureError(container) || new Error('Interactive preview unavailable.');
  })().catch((error) => {
    teardown?.();
    if (controller.signal.aborted) return;
    container.replaceChildren(...fallback);
    const note = document.createElement('p');
    note.textContent = error instanceof Error ? error.message : 'Interactive preview unavailable.';
    container.append(note);
  });
  return () => {
    controller.abort();
    teardown?.();
  };
}
