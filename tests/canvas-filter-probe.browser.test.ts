// SPDX-License-Identifier: MPL-2.0
/**
 * The ctx.filter functional probe - THE BROWSER TIER (plan 104 §11 S1).
 *
 * `shells/web/src/lib/canvas-filter-probe.test.ts` pins the decision table headlessly
 * against stub contexts. What no Node process can answer is the question the spike was
 * actually asked: does a REAL engine spread ink when `ctx.filter = 'blur(2px)'`, and
 * does it answer the same way on a main-thread canvas, on an OffscreenCanvas, and on an
 * OffscreenCanvas inside a Worker? This file measures that, in the browser, running the
 * shipped module rather than a copy of it.
 *
 * It asserts nothing engine-specific - a build with no `ctx.filter` at all (WebKit 26.5
 * is one, measured 2026-08-11) passes these assertions with every verdict false. What is
 * asserted is that the module's verdict MATCHES an independent in-page measurement, and
 * that all three context kinds agree, which is §11 S1's "per-engine, not per-thread"
 * claim. The measured matrix is logged either way.
 *
 * GATING follows `sequence-render.browser.test.ts`: no browser installed -> the whole
 * suite skips naming the install command, so `npm test` stays green on a bare machine.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Browser, BrowserContext, Page } from 'playwright-core';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { browserGate } from './helpers/sequence-browser.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE = join(HERE, '..', 'shells', 'web', 'src', 'lib', 'canvas-filter-probe.ts');

/** What one context kind reported: the module's verdict, plus the raw numbers behind it. */
interface KindReport {
  verdict: boolean | string;
  present: boolean;
  readback?: string;
  control: number | null;
  blurred: number | null;
  err?: string;
}
interface Matrix {
  ua: string;
  main: KindReport;
  offscreenMain: KindReport;
  offscreenWorker: KindReport;
}

/**
 * The measurement, run inside the page. Deliberately re-implements the raw read
 * (16x16, square [6,10), sample x=11 y=8) instead of reusing the module's internals:
 * a probe that agrees with an independent measurement is evidence, a probe compared
 * with itself is not.
 */
const IN_PAGE = `(async () => {
  const raw = (mk) => {
    try {
      const ctx = mk(16, 16);
      if (!ctx) return { present: false, control: null, blurred: null, err: 'no 2d context' };
      if (!('filter' in ctx)) return { present: false, control: null, blurred: null };
      ctx.filter = 'none'; ctx.clearRect(0,0,16,16); ctx.fillStyle = '#fff'; ctx.fillRect(6,6,4,4);
      const control = ctx.getImageData(11,8,1,1).data[3];
      ctx.filter = 'blur(2px)';
      const readback = ctx.filter;
      ctx.clearRect(0,0,16,16); ctx.fillRect(6,6,4,4);
      const blurred = ctx.getImageData(11,8,1,1).data[3];
      return { present: true, readback, control, blurred };
    } catch (e) { return { present: false, control: null, blurred: null, err: String(e) }; }
  };
  const mkMain = (w,h) => { const c = document.createElement('canvas'); c.width=w; c.height=h; return c.getContext('2d'); };
  const mkOff = (w,h) => (typeof OffscreenCanvas === 'undefined' ? null : new OffscreenCanvas(w,h).getContext('2d'));

  window.PROBE.resetCanvasFilterProbeCache();
  const main = { ...raw(mkMain), verdict: window.PROBE.canvasFilterWorks(mkMain(4,4)) };
  const offCtx = mkOff(4,4);
  const offscreenMain = { ...raw(mkOff), verdict: offCtx ? window.PROBE.canvasFilterWorks(offCtx) : 'no OffscreenCanvas' };

  const offscreenWorker = await new Promise((res) => {
    try {
      const w = new Worker('/worker.js', { type: 'module' });
      const t = setTimeout(() => { res({ present: false, control: null, blurred: null, verdict: 'timeout', err: 'worker timeout' }); w.terminate(); }, 15000);
      w.onmessage = (e) => { clearTimeout(t); res(e.data); w.terminate(); };
      w.onerror = (e) => { clearTimeout(t); res({ present: false, control: null, blurred: null, verdict: 'error', err: 'worker: ' + (e.message || String(e)) }); };
    } catch (e) { res({ present: false, control: null, blurred: null, verdict: 'error', err: String(e) }); }
  });
  return { ua: navigator.userAgent, main, offscreenMain, offscreenWorker };
})()`;

const WORKER_SRC = `
import { canvasFilterWorks } from '/probe.js';
const raw = () => {
  try {
    const ctx = new OffscreenCanvas(16,16).getContext('2d');
    if (!ctx) return { present: false, control: null, blurred: null, err: 'no 2d context' };
    if (!('filter' in ctx)) return { present: false, control: null, blurred: null };
    ctx.filter = 'none'; ctx.clearRect(0,0,16,16); ctx.fillStyle = '#fff'; ctx.fillRect(6,6,4,4);
    const control = ctx.getImageData(11,8,1,1).data[3];
    ctx.filter = 'blur(2px)';
    const readback = ctx.filter;
    ctx.clearRect(0,0,16,16); ctx.fillRect(6,6,4,4);
    const blurred = ctx.getImageData(11,8,1,1).data[3];
    return { present: true, readback, control, blurred };
  } catch (e) { return { present: false, control: null, blurred: null, err: String(e) }; }
};
// No context argument: a Worker realm has OffscreenCanvas and no document, which is
// exactly the case canvasKindOf() has to get right on its own.
self.postMessage({ ...raw(), verdict: canvasFilterWorks() });
`;

const PAGE = `<!doctype html><meta charset="utf-8"><title>ctx.filter probe</title><body>
<script type="module">
import { canvasFilterWorks, resetCanvasFilterProbeCache } from '/probe.js';
window.PROBE = { canvasFilterWorks, resetCanvasFilterProbeCache };
window.__PROBE_READY = true;
</script></body>`;

const gate = browserGate();

describe('ctx.filter functional probe (browser tier)', { skip: gate ?? false, concurrency: 1 }, () => {
  let server: Server;
  let browser: Browser;
  let ctx: BrowserContext;
  let page: Page;
  let matrix: Matrix;

  before(async () => {
    const esbuild = await import('esbuild');
    const built = await esbuild.build({
      entryPoints: [MODULE], bundle: true, write: false, format: 'esm',
      target: 'es2022', platform: 'browser', logLevel: 'silent',
    });
    const js = built.outputFiles[0]?.text ?? '';
    assert.ok(js.includes('probeCanvasFilter'), 'the module bundled');

    server = createServer((req, res) => {
      const path = (req.url ?? '/').split('?')[0];
      const send = (type: string, body: string): void => { res.writeHead(200, { 'content-type': type }); res.end(body); };
      if (path === '/probe.js') return send('text/javascript; charset=utf-8', js);
      if (path === '/worker.js') return send('text/javascript; charset=utf-8', WORKER_SRC);
      return send('text/html; charset=utf-8', PAGE);
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as { port: number }).port;

    browser = await getBrowser();
    ctx = await browser.newContext();
    page = await ctx.newPage();
    const errs: string[] = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
    try {
      await page.waitForFunction('window.__PROBE_READY === true', undefined, { timeout: 20_000 });
    } catch {
      throw new Error(`page never became ready. Errors:\n${errs.join('\n') || '(none)'}`);
    }
    matrix = (await page.evaluate(IN_PAGE)) as Matrix;
    // ASCII-first, per tests/README.md's console convention.
    console.log(`[ctx.filter] ${matrix.ua}`);
    for (const k of ['main', 'offscreenMain', 'offscreenWorker'] as const) {
      const r = matrix[k];
      console.log(`[ctx.filter] ${k}: verdict=${r.verdict} present=${r.present} readback=${r.readback ?? '-'} control=${r.control} blurred=${r.blurred}${r.err ? ` err=${r.err}` : ''}`);
    }
  });

  after(async () => {
    await ctx?.close().catch(() => {});
    await closeBrowser();
    await new Promise<void>((r) => server?.close(() => r()));
  });

  test('the module agrees with an independent measurement on a main-thread canvas', () => {
    const r = matrix.main;
    assert.equal(typeof r.verdict, 'boolean');
    const spread = r.present && r.control === 0 && (r.blurred ?? 0) >= 2;
    assert.equal(r.verdict, spread,
      `module said ${r.verdict}, raw measurement said ${spread} (control=${r.control} blurred=${r.blurred})`);
  });

  test('an OffscreenCanvas on the main thread agrees with its own measurement', () => {
    const r = matrix.offscreenMain;
    if (r.verdict === 'no OffscreenCanvas') return;   // nothing to compare
    const spread = r.present && r.control === 0 && (r.blurred ?? 0) >= 2;
    assert.equal(r.verdict, spread, `module said ${r.verdict}, raw said ${spread}`);
  });

  test('a Worker OffscreenCanvas agrees with its own measurement', () => {
    const r = matrix.offscreenWorker;
    assert.ok(!r.err, `worker probe failed: ${r.err}`);
    assert.equal(typeof r.verdict, 'boolean');
    const spread = r.present && r.control === 0 && (r.blurred ?? 0) >= 2;
    assert.equal(r.verdict, spread, `module said ${r.verdict}, raw said ${spread}`);
  });

  test('support is per-engine, not per-thread — all three kinds agree', () => {
    // The §11 S1 finding the fallback lane is designed around. If this ever fails,
    // the plan's "probe once per kind" is still safe (each kind is probed), but the
    // claim that one verdict describes the engine is not, and §5.5 needs revisiting.
    assert.equal(matrix.offscreenMain.verdict, matrix.main.verdict, 'OffscreenCanvas (main thread) vs canvas');
    assert.equal(matrix.offscreenWorker.verdict, matrix.main.verdict, 'OffscreenCanvas (worker) vs canvas');
  });
});
