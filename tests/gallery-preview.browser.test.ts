// SPDX-License-Identifier: MPL-2.0
/** LOLLY_GALLERY_TEST_URL=http://localhost:5173 node --test tests/gallery-preview.browser.test.ts */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';

const origin = process.env.LOLLY_GALLERY_TEST_URL;
test('gallery renders branded templates, preserves their framing, and invalidates palette caches', {
  skip: origin ? false : 'set LOLLY_GALLERY_TEST_URL to a local Vite shell', timeout: 120_000,
}, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  const errors: string[] = [], artworkRequests: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => {
    if (/\/catalog\/previews\/.*\.(svg|webp|png)|\/tools\/[^/]+\/card\.(html|svg|png|webm)/.test(r.url())) artworkRequests.push(r.url());
  });
  await page.addInitScript(() => {
    for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack', 'lolly-capture-neutral']) localStorage.setItem(key, '1');
  });
  try {
    await page.goto(`${origin}/#/`, { waitUntil: 'networkidle' });
    const design = page.locator('.gtile[data-tool-id="design"]');
    await design.locator('.gcar-slide.is-loaded').first().waitFor({ timeout: 60_000 });
    const cover = design.locator('.gcar-img').first();
    assert.ok((await cover.getAttribute('src'))?.startsWith('data:image/'));
    assert.equal(await design.locator('.gcar-open').first().getAttribute('href'), '#/tool/design?template=carousel');
    assert.deepEqual(await cover.evaluate(i => [(i as HTMLImageElement).naturalWidth, (i as HTMLImageElement).naturalHeight]), [1080, 1350]);
    await page.locator('.ftile[data-tool="design"] .ftile-img.is-active').first().waitFor({ timeout: 60_000 });
    assert.deepEqual(artworkRequests, [], 'gallery never fetches artwork generated for another palette');
    // Run the real renderer twice with an edited primary token and the SAME brand ID,
    // then revisit it. This catches a cache keyed only by input values or brand ID.
    const facts = await page.evaluate(async () => {
      const bridgePath = '/src/bridge/index.ts', previewPath = '/src/lib/gallery-preview.ts';
      const { createBridge } = await import(bridgePath);
      const { renderGalleryLook } = await import(previewPath);
      const host = await createBridge();
      const original = await host.tokens.get();
      let primary = '#b83a74';
      const resolve = (ref: string) => ref.replace(/[{}]/g, '') === 'color.semantic.primary' ? primary : original.resolve(ref);
      const records = new Map();
      let writes = 0;
      host.tokens = {
        ...host.tokens,
        active: async () => ({ id: 'preview-palette-test' }),
        get: async () => ({ ...original, query: () => original.query().map((e: { path: string }) => e.path === 'color.semantic.primary' ? { ...e, value: primary } : e), resolve }),
        resolve: async (ref: string) => resolve(ref),
      };
      host.previews = {
        get: async (key: string) => records.get(key) ?? null,
        put: async (key: string, record: unknown) => { records.set(key, record); writes++; },
      };
      const tool = { id: 'design', version: 'browser-test', formats: ['svg'] };
      const look = { templateId: 'carousel', values: {} };
      const first = await renderGalleryLook(host, tool, 0, look);
      primary = '#1b7c91';
      const second = await renderGalleryLook(host, tool, 0, look);
      const cached = await renderGalleryLook(host, tool, 0, look);
      const pixel = async (src: string) => {
        const img = new Image(); img.src = src; await img.decode();
        const canvas = document.createElement('canvas'); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!; ctx.drawImage(img, 0, 0);
        return Array.from(ctx.getImageData(20, 20, 1, 1).data);
      };
      return { changed: first !== second, reused: cached === second, writes, first: await pixel(first), second: await pixel(second) };
    });
    assert.deepEqual(facts, { changed: true, reused: true, writes: 2, first: [184, 58, 116, 255], second: [27, 124, 145, 255] });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('every gallery tool gets a cover before extra templates, including tools below the fold', {
  skip: origin ? false : 'set LOLLY_GALLERY_TEST_URL to a local Vite shell', timeout: 120_000,
}, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 850 }, reducedMotion: 'no-preference' });
  const ids = ['design', 'gradient', 'qr-code'];
  try {
    await page.route('**/catalog/tools/index*.json', async route => {
      const response = await route.fetch();
      const data = await response.json();
      if (Array.isArray(data.tools)) data.tools = data.tools.filter((tool: { id: string }) => ids.includes(tool.id));
      await route.fulfill({ response, json: data });
    });
    await page.addInitScript(() => {
      localStorage.setItem('lolly-featured-view', 'coverflow');
      for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
      window.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = '.tool-masonry { display:block!important } .tool-masonry .gtile { min-height:1100px!important; content-visibility:auto!important }';
        document.head.append(style);
      });
      document.addEventListener('load', event => {
        const img = event.target;
        if (!(img instanceof HTMLImageElement) || !img.matches('.gcar-img, .ftile-img')) return;
        const index = img.matches('.ftile-img')
          ? [...img.parentElement!.querySelectorAll('.ftile-img')].indexOf(img)
          : Number(img.closest<HTMLElement>('[data-ex-index]')?.dataset.exIndex ?? 0);
        const win = window as Window & { firstExtra?: { covers: string[]; belowFold: boolean; source: string } };
        if (index === 0 || win.firstExtra) return;
        const tiles = [...document.querySelectorAll<HTMLElement>('.gtile[data-tool-id]:not(.is-filtered)')];
        win.firstExtra = {
          source: img.matches('.ftile-img') ? 'featured' : 'grid',
          covers: tiles.filter(tile => {
            const cover = tile.querySelector<HTMLImageElement>('.gcar-img');
            return cover?.complete && cover.naturalWidth > 0;
          }).map(tile => tile.dataset.toolId!),
          belowFold: tiles.some(tile => tile.getBoundingClientRect().top > innerHeight + 250),
        };
      }, true);
    });
    await page.goto(`${origin}/#/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window as Window & { firstExtra?: unknown }).firstExtra, undefined, { timeout: 90_000 });
    const facts = await page.evaluate(() => (window as Window & { firstExtra?: { covers: string[]; belowFold: boolean; source: string } }).firstExtra);
    assert.ok(facts);
    assert.equal(facts.source, 'featured', 'exercise the shared strip/grid queue with Cover Flow extras');
    assert.equal(facts.belowFold, true, 'the fixture must include tools outside the lazy-loading margin');
    assert.deepEqual(facts.covers.sort(), ids.sort(), 'all first covers must be decoded before any extra template');
  } finally { await browser.close(); }
});
