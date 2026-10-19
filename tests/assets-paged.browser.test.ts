// SPDX-License-Identifier: MPL-2.0
/** Actual Assets view over a bounded wire fixture; API scale/exposure is tested in Work. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
const origin = process.env.LOLLY_ASSETS_TEST_URL ?? process.env.LOLLY_IMPORT_TEST_URL;
const entry = (i: number) => ({ id: `ext/dam/item-${i}`, provider: 'dam', name: `Artwork ${String(i).padStart(6, '0')}`, type: 'vector', tier: 'on-demand', version: '1234567890123456',
  formats: [{ format: 'svg', url: `/catalog/ext/dam/item-${i}/wide` }, { format: 'svg', url: `/catalog/ext/dam/item-${i}/square` }, { format: 'thumb', url: `/catalog/ext/dam/item-${i}/thumb` }],
  meta: { providerLabel: 'Campaign library', providerSections: ['Launch'], providerCollections: [], assetFiles: ['wide', 'square'].map((name, j) => ({ id: (j ? 'b' : 'a').repeat(24), name: `${name}.svg`, format: 'svg', role: 'original', url: `/catalog/ext/dam/item-${i}/${name}` })) } });

test('shared Assets pages retain selections, exact filters, file choice and metadata curation', { skip: origin ? false : 'set LOLLY_ASSETS_TEST_URL or LOLLY_IMPORT_TEST_URL to a running web shell', timeout: 120_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin!).hostname));
  const browser = await getBrowser(), context = await browser.newContext({ viewport: { width: 1360, height: 1000 } });
  const page = await context.newPage(); const errors: string[] = [], requests: URL[] = [], writes: unknown[] = [];
  let denied = false, indexedText = '';
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/v1/catalog/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/v1/catalog/sources') return route.fulfill({ json: { sources: denied ? [] : [{ id: 'dam', label: 'Campaign library', status: 'current', count: 100_000 }], scope: 'fixture', canManage: false } });
    if (denied) return route.fulfill({ status: 403, json: { error: { message: 'Denied' } } });
    if (url.pathname.startsWith('/api/v1/catalog/text-index/')) { const body = route.request().postDataJSON(); writes.push(body); indexedText = body.text ?? ''; return route.fulfill({ json: { ok: true } }); }
    if (url.pathname.endsWith('/meta')) { writes.push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true } }); }
    if (url.pathname !== '/api/v1/catalog/assets') { const asset = entry(Number(url.pathname.match(/item-(\d+)/)?.[1] ?? 0)); return route.fulfill({ json: { ...asset, canEdit: true, fields: { region: 'EMEA', credit: '<img src=x onerror=alert(1)>' }, fieldDefs: [{ id: 'region', label: 'Region', kind: 'select', options: ['EMEA', 'APAC'] }, { id: 'credit', label: 'Credit <script>literal</script>', kind: 'text' }],
      textIndex: { revision: 'revision-one', assetVersion: asset.version, status: indexedText ? 'current' : 'none', characters: indexedText.length }, textIndexFiles: asset.meta.assetFiles } }); }
    requests.push(url); const offset = Number(url.searchParams.get('cursor') ?? 0), tagged = url.searchParams.has('tag');
    return route.fulfill({ json: { capabilities: { indexedFilters: ['q', 'scope', 'source', 'types', 'tag', 'taxonomyKind', 'taxonomyId'] }, assets: Array.from({ length: tagged ? 10 : 100 }, (_, i) => entry(offset + i)), total: tagged ? 10 : 100_000, nextCursor: tagged ? null : String(offset + 100), version: 'fixture', complete: true,
      sources: [{ id: 'dam', label: 'Campaign library', status: 'current', count: 100_000 }], facets: { sources: [{ id: 'dam', label: 'Campaign library', count: 100_000 }], sections: [{ name: 'Launch', count: 100_000 }], collections: [], tags: [{ name: 'launch', count: 10 }], types: [{ name: 'vector', count: 100_000 }], taxonomy: [{ source: 'dam', kind: 'section', id: 'legacy:Launch', name: 'Launch', count: 100_000 }] } } });
  });
  await page.route('**/catalog/assets/index.json*', route => route.fulfill({ json: { assets: [] } }));
  await page.route('**/catalog/ext/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="240" height="160" fill="#28785a"/><text x="20" y="80" fill="white">Zephyr launch artwork</text></svg>' }));
  try {
    await page.goto(`${origin}/#/a`, { waitUntil: 'domcontentloaded' });
    await page.locator('.cat-remote .cat-tile').first().waitFor({ state: 'visible' });
    assert.equal(await page.locator('.cat-remote .cat-tile').count(), 100);
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.cat-remote img')].some(image => image.complete && image.naturalWidth > 0));
    if (process.env.LOLLY_ASSETS_EVIDENCE && requests.length === 1) { await mkdir(process.env.LOLLY_ASSETS_EVIDENCE, { recursive: true }); await page.screenshot({ path: `${process.env.LOLLY_ASSETS_EVIDENCE}/assets-desktop.png` }); }
    assert.ok(requests.every(url => url.searchParams.get('limit') === '100'));
    await page.locator('.cat-remote .cat-check').first().click();
    assert.match(await page.locator('.cat-bulkbar-count').innerText(), /1/);
    await page.getByRole('button', { name: 'Next page', exact: true }).click();
    await page.locator('.cat-remote .cat-tile[data-id="ext/dam/item-100"]').waitFor();
    assert.equal(await page.locator('.cat-remote .cat-tile').count(), 100);
    const storedProviderRows = await page.evaluate(async () => { const path = '/src/bridge/db.ts'; const db = await (await import(path)).openDB(); return (await db.getAll('asset-meta')).filter((entry: { provider?: string }) => entry.provider).length; });
    assert.equal(storedProviderRows, 0, 'browsing pages does not mirror provider metadata into device storage');
    assert.match(await page.locator('.cat-bulkbar-count').innerText(), /1/);
    assert.ok(await page.getByText('Your selection includes assets on other pages.', { exact: false }).count());
    await page.locator('[data-shared-tag]').selectOption('launch');
    await page.waitForFunction(() => document.querySelectorAll('.cat-remote .cat-tile').length === 10);
    assert.equal(requests.at(-1)!.searchParams.get('tag'), 'launch');
    assert.equal(await page.getByRole('button', { name: 'Search live sources', exact: true }).isDisabled(), true);
    await page.locator('.cat-remote .cat-tile-open').first().click();
    await page.getByRole('button', { name: /square.svg/ }).click();
    await page.locator('.asset-file-choice[aria-pressed="true"]').waitFor();
    assert.match(await page.locator('.asset-file-choice[aria-pressed="true"]').innerText(), /square.svg/);
    assert.match(page.url(), /file%3Dbbbb|file=bbbb/);
    const reopened = await page.evaluate(async () => { const bridge = '/src/bridge/assets.ts', storage = '/src/bridge/db.ts'; const api = (await import(bridge)).createAssetsAPI(await (await import(storage)).openDB()); const ref = await api.get('ext/dam/item-0?file=' + 'b'.repeat(24)); return { id: ref.id, name: ref.meta.name }; });
    assert.equal(reopened.id, 'ext/dam/item-0?file=' + 'b'.repeat(24)); assert.equal(reopened.name, 'square.svg');
    await page.getByText('Source history', { exact: true }).click();
    await page.getByText('Held reads on this device', { exact: true }).waitFor();
    await page.getByText('Observed source version: 1234567890123456', { exact: true }).first().waitFor();
    if (process.env.LOLLY_ASSETS_EVIDENCE) { await mkdir(process.env.LOLLY_ASSETS_EVIDENCE, { recursive: true }); await page.screenshot({ path: `${process.env.LOLLY_ASSETS_EVIDENCE}/source-history-desktop.png` }); }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByText('Held reads on this device', { exact: true }).scrollIntoViewIfNeeded();
    assert.equal(await page.locator('.cat-details-body').evaluate(element => element.scrollWidth <= element.clientWidth), true);
    if (process.env.LOLLY_ASSETS_EVIDENCE) await page.screenshot({ path: `${process.env.LOLLY_ASSETS_EVIDENCE}/source-history-mobile.png` });
    await page.setViewportSize({ width: 1360, height: 1000 });
    await page.getByText('Source history', { exact: true }).click();
    await page.getByText('Organisation metadata', { exact: true }).click();
    assert.equal(await page.getByLabel('Credit <script>literal</script>', { exact: true }).inputValue(), '<img src=x onerror=alert(1)>');
    assert.equal(await page.locator('.cat-details-body form img, .cat-details-body form script').count(), 0, 'metadata labels and values remain text');
    await page.getByLabel('Region', { exact: true }).selectOption('APAC');
    await page.getByRole('button', { name: 'Save metadata', exact: true }).click();
    await page.getByText('Metadata saved.', { exact: true }).waitFor();
    assert.deepEqual(writes, [{ fields: { region: 'APAC' } }]);
    await page.getByRole('button', { name: 'Read text', exact: true }).click();
    await page.getByText('Review text for shared search', { exact: true }).waitFor();
    assert.equal(writes.length, 1, 'extracting text performs no curation write');
    await page.getByLabel('Reviewed search text', { exact: true }).fill('Reviewed Zephyr campaign');
    await page.getByRole('button', { name: 'Add reviewed text to shared search', exact: true }).click();
    await page.getByText('Reviewed text added to shared search.', { exact: true }).waitFor();
    assert.deepEqual(writes[1], { sourceRevision: 'revision-one', text: 'Reviewed Zephyr campaign', fileId: 'b'.repeat(24), method: 'digital' });
    if (process.env.LOLLY_ASSETS_EVIDENCE) await page.screenshot({ path: `${process.env.LOLLY_ASSETS_EVIDENCE}/reviewed-text.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByLabel('Reviewed search text', { exact: true }).scrollIntoViewIfNeeded();
    assert.equal(await page.locator('.cat-details-body').evaluate(element => element.scrollWidth <= element.clientWidth), true);
    if (process.env.LOLLY_ASSETS_EVIDENCE) await page.screenshot({ path: `${process.env.LOLLY_ASSETS_EVIDENCE}/reviewed-text-mobile.png` });
    await page.setViewportSize({ width: 1360, height: 1000 });
    await page.keyboard.press('Escape');
    await page.getByLabel('Search Assets', { exact: true }).fill('zephyr');
    await page.waitForFunction(() => document.querySelector('[data-shared-query]')?.textContent?.includes('zephyr'));
    await page.waitForTimeout(350);
    assert.equal(requests.at(-1)!.searchParams.get('q'), 'zephyr');
    await page.getByRole('button', { name: 'Clear shared search', exact: true }).click();
    assert.equal(await page.getByLabel('Search Assets', { exact: true }).inputValue(), '');
    await page.setViewportSize({ width: 390, height: 844 });
    if (await page.locator('[data-browse-sources]').getAttribute('aria-expanded') === 'true') await page.locator('[data-browse-sources]').click();
    await page.evaluate(() => scrollTo(0, 0));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.LOLLY_ASSETS_EVIDENCE) await page.screenshot({ path: `${process.env.LOLLY_ASSETS_EVIDENCE}/assets-mobile.png` });
    denied = true;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.getByText('Sign in to browse shared assets.', { exact: true }).waitFor();
    assert.equal(await page.locator('.cat-remote .cat-tile').count(), 0);
    assert.equal(await page.locator('.cat-bulkbar').isVisible(), false);
    assert.deepEqual(errors, []);
  } catch (error) {
    console.error(JSON.stringify({ errors, requests: requests.map(url => url.pathname + url.search), body: (await page.locator('body').innerText()).slice(0, 2500) }));
    throw error;
  } finally { await context.close(); await closeBrowser(); }
});
