// SPDX-License-Identifier: MPL-2.0
/** node --test tests/production.browser.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { inspectProductionBytes } from '../packages/node-shell/src/production.ts';
import { sha256Hex } from '../engine/src/bytes.ts';
import type { ProductionContract, ProductionSpec, ProductionReport } from '../engine/src/production.ts';
const skip = !existsSync(chromium.executablePath()) && 'Install Playwright Chromium for production parity.';
test('browser and Node agree on SVG semantics and native PNG comparison without fetching resources', { skip, timeout: 30_000 }, async () => {
  const bundle = await build({ entryPoints: ['shells/web/src/bridge/production.ts'], bundle: true, write: false, format: 'iife', globalName: 'Production', platform: 'browser' });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage(); const requests: string[] = [];
    await page.route('**/*', route => { requests.push(route.request().url()); return route.fulfill({ body: '<!doctype html><title>Production test</title>', contentType: 'text/html' }); });
    await page.goto('http://127.0.0.1/production-test'); await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
    const contract: ProductionContract = { profile: 'lolly/production-still-v1', id: 'browser-parity', revision: '1', format: 'svg', width: 16, height: 16, pages: 1, alpha: 'any', requirements: [{ id: 'legal', kind: 'text', location: 'legal', expected: '125' }] };
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><script>fetch("https://invalid.example/script")</script><image href="https://invalid.example/image"/><text id="legal">125</text></svg>');
    const inspect = async (bytes: Uint8Array, c: ProductionSpec, reference?: Uint8Array) => page.evaluate(async ({ data, c, ref }) => {
      const api = (globalThis as unknown as { Production: { inspectBrowserProduction(bytes: Uint8Array, contract: ProductionSpec, reference?: Uint8Array): Promise<ProductionReport> } }).Production;
      return api.inspectBrowserProduction(new Uint8Array(data), c, ref ? new Uint8Array(ref) : undefined);
    }, { data: [...bytes], c, ref: reference ? [...reference] : undefined });
    assert.deepEqual((await inspect(svg, contract)).checks, (await inspectProductionBytes(svg, contract)).checks);
    const sharp = (await import('sharp')).default;
    const png = new Uint8Array(await sharp({ create: { width: 16, height: 16, channels: 4, background: '#124578' } }).png().toBuffer());
    const raster: ProductionContract = { ...contract, format: 'png', requirements: [], alpha: 'opaque', comparison: { referenceSha256: await sha256Hex(png), channelTolerance: 0, maxChangedFraction: 0, regions: [{ id: 'logo', x: 0, y: 0, width: 8, height: 8, minSsim: 1, maxInkDelta: 0 }] } };
    const web = await inspect(png, raster, png), node = await inspectProductionBytes(png, raster, png);
    assert.deepEqual(web.checks, node.checks); assert.ok(web.checks.every(c => c.state === 'pass'));
    const motion: ProductionSpec = { profile: 'lolly/production-motion-v1', id: 'unavailable-motion', revision: '1', format: 'webm', width: 16, height: 16, requirements: [], motion: { seconds: 1, secondsTolerance: .01, fps: 24, fpsTolerance: .02, frameCount: 24, timestampTolerance: .01, audio: false } };
    assert.ok((await inspect(svg, motion)).checks.every(check => check.state === 'undetermined'), 'browser inspection cannot grant unmeasured motion conformance');
    assert.equal(requests.length, 1, 'passive inspection made no resource or script requests');
  } finally { await browser.close(); }
});
test('Verify checks uploaded requirements and records a separate local review', { skip, timeout: 30_000 }, async () => {
  const bundle = await build({ entryPoints: ['shells/web/src/views/valid-production.ts'], bundle: true, write: false, outdir: 'plans/284-validation/ui-bundle', format: 'iife', globalName: 'ProductionUi', platform: 'browser' });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ acceptDownloads: true });
    await page.route('**/*', route => route.fulfill({ body: '<!doctype html><main id="verify"></main>', contentType: 'text/html' }));
    await page.goto('http://127.0.0.1/production-test');
    await page.addScriptTag({ content: bundle.outputFiles.find(f => f.path.endsWith('.js'))!.text });
    await page.addStyleTag({ content: bundle.outputFiles.find(f => f.path.endsWith('.css'))!.text });
    await page.evaluate(() => {
      const file = new File(['<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><text id="legal">Legal 125</text></svg>'], 'card.svg', { type: 'image/svg+xml' });
      (globalThis as unknown as { ProductionUi: { wireProductionVerify(view: HTMLElement, files: () => File[], host: { export: { download(blob: Blob, name: string): Promise<void> } }): () => void } }).ProductionUi.wireProductionVerify(document.querySelector<HTMLElement>('#verify')!, () => [file], { export: { download: async (blob, name) => { const link = document.createElement('a'); const url = URL.createObjectURL(blob); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } } });
    });
    await page.getByText('Production checks', { exact: true }).click();
    const contract = { profile: 'lolly/production-still-v1', id: 'card', revision: '1', format: 'svg', width: 200, height: 100, pages: 1, alpha: 'any', requirements: [{ id: 'legal', kind: 'text', location: 'legal', expected: 'Legal 125' }] };
    await page.getByLabel('Requirements JSON').setInputFiles({ name: 'checks.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(contract)) });
    assert.equal(await page.getByLabel('File to check').inputValue(), '0');
    await page.getByRole('button', { name: 'Check requirements', exact: true }).click();
    await page.getByText('card.svg: All specified checks passed.').waitFor();
    await page.getByText('Record a local review', { exact: true }).click(); await page.getByLabel('Reviewer name').fill('Local reviewer');
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download my review' }).click();
    const stream = await (await download).createReadStream(); const chunks: Buffer[] = []; for await (const part of stream!) chunks.push(part);
    const reviewed = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(reviewed.acceptance.authority.kind, 'local-person'); assert.equal(reviewed.acceptance.reportSha256, reviewed.report.reportSha256);
    if (process.env.LOLLY_PRODUCTION_SCREENSHOT) await page.screenshot({ path: process.env.LOLLY_PRODUCTION_SCREENSHOT, fullPage: true });
  } finally { await browser.close(); }
});
