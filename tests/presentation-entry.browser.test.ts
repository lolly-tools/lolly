// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

test('a delayed previous route cannot replace Design when presentation gains focus', { timeout: 120_000 }, async t => {
  const { createServer } = await import('vite');
  const server = await createServer({ root: fileURLToPath(new URL('../shells/web', import.meta.url)), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
  await server.listen();
  t.after(() => server.close());
  const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, '');
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'darwin' ? { channel: 'chrome' } : {}) });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  t.after(() => context.close());
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
    const samples: Array<{ x: number; y: number; width: number; height: number }> = [];
    (window as unknown as { openingCanvasSamples: typeof samples }).openingCanvasSamples = samples;
    const sample = (): void => {
      const canvas = document.querySelector<HTMLElement>('#tool-canvas');
      if (canvas?.querySelectorAll('.lolly-frame-page').length === 45 && getComputedStyle(canvas).visibility === 'visible') {
        const rect = canvas.getBoundingClientRect();
        samples.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  let release!: () => void, requested!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const projectsRequested = new Promise<void>(resolve => { requested = resolve; });
  await page.route('**/src/views/projects.ts*', async route => { requested(); await held; await route.continue(); });
  try {
    await page.goto(`${origin}/#/u`, { waitUntil: 'networkidle' });
    await page.evaluate(() => { location.hash = '#/p'; });
    await projectsRequested;
    const boxes = Array.from({ length: 45 }, (_, i) => ({ id: `page-${i}`, kind: 'frame', x: (i % 9) * 2000, y: Math.floor(i / 9) * 1200, w: 1920, h: 1080, order: i, bg: '#123e33' }));
    await page.evaluate(boxes => { location.hash = `#/tool/design?${new URLSearchParams({ boxes: JSON.stringify(boxes), c2pa: '0', imprint: '0' })}`; }, boxes);
    const ready = () => page.waitForFunction(() => document.querySelectorAll('#tool-canvas .lolly-frame-page').length === 45 && !document.querySelector('dialog[open]'));
    await ready().catch(async error => { throw new Error(`Design not ready: ${JSON.stringify({ errors, state: await page.evaluate(() => ({ path: location.pathname, frames: document.querySelectorAll('.lolly-frame-page').length, dialogs: [...document.querySelectorAll('dialog[open]')].map(dialog => dialog.textContent?.slice(0, 500)), text: document.querySelector('#view')?.textContent?.slice(0, 1000) })) })}`, { cause: error }); });
    const oldImport = page.waitForResponse(response => new URL(response.url()).pathname === '/src/views/projects.ts');
    release();
    // Releasing the old import and a window-focus refresh must leave the current view.
    await oldImport;
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.evaluate(() => new Promise<void>(resolve => { let frames = 0; const tick = (): void => { if (++frames > 30) resolve(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }));
    assert.equal(await page.locator('#tool-canvas .lolly-frame-page').count(), 45);
    assert.equal(await page.locator('#view .projects').count(), 0, 'the previous route cannot paint into the editor');
    const samples = await page.evaluate(() => (window as unknown as { openingCanvasSamples: Array<{ x: number; y: number; width: number; height: number }> }).openingCanvasSamples);
    assert.ok(samples.length >= 20, 'the fitted canvas was visible across actual paints');
    const spans = Object.fromEntries((['x', 'y', 'width', 'height'] as const).map(key => {
      const values = samples.map(sample => sample[key]);
      return [key, Math.max(...values) - Math.min(...values)];
    }));
    // Fractional browser layout may settle within one CSS pixel; a changing zoom cannot.
    assert.ok(Object.values(spans).every(span => span <= 1), `the opening viewport must remain stable: ${JSON.stringify(spans)}`);
    await page.locator('.design-topbar [data-topbar="present"]').click();
    await page.locator('.pr-stage').waitFor();
    await page.waitForFunction(() => document.activeElement?.classList.contains('pr-stage'));
    assert.equal(await page.locator('.pr-frames .lolly-frame-page').count(), 45);
    assert.equal(await page.locator('#view .projects').count(), 0);
    await page.getByRole('button', { name: 'Exit presentation', exact: true }).click();
    await page.locator('.pr-stage').waitFor({ state: 'detached' });
    await ready();
    assert.deepEqual(errors, []);
  } finally { release(); }
});
