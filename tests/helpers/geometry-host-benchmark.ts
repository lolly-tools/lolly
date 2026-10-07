// SPDX-License-Identifier: MPL-2.0
/** Complete host-call timings include scope ownership and check every answer outside timing. */
import { makeGeomApi } from '../../engine/src/geom-api.ts';
import { CLIP_COUNTS } from '../../engine/src/geom/intersect.ts';
import { geometryStageWorkflows } from './geometry-stage-workflows.ts';
import type { createGeometryHost, GeometryBackend } from '../../packages/node-shell/src/geometry-host.ts';

export async function benchGeometryWithLoader(load: (backend: GeometryBackend) => Promise<ReturnType<typeof createGeometryHost>>, reverse = false, backends: GeometryBackend[] = ['typescript', 'wasm-portable']) {
  if (backends[0] !== 'typescript' || backends.length < 2) throw Error('Benchmark requires TypeScript first and at least one other variant.');
  const owners = await Promise.all(backends.map(backend => load(backend)));
  const reference = makeGeomApi(), zero = Object.fromEntries(Object.keys(CLIP_COUNTS).map(key => [key, 0]));
  const workflows = geometryStageWorkflows().filter(row => row.runWithApi), samples = 31, warmups = 10;
  let previous = performance.now(), observedTimerStepMs = Infinity;
  for (let i = 0; i < 20_000; i++) { const now = performance.now(); if (now > previous) observedTimerStepMs = Math.min(observedTimerStepMs, now - previous); previous = now; }
  if (reverse) workflows.reverse();
  const summarize = (values: number[]) => { const sorted = values.slice().sort((a, b) => a - b); return { p50Ms: sorted[Math.ceil(values.length * .5) - 1]!, p95Ms: sorted[Math.ceil(values.length * .95) - 1]!, samples: values }; };
  const rows = [];
  try {
    for (const row of workflows) {
      const execute = (variant: number) => {
        Object.assign(CLIP_COUNTS, zero);
        return { result: row.runWithApi!(variant === 0 ? reference : owners[variant]!.api), counts: { ...CLIP_COUNTS } };
      };
      const expected = execute(0), answer = JSON.stringify(expected);
      if (!Array.isArray(expected.result) && !expected.result.ok) throw Error(`Benchmark reference refused ${row.id}.`);
      const check = (result: ReturnType<typeof execute>) => {
        if (JSON.stringify(result) !== answer) throw Error(`Complete answer or work mismatch: ${row.id}.`);
        for (const owner of owners) for (const module of [owner.stats().clipping, owner.stats().fitting]) if (module && (module.results || module.bufferBytes)) throw Error('Benchmark retained owned resources.');
      };
      const calls = owners.map((owner, variant) => { const before = owner.stats(); check(execute(variant)); const after = owner.stats(); return { clipCalls: after.clipCalls - before.clipCalls, fitCalls: after.fitCalls - before.fitCalls }; });
      for (let i = 0; i < warmups; i++) for (let v = 0; v < owners.length; v++) check(execute(v));
      const times: number[][] = owners.map(() => []);
      const callsPerSample = ['union-circles', 'offset-crossing-loop', 'stroke-lost-lobe'].includes(row.id) ? 8 : 1;
      for (let i = 0; i < samples; i++) for (let j = 0; j < owners.length; j++) {
        const v = (i + j) % owners.length, results: ReturnType<typeof execute>[] = [], start = performance.now();
        for (let call = 0; call < callsPerSample; call++) results.push(execute(v));
        times[v]!.push((performance.now() - start) / callsPerSample); for (const result of results) check(result);
      }
      rows.push({ id: row.id, inputs: row.inputs, expected, calls, callsPerSample, typeScript: summarize(times[0]!), clipping: summarize(times[1]!), combined: summarize(times[2]!), variants: backends.map((backend, index) => ({ backend, ...summarize(times[index]!) })) });
    }
  } finally { for (const owner of owners) owner.dispose(); }
  return { samples, warmups, backends, observedTimerStepMs: Number.isFinite(observedTimerStepMs) ? observedTimerStepMs : null, reversed: reverse, rows, afterDispose: owners.map(owner => owner.stats()), note: 'Complete synchronous main-thread host calls, including scope creation, copying, decoding and disposal. Small cases batch eight calls per sample to reduce timer quantization, with every answer/counter checked outside timing. Variants rotate order. Cold loading and host creation excluded. No editor, worker or native latency claim.' };
}
