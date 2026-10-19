// SPDX-License-Identifier: MPL-2.0
/**
 * The convert workbench's reading choices: which controls each data kind gets,
 * the workbook's sheet names filling the worksheet list, and the options record
 * the choices produce for the saved file operation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { zipSync, strToU8 } from 'fflate';
import { dataOptionsHtml, wireDataOptions } from './convert-data-options.ts';

const dom = new JSDOM('<!doctype html><body></body>');
(globalThis as { Option?: unknown }).Option = dom.window.Option;

function mount(kind: string): HTMLElement {
  const root = dom.window.document.createElement('div');
  root.innerHTML = dataOptionsHtml(kind);
  return root as unknown as HTMLElement;
}

function book(names: string[]): File {
  const files: Record<string, Uint8Array> = {
    'xl/workbook.xml': strToU8(`<workbook xmlns:r="r"><sheets>${names.map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<Relationships>${names.map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`),
  };
  names.forEach((_, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8('<worksheet><sheetData><row r="1"><c r="A1"><v>1</v></c></row></sheetData></worksheet>'); });
  return new File([zipSync(files) as BlobPart], 'book.xlsx');
}

test('each data kind gets only the choices that apply to it', () => {
  const has = (root: HTMLElement, name: string): boolean => Boolean(root.querySelector(`[data-${name}]`));
  const xlsx = mount('xlsx');
  assert.deepEqual(['sheet', 'cells', 'delimiter', 'encoding', 'header'].map(n => has(xlsx, n)), [true, true, false, false, true]);
  const csv = mount('csv');
  assert.deepEqual(['sheet', 'cells', 'delimiter', 'encoding', 'header'].map(n => has(csv, n)), [false, false, true, true, true]);
  const json = mount('json');
  assert.deepEqual(['sheet', 'cells', 'delimiter', 'encoding', 'header'].map(n => has(json, n)), [false, false, false, true, true]);
});

test('a CSV source reads its delimiter, encoding and heading choices', () => {
  const root = mount('csv');
  const handle = wireDataOptions(root, { file: new File(['a'], 'a.csv'), kind: 'csv' }, () => {});
  assert.deepEqual(handle.read(), { delimiter: 'auto', encoding: 'auto', header: 'first-row' });
  root.querySelector<HTMLSelectElement>('[data-delimiter]')!.value = 'semicolon';
  root.querySelector<HTMLSelectElement>('[data-encoding]')!.value = 'windows-1252';
  root.querySelector<HTMLSelectElement>('[data-header]')!.value = 'generate';
  assert.deepEqual(handle.read(), { delimiter: 'semicolon', encoding: 'windows-1252', header: 'generate' });
  assert.equal(handle.zip(), false);
});

test('a workbook lists its sheets, adds All worksheets, and reports the chosen one', async () => {
  const root = mount('xlsx');
  let changed = 0;
  let listed!: () => void;
  const ready = new Promise<void>(resolve => { listed = resolve; });
  const handle = wireDataOptions(root, { file: book(['Budget', 'Notes']), kind: 'xlsx' }, () => { changed++; listed(); });
  assert.deepEqual(handle.read(), { cells: 'cached', header: 'first-row' }, 'the first worksheet is the default and adds no sheet key');
  await ready;
  const sheet = root.querySelector<HTMLSelectElement>('[data-sheet]')!;
  assert.deepEqual([...sheet.options].map(o => [o.value, o.textContent]), [['0', 'Budget'], ['1', 'Notes'], ['all', 'All worksheets']]);
  assert.equal(changed, 1);
  sheet.value = '1';
  assert.deepEqual(handle.read(), { sheet: 1, cells: 'cached', header: 'first-row' });
  sheet.value = 'all';
  root.querySelector<HTMLSelectElement>('[data-cells]')!.value = 'formulas';
  assert.deepEqual(handle.read(), { allSheets: true, cells: 'formulas', header: 'first-row' });
  assert.equal(handle.zip(), true);
});

test('a one-sheet workbook offers no All worksheets choice', async () => {
  const root = mount('xlsx');
  let listed!: () => void;
  const ready = new Promise<void>(resolve => { listed = resolve; });
  wireDataOptions(root, { file: book(['Only']), kind: 'xlsx' }, () => listed());
  await ready;
  assert.deepEqual([...root.querySelector<HTMLSelectElement>('[data-sheet]')!.options].map(o => o.value), ['0']);
});
