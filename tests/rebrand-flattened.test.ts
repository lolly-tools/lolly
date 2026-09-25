// SPDX-License-Identifier: MPL-2.0
/**
 * The flattened path without the web (plan 274 section 6, first slice): region
 * selection, text correction and keep-as-picture over the page images of
 * `tests/fixtures/rebrand/flattened.pdf`.
 *
 * The pdf's page images are raw RGB behind a FlateDecode filter, so they decode
 * here with `node:zlib` and no canvas. The OCR is a stub that reads the
 * fixture's own five by seven bitmap face (the table below is a copy of the one
 * `scripts/build-rebrand-fixtures.ts` paints with), which makes the recovery
 * check of section 9 ("Flattened": titles by trigram containment above 0.9) a
 * test of the region finding, the crop and the typesetting rather than of a
 * model.
 *
 * Most tests here pin the region reading (`ocrScope: 'regions'`), the first
 * slice's path, which a page reading still falls back to when the recogniser
 * refuses the whole picture; the page reading's own tests are at the end of
 * this file and in tests/rebrand-picture-deck.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';

import { reconstructFlattenedSlide, flattenedPictureOf, type FlattenedOcrV1 } from '../packages/node-shell/src/rebrand/index.ts';
import { findSlideRegions, type RgbaImageV1, type SlideRegionV1, type SlideRegionsV1 } from '../engine/src/slide-regions.ts';
import type { SlideSourceV1, SourceObjectV1 } from '../packages/core/src/rebrand-v1.ts';
import type { OcrLine } from '../packages/core/src/host-v1.ts';

const FIXTURE = new URL('./fixtures/rebrand/flattened.pdf', import.meta.url);

/** The source schema's slide shape, so every rebuilt slide is checked against the contract it claims. */
const validateSlide = (() => {
  const schema = JSON.parse(readFileSync(new URL('../schemas/rebrand-source-v1.schema.json', import.meta.url), 'utf8')) as { $id: string };
  const ajv = new Ajv({ allErrors: true, strict: false });
  ajv.addSchema(schema);
  const validate = ajv.getSchema(`${schema.$id}#/$defs/slideSource`);
  assert.ok(validate, 'the source schema defines slideSource');
  return (slide: SlideSourceV1): void => {
    if (!(validate(slide) as boolean)) {
      const errors = (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`).join('; ');
      assert.fail(`${slide.id} failed the slideSource schema: ${errors}`);
    }
  };
})();
interface PageLabel {
  id: string;
  index: number;
  widthPx: number;
  heightPx: number;
  title: string;
}

/** The page labels the builder wrote, read field by field so a changed file fails here by name. */
function readLabels(): PageLabel[] {
  const raw: unknown = JSON.parse(readFileSync(new URL('./fixtures/rebrand/flattened.labels.json', import.meta.url), 'utf8'));
  assert.ok(raw && typeof raw === 'object' && 'slides' in raw && Array.isArray(raw.slides), 'flattened.labels.json has slides');
  return raw.slides.map((slide: unknown) => {
    assert.ok(slide && typeof slide === 'object');
    const field = (key: string): unknown => Reflect.get(slide, key);
    const objects = field('objects');
    const first: unknown = Array.isArray(objects) ? objects[0] : undefined;
    const title = first && typeof first === 'object' && 'text' in first && typeof first.text === 'string' ? first.text : '';
    return { id: String(field('id')), index: Number(field('index')), widthPx: Number(field('widthPx')), heightPx: Number(field('heightPx')), title };
  });
}
const LABELS = readLabels();

/** Every page image in the fixture, decoded from its FlateDecode RGB stream. */
function pageImages(): RgbaImageV1[] {
  const pdf = readFileSync(FIXTURE);
  const text = pdf.toString('latin1');
  const out: RgbaImageV1[] = [];
  const re = /\/Subtype \/Image \/Width (\d+) \/Height (\d+) [^>]*\/Length (\d+) >>\nstream\n/g;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const w = Number(m[1]);
    const h = Number(m[2]);
    const start = m.index + m[0].length;
    const rgb = inflateSync(pdf.subarray(start, start + Number(m[3])));
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = rgb[i * 3] ?? 0;
      data[i * 4 + 1] = rgb[i * 3 + 1] ?? 0;
      data[i * 4 + 2] = rgb[i * 3 + 2] ?? 0;
      data[i * 4 + 3] = 255;
    }
    out.push({ width: w, height: h, data });
  }
  return out;
}

/** The fixture's bitmap face, copied from the builder so the stub can read what it painted. */
const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
};

/**
 * A stand-in recogniser for the bitmap face: the crop's most common colour is
 * the ground, the rest is ink, each band of inked rows is a line, and each six
 * cell step along it is one glyph matched against the table.
 */
const bitmapOcr: FlattenedOcrV1 = async (frame) => {
  const { width: w, height: h, data } = frame;
  const at = (x: number, y: number): [number, number, number] => {
    const i = (y * w + x) * 4;
    return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0];
  };
  const counts = new Map<string, number>();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) counts.set(at(x, y).join(','), (counts.get(at(x, y).join(',')) ?? 0) + 1);
  const ground = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0].split(',').map(Number) ?? [0, 0, 0];
  const ink = (x: number, y: number): boolean => {
    const c = at(x, y);
    return Math.abs(c[0] - (ground[0] ?? 0)) + Math.abs(c[1] - (ground[1] ?? 0)) + Math.abs(c[2] - (ground[2] ?? 0)) > 100;
  };
  const rowInk = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => ink(x, y)).some(Boolean));
  const lines: OcrLine[] = [];
  for (let y = 0; y < h; ) {
    if (!rowInk[y]) {
      y++;
      continue;
    }
    const top = y;
    while (y < h && rowInk[y]) y++;
    const bottom = y;
    const scale = Math.max(1, Math.round((bottom - top) / 7));
    let left = w;
    let right = -1;
    for (let yy = top; yy < bottom; yy++) {
      for (let x = 0; x < w; x++) {
        if (ink(x, yy)) {
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
      }
    }
    let text = '';
    for (let gx0 = left; gx0 <= right; gx0 += 6 * scale) {
      const bits = Array.from({ length: 7 }, (_, gy) =>
        Array.from({ length: 5 }, (_, gx) => (ink(gx0 + gx * scale + (scale >> 1), top + gy * scale + (scale >> 1)) ? '#' : '.')).join(''),
      );
      if (bits.every((row) => row === '.....')) {
        text += ' ';
        continue;
      }
      let best = '?';
      let bestMiss = Number.POSITIVE_INFINITY;
      for (const [ch, rows] of Object.entries(GLYPHS)) {
        let miss = 0;
        rows.forEach((row, r) => {
          for (let c = 0; c < 5; c++) if (row[c] !== bits[r]?.[c]) miss++;
        });
        if (miss < bestMiss) {
          bestMiss = miss;
          best = ch;
        }
      }
      text += best;
    }
    lines.push({ text: text.trim(), confidence: 0.98, box: { x: left, y: top, w: right - left + 1, h: bottom - top } });
  }
  return lines;
};

/** Character trigrams of an upper-cased string with runs of space folded. */
function trigrams(s: string): Set<string> {
  const t = ` ${s.toUpperCase().replace(/\s+/g, ' ').trim()} `;
  const out = new Set<string>();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return out;
}

/** Share of the expected text's trigrams found in the recovered text. */
function containment(expected: string, recovered: string): number {
  const want = trigrams(expected);
  const have = trigrams(recovered);
  let hit = 0;
  for (const g of want) if (have.has(g)) hit++;
  return want.size ? hit / want.size : 0;
}

/** The slide a pdf source adapter reads for a page that is one full-page image. */
function sourceSlide(i: number, pictureRef: string): SlideSourceV1 {
  const label = LABELS[i];
  assert.ok(label, `label for page ${i + 1}`);
  const object: SourceObjectV1 = {
    id: `${label.id}.Im0`,
    fingerprint: `pic:${i}`,
    kind: 'pic',
    box: { x: 0, y: 0, w: label.widthPx, h: label.heightPx, rot: 0 },
    origin: 'pdf-artifact',
    fidelity: { state: 'raster-preserved' },
    media: pictureRef,
    mediaMime: 'image/png',
  };
  return {
    id: label.id,
    index: label.index,
    width: label.widthPx,
    height: label.heightPx,
    background: {},
    objects: [object],
    readingOrder: [object.id],
    warnings: [],
    origin: { kind: 'pdf', flattened: true },
  };
}

/** A sink that keeps what it was given, keyed by content, and counts calls. */
function memorySink(): { sink: (bytes: Uint8Array, mime: string, hint: string) => Promise<string>; stored: Map<string, Uint8Array>; calls: () => number } {
  const stored = new Map<string, Uint8Array>();
  let calls = 0;
  return {
    stored,
    calls: () => calls,
    sink: async (bytes) => {
      calls++;
      const ref = `media/${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}`;
      stored.set(ref, bytes);
      return ref;
    },
  };
}

const textOf = (slide: SlideSourceV1): string =>
  slide.objects
    .filter((o) => o.kind === 'text')
    .flatMap((o) => o.text?.paras ?? [])
    .map((p) => p.runs.map((r) => r.text).join(''))
    .join('\n');

const pages = pageImages();

function pageAt(i: number): RgbaImageV1 {
  const picture = pages[i];
  assert.ok(picture, `page ${i + 1} decoded`);
  return picture;
}

test('the fixture decodes to three 960 by 540 pages without a canvas', () => {
  assert.equal(pages.length, 3);
  assert.ok(pages.every((p) => p.width === 960 && p.height === 540));
});

test('with the stub OCR, every page title comes back by trigram containment above 0.9', async () => {
  for (const [i, picture] of pages.entries()) {
    const { sink } = memorySink();
    const slide = sourceSlide(i, `page/${i + 1}`);
    assert.ok(flattenedPictureOf(slide), 'the source slide is a flattened page');
    const rebuilt = await reconstructFlattenedSlide({ slide, picture, sink, ocr: bitmapOcr, ocrModel: 'bitmap-stub', ocrScope: 'regions' });
    const expected = LABELS[i]?.title ?? '';
    const score = containment(expected, textOf(rebuilt));
    assert.ok(score > 0.9, `page ${i + 1}: ${JSON.stringify(textOf(rebuilt))} against ${expected} scored ${score}`);

    const title = rebuilt.objects.find((o) => o.kind === 'text');
    assert.ok(title);
    assert.equal(title.origin, 'raster-region');
    assert.deepEqual(title.fidelity, { state: 'approximate', reason: 'ocr-estimate' });
    assert.equal(title.ocr?.state, 'text-found');
    assert.equal(title.ocr?.model, 'bitmap-stub');
    assert.ok((title.ocr?.lines?.[0]?.confidence ?? 0) > 0.9);
    // Capitals 42 px tall at a 0.7 cap height: a 60 px em, 45 pt, stated as an estimate.
    assert.equal(title.text?.paras[0]?.runs[0]?.sizePt, 45);
    assert.equal(title.text?.paras[0]?.runs[0]?.color?.hex, '#ffffff');

    // The band and the two grey blocks come back as flat shapes under the text.
    const shapes = rebuilt.objects.filter((o) => o.kind === 'shape');
    assert.deepEqual(shapes.map((s) => s.fill?.hex), ['#1f4e79', '#e8eaee', '#e8eaee']);
    const band = shapes[0];
    assert.ok(band);
    assert.ok(rebuilt.objects.indexOf(band) < rebuilt.objects.indexOf(title));

    // The whole-slide picture is kept as the recovery option, naming the object it was.
    assert.deepEqual(rebuilt.recovery, { assetRef: `page/${i + 1}`, fromObjectId: `${slide.id}.Im0` });
    assert.equal(rebuilt.preview, undefined, 'the recovery picture is not described as a preview');
    assert.deepEqual(rebuilt.ocr, { state: 'text-found', model: 'bitmap-stub' });
    assert.equal(title.roleEstimate, 'title', 'the large line at the top is estimated a title');
    assert.equal(title.placeholder, undefined, 'an estimate is never a placeholder binding');
    assert.ok(rebuilt.objects.filter((o) => o.kind !== 'text').every((o) => o.roleEstimate === undefined), 'only text carries a role estimate');
    validateSlide(rebuilt);
    assert.equal(rebuilt.origin.flattened, true);
    assert.ok(!rebuilt.objects.some((o) => o.id === `${slide.id}.Im0`));
    assert.equal(rebuilt.background.color?.hex, '#fcfcfc');
    assert.deepEqual(new Set(rebuilt.readingOrder), new Set(rebuilt.objects.map((o) => o.id)));
  }
});

test('no region is both text and a picture, and ids are unique and stable', async () => {
  const slide = sourceSlide(0, 'page/1');
  const a = await reconstructFlattenedSlide({ slide, picture: pageAt(0), sink: memorySink().sink, ocr: bitmapOcr });
  const b = await reconstructFlattenedSlide({ slide, picture: pageAt(0), sink: memorySink().sink, ocr: bitmapOcr });
  assert.deepEqual(a, b);
  const ids = a.objects.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length);
  const regionOf = (id: string): string => id.slice(`${slide.id}.Im0.`.length).replace(/\.part\d+$/, '');
  const kindsByRegion = new Map<string, Set<string>>();
  for (const o of a.objects) kindsByRegion.set(regionOf(o.id), new Set([...(kindsByRegion.get(regionOf(o.id)) ?? []), o.kind]));
  for (const [region, kinds] of kindsByRegion) assert.ok(!(kinds.has('text') && kinds.has('pic')), `region ${region} is both`);
});

test('with no OCR, text regions stay pictures and say OCR was not run', async () => {
  const { sink, calls } = memorySink();
  const slide = sourceSlide(1, 'page/2');
  const rebuilt = await reconstructFlattenedSlide({ slide, picture: pageAt(1), sink });
  assert.equal(rebuilt.objects.filter((o) => o.kind === 'text').length, 0);
  const pics = rebuilt.objects.filter((o) => o.kind === 'pic');
  assert.equal(pics.length, 1);
  const pic = pics[0];
  assert.ok(pic);
  assert.equal(pic.origin, 'raster-region');
  assert.deepEqual(pic.fidelity, { state: 'raster-preserved' });
  assert.equal(pic.ocr?.state, 'not-run');
  assert.equal(pic.mediaMime, 'image/png');
  assert.ok(pic.media?.startsWith('media/'));
  assert.equal(calls(), 1);
  assert.deepEqual(rebuilt.ocr, { state: 'not-run' });
  assert.deepEqual(rebuilt.recovery, { assetRef: 'page/2', fromObjectId: `${slide.id}.Im0` });
  validateSlide(rebuilt);

  const unavailable = await reconstructFlattenedSlide({ slide, picture: pageAt(1), sink, ocrMissing: 'unavailable' });
  assert.equal(unavailable.objects.find((o) => o.kind === 'pic')?.ocr?.state, 'unavailable');
  assert.deepEqual(unavailable.ocr, { state: 'unavailable' });
  validateSlide(unavailable);
});

test('keep-as-picture on a panel keeps it whole, with nothing inside rebuilt', async () => {
  const slide = sourceSlide(2, 'page/3');
  const rebuilt = await reconstructFlattenedSlide({
    slide,
    picture: pageAt(2),
    sink: memorySink().sink,
    ocr: bitmapOcr,
    ocrScope: 'regions',
    decisions: { r1: { keep: 'picture' } },
  });
  assert.equal(rebuilt.objects.filter((o) => o.kind === 'text').length, 0);
  const band = rebuilt.objects.find((o) => o.id === `${slide.id}.Im0.r1`);
  assert.equal(band?.kind, 'pic');
  assert.deepEqual(band?.box, { x: 0, y: 0, w: 960, h: 96, rot: 0 });
  assert.ok(!rebuilt.objects.some((o) => o.id.startsWith(`${slide.id}.Im0.r1.`)));
  assert.equal(band?.ocr?.state, 'not-run', 'a recogniser was passed, but a region kept whole is not read');

  // With no OCR on the host, a region kept whole says so like every other object on the slide.
  const bare = await reconstructFlattenedSlide({ slide, picture: pageAt(2), sink: memorySink().sink, ocrMissing: 'unavailable', decisions: { r1: { keep: 'picture' } } });
  assert.deepEqual(
    bare.objects.filter((o) => o.ocr).map((o) => o.ocr?.state),
    bare.objects.filter((o) => o.ocr).map(() => 'unavailable'),
  );
  assert.deepEqual(bare.ocr, { state: 'unavailable' });
});

test('text correction replaces what OCR read, and works with no OCR at all', async () => {
  const slide = sourceSlide(0, 'page/1');
  const corrected = await reconstructFlattenedSlide({
    slide,
    picture: pageAt(0),
    sink: memorySink().sink,
    ocr: async () => [{ text: 'REVENUF GR0WTH', confidence: 0.6, box: { x: 4, y: 4, w: 498, h: 42 } }],
    ocrModel: 'stub',
    ocrScope: 'regions',
    decisions: { 'r1.1': { keep: 'text', text: 'Revenue growth' } },
  });
  assert.equal(textOf(corrected), 'Revenue growth');
  // The evidence is what the recogniser read, at the confidence it gave, never the typed text.
  const fixed = corrected.objects.find((o) => o.kind === 'text');
  assert.equal(fixed?.ocr?.state, 'text-found');
  assert.equal(fixed?.ocr?.model, 'stub');
  assert.deepEqual(
    fixed?.ocr?.lines?.map((l) => [l.text, l.confidence]),
    [['REVENUF GR0WTH', 0.6]],
  );
  assert.deepEqual(fixed?.fidelity, { state: 'approximate', reason: 'reader-approximation' });
  assert.deepEqual(corrected.ocr, { state: 'text-found', model: 'stub' }, 'the recogniser ran, so the slide says so');
  assert.equal(fixed?.roleEstimate, 'title', 'typed text on the box OCR read is sized from that box, so the large top line is a title');

  // Two typed lines over one line read: the boxes are spread over the region, so no size-based guess is written.
  const reflowed = await reconstructFlattenedSlide({
    slide,
    picture: pageAt(0),
    sink: memorySink().sink,
    ocr: async () => [{ text: 'REVENUF GR0WTH', confidence: 0.6, box: { x: 4, y: 4, w: 498, h: 42 } }],
    ocrModel: 'stub',
    ocrScope: 'regions',
    decisions: { 'r1.1': { keep: 'text', text: 'Revenue\ngrowth' } },
  });
  const spread = reflowed.objects.filter((o) => o.kind === 'text');
  assert.ok(spread.length > 0);
  assert.ok(spread.every((o) => o.roleEstimate === undefined), 'no estimate from boxes nobody measured');
  const typed = await reconstructFlattenedSlide({
    slide,
    picture: pageAt(0),
    sink: memorySink().sink,
    decisions: { 'r1.1': { keep: 'text', text: 'Revenue growth' } },
  });
  const text = typed.objects.find((o) => o.kind === 'text');
  assert.equal(textOf(typed), 'Revenue growth');
  assert.deepEqual(text?.ocr, { state: 'not-run' });
  assert.equal(text?.fidelity.reason, 'reader-approximation');
  assert.deepEqual(typed.ocr, { state: 'not-run' }, 'typed text is not a reading, so recognition still has not run');
  assert.equal(text?.roleEstimate, undefined, 'with no OCR boxes the typed line is spread over the region, so nothing is estimated');
  validateSlide(typed);
});

test('lines that leave ink unexplained keep the region a picture, with the reading attached', async () => {
  const slide = sourceSlide(0, 'page/1');
  const rebuilt = await reconstructFlattenedSlide({
    slide,
    picture: pageAt(0),
    sink: memorySink().sink,
    // Reads only the first word, as a recogniser that missed half a line would.
    ocr: async () => [{ text: 'REVENUE', confidence: 0.9, box: { x: 4, y: 4, w: 246, h: 42 } }],
    ocrScope: 'regions',
  });
  assert.equal(rebuilt.objects.filter((o) => o.kind === 'text').length, 0);
  const kept = rebuilt.objects.find((o) => o.id === `${slide.id}.Im0.r1.1`);
  assert.equal(kept?.kind, 'pic');
  assert.equal(kept?.ocr?.state, 'text-found');
  assert.equal(kept?.ocr?.lines?.[0]?.text, 'REVENUE');
});

test('a person-selected region set replaces detection without losing the ink it leaves out, and a cap leaves the slide one picture', async () => {
  const slide = sourceSlide(0, 'page/1');
  const picture = pageAt(0);
  const found = findSlideRegions(picture);
  const onlyBand = { ...found, regions: found.regions.filter((r) => r.id === 'r1' || r.id === 'r1.1') };
  const rebuilt = await reconstructFlattenedSlide({ slide, picture, sink: memorySink().sink, ocr: bitmapOcr, regions: onlyBand });
  assert.deepEqual(
    rebuilt.objects.map((o) => [o.id.slice(`${slide.id}.Im0.`.length), o.kind]),
    [
      ['r1', 'shape'],
      ['rest1', 'pic'],
      ['rest2', 'pic'],
      ['r1.1', 'text'],
    ],
  );
  // The two grey blocks no selected box held come back as pictures of themselves.
  const left = found.regions.filter((r) => r.id === 'r2' || r.id === 'r3').map((r) => r.box);
  const rest = rebuilt.objects.filter((o) => o.id.includes('.rest'));
  for (const box of left) {
    assert.ok(
      rest.some((o) => o.box.x <= box.x && o.box.y <= box.y && o.box.x + o.box.w >= box.x + box.w && o.box.y + o.box.h >= box.y + box.h),
      `${JSON.stringify(box)} is kept`,
    );
  }
  assert.ok(rest.every((o) => o.origin === 'raster-region' && o.mediaMime === 'image/png' && o.ocr?.state === 'not-run'));

  const capped = await reconstructFlattenedSlide({ slide, picture, sink: memorySink().sink, regionOpts: { maxRegions: 1 } });
  assert.deepEqual(capped.objects.map((o) => o.id), [`${slide.id}.Im0`]);
  assert.equal(capped.warnings[0]?.code, 'nodes-truncated');
  assert.equal(capped.origin.flattened, true);
  assert.equal(capped.recovery, undefined, 'the picture object is still on the slide, so there is nothing to recover');
  assert.deepEqual(capped.ocr, { state: 'not-run' });
  validateSlide(capped);

  // A page render with no picture object on the slide is nowhere else, so it is the recovery option even when not cut.
  const bare: SlideSourceV1 = { ...slide, objects: [], readingOrder: [] };
  const render = await reconstructFlattenedSlide({ slide: bare, picture, sink: memorySink().sink, pictureRef: 'render/1', regionOpts: { maxRegions: 1 } });
  assert.deepEqual(render.objects, []);
  assert.deepEqual(render.recovery, { assetRef: 'render/1' });
});

test('a shared media cache stores one crop once across slides, and an abort stops the run', async () => {
  const { sink, calls } = memorySink();
  const mediaCache = new Map<string, string>();
  const slide = sourceSlide(1, 'page/2');
  await reconstructFlattenedSlide({ slide, picture: pageAt(1), sink, mediaCache });
  await reconstructFlattenedSlide({ slide, picture: pageAt(1), sink, mediaCache });
  assert.equal(calls(), 1);
  const controller = new AbortController();
  controller.abort(new Error('stopped'));
  await assert.rejects(reconstructFlattenedSlide({ slide, picture: pageAt(1), sink, signal: controller.signal }), /stopped/);
});

test('a slide that is a picture plus objects of its own is left alone, with a warning', async () => {
  const slide = sourceSlide(0, 'page/1');
  const own: SourceObjectV1 = {
    id: `${slide.id}.T1`,
    fingerprint: 'text:0',
    kind: 'text',
    box: { x: 60, y: 460, w: 200, h: 30, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'editable' },
    text: { paras: [{ runs: [{ text: 'Footnote' }] }] },
  };
  const mixed: SlideSourceV1 = { ...slide, objects: [...slide.objects, own], readingOrder: [...slide.readingOrder, own.id], origin: { kind: 'pdf' } };
  assert.equal(flattenedPictureOf(mixed), null);
  const out = await reconstructFlattenedSlide({ slide: mixed, picture: pageAt(0), sink: memorySink().sink, ocr: bitmapOcr });
  assert.deepEqual(out.objects, mixed.objects);
  assert.equal(out.origin.flattened, undefined);
  assert.equal(out.preview, undefined);
  assert.equal(out.recovery, undefined, 'a slide that is not one picture is not flattened, so it has no recovery picture');
  assert.equal(out.ocr, undefined);
  assert.equal(out.warnings[0]?.code, 'nodes-truncated');
  assert.deepEqual(out.warnings[0]?.objectIds, [`${slide.id}.Im0`, own.id]);

  // A turned picture is not cut up either, and says so.
  const turned = sourceSlide(0, 'page/1');
  const first = turned.objects[0];
  assert.ok(first);
  turned.objects = [{ ...first, box: { ...first.box, rot: 90 } }];
  const kept = await reconstructFlattenedSlide({ slide: turned, picture: pageAt(0), sink: memorySink().sink, ocr: bitmapOcr });
  assert.deepEqual(kept.objects.map((o) => o.id), [`${slide.id}.Im0`]);
  assert.deepEqual(kept.warnings[0]?.objectIds, [`${slide.id}.Im0`]);
  assert.equal(kept.recovery, undefined, 'the turned picture is still the slide object, so there is nothing to recover');
  assert.deepEqual(kept.ocr, { state: 'not-run' }, 'a recogniser was passed but never called, so it did not run');

  // Nor is a picture the page clips: rebuilt over its whole box, it would bring back what the page hid.
  const clipped = sourceSlide(0, 'page/1');
  const whole = clipped.objects[0];
  assert.ok(whole);
  clipped.objects = [{ ...whole, clip: { x: whole.box.x, y: whole.box.y, w: whole.box.w / 2, h: whole.box.h, rot: 0 } }];
  const uncut = await reconstructFlattenedSlide({ slide: clipped, picture: pageAt(0), sink: memorySink().sink, ocr: bitmapOcr });
  assert.deepEqual(uncut.objects.map((o) => o.id), [`${slide.id}.Im0`]);
  assert.deepEqual(uncut.warnings.map((w) => [w.code, w.objectIds]), [['nodes-truncated', [`${slide.id}.Im0`]]]);
  assert.match(uncut.warnings[0]!.message, /clipped/);
  assert.equal(uncut.recovery, undefined);
});

/** A searchable scan of page 1: its picture carries the document's own text layer, one line over the title. */
test('a slide the source marked flattened is one picture however much of it the picture covers; an unmarked one needs 90 percent', () => {
  const slide = sourceSlide(0, 'page/1');
  const pic = slide.objects[0]!;
  // Seventy percent of the slide, as the pdf adapter marks a scan placed on a page.
  const small: SlideSourceV1 = { ...slide, objects: [{ ...pic, box: { ...pic.box, x: 80, y: 44, w: slide.width * 0.84, h: slide.height * 0.84 } }] };
  assert.equal(flattenedPictureOf(small)?.id, pic.id);
  assert.equal(flattenedPictureOf({ ...small, origin: { kind: 'pptx' } }), null, 'not marked: the 90 percent rule applies');
  assert.equal(flattenedPictureOf({ ...slide, origin: { kind: 'pptx' } })?.id, pic.id, 'not marked but covering the slide');
  const withText: SlideSourceV1 = {
    ...small,
    objects: [...small.objects, { id: 'x.T', fingerprint: 'text:x', kind: 'text', box: { x: 0, y: 0, w: 10, h: 10, rot: 0 }, origin: 'slide', fidelity: { state: 'editable' } }],
  };
  assert.equal(flattenedPictureOf(withText), null, 'a marked slide with objects besides its picture is still refused');
});

function scannedWithLayer(): SlideSourceV1 {
  const slide = sourceSlide(0, 'page/1');
  const pic = slide.objects[0];
  assert.ok(pic);
  const layer = { state: 'text-found' as const, model: 'pdf-text-layer', lines: [{ text: 'Quarterly results', confidence: 1, box: { x: 62, y: 28, w: 490, h: 38, rot: 0 } }] };
  return { ...slide, objects: [{ ...pic, ocr: layer }], ocr: { state: 'text-found', model: 'pdf-text-layer' } };
}

/** Every object on the slide that carries a text-layer reading, with the lines it carries. */
const layerLines = (slide: SlideSourceV1): Array<[string, string[]]> =>
  slide.objects
    .filter((o) => o.ocr?.model === 'pdf-text-layer')
    .map((o) => [o.id.slice(`${slide.id}.Im0.`.length), (o.ocr?.lines ?? []).map((l) => l.text)]);

test('a searchable scan rebuilt without a recogniser moves its text layer onto the region it covers', async () => {
  const slide = scannedWithLayer();
  const rebuilt = await reconstructFlattenedSlide({ slide, picture: pageAt(0), sink: memorySink().sink });
  assert.ok(!rebuilt.objects.some((o) => o.id === `${slide.id}.Im0`), 'the slide is cut into regions');
  assert.deepEqual(layerLines(rebuilt), [['r1.1', ['Quarterly results']]], 'the line survives on the region it lies over');
  const title = rebuilt.objects.find((o) => o.id === `${slide.id}.Im0.r1.1`);
  assert.equal(title?.kind, 'pic');
  assert.equal(title?.ocr?.state, 'text-found');
  assert.equal(title?.ocr?.lines?.[0]?.confidence, 1);
  assert.deepEqual(rebuilt.ocr, { state: 'text-found', model: 'pdf-text-layer' }, 'the slide and the object holding the layer say the same');
  assert.deepEqual(rebuilt.recovery, { assetRef: 'page/1', fromObjectId: `${slide.id}.Im0` });
  validateSlide(rebuilt);
});

test('a recogniser that reads nothing does not turn a text layer into no text found', async () => {
  const slide = scannedWithLayer();
  const blank = await reconstructFlattenedSlide({ slide, picture: pageAt(0), sink: memorySink().sink, ocr: async () => [], ocrModel: 'bitmap-stub' });
  assert.deepEqual(blank.ocr, { state: 'text-found', model: 'pdf-text-layer' }, 'the document states its text, so a weaker reading does not overrule it');
  assert.deepEqual(layerLines(blank), [['r1.1', ['Quarterly results']]]);
  validateSlide(blank);

  // A recogniser that does read the text is the slide's reading, and its own evidence stays on the text it rebuilt.
  const read = await reconstructFlattenedSlide({ slide, picture: pageAt(0), sink: memorySink().sink, ocr: bitmapOcr, ocrModel: 'bitmap-stub' });
  assert.deepEqual(read.ocr, { state: 'text-found', model: 'bitmap-stub' });
  const text = read.objects.find((o) => o.kind === 'text');
  assert.equal(text?.ocr?.model, 'bitmap-stub');
  validateSlide(read);

  // Kept as one picture (turned), the slide keeps the layer's reading, which is still on its picture.
  const turned = scannedWithLayer();
  const first = turned.objects[0];
  assert.ok(first);
  turned.objects = [{ ...first, box: { ...first.box, rot: 90 } }];
  delete turned.ocr;
  const kept = await reconstructFlattenedSlide({ slide: turned, picture: pageAt(0), sink: memorySink().sink });
  assert.deepEqual(kept.ocr, { state: 'text-found', model: 'pdf-text-layer' }, 'read from the picture when the slide states nothing');
  assert.equal(kept.objects[0]?.ocr?.lines?.[0]?.text, 'Quarterly results');
});

test('no text found is claimed only when every region that could hold text was read', async () => {
  const slide = sourceSlide(0, 'page/1');
  const blank = await reconstructFlattenedSlide({ slide, picture: pageAt(0), sink: memorySink().sink, ocr: async () => [], ocrModel: 'bitmap-stub' });
  assert.deepEqual(blank.ocr, { state: 'no-text-found', model: 'bitmap-stub' }, 'the only text region was read and held nothing');
  assert.equal(blank.objects.filter((o) => o.kind === 'text').length, 0);
  validateSlide(blank);

  // A blank reading of part of the slide: the lower panel is read as text and holds none, but the title is
  // kept whole and never read, so the slide makes no claim about text.
  const partial = await reconstructFlattenedSlide({
    slide,
    picture: pageAt(0),
    sink: memorySink().sink,
    ocr: async () => [],
    ocrModel: 'bitmap-stub',
    decisions: { r2: { keep: 'text' }, 'r1.1': { keep: 'picture' } },
  });
  assert.deepEqual(partial.ocr, { state: 'not-run' });
  assert.equal(partial.objects.find((o) => o.id === `${slide.id}.Im0.r1.1`)?.ocr?.state, 'not-run');
  validateSlide(partial);

  const unread = { ...sourceSlide(0, 'page/1'), ocr: { state: 'not-run' as const } };
  const none = await reconstructFlattenedSlide({ slide: unread, picture: pageAt(0), sink: memorySink().sink, ocrMissing: 'unavailable' });
  assert.deepEqual(none.ocr, { state: 'unavailable' }, 'a state that is not a reading is replaced by what this run knows');
});

test('reading indices follow the new order on every object, without changing the input slide', async () => {
  const slide = sourceSlide(0, 'page/1');
  const master: SourceObjectV1 = {
    id: `${slide.id}.M1`,
    fingerprint: 'shape:m',
    kind: 'shape',
    box: { x: 0, y: 520, w: 960, h: 20, rot: 0 },
    origin: 'master',
    fidelity: { state: 'editable' },
    readingIndex: 1,
  };
  const withMaster: SlideSourceV1 = { ...slide, objects: [master, ...slide.objects], readingOrder: [...slide.readingOrder, master.id] };
  const out = await reconstructFlattenedSlide({ slide: withMaster, picture: pageAt(0), sink: memorySink().sink, ocr: bitmapOcr });
  for (const [i, id] of out.readingOrder.entries()) assert.equal(out.objects.find((o) => o.id === id)?.readingIndex, i, id);
  assert.equal(master.readingIndex, 1);
});

test('a region covering the whole picture is stored as its own PNG and fingerprints alike under two sinks', async () => {
  const slide = sourceSlide(1, 'page/2');
  const first = slide.objects[0];
  assert.ok(first);
  slide.objects = [{ ...first, media: 'media/orig-jpeg', mediaMime: 'image/jpeg' }];
  const picture = pageAt(1);
  const found = findSlideRegions(picture);
  const first0 = found.regions[0];
  assert.ok(first0);
  const region: SlideRegionV1 = { ...first0, id: 'r1', kind: 'picture', depth: 0, box: { x: 0, y: 0, w: picture.width, h: picture.height } };
  delete region.parent;
  const whole: SlideRegionsV1 = { ...found, regions: [region] };
  const other = async (bytes: Uint8Array): Promise<string> => `other/${bytes.length}`;
  const a = await reconstructFlattenedSlide({ slide, picture, sink: memorySink().sink, regions: whole });
  const b = await reconstructFlattenedSlide({ slide, picture, sink: other, regions: whole });
  const pa = a.objects.find((o) => o.kind === 'pic');
  const pb = b.objects.find((o) => o.kind === 'pic');
  assert.equal(pa?.mediaMime, 'image/png');
  assert.notEqual(pa?.media, 'media/orig-jpeg');
  assert.ok(pa?.fingerprint && pa.fingerprint === pb?.fingerprint);
  assert.notEqual(pa?.media, pb?.media);
});

test('a line read under the confidence floor keeps the region a picture, with every reading kept', async () => {
  const slide = sourceSlide(0, 'page/1');
  const rebuilt = await reconstructFlattenedSlide({
    slide,
    picture: pageAt(0),
    sink: memorySink().sink,
    ocr: async () => [
      { text: 'REVENUE', confidence: 0.9, box: { x: 4, y: 4, w: 246, h: 42 } },
      { text: 'GR0WTH', confidence: 0.3, box: { x: 260, y: 4, w: 240, h: 42 } },
    ],
    ocrScope: 'regions',
  });
  assert.equal(rebuilt.objects.filter((o) => o.kind === 'text').length, 0);
  const kept = rebuilt.objects.find((o) => o.id === `${slide.id}.Im0.r1.1`);
  assert.equal(kept?.kind, 'pic');
  assert.deepEqual(
    kept?.ocr?.lines?.map((l) => [l.text, l.confidence]),
    [
      ['REVENUE', 0.9],
      ['GR0WTH', 0.3],
    ],
  );
});

test('keep-as-text on a panel reads it against its fill and puts the text on the rectangle', async () => {
  const slide = sourceSlide(0, 'page/1');
  const found = findSlideRegions(pageAt(0));
  // Children listed before their parent: the parent-first walk still applies the decision to the child.
  const reversed = { ...found, regions: [...found.regions].reverse() };
  const rebuilt = await reconstructFlattenedSlide({
    slide,
    picture: pageAt(0),
    sink: memorySink().sink,
    ocr: bitmapOcr,
    regions: reversed,
    decisions: { r1: { keep: 'text' } },
  });
  const ids = rebuilt.objects.map((o) => o.id.slice(`${slide.id}.Im0.`.length));
  assert.ok(ids.includes('r1') && ids.includes('r1.text'), ids.join(' '));
  assert.ok(!ids.includes('r1.1'), ids.join(' '));
  assert.equal(rebuilt.objects.find((o) => o.id.endsWith('.r1'))?.kind, 'shape');
  const text = rebuilt.objects.find((o) => o.id.endsWith('.r1.text'));
  assert.equal(text?.text?.paras[0]?.runs[0]?.color?.hex, '#ffffff');
  assert.ok(containment(LABELS[0]?.title ?? '', textOf(rebuilt)) > 0.9);

  const kept = await reconstructFlattenedSlide({
    slide,
    picture: pageAt(0),
    sink: memorySink().sink,
    ocr: bitmapOcr,
    regions: reversed,
    decisions: { r1: { keep: 'picture' } },
  });
  assert.ok(!kept.objects.some((o) => o.id.endsWith('.r1.1')));
});

// ─── synthetic pages ─────────────────────────────────────────────────────────

type Rgb = [number, number, number];

function synthetic(w: number, h: number, ground: (x: number, y: number) => Rgb): RgbaImageV1 {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = ground(x, y);
      data.set([c[0], c[1], c[2], 255], (y * w + x) * 4);
    }
  }
  return { width: w, height: h, data };
}

/** Blocks 10 by 16 px standing for letters, `n` per word, returning the line's box. */
function blockLine(img: RgbaImageV1, x: number, y: number, words: number[], ink: Rgb): { x: number; y: number; w: number; h: number } {
  let cursor = x;
  for (const n of words) {
    for (let k = 0; k < n; k++) {
      for (let yy = y; yy < y + 16; yy++) for (let xx = cursor; xx < cursor + 10; xx++) img.data.set(ink, (yy * img.width + xx) * 4);
      cursor += 14;
    }
    cursor += 16;
  }
  return { x, y, w: cursor - 16 - x, h: 16 };
}

function pageSlide(w: number, h: number): SlideSourceV1 {
  return { id: 'syn', index: 0, width: w, height: h, background: {}, objects: [], readingOrder: [], warnings: [], origin: { kind: 'pdf', flattened: true } };
}

test('each line keeps the colour of its own ink when one region holds two colours', async () => {
  const img = synthetic(1280, 720, () => [255, 255, 255]);
  const red = blockLine(img, 80, 100, [5, 3, 7], [220, 40, 40]);
  const black = blockLine(img, 80, 126, [5, 3, 7, 4], [30, 30, 30]);
  const found = findSlideRegions(img);
  // One region a person drew around both lines.
  const one = found.regions[0];
  assert.ok(one);
  const drawn: SlideRegionV1 = { ...one, id: 'r1', kind: 'text', box: { x: 76, y: 96, w: 420, h: 50 } };
  const selected: SlideRegionsV1 = { ...found, regions: [drawn] };
  const ocr: FlattenedOcrV1 = async (_frame, region) => {
    const at = (b: typeof red): OcrLine['box'] => ({ x: b.x - region.box.x + 4, y: b.y - region.box.y + 4, w: b.w, h: b.h });
    return [
      { text: 'Lead in', confidence: 0.95, box: at(red) },
      { text: 'then the body text', confidence: 0.95, box: at(black) },
    ];
  };
  const out = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: memorySink().sink, ocr, regions: selected, pictureRef: 'page' });
  assert.deepEqual(out.recovery, { assetRef: 'page' }, 'a page render with no picture object names no object');
  validateSlide(out);
  const runs = out.objects.filter((o) => o.kind === 'text').flatMap((o) => o.text?.paras ?? []).flatMap((p) => p.runs);
  assert.deepEqual(
    runs.map((r) => [r.text.trim(), r.color?.hex]),
    [
      ['Lead in', '#dc2828'],
      ['then the body text', '#1e1e1e'],
    ],
  );
});

test('on a gradient page a wide line is measured against the fitted ground, so its size is read from its ink', async () => {
  const img = synthetic(1280, 720, (x) => [255 - Math.round((x / 1280) * 160), 235, 235]);
  const line = blockLine(img, 80, 300, [6, 5, 7, 4, 6, 5, 7, 6, 5, 7, 4, 6], [20, 20, 30]);
  const found = findSlideRegions(img);
  assert.equal(found.backgroundModel, 'surface');
  // A detector pads its box by 4 px. Against one ground colour the gradient's
  // drift at the ends of the line reads as ink and fills the padding (a 24 px box, 25.5 pt).
  const ocr: FlattenedOcrV1 = async (_frame, region) => [
    { text: 'A LONG LINE ACROSS THE PAGE', confidence: 0.95, box: { x: line.x - region.box.x, y: line.y - region.box.y, w: line.w + 8, h: line.h + 8 } },
  ];
  const out = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: memorySink().sink, ocr, pictureRef: 'page', ocrScope: 'regions' });
  assert.deepEqual(out.objects.map((o) => o.kind), ['text']);
  // Blocks 16 px tall read as capitals at a 0.7 cap height: about a 23 px em, 17 pt.
  assert.equal(out.objects[0]?.text?.paras[0]?.runs[0]?.sizePt, 17);
  assert.equal(out.warnings[0]?.code, 'gradient-flattened');

  // Placed on a page at 70 percent, the gradient is the picture's own paper: the
  // warning names the rectangle that carries it, not a whole-slide picture.
  const slide = pageSlide(1600, 900);
  const pic: SourceObjectV1 = {
    id: 'syn.Im0', fingerprint: 'pic:0', kind: 'pic', box: { x: 160, y: 90, w: 1280, h: 720, rot: 0 },
    origin: 'slide', fidelity: { state: 'raster-preserved' }, media: 'page', mediaMime: 'image/png',
  };
  const placed = await reconstructFlattenedSlide({ slide: { ...slide, objects: [pic], readingOrder: [pic.id] }, picture: img, sink: memorySink().sink, ocr, ocrScope: 'regions' });
  const ground = placed.warnings.filter((w) => w.code === 'gradient-flattened');
  assert.deepEqual(ground.map((w) => w.objectIds), [['syn.Im0.ground']]);
  assert.match(ground[0]!.message, /paper of the picture/);
  assert.ok(placed.objects.some((o) => o.id === 'syn.Im0.ground'));
});

// ─── the page reading (plan 275 WP10) ────────────────────────────────────────

type DrawnBox = { x: number; y: number; w: number; h: number };

/**
 * A stand-in recogniser that knows where each line was drawn: for a crop it
 * returns the lines lying wholly inside it, in the crop's own pixels. The page
 * reading crops with no padding (region ids starting `page`), a colour region
 * with 4 px of context.
 */
function placedOcr(lines: Array<{ text: string; box: DrawnBox }>, calls: string[] = []): FlattenedOcrV1 {
  return async (frame, region) => {
    calls.push(region.id);
    const pad = region.id.startsWith('page') ? 0 : 4;
    const ox = Math.max(0, Math.floor(region.box.x - pad));
    const oy = Math.max(0, Math.floor(region.box.y - pad));
    return lines
      .filter((l) => l.box.x >= ox && l.box.y >= oy && l.box.x + l.box.w <= ox + frame.width && l.box.y + l.box.h <= oy + frame.height)
      .map((l) => ({ text: l.text, confidence: 0.96, box: { x: l.box.x - ox, y: l.box.y - oy, w: l.box.w, h: l.box.h } }));
  };
}

const pad4 = (b: DrawnBox): DrawnBox => ({ x: b.x - 4, y: b.y - 4, w: b.w + 8, h: b.h + 8 });

test('the page reading reads the whole slide first, then tiles, and one line read twice is one line', async () => {
  const img = synthetic(1280, 720, () => [250, 250, 250]);
  const title = pad4(blockLine(img, 80, 80, [6, 4, 7], [20, 20, 20]));
  const small = pad4(blockLine(img, 700, 600, [3, 2], [20, 20, 20]));
  const calls: string[] = [];
  // The whole-slide reading misses the small line and is unsure of the title
  // (a busy slide); a tile finds the line.
  const inner = placedOcr([{ text: 'Page title here', box: title }, { text: 'tiny note', box: small }], calls);
  const ocr: FlattenedOcrV1 = async (frame, region) => {
    const lines = await inner(frame, region);
    return region.id === 'page' ? lines.filter((l) => l.text !== 'tiny note').map((l) => ({ ...l, confidence: 0.8 })) : lines;
  };
  const out = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: memorySink().sink, ocr, ocrModel: 'placed', pictureRef: 'page' });
  assert.equal(calls[0], 'page');
  assert.ok(calls.some((id) => /^page\.tile\d+$/.test(id)), 'a slide wider than a tile is read in tiles too');
  const texts = out.objects.filter((o) => o.kind === 'text').map((o) => textOf({ ...out, objects: [o] }));
  assert.deepEqual(texts.sort(), ['Page title here', 'tiny note']);
  assert.deepEqual(out.ocr, { state: 'text-found', model: 'placed' });
  validateSlide(out);
});

test('a line too long for the recogniser is read again in pieces cut between words', async () => {
  const img = synthetic(1280, 720, () => [250, 250, 250]);
  const words = [6, 5, 7, 4, 6, 5, 7, 6, 5, 7, 4, 6];
  const box = pad4(blockLine(img, 80, 300, words, [20, 20, 20]));
  const wordText = words.map((n, k) => String.fromCharCode(65 + k).repeat(n));
  const calls: string[] = [];
  // The whole line comes back squeezed (letters lost); a piece reads the words it holds.
  const ocr: FlattenedOcrV1 = async (frame, region) => {
    calls.push(region.id);
    const ox = Math.max(0, Math.floor(region.box.x));
    const oy = Math.max(0, Math.floor(region.box.y));
    if (!region.id.startsWith('page.piece')) {
      if (box.y < oy || box.x < ox || box.x + box.w > ox + frame.width) return [];
      return [{ text: 'AAAB CDD', confidence: 0.97, box: { x: box.x - ox, y: box.y - oy, w: box.w, h: box.h } }];
    }
    let cursor = 80;
    const got: string[] = [];
    let first = -1;
    let last = -1;
    words.forEach((n, k) => {
      const x0 = cursor;
      const x1 = cursor + n * 14 - 4;
      cursor += n * 14 + 16;
      if (x0 >= ox && x1 <= ox + frame.width) {
        got.push(wordText[k] ?? '');
        if (first < 0) first = x0;
        last = x1;
      }
    });
    return got.length ? [{ text: got.join(' '), confidence: 0.95, box: { x: first - ox, y: box.y - oy, w: last - first, h: box.h } }] : [];
  };
  const out = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: memorySink().sink, ocr, pictureRef: 'page' });
  assert.ok(calls.filter((id) => id === 'page.piece').length >= 2, 'the line is read in pieces');
  const text = out.objects.filter((o) => o.kind === 'text').map((o) => textOf({ ...out, objects: [o] })).join(' ');
  assert.equal(text, wordText.join(' '), 'every word comes back once, none split');
});

test('a block of the page reading takes a decision by its id: kept as a picture, or given typed text', async () => {
  const img = synthetic(1280, 720, () => [250, 250, 250]);
  const title = pad4(blockLine(img, 80, 80, [6, 4, 7], [20, 20, 20]));
  const body = pad4(blockLine(img, 80, 300, [5, 3], [20, 20, 20]));
  const ocr = placedOcr([{ text: 'Page title here', box: title }, { text: 'Body line', box: body }]);
  const kept = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: memorySink().sink, ocr, pictureRef: 'page', decisions: { t2: { keep: 'picture' } } });
  const pic = kept.objects.find((o) => o.id === 'syn.page.t2');
  assert.equal(pic?.kind, 'pic');
  assert.equal(pic?.ocr?.lines?.[0]?.text, 'Body line');
  const typed = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: memorySink().sink, ocr, pictureRef: 'page', decisions: { t2: { keep: 'text', text: 'Corrected body' } } });
  const fixed = typed.objects.find((o) => o.id === 'syn.page.t2');
  assert.equal(fixed?.kind, 'text');
  assert.equal(fixed?.text?.paras[0]?.runs.map((r) => r.text).join(''), 'Corrected body');
  assert.equal(fixed?.fidelity.reason, 'reader-approximation');
  validateSlide(typed);
});

test('text drawn inside an illustration stays that picture\'s evidence, and a corner stamp over it stays text', async () => {
  const img = synthetic(1280, 720, () => [250, 250, 250]);
  // A continuous-tone illustration holding a label, and one in the bottom right corner holding a stamp.
  const tone = (x: number, y: number): Rgb => [(x * 7 + y * 3) % 256, (x * 5 + y * 11) % 256, (x * 13 + y * 2) % 256];
  for (let y = 200; y < 500; y++) for (let x = 600; x < 1000; x++) img.data.set(tone(x, y), (y * 1280 + x) * 4);
  for (let y = 560; y < 720; y++) for (let x = 1000; x < 1280; x++) img.data.set(tone(x, y), (y * 1280 + x) * 4);
  const title = pad4(blockLine(img, 80, 80, [6, 4, 7], [20, 20, 20]));
  const label = pad4(blockLine(img, 700, 330, [4, 3], [255, 255, 255]));
  const stamp = pad4(blockLine(img, 1120, 690, [5], [255, 255, 255]));
  const ocr = placedOcr([{ text: 'Page title here', box: title }, { text: 'Upload file', box: label }, { text: 'Stamp', box: stamp }]);
  const out = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: memorySink().sink, ocr, ocrModel: 'placed', pictureRef: 'page' });
  const texts = out.objects.filter((o) => o.kind === 'text').map((o) => textOf({ ...out, objects: [o] }));
  assert.ok(!texts.includes('Upload file'), 'the label in the drawing is not slide text');
  assert.ok(texts.includes('Stamp'), 'the corner stamp is text for the census to judge');
  const drawing = out.objects.find((o) => o.kind === 'pic' && o.ocr?.lines?.some((l) => l.text === 'Upload file'));
  assert.ok(drawing, 'the label is the evidence of the picture that draws it');
  assert.equal(drawing?.ocr?.state, 'text-found');
});

test('an icon a detector boxed with its row label is cropped on its own, and the label keeps the text', async () => {
  const img = synthetic(1280, 720, () => [250, 250, 250]);
  const title = pad4(blockLine(img, 80, 80, [6, 4, 7], [20, 20, 20]));
  // A 16 px square symbol, a gap, then the word.
  for (let y = 300; y < 316; y++) for (let x = 100; x < 116; x++) img.data.set([180, 60, 60], (y * 1280 + x) * 4);
  const word = blockLine(img, 130, 300, [8], [20, 20, 20]);
  const ocr = placedOcr([{ text: 'Page title here', box: title }, { text: '\u2460 Friction', box: pad4({ x: 100, y: 300, w: word.x + word.w - 100, h: 16 }) }]);
  const out = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: memorySink().sink, ocr, pictureRef: 'page' });
  const label = out.objects.find((o) => o.kind === 'text' && textOf({ ...out, objects: [o] }) === 'Friction');
  assert.ok(label, 'the symbol read as a character is dropped from the text');
  const icon = out.objects.find((o) => o.kind === 'pic' && o.id.endsWith('.i1'));
  assert.ok(icon && Math.abs(icon.box.x - 100) <= 1 && Math.abs(icon.box.w - 16) <= 1, JSON.stringify(icon?.box));
  assert.ok(label.box.x >= 125, 'the label starts after the icon');
});

test('a typographic sign is never taken for an icon, and an icon wider than a letter before a short word is', async () => {
  const img = synthetic(1280, 720, () => [250, 250, 250]);
  const title = pad4(blockLine(img, 80, 80, [6, 4, 7], [20, 20, 20]));
  // "& Private": a 12 px sign, a clear gap, then the word; read with "&" as its own token.
  for (let y = 300; y < 316; y++) for (let x = 100; x < 112; x++) img.data.set([20, 20, 20], (y * 1280 + x) * 4);
  const amp = blockLine(img, 124, 300, [7], [20, 20, 20]);
  // An eye icon 22 px wide (1.4 line heights) before "Risk", which the recogniser read without it.
  for (let y = 400; y < 416; y++) for (let x = 100; x < 122; x++) img.data.set([180, 60, 60], (y * 1280 + x) * 4);
  const risk = blockLine(img, 132, 400, [4], [20, 20, 20]);
  const ocr = placedOcr([
    { text: 'Page title here', box: title },
    { text: '& Private', box: pad4({ x: 100, y: 300, w: amp.x + amp.w - 100, h: 16 }) },
    { text: 'Risk', box: pad4({ x: 100, y: 400, w: risk.x + risk.w - 100, h: 16 }) },
  ]);
  const out = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: memorySink().sink, ocr, pictureRef: 'page' });
  const texts = out.objects.filter((o) => o.kind === 'text');
  const sign = texts.find((o) => textOf({ ...out, objects: [o] }).includes('Private'));
  assert.equal(textOf({ ...out, objects: [sign as SourceObjectV1] }), '& Private', 'the ampersand stays in the text');
  assert.ok(sign && sign.box.x <= 101, 'the text box starts at the sign');
  const word = texts.find((o) => textOf({ ...out, objects: [o] }) === 'Risk');
  assert.ok(word && word.box.x >= 125, `"Risk" starts after its icon: ${JSON.stringify(word?.box)}`);
  const icon = out.objects.find((o) => o.kind === 'pic' && Math.abs(o.box.x - 100) <= 1 && Math.abs(o.box.y - 400) <= 1);
  assert.ok(icon && Math.abs(icon.box.w - 22) <= 1, `the eye is cropped on its own: ${JSON.stringify(out.objects.filter((o) => o.kind === 'pic').map((o) => o.box))}`);
});

/** Letters 12 px wide with 1 px between them, words 16 px apart: a cut between two letters crosses no word space. */
function tightLine(img: RgbaImageV1, x: number, y: number, words: number[], ink: Rgb): DrawnBox {
  let cursor = x;
  for (const n of words) {
    for (let k = 0; k < n; k++) {
      for (let yy = y; yy < y + 16; yy++) for (let xx = cursor; xx < cursor + 12; xx++) img.data.set(ink, (yy * img.width + xx) * 4);
      cursor += 13;
    }
    cursor += 16;
  }
  return { x, y, w: cursor - 16 - x, h: 16 };
}

test('readings of a long line join across its cuts: a cut through a word joins without a space, a letter both pieces read is kept once, and a seam\'s stroke is dropped', async () => {
  // One word far longer than the recogniser's window: every cut crosses it.
  const one = synthetic(1280, 720, () => [250, 250, 250]);
  const title = pad4(blockLine(one, 80, 80, [6, 4, 7], [20, 20, 20]));
  const word = pad4(tightLine(one, 80, 300, [40], [20, 20, 20]));
  const scripted = (whole: string, pieces: string[]): FlattenedOcrV1 => {
    let piece = 0;
    const inner = placedOcr([{ text: 'Page title here', box: title }, { text: whole, box: word }]);
    return async (frame, region) => {
      if (region.id !== 'page.piece') return inner(frame, region);
      const text = pieces[piece++] ?? '';
      return text ? [{ text, confidence: 0.95, box: { x: 0, y: word.y - Math.floor(region.box.y), w: frame.width, h: word.h } }] : [];
    };
  };
  const joined = async (pieces: string[]): Promise<string> => {
    const out = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: one, sink: memorySink().sink, ocr: scripted('squeezed', pieces), pictureRef: 'page' });
    return out.objects.filter((o) => o.kind === 'text').map((o) => textOf({ ...out, objects: [o] })).find((t) => t !== 'Page title here') ?? '';
  };
  // Three pieces (a 528 px word 24 px high, eight heights a piece), cut inside the word.
  assert.equal(await joined(['Supercalifr', 'agilisticex', 'pialidocious']), 'Supercalifragilisticexpialidocious');
  // A stroke the cut left on its own is dropped, and the halves still join.
  assert.equal(await joined(['Supercalifr I', 'agilisticex', 'pialidocious']), 'Supercalifragilisticexpialidocious');
  // Two letters both pieces read at the cut are kept once.
  assert.equal(await joined(['Supercalifrag', 'agilisticex', 'pialidocious']), 'Supercalifragilisticexpialidocious');

  // Cuts in word spaces join with a space, less a lone letter the left piece read from the next word.
  const spaced = synthetic(1280, 720, () => [250, 250, 250]);
  const title2 = pad4(blockLine(spaced, 80, 80, [6, 4, 7], [20, 20, 20]));
  const line = pad4(blockLine(spaced, 80, 300, [6, 4, 3, 4, 4, 4, 5, 4, 6, 3, 4], [20, 20, 20]));
  let piece = 0;
  const inner = placedOcr([{ text: 'Page title here', box: title2 }, { text: 'squeezed', box: line }]);
  // The third piece comes back as two readings whose boxes overlap, each reading
  // the edge between them as a stroke of its own.
  const byPiece: string[][] = [['Choose your j'], ['job keep'], ['your data I', '/ safe'], ['on'], ['this device']];
  const ocr: FlattenedOcrV1 = async (frame, region) => {
    if (region.id !== 'page.piece') return inner(frame, region);
    const texts = byPiece[piece++] ?? [];
    const y = line.y - Math.floor(region.box.y);
    const share = frame.width / texts.length;
    return texts.map((text, k) => ({ text, confidence: 0.95, box: { x: Math.max(0, k * share - 6), y, w: share + 6, h: line.h } }));
  };
  const out = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: spaced, sink: memorySink().sink, ocr, pictureRef: 'page' });
  const text = out.objects.filter((o) => o.kind === 'text').map((o) => textOf({ ...out, objects: [o] })).find((t) => t !== 'Page title here');
  assert.equal(piece, 5, 'the line was read in five pieces');
  assert.equal(text, 'Choose your job keep your data safe on this device');
});

test('the page reading keeps its recogniser calls under a cap, however thin a line box', async () => {
  const img = synthetic(1920, 1080, () => [250, 250, 250]);
  const title = pad4(blockLine(img, 80, 80, [6, 4, 7], [20, 20, 20]));
  const calls: string[] = [];
  // Hairline boxes the width of the slide: 480 pieces each if a piece were eight of their heights.
  const hairlines = Array.from({ length: 12 }, (_, k) => ({ text: `rule ${k}`, box: { x: 40, y: 300 + k * 40, w: 1800, h: 0.5 } }));
  const inner = placedOcr([{ text: 'Page title here', box: title }, ...hairlines], calls);
  const out = await reconstructFlattenedSlide({ slide: pageSlide(1920, 1080), picture: img, sink: memorySink().sink, ocr: inner, pictureRef: 'page', maxOcrCalls: 30 });
  assert.ok(calls.length <= 30, `${calls.length} calls`);
  assert.ok(calls.filter((id) => id === 'page.piece').length <= 30);
  validateSlide(out);
  const uncapped: string[] = [];
  await reconstructFlattenedSlide({ slide: pageSlide(1920, 1080), picture: img, sink: memorySink().sink, ocr: placedOcr([{ text: 'Page title here', box: title }, ...hairlines], uncapped), pictureRef: 'page' });
  assert.ok(uncapped.length <= 48, `the default cap holds: ${uncapped.length} calls`);
});

test('in the page reading, a text region the recogniser cannot read well stays a picture, whole', async () => {
  const img = synthetic(1280, 720, () => [255, 255, 255]);
  const line = blockLine(img, 200, 300, [5, 4, 6, 5, 7], [0, 0, 0]);
  // The page reading finds nothing; the region reading finds the line at a confidence under the floor.
  const ocr: FlattenedOcrV1 = async (frame, region) => (region.id.startsWith('page')
    ? []
    : [{ text: 'Revenue grew twelve percent', confidence: 0.3, box: { x: 4, y: 4, w: frame.width - 8, h: frame.height - 8 } }]);
  const out = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: memorySink().sink, ocr, ocrModel: 'low', pictureRef: 'page' });
  // The line's box ends past its last block by the 4 px gap blockLine leaves.
  const kept = out.objects.find((o) => o.kind === 'pic' && o.box.x <= line.x && o.box.x + o.box.w >= line.x + line.w - 4);
  assert.ok(kept, `the line is kept as a picture: ${JSON.stringify(out.objects.map((o) => [o.id, o.kind, o.box]))}`);
  assert.equal(kept.ocr?.state, 'text-found');
  assert.equal(kept.ocr?.lines?.[0]?.confidence, 0.3);
  assert.deepEqual(out.ocr, { state: 'text-found', model: 'low' });
  validateSlide(out);
});

test('a whole-slide reading sure of every line skips the tiles where it read them, and still reads the others', async () => {
  const img = synthetic(1280, 720, () => [250, 250, 250]);
  const title = pad4(blockLine(img, 80, 80, [6, 4, 7], [20, 20, 20]));
  const mark = pad4(blockLine(img, 1150, 690, [4, 3], [20, 20, 20]));
  const calls: string[] = [];
  // Sure of the title; the small mark in the corner it misses, a tile finds.
  const inner = placedOcr([{ text: 'Page title here', box: title }, { text: 'Made with', box: mark }], calls);
  const ocr: FlattenedOcrV1 = async (frame, region) => {
    const lines = await inner(frame, region);
    return region.id === 'page' ? lines.filter((l) => l.text !== 'Made with') : lines;
  };
  const out = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: memorySink().sink, ocr, pictureRef: 'page' });
  assert.equal(calls[0], 'page');
  // 1280 by 720 reads in five tiles across and two down, 480 px each; the
  // title's centre lies in the first two, which are not read.
  const tiles = calls.filter((id) => /^page\.tile\d+$/.test(id));
  assert.equal(tiles.includes('page.tile1'), false, tiles.join(' '));
  assert.equal(tiles.includes('page.tile2'), false, tiles.join(' '));
  assert.ok(tiles.includes('page.tile10'), 'the corner tile, where nothing was read, is read');
  assert.deepEqual(out.objects.filter((o) => o.kind === 'text').map((o) => textOf({ ...out, objects: [o] })).sort(), ['Made with', 'Page title here']);
});

test('a photograph with a title set over it is kept whole, to the slide edge, with the title painted out and counted in a warning', async () => {
  const img = synthetic(1280, 720, () => [250, 250, 250]);
  const tone = (x: number, y: number): Rgb => [(x * 7 + y * 3) % 256, (x * 5 + y * 11) % 256, (x * 13 + y * 2) % 256];
  for (let y = 0; y < 720; y++) for (let x = 0; x < 1280; x++) img.data.set(tone(x, y), (y * 1280 + x) * 4);
  // A title across the middle of a photograph the size of the slide.
  const title = pad4(blockLine(img, 80, 340, [6, 4, 7, 5], [255, 255, 255]));
  const sink = memorySink();
  const out = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: sink.sink, ocr: placedOcr([{ text: 'A title over it', box: title }]), pictureRef: 'page' });
  const warning = out.warnings.find((w) => w.code === 'nodes-truncated');
  assert.ok(warning, JSON.stringify(out.warnings));
  assert.match(warning.message, /kept whole with the text set over it painted out/);
  assert.ok((warning.count ?? 0) >= 1);
  const photo = out.objects.find((o) => o.kind === 'pic');
  assert.ok(photo?.media, 'the photograph is a picture');
  assert.deepEqual([photo.box.x, photo.box.y, photo.box.w, photo.box.h], [0, 0, 1280, 720], 'the whole photograph, not the part clear of the title');
  assert.equal(textOf(out), 'A title over it', 'the title is text over it');
  // Under the title the stored picture holds no white letters: they were painted out.
  const { decodePipelinePicture } = await import('../packages/node-shell/src/rebrand/index.ts');
  const bytes = sink.stored.get(photo.media);
  assert.ok(bytes);
  const crop = await decodePipelinePicture(bytes, 'image/png');
  assert.ok(crop);
  let white = 0;
  for (let y = title.y + 4; y < title.y + title.h - 4; y++) {
    for (let x = title.x + 4; x < title.x + title.w - 4; x++) {
      const i = (y * crop.width + x) * 4;
      if ((crop.data[i] ?? 0) > 250 && (crop.data[i + 1] ?? 0) > 250 && (crop.data[i + 2] ?? 0) > 250) white++;
    }
  }
  assert.ok(white < 10, `${white} white pixels left under the title`);
  validateSlide(out);
});

test('a region a person decided on in the page reading draws the text inside it once', async () => {
  const img = synthetic(1280, 720, () => [255, 255, 255]);
  for (let y = 200; y < 500; y++) for (let x = 100; x < 600; x++) img.data.set([30, 60, 140], (y * 1280 + x) * 4);
  const line = pad4(blockLine(img, 150, 300, [7, 4, 6, 7], [255, 255, 255]));
  const ocr = placedOcr([{ text: 'Revenue grew twelve percent', box: line }]);
  const base = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: memorySink().sink, ocr, pictureRef: 'page' });
  const panel = base.objects.find((o) => o.kind === 'shape');
  assert.ok(panel && base.objects.some((o) => o.kind === 'text'), 'the panel and its text');
  const panelId = panel.id.slice('syn.page.'.length);

  const asPicture = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: memorySink().sink, ocr, pictureRef: 'page', decisions: { [panelId]: { keep: 'picture' } } });
  assert.deepEqual(asPicture.objects.map((o) => o.kind), ['pic'], 'the panel kept whole draws its text, which is not rebuilt beside it');
  assert.equal(asPicture.objects[0]?.ocr?.lines?.[0]?.text, 'Revenue grew twelve percent');
  validateSlide(asPicture);

  const asText = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: memorySink().sink, ocr, pictureRef: 'page', decisions: { [panelId]: { keep: 'text', text: 'Revenue grew 12%' } } });
  const texts = asText.objects.filter((o) => o.kind === 'text');
  assert.equal(texts.length, 1, JSON.stringify(asText.objects.map((o) => o.id)));
  assert.equal(texts[0]?.id, `${panel.id}.text`);
  assert.equal(textOf({ ...asText, objects: texts }), 'Revenue grew 12%');
  validateSlide(asText);
});

test('a detector box padded past the picture edge is clipped, so a block kept as a picture is cropped where its slide box says', async () => {
  const img = synthetic(1280, 720, () => [250, 250, 250]);
  const title = pad4(blockLine(img, 80, 80, [6, 4, 7], [20, 20, 20]));
  blockLine(img, 1150, 690, [4, 3], [20, 20, 20]);
  const inner = placedOcr([{ text: 'Page title here', box: title }]);
  // The recogniser pads the corner line's box 30 px past the right and bottom edges.
  const ocr: FlattenedOcrV1 = async (frame, region) => {
    const lines = await inner(frame, region);
    if (!region.id.startsWith('page')) return lines;
    const ox = Math.floor(region.box.x);
    const oy = Math.floor(region.box.y);
    if (ox > 1150 || oy > 690 || ox + frame.width < 1210 || oy + frame.height < 706) return lines;
    return [...lines, { text: 'Made with', confidence: 0.95, box: { x: 1146 - ox, y: 686 - oy, w: 1310 - 1146, h: 750 - 686 } }];
  };
  const out = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: memorySink().sink, ocr, pictureRef: 'page', decisions: { t2: { keep: 'picture' } } });
  const kept = out.objects.find((o) => o.id === 'syn.page.t2');
  assert.equal(kept?.kind, 'pic');
  assert.ok(kept && kept.box.x + kept.box.w <= 1280 && kept.box.y + kept.box.h <= 720, JSON.stringify(kept?.box));
  validateSlide(out);
});

test('a card shaded rather than filled is found by its edge and rebuilt as a rectangle holding its icon and label', async () => {
  // A page in waves of green (no one colour and no smooth surface is its
  // ground, so the colour finder sees one picture as large as the slide, as on
  // a generated slide), and a card on it shaded top to bottom with a darker
  // shadow along its edge, holding an icon over a white label.
  const wave = (x: number, y: number): number => Math.round(60 * (0.5 + 0.5 * Math.sin(x / 70 + y / 110)));
  const img = synthetic(1280, 720, (x, y) => [20 + wave(x, y), 70 + 2 * wave(x, y), 50 + wave(x, y)]);
  for (let y = 200; y < 560; y++) for (let x = 120; x < 400; x++) img.data.set([10 + Math.round((y - 200) / 8), 40 + Math.round((y - 200) / 6), 30 + Math.round((y - 200) / 8)], (y * 1280 + x) * 4);
  for (let y = 560; y < 566; y++) for (let x = 124; x < 406; x++) img.data.set([4, 12, 8], (y * 1280 + x) * 4);
  for (let y = 204; y < 566; y++) for (let x = 400; x < 406; x++) img.data.set([4, 12, 8], (y * 1280 + x) * 4);
  // The icon: a ring 60 px across, centred over the label under it.
  for (let y = 280; y < 340; y++) for (let x = 230; x < 290; x++) {
    const d = Math.hypot(x - 260, y - 310);
    if (d > 22 && d < 30) img.data.set([190, 240, 210], (y * 1280 + x) * 4);
  }
  const title = pad4(blockLine(img, 80, 80, [6, 4, 7], [250, 250, 250]));
  const label = pad4(blockLine(img, 200, 400, [8], [250, 250, 250]));
  const ocr = placedOcr([{ text: 'Page title here', box: title }, { text: 'Everyday', box: label }]);
  const out = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: memorySink().sink, ocr, pictureRef: 'page' });
  const card = out.objects.find((o) => o.id === 'syn.page.c1');
  assert.ok(card, `a card panel: ${JSON.stringify(out.objects.map((o) => [o.id, o.kind, o.box]))}`);
  assert.equal(card.kind, 'shape');
  assert.ok(Math.abs(card.box.x - 120) <= 8 && Math.abs(card.box.x + card.box.w - 400) <= 8, JSON.stringify(card.box));
  assert.ok(Math.abs(card.box.y - 200) <= 8 && Math.abs(card.box.y + card.box.h - 560) <= 8, JSON.stringify(card.box));
  const held = out.objects.filter((o) => o.groupPath?.[0] === card.id).map((o) => o.kind).sort();
  assert.deepEqual(held, ['pic', 'shape', 'text'], 'the panel holds the icon and the label');
  validateSlide(out);
});

test('a word in a slide corner with a mark just before it is kept as one logo picture', async () => {
  const img = synthetic(1280, 720, () => [20, 50, 42]);
  const title = pad4(blockLine(img, 80, 80, [6, 4, 7], [250, 250, 250]));
  // A mark 24 px square, then "SUSE" 16 px high, in the bottom left corner.
  for (let y = 668; y < 692; y++) for (let x = 40; x < 64; x++) img.data.set([90, 200, 130], (y * 1280 + x) * 4);
  const word = pad4(blockLine(img, 76, 672, [4], [240, 250, 245]));
  const ocr = placedOcr([{ text: 'Page title here', box: title }, { text: 'SUSE', box: word }]);
  const out = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: memorySink().sink, ocr, ocrModel: 'placed', pictureRef: 'page' });
  const texts = out.objects.filter((o) => o.kind === 'text').map((o) => textOf({ ...out, objects: [o] }));
  assert.deepEqual(texts, ['Page title here'], 'the logo word is not rebuilt as text');
  const logo = out.objects.find((o) => o.kind === 'pic' && o.box.x <= 41 && o.box.x + o.box.w >= 120);
  assert.ok(logo, JSON.stringify(out.objects.map((o) => [o.id, o.kind, o.box])));
  assert.equal(logo.ocr?.lines?.[0]?.text, 'SUSE', 'the word read is the logo picture\'s evidence');
  validateSlide(out);
});

// ─── WP10 part B: emphasis, soft panels, text at an angle ────────────────────

/** A stand-in recogniser like `placedOcr`, each line at its own confidence. */
function unsureOcr(lines: Array<{ text: string; box: DrawnBox; confidence: number }>): FlattenedOcrV1 {
  return async (frame, region) => {
    const pad = region.id.startsWith('page') ? 0 : 4;
    const ox = Math.max(0, Math.floor(region.box.x - pad));
    const oy = Math.max(0, Math.floor(region.box.y - pad));
    return lines
      .filter((l) => l.box.x >= ox && l.box.y >= oy && l.box.x + l.box.w <= ox + frame.width && l.box.y + l.box.h <= oy + frame.height)
      .map((l) => ({ text: l.text, confidence: l.confidence, box: { x: l.box.x - ox, y: l.box.y - oy, w: l.box.w, h: l.box.h } }));
  };
}

test('a word drawn in another colour, or with wider stems, is a run of its own in its line', async () => {
  const img = synthetic(1280, 720, () => [31, 90, 62]);
  // "Meet Lolly now" white, "now" mint; below, "Meet Lolly now" white with "Lolly" in wider stems.
  const letter = (x: number, y: number, w: number, ink: Rgb): void => {
    for (let yy = y; yy < y + 24; yy++) for (let xx = x; xx < x + w; xx++) img.data.set(ink, (yy * 1280 + xx) * 4);
  };
  const lineAt = (y: number, style: (word: number) => { ink: Rgb; stem: number }): DrawnBox => {
    let x = 200;
    [4, 5, 3].forEach((n, word) => {
      for (let k = 0; k < n; k++) {
        const { ink, stem } = style(word);
        letter(x, y, stem, ink);
        x += stem + 4;
      }
      x += 14;
    });
    return { x: 192, y: y - 8, w: x - 192, h: 40 };
  };
  const white: Rgb = [252, 254, 253];
  const coloured = lineAt(200, (word) => ({ ink: word === 2 ? [179, 234, 203] : white, stem: 6 }));
  const heavy = lineAt(400, (word) => ({ ink: white, stem: word === 1 ? 11 : 5 }));
  const ocr = unsureOcr([
    { text: 'Meet Lolly now', box: coloured, confidence: 0.97 },
    { text: 'Meet Lolly now', box: heavy, confidence: 0.97 },
  ]);
  const out = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: memorySink().sink, ocr, pictureRef: 'page' });
  const runsOf = (y: number) => out.objects
    .filter((o) => o.kind === 'text' && Math.abs(o.box.y - y) < 20)
    .flatMap((o) => o.text?.paras ?? [])
    .flatMap((p) => p.runs)
    .map((r) => [r.text.trim(), r.color?.hex ?? '', r.bold === true] as const);
  const first = runsOf(192);
  assert.deepEqual(first.map((r) => r[0]), ['Meet Lolly', 'now'], JSON.stringify(first));
  assert.notEqual(first[0]?.[1], first[1]?.[1], 'the last word keeps its own colour');
  const second = runsOf(392);
  assert.deepEqual(second.map((r) => [r[0], r[2]]), [['Meet', false], ['Lolly', true], ['now', false]], JSON.stringify(second));
  validateSlide(out);
});

test('a soft card under a title and its body is found by its edge and holds them both', async () => {
  // Waves of green (a photograph stand-in), and a pale card on it, graded top
  // to bottom with no one fill, holding a title and a body line.
  const wave = (x: number, y: number): number => Math.round(60 * (0.5 + 0.5 * Math.sin(x / 70 + y / 110)));
  const img = synthetic(1280, 720, (x, y) => [20 + wave(x, y), 70 + 2 * wave(x, y), 50 + wave(x, y)]);
  for (let y = 200; y < 330; y++) for (let x = 440; x < 760; x++) img.data.set([90 + Math.round((y - 200) / 8), 170 + Math.round((y - 200) / 10), 140 + Math.round((y - 200) / 8)], (y * 1280 + x) * 4);
  const title = pad4(blockLine(img, 500, 240, [5], [252, 255, 254]));
  const body = pad4(blockLine(img, 490, 266, [4, 5, 3], [240, 255, 250]));
  const ocr = placedOcr([{ text: 'LOLLY', box: title }, { text: 'Meet Lolly now', box: body }]);
  const out = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: memorySink().sink, ocr, pictureRef: 'page' });
  const card = out.objects.find((o) => o.kind === 'shape' && /\.s\d+$/.test(o.id));
  assert.ok(card, `a soft panel: ${JSON.stringify(out.objects.map((o) => [o.id, o.kind, o.box]))}`);
  assert.ok(Math.abs(card.box.x - 440) <= 10 && Math.abs(card.box.x + card.box.w - 760) <= 10, JSON.stringify(card.box));
  assert.ok(Math.abs(card.box.y - 200) <= 10 && Math.abs(card.box.y + card.box.h - 330) <= 10, JSON.stringify(card.box));
  const held = out.objects.filter((o) => o.kind === 'text' && o.groupPath?.includes(card.id)).map((o) => textOf({ ...out, objects: [o] }));
  assert.equal(held.join(' ').replace(/\s+/g, ' '), 'LOLLY Meet Lolly now', 'every line on the card is in it');
  assert.equal(out.objects.filter((o) => o.kind === 'text' && !o.groupPath?.includes(card.id)).length, 0);
  validateSlide(out);
});

test('text set at an angle inside a picture, read unsure and boxed tall, stays part of the picture with the reason', async () => {
  const img = synthetic(1280, 720, () => [14, 50, 43]);
  // A picture on the left: a teal arrow rising at 45 degrees with light words along it.
  for (let k = 0; k < 300; k++) for (let t = 0; t < 36; t++) {
    const x = 120 + k + t;
    const y = 560 - k + t;
    img.data.set(t > 12 && t < 24 && k % 12 < 8 ? [230, 250, 240] : [40, 140, 130], (y * 1280 + x) * 4);
  }
  const title = pad4(blockLine(img, 760, 120, [6, 4, 7], [250, 252, 250]));
  const body = pad4(blockLine(img, 760, 200, [5, 3, 6, 4], [240, 245, 240]));
  const ocr = unsureOcr([
    { text: 'The page title', box: title, confidence: 0.98 },
    { text: 'The body of the page', box: body, confidence: 0.97 },
    // The recogniser reads the words along the arrow level, unsure, in a tall box.
    { text: 'C', box: { x: 200, y: 330, w: 150, h: 150 }, confidence: 0.2 },
  ]);
  const out = await reconstructFlattenedSlide({ slide: pageSlide(1280, 720), picture: img, sink: memorySink().sink, ocr, pictureRef: 'page' });
  const warning = out.warnings.find((w) => /at an angle/.test(w.message));
  assert.ok(warning, JSON.stringify(out.warnings));
  assert.match(warning.message, /stays part of the picture/);
  const holder = out.objects.find((o) => warning.objectIds?.includes(o.id));
  assert.equal(holder?.kind, 'pic', 'the picture holding the text is named');
  assert.equal(textOf(out).includes('C'), false, 'the unsure reading is not rebuilt as text');
  validateSlide(out);
});
