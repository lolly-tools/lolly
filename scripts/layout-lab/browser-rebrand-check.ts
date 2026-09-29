// SPDX-License-Identifier: MPL-2.0
/** Exercise the integrated Rebrand chooser in a running web shell. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:5175';
const out = 'plans/scratch/layout-lab';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [];
const external: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => {
  if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(base).origin) external.push(request.url());
});
try {
  await page.goto(`${base}/#/rebrand`);
  await page.getByRole('button', { name: 'Try the sample deck', exact: false }).click();
  await page.locator('.rb-thumb-pick').first().waitFor({ timeout: 60_000 });
  await page.locator('.rb-thumb-pick').first().click();
  await page.locator('[data-key=layout-change]').click();
  await page.locator('[data-layout-options]').waitFor();
  console.log('Production chooser mounted');
  await page.locator('[data-layout-option]').first().waitFor({ timeout: 60_000 });
  assert.match(await page.locator('[data-layout-options] [role="status"]').innerText(), /Select a layout to preview/);
  const initial = await page.locator('[data-layout-option]').evaluateAll(nodes => nodes.map(n => (n as HTMLElement).dataset.layoutOption));
  assert.ok(initial.length > 0 && initial.length <= 3);
  await page.screenshot({ path: `${out}/rebrand-rules.png` });
  console.log('Rules and worker checks passed', initial);
  await page.locator('.rb-layout-refine summary').click();
  const download = page.locator('[data-key="layout-model"]');
  if (await download.isVisible()) {
    await download.click();
    await download.waitFor({ state: 'hidden', timeout: 120_000 });
  }
  await page.locator('[data-key="layout-intent"]').fill('Opening title and subtitle');
  const localStarted = performance.now();
  await page.locator('[data-key="suggest-layouts"]').click();
  await page.waitForFunction(() => document.querySelector('[data-layout-options]')?.getAttribute('data-matching') === 'local', undefined, { timeout: 90_000 });
  await page.locator('[data-layout-option]').first().waitFor();
  const local = await page.locator('[data-layout-option]').evaluateAll(nodes => nodes.map(n => (n as HTMLElement).dataset.layoutOption));
  const localMs = Math.round(performance.now() - localStarted);
  console.log('Real browser MiniLM passed', local);
  await page.locator('[data-layout-option]').last().hover();
  await page.locator('[data-chooser-preview]').waitFor();
  await page.screenshot({ path: `${out}/rebrand-local.png` });
  await page.locator('[data-layout-option]').last().click();
  assert.equal(await page.locator('.rb-lc-pop').count(), 1, 'selecting only previews');
  await page.locator('[data-key=apply-layout-option]').click();
  await page.locator('.rb-lc-pop').waitFor({ state: 'detached' });
  await page.locator('.rb-undo').click();
  console.log('Applied through the controller and undone');
  await page.locator('.rb-thumb-pick').first().click();
  await page.keyboard.press('l');
  await page.keyboard.press('Escape');
  await page.locator('.rb-lc-pop').waitFor({ state: 'detached' });
  await page.waitForTimeout(500);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.rb-thumb-pick').first().click();
  await page.keyboard.press('l');
  await page.locator('[data-layout-option]').first().waitFor({ timeout: 90_000 });
  const widths = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth, pop: document.querySelector('.rb-lc-pop')!.getBoundingClientRect().width }));
  assert.ok(widths.page <= widths.viewport && widths.pop <= widths.viewport);
  await page.screenshot({ path: `${out}/rebrand-mobile.png` });
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  writeFileSync(`${out}/browser-rebrand-report.json`, JSON.stringify({ base, initial, local, localMs, widths, errors, external, passed: true }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${out}/rebrand-failure.png` });
  console.error((await page.locator('body').innerText()).slice(-9000), errors);
  throw error;
} finally { await browser.close(); }
