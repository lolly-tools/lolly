// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://127.0.0.1:4317';
const origin = new URL(url).origin;
const out = '.scratch/layout-lab';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const requests: string[] = [];
const errors: string[] = [];
context.on('request', r => requests.push(r.url()));
const page = await context.newPage();
page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('Local models:'));
  assert.ok((await page.locator('#status').innerText()).includes('MiniLM ready, SmolLM ready'));
  await page.getByRole('button', { name: 'Compare this slide', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('Comparison complete'), {}, { timeout: 180_000 });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save experiment report' }).click();
  await (await download).saveAs(`${out}/browser-report.json`);
  const report = JSON.parse(readFileSync(`${out}/browser-report.json`, 'utf8')) as { results: Array<{ method: string; valid: boolean; backend: string }> };
  for (const method of ['embed', 'choice']) {
    const result = report.results.find(r => r.method === method)!;
    assert.equal(result.valid, true, `${method} must execute successfully in the browser`);
    assert.equal(result.backend, 'browser-wasm');
  }
  assert.equal(report.results.length, 4);
  await page.locator('[data-method="embed"]').click();
  await page.getByRole('button', { name: 'Use in lab', exact: true }).click();
  assert.match(await page.locator('#layout-name').innerText(), /in use in this lab/);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.doesNotMatch(await page.locator('#layout-name').innerText(), /in use in this lab/);
  await page.locator('[data-method="embed"]').click();
  await page.screenshot({ path: `${out}/compared.png`, fullPage: true });
  const designDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Design inputs', exact: true }).click();
  await (await designDownload).saveAs(`${out}/design-inputs.json`);
  const design = JSON.parse(readFileSync(`${out}/design-inputs.json`, 'utf8')) as { inputs: { boxes: Array<{ kind: string }> } };
  assert.equal(design.inputs.boxes.filter(b => b.kind === 'frame').length, 1);

  await page.getByRole('button', { name: 'Compare this slide', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('SmolLM'));
  await page.locator('#fixture').selectOption('benefits');
  await page.waitForFunction(() => document.querySelector('#slide-title')?.textContent === 'Built for small teams');
  assert.equal(await page.locator('#results .method').count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Compare this slide', exact: true }).isEnabled(), true);
  await page.locator('#request').fill('Explain the independent benefits.');
  const edited = JSON.parse(await page.locator('#brief-json').inputValue()) as { request: string };
  assert.equal(edited.request, 'Explain the independent benefits.');
  assert.equal(await page.locator('#results .method').count(), 1);

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: `${out}/mobile.png`, fullPage: true });
  const foreign = requests.filter(u => !u.startsWith(`${origin}/`) && !u.startsWith('blob:') && !u.startsWith('data:'));
  assert.deepEqual(foreign, []);
  assert.deepEqual(errors, []);
  writeFileSync(`${out}/browser-check.json`, JSON.stringify({ ok: true, checks: ['real WASM inference', 'apply and undo', 'Design input export', 'cancel on artboard change', 'mobile width', 'same-origin requests', 'no page errors'], requests: requests.length }, null, 2));
  console.log(`Browser checks passed. Report and screenshots: ${out}`);
} finally { await browser.close(); }
