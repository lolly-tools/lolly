// SPDX-License-Identifier: MPL-2.0
/**
 * Drag-to-scrub for numeric fields - the design-tool gesture: press on the number
 * and drag sideways to change it.
 *
 * Shared, because there were already two implementations (this one, for Pro/Batch's
 * Width & Height cells, and the `.vec-scrub` handles in tool-inputs.ts) before
 * Colour Lab wanted a third for its L/C/H entries. It lives in `lib/` rather than
 * `pro/` for that reason. Every default is Pro's original behaviour exactly - 
 * integer steps, `min: 1`, mouse and pen only - so generalising it changed nothing
 * for the existing caller.
 *
 * The hot path is deliberately minimal:
 *   • capture is taken only once a drag is recognised - no idle/global listeners;
 *   • geometry is cached on pointerdown, so pointermove does pure arithmetic and
 *     never reads layout (no forced reflow);
 *   • only the field's `.value` is written during the drag, rAF-coalesced so a
 *     burst of pointermoves collapses to one write per frame;
 *   • state is committed once, on release, via onCommit.
 * A small move threshold separates a scrub from a plain click (which still
 * focuses the field for typing).
 *
 * **Touch is opt-in** (`touch: true`). Pro's cells keep tap-to-type and the table's
 * own scrolling; a caller that wants the gesture on a phone asks for it AND must set
 * `touch-action: pan-y` on the field, so a horizontal drag reaches us while a
 * vertical one still scrolls the page. Without that the browser claims the gesture
 * and the handler never sees a move.
 *
 * Modifiers while dragging: Shift = ×10 (coarse), Alt = ×0.1 (fine).
 */

const THRESHOLD = 3;     // px of travel before a press becomes a scrub
const UNIT_PER_PX = 1;   // base sensitivity

/** A per-field number, or one constant for every field the selector matches. */
type PerField = number | ((el: HTMLInputElement) => number);
const resolve = (v: PerField | undefined, el: HTMLInputElement, dflt: number): number => {
  const n = typeof v === 'function' ? v(el) : v;
  return Number.isFinite(n) ? (n as number) : dflt;
};

export interface ScrubOptions {
  selector: string;
  onCommit?: (el: HTMLInputElement) => void;
  min?: number;
  max?: number;
  getFallback?: (el: HTMLInputElement) => number;
  /**
   * Value change per pixel of travel. Default 1 - right for pixel dimensions and
   * wrong for anything else: at 1/px an OKLCH chroma axis (0–0.4) would cross its
   * entire range in under a pixel. Pick it so one drag across the control's own
   * width is roughly one full range.
   */
  unitPerPx?: PerField;
  /** Decimals to write. Default 0 - Pro's original integer rounding. */
  decimals?: PerField;
  /** Allow touch drags. Default false; see the touch-action note above. */
  touch?: boolean;
  /** Live, once per frame, while dragging - for a preview. `onCommit` still fires on
   *  release. Without it the value only lands when the pointer lifts, which loses
   *  most of the point of a scrub. */
  onDrag?: (el: HTMLInputElement, value: number) => void;
}

interface ScrubDrag {
  el: HTMLInputElement;
  pointerId: number;
  startX: number;
  base: number;
  max: number;
  moved: boolean;
  value: number | null;
}

export function attachScrub(
  container: HTMLElement,
  {
    selector, onCommit, min = 1, max = Infinity, getFallback,
    unitPerPx, decimals, touch = false, onDrag,
  }: ScrubOptions,
): () => void {
  let drag: ScrubDrag | null = null;     // active drag bookkeeping, or null
  let raf = 0;
  let pending: number | null = null;  // latest value awaiting an rAF write

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    if (e.pointerType === 'touch' && !touch) return; // touch = tap/scroll, unless asked
    const target = e.target;
    const el = target instanceof Element ? target.closest?.(selector) : null;
    if (!(el instanceof HTMLInputElement) || el.disabled || el.readOnly) return;
    // Leave the row-resize strip (bottom edge of the cell) to resize.js.
    const td = el.closest('td');
    if (td && e.clientY >= td.getBoundingClientRect().bottom - 6) return;

    const base = el.value === '' ? (getFallback?.(el) ?? 0) : parseFloat(el.value);
    // Honour a per-element [max] (e.g. DPI tops out at 1200); the function's
    // `max` is the default for fields without one. Caps a fast drag so it can't
    // drive a pathological canvas size.
    const maxAttr = parseFloat(el.getAttribute('max') as string);
    drag = {
      el,
      pointerId: e.pointerId,
      startX: e.clientX,
      base: Number.isFinite(base) ? base : 0,
      max: Number.isFinite(maxAttr) ? maxAttr : max,
      moved: false,
      value: null,
    };
    // No capture / preventDefault yet: a click below threshold must still focus
    // the field natively. We listen on the element itself; once moved, capture
    // keeps events coming even if the pointer leaves the narrow cell.
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    if (!drag.moved) {
      if (Math.abs(dx) < THRESHOLD) return;
      drag.moved = true;
      // Capture keeps events coming when the pointer leaves the narrow field. It can
      // throw (NotFoundError) if the pointer is no longer active by the time we ask - 
      // and a throw here would abandon the gesture halfway, leaving `is-scrubbing` on
      // the body with no drag to end it. Capture is an improvement, not a requirement.
      try { drag.el.setPointerCapture?.(drag.pointerId); } catch { /* not capturable */ }
      drag.el.blur(); // scrubbing, not typing
      document.body.classList.add('is-scrubbing');
    }
    const unit = resolve(unitPerPx, drag.el, UNIT_PER_PX);
    const step = e.shiftKey ? unit * 10 : e.altKey ? unit * 0.1 : unit;
    // Quantise to the field's own precision, so the value written is the value shown
    // and a commit cannot re-round it to something else.
    const q = 10 ** resolve(decimals, drag.el, 0);
    pending = Math.min(drag.max, Math.max(min, Math.round((drag.base + dx * step) * q) / q));
    drag.value = pending;
    if (!raf) raf = requestAnimationFrame(flush);
    e.preventDefault();
  }

  function flush(): void {
    raf = 0;
    if (!drag || pending == null) return;
    drag.el.value = pending.toFixed(resolve(decimals, drag.el, 0));
    onDrag?.(drag.el, pending);
  }

  function onPointerUp(): void {
    if (!drag) return;
    const { el, moved, value, pointerId } = drag;
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerUp);
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    pending = null;
    drag = null;

    if (!moved) return; // it was a click - native focus already happened
    try { el.releasePointerCapture?.(pointerId); } catch { /* never captured */ }
    document.body.classList.remove('is-scrubbing');
    if (value != null) {
      el.value = value.toFixed(resolve(decimals, el, 0));
      onCommit?.(el);
    }
    // Swallow the click the browser fires after a drag so it can't re-focus.
    el.addEventListener('click', swallowOnce, { capture: true, once: true });
  }

  function swallowOnce(e: MouseEvent): void { e.stopPropagation(); e.preventDefault(); }

  container.addEventListener('pointerdown', onPointerDown);

  return () => {
    container.removeEventListener('pointerdown', onPointerDown);
    if (raf) cancelAnimationFrame(raf);
    document.body.classList.remove('is-scrubbing');
  };
}
