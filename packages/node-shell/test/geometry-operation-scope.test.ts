// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test as nodeTest } from 'node:test';
import { makeGeomApi } from '../../../engine/src/geom-api.ts';
import { CLIP_BUDGET, CLIP_COUNTS, intersectCubics, OVERRUN_BUDGET, SCAN_LIMITS } from '../../../engine/src/geom/intersect.ts';
import { GeometryOperationError, intersectWithOperations } from '../../../engine/src/geom/operations.ts';
import { loadGeometryClipping as loadClipping } from '../src/geometry-clipping-node.ts';
import { loadGeometryFitting as loadFitting } from '../src/geometry-fitting-node.ts';
import { createGeometryOperationScope } from '../src/geometry-operation-scope.ts';
import { GeometryKernelError } from '../src/geometry-kernel-contract.ts';
import { qualifyGeometryOperations } from '../../../tests/helpers/geometry-operation-qualification.ts';
import type { Cubic } from '../../../engine/src/geom/bezier.ts';

for (const mathBackend of ['retained', 'host-norm'] as const) {
const test = (name: string, fn: () => void | Promise<void>) => nodeTest(`${mathBackend}: ${name}`, fn);
const loadGeometryClipping = () => loadClipping(mathBackend);
const loadGeometryFitting = (math: 'host' | 'portable' = 'host') => loadFitting(math === 'host' && mathBackend === 'host-norm' ? 'host-norm' : math);
const a: Cubic = [0, 0, 30, 100, 70, -100, 100, 0], b: Cubic = [0, 10, 30, -100, 70, 100, 100, 10];
test('operation owners are independent, return fresh contacts and release only their own buffers', async () => {
  const kernel = await loadGeometryClipping(), first = createGeometryOperationScope({ clipping: kernel }), second = createGeometryOperationScope({ clipping: kernel });
  try {
    const expected = intersectCubics(a, b), got = intersectWithOperations(a, b, undefined, first.operations);
    assert.deepEqual(got, expected); got[0]!.x = 999;
    assert.deepEqual(intersectWithOperations(a, b, undefined, second.operations), expected);
    const occupied = kernel.stats().bufferBytes; assert.ok(occupied > 0);
    first.dispose(); first.dispose(); assert.ok(kernel.stats().bufferBytes > 0); assert.ok(kernel.stats().bufferBytes < occupied);
    assert.throws(() => intersectWithOperations(a, b, undefined, first.operations), GeometryOperationError);
    assert.deepEqual(intersectWithOperations(a, b, undefined, second.operations), expected);
  } finally { first.dispose(); second.dispose(); }
  assert.equal(kernel.stats().bufferBytes, 0); assert.equal(kernel.stats().results, 0);
});
test('selected kernel refusal is visible and atomic and the same owner recovers without a fallback', async () => {
  const kernel = await loadGeometryClipping(); let refuse = true;
  const owner = createGeometryOperationScope({ clipping: { ...kernel, createClipWorkspace: () => {
    const workspace = kernel.createClipWorkspace(); return { ...workspace, intersect: (...args) => {
      if (refuse) throw new GeometryKernelError('limit', 'Deliberate workspace refusal.'); return workspace.intersect(...args);
    } };
  } } });
  const api = makeGeomApi(owner.operations), before = { ...CLIP_COUNTS };
  try {
    assert.deepEqual(api.union(['M0 0H100V100H0Z', 'M50 -10H80V150H50Z']), { ok: false, code: 'limit', message: 'geom: Deliberate workspace refusal.' });
    assert.deepEqual(CLIP_COUNTS, before); refuse = false;
    assert.deepEqual(api.union(['M0 0H100V100H0Z', 'M50 -10H80V150H50Z']), makeGeomApi().union(['M0 0H100V100H0Z', 'M50 -10H80V150H50Z']));
    owner.dispose(); assert.equal(api.union(['M0 0H100V100H0Z', 'M50 -10H80V150H50Z']).ok, false);
    assert.equal(makeGeomApi().union(['M0 0H100V100H0Z', 'M50 -10H80V150H50Z']).ok, true);
  } finally { owner.dispose(); }
  assert.equal(kernel.stats().bufferBytes, 0);
});
test('engine admission runs before numerical dependencies and captures their identity at construction', () => {
  let calls = 0;
  const dependencies = { clipping: () => { calls++; throw Error('Selected original dependency.'); } }, api = makeGeomApi(dependencies);
  dependencies.clipping = () => { throw Error('Replaced dependency.'); };
  assert.equal(api.union(['garbage']).ok, false); assert.equal(api.offset('M0 0H10V10Z', NaN).ok, false); assert.equal(calls, 0);
  const result = api.union(['M0 0H100V100H0Z', 'M50 -10H80V150H50Z']);
  assert.equal(result.ok, false); if (!result.ok) assert.match(result.message, /Selected original/); assert.ok(calls > 0);
});
test('clipping and combined host fitting retain every complete result and work counter through the real boundary', async () => {
  const clipping = await loadGeometryClipping(), fitting = await loadGeometryFitting(), report = qualifyGeometryOperations({ clipping, fitting });
  for (const row of report.workflows) for (const candidate of [row.clipping, row.combined]) {
    assert.deepEqual(candidate.result, row.reference.result, row.id); assert.deepEqual(candidate.counts, row.reference.counts, row.id);
  }
  assert.ok(report.workflows.some(row => row.combined.owner.clipCalls > 0 && row.combined.owner.fitCalls > 0));
  assert.equal(report.clipping!.bufferBytes, 0); assert.equal(report.clipping!.results, 0);
  assert.equal(report.fitting!.bufferBytes, 0); assert.equal(report.fitting!.results, 0);
});
test('all boolean facade methods dispatch within the supplied owner', async () => {
  const kernel = await loadGeometryClipping(), owner = createGeometryOperationScope({ clipping: kernel });
  const api = makeGeomApi(owner.operations), reference = makeGeomApi(), operands = ['M0 0H100V100H0Z', 'M50 -10H80V150H50Z'];
  try {
    for (const method of ['union', 'intersect', 'difference', 'xor'] as const) assert.deepEqual(api[method](operands), reference[method](operands), method);
    assert.deepEqual(api.selfUnion(operands.join(' ')), reference.selfUnion(operands.join(' ')));
    assert.ok(owner.stats().clipCalls > 0);
  } finally { owner.dispose(); }
  assert.equal(kernel.stats().bufferBytes, 0);
});
test('scoped clipping honors current zero budgets and preserves early-path last counters', async () => {
  const kernel = await loadGeometryClipping(), owner = createGeometryOperationScope({ clipping: kernel });
  const controls = [CLIP_BUDGET.maxNodes, OVERRUN_BUDGET.maxNodes, SCAN_LIMITS.maxStalledPairs], originalCounts = { ...CLIP_COUNTS };
  try {
    CLIP_BUDGET.maxNodes = 0; OVERRUN_BUDGET.maxNodes = 0; SCAN_LIMITS.maxStalledPairs = 0;
    const before = { ...CLIP_COUNTS, lastNodes: 123, lastOverrunNodes: 456, maxOverrunNodes: 789 };
    for (const [first, second] of [[a, b], [[0, 0, 0, 0, 10, 0, 10, 0] as Cubic, [5, -5, 5, -5, 5, 5, 5, 5] as Cubic]]) {
      Object.assign(CLIP_COUNTS, before); const expected = intersectCubics(first!, second!), expectedCounts = { ...CLIP_COUNTS };
      Object.assign(CLIP_COUNTS, before); assert.deepEqual(intersectWithOperations(first!, second!, undefined, owner.operations), expected);
      assert.deepEqual(CLIP_COUNTS, expectedCounts);
    }
  } finally { [CLIP_BUDGET.maxNodes, OVERRUN_BUDGET.maxNodes, SCAN_LIMITS.maxStalledPairs] = controls as [number, number, number]; Object.assign(CLIP_COUNTS, originalCounts); owner.dispose(); }
  assert.equal(kernel.stats().bufferBytes, 0);
});

}
