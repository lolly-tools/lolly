// SPDX-License-Identifier: MPL-2.0
/**
 * Pro / Batch mode — import/export bridge between batch state and portable
 * formats, so jobs can be authored in external tools (Sheets, Excel, a script)
 * and loaded here, or exported for someone else to manage.
 *
 * CSV/TSV schema (one render per row):
 *   tool  , format , <inputId> , <inputId> , …
 *   ----  , ------ , --------------------------- ,
 *   poster, png    , Hello     , #ff0000    , …
 *
 * • `tool` — the tool id (permanent contract; stable across renames).
 * • `format` — per-row export format; blank falls back to the global one.
 * • remaining columns are input ids (union across all selected tools). A blank
 *   cell means "leave the tool's default". Cells for inputs a tool doesn't have
 *   are simply ignored on import.
 *
 * Values are stored in natural string form; assets as an asset id, and
 * `blocks` as JSON. This keeps the file legible and hand-editable.
 */
import { deriveColumns } from './model.ts';
import { toCSV, parseDelimited, detectDelimiter } from './csv.ts';
import { isUnit } from '@lolly/engine';
import type { InputSpec, InputValue, ToolManifest } from '@lolly/engine';

/** A batch row read from / written into by the CSV bridge. */
export interface IoRow {
  toolId: string;
  manifest: ToolManifest | null;
  values: Record<string, InputValue>;
  format?: string;
  outWidth?: number;
  outHeight?: number;
  unit?: string;
  dpi?: number;
}

const TOOL_COL = 'tool';
const FORMAT_COL = 'format';
const WIDTH_COL = 'width';
const HEIGHT_COL = 'height';
const UNIT_COL = 'unit';
const DPI_COL = 'dpi';
// 'template' is an accepted tool alias; these reserved columns aren't tool inputs.
const RESERVED = new Set([TOOL_COL, FORMAT_COL, WIDTH_COL, HEIGHT_COL, UNIT_COL, DPI_COL, 'template']);

/** Read a property off an untrusted structured value (model value boundary). */
const readProp = (o: unknown, k: string): unknown =>
  (o && typeof o === 'object' ? Reflect.get(o, k) : undefined);

/** Narrow an untrusted value to a string. */
const asStr = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

function serializeValue(input: InputSpec | undefined, value: InputValue | undefined): string {
  if (value == null) return '';
  switch (input?.type) {
    case 'boolean': return value ? 'true' : 'false';
    case 'asset':   return asStr(readProp(value, 'id')) ?? '';
    case 'blocks':  return Array.isArray(value) && value.length ? JSON.stringify(value) : '';
    case 'vector':  return ''; // expanded into one "<id>.<field>" column each — see batchToCsv
    default:        return String(value);
  }
}

// Returns undefined to mean "no value → keep the tool default".
function parseValue(input: InputSpec | undefined, raw: string | undefined): InputValue | undefined {
  const str = (raw ?? '').trim();
  if (str === '') return undefined;
  switch (input?.type) {
    case 'boolean': return /^(true|1|yes|y|on|x|✓)$/i.test(str);
    case 'number': { const n = Number(str); return Number.isNaN(n) ? undefined : n; }
    case 'asset':   return { id: str };
    case 'blocks':  try { return JSON.parse(str); } catch { return undefined; }
    case 'vector':  return undefined; // edited via "<id>.<field>" sub-columns — see csvToBatch
    default:        return raw; // preserve original (untrimmed) string for text
  }
}

/** One materialized CSV column: a plain input, or one field of a vector. */
interface CsvCol {
  header: string;
  key: string;
  fieldId: string | null;
}

/**
 * Serialize the current batch rows to CSV text.
 * @param rows
 * @param defaults toolbar defaults — used to resolve each row's EFFECTIVE
 *        unit/DPI so the CSV reproduces the run.
 */
export function batchToCsv(rows: IoRow[], defaults: { unit?: string; dpi?: number } = {}): string {
  const usable = rows.filter(r => r.toolId && r.manifest);
  // A vector column becomes one "<id>.<field>" column per field (flat + legible);
  // every other column passes through unchanged.
  const csvCols: CsvCol[] = [];
  for (const c of deriveColumns(usable)) {
    if (c.type === 'vector') {
      // Union the fields across the tools that share this column, so a
      // same-named vector with differing fields (e.g. quotes {x,y} vs
      // dynamic-layout {zoom,x,y}) still round-trips completely.
      const seen = new Set<string>();
      for (const m of c.members.values()) {
        for (const f of m.fields ?? []) {
          if (seen.has(f.id)) continue;
          seen.add(f.id);
          csvCols.push({ header: `${c.key}.${f.id}`, key: c.key, fieldId: f.id });
        }
      }
    } else {
      csvCols.push({ header: c.key, key: c.key, fieldId: null });
    }
  }
  const columns = [TOOL_COL, FORMAT_COL, WIDTH_COL, HEIGHT_COL, UNIT_COL, DPI_COL, ...csvCols.map(c => c.header)];

  const records = usable.map(r => {
    const byId = new Map((r.manifest?.inputs ?? []).map(i => [i.id, i]));
    const unit = r.unit ?? defaults.unit ?? 'px';
    const rec: Record<string, string | number> = {
      [TOOL_COL]: r.toolId,
      [FORMAT_COL]: r.format ?? '',
      [WIDTH_COL]: r.outWidth ?? '',
      [HEIGHT_COL]: r.outHeight ?? '',
      [UNIT_COL]: unit,
      // DPI only applies to physical units; leave blank for px.
      [DPI_COL]: unit === 'px' ? '' : (r.dpi ?? defaults.dpi ?? 300),
    };
    for (const c of csvCols) {
      if (c.fieldId) {
        const vec = r.values[c.key];
        const fv = readProp(vec, c.fieldId);
        rec[c.header] = fv != null ? String(fv) : '';
      } else {
        rec[c.header] = serializeValue(byId.get(c.key), r.values[c.key]);
      }
    }
    return rec;
  });

  return toCSV(columns, records);
}

/**
 * Parse CSV/TSV text into batch rows.
 * @param text
 * @param deps loader/cache and a fresh-row factory
 * @returns rows plus any warnings/errors
 */
export async function csvToBatch<R extends IoRow>(
  text: string,
  { getTool, makeRow }: {
    getTool: (id: string) => Promise<{ manifest: ToolManifest }>;
    makeRow: () => R;
  },
): Promise<{ rows: R[]; errors: string[] }> {
  const grid = parseDelimited(text, detectDelimiter(text));
  if (grid.length < 1) return { rows: [], errors: ['The file is empty.'] };

  const header = (grid[0] ?? []).map(h => h.trim());
  const toolIdx = header.findIndex(h => h === TOOL_COL || h === 'template');
  if (toolIdx < 0) {
    return { rows: [], errors: [`No "tool" (or "template") column found. Header was: ${header.join(', ')}`] };
  }
  const formatIdx = header.findIndex(h => h === FORMAT_COL);
  const widthIdx = header.findIndex(h => h === WIDTH_COL);
  const heightIdx = header.findIndex(h => h === HEIGHT_COL);
  const unitIdx = header.findIndex(h => h === UNIT_COL);
  const dpiIdx = header.findIndex(h => h === DPI_COL);

  const rows: R[] = [];
  const errors: string[] = [];

  // Two columns sharing one input id would silently last-write-win on import
  // (the per-row loop writes each header in order). Warn rather than fail — the
  // data still imports, just with the rightmost column winning. Reserved/blank
  // headers and distinct vector sub-columns ("pos.x" vs "pos.y") aren't dupes.
  const seenHeaders = new Set<string>();
  for (const h of header) {
    if (h === '' || RESERVED.has(h)) continue;
    if (seenHeaders.has(h)) errors.push(`Duplicate column "${h}" — later values overwrite earlier ones.`);
    else seenHeaders.add(h);
  }

  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r] ?? [];
    const toolId = (cells[toolIdx] ?? '').trim();
    const row = makeRow();
    if (!toolId) { rows.push(row); continue; } // blank line → empty row

    let tool: { manifest: ToolManifest };
    try {
      tool = await getTool(toolId);
    } catch {
      // r is 0-based into the parsed grid (row 0 is the header), so the human
      // line is r + 1. Caveat: parseDelimited drops wholly-empty rows, so this
      // can under-count if the source file had blank lines above this one.
      errors.push(`Row ${r + 1}: unknown tool "${toolId}" — skipped its data.`);
      rows.push(row);
      continue;
    }
    row.toolId = toolId;
    row.manifest = tool.manifest;
    if (formatIdx >= 0 && (cells[formatIdx] ?? '').trim()) row.format = (cells[formatIdx] ?? '').trim();
    if (widthIdx >= 0) { const n = parseFloat(cells[widthIdx] ?? ''); if (n > 0) row.outWidth = n; }
    if (heightIdx >= 0) { const n = parseFloat(cells[heightIdx] ?? ''); if (n > 0) row.outHeight = n; }
    if (unitIdx >= 0) { const u = (cells[unitIdx] ?? '').trim().toLowerCase(); if (isUnit(u)) row.unit = u; }
    if (dpiIdx >= 0) { const n = parseInt(cells[dpiIdx] ?? '', 10); if (n > 0) row.dpi = n; }

    const byId = new Map((tool.manifest.inputs ?? []).map(i => [i.id, i]));
    const vecAcc: Record<string, Record<string, number>> = {};
    for (let c = 0; c < header.length; c++) {
      const key = header[c] ?? '';
      if (RESERVED.has(key)) continue;

      // Vector sub-column "<inputId>.<fieldId>" → accumulate into the object.
      const dot = key.indexOf('.');
      if (dot > 0) {
        const vinput = byId.get(key.slice(0, dot));
        const fid = key.slice(dot + 1);
        if (vinput?.type === 'vector' && (vinput.fields ?? []).some(f => f.id === fid)) {
          const cell = (cells[c] ?? '').trim();
          const n = Number(cell);
          if (cell !== '' && !Number.isNaN(n)) (vecAcc[vinput.id] ??= {})[fid] = n;
          continue;
        }
      }

      const input = byId.get(key);
      if (!input || input.type === 'vector') continue; // bare vector column has no single value
      const v = parseValue(input, cells[c]);
      if (v !== undefined) row.values[key] = v;
    }
    for (const [id, obj] of Object.entries(vecAcc)) row.values[id] = obj;
    rows.push(row);
  }
  return { rows, errors };
}

/**
 * Parse a clipboard blob (spreadsheet paste) into a 2D array of cells, using the
 * detected delimiter (tab for Excel/Sheets, comma for CSV). Used for paste-fill.
 */
export function parseClipboardGrid(text: string): string[][] {
  return parseDelimited(text, detectDelimiter(text));
}

/** Coerce a single pasted string into a value given the input declaration. */
export function coerceCell(input: InputSpec | undefined, raw: string | undefined): InputValue | undefined {
  return parseValue(input, raw);
}
