// SPDX-License-Identifier: MPL-2.0
/**
 * Pure, DOM-free grid helpers for the `table` input (engine 1.78) in the terminal.
 *
 * A `table` value is user DATA in both dimensions (columns AND rows are the user's, unlike
 * `blocks`, whose fields are declared in the manifest), so the terminal editor is a real
 * grid rather than a field list: row -1 addresses the HEADING row, rows >= 0 the body.
 * Every mutator returns a NEW rectangular TableValue - the engine's updateInput rejects a
 * ragged grid outright, so keeping rows padded here is the difference between an edit
 * landing and an edit silently doing nothing.
 *
 * The view owns keys and layout; everything that decides what the grid BECOMES lives here
 * so it can be tested without Ink. Tested in table-edit.test.ts.
 */
import type { TableValue } from '../../../../engine/src/inputs.ts';

/** Read a model item's value as a grid, tolerating null/garbage (→ empty grid). */
export function asTable(v: unknown): TableValue {
  const o = v as { columns?: unknown; rows?: unknown } | null | undefined;
  const columns = Array.isArray(o?.columns) ? o!.columns.map(c => String(c ?? '')) : [];
  const rows = Array.isArray(o?.rows)
    ? o!.rows.filter(Array.isArray).map(r => {
        const out = (r as unknown[]).slice(0, columns.length).map(c => String(c ?? ''));
        while (out.length < columns.length) out.push('');
        return out;
      })
    : [];
  return { columns, rows };
}

/** One-line readout for the inputs list: shape first, then the headings that fit. */
export function tableSummary(v: unknown): string {
  const t = asTable(v);
  if (!t.columns.length) return 'empty - ⏎ to edit · i import CSV/TSV';
  const heads = t.columns.filter(Boolean).join(', ');
  const shape = `${t.columns.length} col${t.columns.length === 1 ? '' : 's'} × ${t.rows.length} row${t.rows.length === 1 ? '' : 's'}`;
  return `${shape}${heads ? ` · ${heads}` : ''} - ⏎ to edit · i import`;
}

/** Cell text at (row, col); row -1 = the heading row. '' when out of range. */
export function cellAt(t: TableValue, row: number, col: number): string {
  if (col < 0 || col >= t.columns.length) return '';
  return (row < 0 ? t.columns[col] : t.rows[row]?.[col]) ?? '';
}

/** Set one cell (row -1 = heading). Out-of-range coordinates return the grid unchanged. */
export function setCell(t: TableValue, row: number, col: number, value: string): TableValue {
  if (col < 0 || col >= t.columns.length) return t;
  if (row < 0) {
    const columns = [...t.columns];
    columns[col] = value;
    return { columns, rows: t.rows.map(r => [...r]) };
  }
  if (row >= t.rows.length) return t;
  const rows = t.rows.map((r, i) => (i === row ? r.map((c, j) => (j === col ? value : c)) : [...r]));
  return { columns: [...t.columns], rows };
}

/** Insert a blank row AFTER `after` (-1 → at the top). A grid with no columns gains one. */
export function addRow(t: TableValue, after: number): TableValue {
  const columns = t.columns.length ? [...t.columns] : ['Column 1'];
  const rows = t.rows.map(r => {
    const out = r.slice(0, columns.length);
    while (out.length < columns.length) out.push('');
    return out;
  });
  const at = Math.min(Math.max(after + 1, 0), rows.length);
  rows.splice(at, 0, new Array(columns.length).fill(''));
  return { columns, rows };
}

/** Delete a body row (no-op for the heading row or an out-of-range index). */
export function deleteRow(t: TableValue, row: number): TableValue {
  if (row < 0 || row >= t.rows.length) return t;
  return { columns: [...t.columns], rows: t.rows.filter((_, i) => i !== row) };
}

/** Insert a blank column AFTER `after` (-1 → first), padding every row. */
export function addColumn(t: TableValue, after: number): TableValue {
  const at = Math.min(Math.max(after + 1, 0), t.columns.length);
  const columns = [...t.columns];
  columns.splice(at, 0, `Column ${columns.length + 1}`);
  const rows = t.rows.map(r => {
    const out = [...r];
    while (out.length < t.columns.length) out.push('');
    out.splice(at, 0, '');
    return out;
  });
  return { columns, rows };
}

/** Delete a column and the matching cell in every row. Deleting the last column empties
 *  the grid entirely (rows of zero cells are meaningless). */
export function deleteColumn(t: TableValue, col: number): TableValue {
  if (col < 0 || col >= t.columns.length) return t;
  const columns = t.columns.filter((_, i) => i !== col);
  if (!columns.length) return { columns: [], rows: [] };
  const rows = t.rows.map(r => {
    const out = [...r];
    while (out.length < t.columns.length) out.push('');
    return out.filter((_, i) => i !== col);
  });
  return { columns, rows };
}

/** Clamp a cursor to the grid: rows -1..rows.length-1, cols 0..columns.length-1. */
export function clampCursor(t: TableValue, row: number, col: number): { row: number; col: number } {
  const maxCol = Math.max(0, t.columns.length - 1);
  return {
    row: Math.min(Math.max(row, -1), Math.max(-1, t.rows.length - 1)),
    col: Math.min(Math.max(col, 0), maxCol),
  };
}

/**
 * Per-column display widths for the terminal grid: the widest cell in each column, capped
 * so a long free-text column can't push its neighbours off screen, and shrunk further so
 * the whole grid fits `avail` columns of terminal when it can.
 */
export function columnWidths(t: TableValue, avail: number, maxCell = 24): number[] {
  const widths = t.columns.map((h, i) => {
    let w = h.length;
    for (const r of t.rows) w = Math.max(w, (r[i] ?? '').length);
    return Math.max(3, Math.min(w, maxCell));
  });
  if (!widths.length) return widths;
  const gap = 1;
  let total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
  // Shave the widest column repeatedly rather than scaling - narrow columns stay legible.
  while (total > avail) {
    const widest = widths.indexOf(Math.max(...widths));
    if (widths[widest]! <= 3) break;
    widths[widest]! -= 1;
    total -= 1;
  }
  return widths;
}

/** Truncate to `w` with an ellipsis, and pad to exactly `w` (fixed-width grid cells). */
export function fitCell(s: string, w: number): string {
  const flat = s.replace(/\s+/g, ' ');
  if (flat.length > w) return w <= 1 ? flat.slice(0, w) : flat.slice(0, w - 1) + '…';
  return flat.padEnd(w, ' ');
}
