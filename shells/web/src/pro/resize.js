// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — drag-resize for rows and columns.
 *
 * No per-cell handle elements: a single pointer listener on the grid detects a
 * grab near an edge by geometry —
 *   • the bottom edge of any body row  → resize that row's height (drag anywhere
 *     along the horizontal grid line);
 *   • the right edge of a header cell  → widen/narrow that column.
 * The matching ::after zones in pro.css supply the resize cursor.
 *
 * During a drag we mutate the live element (tr.style.height / th.style.width)
 * for smoothness and commit the final value to state on release; the renderer
 * re-applies persisted sizes, so nothing is lost on re-render.
 */
export function attachResize(container, {
  setRowHeight, setColWidth, MIN_ROW = 34, MIN_COL = 28, edge = 6,
}) {
  let mode = null;     // 'row' | 'col'
  let d = null;        // drag bookkeeping

  function onDown(e) {
    if (e.button !== 0) return;
    // The colour popover is fixed-positioned but a DOM child of its row, so it
    // lands below the row's bottom edge — ignore it, or we'd hijack clicks meant
    // for the popover (e.g. focusing the hex input) as a row resize.
    if (e.target.closest?.('.color-popover')) return;
    // The actions cell holds the drag-reorder grip + remove button; a grab there
    // is a reorder/remove, never a row-resize (reorder.js owns those pointers).
    if (e.target.closest?.('.pro-cell-actions')) return;

    // Column: near the right edge of a header cell.
    const th = e.target.closest('thead th[data-col]');
    if (th) {
      const r = th.getBoundingClientRect();
      if (e.clientX >= r.right - edge) {
        mode = 'col';
        d = { key: th.dataset.col, el: th, start: e.clientX, base: th.offsetWidth };
        begin(e);
        return;
      }
    }

    // Row: near the bottom edge of a body row.
    const tr = e.target.closest('tbody tr[data-row]');
    if (tr) {
      const r = tr.getBoundingClientRect();
      if (e.clientY >= r.bottom - edge) {
        mode = 'row';
        d = { uid: tr.dataset.row, el: tr, start: e.clientY, base: tr.offsetHeight };
        begin(e);
      }
    }
  }

  function begin(e) {
    container.setPointerCapture?.(e.pointerId);
    document.body.classList.add(mode === 'col' ? 'pro-col-resizing' : 'pro-row-resizing');
    e.preventDefault();
  }

  function onMove(e) {
    if (!mode) return;
    if (mode === 'col') {
      d.el.style.width = Math.max(MIN_COL, d.base + (e.clientX - d.start)) + 'px';
    } else {
      d.el.style.height = Math.max(MIN_ROW, d.base + (e.clientY - d.start)) + 'px';
    }
    e.preventDefault();
  }

  function onUp(e) {
    if (!mode) return;
    if (mode === 'col') setColWidth(d.key, parseInt(d.el.style.width, 10) || d.el.offsetWidth);
    else setRowHeight(d.uid, parseInt(d.el.style.height, 10) || d.el.offsetHeight);
    container.releasePointerCapture?.(e.pointerId);
    document.body.classList.remove('pro-col-resizing', 'pro-row-resizing');
    mode = null; d = null;
  }

  container.addEventListener('pointerdown', onDown);
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerup', onUp);
  container.addEventListener('pointercancel', onUp);

  return () => {
    container.removeEventListener('pointerdown', onDown);
    container.removeEventListener('pointermove', onMove);
    container.removeEventListener('pointerup', onUp);
    container.removeEventListener('pointercancel', onUp);
  };
}

/** Is the pointer over a resize edge? Used to gate click-to-edit on cell edges. */
export function isOnResizeEdge(e, edge = 6) {
  const tr = e.target.closest?.('tbody tr[data-row]');
  if (tr && e.clientY >= tr.getBoundingClientRect().bottom - edge) return true;
  const th = e.target.closest?.('thead th[data-col]');
  if (th && e.clientX >= th.getBoundingClientRect().right - edge) return true;
  return false;
}
