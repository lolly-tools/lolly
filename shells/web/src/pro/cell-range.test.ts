// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { CellRange, clipboardCells, cellsToTsv, tileCells } from './cell-range.ts';
import { readCell, writeCell } from './cell-data.ts';
import type { ToolManifest } from '../../../../engine/src/loader.ts';

test('rectangles span pages and follow identities through reordering', () => {
  const rows = Array.from({ length: 125 }, (_, i) => `row-${i}`);
  const cols = ['url', 'text', 'name'];
  const range = new CellRange();
  range.select({ row: 'row-51', col: 'text' });
  range.select({ row: 'row-48', col: 'url' }, true);
  assert.deepEqual(range.rectangle(rows, cols), { rows: rows.slice(48, 52), cols: ['url', 'text'], start: { row: 'row-48', col: 'url' } });
  assert.deepEqual(range.rectangle([...rows].reverse(), cols)?.rows, rows.slice(48, 52).reverse());
  assert.equal(range.rectangle(rows, ['name']), null);
  assert.equal(range.anchor, null);
});

test('clipboard round-trip preserves blanks, commas, quotes, Unicode and multiline fields', () => {
  const values = [['A, B; C', 'Quoted "text"', 'line one\nline two'], ['', '', ''], ['é\t你', 'last', '']];
  assert.deepEqual(clipboardCells(cellsToTsv(values)), values);
  assert.deepEqual(clipboardCells(cellsToTsv([['A'], [''], ['B'], ['']])), [['A'], [''], ['B'], ['']]);
  assert.deepEqual(clipboardCells('Hello, world'), [['Hello, world']]);
  assert.deepEqual(clipboardCells('\t\r\n\t\r\n'), [['', ''], ['', '']]);
});

test('paste repeats a block only when it fits the selected rectangle', () => {
  assert.deepEqual(tileCells([['same']], 2, 2), [['same', 'same'], ['same', 'same']]);
  assert.deepEqual(tileCells([['a', 'b']], 2, 4), [['a', 'b', 'a', 'b'], ['a', 'b', 'a', 'b']]);
  assert.deepEqual(tileCells([['a', 'b']], 2, 3), [['a', 'b']]);
});

test('cell values copy defaults and round-trip structured inputs while blank text clears old values', () => {
  const row = { toolId: 'sample', values: { text: 'Before', quantity: 2 } as Record<string, unknown>, filename: '', outWidth: 800,
    manifest: { inputs: [{ id: 'text', type: 'longtext', default: 'Default' }, { id: 'asset', type: 'asset', default: { id: 'brand/logo' } }, { id: 'blocks', type: 'blocks' }, { id: 'position', type: 'vector' }, { id: 'quantity', type: 'number' }] } as ToolManifest };
  const defaults = { unit: 'px', dpi: 300 };
  assert.equal(readCell(row, 'asset', defaults), 'brand/logo');
  assert.equal(writeCell(row, 'text', ''), true);
  assert.equal(readCell(row, 'text', defaults), '');
  assert.equal(writeCell(row, 'quantity', 'abc'), false);
  assert.equal(row.values.quantity, 2);
  assert.equal(writeCell(row, '__width', 'NaN'), false);
  assert.equal(row.outWidth, 800);
  for (const [key, json] of [['blocks', '[{"text":"A"}]'], ['position', '{"x":4,"y":7}']]) {
    assert.equal(writeCell(row, key!, json!), true);
    assert.equal(readCell(row, key!, defaults), json);
  }
  assert.equal(writeCell(row, '__template', 'another-tool'), false);
  assert.equal(writeCell(row, 'absent', 'discarded'), false);
});
