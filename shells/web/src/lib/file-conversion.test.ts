// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_IMAGE_OPTIONS, conversionFindings, conversionReport, resizedDimensions, validateConvertFiles } from './file-conversion.ts';

test('image resizing preserves proportions, never enlarges, and bounds allocations', () => {
  assert.deepEqual(resizedDimensions(4000, 2000, 1920), { width: 1920, height: 960 });
  assert.deepEqual(resizedDimensions(640, 480, 1920), { width: 640, height: 480 });
  assert.deepEqual(resizedDimensions(640, 480), { width: 640, height: 480 });
  for (const [w, h, edge] of [[0, 1, 0], [Infinity, 1, 0], [10000, 10000, 1], [10, 10, -1], [10, 10, 1.5]]) assert.throws(() => resizedDimensions(w!, h!, edge!));
});

test('conversion intake caps batches before reading bytes', () => {
  validateConvertFiles([{ size: 1024 }]);
  assert.throws(() => validateConvertFiles(Array.from({ length: 21 }, () => ({ size: 1 }))), /20 files/);
  assert.throws(() => validateConvertFiles([{ size: 129 * 1024 * 1024 }]), /128 MB/);
  assert.throws(() => validateConvertFiles(Array.from({ length: 3 }, () => ({ size: 100 * 1024 * 1024 }))), /256 MB/);
});

test('receipts expose exact-byte identities and meaningful fidelity warnings', () => {
  const report = conversionReport({ name: 'original.png', format: 'png', mime: 'image/png', size: 100, width: 40, height: 20, sha256: 'a'.repeat(64) },
    { name: 'copy.jpg', format: 'jpeg', mime: 'image/jpeg', size: 80, width: 20, height: 10, sha256: 'b'.repeat(64) }, 'raster', DEFAULT_IMAGE_OPTIONS);
  assert.equal(report.version, 1);
  assert.equal(report.execution, 'device');
  assert.equal(report.metadata, 'removed');
  assert.equal(report.inputs[0]!.sha256, 'a'.repeat(64));
  assert.ok(report.findings.some(f => f.code === 'alpha-flattened'));
  assert.ok(report.changes.includes('40 × 20 → 20 × 10 pixels'));
  assert.ok(conversionFindings('svg', 'png').some(f => f.code === 'vector-rasterized'));
  assert.ok(conversionFindings('pdf', 'md').some(f => f.code === 'text-layer-only'));
  assert.ok(conversionFindings('xlsx', 'csv').some(f => f.code === 'values-only'));
});
