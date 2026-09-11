// SPDX-License-Identifier: MPL-2.0
/**
 * Shared shell for a body-mounted anchored popover - the machinery lang-menu.ts
 * and profile-menu.ts used to hand-roll twice: mount a `<div>` on `document.body`,
 * position it off the trigger's rect, trap focus inside it, and tear it down on
 * Escape, an outside pointerdown, a window resize, or a route change (any of
 * NAV_EVENTS - the popover lives outside the view tree, so a hash/route change
 * would otherwise orphan it).
 *
 * `render(el, popover)` builds the popover's own content fresh on every open
 * (item lists, current-value checks, etc. can change between opens) and wires
 * whatever internal listeners it needs (item clicks, roving-tabindex arrow keys);
 * it returns the element that should receive initial focus, or null/undefined to
 * leave focus where it is. The shell only owns the generic lifecycle - callers
 * keep deciding what the trigger's own click handler does (profile-menu, e.g.,
 * only intercepts the click at a mobile breakpoint).
 *
 * inertBackground is always off: the trigger that opens one of these anchored
 * dropdowns lives in the same branch `trapFocus` would otherwise inert (see its
 * module doc), which would kill the trigger's own re-click-to-close affordance.
 *
 * The anchor need not be a real trigger element: `PopoverAnchor` is the minimal
 * shape `position()`/the outside-click check actually use, so a context menu that
 * opens at a pointer position (a right-click, a kebab button's corner) can pass a
 * `pointAnchor()` instead of forking this whole lifecycle - see projects.ts's and
 * folder-overlay.ts's tile context menus. `container` (default `document.body`)
 * lets a popover opened from WITHIN a native `<dialog open>` mount inside that
 * dialog instead - required for it to paint above the dialog's own `::backdrop`
 * (only the top-layer dialog's own subtree renders above its backdrop).
 *
 * On a touch device an open popover also takes system Back, via the shared overlay
 * stack (lib/overlay-back.ts) that mountModal registers on too: one press closes the
 * innermost overlay, so a menu opened over a dialog closes and the dialog stays. See
 * the pointer gate in `open()` for why a fine-pointer desktop pushes no entry.
 */
import { trapFocus, type FocusTrap } from '../lib/focus-trap.ts';
import { registerOverlay, type OverlayEntry } from '../lib/overlay-back.ts';
import { NAV_EVENTS } from '../utils.ts';

export interface BodyPopoverHandle {
  open(): void;
  close(returnFocus?: boolean): void;
  isOpen(): boolean;
}

/** The minimal shape mountBodyPopover needs from whatever it's anchored to. A real
 *  HTMLElement satisfies this as-is; `pointAnchor()` below builds a virtual one for
 *  popovers with no real trigger element (a right-click, a computed point). `focus`/
 *  `setAttribute` are optional - a virtual anchor has no aria-expanded to toggle and
 *  no element worth returning focus to. */
export interface PopoverAnchor {
  getBoundingClientRect(): { top: number; left: number; right: number; bottom: number; width: number; height: number };
  contains(node: Node | null): boolean;
  focus?(): void;
  setAttribute?(name: string, value: string): void;
}

/** A virtual anchor at a viewport point (a right-click, a kebab button's computed
 *  corner) rather than a live element - mutate `.x`/`.y` before each `open()` to
 *  reposition it. `contains()` always reports false: nothing IS the point, so the
 *  outside-click check never carves out an exception for it.
 *  When the point comes FROM a real control (a kebab button that's recreated every
 *  render, so it can't be the anchor itself), set `.delegate` to it before `open()`:
 *  the point keeps supplying geometry while the delegate receives the focus restore
 *  on close and the aria-expanded toggling a keyboard user needs. Leave it null for
 *  true pointer opens (a right-click has nothing to focus back to). */
export interface PointAnchor extends PopoverAnchor { x: number; y: number; delegate: HTMLElement | null; }
export function pointAnchor(x = 0, y = 0): PointAnchor {
  return {
    x, y,
    delegate: null,
    getBoundingClientRect() { return { top: this.y, left: this.x, right: this.x, bottom: this.y, width: 0, height: 0 }; },
    contains: () => false,
    focus() { this.delegate?.focus(); },
    setAttribute(name: string, value: string) { this.delegate?.setAttribute(name, value); },
  };
}

export interface BodyPopoverOptions {
  /** Class applied to the mounted `<div>`. */
  className: string;
  /** Default 'menu'. */
  role?: string;
  ariaLabel?: string;
  /** Where the popover `<div>` is appended. Default `document.body`. Pass the host
   *  `<dialog>` when opening this from inside one (see the module doc). */
  container?: HTMLElement;
  /** Reposition the popover relative to the anchor; called on open and again on
   *  every window resize unless `onResize` is given. Default: right-aligned,
   *  dropped 8px below the anchor's bottom edge (matches the old profile-menu),
   *  flipping above the anchor and then clamping in rather than overflowing the
   *  viewport bottom - see `defaultPosition`. */
  position?(el: HTMLDivElement, anchor: PopoverAnchor): void;
  /** Called on window resize INSTEAD OF re-running `position()` - e.g. to close
   *  the popover outright when a responsive breakpoint no longer applies. */
  onResize?(popover: BodyPopoverHandle): void;
  /** Follow a scrolling trigger; scrolling within the panel leaves it in place. */
  trackScroll?: boolean;
  /** Called AFTER a close that actually closed something, whichever route took it:
   *  the caller's own `close()`, Escape, an outside pointerdown, or a route change.
   *  For a caller whose content is not owned by the popover - the timeline inspector
   *  moves a LIVE element into it and must move it back before `close()` detaches the
   *  whole popover with that element still inside. Never call `close()` from here. */
  onClose?(): void;
  /**
   * "Is this node logically part of me?" - the escape hatch for a popover that SPAWNS
   * popovers of its own on `document.body`.
   *
   * The dismissal test is `!menu.contains(target) && !anchor.contains(target)`, and a
   * child popover is a sibling `<div>` on the body: `contains()` says false, so the
   * FIRST pointerdown inside the child (a bezier handle, a preset button) reads as an
   * outside click and closes the parent under the user's hands - taking any live
   * element the parent had borrowed with it. A `pointAnchor` cannot cover this either:
   * its `contains()` is hard-wired to false by design.
   *
   * Also consulted on Escape, against `document.activeElement`: with focus trapped
   * inside the child, Escape belongs to the CHILD, and both popovers listen on
   * `document` (stopPropagation cannot stop a sibling listener on the same node), so
   * without this the parent closes underneath it and its focus restore lands on a node
   * the parent has just hidden. One Escape, the innermost popover - which is the rule
   * everywhere else in the shell.
   *
   * Optional and absent by default, so every existing caller is unchanged.
   */
  isInside?(node: Node | null): boolean;
}

/** Right-aligned and dropped below the anchor, FLIPPED above it when the drop would
 *  run off the bottom of the viewport (a kebab menu on a tile in the lower half of a
 *  phone screen), and clamped in when neither side fits (a panel taller than the
 *  viewport). `open()` appends before calling this, so `offsetWidth/Height` are the
 *  real laid-out box; the panel is position:fixed and `container` is body-level (or a
 *  native `<dialog>`, itself untransformed), so its containing block IS the viewport
 *  and viewport coordinates need no correction - same reasoning as
 *  lib/context-menu.ts's clampedPosition.
 *  window.innerWidth/Height rather than visualViewport: the shell's pinch-zoom
 *  re-pin is CSS-only (the --vv-* vars main.ts publishes), and every other clamp in
 *  the shell reads the layout viewport. A zero measurement means the panel isn't laid
 *  out yet, so there is nothing to reason from and the plain drop stands. */
function defaultPosition(el: HTMLDivElement, anchor: PopoverAnchor): void {
  const r = anchor.getBoundingClientRect();
  const M = 8;
  const vw = window.innerWidth, vh = window.innerHeight;
  const pw = el.offsetWidth, ph = el.offsetHeight;
  let top = r.bottom + M;
  if (ph > 0 && top + ph > vh - M) {
    const above = r.top - ph - M;
    top = above >= M ? above : Math.max(M, vh - ph - M);
  }
  // Horizontal clamp rides the `right` inset (the alignment 13 callers rely on):
  // hold the panel's own left edge at >= M, and pin flush right when it is wider
  // than the viewport can hold.
  const right = Math.max(M, Math.min(vw - r.right, vw - pw - M));
  el.style.top = `${Math.round(top)}px`;
  el.style.right = `${Math.round(right)}px`;
}

/** Options for `wireDisclosure` - the in-place sibling of mountBodyPopover below. */
export interface DisclosureOptions {
  /** Optional scrim element (the gallery's `.filter-backdrop`) - un/hidden with the
   *  popover and, when present, dismisses it on click. CSS decides whether it paints
   *  (the gallery shows it on mobile only); this module only drives `hidden`. */
  backdrop?: HTMLElement | null;
  /** Element to focus when the popover opens, resolved fresh on every open (the
   *  content can be rebuilt between opens). Return null/undefined to leave focus put. */
  initialFocus?(popover: HTMLElement): HTMLElement | null | undefined;
  /** Notified after every state change - for a caller that mirrors the open state into
   *  its own render (the catalog re-renders its topbar with the popover still open). */
  onToggle?(open: boolean): void;
}

export interface DisclosureHandle {
  open(): void;
  close(returnFocus?: boolean): void;
  toggle(): void;
  isOpen(): boolean;
}

/**
 * The in-place disclosure lifecycle: a `.filter-fab`-style trigger revealing a popover
 * that is ALREADY in the view's markup (so it re-renders with the view and needs no
 * repositioning), with outside-pointerdown dismissal, Escape, `aria-expanded` upkeep,
 * focus restore to the trigger, and an optional backdrop.
 *
 * mountBodyPopover (below) owns the same lifecycle for popovers this module MINTS and
 * positions on `document.body`; splitting the in-place case out keeps that one's mount +
 * position + focus-trap contract intact rather than growing a second mode through it.
 * The gallery's filter popover and the catalog's view-options popover were the two
 * hand-rolled copies; where they had drifted this keeps:
 *   - NON-capturing outside-pointerdown, deferred a tick (gallery's) - capture-phase
 *     document listeners pre-empt the page's own handlers for no benefit here, and the
 *     deferral is the same guard mountBodyPopover uses against self-dismissal.
 *   - Escape on `document` (catalog's) - it closes the popover from anywhere on the page,
 *     not only when focus already sits inside it, and it is `hidden`-guarded so it is
 *     inert while closed. stopPropagation keeps a host view from also acting on it.
 *   - Escape restores focus to the trigger (gallery's) - the catalog silently dropped it.
 */
export function wireDisclosure(
  fab: HTMLElement | null,
  pop: HTMLElement | null,
  opts: DisclosureOptions = {},
): DisclosureHandle {
  let outside: ((e: PointerEvent) => void) | null = null;

  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape' || !pop || pop.hidden) return;
    e.stopPropagation();
    close(true);
  };

  function bind(): void {
    const handler = (e: PointerEvent): void => {
      const target = e.target as Node;
      if (pop && !pop.contains(target) && !fab?.contains(target)) close();
    };
    outside = handler;
    // Deferred so the opening click's own pointerdown doesn't immediately close it.
    setTimeout(() => { if (outside === handler) document.addEventListener('pointerdown', handler); }, 0);
    document.addEventListener('keydown', onKey);
  }

  function unbind(): void {
    if (outside) { document.removeEventListener('pointerdown', outside); outside = null; }
    document.removeEventListener('keydown', onKey);
  }

  function open(): void {
    if (!pop || !pop.hidden) return;
    pop.hidden = false;
    if (opts.backdrop) opts.backdrop.hidden = false;
    fab?.setAttribute('aria-expanded', 'true');
    opts.initialFocus?.(pop)?.focus();
    bind();
    opts.onToggle?.(true);
  }

  function close(returnFocus = false): void {
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    if (opts.backdrop) opts.backdrop.hidden = true;
    fab?.setAttribute('aria-expanded', 'false');
    unbind();
    opts.onToggle?.(false);
    if (returnFocus) fab?.focus();
  }

  const toggle = (): void => { if (pop) pop.hidden ? open() : close(); };

  fab?.addEventListener('click', toggle);
  opts.backdrop?.addEventListener('click', () => close());
  // Rendered already-open (a view that re-renders its chrome while the popover is up):
  // adopt that state so the dismissal listeners exist without a first toggle.
  if (pop && !pop.hidden) bind();

  return { open, close, toggle, isOpen: () => !!pop && !pop.hidden };
}

export function mountBodyPopover(
  anchor: PopoverAnchor,
  render: (el: HTMLDivElement, popover: BodyPopoverHandle) => HTMLElement | null | void,
  opts: BodyPopoverOptions,
): BodyPopoverHandle {
  const position = opts.position ?? defaultPosition;
  const container = opts.container ?? document.body;
  let menu: HTMLDivElement | null = null;
  let outside: ((e: PointerEvent) => void) | null = null;
  let trap: FocusTrap | null = null;
  /** This popover's place on the shared Back stack while it is open, or null when it
   *  pushed no history entry (see the pointer gate in `open()`). */
  let back: OverlayEntry | null = null;

  const reposition = (): void => { if (menu) position(menu, anchor); };
  const onResizeEvt = (): void => { opts.onResize ? opts.onResize(handle) : reposition(); };
  const onScroll = (event: Event): void => {
    if (menu && !(event.target instanceof Node && menu.contains(event.target))) reposition();
  };
  // preventDefault (not just stopPropagation) so an ancestor native <dialog> showing
  // modally - e.g. folder-overlay's, which a context menu can mount inside via
  // `container` - doesn't ALSO process this Escape as its own close request and
  // cascade-close behind us; only the popover should close.
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    // A popover this one spawned owns the Escape while focus is inside it (see
    // `isInside`). Returning WITHOUT preventDefault/stopPropagation leaves the child's
    // own listener - registered later on the same node - to handle it.
    if (opts.isInside?.(document.activeElement)) return;
    e.preventDefault();
    e.stopPropagation();
    close(true);
  };
  // System Back and a route change are the same dismissal here: a popover has no
  // cancelValue, so either way it just closes. Disown first, because the pushed entry
  // must not be popped in either case - Back already consumed it, and a navigation
  // pushed its own entry on top of it. Reached twice on one event (the shared stack
  // and the NAV_EVENTS listener below both call it); close() is idempotent.
  const onNavAway = (): void => { back?.disown(); close(); };

  function close(returnFocus = false): void {
    if (!menu) return;
    back?.release();
    back = null;
    if (outside) document.removeEventListener('pointerdown', outside);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResizeEvt);
    if (opts.trackScroll) window.removeEventListener('scroll', onScroll, true);
    NAV_EVENTS.forEach(ev => window.removeEventListener(ev, onNavAway));
    outside = null;
    trap?.release();
    trap = null;
    // BEFORE the element is detached, so a caller that lent this popover a live
    // element of its own can take it back rather than lose it with the removal.
    opts.onClose?.();
    menu.remove();
    menu = null;
    anchor.setAttribute?.('aria-expanded', 'false');
    if (returnFocus) anchor.focus?.();
  }

  function open(): void {
    if (menu) return;
    const el = document.createElement('div');
    menu = el;
    el.className = opts.className;
    el.setAttribute('role', opts.role ?? 'menu');
    if (opts.ariaLabel) el.setAttribute('aria-label', opts.ariaLabel);
    const initialFocus = render(el, handle);
    container.appendChild(el);
    position(el, anchor);
    anchor.setAttribute?.('aria-expanded', 'true');

    outside = (e) => {
      const target = e.target as Node;
      if (menu && !menu.contains(target) && !anchor.contains(target) && !opts.isInside?.(target)) close();
    };
    // Deferred so the very click that opened the popover doesn't also fire as
    // its own outside-click dismissal.
    const listener = outside;
    setTimeout(() => { if (outside === listener) document.addEventListener('pointerdown', listener); }, 0);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResizeEvt);
    if (opts.trackScroll) window.addEventListener('scroll', onScroll, true);
    NAV_EVENTS.forEach(ev => window.addEventListener(ev, onNavAway));
    // Taking system Back costs one history entry per open. On a touch device that is
    // the trade to make: Back is how a user dismisses a menu, and without an entry the
    // press navigates the view out from under it. On a fine-pointer desktop these
    // menus open and close often enough (a kebab, a hover-ish dropdown) that an entry
    // each would fill the Back button with dismissals, so there the popover keeps
    // nav-away dismissal alone and pushes nothing. Read per open, not once per module:
    // a hybrid device switches pointer between opens.
    back = window.matchMedia?.('(pointer: coarse)').matches ? registerOverlay({ nav: onNavAway, pop: onNavAway }) : null;
    // A link inside the popover navigates as its DEFAULT action, after this click
    // event finishes - but item handlers close() during it, and close's release()
    // queues an async pop that then settles on the entry the navigation is about to
    // push, bouncing the user straight back out of the destination (found via the
    // profile menu's Settings row on iPhone, 2026-08-23). Disown first, exactly
    // like the nav-away path: this click IS a navigation the history just hasn't
    // seen yet. Capture phase, so it precedes the item handlers' close(). A link
    // whose handler preventDefaults costs at worst one stray Back entry - benign
    // next to popping the user out of a view they just opened.
    el.addEventListener('click', (e) => {
      if ((e.target as Element).closest?.('a[href]')) back?.disown();
    }, true);
    trap = trapFocus(el, { initialFocus: initialFocus ?? null, inertBackground: false });
  }

  const handle: BodyPopoverHandle = { open, close, isOpen: () => menu !== null };
  return handle;
}
