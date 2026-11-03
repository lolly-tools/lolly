// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';
import type { ViteDevServer } from 'vite';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';
import { createTokenSet } from '../engine/src/tokens.ts';

let browser: Browser;
let server: ViteDevServer | undefined;
let origin = process.env.LOLLY_EXPORT_TEST_URL;
const designSystem = JSON.parse(readFileSync(new URL('../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json', import.meta.url), 'utf8'));

before(async () => {
  if (!origin) {
    const { createServer } = await import('vite');
    server = await createServer({ root: fileURLToPath(new URL('../shells/web', import.meta.url)), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
    await server.listen();
    origin = server.resolvedUrls!.local[0]!;
  }
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
  browser = await chromium.launch({ headless: true, args: webGpuLaunchArgs('auto'), ...(process.platform === 'darwin' ? { channel: 'chrome' } : {}) });
});
after(async () => { await browser?.close(); await server?.close(); });

async function open(page: Page, route: string): Promise<void> {
  await page.goto(`${origin}/#/${route}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#view h1, #tool-canvas, #tool-content').first().waitFor({ state: 'attached', timeout: 60_000 });
  await page.waitForFunction(() => !document.querySelector('#view[data-route-mounting], dialog.view-loading[open]'));
}

async function reachable(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).evaluate(element => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return !!hit && (element.contains(hit) || hit.contains(element));
  });
}

test('Spreadsheet navigation clears its heading and leaves loaded data usable in every appearance', { timeout: 120_000 }, async () => {
  const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await open(page, 'data');
    await page.locator('[data-file]').setInputFiles({ name: 'sample.csv', mimeType: 'text/csv', buffer: Buffer.from('Item,Quantity\nSample,2\n') });
    await page.locator('[data-actions]').waitFor({ state: 'visible' });
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ['light', 'dark', 'brand']) {
        await page.evaluate(async appearance => { const path = '/src/theme.ts'; (await import(path)).applyTheme(appearance, false); }, theme);
        const geometry = await page.evaluate(() => ({
          title: document.querySelector('.plat-title')!.getBoundingClientRect().top,
          nav: document.querySelector('.tools-home')!.getBoundingClientRect().bottom,
          overflow: document.documentElement.scrollWidth > innerWidth,
        }));
        assert.ok(geometry.title > geometry.nav, JSON.stringify({ width, theme, geometry }));
        assert.equal(geometry.overflow, false);
        await page.locator('[data-dl="csv"]').scrollIntoViewIfNeeded();
        assert.ok(await reachable(page, '[data-dl="csv"]'));
        await page.evaluate(() => window.scrollTo(0, 0));
      }
    }
  } finally { await context.close(); }
});

test('phone tool controls clear the sheet grip and the Design top bar', { timeout: 120_000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await open(page, 'tool/qr-code?url=https%3A%2F%2Fexample.com');
    const states: string[] = [];
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(400);
      states.push(await page.locator('.tool-layout').getAttribute('data-sheet') ?? '');
      assert.ok(await reachable(page, '.stage-nav-profile'), `settings reachable in ${states.at(-1)}`);
      const clearance = await page.evaluate(() => {
        const grip = document.querySelector('#sheet-grip')!.getBoundingClientRect();
        const hud = document.querySelector('.stage-nav')!.getBoundingClientRect();
        const body = document.querySelector('.sidebar-body')!.getBoundingClientRect();
        return { gripTop: grip.top, gripBottom: grip.bottom, hudTop: hud.top, bodyBottom: body.bottom, hudBottom: hud.bottom };
      });
      assert.ok(clearance.hudTop >= clearance.gripBottom, JSON.stringify(clearance));
      assert.ok(clearance.hudBottom <= 844, JSON.stringify(clearance));
      if (states.at(-1) !== 'peek') assert.ok(clearance.bodyBottom <= clearance.gripTop + 1, JSON.stringify(clearance));
      await page.locator('#sheet-grip').tap();
    }
    assert.deepEqual(states, ['half', 'full', 'half', 'peek']);
    for (const keyboard of [0, 300]) {
      await page.evaluate(bottom => {
        const style = document.documentElement.style;
        style.setProperty('--safe-top', '44px'); style.setProperty('--safe-bottom', '34px'); style.setProperty('--vv-bottom', `${bottom}px`);
      }, keyboard);
      await page.waitForTimeout(400);
      assert.ok(await reachable(page, '.stage-nav-profile'));
      const hud = await page.locator('.stage-nav').boundingBox();
      assert.ok(hud && hud.y + hud.height <= 844 - 34 - keyboard, JSON.stringify({ keyboard, hud }));
      await page.locator('#sheet-grip').tap();
    }
    await page.evaluate(() => { for (const name of ['--safe-top', '--safe-bottom', '--vv-bottom']) document.documentElement.style.removeProperty(name); });
    await open(page, 'tool/work-avatar?caption=Sample');
    await page.waitForTimeout(400);
    const artClearance = await page.evaluate(() => ({
      artTop: document.querySelector('#tool-canvas')!.getBoundingClientRect().top,
      controls: document.querySelector('.stage-nav')!.getBoundingClientRect().bottom,
      art: document.querySelector('#tool-canvas')!.getBoundingClientRect().bottom,
      export: document.querySelector('.render-pill')!.getBoundingClientRect().top,
    }));
    assert.ok(artClearance.art < artClearance.export, JSON.stringify(artClearance));
    assert.ok(artClearance.artTop > artClearance.controls, JSON.stringify(artClearance));
    await open(page, 'tool/design?boxes=%5B%5D');
    await page.locator('.design-topbar').waitFor({ state: 'visible' });
    const zoomIn = page.locator('.stage-nav [data-nav="in"]');
    if (await zoomIn.isVisible()) assert.ok(await reachable(page, '.stage-nav [data-nav="in"]'));
  } finally { await context.close(); }
});

test('Doc Studio keeps its ribbon reachable and mirrors document colours without replacing edited text', { timeout: 120_000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await context.addInitScript(doc => { (window as unknown as Record<string, unknown>).__lollyAutomationDesignSystem = doc; }, designSystem);
  try {
    const page = await context.newPage();
    await open(page, 'tool/doc-studio?docTitle=Sample&_themes=%7B%22colourway%22%3A%22morning%22%7D');
    await page.locator('.doc-tt-paper').waitFor({ state: 'visible' });
    const editable = page.getByRole('textbox', { name: 'Document body' });
    await editable.fill('Keep this edited document.');
    await page.waitForFunction(() => document.querySelector('#tool-canvas .doc')?.textContent?.includes('Keep this edited document.'));
    const editedText = await editable.innerText();
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ['light', 'dark', 'brand']) {
        await page.evaluate(async appearance => { const path = '/src/theme.ts'; (await import(path)).applyTheme(appearance, false); }, theme);
        await page.waitForTimeout(100);
        assert.ok(await reachable(page, '.doc-style-select'), `${width} ${theme} paragraph style`);
        assert.ok(await reachable(page, 'button[aria-label="Strikethrough"]'), `${width} ${theme} strikethrough`);
      }
    }
    for (const paper of ['dark', 'light']) {
      await page.evaluate(value => { (window as unknown as { __lollySetInput(id: string, value: string): void }).__lollySetInput('theme', value); }, paper);
      await page.waitForFunction(want => document.querySelector('#tool-canvas .doc')?.getAttribute('data-lolly-anno-theme') === want, paper);
      await page.waitForFunction(() => {
        const rendered = document.querySelector('#tool-canvas .doc')!;
        const editor = document.querySelector('.doc-tt-paper')!;
        const source = getComputedStyle(rendered), live = getComputedStyle(editor);
        return ['accent', 'ink', 'paper'].every(name => source.getPropertyValue(`--${name}`).trim() === live.getPropertyValue(`--doc-${name}`).trim());
      });
      assert.equal(await editable.innerText(), editedText);
    }
    await page.evaluate(() => { (window as unknown as { __lollySetInput(id: string, value: string): void }).__lollySetInput('accent', '#da1889'); });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.doc-tt-paper')!).getPropertyValue('--doc-accent').trim() === '#da1889');
    assert.equal(await editable.innerText(), editedText);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Page setup', exact: true }).click();
    const setup = page.getByRole('dialog', { name: 'Page setup', exact: true });
    const bounds = await setup.boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 390 && bounds.y + bounds.height <= 844, JSON.stringify(bounds));
    await setup.locator('select').last().scrollIntoViewIfNeeded();
    assert.ok(await setup.locator('select').last().evaluate(element => {
      const r = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }));
    await page.keyboard.press('Escape');
    await setup.waitFor({ state: 'hidden' });
  } finally { await context.close(); }
});

test('capture controls remain reachable beside editor panels without opening a device', { timeout: 120_000 }, async () => {
  const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    for (const tool of ['record', 'screencap']) {
      await open(page, `tool/${tool}?qa=1`);
      if (tool === 'record') await page.locator('.design-topbar').waitFor({ state: 'visible' });
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(400);
        const controls = tool === 'record' ? ['.canvas-record-btn', '.canvas-record-mic', '.crh-btn'] : ['.canvas-screen-btn:not([hidden])', '.canvas-screen-rec'];
        for (const control of controls) assert.ok(await reachable(page, control), `${tool} ${width} ${control}`);
      }
    }
  } finally { await context.close(); }
});

test('Calendar event cards follow document colourways and modes even with a different OS appearance', { timeout: 120_000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark', serviceWorkers: 'block', reducedMotion: 'reduce' });
  await context.addInitScript(doc => { (window as unknown as Record<string, unknown>).__lollyAutomationDesignSystem = doc; }, designSystem);
  try {
    const page = await context.newPage();
    await open(page, 'tool/calendar-ics?eventName=Sample&meetingTime=2026-11-04T10%3A00&_themes=%7B%22%22%3A%22light%22%7D');
    for (const mode of ['light', 'dark']) {
      if (mode === 'dark') await page.locator('#theme-section .badge-select-opt').filter({ hasText: /^Dark$/ }).click();
      for (const colourway of ['spearmint', 'morning', 'spring', 'beach', 'afternoon', 'midnight']) {
        const colours = createTokenSet(designSystem, { selection: { '': mode, colourway } }).colors();
        const primary = colours.find(c => c.path === 'color.semantic.primary')!.value;
        await page.getByRole('radio', { name: new RegExp(`^${colourway}$`, 'i') }).click();
        await page.waitForFunction(want => document.querySelector('.cal-meta svg')?.getAttribute('stroke') === want, primary);
        const follows = await page.evaluate(() => {
          const canvas = getComputedStyle(document.querySelector('#tool-canvas')!);
          const chip = getComputedStyle(document.querySelector('.cal-chip')!);
          const card = getComputedStyle(document.querySelector('.cal-card')!);
          const asRgb = (colour: string): string => { const el = document.createElement('span'); el.style.color = colour; document.body.append(el); const value = getComputedStyle(el).color; el.remove(); return value; };
          return chip.backgroundColor === asRgb(canvas.getPropertyValue('--brand-primary')) && chip.color === asRgb(canvas.getPropertyValue('--brand-on-primary')) && card.backgroundColor === asRgb(canvas.getPropertyValue('--brand-surface'));
        });
        assert.ok(follows, `${mode} ${colourway}`);
      }
    }
  } finally { await context.close(); }
});

test('Convert Font accepts a file and exposes conversion through the shared controls', { timeout: 120_000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await open(page, 'tool/font-convert?qa=1');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Choose a font…' }).click()]);
    await chooser.setFiles({ name: 'sample.ttf', mimeType: 'font/ttf', buffer: readFileSync(new URL('../shells/web/public/fonts/Outfit[wght].ttf', import.meta.url)) });
    await page.locator('[data-input-id="subset"]').selectOption('latin');
    await page.locator('.font-convert-subset').waitFor({ state: 'visible' });
    const downloadButton = page.locator('[data-export-file]');
    await downloadButton.scrollIntoViewIfNeeded();
    assert.ok(await reachable(page, '[data-export-file]'));
    const [download] = await Promise.all([page.waitForEvent('download'), downloadButton.click()]);
    assert.equal(download.suggestedFilename(), 'sample-subset.woff');
    const path = await download.path();
    assert.ok(path);
    assert.equal(readFileSync(path).subarray(0, 4).toString(), 'wOFF');
  } finally { await context.close(); }
});

test('Countdown keeps its editable and running time readable in both document modes', { timeout: 120_000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await context.addInitScript(doc => { (window as unknown as Record<string, unknown>).__lollyAutomationDesignSystem = doc; }, designSystem);
  try {
    const page = await context.newPage();
    for (const mode of ['light', 'dark']) {
      await open(page, `tool/countdown-timer?qa=1&_themes=${encodeURIComponent(JSON.stringify({ '': mode }))}`);
      await page.locator('.ct-input').waitFor({ state: 'visible' });
      for (const selector of ['.ct-input', '.ct-time']) {
        if (selector === '.ct-time') await page.getByRole('button', { name: 'Start', exact: true }).click();
        const readable = await page.locator(selector).evaluate(element => {
          const foreground = getComputedStyle(element).color;
          const root = document.querySelector('.ct-root')!;
          const background = getComputedStyle(root).backgroundColor;
          return foreground !== background && getComputedStyle(element).color !== 'rgba(0, 0, 0, 0)';
        });
        assert.ok(readable, `${mode} ${selector}`);
      }
    }
  } finally { await context.close(); }
});
