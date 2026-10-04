// SPDX-License-Identifier: MPL-2.0
import { t } from '../../i18n.ts';
import type { ToolViewCtx } from './context.ts';
import type { ProductionOptions } from '../present-production.ts';
import type { PresentController } from '../present-mode.ts';

export function presenceAddress(canvas: HTMLElement | null, write: (address: string) => void) {
  return (frameId: string, _index: number, build: number): void => {
    write(build > 0 ? `${frameId}.${build}` : frameId);
    canvas?.dispatchEvent(new CustomEvent('collab-present-view', { detail: frameId }));
  };
}
export function presenceClose(canvas: HTMLElement | null, close: () => void): () => void {
  return () => { canvas?.dispatchEvent(new CustomEvent('collab-present-view')); close(); };
}

function productionOptions(tview: ToolViewCtx, controlsWindow: Window): ProductionOptions {
  return {
    scene: tview.presentationScene, controlsWindow,
    resolveLogo: asset => tview.host.assets.get(asset.id, { version: asset.version, format: asset.format }),
    uploadLogo: async file => {
      const { storeUserUpload } = await import('../picker.ts');
      // The mounted shell has the picker's asset methods; WebToolHost omits that UI surface.
      return storeUserUpload(tview.host as typeof tview.host & import('../picker.ts').PickerHost, file, { batch: true });
    },
    saveScene: scene => {
      tview.presentationScene = scene; tview.session.markUserDirty('__presentation'); tview.revisionChanged();
    },
    saveRecording: async (blob, microphone) => {
      const { stampCaptureClip, captureContainer } = await import('../../bridge/export.ts');
      const format = captureContainer(blob.type);
      const clip = format ? (await stampCaptureClip(tview.host, blob, format, { screen: true, microphone, dimensions: '1280x720' })).blob : blob;
      await tview.host.export.download(clip, `presentation.${format ?? 'webm'}`);
    },
  };
}

/** Countdown is the second explicit source adapter; other utilities are not assumed capture-ready. */
function mountCountdown(tview: ToolViewCtx): void {
  if (tview.toolId !== 'countdown-timer') return;
  const cluster = tview.viewEl.querySelector('.gallery-topright');
  if (!cluster) return;
  const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn--ghost';
  button.textContent = t('Present with camera'); cluster.prepend(button);
  let presenter: PresentController | null = null, opening = false;
  button.addEventListener('click', () => {
    if (presenter || opening) return;
    let controls: Window | null = null;
    try { controls = window.open('about:blank', 'lolly-speaker', 'popup=yes,width=1280,height=900'); } catch { /* unavailable in this host */ }
    const controlsWindow = controls;
    opening = true;
    void (async () => {
      try {
        if (!controlsWindow) throw new Error('Allow popups to open private presentation controls.');
        const [{ openPresentMode }, { countdownPresentation }, { presentationSourcePage }] = await Promise.all([
          import('../present-mode.ts'), import('../present-production/countdown.ts'), import('../present-production/source.ts'),
        ]);
        await tview.brandVarsReady;
        if (tview.mountLifecycle.disposed || controlsWindow.closed) return;
        const content = countdownPresentation(tview.contentEl);
        if (!content) throw new Error('Wait for Countdown to finish loading.');
        presenter = openPresentMode({ source: presentationSourcePage(document, content), varsFrom: tview.contentEl, transition: 'none',
          production: { ...productionOptions(tview, controlsWindow), content }, onClose: () => { presenter = null; },
        });
      } catch (error) {
        if (!tview.mountLifecycle.disposed) {
          const { showUndoToast } = await import('../../lib/undo-toast.ts');
          showUndoToast({ message: error instanceof Error ? t(error.message) : t('Could not open the presentation.'), actionLabel: t('Dismiss'), undo: () => {} });
        }
      } finally { opening = false; if (!presenter) controlsWindow?.close(); }
    })();
  });
  tview.mountLifecycle.add('countdown presentation', () => { presenter?.close(); button.remove(); });
}

export const presentationOps = (tview: ToolViewCtx) => ({
  presenceAddress,
  presenceClose,
  productionOptions: (win: Window) => productionOptions(tview, win),
  mountCountdown: () => mountCountdown(tview),
});
