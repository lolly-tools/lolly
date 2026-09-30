// SPDX-License-Identifier: MPL-2.0
/** Verify the unified reader flow and downloaded PDF signatures against a local build. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';
import { PDFDocument, PDFArray, PDFDict, PDFName, PDFString } from 'pdf-lib';
const origin = process.argv[2] ?? 'http://127.0.0.1:4199';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
const root = resolve('plans/287-verify-forensics'),
  fixtures = root + '/design-review';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
const action = (id: string) => page.locator(`[data-actions-primary] [data-verify-action="${id}"]`);
const menu = async (id: string) => {
  await page.locator('.valid-actions-more > summary').click();
  await page.locator(`[data-actions-menu] [data-verify-action="${id}"]`).click();
};
try {
  await page.goto(`${origin}/verify/`, { waitUntil: 'networkidle' });
  await action('paste').click();
  await page.locator('[data-paste-text]').fill('A short human-written example.');
  await page.locator('[data-paste-cancel]').click();
  assert.equal(await action('paste').evaluate((el) => el === document.activeElement), true);
  await action('url').click();
  assert.equal(
    await page.locator('[data-url-input]').evaluate((el) => el === document.activeElement),
    true
  );
  await page.keyboard.press('Escape');
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles(fixtures + '/accent-left.svg');
  await page.locator('.forensic-summary').waitFor();
  await page.waitForFunction(() => !document.querySelector('.forensic[aria-busy]'));
  await page.locator('.forensic').scrollIntoViewIfNeeded();
  await page.screenshot({ path: root + '/unified-desktop.png' });
  assert.equal(await page.locator('.valid-production').isVisible(), false);
  await menu('production');
  const prod = page.locator('.valid-production');
  assert.equal(await prod.getAttribute('open'), '');
  await prod
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'requirements.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          profile: 'lolly/production-still-v1',
          id: 'review',
          revision: '1',
          format: 'svg',
          width: 500,
          height: 320,
          pages: 1,
          alpha: 'any',
          requirements: [],
        })
      ),
    });
  await prod.getByRole('button', { name: 'Check', exact: true }).click();
  await prod.locator('.valid-production-summary').waitFor();
  assert.match(await prod.locator('.valid-production-summary').innerText(), /Passed/);
  await prod.locator('.valid-production-checks details').first().locator('summary').click();
  await page.screenshot({ path: root + '/production-desktop.png' });
  let download = page.waitForEvent('download', { timeout: 60000 });
  await action('report').click();
  await (await download).saveAs(root + '/verification-sample.pdf');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await menu('paste');
  assert.equal(
    await page.locator('[data-paste-text]').evaluate((el) => el === document.activeElement),
    true
  );
  await page.keyboard.press('Escape');
  assert.equal(
    await page
      .locator('.valid-actions-more > summary')
      .evaluate((el) => el === document.activeElement),
    true
  );
  await menu('url');
  await page.keyboard.press('Escape');
  await page.locator('.forensic').scrollIntoViewIfNeeded();
  await page.screenshot({ path: root + '/unified-mobile.png' });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles(fixtures + '/mixed-pages.pdf');
  await page.locator('.forensic-summary').waitFor();
  await page.waitForFunction(() => !document.querySelector('.forensic[aria-busy]'));
  assert.equal(await prod.locator('.valid-production-summary').count(), 0);
  download = page.waitForEvent('download', { timeout: 60000 });
  await menu('report');
  await (await download).saveAs(root + '/verification-multipage.pdf');

  await page.setViewportSize({ width: 1280, height: 1000 });
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles([fixtures + '/accent-left.svg', fixtures + '/location.jpg']);
  await page.waitForFunction(
    () =>
      document.querySelectorAll('.forensic-summary').length === 2 &&
      !document.querySelector('.forensic[aria-busy]')
  );
  const second = page.locator('.valid-result[data-actions-index="1"]');
  await second.evaluate((el) => {
    const item = el.closest('details');
    if (item) item.open = true;
  });
  await page.waitForTimeout(1000);
  await second.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.waitForFunction(
    () => document.querySelector<HTMLSelectElement>('[data-actions-file]')?.value === '1'
  );
  download = page.waitForEvent('download');
  await action('report').click();
  await (await download).saveAs(root + '/verification-location.pdf');
  const first = page.locator('.valid-result[data-actions-index="0"]');
  await first.evaluate((el) => {
    const item = el.closest('details');
    if (item) item.open = true;
    el.scrollIntoView({ block: 'start' });
  });
  await page.waitForTimeout(1000);
  await page.mouse.wheel(0, -30);
  await page.waitForFunction(
    () => document.querySelector<HTMLSelectElement>('[data-actions-file]')?.value === '0'
  );
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'model-offer.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(
        'We worked in the orchard before lunch. The apples were ready and the weather stayed dry. This was our first day with the new equipment, which made the work easier for everyone. '.repeat(
          12
        )
      ),
    });
  await page.getByText('model-offer.txt', { exact: true }).first().waitFor();
  await page.locator('[data-actions-primary] [data-verify-action=skip-model]').waitFor();
  await page.locator('[data-actions-primary] [data-verify-action=skip-model]').click();
  assert.equal(await page.locator('[data-verify-action=skip-model]').count(), 0);
  assert.match((await page.locator('.forensic-coverage').textContent()) ?? '', /unavailable/);
  download = page.waitForEvent('download');
  await action('report').click();
  await (await download).saveAs(root + '/verification-text.pdf');
  for (const name of ['sample', 'multipage', 'location', 'text']) {
    const bytes = new Uint8Array(await readFile(`${root}/verification-${name}.pdf`));
    const verification = await verifyC2pa(bytes);
    assert.equal(verification.state, 'valid');
    assert.equal(verification.madeWithLolly, true);
    const pdf = await PDFDocument.load(bytes);
    assert.ok(pdf.getPageCount() >= (name === 'multipage' ? 7 : 2));
    const associated = pdf.catalog.lookup(PDFName.of('AF'), PDFArray);
    const names = associated
      .asArray()
      .map((ref) =>
        pdf.context.lookup(ref, PDFDict).lookup(PDFName.of('F'), PDFString).decodeText()
      );
    assert.ok(names.includes('evidence.json'));
    if (name === 'sample') assert.ok(names.includes('production.json'));
  }
  await page.setViewportSize({ width: 1440, height: 1080 });
  for (const target of ['unpack', 'prepare']) {
    await page.goto(`${origin}/verify/`);
    await page.locator('input[type=file]').first().setInputFiles({
      name: 'handoff.html', mimeType: 'text/html',
      buffer: Buffer.from('<h1>Handoff example</h1><p>Original file content</p>'),
    });
    await action(target).hover();
    await page.getByRole('tooltip').filter({ hasText: target === 'unpack' ? 'Unpack' : 'Prepare' }).waitFor();
    await action(target).click();
    await page.waitForURL(new RegExp(target));
    await page.getByText('handoff.html', { exact: false }).first().waitFor();
    if (target === 'unpack') await page.getByText('Original file content', { exact: false }).first().waitFor();
  }
  assert.deepEqual(errors, []);
  console.log(
    'PASS unified intake, automatic inspection, model skip, scroll targeting, policy, mobile, signed PDF previews and associated evidence'
  );
} catch (error) {
  console.log(await page.locator('[data-report-error]').allTextContents());
  await page.screenshot({ path: root + '/unified-error.png' });
  throw error;
} finally {
  await browser.close();
}
