// SPDX-License-Identifier: MPL-2.0
/**
 * Eight resize grips - the four edges and the four corners - for any floating
 * panel that positions itself with `left/top/width/height`.
 *
 * Extracted from lib/float-panel.ts (the Colour Lab's popped-out charts) so the
 * visualizer's enlarged player can wear the same handles. That panel used the
 * native CSS `resize` corner, which is ONE corner and fires no events: people
 * reach for the sides and the other corners, find nothing there, and conclude
 * the panel can't be shaped. Every panel in the app now resizes the same way.
 *
 * The caller owns its own geometry - how the box is read, written, clamped and
 * persisted - because a panel that remembers where it was left (the visualizer)
 * and one that must never wander off screen (a popped-out figure) disagree about
 * every one of those, and only agree about the pointer maths.
 */

import './panel-grips.css';

export interface GripBox { x: number; y: number; w: number; h: number }

export interface GripOpts {
  /** The panel's current box, in viewport pixels. */
  read(): GripBox;
  /** Write a box back to the panel. Called on every pointermove. */
  apply(b: GripBox): void;
  /** Constrain a box before it's applied (minimum size, staying on screen). */
  clamp(b: GripBox): GripBox;
  /** Floor the pointer maths clamps the TRAVEL against - see below. */
  min: { w: number; h: number };
  /** Return true to ignore grips entirely (a fullscreen panel has nothing to resize). */
  locked?(): boolean;
  /** After each applied change - repaint here. */
  onMove?(): void;
  /** Once, when the gesture ends - persist here. */
  onEnd?(): void;
}

const DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;

/** The grip markup. Append inside the panel element; order in the DOM doesn't matter. */
export function panelGripsHtml(): string {
  return DIRS.map(d => `<span class="panel-grip panel-grip--${d}" data-panel-grip="${d}"></span>`).join('');
}

/**
 * Wire every grip found under `root`. Returns a teardown function.
 *
 * A grip's direction says which edges MOVE, which is why the west and north ones
 * change `x`/`y` as well as the size - dragging a left edge rightward makes the
 * panel narrower AND moves its origin, and getting that wrong makes the panel
 * appear to slide away from the pointer.
 *
 * The minimum is enforced against the moving edge rather than after the fact, so
 * a panel squeezed to its floor stops dead instead of continuing to travel.
 */
export function wirePanelGrips(root: HTMLElement, opts: GripOpts): () => void {
  const offs: Array<() => void> = [];
  for (const grip of root.querySelectorAll<HTMLElement>('[data-panel-grip]')) {
    const dir = grip.dataset.panelGrip ?? '';
    let from: { px: number; py: number; b: GripBox } | null = null;

    const down = (e: PointerEvent): void => {
      if (opts.locked?.()) return;
      from = { px: e.clientX, py: e.clientY, b: opts.read() };
      grip.setPointerCapture(e.pointerId);
      root.classList.add('is-resizing');
      e.preventDefault();
      e.stopPropagation();
    };
    const move = (e: PointerEvent): void => {
      if (!from) return;
      const dx = e.clientX - from.px, dy = e.clientY - from.py;
      const b = { ...from.b };
      if (dir.includes('e')) b.w = from.b.w + dx;
      if (dir.includes('s')) b.h = from.b.h + dy;
      if (dir.includes('w')) {
        // Clamp the travel, not the result: past the minimum the left edge must
        // stop, and computing x from an already-clamped width is what does that.
        b.w = Math.max(opts.min.w, from.b.w - dx);
        b.x = from.b.x + (from.b.w - b.w);
      }
      if (dir.includes('n')) {
        b.h = Math.max(opts.min.h, from.b.h - dy);
        b.y = from.b.y + (from.b.h - b.h);
      }
      opts.apply(opts.clamp(b));
      opts.onMove?.();
    };
    const end = (e: PointerEvent): void => {
      if (!from) return;
      from = null;
      root.classList.remove('is-resizing');
      if (grip.hasPointerCapture(e.pointerId)) grip.releasePointerCapture(e.pointerId);
      opts.onEnd?.();
    };

    const on = (ev: string, fn: (e: PointerEvent) => void): void => {
      grip.addEventListener(ev, fn as EventListener);
      offs.push(() => grip.removeEventListener(ev, fn as EventListener));
    };
    on('pointerdown', down);
    on('pointermove', move);
    on('pointerup', end);
    on('pointercancel', end);
  }
  return () => { for (const off of offs) off(); };
}
