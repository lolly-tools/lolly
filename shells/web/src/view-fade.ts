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
 * Opening a tool holds the snapshot still ({@link ViewFadeOptions.hold}). A tool takes
 * seconds to mount on a slow phone, and moving the gallery's nodes restarted their CSS
 * animations: the card and picture fade-ins replayed, and pulsing dots on cards
 * scrolled out of sight ran on the main thread (the browser cannot hand those to the
 * compositor), so it styled and layerized the whole page on every frame while the tool
 * was trying to load (plan 371, M2b). Held, the snapshot is a still picture of the view
 * that was left: every animation in it ends at once at its last frame and transitions
 * jump to their end (`.view-fade--hold` in parts/base.css), the loading card is the one
 * thing that moves, and the tool comes in with a short fade once its first render is
 * ready. {@link afterNextPaint} lets the pressed card paint before any of this starts.
 */

import { prefersReducedMotion } from './lib/a11y-prefs.ts';

/** Handle returned by beginViewFade - call commit() once the new view has mounted. */
export interface ViewFade {
  /** Fade the outgoing snapshot out (or drop it instantly if superseded). Idempotent. */
  commit(): void;
}

export interface ViewFadeOptions {
  /**
   * Hold the snapshot still: end every animation and transition inside it at once, and
   * fade it out quickly (--dur-1, 120 ms, parts/base.css) when commit() runs. For a tool
   * open, where the incoming mount is long and the outgoing view would otherwise keep
   * the main thread busy. Reduced motion is unaffected: no snapshot is made at all.
   */
  hold?: boolean;
}

/** The class that holds a snapshot still; parts/base.css owns what it does. */
export const VIEW_FADE_HOLD_CLASS = 'view-fade--hold';

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

// The one snapshot currently on screen. A second navigation that starts before the
// first fade finishes drops the earlier overlay instantly so fades never stack.
let activeOverlay: HTMLDivElement | null = null;

/**
 * Snapshot the current contents of `view` into a pinned overlay and empty `view`.
 * Returns a handle whose commit() fades the snapshot out, or null when no fade
 * should run (reduced motion, nothing to snapshot, or no document body).
 */
export function beginViewFade(view: HTMLElement, options: ViewFadeOptions = {}): ViewFade | null {
  if (prefersReducedMotion() || !document.body || !view.firstChild) return null;

  // A still-running fade from a previous navigation: drop it now so overlays can't
  // pile up (each is a full-viewport layer - two would double-composite the chrome).
  if (activeOverlay) { activeOverlay.remove(); activeOverlay = null; }

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
  activeOverlay = overlay;

  let committed = false;
  return {
    commit(): void {
      if (committed) return;
      committed = true;
      // Superseded by a newer navigation's fade - just drop this snapshot.
      if (activeOverlay !== overlay) { overlay.remove(); return; }
      // Next frame: the incoming view has painted underneath at full opacity, so the
      // shared chrome is already solid. Fade the old pixels out to reveal it.
      requestAnimationFrame(() => {
        const done = (): void => {
          overlay.remove();
          if (activeOverlay === overlay) activeOverlay = null;
        };
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
