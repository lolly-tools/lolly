// SPDX-License-Identifier: MPL-2.0
/**
 * Cross-view fade - hides the blank frame between one view being torn down and
 * the next being painted.
 *
 * The router (main.ts) swaps views by clearing #view and mounting the next view's
 * markup into it. That's fast - everything loads in well under a second - but fast
 * enough that the empty container still paints for a frame or two, reading as a
 * tiny blank flash on every navigation. This lifts the OUTGOING view's already-
 * rendered pixels into a snapshot layer pinned over the viewport, lets the incoming
 * view mount UNDERNEATH it at full opacity, then fades the snapshot out.
 *
 * The key property: because the incoming view sits underneath at full opacity,
 * anything IDENTICAL between the two views - the Tools|Projects|Catalog tab bar,
 * the language button, the profile link, the dashboard/verify back pill - 
 * stays rock-solid through the fade. The opaque new copy shows through the fading
 * old one pixel-for-pixel, so only what actually CHANGED cross-fades. Shared chrome
 * is held in place for free, with zero per-element wiring.
 *
 * Usage (main.ts): call {@link beginViewFade} with the #view element BEFORE its
 * scoping class flips or its markup is torn down - it MOVES the live nodes into the
 * overlay, leaving #view empty for the incoming mount. Then, once that mount has
 * written the new markup, call the returned handle's `commit()` to fade the
 * snapshot out. Reduced motion, an empty view, or first boot return null → the
 * caller falls back to today's instant swap.
 *
 * Opening a tool (plan 371, M2b) holds the snapshot ({@link ViewFadeOptions.hold}).
 * {@link afterNextPaint} first lets the pressed card paint. The held snapshot is a still
 * picture: moving the nodes restarted their CSS animations, so every animation in it
 * ends at once and transitions jump to their end (`.view-fade--hold`, parts/base.css).
 * After a short beat ({@link ViewFade.leaveAt}) its content leaves paint altogether,
 * all but the top bar, and the plain ground and the loading card stay until the tool's
 * first render is ready: drawing the gallery at all while a tool mounts was most of the
 * cost on a slow phone. The tool then comes in with a short fade. A Back during the
 * mount takes the snapshot back ({@link reclaimViewFade}). Reduced motion keeps the
 * immediate swap it always had: no snapshot, no wait, a still mark.
 */

import { prefersReducedMotion } from './lib/a11y-prefs.ts';

/** Handle returned by beginViewFade - call commit() once the new view has mounted. */
export interface ViewFade {
  /** Fade the outgoing snapshot out (or drop it instantly if superseded). Idempotent. */
  commit(): void;
  /**
   * At `at` (a performance.now() time; at once when it has passed) take the snapshot's
   * content out of paint, all but the view's top bar, and run `then`. A tool open uses
   * it to clear the screen to the plain ground and the loading card after a short beat.
   * A commit() before then cancels the wait.
   */
  leaveAt(at: number, then?: () => void): void;
}

export interface ViewFadeOptions {
  /**
   * Hold the snapshot still: end every animation and transition inside it at once, and
   * fade it out quickly (--dur-1, 120 ms, parts/base.css) when commit() runs. For a tool
   * open, where the incoming mount is long. Reduced motion makes no snapshot, held or
   * not: it keeps the immediate swap it always had.
   */
  hold?: boolean;
  /** The route signature of the view being left, so a Back to it can take the snapshot
   *  back while that view mounts again ({@link reclaimViewFade}). */
  source?: string;
}

/** The class that holds a snapshot still; parts/base.css owns what it does. */
export const VIEW_FADE_HOLD_CLASS = 'view-fade--hold';
/**
 * How long a tool open keeps the view it left on screen, from the start of the
 * navigation, so the pressed card is seen before the screen clears to the plain ground
 * and the loading card. The pressed frame itself is painted by afterNextPaint() before
 * the teardown, so this is how long the press stays in view, not a wait for paint.
 */
export const TOOL_OPEN_BEAT_MS = 100;
/** What leaveAt() takes out of paint (parts/base.css: display none). */
export const VIEW_FADE_GONE_CLASS = 'view-fade-gone';
/** The view's top bar (components/view-topbar.ts), which stays while the rest leaves. */
const TOP_BAR = '.gallery-topbar';

interface TaskScheduler { postTask(callback: () => void, options: { priority: 'user-blocking' }): unknown }

/**
 * Resolves once the browser has painted a frame. The router calls it before it tears
 * down the view a tool is opened from: the teardown and the snapshot can run in the
 * same task as the click, and on a slow phone they held the first frame back long
 * enough that the pressed card was never seen. The wait ends right after that frame:
 * as a user-blocking task where the browser has a scheduler, because an ordinary
 * timeout queued behind the gallery's own timers let a second frame through first on
 * the phone profile. Resolves at once on a hidden page (no frame comes), and after
 * 100 ms at the latest, so a page hidden mid-wait cannot stall a navigation.
 */
export function afterNextPaint(): Promise<void> {
  if (document.visibilityState === 'hidden') return Promise.resolve();
  return new Promise((resolve) => {
    const scheduler = (globalThis as { scheduler?: TaskScheduler }).scheduler;
    requestAnimationFrame(() => {
      if (typeof scheduler?.postTask === 'function') void scheduler.postTask(resolve, { priority: 'user-blocking' });
      else setTimeout(resolve, 0);
    });
    setTimeout(resolve, 100);
  });
}

/** Where a view put back by a Back has to stand: the snapshot's scroll offset, and an
 *  element (the pressed card, else the first card on screen) with its distance from the
 *  top of the screen. The anchor wins: what sits above the cards can differ between the
 *  snapshot and the view mounted again (a first-run welcome card that a route change
 *  took down comes back), which a plain offset gets wrong. */
export interface ViewPlace { scrollY: number; anchor?: { selector: string; top: number } }

/** The view's own selector for what it has not drawn yet (a card whose preview is still
 *  coming), set on the view element; the gallery sets one. */
export const SETTLE_PENDING_ATTR = 'data-settle-pending';

/**
 * Resolves once a view mounted again under a reclaimed snapshot looks like the
 * snapshot: the window stands at `place` (set again each frame while the view is still
 * growing), no picture on screen is still loading or still fading in, nothing on
 * screen matches the view's own pending selector, and all of that for two frames running; or
 * after `maxMs`. Then the snapshot can go without a jump or an empty card.
 */
/** A picture or card on screen still running its own entrance (a finite animation): the
 *  remounted gallery fades its previews in, and a snapshot dropped mid-fade shows them
 *  half drawn. Endless animations never end, so they do not count. */
function entering(view: HTMLElement, onScreen: (el: Element) => boolean): boolean {
  if (typeof view.getAnimations !== 'function') return false;
  return view.getAnimations({ subtree: true }).some((a) => {
    const effect = a.effect as KeyframeEffect | null;
    const end = Number(effect?.getComputedTiming().endTime);
    return a.playState === 'running' && Number.isFinite(end) && !!effect?.target && onScreen(effect.target);
  });
}

export function viewSettled(view: HTMLElement, place: ViewPlace = { scrollY: 0 }, maxMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    const deadline = performance.now() + maxMs;
    const pending = view.getAttribute(SETTLE_PENDING_ATTR);
    const onScreen = (el: Element): boolean => {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight && r.width > 0;
    };
    // Where the window has to be for the anchor to sit where the snapshot showed it,
    // else the snapshot's own offset.
    const wanted = (): number => {
      const el = place.anchor ? view.querySelector(place.anchor.selector) : null;
      if (!el || !place.anchor) return place.scrollY;
      return Math.max(0, Math.round(window.scrollY + el.getBoundingClientRect().top - place.anchor.top));
    };
    let calm = 0;
    const check = (): void => {
      const scrollY = wanted();
      if (Math.abs(window.scrollY - scrollY) > 1) window.scrollTo(0, scrollY);
      const waiting = Math.abs(window.scrollY - scrollY) > 1
        || Array.from(view.querySelectorAll('img')).some((img) => !img.complete && onScreen(img))
        || (!!pending && Array.from(view.querySelectorAll(pending)).some(onScreen))
        || entering(view, onScreen);
      calm = waiting ? 0 : calm + 1;
      if (calm >= 2 || performance.now() >= deadline) resolve();
      else requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

// The one snapshot currently on screen. A second navigation that starts before the
// first fade finishes drops the earlier overlay instantly so fades never stack.
interface Snapshot {
  overlay: HTMLDivElement;
  /** Route signature of the view the snapshot was taken from. */
  source?: string;
  scrollY: number;
  /** What leaveAt() hid, so a reclaim can show it again. */
  gone: Element[];
  timer?: ReturnType<typeof setTimeout>;
  /** The handle that may commit it; a reclaim hands it to a new one. */
  owner: object;
}
let active: Snapshot | null = null;

/** Hide every part of the snapshot except the top bar and the elements that contain the bar. */
function takeOutOfPaint(snap: Snapshot): void {
  const keep = snap.overlay.querySelector(TOP_BAR);
  const chain = new Set<Element>();
  for (let n: Element | null = keep; n && n !== snap.overlay; n = n.parentElement) chain.add(n);
  const hide = (parent: Element): void => {
    for (const child of Array.from(parent.children)) {
      if (child === keep) continue;
      if (chain.has(child)) hide(child);
      else { child.classList.add(VIEW_FADE_GONE_CLASS); snap.gone.push(child); }
    }
  };
  hide(snap.overlay);
}

function handleFor(snap: Snapshot, owner: object, instant: boolean): ViewFade {
  let committed = false;
  return {
    leaveAt(at: number, then?: () => void): void {
      if (committed || snap.owner !== owner) return;
      clearTimeout(snap.timer);
      const go = (): void => {
        if (committed || snap.owner !== owner || active !== snap) return;
        takeOutOfPaint(snap);
        then?.();
      };
      const wait = at - performance.now();
      if (wait <= 0) go(); else snap.timer = setTimeout(go, wait);
    },
    commit(): void {
      if (committed) return;
      committed = true;
      // Taken back by a Back to the view it came from: the new handle drops the snapshot.
      if (snap.owner !== owner) return;
      clearTimeout(snap.timer);
      const { overlay } = snap;
      // Superseded by a newer navigation's fade - just drop this snapshot.
      if (active !== snap) { overlay.remove(); return; }
      const done = (): void => {
        overlay.remove();
        if (active === snap) active = null;
      };
      // A view put back by a Back swaps at once (and reduced motion, should it change
      // while a snapshot is up).
      if (instant || prefersReducedMotion()) { done(); return; }
      // Next frame: the incoming view has painted underneath at full opacity, so the
      // shared chrome is already solid. Fade the old pixels out to reveal it.
      requestAnimationFrame(() => {
        // Arm the fade against a FLUSHED opacity:1 base, then flip to 0, so the browser
        // always ANIMATES 1→0. Setting the transition and the target in one shot can
        // otherwise jump straight to 0 on a fast mount - showing the incoming view for
        // a frame before the fade. The offsetHeight read is the flush.
        overlay.style.opacity = '1';
        overlay.style.transition = 'opacity var(--view-fade-dur, 480ms) var(--view-fade-ease, cubic-bezier(.22, .61, .36, 1))';
        void overlay.offsetHeight;
        overlay.style.opacity = '0';
        overlay.addEventListener('transitionend', done, { once: true });
        // Safety net: if transitionend never fires (tab backgrounded mid-fade, a
        // display change), reap the overlay so it can't strand over the live view.
        setTimeout(done, 1200);
      });
    },
  };
}

/**
 * A Back to the view a held snapshot was taken from, while the tool it opened is still
 * mounting: put the snapshot's content back on screen at its scroll position, so the
 * view shows at once while it mounts again underneath. Returns a handle whose commit()
 * drops the snapshot without a fade, and the scroll offset to give the remounted view;
 * null when no snapshot of that view is on screen.
 */
export function reclaimViewFade(source: string): { fade: ViewFade; place: ViewPlace } | null {
  const snap = active;
  if (!snap?.source || snap.source !== source) return null;
  clearTimeout(snap.timer);
  for (const el of snap.gone.splice(0)) el.classList.remove(VIEW_FADE_GONE_CLASS);
  snap.overlay.scrollTop = snap.scrollY;
  const place: ViewPlace = { scrollY: snap.scrollY };
  // The anchor: the pressed card, else the first card on screen with a tool id.
  const pressed = snap.overlay.querySelector('.is-navigating')?.closest('[data-tool-id]');
  const anchor = pressed ?? Array.from(snap.overlay.querySelectorAll<HTMLElement>('[data-tool-id]'))
    .find((el) => el.getBoundingClientRect().top >= 0);
  const id = anchor?.getAttribute('data-tool-id');
  if (anchor && id) {
    const css = (globalThis as { CSS?: { escape?: (v: string) => string } }).CSS;
    const quote = (v: string): string => (css?.escape ? css.escape(v) : v.replace(/["\\]/g, '\\$&'));
    const kind = anchor.classList[0] ? `.${quote(anchor.classList[0])}` : anchor.tagName.toLowerCase();
    place.anchor = { selector: `${kind}[data-tool-id="${quote(id)}"]`, top: anchor.getBoundingClientRect().top };
  }
  // The card that was pressed is not pressed any more.
  for (const el of snap.overlay.querySelectorAll('.is-navigating')) el.classList.remove('is-navigating');
  snap.owner = {};
  return { fade: handleFor(snap, snap.owner, true), place };
}

/**
 * Snapshot the current contents of `view` into a pinned overlay and empty `view`.
 * Returns a handle whose commit() fades the snapshot out, or null when no fade
 * should run (reduced motion, nothing to snapshot, or no document body).
 */
export function beginViewFade(view: HTMLElement, options: ViewFadeOptions = {}): ViewFade | null {
  if (prefersReducedMotion() || !document.body || !view.firstChild) return null;

  // A still-running fade from a previous navigation: drop it now so overlays can't
  // pile up (each is a full-viewport layer - two would double-composite the chrome).
  if (active) { clearTimeout(active.timer); active.overlay.remove(); active = null; }

  // Pin the snapshot over exactly the box #view occupied, at the viewport top.
  const rect = view.getBoundingClientRect();
  const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

  const overlay = document.createElement('div');
  // Carry #view's own classes (.app-view + the OUTGOING scoping class, e.g.
  // .gallery-view) so the moved nodes are styled exactly as they were - this runs
  // before main.ts flips the class to the incoming view.
  overlay.className = `view-fade ${view.className}`;
  // Before the nodes move in, so no animation in them runs another frame in the overlay.
  if (options.hold) overlay.classList.add(VIEW_FADE_HOLD_CLASS);
  overlay.setAttribute('aria-hidden', 'true');
  overlay.inert = true; // the frozen copy is never focusable or interactive
  // An OPAQUE page-coloured fill is required: the view markup paints no
  // background of its own (the page colour comes from `body`), so without this the
  // incoming view would show through the snapshot's transparent gaps - between
  // cards, the margins - the instant it mounted underneath, flashing before the
  // fade. hsl(var(--background)) is the same theme-aware token `body` uses, so the
  // frozen copy reads as a solid page until it fades out. `overflow:hidden` makes
  // the overlay a scroll container we can position by script; it deliberately does
  // NOT establish a containing block for position:fixed (only transform/filter/
  // contain would). That matters too: the top bar is fixed, so it must stay
  // pinned to the VIEWPORT in the snapshot - not scroll with the frozen body - 
  // exactly as on the live page. So NO transform and NO `contain` here; the scroll
  // offset rides scrollTop below, moving only flow content and leaving fixed chrome put.
  // z-index sits above the in-view chrome - notably the mobile top bar at 99999,
  // re-rendered per view - so a top-left element that DIFFERS between views (the tab
  // bar vs the dashboard/verify back pill) cross-fades uniformly instead of
  // snapping in on top. The --z-top layers (filter popover, profile menu, dialogs)
  // are always closed during a route change, and the overlay is pointer-events:none,
  // so covering the viewport for the fade is purely visual and never swallows a click.
  overlay.style.cssText =
    `position:fixed;top:0;left:${rect.left}px;width:${rect.width}px;` +
    `height:100vh;height:100dvh;overflow:hidden;z-index:var(--z-top);` +
    `background:hsl(var(--background));pointer-events:none;margin:0;will-change:opacity;`;

  // Move (not clone) the live nodes - exact pixels, zero re-decode - leaving #view
  // empty for the incoming mount. Kept as DIRECT children of the overlay so the
  // scoping selectors (`.gallery-view .gallery {…}`) still match, just as under #view.
  while (view.firstChild) overlay.appendChild(view.firstChild);
  document.body.appendChild(overlay);
  // Reproduce the window scroll: scrollTop moves the flow content (fixed chrome is
  // unaffected), so the frozen copy shows precisely what the user was looking at - 
  // not the top of a scrolled page. (The full-bleed tool view can't scroll the
  // window, so scrollY is 0 there - a harmless no-op.)
  overlay.scrollTop = scrollY;
  const snap: Snapshot = { overlay, source: options.source, scrollY, gone: [], owner: {} };
  active = snap;
  return handleFor(snap, snap.owner, false);
}
