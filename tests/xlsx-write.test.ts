// SPDX-License-Identifier: MPL-2.0
/**
 * xlsx-write.test.ts — writeXlsx round-trips through the real readXlsx, and the
 * emitted archive carries every OOXML part a spreadsheet app expects.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readXlsx } from '../engine/src/xlsx-import.ts';
import { readZip } from '../engine/src/zip.ts';
import { colLetters, writeXlsx } from '../engine/src/xlsx-write.ts';

test('writeXlsx → readXlsx round-trips text / number / boolean cells', () => {
  const bytes = writeXlsx({ rows: [['h1', 'h2'], [1, true]] });
  assert.ok(bytes instanceof Uint8Array);
  assert.equal(bytes[0], 0x50); // "PK" — a real zip
  assert.equal(bytes[1], 0x4b);

  const { rows } = readXlsx(bytes);
  // readXlsx returns every cell as its string form: numbers as text, booleans TRUE/FALSE.
  assert.deepEqual(rows, [
    ['h1', 'h2'],
    ['1', 'TRUE'],
  ]);
});

test('the archive contains every required OOXML part', () => {
  const bytes = writeXlsx({ rows: [['x']] });
  const names = new Set(readZip(bytes).map((e) => e.name));
  for (const part of [
    '[Content_Types].xml',
    '_rels/.rels',
    'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels',
    'xl/worksheets/sheet1.xml',
    'xl/sharedStrings.xml',
    'xl/styles.xml',
  ]) {
    assert.ok(names.has(part), `missing part ${part}`);
  }
});

test('cell refs advance past column Z into AA/AB', () => {
  // 28 columns so the last three refs are Y, Z, AA, AB — the double-letter roll-over.
  const header = Array.from({ length: 28 }, (_, i) => `c${i}`);
  const bytes = writeXlsx({ rows: [header] });
  const sheetXml = new TextDecoder().decode(
    readZip(bytes).find((e) => e.name === 'xl/worksheets/sheet1.xml')!.bytes,
  );
  assert.match(sheetXml, /r="Z1"/);
  assert.match(sheetXml, /r="AA1"/);
  assert.match(sheetXml, /r="AB1"/);
  assert.equal(colLetters(0), 'A');
  assert.equal(colLetters(25), 'Z');
  assert.equal(colLetters(26), 'AA');
  assert.equal(colLetters(701), 'ZZ');
  assert.equal(colLetters(702), 'AAA');
});

test('null cells are omitted, values around them keep their column', () => {
  const bytes = writeXlsx({ rows: [['a', null, 'c']] });
  const { rows } = readXlsx(bytes);
  // The gap is preserved: 'c' stays in column C (index 2), the middle cell blank.
  assert.equal(rows[0]![0], 'a');
  assert.equal(rows[0]![2], 'c');
  assert.equal(rows[0]![1], '');
});

test('shared strings deduplicate and survive XML-special characters', () => {
  const bytes = writeXlsx({ rows: [['a & b < c', 'a & b < c', 'plain']] });
  // The repeated string is interned once → uniqueCount 2 (the pair + "plain").
  const sharedXml = new TextDecoder().decode(
    readZip(bytes).find((e) => e.name === 'xl/sharedStrings.xml')!.bytes,
  );
  assert.match(sharedXml, /uniqueCount="2"/);
  assert.match(sharedXml, /a &amp; b &lt; c/);

  const { rows } = readXlsx(bytes);
  assert.deepEqual(rows[0], ['a & b < c', 'a & b < c', 'plain']);
});

test('a custom sheet name lands in workbook.xml', () => {
  const bytes = writeXlsx({ name: 'Data 2026', rows: [['x']] });
  const wbXml = new TextDecoder().decode(
    readZip(bytes).find((e) => e.name === 'xl/workbook.xml')!.bytes,
  );
  assert.match(wbXml, /name="Data 2026"/);
});

test('numeric cells are stored untyped (no t="s") so they read back as numbers', () => {
  const bytes = writeXlsx({ rows: [[42, -3.5, 0]] });
  const sheetXml = new TextDecoder().decode(
    readZip(bytes).find((e) => e.name === 'xl/worksheets/sheet1.xml')!.bytes,
  );
  assert.match(sheetXml, /<c r="A1"><v>42<\/v><\/c>/);
  assert.match(sheetXml, /<c r="B1"><v>-3\.5<\/v><\/c>/);
  const { rows } = readXlsx(bytes);
  assert.deepEqual(rows[0], ['42', '-3.5', '0']);
});
