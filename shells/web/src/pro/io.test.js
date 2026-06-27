// SPDX-License-Identifier: MPL-2.0
/**
 * Round-trip tests for the batch CSV (io.js) — focus on unit/DPI fidelity.
 * Run: node --test shells/web/src/pro/io.test.js
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { batchToCsv, csvToBatch } from './io.js';

const MANIFEST = { id: 'poster', name: 'Poster', inputs: [{ id: 'headline', type: 'text' }] };
const getTool = async (id) => { if (id !== 'poster') throw new Error('unknown'); return { manifest: MANIFEST }; };
let _uid = 0;
const makeRow = () => ({ uid: `r${++_uid}`, toolId: '', manifest: null, values: {} });

test('CSV round-trips per-row unit + DPI, dims and format', async () => {
  const rows = [
    { toolId: 'poster', manifest: MANIFEST, values: { headline: 'Hi' }, outWidth: 100, outHeight: 75, unit: 'mm', dpi: 300, format: 'pdf' },
    { toolId: 'poster', manifest: MANIFEST, values: { headline: 'Yo' }, outWidth: 1080, outHeight: 1080 }, // inherits px default
  ];
  const csv = batchToCsv(rows, { unit: 'px', dpi: 300 });
  assert.match(csv.split('\n')[0], /\bunit\b/);
  assert.match(csv.split('\n')[0], /\bdpi\b/);

  const { rows: out, errors } = await csvToBatch(csv, { getTool, makeRow });
  assert.equal(errors.length, 0);

  assert.equal(out[0].unit, 'mm');
  assert.equal(out[0].dpi, 300);
  assert.equal(out[0].outWidth, 100);
  assert.equal(out[0].outHeight, 75);
  assert.equal(out[0].format, 'pdf');
  assert.equal(out[0].values.headline, 'Hi');

  // The inheriting row was written with the px default and no DPI; on import,
  // unit comes back 'px' and DPI stays unset (inherits again).
  assert.equal(out[1].unit, 'px');
  assert.equal(out[1].dpi, undefined);
});

test('physical dimensions keep decimals (parseFloat, not parseInt)', async () => {
  const rows = [{ toolId: 'poster', manifest: MANIFEST, values: {}, outWidth: 215.9, outHeight: 279.4, unit: 'mm', dpi: 150 }];
  const { rows: out } = await csvToBatch(batchToCsv(rows, { unit: 'mm', dpi: 150 }), { getTool, makeRow });
  assert.equal(out[0].outWidth, 215.9);   // US Letter width in mm
  assert.equal(out[0].outHeight, 279.4);
  assert.equal(out[0].dpi, 150);
});

test('an invalid unit in CSV is ignored (falls back to inherit)', async () => {
  const csv = 'tool,unit,dpi\nposter,furlong,300\n';
  const { rows: out } = await csvToBatch(csv, { getTool, makeRow });
  assert.equal(out[0].unit, undefined); // junk unit dropped
});
