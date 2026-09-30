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
  initialHref: string;
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
let listening = false;
/** Entries a closed overlay will pop on its deferred task and has not popped yet. */
let pendingConsumes = 0;
let workspaceHref: string | null = null;
const consumingEntries = new Set<StackEntry>();

/** Keep address edits made over a dialog when its history entry is removed. */
export function rememberOverlayUrlState(): void {
  if (!openStack.length && !pendingConsumes && !selfPops) return;
  workspaceHref = window.location.href;
  for (const entry of [...openStack, ...consumingEntries]) entry.pushedHref = workspaceHref;
}

function restoreWorkspaceHref(): void {
  if (!workspaceHref) return;
  const base = (href: string): string => {
    const url = new URL(href);
    return url.pathname + (url.hash.startsWith('#/') ? url.hash.split('?')[0] : '');
  };
  if (base(workspaceHref) !== base(window.location.href)) { workspaceHref = null; return; }
  window.history.replaceState(window.history.state, '', workspaceHref);
  window.dispatchEvent(new window.Event('lolly:url-state'));
}
/** Callers of historySettled(), waiting for this module's own traversals to finish. */
const settledWaiters = new Set<() => void>();
/** Callers of overlaysClosed(), waiting for every overlay to close as well. */
const closedWaiters = new Set<() => void>();

function notifySettled(): void {
  if (pendingConsumes || selfPops) return;
  for (const resolve of [...settledWaiters]) resolve();
  if (openStack.length) return;
  workspaceHref = null;
  for (const resolve of [...closedWaiters]) { closedWaiters.delete(resolve); resolve(); }
}

/**
 * Resolves once no overlay is open and every entry they pushed has been popped, so
 * the current entry is the view's own again. For state a view keeps on its entry
 * (the unsaved-edits mark, plan 277 P1): a write made while a dialog is open goes
 * to the dialog's same-URL copy, which Back then pops, so the view writes again
 * here. No timeout: it resolves when the overlay closes, however long that takes.
 */
export function overlaysClosed(): Promise<void> {
  if (!openStack.length && !pendingConsumes && !selfPops) return Promise.resolve();
  return new Promise(resolve => { closedWaiters.add(resolve); });
}

/**
 * Resolves once every entry a closed overlay owed has been popped and its popstate
 * has arrived, so the current entry is the view's own again. A flow that closes a
 * dialog and then rewrites or leaves the entry underneath waits here first: until
 * the pop arrives, the current entry is still the dialog's same-URL copy, and a
 * navigation from there strands the view's real entry behind it, which costs the
 * next Back or Home press (Leave without saving, plan 277 P1). `timeoutMs` caps
 * the wait for a traversal the browser never reports.
 */
export function historySettled(timeoutMs = 500): Promise<void> {
  if (!pendingConsumes && !selfPops) return Promise.resolve();
  return new Promise(resolve => {
    const done = (): void => { clearTimeout(timer); settledWaiters.delete(done); resolve(); };
    const timer = setTimeout(done, timeoutMs);
    settledWaiters.add(done);
  });
}

/** A final dialog's deferred back() still needs its popstate accounted for,
 * even while no overlay is open. Otherwise the next real Back is swallowed. */
function syncListeners(): void {
  const needed = openStack.length > 0 || selfPops > 0;
  if (needed === listening) return;
  listening = needed;
  NAV_EVENTS.forEach(ev => {
    if (needed) window.addEventListener(ev, onNavEvent);
    else window.removeEventListener(ev, onNavEvent);
  });
}

const onNavEvent = (e: Event): void => {
  if (e.type === 'popstate') {
    const entry = openStack[openStack.length - 1];
    if (!selfPops && entry && window.location.href !== entry.initialHref) {
      workspaceHref = null;
      [...openStack].forEach(o => o.record.nav());
      return;
    }
    restoreWorkspaceHref();
    if (selfPops) { selfPops -= 1; syncListeners(); notifySettled(); return; }
    // One Back, the innermost overlay - the rule everywhere else in the shell. The
    // entry it popped was that overlay's own, so the URL is unchanged and main.ts's
    // navigate() resolves the same route signature and returns without re-mounting.
    openStack[openStack.length - 1]?.record.pop();
    return;
  }
  workspaceHref = null;
  // hashchange / lolly:navigate: the view underneath is being replaced, so every
  // body-mounted overlay goes with it. Snapshot the stack - each close splices
  // itself out of it, and a caller's onClose may open an overlay of its own.
  [...openStack].forEach(o => o.record.nav());
};

/** Pop the entry this overlay pushed, so the next Back leaves the view rather than
 *  doing nothing. Deferred one task so promise continuations from onClose can navigate
 *  after closing (welcome-dialog sets '#/start', pickers call navigateTo): by then
 *  the URL has moved, and the href check leaves our entry alone instead of racing a
 *  traversal against that navigation. */
function consume(entry: StackEntry): void {
  entry.owed = false;
  pendingConsumes += 1;
  consumingEntries.add(entry);
  setTimeout(() => {
    consumingEntries.delete(entry);
    pendingConsumes -= 1;
    if (entry.seq < depth || location.href !== entry.pushedHref) { notifySettled(); return; }
    depth -= 1;
    selfPops += 1;
    syncListeners();
    try { history.back(); } catch { selfPops -= 1; syncListeners(); }
    notifySettled();
  });
}

/** Push a history entry for Back to consume and put `record` on top of the overlay
 *  stack. Call it as the overlay opens: stack order IS open order, which is what
 *  makes Back close the innermost one. */
export function registerOverlay(record: OverlayRecord): OverlayEntry {
  const entry: StackEntry = { record, owed: false, seq: 0, pushedHref: '', initialHref: window.location.href };
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
  syncListeners();

  let live = true;
  return {
    disown: () => { if (entry.owed) { entry.owed = false; depth -= 1; } },
    release: () => {
      if (!live) return;
      live = false;
      const i = openStack.indexOf(entry);
      if (i >= 0) openStack.splice(i, 1);
      syncListeners();
      if (entry.owed) consume(entry);
      else notifySettled();
    },
  };
}
