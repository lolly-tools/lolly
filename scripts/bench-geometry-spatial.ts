// SPDX-License-Identifier: MPL-2.0
/** Paired historical/current workflow comparison plus the bounded WASM proximity pilot. */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus, release } from 'node:os';
import { createHash } from 'node:crypto';
import type { makeGeomApi } from '../engine/src/geom-api.ts';
import { toSvgPathData } from '../engine/src/geom/path.ts';
import { visitNearPieces } from '../engine/src/geom/near-pieces.ts';
import { referenceNearPairs, spatialCases } from '../tests/helpers/geometry-spatial-cases.ts';
import { circleGrid, wigglePath } from '../tests/helpers/geometry-workflow-cases.ts';
import { loadGeometryKernel } from '../packages/node-shell/src/geometry-kernel-node.ts';

const repo = fileURLToPath(new URL('../', import.meta.url));
const samples = 31,
  warmups = 15;
function summary(values: number[]) {
  const sorted = values.slice().sort((a, b) => a - b);
  return {
    p50Ms: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    samples: values,
  };
}
async function loadApi(historical: boolean): Promise<ReturnType<typeof makeGeomApi>> {
  // Both variants compile the current engine. The historical variant substitutes only the spatial traversal.
  const compiled = await build({
    stdin: { contents: "export {makeGeomApi} from './engine/src/geom-api.ts';", resolveDir: repo },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    plugins: historical
      ? [
          {
            name: 'historical-spatial',
            setup(builder) {
              builder.onLoad({ filter: /engine\/src\/geom\/near-pieces\.ts$/ }, () => ({
                contents:
                  "export {referenceVisitNearPieces as visitNearPieces} from './tests/helpers/geometry-spatial-cases.ts';",
                resolveDir: repo,
              }));
            },
          },
        ]
      : [],
  });
  const code = Buffer.from(compiled.outputFiles[0]!.text).toString('base64');
  const module = (await import(`data:text/javascript;base64,${code}`)) as {
    makeGeomApi: typeof makeGeomApi;
  };
  return module.makeGeomApi();
}
const spatialOnly = process.argv.includes('--spatial-only');
const historical = spatialOnly ? null : await loadApi(true),
  current = spatialOnly ? null : await loadApi(false);
const ds = [toSvgPathData(circleGrid(16), 12), toSvgPathData(circleGrid(16, 18, 12), 12)];
const circles = ds[0]!,
  wiggle = toSvgPathData(wigglePath(40), 12);
const workflows: {
  name: string;
  run(api: ReturnType<typeof makeGeomApi>): ReturnType<ReturnType<typeof makeGeomApi>['union']>;
}[] = [
  { name: 'union: 16 circle pairs', run: (api) => api.union(ds, { decimals: 9 }) },
  { name: 'intersection: 16 circle pairs', run: (api) => api.intersect(ds, { decimals: 9 }) },
  { name: 'difference: 16 circle pairs', run: (api) => api.difference(ds, { decimals: 9 }) },
  {
    name: 'offset: 16 circles',
    run: (api) => api.offset(circles, 6, { join: 'round', tolerance: 0.01, decimals: 9 }),
  },
  {
    name: 'stroke: 40 cubic wiggle',
    run: (api) =>
      api.stroke(wiggle, 12, { join: 'round', cap: 'round', tolerance: 0.01, decimals: 9 }),
  },
];
const workflowRows = spatialOnly
  ? []
  : workflows.map((row) => {
      assert.ok(historical && current);
      for (let i = 0; i < warmups; i++) {
        row.run(historical);
        row.run(current);
      }
      const expected = row.run(historical);
      assert.equal(expected.ok, true);
      const old: number[] = [],
        numeric: number[] = [];
      for (let i = 0; i < samples; i++) {
        const run = (api: ReturnType<typeof makeGeomApi>, times: number[]) => {
          const start = performance.now(),
            result = row.run(api);
          times.push(performance.now() - start);
          assert.deepEqual(result, expected);
        };
        if (i % 2) {
          run(historical, old);
          run(current, numeric);
        } else {
          run(current, numeric);
          run(historical, old);
        }
      }
      return {
        name: row.name,
        historical: summary(old),
        numeric: summary(numeric),
        outputSha256: expected.ok ? createHash('sha256').update(expected.d).digest('hex') : null,
      };
    });
const kernel = await loadGeometryKernel();
const spatialRows = [];
for (const row of spatialCases().filter((row) =>
  ['random reversed near copies', 'circle grid', 'wiggle'].includes(row.name)
)) {
  const started = performance.now(),
    path = kernel.prepare(row.curves),
    prepareMs = performance.now() - started;
  const numericPairs = () => {
    const pairs: [number, number][] = [];
    visitNearPieces(row.curves, row.weld, (i, j) => {
      pairs.push([i, j]);
      return true;
    });
    return pairs;
  };
  try {
    const runs = [
      () => referenceNearPairs(row.curves, row.weld),
      numericPairs,
      () => path.nearPairs(row.weld),
    ];
    const expected = runs[0]!();
    for (let i = 0; i < warmups; i++) for (const run of runs) run();
    const times: number[][] = [[], [], []];
    for (let i = 0; i < samples; i++)
      for (let step = 0; step < 3; step++) {
        const index = (i + step) % 3,
          start = performance.now(),
          result = runs[index]!();
        times[index]!.push(performance.now() - start);
        assert.deepEqual(result, expected);
      }
    spatialRows.push({
      name: row.name,
      curves: row.curves.length,
      pairs: expected.length,
      prepareMs,
      historical: summary(times[0]!),
      numeric: summary(times[1]!),
      wasm: summary(times[2]!),
    });
  } finally {
    path.dispose();
  }
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
  warmups,
  samples,
  workflowRows,
  spatialRows,
  afterDispose: kernel.stats(),
  note: 'Complete SVG bridge comparisons compile identical current engine sources, substituting only the historical spatial traversal in one variant. Warm paired samples alternate order and assert exact result objects. Separate proximity comparisons include output collection and WASM result decoding but exclude preparation, which is recorded separately. Local synthetic workloads; no timing gates or whole-editor guarantees. WASM remains a pilot, with its own admission ceilings.',
};
const output =
  process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ??
  'plans/295-validation/geometry-spatial-benchmark.json';
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      workflowRows: workflowRows.map((row) => ({
        name: row.name,
        before: row.historical.p50Ms,
        after: row.numeric.p50Ms,
      })),
      spatialRows: spatialRows.map((row) => ({
        name: row.name,
        string: row.historical.p50Ms,
        numeric: row.numeric.p50Ms,
        wasm: row.wasm.p50Ms,
      })),
    },
    null,
    2
  )
);
