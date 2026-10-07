// SPDX-License-Identifier: MPL-2.0
/** Paired portable nearest-query measurements; warm solve and preparation/parse costs stay distinct. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { cpus, release } from 'node:os';
import { loadGeometryKernel } from '@lolly-tools/node-shell/geometry-kernel-node';
import { nearestOnCubic, type Cubic } from '../engine/src/geom/bezier.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { geometryCurves, geometryPathData } from '../tests/helpers/geometry-kernel-cases.ts';

function nearestTs(curves: readonly Cubic[], x: number, y: number) {
  let index = 0,
    best = nearestOnCubic(curves[0]!, x, y);
  for (let i = 1; i < curves.length; i++) {
    const found = nearestOnCubic(curves[i]!, x, y);
    if (found.distance < best.distance) {
      index = i;
      best = found;
    }
  }
  return { curve: index, ...best };
}
function summary(samples: number[]) {
  const sorted = samples.slice().sort((a, b) => a - b);
  return {
    p50Ms: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
    samples,
  };
}
const start = performance.now();
const kernel = await loadGeometryKernel();
const loadMs = performance.now() - start;
const api = makeGeomApi();
const workloads = [];
for (const count of [8, 128, 1024, 4096]) {
  const curves = geometryCurves(count),
    d = geometryPathData(curves);
  const prepareStarted = performance.now();
  const prepared = kernel.prepare(curves);
  const prepareMs = performance.now() - prepareStarted;
  const ts: number[] = [],
    wasm: number[] = [],
    svg: number[] = [];
  try {
    // Warm both kernels before alternating paired queries; retain raw samples rather than asserting timing.
    for (let run = 0; run < 5; run++) {
      nearestTs(curves, 11, 17);
      prepared.nearest(11, 17);
      api.nearest(d, 11, 17);
    }
    for (let run = 0; run < 31; run++) {
      const x = 11 + run * 17,
        y = 17 + run * 13;
      let reference: ReturnType<typeof nearestTs> | undefined,
        actual: ReturnType<typeof prepared.nearest> | undefined;
      const referenceRun = () => {
        const start = performance.now();
        reference = nearestTs(curves, x, y);
        ts.push(performance.now() - start);
      };
      const wasmRun = () => {
        const start = performance.now();
        actual = prepared.nearest(x, y);
        wasm.push(performance.now() - start);
      };
      if (run % 2) {
        referenceRun();
        wasmRun();
      } else {
        wasmRun();
        referenceRun();
      }
      assert.deepEqual(actual, reference, `prepared ${count}-curve query ${run}`);
      const start = performance.now();
      const bridge = api.nearest(d, x, y);
      svg.push(performance.now() - start);
      assert.equal(bridge.ok, true, `SVG workload ${count}: ${JSON.stringify(bridge)}`);
      if (bridge.ok)
        assert.deepEqual(bridge.value, {
          x: actual!.point.x,
          y: actual!.point.y,
          t: actual!.t,
          distance: actual!.distance,
          contour: actual!.curve,
          curve: 0,
        });
    }
    workloads.push({
      curves: count,
      chars: d.length,
      prepareMs,
      preparedTypeScript: summary(ts),
      preparedWasm: summary(wasm),
      svgBridge: summary(svg),
      retained: kernel.stats(),
    });
  } finally {
    prepared.dispose();
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
  loadMs,
  workloads,
  afterDispose: kernel.stats(),
  note: '31 local paired warm queries per workload after five warmups, alternating order. Prepared TS/WASM queries share controls and exact-result assertions. SVG bridge is the current implementation; compare geometry-baseline.json for its pre-cache cost. WASM path preparation and module loading are recorded separately. This pilot does not replace live callers; local timings are not release guarantees.',
};
const output =
  process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ??
  'plans/295-validation/geometry-benchmark.json';
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      loadMs,
      workloads: workloads.map((row) => ({
        curves: row.curves,
        prepareMs: row.prepareMs,
        tsP50Ms: row.preparedTypeScript.p50Ms,
        wasmP50Ms: row.preparedWasm.p50Ms,
        svgP50Ms: row.svgBridge.p50Ms,
      })),
      afterDispose: kernel.stats(),
    },
    null,
    2
  )
);
