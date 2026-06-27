// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — drag-to-reorder rows by their grip handle.
 *
 * A single pointer listener on the grid watches for a grab on a row's drag
 * handle (the ⠿ grip in the actions cell). While held, the dragged <tr> is moved
 * among its siblings live in the DOM as the pointer crosses each row's vertical
 * midpoint, so the new order is visible as you drag. On release we read the final
 * uid order from the DOM and hand it back via onReorder — the owner reorders
 * state.rows and re-renders, so state stays the single source of truth (the live
 * DOM moves are just feedback and get rebuilt on the next render).
 *
 * Mirrors resize.js / scrub.js: self-contained, attach to the grid container,
 * call the returned detach() on teardown. Knows nothing about batch state.
 */
export function attachReorder(container, {
  onReorder, scrollEl = null, handleSelector = '[data-row-drag]', edge = 44, speed = 14,
}) {
  let drag = null;     // { tr, tbody, startOrder, lastY, scroller }
  let scrollDir = 0;   // -1 up / +1 down / 0 none, for edge autoscroll
  let raf = 0;

  const rowsIn = (tbody) => [...tbody.querySelectorAll(':scope > tr[data-row]')];
  // The scroll container is recreated on every re-render, so resolve it per-drag.
  const getScroller = () => (typeof scrollEl === 'function' ? scrollEl() : scrollEl);

  function onDown(e) {
    if (e.button !== 0) return;
    const handle = e.target.closest(handleSelector);
    if (!handle) return;
    const tr = handle.closest('tbody tr[data-row]');
    const tbody = tr?.parentNode;
    if (!tr || !tbody) return;
    drag = { tr, tbody, startOrder: rowsIn(tbody).map(r => r.dataset.row), lastY: e.clientY, scroller: getScroller() };
    container.setPointerCapture?.(e.pointerId);
    document.body.classList.add('pro-row-dragging');
    tr.classList.add('pro-row-drag-active');
    e.preventDefault();
    e.stopPropagation(); // don't let the handle's pointerdown reach resize/nav
  }

  // Move the dragged row to sit before the first sibling whose midpoint is below
  // the pointer (or to the end when it's past them all).
  function reposition(y) {
    const { tr, tbody } = drag;
    let ref = null;
    for (const row of rowsIn(tbody)) {
      if (row === tr) continue;
      const r = row.getBoundingClientRect();
      if (y < r.top + r.height / 2) { ref = row; break; }
    }
    if (ref) { if (tr.nextSibling !== ref) tbody.insertBefore(tr, ref); }
    else if (tbody.lastElementChild !== tr) tbody.appendChild(tr);
  }

  function onMove(e) {
    if (!drag) return;
    e.preventDefault();
    drag.lastY = e.clientY;
    reposition(e.clientY);

    // Autoscroll when the pointer hugs the top/bottom edge of a scrolling batch.
    scrollDir = 0;
    if (drag.scroller) {
      const r = drag.scroller.getBoundingClientRect();
      if (e.clientY < r.top + edge) scrollDir = -1;
      else if (e.clientY > r.bottom - edge) scrollDir = 1;
      if (scrollDir && !raf) raf = requestAnimationFrame(autoScroll);
    }
  }

  function autoScroll() {
    raf = 0;
    if (!drag || !scrollDir || !drag.scroller) return;
    drag.scroller.scrollTop += scrollDir * speed;
    reposition(drag.lastY); // bring the rows now under the pointer into order
    raf = requestAnimationFrame(autoScroll);
  }

  function onUp(e) {
    if (!drag) return;
    const order = rowsIn(drag.tbody).map(r => r.dataset.row);
    const changed = order.length !== drag.startOrder.length
      || order.some((id, i) => id !== drag.startOrder[i]);
    drag.tr.classList.remove('pro-row-drag-active');
    container.releasePointerCapture?.(e.pointerId);
    document.body.classList.remove('pro-row-dragging');
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    scrollDir = 0;
    drag = null;
    if (changed) onReorder(order); // only re-render when the order actually moved
  }

  container.addEventListener('pointerdown', onDown);
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerup', onUp);
  container.addEventListener('pointercancel', onUp);

  return () => {
    if (raf) cancelAnimationFrame(raf);
    container.removeEventListener('pointerdown', onDown);
    container.removeEventListener('pointermove', onMove);
    container.removeEventListener('pointerup', onUp);
    container.removeEventListener('pointercancel', onUp);
  };
}
