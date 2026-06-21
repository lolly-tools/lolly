/**
 * Pro / Batch mode — drag-to-scrub for numeric cells (Width / Height).
 *
 * Pointer-drag horizontally on a number field to change its value, like a
 * design-tool scrubber. The hot path is deliberately minimal:
 *   • capture is taken only once a drag is recognised — no idle/global listeners;
 *   • geometry is cached on pointerdown, so pointermove does pure arithmetic and
 *     never reads layout (no forced reflow);
 *   • only the field's `.value` is written during the drag, rAF-coalesced so a
 *     burst of pointermoves collapses to one write per frame;
 *   • state is committed once, on release, via onCommit.
 * A small move threshold separates a scrub from a plain click (which still
 * focuses the field for typing). Mouse/pen only — touch keeps tap-to-type and
 * the field's own scrolling.
 *
 * Modifiers while dragging: Shift = ×10 (coarse), Alt = ×0.1 (fine).
 */

const THRESHOLD = 3;     // px of travel before a press becomes a scrub
const UNIT_PER_PX = 1;   // base sensitivity

export function attachScrub(container, { selector, onCommit, min = 1, getFallback }) {
  let drag = null;     // active drag bookkeeping, or null
  let raf = 0;
  let pending = null;  // latest value awaiting an rAF write

  function onPointerDown(e) {
    if (e.button !== 0 || e.pointerType === 'touch') return; // touch = tap/scroll
    const el = e.target.closest?.(selector);
    if (!el || el.disabled || el.readOnly) return;
    // Leave the row-resize strip (bottom edge of the cell) to resize.js.
    const td = el.closest('td');
    if (td && e.clientY >= td.getBoundingClientRect().bottom - 6) return;

    const base = el.value === '' ? (getFallback?.(el) ?? 0) : parseFloat(el.value);
    drag = {
      el,
      pointerId: e.pointerId,
      startX: e.clientX,
      base: Number.isFinite(base) ? base : 0,
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

  function onPointerMove(e) {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    if (!drag.moved) {
      if (Math.abs(dx) < THRESHOLD) return;
      drag.moved = true;
      drag.el.setPointerCapture?.(drag.pointerId);
      drag.el.blur(); // scrubbing, not typing
      document.body.classList.add('pro-scrubbing');
    }
    const step = e.shiftKey ? UNIT_PER_PX * 10 : e.altKey ? UNIT_PER_PX * 0.1 : UNIT_PER_PX;
    pending = Math.max(min, Math.round(drag.base + dx * step));
    drag.value = pending;
    if (!raf) raf = requestAnimationFrame(flush);
    e.preventDefault();
  }

  function flush() {
    raf = 0;
    if (drag && pending != null) drag.el.value = String(pending);
  }

  function onPointerUp() {
    if (!drag) return;
    const { el, moved, value, pointerId } = drag;
    el.removeEventListener('pointermove', onPointerMove);
    el.removeEventListener('pointerup', onPointerUp);
    el.removeEventListener('pointercancel', onPointerUp);
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    pending = null;
    drag = null;

    if (!moved) return; // it was a click — native focus already happened
    el.releasePointerCapture?.(pointerId);
    document.body.classList.remove('pro-scrubbing');
    if (value != null) {
      el.value = String(value);
      onCommit?.(el);
    }
    // Swallow the click the browser fires after a drag so it can't re-focus.
    el.addEventListener('click', swallowOnce, { capture: true, once: true });
  }

  function swallowOnce(e) { e.stopPropagation(); e.preventDefault(); }

  container.addEventListener('pointerdown', onPointerDown);

  return () => {
    container.removeEventListener('pointerdown', onPointerDown);
    if (raf) cancelAnimationFrame(raf);
    document.body.classList.remove('pro-scrubbing');
  };
}
