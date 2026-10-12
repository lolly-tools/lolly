// SPDX-License-Identifier: MPL-2.0
/** Extended property choices reach copies, comparison and private reports. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium, type Download } from 'playwright';
import { openDocxMetadata } from '../engine/src/docx-metadata.ts';
import { readZipMembers, decodeZipMember, storeZip, storeZipMembers } from '../engine/src/zip.ts';
import { readOfficeXml } from '../engine/src/office-xml.ts';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_HISTORY_TEST_URL ?? process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'LOLLY_HISTORY_TEST_URL or LOLLY_EXPORT_TEST_URL not set (serve the web shell locally)';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
const bytes = readFileSync(new URL('./fixtures/docx-metadata/extended-properties.docx', import.meta.url));
const source = { name: 'private-office.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: bytes };
const privateValues = /Private fixture company|Private fixture manager|Private fixture|Private project|Initial Fixture Author|private-office/;

async function downloaded(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream();
  assert.ok(stream);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

test('phone Strip Data removes selected Company while retaining Manager and resets choices for a replacement', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  try {
    const originalHash = createHash('sha256').update(bytes).digest('hex');
    await page.goto(`${origin}/#/tool/strip-data`, { waitUntil: 'networkidle' });
    await shellSettled(page);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose a file…', exact: true }).click();
    await (await chooser).setFiles(source);
    const company = page.getByRole('checkbox', { name: 'Remove Company', exact: true });
    const manager = page.getByRole('checkbox', { name: 'Remove Manager', exact: true });
    await company.waitFor();
    assert.equal(await manager.isChecked(), false);
    assert.equal(await page.locator('[data-export-file]').count(), 0);
    assert.doesNotMatch(await page.locator('.exif-findings').innerText(), privateValues);
    await company.check();
    await page.locator('[data-export-file]').waitFor();
    if (process.env.LOLLY_DOCX_EXTENDED_EVIDENCE) await page.screenshot({ path: process.env.LOLLY_DOCX_EXTENDED_EVIDENCE, fullPage: true });
    const pending = page.waitForEvent('download');
    await page.locator('[data-export-file]').click();
    const copy = await downloaded(await pending);
    const metadata = openDocxMetadata(new Uint8Array(copy), 'copy.docx');
    assert.equal(metadata.supported, true);
    assert.ok(!metadata.properties.some(property => property.id === 'app:Company'));
    assert.ok(metadata.properties.some(property => property.id === 'app:Manager' && property.value === 'Private fixture manager'));
    assert.ok(metadata.properties.some(property => property.id === 'core:creator'));
    const before = readZipMembers(bytes);
    const after = readZipMembers(new Uint8Array(copy));
    for (const member of before.filter(member => member.name !== 'docProps/app.xml')) {
      assert.deepEqual(Buffer.from(after.find(current => current.name === member.name)!.local), Buffer.from(member.local), member.name);
      assert.deepEqual(Buffer.from(after.find(current => current.name === member.name)!.compressed), Buffer.from(member.compressed), member.name);
    }
    const replacement = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Replace', exact: true }).click();
    await (await replacement).setFiles({ ...source, buffer: copy });
    await manager.waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-export-file]'));
    assert.equal(await company.count(), 0);
    assert.equal(await manager.isChecked(), false);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), originalHash);
    assert.doesNotMatch(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, url: location.href })), privateValues);
  } finally { await browser.close(); }
});

test('Prepare removes Company and Manager with supported properties and compares private results without source values', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(`${origin}/#/prepare`, { waitUntil: 'networkidle' });
    await shellSettled(page);
    await page.locator('[data-files]').setInputFiles(source);
    await page.locator('button[data-download]').waitFor();
    assert.doesNotMatch(await page.locator('[data-review]').innerText(), privateValues);
    const pending = page.waitForEvent('download');
    await page.locator('button[data-download]').click();
    const copy = await downloaded(await pending);
    const metadata = openDocxMetadata(new Uint8Array(copy), 'copy.docx');
    assert.equal(metadata.supported, true);
    assert.deepEqual(metadata.properties, []);
    await page.locator('[data-compare]').click();
    await page.locator('.compare-summary').waitFor();
    const modal = page.locator('.compare-modal');
    assert.match(await modal.innerText(), /Company and Manager are compared/);
    assert.equal(await modal.locator('.compare-change[open]').count(), 0);
    assert.doesNotMatch(await modal.innerText(), privateValues);
    const report = page.waitForEvent('download');
    await modal.getByRole('button', { name: 'Download comparison report', exact: true }).click();
    assert.doesNotMatch((await downloaded(await report)).toString(), privateValues);
    await modal.getByRole('button', { name: 'Close comparison', exact: true }).click();
    const summary = page.waitForEvent('download');
    await page.locator('button[data-report]').click();
    const text = (await downloaded(await summary)).toString();
    assert.doesNotMatch(text, privateValues);
    assert.equal(JSON.parse(text).stages[0].operation, 'remove-properties');
  } finally { await browser.close(); }
});

test('extended digital-signature data remains inspect-only in the real Strip Data view', { skip, timeout: 90_000 }, async () => {
  const members = readZipMembers(bytes);
  const app = members.find(member => member.name === 'docProps/app.xml')!;
  const decoded = decodeZipMember(app);
  const root = readOfficeXml(decoded, { nodes: 0 });
  const prefix = root.qname.includes(':') ? root.qname.slice(0, root.qname.indexOf(':')) + ':' : '';
  const xml = new TextDecoder().decode(decoded).replace(`</${root.qname}>`, `<${prefix}DigSig>c3ludGhldGlj</${prefix}DigSig></${root.qname}>`);
  const replacement = readZipMembers(storeZip([{ name: app.name, bytes: new TextEncoder().encode(xml) }]))[0]!;
  const signedMarker = storeZipMembers(members.map(member => member.name === app.name ? replacement : member));
  assert.equal(openDocxMetadata(signedMarker, 'file.docx').supported, false);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${origin}/#/tool/strip-data`, { waitUntil: 'networkidle' });
    await shellSettled(page);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Choose a file…', exact: true }).click();
    await (await chooser).setFiles({ ...source, buffer: Buffer.from(signedMarker) });
    await page.getByRole('button', { name: 'Replace', exact: true }).waitFor();
    assert.equal(await page.getByRole('checkbox', { name: 'Remove Company', exact: true }).count(), 0);
    assert.equal(await page.getByRole('checkbox', { name: 'Remove Manager', exact: true }).count(), 0);
    assert.equal(await page.locator('[data-export-file]').count(), 0);
    assert.match(await page.locator('.exif').innerText(), /signature data|inspect-only/i);
  } finally { await browser.close(); }
});
