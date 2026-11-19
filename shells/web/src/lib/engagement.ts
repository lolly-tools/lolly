// SPDX-License-Identifier: MPL-2.0
/**
 * Has this person started to work here, or only looked in?
 *
 * Some work is worth doing for a person who is using the app and is waste for one who
 * opened a page and left: the clearest case is a file fetched now so that it is there
 * later with no network. `whenEngaged` runs such work once the person has changed
 * something, or has stayed for a while with the page in view. The answer is kept for
 * the rest of the visit, so later callers run after a short idle wait.
 *
 * This reads no content and stores nothing: one `input` or `change` event from any
 * control, or a timer.
 */

/** How long a person stays before a look counts as use. */
export const ENGAGED_AFTER_MS = 30_000;

let engaged = false;
let armed = false;
const waiting: (() => void)[] = [];

function settle(): void {
  if (engaged) return;
  engaged = true;
  for (const run of waiting.splice(0)) run();
}

function arm(stayMs: number): void {
  if (armed || typeof document === 'undefined') return;
  armed = true;
  const edited = (): void => {
    document.removeEventListener('input', edited, true);
    document.removeEventListener('change', edited, true);
    settle();
  };
  document.addEventListener('input', edited, { capture: true, passive: true });
  document.addEventListener('change', edited, { capture: true, passive: true });
  // The stay counts only with the page in view: a tab left open in the background is
  // not a person at work.
  const stayed = (): void => {
    if (engaged) return;
    if (document.visibilityState === 'hidden') {
      document.addEventListener('visibilitychange', () => setTimeout(stayed, stayMs), { once: true });
      return;
    }
    edited();
  };
  setTimeout(stayed, stayMs);
}

/** Run `run` once the person has changed something or stayed `stayMs` with the page in view. */
export function whenEngaged(run: () => void, stayMs: number = ENGAGED_AFTER_MS): void {
  if (engaged) {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 5000 });
    else setTimeout(run, 0);
    return;
  }
  waiting.push(run);
  arm(stayMs);
}

/** True once this visit counts as use. */
export function isEngaged(): boolean { return engaged; }

/** A test starts each case as a fresh visit. */
export function resetEngagementForTest(): void {
  engaged = false;
  armed = false;
  waiting.length = 0;
}
