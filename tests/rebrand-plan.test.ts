// SPDX-License-Identifier: MPL-2.0
/**
 * The renovation plan's first pass (plan 274 sections 3.3 and 9, work package 4).
 *
 * Read the three synthetic pptx fixtures into the stage-1 model, take the
 * census, run `firstPass` against the neutral slide master from
 * `brands/lolly-start`, and check the three things section 9 asks for: no false
 * removals, a group action over the partner marks, and a colour assignment that
 * refuses rather than collapses. Each plan is also validated against
 * `schemas/rebrand-plan-v1.schema.json`, so the contract and the code cannot
 * drift apart quietly.
 *
 * The labels sidecar states a box, not an id: `readPptx` does not report a
 * shape's `p:cNvPr@id`, so the source adapter mints ids from z-order. Boxes line
 * up to the pixel, which is how `tests/rebrand-census.test.ts` matches too.
 *
 * Run with: node --test "tests/rebrand-plan.test.ts"
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

import { censusDeck } from '../engine/src/deck-census.ts';
import { CENSUS_RULES } from '../engine/src/deck-census-rules.ts';
import type { BrandSwatchV1 } from '../engine/src/rebrand-colors.ts';
import {
  CHART_OFFER_MAX_CATEGORIES,
  CHART_OFFER_MAX_SERIES,
  PLAN_RULES,
  archetypeHints,
  chartToolOffer,
  firstPass,
  isCoverSlide,
  layoutFindings,
  type FirstPassDesignSystemV1,
} from '../engine/src/rebrand-plan.ts';
import { parseToolUrl } from '../engine/src/tool-url.ts';
import { inflatePptx } from '../packages/node-shell/src/pptx.ts';
import { sourceDeckFromPptx } from '../packages/node-shell/src/rebrand/index.ts';
import type {
  DeckCensusV1,
  ObjectPlanV1,
  RenovationPlanV1,
  SlideMasterFileV1,
  SlideMasterV1,
  SlideSourceV1,
  SourceDeckV1,
  SourceObjectV1,
} from '../packages/core/src/index.ts';
import { openPendingIds } from '../engine/src/rebrand-review.ts';
import {
  allLabelledObjects,
  privateCorpus,
  privateLabels,
  readFixture,
  readLabels,
  skipReason,
  type FixtureObjectLabelV1,
  type SyntheticFixtureName,
} from './helpers/rebrand-fixtures.ts';

const read = (rel: string): unknown => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));

const MASTER = ((read('../brands/lolly-start/catalog/assets/lolly/slides/masters.json') as SlideMasterFileV1)
  .masters[0]) as SlideMasterV1;

type AjvCtor = new (opts: unknown) => { compile: (s: unknown) => ((d: unknown) => boolean) & { errors?: unknown } };
const validatePlan = new (Ajv as unknown as AjvCtor)({ allErrors: true, strict: false })
  .compile(read('../schemas/rebrand-plan-v1.schema.json'));

const win = new JSDOM('').window;
const domParser = new win.DOMParser();
const parseXml = (xml: string): Document => domParser.parseFromString(xml, 'application/xml') as unknown as Document;

const PPTX_FIXTURES: SyntheticFixtureName[] = ['simple.pptx', 'adversarial.pptx', 'palette.pptx'];

const SWATCHES: BrandSwatchV1[] = [
  { path: 'color.semantic.surface', hex: '#FFFFFF', role: 'bg' },
  { path: 'color.semantic.text', hex: '#0C322C', role: 'ink' },
  { path: 'color.accent.1', hex: '#30BA78', role: 'accent' },
  { path: 'color.accent.2', hex: '#FE7C3F', role: 'accent' },
  { path: 'color.accent.3', hex: '#2453FF', role: 'accent' },
  { path: 'color.accent.4', hex: '#9B59B6', role: 'accent' },
  { path: 'color.ramp.neutral.5', hex: '#7C7C7C', role: 'neutral' },
];

const DESIGN_SYSTEM: FirstPassDesignSystemV1 = {
  snapshot: {
    id: 'lolly/start',
    masterId: MASTER.id,
    masterVersion: MASTER.version,
    tokenHash: `sha256:${'1'.repeat(64)}`,
    fontHashes: {},
    assetHashes: {},
  },
  swatches: SWATCHES,
  fonts: { brand: 'Inter', mono: 'JetBrains Mono' },
  master: MASTER,
};

const ALGORITHMS = { reader: 'pptx-read/test', census: CENSUS_RULES.version, plan: PLAN_RULES.version };

interface Read {
  deck: SourceDeckV1;
  census: DeckCensusV1;
  plan: RenovationPlanV1;
}

const cache = new Map<SyntheticFixtureName, Promise<Read>>();

function readFixturePlan(name: SyntheticFixtureName): Promise<Read> {
  const found = cache.get(name);
  if (found) return found;
  const pending = (async (): Promise<Read> => {
    const bytes = readFixture(name);
    const parts = await inflatePptx(bytes);
    const deck = await sourceDeckFromPptx(parts, parseXml, {
      hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      instanceId: 'plan-test',
      name,
      bytes: bytes.byteLength,
      sink: async (_media, _mime, hint) => `user/media/${hint.slice(0, 16)}`,
      reader: { name: 'pptx-read', version: 'test' },
    });
    const census = censusDeck(deck);
    const plan = firstPass({ source: deck, census, designSystem: DESIGN_SYSTEM, algorithms: ALGORITHMS });
    return { deck, census, plan };
  })();
  cache.set(name, pending);
  return pending;
}

function objectsOf(deck: SourceDeckV1): SourceObjectV1[] {
  return deck.slides.flatMap((slide) => slide.objects);
}

function planRows(plan: RenovationPlanV1): ObjectPlanV1[] {
  return plan.slides.flatMap((slide) => slide.objects);
}

/** The labelled object whose box matches this one to the pixel, if there is one. */
function labelFor(labels: FixtureObjectLabelV1[], object: SourceObjectV1): FixtureObjectLabelV1 | undefined {
  return labels.find((label) => {
    const want = label.boxPx;
    if (!want) return false;
    return Math.abs(object.box.x - want.x) <= 1
      && Math.abs(object.box.y - want.y) <= 1
      && Math.abs(object.box.w - want.w) <= 1
      && Math.abs(object.box.h - want.h) <= 1;
  });
}

/** The same master with a different body slot, for the overflow case. */
function withBodyBox(master: SlideMasterV1, box: { x: number; y: number; w: number; h: number }): SlideMasterV1 {
  return {
    ...master,
    archetypes: master.archetypes.map((archetype) => ({
      ...archetype,
      placeholders: archetype.placeholders.map((slot) => (slot.role === 'body' ? { ...slot, box } : slot)),
    })),
  };
}

function effective(row: ObjectPlanV1): string {
  return row.decision ?? row.proposal;
}

// ─── the contract ────────────────────────────────────────────────────────────

for (const name of PPTX_FIXTURES) {
  test(`${name}: the first pass validates against schemas/rebrand-plan-v1.schema.json`, async () => {
    const { deck, plan } = await readFixturePlan(name);
    assert.equal(validatePlan(plan), true, JSON.stringify(validatePlan.errors, null, 1));
    assert.equal(plan.version, 1);
    assert.equal(plan.mode, 'renovate');
    assert.equal(plan.revision, 1);
    assert.equal(plan.source.hash, deck.source.hash);
    assert.deepEqual(plan.logo, { policy: 'brand', variantByBackground: true });
    assert.equal(plan.slides.length, deck.slides.length);
    assert.equal(planRows(plan).length, objectsOf(deck).length, 'every source object reaches the plan exactly once');
    for (const slide of plan.slides) {
      assert.equal(slide.include, true, 'nothing is excluded without a preset saying so');
      assert.equal(slide.layoutSource, 'proposed');
    }
  });

  test(`${name}: the same inputs give the same plan twice`, async () => {
    const { deck, census } = await readFixturePlan(name);
    const once = firstPass({ source: deck, census, designSystem: DESIGN_SYSTEM, algorithms: ALGORITHMS });
    const twice = firstPass({ source: deck, census, designSystem: DESIGN_SYSTEM, algorithms: ALGORITHMS });
    assert.deepEqual(once, twice);
  });

  test(`${name}: nothing a label marks mustKeep is proposed for removal`, async () => {
    const { deck, plan } = await readFixturePlan(name);
    const labels = allLabelledObjects(readLabels(name));
    const byId = new Map(planRows(plan).map((row) => [row.id, row]));
    let checked = 0;

    for (const object of objectsOf(deck)) {
      const label = labelFor(labels, object);
      if (!label?.mustKeep) continue;
      const row = byId.get(object.id);
      assert.ok(row, `no plan row for ${object.id}`);
      checked += 1;
      assert.notEqual(effective(row), 'remove', `${label.authored} (${object.id}) was proposed for removal`);
      if (label.class === 'logo-candidate' || label.class === 'known-logo') {
        // A mark is not removed, but it is not silently kept either: the plan
        // proposes the brand's own mark and asks a person to confirm the group.
        assert.equal(effective(row), 'replace');
        assert.equal(row.review, 'needs-attention');
        continue;
      }
      assert.equal(effective(row), 'keep', `${label.authored} (${object.id}) should be kept`);
    }
    assert.ok(checked > 0, `${name} states objects a default plan must not remove`);
  });
}

// ─── the false-removal cases plan 274 section 9 names one by one ─────────────

test('the confidentiality line, the citation, the chart key and the small unit note all survive', async () => {
  const { deck, plan } = await readFixturePlan('adversarial.pptx');
  const rows = new Map(planRows(plan).map((row) => [row.id, row]));
  const textOf = (object: SourceObjectV1): string =>
    (object.text?.paras ?? []).map((para) => para.runs.map((run) => run.text).join('')).join('\n');

  const cases: Array<{ needle: string; klass: string }> = [
    { needle: 'Confidential', klass: 'recurring-text' },
    { needle: 'Source:', klass: 'footer' },
    { needle: 'Key:', klass: 'recurring-text' },
    { needle: 'Figures in EUR millions', klass: 'body' },
  ];

  for (const one of cases) {
    const found = objectsOf(deck).filter((object) => textOf(object).includes(one.needle));
    assert.ok(found.length > 0, `the adversarial fixture no longer carries "${one.needle}"`);
    for (const object of found) {
      const row = rows.get(object.id);
      assert.ok(row);
      assert.equal(effective(row), 'keep', `"${one.needle}" was not kept`);
      assert.equal(row.class, one.klass);
    }
  }

  // The repeated lines that carry words ask for a look; the unit note is body
  // text and is simply kept.
  for (const needle of ['Confidential', 'Source:', 'Key:']) {
    const object = objectsOf(deck).find((one) => textOf(one).includes(needle));
    assert.ok(object);
    assert.equal(rows.get(object.id)?.review, 'needs-attention', `"${needle}" should ask for a look`);
  }
});

test('page numbers and the repeated band are proposed for removal, and wait unreviewed for an answer', async () => {
  const { plan } = await readFixturePlan('simple.pptx');
  const rows = planRows(plan);
  const removed = rows.filter((row) => row.proposal === 'remove');
  assert.equal(removed.length, 6, 'three page numbers and three bands');
  for (const row of removed) {
    assert.ok(row.class === 'page-number' || row.class === 'decoration', `${row.class} is not one the archetypes bring back`);
    assert.equal(row.review, 'unreviewed', 'a rule proposed it; accepted is an answer only a person, an agent or a preset gives');
    assert.equal(row.decision, undefined, 'a proposal is not a decision');
    assert.equal(row.proposalReplacement, undefined);
  }
});

test('the photograph is kept and asks for a look, with the offers one tap away', async () => {
  const { deck, plan } = await readFixturePlan('simple.pptx');
  const labels = allLabelledObjects(readLabels('simple.pptx'));
  const photo = objectsOf(deck).find((object) => labelFor(labels, object)?.authored === 'photo');
  assert.ok(photo, 'the simple fixture carries one photograph');
  const row = planRows(plan).find((one) => one.id === photo.id);
  assert.ok(row);
  assert.equal(effective(row), 'keep');
  assert.equal(row.review, 'needs-attention');
  // The census reads it as `unknown`, because nothing decoded its pixels and
  // no text recognition ran: "no text found" was never established.
  assert.equal(row.class, 'unknown');
});

test('a native chart with nothing to show is kept and asks for a look', async () => {
  const { deck, plan } = await readFixturePlan('adversarial.pptx');
  const unavailable = objectsOf(deck).filter((object) => object.fidelity.state === 'unavailable');
  assert.ok(unavailable.length > 0, 'the adversarial fixture carries a chart with no fallback');
  for (const object of unavailable) {
    const row = planRows(plan).find((one) => one.id === object.id);
    assert.ok(row);
    assert.equal(effective(row), 'keep', 'an unreadable object is carried as an unresolved record, never dropped');
    assert.equal(row.review, 'needs-attention');
  }
});

// ─── the logo group ──────────────────────────────────────────────────────────

test('the three partner marks are one group action, named by scope on every member', async () => {
  const { census, plan } = await readFixturePlan('adversarial.pptx');
  const group = census.groups.find((one) => one.class === 'logo-candidate');
  assert.ok(group, 'the three partner marks verify into one group');
  assert.equal(group.members.length, 3);

  const rows = planRows(plan).filter((row) => row.class === 'logo-candidate');
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => row.id).sort(), [...group.members].sort(),
    'the proposal names every member of the group');
  for (const row of rows) {
    assert.equal(row.scope, group.id, 'a group action reaches its members through one scope');
    assert.equal(row.proposal, 'replace');
    assert.equal(row.review, 'needs-attention', 'a person confirms the group before a replacement applies');
    assert.deepEqual(row.proposalReplacement, { kind: 'brand-logo', variant: 'auto' });
    assert.equal(row.decision, undefined);
  }
});

// ─── colours ─────────────────────────────────────────────────────────────────

test('the palette fixture: eight series against four accents is unresolved, not collapsed', async () => {
  const { plan } = await readFixturePlan('palette.pptx');
  const series = plan.colors.filter((row) => row.role === 'series');
  assert.equal(series.length, 8, 'the fixture states eight series');
  for (const row of series) {
    assert.equal(row.unresolved, 'palette-too-small');
    assert.equal(row.to, undefined);
  }
  const assigned = plan.colors.filter((row) => row.to !== undefined);
  assert.ok(assigned.length > 0, 'the rest of the deck still gets its colours');
  assert.ok(assigned.every((row) => row.affects.length > 0 || row.useId.endsWith(':fill')));
});

test('a mapping never claims to reach a picture', async () => {
  const { deck, plan } = await readFixturePlan('simple.pptx');
  const raster = new Set(objectsOf(deck)
    .filter((object) => object.kind === 'pic' || object.fidelity.state === 'raster-preserved')
    .map((object) => object.id));
  assert.ok(raster.size > 0);
  for (const row of plan.colors) {
    for (const id of row.affects) {
      assert.ok(!raster.has(id), `${row.useId} claims to recolour the picture ${id}`);
    }
  }
});

// ─── fonts ───────────────────────────────────────────────────────────────────

test('every source face reaches a design-system face, none of them the source one', async () => {
  for (const name of PPTX_FIXTURES) {
    const { deck, plan } = await readFixturePlan(name);
    assert.equal(plan.fonts.length, new Set(deck.fonts.map((font) => font.family)).size);
    for (const row of plan.fonts) {
      assert.ok(row.to === 'Inter' || row.to === 'JetBrains Mono', `${row.from} went to ${row.to}`);
      assert.notEqual(row.to, row.from);
      assert.ok(row.source === 'alias' || row.source === 'class');
    }
  }
  const { plan } = await readFixturePlan('simple.pptx');
  assert.deepEqual(plan.fonts, [{ from: 'Calibri', to: 'Inter', source: 'alias' }]);
});

// ─── archetypes ──────────────────────────────────────────────────────────────

test('the archetype per slide, as this master and these rules answer today', async () => {
  // Coverage first: a layout that holds every kind of content the slide keeps
  // outranks a plainer one that would send a picture or a chart to another slide.
  const simple = await readFixturePlan('simple.pptx');
  assert.deepEqual(simple.plan.slides.map((slide) => slide.layout), ['content', 'split', 'content'],
    'the photo slide keeps a title, body text and the photo, which only the split layout holds together');

  const adversarial = await readFixturePlan('adversarial.pptx');
  const layouts = adversarial.plan.slides.map((slide) => ({ id: slide.layout, alt: slide.layoutAlternative }));
  assert.deepEqual(layouts[0], { id: 'content', alt: undefined }, 'a title over short bodies and notes is a content slide');
  assert.deepEqual(layouts[1], { id: 'split', alt: 'chart' },
    'a chart with its unit line needs a picture slot and a text slot to close, which the split layout has; the matcher offers the chart layout, one box short');
  // The third slide holds a table, a chart picture and two columns of text. No
  // layout holds all four; the split layout holds three, and the table goes on
  // to a continuation slide seeded from the table layout. The matcher reads a chart
  // on the right beside half the text, a likely read, offered as the alternative.
  assert.deepEqual(layouts[2], { id: 'split', alt: 'chart-and-callout' });

  const palette = await readFixturePlan('palette.pptx');
  // One chart under a title and nothing else is a clear read of the library's chart
  // layout, which the master carries, so the first pass sets it (plan 275 section 3.3).
  assert.deepEqual(palette.plan.slides.map((slide) => slide.layout), ['content', 'chart']);
});

// ─── the chart tool offer ────────────────────────────────────────────────────

test('a native chart with readable data records a rebuild offer, and the proposal stays keep', async () => {
  const { deck, plan } = await readFixturePlan('adversarial.pptx');
  const charts = objectsOf(deck).filter((object) => object.chartData !== undefined);
  assert.ok(charts.length > 0, 'the adversarial fixture carries native charts with their caches read');

  let offered = 0;
  for (const object of charts) {
    const row = planRows(plan).find((one) => one.id === object.id);
    assert.ok(row);
    assert.equal(row.proposal, 'keep', 'a rebuilt chart is an interpretation, so the default stays keep');
    const offer = chartToolOffer(object);
    if (!offer) continue;
    offered += 1;
    assert.equal(offer.kind, 'tool');
    assert.deepEqual(row.proposalReplacement, offer, 'the offer is recorded beside the keep');
    const url = new URL((offer as { url: string }).url);
    assert.equal(url.searchParams.get('ct'), 'bar');
    assert.match(url.searchParams.get('d') ?? '', /^Category,/);
  }
  assert.ok(offered > 0, 'at least one chart states a plot type the chart tool can draw');
});

test('a chart with no readable data is offered nothing', async () => {
  const bare: SourceObjectV1 = {
    id: 'slide1.9',
    fingerprint: 'chart:0001',
    kind: 'chart',
    box: { x: 0, y: 0, w: 100, h: 100, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'unavailable', reason: 'native-chart-no-fallback' },
    tag: 'chart',
  };
  assert.equal(chartToolOffer(bare), undefined);
  assert.equal(chartToolOffer({ ...bare, chartData: { type: 'surfaceChart', series: [{ values: [1, 2] }] } }), undefined,
    'a plot the chart tool cannot draw is not offered');
});

// ─── hard layout findings ────────────────────────────────────────────────────

test('the fixtures overflow nothing, because renovate mode re-flows into the archetype box', async () => {
  // The adversarial fixture's "overflowing body" is 200 characters in a 420 by
  // 90 box. The neutral master's content body slot is 1192 by 505 at 24px, so
  // the same words fit with room to spare. Overflow in renovate mode is a fact
  // about the TARGET box, never about the source one.
  for (const name of PPTX_FIXTURES) {
    const { deck, plan } = await readFixturePlan(name);
    assert.deepEqual(layoutFindings(plan, deck, MASTER), [], `${name} reported a finding it should not`);
  }
});

test('a master whose body slot is small reports the overflow with its numbers', async () => {
  const { deck, plan } = await readFixturePlan('adversarial.pptx');
  const cramped = withBodyBox(MASTER, { x: 0.05, y: 0.7, w: 0.2, h: 0.05 });
  const findings = layoutFindings(plan, deck, cramped);
  const overflow = findings.filter((entry) => entry.code === 'text.overflow');
  assert.ok(overflow.length > 0, 'the 200-character body cannot fit a 256 by 36 slot at 24px');
  for (const entry of overflow) {
    assert.ok(entry.slideId && entry.objectId);
    assert.equal(entry.action, 'keep');
    assert.match(entry.message, /\d+ characters at \d+px estimate \d+ lines/);
    assert.match(entry.message, /a shaped measurement replaces it/);
  }
  // Sorted, and repeatable.
  assert.deepEqual(findings, layoutFindings(plan, deck, cramped));
  const keys = findings.map((entry) => `${entry.slideId}|${entry.objectId}|${entry.code}`);
  assert.deepEqual(keys, [...keys].sort());
});

test('a master whose type scale is under the readable floor reports it per object', async () => {
  const { deck, plan } = await readFixturePlan('simple.pptx');
  const tiny: SlideMasterV1 = { ...MASTER, typeScale: { ...MASTER.typeScale, body: 8 } };
  const findings = layoutFindings(plan, deck, tiny).filter((entry) => entry.code === 'layout.below-readable-size');
  assert.ok(findings.length > 0);
  for (const entry of findings) assert.match(entry.message, /8px at the master size, under the 12px floor/);
});

test('layoutFindings says nothing about a slide left out of the renovation', async () => {
  const { deck, census } = await readFixturePlan('adversarial.pptx');
  const plan = firstPass({
    source: deck,
    census,
    designSystem: DESIGN_SYSTEM,
    algorithms: ALGORITHMS,
    preset: { id: 'none', excludeSlideIds: deck.slides.map((slide) => slide.id) },
  });
  for (const slide of plan.slides) assert.equal(slide.include, false);
  assert.deepEqual(layoutFindings(plan, deck, withBodyBox(MASTER, { x: 0.05, y: 0.7, w: 0.2, h: 0.05 })), []);
});

// ─── the preset ──────────────────────────────────────────────────────────────

test('a preset states the few things it wants different and nothing else', async () => {
  const { deck, census } = await readFixturePlan('simple.pptx');
  const plan = firstPass({
    source: deck,
    census,
    designSystem: DESIGN_SYSTEM,
    algorithms: ALGORITHMS,
    seed: 11,
    preset: {
      id: 'tidy',
      actions: { unknown: 'remove' },
      review: { unknown: 'accepted' },
      logo: { policy: 'drop', variantByBackground: false },
      layout: { bySourceLayout: { 'ppt/slideLayouts/slideLayout1.xml': 'agenda' } },
    },
  });
  assert.equal(validatePlan(plan), true, JSON.stringify(validatePlan.errors, null, 1));
  assert.equal(plan.presetId, 'tidy');
  assert.equal(plan.shuffleSeed, 11);
  assert.deepEqual(plan.logo, { policy: 'drop', variantByBackground: false });
  for (const slide of plan.slides) {
    assert.equal(slide.layout, 'agenda');
    assert.equal(slide.layoutSource, 'preset');
  }
  const unknown = planRows(plan).filter((row) => row.class === 'unknown');
  assert.ok(unknown.length > 0);
  for (const row of unknown) {
    assert.equal(row.proposal, 'remove');
    assert.equal(row.review, 'accepted');
    assert.equal(row.author, 'preset', 'a preset action is recorded as the preset\'s, not a rule\'s');
  }
});

// ─── carry-forward through the plan ──────────────────────────────────────────

test('a second revision carries a decision onto the new plan and counts what it could not', async () => {
  const { deck, census, plan } = await readFixturePlan('simple.pptx');
  const title = planRows(plan).find((row) => row.class === 'title');
  assert.ok(title);
  const slideId = deck.slides.find((slide) => slide.objects.some((object) => object.id === title.id))?.id;
  const fingerprint = deck.slides.flatMap((slide) => slide.objects).find((object) => object.id === title.id)?.fingerprint;
  assert.ok(slideId && fingerprint);

  const previous: RenovationPlanV1 = {
    ...plan,
    slides: plan.slides.map((slide) => ({
      ...slide,
      objects: slide.objects.map((row) => (row.id === title.id
        ? { ...row, decision: 'remove' as const, review: 'accepted' as const, author: 'user' as const }
        : row)),
    })),
    decisions: [{ fingerprint, slideLineage: slideId, action: 'remove', author: 'user', planRevision: 1 }],
  };

  const next = firstPass({ source: deck, census, designSystem: DESIGN_SYSTEM, algorithms: ALGORITHMS, previous });
  assert.equal(validatePlan(next), true, JSON.stringify(validatePlan.errors, null, 1));
  assert.equal(next.revision, 2);
  assert.deepEqual(next.carryForward, { carried: [title.id], needsReview: [] });

  const carriedRow = planRows(next).find((row) => row.id === title.id);
  assert.ok(carriedRow);
  assert.equal(carriedRow.decision, 'remove', 'the person\'s decision beat the rule\'s proposal');
  assert.equal(carriedRow.proposal, 'keep', 'the proposal is still stated beside it');
  assert.equal(carriedRow.author, 'user');
  assert.equal(next.decisions[0]?.carriedBy, 'exact');
});

// ─── the hints read the slide the plan keeps ─────────────────────────────────

test('a page number and a footer never choose the layout', () => {
  // The hints used to read every text object on the slide, including the ones
  // the same pass proposes for removal, so a page number on its own made the
  // slide a big-number one and a quoted footer made it a quotation.
  const furniture = (id: string, body: string, y: number): SourceObjectV1 => ({
    id,
    fingerprint: `text:${id}`,
    kind: 'text',
    box: { x: 1180, y, w: 60, h: 30, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'editable' },
    text: { paras: [{ runs: [{ text: body, sizePt: 10 }] }] },
  });
  const slide: SlideSourceV1 = {
    id: 'slide1',
    index: 1,
    width: 1280,
    height: 720,
    background: {},
    objects: [furniture('slide1.2', '7', 660), furniture('slide1.3', '"Internal use only"', 690)],
    readingOrder: ['slide1.2', 'slide1.3'],
    warnings: [],
    origin: { kind: 'pptx' },
  };

  assert.deepEqual(archetypeHints(slide), { quoteMarks: true, bigNumber: true },
    'read whole, the two furniture lines look like a figure and a quotation');
  assert.deepEqual(archetypeHints(slide, { skipObjectIds: new Set(['slide1.2', 'slide1.3']) }),
    { quoteMarks: false, bigNumber: false },
    'the layout is chosen from what the plan keeps, not from what it removes');
  assert.equal(isCoverSlide(slide), false);
  assert.equal(isCoverSlide({ ...slide, index: 0 }), true);
  assert.equal(isCoverSlide(slide, 'ppt/slideLayouts/Title Slide.xml'), true);
});

// ─── the preset does not inherit the rule's review ───────────────────────────

test('a preset that overrides the action and states no review reaches the queue', async () => {
  const { deck, census } = await readFixturePlan('simple.pptx');
  const plan = firstPass({
    source: deck,
    census,
    designSystem: DESIGN_SYSTEM,
    algorithms: ALGORITHMS,
    preset: { id: 'blunt', actions: { title: 'remove' } },
  });
  assert.equal(validatePlan(plan), true, JSON.stringify(validatePlan.errors, null, 1));
  const titles = planRows(plan).filter((row) => row.class === 'title');
  assert.ok(titles.length > 0, 'the simple fixture carries titles');
  for (const row of titles) {
    assert.equal(row.proposal, 'remove');
    assert.equal(row.author, 'preset');
    assert.equal(row.review, 'needs-attention',
      'the rule marked a kept title accepted; a preset removal is a different question');
    assert.equal(row.role, undefined, 'a row that will be removed states no role');
  }

  // A preset that states a review of its own is still taken at its word.
  const stated = firstPass({
    source: deck,
    census,
    designSystem: DESIGN_SYSTEM,
    algorithms: ALGORITHMS,
    preset: { id: 'blunt', actions: { title: 'remove' }, review: { title: 'accepted' } },
  });
  for (const row of planRows(stated).filter((row) => row.class === 'title')) {
    assert.equal(row.review, 'accepted');
  }
});

// ─── the effective action, not the proposal, drives the derived fields ───────

test('a carried decision that turns a replace into a keep gives the row a usable role', async () => {
  const { deck, census, plan } = await readFixturePlan('adversarial.pptx');
  const mark = planRows(plan).find((row) => row.class === 'logo-candidate');
  assert.ok(mark, 'the adversarial fixture carries partner marks');
  assert.equal(mark.proposal, 'replace');
  assert.equal(mark.role, undefined, 'a replaced mark holds no role of its own');

  const slideId = deck.slides.find((slide) => slide.objects.some((object) => object.id === mark.id))?.id;
  const fingerprint = objectsOf(deck).find((object) => object.id === mark.id)?.fingerprint;
  assert.ok(slideId && fingerprint);

  const previous: RenovationPlanV1 = {
    ...plan,
    slides: plan.slides.map((slide) => ({
      ...slide,
      objects: slide.objects.map((row) => (row.id === mark.id
        ? { ...row, decision: 'keep' as const, review: 'accepted' as const, author: 'user' as const }
        : row)),
    })),
    decisions: [{ fingerprint, slideLineage: slideId, action: 'keep', author: 'user', planRevision: 1 }],
  };

  const next = firstPass({ source: deck, census, designSystem: DESIGN_SYSTEM, algorithms: ALGORITHMS, previous });
  assert.equal(validatePlan(next), true, JSON.stringify(validatePlan.errors, null, 1));
  const row = planRows(next).find((one) => one.id === mark.id);
  assert.ok(row);
  assert.equal(row.decision, 'keep');
  assert.equal(row.role, 'visual', 'the contract says the effective action is decision ?? proposal');
  assert.deepEqual(row.proposalReplacement, { kind: 'brand-logo', variant: 'auto' },
    'the proposal and what it would have replaced the mark with are still stated beside the decision');
  assert.equal(row.decisionReplacement, undefined, 'a kept mark replaces nothing');
});

// ─── the chart offer is a link something can read back ───────────────────────

test('the widest chart the offer carries still reads back through parseToolUrl', () => {
  const wide: SourceObjectV1 = {
    id: 'slide1.9',
    fingerprint: 'chart:0002',
    kind: 'chart',
    box: { x: 0, y: 0, w: 100, h: 100, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'editable' },
    tag: 'chart',
    chartData: {
      type: 'barChart',
      categories: Array.from({ length: CHART_OFFER_MAX_CATEGORIES }, (_, i) => `A long category label number ${i + 1}`),
      series: Array.from({ length: CHART_OFFER_MAX_SERIES }, (_, i) => ({
        name: `A long series name number ${i + 1}`,
        values: Array.from({ length: CHART_OFFER_MAX_CATEGORIES }, (_, row) => (i + 1) * 1000 + row),
      })),
    },
  };
  const offer = chartToolOffer(wide);
  assert.ok(offer, 'a chart too wide for one link is offered with fewer rows, not dropped');
  assert.equal(offer.kind, 'tool');
  const url = (offer as { url: string }).url;
  const parsed = parseToolUrl(url);
  assert.ok(parsed, 'the offer is a link host.compose.renderUrl can read back');
  assert.equal(parsed.toolId, 'chart');
  assert.equal(parsed.format, 'svg');
  assert.match(new URLSearchParams(parsed.query).get('d') ?? '', /^Category,/);
});

// ─── the overflow estimate is the compile's own ──────────────────────────────

test('a three-paragraph body is measured paragraph by paragraph, the way the compile measures it', () => {
  // Three short lines fit on one line when the characters are added up and
  // three when each paragraph takes a line of its own. The compile counts the
  // second way and spills to a continuation frame, so this pass has to raise
  // the finding rather than stay silent about the same object.
  const object: SourceObjectV1 = {
    id: 'slide1.2',
    fingerprint: 'text:body0001',
    kind: 'text',
    box: { x: 80, y: 400, w: 1120, h: 110, rot: 0 },
    origin: 'slide',
    fidelity: { state: 'editable' },
    text: { paras: [{ runs: [{ text: 'Alpha' }] }, { runs: [{ text: 'Beta' }] }, { runs: [{ text: 'Gamma' }] }] },
  };
  const source: SourceDeckV1 = {
    version: 1,
    source: { kind: 'pptx', hash: `sha256:${'b'.repeat(64)}`, lineageId: 'lineage-1', instanceId: 'instance-1', pageCount: 1 },
    slides: [{
      id: 'slide1',
      index: 0,
      width: 1280,
      height: 720,
      background: {},
      objects: [object],
      readingOrder: [object.id],
      warnings: [],
      origin: { kind: 'pptx' },
    }],
    fonts: [],
    warnings: [],
    reader: { name: 'hand-built', version: 'test' },
  };
  const plan: RenovationPlanV1 = {
    version: 1,
    source: { lineageId: 'lineage-1', hash: source.source.hash, instanceId: 'instance-1' },
    revision: 1,
    designSystem: DESIGN_SYSTEM.snapshot,
    algorithms: ALGORITHMS,
    mode: 'renovate',
    slides: [{
      id: 'slide1',
      include: true,
      layout: 'content',
      layoutSource: 'proposed',
      objects: [{ id: object.id, class: 'body', evidence: [], proposal: 'keep', review: 'accepted', role: 'body' }],
    }],
    colors: [],
    fonts: [],
    logo: { policy: 'brand', variantByBackground: true },
    decisions: [],
  };

  // A body slot wide enough for each line and tall enough for fewer than three.
  const shallow = withBodyBox(MASTER, { x: 0.05, y: 0.7, w: 0.9, h: 0.06 });
  const findings = layoutFindings(plan, source, shallow).filter((entry) => entry.code === 'text.overflow');
  assert.equal(findings.length, 1, 'the three paragraphs take three lines, not one');
  assert.match(findings[0]?.message ?? '', /estimate 3 lines/);
});

// ─── an incidental picture asks for no picture slot ──────────────────────────

test('a slide of 100 or more words, a title and one small icon is a content slide', () => {
  const words = Array.from({ length: 120 }, (_, i) => `word${i}`).join(' ');
  const textObject = (id: string, body: string, box: SourceObjectV1['box'], over: Partial<SourceObjectV1> = {}): SourceObjectV1 => ({
    id,
    fingerprint: `fp:${id}`,
    kind: 'text',
    box,
    origin: 'slide',
    fidelity: { state: 'editable' },
    text: { paras: [{ runs: [{ text: body, sizePt: 18 }] }] },
    ...over,
  });
  // 2% of a 1280 by 720 slide: a 192 by 96 icon.
  const icon: SourceObjectV1 = {
    id: 'slide1.icon', fingerprint: 'fp:icon', kind: 'pic', box: { x: 1040, y: 40, w: 192, h: 96, rot: 0 },
    origin: 'slide', fidelity: { state: 'raster-preserved' }, media: 'user/media/icon',
  };
  const slide: SlideSourceV1 = {
    id: 'slide1',
    index: 1,
    width: 1280,
    height: 720,
    background: {},
    objects: [
      textObject('slide1.title', 'Why the plan works', { x: 60, y: 40, w: 900, h: 90, rot: 0 }, { placeholder: 'title' }),
      textObject('slide1.body', words, { x: 60, y: 160, w: 1160, h: 480, rot: 0 }, { placeholder: 'body' }),
      icon,
    ],
    readingOrder: ['slide1.title', 'slide1.body', 'slide1.icon'],
    warnings: [],
    origin: { kind: 'pptx' },
  };
  const hash = `sha256:${createHash('sha256').update('icon-slide').digest('hex')}`;
  const deck: SourceDeckV1 = {
    version: 1,
    source: { kind: 'pptx', hash, lineageId: 'icon', instanceId: 'icon', pageCount: 1 },
    slides: [slide],
    fonts: [],
    warnings: [],
    reader: { name: 'hand-built', version: 'test' },
  };
  const plan = firstPass({ source: deck, census: censusDeck(deck), designSystem: DESIGN_SYSTEM, algorithms: ALGORITHMS });
  assert.equal(plan.slides[0]?.layout, 'content', 'one small icon does not pour 120 words into a split panel');

  // The same picture at a fifth of the slide is content, and the slide keeps it.
  const large = { ...icon, box: { x: 760, y: 160, w: 480, h: 400, rot: 0 } };
  const bigger: SourceDeckV1 = { ...deck, slides: [{ ...slide, objects: [slide.objects[0]!, slide.objects[1]!, large] }] };
  const kept = firstPass({ source: bigger, census: censusDeck(bigger), designSystem: DESIGN_SYSTEM, algorithms: ALGORITHMS });
  assert.equal(kept.slides[0]?.layout, 'split', 'a picture over a fifth of the slide beside the words takes the split layout');
});

test('a picture the layout placed never asks for a picture slot and waits in the tray when kept', () => {
  // template-example slides 1, 9, 10 and 11 carry the layout's mascot art. As an
  // unclassed picture it took a continuation slide each (template-example: 7
  // continuations); as template furniture routed to the tray, 3, all of them
  // slide 18's surplus tables.
  const words = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
  const art: SourceObjectV1 = {
    id: 'slide1.art', fingerprint: 'fp:art', kind: 'pic', box: { x: 760, y: 160, w: 480, h: 400, rot: 0 },
    origin: 'master', fidelity: { state: 'raster-preserved' }, media: 'user/media/mascot',
  };
  const text = (id: string, body: string, box: SourceObjectV1['box'], placeholder: 'title' | 'body'): SourceObjectV1 => ({
    id, fingerprint: `fp:${id}`, kind: 'text', box, origin: 'slide', fidelity: { state: 'editable' }, placeholder,
    text: { paras: [{ runs: [{ text: body, sizePt: placeholder === 'title' ? 32 : 18 }] }] },
  });
  const slide: SlideSourceV1 = {
    id: 'slide1',
    index: 1,
    width: 1280,
    height: 720,
    background: {},
    objects: [
      art,
      text('slide1.title', 'The plan in one page', { x: 60, y: 40, w: 660, h: 90, rot: 0 }, 'title'),
      text('slide1.body', words, { x: 60, y: 160, w: 660, h: 480, rot: 0 }, 'body'),
    ],
    readingOrder: ['slide1.art', 'slide1.title', 'slide1.body'],
    warnings: [],
    origin: { kind: 'pptx' },
  };
  const deck: SourceDeckV1 = {
    version: 1,
    source: { kind: 'pptx', hash: `sha256:${createHash('sha256').update('layout-art').digest('hex')}`, lineageId: 'art', instanceId: 'art', pageCount: 1 },
    slides: [slide],
    fonts: [],
    warnings: [],
    reader: { name: 'hand-built', version: 'test' },
  };
  const plan = firstPass({ source: deck, census: censusDeck(deck), designSystem: DESIGN_SYSTEM, algorithms: ALGORITHMS });
  const row = plan.slides[0]?.objects.find((one) => one.id === 'slide1.art');
  assert.equal(row?.class, 'template-furniture');
  assert.equal(row?.proposal, 'keep');
  assert.equal(row?.review, 'needs-attention', 'a person decides whether the old template art stays');
  assert.equal(row?.surplus, 'tray', 'kept, it waits in the tray rather than taking a slide of its own');
  assert.equal(row?.role, undefined, 'a picture takes no text role');
  assert.equal(plan.slides[0]?.layout, 'content', 'the template art does not pour the words into a split layout');

  // The same picture placed on the slide itself is content and takes the split.
  const own: SourceDeckV1 = { ...deck, slides: [{ ...slide, objects: [{ ...art, origin: 'slide' }, ...slide.objects.slice(1)] }] };
  const kept = firstPass({ source: own, census: censusDeck(own), designSystem: DESIGN_SYSTEM, algorithms: ALGORITHMS });
  assert.equal(kept.slides[0]?.layout, 'split');
  assert.equal(kept.slides[0]?.objects.find((one) => one.id === 'slide1.art')?.surplus, undefined);
});

// ─── the private corpus ──────────────────────────────────────────────────────

test('nothing a private deck label marks mustKeep is proposed for removal, unless a person is asked', { skip: skipReason() ?? (privateLabels().length === 0 ? 'the private deck corpus has no labels directory' : false) }, async () => {
  // template-example slide 18 draws its timeline axis as a connector across the
  // whole slide. The page-wide rule read it as ornament and proposed its removal
  // unreviewed, so Accept all would have deleted it. The synthetic fixtures above
  // hold no such line, so the check runs on the labelled private decks as well.
  let checked = 0;
  for (const { deck: file, labels } of privateLabels()) {
    const bytes = new Uint8Array(readFileSync(file));
    const deck = await sourceDeckFromPptx(await inflatePptx(bytes), parseXml, {
      hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      instanceId: 'private-labels',
      sink: async (_media, _mime, hint) => `user/media/${hint.slice(0, 16)}`,
      reader: { name: 'pptx-read', version: 'test' },
    });
    const plan = firstPass({ source: deck, census: censusDeck(deck), designSystem: DESIGN_SYSTEM, algorithms: ALGORITHMS });
    const rows = new Map(planRows(plan).map((row) => [row.id, row]));
    for (const id of labels.mustKeep) {
      const row = rows.get(id);
      if (!row) continue;
      checked += 1;
      if (effective(row) !== 'remove') continue;
      assert.equal(row.review, 'needs-attention', `${file}: ${id} (${row.class}) is proposed for removal with nobody asked`);
    }
  }
  assert.ok(checked > 0, 'the private labels state objects a default plan must not remove');
});

// ─── plan 275: the layout read, rule-accepted keeps, preset layout keys ──────

const STRUCTURES_PATH = fileURLToPath(new URL('./fixtures/rebrand/structures.pptx', import.meta.url));
let structuresRead: Promise<Read> | null = null;

/** The structures fixture read and censused, planned against the neutral master. */
function structuresPlan(): Promise<Read> {
  structuresRead ??= (async (): Promise<Read> => {
    const bytes = new Uint8Array(readFileSync(STRUCTURES_PATH));
    const parts = await inflatePptx(bytes);
    const deck = await sourceDeckFromPptx(parts, parseXml, {
      hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      instanceId: 'plan-test',
      name: 'structures.pptx',
      bytes: bytes.byteLength,
      sink: async (_media, _mime, hint) => `user/media/${hint.slice(0, 16)}`,
      reader: { name: 'pptx-read', version: 'test' },
    });
    const census = censusDeck(deck);
    return { deck, census, plan: firstPass({ source: deck, census, designSystem: DESIGN_SYSTEM, algorithms: ALGORITHMS }) };
  })();
  return structuresRead;
}

test('keep proposals for title, subtitle and body are accepted by the rule and leave the rows waiting', async () => {
  const { plan } = await readFixturePlan('simple.pptx');
  const words = planRows(plan).filter((row) => row.class === 'title' || row.class === 'subtitle' || row.class === 'body');
  assert.ok(words.length > 0);
  for (const row of words) {
    if (row.review === 'needs-attention') continue; // a row with nothing to show still asks a person
    assert.equal(row.proposal, 'keep');
    assert.equal(row.review, 'accepted');
    assert.equal(row.author, 'rule');
    assert.equal(row.decision, undefined, 'a proposal is not a decision');
  }
  const waiting = new Set(openPendingIds(plan));
  assert.ok(words.every((row) => !waiting.has(row.id)), 'none of them waits for an answer');
});

test('each slide stores its layout read and its reasons; a clear read sets the layout as a proposal', async () => {
  const { plan } = await structuresPlan();
  const first = plan.slides[0]!;
  assert.deepEqual(first.layoutMatch, { structure: 'columns-3', confidence: 0.84, coverage: 1, band: 'clear', signature: 'row:3:text' });
  assert.equal(first.layout, 'columns-3');
  assert.equal(first.layoutSource, 'proposed');
  assert.equal(first.layoutReasons?.[0]?.code, 'layout.reason.row.text.same');
  const likely = plan.slides[6]!;
  assert.equal(likely.layoutMatch?.band, 'likely');
  assert.equal(likely.layout, 'split');
  for (const slide of plan.slides) for (const reason of slide.layoutReasons ?? []) assert.doesNotMatch(reason.text, /[\d%]/);
  assert.ok(validatePlan(plan), JSON.stringify(validatePlan.errors));
});

test('a preset states a layout by structure, by signature or by the layout name, and the plan says the preset set it', async () => {
  const { deck, census } = await structuresPlan();
  const byStructure = firstPass({ source: deck, census, designSystem: DESIGN_SYSTEM, algorithms: ALGORITHMS, preset: { id: 'p', layout: { byStructure: { 'columns-3': 'content' } } } });
  assert.deepEqual([byStructure.slides[0]!.layout, byStructure.slides[0]!.layoutSource], ['content', 'preset']);
  assert.equal(byStructure.slides[0]!.layoutMatch?.structure, 'columns-3', 'the read is kept beside the preset choice');
  const bySignature = firstPass({ source: deck, census, designSystem: DESIGN_SYSTEM, algorithms: ALGORITHMS, preset: { id: 'p', layout: { byStructure: { 'row:4:card': 'grid-2x2' } } } });
  assert.deepEqual([bySignature.slides[1]!.layout, bySignature.slides[1]!.layoutSource], ['grid-2x2', 'preset']);
  const byName = firstPass({ source: deck, census, designSystem: DESIGN_SYSTEM, algorithms: ALGORITHMS, preset: { id: 'p', layout: { bySourceLayoutName: { Headline: 'title-only' } } } });
  assert.ok(byName.slides.every((slide) => slide.layout === 'title-only' && slide.layoutSource === 'preset'), 'every slide is built on the Headline layout');
  const missing = firstPass({ source: deck, census, designSystem: DESIGN_SYSTEM, algorithms: ALGORITHMS, preset: { id: 'p', layout: { byStructure: { 'columns-3': 'no-such-layout' } } } });
  assert.equal(missing.slides[0]!.layoutSource, 'proposed', 'a key naming a layout the master lacks is passed over');
});

test('a new revision regenerates proposals only: a layout a person or Auto-match set, a slide left out and its order stay', async () => {
  const { deck, census, plan } = await structuresPlan();
  const previous: RenovationPlanV1 = {
    ...plan,
    slides: plan.slides.map((slide, i) => {
      if (i === 0) return { ...slide, layout: 'grid-2x2', layoutSource: 'user' };
      if (i === 1) return { ...slide, layout: 'columns-4', layoutSource: 'auto' };
      if (i === 2) return { ...slide, include: false, order: 5 };
      return slide;
    }),
  };
  const next = firstPass({ source: deck, census, designSystem: DESIGN_SYSTEM, algorithms: { ...ALGORITHMS, plan: 'plan-next' }, previous });
  assert.deepEqual([next.slides[0]!.layout, next.slides[0]!.layoutSource], ['grid-2x2', 'user']);
  assert.deepEqual([next.slides[1]!.layout, next.slides[1]!.layoutSource], ['columns-4', 'auto']);
  assert.equal(next.slides[2]!.include, false);
  assert.equal(next.slides[2]!.order, 5);
  assert.equal(next.slides[3]!.layoutSource, 'proposed', 'a proposal is proposed again');
  assert.equal(next.slides[0]!.layoutReasons?.[0]?.code, 'layout.reason.pick.kept');
});

test('MEDDPICC slide 3 reads as numbered rows and keeps its eight letters', { skip: skipReason() ?? false }, async () => {
  const corpus = privateCorpus();
  const file = corpus?.slidesToTest.find((one) => /MEDDPICC/i.test(one));
  assert.ok(file, 'the MEDDPICC deck is in the private corpus');
  const bytes = new Uint8Array(readFileSync(file));
  const parts = await inflatePptx(bytes);
  const deck = await sourceDeckFromPptx(parts, parseXml, {
    hash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    instanceId: 'plan-test', name: 'meddpicc.pptx', bytes: bytes.byteLength,
    sink: async (_media, _mime, hint) => `user/media/${hint.slice(0, 16)}`,
    reader: { name: 'pptx-read', version: 'test' },
  });
  const census = censusDeck(deck);
  const plan = firstPass({ source: deck, census, designSystem: DESIGN_SYSTEM, algorithms: ALGORITHMS });
  const slide = plan.slides[2]!;
  assert.equal(slide.layoutMatch?.structure, 'numbered-rows');
  assert.equal(slide.layout, 'numbered-rows');
  const source = deck.slides[2]!;
  const letters = source.objects.filter((object) => /^[A-Z]$/.test((object.text?.paras ?? []).map((p) => p.runs.map((r) => r.text).join('')).join('').trim()));
  assert.equal(letters.length, 8);
  for (const letter of letters) {
    const row = slide.objects.find((one) => one.id === letter.id);
    assert.equal(row?.proposal, 'keep', 'a letter numbering a row is content');
    assert.equal(row?.class, 'body');
  }
});
