// SPDX-License-Identifier: MPL-2.0
/**
 * Whole-UI zoom for the desktop webview (plans/202 WP4.1).
 *
 * A browser gives every page Cmd/Ctrl `=` `-` `0` for free. A wry webview does
 * not: it has no zoom UI and no default chord, so until now those keys did
 * nothing at all in the desktop app. shells/web/src/views/tool-stage-nav.ts
 * refuses to answer them itself (they belong to the host, and re-capturing them
 * would break real page zoom in the browser), so the shell has to provide them.
 *
 * The keys arrive as native menu accelerators, not as a keydown listener. The
 * View > Zoom items in src-tauri/src/menu.rs carry the accelerators and eval
 * `window.__lollyZoom.step(...)` here, so there is one code path and no risk of
 * a menu item and a page listener both firing on one press.
 *
 * The factor persists in the profile KV store (bridge/db.ts, the same store
 * theme and language use) - never localStorage, which is the shell's FOUC
 * mirror only. It is restored on the next launch.
 *
 * Range is 0.5 to 3. Below half the chrome stops being clickable; above three a
 * 1200px window fits almost nothing. Both ends clamp silently - pressing the key
 * again at the limit is a no-op, which is what every browser does.
 *
 * DELIBERATELY chrome-and-canvas alike: this is the host's page zoom, so it
 * scales the whole webview including a tool canvas on screen. It cannot reach an
 * export - exports render through the engine's own geometry (engine/src/units.ts),
 * never through the webview's presentation scale - so a zoomed window still
 * writes byte-identical PNG/SVG/PDF.
 */
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { openDB } from '../../web/src/bridge/db.ts';

/** Profile KV key. Same store as the theme/instance keys, so a profile export
 *  carries it and a cleared profile forgets it. */
const ZOOM_KEY = 'webview-zoom';

const MIN = 0.5;
const MAX = 3;
/** One press. 1.2 gives 0.5 → 3 in about nine steps each way, close enough to
 *  Chrome's ladder that the feel is familiar without hard-coding its stops. */
const STEP = 1.2;

let factor = 1;

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX, Math.max(MIN, n));
}

async function apply(next: number): Promise<void> {
  factor = clamp(next);
  try {
    await getCurrentWebviewWindow().setZoom(factor);
  } catch {
    // No zoom on this webview build. Nothing else in the app reads the factor,
    // so a failure here is invisible rather than broken.
    return;
  }
  try {
    await (await openDB()).put('profile', factor, ZOOM_KEY);
  } catch { /* private mode or a blocked store - the zoom still applied */ }
}

export interface ShellZoom {
  /** +1 zooms in, -1 out, 0 resets to 100%. */
  step(direction: number): void;
  /** Current factor, for anything that wants to show it. */
  current(): number;
}

const zoom: ShellZoom = {
  step(direction: number): void {
    if (direction === 0) { void apply(1); return; }
    void apply(direction > 0 ? factor * STEP : factor / STEP);
  },
  current: () => factor,
};

(globalThis as { __lollyZoom?: ShellZoom }).__lollyZoom = zoom;

// The one chord the menu cannot carry. On most layouts "+" is Shift+"=", and
// browsers bind Cmd/Ctrl+Shift+= to zoom in alongside Cmd/Ctrl+=. A muda menu
// item holds a single accelerator and that one is on the unshifted key, so this
// listener answers the shifted sibling and nothing else - no overlap with the
// menu, so a press can never be handled twice.
window.addEventListener('keydown', (e) => {
  if (!e.shiftKey || e.altKey) return;
  if (!e.metaKey && !e.ctrlKey) return;
  if (e.code !== 'Equal') return;
  e.preventDefault();
  zoom.step(1);
});

// Restore the saved factor. Read once at boot; a value outside the range (an
// older build, a hand-edited profile) clamps rather than being thrown away.
void (async () => {
  try {
    const saved = await (await openDB()).get('profile', ZOOM_KEY);
    if (typeof saved === 'number' && saved !== 1) await apply(saved);
  } catch { /* nothing saved, or the store is unreadable - stay at 100% */ }
})();
