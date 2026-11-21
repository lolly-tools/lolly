// SPDX-License-Identifier: MPL-2.0
/**
 * Ask the iPhone shell to put the page back where the page believes it is.
 *
 * On an iPhone the web view's scroll view can be left resting below its top edge
 * after a navigation. The page still reads scroll position 0, so the fault cannot
 * be seen from here: the view draws half a screen low and, in Dark appearance,
 * the system background shows above as a black band. The native command
 * (shells/tauri-mobile/src-tauri/src/page_scroll.rs) reads the scroll view and
 * clamps the offset when the view is at rest outside its limits.
 *
 * Called after each view mounts and when the app returns to the foreground, and
 * again shortly after, because a view is read before its content has laid out
 * and the fault can appear in that gap. A no-op in a browser and in the desktop
 * shell.
 */

interface TauriInternals {
  invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
}

/** What the native command read. `fixed` says the offset was put back. */
export interface PageScrollReading {
  read: boolean;
  offsetY: number;
  insetTop: number;
  adjustedTop: number;
  contentHeight: number;
  boundsHeight: number;
  frameY: number;
  busy: boolean;
  fixed: boolean;
}

/** Fired on `window` with each reading, for the performance HUD and for tests. */
export const PAGE_SCROLL_EVENT = 'lolly:page-scroll';

/** Later readings of the same view: once laid out, and once any bounce has ended. */
const FOLLOW_UP_MS = [350, 1200];

function nativeInvoke(): TauriInternals['invoke'] | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;
  const internals = (window as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__;
  if (typeof internals?.invoke !== 'function') return null;
  // Only the iPhone and iPad shell carries the command.
  const touchMac = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  if (!/iPhone|iPad|iPod/.test(navigator.userAgent) && !touchMac) return null;
  return internals.invoke.bind(internals);
}

let followUps: Array<ReturnType<typeof setTimeout>> = [];

function read(invoke: TauriInternals['invoke'], reason: string): void {
  void invoke<PageScrollReading>('page_scroll_settle', { fix: true }).then((reading) => {
    if (!reading?.read) return;
    if (reading.fixed) console.warn('[page-scroll] the page was resting out of place and was put back', reason, reading);
    window.dispatchEvent(new CustomEvent(PAGE_SCROLL_EVENT, { detail: { reason, ...reading } }));
  }).catch(() => { /* an older shell without the command */ });
}

/** Read the native scroll view and put the page back. `reason` travels with the event. */
export function settlePageScroll(reason: string): void {
  const invoke = nativeInvoke();
  if (!invoke) return;
  for (const timer of followUps) clearTimeout(timer);
  read(invoke, reason);
  followUps = FOLLOW_UP_MS.map((ms) => setTimeout(() => read(invoke, reason), ms));
}
