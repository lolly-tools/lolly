// SPDX-License-Identifier: MPL-2.0
/**
 * The snapshot cost budget for automatic history (plan 277 P4, phase 0;
 * scripts/bench-revision-snapshot.ts): revisionSnapshot() costs at most 10 ms per
 * MiB of canonical JSON, with a 1 ms floor for the fixed cost of an async hash.
 *
 * The documents are checked on every run. The wall-clock budget runs with BENCH=1,
 * as the repo's other timing guards do, because a loaded CI machine is not a
 * measurement, and it holds the fastest of 25 runs for the same reason (medians
 * moved by half again between runs on a machine other work was using):
 *   BENCH=1 node --import ./tests/css-stub.mjs --test tests/revision-snapshot-bench.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLOOR_MS, MS_PER_MIB, benchDocuments, budgetMs, chartTable, measure, tiledDesignDocument } from '../scripts/bench-revision-snapshot.ts';

const PERF_SKIP = process.env.BENCH === '1' ? false : 'perf/timing guard - set BENCH=1 to run (wall-clock, flakes under load)';

test('the bench documents are what the plan asks for', async () => {
  const design = tiledDesignDocument(1000);
  const boxes = design.boxes as { id: string; text?: string }[];
  assert.equal(boxes.length, 1000);
  assert.equal(new Set(boxes.map(b => b.id)).size, 1000, 'every box has its own id');
  const texts = boxes.map(b => b.text).filter((t): t is string => typeof t === 'string');
  assert.ok(texts.length > 100 && new Set(texts).size > texts.length * 0.9, 'text varies, so deflate is not flattered by repeats');
  assert.equal(chartTable(200).split('\n').length, 201, 'a header and 200 rows');
  const docs = await benchDocuments({ local: false });
  assert.deepEqual(docs.map(d => d.name), [
    'Design, 1,000 boxes tiled from the templates', 'Chart with a 200-row table',
    'filter at defaults', 'deck-studio at defaults', 'darkroom at defaults', 'diagram-builder at defaults',
  ]);
  for (const doc of docs.slice(2)) assert.equal(doc.data.__toolId, doc.name.split(' ')[0]);
  assert.equal(budgetMs(0), FLOOR_MS);
  assert.equal(budgetMs(1_048_576), MS_PER_MIB);
  assert.equal(MS_PER_MIB, 10, 'the budget plan 277 P4 sets');
});

test('revisionSnapshot() stays within 10 ms per MiB of canonical JSON', { skip: PERF_SKIP, timeout: 120_000 }, async () => {
  for (const doc of await benchDocuments()) {
    const result = await measure(doc, { runs: 25, warmup: 5 });
    assert.ok(result.snapshotMinMs <= result.budgetMs,
      `${doc.name}: fastest ${result.snapshotMinMs.toFixed(2)} ms (median ${result.snapshotMs.toFixed(2)}) for ${(result.canonicalBytes / 1024).toFixed(1)} KB, budget ${result.budgetMs.toFixed(2)} ms`);
    // Plan 277 P4 phase 1: the whole draft write (one walk, stringify, hash) meets the same budget.
    assert.ok(result.draftMinMs <= result.budgetMs,
      `${doc.name}: draft write fastest ${result.draftMinMs.toFixed(2)} ms (median ${result.draftMs.toFixed(2)}), budget ${result.budgetMs.toFixed(2)} ms`);
  }
});
