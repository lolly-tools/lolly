// SPDX-License-Identifier: MPL-2.0
/**
 * The page walk draws a page's generated content (shells/web/src/capture/
 * page-pseudo.ts): each `::before`/`::after` with string content is stood in for
 * by a real element carrying its computed style, so the walker paints what it
 * could not measure before. The cases are the idioms pages use and the walker
 * dropped: a chevron made of two borders and a rotation, an arrow drawn as text
 * in the line, and a CSS triangle. A stand-in that moves the layout is refused,
 * the page is left as it was, and the page's strict style-src blocks none of the
 * walk's own styling.
 *
 * The same walk draws `mask-image: url(...)`, the way most current sites draw an
 * icon (a coloured box seen through an SVG file), as an SVG `<mask>` rather than
 * a region copied from the screenshot, and keeps a CSS image the page cannot read
 * back (another origin, no CORS header) as its URL for the shell to fill. And it
 * paints a plain inline element's background and borders (`<code>`, `<mark>`) on
 * each line it wraps onto, which the walker skipped for any element without a
 * box of its own. Inside a web component the same holds for its open shadow root,
 * and text slotted into it is drawn where the component shows it: not at all when
 * the component hides it (a screen-reader-only label).
 *
 * Skips, naming the fix, when no headless browser is installed.
 */
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { browserGate } from './helpers/sequence-browser.ts';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { pageWalkScript } from '../packages/node-shell/src/page-walk-bundle.ts';

const gate = browserGate();

const CSS = `
body { margin: 0; font: 16px sans-serif; }
.menu { background: #0000ff; color: #fff; border: 0; padding: 10px; }
.menu span::before { content: ""; display: inline-block; width: 8px; height: 8px; margin-right: 10px;
  border-bottom: 2px solid #ff0000; border-right: 2px solid #ff0000; transform: translateY(-3px) rotate(45deg); }
.next::after { content: "\\2192"; margin-left: 6px; color: #00aa00; }
.tip { position: relative; display: inline-block; margin: 20px; padding: 4px; background: #222; color: #fff; }
.tip::after { content: ""; position: absolute; left: 10px; top: 100%; border: 6px solid transparent; border-top-color: #ff00ff; }
.card { position: relative; margin: 10px; }
.card > p:first-child { margin-top: 0; }
.card::before { content: ""; position: absolute; right: 0; top: 0; width: 10px; height: 10px; background: #00ffff; }
`;
const ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0H10L5 10Z"/></svg>';
const BODY = `<button class="menu"><span>Menu</span></button>
  <a class="next" href="#">Next</a>
  <span class="tip">Tip</span>
  <div class="card"><p>Card text</p></div>`;

interface Walk { svg: string; stats: { standIns: number; standInsRefused: number }; text: { runs: Array<{ text: string }> } }

describe('the page walk draws generated content', { skip: gate ?? false, concurrency: 1 }, () => {
  let site: { server: Server; origin: string };
  let cdn: { server: Server; origin: string };
  const listen = (server: Server): Promise<{ server: Server; origin: string }> =>
    new Promise(ok => server.listen(0, '127.0.0.1', () => ok({ server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}` })));
  before(async () => {
    // Another origin, and no Access-Control-Allow-Origin: the page can show these but not read them.
    cdn = await listen(createServer((_req, res) => { res.writeHead(200, { 'content-type': 'image/svg+xml' }); res.end(ICON); }));
    const server = createServer((req, res) => {
      const path = new URL(req.url ?? '/', 'http://x').pathname;
      if (path === '/icon.svg') { res.writeHead(200, { 'content-type': 'image/svg+xml' }); res.end(ICON); return; }
      if (path === '/s.css') {
        res.writeHead(200, { 'content-type': 'text/css' });
        res.end(CSS + `
.own { display: inline-block; width: 20px; height: 20px; background: #ff8800; mask: url(/icon.svg) no-repeat center / contain; }
.far { display: inline-block; width: 20px; height: 20px; background: #8800ff; mask: url(${cdn.origin}/m.svg) no-repeat center / contain; }
.pic { display: block; width: 40px; height: 40px; background: url(${cdn.origin}/b.svg) no-repeat center / cover; }
.wrap { width: 120px; font: 16px/24px sans-serif; margin: 0; }
.wrap mark { background: #ffcc00; border-left: 3px solid #00ff00; border-right: 3px solid #0000ff; }
.inline { display: inline-block; width: 20px; height: 20px; background: #0088ff; mask: url("data:image/svg+xml;utf8,<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 10 10\\"><path d=\\"M0 0H10V10Z\\"/></svg>") no-repeat center / contain; }`);
        return;
      }
      // A strict policy: no inline style at all, so the walk's own CSS has to arrive through the CSSOM.
      res.writeHead(200, { 'content-type': 'text/html', 'content-security-policy': "default-src 'self'; style-src 'self'" });
      res.end(`<!doctype html><link rel="stylesheet" href="/s.css"><body>${BODY}</body>`);
    });
    site = await listen(server);
  });
  after(async () => { site?.server.close(); cdn?.server.close(); await closeBrowser(); });

  test('borders, a text arrow and a CSS triangle are drawn, and the page is put back', async () => {
    const browser = await getBrowser();
    const ctx = await browser.newContext({ viewport: { width: 400, height: 300 } });
    try {
      const page = await ctx.newPage();
      await page.goto(`${site.origin}/`);
      const before = await page.evaluate(() => ({
        html: document.body.innerHTML,
        sheets: document.adoptedStyleSheets.length,
        p: document.querySelector('.card p')!.getBoundingClientRect().top,
      }));
      await page.evaluate(await pageWalkScript());
      const walk = await page.evaluate(() => (globalThis as unknown as { __lollyPageWalk: (o: unknown) => Promise<Walk> }).__lollyPageWalk({})) as Walk;

      assert.match(walk.svg, /rgb\(255,\s?0,\s?0\)|#ff0000/i, 'the chevron is drawn from its borders');
      assert.ok(walk.text.runs.some(r => r.text.includes('→')), 'the arrow is a text run, outlined later like any other');
      assert.match(walk.svg, /rgb\(255,\s?0,\s?255\)|#ff00ff/i, 'the CSS triangle is drawn');
      assert.match(walk.svg, /rgb\(0,\s?255,\s?255\)|#00ffff/i, 'the refused badge still paints the way it did before');
      assert.equal(walk.stats.standIns, 3);
      assert.equal(walk.stats.standInsRefused, 1, 'a stand-in before the first <p> would have moved it');

      const afterWalk = await page.evaluate(() => ({
        html: document.body.innerHTML,
        sheets: document.adoptedStyleSheets.length,
        p: document.querySelector('.card p')!.getBoundingClientRect().top,
        content: getComputedStyle(document.querySelector('.menu span')!, '::before').content,
      }));
      assert.equal(afterWalk.html, before.html, 'no stand-in or marker is left in the page');
      assert.equal(afterWalk.sheets, before.sheets);
      assert.equal(afterWalk.p, before.p);
      assert.equal(afterWalk.content, '""', 'the pseudo-element is switched back on');
    } finally {
      await ctx.close();
    }
  });

  test('an icon drawn through a mask image is a mask, not a copy of the screen', async () => {
    const browser = await getBrowser();
    const ctx = await browser.newContext({ viewport: { width: 400, height: 300 } });
    try {
      const page = await ctx.newPage();
      await page.goto(`${site.origin}/`);
      await page.evaluate((html) => { document.body.insertAdjacentHTML('beforeend', html); }, '<span class="own"></span><span class="far"></span><span class="pic"></span><span class="inline"></span>');
      await page.evaluate(await pageWalkScript());
      const walk = await page.evaluate(() => (globalThis as unknown as { __lollyPageWalk: (o: unknown) => Promise<Walk & { unresolved: string[]; stats: { regions: number } }> }).__lollyPageWalk({}));
      const masks = walk.svg.match(/<mask\b[^>]*>[\s\S]*?<\/mask>/g) ?? [];
      assert.equal(masks.length, 3, 'one SVG mask per masked icon');
      assert.ok(masks.some(m => /href="data:image\/svg\+xml;base64/.test(m)), 'the same-origin mask image is inlined');
      // Chrome serialises the inline SVG with its quotes escaped (`xmlns=\"...\"`).
      assert.ok(masks.some(m => m.includes('href="data:image/svg+xml;utf8,&lt;svg xmlns=&quot;http://www.w3.org/2000/svg&quot;')), 'an inline SVG mask reads past its escaped quotes');
      assert.ok(masks.some(m => m.includes(`href="${cdn.origin}/m.svg"`)), 'the cross-origin one keeps its URL');
      assert.match(walk.svg, /mask="url\(#fcmask-\d+\)"/);
      assert.equal(walk.stats.regions, 0, 'nothing is copied from the screenshot');
      assert.ok(walk.unresolved.includes(`${cdn.origin}/m.svg`) && walk.unresolved.includes(`${cdn.origin}/b.svg`),
        'the mask image and the background the page cannot read go to the shell to fill');
    } finally {
      await ctx.close();
    }
  });

  test('an inline element keeps its background on every line it wraps onto', async () => {
    const browser = await getBrowser();
    const ctx = await browser.newContext({ viewport: { width: 400, height: 300 } });
    try {
      const page = await ctx.newPage();
      await page.goto(`${site.origin}/`);
      await page.evaluate((html) => { document.body.innerHTML = html; }, '<p class="wrap">Some <mark id="m">highlighted words that wrap</mark> here</p>');
      const lines = await page.evaluate(() => document.getElementById('m')!.getClientRects().length);
      assert.ok(lines >= 2, 'the fixture wraps');
      await page.evaluate(await pageWalkScript());
      const walk = await page.evaluate(() => (globalThis as unknown as { __lollyPageWalk: (o: unknown) => Promise<Walk> }).__lollyPageWalk({}));
      assert.equal((walk.svg.match(/rgb\(255,\s?204,\s?0\)/g) ?? []).length, lines, 'one background per line fragment');
      assert.equal((walk.svg.match(/rgb\(0,\s?255,\s?0\)/g) ?? []).length, 1, 'the starting border on the first fragment only');
      assert.equal((walk.svg.match(/rgb\(0,\s?0,\s?255\)/g) ?? []).length, 1, 'the ending border on the last fragment only');
    } finally {
      await ctx.close();
    }
  });

  test('inside a web component: an icon in its shadow root, slotted text where it is shown', async () => {
    const browser = await getBrowser();
    const ctx = await browser.newContext({ viewport: { width: 400, height: 300 } });
    try {
      const page = await ctx.newPage();
      await page.goto(`${site.origin}/`);
      // The page's CSP refuses inline scripts and <style>; an evaluation and constructed sheets are not refused.
      await page.evaluate(() => {
        const define = (name: string, html: string, css: string): void => {
          customElements.define(name, class extends HTMLElement {
            constructor() {
              super();
              const root = this.attachShadow({ mode: 'open' });
              const sheet = new CSSStyleSheet();
              sheet.replaceSync(css);
              root.adoptedStyleSheets = [sheet];
              root.innerHTML = html;
            }
          });
        };
        define('x-theme', '<button class="b">Theme</button>', '.b::before { content: ""; display: inline-block; width: 10px; height: 10px; background: #ff00aa; }');
        define('x-login', '<span class="i"></span><span class="h"><slot></slot></span>', '.i { display: inline-block; width: 20px; height: 20px; background: #000; } .h { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }');
        define('x-card', '<div class="c"><slot></slot></div>', '.c { padding: 4px; }');
        document.body.innerHTML = '<x-theme></x-theme><x-login>Log in</x-login><x-card>Card text</x-card>';
      });
      const sheetsBefore = await page.evaluate(() => document.querySelector('x-theme')!.shadowRoot!.adoptedStyleSheets.length);
      await page.evaluate(await pageWalkScript());
      const walk = await page.evaluate(() => (globalThis as unknown as { __lollyPageWalk: (o: unknown) => Promise<Walk> }).__lollyPageWalk({}));
      assert.match(walk.svg, /rgb\(255,\s?0,\s?170\)/, 'the icon in the shadow root is drawn');
      const texts = walk.text.runs.map(r => r.text);
      assert.ok(texts.includes('Card text'), 'slotted text the component shows is drawn');
      assert.ok(!texts.some(t => /Log|in/.test(t)), 'slotted text the component hides is not');
      assert.equal(await page.evaluate(() => document.querySelector('x-theme')!.shadowRoot!.adoptedStyleSheets.length), sheetsBefore, 'the shadow root is put back');
    } finally {
      await ctx.close();
    }
  });
});
