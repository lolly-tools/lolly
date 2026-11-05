// SPDX-License-Identifier: MPL-2.0
import { t, tRaw } from '../i18n.ts';
import { fmtBytes } from '../lib/format.ts';
import { MANUAL_DOWNLOAD, startDesktopUpdates, updateCoordinator } from '../lib/desktop-updates.ts';
import type { ShellUpdater } from '../lib/update-coordinator.ts';
export type { ShellUpdater, ShellUpdate } from '../lib/update-coordinator.ts';
export { updaterGlobal } from '../lib/desktop-updates.ts';

export function updatesRowHtml(present: boolean): string {
  if (!present) return '';
  return `<div id="updates-row">
    <label class="store-manage--row">${t('App updates')}
      <select class="field-select field-select--auto" id="updates-mode">
        <option value="notify">${t('Notify')}</option><option value="automatic">${t('Update automatically')}</option><option value="off">${t('Off')}</option>
      </select>
    </label>
    <label class="store-manage--row"><span>${t('Update notifications')}</span><input type="checkbox" class="field-check" id="updates-notifications"></label>
    <p id="updates-status" role="status" aria-live="polite"></p>
    <p id="updates-reason"></p>
    <details id="updates-notes" hidden><summary>${t('Release notes')}</summary><p></p></details>
    <div class="store-manage--row updates-actions">
      <button type="button" class="btn" id="updates-check">${t('Check for updates')}</button>
      <button type="button" class="btn" id="updates-download" hidden>${t('Download')}</button>
      <button type="button" class="btn" id="updates-install" hidden>${t('Restart now')}</button>
      <button type="button" class="btn" id="updates-quit" hidden>${t('Install when I quit')}</button>
      <button type="button" class="btn" id="updates-later" hidden>${t('Later')}</button>
      <a class="btn" href="${MANUAL_DOWNLOAD}" target="_blank" rel="noopener noreferrer" id="updates-manual" hidden>${t('Manual download')}</a>
    </div></div>`;
}

export function wireUpdatesRow(viewEl: HTMLElement, updater: ShellUpdater | null, params: string): () => void {
  const owner = updateCoordinator(updater);
  if (!owner || !updater) return () => {};
  const find = <T extends HTMLElement>(id: string): T => viewEl.querySelector<T>(`#updates-${id}`)!;
  const status = find('status'), reason = find('reason'), notes = find<HTMLDetailsElement>('notes');
  if (!status || !notes) return () => {};
  const mode = find<HTMLSelectElement>('mode'), notifications = find<HTMLInputElement>('notifications');
  const check = find<HTMLButtonElement>('check'), download = find<HTMLButtonElement>('download'), install = find<HTMLButtonElement>('install');
  const quit = find<HTMLButtonElement>('quit'), later = find<HTMLButtonElement>('later'), manual = find('manual');
  const unsub = owner.subscribe(() => {
    const s = owner.state;
    mode.value = s.mode; mode.querySelector<HTMLOptionElement>('option[value="automatic"]')!.disabled = !s.canInstall; notifications.checked = owner.prefs.notifications;
    const busy = ['checking', 'downloading', 'installing'].includes(s.status);
    check.disabled = busy; download.disabled = busy; install.disabled = busy;
    check.textContent = s.error ? tRaw('Retry') : tRaw('Check for updates');
    status.textContent = s.error ? tRaw('Update could not finish. Try again or download the app.')
      : s.status === 'checking' ? tRaw('Checking…') : s.status === 'current' ? tRaw('Up to date')
        : s.status === 'downloading' ? (s.total ? `${fmtBytes(s.received)} / ${fmtBytes(s.total)}` : fmtBytes(s.received))
          : s.version ? tRaw(s.status === 'ready' ? 'Ready to install: {version}' : 'Update available: {version}', { version: s.version }) : '';
    reason.textContent = s.reason === 'read-only' ? tRaw('This AppImage cannot be replaced here. Download the app to a writable folder.')
      : s.reason === 'managed' ? tRaw('This installation uses its package manager for updates.')
        : s.reason === 'unsupported' ? tRaw('This desktop platform does not support in-app updates.') : '';
    notes.hidden = !s.notes; notes.querySelector('p')!.textContent = s.notes;
    download.hidden = !s.canInstall || !['available', 'downloading'].includes(s.status);
    install.hidden = s.status !== 'ready' || !s.canInstall;
    quit.hidden = s.status !== 'ready' || s.mode !== 'automatic' || !s.canInstall;
    later.hidden = !s.version;
    manual.hidden = !s.error && s.canInstall;
  });
  check.onclick = () => {
    if (owner.state.error && owner.state.status === 'ready') { void owner.install(); return; }
    void startDesktopUpdates(updater)?.then(() => owner.check(true));
  };
  download.onclick = () => { void owner.download(); };
  install.onclick = () => { void owner.install(); };
  quit.onclick = later.onclick = () => { owner.dismiss(); };
  mode.onchange = () => { owner.setMode(mode.value === 'automatic' ? 'automatic' : mode.value === 'off' ? 'off' : 'notify'); };
  if (updater.openDownload) manual.onclick = event => {
    event.preventDefault();
    void updater.openDownload?.().catch(() => { status.textContent = tRaw('Update could not finish. Try again or download the app.'); });
  };
  notifications.onchange = () => { void owner.setNotifications(notifications.checked); };
  void startDesktopUpdates(updater)?.then(() => { if (new URLSearchParams(params).get('check') === 'updates') return owner.check(true); });
  return unsub;
}
