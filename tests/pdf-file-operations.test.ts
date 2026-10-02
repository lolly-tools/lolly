// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName } from 'pdf-lib';
import { runPdfFileOperation } from '../packages/node-shell/src/pdf-file-operation.ts';
import { runNodeFileOperation } from '../packages/node-shell/src/file-operations.ts';
test('PDF clean removes descriptive metadata while keeping pages and returns an honest receipt', async () => {
  const doc = await PDFDocument.create(); doc.addPage([300, 200]); doc.setAuthor('Private author'); doc.setTitle('Private title');
  const bytes = await doc.save();
  const result = await runNodeFileOperation(new File([bytes as BlobPart], 'proof.pdf', { type: 'application/pdf' }), { version: 1, operation: 'convert', target: 'pdf-clean', options: {} });
  assert.equal(result.report.state, 'succeeded'); assert.equal(result.report.metadata, 'changed');
  assert.ok(result.report.findings.some(f => f.message.includes('not redaction')));
  const cleaned = await PDFDocument.load(await result.output!.arrayBuffer(), { updateMetadata: false });
  assert.equal(cleaned.getAuthor(), undefined); assert.equal(cleaned.getTitle(), undefined);
  assert.deepEqual(cleaned.getPages()[0]!.getSize(), { width: 300, height: 200 });
  const optimized = await runPdfFileOperation(bytes, 'pdf-optimize'); assert.ok(optimized.length <= bytes.length);
});
test('direct and indirect PDF signature dictionaries are refused', async () => {
  for (const indirect of [false, true]) {
    const doc = await PDFDocument.create(); doc.addPage();
    const signature = doc.context.obj({ Type: 'Sig', ByteRange: [0, 1, 2, 3] });
    doc.catalog.set(PDFName.of('TestSignature'), indirect ? doc.context.register(signature) : signature);
    await assert.rejects(runPdfFileOperation(await doc.save(), 'pdf-clean'), /digital signature/);
  }
});

test('split pages keep page order, sizes and artwork while dropping document metadata', async () => {
  const { splitPdfPages } = await import('../packages/node-shell/src/pdf-file-operation.ts');
  const source = await PDFDocument.create(); source.setAuthor('Source author');
  source.addPage([120, 80]).drawText('First'); source.addPage([220, 180]).drawText('Second');
  const pages = await splitPdfPages(await source.save());
  assert.equal(pages.length, 2);
  for (const [index, bytes] of pages.entries()) {
    const page = await PDFDocument.load(bytes, { updateMetadata: false });
    assert.equal(page.getPageCount(), 1);
    assert.equal(page.getAuthor(), undefined);
    assert.equal(page.getPages()[0]!.getWidth(), index === 0 ? 120 : 220);
    assert.ok(page.getPages()[0]!.node.Contents());
  }
});
test('PDF splitting refuses interactive sources and cancellation', async () => {
  const { splitPdfPages } = await import('../packages/node-shell/src/pdf-file-operation.ts');
  for (const field of ['AcroForm', 'Names', 'OpenAction']) {
    const doc = await PDFDocument.create(); doc.addPage(); doc.catalog.set(PDFName.of(field), doc.context.obj({}));
    await assert.rejects(splitPdfPages(await doc.save()), /static document/);
  }
  const doc = await PDFDocument.create(); const page = doc.addPage(); page.node.set(PDFName.of('Annots'), doc.context.obj([{ Type: 'Annot' }]));
  await assert.rejects(splitPdfPages(await doc.save()), /annotations/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(splitPdfPages(await doc.save(), controller.signal), /abort/i);
});

test('web file operation packages split pages and reports the metadata loss', async () => {
  const { runWebFileOperation } = await import('../shells/web/src/lib/file-operation-adapter.ts');
  const { unzipSync } = await import('fflate');
  const doc = await PDFDocument.create(); doc.addPage([100, 100]); doc.addPage([200, 100]);
  const result = await runWebFileOperation(new File([await doc.save() as BlobPart], 'pages.pdf', { type: 'application/pdf' }), { version: 1, operation: 'convert', target: 'pdf-split', options: {} });
  assert.equal(result.report.state, 'succeeded');
  assert.equal(result.report.metadata, 'removed');
  const files = unzipSync(new Uint8Array(await result.output!.arrayBuffer()));
  assert.deepEqual(Object.keys(files), ['pages-page-001.pdf', 'pages-page-002.pdf']);
  assert.equal((await PDFDocument.load(files['pages-page-002.pdf']!)).getPages()[0]!.getWidth(), 200);
  assert.ok(result.report.findings.some(f => f.code === 'pdf-static-pages'));
});
