// SPDX-License-Identifier: MPL-2.0
/**
 * Number formats on XLSX import: the xlsx-numfmt WASM module (loaded through the Node
 * loader), the styles.xml reader in engine/src/xlsx-import.ts, and proof that a read
 * with no formatter is unchanged.
 *
 * Run with: node --test tests/xlsx-numfmt.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { zipSync, strToU8 } from 'fflate';

import { readXlsx, openXlsx, XLSX_FORMAT_BATCH, type XlsxCellFormatRequest, type XlsxCellFormatter } from '../engine/src/xlsx-import.ts';
import { loadXlsxNumfmtKernel, xlsxFormatter } from '../packages/node-shell/src/xlsx-numfmt-node.ts';
import { createXlsxNumfmtKernel } from '../packages/node-shell/src/xlsx-numfmt.ts';

const kernel = await loadXlsxNumfmtKernel();
const formatCell = (await xlsxFormatter())!;

const one = (value: number | string, formatCode: string, dateSystem: 1900 | 1904 = 1900) =>
  kernel.format([{ value, formatCode, dateSystem }])[0]!;

// ─── the module ──────────────────────────────────────────────────────────────

test('upstream GridCraft number-format cases give the expected strings', () => {
  const { cases } = JSON.parse(readFileSync(new URL('./fixtures/xlsx-numfmt/upstream-cases.json', import.meta.url), 'utf8')) as
    { cases: { code: string; value: number | string; expected: string; source?: string }[] };
  assert.ok(cases.length > 300, `expected the full case list, got ${cases.length}`);
  const out = kernel.format(cases.map(c => ({ value: c.value, formatCode: c.code, dateSystem: 1900 })));
  const wrong = cases.flatMap((c, i) => out[i]!.text === c.expected ? [] : [`${JSON.stringify(c.code)} of ${JSON.stringify(c.value)}: got ${JSON.stringify(out[i]!.text)}, want ${JSON.stringify(c.expected)}`]);
  assert.deepEqual(wrong, []);
});

test('dates in both date systems, with ISO dates only for real calendar days', () => {
  assert.deepEqual(one(45000, 'yyyy-mm-dd'), { text: '2023-03-15', kind: 'date', iso: '2023-03-15' });
  assert.deepEqual(one(45000, 'yyyy-mm-dd', 1904), { text: '2027-03-16', kind: 'date', iso: '2027-03-16' });
  assert.equal(one(0, 'yyyy-mm-dd', 1904).iso, '1904-01-01');
  assert.equal(one(45000.75, 'm/d/yyyy h:mm').iso, '2023-03-15T18:00:00');
  assert.equal(one(45000.75, 'h:mm').iso, undefined);
  // 1900-02-29 never existed (Excel's leap-year bug) and serial 0 is not a day.
  assert.equal(one(60, 'yyyy-mm-dd').iso, undefined);
  assert.equal(one(0, 'yyyy-mm-dd').iso, undefined);
});

test('currency, percent, fractions, conditional and text sections', () => {
  const usd = '"$"#,##0.00_);\\("$"#,##0.00\\)';
  assert.equal(one(1234.5, usd).text, '$1,234.50 ');
  assert.equal(one(-1234.5, usd).text, '($1,234.50)');
  assert.equal(one(1234.5, usd).kind, 'currency');
  assert.deepEqual(one(0.256, '0%'), { text: '26%', kind: 'percentage' });
  assert.deepEqual(one(1.5, '# ?/?'), { text: '1 1/2', kind: 'fraction' });
  assert.equal(one(3.75, '# ??/??').text, '3  3/4 ');
  const cond = '[>100]"big";[<0]"neg";"small"';
  assert.deepEqual([150, -5, 5].map(n => one(n, cond).text), ['big', 'neg', 'small']);
  assert.equal(one('hello', '0;-0;;@" units"').text, 'hello units');
  assert.equal(one('hello', '0;-0;;@" units"').kind, 'text');
  assert.equal(one(0.000123, '0.00E+00').text, '1.23E-04');
});

test('the output depends only on the input and the supplied clock', () => {
  const cell = { value: 45000, formatCode: 'yyyy-mm-dd', dateSystem: 1900 as const };
  assert.deepEqual(kernel.format([cell, cell], 1_800_000_000_000), kernel.format([cell, cell]));
});

test('the module refuses malformed or oversized requests with a message', async () => {
  const bytes = readFileSync(new URL('../packages/node-shell/wasm/xlsx-numfmt/xlsx-numfmt.wasm', import.meta.url));
  const imports = WebAssembly.Module.imports(new WebAssembly.Module(bytes));
  assert.deepEqual(imports, [], 'the module imports nothing from the host');
  assert.throws(() => kernel.format([{ value: 1, formatCode: '0', dateSystem: 1999 as unknown as 1900 }]), /1900 or 1904/);
  assert.throws(() => kernel.format([{ value: Number.NaN, formatCode: '0', dateSystem: 1900 }]), /./);
  assert.throws(() => kernel.format([{ value: 'x'.repeat(40_000), formatCode: '@', dateSystem: 1900 }]), /too long/);
  assert.throws(() => kernel.format([{ value: 1, formatCode: '0'.repeat(2000), dateSystem: 1900 }]), /too long/);
  await assert.rejects(createXlsxNumfmtKernel(strToU8('not wasm')));
  // A format code over Excel's 255-character limit degrades to General, never a failure.
  assert.equal(one(1.5, '0'.repeat(300)).text, '1.5');
});

test('a large batch round-trips in order', () => {
  const cells: XlsxCellFormatRequest[] = Array.from({ length: 120_000 }, (_, i) => ({ value: i, formatCode: i % 2 ? '0.0' : '#,##0', dateSystem: 1900 }));
  const out = kernel.format(cells);
  assert.equal(out.length, cells.length);
  assert.equal(out[1]!.text, '1.0');
  assert.equal(out[119_999]!.text, '119999.0');
  assert.equal(out[100_000]!.text, '100,000');
});

// ─── building workbooks ──────────────────────────────────────────────────────

const WORKBOOK = (extra = '') => `<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${extra}<sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>`;
const RELS = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://.../worksheet" Target="worksheets/sheet1.xml"/></Relationships>';

/** One styles.xml: custom formats by id, then cellXfs as a list of numFmtIds (index = the cell's `s`). */
function styles(custom: Record<number, string>, xfs: number[]): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmts = Object.entries(custom).map(([id, code]) => `<numFmt numFmtId="${id}" formatCode="${esc(code)}"/>`).join('');
  return `<?xml version="1.0"?><styleSheet><numFmts count="${Object.keys(custom).length}">${fmts}</numFmts>`
    + '<cellStyleXfs count="1"><xf numFmtId="14" fontId="0"/></cellStyleXfs>'
    + `<cellXfs count="${xfs.length}">${xfs.map(id => `<xf numFmtId="${id}" fontId="0" applyNumberFormat="1"/>`).join('')}</cellXfs></styleSheet>`;
}
function book(rows: string, opts: { styles?: string; workbookPr?: string; shared?: string[] } = {}): Uint8Array {
  const files: Record<string, Uint8Array> = {
    'xl/workbook.xml': strToU8(WORKBOOK(opts.workbookPr)),
    'xl/_rels/workbook.xml.rels': strToU8(RELS),
    'xl/worksheets/sheet1.xml': strToU8(`<?xml version="1.0"?><worksheet><sheetData>${rows}</sheetData></worksheet>`),
  };
  if (opts.styles) files['xl/styles.xml'] = strToU8(opts.styles);
  if (opts.shared) files['xl/sharedStrings.xml'] = strToU8(`<sst>${opts.shared.map(s => `<si><t>${s}</t></si>`).join('')}</sst>`);
  return zipSync(files);
}
const cell = (ref: string, s: number, v: number | string) => `<c r="${ref}" s="${s}"><v>${v}</v></c>`;

// ─── the reader ──────────────────────────────────────────────────────────────

test('built-in ids 14 to 22 show as Excel shows them', () => {
  const ids = [14, 15, 16, 17, 18, 19, 20, 21, 22];
  const bytes = book(`<row r="1">${ids.map((_, i) => cell(`${String.fromCharCode(65 + i)}1`, i, 45000.75)).join('')}</row>`, { styles: styles({}, ids) });
  const { rows, dates } = readXlsx(bytes, { formatCell });
  assert.deepEqual(rows[0], ['3/15/2023', '15-Mar-23', '15-Mar', 'Mar-23', '6:00 PM', '6:00:00 PM', '18:00', '18:00:00', '3/15/2023 18:00']);
  assert.deepEqual(dates, [0, 1, 2, 3, 8].map(col => ({ row: 0, col, iso: col === 8 ? '2023-03-15T18:00:00' : '2023-03-15' })));
});

test('other built-in ids: numbers, percent, currency, text', () => {
  const ids = [1, 2, 3, 4, 7, 9, 10, 12, 37, 49];
  const values = [1234.5, 1234.5, 1234.5, 1234.5, -1234.5, 0.256, 0.12345, 1.5, -1234.5, 77];
  const bytes = book(`<row r="1">${ids.map((_, i) => cell(`${String.fromCharCode(65 + i)}1`, i, values[i]!)).join('')}</row>`, { styles: styles({}, ids) });
  assert.deepEqual(readXlsx(bytes, { formatCell }).rows[0], ['1235', '1234.50', '1,235', '1,234.50', '($1,234.50)', '26%', '12.35%', '1 1/2', '(1,235)', '77']);
});

test('custom formats, conditional sections and text sections apply to numbers and strings', () => {
  const st = styles({ 164: 'yyyy-mm-dd', 165: '[>100]"big";[<0]"neg";"small"', 166: '@" units"', 167: '0.0%;[Red]-0.0%' }, [164, 165, 166, 167, 0]);
  const bytes = book(
    '<row r="1">' + cell('A1', 0, 45000) + cell('B1', 1, 150) + cell('C1', 1, -5) + cell('D1', 1, 5)
      + '<c r="E1" s="2" t="s"><v>0</v></c>' + cell('F1', 3, -0.256) + cell('G1', 4, 0.1) + '</row>',
    { styles: st, shared: ['bolts'] },
  );
  const { rows, dates } = readXlsx(bytes, { formatCell });
  assert.deepEqual(rows[0], ['2023-03-15', 'big', 'neg', 'small', 'bolts units', '-25.6%', '0.1']);
  assert.deepEqual(dates, [{ row: 0, col: 0, iso: '2023-03-15' }]);
});

test('the 1904 date system comes from workbookPr', () => {
  const rows = '<row r="1">' + cell('A1', 0, 45000) + '</row>';
  const st = styles({}, [14]);
  assert.deepEqual(readXlsx(book(rows, { styles: st }), { formatCell }).rows, [['3/15/2023']]);
  const r = readXlsx(book(rows, { styles: st, workbookPr: '<workbookPr date1904="1"/>' }), { formatCell });
  assert.deepEqual(r.rows, [['3/16/2027']]);
  assert.deepEqual(r.dates, [{ row: 0, col: 0, iso: '2027-03-16' }]);
});

test('booleans, errors, formulas in formula mode and General cells keep their text', () => {
  const st = styles({}, [14, 0]);
  const bytes = book(
    '<row r="1"><c r="A1" s="0" t="b"><v>1</v></c><c r="B1" s="0" t="e"><v>#DIV/0!</v></c>'
      + '<c r="C1" s="0"><f>A2+1</f><v>45000</v></c><c r="D1" s="1"><v>45000</v></c></row>',
    { styles: st },
  );
  assert.deepEqual(readXlsx(bytes, { formatCell }).rows, [['TRUE', '#DIV/0!', '3/15/2023', '45000']]);
  assert.deepEqual(readXlsx(bytes, { formatCell, cells: 'formulas' }).rows, [['TRUE', '#DIV/0!', '=A2+1', '45000']]);
});

test('without a formatter the output is unchanged', () => {
  const st = styles({ 164: 'yyyy-mm-dd' }, [164, 14, 9]);
  const bytes = book('<row r="1">' + cell('A1', 0, 45000) + cell('B1', 1, 45000.5) + cell('C1', 2, 0.256) + '</row>', { styles: st });
  const plain = readXlsx(bytes);
  assert.deepEqual(plain.rows, [['45000', '45000.5', '0.256']]);
  assert.equal('dates' in plain, false);
  // Identical to a workbook with no styles part at all, and to the formatted read minus its display text.
  assert.deepEqual(plain, readXlsx(book('<row r="1">' + cell('A1', 0, 45000) + cell('B1', 1, 45000.5) + cell('C1', 2, 0.256) + '</row>')));
  assert.deepEqual(openXlsx(bytes).read({ limit: 10 }), readXlsx(bytes, { limit: 10 }));
  // A workbook with no styles part reads the same with a formatter.
  const bare = book('<row r="1">' + cell('A1', 0, 45000) + '</row>');
  assert.deepEqual(readXlsx(bare, { formatCell }).rows, readXlsx(bare).rows);
});

test('a failing or wrong-sized formatter keeps the unformatted text', () => {
  const bytes = book('<row r="1">' + cell('A1', 0, 45000) + '</row>', { styles: styles({}, [14]) });
  const throws: XlsxCellFormatter = () => { throw new Error('boom'); };
  const short: XlsxCellFormatter = () => [];
  const junk: XlsxCellFormatter = cells => cells.map(() => ({ text: 1 as unknown as string, kind: 'nope' as 'date' }));
  for (const bad of [throws, short, junk]) assert.deepEqual(readXlsx(bytes, { formatCell: bad }).rows, [['45000']]);
});

test('the formatter is called in bounded batches', () => {
  const n = XLSX_FORMAT_BATCH + 10;
  const body = Array.from({ length: n }, (_, i) => `<row r="${i + 1}">${cell(`A${i + 1}`, 0, i)}</row>`).join('');
  const sizes: number[] = [];
  const spy: XlsxCellFormatter = cells => { sizes.push(cells.length); return formatCell(cells); };
  const r = readXlsx(book(body, { styles: styles({}, [3]) }), { formatCell: spy, limit: n });
  assert.deepEqual(sizes, [XLSX_FORMAT_BATCH, 10]);
  assert.equal(r.rows[1000]![0], '1,000');
});

test('hostile styles parts are bounded', () => {
  // Thousands of formats and cell styles, repeated ids, a bad id, a 5 KB format code and unbalanced tags.
  const many = Array.from({ length: 6000 }, (_, i) => `<numFmt numFmtId="${200 + i}" formatCode="0.0"/>`).join('');
  const xfs = '<xf numFmtId="200"/><xf numFmtId="5000"/>' + Array.from({ length: 70_000 }, () => '<xf numFmtId="200"/>').join('');
  const hostile = `<styleSheet><numFmts>${many}<numFmt numFmtId="x" formatCode="0"/><numFmt numFmtId="9000" formatCode="${'0'.repeat(5000)}"/></numFmts><cellXfs>${xfs}<xf numFmtId="-4"/><xf</cellXfs>`;
  const rows = '<row r="1">' + cell('A1', 0, 1.25) + cell('B1', 69_999, 1.25) + cell('C1', 1, 1.25) + '<c r="D1" s="-1"><v>1.25</v></c><c r="E1" s="99999999999"><v>1.25</v></c></row>';
  const r = readXlsx(book(rows, { styles: hostile }), { formatCell });
  assert.equal(r.rows[0]!.length, 5);
  assert.equal(r.rows[0]![0], '1.3', 'a format inside the cap applies');
  assert.equal(r.rows[0]![1], '1.25', 'a style past the cellXfs cap reads as General');
  assert.equal(r.rows[0]![2], '1.25', 'a format id past the custom-format cap reads as General');
  // Not a zip, or an unreadable styles part, behaves as before.
  assert.throws(() => readXlsx(strToU8('plain text'), { formatCell }), /not a zip/);
  assert.deepEqual(readXlsx(book('<row r="1">' + cell('A1', 0, 2) + '</row>', { styles: '<<<not xml' }), { formatCell }).rows, [['2']]);
});
