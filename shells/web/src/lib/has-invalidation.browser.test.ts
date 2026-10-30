// SPDX-License-Identifier: MPL-2.0
/**
 * The shell's stylesheets against Chromium's `:has()` invalidation, in a real Chromium.
 *
 * Chromium keeps one invalidation set for every `:has()` in the page's stylesheets. When
 * a change might flip a `:has()` on an element that carries one in front of a descendant
 * (`html:has(...) .edge-dock`, `.tool-stage:has(...) .fc-overlay`), Chromium restyles
 * the descendants that match the set's features. One rule whose last compound has no
 * class, id, tag or attribute (`.lp-rows > :not(:focus-within)`), or a `:has()` in front
 * of a pseudo-element, makes that set "every descendant", and every chrome change on the
 * canvas (a title added, a readout replaced, a `hidden` flag set) then restyled the whole
 * page. On a 2,000-object Design document that was a 7,000-element recalc twice a frame
 * for the whole of a pan (plans/327).
 *
 * The page here loads every stylesheet under shells/web/src over a stand-in for the
 * editor (html, body, the stage, 3,000 canvas boxes, an inspector panel, a folding
 * section) and reads the elements each style recalc touched from a Chrome trace. Three
 * controls prove the measure: each of the old rules added back must make it fail. The
 * rewritten rules are also checked for what they draw: rows recede when a section has
 * focus, and an open help tip may overflow its section, as before.
 *
 * Self-skips by name where Playwright's Chromium is not installed (`pnpm exec
 * playwright install chromium`); a green run without it means "not exercised".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, BrowserType, Page } from 'playwright';

const SRC = fileURLToPath(new URL('..', import.meta.url));

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

/** Every stylesheet under shells/web/src, in a stable order. */
function allCss(): string {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.css')) files.push(path);
    }
  };
  walk(SRC);
  // @import lines point at files this page loads anyway; inline they would only fail.
  return files.map((f) => readFileSync(f, 'utf8').replace(/^@import[^;]*;/gm, '')).join('\n');
}

const BOXES = 3000;
function editorStandIn(): string {
  const boxes = Array.from({ length: BOXES }, (_, i) =>
    `<div class="lolly-box" data-box-id="b${i}" style="left:${(i % 60) * 30}px;top:${Math.floor(i / 60) * 20}px"><div class="lolly-box-text"><span>w${i}</span></div></div>`).join('');
  const rows = (n: number, sec: number) => Array.from({ length: n }, (_, i) =>
    `<div class="lp-row" id="r${sec}-${i}"><span class="lp-label">Row</span><input id="i${sec}-${i}"></div>`).join('');
  return `<div id="app"><main id="view" class="app-view tool-view"><div id="tool-layout" class="tool-layout is-editor">
    <div id="tool-stage" class="tool-stage">
      <div id="tool-canvas-outer" class="tool-canvas-outer"><div id="tool-canvas" class="tool-canvas"><div class="lolly-frames"><div class="lolly-frame-page" data-pdf-page data-frame-id="a1">${boxes}</div></div></div></div>
      <div class="fc-overlay"><div class="fc-frame-labels"></div><div class="fc-frame-scrim"></div></div>
    </div>
    <div class="lp"><div class="lp-scroll">
      <section class="lp-sec" id="s1"><div class="lp-sec-head">One</div><div class="lp-rows">${rows(3, 1)}</div></section>
      <section class="lp-sec" id="s2"><div class="lp-sec-head">Two</div><div class="lp-rows">${rows(3, 2)}<div class="lp-row" id="sw"><span class="lp-label" id="swl">Fill</span><button type="button" class="color-trigger"></button><div class="color-popover" id="swp" hidden></div></div></div></section>
    </div></div>
    <details class="section-card" id="outer" open><summary class="section-card-summary">Outer</summary><div class="section-card-body">
      <button type="button" class="help-tip-btn">?</button><p class="help-tip-pop" hidden>Tip</p>
      <details class="section-card" id="inner"><summary class="section-card-summary">Inner</summary><div class="section-card-body">x</div></details>
    </div></details>
  </div></main></div>`;
}

async function openEditor(browser: Browser, extraCss = ''): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.setContent(`<!doctype html><html><head><style>${allCss()}\n${extraCss}\n* { transition: none !important; }</style></head><body>${editorStandIn()}</body></html>`);
  await page.evaluate(() => document.body.offsetWidth);
  return page;
}

/** The chrome changes a pan makes, each followed by a forced style recalc. */
async function chromeChanges(page: Page): Promise<void> {
  await page.evaluate(() => {
    const labels = document.querySelector('.fc-frame-labels')!;
    const scrim = document.querySelector<HTMLElement>('.fc-frame-scrim')!;
    for (let i = 0; i < 5; i++) {
      const title = document.createElement('button');
      title.type = 'button'; title.className = 'fc-frame-label'; title.textContent = `Artboard ${i}`;
      labels.appendChild(title); void document.body.offsetWidth;
      scrim.hidden = !scrim.hidden; void document.body.offsetWidth;
      title.remove(); void document.body.offsetWidth;
    }
  });
}

/** The most elements one style recalc touched while `work` ran, from a Chrome trace. */
async function largestRecalc(browser: Browser, page: Page, work: () => Promise<void>): Promise<number> {
  await browser.startTracing(page, { categories: ['devtools.timeline'] });
  await work();
  const trace = JSON.parse((await browser.stopTracing()).toString('utf8')) as { traceEvents: Array<{ name: string; args?: { elementCount?: number } }> };
  const counts = trace.traceEvents.filter((e) => e.name === 'UpdateLayoutTree').map((e) => e.args?.elementCount ?? 0);
  assert.ok(counts.length > 0, 'the trace recorded style recalcs');
  return Math.max(...counts);
}

test('a chrome change on the stage restyles the change, not the page', {
  skip: typeof browserOrReason === 'string' ? browserOrReason : false,
}, async (t) => {
  if (typeof browserOrReason === 'string') return;
  const browser = await browserOrReason.chromium.launch();
  try {
    const page = await openEditor(browser);
    const nodes = await page.evaluate(() => document.querySelectorAll('*').length);
    assert.ok(nodes > BOXES * 3, `the stand-in is large (${nodes} elements)`);
    const worst = await largestRecalc(browser, page, () => chromeChanges(page));
    t.diagnostic(`largest recalc ${worst} of ${nodes} elements`);
    // A title, the scrim and the few elements the shared :has() set matches. Thousands
    // means a rule has made that set "every descendant" again.
    assert.ok(worst < 400, `the largest recalc touched ${worst} of ${nodes} elements`);
    await page.close();

    // Controls: each old rule, added back alone, makes the same changes restyle the page.
    for (const old of [
      ':where(.lp-scroll:has(.lp-sec:focus-within)) .lp-rows > :not(:focus-within) { opacity: 0.7; }',
      ':is(.input-section, details.section-card)[open]:has(.help-tip-btn:hover, .help-tip-pop:not([hidden]))::details-content { overflow: visible; }',
      '.lp-scroll:has(.lp-sec:focus-within) .lp-rows > :not(:focus-within):has(.color-trigger) > span:first-child { opacity: 0.7; }',
    ]) {
      const poisoned = await openEditor(browser, old);
      const all = await largestRecalc(browser, poisoned, () => chromeChanges(poisoned));
      t.diagnostic(`control: largest recalc ${all} elements`);
      assert.ok(all > BOXES, `the control "${old.slice(0, 48)}..." restyles the page (${all} elements)`);
      await poisoned.close();
    }
  } finally { await browser.close(); }
});

test('the rewritten rules draw what the old ones drew', {
  skip: typeof browserOrReason === 'string' ? browserOrReason : false,
}, async () => {
  if (typeof browserOrReason === 'string') return;
  const browser = await browserOrReason.chromium.launch();
  try {
    const page = await openEditor(browser);
    const opacity = (id: string) => page.evaluate((id) => getComputedStyle(document.getElementById(id)!).opacity, id);
    assert.equal(await opacity('r2-1'), '1', 'nothing recedes while nothing has focus');
    await page.focus('#i1-0');
    assert.equal(await opacity('r1-0'), '1', 'the focused row stays');
    assert.equal(await opacity('r1-1'), '0.7', 'a row beside it recedes');
    assert.equal(await opacity('r2-1'), '0.7', 'a row in another section recedes');
    assert.equal(await opacity('sw'), '1', 'a row with a swatch keeps its colour');
    assert.equal(await opacity('swl'), '0.7', 'and its label recedes');
    await page.evaluate(() => { document.getElementById('swp')!.hidden = false; });
    assert.equal(await opacity('swl'), '1', 'an open picker keeps its label solid');
    await page.evaluate(() => { document.getElementById('swp')!.hidden = true; });
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    assert.equal(await opacity('r1-1'), '1', 'the rows return when focus leaves');
    assert.equal(await opacity('swl'), '1', 'and so does a swatch label');

    const overflow = (id: string) => page.evaluate((id) => getComputedStyle(document.getElementById(id)!, '::details-content').overflow, id);
    const supported = await page.evaluate(() => CSS.supports('selector(::details-content)') && CSS.supports('interpolate-size: allow-keywords'));
    if (supported) {
      assert.equal(await overflow('outer'), 'clip', 'an open section clips its content');
      await page.evaluate(() => { document.querySelector<HTMLElement>('#outer .help-tip-pop')!.hidden = false; });
      assert.equal(await overflow('outer'), 'visible', 'an open help tip may hang outside its section');
      assert.equal(await overflow('inner'), 'clip', 'a closed section inside it still clips');
    }
  } finally { await browser.close(); }
});
