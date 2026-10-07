// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import type { Browser } from 'playwright';
import { clipComparisonPlugin } from '../scripts/lib/geometry-clip-comparison.ts';
import { offsetFitComparisonPlugin } from '../scripts/lib/geometry-offset-fit-comparison.ts';
import { loadGeometryFitting } from '../packages/node-shell/src/geometry-fitting-node.ts';
import { canonicalClipCases, clipCases, clipWire, seededClipCases } from './helpers/geometry-clip-cases.ts';
import { offsetFitCases, seededOffsetFitCases } from './helpers/geometry-offset-fit-cases.ts';
import { launchGeometryBrowser } from './helpers/geometry-browser.ts';
import { assertHostNorm } from './helpers/geometry-host-norm-assert.ts';
import type { probeHostNorm } from './helpers/geometry-host-norm-qualification.ts';
declare global { interface Window { hostNormProbe: typeof probeHostNorm } }

test('host norm retains exact local controls, contact bits and all work decisions in the browser and worker', { timeout: 120_000 }, async t => {
  let browser: Browser;
  try { browser = await launchGeometryBrowser(); }
  catch (error) { if (process.env.LOLLY_GEOMETRY_REQUIRED === '1') throw error; t.skip('Host norm qualification requires the selected browser.'); return; }
  t.after(() => browser.close());
  const [entry, clip, fit, portable] = await Promise.all([
    build({ entryPoints: [fileURLToPath(new URL('./helpers/geometry-host-norm-qualification.ts', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'browser', plugins: [offsetFitComparisonPlugin(), clipComparisonPlugin()] }),
    readFile(new URL('../packages/node-shell/wasm/geometry-kernel/geometry-clip-host-norm.wasm', import.meta.url)),
    readFile(new URL('../packages/node-shell/wasm/geometry-kernel/geometry-fit-host-norm.wasm', import.meta.url)),
    loadGeometryFitting('portable'),
  ]);
  const inputs = { fitting: [...offsetFitCases(), ...seededOffsetFitCases()], clipping: [...clipCases(), ...seededClipCases(), ...canonicalClipCases(portable)].map(clipWire) };
  const original = structuredClone(inputs);
  const server = createServer((req, res) => {
    if (req.url === '/entry.js') { res.setHeader('content-type', 'text/javascript'); res.end(entry.outputFiles[0]!.text); }
    else if (req.url === '/worker.js') { res.setHeader('content-type', 'text/javascript'); res.end('import {probeHostNorm} from "/entry.js"; onmessage=async e=>{try{postMessage({result:await probeHostNorm(e.data)})}catch(error){postMessage({error:String(error)})}};'); }
    else if (req.url === '/geometry-clip-host-norm.wasm' || req.url === '/geometry-fit-host-norm.wasm') { res.setHeader('content-type', 'application/wasm'); res.end(req.url.includes('clip') ? clip : fit); }
    else { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><script type="module">import {probeHostNorm} from "/entry.js"; window.hostNormProbe=probeHostNorm;</script>'); }
  });
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw Error('Host norm server did not start.');
  const page = await browser.newPage(); await page.goto(`http://127.0.0.1:${address.port}/`); await page.waitForFunction(() => Boolean(window.hostNormProbe));
  const main = await page.evaluate(inputs => window.hostNormProbe(inputs), inputs);
  const worker = await page.evaluate(async inputs => {
    const worker = new Worker('/worker.js', { type: 'module' });
    try { return await new Promise<Awaited<ReturnType<typeof probeHostNorm>>>((resolve, reject) => {
      worker.onmessage = e => e.data.error ? reject(Error(e.data.error)) : resolve(e.data.result); worker.onerror = e => reject(Error(e.message)); worker.postMessage(inputs);
    }); } finally { worker.terminate(); }
  }, inputs);
  const report = process.env.LOLLY_GEOMETRY_NORM_REPORT, hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
  if (report) { await mkdir(dirname(report), { recursive: true }); await writeFile(report, JSON.stringify({ engine: process.env.LOLLY_GEOMETRY_BROWSER ?? 'chromium', browser: browser.version(), node: process.version, firefoxOverride: process.env.LOLLY_GEOMETRY_FIREFOX_OVERRIDE ?? null, artifacts: { clipping: hash(clip), fitting: hash(fit) }, inputSha256: hash(JSON.stringify(inputs)), main, worker }, null, 2) + '\n'); }
  assert.deepEqual(inputs, original); assert.deepEqual(worker, main, 'Complete controls, contact bits, counters and resources agree between realms.'); assertHostNorm(main);
  t.diagnostic(`${browser.version()}: ${main.fits.length} fits, ${main.pairs.cases.length} pairs, ${main.pairs.workflows.length} clipping workflows and ${main.operations.workflows.length} scoped workflows per realm. Exact local legacy equality with resource release.`);
});
