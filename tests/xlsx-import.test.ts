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

import { readXlsx, DEFAULT_XLSX_ROW_LIMIT } from '../engine/src/xlsx-import.ts';

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
