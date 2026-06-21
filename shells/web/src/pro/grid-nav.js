/**
 * Pro / Batch mode — spreadsheet-style keyboard navigation for the grid.
 *
 * Two states, exactly like a spreadsheet:
 *   • FOCUSED (nav)  — the cell <td> itself holds focus. Arrow keys move between
 *                      cells; Enter / F2 / typing / double-click begin editing.
 *   • EDITING        — the cell's inner control holds focus. Arrows move the
 *                      caret (NOT between cells); Escape / Enter / Tab release
 *                      back to the focused state on the same cell.
 *
 * Implemented with the ARIA roving-tabindex pattern: every navigable <td> is
 * focusable, but only the active one is in the tab order (tabindex 0); inner
 * controls are taken out of the tab order (tabindex -1) and are reached only by
 * entering edit mode (or a direct click). So the whole grid is one tab stop and
 * focus state is the single source of truth — we derive "am I editing?" from
 * whether the focused element is the cell or a control inside it.
 *
 * Self-contained: attach to the grid container, call refresh() after every
 * re-render, destroy() on teardown. Knows nothing about batch state.
 */

const CELL_SEL = 'td[data-row][data-col]';
const CONTROL_SEL = '.pro-control, .pro-template-select, .color-trigger';

export function createGridNav(container) {
  // The active cell is tracked by stable ids, not element identity, so it
  // survives the container's innerHTML being replaced on structural re-renders.
  let active = { rowUid: null, colKey: null };

  const cellAt = (rowUid, colKey) =>
    rowUid != null && container.querySelector(
      `${CELL_SEL.split('[')[0]}[data-row="${cssAttr(rowUid)}"][data-col="${cssAttr(colKey)}"]`,
    );

  const allCells = () => [...container.querySelectorAll(CELL_SEL)];
  const editableIn = (td) => td?.querySelector(CONTROL_SEL) ?? null;

  // The grid as a 2D array of <td>, in DOM (row, column) order. Rebuilt on
  // demand — cheap, and always correct after re-renders.
  function matrix() {
    return [...container.querySelectorAll('tbody tr')]
      .map(tr => [...tr.querySelectorAll(':scope > ' + CELL_SEL)])
      .filter(r => r.length);
  }

  function posOf(td) {
    const m = matrix();
    for (let r = 0; r < m.length; r++) {
      const c = m[r].indexOf(td);
      if (c !== -1) return { m, r, c };
    }
    return null;
  }

  function moveFocus(dr, dc, { wrap = false } = {}) {
    const td = cellAt(active.rowUid, active.colKey);
    const found = td && posOf(td);
    if (!found) return;
    const { m } = found;
    let { r, c } = found;
    r += dr; c += dc;

    if (wrap) {
      if (c >= m[found.r].length) { r += 1; c = 0; }
      else if (c < 0) { r -= 1; c = (m[r] ? m[r].length - 1 : 0); }
    }
    r = clamp(r, 0, m.length - 1);
    const row = m[r] || [];
    c = clamp(c, 0, row.length - 1);
    row[c]?.focus();
  }

  // ── State transitions ──────────────────────────────────────────────────────
  // openPicker=false keeps focus moving down a column quiet (no datalist/native
  // picker popping on every arrow step). caret controls where the cursor lands
  // in a text field: 'all' selects (overwrite), 'start'/'end' collapse it to an
  // edge so horizontal traversal flows continuously across cells.
  function beginEdit(td, { openPicker = true, caret = 'all' } = {}) {
    const c = editableIn(td);
    if (!c) return false;
    // Trigger cells open their own popover (asset picker / colour swatches /
    // template search) — click to open, or just focus on a quiet vertical move.
    if (c.matches('[data-asset-pick], .color-trigger, .pro-template-trigger')) {
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
    if (openPicker && ['date', 'time', 'datetime-local', 'color'].includes(c.type)) {
      try { c.showPicker?.(); } catch { /* needs activation; the field is still focused */ }
    }
    return true;
  }

  // Edit-mode move: jump to an adjacent cell and keep editing there
  // (spreadsheet-style). Falls back to focusing the cell when that cell isn't an
  // inline-editable control.
  function moveEditing(dr, dc) {
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

  // Is the caret at the edge a Left/Right press should escape the field on?
  // Textual fields only escape when the caret is collapsed at the very start
  // (Left) or very end (Right). Non-textual controls (select/number/colour/etc.)
  // have no caret, so arrows always move between cells.
  function atTextEdge(el, dir) {
    const textual = el.tagName === 'TEXTAREA'
      || (el.tagName === 'INPUT' && ['text', 'url', 'search', 'tel', 'password', ''].includes(el.type));
    if (!textual) return true;
    const len = el.value.length;
    return dir < 0
      ? el.selectionStart === 0 && el.selectionEnd === 0
      : el.selectionStart === len && el.selectionEnd === len;
  }

  // Begin editing by typing a printable char: replace the value (spreadsheet
  // overwrite behaviour) and let the existing input listener commit it.
  function beginEditWithKey(td, key) {
    const c = editableIn(td);
    if (!isTextLike(c)) return false;
    c.focus();
    c.value = key;
    c.dispatchEvent(new Event('input', { bubbles: true }));
    try { const n = c.value.length; c.setSelectionRange(n, n); } catch { /* number */ }
    return true;
  }

  const endEdit = (td) => td.focus(); // focusin handler flips back to nav state

  // ── Focus tracking: the single source of truth for active + mode ────────────
  function onFocusIn(e) {
    const td = e.target.closest(CELL_SEL);
    if (!td || !container.contains(td)) return;
    setActive(td);
    const editing = e.target !== td; // a control inside the cell is focused
    td.classList.toggle('pro-cell--editing', editing);
  }

  let activeEl = null;
  function setActive(td) {
    if (activeEl && activeEl !== td) {
      activeEl.tabIndex = -1;
      activeEl.classList.remove('pro-cell--focused', 'pro-cell--editing');
    }
    td.tabIndex = 0;
    td.classList.add('pro-cell--focused');
    activeEl = td;
    active = { rowUid: td.dataset.row, colKey: td.dataset.col };
  }

  // ── Keyboard ────────────────────────────────────────────────────────────────
  function onKeyDown(e) {
    // The colour popover runs its own inputs (hex, swatches) — let it handle keys.
    if (e.target.closest?.('.color-popover')) return;
    const td = e.target.closest?.(CELL_SEL);
    if (!td || !container.contains(td)) return;
    const editing = e.target !== td;

    if (editing) {
      // Up/Down jump to the same input one row away, staying in edit mode — but
      // leave textareas alone so the caret can move between their lines.
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target.tagName !== 'TEXTAREA') {
        moveEditing(e.key === 'ArrowDown' ? 1 : -1, 0); e.preventDefault(); return;
      }
      // Left/Right move the caret until it reaches the field's edge, then step
      // to the next cell on that side (and keep editing).
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const dir = e.key === 'ArrowLeft' ? -1 : 1;
        if (atTextEdge(e.target, dir)) { moveEditing(0, dir); e.preventDefault(); }
        return;
      }
      if (e.key === 'Escape') { endEdit(td); e.preventDefault(); return; }
      // Tab commits and moves to the next/prev cell (selected, not editing) —
      // spreadsheet-style, so focus visibly steps right instead of just dropping
      // edit mode on the same cell.
      if (e.key === 'Tab') { moveFocus(0, e.shiftKey ? -1 : 1, { wrap: true }); e.preventDefault(); return; }
      if (e.key === 'Enter') {
        if (e.target.tagName === 'TEXTAREA') return; // newline in multiline fields
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
        if (c?.type === 'checkbox' || c?.matches('[data-asset-pick]')) { c.click(); e.preventDefault(); }
        else if (beginEditWithKey(td, ' ')) e.preventDefault();
        break;
      }
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          if (beginEditWithKey(td, e.key)) e.preventDefault();
        }
    }
  }

  function onDblClick(e) {
    const td = e.target.closest?.(CELL_SEL);
    if (td && e.target === td) beginEdit(td); // dbl-click on cell chrome → edit
  }

  container.addEventListener('focusin', onFocusIn);
  container.addEventListener('keydown', onKeyDown);
  container.addEventListener('dblclick', onDblClick);

  /**
   * Re-establish the roving tabindex after a (re-)render. Call once after each
   * grid render. When restoreFocus is true (focus was inside the grid before
   * the render), move focus to the active cell so keyboard flow is unbroken.
   */
  function refresh({ restoreFocus = false } = {}) {
    container.querySelectorAll(CONTROL_SEL).forEach(c => { c.tabIndex = -1; });
    const cells = allCells();
    if (!cells.length) { activeEl = null; return; }

    cells.forEach(td => { td.tabIndex = -1; td.classList.remove('pro-cell--focused', 'pro-cell--editing'); });

    const target = cellAt(active.rowUid, active.colKey) || cells[0];
    target.tabIndex = 0;
    target.classList.add('pro-cell--focused');
    activeEl = target;
    active = { rowUid: target.dataset.row, colKey: target.dataset.col };

    if (restoreFocus) target.focus();
  }

  /**
   * Move focus to the active cell (the first cell after a fresh mount).
   * With { edit: true } it also opens that cell's editor — used on entry so the
   * template chooser is open and keyboard-selectable straight away.
   */
  function focusActive({ edit = false } = {}) {
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

function isTextLike(c) {
  if (!c) return false;
  if (c.tagName === 'TEXTAREA') return true;
  if (c.tagName === 'INPUT') return ['text', 'number', 'url'].includes(c.type);
  return false;
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Escape a value for safe use inside an attribute selector.
const cssAttr = (s) => String(s).replace(/["\\]/g, '\\$&');
