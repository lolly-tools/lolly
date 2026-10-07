// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname } from 'node:path';
import { test } from 'node:test';
import { build } from 'esbuild';
import type { Browser } from 'playwright';
import { launchGeometryBrowser } from './helpers/geometry-browser.ts';
import { loadGeometryFitting } from '../packages/node-shell/src/geometry-fitting-node.ts';
import {
  loadOffsetFitComparison,
  offsetFitComparisonPlugin,
} from '../scripts/lib/geometry-offset-fit-comparison.ts';
import { createOffsetFitBackend } from './helpers/geometry-offset-fit-backend.ts';
import { offsetFitCases, seededOffsetFitCases } from './helpers/geometry-offset-fit-cases.ts';
import type { probeOffsetFitting } from './helpers/geometry-offset-fit-probe.ts';
import { fittingCompatibility, pieceBits } from './helpers/geometry-portable-fit-compatibility.ts';
import {
  portableMathCases,
  probePortableMath,
  type FittingMathCase,
} from './helpers/geometry-portable-math-cases.ts';

declare global {
  interface Window {
    portableFitProbe: typeof probeOffsetFitting;
    portableMathProbe: (inputs: FittingMathCase[]) => Promise<string[]>;
  }
}
test('portable fitting and scalar answers are identical in Node, the selected browser and its worker', {
  timeout: 60_000,
}, async (t) => {
  let browser: Browser;
  try {
    browser = await launchGeometryBrowser();
  } catch (error) {
    if (process.env.LOLLY_GEOMETRY_REQUIRED === '1') throw error;
    t.skip('Portable fitting qualification requires the selected browser.');
    return;
  }
  t.after(() => browser.close());
  const [entry, wasm, comparison, kernel] = await Promise.all([
    build({
      stdin: {
        contents: `export {probeOffsetFitting} from './tests/helpers/geometry-offset-fit-probe.ts';
          import {probePortableMath} from './tests/helpers/geometry-portable-math-cases.ts';
          export async function portableMathProbe(inputs) {return probePortableMath(new Uint8Array(await (await fetch('/geometry-fit-portable.wasm')).arrayBuffer()),inputs);}`,
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      plugins: [offsetFitComparisonPlugin()],
    }),
    readFile(
      new URL(
        '../packages/node-shell/wasm/geometry-kernel/geometry-fit-portable.wasm',
        import.meta.url
      )
    ),
    loadOffsetFitComparison(),
    loadGeometryFitting('portable'),
  ]);
  const inputs = [...offsetFitCases(), ...seededOffsetFitCases()];
  const scalars = portableMathCases();
  const nodeScalars = await probePortableMath(wasm, scalars);
  const workspace = kernel.createOffsetFitWorkspace();
  const nodeCases = inputs.map((row) => ({
    name: row.name,
    actual: workspace.fit(row.src, row.distance, row.tol),
    reference: comparison.module.offsetPieces(row.src, row.distance, row.tol),
  }));
  workspace.dispose();
  const counters = () => {
    const c = comparison.module.CLIP_COUNTS;
    return {
      pairs: c.pairs,
      nodes: c.nodes,
      overruns: c.overruns,
      overrunNodes: c.overrunNodes,
      ceilings: c.ceilings,
    };
  };
  const delta = (before: ReturnType<typeof counters>) =>
    Object.fromEntries(
      Object.entries(counters()).map(([key, value]) => [
        key,
        value - before[key as keyof typeof before],
      ])
    );
  const nodeWorkflows = comparison.module.geometryStageWorkflows().map((row) => {
    comparison.module.setOffsetFitProbe(undefined);
    const before = counters(),
      reference = row.run(),
      referenceCounts = delta(before);
    const referenceLast = comparison.module.CLIP_COUNTS.lastNodes;
    const backend = createOffsetFitBackend(kernel),
      start = counters();
    try {
      comparison.module.setOffsetFitProbe(backend.fit);
      const actual = row.run();
      return {
        name: row.id,
        reference,
        actual,
        referenceCounts,
        actualCounts: delta(start),
        referenceLast,
        actualLast: comparison.module.CLIP_COUNTS.lastNodes,
      };
    } finally {
      comparison.module.setOffsetFitProbe(undefined);
      backend.dispose();
    }
  });
  nodeWorkflows.forEach((row) => {
    assert.deepEqual(row.actual, row.reference, row.name);
  });
  const server = createServer((req, res) => {
    if (req.url === '/entry.js') {
      res.setHeader('content-type', 'text/javascript');
      res.end(entry.outputFiles[0]!.text);
    } else if (req.url === '/worker.js') {
      res.setHeader('content-type', 'text/javascript');
      res.end(
        'import {probeOffsetFitting,portableMathProbe} from "/entry.js"; onmessage=async e=>{try{postMessage({result:{fit:await probeOffsetFitting(e.data.inputs,"portable"),scalar:await portableMathProbe(e.data.scalars)}})}catch(error){postMessage({error:String(error)})}};'
      );
    } else if (req.url === '/geometry-fit-portable.wasm') {
      res.setHeader('content-type', 'application/wasm');
      res.end(wasm);
    } else {
      res.setHeader('content-type', 'text/html');
      res.end(
        '<!doctype html><script type="module">import {probeOffsetFitting,portableMathProbe} from "/entry.js";window.portableFitProbe=probeOffsetFitting;window.portableMathProbe=portableMathProbe;</script>'
      );
    }
  });
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Portable qualification server did not start.');
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.waitForFunction(() => Boolean(window.portableFitProbe));
  const main = await page.evaluate(
    async ({ inputs, scalars }) => ({
      fit: await window.portableFitProbe(inputs, 'portable'),
      scalar: await window.portableMathProbe(scalars),
    }),
    { inputs, scalars }
  );
  const worker = await page.evaluate(
    async (data) => {
      const worker = new Worker('/worker.js', { type: 'module' });
      try {
        return await new Promise<{
          fit: Awaited<ReturnType<typeof probeOffsetFitting>>;
          scalar: string[];
        }>((resolve, reject) => {
          worker.onmessage = (e) =>
            e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.result);
          worker.onerror = (e) => reject(new Error(e.message));
          worker.postMessage(data);
        });
      } finally {
        worker.terminate();
      }
    },
    { inputs, scalars }
  );
  assert.deepEqual(worker, main);
  assert.deepEqual(
    main.scalar,
    nodeScalars,
    'Finite scalar bits and NaN classification across hosts.'
  );
  main.fit.cases.forEach((row, i) => {
    assert.deepEqual(pieceBits(row.actual), pieceBits(nodeCases[i]!.actual), row.name);
    assert.equal(row.actual.length, row.reference.length, row.name);
    assert.deepEqual(
      row.actual.map((p) => [p.dirStart, p.dirEnd]),
      row.reference.map((p) => [p.dirStart, p.dirEnd]),
      row.name
    );
  });
  main.fit.workflows.forEach((row, i) => {
    assert.deepEqual(row.actual, nodeWorkflows[i]!.actual, row.name);
    if (row.name !== 'offset-piece-smooth') assert.deepEqual(row.actual, row.reference, row.name);
    assert.deepEqual(row.actualCounts, nodeWorkflows[i]!.actualCounts, row.name);
    assert.equal(row.actualLast, nodeWorkflows[i]!.actualLast, row.name);
  });
  assert.equal(main.fit.afterDispose.results, 0);
  assert.equal(main.fit.afterDispose.pieces, 0);
  assert.equal(main.fit.afterDispose.bufferBytes, 0);
  assert.ok(main.fit.afterDispose.linearBytes <= 16 * 1024 * 1024);
  assert.deepEqual(main.fit.afterDispose.mathCalls, { sin: 0, cos: 0, acos: 0, cbrt: 0, atan2: 0 });
  const digest = (value: unknown) =>
    createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const compact = (rows: ReturnType<typeof fittingCompatibility>) =>
    rows.map(({ canonicalBits, referenceBits, ...row }) => ({
      ...row,
      canonicalSha256: digest(canonicalBits),
      referenceSha256: digest(referenceBits),
    }));
  const nodeDifferences = compact(fittingCompatibility(nodeCases));
  const browserDifferences = compact(fittingCompatibility(main.fit.cases));
  const counterDifferences = (rows: typeof nodeWorkflows) =>
    rows
      .filter(
        (r) =>
          JSON.stringify(r.actualCounts) !== JSON.stringify(r.referenceCounts) ||
          r.actualLast !== r.referenceLast
      )
      .map(({ name, actualCounts, referenceCounts, actualLast, referenceLast }) => ({
        name,
        actualCounts,
        referenceCounts,
        actualLast,
        referenceLast,
      }));
  const nodeCounterDifferences = counterDifferences(nodeWorkflows);
  const browserCounterDifferences = counterDifferences(main.fit.workflows);
  const report = process.env.LOLLY_GEOMETRY_PORTABLE_REPORT;
  if (report) {
    await mkdir(dirname(report), { recursive: true });
    await writeFile(
      report,
      JSON.stringify(
        {
          node: process.version,
          browser: browser.version(),
          cases: inputs.length,
          scalarCases: scalars.length,
          scalarSha256: digest(nodeScalars),
          fittingSha256: digest(nodeCases.map((r) => pieceBits(r.actual))),
          wasm: {
            bytes: wasm.length,
            sha256: createHash('sha256').update(wasm).digest('hex'),
            imports: [],
          },
          workflows: main.fit.workflows.map(({ name, actual, actualCounts, actualLast }) => ({
            name,
            outputSha256: digest(actual),
            counts: actualCounts,
            lastNodes: actualLast,
          })),
          nodeDifferences,
          browserDifferences,
          nodeCounterDifferences,
          browserCounterDifferences,
          afterDispose: main.fit.afterDispose,
          legacyCompatibility:
            nodeDifferences.length === 0 &&
            browserDifferences.length === 0 &&
            nodeCounterDifferences.length === 0 &&
            browserCounterDifferences.length === 0,
          note: 'Canonical WASM scalar bits (except NaN payloads), controls, directions and complete workflow/counter results agree in all three qualified realms. Legacy rounding and clipping-work changes are separately audited, and prevent exact legacy compatibility. Exact current serialized workflows agree. Existing geometry corpus tolerances and host-reference gates are unchanged. No native, other-browser, activation or mathematical exact-rounding claim.',
        },
        null,
        2
      ) + '\n'
    );
  }
  t.diagnostic(
    `${scalars.length} scalar requests, ${inputs.length} fits and ${main.fit.workflows.length} workflows; exact canonical results across Node/Chromium/worker; ${nodeDifferences.length} Node and ${browserDifferences.length} Chromium legacy raw differences; ${nodeCounterDifferences.length}/${browserCounterDifferences.length} legacy clipping-work changes. This qualifies portability, not exact legacy compatibility.`
  );
});
