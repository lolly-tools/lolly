// SPDX-License-Identifier: MPL-2.0
/**
 * Table conversion shared by browser and Node file operations.
 *
 * A source is read into a grid (row 0 is the heading row unless the caller says
 * otherwise), then the grid is written in the target format. The reading
 * choices are explicit: which worksheet or all of them, formula text or saved
 * results, the column delimiter, the text encoding and how the first row is
 * treated. With no choices a source reads as it always has: the first
 * worksheet, saved results, the automatic delimiter, UTF-8 text and the first
 * row as headings.
 *
 * Exporting every worksheet writes one file per sheet into a ZIP together with
 * `manifest.json`, which lists each sheet's file, row and column counts and
 * SHA-256, and lists each skipped sheet with the reason.
 */
import { openXlsx, MAX_GRID_CELLS, type XlsxWorkbook } from './xlsx-import.ts';
import { writeXlsx } from './xlsx-write.ts';
import { rowsToCsv } from './data-import.ts';
import { parseTableText } from './table-text.ts';
import { storeZip } from './zip.ts';
import { sha256Hex } from './bytes.ts';

/** How CSV and TSV text is split into columns. `auto` keeps the detection used
 *  before these choices existed and adds semicolons (see {@link readDataGrid}). */
export const DATA_DELIMITERS = ['auto', 'comma', 'semicolon', 'tab', 'pipe'] as const;
export type DataDelimiter = typeof DATA_DELIMITERS[number];

/** Text encodings a CSV, TSV or JSON source can be read as. Every value is a
 *  WHATWG encoding label, so browsers and Node decode it the same way. */
export const DATA_TEXT_ENCODINGS = [
  'auto', 'utf-8', 'utf-16le', 'utf-16be', 'windows-1250', 'windows-1251', 'windows-1252',
  'windows-1253', 'windows-1254', 'windows-1256', 'shift_jis', 'euc-kr', 'gb18030', 'big5',
] as const;
export type DataTextEncoding = typeof DATA_TEXT_ENCODINGS[number];

/** How the first row is treated: as headings, as data, or as data under added
 *  `Column 1`, `Column 2` headings. */
export const DATA_HEADER_MODES = ['first-row', 'none', 'generate'] as const;
export type DataHeaderMode = typeof DATA_HEADER_MODES[number];

/** Whether workbook formula cells give their saved result or their formula text. */
export const DATA_CELL_MODES = ['cached', 'formulas'] as const;
export type DataCellMode = typeof DATA_CELL_MODES[number];

/** The reading and writing choices for one data conversion. */
export interface DataConversionOptions {
  /** An .xlsx worksheet: a 0-based index or an exact name. A digits-only name
   *  that no worksheet carries is read as a 0-based index. Default the first. */
  sheet?: number | string;
  /** Write every worksheet as its own file in a ZIP with a manifest. */
  allSheets?: boolean;
  cells?: DataCellMode;
  delimiter?: DataDelimiter;
  encoding?: DataTextEncoding;
  header?: DataHeaderMode;
}

/** What a read actually did, for receipts and the multi-sheet manifest. */
export interface DataReadFacts {
  /** The worksheet read from an .xlsx. */
  sheet?: string;
  /** The encoding a text source was decoded with. */
  encoding?: string;
  /** How a CSV or TSV source was split. */
  delimiter?: 'comma' | 'semicolon' | 'tab' | 'pipe' | 'markdown';
  /** Workbook cells that carry a formula. */
  formulaCells?: number;
  /** Formula cells written as their saved result although formula text was chosen. */
  formulaResultsKept?: number;
}

/** One written worksheet in {@link DataSheetsManifestV1}. */
export interface DataSheetFileV1 {
  sheet: string;
  index: number;
  file: string;
  /** Data rows written, not counting a heading row. */
  rows: number;
  columns: number;
  sha256: string;
  formulaCells: number;
  formulaResultsKept?: number;
}

/** `manifest.json` in an all-worksheets ZIP. */
export interface DataSheetsManifestV1 {
  version: 1;
  source: { name: string; format: 'xlsx'; worksheets: number };
  target: string;
  options: { cells: DataCellMode; header: DataHeaderMode };
  files: DataSheetFileV1[];
  skipped: { sheet: string; index: number; reason: string }[];
  /** Workbook content that no file in the ZIP carries. */
  notIncluded: string[];
}

/** The result of {@link convertDataFile}. */
export interface DataConversionResult {
  /** The converted file, or the ZIP when every worksheet was exported. */
  bytes: Uint8Array | string;
  zip: boolean;
  manifest?: DataSheetsManifestV1;
  facts: DataReadFacts[];
}

/** Excel's own row limit: a conversion reads a whole sheet or refuses the sheet. */
const CONVERT_ROW_LIMIT = 1_048_576;
// An all-worksheets export unzips the workbook once, reads each sheet from it and
// holds every output in memory, so it is bounded by sheet count and by total
// output size (the same 128 MB in-memory packaging limit as the other ZIP outputs).
const MAX_EXPORT_SHEETS = 200;
const MAX_EXPORT_BYTES = 128 * 1024 * 1024;

const KNOWN_OPTIONS = {
  cells: DATA_CELL_MODES,
  delimiter: DATA_DELIMITERS,
  encoding: DATA_TEXT_ENCODINGS,
  header: DATA_HEADER_MODES,
} as const;

/**
 * Validate the data choices in a file operation's options record. Keys that are
 * not data choices (image options share the record) are ignored; a data choice
 * with an unknown value is refused with a message naming the allowed values.
 */
export function readDataOptions(raw: object): DataConversionOptions {
  const record = raw as Record<string, unknown>;
  const out: DataConversionOptions = {};
  for (const [key, allowed] of Object.entries(KNOWN_OPTIONS)) {
    const value = record[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
      throw new Error(`Unknown ${key} choice. Use one of: ${allowed.join(', ')}.`);
    }
    (out as Record<string, string>)[key] = value;
  }
  const sheet = record.sheet;
  if (sheet !== undefined) {
    const index = typeof sheet === 'number' && Number.isSafeInteger(sheet) && sheet >= 0;
    const name = typeof sheet === 'string' && sheet.length > 0 && sheet.length <= 255;
    if (!index && !name) throw new Error('Choose a worksheet by its position (0 for the first) or its exact name.');
    out.sheet = sheet as number | string;
  }
  const all = record.allSheets;
  if (all !== undefined) {
    if (typeof all !== 'boolean') throw new Error('The all-worksheets choice must be true or false.');
    if (all && out.sheet !== undefined) throw new Error('Choose one worksheet or all worksheets, not both.');
    if (all) out.allSheets = true;
  }
  return out;
}

/** Decode a source to a ragged grid (row 0 = header). Kept for callers that do
 *  not need the read facts; see {@link readDataGrid}. */
export function sourceToGrid(kind: string, bytes: Uint8Array, options: DataConversionOptions = {}): string[][] {
  return readDataGrid(kind, bytes, options).grid;
}

/**
 * Read a data source into a grid and report what the read did.
 *
 * - xlsx: the chosen worksheet (default the first), saved results or formula
 *   text. A sheet larger than the reader's cell budget is refused, never cut.
 * - json: an array of objects (the union of keys, in first-seen order, becomes
 *   the heading row) or an array of row arrays.
 * - csv/tsv: `auto` splits on tabs when the text has any, reads a Markdown pipe
 *   table, and otherwise splits on commas, or on semicolons when they split
 *   every row evenly and commas do not. A quoted value may contain the
 *   delimiter and line breaks.
 */
export function readDataGrid(kind: string, bytes: Uint8Array, options: DataConversionOptions = {}): { grid: string[][]; facts: DataReadFacts } {
  if (kind === 'xlsx') return readWorksheet(openXlsx(bytes), options);
  const { text, encoding } = decodeDataText(bytes, options.encoding ?? 'auto');
  if (kind === 'json') {
    let parsed: unknown;
    try { parsed = JSON.parse(text); }
    catch { throw new Error('That JSON could not be parsed.'); }
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Expected a non-empty JSON array of rows.');
    if (Array.isArray(parsed[0])) return { grid: (parsed as unknown[][]).map((r) => r.map((c) => String(c ?? ''))), facts: { encoding } };
    // Array of objects → header = the union of keys in first-seen order.
    const seen = new Set<string>();
    for (const row of parsed as Record<string, unknown>[]) for (const k of Object.keys(row ?? {})) seen.add(k);
    const keys = [...seen];
    if ((parsed.length + 1) * keys.length > MAX_GRID_CELLS) throw new Error(TABLE_TOO_LARGE);
    return { grid: [keys, ...(parsed as Record<string, unknown>[]).map((row) => keys.map((k) => String(row?.[k] ?? '')))], facts: { encoding } };
  }
  const split = splitTable(text, options.delimiter ?? 'auto');
  if (!split) throw new Error('That file does not parse as CSV/TSV.');
  return { grid: split.grid, facts: { encoding, delimiter: split.delimiter } };
}

const TABLE_TOO_LARGE = 'This table is larger than the converter can read in full. No rows were dropped; split the file and try again.';

/** Read one worksheet of an unzipped workbook for conversion, refusing a sheet
 *  that the reader would have to cut short. */
function readWorksheet(book: XlsxWorkbook, options: DataConversionOptions): { grid: string[][]; facts: DataReadFacts } {
  const sheet = chooseSheet(book, options.sheet);
  const read = book.read({
    limit: CONVERT_ROW_LIMIT,
    ...(sheet !== undefined ? { sheet } : {}),
    ...(options.cells === 'formulas' ? { cells: 'formulas' as const } : {}),
  });
  if (read.truncated) throw new Error('This worksheet is larger than the converter can read in full. No rows were dropped; split the workbook and try again.');
  return {
    grid: read.rows,
    facts: {
      ...(read.sheetName ? { sheet: read.sheetName } : {}),
      formulaCells: read.formulaCells ?? 0,
      ...(read.formulaResultsKept !== undefined ? { formulaResultsKept: read.formulaResultsKept } : {}),
    },
  };
}

/** A worksheet name made only of digits, such as 2024, finds the sheet with that
 *  name. When no sheet has it, it is a 0-based position, so 1 is the second sheet. */
function chooseSheet(book: XlsxWorkbook, sheet: number | string | undefined): number | string | undefined {
  if (typeof sheet !== 'string' || !/^\d+$/.test(sheet)) return sheet;
  const sheets = book.sheets();
  if (sheets.some((s) => s.name === sheet)) return sheet;
  const index = Number(sheet);
  if (index >= sheets.length) throw new Error(`The workbook has no worksheet named “${sheet}” and no worksheet at position ${sheet} (0 is the first).`);
  return index;
}

/** Re-encode a grid to the target data format. Returns bytes for xlsx, a string for
 *  the text formats (the Blob wraps either). `header: 'none'` writes JSON as arrays
 *  of values; `header: 'generate'` adds a `Column 1`, `Column 2` heading row first. */
export function gridToTarget(grid: string[][], targetId: string, options: Pick<DataConversionOptions, 'header'> = {}): Uint8Array | string {
  const header = options.header ?? 'first-row';
  const rows = header === 'generate' ? [generatedHeadings(grid), ...grid] : grid;
  switch (targetId) {
    case 'csv':  return rowsToCsv(rows);
    case 'tsv':  return rows.map((r) => r.map((c) => c.replace(/[\t\r\n]/g, ' ')).join('\t')).join('\n');
    case 'xlsx': return writeXlsx({ rows });
    case 'json': {
      if (header === 'none') return JSON.stringify(rows, null, 2);
      const [head = [], ...body] = rows;
      if (head.some(h => !h.trim()) || new Set(head).size !== head.length) throw new Error('JSON needs unique, non-empty column headings. Rename the headings and try again.');
      if (body.some(row => row.length > head.length)) throw new Error('Some rows have more cells than column headings. Add headings before converting to JSON.');
      const objs = body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
      return JSON.stringify(objs, null, 2);
    }
    default: throw new Error('That conversion is not supported.');
  }
}

/**
 * Convert a data file with the given choices. One worksheet (or a text source)
 * gives one file. `allSheets` on an .xlsx gives a ZIP holding one file per
 * worksheet with cells plus `manifest.json`; an empty or chart sheet is listed
 * as skipped, and any other failure fails the whole conversion with the
 * sheet's name, so a partial set is never presented as complete.
 */
export async function convertDataFile(kind: string, bytes: Uint8Array, targetId: string, options: DataConversionOptions, sourceName: string): Promise<DataConversionResult> {
  if (!options.allSheets) {
    const { grid, facts } = readDataGrid(kind, bytes, options);
    return { bytes: gridToTarget(grid, targetId, options), zip: false, facts: [facts] };
  }
  if (kind !== 'xlsx') throw new Error('Only an Excel workbook has worksheets to export separately.');
  const book = openXlsx(bytes);
  const sheets = book.sheets();
  if (!sheets.length) throw new Error('This workbook does not list its worksheets. Convert one worksheet instead.');
  if (sheets.length > MAX_EXPORT_SHEETS) throw new Error(`This workbook has more than ${MAX_EXPORT_SHEETS} worksheets. Convert the worksheets you need one at a time.`);
  const header = options.header ?? 'first-row';
  const files: DataSheetFileV1[] = [];
  const skipped: DataSheetsManifestV1['skipped'] = [];
  const entries: { name: string; bytes: Uint8Array }[] = [];
  const allFacts: DataReadFacts[] = [];
  const encoder = new TextEncoder();
  let total = 0;
  for (const sheet of sheets) {
    let read: { grid: string[][]; facts: DataReadFacts };
    try { read = readWorksheet(book, { ...options, sheet: sheet.index }); }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/has no cells/.test(message)) { skipped.push({ sheet: sheet.name, index: sheet.index, reason: 'No cells (an empty sheet or a chart sheet).' }); continue; }
      throw new Error(`Worksheet “${sheet.name}”: ${message}`);
    }
    let out: Uint8Array | string;
    try { out = gridToTarget(read.grid, targetId, options); }
    catch (error) { throw new Error(`Worksheet “${sheet.name}”: ${error instanceof Error ? error.message : String(error)}`); }
    const data = typeof out === 'string' ? encoder.encode(out) : out;
    total += data.byteLength;
    if (total > MAX_EXPORT_BYTES) throw new Error('The worksheets exceed the 128 MB packaging limit. Convert them one at a time.');
    const file = `${String(sheet.index + 1).padStart(2, '0')}-${safeSheetFileName(sheet.name)}.${targetId}`;
    entries.push({ name: file, bytes: data });
    allFacts.push(read.facts);
    files.push({
      sheet: sheet.name, index: sheet.index, file,
      rows: header === 'first-row' ? Math.max(0, read.grid.length - 1) : read.grid.length,
      columns: widest(read.grid),
      sha256: await sha256Hex(data),
      formulaCells: read.facts.formulaCells ?? 0,
      ...(read.facts.formulaResultsKept !== undefined ? { formulaResultsKept: read.facts.formulaResultsKept } : {}),
    });
  }
  if (!files.length) throw new Error('None of the worksheets has cells.');
  const manifest: DataSheetsManifestV1 = {
    version: 1,
    source: { name: sourceName, format: 'xlsx', worksheets: sheets.length },
    target: targetId,
    options: { cells: options.cells ?? 'cached', header },
    files,
    skipped,
    notIncluded: ['Formatting and number formats', 'Merged cells', 'Charts and images', 'Comments and notes', 'Data validation and conditional formatting', 'Defined names'],
  };
  const zip = storeZip([{ name: 'manifest.json', bytes: encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`) }, ...entries]);
  return { bytes: zip, zip: true, manifest, facts: allFacts };
}

// ─── text sources ────────────────────────────────────────────────────────────

/**
 * Decode text. `auto` honours a UTF-8 or UTF-16 byte order mark, then reads
 * UTF-8, and falls back to Windows-1252 when the bytes are not valid UTF-8, so
 * a legacy export keeps every character instead of gaining replacement marks.
 * A chosen encoding is strict: bytes that do not fit it are refused.
 */
function decodeDataText(bytes: Uint8Array, encoding: DataTextEncoding): { text: string; encoding: string } {
  if (encoding === 'auto') {
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return { text: new TextDecoder('utf-8').decode(bytes), encoding: 'utf-8' };
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(bytes), encoding: 'utf-16le' };
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(bytes), encoding: 'utf-16be' };
    try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' }; }
    catch { return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252' }; }
  }
  let decoder: TextDecoder;
  try { decoder = new TextDecoder(encoding, { fatal: true }); }
  catch { throw new Error(`This device cannot read ${encoding} text.`); }
  try { return { text: decoder.decode(bytes), encoding }; }
  catch { throw new Error(`This file is not valid ${encoding} text. Choose another text encoding.`); }
}

const DELIMITER_CHAR = { comma: ',', semicolon: ';', tab: '\t', pipe: '|' } as const;

/** Split text into a padded grid, dropping rows that are entirely blank. */
function splitTable(text: string, delimiter: DataDelimiter): { grid: string[][]; delimiter: NonNullable<DataReadFacts['delimiter']> } | null {
  const t = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  if (!t.trim()) return null;
  if (delimiter === 'tab' || (delimiter === 'auto' && t.includes('\t'))) {
    // TSV has no quoting: a quote is part of the value.
    const grid = finishGrid(t.split('\n').map((l) => l.split('\t')));
    return grid ? { grid, delimiter: 'tab' } : null;
  }
  if (delimiter === 'auto' && /^\s*\|.*\|\s*$/m.test(t)) {
    if (paddedBound(t, '|') > MAX_GRID_CELLS) throw new Error(TABLE_TOO_LARGE);
    const table = parseTableText(t);
    return table ? { grid: [table.columns, ...table.rows], delimiter: 'markdown' } : null;
  }
  if (delimiter !== 'auto') {
    const grid = finishGrid(splitDelimited(t, DELIMITER_CHAR[delimiter]));
    return grid ? { grid, delimiter } : null;
  }
  // Semicolons win only when they split every row evenly and commas do not:
  // a European export, whose decimal commas leave the comma split ragged.
  const commas = splitDelimited(t, ',').filter(nonBlank);
  if (!evenWidth(commas)) {
    const semis = splitDelimited(t, ';').filter(nonBlank);
    if (evenWidth(semis)) return { grid: finishGrid(semis)!, delimiter: 'semicolon' };
  }
  const grid = finishGrid(commas);
  return grid ? { grid, delimiter: 'comma' } : null;
}

/**
 * RFC 4180 splitting on one delimiter: a value that starts with a quote may
 * hold the delimiter, doubled quotes and line breaks. When the text ends inside
 * an open quote, each line is split on its own instead, so one stray quote
 * cannot fold the rest of the file into a single value.
 */
function splitDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let fieldStart = true;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (text[i + 1] === '"') { field += '"'; i++; }
      else quoted = false;
      continue;
    }
    if (ch === '"' && fieldStart) { quoted = true; fieldStart = false; continue; }
    if (ch === delimiter) { row.push(field); field = ''; fieldStart = true; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; fieldStart = true; continue; }
    field += ch;
    fieldStart = false;
  }
  if (quoted) return text.split('\n').map((line) => splitLine(line, delimiter));
  row.push(field);
  rows.push(row);
  return rows;
}

/** One line split on its own; an unterminated quote ends with the line. */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  let fieldStart = true;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch !== '"') cur += ch;
      else if (line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = false;
    } else if (ch === '"' && fieldStart) { quoted = true; fieldStart = false; }
    else if (ch === delimiter) { cells.push(cur); cur = ''; fieldStart = true; }
    else { cur += ch; fieldStart = false; }
  }
  cells.push(cur);
  return cells;
}

/** Lines times (the most delimiters on one line + 1): no less than the padded
 *  size of the grid the text splits into, counted without splitting the text. */
function paddedBound(text: string, delimiter: string): number {
  let lines = 1;
  let most = 0;
  let here = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') { lines++; if (here > most) most = here; here = 0; }
    else if (ch === delimiter) here++;
  }
  return lines * (Math.max(most, here) + 1);
}

/** The widest row's length, without spreading a large grid into arguments. */
function widest(rows: string[][]): number {
  let width = 0;
  for (const r of rows) if (r.length > width) width = r.length;
  return width;
}

/** True when every row has the same number of cells, and more than one. */
function evenWidth(rows: string[][]): boolean {
  const width = rows[0]?.length ?? 0;
  return width > 1 && rows.every((r) => r.length === width);
}

function nonBlank(row: string[]): boolean {
  return row.some((c) => c.trim() !== '');
}

/** Drop blank rows and pad every row to the widest. Null when nothing is left.
 *  One very wide line among many short ones would pad past the grid budget, so
 *  that is refused rather than allocated. */
function finishGrid(rows: string[][]): string[][] | null {
  const kept = rows.filter(nonBlank);
  if (!kept.length) return null;
  const width = widest(kept);
  if (kept.length * width > MAX_GRID_CELLS) throw new Error(TABLE_TOO_LARGE);
  return kept.map((r) => (r.length < width ? [...r, ...new Array<string>(width - r.length).fill('')] : r));
}

function generatedHeadings(grid: string[][]): string[] {
  const width = widest(grid);
  return Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
}

/** A worksheet name made safe as a file name on every platform: path and
 *  reserved characters and control characters become underscores. */
function safeSheetFileName(name: string): string {
  let cleaned = '';
  for (const ch of name) cleaned += ch.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(ch) ? '_' : ch;
  cleaned = cleaned.replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 60);
  return cleaned || 'sheet';
}
