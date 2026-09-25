// SPDX-License-Identifier: MPL-2.0
/**
 * The whole `#/rebrand` review in a real Chromium, at a phone's size (plan 275 close-out
 * principle 7 and section 2.8): the page is never wider than the screen, nothing a finger
 * can reach is under the 44 px target, the slide keeps a readable width on a phone held
 * on its side, and on a phone held upright the fold under the slide is never an empty
 * band (the docked decision sheet takes it). The column hairlines of decision 6 are
 * checked here too: none at rest, and back under high contrast.
 *
 * The page is every view module over every rebrand stylesheet (the ones views/rebrand.ts
 * imports, in its order, with app.css and the panel primitive under them), wired the way
 * the orchestrator wires them: the regions from its own `buildRegions` and `applyLayout`,
 * the tier from the real `isNarrow` and `isMedium`, the selection settled on the first
 * card to review. What stands in is the controller, a stub that serves one pipeline run
 * and records each command, and the host, whose asset reads find nothing (so a picture
 * the deck stores is drawn as its empty frame). Libraries the review never reaches while
 * it is on screen (text shaping, codecs, three.js, the other languages) are stubbed out
 * of the bundle so it stays small enough to load quickly.
 *
 * The decks are the committed fixtures (tests/fixtures/rebrand: adversarial, formatting,
 * vector), each run through the real pipeline once. `LOLLY_REBRAND_DECKS` adds decks
 * that stay outside the repository, as a list of .pptx paths separated by the platform's
 * path separator (the close-out measures MEDDPICC, the data deck and the picture deck
 * this way). A green run without Chromium means "not exercised": every case skips by
 * name where Playwright's Chromium is not installed (`pnpm exec playwright install chromium`).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/views/rebrand/rebrand.browser.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { basename, delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrowserType, Page, Route } from 'playwright';
import { compileFaithful } from '@lolly/engine';
import { ARCHETYPE_IDS } from '@lolly-tools/core';
import { STARTER_COLORS, runRebrandPipeline, type RebrandRunV1 } from '../../../../../tests/helpers/rebrand-pipeline.ts';
import type { RebrandStateV1 } from '../../lib/rebrand/controller-api.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const FONTS = join(REPO_ROOT, 'shells/web/public/fonts');
const FIXTURES = join(REPO_ROOT, 'tests/fixtures/rebrand');

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

// ─── the decks ───────────────────────────────────────────────────────────────

/** The committed decks, then the ones the environment names. */
function deckPaths(): string[] {
  const committed = ['adversarial.pptx', 'formatting.pptx', 'vector.pptx'].map((name) => join(FIXTURES, name));
  const extra = (process.env.LOLLY_REBRAND_DECKS ?? '').split(delimiter).map((p) => p.trim()).filter((p) => p && existsSync(p));
  return [...committed, ...extra];
}

/** The review state the controller would hold after reading one deck, as plain data. */
function stateOf(run: RebrandRunV1): RebrandStateV1 {
  return {
    phase: 'review',
    mode: 'renovate',
    progress: null,
    error: null,
    project: null,
    source: run.deck,
    census: run.census,
    plan: run.plan,
    faithful: compileFaithful(run.deck),
    preview: { deck: run.compiled, planRevision: run.plan.revision },
    previewStale: false,
    designSystem: {
      id: 'lolly/start',
      name: 'Lolly start',
      neutralMaster: false,
      hasLogo: true,
      archetypes: [...ARCHETYPE_IDS],
      colors: Object.fromEntries(STARTER_COLORS),
      fonts: ['SUSE'],
    },
    save: { kind: 'none' },
    history: { canUndo: true, canRedo: false },
    keep: { status: 'idle' },
    readiness: [],
    tick: 1,
  };
}

const runs = new Map<string, Promise<string>>();
/** One pipeline run per deck per process, kept as the JSON handed to the page. */
function deckState(path: string): Promise<string> {
  let made = runs.get(path);
  if (!made) {
    made = runRebrandPipeline(basename(path), new Uint8Array(readFileSync(path))).then((run) => JSON.stringify(stateOf(run)));
    runs.set(path, made);
  }
  return made;
}

// ─── the page ────────────────────────────────────────────────────────────────

/** The rebrand sheets in the order the orchestrator imports them. */
function sheetImports(): string {
  const orchestrator = readFileSync(new URL('../rebrand.ts', import.meta.url), 'utf8');
  return [...orchestrator.matchAll(/^import '\.\.\/styles\/parts\/(rebrand[a-z-]*\.css)';$/gm)]
    .map((m) => `import '../../styles/parts/${m[1]}';`)
    .join('\n');
}

declare global {
  interface Window {
    __rebrandMount(stateJson: string): string;
    __rebrandView: { narrow: boolean; medium: boolean };
  }
}

/**
 * The page's script: views/rebrand.ts's mount with a stub controller in place of the
 * real one. Kept to the orchestrator's order of ops, wiring and render.
 */
const HARNESS = () => `
import '../../styles/app.css';
import '../../styles/parts/panel.css';
${sheetImports()}
import { applyLayout, buildRegions } from '../rebrand.ts';
import { deriveReview, isMedium, isNarrow } from './shared.ts';
import { intakeOps } from './intake.ts';
import { topOps } from './top.ts';
import { footOps } from './foot.ts';
import { reportOps } from './report.ts';
import { keepOps } from './keep.ts';
import { queueOps } from './queue.ts';
import { compareOps } from './compare.ts';
import { decideOps } from './decide.ts';
import { stripOps } from './strip.ts';
import { keysOps } from './keys.ts';
import { chooserOps } from './layout-chooser.ts';
import { dragOps } from './strip-drag.ts';
import { themeOps } from './theme.ts';
import { columnsOps } from './columns.ts';

const OK = { ok: true, touched: 1, skipped: 0 };
const ok = async () => OK;

window.__rebrandMount = (stateJson) => {
  const state = JSON.parse(stateJson);
  const view = document.getElementById('view');
  const els = buildRegions(view);
  // The commands the review sends answer ok; the optional ones are left out, as a
  // controller without them would.
  const controller = {
    getState: () => state,
    subscribe: () => () => {},
    start: async () => {},
    open: async () => {},
    recent: async () => [],
    presets: async () => [],
    remove: async () => {},
    close: () => {},
    decide: ok, acceptSuggestions: ok, include: ok, move: ok, setLayout: ok, moveTo: ok, moveSlides: ok,
    duplicateSlide: ok, resetSlide: ok, setTheme: ok, setGround: ok, readSlidePictures: ok, setColour: ok,
    setFont: ok, shuffleColours: ok, undo: ok, redo: ok,
    openInDesign: async () => ({ ok: false, reason: 'no-plan', warnings: [] }),
    downloadProject: async () => null,
    setMode: async () => {},
    keepDesignDownload: async () => null,
    mediaHref: () => undefined,
    cancel: () => {},
    reload: async () => {},
    dispose: () => {},
  };
  const host = {
    assets: { get: async () => null, pick: async () => null, list: async () => [] },
    export: { download: async () => {} },
    log: { info() {}, warn() {}, error() {}, debug() {} },
  };
  const rb = {};
  rb.viewEl = view;
  rb.host = host;
  rb.params = new URLSearchParams();
  rb.els = els;
  rb.controller = controller;
  rb.state = state;
  rb.derived = null;
  rb.sel = { slideId: null, objectId: null, itemId: null };
  rb.queueTab = 'attention';
  rb.narrow = isNarrow();
  rb.medium = isMedium();
  rb.compareSide = rb.narrow ? 'proposed' : 'both';
  rb.reportOpen = false;
  rb.memo = {};
  rb.disposers = [];
  rb.render = () => {
    rb.derived = deriveReview(rb.state, rb.derived);
    const derived = rb.derived;
    if (derived && !rb.sel.slideId) {
      const first = derived.queue.find((item) => item.section === 'attention');
      rb.sel = first
        ? { itemId: first.id, objectId: first.exemplar, slideId: derived.objects.get(first.exemplar)?.slideId ?? first.slideIds[0] ?? null }
        : { itemId: null, objectId: null, slideId: derived.slides.find((slide) => slide.include)?.id ?? derived.slides[0]?.id ?? null };
    }
    applyLayout(rb);
    rb.top.render();
    rb.keep.render();
    rb.intake.render();
    if (rb.derived) {
      rb.queue.render();
      rb.compare.render();
      rb.decide.render();
      rb.strip.render();
      rb.columns.render();
      rb.foot.render();
    }
    rb.report.render();
    els.scrim.hidden = !rb.decide.sheetOpen() || rb.reportOpen;
  };
  rb.select = (next) => {
    rb.sel = { ...rb.sel, ...next };
    rb.render();
    if (rb.sel.slideId) rb.strip.reveal(rb.sel.slideId);
  };
  rb.announce = (message) => { els.status.textContent = message; };
  rb.intake = intakeOps(rb);
  rb.top = topOps(rb);
  rb.foot = footOps(rb);
  rb.report = reportOps(rb);
  rb.keep = keepOps(rb);
  rb.queue = queueOps(rb);
  rb.compare = compareOps(rb);
  rb.decide = decideOps(rb);
  rb.strip = stripOps(rb);
  rb.keys = keysOps(rb);
  rb.chooser = chooserOps(rb);
  rb.drag = dragOps(rb);
  rb.theme = themeOps(rb);
  rb.columns = columnsOps(rb);
  for (const name of ['top', 'keep', 'intake', 'queue', 'compare', 'decide', 'strip', 'report', 'foot', 'keys', 'columns']) rb[name].wire();
  rb.render();
  window.__rebrandView = rb;
  return rb.derived ? 'review' : 'no plan';
};
`;

/** Libraries the review never calls while it is on screen, and every language but English. */
const STUBBED = /^harfbuzzjs|^heic-to|^three(?:\/|$)|\.wasm(?:\?url)?$|\/locales\/(?:caps\/)?[a-z-]+\.json$/;

let bundled: Promise<{ js: string; css: string }> | null = null;
function bundle(): Promise<{ js: string; css: string }> {
  bundled ??= (async () => {
    const { build } = await import('esbuild');
    const out = await build({
      stdin: { contents: HARNESS(), resolveDir: HERE, sourcefile: 'rebrand-harness.ts', loader: 'ts' },
      bundle: true,
      write: false,
      format: 'iife',
      platform: 'browser',
      target: 'chrome120',
      outdir: 'out',
      logLevel: 'silent',
      define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"test"' },
      plugins: [{
        name: 'rebrand-harness',
        setup(b) {
          // Fonts and other public files load from the page's own origin, served below.
          b.onResolve({ filter: /^\//, namespace: 'file' }, (args) => (args.kind === 'url-token' ? { path: args.path, external: true } : undefined));
          b.onResolve({ filter: STUBBED }, (args) => ({ path: args.path, namespace: 'stub' }));
          b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'module.exports = {};', loader: 'js' }));
        },
      }],
    });
    return {
      js: out.outputFiles.find((f) => f.path.endsWith('.js'))?.text ?? '',
      css: out.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '',
    };
  })();
  return bundled;
}

const PAGE_CSS = 'body { margin: 0; }';

interface Opened { page: Page; errors: string[]; close: () => Promise<void> }

async function openView(opts: { width: number; height: number; touch?: boolean; theme?: 'light' | 'dark'; contrast?: boolean }, deck: string): Promise<Opened> {
  const { chromium } = browserOrReason as { chromium: BrowserType };
  const [{ js, css }, stateJson] = await Promise.all([bundle(), deckState(deck)]);
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: opts.width, height: opts.height },
    deviceScaleFactor: 1,
    hasTouch: opts.touch === true,
    isMobile: opts.touch === true,
    colorScheme: opts.theme === 'dark' ? 'dark' : 'light',
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const html = `<!doctype html><html lang="en" data-theme="${opts.theme === 'dark' ? 'dark' : 'light'}"${opts.contrast ? ' data-a11y-contrast="high"' : ''}>`
    + `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style><style>${PAGE_CSS}</style></head><body><div id="view"></div></body></html>`;
  await page.route('http://rebrand.test/**', async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html });
    if (url.pathname === '/harness.js') return route.fulfill({ contentType: 'text/javascript', body: js });
    const font = join(FONTS, decodeURIComponent(url.pathname.replace(/^\/fonts\//, '')));
    if (url.pathname.startsWith('/fonts/') && existsSync(font)) return route.fulfill({ contentType: 'font/woff2', body: readFileSync(font) });
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto('http://rebrand.test/');
  await page.addScriptTag({ url: 'http://rebrand.test/harness.js' });
  const phase = await page.evaluate((s: string) => window.__rebrandMount(s), stateJson);
  assert.equal(phase, 'review', `${basename(deck)} reaches the review`);
  await page.evaluate(() => document.fonts?.ready);
  await settle(page);
  return { page, errors, close: () => browser.close() };
}

/** A few frames and a short wait, so drawings, observers and fonts are done. */
async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(300);
  await page.evaluate(() => new Promise<void>((resolve) => { requestAnimationFrame(() => requestAnimationFrame(() => resolve())); }));
}

/** What the phone cases measure, read in one go. */
interface Measured {
  narrow: string;
  coarse: boolean;
  scrollWidth: number;
  innerWidth: number;
  small: string[];
  stage: { w: number; h: number } | null;
  regions: Record<string, { top: number; bottom: number; height: number } | null>;
  sheet: string;
  heads: number;
  grips: string[];
}

function measure(page: Page): Promise<Measured> {
  return page.evaluate(() => {
    const shown = (el: Element): boolean => !el.closest('[hidden], [inert]') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
    // A visually hidden element (clipped to nothing) is words for a screen reader, not a target.
    const clipped = (el: Element): boolean => {
      for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
        if (getComputedStyle(n).clipPath === 'inset(50%)') return true;
      }
      return false;
    };
    const focusable = [...document.querySelectorAll<HTMLElement>('.rb :is(button, a[href], input:not([type="hidden"]):not([type="file"]), select, textarea, [tabindex]:not([tabindex="-1"]))')]
      .filter((el) => shown(el) && !clipped(el));
    // The object hot spots on a slide are the objects' own boxes, so their size is the
    // slide's; each object is also a full-size row in the decision column's Objects list
    // (WCAG 2.5.8, the equivalent-control exception).
    // A checkbox or a radio inside its label is reached through the whole label.
    const target = (el: HTMLElement): Element => (el.matches('input[type="checkbox"], input[type="radio"]') ? el.closest('label') ?? el : el);
    const small = focusable
      .filter((el) => !el.matches('.rb-ov'))
      .map((el) => ({ el, r: target(el).getBoundingClientRect() }))
      .filter(({ r }) => r.width < 43.5 || r.height < 43.5)
      .map(({ el, r }) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    const edge = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el || !shown(el)) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
    };
    const stageEl = document.querySelector('[data-pane="proposed"] .rb-stage');
    const stage = stageEl && shown(stageEl) ? stageEl.getBoundingClientRect() : null;
    const decide = document.querySelector<HTMLElement>('.rb-decide');
    return {
      narrow: document.querySelector<HTMLElement>('.rb')?.dataset.narrow ?? '',
      coarse: matchMedia('(any-pointer: coarse)').matches,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth,
      small,
      stage: stage ? { w: Math.round(stage.width), h: Math.round(stage.height) } : null,
      regions: Object.fromEntries(['.rb-top', '.rb-queue', '.rb-compare', '.rb-decide', '.rb-strip', '.rb-foot'].map((s) => [s, edge(s)])),
      sheet: decide?.dataset.sheet ?? '',
      heads: [...document.querySelectorAll('.rb-decide :is(.lp-sec-head, .lp-band-head)')].filter(shown).length,
      grips: [...document.querySelectorAll('.rb-grip')].filter(shown).map((el) => (el as HTMLElement).dataset.grip ?? ''),
    };
  });
}

// ─── the cases ───────────────────────────────────────────────────────────────

const PORTRAIT = { width: 390, height: 844, touch: true };
const LANDSCAPE = { width: 844, height: 390, touch: true };

for (const deck of deckPaths()) {
  const name = basename(deck);

  test(`${name} at 390 by 844: one column, never wider than the phone, every target a finger's, the fold filled`, { skip: SKIP }, async () => {
    const { page, errors, close } = await openView(PORTRAIT, deck);
    try {
      const m = await measure(page);
      assert.equal(m.narrow, 'true');
      assert.ok(m.coarse, 'the touch emulation is a coarse pointer');
      assert.equal(m.scrollWidth, m.innerWidth, 'the page is never wider than the screen');
      assert.deepEqual(m.small, [], 'no target under 44 px under a coarse pointer');
      assert.deepEqual(m.grips, [], 'no column grip on a phone');
      const { '.rb-compare': compare, '.rb-decide': decide, '.rb-strip': strip } = m.regions;
      assert.ok(compare && decide && strip, 'the comparison, the docked sheet and the strip all show');
      assert.equal(m.sheet, 'closed', 'the sheet starts docked');
      // The docked sheet starts where the comparison ends and runs to the strip, so no
      // band under the slide is left empty.
      assert.ok(Math.abs(decide.top - compare.bottom) <= 1, `the dock meets the comparison (${decide.top} against ${compare.bottom})`);
      assert.ok(Math.abs(strip.top - decide.bottom) <= 1, `the dock runs to the strip (${decide.bottom} against ${strip.top})`);
      assert.ok(decide.height >= 100, `the dock keeps its least room (${decide.height})`);
      assert.ok(m.heads >= 1, 'the dock shows at least one section head');
      assert.ok(m.stage && m.stage.w >= 300, 'the Proposed slide takes the phone\'s width');
      // A chip made current scrolls its own row, never the page or the tab bar.
      const tabsBefore = await page.evaluate(() => document.querySelector('.rb-q-tabs')?.getBoundingClientRect().left ?? -1);
      const chip = page.locator('.rb-q-chip').last();
      if (await chip.count()) {
        await chip.click();
        await settle(page);
        await page.keyboard.press('Escape');
        await settle(page);
        const after = await page.evaluate(() => ({
          tabs: document.querySelector('.rb-q-tabs')?.getBoundingClientRect().left ?? -1,
          page: document.scrollingElement?.scrollLeft ?? 0,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        assert.equal(after.tabs, tabsBefore, 'the tab bar keeps its left edge');
        assert.equal(after.page, 0, 'the page never scrolls sideways');
        assert.equal(after.scrollWidth, m.innerWidth);
      }
      assert.deepEqual(errors, []);
    } finally {
      await close();
    }
  });

  test(`${name} at 844 by 390: a phone on its side is narrow, the slide at least 160 px wide`, { skip: SKIP }, async () => {
    const { page, errors, close } = await openView(LANDSCAPE, deck);
    try {
      const m = await measure(page);
      assert.equal(m.narrow, 'true', 'under 480 px tall counts as narrow');
      assert.equal(m.scrollWidth, m.innerWidth, 'the page is never wider than the screen');
      assert.deepEqual(m.small, [], 'no target under 44 px under a coarse pointer');
      assert.deepEqual(m.grips, []);
      assert.ok(m.stage && m.stage.w >= 160, `the slide is at least 160 px wide (${m.stage?.w})`);
      assert.equal(m.regions['.rb-queue'], null, 'the queue steps aside');
      assert.equal(m.regions['.rb-decide'], null, 'the docked sheet steps aside');
      assert.ok(m.regions['.rb-strip'] && m.regions['.rb-strip'].height <= 65, 'the strip is a 64 px row');
      assert.deepEqual(errors, []);
    } finally {
      await close();
    }
  });
}

test('the column hairlines: none at rest, back under high contrast', { skip: SKIP }, async () => {
  const deck = join(FIXTURES, 'adversarial.pptx');
  for (const theme of ['light', 'dark'] as const) {
    for (const contrast of [false, true]) {
      const { page, close } = await openView({ width: 1440, height: 900, theme, contrast }, deck);
      try {
        const edges = await page.evaluate(() => {
          const width = (sel: string, side: 'Left' | 'Right'): string => getComputedStyle(document.querySelector(sel) as Element)[`border${side}Width`];
          return { queue: width('.rb-queue', 'Right'), decide: width('.rb-decide', 'Left'), narrow: (document.querySelector('.rb') as HTMLElement).dataset.narrow };
        });
        assert.equal(edges.narrow, 'false');
        const want = contrast ? '1px' : '0px';
        assert.deepEqual({ queue: edges.queue, decide: edges.decide }, { queue: want, decide: want }, `${theme}, high contrast ${contrast}`);
      } finally {
        await close();
      }
    }
  }
});
