// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { zipSync, unzipSync, strToU8 } from 'fflate';
import { readFileSync } from 'node:fs';
import { createPrepareAPI } from '../../../../engine/src/prepare.ts';
import { openDocxMetadata } from '../../../../engine/src/docx-metadata.ts';
import { packPng } from '../../../../engine/src/png.ts';
import { comparisonFileSource, comparisonTextSource } from './compare-sources.ts';
import { comparisonAssetPair, assetComparisonMode } from './compare-asset-sources.ts';
import { operationComparisonPair } from './compare-operation-sources.ts';
import { comparisonReport } from './compare-report.ts';
import { compareSources } from '../../../../engine/src/compare.ts';
import { createMockHost } from '../../../../packages/core/src/mock-host.ts';
import { docxFixture, xlsxFixture, pptxFixture } from '../../../../tests/helpers/compare-file-fixtures.ts';
import type { HostV1, ComparisonSource } from '@lolly-tools/core/host-v1';
globalThis.DOMParser = new JSDOM('').window.DOMParser;
const identity = { id: 'private', kind: 'file' as const, label: 'CONFIDENTIAL' };
const table = (source: ComparisonSource) => { assert.equal(source.content.kind, 'table'); if (source.content.kind !== 'table') assert.fail(); return source.content.tables; };
const document = (source: ComparisonSource) => { assert.equal(source.content.kind, 'document'); if (source.content.kind !== 'document') assert.fail(); return source.content.units; };

test('CSV and TSV retain quoted multiline cells, exact values and blank records', async () => {
  const source = comparisonTextSource('id,note\r\na,"first\r\nsecond ""quoted"""\r\n,\r\nb, café \r\n', identity, 'table');
  assert.deepEqual(table(source)[0]!.rows, [['a', 'first\r\nsecond "quoted"'], ['', ''], ['b', ' café ']]);
  assert.deepEqual(table(comparisonTextSource('id\tnote\na\t"one\ntwo"\n\t\nb\tc', identity, 'table'))[0]!.rows, [['a', 'one\ntwo'], ['', ''], ['b', 'c']]);
  assert.deepEqual(table(comparisonTextSource('id,note\na,"one\t""quoted""\ntwo"', identity, 'table'))[0]!.rows, [['a', 'one\t"quoted"\ntwo']]);
  assert.deepEqual(table(comparisonTextSource('id,note\na,one\ttwo', identity, 'table'))[0]!.rows, [['a', 'one\ttwo']]);
  assert.deepEqual(table(comparisonTextSource('id,"multi\nline\theader"\na,one\ttwo', identity, 'table'))[0]!.columns, ['id', 'multi\nline\theader']);
  assert.deepEqual(table(comparisonTextSource('id\tnote\na\t"one\t""quoted"""', identity, 'table'))[0]!.rows, [['a', 'one\t"quoted"']]);
  for (const text of ['id,note\na,"unclosed', 'id,note\na,"closed"invalid', 'id,note\na,"closed""']) assert.throws(() => comparisonTextSource(text, identity, 'table'), /invalid quoting/);
  await assert.rejects(comparisonFileSource(new File([new Uint8Array([255])], 'bad.csv'), 'table'), /UTF-8/);
  await assert.rejects(comparisonFileSource(new File(['\0'], 'bad.csv'), 'table'), /Choose an XLSX/);
});
test('XLSX captures named sheets and column values; row and cell caps prevent false equality', async () => {
  const bytes = xlsxFixture([{ name: 'Orders & returns', rows: [['id', 'qty'], ['a', '4']] }, { name: 'Extra', rows: [['code'], ['b']] }]);
  const source = await comparisonFileSource(new File([bytes as BlobPart], 'orders.xlsx'), 'table');
  assert.deepEqual(table(source).map(sheet => sheet.name), ['Orders & returns', 'Extra']);
  assert.deepEqual(table(source)[0]!.rows, [['a', '4']]); assert.equal(source.fidelity?.level, 'complete');
  const capped = comparisonTextSource('id\n' + 'a\n'.repeat(10_005), identity, 'table');
  assert.equal(capped.fidelity?.level, 'partial'); assert.equal(compareSources({ version: 1, before: capped, after: capped }).equality, 'undetermined');
  await assert.rejects(comparisonFileSource(new File(['secret malformed'], 'bad.xlsx'), 'table'), error => error instanceof Error && !error.message.includes('secret'));
});
test('XLSX checks sparse grid bounds and unsupported prefixed parts before rectangular allocation', async () => {
  const parts = unzipSync(xlsxFixture([{ name: 'A', rows: [['id']] }]));
  parts['xl/worksheets/sheet1.xml'] = strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>id</t></is></c></row><row r="10000"><c r="XFD10000"><v>1</v></c></row></sheetData></worksheet>');
  await assert.rejects(comparisonFileSource(new File([zipSync(parts) as BlobPart], 'wide.xlsx'), 'table'), /grid wider than 256/);
  parts['xl/worksheets/sheet1.xml'] = strToU8('<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData><x:row r="1"><x:c r="A1"><x:v>1</x:v></x:c></x:row></x:sheetData></x:worksheet>');
  await assert.rejects(comparisonFileSource(new File([zipSync(parts) as BlobPart], 'prefixed.xlsx'), 'table'), /prefixed XML/);
  parts['xl/worksheets/sheet1.xml'] = strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>id</t></is></c></row><row r="10000"><c r="IV10000"><v>1</v></c></row></sheetData></worksheet>');
  const bounded = await comparisonFileSource(new File([zipSync(parts) as BlobPart], 'sparse.xlsx'), 'table');
  assert.equal(bounded.fidelity?.level, 'partial'); assert.ok(table(bounded)[0]!.rows.length * table(bounded)[0]!.columns.length <= 100_000);
  parts['xl/worksheets/sheet1.xml'] = strToU8('<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>99</v></c><c r="B1"><v>1</v></c></row></sheetData></worksheet>');
  const missing = await comparisonFileSource(new File([zipSync(parts) as BlobPart], 'missing-cache.xlsx'), 'table');
  assert.equal(missing.fidelity?.level, 'partial'); assert.equal(compareSources({ version: 1, before: missing, after: missing }).equality, 'undetermined');
});
test('XLSX refuses unresolved, duplicate, external and custom worksheet relationships before importing any sheet', async () => {
  const initial = xlsxFixture([{ name: 'A', rows: [['id'], ['one']] }, { name: 'Private missing sheet', rows: [['id'], ['two']] }]);
  for (const variant of ['missing', 'duplicate', 'external', 'custom'] as const) {
    const parts = unzipSync(initial), decoder = new TextDecoder();
    let rels = decoder.decode(parts['xl/_rels/workbook.xml.rels']);
    if (variant === 'missing') rels = rels.replace(/<Relationship Id="rId2"[^>]*\/>/, '');
    if (variant === 'duplicate') rels = rels.replace('</Relationships>', '<Relationship Id="rId2" Type="http://example/worksheet" Target="worksheets/sheet2.xml"/></Relationships>');
    if (variant === 'external') rels = rels.replace('Id="rId2"', 'Id="rId2" TargetMode="External"');
    if (variant === 'custom') {
      rels = rels.replace('worksheets/sheet2.xml', '../custom/grid.xml');
      parts['custom/grid.xml'] = strToU8('<worksheet><sheetData><row r="10000"><c r="XFD10000"><v>1</v></c></row></sheetData></worksheet>');
    }
    parts['xl/_rels/workbook.xml.rels'] = strToU8(rels);
    await assert.rejects(comparisonFileSource(new File([zipSync(parts) as BlobPart], 'private.xlsx'), 'table'), error => error instanceof Error
      && /worksheet relationships/.test(error.message) && !/Private missing|rId2|custom\/grid/.test(error.message));
  }
});
test('DOCX blocks have no invented page or stable ID and preserve insertion/removal alignment', async () => {
  const before = await comparisonFileSource(new File([docxFixture(['Anchor', 'CONFIDENTIAL_REMOVED', 'End']) as BlobPart], 'before.docx'), 'document');
  const after = await comparisonFileSource(new File([docxFixture(['Anchor', 'Inserted', 'End', 'Tail']) as BlobPart], 'after.docx'), 'document');
  assert.deepEqual(document(before).map(unit => unit.location), [{ block: 1 }, { block: 2 }, { block: 3 }]);
  assert.ok(document(before).every(unit => unit.id === undefined && unit.location?.page === undefined));
  const result = compareSources({ version: 1, before, after }); assert.equal(result.equality, 'different'); assert.equal(result.summary.changed, 1); assert.equal(result.summary.added, 1);
  assert.doesNotMatch(comparisonReport(result), /CONFIDENTIAL|before.docx|block/);
});
test('DOCX operations retain property review by default and expose body text explicitly for inspect-only files', async () => {
  const bytes = new Uint8Array(readFileSync(new URL('../../../../tests/fixtures/docx-metadata/metadata.docx', import.meta.url)));
  const host = createMockHost(); host.prepare = createPrepareAPI();
  const cleaned = openDocxMetadata(bytes, 'before.docx').remove(['core:creator']);
  const files = [new File([bytes as BlobPart], 'before.docx'), new File([Uint8Array.from(cleaned).buffer], 'after.docx')];
  const properties = await operationComparisonPair(files[0]!, files[1]!, host); if (properties.mode === 'visual') assert.fail();
  assert.equal(properties.mode, 'json'); assert.equal(properties.request.before.content.kind, 'structure');
  assert.equal(compareSources(properties.request).summary.removed, 1);
  const body = await operationComparisonPair(files[0]!, files[1]!, host, undefined, 'document'); if (body.mode === 'visual') assert.fail();
  assert.equal(body.mode, 'document'); assert.deepEqual(document(body.request.before), document(body.request.after));
  assert.equal(compareSources(body.request).summary.total, 0);
  const parts = unzipSync(docxFixture(['CONFIDENTIAL_BODY', 'Anchor']));
  parts['word/document.xml'] = strToU8(new TextDecoder().decode(parts['word/document.xml']).replace('<w:body>', '<w:body><w:fldSimple w:instr="AUTHOR"/>'));
  const inspected = new File([zipSync(parts) as BlobPart], 'inspect-only.docx');
  await assert.rejects(operationComparisonPair(inspected, inspected, host), /inspect-only/);
  const explicit = await operationComparisonPair(inspected, inspected, createMockHost(), undefined, 'document'); if (explicit.mode === 'visual') assert.fail();
  assert.equal(explicit.mode, 'document'); assert.match(document(explicit.request.before)[0]!.text, /CONFIDENTIAL_BODY/);
  assert.equal(host.inspect.state.size, 0); assert.equal(host.inspect.logs.length, 0);
});
test('PPTX preserves native slide IDs for related revisions and reports moved/edited slides', async () => {
  const before = await comparisonFileSource(new File([pptxFixture([{ id: 256, text: 'A' }, { id: 257, text: 'B' }]) as BlobPart], 'before.pptx'), 'document');
  const after = await comparisonFileSource(new File([pptxFixture([{ id: 257, text: 'B changed' }, { id: 256, text: 'A' }]) as BlobPart], 'after.pptx'), 'document');
  assert.deepEqual(document(before).map(unit => unit.id), ['slide:256', 'slide:257']);
  const result = compareSources({ version: 1, before, after, options: { documentAlignment: 'id' } });
  assert.ok(result.summary.moved > 0); assert.equal(result.summary.changed, 1); assert.equal(result.changes.find(change => change.kind === 'changed')?.after?.slide, 1);
});
test('unresolved PPTX relationship order never assigns a native ID to fallback slides', async () => {
  const parts = unzipSync(pptxFixture([{ id: 256, text: 'A' }, { id: 257, text: 'B' }])); delete parts['ppt/_rels/presentation.xml.rels'];
  const source = await comparisonFileSource(new File([zipSync(parts) as BlobPart], 'fallback.pptx'), 'document');
  assert.ok(document(source).every(unit => !unit.id)); assert.equal(source.fidelity?.level, 'partial');
});
test('PDF extracts actual page text without stable IDs and stops at the declared page limit', async () => {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText('Actual page text', { x: 20, y: 700, font }); pdf.addPage().drawText('Second page', { x: 20, y: 700, font });
  const source = await comparisonFileSource(new File([await pdf.save() as BlobPart], 'actual.pdf'), 'document');
  assert.match(document(source)[0]!.text, /Actual page text/); assert.equal(document(source)[1]!.location?.page, 2); assert.ok(document(source).every(unit => !unit.id));
  while (pdf.getPageCount() < 65) pdf.addPage();
  const capped = await comparisonFileSource(new File([await pdf.save() as BlobPart], 'large.pdf'), 'document');
  assert.equal(document(capped).length, 64); assert.equal(capped.fidelity?.level, 'partial'); assert.equal(compareSources({ version: 1, before: capped, after: capped }).equality, 'undetermined');
});
test('scanned PDF pages and capped DOCX blocks remain partial even when extracted text matches', async () => {
  const pdf = await PDFDocument.create(), page = pdf.addPage([100, 100]);
  const image = await pdf.embedPng(packPng(new Uint8Array([255, 255, 255, 255]), { width: 1, height: 1 })); page.drawImage(image, { x: 0, y: 0, width: 100, height: 100 });
  const scanned = await comparisonFileSource(new File([await pdf.save() as BlobPart], 'scan.pdf'), 'document');
  assert.equal(scanned.fidelity?.level, 'partial'); assert.match(scanned.fidelity!.limitations.join(' '), /scanned PDF page/);
  assert.equal(compareSources({ version: 1, before: scanned, after: scanned }).equality, 'undetermined');
  const capped = await comparisonFileSource(new File([docxFixture(Array.from({ length: 2001 }, (_value, index) => `Block ${index}`)) as BlobPart], 'blocks.docx'), 'document');
  assert.equal(document(capped).length, 2000); assert.equal(capped.fidelity?.level, 'partial'); assert.equal(compareSources({ version: 1, before: capped, after: capped }).equality, 'undetermined');
});
test('Office parsing refuses macros, invalid XML and expansion limits with sanitized errors; cancellation aborts', async () => {
  for (const parts of [{ 'word/document.xml': strToU8('<secret broken') }, { 'word/document.xml': strToU8('<document/>'), 'word/vbaProject.bin': new Uint8Array([1]) }, { 'word/document.xml': strToU8('<!DOCTYPE document [<!ENTITY x "SECRET">]><document/>') }, { 'word/document.xml': new Uint8Array(8 * 1024 * 1024 + 1) }]) {
    await assert.rejects(comparisonFileSource(new File([zipSync(parts) as BlobPart], 'secret.docx'), 'document'), error => error instanceof Error && !/secret|SECRET|document.xml/.test(error.message));
  }
  const controller = new AbortController(); const pending = comparisonFileSource(new File([xlsxFixture([{ name: 'A', rows: [['id'], ['a']] }]) as BlobPart], 'a.xlsx'), 'table', controller.signal); controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});
test('utility, asset and operation table adapters produce equivalent shared requests without writes or logs', async () => {
  const files = [new File(['id,qty\na,1\nb,2'], 'before.csv'), new File(['id,qty\nb,3\na,1'], 'after.csv')];
  const host = createMockHost(), utility = await Promise.all(files.map(file => comparisonFileSource(file, 'table')));
  const operation = await operationComparisonPair(files[0]!, files[1]!, host); if (operation.mode === 'visual') assert.fail();
  const assetHost = { assets: { get: async (id: string) => ({ id, format: 'csv', version: 'v1' }), bytes: async (ref: { id: string }) => new Uint8Array(await files[Number(ref.id)]!.arrayBuffer()) } } as unknown as HostV1;
  const asset = await comparisonAssetPair([{ id: '0', format: 'csv' }, { id: '1', format: 'csv' }], assetHost); if (asset.mode === 'visual') assert.fail();
  const requests = [{ version: 1 as const, before: utility[0]!, after: utility[1]! }, operation.request, asset.request];
  const results = requests.map(request => compareSources({ ...request, options: { tableRowKey: 'id' } }));
  assert.deepEqual(results.map(result => result.summary), [results[0]!.summary, results[0]!.summary, results[0]!.summary]);
  assert.deepEqual(results[0]!.changes, results[1]!.changes); assert.deepEqual(results[1]!.changes, results[2]!.changes);
  assert.equal(assetComparisonMode([{ format: 'xlsx' }, { format: 'tsv' }]), 'table'); assert.equal(assetComparisonMode([{ format: 'docx' }, { format: 'pdf' }]), 'document');
  assert.equal(assetComparisonMode([{ format: 'pdf' }, { format: 'pdf' }]), 'visual'); assert.equal(host.inspect.state.size, 0); assert.equal(host.inspect.logs.length, 0);
});
