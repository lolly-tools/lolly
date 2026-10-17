// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type PDFArray, PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { organizePdf } from '../src/pdf.ts';
import { pageEffects, scanPageFeatures } from '../src/pdf-page-effects.ts';

/**
 * Three pages: two bookmarks; page 1 has a link to page 3 and a web link;
 * page 2 has a comment and a filled text field; page 3 has a signed signature
 * field. Built by hand so every feature is present exactly once.
 */
async function featureFixture(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 3; i++) doc.addPage([200, 300]);
  const ctx = doc.context;
  const pages = doc.getPages();
  const outlines = ctx.nextRef(), first = ctx.nextRef(), second = ctx.nextRef();
  ctx.assign(first, ctx.obj({ Title: PDFString.of('One'), Parent: outlines, Next: second, Dest: [pages[0]!.ref, 'Fit'] }));
  ctx.assign(second, ctx.obj({ Title: PDFString.of('Three'), Parent: outlines, Prev: first, Dest: [pages[2]!.ref, 'Fit'] }));
  ctx.assign(outlines, ctx.obj({ Type: 'Outlines', First: first, Last: second, Count: 2 }));
  doc.catalog.set(PDFName.of('Outlines'), outlines);
  const internal = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: [0, 0, 50, 50], Dest: [pages[2]!.ref, 'Fit'] }));
  const web = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: [0, 60, 50, 90], A: { S: 'URI', URI: PDFString.of('https://example.com/') } }));
  pages[0]!.node.set(PDFName.of('Annots'), ctx.obj([internal, web]));
  const note = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Text', Rect: [10, 10, 30, 30], Contents: PDFString.of('Check this') }));
  pages[1]!.node.set(PDFName.of('Annots'), ctx.obj([note]));
  const field = doc.getForm().createTextField('name');
  field.setText('Ada');
  field.addToPage(pages[1]!, { x: 20, y: 100, width: 100, height: 20 });
  const value = ctx.register(ctx.obj({ Type: 'Sig', Filter: 'Adobe.PPKLite', SubFilter: 'adbe.pkcs7.detached', ByteRange: [0, 10, 20, 30], Contents: PDFString.of('00') }));
  const signature = ctx.register(ctx.obj({ FT: 'Sig', T: PDFString.of('Signature1'), V: value, Type: 'Annot', Subtype: 'Widget', Rect: [0, 0, 80, 30], P: pages[2]!.ref }));
  pages[2]!.node.set(PDFName.of('Annots'), ctx.obj([signature]));
  (doc.getForm().acroForm.dict.get(PDFName.of('Fields')) as PDFArray).push(signature);
  return doc.save({ useObjectStreams: false });
}

const outcomes = (effects: Array<{ feature: string; count: number; outcome: string }> | undefined) =>
  Object.fromEntries((effects ?? []).map(e => [e.feature, `${e.count} ${e.outcome}`]));

test('a copied page set reports dropped bookmarks, broken links and forms, and an unsigned result', async () => {
  const res = await organizePdf(await featureFixture(), { operation: 'extract', pages: '1-2' });
  assert.deepEqual(outcomes(res.effects), {
    bookmarks: '2 removed', annotations: '1 kept', links: '1 broken', forms: '1 broken', signatures: '1 removed',
  });
  for (const effect of res.effects!) assert.match(effect.message, /^\d+ \S/);
  // The report matches the output, read back independently of the scan.
  const out = await PDFDocument.load(res.bytes!);
  assert.equal(out.catalog.get(PDFName.of('Outlines')), undefined, 'no outline in the new PDF');
  assert.deepEqual(out.getForm().getFields(), [], 'no fillable fields in the new PDF');
  assert.equal(out.getPages()[1]!.node.Annots()?.size(), 2, 'the comment and the widget still travel with page 2');
});

test('only features on output pages count, and document-level losses still apply', async () => {
  const res = await organizePdf(await featureFixture(), { operation: 'extract', pages: '3' });
  assert.deepEqual(outcomes(res.effects), { bookmarks: '2 removed', signatures: '1 removed' });
  const split = await organizePdf(await featureFixture(), { operation: 'split', pages: '1,2' });
  assert.deepEqual(outcomes(split.effects), {
    bookmarks: '2 removed', annotations: '1 kept', links: '1 broken', forms: '1 broken', signatures: '1 removed',
  });
});

test('rotating one PDF edits it in place: everything works except the signature', async () => {
  const res = await organizePdf(await featureFixture(), { operation: 'rotate', pages: '1', rotation: 90 });
  assert.deepEqual(outcomes(res.effects), {
    bookmarks: '2 kept', annotations: '1 kept', links: '1 kept', forms: '1 kept', signatures: '1 invalidated',
  });
  const out = await PDFDocument.load(res.bytes!);
  assert.ok(out.catalog.get(PDFName.of('Outlines')), 'the outline is still there');
  assert.deepEqual(out.getForm().getFields().map(f => f.getName()).sort(), ['Signature1', 'name']);
  assert.match(res.effects!.find(e => e.feature === 'signatures')!.message, /no longer verifies/);
});

test('rotating several PDFs copies them first, so it reports like any copy', async () => {
  const plain = await PDFDocument.create();
  plain.addPage([100, 100]);
  const res = await organizePdf(await featureFixture(), { operation: 'rotate', pages: '4', rotation: 180, extras: [await plain.save()] });
  assert.equal(outcomes(res.effects).bookmarks, '2 removed');
  assert.equal(outcomes(res.effects).signatures, '1 removed');
});

test('a PDF with none of the features reports nothing, and one-off counts read naturally', async () => {
  const plain = await PDFDocument.create();
  plain.addPage([100, 100]);
  const res = await organizePdf(await plain.save(), { operation: 'reorder', pages: '1' });
  assert.deepEqual(res.effects, []);
  const one = pageEffects([{ bookmarks: 1, signatures: 0, pages: [{ annotations: 0, links: 1, fields: [] }] }], [1], false);
  assert.deepEqual(one.map(e => e.message), ['1 bookmark is not carried into the new PDF.', '1 link to another page no longer works.']);
});

test('a cyclic outline and field tree give finite counts instead of hanging', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([100, 100]);
  const ctx = doc.context;
  const outlines = ctx.nextRef(), item = ctx.nextRef();
  ctx.assign(item, ctx.obj({ Title: PDFString.of('Loop'), Parent: outlines, Next: item, First: item }));
  ctx.assign(outlines, ctx.obj({ Type: 'Outlines', First: item }));
  doc.catalog.set(PDFName.of('Outlines'), outlines);
  const field = ctx.nextRef();
  ctx.assign(field, ctx.obj({ FT: 'Sig', T: PDFString.of('Loop'), Kids: [field], Parent: field }));
  doc.catalog.set(PDFName.of('AcroForm'), ctx.obj({ Fields: [field] }));
  const features = scanPageFeatures(doc);
  assert.equal(features.bookmarks, 1);
  assert.equal(features.signatures, 0, 'an unsigned signature field is not a signature');
});
