// SPDX-License-Identifier: MPL-2.0
/**
 * Carrying a person's decisions into the next revision of a deck, and applying
 * one decision to a plan (plan 274 section 3.3, "persistence and carry-forward").
 *
 * A decision is remembered against the facts it was made about: the object's
 * content fingerprint and the slide it was on. On the same bytes the plan
 * replays exactly. On a new revision of the deck a decision travels only where
 * the object can be found again, and three routes are tried in order:
 *
 *   1. exact: the object id survived AND the new object's fingerprint is the
 *      one the decision was made against, so it is the same object in the same
 *      place. One case of it is read by kind: a picture that a newer reader reads
 *      as a vector (plan 275 decision 32) keeps its id and its place, while its
 *      fingerprint, which leads with the kind, changes. The id survived, the
 *      remembered fingerprint names a picture no object on that slide still
 *      carries, and the new object is a vector, so the decision is carried and
 *      remembered against the new fingerprint;
 *   2. fingerprint plus slide lineage: the id changed, but one object on the
 *      same slide carries that fingerprint and nothing else does;
 *   3. verified group membership: the decision was taken over a group, and the
 *      new census verified a group with that id, so the decision reaches its
 *      members.
 *
 * Everything else goes back to the queue. A moved box changes the fingerprint,
 * because the reader grids the box into it, and a changed number changes it
 * through the text, so neither is carried silently. That is the point: a
 * decision about one object must never end up on a different one.
 *
 * Pure: no DOM, no clock, no filesystem, no network, no randomness. Ids come
 * back sorted.
 */

import type {
  DecisionAuthorV1,
  DecisionMemoryV1,
  DeckCensusV1,
  ObjectPlanV1,
  PlanActionV1,
  RenovationPlanV1,
  ReplacementV1,
  SourceDeckV1,
  SourceObjectV1,
} from '@lolly-tools/core';
import { compareCodeUnits } from './rebrand-order.ts';

/** Identity of these rules, recorded on a plan for replay. */
export const DECISION_RULES = { name: 'rebrand-decisions', version: 'decisions-2026-09-24.2' } as const;

/** One decision that reached one object of the new source. */
export interface CarriedDecisionV1 {
  objectId: string;
  action: PlanActionV1;
  replacement?: ReplacementV1;
  author: DecisionAuthorV1;
  scope?: string;
  carriedBy: 'exact' | 'fingerprint' | 'group';
}

export interface CarryForwardResultV1 {
  /**
   * The memory list for the new revision: every decision that was carried,
   * with `carriedBy` naming the route that found it, followed by the ones that
   * were not, unchanged, so nothing a person decided is thrown away.
   */
  decisions: DecisionMemoryV1[];
  /** Object ids in the NEW source that a decision reached. */
  carried: string[];
  /**
   * Objects whose decision could not be placed, named as the PREVIOUS plan knew
   * them, because a renamed slide leaves no new id to point at.
   */
  needsReview: string[];
  /**
   * The carried decisions, object by object, so a caller can write them onto
   * the new plan's rows. Additive to the three lists above.
   */
  applied: CarriedDecisionV1[];
}

/** How a picture's fingerprint starts: the readers write the kind first (`pic:<hash>`). */
const PICTURE_FINGERPRINT = 'pic:';

interface NewObject {
  object: SourceObjectV1;
  slideId: string;
}

function sameReplacement(a: ReplacementV1 | undefined, b: ReplacementV1 | undefined): boolean {
  if (a === undefined && b === undefined) return true;
  if (a === undefined || b === undefined) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Every object of the new source, with the slide it sits on. */
function indexSource(source: SourceDeckV1): { byId: Map<string, NewObject>; byFingerprint: Map<string, NewObject[]> } {
  const byId = new Map<string, NewObject>();
  const byFingerprint = new Map<string, NewObject[]>();
  for (const slide of source.slides) {
    for (const object of slide.objects) {
      const row: NewObject = { object, slideId: slide.id };
      byId.set(object.id, row);
      const list = byFingerprint.get(object.fingerprint) ?? [];
      list.push(row);
      byFingerprint.set(object.fingerprint, list);
    }
  }
  return { byId, byFingerprint };
}

/**
 * Carry the previous revision's decisions onto a new reading of the same deck.
 *
 * Decisions are read from the previous plan's object rows, which is where a
 * person's choice sits, and the memory list supplies the fingerprint each one
 * was made against. A memory is consumed once, so two identical decisions on
 * one slide cannot both claim the same remembered object.
 */
export function carryForward(
  previous: RenovationPlanV1,
  source: SourceDeckV1,
  census: DeckCensusV1,
): CarryForwardResultV1 {
  const { byId, byFingerprint } = indexSource(source);
  const groups = new Map(census.groups.map((group) => [group.id, group]));

  const pool = previous.decisions.map((memory, index) => ({ memory, index, used: false }));
  const carried = new Set<string>();
  const needsReview = new Set<string>();
  const out: DecisionMemoryV1[] = [];
  const applied: CarriedDecisionV1[] = [];
  const usedMemory = new Set<number>();
  const claimed = new Set<string>();

  // One row per object, whatever route reached it. A second record for an
  // object an earlier route already claimed is refused here rather than left to
  // the order a caller happens to read the list in: a caller that collapsed the
  // list by object id would otherwise take whichever row sorted last.
  const recorded = new Set<string>();
  const record = (objectId: string, row: ObjectPlanV1, carriedBy: CarriedDecisionV1['carriedBy']): void => {
    if (recorded.has(objectId)) return;
    recorded.add(objectId);
    const entry: CarriedDecisionV1 = {
      objectId,
      action: row.decision as PlanActionV1,
      author: row.author ?? 'user',
      carriedBy,
    };
    if (row.decisionReplacement) entry.replacement = row.decisionReplacement;
    if (row.scope !== undefined) entry.scope = row.scope;
    applied.push(entry);
  };

  const rows: Array<{ slideId: string; object: ObjectPlanV1 }> = [];
  for (const slide of previous.slides) {
    for (const object of slide.objects) {
      if (object.decision === undefined) continue;
      rows.push({ slideId: slide.id, object });
    }
  }
  rows.sort((a, b) => compareCodeUnits(a.object.id, b.object.id));

  const take = (slideId: string, row: ObjectPlanV1, fingerprint?: string): { memory: DecisionMemoryV1; index: number } | null => {
    for (const entry of pool) {
      if (entry.used) continue;
      const memory = entry.memory;
      if (memory.slideLineage !== slideId) continue;
      if (memory.action !== row.decision) continue;
      if (!sameReplacement(memory.replacement, row.decisionReplacement)) continue;
      if (fingerprint !== undefined && memory.fingerprint !== fingerprint) continue;
      entry.used = true;
      return { memory, index: entry.index };
    }
    return null;
  };

  /** Fingerprints the new source carries, by slide, so a remembered one can be told apart from one still in use. */
  const heldOn = new Map<string, Set<string>>();
  for (const slide of source.slides) heldOn.set(slide.id, new Set(slide.objects.map((one) => one.fingerprint)));

  /**
   * The memory of a picture this slide no longer holds, for an object that kept its
   * id and is now read as a vector: the only thing that moved is the kind.
   */
  const takeKindMoved = (slideId: string, row: ObjectPlanV1): { memory: DecisionMemoryV1; index: number } | null => {
    const held = heldOn.get(slideId) ?? new Set<string>();
    for (const entry of pool) {
      if (entry.used) continue;
      const memory = entry.memory;
      if (memory.slideLineage !== slideId || memory.action !== row.decision) continue;
      if (!sameReplacement(memory.replacement, row.decisionReplacement)) continue;
      if (!memory.fingerprint.startsWith(PICTURE_FINGERPRINT) || held.has(memory.fingerprint)) continue;
      entry.used = true;
      return { memory, index: entry.index };
    }
    return null;
  };

  for (const { slideId, object } of rows) {
    // 1. The id survived and the fingerprint the decision was made against is
    //    the one the new reading carries: the same object in the same place.
    const same = byId.get(object.id);
    if (same) {
      const found = take(slideId, object, same.object.fingerprint);
      if (found) {
        usedMemory.add(found.index);
        carried.add(same.object.id);
        claimed.add(same.object.id);
        record(same.object.id, object, 'exact');
        out.push({ ...found.memory, carriedBy: 'exact' });
        continue;
      }
      // The same object read by a newer reader: a picture that is now a vector.
      const moved = same.slideId === slideId && same.object.kind === 'vector' ? takeKindMoved(slideId, object) : null;
      if (moved) {
        usedMemory.add(moved.index);
        carried.add(same.object.id);
        claimed.add(same.object.id);
        record(same.object.id, object, 'exact');
        out.push({ ...moved.memory, fingerprint: same.object.fingerprint, carriedBy: 'exact' });
        continue;
      }
    }

    // 2. The id changed, but one object on the same slide carries the
    //    remembered fingerprint and no other object has claimed it.
    const byMemory = take(slideId, object);
    if (byMemory) {
      const candidates = (byFingerprint.get(byMemory.memory.fingerprint) ?? [])
        .filter((row) => row.slideId === byMemory.memory.slideLineage && !claimed.has(row.object.id));
      if (candidates.length === 1) {
        const only = candidates[0];
        if (only) {
          usedMemory.add(byMemory.index);
          carried.add(only.object.id);
          claimed.add(only.object.id);
          record(only.object.id, object, 'fingerprint');
          out.push({ ...byMemory.memory, carriedBy: 'fingerprint' });
          continue;
        }
      }

      // 3. The decision was taken over a group, and the new census verified a
      //    group with that id, so it reaches the members it verified.
      // A member an earlier route already claimed keeps what that route gave
      // it: a group action never overwrites a choice made object by object.
      const group = object.scope ? groups.get(object.scope) : undefined;
      const members = group ? group.members.filter((id) => byId.has(id) && !claimed.has(id)) : [];
      if (members.length > 0) {
        usedMemory.add(byMemory.index);
        for (const id of members) {
          carried.add(id);
          claimed.add(id);
          record(id, object, 'group');
        }
        out.push({ ...byMemory.memory, carriedBy: 'group' });
        continue;
      }
      out.push({ ...byMemory.memory });
      usedMemory.add(byMemory.index);
      needsReview.add(object.id);
      continue;
    }

    // A group decision whose memory was already spent still reaches its members.
    const group = object.scope ? groups.get(object.scope) : undefined;
    const members = group ? group.members.filter((id) => byId.has(id) && !claimed.has(id)) : [];
    if (members.length > 0) {
      for (const id of members) {
        carried.add(id);
        claimed.add(id);
        record(id, object, 'group');
      }
      continue;
    }
    needsReview.add(object.id);
  }

  for (const entry of pool) {
    if (usedMemory.has(entry.index)) continue;
    out.push({ ...entry.memory });
  }

  return {
    decisions: out,
    carried: [...carried].sort(),
    needsReview: [...needsReview].sort(),
    applied: applied.sort((a, b) => compareCodeUnits(a.objectId, b.objectId)),
  };
}

/**
 * Record one decision on a plan and return the new plan. The named object gets
 * the decision, the replacement it came with, review state `accepted` and the
 * author; nothing else on the plan changes.
 *
 * `scope` names a group, and a group action reaches every object row already
 * carrying that scope, which is what the first pass writes for a logo group.
 * A row outside that scope is left exactly as it was, including its own
 * decision, so a group action can never overwrite a choice made object by
 * object elsewhere.
 *
 * `source` is optional and is what makes this compose with `carryForward`: a
 * memory carries the object's fingerprint, and a fingerprint comes from the
 * source rather than from the plan, so without the source there is nothing to
 * remember the decision against and the next revision cannot place it. Hand the
 * source in and every row this call touches gets its memory written beside the
 * row, replacing one already held for the same fingerprint and slide. Without
 * it the `decisions` list is left exactly as it was, and a caller holding the
 * source writes the memory itself.
 */
export function applyDecision(
  plan: RenovationPlanV1,
  objectId: string,
  decision: PlanActionV1,
  replacement?: ReplacementV1,
  author: DecisionAuthorV1 = 'user',
  scope?: string,
  source?: SourceDeckV1,
): RenovationPlanV1 {
  const touches = (row: ObjectPlanV1): boolean => row.id === objectId || (scope !== undefined && row.scope === scope);

  const slides = plan.slides.map((slide) => ({
    ...slide,
    objects: slide.objects.map((row) => {
      if (!touches(row)) return row;
      const next: ObjectPlanV1 = {
        ...row,
        decision,
        review: 'accepted',
        author,
      };
      if (replacement) next.decisionReplacement = replacement;
      else delete next.decisionReplacement;
      if (scope !== undefined) next.scope = scope;
      return next;
    }),
  }));

  if (!source) return { ...plan, slides };

  const placed = indexSource(source).byId;
  const decisions = [...plan.decisions];
  for (const slide of slides) {
    for (const row of slide.objects) {
      if (!touches(row)) continue;
      const found = placed.get(row.id);
      if (!found) continue;
      const memory: DecisionMemoryV1 = {
        fingerprint: found.object.fingerprint,
        slideLineage: found.slideId,
        action: decision,
        author,
        planRevision: plan.revision,
      };
      if (replacement) memory.replacement = replacement;
      if (scope !== undefined) memory.scope = scope;
      const at = decisions.findIndex((one) => one.fingerprint === memory.fingerprint && one.slideLineage === memory.slideLineage);
      if (at >= 0) decisions[at] = memory;
      else decisions.push(memory);
    }
  }
  return { ...plan, slides, decisions };
}
