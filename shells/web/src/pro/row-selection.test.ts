// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { RowSelection, rowPage, duplicateRows, removeRows, restoreRows, reorderRows } from './row-selection.ts';

const rows = () => Array.from({ length: 120 }, (_, i) => ({ uid: `row-${i}`, values: { title: `Title ${i}`, blocks: [{ text: 'Original' }] } }));

test('selection spans pages, survives a reorder and removes stale identities', () => {
  const data = rows();
  const selection = new RowSelection();
  selection.toggle(data, 'row-48', true);
  selection.toggle(data, 'row-52', true, true);
  assert.deepEqual(selection.scope(data).map(r => r.uid), ['row-48', 'row-49', 'row-50', 'row-51', 'row-52']);
  const reordered = [...data].reverse();
  assert.deepEqual(selection.scope(reordered).map(r => r.uid), ['row-52', 'row-51', 'row-50', 'row-49', 'row-48']);
  selection.reconcile(reordered.filter(r => r.uid !== 'row-50'));
  assert.equal(selection.ids.has('row-50'), false);
  selection.clear();
  assert.deepEqual(selection.scope(data), data);
});

test('shift deselection applies to a range without dropping unrelated selections', () => {
  const data = rows();
  const selection = new RowSelection();
  selection.toggle(data, 'row-90', true);
  selection.toggle(data, 'row-4', true);
  selection.toggle(data, 'row-8', true, true);
  selection.toggle(data, 'row-6', false, true);
  assert.deepEqual([...selection.ids], ['row-90', 'row-7', 'row-8']);
});

test('duplicate creates independent nested values and new identities in row order', () => {
  const data = rows().slice(0, 4).map(r => ({ ...r, kitOutputId: 'kit-output', format: 'svg', profile: 'fogra39', bleed: '3mm', marks: 'crop' }));
  let seq = 0;
  const result = duplicateRows(data, new Set(['row-0', 'row-2']), () => `copy-${seq++}`);
  assert.deepEqual(result.rows.map(r => r.uid), ['row-0', 'copy-0', 'row-1', 'row-2', 'copy-1', 'row-3']);
  result.copies[0]!.values.blocks[0]!.text = 'Changed';
  assert.equal(data[0]!.values.blocks[0]!.text, 'Original');
  assert.equal(result.copies[0]!.kitOutputId, undefined);
  assert.equal(result.copies[0]!.bleed, '3mm');
  assert.equal(result.copies[0]!.format, 'svg');
});

test('undo removal retains intervening edits and cannot duplicate a restored row', () => {
  const data = rows().slice(0, 5);
  const result = removeRows(data, new Set(['row-0', 'row-3']));
  result.rows[0]!.values.title = 'Edited after deletion';
  const restored = restoreRows(result.rows, result.removed);
  assert.deepEqual(restored.map(r => r.uid), data.map(r => r.uid));
  assert.equal(restored[1]!.values.title, 'Edited after deletion');
  assert.deepEqual(restoreRows(restored, result.removed), restored);
});

test('page rendering is bounded and page drag preserves rows outside the page', () => {
  const data = rows();
  const middle = rowPage(data, 1);
  assert.equal(middle.rows.length, 50);
  const reordered = reorderRows(data, middle.rows.map(r => r.uid).reverse());
  assert.deepEqual(reordered.slice(0, 50), data.slice(0, 50));
  assert.deepEqual(reordered.slice(100), data.slice(100));
  assert.equal(reordered[50]!.uid, 'row-99');
  assert.equal(rowPage(data.slice(0, 2), 2).page, 0);
  assert.deepEqual(rowPage([], 10), { rows: [], page: 0, pages: 1, start: 0 });
});
