/**
 * Unit tests for exportSizeDriver (shells/web/src/views/export-size.js) — the
 * manifest→export-dimensions mapping that lets a "size" select set the printed
 * page size (so choosing "A6 landscape" actually exports A6 landscape).
 *
 * Also runs the REAL event-name-badge manifest through it, so the badge's size
 * options stay wired to export dims.
 *
 * Run with: node --test tests/export-size.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { exportSizeDriver } from '../shells/web/src/views/export-size.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('detects a select whose options carry width/height and maps each value to dims', () => {
  const d = exportSizeDriver({
    inputs: [
      { id: 'name', type: 'text' },
      {
        id: 'size', type: 'select', options: [
          { value: 'a6', label: 'A6', width: 105, height: 148, unit: 'mm' },
          { value: 'a6land', label: 'A6 landscape', width: 148, height: 105, unit: 'mm' },
        ],
      },
    ],
  });
  assert.equal(d.id, 'size');
  assert.deepEqual(d.dims.a6, { width: 105, height: 148, unit: 'mm' });
  assert.deepEqual(d.dims.a6land, { width: 148, height: 105, unit: 'mm' });
});

test("defaults a dimensioned option's unit to mm when omitted", () => {
  const d = exportSizeDriver({
    inputs: [{ id: 'size', type: 'select', options: [{ value: 'x', width: 100, height: 200 }] }],
  });
  assert.equal(d.dims.x.unit, 'mm');
});

test('only includes options that carry both width and height', () => {
  const d = exportSizeDriver({
    inputs: [{
      id: 'size', type: 'select', options: [
        { value: 'sized', width: 50, height: 60, unit: 'mm' },
        { value: 'plain', label: 'No dims' },
        { value: 'partial', width: 50 },
      ],
    }],
  });
  assert.deepEqual(Object.keys(d.dims), ['sized']);
});

test('returns null when no select carries dimensions', () => {
  assert.equal(exportSizeDriver({ inputs: [{ id: 'status', type: 'select', options: [{ value: 'a' }] }] }), null);
  assert.equal(exportSizeDriver({ inputs: [] }), null);
  assert.equal(exportSizeDriver({}), null);
});

test('picks the first qualifying select (one size driver per tool)', () => {
  const d = exportSizeDriver({
    inputs: [
      { id: 'first', type: 'select', options: [{ value: 'a', width: 1, height: 2 }] },
      { id: 'second', type: 'select', options: [{ value: 'b', width: 3, height: 4 }] },
    ],
  });
  assert.equal(d.id, 'first');
});

test('the real event-name-badge manifest wires its size select to export dims', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'tools/event-name-badge/tool.json'), 'utf8'));
  const d = exportSizeDriver(manifest);
  assert.equal(d.id, 'size');
  // A6 landscape must export 148 × 105 mm — the exact case the user flagged.
  assert.deepEqual(d.dims.a6land, { width: 148, height: 105, unit: 'mm' });
  // The default (4×6 in) maps to its mm trim size.
  assert.deepEqual(d.dims['4x6in'], { width: 101.6, height: 152.4, unit: 'mm' });
  // Every option carries dims.
  assert.equal(manifest.inputs.find(i => i.id === 'size').options.every(o => d.dims[o.value]), true);
});
