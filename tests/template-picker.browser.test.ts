// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';

const origin = process.env.LOLLY_IMPORT_TEST_URL;

/** The Navigation API fields the reload guard reads. TypeScript's DOM lib does not
 *  declare the API yet, and the suite only runs in Chromium, which ships it. */
type HistoryPosition = { navigation: { currentEntry: { index: number } | null; transition: unknown } };

test('the Projects template picker renders previews and adds independent creations without changing the template', {
  skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 120_000,
}, async (ctx) => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await context.addInitScript(() => {
    for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
  });
  try {
    await page.goto(`${origin}/#/p`, { waitUntil: 'networkidle' });
    const id = await page.evaluate(async () => {
      const bridgePath = '/src/bridge/index.ts', storePath = '/src/lib/user-templates.ts';
      const { createBridge } = await import(bridgePath);
      const { createUserTemplateStore } = await import(storePath);
      const store = createUserTemplateStore(await createBridge());
      const template = await store.save({ toolId: 'qr-code', name: 'Company QR', values: { url: 'https://example.org/company' } });
      return template.id;
    });
    await page.reload({ waitUntil: 'networkidle' });
    // The picker is a modal, and a modal pushes one same-URL history entry for system
    // Back when it opens (lib/overlay-back.ts). Closing it pops that entry again with a
    // history.back() one task later. A reload issued before that pop finishes is
    // cancelled by it (net::ERR_ABORTED), so record the current history index and
    // reload only after the close has returned to it.
    const historyBefore = await page.evaluate(() => (window as unknown as HistoryPosition).navigation.currentEntry?.index);
    assert.equal(typeof historyBefore, 'number');
    await page.locator('[data-create-btn="tool"]').click();
    await page.getByRole('tab', { name: /^Templates/ }).click();
    const card = page.locator(`[data-template-ref="user:${id}"]`);
    const preview = card.locator('img[data-tpl-preview]');
    await page.waitForFunction(ref => document.querySelector(`[data-template-ref="${ref}"] img`)?.getAttribute('data-preview-state') === 'ready', `user:${id}`, { timeout: 60_000 });
    assert.equal(await preview.isVisible(), true);
    const thumb = await preview.getAttribute('src');
    assert.ok(thumb?.startsWith('data:image/'));
    await page.locator('.asset-picker-search').fill('Company QR');
    await preview.waitFor({ state: 'visible' });
    await page.locator(`[data-quickadd-template="user:${id}"]`).click();
    await page.waitForFunction(async () => {
      const path = '/src/bridge/index.ts';
      const host = await (await import(path)).createBridge();
      return (await host.state.list()).filter((row: { toolId?: string }) => row.toolId === 'qr-code').length === 1;
    }, undefined, { polling: 250 });
    assert.equal(await page.locator('.asset-picker-panel').isVisible(), true);
    await page.locator(`[data-quickadd-template="user:${id}"]`).click();
    await page.waitForFunction(async () => {
      const path = '/src/bridge/index.ts';
      const host = await (await import(path)).createBridge();
      return (await host.state.list()).filter((row: { toolId?: string }) => row.toolId === 'qr-code').length === 2;
    }, undefined, { polling: 250 });
    await page.keyboard.press('Escape');
    await page.locator('.asset-picker-panel').waitFor({ state: 'detached' });
    await page.waitForFunction((index) => {
      const { navigation } = window as unknown as HistoryPosition;
      return navigation.currentEntry?.index === index && !navigation.transition;
    }, historyBefore);
    await page.reload({ waitUntil: 'networkidle' });
    const saved = await page.evaluate(async (id) => {
      const path = '/src/bridge/index.ts';
      const host = await (await import(path)).createBridge();
      const rows = (await host.state.list()).filter((row: { toolId?: string }) => row.toolId === 'qr-code');
      const values = await Promise.all(rows.map((row: { slot: string }) => host.state.load(row.slot)));
      return { rows, values, template: (await host.profile.get()).userTemplates.find((entry: { id: string }) => entry.id === id) };
    }, id);
    assert.equal(saved.rows.length, 2);
    assert.equal(new Set(saved.rows.map((row: { slot: string }) => row.slot)).size, 2);
    assert.ok(saved.values.every((value: { url: string }) => value.url === 'https://example.org/company'));
    assert.deepEqual(saved.template.values, { url: 'https://example.org/company' });
  } catch (error) {
    ctx.diagnostic(JSON.stringify({ url: page.url(), text: (await page.locator('body').innerText()).slice(-1800) }));
    throw error;
  } finally { await context.close(); await closeBrowser(); }
});

test('template Open edits, saves and returns to its originating Projects folder or root', {
  skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 120_000,
}, async (ctx) => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await getBrowser();
  try {
    for (const folder of [false, true]) {
      const context = await browser.newContext({ viewport: folder ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      try {
        await page.addInitScript((dark) => {
          for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
          localStorage.setItem('theme', dark ? 'dark' : 'light');
          localStorage.setItem('lolly-a11y', JSON.stringify({ largeText: true, reduceMotion: true }));
        }, folder);
        await page.goto(`${origin}/#/p`, { waitUntil: 'networkidle' });
        const seed = await page.evaluate(async () => {
          const bridgePath = '/src/bridge/index.ts', storePath = '/src/lib/user-templates.ts', foldersPath = '/src/folders.ts';
          const host = await (await import(bridgePath)).createBridge();
          await host.profile.set({ ...(await host.profile.get()), a11y: { largeText: true, reduceMotion: true } });
          const template = await (await import(storePath)).createUserTemplateStore(host).save({ toolId: 'qr-code', name: 'Company link', values: { url: 'https://example.org/original' } });
          const folder = await (await import(foldersPath)).createFolderStore(host).create('Launch');
          return { template: template.id, folder: folder.id };
        });
        const route = `${origin}/#/p${folder ? `/${seed.folder}` : ''}`;
        await page.goto(route, { waitUntil: 'networkidle' });
        await page.reload({ waitUntil: 'networkidle' });
        assert.equal(await page.locator('html').getAttribute('data-a11y-text'), 'large');
        const create = page.locator('[data-create-btn="tool"]').first();
        for (const mode of ['list', 'preview']) {
          await page.locator('.projects-viewopts').click();
          await page.locator(`[data-vm="${mode}"]`).click();
          // View options stays open after a choice (views/projects-view-options.ts), so
          // close it before checking the layout underneath and reopening it.
          await page.keyboard.press('Escape');
          await page.locator('.projects-viewmenu').waitFor({ state: 'detached' });
          assert.equal(await create.isVisible(), true);
          assert.ok(await create.evaluate(el => el.getBoundingClientRect().bottom < innerHeight));
          assert.equal(await page.locator('[data-create-btn="folder"]').first().isVisible(), true);
        }
        const beforeRefresh = await create.elementHandle();
        await create.click();
        await page.locator('.asset-picker-panel').waitFor();
        await page.keyboard.press('Escape');
        await page.locator('.asset-picker-panel').waitFor({ state: 'detached' });
        await page.waitForFunction(el => !el?.isConnected, beforeRefresh);
        await page.waitForFunction(() => document.activeElement === document.querySelector('[data-create-btn="tool"]'));
        assert.equal(await create.evaluate(el => el === document.activeElement), true);
        await create.focus();
        await page.keyboard.press('Enter');
        await page.getByRole('tab', { name: /^Templates/ }).focus();
        await page.keyboard.press('Enter');
        const card = page.locator(`[data-template-ref="user:${seed.template}"]`);
        await card.focus();
        await page.keyboard.press('Enter');
        await page.waitForURL(/#\/tool\/qr-code/);
        const input = page.getByRole('textbox', { name: 'URL', exact: true });
        await input.waitFor();
        assert.equal(await input.inputValue(), 'https://example.org/original');
        await input.fill('https://example.org/edited');
        await input.press('Tab');
        await page.locator('#render-fab').click();
        await page.locator('[data-action="save"]').click();
        await page.waitForURL(route);
        const result = await page.evaluate(async (seed) => {
          const path = '/src/bridge/index.ts';
          const host = await (await import(path)).createBridge();
          const rows = (await host.state.list()).filter((row: { toolId?: string }) => row.toolId === 'qr-code');
          const profile = await host.profile.get();
          return { rows, value: await host.state.load(rows[0]?.slot), folder: profile.folders.find((entry: { id: string }) => entry.id === seed.folder), template: profile.userTemplates.find((entry: { id: string }) => entry.id === seed.template) };
        }, seed);
        assert.equal(result.rows.length, 1);
        assert.equal(result.value.url, 'https://example.org/edited');
        assert.deepEqual(result.template.values, { url: 'https://example.org/original' });
        assert.equal(result.folder.items.some((item: { ref: string }) => item.ref === result.rows[0].slot), folder);
      } catch (error) {
        ctx.diagnostic(JSON.stringify({ folder, url: page.url(), text: (await page.locator('body').innerText()).slice(-1800) }));
        throw error;
      } finally { await context.close(); }
    }
  } finally { await closeBrowser(); }
});
