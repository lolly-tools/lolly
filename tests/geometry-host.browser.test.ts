// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { arch, cpus, platform, release } from 'node:os';
import type { Browser } from 'playwright';
import { launchGeometryBrowser } from './helpers/geometry-browser.ts';
import type * as Probe from './helpers/geometry-host-probe.ts';
import type { GeometryBackend } from '../packages/node-shell/src/geometry-host.ts';
declare global { interface Window { geometryHostProbe: typeof Probe } }

test('actual web installers and isolated hooks retain selected geometry and refuse loading fallback', { timeout: 120_000 }, async t => {
  let browser: Browser;
  try { browser = await launchGeometryBrowser(); }
  catch (error) { if (process.env.LOLLY_GEOMETRY_REQUIRED === '1') throw error; t.skip('Geometry host qualification requires the selected browser.'); return; }
  t.after(() => browser.close());
  const [entry, worker, clip, fit, clipNorm, fitNorm] = await Promise.all([
    build({ entryPoints: [fileURLToPath(new URL('./helpers/geometry-host-probe.ts', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'browser', loader: { '.css': 'empty' } }),
    build({ entryPoints: [fileURLToPath(new URL('../shells/web/src/bridge/hook-worker.worker.ts', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'browser' }),
    readFile(new URL('../packages/node-shell/wasm/geometry-kernel/geometry-clip.wasm', import.meta.url)),
    readFile(new URL('../packages/node-shell/wasm/geometry-kernel/geometry-fit.wasm', import.meta.url)),
    readFile(new URL('../packages/node-shell/wasm/geometry-kernel/geometry-clip-host-norm.wasm', import.meta.url)),
    readFile(new URL('../packages/node-shell/wasm/geometry-kernel/geometry-fit-host-norm.wasm', import.meta.url)),
  ]);
  const binaries: Record<string, Buffer> = { 'geometry-clip.wasm': clip, 'geometry-fit.wasm': fit, 'geometry-clip-host-norm.wasm': clipNorm, 'geometry-fit-host-norm.wasm': fitNorm };
  let blocked = false;
  const server = createServer((req, res) => {
    const path = new URL(req.url!, 'http://localhost').pathname;
    if (path === '/control') { blocked = req.url!.includes('blocked=1'); res.end('ok'); }
    else if (path === '/entry.js') { res.setHeader('content-type', 'text/javascript'); res.end(entry.outputFiles[0]!.text); }
    else if (path.endsWith('/hook-worker.worker.ts')) { res.setHeader('content-type', 'text/javascript'); res.end(worker.outputFiles[0]!.text); }
    else if (binaries[path.split('/').at(-1)!]) {
      if (blocked) { res.statusCode = 503; res.end('Deliberate geometry loading refusal'); }
      else { res.setHeader('content-type', 'application/wasm'); res.end(binaries[path.split('/').at(-1)!]); }
    } else { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><script type="module">import * as probe from "/entry.js"; window.geometryHostProbe=probe;</script>'); }
  });
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw Error('Geometry host server did not start.');
  const page = await browser.newPage(); await page.goto(`http://127.0.0.1:${address.port}/`); await page.waitForFunction(() => Boolean(window.geometryHostProbe));
  const normOnly = process.env.LOLLY_GEOMETRY_HOST_NORM === '1';
  const chromium = (process.env.LOLLY_GEOMETRY_BROWSER ?? 'chromium') === 'chromium';
  const result = await page.evaluate(({ normOnly, chromium }) => window.geometryHostProbe.probeGeometryHosts(normOnly ? ['typescript', 'wasm-host-norm-clipping', 'wasm-host-norm-fitting', 'wasm-host-norm-curves', ...(chromium ? ['wasm-host-curves' as const] : [])] : undefined), { normOnly, chromium });
  const policyBench = process.env.LOLLY_GEOMETRY_POLICY_BENCH === '1';
  const benchmark = process.env.LOLLY_GEOMETRY_HOST_BENCH === '1' ? await page.evaluate(({ reverse, policyBench, chromium }) => window.geometryHostProbe.benchGeometryHosts(reverse, policyBench ? chromium ? ['typescript', 'wasm-host-fitting', 'wasm-host-norm-fitting', 'wasm-host-curves', 'wasm-host-norm-curves'] : ['typescript', 'wasm-host-norm-clipping', 'wasm-host-norm-fitting', 'wasm-host-norm-curves'] : undefined), { reverse: process.env.LOLLY_GEOMETRY_REVERSE === '1', policyBench, chromium }) : undefined;
  const failureBackend: GeometryBackend = normOnly ? 'wasm-host-norm-curves' : 'wasm-host-curves';
  blocked = true; const loading = await page.evaluate((backend: GeometryBackend) => window.geometryHostProbe.probeGeometryLoadingFailure(backend), failureBackend);
  const workerFailure = await page.evaluate((backend: GeometryBackend) => window.geometryHostProbe.probeGeometryWorkerFailure(backend), failureBackend);
  const report = process.env.LOLLY_GEOMETRY_HOST_REPORT;
  if (report) {
    const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
    const sourceArtifact = report + '.source.mjs';
    await mkdir(dirname(report), { recursive: true }); await writeFile(sourceArtifact, entry.outputFiles[0]!.text);
    await writeFile(report, JSON.stringify({ engine: process.env.LOLLY_GEOMETRY_BROWSER ?? 'chromium', browser: browser.version(), machine: { node: process.version, platform: platform(), arch: arch(), os: release(), cpu: cpus()[0]?.model }, artifacts: { clipping: hash(clipNorm), fitting: hash(fitNorm) }, sourceArtifact, sourceSha256: hash(Buffer.from(entry.outputFiles[0]!.text)), result, loading, workerFailure, benchmark }, null, 2) + '\n');
  }
  assert.match(loading.message, /loading failed/); assert.equal(loading.unpublished, true); assert.equal(loading.recovered, failureBackend);
  assert.match(workerFailure.message, /loading failed/); assert.equal(workerFailure.fallback, false); assert.equal(workerFailure.identity, failureBackend);
  for (const mode of result.modes) {
    assert.equal(mode.identity, mode.backend); assert.equal(mode.sameApi, true); assert.equal(mode.selectionRefused, true); assert.equal(mode.ownership.calls, 3);
    for (const kernel of [mode.ownership.clipping, mode.ownership.fitting]) if (kernel) { assert.equal(kernel.bufferBytes, 0); assert.equal(kernel.results, 0); assert.ok(kernel.linearBytes <= 16 * 1024 * 1024); }
    for (const row of mode.workflows) { assert.deepEqual(row.result, row.expected, `${mode.backend}/${row.id}`); assert.deepEqual(row.counts, row.expectedCounts, `${mode.backend}/${row.id}`); }
  }
  for (const row of result.workers) { const patch = row.patch as { note: string }; const value = JSON.parse(patch.note); assert.deepEqual(value.result, row.expected); assert.equal(value.fetchType, row.strict ? 'undefined' : 'function'); }
  t.diagnostic(`Actual installer and ${result.workers.length} isolated hook mounts; loading refusal and retry, no selected fallback, and per-call resource release.`);
});
