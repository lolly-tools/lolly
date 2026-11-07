// SPDX-License-Identifier: MPL-2.0
/**
 * The workspace's shelf on a phone (plans/82 M6): the real shelf and company card
 * markup and the real stylesheets, fed fixtures in a static page, at 390 and 360 and
 * at three text sizes. One card per published thing, Use at least 44 px and reachable,
 * the name clamped to two lines, and "Your copy" and "New version" fitting the card.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import test from 'node:test';
import { build } from 'esbuild';
import { chromium } from 'playwright';

test('the shelf fits a phone at 390 and 360 with large text, Use reachable on every card', {
  skip: existsSync(chromium.executablePath()) ? false : 'Install Playwright Chromium.', timeout: 90_000,
}, async t => {
  const bundle = await build({
    stdin: { resolveDir: new URL('..', import.meta.url).pathname, loader: 'ts', contents: `
      import { publishedItems, publishedShelfHtml, markCopies } from './shells/web/src/views/published-shelf.ts';
      import { companyCardHtml } from './shells/web/src/views/company-card.ts';
      const templates = [
        { id: 'inst/price', name: 'Partner price sheet (EMEA) for the whole of the Nordics, the Baltic states and the islands', toolId: 'pricing-table', version: 2, url: '/x.json' },
      ];
      const tools = [
        { id: 'pricing-table', name: 'Pricing', formats: ['png'] },
        { id: 'partner-data-sheet', name: 'Partner data sheet', templateId: 'inst/sheet', version: '1.0.2', formats: ['png'] },
      ];
      const items = publishedItems(templates, tools);
      const company = { company: { id: 'northwind', name: 'Northwind IT' }, revision: 3, profile: {} };
      document.querySelector('#app').innerHTML = '<div class="gallery"><div class="published-mount">' + publishedShelfHtml(items, 'SUSE Content Automation', companyCardHtml(company)) + '</div></div>';
      markCopies(document, new Map([
        ['inst/price', { slot: 's1', toolId: 'pricing-table', updatedAt: '2026-11-03T10:00:00Z', behind: true }],
        ['inst/sheet', { slot: 's2', toolId: 'partner-data-sheet', updatedAt: '2026-11-03T10:00:00Z', behind: false }],
      ]));
    ` }, bundle: true, write: false, platform: 'browser', format: 'iife', loader: { '.css': 'empty' },
    define: { 'import.meta.env': '{}' }, logLevel: 'silent',
  });
  const css = ['styles/tokens.css', 'styles/parts/base.css', 'styles/parts/buttons.css', 'styles/parts/components.css',
    'styles/parts/gallery.css', 'styles/parts/company-card.css', 'styles/parts/a11y.css']
    .map(file => readFileSync(new URL(`../shells/web/src/${file}`, import.meta.url), 'utf8')).join('\n');
  const server = createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(`<!doctype html><html data-theme="light"><style>${css}</style><div id="app"></div></html>`); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const browser = await chromium.launch(); t.after(() => browser.close());
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 780 }]) {
    const context = await browser.newContext({ viewport, hasTouch: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
    for (const scale of [1, 1.5, 2]) {
      await page.evaluate(scale => document.documentElement.style.setProperty('--a11y-fs', String(scale)), scale);
      const where = `${viewport.width}px at ${scale}x`;
      const layout = await page.evaluate(() => {
        const cards = [...document.querySelectorAll<HTMLElement>('.published-card')];
        const hit = (el: Element) => { const r = el.getBoundingClientRect(); const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!at && (el === at || el.contains(at)); };
        return {
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          cards: cards.map(card => {
            card.scrollIntoView({ block: 'center' });
            const box = card.getBoundingClientRect();
            const name = card.querySelector<HTMLElement>('.published-card-name')!;
            const lh = parseFloat(getComputedStyle(name).lineHeight) || parseFloat(getComputedStyle(name).fontSize) * 1.3;
            const use = card.querySelector<HTMLElement>('.published-card-use')!;
            const copy = card.querySelector<HTMLElement>('.published-card-copy');
            const inside = (el: HTMLElement | null) => !el || (() => { const r = el.getBoundingClientRect(); return r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1; })();
            return {
              key: card.dataset.publishedKey ?? 'company', right: box.right, lines: Math.round(name.getBoundingClientRect().height / lh),
              useHeight: use.getBoundingClientRect().height, useReach: card.matches('button') ? hit(card) : hit(use),
              copyReach: copy ? hit(copy) : null, inside: inside(use) && inside(copy) && inside(card.querySelector('.published-card-new')),
            };
          }),
        };
      });
      assert.equal(layout.overflow, false, where);
      assert.equal(layout.cards.length, 3, `${where}: the company card and one card per published thing`);
      for (const card of layout.cards) {
        assert.ok(card.right <= viewport.width + 1, `${where} ${card.key} right ${card.right}`);
        assert.ok(card.lines <= 2, `${where} ${card.key} name lines ${card.lines}`);
        if (card.key !== 'company') assert.ok(card.useHeight >= 44, `${where} ${card.key} Use ${card.useHeight}px`);
        assert.ok(card.useReach, `${where} ${card.key} Use reachable`);
        assert.ok(card.inside, `${where} ${card.key} contents inside the card`);
        if (card.key !== 'company') assert.equal(card.copyReach, true, `${where} ${card.key} Your copy reachable`);
      }
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
});
