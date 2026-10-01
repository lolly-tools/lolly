// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import { journeyDiagnostics } from './helpers/journey-diagnostics.ts';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { lottiePackage } from './helpers/lottie-fixtures.ts';
import { readLottie } from '../engine/src/dotlottie.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
test('gallery drop, selection, clip edits, save/reopen and actual dotLottie download', {
  skip: origin ? false : 'set LOLLY_EXPORT_TEST_URL to a local web shell', timeout: 120000,
}, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await getBrowser(), context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => { Object.defineProperty(window, 'showSaveFilePicker', { value: undefined }); });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const diagnose = journeyDiagnostics(context, 'lottie-import');
  try {
    await page.goto(origin!, { waitUntil: 'networkidle' });
    await page.evaluate(bytes => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array(bytes)], 'two.lottie', { type: 'application/zip+dotlottie' }));
      document.querySelector('#view')!.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
    }, Array.from(lottiePackage('2')));
    await page.getByRole('button', { name: 'Edit animation in Sequence', exact: true }).click();
    const choice = page.getByRole('combobox', { name: 'Animation', exact: true });
    await choice.waitFor();
    assert.equal(await choice.inputValue(), 'animation-1');
    await choice.selectOption('animation-0');
    await page.getByRole('button', { name: 'Insert animation', exact: true }).click();
    const marker = '#tool-canvas [data-lottie-animation="animation-0"].is-lottie-live';
    await page.locator(marker).waitFor();
    await page.locator('[data-group="time"] .tl-group-head').click();
    const length = page.getByLabel('Length', { exact: true });
    await length.fill('1'); await length.press('Tab');
    const trim = page.getByLabel('Trim in', { exact: true });
    await trim.fill('0.2'); await trim.press('Tab');
    await page.locator('label.tl-field').filter({ has: page.getByText('Speed', { exact: true }) }).locator('select').selectOption('1.5');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.tl-clip').length === 2);
    const ruler = await page.locator('.tl-ruler').boundingBox();
    assert.ok(ruler);
    await page.mouse.click(ruler.x + ruler.width * 0.3, ruler.y + ruler.height / 2);
    await page.getByRole('button', { name: 'More tools', exact: true }).click();
    await page.locator('.tl-tool-menu .tl-split').click();
    await page.waitForFunction(() => document.querySelectorAll('.tl-clip').length === 3);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.locator('[data-action="save"]').click();
    await page.getByRole('button', { name: 'Export format', exact: true }).click();
    const all = page.locator('[data-fmt-show-all]'); if (await all.isVisible()) await all.click();
    await page.locator('[data-fmt="lottie"]').click();
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-action="download"]').click()]);
    assert.match(download.suggestedFilename(), /\.lottie$/);
    const first = readLottie(new Uint8Array(await readFile((await download.path())!))).animations[0]!.animation;
    assert.equal(first.fr, 24); assert.equal(first.w, 64); assert.equal(first.h, 64);
    assert.equal(first.layers.length, 3);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator(marker).first().waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.tl-clip').length === 3);
    assert.equal(await page.locator('.tl-clip').count(), 3);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.locator('[data-action="format"]').selectOption('lottie', { force: true });
    const [again] = await Promise.all([page.waitForEvent('download'), page.locator('[data-action="download"]').click()]);
    assert.deepEqual(readLottie(new Uint8Array(await readFile((await again.path())!))).animations[0]!.animation, first);
  } catch (error) { await diagnose(error); throw error; } finally { await context.close(); await closeBrowser(); }
});
