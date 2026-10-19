// SPDX-License-Identifier: MPL-2.0
/** The shared finishing pass preserves PDF-X identity and AES encrypt-last ordering. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDecipheriv } from 'node:crypto';
import { PDFDocument, PDFName, PDFDict, PDFHexString, PDFRawStream, PDFArray } from 'pdf-lib';
import { preparePassword, hashR6 } from '../engine/src/pdf-crypto-r6.ts';
import { extractC2paStore } from '@lolly/engine';
import { applyPdfX } from '../packages/node-shell/src/pdfx.ts';
import { applyPdfX as webApplyPdfX } from '../shells/web/src/bridge/export-pdfx.ts';
import { finishPdfX, encryptPdfStrong, provenanceLabels } from '../packages/node-shell/src/pdf-finishing.ts';

test('the web PDF-X facade uses the same implementation as Node', () => {
  assert.equal(webApplyPdfX, applyPdfX);
});

test('AES encrypts already-finished strings and metadata; decrypting them recovers the original producer and withheld PDF-X claim', async () => {
  const original = await PDFDocument.create();
  original.addPage([120, 80]);
  original.setTitle('Encrypted proof');
  // A previously claimed file must not carry that claim into an encrypted derivative.
  await applyPdfX(original, { meta: { software: 'Old writer', tool: 'Design' } }, 'srgb');
  const oldInfo = original.context.lookup(original.context.trailerInfo.Info, PDFDict);
  assert.ok(oldInfo.get(PDFName.of('GTS_PDFXVersion')));
  const password = 'test open password';
  const finished = await finishPdfX(await original.save(), {
    strongPassword: password, c2pa: true,
    meta: { software: 'Lolly', source: 'https://lolly.tools', tool: 'Design', author: '', contact: '', description: '' },
  });
  const encrypted = new Uint8Array(await (await encryptPdfStrong(finished, password)).arrayBuffer());
  assert.equal(extractC2paStore(encrypted), null, 'an encrypted document has no C2PA update');
  const doc = await PDFDocument.load(encrypted, { ignoreEncryption: true, updateMetadata: false });
  const enc = doc.context.lookup(doc.context.trailerInfo.Encrypt, PDFDict);
  assert.equal(String(enc.get(PDFName.of('V'))), '5');
  assert.equal(String(enc.get(PDFName.of('R'))), '6');
  const cf = enc.lookup(PDFName.of('CF'), PDFDict).lookup(PDFName.of('StdCF'), PDFDict);
  assert.equal(String(cf.get(PDFName.of('CFM'))), '/AESV3');
  const user = enc.lookup(PDFName.of('U'), PDFHexString).asBytes();
  const keyHash = await hashR6(preparePassword(password), user.subarray(40, 48));
  const wrappedKey = enc.lookup(PDFName.of('UE'), PDFHexString).asBytes();
  const keyCipher = createDecipheriv('aes-256-cbc', keyHash, new Uint8Array(16));
  keyCipher.setAutoPadding(false);
  const key = Buffer.concat([keyCipher.update(wrappedKey), keyCipher.final()]);
  const decrypt = (bytes: Uint8Array): Buffer => {
    const cipher = createDecipheriv('aes-256-cbc', key, bytes.subarray(0, 16));
    return Buffer.concat([cipher.update(bytes.subarray(16)), cipher.final()]);
  };
  const text = (bytes: Uint8Array): string => PDFHexString.of(decrypt(bytes).toString('hex')).decodeText();
  const info = doc.context.lookup(doc.context.trailerInfo.Info, PDFDict);
  assert.equal(text(info.lookup(PDFName.of('Producer'), PDFHexString).asBytes()), 'Lolly');
  assert.equal(text(info.lookup(PDFName.of('Title'), PDFHexString).asBytes()), 'Encrypted proof');
  assert.equal(info.get(PDFName.of('GTS_PDFXVersion')), undefined);
  const metadata = doc.catalog.lookup(PDFName.of('Metadata'));
  assert.ok(metadata instanceof PDFRawStream);
  const xml = decrypt(metadata.getContents()).toString('utf8');
  assert.match(xml, /<pdf:Producer>Lolly<\/pdf:Producer>/);
  assert.doesNotMatch(xml, /GTS_PDFXVersion/);
  assert.equal(doc.catalog.lookup(PDFName.of('OutputIntents'), PDFArray).size(), 1);
});

// The proof credit follows the description's rule (plans/319, decision 6): the tool's
// name gains the colourway's when the export records one, and never the design
// system's label; with no record the credit is the line it always was.
test('provenanceLabels: the proof credit gives the colourway beside the tool, never the design system', () => {
  const base = { software: 'Lolly', source: 'https://lolly.tools', tool: 'Chart', author: 'Andy Fitzsimon', contact: '', description: '' };
  const plain = provenanceLabels(base)!;
  assert.equal(plain.bottomLeftUp, 'Chart by Andy Fitzsimon');
  assert.equal(plain.topRight, 'Made with https://lolly.tools');
  const recorded = provenanceLabels({
    ...base, designSystem: { id: 'acme', label: 'Acme' },
    themes: [{ group: 'colourway', kind: 'colourway', id: 'persimmon', name: 'Persimmon' }],
  })!;
  assert.equal(recorded.bottomLeftUp, 'Chart (Persimmon colourway) by Andy Fitzsimon');
  assert.equal(JSON.stringify(recorded).includes('Acme'), false);
  // A non-colourway choice is in the record only; the credit keeps its plain form.
  assert.equal(provenanceLabels({ ...base, themes: [{ group: 'density', id: 'roomy', name: 'Roomy' }] })!.bottomLeftUp, 'Chart by Andy Fitzsimon');
  assert.equal(provenanceLabels({ ...base, tool: '' })!.bottomLeftUp, '', 'no tool name, no credit');
});
