// SPDX-License-Identifier: MPL-2.0
/**
 * One body cell of a `table` input, per column editor (manifest `columnEditors`).
 *
 * Its own module rather than a closure inside views/tool-inputs.ts's table case,
 * for two reasons: the markup per editor is the contract a tool author writes
 * against, and this file's imports resolve outside the bundler so that contract
 * can have a test (tool-inputs.ts cannot be imported under node - it carries a
 * dozen `.js` specifiers only Vite resolves).
 *
 * The editor is PRESENTATION. Whichever one wrote a cell, the stored value is the
 * same plain string, so URL mode, saved sessions and the CLI never see it.
 */
import { escape } from '../utils.ts';
import { tRaw } from '../i18n.ts';
import type { TableColumnEditor } from '../../../../engine/src/inputs.ts';

/** Which editor a table column uses, from the manifest's positional list. */
export function tableColumnEditor(editors: unknown, col: number): TableColumnEditor {
  const e = Array.isArray(editors) ? editors[col] : undefined;
  return e === 'emoji' || e === 'url' ? e : 'text';
}

/**
 * Whether the grid should render a blank placeholder row after the real rows.
 * One is always waiting: on an empty table it is the entry point, and once the
 * last row has any content a fresh one appears beneath it. Only when the last
 * row is itself entirely blank does it stand down - that row already is the
 * placeholder. The row is display-only until typed into: the table wiring's
 * read() drops it while every cell is empty, so it never reaches the value,
 * the URL, or a hand-typed CLI link.
 */
export function wantsGhostRow(rows: string[][]): boolean {
  const last = rows.at(-1);
  return !last || last.some(c => (c ?? '').trim() !== '');
}

/**
 * One body cell of a small (non-virtualized) table.
 *
 * Cells are textareas, not inputs: cell copy is often a full paragraph
 * (field-sizing: content auto-grows them; rows=1 is the floor). An `emoji` column
 * is the exception - its cells are BUTTONS that open the picker. A button carries
 * a native `value` (it reflects the attribute), so the table wiring's read() still
 * collects a row by reading `.value` off every `.table-cell` and needs to know
 * nothing about editors.
 */
export function tableBodyCellHtml(
  value: string,
  row: number,
  col: number,
  columns: string[],
  editor: TableColumnEditor,
  fieldId: string,
): string {
  const attrs = `data-field-id="${escape(fieldId)}"`;
  const label = `${escape(columns[col] || `Column ${col + 1}`)}, row ${row + 1}`;
  if (editor === 'emoji') {
    const glyph = value
      ? escape(value)
      : `<span class="table-emoji-empty" aria-hidden="true">${escape(tRaw('Pick'))}</span>`;
    return `<td><button type="button" class="table-cell table-cell--emoji" data-emoji-cell ${attrs}
      value="${escape(value)}" aria-label="${label}" title="${escape(tRaw('Pick an emoji'))}">${glyph}</button></td>`;
  }
  // A `url` column is still a text cell; it just asks the device for a URL keyboard
  // and stops the phone capitalising and correcting a web address.
  const urlAttrs = editor === 'url'
    ? ' inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false"'
    : '';
  return `<td><textarea class="table-cell" rows="1" ${attrs}${urlAttrs} aria-label="${label}">${escape(value)}</textarea></td>`;
}
