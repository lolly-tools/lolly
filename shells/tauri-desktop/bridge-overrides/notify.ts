// SPDX-License-Identifier: MPL-2.0
/**
 * OS notifications for the desktop shell (plans/202 WP4.1).
 *
 * shells/web/src/lib/job-toast.ts raises one when a long background job finishes
 * while the window is hidden. In a browser that is the web `Notification` API.
 * In this shell it is tauri-plugin-notification, which posts through the real
 * platform service (Notification Center, the XDG portal, the Windows toast
 * stack) instead of the webview's own implementation - so the notification
 * survives the window being closed and shows the app's name and icon.
 *
 * INSTALLED AS A GLOBAL, not swapped in by the vite override map. The map keys
 * on a module imported from inside `bridge/`, and job-toast.ts lives in `lib/`;
 * relaxing that matcher would also catch `pro/run-overlay.ts`'s dynamic
 * `import('../bridge/export.ts')` and hand it the wrong module. So this file
 * publishes `window.__lollyNotify` and job-toast probes for it, falling back to
 * the web API when it is absent - a browser, the mobile shell, or a desktop
 * build where the plugin failed to load. Same shape as the eyedropper shim
 * beside it: loaded for its side effect from capabilities-provided.ts, which the
 * bridge pulls in on every boot, well before the first job can start.
 */
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

export interface ShellNotify {
  /** Ask once, from inside the user gesture that started the first long job. */
  request(): void;
  /** Post one notification. Silently does nothing without permission. */
  send(title: string, body: string): void;
}

/** Last known answer. `null` until the first check, so nothing is posted before
 *  the permission state is actually known. */
let granted: boolean | null = null;

async function ensure(): Promise<boolean> {
  if (granted !== null) return granted;
  try {
    granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === 'granted';
  } catch {
    granted = false; // no notification service on this desktop - stay quiet
  }
  return granted;
}

const notify: ShellNotify = {
  request(): void {
    void ensure();
  },
  send(title: string, body: string): void {
    void ensure().then((ok) => {
      if (!ok) return;
      try {
        // No per-job tag: the plugin's options carry no `tag` field, and the web
        // API's collapse-by-tag has nothing to collapse here anyway - job-toast
        // sends at most one notification per job, on its transition to done.
        sendNotification({ title, body });
      } catch { /* the toast already told the story */ }
    });
  },
};

(globalThis as { __lollyNotify?: ShellNotify }).__lollyNotify = notify;
