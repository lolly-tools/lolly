// SPDX-License-Identifier: MPL-2.0
/** Presenter component acceptance with the running shell's actual stylesheets. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { chromium, webkit, firefox, type Page } from 'playwright';
const origin = process.env.LOLLY_PRESENT_INTERACT_URL ?? process.env.LOLLY_PRESENT_TEST_URL ?? process.env.LOLLY_EXPORT_TEST_URL;
const skip = !origin && 'No browser origin; set LOLLY_PRESENT_INTERACT_URL, LOLLY_PRESENT_TEST_URL or LOLLY_EXPORT_TEST_URL.';
const output = process.env.LOLLY_PRESENT_INTERACT_OUTPUT;
const browsers = { chromium, webkit, firefox };
const names = (process.env.LOLLY_PRESENT_INTERACT_BROWSERS ?? 'chromium').split(',');
type ControlWindow = Window & {
  presentation: import('../shells/web/src/views/present-mode.ts').PresentController;
  LollyPresent: typeof import('../shells/web/src/views/present-mode.ts') & Pick<typeof import('../shells/web/src/views/present-web-check.ts'), 'openWebCheck' | 'interactiveCheckRows'>;
};
const fixtureHeaders = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless' };
let presenter: Promise<string> | undefined;
function presenterBundle(): Promise<string> {
  presenter ??= build({ stdin: { resolveDir: new URL('../', import.meta.url).pathname, loader: 'ts',
    contents: `export { openPresentMode } from './shells/web/src/views/present-mode.ts'; export { openWebCheck, interactiveCheckRows } from './shells/web/src/views/present-web-check.ts';` },
    bundle: true, write: false, format: 'iife', globalName: 'LollyPresent', platform: 'browser',
    loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, logLevel: 'silent',
  }).then(result => result.outputFiles[0]!.text);
  return presenter;
}

async function fixture(page: Page, opts: string, extra = ''): Promise<void> {
  // The isolated component bundle has no development-server hot reload connection.
  const shell = await page.request.get(origin!);
  assert.ok(shell.ok(), 'the configured shell responds');
  const shellDoc = new JSDOM(await shell.text(), { url: origin }).window.document;
  const stylesheets = [...shellDoc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map(link => {
    const url = new URL(link.href);
    const href = `${url.pathname}${url.search}${link.href.includes('/src/styles/') ? '?direct' : ''}`;
    return `<link rel="stylesheet" href="${href.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}">`;
  }).join('');
  assert.ok(stylesheets, 'the shell supplies its production or development stylesheet');
  // Real HTTP also verifies popup resources; intercepted blank-popup requests can stall
  // in Chromium's debugger target before Playwright has attached the popup page.
  const server = createServer(async (request, response) => {
    for (const [key, value] of Object.entries(fixtureHeaders)) response.setHeader(key, value);
    if (request.url?.startsWith('/info/present-interact-demo.html')) {
      response.setHeader('Content-Type', 'text/html');
      response.end(`<!doctype html><html><head><style>body{margin:0;font:24px system-ui;background:#0b2922;color:white}section{height:700px;padding:32px;box-sizing:border-box}input{font:inherit}#target{background:#145a48}</style></head><body><section><h1>Live product demo</h1><input id="typing" placeholder="Try a message"><p>This page stays loaded while the slide focuses and zooms.</p></section><section id="target"><h2>Explore the next part</h2></section><section>Last part</section><script>window.boot=crypto.randomUUID();window.heard=[];document.addEventListener('keydown',event=>{heard.push(event.key);if(event.key==='ArrowDown'&&location.search.includes('keys'))event.preventDefault()});</script></body></html>`);
    } else if (request.url === '/present-interact-fixture') {
      response.setHeader('Content-Type', 'text/html');
      response.end(`<!doctype html><html data-theme="dark"><head>${stylesheets}<style>#tool-canvas .lolly-box{position:absolute}#tool-canvas .lolly-box-web{width:100%;height:100%;overflow:hidden;position:relative}#tool-canvas .lolly-box-web iframe{border:0;position:absolute;top:0;left:0;transform-origin:0 0}#tool-canvas .lolly-box-web-card{height:100%;display:grid;place-items:center;background:#123e33;color:#fff}.fixture-source{position:absolute;left:-10000px}</style></head><body><main id="tool-canvas" class="fixture-source"></main></body></html>`);
    } else {
      try {
        const upstream = await fetch(new URL(request.url ?? '/', origin!));
        response.statusCode = upstream.status;
        for (const [key, value] of upstream.headers) if (!['content-length', 'content-encoding', 'transfer-encoding'].includes(key)) response.setHeader(key, value);
        response.end(Buffer.from(await upstream.arrayBuffer()));
      } catch { response.statusCode = 502; response.end('Fixture asset unavailable'); }
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  page.once('close', () => { server.closeAllConnections(); server.close(); });
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  await page.goto(`http://127.0.0.1:${address.port}/present-interact-fixture`);
  await page.addScriptTag({ content: await presenterBundle() });
  await page.evaluate(async ({ opts, extra }) => {
    const source = document.querySelector<HTMLElement>('#tool-canvas')!;
    source.innerHTML = `<div class="lolly-frames"><div class="lolly-frame-page" data-frame-id="a" style="left:0px;top:0px;width:1280px;height:720px;background:#09221c;color:white"><h1 style="margin:48px;font:600 40px system-ui">Explore our live demo</h1><div class="lolly-box" data-box-id="demo" data-build="1" style="left:320px;top:160px;width:640px;height:400px"><div class="lolly-box-web" data-lolly-web="${location.origin}/info/present-interact-demo.html" data-web-load="click" data-web-view="1280" data-web-title="Product demo" data-interact="2"><div class="lolly-box-web-card">Demo poster</div></div></div></div><div class="lolly-frame-page" data-frame-id="b" style="left:1400px;top:0px;width:1280px;height:720px;background:#123e33;color:white"><h1 style="margin:48px;font:600 40px system-ui">The next slide</h1></div>${extra}</div>`;
    source.querySelector<HTMLElement>('.lolly-box-web')!.dataset.interactOpts = opts;
    const { openPresentMode } = (window as unknown as ControlWindow).LollyPresent;
    (window as unknown as ControlWindow).presentation = openPresentMode({ source, initial: 'a.2' })!;
  }, { opts, extra });
  await page.locator('.pr-stage iframe[data-web-live]').waitFor();
  await page.waitForFunction(() => document.activeElement?.classList.contains('pr-stage'));
}

test('the presenter keeps frame identity through Zoom, speaker view, release and stop-walking', { skip, timeout: 120_000 }, async t => {
  if (output) await mkdir(output, { recursive: true });
  for (const name of names) {
    if (!Object.hasOwn(browsers, name)) throw new Error(`Unknown browser ${name}`);
    await t.test(name, async () => {
      const browser = await browsers[name as keyof typeof browsers].launch({ headless: true });
      try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        page.context().on('page', opened => {
          opened.on('requestfailed', request => t.diagnostic(`Popup request failed: ${request.url()} ${request.failure()?.errorText}`));
          opened.on('console', message => { if (message.type() === 'error') t.diagnostic(`Popup console: ${message.text()}`); });
        });
        const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
        await fixture(page, 'hl=zoom;stops=0,400,800;walk=1;ms=0');
        const frame = page.frames().find(frame => frame.url().includes('/info/present-interact-demo.html'))!;
        await frame.waitForSelector('#typing');
        const boot = await frame.evaluate(() => (window as unknown as { boot: string }).boot);
        await page.waitForFunction(() => document.querySelector('.pr-active')?.classList.contains('pr-interact-zoom'));
        await page.keyboard.press('PageDown');
        await frame.waitForFunction(() => scrollY === 400);
        assert.equal(await page.evaluate(() => (window as unknown as ControlWindow).presentation.frameId), 'a');
        assert.equal(await frame.evaluate(() => (window as unknown as { boot: string }).boot), boot);
        const popup = page.waitForEvent('popup'); await page.keyboard.press('s'); const speaker = await popup;
        await speaker.locator('.pr-sp-interact-title').waitFor();
        await speaker.waitForFunction(() => getComputedStyle(document.querySelector('.pr-speaker')!).display === 'grid', undefined, { timeout: 5000 }).catch(async error => {
          t.diagnostic(JSON.stringify(await speaker.evaluate(() => ({ sheets: document.styleSheets.length,
            links: [...document.querySelectorAll<HTMLLinkElement>('link')].map(link => ({ href: link.href, sheet: !!link.sheet })),
            display: getComputedStyle(document.querySelector('.pr-speaker')!).display }))));
          throw error;
        });
        assert.equal(await speaker.locator('.pr-sp-interact-title').textContent(), 'Product demo');
        assert.equal(await speaker.locator('.pr-sp-interact-depth').textContent(), 'Stop 2 of 3');
        assert.equal(await speaker.locator('iframe').count(), 0, 'speaker preview never loads another demo');
        assert.equal(await speaker.locator('.pr-sp-now .pr-interact-focus').count(), 1);
        assert.equal(await speaker.locator('.pr-sp-now .pr-interact-focus').evaluate(element => getComputedStyle(element).outlineWidth), '4px');
        if (output) { await page.screenshot({ path: `${output}/${name}-zoom.png` }); await speaker.screenshot({ path: `${output}/${name}-speaker.png` }); }
        await speaker.getByRole('button', { name: 'Release page', exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('.pr-interact-focus'));
        assert.equal(await speaker.locator('.pr-sp-now .pr-interact-focus').count(), 0);
        assert.equal(await frame.evaluate(() => (window as unknown as { boot: string }).boot), boot);
        await speaker.close(); await page.bringToFront(); await page.locator('.pr-stage').focus();
        await page.keyboard.press('PageUp'); await page.keyboard.press('PageDown');
        await page.waitForFunction(() => !!document.querySelector('.pr-interact-focus'));
        assert.equal(await frame.evaluate(() => (window as unknown as { boot: string }).boot), boot);
        await page.keyboard.press('o'); assert.equal(await page.locator('.pr-interact-focus').count(), 0);
        await page.keyboard.press('o'); await page.locator('.pr-interact-focus').waitFor();
        assert.equal(await frame.evaluate(() => (window as unknown as { boot: string }).boot), boot);
        await page.keyboard.press('F5'); assert.equal(await frame.evaluate(() => (window as unknown as { boot: string }).boot), boot);
        await page.keyboard.press('.'); await page.locator('.pr-blackout').waitFor(); await page.keyboard.press('.');
        await page.keyboard.press('PageDown'); await frame.waitForFunction(() => scrollY === 800);
        await page.keyboard.press('PageDown'); await page.waitForFunction(() => (window as unknown as ControlWindow).presentation.frameId === 'b');
        await page.evaluate(() => (window as unknown as ControlWindow).presentation.close());
        assert.equal(await page.locator('.pr-stage').count(), 0); assert.deepEqual(errors, []);
        t.diagnostic(`${name} ${browser.version()}: synthetic clicker protocol verified; physical clicker and Safari hardware remain separate checks.`);
      } finally { await browser.close(); }
    });
  }
});

test('reduced motion uses Ring, auto scrolling pauses, and an explicit handover comes back to slides', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await fixture(page, 'hl=zoom;auto=focus;from=0;to=800;stops=0,400,800;sec=2;ease=el;hand=1;ms=0');
    const frame = page.frames().find(frame => frame.url().includes('/info/present-interact-demo.html'))!; await frame.waitForSelector('#typing');
    assert.equal(await page.locator('.pr-interact-ring').count(), 1); assert.equal(await page.locator('.pr-interact-zoom').count(), 0);
    await page.keyboard.press('k'); const depth = await frame.evaluate(() => scrollY);
    await page.waitForTimeout(1100); assert.equal(await frame.evaluate(() => scrollY), depth);
    await page.keyboard.press('k'); await frame.waitForFunction(() => scrollY >= 400);
    await page.keyboard.press('ArrowUp'); const manual = await frame.evaluate(() => scrollY);
    await page.waitForTimeout(1100); assert.equal(await frame.evaluate(() => scrollY), manual);
    await page.keyboard.press('Enter'); await page.getByRole('button', { name: 'Back to slides', exact: true }).waitFor({ state: 'visible' });
    await frame.locator('#typing').fill('A typing demo');
    await page.getByRole('button', { name: 'Back to slides', exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.classList.contains('pr-stage'), undefined, { timeout: 3000 });
    await page.keyboard.press('Escape'); assert.equal(await page.locator('.pr-stage').count(), 1); assert.equal(await page.locator('.pr-interact-focus').count(), 0);
    await page.evaluate(() => (window as unknown as ControlWindow).presentation.close());
  } finally { await browser.close(); }
});

test('preflight fits a phone and desktop, and clicker learning requires a deliberate test', { skip, timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1440, 360]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await fixture(page, 'stops=0,400,800');
      await page.evaluate(() => {
        const win = window as unknown as ControlWindow; win.presentation.close();
        const source = document.querySelector<HTMLElement>('#tool-canvas')!;
        void win.LollyPresent.openWebCheck([], win.LollyPresent.interactiveCheckRows(source));
      });
      const modal = page.locator('.pwc-dialog'); await modal.waitFor();
      await modal.locator('summary').click();
      const bounds = await modal.boundingBox(); assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width);
      assert.ok(await modal.evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'dialog has no horizontal overflow');
      await modal.getByRole('button', { name: 'Start test', exact: true }).click();
      await page.keyboard.press('F8'); await modal.locator('[data-clicker-result]').getByText('F8 · No deck action', { exact: true }).waitFor();
      await modal.getByLabel('Remember as').selectOption('next');
      await modal.getByRole('button', { name: 'Remember button', exact: true }).click();
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('lolly-clicker-keys')!).F8), 'next');
      if (output) await page.screenshot({ path: `${output}/chromium-preflight-${width}.png` });
      await modal.getByRole('button', { name: 'Not now', exact: true }).click(); await modal.waitFor({ state: 'detached' });
      await page.close();
    }
  } finally { await browser.close(); }
});
