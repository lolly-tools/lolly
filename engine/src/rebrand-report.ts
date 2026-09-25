// SPDX-License-Identifier: MPL-2.0
/**
 * The renovation report (plan 274 section 3.4, "never drop silently").
 *
 * A report is the promise that every object a reader found is still accounted
 * for after a compile: retained, transformed, removed or unresolved, one of the
 * four and one time only. This module owns the three operations that keep that
 * promise honest - start an empty report, add one entry with its counts moved in
 * the same step, and finish by checking the accounting against the set of source
 * object ids the compile was given.
 *
 * `finalizeReport` throws when the accounting does not balance. That is on
 * purpose: a compile that cannot say what happened to an object has a defect,
 * and returning a report that quietly omits it would hide the defect behind a
 * green result.
 *
 * Messages are plain English derived from the machine code when a caller gives
 * none, so a surface can localise from `code` and still have something readable
 * in a log or a JSON dump.
 *
 * Pure: no DOM, no clock, no network, no filesystem, no randomness.
 */

import type {
  DispositionV1,
  ObjectClassV1,
  RebrandReportV1,
  ReportCodeV1,
  ReportEntryV1,
  ReviewStateV1,
} from '@lolly-tools/core';

/** An entry whose message the caller may leave to `reportMessage`. */
export type ReportEntryInputV1 = Omit<ReportEntryV1, 'message'> & { message?: string };

/** Slide totals a compile knows and the entries alone cannot state. */
export interface SlideCountsV1 {
  source: number;
  included: number;
  excluded: number;
  continuation: number;
}

function zeroDispositions(): Record<DispositionV1, number> {
  return { retained: 0, transformed: 0, removed: 0, unresolved: 0 };
}

/** One plain sentence per machine code, used when an entry carries no message. */
export function reportMessage(code: ReportCodeV1): string {
  switch (code) {
    case 'object.retained':
      return 'The object was carried over.';
    case 'object.transformed':
      return 'The object was carried over in a different form.';
    case 'object.removed':
      return 'The object was left out.';
    case 'object.unresolved':
      return 'The object could not be read, so nothing stands for its content.';
    case 'object.replaced-logo':
      return 'A brand logo took the place of the source mark.';
    case 'object.placeholder-authored':
      return 'A labelled stand-in was written where the object could not be read.';
    case 'object.surplus-continuation':
      return 'The object went to a continuation slide.';
    case 'object.surplus-tray':
      return 'The object went to the unplaced-content tray.';
    case 'text.overflow':
      return 'The text is longer than its slot.';
    case 'text.font-substituted':
      return 'Another typeface took the place of the source one.';
    case 'colour.assigned':
      return 'A colour use was assigned a target.';
    case 'colour.unresolved':
      return 'A colour use has no target that meets its constraints.';
    case 'colour.contrast-below-minimum':
      return 'A text and background pair is below its contrast minimum.';
    case 'layout.overlap-with-furniture':
      return 'A layer overlaps the master furniture.';
    case 'layout.below-readable-size':
      return 'A layer draws text below the readable minimum.';
    case 'source.cap-reached':
      return 'The reader reached a cap and carried less than the file holds.';
    case 'source.media-skipped':
      return 'Media in the source was not stored.';
    case 'slide.excluded':
      return 'The slide was left out.';
    case 'slide.continuation-added':
      return 'A continuation slide was added, so slide numbering moved.';
    case 'review.applied-unreviewed':
      return 'A proposal was applied without a person reviewing it.';
    case 'export.verified':
      return 'A readback of the produced bytes confirmed the result.';
    case 'export.not-verified':
      return 'No readback of the produced bytes has run.';
    case 'text.formatting-not-carried':
      return 'The words were carried, and some of their formatting has no place in Design text.';
    case 'layout.poured-to-continuation':
      return 'More boxes of content than the layout holds, so the rest continue on a new slide.';
    case 'layout.auto-matched':
      return 'Auto-match set the slide layout.';
    case 'text.corrected':
      return 'Corrected text replaces the text that was read.';
    case 'vector.items-omitted':
      return 'Some parts of the drawing could not be carried as shapes and were left out.';
    case 'vector.kept-as-picture':
      return 'The drawing stayed a picture, so its shapes cannot be edited one by one.';
    case 'vector.metafile-not-converted':
      return 'A Windows metafile drawing stayed a picture.';
    case 'slide.original-arrangement':
      return 'The slide keeps its original arrangement, restyled.';
    case 'slide.kept-as-picture':
      return 'The slide was kept as it was, as a picture.';
    default:
      return 'The renovation recorded an event.';
  }
}

/**
 * Codes a report's counts already carry (`counts.objects`, `coloursAssigned`), so a
 * surface that lists the entries by code beside the counts leaves them out rather
 * than say the same number twice.
 */
export const COUNTED_CODES: ReadonlySet<ReportCodeV1> = new Set<ReportCodeV1>([
  'object.retained',
  'object.transformed',
  'object.removed',
  'colour.assigned',
]);

/**
 * Codes that describe the preview compile rather than a decision while the project
 * is still in review (plan 275 close-out decision 9): the preview applies every
 * proposal so the person sees it, and `review.applied-unreviewed` there says only
 * that. Open in Design is refused while a proposal waits, so once the project is
 * compiled for Design the entry means what it says again.
 */
export const REVIEW_ONLY_CODES: ReadonlySet<ReportCodeV1> = new Set<ReportCodeV1>(['review.applied-unreviewed']);

/**
 * Whether a surface listing the report's entries by code beside its counts leaves
 * this code out. `inReview` is true while the report is the preview's, before the
 * project was compiled for Design.
 */
export function countedCode(code: ReportCodeV1, opts: { inReview: boolean }): boolean {
  return COUNTED_CODES.has(code) || (opts.inReview && REVIEW_ONLY_CODES.has(code));
}

/** A report with nothing recorded yet. */
export function emptyReport(sourceHash: string, planRevision: number): RebrandReportV1 {
  return {
    version: 1,
    sourceHash,
    planRevision,
    counts: {
      slides: { source: 0, included: 0, excluded: 0, continuation: 0 },
      objects: zeroDispositions(),
      byClass: {},
      logosReplaced: 0,
      coloursAssigned: 0,
      coloursUnresolved: 0,
      fontsSubstituted: 0,
      appliedUnreviewed: 0,
    },
    entries: [],
  };
}

/** Record the slide totals. Separate from `addEntry` because no entry states them. */
export function setSlideCounts(report: RebrandReportV1, counts: SlideCountsV1): RebrandReportV1 {
  report.counts.slides = { ...counts };
  return report;
}

function bumpClass(report: RebrandReportV1, cls: ObjectClassV1, disposition: DispositionV1): void {
  const current = report.counts.byClass[cls] ?? zeroDispositions();
  current[disposition] += 1;
  report.counts.byClass[cls] = current;
}

/**
 * Append one entry and move every count it affects in the same step, so the
 * totals can never disagree with the list they summarise.
 */
export function addEntry(report: RebrandReportV1, entry: ReportEntryInputV1): RebrandReportV1 {
  const full: ReportEntryV1 = { ...entry, message: entry.message ?? reportMessage(entry.code) };
  report.entries.push(full);

  if (full.disposition) {
    report.counts.objects[full.disposition] += 1;
    if (full.class) bumpClass(report, full.class, full.disposition);
  }
  switch (full.code) {
    case 'object.replaced-logo':
      report.counts.logosReplaced += 1;
      break;
    case 'colour.assigned':
      report.counts.coloursAssigned += 1;
      break;
    case 'colour.unresolved':
      report.counts.coloursUnresolved += 1;
      break;
    case 'text.font-substituted':
      report.counts.fontsSubstituted += 1;
      break;
    case 'review.applied-unreviewed':
      report.counts.appliedUnreviewed += 1;
      break;
    default:
      break;
  }
  return report;
}

/**
 * The content-accounting invariant: each id in `objectIds` carries exactly one
 * disposition among the entries, and no entry carries a disposition for an id
 * outside that set. Throws with the offending ids named when it does not hold.
 */
export function finalizeReport(report: RebrandReportV1, objectIds: Iterable<string>): RebrandReportV1 {
  const expected = new Set<string>(objectIds);
  const seen = new Map<string, number>();
  const strangers: string[] = [];

  for (const entry of report.entries) {
    if (!entry.disposition) continue;
    const id = entry.objectId;
    if (id === undefined) {
      throw new Error('A report entry states a disposition with no objectId, so it accounts for nothing.');
    }
    if (!expected.has(id)) {
      strangers.push(id);
      continue;
    }
    seen.set(id, (seen.get(id) ?? 0) + 1);
  }

  const missing = [...expected].filter((id) => !seen.has(id)).sort();
  const duplicated = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id).sort();
  const unknown = [...new Set(strangers)].sort();

  if (missing.length || duplicated.length || unknown.length) {
    const parts: string[] = [];
    if (missing.length) parts.push(`${missing.length} source object(s) have no disposition: ${missing.slice(0, 10).join(', ')}`);
    if (duplicated.length) parts.push(`${duplicated.length} source object(s) have more than one: ${duplicated.slice(0, 10).join(', ')}`);
    if (unknown.length) parts.push(`${unknown.length} disposition(s) name an object the source does not have: ${unknown.slice(0, 10).join(', ')}`);
    throw new Error(`The report does not account for every source object exactly once. ${parts.join('. ')}.`);
  }
  return report;
}

/**
 * Record that proposals were applied without a person reviewing them: one
 * `review.applied-unreviewed` entry per object id, for a CLI run with
 * `--accept-suggestions` or a preset run, which answer the review on the
 * person's behalf. The ids are what `acceptSuggestions` returned as touched.
 *
 * Each id may carry the review state it had before the apply. A row that was
 * flagged as needing attention is recorded with review `needs-attention`, so
 * the report shows that an item flagged for a person was accepted without one;
 * a bare id is recorded as `unreviewed`.
 *
 * Returns a new report and leaves the one passed in as it was. An id that
 * already has such an entry is not counted twice, and an entry carries no
 * disposition, so the accounting `finalizeReport` checks is unchanged.
 */
export function markAppliedUnreviewed(
  report: RebrandReportV1,
  objectIds: ReadonlyArray<string | { id: string; review: ReviewStateV1 }>,
): RebrandReportV1 {
  const next: RebrandReportV1 = structuredClone(report);
  const marked = new Set<string>();
  for (const entry of next.entries) {
    if (entry.code === 'review.applied-unreviewed' && entry.objectId !== undefined) marked.add(entry.objectId);
  }
  for (const one of objectIds) {
    const id = typeof one === 'string' ? one : one.id;
    if (marked.has(id)) continue;
    marked.add(id);
    const review: ReviewStateV1 = typeof one !== 'string' && one.review === 'needs-attention' ? 'needs-attention' : 'unreviewed';
    addEntry(next, { code: 'review.applied-unreviewed', objectId: id, review });
  }
  return next;
}
