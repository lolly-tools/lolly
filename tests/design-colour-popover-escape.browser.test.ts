// SPDX-License-Identifier: MPL-2.0
/**
 * Escape closes a colour popover in Lolly Design on the first press, after a pick and with
 * no pick, on the rail and in the inspector, and hands focus back to its trigger. The rail's
 * colour well wears a tip, and that tip used to take the press while the popover stayed open.
 *
 *   LOLLY_IMPORT_TEST_URL=http://127.0.0.1:5173 node --import ./tests/browser-gpu.ts --test tests/design-colour-popover-escape.browser.test.ts
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_IMPORT_TEST_URL;
const options = { skip: origin ? false : 'set LOLLY_IMPORT_TEST_URL to a local Vite shell', timeout: 240_000 };

const opened = (page: Page): Promise<number> => page.locator('.color-popover:not([hidden])').count();
const focusIsOn = (page: Page, id: string): Promise<boolean> => page.evaluate(field => document.activeElement === document.querySelector(`[data-color-field="${field}"] .color-trigger`), id);

/** Open one field, optionally pick its first swatch, and hold Escape to closing it in one press. */
async function checkField(page: Page, id: string): Promise<void> {
  const trigger = page.locator(`[data-color-field="${id}"] .color-trigger`);
  await trigger.click();
  assert.equal(await opened(page), 1, `${id} opens`);
  await page.keyboard.press('Escape');
  assert.equal(await opened(page), 0, `${id}: one press closes the popover with no pick`);
  assert.equal(await focusIsOn(page, id), true, `${id}: focus goes back to the trigger`);

  await trigger.click();
  await page.locator(`[data-color-field="${id}"] .color-popover .color-swatch`).first().click();
  // A pick repaints the field's row on this page: read the popover again, by the field.
  await page.waitForTimeout(250);
  assert.equal(await opened(page), 1, `${id} stays open after a pick`);
  await page.keyboard.press('Escape');
  assert.equal(await opened(page), 0, `${id}: one press closes the popover after a pick`);
}

test('in Design, Escape closes a colour popover on the first press', options, async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.LOLLY_BROWSER_CHANNEL });
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  try {
    await context.addInitScript(() => {
      for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack', 'lolly:ds-name-asked:default']) localStorage.setItem(key, '1');
    });
    const page = await context.newPage();
    await page.goto(`${origin}/#/tool/design`, { waitUntil: 'networkidle' });
    await shellSettled(page);
    await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden', timeout: 60_000 }).catch(() => {});
    await page.keyboard.press('Escape');

    // Nothing selected: the rail's well, which wears a tip, and the document's default fill.
    await page.locator('[data-color-field="fc-bg"] .color-trigger').waitFor();
    await checkField(page, 'fc-bg');
    await checkField(page, 'fc-insp-bg');

    // No tip floats over the swatches while the pointer is in the popover.
    await page.locator('[data-color-field="fc-bg"] .color-trigger').click();
    await page.locator('[data-color-field="fc-bg"] .color-popover .color-swatch').first().hover();
    assert.equal(await page.locator('.lolly-tooltip', { hasText: 'Artboard fill' }).count(), 0);
    await page.keyboard.press('Escape');

    // A keyboard person: focus shows the tip, Enter opens, and one Escape still closes.
    const well = page.locator('[data-color-field="fc-bg"] .color-trigger');
    await page.mouse.move(700, 880);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await well.focus();
    assert.equal(await page.locator('.lolly-tooltip', { hasText: 'Artboard fill' }).count(), 1, 'the tip is up');
    await page.keyboard.press('Enter');
    assert.equal(await opened(page), 1);
    await page.keyboard.press('Escape');
    assert.equal(await opened(page), 0, 'one press from the keyboard too');

    // A box selected: the inspector's fill and stroke.
    await page.mouse.click(420, 620);
    await page.locator('[data-color-field="fc-insp-fill"] .color-trigger').waitFor();
    await checkField(page, 'fc-insp-fill');
    await checkField(page, 'fc-insp-stroke');
  } finally { await context.close(); await browser.close(); }
});
