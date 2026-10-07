// SPDX-License-Identifier: MPL-2.0
import { isWebGpuFailure } from './webgpu/device.ts';

/** Load recovery UI after a failed boot; supported startup does not need this path. */
export function showBootError(error: unknown): void {
  const view = document.getElementById('view');
  if (!view) return;
  view.textContent = '';
  const div = document.createElement('div');
  div.className = 'error';
  const msg = document.createElement('p');
  msg.style.margin = '0';
  const message = error instanceof Error ? error.message : String(error);
  msg.textContent = isWebGpuFailure(error) ? message : `Boot failed: ${message}`;
  div.appendChild(msg);
  const databaseBlocked = error instanceof Error && 'code' in error
    && (error.code === 'DB_BLOCKED' || error.code === 'DB_OPEN_TIMEOUT');
  if (databaseBlocked || isWebGpuFailure(error)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = 'Reload';
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
