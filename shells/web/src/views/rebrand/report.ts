// SPDX-License-Identifier: MPL-2.0
/**
 * rebrand: report drawer (plan 274 section 4 "Report drawer", section 3.4 "Never drop
 * silently"; plan 275 close-out sections 2.7 and 3.9).
 *
 * Owns `rb.els.report`. The drawer opens on what was done, not on counts: **Removed
 * objects** first and open, grouped by slide under the proposed slide's thumbnail with
 * one sentence per group ("Slide 5: 6 objects removed, by suggestion") and a row per
 * object with its crop; **Not placed** and **Objects not drawn** next, open when they
 * hold something; then **Counts** folded; then **In the proposed slides** folded, one
 * count sentence per code ("10 objects continue on a new slide.") with the objects
 * folded under it; then **Layouts**, the slides by layout with an Original and Proposed
 * pair per row. Every row about an object or a slide selects it (`rb.select`).
 * Opens as a side drawer on a wide screen and a sheet on a narrow one; Esc closes it and
 * focus returns to what opened it, or to the project actions button when that is gone.
 *
 * Built on the plan 273 panel primitive (`.lp`, `.lp-head`, `.lp-scroll`, `.lp-sec`,
 * `.lp-rows`), so the drawer reads like every other column in the app: each head carries
 * its glyph, its name, its count and the caret.
 *
 * Pictures come from the comparison's drawing cache (`rb.compare.draw` for a slide,
 * `rb.compare.crop` for an object), never drawn here. A long report is virtual: each
 * slide group (and each layout group, and each short list with pictures) is a block
 * whose rows and pictures mount when the block comes near the drawer's scroll window
 * and are released again when it leaves, so a 40-slide deck holds only the drawings
 * near the window. The block keeps its height while empty, so the scroll bar never
 * jumps.
 *
 * Three sections follow the project across openings and versions (plan 274 sections
 * 2.1 step 6 and 3.4): the Design documents this project opened, newest first, each one
 * a door that opens it; what the last Open in Design changed against the compile before
 * it (`state.compileDiff`), which is the plan change and never the edits made in Design
 * since; and the other versions of this deck on the device (`state.versions`), each one
 * opening its own project. What Open in Design warned about arrives through `notes`.
 */
import '../../styles/parts/panel.css';
import type { ObjectStateV1 } from '@lolly/engine';
import type {
  CompiledDeckV1,
  CompiledFrameV1,
  DecisionAuthorV1,
  ObjectClassV1,
  ObjectPlanV1,
  RenovationPlanV1,
  ReportCodeV1,
  ReportEntryV1,
  SourceDeckV1,
  SourceObjectKindV1,
  SourceObjectV1,
} from '@lolly-tools/core/rebrand-v1';
import { tRaw } from '../../i18n.ts';
import { trapFocus, type FocusTrap } from '../../lib/focus-trap.ts';
import { icon, type IconName } from '../../lib/icons.ts';
import type { CompileDiffV1 } from '../../lib/rebrand/compile-diff.ts';
import { designRouteFor } from '../../lib/rebrand/design-open.ts';
import { layoutName } from '../../lib/slide-structures-ui.ts';
import { bindOp, type RbCtx } from './context.ts';
import { framesForSlide, objectSnippet } from './shared.ts';

// ─── view-only state ─────────────────────────────────────────────────────────

type SectionId =
  | 'removed'
  | 'unplaced'
  | 'unresolved'
  | 'counts'
  | 'compiled'
  | 'layouts'
  | 'notes'
  | 'sessions'
  | 'changes'
  | 'versions';

/** One picture the cache draws, and whether a picture inside it is still loading. */
interface Drawn {
  svg: string;
  missing: boolean;
}

interface ReportLocal {
  panel: HTMLElement | null;
  scroll: HTMLElement | null;
  close: HTMLButtonElement | null;
  /** What had focus when the drawer opened, so closing hands it back. */
  opener: HTMLElement | null;
  /** Sections the person folded or unfolded, over each section's own default. */
  open: Map<SectionId, boolean>;
  /** Codes in "In the proposed slides" the person unfolded. */
  codesOpen: Set<string>;
  /** The person showed every removed group, past the first few. */
  allGroups: boolean;
  notes: string[];
  notesVersion: number;
  /** Holds Tab inside the drawer and keeps the page behind it out of reach while it is open. */
  trap: FocusTrap | null;
  /** Mounts and releases the blocks as they come near the scroll window. */
  observer: IntersectionObserver | null;
  /** Picture slots whose drawing still waits on a picture, filled again on the next render. */
  missing: Set<HTMLElement>;
}

const LOCAL = new WeakMap<RbCtx, ReportLocal>();

function localOf(rb: RbCtx): ReportLocal {
  let local = LOCAL.get(rb);
  if (!local) {
    local = {
      panel: null,
      scroll: null,
      close: null,
      opener: null,
      open: new Map(),
      codesOpen: new Set(),
      allGroups: false,
      notes: [],
      notesVersion: 0,
      trap: null,
      observer: null,
      missing: new Set(),
    };
    LOCAL.set(rb, local);
  }
  return local;
}

/** Removed groups shown before the rest fold behind "N more slides", so the sections after stay in view. */
export const REMOVED_GROUPS_SHOWN = 3;

/** How many compiled entries a code lists before it only counts the rest. */
const ENTRIES_PER_CODE = 40;

/** Blocks mounted at once when the drawer opens, before the observer reports. */
export const REPORT_EAGER_BLOCKS = 6;

/** How far outside the scroll window a block stays mounted. */
const REPORT_MARGIN = '400px 0px';

/** Codes the counts carry, so the compiled list does not repeat them. */
const COUNTED_CODES = new Set<string>(['object.retained', 'object.transformed', 'object.removed', 'colour.assigned']);

/**
 * A compiled-report code as one count sentence, in this view's words. The engine's own
 * sentence and each entry's message are written for a log (slot sizes, glyph advances,
 * archetype ids), so the drawer never shows them. Null leaves the code out of the
 * drawer: the counts carry it, or it is about the file, not the slides.
 */
export function compiledSentence(code: ReportCodeV1, n: number): string | null {
  const one = n === 1;
  switch (code) {
    case 'object.unresolved':
      return one ? tRaw('1 object could not be read.') : tRaw('{n} objects could not be read.', { n });
    case 'object.replaced-logo':
      return one ? tRaw('1 mark became the design system mark.') : tRaw('{n} marks became the design system mark.', { n });
    case 'object.placeholder-authored':
      return one ? tRaw('1 labelled stand-in takes the place of an object.') : tRaw('{n} labelled stand-ins take the place of objects.', { n });
    case 'object.surplus-continuation':
      return one ? tRaw('1 object continues on a new slide.') : tRaw('{n} objects continue on a new slide.', { n });
    case 'object.surplus-tray':
      return one ? tRaw('1 object fit no space on its slide and is not placed.') : tRaw('{n} objects fit no space on their slides and are not placed.', { n });
    case 'text.overflow':
      return one ? tRaw('Text is cut off in 1 box.') : tRaw('Text is cut off in {n} boxes.', { n });
    case 'text.font-substituted':
      return one ? tRaw('1 font from the deck is set in another face.') : tRaw('{n} fonts from the deck are set in another face.', { n });
    case 'colour.unresolved':
      return one ? tRaw('1 colour has no match in the design system.') : tRaw('{n} colours have no match in the design system.', { n });
    case 'colour.contrast-below-minimum':
      return one ? tRaw('1 text is hard to read against its background.') : tRaw('{n} texts are hard to read against their backgrounds.', { n });
    case 'layout.overlap-with-furniture':
      return one ? tRaw('1 object overlaps the slide master.') : tRaw('{n} objects overlap the slide master.', { n });
    case 'layout.below-readable-size':
      return one ? tRaw('1 text is smaller than is easy to read.') : tRaw('{n} texts are smaller than is easy to read.', { n });
    case 'source.cap-reached':
      return tRaw('The deck is larger than Lolly reads, so some of it was left out.');
    case 'source.media-skipped':
      return one ? tRaw('1 picture in the deck was not kept.') : tRaw('{n} pictures in the deck were not kept.', { n });
    case 'slide.excluded':
      return one ? tRaw('1 slide is left out.') : tRaw('{n} slides are left out.', { n });
    case 'slide.continuation-added':
      return one
        ? tRaw('1 new slide holds what did not fit, so the slide numbers moved.')
        : tRaw('{n} new slides hold what did not fit, so the slide numbers moved.', { n });
    case 'review.applied-unreviewed':
      return one ? tRaw('1 suggestion was applied without review.') : tRaw('{n} suggestions were applied without review.', { n });
    default:
      return null;
  }
}

// ─── small DOM helpers (this module builds nodes; only a cached drawing is markup) ──

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** A registered glyph as a node: the icon registry's markup read as SVG, so no HTML sink is involved. */
function glyphNode(name: IconName): Node | null {
  const markup = icon(name);
  if (!markup || typeof DOMParser === 'undefined') return null;
  const parsed = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
  if (parsed?.localName !== 'svg') return null;
  return document.importNode(parsed, true);
}

function caretNode(): HTMLElement {
  const caret = node('i', 'lp-caret');
  caret.setAttribute('aria-hidden', 'true');
  return caret;
}

function capitalise(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

// ─── pictures and blocks ─────────────────────────────────────────────────────

/** What each picture slot draws, kept beside the slot so a released slot can draw again. */
const SLOT_DRAW = new WeakMap<HTMLElement, () => Drawn>();

/** What each block's rows are, built when the block mounts. */
const BLOCK_ROWS = new WeakMap<HTMLElement, () => HTMLElement[]>();

/** An empty picture cell the block fills when it mounts. */
function picSlot(className: string, draw: () => Drawn): HTMLElement {
  const slot = node('span', `rb-report-pic ${className}`);
  slot.setAttribute('aria-hidden', 'true');
  slot.dataset.pic = '';
  SLOT_DRAW.set(slot, draw);
  return slot;
}

/** Draw one slot from the shared cache. The string is the frame renderer's own SVG, which escapes every text it writes. */
function fillSlot(rb: RbCtx, slot: HTMLElement): void {
  const draw = SLOT_DRAW.get(slot);
  if (!draw) return;
  const drawn = draw();
  const local = localOf(rb);
  if (drawn.missing) local.missing.add(slot);
  else local.missing.delete(slot);
  slot.innerHTML = drawn.svg;
}

/**
 * A group of rows with pictures. The head (when given) stays mounted; the rows and every
 * picture mount with the block and are released with it. `rows` is the row count, so the
 * empty block keeps the height its rows will take.
 */
function block(head: HTMLElement | null, rowCount: number, rows: () => HTMLElement[], kind: string): HTMLElement {
  const el = node('div', `rb-report-block rb-report-block--${kind}`);
  el.dataset.mount = 'off';
  const list = node('ul', 'rb-report-rows');
  list.setAttribute('role', 'list');
  list.style.setProperty('--rb-report-rows', String(rowCount));
  if (head) el.append(head);
  el.append(list);
  BLOCK_ROWS.set(el, rows);
  return el;
}

function mountBlock(rb: RbCtx, el: HTMLElement): void {
  if (el.dataset.mount === 'on') return;
  const rows = BLOCK_ROWS.get(el);
  const list = el.querySelector<HTMLElement>(':scope > .rb-report-rows');
  if (list && rows) list.replaceChildren(...rows().map((row) => {
    const li = node('li');
    li.append(row);
    return li;
  }));
  for (const slot of el.querySelectorAll<HTMLElement>('[data-pic]')) fillSlot(rb, slot);
  el.dataset.mount = 'on';
  markCurrent(rb, el);
}

/** Give back what a block mounted, unless focus is inside it. */
function releaseBlock(rb: RbCtx, el: HTMLElement): void {
  if (el.dataset.mount !== 'on') return;
  const active = typeof document !== 'undefined' ? document.activeElement : null;
  if (active && el.contains(active)) return;
  const local = localOf(rb);
  el.querySelector<HTMLElement>(':scope > .rb-report-rows')?.replaceChildren();
  for (const slot of el.querySelectorAll<HTMLElement>('[data-pic]')) {
    slot.replaceChildren();
    local.missing.delete(slot);
  }
  el.dataset.mount = 'off';
}

/** Watch every block: the first few mount at once, the rest as they come near the window. */
function observeBlocks(rb: RbCtx): void {
  const local = localOf(rb);
  local.observer?.disconnect();
  local.observer = null;
  const blocks = [...(local.scroll?.querySelectorAll<HTMLElement>('.rb-report-block') ?? [])];
  if (typeof IntersectionObserver !== 'function' || !local.scroll) {
    for (const one of blocks) mountBlock(rb, one);
    return;
  }
  for (const one of blocks.filter((el) => !el.closest('[hidden]')).slice(0, REPORT_EAGER_BLOCKS)) mountBlock(rb, one);
  local.observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target as HTMLElement;
      if (entry.isIntersecting) mountBlock(rb, el);
      else releaseBlock(rb, el);
    }
  }, { root: local.scroll, rootMargin: REPORT_MARGIN });
  for (const one of blocks) local.observer.observe(one);
}

/** Draw again the slots that waited on a picture. */
function refillMissing(rb: RbCtx): void {
  const local = localOf(rb);
  for (const slot of [...local.missing]) {
    if (slot.isConnected) fillSlot(rb, slot);
    else local.missing.delete(slot);
  }
}

/** The selected object's or slide's rows read as current. */
function markCurrent(rb: RbCtx, within: ParentNode): void {
  for (const row of within.querySelectorAll<HTMLElement>('[data-object-id], [data-slide-row]')) {
    const current = row.dataset.objectId !== undefined
      ? row.dataset.objectId === rb.sel.objectId
      : rb.sel.objectId === null && row.dataset.slideRow === rb.sel.slideId;
    if (current) row.setAttribute('aria-current', 'true');
    else row.removeAttribute('aria-current');
  }
}

/** A slide as its proposed frame, else its Original frame, from the comparison's cache. */
function slideDrawing(rb: RbCtx, slideId: string, proposed: boolean): Drawn {
  const empty: Drawn = { svg: '', missing: false };
  const deck: CompiledDeckV1 | null | undefined = proposed ? rb.state.preview?.deck : rb.state.faithful;
  const frame: CompiledFrameV1 | undefined = deck ? framesForSlide(deck.frames, slideId)[0] : undefined;
  if (deck && frame) return rb.compare.draw(deck, frame, 96, proposed);
  if (proposed) return slideDrawing(rb, slideId, false);
  return empty;
}

/** One object's own region from its Original slide, from the comparison's cache. */
function cropDrawing(rb: RbCtx, objectId: string): Drawn {
  return rb.compare.crop(objectId, 4 / 3);
}

// ─── copy ────────────────────────────────────────────────────────────────────

/** Each source object, read once per deck. */
const OBJECTS = new WeakMap<SourceDeckV1, Map<string, SourceObjectV1>>();

function sourceObject(rb: RbCtx, objectId: string | undefined): SourceObjectV1 | undefined {
  const source = rb.state.source;
  if (!source || !objectId) return undefined;
  let objects = OBJECTS.get(source);
  if (!objects) {
    objects = new Map(source.slides.flatMap((slide) => slide.objects.map((object) => [object.id, object] as const)));
    OBJECTS.set(source, objects);
  }
  return objects.get(objectId);
}

function kindOf(rb: RbCtx, objectId: string | undefined): SourceObjectKindV1 | undefined {
  return sourceObject(rb, objectId)?.kind;
}

/** The noun for an object: its class read with its kind, the word the queue uses. */
function nounOf(rb: RbCtx, klass: ObjectClassV1 | undefined, objectId?: string, form: 'one' | 'many' = 'one'): string {
  return rb.queue.noun(klass ?? 'unknown', form, false, kindOf(rb, objectId));
}

/** Plan rows by id, read once per plan. */
const ROWS = new WeakMap<RenovationPlanV1, Map<string, ObjectPlanV1>>();

function planRow(rb: RbCtx, objectId: string): ObjectPlanV1 | undefined {
  const plan = rb.derived?.plan;
  if (!plan) return undefined;
  let rows = ROWS.get(plan);
  if (!rows) {
    rows = new Map(plan.slides.flatMap((slide) => slide.objects.map((row) => [row.id, row] as const)));
    ROWS.set(plan, rows);
  }
  return rows.get(objectId);
}

/** Who a removal came from, including a suggestion a person accepted as proposed. */
type Who = DecisionAuthorV1 | 'accepted';

function whoOf(rb: RbCtx, object: ObjectStateV1): Who {
  const author = object.author ?? 'rule';
  if (author !== 'user') return author;
  const row = planRow(rb, object.id);
  return row && row.decision !== undefined && row.decision === row.proposal ? 'accepted' : 'user';
}

export function whoWords(who: Who): string {
  switch (who) {
    case 'user': return tRaw('by you');
    case 'accepted': return tRaw('proposed by the rule, accepted by you');
    case 'preset': return tRaw('by the preset');
    case 'agent': return tRaw('by an agent');
    default: return tRaw('by suggestion');
  }
}

/** The part of its slide a box is in, by the third its centre falls in. */
function placeWords(box: { x: number; y: number; w: number; h: number }, width: number, height: number): string {
  if (!(width > 0) || !(height > 0)) return '';
  const third = (at: number, of: number): 0 | 1 | 2 => (at < of / 3 ? 0 : at < (of * 2) / 3 ? 1 : 2);
  const names = [
    [tRaw('Top left'), tRaw('Top'), tRaw('Top right')],
    [tRaw('Left'), tRaw('Middle'), tRaw('Right')],
    [tRaw('Bottom left'), tRaw('Bottom'), tRaw('Bottom right')],
  ];
  return names[third(box.y + box.h / 2, height)]?.[third(box.x + box.w / 2, width)] ?? '';
}

const SECTION_TITLE: Record<SectionId, () => string> = {
  removed: () => tRaw('Removed objects'),
  unplaced: () => tRaw('Not placed'),
  unresolved: () => tRaw('Objects not drawn'),
  counts: () => tRaw('Counts'),
  compiled: () => tRaw('In the proposed slides'),
  layouts: () => tRaw('Layouts'),
  notes: () => tRaw('Notes from Open in Design'),
  sessions: () => tRaw('Opened in Design'),
  changes: () => tRaw('Changed since the last opening'),
  versions: () => tRaw('Other versions of this deck'),
};

const SECTION_GLYPH: Record<SectionId, IconName> = {
  removed: 'trash',
  unplaced: 'alert',
  unresolved: 'eyeOff',
  counts: 'hash',
  compiled: 'document',
  layouts: 'grid',
  notes: 'info',
  sessions: 'externalLink',
  changes: 'refresh',
  versions: 'history',
};

// ─── building blocks ─────────────────────────────────────────────────────────

/**
 * One section: a head with the glyph, the name, the count and the caret, folded or open
 * by `openByDefault` until the person turns it.
 */
function section(rb: RbCtx, id: SectionId, children: HTMLElement[], opts: { flag?: string; open: boolean }): HTMLElement {
  const local = localOf(rb);
  const sec = node('section', 'lp-sec rb-report-sec');
  sec.dataset.sec = id;
  if (children.length === 0) {
    // Nothing under it: the head with its count, and no fold that would open on nothing.
    const still = node('div', 'lp-sec-head rb-report-still');
    const glyph = glyphNode(SECTION_GLYPH[id]);
    if (glyph) still.append(glyph);
    still.append(node('span', 'lp-sec-name', SECTION_TITLE[id]()));
    still.append(opts.flag !== undefined ? node('em', 'rb-report-flag', opts.flag) : node('i'));
    sec.append(still);
    return sec;
  }
  const open = local.open.get(id) ?? opts.open;
  const head = node('button', 'lp-sec-head');
  head.type = 'button';
  head.setAttribute('aria-expanded', String(open));
  const glyph = glyphNode(SECTION_GLYPH[id]);
  if (glyph) head.append(glyph);
  head.append(node('span', 'lp-sec-name', SECTION_TITLE[id]()));
  // The count is a plain number beside the name, as the band head's flag is, so it takes a
  // class of its own rather than the pill `.lp-sec-flag` draws.
  head.append(opts.flag !== undefined ? node('em', 'rb-report-flag', opts.flag) : node('i'));
  head.append(caretNode());
  const body = node('div', 'lp-rows rb-report-body');
  body.id = `rb-report-${id}`;
  head.setAttribute('aria-controls', body.id);
  body.hidden = !open;
  body.append(...children);
  head.addEventListener('click', () => {
    const nowOpen = body.hidden;
    local.open.set(id, nowOpen);
    head.setAttribute('aria-expanded', String(nowOpen));
    body.hidden = !nowOpen;
  });
  sec.append(head, body);
  return sec;
}

/** One count with its words at reading size and its number at the end, tagged for a test. */
function countRow(label: string, value: number, key: string): HTMLElement {
  const row = node('p', 'rb-report-count');
  row.dataset.count = key;
  row.dataset.value = String(value);
  row.append(node('span', 'rb-report-name', label), node('span', 'rb-report-num', String(value)));
  return row;
}

/** A count that reads better as a sentence ("12 slides, all included"). */
function sentenceRow(text: string, value: number, key: string): HTMLElement {
  const row = node('p', 'rb-report-count');
  row.dataset.count = key;
  row.dataset.value = String(value);
  row.append(node('span', 'rb-report-name', text));
  return row;
}

function plainRow(text: string): HTMLElement {
  return node('p', 'rb-report-text', text);
}

/**
 * A row about an object that selects it: its crop, its words, a muted snippet and a
 * muted note (who, or where) when they add something.
 */
function objectRow(
  rb: RbCtx,
  parts: { words: string; snip?: string; note?: string },
  objectId: string | undefined,
  slideId: string | undefined,
): HTMLElement {
  const pick = node('button', 'rb-report-obj');
  pick.type = 'button';
  if (objectId) {
    pick.dataset.objectId = objectId;
    pick.append(picSlot('rb-report-crop', () => cropDrawing(rb, objectId)));
  } else {
    pick.dataset.plain = '';
  }
  const words = node('span', 'rb-report-words', parts.words);
  if (parts.snip) words.append(' ', node('span', 'rb-report-snip', parts.snip));
  pick.append(words);
  // The space keeps the words apart in the accessible name; a grid drops a blank text run from layout.
  if (parts.note) pick.append(' ', node('span', 'rb-report-note', parts.note));
  if (objectId || slideId) pick.addEventListener('click', () => selectFromReport(rb, objectId, slideId));
  else pick.disabled = true;
  return pick;
}

// ─── the sections ────────────────────────────────────────────────────────────

/** Objects on included slides, sorted by slide number then id. */
function objectsBySlide(rb: RbCtx, keep: (object: ObjectStateV1) => boolean): ObjectStateV1[] {
  const derived = rb.derived;
  if (!derived) return [];
  const numberOf = new Map(derived.slides.map((slide) => [slide.id, slide.number]));
  const included = new Map(derived.slides.map((slide) => [slide.id, slide.include]));
  const out = [...derived.objects.values()].filter((object) => included.get(object.slideId) !== false && keep(object));
  return out.sort((a, b) =>
    (numberOf.get(a.slideId) ?? 0) - (numberOf.get(b.slideId) ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** One slide's removed objects, with the author most of them share. */
export interface RemovedGroup {
  slideId: string;
  slide: number;
  objects: ObjectStateV1[];
  who: Who;
}

/** The removed objects grouped by slide, in slide order. */
export function removedGroups(rb: RbCtx): RemovedGroup[] {
  const numberOf = new Map((rb.derived?.slides ?? []).map((slide) => [slide.id, slide.number]));
  const groups = new Map<string, RemovedGroup>();
  for (const object of objectsBySlide(rb, (one) => one.action === 'remove')) {
    let group = groups.get(object.slideId);
    if (!group) {
      group = { slideId: object.slideId, slide: numberOf.get(object.slideId) ?? 0, objects: [], who: 'rule' };
      groups.set(object.slideId, group);
    }
    group.objects.push(object);
  }
  for (const group of groups.values()) {
    const tally = new Map<Who, number>();
    for (const object of group.objects) {
      const who = whoOf(rb, object);
      tally.set(who, (tally.get(who) ?? 0) + 1);
    }
    group.who = [...tally].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'rule';
  }
  return [...groups.values()];
}

/** "Slide 5: 6 objects removed, by suggestion". */
export function groupSentence(group: Pick<RemovedGroup, 'slide' | 'objects' | 'who'>): string {
  const n = group.objects.length;
  const who = whoWords(group.who);
  return n === 1
    ? tRaw('Slide {slide}: 1 object removed, {who}', { slide: group.slide, who })
    : tRaw('Slide {slide}: {n} objects removed, {who}', { slide: group.slide, n, who });
}

/**
 * A group head's first line, without its author (the second line): "Slide 5: 6 objects
 * removed". `nouns` is the word for what was removed when the group folds to one row of one noun
 * ("Slide 1: 5 shapes removed"), so the row under it need not say the count again.
 */
export function groupLine(group: Pick<RemovedGroup, 'slide' | 'objects'>, nouns?: string): string {
  const n = group.objects.length;
  if (nouns) return tRaw('Slide {slide}: {n} {nouns} removed', { slide: group.slide, n, nouns });
  return n === 1
    ? tRaw('Slide {slide}: 1 object removed', { slide: group.slide })
    : tRaw('Slide {slide}: {n} objects removed', { slide: group.slide, n });
}

/**
 * One group's rows: objects of one noun with no words of their own and one author fold
 * into one row ("5 bars"); an object with words keeps its own row ("Label M"). The
 * author shows on a row only when it differs from the group's.
 */
function removedRows(rb: RbCtx, group: RemovedGroup): Array<{ first: ObjectStateV1; count: number; snip: string; who: Who }> {
  const rows = new Map<string, { first: ObjectStateV1; count: number; snip: string; who: Who }>();
  for (const object of group.objects) {
    const snip = objectSnippet(sourceObject(rb, object.id), 40);
    const who = whoOf(rb, object);
    const key = snip ? `id|${object.id}` : `${nounOf(rb, object.class, object.id)}|${who}`;
    const row = rows.get(key);
    if (row) row.count += 1;
    else rows.set(key, { first: object, count: 1, snip, who });
  }
  return [...rows.values()];
}

function removedSection(rb: RbCtx): HTMLElement {
  const local = localOf(rb);
  const groups = removedGroups(rb);
  const total = groups.reduce((n, group) => n + group.objects.length, 0);
  const children: HTMLElement[] = [];
  const shown = local.allGroups ? groups.length : REMOVED_GROUPS_SHOWN;
  for (const [index, group] of groups.entries()) {
    const rows = removedRows(rb, group);
    // One row of one noun: the head says the noun and the count, and the row only the noun.
    const only = rows.length === 1 && rows[0] && rows[0].count > 1 ? rows[0] : null;
    const nouns = only ? nounOf(rb, only.first.class, only.first.id, 'many') : undefined;
    const head = node('button', 'rb-report-group');
    head.type = 'button';
    head.dataset.slideRow = group.slideId;
    head.dataset.group = String(group.slide);
    head.append(picSlot('rb-report-thumb', () => slideDrawing(rb, group.slideId, true)));
    const words = node('span', 'rb-report-group-text');
    // The space keeps the two lines apart in the button's name.
    words.append(node('span', 'rb-report-group-line', groupLine(group, nouns)), ' ', node('span', 'rb-report-group-who', capitalise(whoWords(group.who))));
    head.append(words);
    head.addEventListener('click', () => selectFromReport(rb, undefined, group.slideId));
    const built = block(head, rows.length, () => rows.map(({ first, count, snip, who }) => objectRow(rb, {
      words: only && nouns
        ? capitalise(nouns)
        : count > 1
          ? tRaw('{count} {nouns}', { count, nouns: nounOf(rb, first.class, first.id, 'many') })
          : capitalise(nounOf(rb, first.class, first.id)),
      snip,
      note: who === group.who ? undefined : whoWords(who),
    }, first.id, first.slideId)), 'group');
    built.hidden = index >= shown;
    children.push(built);
  }
  const hidden = groups.length - shown;
  if (hidden > 0) {
    // Past the first few slides the rest fold behind one row, so Not placed, Counts and
    // the sections after them stay in view.
    const more = node('button', 'rb-report-more');
    more.append(node('span', 'rb-report-more-text', hidden === 1 ? tRaw('1 more slide') : tRaw('{n} more slides', { n: hidden })), caretNode());
    more.type = 'button';
    more.dataset.more = '';
    more.setAttribute('aria-expanded', 'false');
    more.addEventListener('click', () => {
      local.allGroups = true;
      for (const one of children) one.hidden = false;
      more.remove();
      observeBlocks(rb);
      children[shown]?.querySelector<HTMLElement>('.rb-report-group')?.focus();
    });
    children.push(more);
  }
  if (!groups.length) children.push(plainRow(tRaw('Nothing is removed.')));
  return section(rb, 'removed', children, { flag: String(total), open: total > 0 });
}

function unplacedSection(rb: RbCtx): HTMLElement | null {
  const derived = rb.derived;
  const tray = rb.state.preview?.deck.tray ?? [];
  if (!derived || tray.length === 0) return null;
  const numberOf = new Map(derived.slides.map((slide) => [slide.id, slide.number]));
  const rows = (): HTMLElement[] => tray.map((item) => {
    const object = derived.objects.get(item.sourceObjectId);
    const source = sourceObject(rb, item.sourceObjectId);
    const slide = object ? numberOf.get(object.slideId) : undefined;
    const noun = capitalise(nounOf(rb, object?.class, item.sourceObjectId));
    const snip = objectSnippet(source, 40);
    const sourceSlide = rb.state.source?.slides.find((one) => one.id === object?.slideId);
    const place = !snip && source && sourceSlide ? placeWords(source.box, sourceSlide.width, sourceSlide.height) : '';
    return objectRow(rb, {
      words: place ? tRaw('{noun}, {place}', { noun, place: place.toLocaleLowerCase() }) : noun,
      snip,
      note: slide === undefined ? undefined : tRaw('slide {n}', { n: slide }),
    }, item.sourceObjectId, object?.slideId);
  });
  const help = node('p', 'lp-help rb-report-help', tRaw('Goes to the Not placed artboard in Design; Remove takes it out of the deck.'));
  return section(rb, 'unplaced', [block(null, tray.length, rows, 'list'), help], { flag: String(tray.length), open: true });
}

function unresolvedSection(rb: RbCtx): HTMLElement {
  const derived = rb.derived;
  const numberOf = new Map((derived?.slides ?? []).map((slide) => [slide.id, slide.number]));
  const unresolved = objectsBySlide(rb, (object) => object.action !== 'remove' && object.fidelity === 'unavailable');
  const children: HTMLElement[] = unresolved.length
    ? [block(null, unresolved.length, () => unresolved.map((object) => objectRow(rb, {
      words: capitalise(nounOf(rb, object.class, object.id)),
      snip: objectSnippet(sourceObject(rb, object.id), 40),
      note: tRaw('slide {n}', { n: numberOf.get(object.slideId) ?? 0 }),
    }, object.id, object.slideId)), 'list')]
    : [];
  return section(rb, 'unresolved', children, { flag: String(unresolved.length), open: unresolved.length > 0 });
}

/** The accounting, folded: sixteen counts less the ones the sections above already give. */
function countsSection(rb: RbCtx): HTMLElement | null {
  const derived = rb.derived;
  if (!derived) return null;
  const { summary } = derived;
  const rows: HTMLElement[] = [];
  const excluded = summary.slides.total - summary.slides.included;
  if (excluded === 0) {
    const total = summary.slides.total;
    rows.push(sentenceRow(total === 1 ? tRaw('1 slide, included') : tRaw('{n} slides, all included', { n: total }), total, 'slides.total'));
  } else {
    rows.push(countRow(tRaw('Slides included'), summary.slides.included, 'slides.included'));
    rows.push(countRow(tRaw('Slides left out'), excluded, 'slides.excluded'));
  }
  if (summary.flattened > 0) rows.push(countRow(tRaw('Slides kept as a picture'), summary.flattened, 'slides.flattened'));
  const deck = rb.state.preview?.deck;
  const added = deck ? deck.frames.filter((frame) => frame.continuation === true).length : 0;
  if (added > 0) rows.push(countRow(tRaw('New slides for what did not fit'), added, 'slides.continuation'));
  rows.push(countRow(tRaw('Objects kept'), summary.objects.keep, 'objects.keep'));
  rows.push(countRow(tRaw('Objects replaced'), summary.objects.replace, 'objects.replace'));
  // The objects the compile placed nowhere need attention too: the queue lists them
  // under that heading, so the count here takes them in, each object once.
  const trayIds = (deck?.tray ?? []).map((item) => item.sourceObjectId);
  const unplacedExtra = trayIds.filter((id) => derived.objects.get(id)?.review !== 'needs-attention').length;
  rows.push(countRow(tRaw('Objects needing attention'), summary.review.attention + unplacedExtra, 'review.attention'));
  rows.push(countRow(tRaw('Objects not reviewed'), summary.review.unreviewed, 'review.unreviewed'));
  rows.push(countRow(tRaw('Objects accepted'), summary.review.accepted, 'review.accepted'));
  const uses = summary.colours.assigned;
  rows.push(sentenceRow(uses === 1 ? tRaw('1 colour use reassigned') : tRaw('{n} colour uses reassigned', { n: uses }), uses, 'colours.assigned'));
  rows.push(countRow(tRaw('Colours that need attention'), summary.colours.unresolved, 'colours.unresolved'));
  if (summary.colours.locked > 0) rows.push(countRow(tRaw('Colours locked'), summary.colours.locked, 'colours.locked'));
  rows.push(countRow(tRaw('Fonts substituted'), summary.fonts.substituted, 'fonts.substituted'));
  return section(rb, 'counts', rows, { open: false });
}

/** Source objects by compiled layer id, read once per deck from its backward lineage. */
const BACKWARD = new WeakMap<object, Map<string, string>>();

/**
 * The source object a compiled entry is about: its own `objectId`, else the first
 * source object its layer came from (an overflow entry gives only the layer).
 */
function entryObject(rb: RbCtx, entry: ReportEntryV1): string | undefined {
  if (entry.objectId) return entry.objectId;
  const deck = rb.state.preview?.deck;
  if (!entry.layerId || !deck) return undefined;
  let map = BACKWARD.get(deck);
  if (!map) {
    map = new Map();
    for (const edge of deck.lineage.backward) {
      const first = edge.sourceObjectIds[0];
      if (first) map.set(edge.layerId, first);
    }
    BACKWARD.set(deck, map);
  }
  return map.get(entry.layerId);
}

/** The noun one compiled entry is about, or null when it is about no object. */
function entryNoun(rb: RbCtx, entry: ReportEntryV1, objectId: string | undefined): string | null {
  // An entry that gives its object but not its class reads the class from the plan.
  const klass = entry.class ?? (objectId ? rb.derived?.objects.get(objectId)?.class : undefined);
  return klass ? capitalise(nounOf(rb, klass, objectId)) : null;
}

/**
 * The preview compile's `review.applied-unreviewed` describes the preview, not a
 * decision, while the project is still in review (plan 275 close-out decision 9), so
 * the drawer leaves it out until the project has been compiled for Design.
 */
function leftOut(rb: RbCtx, code: ReportCodeV1): boolean {
  if (COUNTED_CODES.has(code)) return true;
  if (code !== 'review.applied-unreviewed') return false;
  const stage = rb.state.project?.checkpoint.stage;
  return stage !== 'compile' && stage !== 'done';
}

/** The compiled report's entries by code, each code one count sentence with its objects folded under it. */
function compiledSection(rb: RbCtx): HTMLElement | null {
  const report = rb.state.preview?.deck.report;
  if (!report) return null;
  const local = localOf(rb);
  const numberOf = new Map((rb.derived?.slides ?? []).map((slide) => [slide.id, slide.number]));
  const byCode = new Map<ReportCodeV1, ReportEntryV1[]>();
  for (const entry of report.entries) {
    if (leftOut(rb, entry.code) || compiledSentence(entry.code, 1) === null) continue;
    const list = byCode.get(entry.code) ?? [];
    list.push(entry);
    byCode.set(entry.code, list);
  }
  const children: HTMLElement[] = [];
  let listed = 0;
  for (const [code, entries] of [...byCode].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    listed += entries.length;
    const sentence = compiledSentence(code, entries.length) ?? '';
    // Entries that read the same (the same object on the same slide) share one row with a count.
    const grouped = new Map<string, { objectId: string | undefined; slideId: string | undefined; noun: string; slide: number | undefined; count: number }>();
    for (const entry of entries.slice(0, ENTRIES_PER_CODE)) {
      const objectId = entryObject(rb, entry);
      const slideId = entry.slideId ?? (objectId ? rb.derived?.objects.get(objectId)?.slideId : undefined);
      const slide = slideId ? numberOf.get(slideId) : undefined;
      const noun = entryNoun(rb, entry, objectId);
      if (!noun && slide === undefined) continue;
      const key = `${objectId ?? ''}|${slideId ?? ''}|${noun ?? ''}`;
      const found = grouped.get(key);
      if (found) found.count += 1;
      else grouped.set(key, { objectId, slideId, noun: noun ?? tRaw('Slide {n}', { n: slide ?? 0 }), slide, count: 1 });
    }
    const group = node('div', 'rb-report-code-group');
    group.dataset.code = code;
    if (grouped.size === 0) {
      group.append(node('p', 'rb-report-code', sentence));
      children.push(group);
      continue;
    }
    const open = local.codesOpen.has(code);
    const head = node('button', 'rb-report-code');
    head.type = 'button';
    head.setAttribute('aria-expanded', String(open));
    head.append(node('span', 'rb-report-code-text', sentence), caretNode());
    const rows = [...grouped.values()];
    const more = entries.length > ENTRIES_PER_CODE ? entries.length - ENTRIES_PER_CODE : 0;
    const body = block(null, rows.length, () => {
      const out = rows.map((one) => objectRow(rb, {
        words: one.noun,
        note: [
          one.slide !== undefined && one.objectId ? tRaw('slide {n}', { n: one.slide }) : '',
          one.count > 1 ? tRaw('{n} times', { n: one.count }) : '',
        ].filter(Boolean).join(', ') || undefined,
      }, one.objectId, one.slideId));
      if (more) out.push(plainRow(tRaw('{n} more like this.', { n: more })));
      return out;
    }, 'code');
    body.id = `rb-report-code-${code.replace(/[^a-z0-9]+/gi, '-')}`;
    body.hidden = !open;
    head.setAttribute('aria-controls', body.id);
    head.addEventListener('click', () => {
      const nowOpen = body.hidden;
      if (nowOpen) local.codesOpen.add(code);
      else local.codesOpen.delete(code);
      head.setAttribute('aria-expanded', String(nowOpen));
      body.hidden = !nowOpen;
      if (nowOpen && typeof IntersectionObserver !== 'function') mountBlock(rb, body);
    });
    group.append(head, body);
    children.push(group);
  }
  // Nothing beyond the counts is no section: a line saying so would confirm a state that is fine.
  if (!children.length) return null;
  return section(rb, 'compiled', children, { flag: listed ? String(listed) : undefined, open: false });
}

/** The name a slide's layout goes by, as the filmstrip and the chooser say it. */
function layoutWord(rb: RbCtx, slideId: string): string {
  const row = rb.derived?.plan.slides.find((one) => one.id === slideId);
  if (!row) return '';
  if (row.arrangement === 'original') return tRaw('Original arrangement');
  if (row.arrangement === 'picture') return tRaw('Kept as a picture');
  return layoutName(rb.chooser.master(), row.layout);
}

/** The included slides by the layout each one uses, each slide an Original and Proposed pair (plan 275 F15). */
function layoutsSection(rb: RbCtx): HTMLElement | null {
  const derived = rb.derived;
  if (!derived || !rb.state.preview?.deck) return null;
  const byLayout = new Map<string, Array<{ id: string; number: number }>>();
  for (const slide of [...derived.slides].sort((a, b) => a.order - b.order)) {
    if (!slide.include) continue;
    const name = layoutWord(rb, slide.id) || tRaw('Layout');
    const list = byLayout.get(name) ?? [];
    list.push({ id: slide.id, number: slide.number });
    byLayout.set(name, list);
  }
  if (byLayout.size === 0) return null;
  const children: HTMLElement[] = [];
  for (const [name, slides] of [...byLayout].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))) {
    const head = node('p', 'rb-report-sub', slides.length === 1 ? tRaw('{layout}, 1 slide', { layout: name }) : tRaw('{layout}, {n} slides', { layout: name, n: slides.length }));
    children.push(block(head, slides.length, () => slides.map(({ id, number }) => {
      const pick = node('button', 'rb-report-pair');
      pick.type = 'button';
      pick.dataset.slideRow = id;
      pick.append(
        picSlot('rb-report-pair-pic', () => slideDrawing(rb, id, false)),
        glyphNode('arrowRight') ?? node('i'),
        picSlot('rb-report-pair-pic', () => slideDrawing(rb, id, true)),
        node('span', 'rb-report-words', tRaw('Slide {n}', { n: number })),
      );
      pick.setAttribute('aria-label', tRaw('Slide {n}, before and after', { n: number }));
      pick.addEventListener('click', () => selectFromReport(rb, undefined, id));
      return pick;
    }), 'pairs'));
  }
  return section(rb, 'layouts', children, { flag: String(byLayout.size), open: false });
}

/**
 * A row that leaves the view when pressed (a Design document, another project): the
 * panel's door, with the chevron that says it goes somewhere, so it never reads like
 * a row that only selects an object here.
 */
function actionRow(text: string, act: () => void, data: Record<string, string> = {}): HTMLElement {
  const pick = node('button', 'lp-door rb-report-door');
  pick.append(node('span', 'rb-report-door-text', text));
  const go = glyphNode('chevronRight');
  if (go) pick.append(go);
  pick.type = 'button';
  for (const [key, value] of Object.entries(data)) pick.dataset[key] = value;
  pick.addEventListener('click', act);
  return pick;
}

function navigate(url: string): void {
  void import('../../nav.ts').then(({ navigateTo }) => navigateTo(url));
}

/** Every Design document this project opened, newest first; each one opens it. */
function sessionsSection(rb: RbCtx): HTMLElement | null {
  const ids = rb.state.project?.designSessionIds ?? [];
  if (ids.length === 0) return null;
  const rows = ids.map((id, i) => ({ id, n: i + 1 })).reverse().map(({ id, n }, i) => actionRow(
    i === 0 ? tRaw('Revision {n}, the latest', { n }) : tRaw('Revision {n}', { n }),
    () => navigate(designRouteFor(id)),
    { session: id },
  ));
  return section(rb, 'sessions', rows, { flag: String(ids.length), open: false });
}

/** The lines that say what one compile changed against the one before it. */
export function changeLines(diff: CompileDiffV1): string[] {
  const lines: string[] = [];
  const count = (n: number, one: string, many: string): void => {
    if (n > 0) lines.push(n === 1 ? one : many);
  };
  // A slide is included or left out; an object is kept, replaced or removed.
  count(diff.framesAdded.length, tRaw('1 slide added'), tRaw('{n} slides added', { n: diff.framesAdded.length }));
  count(diff.framesRemoved.length, tRaw('1 slide left out'), tRaw('{n} slides left out', { n: diff.framesRemoved.length }));
  count(diff.framesMoved?.length ?? 0, tRaw('1 slide moved'), tRaw('{n} slides moved', { n: diff.framesMoved?.length ?? 0 }));
  count(diff.objectsChanged.length, tRaw('1 object changed'), tRaw('{n} objects changed', { n: diff.objectsChanged.length }));
  count(diff.objectsAdded.length, tRaw('1 object added'), tRaw('{n} objects added', { n: diff.objectsAdded.length }));
  count(diff.objectsRemoved.length, tRaw('1 object removed'), tRaw('{n} objects removed', { n: diff.objectsRemoved.length }));
  const added = diff.coloursAdded.length;
  const removed = diff.coloursRemoved.length;
  if (added && removed) lines.push(tRaw('Colours: {added} new, {removed} no longer used', { added, removed }));
  else if (added) lines.push(tRaw('Colours: {added} new', { added }));
  else if (removed) lines.push(tRaw('Colours: {removed} no longer used', { removed }));
  if (diff.fontsAdded.length || diff.fontsRemoved.length) {
    // Both sides tagged, as the colours line is, so a new face never reads as dropped.
    const names = [
      ...diff.fontsAdded.map((face) => tRaw('{face} new', { face })),
      ...diff.fontsRemoved.map((face) => tRaw('{face} no longer used', { face })),
    ].join(', ');
    lines.push(tRaw('Fonts: {names}', { names }));
  }
  return lines;
}

/** What the last Open in Design changed, once there were two. */
function changesSection(rb: RbCtx): HTMLElement | null {
  const diff = rb.state.compileDiff;
  if (!diff) return null;
  const derived = rb.derived;
  const lines = changeLines(diff);
  const children: HTMLElement[] = [plainRow(tRaw('The new Design document sits beside the last one, which is not changed.'))];
  if (lines.length === 0) children.push(plainRow(tRaw('The slides are the same as the last time they opened.')));
  for (const line of lines) children.push(plainRow(line));
  const changed = diff.objectsChanged.slice(0, ENTRIES_PER_CODE)
    .map((id) => derived?.objects.get(id))
    .filter((object): object is ObjectStateV1 => Boolean(object));
  if (changed.length) {
    children.push(block(null, changed.length, () => changed.map((object) => objectRow(rb, {
      words: capitalise(nounOf(rb, object.class, object.id)),
      note: tRaw('slide {n}', { n: derived?.slides.find((one) => one.id === object.slideId)?.number ?? 0 }),
    }, object.id, object.slideId)), 'list'));
  }
  return section(rb, 'changes', children, { open: false });
}

/** The other versions of this deck on the device; each one opens its own project. */
function versionsSection(rb: RbCtx): HTMLElement | null {
  const versions = rb.state.versions ?? [];
  if (versions.length === 0) return null;
  const rows = versions.map((version) => actionRow(
    version.sourceName ? tRaw('{name}, from {file}', { name: version.name, file: version.sourceName }) : version.name,
    () => {
      closeReport(rb);
      void rb.controller.open(version.id);
    },
    { projectId: version.id },
  ));
  return section(rb, 'versions', rows, { flag: String(versions.length), open: false });
}

function notesSection(rb: RbCtx): HTMLElement | null {
  const { notes } = localOf(rb);
  if (!notes.length) return null;
  return section(rb, 'notes', notes.map((note) => plainRow(note)), { flag: String(notes.length), open: true });
}

// ─── work ────────────────────────────────────────────────────────────────────

function selectFromReport(rb: RbCtx, objectId: string | undefined, slideId: string | undefined): void {
  const derived = rb.derived;
  const object = objectId ? derived?.objects.get(objectId) : undefined;
  const slide = object?.slideId ?? slideId ?? null;
  rb.select({
    objectId: object ? object.id : null,
    slideId: slide,
    itemId: object ? derived?.itemOfObject.get(object.id) ?? null : null,
  });
  // A sheet covers the comparison on a narrow screen, so the selection is shown by closing it.
  if (rb.narrow) closeReport(rb);
}

/** Keep what Open in Design warned about, for the drawer to list. */
export function setNotes(rb: RbCtx, warnings: string[]): void {
  const local = localOf(rb);
  local.notes = [...warnings];
  local.notesVersion += 1;
  if (rb.reportOpen) renderReport(rb);
}

/** Where focus goes when the drawer closes and what opened it is gone: the project actions button. */
function focusFallback(rb: RbCtx): HTMLElement | null {
  const reachable = (el: HTMLElement | null | undefined): el is HTMLElement => Boolean(el?.isConnected && !el.closest('[hidden]'));
  const more = rb.els.top.querySelector<HTMLElement>('.rb-top-more');
  if (reachable(more)) return more;
  const report = rb.els.foot.querySelector<HTMLElement>('.rb-foot-report');
  return reachable(report) ? report : null;
}

// ─── wiring and drawing ──────────────────────────────────────────────────────

export function wireReport(rb: RbCtx): void {
  const local = localOf(rb);
  const drawer = rb.els.report;
  drawer.replaceChildren();
  // The drawer element is the dimmer over the page; the sheet inside it is the panel.
  const sheet = node('div', 'rb-report-sheet');
  const panel = node('div', 'lp rb-report-panel');
  const head = node('div', 'lp-head');
  const title = node('h2', 'lp-head-name', tRaw('Report'));
  title.id = 'rb-report-title';
  const close = node('button', 'lp-iconbtn rb-report-close');
  close.type = 'button';
  close.setAttribute('aria-label', tRaw('Close the report'));
  close.title = tRaw('Close the report');
  const closeGlyph = glyphNode('close');
  if (closeGlyph) close.append(closeGlyph);
  head.append(title, close);
  const scroll = node('div', 'lp-scroll rb-report-scroll');
  scroll.tabIndex = -1;
  panel.append(head, scroll);
  sheet.append(panel);
  drawer.append(sheet);
  drawer.setAttribute('aria-labelledby', title.id);
  local.panel = panel;
  local.scroll = scroll;
  local.close = close;

  close.addEventListener('click', () => closeReport(rb));
  // A press on the dimmer, outside the sheet, closes the drawer.
  drawer.addEventListener('click', (event) => {
    if (event.target === drawer) closeReport(rb);
  });
  rb.disposers.push(() => {
    const mine = localOf(rb);
    mine.trap?.release();
    mine.trap = null;
    mine.observer?.disconnect();
    mine.observer = null;
  });
  drawer.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !rb.reportOpen) return;
    event.preventDefault();
    event.stopPropagation();
    closeReport(rb);
  });
}

export function renderReport(rb: RbCtx): void {
  const local = localOf(rb);
  if (!local.scroll) return;
  if (!rb.reportOpen) {
    if (rb.memo.report !== 'closed') {
      local.observer?.disconnect();
      local.observer = null;
      local.missing.clear();
      local.scroll.replaceChildren();
    }
    rb.memo.report = 'closed';
    return;
  }
  const derived = rb.derived;
  const deck = rb.state.preview?.deck;
  const key = JSON.stringify([
    derived?.plan.revision ?? null,
    derived?.summary ?? null,
    rb.state.preview?.planRevision ?? null,
    deck?.tray.length ?? null,
    deck?.frames.length ?? null,
    rb.state.faithful?.frames.length ?? null,
    rb.state.project?.checkpoint.stage ?? null,
    local.notesVersion,
    rb.narrow,
    rb.state.project?.designSessionIds ?? [],
    rb.state.compileDiff ?? null,
    (rb.state.versions ?? []).map((version) => version.id),
  ]);
  if (rb.memo.report === key) {
    refillMissing(rb);
    markCurrent(rb, local.scroll);
    return;
  }
  rb.memo.report = key;

  const sections: HTMLElement[] = [];
  if (!derived) {
    sections.push(plainRow(tRaw('The report fills in once the deck is read.')));
  } else {
    sections.push(removedSection(rb));
    const unplaced = unplacedSection(rb);
    if (unplaced) sections.push(unplaced);
    sections.push(unresolvedSection(rb));
    for (const one of [countsSection(rb), compiledSection(rb), layoutsSection(rb)]) if (one) sections.push(one);
  }
  for (const extra of [notesSection(rb), sessionsSection(rb), changesSection(rb), versionsSection(rb)]) if (extra) sections.push(extra);
  local.missing.clear();
  // The slide pictures keep the deck's own shape, so a 4:3 deck is not letterboxed.
  const first = rb.state.source?.slides[0];
  if (first && first.width > 0 && first.height > 0) local.scroll.style.setProperty('--rb-report-ratio', `${first.width} / ${first.height}`);
  local.scroll.replaceChildren(...sections);
  observeBlocks(rb);
  markCurrent(rb, local.scroll);
}

export function openReport(rb: RbCtx): void {
  const local = localOf(rb);
  const active = typeof document !== 'undefined' ? document.activeElement : null;
  local.opener = active instanceof HTMLElement && !rb.els.report.contains(active) ? active : null;
  rb.reportOpen = true;
  // While open the drawer is a modal dialog, so a screen reader's cursor stays in it.
  rb.els.report.setAttribute('role', 'dialog');
  rb.els.report.setAttribute('aria-modal', 'true');
  rb.render();
  local.trap?.release();
  local.trap = trapFocus(rb.els.report, { initialFocus: local.close });
  local.close?.focus();
}

export function closeReport(rb: RbCtx): void {
  const local = localOf(rb);
  if (!rb.reportOpen) return;
  rb.reportOpen = false;
  rb.els.report.removeAttribute('role');
  rb.els.report.removeAttribute('aria-modal');
  local.trap?.release();
  local.trap = null;
  rb.render();
  const opener = local.opener;
  local.opener = null;
  const back = opener?.isConnected && !opener.closest('[hidden]') ? opener : focusFallback(rb);
  back?.focus();
}

export function reportOps(rb: RbCtx) {
  return {
    wire: bindOp(rb, wireReport),
    render: bindOp(rb, renderReport),
    open: bindOp(rb, openReport),
    close: bindOp(rb, closeReport),
    notes: bindOp(rb, setNotes),
  };
}
