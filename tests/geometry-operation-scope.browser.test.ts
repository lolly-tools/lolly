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
import { launchGeometryBrowser } from './helpers/geometry-browser.ts';
import type { probeGeometryOperations } from './helpers/geometry-operation-probe.ts';
declare global { interface Window { geometryOperationProbe: typeof probeGeometryOperations } }

test('shell-loaded operation owners retain exact local results and counters in the selected browser and its worker', { timeout: 120_000 }, async t => {
  let browser: Browser;
  try { browser = await launchGeometryBrowser(); }
  catch (error) { if (process.env.LOLLY_GEOMETRY_REQUIRED === '1') throw error; t.skip('Geometry operation qualification requires the selected browser.'); return; }
  t.after(() => browser.close());
  const [bundle, clip, fit] = await Promise.all([
    build({ entryPoints: [fileURLToPath(new URL('./helpers/geometry-operation-probe.ts', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'browser' }),
    readFile(new URL('../packages/node-shell/wasm/geometry-kernel/geometry-clip.wasm', import.meta.url)),
    readFile(new URL('../packages/node-shell/wasm/geometry-kernel/geometry-fit-portable.wasm', import.meta.url)),
  ]);
  const server = createServer((req, res) => {
    if (req.url === '/entry.js') { res.setHeader('content-type', 'text/javascript'); res.end(bundle.outputFiles[0]!.text); }
    else if (req.url === '/worker.js') { res.setHeader('content-type', 'text/javascript'); res.end('import {probeGeometryOperations} from "/entry.js"; onmessage=async()=>{try{postMessage({result:await probeGeometryOperations()})}catch(error){postMessage({error:String(error)})}};'); }
    else if (req.url === '/geometry-clip.wasm' || req.url === '/geometry-fit-portable.wasm') { res.setHeader('content-type', 'application/wasm'); res.end(req.url === '/geometry-clip.wasm' ? clip : fit); }
    else { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><script type="module">import {probeGeometryOperations} from "/entry.js"; window.geometryOperationProbe=probeGeometryOperations;</script>'); }
  });
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw Error('Geometry qualification server did not start.');
  const page = await browser.newPage(); await page.goto(`http://127.0.0.1:${address.port}/`); await page.waitForFunction(() => Boolean(window.geometryOperationProbe));
  const main = await page.evaluate(() => window.geometryOperationProbe());
  const worker = await page.evaluate(async () => {
    const owner = new Worker('/worker.js', { type: 'module' });
    try { return await new Promise<Awaited<ReturnType<typeof probeGeometryOperations>>>((resolve, reject) => {
      owner.onmessage = e => e.data.error ? reject(Error(e.data.error)) : resolve(e.data.result);
      owner.onerror = e => reject(Error(e.message)); owner.postMessage(null);
    }); } finally { owner.terminate(); }
  });
  assert.deepEqual(worker, main, 'Complete owned results, work counters and resource accounting agree across browser realms.');
  for (const row of main.workflows) for (const candidate of [row.clipping, row.combined]) {
    assert.deepEqual(candidate.result, row.reference.result, row.id); assert.deepEqual(candidate.counts, row.reference.counts, row.id);
  }
  for (const module of [main.clipping, main.fitting]) { assert.equal(module!.results, 0); assert.equal(module!.bufferBytes, 0); assert.ok(module!.linearBytes <= 16 * 1024 * 1024); }
  const report = process.env.LOLLY_GEOMETRY_SCOPE_REPORT;
  if (report) {
    await mkdir(dirname(report), { recursive: true });
    await writeFile(report, JSON.stringify({ engine: process.env.LOLLY_GEOMETRY_BROWSER ?? 'chromium', browser: browser.version(), workflows: main.workflows, clipping: main.clipping, fitting: main.fitting,
      artifactHashes: { clipping: createHash('sha256').update(clip).digest('hex'), fitting: createHash('sha256').update(fit).digest('hex') },
      note: 'Actual dependency boundary without source substitutions. Exact local legacy results and counters; host maths retains its existing cross-host differences. No native or embedded-webview qualification or live activation.' }, null, 2) + '\n');
  }
  t.diagnostic(`${main.workflows.length} workflows, clipping and combined host-fitting variants, exact local reference parity in both browser realms.`);
});
