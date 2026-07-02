// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — spreadsheet-style keyboard navigation for the grid.
 *
 * Two states, exactly like a spreadsheet:
 *   • FOCUSED (nav) — the cell <td> itself holds focus. Arrow keys move between
 *     cells; Enter / F2 / typing / double-click begin editing.
 *   • EDITING — the cell's inner control holds focus. Arrows move the
 *     caret (NOT between cells); Escape / Enter / Tab release back to the
 *     focused state on the same cell.
 *
 * Implemented as the ARIA roving-tabindex pattern: navigable <td> are
 * focusable, but only the active one is in the tab order (tabindex 0); inner
 * controls are taken out of the tab order (tabindex -1) and reached only by
 * entering edit mode (or a direct click). So the whole grid is one tab stop and
 * focus state is the single source of truth — we derive "am I editing?" from
 * whether the focused element is the cell or a control inside it.
 *
 * Self-contained: attach to a grid container, call refresh() after each
 * re-render, destroy() on teardown. Knows nothing about batch state.
 */

const CELL_SEL = 'td[data-row][data-col]';
const CELL_TAG = CELL_SEL.split('[')[0] ?? '';
const CONTROL_SEL = '.pro-control, .pro-template-select, .color-trigger';

/** A grid cell's position within the memoised cell matrix. */
interface CellPos {
  m: HTMLElement[][];
  r: number;
  c: number;
}

/** The public navigation controller returned by createGridNav. */
export interface GridNav {
  refresh(opts?: { restoreFocus?: boolean }): void;
  destroy(): void;
  focusActive(opts?: { edit?: boolean }): void;
}

export function createGridNav(container: HTMLElement): GridNav {
  // The active cell is tracked by stable ids, not element identity, so it
  // survives the container's innerHTML being replaced on structural re-renders.
  let active: { rowUid: string | null; colKey: string | null } = { rowUid: null, colKey: null };

  const cellAt = (rowUid: string | null, colKey: string | null): HTMLElement | null =>
    rowUid != null
      ? container.querySelector<HTMLElement>(
          `${CELL_TAG}[data-row="${cssAttr(rowUid)}"][data-col="${cssAttr(colKey)}"]`,
        )
      : null;

  const allCells = (): HTMLElement[] => [...container.querySelectorAll<HTMLElement>(CELL_SEL)];
  const editableIn = (td: HTMLElement | null): HTMLElement | null =>
    td?.querySelector<HTMLElement>(CONTROL_SEL) ?? null;

  // The grid as a 2D array of <td>, in DOM (row, column) order. Memoised: a
  // single arrow keypress queries it several times (posOf + moveFocus), and on a
  // big grid the querySelectorAll-per-press adds up. The cache is invalidated in
  // refresh(), which every structural re-render funnels through, so it can never
  // outlive the DOM it describes (focus/tabindex changes don't alter structure).
  let _matrix: HTMLElement[][] | null = null;
  function matrix(): HTMLElement[][] {
    if (_matrix) return _matrix;
    _matrix = [...container.querySelectorAll<HTMLElement>('tbody tr')]
      .map(tr => [...tr.querySelectorAll<HTMLElement>(':scope > ' + CELL_SEL)])
      .filter(r => r.length);
    return _matrix;
  }

  function posOf(td: HTMLElement): CellPos | null {
    const m = matrix();
    for (let r = 0; r < m.length; r++) {
      const rowCells = m[r];
      if (!rowCells) continue;
      const c = rowCells.indexOf(td);
      if (c !== -1) return { m, r, c };
    }
    return null;
  }

  function moveFocus(dr: number, dc: number, { wrap = false }: { wrap?: boolean } = {}) {
    const td = cellAt(active.rowUid, active.colKey);
    const found = td && posOf(td);
    if (!found) return;
    const { m } = found;
    let { r, c } = found;
    r += dr; c += dc;

    if (wrap) {
      const curRow = m[found.r];
      if (c >= (curRow?.length ?? 0)) { r += 1; c = 0; }
      else if (c < 0) { r -= 1; const prevRow = m[r]; c = prevRow ? prevRow.length - 1 : 0; }
    }
    r = clamp(r, 0, m.length - 1);
    const row = m[r] || [];
    c = clamp(c, 0, row.length - 1);
    row[c]?.focus();
  }

  // ── State transitions ──────────────────────────────────────────────────────
  // openPicker=false keeps focus moving down a column quiet (no datalist/native
  // picker popping on every arrow step). caret controls where the cursor lands
  // in a text field: 'all' selects it (overwrite), 'start'/'end' collapse it to an
  // edge so horizontal traversal flows continuously across cells.
  function beginEdit(
    td: HTMLElement,
    { openPicker = true, caret = 'all' }: { openPicker?: boolean; caret?: 'all' | 'start' | 'end' } = {},
  ): boolean {
    const c = editableIn(td);
    if (!c) return false;
    // Trigger cells open their own popover (asset picker / colour swatches /
    // template search) — click to open, or just focus on a quiet vertical move.
    if (c.matches('[data-asset-pick], .color-trigger, .pro-template-trigger, .pro-blocks-trigger')) {
      if (openPicker) c.click(); else c.focus();
      return true;
    }
    c.focus();
    if (isTextLike(c)) {
      try {
        if (caret === 'start') c.setSelectionRange(0, 0);
        else if (caret === 'end') { const n = c.value.length; c.setSelectionRange(n, n); }
        else c.select();
      } catch { /* number inputs don't support selection ranges */ }
    }
    // Pop the native picker open for date/time/colour cells. Requires user
    // activation in some browsers, so it's best-effort (guarded).
    if (openPicker && c instanceof HTMLInputElement && ['date', 'time', 'datetime-local', 'color'].includes(c.type)) {
      try { c.showPicker?.(); } catch { /* needs activation; field still focused */ }
    }
    return true;
  }

  // Edit-mode move: jump to the adjacent cell and keep editing there
  // (spreadsheet-style). Falls back to focusing the cell when the cell isn't an
  // inline-editable control.
  function moveEditing(dr: number, dc: number) {
    const td = cellAt(active.rowUid, active.colKey);
    const found = td && posOf(td);
    if (!found) return;
    const nr = clamp(found.r + dr, 0, found.m.length - 1);
    const rowCells = found.m[nr] || [];
    const nc = clamp(found.c + dc, 0, rowCells.length - 1);
    const target = rowCells[nc];
    if (!target || target === td) return;
    // Horizontal moves land the caret at the edge we're entering from (so ←/→
    // flow continuously across cells); vertical moves select-all to overwrite.
    const caret = dc < 0 ? 'end' : dc > 0 ? 'start' : 'all';
    if (!beginEdit(target, { openPicker: false, caret })) target.focus();
  }

  // Whether a caret at the edge on a Left/Right press should escape the field or
  // not. Textual fields only escape when the caret is collapsed to the start
  // (Left) or end (Right). Non-textual controls (select/number/colour/etc.) have
  // no caret, so arrows always move between cells.
  function atTextEdge(el: HTMLElement, dir: number): boolean {
    const textual = el instanceof HTMLTextAreaElement
      || (el instanceof HTMLInputElement && ['text', 'url', 'search', 'tel', 'password', ''].includes(el.type));
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || !textual) return true;
    const len = el.value.length;
    return dir < 0
      ? el.selectionStart === 0 && el.selectionEnd === 0
      : el.selectionStart === len && el.selectionEnd === len;
  }

  // Begin editing by typing a printable char: replace the value (spreadsheet
  // overwrite behaviour) and let the existing input listener commit it.
  function beginEditWithKey(td: HTMLElement, key: string): boolean {
    const c = editableIn(td);
    if (!isTextLike(c)) return false;
    c.focus();
    c.value = key;
    c.dispatchEvent(new Event('input', { bubbles: true }));
    try { const n = c.value.length; c.setSelectionRange(n, n); } catch { /* number */ }
    return true;
  }

  const endEdit = (td: HTMLElement) => td.focus(); // focusin handler flips back to nav state

  // ── Focus tracking: the single source of truth for active + mode ────────────
  function onFocusIn(e: FocusEvent) {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const td = target.closest<HTMLElement>(CELL_SEL);
    if (!td || !container.contains(td)) return;
    setActive(td);
    const editing = target !== td; // a control inside the cell is focused
    td.classList.toggle('pro-cell--editing', editing);
  }

  let activeEl: HTMLElement | null = null;
  function setActive(td: HTMLElement) {
    if (activeEl && activeEl !== td) {
      activeEl.tabIndex = -1;
      activeEl.classList.remove('pro-cell--focused', 'pro-cell--editing');
    }
    td.tabIndex = 0;
    td.classList.add('pro-cell--focused');
    activeEl = td;
    active = { rowUid: td.dataset.row ?? null, colKey: td.dataset.col ?? null };
  }

  // ── Keyboard ────────────────────────────────────────────────────────────────
  function onKeyDown(e: KeyboardEvent) {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    // The colour popover runs its own inputs (hex, swatches) — let it handle keys.
    if (target.closest('.color-popover')) return;
    const td = target.closest<HTMLElement>(CELL_SEL);
    if (!td || !container.contains(td)) return;
    const editing = target !== td;

    if (editing) {
      // Up/Down jump to the same input one row away, staying in edit mode — but
      // leave textareas alone so the caret can move between their lines.
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && target.tagName !== 'TEXTAREA') {
        moveEditing(e.key === 'ArrowDown' ? 1 : -1, 0); e.preventDefault(); return;
      }
      // Left/Right move the caret until it reaches the field's edge, then step
      // to the next cell on that side (and keep editing).
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const dir = e.key === 'ArrowLeft' ? -1 : 1;
        if (atTextEdge(target, dir)) { moveEditing(0, dir); e.preventDefault(); }
        return;
      }
      if (e.key === 'Escape') { endEdit(td); e.preventDefault(); return; }
      // Tab commits and moves to the next/prev cell (selected, not editing) —
      // spreadsheet-style, so focus visibly steps right instead of just dropping
      // edit mode on the same cell.
      if (e.key === 'Tab') { moveFocus(0, e.shiftKey ? -1 : 1, { wrap: true }); e.preventDefault(); return; }
      if (e.key === 'Enter') {
        if (target.tagName === 'TEXTAREA') return; // newline in multiline fields
        endEdit(td); e.preventDefault();
      }
      return;
    }

    // FOCUSED (nav) state.
    switch (e.key) {
      case 'ArrowRight': moveFocus(0, 1); e.preventDefault(); break;
      case 'ArrowLeft':  moveFocus(0, -1); e.preventDefault(); break;
      case 'ArrowDown':  moveFocus(1, 0); e.preventDefault(); break;
      case 'ArrowUp':    moveFocus(-1, 0); e.preventDefault(); break;
      case 'Tab':        moveFocus(0, e.shiftKey ? -1 : 1, { wrap: true }); e.preventDefault(); break;
      case 'Enter':
      case 'F2':         if (beginEdit(td)) e.preventDefault(); break;
      case ' ': {
        const c = editableIn(td);
        if (c && ((c instanceof HTMLInputElement && c.type === 'checkbox') || c.matches('[data-asset-pick]'))) {
          c.click(); e.preventDefault();
        } else if (beginEditWithKey(td, ' ')) e.preventDefault();
        break;
      }
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (beginEditWithKey(td, e.key)) e.preventDefault();
        }
    }
  }

  function onDblClick(e: MouseEvent) {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const td = target.closest<HTMLElement>(CELL_SEL);
    if (td && target === td) beginEdit(td); // dbl-click on cell chrome → edit
  }

  container.addEventListener('focusin', onFocusIn);
  container.addEventListener('keydown', onKeyDown);
  container.addEventListener('dblclick', onDblClick);

  /**
   * Re-establish the roving tabindex after a (re-)render. Call once after each
   * grid render. When restoreFocus is true (focus was inside the grid before
   * the render), move focus to the active cell so keyboard flow is unbroken.
   */
  function refresh({ restoreFocus = false }: { restoreFocus?: boolean } = {}) {
    _matrix = null; // the DOM was (re)built — drop the cached cell matrix
    container.querySelectorAll<HTMLElement>(CONTROL_SEL).forEach(c => { c.tabIndex = -1; });
    const cells = allCells();
    if (!cells.length) { activeEl = null; return; }

    cells.forEach(td => { td.tabIndex = -1; td.classList.remove('pro-cell--focused', 'pro-cell--editing'); });

    const target = cellAt(active.rowUid, active.colKey) || cells[0];
    if (!target) return;
    target.tabIndex = 0;
    target.classList.add('pro-cell--focused');
    activeEl = target;
    active = { rowUid: target.dataset.row ?? null, colKey: target.dataset.col ?? null };

    if (restoreFocus) target.focus();
  }

  /**
   * Move focus to the active cell (the first cell after a fresh mount).
   * With { edit: true } it also opens that cell's editor — used on entry so the
   * template chooser is open and keyboard-selectable straight away.
   */
  function focusActive({ edit = false }: { edit?: boolean } = {}) {
    const td = cellAt(active.rowUid, active.colKey) || allCells()[0];
    if (!td) return;
    if (edit && beginEdit(td)) return;
    td.focus();
  }

  function destroy() {
    container.removeEventListener('focusin', onFocusIn);
    container.removeEventListener('keydown', onKeyDown);
    container.removeEventListener('dblclick', onDblClick);
  }

  return { refresh, destroy, focusActive };
}

function isTextLike(c: HTMLElement | null): c is HTMLInputElement | HTMLTextAreaElement {
  if (!c) return false;
  if (c instanceof HTMLTextAreaElement) return true;
  if (c instanceof HTMLInputElement) return ['text', 'number', 'url'].includes(c.type);
  return false;
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

// Escape a value for safe use inside an attribute selector.
const cssAttr = (s: string | null): string => String(s).replace(/["\\]/g, '\\$&');
