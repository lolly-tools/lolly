// SPDX-License-Identifier: MPL-2.0
/** Real, two-origin probes for page drivers and the Sandbox's opaque preview.
 * Installed Playwright Chromium is required. LOLLY_PRESENT_BROWSERS also selects
 * firefox and webkit; WebKit qualification does not imply Safari hardware. */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { chromium, firefox, webkit } from 'playwright';

const names = (process.env.LOLLY_PRESENT_BROWSERS ?? 'chromium').split(',');
const browsers = { chromium, firefox, webkit };
const root = new URL('../', import.meta.url);
const file = (name: string): string => readFileSync(new URL(name, root), 'utf8');
function origin(server: http.Server): string {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No fixture listener');
  return `http://localhost:${address.port}`;
}
async function bundle(path: string, globalName: string): Promise<string> {
  const output = await build({ entryPoints: [new URL(path, root).pathname], bundle: true, write: false, format: 'iife', globalName });
  return output.outputFiles[0]!.text;
}
const close = (server: http.Server): Promise<void> => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
const listen = (server: http.Server): Promise<void> => new Promise(resolve => server.listen(0, 'localhost', resolve));
function previewShim(parentOrigin: string): string {
  const template = file('community/sandbox/template.html');
  const expression = /var SHIM = (\[[\s\S]*?\]\.join\('\\n'\));/.exec(template)?.[1];
  if (!expression) throw new Error('Sandbox shim missing');
  return new Function('location', `return ${expression}`)({ origin: parentOrigin }) as string;
}
function previewRelay(): string {
  const template = file('community/sandbox/template.html');
  return template.slice(template.indexOf('  // The outer deck talks'), template.indexOf('  // Receive console / lifecycle'));
}

test('presentation drivers use real page scrolling, exact-origin receivers and an opaque Sandbox port', { timeout: 120_000 }, async t => {
  const driverScript = await bundle('shells/web/src/lib/web-page-driver.ts', 'Driver');
  const receiverScript = await bundle('packages/core/src/present-receiver.ts', 'Receiver');
  let aOrigin = '', bOrigin = '';
  const basePage = '<!doctype html><style>html{scroll-behavior:smooth}body{margin:0}section{height:700px}#target{background:#3a6}</style><input id="typing"><section>Top</section><section id="target">Target</section><section>End</section><script>window.boot=crypto.randomUUID();window.heard=[];document.addEventListener("keydown",e=>{heard.push(e.key);if(e.key==="ArrowDown")e.preventDefault()});</script>';
  const b = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(basePage + (req.url === '/receiver' ? `<script>${receiverScript}; Receiver.attachPresentReceiver(window,{allowedOrigins:[${JSON.stringify(aOrigin)}]});</script>` : ''));
  });
  const a = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    if (req.url === '/same') { res.end(basePage); return; }
    if (req.url === '/sandbox') {
      const srcdoc = basePage + `<script>${previewShim(aOrigin)}</script>`;
      res.end(`<!doctype html><iframe id="preview" style="width:100%;height:300px" sandbox="allow-scripts allow-modals allow-popups allow-forms allow-pointer-lock allow-downloads allow-presentation"></iframe><script>var frame=document.getElementById('preview'),framed=true,root=document.documentElement;${previewRelay()}frame.srcdoc=${JSON.stringify(srcdoc).replace(/<\//g, '<\\/')}</script>`);
      return;
    }
    res.end(`<!doctype html><button id="deck">Deck</button><div class="marker" id="marker" data-web-view="1200" style="width:600px;height:300px;overflow:hidden"><iframe id="demo" data-web-live title="Demo" src="${bOrigin}/plain" tabindex="-1" style="transform-origin:0 0"></iframe></div><script>${driverScript};window.driver=Driver.createWebPageDriver(document.getElementById('demo'),document.getElementById('marker'));</script>`);
  });
  await listen(a); await listen(b); aOrigin = origin(a); bOrigin = origin(b);
  try {
    for (const name of names) {
      if (!Object.hasOwn(browsers, name)) throw new Error(`Unknown browser ${name}`);
      await t.test(name, async () => {
        const args = name === 'firefox' && process.env.LOLLY_PRESENT_FIREFOX_OVERRIDE ? ['--override', process.env.LOLLY_PRESENT_FIREFOX_OVERRIDE] : [];
        const browser = await browsers[name as keyof typeof browsers].launch({ headless: true, args });
        try {
          const page = await browser.newPage(); await page.goto(aOrigin);
          const frame = page.frames().find(frame => frame.url() === `${bOrigin}/plain`)!;
          await frame.waitForSelector('#target');
          const before = await frame.evaluate(() => ({ boot: (window as unknown as { boot: string }).boot, history: history.length }));
          await page.evaluate(() => {
            const driver = (window as unknown as { driver: import('../shells/web/src/lib/web-page-driver.ts').WebPageDriver }).driver;
            driver.configure({ mode: 'places', pageLength: 0, start: 0 });
            if (!driver.scrollTo('#target')) throw new Error('Fragment navigation refused');
          });
          await frame.waitForFunction(() => location.hash === '#target' && scrollY > 600);
          const after = await frame.evaluate(() => ({ boot: (window as unknown as { boot: string }).boot, history: history.length }));
          assert.deepEqual(after, before, 'fragment change neither reloads nor adds history');
          await frame.locator('#typing').focus();
          assert.equal(await page.evaluate(() => document.activeElement?.id), 'demo');
          await page.locator('#deck').focus(); assert.equal(await page.evaluate(() => document.activeElement?.id), 'deck');
          const pan = await page.evaluate(() => {
            const driver = (window as unknown as { driver: import('../shells/web/src/lib/web-page-driver.ts').WebPageDriver }).driver;
            driver.configure({ mode: 'pan', pageLength: 3200, start: 0 }); driver.scrollTo(800);
            return { depth: driver.depth(), transform: driver.frame.style.transform, height: driver.frame.style.height };
          });
          assert.deepEqual(pan.depth, { y: 800, max: 2600 }); assert.equal(pan.height, '3200px');
          assert.equal(pan.transform, 'scale(0.5) translateY(-800px)');
          const panPercent = await page.evaluate(() => {
            const driver = (window as unknown as { driver: import('../shells/web/src/lib/web-page-driver.ts').WebPageDriver }).driver;
            driver.scrollTo('50%'); return driver.depth()?.y;
          });
          assert.equal(panPercent, 1300);
          assert.equal(await frame.evaluate(() => (window as unknown as { boot: string }).boot), before.boot);
          // Replace the fixture page only between tests, never as an animation method.
          await page.evaluate((src: string) => {
            const w = window as unknown as { driver: import('../shells/web/src/lib/web-page-driver.ts').WebPageDriver; Driver: { createWebPageDriver: typeof import('../shells/web/src/lib/web-page-driver.ts').createWebPageDriver } };
            w.driver.destroy(); const f = document.getElementById('demo') as HTMLIFrameElement; f.src = src;
            w.driver = w.Driver.createWebPageDriver(f, document.getElementById('marker')!);
          }, `${bOrigin}/receiver`);
          await page.waitForFunction(() => (window as unknown as { driver: import('../shells/web/src/lib/web-page-driver.ts').WebPageDriver }).driver.capabilities.backend === 'receiver');
          await page.evaluate(() => (window as unknown as { driver: import('../shells/web/src/lib/web-page-driver.ts').WebPageDriver }).driver.scrollTo(900));
          const receiver = page.frames().find(frame => frame.url() === `${bOrigin}/receiver`)!;
          await receiver.waitForFunction(() => scrollY === 900);
          await page.waitForFunction(() => (window as unknown as { driver: import('../shells/web/src/lib/web-page-driver.ts').WebPageDriver }).driver.depth()?.y === 900);
          await page.evaluate(() => (window as unknown as { driver: import('../shells/web/src/lib/web-page-driver.ts').WebPageDriver }).driver.key('ArrowDown'));
          await receiver.waitForFunction(() => (window as unknown as { heard: string[] }).heard.includes('ArrowDown'));
          assert.equal(await receiver.evaluate(() => scrollY), 900, 'cancelled demo key has no fallback scroll');
          const anchor = await receiver.evaluate(() => document.getElementById('target')!.getBoundingClientRect().top + scrollY);
          await page.evaluate(() => (window as unknown as { driver: import('../shells/web/src/lib/web-page-driver.ts').WebPageDriver }).driver.scrollTo('#target'));
          await receiver.waitForFunction((y: number) => scrollY === y, anchor);
          await page.evaluate((src: string) => {
            const w = window as unknown as { driver: import('../shells/web/src/lib/web-page-driver.ts').WebPageDriver; Driver: { createWebPageDriver: typeof import('../shells/web/src/lib/web-page-driver.ts').createWebPageDriver } };
            w.driver.destroy(); const f = document.getElementById('demo') as HTMLIFrameElement; f.dataset.webProvider = 'sandbox'; f.src = src;
            w.driver = w.Driver.createWebPageDriver(f, document.getElementById('marker')!);
          }, `${aOrigin}/sandbox`);
          await page.waitForFunction(() => (window as unknown as { driver: import('../shells/web/src/lib/web-page-driver.ts').WebPageDriver }).driver.capabilities.backend === 'receiver');
          await page.evaluate(() => (window as unknown as { driver: import('../shells/web/src/lib/web-page-driver.ts').WebPageDriver }).driver.scrollTo(800));
          const opaque = page.frames().find(frame => frame.url() === 'about:srcdoc')!;
          await opaque.waitForFunction(() => scrollY === 800);
          await page.waitForFunction(() => (window as unknown as { driver: import('../shells/web/src/lib/web-page-driver.ts').WebPageDriver }).driver.depth()?.y === 800);
          const opaqueAnchor = await opaque.evaluate(() => document.getElementById('target')!.getBoundingClientRect().top + scrollY);
          await page.evaluate(() => (window as unknown as { driver: import('../shells/web/src/lib/web-page-driver.ts').WebPageDriver }).driver.scrollTo('#target'));
          await opaque.waitForFunction((y: number) => scrollY === y, opaqueAnchor);
          assert.equal(await opaque.evaluate(() => location.origin), 'null', 'preview remains opaque');
          console.log(`Presentation browser probe passed: ${name} ${browser.version()}; Safari hardware not implied.`);
        } finally { await browser.close(); }
      });
    }
  } finally { await close(a); await close(b); }
});
