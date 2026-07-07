/**
 * Unit tests for exportSizeDriver (shells/web/src/views/export-size.ts) — the
 * manifest→export-dimensions mapping that lets a "size" select set the printed
 * page size (so choosing "A6 landscape" actually exports A6 landscape).
 *
 * Also runs the REAL event-name-badge manifest through it, so the badge's size
 * options stay wired to export dims.
 *
 * Run with: node --test tests/export-size.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { exportSizeDriver, aspectWarning } from '../shells/web/src/views/export-size.ts';

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
  } as any)!;
  assert.equal(d.id, 'size');
  assert.deepEqual(d.dims.a6, { width: 105, height: 148, unit: 'mm' });
  assert.deepEqual(d.dims.a6land, { width: 148, height: 105, unit: 'mm' });
});

test("defaults a dimensioned option's unit to mm when omitted", () => {
  const d = exportSizeDriver({
    inputs: [{ id: 'size', type: 'select', options: [{ value: 'x', width: 100, height: 200 }] }],
  } as any)!;
  assert.equal(d.dims.x!.unit, 'mm');
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
  } as any)!;
  assert.deepEqual(Object.keys(d.dims), ['sized']);
});

test('returns null when no select carries dimensions', () => {
  assert.equal(exportSizeDriver({ inputs: [{ id: 'status', type: 'select', options: [{ value: 'a' }] }] } as any), null);
  assert.equal(exportSizeDriver({ inputs: [] }), null);
  assert.equal(exportSizeDriver({}), null);
});

test('picks the first qualifying select (one size driver per tool)', () => {
  const d = exportSizeDriver({
    inputs: [
      { id: 'first', type: 'select', options: [{ value: 'a', width: 1, height: 2 }] },
      { id: 'second', type: 'select', options: [{ value: 'b', width: 3, height: 4 }] },
    ],
  } as any)!;
  assert.equal(d.id, 'first');
});

// ── aspectWarning ────────────────────────────────────────────────────────────

const GUARD = { render: { aspectWarning: { max: 1, message: 'portrait only' } } };

test('aspectWarning fires when the aspect ratio exceeds max (landscape)', () => {
  assert.equal(aspectWarning(GUARD, 297, 210), 'portrait only'); // A4 landscape, aspect 1.41
});

test('aspectWarning stays silent for an in-band (portrait) size', () => {
  assert.equal(aspectWarning(GUARD, 210, 297), null); // A4 portrait, aspect 0.71
});

test('aspectWarning tolerates an exactly-on-the-bound size (1:1 at max 1)', () => {
  assert.equal(aspectWarning(GUARD, 500, 500), null); // epsilon keeps a square from tripping max:1
});

test('aspectWarning honours a min bound (too tall)', () => {
  const g = { render: { aspectWarning: { min: 0.5, message: 'too tall' } } };
  assert.equal(aspectWarning(g, 100, 300), 'too tall'); // aspect 0.33 < 0.5
  assert.equal(aspectWarning(g, 100, 150), null);        // aspect 0.67 ok
});

test('aspectWarning returns null with no config or invalid dimensions', () => {
  assert.equal(aspectWarning({ render: {} }, 297, 210), null);
  assert.equal(aspectWarning(GUARD, 0, 210), null);
  assert.equal(aspectWarning(GUARD, 297, 0), null);
  assert.equal(aspectWarning(GUARD, undefined as any, undefined as any), null);
});

test('the real multi-page-pdf manifest warns on landscape but not portrait', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'tools/multi-page-pdf/tool.json'), 'utf8'));
  assert.ok(manifest.render.aspectWarning, 'manifest declares an aspect guard');
  // The removed A4-landscape size (297 × 210) is exactly what the guard should catch.
  assert.ok(aspectWarning(manifest, 297, 210));
  // Every remaining page-size preset is portrait, so none should trip the guard.
  const pageSize = manifest.inputs.find((i: any) => i.id === 'pageSize');
  assert.equal(pageSize.options.some((o: any) => o.value === 'a4l'), false, 'A4 landscape preset is gone');
  for (const o of pageSize.options) {
    assert.equal(aspectWarning(manifest, o.width, o.height), null, `${o.value} should not warn`);
  }
});

test('the real event-name-badge manifest wires its size select to export dims', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'tools/event-name-badge/tool.json'), 'utf8'));
  const d = exportSizeDriver(manifest)!;
  assert.equal(d.id, 'size');
  // A6 landscape must export 148 × 105 mm — the exact case the user flagged.
  assert.deepEqual(d.dims.a6land, { width: 148, height: 105, unit: 'mm' });
  // The default (4×6 in) maps to its mm trim size.
  assert.deepEqual(d.dims['4x6in'], { width: 101.6, height: 152.4, unit: 'mm' });
  // Every option carries dims.
  assert.equal(manifest.inputs.find((i: any) => i.id === 'size').options.every((o: any) => d.dims[o.value]), true);
});
