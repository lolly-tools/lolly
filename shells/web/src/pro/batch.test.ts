// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the batch PLANNER's row identity.
 * Run directly:  node --test --import ./tests/css-stub.mjs shells/web/src/pro/batch.test.ts
 *
 * `planBatch` compacts: `renderable[k]` is not `rows[k]`. Everything the runner emits
 * (BatchProgress.index, BatchResult.index, the zip's NN- prefix) is a position in the
 * COMPACTED array, so a number captured before the compaction names a different row
 * after it. These tests pin the two properties the rest of the code rests on - the
 * planner never clones, and it reports the mapping it destroys - and the one that must
 * never be assumed: a queue position is not a row.
 *
 * Lives next to the feature so the whole /pro module can be removed in one delete.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planBatch, type BatchRow } from './batch.ts';

/** Catalog-free deps: every tool resolves, everything is exportable. */
const deps = {
  getTool: async () => ({ manifest: {} }),
  isExportable: () => true,
};

const rowsOf = (...uids: Array<[string, string]>): BatchRow[] =>
  uids.map(([uid, toolId]) => ({ uid, toolId, values: {} }));

test('planBatch: renderable/skipped are unchanged when nothing is skipped', async () => {
  const rows = rowsOf(['r1', 'qr-code'], ['r2', 'qr-code']);
  const plan = await planBatch(rows, deps);
  assert.deepEqual(plan.renderable, rows);
  assert.equal(plan.renderable[0], rows[0]);       // same objects, same order
  assert.equal(plan.renderable[1], rows[1]);
  assert.deepEqual(plan.skipped, []);
  // …and the mapping is the identity, i.e. index == uid position: a run with zero
  // skipped rows cannot be affected by any of this.
  assert.deepEqual(plan.srcIndex, [0, 1]);
  assert.deepEqual(plan.findings, []);
});

test('planBatch: the worked example - 5 rows, r2 and r4 have no template', async () => {
  // The brief's case: grid row 5 becomes queue position 3, and today nothing anywhere
  // could tell the user which row "3" was.
  const rows = rowsOf(['r1', 'qr-code'], ['r2', ''], ['r3', 'qr-code'], ['r4', ''], ['r5', 'qr-code']);
  const plan = await planBatch(rows, {
    ...deps,
    // The findings channel: keyed by rowIndex into the array handed to the runner,
    // with uid beside it. `F` is opaque here on purpose - Phase 1's `Finding` slots in.
    check: (row, rowIndex, ctx) => [{ rowIndex, srcIndex: ctx.srcIndex, uid: row.uid }],
  });

  assert.deepEqual(plan.renderable.map(r => r.uid), ['r1', 'r3', 'r5']);
  assert.deepEqual(plan.srcIndex, [0, 2, 4]);
  assert.deepEqual(plan.skipped.map(s => s.srcIndex), [1, 3]);
  assert.deepEqual(plan.skipped.map(s => s.uid), ['r2', 'r4']);
  assert.deepEqual(plan.skipped.map(s => s.reason), ['No template selected', 'No template selected']);

  // The no-clone invariant everything else rests on: the row the runner renders IS the
  // grid's row object, so a caller can always recover the true row by identity/uid.
  assert.equal(plan.renderable[2], rows[4]);

  // The two numbers disagree BY DESIGN, and both are present: grid row 5 (srcIndex 4)
  // is queue position 2 (printed as "row 3"), and it is named 'r5'.
  const f = plan.findings.find(x => x.uid === 'r5')!;
  assert.equal(f.rowIndex, 2);
  assert.equal(f.items[0]!.srcIndex, 4);
  // A skipped row has NO queue position - it is nameable only by uid.
  const skippedFinding = plan.findings.find(x => x.uid === 'r4')!;
  assert.equal(skippedFinding.rowIndex, -1);
  assert.equal(skippedFinding.items[0]!.srcIndex, 3);
});

test('planBatch: a render-only / unloadable tool is skipped with its source position', async () => {
  const rows = rowsOf(['a', 'ok'], ['b', 'render-only'], ['c', 'boom'], ['d', 'ok']);
  const plan = await planBatch(rows, {
    getTool: async (id) => { if (id === 'boom') throw new Error('404'); return { manifest: { id } }; },
    isExportable: (m: { id: string }) => m.id !== 'render-only',
  });
  assert.deepEqual(plan.renderable.map(r => r.uid), ['a', 'd']);
  assert.deepEqual(plan.srcIndex, [0, 3]);
  assert.deepEqual(plan.skipped.map(s => [s.uid, s.srcIndex, s.reason]), [
    ['b', 1, 'Render-only tool'],
    ['c', 2, 'Failed to load template'],
  ]);
});

test('planBatch: rows with no uid still plan (identity is optional, the mapping is not)', async () => {
  const rows: BatchRow[] = [{ toolId: '', values: {} }, { toolId: 'qr-code', values: {} }];
  const plan = await planBatch(rows, deps);
  assert.deepEqual(plan.srcIndex, [1]);
  assert.equal(plan.skipped[0]!.srcIndex, 0);
  assert.equal(plan.skipped[0]!.uid, undefined);
});

test('runBatch: every emitted index is a QUEUE position, and the row rides with it', async () => {
  // The compacted array the runner is handed: grid rows r1/r3/r5 (r2, r4 were skipped).
  // With no DOM/catalog here every render fails, which is exactly the channel under
  // test: an 'error' event carries index/total (queue arithmetic) AND `row` (identity).
  // A consumer printing `index + 1` alone prints an unanchored number - the log line
  // for row `r5` would read "row 3" while the user is looking at grid row 5.
  const rows = rowsOf(['r1', 'qr-code'], ['r3', 'qr-code'], ['r5', 'qr-code']);
  const seen: Array<{ index: number; total: number; status: string; uid?: string }> = [];
  const { runBatch } = await import('./batch.ts');
  await runBatch(rows, {} as never, {
    onProgress: p => { seen.push({ index: p.index, total: p.total, status: p.status, uid: (p as { row?: BatchRow }).row?.uid }); },
  });
  const errors = seen.filter(p => p.status === 'error');
  assert.equal(errors.length, 3);
  assert.deepEqual(errors.map(p => p.index), [0, 1, 2]);
  assert.ok(errors.every(p => p.total === 3));
  assert.deepEqual(errors.map(p => p.uid), ['r1', 'r3', 'r5']);
  // The third failure is queue position 2 - and it is row 'r5', not row 3.
  assert.equal(errors[2]!.index, 2);
  assert.equal(errors[2]!.uid, 'r5');
});
