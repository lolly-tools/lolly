// SPDX-License-Identifier: MPL-2.0
import { tRaw } from '../i18n.ts';
import { publishNotification } from './notifications.ts';
import { UpdateCoordinator, type ShellUpdater } from './update-coordinator.ts';

export const MANUAL_DOWNLOAD = 'https://lolly.tools/info/install.html';
const KEY = 'lolly:desktop-updates';
let coordinator: UpdateCoordinator | undefined;
let starting: Promise<UpdateCoordinator> | undefined;
let stop: (() => void) | undefined;

export function updaterGlobal(): ShellUpdater | null {
  if (typeof window === 'undefined' || '__LOLLY_CLI__' in window) return null;
  const shell = (window as { __lollyUpdater?: ShellUpdater }).__lollyUpdater;
  return shell && typeof shell.environment === 'function' ? shell : null;
}

export function updateCoordinator(shell = updaterGlobal()): UpdateCoordinator | null {
  if (!shell) return null;
  if (coordinator) return coordinator;
  coordinator = new UpdateCoordinator({ shell,
    read: () => JSON.parse(localStorage.getItem(KEY) ?? 'null'),
    write: prefs => { localStorage.setItem(KEY, JSON.stringify(prefs)); },
    protect: async () => (await import('./update-work.ts')).protectUpdateWork(),
    release: () => { void import('./update-work.ts').then(m => m.releaseUpdateWork()); },
    notifyText: version => ({ title: 'Lolly', body: tRaw('Update available: {version}', { version }) }),
  });
  return coordinator;
}

/** Start only after the main shell has mounted; all route changes keep this owner. */
export function startDesktopUpdates(shell = updaterGlobal()): Promise<UpdateCoordinator> | undefined {
  const owner = updateCoordinator(shell);
  if (!owner || !shell) return undefined;
  if (starting) return starting;
  starting = (async () => {
    await owner.initialize();
    let removeNotice: (() => void) | undefined;
    const unsub = owner.subscribe(() => {
      removeNotice?.(); removeNotice = undefined;
      const s = owner.state;
      if (!s.version || owner.dismissed() || !['available', 'ready', 'downloading'].includes(s.status)) return;
      const ready = s.status === 'ready';
      const run = (): Promise<void> => ready ? owner.install() : owner.download();
      removeNotice = publishNotification({ id: `desktop-update:${ready ? 'ready' : 'available'}:${s.version}`,
        title: tRaw(ready ? 'Ready to install: {version}' : 'Update available: {version}', { version: s.version }),
        body: s.notes, tone: 'info', action: s.canInstall ? { label: tRaw(ready ? 'Restart now' : 'Download'), run } : shell.openDownload ? { label: tRaw('Manual download'), run: () => shell.openDownload?.() } : { label: tRaw('Manual download'), href: MANUAL_DOWNLOAD },
        secondary: { label: tRaw(ready && s.mode === 'automatic' ? 'Install when I quit' : 'Later'), run: () => owner.dismiss() }, onDismiss: () => owner.dismiss() });
    });
    let unquit: (() => void) | undefined;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (): void => {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void refresh(); }, owner.delay());
    };
    const refresh = async (): Promise<void> => {
      try {
        await owner.initialize();
        if (owner.interactiveApp() && !unquit) unquit = await shell.onQuit(() => { void owner.quit(); });
        await owner.check();
      } finally { schedule(); }
    };
    const foreground = (): void => { if (!document.hidden) void refresh(); };
    window.addEventListener('focus', foreground);
    document.addEventListener('visibilitychange', foreground);
    window.addEventListener('pagehide', stopDesktopUpdates, { once: true });
    stop = () => { window.removeEventListener('pagehide', stopDesktopUpdates); stopped = true; if (timer) clearTimeout(timer); window.removeEventListener('focus', foreground); document.removeEventListener('visibilitychange', foreground); unquit?.(); unsub(); removeNotice?.(); void owner.dispose(); };
    await refresh();
    return owner;
  })();
  return starting;
}
export function stopDesktopUpdates(): void { stop?.(); if (!stop) void coordinator?.dispose(); stop = undefined; starting = undefined; coordinator = undefined; }
