// SPDX-License-Identifier: MPL-2.0
/** `?iframe`: show only a tool's rendered output, and keep nothing (plan 288 M1).
 *
 * A presence flag (engine RESERVED) for a Lolly tool shown inside another page: a
 * Design slide running a Sandbox demo, the docs "Try it" frame, a second screen, a
 * kiosk. It removes every piece of the shell's chrome and makes the instance
 * ephemeral: no saved session, no history entry, no metrics, no sounds, no address-bar
 * rewrites, and no reads of the Projects markers a same-origin frame shares with its
 * parent tab's sessionStorage.
 *
 * It is read ONCE, from the URL the document booted with, because the address-bar
 * sync strips flags after the first render and a frame never navigates to another
 * route. The flag is also stamped on <html> as `data-lolly-iframe` (by the pre-paint
 * script in index.html and again by `applyIframeModeAttr`), the one signal CSS and a
 * tool's own template read. The flag may ride beside a packed `z` link, in readable
 * form, like `full`. */

import { attachPresentReceiver } from '../../../../packages/core/src/present-receiver.ts';
import { isTrustedSender } from './message-sender.ts';

let memo: boolean | undefined;

/** Whether a URL carries the flag, in its query or in its hash route's query. */
export function iframeModeFromUrl(href: string): boolean {
  let url: URL;
  try { url = new URL(href, 'https://x.invalid/'); } catch { return false; }
  if (url.searchParams.has('iframe')) return true;
  const q = url.hash.indexOf('?');
  return q >= 0 && new URLSearchParams(url.hash.slice(q + 1)).has('iframe');
}

export function isIframeMode(): boolean {
  if (memo === undefined) memo = typeof location !== 'undefined' && iframeModeFromUrl(location.href);
  return memo;
}

/** Stamp `data-lolly-iframe` on the document root when the flag is set. */
export function applyIframeModeAttr(root: Element | null = typeof document !== 'undefined' ? document.documentElement : null): void {
  if (root && isIframeMode()) root.setAttribute('data-lolly-iframe', '');
}

/**
 * A tool framed on a Design slide (plan 288) passes a clicker's two keys, PageUp and
 * PageDown, to the deck around it, so the presenter can move on while a demo has focus.
 * Arrows are left to the demo, which may need them. Only to a parent on this app's own
 * origin: a page that frames the app from elsewhere hears nothing. Returns the teardown.
 */
export function forwardDeckKeys(win: Window = window): () => void {
  if (win.parent === win) return () => {};
  let sameOrigin = false;
  try { sameOrigin = win.parent.location.origin === win.location.origin; } catch { sameOrigin = false; }
  if (!sameOrigin || !isTrustedSender({ origin: win.location.origin, source: win.parent }, win)) return () => {};
  const releaseReceiver = attachPresentReceiver(win, {
    allowedOrigins: [win.location.origin],
    shouldHandle: () => !win.document.querySelector('[data-rwc]')
      && !/^#\/tool\/sandbox(?:\?|$)/.test(win.location.hash)
      && !/^\/(?:t|tool)\/sandbox\/?$/.test(win.location.pathname),
    onLifecycle: (_kind, command) => {
      // The tool owns its reactions; this channel cannot change shell state.
      const Event = (win as Window & typeof globalThis).CustomEvent;
      win.document.dispatchEvent(new Event('lolly:present', { detail: command }));
    },
  });
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'PageDown' && e.key !== 'PageUp') return;
    const el = e.target as HTMLElement | null;
    if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    win.parent.postMessage({ type: 'lolly:deck-key', key: e.key }, win.location.origin);
  };
  win.addEventListener('keydown', onKey, true);
  return () => { releaseReceiver(); win.removeEventListener('keydown', onKey, true); };
}

/** Test seam: pin the answer, or pass nothing to read the URL again. */
export function setIframeModeForTest(value?: boolean): void {
  memo = value;
}
