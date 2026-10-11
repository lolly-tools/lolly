// SPDX-License-Identifier: MPL-2.0
import type { ComparisonIdentity, ComparisonSource, ComparisonTable } from '@lolly-tools/core/host-v1';
import { comparisonOfficeParts, comparisonXml } from './compare-office-parts.ts';

const MAX_TEXT = 2 * 1024 * 1024, MAX_ROWS = 10_000, MAX_COLUMNS = 256, MAX_CELLS = 100_000, MAX_SHEETS = 16;
const LIMIT = 'Table reading is limited to 16 sheets, 10,000 rows, 256 columns and 100,000 cells per side. Unread cells may differ.';
const UNSUPPORTED = 'This XLSX uses prefixed XML, unsupported cell references or a grid wider than 256 columns. Choose an unprefixed workbook with a smaller grid.';

function sheetWidth(document: Document): number {
  let width = 1;
  if (Array.from(document.getElementsByTagNameNS('*', 'c')).some(cell => cell.parentElement?.localName !== 'row')) throw new Error(UNSUPPORTED);
  for (const row of Array.from(document.getElementsByTagNameNS('*', 'row'))) {
    let cursor = 0;
    for (const cell of Array.from(row.getElementsByTagNameNS('*', 'c'))) {
      const ref = cell.getAttribute('r');
      if (ref) {
        const match = /^([A-Z]{1,3})([1-9]\d*)$/.exec(ref); if (!match) throw new Error(UNSUPPORTED);
        cursor = 0; for (const letter of match[1]!) cursor = cursor * 26 + letter.charCodeAt(0) - 64;
      } else cursor++;
      if (cursor > MAX_COLUMNS) throw new Error(UNSUPPORTED); width = Math.max(width, cursor);
    }
  }
  return width;
}

/** Decode delimited data without trimming values or dropping blank records. */
function delimitedRows(text: string, delimiter: ',' | '\t'): { rows: string[][]; truncated: boolean } {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false, closed = false, cells = 0, truncated = false;
  const finishCell = (): void => { row.push(cell); cell = ''; closed = false; cells++; };
  const finishRow = (): boolean => {
    finishCell(); rows.push(row); row = [];
    return rows.length >= MAX_ROWS + 1 || cells >= MAX_CELLS;
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === '"' && cell === '' && !closed) quoted = true;
    else if (char === delimiter) {
      finishCell();
      if (row.length >= MAX_COLUMNS || cells >= MAX_CELLS) { truncated = true; break; }
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      if (finishRow()) { truncated = i < text.length - 1; break; }
    } else {
      if (closed) throw new Error('This table has invalid quoting. Choose a valid CSV or TSV file.');
      if (char === '"') throw new Error('This table has invalid quoting. Choose a valid CSV or TSV file.');
      cell += char;
    }
  }
  if (!truncated && quoted) throw new Error('This table has invalid quoting. Choose a valid CSV or TSV file.');
  if (!truncated && (cell !== '' || row.length || closed)) finishRow();
  return { rows, truncated };
}

function boundedTable(name: string, grid: string[][], remainingRows: number, remainingCells: number): { table: ComparisonTable; truncated: boolean; cells: number } {
  const width = Math.min(MAX_COLUMNS, Math.max(0, remainingCells), Math.max(0, ...grid.map(row => row.length)));
  const columns = (grid[0] ?? []).slice(0, width); while (columns.length < width) columns.push('');
  const rows: string[][] = []; let cells = width, truncated = grid.some(row => row.length > width);
  for (const source of grid.slice(1)) {
    if (rows.length >= remainingRows || cells + width > remainingCells) { truncated = true; break; }
    const row = source.slice(0, width); while (row.length < width) row.push(''); rows.push(row); cells += width;
  }
  return { table: { name, columns, rows }, truncated, cells };
}

export function comparisonTableTextSource(text: string, identity: ComparisonIdentity, format?: 'csv' | 'tsv'): ComparisonSource {
  if (text.length > MAX_TEXT) throw new Error('Choose table text up to 2 MiB per side.');
  const decoded = delimitedRows(text.replace(/^\uFEFF/, ''), format === 'tsv' || (!format && text.includes('\t')) ? '\t' : ',');
  const bounded = boundedTable('Table', decoded.rows, MAX_ROWS, MAX_CELLS);
  const partial = decoded.truncated || bounded.truncated;
  return { identity, content: { kind: 'table', tables: [bounded.table] }, fidelity: { level: partial ? 'partial' : 'complete', limitations: partial ? [LIMIT] : [] } };
}

export async function comparisonTableBytes(bytes: Uint8Array, identity: ComparisonIdentity, format: string, signal?: AbortSignal): Promise<ComparisonSource> {
  signal?.throwIfAborted();
  if (format !== 'xlsx') {
    if (bytes.length > MAX_TEXT) throw new Error('Choose table text up to 2 MiB per side.');
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('This table is not UTF-8 CSV or TSV.'); }
    if (text.includes('\0')) throw new Error('Choose an XLSX, CSV or TSV table.');
    return { ...comparisonTableTextSource(text, identity, format === 'tsv' ? 'tsv' : 'csv'), bytes };
  }
  const tables: ComparisonTable[] = [], limitations = ['XLSX comparison uses the first row as column labels and cached cell values. Formulas are not evaluated; formatting, charts and empty trailing rows or cells are not compared.'];
  let partial = false, rowCount = 0, cellCount = 0, width = 1;
  try {
    const { listXlsxSheets, readXlsx } = await import('../../../../engine/src/xlsx-import.ts');
    signal?.throwIfAborted();
    const parts = await comparisonOfficeParts(bytes, signal);
    const shared = parts['xl/sharedStrings.xml'];
    const sharedCount = shared ? comparisonXml(new TextDecoder().decode(shared)).getElementsByTagNameNS('*', 'si').length : 0;
    for (const [path, part] of Object.entries(parts)) {
      if (!/^xl\/(?:workbook\.xml|sharedStrings\.xml|_rels\/workbook\.xml\.rels|worksheets\/[^/]+\.xml)$/.test(path)) continue;
      const document = comparisonXml(new TextDecoder().decode(part));
      if (Array.from(document.getElementsByTagName('*')).some(element => element.prefix)) throw new Error(UNSUPPORTED);
      if (!/^xl\/worksheets\//.test(path)) continue;
      width = Math.max(width, sheetWidth(document));
      const rows = Array.from(document.getElementsByTagNameNS('*', 'row'));
      if (rows.length && !rows.at(-1)!.textContent?.trim()) partial = true;
      const cells = document.getElementsByTagNameNS('*', 'c');
      for (const cell of Array.from(cells)) {
        const value = cell.getElementsByTagNameNS('*', 'v')[0]?.textContent;
        if (cell.getAttribute('t') === 's' && (value === undefined || !/^\d+$/.test(value ?? '') || Number(value) >= sharedCount)) partial = true;
        if (cell.getElementsByTagNameNS('*', 'f').length && value === undefined) partial = true;
      }
    }
    const sheets = listXlsxSheets(bytes); partial ||= sheets.length > MAX_SHEETS;
    for (const sheet of sheets.slice(0, MAX_SHEETS)) {
      await new Promise<void>(resolve => setTimeout(resolve, 0)); signal?.throwIfAborted();
      const safeRows = Math.floor((MAX_CELLS - cellCount) / width);
      if (safeRows < 1) { partial = true; break; }
      const read = readXlsx(bytes, { sheet: sheet.index, limit: Math.min(MAX_ROWS - rowCount + 1, safeRows) });
      const bounded = boundedTable(sheet.name, read.rows, MAX_ROWS - rowCount, MAX_CELLS - cellCount);
      tables.push(bounded.table); rowCount += bounded.table.rows.length; cellCount += bounded.cells;
      partial ||= read.truncated || bounded.truncated;
    }
    if (!sheets.length) throw new Error('missing workbook');
  } catch (error) { signal?.throwIfAborted(); if (error instanceof Error && error.message === UNSUPPORTED) throw error; throw new Error('This XLSX could not be read within the table limits. Choose a valid, smaller workbook.'); }
  if (partial) limitations.push(LIMIT);
  if (partial) limitations.push('Some table cells may be unread or have no cached formula value. Equality could not be established for the complete workbook.');
  return { identity, bytes, content: { kind: 'table', tables }, fidelity: { level: partial ? 'partial' : 'complete', limitations } };
}
