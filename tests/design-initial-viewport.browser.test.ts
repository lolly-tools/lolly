// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import type { ViteDevServer } from 'vite';

test('Design reveals fitted artboards after delayed chrome and hides the outgoing remount camera reset', { timeout: 120_000 }, async (t) => {
  let server: ViteDevServer | undefined;
  t.after(async () => { await server?.close(); });
  let origin = process.env.LOLLY_EXPORT_TEST_URL;
  if (!origin) {
    const { createServer } = await import('vite');
    server = await createServer({ root: fileURLToPath(new URL('../shells/web', import.meta.url)), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
    await server.listen();
    origin = server.resolvedUrls!.local[0]!;
  }
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const boxes = Array.from({ length: 9 }, (_, i) => ({ id: `page-${i}`, kind: 'frame', x: i * 2000, y: 0, w: 1920, h: 1080, order: i, bg: '#ffffff' }));
  const params = new URLSearchParams({ boxes: JSON.stringify(boxes), c2pa: '0', imprint: '0' });
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let requested!: () => void;
  const chromeRequested = new Promise<void>(resolve => { requested = resolve; });
  await page.route('**/src/views/free-canvas.ts', async route => { requested(); await held; await route.continue(); });
  await page.addInitScript(() => {
    const state = window as unknown as { initialViewportSamples: { width: number; chrome: boolean }[] };
    state.initialViewportSamples = [];
    for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
    const sample = (): void => {
      const canvas = document.querySelector<HTMLElement>('#tool-canvas');
      if (canvas?.querySelector('.lolly-frame-page') && getComputedStyle(canvas).visibility === 'visible') {
        state.initialViewportSamples.push({ width: canvas.getBoundingClientRect().width, chrome: !!document.querySelector('.design-topbar') });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const samples = () => page.evaluate(() => (window as unknown as { initialViewportSamples: { width: number; chrome: boolean }[] }).initialViewportSamples);
  const ready = () => page.waitForFunction(() => {
    const canvas = document.querySelector<HTMLElement>('#tool-canvas');
    return canvas?.querySelectorAll('.lolly-frame-page').length === 9 && getComputedStyle(canvas).visibility === 'visible' && !document.querySelector('dialog[open]');
  });
  try {
    await page.goto(`${origin}/design?${params}`, { waitUntil: 'domcontentloaded' });
    await chromeRequested;
    // Outlast the former 120-frame poll without tying readiness to wall-clock speed.
    await page.evaluate(() => new Promise<void>(resolve => { let frames = 0; const tick = (): void => { if (++frames > 130) resolve(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }));
    assert.deepEqual(await samples(), [], 'content stays unpainted until its fit provider is mounted');
    release();
    await ready();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('lolly:remount')));
    await ready();
    const seen = await samples();
    assert.ok(seen.length > 0, 'the canvas actually became visible');
    assert.ok(seen.every(frame => frame.chrome && frame.width < 300), JSON.stringify(seen));

    // A deliberate linked view must win over initial Fit; selection and zoom keys work.
    for (const view of [{ scale: 2, x: 30, y: 40 }, { scale: 1, x: 0, y: 0 }]) {
      await page.goto(`${origin}/design?${params}&_view=${encodeURIComponent(JSON.stringify(view))}&_sel=page-0`);
      await ready();
      const transform = await page.locator('#tool-canvas-outer').evaluate(element => (element as HTMLElement).style.transform);
      if (view.scale === 1) assert.equal(transform, '', 'a deliberate identity view is preserved too');
      else assert.equal(transform, 'translate(30px, 40px) scale(2)');
      await page.waitForFunction(() => document.querySelector('[data-frame-id="page-0"].fc-frame-label')?.classList.contains('is-active'));
      await page.locator('#tool-canvas').focus();
      await page.keyboard.press('0');
      await page.waitForFunction(() => document.querySelector('#tool-canvas')!.getBoundingClientRect().width < 300);
    }
    assert.deepEqual(errors, []);
  } finally {
    release();
    await context.close();
    await browser.close();
  }
});
