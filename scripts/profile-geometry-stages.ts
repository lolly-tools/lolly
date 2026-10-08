// SPDX-License-Identifier: MPL-2.0
/** Separate warmed bridge latency and bounded fitting/clipping CPU profiles on current source. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Session } from 'node:inspector/promises';
import { cpus, release } from 'node:os';
import { join } from 'node:path';
import { CLIP_BUDGET, CLIP_COUNTS, OVERRUN_BUDGET } from '../engine/src/geom/intersect.ts';
import { geometryStageWorkflows } from '../tests/helpers/geometry-stage-workflows.ts';
import { summarizeGeometryProfile } from './lib/geometry-profile-summary.ts';

const option = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const mode = option('mode') ?? 'latency';
if (mode !== 'latency' && mode !== 'profile') throw new Error('Mode must be latency or profile.');
function integer(name: string, fallback: number, min: number, max: number) {
  const value = Number(option(name) ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`${name} must be between ${min} and ${max}.`);
  return value;
}
const samples = integer('samples', 31, 1, 51),
  warmups = integer('warmups', 10, 1, 30);
const durationMs = integer('duration-ms', 1200, 250, 5000);
const intervalUs = integer('interval-us', 1000, 250, 2000);
const output = option('output-dir') ?? 'plans/295-validation/geometry-stages';
const workflows = geometryStageWorkflows().filter(
  (row) => !option('filter') || row.id.includes(option('filter')!)
);
if (!workflows.length) throw new Error('No workflow matches the filter.');
if (process.argv.includes('--reverse')) workflows.reverse();
await mkdir(output, { recursive: true });
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const files = [
  'geom-api.ts',
  ...[
    'bezier',
    'boolean',
    'fit',
    'intersect',
    'near-pieces',
    'offset',
    'offset-error',
    'offset-source',
    'path',
    'ray-cast',
    'stroke',
  ].map((name) => `geom/${name}.ts`),
];
const sourceHashes = Object.fromEntries(
  await Promise.all(
    files.map(async (file) => [
      file,
      hash(await readFile(new URL(`../engine/src/${file}`, import.meta.url), 'utf8')),
    ])
  )
);
const recipeHashes = Object.fromEntries(
  await Promise.all(
    [
      'scripts/profile-geometry-stages.ts',
      'scripts/lib/geometry-profile-summary.ts',
      'tests/helpers/geometry-stage-workflows.ts',
      'tests/helpers/geometry-workflow-cases.ts',
    ].map(async (file) => [
      file,
      hash(await readFile(new URL(`../${file}`, import.meta.url), 'utf8')),
    ])
  )
);
const limits = { clip: CLIP_BUDGET.maxNodes, overrun: OVERRUN_BUDGET.maxNodes };
function counts() {
  return {
    pairs: CLIP_COUNTS.pairs,
    clipNodes: CLIP_COUNTS.nodes,
    overruns: CLIP_COUNTS.overruns,
    overrunNodes: CLIP_COUNTS.overrunNodes,
    ceilings: CLIP_COUNTS.ceilings,
  };
}
function delta(before: ReturnType<typeof counts>, iterations: number) {
  return Object.fromEntries(
    Object.entries(counts()).map(([key, value]) => [
      key,
      (value - before[key as keyof typeof before]) / iterations,
    ])
  );
}
const rows = [];
for (const workflow of workflows) {
  const expected = workflow.run();
  if (!Array.isArray(expected)) assert.equal(expected.ok, true, workflow.id);
  for (let i = 0; i < warmups; i++) assert.deepEqual(workflow.run(), expected);
  const before = counts();
  if (mode === 'latency') {
    const times: number[] = [];
    for (let i = 0; i < samples; i++) {
      const start = performance.now(),
        result = workflow.run();
      times.push(performance.now() - start);
      assert.deepEqual(result, expected);
    }
    const sorted = times.slice().sort((a, b) => a - b);
    rows.push({
      id: workflow.id,
      kind: workflow.kind,
      source: workflow.source,
      inputs: workflow.inputs,
      inputSha256: hash(JSON.stringify(workflow.inputs)),
      outputSha256: hash(JSON.stringify(expected)),
      outputBytes: Buffer.byteLength(JSON.stringify(expected)),
      p50Ms: sorted[Math.ceil(samples * 0.5) - 1],
      p95Ms: sorted[Math.ceil(samples * 0.95) - 1],
      samples: times,
      perOperation: delta(before, samples),
    });
  } else {
    const session = new Session();
    session.connect();
    try {
      await session.post('Profiler.enable');
      await session.post('Profiler.setSamplingInterval', { interval: intervalUs });
      await session.post('Profiler.start');
      const start = performance.now();
      let iterations = 0;
      let result: ReturnType<typeof workflow.run> = expected;
      do {
        result = workflow.run();
        iterations++;
      } while (performance.now() - start < durationMs);
      const { profile } = await session.post('Profiler.stop');
      assert.deepEqual(result, expected);
      const raw = JSON.stringify(profile),
        profileFile = `${workflow.id}.cpuprofile`;
      await writeFile(join(output, profileFile), raw);
      rows.push({
        id: workflow.id,
        kind: workflow.kind,
        source: workflow.source,
        inputSha256: hash(JSON.stringify(workflow.inputs)),
        outputSha256: hash(JSON.stringify(expected)),
        iterations,
        profileFile,
        profileBytes: Buffer.byteLength(raw),
        profileSha256: hash(raw),
        perOperation: delta(before, iterations),
        cpu: summarizeGeometryProfile(profile),
      });
    } finally {
      session.disconnect();
    }
  }
  assert.deepEqual({ clip: CLIP_BUDGET.maxNodes, overrun: OVERRUN_BUDGET.maxNodes }, limits);
  console.log(`${mode}: ${workflow.id}`);
}
for (const file of files)
  assert.equal(
    hash(await readFile(new URL(`../engine/src/${file}`, import.meta.url), 'utf8')),
    sourceHashes[file],
    `Geometry source changed during the ${mode} run: ${file}.`
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
  mode,
  warmups,
  samples: mode === 'latency' ? samples : undefined,
  durationMs: mode === 'profile' ? durationMs : undefined,
  intervalUs: mode === 'profile' ? intervalUs : undefined,
  sourceHashes,
  recipeHashes,
  limits,
  rows,
  note: 'Live TypeScript engine, unchanged algorithms/ceilings. Complete SVG bridges include admission, parsing, solve and serialization; piece and pair rows are labeled kernel-only. Inputs are synthetic and existing regressions, not an editor-session capture. Latency and CPU profiles run in separate invocations. Assertions, hashing and file writes are outside operation timings and outside CPU capture. Profiles exclude imports and warmups. Repeated results and final profiled result agree exactly.',
};
await writeFile(join(output, `${mode}.json`), JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    rows.map((row) => ({
      id: row.id,
      ...('p50Ms' in row ? { p50Ms: row.p50Ms, p95Ms: row.p95Ms } : { scopes: row.cpu.scopes }),
    })),
    null,
    2
  )
);
