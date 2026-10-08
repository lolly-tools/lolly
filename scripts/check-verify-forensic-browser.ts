// SPDX-License-Identifier: MPL-2.0
/** Exercise the built Verify UI with local files; artifacts stay under plans. */
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';
import type { ForensicReport } from '../engine/src/forensic.ts';
const origin = process.argv[2] ?? 'http://127.0.0.1:4198';
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname));
const root = resolve('plans/287-verify-forensics'),
  fixtures = join(root, 'design-review');
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ args: webGpuLaunchArgs('software') }),
  page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(30_000);
const errors: string[] = [],
  uploads: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => {
  if (request.method() === 'POST') uploads.push(request.url());
});
await page.route('**/*', (route) => {
  const url = new URL(route.request().url());
  return ['data:', 'blob:'].includes(url.protocol) || url.origin === new URL(origin).origin
    ? route.continue()
    : route.abort();
});
const panel = page.locator('.forensic');
const open = async (name: string) => {
  await page.goto(`${origin}/verify/`, { waitUntil: 'networkidle' });
  await page.locator('input[type=file]').first().setInputFiles(join(fixtures, name));
  await panel.locator('.forensic-summary').waitFor();
  await page.waitForFunction(() => !document.querySelector('.forensic[aria-busy]'));
  // The report inspected itself; the toolbar must not ask for it again.
  assert.equal(await page.locator('[data-actions-primary] [data-verify-action=ai]').count(), 0, name);
};
const rerun = async () => {
  await page.locator('.valid-actions-more > summary').click();
  await page.locator('[data-actions-menu] [data-verify-action=ai-again]').click();
};
const exported = async () => {
  const pending = page.waitForEvent('download');
  await page.locator('.valid-actions-more > summary').click();
  await page.locator('[data-actions-menu] [data-verify-action=json-ai]').click();
  const download = await pending;
  return JSON.parse(await readFile((await download.path())!, 'utf8')) as {
    report: ForensicReport;
    annotations: unknown[];
  };
};
try {
  await open('accent-left.svg');
  const before = await exported();
  assert.ok(before.report.findings.some((f) => f.family === 'fingernail-card'));
  assert.ok(before.report.findings.some((f) => f.rule === 'redundant-eyebrow'));
  assert.equal(before.report.likelihood.state, 'unavailable');
  const zoom = panel.getByRole('slider', { name: 'Preview zoom' });
  await zoom.focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await zoom.inputValue(), '101');
  await zoom.fill('160');
  await panel.getByLabel('Evidence filter').selectOption('layout');
  assert.equal(await zoom.inputValue(), '160');
  await panel.locator('.forensic-findings button').last().click();
  await panel.locator('.forensic-locations button').last().click();
  assert.equal(await panel.locator('.forensic-region.is-selected').count(), 1);
  await panel.getByText('Review', { exact: true }).click();
  await panel
    .locator('[data-forensic-note]')
    .fill('Test review: verify against the brand requirements.');
  await panel.getByRole('button', { name: 'Save', exact: true }).click();
  const reviewed = await exported();
  assert.deepEqual(reviewed.report.evidence, before.report.evidence);
  assert.equal(reviewed.annotations.length, 1);
  await panel
    .locator('[data-forensic-reload]')
    .setInputFiles({
      name: 'review.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(reviewed)),
    });
  await panel.getByText(/Imported report: its hashes match/).waitFor();
  const tampered = structuredClone(reviewed);
  tampered.report.evidence.score = 100;
  await panel
    .locator('[data-forensic-reload]')
    .setInputFiles({
      name: 'changed.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(tampered)),
    });
  await panel
    .getByText('Evidence does not match this file, or its report hash changed.', { exact: true })
    .waitFor();
  await zoom.fill('100');
  await open('accent-left.svg');
  await panel.screenshot({ path: join(root, 'verify-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await panel.screenshot({ path: join(root, 'verify-mobile.png') });
  await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  for (const name of [
    'accent-left.png',
    'accent-left.pdf',
    'native-patterns.pptx',
    'numbering.txt',
  ]) {
    await open(name);
    const result = await exported();
    assert.equal(result.report.pages.length, 1, name);
    assert.ok(result.report.findings.length, `${name}: no findings`);
    assert.equal(
      result.report.coverage.some((c) => c.state === 'failed'),
      false,
      name
    );
    if (name.endsWith('.pptx'))
      for (const family of ['fingernail-card', 'eyebrow-heading', 'decorative-numbering'])
        assert.ok(
          result.report.findings.some((f) => f.family === family),
          `${name}: ${family}`
        );
    console.log(
      name,
      result.report.findings.map((f) => f.rule),
      result.report.coverage.map((c) => `${c.collector}:${c.state}`)
    );
  }
  await open('mixed-pages.pdf');
  assert.equal((await exported()).report.pages.length, 6);
  await panel.locator('[data-forensic-page]').selectOption('2');
  assert.match(await panel.locator('.forensic-preview img').getAttribute('alt') ?? '', /2/);
  await rerun();
  await page.waitForFunction(() => document.querySelectorAll('.forensic [data-forensic-page] option').length === 8);
  assert.equal((await exported()).report.pages.length, 8);
  await open('accent-left.svg');
  await page.context().setOffline(true);
  await rerun();
  await panel.locator('.forensic-summary').waitFor();
  await page.waitForFunction(() => !document.querySelector('.forensic[aria-busy]'));
  assert.equal((await exported()).report.pages.length, 1);
  await page.context().setOffline(false);
  await page.locator('[data-actions-menu] [data-verify-action=ai-again]').evaluate((button) => {
    const workspace = document.querySelector('.forensic');
    (button as HTMLButtonElement).click();
    (workspace?.querySelector('[data-forensic=cancel]') as HTMLButtonElement | null)?.click();
  });
  await panel.locator('.forensic-summary').waitFor();
  await page.waitForFunction(() => !document.querySelector('.forensic[aria-busy]'));
  const cancelled = await exported();
  assert.ok(cancelled.report.coverage.some((c) => c.state === 'cancelled'));
  await rerun();
  await page.locator('input[type=file]').first().setInputFiles(join(fixtures, 'numbering.txt'));
  await panel.locator('.forensic-summary').waitFor();
  await page.waitForFunction(() => !document.querySelector('.forensic[aria-busy]'));
  assert.equal((await exported()).report.format, 'text');
  assert.deepEqual(errors, []);
  assert.deepEqual(uploads, []);
  console.log(
    'PASS: formats, located findings, keyboard, zoom, mobile width, immutable review, reload validation, offline retry, cancellation, no uploads.'
  );
} finally {
  await browser.close();
}
