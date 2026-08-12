// SPDX-License-Identifier: MPL-2.0
/**
 * THE TWO BLUR LANES, MEASURED AGAINST EACH OTHER — the browser tier (plan 104 §5.5).
 *
 * `shells/web/src/lib/canvas-blur.test.ts` pins the parse, the spill geometry, the mip
 * ladder and the box kernel headlessly. What no Node process can answer is the question
 * the Safari finding forces: the mip lane is the MAINLINE on WebKit (§11 S1 — no
 * `ctx.filter` on any context kind there), so how close is it to what an engine's own
 * Gaussian paints? A lane that is only "the fallback" can be hand-waved. A lane that is
 * the only lane half our users have cannot.
 *
 * So this file draws the SAME source through both lanes on a real engine and reports the
 * difference. It compares PREMULTIPLIED channels, because that is what is visible: the
 * RGB of a fully transparent pixel is arbitrary in both lanes and comparing it would
 * measure nothing.
 *
 * THE TOLERANCE, and what it is worth (measured 2026-08-11, Chromium 151 headless,
 * macOS 27, Playwright 1.62.1):
 *
 *   blur sigma 4        mean 0.67   max 18   0.70 % of channels over 8 levels
 *   blur sigma 12       mean 0.71   max 14   0.19 %
 *   blur sigma 30       mean 3.21   max 45   7.71 %
 *   drop-shadow only    mean 1.39   max 37   7.28 %
 *   blur + drop-shadow  mean 1.56   max 28   6.58 %
 *
 *   • MEAN absolute error per premultiplied channel is under one 8-bit level for the
 *     sigmas a document actually authors, and ~3 at sigma 30. That is the number that
 *     matters — a blur is a low-frequency operation and a per-pixel outlier is invisible
 *     inside one.
 *   • MAX absolute error is larger, and expected to be. The mip lane models the resample
 *     round trip's own softening as sigma = shrink/2 and subtracts it in variance; the
 *     model is good to roughly a tenth of a sigma, and a tenth of a sigma at the steepest
 *     point of a hard edge is tens of levels. It is a difference in EDGE SOFTNESS, not a
 *     difference in shape or position — which is why the mean stays where it does, and
 *     why the error grows with sigma (a deeper mip level, a coarser reconstruction).
 *
 * A build with no `ctx.filter` (WebKit today) cannot run the comparison at all. It is
 * not skipped silently: the mip lane still has to prove it BLURRED — ink where the
 * source had none, and the source's hard edge gone — which is the assertion that would
 * have caught a lane that quietly did nothing on the only engine that needs it.
 *
 * GATING follows `canvas-filter-probe.browser.test.ts`: no browser installed -> the
 * whole suite skips naming the install command, so `npm test` stays green on a bare
 * machine.
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
const MODULE = join(HERE, '..', 'shells', 'web', 'src', 'lib', 'canvas-blur.ts');

/**
 * The stated tolerance. Set from the measured Chromium numbers with headroom, not
 * from a guess — and deliberately tight enough that a real regression in the ladder
 * (a wrong sigma, a dropped level, a lost premultiply) blows straight through it.
 */
const MEAN_TOLERANCE = 4;
const MAX_TOLERANCE = 96;

interface LaneDiff {
  mean: number;
  max: number;
  /** Fraction of channels that differ by more than 8 levels. */
  outliers: number;
}
interface Case {
  name: string;
  filterOk: boolean;
  diff: LaneDiff | null;
  /** Ink at a pixel the SOURCE did not cover, per lane — proof each one spread. */
  spread: { filter: number | null; mip: number | null };
  /** The source's own ink at that pixel; must be 0 or the case proves nothing. */
  control: number;
  err?: string;
}
interface Report {
  ua: string;
  filterSupported: boolean;
  cases: Case[];
}

/**
 * The measurement, in the page. Uses the SHIPPED module for both lanes — the point is
 * to compare `renderFx('filter')` with `renderFx('mip')`, not a reimplementation of
 * either.
 */
const IN_PAGE = `(async () => {
  const M = window.BLUR;
  const SIZE = 256;

  // A deterministic source with hard edges, a curve, saturated colour and real
  // transparency — every feature a blur can get wrong.
  const source = () => {
    const c = document.createElement('canvas');
    c.width = SIZE; c.height = SIZE;
    const x = c.getContext('2d');
    x.clearRect(0, 0, SIZE, SIZE);
    x.fillStyle = '#ff8800'; x.fillRect(40, 60, 120, 80);
    x.fillStyle = '#ffffff';
    x.beginPath(); x.arc(190, 70, 34, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#2244ff'; x.fillRect(20, 175, 70, 60);
    return c;
  };

  const readPremul = (canvas) => {
    const ctx = canvas.getContext('2d');
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const out = new Float32Array(d.length);
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3] / 255;
      out[i] = d[i] * a; out[i + 1] = d[i + 1] * a; out[i + 2] = d[i + 2] * a; out[i + 3] = d[i + 3];
    }
    return out;
  };

  const inkAt = (canvas, x, y) => {
    const d = canvas.getContext('2d').getImageData(x, y, 1, 1).data;
    return d[3];
  };

  const runLane = (src, fx, lane) => {
    const out = M.renderFx(src, fx, lane);
    if (!out) return null;
    const px = readPremul(out.canvas);
    // Six px clear of the orange rect's left edge — inside reach for the smallest
    // sigma under test, and empty in the source, which is what makes ink here proof.
    const ink = inkAt(out.canvas, 34, 100);
    M.releaseStage(out);
    return { px, ink };
  };

  const compare = (a, b) => {
    let sum = 0, max = 0, over = 0;
    for (let i = 0; i < a.length; i++) {
      const d = Math.abs(a[i] - b[i]);
      sum += d;
      if (d > max) max = d;
      if (d > 8) over++;
    }
    return { mean: sum / a.length, max, outliers: over / a.length };
  };

  const filterSupported = M.laneFor(document.createElement('canvas').getContext('2d')) === 'filter';

  const cases = [];
  const specs = [
    { name: 'blur sigma 4', fx: { sigma: 4, rest: '', shadows: [] } },
    { name: 'blur sigma 12', fx: { sigma: 12, rest: '', shadows: [] } },
    { name: 'blur sigma 30', fx: { sigma: 30, rest: '', shadows: [] } },
    { name: 'drop-shadow only', fx: { sigma: 0, rest: 'drop-shadow(6px 8px 20px rgba(0,0,0,0.55))',
        shadows: [{ dx: 6, dy: 8, blur: 20, color: 'rgba(0,0,0,0.55)' }] } },
    { name: 'blur + drop-shadow', fx: { sigma: 6, rest: 'drop-shadow(0px 8px 24px rgba(0,0,0,0.5))',
        shadows: [{ dx: 0, dy: 8, blur: 24, color: 'rgba(0,0,0,0.5)' }] } },
  ];

  for (const spec of specs) {
    try {
      const src = source();
      const control = inkAt(src, 34, 100);
      M._resetBlurPool();
      const mip = runLane(src, spec.fx, 'mip');
      M._resetBlurPool();
      const filt = filterSupported ? runLane(src, spec.fx, 'filter') : null;
      cases.push({
        name: spec.name,
        filterOk: !!filt,
        diff: filt && mip ? compare(filt.px, mip.px) : null,
        spread: { filter: filt ? filt.ink : null, mip: mip ? mip.ink : null },
        control,
      });
    } catch (e) {
      cases.push({ name: spec.name, filterOk: false, diff: null, spread: { filter: null, mip: null }, control: 0, err: String(e) });
    }
  }
  return { ua: navigator.userAgent, filterSupported, cases };
})()`;

const PAGE = `<!doctype html><meta charset="utf-8"><title>blur lanes</title><body>
<script type="module">
import * as M from '/blur.js';
window.BLUR = M;
window.__BLUR_READY = true;
</script></body>`;

const gate = browserGate();

describe('blur lanes: mip vs ctx.filter (browser tier)', { skip: gate ?? false, concurrency: 1 }, () => {
  let server: Server;
  let browser: Browser;
  let ctx: BrowserContext;
  let page: Page;
  let report: Report;

  before(async () => {
    const esbuild = await import('esbuild');
    const built = await esbuild.build({
      entryPoints: [MODULE], bundle: true, write: false, format: 'esm',
      target: 'es2022', platform: 'browser', logLevel: 'silent',
    });
    const js = built.outputFiles[0]?.text ?? '';
    assert.ok(js.includes('renderFx'), 'the module bundled');

    server = createServer((req, res) => {
      const path = (req.url ?? '/').split('?')[0];
      const send = (type: string, body: string): void => { res.writeHead(200, { 'content-type': type }); res.end(body); };
      if (path === '/blur.js') return send('text/javascript; charset=utf-8', js);
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
      await page.waitForFunction('window.__BLUR_READY === true', undefined, { timeout: 20_000 });
    } catch {
      throw new Error(`page never became ready. Errors:\n${errs.join('\n') || '(none)'}`);
    }
    report = (await page.evaluate(IN_PAGE)) as Report;
    // ASCII-first, per tests/README.md's console convention.
    console.log(`[blur lanes] ${report.ua}`);
    console.log(`[blur lanes] ctx.filter supported: ${report.filterSupported}`);
    for (const c of report.cases) {
      const d = c.diff;
      console.log(`[blur lanes] ${c.name}: ${d ? `mean=${d.mean.toFixed(3)} max=${d.max.toFixed(1)} over8=${(d.outliers * 100).toFixed(2)}%` : 'no comparison'}`
        + ` spread(filter=${c.spread.filter} mip=${c.spread.mip}) control=${c.control}${c.err ? ` err=${c.err}` : ''}`);
    }
  });

  after(async () => {
    await ctx?.close().catch(() => {});
    await closeBrowser();
    await new Promise<void>((r) => server?.close(() => r()));
  });

  test('every case ran', () => {
    assert.equal(report.cases.length, 5);
    for (const c of report.cases) assert.ok(!c.err, `${c.name}: ${c.err}`);
  });

  test('the MIP lane blurs — on every engine, whether or not ctx.filter exists', () => {
    // The assertion that matters on WebKit, where this is the only lane there is.
    for (const c of report.cases) {
      assert.equal(c.control, 0, `${c.name}: the sample pixel must be empty in the SOURCE`);
      assert.ok((c.spread.mip ?? 0) > 0,
        `${c.name}: the mip lane put no ink at a pixel the source never covered — it did not blur`);
    }
  });

  test('the two lanes agree within the stated tolerance', () => {
    if (!report.filterSupported) {
      // Not a silent pass: say so, so a run on WebKit reads as "unmeasurable here"
      // rather than as "measured and fine".
      console.log('[blur lanes] ctx.filter absent on this engine — the comparison is not measurable here');
      return;
    }
    for (const c of report.cases) {
      assert.ok(c.diff, `${c.name}: both lanes must have produced a picture`);
      assert.ok(c.diff.mean <= MEAN_TOLERANCE,
        `${c.name}: mean premultiplied error ${c.diff.mean.toFixed(3)} exceeds ${MEAN_TOLERANCE}`);
      assert.ok(c.diff.max <= MAX_TOLERANCE,
        `${c.name}: max premultiplied error ${c.diff.max.toFixed(1)} exceeds ${MAX_TOLERANCE}`);
    }
  });

  test('the filter lane blurs too — so the comparison is between two blurs', () => {
    if (!report.filterSupported) return;
    for (const c of report.cases) {
      assert.ok((c.spread.filter ?? 0) > 0, `${c.name}: the filter lane spread nothing`);
    }
  });
});
