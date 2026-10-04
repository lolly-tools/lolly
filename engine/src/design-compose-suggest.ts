// SPDX-License-Identifier: MPL-2.0
/**
 * A first compose spec for a source deck (plan 291 W6, `lolly compose --suggest`,
 * `lolly_compose` in suggest mode): one slide per source slide, each with a master
 * archetype, its slots filled by reference to the inventory (`from` an object id, with
 * `para` where one text frame holds several slots' words), its pictures as `photo:<sha12>`
 * placeholder keys with the asset list that resolves them, its notes and its source
 * slide. The agent edits the spec, then composes it; nothing here is final.
 *
 * The archetype comes from three places, first match wins:
 *
 *   1. Compose-only priors, kept in this module because the matcher's rules are part of
 *      a plan's recorded algorithms (`PLAN_RULES` in rebrand-plan.ts) and these are not:
 *      the first or the last slide, a photograph covering at least `BACKGROUND_SHARE`
 *      of it and a heading on it is a cover or a closing set over the photograph (the
 *      master's cover or closing archetype, the photograph as an `under` row). The
 *      library's own detect data says which slide each one sits on (`position`), what
 *      share a cover picture takes (`pictureShare`) and that a closing may be told by its
 *      words alone (`closingWords`). Mid deck, one short line set large over such a
 *      photograph is a statement over it (the master's statement archetype, the photo
 *      as an `under` row). On a cover or a closing, a heading set at two sizes fills the
 *      title and the subtitle by size, and a short line under the subtitle (a role
 *      under a name) joins the subtitle.
 *   2. The structure matcher (`matchSlideLayout`), when the census is at hand and the read
 *      is clear or likely. Numbered cards whose numbers only count the cards (01, 02, 03
 *      in reading order) stay a row of columns with the numbers left out: the numbers
 *      order nothing, and compose declares each one as decorative numbering.
 *   3. The slide's own text: a heading alone is a statement, a heading over one text is
 *      title and body, an eyebrow over a heading folds into the heading (`from` lists
 *      both objects, joined with `: `), a lattice with a header row and a header column is a table, and loose
 *      groups of text are a content-sized `flow-columns` layout.
 *
 * A heading whose first line is short (at most three words) over one longer line, such
 * as `AI` over the question it introduces, fills the title with `join: ': '`, so the two
 * read as one heading instead of an eyebrow and a title. A first line that cannot stand
 * alone (it ends in `of`, `we`, `the`, or the next line runs on in lower case) is a
 * title wrapped by hand, and stays whole.
 *
 * Every content string of the source gets a slot where the archetype has one. What no
 * slot holds is placed as an `over` text row at its source position, and the reason says
 * so; a table fills the table slot as a `$table` of text rows, because Design has no
 * table primitive. Furniture (page
 * numbers, footers, the source's own logo, background art) is left to the master, and
 * the reason counts what was left; text left that way which is not on every slide (a
 * chart legend) reads as content, so the reason quotes those words. The deck footer is a footer that recurs (on
 * two slides or more, and most of those carrying one); a slide whose own footer differs
 * keeps it as `furniture.footer`.
 *
 * Pure and deterministic: no DOM, no filesystem, no clock. `census` and `source` are the
 * rebrand reader's (`readDeck`); without them the matcher is skipped and the slide's text
 * decides.
 */

import type {
  ArchetypeV1,
  ComposeSlideV1,
  ComposeSlotValueV1,
  ContentInventoryV1,
  DeckCensusV1,
  DesignComposeSpecV1,
  InventoryBoxV1,
  InventoryPictureV1,
  InventorySlideV1,
  InventoryTextRoleV1,
  InventoryTextV1,
  LayoutFeaturesV1,
  ObjectClassV1,
  SlideMasterV1,
  SlideSourceV1,
  SourceDeckV1,
} from '@lolly-tools/core';
import { roleFontSize } from '@lolly-tools/core';

import { escapeMarkup } from './design-text.ts';
import { DESIGN_TEXT_LINE_HEIGHTS } from './design-text-style.ts';
import { masterBoxToPx } from './slide-master.ts';
import { compareCodeUnits } from './rebrand-order.ts';
import { BACKGROUND_SHARE, FURNITURE_CLASSES, TOP_BAND, layoutReadOpts, matchSlideLayout } from './rebrand-structure.ts';
import { slideLayoutRecipe, withSlideLayoutComponents } from './slide-layout-components.ts';
import { archetypeForStructure, findStructure } from './slide-structures.ts';

/** Why one slide got its archetype, in a plain sentence. */
export interface ComposeSuggestReasonV1 {
  /** 1-based source slide. */
  slide: number;
  archetype: string;
  /** The matcher's own rule name (`columns-3`, `stack-4`), when it read the slide. */
  read?: string;
  /** The matcher's band for that read (`clear`, `likely`, `none`). */
  band?: string;
  why: string;
}

/** A picture the spec names by placeholder key, for `lolly package --asset=KEY=PATH`. */
export interface ComposeSuggestAssetV1 {
  /** `photo:<first 12 hex of the sha256>`. */
  key: string;
  sha256: string;
  mime: string;
  /** The inventory media ref. */
  ref: string;
  /** Where `lolly read --media` wrote the bytes, when it did. */
  file?: string;
  width?: number;
  height?: number;
}

export interface ComposeSuggestionV1 {
  spec: DesignComposeSpecV1;
  reasons: ComposeSuggestReasonV1[];
  assets: ComposeSuggestAssetV1[];
}

export interface ComposeSuggestInputV1 {
  /** `DeckCensusV1` from the rebrand reader, or null. */
  census: unknown;
  /** `SourceDeckV1` from the rebrand reader, or null. */
  source: unknown;
  inventory: ContentInventoryV1;
}

// ─── constants ───────────────────────────────────────────────────────────────

/** The source's own logos, which the master's logo replaces. */
const LOGO_CLASSES: ReadonlySet<string> = new Set<string>(['logo-candidate', 'brand-logo']);
/** Classes a suggestion leaves to the master: the matcher's furniture classes plus the source's logos. */
const LEFT_TO_MASTER: ReadonlySet<string> = new Set<string>([...FURNITURE_CLASSES, ...LOGO_CLASSES]);
/** Text roles that are furniture whatever their class. */
const FURNITURE_ROLES: ReadonlySet<InventoryTextRoleV1> = new Set<InventoryTextRoleV1>(['page-number', 'footer']);
/** A piece of text that only counts: "01", "2", "3." or "4)". */
const SEQUENCE = /^\s*0?(\d{1,2})[.)]?\s*$/;
/** Words a closing slide is told by (the library's `closingWords`). */
const CLOSING_WORDS = /\b(?:thank(?:s| you)|questions?|q\s*&\s*a|get in touch|contact us|let'?s talk|merci|danke|gracias|grazie|obrigad[oa])\b/i;
/** Structures whose cells stand in one row of numbered cards, the ones whose counters are left out. */
const CARD_ROW = /^(?:columns|steps|stats|cards|icon-columns)-(\d+)$/;
/** Words an eyebrow may run to. */
const EYEBROW_WORDS = 10;
/** Words the first line of a heading may run to and still be joined to the next line. */
const JOIN_LEAD_WORDS = 3;
/** What joins a heading's short first line to the next (`AI` and `Are we ready?` to `AI: Are we ready?`). */
const HEADING_JOIN = ': ';
/**
 * Words a line cannot end on and stand alone (articles, prepositions, conjunctions,
 * pronouns, linking verbs and question words): a first line ending in one is a title
 * wrapped by hand, not a lead to join.
 */
const RUN_ON_WORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'of', 'to', 'for', 'and', 'or', 'but', 'nor', 'in', 'on', 'at', 'by', 'with', 'from', 'into', 'onto', 'about', 'as', 'than',
  'we', 'i', 'you', 'they', 'he', 'she', 'it', 'our', 'your', 'my', 'their', 'his', 'her', 'its',
  'is', 'are', 'was', 'were', 'be', 'that', 'this', 'these', 'those', 'how', 'why', 'what', 'when', 'where', 'who', 'which',
]);
/** Words of a short line under a closing heading may run to and still tell the closing by their words. */
const CLOSING_LINE_WORDS = 8;
/** Points a lone line over a photograph must be set at, at most `DISPLAY_WORDS` long, to count as its heading. */
const DISPLAY_PT = 28;
const DISPLAY_WORDS = 12;
/** How far above a heading an eyebrow may sit, as a share of the slide height. */
const EYEBROW_GAP = 0.12;
/** Centres closer than this, as a share of the slide, stand in one row or column of a lattice. */
const LATTICE_TOL = 0.04;
/** Default page size of a composed deck (design-compose-v1). */
const PAGE_WIDTH = 1920;
const PAGE_HEIGHT = 1080;

// ─── reading the inventory ───────────────────────────────────────────────────

interface Item {
  t: InventoryTextV1;
  /** Non-empty paragraphs: index into `t.paragraphs` and their plain text. */
  paras: Array<{ k: number; text: string }>;
  /** Largest run size in points, 0 when no run states one. */
  pt: number;
  words: number;
  /** An eyebrow set as its own object over this heading, folded into it (plan 291 M4). */
  eyebrow?: Item;
}

interface Piece {
  from: string;
  /** One paragraph, or several in order (`para: [1, 2]`). */
  para?: number | number[];
  text: string;
  role: InventoryTextRoleV1;
  box: InventoryBoxV1;
  pt: number;
}

interface Pic {
  p: InventoryPictureV1;
  /** Share of the slide the picture covers, clipped to the slide. */
  share: number;
  icon: boolean;
}

const paraText = (para: InventoryTextV1['paragraphs'][number]): string => para.runs.map((r) => r.text).join('').replace(/\s+$/u, '');
const wordCount = (s: string): number => (s.trim() ? s.trim().split(/\s+/u).length : 0);
const cyOf = (b: InventoryBoxV1): number => b.y + b.height / 2;
const cxOf = (b: InventoryBoxV1): number => b.x + b.width / 2;

function itemOf(t: InventoryTextV1): Item {
  const paras = t.paragraphs.map((para, k) => ({ k, text: paraText(para) })).filter((p) => p.text.trim().length > 0);
  const pt = Math.max(0, ...t.paragraphs.flatMap((para) => para.runs.map((r) => r.size ?? 0)));
  return { t, paras, pt, words: wordCount(t.plain) };
}

function clippedShare(b: InventoryBoxV1): number {
  const w = Math.max(0, Math.min(1, b.x + b.width) - Math.max(0, b.x));
  const h = Math.max(0, Math.min(1, b.y + b.height) - Math.max(0, b.y));
  return w * h;
}

const byReading = (a: Item, b: Item): number =>
  ((a.t.readingIndex ?? 1e9) - (b.t.readingIndex ?? 1e9)) || (a.t.box.y - b.t.box.y) || (a.t.box.x - b.t.box.x) || compareCodeUnits(a.t.objectId, b.t.objectId);
const byPosition = (a: Item, b: Item): number =>
  (a.t.box.y - b.t.box.y) || (a.t.box.x - b.t.box.x) || compareCodeUnits(a.t.objectId, b.t.objectId);

interface SlideContent {
  texts: Item[];
  pics: Pic[];
  /** What the suggestion leaves to the master (texts and pictures), counted for the reason. */
  left: number;
  /** The shown texts among them, so the reason can name the ones that read as content. */
  leftTexts: InventoryTextV1[];
  /** What kinds of thing those are, in words for the reason. */
  leftKinds: Set<string>;
}

/** The kind of thing a text left to the master is, for the reason. */
function leftKindOf(t: InventoryTextV1): string {
  if (t.hidden) return 'hidden text';
  if (t.role === 'page-number') return 'page number';
  if (t.role === 'footer') return 'footer';
  if (LOGO_CLASSES.has(t.class)) return 'logo';
  if (t.class === 'recurring-text') return 'recurring text';
  return 'template text';
}

function contentOf(slide: InventorySlideV1): SlideContent {
  let left = 0;
  const leftTexts: InventoryTextV1[] = [];
  const leftKinds = new Set<string>();
  const texts: Item[] = [];
  for (const t of slide.text) {
    if (!t.plain.trim()) continue;
    if (t.hidden || FURNITURE_ROLES.has(t.role) || LEFT_TO_MASTER.has(t.class) || t.role === 'other') {
      left += 1;
      leftKinds.add(leftKindOf(t));
      if (!t.hidden) leftTexts.push(t);
      continue;
    }
    texts.push(itemOf(t));
  }
  const pics: Pic[] = [];
  for (const p of slide.pictures) {
    const decoration = p.class === 'decoration' || p.class === 'template-furniture' || LEFT_TO_MASTER.has(p.class);
    if (p.kind === 'logo' || decoration) {
      left += 1;
      leftKinds.add(p.kind === 'logo' || LOGO_CLASSES.has(p.class) ? 'logo' : 'background art');
      continue;
    }
    pics.push({ p, share: clippedShare(p.box), icon: p.kind === 'icon' });
  }
  texts.sort(byReading);
  return { texts, pics, left, leftTexts, leftKinds };
}

/**
 * The slide's heading: a title, else the largest type in the top band, across half the
 * slide and above every other text (the matcher's own rule), else nothing.
 */
function headingOf(texts: readonly Item[]): Item | undefined {
  const titled = texts.filter((i) => i.t.role === 'title');
  if (titled.length > 0) return titled[0];
  const top = Math.max(0, ...texts.map((i) => i.pt));
  if (top <= 0) return undefined;
  return texts
    .filter((i) => i.pt === top && i.t.box.y <= TOP_BAND && i.t.box.width >= 0.5)
    .filter((i) => texts.every((o) => o === i || o.t.box.y >= i.t.box.y + i.t.box.height - 0.02))
    .sort(byPosition)[0];
}

/** A short line sitting just above the heading and over it: an eyebrow. */
function eyebrowOf(texts: readonly Item[], heading: Item | undefined): Item | undefined {
  if (!heading) return undefined;
  const h = heading.t.box;
  return texts
    .filter((i) => i !== heading && i.paras.length === 1 && i.words <= EYEBROW_WORDS)
    .filter((i) => i.t.role === 'label' || i.t.role === 'caption' || i.t.plain === i.t.plain.toUpperCase())
    .filter((i) => {
      const b = i.t.box;
      const bottom = b.y + b.height;
      const overlap = Math.min(b.x + b.width, h.x + h.width) - Math.max(b.x, h.x);
      return bottom <= h.y + 0.02 && h.y - bottom <= EYEBROW_GAP && overlap > 0;
    })
    .sort(byPosition)
    .at(-1);
}

/** The pieces one item fills: the whole text, or one piece per non-empty paragraph. */
function piecesOf(item: Item, split: boolean): Piece[] {
  const base = { from: item.t.objectId, role: item.t.role, box: item.t.box, pt: item.pt };
  if (!split || item.paras.length <= 1) return [{ ...base, text: item.t.plain }];
  return item.paras.map((p) => ({ ...base, para: p.k, text: p.text }));
}

function sequenceOf(piece: Piece): number | undefined {
  const first = piece.text.split('\n')[0] ?? '';
  const m = SEQUENCE.exec(first);
  return m ? Number(m[1]) : undefined;
}

// ─── the master ──────────────────────────────────────────────────────────────

interface SlotRef {
  key: string;
  role: string;
  kind: string;
  optional: boolean;
  group?: string;
}

/** Slot keys as design-compose-v1 counts them: `role`, then `role#n` across the archetype in declared order. */
function slotRefs(archetype: ArchetypeV1): SlotRef[] {
  const seen = new Map<string, number>();
  return archetype.placeholders.map((ph) => {
    const n = (seen.get(ph.role) ?? 0) + 1;
    seen.set(ph.role, n);
    const ref: SlotRef = { key: n === 1 ? ph.role : `${ph.role}#${n}`, role: ph.role, kind: ph.kind, optional: ph.optional === true };
    if (ph.group !== undefined) ref.group = ph.group;
    return ref;
  });
}

/** Cell groups of a repeat archetype in order (`c1`, `c2`, ...), each with its slots. */
function cellRefs(archetype: ArchetypeV1): SlotRef[][] {
  if (!archetype.repeat) return [];
  const groups = new Map<string, SlotRef[]>();
  for (const ref of slotRefs(archetype)) {
    if (!ref.group || !/^c\d+$/.test(ref.group)) continue;
    const list = groups.get(ref.group) ?? [];
    list.push(ref);
    groups.set(ref.group, list);
  }
  return [...groups.entries()].sort((a, b) => Number(a[0].slice(1)) - Number(b[0].slice(1))).map(([, refs]) => refs);
}

interface MasterView {
  master: SlideMasterV1;
  find(id: string): ArchetypeV1 | undefined;
  /** The archetype carrying a library structure, light before dark. */
  forStructure(structure: string): ArchetypeV1 | undefined;
}

function masterView(master: SlideMasterV1): MasterView {
  const flows = new Map<string, ArchetypeV1 | undefined>();
  return {
    master,
    find(id) {
      const own = master.archetypes.find((a) => a.id === id);
      if (own || !slideLayoutRecipe(id)) return own;
      if (!flows.has(id)) flows.set(id, withSlideLayoutComponents(master, [id]).archetypes.find((a) => a.id === id));
      return flows.get(id);
    },
    forStructure: (structure) => archetypeForStructure(master, structure),
  };
}

// ─── filling slots ───────────────────────────────────────────────────────────

const NON_GENERIC_ROLES: ReadonlySet<string> = new Set(['subtitle', 'caption', 'label', 'quote', 'attribution']);
/** Slot roles from the one kept longest to the one given up first when a slide has fewer strings than slots. */
const KEEP_ORDER: readonly string[] = ['body', 'quote', 'subtitle', 'caption', 'attribution', 'label', 'number', 'title'];

type SlotObject = Exclude<ComposeSlotValueV1, string | null>;

function slotValue(piece: Piece): SlotObject {
  return piece.para === undefined ? { from: piece.from } : { from: piece.from, para: piece.para };
}

/** A heading's worded lines: paragraph breaks and line breaks both end one. */
function headingLines(item: Item): string[] {
  return item.t.paragraphs.flatMap((para) => para.runs.map((r) => r.text).join('').split(/\r\n?|\n/u)).map((l) => l.trim()).filter(Boolean);
}

/**
 * A heading whose first line is short (at most three words) over one longer line, such
 * as `AI` over `Are we ready?`: the two read as one heading, so they are joined with
 * `: ` rather than set as an eyebrow above the title.
 *
 * A line break is also how a speaker balances the wrap of one title, so the join is
 * refused when the first line cannot stand alone: it ends in a word that needs the
 * next one (`Why we`, `A tale of`), or the second line runs on in lower case
 * (`Ship it` over `before the tide turns`).
 */
function joinsLead(item: Item): boolean {
  const lines = headingLines(item);
  if (lines.length !== 2) return false;
  const [lead, rest] = lines as [string, string];
  if (!(wordCount(lead) <= JOIN_LEAD_WORDS && wordCount(rest) > wordCount(lead))) return false;
  const lastWord = (lead.split(/\s+/u).at(-1) ?? '').toLowerCase();
  if (RUN_ON_WORDS.has(lastWord)) return false;
  return !/^\p{Ll}/u.test(rest);
}

/** A heading's slot value: joined when its first line is a short lead (`joinsLead`), else the whole text. */
function headingValue(item: Item): SlotObject {
  // An eyebrow set as its own object folds into the heading (plan 291 M4): both objects, joined.
  if (item.eyebrow) return { from: [item.eyebrow.t.objectId, item.t.objectId], join: HEADING_JOIN };
  return joinsLead(item) ? { from: item.t.objectId, join: HEADING_JOIN } : slotValue(piecesOf(item, false)[0] as Piece);
}

/** A run size this much below the heading's own reads as a second level (title over subtitle). */
const SUBTITLE_SIZE_RATIO = 0.85;

/**
 * A heading object whose paragraphs are set at two sizes (plan 291 M4): the leading
 * paragraphs at the largest size are its title, the smaller ones after them its
 * subtitle (`Are you de-risking your options?` at 40 pt over an offer at 27 pt).
 * Undefined when every paragraph is one size, or a larger one follows a smaller one.
 */
function sizeSplit(item: Item): { title: SlotObject; rest: Piece } | undefined {
  const sized = item.t.paragraphs
    .map((para, k) => ({ k, text: paraText(para).trim(), pt: Math.max(0, ...para.runs.filter((r) => r.text.trim()).map((r) => r.size ?? 0)) }))
    .filter((p) => p.text);
  if (sized.length < 2) return undefined;
  const top = Math.max(...sized.map((p) => p.pt));
  if (!(top > 0)) return undefined;
  const lead = sized.findIndex((p) => p.pt < top * SUBTITLE_SIZE_RATIO);
  if (lead <= 0) return undefined;
  const head = sized.slice(0, lead);
  const tail = sized.slice(lead);
  if (tail.some((p) => p.pt >= top * SUBTITLE_SIZE_RATIO || !(p.pt > 0))) return undefined;
  const pick = (list: typeof sized): number | number[] => (list.length === 1 ? list[0]!.k : list.map((p) => p.k));
  return {
    title: { from: item.t.objectId, para: pick(head) },
    rest: { from: item.t.objectId, para: pick(tail), text: tail.map((p) => p.text).join('\n'), role: 'subtitle', box: item.t.box, pt: Math.max(...tail.map((p) => p.pt)) },
  };
}

/** What runs a subtitle's hand-broken lines into one when its slot cannot hold them. */
const LINE_JOIN = ' ';

/**
 * The lines a text slot holds at the smallest size the master sets for its role: its
 * box height over that size's line box, the floor compose's `fit: shrink` steps down to.
 * Undefined for a slot with no text box.
 */
function slotLineCapacity(master: SlideMasterV1, archetype: ArchetypeV1, key: string): number | undefined {
  const at = slotRefs(archetype).findIndex((r) => r.key === key);
  const ph = archetype.placeholders[at];
  if (ph?.kind !== 'text') return undefined;
  let smallest = Infinity;
  for (const a of master.archetypes) {
    for (const p of a.placeholders) {
      if (p.kind !== 'text' || p.role !== ph.role) continue;
      const size = roleFontSize(master, p.role, p.style);
      if (Number.isFinite(size) && size > 0) smallest = Math.min(smallest, Math.round(size));
    }
  }
  const box = masterBoxToPx(master, ph.box);
  const lineHeight = (DESIGN_TEXT_LINE_HEIGHTS as Record<string, number>)[ph.role] ?? DESIGN_TEXT_LINE_HEIGHTS.body;
  if (!Number.isFinite(smallest) || !(box.h > 0)) return undefined;
  return Math.floor(box.h / (smallest * lineHeight) + 1e-6);
}

/**
 * The smaller paragraphs of a heading set at two sizes (`sizeSplit`), when they fill a
 * slot with more hand-broken lines than it holds at its smallest size (a sentence
 * broken over three lines in a two-line subtitle): their lines are run into one with
 * `join`, so the slot wraps them to its own width instead of clipping the last line.
 */
function joinOverfullRest(split: { rest: Piece } | undefined, archetype: ArchetypeV1, slots: Record<string, ComposeSlotValueV1>, master: SlideMasterV1): void {
  if (!split) return;
  const lines = split.rest.text.split('\n').filter((line) => line.trim()).length;
  if (lines < 2) return;
  const same = JSON.stringify(split.rest.para);
  for (const [key, value] of Object.entries(slots)) {
    if (!value || typeof value !== 'object' || value.from !== split.rest.from || value.join !== undefined || JSON.stringify(value.para) !== same) continue;
    const holds = slotLineCapacity(master, archetype, key);
    if (holds !== undefined && lines > holds) slots[key] = { ...value, join: LINE_JOIN };
  }
}

/**
 * A short line set just under the line that filled a subtitle or caption slot (a
 * speaker's role under their name) joins that slot as a second line (plan 291 M4),
 * instead of sitting loose at its source position. Returns the pieces still loose.
 */
function foldBylines(extra: readonly Piece[], slots: Record<string, ComposeSlotValueV1>, refs: readonly SlotRef[], items: readonly Item[]): Piece[] {
  const boxOf = new Map(items.map((i) => [i.t.objectId, i.t.box]));
  const loose: Piece[] = [];
  for (const piece of extra) {
    const short = piece.para === undefined && wordCount(piece.text) <= CLOSING_LINE_WORDS && !piece.text.includes('\n');
    const slot = short ? refs.find((ref) => {
      if (!['subtitle', 'caption', 'attribution'].includes(ref.role)) return false;
      const value = slots[ref.key];
      if (!value || typeof value !== 'object' || typeof value.from !== 'string' || value.para !== undefined || value.join !== undefined) return false;
      const above = boxOf.get(value.from);
      if (!above) return false;
      const gap = piece.box.y - (above.y + above.height);
      const overlap = Math.min(above.x + above.width, piece.box.x + piece.box.width) - Math.max(above.x, piece.box.x);
      return gap >= -0.02 && gap <= EYEBROW_GAP && overlap > 0;
    }) : undefined;
    if (!slot) {
      loose.push(piece);
      continue;
    }
    const value = slots[slot.key] as SlotObject;
    slots[slot.key] = { ...value, from: [value.from as string, piece.from] };
  }
  return loose;
}

/**
 * Text pieces into text slots. A sequence number takes a `number` slot; a piece whose
 * role matches a slot (a label, a caption, a subtitle) takes that slot; the rest go in
 * order, the optional slots given up first when there are more slots than pieces.
 * Returns the pieces no slot took.
 */
function fillText(pieces: readonly Piece[], slots: readonly SlotRef[], into: Record<string, ComposeSlotValueV1>): Piece[] {
  const free = slots.filter((s) => s.kind !== 'image');
  const take = (slot: SlotRef, piece: Piece): void => {
    into[slot.key] = slotValue(piece);
    free.splice(free.indexOf(slot), 1);
  };
  let rest = [...pieces];
  const number = free.find((s) => s.role === 'number');
  const counted = number ? rest.find((p) => sequenceOf(p) !== undefined) : undefined;
  if (number && counted) {
    take(number, counted);
    rest = rest.filter((p) => p !== counted);
  }
  for (const piece of [...rest]) {
    if (!NON_GENERIC_ROLES.has(piece.role)) continue;
    const slot = free.find((s) => s.role === piece.role);
    if (!slot || rest.length > free.length) continue;
    take(slot, piece);
    rest = rest.filter((p) => p !== piece);
  }
  // More slots than pieces: give up optional slots from the front, then the slots
  // that carry the least content (a label before a caption before a subtitle before a
  // body), so the words land where the archetype puts its reading text.
  let open = [...free];
  for (const slot of [...open]) if (open.length > rest.length && slot.optional) open = open.filter((s) => s !== slot);
  const giveUp = [...open].sort((a, b) => (KEEP_ORDER.indexOf(b.role) - KEEP_ORDER.indexOf(a.role)) || (open.indexOf(a) - open.indexOf(b)));
  for (const slot of giveUp) if (open.length > rest.length) open = open.filter((s) => s !== slot);
  open.forEach((slot, k) => {
    const piece = rest[k];
    if (piece) into[slot.key] = slotValue(piece);
  });
  return rest.slice(open.length);
}

/** Pictures into image slots, in order. Returns the pictures no slot took. */
function fillImages(pics: readonly Pic[], slots: readonly SlotRef[], into: Record<string, ComposeSlotValueV1>, keyOf: (p: InventoryPictureV1) => string): Pic[] {
  const images = slots.filter((s) => s.kind === 'image');
  images.forEach((slot, k) => {
    const pic = pics[k];
    if (pic) into[slot.key] = keyOf(pic.p);
  });
  return pics.slice(images.length);
}

/** Split an item into its paragraphs when the slots hold every paragraph, else keep it whole. */
function cellPieces(items: readonly Item[], slots: readonly SlotRef[]): Piece[] {
  const textSlots = slots.filter((s) => s.kind !== 'image').length;
  const split = items.reduce((n, i) => n + Math.max(1, i.paras.length), 0) <= textSlots;
  return items.flatMap((i) => piecesOf(i, split));
}

// ─── cells ───────────────────────────────────────────────────────────────────

/** Cut sorted centres into `n` runs at the `n - 1` widest gaps; returns each value's run. */
function cutRuns(values: readonly number[], n: number): (v: number) => number {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  if (n <= 1 || sorted.length <= 1) return () => 0;
  const gaps = sorted.slice(1).map((v, k) => ({ at: (v + (sorted[k] as number)) / 2, size: v - (sorted[k] as number) }));
  const cuts = gaps.sort((a, b) => (b.size - a.size) || (a.at - b.at)).slice(0, n - 1).map((g) => g.at).sort((a, b) => a - b);
  return (v) => cuts.filter((c) => v > c).length;
}

/** One source cell: its texts top to bottom, and its pictures. */
interface Cell {
  items: Item[];
  pics: Pic[];
  /** The text pieces to fill with, when they are not simply the items' (a counter left out). */
  pieces?: Piece[];
}

/**
 * A counted cell without its counter (plan 291 M4): a text that is only the number is
 * left out, and a text whose first paragraph is the number gives its other paragraphs.
 */
function withoutCounter(cell: Cell): Cell {
  const pieces: Piece[] = [];
  cell.items.forEach((item, k) => {
    const first = item.paras[0];
    const counted = k === 0 && first !== undefined && SEQUENCE.test(first.text.split('\n')[0] ?? '') && !first.text.includes('\n');
    if (!counted) {
      pieces.push(...piecesOf(item, false));
      return;
    }
    const base = { from: item.t.objectId, role: item.t.role, box: item.t.box, pt: item.pt };
    for (const p of item.paras.slice(1)) pieces.push({ ...base, para: p.k, text: p.text });
  });
  return { ...cell, pieces };
}

/** An axis cut into `n` runs at the widest gaps, or (with `n` 0) into runs of centres within `LATTICE_TOL`. */
function axisOf(values: readonly number[], n: number): { index: (v: number) => number; count: number } {
  if (n > 0) return { index: cutRuns(values, n), count: n };
  const starts = runs(values);
  return { index: (v) => Math.max(0, starts.filter((st) => v >= st - 1e-9).length - 1), count: Math.max(1, starts.length) };
}

/** Texts and pictures into `across` x `rows` cells by their centres, in reading order (row by row). */
function cellsOf(items: readonly Item[], pics: readonly Pic[], across: number, rows: number): Cell[] {
  const xs = [...items.map((i) => cxOf(i.t.box)), ...pics.map((p) => cxOf(p.p.box))];
  const ys = [...items.map((i) => cyOf(i.t.box)), ...pics.map((p) => cyOf(p.p.box))];
  const col = axisOf(xs, across);
  const row = axisOf(ys, rows);
  const cells: Cell[] = Array.from({ length: col.count * row.count }, () => ({ items: [], pics: [] }));
  for (const item of items) cells[row.index(cyOf(item.t.box)) * col.count + col.index(cxOf(item.t.box))]?.items.push(item);
  for (const pic of pics) cells[row.index(cyOf(pic.p.box)) * col.count + col.index(cxOf(pic.p.box))]?.pics.push(pic);
  for (const cell of cells) cell.items.sort(byPosition);
  return cells.filter((cell) => cell.items.length > 0 || cell.pics.length > 0);
}

/** The source grid a structure read names: columns across, rows down. */
function gridOf(structure: string): { across: number; rows: number } {
  const lattice = /(?:^|-)grid-(\d)x(\d)$/.exec(structure);
  if (lattice) return { across: Number(lattice[1]), rows: Number(lattice[2]) };
  if (/^(?:numbered-rows|agenda-numbered|agenda|stack)/.test(structure)) return { across: 1, rows: 0 };
  const row = /-(\d+)$/.exec(structure);
  if (row) return { across: Number(row[1]), rows: 1 };
  const repeat = findStructure(structure)?.repeat;
  if (repeat) return { across: repeat.across ?? repeat.count, rows: Math.ceil(repeat.count / Math.max(1, repeat.across ?? repeat.count)) };
  return { across: 0, rows: 1 };
}

/** A content-sized layout for `count` groups (the rebrand's own choice of columns), or undefined past its limits. */
function flowFor(count: number, kind: 'cards' | 'columns', oneRow: boolean): string | undefined {
  if (count < 2 || count > 12) return undefined;
  const ideal = oneRow && count <= 4 ? count : Math.min(4, Math.ceil(Math.sqrt(count)));
  return [ideal, ideal - 1, ideal + 1]
    .filter((c) => c >= 1 && (count % c !== 1 || count <= 4))
    .map((c) => `flow-${kind}-${count}-${c}`)
    .find((id) => slideLayoutRecipe(id));
}


/** Every cell opens with the number of its place (1, 2, 3 or 01, 02, 03): the numbers count, they order nothing. */
function countedCells(cells: readonly Cell[]): boolean {
  if (cells.length < 2) return false;
  return cells.every((cell, k) => {
    const first = cell.items[0];
    if (!first) return false;
    const lead = SEQUENCE.exec((first.paras[0]?.text ?? '').split('\n')[0] ?? '');
    return lead !== null && Number(lead[1]) === k + 1;
  });
}

// ─── lattices ────────────────────────────────────────────────────────────────

function runs(values: readonly number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) if (out.length === 0 || v - (out.at(-1) as number) > LATTICE_TOL) out.push(v);
  return out;
}

/** A table's strings, the header row first; `headerColumn` when the first column labels the rows. */
interface Lattice {
  rows: string[][];
  headerColumn: boolean;
}

/**
 * Text boxes set out as a lattice of at least three by three: every place filled, or
 * every place but the top-left corner, which then makes the first column a header
 * column. Undefined when the boxes do not stand in one lattice.
 */
function latticeOf(items: readonly Item[]): Lattice | undefined {
  if (items.length < 8) return undefined;
  const xs = runs(items.map((i) => cxOf(i.t.box)));
  const ys = runs(items.map((i) => cyOf(i.t.box)));
  if (xs.length < 3 || ys.length < 3) return undefined;
  const at = (v: number, axis: number[]): number => axis.findIndex((a, k) => v >= a - LATTICE_TOL / 2 && (k === axis.length - 1 || v < (axis[k + 1] as number) - LATTICE_TOL / 2));
  const grid: Array<Array<Item | undefined>> = ys.map(() => xs.map(() => undefined));
  for (const item of items) {
    const r = at(cyOf(item.t.box), ys);
    const c = at(cxOf(item.t.box), xs);
    const row = grid[r];
    if (!row || c < 0 || row[c]) return undefined;
    row[c] = item;
  }
  const places = xs.length * ys.length;
  const cornerEmpty = grid[0]?.[0] === undefined;
  if (items.length !== places && !(cornerEmpty && items.length === places - 1)) return undefined;
  return {
    rows: grid.map((row) => row.map((cell) => cell?.t.plain.replace(/\s*\n\s*/gu, ' ').trim() ?? '')),
    headerColumn: cornerEmpty,
  };
}

// ─── one slide ───────────────────────────────────────────────────────────────

interface Ctx {
  view: MasterView;
  size: { width: number; height: number };
  sourceWidth: number;
  keyOf: (p: InventoryPictureV1) => string;
  read: (slide: InventorySlideV1, position: number) => { structure?: string; band?: string; read?: string; archetype?: string } | undefined;
  total: number;
}

interface Draft {
  archetype: string;
  slots: Record<string, ComposeSlotValueV1>;
  cells?: Array<Record<string, ComposeSlotValueV1>>;
  under?: unknown[];
  over?: unknown[];
  why: string;
  read?: string;
  band?: string;
  extraText: Piece[];
  extraPics: Pic[];
}

function photoRow(id: string, ctx: Ctx, pic: Pic): Record<string, unknown> {
  return { id, kind: 'image', x: 0, y: 0, w: ctx.size.width, h: ctx.size.height, image: ctx.keyOf(pic.p), fit: 'cover' };
}

/** The master's cover or closing archetype over a full-bleed photograph. */
function overPhoto(kind: 'cover' | 'closing', id: string, lead: Item, texts: readonly Item[], photo: Pic, ctx: Ctx): Draft | undefined {
  const archetype = kind === 'cover' ? ctx.view.forStructure('cover-title') : ctx.view.forStructure('closing-thanks');
  if (!archetype) return undefined;
  const slots: Record<string, ComposeSlotValueV1> = {};
  const refs = slotRefs(archetype).filter((r) => r.kind !== 'image');
  const title = refs.find((r) => r.role === 'title');
  const others = texts.filter((i) => i !== lead);
  const spare = refs.length - (title ? 1 : 0) - others.length;
  // A heading set at two sizes (a question, then the offer) fills the title with its
  // large paragraphs and the subtitle with the smaller ones (plan 291 M4); a heading in
  // two paragraphs of one size fills the title and the next slot when one is spare.
  const joined = joinsLead(lead);
  const split = !joined && spare >= 1 ? sizeSplit(lead) : undefined;
  const leadPieces = split ? [] : piecesOf(lead, !joined && spare >= 1 && lead.paras.length === 2);
  if (title && split) slots[title.key] = split.title;
  else if (title && leadPieces[0]) slots[title.key] = joined ? headingValue(lead) : slotValue(leadPieces[0]);
  const rest = [...(split ? [split.rest] : leadPieces.slice(1)), ...others.flatMap((i) => piecesOf(i, false))];
  const textRefs = refs.filter((r) => r !== title);
  const extraText = foldBylines(fillText(rest, textRefs, slots), slots, textRefs, texts);
  joinOverfullRest(split, archetype, slots, ctx.view.master);
  return {
    archetype: archetype.id,
    slots,
    under: [photoRow(`${id}.photo`, ctx, photo)],
    why: kind === 'cover'
      ? 'The first slide sets its heading over a full-bleed photograph: the cover archetype over the photograph.'
      : 'The last slide sets its heading over a full-bleed photograph: the closing archetype over the photograph.',
    extraText,
    extraPics: [],
  };
}

function inRange(share: number, range: unknown): boolean {
  if (!Array.isArray(range) || range.length !== 2) return true;
  const [lo, hi] = range as [unknown, unknown];
  return typeof lo === 'number' && typeof hi === 'number' ? share >= lo && share <= hi + 1e-9 : true;
}

/** The largest text when it is set at display size and short: a heading by its look, whatever its placeholder role. */
function displayLineOf(texts: readonly Item[]): Item | undefined {
  const top = [...texts].sort((a, b) => (b.pt - a.pt) || byPosition(a, b))[0];
  if (!top || top.t.role === 'caption' || top.t.role === 'label') return undefined;
  if (texts.some((o) => o !== top && o.pt >= top.pt)) return undefined;
  return top.pt >= DISPLAY_PT && top.words <= DISPLAY_WORDS ? top : undefined;
}

/**
 * A closing told by its words: the heading says them (`Thank you`, `Questions?`), or the
 * slide is short, every other text one brief line, and one of those says them. Body copy
 * that only mentions questions is a content slide.
 */
function toldByClosingWords(lead: Item, texts: readonly Item[]): boolean {
  if (CLOSING_WORDS.test(lead.t.plain)) return true;
  const others = texts.filter((i) => i !== lead);
  if (!others.every((i) => i.paras.length <= 1 && i.words <= CLOSING_LINE_WORDS)) return false;
  return others.some((i) => CLOSING_WORDS.test(i.t.plain));
}

function suggestSlide(slide: InventorySlideV1, position: number, id: string, ctx: Ctx): Draft {
  const { texts, pics } = contentOf(slide);
  let heading = headingOf(texts);
  if (!heading && texts.length === 1) heading = texts[0];
  const lead = heading ?? [...texts].sort((a, b) => (b.pt - a.pt) || byPosition(a, b))[0];
  const photos = pics.filter((p) => !p.icon).sort((a, b) => (b.share - a.share) || compareCodeUnits(a.p.objectId, b.p.objectId));
  const photo = photos[0];
  const first = position === 0;
  const last = position === ctx.total - 1 && ctx.total > 1;

  // 1. Cover and closing priors, from the library's detect data.
  const coverDetect = findStructure('cover-full-image')?.detect ?? {};
  const fullBleed = photo !== undefined && photo.share >= BACKGROUND_SHARE && inRange(photo.share, coverDetect.pictureShare);
  const atStart = findStructure('cover-title')?.detect.position === 'first' && first;
  const atEnd = findStructure('closing-thanks')?.detect.position === 'last' && last;
  // The prior needs a heading over the photograph: a title, the largest type in the top
  // band, or a short line set at display size. A lone caption (a photo credit) or a
  // body paragraph is not one, and the slide goes on to the matcher's read.
  const photoHeading = fullBleed && (atStart || atEnd) ? headingOf(texts) ?? displayLineOf(texts) : undefined;
  if (photoHeading && fullBleed && photo && (atStart || atEnd)) {
    const drafted = overPhoto(atStart ? 'cover' : 'closing', id, photoHeading, texts, photo, ctx);
    if (drafted) return { ...drafted, extraPics: pics.filter((p) => p !== photo) };
  }
  if (lead && atEnd && !photo && findStructure('closing-thanks')?.detect.closingWords === true && toldByClosingWords(lead, texts)) {
    const closing = ctx.view.forStructure('closing-thanks');
    if (closing) {
      const slots: Record<string, ComposeSlotValueV1> = {};
      const refs = slotRefs(closing);
      const title = refs.find((r) => r.role === 'title');
      const split = sizeSplit(lead);
      if (title) slots[title.key] = split ? split.title : headingValue(lead);
      const textRefs = refs.filter((r) => r !== title);
      const extraText = foldBylines(fillText([...(split ? [split.rest] : []), ...texts.filter((i) => i !== lead).flatMap((i) => piecesOf(i, false))], textRefs, slots), slots, textRefs, texts);
      joinOverfullRest(split, closing, slots, ctx.view.master);
      return { archetype: closing.id, slots, why: 'The last slide thanks the room or asks for questions: the closing archetype.', extraText, extraPics: pics };
    }
  }

  const body = texts.filter((i) => i !== heading);
  const read = ctx.read(slide, position);

  // A full-bleed photograph under one short line set large, mid-deck (plan 291 M4): a
  // statement over the photograph, the master's main point with the photo under it,
  // where a full-image caption band would set a headline as a caption.
  const statementLine = fullBleed && photo && texts.length === 1 ? displayLineOf(texts) : undefined;
  const statement = statementLine ? ctx.view.forStructure('statement') : undefined;
  if (statementLine && photo && statement) {
    const slots: Record<string, ComposeSlotValueV1> = {};
    titleInto(statement, statementLine, slots);
    return {
      archetype: statement.id,
      slots,
      under: [photoRow(`${id}.photo`, ctx, photo)],
      why: 'A full-bleed photograph under one short line set large: a statement over the photograph (the photo as an under row). Its ink is the master\'s for that slide; over a dark picture set the title\'s fg, or compose it in the dark theme. Over a light picture the dark theme\'s light ink may not read: given the photograph\'s bytes, compose measures it (compose.text.photo-contrast), and a scrim under the title (a box with a linear grad and $tint) fixes it.',
      extraText: [],
      extraPics: pics.filter((p) => p !== photo),
      ...(read?.read ? { read: read.read } : {}),
      ...(read?.band ? { band: read.band } : {}),
    };
  }

  // A table the source holds as a table: the table archetype, set out in its data box.
  const sourceTable = slide.tables.find((t) => t.rows.length > 0);
  if (sourceTable) {
    const tabled = tableDraft(id, { rows: sourceTable.rows, headerColumn: false }, heading, ctx, 'The slide holds a table: the table archetype, its cells set out as text rows in the table slot\'s box.');
    if (tabled) {
      const extraText = body.flatMap((i) => piecesOf(i, false));
      return { ...tabled, extraText, extraPics: [...pics], ...(read?.read ? { read: read.read } : {}), ...(read?.band ? { band: read.band } : {}) };
    }
  }

  // 2. The structure matcher.
  if (read?.archetype && read.structure && (read.band === 'clear' || read.band === 'likely')) {
    const drafted = fromRead(id, { ...read, archetype: read.archetype, structure: read.structure }, heading, body, pics, ctx);
    if (drafted) return { ...drafted, ...(read.read ? { read: read.read } : {}), ...(read.band ? { band: read.band } : {}) };
  }

  // 3. The slide's own text. A full-bleed photograph with no heading over it and at
  // most one text (a credit, a caption) is the photograph with its caption, as the
  // matcher reads it when the census is at hand.
  const tagged = { ...(read?.read ? { read: read.read } : {}), ...(read?.band ? { band: read.band } : {}) };
  if (fullBleed && photo && texts.length <= 1 && !(headingOf(texts) ?? displayLineOf(texts))) {
    const full = fullImageDraft(texts[0], photo, pics, ctx);
    if (full) return { ...full, ...tagged };
  }
  const drafted = fromText(id, heading, body, pics, ctx);
  return { ...drafted, ...tagged };
}

/** The master's full image archetype: the photograph in its image slot, the one text (if any) in its caption. */
function fullImageDraft(caption: Item | undefined, photo: Pic, pics: readonly Pic[], ctx: Ctx): Draft | undefined {
  const archetype = ctx.view.forStructure(caption ? 'full-image-caption' : 'full-image');
  if (!archetype) return undefined;
  const slots: Record<string, ComposeSlotValueV1> = {};
  const refs = slotRefs(archetype);
  const extraPics = fillImages([photo], refs, slots, ctx.keyOf);
  const extraText = caption ? fillText(piecesOf(caption, false), refs, slots) : [];
  return {
    archetype: archetype.id,
    slots,
    why: caption
      ? 'A full-bleed photograph with one line of text and no heading over it: the full image archetype, the text as its caption.'
      : 'A full-bleed photograph with no text: the full image archetype.',
    extraText,
    extraPics: [...extraPics, ...pics.filter((p) => p !== photo)],
  };
}

function titleInto(archetype: ArchetypeV1, heading: Item | undefined, slots: Record<string, ComposeSlotValueV1>): SlotRef | undefined {
  const title = slotRefs(archetype).find((r) => r.role === 'title' && !r.group);
  if (title && heading) slots[title.key] = headingValue(heading);
  return title;
}

/** Fill a repeat archetype's cells from the source cells. */
function fillCells(archetype: ArchetypeV1, cells: readonly Cell[], ctx: Ctx): { cells: Array<Record<string, ComposeSlotValueV1>>; extraText: Piece[]; extraPics: Pic[] } {
  const refs = cellRefs(archetype);
  const out: Array<Record<string, ComposeSlotValueV1>> = [];
  const extraText: Piece[] = [];
  const extraPics: Pic[] = [];
  cells.forEach((cell, k) => {
    const slots = refs[k];
    if (!slots) {
      extraText.push(...cell.items.flatMap((i) => piecesOf(i, false)));
      extraPics.push(...cell.pics);
      return;
    }
    const byRole: Record<string, ComposeSlotValueV1> = {};
    // Cell slots go in keyed by role, so key them by role for the fill.
    const roleRefs = slots.map((ref) => ({ ...ref, key: ref.role }));
    extraText.push(...fillText(cell.pieces ?? cellPieces(cell.items, roleRefs), roleRefs, byRole));
    extraPics.push(...fillImages(cell.pics, roleRefs, byRole, ctx.keyOf));
    out.push(byRole);
  });
  return { cells: out, extraText, extraPics };
}

function fromRead(
  id: string,
  read: { structure: string; archetype: string; band?: string; read?: string },
  heading: Item | undefined,
  body: readonly Item[],
  pics: readonly Pic[],
  ctx: Ctx,
): Draft | undefined {
  const matched = ctx.view.find(read.archetype);
  if (!matched) return undefined;
  if (read.structure === 'table') {
    const lattice = latticeOf(body);
    const tabled = lattice ? tableDraft(id, lattice, heading, ctx, 'The slide reads as a table drawn with text boxes: the table archetype, its cells set out as text rows in the table slot\'s box.') : undefined;
    if (tabled) return { ...tabled, extraPics: [...pics] };
  }
  const slots: Record<string, ComposeSlotValueV1> = {};
  // Pictures join the cells only when the archetype's cells hold pictures (icon columns,
  // image rows); otherwise they would make cells of their own.
  const cellPics = cellRefs(matched).some((cell) => cell.some((ref) => ref.kind === 'image')) ? pics : [];
  const grid = gridOf(read.structure);
  const sourceCells = matched.repeat || CARD_ROW.test(read.structure) ? cellsOf(body, cellPics, grid.across, grid.rows) : [];
  const loosePics = pics.filter((p) => !cellPics.includes(p));

  // Numbered cards whose numbers only count them (plan 291 M4): the numbers are
  // decorative and left out (compose declares them in its edits), and the cards stay a
  // row: the master's columns for up to four, else a content-sized row of columns.
  const cardRow = CARD_ROW.exec(read.structure);
  if (cardRow && countedCells(sourceCells)) {
    const n = sourceCells.length;
    const columns = n <= 4 ? ctx.view.forStructure(`columns-${n}`) : undefined;
    const flow = columns ? undefined : flowFor(n, 'columns', true);
    const row = columns ?? (flow ? ctx.view.find(flow) : undefined);
    if (row && cellRefs(row).length >= n) {
      titleInto(row, heading, slots);
      const filled = fillCells(row, sourceCells.map(withoutCounter), ctx);
      return {
        archetype: row.id,
        slots,
        cells: filled.cells,
        why: `The cards are numbered 1 to ${n} in reading order, so the numbers only count them: they are left out as decorative numbering (compose lists them in its edits, for --edits-out), and the cards stay a row (${row.name}).`,
        extraText: filled.extraText,
        extraPics: [...filled.extraPics, ...loosePics],
      };
    }
  }

  if (matched.repeat) {
    const capacity = cellRefs(matched).length;
    let target = matched;
    if (sourceCells.length > capacity) {
      const flow = flowFor(sourceCells.length, 'columns', grid.rows === 1);
      const found = flow ? ctx.view.find(flow) : undefined;
      if (found) target = found;
    }
    titleInto(target, heading, slots);
    // A grid of cells numbered in reading order (01 to 04 in a 2x2): the numbers only
    // count them, as in a numbered row, so they are left out and each cell's label slot
    // takes the cell's next piece, its heading.
    const counted = /(?:^|-)grid-\d+x\d+$/.test(read.structure) && countedCells(sourceCells);
    const filled = fillCells(target, counted ? sourceCells.map(withoutCounter) : sourceCells, ctx);
    const why = (target === matched
      ? `The slide reads as ${read.structure}: ${matched.name}, one cell per source group.`
      : `The slide reads as ${read.structure}, more cells than ${matched.name} holds: a content-sized layout (${target.name}).`)
      + (counted ? ` The cells are numbered 1 to ${sourceCells.length} in reading order, so the numbers only count them: they are left out as decorative numbering (compose lists them in its edits, for --edits-out).` : '');
    return { archetype: target.id, slots, cells: filled.cells, why, extraText: filled.extraText, extraPics: [...filled.extraPics, ...loosePics] };
  }

  // A whole-slide read: full image with a caption, a chart, a quote, a visual.
  const title = titleInto(matched, heading, slots);
  const refs = slotRefs(matched).filter((r) => r.key !== title?.key);
  const contentPics = pics.filter((p) => !p.icon).sort((a, b) => (b.share - a.share) || compareCodeUnits(a.p.objectId, b.p.objectId));
  const extraPics = [...fillImages(contentPics, refs, slots, ctx.keyOf), ...pics.filter((p) => p.icon)];
  const pieces = body.flatMap((i) => piecesOf(i, false));
  if (!title && heading) pieces.unshift(...piecesOf(heading, false));
  const extraText = fillText(pieces, refs, slots);
  return { archetype: matched.id, slots, why: `The slide reads as ${read.structure}: ${matched.name}.`, extraText, extraPics };
}

function fromText(id: string, heading: Item | undefined, given: readonly Item[], pics: readonly Pic[], ctx: Ctx): Draft {
  let body = given;
  const view = ctx.view;
  const contentPics = pics.filter((p) => !p.icon).sort((a, b) => (b.share - a.share) || compareCodeUnits(a.p.objectId, b.p.objectId));
  const simple = (archetype: ArchetypeV1 | undefined, why: string, items: readonly Item[], images: readonly Pic[] = []): Draft | undefined => {
    if (!archetype) return undefined;
    const slots: Record<string, ComposeSlotValueV1> = {};
    const title = titleInto(archetype, heading, slots);
    const refs = slotRefs(archetype).filter((r) => r.key !== title?.key);
    const extraPics = fillImages(images, refs, slots, ctx.keyOf);
    const extraText = fillText(items.flatMap((i) => piecesOf(i, false)), refs, slots);
    return { archetype: archetype.id, slots, why, extraText, extraPics: [...extraPics, ...pics.filter((p) => !images.includes(p))] };
  };

  // A heading with an eyebrow over it, set as its own object (plan 291 M4): the eyebrow
  // folds into the heading (`from` lists both, joined with ": "), one heading instead of
  // a label over a title, and the slide goes on with the rest of its text.
  const eyebrow = eyebrowOf(body, heading);
  if (eyebrow && heading) {
    heading.eyebrow = eyebrow;
    body = body.filter((i) => i !== eyebrow);
  }

  const statement = view.forStructure('statement');
  if (heading && body.length === 0 && contentPics.length === 0) {
    const d = simple(statement ?? view.forStructure('title-only'), 'A heading alone: a statement.', []);
    if (d) return d;
  }
  if (heading && body.length === 1 && contentPics.length === 0 && (body[0] as Item).words <= 20 && heading.t.paragraphs[0]?.align === 'center') {
    const d = simple(statement, 'A centred heading over one short line: a statement with its subtitle.', body);
    if (d) return d;
  }
  if (contentPics.length === 1 && body.length <= 1 && !(body[0] && body[0].words > 30)) {
    const pic = contentPics[0] as Pic;
    const archetype = body.length === 0 ? view.forStructure('visual') : view.forStructure(cxOf(pic.p.box) < 0.5 ? 'image-and-text' : 'text-and-image');
    const d = simple(archetype, body.length === 0 ? 'A heading over one picture: the visual archetype.' : 'One picture beside text: the split archetype on the picture\'s side.', body, [pic]);
    if (d) return d;
  }

  const lattice = contentPics.length === 0 ? latticeOf(body) : undefined;
  const tabled = lattice ? tableDraft(id, lattice, heading, ctx, 'Text boxes set out as a lattice: a table, its cells set out as text rows in the table slot\'s box.') : undefined;
  if (tabled) return { ...tabled, extraPics: [...pics] };

  const sub = body.find((i) => i.t.role === 'subtitle');
  if (heading && contentPics.length === 0 && body.length === 2 && sub) {
    const d = simple(view.forStructure('title-subtitle-body'), 'A heading, a subtitle and one text: title, subtitle and body.', [sub, ...body.filter((i) => i !== sub)]);
    if (d) return d;
  }
  if (body.length <= 1 && contentPics.length === 0) {
    const d = simple(view.forStructure('title-body'), 'A heading over one text: title and body.', body);
    if (d) return d;
  }

  // Loose groups of text: a content-sized layout, one cell per heading and its text.
  const groups = groupsOf(body);
  const flowId = groups.every((g) => g.reduce((n, i) => n + Math.max(1, i.paras.length), 0) <= 2) ? flowFor(groups.length, 'columns', false) : undefined;
  const flow = flowId ? view.find(flowId) : undefined;
  if (flow && contentPics.length === 0) {
    const slots: Record<string, ComposeSlotValueV1> = {};
    titleInto(flow, heading, slots);
    const filled = fillCells(flow, groups.map((items) => ({ items, pics: [] })), ctx);
    return { archetype: flow.id, slots, cells: filled.cells, why: `Groups of text with no layout the matcher names: a content-sized layout (${flow.name}).`, extraText: filled.extraText, extraPics: [...filled.extraPics, ...pics] };
  }

  const plain = view.forStructure('title-body') ?? view.find('content') ?? (view.master.archetypes[0] as ArchetypeV1);
  return simple(plain, 'More text than any archetype slots: title and body, the rest placed at the source positions.', body) as Draft;
}

/** A lattice as one `$table` macro row in a box (master fractions): a header row, and a header column as the row label. */
function tableRow(id: string, lattice: Lattice, box: { x: number; y: number; w: number; h: number }, ctx: Ctx): Record<string, unknown> {
  const { width: W, height: H } = ctx.size;
  const x = Math.round(box.x * W);
  const y = Math.round(box.y * H);
  const w = Math.round(box.w * W);
  const h = Math.round(box.h * H);
  const lead = lattice.headerColumn ? 1 : 0;
  const cols = Math.max(1, ...lattice.rows.map((row) => row.length - lead));
  const gap = Math.round(0.01 * W);
  const labelW = lead ? Math.round(w * 0.2) : 0;
  const colW = Math.floor((w - labelW) / cols);
  const pitch = Math.max(1, Math.floor(h / Math.max(1, lattice.rows.length)));
  const cellH = Math.max(1, pitch - gap);
  const text = (str: string): string => escapeMarkup(str, 'design');
  const [head = [], ...body] = lattice.rows;
  const table: Record<string, unknown> = {
    x,
    y,
    pitch,
    columns: Array.from({ length: cols }, (_, c) => ({ id: `${id}.table-r{r}-c${c + lead}`, kind: 'text', x: labelW + c * colW, y: 0, w: Math.max(1, colW - gap), h: cellH, $style: 'body' })),
    rows: [
      lead ? { label: null, cells: head.slice(1).map((cell) => ({ text: text(cell), $style: 'label' })) } : head.map((cell) => ({ text: text(cell), $style: 'label' })),
      ...body.map((row) => (lead ? { label: text(row[0] ?? ''), cells: row.slice(1).map((cell) => text(cell)) } : row.map((cell) => text(cell)))),
    ],
  };
  if (lead) table.label = { id: `${id}.table-r{r}-c0`, kind: 'text', x: 0, y: 0, w: Math.max(1, labelW - gap), h: cellH, $style: 'label' };
  return { id: `${id}.table`, $table: table };
}

/** The master's table archetype with the lattice set out in its data slot's box, the data slot itself left out. */
function tableDraft(id: string, lattice: Lattice, heading: Item | undefined, ctx: Ctx, why: string): Draft | undefined {
  const table = ctx.view.forStructure('table');
  if (!table) return undefined;
  const slots: Record<string, ComposeSlotValueV1> = {};
  const title = titleInto(table, heading, slots);
  const data = table.placeholders.find((ph) => ph.role !== 'title' && (ph.kind === 'table' || ph.role === 'data'));
  const dataRef = slotRefs(table).find((r) => r.key !== title?.key && (r.kind === 'table' || r.role === 'data'));
  if (!data || !dataRef) return undefined;
  // Design has no table primitive: the data slot takes the table as a `$table` of text
  // rows set out in its box (plan 291 M4), which copy the words rather than reference them.
  const { width: W, height: H } = ctx.size;
  const macro = tableRow(id, lattice, data.box, ctx).$table as Record<string, unknown>;
  slots[dataRef.key] = { $table: { ...macro, x: Number(macro.x) - Math.round(data.box.x * W), y: Number(macro.y) - Math.round(data.box.y * H) } };
  return { archetype: table.id, slots, why, extraText: [], extraPics: [] };
}

/** A heading with the text right under it is one group; groups read row by row. */
function groupsOf(items: readonly Item[]): Item[][] {
  const sorted = [...items].sort(byPosition);
  const claimed = new Set<Item>();
  const groups: Item[][] = [];
  for (const item of sorted) {
    if (claimed.has(item)) continue;
    claimed.add(item);
    const group = [item];
    if (item.paras.length === 1 && item.t.plain.length <= 90) {
      const next = sorted.find((o) => {
        if (claimed.has(o) || o.t.box.y < item.t.box.y) return false;
        const overlap = Math.min(item.t.box.x + item.t.box.width, o.t.box.x + o.t.box.width) - Math.max(item.t.box.x, o.t.box.x);
        const gap = o.t.box.y - (item.t.box.y + item.t.box.height);
        return overlap >= Math.min(item.t.box.width, o.t.box.width) * 0.7 && gap >= -item.t.box.height * 0.2 && gap <= item.t.box.height * 1.6;
      });
      if (next) {
        claimed.add(next);
        group.push(next);
      }
    }
    groups.push(group);
  }
  const rows: Item[][][] = [];
  for (const group of groups) {
    const top = group[0] as Item;
    const row = rows.find((r) => {
      const lead = r[0]?.[0];
      return lead !== undefined && Math.abs(lead.t.box.y - top.t.box.y) <= Math.min(lead.t.box.height, top.t.box.height) * 0.5;
    });
    if (row) row.push(group);
    else rows.push([group]);
  }
  return rows.flatMap((row) => row.sort((a, b) => (a[0] as Item).t.box.x - (b[0] as Item).t.box.x));
}

/** Source text no slot took, as authoring text rows at the source positions. */
function extraRows(id: string, pieces: readonly Piece[], ctx: Ctx, dark: boolean): Record<string, unknown>[] {
  const scale = (ctx.size.width / Math.max(1, ctx.sourceWidth)) * (96 / 72);
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  for (const piece of pieces) {
    const k = `${piece.from}#${piece.para ?? ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    // The source box, kept on the slide: a box that ran off an edge is cut at that edge.
    const x0 = Math.max(0, Math.min(1, piece.box.x));
    const y0 = Math.max(0, Math.min(1, piece.box.y));
    const x1 = Math.max(x0, Math.min(1, piece.box.x + piece.box.width));
    const y1 = Math.max(y0, Math.min(1, piece.box.y + piece.box.height));
    const row: Record<string, unknown> = {
      id: `${id}.text-${out.length + 1}`,
      kind: 'text',
      x: Math.round(x0 * ctx.size.width),
      y: Math.round(y0 * ctx.size.height),
      w: Math.max(1, Math.round((x1 - x0) * ctx.size.width)),
      h: Math.max(1, Math.round((y1 - y0) * ctx.size.height)),
      text: escapeMarkup(piece.text, 'design'),
      $style: piece.role === 'label' || piece.role === 'caption' || piece.role === 'subtitle' || piece.role === 'title' ? piece.role : 'body',
    };
    if (piece.pt > 0) row.fontSize = Math.max(1, Math.round(piece.pt * scale));
    // On a dark ground (or a photograph under a cover) the theme's text colour would not
    // read; white does, as the master's own slots on that ground are set.
    if (dark) row.fg = '#ffffff';
    out.push(row);
  }
  return out;
}

// ─── the deck ────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readerOf(census: unknown, source: unknown, view: MasterView): Ctx['read'] {
  if (!isRecord(census) || !isRecord(source) || !Array.isArray(source.slides) || !Array.isArray(census.layouts) || !Array.isArray(census.objects)) return () => undefined;
  const deck = source as unknown as SourceDeckV1;
  const cen = census as unknown as DeckCensusV1;
  const byId = new Map(deck.slides.map((s) => [s.id, s]));
  const features = new Map<string, LayoutFeaturesV1>(cen.layouts.map((l) => [l.slideId, l]));
  const classOf = new Map<string, ObjectClassV1>(cen.objects.map((o) => [o.id, o.hypothesis.class]));
  const removed = new Set(cen.objects.filter((o) => FURNITURE_CLASSES.has(o.hypothesis.class)).map((o) => o.id));
  return (slide, position) => {
    const src: SlideSourceV1 | undefined = byId.get(slide.id) ?? deck.slides[position];
    const f = src ? features.get(src.id) : undefined;
    if (!src || !f?.units) return undefined;
    const match = matchSlideLayout(src, f, layoutReadOpts(src, removed, (id) => classOf.get(id), view.master));
    if (!match.match) return undefined;
    const out: { structure?: string; band?: string; read?: string; archetype?: string } = { structure: match.match.structure, band: match.match.band };
    if (match.read) out.read = match.read;
    if (match.archetype) out.archetype = match.archetype;
    return out;
  };
}

function sizeFor(inventory: ContentInventoryV1): { width: number; height: number } | undefined {
  const { width, height } = inventory.source;
  if (!(width > 0 && height > 0)) return undefined;
  const h = Math.round((PAGE_WIDTH * height) / width);
  return Math.abs(h - PAGE_HEIGHT) <= 1 ? undefined : { width: PAGE_WIDTH, height: h };
}

/** A slide's own footer text: its first shown footer, trimmed. */
function slideFooterOf(slide: InventorySlideV1): string | undefined {
  return slide.text.find((t) => t.role === 'footer' && !t.hidden && t.plain.trim())?.plain.trim();
}

/**
 * The deck's footer: the footer text that recurs, on at least two slides and on most of
 * the slides that carry a footer. A footer each slide words differently (a source line
 * per chart) is no deck footer: each slide keeps its own.
 */
function footerOf(inventory: ContentInventoryV1): string | undefined {
  const counts = new Map<string, number>();
  let carrying = 0;
  for (const slide of inventory.slides) {
    const own = slideFooterOf(slide);
    if (own === undefined) continue;
    carrying += 1;
    counts.set(own, (counts.get(own) ?? 0) + 1);
  }
  const [text, count] = [...counts.entries()].sort((a, b) => (b[1] - a[1]) || compareCodeUnits(a[0], b[0]))[0] ?? [];
  return text !== undefined && count !== undefined && count >= 2 && count * 2 > carrying ? text : undefined;
}

/** Quoted strings for a reason, the first three and a count of the rest. */
function quoted(strings: readonly string[]): string {
  const shown = strings.slice(0, 3).map((s) => `"${s.replace(/\s+/gu, ' ').trim()}"`);
  return strings.length > 3 ? `${shown.join(', ')} and ${strings.length - 3} more` : shown.join(', ');
}

/**
 * A first compose spec for the inventory's deck against this master: one slide per
 * source slide, archetypes from the priors, the matcher and the slide's text, slots
 * filled by `from` reference, pictures by placeholder key, notes and source set.
 */
export function suggestComposeSlides(input: ComposeSuggestInputV1, master: SlideMasterV1): ComposeSuggestionV1 {
  const { inventory } = input;
  const view = masterView(master);
  const size = sizeFor(inventory);
  const page = size ?? { width: PAGE_WIDTH, height: PAGE_HEIGHT };
  const assets = new Map<string, ComposeSuggestAssetV1>();
  const mediaOf = new Map(inventory.media.map((m) => [m.sha256, m]));
  const keyOf = (p: InventoryPictureV1): string => {
    const key = `photo:${p.sha256.slice(0, 12)}`;
    if (!assets.has(key)) {
      const media = mediaOf.get(p.sha256);
      const asset: ComposeSuggestAssetV1 = { key, sha256: p.sha256, mime: p.mime, ref: p.ref };
      const file = p.file ?? media?.file;
      if (file) asset.file = file;
      if (p.width !== undefined) asset.width = p.width;
      if (p.height !== undefined) asset.height = p.height;
      assets.set(key, asset);
    }
    return key;
  };
  const ctx: Ctx = {
    view,
    size: page,
    sourceWidth: inventory.source.width > 0 ? inventory.source.width : PAGE_WIDTH,
    keyOf,
    read: readerOf(input.census, input.source, view),
    total: inventory.slides.length,
  };
  const slides: ComposeSlideV1[] = [];
  const reasons: ComposeSuggestReasonV1[] = [];
  const footer = footerOf(inventory);
  // Text the master is left to draw reads as content when it is not on every slide (a
  // chart's legend, a source line): the reason quotes such text, since no other report covers that text.
  const shownOn = new Map<string, number>();
  for (const slide of inventory.slides) {
    for (const plain of new Set(slide.text.filter((t) => !t.hidden && t.plain.trim()).map((t) => t.plain.trim()))) shownOn.set(plain, (shownOn.get(plain) ?? 0) + 1);
  }
  const everySlide = (plain: string): boolean => inventory.slides.length > 1 && (shownOn.get(plain.trim()) ?? 0) >= inventory.slides.length;
  inventory.slides.forEach((slide, position) => {
    const id = `s${String(position + 1).padStart(2, '0')}`;
    const draft = suggestSlide(slide, position, id, ctx);
    const out: ComposeSlideV1 = { archetype: draft.archetype, id, source: slide.number, notes: slide.notes ? true : null };
    if (Object.keys(draft.slots).length > 0) out.slots = draft.slots;
    if (draft.cells && draft.cells.length > 0) out.cells = draft.cells;
    if (draft.under && draft.under.length > 0) out.under = draft.under;
    const ownFooter = slideFooterOf(slide);
    if (ownFooter !== undefined && ownFooter !== footer) out.furniture = { footer: ownFooter };
    const over = extraRows(id, draft.extraText, ctx, view.find(draft.archetype)?.background?.dark === true || (draft.under?.length ?? 0) > 0);
    if (over.length > 0 || draft.over?.length) out.over = [...(draft.over ?? []), ...over];
    slides.push(out);
    const notes: string[] = [draft.why];
    const values = Object.values(draft.slots).filter((v): v is SlotObject => v !== null && typeof v === 'object');
    if (values.some((v) => typeof v.join === 'string' && Array.isArray(v.from))) {
      notes.push(`The eyebrow over the heading is its own object, so both are listed in from and joined with "${HEADING_JOIN}": one heading instead of a label over a title.`);
    } else if (values.some((v) => typeof v.join === 'string' && v.para === undefined)) {
      notes.push(`The heading opens with a short line over a longer one, so the two are joined with "${HEADING_JOIN}" (join) rather than set as an eyebrow.`);
    }
    if (values.some((v) => Array.isArray(v.from) && v.join === undefined)) {
      notes.push('A short line set just under the subtitle or caption (a role under a name) joins that slot as its second line.');
    }
    if (values.some((v) => Array.isArray(v.para))) {
      notes.push('The heading is set at two sizes, so its larger paragraphs are the title and the smaller ones the subtitle (para lists them).');
    }
    if (values.some((v) => v.para !== undefined && typeof v.join === 'string')) {
      notes.push('Those smaller paragraphs are broken by hand over more lines than the slot holds at its smallest size, so their lines are run into one (join) and the slot wraps them.');
    }
    // `over` holds only the loose strings; a table's row is in draft.over, never here.
    const loose = over.length;
    if (loose > 0) notes.push(`${loose === 1 ? 'One string has' : `${loose} strings have`} no slot here and ${loose === 1 ? 'sits' : 'sit'} at the source position as text over the slide.`);
    if (draft.extraPics.length > 0) notes.push(`${draft.extraPics.length === 1 ? 'One picture has' : `${draft.extraPics.length} pictures have`} no slot here and ${draft.extraPics.length === 1 ? 'is' : 'are'} left out.`);
    if (out.furniture?.footer !== undefined) {
      notes.push(footer === undefined
        ? `Its footer ("${ownFooter}") is kept as this slide's footer (furniture.footer), since no footer recurs across the deck.`
        : `Its footer ("${ownFooter}") differs from the deck's ("${footer}"), so it is kept as this slide's footer (furniture.footer).`);
    }
    const { left, leftTexts, leftKinds } = contentOf(slide);
    if (left > 0) {
      const named = leftTexts
        .filter((t) => t.role !== 'page-number' && t.role !== 'footer' && !(LOGO_CLASSES.has(t.class)) && !everySlide(t.plain))
        .map((t) => t.plain);
      notes.push(`${left === 1 ? 'One item is' : `${left} items are`} left to the master (${[...leftKinds].sort(compareCodeUnits).join(', ')}).`);
      if (named.length > 0) {
        notes.push(`${named.length === 1 ? 'One of them reads' : `${named.length} of them read`} as content and ${named.length === 1 ? 'is' : 'are'} not placed: ${quoted(named)}. ${named.length === 1 ? 'Add an over row for that text if the slide needs the words.' : 'Add over rows for that text if the slide needs the words.'}`);
      }
    }
    const reason: ComposeSuggestReasonV1 = { slide: slide.number, archetype: draft.archetype, why: notes.join(' ') };
    if (draft.read) reason.read = draft.read;
    if (draft.band) reason.band = draft.band;
    reasons.push(reason);
  });
  const spec: DesignComposeSpecV1 = { slides };
  if (size) spec.size = size;
  if (footer) spec.footer = footer;
  return { spec, reasons, assets: [...assets.values()].sort((a, b) => compareCodeUnits(a.key, b.key)) };
}
