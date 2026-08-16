// SPDX-License-Identifier: MPL-2.0
/**
 * xlsx-write.ts - write a plain grid out as a valid SpreadsheetML .xlsx.
 *
 * The write half of `xlsx-import.ts`'s read: that module unzips an .xlsx into a
 * `string[][]`; this one takes a single sheet of cells and emits the bytes back,
 * completing the round-trip (`readXlsx(writeXlsx(sheet))` recovers the values).
 * A tool that lets a user edit a `blocks`/table input can hand the result to a
 * shell that offers "download as .xlsx".
 *
 * Pure and DOM-free. The zip framing is the shared engine primitive
 * (`storeZip` from `zip.ts`, over the engine's own deflate/crc), so there is no
 * `fflate` dependency on the write path; this module owns only the OOXML string
 * scaffolding + the value→cell mapping.
 *
 * ── STRUCTURE OF THE .xlsx WE EMIT (the minimum a spreadsheet app opens) ──────
 *   • [Content_Types].xml - declares every part's MIME type.
 *   • _rels/.rels - package → xl/workbook.xml (officeDocument).
 *   • xl/workbook.xml - one <sheet name r:id="rId1"/>.
 *   • xl/_rels/workbook.xml.rels - rId1→worksheet, rId2→styles, rId3→sharedStrings.
 *   • xl/worksheets/sheet1.xml - <row r="1"><c r="A1" …>…</c></row>.
 *   • xl/sharedStrings.xml - the deduplicated string table (t="s" refs it).
 *   • xl/styles.xml - a single default cell format (schema requires the part).
 *
 * ── CELL TYPING (mirrors what readXlsx decodes) ──────────────────────────────
 *   • string  → t="s", <v> is the shared-string index.
 *   • number  → no t (numeric is the default), <v> is the literal (finite only;
 *               a non-finite number is written as its text, as a shared string).
 *   • boolean → t="b", <v>1</v> / <v>0</v> (readXlsx surfaces "TRUE"/"FALSE").
 *   • null    → omitted entirely (a genuinely empty cell - no <c> element).
 *
 * Cell refs are true A1 addresses ("A1", "Z1", "AA1", "AB1", …) computed from the
 * 0-based column index, so the file self-describes its geometry and any reader
 * (Excel / LibreOffice / Google Sheets) places the cells correctly.
 */

import { storeZip, type ZipStoreEntry } from './zip.ts';

const encoder = new TextEncoder();

/** A cell value: text, number, boolean, or an empty (omitted) cell. */
export type XlsxCell = string | number | boolean | null;

/** The single worksheet {@link writeXlsx} serialises. */
export interface XlsxSheet {
  /** Sheet tab name (default "Sheet1"); trimmed to Excel's 31-char / char rules. */
  name?: string;
  /** Row-major grid; each inner array is one row of cells, ragged rows allowed. */
  rows: XlsxCell[][];
}

// Excel's sheet-name rules: max 31 chars, and these are forbidden in a tab name.
const SHEET_NAME_MAX = 31;
// XML 1.0 forbids the C0 control range except tab (09), LF (0A) and CR (0D); a stray one makes a reader reject the part.
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching exactly the illegal control range is the intent.
const XML_INVALID_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Serialise one sheet of cells into a valid .xlsx (a zip of OOXML parts).
 *
 * @param sheet the sheet name (optional) + its row-major cell grid.
 * @returns the complete .xlsx file bytes, ready to write to disk or download.
 */
export function writeXlsx(sheet: XlsxSheet): Uint8Array {
  const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
  const name = sheetName(sheet.name);

  // Build the shared-string table as we serialise, deduplicating on the way so a
  // repeated header/value is stored once and referenced by index.
  const strings: string[] = [];
  const stringIndex = new Map<string, number>();
  let stringRefs = 0; // total string-cell references, incl. repeats (the sst `count`)
  const internString = (s: string): number => {
    stringRefs++;
    const hit = stringIndex.get(s);
    if (hit !== undefined) return hit;
    const idx = strings.length;
    strings.push(s);
    stringIndex.set(s, idx);
    return idx;
  };

  const sheetXml = worksheetXml(rows, internString);
  const sharedXml = sharedStringsXml(strings, stringRefs);

  const parts: ZipStoreEntry[] = [
    { name: '[Content_Types].xml', bytes: encoder.encode(contentTypesXml()) },
    { name: '_rels/.rels', bytes: encoder.encode(rootRelsXml()) },
    { name: 'xl/workbook.xml', bytes: encoder.encode(workbookXml(name)) },
    { name: 'xl/_rels/workbook.xml.rels', bytes: encoder.encode(workbookRelsXml()) },
    { name: 'xl/worksheets/sheet1.xml', bytes: encoder.encode(sheetXml) },
    { name: 'xl/sharedStrings.xml', bytes: encoder.encode(sharedXml) },
    { name: 'xl/styles.xml', bytes: encoder.encode(stylesXml()) },
  ];

  return storeZip(parts);
}

// ─── worksheet ───────────────────────────────────────────────────────────────

function worksheetXml(rows: XlsxCell[][], internString: (s: string) => number): string {
  let body = '';
  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r];
    if (!Array.isArray(cells)) continue;
    const rowNum = r + 1; // OOXML rows are 1-based
    let rowBody = '';
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c];
      if (cell === null || cell === undefined) continue; // empty cell → no <c>
      rowBody += cellXml(colLetters(c) + rowNum, cell, internString);
    }
    // Emit even an all-empty row so row numbering stays faithful to the grid.
    body += `<row r="${rowNum}">${rowBody}</row>`;
  }
  return (
    XML_DECL +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${body}</sheetData>` +
    '</worksheet>'
  );
}

/** One `<c r="A1" …>` element for a non-null cell. */
function cellXml(ref: string, value: XlsxCell, internString: (s: string) => number): string {
  if (typeof value === 'boolean') {
    return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"><v>${numText(value)}</v></c>`;
  }
  // Everything else (text, or a non-finite number) is stored as a shared string.
  const text = typeof value === 'number' ? String(value) : value;
  const idx = internString(sanitizeText(String(text)));
  return `<c r="${ref}" t="s"><v>${idx}</v></c>`;
}

/** Render a finite number as a bare decimal (no exponent for normal magnitudes). */
function numText(n: number): string {
  // JSON's number formatting is what a spreadsheet expects; -0 collapses to 0.
  return Object.is(n, -0) ? '0' : String(n);
}

// ─── shared strings ──────────────────────────────────────────────────────────

function sharedStringsXml(strings: string[], totalRefs: number): string {
  let items = '';
  for (const s of strings) {
    // xml:space="preserve" keeps leading/trailing whitespace a reader would trim.
    const preserve = s !== s.trim() ? ' xml:space="preserve"' : '';
    items += `<si><t${preserve}>${xmlEsc(s)}</t></si>`;
  }
  // Per ECMA-376: `count` is the total number of string-cell references (repeats
  // included); `uniqueCount` is the size of this deduplicated table.
  return (
    XML_DECL +
    `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${totalRefs}" uniqueCount="${strings.length}">` +
    items +
    '</sst>'
  );
}

// ─── fixed scaffolding parts ─────────────────────────────────────────────────

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

function contentTypesXml(): string {
  return (
    XML_DECL +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>'
  );
}

function rootRelsXml(): string {
  return (
    XML_DECL +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>'
  );
}

function workbookXml(name: string): string {
  return (
    XML_DECL +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets>' +
    `<sheet name="${xmlAttr(name)}" sheetId="1" r:id="rId1"/>` +
    '</sheets>' +
    '</workbook>'
  );
}

function workbookRelsXml(): string {
  return (
    XML_DECL +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>' +
    '</Relationships>'
  );
}

/** A minimal but complete style table - one default font/fill/border/xf. The part
 *  is schema-required even when nothing is styled; two fills is the Excel-emitted
 *  convention (patternType "none" + the built-in "gray125" reserved slot). */
function stylesXml(): string {
  return (
    XML_DECL +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="1"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>'
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** 0-based column index → spreadsheet column letters (0→"A", 25→"Z", 26→"AA"). */
export function colLetters(index: number): string {
  let n = Math.max(0, Math.floor(index));
  let out = '';
  // Bijective base-26: there is no "zero" digit, so subtract 1 each step.
  for (;;) {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return out;
}

/** Clamp/clean a requested sheet name to Excel's rules, defaulting to "Sheet1". */
function sheetName(raw: string | undefined): string {
  let name = (raw ?? '').replace(XML_INVALID_CHARS, '').replace(/[\\/?*[\]:]/g, ' ').trim();
  if (name.length > SHEET_NAME_MAX) name = name.slice(0, SHEET_NAME_MAX).trim();
  return name || 'Sheet1';
}

/** Strip characters an XML 1.0 text node cannot carry (readers reject them). */
function sanitizeText(s: string): string {
  return s.replace(XML_INVALID_CHARS, '');
}

/** Escape the three characters that matter in element text. */
function xmlEsc(s: string): string {
  return sanitizeText(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Escape for a double-quoted attribute value. */
function xmlAttr(s: string): string {
  return xmlEsc(s).replace(/"/g, '&quot;');
}
