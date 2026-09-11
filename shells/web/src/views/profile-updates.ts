// SPDX-License-Identifier: MPL-2.0
/**
 * App updates in /profile (plans/202 WP4.1) - the "Lolly instance" card's
 * three-button row and the state machine behind it.
 *
 * The desktop shell publishes window.__lollyUpdater from
 * shells/tauri-desktop/bridge-overrides/updater.ts, which wraps
 * tauri-plugin-updater. That package is not importable here (the Tauri shells are
 * not npm workspaces), so this is a structural probe of the global, the same
 * shape lib/design-system/sources/website.ts uses for the native site fetch.
 * Absent in a browser, in the PWA and in the mobile app - and then no row is
 * rendered at all, rather than a button that cannot do anything.
 */

import { t, tRaw } from '../i18n.ts';
import { fmtBytes } from '../lib/format.ts';

export interface ShellUpdate {
  version: string;
  currentVersion: string;
  notes: string;
  download(onProgress: (received: number, total: number) => void): Promise<void>;
  install(): Promise<void>;
}
export interface ShellUpdater { check(): Promise<ShellUpdate | null> }

export function updaterGlobal(): ShellUpdater | null {
  if (typeof window === 'undefined') return null;
  const u = (window as { __lollyUpdater?: Partial<ShellUpdater> }).__lollyUpdater;
  return u && typeof u.check === 'function' ? (u as ShellUpdater) : null;
}

/**
 * The row itself. Shown only where the shell installed an updater (the desktop
 * app); a browser updates itself and the PWA updates through the service worker,
 * so there is nothing to offer and no row. The Help menu's "Check for Updates"
 * deep-links here with ?check=updates, which runs the check on arrival.
 */
export function updatesRowHtml(present: boolean): string {
  if (!present) return '';
  return `
        <div class="store-manage--row" id="updates-row">
          <span class="store-manage-name" id="updates-status"></span>
          <span style="display:flex;gap:8px">
            <button type="button" class="btn" id="updates-check">${t('Check for updates')}</button>
            <button type="button" class="btn" id="updates-download" hidden>${t('Download')}</button>
            <button type="button" class="btn" id="updates-install" hidden>${t('Install and restart')}</button>
          </span>
        </div>`;
}

/**
 * Three buttons over one state machine. CONSENT TWICE, the models-fetch pattern:
 * Check moves a few hundred bytes of JSON, Download moves the artifact and reports
 * its real size as soon as the server states it, Install replaces the app and
 * restarts. Nothing runs on mount unless the Help menu asked for it with
 * ?check=updates.
 */
export function wireUpdatesRow(viewEl: HTMLElement, updater: ShellUpdater | null, params: string): void {
  if (!updater) return;
  const statusEl = viewEl.querySelector<HTMLElement>('#updates-status');
  const checkBtn = viewEl.querySelector<HTMLButtonElement>('#updates-check');
  const downloadBtn = viewEl.querySelector<HTMLButtonElement>('#updates-download');
  const installBtn = viewEl.querySelector<HTMLButtonElement>('#updates-install');
  if (!statusEl || !checkBtn || !downloadBtn || !installBtn) return;
  const say = (text: string): void => { statusEl.textContent = text; };
  let pending: ShellUpdate | null = null;
  let busy = false;

  const runCheck = async (): Promise<void> => {
    if (busy) return;
    busy = true;
    checkBtn.disabled = true;
    say(t('Checking…'));
    try {
      pending = await updater.check();
      if (!pending) { say(t('Up to date')); return; }
      // tRaw, not t: this goes into textContent, where an escaped entity
      // would be shown literally.
      say(tRaw('Update available: {version}', { version: pending.version }));
      checkBtn.hidden = true;
      downloadBtn.hidden = false;
    } catch (e) {
      // The endpoint, the signature check and an unpublished target all end up
      // here. Show what went wrong rather than claiming the app is current.
      say((e as Error)?.message || String(e));
    } finally {
      busy = false;
      checkBtn.disabled = false;
    }
  };

  checkBtn.addEventListener('click', () => { void runCheck(); });

  downloadBtn.addEventListener('click', () => {
    if (busy || !pending) return;
    busy = true;
    downloadBtn.disabled = true;
    const update = pending;
    void update.download((received, total) => {
      say(total > 0 ? `${fmtBytes(received)} / ${fmtBytes(total)}` : fmtBytes(received));
    }).then(() => {
      say(t('Downloaded'));
      downloadBtn.hidden = true;
      installBtn.hidden = false;
    }).catch((e: Error) => {
      say(e?.message || String(e));
      downloadBtn.disabled = false;
    }).finally(() => { busy = false; });
  });

  installBtn.addEventListener('click', () => {
    if (busy || !pending) return;
    busy = true;
    installBtn.disabled = true;
    // install() restarts the app, so a resolved promise is not expected. A
    // rejection is, and it has to be readable.
    void pending.install().catch((e: Error) => {
      say(e?.message || String(e));
      installBtn.disabled = false;
      busy = false;
    });
  });

  // The Help menu item routes here and asks for the check straight away, so
  // "Check for Updates" checks instead of just showing a button.
  if (new URLSearchParams(params).get('check') === 'updates') void runCheck();
}
