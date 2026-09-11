// SPDX-License-Identifier: MPL-2.0
/**
 * Spreadsheet paste → TSV.
 *
 * When you copy cells from Excel / Google Sheets / Numbers, the clipboard carries
 * BOTH a plain-text serialisation (usually TSV, but locale-dependent) AND a real
 * `text/html` `<table>`. Reading the HTML table sidesteps every delimiter / quote /
 * embedded-newline ambiguity - the cell grid is explicit - so a data tool gets the
 * exact rows the user copied. This converts that HTML to clean TSV and installs a
 * textarea paste handler that swaps it in, falling through to the browser's default
 * paste for ordinary prose (no `<table>` present).
 */

/** Convert the first `<table>` in an HTML clipboard fragment to TSV. '' if none. */
export function htmlTableToTsv(html: string): string {
  if (!html || !/<table[\s>]/i.test(html)) return '';
  let doc: Document;
  try {
    // Turn intra-cell line breaks into spaces first - textContent alone would jam
    // "A<br>B" into "AB".
    doc = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, ' '), 'text/html');
  } catch {
    return '';
  }
  const table = doc.querySelector('table');
  if (!table) return '';
  const rows: string[] = [];
  table.querySelectorAll('tr').forEach((tr) => {
    const cells: string[] = [];
    tr.querySelectorAll('th, td').forEach((cell) => {
      // One line per cell: collapse internal whitespace (wrapped cells, <br>, tabs)
      // so a multi-line cell can't split the TSV grid.
      cells.push((cell.textContent ?? '').replace(/\s+/g, ' ').trim());
      // A merged cell (colspan) keeps the columns aligned by padding blanks.
      const span = parseInt(cell.getAttribute('colspan') || '1', 10);
      for (let k = 1; k < span; k++) cells.push('');
    });
    if (cells.length) rows.push(cells.join('\t'));
  });
  return rows.join('\n');
}

/**
 * Attach a paste handler that replaces a spreadsheet-table paste with clean TSV.
 * A no-op for plain-text / prose paste (the browser handles it normally). The
 * inserted text replaces the current selection and fires an `input` event so the
 * tool runtime picks it up. Safe to call once per textarea.
 */
export function installTablePaste(ta: HTMLTextAreaElement): void {
  if (ta.dataset.tablePaste) return; // idempotent - never double-attach on a reused node
  ta.dataset.tablePaste = '1';
  ta.addEventListener('paste', (e: ClipboardEvent) => {
    const html = e.clipboardData?.getData('text/html');
    const tsv = html ? htmlTableToTsv(html) : '';
    if (!tsv) return; // not a table paste → let the browser insert plain text
    e.preventDefault();
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    ta.value = ta.value.slice(0, start) + tsv + ta.value.slice(end);
    const caret = start + tsv.length;
    ta.setSelectionRange(caret, caret);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
