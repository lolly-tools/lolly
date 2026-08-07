// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for exportFormatDriver (shells/web/src/views/export-format.ts) — the
 * manifest→export-formats mapping that lets a "mode" select (e.g. a unified filter
 * tool's effect picker) narrow the download bar to the selected option's formats,
 * while render.formats stays the union.
 *
 * Run with: node --test tests/export-format.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { exportFormatDriver } from '../shells/web/src/views/export-format.ts';

test('detects a select whose options carry `formats` and maps each value to its list', () => {
  const d = exportFormatDriver({
    inputs: [
      { id: 'image', type: 'asset' },
      {
        id: 'effect', type: 'select', options: [
          { value: 'halftone', label: 'Halftone', badge: 'vector', formats: ['svg', 'pdf', 'png'] },
          { value: 'duotone', label: 'Duotone', badge: 'raster', formats: ['png', 'jpg', 'webp'] },
        ],
      },
    ],
  } as any)!;
  assert.equal(d.id, 'effect');
  assert.deepEqual(d.formats.halftone, ['svg', 'pdf', 'png']);
  assert.deepEqual(d.formats.duotone, ['png', 'jpg', 'webp']);
});

test('only includes options that carry a non-empty formats list', () => {
  const d = exportFormatDriver({
    inputs: [{
      id: 'effect', type: 'select', options: [
        { value: 'a', formats: ['svg'] },
        { value: 'b', label: 'no formats' },
        { value: 'c', formats: [] },
      ],
    }],
  } as any)!;
  assert.deepEqual(Object.keys(d.formats), ['a']);
});

test('returns null when no select carries formats', () => {
  assert.equal(exportFormatDriver({ inputs: [{ id: 'x', type: 'select', options: [{ value: 'a' }] }] } as any), null);
  assert.equal(exportFormatDriver({ inputs: [] }), null);
  assert.equal(exportFormatDriver({}), null);
});

test('picks the first qualifying select (one format driver per tool)', () => {
  const d = exportFormatDriver({
    inputs: [
      { id: 'first', type: 'select', options: [{ value: 'a', formats: ['png'] }] },
      { id: 'second', type: 'select', options: [{ value: 'b', formats: ['svg'] }] },
    ],
  } as any)!;
  assert.equal(d.id, 'first');
});
