// SPDX-License-Identifier: MPL-2.0
/**
 * Data-file → blocks rows.
 *
 * The counterpart to the CSV/JSON *export* path: this reads a user's CSV or JSON
 * file and maps its columns onto a `blocks` input's declared sub-fields, so a
 * spreadsheet or API dump can populate a tool (chart data, tables, name lists)
 * instead of being retyped row by row.
 *
 * Pure and DOM-free — the shell reads the file to text and hands it here; the
 * result flows back through the ordinary input-set path, so it serialises to the
 * URL and saves exactly like hand-entered blocks. Wired via the manifest's
 * `blocks.importData` (see schemas/tool.schema.json) and offered by the web shell.
 *
 * Mapping: columns are matched to fields by explicit `columns` map, else by a
 * case-insensitive match of the column header/key to the field's `id` then its
 * `label`. Array-shaped JSON (`[[…],[…]]`) with no header maps positionally, in
 * declared field order. Unknown columns are ignored; unmatched fields fill empty.
 */

/** A blocks sub-field, as declared in the tool manifest. */
export interface DataField {
  id: string;
  label?: string;
  type?: string;
}

/** Options for {@link parseDataRows}. */
export interface ParseDataOpts {
  /** the blocks sub-fields. */
  fields?: DataField[];
  /** force a format; auto-detected from the text otherwise. */
  format?: 'csv' | 'json';
  /** explicit fieldId → source column/key overrides. */
  columns?: Record<string, string>;
  /** max rows to import. */
  limit?: number;
}

/** Result of {@link parseDataRows}: rows keyed by field id, plus a truncation flag. */
export interface ParseDataResult {
  rows: Record<string, string>[];
  truncated: boolean;
}

/** Hard cap on imported rows — a runaway-input backstop, well above any real
 *  hand-authored dataset. The shell should also bound the file size at pick time. */
export const DEFAULT_ROW_LIMIT = 1000;

// A single record is either a keyed JSON object or a positional cell array.
type Rec = Record<string, unknown> | unknown[];
// One accessor per field: reads its value out of a single record.
type Accessor = (rec: Rec) => unknown;

/**
 * @param text  the raw file contents.
 * @param opts  fields, optional format/columns/limit.
 * @returns rows keyed by field id.
 */
export function parseDataRows(text: string, opts: ParseDataOpts = {}): ParseDataResult {
  const fields = (opts.fields || []).filter((f) => f && f.id);
  if (!fields.length) throw new Error('This input has no fields to import into.');
  if (typeof text !== 'string' || !text.trim()) throw new Error('The file is empty.');

  const limit =
    Number.isFinite(opts.limit) && (opts.limit as number) > 0
      ? Math.floor(opts.limit as number)
      : DEFAULT_ROW_LIMIT;
  const format = (opts.format || detectFormat(text)).toLowerCase();

  let header: string[] | null = null; // string[] of column names/keys, or null for positional
  let records: unknown[] = [];        // array of (object | string[])
  let objectMode = false;             // records are keyed objects (JSON) rather than cell arrays

  if (format === 'json') {
    const arr = readJson(text);
    records = arr;
    objectMode =
      records.length > 0 &&
      records[0] != null &&
      typeof records[0] === 'object' &&
      !Array.isArray(records[0]);
    header = objectMode ? unionKeys(records) : null;
  } else {
    const table = readCsv(text).filter((r) => r.some((c) => String(c).trim() !== ''));
    if (!table.length) throw new Error('No rows found in the file.');
    header = table[0]!.map((h) => String(h).trim()); // first row is the header
    records = table.slice(1);
  }
  if (!records.length) throw new Error('No data rows found in the file.');

  const columns = opts.columns || {};
  const lc = (s: unknown): string => String(s ?? '').trim().toLowerCase();
  const headerIndex =
    header && !objectMode ? new Map(header.map((h, i) => [lc(h), i] as const)) : null;

  // One accessor per field: reads its value out of a single record.
  const accessors: Accessor[] = fields.map((f, fi) => {
    const want = columns[f.id];
    const candidates = want != null ? [want] : [f.id, f.label];

    if (objectMode) {                                   // JSON objects → resolve by key name
      const keyByLc = new Map(header!.map((k) => [lc(k), k] as const));
      let key: string | null = null;
      for (const nm of candidates) {
        if (nm == null) continue;
        if (keyByLc.has(lc(nm))) { key = keyByLc.get(lc(nm))!; break; }
      }
      return (rec: Rec) => (key != null ? (rec as Record<string, unknown>)[key] : undefined);
    }
    if (headerIndex) {                                  // CSV rows → resolve to a column index
      let idx = -1;
      for (const nm of candidates) {
        if (nm == null) continue;
        const hit = headerIndex.get(lc(nm));
        if (hit != null) { idx = hit; break; }
      }
      return (rec: Rec) => (idx >= 0 ? (rec as unknown[])[idx] : undefined);
    }
    return (rec: Rec) => (rec as unknown[])[fi];        // headerless JSON arrays → positional
  });

  const rows: Record<string, string>[] = [];
  let truncated = false;
  for (const rec of records) {
    if (rec == null) continue;                         // tolerate junk (e.g. a null API entry)
    if (rows.length >= limit) { truncated = true; break; }
    const row: Record<string, string> = {};
    let any = false;
    for (let i = 0; i < fields.length; i++) {
      const val = coerce(accessors[i]!(rec as Rec), fields[i]!);
      row[fields[i]!.id] = val;
      if (val !== '') any = true;
    }
    if (any) rows.push(row);                            // skip fully-blank records
  }
  if (!rows.length) throw new Error('No usable rows — check the column names match the fields.');
  return { rows, truncated };
}

// ── internals ───────────────────────────────────────────────────────────────

function detectFormat(text: string): 'json' | 'csv' {
  const t = text.replace(/^﻿/, '').trim();
  return t.startsWith('[') || t.startsWith('{') ? 'json' : 'csv';
}

function readJson(text: string): unknown[] {
  let parsed: unknown;
  try { parsed = JSON.parse(text.replace(/^﻿/, '')); }
  catch { throw new Error('Could not read the JSON file — it isn’t valid JSON.'); }
  // Accept a bare array, or a wrapper object exposing a data/rows array.
  const obj = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  const arr: unknown[] | null = Array.isArray(parsed) ? parsed
    : obj && Array.isArray(obj.data) ? obj.data
    : obj && Array.isArray(obj.rows) ? obj.rows
    : null;
  if (!arr) throw new Error('JSON must be an array of rows (or { "data": [ … ] }).');
  return arr;
}

// Union of keys across records, first-seen order — so a header exists even when
// later rows carry extra columns the first row lacked.
function unionKeys(records: unknown[]): string[] {
  const seen: string[] = [];
  const has = new Set<string>();
  for (const r of records) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
    for (const k of Object.keys(r)) if (!has.has(k)) { has.add(k); seen.push(k); }
  }
  return seen;
}

// RFC 4180-ish CSV: comma-separated, "double quotes" with "" escaping, quoted
// fields may embed commas and newlines, CRLF or LF line endings, leading BOM.
function readCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [], field = '', inQuotes = false, i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }  // escaped quote
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;                        // any char (incl. newlines) is literal
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }                  // fold CRLF → LF (outside quotes only)
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); } // flush unterminated last row
  return rows;
}

function coerce(raw: unknown, field: DataField): string {
  if (raw == null) return '';
  const v = typeof raw === 'string' ? raw.trim() : String(raw);
  if (field.type === 'boolean') {
    const t = v.toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(t)) return 'true';
    if (['false', '0', 'no', 'n', 'off', ''].includes(t)) return 'false';
  }
  return v;
}
