// SPDX-License-Identifier: MPL-2.0
/**
 * Stage 1 of the renovation journey for a PDF (plan 274 work package 2):
 * `sourceDeckFromPdf` over the born-digital fixture
 * `tests/fixtures/rebrand-pdf/editable.pdf`, whose labels sidecar states each
 * object's id, kind, origin and fidelity, and over the flattened fixture
 * `tests/fixtures/rebrand/flattened.pdf`.
 *
 * The labels use the adapter's own id form (`<page id>.<position in paint
 * order>`), so an object is found by id here, and by box where a label states
 * one. Behaviours the fixture does not hold (clips, a searchable scan, columns,
 * a tagged page, the caps on forms and the node ceiling) are probed with small
 * PDFs built in memory by `buildProbePdf`.
 *
 * Run with: node --test "tests/rebrand-source-pdf.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

import { reconstructFlattenedSlide, sourceDeckFromPdf, type SourcePdfOptsV1 } from '../packages/node-shell/src/rebrand/index.ts';
import type { SourceDeckV1, SourceObjectV1 } from '../packages/core/src/rebrand-v1.ts';
import { zlibCompress } from '../engine/src/deflate.ts';
import {
  PARTIAL_SCAN_AT,
  PARTIAL_SCAN_PAPER,
  buildProbePdf,
  buildRebrandPdfFixtures,
  partialScanProbe,
  type ProbePage,
} from '../scripts/build-rebrand-pdf-fixtures.ts';
import {
  privateCorpus,
  readFixture,
  readLabels,
  skipReason,
  type RebrandFixtureLabelsV1,
} from './helpers/rebrand-fixtures.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PDF_FIXTURE_DIR = path.join(ROOT, 'tests/fixtures/rebrand-pdf');

const editableBytes = (): Uint8Array => new Uint8Array(readFileSync(path.join(PDF_FIXTURE_DIR, 'editable.pdf')));
const editableLabels = (): RebrandFixtureLabelsV1 =>
  JSON.parse(readFileSync(path.join(PDF_FIXTURE_DIR, 'editable.labels.json'), 'utf8')) as RebrandFixtureLabelsV1;

interface Read {
  deck: SourceDeckV1;
  /** What the sink was handed, one entry per call. */
  sinkCalls: Array<{ mime: string; bytes: number; hint: string }>;
}

async function read(bytes: Uint8Array, extra: Partial<SourcePdfOptsV1> = {}): Promise<Read> {
  const sinkCalls: Read['sinkCalls'] = [];
  const deck = await sourceDeckFromPdf(bytes, {
    hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    instanceId: 'test-instance-1',
    name: 'fixture.pdf',
    bytes: bytes.byteLength,
    sink: async (media, mime, hint) => {
      assert.ok(media.byteLength > 0, 'the sink was handed empty bytes');
      sinkCalls.push({ mime, bytes: media.byteLength, hint });
      return `user/media/${hint.slice(0, 16)}`;
    },
    reader: { name: 'pdf-read', version: 'test' },
    ...extra,
  });
  return { deck, sinkCalls };
}

let editable: Promise<Read> | null = null;
const editableRead = (): Promise<Read> => (editable ??= read(editableBytes()));

function objectById(deck: SourceDeckV1, id: string): SourceObjectV1 {
  for (const slide of deck.slides) {
    const hit = slide.objects.find((o) => o.id === id);
    if (hit) return hit;
  }
  assert.fail(`no object ${id}`);
}

const textOf = (o: SourceObjectV1): string => (o.text?.paras ?? []).map((p) => p.runs.map((r) => r.text).join('')).join('\n');

function assertSchema(deck: SourceDeckV1): void {
  const schema = JSON.parse(readFileSync(path.join(ROOT, 'schemas/rebrand-source-v1.schema.json'), 'utf8')) as object;
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  if (!(validate(deck) as boolean)) {
    const errors = (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`).join('; ');
    assert.fail(`the adapted deck failed the source schema: ${errors}`);
  }
}

test('the committed PDF fixture is what the builder writes, byte for byte', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'rebrand-pdf-'));
  try {
    await buildRebrandPdfFixtures(dir);
    for (const name of ['editable.pdf', 'editable.labels.json']) {
      assert.deepEqual(readFileSync(path.join(dir, name)), readFileSync(path.join(PDF_FIXTURE_DIR, name)),
        `${name} is stale: run node scripts/build-rebrand-pdf-fixtures.ts`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('editable.pdf reads into a deck that validates against schemas/rebrand-source-v1.schema.json', async () => {
  const { deck } = await editableRead();
  assertSchema(deck);
  assert.equal(deck.source.kind, 'pdf');
  assert.equal(deck.source.pageCount, 3);
  assert.equal(deck.source.title, 'Editable rebrand fixture');
  assert.equal(deck.source.lineageId, 'pdf-id:4c6f6c6c7952656272616e6450646630', 'the trailer /ID is the lineage, not the byte hash');
  assert.deepEqual(deck.warnings, []);
});

test('every labelled object is read with its id, kind, origin and fidelity, and nothing unlabelled appears', async () => {
  const { deck } = await editableRead();
  const labels = editableLabels();
  assert.equal(deck.slides.length, labels.slides.length);
  for (const [i, slideLabel] of labels.slides.entries()) {
    const slide = deck.slides[i]!;
    assert.equal(slide.id, slideLabel.id);
    assert.equal(slide.width, slideLabel.widthPx);
    assert.equal(slide.height, slideLabel.heightPx);
    assert.equal(slide.origin.kind, 'pdf');
    assert.equal(slide.origin.flattened, undefined);
    assert.equal(slide.ocr, undefined, `${slide.id} is not flattened, so it states no slide OCR`);
    assert.deepEqual(slide.objects.map((o) => o.id), slideLabel.objects.map((l) => l.id), `${slide.id} object ids`);
    for (const label of slideLabel.objects) {
      const object = objectById(deck, label.id);
      assert.equal(object.kind, label.kind, `${label.id} (${label.authored}) kind`);
      assert.equal(object.origin, label.origin, `${label.id} (${label.authored}) origin`);
      assert.deepEqual(object.fidelity, label.fidelity, `${label.id} (${label.authored}) fidelity`);
      if (label.text !== undefined) assert.equal(textOf(object), label.text, `${label.id} (${label.authored}) text`);
      if (label.boxPx) {
        for (const k of ['x', 'y', 'w', 'h'] as const) {
          assert.ok(Math.abs(object.box[k] - label.boxPx[k]) <= 1, `${label.id} (${label.authored}) box.${k}: ${object.box[k]} vs ${label.boxPx[k]}`);
        }
      }
    }
    assert.deepEqual(slide.background, { color: { hex: '#ffffff' } }, 'the ground is the background, not an object');
    assert.deepEqual([...slide.readingOrder].sort(), slide.objects.map((o) => o.id).sort(), 'the reading order names every object once');
  }
});

test('text keeps its runs, sizes, fonts and colours, with literal provenance', async () => {
  const { deck } = await editableRead();
  const title = objectById(deck, 'page1.2').text!.paras[0]!.runs[0]!;
  assert.deepEqual(title, { text: 'Revenue growth', sizePt: 28, bold: true, font: 'Helvetica-Bold', fontProvenance: 'literal', color: { hex: '#1f4e79' } });
  const runs = objectById(deck, 'page1.4').text!.paras[0]!.runs;
  assert.deepEqual(runs.map((r) => [r.text, r.sizePt, r.color?.hex]), [
    ['Second line holds', 16, '#000000'],
    [' a coloured run', 16, '#d65a28'],
    [' inside it', 16, '#000000'],
  ]);
  assert.equal(objectById(deck, 'page1.5').text!.paras[0]!.runs[0]!.sizePt, 11);
  assert.deepEqual(deck.fonts, [
    { family: 'Helvetica', provenance: 'literal', runs: 24 },
    { family: 'Helvetica-Bold', provenance: 'literal', runs: 3 },
  ]);
});

test('the marked header and footer are pdf-artifact, and the footer says it is one', async () => {
  const { deck } = await editableRead();
  for (const slide of deck.slides) {
    const artifacts = slide.objects.filter((o) => o.origin === 'pdf-artifact').map((o) => [o.kind, textOf(o), o.placeholder]);
    assert.deepEqual(artifacts, [
      ['text', 'ACME QUARTERLY REVIEW', undefined],
      ['vector', '', undefined],
      ['text', 'Confidential - ACME Corp', 'ftr'],
    ], slide.id);
  }
});

test('the same picture on every page is stored once, whichever image object draws it', async () => {
  const { deck, sinkCalls } = await editableRead();
  assert.equal(sinkCalls.length, 1, 'two image objects holding the same bytes, drawn three times, reach the sink once');
  assert.equal(sinkCalls[0]!.mime, 'image/png');
  const pics = deck.slides.flatMap((s) => s.objects.filter((o) => o.kind === 'pic'));
  assert.equal(pics.length, 3);
  assert.equal(new Set(pics.map((p) => p.media)).size, 1);
  for (const pic of pics) {
    assert.equal(pic.mediaMime, 'image/png');
    assert.deepEqual(pic.raster, { width: 120, height: 68 });
  }
});

test('the repeated vector mark carries its own SVG and one fingerprint on every page', async () => {
  const { deck } = await editableRead();
  const marks = deck.slides.map((s) => objectById(deck, `${s.id}.6`));
  for (const mark of marks) {
    assert.equal(mark.kind, 'vector');
    assert.match(mark.vector ?? '', /^<svg[^>]*viewBox=/);
    assert.equal(mark.fill?.hex, '#1f4e79');
  }
  assert.equal(new Set(marks.map((m) => m.fingerprint)).size, 1, 'a census can group the mark by fingerprint');
});

test('every page of flattened.pdf is flattened: one whole-page picture, OCR not run', async () => {
  const bytes = readFixture('flattened.pdf');
  const { deck, sinkCalls } = await read(bytes);
  assertSchema(deck);
  const labels = readLabels('flattened.pdf');
  assert.equal(sinkCalls.length, 3, 'three different page pictures');
  assert.deepEqual(deck.slides.map((s) => s.id), labels.slides.map((s) => s.id));
  for (const [i, slide] of deck.slides.entries()) {
    const label = labels.slides[i]!;
    assert.equal(slide.origin.flattened, true, slide.id);
    assert.deepEqual(slide.ocr, { state: 'not-run' }, `${slide.id} says recognition has not run over it`);
    assert.equal(slide.recovery, undefined, 'the recovery picture is written when the slide is rebuilt, not when it is read');
    assert.equal(slide.width, label.widthPx);
    assert.equal(slide.height, label.heightPx);
    assert.equal(slide.objects.length, 1);
    const pic = slide.objects[0]!;
    assert.equal(pic.kind, 'pic');
    assert.deepEqual(pic.fidelity, label.objects[0]!.fidelity);
    assert.deepEqual({ x: pic.box.x, y: pic.box.y, w: pic.box.w, h: pic.box.h }, label.objects[0]!.boxPx);
    assert.deepEqual(pic.ocr, { state: 'not-run' });
    // Nothing in the file marks the picture as an artifact, so the adapter reports
    // where it was declared: on the page itself.
    assert.equal(pic.origin, 'slide');
    assert.deepEqual(slide.warnings, []);
  }
});

test('every cap reached is a warning with a count, never a silent drop', async () => {
  const bytes = editableBytes();

  const pages = await read(bytes, { caps: { maxPages: 2 } });
  assert.equal(pages.deck.slides.length, 2);
  assert.deepEqual(pages.deck.warnings.map((w) => [w.code, w.count]), [['slides-truncated', 1]]);
  assertSchema(pages.deck);

  const objects = await read(bytes, { caps: { maxObjectsPerPage: 5 } });
  for (const slide of objects.deck.slides) {
    assert.equal(slide.objects.length, 5);
    assert.deepEqual(slide.warnings.map((w) => [w.code, w.count]), [['nodes-truncated', 6]], slide.id);
  }

  const media = await read(bytes, { maxMediaBytes: 100 });
  assert.equal(media.sinkCalls.length, 0);
  for (const slide of media.deck.slides) {
    const pic = slide.objects.find((o) => o.kind === 'pic')!;
    assert.deepEqual(pic.fidelity, { state: 'unavailable', reason: 'media-too-large' });
    assert.equal(pic.media, undefined);
    assert.deepEqual(slide.warnings.map((w) => [w.code, w.objectIds]), [['media-skipped', [pic.id]]]);
  }
  assertSchema(media.deck);

  const pixels = await read(bytes, { caps: { maxImagePixels: 1000 } });
  assert.ok(pixels.deck.slides.every((s) => s.objects.some((o) => o.kind === 'pic' && o.fidelity.reason === 'media-too-large')));

  const content = await read(bytes, { caps: { maxContentChars: 100 } });
  for (const slide of content.deck.slides) {
    assert.deepEqual(slide.objects, []);
    assert.equal(slide.warnings[0]?.code, 'part-too-large');
    assert.ok((slide.warnings[0]?.count ?? 0) > 100);
  }
  assertSchema(content.deck);
});

test('the same bytes read twice give the same deck', async () => {
  const bytes = editableBytes();
  const a = await read(bytes);
  const b = await read(bytes);
  assert.deepEqual(a.deck, b.deck);
  assert.equal(JSON.stringify(a.deck), JSON.stringify((await editableRead()).deck));
});

test('progress is counted per page, and an aborted read stops with the signal reason', async () => {
  const seen: Array<[number, number]> = [];
  await read(editableBytes(), { onSlide: (done, total) => seen.push([done, total]) });
  assert.deepEqual(seen, [[0, 3], [1, 3], [2, 3], [3, 3]]);

  const controller = new AbortController();
  controller.abort(new Error('stopped by the person'));
  await assert.rejects(read(editableBytes(), { signal: controller.signal }), /stopped by the person/);
});

test('bytes that are not a PDF are refused with a sentence', async () => {
  await assert.rejects(read(new TextEncoder().encode('not a pdf at all')), /could not be read/);
});

// ─── probes ──────────────────────────────────────────────────────────────────

/** A flat grey picture, Flate-encoded the way a PDF writer stores one. */
const grey = (width: number, height: number): { width: number; height: number; data: Uint8Array } =>
  ({ width, height, data: zlibCompress(new Uint8Array(width * height * 3).fill(128)) });

async function probe(pages: ProbePage[], extra: Partial<SourcePdfOptsV1> = {}): Promise<SourceDeckV1> {
  const { deck } = await read(await buildProbePdf(pages), extra);
  assertSchema(deck);
  return deck;
}

const warningCodes = (deck: SourceDeckV1, i = 0): Array<[string, number | undefined]> =>
  deck.slides[i]!.warnings.map((w) => [w.code, w.count]);

test('a photo beside vector lettering and a panel is an editable page, not a scan', async () => {
  // Outlined lettering: twelve small paths, a filled panel, and a logo, beside a
  // photo covering 60% of the page. No live text, so the engine calls it scanned.
  const glyphs = Array.from({ length: 12 }, (_, i) => `${40 + i * 20} 200 m ${50 + i * 20} 220 l ${55 + i * 20} 200 l h f`).join('\n');
  const deck = await probe([{
    content: `0.2 0.3 0.4 rg 20 20 250 365 re f\n0 0 0 rg ${glyphs}\n30 300 m 60 340 l 90 300 l h f\nq 432 0 0 405 288 0 cm /Im0 Do Q`,
    images: { Im0: grey(4, 4) },
  }]);
  const slide = deck.slides[0]!;
  assert.equal(slide.origin.flattened, undefined);
  assert.ok(slide.objects.some((o) => o.kind === 'pic'));
  assert.ok(slide.objects.some((o) => o.kind === 'shape'));
  assert.ok(slide.objects.filter((o) => o.kind === 'vector').length >= 1);
  assert.ok(!slide.objects.some((o) => o.ocr), 'no OCR claim on an editable page');
  assert.equal(slide.ocr, undefined, 'no slide OCR claim on an editable page');

  // A real scan with one small stamp is still one picture.
  const scan = await probe([{ content: 'q 720 0 0 405 0 0 cm /Im0 Do Q\n1 0 0 rg 690 10 20 20 re f', images: { Im0: grey(4, 4) } }]);
  assert.equal(scan.slides[0]!.origin.flattened, true);
  assert.deepEqual(scan.slides[0]!.objects.map((o) => [o.kind, o.ocr?.state]), [['pic', 'not-run']]);
  assert.deepEqual(scan.slides[0]!.ocr, { state: 'not-run' });
  assert.deepEqual(warningCodes(scan), [['nodes-truncated', 1]], 'the stamp that was not carried is named');
});

test('a searchable scan is one picture whose OCR evidence is its own invisible text layer', async () => {
  const deck = await probe([{
    content: [
      'q 720 0 0 405 0 0 cm /Im0 Do Q',
      'BT 3 Tr /F1 20 Tf 40 300 Td (Revenue growth) Tj ET',
      'BT 3 Tr /F1 12 Tf 40 260 Td (up four points) Tj ET',
    ].join('\n'),
    images: { Im0: grey(4, 4) },
  }]);
  const slide = deck.slides[0]!;
  assert.equal(slide.origin.flattened, true);
  assert.equal(slide.objects.length, 1, 'the text layer is not carried a second time as live text');
  const ocr = slide.objects[0]!.ocr!;
  assert.equal(ocr.state, 'text-found');
  assert.equal(ocr.model, 'pdf-text-layer');
  assert.deepEqual(ocr.lines?.map((l) => [l.text, l.confidence]), [['Revenue growth', 1], ['up four points', 1]]);
  // The slide states the same reading, without the lines, which stay on the picture.
  assert.deepEqual(slide.ocr, { state: 'text-found', model: 'pdf-text-layer' });
  assertSchema(deck);

  // Cut into regions with no recogniser, the layer's lines move onto the regions they lie over,
  // so the slide's reading is still held by an object. The picture is a white page with ink
  // where the layer says the words are, as a scan of those words would have.
  const width = Math.round(slide.width);
  const height = Math.round(slide.height);
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (const line of ocr.lines ?? []) {
    for (let y = Math.max(0, Math.floor(line.box.y)); y < Math.min(height, Math.ceil(line.box.y + line.box.h)); y++) {
      for (let x = Math.max(0, Math.floor(line.box.x)); x < Math.min(width, Math.ceil(line.box.x + line.box.w)); x++) {
        data.fill(20, (y * width + x) * 4, (y * width + x) * 4 + 3);
      }
    }
  }
  const rebuilt = await reconstructFlattenedSlide({ slide, picture: { width, height, data }, sink: async (_bytes, _mime, hint) => `user/media/${hint.slice(0, 16)}` });
  assert.ok(!rebuilt.objects.some((o) => o.id === slide.objects[0]!.id), 'the page picture was replaced by its regions');
  const carried = rebuilt.objects.flatMap((o) => (o.ocr?.model === 'pdf-text-layer' ? (o.ocr.lines ?? []).map((l) => l.text) : []));
  assert.deepEqual(carried.sort(), ['Revenue growth', 'up four points']);
  assert.deepEqual(rebuilt.ocr, { state: 'text-found', model: 'pdf-text-layer' });
  assertSchema({ ...deck, slides: [rebuilt] });

  // Invisible text on a page that is not a scan is carried, hidden.
  const page = await probe([{ content: 'BT /F1 20 Tf 40 300 Td (Shown) Tj ET BT 3 Tr /F1 20 Tf 40 200 Td (Not shown) Tj ET' }]);
  assert.deepEqual(page.slides[0]!.objects.map((o) => [textOf(o), o.hidden]), [['Shown', undefined], ['Not shown', true]]);
});

test('a clip that crops a picture is recorded, and a cut that is not a rectangle is approximate and named', async () => {
  const deck = await probe([{
    content: [
      // Office crops: the whole picture drawn, a rectangle clip shows 50 by 50 points of it.
      'q 100 100 50 50 re W n 400 0 0 300 0 0 cm /Im0 Do Q',
      // A rectangle cut by a triangle.
      'q 400 50 m 500 50 l 450 150 l h W n 1 0 0 rg 300 0 300 200 re f Q',
      // A rectangle cut by a rectangle is the rectangle that shows.
      'q 600 300 50 50 re W n 0 0 1 rg 580 280 120 120 re f Q',
      // A picture clipped away entirely paints nothing.
      'q 0 0 1 1 re W n 400 0 0 300 300 0 cm /Im0 Do Q',
      // A page-sized clip cuts nothing.
      'q 0 0 720 405 re W n 0 1 0 rg 10 380 20 20 re f Q',
    ].join('\n'),
    images: { Im0: grey(4, 4) },
  }]);
  const [pic, cutByTriangle, cutByRect, uncut] = deck.slides[0]!.objects;
  assert.equal(deck.slides[0]!.objects.length, 4, 'the picture clipped away is not an object');
  assert.equal(pic!.kind, 'pic');
  assert.deepEqual([pic!.box.x, pic!.box.y, pic!.box.w, pic!.box.h], [0, 140, 533.33, 400], 'the picture keeps the box it is drawn in');
  assert.deepEqual(pic!.clip, { x: 133.33, y: 340, w: 66.67, h: 66.67, rot: 0 }, 'and states the part that shows');
  assert.deepEqual(pic!.fidelity, { state: 'raster-preserved' });

  assert.deepEqual(cutByTriangle!.fidelity, { state: 'approximate', reason: 'reader-approximation' });
  const named = deck.slides[0]!.warnings.find((w) => w.objectIds?.includes(cutByTriangle!.id));
  assert.match(named?.message ?? '', /not a plain rectangle/);

  assert.deepEqual([cutByRect!.box.x, cutByRect!.box.y, cutByRect!.box.w, cutByRect!.box.h], [800, 73.33, 66.67, 66.67]);
  assert.deepEqual(cutByRect!.fidelity, { state: 'editable' });
  assert.equal(cutByRect!.clip, undefined);
  assert.equal(uncut!.clip, undefined);
  assert.deepEqual(uncut!.fidelity, { state: 'editable' });

  // A turned picture whose writer clips it to its own frame, and one turned a
  // half turn under a rectangle clip, are not approximations.
  const turned = await probe([{
    content: [
      'q 0.9659 -0.2588 0.2588 0.9659 100 100 cm 0 0 120 80 re W n 120 0 0 80 0 0 cm /Im0 Do Q',
      'q 400 100 200 100 re W n -300 0 0 -200 700 300 cm /Im0 Do Q',
    ].join('\n'),
    images: { Im0: grey(4, 4) },
  }]);
  assert.deepEqual(turned.slides[0]!.objects.map((o) => [o.kind, o.fidelity.state, o.box.rot !== 0, !!o.clip]), [
    ['pic', 'raster-preserved', true, false],
    ['pic', 'raster-preserved', true, true],
  ]);
  assert.deepEqual(turned.slides[0]!.warnings, []);
});

test('a fill the reader cannot paint says it was not painted, never that it paints a flat colour', async () => {
  const deck = await probe([{ content: '/Pattern cs /P0 scn 10 10 300 200 re f\n/Sh0 sh' }]);
  const slide = deck.slides[0]!;
  assert.deepEqual(slide.objects, []);
  assert.deepEqual(warningCodes(deck), [['media-skipped', 2]]);
  assert.match(slide.warnings[0]!.message, /not painted/);
  assert.doesNotMatch(slide.warnings[0]!.message, /flat colour/);
});

test('without the web decoders an axial gradient is painted: a shape of its middle colour that says so, not a skipped fill', async () => {
  const deck = await probe([{
    content: '/Pattern cs /P0 scn 10 10 300 200 re f',
    patterns: {
      P0: {
        PatternType: 2,
        Shading: {
          ShadingType: 2, ColorSpace: 'DeviceRGB', Coords: [10, 0, 310, 0],
          Function: { FunctionType: 2, Domain: [0, 1], C0: [0, 0.5, 0.25], C1: [0, 0.25, 0.75], N: 1 },
        },
      },
    },
  }]);
  const slide = deck.slides[0]!;
  assert.deepEqual(slide.objects.map((o) => [o.kind, o.fill?.hex, o.fidelity.state]), [['shape', '#006080', 'approximate']]);
  assert.deepEqual(warningCodes(deck), [['gradient-flattened', undefined]]);
  assert.ok(!slide.warnings.some((w) => w.code === 'media-skipped'));
});

test('fills are counted by paint, not by resource: a listed and unused one warns of nothing, and one paint is one', async () => {
  const calculator = { ShadingType: 2, ColorSpace: 'DeviceRGB', Coords: [0, 0, 1, 0], Function: { FunctionType: 4, Domain: [0, 1], Range: [0, 1, 0, 1, 0, 1] } };
  const varying = { ShadingType: 1, ColorSpace: 'DeviceGray', Domain: [0, 1, 0, 1], Function: { FunctionType: 2, Domain: [0, 1], C0: [0], C1: [1], N: 1 } };
  const resources = { patterns: { P0: { PatternType: 2, Shading: calculator }, P1: { PatternType: 2, Shading: varying } }, shadings: { Sh0: calculator, Sh1: varying } };

  // Listed, never painted: a plain blue rectangle and nothing missing.
  const unused = await probe([{ content: '0 0 1 rg 10 10 300 200 re f', ...resources }]);
  assert.deepEqual(unused.slides[0]!.objects.map((o) => [o.kind, o.fill?.hex, o.fidelity.state]), [['shape', '#0000ff', 'editable']]);
  assert.deepEqual(warningCodes(unused), []);

  // One unpaintable pattern fill and one unpaintable sh: two fills missing, not four.
  const missing = await probe([{ content: '/Pattern cs /P0 scn 10 10 300 200 re f\nq 0 0 100 100 re W n /Sh0 sh Q', ...resources }]);
  assert.deepEqual(warningCodes(missing), [['media-skipped', 2]]);
});

test('a function-based shading that varies is one approximate object with its own warning, as a pattern fill and under sh', async () => {
  const varying = { ShadingType: 1, ColorSpace: 'DeviceGray', Domain: [0, 1, 0, 1], Function: { FunctionType: 2, Domain: [0, 1], C0: [0], C1: [1], N: 1 } };
  for (const content of ['/Pattern cs /P0 scn 10 10 300 200 re f', 'q 10 10 300 200 re W n /Sh0 sh Q']) {
    const deck = await probe([{ content, patterns: { P0: { PatternType: 2, Shading: varying } }, shadings: { Sh0: varying } }]);
    const slide = deck.slides[0]!;
    assert.deepEqual(slide.objects.map((o) => [o.kind, o.fill?.hex, o.fidelity.state]), [['shape', '#808080', 'approximate']], content);
    assert.deepEqual(slide.warnings.map((w) => [w.code, w.objectIds]), [['gradient-flattened', [slide.objects[0]!.id]]], content);
  }
});

test('a scan placed on a page at 70 percent is flattened, and the rebuild cuts it inside its own box', async () => {
  const { page, pixels } = partialScanProbe();
  const deck = await probe([page]);
  const slide = deck.slides[0]!;
  assert.equal(slide.origin.flattened, true);
  assert.deepEqual(slide.background.color, { hex: '#ffffff' });
  const pic = slide.objects[0]!;
  assert.deepEqual(slide.objects.map((o) => o.kind), ['pic']);
  const px = (pt: number): number => Math.round(pt * (96 / 72) * 100) / 100;
  const at = PARTIAL_SCAN_AT;
  assert.deepEqual(pic.box, { x: px(at.x), y: px(405 - at.y - at.h), w: px(at.w), h: px(at.h), rot: 0 });
  const share = (pic.box.w * pic.box.h) / (slide.width * slide.height);
  assert.ok(share > 0.65 && share < 0.75, `the picture covers ${share} of the page`);

  const data = new Uint8ClampedArray(pixels.width * pixels.height * 4);
  for (let i = 0; i < pixels.width * pixels.height; i++) {
    data.set(pixels.rgb.subarray(i * 3, i * 3 + 3), i * 4);
    data[i * 4 + 3] = 255;
  }
  const rebuilt = await reconstructFlattenedSlide({
    slide, picture: { width: pixels.width, height: pixels.height, data }, sink: async (_bytes, _mime, hint) => `user/media/${hint.slice(0, 16)}`,
  });
  assert.ok(!rebuilt.objects.some((o) => o.id === pic.id), 'the picture was replaced by its regions');
  assert.equal(rebuilt.recovery?.fromObjectId, pic.id);
  assert.ok(rebuilt.objects.length > 2, 'regions were cut');
  for (const o of rebuilt.objects) {
    assert.equal(o.origin, 'raster-region');
    assert.ok(o.box.x >= pic.box.x - 0.01 && o.box.y >= pic.box.y - 0.01
      && o.box.x + o.box.w <= pic.box.x + pic.box.w + 0.01 && o.box.y + o.box.h <= pic.box.y + pic.box.h + 0.01,
    `${o.id} lies inside the picture's box`);
  }
  // The paper is the picture's ground, a rectangle under the regions; the page stays white.
  const ground = rebuilt.objects[0]!;
  assert.deepEqual([ground.id, ground.kind, ground.fill?.hex, ground.box], [`${pic.id}.ground`, 'shape', PARTIAL_SCAN_PAPER, pic.box]);
  assert.deepEqual(rebuilt.background.color, { hex: '#ffffff' });
  assertSchema({ ...deck, slides: [rebuilt] });
});

test('the node ceiling is reported on a page with an artifact span too', async () => {
  const rects = Array.from({ length: 4200 }, (_, i) => `${i % 700} ${Math.floor(i / 700) * 10} 1 1 re f`).join('\n');
  for (const prefix of ['', '/Artifact <</Type /Pagination /Subtype /Header>> BDC 0 0 1 1 re f EMC\n']) {
    const deck = await probe([{ content: `${prefix}0 0 1 rg ${rects}` }]);
    const ceiling = deck.slides[0]!.warnings.filter((w) => w.code === 'nodes-truncated' && /interpreter stops there/.test(w.message));
    assert.equal(ceiling.length, 1, prefix ? 'with a Header span' : 'without one');
  }
});

test('a form counts against the content budget, and a page that fails to read is not called truncated', async () => {
  const big = Array.from({ length: 20000 }, () => '0 0 1 1 re f').join('\n');
  const deck = await probe([{ content: '/Fm0 Do', forms: { Fm0: big } }], { caps: { maxContentChars: 1000 } });
  assert.deepEqual(deck.slides[0]!.objects, []);
  assert.equal(deck.slides[0]!.warnings[0]?.code, 'part-too-large');
  assert.match(deck.slides[0]!.warnings[0]!.message, /more than 1000 characters/);
});

test('a page turn, a crop box and inline pictures are named, not dropped in silence', async () => {
  const deck = await probe([{
    content: '1 0 0 rg 10 10 20 20 re f\nq 100 0 0 100 0 0 cm BI /W 1 /H 1 /CS /RGB /BPC 8 ID \u00ff\u0000\u0000 EI Q',
    rotate: 90,
    cropBox: [0, 0, 300, 300],
  }]);
  const messages = deck.slides[0]!.warnings.map((w) => [w.code, w.message]);
  assert.equal(messages.length, 3);
  assert.match(messages[0]![1]!, /turned 90 degrees/);
  assert.match(messages[1]![1]!, /crop box of 300 by 300 points/);
  assert.deepEqual(warningCodes(deck)[2], ['media-skipped', 1]);
});

test('a vector object\'s box is its SVG frame, so fitting one into the other moves nothing', async () => {
  const { deck } = await editableRead();
  const deckSmall = await probe([{ content: '1 0 0 rg 100 100 m 120 100 l 110 120 l h f' }]);
  const vectors = [...deck.slides, ...deckSmall.slides].flatMap((s) => s.objects.filter((o) => o.kind === 'vector'));
  assert.ok(vectors.length >= 7);
  for (const v of vectors) {
    const m = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(v.vector ?? '');
    assert.ok(m, `${v.id} has a windowed SVG`);
    const [x, y, w, h] = m.slice(1, 5).map(Number) as [number, number, number, number];
    const pt = (n: number): number => Math.round((n * 72) / 96 * 100) / 100;
    assert.ok(Math.abs(pt(v.box.x) - x) <= 0.02 && Math.abs(pt(v.box.y) - y) <= 0.02, `${v.id} origin: box ${v.box.x},${v.box.y} vs viewBox ${x},${y}`);
    assert.ok(Math.abs(pt(v.box.w) - w) <= 0.02 && Math.abs(pt(v.box.h) - h) <= 0.02, `${v.id} size: box ${v.box.w}x${v.box.h} vs viewBox ${w}x${h}`);
  }
});

test('a word space is judged from the font\'s own advances, so wide glyphs do not split a word', async () => {
  const widths = Array.from({ length: 224 }, () => 500);
  widths['W'.charCodeAt(0) - 32] = 944;
  widths['M'.charCodeAt(0) - 32] = 944;
  const deck = await probe([{
    content: 'BT /F1 20 Tf 40 300 Td (WWMM) Tj 0 0 1 rg (ing) Tj 0 0 0 rg (Word ) Tj 0 0 1 rg (gap) Tj ET',
    widths: { first: 32, widths },
  }]);
  const runs = deck.slides[0]!.objects[0]!.text!.paras[0]!.runs.map((r) => r.text);
  assert.deepEqual(runs, ['WWMM', 'ing', 'Word', ' gap'], 'a colour change mid-word adds no space; a trimmed trailing space is kept');
});

test('two columns read column by column, and a tagged page reads in its structure order', async () => {
  const col = (x: number, label: string): string[] => Array.from({ length: 5 }, (_, i) =>
    `BT /F1 10 Tf ${x} ${340 - i * 14} Td (${label} line ${i + 1} of the column text here) Tj ET`);
  const left = col(36, 'Left');
  const right = col(380, 'Right');
  const lines = left.flatMap((l, i) => [l, right[i]!]);
  const deck = await probe([{ content: lines.join('\n') }]);
  const slide = deck.slides[0]!;
  const byId = new Map(slide.objects.map((o) => [o.id, textOf(o)]));
  const order = slide.readingOrder.map((id) => byId.get(id)!.split(' ')[0]);
  assert.deepEqual(order, ['Left', 'Left', 'Left', 'Left', 'Left', 'Right', 'Right', 'Right', 'Right', 'Right']);

  // A tagged page whose tree states the second line first.
  const tagged = await probe([{
    content: [
      '/P <</MCID 0>> BDC BT /F1 14 Tf 36 300 Td (Drawn first, read second) Tj ET EMC',
      '/P <</MCID 1>> BDC BT /F1 14 Tf 36 250 Td (Drawn second, read first) Tj ET EMC',
    ].join('\n'),
    tagged: [{ type: 'P', mcids: [1] }, { type: 'P', mcids: [0] }],
  }]);
  const t = tagged.slides[0]!;
  const tById = new Map(t.objects.map((o) => [o.id, textOf(o)]));
  assert.deepEqual(t.readingOrder.map((id) => tById.get(id)), ['Drawn second, read first', 'Drawn first, read second']);
});

test('a vector fingerprint counts the mark\'s placement: the same place matches, another place does not', async () => {
  const mark = (dx: number): string => `1 0 0 rg ${100 + dx} 100 m ${120 + dx} 100 l ${110 + dx} 120 l h f`;
  const deck = await probe([{ content: mark(0) }, { content: mark(0) }, { content: mark(200) }]);
  const [a, b, c] = deck.slides.map((s) => s.objects[0]!);
  assert.equal(a!.fingerprint, b!.fingerprint);
  assert.notEqual(a!.fingerprint, c!.fingerprint);
});

test('every private PDF reads into a deck that validates', { skip: skipReason() ?? false }, async () => {
  const corpus = privateCorpus();
  assert.ok(corpus);
  const pdfs = [...corpus.files, ...corpus.slidesToTest].filter((f) => f.toLowerCase().endsWith('.pdf'));
  for (const file of pdfs) {
    const { deck } = await read(new Uint8Array(readFileSync(file)));
    assertSchema(deck);
    assert.ok(deck.slides.length > 0, path.basename(file));
    const again = await read(new Uint8Array(readFileSync(file)));
    assert.deepEqual(again.deck, deck, `${path.basename(file)} reads the same twice`);
  }
});
