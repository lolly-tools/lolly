// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — CSV import/export + spreadsheet paste-fill.
 *
 * The offline CSV round-trip (download the batch, edit in any spreadsheet, upload
 * it back) and the "paste a range" fill are the three data-transfer seams that sit
 * between the grid model and the pure CSV/clipboard codecs in io.ts. They mutate
 * the batch through a small typed context handed in by index.ts — which still owns
 * the `columns`/`renderGrid` closure, exposed here as `getColumns()` + `render()`.
 */
import { batchToCsv, csvToBatch, coerceCell } from './io.ts';
import { getTool } from './render-export.ts';
import { saveBlob } from './zip.ts';
import { escape as esc } from '../utils.ts';
import type { GridRow } from './grid.ts';
import type { Column } from './model.ts';
import type { Unit } from '@lolly/engine';

/** Output-dimension units for a batch target — px is the design canvas; the rest
 *  are physical, converted per format at export time (engine/src/units.ts). This
 *  pro-specific order (px first) also gates which `__unit` strings a paste accepts. */
export const UNIT_OPTIONS: readonly Unit[] = ['px', 'mm', 'cm', 'in', 'pt'];

/** Is `u` one of the batch's accepted units? (narrows a pasted string boundary). */
function isUnitOption(u: string): u is Unit {
  return UNIT_OPTIONS.some(o => o === u);
}

/** The slice of batch state the CSV/paste seams read and write. */
export interface CsvIoState {
  rows: GridRow[];
  unit: Unit;
  dpi: number;
  collapsed: Set<string>;
}

/** What index.ts hands the CSV/paste seams: state + the render/nav/progress hooks. */
export interface CsvIoContext {
  state: CsvIoState;
  /** The current derived columns (index owns the `columns` closure). */
  getColumns(): Column[];
  /** Re-render the grid (index re-assigns its `columns` closure). */
  render(): void;
  /** Move focus to the active cell (nav.focusActive). */
  focusActive(): void;
  /** Show a message in the progress region. */
  showProgress(html: string): void;
  /** Mint a fresh blank row. */
  makeRow(): GridRow;
}

/** CSV/paste operations bound to one mounted /pro view. */
export interface CsvIo {
  exportCsv(): void;
  importCsvFile(file: File | undefined): Promise<void>;
  pasteFill(startUid: string, startColKey: string, grid: string[][]): void;
}

export function createCsvIo(ctx: CsvIoContext): CsvIo {
  const { state } = ctx;

  function exportCsv(): void {
    const usable = state.rows.filter(r => r.toolId && r.manifest);
    if (!usable.length) { ctx.showProgress(`<p class="pro-progress-msg">Pick at least one template before exporting.</p>`); return; }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    saveBlob(new Blob([batchToCsv(state.rows, { unit: state.unit, dpi: state.dpi })], { type: 'text/csv' }), `lolly-batch-${stamp}.csv`);
  }

  async function importCsvFile(file: File | undefined): Promise<void> {
    if (!file) return;
    let text: string;
    try { text = await file.text(); }
    catch { ctx.showProgress(`<p class="pro-progress-msg pro-log-err">Couldn't read that file.</p>`); return; }
    const { rows, errors } = await csvToBatch<GridRow>(text, { getTool, makeRow: ctx.makeRow });
    if (!rows.length) {
      ctx.showProgress(`<p class="pro-progress-msg pro-log-err">${esc(errors[0] || 'No rows found in the file.')}</p>`);
      return;
    }
    state.rows = rows;
    state.collapsed.clear();
    ctx.render();
    ctx.focusActive();
    const ok = rows.filter(r => r.toolId).length;
    ctx.showProgress(`<p class="pro-progress-msg">Loaded ${ok} row${ok === 1 ? '' : 's'} from CSV.${
      errors.length ? ` <span class="pro-log-err">${errors.length} issue${errors.length === 1 ? '' : 's'}.</span>` : ''
    }</p>${errors.length ? `<ol class="pro-log">${errors.map(e => `<li class="pro-log-err">${esc(e)}</li>`).join('')}</ol>` : ''}`);
  }

  // Fill values from a pasted spreadsheet range, anchored at the focused cell.
  // Only writes into rows that already have a template (use Upload CSV to set
  // templates too); cells the tool doesn't have are skipped.
  function pasteFill(startUid: string, startColKey: string, grid: string[][]): void {
    // Column order must match the rendered grid so paste anchors correctly.
    const flatCols = ['__template', '__filename', '__width', '__height', '__unit', '__dpi', ...ctx.getColumns().map(c => c.key)];
    const startRowIdx = state.rows.findIndex(r => r.uid === startUid);
    const startColIdx = Math.max(0, flatCols.indexOf(startColKey));
    if (startRowIdx < 0) return;

    let filled = 0;
    for (let r = 0; r < grid.length; r++) {
      const line = grid[r];
      const row = state.rows[startRowIdx + r];
      if (!line || !row || !row.manifest) continue;
      const byId = new Map((row.manifest.inputs ?? []).map(i => [i.id, i]));
      for (let c = 0; c < line.length; c++) {
        const colKey = flatCols[startColIdx + c];
        const raw = line[c];
        if (!colKey || colKey === '__template') continue; // templates set via CSV upload
        if (colKey === '__filename') { row.filename = raw; filled++; continue; }
        if (colKey === '__width')  { row.outWidth  = parseFloat(raw ?? '') || undefined; filled++; continue; }
        if (colKey === '__height') { row.outHeight = parseFloat(raw ?? '') || undefined; filled++; continue; }
        if (colKey === '__unit')   { const u = String(raw).trim().toLowerCase(); if (isUnitOption(u)) { row.unit = u; filled++; } continue; }
        if (colKey === '__dpi')    { row.dpi = parseInt(raw ?? '', 10) || undefined; filled++; continue; }
        const input = byId.get(colKey);
        if (!input) continue;
        const v = coerceCell(input, raw);
        if (v !== undefined) { row.values[colKey] = v; filled++; }
      }
    }
    ctx.render();
    if (filled) ctx.showProgress(`<p class="pro-progress-msg">Pasted ${filled} value${filled === 1 ? '' : 's'} from the clipboard.</p>`);
  }

  return { exportCsv, importCsvFile, pasteFill };
}
