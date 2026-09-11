// SPDX-License-Identifier: MPL-2.0
/**
 * data-source pure core - RFC-4180 serialisation and the file→field-text decode,
 * proven against a real .xlsx built by the engine's own writeXlsx.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { writeXlsx, buildPptxParts, writeDocx } from '@lolly/engine';
import { zipSync, strToU8 } from 'fflate';
import { rowsToCsv, fileBytesToFieldText } from './data-source.ts';

/** The office branches parse XML through the DOM global the web shell owns; node has
 *  none, so lend them jsdom's - the same injection the CLI bridge makes. */
async function lendDomParser(): Promise<void> {
  const { JSDOM } = await import('jsdom');
  (globalThis as unknown as { DOMParser: unknown }).DOMParser = new JSDOM('').window.DOMParser;
}

test('rowsToCsv: RFC-4180 quoting (commas, quotes, newlines), header on row 0', () => {
  const csv = rowsToCsv([
    ['name', 'note'],
    ['Ann', 'plain'],
    ['Bo', 'has, comma'],
    ['Cy', 'say "hi"'],
    ['Di', 'two\nlines'],
  ]);
  assert.equal(
    csv,
    'name,note\nAnn,plain\nBo,"has, comma"\nCy,"say ""hi"""\nDi,"two\nlines"',
  );
});

test('fileBytesToFieldText: a plain text file decodes as UTF-8', async () => {
  const bytes = new TextEncoder().encode('# Boilerplate\n\nHello - world.');
  const text = await fileBytesToFieldText(bytes, 'note.md');
  assert.equal(text, '# Boilerplate\n\nHello - world.');
});

test('fileBytesToFieldText: an .xlsx is unzipped to CSV (first sheet)', async () => {
  const xlsx = writeXlsx({ rows: [['h1', 'h2'], ['a', 'b'], ['c', 'd']] });
  const text = await fileBytesToFieldText(xlsx, 'sheet.xlsx');
  // readXlsx → grid → rowsToCsv: header + two rows.
  assert.equal(text, 'h1,h2\na,b\nc,d');
});

test('fileBytesToFieldText: xlsx detection is by extension, case-insensitive', async () => {
  const xlsx = writeXlsx({ rows: [['x'], ['1']] });
  const text = await fileBytesToFieldText(xlsx, 'DATA.XLSX');
  assert.equal(text, 'x\n1');
});

test('fileBytesToFieldText: reads a chosen sheet (index or name) from a multi-sheet book', async () => {
  // Hand-assemble a 2-sheet workbook (writeXlsx is single-sheet).
  const SHEET = (r: string) => `<?xml version="1.0"?><worksheet><sheetData>${r}</sheetData></worksheet>`;
  const cell = (v: string) => `<row r="1"><c r="A1" t="inlineStr"><is><t>${v}</t></is></c></row>`;
  const book = zipSync({
    'xl/workbook.xml': strToU8(`<workbook xmlns:r="http://x"><sheets><sheet name="First" r:id="rId1"/><sheet name="Second" r:id="rId2"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<Relationships><Relationship Id="rId1" Target="worksheets/s1.xml"/><Relationship Id="rId2" Target="worksheets/s2.xml"/></Relationships>`),
    'xl/worksheets/s1.xml': strToU8(SHEET(cell('one'))),
    'xl/worksheets/s2.xml': strToU8(SHEET(cell('two'))),
  });
  assert.equal(await fileBytesToFieldText(book, 'book.xlsx'), 'one', 'default = first sheet');
  assert.equal(await fileBytesToFieldText(book, 'book.xlsx', 1), 'two', 'by index');
  assert.equal(await fileBytesToFieldText(book, 'book.xlsx', 'Second'), 'two', 'by name');
});

// ── the office branches (plans/139 WP3/WP4): a deck/document fills a text field
// with its CONTENT as Markdown, never with its raw package bytes.

test('fileBytesToFieldText: a .pptx becomes deck markdown', async () => {
  await lendDomParser();
  const run = (text: string) => ({ text, sizePt: 24 });
  const parts = buildPptxParts([{
    shapes: [
      { kind: 'text', x: 0, y: 0, cx: 8e6, cy: 1e6, ph: { type: 'title' }, paras: [{ runs: [run('Quarter in review')] }] },
      { kind: 'text', x: 0, y: 2e6, cx: 8e6, cy: 2e6, paras: [{ runs: [run('Revenue is up')], bullet: true }] },
    ],
    media: [],
  }]);
  const deck = zipSync(Object.fromEntries(
    Object.entries(parts).map(([k, v]) => [k, typeof v === 'string' ? strToU8(v) : v]),
  ));
  const text = await fileBytesToFieldText(deck, 'deck.pptx');
  assert.match(text, /^# Quarter in review$/m, 'the title placeholder becomes the slide heading');
  assert.match(text, /Revenue is up/, 'body text comes across');
  assert.doesNotMatch(text, /PK|<p:sp/, 'the package bytes never reach the field');
});

test('fileBytesToFieldText: a .docx becomes GFM markdown', async () => {
  await lendDomParser();
  const docx = writeDocx({
    blocks: [
      { type: 'heading', level: 1, inlines: [{ type: 'text', text: 'Release notes' }] },
      { type: 'para', inlines: [{ type: 'text', text: 'Shipped ' }, { type: 'strong', inlines: [{ type: 'text', text: 'today' }] }] },
      { type: 'list', ordered: false, items: [{ level: 0, inlines: [{ type: 'text', text: 'One thing' }] }] },
    ],
  });
  const text = await fileBytesToFieldText(docx, 'notes.docx');
  assert.match(text, /^# Release notes$/m);
  assert.match(text, /Shipped \*\*today\*\*/);
  assert.match(text, /^- One thing$/m);
});

test('fileBytesToFieldText: a zip that is neither package is refused by name', async () => {
  await lendDomParser();
  const notADeck = zipSync({ 'hello.txt': strToU8('hi') });
  await assert.rejects(() => fileBytesToFieldText(notADeck, 'nope.pptx'), /PowerPoint/);
  await assert.rejects(() => fileBytesToFieldText(notADeck, 'nope.docx'), /Word/);
});
