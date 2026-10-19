// SPDX-License-Identifier: MPL-2.0
export interface CellAddress { row: string; col: string }
export interface CellRectangle { rows: string[]; cols: string[]; start: CellAddress }

/** Endpoints use identities so paging and edits retain the selected rectangle. */
export class CellRange {
  anchor: CellAddress | null = null;
  end: CellAddress | null = null;
  select(cell: CellAddress, extend = false): void {
    if (!extend || !this.anchor) this.anchor = cell;
    this.end = cell;
  }
  clear(): void { this.anchor = this.end = null; }
  rectangle(rows: readonly string[], cols: readonly string[]): CellRectangle | null {
    if (!this.anchor || !this.end) return null;
    const r = [rows.indexOf(this.anchor.row), rows.indexOf(this.end.row)];
    const c = [cols.indexOf(this.anchor.col), cols.indexOf(this.end.col)];
    if ([...r, ...c].some(n => n < 0)) { this.clear(); return null; }
    const selectedRows = rows.slice(Math.min(...r), Math.max(...r) + 1);
    const selectedCols = cols.slice(Math.min(...c), Math.max(...c) + 1);
    return { rows: selectedRows, cols: selectedCols, start: { row: selectedRows[0]!, col: selectedCols[0]! } };
  }
}

/** TSV uses spreadsheet quoting so tabs, newlines and quotes stay inside cells. */
export function cellsToTsv(cells: readonly (readonly string[])[]): string {
  return cells.map(row => row.map(value => /["\t\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value).join('\t')).join('\r\n') + '\r\n';
}

/** Clipboard rows preserve empty fields and empty interior rows, unlike CSV imports. */
export function clipboardCells(text: string): string[][] {
  const delimiter = '\t';
  let quoted = false;
  const rows: string[][] = [];
  let row: string[] = [], field = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && !field) quoted = true;
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (row.length || field || !rows.length || !/[\r\n]$/.test(text)) { row.push(field); rows.push(row); }
  return rows;
}

/** Repeat a smaller clipboard block only when it tiles the selection exactly. */
export function tileCells(cells: string[][], height: number, width: number): string[][] {
  const h = cells.length, w = Math.max(0, ...cells.map(row => row.length));
  if (!h || !w || height % h || width % w || height < h || width < w) return cells;
  return Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => cells[r % h]![c % w] ?? ''));
}
