// SPDX-License-Identifier: MPL-2.0
/** Values-only table conversion shared by browser and Node file operations. */
import { readXlsx } from './xlsx-import.ts';
import { writeXlsx } from './xlsx-write.ts';
import { rowsToCsv } from './data-import.ts';
import { parseTableText } from './table-text.ts';
export function sourceToGrid(kind: string, bytes: Uint8Array): string[][] {
  if (kind === 'xlsx') return readXlsx(bytes).rows;
  if (kind === 'json') {
    let parsed: unknown;
    try { parsed = JSON.parse(new TextDecoder().decode(bytes)); }
    catch { throw new Error('That JSON could not be parsed.'); }
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Expected a non-empty JSON array of rows.');
    if (Array.isArray(parsed[0])) return (parsed as unknown[][]).map((r) => r.map((c) => String(c ?? '')));
    // Array of objects → header = the union of keys in first-seen order.
    const keys: string[] = [];
    for (const row of parsed as Record<string, unknown>[]) for (const k of Object.keys(row ?? {})) if (!keys.includes(k)) keys.push(k);
    return [keys, ...(parsed as Record<string, unknown>[]).map((row) => keys.map((k) => String(row?.[k] ?? '')))];
  }
  // csv / tsv (parseTableText auto-detects the delimiter + Markdown tables).
  const table = parseTableText(new TextDecoder().decode(bytes));
  if (!table) throw new Error('That file does not parse as CSV/TSV.');
  return [table.columns, ...table.rows];
}

/** Re-encode a grid to the target data format. Returns bytes for xlsx, a string for
 *  the text formats (the Blob wraps either). Exported for the round-trip test. */
export function gridToTarget(grid: string[][], targetId: string): Uint8Array | string {
  switch (targetId) {
    case 'csv':  return rowsToCsv(grid);
    case 'tsv':  return grid.map((r) => r.map((c) => c.replace(/[\t\r\n]/g, ' ')).join('\t')).join('\n');
    case 'xlsx': return writeXlsx({ rows: grid });
    case 'json': {
      const [header = [], ...body] = grid;
      if (header.some(h => !h.trim()) || new Set(header).size !== header.length) throw new Error('JSON needs unique, non-empty column headings. Rename the headings and try again.');
      if (body.some(row => row.length > header.length)) throw new Error('Some rows have more cells than column headings. Add headings before converting to JSON.');
      const objs = body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
      return JSON.stringify(objs, null, 2);
    }
    default: throw new Error('That conversion is not supported.');
  }
}
