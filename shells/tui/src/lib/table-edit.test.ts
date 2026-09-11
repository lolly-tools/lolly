// SPDX-License-Identifier: MPL-2.0
/**
 * Contract tests for the TUI's `table` grid helpers (lib/table-edit.ts) plus the round-trip
 * against the engine's own importer/validator: an import (parseTableText) and every grid
 * mutation must survive `updateInput`, which REJECTS a ragged or non-string grid outright.
 * A helper that returns a ragged grid makes an edit silently do nothing in the view, so
 * the rectangularity is asserted through the real engine, not just locally.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTableText } from '../../../../engine/src/table-text.ts';
import { normalizeTableValue } from '../../../../engine/src/inputs.ts';
import type { TableValue } from '../../../../engine/src/inputs.ts';
import {
  asTable, tableSummary, cellAt, setCell, addRow, deleteRow, addColumn, deleteColumn,
  clampCursor, columnWidths, fitCell,
} from './table-edit.ts';

const GRID: TableValue = { columns: ['Name', 'Price'], rows: [['Widget', '9'], ['Gadget', '12']] };

/** Every mutation must stay a grid the engine will accept (rectangular, all strings). */
function assertEngineAccepts(t: TableValue): void {
  const norm = normalizeTableValue(t);
  assert.notEqual(norm, null, 'engine rejected the grid outright');
  assert.deepEqual(norm, t, 'engine normalisation changed the grid (it was ragged)');
}

test('asTable tolerates null, garbage and ragged rows', () => {
  assert.deepEqual(asTable(null), { columns: [], rows: [] });
  assert.deepEqual(asTable('nope'), { columns: [], rows: [] });
  assert.deepEqual(asTable({ columns: ['a', 'b'], rows: [['1'], ['1', '2', '3']] }), {
    columns: ['a', 'b'], rows: [['1', ''], ['1', '2']],
  });
});

test('tableSummary reports shape and headings, and names the empty case', () => {
  assert.match(tableSummary(GRID), /^2 cols × 2 rows · Name, Price/);
  assert.match(tableSummary(null), /^empty/);
  assert.match(tableSummary({ columns: ['A'], rows: [['1']] }), /^1 col × 1 row/);
});

test('cellAt addresses the heading row as -1', () => {
  assert.equal(cellAt(GRID, -1, 0), 'Name');
  assert.equal(cellAt(GRID, 1, 1), '12');
  assert.equal(cellAt(GRID, 9, 0), '');
  assert.equal(cellAt(GRID, 0, 9), '');
});

test('setCell edits a body cell without mutating the original', () => {
  const next = setCell(GRID, 0, 1, '11');
  assert.equal(cellAt(next, 0, 1), '11');
  assert.equal(cellAt(GRID, 0, 1), '9');
  assertEngineAccepts(next);
});

test('setCell edits a heading and leaves the rows intact', () => {
  const next = setCell(GRID, -1, 0, 'Product');
  assert.deepEqual(next.columns, ['Product', 'Price']);
  assert.deepEqual(next.rows, GRID.rows);
  assertEngineAccepts(next);
});

test('setCell ignores an out-of-range coordinate', () => {
  assert.equal(setCell(GRID, 0, 5, 'x'), GRID);
  assert.equal(setCell(GRID, 5, 0, 'x'), GRID);
});

test('addRow inserts after the cursor, padded to the column count', () => {
  const next = addRow(GRID, 0);
  assert.deepEqual(next.rows, [['Widget', '9'], ['', ''], ['Gadget', '12']]);
  assertEngineAccepts(next);
});

test('addRow from the heading row inserts at the top', () => {
  assert.deepEqual(addRow(GRID, -1).rows[0], ['', '']);
});

test('addRow on a column-less grid creates the first column too', () => {
  const next = addRow({ columns: [], rows: [] }, -1);
  assert.equal(next.columns.length, 1);
  assert.deepEqual(next.rows, [['']]);
  assertEngineAccepts(next);
});

test('deleteRow removes one body row and refuses the heading row', () => {
  assert.deepEqual(deleteRow(GRID, 0).rows, [['Gadget', '12']]);
  assert.equal(deleteRow(GRID, -1), GRID);
  assert.equal(deleteRow(GRID, 9), GRID);
});

test('addColumn pads every existing row', () => {
  const next = addColumn(GRID, 0);
  assert.equal(next.columns.length, 3);
  assert.deepEqual(next.rows, [['Widget', '', '9'], ['Gadget', '', '12']]);
  assertEngineAccepts(next);
});

test('deleteColumn drops the matching cell in every row', () => {
  const next = deleteColumn(GRID, 0);
  assert.deepEqual(next, { columns: ['Price'], rows: [['9'], ['12']] });
  assertEngineAccepts(next);
});

test('deleting the last column empties the grid rather than leaving zero-cell rows', () => {
  const one: TableValue = { columns: ['Only'], rows: [['a'], ['b']] };
  assert.deepEqual(deleteColumn(one, 0), { columns: [], rows: [] });
});

test('clampCursor keeps the cursor inside the grid, heading row included', () => {
  assert.deepEqual(clampCursor(GRID, -5, -5), { row: -1, col: 0 });
  assert.deepEqual(clampCursor(GRID, 99, 99), { row: 1, col: 1 });
  assert.deepEqual(clampCursor({ columns: [], rows: [] }, 3, 3), { row: -1, col: 0 });
});

test('columnWidths fit the widest content and shrink to the available terminal', () => {
  const wide = columnWidths(GRID, 200);
  assert.deepEqual(wide, ['Widget'.length, 'Price'.length]);
  const tight = columnWidths(GRID, 12);
  assert.ok(tight.reduce((a, b) => a + b, 0) + (tight.length - 1) <= 12, `too wide: ${tight}`);
  assert.ok(tight.every(w => w >= 3));
});

test('columnWidths never shrinks a column below the 3-char floor', () => {
  const t: TableValue = { columns: ['aaaaaaaaaa', 'bbbbbbbbbb', 'cccccccccc'], rows: [] };
  assert.ok(columnWidths(t, 4).every(w => w === 3));
});

test('fitCell pads, truncates with an ellipsis and flattens newlines', () => {
  assert.equal(fitCell('ab', 5), 'ab   ');
  assert.equal(fitCell('abcdef', 4), 'abc…');
  assert.equal(fitCell('a\nb', 5), 'a b  ');
});

// ── Import round-trip (the `i` key path, shared with the CLI's --<id>-data) ───

test('a CSV import parses to a grid the engine accepts', () => {
  const parsed = parseTableText('Name,Price\nWidget,9\nGadget,12\n');
  assert.deepEqual(parsed, GRID);
  assertEngineAccepts(parsed!);
});

test('a TSV and a Markdown table import to the same grid', () => {
  assert.deepEqual(parseTableText('Name\tPrice\nWidget\t9\nGadget\t12'), GRID);
  assert.deepEqual(
    parseTableText('| Name | Price |\n|---|---|\n| Widget | 9 |\n| Gadget | 12 |'),
    GRID,
  );
});

test('a ragged CSV import is squared off before it reaches the model', () => {
  const parsed = parseTableText('a,b,c\n1\n2,3,4,5')!;
  assert.equal(parsed.columns.length, 4);
  assert.ok(parsed.rows.every(r => r.length === 4));
  assertEngineAccepts(parsed);
});

test('non-tabular text imports as null, so the view can refuse it out loud', () => {
  assert.equal(parseTableText(''), null);
  assert.equal(parseTableText('   \n  '), null);
});

test('an edit on an imported grid still round-trips through the engine', () => {
  const parsed = parseTableText('Name,Price\nWidget,9')!;
  const edited = addColumn(setCell(addRow(parsed, 0), 1, 0, 'Gizmo'), 1);
  assertEngineAccepts(edited);
  assert.equal(cellAt(edited, 1, 0), 'Gizmo');
});
