// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for folder → batch row assembly (pure).
 * Run directly:  node --test shells/web/src/pro/folder-rows.test.js
 *
 * Lives next to the feature so the whole /pro module can be removed in one delete.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stemOf, slug, rowFromToolSession, rowFromBatchRow, rowsForFolder,
} from './folder-rows.js';

test('stemOf strips a known extension, falls back to toolId', () => {
  assert.equal(stemOf('badge.png', 'name-badge'), 'badge');
  assert.equal(stemOf('  card.svg ', 'x'), 'card');
  assert.equal(stemOf('', 'name-badge'), 'name-badge');
  assert.equal(stemOf(undefined, 'name-badge'), 'name-badge');
  assert.equal(stemOf('', ''), 'render');
});

test('slug keeps a folder name path-safe', () => {
  assert.equal(slug('My Event!'), 'My-Event');
  assert.equal(slug('  spaces  '), 'spaces');
  assert.equal(slug('a/b'), 'a-b');
});

test('rowFromToolSession keeps inputs, drops __meta, maps __export_*', () => {
  const data = {
    headline: 'Hello', size: 42, __toolId: 'poster', __toolVersion: '1.0.0',
    __label: 'My poster', __export_filename: 'hello.png', __export_format: 'png',
    __export_width: '800', __export_height: '600', __export_unit: 'px', __export_dpi: '300',
  };
  const row = rowFromToolSession(data);
  assert.deepEqual(row.values, { headline: 'Hello', size: 42 });
  assert.equal(row.toolId, 'poster');
  assert.equal(row.format, 'png');
  assert.equal(row.filename, 'hello.png');
  assert.equal(row.outWidth, 800);
  assert.equal(row.outHeight, 600);
  assert.equal(row.unit, 'px');
  assert.equal(row.dpi, 300);
  // No __-prefixed key leaks into values.
  assert.ok(!Object.keys(row.values).some(k => k.startsWith('__')));
});

test('rowFromToolSession with pathParts builds a nested filename', () => {
  const data = { x: 1, __toolId: 'poster', __export_filename: 'card.png' };
  const row = rowFromToolSession(data, ['My Event']);
  assert.equal(row.filename, 'My Event/card');   // extension dropped; batch.js re-adds it
});

test('rowFromToolSession ignores zero/invalid numeric meta', () => {
  const row = rowFromToolSession({ __toolId: 't', __export_width: '0', __export_dpi: 'abc' });
  assert.equal(row.outWidth, undefined);
  assert.equal(row.dpi, undefined);
  assert.equal(row.unit, 'px');
});

test('rowFromBatchRow stamps the group/subgroup path onto the leaf', () => {
  const r = { toolId: 'name-badge', values: { name: 'Ada' }, filename: 'ada.png', format: 'png' };
  const row = rowFromBatchRow(r, ['My Event', 'VIP name badges']);
  assert.equal(row.filename, 'My Event/VIP name badges/ada');
  assert.deepEqual(row.values, { name: 'Ada' });
  assert.equal(row.format, 'png');
});

test('rowsForFolder expands batch sessions to all rows and tool sessions to one', async () => {
  const host = {
    state: {
      async load(slot) {
        if (slot === '__batch__:VIP name badges') {
          return {
            __batch: true, __label: 'VIP name badges',
            rows: [
              { toolId: 'name-badge', values: { name: 'Ada' }, filename: 'ada.png' },
              { toolId: 'name-badge', values: { name: 'Lin' }, filename: 'lin.png' },
            ],
          };
        }
        if (slot === 'poster:123') {
          return { __toolId: 'poster', headline: 'Hi', __export_filename: 'hi.png' };
        }
        return null;
      },
    },
  };
  const folder = {
    name: 'My Event',
    items: [
      { type: 'session', ref: '__batch__:VIP name badges' },
      { type: 'session', ref: 'poster:123' },
      { type: 'image', ref: 'user/upload/1' },          // skipped (input, not renderable)
      { type: 'session', ref: 'missing:0' },             // skipped (load → null)
    ],
  };
  const rows = await rowsForFolder(host, folder);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(r => r.filename), [
    'My Event/VIP name badges/ada',
    'My Event/VIP name badges/lin',
    'My Event/hi',
  ]);
});

test('rowsForFolder returns [] for an empty folder', async () => {
  const host = { state: { async load() { return null; } } };
  assert.deepEqual(await rowsForFolder(host, { name: 'Empty', items: [] }), []);
});
