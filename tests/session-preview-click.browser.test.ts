// SPDX-License-Identifier: MPL-2.0
/** Real Chrome pointer race, using the maintained preview body; no network. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import { chromium } from 'playwright';

interface ClickFixture {
  source: object; thumbnail: Promise<string>; releaseThumb(): void; stopPreview?: () => void;
  events: Array<{ name: string; tag: string; cover: boolean }>;
  opens: number; replacementObserved: boolean; contextMenus: number; menuClicks: number; selectClicks: number;
}
declare global { interface Window { sessionPreviewFixture: ClickFixture } }

const raw = await readFile(new URL('../shells/web/src/org/team-previews.ts', import.meta.url));
const css = await readFile(new URL('../shells/web/src/styles/parts/folders.css', import.meta.url), 'utf8');
const stub = `const getSessionSource=()=>window.sessionPreviewFixture.source,orgSession=()=>undefined,
sharedSessionThumb=()=>window.sessionPreviewFixture.thumbnail,readSourceSessions=async()=>({ok:false}),icon=()=>'',tRaw=x=>x;\n`;
const code = ts.transpileModule(stub + raw.toString().replace(/^import .*;\n/gm, ''), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;

test('shared-session preview hydration preserves primary/title/keyboard and sibling control targets', async () => {
  const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'darwin' ? { channel: 'chrome' } : {}) });
  try {
    for (const mode of ['replacement-on-mousedown', 'css-while-replacement-on-mousedown', 'title-while-replacement-on-mousedown']) {
      const context = await browser.newContext(), page = await context.newPage();
      await context.route('**/*', route => route.abort());
      try {
        // The negative control disables just the new scoped rule. Fixed dimensions
        // prevent layout shift, isolating removal of the actual pressed cover.
        const override = mode.startsWith('css-') ? '' : 'a.tile-primary[data-open-team-session]>.tile-cover{pointer-events:auto}';
        await page.setContent(`<style>${css}${override}.tile-primary{display:block;width:300px;height:180px}.tile-cover{display:block;width:300px;height:140px}.tile-meta{display:block;height:40px}</style>
<div class="folder-grid"><div class="folder-tile" data-ref="ses_local">
<a class="tile-primary" data-open-team-session="ses_local" href="#/team/ses_local" aria-label="Open shared session Local fixture"><span class="tile-cover tile-cover--empty"></span><span class="tile-meta"><span class="tile-title">Local fixture</span></span></a>
<button class="local-menu">Menu</button><button class="local-select">Select</button></div></div>`);
        await page.evaluate(async ({ moduleUrl }) => {
          const state: ClickFixture = { source: {}, events: [], opens: 0, replacementObserved: false,
            contextMenus: 0, menuClicks: 0, selectClicks: 0, thumbnail: Promise.resolve(''), releaseThumb() {} };
          window.sessionPreviewFixture = state;
          document.querySelector('.local-menu')!.addEventListener('click', e => { e.stopPropagation(); state.menuClicks++; });
          document.querySelector('.local-select')!.addEventListener('click', e => { e.stopPropagation(); state.selectClicks++; });
          state.thumbnail = new Promise(resolve => { state.releaseThumb = () => resolve('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='); });
          const grid = document.querySelector<HTMLElement>('.folder-grid')!;
          grid.addEventListener('contextmenu', event => { event.preventDefault(); state.contextMenus++; });
          // Exact maintained delegated primary-session click behavior.
          grid.addEventListener('click', event => {
            const link = (event.target as Element).closest('[data-open-team-session]');
            if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
            event.preventDefault(); event.stopPropagation(); state.opens++;
          });
          for (const name of ['mousedown', 'mouseup', 'click']) document.addEventListener(name, event => {
            const target = event.target as Element;
            state.events.push({ name, tag: target.tagName, cover: target.classList.contains('tile-cover') });
            if (name === 'mousedown') state.releaseThumb();
          }, true);
          new MutationObserver(() => { state.replacementObserved = !!document.querySelector('img.tile-cover'); }).observe(grid, { childList: true, subtree: true });
          const { hydrateSharedPreviews } = await import(moduleUrl);
          state.stopPreview = hydrateSharedPreviews(grid, state.source, {}, () => true);
        }, { moduleUrl, mode });
        await page.waitForTimeout(30);
        const anchor = page.locator('[data-open-team-session="ses_local"]');
        if (mode.startsWith('title-')) await anchor.locator('.tile-title').click(); else await anchor.click();
        await page.waitForTimeout(30);
        const state = await page.evaluate(() => ({ opens: window.sessionPreviewFixture.opens,
          replaced: window.sessionPreviewFixture.replacementObserved, events: window.sessionPreviewFixture.events }));
        assert.equal(state.replaced, true);
        assert.equal(state.opens, mode === 'replacement-on-mousedown' ? 0 : 1);
        assert.deepEqual(state.events.map(e => e.name), mode === 'replacement-on-mousedown' ? ['mousedown', 'mouseup'] : ['mousedown', 'mouseup', 'click']);
        if (mode.startsWith('css-')) {
          assert.ok(state.events.every(e => e.tag === 'A'), 'both placeholder and hydrated image hit the same anchor');
          assert.equal(await page.getByRole('link', { name: 'Open shared session Local fixture', exact: true }).count(), 1);
          await anchor.focus(); await page.keyboard.press('Enter');
          assert.equal(await page.evaluate(() => window.sessionPreviewFixture.opens), 2);
          await anchor.click({ button: 'right' });
          assert.equal(await page.evaluate(() => window.sessionPreviewFixture.contextMenus), 1);
          await page.locator('.local-menu').click(); await page.locator('.local-select').click();
          assert.deepEqual(await page.evaluate(() => ({ opens: window.sessionPreviewFixture.opens,
            menu: window.sessionPreviewFixture.menuClicks, select: window.sessionPreviewFixture.selectClicks })), { opens: 2, menu: 1, select: 1 });
        }
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});
