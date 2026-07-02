// SPDX-License-Identifier: MPL-2.0
/**
 * Round-trip tests for the batch CSV (io.js) — focus on unit/DPI fidelity.
 * Run: node --test shells/web/src/pro/io.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batchToCsv, csvToBatch, type IoRow } from './io.ts';
import type { ToolManifest } from '@lolly/engine';

const MANIFEST: ToolManifest = {
  id: 'poster', name: 'Poster', version: '1.0.0', engineVersion: '1', status: 'official',
  render: { width: 100, height: 100, formats: ['png'] },
  inputs: [{ id: 'headline', type: 'text' }],
};
const getTool = async (id: string): Promise<{ manifest: ToolManifest }> => {
  if (id !== 'poster') throw new Error('unknown');
  return { manifest: MANIFEST };
};
let _uid = 0;
const makeRow = (): IoRow & { uid: string } => ({ uid: `r${++_uid}`, toolId: '', manifest: null, values: {} });

test('CSV round-trips per-row unit + DPI, dims and format', async () => {
  const rows: IoRow[] = [
    { toolId: 'poster', manifest: MANIFEST, values: { headline: 'Hi' }, outWidth: 100, outHeight: 75, unit: 'mm', dpi: 300, format: 'pdf' },
    { toolId: 'poster', manifest: MANIFEST, values: { headline: 'Yo' }, outWidth: 1080, outHeight: 1080 }, // inherits px default
  ];
  const csv = batchToCsv(rows, { unit: 'px', dpi: 300 });
  const head = csv.split('\n')[0] ?? '';
  assert.match(head, /\bunit\b/);
  assert.match(head, /\bdpi\b/);

  const { rows: out, errors } = await csvToBatch(csv, { getTool, makeRow });
  assert.equal(errors.length, 0);

  const [r0, r1] = out;
  assert.ok(r0);
  assert.ok(r1);

  assert.equal(r0.unit, 'mm');
  assert.equal(r0.dpi, 300);
  assert.equal(r0.outWidth, 100);
  assert.equal(r0.outHeight, 75);
  assert.equal(r0.format, 'pdf');
  assert.equal(r0.values.headline, 'Hi');

  // The inheriting row was written with the px default and no DPI; on import,
  // unit comes back 'px' and DPI stays unset (inherits again).
  assert.equal(r1.unit, 'px');
  assert.equal(r1.dpi, undefined);
});

test('physical dimensions keep decimals (parseFloat, not parseInt)', async () => {
  const rows: IoRow[] = [{ toolId: 'poster', manifest: MANIFEST, values: {}, outWidth: 215.9, outHeight: 279.4, unit: 'mm', dpi: 150 }];
  const { rows: out } = await csvToBatch(batchToCsv(rows, { unit: 'mm', dpi: 150 }), { getTool, makeRow });
  const [r0] = out;
  assert.ok(r0);
  assert.equal(r0.outWidth, 215.9);   // US Letter width in mm
  assert.equal(r0.outHeight, 279.4);
  assert.equal(r0.dpi, 150);
});

test('an invalid unit in CSV is ignored (falls back to inherit)', async () => {
  const csv = 'tool,unit,dpi\nposter,furlong,300\n';
  const { rows: out } = await csvToBatch(csv, { getTool, makeRow });
  const [r0] = out;
  assert.ok(r0);
  assert.equal(r0.unit, undefined); // junk unit dropped
});
