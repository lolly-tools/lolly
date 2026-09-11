// SPDX-License-Identifier: MPL-2.0
/**
 * #/convert tabular-data conversion - the grid round-trip (plan 87 Phase 3). Proven
 * against the real engine writers/readers; the JSON ⇄ grid mapping (not covered by
 * engine tests) is pinned here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { writeXlsx, readXlsx } from '@lolly/engine';
import { sourceToGrid, gridToTarget } from './convert.ts';

const enc = new TextEncoder();

const GRID = [['Item', 'Cost'], ['Rent', '1200'], ['Food', '400']];

test('JSON output refuses headings that would silently lose columns', () => {
  assert.throws(() => gridToTarget([['name', 'name'], ['first', 'second']], 'json'), /unique/);
  assert.throws(() => gridToTarget([['', 'value'], ['first', 'second']], 'json'), /non-empty/);
  assert.throws(() => gridToTarget([['name'], ['first', 'second']], 'json'), /more cells/);
});

test('xlsx → grid → csv', () => {
  const xlsx = writeXlsx({ rows: GRID });
  const grid = sourceToGrid('xlsx', xlsx);
  assert.deepEqual(grid, GRID);
  assert.equal(gridToTarget(grid, 'csv'), 'Item,Cost\nRent,1200\nFood,400');
});

test('csv → grid → xlsx round-trips through readXlsx', () => {
  const grid = sourceToGrid('csv', enc.encode('Region,Sales\nEMEA,500\nAPAC,700'));
  assert.deepEqual(grid, [['Region', 'Sales'], ['EMEA', '500'], ['APAC', '700']]);
  const xlsx = gridToTarget(grid, 'xlsx');
  assert.ok(xlsx instanceof Uint8Array, 'xlsx target returns bytes');
  assert.deepEqual(readXlsx(xlsx as Uint8Array).rows, grid);
});

test('grid → json emits an array of objects keyed by the header', () => {
  const json = gridToTarget(GRID, 'json') as string;
  assert.deepEqual(JSON.parse(json), [
    { Item: 'Rent', Cost: '1200' },
    { Item: 'Food', Cost: '400' },
  ]);
});

test('json (array of objects) → grid → csv', () => {
  const json = JSON.stringify([{ a: '1', b: '2' }, { a: '3', b: '4' }]);
  const grid = sourceToGrid('json', enc.encode(json));
  assert.deepEqual(grid, [['a', 'b'], ['1', '2'], ['3', '4']]);
  assert.equal(gridToTarget(grid, 'csv'), 'a,b\n1,2\n3,4');
});

test('json array-of-arrays passes through as a grid', () => {
  const grid = sourceToGrid('json', enc.encode('[["x","y"],["1","2"]]'));
  assert.deepEqual(grid, [['x', 'y'], ['1', '2']]);
});

test('tsv target escapes embedded tabs/newlines to spaces', () => {
  const tsv = gridToTarget([['a', 'b'], ['has\ttab', 'two\nlines']], 'tsv') as string;
  assert.equal(tsv, 'a\tb\nhas tab\ttwo lines');
  // Re-reading a TSV grid: parseTableText auto-detects the tab delimiter.
  assert.deepEqual(sourceToGrid('tsv', enc.encode(tsv)), [['a', 'b'], ['has tab', 'two lines']]);
});

test('malformed sources throw a user-ready message', () => {
  assert.throws(() => sourceToGrid('json', enc.encode('not json')), /could not be parsed/i);
  assert.throws(() => sourceToGrid('json', enc.encode('[]')), /non-empty/i);
});
