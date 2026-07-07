// SPDX-License-Identifier: MPL-2.0
/**
 * Batch — the shared, DOM-free contract for "many URL-mode rows under one file".
 *
 * A batch is just a table: each row names a tool and a set of input values (plus
 * optional per-row format/size), exactly the params a single CLI/URL render takes.
 * The engine owns the CSV/TSV reader-writer and the row parser; each shell renders
 * the rows its own way (the CLI writes a directory, the TUI packs a zip, the web
 * `/pro` grid drives its editor) — one contract, per-shell runners, no drift.
 *
 * This module has NO DOM/host/SUSE dependencies (pure string + number logic), so it
 * lives in the open-sourceable engine alongside url-mode.ts. The row `params` are
 * raw strings handed to parseUrlState downstream, so every input type expressible on
 * the CLI (blocks JSON / tilde-compact, vector `id.field`, #-less color, …) is
 * expressible in a cell — the batch inherits URL mode's whole contract for free.
 */

// ── CSV/TSV reader & writer (moved here from shells/web/src/pro/csv.ts) ──────────

/** Serialize records to CSV text. `keys` fixes column order; `headers` optional. */
export function toCSV(
  keys: string[],
  records: ReadonlyArray<Record<string, unknown>>,
  headers: string[] = keys,
): string {
  const lines = [headers.map(csvCell).join(',')];
  for (const rec of records) {
    lines.push(keys.map(k => csvCell(rec[k])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Parse delimited text into a 2D array of string fields. Default delimiter is comma;
 * pass '\t' for spreadsheet paste. Trailing blank lines are dropped.
 */
export function parseDelimited(text: string, delim = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const endField = () => { row.push(field); field = ''; };
  const endRow = () => { endField(); rows.push(row); row = []; };

  while (i < n) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === delim) { endField(); i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { endRow(); i++; continue; }
    field += ch; i++;
  }
  if (field !== '' || row.length) endRow();
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}

/** Guess the delimiter of a pasted/loaded blob from its first line. */
export function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.indexOf('\n') >= 0 ? text.indexOf('\n') : text.length);
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  if (tabs > commas && tabs > semis) return '\t';
  if (semis > commas && semis > tabs) return ';';
  return ',';
}

// ── Batch rows ──────────────────────────────────────────────────────────────────

/** One batch row: a tool + its input params + optional per-row output settings. The
 *  `params` are raw strings coerced by parseUrlState at render time (URL-mode rules). */
export interface BatchRow {
  toolId: string;
  format?: string;
  width?: number;
  height?: number;
  unit?: string;
  dpi?: number;
  filename?: string;
  params: Record<string, string>;
}

// Header names that map to per-row OUTPUT settings, not tool inputs (case-insensitive).
// Everything else in the header is treated as an input id.
const RESERVED_HEADERS: Record<string, keyof Omit<BatchRow, 'params'>> = {
  toolid: 'toolId', tool: 'toolId',
  format: 'format', export: 'format',
  width: 'width', w: 'width',
  height: 'height', h: 'height',
  unit: 'unit', dpi: 'dpi',
  filename: 'filename', output: 'filename',
};

/**
 * Parse CSV/TSV text into batch rows. The header row names the columns: a `toolId`
 * column is required; `format`/`width`/`height`/`unit`/`dpi`/`filename` are per-row
 * output settings; every other column is a tool input id whose cell becomes a raw
 * param string. Blank cells are skipped. Rows with no toolId are dropped.
 */
export function parseBatchCsv(text: string): BatchRow[] {
  const grid = parseDelimited(text, detectDelimiter(text));
  if (grid.length < 2) return [];
  const header = grid[0]!.map(h => h.trim());
  const out: BatchRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r]!;
    const row: BatchRow = { toolId: '', params: {} };
    header.forEach((h, c) => {
      const raw = (cells[c] ?? '').trim();
      if (!h || raw === '') return;
      const reserved = RESERVED_HEADERS[h.toLowerCase()];
      if (reserved === 'toolId') row.toolId = raw;
      else if (reserved === 'width' || reserved === 'height' || reserved === 'dpi') {
        const num = Number(raw);
        if (Number.isFinite(num) && num > 0) row[reserved] = num;
      } else if (reserved) row[reserved] = raw as never;
      else row.params[h] = raw;   // a tool input
    });
    if (row.toolId) out.push(row);
  }
  return out;
}

/** A tool the template emitter needs — id + its input ids (order preserved). */
export interface BatchTemplateTool { id: string; inputs: Array<{ id: string }> }

/**
 * Emit a starter CSV grid for a set of tools: the reserved output columns followed by
 * the union of the tools' input ids, and one prefilled `toolId` row per tool.
 */
export function batchCsvTemplate(tools: BatchTemplateTool[]): string {
  const inputIds: string[] = [];
  const seen = new Set<string>();
  for (const t of tools) for (const i of t.inputs) if (!seen.has(i.id)) { seen.add(i.id); inputIds.push(i.id); }
  const header = ['toolId', 'format', 'width', 'height', 'unit', 'dpi', ...inputIds];
  const rows = tools.map(t => ({ toolId: t.id }));
  return toCSV(header, rows);
}
