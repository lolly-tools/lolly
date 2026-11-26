// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, rgb } from 'pdf-lib';
import { lockPdf, organizePdf, parsePdfPageExpression, stampPdf } from '../src/pdf.ts';
import { scanPdfPages } from '../src/pdf-pages.ts';

async function fixture(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Five numbered pages');
  doc.setAuthor('Fixture author');
  for (let i = 1; i <= 5; i++) {
    const page = doc.addPage([100 + i, 200 + i]);
    page.drawRectangle({ x: i, y: i, width: 10, height: 10, color: rgb(i / 5, 0, 0) });
  }
  return doc.save({ useObjectStreams: false });
}

async function sizes(bytes: Uint8Array): Promise<number[][]> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  return doc.getPages().map(page => [page.getWidth(), page.getHeight()]);
}

test('page expression supports open and descending ranges and keeps repeats', () => {
  assert.deepEqual(parsePdfPageExpression('1-3,5,3-2,2', 5), [1, 2, 3, 5, 3, 2, 2]);
  assert.deepEqual(parsePdfPageExpression('3-', 5), [3, 4, 5]);
  assert.throws(() => parsePdfPageExpression('0,7', 5), /outside this 5-page/);
});

test('Pages reorders, extracts and deletes the requested source pages', async () => {
  const src = await fixture();
  const reordered = await organizePdf(src, { operation: 'reorder', pages: '5,1-2,4,3' });
  assert.deepEqual(reordered.pageOrder, [5, 1, 2, 4, 3]);
  assert.deepEqual(await sizes(reordered.bytes!), [[105, 205], [101, 201], [102, 202], [104, 204], [103, 203]]);

  const extracted = await organizePdf(src, { operation: 'extract', pages: '2-3' });
  assert.equal(extracted.afterPages, 2);
  assert.deepEqual(await sizes(extracted.bytes!), [[102, 202], [103, 203]]);

  const deleted = await organizePdf(src, { operation: 'delete', pages: '2,4' });
  assert.deepEqual(deleted.pageOrder, [1, 3, 5]);
  assert.deepEqual(await sizes(deleted.bytes!), [[101, 201], [103, 203], [105, 205]]);
});

test('Pages rotates without changing order, merges, and splits each comma group', async () => {
  const src = await fixture();
  const rotated = await organizePdf(src, { operation: 'rotate', pages: '2-4', rotation: 90 });
  const rotDoc = await PDFDocument.load(rotated.bytes!);
  assert.deepEqual(rotDoc.getPages().map(page => page.getRotation().angle), [0, 90, 90, 90, 0]);

  const extra = await PDFDocument.create(); extra.addPage([999, 555]);
  const merged = await organizePdf(src, { operation: 'merge', extra: await extra.save() });
  assert.equal(merged.afterPages, 6);
  assert.deepEqual((await sizes(merged.bytes!)).at(-1), [999, 555]);

  const split = await organizePdf(src, { operation: 'split', pages: '1-2,4,5-3' });
  assert.deepEqual(split.files!.map(file => file.pages), [[1, 2], [4], [5, 4, 3]]);
  assert.deepEqual(await Promise.all(split.files!.map(file => sizes(file.bytes))), [
    [[101, 201], [102, 202]], [[104, 204]], [[105, 205], [104, 204], [103, 203]],
  ]);
});

test('Pages combines several PDFs into one draggable order without changing page sizes', async () => {
  const primary = await fixture();
  const second = await PDFDocument.create();
  second.addPage([999, 555]);
  second.addPage([333, 777]);
  const third = await PDFDocument.create();
  third.addPage([640, 360]);
  const secondBytes = await second.save();
  const thirdBytes = await third.save();

  const arranged = await organizePdf(primary, {
    operation: 'reorder',
    pages: '8,6,1,7',
    extras: [secondBytes, thirdBytes],
  });

  assert.equal(arranged.beforePages, 8);
  assert.equal(arranged.beforeBytes, primary.length + secondBytes.length + thirdBytes.length);
  assert.deepEqual(arranged.pageOrder, [8, 6, 1, 7]);
  assert.deepEqual(await sizes(arranged.bytes!), [
    [640, 360], [999, 555], [101, 201], [333, 777],
  ]);
});

test('Pages preserves primary metadata and adds no Lolly producer credit', async () => {
  const res = await organizePdf(await fixture(), { operation: 'extract', pages: '1-2' });
  const doc = await PDFDocument.load(res.bytes!, { updateMetadata: false });
  assert.equal(doc.getTitle(), 'Five numbered pages');
  assert.equal(doc.getAuthor(), 'Fixture author');
  assert.doesNotMatch(doc.getProducer() || '', /lolly/i);
});

test('Sign stamp placement uses exact top-left PDF points', async () => {
  const doc = await PDFDocument.create(); doc.addPage([300, 400]);
  const pngDoc = await PDFDocument.create();
  // pdf-lib's own tiny opaque PNG fixture: a 1x1 red PNG.
  void pngDoc;
  const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=', 'base64'));
  const out = await stampPdf(await doc.save(), { images: [{ bytes: png, page: 1, x: 40, y: 60, width: 120, height: 30 }] });
  const scan = await scanPdfPages(out.bytes);
  const image = scan.pages[0]!.nodes.find(node => node.kind === 'image');
  assert.ok(image);
  assert.ok(Math.abs(image.x! - 40) < 0.01);
  assert.ok(Math.abs(image.y! - 60) < 0.01);
  assert.ok(Math.abs(image.w! - 120) < 0.01);
  assert.ok(Math.abs(image.h! - 30) < 0.01);
});

test('Sign stamps a path at its baseline in top-left PDF points, and only path data', async () => {
  const doc = await PDFDocument.create(); doc.addPage([300, 400]);
  const src = await doc.save();
  // A 20 x 10 box drawn up from its baseline, as host.text.toPath outlines text (y-down).
  const out = await stampPdf(src, { images: [], paths: [{ page: 1, x: 40, y: 100, d: 'M0 0L20 0L20 -10L0 -10Z', color: '#ff0000' }] });
  assert.equal(out.stamps, 1, 'the path counts as a stamp');
  const scan = await scanPdfPages(out.bytes);
  const fill = scan.pages[0]!.nodes.find(node => node.kind === 'box');
  assert.ok(fill, `a filled path is on the page: ${JSON.stringify(scan.pages[0]!.nodes.map(n => n.kind))}`);
  assert.ok(Math.abs(fill.x! - 40) < 0.01 && Math.abs(fill.y! - 90) < 0.01, `at x 40, top 90: ${fill.x}, ${fill.y}`);
  assert.ok(Math.abs(fill.w! - 20) < 0.01 && Math.abs(fill.h! - 10) < 0.01, `20 x 10: ${fill.w} x ${fill.h}`);
  for (const d of ['', 'M0 0 <script>', 'M0 0 script', 'M0 0L1 1'.repeat(30_000), 'M0 0L1e999 1Z', `M0 0${'Z'.repeat(190_000)}`, 'L1 1', 'M0']) {
    await assert.rejects(stampPdf(src, { images: [], paths: [{ page: 1, x: 0, y: 0, d }] }), /SVG path data/, d.slice(0, 20));
  }
  await assert.rejects(stampPdf(src, { images: [], paths: [{ page: 2, x: 0, y: 0, d: 'M0 0L1 1Z' }] }), /outside/);
  // A non-finite origin is pinned to the page, never written into the transform.
  const pinned = await stampPdf(src, { images: [], paths: [{ page: 1, x: Infinity, y: Number.NaN, d: 'M0 0L10 0L10 10L0 10Z' }] });
  const box = (await scanPdfPages(pinned.bytes)).pages[0]!.nodes.find(node => node.kind === 'box');
  assert.ok(box && Math.abs(box.x!) < 0.01 && Math.abs(box.y!) < 0.01, `the origin falls back to the page's top-left: ${JSON.stringify(box)}`);
});

test('a stamped path\'s quadratic curves become the cubics with the same shape', async () => {
  const { parseStampPath } = await import('../src/pdf.ts');
  // A quadratic from (0,0) through control (30,60) to (60,0): its cubic controls sit two
  // thirds of the way to the quadratic control, (20,40) and (40,40).
  assert.deepEqual(parseStampPath('M0 0Q30 60 60 0Z'), [['M', 0, 0], ['C', 20, 40, 40, 40, 60, 0], ['Z']]);
  // A subnormal number is rounded to zero rather than written in a form the PDF cannot read.
  assert.deepEqual(parseStampPath('M0 0L5e-324 1Z'), [['M', 0, 0], ['L', 0, 1], ['Z']]);
  // Relative commands, H and V, an uppercase exponent and a repeated L after M.
  assert.deepEqual(parseStampPath('m10 10h5v5l-5 0 1E1 1E1z'), [['M', 10, 10], ['L', 15, 10], ['L', 15, 15], ['L', 10, 15], ['L', 20, 25], ['Z']]);
});

test('locked output needs its password and page transforms name the refusal', async () => {
  const locked = await lockPdf(await fixture(), 'correct horse battery staple');
  await assert.rejects(() => PDFDocument.load(locked.bytes), /encrypted/i);
  await assert.rejects(() => organizePdf(locked.bytes, { operation: 'extract', pages: '1' }), /encrypted.*unlock.*password/i);
});
