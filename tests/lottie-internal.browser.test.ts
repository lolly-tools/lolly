// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { nestedLottie } from './helpers/lottie-fixtures.ts';
import { readLottie } from '../engine/src/dotlottie.ts';
import { lottieLayers, lottieTracks } from '../engine/src/lottie-edit.ts';
import { propertyKeys } from '../engine/src/lottie-properties.ts';
import type { LottieObject } from '../engine/src/lottie-model.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
test('nested layer/property edits, curves, undo, independent duplicates and save/reopen/export', {
  skip: origin ? false : 'set LOLLY_EXPORT_TEST_URL to a local web shell', timeout: 180000,
}, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await getBrowser(), context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined });
    localStorage.setItem('lolly-welcome-dismissed', '1');
  });
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  const source = nestedLottie(); delete source.layers[0]!.tm;
  const child = (source.assets![0]!.layers as LottieObject[])[0]!;
  const position = lottieTracks(child).find(track => track.id === 'p')!.property;
  for (const key of propertyKeys(position)) {
    (key.s as number[])[1] = 32.123456789;
    if (key.e) (key.e as number[])[1] = 32.123456789;
  }
  try {
    await page.goto(origin!, { waitUntil: 'networkidle' });
    await page.evaluate(json => {
      const transfer = new DataTransfer(); transfer.items.add(new File([json], 'nested.json', { type: 'application/json' }));
      document.querySelector('#view')!.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
    }, JSON.stringify(source));
    await page.getByRole('button', { name: 'Edit animation in Sequence', exact: true }).click();
    await page.locator('#tool-canvas [data-lottie-src].is-lottie-live').waitFor();
    await page.locator('.tl-animation-expand').click();
    const editor = page.locator('.tl-animation-editor');
    await editor.locator('[data-layer="/0/0"]').click();
    await editor.getByLabel('Layer name', { exact: true }).fill('Edited nested dot');
    await editor.getByLabel('Layer name', { exact: true }).press('Tab');
    await editor.getByRole('button', { name: 'Edited nested dot', exact: true }).waitFor();
    // Actual document undo/redo, outside a text input's native undo stack.
    await editor.getByRole('button', { name: 'Edited nested dot', exact: true }).focus();
    await page.keyboard.press('ControlOrMeta+z');
    await editor.getByRole('button', { name: 'Dot', exact: true }).waitFor();
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await editor.getByRole('button', { name: 'Edited nested dot', exact: true }).waitFor();
    const frame = editor.getByLabel('Source frame', { exact: true });
    await frame.fill('30'); await frame.press('Tab');
    await editor.getByRole('button', { name: 'Add keyframe', exact: true }).click();
    await editor.locator('[data-frame="30"]').waitFor();
    await editor.getByRole('button', { name: 'Delete keyframe', exact: true }).click();
    await editor.locator('[data-frame="30"]').waitFor({ state: 'detached' });
    await editor.getByRole('button', { name: 'Add keyframe', exact: true }).click();
    await editor.locator('[data-frame="30"]').waitFor();
    await editor.getByLabel('X', { exact: true }).fill('40'); await editor.getByLabel('X', { exact: true }).press('Tab');
    await page.waitForFunction(() => document.querySelector('[data-lottie-edits]')?.getAttribute('data-lottie-edits')?.includes('40'));
    await editor.locator('[data-frame="10"]').click();
    await editor.locator('.ease-ed-input').fill('cubic-bezier(0.2,0,0.8,1)'); await editor.locator('.ease-ed-input').press('Tab');
    await editor.getByLabel('Property', { exact: true }).selectOption('shapes/1/c');
    await editor.getByLabel('G', { exact: true }).fill('1'); await editor.getByLabel('G', { exact: true }).press('Tab');
    await editor.getByLabel('R', { exact: true }).fill('0'); await editor.getByLabel('R', { exact: true }).press('Tab');
    await editor.getByLabel('Visible', { exact: true }).uncheck();
    await editor.locator('.tl-animation-layer.is-hidden').waitFor();
    await editor.getByLabel('Visible', { exact: true }).check();
    await editor.getByLabel('Out frame', { exact: true }).fill('58'); await editor.getByLabel('Out frame', { exact: true }).press('Tab');
    await editor.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.tl-clip').length === 2);
    await page.locator('.tl-animation-open').click();
    await editor.locator('[data-layer="/0/0"]').click();
    await editor.getByLabel('Layer name', { exact: true }).fill('Independent copy'); await editor.getByLabel('Layer name', { exact: true }).press('Tab');
    await editor.getByRole('button', { name: 'Independent copy', exact: true }).waitFor();
    await page.screenshot({ path: '/tmp/lolly-internal-editor.png' });
    await editor.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.locator('[data-action="save"]').click();
    await page.locator('[data-action="format"]').selectOption('lottie', { force: true });
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-action="download"]').click()]);
    const first = readLottie(new Uint8Array(await readFile((await download.path())!))).animations[0]!.animation;
    const layers = lottieLayers(first), dot = layers.find(layer => layer.name === 'Edited nested dot')!;
    assert.ok(dot); assert.ok(layers.some(layer => layer.name === 'Independent copy'));
    assert.equal(propertyKeys(lottieTracks(dot.layer).find(track => track.id === 'p.x')!.property).length, 3);
    assert.ok(propertyKeys(lottieTracks(dot.layer).find(track => track.id === 'p.y')!.property).every(key => (key.s as number[])[0] === 32.123456789), 'editing X preserves source Y precision');
    assert.deepEqual(lottieTracks(dot.layer).find(track => track.id === 'shapes/1/c')!.property.k, [0, 1, 0, 1]);
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#tool-canvas [data-lottie-src].is-lottie-live').first().waitFor();
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.locator('[data-action="format"]').selectOption('lottie', { force: true });
    const [again] = await Promise.all([page.waitForEvent('download'), page.locator('[data-action="download"]').click()]);
    assert.deepEqual(readLottie(new Uint8Array(await readFile((await again.path())!))).animations[0]!.animation, first);
    await page.keyboard.press('Escape');
    await page.locator('.tl-clip').first().click();
    await page.locator('.tl-animation-open').click();
    await editor.locator('[data-layer="/0/0"]').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await editor.getByLabel('Layer name', { exact: true }).scrollIntoViewIfNeeded();
    assert.ok(await editor.evaluate(el => el.scrollWidth <= el.clientWidth + 2), 'internal controls fit a narrow viewport');
    await page.screenshot({ path: '/tmp/lolly-internal-narrow.png' });
  } catch (error) {
    await Promise.allSettled([page.screenshot({ path: '/tmp/lolly-internal-failure.png', timeout: 3000 }), page.content().then(html => writeFile('/tmp/lolly-internal-failure.html', html))]);
    throw error;
  }
  finally { await context.close(); await closeBrowser(); }
});
