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
 * Drawing a look that is not stored yet (a gallery, featured or template cover) is the
 * third kind of work asking here (`lookDrawAllowed`, `lookDrawReach`). A look already
 * stored is read at once; one still to draw waits until the page is at rest: visible,
 * off the tool routes, no export or playback, and no input for {@link INPUT_REST_MS}.
 * How far from the screen a card may be and still have its look drawn depends on the
 * device: near the screen normally, only on the screen when the device asks for less
 * work or has little memory or few cores, and nowhere under Performance UI (which
 * shows the static icons instead).
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

/** Audio or video playing in the page. */
export function mediaPlaying(): boolean {
  if (typeof document === 'undefined') return false;
  try { return [...document.querySelectorAll<HTMLMediaElement>('audio, video')].some(media => !media.paused && !media.ended); } catch { return false; }
}

// ── Drawing looks that are not stored yet ────────────────────────────────────

/** How long the page must go without input before a look is drawn. */
export const INPUT_REST_MS = 1500;
/** Device memory (GB, as the browser rounds it) and logical cores at or below which a
 *  device counts as low-end: looks are then drawn only for cards on the screen. */
const LOW_MEMORY_GB = 2;
const LOW_CORES = 2;

let lastInput = -Infinity;
let inputWatched = false;
const restListeners = new Set<() => void>();
let restTimer: ReturnType<typeof setTimeout> | undefined;
const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Tell everyone waiting for the input rest once it has lasted, `delay` from now. */
function armRest(delay: number): void {
  clearTimeout(restTimer);
  restTimer = later(() => {
    restTimer = undefined;
    const waiting = [...restListeners];
    restListeners.clear();
    for (const fn of waiting) { try { fn(); } catch { /* one listener cannot stop the others */ } }
  }, Math.max(0, delay));
}

function noteInput(): void {
  lastInput = now();
  if (restListeners.size) armRest(INPUT_REST_MS);
}

/** Start noting input (taps, keys, wheel, the page's own scroll), so a look draw waits
 *  for a rest. A strip that drifts scrolls itself all the time; its scroll events do
 *  not bubble to the window, so only the page's scroll is heard. */
export function watchPreviewInput(): void {
  if (inputWatched || typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  inputWatched = true;
  for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const) {
    window.addEventListener(type, noteInput, { capture: true, passive: true });
  }
  window.addEventListener('scroll', noteInput, { passive: true });
}

/** True when the page has had no input for `ms`. */
export function inputRested(ms = INPUT_REST_MS): boolean {
  return now() - lastInput >= ms;
}

/** For tests: forget the last input. */
export function resetPreviewInput(): void {
  lastInput = -Infinity;
  clearTimeout(restTimer);
  restTimer = undefined;
  restListeners.clear();
}

/** A device with little memory or few cores (where the browser says so). */
export function previewDeviceLowEnd(): boolean {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0 && nav.deviceMemory <= LOW_MEMORY_GB) return true;
    if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency <= LOW_CORES) return true;
  } catch { /* no device info */ }
  return false;
}

/**
 * How far from the screen a card may be for its missing look to be drawn: `near` (on
 * the screen or close to it), `screen` (on the screen only: the device asks for less
 * work, or is low-end), or `none` (Performance UI, which draws no live look).
 */
export function lookDrawReach(): 'near' | 'screen' | 'none' {
  if (perfUi()) return 'none';
  if (constrained || previewDeviceLowEnd()) return 'screen';
  try {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return 'screen';
  } catch { /* no connection info */ }
  return 'near';
}

/**
 * True for a run that needs every look drawn as before, at once and in order: a
 * screenshot capture (lib/capture-neutral.ts), whose baselines hold every strip, and
 * the cover bake (scripts/build-gallery-covers.ts, `__lollyBakeCovers`), which walks
 * the page and saves each first cover.
 */
export function drawsEverywhere(capture: boolean): boolean {
  return capture || (globalThis as { __lollyBakeCovers?: boolean }).__lollyBakeCovers === true;
}

/** Whether a missing look may be drawn now: the page is at rest (see the header). */
export function lookDrawAllowed(): boolean {
  if (previewPageBusy()) return false;
  if (currentRoute().startsWith('#/tool')) return false;
  if (!inputRested()) return false;
  if (mediaPlaying()) return false;
  return lookDrawReach() !== 'none';
}

/**
 * Call `fn` once a look draw might be allowed again: the input rest ends, the tab comes
 * back, the route changes, or (for an export, a power state or playback, which send no
 * event here) `ms` pass.
 */
export function whenLookDrawMayResume(fn: () => void, ms = 4000): void {
  let woken = false;
  const go = (): void => {
    if (woken) return;
    woken = true;
    restListeners.delete(go);
    fn();
  };
  if (!inputRested()) {
    restListeners.add(go);
    armRest(INPUT_REST_MS - (now() - lastInput));
  }
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') whenPreviewWorkMayResume(go, ms);
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
