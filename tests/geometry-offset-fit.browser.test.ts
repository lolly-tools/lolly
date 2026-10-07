// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { Browser } from 'playwright';
import { launchGeometryBrowser } from './helpers/geometry-browser.ts';
import {
  loadOffsetFitComparison,
  offsetFitComparisonPlugin,
} from '../scripts/lib/geometry-offset-fit-comparison.ts';
import { offsetFitCases, seededOffsetFitCases } from './helpers/geometry-offset-fit-cases.ts';
import type { probeOffsetFitting } from './helpers/geometry-offset-fit-probe.ts';

declare global {
  interface Window {
    offsetFitProbe: typeof probeOffsetFitting;
  }
}

test('complete adaptive fitting preserves each host reference in the selected browser and a worker', {
  timeout: 60_000,
}, async (t) => {
  let browser: Browser;
  try {
    browser = await launchGeometryBrowser();
  } catch (error) {
    if (process.env.LOLLY_GEOMETRY_REQUIRED === '1') throw error;
    t.skip('Fitting qualification requires the selected browser.');
    return;
  }
  t.after(() => browser.close());
  const [entry, wasm, comparison] = await Promise.all([
    build({
      entryPoints: [
        fileURLToPath(new URL('./helpers/geometry-offset-fit-probe.ts', import.meta.url)),
      ],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      plugins: [offsetFitComparisonPlugin()],
    }),
    readFile(
      new URL('../packages/node-shell/wasm/geometry-kernel/geometry-fit.wasm', import.meta.url)
    ),
    loadOffsetFitComparison(),
  ]);
  const inputs = [...offsetFitCases(), ...seededOffsetFitCases()];
  const expected = inputs.map((row) =>
    comparison.module.offsetPieces(row.src, row.distance, row.tol)
  );
  const expectedWorkflows = comparison.module.geometryStageWorkflows().map((row) => row.run());
  const server = createServer((req, res) => {
    if (req.url === '/entry.js') {
      res.setHeader('content-type', 'text/javascript');
      res.end(entry.outputFiles[0]!.text);
    } else if (req.url === '/worker.js') {
      res.setHeader('content-type', 'text/javascript');
      res.end(
        'import {probeOffsetFitting} from "/entry.js"; onmessage=async e=>{try{postMessage({result:await probeOffsetFitting(e.data)})}catch(error){postMessage({error:String(error)})}};'
      );
    } else if (req.url === '/geometry-fit.wasm') {
      res.setHeader('content-type', 'application/wasm');
      res.end(wasm);
    } else {
      res.setHeader('content-type', 'text/html');
      res.end(
        '<!doctype html><script type="module">import {probeOffsetFitting} from "/entry.js"; window.offsetFitProbe=probeOffsetFitting;</script>'
      );
    }
  });
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('The fitting test server did not start.');
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.waitForFunction(() => Boolean(window.offsetFitProbe));
  const main = await page.evaluate((inputs) => window.offsetFitProbe(inputs), inputs);
  const worker = await page.evaluate(async (inputs) => {
    const worker = new Worker('/worker.js', { type: 'module' });
    try {
      return await new Promise<Awaited<ReturnType<typeof probeOffsetFitting>>>(
        (resolve, reject) => {
          worker.onmessage = (e) =>
            e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.result);
          worker.onerror = (e) => reject(new Error(e.message));
          worker.postMessage(inputs);
        }
      );
    } finally {
      worker.terminate();
    }
  }, inputs);
  assert.deepEqual(
    worker,
    main,
    'Exact complete controls, directions, counters and ownership in both realms.'
  );
  main.cases.forEach((row) => {
    assert.deepEqual(row.actual, row.reference, row.name);
  });
  const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const hostDifferences = main.cases.flatMap((row, i) => {
    if (hash(row.reference) === hash(expected[i])) return [];
    const node = expected[i]!;
    let maxCoordinateDifference = 0;
    if (node.length === row.reference.length)
      row.reference.forEach((p, j) => {
        p.curve.forEach((v, k) => {
          maxCoordinateDifference = Math.max(
            maxCoordinateDifference,
            Math.abs(v - node[j]!.curve[k]!)
          );
        });
      });
    return [
      {
        name: row.name,
        nodePieces: node.length,
        browserPieces: row.reference.length,
        maxCoordinateDifference:
          node.length === row.reference.length ? maxCoordinateDifference : null,
        nodeSha256: hash(node),
        browserSha256: hash(row.reference),
      },
    ];
  });
  main.workflows.forEach((row, i) => {
    assert.deepEqual(row.actual, row.reference, row.name);
    // Complete serialized SVG and untouched intersections retain the Node result too.
    if (row.name !== 'offset-piece-smooth')
      assert.deepEqual(row.reference, expectedWorkflows[i], row.name);
    assert.deepEqual(row.actualCounts, row.referenceCounts, row.name);
    assert.equal(row.actualLast, row.referenceLast, row.name);
    if (row.name.startsWith('offset-') || row.name.startsWith('stroke-'))
      assert.ok(row.backend.calls > 0, row.name);
  });
  assert.equal(main.afterDispose.results, 0);
  assert.equal(main.afterDispose.pieces, 0);
  assert.equal(main.afterDispose.bufferBytes, 0);
  assert.ok(main.afterDispose.linearBytes <= 16 * 1024 * 1024);
  const report = process.env.LOLLY_GEOMETRY_FIT_REPORT;
  if (report) {
    await mkdir(dirname(report), { recursive: true });
    await writeFile(
      report,
      JSON.stringify(
        {
          node: process.version,
          browser: browser.version(),
          cases: inputs.length,
          workflows: main.workflows.length,
          hostDifferences,
          afterDispose: main.afterDispose,
          note: 'Rust agrees exactly with the unchanged TypeScript reference in each qualified host. Chromium and worker agree exactly. Existing Node/Chromium raw fitting differences are recorded; cross-host bit identity is not established. No tolerance or corpus assertion was widened.',
        },
        null,
        2
      ) + '\n'
    );
  }
  t.diagnostic(
    `Browser ${browser.version()}: ${inputs.length} complete fitting requests and ${main.workflows.length} workflows per realm; exact local-reference controls, directions and counters, ownership released; ${hostDifferences.length} pre-existing Node/Chromium raw fitting differences.`
  );
});
