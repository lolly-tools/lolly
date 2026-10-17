// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type PDFArray, PDFDict, PDFDocument, PDFName, type PDFPage, PDFPageLeaf, PDFRawStream, PDFString, decodePDFRawStream } from 'pdf-lib';
import { organizePdf } from '../src/pdf.ts';
import { pageEffects, scanPageFeatures } from '../src/pdf-page-effects.ts';

/** Give a page an uncompressed content stream that shows `text`, so a test can find it in the saved bytes. */
function writeOn(page: PDFPage, text: string): void {
  const ctx = page.doc.context;
  page.node.set(PDFName.of('Contents'), ctx.register(ctx.stream(`BT /F1 12 Tf 10 10 Td (${text}) Tj ET`)));
}

/**
 * Three pages: two bookmarks; page 1 has a link to page 3 and a web link;
 * page 2 has a comment and a filled text field; page 3 has a signed signature
 * field. Each page shows its own marker text. Built by hand so every feature is
 * present exactly once.
 */
async function featureFixture(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 3; i++) doc.addPage([200, 300]);
  const ctx = doc.context;
  const pages = doc.getPages();
  ['PAGE-ONE', 'PAGE-TWO', 'CONFIDENTIAL-PAGE-THREE'].forEach((text, i) => { writeOn(pages[i]!, text); });
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
  const value = ctx.register(ctx.obj({
    Type: 'Sig', Filter: 'Adobe.PPKLite', SubFilter: 'adbe.pkcs7.detached', ByteRange: [0, 10, 20, 30], Contents: PDFString.of('00'),
    Name: PDFString.of('Grace Hopper'), Location: PDFString.of('Arlington'), M: PDFString.of('D:20261017120000Z'),
  }));
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

/** Every object a saved PDF holds, as text with streams decoded, and how many page objects it holds. */
async function readEverything(bytes: Uint8Array): Promise<{ text: string; pageObjects: number }> {
  const doc = await PDFDocument.load(bytes);
  let text = '', pageObjects = 0;
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (object instanceof PDFPageLeaf) pageObjects++;
    if (object instanceof PDFRawStream) {
      text += object.dict.toString();
      try { text += Buffer.from(decodePDFRawStream(object).decode()).toString('latin1'); } catch { /* undecodable stream */ }
    } else {
      text += object.toString();
    }
    text += '\n';
  }
  return { text, pageObjects };
}

const SIGNATURE_DATA = /\/ByteRange|Adobe\.PPKLite|Grace Hopper|Arlington/;

test('a copy carries no page it left out and no signature value, so the report matches the bytes', async () => {
  const src = await featureFixture();
  const original = await readEverything(src);
  assert.match(original.text, /CONFIDENTIAL-PAGE-THREE/, 'the fixture shows its marker');
  assert.match(original.text, SIGNATURE_DATA, 'the fixture holds a signature value');
  // Deleting page 3, or extracting page 1 whose link points at page 3, must not
  // bring page 3 along as a detached copy.
  for (const opts of [{ operation: 'delete', pages: '3' }, { operation: 'extract', pages: '1' }, { operation: 'reorder', pages: '2,1' }] as const) {
    const res = await organizePdf(src, opts);
    const out = await readEverything(res.bytes!);
    const label = `${opts.operation} ${opts.pages}`;
    assert.doesNotMatch(out.text, /CONFIDENTIAL-PAGE-THREE/, `${label}: page 3 is not in the output`);
    assert.doesNotMatch(out.text, SIGNATURE_DATA, `${label}: no signature value`);
    assert.equal(out.pageObjects, res.afterPages, `${label}: no detached page copies`);
    assert.equal(outcomes(res.effects).signatures, '1 removed');
  }
  // A kept page 3 keeps what it shows, but the signature value is gone.
  const three = await organizePdf(src, { operation: 'extract', pages: '3' });
  const kept = await readEverything(three.bytes!);
  assert.match(kept.text, /CONFIDENTIAL-PAGE-THREE/);
  assert.doesNotMatch(kept.text, SIGNATURE_DATA);
  assert.equal(kept.pageObjects, 1);
  // Each split part holds only its own pages.
  const split = await organizePdf(src, { operation: 'split', pages: '1,2,3' });
  const parts = await Promise.all(split.files!.map(file => readEverything(file.bytes)));
  assert.deepEqual(parts.map(part => part.pageObjects), [1, 1, 1]);
  assert.deepEqual(parts.map(part => /CONFIDENTIAL-PAGE-THREE/.test(part.text)), [false, false, true]);
  for (const part of parts) assert.doesNotMatch(part.text, SIGNATURE_DATA);
  // Several inputs are copied twice, into one document and then into the output.
  const plain = await PDFDocument.create();
  writeOn(plain.addPage([100, 100]), 'PLAIN-PAGE');
  const merged = await organizePdf(src, { operation: 'merge', extras: [await plain.save()] });
  const all = await readEverything(merged.bytes!);
  assert.equal(all.pageObjects, 4);
  assert.doesNotMatch(all.text, SIGNATURE_DATA);
  const picked = await readEverything((await organizePdf(src, { operation: 'extract', pages: '1,4', extras: [await plain.save()] })).bytes!);
  assert.equal(picked.pageObjects, 2);
  assert.doesNotMatch(picked.text, /CONFIDENTIAL-PAGE-THREE|PAGE-TWO/);
});

test('rotating one PDF in place keeps the signature value, which is why it is reported as invalidated', async () => {
  const res = await organizePdf(await featureFixture(), { operation: 'rotate', pages: '1', rotation: 90 });
  assert.match((await readEverything(res.bytes!)).text, SIGNATURE_DATA);
  assert.equal(outcomes(res.effects).signatures, '1 invalidated');
});

test('a left-out page does not travel through a shared field, a reply or a stray page reference', async () => {
  const doc = await PDFDocument.create();
  const [one, two] = [doc.addPage([200, 200]), doc.addPage([200, 200])];
  writeOn(one, 'PAGE-ONE');
  writeOn(two, 'SECRET-PAGE-TWO');
  const ctx = doc.context;
  // One text field with a widget on each page.
  const field = doc.getForm().createTextField('shared');
  field.setText('same value');
  field.addToPage(one, { x: 10, y: 10, width: 80, height: 20 });
  field.addToPage(two, { x: 10, y: 10, width: 80, height: 20 });
  field.acroField.getWidgets()[1]!.dict.set(PDFName.of('Contents'), PDFString.of('WIDGET-ON-TWO'));
  // A reply on page 1 to a comment on page 2, and a square on page 1 that names page 2 as its page.
  const comment = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Text', Rect: [0, 0, 20, 20], Contents: PDFString.of('COMMENT-ON-TWO') }));
  const reply = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Text', Rect: [30, 30, 50, 50], Contents: PDFString.of('REPLY-ON-ONE'), IRT: comment }));
  const square = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Square', Rect: [60, 60, 90, 90], P: two.ref }));
  (two.node.Annots() as PDFArray).push(comment);
  (one.node.Annots() as PDFArray).push(reply);
  (one.node.Annots() as PDFArray).push(square);

  const src = await doc.save({ useObjectStreams: false });
  const res = await organizePdf(src, { operation: 'delete', pages: '2' });
  const out = await readEverything(res.bytes!);
  assert.doesNotMatch(out.text, /SECRET-PAGE-TWO|WIDGET-ON-TWO|COMMENT-ON-TWO/);
  assert.match(out.text, /PAGE-ONE/);
  assert.match(out.text, /REPLY-ON-ONE/, 'the reply stays on its page');
  assert.equal(out.pageObjects, 1);
  // Each annotation that stayed points at its own page in the new PDF.
  const saved = await PDFDocument.load(res.bytes!);
  const page = saved.getPages()[0]!;
  const annots = page.node.Annots()!.asArray().map(ref => saved.context.lookup(ref, PDFDict));
  assert.equal(annots.length, 3, 'the widget, the reply and the square');
  for (const annot of annots) assert.equal(annot.get(PDFName.of('P')), page.ref);

  // Split parts that share a page: the first part leaves page 2 out, and the
  // second, which keeps page 2, still has the reply joined to its comment.
  const split = await organizePdf(src, { operation: 'split', pages: '1,1-2' });
  const [first, second] = split.files!;
  assert.doesNotMatch((await readEverything(first!.bytes)).text, /SECRET-PAGE-TWO|WIDGET-ON-TWO|COMMENT-ON-TWO/);
  const both = await PDFDocument.load(second!.bytes);
  const pairs = both.getPages().map(p => p.node.Annots()!.asArray().map(ref => both.context.lookup(ref, PDFDict)));
  const answered = pairs[0]!.find(a => a.get(PDFName.of('Contents'))?.toString() === '(REPLY-ON-ONE)')!;
  const thread = both.context.lookup(answered.get(PDFName.of('IRT')), PDFDict);
  assert.equal(thread.get(PDFName.of('Contents'))?.toString(), '(COMMENT-ON-TWO)');
  assert.equal(thread.get(PDFName.of('P')), both.getPages()[1]!.ref, 'the comment points at its own page in this part');
});
