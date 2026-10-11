// SPDX-License-Identifier: MPL-2.0
/** Node geometry-only layout qualification. Kernel loading and output comparison are timed separately. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { cpus, platform, arch } from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  createDesignLayoutEvaluator,
  type LayoutEvaluation,
  type LayoutSolver,
} from '../engine/src/design-layout.ts';
import { createLayoutKernel } from '../packages/node-shell/src/layout-kernel.ts';

type Row = Record<string, unknown>;
const args = new Map<string, string>(
  process.argv.slice(2).map((a): [string, string] => {
    const match = /^--([^=]+)=(.*)$/.exec(a);
    return match ? [match[1]!, match[2]!] : [a.replace(/^--/, ''), 'true'];
  })
);
const iterations = Number(args.get('iters') || 11);
assert.ok(Number.isInteger(iterations) && iterations >= 3 && iterations <= 101);
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const evaluatorSource = readFileSync(new URL('../engine/src/design-layout.ts', import.meta.url));
const evaluatorSourceSha256 = hash(evaluatorSource);
const bytes = new Uint8Array(
  readFileSync(
    new URL('../packages/node-shell/wasm/layout-kernel/layout-kernel.wasm', import.meta.url)
  )
);
const loadStart = performance.now();
const kernel = await createLayoutKernel(bytes);
const kernelInitializeMs = performance.now() - loadStart;
const count = { calls: 0 };
const solve: LayoutSolver = (request) => {
  count.calls++;
  return kernel(request);
};

function fixture(n: number): { boxes: Row[]; tracks: Row[] } {
  const boxes: Row[] = [];
  const tracks: Row[] = [];
  const append = (row: Row) =>
    boxes.push({ kind: 'box', x: 0, y: 0, w: 40, h: 20, rot: 0, bg: '#eef', ...row });
  const columns = (container: string) => {
    for (let order = 0; order < 2; order++)
      tracks.push({ id: `${container}-c${order}`, container, axis: 'column', order, track: '1fr' });
  };
  for (let g = 0; boxes.length + 15 <= n; g++) {
    const root = `r${g}`;
    append({
      id: root,
      kind: 'frame',
      x: (g % 10) * 550,
      y: Math.floor(g / 10) * 350,
      w: 500,
      h: 300,
      layout: g % 2 ? 'flex' : 'grid',
      layoutWrap: true,
      layoutGapX: 10,
      layoutGapY: 10,
      layoutPadTop: 10,
      layoutPadRight: 10,
      layoutPadBottom: 10,
      layoutPadLeft: 10,
    });
    if (g % 2 === 0) columns(root);
    for (let c = 0; c < 2; c++) {
      const nested = `${root}-n${c}`;
      append({
        id: nested,
        layoutOwner: root,
        w: 200,
        h: 100,
        layout: c ? 'grid' : 'flex',
        layoutWrap: true,
        layoutGapX: 4,
        layoutGapY: 4,
        layoutPadTop: 4,
        layoutPadLeft: 4,
      });
      if (c) columns(nested);
      for (let j = 0; j < 4; j++)
        append({
          id: `${nested}-b${j}`,
          layoutOwner: nested,
          kind: j % 2 ? 'text' : 'box',
          text: `Fixed label ${j}`,
        });
    }
    for (let j = 0; j < 4; j++) append({ id: `${root}-b${j}`, layoutOwner: root });
  }
  while (boxes.length < n) append({ id: `plain-${boxes.length}`, x: 100, y: 100 });
  // Keep a stable standalone shape at every size for an unrelated geometry edit.
  const last = boxes[boxes.length - 1]!;
  if (last.layoutOwner) {
    delete last.layoutOwner;
    last.id = `plain-${boxes.length - 1}`;
  }
  return { boxes, tracks };
}
const digest = (result: LayoutEvaluation) => {
  assert.deepEqual(result.findings, []);
  return hash(JSON.stringify({ boxes: result.boxes, grids: result.grids }));
};
const summary = (samples: number[]) => {
  const ordered = [...samples].sort((a, b) => a - b);
  return {
    medianMs: ordered[Math.floor(ordered.length / 2)]!,
    p95Ms: ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * 0.95))]!,
    samplesMs: samples,
  };
};
const rows = [];
for (const n of [1000, 3000, 10000]) {
  const model = fixture(n);
  const inputSha256 = hash(JSON.stringify(model));
  const prime = createDesignLayoutEvaluator(solve);
  const start = performance.now();
  count.calls = 0;
  const first = await prime(model.boxes, model.tracks);
  const firstMs = performance.now() - start;
  const firstDigest = digest(first);
  const firstCalls = count.calls;
  const scenarios = [];
  for (const scenario of ['unchanged', 'unrelated', 'content', 'coupled-root', 'static-bypass']) {
    const cached = createDesignLayoutEvaluator(solve);
    await cached(model.boxes, model.tracks);
    const cachedMs: number[] = [],
      freshMs: number[] = [],
      cachedCalls: number[] = [],
      freshCalls: number[] = [],
      outputs: string[] = [];
    for (let i = -2; i < iterations; i++) {
      const delta = i + 3;
      let boxes: Row[] = model.boxes;
      let tracks: Row[] = model.tracks;
      if (scenario === 'unrelated')
        boxes = model.boxes.map((r, k) => (k === n - 1 ? { ...r, x: 100 + delta } : r));
      if (scenario === 'content')
        boxes = model.boxes.map((r) =>
          r.id === 'r0-n0-b1' ? { ...r, text: `Changed fixed text ${delta}`, bg: '#abc' } : r
        );
      if (scenario === 'coupled-root')
        boxes = model.boxes.map((r) => (r.id === 'r0' ? { ...r, w: 500 + delta * 2 } : r));
      if (scenario === 'static-bypass') {
        boxes = model.boxes.map(({ layout, layoutOwner, frame, ...r }) => r);
        tracks = [];
      }
      const original = hash(JSON.stringify({ boxes, tracks }));
      let cachedResult: LayoutEvaluation, freshResult: LayoutEvaluation;
      let cachedTime = 0,
        freshTime = 0,
        cachedCount = 0,
        freshCount = 0;
      // Alternate pair order; only evaluation and fresh factory construction are timed.
      for (const variant of i % 2 ? ['fresh', 'cached'] : ['cached', 'fresh']) {
        count.calls = 0;
        const before = performance.now();
        if (variant === 'cached') {
          cachedResult = await cached(boxes, tracks);
          cachedTime = performance.now() - before;
          cachedCount = count.calls;
        } else {
          freshResult = await createDesignLayoutEvaluator(solve)(boxes, tracks);
          freshTime = performance.now() - before;
          freshCount = count.calls;
        }
      }
      const answer = digest(cachedResult!);
      assert.equal(
        answer,
        digest(freshResult!),
        `${n}/${scenario}/${delta}: full boxes and grid metadata differ`
      );
      assert.equal(hash(JSON.stringify({ boxes, tracks })), original, 'authored inputs changed');
      if (scenario === 'static-bypass') {
        assert.equal(cachedResult!.boxes, boxes);
        assert.equal(freshResult!.boxes, boxes);
      }
      if (i >= 0) {
        cachedMs.push(cachedTime);
        freshMs.push(freshTime);
        cachedCalls.push(cachedCount);
        freshCalls.push(freshCount);
        outputs.push(answer);
      }
    }
    const result = {
      scenario,
      cached: { ...summary(cachedMs), calls: cachedCalls },
      fresh: { ...summary(freshMs), calls: freshCalls },
      outputSha256: outputs,
    };
    scenarios.push(result);
    process.stdout.write(
      `${n} ${scenario}: cached ${result.cached.medianMs.toFixed(2)} ms / fresh ${result.fresh.medianMs.toFixed(2)} ms; ${cachedCalls[0]} / ${freshCalls[0]} kernel calls\n`
    );
  }
  rows.push({
    n,
    containers: model.boxes.filter((r) => r.layout).length,
    tracks: model.tracks.length,
    inputSha256,
    first: { ms: firstMs, calls: firstCalls, outputSha256: firstDigest },
    scenarios,
  });
}
assert.equal(
  hash(readFileSync(new URL('../engine/src/design-layout.ts', import.meta.url))),
  evaluatorSourceSha256,
  'Evaluator source changed during the benchmark; rerun against the settled source.'
);
const report = {
  scope:
    'Node geometry-only mixed nested layout evaluation; fixed text dimensions, no font shaping, renderer, DOM, export, collaboration, picking or browser paint.',
  comparison:
    'Cached evaluator versus a new evaluator using identical kernel and authored inputs; fresh factory construction included, kernel loading and parity hashing excluded. Whole evaluated boxes and grid metadata hashes must match after every pair.',
  cacheScope:
    'The cached path still validates, clones and visits the whole document. Reduced solver calls do not establish constant-time editing.',
  kernelInitialization: {
    ms: kernelInitializeMs,
    includes:
      'Compile/instantiate from resident bytes, excludes disk read; JavaScript runtime may cache compilation.',
  },
  loadCondition: 'Uncontrolled local machine load; other development work may be running.',
  node: process.version,
  platform: platform(),
  arch: arch(),
  cpu: cpus()[0]?.model,
  cpus: cpus().length,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sourceSha256: evaluatorSourceSha256,
  scriptSha256: hash(readFileSync(new URL('./bench-design-layout.ts', import.meta.url))),
  artifactSha256: hash(bytes),
  iterations,
  recordedAt: new Date().toISOString(),
  rows,
};
const destination = args.get('json');
if (destination) {
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
}
