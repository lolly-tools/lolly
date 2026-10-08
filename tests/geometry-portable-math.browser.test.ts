// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { build } from 'esbuild';
import type { Browser } from 'playwright';
import { launchGeometryBrowser } from './helpers/geometry-browser.ts';
import { GEOMETRY_WORKFLOWS_SHA256, PORTABLE_MATH_RESULTS_SHA256 } from './helpers/portable-math-cases.ts';

declare global { interface Window { portableMathDigest(): Promise<{ main: Digests; worker: Digests }> } }
interface Digests { scalar: string; workflows: string }

const probe = `
  import { probeGeometryRevision } from './tests/helpers/geometry-revision-probe.ts';
  if (typeof window === 'undefined') probeGeometryRevision().then(value => postMessage(value));
  else window.portableMathDigest = async () => {
    const worker = new Worker('/probe.js', { type: 'module' });
    const fromWorker = new Promise(resolve => { worker.onmessage = event => resolve(event.data); });
    const main = await probeGeometryRevision();
    return { main, worker: await fromWorker };
  };
`;

test('portable scalar maths and complete geometry workflows give the pinned bits in the selected browser and its worker', { timeout: 120_000 }, async t => {
  let browser: Browser;
  try { browser = await launchGeometryBrowser(); }
  catch (error) { if (process.env.LOLLY_GEOMETRY_REQUIRED === '1') throw error; t.skip('Portable maths qualification requires the selected browser.'); return; }
  t.after(() => browser.close());
  const bundle = await build({ stdin: { contents: probe, resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'browser' });
  const server = createServer((req, res) => {
    if (req.url === '/probe.js') { res.setHeader('content-type', 'text/javascript'); res.end(bundle.outputFiles[0]!.text); }
    else { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><script type="module" src="/probe.js"></script>'); }
  });
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw Error('Portable maths server did not start.');
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.waitForFunction(() => typeof window.portableMathDigest === 'function');
  const digests = await page.evaluate(() => window.portableMathDigest());
  assert.deepEqual(digests.main, { scalar: PORTABLE_MATH_RESULTS_SHA256, workflows: GEOMETRY_WORKFLOWS_SHA256 }, 'main realm');
  assert.deepEqual(digests.worker, { scalar: PORTABLE_MATH_RESULTS_SHA256, workflows: GEOMETRY_WORKFLOWS_SHA256 }, 'worker');
  t.diagnostic(`${process.env.LOLLY_GEOMETRY_BROWSER ?? 'chromium'} ${browser.version()}: main and worker digests match Node.`);
});
