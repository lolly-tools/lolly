// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const embedded = `<!doctype html><style>h1{color:rgb(0,0,0)}body{overflow:hidden}.onetrust-pc-dark-filter{position:fixed;inset:0;background:#888}#onetrust-banner-sdk{position:fixed;bottom:0;background:#fff}</style>
<h1>Page</h1><div class="onetrust-pc-dark-filter"></div><div id="onetrust-banner-sdk"><button id="accept" onclick="window.accepted=true">Accept</button><button id="reject" onclick="document.querySelector('#onetrust-banner-sdk').remove();document.querySelector('.onetrust-pc-dark-filter').remove();window.rejected=true">Reject</button></div>`;

test('page appearance stays inside its object; external banners can be rejected manually', {
  skip: existsSync(chromium.executablePath()) ? false : 'Install Playwright Chromium.', timeout: 60_000,
}, async t => {
  const bundle = await build({
    stdin: { resolveDir: new URL('..', import.meta.url).pathname, loader: 'ts', contents: `
      import { mountWebFrames, enterWebBox, consentToLink, unmountWebFrames, parkWebFrames, restoreWebFrames } from './shells/web/src/lib/design-web-mount.ts';
      import { editWebCss } from './shells/web/src/lib/design-web-css-dialog.ts';
      window.webTest = { mountWebFrames, enterWebBox, consentToLink, unmountWebFrames, parkWebFrames, restoreWebFrames, editWebCss };
    ` }, bundle: true, write: false, platform: 'browser', format: 'iife', loader: { '.css': 'empty' }, logLevel: 'silent',
  });
  const frameCss = await readFile(new URL('../shells/web/src/styles/parts/design-web.css', import.meta.url), 'utf8');
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(req.url === '/harness' ? `<!doctype html><style>${frameCss}.lolly-box-web{position:relative;overflow:hidden}</style><body><div id="onetrust-banner-sdk">Parent banner</div><main></main>` : embedded);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.route('https://player.vimeo.com/**', route => route.fulfill({ contentType: 'text/html', body: embedded }));
  await page.goto(`${origin}/harness`);
  await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
  await page.evaluate(origin => {
    const root = document.querySelector('main')!;
    for (const id of ['a', 'b']) {
      const box = document.createElement('div');
      box.dataset.boxId = id;
      box.innerHTML = '<div class="lolly-box-web" style="width:400px;height:240px"></div>';
      const marker = box.firstElementChild as HTMLElement;
      marker.dataset.lollyWeb = `${origin}/#/tool/chart`;
      if (id === 'a') { marker.dataset.webCss = 'h1 { color: rgb(0, 0, 255); }'; marker.dataset.webHideCookies = '1'; }
      root.appendChild(box);
    }
    (window as any).webTest.mountWebFrames(root, { mode: 'editor' });
  }, origin);
  const a = page.frameLocator('[data-box-id="a"] iframe');
  const b = page.frameLocator('[data-box-id="b"] iframe');
  await a.locator('h1').waitFor();
  await page.waitForFunction(() => {
    const doc = document.querySelector<HTMLIFrameElement>('[data-box-id="a"] iframe')?.contentDocument;
    return doc?.querySelector('style[data-lolly-page-appearance]');
  });
  assert.equal(await a.locator('h1').evaluate(el => getComputedStyle(el).color), 'rgb(0, 0, 255)');
  assert.equal(await a.locator('#onetrust-banner-sdk').isVisible(), false);
  assert.equal(await a.locator('.onetrust-pc-dark-filter').isVisible(), false);
  assert.equal(await a.locator('body').evaluate(el => getComputedStyle(el).overflow), 'auto');
  assert.equal(await a.locator('body').evaluate(() => (window as any).accepted), undefined);
  assert.equal(await b.locator('#onetrust-banner-sdk').isVisible(), true);
  assert.equal(await page.locator('body > #onetrust-banner-sdk').isVisible(), true);
  assert.equal(await page.evaluate(() => {
    const marker = document.querySelector<HTMLElement>('[data-box-id="a"] .lolly-box-web')!;
    const frame = marker.querySelector('iframe');
    marker.dataset.webCss = 'h1 { color: red; }';
    (window as any).webTest.mountWebFrames(document.querySelector('main'), { mode: 'editor' });
    return frame === marker.querySelector('iframe');
  }), true, 'appearance edits preserve the running frame');
  assert.equal(await a.locator('h1').evaluate(el => getComputedStyle(el).color), 'rgb(255, 0, 0)');
  await a.locator('body').evaluate(() => { (window as any).pageState = 'kept'; });
  assert.equal(await page.evaluate(() => {
    const root = document.querySelector('main')!;
    const frame = root.querySelector('[data-box-id="a"] iframe');
    const parked = (window as any).webTest.parkWebFrames(root);
    if (!parked) return false;
    const markup = root.innerHTML;
    root.innerHTML = markup;
    root.querySelector<HTMLElement>('[data-box-id="a"] .lolly-box-web')!.dataset.webCss = 'h1 { color: green; }';
    (window as any).webTest.restoreWebFrames(root, parked);
    (window as any).webTest.mountWebFrames(root, { mode: 'editor' });
    return frame === root.querySelector('[data-box-id="a"] iframe');
  }), true, 'canvas repaint restores the original frame');
  assert.equal(await a.locator('body').evaluate(() => (window as any).pageState), 'kept');
  assert.equal(await a.locator('h1').evaluate(el => getComputedStyle(el).color), 'rgb(0, 128, 0)');
  assert.equal(await a.locator('style[data-lolly-page-appearance]').count(), 1);
  await page.evaluate(() => {
    const marker = document.querySelector<HTMLElement>('[data-box-id="a"] .lolly-box-web')!;
    delete marker.dataset.webCss; delete marker.dataset.webHideCookies;
    (window as any).webTest.mountWebFrames(document.querySelector('main'), { mode: 'editor' });
  });
  assert.equal(await a.locator('#onetrust-banner-sdk').isVisible(), true);
  assert.equal(await a.locator('h1').evaluate(el => getComputedStyle(el).color), 'rgb(0, 0, 0)');

  // Applying and cancelling are separate edits; invalid CSS remains in the editor.
  await page.evaluate(() => { (window as any).cssResult = undefined; void (window as any).webTest.editWebCss('h1 { color: red; }').then((v: string | null) => (window as any).cssResult = v); });
  await page.locator('dialog textarea').fill('body { background: url(https://x.test/track); }');
  await page.locator('[data-web-css-apply]').click();
  assert.match(await page.locator('.web-css-error').innerText(), /without imports/);
  await page.locator('[data-web-css-cancel]').click();
  assert.equal(await page.evaluate(() => (window as any).cssResult), null);
  await page.evaluate(() => { void (window as any).webTest.editWebCss('').then((v: string | null) => (window as any).cssResult = v); });
  await page.locator('dialog textarea').fill('h1 { color: green; }');
  await page.locator('[data-web-css-apply]').click();
  assert.equal(await page.evaluate(() => (window as any).cssResult), 'h1 { color: green; }');

  await page.evaluate(() => {
    const root = document.querySelector('main')!;
    const box = document.createElement('div'); box.dataset.boxId = 'external';
    box.innerHTML = '<div class="lolly-box-web" data-lolly-web="https://vimeo.com/76979871" data-web-css="h1{color:red}" data-web-hide-cookies="1" style="width:400px;height:240px"></div>';
    root.appendChild(box);
    (window as any).webTest.consentToLink('https://vimeo.com/76979871');
    (window as any).webTest.mountWebFrames(root, { mode: 'editor' });
  });
  // Reveal the lazy external frame before waiting for its document.
  await page.locator('[data-box-id="external"]').scrollIntoViewIfNeeded();
  const external = page.frameLocator('[data-box-id="external"] iframe');
  await external.locator('h1').waitFor();
  assert.equal(await external.locator('h1').evaluate(el => getComputedStyle(el).color), 'rgb(0, 0, 0)');
  assert.equal(await external.locator('#onetrust-banner-sdk').isVisible(), true);
  assert.equal(await page.evaluate(() => (window as any).webTest.enterWebBox(document.querySelector('main'), 'external', () => {})), true);
  await external.locator('#reject').click();
  assert.equal(await external.locator('body').evaluate(() => (window as any).rejected), true);
  assert.equal(await external.locator('body').evaluate(() => (window as any).accepted), undefined);
  await page.locator('.lolly-box-web-done').click();
  assert.equal(await page.locator('[data-box-id="external"] .lolly-box-web').getAttribute('data-web-inert'), '');
});
