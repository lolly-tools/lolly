// SPDX-License-Identifier: MPL-2.0
/** Paired complete SVG operations with retained adaptive offset verification and explicit ownership. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus, release } from 'node:os';
import { dirname } from 'node:path';
import type { Cubic } from '../engine/src/geom/bezier.ts';
import { offsetError } from '../engine/src/geom/offset-error.ts';
import { loadGeometryKernel } from '../packages/node-shell/src/geometry-kernel-node.ts';
import { createOffsetErrorBackend } from '../tests/helpers/geometry-offset-error-backend.ts';
import { loadOffsetErrorComparison } from './lib/geometry-offset-error-comparison.ts';

const option = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const { module, code } = await loadOffsetErrorComparison();
const start = performance.now(),
  kernel = await loadGeometryKernel(),
  loadMs = performance.now() - start;
const wasmFile = new URL(
  '../packages/node-shell/wasm/geometry-kernel/geometry-kernel.wasm',
  import.meta.url
);
const wasmBytes = await readFile(wasmFile);
const sourceFiles = [
  'geom-api.ts',
  ...['offset', 'offset-error', 'offset-source', 'fit', 'intersect', 'bezier'].map(
    (name) => `geom/${name}.ts`
  ),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    sourceFiles.map(async (file) => [
      file,
      hash(await readFile(new URL(`../engine/src/${file}`, import.meta.url))),
    ])
  )
);
const samples = 31,
  warmups = 10;
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
function counters() {
  const c = module.CLIP_COUNTS;
  return {
    pairs: c.pairs,
    clipNodes: c.nodes,
    overruns: c.overruns,
    overrunNodes: c.overrunNodes,
    ceilings: c.ceilings,
  };
}
function difference(before: ReturnType<typeof counters>) {
  return Object.fromEntries(
    Object.entries(counters()).map(([key, value]) => [
      key,
      value - before[key as keyof typeof before],
    ])
  );
}
function paired(run: (() => unknown)[], expected: unknown) {
  for (let i = 0; i < warmups; i++) for (const fn of run) assert.deepEqual(fn(), expected);
  const times: number[][] = [[], []];
  for (let i = 0; i < samples; i++)
    for (let step = 0; step < 2; step++) {
      const variant = (i + step) % 2,
        start = performance.now(),
        result = run[variant]!();
      times[variant]!.push(performance.now() - start);
      assert.deepEqual(result, expected);
      assert.equal(kernel.stats().bufferBytes, 0);
      assert.equal(kernel.stats().paths, 0);
    }
  return { typeScript: summary(times[0]!), retainedWasm: summary(times[1]!) };
}
const rows = [];
for (const row of workflows) {
  module.setOffsetErrorProbe(undefined);
  const expected = row.run();
  if (!Array.isArray(expected)) assert.equal(expected.ok, true, row.id);
  const capture: {
    src: Cubic;
    approx: Cubic[];
    distance: number;
    tol: number;
    expected: ReturnType<typeof offsetError>;
  }[] = [];
  module.setOffsetErrorProbe((src, approx, distance, tol) => {
    const expected = offsetError(src, approx, distance, tol);
    capture.push({ src: [...src], approx: approx.map((c) => [...c]), distance, tol, expected });
    return expected;
  });
  try {
    assert.deepEqual(row.run(), expected, row.id);
  } finally {
    module.setOffsetErrorProbe(undefined);
  }
  let backendStats: ReturnType<ReturnType<typeof createOffsetErrorBackend>['stats']> | undefined;
  const execute = (wasm: boolean) => {
    const backend = wasm ? createOffsetErrorBackend(kernel) : undefined;
    module.setOffsetErrorProbe(backend?.verify);
    try {
      return row.run();
    } finally {
      module.setOffsetErrorProbe(undefined);
      if (backend) {
        backendStats = backend.stats();
        backend.dispose();
      }
    }
  };
  const counts = [false, true].map((wasm) => {
    const before = counters();
    assert.deepEqual(execute(wasm), expected);
    return difference(before);
  });
  assert.deepEqual(counts[0], counts[1], row.id);
  const complete = paired([() => execute(false), () => execute(true)], expected);
  assert.equal(backendStats!.calls, capture.length);
  const replay = capture.length
    ? paired(
        [
          () => capture.map((r) => module.offsetError(r.src, r.approx, r.distance, r.tol)),
          () => {
            const workspace = kernel.createOffsetErrorWorkspace();
            try {
              return capture.map((r) => workspace.verify(r.src, r.approx, r.distance, r.tol));
            } finally {
              workspace.dispose();
            }
          },
        ],
        capture.map((r) => r.expected)
      )
    : null;
  rows.push({
    id: row.id,
    kind: row.kind,
    source: row.source,
    inputSha256: hash(JSON.stringify(row.inputs)),
    outputSha256: hash(JSON.stringify(expected)),
    complete,
    replay,
    verifications: capture.length,
    captureSha256: hash(JSON.stringify(capture)),
    backend: backendStats,
    perOperation: counts[0],
  });
  console.log(row.id);
}
for (const [file, h] of Object.entries(sourceHashes))
  assert.equal(
    hash(await readFile(new URL(`../engine/src/${file}`, import.meta.url))),
    h,
    `Source changed: ${file}`
  );
assert.equal(hash(await readFile(wasmFile)), hash(wasmBytes), 'WASM changed during the run.');
const output = option('output') ?? 'plans/295-validation/geometry-offset-error-benchmark.json';
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
      warmups,
      samples,
      rows,
      afterDispose: kernel.stats(),
      note: 'One current-engine bundle substitutes only the complete independent offset verifier. Complete samples include fresh per-operation workspace ownership, current controls/tight bounds prepared in JS, buffer reuse/resize, all source sampling/refinement/culling/projection in WASM, owned error/parameter decoding and disposal. Capture is outside timing. Replay includes the same verifier boundary and ownership but excludes other workflow stages. Paired variants alternate order; assertions and counters are outside timing. Fitting candidates, subdivision decisions, joins, clipping, serialization and limits remain TypeScript. No live activation, editor latency, native or cross-device performance claim.',
    },
    null,
    2
  ) + '\n'
);
console.log(
  JSON.stringify(
    rows.map((row) => ({
      id: row.id,
      tsMs: row.complete.typeScript.p50Ms,
      wasmMs: row.complete.retainedWasm.p50Ms,
      changePercent: (row.complete.retainedWasm.p50Ms / row.complete.typeScript.p50Ms - 1) * 100,
      verifications: row.verifications,
    })),
    null,
    2
  )
);
