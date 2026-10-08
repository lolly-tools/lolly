// SPDX-License-Identifier: MPL-2.0
/** Paired complete SVG operations with retained complete adaptive offset fitting and explicit ownership. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus, release } from 'node:os';
import { dirname } from 'node:path';
import type { Cubic } from '../engine/src/geom/bezier.ts';
import type { GeometryOffsetPiece } from '../packages/node-shell/src/geometry-fitting.ts';
import { loadGeometryFitting } from '../packages/node-shell/src/geometry-fitting-node.ts';
import { createOffsetFitBackend } from '../tests/helpers/geometry-offset-fit-backend.ts';
import {
  fittingCompatibility,
  pieceBits,
} from '../tests/helpers/geometry-portable-fit-compatibility.ts';
import { loadOffsetFitComparison } from './lib/geometry-offset-fit-comparison.ts';

const option = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const portable = process.argv.includes('--portable-math');
const { module, code } = await loadOffsetFitComparison();
const start = performance.now(),
  kernel = await loadGeometryFitting(),
  loadMs = performance.now() - start;
const wasmFile = new URL(
  '../packages/node-shell/wasm/geometry-kernel/geometry-fit-portable.wasm',
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
const pilotFiles = [
  'packages/node-shell/src/geometry-fitting.ts',
  'packages/node-shell/src/geometry-fitting-node.ts',
  'tests/helpers/geometry-offset-fit-backend.ts',
  'tests/helpers/geometry-offset-fit-control.ts',
  'scripts/lib/geometry-offset-fit-comparison.ts',
  'scripts/build-geometry-kernel.ts',
  'tests/helpers/geometry-portable-fit-compatibility.ts',
  'tests/helpers/geometry-portable-math-cases.ts',
  'packages/node-shell/wasm/geometry-kernel/rust-toolchain.toml',
  ...[
    'lib',
    'nearest',
    'roots',
    'offset_error',
    'fit_math',
    'fit_cubic',
    'offset_features',
    'fit_candidates',
    'fit_metric',
    'offset_fit',
    'fit_abi',
  ].map((name) => 'packages/node-shell/wasm/geometry-kernel/src/' + name + '.rs'),
  'packages/node-shell/wasm/geometry-kernel/Cargo.toml',
];
const pilotHashes = Object.fromEntries(
  await Promise.all(
    pilotFiles.map(async (file) => [
      file,
      hash(await readFile(new URL('../' + file, import.meta.url))),
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
function paired(run: (() => unknown)[], expected: unknown, retainedExpected: unknown = expected) {
  const answers = [expected, retainedExpected];
  for (let i = 0; i < warmups; i++)
    for (let variant = 0; variant < run.length; variant++)
      assert.deepEqual(run[variant]!(), answers[variant]);
  const times: number[][] = [[], []];
  for (let i = 0; i < samples; i++)
    for (let step = 0; step < 2; step++) {
      const variant = (i + step) % 2,
        start = performance.now(),
        result = run[variant]!();
      times[variant]!.push(performance.now() - start);
      assert.deepEqual(result, answers[variant]);
      assert.equal(kernel.stats().bufferBytes, 0);
      assert.equal(kernel.stats().results, 0);
      assert.equal(kernel.stats().pieces, 0);
    }
  return { typeScript: summary(times[0]!), retainedWasm: summary(times[1]!) };
}
const rows = [];
for (const row of workflows) {
  module.setOffsetFitProbe(undefined);
  const expected = row.run();
  if (!Array.isArray(expected)) assert.equal(expected.ok, true, row.id);
  const capture: {
    src: Cubic;
    distance: number;
    tol: number;
    expected: GeometryOffsetPiece[];
  }[] = [];
  const captureProbe = (src: Cubic, distance: number, tol: number) => {
    module.setOffsetFitProbe(undefined);
    try {
      const expected = module.offsetPieces(src, distance, tol);
      // Later join welding can mutate returned controls; replay owns the pre-join snapshot.
      capture.push({ src: [...src], distance, tol, expected: structuredClone(expected) });
      return expected;
    } finally {
      module.setOffsetFitProbe(captureProbe);
    }
  };
  module.setOffsetFitProbe(captureProbe);
  try {
    assert.deepEqual(row.run(), expected, row.id);
  } finally {
    module.setOffsetFitProbe(undefined);
  }
  let backendStats: ReturnType<ReturnType<typeof createOffsetFitBackend>['stats']> | undefined;
  const execute = (wasm: boolean) => {
    const backend = wasm ? createOffsetFitBackend(kernel) : undefined;
    module.setOffsetFitProbe(backend?.fit);
    try {
      return row.run();
    } finally {
      module.setOffsetFitProbe(undefined);
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
  const replayWorkspace = kernel.createOffsetFitWorkspace();
  let retainedReplay: GeometryOffsetPiece[][];
  try {
    retainedReplay = capture.map((r) => replayWorkspace.fit(r.src, r.distance, r.tol));
  } finally {
    replayWorkspace.dispose();
  }
  const legacyReplay = capture.map((r) => r.expected);
  if (!portable) assert.deepEqual(retainedReplay, legacyReplay);
  const replayDifferences = fittingCompatibility(
    capture.map((r, i) => ({
      name: String(i),
      actual: retainedReplay[i]!,
      reference: r.expected,
    }))
  ).map(({ canonicalBits, referenceBits, ...r }) => ({
    ...r,
    canonicalSha256: hash(JSON.stringify(canonicalBits)),
    referenceSha256: hash(JSON.stringify(referenceBits)),
  }));
  const replay = capture.length
    ? paired(
        [
          () => capture.map((r) => module.offsetPieces(r.src, r.distance, r.tol)),
          () => {
            const workspace = kernel.createOffsetFitWorkspace();
            try {
              return capture.map((r) => workspace.fit(r.src, r.distance, r.tol));
            } finally {
              workspace.dispose();
            }
          },
        ],
        legacyReplay,
        retainedReplay
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
    operations: capture.length,
    captureSha256: hash(JSON.stringify(capture)),
    retainedReplaySha256: hash(JSON.stringify(retainedReplay.map(pieceBits))),
    replayDifferences,
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
for (const [file, h] of Object.entries(pilotHashes))
  assert.equal(
    hash(await readFile(new URL('../' + file, import.meta.url))),
    h,
    'Pilot changed: ' + file
  );
assert.equal(hash(await readFile(wasmFile)), hash(wasmBytes), 'WASM changed during the run.');
const output =
  option('output') ??
  `plans/295-validation/geometry-${portable ? 'portable' : 'offset'}-fit-benchmark.json`;
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
      mathBackend: kernel.stats().mathBackend,
      loadMs,
      bundleSha256: hash(code),
      sourceHashes,
      pilotHashes,
      warmups,
      samples,
      rows,
      afterDispose: kernel.stats(),
      note: 'One current-engine bundle substitutes the complete offset-pieces operation. Complete samples include fresh per-operation workspace ownership, source/distance/tolerance transport, source features, both error metrics, subdivision, owned controls/directions, result release and disposal. Complete Node workflow outputs and clipping counters must remain exactly equal to the unchanged TypeScript reference. Capture and maths census are outside timing. Replay excludes joins, clipping and serialization; each variant is checked exactly against its own untimed owned answer, with all legacy control differences recorded separately. Host mode additionally requires exact legacy replay equality. Portable mode has no host maths calls and is not legacy-compatible across all qualified hosts. Both variants alternate order. Engine source, generic callback API, budgets, joins, clipping and live selection remain unchanged. No activation, editor latency, native or cross-device performance claim.',
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
      operations: row.operations,
    })),
    null,
    2
  )
);
