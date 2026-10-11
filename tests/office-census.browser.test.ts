// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { storeZip } from '../engine/src/zip.ts';
import { shellSettled } from './helpers/shell-settled.ts';
const origin = process.env.LOLLY_HISTORY_TEST_URL ?? process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'LOLLY_HISTORY_TEST_URL or LOLLY_EXPORT_TEST_URL not set (serve the web shell locally)';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
const bytes = storeZip(['[Content_Types].xml', 'word/document.xml', 'docProps/core.xml'].map((name, i) => ({ name, bytes: new TextEncoder().encode(i === 2 ? '<props><creator>CONFIDENTIAL_OFFICE_AUTHOR</creator></props>' : '<root/>') })));

test('Office Prepare review uses the real worker, keeps originals unchanged and omits private report values', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(`${origin}/#/prepare`, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.locator('[data-files]').setInputFiles({ name: 'private-file.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(bytes) });
    await page.locator('[data-group]').waitFor(); await page.locator('button[data-download]').waitFor();
    assert.equal(await page.locator('[data-selected]:enabled, [data-replacement], [data-remove]').count(), 0);
    assert.doesNotMatch(await page.locator('[data-review]').innerText(), /CONFIDENTIAL_OFFICE_AUTHOR/);
    await page.locator('[data-reveal]').click(); assert.match(await page.locator('[data-review]').innerText(), /CONFIDENTIAL_OFFICE_AUTHOR/);
    await page.locator('[data-reveal]').click();
    const reportDownload = page.waitForEvent('download'); await page.locator('button[data-report]').click();
    const reportStream = await (await reportDownload).createReadStream(); let report = ''; for await (const chunk of reportStream!) report += chunk.toString();
    assert.doesNotMatch(report, /CONFIDENTIAL_OFFICE_AUTHOR|private-file|docProps/); assert.equal(JSON.parse(report).replaced, 0); assert.equal(JSON.parse(report).remaining, 1);
    const copyDownload = page.waitForEvent('download'); await page.locator('button[data-download]').click();
    const copyStream = await (await copyDownload).createReadStream(); const chunks: Buffer[] = []; for await (const chunk of copyStream!) chunks.push(Buffer.from(chunk));
    assert.deepEqual(Buffer.concat(chunks), Buffer.from(bytes));
    assert.doesNotMatch(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, url: location.href })), /CONFIDENTIAL_OFFICE_AUTHOR|private-file/);
    await page.locator('[data-reset]').click(); assert.equal(await page.locator('[data-group]').count(), 0);
  } finally { await browser.close(); }
});

test('Strip Hidden Data inspects Office files with masked details and no cleaned download', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(`${origin}/#/tool/strip-data`, { waitUntil: 'networkidle' }); await shellSettled(page);
    const chooser = page.waitForEvent('filechooser'); await page.getByRole('button', { name: 'Choose a file…', exact: true }).click();
    await (await chooser).setFiles({ name: 'private-file.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(bytes) });
    await page.locator('.exif-summary').getByText('Office inspection is read-only; nothing was removed.', { exact: false }).waitFor();
    assert.equal(await page.locator('[data-export-file]').count(), 0);
    assert.doesNotMatch(await page.locator('.exif-findings').innerText(), /CONFIDENTIAL_OFFICE_AUTHOR/);
    await page.locator('label[for="exif-show-details"]').click(); assert.match(await page.locator('.exif-findings').innerText(), /CONFIDENTIAL_OFFICE_AUTHOR/);
    assert.doesNotMatch(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, url: location.href })), /CONFIDENTIAL_OFFICE_AUTHOR|private-file/);
  } finally { await browser.close(); }
});
