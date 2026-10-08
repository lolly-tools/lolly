// SPDX-License-Identifier: MPL-2.0
/** LOLLY_GALLERY_TEST_URL=http://localhost:5173 node --test tests/gallery-preview.browser.test.ts */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_GALLERY_TEST_URL;
test('welcome opens the native import picker before loading import handlers', {
  skip: origin ? false : 'set LOLLY_GALLERY_TEST_URL to a local Vite shell', timeout: 60_000,
}, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ serviceWorkers: 'block' });
  try {
    await page.goto(`${origin}/#/`, { waitUntil: 'domcontentloaded' });
    await page.locator('.welcome-dialog').waitFor();
    const chooserReady = page.waitForEvent('filechooser');
    await page.locator('.welcome-dialog [data-choice="import"]').click();
    const chooser = await chooserReady;
    assert.equal(chooser.isMultiple(), true);
    assert.match(await chooser.element().getAttribute('accept') ?? '', /\.lolly/);
    await chooser.setFiles([]);
    assert.equal(await page.locator('.welcome-dialog').count(), 0);
  } finally { await browser.close(); }
});

test('welcome defers tool preview rendering until the user enters the gallery', {
  skip: origin ? false : 'set LOLLY_GALLERY_TEST_URL to a local Vite shell', timeout: 120_000,
}, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 420, height: 900 }, serviceWorkers: 'block' });
  const renders: string[] = [];
  let releaseTools!: () => void;
  const toolsReady = new Promise<void>(resolve => { releaseTools = resolve; });
  page.on('request', request => {
    if (/\/tools\/[^/]+\/(hooks\.js|template\.html)$/.test(request.url())) renders.push(request.url());
  });
  try {
    await page.route('**/catalog/tools/index.json', async route => { await toolsReady; await route.continue(); });
    await page.route('**/src/lib/offline-manager.ts', async route => { await toolsReady; await route.continue(); });
    await page.goto(`${origin}/#/`, { waitUntil: 'domcontentloaded' });
    await page.locator('.welcome-dialog').waitFor();
    await page.waitForTimeout(3000);
    assert.equal(renders.length, 0, 'covered cards must not start tool renderers');
    await page.locator('.welcome-dialog [data-choice="explore"]').click();
    releaseTools();
    await page.locator('.gtile[data-tool-id="design"] .gcar-slide.is-loaded').first().waitFor({ timeout: 90_000 });
    assert.ok(renders.some(url => url.includes('/tools/design/')), 'the queue resumes after dismissal');
  } finally { releaseTools(); await browser.close(); }
});

test('the welcome leaves a complete gallery behind it and holds housekeeping until it closes', {
  skip: origin ? false : 'set LOLLY_GALLERY_TEST_URL to a local Vite shell', timeout: 180_000,
}, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' });
  const probeId = 'welcome-gate-probe', staleId = 'welcome-gate/stale-probe';
  const staleMeta = (id: string) => import('/src/bridge/db.ts' as string)
    .then(async (m: { openDB(): Promise<{ get(store: string, key: string): Promise<unknown> }> }) => !!await (await m.openDB()).get('asset-meta', id));
  try {
    // Visit 1 creates the app's database. Seed an installed tool and a catalog record
    // the next prune must remove, then forget everything localStorage knows, so the
    // next visit is a cold first run whose welcome has not been settled.
    const seed = await context.newPage();
    await seed.goto(`${origin}/#/`, { waitUntil: 'domcontentloaded' });
    await seed.locator('.welcome-dialog').waitFor();
    await seed.waitForFunction(() => !!window.localStorage.getItem('sbt-tool-index'), undefined, { timeout: 60_000 });
    await seed.evaluate(async ({ probeId, staleId }) => {
      const enc = (text: string) => new TextEncoder().encode(text);
      const manifest = {
        id: probeId, name: 'Welcome Gate Probe', description: 'Installed from a .lolly file', version: '1.0.0',
        category: 'everyone', status: 'community', inputs: [], render: { width: 400, height: 400, formats: ['svg'] },
      };
      const installed = await import('/src/lib/installed-tools.ts' as string);
      await installed.installTool({ manifest, trust: 'custom', files: { 'tool.json': enc(JSON.stringify(manifest)), 'template.html': enc('<svg viewBox="0 0 10 10"></svg>') } });
      const { openDB } = await import('/src/bridge/db.ts' as string);
      await (await openDB()).put('asset-meta', { id: staleId, version: '1', tier: 'on-demand', formats: [] });
    }, { probeId, staleId });
    assert.equal(await seed.evaluate(staleMeta, staleId), true);
    // Clear storage from a same-origin page that runs no app code.
    await seed.goto(`${origin}/catalog/tools/index.slim.json`);
    await seed.evaluate(() => window.localStorage.clear());
    await seed.close();

    // Visit 2: the cold first run under test.
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    let closedAt = Infinity;
    const housekeeping: Array<{ url: string; at: number }> = [];
    const prefetchOnly = /\/catalog\/assets\/lolly\/(?:logo\/(?:reverse|mono|mono-reverse)|demo\/(?:lolly-spin|app-screenshot))\.svg$/;
    page.on('request', request => {
      const url = request.url();
      if (prefetchOnly.test(url) || url.endsWith('/src/lib/offline-manager.ts')) housekeeping.push({ url, at: Date.now() });
    });
    await page.goto(`${origin}/#/`, { waitUntil: 'domcontentloaded' });
    const dialog = page.locator('.welcome-dialog');
    await dialog.waitFor();

    // Behind the open dialog: the full tool index with the installed tool merged in,
    // painted into the gallery.
    await page.waitForFunction((id) => {
      const tools = window.__toolIndex?.tools ?? [];
      return tools.length > 1 && tools.some(tool => tool.id === id);
    }, probeId, { timeout: 60_000 });
    await page.locator(`.gtile[data-tool-id="${probeId}"]`).waitFor({ state: 'attached', timeout: 60_000 });
    const painted = await page.evaluate(() => ({
      tiles: document.querySelectorAll('.gtile[data-tool-id]').length,
      listed: (window.__toolIndex?.tools ?? []).filter(tool => tool.listed !== false).length,
      slimOnly: !window.__toolIndex,
    }));
    assert.equal(painted.slimOnly, false);
    assert.ok(painted.tiles > 20, `the gallery lists the catalog behind the welcome (${painted.tiles} tiles of ${painted.listed})`);

    // Give maintenance every chance to start while the dialog stays open.
    await page.waitForTimeout(4000);
    assert.equal(await dialog.count(), 1, 'the welcome is still open');
    assert.equal(housekeeping.length, 0, `no offline cache work or core prefetch behind the welcome: ${JSON.stringify(housekeeping)}`);
    assert.equal(await page.evaluate(staleMeta, staleId), true, 'the stale-asset prune has not run behind the welcome');

    closedAt = Date.now();
    await page.locator('.welcome-dialog [data-choice="explore"]').click();
    await dialog.waitFor({ state: 'detached' });
    await page.waitForFunction(async (id) => {
      const { openDB } = await import('/src/bridge/db.ts' as string);
      return !await (await openDB()).get('asset-meta', id);
    }, staleId, { timeout: 60_000, polling: 250 });
    // The request log, not Resource Timing: a dev shell's module requests fill that buffer.
    for (const deadline = Date.now() + 90_000; !housekeeping.some(entry => prefetchOnly.test(entry.url));) {
      assert.ok(Date.now() < deadline, `the core prefetch never started after the welcome closed (${JSON.stringify(housekeeping)})`);
      await page.waitForTimeout(250);
    }
    assert.ok(housekeeping.every(entry => entry.at >= closedAt), 'housekeeping starts after the welcome closes');
    assert.equal(await page.locator(`.gtile[data-tool-id="${probeId}"]`).count(), 1, 'the installed tool is still listed');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

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
    await page.goto(`${origin}/#/`, { waitUntil: 'networkidle' }); await shellSettled(page);
    const design = page.locator('.gtile[data-tool-id="design"]');
    await design.locator('.gcar-slide.is-loaded').first().waitFor({ timeout: 60_000 });
    const cover = design.locator('.gcar-img').first();
    assert.ok((await cover.getAttribute('src'))?.startsWith('data:image/'));
    assert.equal(await design.locator('.gcar-open').first().getAttribute('href'), '#/tool/design?template=brand-starter');
    assert.deepEqual(await cover.evaluate(i => [(i as HTMLImageElement).naturalWidth, (i as HTMLImageElement).naturalHeight]), [1920, 1080]);
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
      const hostTokensColors = host.tokens.colors.bind(host.tokens);
      let primary = '#b83a74';
      const resolve = (ref: string) => ref.replace(/[{}]/g, '') === 'color.semantic.primary' ? primary : original.resolve(ref);
      const records = new Map();
      let writes = 0;
      host.tokens = {
        ...host.tokens,
        active: async () => ({ id: 'preview-palette-test' }),
        get: async () => ({ ...original, query: () => original.query().map((e: { path: string }) => e.path === 'color.semantic.primary' ? { ...e, value: primary } : e), resolve }),
        resolve: async (ref: string) => resolve(ref),
        colors: async () => (await hostTokensColors()).map((color: { ref?: string }) => color.ref === '{color.semantic.primary}' ? { ...color, value: primary, faces: undefined } : color),
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

test('transparent covers switch ink and open targets with the live gallery theme', {
  skip: origin ? false : 'set LOLLY_GALLERY_TEST_URL to a local Vite shell', timeout: 120_000,
}, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' });
  try {
    await page.route('**/catalog/tools/index*.json', async route => {
      const response = await route.fetch();
      const data = await response.json();
      if (Array.isArray(data.tools)) data.tools = data.tools.filter((tool: { id: string }) => ['wordmark', 'snippet'].includes(tool.id));
      data.defaultHiddenTools = [];
      await route.fulfill({ response, json: data });
    });
    await page.addInitScript(() => {
      for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack', 'lolly-capture-neutral']) localStorage.setItem(key, '1');
    });
    await page.goto(`${origin}/?theme=light#/`, { waitUntil: 'domcontentloaded' });
    const sources = new Map<string, string>();
    for (const theme of ['light', 'dark', 'brand', 'light']) {
      await page.evaluate(async theme => {
        const themePath = '/src/theme.ts';
        const { applyTheme } = await import(themePath);
        applyTheme(theme, false);
      }, theme);
      const expected = `#/tool/wordmark?template=brand-starter${theme === 'light' ? '' : '-dark'}`;
      await page.waitForFunction(href => document.querySelector('.gtile[data-tool-id="wordmark"] .gcar-open')?.getAttribute('href') === href, expected);
      const reveal = page.getByRole('button', { name: /^Show hidden tools/ });
      if (await reveal.isVisible()) await reveal.click();
      const tile = page.locator('.gtile[data-tool-id="wordmark"]');
      const img = tile.locator('.gcar-img').first();
      await tile.locator('.gcar-slide.is-loaded').first().waitFor();
      assert.equal(await img.evaluate(i => i.style.backgroundColor), '', 'transparency is not replaced by a backing panel');
      const src = await img.getAttribute('src');
      assert.ok(src);
      if (sources.has(theme)) assert.equal(src, sources.get(theme));
      sources.set(theme, src);
    }
    assert.notEqual(sources.get('light'), sources.get('dark'));
    assert.equal(sources.get('dark'), sources.get('brand'));
  } finally { await browser.close(); }
});
