// SPDX-License-Identifier: MPL-2.0
/**
 * rebrand: the queue (plan 274 section 4, plan 275 close-out section 3.3).
 *
 * Owns `rb.els.queue`. Three lists, switched by `rb.queueTab`: To review (the cards
 * still waiting for a person, `rb.foot.reviewItems`, then the slide-level cards), All
 * slides (`rb.derived.slides` with a small picture each) and Removed (items whose
 * effective action is remove, so an automatic removal stays inspectable). Selecting a
 * card selects its exemplar object and slide (`rb.select`). A background pass that adds
 * cards never reorders the list under the pointer: a new card appears at the end until
 * the person moves focus.
 *
 * A card is one row of 52 px: a picture in a 56 px cell, a title on one line, and a
 * second line only when it adds a fact the title lacks. The picture identifies the
 * card (close-out principle 6): an object under 8% of the slide shows its own crop, a
 * larger one shows its slide with the box outlined, a layout group shows the target
 * layout's wireframe, and a diagram card shows the slide. Glyphs stand in for pictures
 * only when the person asked for calm previews (`data-a11y-previews="hidden"`).
 *
 * The second line is either the one evidence fact or the slide list, never both, and
 * never the count the title already says; the review state shows only where it differs
 * from the group head over it. The codes whose evidence adds nothing on a card are in
 * `QUIET_EVIDENCE`. Every card's `title` carries the full sentences for hover.
 *
 * The tabs are the panel primitive's tab form (`segHtml`, `variant: 'panel'`, `tabs`).
 * The list is one Tab stop with a roving `tabindex` (Up, Down, Home and End move along
 * it), and so is the chip row that stands in for the list on a narrow or medium screen
 * (Left, Right, Home and End). The chip row scrolls itself to the current chip.
 *
 * Suggestions open with the Match card when the controller offers Auto-match: the
 * title with the count and one button. It retires itself, still focusable, once every
 * slide already uses its match.
 *
 * On a picture deck the notice band is the one offer to read the text, so while it can
 * show the queue leaves out the cards that repeat it: the keep card whose evidence is
 * that the picture was not read, and the Full picture layout group, for slides that
 * are slide pictures.
 *
 * The engine writes every sentence as `{ code, params, text }`. `message` turns one
 * into HTML: the English template from `REVIEW_MESSAGES` goes through `t()` with its
 * params (the noun translated from `REVIEW_NOUNS` by its `nounCode`), and a code with
 * no template (a sentence the census wrote) shows its English text. The decision
 * column and the overlay read sentences and nouns through `rb.queue` too.
 */
import '../../styles/parts/panel.css';
import {
  REVIEW_MESSAGES,
  REVIEW_NOUNS,
  type QueueItemV1,
  type ReviewMessageV1,
  type ReviewNounKeyV1,
} from '@lolly/engine';
import type {
  ObjectClassV1,
  ReviewStateV1,
  SlideSourceV1,
  SourceDeckV1,
  SourceObjectKindV1,
  SourceObjectV1,
} from '@lolly-tools/core/rebrand-v1';
import type { SlideMasterV1 } from '@lolly-tools/core';
import { t, tRaw } from '../../i18n.ts';
import { icon, type IconName } from '../../lib/icons.ts';
import { CARRIED_ITEM_ID, slidePictureIdsOf } from '../../lib/rebrand/controller.ts';
import { segHtml } from '../../lib/seg.ts';
import { layoutName, layoutThumb, structureIdOf } from '../../lib/slide-structures-ui.ts';
import { wireTabs } from '../../lib/tabs.ts';
import { escape as htmlEscape } from '../../utils.ts';
import { archetypeThumbSvg } from '../free-canvas/archetype-thumb.ts';
import type { CachedDrawing } from './compare.ts';
import { bindOp, type RbCtx } from './context.ts';
import { framesForSlide, readableTitle, unplacedOf, type RbQueueTab } from './shared.ts';

/** Pictures drawn at once when the browser cannot say which rows are on screen. */
const EAGER_PICTURES = 40;

/** A card's picture cell, width over height: `.rb-q-thumb` in rebrand-queue.css holds the same 16:9. */
const CARD_RATIO = 16 / 9;

/** A chip's round picture is square. */
const CHIP_RATIO = 1;

/** The layout wireframe's width on a card, in CSS px: the picture cell's own. */
const WIREFRAME_WIDTH = 56;

/** On a chip: small enough that the wireframe draws without its plus marks. */
const CHIP_WIREFRAME_WIDTH = 40;

/** The raised crop in the corner of a region's picture, width over height. */
const INSET_RATIO = 4 / 3;

/** An object covering less than this share of its slide is shown by its own crop; a larger one by its slide with the box outlined. */
const SMALL_SHARE = 0.08;

/**
 * Under this share the object's box is not a measure of it (a box of a point, or none):
 * a crop would show a corner of the slide, so the card shows the whole slide instead.
 */
const UNSIZED_SHARE = 0.0001;

/** A region under this share of its slide also shows its own crop in the corner of its picture. */
const INSET_SHARE = 0.25;

/** At or above this share of the slides, "On 96% of slides." says nothing the title does not. */
const SHARE_SAID = 95;

/**
 * Evidence codes that add nothing on a card: the title already says the repeat, the
 * words and sizes are the object's own business, and "On the slide itself" is every
 * object's origin. The decision column and the card's `title` still carry them.
 */
const QUIET_EVIDENCE: ReadonlyArray<string | RegExp> = [
  /^evidence\.repeat\./,
  /^evidence\.text-size/,
  'evidence.words.one',
  'evidence.none',
  'evidence.origin.slide',
  // A drawing with no words is what a drawing is, and words found in a mark's picture
  // read as a warning on a card that only asks to replace it: the slide list says more.
  'evidence.no-text',
  'evidence.ocr.text-found',
];

/** The classes whose card shows a mark: its picture is the mark alone, drawn on its slide's ground. */
const MARK_CLASSES: ReadonlySet<string> = new Set(['logo-candidate', 'known-logo']);

/** A card's picture cell and a chip's round picture, long edge in CSS px, for the crop's drawing level. */
const CARD_EDGE = 56;
const CHIP_EDGE = 24;

/** The library id of the layout a picture deck's slides read as before their text is read. */
const FULL_PICTURE = 'full-image';

/** The evidence of a keep card on a slide picture whose text was not read. */
const OCR_NOT_RUN = 'evidence.ocr.not-run';

interface QueueState {
  /** The order each tab showed while the pointer or focus was in the list. */
  frozen: Map<RbQueueTab, string[]>;
  pointerIn: boolean;
  focusIn: boolean;
  /** True while the list is being replaced, so the focus it drops is not read as the person leaving. */
  rendering: boolean;
  observer: IntersectionObserver | null;
  /** The roving stop the person last moved to, by its `data-rove` value, so a redraw keeps it. */
  rove: string;
  /** An Auto-match run from the Match card is in flight. */
  matching: boolean;
  /** A list was drawn in its held order, not the engine's, so letting go must draw it again. */
  reordered: boolean;
  /** The roving key of the card last marked current, so a new one is brought into view once. */
  current: string | null;
  /** A card has been marked current once: the one marked on arrival is not scrolled to. */
  marked: boolean;
}

const states = new WeakMap<RbCtx, QueueState>();

function stateOf(rb: RbCtx): QueueState {
  let state = states.get(rb);
  if (!state) {
    state = { frozen: new Map(), pointerIn: false, focusIn: false, rendering: false, observer: null, rove: '', matching: false, reordered: false, current: null, marked: false };
    states.set(rb, state);
  }
  return state;
}

// ─── sentences ───────────────────────────────────────────────────────────────

function capitalise(html: string): string {
  return html.length === 0 ? html : html.charAt(0).toUpperCase() + html.slice(1);
}

function lowerFirst(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

function isNounKey(key: string): key is ReviewNounKeyV1 {
  return Object.hasOwn(REVIEW_NOUNS, key);
}

function isMessageCode(code: string): code is keyof typeof REVIEW_MESSAGES {
  return Object.hasOwn(REVIEW_MESSAGES, code);
}

/**
 * The noun key for a class read with the object's kind, the rule the engine's
 * `nounFor` applies to queue titles (engine/src/rebrand-review.ts `nounKey`), so
 * the panel, the overlay and the queue name one object with one word. `nounFor` is
 * not on the engine barrel yet; queue.test.ts pins this copy to it.
 */
export function nounKeyFor(klass: ObjectClassV1 | ReviewNounKeyV1, kind: SourceObjectKindV1 | undefined): ReviewNounKeyV1 {
  if (klass === 'template-furniture' || klass === 'decoration') {
    switch (kind) {
      case 'pic': return 'picture';
      case 'vector': return 'drawing';
      case 'text': return klass === 'template-furniture' ? 'recurring-text' : 'label';
      case 'table': return 'table';
      case 'chart': return 'chart';
      case 'shape': return 'decoration';
      default: return klass;
    }
  }
  if (klass === 'unknown' && kind === 'pic') return 'picture';
  if (klass === 'unknown' && kind === 'vector') return 'drawing';
  if (klass === 'diagram' && kind === 'shape') return 'drawing-part';
  return isNounKey(klass) ? klass : 'unknown';
}

/**
 * A class noun, translated, as plain text for `t()` params and labels. With the
 * object's kind it gives the object the word its queue item uses.
 */
export function nounText(
  rb: RbCtx,
  klass: ObjectClassV1 | ReviewNounKeyV1,
  form: 'one' | 'many',
  upper = false,
  kind?: SourceObjectKindV1,
): string {
  void rb;
  const key = nounKeyFor(isNounKey(klass) ? klass : 'unknown', kind);
  const word = t(REVIEW_NOUNS[key][form]);
  return upper ? capitalise(word) : word;
}

/** One engine sentence, translated by code, else its English text: HTML for a sink, plain for an attribute. */
function messageAs(rb: RbCtx, message: ReviewMessageV1, html: boolean): string {
  const code = message.code;
  if (!isMessageCode(code)) return html ? htmlEscape(message.text) : message.text;
  const params: Record<string, string | number> = { ...message.params };
  const nounCode = typeof params.nounCode === 'string' ? params.nounCode : '';
  const [, key = '', form = ''] = nounCode.split('.');
  if (isNounKey(key) && (form === 'one' || form === 'many')) {
    const word = nounText(rb, key, form);
    if ('noun' in params) params.noun = word;
    if ('nouns' in params) params.nouns = word;
  }
  return capitalise(html ? t(REVIEW_MESSAGES[code], params) : tRaw(REVIEW_MESSAGES[code], params));
}

/** One engine sentence as HTML: translated by code, else its English text. */
export function messageHtml(rb: RbCtx, message: ReviewMessageV1): string {
  return messageAs(rb, message, true);
}

/** "Slide 3", "Slides 3 and 4", "Slides 3, 4, 7 and 21 more". */
export function slideNumbersText(numbers: readonly number[]): string {
  const [first, second, third] = numbers;
  if (first === undefined) return '';
  if (second === undefined) return t('Slide {n}', { n: first });
  if (numbers.length === 2) return t('Slides {list} and {last}', { list: first, last: second });
  if (numbers.length === 3) return t('Slides {list} and {last}', { list: `${first}, ${second}`, last: third ?? '' });
  return t('Slides {list} and {count} more', { list: `${first}, ${second}, ${third}`, count: numbers.length - 3 });
}

/** The review state in words, beside whatever colour carries it. */
function reviewText(review: ReviewStateV1): string {
  if (review === 'needs-attention') return t('Needs attention');
  if (review === 'unreviewed') return t('Not reviewed');
  return t('Accepted');
}

// ─── what a card is about ────────────────────────────────────────────────────

interface Placed {
  object: SourceObjectV1;
  slide: SlideSourceV1;
}

const PLACED = new WeakMap<SourceDeckV1, Map<string, Placed>>();

/** A source object with its slide, by id, indexed once per source deck. */
function placedOf(rb: RbCtx, objectId: string): Placed | undefined {
  const source = rb.state.source;
  if (!source) return undefined;
  let index = PLACED.get(source);
  if (!index) {
    index = new Map();
    for (const slide of source.slides) for (const object of slide.objects) index.set(object.id, { object, slide });
    PLACED.set(source, index);
  }
  return index.get(objectId);
}

/** True when a box has an area and meets another's. */
function boxesMeet(a: SourceObjectV1['box'], b: SourceObjectV1['box']): boolean {
  if (!(a.w > 0 && a.h > 0 && b.w > 0 && b.h > 0)) return false;
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * True when nothing the slide paints after the object (its objects are in paint order)
 * covers part of its box, so the Original shows it whole. An object with no box is never
 * on top: its place cannot be shown.
 */
function onTop(rb: RbCtx, objectId: string): boolean {
  const placed = placedOf(rb, objectId);
  if (!placed) return false;
  const { object, slide } = placed;
  if (!(object.box.w > 0 && object.box.h > 0)) return false;
  const at = slide.objects.indexOf(object);
  return slide.objects.slice(at + 1).every((later) => !boxesMeet(later.box, object.box));
}

const EXEMPLARS = new WeakMap<QueueItemV1, string>();

/**
 * The member a card shows and selects: the engine's exemplar when the Original shows it
 * whole, else the first member that is on top of its slide, else the exemplar. A mark
 * repeated on every slide is often painted under a picture or a panel on the first
 * one, which made the card show that picture instead of the mark.
 */
export function exemplarOf(rb: RbCtx, item: QueueItemV1): string {
  if (item.type || item.objectIds.length < 2) return item.exemplar;
  const known = EXEMPLARS.get(item);
  if (known !== undefined) return known;
  const chosen = onTop(rb, item.exemplar) ? item.exemplar : item.objectIds.find((id) => onTop(rb, id)) ?? item.exemplar;
  EXEMPLARS.set(item, chosen);
  return chosen;
}

/** True when the object covers less than `SMALL_SHARE` of its slide: a mark, a label, a line, a small shape. */
function isSmall(rb: RbCtx, objectId: string): boolean {
  return rb.compare.objectShare(objectId) < SMALL_SHARE;
}

/** True when the person asked for calm previews: glyphs stand in for every picture. */
function previewsHidden(): boolean {
  return typeof document !== 'undefined' && document.documentElement.getAttribute('data-a11y-previews') === 'hidden';
}

/** The slides that are one picture of a whole slide, the ones the notice band offers to read. */
function slidePictures(rb: RbCtx): ReadonlySet<string> {
  const source = rb.state.source;
  return new Set(source ? slidePictureIdsOf(source) : []);
}

/**
 * True when the notice band already says what this card would: its slides are all
 * slide pictures, and it is the keep card for text not read or the Full picture group.
 */
function bandSays(item: QueueItemV1, pictures: ReadonlySet<string>): boolean {
  if (pictures.size === 0 || item.slideIds.length === 0) return false;
  if (!item.slideIds.every((id) => pictures.has(id))) return false;
  if (item.type === 'layout-group') return item.layout?.structure === FULL_PICTURE;
  return item.evidence.code === OCR_NOT_RUN;
}

// ─── the lists ───────────────────────────────────────────────────────────────

function itemsFor(rb: RbCtx, tab: RbQueueTab): QueueItemV1[] {
  const queue = rb.derived?.queue ?? [];
  if (tab === 'removed') return queue.filter((item) => item.action === 'remove');
  // The cards still waiting for a person, the list the tab and the footer both count,
  // less those the picture deck's notice band speaks for.
  if (tab === 'attention') {
    const pictures = slidePictures(rb);
    return rb.foot.reviewItems().filter((item) => !bandSays(item, pictures));
  }
  return [];
}

/** The slide-level cards still waiting, by section: they hold slides, not rows, so the row count does not list them. */
function slideItems(rb: RbCtx): QueueItemV1[] {
  const pictures = slidePictures(rb);
  return (rb.derived?.queue ?? []).filter((item) => item.type !== undefined && item.section !== 'settled' && !bandSays(item, pictures));
}

/**
 * The order a list shows. While the pointer or focus is in the list the last order
 * holds: items that left are dropped, items that arrived go to the end. Once both
 * are out, the engine's order comes back.
 */
function stableOrder<T>(rb: RbCtx, tab: RbQueueTab, rows: T[], idOf: (row: T) => string): T[] {
  const state = stateOf(rb);
  const held = state.pointerIn || state.focusIn;
  const previous = state.frozen.get(tab);
  let ordered = rows;
  if (!held) state.reordered = false;
  if (held && previous) {
    const byId = new Map(rows.map((row) => [idOf(row), row]));
    const kept = previous.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
    const seen = new Set(previous);
    ordered = [...kept, ...rows.filter((row) => !seen.has(idOf(row)))];
    if (ordered.some((row, i) => row !== rows[i])) state.reordered = true;
  }
  state.frozen.set(tab, ordered.map(idOf));
  return ordered;
}

// ─── pictures ────────────────────────────────────────────────────────────────

/**
 * The object's slide from the Original with its box outlined, for an object too large
 * for a crop to name (`rb.compare.crop` with `slide` and `outline`).
 */
function outlinedSlide(rb: RbCtx, objectId: string): CachedDrawing {
  return rb.compare.crop(objectId, CARD_RATIO, { slide: true, outline: true, longEdge: CARD_EDGE });
}

/**
 * A region small enough that its outline is hard to find on a 56 px slide also gets
 * its own crop, raised in the cell's corner, so the card still shows which object it is.
 */
function wantsInset(rb: RbCtx, objectId: string): boolean {
  return rb.compare.objectShare(objectId) < INSET_SHARE;
}

/** One slide drawn from the shared cache: the proposed frame when there is one, else the Original. */
function slideArt(rb: RbCtx, slideId: string, proposed: boolean): CachedDrawing {
  const edge = rb.compare.ladder().thumbnailLongEdge;
  const preview = rb.state.preview?.deck;
  const shown = proposed && preview ? framesForSlide(preview.frames, slideId)[0] : undefined;
  if (preview && shown) return rb.compare.draw(preview, shown, edge, true);
  const faithful = rb.state.faithful;
  const original = faithful ? framesForSlide(faithful.frames, slideId)[0] : undefined;
  return faithful && original ? rb.compare.draw(faithful, original, edge, false) : { svg: '', missing: false };
}

/** The drawing one picture slot asks for, by its data attributes. */
function slotDrawing(rb: RbCtx, slot: HTMLElement): CachedDrawing {
  const objectId = slot.dataset.crop;
  if (objectId) {
    const shape = slot.dataset.shape;
    const alone = slot.dataset.alone !== undefined;
    if (shape === 'slide') return rb.compare.crop(objectId, CARD_RATIO, { slide: true, longEdge: CARD_EDGE });
    if (shape === 'chip') return rb.compare.crop(objectId, CHIP_RATIO, { alone, longEdge: CHIP_EDGE });
    if (shape === 'region') return outlinedSlide(rb, objectId);
    return rb.compare.crop(objectId, CARD_RATIO, { alone, longEdge: CARD_EDGE });
  }
  const slideId = slot.dataset.slidePic;
  if (slideId) return slideArt(rb, slideId, slot.dataset.side === 'proposed');
  return { svg: '', missing: false };
}

/**
 * Draw one slot, with the object's own crop raised in its corner when the slot asks
 * for an inset. A picture still loading draws again on the state change that follows
 * its load.
 */
function fillSlot(rb: RbCtx, slot: HTMLElement): void {
  const drawn = slotDrawing(rb, slot);
  const objectId = slot.dataset.inset;
  const inset = objectId && drawn.svg ? rb.compare.crop(objectId, INSET_RATIO, { longEdge: CHIP_EDGE }) : { svg: '', missing: false };
  if (drawn.missing || inset.missing) rb.memo.queue = '';
  slot.innerHTML = inset.svg ? `${drawn.svg}<span class="rb-q-inset">${inset.svg}</span>` : drawn.svg;
}

/**
 * A picture slot for an object: its own crop when it is small, its slide with the box
 * outlined when it is a region (or when `region` asks for the place, as the Not placed
 * card does), and the plain slide when the object has no box to show. A chip shows the
 * crop, round.
 */
function objectSlot(rb: RbCtx, objectId: string, cls: string, chip = false, region = false, mark = false): string {
  const unsized = rb.compare.objectShare(objectId) < UNSIZED_SHARE;
  // A mark is always its own crop, drawn alone, whatever its size: the card is about it.
  const shape = unsized ? 'slide' : chip ? 'chip' : mark ? 'crop' : region || !isSmall(rb, objectId) ? 'region' : 'crop';
  const id = htmlEscape(objectId);
  const inset = shape === 'region' && wantsInset(rb, objectId) ? ` data-inset="${id}"` : '';
  const alone = mark && shape !== 'slide' ? ' data-alone' : '';
  return `<span class="${cls} ${cls}--${shape}" data-crop="${id}" data-shape="${shape}"${inset}${alone} aria-hidden="true"></span>`;
}

/** A picture slot for a whole slide, filled from the shared cache as it scrolls in. */
function slideSlot(slideId: string, cls: string, side: 'original' | 'proposed'): string {
  return `<span class="${cls}" data-slide-pic="${htmlEscape(slideId)}" data-side="${side}" aria-hidden="true"></span>`;
}

/** A glyph in place of the picture, for calm previews only. */
function glyphSlot(glyph: IconName, cls: string): string {
  return `<span class="${cls} rb-q-thumb--glyph" aria-hidden="true">${icon(glyph)}</span>`;
}

/** The glyph that stands for an object of this kind when previews are calm. */
function kindGlyph(kind: SourceObjectKindV1 | undefined): IconName {
  if (kind === 'pic') return 'image';
  if (kind === 'text') return 'font';
  if (kind === 'chart') return 'grid';
  if (kind === 'table') return 'table';
  if (kind === 'shape' || kind === 'vector') return 'shapes';
  return 'layers';
}

/** The archetype a layout group's slides take, as drawn by the master: its own id, else the one built on the group's structure. */
function layoutArchetype(master: SlideMasterV1, item: QueueItemV1): string {
  const layout = item.layout;
  if (!layout) return '';
  if (master.archetypes.some((one) => one.id === layout.archetype)) return layout.archetype;
  return master.archetypes.find((one) => structureIdOf(one) === layout.structure)?.id ?? '';
}

/** The picture for any card, by what the card is about. */
function cardPicture(rb: RbCtx, item: QueueItemV1, cls: string, chip = false): string {
  const calm = previewsHidden();
  if (item.type === 'layout-group') {
    if (calm) return glyphSlot('grid', cls);
    const master = rb.chooser.master();
    const archetype = master ? layoutArchetype(master, item) : '';
    const svg = master && archetype ? layoutThumb(master, archetype, chip ? CHIP_WIREFRAME_WIDTH : WIREFRAME_WIDTH, archetypeThumbSvg) : '';
    if (svg) return `<span class="${cls} ${cls}--wire" aria-hidden="true">${svg}</span>`;
    // No master to draw the layout with: the group's first slide as it is proposed.
    const first = item.slideIds[0];
    return first ? slideSlot(first, cls, 'proposed') : glyphSlot('grid', cls);
  }
  if (item.type === 'diagram') {
    const first = item.slideIds[0];
    return calm || !first ? glyphSlot('shapes', cls) : slideSlot(first, cls, 'original');
  }
  const exemplar = exemplarOf(rb, item);
  if (calm) return glyphSlot(kindGlyph(placedOf(rb, exemplar)?.object.kind), cls);
  return objectSlot(rb, exemplar, cls, chip, false, MARK_CLASSES.has(item.class));
}

// ─── cards ───────────────────────────────────────────────────────────────────

/** True when the title already says the slide or the slide count, so a slide list under it repeats it. */
function titleNamesSlides(item: QueueItemV1): boolean {
  if (item.type) return true;
  const params = item.title.params ?? {};
  return 'slide' in params || 'slides' in params;
}

/** True when the item's evidence adds a fact on a card; `QUIET_EVIDENCE` lists the ones that do not. */
function evidenceAdds(item: QueueItemV1): boolean {
  if (item.evidenceAddsFact === false) return false;
  const code = item.evidence.code;
  if (QUIET_EVIDENCE.some((rule) => (typeof rule === 'string' ? rule === code : rule.test(code)))) return false;
  if (code === 'evidence.repeat-share' && Number(item.evidence.params?.percent) >= SHARE_SAID) return false;
  return true;
}

/**
 * A card's review state. Shown when it differs from the state its group heading already
 * names (an accepted card among the suggestions); otherwise only a screen reader hears
 * it, since the heading says it for every card under it. `group` is null in a list with
 * no group headings (Removed), where every card shows its state.
 */
function stateHtml(review: ReviewStateV1, group: ReviewStateV1 | null): string {
  if (group === review) return `<span class="visually-hidden">${reviewText(review)}</span>`;
  // Needs attention carries its glyph beside the word, never a coloured word alone.
  const glyph = review === 'needs-attention' ? icon('alert') : '';
  return `<span class="rb-q-state">${glyph}${reviewText(review)}</span>`;
}

/** The layout group's title with the layout first, so the useful words survive the ellipsis. */
function layoutTitleHtml(rb: RbCtx, item: QueueItemV1): string {
  const name = layoutName(rb.chooser.master(), item.layout?.structure ?? '');
  const count = item.slideIds.length;
  return count === 1
    ? t('{layout}, slide {n}', { layout: name, n: item.slideNumbers[0] ?? 1 })
    : t('{layout}, {count} slides', { layout: name, count });
}

/**
 * True for the keep card of the pictures a rebuild cut out of slide pictures (plan 275
 * decision 29): every member is a picture region of a slide rebuilt from its picture.
 * After the rebuild it stands for the rebuild itself, so it says so rather than asking
 * to keep pictures the footer has just said were rebuilt.
 */
function isRebuiltCard(rb: RbCtx, item: QueueItemV1): boolean {
  if (item.type || item.action !== 'keep' || item.objectIds.length === 0) return false;
  return item.objectIds.every((id) => {
    const placed = placedOf(rb, id);
    return placed !== undefined && placed.object.kind === 'pic' && placed.object.origin === 'raster-region'
      && placed.slide.origin.flattened === true && placed.slide.recovery !== undefined;
  });
}

/** A card's title, HTML for a sink or plain for an attribute. */
function titleAs(rb: RbCtx, item: QueueItemV1, html: boolean): string {
  if (item.type === 'layout-group') return html ? layoutTitleHtml(rb, item) : layoutTitleText(rb, item);
  if (isRebuiltCard(rb, item)) {
    const count = item.slideIds.length;
    const fmt = html ? t : tRaw;
    return count === 1 ? fmt('Rebuilt 1 slide from its picture') : fmt('Rebuilt {count} slides from pictures', { count });
  }
  return messageAs(rb, item.title, html);
}

/**
 * The card's hover words: only what its accessible name lacks, so a screen reader never
 * hears the name twice. That is the evidence sentence when the second line does not
 * already carry it, and nothing otherwise.
 */
function hoverText(rb: RbCtx, item: QueueItemV1): string {
  if (item.type === 'layout-group' || isRebuiltCard(rb, item) || evidenceAdds(item)) return '';
  return messageAs(rb, item.evidence, false);
}

/** A `title` attribute when there are words for one. */
function titleAttr(text: string): string {
  return text ? ` title="${htmlEscape(text)}"` : '';
}

function layoutTitleText(rb: RbCtx, item: QueueItemV1): string {
  const name = layoutName(rb.chooser.master(), item.layout?.structure ?? '');
  const count = item.slideIds.length;
  return count === 1
    ? tRaw('{layout}, slide {n}', { layout: name, n: item.slideNumbers[0] ?? 1 })
    : tRaw('{layout}, {count} slides', { layout: name, count });
}

/** The optional second line: the parts that add a fact, or '' when none does. */
function metaHtml(parts: string[]): string {
  const shown = parts.filter(Boolean);
  return shown.length === 0 ? '' : `<span class="rb-q-meta">${shown.map((part) => `<span class="rb-q-part">${part}</span>`).join('')}</span>`;
}

/** The fact a card's second line carries, if any: the evidence, else the slides the title does not name. */
function factHtml(rb: RbCtx, item: QueueItemV1): string {
  if (item.type === 'layout-group') return item.layout?.band === 'likely' ? t('Likely') : '';
  if (isRebuiltCard(rb, item)) return t('Check each before Design');
  // A fragment under a title, like every other second line: no closing full stop. The
  // hover and the decision column keep the sentence whole.
  if (evidenceAdds(item)) return messageHtml(rb, item.evidence).replace(/\.$/, '');
  return titleNamesSlides(item) ? '' : slideNumbersText(item.slideNumbers);
}

/**
 * One card: the roving stop, its picture and its words. The title never ends in an
 * ellipsis: it wraps to a second line, and the second line gives way to it
 * (rebrand-queue.css). Which card is current is marked after the draw (`markCurrent`).
 */
function cardHtml(rb: RbCtx, item: QueueItemV1, group: ReviewStateV1 | null): string {
  const shownState = stateHtml(item.review, group);
  const pill = shownState.startsWith('<span class="rb-q-state"') ? shownState : '';
  const hidden = pill ? '' : shownState;
  const locked = item.lockedIds.length > 0 ? t('{count} locked', { count: item.lockedIds.length }) : '';
  const title = titleAs(rb, item, true);
  // `data-slide-item` on a slide-level card, not `data-item`: it answers no rows, so the
  // To review count (the cards holding rows that wait) leaves it out, as the footer does.
  const key = item.type ? 'data-slide-item' : 'data-item';
  const card = `<button type="button" class="rb-q-item" ${key}="${htmlEscape(item.id)}" data-rove="item:${htmlEscape(item.id)}" tabindex="-1"`
    + ` data-section="${item.section}" data-review="${item.review}"${titleAttr(hoverText(rb, item))}>`
    + cardPicture(rb, item, 'rb-q-thumb')
    + '<span class="rb-q-text">'
    + `<span class="rb-q-title">${title}</span>`
    + metaHtml([pill, factHtml(rb, item), locked])
    + hidden
    + '</span></button>';
  if (item.type !== 'diagram' || !rb.controller.setArrangement) return `<li>${card}</li>`;
  const keep = `<button type="button" class="btn btn--ghost btn--sm rb-q-slide-act" data-keep-picture="${htmlEscape(item.id)}"`
    + ` data-rove="keep:${htmlEscape(item.id)}" tabindex="-1">`
    + `${item.slideIds.length === 1 ? t('Keep as it was') : t('Keep them as they were')}</button>`;
  return `<li class="rb-q-slide-card">${card}${keep}</li>`;
}

/** What Design does with the objects it could place nowhere, in the words the panel repeats. */
export function unplacedWords(rb: RbCtx, count: number): string {
  void rb;
  return count === 1 ? t('Design puts it on the Not placed artboard.') : t('Design puts them on the Not placed artboard.');
}

/** The noun an object goes by on its own, read with its kind. */
function objectNoun(rb: RbCtx, objectId: string, form: 'one' | 'many'): string {
  const itemId = rb.derived?.itemOfObject.get(objectId);
  const klass = rb.derived?.queue.find((item) => item.id === itemId)?.class ?? 'unknown';
  return nounText(rb, klass, form, false, placedOf(rb, objectId)?.object.kind);
}

/**
 * The objects the compile could place on no slide, as one card at the top of the list:
 * "1 object not placed" over "Slide 2, picture". It asks for a look, not an answer, so
 * it is not counted. Its picture is the first object's slide with the box outlined (or
 * its crop when it is small), so a light object on a light ground still names itself.
 */
function unplacedHtml(rb: RbCtx, chips: boolean): string {
  const rows = unplacedOf(rb.state.preview?.deck, rb.derived, rb.state.source);
  const first = rows[0];
  if (!first) return '';
  const count = rows.length;
  const calm = previewsHidden();
  if (chips) {
    const name = t('Not placed, {count}', { count });
    const detail = count === 1 ? tRaw('1 object not placed') : tRaw('{count} objects not placed', { count });
    const label = tRaw('{name}: {detail}', { name: tRaw('Not placed, {count}', { count }), detail });
    const pic = calm ? '' : objectSlot(rb, first.objectId, 'rb-q-chip-pic', true);
    return `<li><button type="button" class="rb-q-chip" data-unplaced-item data-rove="unplaced" tabindex="-1" data-review="needs-attention"`
      + ` aria-label="${htmlEscape(label)}">${pic}${icon('alert')}<span class="rb-q-title">${name}</span></button></li>`;
  }
  const title = count === 1 ? t('1 object not placed') : t('{count} objects not placed', { count });
  const numbers = [...new Set(rows.map((row) => rb.derived?.slides.find((slide) => slide.id === row.slideId)?.number ?? 0))]
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  const where = slideNumbersText(numbers);
  const fact = count === 1 && where ? t('{where}, {noun}', { where, noun: objectNoun(rb, first.objectId, 'one') }) : where;
  // Always the slide with the box outlined: the card asks where the object was.
  const picture = calm
    ? glyphSlot('alert', 'rb-q-thumb')
    : objectSlot(rb, first.objectId, 'rb-q-thumb', false, true);
  const design = count === 1 ? tRaw('Design puts it on the Not placed artboard.') : tRaw('Design puts them on the Not placed artboard.');
  return `<li><button type="button" class="rb-q-item" data-unplaced-item data-rove="unplaced" tabindex="-1" data-section="attention"`
    + ` data-review="needs-attention" title="${htmlEscape(design)}">`
    + picture
    + '<span class="rb-q-text">'
    + `<span class="rb-q-title">${title}</span>`
    + metaHtml([fact])
    + `${stateHtml('needs-attention', 'needs-attention')}</span></button></li>`;
}

/** A chip's short name: the noun with its count ("Marks, 12"), the layout for a layout group. */
function chipName(rb: RbCtx, item: QueueItemV1, html: boolean): string {
  const fmt = html ? t : tRaw;
  if (item.type === 'layout-group') {
    return fmt('{name}, {count}', { name: layoutName(rb.chooser.master(), item.layout?.structure ?? ''), count: item.slideIds.length });
  }
  if (item.type === 'diagram') {
    return fmt('{name}, {count}', { name: nounText(rb, 'diagram', item.slideIds.length === 1 ? 'one' : 'many', true), count: item.slideIds.length });
  }
  // Slides, as the card's own title counts them ("Marks, 12" for "Replace marks on 12
  // slides"): one card, one number, on the chip and in the label.
  const count = item.slideIds.length;
  const kind = placedOf(rb, item.exemplar)?.object.kind;
  const noun = nounText(rb, item.class, item.objectIds.length === 1 ? 'one' : 'many', true, kind);
  return fmt('{name}, {count}', { name: noun, count });
}

function chipHtml(rb: RbCtx, item: QueueItemV1): string {
  const key = item.type ? 'data-slide-item' : 'data-item';
  // The name a person sees comes first in the name a screen reader and voice control use.
  // The chip row has no group headings, so the label ends with the review state; on
  // screen the line between the groups says it, and only Not placed takes the danger look.
  const detail = titleAs(rb, item, false);
  const label = tRaw('{name}: {detail}. {state}.', { name: chipName(rb, item, false), detail: lowerFirst(detail), state: reviewText(item.review) });
  const pic = cardPicture(rb, item, 'rb-q-chip-pic', true);
  return `<li><button type="button" class="rb-q-chip" ${key}="${htmlEscape(item.id)}" data-rove="item:${htmlEscape(item.id)}" tabindex="-1"`
    + ` data-review="${item.review}" aria-label="${htmlEscape(label)}"${titleAttr(hoverText(rb, item))}>`
    + `${pic}<span class="rb-q-title">${chipName(rb, item, true)}</span></button></li>`;
}

/**
 * The All slides list: a small picture of each proposed slide, its number, and its
 * state only when it differs from most slides' (Left out always shows).
 */
function slideRowHtml(rb: RbCtx, chips: boolean): string {
  const slides = stableOrder(rb, 'all', rb.derived?.slides ?? [], (slide) => slide.id);
  const calm = previewsHidden();
  // A state on more than half the slides is the usual one, so a row says it only when
  // it is not; the To review tab lists what those slides hold.
  const usual = {
    attention: slides.filter((slide) => slide.attention > 0).length * 2 > slides.length,
    unreviewed: slides.filter((slide) => slide.unreviewed > 0).length * 2 > slides.length,
  };
  return slides.map((slide) => {
    const name = t('Slide {n}', { n: slide.number });
    const title = readableTitle(slide.title);
    const hover = title ? ` title="${htmlEscape(title)}"` : '';
    const rove = `data-rove="slide:${htmlEscape(slide.id)}" tabindex="-1"`;
    if (chips) {
      const pic = calm ? '' : slideSlot(slide.id, 'rb-q-chip-pic', 'proposed');
      return `<li><button type="button" class="rb-q-chip" data-slide="${htmlEscape(slide.id)}" ${rove}${hover}>`
        + `${pic}<span class="rb-q-title">${name}</span></button></li>`;
    }
    const state = !slide.include
      ? t('Left out')
      : slide.attention > 0 && !usual.attention
        ? (slide.attention === 1 ? t('1 needs attention') : t('{count} need attention', { count: slide.attention }))
        : slide.unreviewed > 0 && !usual.unreviewed ? t('{count} not reviewed', { count: slide.unreviewed }) : '';
    const picture = calm ? glyphSlot('document', 'rb-q-thumb') : slideSlot(slide.id, 'rb-q-thumb', 'proposed');
    return `<li><button type="button" class="rb-q-item rb-q-item--slide" data-slide="${htmlEscape(slide.id)}" ${rove}`
      + ` data-include="${slide.include}"${hover}>`
      + picture
      + '<span class="rb-q-text">'
      + `<span class="rb-q-title">${name}${state ? `<span class="rb-q-slide-state">${state}</span>` : ''}</span>`
      + '</span></button></li>';
  }).join('');
}

// ─── the Match card ──────────────────────────────────────────────────────────

/**
 * Auto-match as one card at the top of Layouts: what it would do in its title, the
 * button, and the likely share as the button's hover sentence. Once every slide uses
 * its match the card is the one line "Layouts match", disabled but focusable, the
 * reason only in its description, since the words on screen would say the same fact
 * twice. '' when the controller offers no Auto-match or no slide has a match.
 */
function matchHtml(rb: RbCtx): string {
  const offer = rb.chooser.autoMatchState();
  if (!offer.shown) return '';
  const counts = rb.chooser.autoMatchCounts();
  if (!counts.anyMatch && !offer.reason) return '';
  const busy = stateOf(rb).matching;
  const id = 'rb-q-match-text';
  let text: string;
  let label: string;
  let hover = '';
  let off = false;
  if (offer.reason) {
    text = offer.reason;
    label = t('Match');
    off = true;
  } else if (counts.count === 0) {
    // Retired: every slide already uses its match, or what is left has too few boxes.
    if ((counts.tooSmall ?? 0) > 0) return '';
    const slides = rb.derived?.slides.filter((slide) => slide.include).length ?? 0;
    const reason = slides === 1
      ? t('1 slide already uses its suggested layout.')
      : t('All {count} slides already use their suggested layout.', { count: slides });
    return `<li class="rb-q-match" data-retired="true"><span class="visually-hidden" id="${id}">${reason}</span>`
      + `<button type="button" class="rb-q-match-done" data-act="match" data-rove="match" tabindex="-1" aria-disabled="true"`
      + ` aria-describedby="${id}">${icon('check')}<span>${t('Layouts match')}</span></button></li>`;
  } else {
    text = counts.count === 1
      ? t('Match 1 slide to its suggested layout')
      : t('Match {count} slides to their suggested layouts', { count: counts.count });
    label = t('Match');
    hover = likelyWords(counts.count, counts.likely);
  }
  const disabled = off || busy ? ' aria-disabled="true"' : '';
  return `<li class="rb-q-match"><span class="rb-q-match-text" id="${id}">${text}</span>`
    + `<button type="button" class="btn btn--ghost btn--sm rb-q-match-btn" data-act="match" data-rove="match" tabindex="-1"`
    + ` aria-describedby="${id}"${disabled}${hover ? ` title="${htmlEscape(hover)}"` : ''}>${label}</button></li>`;
}

/** How many of the slides a Match would set are only likely matches, for the button's hover. */
function likelyWords(count: number, likely: number): string {
  if (likely <= 0) return count === 1 ? tRaw('It is a clear match.') : tRaw('All are clear matches.');
  if (count === 1) return tRaw('It is a likely match. Check it after.');
  return likely === 1
    ? tRaw('1 of the {count} is a likely match. Check it after.', { count })
    : tRaw('{likely} of the {count} are likely matches. Check them after.', { likely, count });
}

/** Run Auto-match over the deck from the Match card; the outcome goes to the footer's line. */
async function runMatch(rb: RbCtx): Promise<void> {
  const state = stateOf(rb);
  const command = rb.controller.autoMatchLayouts;
  const offer = rb.chooser.autoMatchState();
  if (!command || state.matching || offer.reason || rb.chooser.autoMatchCounts().count === 0) return;
  state.matching = true;
  rb.memo.queue = '';
  renderQueue(rb);
  try {
    const before = rb.controller.getState().plan;
    const outcome = await command('likely');
    if (!outcome.ok && outcome.refusal === 'not-built') {
      rb.chooser.noteAutoMatchRefused();
      rb.announce(t('Auto-match is not available yet.'));
      return;
    }
    rb.decide.announceOutcome(outcome, rb.chooser.matchedText(outcome.touched, rb.chooser.likelySet(before, rb.controller.getState().plan)));
  } finally {
    state.matching = false;
    rb.memo.queue = '';
    renderQueue(rb);
  }
}

// ─── the tabs and the list ───────────────────────────────────────────────────

/** The id of the list the tabs switch, so each tab can name what it controls. */
const PANEL_ID = 'rb-q-panel';

function tabsHtml(rb: RbCtx): string {
  // Each number counts what its tab lists: cards, slides, cards. With no notice band
  // the To review number is the footer's own count, so the two never drift apart.
  const counts: Record<RbQueueTab, number> = {
    attention: itemsFor(rb, 'attention').length,
    all: rb.derived?.slides.length ?? 0,
    removed: itemsFor(rb, 'removed').length,
  };
  const tab = (id: RbQueueTab, label: string) => ({ id, label, count: counts[id], controls: PANEL_ID });
  return segHtml('rb-queue', [tab('attention', t('To review')), tab('all', t('All slides')), tab('removed', t('Removed'))], rb.queueTab, t('Review queue'), {
    variant: 'panel',
    tabs: true,
    attr: 'data-tab',
    extraClass: 'rb-q-tabs',
  });
}

/** The queue shows as a chip row above the comparison on a narrow or a medium screen. */
function asChips(rb: RbCtx): boolean {
  return rb.narrow || rb.medium;
}

/** The id of the hidden line that says which keys move along a list. */
const KEYS_ID = 'rb-q-keys';

/** The hidden line itself: Up and Down along the cards, Left and Right along the chips. */
function keysHtml(chips: boolean): string {
  const words = chips ? t('Left and Right move between cards') : t('Up and Down move between cards');
  return `<span class="visually-hidden" id="${KEYS_ID}">${words}</span>`;
}

function listHtml(rb: RbCtx): string {
  const tab = rb.queueTab;
  const chips = asChips(rb);
  const listClass = chips ? 'rb-q-chips' : 'rb-q-list';
  const keys = ` aria-describedby="${KEYS_ID}"`;
  if (tab === 'all') return `<ul class="${chips ? listClass : 'rb-q-list rb-q-list--slides'}" role="list"${keys}>${slideRowHtml(rb, chips)}</ul>`;
  const listed = itemsFor(rb, tab);
  const extra = tab === 'attention' ? slideItems(rb).filter((item) => !listed.includes(item)) : [];
  const items = stableOrder(rb, tab, [...listed, ...extra], (item) => item.id);
  const unplaced = tab === 'attention' ? unplacedHtml(rb, chips) : '';
  const note = tab === 'attention' ? carriedNote(rb) : '';
  const match = tab === 'attention' && !chips ? matchHtml(rb) : '';
  if (items.length === 0 && !unplaced) {
    return `<p class="rb-q-empty">${tab === 'removed' ? t('Nothing is removed.') : t('Nothing to review.')}</p>${chips ? '' : note}`;
  }
  if (tab === 'removed') {
    return `<ul class="${listClass}" role="list"${keys}>${items.map((item) => (chips ? chipHtml(rb, item) : cardHtml(rb, item, null))).join('')}</ul>`;
  }
  if (chips) {
    // The chips that need attention first, then a line, then the suggestions.
    const first = items.filter((item) => item.review === 'needs-attention');
    const rest = items.filter((item) => item.review !== 'needs-attention');
    const sep = (unplaced || first.length > 0) && rest.length > 0 ? '<li class="rb-q-chip-sep" role="presentation"></li>' : '';
    return `<ul class="${listClass}" role="list"${keys}>${unplaced}${first.map((item) => chipHtml(rb, item)).join('')}${sep}`
      + `${rest.map((item) => chipHtml(rb, item)).join('')}</ul>`;
  }
  // The cards the tab counts (they hold rows still to answer) under Needs attention and
  // Suggestions; the slide-level cards, which the count leaves out, under Layouts with
  // the Match card, so the number on the tab is the number of cards above that head.
  const layouts = items.filter((item) => item.type !== undefined);
  const counted = items.filter((item) => item.type === undefined);
  const attention = counted.filter((item) => item.section === 'attention');
  const suggestions = counted.filter((item) => item.section !== 'attention');
  const group = (head: string, rows: string): string =>
    `<h2 class="rb-q-group">${head}</h2><ul class="rb-q-list" role="list"${keys}>${rows}</ul>`;
  let html = '';
  if (attention.length > 0 || unplaced) {
    // With every card answered and only the Not placed card left, the head says what is left to do.
    const alone = attention.length === 0 && suggestions.length === 0 && layouts.length === 0;
    html += group(alone ? t('Look before you open') : t('Needs attention'), `${unplaced}${attention.map((item) => cardHtml(rb, item, 'needs-attention')).join('')}`);
  }
  // A live Match card leads Layouts. A retired one ("Layouts match") beside a layout card
  // still to answer would contradict it, so it shows only with no layout card, at the
  // top of Suggestions, and alone it is no reason for a group.
  const retired = match.includes('data-retired');
  const retiredShown = retired && layouts.length === 0 && suggestions.length > 0 ? match : '';
  if (suggestions.length > 0) {
    html += group(t('Suggestions'), `${retiredShown}${suggestions.map((item) => cardHtml(rb, item, 'unreviewed')).join('')}`);
  }
  const live = retired ? '' : match;
  if (layouts.length > 0 || live) {
    html += group(t('Layouts'), `${live}${layouts.map((item) => cardHtml(rb, item, 'unreviewed')).join('')}`);
  }
  return html + note;
}

/**
 * On a newer version, the decisions that came across from the last one, as a note under
 * the list: they are already answered, so they are no card waiting for a person.
 */
function carriedNote(rb: RbCtx): string {
  const carried = rb.derived?.queue.find((item) => item.id === CARRIED_ITEM_ID);
  if (!carried) return '';
  const count = carried.objectIds.length;
  const text = count === 1
    ? t('1 decision from the last version still applies.')
    : t('{count} decisions from the last version still apply.', { count });
  return `<p class="rb-q-note">${text}</p>`;
}

// ─── pictures on screen ──────────────────────────────────────────────────────

/**
 * Fill the picture slots, lazily when the browser can say which rows are on screen. A
 * whole-slide picture that scrolls far out of view is dropped again, so a long All
 * slides list holds only the drawings near the window; the shared cache keeps the
 * strings, so scrolling back mounts them without a redraw.
 */
function fillPictures(rb: RbCtx): void {
  const state = stateOf(rb);
  const slots = [...rb.els.queue.querySelectorAll<HTMLElement>('[data-crop], [data-slide-pic]')];
  state.observer?.disconnect();
  if (typeof IntersectionObserver === 'function') {
    state.observer ??= new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const slot = entry.target as HTMLElement;
        if (entry.isIntersecting) {
          if (!slot.firstChild) fillSlot(rb, slot);
        } else if (slot.dataset.slidePic && slot.firstChild) {
          slot.replaceChildren();
        }
      }
    }, { root: rb.els.queue, rootMargin: '200px' });
    for (const slot of slots) state.observer.observe(slot);
    return;
  }
  for (const slot of slots.slice(0, EAGER_PICTURES)) fillSlot(rb, slot);
}

// ─── one Tab stop ────────────────────────────────────────────────────────────

/** The roving stops of the list or the chip row, in order. */
function roveStops(rb: RbCtx): HTMLElement[] {
  return [...rb.els.queue.querySelectorAll<HTMLElement>('[data-rove]')];
}

/** Give the one Tab stop to `stop`, and take it from the rest. */
function setRove(rb: RbCtx, stop: HTMLElement): void {
  for (const one of roveStops(rb)) one.tabIndex = one === stop ? 0 : -1;
  stateOf(rb).rove = stop.dataset.rove ?? '';
}

/**
 * The roving key of the card that stands for the selection, whatever made it: the
 * selected card, else the card or the Not placed card holding the selected object, else
 * the slide's row in All slides, else the first slide-level card holding the slide. Null
 * when the list holds none of them.
 */
function currentRove(rb: RbCtx, stops: readonly HTMLElement[]): string | null {
  const keys = new Set(stops.map((one) => one.dataset.rove ?? ''));
  const { itemId, objectId, slideId } = rb.sel;
  if (itemId && keys.has(`item:${itemId}`)) return `item:${itemId}`;
  if (objectId) {
    if (keys.has('unplaced') && !itemId && unplacedOf(rb.state.preview?.deck, rb.derived, rb.state.source).some((row) => row.objectId === objectId)) return 'unplaced';
    const owner = rb.derived?.itemOfObject.get(objectId);
    if (owner && keys.has(`item:${owner}`)) return `item:${owner}`;
  }
  if (!slideId) return null;
  if (keys.has(`slide:${slideId}`)) return `slide:${slideId}`;
  const byId = new Map((rb.derived?.queue ?? []).map((item) => [item.id, item]));
  for (const stop of stops) {
    const rove = stop.dataset.rove ?? '';
    if (!rove.startsWith('item:')) continue;
    const item = byId.get(rove.slice(5));
    if (item?.type && item.slideIds.includes(slideId)) return rove;
  }
  return null;
}

/** Mark the card that stands for the selection as current, in place, and no other. */
function markCurrent(rb: RbCtx): void {
  const stops = roveStops(rb).filter((one) => /^(item:|slide:|unplaced$)/.test(one.dataset.rove ?? ''));
  const want = currentRove(rb, stops);
  let shown: HTMLElement | null = null;
  for (const stop of stops) {
    if (stop.dataset.rove === want) {
      stop.setAttribute('aria-current', 'true');
      shown = stop;
    } else {
      stop.removeAttribute('aria-current');
    }
  }
  // A card that became current through a selection made elsewhere (the filmstrip, the
  // stage) is brought into view in the list, while the person is not in the list. The
  // first card marked on arrival is not: the list opens at its top, on what needs attention.
  const state = stateOf(rb);
  if (shown && state.marked && want !== state.current && !state.pointerIn && !state.focusIn) revealCard(rb, shown);
  state.current = want;
  if (want !== null) state.marked = true;
}

/**
 * Scroll the list itself, never the page, so a card is in view. `scrollIntoView` also
 * scrolls every scrolling ancestor.
 */
function revealCard(rb: RbCtx, card: HTMLElement): void {
  const list = rb.els.queue.querySelector<HTMLElement>('.rb-q-scroll');
  if (!list || asChips(rb) || typeof card.getBoundingClientRect !== 'function') return;
  const box = list.getBoundingClientRect();
  const own = card.getBoundingClientRect();
  const gap = 8;
  if (own.top < box.top) list.scrollTop -= box.top - own.top + gap;
  else if (own.bottom > box.bottom) list.scrollTop += own.bottom - box.bottom + gap;
}

/** After a redraw: the stop the person last moved to, else the current card, else the first. */
function placeRove(rb: RbCtx): void {
  const stops = roveStops(rb);
  const remembered = stateOf(rb).rove;
  const stop = stops.find((one) => one.dataset.rove === remembered)
    ?? stops.find((one) => one.getAttribute('aria-current') === 'true')
    ?? stops[0];
  if (stop) setRove(rb, stop);
}

/** Up and Down (Left and Right in the chip row), Home and End along the roving stops. */
function roveKey(rb: RbCtx, e: KeyboardEvent): void {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
  const target = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-rove]') : null;
  if (!target || !rb.els.queue.contains(target)) return;
  const chips = asChips(rb);
  const rtl = typeof getComputedStyle === 'function' && getComputedStyle(target).direction === 'rtl';
  const forward = chips ? (rtl ? 'ArrowLeft' : 'ArrowRight') : 'ArrowDown';
  const back = chips ? (rtl ? 'ArrowRight' : 'ArrowLeft') : 'ArrowUp';
  const stops = roveStops(rb);
  const at = stops.indexOf(target);
  let next: HTMLElement | undefined;
  if (e.key === forward) next = stops[Math.min(stops.length - 1, at + 1)];
  else if (e.key === back) next = stops[Math.max(0, at - 1)];
  else if (e.key === 'Home') next = stops[0];
  else if (e.key === 'End') next = stops[stops.length - 1];
  else return;
  e.preventDefault();
  if (!next || next === target) return;
  setRove(rb, next);
  next.focus();
}

/**
 * Bring the current chip into view by scrolling the chip row itself, never the page:
 * `scrollIntoView` also scrolls every scrolling ancestor, which moved the tab bar off
 * the left edge of a phone.
 */
function revealChip(rb: RbCtx): void {
  const row = rb.els.queue.querySelector<HTMLElement>('.rb-q-chips');
  const chip = row?.querySelector<HTMLElement>('.rb-q-chip[aria-current="true"]');
  if (!row || !chip || typeof chip.getBoundingClientRect !== 'function') return;
  const box = row.getBoundingClientRect();
  const own = chip.getBoundingClientRect();
  const gap = 8;
  if (own.left < box.left) row.scrollLeft -= box.left - own.left + gap;
  else if (own.right > box.right) row.scrollLeft += own.right - box.right + gap;
}

// ─── wiring and drawing ──────────────────────────────────────────────────────

export function wireQueue(rb: RbCtx): void {
  const state = stateOf(rb);
  const region = rb.els.queue;
  // Letting go of the list draws it again only when a draw held its order back, so the
  // engine's order returns; otherwise nothing under the pointer changes.
  const release = (): void => {
    if (state.pointerIn || state.focusIn || state.rendering || !state.reordered) return;
    state.reordered = false;
    rb.memo.queue = '';
    renderQueue(rb);
  };
  region.addEventListener('pointerenter', () => { state.pointerIn = true; });
  region.addEventListener('pointerleave', () => {
    state.pointerIn = false;
    release();
  });
  region.addEventListener('focusin', (e) => {
    state.focusIn = true;
    const stop = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-rove]') : null;
    if (stop && region.contains(stop)) setRove(rb, stop);
  });
  region.addEventListener('focusout', (e) => {
    if (state.rendering) return;
    if (e.relatedTarget instanceof Node && region.contains(e.relatedTarget)) return;
    state.focusIn = false;
    release();
  });
  region.addEventListener('keydown', (e) => roveKey(rb, e));
  region.addEventListener('click', (e) => {
    const target = e.target as Element;
    // A tab is the tab bar's own (`switchTab`, wired with each render).
    if (target.closest('[data-tab]')) return;
    if (target.closest('[data-act="match"]')) {
      void runMatch(rb);
      return;
    }
    const keep = target.closest<HTMLElement>('[data-keep-picture]')?.dataset.keepPicture;
    if (keep) {
      void keepAsPictures(rb, keep);
      return;
    }
    const item = target.closest<HTMLElement>('[data-item]')?.dataset.item ?? target.closest<HTMLElement>('[data-slide-item]')?.dataset.slideItem;
    if (item) {
      selectItem(rb, item);
      return;
    }
    const unplaced = target.closest<HTMLElement>('[data-unplaced-item]');
    if (unplaced) {
      const first = unplacedOf(rb.state.preview?.deck, rb.derived, rb.state.source)[0];
      if (!first) return;
      rb.select({ objectId: first.objectId, slideId: first.slideId ?? rb.sel.slideId, itemId: null });
      if (rb.narrow) rb.decide.openSheet(unplaced);
      return;
    }
    const slideButton = target.closest<HTMLElement>('[data-slide]');
    const slideId = slideButton?.dataset.slide;
    if (!slideButton || !slideId) return;
    rb.select({ slideId, objectId: null, itemId: null });
    // On a phone the slide's own settings live in the sheet, so a slide chip opens it.
    if (rb.narrow) rb.decide.openSheet(slideButton);
  });
  rb.disposers.push(() => {
    state.observer?.disconnect();
    state.observer = null;
  });
}

/** Show another list. The tab bar calls this for a click or an arrow key. */
function switchTab(rb: RbCtx, value: string): void {
  if (value !== 'attention' && value !== 'all' && value !== 'removed') return;
  rb.queueTab = value;
  renderQueue(rb);
}

/** The model a queue render last drew, so a new plan always redraws. */
const lastDerived = new WeakMap<RbCtx, NonNullable<RbCtx['derived']>>();

export function renderQueue(rb: RbCtx): void {
  const derived = rb.derived;
  if (!derived) return;
  const state = stateOf(rb);
  const offer = rb.chooser.autoMatchState();
  const key = [
    derived.plan.revision,
    derived.queue.length,
    rb.queueTab,
    rb.narrow,
    rb.medium,
    rb.state.faithful?.source.instanceId ?? '',
    rb.state.source?.source.instanceId ?? '',
    rb.state.preview ? `${rb.state.preview.planRevision}:${rb.state.preview.deck.tray.length}` : '',
    previewsHidden(),
    rb.chooser.master() ? 'master' : '',
    offer.shown ? `match:${offer.reason}:${state.matching}` : '',
  ].join('|');
  // A new selection alone changes which card is current: the mounted cards take it in
  // place, so neither the pictures nor the focused card are drawn again.
  if (rb.memo.queue === key && derived === lastDerived.get(rb)) {
    markCurrent(rb);
    // A selection made elsewhere hands the list's one Tab stop to its current card.
    const active = typeof document === 'undefined' ? null : document.activeElement;
    const current = rb.els.queue.querySelector<HTMLElement>('[data-rove][aria-current="true"]');
    if (current && !(active && rb.els.queue.contains(active))) setRove(rb, current);
    if (asChips(rb)) revealChip(rb);
    return;
  }
  rb.memo.queue = key;
  lastDerived.set(rb, derived);
  const chips = asChips(rb);
  const memo = rb.keys.capture(rb.els.queue, '[data-rove], [data-tab]', 'rove');
  const scroll = rb.els.queue.querySelector<HTMLElement>('.rb-q-scroll')?.scrollTop ?? 0;
  const across = rb.els.queue.querySelector<HTMLElement>('.rb-q-chips')?.scrollLeft ?? 0;
  state.rendering = true;
  try {
    rb.els.queue.innerHTML = `<div class="rb-q" data-narrow="${chips}">${tabsHtml(rb)}`
      + `<div class="rb-q-scroll" id="${PANEL_ID}" role="tabpanel">${listHtml(rb)}${keysHtml(chips)}</div></div>`;
    const scroller = rb.els.queue.querySelector<HTMLElement>('.rb-q-scroll');
    if (scroller) scroller.scrollTop = scroll;
    const row = rb.els.queue.querySelector<HTMLElement>('.rb-q-chips');
    if (row) row.scrollLeft = across;
    const tablist = rb.els.queue.querySelector<HTMLElement>('[role="tablist"]');
    if (tablist) {
      // Each tab gets an id so the list can be named by the tab that shows it, and the
      // count keeps its queue hook beside the primitive's.
      for (const tab of tablist.querySelectorAll<HTMLElement>('[data-tab]')) tab.id = `rb-q-tab-${tab.dataset.tab ?? ''}`;
      for (const count of tablist.querySelectorAll('.lp-seg-count')) count.classList.add('rb-q-count');
      scroller?.setAttribute('aria-labelledby', `rb-q-tab-${rb.queueTab}`);
      // The bar is drawn again with every render, so its keys and clicks are wired again.
      wireTabs(tablist, { key: 'tab', onSelect: (value, info) => { if (info.reason !== 'programmatic') switchTab(rb, value); } });
    }
    markCurrent(rb);
    placeRove(rb);
    fillPictures(rb);
    rb.keys.restore(rb.els.queue, '[data-rove], [data-tab]', 'rove', memo);
  } finally {
    state.rendering = false;
  }
  if (chips) revealChip(rb);
}

/**
 * Keep the slides a diagram card names as they were, through the chooser's own apply,
 * so the slides already kept are left out, the count said is the count changed, and
 * the sentence is the one the chooser's tile says.
 */
async function keepAsPictures(rb: RbCtx, itemId: string): Promise<void> {
  const item = rb.derived?.queue.find((one) => one.id === itemId);
  if (!item || !rb.controller.setArrangement) return;
  await rb.chooser.arrange(item.slideIds, 'picture');
}

/** Select one queue item, its exemplar object and its slide. A slide-level card selects its first slide. */
export function selectItem(rb: RbCtx, itemId: string): void {
  const item = rb.derived?.queue.find((one) => one.id === itemId);
  if (!item) return;
  if (item.type) {
    rb.select({ itemId, objectId: null, slideId: item.slideIds[0] ?? null });
    if (rb.narrow) rb.decide.openSheet();
    return;
  }
  const exemplar = exemplarOf(rb, item);
  const slideId = rb.derived?.objects.get(exemplar)?.slideId ?? item.slideIds[0] ?? null;
  rb.select({ itemId, objectId: exemplar, slideId });
  if (rb.narrow) rb.decide.openSheet();
}

/** `reviewText` for the other modules, through the namespace. */
export function reviewWords(rb: RbCtx, review: ReviewStateV1): string {
  void rb;
  return reviewText(review);
}

/**
 * The cards the queue leaves out while the picture deck's notice band speaks for them,
 * by id, so the footer can count what the queue lists.
 */
export function bandCardIds(rb: RbCtx): Set<string> {
  const pictures = slidePictures(rb);
  return new Set((rb.derived?.queue ?? []).filter((item) => bandSays(item, pictures)).map((item) => item.id));
}

export function queueOps(rb: RbCtx) {
  return {
    wire: bindOp(rb, wireQueue),
    render: bindOp(rb, renderQueue),
    selectItem: bindOp(rb, selectItem),
    message: bindOp(rb, messageHtml),
    noun: bindOp(rb, nounText),
    reviewText: bindOp(rb, reviewWords),
    unplacedWords: bindOp(rb, unplacedWords),
    bandCardIds: bindOp(rb, bandCardIds),
  };
}
