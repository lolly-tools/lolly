// SPDX-License-Identifier: MPL-2.0
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { check } from '@tauri-apps/plugin-updater';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import type { ShellUpdater, UpdateEnvironment } from '../../web/src/lib/update-coordinator.ts';

const updater: ShellUpdater = {
  async check() {
    const found = await check({ timeout: 30_000 });
    if (!found) return null;
    return { version: found.version, currentVersion: found.currentVersion, notes: found.body ?? '',
      async download(progress) {
        let received = 0, total = 0;
        await found.download(event => {
          if (event.event === 'Started') { received = 0; total = event.data.contentLength ?? 0; }
          if (event.event === 'Progress') received += event.data.chunkLength;
          progress(received, total);
        }, { timeout: 120_000 });
      },
      install: () => found.install(), close: () => found.close() };
  },
  environment: () => invoke<UpdateEnvironment>('updater_environment'),
  focused: () => invoke<boolean>('updater_focused'),
  openDownload: () => invoke('updater_open_download'),
  async notify(title, body) {
    if (await isPermissionGranted()) sendNotification({ title, body });
  },
  async requestNotifications() { if (!(await isPermissionGranted())) await requestPermission(); },
  async onQuit(handler) {
    const off = await listen('lolly-update-quit', handler);
    const disarm = (): void => { off(); void invoke('updater_arm', { armed: false }).catch(() => {}); };
    window.addEventListener('pagehide', disarm, { once: true });
    try { await invoke('updater_arm', { armed: true }); }
    catch (error) { window.removeEventListener('pagehide', disarm); disarm(); throw error; }
    return () => { window.removeEventListener('pagehide', disarm); disarm(); };
  },
  finish: restart => invoke('updater_finish', { restart }),
};

if (!('__LOLLY_CLI__' in globalThis) && getCurrentWindow().label === 'main') {
  const environment = await updater.environment();
  if (environment.reason !== 'unsupported') (globalThis as { __lollyUpdater?: ShellUpdater }).__lollyUpdater = updater;
}
