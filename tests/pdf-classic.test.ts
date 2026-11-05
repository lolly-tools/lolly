// SPDX-License-Identifier: MPL-2.0
/**
 * `classicPdfForStamp`: a PDF saved with a cross-reference stream becomes one the C2PA
 * embedder can extend, with the same pages and metadata, and anything else is left alone.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { classicPdfForStamp } from '../packages/node-shell/src/pdf-classic.ts';
import { embedC2pa, generateSigner } from '../engine/src/c2pa.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';

const DATES = { notBefore: new Date(Date.now() - 60_000), notAfter: new Date(Date.now() + 86_400_000) };
const ORIGIN = { claimGenerator: 'Lolly', generatorInfo: { name: 'Lolly', version: 'test' }, title: 'Card', dates: DATES };

async function aPdf(useObjectStreams: boolean): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setTitle('Certificate');
  doc.setProducer('Lolly');
  doc.setKeywords(['lolly:ds=demo']);
  const page = doc.addPage([842, 595]);
  page.drawText('Sam Rivera', { x: 40, y: 500, font: await doc.embedFont(StandardFonts.Helvetica), size: 24 });
  return doc.save({ useObjectStreams });
}

test('a cross-reference stream is what the embedder refuses, and after this it attaches and verifies', async () => {
  const streamed = await aPdf(true);
  const signer = await generateSigner(DATES);
  await assert.rejects(() => embedC2pa(streamed, 'pdf', { ...ORIGIN, signer }), /cross-reference stream/);
  const classic = await classicPdfForStamp(streamed, 'pdf');
  const stamped = await embedC2pa(classic, 'pdf', { ...ORIGIN, signer });
  assert.equal((await verifyC2pa(stamped)).state, 'valid');
});

test('the pages and metadata carry over', async () => {
  const streamed = await aPdf(true);
  const [before, after] = await Promise.all([PDFDocument.load(streamed, { updateMetadata: false }), PDFDocument.load(await classicPdfForStamp(streamed, 'pdf'), { updateMetadata: false })]);
  assert.equal(after.getPageCount(), before.getPageCount());
  assert.deepEqual(after.getPage(0).getSize(), before.getPage(0).getSize());
  assert.equal(after.getTitle(), 'Certificate');
  assert.equal(after.getProducer(), 'Lolly', 'the library does not stamp itself as the producer');
  assert.equal(after.getKeywords(), before.getKeywords());
});

test('a PDF with a classic table, another format and an unreadable file come back as the same bytes', async () => {
  const classic = await aPdf(false);
  assert.equal(await classicPdfForStamp(classic, 'pdf'), classic);
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>');
  assert.equal(await classicPdfForStamp(svg, 'svg'), svg);
  const broken = new TextEncoder().encode('%PDF-1.7\nnot really\nstartxref\n3\n%%EOF\n');
  assert.equal(await classicPdfForStamp(broken, 'pdf'), broken);
});
