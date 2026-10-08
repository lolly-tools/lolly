// SPDX-License-Identifier: MPL-2.0
/** Paired whole workflows compare repeated curve bounds with once-per-verification preparation. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus, release } from 'node:os';
import { dirname } from 'node:path';
import { loadVerificationComparison } from './lib/geometry-verification-comparison.ts';

const loaded = await Promise.all([
  loadVerificationComparison(false),
  loadVerificationComparison(true),
]);
const sources = loaded.map(({ module }) => module);
const workflows = sources.map((module) => module.geometryStageWorkflows());
assert.deepEqual(
  workflows[0]!.map((row) => row.inputs),
  workflows[1]!.map((row) => row.inputs)
);
const option = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const source = await readFile(
  new URL('../engine/src/geom/offset-error.ts', import.meta.url),
  'utf8'
);
const samples = 31,
  warmups = 10;
function summary(values: number[]) {
  const sorted = values.slice().sort((a, b) => a - b);
  return {
    p50Ms: sorted[Math.ceil(samples * 0.5) - 1]!,
    p95Ms: sorted[Math.ceil(samples * 0.95) - 1]!,
    samples: values,
  };
}
const rows = [];
const order = Array.from({ length: workflows[0]!.length }, (_, i) => i);
if (process.argv.includes('--reverse')) order.reverse();
for (const index of order) {
  const original = workflows[0]![index]!,
    prepared = workflows[1]![index]!;
  assert.equal(original.id, prepared.id);
  if (option('filter') && !original.id.includes(option('filter')!)) continue;
  const run = [original.run, prepared.run];
  const expected = run[0]!();
  if (!Array.isArray(expected)) assert.equal(expected.ok, true, original.id);
  const diagnostics = sources.map((module, i) => {
    const before = { ...module.CLIP_COUNTS };
    assert.deepEqual(run[i]!(), expected);
    return Object.fromEntries(
      ['pairs', 'nodes', 'overruns', 'overrunNodes', 'ceilings'].map((key) => {
        const field = key as keyof typeof before;
        return [key, module.CLIP_COUNTS[field] - before[field]];
      })
    );
  });
  assert.deepEqual(diagnostics[0], diagnostics[1], original.id);
  for (let i = 0; i < warmups; i++) for (const fn of run) assert.deepEqual(fn(), expected);
  const times: number[][] = [[], []];
  for (let i = 0; i < samples; i++)
    for (let step = 0; step < 2; step++) {
      const backend = (i + step) % 2,
        start = performance.now(),
        result = run[backend]!();
      times[backend]!.push(performance.now() - start);
      assert.deepEqual(result, expected);
    }
  rows.push({
    id: original.id,
    kind: original.kind,
    source: original.source,
    inputSha256: hash(JSON.stringify(original.inputs)),
    outputSha256: hash(JSON.stringify(expected)),
    repeatedBounds: summary(times[0]!),
    preparedBounds: summary(times[1]!),
    perOperation: diagnostics[0],
  });
  console.log(original.id);
}
assert.ok(rows.length, 'A comparison must include a workflow.');
assert.equal(
  await readFile(new URL('../engine/src/geom/offset-error.ts', import.meta.url), 'utf8'),
  source
);
const output = option('output') ?? 'plans/295-validation/geometry-verification-benchmark.json';
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
      sourceSha256: hash(source),
      bundleHashes: loaded.map(({ code }) => hash(code)),
      warmups,
      samples,
      rows,
      note: 'Two same-source engine bundles differ only in the preparation of fitted-curve bounds during independent offset-error verification. Bounds and culling remain float64 with identical order; numerical solves, both error metrics, sample placement and budgets are unchanged. Warm paired complete operations alternate variant order. Assertions and clip diagnostics are outside timing. Preparation is inside each prepared operation. Pair/standalone-piece rows are labeled kernel-only; no Rust/backend change or editor/cross-device latency guarantee.',
    },
    null,
    2
  ) + '\n'
);
console.log(
  JSON.stringify(
    rows.map((row) => ({
      id: row.id,
      repeatedMs: row.repeatedBounds.p50Ms,
      preparedMs: row.preparedBounds.p50Ms,
      changePercent: (row.preparedBounds.p50Ms / row.repeatedBounds.p50Ms - 1) * 100,
    })),
    null,
    2
  )
);
