// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import type { CorpusIndex } from './corpus.ts';
import type { ExperimentResult } from './types.ts';

const url = process.argv[2] ?? 'http://127.0.0.1:4317';
const origin = new URL(url).origin;
const corpus = await (await fetch(`${origin}/corpus`)).json() as CorpusIndex;
const ready = corpus.cases.find(c => c.mode === 'ocr' && c.status === 'ready' && c.categories.includes('picture'))!;
const inspect = corpus.cases.find(c => c.categories.includes('chart') && c.status === 'inspect')!;
assert.ok(ready && inspect, 'Use a corpus with an OCR recommendation case and a chart inspection case.');
const out = 'plans/scratch/layout-lab'; mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1050 } });
const requests: string[] = [];
const errors: string[] = [];
context.on('request', r => requests.push(r.url()));
const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
try {
  await page.goto(`${origin}/?case=${ready.id}`);
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('Real slide loaded'));
  assert.equal(await page.locator('#fixture').inputValue(), ready.id);
  await page.waitForFunction(() => {
    const img = document.querySelector<HTMLImageElement>('#reference-image');
    return img?.complete && img.naturalWidth > 0;
  });
  assert.ok((await page.locator('#artboard image').getAttribute('href'))?.startsWith('/corpus/pictures/'));
  await page.getByRole('button', { name: 'Compare this slide', exact: true }).click();
  await page.waitForSelector('[data-method="embed"]', { timeout: 120_000 });
  await page.getByRole('button', { name: 'Cancel and release model' }).click();
  await page.locator('[data-method="embed"]').click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save experiment report' }).click();
  await (await download).saveAs(`${out}/browser-corpus-report.json`);
  const report = JSON.parse(readFileSync(`${out}/browser-corpus-report.json`, 'utf8')) as { results: ExperimentResult[] };
  const embedded = report.results.find(r => r.method === 'embed');
  assert.equal(embedded?.valid, true);
  assert.equal(embedded?.backend, 'browser-wasm');
  assert.equal(embedded?.top1, null);
  assert.equal(embedded?.fixtureId, ready.id);
  await page.screenshot({ path: `${out}/real-compared.png`, fullPage: true });

  await page.locator('#collection').selectOption(`deck:${inspect.deck}`);
  await page.locator('#fixture').selectOption(inspect.id);
  await page.waitForFunction(() => document.querySelector('#status')?.textContent?.includes('Inspect the original'));
  assert.equal(await page.getByRole('button', { name: 'Compare this slide', exact: true }).isEnabled(), false);
  assert.equal(await page.getByRole('button', { name: 'Run all 18 briefs', exact: true }).isEnabled(), false);
  assert.equal(await page.locator('#results .method').count(), 0);
  assert.equal(await page.locator('#reference-image').getAttribute('src'), `/corpus/previews/${inspect.id}.png`);
  await page.waitForFunction(() => {
    const img = document.querySelector<HTMLImageElement>('#reference-image');
    return img?.complete && img.naturalWidth > 0;
  });
  await page.getByText('Extraction and OCR details', { exact: true }).click();
  assert.ok((await page.locator('#extraction-text').innerText()).includes('chart'));
  await page.screenshot({ path: `${out}/real-inspect.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.locator('#collection').selectOption('synthetic');
  assert.equal(await page.locator('#reference').isVisible(), false);
  assert.equal(await page.getByRole('button', { name: 'Compare this slide', exact: true }).isEnabled(), true);
  const denied = await page.request.get(`${origin}/corpus/cases/../../index.json`);
  assert.equal(denied.status(), 404);
  const foreign = requests.filter(u => !u.startsWith(`${origin}/`) && !u.startsWith('blob:') && !u.startsWith('data:'));
  assert.deepEqual(foreign, []); assert.deepEqual(errors, []);
  writeFileSync(`${out}/browser-corpus-check.json`, JSON.stringify({ ok: true, corpusSlides: corpus.cases.length, ready: ready.id, inspect: inspect.id, checks: ['deep link', 'source image', 'source picture in candidate', 'real WASM embedding', 'unlabelled scoring', 'unsupported chart refused', 'return to synthetic', 'mobile width', 'no external requests', 'no page errors'] }, null, 2));
  console.log(`Corpus browser checks passed: ${corpus.cases.length} slides available.`);
} finally { await browser.close(); }
