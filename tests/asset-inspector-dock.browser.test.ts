// SPDX-License-Identifier: MPL-2.0
/** Real asset modal layout, splitter gestures, disclosure state and the narrow credential journey. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
const origin = process.env.LOLLY_ASSETS_TEST_URL ?? process.env.LOLLY_IMPORT_TEST_URL;
const entry = { id: 'ext/dam/art', name: 'Campaign artwork', provider: 'dam', type: 'vector', version: '1234567890123456',
  formats: [{ format: 'svg', url: '/catalog/ext/dam/art/one' }],
  meta: { providerLabel: 'Campaign library', assetFiles: [{ id: 'a'.repeat(24), name: 'art.svg', format: 'svg', role: 'original', url: '/catalog/ext/dam/art/one' }] } };

test('asset inspector resizes, collapses and keeps the complete journey readable at narrow widths', { skip: origin ? false : 'set LOLLY_ASSETS_TEST_URL or LOLLY_IMPORT_TEST_URL to a local web shell', timeout: 120_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin!).hostname));
  const browser = await getBrowser(), context = await browser.newContext({ viewport: { width: 1360, height: 1000 } }), page = await context.newPage();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/catalog/assets/index.json*', route => route.fulfill({ json: { assets: [] } }));
  await page.route('**/catalog/ext/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#075b50"/><text x="50" y="240" font-size="50" fill="white">Campaign artwork</text></svg>' }));
  await page.route('**/api/v1/catalog/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/sources')) return route.fulfill({ json: { scope: 'fixture', sources: [{ id: 'dam', label: 'Campaign library', status: 'current', count: 1 }] } });
    if (path === '/api/v1/catalog/assets') return route.fulfill({ json: { assets: [entry], total: 1, nextCursor: null, version: 'fixture', complete: true,
      capabilities: { indexedFilters: ['scope', 'q', 'source', 'types', 'tag', 'taxonomyKind', 'taxonomyId'] }, facets: { sources: [], sections: [], collections: [], tags: [], types: [] } } });
    return route.fulfill({ json: { ...entry, canEdit: false, fields: { campaign: 'Launch' }, fieldDefs: [{ id: 'campaign', label: 'Campaign', kind: 'text' }] } });
  });
  const injectJourney = async () => page.evaluate(async () => {
    const path = '/src/views/valid.ts'; const { stepsHtml } = await import(path);
    const report = { state: 'unverified', history: [{ action: 'c2pa.metadata', softwareAgent: 'Lolly', when: '2026-08-10T02:14:00Z', description: 'Author, copyright and licence embedded. Long recorded source: ' + 'recorded-value-'.repeat(12) }] };
    const box = document.querySelector<HTMLElement>('.cat-cred-panels')!; box.innerHTML = stepsHtml(report); box.hidden = false;
  });
  const noOverflow = async () => {
    const measured = await page.locator('.cat-inspector').evaluate(element => [...element.querySelectorAll<HTMLElement>('.cat-inspector-scroll, .valid-steps, .valid-step-main, .valid-step-meta')]
      .filter(node => node.getBoundingClientRect().height > 0).map(node => ({ cls: node.className, client: node.clientWidth, scroll: node.scrollWidth })));
    assert.ok(measured.every(row => row.scroll <= row.client + 1), JSON.stringify(measured));
  };
  try {
    await page.goto(`${origin}/#/a`, { waitUntil: 'domcontentloaded' });
    await page.locator('.cat-remote .cat-tile-open').first().click();
    const dialog = page.locator('.cat-details'), grip = page.getByRole('separator', { name: 'Resize asset details' });
    await page.getByRole('button', { name: 'Inspect & verify', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Check Content Credentials', exact: true }).count(), 0);
    assert.equal(await page.locator('.cat-inspector-scroll > details').last().getAttribute('data-inspector-section'), 'checks');
    await page.getByText('Origins & credentials', { exact: true }).click(); await injectJourney();
    await page.getByText('1 step', { exact: true }).waitFor();
    assert.equal(await page.locator('.valid-step-agent').evaluate(node => getComputedStyle(node).color), await page.locator('.cat-inspector').evaluate(node => getComputedStyle(node).color));
    await page.locator('.cat-inspector-primary').getByRole('button', { name: /^Download/ }).waitFor();
    const initialPreview = (await page.locator('.cat-details-preview').boundingBox())!.width;
    await grip.focus(); await page.keyboard.press('Home');
    await page.waitForFunction(() => document.querySelector('.cat-details')?.classList.contains('is-inspector-collapsed'));
    assert.ok((await page.locator('.cat-details-preview').boundingBox())!.width > initialPreview + 250);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await grip.getAttribute('aria-valuenow'), '300'); await noOverflow();
    const atMin = await grip.boundingBox(); assert.ok(atMin);
    await page.mouse.move(atMin.x + atMin.width / 2, atMin.y + atMin.height / 2); await page.mouse.down(); await page.mouse.move(atMin.x - 210, atMin.y + atMin.height / 2, { steps: 10 }); await page.mouse.up();
    assert.ok(Number(await grip.getAttribute('aria-valuenow')) >= 500); await noOverflow();
    const wide = (await grip.boundingBox())!;
    await page.mouse.move(wide.x + 4, wide.y + wide.height / 2); await page.mouse.down(); await page.mouse.move(wide.x + 400, wide.y + wide.height / 2, { steps: 10 }); await page.mouse.up();
    assert.equal(await grip.getAttribute('aria-valuenow'), '48');
    const shut = (await grip.boundingBox())!;
    await page.mouse.move(shut.x + 4, shut.y + shut.height / 2); await page.mouse.down(); await page.mouse.move(shut.x - 250, shut.y + shut.height / 2, { steps: 10 }); await page.mouse.up();
    assert.equal(await dialog.evaluate(node => node.classList.contains('is-inspector-collapsed')), false);
    await grip.focus(); await page.keyboard.press('Enter'); assert.equal(await grip.getAttribute('aria-valuenow'), '380');
    await page.getByRole('button', { name: 'Collapse asset details', exact: true }).click();
    await page.getByRole('button', { name: 'Expand asset details', exact: true }).click(); assert.equal(await grip.getAttribute('aria-valuenow'), '380');
    if (process.env.LOLLY_ASSETS_EVIDENCE) { await mkdir(process.env.LOLLY_ASSETS_EVIDENCE, { recursive: true }); await page.screenshot({ path: `${process.env.LOLLY_ASSETS_EVIDENCE}/inspector-desktop.png` }); }
    await grip.focus(); await page.keyboard.press('Home'); await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => !document.querySelector('.cat-details')?.classList.contains('is-inspector-collapsed'));
    assert.equal(await grip.isVisible(), false); assert.equal(await dialog.evaluate(node => node.classList.contains('is-inspector-collapsed')), false);
    await page.locator('.valid-steps').scrollIntoViewIfNeeded(); await noOverflow();
    assert.ok((await page.locator('.cat-details-close').boundingBox())!.y >= 0);
    await page.evaluate(() => document.documentElement.setAttribute('data-a11y-text', 'large')); await noOverflow();
    assert.equal(await page.locator('.cat-inspector-scroll').evaluate(node => node instanceof HTMLElement && node.inert), false);
    if (process.env.LOLLY_ASSETS_EVIDENCE) await page.screenshot({ path: `${process.env.LOLLY_ASSETS_EVIDENCE}/inspector-mobile.png` });
    await page.setViewportSize({ width: 1360, height: 1000 });
    await page.waitForFunction(() => document.querySelector('.cat-details')?.classList.contains('is-inspector-collapsed'));
    assert.equal(await dialog.evaluate(node => node.classList.contains('is-inspector-collapsed')), true);
    await page.getByRole('button', { name: 'Expand asset details', exact: true }).click();
    await page.locator('.cat-details-close').click(); await page.locator('.cat-remote .cat-tile-open').first().click();
    assert.equal(await page.getByRole('separator', { name: 'Resize asset details' }).getAttribute('aria-valuenow'), '380');
    assert.equal(await page.locator('[data-inspector-section="credentials"]').evaluate(node => (node as HTMLDetailsElement).open), true);
    await page.getByRole('button', { name: 'Inspect & verify', exact: true }).click();
    await page.waitForURL('**/#/verify?asset=ext%2Fdam%2Fart');
    await page.locator('.verify-view').waitFor(); assert.equal(await page.locator('.cat-details').count(), 0);
    assert.deepEqual(errors, []);
  } catch (error) {
    console.error(JSON.stringify({ errors, body: (await page.locator('body').innerText()).slice(-3500) })); throw error;
  } finally { await context.close(); await closeBrowser(); }
});
