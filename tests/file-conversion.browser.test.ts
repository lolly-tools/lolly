// SPDX-License-Identifier: MPL-2.0
/** Real Convert route, downloaded bytes and responsive layout, using local Chromium.
 * Run with a local Vite server:
 * LOLLY_CONVERT_TEST_URL=http://localhost:5173 node --test tests/file-conversion.browser.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { readZip } from '../engine/src/index.ts';
import type { FileOperationReportV1 } from '../packages/core/src/file-v1.ts';

const origin = process.env.LOLLY_CONVERT_TEST_URL;
test('Convert: mobile/desktop, output bytes, receipts, collision-safe batches and failure retention', { skip: !origin, timeout: 90_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname), 'browser test must target a local development server');
  const browser = await getBrowser();
  const errors: string[] = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${origin}/#/convert`, { waitUntil: 'networkidle' });
    const buffer = await sharp({ create: { width: 1200, height: 800, channels: 4, background: { r: 34, g: 145, b: 128, alpha: .5 } } }).png().toBuffer();
    await page.locator('[data-file]').setInputFiles({ name: 'artwork.png', mimeType: 'image/png', buffer });
    await page.locator('[data-convert]').waitFor();
    await page.locator('[data-preset=jpeg]').click();
    await page.locator('.convert-advanced summary').click();
    await page.locator('[data-edge]').fill('600');
    await page.locator('[data-convert]').click();
    await page.locator('.convert-output').waitFor();
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-download]').click()]);
    assert.equal(download.suggestedFilename(), 'artwork.jpg');
    const output = await readFile((await download.path())!);
    const metadata = await sharp(output).metadata();
    assert.deepEqual([metadata.format, metadata.width, metadata.height], ['jpeg', 600, 400]);
    const pixel = await sharp(output).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
    assert.ok(pixel[0]! > 130 && pixel[1]! > 190 && pixel[2]! > 180, 'transparent artwork is flattened onto white, not black');
    const [receiptDownload] = await Promise.all([page.waitForEvent('download'), page.locator('[data-report]').click()]);
    const receipt = JSON.parse(await readFile((await receiptDownload.path())!, 'utf8')) as FileOperationReportV1;
    assert.equal(receipt.inputs[0]!.sha256, createHash('sha256').update(buffer).digest('hex'));
    assert.equal(receipt.outputs[0]!.sha256, createHash('sha256').update(output).digest('hex'));
    assert.equal(receipt.outputs[0]!.width, 600);
    assert.ok(receipt.findings.some(f => f.code === 'alpha-flattened'));
    // A failed experiment must leave the last successful download reachable.
    const unsupportedAvif = await page.evaluate(() => document.createElement('canvas').toDataURL('image/avif').startsWith('data:image/png'));
    if (unsupportedAvif) {
      await page.locator('[data-format]').selectOption('avif');
      await page.locator('[data-convert]').click();
      await page.locator('.convert-error[role=alert]').waitFor();
      assert.equal(await page.locator('.convert-output').count(), 1);
      assert.match(await page.locator('.convert-error[role=alert]').innerText(), /encode AVIF/);
    }
    await page.locator('[data-file]').setInputFiles(['photo.png', 'photo.png', 'photo-2.png'].map(name => ({ name, mimeType: 'image/png', buffer })));
    await page.locator('dialog [data-act="ok"]').click();
    await page.locator('[data-convert]').waitFor();
    await page.locator('[data-preset=jpeg]').click();
    await page.locator('[data-convert]').click();
    await page.waitForFunction(() => document.querySelectorAll('.convert-output').length === 3);
    const [zipDownload] = await Promise.all([page.waitForEvent('download'), page.locator('[data-zip]').click()]);
    const entries = readZip(new Uint8Array(await readFile((await zipDownload.path())!)));
    assert.deepEqual(entries.map(e => e.name), ['photo.jpg', 'photo-2.jpg', 'photo-2-2.jpg']);
    for (const entry of entries) assert.equal((await sharp(entry.bytes).metadata()).format, 'jpeg');
    // Narrow + larger text: horizontal scrolling is not needed to reach any action.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.documentElement.setAttribute('data-a11y-text', 'large'); window.scrollTo(0, 0); });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator('[data-download]').first().focus();
    assert.equal(await page.locator('[data-download]').first().evaluate(el => el === document.activeElement), true);
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2in" height="1in" viewBox="0 0 200 100"><rect width="200" height="100" fill="#228877"/></svg>');
    await page.locator('[data-file]').setInputFiles({ name: 'physical.svg', mimeType: 'image/svg+xml', buffer: svg });
    await page.locator('dialog [data-act="ok"]').click();
    await page.locator('[data-convert]').waitFor();
    await page.locator('[data-convert]').click();
    await page.locator('.convert-output').waitFor();
    const [svgDownload] = await Promise.all([page.waitForEvent('download'), page.locator('[data-download]').click()]);
    const svgRaster = await sharp((await svgDownload.path())!).metadata();
    assert.deepEqual([svgRaster.width, svgRaster.height], [192, 96], 'physical SVG dimensions use 96 CSS pixels per inch');
    const font = await readFile(new URL('../shells/web/public/fonts/Outfit[wght].ttf', import.meta.url));
    await page.locator('[data-file]').setInputFiles({ name: 'font.ttf', mimeType: 'font/ttf', buffer: font });
    await page.locator('dialog [data-act="ok"]').click();
    await page.locator('[data-format]').waitFor();
    assert.deepEqual(await page.locator('[data-format] option').evaluateAll(els => els.map(el => (el as HTMLOptionElement).value)), ['woff']);
    // OPFS/IndexedDB output survives navigation and reload with exact byte identity.
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('[data-history-search]').fill('artwork.jpg');
    const [saved] = await Promise.all([page.waitForEvent('download'), page.locator('[data-history-download]').click()]);
    assert.deepEqual(await readFile((await saved.path())!), output);
    await page.locator('[data-retry-file]').setInputFiles({ name: 'different.png', mimeType: 'image/png', buffer: Buffer.from('wrong bytes') });
    await page.waitForFunction(() => document.querySelector('[data-history-status]')?.textContent?.includes('SHA-256 differs'));
    await page.locator('[data-retry-file]').setInputFiles({ name: 'artwork.png', mimeType: 'image/png', buffer });
    await page.waitForFunction(() => document.querySelectorAll('[data-history-download]').length >= 6);
    await page.screenshot({ path: '/Users/andy/Build/lolly/plans/203-work/mobile-history.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: '/Users/andy/Build/lolly/plans/203-work/desktop-history.png', fullPage: true });
    const versionFacts = await page.evaluate(async () => {
      const dbPath = '/src/bridge/db.ts', assetsPath = '/src/bridge/assets.ts';
      const { openDB } = await import(dbPath); const { createAssetsAPI } = await import(assetsPath);
      const db = await openDB(); const assets = createAssetsAPI(db);
      const id = `user/upload/test-${crypto.randomUUID()}`;
      await assets._uploadUserAsset({ id, type: 'text', format: 'txt', version: 'first', blob: new Blob(['original'], { type: 'text/plain' }), meta: { name: 'Proof.txt' } });
      await assets._replaceUserAssetBytes(id, { blob: new Blob(['changed'], { type: 'text/plain' }) });
      const before = await assets._listUserAssetVersions(id);
      const original = await (await assets._getBlob(id, { version: 'first' })).text();
      await assets._restoreUserAssetVersion(id, 'first');
      const after = await assets._listUserAssetVersions(id);
      const current = await (await assets._getBlob(id)).text();
      const versioned = await assets.get(id, { version: 'first' });
      const refText = await (await fetch(versioned.url)).text();
      const { openAssetVersions } = await import('/src/views/' + 'asset-versions.ts');
      await openAssetVersions(id, { assets, export: { download: async () => {} } }, async () => {});
      return { before: before.length, after: after.length, original, current, refText };
    });
    assert.deepEqual(versionFacts, { before: 1, after: 2, original: 'original', current: 'original', refText: 'original' });
    await page.screenshot({ path: '/Users/andy/Build/lolly/plans/203-work/asset-versions.png', fullPage: true });
    await page.locator('.asset-versions-dialog [data-close]').click();
    const pdf = await PDFDocument.create(); pdf.addPage([300, 200]); pdf.setAuthor('Private author');
    await page.locator('[data-file]').setInputFiles({ name: 'proof.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
    await page.locator('[data-format]').selectOption('pdf-clean');
    await page.locator('[data-convert]').click();
    await page.locator('.convert-output').waitFor();
    const [cleanDownload] = await Promise.all([page.waitForEvent('download'), page.locator('[data-download]').click()]);
    const clean = await PDFDocument.load(await readFile((await cleanDownload.path())!), { updateMetadata: false });
    assert.equal(clean.getAuthor(), undefined); assert.deepEqual(clean.getPages()[0]!.getSize(), { width: 300, height: 200 });
    const recovery = await page.evaluate(async () => {
      const dbPath = '/src/bridge/db.ts', storePath = '/src/lib/file-operation-store.ts';
      const { openDB } = await import(dbPath); const { FileOperationStore, localFileOperations } = await import(storePath);
      const db = await openDB(), store = await localFileOperations();
      const facts = { name: 'interrupted.txt', size: 1, format: 'txt', mime: 'text/plain' };
      const request = { version: 1, operation: 'convert', target: 'png', options: {} };
      let quotaRefused = false;
      try { await new FileOperationStore(db, null, 1).begin(facts, request, 1); } catch { quotaRefused = true; }
      const started = await store.begin(facts, request, 1);
      await db.put('file-operations', { ...started, leaseUntil: 0 });
      const recovered = (await store.list()).find((record: { id: string }) => record.id === started.id);
      await store.remove(started.id);
      return { quotaRefused, state: recovered.state, reservedBytes: recovered.reservedBytes };
    });
    assert.deepEqual(recovery, { quotaRefused: true, state: 'interrupted', reservedBytes: 0 });
    assert.deepEqual(errors, []);
  } finally {
    await page.close(); await closeBrowser();
  }
});
