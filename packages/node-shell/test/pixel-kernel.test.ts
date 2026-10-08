// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyLutFrame } from '../../../engine/src/grade.ts';
import { gradeLutWasm, pixelKernel } from '../src/pixel-kernel.ts';
import { admitLutJob } from '../src/pixel-kernel-contract.ts';
import { lutCases, lutTable } from '../../../tests/helpers/lut-cases.ts';

test('Rust/WASM LUT reference matches established bytes and releases operation allocations', async () => {
  for (const row of lutCases()) {
    const original = row.pixels.slice();
    const expected = original.slice(); applyLutFrame(expected, row.lut, row.intensity);
    assert.deepEqual(await gradeLutWasm(row.pixels, row.lut, row.intensity), expected, row.name);
    assert.deepEqual(row.pixels, original, `${row.name}: input stays owned by the caller`);
    assert.equal((await pixelKernel()).lolly_allocated_bytes(), 0, row.name);
  }
});

test('LUT admission refuses malformed buffers, non-finite samples and unsupported domains', async () => {
  const pixels = new Uint8ClampedArray([1, 2, 3, 4]);
  const lut = lutTable();
  assert.throws(() => admitLutJob(pixels.subarray(0, 3), lut, 1), /RGBA8/);
  assert.throws(() => admitLutJob(pixels, { ...lut, size: 130 }, 1), /grid/);
  assert.throws(() => admitLutJob(pixels, { ...lut, data: new Float32Array(1) }, 1), /buffer/);
  assert.throws(() => admitLutJob(pixels, lut, NaN), /finite/);
  assert.throws(() => admitLutJob(pixels, { ...lut, domainMin: [1, 0, 0], domainMax: [1 + 1e-12, 1, 1] }, 1), /too narrow/);
  const invalid = lutTable(); invalid.data[0] = Infinity;
  await assert.rejects(gradeLutWasm(pixels, invalid), /unsupported sample/);
  assert.deepEqual(pixels, new Uint8ClampedArray([1, 2, 3, 4]));
  assert.equal((await pixelKernel()).lolly_allocated_bytes(), 0);
});

test('Rust byte ABI rejects unknown allocation handles and oversized allocation requests', async () => {
  const api = await pixelKernel();
  assert.equal(api.lolly_alloc(33 * 1024 * 1024), 0);
  assert.equal(api.lolly_grade_lut(0, 0, 1, 2, 1, 0, 0, 0, 1, 1, 1), 1);
  api.lolly_free(0);
  assert.equal(api.lolly_allocated_bytes(), 0);
});
