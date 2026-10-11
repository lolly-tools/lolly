// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { readFileSync } from 'node:fs';
import { unzipSync, zipSync, strToU8 } from 'fflate';
import { openDocxMetadata } from '../engine/src/docx-metadata.ts';
import { docxFixture, pptxFixture, xlsxFixture } from './helpers/compare-file-fixtures.ts';
import { shellSettled } from './helpers/shell-settled.ts';
const origin = process.env.LOLLY_HISTORY_TEST_URL || process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'Set LOLLY_HISTORY_TEST_URL or LOLLY_EXPORT_TEST_URL (serve the web shell locally)';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));

test('table Compare: keyed movement, duplicate fallback, keyboard, mobile and private reports', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors: string[] = [], requests: string[] = []; page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push(request.url() + (request.postData() ?? '')));
  try {
    await page.goto(`${origin}/#/data`, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.getByRole('link', { name: 'Compare table files', exact: true }).click();
    await page.getByLabel('Comparison mode', { exact: true }).waitFor(); assert.equal(await page.getByLabel('Comparison mode', { exact: true }).inputValue(), 'table');
    await page.getByLabel('Before text', { exact: true }).fill('id,note\na,CONFIDENTIAL_REMOVED\nb,steady');
    await page.getByLabel('After text', { exact: true }).fill('id,note\nb,steady\na,PRIVATE_C_AFTER_VALUE\nc,PRIVATE_C_INSERTED_VALUE');
    await page.getByRole('button', { name: 'Compare', exact: true }).click(); await page.getByLabel('Row key', { exact: true }).waitFor();
    await page.getByLabel('Row key', { exact: true }).selectOption('id'); await page.getByText('3 changes found', { exact: true }).waitFor();
    assert.equal(await page.locator('.compare-change[open]').count(), 0);
    await page.getByRole('button', { name: 'Next change', exact: true }).focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('.compare-change summary').first().evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Enter'); await page.locator('.compare-change[open]').waitFor();
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download comparison report' }).click();
    const stream = await (await download).createReadStream(); let report = ''; for await (const chunk of stream!) report += chunk.toString();
    assert.doesNotMatch(report, /CONFIDENTIAL|PRIVATE_C_|"id"|"note"|text-0/); assert.equal(JSON.parse(report).summary.changed, 1);
    await page.getByLabel('Before text', { exact: true }).fill('id,note\na,one\na,two');
    assert.equal(await page.locator('.compare-change').count(), 0);
    await page.getByLabel('After text', { exact: true }).fill('id,note\na,two\na,one');
    await page.getByRole('button', { name: 'Compare', exact: true }).click(); await page.getByLabel('Row key', { exact: true }).selectOption('id');
    await page.getByText('The selected row key is missing, blank or duplicated. Every row in that table was compared by position; ambiguous rows were not matched by key.', { exact: true }).waitFor();
    await page.getByText('2 changes found', { exact: true }).waitFor();
    await page.evaluate(() => { document.documentElement.dataset.a11yText = 'large'; document.documentElement.dataset.a11yContrast = 'high'; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: 'plans/229-compare-evidence/table-mobile.png', fullPage: true });
    const cancellation = await page.evaluate(async () => {
      const path = '/src/lib/host-ref.ts', host = (await import(path)).getHostRef(), controller = new AbortController();
      const source = { identity: { id: 'cancel', kind: 'file', label: 'cancel' }, content: { kind: 'table', tables: [{ name: 'A', columns: ['id'], rows: Array.from({ length: 10_000 }, (_value, index) => [String(index)]) }] } };
      const pending = host.compare.run({ version: 1, before: source, after: source }, { signal: controller.signal }); controller.abort();
      try { await pending; return 'resolved'; } catch (error) { return error instanceof Error ? error.name : 'unknown'; }
    }); assert.equal(cancellation, 'AbortError');
    const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, url: location.href }));
    assert.doesNotMatch(storage, /CONFIDENTIAL_REMOVED|PRIVATE_C_/); assert.doesNotMatch(requests.join('\n'), /CONFIDENTIAL_REMOVED|PRIVATE_C_/); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('document Compare: actual Office and PDF files, retained slide IDs and truthful locations', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch(), page = await browser.newPage();
  try {
    await page.goto(`${origin}/#/unpack`, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.getByRole('link', { name: 'Compare document text', exact: true }).click(); await page.getByLabel('Comparison mode', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Comparison mode', { exact: true }).inputValue(), 'document'); assert.equal(await page.getByRole('textbox').count(), 0);
    const files = [docxFixture(['Anchor', 'CONFIDENTIAL_DOC', 'End']), docxFixture(['Anchor', 'Inserted', 'End', 'Tail'])];
    await page.getByLabel('Before file', { exact: true }).setInputFiles({ name: 'private-before.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(files[0]!) });
    await page.getByLabel('After file', { exact: true }).setInputFiles({ name: 'private-after.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from(files[1]!) });
    await page.getByRole('button', { name: 'Compare', exact: true }).click(); await page.getByText('2 changes found', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Document alignment').locator('option[value="id"]').evaluate(option => (option as HTMLOptionElement).disabled), true);
    assert.match(await page.locator('.compare-change summary').first().innerText(), /Block 2/); assert.doesNotMatch(await page.locator('.compare-change summary').first().innerText(), /Page/);
    await page.getByLabel('Before file', { exact: true }).setInputFiles({ name: 'before.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: Buffer.from(pptxFixture([{ id: 256, text: 'A' }, { id: 257, text: 'B' }])) });
    await page.getByLabel('After file', { exact: true }).setInputFiles({ name: 'after.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: Buffer.from(pptxFixture([{ id: 257, text: 'B changed' }, { id: 256, text: 'A' }])) });
    await page.getByRole('button', { name: 'Compare', exact: true }).click(); await page.getByLabel('Document alignment').waitFor(); await page.getByLabel('Document alignment').selectOption('id');
    await page.getByText('2 changes found', { exact: true }).waitFor(); assert.match(await page.locator('.compare-changes').innerText(), /Slide/);
    const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica); pdf.addPage().drawText('Anchor', { x: 20, y: 700, font }); const before = await pdf.save(); pdf.addPage().drawText('Added page', { x: 20, y: 700, font });
    await page.getByLabel('Before file', { exact: true }).setInputFiles({ name: 'before.pdf', mimeType: 'application/pdf', buffer: Buffer.from(before) });
    await page.getByLabel('After file', { exact: true }).setInputFiles({ name: 'after.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
    await page.getByRole('button', { name: 'Compare', exact: true }).click(); await page.getByText('1 change found', { exact: true }).waitFor();
    assert.match(await page.locator('.compare-change summary').innerText(), /Page 2/); assert.equal(await page.getByLabel('Document alignment').locator('option[value="id"]').evaluate(option => (option as HTMLOptionElement).disabled), true);
    await page.setViewportSize({ width: 390, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: 'plans/229-compare-evidence/document-mobile.png', fullPage: true });
    assert.doesNotMatch(page.url(), /CONFIDENTIAL|private-before/);
  } finally { await browser.close(); }
});

test('file entry adapters and saved operation use the same engine results and captured versions', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch(), page = await browser.newPage();
  try {
    await page.goto(`${origin}/#/compare?mode=table`, { waitUntil: 'networkidle' }); await shellSettled(page);
    const files = [xlsxFixture([{ name: 'Orders', rows: [['id', 'qty'], ['a', '1'], ['b', '2']] }]), xlsxFixture([{ name: 'Orders', rows: [['id', 'qty'], ['b', '3'], ['a', '1']] }])];
    const evidence = await page.evaluate(async ({ before, after }) => {
      const hostPath = '/src/lib/host-ref.ts', sourcesPath = '/src/lib/compare-sources.ts', operationPath = '/src/lib/compare-operation-sources.ts', assetPath = '/src/lib/compare-asset-sources.ts';
      const host = (await import(hostPath)).getHostRef(), sources = await import(sourcesPath), operations = await import(operationPath), assets = await import(assetPath);
      const files = [new File([Uint8Array.from(atob(before), char => char.charCodeAt(0))], 'CONFIDENTIAL-before.xlsx'), new File([Uint8Array.from(atob(after), char => char.charCodeAt(0))], 'after.xlsx')];
      const utility = await Promise.all(files.map(file => sources.comparisonFileSource(file, 'table'))), operation = await operations.operationComparisonPair(files[0], files[1], host);
      const assetHost = { assets: { get: async (id: string) => ({ id, format: 'xlsx', version: 'captured' }), bytes: async (ref: { id: string }) => new Uint8Array(await files[Number(ref.id)]!.arrayBuffer()) } };
      const asset = await assets.comparisonAssetPair([{ id: '0', format: 'xlsx', version: 'captured' }, { id: '1', format: 'xlsx', version: 'captured' }], assetHost);
      const requests = [{ version: 1, before: utility[0], after: utility[1] }, operation.request, asset.request];
      const results = await Promise.all(requests.map(request => host.compare.run({ ...request, options: { tableRowKey: 'id' } })));
      const digest = await crypto.subtle.digest('SHA-256', await files[0]!.arrayBuffer()), sha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
      const panelPath = '/src/components/compare-operation.ts';
      (await import(panelPath)).openOperationComparison(host, files[1], { expected: { name: 'CONFIDENTIAL-before.xlsx', mime: '', format: 'xlsx', size: files[0]!.size, sha256 } });
      return results.map(result => ({ summary: result.summary, changes: result.changes, mode: result.mode }));
    }, { before: Buffer.from(files[0]!).toString('base64'), after: Buffer.from(files[1]!).toString('base64') });
    assert.deepEqual(evidence[0], evidence[1]); assert.deepEqual(evidence[1], evidence[2]);
    const dialog = page.getByRole('dialog', { name: 'Compare original and copy' });
    await dialog.getByLabel('Choose the original file').setInputFiles({ name: 'renamed.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(files[0]!) });
    await dialog.getByLabel('Row key').waitFor(); await dialog.getByLabel('Row key').selectOption('id'); await dialog.getByText('2 changes found', { exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Close comparison' }).click();
    const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, url: location.href })); assert.doesNotMatch(storage, /CONFIDENTIAL|renamed.xlsx/);
  } finally { await browser.close(); }
});

test('DOCX operation Compare preserves property cleanup and offers explicit body text for inspect-only documents', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const metadata = new Uint8Array(readFileSync(new URL('./fixtures/docx-metadata/metadata.docx', import.meta.url)));
  const cleaned = openDocxMetadata(metadata, 'original.docx').remove(['core:creator']);
  const open = async (before: Uint8Array, after: Uint8Array): Promise<void> => {
    await page.evaluate(async ({ before, after }) => {
      const hostPath = '/src/lib/host-ref.ts', panelPath = '/src/components/compare-operation.ts';
      const bytes = (value: string) => Uint8Array.from(atob(value), char => char.charCodeAt(0));
      (await import(panelPath)).openOperationComparison((await import(hostPath)).getHostRef(), new File([bytes(after)], 'copy.docx'), { before: new File([bytes(before)], 'original.docx') });
    }, { before: Buffer.from(before).toString('base64'), after: Buffer.from(after).toString('base64') });
  };
  try {
    await page.goto(`${origin}/#/compare`, { waitUntil: 'networkidle' }); await shellSettled(page); await open(metadata, cleaned);
    const dialog = page.getByRole('dialog', { name: 'Compare original and copy' }), mode = dialog.getByLabel('DOCX comparison', { exact: true });
    await dialog.getByText('1 change found', { exact: true }).waitFor(); assert.equal(await mode.inputValue(), 'properties');
    assert.equal(await dialog.locator('.compare-change[open]').count(), 0);
    await mode.selectOption('document'); await dialog.getByLabel('Document alignment', { exact: true }).waitFor();
    await dialog.getByText('The compared content is equivalent with these options.', { exact: true }).waitFor();
    assert.equal(await dialog.locator('.compare-change').count(), 0);
    await mode.selectOption('properties'); await dialog.getByText('1 change found', { exact: true }).waitFor();
    await dialog.getByRole('button', { name: 'Close comparison' }).click();
    const guarded = (text: string) => {
      const parts = unzipSync(docxFixture([text, 'Anchor']));
      parts['word/document.xml'] = strToU8(new TextDecoder().decode(parts['word/document.xml']).replace('<w:body>', '<w:body><w:fldSimple w:instr="AUTHOR"/>'));
      return zipSync(parts);
    };
    await open(guarded('CONFIDENTIAL_BODY_REMOVED'), guarded('PRIVATE_C_BODY_COPY'));
    await dialog.getByText('DOCX property review is not supported for this file. It remains inspect-only.', { exact: true }).waitFor();
    await mode.selectOption('document'); await dialog.getByText('1 change found', { exact: true }).waitFor();
    assert.match(await dialog.locator('.compare-change summary').innerText(), /Block 1/);
    assert.doesNotMatch(await dialog.locator('.compare-change summary').innerText(), /Page/);
    const download = page.waitForEvent('download'); await dialog.getByRole('button', { name: 'Download comparison report' }).click();
    const stream = await (await download).createReadStream(); let report = ''; for await (const chunk of stream!) report += chunk.toString();
    assert.doesNotMatch(report, /CONFIDENTIAL|PRIVATE_C_|original.docx|copy.docx/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: 'plans/229-compare-evidence/docx-operation-mobile.png', fullPage: true });
    await dialog.getByRole('button', { name: 'Close comparison' }).click();
    const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, url: location.href }));
    assert.doesNotMatch(storage, /CONFIDENTIAL_BODY_REMOVED|PRIVATE_C_BODY_COPY/); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
