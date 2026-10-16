// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.env.LOLLY_HISTORY_TEST_URL ?? process.env.LOLLY_IMPORT_TEST_URL;
const skip = origin ? false : 'Serve the local shell with LOLLY_HISTORY_TEST_URL or LOLLY_IMPORT_TEST_URL.';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));

test('saved source pins retain selected files and observed attributes through overwrite, restart and missing bytes', { skip, timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true }), page = await browser.newPage();
  try {
    await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Source history</title><main></main>' }));
    await page.goto(origin!);
    const result = await page.evaluate(async () => {
      const load = (path: string) => import(path);
      const db = await (await load('/src/bridge/db.ts')).openDB();
      const assets = (await load('/src/bridge/assets.ts')).createAssetsAPI(db);
      const history = (await load('/src/bridge/revision-history.ts')).createRevisionStore(db);
      const state = (await load('/src/bridge/state.ts')).createStateAPI(db, history);
      const id = 'ext/test/same-format', a = 'a'.repeat(24), b = 'b'.repeat(24);
      const formats = [{ format: 'png', url: `/catalog/${id}/a` }, { format: 'png', url: `/catalog/${id}/b` }];
      await db.put('asset-meta', { id, version: 'unchanged', type: 'raster', name: '<img src=x onerror=alert(1)>', license: 'CC-BY-4.0', tier: 'on-demand', formats,
        meta: { assetFiles: formats.map((format, i) => ({ ...format, id: i ? b : a, name: i ? 'Square.png' : 'Wide.png', role: 'original' })) } });
      for (const file of [a, b]) await db.put('asset-blob', new Blob([file === a ? 'wide old' : 'square old']), `${id}?file=${file}:png:unchanged`);
      const first = await assets.get(`${id}?file=${a}`), second = await assets.get(`${id}?file=${b}`);
      const saved = await state.history.checkpoint('design:source-history', { __toolId: 'design', image: first, other: second }, { reason: 'save', expectedHead: null });
      await db.put('asset-meta', { id, version: 'unchanged', type: 'raster', license: 'new terms', formats });
      await assets._pruneStale([], await history.assetRefs());
      const reopened = await state.history.read(saved.id);
      const exact = await assets.get(reopened.image.id, reopened.image.pin);
      const fidelity = await history.fidelity.inspect(saved.id);
      const bytes = await (await assets._getBlob(exact.id, exact.pin)).text();
      const local = await assets._sourceHistory(id);
      const target = document.querySelector('main');
      (await load('/src/views/assets/source-history.ts')).mountSourceHistory(target, first, assets);
      return { bytes, license: exact.meta.license, pinA: first.pin, pinB: second.pin, fidelity, local };
    });
    assert.equal(result.bytes, 'wide old'); assert.equal(result.license, 'CC-BY-4.0'); assert.notEqual(result.pinA.version, result.pinB.version);
    assert.ok(result.fidelity.assets.every((asset: { status: string }) => asset.status === 'saved'));
    assert.equal(result.local.revisions.length, 1); assert.equal(result.local.observations.length, 2);
    await page.getByText('Source history', { exact: true }).click();
    await page.getByText('Held reads on this device', { exact: true }).waitFor();
    await page.getByText('Known saved creations on this device: 1', { exact: true }).waitFor();
    assert.equal(await page.locator('main img').count(), 0, 'hostile metadata cannot create markup');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.reload();
    const after = await page.evaluate(async () => {
      const load = (path: string) => import(path);
      const db = await (await load('/src/bridge/db.ts')).openDB();
      const assets = (await load('/src/bridge/assets.ts')).createAssetsAPI(db);
      const history = (await load('/src/bridge/revision-history.ts')).createRevisionStore(db);
      const page = await history.list({ slot: 'design:source-history' }), data = await history.read(page.entries[0].id);
      const content = await (await assets._getBlob(data.image.id, data.image.pin)).text();
      await db.delete('asset-blob', `${data.image.id}:png:${data.image.pin.version}`);
      const unavailable = await assets.get(data.image.id, data.image.pin).then(() => false, () => true);
      const report = await history.fidelity.inspect(page.entries[0].id);
      const olderReader = await new Promise<string>(resolve => {
        const request = indexedDB.open('lolly', 25);
        request.onerror = () => resolve(request.error?.name ?? 'unknown');
        request.onsuccess = () => { request.result.close(); resolve('unexpected success'); };
      });
      return { content, unavailable, report, olderReader, preserved: !!await history.read(page.entries[0].id) };
    });
    assert.equal(after.content, 'wide old'); assert.equal(after.unavailable, true); assert.equal(after.report.assets[0].status, 'missing');
    assert.equal(after.olderReader, 'VersionError'); assert.equal(after.preserved, true);
  } finally { await browser.close(); }
});

test('the source-history form sends an explicit file version, purpose and activation target', { skip, timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ headless: true }), page = await browser.newPage();
  try {
    await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Review source</title><main></main>' }));
    await page.route('**/api/v1/catalog/assets/inst/hero/versions', route => route.fulfill({ json: { head: 1, metadataHistory: 'not-recorded', versions: [{ version: 1, formats: [{ format: 'png', checksum: 'a'.repeat(64) }] }], sourceReviews: [] } }));
    await page.route('**/api/v1/chains', route => route.fulfill({ json: { chains: [{ id: 'brand', name: 'Brand review' }] } }));
    let sent: Record<string, any> | undefined;
    await page.route('**/api/v1/approvals', route => { sent = route.request().postDataJSON(); return route.fulfill({ status: 201, json: { id: 'review-created' } }); });
    await page.goto(origin!);
    await page.evaluate(async () => {
      const path = '/src/views/assets/source-history.ts';
      (await import(path)).mountSourceHistory(document.querySelector('main'), { id: 'inst/hero', source: 'library', type: 'raster', format: 'png', url: '' }, { _sourceHistory: async () => ({ observations: [], revisions: [], reports: [], truncated: false, scope: 'this-device' }) });
    });
    await page.getByText('Source history', { exact: true }).click();
    await page.getByRole('button', { name: 'Request source review', exact: true }).click();
    await page.getByLabel('Review purpose').fill('Print creative review'); await page.getByLabel('Activation target').fill('launch:print');
    await page.getByRole('button', { name: 'Request review', exact: true }).click();
    await page.getByText('Source review requested. Approval applies only to this file version, purpose and target.', { exact: true }).waitFor();
    assert.deepEqual(sent?.sourceReview, { purpose: 'Print creative review', target: 'launch:print', files: [{ assetId: 'inst/hero', version: 1, format: 'png', sha256: 'a'.repeat(64), representation: 'original' }] });
    assert.equal(sent?.subjectType, 'source-review');
  } finally { await browser.close(); }
});
