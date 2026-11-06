// SPDX-License-Identifier: MPL-2.0
/**
 * An emoji pack the catalog serves stays catalog material, in the real app.
 *
 * Opening any tool used to copy the whole set into the person's uploads, where it was
 * listed as theirs, counted against their storage and could not be deleted once a saved
 * document named it. That copy was also what kept the set through the prune of files
 * nothing saved refers to. So these run the real mount over real IndexedDB, and check
 * the set still draws with no way to reach the pack file.
 *
 *   LOLLY_EXPORT_TEST_URL=http://127.0.0.1:5173 LOLLY_WEB_BASE=http://127.0.0.1:4173 node --test tests/emoji-pack-not-uploads.browser.test.ts
 *
 * LOLLY_WEB_BASE is a served production build, because only a build has a service worker
 * and split chunks: the first emoji drawn offline is a test of both.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';
import { gotoSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'set LOLLY_EXPORT_TEST_URL';
const built = process.env.LOLLY_WEB_BASE;

/** A template with no emoji in it, so this is the state every tool opens in. */
const PLAIN_TOOL = '/t/qr-code';
const TEXT_TOOL = '/t/link-card';

interface DeviceRow { id: string; bytes: number; pack: boolean }
/** What the device holds, read from the stores rather than from any view of them. */
function readDevice(page: Page): Promise<{ uploads: DeviceRow[]; packFiles: string[] }> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('lolly'); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error);
    });
    const tx = db.transaction(['user-assets', 'asset-blob']);
    const read = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const uploads = await read(tx.objectStore('user-assets').getAll()) as { id: string; blob?: Blob; meta?: { emoji?: unknown } }[];
    const files = await read(tx.objectStore('asset-blob').getAllKeys());
    db.close();
    return {
      uploads: uploads.map(row => ({ id: row.id, bytes: row.blob?.size ?? 0, pack: !!row.meta?.emoji })),
      packFiles: files.map(String).filter(key => key.startsWith('community/emoji/')),
    };
  });
}

/** The hold runs after the first paint and an idle moment, so give it time to land. */
async function packArrives(page: Page): Promise<string[]> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const { packFiles } = await readDevice(page);
    if (packFiles.length) return packFiles;
    await page.waitForTimeout(500);
  }
  return [];
}

describe('a catalog emoji pack on a device', { skip }, () => {
  let browser: Browser;
  before(async () => { browser = await chromium.launch({ args: webGpuLaunchArgs() }); });
  after(async () => { await browser?.close(); });

  async function freshProfile(): Promise<BrowserContext> {
    return browser.newContext({ viewport: { width: 1280, height: 800 } });
  }

  test('opening a tool holds the pack as one catalog file and adds nothing to the uploads', { timeout: 180_000 }, async () => {
    const context = await freshProfile();
    try {
      const page = await context.newPage();
      await gotoSettled(page, `${origin}${PLAIN_TOOL}`);
      const files = await packArrives(page);
      assert.equal(files.length, 1, `one catalog row for the set in force, not a second row for a recorded read: ${files.join(', ')}`);
      const { uploads } = await readDevice(page);
      assert.deepEqual(uploads.filter(row => row.pack || row.id.startsWith('user/emoji/')), [], 'no pack among the uploads');
    } finally { await context.close(); }
  });

  test('two tabs opening a tool on a first visit both mount, and neither writes a pack', { timeout: 180_000 }, async () => {
    const context = await freshProfile();
    try {
      const pages = [await context.newPage(), await context.newPage()];
      const failures: string[] = [];
      for (const page of pages) page.on('console', message => { if (/View mount failed/.test(message.text())) failures.push(message.text()); });
      await Promise.all(pages.map(page => gotoSettled(page, `${origin}${PLAIN_TOOL}`)));
      assert.deepEqual(failures, [], 'neither view failed');
      assert.equal((await packArrives(pages[0]!)).length, 1, 'both tabs land on the same catalog row');
      const { uploads } = await readDevice(pages[0]!);
      assert.equal(uploads.some(row => row.pack), false);
    } finally { await context.close(); }
  });

  test('the set draws with the pack file out of reach, and through the prune at a new catalog', { timeout: 180_000 }, async () => {
    const context = await freshProfile();
    try {
      const page = await context.newPage();
      await gotoSettled(page, `${origin}${PLAIN_TOOL}`);
      assert.equal((await packArrives(page)).length, 1);
      // Only the pack files, so the rest of the shell still loads on any server.
      await context.route('**/catalog/packs/**', route => route.abort());
      await gotoSettled(page, `${origin}${TEXT_TOOL}?heading=${encodeURIComponent('Ship it \u{1F389}')}`);
      await page.waitForSelector('#tool-canvas .lolly-emoji svg');
      assert.equal(await page.locator('#tool-canvas .lolly-emoji--unset').count(), 0, 'artwork, not the placeholder');
      const prune = await page.evaluate(async (paths) => {
        // The same call a catalog sync makes, over the current index, with nothing saved.
        const { openDB } = await import(/* @vite-ignore */ paths[0]!) as { openDB(): Promise<{ getAll(store: string): Promise<unknown[]> }> };
        const { pruneAssetCache } = await import(/* @vite-ignore */ paths[1]!) as { pruneAssetCache(...args: unknown[]): Promise<{ blobs: number }> };
        const db = await openDB();
        return pruneAssetCache(db, await db.getAll('asset-meta'), new Set(), new Set(), { evict() {}, evictPrefix() {} });
      }, ['/src/bridge/db.ts', '/src/bridge/asset-cache-maintenance.ts']);
      assert.ok(prune.blobs >= 0);
      assert.equal((await readDevice(page)).packFiles.length, 1, 'the set survives, though no saved document names it');
    } finally { await context.close(); }
  });

  test('the first emoji this device ever draws can be drawn with the network off', { skip: built ? false : 'set LOLLY_WEB_BASE', timeout: 180_000 }, async () => {
    const context = await freshProfile();
    try {
      const page = await context.newPage();
      // One online visit to a tool with no emoji in it, so nothing has needed the pass yet.
      await gotoSettled(page, `${built}${TEXT_TOOL}`);
      await page.evaluate(() => navigator.serviceWorker?.ready.then(() => true));
      await gotoSettled(page, `${built}${TEXT_TOOL}`);
      assert.equal((await packArrives(page)).length, 1);
      // The code is brought in at the same idle moment as the set, so let it land.
      await page.waitForLoadState('networkidle');
      await context.setOffline(true);
      await page.goto(`${built}${TEXT_TOOL}?heading=${encodeURIComponent('Ship it \u{1F389}')}`, { waitUntil: 'load' });
      await page.waitForSelector('#tool-canvas .lolly-emoji svg');
      assert.equal(await page.locator('#tool-canvas .lolly-emoji--unset').count(), 0, 'artwork, not the placeholder');
      assert.equal(await page.getByText('This page needs a quick refresh').count(), 0, 'and no chunk went missing');
      const { uploads } = await readDevice(page);
      assert.equal(uploads.some(row => row.pack), false, 'with nothing in the uploads');
    } finally { await context.close(); }
  });

  test('a person\'s uploads come through untouched, whatever they hold', { timeout: 180_000 }, async () => {
    const context = await freshProfile();
    try {
      const page = await context.newPage();
      await gotoSettled(page, `${origin}${PLAIN_TOOL}`);
      // A photo, and a record named and shaped as a person's own import of a shipped set
      // is. No rule can tell that one from a stray copy, so nothing may remove either.
      const seeded = await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const open = indexedDB.open('lolly'); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error);
        });
        const digest = 'a'.repeat(64);
        const rows = [
          { id: 'user/holiday-1', type: 'raster', format: 'png', version: 'v1', blob: new Blob([new Uint8Array(1024)], { type: 'image/png' }), meta: { name: 'Holiday' } },
          { id: `user/emoji/${digest}`, type: 'data', format: 'json', version: digest, blob: new Blob(['{}'], { type: 'application/json' }),
            meta: { name: 'Fluent Emoji High Contrast', tags: ['emoji-pack'], size: 2, emoji: { id: 'community/emoji/fluent/high-contrast', version: '2026.8.24', checksum: `sha256:${digest}`,
              family: 'Fluent Emoji', style: 'High Contrast', label: 'Fluent Emoji High Contrast', license: 'MIT', licenseUrl: 'https://opensource.org/license/mit', attribution: 'Microsoft', glyphs: 1, coverageComplete: false } } },
        ];
        const tx = db.transaction('user-assets', 'readwrite');
        for (const row of rows) tx.objectStore('user-assets').put(row);
        await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
        db.close();
        return rows.map(row => row.id);
      });
      await gotoSettled(page, `${origin}${PLAIN_TOOL}`);
      await page.waitForTimeout(3000);
      const { uploads } = await readDevice(page);
      for (const id of seeded) assert.ok(uploads.some(row => row.id === id), `${id} is still there after a boot and a tool open`);
      assert.equal(uploads.find(row => row.id === 'user/holiday-1')!.bytes, 1024);
    } finally { await context.close(); }
  });
});
