// SPDX-License-Identifier: MPL-2.0
/**
 * The first-run prompts: the surfaces that ask a person something on an early visit.
 * They are the welcome dialog, the gallery's one banner (the privacy notice, "Add your
 * details to what you make?" or the offline nudge), the desktop models sheet and a
 * tool's guide. A notice that can wait, such as the automatic Performance UI switch
 * (lib/perf-ui-auto.ts), holds back while one of them is on screen, so a person is
 * never asked two things at once.
 *
 * Read from the page itself: a prompt counts for exactly as long as it is showing, and
 * answering or dismissing one (each removes or closes its element) frees the slot. The
 * gallery renders its banner hidden and decides a moment later whether to reveal it, so
 * it marks the banner pending until it has decided (holdFirstRunBanner and
 * settleFirstRunBanner). A waiting notice treats a pending banner like a showing one, so
 * it cannot slip in just before the banner appears.
 *
 * This file imports nothing, so the gallery and the lazy Performance UI chunk can both
 * read the file without pulling anything else in.
 */

/** Set on the gallery's hidden banner until the gallery has decided whether to show the banner. */
export const FIRST_RUN_PENDING_ATTR = 'data-first-run-pending';

/** A first-run prompt that is on screen now. */
const SHOWING = [
  '.privacy-notice:not([hidden])',
  // The personalise nudge, and the offline nudge, which shares its class.
  '.personalize-nudge:not([hidden])',
  'dialog[open]:is(.welcome-dialog, .models-welcome, .tool-guide-dialog)',
  // The first-visit greeting in place at the top of the gallery (components/welcome-hero.ts).
  '.welcome-hero',
].join(', ');

/** A first-run prompt on screen, or the gallery's banner while it waits to be shown. */
const DUE = `${SHOWING}, [${FIRST_RUN_PENDING_ATTR}]`;

/** Is a first-run prompt on screen? */
export function firstRunPromptShowing(doc: Document = document): boolean {
  return doc.querySelector(SHOWING) !== null;
}

/** Is a first-run prompt on screen, or about to be? */
export function firstRunPromptDue(doc: Document = document): boolean {
  return doc.querySelector(DUE) !== null;
}

/** The gallery's banner, hidden and marked pending until the gallery decides. */
export function holdFirstRunBanner(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  el.hidden = true;
  el.setAttribute(FIRST_RUN_PENDING_ATTR, '');
  return el;
}

/** The gallery has decided: the banner is either showing now or stays hidden. */
export function settleFirstRunBanner(el: HTMLElement | null | undefined): void {
  el?.removeAttribute(FIRST_RUN_PENDING_ATTR);
}

/**
 * Call `then` once `ready()` is true, checking now and again whenever the page changes
 * in a way that could open or close a prompt (an element added or removed, `hidden` or
 * `open` flipped, the pending mark cleared) or the tab's visibility changes. Returns a
 * cancel function. Watches only while waiting, so nothing runs once `then` has.
 */
export function whenFirstRunPrompts(ready: () => boolean, then: () => void): () => void {
  if (ready()) { then(); return () => {}; }
  let done = false;
  const observer = new MutationObserver(() => { check(); });
  const stop = (): void => {
    done = true;
    observer.disconnect();
    document.removeEventListener('visibilitychange', check);
  };
  function check(): void {
    if (done || !ready()) return;
    stop();
    then();
  }
  observer.observe(document.documentElement, {
    subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'open', FIRST_RUN_PENDING_ATTR],
  });
  document.addEventListener('visibilitychange', check);
  return stop;
}
