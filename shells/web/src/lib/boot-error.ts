// SPDX-License-Identifier: MPL-2.0
import '../styles/parts/webgpu-gate.css';
import { docsHref, t } from '../i18n.ts';
import { isWebGpuFailure, isWebGpuMissing, webGpuFailureText, type WebGpuErrorCode } from './webgpu/device.ts';
import { getFloatCluster } from './float-cluster.ts';
import { hydrateFauna, type FaunaName } from '../components/fauna-art.ts';

/** The Fauna drawings approved to ship (Andy, 2026-11-04). The lorikeet, magpie
 *  and wombat wait for their redraw, so their slots stay empty. */
const APPROVED_FAUNA: readonly FaunaName[] = ['koala'];

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
 * The unsupported-environment card (plan 295; plan 346, changes 13 and 21): a
 * door, not an error. Nothing here is the person's fault, so it is calm and
 * neutral, says what is missing in plain words, lists the browsers that work and
 * offers the ways forward: the desktop app, the page that explains why, and
 * Reload. The koala sits above the heading, drawn once the card is in the view
 * (components/fauna-art.ts). Built
 * as DOM, so no string reaches a markup sink; `data-webgpu-unsupported` carries
 * the failure code so a test or a driver can tell it apart from any other boot
 * failure.
 */
export function webGpuGate(error: Error & { code: WebGpuErrorCode }, reload: () => void = () => window.location.reload()): HTMLElement {
  const node = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] => {
    const el = document.createElement(tag);
    el.className = className;
    if (text) el.textContent = text;
    return el;
  };
  const gate = node('section', 'webgpu-gate');
  gate.dataset.webgpuUnsupported = error.code;
  gate.setAttribute('aria-labelledby', 'webgpu-gate-title');
  const fauna = node('span', 'fauna-slot');
  fauna.dataset.fauna = 'koala';
  fauna.dataset.faunaWatch = 'gate';
  fauna.setAttribute('aria-hidden', 'true');
  const title = node('h1', 'webgpu-gate-title', t('Lolly can’t draw in this browser yet'));
  title.id = 'webgpu-gate-title';
  // A browser with no WebGPU at all gets the plain sentence; every other failure
  // (an insecure page, a device short of the limits, a timeout) keeps its own,
  // because the browser list would not answer that failure.
  const lead = node('p', 'webgpu-gate-lead', isWebGpuMissing(error)
    ? t('Lolly draws with WebGPU, which this browser doesn’t offer yet.')
    : webGpuFailureText(error, t) ?? error.message);
  const browsers = node('ul', 'webgpu-gate-browsers');
  for (const name of [t('Chrome or Edge, kept up to date'), t('Safari 26 or later'), t('Firefox, where WebGPU is turned on')]) {
    browsers.append(node('li', '', name));
  }
  const actions = node('div', 'webgpu-gate-actions');
  const app = node('a', 'btn btn--primary webgpu-gate-btn', t('Get the desktop app'));
  app.href = docsHref('install');
  const why = node('a', 'btn btn--ghost webgpu-gate-btn', t('Read why'));
  why.href = docsHref('supported-environments');
  const again = node('button', 'btn btn--ghost webgpu-gate-btn', t('Reload'));
  again.type = 'button';
  again.addEventListener('click', reload);
  actions.append(app, why, again);
  gate.append(fauna, title, lead, node('p', 'webgpu-gate-label', t('These work today:')), browsers, actions);
  return gate;
}

/**
 * Load recovery UI after a failed boot; supported startup does not need this path.
 * A failed WebGPU startup check is not a boot failure but an unsupported browser,
 * and gets {@link webGpuGate} instead of the error card. Safe to call again
 * (main.ts repaints it once the interface language has loaded); each call
 * replaces the card.
 */
export function showBootError(error: unknown): void {
  if (error instanceof Error && 'code' in error && error.code === 'DB_UPDATE_REQUIRED') {
    showDatabaseUpdateRequired();
    return;
  }
  const view = document.getElementById('view');
  if (!view) return;
  view.textContent = '';
  if (isWebGpuFailure(error)) {
    const gate = webGpuGate(error);
    view.append(gate);
    hydrateFauna(gate, { only: APPROVED_FAUNA });
    return;
  }
  const div = document.createElement('div');
  div.className = 'error';
  const msg = document.createElement('p');
  msg.style.margin = '0';
  const message = error instanceof Error ? error.message : String(error);
  msg.textContent = `Boot failed: ${message}`;
  div.appendChild(msg);
  const databaseBlocked = error instanceof Error && 'code' in error
    && (error.code === 'DB_BLOCKED' || error.code === 'DB_OPEN_TIMEOUT');
  if (databaseBlocked) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = t('Reload');
    btn.style.marginTop = '10px';
    btn.addEventListener('click', () => window.location.reload());
    div.appendChild(btn);
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
