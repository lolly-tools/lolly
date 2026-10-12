// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';

const origin = process.env.LOLLY_GALLERY_TEST_URL;
test('native layout hover stays idle while deliberate pointer and keyboard intent prewarm', {
  skip: origin ? false : 'Set LOLLY_GALLERY_TEST_URL to the local Vite shell.', timeout: 30_000,
}, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 600, height: 400 } });
    await page.route('**/__prewarm-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
    await page.goto(`${origin}/__prewarm-fixture`);
    await page.evaluate(async () => {
      const path = '/src/lib/view-prewarm-intent.ts', module = await import(path);
      document.body.innerHTML = '<a href="#/tool/design" style="position:fixed;inset:0;width:100px;height:100px">Design</a><a href="#/p" style="position:fixed;left:120px;top:120px;width:100px;height:100px">Projects</a>';
      const events: string[] = [];
      module.wireViewPrewarmIntent(document, (target: Element) => { events.push(target.closest('a')?.getAttribute('href') ?? ''); }, () => false);
      Reflect.set(window, '__prewarmEvents', events);
    });
    const events = (): Promise<string[]> => page.evaluate(() => Reflect.get(window, '__prewarmEvents'));
    await page.mouse.move(0, 0);
    assert.deepEqual(await events(), [], 'a stationary pointer entering newly painted art starts no work');
    await page.locator('a').first().focus();
    assert.deepEqual(await events(), [], 'programmatic autofocus starts no work');
    await page.locator('a').first().evaluate(node => (node as HTMLElement).blur());
    await page.mouse.move(150, 150);
    assert.deepEqual(await events(), ['#/p'], 'real hover still warms the destination before a click');
    await page.mouse.move(170, 160, { steps: 10 });
    assert.deepEqual(await events(), ['#/p'], 'moving within one element does not repeat navigation lookups');
    await page.keyboard.press('Tab');
    assert.ok((await events()).length > 1, 'keyboard focus still warms its destination');
    const count = (await events()).length;
    await page.locator('a').first().dispatchEvent('pointerdown', { pointerType: 'touch' });
    assert.equal((await events()).length, count + 1, 'touch activation warms before navigation');
  } finally { await browser.close(); }
});
