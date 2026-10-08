// SPDX-License-Identifier: MPL-2.0
/** LOLLY_EXPORT_TEST_URL=http://127.0.0.1:5188 LOLLY_BROWSER_CHANNEL=chrome node --test tests/design-export-zoom.browser.test.ts */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { unzipSync } from 'fflate';
import sharp from 'sharp';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
test('carousel PNGs retain lower-page text at different editor zoom levels and restore the view', {
  skip: origin ? false : 'set LOLLY_EXPORT_TEST_URL to a local Vite shell', timeout: 120_000,
}, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await context.addInitScript(() => {
    for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined });
  });
  try {
    await page.goto(`${origin}/#/tool/design?template=carousel`, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.locator('#tool-canvas [data-pdf-page]').nth(2).waitFor();
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.locator('[data-action="format"]').selectOption('png', { force: true });
    await page.locator('[data-action="transparent-bg"]').uncheck();
    const view = () => page.locator('#tool-canvas-outer').evaluate(el => (el as HTMLElement).style.transform);
    for (const zoom of ['out', 'in']) {
      await page.getByRole('button', { name: `Zoom ${zoom}`, exact: true }).click();
      const before = await view();
      assert.match(before, /scale\(/, 'exercise the stage navigation transform');
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('[data-action="download"]').click(),
      ]);
      const files = unzipSync(await readFile((await download.path())!));
      const pngs = Object.entries(files).filter(([name]) => name.endsWith('.png')).sort();
      assert.equal(pngs.length, 3);
      for (const [, bytes] of pngs) {
        const meta = await sharp(bytes).metadata();
        assert.deepEqual([meta.width, meta.height], [1080, 1350]);
      }
      const { data, info } = await sharp(pngs[0]![1]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      // The cover's headline and swipe cue are below y=760. A retained editor
      // scale enlarged the kicker while pushing both of these out of the PNG.
      let lowerTextPixels = 0;
      for (let y = 760; y < 1300; y++) for (let x = 70; x < 1010; x++) {
        const i = (y * info.width + x) * 4;
        if (data[i]! > 240 && data[i + 1]! > 240 && data[i + 2]! > 240 && data[i + 3]! > 240) lowerTextPixels++;
      }
      assert.ok(lowerTextPixels > 15_000, `lower-page text missing at zoom ${zoom}: ${lowerTextPixels} pixels`);
      // Delivery can immediately start a saved-history thumbnail in the same
      // export queue. Wait for that capture to hand the editor view back too.
      await page.waitForFunction(transform => (document.querySelector('#tool-canvas-outer') as HTMLElement)?.style.transform === transform, before);
      assert.equal(await view(), before, 'the editor view returns after export');
    }
  } finally { await context.close(); await closeBrowser(); }
});
