// SPDX-License-Identifier: MPL-2.0
/** Walk the real Assets UI with bounded shared-project wire fixtures. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
const origin = process.env.LOLLY_ASSETS_TEST_URL;
const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c636000000200010005fe02fea7c1cd0e0000000049454e44ae426082', 'hex');
const checksum = createHash('sha256').update(png).digest('hex');
const originalId = 'fil_abcdefghijklmnopqrstuv', copiedId = 'fil_zyxwvutsrqponmlkjihgfe';

test('shared folders browse without originals, copy into nested destinations and submit originals to review', { skip: origin ? false : 'set LOLLY_ASSETS_TEST_URL to a running shell', timeout: 120_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin!).hostname));
  const browser = await getBrowser(), context = await browser.newContext({ viewport: { width: 1360, height: 1000 } }), page = await context.newPage();
  const errors: string[] = [], submissions: URL[] = [], uploads: unknown[] = [];
  let originalReads = 0, copied: Record<string, unknown> | null = null, placed = false, denied = false;
  const original = { id: originalId, projectId: 'p1', name: 'Campaign.png', size: png.length, checksum, contentType: 'image/png', ready: true, asset: { type: 'raster', format: 'png' } };
  const folders = (project: string) => [{ id: 'parent', projectId: project, name: 'Campaign', parentId: null, items: [] }, { id: 'nested', projectId: project, name: 'Approved', parentId: 'parent', items: project === 'p1' ? [{ kind: 'file', ref: originalId }] : placed ? [{ kind: 'file', ref: copiedId }] : [] }];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/catalog/assets/index.json*', route => route.fulfill({ json: { assets: [] } }));
  await page.route('**/api/v1/catalog/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/sources')) return route.fulfill({ json: { sources: [], scope: 'fixture' } });
    if (url.pathname.endsWith('/submissions')) return route.fulfill({ json: { submissions: [] } });
    if (url.pathname.endsWith('/submit')) { submissions.push(url); assert.equal(route.request().postData() ?? '', ''); return route.fulfill({ status: 201, json: { assetId: 'inst/new', state: 'submitted', duplicate: false } }); }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.route('**/api/v1/projects/**', route => {
    const url = new URL(route.request().url()), method = route.request().method(), project = url.pathname.split('/')[4];
    if (denied) return route.fulfill({ status: 403, json: {} });
    if (url.pathname.endsWith('/folders')) return route.fulfill({ json: { folders: folders(project!) } });
    if (url.pathname.includes('/folders/items/')) { placed = true; return route.fulfill({ status: 204 }); }
    if (url.pathname.endsWith('/files') && method === 'GET') return route.fulfill({ json: { files: project === 'p1' ? [original] : copied?.ready ? [copied] : [], limits: { partBytes: 1048576, maxBytes: 1048576, projectBudgetBytes: 8388608, projectUsedBytes: 0, instanceRemainingBytes: 8388608 } } });
    if (url.pathname.endsWith('/files') && method === 'POST') { const body = route.request().postDataJSON(); uploads.push(body); copied = { ...body, id: copiedId, projectId: 'p2', ready: false }; return route.fulfill({ status: 201, json: { file: copied } }); }
    if (url.pathname.includes('/parts/')) return route.fulfill({ status: 204 });
    if (url.pathname.endsWith('/finalize')) { copied!.ready = true; return route.fulfill({ json: { file: copied } }); }
    if (url.pathname.endsWith(originalId)) { originalReads++; return route.fulfill({ contentType: 'image/png', body: png }); }
    return route.fulfill({ status: 404, json: {} });
  });
  try {
    await page.goto(`${origin}/#/profile`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      const targets = '/src/lib/send-target.ts';
      (await import(targets)).registerSendTarget({ id: 'fixture-writer', kind: 'gdrive', label: 'Writable fixture', formats: ['png'], sources: ['asset'], available: () => true, async send(payload: { bytes: Uint8Array }) { (window as unknown as { sentProjectBytes: number[] }).sentProjectBytes = [...payload.bytes]; return { label: 'File delivered' }; } });
      (await import(targets)).registerSendTarget({ id: 'fixture-export', kind: 'gdrive', label: 'Export-only fixture', formats: ['png'], sources: ['export'], available: () => true, async send() { throw new Error('Asset must not enter an export-only target'); } });
      const sources = '/src/lib/session-source.ts', submitters = '/src/lib/catalog-submit.ts', dialog = '/src/org/catalog-submit.ts';
      (await import(sources)).registerSessionSource({ label: 'Fixture', scope: 'fixture-user', listProjects: async () => [{ id: 'p1', name: 'Source project', myRole: 'editor' }, { id: 'p2', name: 'Destination project', myRole: 'editor' }], listSessions: async () => [], fetchSession: async () => null,
        write: { projectOptions: () => ({ canCreate: true, canSave: true, canShareFiles: true, groups: [] }) } });
      (await import(submitters)).registerCatalogSubmitter({ label: () => 'Submit to Fixture', accepts: () => true, open: (subject: unknown) => { void import(dialog).then(module => module.openCatalogSubmitDialog(subject, 'Fixture', ['design'])); } });
      location.hash = `#/a?sourceNode=${encodeURIComponent(JSON.stringify(['team-projects', 'p1', 'nested']))}`;
    });
    await page.locator('.cat-remote .cat-tile').waitFor();
    assert.equal(originalReads, 0, 'browsing shared metadata never downloads originals');
    await page.locator('.cat-remote .cat-check').click();
    await page.locator('[data-bulk="add-to-project"]').click();
    await page.getByRole('button', { name: 'Copy to a shared project…', exact: true }).click();
    await page.getByLabel('Shared project', { exact: true }).selectOption('p2');
    await page.getByLabel('Folder', { exact: true }).selectOption('nested');
    await page.getByRole('button', { name: 'Copy', exact: true }).click();
    await page.getByText('1 of 1 copies saved in the destination folder.', { exact: true }).waitFor();
    assert.equal(uploads.length, 1); assert.equal(placed, true); assert.equal((copied as Record<string, unknown> | null)?.checksum, checksum);
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.locator('.cat-tile-open').click();
    await page.locator('.cat-details [data-act="catalog-submit"]').click();
    await page.getByLabel('Library audience', { exact: true }).selectOption('design');
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await page.locator('.catalog-submit-dialog [data-state]').waitFor();
    assert.match(await page.locator('.catalog-submit-dialog [data-state]').innerText(), /waiting for review/);
    assert.equal(submissions[0]?.searchParams.get('fileId'), originalId); assert.equal(submissions[0]?.searchParams.get('checksum'), checksum); assert.equal(submissions[0]?.searchParams.get('groups'), 'design');
    if (process.env.LOLLY_ASSETS_EVIDENCE) { await mkdir(process.env.LOLLY_ASSETS_EVIDENCE, { recursive: true }); await page.screenshot({ path: `${process.env.LOLLY_ASSETS_EVIDENCE}/shared-library-review.png` }); }
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.locator('.cat-tile-open').click();
    await page.locator('.cat-details [data-act="send"]').click();
    assert.equal(await page.getByRole('button', { name: 'Export-only fixture', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Writable fixture', exact: true }).click();
    await page.getByText('File delivered', { exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => (window as unknown as { sentProjectBytes: number[] }).sentProjectBytes), [...png]);
    await page.locator('.cat-dl-cancel').click(); await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (process.env.LOLLY_ASSETS_EVIDENCE) await page.screenshot({ path: `${process.env.LOLLY_ASSETS_EVIDENCE}/shared-folders-mobile.png` });
    denied = true; await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.cat-remote .cat-tile').length === 0);
    assert.deepEqual(errors, []);
  } catch (error) { console.error(JSON.stringify({ errors, text: (await page.locator('body').innerText()).slice(-4000) })); throw error; }
  finally { await context.close(); await closeBrowser(); }
});
