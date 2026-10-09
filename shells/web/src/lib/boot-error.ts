// SPDX-License-Identifier: MPL-2.0
import { t } from '../i18n.ts';
import { isWebGpuFailure, webGpuFailureText } from './webgpu/device.ts';
import { getFloatCluster } from './float-cluster.ts';

/** Keep the current document visible until the person clicks Reload. */
export function showDatabaseUpdateRequired(reload: () => void = () => window.location.reload()): void {
  if (typeof document === 'undefined' || !document.body || document.querySelector('[data-database-update-required]')) return;
  const wrap = document.createElement('div');
  wrap.className = 'undo-toasts';
  wrap.dataset.databaseUpdateRequired = 'true';
  const notice = document.createElement('div');
  notice.className = 'undo-toast';
  notice.setAttribute('role', 'alert');
  const message = document.createElement('span');
  message.className = 'undo-toast-msg';
  message.style.whiteSpace = 'normal';
  message.textContent = t('An update is ready. Saving on this device has stopped. Save shared work or keep a recovery copy, then reload this tab.');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'undo-toast-btn';
  button.textContent = t('Reload');
  button.addEventListener('click', reload);
  notice.append(message, button);
  wrap.append(notice);
  getFloatCluster().append(wrap);
}

/**
 * Load recovery UI after a failed boot; supported startup does not need this path.
 * The same card is the unsupported-environment result when the WebGPU startup check
 * fails (plan 295): it carries `data-webgpu-unsupported` so a test or a driver can
 * tell it apart from any other boot failure. Safe to call again (main.ts repaints it
 * once the interface language has loaded); each call replaces the card.
 */
export function showBootError(error: unknown): void {
  if (error instanceof Error && 'code' in error && error.code === 'DB_UPDATE_REQUIRED') {
    showDatabaseUpdateRequired();
    return;
  }
  const view = document.getElementById('view');
  if (!view) return;
  view.textContent = '';
  const div = document.createElement('div');
  div.className = 'error';
  const msg = document.createElement('p');
  msg.style.margin = '0';
  const message = error instanceof Error ? error.message : String(error);
  const webGpu = isWebGpuFailure(error);
  if (webGpu) div.dataset.webgpuUnsupported = error.code;
  msg.textContent = webGpu ? webGpuFailureText(error, t) ?? message : `Boot failed: ${message}`;
  div.appendChild(msg);
  const databaseBlocked = error instanceof Error && 'code' in error
    && (error.code === 'DB_BLOCKED' || error.code === 'DB_OPEN_TIMEOUT');
  if (databaseBlocked || webGpu) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = t('Reload');
    btn.style.marginTop = '10px';
    btn.addEventListener('click', () => window.location.reload());
    div.appendChild(btn);
  }
  if (databaseBlocked) {
    // Returning from the tab that held the database lock triggers one retry.
    let retried = false;
    const retry = () => {
      if (retried || document.visibilityState !== 'visible') return;
      retried = true;
      window.location.reload();
    };
    document.addEventListener('visibilitychange', retry);
    window.addEventListener('focus', retry);
  }
  view.appendChild(div);
}
