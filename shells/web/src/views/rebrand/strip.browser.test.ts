// SPDX-License-Identifier: MPL-2.0
/**
 * The filmstrip in a real Chromium (plan 275 section 5.6): everything jsdom cannot
 * answer because its rects are zero. The drag from the picture with its feedback (the
 * lifted copy, the faded source, the insertion bar, the neighbours making room, the
 * edge scroll past the mounted window, the settle and the ring), pointer capture from
 * lift to drop, the frame budget over a forty-slide deck, Escape, a block drag of a
 * multi-selection, reduced motion, right to left, the menu from each pointer entry
 * point, the touch gesture table (emulated through the DevTools protocol), the 24 px
 * targets and the 3:1 contrast of the bar and the ring.
 *
 * The page is the real strip, drag and keys modules and the real stylesheets, bundled
 * by esbuild, over a synthetic deck: forty slides drawn as simple wireframes, and a
 * controller stub that records each command and applies a move so the drop is seen.
 * A green run without Chromium means "not exercised": the file skips by name where
 * Playwright's Chromium is not installed (`pnpm exec playwright install chromium`).
 *
 * The close-out's thumbnail (section 3.7) is measured here too: the 152 px row with
 * 200 px pictures, the number and the needs-a-look mark in their corners, More and the
 * layout pill on hover, on focus and on the current slide, the focus ring outside the
 * selection ring, the keyboard move's bar, and the 44 px targets under a coarse pointer.
 *
 * With `LOLLY_WP5_SHOTS=<dir>` it also writes the plan's screenshots, light and dark,
 * at 2x: strip-rest, strip-menu, strip-more-hover, strip-drag-lift, strip-drop-settle,
 * strip-multiselect, strip-left-out, strip-reduced-motion, strip-high-contrast,
 * strip-rtl (with the More button showing), strip-focus and strip-move-bar.
 *
 * The layout chooser both tools share (`lib/slide-structures-ui.ts`) is laid out here
 * too, over the neutral master: Up and Down step real rows, across bands. With
 * `LOLLY_WP4_SHOTS=<dir>` that test writes chooser-suggested, light and dark, at 2x:
 * the first group with Current, Suggested and Also fits, and the "Adds 1 slide" notes.
 *
 * Run directly: node --test shells/web/src/views/rebrand/strip.browser.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserType, Page, Route } from 'playwright';

/** What the harness page puts on `window` for the test to read. */
interface HarnessRb {
  sel: { slideId: string | null };
  drag: { frameCosts(): number[] };
  strip: { reveal(id: string): void };
}
declare global {
  interface Window {
    __strip(opts: Record<string, unknown>): string[];
    __rb: HarnessRb;
    __calls: Array<{ name: string; args: unknown[] }>;
    __said: string[];
    __capture: { got: number; lost: number };
  }
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const FONTS = join(REPO_ROOT, 'shells/web/public/fonts');
const SHOTS = process.env.LOLLY_WP5_SHOTS ?? '';
const CHOOSER_SHOTS = process.env.LOLLY_WP4_SHOTS ?? '';

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

/** The page's script: the real modules over a synthetic deck, mounted by `window.__strip(opts)`. */
const HARNESS = `
import '../../styles/app.css';
import '../../styles/parts/panel.css';
import '../../styles/parts/rebrand.css';
import '../../styles/parts/rebrand-strip.css';
import { neutralSlideMaster } from '@lolly/engine';
import { stripOps } from './strip.ts';
import { keysOps } from './keys.ts';
import { dragOps } from './strip-drag.ts';

const MASTER = neutralSlideMaster();
const INKS = ['#1f6f5c', '#30ba78', '#0c322c', '#7f56d9', '#e36f4a', '#2453ff'];
const LAYOUTS = ['title', 'columns-3', 'grid-2x2', 'content', 'image-and-text', 'stats-3', 'quote', 'agenda'];

function art(i) {
  const ink = INKS[i % INKS.length];
  const kind = i % 4;
  let body = '';
  if (kind === 0) body = '<rect x="96" y="300" width="1088" height="60" rx="8" fill="' + ink + '" opacity=".85"/><rect x="96" y="390" width="700" height="28" rx="6" fill="#8a948f"/>';
  else if (kind === 1) for (let c = 0; c < 3; c += 1) body += '<rect x="' + (96 + c * 370) + '" y="230" width="330" height="380" rx="14" fill="' + ink + '" opacity="' + (0.25 + c * 0.2) + '"/>';
  else if (kind === 2) for (let c = 0; c < 4; c += 1) body += '<rect x="' + (96 + (c % 2) * 550) + '" y="' + (220 + Math.floor(c / 2) * 220) + '" width="500" height="190" rx="12" fill="' + ink + '" opacity=".5"/>';
  else body = '<rect x="96" y="220" width="520" height="400" rx="12" fill="' + ink + '" opacity=".7"/><rect x="660" y="240" width="520" height="24" rx="6" fill="#8a948f"/><rect x="660" y="290" width="440" height="24" rx="6" fill="#8a948f"/><rect x="660" y="340" width="480" height="24" rx="6" fill="#8a948f"/>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="432" height="243"><rect width="1280" height="720" fill="#fbfbf7"/>'
    + '<rect x="96" y="80" width="' + (360 + (i * 53) % 420) + '" height="56" rx="8" fill="#0c322c"/>' + body
    + '<text x="1184" y="672" text-anchor="end" font-family="sans-serif" font-size="40" fill="#5b6560">' + (i + 1) + '</text></svg>';
}

window.__strip = (opts = {}) => {
  const count = opts.count ?? 40;
  const out = new Set(opts.leftOut ?? []);
  const problems = new Set(opts.problems ?? []);
  document.documentElement.dir = opts.rtl ? 'rtl' : 'ltr';
  document.body.innerHTML = '<div id="view" class="wp5-view"><p class="wp5-proposed" data-proposed></p><nav class="rb-strip" aria-label="Slides"></nav></div>';
  const ids = Array.from({ length: count }, (_, i) => 'deck/slide' + (i + 1));
  let order = ids.filter((id) => !out.has(ids.indexOf(id)));
  const titles = ['Welcome', 'Three pillars', 'Where we are', 'Plan', 'Customers', 'Numbers', 'What they said', 'Agenda'];
  const calls = [];
  let revision = 1;
  const derive = () => {
    const included = order;
    const left = ids.filter((id) => !included.includes(id));
    const slides = [...included, ...left].map((id, pos) => {
      const i = ids.indexOf(id);
      return {
        id, number: i + 1, include: included.includes(id), order: pos, layout: LAYOUTS[i % LAYOUTS.length],
        title: titles[i % titles.length], attention: i % 7 === 3 ? 1 : 0, unreviewed: 0, removed: 0, unresolved: 0, fidelity: 'editable',
      };
    });
    // A card about one slide's own problem, still to answer, for each slide in opts.problems.
    const queue = [...problems].map((i) => ({ id: 'own' + i, section: 'attention', slideIds: [ids[i]], objectIds: ['p' + i] }));
    return { plan: { revision, slides: [] }, queue, slides, objects: new Map(), summary: {}, itemOfObject: new Map(), pendingIds: queue.flatMap((item) => item.objectIds) };
  };
  const frames = ids.map((id, i) => ({ id: 'f' + i, sourceSlideId: id, name: 'Slide ' + (i + 1), width: 1280, height: 720, archetype: 'content', layers: [], furnitureLayerIds: [], placeholderLayerIds: [] }));
  const deck = { source: { instanceId: 'wp5', hash: 'h', lineageId: 'l' }, planRevision: 1, frames, tray: [], lineage: { forward: [], backward: [] } };
  const record = (name) => async (...args) => { calls.push({ name, args }); return { ok: true, touched: 1, skipped: 0 }; };
  const rb = {};
  const view = document.getElementById('view');
  rb.viewEl = view;
  rb.els = { root: view, strip: view.querySelector('.rb-strip'), compare: view, queue: view, decide: view, intake: view, report: view, top: view, foot: view, status: view, body: view, queueGrip: view, decideGrip: view, alert: view, scrim: view, modeSlot: view };
  rb.state = { phase: 'review', mode: 'renovate', plan: { revision }, preview: { deck, planRevision: 1 }, faithful: deck, designSystem: { id: 'wp5' }, source: { slides: [] }, previewStale: false };
  const apply = () => {
    revision += 1;
    rb.state = { ...rb.state, plan: { revision }, preview: { deck: { ...deck, planRevision: revision }, planRevision: revision } };
    rb.derived = derive();
    rb.render();
  };
  rb.controller = {
    include: async (list, yes) => { calls.push({ name: 'include', args: [list, yes] }); return { ok: true, touched: list.length, skipped: 0 }; },
    move: async (id, delta) => {
      calls.push({ name: 'move', args: [id, delta] });
      const at = order.indexOf(id); const to = Math.max(0, Math.min(order.length - 1, at + delta));
      order.splice(at, 1); order.splice(to, 0, id); apply();
      return { ok: true, touched: 1, skipped: 0 };
    },
    moveSlides: async (list, to) => {
      calls.push({ name: 'moveSlides', args: [list, to] });
      const set = new Set(list); const rest = order.filter((id) => !set.has(id));
      const block = order.filter((id) => set.has(id));
      order = [...rest.slice(0, to), ...block, ...rest.slice(to)]; apply();
      return { ok: true, touched: list.length, skipped: 0 };
    },
    moveTo: record('moveTo'), resetSlide: record('resetSlide'), autoMatchLayouts: record('autoMatchLayouts'),
    openInDesign: async (o) => { calls.push({ name: 'openInDesign', args: [o] }); return { ok: true, warnings: [] }; },
    mediaHref: () => undefined,
  };
  rb.derived = derive();
  rb.sel = { slideId: ids[opts.current ?? 0], objectId: null, itemId: null };
  rb.memo = {};
  rb.disposers = [];
  rb.narrow = false;
  const said = [];
  rb.announce = (m) => { said.push(m); };
  rb.render = () => {
    view.querySelector('[data-proposed]').textContent = 'Proposed: slide ' + ((ids.indexOf(rb.sel.slideId) + 1) || '');
    rb.strip.render();
  };
  rb.select = (next) => { rb.sel = { ...rb.sel, ...next }; rb.render(); if (rb.sel.slideId) rb.strip.reveal(rb.sel.slideId); };
  rb.compare = { ladder: () => ({ thumbnailLongEdge: 432 }), draw: (_deck, frame) => ({ svg: art(ids.indexOf(frame.sourceSlideId)), missing: false }) };
  rb.top = { menuOpen: () => false };
  rb.foot = { toReviewCount: () => opts.pending ?? 0 };
  rb.decide = { announceOutcome: (o, s) => { said.push(o.ok ? s : 'refused'); }, chooserOpen: () => false, closeChooser() {}, sheetOpen: () => false, closeSheet() {} };
  rb.reportOpen = false;
  rb.report = { close() {} };
  rb.chooser = {
    open: (list, entry) => { calls.push({ name: 'chooser', args: [list, entry] }); },
    close() {},
    master: () => MASTER,
    arrangementName: (arrangement) => (arrangement === 'picture' ? 'Kept as a picture' : 'Original arrangement'),
    autoMatchState: () => ({ shown: true, reason: '' }),
    autoMatchCounts: (list) => ({ count: list.length, likely: 0, anyMatch: list.length > 0 }),
    autoMatchBlockedFor: () => '',
    matchLabel: (count) => (count === 1 ? 'Match 1 slide' : 'Match ' + count + ' slides'),
    likelySet: () => new Set(),
    matchedText: () => '',
    noteAutoMatchRefused() {},
  };
  rb.keys = keysOps(rb);
  rb.strip = stripOps(rb);
  rb.drag = dragOps(rb);
  rb.strip.wire();
  rb.keys.wire();
  rb.render();
  window.__rb = rb;
  window.__calls = calls;
  window.__said = said;
  const scroll = view.querySelector('[data-scroll]');
  window.__capture = { got: 0, lost: 0 };
  scroll.addEventListener('gotpointercapture', () => { window.__capture.got += 1; });
  scroll.addEventListener('lostpointercapture', () => { window.__capture.lost += 1; });
  return ids;
};
`;

/** A page style for the harness: the view's own canvas colour, sized like the review's centre column. */
const PAGE_CSS = `
  body { margin: 0; background: var(--ui-color-surface-canvas); color: var(--ui-color-text-default); font-family: var(--ui-type-ui-family); }
  .wp5-view { width: 1180px; max-width: 100vw; box-sizing: border-box; padding: 16px 0 0; }
  .wp5-proposed { margin: 0 16px 8px; font-size: var(--ui-type-label); color: var(--ui-color-text-muted); }
  .wp5-view .rb-strip { border-top: 1px solid var(--ui-color-border-default); background: var(--ui-color-surface-canvas); }
`;

/**
 * The chooser's page: the shared grid over the neutral master, in the popover's own box,
 * with Current, Suggested and Also fits pinned and a few "Adds 1 slide" notes, the way
 * Rebrand hands them in. Mounted by `window.__chooser()`.
 */
const CHOOSER_HARNESS = `
import '../../styles/app.css';
import '../../styles/parts/panel.css';
import '../../styles/parts/rebrand-chooser.css';
import { neutralSlideMaster } from '@lolly/engine';
import { buildLayoutChooser, layoutTiles } from '../../lib/slide-structures-ui.ts';
import { archetypeThumbSvg } from '../free-canvas/archetype-thumb.ts';

window.__chooser = () => {
  const master = neutralSlideMaster();
  document.body.innerHTML = '<div class="rb-lc-pop wp4-pop" role="dialog" aria-label="Apply layout"><div class="rb-lc-pop-head"><strong class="rb-lc-pop-title">Apply layout</strong></div></div>';
  const box = document.querySelector('.wp4-pop');
  const chooser = buildLayoutChooser({
    master,
    draw: archetypeThumbSvg,
    tiles: layoutTiles(master),
    current: 'content',
    pinned: ['content', 'columns-3', 'grid-2x2'],
    leadingName: 'Slide 3',
    leadingNotes: [{ id: 'why', text: 'Three text boxes side by side, about the same width and lined up.' }],
    extras: {
      content: { caption: 'Current' },
      'columns-3': { caption: 'Suggested', suggested: true, describe: 'Three text boxes side by side, about the same width and lined up.' },
      'grid-2x2': { caption: 'Also fits', suggested: true },
    },
    width: 96,
    previewDelay: 0,
    onPick() {},
  });
  box.append(chooser.root);
  chooser.setMarks({
    agenda: { text: 'Adds 1 slide', describe: 'Continues on 1 more slide.' },
    'numbered-rows': { text: 'Adds 2 slides', describe: 'Continues on 2 more slides.' },
  });
  return chooser.tiles().length;
};
`;

const bundleCache = new Map<string, { js: string; css: string }>();
async function bundle(contents = HARNESS): Promise<{ js: string; css: string }> {
  const hit = bundleCache.get(contents);
  if (hit) return hit;
  const { build } = await import('esbuild');
  const out = await build({
    stdin: { contents, resolveDir: HERE, sourcefile: 'strip-harness.ts', loader: 'ts' },
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
        // Fonts and other public files load from the page's own origin, served below.
        b.onResolve({ filter: /^\//, namespace: 'file' }, (args) => (args.kind === 'url-token' ? { path: args.path, external: true } : undefined));
      },
    }],
  });
  const js = out.outputFiles.find((f) => f.path.endsWith('.js'))?.text ?? '';
  const css = out.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '';
  const made = { js, css };
  bundleCache.set(contents, made);
  return made;
}

interface Opened {
  page: Page;
  close: () => Promise<void>;
}

async function openPage(opts: { theme?: 'light' | 'dark'; reducedMotion?: boolean; touch?: boolean; contrast?: boolean; height?: number; harness?: string } = {}): Promise<Opened> {
  const { chromium } = browserOrReason as { chromium: BrowserType };
  const { js, css } = await bundle(opts.harness);
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1200, height: opts.height ?? 420 },
    deviceScaleFactor: 2,
    hasTouch: opts.touch === true,
    reducedMotion: opts.reducedMotion ? 'reduce' : 'no-preference',
    colorScheme: opts.theme === 'dark' ? 'dark' : 'light',
  });
  const page = await context.newPage();
  const html = `<!doctype html><html lang="en" data-theme="${opts.theme === 'dark' ? 'dark' : 'light'}"${opts.contrast ? ' data-a11y-contrast="high"' : ''}>`
    + `<head><meta charset="utf-8"><style>${css}</style><style>${PAGE_CSS}</style></head><body></body></html>`;
  await page.route('http://wp5.test/**', async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html });
    if (url.pathname === '/harness.js') return route.fulfill({ contentType: 'text/javascript', body: js });
    const font = join(FONTS, decodeURIComponent(url.pathname.replace(/^\/fonts\//, '')));
    if (url.pathname.startsWith('/fonts/') && existsSync(font)) return route.fulfill({ contentType: 'font/woff2', body: readFileSync(font) });
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto('http://wp5.test/');
  await page.addScriptTag({ url: 'http://wp5.test/harness.js' });
  return { page, close: () => browser.close() };
}

async function mountDeck(page: Page, opts: Record<string, unknown> = {}): Promise<string[]> {
  const ids = await page.evaluate((o: Record<string, unknown>) => window.__strip(o), opts);
  await page.evaluate(() => document.fonts?.ready);
  await frames(page, 2);
  return ids;
}

function frames(page: Page, n = 1): Promise<void> {
  return page.evaluate((count: number) => new Promise<void>((resolve) => {
    let left = count;
    const step = (): void => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), n);
}

async function centreOf(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(selector).first().boundingBox();
  assert.ok(box, `no box for ${selector}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const tile = (id: string): string => `.rb-thumb[data-slide="${id}"] .rb-thumb-pick`;

async function calls(page: Page): Promise<Array<{ name: string; args: unknown[] }>> {
  return page.evaluate(() => window.__calls);
}

/** A screenshot of the view, or of the whole viewport when a menu hangs below it. */
async function shot(page: Page, name: string, theme: string, whole = false): Promise<void> {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  const path = join(SHOTS, `${name}-${theme}.png`);
  if (whole) await page.screenshot({ path, animations: 'allow' });
  else await page.locator('.wp5-view').screenshot({ path, animations: 'allow' });
}

/** WCAG contrast of two computed colours. */
function contrast(a: string, b: string): number {
  const parse = (c: string): number[] => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  const lum = (c: string): number => {
    const [r, g, bl] = parse(c).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (bl ?? 0);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

test('a drag from the picture lifts, opens a gap, scrolls past the window and drops, capture held and every frame under 8 ms', { skip: SKIP }, async () => {
  for (const theme of ['light', 'dark'] as const) {
    const { page, close } = await openPage({ theme });
    try {
      const ids = await mountDeck(page, { count: 40, current: 1 });
      await shot(page, 'strip-rest', theme);
      const mountedBefore = await page.locator('.rb-thumb').count();
      assert.ok(mountedBefore < 40, `windowed: ${mountedBefore} of 40 mounted`);
      const from = await centreOf(page, tile(ids[1]!));
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + 12, from.y, { steps: 3 });
      await frames(page, 2);
      assert.equal(await page.locator('.rb-drag-lift').count(), 1, 'the copy is lifted');
      assert.equal(await page.locator(`.rb-thumb[data-slide="${ids[1]}"][data-drag-source="true"]`).count(), 1, 'the source fades and keeps its slot');
      const to = await centreOf(page, tile(ids[4]!));
      await page.mouse.move(to.x, to.y, { steps: 8 });
      await frames(page, 14);
      // One marker: the faded copy stands in the slot it will take, and no bar cuts it.
      assert.equal(await page.locator('.rb-drop-bar').count(), 1);
      assert.equal(await page.locator('.rb-drop-bar').isHidden(), true, 'no bar drawn through the faded copy');
      const moved = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.rb-thumb')].filter((el) => el.style.transform).length);
      assert.ok(moved >= 2, `the neighbours made room (${moved} moved)`);
      await shot(page, 'strip-drag-lift', theme);
      // To the right edge, where the strip scrolls itself.
      const strip = await page.locator('[data-scroll]').boundingBox();
      assert.ok(strip);
      await page.mouse.move(strip.x + strip.width - 12, to.y, { steps: 6 });
      await page.waitForFunction(() => Math.abs((document.querySelector('[data-scroll]') as HTMLElement).scrollLeft) > 2400, null, { timeout: 8000 });
      await page.mouse.move(strip.x + strip.width - 200, to.y, { steps: 4 });
      await frames(page, 6);
      const capture = await page.evaluate(() => ({ ...window.__capture, held: (document.querySelector('[data-scroll]') as HTMLElement).hasPointerCapture(1) }));
      assert.equal(capture.lost, 0, 'pointer capture was never lost during the drag');
      assert.equal(capture.held, true, 'the scroller holds the capture');
      const mountedFar = await page.evaluate((list: string[]) => list.slice(20).some((id) => Boolean(document.querySelector(`.rb-thumb[data-slide="${id}"]`))), ids);
      assert.ok(mountedFar, 'rows past the first window mounted during the drag');
      await page.mouse.up();
      await frames(page, 2);
      await shot(page, 'strip-drop-settle', theme);
      const drop = (await calls(page)).find((call) => call.name === 'moveSlides');
      assert.ok(drop, 'the drop wrote one move');
      assert.deepEqual(drop.args[0], [ids[1]]);
      assert.ok(Number(drop.args[1]) > 12, `the drop past the window landed at ${String(drop.args[1])}`);
      assert.equal(await page.locator(`.rb-thumb[data-slide="${ids[1]}"][data-landed="true"]`).count(), 1, 'the landed thumbnail rings');
      const said = await page.evaluate(() => window.__said as string[]);
      assert.match(said.at(-1) ?? '', /^Moved slide 2 to position \d+ of 40\.$/);
      const costs: number[] = await page.evaluate(() => window.__rb.drag.frameCosts());
      assert.ok(costs.length > 20, `frames measured: ${costs.length}`);
      const worst = Math.max(...costs);
      assert.ok(worst < 8, `every drag frame under 8 ms of script, worst ${worst.toFixed(2)} ms`);
      assert.equal(await page.locator('.rb-drag-lift').count(), 0, 'the copy is gone once settled');
    } finally {
      await close();
    }
  }
});

test('Escape during a drag puts the slide back and writes nothing', { skip: SKIP }, async () => {
  const { page, close } = await openPage();
  try {
    const ids = await mountDeck(page, { count: 12 });
    const from = await centreOf(page, tile(ids[0]!));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    const to = await centreOf(page, tile(ids[3]!));
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await frames(page, 3);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await frames(page, 20);
    assert.equal((await calls(page)).filter((call) => call.name === 'moveSlides').length, 0);
    const transformed = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.rb-thumb')].filter((el) => el.style.transform).length);
    assert.equal(transformed, 0, 'the neighbours are back');
    assert.equal(await page.locator('.rb-drop-bar').count(), 0);
    const said = await page.evaluate(() => window.__said as string[]);
    assert.equal(said.at(-1), 'Move cancelled.');
  } finally {
    await close();
  }
});

test('the menu opens from a right click, the More button and Shift+F10, and every target is at least 24 px', { skip: SKIP }, async () => {
  for (const theme of ['light', 'dark'] as const) {
    const { page, close } = await openPage({ theme, height: 700 });
    try {
      const ids = await mountDeck(page, { count: 12, current: 2, pending: 3 });
      await page.hover(tile(ids[2]!));
      await frames(page, 2);
      const more = page.locator(`[data-more="${ids[2]}"]`);
      assert.equal(await more.evaluate((el: HTMLElement) => getComputedStyle(el).opacity), '1', 'hover shows the More button');
      const size = await more.boundingBox();
      assert.ok(size && size.width >= 24 && size.height >= 24, `More is ${size?.width}x${size?.height}`);
      await shot(page, 'strip-more-hover', theme);
      await more.click();
      await page.waitForSelector('.ctx-menu [data-act="layout"]');
      const rows = await page.$$eval('.ctx-menu [data-act]', (els: Element[]) => els.map((el) => (el as HTMLElement).dataset.act));
      assert.deepEqual(rows, ['layout', 'exclude', 'earlier', 'later', 'position', 'reset', 'design', 'select', 'shortcuts']);
      // Open in Design runs with cards to answer (the footer's confirm asks). Reset has
      // nothing to put back on an untouched slide: it keeps its focus and says why.
      assert.equal(await page.locator('.ctx-menu [data-act="design"]').getAttribute('aria-disabled'), null);
      const reset = page.locator('.ctx-menu [data-act="reset"]');
      assert.equal(await reset.getAttribute('aria-disabled'), 'true');
      assert.equal(await reset.evaluate((el: HTMLButtonElement) => el.disabled), false);
      assert.equal(await page.locator('.ctx-menu .folder-menu-reason').first().textContent(), 'Nothing to reset on this slide.');
      await shot(page, 'strip-menu', theme, true);
      await page.keyboard.press('Escape');
      await frames(page, 2);
      assert.equal(await page.locator('.ctx-menu [data-act]').count(), 0, 'Esc closes the menu');
      await page.click(tile(ids[4]!), { button: 'right' });
      await page.waitForSelector('.ctx-menu [data-act="layout"]');
      await page.keyboard.press('Escape');
      await page.focus(tile(ids[4]!));
      await page.keyboard.press('Shift+F10');
      await page.waitForSelector('.ctx-menu [data-act="layout"]', { timeout: 3000 });
      await page.keyboard.press('Escape');
      await frames(page, 2);
      assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.classList.contains('rb-thumb-pick')), true, 'focus goes back to the thumbnail');
      // A row that redraws the thumbnail (Leave out, Move later) leaves focus on it, not on the page.
      for (const act of ['exclude', 'later']) {
        await page.focus(tile(ids[4]!));
        await page.keyboard.press('Shift+F10');
        await page.waitForSelector(`.ctx-menu [data-act="${act}"]`, { timeout: 3000 });
        await page.click(`.ctx-menu [data-act="${act}"]`);
        await frames(page, 3);
        const active = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          return el?.classList.contains('rb-thumb-pick') ? el.dataset.slide : el?.tagName;
        });
        assert.equal(active, ids[4], `after ${act}, focus is on the slide's thumbnail`);
      }
    } finally {
      await close();
    }
  }
});

test('Shift and Ctrl build a selection, the bar says how many, and a drag moves the block', { skip: SKIP }, async () => {
  for (const theme of ['light', 'dark'] as const) {
    const { page, close } = await openPage({ theme });
    try {
      const ids = await mountDeck(page, { count: 12 });
      await page.click(tile(ids[1]!));
      await page.click(tile(ids[3]!), { modifiers: ['Shift'] });
      await page.click(tile(ids[6]!), { modifiers: ['ControlOrMeta'] });
      await frames(page, 2);
      assert.equal(await page.locator('.rb-strip-count').textContent(), '4 slides selected');
      const small = await page.$$eval('[data-bar-act]', (els: Element[]) => els.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width < 24 || r.height < 24;
      }).length);
      assert.equal(small, 0, 'every bar button is at least 24 px');
      await shot(page, 'strip-multiselect', theme);
      // The last click scrolled the slide it picked into view: drag that one.
      const from = await centreOf(page, tile(ids[6]!));
      const to = await centreOf(page, tile(ids[8]!));
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 10 });
      await frames(page, 3);
      assert.equal(await page.locator('.rb-drag-lift[data-stack="true"] .rb-drag-count').textContent(), '4');
      await page.mouse.up();
      await frames(page, 2);
      const drop = (await calls(page)).find((call) => call.name === 'moveSlides');
      assert.deepEqual(drop?.args[0], [ids[1], ids[2], ids[3], ids[6]], 'the block keeps its own order');
    } finally {
      await close();
    }
  }
});

test('a slide left out is grey with a crossed eye, and cannot be dragged', { skip: SKIP }, async () => {
  for (const theme of ['light', 'dark'] as const) {
    const { page, close } = await openPage({ theme });
    try {
      const ids = await mountDeck(page, { count: 8, leftOut: [2] });
      const left = page.locator(`.rb-thumb[data-slide="${ids[2]}"]`);
      assert.equal(await left.getAttribute('data-include'), 'false');
      assert.match(await left.locator('.rb-thumb-pick').getAttribute('aria-label') ?? '', /Left out/);
      assert.equal(await left.locator('.rb-thumb-out svg').count(), 1, 'the crossed eye');
      assert.equal(await left.locator('[data-layout-of]').count(), 0, 'no layout to change');
      // A slide left out sits after the slides in the deck: bring it into view.
      await page.evaluate((id: string) => window.__rb.strip.reveal(id), ids[2]!);
      await frames(page, 3);
      await shot(page, 'strip-left-out', theme);
      const from = await centreOf(page, tile(ids[2]!));
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x - 300, from.y, { steps: 8 });
      await frames(page, 2);
      assert.equal(await page.locator('.rb-drag-lift').count(), 0);
      await page.mouse.up();
    } finally {
      await close();
    }
  }
});

test('under reduced motion only the bar moves', { skip: SKIP }, async () => {
  for (const theme of ['light', 'dark'] as const) {
    const { page, close } = await openPage({ theme, reducedMotion: true });
    try {
      const ids = await mountDeck(page, { count: 12 });
      const from = await centreOf(page, tile(ids[0]!));
      const to = await centreOf(page, tile(ids[3]!));
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 8 });
      await frames(page, 3);
      const moved = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.rb-thumb')].filter((el) => el.style.transform).length);
      assert.equal(moved, 0, 'no neighbour moves');
      assert.equal(await page.locator('.rb-drop-bar').isVisible(), true, 'the bar marks the drop, in the gap');
      await shot(page, 'strip-reduced-motion', theme);
      await page.mouse.up();
    } finally {
      await close();
    }
  }
});

test('right to left: the strip starts at the right, scrolls with a negative scrollLeft and drops by pitch', { skip: SKIP }, async () => {
  for (const theme of ['light', 'dark'] as const) {
    const { page, close } = await openPage({ theme });
    try {
      const ids = await mountDeck(page, { count: 40, rtl: true });
      const first = await page.locator(tile(ids[0]!)).boundingBox();
      const second = await page.locator(tile(ids[1]!)).boundingBox();
      assert.ok(first && second && second.x < first.x, 'the second slide sits left of the first');
      // The thumbnail mirrors: More at the end corner of the picture (left), the number at
      // the start corner (right), never both in one corner.
      await page.hover(tile(ids[1]!));
      await page.waitForFunction((id: string) => getComputedStyle(document.querySelector(`[data-more="${id}"]`) as HTMLElement).opacity === '1', ids[1]!);
      await page.waitForTimeout(250);
      const more = await page.locator(`[data-more="${ids[1]}"]`).boundingBox();
      const num = await page.locator(`.rb-thumb[data-slide="${ids[1]}"] .rb-thumb-num`).boundingBox();
      assert.ok(more && num && second, 'More and the number are drawn');
      assert.ok(more.x < second.x + second.width / 2, 'More sits at the left, the end edge in right to left');
      assert.ok(num.x > second.x + second.width / 2, 'the number sits at the right, the start edge');
      assert.ok(num.y < second.y + second.height / 2, 'the number is in the top corner of the picture');
      await shot(page, 'strip-rtl', theme);
      await page.mouse.move(0, 0);
      const from = await centreOf(page, tile(ids[0]!));
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      const strip = await page.locator('[data-scroll]').boundingBox();
      assert.ok(strip);
      await page.mouse.move(strip.x + 12, from.y, { steps: 10 });
      await page.waitForFunction(() => (document.querySelector('[data-scroll]') as HTMLElement).scrollLeft < -1200, null, { timeout: 8000 });
      await page.mouse.move(strip.x + 240, from.y, { steps: 4 });
      await frames(page, 4);
      await page.mouse.up();
      await frames(page, 2);
      const drop = (await calls(page)).find((call) => call.name === 'moveSlides');
      assert.ok(drop && Number(drop.args[1]) > 6, `landed at ${String(drop?.args[1])}`);
      // Right is toward the start in this direction.
      await page.focus(tile(ids[5]!));
      await page.keyboard.press('ArrowLeft');
      const current = await page.evaluate(() => window.__rb.sel.slideId);
      assert.equal(current, ids[6]);
    } finally {
      await close();
    }
  }
});

test('the bar and the selection ring hold 3:1 against the strip in light, dark and high contrast', { skip: SKIP }, async () => {
  for (const variant of [{ theme: 'light' }, { theme: 'dark' }, { theme: 'light', contrast: true }, { theme: 'dark', contrast: true }] as const) {
    const { page, close } = await openPage(variant);
    try {
      const ids = await mountDeck(page, { count: 12, current: 1 });
      const from = await centreOf(page, tile(ids[0]!));
      const to = await centreOf(page, tile(ids[4]!));
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 8 });
      await frames(page, 3);
      const colours = await page.evaluate(() => {
        const strip = document.querySelector('.rb-strip') as HTMLElement;
        const bar = document.querySelector('.rb-drop-bar') as HTMLElement;
        const ring = document.querySelector('.rb-thumb-pick[aria-current="true"] .rb-thumb-art') as HTMLElement;
        return { ground: getComputedStyle(strip).backgroundColor, bar: getComputedStyle(bar).backgroundColor, ring: getComputedStyle(ring).outlineColor };
      });
      const name = `${variant.theme}${'contrast' in variant ? ' high contrast' : ''}`;
      assert.ok(contrast(colours.bar, colours.ground) >= 3, `${name}: bar ${colours.bar} on ${colours.ground}`);
      assert.ok(contrast(colours.ring, colours.ground) >= 3, `${name}: ring ${colours.ring} on ${colours.ground}`);
      if ('contrast' in variant) await shot(page, 'strip-high-contrast', variant.theme);
      await page.mouse.up();
    } finally {
      await close();
    }
  }
});

test('touch follows the gesture table: pan, arm and drag, hold for the menu, a second finger cancels', { skip: SKIP }, async () => {
  const { page, close } = await openPage({ touch: true });
  try {
    const ids = await mountDeck(page, { count: 12 });
    const cdp = await page.context().newCDPSession(page);
    const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', points: Array<{ x: number; y: number }>): Promise<void> => {
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, id) => ({ x: p.x, y: p.y, id })) });
    };
    const wait = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });
    const at = await centreOf(page, tile(ids[1]!));

    // Travels before 180 ms: the strip pans, no drag.
    await touch('touchStart', [at]);
    await wait(40);
    for (let i = 1; i <= 5; i += 1) await touch('touchMove', [{ x: at.x - i * 12, y: at.y }]);
    await touch('touchEnd', []);
    await frames(page, 2);
    assert.equal(await page.locator('.rb-drag-lift').count(), 0, 'row 1: a quick travel is a pan');
    // A touch that starts while the pan still glides cannot be held back by the page, so let it settle.
    await wait(900);
    await page.evaluate(() => { (document.querySelector('[data-scroll]') as HTMLElement).scrollLeft = 0; });
    await frames(page, 2);

    // Still to 180 ms: armed; then a travel drags.
    await touch('touchStart', [at]);
    await wait(260);
    assert.equal(await page.locator(`.rb-thumb[data-slide="${ids[1]}"][data-armed="true"]`).count(), 1, 'row 2: armed after 180 ms');
    for (let i = 1; i <= 10; i += 1) await touch('touchMove', [{ x: at.x + i * 30, y: at.y }]);
    await frames(page, 3);
    assert.equal(await page.locator('.rb-drag-lift').count(), 1, 'row 3: an armed travel drags');
    await touch('touchEnd', []);
    await frames(page, 3);
    assert.ok((await calls(page)).some((call) => call.name === 'moveSlides'), 'the drop moved the slide');

    // Still to 420 ms: the menu.
    const home = async (): Promise<void> => {
      await wait(600);
      await page.evaluate(() => { (document.querySelector('[data-scroll]') as HTMLElement).scrollLeft = 0; });
      await frames(page, 3);
    };
    await home();
    const again = await centreOf(page, tile(ids[2]!));
    await touch('touchStart', [again]);
    await wait(560);
    await touch('touchEnd', []);
    await page.waitForSelector('.ctx-menu [data-act="layout"]', { timeout: 3000 });
    assert.equal(await page.locator('.rb-drag-lift').count(), 0, 'row 4: the hold opened the menu, no drag');
    await page.keyboard.press('Escape');

    // A second finger cancels a running drag.
    const moves = (await calls(page)).filter((call) => call.name === 'moveSlides').length;
    await home();
    const third = await centreOf(page, tile(ids[3]!));
    await touch('touchStart', [third]);
    await wait(260);
    for (let i = 1; i <= 6; i += 1) await touch('touchMove', [{ x: third.x + i * 30, y: third.y }]);
    await frames(page, 2);
    await touch('touchStart', [{ x: third.x + 180, y: third.y }, { x: third.x + 40, y: third.y + 40 }]);
    await touch('touchEnd', []);
    await frames(page, 20);
    assert.equal(await page.locator('.rb-drag-lift').count(), 0, 'row 6: the second finger cancelled');
    assert.equal((await calls(page)).filter((call) => call.name === 'moveSlides').length, moves, 'nothing was written');
  } finally {
    await close();
  }
});

test('the close-out thumbnail: a 152 px row of 200 px pictures, corner badges, and controls on hover, focus and the current slide', { skip: SKIP }, async () => {
  for (const theme of ['light', 'dark'] as const) {
    const { page, close } = await openPage({ theme });
    try {
      const ids = await mountDeck(page, { count: 12, current: 2, problems: [4] });
      await page.mouse.move(2, 2);
      await page.waitForTimeout(200);
      const box = async (selector: string): Promise<{ x: number; y: number; width: number; height: number }> => {
        const b = await page.locator(selector).first().boundingBox();
        assert.ok(b, `no box for ${selector}`);
        return b;
      };
      const strip = await box('.rb-strip');
      assert.ok(Math.abs(strip.height - 152) < 0.6, `the strip is ${strip.height} px tall`);
      const art = await box(`.rb-thumb[data-slide="${ids[4]}"] .rb-thumb-art`);
      assert.ok(Math.abs(art.width - 200) < 0.6 && Math.abs(art.height - 112.5) < 0.6, `the picture is ${art.width} by ${art.height}`);
      // The number top start, the mark top end, More inward of the mark.
      const num = await box(`.rb-thumb[data-slide="${ids[4]}"] .rb-thumb-num`);
      assert.ok(num.x - art.x <= 6 && num.y - art.y <= 6, 'the number is in the top start corner');
      const dot = await box(`.rb-thumb[data-slide="${ids[4]}"] .rb-thumb-dot`);
      assert.ok(art.x + art.width - (dot.x + dot.width) <= 8 && dot.y - art.y <= 8, 'the mark is in the top end corner');
      assert.equal(await page.locator('.rb-thumb-dot').count(), 1, 'only the slide with its own problem is marked');
      const opacity = (selector: string): Promise<string> => page.locator(selector).first().evaluate((el: Element) => getComputedStyle(el).opacity);
      // At rest: the current slide carries More and the pill, the others do not.
      assert.equal(await opacity(`[data-more="${ids[2]}"]`), '1');
      assert.equal(await opacity(`[data-layout-of="${ids[2]}"]`), '1');
      assert.equal(await opacity(`[data-more="${ids[0]}"]`), '0');
      assert.equal(await opacity(`[data-layout-of="${ids[0]}"]`), '0');
      await shot(page, 'strip-rest', theme);
      // Hover shows them, and More moves inward of the mark.
      await page.hover(tile(ids[4]!));
      await page.waitForTimeout(250);
      assert.equal(await opacity(`[data-more="${ids[4]}"]`), '1');
      assert.equal(await opacity(`[data-layout-of="${ids[4]}"]`), '1');
      const more = await box(`[data-more="${ids[4]}"]`);
      assert.ok(more.x + more.width <= dot.x, 'More sits beside the mark, not on it');
      const pill = await box(`[data-layout-of="${ids[4]}"]`);
      const face = await box(`[data-layout-of="${ids[4]}"] .rb-thumb-layout-pill`);
      assert.ok(pill.height >= 24 && more.width >= 24 && more.height >= 24, `targets: pill ${pill.height}, More ${more.width}x${more.height}`);
      assert.ok(Math.abs(face.height - 16) < 0.6, `the pill is ${face.height} px tall`);
      assert.ok(pill.width <= art.width / 2 + 0.5, `the pill is ${pill.width} px, at most half the picture`);
      await shot(page, 'strip-hover', theme);
      // Focus from the keyboard: the ring sits outside the selection ring, and the
      // controls show on the focused slide.
      await page.mouse.move(2, 2);
      await page.focus(tile(ids[2]!));
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(250);
      const focused = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const cs = getComputedStyle(el);
        return { slide: el.dataset.slide, offset: cs.outlineOffset, style: cs.outlineStyle, visible: el.matches(':focus-visible') };
      });
      assert.equal(focused.slide, ids[3]);
      assert.equal(focused.visible, true);
      assert.equal(focused.offset, '5px');
      assert.equal(await opacity(`[data-more="${ids[3]}"]`), '1', 'focus-within shows More');
      assert.equal(await opacity(`[data-layout-of="${ids[3]}"]`), '1', 'and the pill');
      await shot(page, 'strip-focus', theme);
      // The keyboard move: M lifts the slide and the bar says where it is.
      await page.keyboard.press('m');
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(250);
      const bar = page.locator('[data-bar][data-mode="move"]');
      assert.equal(await bar.isVisible(), true);
      assert.match(await bar.locator('.rb-strip-count').textContent() ?? '', /^Moving slide 4\. Position 5 of 12\./);
      const lifted = await page.locator(`.rb-thumb[data-slide="${ids[3]}"] .rb-thumb-pick`).evaluate((el: Element) => getComputedStyle(el).transform);
      assert.notEqual(lifted, 'none', 'the moving slide lifts');
      const small = await page.$$eval('[data-bar-act]', (els: Element[]) => els.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width < 24 || r.height < 24;
      }).length);
      assert.equal(small, 0, 'the bar\'s buttons are at least 24 px');
      await shot(page, 'strip-move-bar', theme);
      await page.keyboard.press('Escape');
      await frames(page, 2);
      assert.equal(await page.locator('[data-bar]').isHidden(), true);
    } finally {
      await close();
    }
  }
});

test('under a coarse pointer the pill is gone and every target is 44 px', { skip: SKIP }, async () => {
  const { page, close } = await openPage({ touch: true });
  try {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await cdp.send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
    const coarse = await page.evaluate(() => matchMedia('(any-pointer: coarse)').matches);
    if (!coarse) {
      assert.ok(true, 'this Chromium does not emulate a coarse pointer');
      return;
    }
    const ids = await mountDeck(page, { count: 12, current: 1 });
    assert.equal(await page.locator(`[data-layout-of="${ids[1]}"]`).evaluate((el: Element) => getComputedStyle(el).display), 'none');
    await page.evaluate((list: string[]) => {
      const strip = (window.__rb as unknown as { strip: { pick(id: string, how?: string): void } }).strip;
      strip.pick(list[1]!);
      strip.pick(list[3]!, 'toggle');
    }, ids);
    await frames(page, 2);
    const sizes = await page.$$eval('.rb-strip button, .rb-strip [role="option"]', (els: Element[]) => els
      .filter((el) => getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && (el as HTMLElement).offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return Math.min(r.width, r.height);
      }));
    assert.ok(sizes.length > 0);
    assert.ok(sizes.every((size) => size >= 44), `targets under 44: ${sizes.filter((size) => size < 44).join(', ')}`);
  } finally {
    await close();
  }
});

test('the layout chooser laid out: Down and Up step real rows, and Down from one band goes on into the next', { skip: SKIP }, async () => {
  for (const theme of ['light', 'dark'] as const) {
    const { page, close } = await openPage({ theme, height: 900, harness: CHOOSER_HARNESS });
    try {
      const count = await page.evaluate(() => (window as unknown as { __chooser(): number }).__chooser());
      assert.ok(count > 20, `the whole grid: ${count} tiles`);
      await page.evaluate(() => document.fonts?.ready);
      await frames(page, 2);
      if (CHOOSER_SHOTS) {
        mkdirSync(CHOOSER_SHOTS, { recursive: true });
        await page.locator('.wp4-pop').screenshot({ path: join(CHOOSER_SHOTS, `chooser-suggested-${theme}.png`), animations: 'allow' });
      }
      const at = async (): Promise<{ key: string; top: number; left: number; band: string }> => page.evaluate(() => {
        const el = document.activeElement as HTMLElement;
        const r = el.getBoundingClientRect();
        return { key: el.dataset.key ?? '', top: Math.round(r.top), left: Math.round(r.left), band: el.closest<HTMLElement>('[data-band]')?.dataset.band ?? '' };
      });
      // The current tile is the Tab stop, the first in the first group.
      await page.locator('.arch-tile[aria-current="true"]').focus();
      const start = await at();
      assert.equal(start.band, 'lead');
      await page.keyboard.press('ArrowDown');
      const down = await at();
      assert.ok(down.top > start.top, `Down moved down (${start.top} to ${down.top})`);
      assert.notEqual(down.band, 'lead', 'Down from the first group\'s only row goes on into the next band');
      assert.ok(Math.abs(down.left - start.left) < 60, 'to the tile under it');
      await page.keyboard.press('ArrowDown');
      const further = await at();
      assert.ok(further.top > down.top, 'and on down the rows');
      await page.keyboard.press('ArrowUp');
      assert.equal((await at()).key, down.key, 'Up comes back the same way');
      await page.keyboard.press('ArrowUp');
      assert.equal((await at()).key, start.key);
      // One tile rule: the suggested tiles are flat like the rest, marked by the sparkle in
      // their caption, never by a dashed edge (dashed means a drop area in this app).
      const edges = await page.$$eval('.arch-tile', (els: Element[]) => els.map((el) => {
        const cs = getComputedStyle(el);
        return `${cs.borderTopStyle} ${cs.outlineStyle}`;
      }));
      assert.ok(edges.every((edge) => !edge.includes('dashed')), 'no dashed tile');
      const sparkles = await page.$$eval('.arch-tile[data-suggested="true"]', (els: Element[]) => els.map((el) => Boolean(el.querySelector('.arch-cap svg'))));
      assert.deepEqual(sparkles, [true, true]);
      // The count sits on the name's line, after the name, and off the picture.
      const suffix = await page.locator('.arch-count:not([hidden])').first().boundingBox();
      const name = await page.locator('.arch-count:not([hidden])').first().locator('xpath=..').locator('.arch-name').boundingBox();
      const pic = await page.locator('.arch-count:not([hidden])').first().locator('xpath=../..').locator('svg').first().boundingBox();
      assert.ok(suffix && name && pic, 'a count, its name and its picture');
      assert.ok(Math.abs((suffix.y + suffix.height / 2) - (name.y + name.height / 2)) < 4, 'on the name\'s line');
      assert.ok(suffix.x >= name.x + name.width - 1, 'after the name');
      assert.ok(suffix.y >= pic.y + pic.height, 'under the wireframe, not on it');
    } finally {
      await close();
    }
  }
});
