// SPDX-License-Identifier: MPL-2.0
/**
 * Repeatable warm-session UI measurements against a production web build.
 * Usage: pnpm check:ui-performance <url> [--runs=3] [--cpu=4] [--json=<path>] [--enforce]
 * See shells/web/PERFORMANCE.md for conditions, targets and interpretation.
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir, platform, arch, cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { chromium, type Browser, type CDPSession, type Page } from 'playwright';
import { installUiMetrics, median, summarizeUiTimings } from './lib/ui-performance.ts';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';

const args = process.argv.slice(2);
const usage = 'pnpm check:ui-performance <url> [--runs=3] [--cpu=4] [--json=<path>] [--enforce]';
const urlArg = args.find(arg => !arg.startsWith('--'));
if (!urlArg || args.some(arg => arg.startsWith('--') && !/^(--runs=|--cpu=|--json=|--enforce$)/.test(arg))) {
  throw new Error(`Usage: ${usage}`);
}
const target = new URL(urlArg);
assert.ok(['http:', 'https:'].includes(target.protocol), 'Use an HTTP(S) URL');
target.hash = ''; target.search = '';
const option = (name: string, fallback: string) => args.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const runs = Number(option('runs', '3')), cpu = Number(option('cpu', '4'));
assert.ok(Number.isInteger(runs) && runs >= 1 && runs <= 20, '--runs must be 1–20');
assert.ok(Number.isFinite(cpu) && cpu >= 1 && cpu <= 20, '--cpu must be 1–20');
const reportPath = resolve(option('json', join(tmpdir(), `lolly-ui-performance-${Date.now()}.json`)));
mkdirSync(dirname(reportPath), { recursive: true });
const viewport = { width: 1200, height: 800 };
// Jelly uses a shadow input; Performance UI uses the native field directly.
const urlInput = '#view input[data-input-id="url"], #view jelly-input[data-input-id="url"] input';
// Lab targets, reported even before a machine-specific CI baseline is adopted.
// --enforce makes misses fatal; scenario failures are ALWAYS fatal.
const targets = { interactionMs: 200, idleMainThreadPercent: 10, maxLongTaskMs: 200 };
const samples: Sample[] = [];
type Sample = ReturnType<typeof summarizeUiTimings> & {
  run: number; mode: 'off' | 'on'; phase: string;
  readyMs: number; windowMs: number; mainThreadPercent: number;
};

async function counters(cdp: CDPSession): Promise<{ task: number; time: number }> {
  const metrics = await cdp.send('Performance.getMetrics');
  const task = metrics.metrics.find(metric => metric.name === 'TaskDuration');
  const time = metrics.metrics.find(metric => metric.name === 'Timestamp');
  assert.ok(task && time, 'Chromium must supply main-thread TaskDuration and Timestamp');
  return { task: task.value, time: time.value };
}

async function painted(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function measure(page: Page, cdp: CDPSession, run: number, mode: Sample['mode'], phase: string, action: () => Promise<void>) {
  await page.evaluate(() => window.__lollyUiMetrics.begin());
  const taskStart = await counters(cdp), start = await page.evaluate(() => performance.now());
  await action();
  await painted(page);
  const ready = await page.evaluate(() => performance.now());
  // Let Event Timing's after-paint observer delivery finish. Included in the
  // observation/CPU window, excluded from action-to-ready latency.
  await page.waitForTimeout(200);
  const taskEnd = await counters(cdp);
  const timings = await page.evaluate(() => window.__lollyUiMetrics.read());
  const sample: Sample = {
    run, mode, phase, readyMs: ready - start, windowMs: (taskEnd.time - taskStart.time) * 1000,
    mainThreadPercent: 100 * (taskEnd.task - taskStart.task) / (taskEnd.time - taskStart.time),
    ...summarizeUiTimings(timings),
  };
  samples.push(sample);
  console.log(`  ${mode.padEnd(3)} ${phase.padEnd(14)} ready ${Math.round(sample.readyMs)} ms; interaction ${sample.interactionMs ?? '<16 / none'} ms; long tasks ${sample.longTaskCount}; main thread ${sample.mainThreadPercent.toFixed(1)}%`);
}

/** Let the app create its own DB schema, then seed ONLY a disposable profile. */
async function prepare(page: Page, on: boolean): Promise<void> {
  await page.goto(`${target}#/profile?focus=feature-flags`, { waitUntil: 'domcontentloaded' });
  await page.locator('#view [data-flag="perf-ui"]').waitFor({ state: 'attached' });
  assert.equal(await page.locator('script[src*="/@vite/client"]').count(), 0, 'Use a production build, not Vite development mode');
  await page.evaluate(async on => {
    const featureFlags = { ...JSON.parse(localStorage.getItem('lolly:featureFlags') ?? '{}'), 'perf-ui': on, 'jelly-effects': true, 'wobbly-windows': true, 'perf-hud': false };
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('lolly');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('profile', 'readwrite');
        const store = tx.objectStore('profile'), read = store.get('me');
        read.onsuccess = () => { store.put({ ...read.result, featureFlags }, 'me'); };
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onabort = () => { db.close(); reject(tx.error); };
      };
    });
    localStorage.setItem('lolly:featureFlags', JSON.stringify(featureFlags));
  }, on);
  // Clear in-memory profile caches by navigating a fresh document. This warms
  // shared boot assets equally; cold-load costs belong to check:first-load.
  await page.goto('about:blank');
  await page.goto(`${target}#/`, { waitUntil: 'load' });
  await page.locator('#view .tool-masonry .gtile').first().waitFor();
  await page.waitForTimeout(1500);
  await page.locator('.view-fade').waitFor({ state: 'detached' });
  assert.equal(await page.locator('html').evaluate(el => el.hasAttribute('data-perf-ui')), on);
}

async function sweep(browser: Browser, run: number, mode: Sample['mode']) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'en-GB', reducedMotion: 'no-preference', serviceWorkers: 'block' });
  await context.addInitScript(installUiMetrics);
  await context.addInitScript(() => {
    if (!location.protocol.startsWith('http')) return;
    for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable', { timeDomain: 'timeTicks' });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  try {
    await prepare(page, mode === 'on');
    const record = (phase: string, action: () => Promise<void>, policy = mode) => measure(page, cdp, run, policy, phase, action);
    await page.mouse.move(0, 0);
    await record('gallery-idle', () => page.waitForTimeout(2000));
    await record('scroll', async () => {
      const before = await page.evaluate(() => window.scrollY);
      await page.mouse.move(viewport.width / 2, viewport.height / 2);
      for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 450); await page.waitForTimeout(120); }
      await page.waitForFunction(y => window.scrollY > y, before);
      for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -450); await page.waitForTimeout(120); }
      await page.waitForFunction(y => window.scrollY <= y, before);
    });
    const search = page.locator('.gallery-search');
    await search.scrollIntoViewIfNeeded();
    await record('search', async () => {
      await search.click();
      await search.pressSequentially('qr', { delay: 80 });
      await page.waitForFunction(() => {
        const grid = document.querySelector('#view .tool-masonry');
        return grid?.querySelector('.gtile.is-filtered') && grid.querySelector('.gtile:not(.is-filtered) a[href*="/tool/qr-code"]');
      });
    });
    await record('clear-search', async () => {
      await search.press('ControlOrMeta+a'); await search.press('Backspace');
      await page.waitForFunction(() => !document.querySelector('#view .tool-masonry .gtile.is-filtered'));
    });
    // A card's title deliberately opens its current example, which can differ
    // between modes. + New → blank exercises the same document through real UI.
    const tool = page.locator('#view .tool-masonry [data-tool-id="qr-code"] .gtile-new');
    await tool.scrollIntoViewIfNeeded();
    await record('open-tool', async () => {
      await tool.click();
      await page.locator('.tmpl-chooser-tile[data-template-id="__blank__"]').click();
      await page.locator('#tool-canvas svg').first().waitFor();
      await page.locator(urlInput).waitFor();
    });
    const input = page.locator(urlInput);
    const beforeSvg = await page.locator('#tool-canvas').innerHTML();
    await input.scrollIntoViewIfNeeded();
    await record('edit-tool', async () => {
      await input.click(); await input.press('End');
      await input.pressSequentially('/performance', { delay: 60 });
      const finalValue = await input.inputValue();
      await page.waitForFunction(({ before, value }) => {
        const canvas = document.querySelector('#tool-canvas');
        const content = document.querySelector('#tool-content') ?? canvas;
        return !!canvas?.querySelector('svg') && canvas.innerHTML !== before && content?.getAttribute('aria-label')?.includes(value);
      }, { before: beforeSvg, value: finalValue });
      assert.ok(finalValue.endsWith('/performance'));
    });
    await page.mouse.move(0, 0);
    await record('tool-idle', () => page.waitForTimeout(2000));
    if (mode === 'off') {
      await page.goto(`${target}#/profile?focus=feature-flags`, { waitUntil: 'load' });
      const toggle = page.locator('#view jelly-switch[data-flag="perf-ui"]');
      await toggle.waitFor();
      await toggle.scrollIntoViewIfNeeded();
      await page.locator('.view-fade').waitFor({ state: 'detached' });
      await record('effects-idle', () => page.waitForTimeout(2000));
      await record('enable-live', async () => {
        // Kick the real vendor physics immediately before the real preference click.
        await toggle.evaluate(el => (el as HTMLElement & { centerPop(amount: number): void }).centerPop(1));
        await toggle.click();
        await page.waitForFunction(() => document.documentElement.hasAttribute('data-perf-ui'));
        await page.locator('#view input[data-flag="perf-ui"]').waitFor({ state: 'attached' });
      }, 'on');
      await page.mouse.move(0, 0);
      await record('effects-idle', () => page.waitForTimeout(2000), 'on');
      assert.equal(await page.locator('#view [data-flag="jelly-effects"]').isChecked(), true, 'Saved Jelly preference survives');
    }
  } catch (error) {
    await page.screenshot({ path: `${reportPath}.${run}-${mode}.png`, timeout: 5000, animations: 'disabled' }).catch(() => {});
    throw new Error(`Run ${run}, Performance UI ${mode}, ${page.url()}: ${String(error)}`, { cause: error });
  } finally { await context.close(); }
}

// The shell needs a WebGPU adapter to start: the machine's own where it has a
// reliable one, SwiftShader on Linux (webgpu-launch.ts).
const browser = await chromium.launch({ headless: true, args: webGpuLaunchArgs('auto') });
let failure: string | undefined;
const browserVersion = browser.version();
try {
  for (let run = 1; run <= runs; run++) {
    console.log(`Run ${run}/${runs}, Chromium ${browserVersion}, ${cpu}× CPU slowdown`);
    // Alternate order to reduce systematic thermal/cache bias between modes.
    for (const mode of (run % 2 ? ['off', 'on'] : ['on', 'off']) as Sample['mode'][]) await sweep(browser, run, mode);
  }
} catch (error) { failure = String(error); }
finally { await browser.close(); }

const groups = [...new Set(samples.map(sample => `${sample.mode}/${sample.phase}`))].map(key => {
  const group = samples.filter(sample => `${sample.mode}/${sample.phase}` === key);
  const interactions = group.flatMap(sample => sample.interactionMs === null ? [] : [sample.interactionMs]);
  return {
    mode: group[0]!.mode, phase: group[0]!.phase, samples: group.length,
    readyMs: median(group.map(sample => sample.readyMs)),
    interactionMs: interactions.length ? median(interactions) : null,
    maxLongTaskMs: median(group.map(sample => sample.maxLongTaskMs)),
    longTaskBlockingMs: median(group.map(sample => sample.longTaskBlockingMs)),
    mainThreadPercent: median(group.map(sample => sample.mainThreadPercent)),
  };
});
const misses = groups.filter(group => group.mode === 'on').flatMap(group => [
  ...(group.interactionMs !== null && group.interactionMs > targets.interactionMs ? [`${group.phase}: interaction ${group.interactionMs} > ${targets.interactionMs} ms`] : []),
  ...(group.maxLongTaskMs > targets.maxLongTaskMs ? [`${group.phase}: longest task ${Math.round(group.maxLongTaskMs)} > ${targets.maxLongTaskMs} ms`] : []),
  ...(group.phase.endsWith('idle') && group.mainThreadPercent > targets.idleMainThreadPercent ? [`${group.phase}: main-thread idle-window usage ${group.mainThreadPercent.toFixed(1)} > ${targets.idleMainThreadPercent}%`] : []),
]);
writeFileSync(reportPath, `${JSON.stringify({
  version: 1, at: new Date().toISOString(), target: target.href,
  environment: { browser: browserVersion, cpuSlowdown: cpu, viewport, platform: platform(), arch: arch(), processor: cpus()[0]?.model, runs, serviceWorkers: 'blocked', network: 'unthrottled', session: 'warm boot; fresh context per mode; Jelly and wobble saved on' },
  targets, groups, samples, misses, failure,
}, null, 2)}\n`);
console.table(groups.map(group => ({
  mode: group.mode, phase: group.phase, runs: group.samples,
  'ready ms': Math.round(group.readyMs), 'interaction ms': group.interactionMs ?? '<16 / none',
  'max task ms': Math.round(group.maxLongTaskMs), 'blocking ms': Math.round(group.longTaskBlockingMs),
  'main thread %': Number(group.mainThreadPercent.toFixed(1)),
})));
console.log(`Full report: ${reportPath}`);
for (const miss of misses) console.log(`Target missed: ${miss}`);
if (failure) console.error(failure);
if (failure || (args.includes('--enforce') && misses.length)) process.exitCode = 1;
