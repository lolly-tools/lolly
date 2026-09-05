// SPDX-License-Identifier: MPL-2.0
/** Two isolated Chromium devices, real OPFS/IDB, and the actual backup UI. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';

const origin = process.env.LOLLY_CONVERT_TEST_URL;
test('portable file history: two-device restore, immutable collisions, orphan recovery and mobile storage UI', { skip: !origin, timeout: 90_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await getBrowser();
  const source = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const target = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await source.newPage(), restored = await target.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message)); restored.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(`${origin}/#/convert`, { waitUntil: 'networkidle' });
    const seeded = await page.evaluate(async () => {
      const hostPath = '/src/lib/host-ref.ts', storePath = '/src/lib/file-operation-store.ts', adapterPath = '/src/lib/file-operation-adapter.ts';
      const host = (await import(hostPath)).getHostRef();
      const store = await (await import(storePath)).localFileOperations();
      const { describeFile, runWebFileOperation } = await import(adapterPath);
      const id = `user/upload/recovery-${crypto.randomUUID()}`;
      await host.assets._importUserAsset({ id, type: 'text', format: 'txt', version: 'first', blob: new Blob(['original'], { type: 'text/plain' }), credential: new Uint8Array([0, 255, 3]), credentialFormat: 'png', aiGenerated: false, meta: { name: 'Recoverable proof.txt' } });
      await host.assets._replaceUserAssetBytes(id, { blob: new Blob(['changed'], { type: 'text/plain' }) });
      await host.assets._deleteUserAsset(id);
      await host.assets._importUserAsset({ id: `${id}-current`, type: 'text', format: 'txt', version: 'live-v1', blob: new Blob(['current'], { type: 'text/plain' }), meta: { name: 'Current proof.txt' } });
      const input = new File(['name,colour\nAda,green'], 'palette.csv', { type: 'text/csv' });
      const request = { version: 1, operation: 'convert', target: 'json', options: {} };
      const job = await store.begin(await describeFile(input), request);
      const outcome = await runWebFileOperation(input, request); await store.finish(job.id, outcome.report, outcome.output);
      const running = await store.begin(await describeFile(input), request, 1);
      window.dispatchEvent(new Event('lolly:file-operations-changed'));
      return { id, operationId: job.id, runningId: running.id, output: await outcome.output.text(), sha256: outcome.report.outputs[0].sha256 };
    });
    await page.locator('.convert-history-storage').waitFor();
    await page.locator('[data-history-storage] summary').click();
    await page.locator('[data-history-search]').fill('palette');
    await page.screenshot({ path: '/Users/andy/Build/lolly/plans/203-work/history-recovery-desktop.png', fullPage: true });
    await page.goto(`${origin}/#/profile?focus=storage-section`, { waitUntil: 'networkidle' });
    await page.locator('#export-data-btn').waitFor();
    assert.match(await page.locator('.store-manage[data-cat="file-history"]').innerText(), /Not a disposable cache/);
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export-data-btn').click()]);
    const backup = await readFile((await download.path())!);
    assert.ok(backup.length > 0);

    await restored.goto(`${origin}/#/profile?focus=storage-section`, { waitUntil: 'networkidle' });
    await restored.locator('#import-data-input').setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/zip', buffer: backup });
    await restored.locator('[data-scope="import"]').click();
    await restored.locator('.clear-dialog').waitFor({ state: 'detached' });
    const roundTrip = await restored.evaluate(async ({ seeded, bytes }) => {
      const hostPath = '/src/lib/host-ref.ts', dbPath = '/src/bridge/db.ts', storePath = '/src/lib/file-operation-store.ts', backupPath = '/src/data-transfer.ts';
      const host = (await import(hostPath)).getHostRef(); const db = await (await import(dbPath)).openDB();
      const store = await (await import(storePath)).localFileOperations();
      const rows = await store.list(); const running = rows.find((r: { id: string }) => r.id === seeded.runningId);
      const saved = await store.getOutput(seeded.operationId);
      const version = await db.get('user-asset-versions', [seeded.id, 'first']);
      const twice = await (await import(backupPath)).importBackup({ host, storage: localStorage }, new Uint8Array(bytes));
      return { output: await saved.text(), sha256: rows.find((r: { id: string }) => r.id === seeded.operationId).report.outputs[0].sha256,
        currentMissing: !await db.get('user-assets', seeded.id), original: await version.record.blob.text(), credential: [...version.record.credential],
        interrupted: running.state, reserved: running.reservedBytes, lease: running.leaseUntil,
        count: (await store.list()).length, versions: (await db.getAll('user-asset-versions')).length, currentVersion: (await db.get('user-assets', `${seeded.id}-current`)).version, twice };
    }, { seeded, bytes: [...backup] });
    assert.equal(roundTrip.output, seeded.output); assert.equal(roundTrip.sha256, seeded.sha256);
    assert.equal(roundTrip.currentMissing, true); assert.equal(roundTrip.original, 'original');
    assert.deepEqual(roundTrip.credential, [0, 255, 3]);
    assert.equal(roundTrip.interrupted, 'interrupted'); assert.equal(roundTrip.reserved, 0); assert.equal(roundTrip.lease, 0);
    assert.equal(roundTrip.count, 2); assert.equal(roundTrip.versions, 1); assert.equal(roundTrip.twice.failedHistory, 0);
    assert.equal(roundTrip.currentVersion, 'live-v1', 'repeated imports preserve the current asset version too');

    await restored.goto(`${origin}/#/convert`, { waitUntil: 'networkidle' });
    await restored.locator('[data-history-storage] summary').click();
    await restored.locator('[data-all-versions]').click();
    await restored.locator('[data-open-asset-history]').waitFor();
    assert.match(await restored.locator('[data-version-library]').innerText(), /Current asset deleted/);
    await restored.setViewportSize({ width: 390, height: 844 });
    await restored.evaluate(() => document.documentElement.setAttribute('data-a11y-text', 'large'));
    await restored.screenshot({ path: '/Users/andy/Build/lolly/plans/203-work/deleted-asset-recovery-mobile.png', fullPage: true });
    assert.equal(await restored.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await restored.locator('[data-open-asset-history]').click();
    await restored.locator('[data-restore-version]').click();
    await restored.locator('dialog [data-act="ok"]').click();
    await restored.waitForFunction(() => document.querySelector('[data-version-status]')?.textContent?.includes('Version restored'));
    await restored.locator('.asset-versions-dialog [data-close]').last().click();
    assert.doesNotMatch(await restored.locator('[data-version-library]').innerText(), /Current asset deleted/);
    await restored.locator('.asset-versions-dialog [data-close]').click();
    await restored.waitForFunction(() => getComputedStyle(document.body).overflow !== 'hidden');
    await restored.screenshot({ path: '/Users/andy/Build/lolly/plans/203-work/history-recovery-mobile.png', fullPage: true });
    assert.equal(await restored.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    const safety = await restored.evaluate(async (seeded) => {
      const dbPath = '/src/bridge/db.ts', storePath = '/src/lib/file-operation-store.ts', historyPath = '/src/bridge/asset-history.ts', hostPath = '/src/lib/host-ref.ts';
      const db = await (await import(dbPath)).openDB(); const { FileOperationStore, localFileOperations } = await import(storePath);
      const store = await localFileOperations(); const host = (await import(hostPath)).getHostRef();
      const { importUserAssetVersion } = await import(historyPath);
      const before = await db.get('user-asset-versions', [seeded.id, 'first']);
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('imposter'));
      const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
      let refused = false;
      try { await importUserAssetVersion(db, { ...before, sha256: hash, record: { ...before.record, blob: new Blob(['imposter'], { type: 'text/plain' }) } }); } catch { refused = true; }
      const portable = await host.fileHistory.export(); const operation = portable.operations.find((r: { id: string }) => r.id === seeded.operationId);
      let quota = false, conflict = false;
      try { await new FileOperationStore(db, null, 1).importRecord({ ...operation, id: crypto.randomUUID() }); } catch { quota = true; }
      const running = await store.begin(operation.input, operation.request, 1);
      try { await store.importRecord({ ...operation, id: running.id }); } catch { conflict = true; }
      const orphan = crypto.randomUUID(); await db.put('file-operation-blobs', new Blob(['orphan']), orphan);
      const protectedId = operation.id; // Restored IDB output must be protected by its record.
      const removed = await store.reclaimAbandonedBytes();
      const protectedResult = await store.getOutput(protectedId);
      return { refused, quota, conflict, original: await (await db.get('user-asset-versions', [seeded.id, 'first'])).record.blob.text(), current: await (await host.assets._getBlob(seeded.id)).text(), removed, protectedResult: await protectedResult.text(), stillRunning: (await db.get('file-operations', running.id)).state };
    }, seeded);
    assert.equal(safety.refused, true); assert.equal(safety.quota, true); assert.equal(safety.conflict, true);
    assert.equal(safety.original, 'original'); assert.equal(safety.current, 'original');
    assert.deepEqual(safety.removed, { files: 1, bytes: 6 }); assert.equal(safety.protectedResult, seeded.output); assert.equal(safety.stillRunning, 'running');

    // Fault injection in this isolated device: persistence must not masquerade
    // as a successful output in the actual workbench's downloadable batch report.
    await restored.evaluate(async () => {
      // Inject at the actual storage primitive, independent of Vite HMR module
      // identities. This context is isolated from the user's own app data.
      const original = FileSystemFileHandle.prototype.createWritable;
      FileSystemFileHandle.prototype.createWritable = async () => {
        FileSystemFileHandle.prototype.createWritable = original;
        throw new DOMException('Test: local storage is full.', 'QuotaExceededError');
      };
    });
    await restored.locator('[data-file]').setInputFiles({ name: 'cannot-save.csv', mimeType: 'text/csv', buffer: Buffer.from('x,y\n1,2') });
    await restored.locator('[data-format]').selectOption('json');
    await restored.locator('[data-convert]').click();
    await restored.locator('.convert-error[role="alert"]').waitFor();
    const [reportDownload] = await Promise.all([restored.waitForEvent('download'), restored.locator('[data-batch-report]').click()]);
    const receipt = JSON.parse(await readFile((await reportDownload.path())!, 'utf8'));
    assert.deepEqual(receipt.counts, { succeeded: 0, failed: 1, cancelled: 0 });
    assert.equal(receipt.results[0].findings[0].code, 'result-not-saved');
    assert.equal(await restored.locator('.convert-output').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await source.close(); await target.close(); await closeBrowser(); }
});

const productionOrigin = process.env.LOLLY_PRODUCTION_TEST_URL;
test('built application backs up and restores a converted copy through the real UI', { skip: !productionOrigin, timeout: 60_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(productionOrigin!).hostname));
  const browser = await getBrowser();
  const source = await browser.newContext(), target = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await source.newPage(), other = await target.newPage();
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.stack || e.message)); other.on('pageerror', e => errors.push(e.stack || e.message));
  try {
    await page.goto(`${productionOrigin}/#/convert`, { waitUntil: 'networkidle' });
    await page.locator('[data-file]').setInputFiles({ name: 'portable-proof.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="150"><rect width="300" height="150" fill="#238875"/></svg>') });
    await page.locator('[data-convert]').click(); await page.locator('.convert-output').waitFor();
    const [result] = await Promise.all([page.waitForEvent('download'), page.locator('[data-download]').click()]);
    const original = await readFile((await result.path())!);
    assert.deepEqual([...original.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    await page.goto(`${productionOrigin}/#/profile?focus=storage-section`, { waitUntil: 'networkidle' });
    const [backup] = await Promise.all([page.waitForEvent('download'), page.locator('#export-data-btn').click()]);
    const bytes = await readFile((await backup.path())!);
    await other.goto(`${productionOrigin}/#/profile?focus=storage-section`, { waitUntil: 'networkidle' });
    await other.locator('#import-data-input').setInputFiles({ name: backup.suggestedFilename(), mimeType: 'application/zip', buffer: bytes });
    await other.locator('[data-scope="import"]').click(); await other.locator('.clear-dialog').waitFor({ state: 'detached' });
    await other.goto(`${productionOrigin}/#/convert`, { waitUntil: 'networkidle' });
    await other.locator('[data-batch-id] summary').click();
    const [batchReport] = await Promise.all([other.waitForEvent('download'), other.locator('[data-batch-saved-report]').click()]);
    assert.deepEqual(JSON.parse(await readFile((await batchReport.path())!, 'utf8')).counts, { succeeded: 1, failed: 0, cancelled: 0 });
    const [restored] = await Promise.all([other.waitForEvent('download'), other.locator('[data-history-download]').click()]);
    assert.equal(restored.suggestedFilename(), result.suggestedFilename()); assert.deepEqual(await readFile((await restored.path())!), original);
    await other.locator('[data-operation] .convert-reuse summary').click();
    await other.locator('[data-operation] [data-result-library]').click();
    await other.waitForFunction(() => document.querySelector('[data-history-status]')?.textContent?.includes('Added to your library'));
    await other.evaluate(() => { document.documentElement.setAttribute('data-a11y-text', 'large'); window.scrollTo({ top: 0, behavior: 'instant' }); });
    await other.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    assert.equal(await other.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await other.screenshot({ path: '/Users/andy/Build/lolly/plans/203-work/production-history-recovery.png', fullPage: true });
    // Deterministic navigation race: leave Profile while its storage estimate
    // is suspended, then allow the old refresh to finish on the Convert route.
    await other.evaluate(() => {
      const estimate = navigator.storage.estimate.bind(navigator.storage);
      navigator.storage.estimate = async () => {
        document.documentElement.dataset.testStoragePending = '1';
        await new Promise<void>(resolve => window.addEventListener('test:release-storage', () => resolve(), { once: true }));
        const result = await estimate(); document.documentElement.dataset.testStorageFinished = '1'; return result;
      };
      window.addEventListener('test:release-storage', () => { navigator.storage.estimate = estimate; }, { once: true });
      location.hash = '#/profile?focus=storage-section';
    });
    await other.waitForFunction(() => document.documentElement.dataset.testStoragePending === '1');
    await other.evaluate(() => { location.hash = '#/convert'; });
    await other.locator('#storage-body').waitFor({ state: 'detached' });
    await other.evaluate(() => window.dispatchEvent(new Event('test:release-storage')));
    await other.waitForFunction(() => document.documentElement.dataset.testStorageFinished === '1');
    await other.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await other.locator('[data-history-download]').waitFor();
    assert.deepEqual(errors, []);
  } finally { await source.close(); await target.close(); await closeBrowser(); }
});
