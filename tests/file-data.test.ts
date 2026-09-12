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
