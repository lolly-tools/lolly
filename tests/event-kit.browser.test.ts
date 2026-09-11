// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium, firefox, webkit } from 'playwright';
import { unzipSync } from 'fflate';
import sharp from 'sharp';
import { createNodeScanAPI } from '../packages/node-shell/src/scan.ts';

// Real app integration: run against a local Vite shell in an isolated browser
// context. No existing profile, saved sessions or user assets are changed.
const origin = process.env.LOLLY_KIT_TEST_URL;
const skip = origin ? false : 'set LOLLY_KIT_TEST_URL to a local web shell';

test('event kit saves links, reopens, exports correct formats and retries identical bytes', { skip, timeout: 150_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${origin}/#/batch`);
    await page.locator('#pro-event-kit').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('#pro-event-kit').click();
    const title = page.locator('[data-kit-field="title"]');
    await title.fill('An evening of ideas'); await title.press('Tab');
    const url = page.locator('[data-kit-field="url"]');
    const destination = 'https://example.com/event?edition=2&lang=en';
    await url.fill(destination); await url.press('Tab');
    await page.locator('[data-kit-output="social"] summary').click();
    await page.locator('[data-kit-link="social/title"]').uncheck();
    const override = page.locator('[data-kit-override="social/title"]');
    await override.fill('Social edition'); await override.press('Tab');
    await page.locator('[data-kit-action="save"]').click();
    await page.locator('.pro-sess-save input').fill('Event kit check');
    await page.locator('[data-save]').click();
    const saved = page.locator('[data-load]').filter({ hasText: 'Event kit check' });
    await saved.waitFor();
    const slot = await saved.getAttribute('data-load');
    await page.goto(`${origin}/#/batch?session=${encodeURIComponent(slot!)}`);
    await title.waitFor();
    assert.equal(await title.inputValue(), 'An evening of ideas');
    await page.locator('[data-kit-output="social"] summary').click();
    assert.equal(await override.inputValue(), 'Social edition');
    await page.locator('[data-kit-link="social/title"]').check();
    await page.locator('[data-kit-action="preview"]').click();
    await page.waitForFunction(() => document.querySelector('.kit-status')?.textContent?.includes('up to date'), {}, { timeout: 90_000 });
    assert.equal(await page.locator('.kit-outputs img').count(), 3);
    // A saved reference whose bytes are no longer here must be named, not
    // silently rendered as a blank logo. Exercise the same picker/change path.
    await page.evaluate(async () => {
      const path = '/src/lib/host-ref.ts';
      (await import(path)).getHostRef().assets.pick = async () => ({ id: 'user/missing-kit-logo', type: 'vector' });
    });
    await page.locator('[data-kit-logo="logo"]').click();
    await page.locator('[data-kit-clear="logo"]').waitFor();
    await page.locator('[data-kit-action="preview"]').click();
    await page.waitForFunction(() => document.querySelector('.kit-status')?.textContent?.includes('unavailable on this device'));
    await page.locator('[data-kit-clear="logo"]').click();
    await page.locator('[data-kit-action="preview"]').click();
    await page.waitForFunction(() => document.querySelector('.kit-status')?.textContent?.includes('up to date'), {}, { timeout: 90_000 });
    await page.setViewportSize({ width: 390, height: 844 });
    const rect = await page.locator('#pro-render').boundingBox();
    assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= 390);
    await page.locator('.kit-outputs article').last().scrollIntoViewIfNeeded();
    const last = await page.locator('.kit-outputs article').last().boundingBox();
    assert.ok(last && last.y < 844 && last.y + last.height > 0, 'all outputs can be reached');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#pro-render').click();
    const downloading = page.waitForEvent('download', { timeout: 90_000 });
    await page.getByRole('dialog').getByRole('button', { name: 'Render', exact: true }).click();
    const downloaded = await downloading;
    const bytes = await readFile((await downloaded.path())!);
    const files = unzipSync(bytes);
    const pdf = files['01-event-poster.pdf']!;
    assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), '%PDF-');
    const png = await sharp(files['02-event-social.png']!).metadata();
    assert.deepEqual([png.width, png.height], [1080, 1080]);
    const { data, info } = await sharp(files['03-event-qr.svg']!).flatten({ background: '#fff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const hits = await createNodeScanAPI().detect({ data: new Uint8ClampedArray(data), width: info.width, height: info.height });
    assert.equal(hits[0]?.rawValue, destination);
    const retry = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download .*again/ }).click();
    assert.deepEqual(await readFile((await (await retry).path())!), bytes);
    // The retained result must be the finished encrypted archive, with no
    // second password prompt and no regeneration when delivery is retried.
    await page.locator('#pro-render').click();
    await page.locator('.export-lock-pw').fill('local-test-password');
    const lockedDownload = page.waitForEvent('download', { timeout: 90_000 });
    await page.getByRole('dialog').getByRole('button', { name: 'Render', exact: true }).click();
    const locked = await readFile((await (await lockedDownload).path())!);
    assert.equal(locked.readUInt16LE(8), 99, 'WinZip AES method');
    assert.equal(locked.readUInt16LE(6) & 1, 1, 'encrypted entry flag');
    const lockedRetry = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download .*again/ }).click();
    assert.deepEqual(await readFile((await (await lockedRetry).path())!), locked);
    assert.equal(await page.locator('.export-lock-pw').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); }
});

for (const [name, launcher] of Object.entries({ chromium, firefox, webkit })) {
  test(`${name}: first delivery failure retains a real downloadable file`, { skip, timeout: 90_000 }, async () => {
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
    const browser = await launcher.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto(`${origin}/#/batch`);
      await page.locator('#pro-event-kit').waitFor();
      await page.keyboard.press('Escape');
      await page.evaluate(async () => {
        const hostPath = '/src/lib/host-ref.ts', deliveryPath = '/src/lib/download-recovery.ts';
        const host = (await import(hostPath)).getHostRef();
        const original = host.export.download;
        let first = true;
        host.export.download = async (blob: Blob, filename: string) => {
          if (first) { first = false; throw new Error('Induced write failure'); }
          return original(blob, filename);
        };
        const owner = document.createElement('aside');
        owner.id = 'delivery-check'; owner.style.cssText = 'position:fixed;inset:80px 20px auto;z-index:9999;background:white';
        document.body.append(owner);
        await (await import(deliveryPath)).deliverWithRecovery(owner, owner,
          { blob: new Blob(['rendered once']), filename: 'recovery.txt', label: 'Prepared once' }, host);
      });
      assert.match(await page.locator('#delivery-check').innerText(), /Induced write failure/);
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download recovery.txt again', exact: true }).click();
      assert.equal(await readFile((await (await download).path())!, 'utf8'), 'rendered once');
      assert.match(await page.locator('#delivery-check').innerText(), /Download requested/);
      assert.doesNotMatch(await page.locator('#delivery-check').innerText(), /Saved\./);
    } finally { await context.close(); await browser.close(); }
  });
}
