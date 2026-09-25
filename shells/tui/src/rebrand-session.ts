// SPDX-License-Identifier: MPL-2.0
/**
 * The terminal Rebrand checklist (plan 274 section 5, the TUI row), without the
 * screen: open a .pptx or a PDF against the active content profile's design system, work
 * through the plan with the engine's own edits, undo, and compile to a folder.
 *
 * Every number and sentence comes from the engine's review model
 * (`reviewQueue`, `slideStates`, `planSummary`) and every change from its pure
 * edits (`decideObjects`, `acceptSuggestions`, `setSlidesIncluded`), so the
 * terminal shows the same queue and applies the same decisions the web view and
 * `lolly rebrand` do. Undo is the edit module's capture and restore: each edit
 * captures the rows it touched from the plan it started from, and undo puts them
 * back.
 *
 * The session is a plain value. Every function returns a new one, which is what
 * lets the view hold it in React state and lets the tests drive it without a
 * terminal.
 *
 * WAITING ROWS. A row waits when nobody answered it, its review is unreviewed or
 * needs attention, it is not locked and its slide is included: the engine's
 * `openPendingIds`, the one rule the web view gates Open in Design on. Accept all
 * is the engine's `acceptSuggestions` on its default of included slides only, so it
 * answers exactly those rows, and the compile warning counts them. A waiting row
 * compiles as keep.
 *
 * A PDF opens through the same `planDeck` as a pptx, which tells the two apart by
 * their bytes. No text is read from pictures here: a slide that is one picture of a
 * slide (a scanned page) stays that picture, as the counts line says.
 *
 * COMPILING. The compile and the bytes are the CLI's: `compileDeck`, then
 * `designSessionFromCompiled`, `buildDesignLolly` (read back through
 * `readLollyFile` before it counts) and `compiledDeckToPptx`, all from
 * `@lolly-tools/node-shell/rebrand`, called the way `compileOne` in
 * `shells/cli/src/rebrand.ts` calls them. That CLI module keeps its group writer
 * to itself, so `writeGroup` below writes the files the same way: temp files
 * first, then each name claimed with an exclusive create and the temp renamed
 * onto it, and on a failure every file this call placed is removed. An existing
 * file is never replaced, and neither is the source deck. The reviewed plan is
 * written as `<name>.plan.json`, the name `lolly rebrand plan` uses, so
 * `lolly rebrand compile --plan=` can compile it again. Sharing one writer and one
 * compile with the CLI waits on a node-shell export; until then the two are kept
 * in step by hand.
 */

import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';

import {
  REVIEW_NOUNS,
  acceptSuggestions,
  autoMatchCount,
  autoMatchLayouts,
  capturePlanRows,
  decideObjects,
  openPendingIds,
  planSummary,
  restorePlanRows,
  reviewQueue,
  setSlidesIncluded,
  slideStates,
  type AutoMatchBandsV1,
  type PlanEditResultV1,
  type PlanRowsSnapshotV1,
  type PlanSummaryV1,
  type QueueItemV1,
  type SlideStateV1,
} from '@lolly/engine';
import type {
  ColorMappingV1,
  DeckCensusV1,
  FileOutcomeV1,
  FontMappingV1,
  ObjectPlanV1,
  PlanActionV1,
  RenovationPlanV1,
  ReplacementV1,
  SourceDeckV1,
} from '@lolly-tools/core';
import {
  buildDesignLolly,
  catalogAssetBytes,
  compileDeck,
  compiledDeckToPptx,
  designSessionFromCompiled,
  outcomeCounts,
  outcomeOf,
  planDeck,
  resolveProfileDesignSystem,
  type OutcomeCountsV1,
  type PipelineMediaV1,
  type RebrandResolvedSystem,
  type RebrandXmlParserV1,
} from '@lolly-tools/node-shell/rebrand';

// ─── the session ─────────────────────────────────────────────────────────────

/** One undoable step: what it said when it ran, and the rows it replaced. */
export interface RebrandUndoStep {
  label: string;
  snapshot: PlanRowsSnapshotV1;
}

export interface RebrandSession {
  /** The deck path as typed, resolved. */
  path: string;
  /** The file name without its extension, used for the output names. */
  stem: string;
  resolved: RebrandResolvedSystem;
  source: SourceDeckV1;
  census: DeckCensusV1;
  media: Map<string, PipelineMediaV1>;
  plan: RenovationPlanV1;
  /** Newest last. */
  undo: RebrandUndoStep[];
}

/** An edit's new session and the one sentence the status line shows. */
export interface RebrandEdit {
  session: RebrandSession;
  message: string;
}

let parser: RebrandXmlParserV1 | null = null;

/** jsdom's DOMParser, made once per process, as the CLI makes it. */
async function xmlParser(): Promise<RebrandXmlParserV1> {
  if (parser) return parser;
  const { JSDOM } = await import('jsdom');
  const domParser = new new JSDOM('').window.DOMParser();
  parser = (xml: string): Document => domParser.parseFromString(xml, 'application/xml');
  return parser;
}

function stemOf(path: string): string {
  const name = basename(path);
  const ext = extname(name);
  return ext ? name.slice(0, -ext.length) : name;
}

/** Expand a leading `~` the way a shell would, since a typed path never passes through one. */
export function expandHome(path: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  return path === '~' ? home : path.startsWith('~/') ? join(home, path.slice(2)) : path;
}

/**
 * Read a .pptx or a PDF and run the first pass against the active content
 * profile's design system (or the named profile). Throws with a plain sentence
 * when the file cannot be read or no profile resolves here.
 */
export async function openRebrand(input: string, opts: { profile?: string } = {}): Promise<RebrandSession> {
  const path = resolve(expandHome(input.trim()));
  if (!/\.(pptx|pdf)$/i.test(path)) throw new Error(`${basename(path)} is not a .pptx or .pdf file. Rebrand reads PowerPoint decks and PDFs here.`);
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await readFile(path));
  } catch {
    throw new Error(`${path} could not be read. Check the path and try again.`);
  }
  const resolved = await resolveProfileDesignSystem(opts.profile !== undefined ? { profile: opts.profile } : {});
  if (!resolved) throw new Error('No content profile resolves here, so there is no design system to renovate against. Set LOLLY_PROFILE or run from a Lolly checkout.');
  const planned = await planDeck({ bytes, name: basename(path), parseXml: await xmlParser(), system: resolved.system });
  return {
    path,
    stem: stemOf(path),
    resolved,
    source: planned.source,
    census: planned.census,
    media: planned.media,
    plan: planned.plan,
    undo: [],
  };
}

// ─── the checklist ───────────────────────────────────────────────────────────

/** Colour uses that map the same way, shown as one read-only row. */
export interface ColourRow {
  from: string;
  role: ColorMappingV1['role'];
  to?: string;
  toPath?: string;
  unresolved?: ColorMappingV1['unresolved'];
  locked: boolean;
  uses: number;
  objects: number;
}

export interface RebrandChecklist {
  summary: PlanSummaryV1;
  queue: QueueItemV1[];
  slides: SlideStateV1[];
  colours: ColourRow[];
  fonts: FontMappingV1[];
  /** Rows waiting for an answer (see WAITING ROWS above), which compile as keep. */
  pending: number;
  /** How many of the waiting rows need attention. */
  pendingAttention: number;
  /** What `m` (Auto-match) would do, stated before it runs. */
  autoMatch: AutoMatchOffer;
}

/**
 * The rows waiting for an answer, in plan order: the engine's `openPendingIds`
 * (no decision, review unreviewed or needs attention, not locked, on an included
 * slide), under the name this module has always read it by.
 */
export function waitingIds(plan: RenovationPlanV1): string[] {
  return openPendingIds(plan);
}

/** Group the plan's colour uses by what they map from and to, unresolved rows first. */
export function colourRows(colors: readonly ColorMappingV1[]): ColourRow[] {
  const byKey = new Map<string, ColourRow & { ids: Set<string> }>();
  for (const row of colors) {
    const key = JSON.stringify([row.from.toUpperCase(), row.role, row.to ?? '', row.toPath ?? '', row.unresolved ?? '', row.locked === true]);
    let group = byKey.get(key);
    if (!group) {
      group = {
        from: row.from.toUpperCase(),
        role: row.role,
        ...(row.to !== undefined ? { to: row.to } : {}),
        ...(row.toPath !== undefined ? { toPath: row.toPath } : {}),
        ...(row.unresolved !== undefined ? { unresolved: row.unresolved } : {}),
        locked: row.locked === true,
        uses: 0,
        objects: 0,
        ids: new Set<string>(),
      };
      byKey.set(key, group);
    }
    group.uses += 1;
    for (const id of row.affects) group.ids.add(id);
  }
  const rows = [...byKey.values()].map(({ ids, ...row }) => ({ ...row, objects: ids.size }));
  const unresolvedFirst = (row: ColourRow): number => (row.unresolved !== undefined || (!row.to && !row.toPath) ? 0 : 1);
  return rows.sort((a, b) => unresolvedFirst(a) - unresolvedFirst(b) || b.uses - a.uses || (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}

export function checklistOf(session: RebrandSession): RebrandChecklist {
  const { plan, source, census } = session;
  const waiting = waitingIds(plan);
  const rows = new Map<string, ObjectPlanV1>();
  for (const slide of plan.slides) for (const row of slide.objects) rows.set(row.id, row);
  return {
    summary: planSummary(plan, source, census),
    queue: reviewQueue(plan, census, source),
    // In source order, so a slide left out stays on its row instead of moving to the end.
    slides: slideStates(plan, source, census).sort((a, b) => a.number - b.number),
    colours: colourRows(plan.colors),
    fonts: plan.fonts,
    pending: waiting.length,
    pendingAttention: waiting.filter((id) => rows.get(id)?.review === 'needs-attention').length,
    autoMatch: autoMatchOffer(session),
  };
}

// ─── wording ─────────────────────────────────────────────────────────────────

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

/**
 * The counts, from `planSummary`, as three short rows that each fit 80 columns
 * with room for larger numbers: slides and objects, review and fonts, colours and
 * flattened slides.
 */
export function countsLines(summary: PlanSummaryV1): [string, string, string] {
  const s = summary;
  const colours = [`colours ${s.colours.assigned} assigned, ${s.colours.unresolved} unresolved`];
  if (s.flattened > 0) colours.push(plural(s.flattened, 'slide is one picture', 'slides are one picture each'));
  return [
    `${s.slides.included} of ${s.slides.total} slides included · keep ${s.objects.keep}, replace ${s.objects.replace}, remove ${s.objects.remove}, unresolved ${s.objects.unresolved}`,
    `${s.review.attention} need attention, ${s.review.unreviewed} unreviewed, ${s.review.accepted} accepted · ${plural(s.fonts.substituted, 'font substituted', 'fonts substituted')}`,
    colours.join(' · '),
  ];
}

const SECTION_WORDS: Record<QueueItemV1['section'], string> = {
  attention: 'needs attention',
  suggestions: 'suggestion',
  settled: 'settled',
};

const REVIEW_WORDS: Record<QueueItemV1['review'], string> = {
  'needs-attention': 'needs attention',
  unreviewed: 'unreviewed',
  accepted: 'accepted',
};

/** `1-3, 7, 9-12`. */
export function slideRanges(numbers: readonly number[]): string {
  const out: string[] = [];
  let start: number | undefined;
  let prev: number | undefined;
  for (const n of [...numbers].sort((a, b) => a - b)) {
    if (start === undefined) start = n;
    else if (n !== (prev ?? 0) + 1) {
      out.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = n;
    }
    prev = n;
  }
  if (start !== undefined) out.push(start === prev ? `${start}` : `${start}-${prev}`);
  return out.join(', ');
}

/** One queue row: its section and action in words, then the engine's title. */
export function queueRowText(item: QueueItemV1): string {
  return `${SECTION_WORDS[item.section]} · ${item.action} · ${item.title.text}`;
}

/** The lines under the selected queue row: evidence, where, and the three states. */
export function queueDetail(item: QueueItemV1): string[] {
  const where = `${item.slideNumbers.length === 1 ? 'Slide' : 'Slides'} ${slideRanges(item.slideNumbers)}`;
  const lines = [
    item.evidence.text,
    `${where} · ${plural(item.objectIds.length, 'object', 'objects')} · ${REVIEW_WORDS[item.review]} · ${item.fidelity}`,
  ];
  const notes: string[] = [];
  if (item.lockedIds.length > 0) notes.push(`${plural(item.lockedIds.length, 'locked object stays', 'locked objects stay')} as ${item.lockedIds.length === 1 ? 'it is' : 'they are'}`);
  if (item.correctedIds.length > 0) notes.push(`${plural(item.correctedIds.length, 'object was', 'objects were')} changed by hand`);
  if (item.mixedIds.length > 0) notes.push(`${plural(item.mixedIds.length, 'object has', 'objects have')} a different action now`);
  if (notes.length > 0) lines.push(`${notes.join('; ')}.`);
  return lines;
}

/** The scope a decision on this item goes through: every member, or the one it shows. */
export type RebrandScope = 'group' | 'one';

/** The named scope, as the status row states it. */
export function scopeText(item: QueueItemV1, scope: RebrandScope): string {
  if (item.objectIds.length <= 1) return 'Apply to: this object.';
  if (scope === 'one') return 'Apply to: this object only.';
  const count = item.objectIds.length - item.lockedIds.length - item.correctedIds.length;
  return `Apply to: the ${plural(Math.max(0, count), 'matching object', 'matching objects')}.`;
}

/** One slide row: number, include state in words, layout, what still needs a look, and its title. */
export function slideRowText(slide: SlideStateV1): string {
  const state = slide.include ? 'included' : 'left out';
  const counts = [`${slide.attention} attention`, `${slide.unreviewed} unreviewed`, `${slide.removed} removed`];
  if (slide.unresolved > 0) counts.push(`${slide.unresolved} unresolved`);
  return `${String(slide.number).padStart(3)}  ${state}  ${slide.layout.padEnd(10)} ${counts.join(', ')}${slide.title ? ` · ${slide.title}` : ''}`;
}

const UNRESOLVED_WORDS: Record<NonNullable<ColorMappingV1['unresolved']>, string> = {
  'palette-too-small': 'the design system has too few colours for it',
  'contrast-unreachable': 'no colour in the design system reaches enough contrast',
  'locked-conflict': 'a locked colour conflicts with it',
  'no-candidate-in-role': 'no colour in the design system fits this role',
};

/** One colour row: from, role, where it goes or why it could not be mapped. */
export function colourRowText(row: ColourRow): string {
  const target = row.unresolved !== undefined
    ? `unresolved: ${UNRESOLVED_WORDS[row.unresolved]}`
    : row.to || row.toPath
      ? `${row.to ?? ''}${row.toPath ? ` ${row.toPath}` : ''}`.trim()
      : 'unresolved: no target recorded';
  return `${row.from} ${row.role} -> ${target} · ${plural(row.uses, 'use', 'uses')}, ${plural(row.objects, 'object', 'objects')}${row.locked ? ' · locked' : ''}`;
}

const FONT_SOURCE_WORDS: Record<FontMappingV1['source'], string> = {
  alias: 'from the substitution table',
  class: 'same family class',
  user: 'chosen by hand',
};

export function fontRowText(row: FontMappingV1): string {
  return `${row.from} -> ${row.to}${row.toPath ? ` (${row.toPath})` : ''} · ${FONT_SOURCE_WORDS[row.source]}`;
}

// ─── edits ───────────────────────────────────────────────────────────────────

/** Commit an edit: capture what it touched from the plan it started from, bump the revision. */
function commit(
  session: RebrandSession,
  result: PlanEditResultV1,
  touched: { objectIds?: string[]; slideIds?: string[] },
  label: string,
): RebrandSession {
  const snapshot = capturePlanRows(session.plan, { ...touched, ...(touched.objectIds ? { source: session.source } : {}) });
  return {
    ...session,
    plan: { ...result.plan, revision: session.plan.revision + 1 },
    undo: [...session.undo, { label, snapshot }],
  };
}

function nounOf(item: QueueItemV1): string {
  const nouns = REVIEW_NOUNS as Record<string, { one: string; many: string } | undefined>;
  return nouns[item.class]?.one ?? 'object';
}

/**
 * What Replace puts in: the replacement the queue already names for the item,
 * else the row's own, else the design system logo for a mark. Anything else has
 * no replacement to offer here: the web view opens a chooser for it, and the
 * terminal does not guess one, so a title never turns into a placeholder box.
 */
export function replacementFor(item: QueueItemV1, plan: RenovationPlanV1): ReplacementV1 | undefined {
  if (item.replacement) return item.replacement;
  for (const slide of plan.slides) {
    const row = slide.objects.find((one) => one.id === item.exemplar);
    const own = row ? (row.decisionReplacement ?? row.proposalReplacement) : undefined;
    if (own) return own;
  }
  if (item.class === 'logo-candidate' || item.class === 'known-logo') return { kind: 'brand-logo', variant: 'auto' };
  return undefined;
}

function replacementWords(replacement: ReplacementV1): string {
  switch (replacement.kind) {
    case 'brand-logo': return 'the design system logo';
    case 'placeholder': return `a placeholder labelled ${replacement.label}`;
    case 'asset': return `the catalog asset ${replacement.id}`;
    case 'supplied-picture': return 'a supplied picture';
    case 'tool': return 'a tool render';
    case 'filter': return `the ${replacement.toolId} tool`;
  }
}

const DONE_WORDS: Record<PlanActionV1, string> = { keep: 'Kept', replace: 'Replaced', remove: 'Removed' };

/**
 * Keep, Replace or Remove over one queue item. `group` applies to every member
 * and leaves locked rows and rows changed by hand as they are, stamping the
 * item's id as the named scope, except that the exemplar (the object the detail
 * pane shows) always goes in unless it is locked, as the web view's group apply
 * does. `one` applies to the exemplar only.
 */
export function decideItem(session: RebrandSession, item: QueueItemV1, action: PlanActionV1, scope: RebrandScope): RebrandEdit {
  const group = scope === 'group' && item.objectIds.length > 1;
  const replacement = action === 'replace' ? replacementFor(item, session.plan) : undefined;
  if (action === 'replace' && !replacement) {
    return { session, message: `Replacing a ${nounOf(item)} needs a choice of what goes in. Use the web view, or edit the plan file.` };
  }
  const base = { action, ...(replacement ? { replacement } : {}), author: 'user' as const, source: session.source };
  let result: PlanEditResultV1;
  if (group) {
    const own = decideObjects(session.plan, { ...base, objectIds: [item.exemplar], scope: item.id, includeCorrected: true });
    const rest = decideObjects(own.plan, { ...base, objectIds: item.objectIds.filter((id) => id !== item.exemplar), scope: item.id });
    result = { plan: rest.plan, touched: [...own.touched, ...rest.touched], skipped: [...own.skipped, ...rest.skipped] };
  } else {
    result = decideObjects(session.plan, { ...base, objectIds: [item.exemplar], includeCorrected: true });
  }
  const locked = result.skipped.filter((one) => one.reason === 'locked').length;
  const corrected = result.skipped.filter((one) => one.reason === 'corrected').length;
  const left: string[] = [];
  if (corrected > 0) left.push(`${plural(corrected, 'object', 'objects')} changed by hand stayed as ${corrected === 1 ? 'it was' : 'they were'}`);
  if (locked > 0) left.push(`${plural(locked, 'locked object', 'locked objects')} stayed as ${locked === 1 ? 'it was' : 'they were'}`);
  if (result.touched.length === 0) {
    return { session, message: `Nothing changed: ${left.length ? left.join('; ') : 'the object is locked'}.` };
  }
  const withWhat = replacement ? ` with ${replacementWords(replacement)}` : '';
  const done = `${DONE_WORDS[action]} ${plural(result.touched.length, 'object', 'objects')}${withWhat}`;
  const message = `${done}${left.length ? `; ${left.join('; ')}` : ''}.`;
  return { session: commit(session, result, { objectIds: result.touched }, `${done}.`), message };
}

/**
 * Accept every proposal still waiting on an included slide, flagged ones included,
 * as the web view's "Accept all suggestions" does: the engine's `acceptSuggestions`
 * with `scope: 'all'` on its default of included slides only, which answers the rows
 * `openPendingIds` names and no others. Rows already decided, locked rows and the
 * slides left out stay as they were.
 */
export function acceptAll(session: RebrandSession): RebrandEdit {
  const result: PlanEditResultV1 = acceptSuggestions(session.plan, { scope: 'all', author: 'user', includedOnly: true, source: session.source });
  if (result.touched.length === 0) return { session, message: 'No suggestions are waiting.' };
  const label = `Accepted ${plural(result.touched.length, 'suggestion', 'suggestions')}.`;
  return { session: commit(session, result, { objectIds: result.touched }, label), message: label };
}

/** The reads `m` applies: clear and likely ones, as the web view's Auto-match does. */
export const TUI_AUTO_MATCH_BANDS: AutoMatchBandsV1 = 'likely';

/** What Auto-match would do: how many slides it sets, how many of those are only likely, and the line that says so. */
export interface AutoMatchOffer {
  count: number;
  likely: number;
  text: string;
}

/**
 * Why `m` would set no slide, in one sentence: the suggested layouts that have too few
 * boxes are left for a person, and every other slide already uses its suggested layout.
 */
function autoMatchNoneText(counts: { capacity: number; unchanged: number }): string {
  if (counts.capacity === 1) return '1 suggested layout has too few boxes, so that slide is left for you.';
  if (counts.capacity > 1) return `${counts.capacity} suggested layouts have too few boxes, so those slides are left for you.`;
  if (counts.unchanged > 0) return 'Every slide already uses its suggested layout.';
  return 'No slide has a layout to match.';
}

/** The count `m` shows before it runs (plan 275 decision 28). */
export function autoMatchOffer(session: RebrandSession): AutoMatchOffer {
  const counts = autoMatchCount(session.plan, session.source, session.census, {
    bands: TUI_AUTO_MATCH_BANDS,
    master: session.resolved.system.input.master,
  });
  if (counts.count === 0) return { count: 0, likely: 0, text: autoMatchNoneText(counts) };
  const likely = counts.likely === 0 ? '' : counts.likely === 1 ? ' 1 is a likely match.' : ` ${counts.likely} are likely matches.`;
  return { count: counts.count, likely: counts.likely, text: `m matches ${plural(counts.count, 'slide', 'slides')}.${likely}` };
}

/**
 * Auto-match (plan 275 decision 28): every included slide whose layout read is clear
 * or likely takes the layout it names, as one undoable step. A layout a person or a
 * preset chose, an arrangement a person chose, a slide with a locked row, a slide left
 * out and a slide already on its layout stay as they are.
 */
export function autoMatch(session: RebrandSession): RebrandEdit {
  const before = autoMatchOffer(session);
  const result = autoMatchLayouts(session.plan, session.source, session.census, {
    bands: TUI_AUTO_MATCH_BANDS,
    master: session.resolved.system.input.master,
  });
  if (result.touched.length === 0) return { session, message: before.count === 0 ? before.text : 'No slide has a layout to match.' };
  const likely = before.likely === 0 ? '' : before.likely === 1 ? ' 1 was a likely match.' : ` ${before.likely} were likely matches.`;
  const label = `Matched ${plural(result.touched.length, 'slide', 'slides')}.${likely}`;
  return { session: commit(session, result, { slideIds: result.touched }, label), message: label };
}

/** Include or leave out one slide. */
export function toggleSlide(session: RebrandSession, slideId: string): RebrandEdit {
  const slide = session.plan.slides.find((one) => one.id === slideId);
  if (!slide) return { session, message: 'That slide is not in the plan.' };
  const number = session.source.slides.findIndex((one) => one.id === slideId) + 1;
  const result = setSlidesIncluded(session.plan, [slideId], !slide.include);
  const label = `${slide.include ? 'Left out' : 'Included'} slide ${number}.`;
  return { session: commit(session, result, { slideIds: result.touched }, label), message: label };
}

/**
 * Where the queue selection goes after an edit: it stays on the same item when the
 * item is still in the queue. When `moveOnSettled` is set and the item is now
 * settled, it moves on to the next item that needs attention, in queue order,
 * wrapping round, as the web view's `nextAfterSettled` does. An item that left the
 * queue keeps the old position, held inside the list.
 */
export function queueIndexAfter(queue: readonly QueueItemV1[], itemId: string | undefined, fallback: number, moveOnSettled: boolean): number {
  const at = itemId === undefined ? -1 : queue.findIndex((item) => item.id === itemId);
  if (at >= 0 && moveOnSettled && queue[at]!.section === 'settled') {
    for (let k = 1; k < queue.length; k++) {
      const i = (at + k) % queue.length;
      if (queue[i]!.section === 'attention') return i;
    }
  }
  if (at >= 0) return at;
  return Math.max(0, Math.min(fallback, queue.length - 1));
}

/** Put back the rows the newest step replaced. */
export function undoLast(session: RebrandSession): RebrandEdit {
  const step = session.undo.at(-1);
  if (!step) return { session, message: 'Nothing to undo.' };
  const plan = restorePlanRows(session.plan, step.snapshot);
  return {
    session: { ...session, plan: { ...plan, revision: session.plan.revision + 1 }, undo: session.undo.slice(0, -1) },
    message: `Undid: ${step.label}`,
  };
}

// ─── compile ─────────────────────────────────────────────────────────────────

/** One output file. */
export interface PendingFile {
  path: string;
  data: Uint8Array | string;
}

const errText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** The same file on disk: device and inode match. False when either is missing. */
async function sameFile(a: string, b: string): Promise<boolean> {
  try {
    const [one, two] = await Promise.all([stat(a), stat(b)]);
    return one.dev === two.dev && one.ino === two.ino;
  } catch {
    return false;
  }
}

/**
 * Write a group of files, all or none, into folders that already exist: temp files
 * beside each output first, then each name claimed with an exclusive create (so an
 * existing file is refused, never replaced) and the temp renamed onto it. A path
 * that is the source deck (`source`) is refused before anything is written. On a
 * failure the temps and every file this call placed are removed.
 */
export async function writeGroup(files: readonly PendingFile[], source?: string): Promise<void> {
  if (source !== undefined) {
    for (const file of files) {
      if (resolve(file.path) === resolve(source) || await sameFile(file.path, source)) {
        throw new Error(`${file.path} would replace the source deck. Choose another folder.`);
      }
    }
  }
  const temps: Array<{ path: string; temp: string }> = [];
  const placed: string[] = [];
  try {
    for (const file of files) {
      const dir = dirname(file.path);
      const temp = join(dir, `.${basename(file.path)}.${randomUUID()}.tmp`);
      try {
        temps.push({ path: file.path, temp });
        await writeFile(temp, file.data);
      } catch (err) {
        throw new Error(`${file.path} could not be written: ${errText(err)}`);
      }
    }
    for (const { path, temp } of temps) {
      try {
        const handle = await open(path, 'wx');
        await handle.close();
      } catch (err) {
        if ((err as { code?: unknown } | null)?.code === 'EEXIST') throw new Error(`${basename(path)} already exists in ${dirname(path)}. Choose another folder.`);
        throw new Error(`${path} could not be written: ${errText(err)}`);
      }
      placed.push(path);
      await rename(temp, path);
    }
  } catch (err) {
    await Promise.all(temps.map(({ temp }) => rm(temp, { force: true }).catch(() => undefined)));
    await Promise.all(placed.map((path) => rm(path, { force: true }).catch(() => undefined)));
    throw err;
  }
}

export interface RebrandCompileResult {
  /** Every file written, in the order listed. */
  files: string[];
  outcome: FileOutcomeV1;
  counts: OutcomeCountsV1;
  /** One sentence per thing the .pptx lowering or the session file did not carry. */
  notes: string[];
}

/** The Design tool version on this profile, for the session file. */
async function designToolVersion(): Promise<string | undefined> {
  try {
    const { readToolManifest } = await import('@lolly-tools/node-shell/content-roots');
    const manifest = readToolManifest('design') as { version?: unknown };
    return typeof manifest.version === 'string' ? manifest.version : undefined;
  } catch {
    return undefined;
  }
}

/** The file names a compile into `dir` writes. */
export function outputNames(session: RebrandSession, dir: string, pptx: boolean): { lolly: string; report: string; plan: string; pptx?: string } {
  const base = resolve(expandHome(dir.trim()));
  return {
    lolly: join(base, `${session.stem}.lolly`),
    report: join(base, `${session.stem}.report.json`),
    plan: join(base, `${session.stem}.plan.json`),
    ...(pptx ? { pptx: join(base, `${session.stem}.rebranded.pptx`) } : {}),
  };
}

/** Whether a typed output folder is there: a folder, missing, or something else. */
export async function folderState(dir: string): Promise<'folder' | 'missing' | 'not-a-folder'> {
  try {
    return (await stat(resolve(expandHome(dir.trim())))).isDirectory() ? 'folder' : 'not-a-folder';
  } catch (err) {
    return (err as { code?: unknown } | null)?.code === 'ENOENT' ? 'missing' : 'not-a-folder';
  }
}

/** Remove the folders a refused compile made, from `dir` up to `first`, while each is empty. */
async function removeMadeFolders(dir: string, first: string): Promise<void> {
  let at = dir;
  for (;;) {
    try {
      await rmdir(at);
    } catch {
      return;
    }
    if (at === first) return;
    const up = dirname(at);
    if (up === at) return;
    at = up;
  }
}

/**
 * Compile the plan as reviewed and write the Design document (`.lolly`), the
 * report, the plan and, when asked, a native `.pptx` into `dir`. Rows no one
 * answered compile as keep, as `compileDeck` does without an answer scope.
 *
 * The folder must exist unless `createFolder` is set, so a mistyped path is never
 * made without a word; the screen asks first. Folders this call made are removed
 * again when the compile is refused. A plan with every slide left out is refused
 * before anything is compiled.
 */
export async function compileTo(session: RebrandSession, dir: string, opts: { pptx: boolean; createFolder?: boolean }): Promise<RebrandCompileResult> {
  const names = outputNames(session, dir, opts.pptx);
  if (!session.plan.slides.some((slide) => slide.include !== false)) {
    throw new Error('Every slide is left out, so there is nothing to compile. Include at least one slide.');
  }
  const base = dirname(names.lolly);
  const state = await folderState(base);
  if (state === 'not-a-folder') throw new Error(`${base} is not a folder. Choose another folder.`);
  if (state === 'missing' && !opts.createFolder) throw new Error(`${base} does not exist. Create it first, or confirm the new folder on the screen.`);
  let made: string | undefined;
  try {
    if (state === 'missing') made = await mkdir(base, { recursive: true });
    return await compileInto(session, names);
  } catch (err) {
    if (made !== undefined) await removeMadeFolders(base, made);
    throw err;
  }
}

async function compileInto(session: RebrandSession, names: ReturnType<typeof outputNames>): Promise<RebrandCompileResult> {
  const { source, census, plan, media, resolved } = session;
  const result = await compileDeck({ source, census, plan, system: resolved.system });
  const compiled = result.compiled;
  const toolVersion = await designToolVersion();
  const document = designSessionFromCompiled(compiled, {
    label: source.source.title || session.stem,
    projectId: `tui:${source.source.instanceId}`,
    ...(toolVersion ? { toolVersion } : {}),
  });
  const now = new Date().toISOString();
  const lolly = await buildDesignLolly({ session: document, media, name: session.stem, exportedAt: now, ...(toolVersion ? { toolVersion } : {}) });
  try {
    const { readLollyFile } = await import('@lolly-tools/node-shell/lolly-file');
    readLollyFile(lolly.bytes);
  } catch (err) {
    throw new Error(`The Design document did not read back, so nothing was written: ${errText(err)}`);
  }
  const notes: string[] = [];
  const files: PendingFile[] = [
    { path: names.lolly, data: lolly.bytes },
    { path: names.report, data: `${JSON.stringify(result.report, null, 2)}\n` },
    { path: names.plan, data: `${JSON.stringify(result.plan, null, 2)}\n` },
  ];
  if (names.pptx) {
    try {
      const { rasterizeSvgToPng } = await import('@lolly-tools/node-shell/raster');
      const pptx = await compiledDeckToPptx({
        compiled,
        system: resolved.system,
        media,
        resolveCatalog: (ref) => catalogAssetBytes(ref),
        rasterizeSvg: (svg, w, h) => rasterizeSvgToPng(new TextDecoder().decode(svg), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))),
        now,
        ...(source.source.title ? { title: source.source.title } : {}),
      });
      files.push({ path: names.pptx, data: pptx.bytes });
      notes.push(...pptx.notes);
    } catch (err) {
      throw new Error(`The .pptx could not be made, so nothing was written: ${errText(err)}`);
    }
  }
  await writeGroup(files, session.path);
  if (lolly.missingMedia.length > 0) notes.push(`${plural(lolly.missingMedia.length, 'picture travels', 'pictures travel')} as a reference because this run did not hold ${lolly.missingMedia.length === 1 ? 'it' : 'them'}.`);
  // The pipeline reads the rows still waiting by the engine's one rule, as the web
  // view, the CLI and the MCP tool read them: a row on a slide left out, a locked row
  // and a decided row wait for nobody, so none of them keeps the deck from being ready.
  const counts: OutcomeCountsV1 = outcomeCounts(result.plan, compiled);
  return {
    files: files.map((file) => file.path),
    outcome: outcomeOf(result.plan, compiled),
    counts,
    notes,
  };
}

/**
 * The lines the screen shows after a compile, most important first, each short
 * enough to cut at the edge without losing the outcome: the outcome and the
 * folder, the file names, then the first note and how many there are.
 */
export function compiledLines(result: RebrandCompileResult): string[] {
  const names = result.files.map((file) => basename(file)).join(', ');
  const dir = result.files[0] ? dirname(result.files[0]) : '';
  const outcome = result.outcome === 'ready' ? 'ready' : 'needs review';
  const lines = [
    `Outcome: ${outcome}. Wrote ${plural(result.files.length, 'file', 'files')} to ${dir}.`,
    `Files: ${names}.`,
  ];
  if (result.notes.length === 1) lines.push(`Note: ${result.notes[0]}`);
  else if (result.notes.length > 1) lines.push(`Note 1 of ${result.notes.length}: ${result.notes[0]}`);
  return lines;
}
