// SPDX-License-Identifier: MPL-2.0
/**
 * Data conversion choices through both file operation adapters: the web adapter
 * the convert workbench runs and the Node adapter behind the CLI and MCP. Each
 * request carries its choices in the options record, the output follows them,
 * and the report's findings describe the copy that was made.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import { writeXlsx } from '../engine/src/xlsx-write.ts';
import { conversionFindings } from '../packages/core/src/image-operation-v1.ts';
import { assertFileOperationReport } from '../packages/core/src/file-operation-v1.ts';
import { runNodeFileOperation } from '../packages/node-shell/src/file-operations.ts';

const codes = (findings: { code: string }[]): string[] => findings.map((f) => f.code);

test('the loss report follows the worksheet, formula and reading choices', () => {
  const first = conversionFindings('xlsx', 'csv');
  assert.deepEqual(codes(first), ['values-only', 'number-formats', 'worksheets']);
  assert.match(first[0]!.message, /results last saved/);
  assert.match(first[1]!.message, /serial number/);
  assert.match(first[2]!.message, /first worksheet/);
  const formulas = conversionFindings('xlsx', 'csv', { cells: 'formulas', allSheets: true });
  assert.match(formulas[0]!.message, /formula text/);
  assert.match(formulas[2]!.message, /manifest\.json/);
  assert.match(conversionFindings('xlsx', 'csv', { sheet: 2 })[2]!.message, /chosen worksheet/);
  const csv = conversionFindings('csv', 'json', { encoding: 'windows-1252', delimiter: 'semicolon', header: 'none' });
  assert.deepEqual(codes(csv), ['values-only', 'text-encoding', 'delimiter', 'json-headers']);
  assert.match(csv[1]!.message, /chosen encoding/);
  assert.match(csv[3]!.message, /array of values/);
  assert.deepEqual(codes(conversionFindings('json', 'tsv', { header: 'generate' })), ['values-only', 'text-encoding', 'generated-headings', 'tsv-whitespace']);
});

test('the web adapter converts a semicolon CSV with a chosen encoding and reports the choices', async () => {
  const { runWebFileOperation } = await import('../shells/web/src/lib/file-operation-adapter.ts');
  const bytes = new Uint8Array([...new TextEncoder().encode('Name;City\nZo;Malm'), 0xf6]);
  const result = await runWebFileOperation(new File([bytes], 'towns.csv', { type: 'text/csv' }), { version: 1, operation: 'convert', target: 'json', options: { delimiter: 'semicolon', encoding: 'windows-1252', header: 'first-row' } });
  assertFileOperationReport(result.report);
  assert.equal(result.report.state, 'succeeded');
  assert.deepEqual(JSON.parse(await result.output!.text()), [{ Name: 'Zo', City: 'Malmö' }]);
  assert.equal(result.report.options.delimiter, 'semicolon');
  assert.ok(result.report.findings.some((f) => f.code === 'delimiter' && /chosen delimiter/.test(f.message)));
  const refused = await runWebFileOperation(new File([bytes], 'towns.csv', { type: 'text/csv' }), { version: 1, operation: 'convert', target: 'json', options: { encoding: 'utf-8' } });
  assert.equal(refused.report.state, 'failed');
  assert.match(refused.report.findings.at(-1)!.message, /not valid utf-8/);
});

test('the web adapter writes every worksheet into a ZIP named for the source', async () => {
  const { runWebFileOperation } = await import('../shells/web/src/lib/file-operation-adapter.ts');
  const { storeZip } = await import('../engine/src/zip.ts');
  // Two sheets: a one-sheet workbook's parts plus an added second sheet.
  const one = unzipSync(writeXlsx({ name: 'First', rows: [['a'], ['1']] }));
  const second = new TextDecoder().decode(one['xl/worksheets/sheet1.xml']).replace(/<row[\s\S]*<\/row>/, '<row r="1"><c r="A1" t="inlineStr"><is><t>b</t></is></c></row><row r="2"><c r="A2"><v>2</v></c></row>');
  const parts = { ...one };
  parts['xl/worksheets/sheet2.xml'] = new TextEncoder().encode(second);
  parts['xl/workbook.xml'] = new TextEncoder().encode(new TextDecoder().decode(one['xl/workbook.xml']).replace('</sheets>', '<sheet name="Second" sheetId="2" r:id="rId9"/></sheets>'));
  parts['xl/_rels/workbook.xml.rels'] = new TextEncoder().encode(new TextDecoder().decode(one['xl/_rels/workbook.xml.rels']).replace('</Relationships>', '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>'));
  const book = storeZip(Object.entries(parts).map(([name, bytes]) => ({ name, bytes })));
  const result = await runWebFileOperation(new File([book as BlobPart], 'two.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), { version: 1, operation: 'convert', target: 'csv', options: { allSheets: true } }, undefined, 'two.csv');
  assertFileOperationReport(result.report);
  assert.equal(result.report.state, 'succeeded');
  assert.equal(result.output!.name, 'two.zip');
  assert.equal(result.output!.type, 'application/zip');
  const files = unzipSync(new Uint8Array(await result.output!.arrayBuffer()));
  assert.deepEqual(Object.keys(files), ['manifest.json', '01-First.csv', '02-Second.csv']);
  assert.equal(new TextDecoder().decode(files['02-Second.csv']), 'b\n2');
  assert.ok(result.report.findings.some((f) => f.code === 'worksheets' && /manifest\.json/.test(f.message)));
});

test('the Node adapter takes the same choices and names an all-worksheets output .zip', async () => {
  const book = writeXlsx({ name: 'Only', rows: [['x', 'y'], ['1', '2']] });
  const result = await runNodeFileOperation(new File([book as BlobPart], 'book.xlsx'), { version: 1, operation: 'convert', target: 'json', options: { allSheets: true, header: 'none' } });
  assertFileOperationReport(result.report);
  assert.equal(result.report.state, 'succeeded');
  assert.equal(result.output!.name, 'book.zip');
  const files = unzipSync(new Uint8Array(await result.output!.arrayBuffer()));
  assert.deepEqual(JSON.parse(new TextDecoder().decode(files['01-Only.json'])), [['x', 'y'], ['1', '2']]);
  // The workbook sniffs as a zip; the report still carries the spreadsheet findings.
  assert.deepEqual(codes(result.report.findings), ['values-only', 'number-formats', 'worksheets', 'json-headers']);
  const bad = await runNodeFileOperation(new File(['a\n1'], 'a.csv'), { version: 1, operation: 'convert', target: 'json', options: { delimiter: 'colon' } });
  assert.equal(bad.report.state, 'failed');
  assert.match(bad.report.findings.at(-1)!.message, /Unknown delimiter choice/);
});
