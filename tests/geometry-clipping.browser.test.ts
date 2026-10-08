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
  clipComparisonPlugin,
  loadClipComparison,
} from '../scripts/lib/geometry-clip-comparison.ts';
import { loadGeometryFitting } from '../packages/node-shell/src/geometry-fitting-node.ts';
import { startNodeClipComparison } from './helpers/geometry-clip-node-comparison.ts';
import {
  canonicalClipCases,
  clipCases,
  clipWire,
  seededClipCases,
} from './helpers/geometry-clip-cases.ts';
import type { probeClipping } from './helpers/geometry-clip-probe.ts';
declare global {
  interface Window {
    clippingProbe: typeof probeClipping;
  }
}
test('complete clipping agrees on immutable pair bits in Node, the selected browser and its worker', {
  timeout: 120_000,
}, async (t) => {
  let browser: Browser;
  try {
    browser = await launchGeometryBrowser();
  } catch (error) {
    if (process.env.LOLLY_GEOMETRY_REQUIRED === '1') throw error;
    t.skip('Clipping qualification requires the selected browser.');
    return;
  }
  t.after(() => browser.close());
  const started = performance.now();
  t.diagnostic(`Clipping qualification browser ${browser.version()}.`);
  const [entry, wasm, comparison] = await Promise.all([
    build({
      entryPoints: [fileURLToPath(new URL('./helpers/geometry-clip-probe.ts', import.meta.url))],
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      plugins: [clipComparisonPlugin()],
    }),
    readFile(
      new URL('../packages/node-shell/wasm/geometry-kernel/geometry-clip.wasm', import.meta.url)
    ),
    loadClipComparison(),
  ]);
  const fitting = await loadGeometryFitting(),
    canonical = canonicalClipCases(fitting);
  const inputs = [...clipCases(), ...seededClipCases(), ...canonical].map(clipWire);
  const node = startNodeClipComparison(comparison.code, wasm, inputs);
  t.after(() => node.dispose());
  // Observe rejection immediately even while the browser reference is running.
  const expectedResult = node.result.then(value => ({ value }), error => ({ error }));
  const server = createServer((req, res) => {
    if (req.url === '/entry.js') {
      res.setHeader('content-type', 'text/javascript');
      res.end(entry.outputFiles[0]!.text);
    } else if (req.url === '/worker.js') {
      res.setHeader('content-type', 'text/javascript');
      res.end(
        'import {probeClipping} from "/entry.js"; onmessage=async e=>{try{postMessage({result:await probeClipping(e.data)})}catch(error){postMessage({error:String(error)})}};'
      );
    } else if (req.url === '/geometry-clip.wasm') {
      res.setHeader('content-type', 'application/wasm');
      res.end(wasm);
    } else {
      res.setHeader('content-type', 'text/html');
      res.end(
        '<!doctype html><script type="module">import {probeClipping} from "/entry.js"; window.clippingProbe=probeClipping;</script>'
      );
    }
  });
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('The clipping test server did not start.');
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.waitForFunction(() => Boolean(window.clippingProbe));
  const main = await page.evaluate((inputs) => window.clippingProbe(inputs), inputs);
  t.diagnostic(`Main clipping reference completed after ${(performance.now() - started).toFixed(0)} ms.`);
  const worker = await page.evaluate(async (inputs) => {
    const worker = new Worker('/worker.js', { type: 'module' });
    try {
      return await new Promise<Awaited<ReturnType<typeof probeClipping>>>((resolve, reject) => {
        worker.onmessage = (e) =>
          e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.result);
        worker.onerror = (e) => reject(new Error(e.message));
        worker.postMessage(inputs);
      });
    } finally {
      worker.terminate();
    }
  }, inputs);
  t.diagnostic(`Worker clipping reference completed after ${(performance.now() - started).toFixed(0)} ms.`);
  const completed = await expectedResult;
  if ('error' in completed) throw completed.error;
  const expected = completed.value;
  t.diagnostic(`Node clipping worker reference completed after ${(performance.now() - started).toFixed(0)} ms.`);
  assert.deepEqual(
    worker,
    main,
    'Exact worker controls, contact bits, counters, workflow outputs and ownership.'
  );
  assert.deepEqual(
    main.cases,
    expected.cases,
    'Identical source requests agree across all three realms.'
  );
  for (const row of [...main.cases, ...main.workflows]) {
    assert.deepEqual(row.actual, row.reference, row.name);
    assert.deepEqual(row.actualCounts, row.referenceCounts, row.name);
  }
  assert.equal(main.afterDispose.results, 0);
  assert.equal(main.afterDispose.hits, 0);
  assert.equal(main.afterDispose.bufferBytes, 0);
  assert.ok(main.afterDispose.linearBytes <= 16 * 1024 * 1024);
  const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const report = process.env.LOLLY_GEOMETRY_CLIP_REPORT;
  if (report) {
    await mkdir(dirname(report), { recursive: true });
    await writeFile(
      report,
      JSON.stringify(
        {
          node: process.version,
          nodeRealm: 'worker_threads',
          browser: browser.version(),
          cases: inputs.length,
          canonicalFittingCases: canonical.length,
          canonicalFittingSha256: createHash('sha256')
            .update(
              await readFile(
                new URL(
                  '../packages/node-shell/wasm/geometry-kernel/geometry-fit-portable.wasm',
                  import.meta.url
                )
              )
            )
            .digest('hex'),
          workflows: main.workflows.length,
          wasm: { bytes: wasm.length, sha256: createHash('sha256').update(wasm).digest('hex') },
          inputSha256: hash(inputs),
          pairSha256: hash(main.cases),
          workflowSha256: hash(main.workflows),
          afterDispose: main.afterDispose,
          note: 'Exact local TypeScript reference in all qualified realms; identical immutable pair controls give identical bits and every work counter across realms. Workflows retain their host fitting path and require exact local output and counter equality. No assertion, tolerance or production budget was changed. No activation or native bit-identity claim.',
        },
        null,
        2
      ) + '\n'
    );
  }
  t.diagnostic(
    `${inputs.length} complete pair requests and ${main.workflows.length} workflows per realm; exact contacts and work counters; browser ${browser.version()}.`
  );
});
