// SPDX-License-Identifier: MPL-2.0
import type { InputModelItem } from '../../../../engine/src/inputs.ts';
import { escape as esc } from '../utils.ts';
import { inputTableValue } from './block-table.ts';
import { tableBodyCellHtml, tableColumnEditor, wantsGhostRow } from './table-cells.ts';
export const TABLE_VIRTUALIZE_ROWS = 50;
export function tableRowActions(row: number, movable: boolean): string {
  return `<td class="table-rowctl">${movable && row > 0 ? `<button type="button" class="table-btn" data-table-move-up="${row}" aria-label="Move row ${row + 1} up">↑</button>` : ''}<button type="button" class="table-del-row" data-table-del-row="${row}" aria-label="Remove row ${row + 1}">✕</button></td>`;
}
export function tableInputHtml(input: InputModelItem): string {
  // A user-defined grid: columns AND rows are data (unlike blocks, whose
  // fields come from the manifest). Cells carry data-field-id so typing
  // defers the panel rebuild (isEditingBlockField) and focus survives the
  // eventual repaint; the ':t:' segment keeps them out of the blocks
  // field handler, which skips anything inside .table-input.
  const t = inputTableValue(input);
  const fixed = input.type === 'blocks';
  const id = esc(input.id);
  const cellAttrs = (r: number, c: number): string => `data-field-id="${id}:t:${r}:${c}"`;
  const head = t.columns
    .map(
      (c, ci) => `<th>
          <input class="table-cell table-cell--head" ${cellAttrs(-1, ci)} value="${esc(c)}" ${fixed ? 'readonly tabindex="-1"' : ''} aria-label="Column ${ci + 1} heading">
          ${fixed ? '' : `<button type="button" class="table-del-col" data-table-del-col="${ci}" aria-label="Remove column ${esc(c || String(ci + 1))}">&#x2715;</button>`}
        </th>`
    )
    .join('');
  // Per-column editors (manifest `columnEditors`, matched to columns by
  // position). Presentation only: whichever editor writes a cell, the stored
  // value is the same plain string, so URL mode and the CLI never see this.
  const body = (t.rows.length > TABLE_VIRTUALIZE_ROWS ? [] : t.rows)
    .map(
      (row, ri) =>
        `<tr>${row
          .map((cell, ci) =>
            tableBodyCellHtml(
              cell,
              ri,
              ci,
              t.columns,
              tableColumnEditor(input.columnEditors, ci),
              `${input.id}:t:${ri}:${ci}`
            )
          )
          .join('')}${tableRowActions(ri, fixed)}</tr>`
    )
    .join('');
  // A blank placeholder row always waits below the filled rows (and IS the
  // first row of an empty table). It renders past the value at the next row
  // index, so when typing makes it real the rebuilt cell keeps the same
  // data-field-id and the caret survives. read() in the wiring pass skips it
  // while every cell is empty, so an untouched placeholder never reaches the
  // value or the share link. No delete button - there is nothing to remove.
  const ghost = wantsGhostRow(t.rows)
    ? `<tr data-table-ghost>${t.columns
        .map((_c, ci) =>
          tableBodyCellHtml(
            '',
            t.rows.length,
            ci,
            t.columns,
            tableColumnEditor(input.columnEditors, ci),
            `${input.id}:t:${t.rows.length}:${ci}`
          )
        )
        .join('')}<td class="table-rowctl"></td></tr>`
    : '';
  // Past the threshold, a big table renders the virtualized data-grid (mounted in
  // the wiring pass below) instead of a full <table> of live cells - same
  // TableValue contract, so the toolbar/paste/copy/pop all keep working. Small
  // tables keep the exact existing <table> (per-cell textareas, del-row/col ×).
  const grid = !t.columns.length
    ? `<p class="table-empty-hint">Paste a table copied from your spreadsheet, doc, or chat - or start one below.</p>`
    : t.rows.length > TABLE_VIRTUALIZE_ROWS
      ? `<div class="table-vgrid" data-table-vgrid></div>`
      : `<div class="table-scroll"><table class="table-grid">
            <thead><tr>${head}<th class="table-rowctl"></th></tr></thead><tbody>${body}${ghost}</tbody></table></div>`;
  // The pop-out sits at the grid's top-right corner, not in the toolbar
  // below: it acts on the TABLE, and in a sidebar that toolbar can be a long
  // scroll away from the header you were reading when you decided the grid
  // was too cramped. Its own bar rather than an overlay on the corner cell -
  // the last column's remove-× already lives there.
  return `<div class="table-input" ${fixed ? 'data-table-fixed' : ''} data-table-id="${id}" data-column-editors="${(input.columnEditors ?? []).join(',')}">
        <div class="table-headbar">
          <button type="button" class="table-pop" data-table-pop title="Pop out into a floating window" aria-label="Pop out into a floating window">&#x2922;</button>
        </div>
        ${grid}
        <div class="table-toolbar">
          <button type="button" class="table-btn" data-table-add-row${t.columns.length ? '' : ' disabled'}>+ Row</button>
          ${fixed ? '' : '<button type="button" class="table-btn" data-table-add-col>+ Column</button>'}
          <span class="table-toolbar-gap"></span>
          <button type="button" class="table-btn" data-table-paste title="Replace with the table on your clipboard">Paste</button>
          <button type="button" class="table-btn" data-table-copy${t.rows.length ? '' : ' disabled'} title="Copy as a table for Sheets, Docs, Slack&#8230;">Copy</button>
        </div>
        ${t.rows.length ? `<p class="table-count">${t.rows.length} row${t.rows.length === 1 ? '' : 's'} &middot; ${t.columns.length} column${t.columns.length === 1 ? '' : 's'}</p>` : ''}
      </div>`;
}
