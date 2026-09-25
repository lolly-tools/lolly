// SPDX-License-Identifier: MPL-2.0
/**
 * One harness for the whole rebrand pipeline (plan 274 sections 3.2, 3.3 and 3.4).
 *
 * Two callers measure the same five stages: `tests/rebrand-pipeline.test.ts`
 * pins them against the committed fixtures, and `scripts/rebrand-eval.ts` runs
 * them over a directory of decks nobody commits. They import this module rather
 * than each keeping a copy, so a reading the eval prints is a reading of the
 * pipeline the suite pins and the two cannot drift apart.
 *
 * The stages themselves are `planDeck` and `compileDeck` from
 * `@lolly-tools/node-shell/rebrand` (`packages/node-shell/src/rebrand/pipeline.ts`),
 * the same two calls `lolly rebrand` makes, and the design system is the one
 * `lolly rebrand` resolves on the lolly-start profile, read by the same
 * `resolveProfileDesignSystem` call. So the CLI runs this path whole: stages and
 * design system alike. What this module adds is the accessors both reporters
 * read a run through.
 *
 * That design system is the one a public clone ships: the neutral lolly-start
 * master plus the colour tokens of
 * `brands/lolly-start/catalog/assets/lolly/tokens/brand.json`. Those tokens are
 * sixteen paths over nine distinct hexes and every one of them is achromatic,
 * which is what `STARTER_DISTINCT_HEXES` records and the suite asserts.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)

import type { RenovateDesignSystemV1 } from '../../engine/src/deck-compile.ts';
import { framePreviewSvg } from '../../engine/src/frame-preview-svg.ts';
import type { BrandSwatchV1 } from '../../engine/src/rebrand-colors.ts';
import type { RebrandDesignSystemV1 } from '../../engine/src/rebrand-design-system.ts';
import type { FirstPassDesignSystemV1 } from '../../engine/src/rebrand-plan.ts';
import { compileDeck, planDeck, resolveProfileDesignSystem } from '../../packages/node-shell/src/rebrand/index.ts';
import type {
  CompiledDeckV1,
  DeckCensusV1,
  ObjectPlanV1,
  RenovationPlanV1,
  SlideMasterFileV1,
  SlideMasterV1,
  SourceDeckV1,
  SourceObjectV1,
} from '../../packages/core/src/index.ts';
import type { FixtureObjectLabelV1, RebrandFixtureLabelsV1 } from './rebrand-fixtures.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const readJson = (rel: string): unknown => JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8'));

/** The neutral master a public clone ships, which every stage below is run against. */
export const STARTER_MASTER = ((readJson('brands/lolly-start/catalog/assets/lolly/slides/masters.json') as SlideMasterFileV1)
  .masters[0]) as SlideMasterV1;

// ─── the design system a public clone ships ──────────────────────────────────

/**
 * The starter design system, resolved by the call `lolly rebrand` makes on the
 * lolly-start profile: `resolveProfileDesignSystem`, which reads the master, the
 * colour tokens, the logos and the faces from the catalog and hands them to the
 * engine's `resolveRebrandDesignSystem`. The swatch roles and the snapshot (with
 * a real token hash) come from that one call, so this harness measures the
 * resolver a shell runs rather than a list written by hand here. The theme slots
 * resolve too but stay out of the first pass until the colour solve can move a
 * slot target (see `resolveRebrandDesignSystem`).
 */
async function starterSystem(): Promise<RebrandDesignSystemV1> {
  const resolved = await resolveProfileDesignSystem({ profile: 'lolly-start', root: ROOT });
  if (!resolved) throw new Error('the lolly-start profile does not resolve in this checkout');
  return resolved.system;
}

export const STARTER_DESIGN_SYSTEM: RebrandDesignSystemV1 = await starterSystem();

/**
 * A content profile's design system, resolved by the call `lolly rebrand` makes
 * with `LOLLY_PROFILE` set, or null when that profile's packs are not on this
 * machine (the SUSE pack on a public clone).
 */
export async function profileDesignSystem(profile: string): Promise<RebrandDesignSystemV1 | null> {
  const resolved = await resolveProfileDesignSystem({ profile, root: ROOT }).catch(() => null);
  return resolved && resolved.profile === profile ? resolved.system : null;
}

/**
 * Every colour token path of the starter pack and the hex it resolves to, as the
 * design system above read them. The base group holds the ramp and the light
 * theme the semantic names that point at it, the pair the neutral master reads.
 */
export const STARTER_COLORS: Map<string, string> = new Map(Object.entries(STARTER_DESIGN_SYSTEM.input.colors));

/** Token values for the paths the master and the plan name, and nothing else. */
export const starterTokens = (tokenPath: string): string | undefined => STARTER_COLORS.get(tokenPath);

/**
 * The starter pack's swatches, one per colour token path. Several paths share a
 * hex, which is what a token file states; the solver takes distinct hexes from
 * the pool, so `STARTER_DISTINCT_HEXES` is the number of colours it really has
 * to choose from.
 */
export const STARTER_SWATCHES: BrandSwatchV1[] = STARTER_DESIGN_SYSTEM.firstPass.swatches;

/** How many colours the starter swatch list really offers, after equal hexes fold together. */
export const STARTER_DISTINCT_HEXES = new Set(STARTER_SWATCHES.map((swatch) => swatch.hex.toLowerCase())).size;

/** The first-pass system, over the starter swatches or a list a caller states instead. */
export function starterPlanSystem(swatches: BrandSwatchV1[] = STARTER_SWATCHES): FirstPassDesignSystemV1 {
  return { ...STARTER_DESIGN_SYSTEM.firstPass, swatches };
}

/** The compile-stage system: the same snapshot, the starter tokens and the starter logos. */
export const STARTER_COMPILE_SYSTEM: RenovateDesignSystemV1 = STARTER_DESIGN_SYSTEM.compile;

const win = new JSDOM('').window;
const domParser = new win.DOMParser();

/** Parse one OOXML part. The same parser both callers read their decks with. */
export const parsePipelineXml = (xml: string): Document =>
  domParser.parseFromString(xml, 'application/xml') as unknown as Document;

/** A reference an `image` element could draw. The preview never fetches it. */
export const pipelineAssetHref = (ref: string): string | undefined =>
  ref.startsWith('user/media/') ? undefined : `https://example.invalid/${encodeURIComponent(ref)}`;

// ─── one run of the pipeline ─────────────────────────────────────────────────

/** Every stage of one run, and how long the whole run took. */
export interface RebrandRunV1 {
  deck: SourceDeckV1;
  census: DeckCensusV1;
  plan: RenovationPlanV1;
  compiled: CompiledDeckV1;
  previews: string[];
  ms: number;
}

/** What a caller may change about a run. Everything else is the same on both paths. */
export interface RebrandRunOptionsV1 {
  /** Swatches to plan against, for a case that states a palette of its own. */
  swatches?: BrandSwatchV1[];
  /** Passed straight to the compile. False on both callers' own runs. */
  applyUnreviewed?: boolean;
  /** Apply the proposals flagged for attention too, the way the review's preview does. */
  applyNeedsAttention?: boolean;
  /** The design system to plan and compile against. Defaults to the starter one. */
  system?: RebrandDesignSystemV1;
  /**
   * A chance to change the plan before the compile, for a case that needs a review
   * state the first pass does not produce on these decks. Left out, the plan the
   * first pass returned is the plan that compiles.
   */
  revise?: (plan: RenovationPlanV1) => RenovationPlanV1;
}

/** The instance id every run of this harness records, so two runs of one deck agree. */
const PIPELINE_INSTANCE = 'rebrand-pipeline';

/** Read one deck's bytes and run every stage over them, in order. */
export async function runRebrandPipeline(
  name: string,
  bytes: Uint8Array,
  options: RebrandRunOptionsV1 = {},
): Promise<RebrandRunV1> {
  const started = Date.now();
  // A stated palette changes the swatches the first pass chooses from and nothing
  // else: the snapshot, the master and the compile shape stay the starter's.
  const base = options.system ?? STARTER_DESIGN_SYSTEM;
  const planSystem: RebrandDesignSystemV1 = options.swatches
    ? { ...base, firstPass: { ...base.firstPass, swatches: options.swatches } }
    : base;
  const planned = await planDeck({
    bytes,
    name,
    parseXml: parsePipelineXml,
    system: planSystem,
    instanceId: PIPELINE_INSTANCE,
  });
  const { source: deck, census } = planned;
  const plan = options.revise ? options.revise(planned.plan) : planned.plan;
  const { compiled } = await compileDeck({
    source: deck,
    census,
    plan,
    system: base,
    applyUnreviewed: options.applyUnreviewed ?? false,
    applyNeedsAttention: options.applyNeedsAttention ?? false,
  });
  const previews = compiled.frames.map((frame) =>
    framePreviewSvg(frame, { assetHref: pipelineAssetHref, fonts: { brand: 'SUSE' } }));
  return { deck, census, plan, compiled, previews, ms: Date.now() - started };
}

// ─── the accessors both reporters read a run through ─────────────────────────

/** Every source object of a deck, slide order then document order. */
export function sourceObjects(deck: SourceDeckV1): SourceObjectV1[] {
  return deck.slides.flatMap((slide) => slide.objects);
}

/** Every plan row, in the same order. */
export function planRows(plan: RenovationPlanV1): ObjectPlanV1[] {
  return plan.slides.flatMap((slide) => slide.objects);
}

/** Warnings the reading raised, the deck's own and every slide's, as one number. */
export function warningCount(deck: SourceDeckV1): number {
  return deck.warnings.length + deck.slides.reduce((sum, slide) => sum + slide.warnings.length, 0);
}

// ─── joining a read object to its authored label ─────────────────────────────

/** `ppt/slides/slide1.xml` -> `slide1`, the base name a labels sidecar keys slides by. */
function slideBaseName(slideId: string): string | undefined {
  return /(?:^|\/)([^/]+)\.xml$/.exec(slideId)?.[1];
}

function sameBox(object: SourceObjectV1, label: FixtureObjectLabelV1): boolean {
  const want = label.boxPx;
  if (!want) return false;
  return Math.abs(object.box.x - want.x) <= 1
    && Math.abs(object.box.y - want.y) <= 1
    && Math.abs(object.box.w - want.w) <= 1
    && Math.abs(object.box.h - want.h) <= 1;
}

/**
 * The authored label for one read object, or undefined when the fixture states none.
 *
 * The join is by box, because a label id names the shape's `p:cNvPr` id while a read
 * object's id names its position in the part, so the two are different spaces. A box
 * repeats across slides by design (one title per slide sits in the same place), so
 * the search is scoped: an object the slide part itself carries is matched only
 * against that slide's own labels, and an object a master or layout contributed is
 * matched against the inherited ones. The fallback half of an `mc:AlternateContent`
 * pair is left out, because a correct reading surfaces one object for the pair and
 * the choice half is the one that carries the ground truth.
 *
 * A box that two candidate labels share throws rather than picking the first: the
 * point of the join is to name the right authored object, and a silent first-match
 * is how a `mustKeep` label stops being checked without anything failing.
 */
export function labelForObject(
  labels: RebrandFixtureLabelsV1,
  slideId: string,
  object: SourceObjectV1,
): FixtureObjectLabelV1 | undefined {
  const base = slideBaseName(slideId);
  const pool = object.origin === 'slide'
    ? (labels.slides.find((slide) => slide.id === base)?.objects ?? [])
      .filter((label) => label.alternateContent !== 'fallback')
    : labels.inherited;
  const hits = pool.filter((label) => sameBox(object, label));
  if (hits.length > 1) {
    const names = hits.map((label) => `${label.id} (${label.authored})`).join(', ');
    throw new Error(`${object.id} matches more than one label by box, so the join is ambiguous: ${names}`);
  }
  return hits[0];
}
