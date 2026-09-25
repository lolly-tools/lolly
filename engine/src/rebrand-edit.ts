// SPDX-License-Identifier: MPL-2.0
/**
 * Pure edits to a renovation plan (plan 274 section 4, "shopping"): the one set
 * of operations the web view, the CLI and the MCP tool apply, so a group apply
 * or a reorder means the same thing on every surface.
 *
 * Every edit returns a new plan, the ids it wrote and the ids it passed over
 * with the reason. None bumps `plan.revision`: the project store does that, one
 * write per transaction, so a group apply of 24 rows is one revision.
 *
 * Undo is capture and restore. A caller runs the edit, reads `touched`, captures
 * those rows from the plan it started from, and commits the edited plan; undo
 * restores the capture. Because every edit here is pure, the capture can be
 * taken after the edit from the untouched original, and restoring then
 * re-applying the same edit gives the edited plan again. What to capture for
 * each edit:
 *
 *   - `decideObjects`, `acceptSuggestions`: `objectIds` = touched, plus the
 *     `source` the edit was given, so memory is captured per object;
 *   - `setSlidesIncluded`, `setSlidesLayout`, `setSlidesArrangement`,
 *     `moveSlide`, `moveSlides`:
 *     `slideIds` = touched (a move or a renumber writes `order` on every
 *     included slide, and touched says so);
 *   - `resetSlideDecisions`: `slideIds` = touched, `objectIds` = every row on
 *     those slides, and the source;
 *   - `setObjectText`: `objectIds` = touched;
 *   - `setColorTarget`: `useIds` = touched; `setFontTarget`: `fonts` = touched.
 *
 * Decision memory is written through `applyDecision` from `rebrand-decisions.ts`,
 * one row at a time, so there is one implementation of what a remembered
 * decision holds.
 *
 * Pure: no DOM, no clock, no filesystem, no network.
 */

import type {
  ArchetypeRefV1,
  ColorMappingV1,
  DecisionAuthorV1,
  DecisionMemoryV1,
  FontMappingV1,
  ObjectPlanV1,
  PlanActionV1,
  RenovationPlanV1,
  ReplacementV1,
  SlideArrangementV1,
  SlidePlanV1,
  SourceDeckV1,
} from '@lolly-tools/core';

import { applyDecision } from './rebrand-decisions.ts';
import { effectiveSlideOrder, isCorrected } from './rebrand-review.ts';

// ─── results ─────────────────────────────────────────────────────────────────

/**
 * Why an id was passed over. `excluded` is additive to the three reasons the
 * view names: a slide left out of the deck has no place to move to.
 */
export type PlanEditSkipReasonV1 = 'locked' | 'corrected' | 'unknown' | 'excluded';

export interface PlanEditResultV1 {
  plan: RenovationPlanV1;
  touched: string[];
  skipped: Array<{ id: string; reason: PlanEditSkipReasonV1 }>;
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

/** JSON with sorted keys and undefined fields left out, so two equal rows compare equal whatever their key order. */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    const keys = Object.keys(rec).filter((key) => rec[key] !== undefined).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(rec[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** A new plan with one function applied to every object row; the rest shared. */
function mapRows(plan: RenovationPlanV1, fn: (row: ObjectPlanV1) => ObjectPlanV1): RenovationPlanV1 {
  return {
    ...plan,
    slides: plan.slides.map((slide) => {
      let changed = false;
      const objects = slide.objects.map((row) => {
        const next = fn(row);
        if (next !== row) changed = true;
        return next;
      });
      return changed ? { ...slide, objects } : slide;
    }),
  };
}

function rowIndex(plan: RenovationPlanV1): Map<string, ObjectPlanV1> {
  const out = new Map<string, ObjectPlanV1>();
  for (const slide of plan.slides) for (const row of slide.objects) out.set(row.id, row);
  return out;
}

/**
 * A source holding only the one object, so `applyDecision` writes its memory
 * without indexing the whole deck once per row.
 */
function sourceForOne(source: SourceDeckV1 | undefined, objectId: string, placed: Map<string, SourceDeckV1['slides'][number]>): SourceDeckV1 | undefined {
  if (!source) return undefined;
  const slide = placed.get(objectId);
  const object = slide?.objects.find((one) => one.id === objectId);
  if (!slide || !object) return undefined;
  return { ...source, slides: [{ ...slide, objects: [object] }] };
}

function slideOfObject(source: SourceDeckV1 | undefined): Map<string, SourceDeckV1['slides'][number]> {
  const out = new Map<string, SourceDeckV1['slides'][number]>();
  for (const slide of source?.slides ?? []) for (const object of slide.objects) out.set(object.id, slide);
  return out;
}

/** Write the named scope on the rows and on the memory entries this call wrote. */
function stampScope(plan: RenovationPlanV1, ids: ReadonlySet<string>, scope: string, source: SourceDeckV1 | undefined): RenovationPlanV1 {
  const next = mapRows(plan, (row) => (ids.has(row.id) ? { ...row, scope } : row));
  if (!source) return next;
  const placed = slideOfObject(source);
  const keys = new Set<string>();
  for (const id of ids) {
    const slide = placed.get(id);
    const object = slide?.objects.find((one) => one.id === id);
    if (slide && object) keys.add(JSON.stringify([object.fingerprint, slide.id]));
  }
  return {
    ...next,
    decisions: next.decisions.map((memory) => (keys.has(JSON.stringify([memory.fingerprint, memory.slideLineage]))
      ? { ...memory, scope }
      : memory)),
  };
}

// ─── object decisions ────────────────────────────────────────────────────────

export interface DecideObjectsInputV1 {
  objectIds: string[];
  action: PlanActionV1;
  replacement?: ReplacementV1;
  author?: DecisionAuthorV1;
  /** The named scope the apply went through ("This object", a group id). Written on every touched row. */
  scope?: string;
  /**
   * Also overwrite rows a person or an agent already decided differently. The
   * view sets it for a single-object apply and for "include corrected" on a
   * group; a group apply leaves corrections alone by default.
   */
  includeCorrected?: boolean;
  /** When given, every touched row's decision is remembered against its fingerprint. */
  source?: SourceDeckV1;
}

/**
 * One call for a Keep, Replace or Remove over one object or a group. Locked rows
 * are skipped, rows already decided differently by a person are skipped unless
 * `includeCorrected`, and every touched row gets review `accepted`, the author
 * and the scope.
 */
export function decideObjects(plan: RenovationPlanV1, input: DecideObjectsInputV1): PlanEditResultV1 {
  const author = input.author ?? 'user';
  const rows = rowIndex(plan);
  const placed = slideOfObject(input.source);
  const touched: string[] = [];
  const skipped: PlanEditResultV1['skipped'] = [];
  let next = plan;
  for (const id of unique(input.objectIds)) {
    const row = rows.get(id);
    if (!row) {
      skipped.push({ id, reason: 'unknown' });
      continue;
    }
    if (row.locked) {
      skipped.push({ id, reason: 'locked' });
      continue;
    }
    if (!input.includeCorrected && isCorrected(row, input.action, input.replacement)) {
      skipped.push({ id, reason: 'corrected' });
      continue;
    }
    next = applyDecision(next, id, input.action, input.replacement, author, undefined, sourceForOne(input.source, id, placed));
    touched.push(id);
  }
  if (touched.length > 0) {
    // A decision made without a named scope was not made through a group, so an
    // earlier group scope comes off the row, matching the memory `applyDecision`
    // wrote without one. A later sweep over that group then leaves the row alone.
    next = input.scope !== undefined
      ? stampScope(next, new Set(touched), input.scope, input.source)
      : clearScope(next, new Set(touched));
  }
  return { plan: next, touched, skipped };
}

function clearScope(plan: RenovationPlanV1, ids: ReadonlySet<string>): RenovationPlanV1 {
  return mapRows(plan, (row) => {
    if (!ids.has(row.id) || row.scope === undefined) return row;
    const next = { ...row };
    delete next.scope;
    return next;
  });
}

export interface AcceptSuggestionsOptsV1 {
  /**
   * `unreviewed` is the view's named "Accept all suggestions"; `all` also
   * answers the rows that need attention, which is what `--accept-suggestions`
   * and a preset run do.
   */
  scope: 'unreviewed' | 'all';
  author: DecisionAuthorV1;
  /** When given, every accepted row's decision is remembered against its fingerprint. */
  source?: SourceDeckV1;
  /**
   * Answer rows on included slides only. Defaults to true: a slide a person left
   * out is not compiled, so answering its rows would record decisions nobody
   * asked for. False reaches every slide, for a caller that states it wants that.
   */
  includedOnly?: boolean;
}

/**
 * Turn proposals into decisions: each answered row's decision copies its
 * proposal and the proposal's replacement. Rows already decided and locked rows
 * are left alone, and `touched` lists the rows answered. By default only rows on
 * included slides are answered (`includedOnly`), so with `scope: 'all'` the rows
 * answered are exactly `openPendingIds` from `rebrand-review.ts`. A CLI run hands
 * those ids to `markAppliedUnreviewed`, each with its review state read from the
 * plan passed in here, so a row that needed attention is reported as such.
 */
export function acceptSuggestions(plan: RenovationPlanV1, opts: AcceptSuggestionsOptsV1): PlanEditResultV1 {
  const placed = slideOfObject(opts.source);
  const includedOnly = opts.includedOnly ?? true;
  const touched: string[] = [];
  const skipped: PlanEditResultV1['skipped'] = [];
  let next = plan;
  for (const slide of plan.slides) {
    if (includedOnly && !slide.include) continue;
    for (const row of slide.objects) {
      const answers = row.review === 'unreviewed' || (opts.scope === 'all' && row.review === 'needs-attention');
      if (!answers || row.decision !== undefined) continue;
      if (row.locked) {
        skipped.push({ id: row.id, reason: 'locked' });
        continue;
      }
      next = applyDecision(next, row.id, row.proposal, row.proposalReplacement, opts.author, undefined, sourceForOne(opts.source, row.id, placed));
      touched.push(row.id);
    }
  }
  return { plan: next, touched, skipped };
}

// ─── slides ──────────────────────────────────────────────────────────────────

function editSlides(
  plan: RenovationPlanV1,
  slideIds: readonly string[],
  fn: (slide: SlidePlanV1) => SlidePlanV1,
): PlanEditResultV1 {
  const wanted = new Set(slideIds);
  const known = new Set(plan.slides.map((slide) => slide.id));
  const touched = unique(slideIds).filter((id) => known.has(id));
  const skipped = unique(slideIds).filter((id) => !known.has(id)).map((id) => ({ id, reason: 'unknown' as const }));
  const slides = plan.slides.map((slide) => (wanted.has(slide.id) ? fn(slide) : slide));
  return { plan: { ...plan, slides }, touched, skipped };
}

/**
 * Include or leave out slides. A slide left out loses its `order`. Once the
 * plan holds an explicit order, the included slides are renumbered 0 to n-1 so
 * no two share a position: a slide coming back goes in right after the included
 * slide that precedes it in the source, or first when none does. Every slide
 * whose row changed is in `touched`, the renumbered ones after the named ones.
 */
export function setSlidesIncluded(plan: RenovationPlanV1, slideIds: string[], include: boolean): PlanEditResultV1 {
  const base = editSlides(plan, slideIds, (slide) => {
    const next: SlidePlanV1 = { ...slide, include };
    if (!include) delete next.order;
    return next;
  });
  if (!base.plan.slides.some((slide) => slide.include && slide.order !== undefined)) return base;

  const named = new Set(base.touched);
  const sourceAt = new Map(plan.slides.map((slide, i) => [slide.id, i]));
  const stillIn = new Set(base.plan.slides.filter((slide) => slide.include).map((slide) => slide.id));
  const sequence = effectiveSlideOrder(plan).filter((slide) => slide.include && stillIn.has(slide.id)).map((slide) => slide.id);
  const returning = include ? plan.slides.filter((slide) => !slide.include && named.has(slide.id)).map((slide) => slide.id) : [];
  for (const id of returning) {
    const at = sourceAt.get(id) ?? 0;
    let after = -1;
    let best = -1;
    sequence.forEach((other, i) => {
      const otherAt = sourceAt.get(other) ?? 0;
      if (otherAt < at && otherAt > best) {
        best = otherAt;
        after = i;
      }
    });
    sequence.splice(after + 1, 0, id);
  }

  const orderOf = new Map(sequence.map((id, i) => [id, i]));
  const touched = [...base.touched];
  const slides = base.plan.slides.map((slide) => {
    const order = orderOf.get(slide.id);
    if (order === undefined || slide.order === order) return slide;
    if (!named.has(slide.id)) touched.push(slide.id);
    return { ...slide, order };
  });
  return { plan: { ...base.plan, slides }, touched, skipped: base.skipped };
}

/**
 * Move one included slide earlier (negative) or later (positive) among the
 * included slides. The delta clamps to the ends. `order` is written on every
 * included slide, so the order is explicit from then on, and every included
 * slide is in `touched`.
 */
export function moveSlide(plan: RenovationPlanV1, slideId: string, delta: number): PlanEditResultV1 {
  const target = plan.slides.find((slide) => slide.id === slideId);
  if (!target) return { plan, touched: [], skipped: [{ id: slideId, reason: 'unknown' }] };
  if (!target.include) return { plan, touched: [], skipped: [{ id: slideId, reason: 'excluded' }] };
  const included = effectiveSlideOrder(plan).filter((slide) => slide.include).map((slide) => slide.id);
  const from = included.indexOf(slideId);
  const step = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  const to = Math.min(included.length - 1, Math.max(0, from + step));
  included.splice(from, 1);
  included.splice(to, 0, slideId);
  const orderOf = new Map(included.map((id, i) => [id, i]));
  const slides = plan.slides.map((slide) => {
    const order = orderOf.get(slide.id);
    return order === undefined ? slide : { ...slide, order };
  });
  return { plan: { ...plan, slides }, touched: included, skipped: [] };
}

/**
 * Move several included slides as one block (plan 275 sections 5.1 and 5.5): the
 * block keeps its own order and goes so its first slide sits at `toIndex` among the
 * included slides, counted after the block is taken out. `toIndex` clamps to the
 * ends, so `0` is Move to start and `Number.MAX_SAFE_INTEGER` is Move to end. A slide
 * left out or unknown is passed over with its reason. Like `moveSlide`, `order` is
 * written on every included slide and every included slide is in `touched`.
 */
export function moveSlides(plan: RenovationPlanV1, slideIds: string[], toIndex: number): PlanEditResultV1 {
  const byId = new Map(plan.slides.map((slide) => [slide.id, slide]));
  const skipped: PlanEditResultV1['skipped'] = [];
  const wanted = new Set<string>();
  for (const id of unique(slideIds)) {
    const slide = byId.get(id);
    if (!slide) skipped.push({ id, reason: 'unknown' });
    else if (!slide.include) skipped.push({ id, reason: 'excluded' });
    else wanted.add(id);
  }
  if (wanted.size === 0) return { plan, touched: [], skipped };
  const included = effectiveSlideOrder(plan).filter((slide) => slide.include).map((slide) => slide.id);
  const block = included.filter((id) => wanted.has(id));
  const rest = included.filter((id) => !wanted.has(id));
  const at = Number.isFinite(toIndex) ? Math.min(rest.length, Math.max(0, Math.trunc(toIndex))) : (toIndex > 0 ? rest.length : 0);
  const sequence = [...rest.slice(0, at), ...block, ...rest.slice(at)];
  const orderOf = new Map(sequence.map((id, i) => [id, i]));
  const slides = plan.slides.map((slide) => {
    const order = orderOf.get(slide.id);
    return order === undefined ? slide : { ...slide, order };
  });
  return { plan: { ...plan, slides }, touched: sequence, skipped };
}

/** Layout sources a person set: by hand, or through the one Auto-match action they took. */
const PERSON_LAYOUT_SOURCES: ReadonlySet<SlidePlanV1['layoutSource']> = new Set(['user', 'auto']);

/** A row with the person's answer taken off: no decision, author, scope or corrected text. */
function withoutPersonFields(row: ObjectPlanV1): ObjectPlanV1 {
  const next: ObjectPlanV1 = { ...row };
  const personal = next.author === 'user' || next.author === 'agent';
  delete next.decision;
  delete next.decisionReplacement;
  delete next.author;
  delete next.scope;
  delete next.textOverride;
  if (personal && next.review === 'accepted') next.review = 'unreviewed';
  return next;
}

export interface ResetSlidesOptsV1 {
  /**
   * The first pass over the same source (same preset and seed, no `previous`): the
   * proposal each slide and row goes back to. Without it the layout a person chose
   * stays, and each row loses the person's answer and waits for review again.
   */
  proposed?: RenovationPlanV1;
  /** With it, the remembered decisions of the rows put back are forgotten too. */
  source?: SourceDeckV1;
}

/**
 * "Undo my changes to this slide" (plan 275 section 5.1): each named slide goes back
 * to the proposal. A layout a person set (`user`, or `auto` from Auto-match) returns
 * to the proposed one, the slide's own background goes, and every object row that is
 * not locked returns to its proposed row, the corrected text and the remembered
 * decision included. Locked rows stay as they are and are named in `skipped`. Which
 * slides are in the deck and their order are not a change to the slide, so they stay.
 *
 * `touched` lists the slides that changed. To undo it, capture `slideIds` = touched,
 * `objectIds` = every row on those slides, and the source.
 */
export function resetSlideDecisions(plan: RenovationPlanV1, slideIds: string[], opts: ResetSlidesOptsV1 = {}): PlanEditResultV1 {
  const wanted = new Set(slideIds);
  const known = new Set(plan.slides.map((slide) => slide.id));
  const skipped: PlanEditResultV1['skipped'] = unique(slideIds).filter((id) => !known.has(id)).map((id) => ({ id, reason: 'unknown' as const }));
  const proposedSlides = new Map((opts.proposed?.slides ?? []).map((slide) => [slide.id, slide]));
  const touched: string[] = [];
  /** Memory key of each row put back with no decision, to the slide it is on. */
  const forget = new Map<string, string>();
  const placed = slideOfObject(opts.source);

  const slides = plan.slides.map((slide): SlidePlanV1 => {
    if (!wanted.has(slide.id)) return slide;
    const proposal = proposedSlides.get(slide.id);
    const proposedRows = new Map((proposal?.objects ?? []).map((row) => [row.id, row]));
    const next: SlidePlanV1 = { ...slide };
    if (PERSON_LAYOUT_SOURCES.has(slide.layoutSource) && proposal) {
      delete next.layoutAlternative;
      delete next.layoutReasons;
      delete next.layoutMatch;
      next.layout = proposal.layout;
      next.layoutSource = proposal.layoutSource;
      if (proposal.layoutAlternative !== undefined) next.layoutAlternative = proposal.layoutAlternative;
      if (proposal.layoutReasons !== undefined) next.layoutReasons = structuredClone(proposal.layoutReasons);
      if (proposal.layoutMatch !== undefined) next.layoutMatch = structuredClone(proposal.layoutMatch);
    }
    delete next.ground;
    next.objects = slide.objects.map((row) => {
      if (row.locked) {
        skipped.push({ id: row.id, reason: 'locked' });
        return row;
      }
      const back = proposedRows.get(row.id);
      const reset = back ? structuredClone(back) : withoutPersonFields(row);
      // A row with no decision after the reset has nothing to remember.
      const object = placed.get(row.id)?.objects.find((one) => one.id === row.id);
      if (object && reset.decision === undefined) forget.set(JSON.stringify([object.fingerprint, slide.id]), slide.id);
      return reset;
    });
    if (stableJson(next) !== stableJson(slide)) touched.push(slide.id);
    return next;
  });
  const decisions = plan.decisions.filter((memory) => {
    const slideId = forget.get(JSON.stringify([memory.fingerprint, memory.slideLineage]));
    if (slideId === undefined) return true;
    if (!touched.includes(slideId)) touched.push(slideId);
    return false;
  });
  if (touched.length === 0) return { plan, touched: [], skipped };
  const order = new Map(plan.slides.map((slide, i) => [slide.id, i]));
  touched.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  return { plan: { ...plan, slides, decisions }, touched, skipped };
}

/**
 * Correct an object's text (plan 275 decision 29), or give the text as read back with
 * `null`. The compile writes `textOverride` in place of the source runs; the source
 * keeps what was read. Line endings are stored as `\n`. A locked row is passed over.
 * Capture `objectIds` = touched to undo it.
 */
export function setObjectText(plan: RenovationPlanV1, objectId: string, text: string | null): PlanEditResultV1 {
  const target = rowIndex(plan).get(objectId);
  if (!target) return { plan, touched: [], skipped: [{ id: objectId, reason: 'unknown' }] };
  if (target.locked) return { plan, touched: [], skipped: [{ id: objectId, reason: 'locked' }] };
  const next = mapRows(plan, (row) => {
    if (row.id !== objectId) return row;
    const out: ObjectPlanV1 = { ...row };
    if (text === null) delete out.textOverride;
    else out.textOverride = text.replace(/\r\n?/g, '\n');
    return out;
  });
  return { plan: next, touched: [objectId], skipped: [] };
}

/**
 * Set the archetype of slides as the person's own choice. Choosing a layout is
 * choosing to pour the slide into it, so a slide kept in its original arrangement
 * or as a picture goes back to its layout.
 */
export function setSlidesLayout(plan: RenovationPlanV1, slideIds: string[], layout: ArchetypeRefV1): PlanEditResultV1 {
  return editSlides(plan, slideIds, (slide) => {
    const next: SlidePlanV1 = { ...slide, layout, layoutSource: 'user' };
    delete next.arrangement;
    return next;
  });
}

/**
 * How slides are built (plan 275 section 4, the first two chooser tiles): `layout`
 * pours the slide into its layout, `original` keeps the source placement restyled,
 * `picture` keeps the slide as it was. The layout stays on the row, so switching
 * back to `layout` restores it. `layout` is stored as no field at all, the way a
 * plan that never chose says it. Capture `slideIds` = touched to undo it.
 */
export function setSlidesArrangement(plan: RenovationPlanV1, slideIds: string[], arrangement: SlideArrangementV1): PlanEditResultV1 {
  return editSlides(plan, slideIds, (slide) => {
    const next: SlidePlanV1 = { ...slide };
    if (arrangement === 'layout') delete next.arrangement;
    else next.arrangement = arrangement;
    return next;
  });
}

/**
 * Every slide read from the same source layout as this one, in source order,
 * itself included: one override for all of them. A slide whose source names
 * no layout shares with nobody; an unknown slide gives an empty list.
 */
export function slidesSharingSourceLayout(source: SourceDeckV1, slideId: string): string[] {
  const slide = source.slides.find((one) => one.id === slideId);
  if (!slide) return [];
  const layout = slide.origin.layout;
  if (layout === undefined) return [slide.id];
  return source.slides.filter((one) => one.origin.layout === layout).map((one) => one.id);
}

// ─── colours and fonts ───────────────────────────────────────────────────────

/**
 * Pin colour uses to a target, or clear the person's choice. A target is locked
 * by default, so Shuffle keeps it; pass `lock: false` for a choice the solver
 * may move. `null` removes the target, its path, the lock and the unresolved
 * reason, and the row has no target until the colour solve runs again.
 */
export function setColorTarget(
  plan: RenovationPlanV1,
  useIds: string[],
  target: { hex: string; path?: string } | null,
  lock?: boolean,
): PlanEditResultV1 {
  const wanted = new Set(useIds);
  const known = new Set(plan.colors.map((row) => row.useId));
  const colors = plan.colors.map((row): ColorMappingV1 => {
    if (!wanted.has(row.useId)) return row;
    const next: ColorMappingV1 = { ...row };
    delete next.to;
    delete next.toPath;
    delete next.locked;
    delete next.unresolved;
    if (target) {
      next.to = target.hex;
      if (target.path !== undefined) next.toPath = target.path;
      if (lock ?? true) next.locked = true;
    }
    return next;
  });
  return {
    plan: { ...plan, colors },
    touched: unique(useIds).filter((id) => known.has(id)),
    skipped: unique(useIds).filter((id) => !known.has(id)).map((id) => ({ id, reason: 'unknown' as const })),
  };
}

/** Map a source face to a target of the person's choosing. */
export function setFontTarget(plan: RenovationPlanV1, from: string, to: string, toPath?: string): PlanEditResultV1 {
  if (!plan.fonts.some((row) => row.from === from)) {
    return { plan, touched: [], skipped: [{ id: from, reason: 'unknown' }] };
  }
  const fonts = plan.fonts.map((row): FontMappingV1 => {
    if (row.from !== from) return row;
    const next: FontMappingV1 = { from: row.from, to, source: 'user' };
    if (toPath !== undefined) next.toPath = toPath;
    return next;
  });
  return { plan: { ...plan, fonts }, touched: [from], skipped: [] };
}

// ─── undo ────────────────────────────────────────────────────────────────────

/** The rows an edit may change, copied, so restoring them inverts the edit. */
export interface PlanRowsSnapshotV1 {
  objects: ObjectPlanV1[];
  slides: Array<Omit<SlidePlanV1, 'objects'>>;
  colors: ColorMappingV1[];
  fonts: FontMappingV1[];
  /** The memory entries the captured objects own, as they were. */
  decisions: DecisionMemoryV1[];
  /** Where each captured memory entry sat in the list, so a restore puts it back in place. */
  decisionIndex: number[];
  /**
   * The memory keys the capture owns, `JSON.stringify([fingerprint, slideLineage])`
   * of each captured object, including keys that held no entry at capture time.
   * Set when the capture was given the source.
   */
  decisionKeys?: string[];
  /**
   * The slides whose memory entries the capture owns, used only when the
   * capture had no source to read fingerprints from. Empty otherwise.
   */
  decisionSlides: string[];
}

export interface PlanRowsTouchedV1 {
  objectIds?: string[];
  slideIds?: string[];
  useIds?: string[];
  fonts?: string[];
  /**
   * The edit changes the deck theme (plan 275 section 6.2), so the capture is to
   * hold `designSystem.theme` beside the slides' grounds and the remapped uses
   * named in `slideIds` and `useIds`. Declared ahead of the theme edits;
   * `capturePlanRows` does not read it yet.
   */
  theme?: boolean;
  /**
   * The source the edit was given. With it, memory is captured per object (its
   * fingerprint on its slide), so undoing an older transaction leaves a later
   * decision on the same slide in place. Pass it whenever the edit had one.
   */
  source?: SourceDeckV1;
}

function memoryKey(fingerprint: string, slideLineage: string): string {
  return JSON.stringify([fingerprint, slideLineage]);
}

/**
 * Copy the rows an edit will touch. With the source, the capture owns exactly
 * the memory keys of the captured objects, so a restore in whatever order leaves
 * other decisions alone. Without it, memory is owned per slide, which is exact
 * only when transactions are undone newest first.
 */
export function capturePlanRows(plan: RenovationPlanV1, touched: PlanRowsTouchedV1): PlanRowsSnapshotV1 {
  const objectIds = new Set(touched.objectIds ?? []);
  const slideIds = new Set(touched.slideIds ?? []);
  const useIds = new Set(touched.useIds ?? []);
  const fontNames = new Set(touched.fonts ?? []);

  const objects: ObjectPlanV1[] = [];
  const slides: Array<Omit<SlidePlanV1, 'objects'>> = [];
  const decisionSlides = new Set<string>();
  for (const slide of plan.slides) {
    if (slideIds.has(slide.id)) {
      const { objects: _rows, ...rest } = slide;
      slides.push(structuredClone(rest));
    }
    for (const row of slide.objects) {
      if (!objectIds.has(row.id)) continue;
      objects.push(structuredClone(row));
      decisionSlides.add(slide.id);
    }
  }

  let keys: Set<string> | undefined;
  if (touched.source) {
    keys = new Set<string>();
    for (const slide of touched.source.slides) {
      for (const object of slide.objects) {
        if (objectIds.has(object.id)) keys.add(memoryKey(object.fingerprint, slide.id));
      }
    }
  }
  const owns = (memory: DecisionMemoryV1): boolean => (keys
    ? keys.has(memoryKey(memory.fingerprint, memory.slideLineage))
    : decisionSlides.has(memory.slideLineage));

  const decisions: DecisionMemoryV1[] = [];
  const decisionIndex: number[] = [];
  plan.decisions.forEach((memory, i) => {
    if (!owns(memory)) return;
    decisions.push(structuredClone(memory));
    decisionIndex.push(i);
  });

  const snapshot: PlanRowsSnapshotV1 = {
    objects,
    slides,
    colors: plan.colors.filter((row) => useIds.has(row.useId)).map((row) => structuredClone(row)),
    fonts: plan.fonts.filter((row) => fontNames.has(row.from)).map((row) => structuredClone(row)),
    decisions,
    decisionIndex,
    decisionSlides: keys ? [] : [...decisionSlides].sort(),
  };
  if (keys) snapshot.decisionKeys = [...keys].sort();
  return snapshot;
}

/**
 * Put captured rows back. Rows outside the capture keep whatever they hold now,
 * so undoing one transaction never reverts another on different rows.
 */
export function restorePlanRows(plan: RenovationPlanV1, snapshot: PlanRowsSnapshotV1): RenovationPlanV1 {
  const objects = new Map(snapshot.objects.map((row) => [row.id, row]));
  const slides = new Map(snapshot.slides.map((row) => [row.id, row]));
  const colors = new Map(snapshot.colors.map((row) => [row.useId, row]));
  const fonts = new Map(snapshot.fonts.map((row) => [row.from, row]));

  const nextSlides = plan.slides.map((slide): SlidePlanV1 => {
    const rows = slide.objects.map((row) => {
      const captured = objects.get(row.id);
      return captured ? structuredClone(captured) : row;
    });
    const captured = slides.get(slide.id);
    return captured ? { ...structuredClone(captured), objects: rows } : { ...slide, objects: rows };
  });

  const ownedKeys = snapshot.decisionKeys ? new Set(snapshot.decisionKeys) : undefined;
  const ownedSlides = new Set(snapshot.decisionSlides);
  const owned = (memory: DecisionMemoryV1): boolean => (ownedKeys
    ? ownedKeys.has(memoryKey(memory.fingerprint, memory.slideLineage))
    : ownedSlides.has(memory.slideLineage));
  const decisions = plan.decisions.filter((memory) => !owned(memory));
  const back = snapshot.decisions
    .map((memory, i) => ({ memory, at: snapshot.decisionIndex[i] ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.at - b.at);
  for (const { memory, at } of back) decisions.splice(Math.min(at, decisions.length), 0, structuredClone(memory));

  return {
    ...plan,
    slides: nextSlides,
    colors: plan.colors.map((row) => {
      const captured = colors.get(row.useId);
      return captured ? structuredClone(captured) : row;
    }),
    fonts: plan.fonts.map((row) => {
      const captured = fonts.get(row.from);
      return captured ? structuredClone(captured) : row;
    }),
    decisions,
  };
}
