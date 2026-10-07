// SPDX-License-Identifier: MPL-2.0
/** Isolated packaged Tauri qualification uses the desktop lock and nonpersistent WKWebView. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { openSync, closeSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { arch, cpus, release } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, type Plugin } from 'esbuild';
import { GEOMETRY_WORKFLOWS_SHA256, PORTABLE_MATH_RESULTS_SHA256 } from '../tests/helpers/portable-math-cases.ts';
import type * as HostProbe from '../tests/helpers/geometry-host-probe.ts';

const repo = fileURLToPath(new URL('../', import.meta.url));
if (process.platform !== 'darwin') throw Error('This qualification requires the macOS embedded Tauri runtime.');
const args = process.argv.slice(2), outputArg = args.find(value => value.startsWith('--output='));
if (args.some(value => value !== '--benchmark' && !value.startsWith('--output='))) throw Error('Use --benchmark and/or --output=<path>.');
const output = resolve(outputArg?.slice('--output='.length) ?? join(repo, 'plans/295-validation/geometry-tauri'));
const crate = join(output, 'crate'), frontend = join(crate, 'frontend'), target = join(output, 'target');
await mkdir(frontend, { recursive: true });
await cp(join(repo, 'tests/fixtures/geometry-tauri'), crate, { recursive: true });
await cp(join(repo, 'tests/fixtures/geometry-tauri/run.js'), join(frontend, 'run.js'));
await mkdir(join(crate, 'icons'), { recursive: true });
await cp(join(repo, 'shells/tauri-desktop/src-tauri/icons/32x32.png'), join(crate, 'icons/icon.png'));
const lock = await readFile(join(repo, 'shells/tauri-desktop/src-tauri/Cargo.lock'), 'utf8');
const packages = (source: string) => source.split('[[package]]').slice(1).map(block => ({ name: /\nname = "([^"]+)"/.exec(block)?.[1], version: /\nversion = "([^"]+)"/.exec(block)?.[1], checksum: /\nchecksum = "([^"]+)"/.exec(block)?.[1] })).filter(row => row.checksum);
const pinned = packages(lock);
for (const [name, version] of [['tauri', '2.11.6'], ['tauri-build', '2.6.3'], ['wry', '0.55.1'], ['tao', '0.35.3'], ['serde_json', '1.0.151']]) assert.ok(pinned.some(row => row.name === name && row.version === version), `Desktop lock must retain ${name} ${version}.`);
await writeFile(join(crate, 'Cargo.lock'), lock);
const run = async (command: string, commandArgs: string[], log: string, env: NodeJS.ProcessEnv = {}, timeout = 240_000) => {
  const descriptor = openSync(log, 'w');
  try {
    await new Promise<void>((resolveRun, reject) => {
      const child = spawn(command, commandArgs, { cwd: crate, env: { ...process.env, ...env }, stdio: ['ignore', descriptor, descriptor] });
      const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Error(`Timed out: ${command}. See ${log}`)); }, timeout);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); code === 0 ? resolveRun() : reject(Error(`${command} exited ${code}. See ${log}`)); });
    });
  } finally { closeSync(descriptor); }
};
// Resolve the copied lock offline, then check every registry package before compilation.
await run('cargo', ['+1.96.0', 'metadata', '--offline', '--format-version=1'], join(output, 'metadata.log'));
const resolved = packages(await readFile(join(crate, 'Cargo.lock'), 'utf8'));
for (const row of resolved) assert.ok(pinned.some(pin => pin.name === row.name && pin.version === row.version && pin.checksum === row.checksum), `Probe dependency differs from the desktop lock: ${row.name} ${row.version}.`);
const workerUrl: Plugin = { name: 'packaged-geometry-worker-url', setup(builder) {
  builder.onLoad({ filter: /shells\/web\/src\/bridge\/hook-worker\.ts$/ }, async ({ path }) => {
    const source = await readFile(path, 'utf8'), literal = "new URL('./hook-worker.worker.ts', import.meta.url)";
    assert.equal(source.split(literal).length, 2, 'One actual worker URL is rewritten to its packaged JS asset.');
    return { contents: source.replace(literal, "new URL('/geometry-hook-worker.js', import.meta.url)"), loader: 'ts', resolveDir: resolve(path, '..') };
  });
} };
const [host, revision, worker] = await Promise.all([
  build({ entryPoints: [join(repo, 'tests/helpers/geometry-host-probe.ts')], bundle: true, write: false, format: 'esm', platform: 'browser', loader: { '.css': 'empty' }, plugins: [workerUrl] }),
  build({ entryPoints: [join(repo, 'tests/helpers/geometry-revision-probe.ts')], bundle: true, write: false, format: 'esm', platform: 'browser' }),
  build({ entryPoints: [join(repo, 'shells/web/src/bridge/hook-worker.worker.ts')], bundle: true, write: false, format: 'esm', platform: 'browser' }),
]);
const hashes: Record<string, string> = {};
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
for (const [name, value] of [['host.js', host.outputFiles[0]!.text], ['revision.js', revision.outputFiles[0]!.text], ['geometry-hook-worker.js', worker.outputFiles[0]!.text]] as const) { await writeFile(join(frontend, name), value); hashes[name] = hash(value); }
const wasmDir = join(frontend, 'packages/node-shell/wasm/geometry-kernel'); await mkdir(wasmDir, { recursive: true });
for (const name of ['geometry-clip.wasm', 'geometry-fit-portable.wasm']) {
  const bytes = await readFile(join(repo, 'packages/node-shell/wasm/geometry-kernel', name));
  hashes[name] = hash(bytes); await writeFile(join(frontend, name), bytes); await writeFile(join(wasmDir, name), bytes);
}
await writeFile(join(frontend, 'revision-worker.js'), 'import {probeGeometryRevision} from "./revision.js"; probeGeometryRevision().then(result=>postMessage({result}),error=>postMessage({error:String(error)}));');
const cspModule = join(repo, 'shells/tauri-shared/vite-csp.mjs');
const { TAURI_CSP } = await import(cspModule) as { TAURI_CSP: string };
hashes.csp = hash(TAURI_CSP);
await writeFile(join(frontend, 'index.html'), `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${TAURI_CSP.replaceAll('"', '&quot;')}"></head><body><script type="module">try { const {run}=await import('./run.js'); await window.__TAURI_INTERNALS__.invoke('geometry_report',{report:await run()}); } catch(error) { await window.__TAURI_INTERNALS__.invoke('geometry_report',{report:{error:String(error),stack:error?.stack}}); }</script></body></html>`);
await run('cargo', ['+1.96.0', 'build', '--locked', '--offline', '--target-dir', target], join(output, 'build.log'), {}, 900_000);
const binary = join(target, 'debug/lolly-geometry-probe'); hashes.binary = hash(await readFile(binary));
await writeFile(join(output, 'environment.json'), JSON.stringify({ node: process.version, os: release(), arch: arch(), cpu: cpus()[0]?.model, desktopLockSha256: hash(lock), resolved, hashes, nonpersistent: true, hiddenWindow: false, backgroundThrottling: 'disabled-for-probe', note: 'Actual packaged Tauri/Wry WKWebView with the shared shell CSP. A test-only rewrite maps the actual worker factory URL to its compiled JS asset. Full product and other targets are not qualified.' }, null, 2) + '\n');
interface NativeReport { report: { error?: string; origin: string; main: { scalar: string; workflows: string }; worker: { scalar: string; workflows: string }; result: Awaited<ReturnType<typeof HostProbe.probeGeometryHosts>>; loading: Awaited<ReturnType<typeof HostProbe.probeGeometryLoadingFailure>>; workerFailure: Awaited<ReturnType<typeof HostProbe.probeGeometryWorkerFailure>>; benchmark?: Awaited<ReturnType<typeof HostProbe.benchGeometryHosts>> }; native: { refusedRequests: number } }
for (const mode of args.includes('--benchmark') ? ['qualification', 'forward', 'reverse'] : ['qualification']) {
  const reportPath = join(output, `${mode}.json`);
  await run(binary, [], join(output, `${mode}.log`), { LOLLY_GEOMETRY_PROBE_REPORT: reportPath, LOLLY_GEOMETRY_PROBE_MODE: mode });
  const { report, native } = JSON.parse(await readFile(reportPath, 'utf8')) as NativeReport;
  assert.equal(report.error, undefined); assert.equal(report.origin, 'tauri://localhost');
  if (mode === 'qualification') {
    assert.deepEqual(report.main, { scalar: PORTABLE_MATH_RESULTS_SHA256, workflows: GEOMETRY_WORKFLOWS_SHA256 }); assert.deepEqual(report.worker, report.main);
    assert.match(report.loading.message, /loading failed/); assert.equal(report.loading.unpublished, true); assert.equal(report.loading.recovered, 'wasm-portable');
    assert.match(report.workerFailure.message, /loading failed/); assert.equal(report.workerFailure.fallback, false); assert.equal(report.workerFailure.identity, 'wasm-portable'); assert.ok(native.refusedRequests >= 2);
    for (const row of report.result.modes) {
      assert.equal(row.identity, row.backend); assert.equal(row.sameApi, true); assert.equal(row.selectionRefused, true); assert.equal(row.ownership.calls, 3);
      for (const kernel of [row.ownership.clipping, row.ownership.fitting]) if (kernel) { assert.equal(kernel.bufferBytes, 0); assert.equal(kernel.results, 0); }
      for (const workflow of row.workflows) { assert.deepEqual(workflow.result, workflow.expected); assert.deepEqual(workflow.counts, workflow.expectedCounts); }
    }
    assert.equal(report.result.workers.length, 2);
    for (const row of report.result.workers) { const patch = row.patch as { note: string }; const value = JSON.parse(patch.note); assert.deepEqual(value.result, row.expected); assert.equal(value.fetchType, row.strict ? 'undefined' : 'function'); }
  } else { assert.equal(report.benchmark?.rows.length, 8); assert.equal(report.benchmark?.reversed, mode === 'reverse'); }
  console.log(`Embedded Tauri ${mode} passed: ${reportPath}`);
}
