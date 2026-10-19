// SPDX-License-Identifier: MPL-2.0
/**
 * Pins the values-only table conversion shared by the browser and Node file
 * operations: sourceToGrid's per-kind parsing (xlsx/json/csv-tsv, including its
 * JSON error messages and array-of-objects header derivation) and
 * gridToTarget's re-encoding, and that the two round-trip through each other.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceToGrid, gridToTarget } from '../engine/src/file-data.ts';
import { writeXlsx } from '../engine/src/xlsx-write.ts';

const utf8 = (s: string) => new TextEncoder().encode(s);

test('sourceToGrid parses csv into a header + body grid', () => {
  const grid = sourceToGrid('csv', utf8('name,age\nAda,36\nGrace,85'));
  assert.deepEqual(grid, [['name', 'age'], ['Ada', '36'], ['Grace', '85']]);
});

test('sourceToGrid parses a JSON array of objects, unioning keys in first-seen order', () => {
  const grid = sourceToGrid('json', utf8('[{"a":1,"b":2},{"b":3,"c":4}]'));
  assert.deepEqual(grid, [['a', 'b', 'c'], ['1', '2', ''], ['', '3', '4']]);
});

test('sourceToGrid parses a JSON array of arrays as rows verbatim', () => {
  const grid = sourceToGrid('json', utf8('[["a","b"],[1,2]]'));
  assert.deepEqual(grid, [['a', 'b'], ['1', '2']]);
});

test('sourceToGrid rejects malformed or empty JSON with a message, not a raw parse error', () => {
  assert.throws(() => sourceToGrid('json', utf8('not json')), /could not be parsed/);
  assert.throws(() => sourceToGrid('json', utf8('[]')), /non-empty JSON array/);
});

test('sourceToGrid rejects text that does not parse as CSV/TSV', () => {
  assert.throws(() => sourceToGrid('csv', utf8('')), /does not parse as CSV\/TSV/);
});

test('sourceToGrid reads an xlsx sheet written by writeXlsx', () => {
  const bytes = writeXlsx({ rows: [['x', 'y'], ['1', '2']] });
  const grid = sourceToGrid('xlsx', bytes);
  assert.deepEqual(grid, [['x', 'y'], ['1', '2']]);
});

test('gridToTarget csv/tsv/json encode the same grid consistently', () => {
  const grid = [['name', 'age'], ['Ada', '36']];
  assert.equal(gridToTarget(grid, 'csv'), 'name,age\nAda,36');
  assert.equal(gridToTarget(grid, 'tsv'), 'name\tage\nAda\t36');
  assert.equal(gridToTarget(grid, 'json'), JSON.stringify([{ name: 'Ada', age: '36' }], null, 2));
});

test('gridToTarget tsv strips tabs/CR/LF out of cell values so the grid stays one row per line', () => {
  const out = gridToTarget([['a\tb', 'c\r\nd']], 'tsv');
  assert.equal(out, 'a b\tc  d');
});

test('gridToTarget json refuses duplicate or blank headings, and refuses rows wider than the header', () => {
  assert.throws(() => gridToTarget([['a', 'a'], ['1', '2']], 'json'), /unique, non-empty column headings/);
  assert.throws(() => gridToTarget([[''], ['1']], 'json'), /unique, non-empty column headings/);
  assert.throws(() => gridToTarget([['a'], ['1', '2']], 'json'), /more cells than column headings/);
});

test('gridToTarget rejects an unsupported target id', () => {
  assert.throws(() => gridToTarget([['a']], 'pdf'), /not supported/);
});

test('a csv round-trip through sourceToGrid and gridToTarget is lossless for plain cells', () => {
  const original = 'name,age\nAda,36\nGrace,85';
  const grid = sourceToGrid('csv', utf8(original));
  assert.equal((gridToTarget(grid, 'csv') as string).replace(/\r\n/g, '\n'), original);
});

// ─── reading and writing choices ─────────────────────────────────────────────

import { zipSync, strToU8, unzipSync } from 'fflate';
import { readDataGrid, readDataOptions, convertDataFile, type DataSheetsManifestV1 } from '../engine/src/file-data.ts';

/** A workbook whose sheets are given as sheetData row XML, in tab order. */
function workbook(sheets: { name: string; rows: string }[]): Uint8Array {
  const files: Record<string, Uint8Array> = {
    'xl/workbook.xml': strToU8(`<workbook xmlns:r="r"><sheets>${sheets.map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<Relationships>${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`),
  };
  sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(`<worksheet><sheetData>${s.rows}</sheetData></worksheet>`); });
  return zipSync(files);
}
const cell = (ref: string, v: string, f?: string) => `<c r="${ref}"${/^\d+$/.test(v) ? '' : ' t="inlineStr"'}>${f ? `<f>${f}</f>` : ''}${/^\d+$/.test(v) ? `<v>${v}</v>` : `<is><t>${v}</t></is>`}</c>`;
const BOOK = workbook([
  { name: 'Budget', rows: `<row r="1">${cell('A1', 'Item')}${cell('B1', 'Cost')}</row><row r="2">${cell('A2', 'Rent')}${cell('B2', '1200')}</row><row r="3">${cell('A3', 'Total')}${cell('B3', '1200', 'SUM(B2:B2)')}</row>` },
  { name: 'Chart', rows: '' },
  { name: 'Q1/Q2: notes', rows: `<row r="1">${cell('A1', 'Note')}</row><row r="2">${cell('A2', 'Fine')}</row>` },
]);

test('readDataOptions keeps data choices, ignores image keys and refuses unknown values', () => {
  assert.deepEqual(readDataOptions({ maxEdge: 0, quality: 0.92, cells: 'formulas', delimiter: 'semicolon', encoding: 'windows-1252', header: 'none', sheet: 2 }),
    { cells: 'formulas', delimiter: 'semicolon', encoding: 'windows-1252', header: 'none', sheet: 2 });
  assert.deepEqual(readDataOptions({ allSheets: true }), { allSheets: true });
  assert.deepEqual(readDataOptions({ allSheets: false }), {});
  assert.throws(() => readDataOptions({ delimiter: 'colon' }), /Unknown delimiter choice/);
  assert.throws(() => readDataOptions({ encoding: 'ebcdic' }), /Unknown encoding choice/);
  assert.throws(() => readDataOptions({ sheet: -1 }), /worksheet by its position/);
  assert.throws(() => readDataOptions({ sheet: 1, allSheets: true }), /not both/);
});

test('an explicit delimiter splits semicolon and pipe files, and auto recognises even semicolons', () => {
  assert.deepEqual(sourceToGrid('csv', utf8('a;b\n1;"x;y"'), { delimiter: 'semicolon' }), [['a', 'b'], ['1', 'x;y']]);
  assert.deepEqual(sourceToGrid('csv', utf8('a|b\n1|2'), { delimiter: 'pipe' }), [['a', 'b'], ['1', '2']]);
  const auto = readDataGrid('csv', utf8('Name;Amount\nAda;1,5\nGrace;2,25'));
  assert.deepEqual(auto.grid, [['Name', 'Amount'], ['Ada', '1,5'], ['Grace', '2,25']]);
  assert.equal(auto.facts.delimiter, 'semicolon');
  // A single column that only sometimes holds a semicolon stays one column.
  assert.deepEqual(sourceToGrid('csv', utf8('note\nfirst; second\nthird')), [['note'], ['first; second'], ['third']]);
});

test('a quoted CSV value keeps its line break, and a stray quote cannot swallow the file', () => {
  assert.deepEqual(sourceToGrid('csv', utf8('a,b\n"two\nlines",2\n3,4')), [['a', 'b'], ['two\nlines', '2'], ['3', '4']]);
  assert.deepEqual(sourceToGrid('csv', utf8('a,b\n"open,2\n3,4')), [['a', 'b'], ['open,2', ''], ['3', '4']]);
});

test('an explicit tab delimiter keeps quotes as text, as TSV has no quoting', () => {
  assert.deepEqual(sourceToGrid('tsv', utf8('a\tb\n"x"\t2'), { delimiter: 'tab' }), [['a', 'b'], ['"x"', '2']]);
});

test('automatic encoding honours UTF-16 byte order marks and reads invalid UTF-8 as Windows-1252', () => {
  const utf16 = new Uint8Array([0xff, 0xfe, ...[...'a,b\n1,é'].flatMap((c) => [c.charCodeAt(0), 0])]);
  const read = readDataGrid('csv', utf16);
  assert.deepEqual(read.grid, [['a', 'b'], ['1', 'é']]);
  assert.equal(read.facts.encoding, 'utf-16le');
  const latin = new Uint8Array([...utf8('name\nCaf'), 0xe9]);
  const legacy = readDataGrid('csv', latin);
  assert.deepEqual(legacy.grid, [['name'], ['Café']]);
  assert.equal(legacy.facts.encoding, 'windows-1252');
});

test('a chosen encoding decodes strictly and refuses bytes that do not fit', () => {
  assert.deepEqual(sourceToGrid('csv', new Uint8Array([0x61, 0x0a, 0x80]), { encoding: 'windows-1252' }), [['a'], ['€']]);
  assert.throws(() => sourceToGrid('csv', new Uint8Array([0x61, 0x0a, 0xe9]), { encoding: 'utf-8' }), /not valid utf-8 text/);
  // Shift_JIS for "日本" (0x93fa 0x967b).
  assert.deepEqual(sourceToGrid('csv', new Uint8Array([0x6b, 0x0a, 0x93, 0xfa, 0x96, 0x7b]), { encoding: 'shift_jis' }), [['k'], ['日本']]);
});

test('heading choices: no heading row writes JSON arrays, added headings name every column', () => {
  const grid = [['Ada', '36'], ['Grace', '85']];
  assert.deepEqual(JSON.parse(gridToTarget(grid, 'json', { header: 'none' }) as string), grid);
  assert.deepEqual(JSON.parse(gridToTarget(grid, 'json', { header: 'generate' }) as string), [{ 'Column 1': 'Ada', 'Column 2': '36' }, { 'Column 1': 'Grace', 'Column 2': '85' }]);
  assert.equal(gridToTarget(grid, 'csv', { header: 'generate' }), 'Column 1,Column 2\nAda,36\nGrace,85');
  assert.equal(gridToTarget(grid, 'csv', { header: 'none' }), 'Ada,36\nGrace,85');
});

test('an Excel conversion reads past 1,000 rows instead of cutting the sheet short', () => {
  const rows = Array.from({ length: 1500 }, (_, i) => [`r${i}`]);
  assert.equal(sourceToGrid('xlsx', writeXlsx({ rows })).length, 1500);
});

test('a worksheet is chosen by position or name, with formula text on request', () => {
  assert.deepEqual(sourceToGrid('xlsx', BOOK, { sheet: 2 }), [['Note'], ['Fine']]);
  assert.deepEqual(sourceToGrid('xlsx', BOOK, { sheet: 'Q1/Q2: notes' }), [['Note'], ['Fine']]);
  const formulas = readDataGrid('xlsx', BOOK, { cells: 'formulas' });
  assert.deepEqual(formulas.grid.at(-1), ['Total', '=SUM(B2:B2)']);
  assert.deepEqual(formulas.facts, { sheet: 'Budget', formulaCells: 1, formulaResultsKept: 0 });
});

test('all worksheets become one file each in a ZIP with a manifest naming skipped sheets', async () => {
  const result = await convertDataFile('xlsx', BOOK, 'csv', { allSheets: true, cells: 'formulas' }, 'book.xlsx');
  assert.equal(result.zip, true);
  const files = unzipSync(result.bytes as Uint8Array);
  assert.deepEqual(Object.keys(files), ['manifest.json', '01-Budget.csv', '03-Q1_Q2_ notes.csv']);
  assert.equal(new TextDecoder().decode(files['01-Budget.csv']), 'Item,Cost\nRent,1200\nTotal,=SUM(B2:B2)');
  const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json'])) as DataSheetsManifestV1;
  assert.deepEqual(manifest, result.manifest);
  assert.deepEqual(manifest.source, { name: 'book.xlsx', format: 'xlsx', worksheets: 3 });
  assert.deepEqual(manifest.options, { cells: 'formulas', header: 'first-row' });
  assert.deepEqual(manifest.files.map((f) => [f.sheet, f.file, f.rows, f.columns, f.formulaCells]), [['Budget', '01-Budget.csv', 2, 2, 1], ['Q1/Q2: notes', '03-Q1_Q2_ notes.csv', 1, 1, 0]]);
  assert.match(manifest.files[0]!.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(manifest.skipped, [{ sheet: 'Chart', index: 1, reason: 'No cells (an empty sheet or a chart sheet).' }]);
});

test('an all-worksheets conversion fails whole, naming the sheet, and needs a workbook', async () => {
  const dup = workbook([{ name: 'Good', rows: `<row r="1">${cell('A1', 'a')}</row><row r="2">${cell('A2', 'b')}</row>` }, { name: 'Twins', rows: `<row r="1">${cell('A1', 'x')}${cell('B1', 'x')}</row>` }]);
  await assert.rejects(convertDataFile('xlsx', dup, 'json', { allSheets: true }, 'dup.xlsx'), /Worksheet “Twins”: JSON needs unique/);
  await assert.rejects(convertDataFile('csv', utf8('a\n1'), 'json', { allSheets: true }, 'a.csv'), /Only an Excel workbook/);
  const single = await convertDataFile('csv', utf8('a\n1'), 'json', {}, 'a.csv');
  assert.equal(single.zip, false);
  assert.deepEqual(JSON.parse(single.bytes as string), [{ a: '1' }]);
});

// ─── size bounds, worksheet names made of digits and one unzip ───────────────

test('a tiny workbook claiming cell XFD1048576 is refused, not padded to the full sheet', () => {
  const sparse = workbook([{ name: 'Sparse', rows: `<row r="1">${cell('A1', 'a')}</row><row r="1048576">${cell('XFD1048576', 'z')}</row>` }]);
  assert.ok(sparse.length < 1024);
  assert.throws(() => sourceToGrid('xlsx', sparse), /larger than the converter can read in full/);
});

test('text and JSON whose padded grid would pass the budget are refused before padding', () => {
  const wideLine = `a${','.repeat(20_000)}\n${'x\n'.repeat(1000)}`;
  assert.throws(() => sourceToGrid('csv', utf8(wideLine)), /table is larger than the converter can read in full/);
  assert.throws(() => sourceToGrid('csv', utf8(wideLine.replaceAll(',', ';')), { delimiter: 'semicolon' }), /table is larger/);
  const wideMarkdown = `|${'|'.repeat(20_000)}\n${'| x |\n'.repeat(1000)}`;
  assert.throws(() => sourceToGrid('csv', utf8(wideMarkdown)), /table is larger/);
  const uniqueKeys = JSON.stringify(Array.from({ length: 5000 }, (_, i) => ({ [`k${i}`]: i })));
  assert.throws(() => sourceToGrid('json', utf8(uniqueKeys)), /table is larger/);
});

test('a worksheet named with digits is found by name, and other digits are a 0-based position', () => {
  const years = workbook([
    { name: 'Summary', rows: `<row r="1">${cell('A1', 'summary')}</row>` },
    { name: '2024', rows: `<row r="1">${cell('A1', 'year')}</row>` },
    { name: '1', rows: `<row r="1">${cell('A1', 'named one')}</row>` },
  ]);
  assert.deepEqual(sourceToGrid('xlsx', years, { sheet: '2024' }), [['year']]);
  assert.deepEqual(sourceToGrid('xlsx', years, { sheet: '1' }), [['named one']], 'a name wins over a position');
  assert.deepEqual(sourceToGrid('xlsx', years, { sheet: '0' }), [['summary']]);
  assert.deepEqual(sourceToGrid('xlsx', years, { sheet: 1 }), [['year']], 'a number is always a position');
  assert.throws(() => sourceToGrid('xlsx', years, { sheet: '7' }), /no worksheet named “7” and no worksheet at position 7 \(0 is the first\)/);
});

test('an all-worksheets conversion unzips the workbook once for every sheet', async () => {
  const bytes = BOOK.slice();
  const pending = convertDataFile('xlsx', bytes, 'csv', { allSheets: true }, 'book.xlsx');
  // The conversion runs up to its first await before this line. Zeroing the file
  // then means any later sheet read that unzipped the file again would fail.
  bytes.fill(0);
  const result = await pending;
  assert.deepEqual(result.manifest!.files.map((f) => f.file), ['01-Budget.csv', '03-Q1_Q2_ notes.csv']);
});
