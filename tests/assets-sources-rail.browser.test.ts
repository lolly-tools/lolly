// SPDX-License-Identifier: MPL-2.0
/**
 * The Sources rail's width grip in the actual Assets view: the layout the stylesheet
 * gives the rail and its grip, a keyboard and a pointer resize, the width kept across a
 * reload, the cap a narrow window applies, a closed rail and the phone layout. The
 * grip's own logic is covered by shells/web/src/views/assets/sources.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';

const origin = process.env.LOLLY_ASSETS_TEST_URL ?? process.env.LOLLY_IMPORT_TEST_URL;

test('the Sources rail resizes from its grip, keeps the width and leaves the listing its room', { skip: origin ? false : 'set LOLLY_ASSETS_TEST_URL or LOLLY_IMPORT_TEST_URL to a running web shell', timeout: 120_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin!).hostname));
  const browser = await getBrowser(), context = await browser.newContext({ viewport: { width: 1360, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage(); const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const box = (selector: string) => page.locator(selector).first().evaluate(element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, height: r.height }; });
  const railWidth = async () => Math.round((await box('.asset-sources')).width);
  const grip = page.getByRole('separator', { name: 'Resize the Sources panel' });
  try {
    await page.goto(`${origin}/#/a`, { waitUntil: 'domcontentloaded' });
    await page.locator('.asset-sources [role=tree]').waitFor({ state: 'visible' });
    await grip.waitFor({ state: 'visible' });

    const rail = await box('.asset-sources'), strip = await box('.asset-sources-grip'), body = await box('.catalog-body');
    assert.equal(Math.round(rail.width), 240, 'the default width');
    assert.equal(Math.round(body.left - rail.right), 20, 'the grip takes no room from the rail or the listing');
    assert.ok(strip.left < body.left && strip.right > rail.right, 'the grip lies across the gap');
    assert.equal(Math.round(strip.height), Math.round(rail.height), 'the grip is as tall as the rail');

    await grip.focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await railWidth(), 256);

    const at = (await grip.boundingBox())!;
    await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
    await page.mouse.down();
    await page.mouse.move(at.x + at.width / 2 + 60, at.y + at.height / 2, { steps: 6 });
    await page.mouse.up();
    assert.equal(await railWidth(), 316, 'a drag follows the pointer');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await grip.waitFor({ state: 'visible' });
    assert.equal(await railWidth(), 316, 'the width survives a reload');
    assert.equal(await grip.getAttribute('aria-valuenow'), '316');

    // A narrow window caps the rail, and the grip's value says what the rail shows.
    await grip.focus();
    await page.keyboard.press('End');
    assert.equal(await railWidth(), 480);
    await page.setViewportSize({ width: 760, height: 900 });
    const workspace = await box('.catalog-workspace'), capped = await box('.asset-sources');
    assert.ok(capped.width < 480 && capped.width <= workspace.width - 340 + 1, `the listing keeps 320px and the gap (rail ${capped.width}, workspace ${workspace.width})`);
    await grip.evaluate(element => (element as HTMLElement).blur());
    await grip.focus();
    assert.ok(Math.abs(Number(await grip.getAttribute('aria-valuenow')) - capped.width) <= 1, 'the grip and the stylesheet agree on the cap');
    await page.setViewportSize({ width: 1360, height: 900 });
    assert.equal(await railWidth(), 480, 'a wider window gives the wanted width back');

    // A closed rail takes its grip with it and leaves no gap.
    await page.locator('[data-browse-sources]').click();
    assert.equal(await page.locator('.asset-sources-column').isVisible(), false);
    assert.equal(Math.round((await box('.catalog-body')).left), Math.round((await box('.catalog-workspace')).left));
    await page.locator('[data-browse-sources]').click();
    await grip.waitFor({ state: 'visible' });

    // On a phone the rail stacks above the listing and has no grip.
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await grip.isVisible(), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
  } catch (error) {
    console.error(JSON.stringify({ errors, body: (await page.locator('body').innerText()).slice(0, 1500) }));
    throw error;
  } finally { await context.close(); await closeBrowser(); }
});
