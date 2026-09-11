// SPDX-License-Identifier: MPL-2.0
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { mountModal } from '../components/modal.ts';
import { escape as escapeHtml } from '../utils.ts';
import { t } from '../i18n.ts';

/**
 * Webcam capture → Promise<AssetRef | null>.
 *
 * A live <video> preview of the user's camera with a Capture button; the captured
 * frame becomes a raster user asset via the SAME storeUserUpload path as an upload
 * (downscale + on-device store), so the rest of the app treats it identically. This
 * is a pure shell affordance - no engine/bridge/runtime involvement - which is why
 * "webcam as a still image" needs no architectural change. The camera stream is torn
 * down on every exit path (capture, cancel, Escape, backdrop, error) so no track
 * outlives the dialog. Pixels never leave the device.
 */
export function openWebcamCapture(store: (file: File) => Promise<AssetRef>, log: HostV1['log']): Promise<AssetRef | null> {
  return new Promise((resolve) => {
    let stream: MediaStream | null = null;
    let closed = false;
    const overlay = document.createElement('div');
    overlay.className = 'webcam-capture-overlay';
    overlay.innerHTML = `
      <div class="webcam-capture-backdrop" aria-hidden="true"></div>
      <div class="webcam-capture-panel">
        <header class="webcam-capture-head">
          <span>${t('Take a photo')}</span>
          <button type="button" class="webcam-capture-close" aria-label="${escapeHtml(t('Close'))}">&times;</button>
        </header>
        <div class="webcam-capture-stage">
          <video class="webcam-capture-video" autoplay playsinline muted></video>
          <div class="webcam-capture-status">${t('Starting camera…')}</div>
        </div>
        <footer class="webcam-capture-actions">
          <button type="button" class="webcam-capture-cancel">${t('Cancel')}</button>
          <button type="button" class="webcam-capture-shoot" disabled>${t('Capture')}</button>
        </footer>
      </div>`;
    const modal = mountModal<AssetRef | null>('', {
      className: 'modal-overlay webcam-capture-dialog', ariaLabel: t('Take a photo'),
      onClose: () => done(null),
    });
    modal.el.appendChild(overlay);

    const videoEl  = overlay.querySelector<HTMLVideoElement>('.webcam-capture-video')!;
    const statusEl = overlay.querySelector<HTMLElement>('.webcam-capture-status')!;
    const shootBtn = overlay.querySelector<HTMLButtonElement>('.webcam-capture-shoot')!;

    const stop = (): void => {
      stream?.getTracks().forEach(track => { try { track.stop(); } catch { /* already stopped */ } });
      stream = null;
    };
    const done = (val: AssetRef | null): void => {
      if (closed) return;
      closed = true;
      stop();
      modal.close(val);
      resolve(val);
    };
    overlay.querySelector('.webcam-capture-backdrop')?.addEventListener('click', () => done(null));
    overlay.querySelector('.webcam-capture-close')?.addEventListener('click', () => done(null));
    overlay.querySelector('.webcam-capture-cancel')?.addEventListener('click', () => done(null));
    overlay.querySelector<HTMLElement>('.webcam-capture-cancel')?.focus();

    const showError = (msg: string): void => {
      statusEl.hidden = false;
      statusEl.textContent = msg;
      statusEl.classList.add('webcam-capture-error');
    };

    shootBtn.addEventListener('click', async () => {
      const w = videoEl.videoWidth, h = videoEl.videoHeight;
      if (!w || !h) return;
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d')!.drawImage(videoEl, 0, 0, w, h);
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
      if (!blob) { showError(t('Couldn’t capture the frame.')); return; }
      const file = new File([blob], `webcam-${Date.now()}.png`, { type: 'image/png' });
      try {
        const ref = await store(file);
        done(ref);
      } catch (e) {
        log?.('error', 'Webcam capture store failed', { error: String(e) });
        showError(t('Couldn’t save the photo.'));
      }
    });

    // Kick off the camera; leave the dialog open on failure showing why.
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (closed) { stop(); return; }
        videoEl.srcObject = stream;
        await videoEl.play().catch(() => {});
        if (closed) return;
        statusEl.hidden = true;
        shootBtn.disabled = false;
        shootBtn.focus();
      } catch (e) {
        log?.('warn', 'Webcam start failed', { error: String(e) });
        showError((e as Error | null)?.name === 'NotAllowedError'
          ? t('Camera permission was declined. Allow camera access, then try again.')
          : t('Couldn’t start the camera on this device.'));
      }
    })();
  });
}

