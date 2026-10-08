// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { Browser } from 'playwright';
import { launchGeometryBrowser } from './helpers/geometry-browser.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';
import { geometryCurves, geometryPathData } from './helpers/geometry-kernel-cases.ts';
import type { probeGeometry } from './helpers/geometry-kernel-probe.ts';
import { referenceNearPairs, spatialCases } from './helpers/geometry-spatial-cases.ts';
import { rayComparisonPlugin } from '../scripts/lib/geometry-ray-comparison.ts';
import { offsetErrorComparisonPlugin } from '../scripts/lib/geometry-offset-error-comparison.ts';
import { offsetErrorCases } from './helpers/geometry-offset-error-cases.ts';
import { offsetError } from '../engine/src/geom/offset-error.ts';
import { rayCases } from './helpers/geometry-ray-cases.ts';
import { castRay } from '../engine/src/geom/ray-cast.ts';
import {
  analyticRootCases,
  referenceRoots,
  rootPolynomialCorpus,
  lineDistanceBatches,
} from './helpers/geometry-root-cases.ts';

declare global {
  interface Window {
    geometryProbe: typeof probeGeometry;
  }
}

test('float64 geometry agrees across browser, worker and the synchronous bridge', {
  timeout: 60_000,
}, async (t) => {
  let browser: Browser;
  try {
    browser = await launchGeometryBrowser();
  } catch (error) {
    if (process.env.LOLLY_GEOMETRY_REQUIRED === '1') throw error;
    t.skip('Geometry browser qualification requires the selected browser.');
    return;
  }
  t.after(() => browser.close());
  const [entry, wasm] = await Promise.all([
    build({
      entryPoints: [fileURLToPath(new URL('./helpers/geometry-kernel-probe.ts', import.meta.url))],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      plugins: [rayComparisonPlugin(), offsetErrorComparisonPlugin()],
    }),
    readFile(
      new URL('../packages/node-shell/wasm/geometry-kernel/geometry-kernel.wasm', import.meta.url)
    ),
  ]);
  const server = createServer((req, res) => {
    if (req.url === '/entry.js') {
      res.setHeader('content-type', 'text/javascript');
      res.end(entry.outputFiles[0]!.text);
    } else if (req.url === '/worker.js') {
      res.setHeader('content-type', 'text/javascript');
      res.end(
        'import {probeGeometry} from "/entry.js"; onmessage=async e=>{try{postMessage({result:await probeGeometry(e.data.workloads,e.data.coefficients,e.data.rayInputs,e.data.offsetInputs)})}catch(error){postMessage({error:String(error)})}};'
      );
    } else if (req.url === '/geometry-kernel.wasm') {
      res.setHeader('content-type', 'application/wasm');
      res.end(wasm);
    } else {
      res.setHeader('content-type', 'text/html');
      res.end(
        '<!doctype html><script type="module">import {probeGeometry} from "/entry.js"; window.geometryProbe=probeGeometry;</script>'
      );
    }
  });
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('The geometry test server did not start.');
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.waitForFunction(() => Boolean(window.geometryProbe));
  const workloads = [8, 128, 1024, 4096].map((count) => {
    const curves = geometryCurves(count);
    const points = Array.from({ length: 31 }, (_, i): [number, number] => [
      11 + i * 17,
      17 + i * 13,
    ]);
    return { curves, d: geometryPathData(curves), points };
  });
  const api = makeGeomApi();
  const expected = workloads.map(({ d, points }) => points.map(([x, y]) => api.nearest(d, x, y)));
  const coefficients = [
    ...analyticRootCases().map((row) => row.coefficients),
    ...rootPolynomialCorpus(1024),
    ...lineDistanceBatches().flatMap((row) => row.coefficients),
  ];
  const rayInputs = rayCases().map((row) => ({
    ...row,
    bundle: row.bundle ? [...row.bundle] : null,
  }));
  const offsetInputs = offsetErrorCases();
  const wire = { workloads, coefficients, rayInputs, offsetInputs };
  const main = await page.evaluate(
    (wire) =>
      window.geometryProbe(wire.workloads, wire.coefficients, wire.rayInputs, wire.offsetInputs),
    wire
  );
  const worker = await page.evaluate(async (wire) => {
    const worker = new Worker('/worker.js', { type: 'module' });
    try {
      return await new Promise<Awaited<ReturnType<typeof probeGeometry>>>((resolve, reject) => {
        worker.onmessage = (event) =>
          event.data.error ? reject(new Error(event.data.error)) : resolve(event.data.result);
        worker.onerror = (event) => reject(new Error(event.message));
        worker.postMessage(wire);
      });
    } finally {
      worker.terminate();
    }
  }, wire);
  assert.deepEqual(worker, main, 'both realms preserve exact numeric values and release ownership');
  for (const [index, row] of main.rows.entries()) {
    assert.deepEqual(row.individual, row.results, 'batch and single queries agree');
    assert.deepEqual(row.bridge, expected[index], 'browser SVG bridge agrees with Node');
    assert.equal(row.invalid, 'invalid-argument');
    const nearest = row.results.map((result) => ({
      ok: true,
      value: {
        contour: result.curve,
        curve: 0,
        t: result.t,
        x: result.point.x,
        y: result.point.y,
        distance: result.distance,
      },
    }));
    assert.deepEqual(
      nearest,
      expected[index],
      `${workloads[index]!.curves.length}-curve original parameters`
    );
  }
  assert.equal(main.afterDispose.paths, 0);
  assert.deepEqual(
    main.spatial,
    spatialCases().map((row) => ({
      name: row.name,
      pairs: referenceNearPairs(row.curves, row.weld),
    }))
  );
  assert.equal(main.afterDispose.curves, 0);
  assert.equal(main.roots.length, coefficients.length);
  assert.equal(main.referenceRoots.length, coefficients.length);
  coefficients.forEach((polynomial, i) => {
    const expected = referenceRoots(polynomial);
    assert.deepEqual(main.roots[i], expected, `WASM polynomial ${i}: ${polynomial}`);
    assert.deepEqual(
      main.referenceRoots[i],
      expected,
      `browser TypeScript polynomial ${i}: ${polynomial}`
    );
  });
  assert.equal(main.rays.length, rayInputs.length);
  main.rays.forEach((row, i) => {
    const input = rayInputs[i]!,
      budget = { work: input.work };
    const expected = castRay(
      input.index,
      ...input.point,
      ...input.direction,
      input.ref,
      input.near,
      budget,
      input.complete,
      input.bundle ? new Map(input.bundle) : null
    );
    assert.deepEqual(row.actual, expected, row.name);
    assert.deepEqual(row.reference, expected, row.name);
    assert.equal(row.work, budget.work, row.name);
    assert.equal(row.referenceWork, budget.work, row.name);
  });
  main.workflows.forEach((row) => {
    assert.equal(row.reference.ok, true, row.name);
    assert.deepEqual(row.actual, row.reference, row.name);
    assert.ok(row.backend.calls > 0, row.name);
  });
  assert.equal(main.offsetErrors.length, offsetInputs.length);
  main.offsetErrors.forEach((row, i) => {
    const input = offsetInputs[i]!;
    const expected = offsetError(input.src, input.approx, input.distance, input.tol);
    assert.deepEqual(row.actual, expected, row.name);
    assert.deepEqual(row.reference, expected, row.name);
  });
  assert.equal(main.offsetWorkflows.length, 8);
  main.offsetWorkflows.forEach((row) => {
    assert.equal(Array.isArray(row.reference) ? undefined : row.reference.ok, true, row.name);
    assert.deepEqual(row.actual, row.reference, row.name);
    if (row.name !== 'union-circles') assert.ok(row.backend.calls > 0, row.name);
  });
  assert.equal(main.afterDispose.bufferBytes, 0);
  assert.ok(main.afterDispose.linearBytes <= 16 * 1024 * 1024);
  t.diagnostic(
    `Browser ${browser.version()}: 124 nearest queries, nine spatial cases, ${main.roots.length} root solves, ${main.rays.length} complete casts, eight ray workflows, ${main.offsetErrors.length} offset verifications and eight offset workflows per realm; ownership released.`
  );
});
