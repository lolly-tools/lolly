// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const origin = process.env.LOLLY_HISTORY_TEST_URL;
const skip = origin ? false : 'LOLLY_HISTORY_TEST_URL not set (serve the web shell and point it here)';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));

test('revision reads verify payload bytes and hash without rewriting corrupt or missing data', { skip, timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ headless: true }); const page = await browser.newPage();
  try {
    await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Integrity</title>' }));
    await page.goto(origin!);
    const result = await page.evaluate(async () => {
      const dbPath = '/src/bridge/db.ts', statePath = '/src/bridge/state.ts', historyPath = '/src/bridge/revision-history.ts';
      const db = await (await import(dbPath)).openDB();
      const history = (await import(statePath)).createStateAPI(db, (await import(historyPath)).createRevisionStore(db)).history;
      const entry = await history.checkpoint('design:integrity', { __toolId: 'design', headline: 'Original' }, { reason: 'save', expectedHead: null });
      const current = await history.current('design:integrity'), original = await history.read(entry.id);
      await db.put('revision-payloads', { ...original, headline: 'Modified' }, entry.id);
      const errors: string[] = [];
      for (const action of [() => history.read(entry.id), () => history.fidelity.inspect(entry.id), () => history.fidelity.prepareCopy(entry.id, [{ key: 'x', version: 'v2', format: 'png' }])]) {
        try { await action(); errors.push('unexpected success'); } catch (error) { errors.push(String(error)); }
      }
      const kept = await db.get('revision-payloads', entry.id);
      await db.put('revision-payloads', original, entry.id);
      await db.put('revisions', { ...entry, bytes: entry.bytes + 1 });
      try { await history.read(entry.id); errors.push('unexpected success'); } catch (error) { errors.push(String(error)); }
      await db.put('revisions', entry); await db.delete('revision-payloads', entry.id);
      try { await history.read(entry.id); errors.push('unexpected success'); } catch (error) { errors.push(String(error)); }
      return { errors, kept, current, after: await history.current('design:integrity'), missing: await db.get('revision-payloads', entry.id), absent: await history.read('absent'), metadata: await db.get('revisions', entry.id) };
    });
    assert.equal(result.errors.length, 5); assert.ok(result.errors.every(message => message.includes('integrity check')));
    assert.equal(result.kept.headline, 'Modified'); assert.deepEqual(result.after, result.current);
    assert.equal(result.missing, undefined); assert.equal(result.absent, null); assert.ok(result.metadata);
  } finally { await browser.close(); }
});

test('asset checks stay local and repair copies revalidate exact compatible upload replacements', { skip, timeout: 45_000 }, async () => {
  const browser = await chromium.launch({ headless: true }); const page = await browser.newPage();
  try {
    await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Asset checks</title>' }));
    await page.goto(origin!);
    const result = await page.evaluate(async () => {
      const dbPath = '/src/bridge/db.ts', statePath = '/src/bridge/state.ts', historyPath = '/src/bridge/revision-history.ts';
      const db = await (await import(dbPath)).openDB();
      const history = (await import(statePath)).createStateAPI(db, (await import(historyPath)).createRevisionStore(db)).history;
      const upload = { id: 'user/upload/portrait', version: 'v2', format: 'png', type: 'raster', blob: new Blob(['current']) };
      await db.put('user-assets', upload);
      await db.put('user-assets', { ...upload, id: 'user/upload/wrong-format', format: 'webp' });
      await db.put('user-assets', { ...upload, id: 'user/upload/wrong-type', type: 'vector' });
      await db.put('user-asset-versions', { assetId: upload.id, version: 'retained', record: { ...upload, version: 'retained', blob: new Blob(['old']) } });
      await db.put('asset-meta', { id: 'catalog/logo', type: 'raster', version: 'latest', formats: [{ format: 'png' }] });
      await db.put('asset-blob', new Blob(['cached']), 'catalog/logo:png:old');
      const ref = { source: 'user', id: upload.id, type: 'raster', format: 'png', version: 'missing', pin: { version: 'missing', format: 'png' }, meta: { name: '<img onerror=alert(1)>' } };
      const data = { __toolId: 'design', first: ref, duplicate: { ...ref }, retained: { ...ref, pin: { version: 'retained', format: 'png' } },
        gone: { ...ref, id: 'user/upload/gone' }, wrongFormat: { ...ref, id: 'user/upload/wrong-format' }, wrongType: { ...ref, id: 'user/upload/wrong-type' },
        modified: { ...ref, id: 'user/upload/portrait?theme=dark' },
        catalog: { ...ref, source: 'library', id: 'catalog/logo', pin: { version: 'old', format: 'png' } },
        current: { ...ref, source: 'library', id: 'catalog/logo', pin: undefined },
        remote: { ...ref, source: 'remote', id: 'https://example.test/image' },
        baked: { ...ref, meta: { baked: true }, url: 'data:image/png;base64,AA==' } };
      const entry = await history.checkpoint('design:assets', data, { reason: 'save', expectedHead: null });
      const original = await history.read(entry.id), current = await history.current('design:assets');
      const fetch = window.fetch, buffer = Blob.prototype.arrayBuffer;
      window.fetch = () => { throw new Error('Asset inspection must not fetch'); };
      Blob.prototype.arrayBuffer = () => { throw new Error('Asset inspection must not decode file bytes'); };
      try {
        const report = await history.fidelity.inspect(entry.id);
        const choice = report.assets.find((asset: { replacement?: unknown }) => asset.replacement).replacement;
        const copy = await history.fidelity.prepareCopy(entry.id, [choice]);
        const after = await history.read(entry.id);
        await db.put('user-assets', { ...upload, version: 'v3' });
        let stale = ''; try { await history.fidelity.prepareCopy(entry.id, [choice]); } catch (error) { stale = String(error); }
        await db.put('user-assets', { ...upload, blob: undefined });
        let gone = ''; try { await history.fidelity.prepareCopy(entry.id, [choice]); } catch (error) { gone = String(error); }
        const wide = await history.checkpoint('design:wide', { __toolId: 'design', assets: Array.from({ length: 129 }, (_, i) => ({ ...ref, id: `user/upload/${i}` })) }, { reason: 'save', expectedHead: null });
        const partial = await history.fidelity.inspect(wide.id);
        let incomplete = ''; try { await history.fidelity.prepareCopy(wide.id, [choice]); } catch (error) { incomplete = String(error); }
        return { report, copy, original, after, current, head: await history.current('design:assets'), stale, gone, partial, incomplete };
      } finally { window.fetch = fetch; Blob.prototype.arrayBuffer = buffer; }
    });
    assert.equal(result.report.assets.length, 10); assert.equal(result.report.truncated, false);
    assert.equal(result.report.assets.filter((asset: { replacement?: unknown }) => asset.replacement).length, 1);
    assert.equal(result.report.assets.filter((asset: { status: string }) => asset.status === 'saved').length, 2);
    assert.equal(result.report.assets.find((asset: { id: string }) => asset.id === 'https://example.test/image').status, 'unverified');
    assert.equal(result.copy.first.pin.version, 'v2'); assert.equal(result.copy.duplicate.pin.version, 'v2');
    assert.equal(result.copy.gone.pin.version, 'missing'); assert.equal(result.copy.retained.pin.version, 'retained');
    assert.deepEqual(result.original, result.after); assert.deepEqual(result.current, result.head);
    assert.match(result.stale, /changed since this check/); assert.match(result.gone, /changed since this check/);
    assert.equal(result.partial.truncated, true); assert.equal(result.partial.assets.length, 128); assert.match(result.incomplete, /too complex/);
  } finally { await browser.close(); }
});

test('the History panel checks only on request and opens selected repairs as a new creation', { skip, timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await page.goto(`${origin}/#/history`, { waitUntil: 'networkidle' }); await page.keyboard.press('Escape');
    const original = await page.evaluate(async () => {
      const hostPath = '/src/lib/host-ref.ts', dbPath = '/src/bridge/db.ts';
      const state = (await import(hostPath)).getHostRef().state, db = await (await import(dbPath)).openDB();
      await db.put('user-assets', { id: 'user/upload/campaign', version: '2', format: 'png', type: 'raster', blob: new Blob(['replacement']) });
      const entry = await state.history.checkpoint('design:fidelity-ui', { __toolId: 'design', __label: 'Autumn campaign',
        image: { source: 'user', id: 'user/upload/campaign', type: 'raster', format: 'png', pin: { version: '1', format: 'png' }, meta: { name: 'Campaign portrait' } } }, { reason: 'save', expectedHead: null });
      const canvas = document.createElement('canvas'); canvas.width = 180; canvas.height = 120;
      const context = canvas.getContext('2d')!; context.fillStyle = '#163a32'; context.fillRect(0, 0, 180, 120);
      context.fillStyle = '#d6ff72'; context.font = 'bold 20px sans-serif'; context.fillText('AUTUMN', 18, 54); context.fillText('CAMPAIGN', 18, 80);
      await state.history.attachPreview(entry.id, canvas.toDataURL());
      const inspect = state.history.fidelity.inspect;
      state.history.fidelity.inspect = async (id: string) => { document.body.dataset.assetChecks = String(Number(document.body.dataset.assetChecks ?? 0) + 1); return inspect(id); };
      return { id: entry.id, current: await state.history.current('design:fidelity-ui'), data: await state.history.read(entry.id) };
    });
    await page.locator('.app-history > header').getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.locator('.app-history-row').getByRole('button', { name: 'Versions', exact: true }).click();
    const panel = page.locator('.revision-history-panel');
    await panel.getByRole('button', { name: 'Check assets', exact: true }).waitFor();
    assert.equal(await page.locator('body').getAttribute('data-asset-checks'), null);
    await panel.getByRole('button', { name: 'Check assets', exact: true }).click();
    await panel.getByText('Some assets need attention', { exact: true }).waitFor();
    assert.equal(await page.locator('body').getAttribute('data-asset-checks'), '1');
    assert.equal(await panel.getByRole('button', { name: 'Open copy with selected assets' }).isDisabled(), true);
    const shots = new URL('../plans/221-history-mockups/', import.meta.url); await mkdir(shots, { recursive: true });
    await page.screenshot({ path: fileURLToPath(new URL('build-history-assets-desktop.png', shots)) });
    await page.setViewportSize({ width: 390, height: 844 });
    await panel.getByText('Some assets need attention', { exact: true }).waitFor();
    assert.ok(await panel.evaluate(el => el.scrollWidth <= el.clientWidth));
    assert.equal(await page.locator('.chrome-topleft').isVisible(), false, 'fixed Home chrome must not cover the sheet header');
    await panel.getByRole('checkbox', { name: 'Use current version 2 in copy' }).check();
    await page.screenshot({ path: fileURLToPath(new URL('build-history-assets-mobile.png', shots)) });
    await panel.getByRole('button', { name: 'Open copy with selected assets' }).click();
    await page.waitForFunction(() => location.hash.includes('/tool/design'));
    const result = await page.evaluate(async (id: string) => {
      const hostPath = '/src/lib/host-ref.ts', dbPath = '/src/bridge/db.ts';
      const state = (await import(hostPath)).getHostRef().state, db = await (await import(dbPath)).openDB();
      return { original: await state.history.read(id), current: await state.history.current('design:fidelity-ui'), rows: await db.getAll('state') };
    }, original.id);
    assert.deepEqual(result.original, original.data); assert.deepEqual(result.current, original.current);
    const copy = result.rows.find((row: { label: string }) => row.label === 'Autumn campaign (copy)');
    assert.ok(copy); assert.notEqual(copy.slot, 'design:fidelity-ui'); assert.equal(copy.data.image.pin.version, '2');
  } finally { await browser.close(); }
});

test('asset labels stay text and closing an inspector cancels late results and copy handoffs', { skip, timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ headless: true }); const page = await browser.newPage();
  try {
    await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Inspector lifecycle</title>' }));
    await page.goto(origin!);
    const result = await page.evaluate(async () => {
      const path = '/src/components/history-fidelity.ts'; const { mountHistoryFidelity } = await import(path);
      let copies = 0, releaseCopy: ((value: object) => void) | undefined, releaseInspection: ((value: typeof report) => void) | undefined;
      const report = { revisionId: 'test', truncated: false, assets: [{ key: 'asset', id: 'user/test', label: '<img src=x onerror=alert(1)>', status: 'missing', replacement: { key: 'asset', version: 'v2', format: 'png' } }] };
      const api = { inspect: async () => report, prepareCopy: () => new Promise(resolve => { releaseCopy = resolve; }) };
      const view = mountHistoryFidelity(api, async () => { copies++; });
      const article = document.createElement('article'); document.body.append(article);
      const trigger = view.action({ id: 'test', toolId: 'design', label: 'Test' }, article); article.append(trigger);
      trigger.click(); await new Promise(resolve => setTimeout(resolve, 0));
      const labels = article.querySelector('strong')?.textContent, images = article.querySelectorAll('img').length;
      const checkbox = article.querySelector('input')!; checkbox.click();
      const repair = [...article.querySelectorAll('button')].find(button => button.textContent === 'Open copy with selected assets')!;
      repair.click(); view.clear(); releaseCopy!({ __toolId: 'design' }); await new Promise(resolve => setTimeout(resolve, 0));
      api.inspect = () => new Promise(resolve => { releaseInspection = resolve; });
      const second = view.action({ id: 'test', toolId: 'design', label: 'Test' }, article); article.append(second); second.click();
      view.clear(); releaseInspection!(report); await new Promise(resolve => setTimeout(resolve, 0));
      return { labels, images, copies, inspectors: article.querySelectorAll('.revision-history-fidelity').length };
    });
    assert.equal(result.labels, '<img src=x onerror=alert(1)>'); assert.equal(result.images, 0);
    assert.equal(result.copies, 0); assert.equal(result.inspectors, 0);
  } finally { await browser.close(); }
});
