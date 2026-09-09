// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.LOLLY_HISTORY_TEST_URL;
const skip = origin ? false : 'LOLLY_HISTORY_TEST_URL not set (serve the web shell and point it here)';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));

test('history pins exact uploaded bytes through replacement and backup; referenced versions cannot be deleted', { skip, timeout: 45_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Version dependencies</title>' }));
    await page.goto(origin!);
    const result = await page.evaluate(async () => {
      const dbPath = '/src/bridge/db.ts', statePath = '/src/bridge/state.ts', historyPath = '/src/bridge/revision-history.ts', assetsPath = '/src/bridge/assets.ts';
      const versionsPath = '/src/bridge/asset-history.ts', transferPath = '/src/data-transfer.ts';
      const db = await (await import(dbPath)).openDB();
      const state = (await import(statePath)).createStateAPI(db, (await import(historyPath)).createRevisionStore(db));
      const assets = (await import(assetsPath)).createAssetsAPI(db);
      const versions = await import(versionsPath);
      const id = 'user/upload/pinned', slot = 'design:pinned';
      const saveAsset = (version: string, content: string) => versions.writeVersionedUserAsset(db, { id, version, type: 'raster', format: 'png', blob: new Blob([content], { type: 'image/png' }) });
      await saveAsset('v1', 'original pixels');
      const first = await state.history.checkpoint(slot, { __toolId: 'design', __label: 'Pinned', image: await assets.get(id) }, { reason: 'save', expectedHead: null });
      const data = await state.history.read(first.id);
      await saveAsset('v2', 'replacement pixels');
      const oldBytes = await (await assets._getBlob(id, data.image.pin)).text();
      const blocked = await assets._removeUserAssetVersion(id, 'v1').then(() => '', (error: Error) => error.message);
      const newer = await state.history.checkpoint('design:current', { __toolId: 'design', image: await assets.get(id) }, { reason: 'save', expectedHead: null });
      const currentBlocked = await assets._deleteUserAsset(id).then(() => '', (error: Error) => error.message);
      const fileHistory = {
        export: async () => ({ assetVersions: await versions.allUserAssetVersions(db), operations: [] }),
        restore: async (snapshot: { assetVersions: unknown[] }) => {
          for (const entry of snapshot.assetVersions) await versions.importUserAssetVersion(db, entry);
          return { assetVersions: snapshot.assetVersions.length, fileOperations: 0, failedHistory: 0 };
        },
      };
      const deps = { host: { state, assets, fileHistory, profile: { get: async () => ({}), set: async () => {} } }, storage: { getItem: () => null, setItem() {} } };
      const transfer = await import(transferPath);
      const backup = await transfer.exportBackup(deps);
      await state.delete(slot); await state.delete('design:current');
      await assets._removeUserAssetVersion(id, 'v1'); await assets._deleteUserAsset(id);
      const empty = await assets._getBlob(id, { version: 'v1' });
      await transfer.importBackup(deps, await backup.blob.arrayBuffer());
      const restored = await state.history.read(first.id);
      const restoredBytes = await (await assets._getBlob(id, restored.image.pin)).text();
      const newest = await state.history.read(newer.id);
      return { pin: data.image.pin, oldBytes, blocked, currentBlocked, empty, restored, restoredBytes, newestPin: newest.image.pin };
    });
    assert.deepEqual(result.pin, { version: 'v1', format: 'png' });
    assert.equal(result.oldBytes, 'original pixels');
    assert.match(result.blocked, /used by a saved creation/);
    assert.match(result.currentBlocked, /used by a saved creation/);
    assert.equal(result.empty, null);
    assert.deepEqual(result.restored.image.pin, result.pin);
    assert.equal(result.restoredBytes, 'original pixels');
    assert.deepEqual(result.newestPin, { version: 'v2', format: 'png' });
  } finally { await browser.close(); }
});

test('an uncached old catalog version never fetches today’s URL or poisons the old cache key', { skip, timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Catalog versions</title>' }));
    await page.goto(origin!);
    const result = await page.evaluate(async () => {
      const dbPath = '/src/bridge/db.ts', assetsPath = '/src/bridge/assets.ts';
      const db = await (await import(dbPath)).openDB();
      await db.put('asset-meta', { id: 'test/photo', type: 'raster', name: 'Photo', version: 'v2', tier: 'on-demand', formats: [{ format: 'png', url: '/must-not-fetch.png' }] });
      const assets = (await import(assetsPath)).createAssetsAPI(db);
      const error = await assets.get('test/photo', { version: 'v1' }).then(() => '', (error: Error) => error.message);
      const blob = await assets._getBlob('test/photo', { version: 'v1' });
      const cached = await db.get('asset-blob', 'test/photo:png:v1');
      await db.put('asset-blob', new Blob(['old'], { type: 'image/png' }), 'test/photo:png:v1');
      const old = await assets.get('test/photo', { version: 'v1', format: 'png' });
      return { error, blob, cached: !!cached, version: old.version, content: await (await fetch(old.url)).text() };
    });
    assert.match(result.error, /version unavailable/);
    assert.equal(result.blob, null); assert.equal(result.cached, false);
    assert.equal(result.version, 'v1'); assert.equal(result.content, 'old');
  } finally { await browser.close(); }
});
