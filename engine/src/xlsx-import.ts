// SPDX-License-Identifier: MPL-2.0
/**
 * xlsx-import.ts - read one worksheet of an .xlsx into a plain grid.
 *
 * The spreadsheet sibling of `data-import.ts`'s CSV path: an .xlsx is a zip of
 * XML parts, so this unzips it (fflate) and returns `string[][]` - the same
 * ragged-grid shape `data-import.ts`'s internal `readCsv` produces - so the very
 * same field-mapping (`parseDataRows`, via a header row) can feed a tool's
 * `blocks` input. The caller turns the first row into a header exactly as it
 * would for a pasted CSV; one importer downstream, two file formats in.
 *
 * Pure and DOM-free. We import ONLY `fflate` (for inflate - the engine has
 * `deflateRaw` but no pure inflater) and scan the part XML with a small,
 * bounds-safe string/regex reader (no DOM, no injected parser). Numbers, dates
 * and formulae surface as their cached string value; styling/number-format is
 * not applied (a date shows its serial or cached text, matching a CSV paste).
 * With `cells: 'formulas'` a formula cell yields its formula text instead
 * (`=SUM(A1:A3)`); a shared formula is rewritten for each cell it covers, and a
 * cell whose formula cannot be rewritten safely keeps its cached value and is
 * counted in `formulaResultsKept`.
 *
 * ── STRUCTURE OF AN .xlsx (only the parts we read) ────────────────────────────
 *   • xl/workbook.xml - <sheets><sheet name r:id=…/>: sheet ORDER.
 *   • xl/_rels/workbook.xml.rels - r:id → worksheets/sheetN.xml target.
 *   • xl/worksheets/sheetN.xml - <c r="A1" t="s"><v>idx</v></c>: t="s" means
 *                                  <v> is an index into sharedStrings; t="inlineStr"
 *                                  carries <is><t>…; anything else is an inline
 *                                  literal in <v> (number/bool/formula cache).
 *   • xl/sharedStrings.xml - <si><t>…</t></si> (or rich runs of <r><t>…).
 *
 * ── SECURITY (a hostile file is the threat model) ────────────────────────────
 * A non-zip, a truncated zip, or a macro-enabled (.xlsm, vbaProject.bin) surprise
 * is refused with a clear Error. Every decompressed part is size-capped before
 * decode; the scan is bounded by input length (regex `matchAll` is linear - no
 * size-field-driven loop that a crafted value could spin forever, the "GIF
 * lesson"); rows/cols/cells are hard-capped, and so is the padded grid, so a sheet
 * claiming cell `XFD1048576` can't balloon the grid.
 */

import { unzipSync } from 'fflate';

/** Options for {@link readXlsx}. */
export interface ReadXlsxOpts {
  /** max rows to return (default {@link DEFAULT_XLSX_ROW_LIMIT}). */
  limit?: number;
  /** Which worksheet to read: a 0-based index into {@link listXlsxSheets}, or an
   *  exact sheet name. Defaults to the first sheet (byte-identical to omitting it). */
  sheet?: number | string;
  /** `'cached'` (default) returns each formula cell's saved result; `'formulas'`
   *  returns its formula text, starting with `=`. */
  cells?: 'cached' | 'formulas';
}

/** Result of {@link readXlsx}: the chosen sheet's cells + a truncation flag. */
export interface ReadXlsxResult {
  /** ragged grid, row-major; gaps between populated cells are filled with ''. */
  rows: string[][];
  /** true when the sheet had more rows than `limit` and was cut short. */
  truncated: boolean;
  /** the resolved part path we read, e.g. "xl/worksheets/sheet1.xml". */
  sheetPath: string;
  /** the human sheet name of the part read (from workbook.xml), when known. */
  sheetName?: string;
  /** cells in the returned rows that carry a formula, in either mode. */
  formulaCells?: number;
  /** with `cells: 'formulas'`, formula cells returned as their cached value
   *  because their formula text could not be recovered for that cell. */
  formulaResultsKept?: number;
}

/** One worksheet of a workbook, in workbook (tab) order. */
export interface XlsxSheetInfo {
  /** Human sheet name (the tab label). */
  name: string;
  /** 0-based position in workbook order - the value to pass as {@link ReadXlsxOpts.sheet}. */
  index: number;
}

/** Hard cap on returned rows - mirrors `data-import.ts`'s CSV cap. A runaway
 *  backstop well above any hand-authored sheet; the shell should bound file size
 *  at pick time too. */
export const DEFAULT_XLSX_ROW_LIMIT = 1000;

// A single decompressed part bigger than this is refused (not decoded) - a
// zip-bomb / crafted-part backstop. 32M covers any real workbook part.
const MAX_PART_BYTES = 32 * 1024 * 1024;
// Total decompressed budget across ALL parts fflate is allowed to inflate. Bounds a
// bomb built from many just-under-cap parts. 256M is generous for a real workbook
// (a big sheet + shared strings) while capping the blast radius.
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;
// Column ceiling (Excel's own max is 16384 = column "XFD"); a hostile ref past
// this is clamped away rather than allocated.
const MAX_COLS = 16384;
// Absolute cell backstop, independent of the row/col caps.
const MAX_CELLS = 2_000_000;
/** Slots in the padded grid (rows x widest row). MAX_CELLS counts only the cells
 *  present, and a sparse sheet holding just A1 and XFD1048576 would pad to 17
 *  billion slots. The default 1,000-row limit at Excel's full width (16,384,000)
 *  fits, so only a caller that raises the limit can reach this. */
export const MAX_GRID_CELLS = 16_777_216;

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Read one worksheet of an .xlsx (the first unless `opts.sheet` names another)
 * into a `string[][]` grid.
 *
 * @param bytes the raw file bytes (the shell reads the file; this owns unzip).
 * @param opts  optional row limit, sheet and formula mode.
 * @throws if the bytes are not a zip, the zip is truncated/corrupt, the file is
 *         macro-enabled, or it carries no readable worksheet.
 */
export function readXlsx(bytes: Uint8Array, opts: ReadXlsxOpts = {}): ReadXlsxResult {
  return openXlsx(bytes).read(opts);
}

/** An unzipped workbook. Each read reuses the one unzip and shared string table. */
export interface XlsxWorkbook {
  /** The worksheets in tab order, as {@link listXlsxSheets} lists them. */
  sheets(): XlsxSheetInfo[];
  /** Read one worksheet, exactly as {@link readXlsx} does. */
  read(opts?: ReadXlsxOpts): ReadXlsxResult;
}

/**
 * Unzip an .xlsx once so that several worksheets can be read without unzipping
 * the file again for each one.
 *
 * @throws if the bytes are not a zip, the zip is truncated/corrupt, or the file
 *         is macro-enabled.
 */
export function openXlsx(bytes: Uint8Array): XlsxWorkbook {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
    throw new Error('The file is empty.');
  }
  // Zip local-file-header magic "PK\x03\x04" (or the empty/spanned variants).
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    throw new Error('This isn’t an .xlsx file (not a zip archive).');
  }

  let entries: Record<string, Uint8Array>;
  try {
    // Bound decompression HERE, BEFORE fflate inflates each part - the size check in
    // makeStore.bytes() runs far too late (the whole payload is already materialised in
    // memory by then, so it is no zip-bomb defence at all). The filter runs per entry
    // ahead of inflation: a part whose DECLARED uncompressed size exceeds the per-part
    // cap, or that would push the running total past the archive budget, is SKIPPED
    // (never inflated). A crafted header that under-declares its size cannot slip a bomb
    // through either - fflate inflates into a buffer sized to the declared originalSize
    // and throws if the stream overruns it. This is the zip-bomb resistance the file's
    // threat model promises.
    let budget = MAX_TOTAL_BYTES;
    entries = unzipSync(bytes, {
      filter: (f) => {
        if (f.originalSize > MAX_PART_BYTES) return false;
        if (f.originalSize > budget) return false;
        budget -= f.originalSize;
        return true;
      },
    });
  } catch {
    throw new Error('Could not read the .xlsx - the file is corrupt or truncated.');
  }

  const store = makeStore(entries);

  // A macro-enabled workbook (.xlsm) carries a VBA project; refuse it rather than
  // silently reading a file that also ships executable content.
  if (store.has('xl/vbaProject.bin')) {
    throw new Error('This workbook is macro-enabled (.xlsm) - open it as a plain .xlsx.');
  }

  let declared: SheetEntry[] | undefined;
  let shared: string[] | undefined;
  const sheetList = (): SheetEntry[] => (declared ??= allSheets(store));

  return {
    sheets: () => sheetList().map((s, index) => ({ name: s.name || `Sheet ${index + 1}`, index })),
    read(opts = {}) {
      const limit =
        Number.isFinite(opts.limit) && (opts.limit as number) > 0
          ? Math.floor(opts.limit as number)
          : DEFAULT_XLSX_ROW_LIMIT;
      const chosen = resolveSheet(store, sheetList(), opts.sheet);
      if (!chosen) {
        throw new Error(
          opts.sheet === undefined
            ? 'The workbook has no readable worksheet.'
            : `The workbook has no sheet ${typeof opts.sheet === 'number' ? `at index ${opts.sheet}` : `named “${opts.sheet}”`}.`,
        );
      }
      const sheetXml = store.text(chosen.path);
      if (sheetXml == null) throw new Error('The chosen sheet is missing or too large.');

      shared ??= readSharedStrings(store);

      const formulas: FormulaState = { mode: opts.cells === 'formulas' ? 'formulas' : 'cached', shared: new Map(), cells: 0, kept: 0 };
      const { rows, truncated } = readSheet(sheetXml, shared, limit, formulas);
      if (!rows.length) throw new Error(truncated ? 'That sheet is too large to read.' : 'That sheet has no cells.');
      return {
        rows, truncated, sheetPath: chosen.path, sheetName: chosen.name || undefined, formulaCells: formulas.cells,
        ...(formulas.mode === 'formulas' ? { formulaResultsKept: formulas.kept } : {}),
      };
    },
  };
}

/**
 * List a workbook's worksheets (names + indices) in tab order, WITHOUT inflating
 * any worksheet part (only workbook.xml + its rels are decoded), so a sheet-picker
 * is cheap even for a large book. Returns [] when the file carries no enumerable
 * sheets (the caller can still `readXlsx` the first-sheet fallback).
 *
 * @throws if the bytes are not a zip, the zip is corrupt, or it is macro-enabled.
 */
export function listXlsxSheets(bytes: Uint8Array): XlsxSheetInfo[] {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) throw new Error('The file is empty.');
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) throw new Error('This isn’t an .xlsx file (not a zip archive).');

  let entries: Record<string, Uint8Array>;
  try {
    // Inflate ONLY workbook.xml + its rels (+ the VBA marker for the .xlsm refusal);
    // every worksheet part is filtered out, so listing stays cheap on a big book.
    entries = unzipSync(bytes, {
      filter: (f) =>
        f.originalSize <= MAX_PART_BYTES
        && (f.name === 'xl/workbook.xml'
          || f.name === 'xl/_rels/workbook.xml.rels'
          || f.name === 'xl/vbaProject.bin'),
    });
  } catch {
    throw new Error('Could not read the .xlsx - the file is corrupt or truncated.');
  }
  const store = makeStore(entries);
  if (store.has('xl/vbaProject.bin')) {
    throw new Error('This workbook is macro-enabled (.xlsm) - open it as a plain .xlsx.');
  }
  return allSheets(store).map((s, index) => ({ name: s.name || `Sheet ${index + 1}`, index }));
}

// ─── part store ──────────────────────────────────────────────────────────────

interface PartStore {
  has(path: string): boolean;
  bytes(path: string): Uint8Array | null;
  text(path: string): string | null;
  keys(): string[];
}

function makeStore(entries: Record<string, Uint8Array>): PartStore {
  // Case-insensitive index - OOXML paths are stable-case in practice, but a
  // re-zipped/hostile archive may differ.
  const lower = new Map<string, string>();
  const keys = Object.keys(entries);
  for (const k of keys) if (!lower.has(k.toLowerCase())) lower.set(k.toLowerCase(), k);
  const resolve = (path: string): Uint8Array | undefined => {
    const direct = entries[path];
    if (direct !== undefined) return direct;
    const real = lower.get(path.toLowerCase());
    return real !== undefined ? entries[real] : undefined;
  };
  return {
    keys: () => keys,
    has: (path) => resolve(path) !== undefined,
    bytes(path) {
      const raw = resolve(path);
      if (raw === undefined || raw.byteLength > MAX_PART_BYTES) return null;
      return raw;
    },
    text(path) {
      const raw = this.bytes(path);
      if (raw == null) return null;
      try {
        return new TextDecoder('utf-8').decode(raw);
      } catch {
        return null;
      }
    },
  };
}

// ─── sheet ordering ──────────────────────────────────────────────────────────

/** One worksheet with its name + resolved part path, in workbook order. */
interface SheetEntry { name: string; path: string }

/** Every worksheet declared in workbook (tab) order: name from the `<sheet>` tag,
 *  path resolved workbook.xml → rels. Does NOT require the worksheet part to be
 *  present (so it works over a workbook-only unzip for sheet LISTING); callers that
 *  read a sheet verify the part separately. Sheets with no resolvable rel target are
 *  skipped. Returns [] when there is no workbook.xml (the caller falls back). */
function allSheets(store: PartStore): SheetEntry[] {
  const wb = store.text('xl/workbook.xml');
  if (!wb) return [];
  const out: SheetEntry[] = [];
  // Every <sheet name="…" r:id="…"> under <sheets>, in document (= tab) order.
  const re = /<sheet\b[^>]*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(wb)) !== null) {
    const tag = m[0];
    const rid = attr(tag, 'r:id') || attr(tag, 'id');
    if (!rid) continue;
    const target = relTarget(store, rid);
    if (!target) continue;
    out.push({ name: attr(tag, 'name') || '', path: resolveTarget('xl', target) });
  }
  return out;
}

/** The part path of the FIRST readable worksheet, resolved workbook.xml → rels.
 *  Falls back to `xl/worksheets/sheet1.xml`, then the lowest-numbered sheet part. */
function firstSheetPath(store: PartStore): string | null {
  const declared = allSheets(store).find((s) => store.has(s.path));
  if (declared) return declared.path;
  if (store.has('xl/worksheets/sheet1.xml')) return 'xl/worksheets/sheet1.xml';
  const sheets = store
    .keys()
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k))
    .sort((a, b) => sheetNum(a) - sheetNum(b));
  return sheets[0] ?? null;
}

/** Resolve the requested sheet (index or name) to a present { path, name }. Returns
 *  the first readable sheet when `want` is undefined; null when the named/indexed
 *  sheet is absent or its part is missing. */
function resolveSheet(store: PartStore, sheets: SheetEntry[], want: number | string | undefined): SheetEntry | null {
  if (want === undefined) {
    const first = sheets.find((s) => store.has(s.path));
    if (first) return first;
    const path = firstSheetPath(store);
    return path ? { name: '', path } : null;
  }
  const entry = typeof want === 'number' ? sheets[want] : sheets.find((s) => s.name === want);
  if (!entry || !store.has(entry.path)) return null;
  return entry;
}

/** Resolve an r:id against xl/_rels/workbook.xml.rels → the (xl-relative) target. */
function relTarget(store: PartStore, rid: string): string | null {
  const rels = store.text('xl/_rels/workbook.xml.rels');
  if (!rels) return null;
  const re = /<Relationship\b[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rels)) !== null) {
    const tag = m[0];
    if (attr(tag, 'Id') === rid) return attr(tag, 'Target');
  }
  return null;
}

/** Resolve a (possibly `../`-relative) rel Target against a base dir. */
function resolveTarget(baseDir: string, target: string): string {
  if (!target) return target;
  if (target.startsWith('/')) return target.slice(1); // package-absolute
  const segs = (baseDir ? baseDir.split('/') : []).concat(target.split('/'));
  const out: string[] = [];
  for (const s of segs) {
    if (s === '' || s === '.') continue;
    if (s === '..') out.pop();
    else out.push(s);
  }
  return out.join('/');
}

function sheetNum(path: string): number {
  const m = /sheet(\d+)\.xml$/i.exec(path);
  return m?.[1] ? Number.parseInt(m[1], 10) : 0;
}

// ─── shared strings ──────────────────────────────────────────────────────────

/**
 * Read xl/sharedStrings.xml into an index → text array. Each `<si>` is one
 * entry; its text is every `<t>` it contains concatenated (covering rich-text
 * `<r><t>…</t></r>` runs), XML-decoded.
 */
function readSharedStrings(store: PartStore): string[] {
  const xml = store.text('xl/sharedStrings.xml');
  if (!xml) return [];
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml)) !== null) {
    const inner = m[1]; // undefined for a self-closing (empty) <si/>
    out.push(inner ? collectText(inner) : '');
    if (out.length > MAX_CELLS) break; // absurd string table - stop
  }
  return out;
}

/** Concatenate every `<t>…</t>` in a fragment, XML-decoded. */
function collectText(fragment: string): string {
  let text = '';
  const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>|<t\b[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = tRe.exec(fragment)) !== null) {
    if (m[1] !== undefined) text += m[1];
  }
  return decodeXml(text);
}

// ─── sheet cells ─────────────────────────────────────────────────────────────

/** Formula handling for one sheet read: the mode, each shared formula's master
 *  (keyed by its `si` group) and the counts reported back to the caller. */
interface FormulaState {
  mode: 'cached' | 'formulas';
  shared: Map<string, { text: string; row: number; col: number }>;
  cells: number;
  kept: number;
}

function readSheet(
  xml: string,
  shared: string[],
  limit: number,
  formulas: FormulaState,
): { rows: string[][]; truncated: boolean } {
  // Sparse fill: rowIndex → (colIndex → value). We track the max column so the
  // final grid is padded rectangular (gaps → '').
  const grid = new Map<number, Map<number, string>>();
  let maxCol = -1;
  let maxRow = -1;
  let truncated = false;
  let cellCount = 0;

  // Cursor for cells that omit their `r` ref: they advance left→right within the
  // current <row>, which OOXML permits.
  let cursorRow = 0;
  let cursorCol = 0;

  // Matches an opening <c …> (capturing its inner up to </c>) OR a self-closing
  // <c …/> (an empty cell - still advances the cursor). Also tracks <row r=…> so
  // ref-less cells land on the right row.
  const tokenRe = /<row\b[^>]*>|<c\b([^>]*?)\/>|<c\b([^>]*?)>([\s\S]*?)<\/c>/g;
  let tok: RegExpExecArray | null;

  outer: while ((tok = tokenRe.exec(xml)) !== null) {
    if (tok[0].startsWith('<row')) {
      const r = attr(tok[0], 'r');
      const n = r ? Number.parseInt(r, 10) : NaN;
      cursorRow = Number.isFinite(n) && n > 0 ? n - 1 : cursorRow + (grid.size ? 1 : 0);
      cursorCol = 0;
      continue;
    }

    const attrs = tok[1] !== undefined ? tok[1] : (tok[2] as string);
    const inner = tok[1] !== undefined ? '' : (tok[3] as string);

    // Resolve this cell's row/col from its A1 ref, else the running cursor.
    const ref = attr(attrs, 'r');
    let rowIdx: number;
    let colIdx: number;
    const rc = ref ? parseRef(ref) : null;
    if (rc) {
      rowIdx = rc.row;
      colIdx = rc.col;
    } else {
      rowIdx = cursorRow;
      colIdx = cursorCol;
    }
    cursorCol = colIdx + 1;

    if (rowIdx < 0 || colIdx < 0 || colIdx >= MAX_COLS) continue;
    // A row beyond the limit is dropped (and flags truncation) - but ONLY once
    // we've actually seen a populated row past it, so a single stray high ref
    // still lets the real rows through.
    if (rowIdx >= limit) {
      truncated = true;
      continue;
    }
    if (++cellCount > MAX_CELLS) {
      truncated = true;
      break outer;
    }

    const formula = inner.includes('<f') ? formulaText(inner, rowIdx, colIdx, formulas) : undefined;
    const value = formula ?? cellValue(attrs, inner, shared);
    if (value === '') continue; // don't materialise blank cells (still padded later)

    let row = grid.get(rowIdx);
    if (!row) {
      row = new Map<number, string>();
      grid.set(rowIdx, row);
    }
    row.set(colIdx, value);
    if (colIdx > maxCol) maxCol = colIdx;
    if (rowIdx > maxRow) maxRow = rowIdx;
  }

  if (maxRow < 0 || maxCol < 0) return { rows: [], truncated };

  let width = maxCol + 1;
  let lastRow = maxRow;
  // Padding is rows x widest row, which a sparse sheet makes far larger than its
  // cell count. Rows past the grid budget are dropped, like rows past the limit.
  if ((maxRow + 1) * width > MAX_GRID_CELLS) {
    truncated = true;
    const fit = Math.floor(MAX_GRID_CELLS / width);
    width = 0;
    lastRow = -1;
    for (const [r, cols] of grid) {
      if (r >= fit) continue;
      if (r > lastRow) lastRow = r;
      for (const c of cols.keys()) if (c >= width) width = c + 1;
    }
  }
  const rows: string[][] = [];
  for (let r = 0; r <= lastRow; r++) {
    const src = grid.get(r);
    const row = new Array<string>(width).fill('');
    if (src) for (const [c, v] of src) row[c] = v;
    rows.push(row);
  }
  // Trim trailing fully-empty rows (a sheet often over-declares its dimension).
  while (rows.length && rows[rows.length - 1]!.every((c) => c === '')) rows.pop();
  return { rows, truncated };
}

/** Resolve one cell's string value from its `t` type + inner XML. */
function cellValue(attrs: string, inner: string, shared: string[]): string {
  const t = attr(attrs, 't') || 'n';
  if (t === 's') {
    // shared string: <v> holds the index.
    const raw = firstElemText(inner, 'v');
    const idx = Number.parseInt(raw, 10);
    if (!Number.isFinite(idx) || idx < 0 || idx >= shared.length) return '';
    return shared[idx] ?? '';
  }
  if (t === 'inlineStr') {
    // <is> with its own <t>/rich runs.
    const is = firstElem(inner, 'is');
    return is ? collectText(is) : '';
  }
  if (t === 'str') {
    // formula cached string result in <v>.
    return decodeXml(firstElemText(inner, 'v'));
  }
  if (t === 'b') {
    return firstElemText(inner, 'v').trim() === '1' ? 'TRUE' : 'FALSE';
  }
  // number / date / error - the literal cached value in <v>.
  return decodeXml(firstElemText(inner, 'v'));
}

// ─── formulas ────────────────────────────────────────────────────────────────

/**
 * Count a formula cell and, in formula mode, return its text as `=<formula>`.
 * Returns undefined when the cell should show its cached value instead: always
 * in cached mode, and in formula mode when the text cannot be recovered.
 *
 * A shared formula stores its text once, on the first cell of the range
 * (`<f t="shared" ref="B2:B9" si="0">A2*2</f>`); every other cell carries only
 * `<f t="shared" si="0"/>`. Excel derives each cell's formula by moving the
 * relative references by the cell's offset from that first cell, so the same is
 * done here. The first cell always precedes the others in document order.
 */
function formulaText(inner: string, row: number, col: number, state: FormulaState): string | undefined {
  const m = /<f\b([^>]*?)(?:\/>|>([\s\S]*?)<\/f>)/.exec(inner);
  if (!m) return undefined;
  state.cells++;
  if (state.mode === 'cached') return undefined;
  const fAttrs = m[1] ?? '';
  const own = m[2] ? decodeXml(m[2]) : '';
  let text: string | null = own;
  if (attr(fAttrs, 't') === 'shared') {
    const si = attr(fAttrs, 'si') ?? '';
    if (own) state.shared.set(si, { text: own, row, col });
    else {
      const master = state.shared.get(si);
      text = master ? shiftFormula(master.text, row - master.row, col - master.col) : null;
    }
  }
  if (!text) { state.kept++; return undefined; }
  return `=${text}`;
}

// Excel's last row (1,048,576) as a 0-based bound.
const MAX_ROWS = 1_048_576;
// Characters that continue a name, a function or a sheet label. A reference
// that touches one of these is part of a longer word, not a cell address.
const NAME_CHAR = /[\p{L}\p{N}_.$\\?]/u;
const REF_AT = /(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})/y;
const WORD_AT = /[\p{L}\p{N}_.$\\?]+/uy;
const NUMBER_AT = /\d+(?:\.\d*)?(?:[eE][+-]?\d+)?/y;

/**
 * Move every relative A1 reference in a formula by (dr, dc). Absolute parts
 * (`$A`, `$1`) stay put. String literals, sheet names (quoted, or unquoted in
 * `Q1!` and `Q1:Q4!`) and bracketed structured or external references are
 * copied unchanged. Returns null when a
 * moved reference would leave the sheet, a quote or bracket is unterminated, or
 * the formula uses a whole-row or whole-column range, so the caller keeps the
 * cached value rather than emit a formula that differs from the workbook's.
 */
export function shiftFormula(formula: string, dr: number, dc: number): string | null {
  if (dr === 0 && dc === 0) return formula;
  let out = '';
  let i = 0;
  while (i < formula.length) {
    const ch = formula[i]!;
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      for (;;) {
        const close = formula.indexOf(ch, j);
        if (close < 0) return null;
        if (formula[close + 1] === ch) { j = close + 2; continue; }
        j = close + 1;
        break;
      }
      out += formula.slice(i, j);
      i = j;
      continue;
    }
    if (ch === '[') {
      let depth = 0;
      let j = i;
      for (; j < formula.length; j++) {
        if (formula[j] === '[') depth++;
        else if (formula[j] === ']' && --depth === 0) break;
      }
      if (j >= formula.length) return null;
      out += formula.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    const prevIsName = i > 0 && NAME_CHAR.test(formula[i - 1]!);
    // An unquoted sheet range such as Q1:Q4!B2 names sheets, whatever they look
    // like, so `name:name!` is copied as it stands.
    if (!prevIsName && NAME_CHAR.test(ch)) {
      WORD_AT.lastIndex = i;
      const first = WORD_AT.exec(formula)![0];
      if (formula[i + first.length] === ':') {
        WORD_AT.lastIndex = i + first.length + 1;
        const last = WORD_AT.exec(formula)?.[0];
        const bang = i + first.length + 1 + (last?.length ?? 0);
        if (last && formula[bang] === '!') {
          out += formula.slice(i, bang + 1);
          i = bang + 1;
          continue;
        }
      }
    }
    if (!prevIsName && /[A-Za-z$]/.test(ch)) {
      REF_AT.lastIndex = i;
      const ref = REF_AT.exec(formula);
      const next = ref ? (formula[i + ref[0].length] ?? '') : '';
      if (ref && !NAME_CHAR.test(next) && next !== '(' && next !== '!' && next !== '[') {
        const colAbs = ref[1]!, rowAbs = ref[3]!;
        const c = colToIndex(ref[2]!);
        const r = Number.parseInt(ref[4]!, 10) - 1;
        if (c >= 0 && c < MAX_COLS && r >= 0 && r < MAX_ROWS) {
          const nc = colAbs ? c : c + dc;
          const nr = rowAbs ? r : r + dr;
          if (nc < 0 || nc >= MAX_COLS || nr < 0 || nr >= MAX_ROWS) return null;
          out += `${colAbs}${indexToCol(nc)}${rowAbs}${nr + 1}`;
          i += ref[0].length;
          continue;
        }
      }
    }
    if (!prevIsName && /\d/.test(ch)) {
      NUMBER_AT.lastIndex = i;
      const num = NUMBER_AT.exec(formula)![0];
      // A number touching a colon is a whole-row range such as 2:5.
      if (formula[i + num.length] === ':' || formula[i - 1] === ':') return null;
      out += num;
      i += num.length;
      continue;
    }
    if (NAME_CHAR.test(ch)) {
      WORD_AT.lastIndex = i;
      const word = WORD_AT.exec(formula)![0];
      // Letters touching a colon are a whole-column range such as A:C.
      if (/^\$?[A-Za-z]{1,3}$/.test(word) && (formula[i + word.length] === ':' || formula[i - 1] === ':')) return null;
      out += word;
      i += word.length;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/** 0-based column index to its letters (0 → "A", 26 → "AA"). */
function indexToCol(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ─── A1 refs ─────────────────────────────────────────────────────────────────

const REF_RE = /^([A-Za-z]+)(\d+)$/;

/** "A1" → { row: 0, col: 0 }; null if unparseable. */
function parseRef(ref: string): { row: number; col: number } | null {
  const m = REF_RE.exec(ref.trim());
  if (!m) return null;
  const col = colToIndex(m[1]!);
  const row = Number.parseInt(m[2]!, 10) - 1;
  if (col < 0 || row < 0) return null;
  return { row, col };
}

/** Column letters → 0-based index ("A"→0, "Z"→25, "AA"→26). */
function colToIndex(letters: string): number {
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    const c = letters.charCodeAt(i) & ~0x20; // fold to uppercase
    if (c < 65 || c > 90) return -1;
    n = n * 26 + (c - 64);
    if (n > MAX_COLS + 1) return MAX_COLS; // clamp a runaway ref
  }
  return n - 1;
}

/** Inner XML of the first `<name>…</name>` element (empty string for `<name/>`). */
function firstElem(xml: string, name: string): string | null {
  const re = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>|<${name}\\b[^>]*/>`, 'i');
  const m = re.exec(xml);
  if (!m) return null;
  return m[1] !== undefined ? m[1] : '';
}

/** Text of the first `<name>` element, XML-decoded (raw `<v>` values). */
function firstElemText(xml: string, name: string): string {
  const inner = firstElem(xml, name);
  return inner ? inner : '';
}

/** Read an attribute value from a tag string (double- or single-quoted). */
function attr(tag: string, name: string): string | null {
  const re = new RegExp(`\\b${name.replace(/[:]/g, '\\$&')}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i');
  const m = re.exec(tag);
  if (!m) return null;
  return decodeXml(m[2] !== undefined ? m[2] : (m[3] ?? ''));
}

/** Decode the five XML predefined entities plus numeric char refs. Bounded: one
 *  linear pass, no recursion, so an entity-dense string can't spin. */
function decodeXml(s: string): string {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === '#') {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    switch (body) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
      default:
        return whole; // unknown named entity - leave verbatim
    }
  });
}
