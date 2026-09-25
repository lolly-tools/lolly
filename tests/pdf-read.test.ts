// SPDX-License-Identifier: MPL-2.0
/**
 * The DOM-free PDF page walk in `packages/node-shell/src/pdf-read.ts` (plan 274
 * work package 2), over the two committed PDF fixtures:
 * `tests/fixtures/rebrand-pdf/editable.pdf` (born-digital: text, a mark, a
 * picture, a marked header and footer) and `tests/fixtures/rebrand/flattened.pdf`
 * (one picture per page).
 *
 * The web view `shells/web/src/views/pdf-import.ts` runs this same walk with its
 * own decoders plugged in, so these checks are about what the walk reports; the
 * view's own behaviour is pinned by its importers' tests.
 *
 * Run with: node --test "tests/pdf-read.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  loadPdfDocument,
  interpretPdfDocPage,
  makePdfWalk,
  decodePdfImage,
  describePdfImageIssue,
  readPdfStructOrder,
  pdfVectorsOnPage,
  pdfTextLines,
  pdfPageScanned,
  markPdfArtifactSpans,
  markPdfInvisibleText,
  countPdfInlineImages,
  pdfFlateSamples,
  pdfStreamBytes,
  pdfLatin1,
  pdfContentString,
  pdfLineRunTexts,
  pdfShadingOf,
  PDF_READ_FUNCTION_BUDGET,
  NODE_PDF_IMAGE_CODEC,
  PdfPageTooLargeError,
  type PdfImageIssue,
} from '../packages/node-shell/src/pdf-read.ts';
import { cullPdfNodes, pdfNodesToSvg } from '../engine/src/pdf-svg.ts';
import { interpretPdfPage } from '../engine/src/pdf-map.ts';
import { extractPageText } from '../engine/src/pdf-text.ts';
import { zlibSync } from 'fflate';
import { PDFDict, PDFDocument, PDFName, type PDFContext, type PDFObject } from 'pdf-lib';
import { buildProbePdf, type ProbeDict } from '../scripts/build-rebrand-pdf-fixtures.ts';
import { buildShading } from '../shells/web/src/lib/pdf-objects.ts';

const fixture = (rel: string): Uint8Array => new Uint8Array(readFileSync(fileURLToPath(new URL(rel, import.meta.url))));
const EDITABLE = (): Uint8Array => fixture('./fixtures/rebrand-pdf/editable.pdf');
const FLATTENED = (): Uint8Array => fixture('./fixtures/rebrand/flattened.pdf');

test('a page of editable.pdf interprets into text, paths, a picture and boxes in paint order', async () => {
  const doc = await loadPdfDocument(EDITABLE());
  assert.equal(doc.getPageCount(), 3);
  const page = interpretPdfDocPage(doc, 0);
  assert.equal(page.width, 720);
  assert.equal(page.height, 405);
  const kinds = page.nodes.map((n) => (n.kind === 'image' && n._vectorPath ? 'path' : n.kind));
  // ground, header text, header rule, title, body (1 + 3 runs), note, the mark (the
  // interpreter reads its curved circle as an ellipse box, then the triangle path),
  // picture, bar, footer, page number
  assert.deepEqual(kinds, ['box', 'text', 'path', 'text', 'text', 'text', 'text', 'text', 'text', 'box', 'path', 'image', 'box', 'text', 'text']);
  assert.equal(page.nodes[9]!.shape, 'ellipse');
  assert.equal(page.imageStreams.size, 1, 'the one image XObject the page names is registered');
  assert.equal(page.artifacts, undefined, 'artifacts are only reported when asked for');
});

test('marked Header and Footer spans label every node painted inside them, text and paths alike', async () => {
  const doc = await loadPdfDocument(EDITABLE());
  for (let i = 0; i < 3; i++) {
    const page = interpretPdfDocPage(doc, i, { artifacts: true });
    assert.equal(page.artifacts?.length, page.nodes.length);
    const labelled = page.nodes.map((n, k) => [n.kind === 'text' ? n.text : n._vectorPath ? 'path' : n.kind, page.artifacts?.[k]]);
    assert.deepEqual(labelled.filter(([, kind]) => kind), [
      ['ACME QUARTERLY REVIEW', 'Header'],
      ['path', 'Header'],
      ['Confidential - ACME Corp', 'Footer'],
    ], `page ${i + 1}`);
    for (const n of page.nodes) {
      assert.ok(!String(n._imageXObject ?? '').startsWith('lolly-artifact-marker:'), 'no marker node survives');
      assert.equal(n.mcid, undefined, 'no synthetic marked-content id survives on an untagged page');
    }
  }
});

test('asking for artifacts does not move a painted node', async () => {
  const doc = await loadPdfDocument(EDITABLE());
  const plain = interpretPdfDocPage(doc, 1).nodes;
  const marked = interpretPdfDocPage(doc, 1, { artifacts: true }).nodes;
  const shape = (n: (typeof plain)[number]): unknown => [n.kind, n.x, n.y, n.w, n.h, n.text ?? '', n._vectorPath ?? '', n.fill ?? n.fg ?? ''];
  assert.deepEqual(marked.map(shape), plain.map(shape));
});

test('markPdfArtifactSpans reads spans opened inside BT, nested spans, strings and inline images', () => {
  const src = [
    'BT 10 10 Td /Artifact <</Type /Pagination /Subtype /Footer /ActualText (a >> b)>> BDC (p. 1) Tj EMC ET',
    '/Artifact <</Subtype /Watermark>> BDC 0 0 5 5 re f EMC',
    '/Artifact BMC 0 0 5 5 re f EMC',
    'BI /W 1 /H 1 ID \u0001EMC\u0002 EI',
    '/Artifact <</Type /Pagination /Subtype /Header>> BDC /Span <</MCID 3>> BDC 1 1 2 2 re f EMC EMC',
  ].join('\n');
  const marked = markPdfArtifactSpans(src);
  assert.deepEqual(marked.spans, ['Footer', 'Header'], 'only Header and Footer subtypes are marked, a watermark and a bare BMC are not');
  assert.equal(Object.keys(marked.markers).length, 4, 'a start and an end marker per span');
  const nodes = interpretPdfPage({ content: marked.content, width: 100, height: 100, fonts: {}, xobjects: marked.markers, extgstates: {}, ocgs: {} });
  assert.ok(nodes.some((n) => n.kind === 'text' && n.text === 'p. 1' && (n.mcid ?? 0) >= 1_900_000_000),
    'text shown inside a span opened within BT latches the synthetic id');
  const unmarked = markPdfArtifactSpans('0 0 1 1 re f');
  assert.equal(unmarked.content, '0 0 1 1 re f', 'a page with no span is returned unchanged');
  assert.deepEqual(unmarked.spans, []);
});

test('pdfTextLines keeps each run with its own size, font and colour, and joins a line across a colour change', async () => {
  const doc = await loadPdfDocument(EDITABLE());
  const page = interpretPdfDocPage(doc, 0, { artifacts: true });
  const lines = pdfTextLines(page.nodes, page.artifacts);
  const texts = lines.map((l) => l.runs.map((r) => r.text).join('|'));
  assert.deepEqual(texts, [
    'ACME QUARTERLY REVIEW',
    'Revenue growth',
    'Body line one at sixteen points',
    'Second line holds|a coloured run| inside it',
    'A smaller note at eleven points',
    'Confidential - ACME Corp',
    '1',
  ]);
  const title = lines[1]!.runs[0]!;
  assert.equal(title.size, 28);
  assert.equal(title.font, 'Helvetica-Bold');
  assert.equal(title.bold, true);
  assert.equal(title.color, '#1f4e79');
  assert.deepEqual(lines[3]!.runs.map((r) => r.color), ['#000000', '#d65a28', '#000000']);
  assert.equal(lines[0]!.artifact, 'Header');
  assert.equal(lines[5]!.artifact, 'Footer');
  assert.equal(lines[6]!.artifact, undefined, 'the page number sits outside the footer span and keeps its own line');
});

test('pdfVectorsOnPage clusters the curved mark into one standalone SVG per page', async () => {
  const doc = await loadPdfDocument(EDITABLE());
  for (let i = 0; i < 3; i++) {
    const page = interpretPdfDocPage(doc, i);
    const vectors = await pdfVectorsOnPage(page, i, 0, async (cull, idPrefix) =>
      pdfNodesToSvg(cullPdfNodes(page.nodes, cull).nodes, { width: page.width, height: page.height, images: {}, idPrefix }));
    assert.equal(vectors.length, 1, `page ${i + 1}`);
    const mark = vectors[0]!;
    assert.equal(mark.page, i);
    assert.equal(mark.shapes, 2);
    assert.match(mark.reason, /curved shapes/);
    assert.deepEqual(mark.fills, ['#1f4e79', '#d65a28']);
    assert.match(mark.svg, /^<svg[^>]*viewBox="[\d. ]+"/);
  }
});

test('decodePdfImage turns a Flate RGB image into a PNG the pure codec can read back', async () => {
  const doc = await loadPdfDocument(EDITABLE());
  const page = interpretPdfDocPage(doc, 1);
  const desc = [...page.imageStreams.values()][0]!;
  const issues: PdfImageIssue[] = [];
  const decoded = await decodePdfImage(desc, NODE_PDF_IMAGE_CODEC, (issue) => issues.push(issue));
  assert.ok(decoded);
  assert.equal(decoded.mime, 'image/png');
  assert.deepEqual(issues, []);
  const back = await NODE_PDF_IMAGE_CODEC.decode?.(decoded.bytes, decoded.mime);
  assert.equal(back?.width, 120);
  assert.equal(back?.height, 68);
  assert.equal(back?.data[3], 255, 'an image with no soft mask is opaque');
});

test('an image in an encoding nobody decodes is reported, not dropped in silence', async () => {
  const doc = await loadPdfDocument(EDITABLE());
  const desc = [...interpretPdfDocPage(doc, 1).imageStreams.values()][0]!;
  const issues: PdfImageIssue[] = [];
  const decoded = await decodePdfImage({ ...desc, filter: ['JPXDecode'] }, NODE_PDF_IMAGE_CODEC, (issue) => issues.push(issue));
  assert.equal(decoded, null);
  assert.deepEqual(issues, [{ code: 'unsupported-encoding', filter: 'JPXDecode' }]);
  assert.match(describePdfImageIssue(issues[0]!), /unsupported encoding \(JPXDecode\)/);
});

test('the scanned-page decision: every page of flattened.pdf, no page of editable.pdf', async () => {
  const flat = await loadPdfDocument(FLATTENED());
  for (let i = 0; i < flat.getPageCount(); i++) {
    const page = interpretPdfDocPage(flat, i);
    assert.equal(page.nodes.length, 1);
    assert.equal(page.nodes[0]!.kind, 'image');
    assert.equal(pdfPageScanned(page.nodes, page.width, page.height), true, `flattened page ${i + 1}`);
  }
  const editable = await loadPdfDocument(EDITABLE());
  for (let i = 0; i < 3; i++) {
    const page = interpretPdfDocPage(editable, i);
    assert.equal(pdfPageScanned(page.nodes, page.width, page.height), false, `editable page ${i + 1}`);
  }
});

test('an untagged document has no structure order, so a reader stays geometric', async () => {
  const doc = await loadPdfDocument(EDITABLE());
  assert.deepEqual(readPdfStructOrder(doc, 0), []);
});

test('a page over the content budget is refused with its size, so a caller can say why', async () => {
  const doc = await loadPdfDocument(EDITABLE());
  assert.throws(() => interpretPdfDocPage(doc, 0, { maxContentChars: 10 }), (err: unknown) =>
    err instanceof PdfPageTooLargeError && err.chars > 10);
});

test('the bounded walk refuses a resource dictionary that reaches itself', async () => {
  // A form whose /Resources is the page's own dictionary, which names the form again.
  const enc = new TextEncoder();
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Resources 5 0 R /Contents 4 0 R >>',
    null,
    '<< /XObject << /Fm0 6 0 R >> >>',
    null,
  ];
  const page = '/Fm0 Do\n';
  const form = '0 0 10 10 re f /Fm0 Do\n';
  const parts: string[] = ['%PDF-1.4\n'];
  const offsets: number[] = [];
  let length = parts[0]!.length;
  const add = (s: string): void => { parts.push(s); length += enc.encode(s).length; };
  objects.forEach((body, i) => {
    const n = i + 1;
    offsets[n] = length;
    if (n === 4) add(`4 0 obj\n<< /Length ${page.length} >>\nstream\n${page}endstream\nendobj\n`);
    else if (n === 6) add(`6 0 obj\n<< /Type /XObject /Subtype /Form /BBox [0 0 100 100] /Resources 5 0 R /Length ${form.length} >>\nstream\n${form}endstream\nendobj\n`);
    else add(`${n} 0 obj\n${body}\nendobj\n`);
  });
  const xref = length;
  add(`xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  add(`trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const doc = await loadPdfDocument(enc.encode(parts.join('')));
  const images = new Map();
  const told: string[] = [];
  const walk = makePdfWalk(doc.context, images, (m) => told.push(m), {}, { bounded: true });
  const resources = walk.resources(doc.getPage(0).node.Resources(), 0);
  const form0 = resources.xobjects.Fm0;
  assert.equal(form0?.kind, 'form');
  assert.deepEqual(form0?.resources?.xobjects, {}, 'the cycle is cut where the dictionary reaches itself');
  assert.deepEqual(told, ['resources.cycle'], 'and the cut is told to the diagnostic sink, once');
  // And the whole page still interprets: the form paints its square once.
  const nodes = interpretPdfDocPage(doc, 0).nodes;
  assert.ok(nodes.length >= 1);
});

test('a picture stream inflates no further than its declared size needs', async () => {
  // 10 by 10 RGB pixels need 300 bytes; the stream inflates to 32 MiB.
  const bomb = zlibSync(new Uint8Array(32 * 1024 * 1024), { level: 9 });
  assert.ok(bomb.length < 64 * 1024);
  const doc = await loadPdfDocument(await buildProbePdf([{
    content: 'q 100 0 0 100 0 0 cm /Im0 Do Q',
    images: { Im0: { width: 10, height: 10, data: bomb } },
  }]));
  const page = interpretPdfDocPage(doc, 0);
  const desc = [...page.imageStreams.values()][0]!;
  assert.equal(pdfFlateSamples(desc, 3)?.length, 300);
  assert.equal(pdfStreamBytes(desc.stream, 1000)?.length, 1000);
  const decoded = await decodePdfImage(desc, NODE_PDF_IMAGE_CODEC);
  assert.equal(decoded?.mime, 'image/png');
});

test('a form, not only the page stream, counts against the content budget', async () => {
  const big = Array.from({ length: 20000 }, () => '0 0 1 1 re f').join('\n');
  const doc = await loadPdfDocument(await buildProbePdf([{ content: '/Fm0 Do', forms: { Fm0: big } }]));
  assert.throws(() => interpretPdfDocPage(doc, 0, { maxContentChars: 1000 }), (err: unknown) =>
    err instanceof PdfPageTooLargeError && err.atLeast && err.chars === 1001);
  assert.ok(interpretPdfDocPage(doc, 0, { maxContentChars: 1_000_000 }).nodes.length > 0);
});

test('the node ceiling is measured before the artifact markers are stripped', async () => {
  const rects = Array.from({ length: 4200 }, (_, i) => `${i % 700} ${Math.floor(i / 700) * 10} 1 1 re f`).join('\n');
  const doc = await loadPdfDocument(await buildProbePdf([
    { content: `/Artifact <</Type /Pagination /Subtype /Header>> BDC 0 0 1 1 re f EMC\n${rects}` },
    { content: '0 0 1 1 re f' },
  ]));
  const full = interpretPdfDocPage(doc, 0, { artifacts: true });
  assert.ok(full.nodes.length < 4000, 'the markers took places under the ceiling and were then stripped');
  assert.equal(full.truncated, true);
  assert.equal(interpretPdfDocPage(doc, 1, { artifacts: true }).truncated, false);
});

test('invisible render modes are tracked through q and Q, and inline images are counted', async () => {
  const marked = markPdfInvisibleText('BT 3 Tr q 0 Tr (a) Tj Q (b) Tj [(c) 10 (d)] TJ 7 Tr (e) \' 0 Tr (f) Tj ET');
  assert.equal(marked.shows, 3, 'b, the TJ array and e');
  assert.equal(markPdfInvisibleText('BT (a) Tj ET').content, 'BT (a) Tj ET', 'a stream with no invisible show is unchanged');
  assert.equal(countPdfInlineImages('q BI /W 1 /H 1 ID \u0001EI\u0002 EI Q BI /W 1 /H 1 ID x EI'), 2);

  const doc = await loadPdfDocument(await buildProbePdf([{
    content: 'BT /F1 12 Tf 40 300 Td (Seen) Tj ET BT 3 Tr /F1 12 Tf 40 200 Td (Unseen) Tj ET BI /W 1 /H 1 ID x EI',
  }]));
  const page = interpretPdfDocPage(doc, 0, { invisibleText: true, artifacts: true });
  assert.deepEqual(page.nodes.map((n, i) => [n.text, page.invisible?.[i], n.opacity]), [['Seen', false, 100], ['Unseen', true, 0]]);
  assert.equal(page.inlineImages, 1);
  assert.equal(page.nodes[1]!.mcid, undefined, 'the synthetic id does not survive');
});

test('a run\'s right edge is its measured ink, and a line reads its word spaces by the engine rule', async () => {
  const widths = Array.from({ length: 95 }, () => 500);
  widths['W'.charCodeAt(0) - 32] = 944;
  widths['M'.charCodeAt(0) - 32] = 944;
  // WWMM at 20 points ends at 40 + 4 x 0.944 x 20 = 115.52. The estimate (0.55 em a
  // character) would end it at 84 and read a word break before the run set at its ink.
  const doc = await loadPdfDocument(await buildProbePdf([{
    content: [
      'BT /F1 20 Tf 40 300 Td (WWMM) Tj ET',
      'BT /F1 20 Tf 115.52 300 Td (ing) Tj ET',
      'BT /F1 20 Tf 40 200 Td (Word ) Tj ET',
      // Just past the ink of "Word": narrower than a word gap, but the document spelled the space.
      'BT /F1 20 Tf 90 200 Td (gap) Tj ET',
      'BT /F1 20 Tf 40 100 Td (far) Tj ET',
      'BT /F1 20 Tf 80 100 Td (apart) Tj ET',
    ].join('\n'),
    widths: { first: 32, widths },
  }]));
  const page = interpretPdfDocPage(doc, 0);
  const lines = pdfTextLines(page.nodes);
  assert.equal(lines.length, 3);
  const first = lines[0]!.runs[0]!;
  assert.equal(first.measured, true);
  assert.ok(Math.abs(first.right - 115.52) < 1e-6, `WWMM ends at ${first.right}`);
  assert.deepEqual(lines.map((line) => pdfLineRunTexts(line)), [['WWMM', 'ing'], ['Word', ' gap'], ['far', ' apart']]);
  assert.equal(lines[1]!.runs[0]!.spaceAfter, true, 'the trimmed trailing space is recorded');

  // A standard font with no /Widths is estimated, and the estimate needs the wider gap.
  const plain = interpretPdfDocPage(await loadPdfDocument(EDITABLE()), 0);
  const note = pdfTextLines(plain.nodes).find((line) => line.runs[0]!.text.startsWith('A smaller note'))!;
  assert.equal(note.runs[0]!.measured, undefined);
});

test('pdfLatin1 is byte for byte, 0x80 to 0x9F included, where TextDecoder(latin1) is windows-1252', async () => {
  const all = Uint8Array.from({ length: 256 }, (_, i) => i);
  assert.deepEqual([...pdfLatin1(all)].map((c) => c.charCodeAt(0)), [...all]);
  assert.notEqual(new TextDecoder('latin1').decode(all.subarray(0x92, 0x93)).charCodeAt(0), 0x92, 'the label the old decode used is not Latin-1');
  // Past one 32 KiB chunk as well.
  const long = Uint8Array.from({ length: 70_000 }, (_, i) => 0x80 + (i % 32));
  const back = pdfLatin1(long);
  assert.equal(back.length, long.length);
  assert.ok([...back].every((c, i) => c.charCodeAt(0) === long[i]));

  // A page whose string operand holds the bytes 0x80 to 0x9F reads them back
  // unchanged, with and without a content budget.
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 200]);
  const head = new TextEncoder().encode('BT /F1 10 Tf 10 10 Td (');
  const tail = new TextEncoder().encode(') Tj ET');
  const high = Uint8Array.from({ length: 32 }, (_, i) => 0x80 + i);
  const stream = new Uint8Array(head.length + high.length + tail.length);
  stream.set(head, 0);
  stream.set(high, head.length);
  stream.set(tail, head.length + high.length);
  page.node.set(PDFName.of('Contents'), doc.context.register(doc.context.stream(stream)));
  const loaded = await loadPdfDocument(await doc.save({ useObjectStreams: false }));
  const node = loaded.getPage(0).node;
  for (const content of [pdfContentString(loaded.context, node), pdfContentString(loaded.context, node, { used: 0, limit: 1_000_000 })]) {
    const inner = content.slice(content.indexOf('(') + 1, content.lastIndexOf(')'));
    assert.deepEqual([...inner].map((c) => c.charCodeAt(0)), [...high]);
  }
});

// ─── shadings and patterns without a canvas ──────────────────────────────────

const AXIAL: ProbeDict = {
  ShadingType: 2, ColorSpace: 'DeviceRGB', Coords: [0, 0, 200, 0], Extend: [true, true],
  Function: { FunctionType: 2, Domain: [0, 1], C0: [1, 0, 0], C1: [0, 0, 1], N: 1 },
};
const RADIAL: ProbeDict = {
  ShadingType: 3, ColorSpace: 'DeviceGray', Coords: [100, 100, 0, 100, 100, 50],
  Function: {
    FunctionType: 3, Domain: [0, 1], Bounds: [0.5], Encode: [0, 1, 0, 1],
    Functions: [
      { FunctionType: 2, Domain: [0, 1], C0: [0], C1: [1], N: 1 },
      { FunctionType: 2, Domain: [0, 1], C0: [1], C1: [0.5], N: 1 },
    ],
  },
};

test('with no shell decoders an axial pattern fill and a radial sh are painted as gradients', async () => {
  const doc = await loadPdfDocument(await buildProbePdf([{
    content: '/Pattern cs /P0 scn 10 10 200 100 re f\nq 0 0 200 200 re W n /Sh0 sh Q',
    patterns: { P0: { PatternType: 2, Shading: AXIAL } },
    shadings: { Sh0: RADIAL },
  }]));
  const diag: string[] = [];
  const page = interpretPdfDocPage(doc, 0, { diag: (m) => diag.push(m) });
  assert.deepEqual(diag.filter((m) => /unsupported/.test(m)), []);
  const painted = page.nodes.filter((n) => n._gradient);
  assert.deepEqual(painted.map((n) => n._gradient!.type), [2, 3]);
  const axial = painted[0]!._gradient!;
  assert.deepEqual(axial.stops[0], { offset: 0, color: '#ff0000' });
  assert.deepEqual(axial.stops[axial.stops.length - 1], { offset: 1, color: '#0000ff' });
  assert.equal(axial.flat, '#800080', 'the back-stop is the colour at the middle of the domain');
  assert.equal(painted[0]!.fill, '#800080');
  assert.deepEqual(axial.extend, [true, true]);
  const radial = painted[1]!._gradient!;
  assert.equal(radial.flat, '#ffffff', 'the stitched function at its middle, where the second part starts');
  assert.equal(radial.stops[0]!.color, '#000000');
  assert.equal(radial.stops[radial.stops.length - 1]!.color, '#808080');

  // A shell's own decoders still decide when it passes them.
  const quiet = interpretPdfDocPage(doc, 0, {
    walk: (ctx, images, warn) => makePdfWalk(ctx, images, warn, { shading: () => null, pattern: () => null }),
  });
  assert.equal(quiet.nodes.filter((n) => n._gradient).length, 0);
});

/** Red up to 0.7 of the domain, then blue: the middle of the domain and the middle collapsed stop differ. */
const STEP: ProbeDict = {
  ShadingType: 2, ColorSpace: 'DeviceRGB', Coords: [0, 0, 200, 0],
  Function: {
    FunctionType: 3, Domain: [0, 1], Bounds: [0.7], Encode: [0, 1, 0, 1],
    Functions: [
      { FunctionType: 2, Domain: [0, 1], C0: [1, 0, 0], C1: [1, 0, 0], N: 1 },
      { FunctionType: 2, Domain: [0, 1], C0: [0, 0, 1], C1: [0, 0, 1], N: 1 },
    ],
  },
};

test('the canvas-free axial and radial ramps are the web decoder\'s ramps, back-stop colour included', async () => {
  const doc = await loadPdfDocument(await buildProbePdf([{ content: '', shadings: { A: AXIAL, R: RADIAL, S: STEP } }]));
  const ctx = doc.context;
  const shadings = ctx.lookup(ctx.lookup(doc.getPage(0).node.get(PDFName.of('Resources')), PDFDict).get(PDFName.of('Shading')), PDFDict);
  const walk = makePdfWalk(ctx, new Map(), () => {});
  for (const name of ['A', 'R', 'S']) {
    const ref = shadings.get(PDFName.of(name));
    const node = pdfShadingOf(walk, ref)!;
    const web = buildShading({ ctx, tiles: new Map(), warn: () => {}, resources: (d, depth) => walk.resources(d, depth) }, ref)!;
    assert.deepEqual([node.type, node.coords, node.stops, node.extend, node.flat], [web.type, web.coords, web.stops, web.extend, web.flat], name);
  }
  // The step case, where the two rules would part: the collapsed stops are the
  // two ends plus the edges of the step, and the middle one of those is blue.
  assert.equal(pdfShadingOf(walk, shadings.get(PDFName.of('S')))!.flat, '#0000ff');
});

test('a shading this host cannot evaluate is reported, and a constant function-based one paints its colour', async () => {
  const calculator: ProbeDict = { ShadingType: 2, ColorSpace: 'DeviceRGB', Coords: [0, 0, 1, 0], Function: { FunctionType: 4, Domain: [0, 1], Range: [0, 1, 0, 1, 0, 1] } };
  const constant: ProbeDict = {
    ShadingType: 1, ColorSpace: 'DeviceRGB', Domain: [0, 1, 0, 1],
    Function: [
      { FunctionType: 2, Domain: [0, 1], C0: [0.2], C1: [0.2], N: 1 },
      { FunctionType: 2, Domain: [0, 1], C0: [0.4], C1: [0.4], N: 1 },
      { FunctionType: 2, Domain: [0, 1], C0: [0.6], C1: [0.6], N: 1 },
    ],
  };
  const doc = await loadPdfDocument(await buildProbePdf([{
    content: '/Pattern cs /P0 scn 10 10 50 50 re f\n/Pattern cs /P1 scn 100 10 50 50 re f',
    patterns: { P0: { PatternType: 2, Shading: calculator }, P1: { PatternType: 2, Shading: constant } },
  }]));
  const diag: string[] = [];
  const page = interpretPdfDocPage(doc, 0, { diag: (m) => diag.push(m) });
  assert.ok(diag.some((m) => m.startsWith('shading.unsupported (unparsable Function)')));
  assert.ok(diag.includes('shading.type1.flat'));
  const fills = page.nodes.filter((n) => n.fill).map((n) => [n.x, n.fill]);
  assert.deepEqual(fills, [[100, '#336699']], 'the calculator fill paints nothing; the constant one paints its colour');
  assert.equal(page.nodes.find((n) => n.fill === '#336699')!._gradient, undefined, 'a constant one is a plain colour');
});

test('a function-based shading that varies keeps its shading on the painted node, so the paint is known to be approximate', async () => {
  const varying: ProbeDict = {
    ShadingType: 1, ColorSpace: 'DeviceGray', Domain: [0, 1, 0, 1],
    Function: { FunctionType: 2, Domain: [0, 1], C0: [0], C1: [1], N: 1 },
  };
  const doc = await loadPdfDocument(await buildProbePdf([{
    content: '/Pattern cs /P0 scn 10 10 50 50 re f',
    patterns: { P0: { PatternType: 2, Shading: varying } },
  }]));
  const diag: string[] = [];
  const page = interpretPdfDocPage(doc, 0, { diag: (m) => diag.push(m) });
  assert.ok(diag.includes('shading.type1.midpoint'));
  const painted = page.nodes.filter((n) => n.kind === 'box');
  assert.deepEqual(painted.map((n) => [n.fill, n._gradient?.type]), [['#808080', 1]]);
});

test('a shading in a Separation, DeviceN, Indexed or Lab colour space is reported, not read as RGB', async () => {
  const tint = { FunctionType: 2, Domain: [0, 1], C0: [0], C1: [1], N: 1 };
  const shadingIn = (space: ProbeDict['x']): ProbeDict => ({ ShadingType: 2, ColorSpace: space, Coords: [0, 0, 200, 0], Function: tint });
  const doc = await loadPdfDocument(await buildProbePdf([{
    content: 'q 0 0 100 100 re W n /S0 sh Q q 0 0 100 100 re W n /S1 sh Q q 0 0 100 100 re W n /S2 sh Q q 0 0 100 100 re W n /S3 sh Q q 0 0 100 100 re W n /S4 sh Q',
    shadings: {
      S0: shadingIn(['Separation', 'PANTONE#20300#20C', 'DeviceCMYK', { FunctionType: 2, Domain: [0, 1], C0: [0, 0, 0, 0], C1: [1, 0.44, 0, 0], N: 1 }]),
      S1: shadingIn(['DeviceN', ['Cyan'], 'DeviceCMYK', { FunctionType: 2, Domain: [0, 1], C0: [0, 0, 0, 0], C1: [1, 0, 0, 0], N: 1 }]),
      S2: shadingIn(['Indexed', 'DeviceRGB', 1, '\u0000\u0000\u0000\u00ff\u00ff\u00ff']),
      S3: shadingIn(['Lab', { WhitePoint: [0.95, 1, 1.09] }]),
      S4: { ...shadingIn(['CalRGB', { WhitePoint: [0.95, 1, 1.09] }]), Function: { FunctionType: 2, Domain: [0, 1], C0: [0, 0, 0], C1: [1, 1, 1], N: 1 } },
    },
  }]));
  const diag: string[] = [];
  const page = interpretPdfDocPage(doc, 0, { diag: (m) => diag.push(m) });
  for (const space of ['Separation', 'DeviceN', 'Indexed', 'Lab']) assert.ok(diag.includes(`shading.unsupported (colour space ${space})`), space);
  assert.deepEqual(diag.filter((m) => /^shading\.unsupported \(S\d\)$/.test(m)), ['shading.unsupported (S0)', 'shading.unsupported (S1)', 'shading.unsupported (S2)', 'shading.unsupported (S3)']);
  assert.deepEqual(page.nodes.filter((n) => n._gradient).map((n) => n.fill), ['#808080'], 'only the calibrated RGB one paints');
});

test('a stitching function that names one child many times is parsed once per child, so a small file cannot hang the read', async () => {
  const bytes = await buildProbePdf([{
    content: 'q 0 0 100 100 re W n /Sh0 sh Q',
    build: (ctx) => {
      // Eight levels of twelve references to one child: 12^8 parses without a memo.
      let child: PDFObject = ctx.register(ctx.obj({ FunctionType: 2, Domain: [0, 1], C0: [1, 0, 0], C1: [0, 0, 1], N: 1 }));
      for (let level = 0; level < 8; level++) {
        const bounds = Array.from({ length: 11 }, (_, i) => (i + 1) / 12);
        const encode = Array.from({ length: 12 }, () => [0, 1]).flat();
        child = ctx.register(ctx.obj({ FunctionType: 3, Domain: [0, 1], Bounds: bounds, Encode: encode, Functions: Array.from({ length: 12 }, () => child) }));
      }
      return { shadings: { Sh0: ctx.obj({ ShadingType: 2, ColorSpace: 'DeviceRGB', Coords: [0, 0, 100, 0], Function: child }) } };
    },
  }]);
  const doc = await loadPdfDocument(bytes);
  const started = performance.now();
  const page = interpretPdfDocPage(doc, 0);
  assert.ok(performance.now() - started < 2000, 'read in well under the time an unmemoised parse takes');
  assert.equal(page.nodes.filter((n) => n._gradient).length, 1, 'and the shading still paints');
});

test('function work past the walk\'s budget is refused and reported, not parsed', async () => {
  const many = Array.from({ length: PDF_READ_FUNCTION_BUDGET + 8 }, (_, i) => ({ FunctionType: 2, Domain: [0, 1], C0: [i % 2], C1: [1], N: 1 }));
  const doc = await loadPdfDocument(await buildProbePdf([{
    content: 'q 0 0 100 100 re W n /Sh0 sh Q',
    shadings: {
      Sh0: {
        ShadingType: 2, ColorSpace: 'DeviceGray', Coords: [0, 0, 100, 0],
        Function: {
          FunctionType: 3, Domain: [0, 1], Encode: many.flatMap(() => [0, 1]),
          Bounds: many.slice(1).map((_, i) => (i + 1) / many.length), Functions: many,
        },
      },
    },
  }]));
  const diag: string[] = [];
  const page = interpretPdfDocPage(doc, 0, { diag: (m) => diag.push(m) });
  assert.equal(diag.filter((m) => m === 'function.budget.exhausted').length, 1, 'told once');
  assert.ok(diag.includes('shading.unsupported (Sh0)'));
  assert.equal(page.nodes.length, 0);
});

test('a sampled function is read from its declared samples, within a cap, and only with one input', async () => {
  const sampled = (ctx: PDFContext, size: number[], samples: Uint8Array, range = [0, 1, 0, 1, 0, 1]): PDFObject =>
    ctx.register(ctx.flateStream(samples, { FunctionType: 0, Domain: size.length > 1 ? [0, 1, 0, 1] : [0, 1], Range: range, Size: size, BitsPerSample: 8 }));
  const doc = await loadPdfDocument(await buildProbePdf([{
    content: 'q 0 0 100 100 re W n /Ok sh Q q 0 0 100 100 re W n /Huge0 sh /Huge1 sh /Huge2 sh Q /Pattern cs /P0 scn 0 0 50 50 re f',
    build: (ctx) => {
      // A declared hundred million samples, stored as a few bytes: refused before a byte inflates.
      const huge = sampled(ctx, [100_000_000], new Uint8Array(64));
      const axial = (fn: PDFObject): PDFObject => ctx.obj({ ShadingType: 2, ColorSpace: 'DeviceRGB', Coords: [0, 0, 100, 0], Function: fn });
      // Two inputs, varying only in the second: a first row alone would read it as constant.
      const twoIn = sampled(ctx, [2, 2], Uint8Array.from([0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255]));
      return {
        shadings: {
          Ok: axial(sampled(ctx, [2], Uint8Array.from([255, 0, 0, 0, 0, 255]))),
          Huge0: axial(huge), Huge1: axial(huge), Huge2: axial(huge),
        },
        patterns: { P0: ctx.obj({ PatternType: 2, Shading: ctx.obj({ ShadingType: 1, ColorSpace: 'DeviceRGB', Domain: [0, 1, 0, 1], Function: twoIn }) }) },
      };
    },
  }]));
  const diag: string[] = [];
  const started = performance.now();
  const page = interpretPdfDocPage(doc, 0, { diag: (m) => diag.push(m) });
  assert.ok(performance.now() - started < 1000);
  const ok = page.nodes.find((n) => n._gradient)!._gradient!;
  assert.deepEqual([ok.stops[0]!.color, ok.stops[ok.stops.length - 1]!.color], ['#ff0000', '#0000ff']);
  assert.equal(diag.filter((m) => m.startsWith('function.sampled.too-large')).length, 1, 'one function, read once for three shadings');
  assert.ok(diag.includes('function.sampled.inputs (2)'));
  assert.ok(!diag.includes('shading.type1.flat'), 'a two-input function is not called constant');
  assert.ok(diag.includes('pattern.unsupported (P0)'));
  assert.equal(page.nodes.filter((n) => n._gradient).length, 1);
});

test('a line\'s runs join into the words the engine\'s text extraction reads', async () => {
  const widths = Array.from({ length: 95 }, () => 500);
  widths['W'.charCodeAt(0) - 32] = 944;
  widths['M'.charCodeAt(0) - 32] = 944;
  const content = [
    'BT /F1 20 Tf 40 300 Td (WWMM) Tj ET',
    'BT /F1 20 Tf 115.52 300 Td (ing) Tj ET',
    'BT /F1 20 Tf 40 200 Td (Word ) Tj ET',
    'BT /F1 20 Tf 90 200 Td (gap) Tj ET',
    'BT /F1 20 Tf 40 100 Td (far) Tj ET',
    'BT /F1 20 Tf 80 100 Td (apart) Tj ET',
    'BT /F1 20 Tf 2 Tc 40 50 Td (spa) Tj ET',
    'BT /F1 20 Tf 2 Tc 83 50 Td (ced) Tj ET',
  ].join('\n');
  // Measured edges (the font states its advances) and estimated ones (it does not).
  for (const widthsOf of [{ first: 32, widths }, undefined]) {
    const doc = await loadPdfDocument(await buildProbePdf([{ content, ...(widthsOf ? { widths: widthsOf } : {}) }]));
    const page = interpretPdfDocPage(doc, 0);
    const engine = extractPageText(page.nodes, { width: page.width, height: page.height }).blocks.map((b) => b.text).join(' ');
    const lines = pdfTextLines(page.nodes).map((line) => pdfLineRunTexts(line).join('')).join(' ');
    assert.equal(lines, engine, widthsOf ? 'measured' : 'estimated');
  }
});
