// SPDX-License-Identifier: MPL-2.0
/**
 * Text-to-table parsing and serialising for the `table` input (the clipboard and
 * file round-trip). The batch-editing story is "edit in the spreadsheet you
 * already have", so paste-in and copy-out must be lossless against the three
 * formats collaboration tools actually produce:
 *
 *   - TSV: what Excel, Google Sheets, and Numbers put on the clipboard
 *   - Markdown pipe tables: Slack, Notion, GitHub, and every LLM
 *   - CSV: files and "export as CSV" flows (RFC 4180 quoting)
 *
 * Detection is structural, not user-selected: tabs mean TSV, a pipe-framed
 * block means Markdown, otherwise CSV. Copy-out writes TSV (text/plain) plus a
 * real <table> (text/html) in one clipboard item, so pasting lands as a grid in
 * Sheets/Excel/Docs/Notion alike; toMarkdown is offered for text-only surfaces.
 *
 * Pure string functions, no DOM. Usable from every shell (the web sidebar's
 * paste/copy wiring, the CLI's `--<input>-data=file` import). Tested in
 * tests/table-text.test.ts.
 */
import type { TableValue } from './inputs.ts';

/** True when the text looks like a multi-cell grid rather than one value. */
export function looksLikeTable(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.includes('\t')) return true;
  if (/^\s*\|.*\|\s*$/m.test(t)) return true;
  // Multi-line comma-separated content with a consistent column count reads as
  // CSV; a single line (or inconsistent commas) is treated as one cell.
  const lines = t.split(/\r\n?|\n/).filter(l => l.trim());
  if (lines.length < 2 || !lines[0]!.includes(',')) return false;
  const n = splitCsvLine(lines[0]!).length;
  return n > 1 && lines.every(l => splitCsvLine(l).length === n);
}

/**
 * Parse clipboard text into a {@link TableValue} (first row = headings), or
 * null when the text doesn't parse as any tabular form.
 */
export function parseTableText(text: string): TableValue | null {
  const t = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '');
  if (!t.trim()) return null;
  const lines = t.split('\n');
  let grid: string[][];
  if (t.includes('\t')) {
    grid = lines.map(l => l.split('\t'));
  } else if (/^\s*\|.*\|\s*$/m.test(t)) {
    grid = lines
      .map(l => l.trim())
      .filter(l => l.startsWith('|') || l.includes('|'))
      // Drop the |---|---| alignment separator row.
      .filter(l => !/^\|?[\s:|-]+\|?$/.test(l) || !/-/.test(l))
      .map(l => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()));
  } else {
    grid = lines.map(splitCsvLine);
  }
  grid = grid.filter(r => r.some(c => c.trim() !== ''));
  if (!grid.length || !grid[0]!.length) return null;
  const width = Math.max(...grid.map(r => r.length));
  const rows = grid.map(r => {
    const out = r.slice(0, width);
    while (out.length < width) out.push('');
    return out;
  });
  return { columns: rows[0]!, rows: rows.slice(1) };
}

/** One CSV line → cells, honouring RFC 4180 double-quote quoting. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"' && cur === '') {
      quoted = true;
    } else if (ch === ',') {
      cells.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

/** TSV serialisation (header row first): the text/plain clipboard flavour.
 *  Tabs/newlines inside a cell become spaces: TSV has no escape syntax, and a
 *  shifted grid is worse than a flattened line break. */
export function toTsv(t: TableValue): string {
  const clean = (c: string): string => c.replace(/[\t\n\r]+/g, ' ');
  return [t.columns, ...t.rows].map(r => r.map(clean).join('\t')).join('\n');
}

/** GitHub-flavoured Markdown pipe table (pipes inside cells escaped). */
export function toMarkdown(t: TableValue): string {
  const clean = (c: string): string => c.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
  const row = (r: string[]): string => `| ${r.map(clean).join(' | ')} |`;
  return [row(t.columns), `|${t.columns.map(() => ' --- |').join('')}`, ...t.rows.map(row)].join('\n');
}

/** A minimal semantic <table>: the text/html clipboard flavour, so a paste
 *  into Sheets/Excel/Docs/Notion lands as a real grid. */
export function toHtmlTable(t: TableValue): string {
  const esc = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cells = (r: string[], tag: string): string => r.map(c => `<${tag}>${esc(c)}</${tag}>`).join('');
  return `<table><thead><tr>${cells(t.columns, 'th')}</tr></thead><tbody>${
    t.rows.map(r => `<tr>${cells(r, 'td')}</tr>`).join('')}</tbody></table>`;
}
