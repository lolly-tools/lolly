// SPDX-License-Identifier: MPL-2.0
/**
 * The PDF writer (export-pdf-doc.ts), asserted on the PRODUCED BYTES.
 * Run directly:  node --test shells/web/src/bridge/export-pdf-doc.test.ts
 *
 * This module took over from a second PDF library, so what is worth pinning is
 * the part the rest of the export path depends on rather than the drawing API's
 * surface: the top-left change of basis every walker coordinate is written in,
 * the two-decimal colour operators the CMYK substitution pass matches its palette
 * keys against, the resource dictionaries PDF/X reads, the standard-tier lock,
 * and the TrueType subset an embedded run carries.
 *
 * No DOM: the writer is byte work over pdf-lib, so this needs neither jsdom nor a
 * canvas. The font fixture is the platform Outfit face shipped with the web shell.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createPdfDoc, type PdfDoc } from './export-pdf-doc.ts';
import { parseSfnt, subsetSfnt } from './export-pdf-sfnt.ts';
import { md5, rc4, buildRc4Security } from './export-pdf-rc4.ts';
import { cmykKey } from '@lolly/engine';

const OUTFIT_TTF = fileURLToPath(new URL('../../public/fonts/Outfit[wght].ttf', import.meta.url));
const NO_FONT = existsSync(OUTFIT_TTF) ? false : 'no platform font fixture on disk';

/** The finished bytes, as latin1 text plus the decoded page-1 content stream. */
async function readBack(doc: PdfDoc): Promise<{ raw: string; content: string; lib: any; pdf: any }> {
  const bytes = new Uint8Array(await doc.output('arraybuffer') as ArrayBuffer);
  const lib = await import('pdf-lib') as any;
  const pdf = await lib.PDFDocument.load(bytes, { updateMetadata: false });
  const stream = pdf.context.lookup(pdf.getPage(0).node.get(lib.PDFName.of('Contents')));
  const content = new TextDecoder('latin1').decode(inflateSync(Buffer.from(stream.contents)));
  return { raw: new TextDecoder('latin1').decode(bytes), content, lib, pdf };
}

test('the page opens in top-left space and a rect lands where the caller put it', async () => {
  const doc = await createPdfDoc({ format: [300, 200] });
  doc.setFillColor(255, 0, 0);
  doc.rect(10, 20, 30, 40, 'F');
  const { content, pdf } = await readBack(doc);

  assert.equal(content.split('\n')[0], '1 0 0 -1 0 200 cm',
    'the change of basis is the first operator, so every later coordinate is top-left, y-down');
  assert.match(content, /\n10 20 30 40 re\nf\b/, 'the rect keeps the caller units verbatim');
  const box = pdf.getPage(0).getSize();
  assert.deepEqual([box.width, box.height], [300, 200]);
});

test('orientation normalises the page the way the export callers expect', async () => {
  const wide = await createPdfDoc({ format: [300, 200], orientation: 'landscape' });
  const tall = await createPdfDoc({ format: [300, 200], orientation: 'portrait' });
  assert.deepEqual(Object.values((await readBack(wide)).pdf.getPage(0).getSize()), [300, 200]);
  assert.deepEqual(Object.values((await readBack(tall)).pdf.getPage(0).getSize()), [200, 300]);
});

test('colour operators are two decimals, and a neutral triple is DeviceGray', async () => {
  const doc = await createPdfDoc({ format: [100, 100] });
  doc.setFillColor(124, 60, 200);
  doc.setDrawColor(124, 124, 124);
  doc.rect(0, 0, 10, 10, 'F');
  const { content } = await readBack(doc);

  // The CMYK pass matches brand swatches on a two-decimal key (engine cmykKey), so
  // the operator text has to be written at exactly that precision.
  assert.match(content, /\n0\.49 0\.24 0\.78 rg\n/);
  assert.equal(cmykKey(124 / 255, 60 / 255, 200 / 255), '49,24,78');
  assert.match(content, /\n0\.49 G\n/, 'r === g === b collapses to the gray operator');
});

test('an alpha state, a clip and a gradient each reach the page resources', async () => {
  const doc = await createPdfDoc({ format: [100, 100] });
  doc.saveGraphicsState();
  doc.rect(0, 0, 50, 50, null);
  doc.clip();
  doc.discardPath();
  doc.setGState(new doc.GState({ opacity: 0.5, 'stroke-opacity': 0.5 }));
  doc.addShadingPattern('g1', new doc.ShadingPattern('axial', [0, 0, 100, 0], [
    { offset: 0, color: [255, 0, 0] }, { offset: 1, color: [0, 0, 255] },
  ]));
  doc.rect(0, 0, 100, 100, null);
  doc.fill({ key: 'g1', matrix: new doc.Matrix(1, 0, 0, 1, 0, 0) });
  doc.restoreGraphicsState();
  const { content, pdf, lib } = await readBack(doc);

  assert.match(content, /0 0 50 50 re\nW\nn/, 'a null style adds the path without painting it');
  assert.match(content, /\/GA1 gs/);
  assert.match(content, /q\n0 0 100 100 re\nW n\n1 0 0 1 0 0 cm\n\/Sh1 sh\nQ/, 'q comes before the path (a q inside a path object is not allowed), the path clips, then the shading paints through it and Q undoes the clip');
  const res = pdf.getPage(0).node.Resources();
  assert.ok(res.get(lib.PDFName.of('ExtGState')), 'the alpha state is declared');
  const shading = pdf.context.lookup(res.lookup(lib.PDFName.of('Shading'), lib.PDFDict).get(lib.PDFName.of('Sh1')));
  assert.equal(String(shading.get(lib.PDFName.of('ColorSpace'))), '/DeviceRGB');
  assert.equal(String(shading.get(lib.PDFName.of('ShadingType'))), '2');
});

test('an image is placed with a flipped unit square and embedded once per source', async () => {
  // 1x1 transparent PNG, the smallest thing pdf-lib's embedder will take.
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const doc = await createPdfDoc({ format: [100, 100] });
  doc.addImage(png, 'PNG', 10, 20, 30, 40);
  doc.addImage(png, 'PNG', 50, 20, 30, 40);
  const { content, pdf, lib } = await readBack(doc);

  // A PDF image draws into the unit square y-up, so the placement matrix flips it
  // back and puts the image's top edge at the caller's y.
  assert.match(content, /30 0 0 -40 10 60 cm\n\/I1 Do/);
  assert.match(content, /30 0 0 -40 50 60 cm\n\/I1 Do/);
  const xobjects = pdf.getPage(0).node.Resources().lookup(lib.PDFName.of('XObject'), lib.PDFDict);
  assert.deepEqual(xobjects.keys().map(String), ['/I1'], 'the same source embeds once');
});

test('no text means no font object at all - what the PDF/X font check wants to see', async () => {
  const doc = await createPdfDoc({ format: [100, 100] });
  doc.setFont('helvetica', 'bold');          // selected but never drawn with
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, 10, 10, 'F');
  const { raw, pdf, lib } = await readBack(doc);
  assert.equal(pdf.getPage(0).node.Resources().get(lib.PDFName.of('Font')), undefined);
  assert.ok(!raw.includes('/Helvetica'), 'a face nothing set a glyph in is never written');
});

test('a base-14 run writes BT/Tf/Tm/Tj with the text flip, and declares its font', async () => {
  const doc = await createPdfDoc({ format: [200, 100] });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(255, 0, 0);
  doc.text('Hi', 20, 50);
  const { content, pdf, lib } = await readBack(doc);

  // The colour is the same two-decimal form the path operators use, and a base-14
  // run is encoded as WinAnsi bytes in a hex string.
  assert.match(content, /BT\n\/F\d+ 12 Tf\n1\. 0\. 0\. rg\n1 0 0 -1 20 50 Tm\n<4869> Tj\nET/);
  const fonts = pdf.getPage(0).node.Resources().lookup(lib.PDFName.of('Font'), lib.PDFDict);
  assert.equal(fonts.keys().length, 1, 'one face, declared once');
});

test('align centre and right shift by the measured width, not by a guess', async () => {
  const doc = await createPdfDoc({ format: [200, 100] });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const w = doc.getTextWidth('Hello');
  assert.ok(w > 20 && w < 30, `a measured Helvetica width, got ${w}`);
  doc.text('Hello', 100, 50, { align: 'center' });
  doc.text('Hello', 100, 70, { align: 'right' });
  const { content } = await readBack(doc);
  assert.ok(content.includes(`1 0 0 -1 ${trim(100 - w / 2)} 50 Tm`), content);
  assert.ok(content.includes(`1 0 0 -1 ${trim(100 - w)} 70 Tm`), content);
});

const trim = (v: number): string => v.toFixed(4).replace(/\.?0+$/, '');

test('an embedded TrueType run writes a Type0 font over a subset of the face', { skip: NO_FONT }, async () => {
  const bytes = readFileSync(OUTFIT_TTF);
  const doc = await createPdfDoc({ format: [200, 100] });
  doc.addFileToVFS('Outfit.ttf', bytes.toString('base64'));
  doc.addFont('Outfit.ttf', 'Outfit', 'w400');
  doc.setFont('Outfit', 'w400');
  doc.setFontSize(18);
  doc.text('Hi', 10, 50);
  const { content, raw, pdf, lib } = await readBack(doc);

  // Identity-H addresses glyphs directly, so the run is a hex string of glyph ids.
  assert.match(content, /\/F\d+ 18 Tf/);
  assert.match(content, /<[0-9a-f]{8}> Tj/, 'two glyphs, two 16-bit ids');
  assert.ok(raw.includes('/Identity-H') && raw.includes('/CIDFontType2') && raw.includes('/FontFile2'));

  const declared = pdf.getPage(0).node.Resources().lookup(lib.PDFName.of('Font'), lib.PDFDict);
  const font = pdf.context.lookup(declared.get(declared.keys()[0]));
  const cid = pdf.context.lookup(font.lookup(lib.PDFName.of('DescendantFonts')).get(0));
  assert.equal(String(cid.get(lib.PDFName.of('CIDToGIDMap'))), '/Identity');
  assert.ok(cid.get(lib.PDFName.of('W')), 'the drawn glyphs carry their widths');
});

test('subsetSfnt keeps glyph ids, drops the rest, and stays a readable sfnt', { skip: NO_FONT }, async () => {
  const face = parseSfnt(new Uint8Array(readFileSync(OUTFIT_TTF)))!;
  assert.ok(face, 'the platform face parses');
  const gid = face.gidFor('A'.codePointAt(0)!);
  assert.ok(gid > 0, 'the face has a glyph for A');

  const subset = subsetSfnt(face, new Set([gid]));
  assert.ok(subset.length < face.bytes.length / 2, 'a two-glyph subset is far smaller than the face');
  const reread = parseSfnt(subset)!;
  assert.ok(reread, 'the subset is still a parseable TrueType file');
  assert.equal(reread.numGlyphs, face.numGlyphs, 'glyph ids are NOT renumbered');
  assert.equal(reread.advance(gid), face.advance(gid), 'and the advance of a kept glyph survives');
});

test('parseSfnt refuses what it cannot embed rather than writing a broken font', () => {
  assert.equal(parseSfnt(new Uint8Array([1, 2, 3])), null, 'too short');
  const otto = new Uint8Array(64);
  otto.set([0x4f, 0x54, 0x54, 0x4f]);                     // 'OTTO' - CFF outlines
  assert.equal(parseSfnt(otto), null, 'a CFF/OpenType face is declined, not mangled');
});

test('md5 and rc4 match the published vectors', () => {
  const hex = (b: Uint8Array): string => [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  const enc = (s: string): Uint8Array => new TextEncoder().encode(s);
  assert.equal(hex(md5(enc(''))), 'd41d8cd98f00b204e9800998ecf8427e');
  assert.equal(hex(md5(enc('abc'))), '900150983cd24fb0d6963f7d28e17f72');
  assert.equal(hex(md5(enc('message digest'))), 'f96b697d7cb7938d525a2f31aaf161d0');
  assert.equal(hex(rc4(enc('Key'), enc('Plaintext'))), 'bbf316e8d940af0ad3');
  assert.equal(hex(rc4(enc('Secret'), enc('Attack at dawn'))), '45a01f645fc35b383552544b9bf5');
});

test('the standard tier writes an R2 /Encrypt dict and leaves nothing in the clear', async () => {
  const doc = await createPdfDoc({
    format: [100, 100],
    encryption: { userPassword: 'hunter2', ownerPassword: 'hunter2', userPermissions: ['print'] },
  });
  doc.setProperties({ creator: 'Lolly', title: 'A secret title' });
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, 10, 10, 'F');
  const raw = new TextDecoder('latin1').decode(new Uint8Array(await doc.output('arraybuffer') as ArrayBuffer));

  assert.match(raw, /\/Filter \/Standard/);
  assert.match(raw, /\/V 1\b/);
  assert.match(raw, /\/R 2\b/);
  assert.match(raw, /\/P -60\b/, 'printing allowed, everything else withheld');
  assert.ok(!raw.includes('A secret title'), 'the Info strings are encrypted too');
  assert.match(raw, /\/ID \[ ?<[0-9A-F]{32}>/, 'the file id the key is derived from is in the trailer');
});

test('the permission bits and the user entry follow the specification', () => {
  const id = new Uint8Array(16).fill(7);
  const sec = buildRc4Security('pw', 'pw', ['print'], id);
  assert.equal(sec.P, -60, 'print only');
  assert.equal(buildRc4Security('pw', 'pw', [], id).P, -64, 'no permissions at all');
  assert.equal(sec.O.length, 32);
  assert.equal(sec.U.length, 32);
  assert.equal(sec.fileKey.length, 5, '40-bit key');
  // Same inputs, same answer: the handler is a pure function of password + id.
  assert.deepEqual([...buildRc4Security('pw', 'pw', ['print'], id).U], [...sec.U]);
  assert.notDeepEqual([...buildRc4Security('other', 'other', ['print'], id).U], [...sec.U]);
});

test('a second page carries its own size, state and resources', async () => {
  const doc = await createPdfDoc({ format: [100, 100] });
  doc.setFillColor(10, 20, 30);
  doc.rect(0, 0, 10, 10, 'F');
  doc.addPage([200, 400], 'portrait');
  doc.setFont('helvetica', 'normal');
  doc.text('two', 5, 5);
  const bytes = new Uint8Array(await doc.output('arraybuffer') as ArrayBuffer);
  const lib = await import('pdf-lib') as any;
  const pdf = await lib.PDFDocument.load(bytes, { updateMetadata: false });

  assert.equal(pdf.getPageCount(), 2);
  assert.deepEqual(Object.values(pdf.getPage(1).getSize()), [200, 400]);
  assert.equal(pdf.getPage(0).node.Resources().get(lib.PDFName.of('Font')), undefined,
    'page one drew no text, so it declares no font');
  assert.ok(pdf.getPage(1).node.Resources().get(lib.PDFName.of('Font')));
  const second = pdf.context.lookup(pdf.getPage(1).node.get(lib.PDFName.of('Contents')));
  const content = new TextDecoder('latin1').decode(inflateSync(Buffer.from(second.contents)));
  assert.equal(content.split('\n')[0], '1 0 0 -1 0 400 cm', 'the second page gets its own change of basis');
});

test('a gradient keeps every stop exactly: one function per stop pair, stitched at the offsets', async () => {
  const doc = await createPdfDoc({ format: [100, 100] });
  // A hard edge at 0.5 (two stops at one offset) and an uneven stop at 0.2.
  doc.addShadingPattern('g', new doc.ShadingPattern('axial', [0, 0, 100, 0], [
    { offset: 0, color: [255, 0, 0] }, { offset: 0.2, color: [0, 255, 0] },
    { offset: 0.5, color: [0, 255, 0] }, { offset: 0.5, color: [0, 0, 255] }, { offset: 1, color: [0, 0, 0] },
  ]));
  doc.rect(0, 0, 100, 100, null);
  doc.fill({ key: 'g' });
  const { pdf, lib } = await readBack(doc);
  const res = pdf.getPage(0).node.Resources();
  const shading = pdf.context.lookup(res.lookup(lib.PDFName.of('Shading'), lib.PDFDict).get(lib.PDFName.of('Sh1')));
  const fn = pdf.context.lookup(shading.get(lib.PDFName.of('Function')));
  assert.equal(String(fn.get(lib.PDFName.of('FunctionType'))), '3', 'a stitching function, not a sampled table');
  assert.equal(String(fn.get(lib.PDFName.of('Bounds'))), '[ 0.2 0.5 ]', 'the segment boundaries are the authored offsets; the zero-length hard-edge segment is dropped');
  const parts = fn.get(lib.PDFName.of('Functions'));
  assert.equal(parts.size(), 3, 'three real segments: 0-0.2, 0.2-0.5, 0.5-1');
  const last = pdf.context.lookup(parts.get(2));
  assert.equal(String(last.get(lib.PDFName.of('C0'))), '[ 0 0 1 ]', 'the segment after the hard edge starts at the second stop colour');
});

test('a gradient with no stops paints the plain fill instead of naming a missing shading', async () => {
  const doc = await createPdfDoc({ format: [100, 100] });
  doc.addShadingPattern('empty', new doc.ShadingPattern('axial', [0, 0, 100, 0], []));
  doc.rect(0, 0, 100, 100, null);
  doc.fill({ key: 'empty' });
  const { content, pdf, lib } = await readBack(doc);
  assert.match(content, /0 0 100 100 re\nf\n?/, 'a plain fill');
  assert.doesNotMatch(content, /sh/, 'no shading operator');
  const res = pdf.getPage(0).node.Resources();
  assert.ok(!res.get(lib.PDFName.of('Shading')), 'no shading resource is declared for a pattern that never painted');
});
