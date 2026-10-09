// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Page } from 'playwright-core';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';

const origin = process.env.LOLLY_IMPORT_TEST_URL;
const viewOptions = {
  gallery: { button: '.gallery-viewopts', panel: '#filter-popover', hook: 'data-layout-mode' },
  projects: { button: '.projects-viewopts', panel: '.projects-viewmenu', hook: 'data-vm' },
  assets: { button: '.cat-viewopts-btn', panel: '.cat-viewopts', hook: 'data-catlayout' },
} as const;
type BrowseView = keyof typeof viewOptions;

async function openLayoutOptions(page: Page, view: BrowseView) {
  const { button, panel: selector, hook } = viewOptions[view];
  const panel = page.locator(selector);
  if (!(await panel.isVisible())) await page.locator(button).click();
  await panel.waitFor({ state: 'visible' });
  const controls = panel.locator(`[${hook}]`);
  assert.equal(await controls.count(), 3, 'View options offers Grid, Card and List');
  assert.equal(await page.locator(`[${hook}]`).count(), 3, 'only one set of layout choices exists');
  assert.equal(await page.locator('.gallery-topright > .view-seg--layout').count(), 0, 'the toolbar has no duplicate layout choices');
  return { panel, controls, hook };
}

async function chooseLayout(page: Page, view: BrowseView, mode: string): Promise<void> {
  const { panel, hook } = await openLayoutOptions(page, view);
  const control = panel.locator(`[${hook}="${mode}"]`);
  await control.click();
  assert.equal(await control.getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Escape');
  await panel.waitFor({ state: 'hidden' });
}
test('visible Grid/Card/List choices reflow real browse views without losing previews, selection or actions', {
  skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 180_000,
}, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await getBrowser();
  try {
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, hasTouch: mobile, reducedMotion: 'reduce', serviceWorkers: 'block' });
      try {
        const page = await context.newPage();
        await page.addInitScript(() => { for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack', 'lolly-personalize-dismissed']) localStorage.setItem(key, '1'); });
        await page.goto(`${origin}/#/`, { waitUntil: 'networkidle' });
        await page.locator('.tool-masonry > .gtile').first().waitFor();
        // Seed through the real browser bridge: the views still read their ordinary stores.
        await page.evaluate(async () => {
          const { createBridge } = await import('/src/bridge/index.ts' as string);
          const { createFolderStore } = await import('/src/folders.ts' as string);
          const host = await createBridge();
          await host.state.save('layout-session', { __toolId: 'qr-code', __toolVersion: '1.0.0', __label: 'Layout session', text: 'Layout test' }, 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"><rect width="64" height="48" fill="#30a46c"/></svg>'));
          const folder = await createFolderStore(host).create('Layout folder');
          await createFolderStore(host).create('Nested folder', folder.id);
          const profile = await host.profile.get();
          profile.favouriteProjects = [folder.id, 'layout-session'];
          await host.profile.set?.(profile);
          await host.assets._importUserAsset({ id: 'user/vector/1791536400000-layout', type: 'vector', format: 'svg', width: 64, height: 48,
            blob: new Blob(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"><rect width="64" height="48" fill="#30a46c"/></svg>'], { type: 'image/svg+xml' }), meta: { name: 'Layout asset', bytes: 144, addedAt: Date.now(), modifiedAt: Date.now() } });
        });
        for (const surface of [
          { href: '#/', container: '.tool-masonry', tile: '.gtile', view: 'gallery' },
          { href: '#/u', container: '.tool-masonry', tile: '.gtile', view: 'gallery' },
          { href: '#/p', container: '.projects-grid', tile: '.folder-tile[data-ref="layout-session"]', view: 'projects' },
          { href: '#/a', container: '.catalog', tile: '.cat-tile[data-id="user/vector/1791536400000-layout"]', view: 'assets' },
        ] as const) {
          await page.goto(`${origin}/${surface.href}`, { waitUntil: 'networkidle' });
          await page.locator(viewOptions[surface.view].button).waitFor();
          const { panel, controls } = await openLayoutOptions(page, surface.view);
          for (const control of await controls.all()) {
            assert.equal(await control.isVisible(), true);
            assert.ok((await control.textContent())?.trim(), 'each choice has a visible name');
            const rect = await control.boundingBox(); assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= (mobile ? 390 : 1440), `${surface.href} control fits`);
          }
          await page.keyboard.press('Escape'); await panel.waitFor({ state: 'hidden' });
          const container = page.locator(surface.container).first();
          if (surface.href === '#/p') {
            const favourite = page.locator('[data-fav-strip]');
            await favourite.waitFor();
            await favourite.evaluate(el => { (window as unknown as { layoutFavourite: Element }).layoutFavourite = el; });
            assert.equal(await favourite.isVisible(), true, 'Grid shows the starred projects');
          }
          const tile = surface.href.startsWith('#/p') || surface.href === '#/a' ? page.locator(`${surface.container} ${surface.tile}`).first() : page.locator(`${surface.container} > ${surface.tile}:not(.is-filtered)`).first();
          await tile.waitFor();
          await tile.hover();
          const check = tile.locator('.tile-check, .cat-check'); await check.click({ force: true });
          assert.equal(await check.getAttribute('aria-pressed'), 'true');
          await tile.evaluate(el => { (window as unknown as { layoutNode: Element; layoutPreview: Element | null }).layoutNode = el; (window as unknown as { layoutPreview: Element | null }).layoutPreview = el.querySelector('img, .gcar, .tile-figure, .cat-tile-fig'); });
          const gridRect = await tile.boundingBox(); assert.ok(gridRect);
          for (const mode of ['card', 'list', 'grid']) {
            await chooseLayout(page, surface.view, mode);
            assert.equal(await container.getAttribute('data-browse-layout'), mode === 'grid' ? null : mode);
            assert.equal(await check.getAttribute('aria-pressed'), 'true', 'selection survives the layout switch');
            if (surface.href === '#/p') {
              const favourite = page.locator('[data-fav-strip]');
              assert.equal(await favourite.isVisible(), mode === 'grid', 'the favourites strip is visible only in Grid');
              assert.equal(await favourite.evaluate(el => (window as unknown as { layoutFavourite: Element }).layoutFavourite === el), true, 'returning to Grid restores the same favourites strip');
            }
            assert.equal(await tile.evaluate(el => {
              const state = window as unknown as { layoutNode: Element; layoutPreview: Element | null };
              return state.layoutNode === el && state.layoutPreview === el.querySelector('img, .gcar, .tile-figure, .cat-tile-fig');
            }), true, 'the same tile and preview remain mounted');
            const rect = await tile.boundingBox(); assert.ok(rect && rect.height > 0 && rect.width > 0);
            if (mode === 'card') assert.ok(rect.height < gridRect.height, `${surface.href} Card really becomes a shorter sideways card`);
            if (mode === 'list') assert.ok(rect.width > gridRect.width || mobile, `${surface.href} List uses the available row width`);
            await check.focus(); assert.equal(await check.evaluate(el => el === document.activeElement), true);
            if (surface.href === '#/p') assert.equal(await tile.locator('.tile-menu-btn').count(), 1, 'the existing menu stays available');
          }
          await chooseLayout(page, surface.view, 'list');
          await page.evaluate(() => { document.documentElement.dataset.a11yText = 'large'; document.documentElement.dataset.a11yPreviews = 'hidden'; });
          const rect = await tile.boundingBox(); assert.ok(rect && rect.width > 0 && rect.height > 0);
          assert.equal(await check.getAttribute('aria-pressed'), 'true');
          await page.evaluate(() => { delete document.documentElement.dataset.a11yText; delete document.documentElement.dataset.a11yPreviews; });
        }
        // A new local folder is still reachable in each mode and keeps a distinct preference.
        await page.goto(`${origin}/#/p`, { waitUntil: 'networkidle' });
        await chooseLayout(page, 'projects', 'card');
        const folderLink = page.locator('.folder-tile--folder .tile-primary').filter({ hasText: 'Layout folder' });
        await folderLink.click(); await page.locator('.projects-title').waitFor();
        assert.equal(await page.locator('[data-fav-strip]').count(), 0, 'a folder does not mount the root favourites strip');
        await chooseLayout(page, 'projects', 'list');
        assert.equal(await page.locator('.folder-tile--folder').filter({ hasText: 'Nested folder' }).count(), 1);
        await page.locator('.projects-back').click();
        const { panel, controls } = await openLayoutOptions(page, 'projects');
        assert.equal(await controls.filter({ hasText: 'Card' }).getAttribute('aria-pressed'), 'true');
        await page.keyboard.press('Escape'); await panel.waitFor({ state: 'hidden' });
      } finally { await context.close(); }
    }
  } finally { await closeBrowser(); }
});

test('shared project layouts preserve their own selection, presence and folder actions', {
  skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 90_000,
}, async () => {
  const browser = await getBrowser(), context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => { for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1'); });
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname;
      const data = path.endsWith('/folders') ? { folders: [{ id: 'fld_layout', projectId: 'prj_layout', name: 'Shared subfolder', parentId: null, items: [], createdAt: '2026-10-09T00:00:00Z', updatedAt: '2026-10-09T00:00:00Z' }] }
        : path.endsWith('/presence') ? { sessions: [{ sessionId: 'ses_layout', peers: [{ id: 'peer-layout', name: 'Ravan', color: '#008c7a' }] }] } : null;
      await route.fulfill({ status: data ? 200 : 404, contentType: 'application/json', body: JSON.stringify(data ?? {}) });
    });
    await page.goto(`${origin}/#/p`, { waitUntil: 'networkidle' });
    await page.locator('.projects-viewopts').waitFor();
    await page.evaluate(async () => {
      const { registerSessionSource } = await import('/src/lib/session-source.ts' as string);
      registerSessionSource({ label: 'Shared layout workspace', listProjects: async () => [{ id: 'prj_layout', name: 'Shared layout project', myRole: 'editor', sessionCount: 1 }],
        listSessions: async () => [{ id: 'ses_layout', toolId: 'qr-code', label: 'Shared layout session', updatedAt: '2026-10-09T00:00:00Z' }], fetchSession: async () => null });
      location.hash = '#/p?team=prj_layout';
    });
    const tile = page.locator('[data-shared-folder] .folder-tile[data-ref="ses_layout"]');
    await tile.waitFor();
    await tile.locator('.collab-tile-badge').waitFor();
    await tile.hover(); await tile.locator('.tile-check').click({ force: true });
    await tile.evaluate(el => { (window as unknown as { sharedLayoutNode: Element }).sharedLayoutNode = el; });
    for (const mode of ['card', 'list', 'grid']) {
      await chooseLayout(page, 'projects', mode);
      assert.equal(await tile.evaluate(el => (window as unknown as { sharedLayoutNode: Element }).sharedLayoutNode === el), true);
      assert.equal(await tile.locator('.tile-check').getAttribute('aria-pressed'), 'true');
      assert.equal(await tile.locator('.collab-tile-avatar[title="Ravan"]').count(), 1, 'the collaborator remains visible');
      assert.equal(await page.locator('[data-shared-folder] .projects-bulkbar:not([hidden])').count(), 1);
      const move = page.locator('[data-shared-folder] [data-bulk="move"]'); assert.equal(await move.isVisible(), true);
      assert.equal(await page.locator('[data-shared-folder] .folder-tile').filter({ hasText: 'Shared subfolder' }).count(), 1);
    }
    await tile.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Rename', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await chooseLayout(page, 'projects', 'card');
    await page.locator('[data-shared-folder] .folder-tile').filter({ hasText: 'Shared subfolder' }).locator('.tile-primary').click();
    await page.waitForFunction(() => new URLSearchParams(location.hash.split('?')[1]).get('folder') === 'fld_layout');
    await chooseLayout(page, 'projects', 'list');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('lolly:projectsViewPrefs') || '{}')['team:prj_layout:fld_layout']?.v), 'list');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('lolly:projectsViewPrefs') || '{}')['team:prj_layout:']?.v), 'card');
  } finally { await context.close(); await closeBrowser(); }
});

test('Assets List continues a large upload page without rebuilding selected previews or losing search results', {
  skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 90_000,
}, async () => {
  const browser = await getBrowser(), context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => { for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1'); });
    await page.goto(`${origin}/#/p`, { waitUntil: 'networkidle' });
    await page.locator('.projects-viewopts').waitFor();
    await page.evaluate(async () => {
      const { openDB } = await import('/src/bridge/db.ts' as string), db = await openDB();
      for (let i = 0; i < 135; i++) await db.put('user-assets', { id: `user/vector/1791536400000-page-${i}`, type: 'vector', format: 'svg', width: 64, height: 48,
        blob: new Blob(['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 48"><rect width="64" height="48" fill="#30a46c"/></svg>'], { type: 'image/svg+xml' }), meta: { name: `Layout page ${i}`, bytes: 144, modifiedAt: Date.now() } });
    });
    await page.goto(`${origin}/#/a`, { waitUntil: 'networkidle' });
    const selected = page.locator('.cat-tile[data-id^="user/vector/1791536400000-page-"]').first();
    await selected.waitFor();
    await selected.hover(); await selected.locator('.cat-check').click({ force: true });
    await selected.evaluate(el => { (window as unknown as { pagedLayoutNode: Element }).pagedLayoutNode = el; });
    await chooseLayout(page, 'assets', 'list');
    const before = await page.locator('.cat-tile[data-id^="user/"]').count();
    assert.equal(before, 120, 'the first page stays bounded');
    const more = page.locator('[data-cat-more]').first(); await more.click();
    assert.equal(await page.locator('.cat-tile[data-id^="user/"]').count(), 135);
    assert.equal(await selected.evaluate(el => (window as unknown as { pagedLayoutNode: Element }).pagedLayoutNode === el), true);
    assert.equal(await selected.locator('.cat-check').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.cat-tile-details .cat-tile-detail--type').filter({ hasText: 'SVG' }).count() >= 135, true);
    await page.goto(`${origin}/#/a?q=Layout%20page%20134&layout=list`, { waitUntil: 'networkidle' });
    await page.locator('.cat-tile[data-id="user/vector/1791536400000-page-134"]').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.cat-tile[data-id^="user/"]').length === 1);
    assert.equal(await page.locator('.cat-tile[data-id^="user/"]').count(), 1, 'search still reaches the complete loaded collection');
  } finally { await context.close(); await closeBrowser(); }
});
