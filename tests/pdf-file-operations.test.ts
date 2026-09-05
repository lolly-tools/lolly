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
