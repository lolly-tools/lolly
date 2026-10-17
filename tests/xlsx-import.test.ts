// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the .xlsx → grid importer (engine/src/xlsx-import.ts).
 *
 * We build tiny real .xlsx archives with fflate's `zipSync` (workbook + rels +
 * one sheet + sharedStrings) and assert the parsed rows, then check the hostile
 * paths (non-zip, truncated zip, macro-enabled).
 *
 * Run with: node --test tests/xlsx-import.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';

import { readXlsx, listXlsxSheets, shiftFormula, DEFAULT_XLSX_ROW_LIMIT } from '../engine/src/xlsx-import.ts';

const WORKBOOK = `<?xml version="1.0"?>
<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

const WB_RELS = `<?xml version="1.0"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://.../worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

/** Assemble an .xlsx from a sheet body + shared strings. */
function buildXlsx(sheetXml: string, sharedXml?: string, extra: Record<string, Uint8Array> = {}): Uint8Array {
  const files: Record<string, Uint8Array> = {
    'xl/workbook.xml': strToU8(WORKBOOK),
    'xl/_rels/workbook.xml.rels': strToU8(WB_RELS),
    'xl/worksheets/sheet1.xml': strToU8(sheetXml),
    ...extra,
  };
  if (sharedXml) files['xl/sharedStrings.xml'] = strToU8(sharedXml);
  return zipSync(files);
}

const SHEET = (rows: string) =>
  `<?xml version="1.0"?><worksheet><sheetData>${rows}</sheetData></worksheet>`;

test('shared-string index and inline number both resolve', () => {
  const shared =
    '<?xml version="1.0"?><sst count="3" uniqueCount="3">' +
    '<si><t>Name</t></si><si><t>Score</t></si><si><t>Linux</t></si></sst>';
  const sheet = SHEET(
    '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>67</v></c></row>',
  );
  const { rows, truncated, sheetPath } = readXlsx(buildXlsx(sheet, shared));
  assert.equal(truncated, false);
  assert.equal(sheetPath, 'xl/worksheets/sheet1.xml');
  assert.deepEqual(rows, [
    ['Name', 'Score'],
    ['Linux', '67'],
  ]);
});

test('gaps between populated cells fill with empty strings', () => {
  // A1 and C1 populated, B1 missing → the gap is filled.
  const sheet = SHEET('<row r="1"><c r="A1"><v>1</v></c><c r="C1"><v>3</v></c></row>');
  const { rows } = readXlsx(buildXlsx(sheet));
  assert.deepEqual(rows, [['1', '', '3']]);
});

test('inlineStr, boolean and formula-cache cells decode', () => {
  const sheet = SHEET(
    '<row r="1">' +
      '<c r="A1" t="inlineStr"><is><t>Inline</t></is></c>' +
      '<c r="B1" t="b"><v>1</v></c>' +
      '<c r="C1" t="str"><f>A1</f><v>Sum &amp; more</v></c>' +
      '</row>',
  );
  const { rows } = readXlsx(buildXlsx(sheet));
  assert.deepEqual(rows, [['Inline', 'TRUE', 'Sum & more']]);
});

test('rich-text shared string concatenates its runs, entities decode', () => {
  const shared =
    '<?xml version="1.0"?><sst>' +
    '<si><r><t>Hello </t></r><r><t>&lt;World&gt;</t></r></si></sst>';
  const sheet = SHEET('<row r="1"><c r="A1" t="s"><v>0</v></c></row>');
  const { rows } = readXlsx(buildXlsx(sheet, shared));
  assert.deepEqual(rows, [['Hello <World>']]);
});

test('ref-less cells advance a left→right cursor within a row', () => {
  const sheet = SHEET('<row r="1"><c><v>a</v></c><c><v>b</v></c></row>');
  const { rows } = readXlsx(buildXlsx(sheet));
  assert.deepEqual(rows, [['a', 'b']]);
});

test('rows past the limit are dropped and flag truncation', () => {
  let body = '';
  for (let r = 1; r <= 5; r++) body += `<row r="${r}"><c r="A${r}"><v>${r}</v></c></row>`;
  const { rows, truncated } = readXlsx(buildXlsx(SHEET(body)), { limit: 3 });
  assert.equal(truncated, true);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[2], ['3']);
});

test('default row limit is 1000', () => {
  assert.equal(DEFAULT_XLSX_ROW_LIMIT, 1000);
});

test('resolves the first sheet via workbook order, not just sheet1', () => {
  // workbook points rId1 at sheet2.xml; sheet1.xml is a decoy.
  const wb = `<workbook xmlns:r="http://x"><sheets><sheet name="Real" r:id="rId1"/></sheets></workbook>`;
  const rels = `<Relationships><Relationship Id="rId1" Target="worksheets/sheet2.xml"/></Relationships>`;
  const files: Record<string, Uint8Array> = {
    'xl/workbook.xml': strToU8(wb),
    'xl/_rels/workbook.xml.rels': strToU8(rels),
    'xl/worksheets/sheet1.xml': strToU8(SHEET('<row r="1"><c r="A1"><v>decoy</v></c></row>')),
    'xl/worksheets/sheet2.xml': strToU8(SHEET('<row r="1"><c r="A1"><v>real</v></c></row>')),
  };
  const { rows, sheetPath } = readXlsx(zipSync(files));
  assert.equal(sheetPath, 'xl/worksheets/sheet2.xml');
  assert.deepEqual(rows, [['real']]);
});

// ── multi-sheet: listXlsxSheets + the readXlsx sheet selector (plan 87 Phase 2) ──

/** A 3-sheet workbook in tab order Summary, Q1, Q2 (rId order intentionally not
 *  matching tab order, to prove listing follows the <sheets> document order). */
function threeSheetBook(): Uint8Array {
  const wb = `<workbook xmlns:r="http://x"><sheets>`
    + `<sheet name="Summary" sheetId="1" r:id="rId3"/>`
    + `<sheet name="Q1" sheetId="2" r:id="rId1"/>`
    + `<sheet name="Q2" sheetId="3" r:id="rId2"/>`
    + `</sheets></workbook>`;
  const rels = `<Relationships>`
    + `<Relationship Id="rId1" Target="worksheets/sheetA.xml"/>`
    + `<Relationship Id="rId2" Target="worksheets/sheetB.xml"/>`
    + `<Relationship Id="rId3" Target="worksheets/sheetC.xml"/>`
    + `</Relationships>`;
  return zipSync({
    'xl/workbook.xml': strToU8(wb),
    'xl/_rels/workbook.xml.rels': strToU8(rels),
    'xl/worksheets/sheetC.xml': strToU8(SHEET('<row r="1"><c r="A1"><v>summary</v></c></row>')),
    'xl/worksheets/sheetA.xml': strToU8(SHEET('<row r="1"><c r="A1"><v>q1</v></c></row>')),
    'xl/worksheets/sheetB.xml': strToU8(SHEET('<row r="1"><c r="A1"><v>q2</v></c></row>')),
  });
}

test('listXlsxSheets returns names + indices in workbook (tab) order', () => {
  assert.deepEqual(listXlsxSheets(threeSheetBook()), [
    { name: 'Summary', index: 0 },
    { name: 'Q1', index: 1 },
    { name: 'Q2', index: 2 },
  ]);
});

test('readXlsx defaults to the first sheet (unchanged) and reports its name', () => {
  const { rows, sheetName } = readXlsx(threeSheetBook());
  assert.deepEqual(rows, [['summary']]);
  assert.equal(sheetName, 'Summary');
});

test('readXlsx selects a sheet by index', () => {
  assert.deepEqual(readXlsx(threeSheetBook(), { sheet: 1 }).rows, [['q1']]);
  assert.deepEqual(readXlsx(threeSheetBook(), { sheet: 2 }).rows, [['q2']]);
});

test('readXlsx selects a sheet by exact name', () => {
  const { rows, sheetName } = readXlsx(threeSheetBook(), { sheet: 'Q2' });
  assert.deepEqual(rows, [['q2']]);
  assert.equal(sheetName, 'Q2');
});

test('readXlsx throws a clear error for a missing sheet index or name', () => {
  assert.throws(() => readXlsx(threeSheetBook(), { sheet: 9 }), /no sheet at index 9/i);
  assert.throws(() => readXlsx(threeSheetBook(), { sheet: 'Nope' }), /named .Nope./i);
});

test('listXlsxSheets refuses a macro-enabled workbook', () => {
  const book = zipSync({
    'xl/workbook.xml': strToU8(`<workbook xmlns:r="http://x"><sheets><sheet name="S" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`),
    'xl/worksheets/sheet1.xml': strToU8(SHEET('<row r="1"><c r="A1"><v>x</v></c></row>')),
    'xl/vbaProject.bin': new Uint8Array([1, 2, 3]),
  });
  assert.throws(() => listXlsxSheets(book), /macro-enabled/i);
});

test('non-zip bytes are refused cleanly', () => {
  assert.throws(() => readXlsx(strToU8('not a zip at all')), /not a zip/i);
});

test('empty input is refused', () => {
  assert.throws(() => readXlsx(new Uint8Array(0)), /empty/i);
});

test('a truncated zip throws', () => {
  const good = buildXlsx(SHEET('<row r="1"><c r="A1"><v>1</v></c></row>'));
  const cut = good.slice(0, Math.floor(good.length / 2)); // chop the archive in half
  assert.throws(() => readXlsx(cut), /corrupt|truncat/i);
});

test('a macro-enabled workbook is refused', () => {
  const withVba = buildXlsx(SHEET('<row r="1"><c r="A1"><v>1</v></c></row>'), undefined, {
    'xl/vbaProject.bin': new Uint8Array([1, 2, 3, 4]),
  });
  assert.throws(() => readXlsx(withVba), /macro/i);
});

test('a sheet with no cells throws', () => {
  assert.throws(() => readXlsx(buildXlsx(SHEET(''))), /no cells|no readable/i);
});

// ─── formula text versus saved results ───────────────────────────────────────

const FORMULA_SHEET = SHEET(
  '<row r="1"><c r="A1"><v>2</v></c><c r="B1"><f>A1*2</f><v>4</v></c><c r="C1" t="str"><f>IF(A1&gt;1,"big","small")</f><v>big</v></c></row>' +
    '<row r="2"><c r="A2"><v>3</v></c><c r="B2"><f t="shared" ref="B2:B4" si="0">A2*$A$1</f><v>6</v></c></row>' +
    '<row r="3"><c r="A3"><v>4</v></c><c r="B3"><f t="shared" si="0"/><v>8</v></c></row>' +
    '<row r="4"><c r="A4"><v>5</v></c><c r="B4"><f t="shared" si="0"/><v>10</v></c></row>',
);

test('formula cells give their saved results by default and are counted', () => {
  const result = readXlsx(buildXlsx(FORMULA_SHEET));
  assert.deepEqual(result.rows, [['2', '4', 'big'], ['3', '6', ''], ['4', '8', ''], ['5', '10', '']]);
  assert.equal(result.formulaCells, 5);
  assert.equal(result.formulaResultsKept, undefined);
});

test('formula mode returns formula text and rewrites shared formulas for each cell', () => {
  const result = readXlsx(buildXlsx(FORMULA_SHEET), { cells: 'formulas' });
  assert.deepEqual(result.rows, [
    ['2', '=A1*2', '=IF(A1>1,"big","small")'],
    ['3', '=A2*$A$1', ''],
    ['4', '=A3*$A$1', ''],
    ['5', '=A4*$A$1', ''],
  ]);
  assert.equal(result.formulaCells, 5);
  assert.equal(result.formulaResultsKept, 0);
});

test('a shared formula cell without its first cell keeps the saved result and is counted', () => {
  const sheet = SHEET('<row r="1"><c r="A1"><v>1</v></c><c r="B1"><f t="shared" si="7"/><v>99</v></c></row>');
  const result = readXlsx(buildXlsx(sheet), { cells: 'formulas' });
  assert.deepEqual(result.rows, [['1', '99']]);
  assert.equal(result.formulaResultsKept, 1);
});

test('shiftFormula moves relative references and leaves absolute parts, strings and names alone', () => {
  assert.equal(shiftFormula('A1+$B$2+C$3+$D4', 2, 1), 'B3+$B$2+D$3+$D6');
  assert.equal(shiftFormula('SUM(A1:A3)*LOG10(B1)', 1, 0), 'SUM(A2:A4)*LOG10(B2)');
  assert.equal(shiftFormula('Sheet2!A1+\'My Sheet\'!B2', 1, 1), 'Sheet2!B2+\'My Sheet\'!C3');
  assert.equal(shiftFormula('"A1"&A1', 1, 0), '"A1"&A2');
  assert.equal(shiftFormula('Table1[Amount]*A1', 1, 0), 'Table1[Amount]*A2');
  assert.equal(shiftFormula('_xlfn.XLOOKUP(A1,B1:B9,C1:C9)', 1, 0), '_xlfn.XLOOKUP(A2,B2:B10,C2:C10)');
  assert.equal(shiftFormula('A1*1.5E3', 1, 0), 'A2*1.5E3');
  assert.equal(shiftFormula('Z1', 0, 1), 'AA1');
});

test('shiftFormula refuses moves it cannot make exactly', () => {
  assert.equal(shiftFormula('A1', -1, 0), null, 'off the top of the sheet');
  assert.equal(shiftFormula('SUM(A:A)', 1, 0), null, 'whole-column range');
  assert.equal(shiftFormula('SUM(2:5)', 0, 1), null, 'whole-row range');
  assert.equal(shiftFormula('"open', 1, 0), null, 'unterminated string');
  assert.equal(shiftFormula('A1', 0, 0), 'A1', 'no move needed');
});

test('shiftFormula always terminates with a string or null on arbitrary input', () => {
  let seed = 7;
  const next = (): number => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed; };
  const alphabet = ['A', 'Z', 'x', '$', '1', '9', '0', ':', '!', '"', "'", '[', ']', '(', ')', ',', '.', 'E', '+', '#', 'é', '\u{1F600}', ' ', '_'];
  for (let i = 0; i < 2000; i++) {
    let formula = '';
    for (let n = next() % 24; n > 0; n--) formula += alphabet[next() % alphabet.length];
    const out = shiftFormula(formula, (next() % 5) - 2, (next() % 5) - 2);
    assert.ok(out === null || typeof out === 'string', formula);
  }
});
