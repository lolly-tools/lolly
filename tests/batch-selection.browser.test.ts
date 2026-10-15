// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import { unzipSync, strFromU8 } from 'fflate';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_BATCH_TEST_URL;
const command = process.platform === 'darwin' ? 'Meta' : 'Control';
test('batch selection scopes edits and exports, survives paging, and recovers removed rows', {
  skip: origin ? false : 'set LOLLY_BATCH_TEST_URL to a running web shell', timeout: 120_000,
}, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(`${origin}/#/batch?tool=qr-code`, { waitUntil: 'networkidle' });
    await shellSettled(page);
    await page.locator('[data-cell][data-col="url"]').waitFor();
    await page.locator('[data-select-row]').first().check();
    await page.locator('[data-duplicate-rows]').click();
    assert.equal(await page.locator('tbody tr').count(), 2);
    assert.equal(await page.locator('[data-select-row]:checked').count(), 1);
    await page.locator('[data-edit-selected]').selectOption('url');
    await page.locator('[data-bulk-input]').fill('https://example.org/selected');
    await page.locator('[data-bulk-apply]').click();
    assert.equal(await page.locator('[data-cell][data-col="url"]').nth(0).inputValue(), 'https://lolly.tools');
    assert.equal(await page.locator('[data-cell][data-col="url"]').nth(1).inputValue(), 'https://example.org/selected');
    await page.locator('[data-remove-rows]').click();
    assert.equal(await page.locator('tbody tr').count(), 1);
    await page.locator('[data-undo-remove]').click();
    assert.equal(await page.locator('tbody tr').count(), 2);
    assert.equal(await page.locator('[data-cell][data-col="url"]').nth(1).inputValue(), 'https://example.org/selected');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-export-csv]').click()]);
    const csv = await readFile((await download.path())!, 'utf8');
    assert.match(csv, /https:\/\/example.org\/selected/);
    assert.doesNotMatch(csv, /https:\/\/lolly.tools/);

    const manyRows = 'tool,format,url\n' + Array.from({ length: 125 }, (_, i) => `qr-code,svg,https://example.org/${i + 1}`).join('\n');
    await page.locator('#pro-csv-file').setInputFiles({ name: 'batch.csv', mimeType: 'text/csv', buffer: Buffer.from(manyRows) });
    await page.locator('[data-choice="replace"]').click();
    await page.waitForFunction(() => document.querySelector('.pro-grid-footer')?.textContent?.includes('of 125'));
    assert.equal(await page.locator('tbody tr').count(), 50);
    await page.getByRole('checkbox', { name: 'Select row 49', exact: true }).check();
    await page.locator('[data-batch-page="next"]').click();
    await page.getByRole('checkbox', { name: 'Select row 52', exact: true }).click({ modifiers: ['Shift'] });
    assert.equal(await page.locator('[data-selection-count]').textContent(), '4 selected');
    assert.equal(await page.locator('[data-select-row]:checked').count(), 2);
    assert.equal(await page.locator('#pro-render').textContent(), 'Render selected (4)');
    const [rangeDownload] = await Promise.all([page.waitForEvent('download'), page.locator('[data-export-csv]').click()]);
    const rangeCsv = await readFile((await rangeDownload.path())!, 'utf8');
    assert.equal(rangeCsv.match(/qr-code/g)?.length, 4);
    assert.match(rangeCsv, /https:\/\/example.org\/49/);
    assert.match(rangeCsv, /https:\/\/example.org\/52/);
    assert.doesNotMatch(rangeCsv, /https:\/\/example.org\/53/);
    await page.locator('#pro-render').click();
    const [zipDownload] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.locator('.modal [data-act="ok"]').click()]);
    const zip = unzipSync(new Uint8Array(await readFile((await zipDownload.path())!)));
    assert.equal(Object.keys(zip).filter(name => name.endsWith('.svg')).length, 4);
    const reportKey = Object.keys(zip).find(name => name.endsWith('preflight.json'));
    assert.ok(reportKey, 'the real render includes its preflight report');
    const report = JSON.parse(strFromU8(zip[reportKey]!));
    assert.equal(report.job.rowsRequested, 4);
    assert.equal(report.job.rowsRendered, 4);
    assert.deepEqual(report.rows.map((row: { row: number }) => row.row), [49, 50, 51, 52]);
    for (const row of report.rows) for (const finding of row.findings) {
      if (finding.rowIndex !== undefined) assert.equal(finding.rowIndex, row.row - 1);
    }
    await page.locator('[data-select-every-row]').click();
    assert.equal(await page.locator('[data-selection-count]').textContent(), '125 selected');
    await page.locator('[data-remove-rows]').click();
    assert.equal(await page.locator('tbody tr').count(), 0);
    assert.equal(await page.locator('#pro-render').isDisabled(), true);
    await page.locator('[data-undo-remove]').click();
    assert.equal(await page.locator('tbody tr').count(), 50);
    assert.equal(await page.locator('[data-selection-count]').textContent(), '125 selected');
    await page.locator('[data-clear-selection]').click();
    const cell = page.locator('tbody td[data-col="url"]').first();
    await cell.focus(); await page.keyboard.press('Shift+Space');
    assert.equal(await page.locator('[data-selection-count]').textContent(), '1 selected');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-select-row]:checked').count(), 0);
    await page.locator('[data-select-page]').focus(); await page.keyboard.press('Control+a');
    assert.equal(await page.locator('[data-selection-count]').textContent(), '125 selected');
    await page.locator('.pro-results > summary').click();
    await page.screenshot({ path: '/tmp/lolly-batch-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.setAttribute('data-a11y-text', 'large'));
    await page.screenshot({ path: '/tmp/lolly-batch-mobile.png' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.locator('#pro-render').isVisible(), true);
    const mobileInput = page.locator('[data-cell][data-col="url"]').first();
    await mobileInput.evaluate(el => el.scrollIntoView({ block: 'nearest', inline: 'center' }));
    await mobileInput.dblclick();
    assert.equal(await mobileInput.evaluate(el => el === document.activeElement), true, 'inputs remain reachable beside the selection gutter on mobile');
    assert.equal(await page.locator('#pro-render').textContent(), 'Render selected (125)', 'cell editing preserves the row selection used by export actions');
    await page.locator('#pro-menu').click();
    assert.equal(await page.locator('[data-fmt-trigger]').isVisible(), true);
    await page.locator('#pro-menu').click();
    await page.evaluate(async () => { const path = '/src/theme.ts'; (await import(path)).applyTheme('dark', false, false); });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-edit-selected]')!).backgroundColor === getComputedStyle(document.body).backgroundColor);
    await page.screenshot({ path: '/tmp/lolly-batch-dark-mobile.png' });
    await page.locator('#pro-csv-file').setInputFiles({ name: 'more.csv', mimeType: 'text/csv', buffer: Buffer.from('tool,url\nqr-code,https://example.org/added') });
    await page.locator('[data-choice="append"]').click();
    await page.waitForFunction(() => document.querySelector('.pro-grid-footer')?.textContent?.includes('of 126'));
    assert.equal(await page.locator('[data-cell][data-col="url"]').last().inputValue(), 'https://example.org/added');
    await page.locator('#pro-csv-file').setInputFiles({ name: 'cancel.csv', mimeType: 'text/csv', buffer: Buffer.from('tool,url\nqr-code,https://example.org/cancelled') });
    await page.locator('dialog .modal-cancel').click();
    assert.match((await page.locator('.pro-grid-footer').textContent())!, /of 126/);
    await page.locator('[data-select-row]').last().check();
    await page.locator('#pro-render').click();
    const backgroundDownload = page.waitForEvent('download', { timeout: 60_000 });
    await page.locator('.modal [data-act="ok"]').click();
    await page.evaluate(() => { location.hash = '#/'; });
    const backgroundZip = unzipSync(new Uint8Array(await readFile((await (await backgroundDownload).path())!)));
    assert.equal(Object.keys(backgroundZip).filter(name => /\.(png|svg)$/.test(name)).length, 1);
    assert.deepEqual(errors, []);
  } finally { await context.close(); await closeBrowser(); }
});

test('batch reuses the full format menu and copies and pastes rectangular cell ranges', {
  skip: origin ? false : 'set LOLLY_BATCH_TEST_URL to a running web shell', timeout: 120_000,
}, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const td = (row: number, col: string) => page.locator(`tbody tr:nth-child(${row}) td[data-col="${col}"]`);
  const paste = async (text: string) => { await page.evaluate(text => navigator.clipboard.writeText(text), text); await page.keyboard.press(`${command}+v`); };
  const importRows = async (csv: string) => {
    await page.locator('#pro-csv-file').setInputFiles({ name: 'cells.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.locator('[data-choice="replace"]').click();
    await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 1);
  };
  try {
    await page.goto(`${origin}/#/batch?tool=qr-code`, { waitUntil: 'networkidle' });
    await shellSettled(page);
    await page.locator('[data-fmt-trigger]').click();
    assert.ok(await page.locator('[data-fmt]').count() > 20);
    for (const format of ['avif', 'bmp', 'svgz', 'tiff', 'dxf']) assert.equal(await page.locator(`[data-fmt="${format}"]`).isVisible(), true);
    await page.screenshot({ path: '/tmp/lolly-batch-formats.png' });
    await page.locator('[data-fmt="bmp"]').click();
    assert.equal(await page.locator('#pro-format').inputValue(), 'bmp');
    await page.locator('#pro-render').click();
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), page.locator('.modal [data-act="ok"]').click()]);
    const zip = unzipSync(new Uint8Array(await readFile((await download.path())!)));
    const bmp = Object.keys(zip).find(name => name.endsWith('.bmp'));
    assert.ok(bmp, 'the added default format produces a real BMP');
    assert.equal(strFromU8(zip[bmp]!.slice(0, 2)), 'BM');

    await importRows('tool,url,text,firstname\nqr-code,https://example.org/1,Alpha,Ana\nqr-code,https://example.org/2,Beta,Bob\nqr-code,https://example.org/3,Gamma,Cal');
    const start = await td(1, 'url').boundingBox(), end = await td(2, 'text').boundingBox();
    assert.ok(start && end);
    await page.mouse.move(start.x + 30, start.y + 18); await page.mouse.down();
    await page.mouse.move(end.x + 30, end.y + 18, { steps: 6 }); await page.mouse.up();
    assert.equal(await page.locator('.is-cell-selected').count(), 4);
    assert.equal(await page.locator('[data-cell-count]').textContent(), '2 × 2 cells selected');
    await page.keyboard.press(`${command}+c`);
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'https://example.org/1\tAlpha\r\nhttps://example.org/2\tBeta\r\n');
    const html = await page.evaluate(async () => { const item = (await navigator.clipboard.read())[0]!; return (await item.getType('text/html')).text(); });
    assert.match(html, /<table/); assert.match(html, /Alpha/);
    await td(3, 'text').click({ modifiers: ['Shift'] });
    assert.equal(await page.locator('.is-cell-selected').count(), 6);
    await page.keyboard.press('Shift+ArrowLeft');
    assert.equal(await page.locator('.is-cell-selected').count(), 3);
    await page.keyboard.press(`${command}+a`);
    assert.equal(await page.locator('.is-cell-selected').count(), 15);
    await page.keyboard.press('Escape');

    await td(1, 'url').click();
    await page.keyboard.press('F2');
    await td(1, 'url').locator('input').evaluate(el => { if (el instanceof HTMLInputElement) el.setSelectionRange(0, 5); });
    await page.keyboard.press(`${command}+c`);
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'https', 'editing keeps native text selection');
    await page.keyboard.press('Escape');
    await paste('https://example.org/new\t"Hello,\nworld"\r\n\t"A\tB"\r\n');
    assert.equal(await td(1, 'text').locator('textarea').inputValue(), 'Hello,\nworld');
    assert.equal(await td(2, 'url').locator('input').inputValue(), '');
    assert.equal(await td(2, 'text').locator('textarea').inputValue(), 'A\tB');
    await td(1, 'url').click(); await td(2, 'text').click({ modifiers: ['Shift'] });
    await page.keyboard.press(`${command}+c`);
    await td(2, 'url').click();
    await page.keyboard.press(`${command}+v`);
    assert.equal(await td(2, 'url').locator('input').inputValue(), 'https://example.org/new');
    assert.equal(await td(2, 'text').locator('textarea').inputValue(), 'Hello,\nworld');
    assert.equal(await td(3, 'url').locator('input').inputValue(), '', 'HTML clipboard tables preserve blank cells');
    assert.equal(await td(3, 'text').locator('textarea').inputValue(), 'A\tB');
    await td(1, 'text').click(); await td(2, 'firstname').click({ modifiers: ['Shift'] });
    await paste('Shared');
    for (const row of [1, 2]) {
      assert.equal(await td(row, 'text').locator('textarea').inputValue(), 'Shared');
      assert.equal(await td(row, 'firstname').locator('input').inputValue(), 'Shared');
    }
    await page.locator('[data-copy-cells]').click();
    await page.waitForFunction(async () => (await navigator.clipboard.readText()).includes('Shared\tShared'));
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'Shared\tShared\r\nShared\tShared\r\n');
    await page.screenshot({ path: '/tmp/lolly-batch-cells.png' });

    await page.locator('[data-collapse-col="url"]').click();
    await td(1, '__filename').click(); await td(2, 'text').click({ modifiers: ['Shift'] });
    await paste('one\tFirst\r\ntwo\tSecond\r\n');
    assert.equal(await td(1, '__filename').locator('input').inputValue(), 'one');
    assert.equal(await td(1, 'text').locator('textarea').inputValue(), 'First', 'paste follows visible columns and skips hidden output fields');

    await importRows('tool,url,text\n' + Array.from({ length: 125 }, (_, i) => `qr-code,https://example.org/${i + 1},Text ${i + 1}`).join('\n'));
    await page.waitForFunction(() => document.querySelector('.pro-grid-footer')?.textContent?.includes('of 125'));
    await td(49, 'url').click();
    await page.locator('[data-batch-page="next"]').click();
    await td(2, 'text').click({ modifiers: ['Shift'] });
    assert.equal(await page.locator('[data-cell-count]').textContent(), '4 × 2 cells selected');
    await page.keyboard.press(`${command}+c`);
    const acrossPages = await page.evaluate(() => navigator.clipboard.readText());
    assert.equal(acrossPages.trim().split('\n').length, 4);
    assert.match(acrossPages, /Text 49/); assert.match(acrossPages, /Text 52/);
    await page.keyboard.press('Escape');
    await td(1, 'url').click(); await page.keyboard.press('Shift+ArrowUp');
    assert.match((await page.locator('.pro-grid-footer').textContent())!, /Page 1 of 3/);
    assert.equal(await page.locator('[data-cell-count]').textContent(), '2 × 1 cells selected');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#pro-menu').click(); await page.locator('[data-fmt-trigger]').click();
    const panel = await page.locator('[data-fmt-panel]').boundingBox();
    assert.ok(panel && panel.x >= 0 && panel.x + panel.width <= 390);
    const toast = await page.locator('.job-toast').boundingBox();
    assert.ok(toast);
    const overlap = { x: toast.x + toast.width / 2, y: toast.y + toast.height / 2 };
    assert.equal(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[data-fmt-panel]'), overlap), true, 'format choices remain clickable above the job notification');
    await page.screenshot({ path: '/tmp/lolly-batch-formats-mobile.png' });
    await page.locator('[data-fmt-close]').click();
    assert.equal(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.job-toast'), overlap), true, 'closing formats restores access to the job notification');
    assert.deepEqual(errors, []);
  } finally { await context.close(); await closeBrowser(); }
});
