// SPDX-License-Identifier: MPL-2.0
/**
 * Accessibility helpers shared across the web shell.
 *
 * announce(message): push a message to a screen reader without any visual
 * change — for transient status that has no persistent on-screen home (a toast,
 * a "Copied!", a route change). Backed by a single visually-hidden live region
 * per politeness level, created on first use.
 *
 * NOTE: /pro is deliberately isolated (imports only engine/host/its own
 * siblings), so it does NOT import this — it owns a tiny local equivalent.
 */
let _polite = null;
let _assertive = null;

function region(assertive) {
  let el = assertive ? _assertive : _polite;
  if (el) return el;
  el = document.createElement('div');
  el.className = 'visually-hidden';
  el.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
  el.setAttribute('aria-atomic', 'true');
  document.body.appendChild(el);
  if (assertive) _assertive = el; else _polite = el;
  return el;
}

/**
 * Announce `message` to assistive tech. Clearing then setting on the next frame
 * guarantees repeats (e.g. tapping "Copy" twice) are re-announced.
 * @param {string} message
 * @param {{assertive?: boolean}} [opts]  assertive interrupts; default polite.
 */
export function announce(message, { assertive = false } = {}) {
  if (!message) return;
  const el = region(assertive);
  el.textContent = '';
  requestAnimationFrame(() => { el.textContent = message; });
}
