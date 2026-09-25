// SPDX-License-Identifier: MPL-2.0
/**
 * The node pipeline reading PDFs and rebuilding flattened slides
 * (`packages/node-shell/src/rebrand/pipeline.ts`, plan 274 sections 3.1, 6 and
 * 9 "Flattened").
 *
 * `readDeck` and `planDeck` choose the reader from the bytes: a pptx as before,
 * a PDF through `sourceDeckFromPdf` with the pure node codec. A slide the source
 * marks flattened is rebuilt from its regions when an OCR runner is passed, and
 * kept as one picture with its OCR state `not-run` when none is.
 *
 * The OCR here is a stub that reads the five by seven bitmap face
 * `scripts/build-rebrand-fixtures.ts` paints the titles of `flattened.pdf` with
 * (the table is a copy of the builder's), so the recovery check is a test of the
 * pipeline, the region finding and the typesetting rather than of a model.
 *
 * Census and plan rules change under this file, so it asserts structure and
 * accounting, never the counts the census produces.
 *
 * One case is gated on the maintainer's private corpus (`LOLLY_REBRAND_FIXTURES`)
 * and skips by name without it: it runs every corpus PDF and
 * `Lolly_Strategic_Vision.pptx` through the rebuild and prints the time per
 * slide, the regions found and the text objects rebuilt, with the real node OCR
 * when its model is on this machine.
 *
 * Run with: node --test "tests/rebrand-node-pdf.test.ts"
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import Ajv from 'ajv/dist/2020.js';
import { zlibSync } from 'fflate';

import { findSlideRegions } from '../engine/src/slide-regions.ts';
import type { OcrLine } from '../packages/core/src/host-v1.ts';
import type { RenovationPlanV1, SlideSourceV1, SourceDeckV1, SourceObjectV1 } from '../packages/core/src/rebrand-v1.ts';
import {
  RebrandPipelineError,
  compileDeck,
  decodePipelinePicture,
  flattenedReadOfPlan,
  mediaRefFor,
  nodeFlattenedOcr,
  planDeck,
  pictureDimensions,
  planSourceProblems,
  readDeck,
  type FlattenedOcrV1,
  type PlanDeckResultV1,
} from '../packages/node-shell/src/rebrand/index.ts';
import { privateCorpus, skipReason } from './helpers/rebrand-fixtures.ts';
import { buildProbePdf, partialScanProbe } from '../scripts/build-rebrand-pdf-fixtures.ts';
import { STARTER_DESIGN_SYSTEM, parsePipelineXml } from './helpers/rebrand-pipeline.ts';

const EDITABLE = new URL('./fixtures/rebrand-pdf/editable.pdf', import.meta.url);
const EDITABLE_LABELS = new URL('./fixtures/rebrand-pdf/editable.labels.json', import.meta.url);
const FLATTENED = new URL('./fixtures/rebrand/flattened.pdf', import.meta.url);
const FLATTENED_LABELS = new URL('./fixtures/rebrand/flattened.labels.json', import.meta.url);
const INSTANCE = 'rebrand-node-pdf';

const read = (url: URL): Uint8Array => new Uint8Array(readFileSync(url));

// ─── labels ──────────────────────────────────────────────────────────────────

interface LabelObject {
  id: string;
  origin: string;
  text?: string;
}

/** Each labelled slide's objects, read field by field so a changed file fails here by name. */
function labelObjects(url: URL): Map<string, LabelObject[]> {
  const raw: unknown = JSON.parse(readFileSync(url, 'utf8'));
  assert.ok(raw && typeof raw === 'object' && 'slides' in raw && Array.isArray(raw.slides), `${url.pathname} has slides`);
  const slides: unknown[] = raw.slides;
  const out = new Map<string, LabelObject[]>();
  for (const slide of slides) {
    assert.ok(slide && typeof slide === 'object');
    const objects = Reflect.get(slide, 'objects');
    assert.ok(Array.isArray(objects));
    out.set(String(Reflect.get(slide, 'id')), objects.map((object: unknown) => {
      assert.ok(object && typeof object === 'object');
      const text = Reflect.get(object, 'text');
      const one: LabelObject = { id: String(Reflect.get(object, 'id')), origin: String(Reflect.get(object, 'origin')) };
      if (typeof text === 'string') one.text = text;
      return one;
    }));
  }
  return out;
}

// ─── the stub OCR ────────────────────────────────────────────────────────────

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

// ─── helpers ─────────────────────────────────────────────────────────────────

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

const textOf = (slide: SlideSourceV1): string =>
  slide.objects
    .filter((o) => o.kind === 'text')
    .flatMap((o) => o.text?.paras ?? [])
    .map((p) => p.runs.map((r) => r.text).join(''))
    .join('\n');

const objectsOf = (deck: SourceDeckV1): SourceObjectV1[] => deck.slides.flatMap((slide) => slide.objects);
const refsOf = (deck: SourceDeckV1): string[] => objectsOf(deck).flatMap((o) => (o.media ? [o.media] : []));

const validateDeck = (() => {
  const schema: unknown = JSON.parse(readFileSync(new URL('../schemas/rebrand-source-v1.schema.json', import.meta.url), 'utf8'));
  assert.ok(schema && typeof schema === 'object' && !Array.isArray(schema), 'the source schema is a JSON object');
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  return (deck: SourceDeckV1): void => {
    const doc: unknown = deck;
    if (!validate(doc)) {
      const errors = (validate.errors ?? []).slice(0, 8).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`).join('; ');
      assert.fail(`${deck.source.name ?? 'the deck'} failed the source schema: ${errors}`);
    }
  };
})();

/** Every held picture is named by an object, a recovery picture or a slide ground: nothing is held for nobody. */
function assertMediaReferenced(read: { source: SourceDeckV1; media: ReadonlyMap<string, unknown> }): void {
  const named = new Set(refsOf(read.source));
  for (const slide of read.source.slides) {
    if (slide.recovery) named.add(slide.recovery.assetRef);
    if (slide.background.media) named.add(slide.background.media);
  }
  assert.deepEqual([...read.media.keys()].filter((ref) => !named.has(ref)), [], 'every held picture is named');
}

/** Every source object has exactly one plan row on its own slide, and every plan row names a source object. */
function assertPlanAccounts(planned: { source: SourceDeckV1; plan: RenovationPlanV1 }): void {
  assert.deepEqual(planSourceProblems(planned.plan, planned.source), [], 'the plan fits its source one to one');
  const rows = planned.plan.slides.flatMap((slide) => slide.objects.map((row) => row.id)).sort();
  assert.deepEqual(rows, objectsOf(planned.source).map((o) => o.id).sort());
}

/** The compile's report reaches one disposition per source object, id for id. */
async function assertCompileAccounts(planned: PlanDeckResultV1): Promise<void> {
  const { compiled, report } = await compileDeck({ source: planned.source, census: planned.census, plan: planned.plan, system: planned.system });
  const ids = objectsOf(planned.source).map((o) => o.id).sort();
  const dispositions = report.entries.filter((entry) => entry.disposition);
  assert.equal(dispositions.length, ids.length, 'one disposition per source object, no more and no fewer');
  assert.deepEqual(dispositions.map((entry) => String(entry.objectId)).sort(), ids);
  const counted = Object.values(report.counts.objects).reduce((sum, n) => sum + n, 0);
  assert.equal(counted, ids.length, 'the disposition counts add up to the source objects');
  assert.equal(compiled.source.hash, planned.source.source.hash);
  assert.ok(compiled.frames.length > 0, 'the compiled deck has frames');
}

const planOf = (bytes: Uint8Array, name: string, extra: Partial<Parameters<typeof planDeck>[0]> = {}): Promise<PlanDeckResultV1> =>
  planDeck({ bytes, name, parseXml: parsePipelineXml, system: STARTER_DESIGN_SYSTEM, instanceId: INSTANCE, ...extra });

// ─── an editable PDF ─────────────────────────────────────────────────────────

test('planDeck reads an editable PDF: every object has one plan row, and the artifacts keep origin pdf-artifact', async () => {
  const planned = await planOf(read(EDITABLE), 'editable.pdf');
  assert.equal(planned.source.source.kind, 'pdf');
  assert.match(planned.plan.algorithms.reader, /^pdf-read\//, 'the plan names the PDF reader');
  assert.deepEqual(planned.flattened, [], 'an editable PDF has no flattened slide');
  validateDeck(planned.source);
  assertPlanAccounts(planned);

  const byId = new Map(objectsOf(planned.source).map((o) => [o.id, o] as const));
  const labels = [...labelObjects(EDITABLE_LABELS).values()].flat();
  const artifacts = labels.filter((label) => label.origin === 'pdf-artifact');
  assert.ok(artifacts.length > 0, 'the fixture labels header and footer artifacts');
  for (const label of artifacts) {
    assert.equal(byId.get(label.id)?.origin, 'pdf-artifact', `${label.id} keeps its artifact origin`);
  }
  for (const label of labels.filter((one) => one.origin === 'slide')) {
    assert.equal(byId.get(label.id)?.origin, 'slide', `${label.id} is the page's own object`);
  }
  // Pictures are held under their content hash.
  assert.ok(planned.media.size > 0, 'the editable PDF holds a picture');
  for (const ref of refsOf(planned.source)) assert.ok(planned.media.has(ref), `${ref} is held`);
});

test('compileDeck over an editable PDF accounts for every object', async () => {
  await assertCompileAccounts(await planOf(read(EDITABLE), 'editable.pdf'));
});

// ─── a flattened PDF ─────────────────────────────────────────────────────────

test('with a stub OCR, the flattened PDF is rebuilt: titles by trigram containment above 0.9, recovery picture kept', async () => {
  const bytes = read(FLATTENED);
  const kept = await readDeck({ bytes, name: 'flattened.pdf', parseXml: parsePipelineXml, instanceId: INSTANCE });
  const planned = await planOf(bytes, 'flattened.pdf', { ocr: bitmapOcr, ocrModel: 'bitmap-stub' });
  const labels = labelObjects(FLATTENED_LABELS);
  assert.equal(planned.source.slides.length, labels.size);
  assert.equal(planned.flattened.length, planned.source.slides.length, 'one report per flattened slide');
  validateDeck(planned.source);

  for (const [i, slide] of planned.source.slides.entries()) {
    const title = labels.get(slide.id)?.[0]?.text ?? '';
    assert.ok(title, `${slide.id} has a labelled title`);
    const score = containment(title, textOf(slide));
    assert.ok(score > 0.9, `${slide.id}: ${JSON.stringify(textOf(slide))} against ${title} scored ${score}`);

    // The picture it was is gone from the objects and kept as the recovery picture.
    const before = kept.source.slides[i];
    const original = before?.objects[0];
    assert.ok(before && original?.media, `${slide.id} read as one stored picture without OCR`);
    assert.equal(slide.origin.flattened, true);
    assert.ok(!slide.objects.some((o) => o.id === original.id), 'the whole-slide picture is no longer an object');
    assert.deepEqual(slide.recovery, { assetRef: original.media, fromObjectId: original.id });
    assert.ok(planned.media.has(original.media), 'the recovery picture is held');
    assert.deepEqual(slide.ocr, { state: 'text-found', model: 'bitmap-stub' });

    const text = slide.objects.filter((o) => o.kind === 'text');
    assert.ok(text.length > 0);
    for (const object of text) {
      assert.equal(object.origin, 'raster-region');
      assert.deepEqual(object.fidelity, { state: 'approximate', reason: 'ocr-estimate' });
      assert.equal(object.ocr?.state, 'text-found');
    }
    for (const object of slide.objects) {
      assert.equal(object.origin, 'raster-region', `${object.id} comes from the picture`);
      if (object.media) assert.ok(planned.media.has(object.media), `${object.media} is held`);
    }

    const report = planned.flattened[i];
    assert.ok(report);
    assert.equal(report.slideId, slide.id);
    assert.equal(report.outcome, 'rebuilt');
    assert.equal(report.reason, undefined);
    assert.equal(report.ocr, 'text-found');
    assert.equal(report.recovery, original.media);
    assert.equal(report.replaced, original.id, 'the report names the picture object the regions replaced');
    assert.equal(report.objects.text, text.length);
    assert.ok(report.ms >= 0);
  }
  assertMediaReferenced(planned);
  assertPlanAccounts(planned);
});

test('a scan placed on a page at 70 percent is rebuilt, and its report names the picture it replaced', async () => {
  const bytes = await buildProbePdf([partialScanProbe().page]);
  const result = await readDeck({ bytes, name: 'partial.pdf', parseXml: parsePipelineXml, instanceId: INSTANCE, flattened: 'rebuild' });
  const slide = result.source.slides[0]!;
  const report = result.flattened[0]!;
  assert.equal(slide.origin.flattened, true);
  assert.equal(report.outcome, 'rebuilt', `kept as ${report.reason ?? ''}`);
  assert.equal(report.replaced, slide.recovery?.fromObjectId);
  assert.equal(report.replaced, 'page1.0');
  assert.ok(!slide.objects.some((o) => o.id === report.replaced), 'the replaced picture is no longer an object');
  assert.ok(report.objects.shape >= 1, 'the paper under the regions is a rectangle');
  validateDeck(result.source);
});

test('with no OCR, the flattened slides stay pictures with OCR not run', async () => {
  const planned = await planOf(read(FLATTENED), 'flattened.pdf');
  validateDeck(planned.source);
  assert.equal(planned.flattened.length, planned.source.slides.length);
  for (const [i, slide] of planned.source.slides.entries()) {
    assert.equal(slide.origin.flattened, true);
    assert.equal(slide.objects.length, 1, `${slide.id} is one object`);
    const pic = slide.objects[0];
    assert.equal(pic?.kind, 'pic');
    assert.equal(pic?.ocr?.state, 'not-run');
    assert.deepEqual(slide.ocr, { state: 'not-run' });
    assert.equal(slide.recovery, undefined, 'nothing was cut, so there is nothing to recover');
    assert.deepEqual(planned.flattened[i], {
      slideId: slide.id,
      outcome: 'kept',
      reason: 'asked',
      ocr: 'not-run',
      objects: { text: 0, pic: 0, shape: 0 },
      ms: planned.flattened[i]?.ms,
    });
  }
  assertPlanAccounts(planned);
});

test('rebuild without OCR cuts the regions and every text region stays a picture that says OCR was not run', async () => {
  const planned = await planOf(read(FLATTENED), 'flattened.pdf', { flattened: 'rebuild' });
  for (const slide of planned.source.slides) {
    assert.equal(slide.objects.filter((o) => o.kind === 'text').length, 0);
    for (const pic of slide.objects.filter((o) => o.kind === 'pic')) assert.equal(pic.ocr?.state, 'not-run');
    assert.deepEqual(slide.ocr, { state: 'not-run' });
    assert.ok(slide.recovery, 'the whole-slide picture is kept');
  }
  assert.ok(planned.flattened.every((report) => report.outcome === 'rebuilt' && report.ocr === 'not-run'));
});

test('a flattened slide whose picture this host cannot decode stays one picture and says why', async () => {
  const planned = await planOf(read(FLATTENED), 'flattened.pdf', { ocr: bitmapOcr, decodePicture: async () => null });
  for (const [i, slide] of planned.source.slides.entries()) {
    assert.equal(slide.objects.length, 1);
    assert.ok(slide.warnings.some((w) => w.code === 'nodes-truncated' && w.objectIds?.[0] === slide.objects[0]?.id));
    assert.equal(planned.flattened[i]?.outcome, 'kept');
    assert.equal(planned.flattened[i]?.reason, 'undecodable');
  }
});

test('an OCR runner that throws keeps the slide a picture instead of failing the deck', async () => {
  const broken: FlattenedOcrV1 = async () => {
    throw new Error('the recogniser stopped');
  };
  const planned = await planOf(read(FLATTENED), 'flattened.pdf', { ocr: broken });
  for (const report of planned.flattened) {
    assert.equal(report.outcome, 'kept');
    assert.equal(report.reason, 'failed');
  }
  for (const slide of planned.source.slides) {
    assert.ok(slide.warnings.some((w) => /the recogniser stopped/.test(w.message)));
    assert.equal(slide.recovery, undefined, 'nothing was cut');
  }
  // The crops made before the recogniser stopped are not held.
  assertMediaReferenced(planned);
  const kept = await planOf(read(FLATTENED), 'flattened.pdf');
  assert.deepEqual([...planned.media.keys()].sort(), [...kept.media.keys()].sort());
  assertPlanAccounts(planned);
});

test('compileDeck over the rebuilt and the kept flattened PDF accounts for every object', async () => {
  const bytes = read(FLATTENED);
  await assertCompileAccounts(await planOf(bytes, 'flattened.pdf', { ocr: bitmapOcr }));
  await assertCompileAccounts(await planOf(bytes, 'flattened.pdf'));
});

// ─── determinism ─────────────────────────────────────────────────────────────

test('refs are the content hash and two runs agree, rebuilt crops included', async () => {
  for (const [url, name] of [[EDITABLE, 'editable.pdf'], [FLATTENED, 'flattened.pdf']] as const) {
    const bytes = read(url);
    const one = await planOf(bytes, name, { ocr: bitmapOcr });
    const two = await planOf(bytes, name, { ocr: bitmapOcr });
    assert.deepEqual([...one.media.keys()].sort(), [...two.media.keys()].sort(), `${name}: the same refs`);
    for (const [ref, held] of one.media) {
      const { createHash } = await import('node:crypto');
      assert.equal(ref, mediaRefFor(createHash('sha256').update(held.bytes).digest('hex')), `${name}: ${ref} is its bytes' hash`);
    }
    assert.deepEqual(one.source, two.source, `${name}: the same source deck`);
    assert.deepEqual(one.plan, two.plan, `${name}: the same plan`);
    for (const ref of refsOf(one.source)) assert.ok(one.media.has(ref), `${name}: ${ref} is held`);
    for (const slide of one.source.slides) if (slide.recovery) assert.ok(one.media.has(slide.recovery.assetRef));
  }
});

// ─── refusals ────────────────────────────────────────────────────────────────

/**
 * A PDF written object by object with true offsets: the objects, then a
 * cross-reference table and trailer, or a cross-reference stream whose
 * dictionary holds the trailer entries. `pad` more free entries make that
 * stream's data long, so its dictionary is far from the end of the file.
 */
function builtPdf(objects: string[], opts: { trailer?: string; xref?: 'table' | 'stream'; pad?: number; prefix?: string } = {}): Uint8Array {
  const latin1 = (text: string): number[] => Array.from(text, (ch) => ch.charCodeAt(0));
  const out: number[] = latin1(`${opts.prefix ?? ''}%PDF-1.7\n`);
  const base = (opts.prefix ?? '').length;
  const offsets: number[] = [];
  for (const [i, body] of objects.entries()) {
    offsets.push(out.length - base);
    out.push(...latin1(`${i + 1} 0 obj\n${body}\nendobj\n`));
  }
  const extra = opts.trailer ?? '';
  const xrefAt = out.length - base;
  if ((opts.xref ?? 'table') === 'table') {
    const rows = ['0000000000 65535 f \n', ...offsets.map((at) => `${String(at).padStart(10, '0')} 00000 n \n`)];
    out.push(...latin1(`xref\n0 ${rows.length}\n${rows.join('')}trailer\n<< /Size ${rows.length} /Root 1 0 R ${extra} >>\nstartxref\n${xrefAt}\n%%EOF\n`));
  } else {
    const size = objects.length + 2 + (opts.pad ?? 0);
    const entry = (type: number, field: number, gen: number): number[] =>
      [type, (field >>> 24) & 255, (field >>> 16) & 255, (field >>> 8) & 255, field & 255, (gen >>> 8) & 255, gen & 255];
    const data = [...entry(0, 0, 65535), ...offsets.flatMap((at) => entry(1, at, 0)), ...entry(1, xrefAt, 0)];
    while (data.length < size * 7) data.push(...entry(0, 0, 0));
    out.push(...latin1(`${objects.length + 1} 0 obj\n<< /Type /XRef /Size ${size} /W [1 4 2] /Root 1 0 R ${extra} /Length ${data.length} >>\nstream\n`));
    out.push(...data, ...latin1(`\nendstream\nendobj\nstartxref\n${xrefAt}\n%%EOF\n`));
  }
  return Uint8Array.from(out);
}

/** One blank page, with `content` as its page description. */
const onePage = (content: string): string[] => [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>',
  `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
];
const ENCRYPT_DICT = '<< /Filter /Standard /V 2 /R 3 /Length 128 /P -3904 /O <00> /U <00> >>';

const codeOf = async (bytes: Uint8Array): Promise<string> => {
  try {
    await readDeck({ bytes, name: 'x', parseXml: parsePipelineXml });
  } catch (err) {
    assert.ok(err instanceof RebrandPipelineError);
    return err.code;
  }
  return 'no error';
};

test('an encrypted PDF is refused as source.encrypted by its trailer, and a file that is neither format as source.unreadable', async () => {
  const table = builtPdf([...onePage('0 0 m'), ENCRYPT_DICT], { trailer: '/Encrypt 5 0 R' });
  assert.equal(await codeOf(table), 'source.encrypted', 'a cross-reference table trailer names /Encrypt');

  // The trailer entries in a cross-reference stream's dictionary, with over 64 KB
  // of objects before them and of cross-reference data after them.
  const filler = `<< /Length 70000 >>\nstream\n${'x'.repeat(70_000)}\nendstream`;
  const stream = builtPdf([...onePage('0 0 m'), ENCRYPT_DICT, filler], { trailer: '/Encrypt 5 0 R', xref: 'stream', pad: 12_000 });
  const dictAt = new TextDecoder('latin1').decode(stream).lastIndexOf('/Encrypt');
  assert.ok(dictAt > 64 * 1024 && stream.length - dictAt > 64 * 1024, 'the /Encrypt entry is more than 64 KB from either end');
  assert.equal(await codeOf(stream), 'source.encrypted', 'a cross-reference stream dictionary names /Encrypt');

  try {
    await readDeck({ bytes: table, name: 'restricted.pdf', parseXml: parsePipelineXml });
    assert.fail('an encrypted PDF is refused');
  } catch (err) {
    assert.ok(err instanceof RebrandPipelineError);
    assert.match(err.message, /encrypted PDF/);
    assert.match(err.message, /without a password/, 'the message covers a file encrypted only to restrict it');
  }

  assert.equal(await codeOf(new TextEncoder().encode('%PDF-1.7\nnothing here')), 'source.unreadable');
  assert.equal(await codeOf(new TextEncoder().encode('GIF89a not a deck')), 'source.unreadable');
});

test('the words /Encrypt 1 0 R inside a page or a stream do not make a PDF encrypted', async () => {
  const words = '% a page about PDF security: /Encrypt 1 0 R\n0 0 m';
  for (const xref of ['table', 'stream'] as const) {
    const bytes = builtPdf(onePage(words), { xref });
    assert.equal(await codeOf(bytes), 'no error', `${xref}: the file reads`);
  }
});

test('a PDF with bytes before its header is read as a PDF', async () => {
  const plain = read(FLATTENED);
  const prefixed = Uint8Array.from([...new TextEncoder().encode('junk from a mail gateway\r\n'), ...plain]);
  const one = await readDeck({ bytes: plain, name: 'flattened.pdf', parseXml: parsePipelineXml, instanceId: INSTANCE });
  const two = await readDeck({ bytes: prefixed, name: 'flattened.pdf', parseXml: parsePipelineXml, instanceId: INSTANCE });
  assert.equal(two.source.source.kind, 'pdf');
  assert.equal(two.source.slides.length, one.source.slides.length);
  // A prefixed file that is encrypted is still refused.
  const table = builtPdf([...onePage('0 0 m'), ENCRYPT_DICT], { trailer: '/Encrypt 5 0 R', prefix: 'junk\n' });
  assert.equal(await codeOf(table), 'source.encrypted');
});

// ─── pictures too large to decode ────────────────────────────────────────────

/** A PNG header claiming `width` by `height`, with a few bytes of image data that are never read. */
function claimedPng(width: number, height: number): Uint8Array {
  const u32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const chunk = (type: string, body: number[]): number[] => [...u32(body.length), ...Array.from(type, (ch) => ch.charCodeAt(0)), ...body, 0, 0, 0, 0];
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...chunk('IHDR', [...u32(width), ...u32(height), 8, 6, 0, 0, 0]),
    ...chunk('IDAT', [0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01]),
    ...chunk('IEND', []),
  ]);
}

test('pictureDimensions reads the size from the header alone', () => {
  assert.deepEqual(pictureDimensions(claimedPng(30_000, 30_000)), { width: 30_000, height: 30_000 });
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03]);
  assert.deepEqual(pictureDimensions(jpeg), { width: 800, height: 600 });
  const gif = Uint8Array.from([...new TextEncoder().encode('GIF89a'), 0x40, 0x01, 0xf0, 0x00]);
  assert.deepEqual(pictureDimensions(gif), { width: 320, height: 240 });
  assert.equal(pictureDimensions(new TextEncoder().encode('<svg width="99999" height="99999"/>')), null, 'a format without a pixel header has no size here');
});

test('decodePipelinePicture decodes nothing over the pixel limit, and image data that expands past its header stays bounded', async () => {
  assert.equal(await decodePipelinePicture(claimedPng(30_000, 30_000), 'image/png'), null, 'the header alone refuses it');
  // One pixel claimed, twenty megabytes of image data: the pure reader is not
  // given it, and whatever reads it stops at the size the header gives.
  const u32 = (n: number): number[] => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const data = zlibSync(new Uint8Array(20 * 1024 * 1024));
  const bomb = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...u32(13), 0x49, 0x48, 0x44, 0x52, ...u32(1), ...u32(1), 8, 6, 0, 0, 0, 0, 0, 0, 0,
    ...u32(data.length), 0x49, 0x44, 0x41, 0x54, ...data, 0, 0, 0, 0,
    ...u32(0), 0x49, 0x45, 0x4e, 0x44, 0, 0, 0, 0,
  ]);
  const picture = await decodePipelinePicture(bomb, 'image/png');
  assert.ok(picture === null || picture.width * picture.height === 1, 'no more than the one pixel the header claims');
});

// ─── a plan read back ────────────────────────────────────────────────────────

test('a plan records how the flattened slides were read, and a compile that reads the file the same way fits it', async () => {
  const bytes = read(FLATTENED);
  const rebuilt = await planOf(bytes, 'flattened.pdf', { ocr: bitmapOcr, ocrModel: 'bitmap-stub' });
  assert.match(rebuilt.plan.algorithms.reader, /^pdf-read\/[^+]+\+rebuild\/ocr:bitmap-stub$/);
  const shape = flattenedReadOfPlan(rebuilt.plan);
  assert.deepEqual(shape, { flattened: 'rebuild', ocr: true, ocrModel: 'bitmap-stub' });
  assert.deepEqual(rebuilt.read, shape, 'the read result states the same');

  // A plain read keeps the slides as pictures, so the plan does not fit, and the
  // refusal names the cause.
  const plain = await readDeck({ bytes, name: 'flattened.pdf', parseXml: parsePipelineXml, instanceId: INSTANCE });
  await assert.rejects(
    compileDeck({ source: plain.source, census: plain.census, plan: rebuilt.plan, system: rebuilt.system }),
    (err: unknown) => err instanceof RebrandPipelineError && err.code === 'plan.invalid'
      && /read another way/.test(err.message) && /bitmap-stub/.test(err.message) && /flattenedReadOfPlan/.test(err.message),
  );

  // The same options, from the plan, give the same objects.
  assert.ok(shape);
  const again = await readDeck({
    bytes, name: 'flattened.pdf', parseXml: parsePipelineXml, instanceId: INSTANCE,
    flattened: shape.flattened, ...(shape.ocr ? { ocr: bitmapOcr, ...(shape.ocrModel ? { ocrModel: shape.ocrModel } : {}) } : {}),
  });
  const compiled = await compileDeck({ source: again.source, census: again.census, plan: rebuilt.plan, system: rebuilt.system });
  assert.equal(compiled.compiled.source.hash, rebuilt.source.source.hash);

  // A kept plan says so, and a read that passes an OCR runner still keeps when told to.
  const kept = await planOf(bytes, 'flattened.pdf');
  assert.deepEqual(flattenedReadOfPlan(kept.plan), { flattened: 'keep', ocr: false });
  const keptAgain = await readDeck({ bytes, name: 'flattened.pdf', parseXml: parsePipelineXml, instanceId: INSTANCE, ocr: bitmapOcr, flattened: 'keep' });
  await compileDeck({ source: keptAgain.source, census: keptAgain.census, plan: kept.plan, system: kept.system });

  // A deck with no flattened slide records nothing after the reader.
  const editable = await planOf(read(EDITABLE), 'editable.pdf');
  assert.equal(flattenedReadOfPlan(editable.plan), null);
  assert.equal(editable.read, null);
});

test('nodeFlattenedOcr reports a missing runtime or model instead of loading one', async () => {
  const none = await nodeFlattenedOcr({ api: null });
  assert.equal(none.ok, false);
  if (!none.ok) assert.equal(none.reason, 'no-runtime');

  let ran = 0;
  const api = {
    isAvailable: () => true,
    backend: () => null,
    models: () => [],
    modelBytes: () => 0,
    cached: async () => false,
    canRun: async () => ({ ok: true as const }),
    run: async () => {
      ran++;
      return { text: '', lines: [], lang: 'en' };
    },
  };
  const missing = await nodeFlattenedOcr({ api, model: 'stub-model' });
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.equal(missing.reason, 'model-missing');
    assert.match(missing.message, /lolly models fetch ocr/);
  }
  assert.equal(ran, 0, 'nothing ran');

  const ready = await nodeFlattenedOcr({ api: { ...api, cached: async () => true, run: async () => ({ text: 'HI', lines: [{ text: 'HI', confidence: 0.9, box: { x: 1, y: 2, w: 3, h: 4 } }], lang: 'en' }) }, model: 'stub-model' });
  assert.equal(ready.ok, true);
  if (ready.ok) {
    assert.equal(ready.model, 'stub-model');
    // A real region, from the fixture's first page, so the call is typed as the rebuild makes it.
    const kept = await readDeck({ bytes: read(FLATTENED), name: 'flattened.pdf', parseXml: parsePipelineXml });
    const ref = kept.source.slides[0]?.objects[0]?.media;
    const held = ref ? kept.media.get(ref) : undefined;
    assert.ok(held, 'the first page picture is held');
    const picture = await decodePipelinePicture(held.bytes, held.mime);
    assert.ok(picture, 'the first page picture decodes with the pure PNG reader');
    const region = findSlideRegions(picture).regions[0];
    assert.ok(region, 'the first page has a region');
    const lines = await ready.ocr({ width: 4, height: 4, data: new Uint8ClampedArray(64) }, region);
    assert.deepEqual(lines, [{ text: 'HI', confidence: 0.9, box: { x: 1, y: 2, w: 3, h: 4 } }]);
  }
});

// ─── the private corpus, measured ────────────────────────────────────────────

test('the private corpus PDFs and Lolly_Strategic_Vision.pptx rebuild with every object accounted for', { skip: skipReason() ?? false }, async (t) => {
  const corpus = privateCorpus();
  assert.ok(corpus, 'privateCorpus returned nothing with LOLLY_REBRAND_FIXTURES set');
  const files = [...corpus.files, ...corpus.slidesToTest].filter((file) =>
    /\.pdf$/i.test(file) || path.basename(file) === 'Lolly_Strategic_Vision.pptx');
  assert.ok(files.length > 0, 'the corpus holds PDFs or the strategic vision deck');

  const runner = await nodeFlattenedOcr();
  const ocr = runner.ok ? { ocr: runner.ocr, ocrModel: runner.model } : {};
  t.diagnostic(runner.ok ? `OCR: ${runner.model}` : `OCR: none (${runner.message}); flattened slides are cut without reading text`);

  for (const file of files) {
    const bytes = new Uint8Array(readFileSync(file));
    const name = path.basename(file);
    const started = performance.now();
    const planned = await planOf(bytes, name, { ...ocr, flattened: 'rebuild' });
    const total = performance.now() - started;
    assertPlanAccounts(planned);
    await assertCompileAccounts(planned);

    const slides = planned.source.slides.length;
    t.diagnostic(`${name}: ${slides} slides, ${objectsOf(planned.source).length} objects, ${Math.round(total)} ms (${Math.round(total / Math.max(1, slides))} ms a slide), ${planned.flattened.length} flattened`);
    for (const report of planned.flattened) {
      const slide = planned.source.slides.find((one) => one.id === report.slideId);
      assert.ok(slide);
      let regions = 0;
      const recovery = slide.recovery?.assetRef;
      const held = recovery ? planned.media.get(recovery) : undefined;
      const picture = held ? await decodePipelinePicture(held.bytes, held.mime) : null;
      if (picture) regions = findSlideRegions(picture).regions.length;
      t.diagnostic(`  ${report.slideId}: ${report.outcome}${report.reason ? ` (${report.reason})` : ''}, ${report.ms} ms, ${regions} regions, ${report.objects.text} text, ${report.objects.pic} pictures, ${report.objects.shape} shapes, ocr ${report.ocr}`);
      if (report.outcome === 'rebuilt') {
        assert.ok(slide.recovery, `${report.slideId}: the recovery picture is kept`);
        assert.ok(planned.media.has(slide.recovery.assetRef));
      }
    }
  }
});
