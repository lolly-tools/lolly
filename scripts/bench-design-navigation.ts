// SPDX-License-Identifier: MPL-2.0
/**
 * Large-document navigation and editing benchmark for the Design canvas.
 *
 * Opens a blank Design in a production build, stores the fixture's pictures as uploads,
 * loads the rows with the editor's own input setter (never through the address) and
 * runs these phases, each measured on its own:
 *
 *   open            set the rows, until the canvas painted them and went quiet
 *   idle            5 s at Fit all
 *   pinch-out       3 s of trackpad pinch (ctrl+wheel) from 100% out to the zoom floor
 *   pinch-in        3 s of pinch in over one artboard
 *   pan             3 s of plain wheel panning
 *   keyboard-zoom   the + - 0 1 keys
 *   click-artboard  a click on an artboard's empty surface at 100% (or its title at Fit all
 *                   when none shows), until its selection chrome shows
 *   zoom-selection  Shift+2 on that artboard
 *   drag-1          six one-box drags (the pointer-preview and pointer-commit lanes)
 *   drag-50         a pasteboard marquee of about 50 objects, then six drags of all of them
 *   select-all-pan  Cmd/Ctrl+A, then 3 s of wheel panning
 *   text-edit       double-click a text layer, type, Cmd/Ctrl+Enter
 *   undo-10         ten undos, each until its paint
 *   slider-drag     a 2 s slider drag: the text popover's line height where it opens,
 *                   else the docked inspector's opacity slider (the desktop editor)
 *
 * TODO: the collaborative insert on W1 (review phase 13) needs two Work clients and a
 * room; it belongs in scripts/bench-collab-render-load.ts (LOLLY_LOAD_ROWS=1900).
 *
 * Every phase records rAF intervals (p50, p95, p99, frames over 16.7 and 33 ms), long
 * animation frames, interaction timings, CDP Performance.getMetrics deltas, wrapped
 * history.replaceState calls, patched querySelector/querySelectorAll calls and the cost
 * lanes from shells/web/src/lib/canvas-feedback.ts. The JSON keeps every sample.
 *
 * Build, serve the production output, then run (see shells/web/PERFORMANCE.md):
 *   pnpm run build:ort && pnpm --filter ./shells/web run build
 *   pnpm --dir shells/web exec vite preview --host 127.0.0.1 --port 5188 --strictPort
 *   node scripts/bench-design-navigation.ts --url=http://127.0.0.1:5188 --fixture=D1 --cpu=1,4 --json=/abs/report.json
 * Without --url the build in LOLLY_WEB_DIST (or shells/web/dist) is served on a loopback port.
 * Other options: --phases=open,idle,... --repeat=N --headed --screenshots=/abs/dir,
 * --profile=/abs/dir with --profile-phases=idle,... for a CPU profile of each named phase.
 *
 * The rAF sampler keeps a frame loop running, so idle numbers are frames the page was
 * asked for, not frames it would draw on its own. CPU throttling is a lab multiplier,
 * not a device. Machine load is uncontrolled and is recorded with each phase.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { arch, cpus, loadavg, platform } from 'node:os';
import { dirname, join } from 'node:path';
import { chromium, type CDPSession, type Page } from 'playwright';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';
import type { CanvasCostSample, CanvasFeedbackSample } from '../shells/web/src/lib/canvas-feedback.ts';
import { serveCanvasBuild } from './lib/canvas-browser-server.ts';
import { DESIGN_FIXTURES, designLargeFixture, fixtureMedia, lottieClip, marqueeBand } from './lib/design-large-fixture.ts';
import type { DesignFixture, DesignFixtureName, FixtureMediaRef, FixtureMediaSpec } from './lib/design-large-fixture.ts';

const PHASES = ['open', 'idle', 'pinch-out', 'pinch-in', 'pan', 'keyboard-zoom', 'click-artboard', 'zoom-selection',
  'drag-1', 'drag-50', 'select-all-pan', 'text-edit', 'undo-10', 'slider-drag'] as const;
type PhaseName = typeof PHASES[number];
const VIEWPORT = { width: 1440, height: 1000 };
const COST_LANES = ['stage-view', 'chrome-sync', 'url-sync', 'hook', 'history'] as const;
const CDP_METRICS = ['LayoutCount', 'RecalcStyleCount', 'LayoutDuration', 'RecalcStyleDuration', 'ScriptDuration', 'TaskDuration', 'Nodes', 'JSHeapUsedSize', 'JSEventListeners'] as const;

const option = (name: string) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const list = (value: string | undefined) => value ? value.split(',').map(item => item.trim()).filter(Boolean) : [];
const fixtures = (list(option('fixture')).length ? list(option('fixture')) : ['D1']) as DesignFixtureName[];
const rates = (list(option('cpu')).length ? list(option('cpu')) : ['1', '4']).map(Number);
const phases = (list(option('phases')).length ? list(option('phases')) : [...PHASES]) as PhaseName[];
const repeat = Number(option('repeat') ?? 1);
const output = option('json'), screenshots = option('screenshots');
// --profile=/abs/dir records a CDP CPU profile of each phase named in --profile-phases (default idle).
const profileDir = option('profile'), profilePhases = list(option('profile-phases') ?? 'idle');
const headed = process.argv.includes('--headed');
if (screenshots) mkdirSync(screenshots, { recursive: true });
assert.ok(fixtures.every(name => DESIGN_FIXTURES.includes(name)), `--fixture takes ${DESIGN_FIXTURES.join(', ')}`);
assert.ok(rates.every(rate => Number.isFinite(rate) && rate >= 1 && rate <= 20), '--cpu takes rates from 1 to 20');
assert.ok(phases.every(name => (PHASES as readonly string[]).includes(name)), `--phases takes ${PHASES.join(', ')}`);
assert.ok(Number.isInteger(repeat) && repeat >= 1 && repeat <= 10, '--repeat takes 1 to 10');

const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));
const quantile = (sorted: number[], q: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * q) - 1)]! : null;
function distribution(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const round = (n: number | null) => n === null ? null : Math.round(n * 100) / 100;
  return { count: values.length, p50: round(quantile(sorted, 0.5)), p95: round(quantile(sorted, 0.95)), p99: round(quantile(sorted, 0.99)),
    max: round(sorted.at(-1) ?? null), sum: round(values.reduce((sum, n) => sum + n, 0)) };
}
const git = (...args: string[]) => { try { return execFileSync('git', args, { encoding: 'utf8' }).trim(); } catch { return null; } };

/** Installed before any app script: counters, the frame sampler and the observers. */
function instrument(): void {
  for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) {
    try { localStorage.setItem(key, '1'); } catch { /* storage refused */ }
  }
  // Titles show for the selection and the hovered artboard by default; the bench selects by title.
  try { localStorage.setItem('lolly-design-artboard-titles', 'always'); } catch { /* storage refused */ }
  window.__lollyCanvasFeedback = { enabled: true, samples: [], costs: [] };
  const bench = { replaceState: 0, replaceStateChars: 0, querySelector: 0, querySelectorAll: 0, frames: [] as number[], loaf: [] as unknown[], events: [] as unknown[], paints: 0 };
  (window as unknown as { __bench: typeof bench }).__bench = bench;
  const replace = History.prototype.replaceState;
  History.prototype.replaceState = function (this: History, data: unknown, unused: string, url?: string | URL | null) {
    bench.replaceState++; bench.replaceStateChars += url ? String(url).length : 0;
    return replace.call(this, data, unused, url);
  };
  for (const proto of [Document.prototype, Element.prototype, DocumentFragment.prototype]) {
    const one = proto.querySelector, all = proto.querySelectorAll;
    proto.querySelector = function (this: ParentNode, selectors: string) { bench.querySelector++; return one.call(this, selectors); } as typeof one;
    proto.querySelectorAll = function (this: ParentNode, selectors: string) { bench.querySelectorAll++; return all.call(this, selectors); } as typeof all;
  }
  const tick = (now: number) => { bench.frames.push(now); requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  type Loaf = PerformanceEntry & { blockingDuration: number; renderStart: number; styleAndLayoutStart: number; scripts: Array<{ invoker: string; sourceURL: string; sourceFunctionName: string; duration: number; forcedStyleAndLayoutDuration: number }> };
  try {
    new PerformanceObserver(entries => {
      for (const entry of entries.getEntries() as Loaf[]) {
        bench.loaf.push({ startTime: entry.startTime, duration: entry.duration, blockingDuration: entry.blockingDuration, renderStart: entry.renderStart, styleAndLayoutStart: entry.styleAndLayoutStart,
          scripts: entry.scripts.slice(0, 6).map(script => ({ invoker: script.invoker, source: `${script.sourceURL.split('/').pop()}:${script.sourceFunctionName}`, duration: script.duration, forcedLayout: script.forcedStyleAndLayoutDuration })) });
      }
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch { /* no long animation frames in this browser */ }
  type EventEntry = PerformanceEntry & { interactionId: number; processingStart: number; processingEnd: number };
  try {
    new PerformanceObserver(entries => {
      for (const entry of entries.getEntries() as EventEntry[]) {
        if (entry.interactionId) bench.events.push({ name: entry.name, startTime: entry.startTime, duration: entry.duration, inputDelay: entry.processingStart - entry.startTime, processing: entry.processingEnd - entry.processingStart, interactionId: entry.interactionId });
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  } catch { /* no event timing in this browser */ }
  document.addEventListener('lolly-canvas-painted', () => { bench.paints++; }, true);
}

interface PageBench { replaceState: number; replaceStateChars: number; querySelector: number; querySelectorAll: number; frames: number[]; loaf: Array<{ startTime: number; duration: number; blockingDuration: number }>; events: Array<{ startTime: number; duration: number }>; paints: number }
declare global { interface Window { __bench?: PageBench; __lollySetInput?: (id: string, value: unknown) => void } }

/** Starts a phase window in the page: every buffer emptied, counters zeroed. */
async function openWindow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const bench = window.__bench!, metrics = window.__lollyCanvasFeedback!;
    bench.replaceState = 0; bench.replaceStateChars = 0; bench.querySelector = 0; bench.querySelectorAll = 0; bench.paints = 0;
    bench.frames.length = 0; bench.loaf.length = 0; bench.events.length = 0; metrics.samples.length = 0; metrics.costs!.length = 0;
    return performance.now();
  });
}

async function closeWindow(page: Page, since: number) {
  return page.evaluate((since) => {
    const bench = window.__bench!, metrics = window.__lollyCanvasFeedback!;
    const frames = bench.frames.filter(t => t >= since), intervals = frames.slice(1).map((t, i) => t - frames[i]!);
    return {
      elapsedMs: performance.now() - since, frames, intervals,
      loaf: bench.loaf.filter(entry => entry.startTime >= since), events: bench.events.filter(entry => entry.startTime >= since),
      counters: { replaceState: bench.replaceState, replaceStateChars: bench.replaceStateChars, querySelector: bench.querySelector, querySelectorAll: bench.querySelectorAll, paints: bench.paints },
      costs: metrics.costs!.slice(), feedback: metrics.samples.slice(),
    };
  }, since);
}

async function cdpMetrics(cdp: CDPSession): Promise<Record<string, number>> {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(metrics.filter(metric => (CDP_METRICS as readonly string[]).includes(metric.name)).map(metric => [metric.name, metric.value]));
}

/** Resolves once the canvas has painted nothing and dropped no frame for `quietMs`. */
async function settle(page: Page, quietMs = 800, maxMs = 30_000): Promise<{ ms: number; settled: boolean }> {
  return page.evaluate(({ quietMs, maxMs }) => new Promise<{ ms: number; settled: boolean }>(resolve => {
    const start = performance.now(); let last = start, previous = start;
    const painted = () => { last = performance.now(); };
    document.addEventListener('lolly-canvas-painted', painted, true);
    const tick = (now: number) => {
      if (now - previous > 50) last = now;
      previous = now;
      if (now - last >= quietMs || now - start >= maxMs) {
        document.removeEventListener('lolly-canvas-painted', painted, true);
        resolve({ ms: now - start, settled: now - last >= quietMs });
      } else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { quietMs, maxMs });
}

/** The artboards' on-screen scale: CSS pixels per native pixel. */
async function zoomOf(page: Page, artboard = 'ab-01'): Promise<number | null> {
  return page.evaluate((id) => {
    const node = document.querySelector(`.lolly-frame-page[data-frame-id="${id}"]`);
    const width = node?.getBoundingClientRect().width ?? 0;
    return width > 0 ? Math.round(width / 1920 * 10000) / 10000 : null;
  }, artboard);
}

async function stageCentre(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('#tool-stage').boundingBox();
  assert.ok(box, 'the stage is laid out');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Wheel events at up to 60 Hz for `durationMs`, through the browser's own input path.
 * Each dispatch waits for the page to take the previous one, so a busy main thread
 * gets fewer events, as it would from a real trackpad. `gesture` is the burst's window
 * in page time, for frame statistics over the gesture alone.
 */
async function wheelBurst(page: Page, cdp: CDPSession, at: { x: number; y: number }, delta: { x: number; y: number }, durationMs: number, ctrl: boolean, reverseAt = Infinity) {
  const startedAt = await page.evaluate(() => performance.now());
  const start = Date.now(); let sent = 0;
  while (Date.now() - start < durationMs) {
    const sign = Date.now() - start >= reverseAt ? -1 : 1;
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: at.x, y: at.y, deltaX: delta.x * sign, deltaY: delta.y * sign, modifiers: ctrl ? 2 : 0, pointerType: 'mouse' });
    sent++;
    const wait = start + sent * (1000 / 60) - Date.now();
    if (wait > 0) await sleep(wait);
  }
  const wheelMs = Date.now() - start;
  return { wheelEvents: sent, wheelMs, gesture: [startedAt, await page.evaluate(() => performance.now())] as [number, number] };
}

async function press(page: Page, key: string) {
  await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur?.(); });
  await page.keyboard.press(key);
}

/** A point on the artboard's own surface: inside it, over no layer. */
async function emptyPointOn(page: Page, artboard: string): Promise<{ x: number; y: number } | null> {
  return page.evaluate((id) => {
    const node = document.querySelector(`.lolly-frame-page[data-frame-id="${id}"]`);
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    for (let gy = 1; gy < 24; gy++) for (let gx = 1; gx < 40; gx++) {
      const x = rect.left + rect.width * gx / 40, y = rect.top + rect.height * gy / 24;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      const box = hit?.closest('[data-box-id]');
      if (hit?.closest('.lolly-frame-page')?.getAttribute('data-frame-id') === id && (!box || box.getAttribute('data-box-id') === id)) return { x, y };
    }
    return null;
  }, artboard);
}

/**
 * A point that reaches one of the listed layers: the first one on top at its own
 * centre, else any point on the artboard where a listed layer is on top (dense
 * fixtures overlap their layers).
 */
async function hittableLayer(page: Page, ids: string[], artboard?: string): Promise<{ id: string; x: number; y: number } | null> {
  return page.evaluate(({ ids, artboard }) => {
    const wanted = new Set(ids);
    const onScreen = (x: number, y: number) => x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight;
    const hitId = (x: number, y: number) => document.elementFromPoint(x, y)?.closest('#tool-canvas [data-box-id]')?.getAttribute('data-box-id') ?? null;
    for (const id of ids) {
      const node = document.querySelector(`#tool-canvas [data-box-id="${CSS.escape(id)}"]`);
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      if (rect.width < 6 || rect.height < 6) continue;
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      if (onScreen(x, y) && hitId(x, y) === id) return { id, x, y };
    }
    const board = artboard ? document.querySelector(`.lolly-frame-page[data-frame-id="${artboard}"]`)?.getBoundingClientRect() : null;
    if (!board) return null;
    for (let gy = 1; gy < 20; gy++) for (let gx = 1; gx < 32; gx++) {
      const x = board.left + board.width * gx / 32, y = board.top + board.height * gy / 20;
      const id = onScreen(x, y) ? hitId(x, y) : null;
      if (id && wanted.has(id)) return { id, x, y };
    }
    return null;
  }, { ids, artboard });
}

const outlineCount = (page: Page) => page.evaluate(() => document.querySelectorAll('.fc-outline').length);

/** Six short drags of whatever is under `at`; each waits for its pointer-commit sample. */
async function dragRuns(page: Page, at: { x: number; y: number }) {
  for (let run = 0; run < 6; run++) {
    const before = await page.evaluate(() => window.__lollyCanvasFeedback!.samples.filter(sample => sample.lane === 'pointer-commit').length);
    const direction = run % 2 ? -1 : 1;
    await page.mouse.move(at.x, at.y); await page.mouse.down();
    await page.mouse.move(at.x + 12 * direction, at.y + 9 * direction, { steps: 6 }); await page.mouse.up();
    await page.waitForFunction((before) => window.__lollyCanvasFeedback!.samples.filter(sample => sample.lane === 'pointer-commit').length > before, before, { timeout: 60_000 });
  }
}

/** Waits for the next canvas paint after `act`, measured in the page from the key or pointer event. */
async function untilPainted(page: Page, act: () => Promise<void>, timeout = 30_000): Promise<number> {
  await page.evaluate(() => {
    const mark = { input: 0, painted: 0 };
    (window as unknown as { __benchMark: typeof mark }).__benchMark = mark;
    // The first non-modifier key or pointer press starts the clock.
    const input = (event: Event) => {
      if (mark.input || (event instanceof KeyboardEvent && ['Meta', 'Control', 'Shift', 'Alt'].includes(event.key))) return;
      mark.input = event.timeStamp || performance.now();
    };
    document.addEventListener('keydown', input, true);
    document.addEventListener('pointerdown', input, true);
    document.addEventListener('lolly-canvas-painted', () => requestAnimationFrame(() => requestAnimationFrame(() => { mark.painted = performance.now(); })), { capture: true, once: true });
  });
  await act();
  await page.waitForFunction(() => (window as unknown as { __benchMark: { painted: number } }).__benchMark.painted > 0, undefined, { timeout });
  return page.evaluate(() => { const mark = (window as unknown as { __benchMark: { input: number; painted: number } }).__benchMark; return mark.painted - mark.input; });
}

/** Draws each picture, records each video and stores both as uploads, as a person adding files would. */
async function storeMedia(page: Page, specs: FixtureMediaSpec[]): Promise<Record<string, FixtureMediaRef>> {
  const clips = Object.fromEntries(specs.filter(spec => spec.type === 'lottie').map(spec => [spec.id, lottieClip(spec.seed)]));
  return page.evaluate(async ({ specs, clips }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const open = indexedDB.open('lolly'); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
    const put = (record: object) => new Promise<void>((resolve, reject) => {
      const tx = db.transaction('user-assets', 'readwrite'); tx.objectStore('user-assets').put(record); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    const seeded = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const paint = (ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, w: number, h: number, random: () => number, t = 0) => {
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, `hsl(${Math.floor(random() * 360)} 60% 45%)`); gradient.addColorStop(1, `hsl(${Math.floor(random() * 360)} 70% 70%)`);
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = `hsl(${Math.floor(random() * 360)} 65% ${30 + Math.floor(random() * 50)}% / ${0.25 + random() * 0.5})`;
        const x = random() * w + t * 4, y = random() * h, r = 8 + random() * w / 10;
        ctx.beginPath(); if (i % 2) ctx.arc(x % w, y, r, 0, Math.PI * 2); else ctx.rect(x % w, y, r * 1.6, r); ctx.fill();
      }
    };
    const noise = new OffscreenCanvas(256, 256), noiseCtx = noise.getContext('2d')!, pixels = noiseCtx.createImageData(256, 256), grain = seeded(99);
    for (let i = 0; i < pixels.data.length; i += 4) { const v = Math.floor(grain() * 255); pixels.data.set([v, v, v, 255], i); }
    noiseCtx.putImageData(pixels, 0, 0);
    const picture = async (spec: typeof specs[number]) => {
      const canvas = new OffscreenCanvas(spec.width, spec.height), ctx = canvas.getContext('2d')!;
      paint(ctx, spec.width, spec.height, seeded(spec.seed));
      ctx.globalAlpha = 0.18; ctx.fillStyle = ctx.createPattern(noise, 'repeat')!; ctx.fillRect(0, 0, spec.width, spec.height); ctx.globalAlpha = 1;
      return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.86 });
    };
    const video = (spec: typeof specs[number]) => new Promise<Blob | null>((resolve) => {
      if (typeof MediaRecorder === 'undefined') { resolve(null); return; }
      const canvas = document.createElement('canvas'); canvas.width = spec.width; canvas.height = spec.height;
      const ctx = canvas.getContext('2d')!, chunks: Blob[] = [];
      const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: 'video/webm' });
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => resolve(chunks.length ? new Blob(chunks, { type: 'video/webm' }) : null);
      let frame = 0;
      // The same seed every frame, shifted by the frame number, so the shapes drift.
      const draw = () => { paint(ctx, spec.width, spec.height, seeded(spec.seed), frame++); if (recorder.state === 'recording') requestAnimationFrame(draw); };
      recorder.start(); draw(); setTimeout(() => recorder.stop(), 2000);
    });
    const refs: Record<string, object> = {}, skipped: string[] = [];
    await Promise.all(specs.map(async spec => {
      const blob = spec.type === 'raster' ? await picture(spec)
        : spec.type === 'video' ? await video(spec)
        : new Blob([JSON.stringify(clips[spec.id])], { type: 'application/json' });
      if (!blob) { skipped.push(spec.id); return; }
      await put({ id: spec.id, type: spec.type, format: spec.format, width: spec.width, height: spec.height, blob, meta: { name: spec.name, bytes: blob.size, modifiedAt: Date.now() } });
      refs[spec.id] = { source: 'user', id: spec.id, type: spec.type, format: spec.format, url: URL.createObjectURL(blob), width: spec.width, height: spec.height, meta: { name: spec.name, bytes: blob.size } };
    }));
    db.close();
    return { refs, skipped };
  }, { specs, clips }).then(({ refs, skipped }) => {
    if (skipped.length) console.log(`  media not made in this browser: ${skipped.join(', ')}`);
    return refs as Record<string, FixtureMediaRef>;
  });
}

/** The last row drawn on the first page: when it is in the canvas, the whole page has painted. */
function probeRow(fixture: DesignFixture): string {
  const firstPage = new Set(fixture.artboards.filter(board => board.pageId === fixture.artboards[0]!.pageId).map(board => board.id));
  return [...fixture.boxes].reverse().find(row => row.kind !== 'frame' && firstPage.has(String(row.frame)))!.id;
}

type PhaseResult = Record<string, unknown>;
interface RunContext { page: Page; cdp: CDPSession; fixture: DesignFixture; cpu: number; band: ReturnType<typeof marqueeBand>; probe: string }

/** One measured phase: the window opens, `act` runs, the window closes and is summarised. */
async function measure(ctx: RunContext, name: PhaseName, act: () => Promise<PhaseResult>) {
  const { page, cdp } = ctx;
  const loadBefore = loadavg()[0]!;
  const before = await cdpMetrics(cdp);
  const profiling = !!profileDir && profilePhases.includes(name);
  if (profiling) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
  const since = await openWindow(page);
  let extra: PhaseResult = {}, error: string | null = null;
  try { extra = await act(); } catch (caught) {
    error = caught instanceof Error ? caught.message.split('\n')[0]! : String(caught);
  }
  const sampled = await closeWindow(page, since);
  if (profiling) {
    const { profile } = await cdp.send('Profiler.stop');
    mkdirSync(profileDir!, { recursive: true });
    writeFileSync(join(profileDir!, `${ctx.fixture.name}-cpu${ctx.cpu}-${name}.cpuprofile`), JSON.stringify(profile));
  }
  const after = await cdpMetrics(cdp);
  // Outside the measured window: a screenshot is work the page did not ask for.
  if (screenshots) await page.screenshot({ path: join(screenshots, `${ctx.fixture.name}-cpu${ctx.cpu}-${name}${error ? '-failed' : ''}.png`) }).catch(() => {});
  const delta = Object.fromEntries(CDP_METRICS.filter(key => key !== 'Nodes' && key !== 'JSHeapUsedSize' && key !== 'JSEventListeners')
    .map(key => [key, Math.round(((after[key] ?? 0) - (before[key] ?? 0)) * (key.endsWith('Duration') ? 1000 : 1) * 100) / 100]));
  const lanes = Object.fromEntries(COST_LANES.map(lane => {
    const samples = (sampled.costs as CanvasCostSample[]).filter(sample => sample.lane === lane);
    // Per path where the lane has more than one (chrome-sync: full, view, live).
    const paths = [...new Set(samples.flatMap(sample => sample.detail ? [sample.detail] : []))];
    const byPath = Object.fromEntries(paths.map(path => [path, distribution(samples.filter(sample => sample.detail === path).map(sample => sample.durationMs))]));
    return [lane, { ...distribution(samples.map(sample => sample.durationMs)), byPath,
      samples: samples.map(sample => ({ at: Math.round(sample.started - since), ms: Math.round(sample.durationMs * 1000) / 1000, ...(sample.detail ? { path: sample.detail } : {}) })) }];
  }));
  const feedback = sampled.feedback as CanvasFeedbackSample[];
  const loaf = sampled.loaf;
  const gesture = Array.isArray(extra.gesture) ? extra.gesture as [number, number] : null;
  const inGesture = gesture ? sampled.frames.filter(t => t >= gesture[0] && t <= gesture[1] + 50) : [];
  const gestureIntervals = inGesture.slice(1).map((t, i) => t - inGesture[i]!);
  const result = {
    fixture: ctx.fixture.name, cpu: ctx.cpu, phase: name, ok: error === null, error, elapsedMs: Math.round(sampled.elapsedMs),
    load: { before: Math.round(loadBefore * 100) / 100, after: Math.round(loadavg()[0]! * 100) / 100 },
    frames: { ...distribution(sampled.intervals), over16_7: sampled.intervals.filter(ms => ms > 16.7).length, over33: sampled.intervals.filter(ms => ms > 33.4).length, intervals: sampled.intervals.map(ms => Math.round(ms * 100) / 100) },
    gestureFrames: gesture ? { ...distribution(gestureIntervals), over16_7: gestureIntervals.filter(ms => ms > 16.7).length, over33: gestureIntervals.filter(ms => ms > 33.4).length } : null,
    longAnimationFrames: { count: loaf.length, totalMs: Math.round(loaf.reduce((sum, entry) => sum + entry.duration, 0)), blockingMs: Math.round(loaf.reduce((sum, entry) => sum + entry.blockingDuration, 0)), entries: loaf },
    interactions: sampled.events,
    cdp: { ...delta, mainThreadPercent: sampled.elapsedMs > 0 ? Math.round((delta.TaskDuration ?? 0) / sampled.elapsedMs * 1000) / 10 : null,
      nodes: after.Nodes, jsHeapUsedMiB: Math.round((after.JSHeapUsedSize ?? 0) / 1048576 * 10) / 10, jsEventListeners: after.JSEventListeners },
    counters: sampled.counters,
    lanes,
    pointer: Object.fromEntries(['pointer-preview', 'pointer-commit'].map(lane => {
      const samples = feedback.filter(sample => sample.lane === lane);
      return [lane, { applied: distribution(samples.map(sample => sample.appliedMs)), opportunity: distribution(samples.map(sample => sample.opportunityMs)), samples }];
    })),
    ...extra,
  };
  const lane = (key: string) => (lanes as Record<string, { count: number; p95: number | null }>)[key]!;
  const shown = result.gestureFrames ?? result.frames;
  console.log(`  ${name.padEnd(15)} ${error ? `FAILED ${error}` : 'ok'} | ${result.gestureFrames ? 'gesture' : 'phase'} frames p50/p95/p99 ${shown.p50}/${shown.p95}/${shown.p99} ms, >33ms ${shown.over33}` +
    ` | LoAF ${loaf.length} | replaceState ${sampled.counters.replaceState} | qs ${sampled.counters.querySelector}+${sampled.counters.querySelectorAll}` +
    ` | chrome-sync ${lane('chrome-sync').count}x p95 ${lane('chrome-sync').p95} | url-sync ${lane('url-sync').count}x | load ${result.load.after}`);
  return result;
}

/** Selects an artboard by its title, the route that works at every zoom, then zooms to that artboard. */
async function frameArtboard(page: Page, artboard: string): Promise<void> {
  await press(page, 'Escape'); await press(page, 'Shift+Digit1'); await settle(page);
  await page.locator(`.fc-frame-label[data-frame-id="${artboard}"]`).click();
  await settle(page, 300, 10_000);
  await page.keyboard.press('Shift+Digit2'); await settle(page);
}

async function runPhases(ctx: RunContext): Promise<object[]> {
  const { page, cdp, fixture } = ctx;
  const rows: object[] = [];
  const want = (name: PhaseName) => phases.includes(name);
  const later = (name: PhaseName) => phases.some(phase => PHASES.indexOf(phase) >= PHASES.indexOf(name));
  // The artboard the editing phases work on: the one under the stage centre at 100%.
  let focusBoard = 'ab-23';
  let clickPoint: { x: number; y: number } | null = null;
  // Undoable edits this run made, so the undo phase never reaches back past them to the load.
  let edits = 0;
  const children = (filter: (row: DesignFixture['boxes'][number]) => boolean) => fixture.boxes.filter(row => row.frame === focusBoard && filter(row)).map(row => row.id);
  const run = async (name: PhaseName, act: () => Promise<PhaseResult>) => { if (want(name)) rows.push(await measure(ctx, name, act)); };
  // The document always loads; `open` only decides whether that is measured.
  const load = async () => {
    const started = await page.evaluate(({ boxes, pages, probe }) => new Promise<{ setInputMs: number; paintMs: number }>((resolve, reject) => {
      const start = performance.now();
      const timeout = setTimeout(() => reject(new Error('the fixture never painted')), 600_000);
      const painted = () => {
        if (!document.querySelector(`#tool-canvas [data-box-id="${probe}"]`)) return;
        document.removeEventListener('lolly-canvas-painted', painted, true); clearTimeout(timeout);
        requestAnimationFrame(() => requestAnimationFrame(() => resolve({ setInputMs, paintMs: performance.now() - start })));
      };
      document.addEventListener('lolly-canvas-painted', painted, true);
      if (pages.length) window.__lollySetInput!('pages', pages);
      window.__lollySetInput!('boxes', boxes);
      const setInputMs = performance.now() - start;
    }), { boxes: fixture.boxes, pages: fixture.pages, probe: ctx.probe });
    const quiet = await settle(page, 1000, 120_000);
    return { ...started, quietMs: Math.round(quiet.ms), settled: quiet.settled, boxesInCanvas: await page.evaluate(() => document.querySelectorAll('#tool-canvas [data-box-id]').length) };
  };
  if (want('open')) await run('open', load); else await load();
  await press(page, 'Shift+Digit1'); await settle(page);
  const fitZoom = await zoomOf(page);
  await run('idle', async () => { await sleep(5000); return { zoom: await zoomOf(page) }; });
  await run('pinch-out', async () => {
    await press(page, 'Digit1'); await settle(page);
    const from = await zoomOf(page);
    const burst = await wheelBurst(page, cdp, await stageCentre(page), { x: 0, y: 0.85 }, 3000, true);
    await settle(page, 300, 30_000);
    return { ...burst, zoomFrom: from, zoomTo: await zoomOf(page), fitZoom };
  });
  await run('pinch-in', async () => {
    await press(page, 'Shift+Digit1'); await settle(page);
    const board = await page.locator(`.lolly-frame-page[data-frame-id="${focusBoard}"]`).boundingBox();
    assert.ok(board, `${focusBoard} is on the page`);
    const from = await zoomOf(page);
    const burst = await wheelBurst(page, cdp, { x: board.x + board.width / 2, y: board.y + board.height / 2 }, { x: 0, y: -0.85 }, 3000, true);
    await settle(page, 300, 30_000);
    return { ...burst, zoomFrom: from, zoomTo: await zoomOf(page) };
  });
  await run('pan', async () => {
    const zoom = await zoomOf(page);
    const burst = await wheelBurst(page, cdp, await stageCentre(page), { x: 9.5, y: 6.5 }, 3000, false, 1500);
    await settle(page, 300, 30_000);
    return { ...burst, zoom };
  });
  await run('keyboard-zoom', async () => {
    const keys: Record<string, number> = {};
    for (const key of ['Equal', 'Minus', 'Digit0', 'Digit1']) {
      await press(page, key); keys[key] = Math.round((await settle(page, 400, 30_000)).ms);
    }
    return { settleMsByKey: keys, zoom: await zoomOf(page) };
  });
  if (later('click-artboard')) {
    await press(page, 'Escape'); await press(page, 'Shift+Digit1'); await settle(page);
    await press(page, 'Digit1'); await settle(page);
    // The artboard with the most of itself on the stage at 100%.
    focusBoard = await page.evaluate(() => {
      const stage = document.querySelector('#tool-stage')!.getBoundingClientRect();
      let best: string | null = null, area = 0;
      for (const node of document.querySelectorAll('.lolly-frame-page[data-frame-id]')) {
        const rect = node.getBoundingClientRect();
        const w = Math.min(rect.right, stage.right, innerWidth) - Math.max(rect.left, stage.left), h = Math.min(rect.bottom, stage.bottom) - Math.max(rect.top, stage.top);
        if (w > 0 && h > 0 && w * h > area) { area = w * h; best = node.getAttribute('data-frame-id'); }
      }
      return best;
    }) ?? focusBoard;
    // A click on the artboard's own surface where one shows at 100%; otherwise on its
    // title at Fit all, the route that always exists.
    clickPoint = await emptyPointOn(page, focusBoard);
    if (!clickPoint) { await press(page, 'Shift+Digit1'); await settle(page); }
  }
  await run('click-artboard', async () => {
    const point = clickPoint;
    const route = point ? 'surface' : 'title';
    await page.evaluate(() => {
      const mark = { down: 0, chrome: 0 };
      (window as unknown as { __benchMark: typeof mark }).__benchMark = mark;
      document.addEventListener('pointerdown', event => { mark.down = event.timeStamp; const poll = () => { if (document.querySelector('.fc-outline')) mark.chrome = performance.now(); else requestAnimationFrame(poll); }; requestAnimationFrame(poll); }, { capture: true, once: true });
    });
    if (point) await page.mouse.click(point.x, point.y);
    else await page.locator(`.fc-frame-label[data-frame-id="${focusBoard}"]`).click();
    await page.waitForFunction(() => (window as unknown as { __benchMark: { chrome: number } }).__benchMark.chrome > 0, undefined, { timeout: 30_000 });
    const clickToChromeMs = await page.evaluate(() => { const mark = (window as unknown as { __benchMark: { down: number; chrome: number } }).__benchMark; return mark.chrome - mark.down; });
    await settle(page, 400, 30_000);
    return { artboard: focusBoard, route, clickToChromeMs: Math.round(clickToChromeMs * 10) / 10, zoom: await zoomOf(page), outlines: await outlineCount(page), activeTitle: await page.evaluate(() => document.querySelector('.fc-frame-label.is-active')?.textContent ?? null) };
  });
  await run('zoom-selection', async () => {
    if (!await outlineCount(page)) {
      await press(page, 'Shift+Digit1'); await settle(page);
      await page.locator(`.fc-frame-label[data-frame-id="${focusBoard}"]`).click(); await settle(page, 300, 10_000);
    }
    const from = await zoomOf(page);
    await page.keyboard.press('Shift+Digit2');
    const quiet = await settle(page, 400, 30_000);
    return { zoomFrom: from, zoomTo: await zoomOf(page), settleMs: Math.round(quiet.ms) };
  });
  await run('drag-1', async () => {
    if (!want('zoom-selection')) await frameArtboard(page, focusBoard);
    const target = await hittableLayer(page, children(row => row.kind === 'text' || row.kind === 'box'), focusBoard);
    assert.ok(target, `a layer on ${focusBoard} that the pointer can reach`);
    await dragRuns(page, target); edits += 6;
    await settle(page, 400, 30_000);
    return { layer: target.id };
  });
  await run('drag-50', async () => {
    await press(page, 'Escape'); await press(page, 'Shift+Digit1'); await settle(page);
    const map = await page.evaluate((id) => {
      const rect = document.querySelector(`.lolly-frame-page[data-frame-id="${id}"]`)!.getBoundingClientRect();
      return { left: rect.left, top: rect.top, scale: rect.width / 1920 };
    }, fixture.artboards[0]!.id);
    const first = fixture.artboards[0]!;
    const client = (x: number, y: number) => ({ x: map.left + (x - first.x) * map.scale, y: map.top + (y - first.y) * map.scale });
    const from = client(ctx.band.x1, ctx.band.y1), to = client(ctx.band.x2, ctx.band.y2);
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 12 }); await page.mouse.up();
    await settle(page, 400, 30_000);
    const selected = await outlineCount(page);
    assert.ok(selected >= 10, `the marquee selected ${selected} layers`);
    await page.keyboard.press('Shift+Digit2'); await settle(page, 400, 30_000);
    const target = await hittableLayer(page, ctx.band.ids);
    assert.ok(target, 'a selected layer the pointer can reach');
    await dragRuns(page, target); edits += 6;
    await settle(page, 400, 30_000);
    return { selected, bandTouched: ctx.band.touched, layer: target.id };
  });
  await run('select-all-pan', async () => {
    await press(page, 'ControlOrMeta+KeyA');
    await settle(page, 400, 60_000);
    const selected = await outlineCount(page);
    const burst = await wheelBurst(page, cdp, await stageCentre(page), { x: 9.5, y: 6.5 }, 3000, false, 1500);
    await settle(page, 300, 60_000);
    return { selected, ...burst };
  });
  if (later('text-edit')) await frameArtboard(page, focusBoard);
  const singleLineText = children(row => row.kind === 'text' && !String(row.text).includes('\n'));
  await run('text-edit', async () => {
    const target = await hittableLayer(page, singleLineText, focusBoard);
    assert.ok(target, `a text layer on ${focusBoard} that the pointer can reach`);
    await page.mouse.dblclick(target.x, target.y);
    await page.waitForFunction(() => (document.activeElement as HTMLElement | null)?.isContentEditable === true, undefined, { timeout: 15_000 });
    await page.keyboard.press('End');
    await page.keyboard.type(' bench', { delay: 120 });
    // Cmd/Ctrl+Enter commits the edit; Escape would cancel the edit.
    await page.keyboard.press('ControlOrMeta+Enter');
    await settle(page, 600, 30_000);
    const text = await page.evaluate((id) => document.querySelector(`#tool-canvas [data-box-id="${id}"]`)?.textContent ?? '', target.id);
    if (text.includes('bench')) edits += 1;
    return { layer: target.id, committed: text.includes('bench') };
  });
  await run('undo-10', async () => {
    // Up to ten steps back, never more than this run's own edits (twelve drags and a
    // text edit when every earlier phase ran); a step that paints nothing ends early.
    const latencies: number[] = [];
    for (let i = 0; i < Math.min(10, edits); i++) {
      await page.evaluate(() => { (document.activeElement as HTMLElement | null)?.blur?.(); });
      const ms = await untilPainted(page, () => page.keyboard.press('ControlOrMeta+KeyZ'), 15_000).catch(() => null);
      if (ms === null) break;
      latencies.push(Math.round(ms));
      await sleep(150);
    }
    await settle(page, 400, 30_000);
    return { undone: latencies.length, editsAvailable: edits, undoToPaintMs: { ...distribution(latencies), samples: latencies } };
  });
  await run('slider-drag', async () => {
    await frameArtboard(page, focusBoard);
    const target = await hittableLayer(page, singleLineText, focusBoard);
    assert.ok(target, `a text layer on ${focusBoard} to select`);
    await page.mouse.click(target.x, target.y); await settle(page, 300, 10_000);
    // The text popover's line-height slider writes on every tick (review C5). With the
    // inspector docked, as in the desktop editor, Aa opens the inspector instead, whose
    // only sliders are opacity and corner radius and which commit on release.
    await page.locator('[data-cx="text"]').first().click();
    // A chrome range input is upgraded to the shell's own slider beside it (the input
    // stays as the value carrier), inside an inspector section that may be folded.
    const found = await page.waitForFunction(() => {
      const range = document.querySelector<HTMLInputElement>('.fc-text-panel input[type="range"][data-tp="lh"], .fc-insp input[type="range"][data-fld="opacity"]');
      if (!range) return null;
      const head = range.closest('.lp-sec')?.querySelector<HTMLElement>('.lp-sec-head[aria-expanded="false"]');
      if (head) { head.click(); return null; }
      const widget = range.parentElement?.querySelector<HTMLElement>('.custom-slider');
      if (!widget?.getBoundingClientRect().width) return null;
      widget.scrollIntoView({ block: 'center' });
      widget.setAttribute('data-bench-slider', '');
      return range.closest('.fc-text-panel') ? 'text popover line height' : 'inspector opacity';
    }, undefined, { timeout: 15_000, polling: 250 });
    const where = await found.jsonValue();
    const slider = page.locator('[data-bench-slider]');
    const box = await slider.boundingBox(); assert.ok(box);
    const y = box.y + box.height / 2, x0 = box.x + box.width * 0.2, x1 = box.x + box.width * 0.8;
    await page.mouse.move(x0, y); await page.mouse.down();
    const start = Date.now();
    for (let step = 1; step <= 60; step++) {
      await page.mouse.move(x0 + (x1 - x0) * step / 60, y);
      const wait = start + step * (2000 / 60) - Date.now();
      if (wait > 0) await sleep(wait);
    }
    await page.mouse.up();
    await settle(page, 600, 30_000);
    return { slider: where, layer: target.id, dragMs: Date.now() - start };
  });
  return rows;
}

const server = option('url') ? null : await serveCanvasBuild();
const base = option('url') ?? server!.url;
const browser = await chromium.launch({ channel: 'chrome', headless: !headed, args: webGpuLaunchArgs('auto') });
const report = {
  environment: {
    date: new Date().toISOString(), node: process.version, browser: browser.version(), headless: !headed, cpu: cpus()[0]?.model, cores: cpus().length, platform: platform(), arch: arch(),
    viewport: VIEWPORT, target: base, head: git('rev-parse', 'HEAD'), base: git('merge-base', 'HEAD', 'origin/main'), loadAtStart: loadavg(),
  },
  note: 'Seeded Design fixtures loaded through the editor input setter. Every phase keeps its raw samples. rAF intervals come from a frame loop the harness keeps running. ' +
    'CPU throttling is a lab multiplier, not a device. Machine load is uncontrolled; each phase records the one-minute load average before and after. ' +
    'Phase 13 of the review (a collaborative insert on W1) is not run here.',
  fixtures: [] as object[],
  rows: [] as object[],
};
try {
  for (const name of fixtures) {
    for (const cpu of rates) {
      for (let pass = 0; pass < repeat; pass++) {
        console.log(`${name}, CPU ${cpu}x${repeat > 1 ? `, pass ${pass + 1}` : ''}`);
        const context = await browser.newContext({ viewport: VIEWPORT, serviceWorkers: 'block', locale: 'en-GB', reducedMotion: 'no-preference' });
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send('Performance.enable', { timeDomain: 'timeTicks' });
        await page.addInitScript(instrument);
        const mountStart = Date.now();
        await page.goto(`${base}/#/tool/design`, { waitUntil: 'load' });
        await page.locator('#tool-canvas').waitFor({ timeout: 120_000 });
        await page.locator('.view-loading').waitFor({ state: 'detached', timeout: 120_000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => typeof window.__lollySetInput === 'function', undefined, { timeout: 60_000 });
        // A blank Design opens its template chooser over the canvas. Its close button is
        // the person's blank start; the fixture then arrives through the input setter.
        const chooser = page.locator('.tmpl-chooser-modal');
        if (await chooser.waitFor({ state: 'attached', timeout: 20_000 }).then(() => true, () => false)) {
          await chooser.locator('.tmpl-chooser-close').click();
          await chooser.waitFor({ state: 'detached', timeout: 20_000 });
        }
        await settle(page, 500, 20_000);
        const blankMountMs = Date.now() - mountStart;
        const mediaStart = Date.now();
        const media = await storeMedia(page, fixtureMedia(name));
        const fixture = designLargeFixture(name, { media });
        const ctx: RunContext = { page, cdp, fixture, cpu, band: marqueeBand(fixture, 50), probe: probeRow(fixture) };
        if (pass === 0 && cpu === rates[0]) {
          report.fixtures.push({ name, seed: fixture.seed, counts: fixture.counts, pages: fixture.pages.length, rowsJsonBytes: JSON.stringify(fixture.boxes).length, media: Object.keys(media).length, mediaMs: Date.now() - mediaStart });
        }
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
        const rows = await runPhases(ctx);
        for (const row of rows) report.rows.push({ ...row, pass, blankMountMs });
        await context.close();
        if (output) { mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report) + '\n'); }
      }
    }
  }
  report.environment = { ...report.environment, loadAtEnd: loadavg() } as typeof report.environment;
  if (output) { writeFileSync(output, JSON.stringify(report) + '\n'); console.log(`Wrote ${output}`); }
} finally { await browser.close(); await server?.close(); }
