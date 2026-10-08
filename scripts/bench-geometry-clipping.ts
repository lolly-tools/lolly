// SPDX-License-Identifier: MPL-2.0
/** Paired complete SVG workflows and immutable pair replay with retained complete clipping. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus, release } from 'node:os';
import { dirname } from 'node:path';
import type { Cubic } from '../engine/src/geom/bezier.ts';
import type { Intersection } from '../engine/src/geom/intersect.ts';
import type { GeometryClipLimits } from '../packages/node-shell/src/geometry-clipping.ts';
import { loadGeometryClipping } from '../packages/node-shell/src/geometry-clipping-node.ts';
import { createClipBackend } from '../tests/helpers/geometry-clip-backend.ts';
import type { ClipProbe } from '../tests/helpers/geometry-clip-control.ts';
import { loadClipComparison } from './lib/geometry-clip-comparison.ts';
const option = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const { module, code } = await loadClipComparison();
const start = performance.now(),
  kernel = await loadGeometryClipping(),
  loadMs = performance.now() - start;
const wasmFile = new URL(
    '../packages/node-shell/wasm/geometry-kernel/geometry-clip.wasm',
    import.meta.url
  ),
  wasmBytes = await readFile(wasmFile);
const sources = [
  'engine/src/geom-api.ts',
  ...['offset', 'offset-error', 'offset-source', 'fit', 'intersect', 'bezier'].map(
    (name) => 'engine/src/geom/' + name + '.ts'
  ),
];
const pilots = [
  'scripts/bench-geometry-clipping.ts',
  'scripts/build-geometry-kernel.ts',
  'scripts/lib/geometry-clip-comparison.ts',
  'tests/helpers/geometry-clip-backend.ts',
  'tests/helpers/geometry-clip-control.ts',
  'tests/helpers/geometry-clip-cases.ts',
  'tests/helpers/geometry-clip-qualification.ts',
  'tests/helpers/geometry-stage-workflows.ts',
  'tests/helpers/geometry-workflow-cases.ts',
  'packages/node-shell/src/geometry-clipping.ts',
  'packages/node-shell/src/geometry-clipping-node.ts',
  'packages/node-shell/wasm/geometry-kernel/rust-toolchain.toml',
  'packages/node-shell/wasm/geometry-kernel/Cargo.toml',
  ...[
    'lib',
    'nearest',
    'roots',
    'offset_error',
    'fit_cubic',
    'clip_abi',
    'clip_common',
    'clip_search',
    'clip_scan',
  ].map((name) => 'packages/node-shell/wasm/geometry-kernel/src/' + name + '.rs'),
];
async function hashes(files: string[]) {
  return Object.fromEntries(
    await Promise.all(
      files.map(async (file) => [
        file,
        hash(await readFile(new URL('../' + file, import.meta.url))),
      ])
    )
  );
}
const sourceHashes = await hashes(sources),
  pilotHashes = await hashes(pilots);
const samples = 31,
  warmups = 10,
  zero = Object.fromEntries(
    Object.keys(module.CLIP_COUNTS).map((key) => [key, 0])
  ) as typeof module.CLIP_COUNTS;
const workflows = module
  .geometryStageWorkflows()
  .filter((row) => !option('filter') || row.id.includes(option('filter')!));
if (!workflows.length) throw new Error('No matching geometry workflow.');
if (process.argv.includes('--reverse')) workflows.reverse();
function summary(values: number[]) {
  const sorted = values.slice().sort((a, b) => a - b);
  return {
    p50Ms: sorted[Math.ceil(values.length * 0.5) - 1]!,
    p95Ms: sorted[Math.ceil(values.length * 0.95) - 1]!,
    samples: values,
  };
}
function paired(runs: (() => unknown)[], expected: unknown) {
  for (let i = 0; i < warmups; i++) for (const run of runs) assert.deepEqual(run(), expected);
  const times: number[][] = [[], []];
  for (let i = 0; i < samples; i++)
    for (let j = 0; j < 2; j++) {
      const v = (i + j) % 2,
        start = performance.now(),
        actual = runs[v]!();
      times[v]!.push(performance.now() - start);
      assert.deepEqual(actual, expected);
      assert.equal(kernel.stats().results, 0);
      assert.equal(kernel.stats().hits, 0);
      assert.equal(kernel.stats().bufferBytes, 0);
    }
  return { typeScript: summary(times[0]!), retainedWasm: summary(times[1]!) };
}
const rows = [];
for (const row of workflows) {
  let backendStats: ReturnType<ReturnType<typeof createClipBackend>['stats']> | undefined;
  const execute = (wasm: boolean) => {
    const backend = wasm ? createClipBackend(kernel) : undefined;
    Object.assign(module.CLIP_COUNTS, zero);
    module.setClipProbe(backend?.intersect);
    try {
      const result = row.run();
      return { result, counts: { ...module.CLIP_COUNTS } };
    } finally {
      module.setClipProbe(undefined);
      if (backend) {
        backendStats = backend.stats();
        backend.dispose();
      }
    }
  };
  const expected = execute(false);
  if (!Array.isArray(expected.result)) assert.equal(expected.result.ok, true, row.id);
  const capture: {
    a: Cubic;
    b: Cubic;
    tol: number;
    limits: GeometryClipLimits;
    hits: Intersection[];
  }[] = [];
  const captureProbe: ClipProbe = (a, b, tol, limits) => {
    module.setClipProbe(undefined);
    try {
      const hits = module.intersectCubics(a, b, tol);
      capture.push({
        a: [...a],
        b: [...b],
        tol,
        limits: { ...limits },
        hits: structuredClone(hits),
      });
      return hits;
    } finally {
      module.setClipProbe(captureProbe);
    }
  };
  Object.assign(module.CLIP_COUNTS, zero);
  module.setClipProbe(captureProbe);
  try {
    assert.deepEqual({ result: row.run(), counts: { ...module.CLIP_COUNTS } }, expected, row.id);
  } finally {
    module.setClipProbe(undefined);
  }
  assert.deepEqual(execute(true), expected, row.id);
  const complete = paired([() => execute(false), () => execute(true)], expected);
  assert.equal(backendStats!.calls, capture.length);
  for (const r of capture)
    assert.deepEqual(
      {
        initial: module.CLIP_BUDGET.maxNodes,
        overrun: module.OVERRUN_BUDGET.maxNodes,
        stalled: module.SCAN_LIMITS.maxStalledPairs,
      },
      r.limits
    );
  const replay = (wasm: boolean) => {
    const backend = wasm ? createClipBackend(kernel) : undefined;
    Object.assign(module.CLIP_COUNTS, zero);
    try {
      const hits = capture.map((r) => {
        return backend
          ? backend.intersect(r.a, r.b, r.tol, r.limits, module.CLIP_COUNTS)
          : module.intersectCubics(r.a, r.b, r.tol);
      });
      return { hits, counts: { ...module.CLIP_COUNTS } };
    } finally {
      backend?.dispose();
    }
  };
  const replayExpected = replay(false);
  assert.deepEqual(
    replayExpected.hits,
    capture.map((r) => r.hits)
  );
  assert.deepEqual(replay(true), replayExpected);
  rows.push({
    id: row.id,
    kind: row.kind,
    source: row.source,
    inputSha256: hash(JSON.stringify(row.inputs)),
    outputSha256: hash(JSON.stringify(expected.result)),
    perOperation: expected.counts,
    operations: capture.length,
    captureSha256: hash(JSON.stringify(capture)),
    replaySha256: hash(JSON.stringify(replayExpected)),
    backend: backendStats,
    complete,
    replay: capture.length
      ? paired([() => replay(false), () => replay(true)], replayExpected)
      : null,
  });
  console.log(row.id);
}
assert.deepEqual(await hashes(sources), sourceHashes, 'Engine sources changed during the run.');
assert.deepEqual(await hashes(pilots), pilotHashes, 'Pilot sources changed during the run.');
assert.equal(hash(await readFile(wasmFile)), hash(wasmBytes), 'WASM changed during the run.');
const output = option('output') ?? 'plans/295-validation/geometry-clip-benchmark.json';
await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  JSON.stringify(
    {
      date: new Date().toISOString(),
      node: process.version,
      machine: {
        processor: cpus()[0]?.model,
        platform: process.platform,
        architecture: process.arch,
        release: release(),
      },
      wasm: { bytes: wasmBytes.length, sha256: hash(wasmBytes) },
      loadMs,
      bundleSha256: hash(code),
      sourceHashes,
      pilotHashes,
      warmups,
      samples,
      rows,
      afterDispose: kernel.stats(),
      note: 'One current-engine bundle substitutes the complete ordered pair operation, including exact lines, initial clipping, whole-pair overrun handoff and stalled-range scanning. Complete samples include fresh operation ownership, immutable controls/tolerance/budget transport, owned contact/counter decoding, handle release and workspace disposal. Outputs and every work counter must equal the unchanged TypeScript path. Both variants retain the same TypeScript fitting, joins, broad phase and serialization. Pair replay excludes those surrounding operations and includes workspace ownership and disposal. Capture and conformance are outside timing. Paired variants alternate order; all sources, bundle, module and request hashes are frozen. No activation, editor, native or cross-device performance claim.',
    },
    null,
    2
  ) + '\n'
);
console.log(
  JSON.stringify(
    rows.map((r) => ({
      id: r.id,
      tsMs: r.complete.typeScript.p50Ms,
      wasmMs: r.complete.retainedWasm.p50Ms,
      changePercent: (r.complete.retainedWasm.p50Ms / r.complete.typeScript.p50Ms - 1) * 100,
      operations: r.operations,
    })),
    null,
    2
  )
);
