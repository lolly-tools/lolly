// SPDX-License-Identifier: MPL-2.0
/**
 * The synthetic rebrand fixtures (plan 274 section 9) and their labels.
 *
 * This suite builds nothing into the tree. It reads the committed fixtures the
 * way the journey will read a dropped file - inflate the package, hand the part
 * map to the engine reader with an injected XML parser - and checks that the
 * labels sidecar accounts for every object the builder authored. The last case
 * rebuilds each fixture into a scratch directory and compares the bytes, which
 * is what makes the committed files reproducible rather than found objects.
 *
 * One case is gated on the maintainer's private corpus (`LOLLY_REBRAND_FIXTURES`).
 * It skips by name everywhere else, and a skipped run of it is unexercised
 * coverage, not a pass.
 *
 * Run with: node --test tests/rebrand-fixtures.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

import { readPptx, isPptx, type PptxChartData, type PptxReadNode, type PptxReadPara, type PptxReadRun, type PptxUnknownNode } from '../engine/src/pptx-read.ts';
import { EMU_PER_PX } from '../engine/src/pptx.ts';
import { inflatePptx } from '../packages/node-shell/src/pptx.ts';
import { LAYOUT_MATCH_BANDS } from '../packages/core/src/rebrand-v1.ts';
import { buildRebrandFixtures, PLAN_275_FIXTURES, type FixtureLabels275 } from '../scripts/build-rebrand-fixtures.ts';
import {
  allLabelledObjects,
  fixturePath,
  type FixtureObjectLabelV1,
  privateCorpus,
  readFixture,
  readLabels,
  REBRAND_FIXTURE_DIR,
  skipReason,
  SYNTHETIC_FIXTURES,
  type RebrandFixtureLabelsV1,
} from './helpers/rebrand-fixtures.ts';

const win = new JSDOM('').window;
const domParser = new win.DOMParser();
const parseXml = (xml: string): Document => domParser.parseFromString(xml, 'application/xml') as unknown as Document;

const PPTX_FIXTURES = ['simple.pptx', 'adversarial.pptx', 'palette.pptx', ...PLAN_275_FIXTURES] as const;
type PptxFixtureName = (typeof PPTX_FIXTURES)[number];
type Plan275FixtureName = (typeof PLAN_275_FIXTURES)[number];

/** Every file the builder writes: plan 274's four, then plan 275's two. */
const ALL_FIXTURES = [...SYNTHETIC_FIXTURES, ...PLAN_275_FIXTURES] as const;

const isPlan275 = (name: string): name is Plan275FixtureName => (PLAN_275_FIXTURES as readonly string[]).includes(name);
const pathOf = (name: string): string => path.join(REBRAND_FIXTURE_DIR, name);
const labelsPathOf = (name: string): string => path.join(REBRAND_FIXTURE_DIR, `${name.replace(/\.(pptx|pdf)$/, '')}.labels.json`);

/** The labels of one of plan 275's fixtures, with the additive fields typed. */
function readLabels275(name: Plan275FixtureName): FixtureLabels275 {
  return JSON.parse(readFileSync(labelsPathOf(name), 'utf8')) as FixtureLabels275;
}

function labelsOf(name: PptxFixtureName): RebrandFixtureLabelsV1 {
  return isPlan275(name) ? readLabels275(name) : readLabels(name);
}

async function partsOf(name: PptxFixtureName): Promise<Record<string, Uint8Array>> {
  return inflatePptx(isPlan275(name) ? new Uint8Array(readFileSync(pathOf(name))) : readFixture(name));
}

function textOf(parts: Record<string, Uint8Array>, part: string): string {
  const bytes = parts[part];
  assert.ok(bytes, `${part} is missing from the package`);
  return new TextDecoder().decode(bytes);
}

/**
 * Every object a slide part names, found through the parsed document rather than
 * the builder's own string scan, so the two methods have to agree. A group's own
 * `p:cNvPr` is ancestry rather than an object, so it is left out.
 */
function addressableObjects(xml: string): Array<{ id: number; name: string }> {
  const doc = parseXml(xml);
  const holders = new Set(['nvSpPr', 'nvPicPr', 'nvGraphicFramePr', 'nvCxnSpPr']);
  const out: Array<{ id: number; name: string }> = [];
  for (const element of Array.from(doc.getElementsByTagName('*'))) {
    if (element.localName !== 'cNvPr') continue;
    const parent = element.parentElement;
    if (!parent || !holders.has(parent.localName ?? '')) continue;
    const id = Number(element.getAttribute('id'));
    if (!Number.isFinite(id)) continue;
    out.push({ id, name: element.getAttribute('name') ?? '' });
  }
  return out;
}

/** A reader node's box in reference px, which is the space every label states. */
function readerBox(node: PptxReadNode): { x: number; y: number; w: number; h: number } {
  return {
    x: node.xEmu / EMU_PER_PX,
    y: node.yEmu / EMU_PER_PX,
    w: node.cxEmu / EMU_PER_PX,
    h: node.cyEmu / EMU_PER_PX,
  };
}

/**
 * The labels a correct reading produces one node for, in document order. The
 * fallback half of an `mc:AlternateContent` pair is left out: the pair surfaces as
 * ONE object carrying the fallback bytes, which the case below then checks.
 */
function readableObjects(objects: FixtureObjectLabelV1[]): FixtureObjectLabelV1[] {
  return objects.filter((object) => object.alternateContent !== 'fallback');
}

function slidePartNames(parts: Record<string, Uint8Array>): string[] {
  return Object.keys(parts)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/(\d+)/)?.[1] ?? 0) - Number(b.match(/(\d+)/)?.[1] ?? 0));
}

// ─── the fixtures read back ──────────────────────────────────────────────────

test('every synthetic fixture is committed with its labels sidecar', () => {
  for (const name of ALL_FIXTURES) {
    const bytes = readFileSync(pathOf(name));
    assert.ok(bytes.length > 0, `${name} is empty`);
    assert.ok(bytes.length <= 400 * 1024, `${name} is ${bytes.length} bytes, over the 400 KB fixture limit`);
    const labels = JSON.parse(readFileSync(labelsPathOf(name), 'utf8')) as RebrandFixtureLabelsV1;
    assert.equal(labels.fixture, name);
    assert.equal(labels.builder, 'scripts/build-rebrand-fixtures.ts');
  }
});

test('simple.pptx reads as three slides whose owner mark comes from the layout', async () => {
  const parts = await partsOf('simple.pptx');
  assert.equal(isPptx(parts), true);
  const deck = readPptx(parts, parseXml);
  const labels = readLabels('simple.pptx');
  assert.equal(deck.slides.length, 3);
  for (const slide of deck.slides) {
    const kinds = slide.nodes.map((node) => node.type);
    assert.ok(kinds.filter((kind) => kind === 'text').length >= 3, `slide ${slide.index} lost a text object`);
    assert.ok(kinds.includes('shape'), `slide ${slide.index} lost its band`);
  }
  // The photograph is on the middle slide and nowhere else, and it is the only
  // picture the slide parts declare at all: the mark is the layout's.
  const pictures = deck.slides.map((slide) => slide.nodes.filter((node) => node.type === 'pic').length);
  assert.deepEqual(pictures, [0, 1, 0]);
  // The mark reaches every slide as inherited furniture, from one copy of the bytes.
  const markLabel = labels.inherited.find((object) => object.authored === 'logo');
  assert.ok(markLabel, 'the layout no longer carries the owner mark');
  assert.equal(markLabel.origin, 'layout');
  for (const slide of deck.slides) {
    const inherited = (slide.inherited ?? []).filter((node) => node.type === 'pic');
    assert.equal(inherited.length, 1, `slide ${slide.index} did not inherit the owner mark`);
    assert.deepEqual(readerBox(inherited[0]!), markLabel.boxPx);
  }
  assert.equal(Object.keys(parts).filter((name) => /^ppt\/media\/limage\d+_\d+\.png$/.test(name)).length, 1);
  // The partner mark in adversarial.pptx is the same evidence pasted on the slides,
  // and that structural difference is the only thing separating the two answers.
  const partner = allLabelledObjects(readLabels('adversarial.pptx')).find((object) => object.authored === 'partner-mark');
  assert.equal(partner?.origin, 'slide');
  assert.equal(partner?.class, markLabel.class);
  assert.equal(partner?.mustKeep, true);
  assert.equal(markLabel.mustKeep, undefined, 'the deck owner mark is the one a rebrand replaces');
});

test('the master text box of adversarial.pptx reaches every slide as inherited furniture', async () => {
  const parts = await partsOf('adversarial.pptx');
  const deck = readPptx(parts, parseXml);
  assert.equal(deck.slides.length, 3);
  const master = textOf(parts, 'ppt/slideMasters/slideMaster1.xml');
  assert.match(master, /Confidential/, 'the master should carry the line, not the slides');
  for (const slide of deck.slides) {
    const inherited = slide.inherited ?? [];
    const lines = inherited.flatMap((node) => (node.type === 'text' ? node.paras : []))
      .flatMap((para) => para.runs.map((run) => run.text));
    assert.ok(lines.some((line) => line.includes('Confidential')), `slide ${slide.index} did not inherit the master line`);
  }
  for (const name of slidePartNames(parts)) {
    assert.doesNotMatch(textOf(parts, name), /Confidential/, `${name} restates what the master declares`);
  }
});

test('adversarial.pptx carries the objects a default plan must not remove', async () => {
  const parts = await partsOf('adversarial.pptx');
  const labels = readLabels('adversarial.pptx');
  const authored = new Map(allLabelledObjects(labels).map((object) => [object.authored, object]));
  for (const name of ['partner-mark', 'citation-2021', 'citation-2022', 'citation-2023', 'chart-legend-key',
    'small-meaningful-text', 'confidential', 'chart-no-fallback', 'chart-with-fallback', 'long-url',
    'overflowing-body', 'table', 'arabic-line', 'japanese-line', 'group-caption']) {
    const object = authored.get(name);
    assert.ok(object, `the fixture no longer authors ${name}`);
    assert.equal(object.mustKeep, true, `${name} is labelled as removable`);
    assert.ok(labels.mustKeep.includes(object.id), `${name} is missing from the mustKeep list`);
  }
  // The hard cases are in the package as OOXML, whatever a reader makes of them today.
  const slide1 = textOf(parts, 'ppt/slides/slide1.xml');
  assert.match(slide1, /<p:grpSp>/);
  assert.match(slide1, /<a:chOff /);
  assert.match(slide1, /<a:hlinkClick /);
  const slide3 = textOf(parts, 'ppt/slides/slide3.xml');
  assert.match(slide3, /mc:AlternateContent/);
  assert.match(slide3, /mc:Fallback/);
  assert.match(slide3, /<a:tbl>/);
  assert.ok(parts['ppt/charts/chart1.xml'], 'the chart with no fallback lost its part');
  assert.ok(parts['ppt/charts/chart2.xml'], 'the chart with a fallback lost its part');
});

test('the unit note is small AND repeated, so it meets every clause of the decoration rule', async () => {
  const labels = readLabels('adversarial.pptx');
  const notes = labels.slides.flatMap((slide) =>
    slide.objects.filter((object) => object.authored === 'small-meaningful-text').map((object) => ({ slide: slide.id, object })));
  assert.equal(notes.length, 3, 'the seven point line has to repeat, or the rule it guards never fires on it');
  for (const { slide, object } of notes) {
    assert.equal(object.mustKeep, true, `${slide}: the unit note is labelled as removable`);
    assert.deepEqual(object.boxPx, notes[0]?.object.boxPx, `${slide}: the unit note moved, so the repeat rule would not group it`);
    assert.equal(object.text, 'Figures in EUR millions');
  }
  // The other repeated lines sit at or above eight point, so this is the only object
  // in the corpus that is both under the threshold and repeated.
  const parts = await partsOf('adversarial.pptx');
  for (const part of slidePartNames(parts)) {
    assert.match(textOf(parts, part), /sz="700"/, `${part} lost the seven point run`);
  }
});

test('a chart label states what can be SHOWN, while its cached numbers still travel', async () => {
  const parts = await partsOf('adversarial.pptx');
  const deck = readPptx(parts, parseXml);
  const authored = new Map(allLabelledObjects(readLabels('adversarial.pptx')).map((object) => [object.authored, object]));
  const charts = deck.slides.flatMap((slide) => slide.nodes)
    .filter((node): node is PptxUnknownNode => node.type === 'unknown');
  assert.equal(charts.length, 2);

  // Nothing in this path draws a native chart, so a chart the file carries no
  // picture for is unavailable: a placeholder, never a picture of the source.
  const bare = authored.get('chart-no-fallback');
  assert.equal(bare?.fidelity.state, 'unavailable');
  assert.equal(bare?.fidelity.reason, 'native-chart-no-fallback');
  // That is about display, not about data. Both chart parts state complete caches,
  // and `SourceObjectV1.chartData` carries them whatever the fidelity state says,
  // so no later stage may read `unavailable` as licence to discard the numbers.
  for (const node of charts) {
    const data: PptxChartData | undefined = node.chartData;
    assert.ok(data, 'a chart part stopped stating its cached series');
    assert.ok(data.series.length > 0);
    assert.ok((data.categories?.length ?? 0) > 0);
    for (const series of data.series) assert.ok(series.name, 'a series lost its name');
  }
  assert.equal([...textOf(parts, 'ppt/charts/chart1.xml').matchAll(/<a:srgbClr val="[0-9A-F]{6}"\/>/g)].length, 2,
    'the literal series colours a colour census reads are in the part');

  // The chart the file carries real bytes for states where they came from, and no
  // reason at all: nothing about it is missing.
  const paired = authored.get('chart-with-fallback');
  assert.equal(paired?.fidelity.state, 'raster-preserved');
  assert.equal(paired?.fidelity.reason, undefined);
  assert.equal(paired?.fidelity.fallbackSource, 'embedded');
  const carried = deck.slides[2]?.nodes.flatMap((node) => (node.type === 'unknown' && node.fallbackMedia ? [node.fallbackMedia] : [])) ?? [];
  assert.equal(carried.length, 1, 'slide 3 no longer surfaces the pair with its fallback bytes');
  assert.equal(paired?.fidelity.fallbackAssetRef, carried[0]);
  assert.ok(parts[carried[0] ?? ''], 'the fallback bytes are not in the package');
});

test('an mc:AlternateContent pair surfaces as one object, and only one half is kept', () => {
  const labels = readLabels('adversarial.pptx');
  const authored = new Map(allLabelledObjects(labels).map((object) => [object.authored, object]));
  const choice = authored.get('chart-with-fallback');
  const fallback = authored.get('chart-fallback-picture');
  assert.equal(choice?.alternateContent, 'choice');
  assert.equal(fallback?.alternateContent, 'fallback');
  assert.equal(choice?.pairedWith, fallback?.id);
  assert.equal(fallback?.pairedWith, choice?.id);
  // Content accounting runs over mustKeep. Listing both halves would ask a correct
  // implementation to account for an object no correct reading ever produces.
  assert.equal(fallback?.mustKeep, undefined);
  assert.ok(labels.mustKeep.includes(choice?.id ?? ''));
  assert.ok(!labels.mustKeep.includes(fallback?.id ?? ''));
});

test('the labels agree with the engine reader on every composed box and group ancestry', async () => {
  for (const name of PPTX_FIXTURES) {
    const parts = await partsOf(name);
    const deck = readPptx(parts, parseXml);
    const labels = labelsOf(name);
    assert.equal(deck.slides.length, labels.slides.length, `${name}: slide count`);
    for (const [index, slideLabel] of labels.slides.entries()) {
      const nodes = deck.slides[index]?.nodes ?? [];
      const expected = readableObjects(slideLabel.objects);
      assert.equal(nodes.length, expected.length, `${name} ${slideLabel.id}: the reader returned ${nodes.length} nodes for ${expected.length} labelled objects`);
      for (const [i, object] of expected.entries()) {
        const node = nodes[i];
        assert.ok(node, `${name} ${object.id}: no node in document order`);
        assert.deepEqual(readerBox(node), object.boxPx, `${name} ${object.id} (${object.authored}): box`);
        assert.deepEqual(node.groupPath, object.groupPath, `${name} ${object.id} (${object.authored}): group ancestry`);
      }
      // Inherited furniture states the same box in the same space.
      const inherited = deck.slides[index]?.inherited ?? [];
      assert.equal(inherited.length, labels.inherited.length, `${name} ${slideLabel.id}: inherited count`);
      for (const [i, object] of labels.inherited.entries()) {
        assert.deepEqual(readerBox(inherited[i]!), object.boxPx, `${name} ${object.id} (${object.authored}): inherited box`);
      }
    }
  }
});

test('palette.pptx uses one hex as ink, as ground and as a series colour', async () => {
  const parts = await partsOf('palette.pptx');
  const deck = readPptx(parts, parseXml);
  const labels = readLabels('palette.pptx');
  const ground = deck.slides[0]?.background?.color;
  assert.ok(ground && 'hex' in ground && ground.hex === '1F4E79', 'slide 1 lost its ground');
  const ink = deck.slides[0]?.nodes.flatMap((node) => (node.type === 'text' ? node.paras : []))
    .flatMap((para) => para.runs.map((run) => run.color))
    .find((color) => color && 'hex' in color && color.hex === '1F4E79');
  assert.ok(ink, 'slide 1 lost its body ink');
  const chart = textOf(parts, 'ppt/charts/chart1.xml');
  const seriesHexes = [...chart.matchAll(/<a:srgbClr val="([0-9A-F]{6})"\/>/g)].map((match) => match[1]);
  assert.equal(new Set(seriesHexes).size, 8, 'the chart should hold eight distinct literal series colours');
  assert.ok(seriesHexes.includes('1F4E79'), 'the shared hex should also be a series colour');
  // The same hex is the body ink, the ground, a chart series and the accent1 slot.
  const roles = (labels.colors ?? []).filter((use) => use.hex === '#1F4E79').map((use) => use.role).sort();
  assert.deepEqual(roles, ['accent', 'bg', 'ink', 'series']);
  // The six swatches name a theme slot, so a plan maps slot to slot before hex to hex,
  // and the label records the slot the reader reports rather than only its hex.
  assert.equal([...textOf(parts, 'ppt/slides/slide1.xml').matchAll(/<a:schemeClr val="accent[1-6]"\/>/g)].length, 6);
  assert.equal(deck.theme.colors.accent1, '1F4E79');
  const swatchLabels = (labels.slides[0]?.objects ?? []).filter((object) => object.authored.startsWith('swatch-'));
  assert.equal(swatchLabels.length, 6);
  const schemeFills = new Map((deck.slides[0]?.nodes ?? []).flatMap((node) =>
    node.type === 'shape' && node.fill && 'scheme' in node.fill && node.fill.scheme
      ? [[node.xEmu / EMU_PER_PX, node.fill.scheme] as const]
      : []));
  assert.equal(schemeFills.size, 6, 'the swatches no longer read back as scheme-filled shapes');
  for (const swatch of swatchLabels) {
    const use = (labels.colors ?? []).find((candidate) => candidate.objectIds.includes(swatch.id));
    assert.ok(use, `${swatch.authored} has no colour use`);
    assert.equal(use.scheme, schemeFills.get(swatch.boxPx?.x ?? -1), `${swatch.authored}: the labelled slot is not the one the reader reports`);
    assert.equal(use.role, 'accent');
  }
  // The eight series are one distinction set, which is what keeps them apart from
  // each other rather than each landing well on its own.
  const chartLabel = labels.slides[1]?.objects.find((object) => object.authored === 'eight-series-chart');
  const seriesUses = (labels.colors ?? []).filter((use) => use.role === 'series');
  assert.equal(seriesUses.length, 8);
  for (const use of seriesUses) assert.equal(use.distinctionSet, chartLabel?.id);
  const chartNode = deck.slides[1]?.nodes.find((node) => node.type === 'unknown');
  assert.equal(chartNode?.type === 'unknown' ? chartNode.chartData?.series.length : 0, 8,
    'the reader hands back all eight series, so none of them may be discarded');
  // Unavailable is about what can be drawn. The eight series are still here.
  assert.equal(chartLabel?.fidelity.state, 'unavailable');
});

// ─── plan 275: formatting.pptx ───────────────────────────────────────────────

test('formatting.pptx states its paragraphs for every title and body, and they match the package', async () => {
  const parts = await partsOf('formatting.pptx');
  const deck = readPptx(parts, parseXml);
  const labels = readLabels275('formatting.pptx');
  assert.equal(deck.slides.length, 3);
  for (const [index, slideLabel] of labels.slides.entries()) {
    const nodes = deck.slides[index]?.nodes ?? [];
    for (const [i, object] of slideLabel.objects.entries()) {
      if (object.class !== 'title' && object.class !== 'body') continue;
      const paras = object.paras;
      assert.ok(paras && paras.length > 0, `${object.id} (${object.authored}) states no paragraphs`);
      const node = nodes[i];
      assert.ok(node && node.type === 'text', `${object.id}: the reader returned no text node in its place`);
      assert.equal(node.paras.length, paras.length, `${object.id}: paragraph count`);
      for (const [p, para] of paras.entries()) {
        const read: PptxReadPara | undefined = node.paras[p];
        assert.ok(read, `${object.id} paragraph ${p}: missing`);
        assert.deepEqual(read.runs.map((run) => run.text), para.runs.map((run) => run.text), `${object.id} paragraph ${p}: run texts`);
        assert.equal(read.lvl ?? 0, para.lvl ?? 0, `${object.id} paragraph ${p}: level`);
        // The run properties this reader already reads have to agree with the label
        // now; the rest (strike, baseline, case, bullets, alignment, spacing) are
        // pinned in the XML below until the reader resolves them (plan 275 WP3).
        for (const [r, run] of para.runs.entries()) {
          const got: PptxReadRun | undefined = read.runs[r];
          const where = `${object.id} paragraph ${p} run ${r} (${JSON.stringify(run.text)})`;
          assert.equal(Boolean(got?.bold), Boolean(run.bold), `${where}: bold`);
          assert.equal(Boolean(got?.italic), Boolean(run.italic), `${where}: italic`);
          assert.equal(Boolean(got?.underline), Boolean(run.underline), `${where}: underline`);
          assert.equal(got?.sizePt, run.sizePt, `${where}: size`);
          assert.equal(got?.href, run.href, `${where}: link`);
          // A label names a face only where the run states one literally; every other
          // run inherits the theme face through the cascade, which the label leaves out.
          if (run.font) assert.equal(got?.font, run.font, `${where}: face`);
          else assert.ok(got?.font === undefined || got.font.startsWith('+'), `${where}: a literal face the label does not state`);
        }
      }
    }
  }
});

test('formatting.pptx carries the specification of plan 275 as OOXML', async () => {
  const parts = await partsOf('formatting.pptx');
  const master = textOf(parts, 'ppt/slideMasters/slideMaster1.xml');
  const body = master.match(/<p:bodyStyle>[\s\S]*?<\/p:bodyStyle>/)?.[0] ?? '';
  for (const level of [1, 2, 3]) assert.match(body, new RegExp(`<a:lvl${level}pPr [^>]*><a:buFont [^>]*/><a:buChar char="`), `the master body style lost its level ${level} bullet`);

  // Slide 1: nothing on the slide says bullet, so a reader has to go to the master.
  const slide1 = textOf(parts, 'ppt/slides/slide1.xml');
  assert.doesNotMatch(slide1, /<a:pPr/, 'slide 1 states paragraph properties of its own');
  assert.doesNotMatch(slide1, /<a:bu/, 'slide 1 states a bullet of its own');

  // Slide 2: the seven title runs and the body the evidence note specifies.
  const slide2 = textOf(parts, 'ppt/slides/slide2.xml');
  for (const pattern of [/b="1"/, /i="1"/, /u="sng"/, /strike="sngStrike"/, /<a:srgbClr val="C00000"\/>/, /sz="2000"/,
    /lvl="1"/, /<a:buAutoNum type="arabicPeriod"\/>/, /algn="r"/, /algn="just"/, /<a:buNone\/>/, /baseline="30000"/,
    /baseline="-25000"/, /cap="all"/, /<a:hlinkClick /, /<a:latin typeface="Georgia"\/>/, /<a:lnSpc><a:spcPct val="150000"\/>/,
    /<a:spcBef><a:spcPts val="1200"\/>/]) {
    assert.match(slide2, pattern, `slide 2 lost ${pattern}`);
  }
  assert.equal([...slide2.matchAll(/<a:buAutoNum /g)].length, 2);
  const rels = textOf(parts, 'ppt/slides/_rels/slide2.xml.rels');
  assert.match(rels, /Target="https:\/\/lolly\.tools\/" TargetMode="External"/);

  // The label states the same facts as contract fields, so WP3's reader has an answer to meet.
  const labels = readLabels275('formatting.pptx');
  const bodyOf = (slide: number) => labels.slides[slide]?.objects.find((object) => object.authored === 'body');
  const titleRuns = labels.slides[1]?.objects.find((object) => object.authored === 'title')?.paras?.[0]?.runs ?? [];
  assert.deepEqual(titleRuns.map((run) => run.text.trim()), ['Plain', 'Bold', 'Italic', 'Under', 'Strike', 'Red', 'Small']);
  assert.equal(titleRuns.find((run) => run.strike)?.text, ' Strike');
  assert.equal(titleRuns.find((run) => run.color)?.color?.hex, '#C00000');
  const spec = bodyOf(1)?.paras ?? [];
  assert.deepEqual(spec.map((para) => para.bullet), ['bullet', 'bullet', 'number', 'number', 'none', 'none']);
  assert.deepEqual(spec.map((para) => para.align ?? null), [null, null, null, null, 'right', 'justify']);
  assert.deepEqual(spec.filter((para) => para.bullet === 'number').map((para) => para.number), [1, 2]);
  assert.deepEqual(spec[4]?.runs.flatMap((run) => (run.baseline ? [run.baseline] : [])), ['super', 'sub']);
  assert.equal(spec[4]?.runs.find((run) => run.case)?.case, 'upper');
  assert.equal(spec[5]?.runs.find((run) => run.href)?.href, 'https://lolly.tools/');
  assert.equal(spec[5]?.runs.find((run) => run.font)?.fontProvenance, 'literal');
  for (const para of bodyOf(0)?.paras ?? []) assert.equal(para.bulletSource, 'master');
  const lists = bodyOf(2)?.paras ?? [];
  assert.deepEqual(lists.map((para) => para.bulletSource), ['master', 'master', 'master', 'master', 'slide', 'slide', 'slide']);
  assert.deepEqual(lists.map((para) => para.lvl ?? 0), [0, 0, 1, 2, 0, 0, 0]);
  assert.equal(new Set(lists.slice(0, 4).map((para) => para.bulletChar)).size, 3, 'each master level draws its own glyph');
  assert.equal(lists[4]?.bullet, 'none', 'the explicit buNone stops the inherited bullet');
  assert.equal(lists[4]?.runs[0]?.italic, true);
});

// ─── plan 275: structures.pptx ───────────────────────────────────────────────

/** The structures plan 275 section 3 asks the sixth fixture to hold, in slide order. */
const EXPECTED_STRUCTURES = [
  { id: 'columns-3', read: 'columns-3', band: 'clear' },
  { id: 'columns-4', read: 'columns-4', band: 'clear' },
  { id: 'grid-2x2', read: 'grid-2x2', band: 'clear' },
  { id: 'stats-3', read: 'stats-3', band: 'clear' },
  { id: 'images-3', read: 'image-row-3', band: 'clear' },
  { id: 'table', read: 'table', band: 'clear' },
  { id: 'text-and-image', read: 'text-and-image', band: 'likely' },
  { id: 'numbered-rows', read: 'stack-4', band: 'clear' },
] as const;

test('structures.pptx labels one structure per slide, with its band and its units', () => {
  const labels = readLabels275('structures.pptx');
  assert.deepEqual(labels.slides.map((slide) => ({ id: slide.structure?.id, read: slide.structure?.read, band: slide.structure?.band })),
    EXPECTED_STRUCTURES.map((expected) => ({ ...expected })));
  for (const slide of labels.slides) {
    const structure = slide.structure;
    assert.ok(structure, `${slide.id} states no structure`);
    assert.ok((LAYOUT_MATCH_BANDS as readonly string[]).includes(structure.band), `${slide.id}: unknown band`);
    assert.ok(structure.evidence.length > 0, `${slide.id}: no evidence sentence`);
    // Every object but the title and the page number belongs to exactly one unit and has a role.
    const members = structure.units.flat();
    assert.equal(new Set(members).size, members.length, `${slide.id}: an object belongs to two units`);
    const content = slide.objects.filter((object) => object.class !== 'title' && object.class !== 'page-number');
    assert.deepEqual([...members].sort(), content.map((object) => object.id).sort(), `${slide.id}: the units do not cover the content`);
    for (const object of content) assert.ok(object.role, `${slide.id} ${object.id}: no role`);
  }
  const unitCounts = labels.slides.map((slide) => slide.structure?.units.length);
  assert.deepEqual(unitCounts, [3, 4, 4, 3, 3, 5, 2, 4]);
});

test('structures.pptx geometry is similar where a rule has a tolerance, and exact where it has none', () => {
  const labels = readLabels275('structures.pptx');
  const boxesOf = (slide: number, role: string) => (labels.slides[slide]?.objects ?? [])
    .filter((object) => object.role === role).map((object) => object.boxPx ?? { x: 0, y: 0, w: 0, h: 0 });
  const spread = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    return ((sorted[sorted.length - 1] ?? 0) - (sorted[0] ?? 0)) / (sorted[Math.floor(sorted.length / 2)] ?? 1);
  };
  // Three columns: not identical, within the fifteen per cent the plan calls the same width.
  const columns = boxesOf(0, 'body').map((box) => box.w);
  assert.ok(new Set(columns).size > 1, 'the columns are exact, so "similar, not exact" is untested');
  assert.ok(spread(columns) <= 0.15, `the column widths spread ${spread(columns)}`);
  // The text-box table: left edges repeat exactly per column, and the columns differ in
  // width, so the cells cannot also read as a grid of equal boxes.
  const cells = boxesOf(5, 'data');
  assert.equal(cells.length, 20);
  assert.equal(new Set(cells.map((box) => box.x)).size, 4);
  assert.ok(spread([...new Set(cells.map((box) => box.w))]) > 0.25, 'the table columns are equal, which a grid rule would also claim');
  // The picture laid over the body: the picture's box lies inside the body's.
  const [body] = boxesOf(6, 'body');
  const [picture] = boxesOf(6, 'visual');
  assert.ok(body && picture && picture.x > body.x && picture.x + picture.w <= body.x + body.w, 'the picture no longer lies over the body');
});

test('structures.pptx pictures are distinct bytes and its layout names no structure', async () => {
  const parts = await partsOf('structures.pptx');
  const media = Object.keys(parts).filter((name) => /^ppt\/media\/image\d+_\d+\.png$/.test(name)).sort();
  assert.equal(media.length, 4);
  const digests = new Set(media.map((name) => Buffer.from(parts[name] ?? new Uint8Array()).toString('base64')));
  assert.equal(digests.size, 4, 'two pictures share bytes, which the census would read as one repeated mark');
  // A layout name is a prior, never the answer, so the one layout every slide uses is neutral.
  assert.match(textOf(parts, 'ppt/slideLayouts/slideLayout1.xml'), /<p:cSld name="Headline">/);
  assert.equal(Object.keys(parts).filter((name) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(name)).length, 1);
});

test('flattened.pdf states its own object id form and the titles painted into it', () => {
  const labels = readLabels('flattened.pdf');
  assert.equal(labels.objectIdForm, '<page id>.<object name>');
  assert.deepEqual(labels.slides.flatMap((slide) => slide.objects.map((object) => object.id)),
    ['page1.Im0', 'page2.Im0', 'page3.Im0']);
  assert.deepEqual(labels.slides.flatMap((slide) => slide.objects.map((object) => object.text)),
    ['REVENUE GROWTH', 'MARKET SHARE', 'NEXT STEPS']);
  for (const name of ['simple.pptx', 'adversarial.pptx', 'palette.pptx'] as const) {
    assert.equal(readLabels(name).objectIdForm, '<slide part base name>.<p:cNvPr id>');
  }
});

test('flattened.pdf is three pages of one full-page picture each', () => {
  const bytes = readFileSync(fixturePath('flattened.pdf'));
  const text = Buffer.from(bytes).toString('latin1');
  assert.match(text, /^%PDF-1\.4/);
  assert.equal([...text.matchAll(/\/Type \/Page[^s]/g)].length, 3);
  assert.equal([...text.matchAll(/\/Subtype \/Image/g)].length, 3);
  assert.equal([...text.matchAll(/\/Filter \/FlateDecode/g)].length, 3);
  assert.match(text, /startxref/);
  const labels = readLabels('flattened.pdf');
  assert.equal(labels.slides.length, 3);
  for (const slide of labels.slides) {
    assert.equal(slide.flattened, true);
    assert.equal(slide.objects.length, 1);
    assert.equal(slide.objects[0]?.origin, 'pdf-artifact');
    assert.equal(slide.objects[0]?.fidelity.state, 'raster-preserved');
  }
});

test('the labels account for every object the packages address', async () => {
  for (const name of PPTX_FIXTURES) {
    const parts = await partsOf(name);
    const labels = labelsOf(name);
    const labelled = new Set(allLabelledObjects(labels).map((object) => object.id));
    const addressed: string[] = [];
    const layoutParts = Object.keys(parts).filter((part) => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(part)).sort();
    assert.ok(layoutParts.length > 0, `${name} has no layout part`);
    for (const part of [...slidePartNames(parts), ...layoutParts, 'ppt/slideMasters/slideMaster1.xml']) {
      const partId = path.basename(part, '.xml');
      for (const object of addressableObjects(textOf(parts, part))) {
        // A master or layout placeholder is a slot the slide fills, not content.
        if (/^ph\d+$/.test(object.name)) continue;
        addressed.push(`${partId}.${object.id}`);
      }
    }
    for (const id of addressed) assert.ok(labelled.has(id), `${name}: ${id} is authored but not labelled`);
    for (const id of labelled) {
      // The fallback half of an mc:AlternateContent pair shares its slide part,
      // so every labelled id has to be addressable too.
      assert.ok(addressed.includes(id), `${name}: ${id} is labelled but no part addresses it`);
    }
    assert.equal(new Set(addressed).size, addressed.length, `${name}: two objects share one id`);
  }
});

test('rebuilding the fixtures reproduces the committed bytes', async () => {
  const scratch = mkdtempSync(path.join(tmpdir(), 'lolly-rebrand-fixtures-'));
  try {
    const written = await buildRebrandFixtures(scratch);
    assert.deepEqual(written.map((fixture) => fixture.name), [...ALL_FIXTURES], 'the builder writes exactly the listed fixtures');
    for (const name of ALL_FIXTURES) {
      const rebuilt = readFileSync(path.join(scratch, name));
      const committed = readFileSync(pathOf(name));
      assert.ok(rebuilt.equals(committed), `${name} differs from a rebuild; run node scripts/build-rebrand-fixtures.ts`);
      const labelsName = path.basename(labelsPathOf(name));
      const rebuiltLabels = readFileSync(path.join(scratch, labelsName), 'utf8');
      assert.ok(
        rebuiltLabels === readFileSync(labelsPathOf(name), 'utf8'),
        `${labelsName} differs from a rebuild; run node scripts/build-rebrand-fixtures.ts`,
      );
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

// ─── the private corpus ──────────────────────────────────────────────────────

test('privateCorpus reads a corpus directory and leaves lock files out', () => {
  const previous = process.env.LOLLY_REBRAND_FIXTURES;
  const scratch = mkdtempSync(path.join(tmpdir(), 'lolly-rebrand-corpus-'));
  try {
    mkdirSync(path.join(scratch, 'slides-to-test'));
    writeFileSync(path.join(scratch, 'deck.pptx'), 'x');
    writeFileSync(path.join(scratch, '~$deck.pptx'), 'x');
    writeFileSync(path.join(scratch, 'notes.txt'), 'x');
    writeFileSync(path.join(scratch, 'slides-to-test', 'report.pdf'), 'x');
    process.env.LOLLY_REBRAND_FIXTURES = scratch;
    const corpus = privateCorpus();
    assert.ok(corpus);
    assert.deepEqual(corpus.files.map((file) => path.basename(file)), ['deck.pptx']);
    assert.deepEqual(corpus.slidesToTest.map((file) => path.basename(file)), ['report.pdf']);
    assert.equal(skipReason(), null);
    process.env.LOLLY_REBRAND_FIXTURES = path.join(scratch, 'nowhere');
    assert.equal(privateCorpus(), null);
    assert.ok(skipReason()?.includes('LOLLY_REBRAND_FIXTURES'));
    delete process.env.LOLLY_REBRAND_FIXTURES;
    assert.equal(privateCorpus(), null);
  } finally {
    if (previous === undefined) delete process.env.LOLLY_REBRAND_FIXTURES;
    else process.env.LOLLY_REBRAND_FIXTURES = previous;
    rmSync(scratch, { recursive: true, force: true });
  }
});

test('the private deck corpus lists the decks the census is tuned on', { skip: skipReason() ?? false }, () => {
  const corpus = privateCorpus();
  assert.ok(corpus, 'privateCorpus returned nothing with LOLLY_REBRAND_FIXTURES set');
  const all = [...corpus.files, ...corpus.slidesToTest];
  assert.ok(all.length > 0, `no .pptx or .pdf files under ${corpus.root}`);
  for (const file of all) {
    assert.ok(/\.(pptx|pdf)$/i.test(file), `${file} is not a deck or a pdf`);
    assert.ok(!path.basename(file).startsWith('~$'), `${file} is a lock file, not a deck`);
    assert.ok(readFileSync(file).length > 0, `${file} is empty`);
  }
});
