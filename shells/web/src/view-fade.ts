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
 */

import { prefersReducedMotion } from './lib/a11y-prefs.ts';

/** Handle returned by beginViewFade - call commit() once the new view has mounted. */
export interface ViewFade {
  /** Fade the outgoing snapshot out (or drop it instantly if superseded). Idempotent. */
  commit(): void;
}

// The one snapshot currently on screen. A second navigation that starts before the
// first fade finishes drops the earlier overlay instantly so fades never stack.
let activeOverlay: HTMLDivElement | null = null;

/**
 * Snapshot the current contents of `view` into a pinned overlay and empty `view`.
 * Returns a handle whose commit() fades the snapshot out, or null when no fade
 * should run (reduced motion, nothing to snapshot, or no document body).
 */
export function beginViewFade(view: HTMLElement): ViewFade | null {
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
  // snapping in on top. The 100000+ layers (filter popover, profile menu, dialogs)
  // are always closed during a route change, and the overlay is pointer-events:none,
  // so covering the viewport for the fade is purely visual and never swallows a click.
  overlay.style.cssText =
    `position:fixed;top:0;left:${rect.left}px;width:${rect.width}px;` +
    `height:100vh;height:100dvh;overflow:hidden;z-index:100000;` +
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
