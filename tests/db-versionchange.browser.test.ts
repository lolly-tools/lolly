// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import test, { type TestContext } from 'node:test';
import { build } from 'esbuild';
import { chromium, type Page } from 'playwright';

interface DatabaseFixture {
  hold(): Promise<boolean>;
  seed(): Promise<void>;
  refused(): Promise<string[]>;
  showError(): void;
}

declare global {
  interface Window { databaseFixture: DatabaseFixture }
}

const bundle = build({
  stdin: { resolveDir: new URL('..', import.meta.url).pathname, loader: 'ts', contents: `
    import { openDB, openUnsharedDB } from './shells/web/src/bridge/db.ts';
    import { showBootError } from './shells/web/src/lib/boot-error.ts';
    let cached;
    window.databaseFixture = {
      async hold() { cached = await openDB(); return cached === await openDB(); },
      async seed() {
        await cached.put('state', { slot: 'draft', toolId: 'design', updatedAt: 1, data: { text: 'Saved work' } });
        await cached.put('profile', { firstname: 'Ada' }, 'me');
        await cached.put('user-assets', { id: 'headshot', bytes: new Uint8Array([1, 2, 3]) });
      },
      async refused() {
        const codes = [];
        try { cached.transaction('state'); } catch (error) { codes.push(error.code); }
        for (const open of [openDB, openUnsharedDB]) {
          try { await open(); } catch (error) { codes.push(error.code); }
        }
        return codes;
      },
      showError() { showBootError(Object.assign(new Error('Update required'), { code: 'DB_UPDATE_REQUIRED' })); },
    };
  ` }, bundle: true, write: false, platform: 'browser', format: 'iife', loader: { '.css': 'empty' },
  define: { 'import.meta.env': '{}' }, logLevel: 'silent',
});

async function fixture(t: TestContext): Promise<{ page: Page; sibling: Page; upgrader: Page }> {
  const server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><div id="view"><textarea id="draft">Unsaved edit</textarea></div>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const context = await browser.newContext();
  const pages = await Promise.all([context.newPage(), context.newPage(), context.newPage()]);
  const content = (await bundle).outputFiles[0]!.text;
  for (const page of pages) {
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page.addScriptTag({ content });
  }
  return { page: pages[0]!, sibling: pages[1]!, upgrader: pages[2]! };
}

test('A newer IndexedDB version closes every old tab without clearing its work or reopening a cached handle', {
  skip: existsSync(chromium.executablePath()) ? false : 'Install Playwright Chromium.', timeout: 60_000,
}, async t => {
  const { page, sibling, upgrader } = await fixture(t);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  sibling.on('pageerror', error => errors.push(error.message));
  for (const holder of [page, sibling]) {
    assert.equal(await holder.evaluate(() => window.databaseFixture.hold()), true);
    await holder.locator('#draft').fill('Unsaved work kept through the upgrade');
  }
  await page.evaluate(() => window.databaseFixture.seed());
  const originalUrl = page.url();
  const records = await upgrader.evaluate(() => new Promise<{ version: number; work: unknown; profile: unknown; asset: number[] }>((resolve, reject) => {
    const request = indexedDB.open('lolly', 26);
    const deadline = setTimeout(() => reject(new Error('The old tabs did not release the upgrade.')), 3000);
    request.onerror = () => { clearTimeout(deadline); reject(request.error); };
    request.onupgradeneeded = () => request.result.createObjectStore('future-cache');
    request.onsuccess = () => {
      clearTimeout(deadline);
      const db = request.result;
      const tx = db.transaction(['state', 'profile', 'user-assets']);
      const work = tx.objectStore('state').get('draft');
      const profile = tx.objectStore('profile').get('me');
      const asset = tx.objectStore('user-assets').get('headshot');
      tx.oncomplete = () => {
        resolve({ version: db.version, work: work.result, profile: profile.result, asset: [...asset.result.bytes] });
        db.close();
      };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  }));
  assert.deepEqual(records, {
    version: 26, work: { slot: 'draft', toolId: 'design', updatedAt: 1, data: { text: 'Saved work' } },
    profile: { firstname: 'Ada' }, asset: [1, 2, 3],
  });
  for (const holder of [page, sibling]) {
    await holder.locator('[data-database-update-required]').waitFor();
    assert.deepEqual(await holder.evaluate(() => window.databaseFixture.refused()),
      ['DB_UPDATE_REQUIRED', 'DB_UPDATE_REQUIRED', 'DB_UPDATE_REQUIRED']);
    await holder.evaluate(() => {
      window.databaseFixture.showError();
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await holder.locator('[data-database-update-required]').count(), 1);
    assert.match(await holder.locator('[role="alert"]').innerText(), /Saving on this device has stopped/);
    assert.match(await holder.locator('[role="alert"]').innerText(), /Save shared work or keep a recovery copy/);
    assert.equal(await holder.locator('#draft').inputValue(), 'Unsaved work kept through the upgrade');
    assert.equal(holder.url(), originalUrl);
  }
  assert.deepEqual(errors, []);
});

test('The database update Reload button respects an existing unsaved-work beforeunload guard', {
  skip: existsSync(chromium.executablePath()) ? false : 'Install Playwright Chromium.', timeout: 60_000,
}, async t => {
  const { page } = await fixture(t);
  await page.locator('#draft').fill('Keep this unsaved edit');
  await page.evaluate(() => {
    window.addEventListener('beforeunload', event => { event.preventDefault(); event.returnValue = ''; });
    window.databaseFixture.showError();
  });
  const dialog = page.waitForEvent('dialog');
  const clicking = page.getByRole('button', { name: 'Reload', exact: true }).click({ noWaitAfter: true });
  const warning = await dialog;
  assert.equal(warning.type(), 'beforeunload');
  await warning.dismiss();
  await clicking;
  assert.equal(await page.locator('#draft').inputValue(), 'Keep this unsaved edit');
  assert.equal(await page.locator('[data-database-update-required]').count(), 1);
});
