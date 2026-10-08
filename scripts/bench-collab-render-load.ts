// SPDX-License-Identifier: MPL-2.0
/** Two real Work collaborators, durable Chromium exports, asset transfers and reconnect. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { chromium, type Page } from 'playwright-core';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';
import { traceCollabBrowser, beginCollabSample, readCollabTrace, startCpuProfile, verifyExportFidelity } from './lib/collab-load-browser.ts';
import { sampleProcessTrees } from './lib/collab-load-processes.ts';
import { serveCollabBuild } from './lib/collab-load-static.ts';
import { measureRenderCancellation } from './lib/collab-load-cancellation.ts';

const dist = process.env.LOLLY_WEB_DIST;
const root = resolve(import.meta.dirname, '..'), work = resolve(root, '../lolly-work');
const samples = Number(process.env.LOLLY_LOAD_SAMPLES ?? 30);
const sceneRows = Number(process.env.LOLLY_LOAD_ROWS ?? 200);
const renderCount = Number(process.env.LOLLY_LOAD_RENDERS ?? 12);
assert.ok(Number.isInteger(samples) && samples > 0, 'LOLLY_LOAD_SAMPLES must be a positive integer');
assert.ok(Number.isInteger(sceneRows) && sceneRows >= 3, 'LOLLY_LOAD_ROWS must be an integer of at least three');
assert.ok(Number.isInteger(renderCount) && renderCount > 0, 'LOLLY_LOAD_RENDERS must be a positive integer');
const out = process.env.LOLLY_LOAD_REPORT ?? '/tmp/lolly-collab-render-load.json';
type Paint = { dom: number; painted: number; visibility: string };
type Row = { id: string; [key: string]: unknown };
interface Fixture {
  base: string; sessionId: string; inputs: { boxes: Row[] };
  collabCommits(): { start: number; end: number; operations: number; revision: number }[];
  renderClaims(): { id: string; queueMs: number; attempt: number }[];
  renderStats(): { active: number; concurrency: number } | undefined;
  suspendConnections(): void; resumeConnections(): void; close(): Promise<void>;
}
const cleanups: (() => void | Promise<void>)[] = [];
try {
const staticServer = dist ? await serveCollabBuild(dist) : undefined;
cleanups.push(() => staticServer?.close());
const web = staticServer?.base ?? process.env.LOLLY_COLLAB_TEST_URL ?? 'http://127.0.0.1:5198';
const worker = spawn(process.execPath, ['--input-type=module', '-e', `
  const {server}=await import(${JSON.stringify(pathToFileURL(resolve(work, 'workers/render/src/server.ts')).href)});
  const ready=()=>console.log('WORKER_PORT='+server.address().port);
  if(server.listening)ready();else server.once('listening',ready);
`], { cwd: work, env: { ...process.env, PORT: '0', LOLLY_WEB_BASE: web, LOLLY_BROWSER_CHANNEL: 'chrome',
  LW_RENDER_WORKER_SECRET: 'load-test-only', LW_RENDER_MAX_CONCURRENT: '2' }, stdio: ['ignore', 'pipe', 'pipe'] });
cleanups.push(() => { worker.kill('SIGTERM'); });
let workerLog = '';
worker.stderr.on('data', bytes => { workerLog += String(bytes); });
const port = await new Promise<number>((yes, no) => {
  const timer = setTimeout(() => { worker.kill('SIGTERM'); no(new Error(`worker startup timeout: ${workerLog}`)); }, 20_000);
  worker.once('error', error => { clearTimeout(timer); no(error); });
  worker.stdout.on('data', bytes => {
    workerLog += String(bytes);
    const match = /WORKER_PORT=(\d+)/.exec(workerLog);
    if (match) { clearTimeout(timer); yes(Number(match[1])); }
  });
  worker.once('exit', code => { clearTimeout(timer); no(new Error(`worker exited ${code}: ${workerLog}`)); });
});
const { createWorkBrowserFixture } = await import(pathToFileURL(resolve(work, 'tests/collab/browser-fixture.ts')).href) as {
  createWorkBrowserFixture(root: string, web: string, options: { shapeCount: number; renderWorker: { url: string; secret: string }; store?: unknown; productionPack?: string; invites?: boolean; httpRateLimit?: boolean }): Promise<Fixture>;
};
let fixture: Fixture | undefined;
const pgFixture = process.env.LOLLY_LOAD_POSTGRES === '1'
  ? await (await import(pathToFileURL(resolve(work, 'tests/collab/postgres-fixture.ts')).href)).createCollabPostgresFixture() as { store: unknown; pid: number; version: string; close(): Promise<void> }
  : undefined;
cleanups.push(() => pgFixture?.close());
const browser = await chromium.launch({ channel: 'chrome', headless: true, handleSIGINT: false, handleSIGTERM: false, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', ...webGpuLaunchArgs('auto')] }).catch(error => { worker.kill('SIGTERM'); throw error; });
cleanups.push(() => browser.close());
const interrupted = () => { worker.kill('SIGTERM'); void browser.close(); };
process.once('SIGINT', interrupted); process.once('SIGTERM', interrupted);
const loop = monitorEventLoopDelay({ resolution: 10 });
const errors: string[] = [];
const sentOps = new Map<Page, number>();
let monitor: ReturnType<typeof setInterval> | undefined;
let processes: ReturnType<typeof sampleProcessTrees> | undefined;
const pause = (ms: number) => new Promise(yes => setTimeout(yes, ms));
const summary = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return { samples: values, p50: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * .95) - 1)], max: sorted.at(-1) };
};
try {
  fixture = await createWorkBrowserFixture(root, web, { shapeCount: sceneRows - 3, store: pgFixture?.store, productionPack: dist, invites: Boolean(dist), httpRateLimit: Boolean(dist), renderWorker: { url: `http://127.0.0.1:${port}`, secret: 'load-test-only' } });
  const base = fixture.base;
  const open = async (email: string) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    await traceCollabBrowser(context);
    await context.addInitScript(() => localStorage.setItem('lolly-welcome-dismissed', '1'));
    const auth = await context.request.get(`${base}/api/auth/dev?email=${email}`, { maxRedirects: 0 });
    assert.equal(auth.status(), 302);
    const page = await context.newPage(); sentOps.set(page, 0);
    page.on('websocket', socket => {
      if (!socket.url().includes('/ws/collab/')) return;
      socket.on('framesent', event => {
        try {
          const frame = JSON.parse(String(event.payload));
          if (frame.t === 'ops') sentOps.set(page, sentOps.get(page)! + frame.ops.length);
        } catch { /* Non-JSON transport diagnostics are irrelevant here. */ }
      });
    });
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) console.log(email, message.type(), message.text()); });
    page.on('pageerror', error => { errors.push(error.message); console.error(email, error.message); });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('.gallery').waitFor();
    if (dist) {
      const invite = page.locator(`[data-collab-invite="${fixture!.sessionId}"] [data-act="open-collab"]`);
      await invite.focus(); await invite.press('Enter');
    } else {
      await page.waitForFunction(async () => {
        const config = '/src/org/collab-config.ts', mount = '/src/lib/collab-live-mount.ts';
        return (await import(config)).canJoinCollab() && (await import(mount)).liveCollabMountInstalled();
      });
      const joined = await page.evaluate(async sessionId => {
        const path = '/src/org/collab-work-opener.ts';
        return (await import(path)).joinWorkCollabFromInvite({ sessionId, toolId: 'design' });
      }, fixture!.sessionId);
      assert.equal(joined.ok, true, JSON.stringify({ email, joined }));
    }
    try { await page.locator('#tool-canvas [data-box-id="shape"]').waitFor({ state: 'attached' }); }
    catch (error) { console.log(JSON.stringify({ email, errors, state: await page.evaluate(() => ({ hash: location.hash, body: document.body.innerText.slice(-3000), canvas: document.querySelector('#tool-canvas')?.outerHTML.slice(-4000) })) })); throw error; }
    await page.locator('.collab-pill', { hasText: 'Saved to work' }).waitFor();
    console.log('Opened collaborator', email);
    return page;
  };
  const alice = await open('alice@test'), bob = await open('bob@test');
  let boxes = await alice.evaluate(() => JSON.parse(document.querySelector('script[data-penpot-doc]')!.textContent!).boxes as Row[]);
  assert.equal(boxes.length, sceneRows, 'fixture has no hidden or omitted rows');
  assert.deepEqual(boxes.map(row => row.id), fixture.inputs.boxes.map(row => row.id));
  let x = 60, sampleId = 0;
  const browserSession = await browser.newBrowserCDPSession();
  const { processInfo } = await browserSession.send('SystemInfo.getProcessInfo');
  const editorPid = processInfo.find(row => row.type === 'browser')!.id;
  await browserSession.detach();
  processes = sampleProcessTrees({ control: process.pid, render: worker.pid!, editors: editorPid, ...(pgFixture ? { postgres: pgFixture.pid } : {}) });
  await processes.sample();
  const stopAliceProfile = await startCpuProfile(alice), stopBobProfile = await startCpuProfile(bob);
  const setX = async (page: Page, next: number) => {
    boxes = boxes.map(row => row.id === 'shape' ? { ...row, x: next } : row);
    return page.evaluate(rows => {
      const started = performance.timeOrigin + performance.now();
      (window as unknown as { __lollySetInput(id: string, value: unknown): void }).__lollySetInput('boxes', rows);
      return { started, inputMs: performance.timeOrigin + performance.now() - started };
    }, boxes);
  };
  const phase = async () => {
    const latencies: number[] = [];
    const activeAtInput: number[] = [], operationsPerInput: number[] = [];
    const domLatency: number[] = [], animationDelay: number[] = [], localInputMs: number[] = [];
    const visibility = new Set<string>();
    const inputs: { sample: number; at: number; dom: number; painted: number }[] = [];
    for (let i = 0; i < samples; i++) {
      x += 1; sampleId++;
      await Promise.all([beginCollabSample(alice, sampleId), beginCollabSample(bob, sampleId)]);
      await bob.evaluate(expected => {
        const state = window as unknown as { loadPaint?: Promise<Paint> };
        state.loadPaint = new Promise((yes, no) => {
          const timer = setTimeout(() => { observer.disconnect(); no(new Error('remote paint timeout')); }, 15_000);
          const observer = new MutationObserver(() => {
            if (document.querySelector<HTMLElement>('#tool-canvas [data-box-id="shape"]')?.style.left !== `${expected}px`) return;
            observer.disconnect();
            const dom = performance.timeOrigin + performance.now();
            requestAnimationFrame(() => requestAnimationFrame(() => {
              clearTimeout(timer); yes({ dom, painted: performance.timeOrigin + performance.now(), visibility: document.visibilityState });
            }));
          });
          observer.observe(document.querySelector('#tool-canvas')!, { subtree: true, childList: true, attributes: true });
        });
      }, x);
      activeAtInput.push(fixture!.renderStats()?.active ?? 0);
      const beforeOps = sentOps.get(alice)!;
      const { started, inputMs } = await setX(alice, x);
      const paint = await bob.evaluate(() => (window as unknown as { loadPaint: Promise<Paint> }).loadPaint);
      inputs.push({ sample: sampleId, at: started, dom: paint.dom, painted: paint.painted });
      operationsPerInput.push(sentOps.get(alice)! - beforeOps);
      latencies.push(paint.painted - started);
      domLatency.push(paint.dom - started); animationDelay.push(paint.painted - paint.dom);
      localInputMs.push(inputMs); visibility.add(paint.visibility);
    }
    return { ...summary(latencies), domLatency: summary(domLatency), animationDelay: summary(animationDelay), localInputMs: summary(localInputMs), visibility: [...visibility], activeAtInput, operationsPerInput, inputs };
  };
  const baseline = await phase();
  console.log('Baseline measured', baseline.p95);
  const renderContext = await browser.newContext();
  const request = renderContext.request;
  assert.equal((await request.get(`${base}/api/auth/dev?email=admin@test`, { maxRedirects: 0 })).status(), 302);
  const renderIds: string[] = [];
  for (let n = 0; n < renderCount; n++) {
    const response = await request.post(`${base}/api/v1/renders`, { data: { toolId: 'design', format: 'svg', inputs: { boxes, background: n % 2 ? '#ffffff' : '#fefefe' }, maxAttempts: 1 } });
    assert.equal(response.status(), 202, await response.text());
    renderIds.push((await response.json()).id);
    console.log('Queued render', n + 1);
  }
  let assetBytes = 0;
  const transfers = Promise.all(Array.from({ length: 2 }, async () => {
    for (let n = 0; n < 20; n++) {
      const response = await request.get(`${base}/fonts/SUSE[wght].ttf?load=${n}`);
      assert.equal(response.status(), 200);
      const bytes = await response.body();
      assert.equal(bytes.readUInt32BE(0), 0x00010000, 'asset transfer contains the requested TrueType font');
      assetBytes += bytes.length;
      await pause(50);
    }
  }));
  void transfers.catch(() => {});
  let peakRss = process.memoryUsage().rss, peakActive = 0;
  monitor = setInterval(() => { peakRss = Math.max(peakRss, process.memoryUsage().rss); peakActive = Math.max(peakActive, fixture!.renderStats()?.active ?? 0); }, 20);
  loop.enable();
  const loaded = await phase();
  console.log('Loaded edits measured', loaded.p95);
  writeFileSync(out + '.alice.cpuprofile', JSON.stringify(await stopAliceProfile()));
  writeFileSync(out + '.bob.cpuprofile', JSON.stringify(await stopBobProfile()));
  const browserSpans = { alice: await readCollabTrace(alice), bob: await readCollabTrace(bob) };
  fixture.suspendConnections();
  await pause(200);
  x += 1; await setX(alice, x);
  const reconnectStart = Date.now();
  fixture.resumeConnections();
  await bob.waitForFunction(expected => document.querySelector<HTMLElement>('#tool-canvas [data-box-id="shape"]')?.style.left === `${expected}px`, x, { timeout: 20_000 });
  const reconnectMs = Date.now() - reconnectStart;
  const deadline = Date.now() + 120_000;
  let renders: { id: string; state: string; requestHash: string; createdAt: string; finishedAt?: string; output?: { url: string; size: number; sha256: string }; error?: unknown }[] = [];
  while (Date.now() < deadline) {
    const response = await request.get(`${base}/api/v1/renders?limit=100`);
    assert.equal(response.status(), 200, await response.text());
    const body = await response.json();
    renders = body.renders.filter((row: { id: string }) => renderIds.includes(row.id));
    if (renders.length === renderIds.length && renders.every(row => ['succeeded', 'failed', 'cancelled'].includes(row.state))) break;
    await pause(1000);
  }
  await transfers; clearInterval(monitor); loop.disable();
  const artifacts = [];
  for (const render of renders) {
    if (render.state !== 'succeeded' || !render.output) continue;
    const response = await request.get(`${base}${render.output.url}`);
    assert.equal(response.status(), 200);
    const bytes = await response.body(), sha256 = createHash('sha256').update(bytes).digest('hex');
    assert.equal(bytes.length, render.output.size); assert.equal(sha256, render.output.sha256);
    assert.match(bytes.toString('utf8'), /<svg[\s>]/);
    const svg = await bob.evaluate(source => {
      const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
      return { error: Boolean(doc.querySelector('parsererror')), viewBox: doc.documentElement.getAttribute('viewBox'), shapes: doc.querySelectorAll('rect,path,polygon').length };
    }, bytes.toString('utf8'));
    assert.equal(svg.error, false); assert.ok(svg.shapes >= sceneRows - 2, 'export retains scene geometry');
    artifacts.push({ id: render.id, bytes: bytes.length, sha256, ...svg });
  }
  const processSamples = await processes.stop(); processes = undefined;
  let exportWarnings: Awaited<ReturnType<typeof verifyExportFidelity>> | null = null;
  const report = { buildIndexSha256: dist ? createHash('sha256').update(readFileSync(resolve(dist, 'index.html'))).digest('hex') : null, browserSpans, serverCommits: fixture.collabCommits(), processSamples, input: 'One x-coordinate edit retaining the mounted scene defaults', date: new Date().toISOString(), browser: browser.version(), node: process.version, shell: dist ? 'production build' : 'Vite development', store: pgFixture?.version ?? 'memory', httpRateLimit: dist ? 'enabled' : 'disabled in fixture; WebSocket and render admission limits remain enabled',
    exportWarnings, collaborators: 2, sceneRows: boxes.length, renderConcurrency: 2, renderCount: renderIds.length,
    measurement: 'Model input to remote DOM mutation plus two animation frames; same-machine performance clocks. Not compositor presentation time.',
    baseline, loaded, renderClaims: fixture.renderClaims(), reconnectMs, assetBytes, peakControlProcessRss: peakRss, peakActive,
    controlEventLoopDelayMs: { p95: loop.percentile(95) / 1e6, max: loop.max / 1e6 }, renders: renders.map(({ id, state, requestHash, createdAt, finishedAt, error }) => ({ id, state, requestHash, createdAt, finishedAt, completionMs: finishedAt ? Date.parse(finishedAt) - Date.parse(createdAt) : null, error })), artifacts, errors, workerLog };
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  let cancellation: Awaited<ReturnType<typeof measureRenderCancellation>>;
  if (process.env.LOLLY_LOAD_VERIFY_EXPORT === '1') {
    try { exportWarnings = await verifyExportFidelity(alice, boxes); }
    catch (error) {
      writeFileSync(out, JSON.stringify({ ...report, exportWarnings: { error: String(error) }, workerLog }, null, 2) + '\n');
      throw error;
    }
  }
  try {
    cancellation = await measureRenderCancellation(request, base, `http://127.0.0.1:${port}`, boxes, () => fixture!.renderStats()?.active ?? 0);
  } catch (error) {
    writeFileSync(out, JSON.stringify({ ...report, exportWarnings, cancellation: { error: String(error) }, workerLog }, null, 2) + '\n');
    throw error;
  }
  writeFileSync(out, JSON.stringify({ ...report, exportWarnings, cancellation, workerLog }, null, 2) + '\n');
  console.log(JSON.stringify({ out, baselineP95: baseline.p95, loadedP95: loaded.p95, reconnectMs, peakActive, renders: renders.map(r => r.state), errors }, null, 2));
  assert.ok([...baseline.operationsPerInput, ...loaded.operationsPerInput].every(count => count === 1), 'coordinate edits must not amplify into unrelated operations');
  assert.ok(loaded.activeAtInput.some(count => count > 0), 'edits overlapped rendering');
  assert.equal(renders.length, renderIds.length);
  assert.equal(artifacts.length, renderIds.length, 'all retained artifacts verified');
  assert.ok(renders.every(row => row.state === 'succeeded'), JSON.stringify(renders.map(({id,state,error})=>({id,state,error}))));
  assert.equal(errors.length, 0, errors.join('\n'));
} finally {
  process.removeListener('SIGINT', interrupted); process.removeListener('SIGTERM', interrupted);
  clearInterval(monitor); loop.disable();
  try { await processes?.stop(); await browser.close(); } finally {
    worker.kill('SIGTERM');
    await fixture?.close();
  }
}
} finally {
  const failures: unknown[] = [];
  for (const cleanup of cleanups.reverse()) {
    try { await cleanup(); } catch (error) { failures.push(error); }
  }
  if (failures.length) {
    console.error(new AggregateError(failures, 'load benchmark cleanup failed'));
    process.exitCode = 1;
  }
}
