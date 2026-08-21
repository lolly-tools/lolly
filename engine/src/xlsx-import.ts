// SPDX-License-Identifier: MPL-2.0
/**
 * xlsx-import.ts - read the first worksheet of an .xlsx into a plain grid.
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
 * lesson"); rows/cols/cells are hard-capped so a sheet claiming cell `XFD1048576`
 * can't balloon the grid.
 */

import { unzipSync } from 'fflate';

/** Options for {@link readXlsx}. */
export interface ReadXlsxOpts {
  /** max rows to return (default {@link DEFAULT_XLSX_ROW_LIMIT}). */
  limit?: number;
  /** Which worksheet to read: a 0-based index into {@link listXlsxSheets}, or an
   *  exact sheet name. Defaults to the first sheet (byte-identical to omitting it). */
  sheet?: number | string;
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

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Read the first worksheet of an .xlsx into a `string[][]` grid.
 *
 * @param bytes the raw file bytes (the shell reads the file; this owns unzip).
 * @param opts  optional row limit.
 * @throws if the bytes are not a zip, the zip is truncated/corrupt, the file is
 *         macro-enabled, or it carries no readable worksheet.
 */
export function readXlsx(bytes: Uint8Array, opts: ReadXlsxOpts = {}): ReadXlsxResult {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
    throw new Error('The file is empty.');
  }
  // Zip local-file-header magic "PK\x03\x04" (or the empty/spanned variants).
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    throw new Error('This isn’t an .xlsx file (not a zip archive).');
  }

  const limit =
    Number.isFinite(opts.limit) && (opts.limit as number) > 0
      ? Math.floor(opts.limit as number)
      : DEFAULT_XLSX_ROW_LIMIT;

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

  const chosen = resolveSheet(store, opts.sheet);
  if (!chosen) {
    throw new Error(
      opts.sheet === undefined
        ? 'The workbook has no readable worksheet.'
        : `The workbook has no sheet ${typeof opts.sheet === 'number' ? `at index ${opts.sheet}` : `named “${opts.sheet}”`}.`,
    );
  }
  const sheetXml = store.text(chosen.path);
  if (sheetXml == null) throw new Error('The chosen sheet is missing or too large.');

  const shared = readSharedStrings(store);

  const { rows, truncated } = readSheet(sheetXml, shared, limit);
  if (!rows.length) throw new Error('That sheet has no cells.');
  return { rows, truncated, sheetPath: chosen.path, sheetName: chosen.name || undefined };
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
function resolveSheet(store: PartStore, want: number | string | undefined): SheetEntry | null {
  const sheets = allSheets(store);
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

function readSheet(
  xml: string,
  shared: string[],
  limit: number,
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

    const value = cellValue(attrs, inner, shared);
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

  const width = maxCol + 1;
  const rows: string[][] = [];
  for (let r = 0; r <= maxRow; r++) {
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

// ─── tiny XML helpers (bounds-safe, no DOM) ──────────────────────────────────

/** The first opening (or self-closing) `<name …>` tag in `xml`, whole match. */
function firstTag(xml: string, name: string): string | null {
  const re = new RegExp(`<${name}\\b[^>]*/?>`, 'i');
  const m = re.exec(xml);
  return m ? m[0] : null;
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
