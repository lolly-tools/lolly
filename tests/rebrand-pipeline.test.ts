// SPDX-License-Identifier: MPL-2.0
/**
 * The whole rebrand pipeline, end to end (plan 274 sections 3.2, 3.3, 3.4 and 9).
 *
 * The three module suites each pin one stage against a hand-built input. This one
 * pins the joins: bytes into `sourceDeckFromPptx`, that reading into `censusDeck`,
 * that census into `firstPass` against the neutral lolly-start master, that plan
 * into `compileRenovated` with nothing unreviewed applied, and every compiled
 * frame into `framePreviewSvg`. Each stage validates against its own schema, so a
 * contract change that one module absorbs cannot pass here unnoticed. The harness
 * itself lives in `tests/helpers/rebrand-pipeline.ts`, because
 * `scripts/rebrand-eval.ts` measures a private corpus with the same five stages
 * and the two must not drift apart.
 *
 * The design system is the one a public clone ships. Its colour tokens are sixteen
 * paths over nine distinct hexes, and the suite asserts every one of them is
 * achromatic rather than taking that on trust. That is one half of what the
 * palette fixture's eight-series chart is measured against; the other half is a
 * synthetic sixteen-accent palette, so the `palette-too-small` answer is read
 * beside a palette that does resolve rather than on its own.
 *
 * The private-corpus case at the end runs the same pipeline over the maintainer's
 * own decks and prints one line each. It skips by name where that corpus is not on
 * the machine, and its identity is in tests/expected-skips.json.
 *
 * Run with: node --test "tests/rebrand-pipeline.test.ts"
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

import { deltaEOk } from '../engine/src/color-tools.ts';
import { finalizeReport } from '../engine/src/rebrand-report.ts';
import { DEFAULT_MIN_SEPARATION, type BrandSwatchV1 } from '../engine/src/rebrand-colors.ts';
import type { RenovationPlanV1 } from '../packages/core/src/index.ts';
import {
  privateCorpus,
  readFixture,
  readLabels,
  skipReason,
  type SyntheticFixtureName,
} from './helpers/rebrand-fixtures.ts';
import {
  STARTER_COLORS,
  STARTER_DISTINCT_HEXES,
  STARTER_MASTER,
  STARTER_SWATCHES,
  labelForObject,
  planRows,
  runRebrandPipeline,
  sourceObjects,
  warningCount,
  type RebrandRunV1,
} from './helpers/rebrand-pipeline.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const read = (rel: string): unknown => JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8'));

const PPTX_FIXTURES: SyntheticFixtureName[] = ['simple.pptx', 'adversarial.pptx', 'palette.pptx'];

const cache = new Map<SyntheticFixtureName, Promise<RebrandRunV1>>();

function fixtureRun(name: SyntheticFixtureName): Promise<RebrandRunV1> {
  const found = cache.get(name);
  if (found) return found;
  const pending = runRebrandPipeline(name, readFixture(name));
  cache.set(name, pending);
  return pending;
}

// ─── schemas ─────────────────────────────────────────────────────────────────

type AjvCtor = new (opts: unknown) => {
  addSchema: (schema: object) => unknown;
  compile: (schema: unknown) => ((data: unknown) => boolean) & { errors?: Array<{ instancePath?: string; message?: string }> };
  getSchema: (id: string) => (((data: unknown) => boolean) & { errors?: Array<{ instancePath?: string; message?: string }> }) | undefined;
};

const ajv = new (Ajv as unknown as AjvCtor)({ allErrors: true, strict: false });
for (const stage of ['source', 'census', 'plan', 'report', 'compiled']) {
  ajv.addSchema(read(`schemas/rebrand-${stage}-v1.schema.json`) as object);
}

function validateStage(stage: string, value: unknown, label: string): void {
  const validate = ajv.getSchema(`https://lolly.tools/schemas/rebrand-${stage}-v1.schema.json`);
  assert.ok(validate, `the ${stage} schema did not register`);
  if (validate(value)) return;
  const errors = (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`).join('; ');
  assert.fail(`${label}: the ${stage} stage failed its schema: ${errors}`);
}

// ─── the starter palette, as data rather than as a claim ─────────────────────

test('every colour the starter pack states is a grey', () => {
  assert.equal(STARTER_SWATCHES.length, STARTER_COLORS.size);
  assert.ok(STARTER_COLORS.size > 0, 'the starter token file states colours');
  for (const [tokenPath, hex] of STARTER_COLORS) {
    assert.match(hex, /^#[0-9a-f]{6}$/i, `${tokenPath} is not a six-digit hex`);
    const channels = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((pair) => Number.parseInt(pair, 16));
    const spread = Math.max(...channels) - Math.min(...channels);
    // Two steps out of 255 is the rounding an sRGB ramp carries, not a colour.
    assert.ok(spread <= 2, `${tokenPath} (${hex}) states a colour, not a grey: channels spread by ${spread}`);
  }
  // Several paths name the same grey, which is what a token file states. The
  // solver takes distinct hexes from the pool, so this is what it can choose from.
  assert.equal(STARTER_DISTINCT_HEXES, 9, 'the starter ramp is nine greys');
});

// ─── the joins ───────────────────────────────────────────────────────────────

for (const name of PPTX_FIXTURES) {
  test(`${name}: every stage validates against its own schema`, async () => {
    const run = await fixtureRun(name);
    validateStage('source', run.deck, name);
    validateStage('census', run.census, name);
    validateStage('plan', run.plan, name);
    validateStage('compiled', run.compiled, name);

    assert.equal(run.census.sourceHash, run.deck.source.hash, 'the census names the bytes it read');
    assert.equal(run.plan.source.hash, run.deck.source.hash);
    assert.equal(run.compiled.source.hash, run.deck.source.hash);
    assert.equal(run.plan.designSystem.masterId, STARTER_MASTER.id);
    assert.equal(run.compiled.planRevision, run.plan.revision);
  });

  test(`${name}: the report accounts for every source object exactly once`, async () => {
    const run = await fixtureRun(name);
    const ids = sourceObjects(run.deck).map((object) => object.id);
    assert.ok(ids.length > 0, `${name} carries no objects`);

    const dispositions = run.compiled.report.entries.filter((entry) => entry.disposition);
    assert.equal(dispositions.length, ids.length, 'one disposition per source object, no more and no fewer');
    assert.deepEqual([...dispositions.map((entry) => String(entry.objectId))].sort(), [...ids].sort());
    finalizeReport(run.compiled.report, ids);
    assert.throws(() => finalizeReport(run.compiled.report, [...ids, 'no-such-object']),
      /does not account for every source object/);

    // The plan-to-compile join: the rows the plan wrote are the objects the report
    // reached a disposition for, id for id.
    assert.deepEqual(
      planRows(run.plan).map((row) => row.id).sort(),
      [...dispositions.map((entry) => String(entry.objectId))].sort(),
      'a plan row that never reached the compile, or a disposition with no plan row',
    );
  });

  test(`${name}: nothing unreviewed is applied when the caller did not ask for it`, async () => {
    const run = await fixtureRun(name);
    assert.equal(run.compiled.report.counts.appliedUnreviewed, 0, 'a proposal nobody reviewed was applied');
    assert.equal(run.compiled.report.counts.logosReplaced, 0, 'a logo was swapped on an unreviewed proposal');
    assert.equal(
      run.compiled.report.entries.some((entry) => entry.code === 'review.applied-unreviewed'),
      false,
      'the report names an unreviewed proposal it applied',
    );

    const byObject = new Map(
      run.compiled.report.entries.filter((entry) => entry.disposition).map((entry) => [String(entry.objectId), entry]),
    );
    for (const row of planRows(run.plan)) {
      if (row.proposal === 'keep' || row.review === 'accepted' || row.decision !== undefined) continue;
      const entry = byObject.get(row.id);
      assert.ok(entry, `no disposition for the held-back row ${row.id}`);
      // A held-back page number is kept, and the master's own page number is what
      // draws it: the one held-back object whose form changes.
      if (row.class === 'page-number' && entry.disposition === 'transformed') {
        assert.match(entry.message, /drawn by the master's own page number/);
        continue;
      }
      assert.equal(
        entry.disposition,
        'retained',
        `${row.id} proposes ${row.proposal} and is ${row.review}, so a first pass keeps it as it stands`,
      );
    }
  });

  test(`${name}: every object a label marks mustKeep is retained`, async () => {
    const run = await fixtureRun(name);
    const labels = readLabels(name);
    const byObject = new Map(
      run.compiled.report.entries.filter((entry) => entry.disposition).map((entry) => [String(entry.objectId), entry]),
    );
    const checked = new Set<string>();

    for (const slide of run.deck.slides) {
      for (const object of slide.objects) {
        const label = labelForObject(labels, slide.id, object);
        if (!label?.mustKeep) continue;
        checked.add(label.id);
        const entry = byObject.get(object.id);
        assert.ok(entry, `no disposition for ${label.authored} (${object.id})`);
        assert.notEqual(entry.disposition, 'removed', `${label.authored} (${object.id}) was removed`);
        // Nothing is reviewed in a first pass, so a proposed replacement is held back
        // and the object is somewhere in the document: a frame layer or the tray.
        const placed = run.compiled.lineage.forward.some((edge) => edge.sourceObjectId === object.id);
        assert.equal(placed, true, `${label.authored} (${object.id}) has no lineage into the document`);
      }
    }

    // The sidecar's own list, so a join that quietly stops covering an object fails
    // here instead of checking a smaller set and still passing.
    assert.deepEqual([...checked].sort(), [...labels.mustKeep].sort(),
      'the objects checked are not the objects the fixture states a default plan must not remove');
  });

  test(`${name}: every frame draws as a non-empty svg at the frame's own size`, async () => {
    const run = await fixtureRun(name);
    assert.ok(run.compiled.frames.length > 0, 'a deck with slides compiles to frames');
    assert.equal(run.previews.length, run.compiled.frames.length);
    for (const [index, svg] of run.previews.entries()) {
      const frame = run.compiled.frames[index];
      assert.ok(frame);
      assert.ok(svg.length > 0, `frame ${frame.id} drew nothing`);
      assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" /);
      assert.match(svg, /<\/svg>$/);
      // The root element, not a descendant: a layer inside a preview carries a width
      // of its own, so a substring search would pass on a drawing at another size.
      const root = /^<svg[^>]*>/.exec(svg)?.[0];
      assert.ok(root, `frame ${frame.id} has no root element`);
      assert.match(root, new RegExp(`\\swidth="${frame.width}"`), `frame ${frame.id} drew at another width`);
      assert.match(root, new RegExp(`\\sheight="${frame.height}"`), `frame ${frame.id} drew at another height`);
      assert.match(root, new RegExp(`\\sviewBox="0 0 ${frame.width} ${frame.height}"`), `frame ${frame.id} drew another box`);
      assert.equal(svg.includes('user/media/'), false, 'a reference the caller could not resolve is never a live href');
    }
  });

  test(`${name}: a second run is identical at every stage`, async () => {
    const once = await fixtureRun(name);
    const twice = await runRebrandPipeline(name, readFixture(name));
    assert.equal(JSON.stringify(twice.deck), JSON.stringify(once.deck), 'the reading moved');
    assert.equal(JSON.stringify(twice.census), JSON.stringify(once.census), 'the census moved');
    assert.equal(JSON.stringify(twice.plan), JSON.stringify(once.plan), 'the plan moved');
    assert.equal(JSON.stringify(twice.compiled), JSON.stringify(once.compiled), 'the compile moved');
    assert.deepEqual(twice.previews, once.previews, 'a preview moved');
  });
}

// ─── the review gate, in both directions ─────────────────────────────────────

/**
 * How many rows each fixture proposes a replacement for and nobody reviewed. The
 * first pass marks them `needs-attention`, which is held back unless the caller
 * asks for the flagged ones too, so the case below reads them back as
 * `unreviewed` to exercise the flag. The removals a rule proposed (page numbers,
 * bands) are unreviewed from the first pass on, and the flag releases them too.
 */
const REPLACE_PROPOSALS: Record<string, number> = { 'simple.pptx': 3, 'adversarial.pptx': 3 };

for (const [name, expected] of Object.entries(REPLACE_PROPOSALS)) {
  test(`${name}: applyUnreviewed releases exactly the proposals it says it does`, async () => {
    let revised = 0;
    const revise = (plan: RenovationPlanV1): RenovationPlanV1 => ({
      ...plan,
      slides: plan.slides.map((slide) => ({
        ...slide,
        objects: slide.objects.map((row) => {
          if (row.proposal === 'keep' || row.review !== 'needs-attention' || row.decision !== undefined) return row;
          revised += 1;
          return { ...row, review: 'unreviewed' as const };
        }),
      })),
    });

    const bytes = readFixture(name as SyntheticFixtureName);
    const held = await runRebrandPipeline(name, bytes, { revise, applyUnreviewed: false });
    assert.equal(revised, expected, `${name} states ${expected} replacement proposals nobody reviewed`);
    assert.equal(held.compiled.report.counts.appliedUnreviewed, 0);
    assert.equal(held.compiled.report.counts.logosReplaced, 0);

    const open = planRows(held.plan).filter((row) => row.proposal !== 'keep' && row.review === 'unreviewed' && row.decision === undefined);
    const removals = open.filter((row) => row.proposal === 'remove').length;
    assert.equal(open.length, expected + removals, 'the open rows are the replacements plus the rule removals');

    revised = 0;
    const applied = await runRebrandPipeline(name, bytes, { revise, applyUnreviewed: true });
    assert.equal(applied.compiled.report.counts.appliedUnreviewed, open.length,
      'the flag the caller passed is what releases an unreviewed proposal');
    assert.equal(applied.compiled.report.counts.logosReplaced, expected);
    assert.deepEqual(
      applied.compiled.report.entries.filter((entry) => entry.code === 'review.applied-unreviewed').map((entry) => entry.objectId).sort(),
      open.map((row) => row.id).sort(),
      'every released proposal is named in the report, so a reader can see what travelled unreviewed',
    );
    assert.equal(applied.compiled.report.counts.objects.removed, held.compiled.report.counts.objects.removed + removals);
  });
}

// ─── the two answers the fixtures exist to give ──────────────────────────────

test('the adversarial deck yields a placeholder layer and an unresolved entry', async () => {
  const run = await fixtureRun('adversarial.pptx');

  const authored = run.compiled.report.entries.filter((entry) => entry.code === 'object.placeholder-authored');
  assert.ok(
    authored.length > 0,
    'the chart nothing can be shown for becomes an authored placeholder, never a picture of the source',
  );

  // Where a placeholder goes: the unreadable chart takes the picture slot of the
  // layout that covers its slide, so it stands on a frame beside its label and the
  // preview of that frame draws the label.
  // The tray holds only what no layout can hold: in a first pass nobody has
  // answered, the band whose removal waits for a person (a kept shape) and the
  // partner marks whose replacement waits for one (a kept mark with no free
  // picture slot on its own slide).
  for (const item of run.compiled.tray) {
    const entry = run.compiled.report.entries.find((one) => one.code === 'object.surplus-tray' && one.objectId === item.sourceObjectId);
    if (item.layer.kind === 'box') assert.equal(entry?.reason, 'no-role-in-master');
    else assert.equal(entry?.reason, 'mark-without-slot', `${item.sourceObjectId} waits in the tray but is neither a shape nor a mark`);
  }
  for (const entry of authored) {
    const id = String(entry.layerId);
    const index = run.compiled.frames.findIndex((frame) => frame.placeholderLayerIds.includes(id));
    assert.ok(index >= 0, `${id} is named as a placeholder but no frame lists it`);
    const frame = run.compiled.frames[index]!;
    const placed = frame.layers.find((row) => String(row.id) === id);
    assert.ok(placed);
    assert.equal(placed.kind, 'box');
    assert.equal(placed.image, undefined, 'a placeholder is never a picture of the source');
    const label = frame.layers.find((row) => String(row.id) === `${id}.label`);
    assert.match(String(label?.text ?? ''), /could not be read/);
    assert.match(run.previews[index] ?? '', /could not be read/, 'the preview draws the placeholder label');
  }

  const unresolved = run.compiled.report.entries.filter((entry) => entry.disposition === 'unresolved');
  assert.ok(unresolved.length > 0, 'an object with no drawable bytes is recorded as unresolved, not dropped');
  for (const entry of unresolved) {
    assert.equal(entry.code, 'object.unresolved');
    assert.equal(entry.fidelity, 'unavailable');
  }
});

test('the palette deck: eight series against a colourless starter palette is unresolved', async () => {
  const run = await fixtureRun('palette.pptx');

  const series = run.plan.colors.filter((row) => row.role === 'series');
  assert.equal(series.length, 8, 'the fixture states eight series');
  for (const row of series) {
    assert.equal(row.unresolved, 'palette-too-small');
    assert.equal(row.to, undefined, 'a search that failed carries no target');
  }

  // One entry per member of the set, so a reader is told which series has no
  // colour rather than that the set as a whole failed. The compile also records a
  // mapping that resolved and reached no layer, so the total is the plan's own
  // colour count and every entry says which of the two it is.
  const unresolved = run.compiled.report.entries.filter((entry) => entry.code === 'colour.unresolved');
  assert.equal(
    unresolved.filter((entry) => entry.reason === 'palette-too-small').length,
    8,
    'the compile reports what the plan could not assign, series by series',
  );
  assert.equal(
    unresolved.every((entry) => entry.reason === 'palette-too-small' || entry.reason === 'no-editable-layer'),
    true,
  );
  assert.equal(run.compiled.report.counts.coloursUnresolved, unresolved.length);
  assert.equal(
    unresolved.length + run.compiled.report.counts.coloursAssigned,
    run.plan.colors.length,
    'every colour use in the plan appears in the report exactly once',
  );
  assert.ok(run.compiled.report.counts.coloursAssigned > 0, 'the rest of the deck still takes its colours');
});

test('the palette deck: the same eight series resolve against a palette that can tell them apart', async () => {
  // The control for the case above. Without it, `palette-too-small` on all eight
  // would read the same whether the solver works or never resolves anything.
  const accents = ['#e11d48', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#84cc16',
    '#ef4444', '#a855f7', '#0ea5e9', '#22c55e', '#eab308', '#f97316', '#6366f1', '#06b6d4'];
  const swatches: BrandSwatchV1[] = [
    { path: 'color.semantic.surface', hex: '#ffffff', role: 'bg' },
    { path: 'color.semantic.text', hex: '#1d1d1d', role: 'ink' },
    ...accents.map((hex, index) => ({ path: `color.accent.${index + 1}`, hex, role: 'accent' as const })),
  ];
  const run = await runRebrandPipeline('palette.pptx', readFixture('palette.pptx'), { swatches });

  const series = run.plan.colors.filter((row) => row.role === 'series');
  assert.equal(series.length, 8);
  const targets: string[] = [];
  for (const row of series) {
    assert.equal(row.unresolved, undefined, `${row.useId} found no target against sixteen accents`);
    assert.ok(typeof row.to === 'string' && row.to.length > 0, `${row.useId} resolved to nothing`);
    targets.push(row.to as string);
  }
  assert.equal(new Set(targets).size, 8, 'two series took the same colour');
  for (let i = 0; i < targets.length; i += 1) {
    for (let j = i + 1; j < targets.length; j += 1) {
      const a = targets[i];
      const b = targets[j];
      assert.ok(a && b);
      assert.ok(deltaEOk(a, b) >= DEFAULT_MIN_SEPARATION,
        `${a} and ${b} are closer than the set's own minimum separation`);
    }
  }
});

// ─── close-out 9.2: the design system's face on every renovated text ─────────

/**
 * Every text row of a renovated deck, frames and tray, that states a family of its
 * own: anything but no family (the brand face) or `mono`. Empty is the rule.
 */
function foreignFaces(compiled: RebrandRunV1['compiled']): string[] {
  const rows = [...compiled.frames.flatMap((frame) => frame.layers), ...compiled.tray.map((item) => item.layer)];
  return rows
    .filter((row) => row.kind === 'text' && row.font !== undefined && row.font !== '' && row.font !== 'mono')
    .map((row) => `${String(row.id)}: ${String(row.font)}`);
}

/** The six synthetic pptx fixtures, the one PDF left out: its pages carry no family to keep. */
const FACE_FIXTURES = ['simple.pptx', 'adversarial.pptx', 'palette.pptx', 'formatting.pptx', 'structures.pptx', 'vector.pptx'] as const;

test('close-out 9.2: no renovated text row on the six synthetic fixtures carries a family outside the design system', async () => {
  let rows = 0;
  for (const name of FACE_FIXTURES) {
    const run = await runRebrandPipeline(name, new Uint8Array(readFileSync(path.join(ROOT, 'tests/fixtures/rebrand', name))), {
      applyUnreviewed: true,
      applyNeedsAttention: true,
    });
    const text = [...run.compiled.frames.flatMap((frame) => frame.layers), ...run.compiled.tray.map((item) => item.layer)].filter((row) => row.kind === 'text');
    rows += text.length;
    assert.deepEqual(foreignFaces(run.compiled), [], `${name}: every text row is set in the design system's faces`);
  }
  assert.ok(rows > 50, `the fixtures carry text rows to check (${rows})`);
});

// ─── the private corpus ──────────────────────────────────────────────────────

/** Time one private deck is allowed before it counts as a failure of that deck. */
const PRIVATE_DECK_BUDGET_MS = 90_000;

/**
 * The ceiling for the whole case. A stage cannot be preempted from here, so a deck
 * that hangs still costs the run this much; the label goes to stdout before the
 * deck runs, so the one that hung is named.
 */
const PRIVATE_CORPUS_TIMEOUT_MS = 10 * PRIVATE_DECK_BUDGET_MS;

test(
  'the whole pipeline completes on every private deck',
  { skip: skipReason() ?? false, timeout: PRIVATE_CORPUS_TIMEOUT_MS },
  async () => {
    const corpus = privateCorpus();
    assert.ok(corpus, 'privateCorpus returned nothing with LOLLY_REBRAND_FIXTURES set');
    const decks = [...corpus.files, ...corpus.slidesToTest].filter((file) => file.toLowerCase().endsWith('.pptx'));
    assert.ok(decks.length > 0, `no pptx under ${corpus.root}`);

    const failures: string[] = [];
    for (const file of decks) {
      const label = path.relative(corpus.root, file);
      process.stdout.write(`${label}: reading\n`);
      try {
        const run = await runRebrandPipeline(label, new Uint8Array(readFileSync(file)));
        const classes = new Map<string, number>();
        for (const row of planRows(run.plan)) classes.set(row.class, (classes.get(row.class) ?? 0) + 1);
        const dispositions = run.compiled.report.counts.objects;
        const counted = (entries: Iterable<[string, number]>): string =>
          [...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join(' ');
        process.stdout.write(
          `${label}: slides=${run.deck.slides.length} objects=${sourceObjects(run.deck).length}`
          + ` frames=${run.compiled.frames.length} groups=${run.census.groups.length}`
          + ` unresolvedColours=${run.compiled.report.counts.coloursUnresolved}`
          + ` warnings=${warningCount(run.deck)}`
          + ` ms=${run.ms}`
          + ` | classes: ${counted(classes)}`
          + ` | dispositions: ${counted(Object.entries(dispositions) as Array<[string, number]>)}\n`,
        );
        if (run.ms > PRIVATE_DECK_BUDGET_MS) {
          failures.push(`${label}: took ${run.ms}ms, over the ${PRIVATE_DECK_BUDGET_MS}ms budget`);
        }
        // A slow deck is still checked, so being over budget costs one failure row
        // rather than the property this case exists to prove.
        assert.equal(run.previews.length, run.compiled.frames.length);
        const foreign = foreignFaces(run.compiled);
        if (foreign.length > 0) failures.push(`${label}: ${foreign.length} renovated text rows state a family of their own (${foreign.slice(0, 3).join(', ')})`);
      } catch (error) {
        failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    assert.deepEqual(failures, [], `the pipeline did not complete on ${failures.length} of ${decks.length} decks`);
  },
);

// ─── plan 275: the structures fixture through every stage ────────────────────

test('the structures fixture: every stage validates, each clear slide compiles on its structure, and no word is lost', async () => {
  const run = await runRebrandPipeline('structures.pptx', new Uint8Array(readFileSync(path.join(ROOT, 'tests/fixtures/rebrand/structures.pptx'))));
  for (const [stage, value] of [['source', run.deck], ['census', run.census], ['plan', run.plan], ['compiled', run.compiled]] as const) {
    validateStage(stage, value, 'structures.pptx');
  }
  const labels = (read('tests/fixtures/rebrand/structures.labels.json') as { slides: Array<{ id: string; structure: { id: string; band: string } }> }).slides;
  for (const label of labels) {
    const slideId = `ppt/slides/${label.id}.xml`;
    const plan = run.plan.slides.find((slide) => slide.id === slideId);
    assert.equal(plan?.layoutMatch?.band, label.structure.band, label.id);
    const frame = run.compiled.frames.find((one) => one.sourceSlideId === slideId && !one.continuation);
    assert.ok(frame, label.id);
    if (label.structure.band === 'clear') assert.equal(frame.archetype, plan?.layout, `${label.id} compiles on the layout its read set`);
  }
  // The four numbering letters of slide 8 travel into the compiled deck.
  const text = run.compiled.frames.filter((frame) => frame.sourceSlideId === 'ppt/slides/slide8.xml')
    .flatMap((frame) => frame.layers.map((row) => String(row.text ?? '')));
  for (const letter of ['P', 'L', 'A', 'N']) assert.ok(text.some((line) => line.includes(letter)), `the letter ${letter} is kept`);
  assert.equal(run.compiled.report.entries.filter((entry) => entry.code === 'review.applied-unreviewed').length, 0);
});
