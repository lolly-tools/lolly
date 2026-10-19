// SPDX-License-Identifier: MPL-2.0
import { CellRange, clipboardCells, cellsToTsv, tileCells, type CellAddress } from './cell-range.ts';
import { escapeHtml } from '../lib/util/escape.ts';
import { announce } from '../a11y.ts';
import { t, tRaw } from '../i18n.ts';

const CELL = 'td[data-row][data-col]';
interface CellSelectionOptions {
  rows(): string[];
  columns(): string[];
  values(rows: string[], cols: string[]): string[][];
  paste(start: CellAddress, cells: string[][], explicit: boolean): void;
  reveal(row: string): void;
  selected(): void;
  writeText(text: string): Promise<void>;
}

/** Cell rectangles are independent of the row checkboxes used by batch actions. */
export function mountCellSelection(root: HTMLElement, options: CellSelectionOptions) {
  const grid = root.querySelector<HTMLElement>('#pro-grid-host')!;
  const bar = root.querySelector<HTMLElement>('[data-row-actions]')!;
  const actions = root.querySelector<HTMLElement>('[data-cell-actions]')!;
  const count = root.querySelector<HTMLElement>('[data-cell-count]')!;
  const copyButton = root.querySelector<HTMLButtonElement>('[data-copy-cells]')!;
  const clearButton = root.querySelector<HTMLButtonElement>('[data-clear-cells]')!;
  const range = new CellRange();
  const rectangle = () => range.rectangle(options.rows(), options.columns());
  const address = (td: HTMLElement): CellAddress => ({ row: td.dataset.row!, col: td.dataset.col! });
  const cell = (target: EventTarget | null) => target instanceof HTMLElement ? target.closest<HTMLElement>(CELL) : null;
  let dragging = false, suppressClick = false, frame = 0, x = 0, y = 0;
  let active = true;

  function refresh(): void {
    if (!active) return;
    const rect = rectangle();
    bar.classList.toggle('has-cell-selection', !!rect);
    actions.hidden = !rect;
    if (rect) count.textContent = tRaw('{rows} × {cols} cells selected', { rows: rect.rows.length, cols: rect.cols.length });
    const rows = new Set(rect?.rows), cols = new Set(rect?.cols);
    for (const td of grid.querySelectorAll<HTMLElement>(CELL)) {
      const selected = rows.has(td.dataset.row!) && cols.has(td.dataset.col!);
      td.classList.toggle('is-cell-selected', selected);
      td.setAttribute('aria-selected', String(selected));
      for (const [edge, yes] of Object.entries({ top: td.dataset.row === rect?.rows[0], bottom: td.dataset.row === rect?.rows.at(-1), left: td.dataset.col === rect?.cols[0], right: td.dataset.col === rect?.cols.at(-1) })) td.classList.toggle(`cell-range-${edge}`, selected && yes);
    }
  }
  function clear(): void { range.clear(); refresh(); }
  function select(td: HTMLElement, extend = false): void {
    range.select(address(td), extend); options.selected(); refresh();
  }
  function focus(at: CellAddress): void {
    options.reveal(at.row);
    grid.querySelector<HTMLElement>(`td[data-row="${CSS.escape(at.row)}"][data-col="${CSS.escape(at.col)}"]`)?.focus();
  }
  function down(event: PointerEvent): void {
    const td = cell(event.target);
    if (!td || event.button !== 0 || grid.inert || (event.target as HTMLElement).closest('.color-popover')) return;
    if (event.clientY >= td.getBoundingClientRect().bottom - 6) return;
    if (!event.shiftKey && document.activeElement === event.target && event.target !== td) return;
    if (!range.anchor && event.shiftKey) {
      const focused = grid.querySelector<HTMLElement>('.pro-cell--focused');
      if (focused) range.select(address(focused));
    }
    select(td, event.shiftKey);
    const control = (event.target as HTMLElement).closest('button, select, input[type="checkbox"]');
    suppressClick = event.shiftKey || !control;
    if (suppressClick) { event.preventDefault(); td.focus(); }
    if (event.pointerType !== 'touch') { dragging = true; x = event.clientX; y = event.clientY; }
  }
  function extendAtPointer(): void {
    if (!dragging) return;
    const scroller = grid.querySelector<HTMLElement>('.pro-grid-scroll');
    if (!scroller) return;
    const box = scroller.getBoundingClientRect();
    const dx = x < box.left + 24 ? -18 : x > box.right - 24 ? 18 : 0;
    const dy = y < box.top + 32 ? -18 : y > box.bottom - 24 ? 18 : 0;
    if (dx || dy) scroller.scrollBy(dx, dy);
    const td = cell(document.elementFromPoint(Math.max(box.left + 2, Math.min(box.right - 2, x)), Math.max(box.top + 36, Math.min(box.bottom - 2, y))));
    if (td && grid.contains(td) && (td.dataset.row !== range.end?.row || td.dataset.col !== range.end?.col)) {
      range.select(address(td), true); suppressClick = true; refresh();
    }
    if (dx || dy) frame = requestAnimationFrame(extendAtPointer);
  }
  function move(event: PointerEvent): void {
    if (!dragging) return;
    x = event.clientX; y = event.clientY;
    cancelAnimationFrame(frame); extendAtPointer();
  }
  function up(): void { dragging = false; cancelAnimationFrame(frame); }
  function click(event: MouseEvent): void {
    if (!cell(event.target) || !suppressClick) return;
    suppressClick = false; event.preventDefault(); event.stopImmediatePropagation();
  }
  function key(event: KeyboardEvent): void {
    const td = cell(event.target);
    if (!td || event.target !== td || event.defaultPrevented) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      const rows = options.rows(), cols = options.columns();
      if (!rows.length || !cols.length) return;
      range.select({ row: rows[0]!, col: cols[0]! }); range.select({ row: rows.at(-1)!, col: cols.at(-1)! }, true);
      options.selected(); refresh(); event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (event.key === 'Escape' && range.anchor) { clear(); event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (event.shiftKey && event.key.startsWith('Arrow')) {
      if (!range.anchor) range.select(address(td));
      const end = range.end!;
      const rows = options.rows(), cols = options.columns();
      const r = Math.max(0, Math.min(rows.length - 1, rows.indexOf(end.row) + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0)));
      const c = Math.max(0, Math.min(cols.length - 1, cols.indexOf(end.col) + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0)));
      range.select({ row: rows[r]!, col: cols[c]! }, true); options.selected(); focus(range.end!); refresh();
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (event.key.startsWith('Arrow') || event.key === 'Tab') queueMicrotask(() => { const next = cell(document.activeElement); if (active && next) select(next); });
  }
  function focusIn(event: FocusEvent): void {
    const td = cell(event.target);
    if (td && event.target !== td && !(event.target as HTMLElement).closest('.color-popover')) select(td);
  }
  function clipboard(): { text: string; html: string } | null {
    const rect = rectangle();
    if (!rect) return null;
    const cells = options.values(rect.rows, rect.cols);
    return { text: cellsToTsv(cells), html: `<table data-lolly-cells="true"><tbody>${cells.map(row => `<tr>${row.map(value => `<td style="white-space:pre-wrap">${escapeHtml(value).replace(/\r?\n/g, '<br>')}</td>`).join('')}</tr>`).join('')}</tbody></table>` };
  }
  function copy(event: ClipboardEvent): void {
    const td = cell(event.target);
    if (!td || event.target !== td) return;
    if (!range.anchor) select(td);
    const data = clipboard();
    if (!data || !event.clipboardData) return;
    event.preventDefault(); event.clipboardData.setData('text/plain', data.text); event.clipboardData.setData('text/html', data.html);
    announce(t('Cells copied'));
  }
  async function copyCells(): Promise<void> {
    const data = clipboard();
    if (!data) return;
    try {
      if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([data.text], { type: 'text/plain' }), 'text/html': new Blob([data.html], { type: 'text/html' }) })]);
      else await options.writeText(data.text);
      announce(t('Cells copied'));
    } catch { announce(t('Could not copy cells. Focus the grid and press Ctrl+C or Command+C.')); }
  }
  function paste(event: ClipboardEvent): void {
    const td = cell(event.target);
    if (!td || grid.inert || !event.clipboardData) return;
    const text = event.clipboardData.getData('text/plain');
    const html = new DOMParser().parseFromString(event.clipboardData.getData('text/html'), 'text/html');
    const table = html.querySelector('table');
    if (!table && !event.clipboardData.types.includes('text/plain')) return;
    if (event.target !== td && !table && !/[\t\n]/.test(text)) return;
    const cells = table ? [...table.rows].map(row => [...row.cells].map(cell => { for (const br of cell.querySelectorAll('br')) br.replaceWith('\n'); return cell.textContent ?? ''; })) : clipboardCells(text);
    if (!cells.length) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const rect = rectangle();
    const multiple = !!rect && (rect.rows.length > 1 || rect.cols.length > 1);
    const start = multiple ? rect.start : address(td);
    options.paste(start, multiple ? tileCells(cells, rect.rows.length, rect.cols.length) : cells, multiple || !!table?.hasAttribute('data-lolly-cells'));
  }
  grid.addEventListener('pointerdown', down, true); grid.addEventListener('click', click, true);
  document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  grid.addEventListener('keydown', key, true); grid.addEventListener('focusin', focusIn);
  grid.addEventListener('copy', copy); grid.addEventListener('paste', paste, true);
  copyButton.addEventListener('click', copyCells); clearButton.addEventListener('click', clear);
  return { refresh, clear, multiple: () => { const rect = rectangle(); return !!rect && rect.rows.length * rect.cols.length > 1; }, destroy(): void {
    active = false; up(); grid.removeEventListener('pointerdown', down, true); grid.removeEventListener('click', click, true);
    document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
    grid.removeEventListener('keydown', key, true); grid.removeEventListener('focusin', focusIn);
    grid.removeEventListener('copy', copy); grid.removeEventListener('paste', paste, true);
    copyButton.removeEventListener('click', copyCells); clearButton.removeEventListener('click', clear);
  } };
}
