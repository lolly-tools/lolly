// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import { journeyDiagnostics } from './helpers/journey-diagnostics.ts';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { runJxl } from '../packages/node-shell/src/jxl.ts';
import { readZip } from '../engine/src/zip.ts';
import { isJxl } from '../engine/src/jxl.ts';
const origin = process.env.LOLLY_EXPORT_TEST_URL;
const offline = process.env.LOLLY_JXL_OFFLINE === '1';
test('Design keeps a JXL original through export, history and fresh-profile portable transfer', {
  skip: origin ? false : 'set LOLLY_EXPORT_TEST_URL to a local web shell', timeout: 180000,
}, async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const fresh = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const pixels = Uint8Array.from({ length: 64 * 48 * 4 }, (_, i) => i % 4 === 3 ? (i % 8 === 3 ? 0 : 255) : i % 251);
  const original = (await runJxl({ operation: 'encode', bytes: pixels, width: 64, height: 48, options: { lossless: true } })).bytes;
  for (const ctx of [context, fresh]) await ctx.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined });
    const native = window.createImageBitmap.bind(window);
    window.createImageBitmap = (async (input: ImageBitmapSource, ...args: unknown[]) => {
      if (input instanceof Blob) {
        const head = new Uint8Array(await input.slice(0, 12).arrayBuffer());
        if (input.type === 'image/jxl' || head[0] === 255 && head[1] === 10 || head[4] === 74 && head[5] === 88 && head[6] === 76) throw new Error('Native JPEG XL disabled for this test');
      }
      return (native as (...args: unknown[]) => Promise<ImageBitmap>)(input, ...args);
    }) as typeof window.createImageBitmap;
  });
  const page = await context.newPage(); page.setDefaultTimeout(20000);
  const diagnose = journeyDiagnostics(context, 'jxl-import');
  try {
    await page.goto(`${origin}/#/tool/design`, { waitUntil: 'networkidle' });
    await page.getByText('Blank canvas', { exact: true }).click();
    await page.getByRole('button', { name: 'Add a box', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Image', exact: true }).click();
    await page.mouse.move(400, 300); await page.mouse.down(); await page.mouse.move(650, 450, { steps: 6 }); await page.mouse.up();
    await page.locator('.asset-picker-upload input[type=file]').setInputFiles({ name: 'source.jxl', mimeType: 'image/jxl', buffer: Buffer.from(original) });
    const visibleImage = () => page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLImageElement>('#tool-canvas img')).some(img => img.naturalWidth === 64 && img.naturalHeight === 48));
    await visibleImage();
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.locator('[data-action=save]').click();
    await page.locator('[data-action=format]').selectOption('jxl-lossless', { force: true });
    await page.locator('[data-action=protection-toggle]').click();
    await page.locator('[data-action=imprint]').uncheck();
    const [jxl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-action=download]').click()]);
    assert.match(jxl.suggestedFilename(), /\.jxl$/);
    const encoded = await readFile((await jxl.path())!);
    const decoded = await runJxl({ operation: 'decode', bytes: encoded });
    assert.equal(decoded.info?.width, 1920); assert.equal(decoded.info?.height, 1080); assert.equal(decoded.info?.bitsPerSample, 8);
    await page.locator('[data-action=format]').selectOption('png', { force: true });
    await page.locator('[data-action=pdf-c2pa]').uncheck({ force: true });
    const [png] = await Promise.all([page.waitForEvent('download'), page.locator('[data-action=download]').click()]);
    const pngPixels = await sharp(await readFile((await png.path())!)).ensureAlpha().raw().toBuffer();
    let alphaDelta = 0, opaqueDelta = 0, colourDelta = 0;
    for (let i = 0; i < pngPixels.length; i += 4) {
      alphaDelta = Math.max(alphaDelta, Math.abs(decoded.bytes[i + 3]! - pngPixels[i + 3]!));
      for (let c = 0; c < 3; c++) {
        const delta = Math.abs(decoded.bytes[i + c]! - pngPixels[i + c]!);
        colourDelta = Math.max(colourDelta, delta);
        if (pngPixels[i + 3] === 255) opaqueDelta = Math.max(opaqueDelta, delta);
      }
    }
    assert.equal(alphaDelta, 0); assert.equal(opaqueDelta, 0);
    // Native PNG encoding and canvas readback can round translucent colour differently.
    assert.ok(colourDelta <= 1, `translucent colour differs by ${colourDelta} levels`);
    await page.reload({ waitUntil: 'networkidle' }); await visibleImage();
    // The restored export panel also carries Share and can hide while the inspector
    // mounts. Target the Design toolbar instead of whichever Share appears first.
    await page.getByRole('toolbar', { name: 'Design tools', exact: true })
      .getByRole('button', { name: 'Share', exact: true }).click();
    const [portable] = await Promise.all([page.waitForEvent('download'), page.locator('[data-lolly-download]').click()]);
    const archive = await readFile((await portable.path())!);
    const sources = readZip(archive).filter(entry => isJxl(entry.bytes));
    assert.equal(sources.length, 1); assert.deepEqual(sources[0]!.bytes, original);
    const receiver = await fresh.newPage(); receiver.setDefaultTimeout(20000);
    await receiver.goto(origin!, { waitUntil: 'networkidle' });
    await receiver.evaluate(bytes => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array(bytes)], 'JXL.lolly', { type: 'application/vnd.lolly+zip' }));
      document.querySelector('#view')!.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
    }, Array.from(archive));
    await receiver.getByRole('button', { name: 'Open shared design', exact: true }).click();
    await receiver.waitForFunction(() => Array.from(document.querySelectorAll<HTMLImageElement>('#tool-canvas img')).some(img => img.naturalWidth === 64 && img.naturalHeight === 48));
    if (offline) {
      await page.getByRole('button', { name: 'Done', exact: true }).click();
      await page.evaluate(async () => { await navigator.serviceWorker.ready; });
      await context.setOffline(true);
      await page.reload({ waitUntil: 'load' }); await visibleImage();
      await page.getByRole('button', { name: 'Export', exact: true }).click();
      await page.locator('[data-action=format]').selectOption('jxl-lossless', { force: true });
      const [cached] = await Promise.all([page.waitForEvent('download'), page.locator('[data-action=download]').click()]);
      assert.ok(isJxl(await readFile((await cached.path())!)));
    }
  } catch (error) { await diagnose(error); throw error; } finally { await context.close(); await fresh.close(); await closeBrowser(); }
});
