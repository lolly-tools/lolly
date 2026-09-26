// SPDX-License-Identifier: MPL-2.0
/**
 * The resizable columns of `#/rebrand` in a real Chromium (plan 275 close-out section
 * 9.1), over every rebrand stylesheet in the orchestrator's order, where layout is real:
 * the grips on the column lines with their 24 px strip leaning off the column's edge, the
 * pill on hover, a pointer drag of each edge, the stage never under 480 px at 1440 by
 * 900, the hero re-fitted in the frame the width is written, a click that widens, the
 * widths after a reload, and no grip at 390 px. The comparison's pane is a copy of the
 * classes compare.ts writes (a pane, its cell and the hero), since the comparison module
 * itself needs a compiled deck.
 *
 * The jsdom half (which grips show, the keys, the stage floor, storage, the fit rule) is
 * columns.test.ts. A green run without Chromium means "not exercised": every case here
 * skips by name where Playwright's Chromium is not installed
 * (`pnpm exec playwright install chromium`).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/rebrand/columns.browser.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import type { BrowserType, Page } from 'playwright';
import { reviewState } from './shared.test-utils.ts';

// The regions are built in jsdom, as the orchestrator builds them, and handed to the page.
const dom = new JSDOM('<!DOCTYPE html><body></body>', { url: 'https://lolly.test/#/rebrand' });
for (const key of [
  'window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'DOMParser',
  'history', 'location', 'navigator', 'getComputedStyle', 'sessionStorage', 'localStorage',
]) {
  Object.defineProperty(globalThis, key, { value: Reflect.get(dom.window, key), configurable: true, writable: true });
}
const { applyLayout, buildRegions } = await import('../rebrand.ts');
const { COLUMNS_KEY, STAGE_MIN_PX } = await import('./columns.ts');

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const FONTS = join(REPO_ROOT, 'shells/web/public/fonts');

async function chromiumOrSkip(): Promise<{ chromium: BrowserType } | string> {
  let chromium: BrowserType;
  try { ({ chromium } = await import('playwright')); }
  catch { return 'playwright not installed'; }
  try {
    const p = chromium.executablePath();
    if (!p || !existsSync(p)) return 'no Chromium (pnpm exec playwright install chromium)';
  } catch { return 'no Chromium (pnpm exec playwright install chromium)'; }
  return { chromium };
}
const browserOrReason = await chromiumOrSkip();
const SKIP = typeof browserOrReason === 'string' ? browserOrReason : false;

/** The rebrand sheets in the order the orchestrator imports them. */
function sheetImports(): string {
  const orchestrator = readFileSync(new URL('../rebrand.ts', import.meta.url), 'utf8');
  return [...orchestrator.matchAll(/^import '\.\.\/styles\/parts\/(rebrand[a-z-]*\.css)';$/gm)]
    .map((m) => `import '../../styles/parts/${m[1]}';`)
    .join('\n');
}

/** The regions as the orchestrator builds them for a review, taken from jsdom. */
function regionsHtml(): string {
  const view = document.createElement('div');
  const els = buildRegions(view);
  applyLayout({ els, state: reviewState(), narrow: false, medium: false, reportOpen: false });
  return view.innerHTML;
}

declare global {
  interface Window {
    __mount(html: string, opts: { narrow: boolean; medium: boolean }): void;
  }
}

const HARNESS = () => `
import '../../styles/app.css';
import '../../styles/parts/panel.css';
${sheetImports()}
import { columnsOps } from './columns.ts';

window.__mount = (html, opts) => {
  document.body.innerHTML = html;
  const q = (s) => document.querySelector(s);
  const els = {
    root: q('.rb'), top: q('.rb-top'), modeSlot: q('.rb-mode-slot'), intake: q('.rb-intake'), body: q('.rb-body'),
    queue: q('.rb-queue'), queueGrip: q('.rb-grip[data-grip="queue"]'), compare: q('.rb-compare'),
    decideGrip: q('.rb-grip[data-grip="decide"]'), decide: q('.rb-decide'), strip: q('.rb-strip'), report: q('.rb-report'),
    foot: q('.rb-foot'), status: q('.rb-status'), alert: q('.rb-alert'), scrim: q('.rb-scrim'),
  };
  els.root.dataset.narrow = String(opts.narrow);
  els.root.dataset.medium = String(opts.medium);
  // The comparison's pane, cell and hero as compare.ts writes them, showing Proposed alone.
  els.compare.innerHTML = '<div class="rb-cmp" data-side="proposed" data-show="proposed"><div class="rb-cmp-row" data-bar></div>'
    + '<div class="rb-cmp-panes"><figure class="rb-pane" data-pane="proposed" data-on style="--rb-ratio:1.7778">'
    + '<div class="rb-frames rb-cell" data-frames><div class="rb-frame"><div class="rb-stage rb-hero" style="--rb-ratio:1.7778">'
    + '<div class="rb-art"><svg viewBox="0 0 16 9" width="100%" height="100%"><rect width="16" height="9" fill="#30ba78"/></svg></div></div></div></div>'
    + '<figcaption class="rb-pane-cap"><strong>Proposed</strong></figcaption></figure></div></div>';
  els.queue.innerHTML = '<p style="margin:16px">Queue</p>';
  els.decide.innerHTML = '<p style="margin:16px">Decision</p>';
  const rb = { els, state: { mode: 'renovate', phase: 'review' }, narrow: opts.narrow, medium: opts.medium, disposers: [] };
  rb.columns = columnsOps(rb);
  rb.columns.wire();
  rb.columns.render();
  window.__rb = rb;
};
`;

let bundled: { js: string; css: string } | null = null;
async function bundle(): Promise<{ js: string; css: string }> {
  if (bundled) return bundled;
  const { build } = await import('esbuild');
  const out = await build({
    stdin: { contents: HARNESS(), resolveDir: HERE, sourcefile: 'columns-harness.ts', loader: 'ts' },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'chrome120',
    outdir: 'out',
    logLevel: 'silent',
    define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"test"' },
    plugins: [{
      name: 'external-public',
      setup(b) {
        b.onResolve({ filter: /^\//, namespace: 'file' }, (args) => (args.kind === 'url-token' ? { path: args.path, external: true } : undefined));
      },
    }],
  });
  bundled = {
    js: out.outputFiles.find((f) => f.path.endsWith('.js'))?.text ?? '',
    css: out.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '',
  };
  return bundled;
}

interface Opened { page: Page; close: () => Promise<void>; load: (opts?: { narrow?: boolean; medium?: boolean }) => Promise<void> }

async function openPage(opts: { width?: number; height?: number; theme?: 'light' | 'dark' } = {}): Promise<Opened> {
  const { chromium } = browserOrReason as { chromium: BrowserType };
  const { js, css } = await bundle();
  const html = regionsHtml();
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: opts.width ?? 1440, height: opts.height ?? 900 },
    deviceScaleFactor: 1,
    colorScheme: opts.theme ?? 'light',
  });
  const page = await context.newPage();
  const doc = `<!doctype html><html lang="en" data-theme="${opts.theme ?? 'light'}"><head><meta charset="utf-8"><style>${css}</style>`
    + '<style>body{margin:0}</style></head><body></body></html>';
  await page.route('http://cp17.test/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: doc });
    if (url.pathname === '/harness.js') return route.fulfill({ contentType: 'text/javascript', body: js });
    const font = join(FONTS, decodeURIComponent(url.pathname.replace(/^\/fonts\//, '')));
    if (url.pathname.startsWith('/fonts/') && existsSync(font)) return route.fulfill({ contentType: 'font/woff2', body: readFileSync(font) });
    return route.fulfill({ status: 404, body: '' });
  });
  const load = async (mountOpts: { narrow?: boolean; medium?: boolean } = {}): Promise<void> => {
    await page.goto('http://cp17.test/');
    await page.addScriptTag({ url: 'http://cp17.test/harness.js' });
    await page.evaluate(([h, o]) => window.__mount(h, o), [html, { narrow: mountOpts.narrow === true, medium: mountOpts.medium === true }] as const);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  };
  return { page, load, close: () => browser.close() };
}

/** The boxes the checks read, in CSS pixels. */
async function boxes(page: Page) {
  return page.evaluate(() => {
    const r = (s: string) => {
      const el = document.querySelector<HTMLElement>(s);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { left: b.left, right: b.right, width: b.width, shown: getComputedStyle(el).display !== 'none' };
    };
    return {
      queue: r('.rb-queue')!, work: r('.rb-work')!, decide: r('.rb-decide')!,
      queueGrip: r('.rb-grip[data-grip="queue"]')!, decideGrip: r('.rb-grip[data-grip="decide"]')!,
      pane: r('.rb-pane')!, hero: r('.rb-hero')!,
    };
  });
}

const centre = (b: { left: number; width: number }): number => b.left + b.width / 2;

/** Where a grip's pill is drawn, in page px: its pseudo-element's box read off the computed style. */
async function pillCentre(page: Page, grip: 'queue' | 'decide'): Promise<number> {
  return page.evaluate((which) => {
    const el = document.querySelector<HTMLElement>(`.rb-grip[data-grip="${which}"]`)!;
    const s = getComputedStyle(el, '::before');
    return el.getBoundingClientRect().left + Number.parseFloat(s.left) + Number.parseFloat(s.marginLeft) + Number.parseFloat(s.width) / 2;
  }, grip);
}

test('Chromium: the grips sit on the column lines at 1440 by 900, and the pill shows on hover', { skip: SKIP }, async () => {
  const { page, load, close } = await openPage();
  try {
    await load();
    const b = await boxes(page);
    assert.equal(b.queueGrip.shown, true);
    assert.equal(b.decideGrip.shown, true);
    assert.equal(Math.round(b.queue.width), 272);
    assert.equal(Math.round(b.decide.width), 320);
    // The body's own width, not the viewport's: Linux gives a scrolling container a 15 px
    // scrollbar where macOS overlays one, so the columns share what the body has.
    const bodyWidth = await page.evaluate(() => document.querySelector<HTMLElement>('.rb-body')!.clientWidth);
    assert.equal(Math.round(b.work.width), bodyWidth - 272 - 320);
    // The strip is 24 px and leans off the column it resizes, 4 px over it, so it never
    // covers that column's scrollbar; the pill stays on the line.
    assert.equal(Math.round(b.queueGrip.width), 24);
    assert.equal(Math.round(b.decideGrip.width), 24);
    assert.ok(Math.abs(b.queueGrip.left - (b.queue.right - 4)) <= 0.5, 'the queue grip reaches 4 px into the queue');
    assert.ok(Math.abs(b.decideGrip.right - (b.decide.left + 4)) <= 0.5, 'the decision grip reaches 4 px into the column');
    assert.ok(Math.abs((await pillCentre(page, 'queue')) - b.queue.right) <= 0.5, 'the queue pill is on the line');
    assert.ok(Math.abs((await pillCentre(page, 'decide')) - b.decide.left) <= 0.5, 'the decision pill is on the line');
    const pill = () => page.evaluate(() => {
      const grip = document.querySelector('.rb-grip[data-grip="queue"]')!;
      const s = getComputedStyle(grip, '::before');
      return { opacity: Number(s.opacity), height: s.height, cursor: getComputedStyle(grip).cursor };
    });
    const rest = await pill();
    assert.equal(rest.opacity, 0, 'invisible at rest');
    assert.equal(rest.cursor, 'col-resize');
    await page.mouse.move(centre(b.queueGrip), 450);
    await page.waitForTimeout(250);
    const hover = await pill();
    assert.equal(hover.opacity, 1, 'the pill shows on hover');
    assert.equal(hover.height, '44px');
  } finally {
    await close();
  }
});

test('Chromium: a drag moves each edge, the stage stays at least 480 px, the hero re-fits in the same frame, and a reload keeps the widths', { skip: SKIP }, async () => {
  const { page, load, close } = await openPage();
  try {
    await load();
    let b = await boxes(page);
    // Drag the queue's edge to 360, pressing on the line itself (inside the strip).
    await page.mouse.move(b.queue.right, 450);
    await page.mouse.down();
    for (const x of [300, 330, b.queue.left + 360]) {
      await page.mouse.move(x, 450);
      // A frame callback queued now runs after the one the move asked for, in the same frame.
      const fit = await page.evaluate(() => new Promise<{ pane: number; hero: number; queue: number }>((resolve) => requestAnimationFrame(() => {
        const pane = document.querySelector<HTMLElement>('.rb-pane')!;
        const cs = getComputedStyle(pane);
        const inner = pane.getBoundingClientRect().width - Number.parseFloat(cs.paddingLeft) - Number.parseFloat(cs.paddingRight);
        resolve({ pane: inner, hero: document.querySelector('.rb-hero')!.getBoundingClientRect().width, queue: document.querySelector('.rb-queue')!.getBoundingClientRect().width });
      })));
      assert.ok(Math.abs(fit.queue - Math.round(x - b.queue.left)) <= 1, `the width is written in the frame the move asked for (${fit.queue})`);
      assert.ok(Math.abs(fit.hero - fit.pane) <= 1, `the hero fills its pane in that frame (${fit.hero} of ${fit.pane})`);
    }
    await page.mouse.up();
    b = await boxes(page);
    assert.equal(Math.round(b.queue.width), 360);
    assert.equal(await page.getAttribute('.rb-grip[data-grip="queue"]', 'aria-valuenow'), '360');

    // Drag the decision column's edge to 420.
    await page.mouse.move(b.decide.left, 450);
    await page.mouse.down();
    await page.mouse.move(b.decide.right - 420, 450, { steps: 4 });
    await page.mouse.up();
    b = await boxes(page);
    assert.equal(Math.round(b.decide.width), 420);
    assert.equal(await page.getAttribute('.rb-grip[data-grip="decide"]', 'aria-valuenow'), '420');
    assert.ok(b.work.width >= 480);

    // Pull the queue as far as it goes: the decision column gives way, and the stage holds.
    await page.mouse.move(b.queue.right, 450);
    await page.mouse.down();
    let least = Infinity;
    for (let x = b.queue.right; x <= 1400; x += 60) {
      await page.mouse.move(x, 450);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
      least = Math.min(least, (await boxes(page)).work.width);
    }
    await page.mouse.up();
    b = await boxes(page);
    assert.ok(least >= STAGE_MIN_PX - 0.5, `the stage never went under 480 (least ${least})`);
    assert.equal(Math.round(b.queue.width), 420, 'the queue reaches its maximum');
    assert.equal(Math.round(b.decide.width), 420, 'at 1440 the decision column did not have to give way');

    // A double click puts the queue back, then a reload restores what was left.
    await page.mouse.dblclick(centre(b.queueGrip), 450);
    b = await boxes(page);
    assert.equal(Math.round(b.queue.width), 272);
    await load();
    b = await boxes(page);
    assert.equal(Math.round(b.queue.width), 272);
    assert.equal(Math.round(b.decide.width), 420, 'the stored width comes back after a reload');
    assert.equal(await page.evaluate((k) => localStorage.getItem(k), COLUMNS_KEY), '{"decide":420}');
  } finally {
    await close();
  }
});

test('Chromium: a click on a grip widens the column a step after the double-click wait', { skip: SKIP }, async () => {
  const { page, load, close } = await openPage();
  try {
    await load();
    let b = await boxes(page);
    await page.mouse.click(centre(b.queueGrip), 450);
    await page.waitForTimeout(450);
    b = await boxes(page);
    assert.equal(Math.round(b.queue.width), 336, 'one click widens by 64');
    assert.equal(await page.getAttribute('.rb-grip[data-grip="queue"]', 'aria-valuetext'), '336 pixels wide');
  } finally {
    await close();
  }
});

test('Chromium: at 390 px no grip shows and the body keeps the narrow grid', { skip: SKIP }, async () => {
  const { page, load, close } = await openPage({ width: 390, height: 844 });
  try {
    await load({ narrow: true });
    const b = await boxes(page);
    assert.equal(b.queueGrip.shown, false);
    assert.equal(b.decideGrip.shown, false);
    assert.equal(await page.evaluate(() => document.querySelector<HTMLElement>('.rb-body')!.dataset.columns ?? null), null);
    // No sideways scroll: nothing is wider than the window (a Linux scrollbar may take 15 px of 390).
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'the page does not scroll sideways');
  } finally {
    await close();
  }
});
