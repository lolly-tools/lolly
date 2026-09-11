// SPDX-License-Identifier: MPL-2.0
/**
 * The one system-Back stack for body-mounted overlays: the native `<dialog>`s
 * mountModal owns (components/modal.ts) and the anchored popovers mountBodyPopover
 * owns (components/body-popover.ts).
 *
 * Both kinds mount outside the router's `#view`, which is the only thing a route
 * change replaces, so system Back (Android's key, iOS's edge swipe, the browser
 * button) would navigate the view out from under them instead of closing them.
 * Registering does two things about that: it pushes one same-URL history entry for
 * Back to consume, and it puts the overlay on a single stack. One stack for both
 * kinds is what makes one Back press close the INNERMOST overlay whatever it is - a
 * menu opened over a dialog closes first, the next press closes the dialog - because
 * stack order is open order.
 *
 * The same stack carries the route-change teardown (NAV_EVENTS), so an overlay
 * cannot be stranded in the top layer over the next view.
 *
 * Registering is the caller's choice, not a rule: an overlay that cannot afford an
 * entry per open registers nothing and keeps whatever close-on-nav-away it already
 * had (see mountBodyPopover's pointer gate).
 */
import { NAV_EVENTS } from '../utils.ts';

/** The two ways this module closes an overlay it holds. */
export interface OverlayRecord {
  /** The route changed under this overlay: tear it down (no user choice was made). */
  nav(): void;
  /** Back popped this overlay's own history entry: dismiss it. */
  pop(): void;
}

export interface OverlayEntry {
  /** Give up the pushed entry without popping it: Back already did (`pop`), or a
   *  navigation pushed its own entry on top of ours (`nav`), and popping then would
   *  undo the navigation the user just made. */
  disown(): void;
  /** Leave the stack, popping the entry this overlay pushed unless it was disowned.
   *  Idempotent, so two close paths racing (Back and an outside click) consume one
   *  entry between them. */
  release(): void;
}

interface StackEntry {
  record: OverlayRecord;
  /** The pushed entry is still ours to pop. */
  owed: boolean;
  /** This entry's position in `depth` at push time. */
  seq: number;
  /** The URL the entry was pushed at. */
  pushedHref: string;
}

/** One record per registered overlay, innermost last. */
const openStack: StackEntry[] = [];

/**
 * Count of history entries this module has pushed and not yet popped. `history.back()`
 * can only consume the NEWEST entry, so an overlay only consumes its own when nothing
 * has pushed on top of it (`seq < depth`); otherwise the entry is left stranded,
 * which costs one Back press that does nothing but can never navigate wrongly.
 * Only the comparison against the newest matters, so a stranded entry inflating
 * this is harmless.
 */
let depth = 0;
/** Entry-consuming `history.back()` calls whose popstate hasn't arrived yet. Those
 *  pops are bookkeeping, not Back presses, so no overlay closes on them - and it's a
 *  count, not a flag: two stacked overlays closed in one tick pop two entries, and
 *  the second popstate can arrive after a NEW overlay has opened. */
let selfPops = 0;

const onNavEvent = (e: Event): void => {
  if (e.type === 'popstate') {
    if (selfPops) { selfPops -= 1; return; }
    // One Back, the innermost overlay - the rule everywhere else in the shell. The
    // entry it popped was that overlay's own, so the URL is unchanged and main.ts's
    // navigate() resolves the same route signature and returns without re-mounting.
    openStack[openStack.length - 1]?.record.pop();
    return;
  }
  // hashchange / lolly:navigate: the view underneath is being replaced, so every
  // body-mounted overlay goes with it. Snapshot the stack - each close splices
  // itself out of it, and a caller's onClose may open an overlay of its own.
  [...openStack].forEach(o => o.record.nav());
};

/** Pop the entry this overlay pushed, so the next Back leaves the view rather than
 *  doing nothing. Deferred one microtask because a caller routinely navigates right
 *  after closing (welcome-dialog sets '#/start', pickers call navigateTo): by then
 *  the URL has moved, and the href check leaves our entry alone instead of racing a
 *  traversal against that navigation. */
function consume(entry: StackEntry): void {
  entry.owed = false;
  queueMicrotask(() => {
    if (entry.seq < depth || location.href !== entry.pushedHref) return;
    depth -= 1;
    selfPops += 1;
    try { history.back(); } catch { selfPops -= 1; }
  });
}

/** Push a history entry for Back to consume and put `record` on top of the overlay
 *  stack. Call it as the overlay opens: stack order IS open order, which is what
 *  makes Back close the innermost one. */
export function registerOverlay(record: OverlayRecord): OverlayEntry {
  const entry: StackEntry = { record, owed: false, seq: 0, pushedHref: '' };
  // Same URL, so this fires neither hashchange nor popstate and no route work runs;
  // it exists purely as something for Back to consume. Blocked (a sandboxed iframe,
  // a rate limit) is survivable: Back then reaches the route, and the popstate branch
  // above still closes the overlay rather than stranding it.
  try {
    history.pushState(history.state, '', location.href);
    depth += 1;
    entry.seq = depth;
    entry.owed = true;
    entry.pushedHref = location.href;
  } catch { /* history unavailable */ }
  openStack.push(entry);
  if (openStack.length === 1) NAV_EVENTS.forEach(ev => window.addEventListener(ev, onNavEvent));

  let live = true;
  return {
    disown: () => { if (entry.owed) { entry.owed = false; depth -= 1; } },
    release: () => {
      if (!live) return;
      live = false;
      const i = openStack.indexOf(entry);
      if (i >= 0) openStack.splice(i, 1);
      if (!openStack.length) NAV_EVENTS.forEach(ev => window.removeEventListener(ev, onNavEvent));
      if (entry.owed) consume(entry);
    },
  };
}
