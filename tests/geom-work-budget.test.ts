// SPDX-License-Identifier: MPL-2.0
/**
 * The two work ceilings in engine/src/geom/intersect.ts, and the answer each gives.
 *
 * Neither of the two searches in that file bounds its own recursion, and each has inputs that
 * run away in it. The clip search runs away on a shape against a near-copy of itself; the
 * overrun search runs away on a curve against a reparametrised piece of itself. So there are
 * two ceilings, and this file pins one input of each kind: the work stops at a stated number
 * of nodes, and what comes back is a defined answer rather than a partial one or a throw.
 *
 * Node counts are exact and deterministic, so those are what is asserted. The times in the
 * comments are what this machine measured, and are there to say what the ceilings are worth;
 * the only timing the tests themselves assert is a ceiling generous enough that a loaded
 * machine cannot trip it and tight enough that an unbounded search would.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { type Cubic, subCubic } from '../engine/src/geom/bezier.ts';
import { CLIP_BUDGET, CLIP_COUNTS, OVERRUN_BUDGET, intersectCubics } from '../engine/src/geom/intersect.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';

const geom = makeGeomApi();

test('the two ceilings are the numbers the file documents', () => {
  // Pinned so that moving either is a deliberate edit with its own measurement, not a
  // side effect. The head of intersect.ts carries the distributions both came from.
  assert.equal(CLIP_BUDGET.maxNodes, 16384);
  assert.equal(OVERRUN_BUDGET.maxNodes, 131072);
});

test('an ordinary pair never reaches the overrun search', () => {
  // Two quarter-arcs of circles, mirrored, crossing once. The clip search converges in ten
  // nodes, so none of the overrun search's per-node cost is paid for work like this.
  const a: Cubic = [0, 0, 55.23, 0, 100, 44.77, 100, 100];
  const b: Cubic = [100, 0, 44.77, 0, 0, 44.77, 0, 100];
  const before = CLIP_COUNTS.overruns;
  const hits = intersectCubics(a, b, 1e-9);
  assert.equal(CLIP_COUNTS.overruns, before, 'an ordinary pair escalated');
  assert.ok(CLIP_COUNTS.lastNodes < 200, `${CLIP_COUNTS.lastNodes} nodes for an ordinary pair`);
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.ok(Math.abs(hits[0]!.t1 - 0.32979505) < 1e-6 && Math.abs(hits[0]!.t2 - 0.32979505) < 1e-6, JSON.stringify(hits));
});

test('the clip search cannot run away: a pair it cannot separate stops at the budget', () => {
  // The heaviest pair of tests/fuzz/regressions/geom-repeated-coincident-cs-pairs.bin, the
  // 185-byte path the weekly fuzz soak found. The two curves share their start and agree to
  // third order past it. The clip search spends 256 ms on it and reports ten points spread
  // over the stretch where they agree; under the budget it stops one node past 16,384 and
  // the overrun search answers with the one contact, the shared start vertex. 16 ms.
  const c1: Cubic = [20, 20, 20, 30, 30, 40, 40, 4];
  const c2: Cubic = [20, 20, 20, 30, 30, 40, 40, 40];
  const before = CLIP_COUNTS.overruns;
  const t = performance.now();
  const hits = intersectCubics(c1, c2, 1e-9);
  const ms = performance.now() - t;
  assert.equal(CLIP_COUNTS.overruns, before + 1, 'the pair did not escalate');
  assert.equal(CLIP_COUNTS.lastNodes, CLIP_BUDGET.maxNodes + 1, 'the clip search ran past its budget');
  assert.ok(ms < 2000, `${ms.toFixed(0)}ms`);
  assert.equal(hits.length, 1, JSON.stringify(hits));
  assert.ok(Math.abs(hits[0]!.t1) < 1e-6 && Math.abs(hits[0]!.t2) < 1e-6, JSON.stringify(hits));
  assert.ok(Math.hypot(hits[0]!.x - 20, hits[0]!.y - 20) < 1e-9, JSON.stringify(hits));
});

test('the reproducer path that prompted the budget is answered, whole', () => {
  // The same path, through the operations a boolean does. Every pair of it stops at the
  // budget or under it, so no single pair can cost more than about 10 ms of clip search
  // whatever the path. The four operations take 57 to 108 ms here, against about a second
  // each for the clip search alone.
  const d = readFileSync(new URL('./fuzz/regressions/geom-repeated-coincident-cs-pairs.bin', import.meta.url), 'utf8');
  for (const [name, run] of [
    ['selfUnion', () => geom.selfUnion(d, { decimals: 12 })],
    ['stroke', () => geom.stroke(d, 2, { join: 'round', cap: 'round', decimals: 12 })],
    ['union', () => geom.union([d, 'M0 0 L40 0 L40 40 Z'], { decimals: 12 })],
  ] as const) {
    const before = CLIP_COUNTS.overruns;
    const t = performance.now();
    const r = run() as { ok: boolean; d?: string; code?: string };
    const ms = performance.now() - t;
    assert.ok(r.ok, `${name}: ${r.code}`);
    assert.ok((r.d ?? '').length > 0, `${name} came back empty`);
    assert.ok(CLIP_COUNTS.overruns > before, `${name}: no pair escalated, so this is not the case it was chosen for`);
    assert.ok(ms < 5000, `${name}: ${ms.toFixed(0)}ms`);
  }
});

test('the overrun search cannot run away either: a reparametrised copy stops at its ceiling', () => {
  // Two overlapping pieces of ONE cubic 30,000 units long, cut at [0, 0.7] and [0.3, 1]: the
  // same trace at different parameters, which `twinNode` cannot see and `sharedRun` stops
  // catching at this size. With no ceiling the overrun search spends 28,235,256 nodes and 47
  // seconds on it. At the ceiling it spends 131,072 and about 140 ms, and the answer does not
  // change: the two ends of the shared run, at (0.4286, 0) and (1, 0.5714). The committed
  // clip search answers this pair in 58 ms with 31 points scattered along the run.
  const L = 30000;
  const base: Cubic = [0, 0, 1.5 * L, L, -0.5 * L, L, L, 0];
  const c1 = [...subCubic(base, 0, 0.7)] as Cubic;
  const c2 = [...subCubic(base, 0.3, 1)].map((v) => +v.toPrecision(17)) as Cubic;
  const ceilings = CLIP_COUNTS.ceilings;
  const t = performance.now();
  const hits = intersectCubics(c1, c2, 1e-9);
  const ms = performance.now() - t;
  assert.equal(CLIP_COUNTS.ceilings, ceilings + 1, 'the overrun search did not reach its ceiling');
  assert.equal(CLIP_COUNTS.lastOverrunNodes, OVERRUN_BUDGET.maxNodes, 'the overrun search ran past its ceiling');
  assert.ok(ms < 10000, `${ms.toFixed(0)}ms`);
  assert.equal(hits.length, 2, JSON.stringify(hits));
  assert.ok(Math.abs(hits[0]!.t1 - 3 / 7) < 1e-4 && Math.abs(hits[0]!.t2) < 1e-4, JSON.stringify(hits));
  assert.ok(Math.abs(hits[1]!.t1 - 1) < 1e-4 && Math.abs(hits[1]!.t2 - 4 / 7) < 1e-4, JSON.stringify(hits));
});

test('the ceiling costs the reparametrised pair time, not its answer', () => {
  // The same pair at four ceilings, including one well past what it wants. The parameters
  // come back identical every time: what the ceiling removes is search of a stretch that had
  // already been decided, not a contact.
  const L = 30000;
  const base: Cubic = [0, 0, 1.5 * L, L, -0.5 * L, L, L, 0];
  const c1 = [...subCubic(base, 0, 0.7)] as Cubic;
  const c2 = [...subCubic(base, 0.3, 1)].map((v) => +v.toPrecision(17)) as Cubic;
  const was = OVERRUN_BUDGET.maxNodes;
  try {
    let first: string | null = null;
    for (const cap of [32768, 65536, 131072, 262144]) {
      OVERRUN_BUDGET.maxNodes = cap;
      const key = JSON.stringify(intersectCubics(c1, c2, 1e-9).map((h) => [+h.t1.toPrecision(10), +h.t2.toPrecision(10)]));
      if (first === null) first = key; else assert.equal(key, first, `ceiling ${cap} changed the answer`);
    }
  } finally {
    OVERRUN_BUDGET.maxNodes = was;
  }
});

test('lowering the clip budget to zero routes every pair to the overrun search', () => {
  // The documented test hook: `CLIP_BUDGET` is exported mutable so a test can show what the
  // other search answers. Several of the round 5 cases in the other geom files use it.
  const a: Cubic = [0, 0, 55.23, 0, 100, 44.77, 100, 100];
  const b: Cubic = [100, 0, 44.77, 0, 0, 44.77, 0, 100];
  const was = CLIP_BUDGET.maxNodes;
  try {
    CLIP_BUDGET.maxNodes = 0;
    const before = CLIP_COUNTS.overruns;
    const hits = intersectCubics(a, b, 1e-9);
    assert.equal(CLIP_COUNTS.overruns, before + 1);
    // The same crossing, to the same ten digits, found the other way.
    assert.equal(hits.length, 1, JSON.stringify(hits));
    assert.ok(Math.abs(hits[0]!.t1 - 0.32979505) < 1e-6, JSON.stringify(hits));
  } finally {
    CLIP_BUDGET.maxNodes = was;
  }
});
