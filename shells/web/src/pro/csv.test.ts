// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the CSV/TSV primitives.
 * Run: node --test shells/web/src/pro/csv.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCSV, parseDelimited, detectDelimiter } from './csv.ts';

test('round-trips simple records', () => {
  const csv = toCSV(['tool', 'headline'], [{ tool: 'poster', headline: 'Hi' }]);
  const rows = parseDelimited(csv);
  assert.deepEqual(rows[0], ['tool', 'headline']);
  assert.deepEqual(rows[1], ['poster', 'Hi']);
});

test('quotes fields containing commas, quotes and newlines', () => {
  const csv = toCSV(['v'], [{ v: 'a,b "c"\nd' }]);
  const rows = parseDelimited(csv);
  assert.equal(rows[1]![0], 'a,b "c"\nd');
});

test('parses escaped quotes', () => {
  const rows = parseDelimited('a,"say ""hi""",c\r\n');
  assert.deepEqual(rows[0], ['a', 'say "hi"', 'c']);
});

test('parses TSV when given a tab delimiter', () => {
  const rows = parseDelimited('a\tb\tc\n1\t2\t3', '\t');
  assert.deepEqual(rows, [['a', 'b', 'c'], ['1', '2', '3']]);
});

test('detectDelimiter prefers tab when present', () => {
  assert.equal(detectDelimiter('a\tb\tc\n'), '\t');
  assert.equal(detectDelimiter('a,b,c\n'), ',');
});

test('drops trailing blank line', () => {
  const rows = parseDelimited('a,b\n1,2\n');
  assert.equal(rows.length, 2);
});
