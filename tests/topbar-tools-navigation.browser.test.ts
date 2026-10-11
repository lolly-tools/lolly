// SPDX-License-Identifier: MPL-2.0
/** Tools must leave a retained document pathname without opening that document. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import type { ViteDevServer } from 'vite';
import { shellSettled } from './helpers/shell-settled.ts';

interface NavigationGuard { armed: boolean; stateWrites: number; toolMounted: boolean }
declare global {
  interface Window { toolsNavigationGuard: NavigationGuard }
}

test('native and Jelly Tools tabs leave Assets and Projects for the gallery without creating a session', { timeout: 180_000 }, async t => {
  let server: ViteDevServer | undefined;
  t.after(async () => { await server?.close(); });
  let origin = process.env.LOLLY_IMPORT_TEST_URL;
  if (!origin) {
    const { createServer } = await import('vite');
    server = await createServer({ root: fileURLToPath(new URL('../shells/web', import.meta.url)), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
    await server.listen();
    origin = server.resolvedUrls!.local[0]!;
  }
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'darwin' ? { channel: 'chrome' } : {}) });
  t.after(async () => { await browser.close(); });
  for (const animated of [false, true]) {
    for (const from of ['a', 'p'] as const) {
      await t.test(`${animated ? 'Jelly' : 'Native'} ${from === 'a' ? 'Assets' : 'Projects'} to Tools`, async () => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
        try {
          const page = await context.newPage();
          const sessionRequests: string[] = [];
          page.on('request', request => {
            if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method()) && /\/api\/.*(?:sessions|documents)(?:\/|$)/.test(new URL(request.url()).pathname)) sessionRequests.push(request.method());
          });
          await page.addInitScript(() => {
            for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
            window.toolsNavigationGuard = { armed: false, stateWrites: 0, toolMounted: false };
            const put = IDBObjectStore.prototype.put, add = IDBObjectStore.prototype.add;
            IDBObjectStore.prototype.put = function (...args) {
              if (this.name === 'state' && window.toolsNavigationGuard.armed) window.toolsNavigationGuard.stateWrites++;
              return put.apply(this, args);
            };
            IDBObjectStore.prototype.add = function (...args) {
              if (this.name === 'state' && window.toolsNavigationGuard.armed) window.toolsNavigationGuard.stateWrites++;
              return add.apply(this, args);
            };
            new MutationObserver(() => {
              if (window.toolsNavigationGuard.armed && document.querySelector('#view.tool-view')) window.toolsNavigationGuard.toolMounted = true;
            }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
          });
          // Browse tabs can sit over a canonical tool pathname after leaving an editor.
          const pathname = animated ? '/t/qr-code' : '/design';
          await page.goto(`${origin}${pathname}?retained=document#/${from}`, { waitUntil: 'domcontentloaded' });
          await page.locator(`#view.${from === 'a' ? 'catalog' : 'projects'}-view .view-toggle`).waitFor();
          await shellSettled(page);
          const before = await page.evaluate(async ({ animated, from }) => {
            const dbModule = '/src/bridge/db.ts', homeModule = '/src/lib/home-destination.ts';
            const db = await (await import(dbModule)).openDB();
            (await import(homeModule)).setHomeDestination('projects');
            if (animated) {
              const flagsModule = '/src/feature-flags.ts', jellyModule = '/src/lib/jelly.ts', toggleModule = '/src/components/view-toggle.ts';
              (await import(flagsModule)).setFlagMirror('jelly-effects', true);
              await (await import(jellyModule)).ensureJelly(true);
              (await import(toggleModule)).syncJellyNavToggle(from === 'a' ? 'catalog' : 'projects');
            }
            const keys = await db.getAllKeys('state');
            window.toolsNavigationGuard.armed = true;
            return keys;
          }, { animated, from });
          if (animated) await page.locator('.jelly-nav-wrap jelly-segmented').getByRole('radio', { name: 'Tools', exact: true }).click();
          else await page.locator('#view .view-toggle [data-vt="tools"]').click();
          await page.waitForFunction(() => location.hash === '#/tools' || !!document.querySelector('#view.tool-view'));
          assert.equal(new URL(page.url()).hash, '#/tools', 'Tools has its own route rather than clearing the hash onto the retained tool path');
          await page.locator('#view.gallery-view .tool-masonry .gtile[data-tool-id]').first().waitFor();
          await shellSettled(page);
          const after = await page.evaluate(async () => {
            const module = '/src/bridge/db.ts', db = await (await import(module)).openDB();
            await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            return { keys: await db.getAllKeys('state'), guard: window.toolsNavigationGuard };
          });
          assert.deepEqual(after.keys, before, 'navigation creates no saved document');
          assert.equal(after.guard.stateWrites, 0, 'no document state is written during navigation');
          assert.equal(after.guard.toolMounted, false, 'no editor briefly mounts on the way to Tools');
          assert.deepEqual(sessionRequests, [], 'navigation creates no remote session');
        } finally { await context.close(); }
      });
    }
  }
});
