// SPDX-License-Identifier: MPL-2.0
/**
 * The four renovation stages (plan 274 sections 3.2 to 3.4), each over the committed
 * fixture `tests/fixtures/rebrand/simple.pptx` and the neutral master.
 *
 * A stage is a pure call into the engine, so each test compares the stage's answer
 * with the engine call it wraps, checks a cancel stops it before the work, and the last
 * two check the names are registered in `stages.ts` and run through the runner's
 * in-realm path with the same answer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { buildDeckTheme, censusDeck, compileFaithful, neutralSlideMaster, setDeckTheme, setSlideGround, type RebrandDesignSystemInputV1 } from '@lolly/engine';
import type { DecodeBudgetV1, DeckCensusV1, RenovationPlanV1, SourceDeckV1 } from '@lolly-tools/core';
import { inflatePptx } from '@lolly-tools/node-shell/pptx';
import { sourceDeckFromPptx } from '@lolly-tools/node-shell/rebrand/source-pptx';
import { decodeBudgetFor } from './budget.ts';
import { StageCancelledError, hasStage, type StageRunCtxV1 } from './stage-core.ts';
import { REBRAND_STAGE_NAMES, censusStage, compileStage, faithfulStage, planStage, readerAlgorithm } from './stage-rebrand.ts';

const FIXTURE = readFileSync(new URL('../../../../../tests/fixtures/rebrand/simple.pptx', import.meta.url));
const win = new JSDOM('').window;

async function readSource(): Promise<SourceDeckV1> {
  const parts = await inflatePptx(new Uint8Array(FIXTURE));
  let n = 0;
  return sourceDeckFromPptx(parts, (xml) => new win.DOMParser().parseFromString(xml, 'application/xml'), {
    hash: `sha256:${createHash('sha256').update(FIXTURE).digest('hex')}`,
    instanceId: 'stage-test',
    name: 'simple.pptx',
    reader: { name: 'pptx-read', version: 'test' },
    sink: async () => { n += 1; return `user/upload/picture-${n}`; },
  });
}

const SOURCE = await readSource();

const SYSTEM: RebrandDesignSystemInputV1 = {
  id: 'stub-system',
  name: 'Stub system',
  master: neutralSlideMaster(),
  colors: {
    'color.semantic.surface': '#ffffff',
    'color.semantic.text': '#111111',
    'color.semantic.muted': '#666666',
    'color.semantic.primary': '#2244cc',
    'color.ramp.neutral.8': '#eeeeee',
  },
  logos: { onLight: 'stub/logo/primary', onDark: 'stub/logo/reverse' },
  fonts: { brand: 'SUSE', mono: 'SUSE Mono', available: ['SUSE', 'SUSE Mono'] },
  neutralMaster: true,
};

const BUDGET: DecodeBudgetV1 = decodeBudgetFor('laptop');

function ctx(cancelled = false): StageRunCtxV1 {
  return {
    budget: BUDGET,
    cancelled,
    throwIfCancelled(): void {
      if (cancelled) throw new StageCancelledError('The stage was cancelled.', { acknowledged: true });
    },
    progress(): void {},
  };
}

test('the census stage answers what censusDeck answers', async () => {
  const census = await censusStage({ source: SOURCE }, ctx());
  assert.deepEqual(census, censusDeck(SOURCE));
  assert.equal(census.sourceHash, SOURCE.source.hash);
});

test('the plan stage runs the first pass against the resolved design system', async () => {
  const census = censusDeck(SOURCE);
  const plan = await planStage({ source: SOURCE, census, system: SYSTEM, seed: 7 }, ctx());
  assert.equal(plan.source.hash, SOURCE.source.hash);
  assert.equal(plan.designSystem.id, 'stub-system');
  assert.equal(plan.designSystem.masterId, SYSTEM.master.id);
  assert.equal(plan.algorithms.reader, 'pptx-read/test', 'the reader the source names');
  assert.ok(plan.algorithms.census.length > 0);
  assert.ok(plan.algorithms.plan.length > 0);
  assert.equal(plan.shuffleSeed, 7, 'the seed passes through');
  assert.equal(plan.slides.length, SOURCE.slides.length);

  const again = await planStage({ source: SOURCE, census, system: SYSTEM, seed: 7, previous: plan }, ctx());
  assert.equal(again.slides.length, plan.slides.length, 'a previous plan passes through and carries forward');
});

/**
 * The first pass with every row answered as proposed except one proposed removal, set
 * to `review`: the one row the Proposed pane and Open in Design treat differently.
 */
async function planWithOneWaiting(review: 'unreviewed' | 'needs-attention'): Promise<{ plan: RenovationPlanV1; census: DeckCensusV1 }> {
  const census = censusDeck(SOURCE);
  const plan = structuredClone(await planStage({ source: SOURCE, census, system: SYSTEM }, ctx()));
  const rows = plan.slides.flatMap((slide) => slide.objects);
  const row = rows.find((object) => object.proposal === 'remove');
  assert.ok(row, 'the fixture has a proposed removal');
  for (const other of rows) {
    if (other === row) continue;
    other.review = 'accepted';
    other.decision = other.proposal;
  }
  row.review = review;
  delete row.decision;
  return { plan, census };
}

test('the compile stage applies unreviewed proposals only when asked', async () => {
  const { plan, census } = await planWithOneWaiting('unreviewed');

  const held = await compileStage({ source: SOURCE, census, plan, system: SYSTEM, applyUnreviewed: false, applyNeedsAttention: false }, ctx());
  const applied = await compileStage({ source: SOURCE, census, plan, system: SYSTEM, applyUnreviewed: true, applyNeedsAttention: false }, ctx());
  assert.equal(held.planRevision, plan.revision);
  assert.ok(held.frames.length > 0);
  assert.equal(held.report.counts.appliedUnreviewed, 0, 'Open in Design applies nothing unreviewed');
  assert.equal(applied.report.counts.appliedUnreviewed, 1, 'the Proposed pane applies the unreviewed removal');
  assert.equal(applied.report.counts.objects.removed, held.report.counts.objects.removed + 1);
  assert.equal(held.designSystem.id, 'stub-system');
  assert.deepEqual(JSON.parse(JSON.stringify(held)), held, 'the result crosses back from the worker as JSON');
});

test('the compile stage passes applyNeedsAttention through, so the Proposed pane shows a flagged proposal', async () => {
  const { plan, census } = await planWithOneWaiting('needs-attention');

  const forDesign = await compileStage({ source: SOURCE, census, plan, system: SYSTEM, applyUnreviewed: false, applyNeedsAttention: false }, ctx());
  const pane = await compileStage({ source: SOURCE, census, plan, system: SYSTEM, applyUnreviewed: true, applyNeedsAttention: true }, ctx());
  const unflagged = await compileStage({ source: SOURCE, census, plan, system: SYSTEM, applyUnreviewed: true, applyNeedsAttention: false }, ctx());
  assert.equal(pane.report.counts.objects.removed, forDesign.report.counts.objects.removed + 1, 'the pane applies the flagged removal');
  assert.equal(unflagged.report.counts.objects.removed, forDesign.report.counts.objects.removed, 'applyUnreviewed alone holds it back');
});

test('the faithful stage answers what compileFaithful answers', async () => {
  const deck = await faithfulStage({ source: SOURCE }, ctx());
  assert.deepEqual(deck, compileFaithful(SOURCE));
  assert.equal(deck.frames.length, SOURCE.slides.length);
});

test('a cancelled stage stops before it works', async () => {
  const census = censusDeck(SOURCE);
  const plan = await planStage({ source: SOURCE, census, system: SYSTEM }, ctx());
  const cancelled = ctx(true);
  await assert.rejects(async () => censusStage({ source: SOURCE }, cancelled), StageCancelledError);
  await assert.rejects(async () => planStage({ source: SOURCE, census, system: SYSTEM }, cancelled), StageCancelledError);
  await assert.rejects(
    async () => compileStage({ source: SOURCE, census, plan, system: SYSTEM, applyUnreviewed: true, applyNeedsAttention: true }, cancelled),
    StageCancelledError,
  );
  await assert.rejects(async () => faithfulStage({ source: SOURCE }, cancelled), StageCancelledError);
});

test('every stage is registered by stages.ts and runs through the in-realm runner', async () => {
  await import('./stages.ts');
  for (const name of REBRAND_STAGE_NAMES) assert.equal(hasStage(name), true, `${name} is registered`);

  const { runStage } = await import('./stage-runner.ts');
  const envelope = await runStage({
    projectId: 'p1',
    stage: 'census',
    name: 'rebrand.census',
    algorithmVersion: 'test',
    input: { source: SOURCE },
    budget: BUDGET,
    title: 'Checking the slides',
    heavy: false,
  });
  assert.equal(envelope.projectId, 'p1');
  assert.deepEqual(envelope.result, censusDeck(SOURCE));
});

test('a plan records how the slide pictures were read, the way the terminal reads it back', () => {
  const pictures: SourceDeckV1 = {
    ...SOURCE,
    reader: { name: 'pdf-read', version: '9.9.9' },
    slides: SOURCE.slides.map((slide, i) => (i === 0 ? { ...slide, origin: { ...slide.origin, flattened: true } } : slide)),
  };
  assert.equal(readerAlgorithm(SOURCE), 'pptx-read/test', 'no slide picture, no suffix');
  assert.equal(readerAlgorithm(pictures), 'pdf-read/9.9.9+keep');
  const first = pictures.slides[0]!;
  const rebuilt = (ocr: SourceDeckV1['slides'][number]['ocr']): SourceDeckV1 => ({
    ...pictures,
    slides: [{ ...first, recovery: { assetRef: 'user/upload/page.png', fromObjectId: `${first.id}.pic` }, ...(ocr ? { ocr } : {}) }, ...pictures.slides.slice(1)],
  });
  assert.equal(readerAlgorithm(rebuilt({ state: 'text-found', model: 'ppocr-v5-mobile' })), 'pdf-read/9.9.9+rebuild/ocr:ppocr-v5-mobile');
  assert.equal(readerAlgorithm(rebuilt({ state: 'text-found', model: 'pdf-text-layer' })), 'pdf-read/9.9.9+rebuild', 'a text layer is not a recogniser');
  assert.equal(readerAlgorithm(rebuilt({ state: 'not-run' })), 'pdf-read/9.9.9+rebuild');
  assert.equal(readerAlgorithm(rebuilt({ state: 'text-found', model: 'm'.repeat(60) })), 'pdf-read/9.9.9+rebuild/ocr', 'a model too long for the schema is left off');

  // The rebuild marks the reader version, and the mark wins over the slides' own
  // readings: text recognition that ran and found nothing names no model on a slide.
  const marked = (version: string, ocr: SourceDeckV1['slides'][number]['ocr']): SourceDeckV1 => ({
    ...rebuilt(ocr),
    reader: { name: 'pdf-read', version },
  });
  assert.equal(readerAlgorithm(marked('9.9.9+rebuild/ocr:ppocr-v5-mobile', { state: 'not-run' })), 'pdf-read/9.9.9+rebuild/ocr:ppocr-v5-mobile', 'recognition ran with no text found');
  assert.equal(readerAlgorithm(marked('9.9.9+rebuild/ocr', { state: 'not-run' })), 'pdf-read/9.9.9+rebuild/ocr');
  assert.equal(readerAlgorithm(marked('9.9.9+rebuild', { state: 'text-found', model: 'ppocr-v5-mobile' })), 'pdf-read/9.9.9+rebuild', 'the mark says no recogniser ran');
  assert.equal(readerAlgorithm(marked('9.9.9+rebuild/ocr:ppocr-v5-mobile', undefined)), 'pdf-read/9.9.9+rebuild/ocr:ppocr-v5-mobile');
});

// ─── close-out CP12: a themed plan is one set of bytes on every path ─────────

test('a plan on the Dark theme, one slide set to Light, compiles in the stage worker to the bytes the node pipeline gives', async () => {
  const { compileDeck, resolveProfileDesignSystem } = await import('@lolly-tools/node-shell/rebrand');
  const resolved = await resolveProfileDesignSystem({ profile: 'lolly-start' });
  assert.ok(resolved, 'the starter profile resolves in this checkout');
  const { input } = resolved;
  assert.ok(input.darkColors, 'the starter pack states a dark mode, read by the node reader');
  const census = censusDeck(SOURCE);
  const plan = await planStage({ source: SOURCE, census, system: structuredClone(input), seed: 3 }, ctx());
  const source = { colors: input.colors, darkColors: input.darkColors, master: input.master };
  const dark = buildDeckTheme('dark', source)?.theme;
  assert.ok(dark);
  const solve = { census, source: SOURCE, system: source };
  const themed = setDeckTheme(plan, dark, { solve }).plan;
  const slideId = themed.slides.find((one) => one.include && one.layout !== 'title')?.id;
  assert.ok(slideId);
  // The starter's primary is its Dark ground, so it offers no Brand colour, and this case sets Light.
  const grounded = setSlideGround(themed, [slideId], 'light', { solve }).plan;
  assert.equal(grounded.slides.find((one) => one.id === slideId)?.ground, 'light');

  // The worker takes the input as a structured clone, as a message carries it.
  const stage = await compileStage({ source: SOURCE, census, plan: grounded, system: structuredClone(input), applyUnreviewed: true, applyNeedsAttention: true }, ctx());
  const { compiled: cli } = await compileDeck({ source: SOURCE, census, plan: grounded, system: resolved.system, applyUnreviewed: true, applyNeedsAttention: true });
  assert.equal(stage.designSystem.theme?.id, 'dark', 'the compile records the theme');
  assert.equal(JSON.stringify(stage), JSON.stringify(cli), 'the stage worker and the CLI draw the same bytes');

  // The theme reached the frames: the deck is dark, the chip's slide light, the logo follows each ground.
  const unthemed = await compileStage({ source: SOURCE, census, plan, system: structuredClone(input), applyUnreviewed: true, applyNeedsAttention: true }, ctx());
  const deckOnly = await compileStage({ source: SOURCE, census, plan: themed, system: structuredClone(input), applyUnreviewed: true, applyNeedsAttention: true }, ctx());
  const frameOf = (deck: typeof stage, id: string) => deck.frames.find((frame) => frame.sourceSlideId === id && !frame.continuation);
  const groundOf = (deck: typeof stage, id: string): string => String(frameOf(deck, id)?.layers[0]?.bg ?? '');
  assert.notEqual(groundOf(deckOnly, slideId), groundOf(unthemed, slideId), 'Dark moves the slide off its light ground');
  assert.equal(groundOf(stage, slideId), groundOf(unthemed, slideId), 'Light on a Dark deck means a light ground (decision 33b)');
  const logos = (deck: typeof stage) => deck.frames.flatMap((frame) => frame.layers).filter((row) => row.furniture === 'logo' || row.furniture === 'logo-hero').map((row) => String(row.image ?? ''));
  assert.notDeepEqual(logos(deckOnly), logos(unthemed), 'the logo variant flips with the ground');
});
