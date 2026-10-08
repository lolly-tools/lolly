// SPDX-License-Identifier: MPL-2.0
/** Paired complete SVG operations with retained WASM ray casts, including preparation/disposal. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { cpus, release } from 'node:os';
import { createHash } from 'node:crypto';
import { loadGeometryKernel } from '../packages/node-shell/src/geometry-kernel-node.ts';
import { createRayBackend } from '../tests/helpers/geometry-ray-backend.ts';
import { circleGrid, wigglePath } from '../tests/helpers/geometry-workflow-cases.ts';
import { toSvgPathData } from '../engine/src/geom/path.ts';
import { loadRayComparison } from './lib/geometry-ray-comparison.ts';

const module = await loadRayComparison(),
  api = module.makeGeomApi();
const started = performance.now(),
  kernel = await loadGeometryKernel(),
  loadMs = performance.now() - started;
const ds = [toSvgPathData(circleGrid(16), 12), toSvgPathData(circleGrid(16, 18, 12), 12)],
  wiggle = toSvgPathData(wigglePath(40), 12);
const workflows = [
  { name: 'union: 16 circle pairs', run: () => api.union(ds, { decimals: 9 }) },
  { name: 'intersection: 16 circle pairs', run: () => api.intersect(ds, { decimals: 9 }) },
  { name: 'difference: 16 circle pairs', run: () => api.difference(ds, { decimals: 9 }) },
  {
    name: 'offset: 16 circles',
    run: () => api.offset(ds[0]!, 6, { join: 'round', tolerance: 0.01, decimals: 9 }),
  },
  {
    name: 'stroke: 40 cubic wiggle',
    run: () =>
      api.stroke(wiggle, 12, { join: 'round', cap: 'round', tolerance: 0.01, decimals: 9 }),
  },
];
const warmups = 10,
  samples = 31;
function summary(values: number[]) {
  const sorted = values.slice().sort((a, b) => a - b);
  return {
    p50Ms: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    samples: values,
  };
}
const rows = [];
for (const workflow of workflows) {
  module.setRayProbe(undefined);
  const expected = workflow.run();
  assert.equal(expected.ok, true);
  const backendCounts: ReturnType<ReturnType<typeof createRayBackend>['stats']>[] = [];
  const execute = (wasm: boolean) => {
    const backend = wasm ? createRayBackend(kernel) : null;
    module.setRayProbe(backend?.cast);
    try {
      return workflow.run();
    } finally {
      module.setRayProbe(undefined);
      if (backend) {
        backendCounts.push(backend.stats());
        backend.dispose();
      }
    }
  };
  for (let i = 0; i < warmups; i++)
    for (const wasm of [false, true]) assert.deepEqual(execute(wasm), expected);
  const times: number[][] = [[], []];
  for (let i = 0; i < samples; i++)
    for (let step = 0; step < 2; step++) {
      const index = (i + step) % 2,
        start = performance.now(),
        result = execute(index === 1);
      times[index]!.push(performance.now() - start);
      assert.deepEqual(result, expected);
      assert.equal(kernel.stats().paths, 0);
      assert.equal(kernel.stats().bufferBytes, 0);
    }
  assert.ok(
    backendCounts.every(
      (row) =>
        row.calls === backendCounts[0]!.calls &&
        row.preparations === backendCounts[0]!.preparations &&
        row.evictions === backendCounts[0]!.evictions
    )
  );
  rows.push({
    name: workflow.name,
    typeScript: summary(times[0]!),
    retainedWasm: summary(times[1]!),
    backend: backendCounts[0],
    outputSha256: expected.ok ? createHash('sha256').update(expected.d).digest('hex') : null,
  });
}
const bytes = await readFile(
  new URL('../packages/node-shell/wasm/geometry-kernel/geometry-kernel.wasm', import.meta.url)
);
const report = {
  date: new Date().toISOString(),
  node: process.version,
  machine: {
    processor: cpus()[0]?.model,
    platform: process.platform,
    architecture: process.arch,
    release: release(),
  },
  wasm: { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') },
  loadMs,
  warmups,
  samples,
  rows,
  afterDispose: kernel.stats(),
  note: 'One current-engine bundle has a comparison-only whole-cast hook. Each complete SVG bridge sample creates a bounded per-operation immutable-index cache, imports controls/boxes at first use, prepares ray reach/norm and bundle inputs, performs all ordered cast classifications in WASM, returns four numbers and releases all resources. TS and WASM samples alternate order; exact result and ownership assertions are outside timing. The TypeScript engine still owns direction retries, overall budgets, fitting/clipping, output construction and serialization. No live backend activation or cross-device timing guarantee.',
};
const output =
  process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ??
  'plans/295-validation/geometry-ray-benchmark.json';
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    rows.map((row) => ({
      name: row.name,
      tsMs: row.typeScript.p50Ms,
      wasmMs: row.retainedWasm.p50Ms,
      backend: row.backend,
    })),
    null,
    2
  )
);
