// SPDX-License-Identifier: MPL-2.0
/**
 * The size the export check states (`panelSize`): the value the export writes, and
 * who declared that size.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/tool-actions/panel-size.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { panelSize } from './shared.ts';

const base = { manifest: { width: 1920, height: 1080 }, fixed: false, unit: 'px', userSet: false, units: true, canvasScale: 1 };

test('fields the tool filled in are the size the export writes, still declared by the manifest', () => {
  // Design fills the fields from the artboard; the export reads them as they are.
  const size = panelSize({ ...base, fields: { w: 1080, h: 1350 } });
  assert.deepEqual(size.width, { value: 1080, unit: 'px' });
  assert.deepEqual(size.height, { value: 1350, unit: 'px' });
  assert.equal(size.fromFields, true);
  assert.equal(size.declaredBy, 'manifest');
  assert.equal(size.unitDeclared, false, 'a unit the tool chose is not a declared one');
});

test('a size the user set is declared by them, with the unit only when the tool offers units', () => {
  const mm = panelSize({ ...base, unit: 'mm', userSet: true, fields: { w: 210, h: 297 } });
  assert.deepEqual([mm.width, mm.height, mm.declaredBy, mm.unitDeclared], [{ value: 210, unit: 'mm' }, { value: 297, unit: 'mm' }, 'url', true]);
  assert.equal(panelSize({ ...base, userSet: true, units: false, fields: { w: 800, h: 600 } }).unitDeclared, false);
});

test('a blank field or a tool without fields falls back to the manifest canvas', () => {
  const blank = panelSize({ ...base, userSet: true, canvasScale: 2, fields: { w: 1080, h: undefined } });
  assert.deepEqual([blank.width, blank.height, blank.fromFields, blank.declaredBy], [{ value: 3840, unit: 'px' }, { value: 2160, unit: 'px' }, false, 'manifest']);
  const fixed = panelSize({ ...base, fixed: true, userSet: true, fields: { w: 500, h: 500 } });
  assert.deepEqual([fixed.width.value, fixed.height.value, fixed.declaredBy], [1920, 1080, 'manifest']);
});
