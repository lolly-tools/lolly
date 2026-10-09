// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';
import { chromium } from 'playwright';

declare global {
  interface Window {
    workProfileFixture: { unread(count: number): void; calls: { inbox: number; routes: string[] } };
  }
}

test('Work uses one avatar and Settings link with readable account actions and bounded icons', {
  skip: existsSync(chromium.executablePath()) ? false : 'Install Playwright Chromium.', timeout: 60_000,
}, async t => {
  const bundle = await build({
    stdin: { resolveDir: new URL('..', import.meta.url).pathname, loader: 'ts', contents: `
      import { viewTopbarHtml } from './shells/web/src/components/view-topbar.ts';
      import { attachProfileMenu } from './shells/web/src/components/profile-menu.ts';
      import { registerAccountChip } from './shells/web/src/org/account-chip.ts';
      const headshot = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" fill="#168475"/><circle cx="24" cy="18" r="9" fill="#d8ece6"/><path d="M8 48v-5a16 16 0 0 1 32 0v5" fill="#d8ece6"/></svg>');
      document.querySelector('#app').innerHTML = viewTopbarHtml({ active: 'catalog', profile: { firstname: 'Andy', headshotUrl: headshot } });
      const calls = { inbox: 0, routes: [] }, listeners = new Set();
      registerAccountChip({
        account: () => ({ workspace: 'Lolly Work', member: { name: 'Andy Fitzsimon', email: 'andy@example.test' }, inbox: {
          count: () => 2, onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }, open() { calls.inbox++; },
        } }),
        consoleUrl: () => 'https://work.test/admin', signInUrl: () => '/login',
        signOut: async () => true, signOutEverywhere: async () => 'ok', afterSignOut: () => {},
        workspaceOrigin: 'https://work.test', principal: 'fixture', host: () => null,
        go: route => calls.routes.push(route),
      });
      attachProfileMenu(document.querySelector('.profile-link'), {
        profile: { get: async () => ({}), set: async () => {} },
        state: { get: async () => null, set: async () => {} }, assets: { get: async () => null },
      });
      window.workProfileFixture = { calls, unread(count) { for (const listener of listeners) listener(count); } };
    ` }, bundle: true, write: false, platform: 'browser', format: 'iife', loader: { '.css': 'empty' },
    define: { 'import.meta.env': '{}' }, logLevel: 'silent',
  });
  const css = ['styles/tokens.css', 'styles/parts/base.css', 'styles/parts/buttons.css', 'styles/parts/components.css',
    'styles/parts/gallery.css', 'styles/parts/projects.css', 'styles/parts/topbar.css', 'styles/parts/a11y.css']
    .map(file => readFileSync(new URL(`../shells/web/src/${file}`, import.meta.url), 'utf8')).join('\n');
  const server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><html data-theme="dark"><style>${css}</style><div id="app"></div></html>`);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const browser = await chromium.launch(); t.after(() => browser.close());
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const screenshots = process.env.LOLLY_PROFILE_MENU_SCREENSHOTS;
  if (screenshots) mkdirSync(screenshots, { recursive: true });
  for (const viewport of [{ width: 1200, height: 900 }, { width: 390, height: 700 }]) {
    const page = await context.newPage();
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
    for (const scale of [1, 1.5, 2]) {
      await page.evaluate(scale => document.documentElement.style.setProperty('--a11y-fs', String(scale)), scale);
      assert.equal(await page.locator('.profile-link').count(), 1);
      assert.equal(await page.locator('.org-account-chip, [data-account-slot]').count(), 0);
      assert.equal(await page.locator('.profile-link-avatar').count(), 1);
      await page.locator('.profile-link').click();
      const menu = page.locator('.profile-menu');
      await menu.waitFor();
      assert.equal(await menu.locator('[data-act="settings"]').count(), 1);
      assert.equal(await menu.locator('[data-account-act="signins"]').count(), 0);
      assert.equal(await menu.locator('[data-account-act="console"]').innerText(), 'Admin');
      assert.equal(await menu.locator('[data-account-act="console"]').getAttribute('href'), 'https://work.test/admin');
      assert.equal(await menu.locator('[data-account-act="console"]').getAttribute('rel'), 'noopener');
      await page.evaluate(() => window.workProfileFixture.unread(7));
      assert.equal(await menu.locator('[data-inbox-count]').innerText(), '7');
      const geometry = await menu.evaluate(el => {
        const box = el.getBoundingClientRect();
        const icon = el.querySelector('[data-account-act="console"] svg')!.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: el.clientWidth,
          scrollWidth: el.scrollWidth, iconWidth: icon.width, iconHeight: icon.height };
      });
      assert.equal(geometry.iconWidth, 16 * scale);
      assert.equal(geometry.iconHeight, 16 * scale);
      assert.ok(geometry.left >= 0 && geometry.right <= viewport.width, JSON.stringify(geometry));
      assert.ok(geometry.top >= 0 && geometry.bottom <= viewport.height, JSON.stringify(geometry));
      assert.ok(geometry.scrollWidth <= geometry.width, JSON.stringify(geometry));
      await menu.locator('[data-account-act="everywhere"]').scrollIntoViewIfNeeded();
      assert.ok(await menu.locator('[data-account-act="everywhere"]').isVisible());
      if (screenshots) await page.screenshot({ path: join(screenshots, `menu-${viewport.width}-${scale}.png`) });
      await menu.locator('[data-account-act="inbox"]').click();
      assert.equal(await menu.count(), 0);
      await page.locator('.profile-link').click();
      await menu.locator('[data-account-act="projects"]').click();
      assert.equal(await menu.count(), 0);
    }
    assert.deepEqual(await page.evaluate(() => window.workProfileFixture.calls), { inbox: 3, routes: ['#/p', '#/p', '#/p'] });
    assert.deepEqual(errors, []);
    await page.close();
  }
});
