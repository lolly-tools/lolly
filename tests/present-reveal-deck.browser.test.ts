// SPDX-License-Identifier: MPL-2.0
/** Real, three-origin probe for the reveal.js deck driver. The deck here is a small
 * stand-in that follows reveal.js's documented message API: JSON text naming a method,
 * and JSON reports to the parent only when `postMessageEvents` is in its link.
 * Installed Playwright Chromium is required. LOLLY_PRESENT_BROWSERS also selects
 * firefox and webkit. */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { build } from 'esbuild';
import { chromium, firefox, webkit, type Frame } from 'playwright';
import type { WebPageDriver, createWebPageDriver } from '../shells/web/src/lib/web-page-driver.ts';

type DeckWindow = Window & { driver: WebPageDriver; Driver: { createWebPageDriver: typeof createWebPageDriver } };
const names = (process.env.LOLLY_PRESENT_BROWSERS ?? 'chromium').split(',');
const browsers = { chromium, firefox, webkit };
const root = new URL('../', import.meta.url);
const close = (server: http.Server): Promise<void> => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
const listen = (server: http.Server): Promise<void> => new Promise(resolve => server.listen(0, 'localhost', resolve));
function origin(server: http.Server): string {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No fixture listener');
  return `http://localhost:${address.port}`;
}

/** Three horizontal slides; the middle one holds a vertical stack of three. */
const DECK = `<!doctype html><body><script>
var events = /[?&]postMessageEvents=(true|1)(&|$)/.test(location.search), stacks = [1, 3, 1], h = 0, v = 0;
window.heard = [];
function state() { return { indexh: h, indexv: v, paused: false, overview: false }; }
function post(type, extra) {
  if (events && window.parent !== window.self) window.parent.postMessage(JSON.stringify(Object.assign({ namespace: 'reveal', eventName: type, state: state() }, extra || {})), '*');
}
var api = {
  next: function () { if (v < stacks[h] - 1) v++; else if (h < stacks.length - 1) { h++; v = 0; } post('slidechanged'); },
  prev: function () { if (v > 0) v--; else if (h > 0) { h--; v = 0; } post('slidechanged'); },
  down: function () { if (v < stacks[h] - 1) { v++; post('slidechanged'); } },
  up: function () { if (v > 0) { v--; post('slidechanged'); } },
  getState: state,
};
window.addEventListener('message', function (event) {
  var data = event.data;
  if (typeof data !== 'string') return;
  heard.push(data);
  if (data.charAt(0) === '{' && data.charAt(data.length - 1) === '}') {
    data = JSON.parse(data);
    if (data.method && typeof api[data.method] === 'function') post('callback', { method: data.method, result: api[data.method].apply(null, data.args) });
  }
});
post('ready');
</script>`;
/** Another frame that claims to be the deck. */
const FORGER = `<!doctype html><script>window.forge = function () { parent.postMessage(JSON.stringify({ namespace: 'reveal', eventName: 'slidechanged', state: { indexh: 7, indexv: 0 } }), '*'); }; forge();</script>`;

test('reveal.js decks are driven by their own message API within the exact frame and origin checks', { timeout: 120_000 }, async t => {
  const output = await build({ entryPoints: [new URL('shells/web/src/lib/web-page-driver.ts', root).pathname], bundle: true, write: false, format: 'iife', globalName: 'Driver' });
  const driverScript = output.outputFiles[0]!.text;
  let bOrigin = '', cOrigin = '';
  const deckServer = (req: http.IncomingMessage, res: http.ServerResponse): void => {
    res.setHeader('Content-Type', 'text/html'); res.end(req.url?.startsWith('/forger') ? FORGER : DECK);
  };
  const b = http.createServer(deckServer), c = http.createServer(deckServer);
  const a = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><div id="marker" style="width:600px;height:300px;overflow:hidden"><iframe id="deck" data-web-live title="Deck" src="${bOrigin}/deck?postMessageEvents=true" tabindex="-1"></iframe></div>`
      + `<iframe id="same-origin-forger" src="${bOrigin}/forger"></iframe><iframe id="other-origin-forger" src="${cOrigin}/forger"></iframe>`
      + `<script>${driverScript};window.driver=Driver.createWebPageDriver(document.getElementById('deck'),document.getElementById('marker'));</script>`);
  });
  await listen(a); await listen(b); await listen(c); bOrigin = origin(b); cOrigin = origin(c);
  const aOrigin = origin(a);
  try {
    for (const name of names) {
      if (!Object.hasOwn(browsers, name)) throw new Error(`Unknown browser ${name}`);
      await t.test(name, async () => {
        const browser = await browsers[name as keyof typeof browsers].launch({ headless: true });
        try {
          const page = await browser.newPage(); await page.goto(aOrigin);
          const position = () => page.evaluate(() => (window as unknown as DeckWindow).driver.deck?.() ?? null);
          const frameAt = async (matches: (url: string) => boolean): Promise<Frame> => {
            for (let tries = 0; tries < 50; tries++) {
              const frame = page.frames().find(f => matches(f.url()));
              if (frame) { await frame.waitForFunction(() => document.readyState === 'complete'); return frame; }
              await page.waitForTimeout(100);
            }
            throw new Error('frame did not load');
          };
          await page.waitForFunction(() => (window as unknown as DeckWindow).driver.capabilities.backend === 'reveal');
          assert.deepEqual(await position(), { h: 0, v: 0, f: null });

          for (const url of [`${bOrigin}/forger`, `${cOrigin}/forger`]) {
            await page.frames().find(frame => frame.url() === url)!.evaluate(() => (window as unknown as { forge(): void }).forge());
          }
          await page.waitForTimeout(300);
          assert.deepEqual(await position(), { h: 0, v: 0, f: null }, 'a report from another frame is ignored, even from the deck origin');

          const step = async (call: string, expected: { h: number; v: number }): Promise<void> => {
            await page.evaluate((how: string) => {
              const driver = (window as unknown as DeckWindow).driver;
              if (!(how === 'next' ? driver.step!(1) : how === 'prev' ? driver.step!(-1) : driver.key(how === 'down' ? 'ArrowDown' : 'ArrowUp'))) throw new Error(`${how} refused`);
            }, call);
            await page.waitForFunction((want: { h: number; v: number }) => {
              const at = (window as unknown as DeckWindow).driver.deck?.();
              return at?.h === want.h && at.v === want.v;
            }, expected);
          };
          await step('next', { h: 1, v: 0 });
          await step('down', { h: 1, v: 1 });
          await step('next', { h: 1, v: 2 });
          await step('prev', { h: 1, v: 1 });
          await step('up', { h: 1, v: 0 });
          const deck = await frameAt(url => url.startsWith(`${bOrigin}/deck`));
          const commands = await deck.evaluate(() => (window as unknown as { heard: string[] }).heard.map(text => JSON.parse(text).method));
          assert.ok(commands.every((method: string) => ['getState', 'next', 'prev', 'up', 'down'].includes(method)), commands.join());

          // The frame moves to a deck on another origin: commands stay addressed to the first.
          await page.evaluate((src: string) => { (document.getElementById('deck') as HTMLIFrameElement).src = src; }, `${cOrigin}/deck?postMessageEvents=true`);
          const moved = await frameAt(url => url.startsWith(`${cOrigin}/deck`));
          await page.waitForTimeout(1500);
          assert.deepEqual(await moved.evaluate(() => (window as unknown as { heard: string[] }).heard), [], 'nothing reaches a deck on another origin');
          assert.notEqual(await page.evaluate(() => (window as unknown as DeckWindow).driver.capabilities.backend), 'reveal', 'its reports are refused');
          assert.equal(await position(), null);

          // A link that did not ask for reports is never sent reveal.js commands.
          await page.evaluate((src: string) => {
            const w = window as unknown as DeckWindow;
            w.driver.destroy(); const frame = document.getElementById('deck') as HTMLIFrameElement; frame.src = src;
            w.driver = w.Driver.createWebPageDriver(frame, document.getElementById('marker')!);
          }, `${bOrigin}/deck`);
          const quiet = await frameAt(url => url === `${bOrigin}/deck`);
          await page.waitForTimeout(1500);
          assert.deepEqual(await quiet.evaluate(() => (window as unknown as { heard: string[] }).heard), []);
          assert.notEqual(await page.evaluate(() => (window as unknown as DeckWindow).driver.capabilities.backend), 'reveal');
          console.log(`reveal.js deck browser probe passed: ${name} ${browser.version()}.`);
        } finally { await browser.close(); }
      });
    }
  } finally { await close(a); await close(b); await close(c); }
});
