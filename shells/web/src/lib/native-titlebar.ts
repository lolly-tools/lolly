// SPDX-License-Identifier: MPL-2.0
/**
 * Window dragging for the macOS unified title bar (plans/321 M1).
 *
 * The desktop app on a Mac draws its window buttons over the page, so there is
 * no system title bar left to grab. The shell marks that case with
 * html[data-native-titlebar="mac"] (presentation_windows.rs) and this module
 * gives the top band back its title-bar behaviour: press on anything in the
 * band that is not a control and the window moves; double-click it and the
 * window does what System Settings > Desktop & Dock says (zoom, minimise or
 * nothing). Both go through the one main-window command `desktop_titlebar`, so
 * the page is granted no window permission of its own.
 *
 * Every other shell returns at the first line: no attribute, no listeners.
 */

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: { invoke?: (cmd: string, args?: unknown) => Promise<unknown> };
};

/** Things a press should operate rather than move the window with. A bare
 *  tabindex is NOT on the list: the gallery's cover-flow scroller is focusable
 *  only so the keyboard can scroll it, and it fills the band. */
export const TITLEBAR_CONTROLS = [
  'a[href]', 'button', 'input', 'select', 'textarea', 'label', 'summary', 'video', 'iframe',
  '[contenteditable]:not([contenteditable="false"])', '[draggable="true"]',
  '[role="button"]', '[role="link"]', '[role="menuitem"]', '[role="tab"]', '[role="checkbox"]',
  '[role="radio"]', '[role="switch"]', '[role="option"]', '[role="slider"]', '[role="textbox"]',
  '[role="combobox"]', '[data-titlebar="none"]',
].join(',');

/** True when a press at this point of the band should move the window. */
export function isTitlebarDrag(path: readonly EventTarget[], clientY: number, band: number): boolean {
  if (!(clientY >= 0 && clientY < band)) return false;
  for (const node of path) {
    if (!(node instanceof Element)) continue;
    if (node.matches(TITLEBAR_CONTROLS)) return false;
    // A modal owns every press inside it, its own backdrop included.
    if (node.matches('[aria-modal="true"], dialog[open]')) return false;
  }
  return true;
}

export function initNativeTitlebar(): void {
  if (document.documentElement.dataset.nativeTitlebar !== 'mac') return;
  const invoke = (window as TauriWindow).__TAURI_INTERNALS__?.invoke;
  if (typeof invoke !== 'function') return;

  // The band is the top chrome row: --chrome-top plus --chrome-h, which grows
  // with the large-text preference. Measured from a probe so the CSS stays the
  // one place that knows the numbers.
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;'
    + 'height:calc(var(--chrome-top) + var(--chrome-h))';
  document.documentElement.appendChild(probe);
  const band = (): number => probe.getBoundingClientRect().height || 50;

  let pressX = Number.NaN;
  let pressY = Number.NaN;
  // Bubble phase on purpose: a control that handles its own press and calls
  // preventDefault (or stops propagation) keeps that press.
  window.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.defaultPrevented) return;
    if (!isTitlebarDrag(e.composedPath(), e.clientY, band())) return;
    if (e.detail === 2) {
      // macOS acts on the release, and only when the pointer did not move.
      pressX = e.clientX;
      pressY = e.clientY;
      return;
    }
    if (e.detail !== 1) return;
    e.preventDefault(); // no text selection or focus change from a title-bar press
    void invoke('desktop_titlebar', { action: 'drag' }).catch(() => {});
  });
  window.addEventListener('mouseup', e => {
    if (e.button !== 0 || e.detail !== 2) return;
    if (e.clientX !== pressX || e.clientY !== pressY) return;
    pressX = pressY = Number.NaN;
    if (!isTitlebarDrag(e.composedPath(), e.clientY, band())) return;
    void invoke('desktop_titlebar', { action: 'double-click' }).catch(() => {});
  });
}
