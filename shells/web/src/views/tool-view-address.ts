// SPDX-License-Identifier: MPL-2.0
/**
 * views/tool-view-address - the stage view a person chose, kept in the address as `_view`
 * so a reload or a copied address opens where they were looking. Mounted with every
 * stage tool (views/tool/stage-layout.ts).
 *
 * The view is written once it settles, not on every frame of a pinch, wheel or pan.
 * Each write parses and rebuilds the whole address, which can hold the whole document,
 * and wakes every `lolly:url-state` listener, and WebKit refuses a page that writes its
 * address too often. The quiet window outlasts the stage's own wheel burst, and a
 * gesture that ends with a pointer or a WebKit pinch writes on the next frame, after the
 * stage's last report. Share, export and leaving the page flush it through
 * lib/url-state.ts. Design restores the view once, after its first fit, so a reload
 * mid-gesture loses at most the settle time of movement.
 */
import { isIframeMode } from '../lib/iframe-mode.ts';
import { mergeRouteParams, replaceRouteUrl, settledWrite } from '../lib/url-state.ts';
import type { StageNav } from './tool-stage-nav.ts';

/** How long the view must stay still before it is written (ms). */
export const VIEW_SETTLE_MS = 300;
const GESTURE_ENDS = ['pointerup', 'pointercancel', 'gestureend'] as const;

export function mountViewAddress(
  zoom: Pick<StageNav, 'subscribe' | 'isUserZoomed' | 'isSuspended' | 'viewState'>,
  stage: EventTarget,
): () => void {
  let lastView = '';
  const write = settledWrite(() => replaceRouteUrl(mergeRouteParams(window.location.href, { _view: lastView })), VIEW_SETTLE_MS);
  const off = zoom.subscribe(() => {
    if (isIframeMode() || !zoom.isUserZoomed() || zoom.isSuspended()) return;
    const view = JSON.stringify(zoom.viewState());
    if (view === lastView) return;
    lastView = view;
    write.schedule();
  });
  const settle = (): void => {
    if (write.pending()) requestAnimationFrame(write.flush);
  };
  for (const type of GESTURE_ENDS) stage.addEventListener(type, settle, true);
  return () => {
    off();
    write.cancel();
    for (const type of GESTURE_ENDS) stage.removeEventListener(type, settle, true);
  };
}
