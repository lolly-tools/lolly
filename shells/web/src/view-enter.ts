// SPDX-License-Identifier: MPL-2.0
/**
 * View-entrance cascade arming (platform & capabilities dashboards).
 *
 * The read-only dashboards reveal their top-level nodes — the "Tools" back-link,
 * the header band, then each section — as ONE staggered wave, so the page reads
 * as a single settle instead of the header snapping in while the cards cascade
 * underneath it. The CSS (app.css, gated behind
 * `@media (prefers-reduced-motion: no-preference)`) owns the animation; this
 * only ARMS it: add `.is-entering` to the view and an inline `--enter-i` ordinal
 * to each node, then remove both once the wave has finished so it never replays
 * when the user later expands a <details> section.
 *
 * MUST be called synchronously right after the view's innerHTML is assigned (no
 * await in between): the browser paints after the current task, so as long as
 * `.is-entering` is set in the same task the FIRST paint already carries the
 * hidden `from` state — there's no frame where the nodes flash in at full
 * opacity before jumping to 0.
 */

const STEP_MS = 50;  // matches the 0.05s ladder step in app.css
const DUR_MS = 320;  // matches --enter-dur (0.32s)

// DOM order from this selector is back-link → header → sections, which is the
// reveal order we want (querySelectorAll returns document order).
const ENTER_NODES = '.tools-home, .plat-header, .plat-section';

/** The wave's teardown timer rides on the view element itself, so a remount of
 *  the same element (fast view switching) can find and cancel it. */
type EnterHost = HTMLElement & { _enterTimer?: ReturnType<typeof setTimeout> | 0 };

export function armViewEnter(viewEl: EnterHost, selector: string = ENTER_NODES): void {
  // Reduced motion: leave the view un-armed. Because the hidden `from` state and
  // the animation only exist under `.is-entering`, content simply renders
  // instantly — no animation-delay survives to hold a node invisible.
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  // Cancel a still-running wave from a previous mount (fast view switching) so its
  // teardown timer can't strip `.is-entering` out from under the new cascade.
  if (viewEl._enterTimer) clearTimeout(viewEl._enterTimer);

  const nodes = [...viewEl.querySelectorAll(selector)].filter(n => n instanceof HTMLElement);
  if (!nodes.length) { viewEl._enterTimer = 0; return; }

  nodes.forEach((n, i) => n.style.setProperty('--enter-i', String(i)));
  viewEl.classList.add('is-entering');

  // Longest delay + duration, plus generous slack. The timer runs on wall-clock
  // from now, but the animations start at the first PAINT — so the slack must
  // absorb any arm→paint gap, else removing `.is-entering` early clips the last
  // node's fade. Erring long is harmless: once the wave finishes, `both` holds
  // every node at its end state, and `.is-entering` lingering changes nothing.
  const last = (nodes.length - 1) * STEP_MS + DUR_MS + 250;
  viewEl._enterTimer = setTimeout(() => {
    viewEl.classList.remove('is-entering');
    nodes.forEach((n) => n.style.removeProperty('--enter-i'));
    viewEl._enterTimer = 0;
  }, last);
}
