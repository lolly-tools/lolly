// SPDX-License-Identifier: MPL-2.0
/** Check a private flattened deck through the real import, OCR and chooser flow. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const file = process.argv[2];
if (!file) throw new Error('Pass the Lolly_Strategic_Vision.pptx corpus file.');
const base = process.argv[3] ?? 'http://127.0.0.1:5175';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = [];
const external: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(base).origin) external.push(request.url()); });
try {
  await page.goto(`${base}/#/rebrand`);
  await page.locator('input[type=file]').setInputFiles(file);
  await page.getByRole('button', { name: 'Read the text', exact: true }).click({ timeout: 60_000 });
  await page.getByRole('dialog').getByRole('button', { name: 'Download', exact: true }).click();
  console.log('OCR download requested through the normal offer');
  await page.waitForFunction(() => document.body.textContent?.includes('Rebuilt 15 slides from their pictures.'), undefined, { timeout: 180_000 });
  console.log('Editable text recovered in the production preview');
  await page.locator('.rb-thumb-pick').first().click();
  const original = page.locator('[data-pane="original"] img.rb-art-pic');
  await original.waitFor();
  const originalSrc = await original.getAttribute('src');
  assert.ok(originalSrc);
  assert.ok(await page.locator('[data-pane="original"] .rb-ov').count() > 1);
  assert.equal(await page.locator('[data-pane="original"] [data-art] svg').count(), 0);
  await page.locator('[data-pane="original"] .rb-ov').last().click();
  await page.getByRole('button', { name: 'Back to slide', exact: true }).click();
  await page.keyboard.press('l');
  await page.locator('[data-layout-option]').first().waitFor({ timeout: 60_000 });
  assert.match(await page.locator('[data-layout-options] [role="status"]').innerText(), /recognised text/);
  const ids = await page.locator('[data-layout-option]').evaluateAll(nodes => nodes.map(n => (n as HTMLElement).dataset.layoutOption));
  await page.locator('[data-layout-option]').last().hover();
  await page.screenshot({ path: 'plans/scratch/layout-lab/rebrand-ocr.png' });
  await page.locator('[data-layout-option]').last().click();
  await page.locator('[data-key=apply-layout-option]').click();
  if (await page.locator('.rb-undo').isEnabled()) await page.locator('.rb-undo').click();
  assert.equal(await original.getAttribute('src'), originalSrc, 'layout edits never redraw the original picture');
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  writeFileSync('plans/scratch/layout-lab/browser-rebrand-ocr-report.json', JSON.stringify({ ids, errors, external, passed: true }, null, 2));
} catch (error) {
  await page.screenshot({ path: 'plans/scratch/layout-lab/rebrand-ocr-failure.png' });
  console.error((await page.locator('body').innerText()).slice(-6000), errors);
  throw error;
} finally { await browser.close(); }
