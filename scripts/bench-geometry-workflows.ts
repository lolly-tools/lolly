// SPDX-License-Identifier: MPL-2.0
/** Complete geometry workflows, with parse, prepared solve and serialization recorded separately. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { cpus, release } from 'node:os';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import type { Cubic } from '../engine/src/geom/bezier.ts';
import { type GeomPath, toSvgPathData } from '../engine/src/geom/path.ts';
import { unionPath, intersectPath, differencePath } from '../engine/src/geom/boolean.ts';
import { offsetPath } from '../engine/src/geom/offset.ts';
import { strokeToPath } from '../engine/src/geom/stroke.ts';
import { CLIP_COUNTS, intersectCubics } from '../engine/src/geom/intersect.ts';
import {
  circleGrid,
  wigglePath,
  intersectionPairs,
} from '../tests/helpers/geometry-workflow-cases.ts';

const samples = Number(process.argv.find((arg) => arg.startsWith('--samples='))?.slice(10) ?? 9);
if (!Number.isInteger(samples) || samples < 1 || samples > 51)
  throw new Error('Samples must be between 1 and 51.');
const filter = process.argv.find((arg) => arg.startsWith('--filter='))?.slice(9);
const api = makeGeomApi();
function summary(values: number[]) {
  const sorted = values.slice().sort((a, b) => a - b);
  return {
    p50Ms: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    samples: values,
  };
}
function measure<T>(run: () => T): { value: T; ms: number } {
  const start = performance.now(),
    value = run();
  return { value, ms: performance.now() - start };
}
const rows: object[] = [];
for (const pair of intersectionPairs()) {
  const name = `intersection: ${pair.name}`;
  if (filter && !name.includes(filter)) continue;
  intersectCubics(pair.a, pair.b);
  const expected = intersectCubics(pair.a, pair.b),
    times: number[] = [];
  const before = { ...CLIP_COUNTS };
  for (let i = 0; i < samples; i++) {
    const measured = measure(() => intersectCubics(pair.a, pair.b));
    times.push(measured.ms);
    assert.deepEqual(measured.value, expected);
  }
  rows.push({
    name,
    hits: expected.length,
    prepared: summary(times),
    clipNodes: CLIP_COUNTS.nodes - before.nodes,
    overrunNodes: CLIP_COUNTS.overrunNodes - before.overrunNodes,
    overruns: CLIP_COUNTS.overruns - before.overruns,
  });
}
interface Workflow {
  name: string;
  paths: GeomPath[];
  solve(paths: GeomPath[]): GeomPath;
  bridge(ds: string[]): ReturnType<typeof api.offset>;
}
const workflows: Workflow[] = [];
for (const count of [1, 16]) {
  const paths = [circleGrid(count), circleGrid(count, 18, 12)];
  for (const [name, solve, bridge] of [
    ['union', unionPath, api.union],
    ['intersection', intersectPath, api.intersect],
    ['difference', differencePath, api.difference],
  ] as const)
    workflows.push({
      name: `${name}: ${count} circle pairs`,
      paths,
      solve: ([a, b]) => solve(a!, b!),
      bridge: (ds) => bridge(ds, { decimals: 9 }),
    });
  const source = [circleGrid(count)];
  workflows.push({
    name: `offset: ${count} circles`,
    paths: source,
    solve: ([a]) => offsetPath(a!, 6, { join: 'round', tol: 0.01 }),
    bridge: (ds) => api.offset(ds[0]!, 6, { join: 'round', tolerance: 0.01, decimals: 9 }),
  });
}
for (const count of [10, 40])
  workflows.push({
    name: `stroke: ${count} cubic wiggle`,
    paths: [wigglePath(count)],
    solve: ([a]) => strokeToPath(a!, 12, { join: 'round', cap: 'round', tol: 0.01 }),
    bridge: (ds) =>
      api.stroke(ds[0]!, 12, { join: 'round', cap: 'round', tolerance: 0.01, decimals: 9 }),
  });
for (const workflow of workflows) {
  if (filter && !workflow.name.includes(filter)) continue;
  // Source serialization establishes the same controls on both sides of the comparison.
  const ds = workflow.paths.map((p) => toSvgPathData(p, 12));
  const parse = () =>
    ds.map((d) => {
      const admitted = api.parse(d);
      if (!admitted.ok) throw new Error(admitted.message);
      return admitted.value.map((c) => ({
        closed: c.closed,
        curves: c.curves.map((curve) => curve as Cubic),
      }));
    });
  const prepared = parse();
  const expected = toSvgPathData(workflow.solve(prepared), 9);
  const warm = workflow.bridge(ds);
  assert.equal(warm.ok, true);
  if (warm.ok) assert.equal(warm.d, expected);
  const parsed: number[] = [],
    solved: number[] = [],
    serialized: number[] = [],
    bridge: number[] = [];
  for (let i = 0; i < samples; i++) {
    const check = () => {
      const full = measure(() => workflow.bridge(ds));
      bridge.push(full.ms);
      assert.equal(full.value.ok, true);
      if (full.value.ok) assert.equal(full.value.d, expected);
    };
    if (i % 2) check();
    const p = measure(parse);
    parsed.push(p.ms);
    const s = measure(() => workflow.solve(prepared));
    solved.push(s.ms);
    const out = measure(() => toSvgPathData(s.value, 9));
    serialized.push(out.ms);
    assert.equal(out.value, expected);
    if (!(i % 2)) check();
  }
  const result = api.parse(expected);
  assert.equal(result.ok, true);
  rows.push({
    name: workflow.name,
    inputCurves: prepared.reduce((n, p) => n + p.reduce((v, c) => v + c.curves.length, 0), 0),
    outputCurves: result.ok ? result.value.reduce((n, c) => n + c.curves.length, 0) : null,
    outputSha256: createHash('sha256').update(expected).digest('hex'),
    input: ds,
    parse: summary(parsed),
    prepared: summary(solved),
    serialize: summary(serialized),
    bridge: summary(bridge),
  });
}
const report = {
  date: new Date().toISOString(),
  node: process.version,
  machine: {
    processor: cpus()[0]?.model,
    platform: process.platform,
    architecture: process.arch,
    release: release(),
  },
  rows,
  note: 'Warm local samples, alternating prepared versus complete SVG bridge order. Exact serialized results are asserted. Parse timing uses the public validation/lowering/copy API and includes conversion to the kernel shape, so it is an upper bound on internal parsing. Profiles must run separately from latency samples. Synthetic paths plus existing pathological regression pairs; no whole-editor or device guarantees.',
};
const output =
  process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ??
  'plans/295-validation/geometry-workflows.json';
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    rows.map((row) => {
      const r = row as { name: string; prepared: { p50Ms?: number }; bridge?: { p50Ms?: number } };
      return { name: r.name, solveP50Ms: r.prepared.p50Ms, bridgeP50Ms: r.bridge?.p50Ms };
    }),
    null,
    2
  )
);
