// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin = process.env.LOLLY_DESIGN_TOOL_TEST_URL;
const output = process.env.LOLLY_DESIGN_TOOL_TEST_OUTPUT || '/tmp/lolly-rules-mobile';
const skip = origin ? false : 'Set LOLLY_DESIGN_TOOL_TEST_URL to a running web shell.';

test('Rules fits an unframed document and a phone recipient edits and downloads its authored size', { skip, timeout: 120_000 }, async () => {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce' });
    const page = await context.newPage(); page.setDefaultTimeout(10_000);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const boxes = [{ id: 'title', name: 'Event title', kind: 'text', text: 'Community meetup', font: 'sans', fontSize: 44, fg: '#193c39', x: 44, y: 55, w: 550, h: 100 }];
    await page.goto(`${origin}/design?width=640&height=480&c2pa=0&imprint=0&boxes=${encodeURIComponent(JSON.stringify(boxes))}`);
    const object = page.locator('#tool-canvas [data-box-id="title"]'); await object.waitFor();
    await object.click({ button: 'right' });
    await page.getByText('Use as input', { exact: true }).click();
    const label = page.locator('.dr-input [data-rule="label"]');
    await label.fill('Event name'); await label.press('Tab');
    assert.equal(await page.locator('[data-rule="control"]').inputValue(), 'text');
    for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [844, 390], [1024, 768]]) {
      await page.setViewportSize({ width: width!, height: height! }); await page.waitForTimeout(400);
      const rects = await page.evaluate(() => {
        const rect = (selector: string) => { const b = document.querySelector(selector)!.getBoundingClientRect(); return { left:b.left, top:b.top, right:b.right, bottom:b.bottom }; };
        return { canvas: rect('#tool-canvas'), panel: rect('.dr-panel'), toolbar: rect('.dr-toolbar'), width: innerWidth, height: innerHeight };
      });
      assert.ok(rects.canvas.left >= -1 && rects.canvas.right <= rects.width + 1, `canvas width at ${width}`);
      assert.ok(rects.canvas.top >= rects.toolbar.bottom - 1, `canvas below toolbar at ${width}`);
      assert.ok(rects.canvas.bottom <= rects.panel.top + 1 || rects.canvas.right <= rects.panel.left + 1, `canvas clear of inputs at ${width}`);
      await page.getByRole('button', { name: 'Hide inputs', exact: true }).tap();
      await page.getByRole('button', { name: 'Show inputs', exact: true }).tap();
      await page.screenshot({ path: `${output}/rules-${width}x${height}.png` });
    }
    await page.getByText('Tool setup', { exact: true }).click();
    await page.locator('[data-presentation]').selectOption('on-canvas');
    await page.locator('[data-mode="preview"]').tap();
    const preview = page.locator('#design-rules-preview-canvas [data-design-width]'); await preview.waitFor();
    assert.equal(await preview.getAttribute('data-design-width'), '640'); assert.equal(await preview.getAttribute('data-design-height'), '480');
    await page.setViewportSize({ width: 360, height: 640 }); await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Edit inputs', exact: true }).tap();
    await page.locator('.dr-preview-controls [data-input-id="event_title"]').fill('Makers night');
    await page.getByRole('button', { name: 'Done', exact: true }).tap();
    await page.getByRole('button', { name: 'Share .lolly', exact: true }).tap();
    await page.locator('[data-name]').fill('Meetup maker');
    await page.locator('[data-description]').fill('Enter your event name, then download your artwork.');
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download .lolly', exact: true }).tap();
    const file = await downloading; await file.saveAs(`${output}/mobile-meetup.lolly`);
    const readerContext = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true, serviceWorkers: 'block', reducedMotion: 'reduce' });
    const reader = await readerContext.newPage(); reader.setDefaultTimeout(10_000); reader.on('pageerror', error => errors.push(error.message));
    await reader.goto(`${origin}/`);
    await reader.evaluate(async bytes => {
      const router = '/src/lib/drop-router.ts', bridge = '/src/bridge/index.ts';
      const { openLollyFile } = await import(router), { createBridge } = await import(bridge);
      void openLollyFile(new File([new Uint8Array(bytes)], 'mobile-meetup.lolly'), await createBridge());
    }, [...await readFile(`${output}/mobile-meetup.lolly`)]);
    await reader.getByRole('button', { name: 'Trust & install', exact: true }).tap();
    await reader.getByRole('button', { name: 'Edit inputs', exact: true }).tap();
    await reader.locator('[data-input-id="event_title"]').fill('Local makers night');
    await reader.locator('.lolly-locked-design').getByText('Local makers night', { exact: true }).waitFor();
    await reader.locator('#tool-inputs .input-rule-actions').first().tap();
    await reader.getByRole('button', { name: 'Reset this input', exact: true }).tap();
    await reader.waitForFunction(() => document.querySelector<HTMLInputElement>('[data-input-id="event_title"]')?.value === 'Community meetup');
    await reader.locator('.undo-toast-btn').last().tap();
    await reader.waitForFunction(() => document.querySelector<HTMLInputElement>('[data-input-id="event_title"]')?.value === 'Local makers night');
    await reader.getByRole('button', { name: 'Preview', exact: true }).tap();
    assert.equal(await reader.locator('#tool-canvas').evaluate(el => (el as HTMLElement).style.width), '640px');
    for (const [width, height] of [[320, 568], [768, 1024], [844, 390], [360, 640]]) {
      await reader.setViewportSize({ width: width!, height: height! }); await reader.waitForTimeout(250);
      await reader.getByRole('button', { name: 'Edit inputs', exact: true }).tap();
      assert.equal(await reader.locator('[data-input-id="event_title"]').inputValue(), 'Local makers night');
      await reader.getByRole('button', { name: 'Preview', exact: true }).tap();
      await reader.screenshot({ path: `${output}/recipient-${width}x${height}.png` });
    }
    const png = reader.waitForEvent('download');
    await reader.locator('.locked-actions').getByRole('button', { name: 'Download PNG', exact: true }).tap();
    await (await png).saveAs(`${output}/mobile-result.png`);
    const bytes = await readFile(`${output}/mobile-result.png`);
    assert.equal(bytes.readUInt32BE(16), 640); assert.equal(bytes.readUInt32BE(20), 480);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('an individual QR setting opens a focused reusable-tool input editor', { skip, timeout: 45_000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.goto(`${origin}/qr-code?url=https%3A%2F%2Fexample.com%2Fevent`);
    const row = page.locator('.input-row').filter({ has: page.locator('[data-input-id="url"]') });
    await row.locator('.input-rule-actions').tap();
    await page.getByRole('button', { name: 'Use as a tool input', exact: true }).tap();
    const dialog = page.getByRole('dialog', { name: 'Share with rules', exact: true }); await dialog.waitFor();
    assert.equal(await dialog.locator('[data-source-input]:checked').count(), 1);
    assert.equal(await dialog.locator('[data-source-input]:checked').getAttribute('data-source-input'), 'url');
    assert.equal(await dialog.locator('.dr-input').count(), 1);
    assert.equal(await dialog.locator('.dr-input').evaluate(el => (el as HTMLDetailsElement).open), true);
  } finally { await browser.close(); }
});

test('Sequence keeps Track height visible and a touch hold explains without playing', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block', reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(`${origin}/design?template=video`); await page.locator('.tl-panel:visible').waitFor();
    for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1024, 768], [844, 390]]) {
      await page.setViewportSize({ width: width!, height: height! }); await page.waitForTimeout(300);
      const heightButton = page.getByRole('button', { name: 'Track height', exact: true });
      const bounds = await heightButton.boundingBox(); assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width!);
      await heightButton.tap(); await page.getByRole('button', { name: 'Reset', exact: true }).tap(); await page.keyboard.press('Escape');
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(400);
    const play = page.locator('.tl-play'); const bounds = (await play.boundingBox())!;
    const client = await context.newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }] });
    await page.waitForTimeout(600);
    assert.equal(await page.getByRole('tooltip').innerText(), 'Play');
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(100); assert.equal(await play.getAttribute('aria-label'), 'Play');
    await play.tap(); await page.waitForFunction(() => document.querySelector('.tl-play')?.getAttribute('aria-label') === 'Pause'); await play.tap();
    await page.locator('.tl-mobile-tools').tap(); assert.ok(await page.locator('.tl-tool-menu .tl-kf-btn').count());
    if (await page.getByRole('tooltip').count()) await page.keyboard.press('Escape');
    await page.keyboard.press('Escape'); assert.equal(await page.locator('.tl-tool-menu').count(), 0);
  } finally { await browser.close(); }
});
