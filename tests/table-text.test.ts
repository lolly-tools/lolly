// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/table-text.ts — text ⇄ table parsing for the `table` input's
 * clipboard/file round-trip (TSV, Markdown pipe tables, RFC 4180 CSV).
 *
 * Run with: node --test tests/table-text.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { looksLikeTable, parseTableText, toTsv, toMarkdown, toHtmlTable } from '../engine/src/table-text.ts';

const BATTLE_MD = `
| Pain | Summary | SolutionName | CompetitorName | Strategy |
| --- | --- | --- | --- | --- |
| Assurance | Is it open? | Yes | Yes | Table stakes, compete with why |
| Provenance | Where's it made? | Europe | North America | Local advantage, global-qualify |
`.trim();

test('parses a Markdown pipe table (drops the alignment row)', () => {
  const t = parseTableText(BATTLE_MD)!;
  assert.deepEqual(t.columns, ['Pain', 'Summary', 'SolutionName', 'CompetitorName', 'Strategy']);
  assert.equal(t.rows.length, 2);
  assert.equal(t.rows[0]![4], 'Table stakes, compete with why');
});

test('parses TSV from a spreadsheet (cells may contain commas and pipes)', () => {
  const t = parseTableText('A\tB\n1, one\t2 | two\nx\t')!;
  assert.deepEqual(t, { columns: ['A', 'B'], rows: [['1, one', '2 | two'], ['x', '']] });
});

test('parses CSV with RFC 4180 quoting', () => {
  const t = parseTableText('Pain,Strategy\nAssurance,"Table stakes, compete with why"\nb,"He said ""go"""')!;
  assert.deepEqual(t.rows, [['Assurance', 'Table stakes, compete with why'], ['b', 'He said "go"']]);
});

test('pads ragged grids to the widest row and rejects non-tables', () => {
  const t = parseTableText('A\tB\tC\n1\n1\t2\t3\t4')!;
  assert.equal(t.columns.length, 4);
  assert.deepEqual(t.rows[0], ['1', '', '', '']);
  assert.equal(parseTableText('   '), null);
});

test('looksLikeTable: TSV and Markdown yes; prose and single lines no', () => {
  assert.equal(looksLikeTable('a\tb'), true);
  assert.equal(looksLikeTable('| a | b |'), true);
  assert.equal(looksLikeTable('A,B\n1,2\n3,4'), true);
  assert.equal(looksLikeTable('just a sentence, with a comma'), false);
  assert.equal(looksLikeTable('A,B\n1,2,3'), false, 'inconsistent CSV is not a grid');
  assert.equal(looksLikeTable(''), false);
});

test('TSV → parse round-trips; markdown/html escape their delimiters', () => {
  const t = { columns: ['A', 'B'], rows: [['one, fine', 'two']] };
  assert.deepEqual(parseTableText(toTsv(t)), t);
  assert.match(toMarkdown({ columns: ['P|Q'], rows: [] }), /P\\\|Q/);
  assert.match(toHtmlTable({ columns: ['<b>'], rows: [['a&b']] }), /&lt;b&gt;[\s\S]*a&amp;b/);
});

test('toTsv flattens tabs/newlines inside cells rather than shifting the grid', () => {
  const tsv = toTsv({ columns: ['A', 'B'], rows: [['line\nbreak', 'tab\there']] });
  assert.equal(tsv, 'A\tB\nline break\ttab here');
});
