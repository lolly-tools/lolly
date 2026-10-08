// SPDX-License-Identifier: MPL-2.0
/** LOLLY_IMPORT_TEST_URL=http://127.0.0.1:5188 LOLLY_BROWSER_CHANNEL=chrome node --test tests/design-svg-import.browser.test.ts */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';

const origin = process.env.LOLLY_IMPORT_TEST_URL;
test('SVG import keeps brand font snapping, fits both text layers and offers Type setup without losing the design', {
  skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 120_000,
}, async (ctx) => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await context.addInitScript(() => {
    for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
  });
  try {
    await page.goto(`${origin}/#/p`, { waitUntil: 'networkidle' });
    const [chooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Open a file - import a .lolly, design or image' }).click(),
    ]);
    await chooser.setFiles(fileURLToPath(new URL('./fixtures/public-journeys/welcome.svg', import.meta.url)));
    await page.getByRole('button', { name: 'Edit in Design', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'This design uses your brand fonts' }).waitFor();
    assert.match(await page.locator('dialog').innerText(), /Arial/);
    assert.match(await page.locator('dialog').innerText(), /Make it yours → Type/);
    const headline = page.locator('#tool-canvas .lolly-box-text').filter({ hasText: 'Welcome to Northstar' });
    const supportingText = page.locator('#tool-canvas .lolly-box-text').filter({ hasText: 'Make something useful together.' });
    const textMetrics = () => page.locator('#tool-canvas .lolly-box-text').evaluateAll(elements => elements.filter(el => el.textContent?.trim()).map(el => {
      const box = el.closest<HTMLElement>('.lolly-box')!;
      const text = el as HTMLElement;
      return { text: text.textContent, width: box.clientWidth, height: box.clientHeight,
        needWidth: text.scrollWidth, needHeight: text.scrollHeight,
        padding: getComputedStyle(text).padding, font: getComputedStyle(text).fontFamily };
    }));
    await Promise.all([headline.waitFor(), supportingText.waitFor()]);
    await page.evaluate(() => document.fonts.ready);
    const firstText = await textMetrics();
    assert.deepEqual(firstText.map(layer => layer.text?.trim()).sort(), ['Make something useful together.', 'Welcome to Northstar']);
    await page.getByRole('button', { name: 'Add brand fonts', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(/area=type/);
    await page.getByRole('heading', { name: 'Make it yours', exact: true }).waitFor();
    await page.goBack();
    await Promise.all([headline.waitFor(), supportingText.waitFor()]);
    await page.evaluate(() => document.fonts.ready);
    const text = [...firstText, ...await textMetrics()];
    assert.equal(text.length, 4);
    for (const layer of text) {
      assert.ok(layer.needWidth <= layer.width + 0.5, `${layer.text}: horizontal clipping ${JSON.stringify(layer)}`);
      assert.ok(layer.needHeight <= layer.height + 0.5, `${layer.text}: vertical clipping ${JSON.stringify(layer)}`);
      assert.equal(layer.padding, '0px', JSON.stringify(layer));
      assert.doesNotMatch(layer.font, /^Arial(?:,|$)/, 'uninstalled Arial still snaps to the brand font');
    }
    const unchanged = await page.evaluate(async () => {
      const path = '/src/views/design-import-text.ts';
      const { prepareSvgText } = await import(path);
      const nodes = [{ kind: 'text', text: 'Known face\nSecond line', fontFamily: 'SUSE', fontSize: 24, w: 700, h: 200 }];
      const remapped = await prepareSvgText(nodes, { fonts: { knownFamilies: ['SUSE'] } });
      return { remapped, width: nodes[0]!.w, height: nodes[0]!.h };
    });
    assert.deepEqual(unchanged, { remapped: [], width: 700, height: 200 }, 'known fonts are quiet and existing space is retained');
  } catch (error) {
    ctx.diagnostic(JSON.stringify({ url: page.url(), dialogs: await page.locator('dialog').allTextContents(), focused: await page.locator(':focus').evaluateAll(es => es.map(e => e.outerHTML.slice(0,300))) }));
    throw error;
  } finally { await context.close(); await closeBrowser(); }
});
