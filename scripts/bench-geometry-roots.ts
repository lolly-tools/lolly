// SPDX-License-Identifier: MPL-2.0
/** Same-engine workflow comparison and replay of its captured polynomial batches. */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus, release } from 'node:os';
import { createHash } from 'node:crypto';
import type { makeGeomApi } from '../engine/src/geom-api.ts';
import { toSvgPathData } from '../engine/src/geom/path.ts';
import { circleGrid, wigglePath } from '../tests/helpers/geometry-workflow-cases.ts';
import { referenceRoots } from '../tests/helpers/geometry-root-cases.ts';
import { loadGeometryKernel } from '../packages/node-shell/src/geometry-kernel-node.ts';
import {
  GEOMETRY_MAX_POLYNOMIALS,
  type GeometryPolynomial,
  type GeometryRoots,
} from '../packages/node-shell/src/geometry-kernel.ts';

type RootProbe = (a: number, b: number, c: number, d: number, dirs?: number[]) => number[];
const repo = fileURLToPath(new URL('../', import.meta.url));
const samples = 31,
  warmups = 10;
function summary(values: number[]) {
  const sorted = values.slice().sort((a, b) => a - b);
  return {
    p50Ms: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    samples: values,
  };
}
const compiled = await build({
  stdin: {
    contents:
      "export {makeGeomApi} from './engine/src/geom-api.ts'; export {setRootProbe} from 'geometry-root-benchmark:control';",
    resolveDir: repo,
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  plugins: [
    {
      name: 'root-comparison',
      setup(builder) {
        builder.onResolve({ filter: /^geometry-root-benchmark:control$/ }, () => ({
          path: 'control',
          namespace: 'root-benchmark',
        }));
        builder.onLoad({ filter: /.*/, namespace: 'root-benchmark' }, () => ({
          contents:
            'export let rootProbe; export function setRootProbe(probe) { rootProbe = probe; }',
        }));
        builder.onLoad({ filter: /engine\/src\/geom\/intersect\.ts$/ }, async (args) => {
          const source = await readFile(args.path, 'utf8');
          const marker =
            'export function cubicRoots01(a: number, b: number, c: number, d: number, dirs?: number[]): number[] {';
          assert.equal(source.split(marker).length, 2, 'exactly one existing solver entry');
          return {
            contents:
              "import {rootProbe} from 'geometry-root-benchmark:control';\n" +
              source.replace(
                marker,
                marker + '\nif (rootProbe) return rootProbe(a, b, c, d, dirs);'
              ),
            resolveDir: dirname(args.path),
            loader: 'ts',
          };
        });
      },
    },
  ],
});
const module = (await import(
  `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0]!.text).toString('base64')}`
)) as {
  makeGeomApi: typeof makeGeomApi;
  setRootProbe(probe: RootProbe | undefined): void;
};
const started = performance.now(),
  kernel = await loadGeometryKernel(),
  loadMs = performance.now() - started,
  scalar = kernel.createRootWorkspace(),
  batch = kernel.createRootWorkspace(),
  api = module.makeGeomApi();
const ds = [toSvgPathData(circleGrid(16), 12), toSvgPathData(circleGrid(16, 18, 12), 12)];
const wiggle = toSvgPathData(wigglePath(40), 12);
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
const scalarProbe: RootProbe = (a, b, c, d, dirs) => {
  const found = scalar.solve([[a, b, c, d]])[0]!;
  // The original early return for an all-zero polynomial leaves a supplied direction array alone.
  if (dirs && (a !== 0 || b !== 0 || c !== 0 || d !== 0)) {
    dirs.length = 0;
    for (const direction of found.directions) dirs.push(direction);
  }
  return found.roots;
};
const rows = [];
try {
  for (const workflow of workflows) {
    const coefficients: GeometryPolynomial[] = [];
    module.setRootProbe((a, b, c, d, dirs) => {
      assert.ok(coefficients.length < 262_144, 'bounded capture corpus');
      coefficients.push([a, b, c, d]);
      const found = referenceRoots([a, b, c, d]);
      if (dirs && (a !== 0 || b !== 0 || c !== 0 || d !== 0)) {
        dirs.length = 0;
        for (const direction of found.directions) dirs.push(direction);
      }
      return found.roots;
    });
    const expected = workflow.run();
    assert.equal(expected.ok, true);
    const chunks: GeometryPolynomial[][] = [];
    for (let i = 0; i < coefficients.length; i += GEOMETRY_MAX_POLYNOMIALS)
      chunks.push(coefficients.slice(i, i + GEOMETRY_MAX_POLYNOMIALS));
    const expectedRoots = coefficients.map(referenceRoots);
    const replay = () => chunks.flatMap((chunk) => batch.solve(chunk));
    const batchStarted = performance.now();
    const firstBatch = replay();
    const firstBatchMs = performance.now() - batchStarted;
    assert.deepEqual(firstBatch, expectedRoots);
    const runs = [
      () => {
        module.setRootProbe(undefined);
        return workflow.run();
      },
      () => {
        module.setRootProbe(scalarProbe);
        return workflow.run();
      },
    ];
    for (let i = 0; i < warmups; i++) for (const run of runs) assert.deepEqual(run(), expected);
    const times: number[][] = [[], []];
    for (let i = 0; i < samples; i++)
      for (let step = 0; step < 2; step++) {
        const index = (i + step) % 2,
          start = performance.now(),
          result = runs[index]!();
        times[index]!.push(performance.now() - start);
        assert.deepEqual(result, expected);
      }
    const replays = [() => coefficients.map(referenceRoots), replay];
    for (let i = 0; i < warmups; i++) for (const run of replays) run();
    const replayTimes: number[][] = [[], []];
    for (let i = 0; i < samples; i++)
      for (let step = 0; step < 2; step++) {
        const index = (i + step) % 2,
          start = performance.now(),
          result: GeometryRoots[] = replays[index]!();
        replayTimes[index]!.push(performance.now() - start);
        assert.deepEqual(result, expectedRoots);
      }
    rows.push({
      name: workflow.name,
      rootCalls: coefficients.length,
      batchSizes: chunks.map((chunk) => chunk.length),
      firstBatchMs,
      completeTypeScript: summary(times[0]!),
      completeScalarWasm: summary(times[1]!),
      capturedRootsTypeScript: summary(replayTimes[0]!),
      capturedRootsBatchWasm: summary(replayTimes[1]!),
      coefficientsSha256: createHash('sha256').update(JSON.stringify(coefficients)).digest('hex'),
      outputSha256: expected.ok ? createHash('sha256').update(expected.d).digest('hex') : null,
      retained: kernel.stats(),
    });
  }
} finally {
  module.setRootProbe(undefined);
  scalar.dispose();
  batch.dispose();
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
  note: 'One current-engine bundle has a benchmark-only solver hook. Paired complete SVG bridge runs alternate TypeScript solving and a scalar WASM adapter, with exact result assertions. Root batches replay coefficients captured from a separate identical workflow; replay includes input admission/copy and owned output decoding but excludes the rest of the operation. Capture and assertions are outside timed samples. Unequal-size final chunks resize buffers. No batch operation integration or live backend change is claimed. Local warm samples are not editor latency or cross-device guarantees.',
};
const output =
  process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ??
  'plans/295-validation/geometry-roots-benchmark.json';
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    rows.map((row) => ({
      name: row.name,
      roots: row.rootCalls,
      completeTsMs: row.completeTypeScript.p50Ms,
      completeScalarWasmMs: row.completeScalarWasm.p50Ms,
      capturedTsMs: row.capturedRootsTypeScript.p50Ms,
      capturedBatchWasmMs: row.capturedRootsBatchWasm.p50Ms,
    })),
    null,
    2
  )
);
