// SPDX-License-Identifier: MPL-2.0
/** Presenter component acceptance with the running shell's actual stylesheets. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { chromium, webkit, firefox, type Page, type Locator, type Frame } from 'playwright';
const origin = process.env.LOLLY_PRESENT_INTERACT_URL ?? process.env.LOLLY_PRESENT_TEST_URL ?? process.env.LOLLY_EXPORT_TEST_URL;
const skip = !origin && 'No browser origin; set LOLLY_PRESENT_INTERACT_URL, LOLLY_PRESENT_TEST_URL or LOLLY_EXPORT_TEST_URL.';
const output = process.env.LOLLY_PRESENT_INTERACT_OUTPUT;
const browsers = { chromium, webkit, firefox };
const names = (process.env.LOLLY_PRESENT_INTERACT_BROWSERS ?? 'chromium').split(',');
for (const name of names) if (!Object.hasOwn(browsers, name)) throw new Error(`Unknown browser ${name}`);
const primaryEngine = names[0] as keyof typeof browsers;
function launchBrowser(name: keyof typeof browsers = primaryEngine) {
  const override = process.env.LOLLY_PRESENT_INTERACT_FIREFOX_OVERRIDE;
  return browsers[name].launch({ headless: true, ...(name === 'firefox' && override ? { args: ['--override', override] } : {}) });
}
type ControlWindow = Window & {
  presentation: import('../shells/web/src/views/present-mode.ts').PresentController;
  LollyPresent: typeof import('../shells/web/src/views/present-mode.ts') & Pick<typeof import('../shells/web/src/views/present-web-check.ts'), 'openWebCheck' | 'interactiveCheckRows'>
    & Pick<typeof import('../shells/web/src/views/design-web-interact.ts'), 'webInteractRows' | 'wireWebInteract'>;
};
const fixtureHeaders = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless' };
let presenter: Promise<string> | undefined;
function presenterBundle(): Promise<string> {
  presenter ??= build({ stdin: { resolveDir: new URL('../', import.meta.url).pathname, loader: 'ts',
    contents: `export { openPresentMode } from './shells/web/src/views/present-mode.ts'; export { openWebCheck, interactiveCheckRows } from './shells/web/src/views/present-web-check.ts'; export { webInteractRows, wireWebInteract } from './shells/web/src/views/design-web-interact.ts';` },
    bundle: true, write: false, format: 'iife', globalName: 'LollyPresent', platform: 'browser',
    loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, logLevel: 'silent',
  }).then(result => result.outputFiles[0]!.text);
  return presenter;
}

async function fixture(page: Page, opts: string, extra = '', denyFullscreen = false): Promise<void> {
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
  await page.evaluate(async ({ opts, extra, denyFullscreen }) => {
    const source = document.querySelector<HTMLElement>('#tool-canvas')!;
    source.innerHTML = `<div class="lolly-frames"><div class="lolly-frame-page" data-frame-id="a" style="left:0px;top:0px;width:1280px;height:720px;background:#09221c;color:white"><h1 style="margin:48px;font:600 40px system-ui">Explore our live demo</h1><div class="lolly-box" data-box-id="demo" data-build="1" style="left:320px;top:160px;width:640px;height:400px"><div class="lolly-box-web" data-lolly-web="${location.origin}/info/present-interact-demo.html" data-web-load="click" data-web-view="1280" data-web-title="Product demo" data-interact="2"><div class="lolly-box-web-card">Demo poster</div></div></div></div><div class="lolly-frame-page" data-frame-id="b" style="left:1400px;top:0px;width:1280px;height:720px;background:#123e33;color:white"><h1 style="margin:48px;font:600 40px system-ui">The next slide</h1></div>${extra}</div>`;
    source.querySelector<HTMLElement>('.lolly-box-web')!.dataset.interactOpts = opts;
    if (denyFullscreen) {
      Element.prototype.requestFullscreen = () => Promise.reject(new DOMException('Fixture denies fullscreen', 'NotAllowedError'));
      const opener = document.createElement('button'); opener.id = 'fixture-opener'; opener.textContent = 'Open presentation';
      const background = document.createElement('input'); background.id = 'fixture-background';
      const prior = document.createElement('div'); prior.id = 'fixture-prior-inert'; prior.inert = true;
      document.body.prepend(opener, background, prior); opener.focus();
    }
    const { openPresentMode } = (window as unknown as ControlWindow).LollyPresent;
    (window as unknown as ControlWindow).presentation = openPresentMode({ source, initial: 'a.2' })!;
  }, { opts, extra, denyFullscreen });
  await page.locator('.pr-stage iframe[data-web-live]').waitFor();
  await page.waitForFunction(() => document.activeElement?.classList.contains('pr-stage'));
}

async function tabTo(page: Page, target: Locator, key = 'Tab'): Promise<void> {
  const visited: string[] = [];
  for (let attempt = 0; attempt < 24; attempt++) {
    await page.keyboard.press(key);
    if (await target.evaluate(element => element.ownerDocument.activeElement === element)) return;
    visited.push(await page.evaluate(() => `${document.activeElement?.tagName}:${document.activeElement?.getAttribute('aria-label') ?? ''}:${document.querySelector('.pr-stage')?.className}`));
  }
  assert.fail(`${key} did not reach ${await target.getAttribute('aria-label') ?? await target.textContent()}: ${visited.join(' → ')}`);
}

async function waitDepth(page: Page, frame: Frame, expected: number): Promise<void> {
  try { await frame.waitForFunction(value => scrollY === value, expected); }
  catch (cause) {
    const outer = await page.evaluate(() => ({ active: document.activeElement?.outerHTML.slice(0, 180), stage: document.querySelector('.pr-stage')?.className }));
    const inner = await frame.evaluate(() => ({ y: scrollY, height: innerHeight, active: document.activeElement?.tagName,
      surface: document.scrollingElement?.scrollTop, heard: (window as unknown as { heard: string[] }).heard }));
    throw new Error(`Expected page depth ${expected}: ${JSON.stringify({ outer, inner })}`, { cause });
  }
}

test('fullscreen fallback cycles Tab inside the deck and restores the opener on close', { skip, timeout: 60_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await fixture(page, 'hand=1;ms=0', '', true);
    await page.evaluate(() => {
      const hud = document.querySelector('.pr-hud')!;
      const disabled = document.createElement('button'); disabled.id = 'fixture-disabled'; disabled.disabled = true; disabled.tabIndex = 0;
      const hidden = document.createElement('button'); hidden.id = 'fixture-hidden'; hidden.hidden = true;
      const inert = document.createElement('div'); inert.inert = true; inert.innerHTML = '<button id="fixture-inert">Hidden controls</button>';
      hud.append(disabled, hidden, inert);
    });
    assert.equal(await page.evaluate(() => document.fullscreenElement), null);
    assert.equal(await page.locator('#fixture-opener').evaluate(element => (element as HTMLElement).inert), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Exit presentation');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.closest('.pr-stage') !== null), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Exit presentation');
    await page.locator('.pr-stage').evaluate(stage => {
      for (const mods of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }]) {
        const before = document.activeElement, event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true, ...mods });
        before!.dispatchEvent(event);
        if (event.defaultPrevented || document.activeElement !== before) throw new Error('Modified Tab belongs to the browser');
      }
      stage.focus();
    });
    const seen = new Set<string>();
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => ({ inside: !!document.activeElement?.closest('.pr-stage'), iframe: document.activeElement?.tagName === 'IFRAME', label: document.activeElement?.getAttribute('aria-label') ?? '', id: document.activeElement?.id }));
      assert.equal(focus.inside, true); assert.equal(focus.iframe, false, 'Tab does not take over a page without handover'); seen.add(focus.label);
      assert.ok(!['fixture-disabled', 'fixture-hidden', 'fixture-inert'].includes(focus.id ?? ''), 'disabled, hidden and inert controls are outside the Tab order');
    }
    assert.ok(seen.has('Pause') && seen.has('Exit presentation'));
    const exit = page.locator('.pr-hud [aria-label="Exit presentation"]'); await tabTo(page, exit); await page.keyboard.press('Enter');
    await page.locator('.pr-stage').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'fixture-opener');
    assert.equal(await page.locator('#fixture-opener').evaluate(element => (element as HTMLElement).inert), false);
    assert.equal(await page.locator('#fixture-prior-inert').evaluate(element => (element as HTMLElement).inert), true);
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement?.id), 'fixture-background', 'the released trap leaves normal background Tab order intact');
  } finally { await browser.close(); }
});

test('the outside-page inspector makes Places and Pan changes one usable transaction', { skip, timeout: 60_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); await fixture(page, '');
    await page.evaluate(() => {
      const win = window as unknown as ControlWindow & { modeRows: import('../shells/web/src/views/free-canvas-math.ts').Box[]; modeWrites: string[] };
      win.presentation.close();
      const canvas = document.createElement('main'), root = document.createElement('aside');
      root.style.cssText = 'position:fixed;inset:24px;overflow:auto;padding:24px;background:var(--background,#101b24)';
      root.id = 'fixture-inspector'; document.body.append(canvas, root);
      win.modeRows = [{ id: 'demo', kind: 'web', web: 'https://outside.invalid/demo', interact: 2,
        interactOpts: 'hl=spotlight;mode=places;len=4200;start=150;from=%23kept;to=80%25;stops=0,%23intro,25%25,%23end;auto=focus' }];
      win.modeWrites = []; let dispose = () => {};
      const paint = () => { dispose(); root.innerHTML = win.LollyPresent.webInteractRows(win.modeRows[0]!); dispose = win.LollyPresent.wireWebInteract(root, model, ['demo'], canvas); };
      const model: import('../shells/web/src/views/design-ports.ts').ModelPort = {
        blockId: 'boxes', cfg: { idField: 'id' } as import('../shells/web/src/views/design-ports.ts').ModelPort['cfg'], frame: null,
        getBoxes: () => win.modeRows, commit: rows => { win.modeRows = rows; win.modeWrites.push(String(rows[0]!.interactOpts)); paint(); },
        setField: () => {}, subscribe: () => () => {}, getInput: () => undefined, setInput: () => {},
      }; paint();
    });
    const panel = page.locator('#fixture-inspector');
    const mode = panel.locator('[data-web-interact="mode"]');
    await panel.locator('summary').filter({ hasText: 'Scroll and depth' }).click();
    await mode.selectOption('pan');
    const read = () => page.evaluate(() => {
      const win = window as unknown as { modeWrites: string[] }; const wire = win.modeWrites.at(-1)!;
      return { count: win.modeWrites.length, data: Object.fromEntries(wire.split(';').filter(Boolean).map(part => { const [key, value] = part.split('='); return [key!, decodeURIComponent(value!)]; })) };
    });
    let state = await read(); assert.equal(state.count, 1); assert.equal(state.data.start, '150'); assert.equal(state.data.to, '80%');
    assert.equal(state.data.stops, '0,25%'); assert.equal(state.data.from, undefined); assert.equal(state.data.hlc, undefined);
    await mode.selectOption('places');
    const first = panel.getByLabel('Start', { exact: true }); await first.waitFor({ state: 'visible' }); assert.equal((await read()).count, 1);
    assert.equal(await mode.inputValue(), 'pan');
    await first.fill('#intro'); await first.press('Tab'); state = await read();
    assert.equal(state.count, 2); assert.equal(state.data.mode, 'places'); assert.equal(state.data.start, '#intro');
    assert.equal(state.data.from, '#intro'); assert.equal(state.data.to, '#intro'); assert.equal(state.data.stops, '#intro');
    assert.equal(state.data.hl, 'spotlight'); assert.equal(state.data.auto, 'focus'); assert.equal(state.data.len, '4200');
    await mode.selectOption('pan'); state = await read();
    assert.equal(state.count, 3); assert.equal(state.data.start, undefined); assert.equal(state.data.from, undefined); assert.equal(state.data.to, undefined); assert.equal(state.data.stops, undefined);
  } finally { await browser.close(); }
});

test('explicit and pointer handover keep Back visible and preserve the clicked child input', { skip, timeout: 60_000 }, async t => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); await fixture(page, 'hand=1;ms=0');
    const frame = page.frames().find(frame => frame.url().includes('/info/present-interact-demo.html'))!;
    await frame.waitForSelector('#typing'); await page.keyboard.press('Enter');
    const back = page.getByRole('button', { name: 'Back to slides', exact: true }); await back.waitFor({ state: 'visible' });
    const handoverTab = primaryEngine === 'webkit' ? 'Alt+Tab' : 'Tab';
    if (handoverTab !== 'Tab') t.diagnostic('WebKit handover uses native Alt+Tab; ordinary child Tab is a recorded limitation.');
    await tabTo(page, back, handoverTab); await page.keyboard.press('Space');
    await page.waitForFunction(() => document.activeElement?.classList.contains('pr-stage'));
    await frame.locator('#typing').click(); await back.waitFor({ state: 'visible' });
    assert.equal(await frame.evaluate(() => document.activeElement?.id), 'typing');
    await page.keyboard.type('A shared typing demo'); assert.equal(await frame.locator('#typing').inputValue(), 'A shared typing demo');
    await back.click(); await page.waitForFunction(() => document.activeElement?.classList.contains('pr-stage'));
    assert.equal(await page.locator('.pr-embed-focus').count(), 0);
    await page.evaluate(() => (window as unknown as ControlWindow).presentation.close());
  } finally { await browser.close(); }
});

test('Tab activation stays native on presenter controls, while modifiers and blackout taps keep their meaning', { skip, timeout: 90_000 }, async t => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, hasTouch: true });
    await fixture(page, 'hand=1;stops=0,400,0,800;walk=1;ms=0');
    const frame = page.frames().find(frame => frame.url().includes('/info/present-interact-demo.html'))!;
    await frame.waitForSelector('#typing');
    await page.evaluate(() => {
      const win = window as unknown as { editorKeys: string[] }; win.editorKeys = [];
      document.addEventListener('keydown', event => { win.editorKeys.push(event.key); });
    });
    const pause = page.locator('.pr-hud [aria-label="Pause"]');
    await tabTo(page, pause); await page.keyboard.press('Space');
    await page.locator('.pr-hud [aria-label="Resume"]').waitFor();
    assert.equal(await page.evaluate(() => (window as unknown as ControlWindow).presentation.frameId), 'a');
    assert.equal(await page.locator('.pr-embed-focus').count(), 0, 'Space on Pause does not hand the keyboard to the page');
    await page.keyboard.press('Enter'); await pause.waitFor();
    assert.deepEqual(await page.evaluate(() => (window as unknown as { editorKeys: string[] }).editorKeys.filter(key => key !== 'Tab')), []);
    for (const [key, depth] of [['ArrowDown', 400], ['ArrowUp', 0], ['ArrowRight', 400], ['ArrowLeft', 0]] as const) {
      await page.keyboard.press(key); await waitDepth(page, frame, depth);
      assert.equal(await page.locator('.pr-embed-focus').count(), 0);
    }

    const overview = page.locator('.pr-hud [aria-label="Overview"]');
    await tabTo(page, overview); await page.keyboard.press('Space'); await page.locator('.pr-overview').waitFor();
    await tabTo(page, overview); await page.keyboard.press('Enter'); await page.locator('.pr-overview').waitFor({ state: 'detached' });
    assert.equal(await page.locator('.pr-embed-focus').count(), 0);

    await page.locator('.pr-stage').focus();
    const boot = await frame.evaluate(() => (window as unknown as { boot: string }).boot);
    const modifiers = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>('.pr-stage')!;
      return [{ ctrlKey: true }, { metaKey: true }, { altKey: true }].flatMap(mods => ['f', 's', 'o', 'b', 'Enter', 'ArrowRight', 'ArrowDown', 'F5'].map(key => {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods }); stage.dispatchEvent(event);
        return { key, prevented: event.defaultPrevented };
      }));
    });
    assert.ok(modifiers.every(row => row.prevented === (row.key === 'F5')));
    assert.equal(await page.locator('.pr-blackout, .pr-overview, .pr-embed-focus').count(), 0);
    assert.equal(await frame.evaluate(() => (window as unknown as { boot: string }).boot), boot);
    assert.equal(await page.evaluate(() => (window as unknown as ControlWindow).presentation.frameId), 'a');

    for (const key of ['Space', 'Enter']) {
      await page.keyboard.press('Enter'); await page.getByRole('button', { name: 'Back to slides', exact: true }).waitFor({ state: 'visible' });
      const handoverTab = primaryEngine === 'webkit' ? 'Alt+Tab' : 'Tab';
      if (handoverTab !== 'Tab') t.diagnostic('WebKit default child Tab remains in the iframe; native Alt+Tab is tested without changing preferences.');
      await tabTo(page, page.locator('.pr-embed-return'), handoverTab); await page.keyboard.press(key);
      await page.waitForFunction(() => document.activeElement?.classList.contains('pr-stage'));
      assert.equal(await page.locator('.pr-embed-focus').count(), 0);
    }
    await frame.locator('#typing').click();
    await page.getByRole('button', { name: 'Back to slides', exact: true }).waitFor({ state: 'visible' });
    assert.equal(await frame.evaluate(() => document.activeElement?.id), 'typing');
    await page.getByRole('button', { name: 'Back to slides', exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.classList.contains('pr-stage'));
    assert.equal(await page.locator('.pr-embed-focus').count(), 0);
    await page.evaluate(() => {
      const link = document.createElement('a'); link.href = '#presenter-link'; link.textContent = 'Fixture link';
      document.querySelector('.pr-hud')!.append(link);
    });
    await tabTo(page, page.locator('.pr-hud a')); await page.keyboard.press('Space');
    assert.equal(await page.locator('.pr-embed-focus').count(), 0);
    await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => location.hash), '#presenter-link');
    assert.equal(await page.evaluate(() => (window as unknown as ControlWindow).presentation.frameId), 'a');
    await page.locator('.pr-stage').focus();
    await tabTo(page, pause); await page.keyboard.press('b'); await page.keyboard.press('Space');
    assert.equal(await page.locator('.pr-blackout').count(), 0); await pause.waitFor();
    await page.locator('.pr-stage').focus();

    for (const selector of ['.pr-tap-prev', '.pr-tap-next']) {
      await page.keyboard.press('.'); await page.locator('.pr-blackout').waitFor();
      await page.locator(selector).tap(); await page.locator('.pr-blackout').waitFor({ state: 'detached' });
      assert.equal(await frame.evaluate(() => scrollY), 0); assert.equal(await page.evaluate(() => (window as unknown as ControlWindow).presentation.frameId), 'a');
    }
    await page.evaluate(() => (window as unknown as ControlWindow).presentation.close());
  } finally { await browser.close(); }
});

test('repeated scroll stops finish the route without changing the focus deep state', { skip, timeout: 60_000 }, async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await fixture(page, 'stops=0,400,0,800;walk=1;ms=0');
    const frame = page.frames().find(frame => frame.url().includes('/info/present-interact-demo.html'))!; await frame.waitForSelector('#typing');
    for (const depth of [400, 0, 800]) {
      await page.keyboard.press('PageDown'); await waitDepth(page, frame, depth);
      assert.equal(await page.evaluate(() => (window as unknown as ControlWindow).presentation.frameId), 'a');
      assert.equal(await page.locator('.pr-interact-focus').getAttribute('data-interact'), '2');
    }
    for (const depth of [0, 400, 0]) {
      await page.keyboard.press('PageUp'); await waitDepth(page, frame, depth);
      assert.equal(await page.evaluate(() => (window as unknown as ControlWindow).presentation.frameId), 'a');
    }
    await page.keyboard.press('PageDown'); await page.keyboard.press('PageDown');
    const previousBoot = await frame.evaluate(() => (window as unknown as { boot: string }).boot);
    await frame.evaluate(() => location.reload());
    await frame.waitForFunction(before => (window as unknown as { boot: string }).boot !== before, previousBoot);
    await page.locator('.pr-stage').focus();
    for (const depth of [400, 0, 800]) {
      await page.keyboard.press('PageDown'); await waitDepth(page, frame, depth);
    }
    await page.keyboard.press('PageDown');
    await page.waitForFunction(() => (window as unknown as ControlWindow).presentation.frameId === 'b');
    await page.keyboard.press('PageUp'); await page.locator('.pr-interact-focus').waitFor();
    assert.equal(await page.locator('.pr-interact-focus').getAttribute('data-interact'), '2');
    await page.evaluate(() => (window as unknown as ControlWindow).presentation.close());
  } finally { await browser.close(); }
});

test('the presenter keeps frame identity through Zoom, speaker view, release and stop-walking', { skip, timeout: 120_000 }, async t => {
  if (output) await mkdir(output, { recursive: true });
  for (const name of names) {
    if (!Object.hasOwn(browsers, name)) throw new Error(`Unknown browser ${name}`);
    await t.test(name, async () => {
      const browser = await launchBrowser(name as keyof typeof browsers);
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
        const status = speaker.locator('.pr-sp-status'); assert.equal(await status.textContent(), 'Playing.');
        assert.equal(await status.evaluate(element => getComputedStyle(element).fontWeight), '400');
        await page.locator('.pr-stage').focus(); await page.keyboard.press('k');
        assert.equal(await status.textContent(), 'Paused.');
        if (output) await speaker.screenshot({ path: `${output}/${name}-speaker-paused.png` });
        await page.keyboard.press('b'); assert.equal(await status.textContent(), 'Blackout');
        if (output) await speaker.screenshot({ path: `${output}/${name}-speaker-blackout.png` });
        await page.keyboard.press('.'); assert.equal(await status.textContent(), 'Paused.');
        await page.keyboard.press('k'); assert.equal(await status.textContent(), 'Playing.');
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
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await fixture(page, 'hl=zoom;auto=focus;from=0;to=800;stops=0,400,800;sec=2;ease=el;hand=1;ms=0');
    const frame = page.frames().find(frame => frame.url().includes('/info/present-interact-demo.html'))!; await frame.waitForSelector('#typing');
    assert.equal(await page.locator('.pr-interact-ring').count(), 1); assert.equal(await page.locator('.pr-interact-zoom').count(), 0);
    if (output) { await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/${primaryEngine}-ring.png` }); }
    await page.keyboard.press('k'); const depth = await frame.evaluate(() => scrollY);
    await page.waitForTimeout(1100); assert.equal(await frame.evaluate(() => scrollY), depth);
    await page.keyboard.press('k'); await frame.waitForFunction(() => scrollY >= 400);
    await page.keyboard.press('ArrowUp'); const manual = await frame.evaluate(() => scrollY);
    await page.waitForTimeout(1100); assert.equal(await frame.evaluate(() => scrollY), manual);
    await page.keyboard.press('Enter'); await page.getByRole('button', { name: 'Back to slides', exact: true }).waitFor({ state: 'visible' });
    await frame.locator('#typing').fill('A typing demo');
    await page.getByRole('button', { name: 'Back to slides', exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.classList.contains('pr-stage'), undefined, { timeout: 3000 });
    const nativeFullscreen = await page.evaluate(() => !!document.fullscreenElement);
    await page.keyboard.press('Escape');
    if (nativeFullscreen) {
      await page.waitForFunction(() => !document.fullscreenElement || !document.querySelector('.pr-interact-focus'));
      if (await page.locator('.pr-interact-focus').count()) {
        assert.equal(await page.evaluate(() => document.fullscreenElement), null, 'native fullscreen consumes its own Escape before the deck');
        assert.equal(await page.locator('.pr-stage').count(), 1); await page.keyboard.press('Escape');
      }
    }
    assert.equal(await page.locator('.pr-stage').count(), 1); assert.equal(await page.locator('.pr-interact-focus').count(), 0);
    await page.evaluate(() => (window as unknown as ControlWindow).presentation.close());
    if (output) {
      const spotlight = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await fixture(spotlight, 'hl=spotlight;ms=0');
      await spotlight.locator('.pr-interact-scrim').waitFor();
      await spotlight.screenshot({ path: `${output}/${primaryEngine}-spotlight.png` });
      await spotlight.close();
    }
  } finally { await browser.close(); }
});

test('preflight fits a phone and desktop, and clicker learning requires a deliberate test', { skip, timeout: 60_000 }, async () => {
  const browser = await launchBrowser();
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
      const start = modal.getByRole('button', { name: 'Start test', exact: true });
      await start.focus(); await page.keyboard.press('Space');
      assert.equal(await modal.locator('[data-clicker-result]').evaluate(element => element === document.activeElement), true);
      await page.keyboard.press('Space');
      await modal.locator('[data-clicker-result]').getByText('Space · Next', { exact: true }).waitFor();
      await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
      await start.waitFor();
      assert.equal(await start.getAttribute('aria-pressed'), 'false', 'Finish test remains keyboard operable');
      await start.click();
      assert.equal(await modal.getByRole('button', { name: 'Remember button', exact: true }).isDisabled(), true);
      await page.keyboard.press('F8'); await modal.locator('[data-clicker-result]').getByText('F8 · No deck action', { exact: true }).waitFor();
      await modal.getByLabel('Remember as').selectOption('next');
      await modal.getByRole('button', { name: 'Remember button', exact: true }).click();
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('lolly-clicker-keys')!).F8), 'next');
      if (output) await page.screenshot({ path: `${output}/${primaryEngine}-preflight-${width}.png` });
      await modal.getByRole('button', { name: 'Not now', exact: true }).click(); await modal.waitFor({ state: 'detached' });
      await page.close();
    }
  } finally { await browser.close(); }
});
