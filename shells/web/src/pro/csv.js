/**
 * Pro / Batch mode — tiny, dependency-free CSV/TSV reader & writer.
 *
 * Handles the awkward parts of real spreadsheet exports: quoted fields, escaped
 * quotes (""), and embedded commas / newlines. Generic on purpose (no batch
 * knowledge) so it can be unit-tested in isolation — see csv.test.js.
 */

/** Serialize records to CSV text. `keys` fixes column order; `headers` optional. */
export function toCSV(keys, records, headers = keys) {
  const lines = [headers.map(csvCell).join(',')];
  for (const rec of records) {
    lines.push(keys.map(k => csvCell(rec[k])).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Parse delimited text into a 2D array of string fields. Default delimiter is
 * comma; pass '\t' for spreadsheet paste. Trailing blank lines are dropped.
 */
export function parseDelimited(text, delim = ',') {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const endField = () => { row.push(field); field = ''; };
  const endRow = () => { endField(); rows.push(row); row = []; };

  while (i < n) {
    const ch = text[i];
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
  // Flush trailing field/row if the text didn't end with a newline.
  if (field !== '' || row.length) endRow();

  // Drop wholly-empty rows (e.g. a trailing newline).
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}

/** Guess the delimiter of a pasted/loaded blob from its first line. */
export function detectDelimiter(text) {
  const firstLine = text.slice(0, text.indexOf('\n') >= 0 ? text.indexOf('\n') : text.length);
  const tabs = (firstLine.match(/\t/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  // European / Excel locales emit ';'-separated CSVs, so vote tab vs comma vs
  // semicolon. Most frequent wins; comma breaks ties (the canonical default and
  // what our own exports use).
  const semis = (firstLine.match(/;/g) || []).length;
  if (tabs > commas && tabs > semis) return '\t';
  if (semis > commas && semis > tabs) return ';';
  return ',';
}
