// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
const origin = process.env.LOLLY_HISTORY_TEST_URL;
const skip = origin ? false : 'LOLLY_HISTORY_TEST_URL not set (serve the web shell locally)';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
const svg = (x: number): string => `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160" viewBox="0 0 320 160"><rect width="320" height="160" fill="white"/><rect x="${x}" y="40" width="60" height="60" fill="#1267bc"/></svg>`;
for (const [name, engine] of [['Chromium', chromium], ['WebKit', webkit]] as const) {
  test(`visual utility ${name}: movement, mobile swipe, keyboard, report privacy and cancellation`, { skip, timeout: 90_000 }, async () => {
    const browser = await engine.launch(), page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(`${origin}/#/compare`, { waitUntil: 'networkidle' });
      await page.getByLabel('Comparison mode', { exact: true }).selectOption('visual');
      assert.equal(await page.getByRole('textbox').count(), 0, 'visual mode hides text editors');
      await page.getByLabel('Before file', { exact: true }).setInputFiles({ name: 'CONFIDENTIAL-before.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg(20)) });
      await page.getByLabel('After file', { exact: true }).setInputFiles({ name: 'CONFIDENTIAL-after.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg(100)) });
      await page.getByRole('button', { name: 'Compare', exact: true }).tap();
      await page.getByText('1 page differs', { exact: true }).waitFor();
      assert.equal(await page.locator('.compare-visual-stage canvas').count(), 2);
      assert.match(await page.locator('.compare-page-info').innerText(), /28800\/204800/);
      await page.getByLabel('Visual comparison layout').selectOption('swipe');
      const range = page.getByRole('slider', { name: 'After visibility' }); await range.focus(); await page.keyboard.press('ArrowRight');
      assert.equal(await range.inputValue(), '51');
      await range.fill('80');
      await page.getByLabel('Visual comparison layout').selectOption('overlay');
      await page.getByLabel('Visual comparison layout').selectOption('difference');
      assert.equal(await page.locator('.compare-visual-stage canvas').count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download comparison report' }).tap();
      const stream = await (await download).createReadStream(); let report = ''; for await (const chunk of stream!) report += chunk.toString();
      assert.doesNotMatch(report, /CONFIDENTIAL|rgba|mask/); assert.equal(JSON.parse(report).summary.changed, 1);
      await page.getByLabel('Noise threshold (0–255)').fill('255'); await page.getByLabel('Noise threshold (0–255)').blur();
      await page.getByText('The sampled previews match with these options.', { exact: true }).waitFor();
      await page.getByLabel('Noise threshold (0–255)').fill('0'); await page.getByLabel('Noise threshold (0–255)').blur();
      await page.getByText('1 page differs', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Next changed page' }).tap();
      assert.equal(await page.locator('.compare-page-info').evaluate(el => el === document.activeElement), true);
      await page.evaluate(async () => { const p = '/src/theme.ts'; (await import(p)).applyTheme('dark', false); document.documentElement.dataset.a11yText = 'large'; });
      await page.locator('.compare-visual-stage').scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
      await page.screenshot({ path: `plans/229-compare-evidence/visual-${name.toLowerCase()}-mobile.png` });
      const abort = await page.evaluate(async () => {
        const p = '/src/lib/host-ref.ts'; const host = (await import(p)).getHostRef(), c = new AbortController();
        const source = { identity: { id: 'cancel', kind: 'file', label: 'cancel' }, pages: [{ page: 1, width: 768, height: 768, unit: 'px', pixelWidth: 768, pixelHeight: 768, rgba: new Uint8ClampedArray(768 * 768 * 4) }], totalPages: 1 };
        const pending = host.compare.visual({ version: 1, before: source, after: source }, { signal: c.signal }); c.abort();
        try { await pending; return 'resolved'; } catch (error) { return error instanceof Error ? error.name : 'unknown'; }
      }); assert.equal(abort, 'AbortError');
      const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, url: location.href }));
      assert.doesNotMatch(storage, /CONFIDENTIAL/); assert.deepEqual(errors, []);
      const raster = await page.evaluate(async () => {
        const h = '/src/lib/host-ref.ts', v = '/src/lib/compare-visual-sources.ts'; const host = (await import(h)).getHostRef();
        const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 80; const context = canvas.getContext('2d')!;
        const source = async (x: number) => {
          context.clearRect(0, 0, 120, 80); context.fillStyle = '#bc1267'; context.fillRect(x, 20, 20, 20);
          const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), 'image/png'));
          return (await import(v)).comparisonVisualSource(new File([blob], 'proof.png', { type: 'image/png' }), host);
        };
        const before = await source(10), after = await source(40); return (await host.compare.visual({ version: 1, before, after })).pages[0].changedPixels;
      }); assert.equal(raster, 800);
    } finally { await browser.close(); }
  });
}
test('catalog visual pairs and exact saved versions preserve selection and bytes offline', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(`${origin}/#/compare`, { waitUntil: 'networkidle' });
    const ids = await page.evaluate(async ({ before, after }) => {
      const p = '/src/lib/host-ref.ts'; const host = (await import(p)).getHostRef();
      const id = `user/upload/compare-${crypto.randomUUID()}`, other = `${id}-other`;
      await host.assets._importUserAsset({ id, type: 'vector', format: 'svg', version: 'first', blob: new Blob([before], { type: 'image/svg+xml' }), meta: { name: 'Compare proof A.svg' } });
      await host.assets._replaceUserAssetBytes(id, { blob: new Blob([after], { type: 'image/svg+xml' }) });
      await host.assets._importUserAsset({ id: other, type: 'vector', format: 'svg', version: 'first', blob: new Blob([before], { type: 'image/svg+xml' }), meta: { name: 'Compare proof B.svg' } });
      return { id, other, version: (await host.assets.get(id)).version };
    }, { before: svg(20), after: svg(100) });
    await page.goto(`${origin}/#/c`, { waitUntil: 'networkidle' });
    for (const id of [ids.id, ids.other]) await page.locator(`.cat-tile[data-id="${id}"] .cat-check`).click();
    const url = page.url(); await page.locator('.cat-bulkbar [data-bulk="compare"]').click();
    await page.getByText('1 page differs', { exact: true }).waitFor();
    await page.screenshot({ path: 'plans/229-compare-evidence/catalog-visual-desktop.png' });
    await page.getByRole('button', { name: 'Close comparison', exact: true }).click();
    assert.equal(await page.locator('.cat-tile.is-selected').count(), 2); assert.equal(page.url(), url);
    await page.evaluate(async ({ id }) => {
      const h = '/src/lib/host-ref.ts', v = '/src/views/asset-versions.ts'; await (await import(v)).openAssetVersions(id, (await import(h)).getHostRef(), async () => {});
    }, ids);
    await page.getByRole('button', { name: 'Compare with current' }).click();
    await page.getByText('1 page differs', { exact: true }).waitFor();
    assert.match(await page.locator('.compare-identities').innerText(), /first/);
    await page.getByRole('button', { name: 'Close comparison', exact: true }).click();
    await page.locator('.asset-versions-dialog [data-close]').click();
    const check = await page.evaluate(async ({ id, other }) => {
      const h = '/src/lib/host-ref.ts', a = '/src/lib/compare-asset-sources.ts', v = '/src/lib/compare-visual-sources.ts';
      const host = (await import(h)).getHostRef(), assets = await import(a);
      const pair = await assets.comparisonAssetPair([{ id, version: 'first' }, { id }], host);
      const direct = await host.compare.visual(pair.request);
      const file = new File([pair.request.before.bytes], 'before.svg'); const after = new File([pair.request.after.bytes], 'after.svg');
      const utility = await host.compare.visual({ version: 1, before: await (await import(v)).comparisonVisualSource(file, host), after: await (await import(v)).comparisonVisualSource(after, host) });
      return { version: (await host.assets.get(id)).version, old: await (await host.assets._getBlob(id, { version: 'first' })).text(), other: (await host.assets.get(other)).version, direct: direct.summary, utility: utility.summary };
    }, ids);
    assert.equal(check.version, ids.version); assert.equal(check.old, svg(20)); assert.equal(check.other, 'first'); assert.deepEqual(check.direct, check.utility);
    // Warm the component modules before going offline; byte resolution remains real IDB.
    await page.evaluate(async () => { const p = '/src/components/compare-assets.ts'; await import(p); });
    await page.context().setOffline(true);
    await page.evaluate(async ({ id }) => { const h = '/src/lib/host-ref.ts', c = '/src/components/compare-assets.ts'; (await import(c)).openAssetComparison((await import(h)).getHostRef(), [{ id, version: 'missing-version' }, { id }]); }, ids);
    await page.getByText('This exact asset version is unavailable on this device. No current copy was substituted.', { exact: true }).waitFor();
    assert.equal(await page.locator('.compare-modal canvas').count(), 0);
  } finally { await browser.close(); }
});
test('PDF comparison reports page additions, rotation, changed text and font fidelity', { skip, timeout: 90_000 }, async () => {
  const make = async (after: boolean): Promise<Buffer> => {
    const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
    const first = pdf.addPage([240, 120]); first.drawText(after ? 'Changed content' : 'Original content', { x: 10, y: 40, size: 16, font }); if (after) first.setRotation(degrees(90));
    pdf.addPage([240, 120]); if (after) pdf.addPage([240, 120]); return Buffer.from(await pdf.save());
  };
  const before = await make(false), after = await make(true), browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  try {
    await page.goto(`${origin}/#/compare`, { waitUntil: 'networkidle' }); await page.getByLabel('Comparison mode', { exact: true }).selectOption('visual');
    await page.getByLabel('Before file', { exact: true }).setInputFiles({ name: 'before.pdf', mimeType: 'application/pdf', buffer: before });
    await page.getByLabel('After file', { exact: true }).setInputFiles({ name: 'after.pdf', mimeType: 'application/pdf', buffer: after });
    await page.getByRole('button', { name: 'Compare', exact: true }).click(); await page.getByText('2 pages differ', { exact: true }).waitFor();
    assert.match(await page.locator('.compare-page-info').innerText(), /240 × 120 pt → 120 × 240 pt/);
    await page.getByText('Partial comparison. Unrendered content may differ.', { exact: true }).waitFor();
    assert.match(await page.locator('.compare-panel').innerText(), /Embedded font versions/);
    await page.getByRole('button', { name: 'Next changed page' }).click(); assert.equal(await page.getByLabel('Preview page').inputValue(), '3');
    await page.getByText('Page not present', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Swap sides' }).click(); await page.getByText('2 pages differ', { exact: true }).waitFor();
    await page.getByLabel('Preview page').selectOption('3'); assert.match(await page.locator('.compare-page-info').innerText(), /Removed/);
    await page.getByLabel('Preview page').selectOption('1'); await page.locator('.compare-visual-stage').scrollIntoViewIfNeeded(); await page.screenshot({ path: 'plans/229-compare-evidence/pdf-rotation-desktop.png' });
    const missingFont = await page.evaluate(async () => {
      const h = '/src/lib/host-ref.ts', v = '/src/lib/compare-visual-sources.ts'; const host = (await import(h)).getHostRef();
      const file = new File(['<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><text y="30" font-family="UnavailableHistoricalFont">Proof</text></svg>'], 'font.svg');
      const source = await (await import(v)).comparisonVisualSource(file, host); return (await host.compare.visual({ version: 1, before: source, after: source })).appearance;
    }); assert.equal(missingFont, 'undetermined');
  } finally { await browser.close(); }
});
