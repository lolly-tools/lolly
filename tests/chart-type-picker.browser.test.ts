// SPDX-License-Identifier: MPL-2.0
// Chart's type picker in the real web shell: open it from the keyboard, move to
// Line with the arrow keys, choose it with Enter, and the canvas and the trigger
// both follow. Gated on LOLLY_EXPORT_TEST_URL like the shell's other journeys.
import assert from 'node:assert/strict';
import test from 'node:test';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;

test('the chart type picker chooses Line from the keyboard', { skip: !origin, timeout: 120_000 }, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
    await context.addInitScript(() => {
      for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
      localStorage.setItem('lolly-guide-seen', 'chart');
    });
    const page = await context.newPage();
    await page.goto(`${origin}/#/tool/chart?rm=vector&ct=bar`);
    const trigger = page.locator('#tool-inputs [data-option-picker][data-input-id="chartType"]');
    await trigger.waitFor({ timeout: 60_000 });
    if (await page.locator('.tmpl-chooser-modal').count()) {
      await page.keyboard.press('Escape');
      await page.locator('.tmpl-chooser-modal').waitFor({ state: 'detached' });
    }
    const canvas = page.locator('#tool-canvas');
    await page.waitForFunction(() => /^bar chart/i.test(document.querySelector('#tool-canvas')?.getAttribute('aria-label') ?? ''));
    const before = await canvas.innerHTML();
    assert.equal((await trigger.textContent())?.trim(), 'Bar');
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');

    await trigger.focus();
    await page.keyboard.press('Enter');
    const listbox = page.getByRole('listbox', { name: 'Chart type' });
    await listbox.waitFor();
    assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
    const focused = (): Promise<string> => page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
    assert.equal(await focused(), 'Bar', 'opening focuses the chosen tile');
    // Down by geometry through Compare's rows into Change over time, whose first tile is Line.
    for (let i = 0; i < 6 && (await focused()) !== 'Line'; i++) await page.keyboard.press('ArrowDown');
    assert.equal(await focused(), 'Line');
    await page.keyboard.press('Enter');

    await listbox.waitFor({ state: 'detached' });
    await page.waitForFunction(() => /^line chart/i.test(document.querySelector('#tool-canvas')?.getAttribute('aria-label') ?? ''));
    const live = page.locator('#tool-inputs [data-option-picker][data-input-id="chartType"]');
    await page.waitForFunction(() => document.querySelector('#tool-inputs [data-option-picker][data-input-id="chartType"]')?.textContent?.trim() === 'Line');
    assert.equal(await live.getAttribute('aria-expanded'), 'false');
    assert.notEqual(await canvas.innerHTML(), before, 'the canvas drew the new type');
    assert.equal(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.inputId), 'chartType', 'focus is back on the trigger');
    assert.equal(await page.locator('.option-picker-panel').count(), 0, 'no panel is left on the page');
    await context.close();
  } finally {
    await closeBrowser();
  }
});
