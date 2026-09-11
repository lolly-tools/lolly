// SPDX-License-Identifier: MPL-2.0
/**
 * A framework-free, virtualized datagrid (plan 89).
 *
 * Renders only the rows inside the scroll viewport (+ a small overscan), recycling
 * DOM as you scroll, so a 100k-row spreadsheet stays responsive on a fixed DOM
 * budget. Real DOM (not canvas), so it themes, is keyboard-accessible, and exports
 * through the normal SVG walker. In/out is `TableValue` ({columns, rows}) - a drop-in
 * for the `table` input control, `/pro` grids, and the `#/data` viewer.
 *
 * The windowing math (`visibleRange`) is pure and unit-tested; the mount function is
 * the DOM glue. Editing commits through `onChange`, so the host keeps ownership of
 * undo/state (the grid never forks its own store).
 */

import type { TableValue } from '@lolly/engine';
import '../styles/parts/data-grid.css';

/** The slice of rows to render for a given scroll position, plus the offset + total
 *  height that place that slice inside a full-height scroll canvas. Pure. */
export function visibleRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  total: number,
  overscan = 4,
): { first: number; last: number; offsetY: number; totalHeight: number } {
  const rh = Math.max(1, rowHeight);
  const totalHeight = total * rh;
  if (total <= 0 || viewportHeight <= 0) return { first: 0, last: 0, offsetY: 0, totalHeight };
  const firstVisible = Math.floor(Math.max(0, scrollTop) / rh);
  const first = Math.max(0, firstVisible - overscan);
  const visible = Math.ceil(viewportHeight / rh) + overscan * 2;
  const last = Math.min(total, first + visible);
  return { first, last, offsetY: first * rh, totalHeight };
}

export interface DataGridOptions {
  value: TableValue;
  /** Editable (viewer read-only when false). Default true. */
  editable?: boolean;
  /** Debounced-commit callback with the whole updated table. */
  onChange?: (next: TableValue, change?: { deletedRow: number }) => void;
  /** Fixed-schema grids keep their column headings. */
  fixedColumns?: boolean;
  /** Column indices that are read-only even when the grid is editable (e.g. a
   *  formula column shown as its computed value - the honest-limits marker). */
  readOnlyCols?: number[];
  /** Fixed row height in px (default 28). */
  rowHeight?: number;
  /** Rows above/below the viewport to keep rendered (default 4). */
  overscan?: number;
}

export interface DataGridHandle {
  setValue(next: TableValue): void;
  getValue(): TableValue;
  destroy(): void;
}

const ROW_H = 28;
const MIN_COL = 64;
const DEFAULT_COL = 128;

/** Sample the first N rows of a column to pick a sensible width (clamped). */
function colWidth(value: TableValue, col: number, sample = 40): number {
  let max = (value.columns[col] ?? '').length;
  const n = Math.min(sample, value.rows.length);
  for (let r = 0; r < n; r++) max = Math.max(max, (value.rows[r]?.[col] ?? '').length);
  return Math.max(MIN_COL, Math.min(DEFAULT_COL * 3, 12 + max * 8));
}

/**
 * Mount a virtualized grid into `container`. Returns a handle to update the value or
 * tear down. The container is emptied and given the grid's own markup.
 */
export function mountDataGrid(container: HTMLElement, opts: DataGridOptions): DataGridHandle {
  const rowHeight = opts.rowHeight ?? ROW_H;
  const overscan = opts.overscan ?? 4;
  const editable = opts.editable !== false;
  const readOnly = new Set(opts.readOnlyCols ?? []);
  // Trailing row-delete gutter - only when editable. Kept as a real column of the
  // flex row (not an overlay) so it stays aligned under virtualization and is
  // always reachable, matching the plain <table>'s per-row × the grid replaces.
  const actionW = editable ? 30 : 0;
  let value: TableValue = clone(opts.value);
  let widths = value.columns.map((_, c) => colWidth(value, c));

  container.classList.add('data-grid');
  container.setAttribute('role', 'grid');
  container.innerHTML = `
    <div class="dg-viewport" tabindex="0">
      <div class="dg-inner">
        <div class="dg-header" role="row"></div>
        <div class="dg-canvas"><div class="dg-rows"></div></div>
      </div>
    </div>`;
  const viewport = container.querySelector<HTMLElement>('.dg-viewport')!;
  const inner = container.querySelector<HTMLElement>('.dg-inner')!;
  const header = container.querySelector<HTMLElement>('.dg-header')!;
  const canvas = container.querySelector<HTMLElement>('.dg-canvas')!;
  const rowsEl = container.querySelector<HTMLElement>('.dg-rows')!;

  const totalWidth = () => widths.reduce((a, b) => a + b, 0) + actionW;

  function renderHeader(): void {
    inner.style.width = `${totalWidth()}px`;
    header.style.height = `${rowHeight}px`;
    // Each header carries a hover-revealed × to delete its column (skipped for a
    // read-only column); a trailing empty corner closes the row-delete gutter.
    header.innerHTML = value.columns
      .map((c, i) => `<div class="dg-cell dg-head-cell${readOnly.has(i) ? ' dg-ro' : ''}" role="columnheader" style="width:${widths[i]}px" data-col="${i}"><span class="dg-head-label">${esc(c)}</span>${editable && !opts.fixedColumns && !readOnly.has(i) ? `<button type="button" class="dg-del-col" data-del-col="${i}" title="Delete column" aria-label="Delete column">×</button>` : ''}</div>`)
      .join('')
      + (editable ? `<div class="dg-rowctl dg-rowctl-head" style="width:${actionW}px" aria-hidden="true"></div>` : '');
  }

  let rangeFirst = -1;
  let rangeLast = -1;
  function renderRows(force = false): void {
    const { first, last, offsetY, totalHeight } = visibleRange(
      viewport.scrollTop, viewport.clientHeight, rowHeight, value.rows.length, overscan,
    );
    canvas.style.height = `${totalHeight}px`;
    if (!force && first === rangeFirst && last === rangeLast) return;
    rangeFirst = first; rangeLast = last;
    rowsEl.style.transform = `translateY(${offsetY}px)`;
    let html = '';
    for (let r = first; r < last; r++) {
      const row = value.rows[r] ?? [];
      html += `<div class="dg-row" role="row" aria-rowindex="${r + 2}" style="height:${rowHeight}px" data-row="${r}">`;
      for (let c = 0; c < value.columns.length; c++) {
        const ro = !editable || readOnly.has(c);
        html += `<div class="dg-cell${ro ? ' dg-ro' : ''}" role="gridcell" style="width:${widths[c]}px" data-row="${r}" data-col="${c}"${ro ? '' : ' tabindex="-1"'}>${esc(row[c] ?? '')}</div>`;
      }
      // Trailing row-delete × (gutter column). Not a .dg-cell, so it never starts
      // a cell edit; the delegated click handler below removes the row.
      if (editable) html += `<div class="dg-rowctl" data-del-row="${r}" role="button" tabindex="-1" title="Delete row" aria-label="Delete row" style="width:${actionW}px">×</div>`;
      html += '</div>';
    }
    rowsEl.innerHTML = html;
  }

  function refreshAria(): void {
    container.setAttribute('aria-rowcount', String(value.rows.length + 1));
    container.setAttribute('aria-colcount', String(value.columns.length));
  }

  // ── editing: click a cell → a single floating <input> over it ────────────────
  let editor: HTMLInputElement | null = null;
  function commit(): void {
    if (!editor) return;
    const activeEditor = editor;
    editor = null; // Removing a focused input fires blur; do not re-enter commit.
    const r = Number(activeEditor.dataset.row), c = Number(activeEditor.dataset.col);
    const next = clone(value);
    (next.rows[r] ??= [])[c] = activeEditor.value;
    value = next;
    const cell = rowsEl.querySelector<HTMLElement>(`.dg-cell[data-row="${r}"][data-col="${c}"]`);
    if (cell) cell.textContent = activeEditor.value;
    activeEditor.remove();
    // Keep focus in the grid when the editor simply vanished (Enter, scroll, or
    // programmatic removal) so the sidebar defers its rebuild (inputs-sync
    // isEditingGrid) - but never STEAL it back if the user clicked a real element
    // elsewhere (blur-to-outside), where a rebuild is the right thing.
    const ae = document.activeElement;
    if (!ae || ae === document.body) viewport.focus();
    opts.onChange?.(clone(value));
  }
  function beginEdit(cell: HTMLElement): void {
    if (!editable) return;
    const c = Number(cell.dataset.col);
    if (readOnly.has(c)) return;
    commit();
    const r = Number(cell.dataset.row);
    const box = cell.getBoundingClientRect();
    const host = viewport.getBoundingClientRect();
    editor = document.createElement('input');
    editor.className = 'dg-editor';
    editor.value = value.rows[r]?.[c] ?? '';
    editor.dataset.row = String(r); editor.dataset.col = String(c);
    editor.style.left = `${box.left - host.left + viewport.scrollLeft}px`;
    editor.style.top = `${box.top - host.top + viewport.scrollTop}px`;
    editor.style.width = `${box.width}px`;
    editor.style.height = `${box.height}px`;
    inner.appendChild(editor);
    editor.focus(); editor.select();
    editor.addEventListener('blur', commit, { once: true });
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); viewport.focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); const cancelled = editor; editor = null; cancelled?.remove(); viewport.focus(); }
    });
  }

  // ── structural edits: delete a row / column, commit through onChange ─────────
  function deleteRow(r: number): void {
    if (!editable || r < 0 || r >= value.rows.length) return;
    commit();
    value = clone(value);
    value.rows.splice(r, 1);
    refreshAria();
    renderRows(true);           // row indices shifted; columns (widths) unchanged
    opts.onChange?.(clone(value), { deletedRow: r });
  }
  function deleteCol(c: number): void {
    if (!editable || opts.fixedColumns || c < 0 || c >= value.columns.length) return;
    commit();
    value = clone(value);
    value.columns.splice(c, 1);
    for (const row of value.rows) row.splice(c, 1);
    widths = value.columns.map((_, i) => colWidth(value, i));
    // Read-only column indices shift left past the deleted one.
    const kept = [...readOnly].filter(i => i !== c).map(i => (i > c ? i - 1 : i));
    readOnly.clear(); for (const i of kept) readOnly.add(i);
    full();
    opts.onChange?.(clone(value));
  }

  const onScroll = (): void => { if (editor) commit(); renderRows(); };
  const onDblClick = (e: MouseEvent): void => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('.dg-row .dg-cell');
    if (cell) beginEdit(cell);
  };
  // Delegated (rows recycle on scroll): a click on a row's × or a header's ×.
  const onClick = (e: MouseEvent): void => {
    const t = e.target as HTMLElement;
    const delRow = t.closest<HTMLElement>('[data-del-row]');
    if (delRow) { e.preventDefault(); deleteRow(Number(delRow.dataset.delRow)); return; }
    const delCol = t.closest<HTMLElement>('[data-del-col]');
    if (delCol) { e.preventDefault(); deleteCol(Number(delCol.dataset.delCol)); }
  };
  viewport.addEventListener('scroll', onScroll, { passive: true });
  rowsEl.addEventListener('dblclick', onDblClick);
  container.addEventListener('click', onClick);

  // A resize observer keeps the window correct when the viewport grows/shrinks.
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => renderRows(true)) : null;
  ro?.observe(viewport);

  function full(): void { renderHeader(); refreshAria(); renderRows(true); }
  full();

  return {
    setValue(next) { value = clone(next); widths = value.columns.map((_, c) => colWidth(value, c)); full(); },
    getValue() { return clone(value); },
    destroy() {
      viewport.removeEventListener('scroll', onScroll);
      rowsEl.removeEventListener('dblclick', onDblClick);
      container.removeEventListener('click', onClick);
      ro?.disconnect();
      const disposedEditor = editor; editor = null; disposedEditor?.remove();
      container.replaceChildren();
      container.classList.remove('data-grid');
      for (const a of ['role', 'aria-rowcount', 'aria-colcount']) container.removeAttribute(a);
    },
  };
}

function clone(t: TableValue): TableValue {
  return { columns: [...t.columns], rows: t.rows.map((r) => [...r]) };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
