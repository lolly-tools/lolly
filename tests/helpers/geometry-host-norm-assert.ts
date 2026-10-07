// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import type { qualifyHostNorm } from './geometry-host-norm-qualification.ts';
export function assertHostNorm(report: ReturnType<typeof qualifyHostNorm>) {
  for (const row of report.fits) assert.deepEqual(row.actual, row.reference, row.name);
  for (const row of [...report.pairs.cases, ...report.pairs.workflows]) {
    assert.deepEqual(row.actual, row.reference, row.name); assert.deepEqual(row.actualCounts, row.referenceCounts, row.name);
  }
  for (const row of report.operations.workflows) for (const candidate of [row.clipping, row.combined]) {
    assert.deepEqual(candidate.result, row.reference.result, row.id); assert.deepEqual(candidate.counts, row.reference.counts, row.id);
  }
  for (const kernel of [report.operations.clipping!, report.operations.fitting!]) {
    assert.equal(kernel.results, 0); assert.equal(kernel.bufferBytes, 0); assert.ok(kernel.linearBytes <= 16 * 1024 * 1024); assert.ok(kernel.mathCalls.hypot! > 0);
  }
}
