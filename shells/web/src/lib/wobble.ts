// SPDX-License-Identifier: MPL-2.0
/**
 * Wobbly windows - the opt-in compiz-style wobble for the shell's draggable
 * floating panels (the export settings float, the Neurospicy player). Heritage:
 * the effect shipped in Compiz, much of it built at SUSE for the Novell Linux
 * Desktop, which is the pedigree behind supporting it here.
 *
 * Not a spring MESH. A live DOM panel can't be vertex-warped the way compiz warped
 * a GL texture, so this is the hermes83-simplified model: a single lag vector
 * trails the grab point, a slightly-underdamped spring reels it back, and the lag
 * is painted as a small skew + stretch about the grab point. Same integrator shape
 * as the slider egg-trail (components/custom-slider.ts), same reduced-motion gate.
 *
 * Additive, like the a11y prefs and Jelly: with the flag OFF every handle method is
 * a no-op, no transform is ever written, and the panel's own left/top drag code is
 * untouched. `transform` is set only WHILE a wobble is live and cleared on settle,
 * so at rest getBoundingClientRect() and popover anchoring see exactly today's DOM.
 *
 * Chrome only. Never used inside .tool-canvas / the export stages - a render is the
 * user's own output and its geometry is shared with the CLI, so a calmer or wobblier
 * chrome must not move an exported pixel.
 */

import { isFlagOnSync, WOBBLY_FLAG } from '../feature-flags.ts';
import { prefersReducedMotion } from './a11y-prefs.ts';
import { startMeshWobble, type MeshSession } from './wobble-mesh.ts';
import { clamp } from '@lolly/engine';

/**
 * Whether the wobbly-windows flag is on. Opt-in (default OFF), so the default-aware
 * read (isFlagOnSync), not flagEnabledSync whose missing-key fallback is ON. There
 * is no bundle to load (unlike jelly), so this flag read is the whole gate.
 */
export function wobblyActive(): boolean {
  return isFlagOnSync(WOBBLY_FLAG);
}

// Tunables - one object so the feel is tuned in a single edit (plan 150 section 3.1).
// STIFF/DAMP: the reel-in spring. DAMP is below critical (2*sqrt(STIFF) ~= 26) so it
// stays slightly underdamped and rings ONCE on release, which IS the settle wobble.
// MAX_LAG caps |lag| in px so a violent throw can't fold the panel. SKEW_K/STRETCH_K
// map lag px onto the visible shear + squash, each capped small so the effect reads
// through motion, not through magnitude. SETTLE_* are the rest thresholds.
const W = {
  STIFF: 170,
  DAMP: 20,
  MAX_LAG: 40,
  SKEW_K: 0.18,
  SKEW_MAX: 6,
  STRETCH_K: 0.0016,
  STRETCH_MAX: 0.04,
  SETTLE_L: 0.35,
  SETTLE_V: 0.6,
};

export interface WobbleHandle {
  /** Pointerdown on the drag handle: anchors the deform at the grab point. */
  grab(clientX: number, clientY: number): void;
  /** Per-pointermove deltas while dragging. */
  drag(dx: number, dy: number): void;
  /** Pointerup: the spring rings down and self-clears. */
  release(): void;
  /** One-shot kick, for snap transitions and the dock/undock in plan 151. */
  impulse(dx: number, dy: number): void;
  /** Canned entrance wobble for a panel first appearing. */
  wobbleIn(): void;
  /** Cancel any running loop and clear every style this handle set. */
  dispose(): void;
}

export interface WobbleOpts {
  /** Reduced-motion read, injectable for tests. Defaults to the shared helper. */
  reduced?: () => boolean;
  /** rAF scheduler, injectable so jsdom tests can pump frames by hand. */
  raf?: (cb: FrameRequestCallback) => number;
  caf?: (id: number) => void;
}

/**
 * Attach a wobble to `el`. Returns a handle whose methods a panel's own pointer code
 * calls unconditionally: each is a no-op unless the flag is on and motion is allowed,
 * so call sites stay plain one-liners and the flag-off path writes nothing at all.
 */
export function attachWobble(el: HTMLElement, opts: WobbleOpts = {}): WobbleHandle {
  const reduced = opts.reduced ?? prefersReducedMotion;
  const raf = opts.raf ?? ((cb) => requestAnimationFrame(cb));
  const caf = opts.caf ?? ((id) => cancelAnimationFrame(id));

  let lx = 0, ly = 0, vx = 0, vy = 0;
  let dragging = false;
  let rafId = 0;
  let lastT = 0;
  // When the mesh tier is on + capable, a drag runs as a GPU spring mesh instead of the
  // affine skew; snap/entrance impulses always stay affine (mesh is only for the drag).
  let meshSession: MeshSession | null = null;

  // The gate for every public entry point. Read at CALL time (the flag mirror and the
  // reduced-motion query are both live), so a toggle applies to the next gesture.
  const live = (): boolean => wobblyActive() && !reduced();

  function render(): void {
    // Shear the panel about the grab point so the far edge TRAILS the drag (inertia): with
    // the origin at the grabbed header, a rightward drag (lx>0) must lean the bottom LEFT,
    // i.e. skewX < 0 - hence the negation. skewX tracks horizontal lag, skewY vertical.
    const sx = clamp(-lx * W.SKEW_K, -W.SKEW_MAX, W.SKEW_MAX);
    const sy = clamp(-ly * W.SKEW_K, -W.SKEW_MAX, W.SKEW_MAX);
    // Stretch along the dominant lag axis and squash the other, a soft volume feel.
    const s = Math.min(W.STRETCH_MAX, Math.hypot(lx, ly) * W.STRETCH_K);
    const horiz = Math.abs(lx) >= Math.abs(ly);
    const scaleX = horiz ? 1 + s : 1 - s * 0.6;
    const scaleY = horiz ? 1 - s * 0.6 : 1 + s;
    el.style.transform =
      `skewX(${sx.toFixed(3)}deg) skewY(${sy.toFixed(3)}deg) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`;
  }

  function step(t: number): void {
    rafId = 0;
    const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 1 / 60;
    lastT = t;
    // Semi-implicit Euler, per axis. The lag's target is 0 (the body catching up).
    vx += (-W.STIFF * lx - W.DAMP * vx) * dt;
    vy += (-W.STIFF * ly - W.DAMP * vy) * dt;
    lx += vx * dt;
    ly += vy * dt;
    render();
    const settled = !dragging
      && Math.abs(lx) < W.SETTLE_L && Math.abs(ly) < W.SETTLE_L
      && Math.abs(vx) < W.SETTLE_V && Math.abs(vy) < W.SETTLE_V;
    if (settled) {
      lx = ly = vx = vy = 0;
      lastT = 0;
      clearStyles();
    } else {
      rafId = raf(step);
    }
  }

  function clearStyles(): void {
    el.style.transform = '';
    el.style.transformOrigin = '';
    el.style.willChange = '';
  }

  function wake(): void {
    if (!rafId) {
      lastT = 0;
      el.style.willChange = 'transform';
      rafId = raf(step);
    }
  }

  function kick(dx: number, dy: number): void {
    lx = clamp(lx + dx, -W.MAX_LAG, W.MAX_LAG);
    ly = clamp(ly + dy, -W.MAX_LAG, W.MAX_LAG);
    wake();
  }

  // The mesh snapshot is ready and has taken over: stop the affine bridge and leave el flat
  // (the mesh hid it), so when the mesh later restores el it shows un-skewed.
  function stopAffineForMesh(): void {
    dragging = false;
    if (rafId) caf(rafId);
    rafId = 0;
    lx = ly = vx = vy = 0;
    lastT = 0;
    clearStyles();
  }

  return {
    grab(clientX: number, clientY: number): void {
      if (!live()) return;
      // Start the affine wobble IMMEDIATELY for instant feedback. If the mesh tier is on +
      // capable, it snapshots in the background and, once ready, calls onReady to stop this
      // affine bridge and take over with the real curve - so nothing waits on the snapshot.
      const r = el.getBoundingClientRect();
      el.style.transformOrigin = `${(clientX - r.left).toFixed(1)}px ${(clientY - r.top).toFixed(1)}px`;
      dragging = true;
      wake();
      meshSession = startMeshWobble(el, clientX, clientY, { onReady: stopAffineForMesh });
    },
    drag(dx: number, dy: number): void {
      meshSession?.drag(dx, dy);
      if (dragging) kick(dx, dy);   // affine, only while it is still the visible renderer
    },
    release(): void {
      meshSession?.release();
      // No live() re-check: if dragging is set at all, a live() grab set it, so let the
      // ring-down finish and self-clear even if the flag flipped mid-gesture.
      if (!dragging) return;
      dragging = false;
      wake();
    },
    impulse(dx: number, dy: number): void {
      if (!live()) return;
      kick(dx, dy);
    },
    wobbleIn(): void {
      if (!live()) return;
      // Drop-in feel: anchor at the top so the body swings below the entry point.
      el.style.transformOrigin = '50% 0%';
      kick(0, W.MAX_LAG * 0.55);
    },
    dispose(): void {
      meshSession?.dispose();
      meshSession = null;
      if (rafId) caf(rafId);
      rafId = 0;
      lx = ly = vx = vy = 0;
      dragging = false;
      lastT = 0;
      clearStyles();
    },
  };
}
