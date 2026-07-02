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
interface ResizeOptions {
  setRowHeight: (uid: string, height: number) => void;
  setColWidth: (key: string, width: number) => void;
  MIN_ROW?: number;
  MIN_COL?: number;
  edge?: number;
}

interface ResizeDrag {
  id: string;   // column key or row uid, per mode
  el: HTMLElement;
  start: number;
  base: number;
}

export function attachResize(container: HTMLElement, {
  setRowHeight, setColWidth, MIN_ROW = 34, MIN_COL = 28, edge = 6,
}: ResizeOptions): () => void {
  let mode: 'row' | 'col' | null = null;
  let d: ResizeDrag | null = null;        // drag bookkeeping

  function onDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    // The colour popover is fixed-positioned but a DOM child of its row, so it
    // lands below the row's bottom edge — ignore it, or we'd hijack clicks meant
    // for the popover (e.g. focusing the hex input) as a row resize.
    if (target.closest('.color-popover')) return;
    // The actions cell holds the drag-reorder grip + remove button; a grab there
    // is a reorder/remove, never a row-resize (reorder.js owns those pointers).
    if (target.closest('.pro-cell-actions')) return;

    // Column: near the right edge of a header cell.
    const th = target.closest('thead th[data-col]');
    if (th instanceof HTMLElement) {
      const r = th.getBoundingClientRect();
      if (e.clientX >= r.right - edge) {
        mode = 'col';
        d = { id: th.dataset.col ?? '', el: th, start: e.clientX, base: th.offsetWidth };
        begin(e);
        return;
      }
    }

    // Row: near the bottom edge of a body row.
    const tr = target.closest('tbody tr[data-row]');
    if (tr instanceof HTMLElement) {
      const r = tr.getBoundingClientRect();
      if (e.clientY >= r.bottom - edge) {
        mode = 'row';
        d = { id: tr.dataset.row ?? '', el: tr, start: e.clientY, base: tr.offsetHeight };
        begin(e);
      }
    }
  }

  function begin(e: PointerEvent): void {
    container.setPointerCapture?.(e.pointerId);
    document.body.classList.add(mode === 'col' ? 'pro-col-resizing' : 'pro-row-resizing');
    e.preventDefault();
  }

  function onMove(e: PointerEvent): void {
    if (!mode || !d) return;
    if (mode === 'col') {
      d.el.style.width = Math.max(MIN_COL, d.base + (e.clientX - d.start)) + 'px';
    } else {
      d.el.style.height = Math.max(MIN_ROW, d.base + (e.clientY - d.start)) + 'px';
    }
    e.preventDefault();
  }

  function onUp(e: PointerEvent): void {
    if (!mode || !d) return;
    if (mode === 'col') setColWidth(d.id, parseInt(d.el.style.width, 10) || d.el.offsetWidth);
    else setRowHeight(d.id, parseInt(d.el.style.height, 10) || d.el.offsetHeight);
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
export function isOnResizeEdge(e: MouseEvent, edge = 6): boolean {
  const target = e.target instanceof Element ? e.target : null;
  const tr = target?.closest('tbody tr[data-row]');
  if (tr && e.clientY >= tr.getBoundingClientRect().bottom - edge) return true;
  const th = target?.closest('thead th[data-col]');
  if (th && e.clientX >= th.getBoundingClientRect().right - edge) return true;
  return false;
}
