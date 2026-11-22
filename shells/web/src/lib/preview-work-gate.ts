// SPDX-License-Identifier: MPL-2.0
/**
 * When background preview work may run (plan 373). The idle work (lib/preview-idle.ts:
 * the move of old pictures, the redraw of stale tiles) and the background lane of the
 * picture encoder (lib/preview-encode.ts) both ask here, so they hold back for the
 * same things. Two kinds:
 *
 *  - the page is busy for now (`previewPageBusy`): the tab is hidden, the page is
 *    opening a tool (the open sequence's held view, view-fade.ts), or an export or a
 *    batch render is running (lib/render-busy.ts);
 *  - the device asks for less work (`previewDeviceConstrained`): Performance UI is on
 *    (by hand or switched on by the device's own signals, plan 335), the battery is
 *    low and not charging, or the browser asks to save data.
 *
 * The idle work also stays off every tool route (`previewWorkAllowed`). The encoder
 * waits while the page is busy and, when the device is constrained, keeps a render as
 * it came instead of judging it, because a gallery tile is waiting for that picture.
 *
 * A leaf module: it imports neither of the modules that ask, so this module adds no
 * dependency between them.
 */
import { renderBusy } from './render-busy.ts';

/** The route without its query. */
export function currentRoute(): string {
  return typeof location === 'undefined' ? '' : location.hash.split('?')[0] ?? '';
}

/** The page is busy for now: a hidden tab, a tool opening, an export or a batch render. */
export function previewPageBusy(): boolean {
  if (typeof document === 'undefined') return true;
  if (document.visibilityState !== 'visible') return true;
  if (document.querySelector('.view-fade--hold')) return true;
  if (renderBusy()) return true;
  return false;
}

/** The device asks for less work: Performance UI, a low battery or Save-Data. */
export function previewDeviceConstrained(): boolean {
  if (constrained) return true;
  try {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return true;
  } catch { /* no connection info */ }
  return perfUi();
}

/** Whether idle preview work may run now. */
export function previewWorkAllowed(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.visibilityState !== 'visible') return false;
  if (currentRoute().startsWith('#/tool')) return false;
  if (document.querySelector('.view-fade--hold')) return false;
  if (renderBusy()) return false;
  if (previewDeviceConstrained()) return false;
  return true;
}

let perfUiRead: (() => boolean) | null = null;
function perfUi(): boolean {
  if (!perfUiRead) {
    perfUiRead = () => false;
    void import('../feature-flags.ts').then(m => { perfUiRead = m.perfUiOn; }).catch(() => {});
  }
  return perfUiRead();
}

let constrained = false;
let batteryWatched = false;
/** Start following the battery, so low power holds the work back. */
export function watchPreviewBattery(): void {
  if (batteryWatched || typeof navigator === 'undefined') return;
  batteryWatched = true;
  const nav = navigator as Navigator & { getBattery?: () => Promise<{ charging: boolean; level: number; addEventListener(type: string, fn: () => void): void }> };
  void nav.getBattery?.().then(async battery => {
    const { batteryConstrained } = await import('./perf-ui-auto-temporary.ts');
    const read = (): void => { constrained = batteryConstrained(battery.charging, battery.level); };
    read();
    battery.addEventListener('levelchange', read);
    battery.addEventListener('chargingchange', read);
  }).catch(() => {});
}

/** A timer that never keeps a test process alive. */
export function later(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
  const timer = setTimeout(fn, ms);
  (timer as { unref?: () => void }).unref?.();
  return timer;
}

/**
 * Call `fn` once the work might be allowed again: the tab comes back, the route
 * changes, or (for a render, a power state or playback, which send no event here)
 * `ms` pass.
 */
export function whenPreviewWorkMayResume(fn: () => void, ms: number): void {
  let woken = false;
  const go = (): void => {
    if (woken) return;
    woken = true;
    window.removeEventListener('hashchange', go);
    document.removeEventListener('visibilitychange', go);
    clearTimeout(timer);
    fn();
  };
  window.addEventListener('hashchange', go);
  document.addEventListener('visibilitychange', go);
  const timer = later(go, ms);
}
