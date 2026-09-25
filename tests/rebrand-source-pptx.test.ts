// SPDX-License-Identifier: MPL-2.0
/**
 * Stage 1 of the renovation journey over the adversarial fixture (plan 274
 * work package 0c): `sourceDeckFromPptx` against the hand-authored labels.
 *
 * The fixture was built to break the easy answers, so the checks here are the
 * ones a census will later depend on: a master's confidentiality line keeps its
 * origin, a grouped shape reports SLIDE coordinates rather than group ones, a
 * native chart with no fallback picture is `unavailable` and never dressed up,
 * a chart the file does carry a fallback for is `raster-preserved`, the same
 * partner mark on three slides is ONE asset ref, a link survives on its run and
 * so does a right to left paragraph.
 *
 * The labels sidecar is the ground truth for geometry, so an object is found by
 * its labelled box rather than by an id: `readPptx` does not report a shape's
 * `p:cNvPr@id`, so the adapter mints ids from z-order and the two id forms do
 * not line up. The boxes do, to the pixel.
 *
 * Run with: node --test "tests/rebrand-source-pptx.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)
import Ajv from 'ajv/dist/2020.js';

import { inflatePptx } from '../packages/node-shell/src/pptx.ts';
import { sourceDeckFromPptx } from '../packages/node-shell/src/rebrand/index.ts';
import {
  labelReaderFromOcr,
  readDeckVectorLabels,
  type VectorLabelSummaryV1,
} from '../packages/node-shell/src/rebrand/source-pptx.ts';
import { glyphRunFrame, type VectorLabelReaderV1 } from '../engine/src/vector-text.ts';
import { glyphRunsOf, svgItemsOf } from '../engine/src/svg-items.ts';
import type { SourceDeckV1, SourceObjectV1, SourceParaV1, SourceRunV1 } from '../packages/core/src/rebrand-v1.ts';
import { MAX_VECTOR_ROWS_PER_OBJECT } from '../engine/src/svg-items.ts';
import { compileFaithful } from '../engine/src/deck-compile.ts';
import {
  allLabelledObjects,
  readFixture,
  readLabels,
  type FixtureObjectLabelV1,
  type RebrandFixtureLabelsV1,
} from './helpers/rebrand-fixtures.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const win = new JSDOM('').window;
const domParser = new win.DOMParser();
const parseXml = (xml: string): Document => domParser.parseFromString(xml, 'application/xml') as unknown as Document;

interface Adapted {
  deck: SourceDeckV1;
  /** Every ref the sink handed back, so a repeat of one file is visible as a count. */
  sinkCalls: string[];
}

let cached: Promise<Adapted> | null = null;

/** The adversarial fixture read into the stage-1 model, once per run. */
function adversarial(): Promise<Adapted> {
  cached ??= (async (): Promise<Adapted> => {
    const bytes = readFixture('adversarial.pptx');
    const parts = await inflatePptx(bytes);
    const sinkCalls: string[] = [];
    const deck = await sourceDeckFromPptx(parts, parseXml, {
      hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      instanceId: 'test-instance-1',
      name: 'adversarial.pptx',
      bytes: bytes.byteLength,
      sink: async (media, _mime, hint) => {
        const ref = `user/media/${hint.slice(0, 16)}`;
        sinkCalls.push(ref);
        assert.ok(media.byteLength > 0, 'the sink was handed empty bytes');
        return ref;
      },
      reader: { name: 'pptx-read', version: 'test' },
    });
    return { deck, sinkCalls };
  })();
  return cached;
}

function labels(): RebrandFixtureLabelsV1 {
  return readLabels('adversarial.pptx');
}

/** The one labelled object with this authored name, or a failure naming it. */
function labelOf(name: string): FixtureObjectLabelV1 {
  const found = allLabelledObjects(labels()).filter((o) => o.authored === name);
  assert.equal(found.length >= 1, true, `the labels sidecar has no object authored as ${name}`);
  return found[0] as FixtureObjectLabelV1;
}

function everyObject(deck: SourceDeckV1): SourceObjectV1[] {
  return deck.slides.flatMap((slide) => slide.objects);
}

/** Objects whose box matches a labelled one within a pixel on every edge. */
function objectsAtLabel(deck: SourceDeckV1, label: FixtureObjectLabelV1): SourceObjectV1[] {
  const want = label.boxPx;
  assert.ok(want, `the label ${label.authored} states no boxPx to match against`);
  return everyObject(deck).filter(
    (o) =>
      Math.abs(o.box.x - want.x) <= 1 &&
      Math.abs(o.box.y - want.y) <= 1 &&
      Math.abs(o.box.w - want.w) <= 1 &&
      Math.abs(o.box.h - want.h) <= 1,
  );
}

function allText(object: SourceObjectV1): string {
  return (object.text?.paras ?? []).map((para) => para.runs.map((run) => run.text).join('')).join('\n');
}

test('the inherited Confidential line keeps the master as its origin', async () => {
  const { deck } = await adversarial();
  const lines = everyObject(deck).filter((o) => allText(o).includes('Confidential'));
  assert.equal(lines.length, deck.slides.length, 'the master line should reach every slide');
  for (const line of lines) {
    assert.equal(line.origin, 'master', 'a line declared on the master must not read as slide content');
    assert.equal(line.fidelity.state, 'editable');
  }
  const label = labelOf('confidential');
  assert.equal(label.origin, 'master');
  assert.equal(label.mustKeep, true, 'the fixture states this line must survive a default plan');
});

test('grouped shapes report slide coordinates, not group ones', async () => {
  const { deck } = await adversarial();
  const grouped = everyObject(deck).filter((o) => (o.groupPath?.length ?? 0) > 0);
  const groupLabels = allLabelledObjects(labels()).filter((o) => (o.groupPath?.length ?? 0) > 0);
  assert.equal(groupLabels.length > 0, true, 'the fixture is supposed to carry a scaled group');
  assert.equal(grouped.length, groupLabels.length, 'every grouped child should come back with its ancestry');

  for (const label of groupLabels) {
    const matches = objectsAtLabel(deck, label);
    assert.equal(matches.length, 1, `${label.authored} should compose to exactly one box at ${JSON.stringify(label.boxPx)}`);
    const object = matches[0] as SourceObjectV1;
    assert.equal(object.kind, label.kind);
    assert.equal((object.groupPath ?? []).length, (label.groupPath ?? []).length, 'group depth should match the labels');
  }
});

test('a native chart with no fallback picture is unavailable, with the reason named', async () => {
  const { deck } = await adversarial();
  const label = labelOf('chart-no-fallback');
  const matches = objectsAtLabel(deck, label);
  assert.equal(matches.length, 1);
  const chart = matches[0] as SourceObjectV1;
  assert.equal(chart.kind, 'chart');
  assert.equal(chart.fidelity.state, 'unavailable');
  assert.equal(chart.fidelity.reason, 'native-chart-no-fallback');
  assert.equal(chart.fidelity.fallbackAssetRef, undefined, 'nothing may stand in for bytes the file does not hold');
  assert.equal(chart.tag !== undefined, true, 'the graphic tag is what makes it recognisable as a chart');
  assert.equal((chart.chartData?.series ?? []).length > 0, true, 'the cached series should still be read');
});

test('a native chart the file carries a fallback picture for is raster-preserved', async () => {
  const { deck } = await adversarial();
  const label = labelOf('chart-with-fallback');
  const matches = objectsAtLabel(deck, label);
  assert.equal(matches.length, 1);
  const chart = matches[0] as SourceObjectV1;
  assert.equal(chart.kind, 'chart');
  assert.equal(chart.fidelity.state, 'raster-preserved');
  assert.equal(typeof chart.fidelity.fallbackAssetRef, 'string');
  assert.equal((chart.fidelity.fallbackAssetRef ?? '').length > 0, true);
  assert.equal(chart.fidelity.fallbackSource, 'embedded');
});

test('the same partner mark on three slides is one asset ref', async () => {
  const { deck, sinkCalls } = await adversarial();
  const label = labelOf('partner-mark');
  const marks = objectsAtLabel(deck, label);
  assert.equal(marks.length, 3, 'the fixture puts the mark on three slides');
  const refs = new Set(marks.map((mark) => mark.media));
  assert.equal(refs.size, 1, 'identical bytes must resolve to one asset ref');
  for (const mark of marks) {
    assert.equal(mark.kind, 'pic');
    assert.equal(mark.fidelity.state, 'raster-preserved');
    assert.equal(mark.mediaMime, 'image/png');
  }
  const ref = [...refs][0] as string;
  assert.equal(sinkCalls.filter((call) => call === ref).length, 1, 'the sink should be handed those bytes once');
  assert.equal(new Set(sinkCalls).size, sinkCalls.length, 'the adapter should never store one content hash twice');
});

test('a long link survives on its run, and a right to left paragraph survives as text', async () => {
  const { deck } = await adversarial();
  const linked = everyObject(deck).flatMap((o) => (o.text?.paras ?? []).flatMap((p) => p.runs)).filter((r) => r.href);
  assert.equal(linked.length >= 1, true, 'the fixture carries one external link');
  const href = linked[0]?.href ?? '';
  assert.equal(href.startsWith('https://example.invalid/'), true, `unexpected link target: ${href}`);
  assert.equal(href.length > 60, true, 'the fixture link is long on purpose');

  const rtl = everyObject(deck).find((o) => /[؀-ۿ]/.test(allText(o)));
  assert.ok(rtl, 'the Arabic paragraph should come back');
  assert.equal(allText(rtl).trim().length > 0, true);
  const cjk = everyObject(deck).find((o) => /[぀-ヿ一-鿿]/.test(allText(o)));
  assert.ok(cjk, 'the Japanese paragraph should come back');
});

test('the deck states its own identity, fonts and theme', async () => {
  const { deck } = await adversarial();
  assert.equal(deck.source.kind, 'pptx');
  assert.equal(deck.source.pageCount, 3);
  assert.equal(deck.source.lineageId, deck.source.hash, 'with no core-props identifier the hash is the lineage');
  assert.equal(deck.source.title, 'Rebrand fixture: adversarial');
  assert.equal(deck.slides.length, 3);
  for (const slide of deck.slides) {
    assert.match(slide.id, /^ppt\/slides\/slide\d+\.xml$/);
    assert.equal(slide.origin.kind, 'pptx');
    assert.equal(typeof slide.origin.master, 'string');
    assert.equal(slide.origin.flattened, undefined, 'no slide of this fixture is one full-bleed picture');
    assert.equal(slide.readingOrder.length, slide.objects.length, 'reading order should name every object once');
    assert.deepEqual([...slide.readingOrder].sort(), slide.objects.map((o) => o.id).sort());
  }
  assert.equal(deck.fonts.some((f) => f.provenance === 'theme'), true);
  assert.equal(deck.theme?.majorFont, 'Calibri');
  assert.match(deck.theme?.colors?.accent1 ?? '', /^#[0-9A-Fa-f]{6}$/);
});

test('the source deck validates against schemas/rebrand-source-v1.schema.json', async () => {
  const { deck } = await adversarial();
  const schema = JSON.parse(readFileSync(join(ROOT, 'schemas/rebrand-source-v1.schema.json'), 'utf8')) as object;
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  const ok = validate(deck) as boolean;
  if (!ok) {
    const errors = (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`).join('; ');
    assert.fail(`the adapted deck failed the source schema: ${errors}`);
  }
});

test('reading the same bytes twice produces the same model', async () => {
  const bytes = readFixture('adversarial.pptx');
  const parts = await inflatePptx(bytes);
  const opts = {
    hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    instanceId: 'test-instance-1',
    sink: async (_b: Uint8Array, _m: string, hint: string): Promise<string> => `user/media/${hint.slice(0, 16)}`,
    reader: { name: 'pptx-read', version: 'test' },
  };
  const first = await sourceDeckFromPptx(parts, parseXml, opts);
  const second = await sourceDeckFromPptx(parts, parseXml, opts);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

// ─── synthetic part maps ─────────────────────────────────────────────────────
//
// The committed fixtures carry no gradient, no composed transform and no
// duplicate slide entry, so the paths that handle those get their own hand
// written package here: a part map is what `sourceDeckFromPptx` takes, so one
// can be written inline without a zip.

const NS = 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

function shapeXml(id: number, fill: string, x = 914400, y = 914400): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="s${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>`
    + `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="914400" cy="457200"/></a:xfrm>`
    + `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${fill}</p:spPr></p:sp>`;
}

const SOLID = (hex: string): string => `<a:solidFill><a:srgbClr val="${hex}"/></a:solidFill>`;
const RAMP = '<a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="FF0000"/></a:gs>'
  + '<a:gs pos="100000"><a:srgbClr val="0000FF"/></a:gs></a:gsLst></a:gradFill>';

/** A one-slide package holding the given shape markup, with `sldIds` presentation entries. */
function synthetic(shapes: string, sldIds = '<p:sldId id="256" r:id="rId1"/>'): Record<string, string> {
  return {
    'ppt/presentation.xml': `<p:presentation ${NS}><p:sldIdLst>${sldIds}</p:sldIdLst>`
      + '<p:sldSz cx="12192000" cy="6858000"/></p:presentation>',
    'ppt/_rels/presentation.xml.rels':
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>'
      + '</Relationships>',
    'ppt/slides/slide1.xml': `<p:sld ${NS}><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld></p:sld>`,
  };
}

function adapt(parts: Record<string, string>): Promise<SourceDeckV1> {
  return sourceDeckFromPptx(parts, parseXml, {
    hash: `sha256:${'1'.repeat(64)}`,
    instanceId: 'synthetic-1',
    sink: async (_b: Uint8Array, _m: string, hint: string): Promise<string> => `user/media/${hint.slice(0, 16)}`,
    reader: { name: 'pptx-read', version: 'test' },
  });
}

test('two shapes at one box with different fills do not share a fingerprint', async () => {
  const deck = await adapt(synthetic(shapeXml(2, SOLID('1F4E79')) + shapeXml(3, SOLID('D65A28'))));
  const shapes = everyObject(deck).filter((o) => o.kind === 'shape');
  assert.equal(shapes.length, 2, 'the synthetic package states two shapes');
  const [first, second] = shapes;
  assert.ok(first && second);
  assert.deepEqual(
    { x: first.box.x, y: first.box.y, w: first.box.w, h: first.box.h },
    { x: second.box.x, y: second.box.y, w: second.box.w, h: second.box.h },
    'the two shapes are at the same box on purpose',
  );
  assert.notEqual(first.fill?.hex, second.fill?.hex);
  assert.notEqual(
    first.fingerprint,
    second.fingerprint,
    'a fingerprint that ignores fill would carry a decision from one shape onto the other',
  );
});

test('a gradient fill is recorded as flattened, not as content the reader modelled', async () => {
  const deck = await adapt(synthetic(shapeXml(2, RAMP)));
  const shape = everyObject(deck).find((o) => o.kind === 'shape');
  assert.ok(shape);
  assert.equal(shape.fidelity.state, 'approximate');
  assert.equal(shape.fidelity.reason, 'reader-approximation');
  const slide = deck.slides[0];
  assert.ok(slide);
  const warning = slide.warnings.find((w) => w.code === 'gradient-flattened');
  assert.ok(warning, 'the slide must say the ramp was read as one stop');
  assert.deepEqual(warning.objectIds, [shape.id]);
});

test('one slide part listed twice mints two slides with distinct object ids', async () => {
  const twice = '<p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId1"/>';
  const deck = await adapt(synthetic(shapeXml(2, SOLID('1F4E79')), twice));
  assert.equal(deck.slides.length, 2, 'the presentation lists the same part twice');
  const ids = everyObject(deck).map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length, 'a repeated part must not mint the same object id twice');
  assert.equal(new Set(deck.slides.map((s) => s.id)).size, 2);
});

test('a picture fingerprint follows the bytes, not the ref the sink chose', async () => {
  const bytes = readFixture('adversarial.pptx');
  const parts = await inflatePptx(bytes);
  const base = {
    hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    instanceId: 'ref-scheme',
    reader: { name: 'pptx-read', version: 'test' },
  };
  const asPath = await sourceDeckFromPptx(parts, parseXml, {
    ...base,
    sink: async (_b: Uint8Array, _m: string, hint: string): Promise<string> => `file:///media/${hint}.bin`,
  });
  const asRecord = await sourceDeckFromPptx(parts, parseXml, {
    ...base,
    sink: async (_b: Uint8Array, _m: string, hint: string): Promise<string> => `idb:${hint.slice(0, 8)}`,
  });
  const pics = (deck: SourceDeckV1): string[] =>
    everyObject(deck).filter((o) => o.media !== undefined).map((o) => o.fingerprint);
  assert.equal(pics(asPath).length > 0, true, 'the fixture carries pictures');
  assert.notDeepEqual(
    everyObject(asPath).map((o) => o.media),
    everyObject(asRecord).map((o) => o.media),
    'the two sinks were supposed to return different refs',
  );
  assert.deepEqual(pics(asPath), pics(asRecord), 'the same bytes must fingerprint alike on every surface');
});

test('the rebrand subpath of the package resolves', async () => {
  const viaSubpath = await import('@lolly-tools/node-shell/rebrand');
  assert.equal(typeof viaSubpath.sourceDeckFromPptx, 'function');
  assert.equal(typeof viaSubpath.newInstanceId, 'function');
});

// ─── plan 275 section 7.2: formatting carried into the source model ──────────

/** The plan 275 formatting fixture and its labels, read straight from the fixture folder. */
interface FormattingLabels {
  slides: Array<{ index: number; objects: Array<{ id: string; paras?: Array<Record<string, unknown> & { runs: Array<Record<string, unknown>> }> }> }>;
}

test('plan 275: the formatting fixture keeps every paragraph and run property its labels state, and validates', async () => {
  const bytes = new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/rebrand/formatting.pptx')));
  const parts = await inflatePptx(bytes);
  const deck = await sourceDeckFromPptx(parts, parseXml, {
    hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    instanceId: 'test-instance-fmt',
    name: 'formatting.pptx',
    bytes: bytes.byteLength,
    sink: async (_media, _mime, hint) => `user/media/${hint.slice(0, 16)}`,
    reader: { name: 'pptx-read', version: 'test' },
  });
  const want = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/rebrand/formatting.labels.json'), 'utf8')) as FormattingLabels;
  let compared = 0;
  for (const slideLabel of want.slides) {
    const slide = deck.slides[slideLabel.index];
    assert.ok(slide, `slide ${slideLabel.index}`);
    assert.equal(slide.origin.layoutName, 'Content', 'the layout name travels on the slide origin');
    const own = slide.objects.filter((o) => o.origin === 'slide');
    for (const [i, label] of slideLabel.objects.entries()) {
      if (!label.paras) continue;
      // The labels list the slide's own shapes in the order the reader walks them.
      const object = own[i];
      assert.ok(object?.text, `${label.id}: text`);
      for (const [p, para] of label.paras.entries()) {
        const got: SourceParaV1 | undefined = object.text.paras[p];
        const where = `${label.id} paragraph ${p}`;
        assert.ok(got, where);
        for (const key of ['bullet', 'bulletChar', 'numberStyle', 'align', 'lineSpacingPct', 'spaceBeforePt', 'indentPx', 'firstIndentPx'] as const) {
          assert.equal(got[key], para[key], `${where}: ${key}`);
        }
        for (const [r, run] of para.runs.entries()) {
          const read: SourceRunV1 | undefined = got.runs[r];
          for (const key of ['bold', 'italic', 'underline', 'strike', 'baseline', 'case', 'href'] as const) {
            assert.equal(read?.[key], run[key], `${where} run ${r}: ${key}`);
          }
        }
        compared += 1;
      }
    }
  }
  assert.equal(compared, 18);
  const schema = JSON.parse(readFileSync(join(ROOT, 'schemas/rebrand-source-v1.schema.json'), 'utf8')) as object;
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  assert.equal(validate(deck), true, JSON.stringify(validate.errors ?? []));
});

// ─── plan 275 decision 32: vectors stay vectors ──────────────────────────────

interface VectorLabelled extends FixtureObjectLabelV1 {
  vector?: { items: number; omitted?: Array<{ reason: string; count: number }>; series?: string[]; title?: string; warning?: string };
}

let vectorCached: Promise<Adapted> | null = null;

/** The vector fixture read into the stage-1 model, once per run. */
function vectorDeck(): Promise<Adapted> {
  vectorCached ??= (async (): Promise<Adapted> => {
    const bytes = new Uint8Array(readFileSync(join(ROOT, 'tests/fixtures/rebrand/vector.pptx')));
    const parts = await inflatePptx(bytes);
    const sinkCalls: string[] = [];
    const deck = await sourceDeckFromPptx(parts, parseXml, {
      hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      instanceId: 'test-instance-vector',
      name: 'vector.pptx',
      bytes: bytes.byteLength,
      sink: async (_media, mime, hint) => {
        const ref = `user/media/${hint.slice(0, 16)}`;
        sinkCalls.push(`${ref} ${mime}`);
        return ref;
      },
      reader: { name: 'pptx-read', version: 'test' },
    });
    return { deck, sinkCalls };
  })();
  return vectorCached;
}

function vectorLabels(): { slides: Array<{ index: number; objects: VectorLabelled[] }>; inherited: VectorLabelled[] } {
  return JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/rebrand/vector.labels.json'), 'utf8')) as { slides: Array<{ index: number; objects: VectorLabelled[] }>; inherited: VectorLabelled[] };
}

test('plan 275: every drawing of the vector fixture reads as its labels state', async () => {
  const { deck } = await vectorDeck();
  const want = vectorLabels();
  let checked = 0;
  for (const slideLabel of want.slides) {
    const slide = deck.slides[slideLabel.index]!;
    for (const label of slideLabel.objects) {
      if (!label.vector) continue;
      const found = objectsAtLabel(deck, label).filter((o) => o.id.startsWith(slide.id));
      const object = found.find((o) => o.kind === label.kind);
      assert.ok(object, `${label.id} (${label.authored}) is read as a ${label.kind}`);
      assert.equal(object.fidelity.state, label.fidelity.state, `${label.authored}: fidelity`);
      assert.equal(object.vectorItems?.items.length ?? 0, label.vector.items, `${label.authored}: items`);
      assert.deepEqual(object.vectorItems?.omitted, label.vector.omitted, `${label.authored}: omitted`);
      if (label.vector.series) {
        assert.deepEqual([...new Set(object.vectorItems?.items.map((i) => i.series).filter(Boolean))].sort(), label.vector.series);
      }
      if (label.vector.title) assert.equal(object.vectorItems?.title, label.vector.title);
      if (label.vector.warning) assert.ok(slide.warnings.some((w) => w.code === label.vector?.warning && w.objectIds?.includes(object.id)), `${label.authored}: ${label.vector.warning}`);
      checked += 1;
    }
  }
  assert.equal(checked, 6);
});

test('plan 275: an SVG picture is a vector holding its raster as media and its SVG as the archive copy', async () => {
  const { deck } = await vectorDeck();
  const chart = deck.slides[0]!.objects.find((o) => o.kind === 'vector' && o.origin === 'slide')!;
  assert.equal(chart.mediaMime, 'image/png', 'the raster a person can fall back to');
  assert.ok(chart.media?.startsWith('user/media/'));
  assert.match(chart.vector ?? '', /^<svg[\s\S]*<title>bar chart<\/title>/);
  assert.equal(chart.vectorItems?.desc, 'Source: rebrand fixture data (CC0-1.0).', 'the credit line travels');
  // Refused: the raster stands in, named as the fallback so the faithful compile draws it.
  const crowd = deck.slides[2]!.objects.find((o) => o.kind === 'vector' && o.origin === 'slide')!;
  assert.equal(crowd.fidelity.fallbackAssetRef, crowd.media);
  assert.equal(crowd.fidelity.fallbackSource, 'embedded');
});

test('plan 275: the layout mark drawn as an SVG is one asset ref and one reading on every slide', async () => {
  const { deck, sinkCalls } = await vectorDeck();
  const marks = deck.slides.map((slide) => slide.objects.find((o) => o.origin === 'master' && o.kind === 'vector'));
  assert.ok(marks.every(Boolean), 'the mark is read on every slide');
  assert.equal(new Set(marks.map((m) => m?.media)).size, 1, 'one asset ref');
  assert.equal(new Set(marks.map((m) => m?.fingerprint)).size, 1, 'one fingerprint, so the census groups it');
  assert.equal(marks[0]?.vectorItems?.items.length, 2);
  assert.equal(sinkCalls.filter((call) => call.endsWith('image/svg+xml')).length, 0, 'an SVG with a raster beside it stores the raster, not the SVG');
});

test('plan 275: a freeform keeps its kind and fingerprint rule, and carries its outline as items', async () => {
  const { deck } = await vectorDeck();
  const parts = deck.slides[0]!.objects.filter((o) => o.kind === 'shape' && o.vectorItems);
  assert.equal(parts.length, 2);
  for (const part of parts) {
    assert.equal(part.geom, undefined);
    assert.equal(part.vectorItems?.items.length, 1);
    assert.equal(part.fingerprint.startsWith('shape:'), true);
  }
  assert.notEqual(parts[0]!.vectorItems?.items[0]?.kind === 'path' && parts[0]!.vectorItems.items[0].d, parts[1]!.vectorItems?.items[0]?.kind === 'path' && parts[1]!.vectorItems.items[0].d);
});

test('plan 275: the vector fixture validates, and reading it twice gives the same model', async () => {
  const { deck } = await vectorDeck();
  const schema = JSON.parse(readFileSync(join(ROOT, 'schemas/rebrand-source-v1.schema.json'), 'utf8')) as object;
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  assert.equal(validate(deck), true, JSON.stringify(validate.errors ?? []));
  vectorCached = null;
  const again = await vectorDeck();
  assert.equal(JSON.stringify(again.deck), JSON.stringify(deck));
});

test('plan 275: the fingerprint of a drawing moves from pic to vector, which carry-forward has to expect', async () => {
  const { deck } = await vectorDeck();
  const chart = deck.slides[0]!.objects.find((o) => o.kind === 'vector' && o.origin === 'slide')!;
  assert.ok(chart.fingerprint.startsWith('vector:'), 'the kind is part of the fingerprint');
});

test('plan 275: Office boilerplate is taken off alt text, and a person\'s own words are kept', async () => {
  const { cleanAlt } = await import('../packages/node-shell/src/rebrand/source-pptx.ts');
  assert.equal(cleanAlt('Chart, bar chart\n\nDescription automatically generated'), 'Chart, bar chart');
  assert.equal(cleanAlt('A picture containing text\n\nDescription automatic'), 'A picture containing text', 'a truncated tail goes too');
  assert.equal(cleanAlt('Logo\n\nDescription automatically generated with medium confidence'), 'Logo');
  assert.equal(cleanAlt('Description automatically generated'), undefined, 'nothing else left means no alt');
  assert.equal(cleanAlt('Revenue grew 12% in Q3'), 'Revenue grew 12% in Q3');
  assert.equal(cleanAlt('Description of the automatic sprinkler system'), 'Description of the automatic sprinkler system', 'a sentence that only starts alike is a person\'s');
  const pic = '<p:pic><p:nvPicPr><p:cNvPr id="2" name="p" descr="Chart&#10;&#10;Description automatically generated"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>'
    + '<p:blipFill><a:blip r:embed="rId9"/></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm></p:spPr></p:pic>';
  const deck = await adapt(synthetic(pic));
  assert.equal(everyObject(deck)[0]?.alt, 'Chart');
});

/** A deck of `count` pictures that all carry one SVG of `parts` one-pixel squares. */
function drawingDeck(parts: number, count: number): Record<string, string | Uint8Array> {
  const rects = Array.from({ length: parts }, (_, i) => `<rect x="${i % 50}" y="${Math.floor(i / 50)}" width="1" height="1" fill="#000"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 ${Math.ceil(parts / 50)}">${rects}</svg>`;
  const pics = Array.from({ length: count }, (_, i) => `<p:pic><p:nvPicPr><p:cNvPr id="${i + 2}" name="v"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>`
    + '<p:blipFill><a:blip r:embed="rId2"><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}">'
    + '<asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="rId3"/></a:ext></a:extLst></a:blip></p:blipFill>'
    + `<p:spPr><a:xfrm><a:off x="${i * 10}" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm></p:spPr></p:pic>`).join('');
  return {
    ...synthetic(pics),
    'ppt/slides/_rels/slide1.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>'
      + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.svg"/></Relationships>',
    'ppt/media/image1.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    'ppt/media/image1.svg': svg,
  };
}

test('plan 275: past the deck budget of drawing parts, further drawings stay pictures and the deck says so', async () => {
  const deck = await sourceDeckFromPptx(drawingDeck(400, 51), parseXml, {
    hash: `sha256:${'2'.repeat(64)}`, instanceId: 'budget', reader: { name: 'pptx-read', version: 'test' },
    sink: async (_b, _m, hint) => `user/media/${hint.slice(0, 16)}`,
  });
  const vectors = everyObject(deck).filter((o) => o.kind === 'vector');
  assert.equal(vectors.filter((o) => o.fidelity.state === 'editable').length, 50, '50 drawings of 400 parts fit 20,000');
  assert.equal(vectors.filter((o) => o.fidelity.state === 'raster-preserved').length, 1, 'the 51st stays a picture');
  const warning = deck.warnings.find((w) => w.code === 'vector-budget-reached');
  assert.equal(warning?.count, 1);
  assert.match(warning?.message ?? '', /1 drawing stays a picture/);
});

test('plan 275: a drawing with more parts than a compile places as rows stays a picture and spends no budget', async () => {
  const deck = await sourceDeckFromPptx(drawingDeck(MAX_VECTOR_ROWS_PER_OBJECT + 1, 3), parseXml, {
    hash: `sha256:${'3'.repeat(64)}`, instanceId: 'row-cap', reader: { name: 'pptx-read', version: 'test' },
    sink: async (_b, _m, hint) => `user/media/${hint.slice(0, 16)}`,
  });
  const vectors = everyObject(deck).filter((o) => o.kind === 'vector');
  assert.equal(vectors.length, 3);
  for (const vector of vectors) {
    assert.equal(vector.fidelity.state, 'raster-preserved', 'it will never be rows, so it does not claim to be editable');
    assert.ok(vector.fidelity.fallbackAssetRef, 'its raster is the picture it stays');
    assert.deepEqual(vector.vectorItems?.items, [], 'no parts are offered for colour mappings');
    assert.deepEqual(vector.vectorItems?.omitted, [{ reason: 'cap-reached', count: MAX_VECTOR_ROWS_PER_OBJECT + 1 }]);
  }
  assert.equal(deck.warnings.find((w) => w.code === 'vector-budget-reached'), undefined, 'none of the deck budget was spent');
  const compiled = compileFaithful(deck);
  const kept = compiled.report.entries.filter((e) => e.code === 'vector.kept-as-picture');
  assert.equal(kept.length, 3);
  assert.ok(kept.every((e) => e.reason === 'cap-reached'), 'the report says why');
});

test('plan 275: a cropped drawing compiles as its crop shows it, and a crop through a part keeps the picture', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="10" y="10" width="20" height="20" fill="#1f4e79"/><rect x="80" y="80" width="15" height="15" fill="#d65a28"/></svg>';
  const pic = (id: number, x: number, crop: string): string => `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="v"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>`
    + '<p:blipFill><a:blip r:embed="rId2"><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}">'
    + `<asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="rId3"/></a:ext></a:extLst></a:blip>${crop}</p:blipFill>`
    + `<p:spPr><a:xfrm><a:off x="${x}" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm></p:spPr></p:pic>`;
  const parts: Record<string, string | Uint8Array> = {
    ...synthetic(pic(2, 0, '<a:srcRect r="40000" b="40000"/>') + pic(3, 2_000_000, '<a:srcRect l="20000"/>')),
    'ppt/slides/_rels/slide1.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>'
      + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.svg"/></Relationships>',
    'ppt/media/image1.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    'ppt/media/image1.svg': svg,
  };
  const deck = await sourceDeckFromPptx(parts, parseXml, {
    hash: `sha256:${'4'.repeat(64)}`, instanceId: 'crop', reader: { name: 'pptx-read', version: 'test' },
    sink: async (_b, _m, hint) => `user/media/${hint.slice(0, 16)}`,
  });
  const [trimmed, cut] = everyObject(deck).filter((o) => o.kind === 'vector');
  assert.equal(trimmed!.fidelity.state, 'editable');
  assert.deepEqual(trimmed!.vectorItems?.viewBox, { x: 0, y: 0, w: 60, h: 60 }, 'the viewBox is what the crop leaves');
  assert.equal(trimmed!.vectorItems?.items.length, 1, 'the part the crop hides is not a row');
  assert.equal(cut!.fidelity.state, 'raster-preserved', 'a crop through a part leaves the picture');
  const compiled = compileFaithful(deck);
  const rows = compiled.frames[0]!.layers.filter((row) => String(row.group ?? '').startsWith('vector:'));
  assert.equal(rows.length, 1);
  const frame = compiled.frames[0]!.layers[0]!;
  const scale = Number(frame.w) / (deck.slides[0]!.width);
  const box = { x: Number(frame.x) + trimmed!.box.x * scale, w: trimmed!.box.w * scale };
  // The bar spans a sixth to a half of the cropped drawing, so a sixth to a half of the box.
  assert.ok(Math.abs(Number(rows[0]!.x) - (box.x + box.w / 6)) < 1, `the bar sits where the crop shows it (${rows[0]!.x})`);
  assert.ok(Math.abs(Number(rows[0]!.w) - box.w / 3) < 1, `and is as wide (${rows[0]!.w})`);
});

// ─── plan 275 section 9.3: outlined labels as live text ──────────────────────

/**
 * Glyph outlines for a label, one box with a counter per character, each character a
 * width of its own so two labels of one length are still two drawings. Stands on y = 0.
 */
function outlined(text: string, height = 14.4): { d: string; width: number } {
  let d = '';
  let x = 0;
  for (const ch of text) {
    if (ch === ' ') {
      x += 0.4 * height;
      continue;
    }
    const w = (0.45 + 0.03 * (ch.charCodeAt(0) % 7)) * height;
    d += `M${x} 0H${x + w}V${-height}H${x}Z`;
    d += `M${x + 0.2 * w} ${-0.2 * height}V${-0.8 * height}H${x + 0.8 * w}V${-0.2 * height}Z`;
    x += w + 0.1 * height;
  }
  return { d, width: x - 0.1 * height };
}

/** A small chart with every label outlined: three ticks under gridlines and two right-aligned categories. */
function outlinedChart(): { svg: string; labels: string[] } {
  const place = (text: string, x: number, y: number, anchor: 'middle' | 'end'): string => {
    const { d, width } = outlined(text);
    const left = anchor === 'middle' ? x - width / 2 : x - width;
    return `<path d="${d}" transform="translate(${left},${y})" fill="rgb(20, 20, 20)" opacity="0.6"/>`;
  };
  const ticks: Array<[string, number]> = [['0%', 200], ['50%', 500], ['100%', 800]];
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500" width="1000" height="500"><title>outlined chart</title>'
    + '<g id="plot"><g class="value-axis">'
    + ticks.map(([t, x]) => `<line x1="${x}" y1="40" x2="${x}" y2="420" stroke="#141414" opacity="0.1"/>${place(t, x, 450, 'middle')}`).join('')
    + '</g><g class="cat-axis">' + place('Yes', 190, 120, 'end') + place('No', 190, 300, 'end') + '</g>'
    + '<rect x="200" y="80" width="600" height="60" fill="#30ba78" data-recolor="Yes"/>'
    + '<rect x="200" y="260" width="120" height="60" fill="#30ba78" data-recolor="No"/>'
    + '</g></svg>';
  return { svg, labels: ['0%', '50%', '100%', 'Yes', 'No'] };
}

/** One slide holding the chart as an SVG picture with a raster beside it. */
function outlinedParts(svg: string): Record<string, string | Uint8Array> {
  const pic = '<p:pic><p:nvPicPr><p:cNvPr id="2" name="chart"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>'
    + '<p:blipFill><a:blip r:embed="rId2"><a:extLst><a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}">'
    + '<asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="rId3"/></a:ext></a:extLst></a:blip></p:blipFill>'
    + '<p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="9144000" cy="4572000"/></a:xfrm></p:spPr></p:pic>';
  return {
    ...synthetic(pic),
    'ppt/slides/_rels/slide1.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>'
      + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.svg"/></Relationships>',
    'ppt/media/image1.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    'ppt/media/image1.svg': svg,
  };
}

/**
 * A reader that knows each label by the width of its picture: the stand-in for a
 * recogniser, so the adapter is tested on what it does with a reading. Counts its calls.
 */
function widthReader(svg: string, labels: string[]): { reader: VectorLabelReaderV1; calls: () => number } {
  const items = svgItemsOf(svg, parseXml);
  const byWidth = new Map<number, string>();
  for (const [i, run] of glyphRunsOf(items).entries()) byWidth.set(glyphRunFrame(items, run).width, labels[i]!);
  assert.equal(byWidth.size, labels.length, 'every label has a picture of its own width');
  let calls = 0;
  return {
    reader: async (frame) => {
      calls += 1;
      const text = byWidth.get(frame.width);
      return text ? { text, confidence: 0.97 } : null;
    },
    calls: () => calls,
  };
}

function readOutlined(parts: Record<string, string | Uint8Array>, labelReader?: VectorLabelReaderV1): Promise<{ deck: SourceDeckV1; summary: VectorLabelSummaryV1 | null }> {
  let summary: VectorLabelSummaryV1 | null = null;
  return sourceDeckFromPptx(parts, parseXml, {
    hash: `sha256:${'5'.repeat(64)}`, instanceId: 'labels', reader: { name: 'pptx-read', version: 'test' },
    sink: async (_b, _m, hint) => `user/media/${hint.slice(0, 16)}`,
    ...(labelReader ? { labelReader } : {}),
    onVectorLabels: (counted) => {
      summary = counted;
    },
  }).then((deck) => ({ deck, summary }));
}

test('plan 275 section 9.3: without a reader, outlined labels stay drawn and are counted', async () => {
  const { svg } = outlinedChart();
  const { deck, summary } = await readOutlined(outlinedParts(svg));
  assert.deepEqual(summary, { runs: 5, text: 0, drawn: 5, read: false });
  const chart = everyObject(deck).find((o) => o.kind === 'vector')!;
  assert.equal(chart.vectorItems?.items.filter((i) => i.kind === 'text').length, 0);
  assert.equal(glyphRunsOf(chart.vectorItems!).length, 5);
});

test('plan 275 section 9.3: with a reader, each outlined label becomes text once, and the deck validates', async () => {
  const { svg, labels } = outlinedChart();
  const parts = outlinedParts(svg);
  const { reader, calls } = widthReader(svg, labels);
  const { deck, summary } = await readOutlined(parts, reader);
  assert.deepEqual(summary, { runs: 5, text: 5, drawn: 0, read: true });
  assert.equal(calls(), 5, 'one reading a label');
  const chart = everyObject(deck).find((o) => o.kind === 'vector')!;
  const texts = chart.vectorItems!.items.filter((i) => i.kind === 'text');
  assert.deepEqual(texts.map((i) => i.kind === 'text' && i.text), labels);
  assert.deepEqual(texts.map((i) => i.kind === 'text' && (i.anchor ?? 'start')), ['middle', 'middle', 'middle', 'end', 'end']);
  assert.equal(glyphRunsOf(chart.vectorItems!).length, 0, 'no label is left as paths');
  assert.equal(chart.fidelity.state, 'editable');
  const plain = await readOutlined(parts);
  assert.equal(chart.fingerprint, everyObject(plain.deck).find((o) => o.kind === 'vector')!.fingerprint, 'reading the labels leaves the fingerprint alone');
  const schema = JSON.parse(readFileSync(join(ROOT, 'schemas/rebrand-source-v1.schema.json'), 'utf8')) as object;
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  assert.equal(validate(deck), true, JSON.stringify(validate.errors ?? []));
});

test('plan 275 section 9.3: a deck read before the model was there reads its labels later to the same items', async () => {
  const { svg, labels } = outlinedChart();
  const parts = outlinedParts(svg);
  const plain = await readOutlined(parts);
  const now = await readOutlined(parts, widthReader(svg, labels).reader);
  const progress: Array<[number, number]> = [];
  const later = await readDeckVectorLabels(plain.deck, widthReader(svg, labels).reader, parseXml, { onProgress: (done, total) => progress.push([done, total]) });
  assert.deepEqual(later.summary, { runs: 5, text: 5, drawn: 0, read: true });
  assert.deepEqual(progress, [[0, 1], [1, 1]]);
  assert.equal(JSON.stringify(later.deck), JSON.stringify(now.deck));
  // Nothing left to read: the same deck back.
  const again = await readDeckVectorLabels(later.deck, async () => null, parseXml);
  assert.equal(again.deck, later.deck);
  assert.deepEqual(again.summary, { runs: 0, text: 0, drawn: 0, read: true });
});

test('plan 275 section 9.3: the flattened rebuild\'s recogniser reads a label as one region, its lines left to right', async () => {
  let asked: { w: number; h: number; kind: string } | null = null;
  const reader = labelReaderFromOcr(async (frame, region) => {
    asked = { w: region.box.w, h: region.box.h, kind: region.kind };
    assert.equal(region.box.w, frame.width);
    return [
      { text: 'services', confidence: 0.9, box: { x: 120, y: 0, w: 80, h: 30 } },
      { text: 'products or', confidence: 0.97, box: { x: 4, y: 0, w: 100, h: 30 } },
      { text: '  ', confidence: 0.2, box: { x: 210, y: 0, w: 10, h: 30 } },
    ];
  });
  const frame = { width: 220, height: 56, data: new Uint8ClampedArray(220 * 56 * 4) };
  assert.deepEqual(await reader(frame), { text: 'products or services', confidence: 0.9 });
  assert.deepEqual(asked, { w: 220, h: 56, kind: 'text' });
  assert.equal(await labelReaderFromOcr(async () => [])(frame), null);
});
