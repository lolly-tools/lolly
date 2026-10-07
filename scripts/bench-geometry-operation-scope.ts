// SPDX-License-Identifier: MPL-2.0
/** Paired full operations measure the actual dependency boundary and scoped ownership. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { cpus, release } from 'node:os';
import { dirname } from 'node:path';
import { CLIP_COUNTS } from '../engine/src/geom/intersect.ts';
import { loadGeometryClipping } from '../packages/node-shell/src/geometry-clipping-node.ts';
import { loadGeometryFitting } from '../packages/node-shell/src/geometry-fitting-node.ts';
import { createGeometryOperationScope } from '../packages/node-shell/src/geometry-operation-scope.ts';
import { createGeometryHost } from '../packages/node-shell/src/geometry-host.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { geometryStageWorkflows } from '../tests/helpers/geometry-stage-workflows.ts';

const option = (name: string) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const hostNorm = process.argv.includes('--host-norm');
const begin = performance.now(), clipping = await loadGeometryClipping(hostNorm ? 'host-norm' : 'retained'), clipLoadMs = performance.now() - begin;
const fitBegin = performance.now(), fitting = await loadGeometryFitting(hostNorm ? 'host-norm' : 'host'), fitLoadMs = performance.now() - fitBegin;
const sources = ['engine/src/geom-api.ts', ...['boolean', 'offset', 'offset-error', 'offset-source', 'fit', 'intersect', 'operations', 'stroke', 'bezier'].map(name => `engine/src/geom/${name}.ts`),
  'packages/node-shell/src/geometry-operation-scope.ts', 'packages/node-shell/src/geometry-host.ts', 'packages/node-shell/src/geometry-clipping.ts', 'packages/node-shell/src/geometry-fitting.ts',
  'scripts/bench-geometry-operation-scope.ts', 'tests/helpers/geometry-stage-workflows.ts', 'tests/helpers/geometry-workflow-cases.ts'];
const sourceHashes = Object.fromEntries(await Promise.all(sources.map(async file => [file, hash(await readFile(new URL('../' + file, import.meta.url)))])));
const artifactHashes = Object.fromEntries(await Promise.all(['clip', 'fit'].map(async name => [name, hash(await readFile(new URL(`../packages/node-shell/wasm/geometry-kernel/geometry-${name}${hostNorm ? '-host-norm' : ''}.wasm`, import.meta.url)))])));
const zero = Object.fromEntries(Object.keys(CLIP_COUNTS).map(key => [key, 0]));
const variants = [{}, { clipping }, { clipping, fitting }];
const hostMode = process.argv.includes('--host'), hosts = variants.map(modules => createGeometryHost(modules)), reference = makeGeomApi();
const workflows = geometryStageWorkflows().filter(row => (!hostMode || row.runWithApi) && (!option('filter') || row.id.includes(option('filter')!)));
if (!workflows.length) throw Error('No matching workflow.');
if (process.argv.includes('--reverse')) workflows.reverse();
const samples = 31, warmups = 10;
const summarize = (values: number[]) => {
  const sorted = values.slice().sort((a, b) => a - b);
  return { p50Ms: sorted[Math.ceil(values.length * 0.5) - 1]!, p95Ms: sorted[Math.ceil(values.length * 0.95) - 1]!, samples: values };
};
const rows = [];
for (const row of workflows) {
  const execute = (variant: number) => {
    if (hostMode) {
      const host = hosts[variant]!, before = host.stats(); Object.assign(CLIP_COUNTS, zero);
      const result = row.runWithApi!(variant === 0 ? reference : host.api), after = host.stats();
      return { answer: { result, counts: { ...CLIP_COUNTS } }, calls: { clipCalls: after.clipCalls - before.clipCalls, fitCalls: after.fitCalls - before.fitCalls, disposed: after.disposed } };
    }
    const owner = createGeometryOperationScope(variants[variant]!);
    Object.assign(CLIP_COUNTS, zero);
    try { return { answer: { result: row.run(owner.operations), counts: { ...CLIP_COUNTS } }, calls: owner.stats() }; }
    finally { owner.dispose(); }
  };
  const expected = execute(0).answer;
  if (!Array.isArray(expected.result)) assert.equal(expected.result.ok, true, row.id);
  const check = (actual: ReturnType<typeof execute>) => {
    assert.deepEqual(actual.answer, expected, row.id);
    for (const module of [clipping, fitting]) { assert.equal(module.stats().results, 0); assert.equal(module.stats().bufferBytes, 0); }
  };
  const calls = variants.map((_, variant) => {
    const before = [clipping.stats().mathCalls.hypot, fitting.stats().mathCalls.hypot ?? 0], result = execute(variant); check(result);
    return { ...result.calls, normCalls: { clipping: clipping.stats().mathCalls.hypot - before[0]!, fitting: (fitting.stats().mathCalls.hypot ?? 0) - before[1]! } };
  });
  for (let i = 0; i < warmups; i++) for (let v = 0; v < variants.length; v++) check(execute(v));
  const times: number[][] = [[], [], []];
  for (let i = 0; i < samples; i++) for (let j = 0; j < variants.length; j++) {
    const v = (i + j) % variants.length, start = performance.now(), result = execute(v);
    times[v]!.push(performance.now() - start); check(result);
  }
  const result = { id: row.id, kind: row.kind, source: row.source, inputs: row.inputs, inputHash: hash(JSON.stringify(row.inputs)), answerHash: hash(JSON.stringify(expected)),
    counts: expected.counts, calls, typeScript: summarize(times[0]!), clipping: summarize(times[1]!), combined: summarize(times[2]!) };
  rows.push(result); console.error(`${row.id}: TS ${result.typeScript.p50Ms.toFixed(3)} / clip ${result.clipping.p50Ms.toFixed(3)} / combined ${result.combined.p50Ms.toFixed(3)} ms`);
}
for (const host of hosts) host.dispose();
const report = { machine: { node: process.version, platform: process.platform, arch: process.arch, os: release(), cpu: cpus()[0]?.model },
  hostMode, hostNorm, samples, warmups, reversed: process.argv.includes('--reverse'), sourceHashes, artifactHashes, clipLoadMs, fitLoadMs, rows,
  afterDispose: { clipping: clipping.stats(), fitting: fitting.stats() },
  note: hostMode
    ? 'Actual long-lived synchronous host APIs against the default TypeScript factory. Timed selected calls include fresh operation scopes and engine facades, copying, result decoding, release and disposal. Host construction and cold loads are separate. Three variants rotate order per sample. Exact local legacy results and every work counter are asserted outside timing. No target-wide latency or portable activation claim.'
    : 'Actual engine dependency boundary. Complete operations include fresh scoped ownership, factory construction, copying, result decoding, release and disposal. Three variants rotate order per sample. Exact local legacy output and every work counter are asserted outside timing. Cold loads are separate. Host maths preserves its existing cross-host differences; no portable activation or target-wide claim.' };
if (option('output')) { await mkdir(dirname(option('output')!), { recursive: true }); await writeFile(option('output')!, JSON.stringify(report, null, 2) + '\n'); }
else console.log(JSON.stringify(report, null, 2));
