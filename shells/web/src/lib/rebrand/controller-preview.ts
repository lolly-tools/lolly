// SPDX-License-Identifier: MPL-2.0
/**
 * The preview and lineage helpers of the Rebrand controller, moved out of
 * `controller.ts` so it stays under the module size budget: which slides are still
 * slide pictures, the recovery pictures, the one-slide preview spliced into the held
 * deck, the preview plan, carrying a person's rows into a newer read, the lineage queue
 * items and the nearest design system colour. Pure: no DOM, no store, no clock.
 * `controller.ts` re-exports every name, so callers import from there as before.
 */
import { effectiveAction, nearestBrandColor, reviewFidelity, type QueueItemV1, type ReviewFidelityV1 } from '@lolly/engine';
import type { ColorMappingV1, ObjectClassV1, CompiledDeckV1, RenovationPlanV1, SlidePlanV1, SourceDeckV1 } from '@lolly-tools/core/rebrand-v1';
import { tRaw } from '../../i18n.ts';
import type { RebrandDesignSystemInfoV1 } from './controller-api.ts';

/**
 * The slides of a read deck that are still one picture of a whole slide and can be
 * rebuilt: marked flattened by the reader, not rebuilt yet (a rebuilt slide keeps its
 * picture as `recovery`), and holding one own object, a picture whose bytes were
 * stored. The rule is `slidePictureIds` in `ingest.ts` (`flattenedPictureOf` for a
 * slide the reader marked), stated here so the view does not load the rebuild to count
 * them; `ingest.test.ts` holds the two to the same answer. A slide the rebuild could
 * not touch is never offered for reading.
 */
export function slidePictureIdsOf(source: SourceDeckV1): string[] {
  return source.slides.filter(isSlidePicture).map((slide) => slide.id);
}

function isSlidePicture(slide: SourceDeckV1['slides'][number]): boolean {
  if (slide.origin.flattened !== true || slide.recovery) return false;
  const own = slide.objects.filter((object) => object.origin === 'slide' || object.origin === 'pdf-artifact');
  const [only] = own;
  return own.length === 1 && only?.kind === 'pic' && Boolean(only.media);
}

/**
 * The untouched picture of every slide rebuilt from one (`recovery.assetRef`), so the
 * Original pane and the filmstrip can show the slide as it was (plan 275 decision 29).
 */
export function recoveryRefs(source: SourceDeckV1 | null | undefined): string[] {
  const out: string[] = [];
  for (const slide of source?.slides ?? []) {
    const ref = slide.recovery?.assetRef;
    if (typeof ref === 'string' && ref.length > 0) out.push(ref);
  }
  return out;
}

/**
 * The held preview with the frames of `slideIds` taken from `quick`, a compile of those
 * slides alone for plan `revision` (plan 275 decision 31: a new layout shows at once).
 * Their frames go where the slide's frames were; their lineage and their tray rows
 * replace the old ones; the report stays the held one until the whole-deck compile
 * arrives. `objectsOf` lists the source objects of every changed slide, so a tray row
 * or a link of an object that moved between the tray and a frame is replaced too.
 *
 * The slides compiled alone were numbered as the first of a short deck. `pageNumbers`
 * lists the master's page-number furniture, and a spliced frame's page number that
 * reads its place in the short deck is written again with its place in the whole one.
 * While the deck compiles, each slide shows its real number. Pure.
 */
export function splicePreviewDeck(
  held: CompiledDeckV1,
  quick: CompiledDeckV1,
  slideIds: ReadonlySet<string>,
  objectsOf: ReadonlySet<string>,
  revision: number,
  pageNumbers: ReadonlySet<string> = new Set(),
): CompiledDeckV1 {
  const fresh = new Map<string, CompiledDeckV1['frames']>();
  for (const frame of quick.frames) {
    if (!slideIds.has(frame.sourceSlideId)) continue;
    const list = fresh.get(frame.sourceSlideId) ?? [];
    list.push(frame);
    fresh.set(frame.sourceSlideId, list);
  }
  const layerIds = (frames: CompiledDeckV1['frames']): string[] => frames.flatMap((frame) => [frame.id, ...frame.layers.map((row) => String(row.id ?? ''))]);
  const dropped = held.frames.filter((frame) => slideIds.has(frame.sourceSlideId));
  const removed = new Set([...layerIds(dropped), ...held.tray.filter((row) => objectsOf.has(row.sourceObjectId)).map((row) => String(row.layer.id ?? ''))]);
  const quickTray = quick.tray.filter((row) => objectsOf.has(row.sourceObjectId));
  const added = [...fresh.values()].flat();
  const kept = new Set([...layerIds(added), ...quickTray.map((row) => String(row.layer.id ?? ''))]);
  const frames: CompiledDeckV1['frames'] = [];
  const placed = new Set<string>();
  for (const frame of held.frames) {
    if (!slideIds.has(frame.sourceSlideId)) {
      frames.push(frame);
      continue;
    }
    if (placed.has(frame.sourceSlideId)) continue;
    placed.add(frame.sourceSlideId);
    for (const one of fresh.get(frame.sourceSlideId) ?? []) frames.push(renumbered(one, quick.frames.indexOf(one), frames.length, pageNumbers));
  }
  return {
    ...held,
    planRevision: revision,
    frames,
    tray: [...held.tray.filter((row) => !objectsOf.has(row.sourceObjectId)), ...quickTray],
    lineage: {
      forward: [
        ...held.lineage.forward.filter((entry) => !objectsOf.has(entry.sourceObjectId)),
        ...quick.lineage.forward.filter((entry) => objectsOf.has(entry.sourceObjectId)),
      ],
      backward: [
        ...held.lineage.backward.filter((entry) => !removed.has(entry.layerId)),
        ...quick.lineage.backward.filter((entry) => kept.has(entry.layerId)),
      ],
    },
  };
}

/**
 * A frame compiled at place `was` of a short deck, moved to place `now` of the whole one:
 * its page-number furniture that reads `was + 1` reads `now + 1`. The frame comes back as
 * it was when nothing changes. Pure.
 */
function renumbered(frame: CompiledDeckV1['frames'][number], was: number, now: number, pageNumbers: ReadonlySet<string>): CompiledDeckV1['frames'][number] {
  if (was < 0 || was === now || pageNumbers.size === 0) return frame;
  const from = String(was + 1);
  let changed = false;
  const layers = frame.layers.map((row) => {
    const furniture = typeof row.furniture === 'string' ? row.furniture : '';
    if (!pageNumbers.has(furniture) || String(row.text ?? '') !== from) return row;
    changed = true;
    return { ...row, text: String(now + 1) };
  });
  return changed ? { ...frame, layers } : frame;
}

/** More than half the slides of this deck are still one picture of a whole slide. */
export function mostlyPictures(source: SourceDeckV1 | null | undefined): boolean {
  if (!source || source.slides.length === 0) return false;
  return slidePictureIdsOf(source).length * 2 > source.slides.length;
}

type PlanRowV1 = SlidePlanV1['objects'][number];

/** A row with no answer yet: no decision, and a review state that is not accepted. */
function waitingRow(row: PlanRowV1): boolean {
  return row.decision === undefined && (row.review === 'unreviewed' || row.review === 'needs-attention');
}

/**
 * The plan the Proposed pane compiles. The preview applies every proposal, flagged
 * ones included, because Accept all suggestions will answer them as proposed. A locked
 * row still waiting is the one exception: nothing answers it, so Open in Design holds
 * its proposal back and compiles it as keep, and the preview reads it as a keep too.
 * The plan comes back as it was when no row is like that.
 */
export function previewPlanOf(plan: RenovationPlanV1): RenovationPlanV1 {
  const held = (row: PlanRowV1): boolean => row.locked === true && waitingRow(row) && row.proposal !== 'keep';
  if (!plan.slides.some((slide) => slide.objects.some(held))) return plan;
  const asKeep = (row: PlanRowV1): PlanRowV1 => {
    const next: PlanRowV1 = { ...row, proposal: 'keep' };
    delete next.proposalReplacement;
    return next;
  };
  return {
    ...plan,
    slides: plan.slides.map((slide) => (slide.objects.some(held)
      ? { ...slide, objects: slide.objects.map((row) => (held(row) ? asKeep(row) : row)) }
      : slide)),
  };
}

/**
 * A plan made again against another design system, with what the person chose on the
 * plan before it: which slides are in and their order, a layout they picked that the
 * new slide master still offers, a locked colour whose token (or hex) the new design
 * system still has, and a face they chose that it still lists. Object decisions are
 * carried by the plan stage itself, from `previous`.
 */
export function carryPersonRows(next: RenovationPlanV1, previous: RenovationPlanV1, info: RebrandDesignSystemInfoV1): RenovationPlanV1 {
  const slidesBefore = new Map(previous.slides.map((slide) => [slide.id, slide]));
  const archetypes = new Set(info.archetypes);
  const slides = next.slides.map((slide): SlidePlanV1 => {
    const before = slidesBefore.get(slide.id);
    if (!before) return slide;
    const out: SlidePlanV1 = { ...slide, include: before.include };
    if (before.order === undefined) delete out.order;
    else out.order = before.order;
    if (before.layoutSource === 'user' && archetypes.has(before.layout)) {
      out.layout = before.layout;
      out.layoutSource = 'user';
    }
    return out;
  });

  const hexes = new Set(Object.values(info.colors).map((hex) => hex.toLowerCase()));
  const lockedBefore = new Map(previous.colors.filter((row) => row.locked === true).map((row) => [row.useId, row]));
  const colors = next.colors.map((row): ColorMappingV1 => {
    const before = lockedBefore.get(row.useId);
    if (!before) return row;
    const hex = before.toPath !== undefined
      ? info.colors[before.toPath]
      : (before.to !== undefined && hexes.has(before.to.toLowerCase()) ? before.to : undefined);
    if (hex === undefined) return row;
    const out: ColorMappingV1 = { ...row, to: hex, locked: true };
    if (before.toPath !== undefined) out.toPath = before.toPath;
    else delete out.toPath;
    delete out.unresolved;
    return out;
  });

  const faces = new Set(info.fonts);
  const chosenFaces = new Map(previous.fonts.filter((row) => row.source === 'user' && faces.has(row.to)).map((row) => [row.from, row]));
  const fonts = next.fonts.map((row) => chosenFaces.get(row.from) ?? row);

  return { ...next, slides, colors, fonts };
}

/**
 * The first plan of a newer version of a deck, with what the person chose on the plan
 * of the version before it: which slides are left out, the layouts they picked, the
 * colours they locked and the faces they chose. A slide carries only when it is the
 * same slide, by id and by at least one object the engine matched across the two
 * versions (`carryForward`), so a slide added before it cannot take its choices. The
 * order stays the new version's own, since the slides around it may have moved.
 */
export function carryIntoNewerVersion(next: RenovationPlanV1, previous: RenovationPlanV1, info: RebrandDesignSystemInfoV1): RenovationPlanV1 {
  const matched = new Set([...(next.carryForward?.carried ?? []), ...(next.carryForward?.needsReview ?? [])]);
  const same = new Set(next.slides.filter((slide) => slide.objects.some((row) => matched.has(row.id))).map((slide) => slide.id));
  const trimmed: RenovationPlanV1 = { ...previous, slides: previous.slides.filter((slide) => same.has(slide.id)) };
  const carried = carryPersonRows(next, trimmed, info);
  const orderOf = new Map(next.slides.map((slide) => [slide.id, slide.order]));
  return {
    ...carried,
    slides: carried.slides.map((slide) => {
      const out: SlidePlanV1 = { ...slide };
      const order = orderOf.get(slide.id);
      if (out.include && order !== undefined) out.order = order;
      else delete out.order;
      return out;
    }),
  };
}

/**
 * A plan made again over the same bytes (a preset, a changed design system) is not a new
 * version: the carry-forward facts the engine wrote about it describe the plan being
 * replaced, not a newer deck. The facts the plan before it held stay as they were.
 */
export function keepLineageFacts(next: RenovationPlanV1, previous: RenovationPlanV1): RenovationPlanV1 {
  if (next.source.hash !== previous.source.hash) return next;
  const out: RenovationPlanV1 = { ...next };
  if (previous.carryForward) out.carryForward = previous.carryForward;
  else delete out.carryForward;
  return out;
}

/** The queue item ids a newer version adds. */
export const CARRIED_ITEM_ID = 'lineage:carried';
export const ANOTHER_LOOK_ITEM_ID = 'lineage:another-look';

/**
 * The two queue items a newer version of a deck adds (plan 274 section 2.1 step 6):
 * "Carried from the last version", the objects a decision reached (settled, since each
 * already has its answer), and "N objects changed in this version", the objects whose
 * decision did not carry because the object changed. An
 * object the previous version named that this one no longer has is left out: there is
 * nothing to select. Empty for a plan that is no newer version.
 */
export function lineageQueueItems(plan: RenovationPlanV1, source: SourceDeckV1 | null): QueueItemV1[] {
  const facts = plan.carryForward;
  if (!facts) return [];
  const objects = new Map((source?.slides ?? []).flatMap((slide) => slide.objects.map((object) => [object.id, object] as const)));
  const numbers = new Map((source?.slides ?? []).map((slide, i) => [slide.id, i + 1]));
  const rows = new Map<string, { row: PlanRowV1; slideId: string }>();
  for (const slide of plan.slides) for (const row of slide.objects) rows.set(row.id, { row, slideId: slide.id });

  const item = (id: string, ids: string[], section: QueueItemV1['section'], title: string, evidence: string): QueueItemV1 | null => {
    const members = ids.flatMap((one) => {
      const found = rows.get(one);
      return found ? [found] : [];
    });
    const first = members[0];
    if (!first) return null;
    const classes = new Set(members.map((member) => member.row.class));
    const klass: ObjectClassV1 = classes.size === 1 ? first.row.class : 'unknown';
    const slideIds = [...new Set(members.map((member) => member.slideId))];
    const rank: Record<ReviewFidelityV1, number> = { editable: 0, picture: 1, approximate: 2, unavailable: 3 };
    let fidelity: ReviewFidelityV1 = 'editable';
    for (const member of members) {
      const one = reviewFidelity(objects.get(member.row.id));
      if (rank[one] > rank[fidelity]) fidelity = one;
    }
    return {
      id,
      section,
      class: klass,
      action: effectiveAction(first.row),
      proposal: first.row.proposal,
      review: section === 'attention' ? 'needs-attention' : 'accepted',
      objectIds: members.map((member) => member.row.id),
      lockedIds: members.filter((member) => member.row.locked === true).map((member) => member.row.id),
      correctedIds: [],
      mixedIds: [],
      slideIds,
      slideNumbers: [...new Set(slideIds.map((slideId) => numbers.get(slideId) ?? 0))].filter((n) => n > 0).sort((a, b) => a - b),
      exemplar: first.row.id,
      title: { code: `web.${id}`, params: { count: members.length }, text: title },
      evidence: { code: `web.${id}.evidence`, params: { count: members.length }, text: evidence },
      fidelity,
    };
  };

  const out: QueueItemV1[] = [];
  const again = facts.needsReview.filter((id) => {
    const found = rows.get(id);
    return found !== undefined && found.row.decision === undefined;
  });
  const look = item(
    ANOTHER_LOOK_ITEM_ID,
    again,
    'attention',
    again.length === 1 ? tRaw('1 object changed in this version') : tRaw('{n} objects changed in this version', { n: again.length }),
    tRaw('The earlier decision did not carry over.'),
  );
  if (look) out.push(look);
  // Already answered, so it is settled: it never counts as something to review, and the
  // queue shows it as a note rather than as a card waiting for a person.
  const carried = facts.carried.filter((id) => rows.has(id));
  const kept = item(
    CARRIED_ITEM_ID,
    carried,
    'settled',
    tRaw('Carried from the last version'),
    carried.length === 1
      ? tRaw('1 decision from the last version still applies.')
      : tRaw('{n} decisions from the last version still apply.', { n: carried.length }),
  );
  if (kept) out.push(kept);
  return out;
}

/**
 * The engine's queue with the items a newer version adds: the objects that changed at the
 * head of the attention section, Carried from the last version (settled) at the end.
 * The queue comes back as it was for a plan that is no newer version.
 */
export function queueWithLineage(queue: QueueItemV1[], plan: RenovationPlanV1, source: SourceDeckV1 | null): QueueItemV1[] {
  const extra = lineageQueueItems(plan, source);
  if (extra.length === 0) return queue;
  const ids = new Set(extra.map((item) => item.id));
  const rest = queue.filter((item) => !ids.has(item.id));
  const at = rest.findIndex((item) => item.section !== 'attention');
  const cut = at === -1 ? rest.length : at;
  return [
    ...extra.filter((item) => item.section === 'attention'),
    ...rest.slice(0, cut),
    ...extra.filter((item) => item.section === 'suggestions'),
    ...rest.slice(cut),
    ...extra.filter((item) => item.section === 'settled'),
  ];
}

/**
 * The design system colour nearest to `hex` in OKLab, with its token path, or null
 * when the design system has none. The per-colour scorer the colour solve itself uses.
 */
export function nearestSystemColour(hex: string, colors: Record<string, string>): { hex: string; path?: string } | null {
  const paths = Object.keys(colors).sort();
  const swatches = paths.flatMap((path) => {
    const value = colors[path];
    return typeof value === 'string' && value ? [{ name: path, hex: value }] : [];
  });
  const found = nearestBrandColor(hex, swatches);
  if (!found) return null;
  // The design system's own spelling of the colour, as every other target carries it.
  const own = found.name ? colors[found.name] : undefined;
  return found.name ? { hex: own ?? found.hex, path: found.name } : { hex: found.hex };
}
