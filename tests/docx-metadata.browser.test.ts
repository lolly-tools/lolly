// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium, type Download } from 'playwright';
import { openDocxMetadata } from '../engine/src/docx-metadata.ts';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_HISTORY_TEST_URL ?? process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'LOLLY_HISTORY_TEST_URL or LOLLY_EXPORT_TEST_URL not set (serve the web shell locally)';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
const bytes = readFileSync(new URL('./fixtures/docx-metadata/metadata.docx', import.meta.url));
const source = { name: 'private-docx.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: bytes };
async function downloaded(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream(), chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk)); return Buffer.concat(chunks);
}

test('Strip Data DOCX canvas choices remove one property and reset when the source changes', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(`${origin}/#/tool/strip-data`, { waitUntil: 'networkidle' }); await shellSettled(page);
    const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Choose a file…', exact: true }).click(); await (await chooser).setFiles(source);
    const author = page.getByRole('checkbox', { name: 'Remove Author', exact: true }); await author.waitFor();
    assert.equal(await page.locator('[data-export-file]').count(), 0);
    assert.doesNotMatch(await page.locator('.exif-findings').innerText(), /Private fixture|Private project|Initial Fixture Author/);
    await author.check(); await page.locator('[data-export-file]').waitFor();
    if (process.env.LOLLY_DOCX_EVIDENCE) await page.screenshot({ path: process.env.LOLLY_DOCX_EVIDENCE, fullPage: true });
    const pending = page.waitForEvent('download'); await page.locator('[data-export-file]').click(); const copy = await downloaded(await pending);
    const metadata = openDocxMetadata(new Uint8Array(copy), 'copy.docx'); assert.equal(metadata.supported, true);
    assert(!metadata.properties.some(p => p.id === 'core:creator')); assert(metadata.properties.some(p => p.value === 'Unselected custom value'));
    const replace = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Replace', exact: true }).click(); await (await replace).setFiles({ ...source, buffer: copy });
    await page.getByRole('checkbox', { name: 'Remove Title', exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-export-file]'));
    assert.equal(await page.locator('[data-input-id="properties"]:checked').count(), 0);
    assert.doesNotMatch(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, url: location.href })), /Private fixture|Private project|Initial Fixture Author|private-docx/);
  } finally { await browser.close(); }
});

test('Prepare DOCX copies use property comparison and omit private details from reports', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(`${origin}/#/prepare`, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.locator('[data-files]').setInputFiles(source); await page.locator('button[data-download]').waitFor();
    assert.equal(await page.locator('[data-replacement], [data-remove]').count(), 0);
    assert.doesNotMatch(await page.locator('[data-review]').innerText(), /Private fixture|Private project|Initial Fixture Author/);
    const pending = page.waitForEvent('download'); await page.locator('button[data-download]').click(); const copy = await downloaded(await pending);
    assert.deepEqual(openDocxMetadata(new Uint8Array(copy), 'copy.docx').properties, []);
    await page.locator('[data-compare]').click(); await page.locator('.compare-summary').waitFor();
    const modal = page.locator('.compare-modal');
    assert.match(await modal.innerText(), /Only supported DOCX core and custom properties/);
    assert.equal(await modal.locator('.compare-change[open]').count(), 0);
    assert.doesNotMatch(await modal.innerText(), /Private fixture|Private project|Initial Fixture Author/);
    const report = page.waitForEvent('download'); await modal.getByRole('button', { name: 'Download comparison report', exact: true }).click();
    assert.doesNotMatch((await downloaded(await report)).toString(), /Private fixture|Private project|Initial Fixture Author|private-docx|docProps/);
    await modal.getByRole('button', { name: 'Close comparison', exact: true }).click();
    const summary = page.waitForEvent('download'); await page.locator('button[data-report]').click();
    const summaryText = (await downloaded(await summary)).toString(); assert.doesNotMatch(summaryText, /Private fixture|Private project|Initial Fixture Author|private-docx|docProps/);
    assert.equal(JSON.parse(summaryText).stages[0].operation, 'remove-properties');
  } finally { await browser.close(); }
});
