// SPDX-License-Identifier: MPL-2.0
/**
 * rebrand: the decision column (plan 274 section 4, plan 275 close-out section 3.5).
 *
 * Owns `rb.els.decide`, built on the plan 273 panel primitive (`.lp`, `.lp-band`,
 * `.lp-sec`, `.lp-row`). The head names the selection ("Slide 3 of 12", "Mark on slide
 * 1", "6 slides") in an `h2` that names the column too. The sections come in the band
 * order the section vocabulary gives them (`lib/section-bands.ts`):
 * - Content: Decision (an object selected: Keep, Replace and Remove as one segmented
 *   control, Apply to as a second one named with the card's own noun, the text field for
 *   an object with words) and Objects (the slide's objects as 32 px rows, each with a
 *   crop of its own region; rows that share a noun, no words and an action fold into one).
 * - Style: Colours (one row per source colour, or one row for several that go to one
 *   target, with a swatch grid for the eye and a select for the keyboard), Fonts (grouped
 *   by family, with a specimen in the target face) and Background (theme.ts draws it into
 *   the mount this module leaves).
 * - Layout: one section of the band's own name, so the band rule is its head (the
 *   `.lp-band-head` rule), with who set the layout as its flag; open, it shows the layout's
 *   picture, name and one line, Change layout (the chooser popover, docked over this
 *   column), Original arrangement, and the Position row.
 *
 * One section is open at rest: Layout for a slide, Decision and Objects for an object.
 * A help line states a problem or a provenance, never a state that is fine. Every button
 * calls one controller command; nothing edits the plan here.
 *
 * On a narrow screen the column is a bottom sheet that selecting an object, a slide chip
 * or the button beside the pane toggle opens; Esc (keys.ts), the dimmer and the close
 * button shut it and focus goes back to what opened it. Tab stays inside it while it is
 * open. The Replace choices unfold under the segment and close the same way.
 *
 * A group apply leaves out locked members always and members a person changed by
 * hand unless the person ticks "Include the M changed by hand", so the count on
 * the broad option is the number the apply will really touch.
 */
import '../../styles/parts/panel.css';
import type { ObjectStateV1, QueueItemV1, ReviewFidelityV1 } from '@lolly/engine';
import type { SlideMasterV1 } from '@lolly-tools/core';
import type {
  ColorMappingV1,
  FontMappingV1,
  PlanActionV1,
  ReplacementV1,
  SlidePlanV1,
  SlideSourceV1,
  SourceObjectV1,
} from '@lolly-tools/core/rebrand-v1';
import { mountBodyPopover, type BodyPopoverHandle } from '../../components/body-popover.ts';
import { promptDialog } from '../../components/confirm-dialog.ts';
import { helpTip, unwireHelpTips, wireHelpTips } from '../../components/help-tip.ts';
import { t, tRaw } from '../../i18n.ts';
import { trapFocus, type FocusTrap } from '../../lib/focus-trap.ts';
import { icon, type IconName } from '../../lib/icons.ts';
import type { RebrandEditOutcomeV1 } from '../../lib/rebrand/controller-api.ts';
import { isBandHead, resolveBands, type Band } from '../../lib/section-bands.ts';
import { segHtml } from '../../lib/seg.ts';
import { layoutName, layoutThumb } from '../../lib/slide-structures-ui.ts';
import { escape as htmlEscape } from '../../utils.ts';
import { archetypeThumbSvg } from '../free-canvas/archetype-thumb.ts';
import { bindOp, type RbCtx } from './context.ts';
import { framesForSlide, layoutFlagWord, objectSnippet, readableTitle, selectedSlideIds, suggestedLayoutOf, unplacedOf } from './shared.ts';

type RbSectionId = 'decision' | 'objects' | 'colours' | 'fonts' | 'layout';

interface DecideState {
  /** The object the scope, the tick and the Replace choices below belong to. */
  forObject: string | null;
  scope: 'one' | 'group';
  includeCorrected: boolean;
  /** The Replace choices, unfolded under the segment. */
  chooser: boolean;
  sheet: boolean;
  sheetOpener: HTMLElement | null;
  /** Unfolded sections with a slide selected, and with an object selected: one open at rest each way. */
  openSlide: Set<RbSectionId>;
  openObject: Set<RbSectionId>;
  /** Folded object rows the person unfolded, by their group key. */
  openGroups: Set<string>;
  busy: boolean;
  /** Learned from the controller's answer: this build does not carry text corrections out yet. */
  textNotBuilt: boolean;
  /** Tab stays inside the narrow sheet while it is open. */
  trap: FocusTrap | null;
  /** The colour rows the last render drew, by their index in the markup. */
  colourRows: ColourRow[];
  /** The font rows the last render drew, by their index in the markup. */
  fontRows: FontRow[];
  /** The swatch grid, while it is open over the column. */
  swatches: BodyPopoverHandle | null;
  /** Fills the object rows' crops as they scroll into the column. */
  observer: IntersectionObserver | null;
  /** The layout chooser was opened from Change layout: focus comes back to it after a pick. */
  changeOpener: boolean;
}

/** Colour uses that share a role, a source colour and a target: one choice. */
interface ColourGroup {
  role: ColorMappingV1['role'];
  /** The first use; the rest share its target and its state. */
  head: ColorMappingV1;
  useIds: string[];
}

/** One row of the Colours section: one group, or several of one role that go to one target. */
interface ColourRow {
  role: ColorMappingV1['role'];
  groups: ColourGroup[];
  head: ColorMappingV1;
  useIds: string[];
}

/** One row of the Fonts section: the faces of one family that go to one target. */
interface FontRow {
  family: string;
  froms: string[];
  to: string;
}

const states = new WeakMap<RbCtx, DecideState>();

function stateOf(rb: RbCtx): DecideState {
  let state = states.get(rb);
  if (!state) {
    state = {
      forObject: null,
      scope: 'one',
      includeCorrected: false,
      chooser: false,
      sheet: false,
      sheetOpener: null,
      openSlide: new Set<RbSectionId>(['layout']),
      openObject: new Set<RbSectionId>(['decision', 'objects']),
      openGroups: new Set<string>(),
      busy: false,
      textNotBuilt: false,
      trap: null,
      colourRows: [],
      fontRows: [],
      swatches: null,
      observer: null,
      changeOpener: false,
    };
    states.set(rb, state);
  }
  return state;
}

// ─── words ───────────────────────────────────────────────────────────────────

/** Who stands behind an object's action, when it is not the rule: a person, an agent or the preset. */
function provenanceText(object: ObjectStateV1): string {
  if (object.author === 'user') return t('Your choice.');
  if (object.author === 'agent') return t('Set by an agent.');
  if (object.author === 'preset') return t('Set by the preset.');
  return '';
}

/**
 * The object's fidelity as a section flag, or nothing when it is editable. A state
 * phrase, never a noun: the head beside it names the object ("Picture on slide 1"), so
 * a flag that read as a noun would give the object a second name. The same words the
 * pane captions use.
 */
export function fidelityFlag(fidelity: ReviewFidelityV1): string {
  if (fidelity === 'picture') return t('Read as a picture');
  if (fidelity === 'approximate') return t('Drawn roughly');
  if (fidelity === 'unavailable') return t('Not drawn');
  return '';
}

function actionLabel(action: PlanActionV1): string {
  if (action === 'replace') return t('Replace');
  if (action === 'remove') return t('Remove');
  return t('Keep');
}

const COLOUR_ROLES: Array<ColorMappingV1['role']> = ['bg', 'ink', 'accent', 'neutral', 'series', 'stroke'];

function roleLabel(role: ColorMappingV1['role']): string {
  switch (role) {
    case 'bg': return t('Backgrounds');
    case 'ink': return t('Text');
    case 'accent': return t('Accents');
    case 'neutral': return t('Neutrals');
    case 'series': return t('Chart series');
    default: return t('Outlines');
  }
}

/** Why a colour has no target, as plain text for a `title`. */
function unresolvedText(reason: NonNullable<ColorMappingV1['unresolved']>): string {
  switch (reason) {
    case 'palette-too-small': return tRaw('The design system has too few colours to keep these apart.');
    case 'contrast-unreachable': return tRaw('No design system colour keeps this text readable.');
    case 'locked-conflict': return tRaw('A locked colour stops this one from being assigned.');
    default: return tRaw('The design system has no colour for this role.');
  }
}

/** The sentence a settled edit is announced with: "Removed 18 objects." */
function decidedText(action: PlanActionV1, count: number): string {
  if (action === 'remove') return count === 1 ? t('Removed 1 object.') : t('Removed {count} objects.', { count });
  if (action === 'replace') return count === 1 ? t('Replaced 1 object.') : t('Replaced {count} objects.', { count });
  return count === 1 ? t('Kept 1 object.') : t('Kept {count} objects.', { count });
}

/**
 * Say how an edit came out. A success is the sentence given, with the members a group
 * apply left alone counted, said through the footer's outcome line (`rb.foot.say`,
 * which also speaks it once through the live region) with the offer of Undo; a refusal
 * says why in one sentence, through the live region.
 */
export function announceOutcome(rb: RbCtx, outcome: RebrandEditOutcomeV1, success: string): void {
  if (outcome.ok) {
    const parts = [success];
    if (outcome.skipped === 1) parts.push(t('1 stayed as it was.'));
    else if (outcome.skipped > 1) parts.push(t('{count} stayed as they were.', { count: outcome.skipped }));
    rb.foot.say(parts.filter(Boolean).join(' '), { undo: true });
    return;
  }
  switch (outcome.refusal) {
    case 'busy': rb.announce(t('Still working. Try again in a moment.')); break;
    case 'stale-revision': rb.announce(tRaw('Changed in another tab. Reload to continue.')); break;
    case 'quota': rb.announce(tRaw('This device has no room left, so the change was not saved.')); break;
    case 'no-plan': rb.announce(t('Choose a deck first.')); break;
    default: rb.announce(t('Nothing changed.'));
  }
}

// ─── the model the column reads ──────────────────────────────────────────────

interface Selected {
  object: ObjectStateV1;
  item: QueueItemV1 | undefined;
  slideNumber: number;
}

/**
 * The selected object, and the queue item a group apply works on: the selected item
 * when it holds the object (a card chosen in the queue, a newer version's card of
 * changed objects included), else the engine item the object belongs to. So "All N
 * marks" always counts the members of the card the person chose.
 */
function selected(rb: RbCtx): Selected | null {
  const id = rb.sel.objectId;
  const object = id ? rb.derived?.objects.get(id) : undefined;
  if (!id || !object) return null;
  const chosen = rb.sel.itemId ? rb.derived?.queue.find((one) => one.id === rb.sel.itemId) : undefined;
  const itemId = chosen?.objectIds.includes(id) ? chosen.id : rb.derived?.itemOfObject.get(id);
  const item = itemId ? rb.derived?.queue.find((one) => one.id === itemId) : undefined;
  const slideNumber = rb.derived?.slides.find((slide) => slide.id === object.slideId)?.number ?? 0;
  return { object, item, slideNumber };
}

/** True when the person reached the object through its own queue card, which already says why. */
function fromCard(rb: RbCtx, pick: Selected): boolean {
  return Boolean(pick.item && rb.sel.itemId === pick.item.id);
}

function sourceSlideOf(rb: RbCtx, slideId: string | null | undefined): SlideSourceV1 | undefined {
  return slideId ? rb.state.source?.slides.find((slide) => slide.id === slideId) : undefined;
}

function sourceObjectOf(rb: RbCtx, objectId: string, slideId: string): SourceObjectV1 | undefined {
  return sourceSlideOf(rb, slideId)?.objects.find((one) => one.id === objectId);
}

/** The selected object's noun, read with its kind from the source deck. */
function pickNoun(rb: RbCtx, pick: Selected): string {
  const slide = sourceSlideOf(rb, pick.object.slideId);
  const object = slide?.objects.find((one) => one.id === pick.object.id);
  const noun = rb.queue.noun(pick.object.class, 'one', true, object?.kind);
  // The name its row in Objects gives it, so the head and the row agree.
  return object && slide ? plainShapeName(object, slide, noun) : noun;
}

/** The members a group apply of this item will touch. */
function groupTargets(item: QueueItemV1, includeCorrected: boolean): string[] {
  const locked = new Set(item.lockedIds);
  const corrected = new Set(item.correctedIds);
  return item.objectIds.filter((id) => !locked.has(id) && (includeCorrected || !corrected.has(id)));
}

function isGroup(item: QueueItemV1 | undefined): item is QueueItemV1 {
  return Boolean(item && item.objectIds.length > 1);
}

function planSlideOf(rb: RbCtx, slideId: string | null): SlidePlanV1 | undefined {
  return slideId ? rb.derived?.plan.slides.find((one) => one.id === slideId) : undefined;
}

/** The slides a slide-level command acts on: the filmstrip's multi-selection, else the slide on screen. */
function slideIdsOf(rb: RbCtx): string[] {
  return selectedSlideIds(rb.sel, rb.derived?.slides ?? []);
}

// ─── markup helpers ──────────────────────────────────────────────────────────

/** Whether a section is unfolded, for the kind of selection on screen. */
function sectionOpen(rb: RbCtx, id: RbSectionId): boolean {
  const state = stateOf(rb);
  return (selected(rb) ? state.openObject : state.openSlide).has(id);
}

/** A flag in the section head: plain words, a count in ink, or a problem with its glyph. */
function flagHtml(text: string, tone: 'plain' | 'ink' | 'danger' = 'plain', title = ''): string {
  if (!text) return '';
  const cls = tone === 'ink' ? ' rb-flag--ink' : tone === 'danger' ? ' rb-flag--danger' : '';
  const glyph = tone === 'danger' ? icon('alert') : '';
  const tip = title ? ` title="${htmlEscape(title)}"` : '';
  return `<em class="lp-sec-flag rb-flag${cls}"${tip}>${glyph}<span>${text}</span></em>`;
}

function section(rb: RbCtx, id: RbSectionId, glyph: IconName, name: string, body: string, flag = ''): string {
  const open = sectionOpen(rb, id);
  return `<section class="lp-sec" data-sec="${id}">`
    + `<button type="button" class="lp-sec-head" data-act="fold" data-fold="${id}" data-key="sec-${id}" aria-expanded="${open}" aria-controls="rb-sec-${id}">`
    + `${icon(glyph)}<span class="lp-sec-name">${name}</span>${flag || '<i></i>'}<i class="lp-caret" aria-hidden="true"></i></button>`
    + `<div class="lp-rows" id="rb-sec-${id}"${open ? '' : ' hidden'}>${body}</div></section>`;
}

function wideRow(control: string, extra = ''): string {
  return `<div class="lp-row lp-row--wide${extra}"><span class="lp-row-icon"></span><div class="lp-control">${control}</div></div>`;
}

/** A help line in its own row, so it starts on the label edge like every other word. */
function help(text: string, id = ''): string {
  return `<div class="lp-row"><span class="lp-row-icon"></span><p class="lp-help"${id ? ` id="${id}"` : ''}>${text}</p></div>`;
}

/**
 * A sub-head inside a section (a colour role, Apply to, Text, Position), on the label
 * edge. The primitive's heading, not its eyebrow: an eyebrow is cut to the label
 * cell, and a sub-head is read whole on a narrow sheet.
 */
function subhead(text: string): string {
  return `<div class="lp-row rb-role"><span class="lp-row-icon"></span><p class="lp-subhead">${text}</p></div>`;
}

const HEX = /^#[0-9a-f]{3,8}$/i;

function swatch(hex: string | undefined, cls = ''): string {
  const safe = hex && HEX.test(hex) ? hex : '';
  return safe
    ? `<span class="rb-sw${cls}" style="--sw:${safe}" aria-hidden="true"></span>`
    : `<span class="rb-sw rb-sw--none${cls}" aria-hidden="true"></span>`;
}

// ─── Decision ────────────────────────────────────────────────────────────────

function chooserHtml(rb: RbCtx, pick: Selected): string {
  const hasLogo = rb.state.designSystem?.hasLogo === true;
  const door = (kind: string, glyph: IconName, label: string, extra = ''): string =>
    `<button type="button" class="lp-door" data-act="replace-with" data-kind="${kind}" data-key="replace-${kind}"${extra}>`
    + `${icon(glyph)}<span>${label}</span>${icon('chevronRight', { className: 'rb-door-go' })}</button>`;
  let html = `<div class="rb-replace" id="rb-replace" data-chooser role="group" aria-label="${t('Replace with')}">`;
  html += door('brand-logo', 'stamp', t('Use the design system mark'), hasLogo ? '' : ' disabled aria-describedby="rb-no-mark"');
  if (!hasLogo) html += `<p class="lp-help" id="rb-no-mark">${t('The design system has no mark yet.')}</p>`;
  html += door('asset', 'image', t('Choose a picture'));
  html += door('placeholder', 'box', t('Add a labelled stand-in'));
  if (pick.object.class === 'photo') {
    html += door('filter', 'sparkle', t('Treat with Filter'));
    html += door('darkroom', 'camera', t('Treat with Darkroom'));
  }
  return `${html}</div>`;
}

/**
 * Apply to, as a two-option segmented control named with the card's own noun ("All 14
 * marks | This mark"), the group first when the person came from the group's card.
 */
function scopeHtml(rb: RbCtx, pick: Selected, item: QueueItemV1): string {
  const state = stateOf(rb);
  const count = groupTargets(item, state.includeCorrected).length;
  const corrected = item.correctedIds.length;
  const locked = item.lockedIds.length;
  const kind = sourceObjectOf(rb, pick.object.id, pick.object.slideId)?.kind;
  const one = rb.queue.noun(pick.object.class, 'one', false, kind);
  const many = rb.queue.noun(pick.object.class, 'many', false, kind);
  // Every matching object locked or changed by hand: the broad option would touch none.
  const empty = count === 0;
  const options = [
    { id: 'group', label: count === 1 ? tRaw('1 {noun}', { noun: one }) : tRaw('All {count} {nouns}', { count, nouns: many }) },
    { id: 'one', label: tRaw('This {noun}', { noun: one }) },
  ];
  if (!fromCard(rb, pick)) options.reverse();
  let seg = segHtml('rb-scope', options, state.scope, '', { variant: 'panel', attr: 'data-scope', extraClass: 'rb-scope-seg', labelledBy: 'rb-scope-head' });
  if (empty) seg = seg.replace('data-scope="group"', 'data-scope="group" aria-disabled="true" aria-describedby="rb-scope-empty"');
  let html = subhead(`<span id="rb-scope-head">${t('Apply to')}</span>`) + wideRow(seg);
  if (empty) html += help(t('Every matching object is locked or changed by hand, so only this one can change.'), 'rb-scope-empty');
  if (corrected > 0) {
    html += wideRow(`<label class="field-toggle rb-choice"><input type="checkbox" class="field-check" data-act="include-corrected" data-key="include-corrected"`
      + `${state.includeCorrected ? ' checked' : ''}><span>${t('Include the {count} changed by hand', { count: corrected })}</span></label>`);
  }
  if (locked > 0) html += help(locked === 1 ? t('1 locked stays.') : t('{count} locked stay.', { count: locked }));
  if (state.scope === 'group' && item.mixedIds.length > 0) {
    html += help(item.mixedIds.length === 1
      ? t('1 of the matching objects has a different action now.')
      : t('{count} of the matching objects have a different action now.', { count: item.mixedIds.length }));
  }
  return html;
}

/**
 * A plain name for a shape by what it looks like (plan 275 F13): a round one is a circle,
 * a hairline is a line, a long thin one is a bar, one that covers a fifth of the slide is
 * a panel. Anything else keeps the queue's noun.
 */
export function plainShapeName(object: SourceObjectV1, slide: { width: number; height: number }, noun: string): string {
  return PLAIN_NAMES[plainShapeKind(object, slide) ?? '']?.[0]() ?? noun;
}

type PlainKind = 'circle' | 'line' | 'bar' | 'panel';

const PLAIN_NAMES: Record<string, [() => string, () => string]> = {
  circle: [() => t('Circle'), () => t('circles')],
  line: [() => t('Line'), () => t('lines')],
  bar: [() => t('Bar'), () => t('bars')],
  panel: [() => t('Panel'), () => t('panels')],
};

function plainShapeKind(object: SourceObjectV1, slide: { width: number; height: number }): PlainKind | null {
  if (object.kind !== 'shape' && object.kind !== 'vector') return null;
  const { w, h } = object.box;
  if (!(w > 0) || !(h > 0) || !(slide.width > 0) || !(slide.height > 0)) return null;
  if (object.geom === 'ellipse') return 'circle';
  const thin = Math.min(w, h);
  const long = Math.max(w, h);
  if (thin <= Math.max(2, Math.min(slide.width, slide.height) * 0.006)) return 'line';
  if (thin / long < 0.12) return 'bar';
  if ((w * h) / (slide.width * slide.height) >= 0.2) return 'panel';
  return null;
}

/** An object's words as the source read them, one line per paragraph. */
function readText(object: SourceObjectV1 | undefined): string {
  return (object?.text?.paras ?? []).map((para) => para.runs.map((run) => run.text).join('')).join('\n');
}

/** Below this mean reading confidence, the correction field says the text was read with low confidence. */
export const LOW_READING_CONFIDENCE = 0.8;

/** The mean confidence of the lines text recognition read in an object, or undefined when nothing was read. */
export function readingConfidence(object: SourceObjectV1 | undefined): number | undefined {
  const lines = object?.ocr?.state === 'text-found' ? object.ocr.lines ?? [] : [];
  if (lines.length === 0) return undefined;
  return lines.reduce((sum, line) => sum + (Number.isFinite(line.confidence) ? line.confidence : 0), 0) / lines.length;
}

function textOverrideOf(rb: RbCtx, objectId: string): string | undefined {
  for (const slide of rb.derived?.plan.slides ?? []) {
    const row = slide.objects.find((one) => one.id === objectId);
    if (row) return row.textOverride;
  }
  return undefined;
}

/**
 * The text field for an object that has words: what was read, or as corrected, in a
 * field that commits when it loses focus. An object with no words (a picture, a shape)
 * has no field. Words read from a picture are named that way in the field's name and tooltip, not
 * in a help line; a reading the recogniser was unsure of is named in words under it.
 */
function textFixHtml(rb: RbCtx, pick: Selected): string {
  const object = sourceObjectOf(rb, pick.object.id, pick.object.slideId);
  const read = readText(object);
  const override = textOverrideOf(rb, pick.object.id);
  if (!object || (!read.trim() && override === undefined)) return '';
  const confidence = readingConfidence(object);
  const low = confidence !== undefined && confidence < LOW_READING_CONFIDENCE;
  const state = stateOf(rb);
  const unavailable = state.textNotBuilt || !rb.controller.setObjectText;
  const off = unavailable || pick.object.locked ? ' disabled' : '';
  const fromPicture = object.ocr?.state === 'text-found';
  const named = fromPicture
    ? ` title="${htmlEscape(tRaw('Read from the picture. Edit it here if a word is wrong.'))}"`
      + ` aria-label="${htmlEscape(tRaw('Text. Read from the picture. Edit it here if a word is wrong.'))}"`
    : '';
  let html = subhead(`<label for="rb-text-fix">${t('Text')}</label>`)
    + wideRow(`<textarea id="rb-text-fix" class="field-input rb-text-fix" rows="3" data-act="object-text" data-key="object-text"`
      + ` data-object-text="${htmlEscape(object.id)}"${named}${low ? ' aria-describedby="rb-text-low"' : ''}${off}>${htmlEscape(override ?? read)}</textarea>`);
  if (low) {
    html += `<div class="lp-row"><span class="lp-row-icon"></span><p class="lp-help rb-text-low" id="rb-text-low">${icon('alert')}<span>${t('This text may be misread.')}</span></p></div>`;
  }
  if (unavailable) html += help(t('Correcting text is not available yet.'));
  else if (override !== undefined) {
    html += help(t('You corrected this text.'))
      + wideRow(`<button type="button" class="btn btn--ghost btn--sm rb-ctl" data-act="object-text-reset" data-key="object-text-reset">${t('Use the text as read')}</button>`);
  }
  return html;
}

function isUnplaced(rb: RbCtx, objectId: string): boolean {
  return unplacedOf(rb.state.preview?.deck, rb.derived, rb.state.source).some((row) => row.objectId === objectId);
}

function decisionSection(rb: RbCtx, pick: Selected): string {
  const state = stateOf(rb);
  const { object, item } = pick;
  const busy = state.busy ? ' aria-busy="true"' : '';
  const disabled = object.locked ? ' disabled' : '';
  // Keep, Replace and Remove are one choice of three: the panel's segmented control.
  // Replace opens its choices, so it carries the glyph for a door, never a caret.
  const act = (action: PlanActionV1): string => {
    const pressed = object.action === action ? 'true' : 'false';
    const opens = action === 'replace' ? ` aria-expanded="${state.chooser}" aria-controls="rb-replace"` : '';
    const glyph = action === 'replace' ? icon('arrowRight', { className: 'rb-act-go' }) : '';
    return `<button type="button" data-act="${action === 'replace' ? 'open-chooser' : 'decide'}"`
      + ` data-action="${action}" data-key="act-${action}" aria-pressed="${pressed}"${opens}${disabled}><span>${actionLabel(action)}</span>${glyph}</button>`;
  };
  let body = wideRow(`<div class="lp-seg rb-acts" role="group" aria-label="${t('Action')}"${busy}>${act('keep')}${act('replace')}${act('remove')}</div>`);
  if (object.locked) body += help(t('This object is locked, so it keeps its decision.'));
  if (state.chooser && !object.locked) body += wideRow(chooserHtml(rb, pick));
  if (isGroup(item) && !object.locked) body += scopeHtml(rb, pick, item);
  body += textFixHtml(rb, pick);
  let flag = flagHtml(fidelityFlag(object.fidelity));
  if (isUnplaced(rb, object.id)) {
    // What blocks the handoff: the danger tone, always with its glyph.
    flag = flagHtml(t('Not placed'), 'danger');
    body += help(t('Goes to the Not placed artboard in Design; Remove takes it out of the deck.'));
  } else if (!fromCard(rb, pick)) {
    // The card said why; reached from the slide, the column says it once.
    const line = [item ? rb.queue.message(item.evidence) : '', provenanceText(object)].filter(Boolean).join(' ');
    if (line) body += help(line);
  }
  return section(rb, 'decision', 'layers', t('Decision'), body, flag);
}

// ─── Objects ─────────────────────────────────────────────────────────────────

interface ObjectRow {
  object: SourceObjectV1;
  action: PlanActionV1;
  /** The action differs from what the rule proposed. */
  own: boolean;
  name: string;
  plural: string;
  snippet: string;
}

/** One list entry: a row, or rows that share a noun, no words and an action, folded. */
interface ObjectEntry {
  key: string;
  rows: ObjectRow[];
}

function objectRows(rb: RbCtx, slide: SlideSourceV1): ObjectRow[] {
  const planRows = new Map((planSlideOf(rb, slide.id)?.objects ?? []).map((row) => [row.id, row]));
  return slide.objects.map((object) => {
    const state = rb.derived?.objects.get(object.id);
    const klass = state?.class ?? 'unknown';
    const plain = plainShapeKind(object, slide);
    const names = plain ? PLAIN_NAMES[plain] : undefined;
    const planRow = planRows.get(object.id);
    return {
      object,
      action: state?.action ?? 'keep',
      own: planRow?.decision !== undefined && planRow.decision !== planRow.proposal,
      name: names ? names[0]() : rb.queue.noun(klass, 'one', true, object.kind),
      plural: names ? names[1]() : rb.queue.noun(klass, 'many', false, object.kind),
      snippet: objectSnippet(object),
    };
  });
}

/** Rows that read the same (five bars with no words, all removed) fold into one entry, in slide order. */
function objectEntries(rows: ObjectRow[]): ObjectEntry[] {
  const out: ObjectEntry[] = [];
  const byKey = new Map<string, ObjectEntry>();
  for (const row of rows) {
    const key = row.snippet ? `one:${row.object.id}` : `group:${row.name}|${row.action}|${row.own}`;
    const found = byKey.get(key);
    if (found) found.rows.push(row);
    else {
      const entry = { key, rows: [row] };
      byKey.set(key, entry);
      out.push(entry);
    }
  }
  return out;
}

/** A crop slot, filled from the shared cache as it scrolls into the column. */
function cropSlot(objectId: string): string {
  return `<span class="rb-obj-pic" data-crop="${htmlEscape(objectId)}" aria-hidden="true"></span>`;
}

function rowButton(rb: RbCtx, row: ObjectRow, name: string, extra = ''): string {
  const current = rb.sel.objectId === row.object.id ? ' aria-current="true"' : '';
  const act = `<span class="rb-obj-act${row.own ? ' rb-obj-act--own' : ''}">${actionLabel(row.action)}</span>`;
  return `<button type="button" class="rb-obj" data-object="${htmlEscape(row.object.id)}" data-act="pick-object" data-rove tabindex="-1"${current}${extra}>`
    + `${cropSlot(row.object.id)}<span class="rb-obj-words"><span class="rb-obj-name">${name}</span>`
    + `${row.snippet ? ` <span class="rb-obj-snip">${htmlEscape(row.snippet)}</span>` : ''}</span>${act}</button>`;
}

function objectListHtml(rb: RbCtx, slide: SlideSourceV1): string {
  const state = stateOf(rb);
  const entries = objectEntries(objectRows(rb, slide));
  const items = entries.map((entry) => {
    const [first] = entry.rows;
    if (!first) return '';
    if (entry.rows.length === 1) return `<li>${rowButton(rb, first, first.name)}</li>`;
    const holds = entry.rows.some((row) => row.object.id === rb.sel.objectId);
    const open = holds || state.openGroups.has(entry.key);
    const members = entry.rows.map((row, i) => `<li>${rowButton(rb, row, t('{noun} {n}', { noun: row.name, n: i + 1 }))}</li>`).join('');
    const count = entry.rows.length;
    // The folded row names the whole group and selects its first member; its members unfold under it.
    return `<li class="rb-obj-group"><button type="button" class="rb-obj rb-obj--group" data-act="pick-group" data-group="${htmlEscape(entry.key)}"`
      + ` data-first="${htmlEscape(first.object.id)}" data-rove tabindex="-1" aria-expanded="${open}">`
      + `${cropSlot(first.object.id)}<span class="rb-obj-words"><span class="rb-obj-name">${t('{count} {nouns}', { count, nouns: first.plural })}</span></span>`
      + `<span class="rb-obj-act${first.own ? ' rb-obj-act--own' : ''}">${actionLabel(first.action)}</span><i class="lp-caret" aria-hidden="true"></i></button>`
      + `<ul class="rb-objs rb-objs--sub" role="list"${open ? '' : ' hidden'}>${members}</ul></li>`;
  }).join('');
  // One Tab stop that Up and Down move through: said once, as the list's description,
  // since a plain list gives no sign that the arrow keys are needed.
  return `<p class="visually-hidden" id="rb-objs-keys">${t('Up and Down move between objects.')}</p>`
    + `<ul class="rb-objs" role="list" aria-label="${t('Objects on this slide')}" aria-describedby="rb-objs-keys">${items}</ul>`;
}

function objectsSection(rb: RbCtx): string {
  const slide = sourceSlideOf(rb, rb.sel.slideId);
  const count = slide?.objects.length ?? 0;
  if (!slide || count === 0) return section(rb, 'objects', 'layers', t('Objects'), `<p class="lp-empty">${t('Nothing on this slide.')}</p>`);
  let body = '';
  if (!rb.sel.objectId) body += help(t('Click an object on the slide, or a row.'));
  body += wideRow(objectListHtml(rb, slide));
  return section(rb, 'objects', 'layers', t('Objects'), body, flagHtml(String(count)));
}

// ─── Colours ─────────────────────────────────────────────────────────────────

/** The select value for a colour row's target: its token path, else its hex, else empty. */
function colourValue(row: ColorMappingV1): string {
  if (row.toPath) return `path:${row.toPath}`;
  return row.to ? `hex:${row.to}` : '';
}

/**
 * A design system colour by name, not by token path: the last segment of
 * `color.brand.primary` in title case, "Primary". A numeric step keeps its parent,
 * so `palette.primary.500` reads "Primary 500".
 */
export function colourName(path: string): string {
  const parts = path.split('.').filter(Boolean);
  const last = parts[parts.length - 1] ?? path;
  const words = /^\d+$/.test(last) && parts.length > 1 ? [parts[parts.length - 2] ?? '', last] : [last];
  return words
    .join(' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * The ramp a design system colour belongs to, for the swatch grid's groups: the path
 * without its last segment (`palette.primary.500` belongs to `palette.primary`).
 */
function rampOf(path: string): string {
  const parts = path.split('.').filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join('.') : '';
}

/**
 * The plan's colour rows grouped by role, source colour and target (the token path, else
 * the hex, else why it is unresolved) and lock, in role order then first appearance.
 */
export function colourGroups(colors: readonly ColorMappingV1[]): ColourGroup[] {
  const out: ColourGroup[] = [];
  for (const role of COLOUR_ROLES) {
    const byKey = new Map<string, ColourGroup>();
    for (const row of colors) {
      if (row.role !== role) continue;
      const target = row.unresolved ? `?${row.unresolved}` : (row.toPath ? `path:${row.toPath}` : `hex:${(row.to ?? '').toLowerCase()}`);
      const key = `${row.from.toLowerCase()}|${target}|${row.locked === true}`;
      const found = byKey.get(key);
      if (found) found.useIds.push(row.useId);
      else {
        const group: ColourGroup = { role, head: row, useIds: [row.useId] };
        byKey.set(key, group);
        out.push(group);
      }
    }
  }
  return out;
}

/**
 * The Colours rows: groups of one role that go to one target, unlocked and resolved,
 * fold into one row ("3 colours to Surface"), since they are one choice; every other
 * group is its own row.
 */
export function colourRows(groups: readonly ColourGroup[]): ColourRow[] {
  const out: ColourRow[] = [];
  const byTarget = new Map<string, ColourRow>();
  for (const group of groups) {
    const row = group.head;
    const foldable = !row.unresolved && row.locked !== true && Boolean(row.to);
    const key = foldable ? `${group.role}|${colourValue(row).toLowerCase()}` : '';
    const found = key ? byTarget.get(key) : undefined;
    if (found) {
      found.groups.push(group);
      found.useIds.push(...group.useIds);
      continue;
    }
    const next: ColourRow = { role: group.role, groups: [group], head: row, useIds: [...group.useIds] };
    if (key) byTarget.set(key, next);
    out.push(next);
  }
  return out;
}

/** The name a target reads as: its design system name, else its hex, else Automatic. */
function targetName(rb: RbCtx, row: ColorMappingV1): string {
  if (row.unresolved || !row.to) return tRaw('Automatic');
  if (row.toPath && rb.state.designSystem?.colors?.[row.toPath] !== undefined) return colourName(row.toPath);
  return row.to;
}

function coloursSection(rb: RbCtx): string {
  const plan = rb.derived?.plan;
  const decideState = stateOf(rb);
  decideState.colourRows = [];
  if (!plan) return '';
  if (plan.colors.length === 0) return section(rb, 'colours', 'palette', t('Colours'), `<p class="lp-empty">${t('This deck has no colours to change.')}</p>`);
  const system = rb.state.designSystem?.colors ?? {};
  const paths = Object.keys(system).sort();
  const unresolvedRows = plan.colors.filter((row) => row.unresolved);
  const unresolved = unresolvedRows.length;
  const rows = colourRows(colourGroups(plan.colors));
  decideState.colourRows = rows;
  // A count to review reads in ink; nothing here blocks the handoff, so never the danger tone.
  const flag = unresolved > 0
    ? flagHtml(t('{count} to check', { count: unresolved }), 'ink')
    : flagHtml(String(rows.length));
  let body = '';
  if (unresolved > 0) {
    const allText = unresolvedRows.every((row) => row.role === 'ink');
    body += help(allText
      ? (unresolved === 1 ? t('1 text colour has no readable match and stays automatic.') : t('{count} text colours have no readable match and stay automatic.', { count: unresolved }))
      : (unresolved === 1 ? t('1 colour has no match and stays automatic.') : t('{count} colours have no match and stay automatic.', { count: unresolved })));
  }
  const tip = helpTip(t('Tries another mix of design system colours. Locked colours stay.'));
  const tipButton = tip.button.replace('aria-label="More info"', `aria-label="${t('About Shuffle')}"`);
  body += `<div class="lp-row lp-row--wide help-tip-host"><span class="lp-row-icon"></span><div class="lp-control">`
    + `<button type="button" class="btn btn--ghost btn--sm rb-ctl" data-act="shuffle" data-key="shuffle">${icon('refresh')}<span>${t('Shuffle')}</span></button>`
    + `${tipButton}</div>${tip.pop}</div>`;
  let role: ColorMappingV1['role'] | null = null;
  rows.forEach((colour, index) => {
    const row = colour.head;
    if (colour.role !== role) {
      role = colour.role;
      body += subhead(roleLabel(colour.role));
    }
    const value = colourValue(row);
    const options = [`<option value=""${value === '' ? ' selected' : ''}>${t('Automatic')}</option>`];
    // A target set by hex alone stays listed so the select shows it; every other choice
    // is a design system colour, by its name.
    if (row.to && !row.toPath && !row.unresolved) options.push(`<option value="hex:${htmlEscape(row.to)}" selected>${htmlEscape(row.to)}</option>`);
    for (const path of paths) {
      options.push(`<option value="path:${htmlEscape(path)}"${value === `path:${path}` ? ' selected' : ''}>${htmlEscape(colourName(path))}</option>`);
    }
    const uses = colour.useIds.length;
    const usesText = uses === 1 ? t('1 use') : t('{count} uses', { count: uses });
    const key = `${colour.role}-${index}`;
    const froms = colour.groups.map((group) => group.head.from);
    const lock = row.to && !row.unresolved
      ? `<button type="button" class="lp-iconbtn rb-lock" data-act="lock" data-row="${index}" data-key="lock-${key}"`
        + ` aria-pressed="${row.locked === true}" aria-label="${t('Lock this colour')}" title="${t('Lock this colour')}">${icon('lock')}</button>`
      : '<span class="rb-lock-slot" aria-hidden="true"></span>';
    const folded = colour.groups.length > 1;
    const source = folded
      ? `<span class="rb-src" title="${htmlEscape(froms.join(', '))}">${t('{count} colours', { count: colour.groups.length })}<span class="rb-uses"> · ${usesText}</span></span>`
      : `<span class="rb-src"><code class="rb-hex">${htmlEscape(row.from.toUpperCase())}</code><span class="rb-uses"> · ${usesText}</span></span>`;
    const glyph = folded
      ? `<span class="rb-sw-stack">${froms.slice(0, 3).map((hex) => swatch(hex)).join('')}</span>`
      : swatch(row.from);
    const noMatch = row.unresolved
      ? `<em class="rb-nomatch" title="${htmlEscape(unresolvedText(row.unresolved))}">${t('No match')}</em>`
      : '';
    const aria = uses === 1
      ? t('Colour for {hex}', { hex: folded ? froms.join(', ') : row.from })
      : t('Colour for {hex}, {count} uses', { hex: folded ? froms.join(', ') : row.from, count: uses });
    // The source is the row's glyph and words; the target is a framed control: its swatch
    // opens the grid for the eye, and the select beside it is the keyboard's way in.
    body += `<div class="rb-colour" data-row="${index}">`
      + `<span class="lp-row-icon">${glyph}</span>`
      + `<div class="rb-colour-src">${source}${noMatch}</div>`
      + `<div class="rb-colour-to"><div class="lp-swatch rb-target">`
      + `<button type="button" class="rb-sw-open" data-act="swatches" data-row="${index}" tabindex="-1" aria-hidden="true" title="${htmlEscape(targetName(rb, row))}">`
      + `${row.unresolved || !row.to ? '<span class="rb-sw rb-sw--auto" aria-hidden="true"></span>' : swatch(row.to)}</button>`
      + `<select data-act="colour" data-row="${index}" data-key="colour-${key}" aria-label="${aria}">${options.join('')}</select></div>${lock}</div>`
      + '</div>';
  });
  return section(rb, 'colours', 'palette', t('Colours'), body, flag);
}

/** Open the swatch grid for one colour row: Automatic first, then the design system colours by ramp. */
function openSwatches(rb: RbCtx, index: number, anchor: HTMLElement): void {
  const state = stateOf(rb);
  const colour = state.colourRows[index];
  if (!colour) return;
  state.swatches?.close();
  const system = rb.state.designSystem?.colors ?? {};
  const ramps = new Map<string, string[]>();
  for (const path of Object.keys(system).sort()) {
    const ramp = rampOf(path);
    ramps.set(ramp, [...(ramps.get(ramp) ?? []), path]);
  }
  const current = colour.head.unresolved ? '' : colourValue(colour.head);
  const tile = (value: string, name: string, hex: string | undefined): string =>
    `<button type="button" class="rb-swatch-tile" data-swatch="${htmlEscape(value)}" aria-pressed="${value === current}" title="${htmlEscape(name)}" aria-label="${htmlEscape(name)}">`
    + (hex ? swatch(hex) : '<span class="rb-sw rb-sw--auto" aria-hidden="true"></span>') + '</button>';
  let html = `<div class="rb-swatch-group"><p class="rb-swatch-name">${t('Automatic')}</p><div class="rb-swatch-row">${tile('', tRaw('Automatic'), undefined)}</div></div>`;
  for (const [ramp, paths] of ramps) {
    const name = ramp ? colourName(ramp) : tRaw('Colours');
    html += `<div class="rb-swatch-group"><p class="rb-swatch-name">${htmlEscape(name)}</p><div class="rb-swatch-row">`
      + paths.map((path) => tile(`path:${path}`, colourName(path), system[path])).join('')
      + '</div></div>';
  }
  const handle = mountBodyPopover(anchor, (box) => {
    box.innerHTML = html;
    box.addEventListener('click', (e) => {
      const pick = (e.target as Element).closest<HTMLElement>('[data-swatch]');
      if (!pick) return;
      handle.close(false);
      void setColourRow(rb, colour, pick.dataset.swatch ?? '');
    });
    box.addEventListener('keydown', (e) => {
      const tiles = [...box.querySelectorAll<HTMLElement>('[data-swatch]')];
      const at = tiles.indexOf(document.activeElement as HTMLElement);
      if (at < 0) return;
      const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      tiles[Math.max(0, Math.min(tiles.length - 1, at + step))]?.focus();
    });
    return box.querySelector<HTMLElement>('[aria-pressed="true"]') ?? box.querySelector<HTMLElement>('[data-swatch]');
  }, {
    className: 'rb-swatch-pop',
    role: 'dialog',
    ariaLabel: t('Choose a colour'),
    onClose: () => { if (state.swatches === handle) state.swatches = null; },
  });
  state.swatches = handle;
  handle.open();
}

/** Set one colour row's target from a select or a swatch value, as one command. */
async function setColourRow(rb: RbCtx, colour: ColourRow, value: string): Promise<void> {
  const system = rb.state.designSystem?.colors ?? {};
  let next: { hex: string; path?: string } | null = null;
  if (value.startsWith('path:')) {
    const path = value.slice(5);
    const hex = system[path];
    if (hex) next = { hex, path };
  } else if (value.startsWith('hex:')) {
    next = { hex: value.slice(4) };
  }
  if (value && !next) return;
  const name = next?.path ? colourName(next.path) : next?.hex ?? '';
  await run(rb, () => rb.controller.setColour(colour.useIds, next), () => (next
    ? tRaw('Colour set to {name}.', { name })
    : t('The colour is automatic again.')));
}

// ─── Fonts ───────────────────────────────────────────────────────────────────

/** Style words a face name carries after its family: "Poppins SemiBold Italic" is Poppins. */
const STYLE_WORDS = /\s+(?:thin|hairline|extra\s*light|ultra\s*light|light|book|regular|normal|medium|semi\s*bold|demi\s*bold|bold|extra\s*bold|ultra\s*bold|heavy|black|italic|oblique|condensed|narrow)$/i;

/** A face's family: its name with the weight and style words taken off the end. */
export function fontFamily(face: string): string {
  let family = face.trim();
  for (let i = 0; i < 4; i += 1) {
    const next = family.replace(STYLE_WORDS, '').replace(/[-\s]+$/, '');
    if (!next || next === family) break;
    family = next;
  }
  return family || face.trim();
}

/** The plan's font rows grouped by family and target, in first appearance. */
export function fontRows(fonts: readonly FontMappingV1[]): FontRow[] {
  const out: FontRow[] = [];
  const byKey = new Map<string, FontRow>();
  for (const row of fonts) {
    const family = fontFamily(row.from);
    const key = `${family.toLowerCase()}|${row.to}`;
    const found = byKey.get(key);
    if (found) found.froms.push(row.from);
    else {
      const next = { family, froms: [row.from], to: row.to };
      byKey.set(key, next);
      out.push(next);
    }
  }
  return out;
}

/** A face name as a CSS family, quoted, or nothing when it holds a character a name never has. */
function cssFamily(face: string): string {
  return /^[\p{L}\p{N} _-]+$/u.test(face) ? `'${face}'` : '';
}

function fontsSection(rb: RbCtx): string {
  const plan = rb.derived?.plan;
  const decideState = stateOf(rb);
  decideState.fontRows = [];
  if (!plan) return '';
  if (plan.fonts.length === 0) return section(rb, 'fonts', 'font', t('Fonts'), `<p class="lp-empty">${t('This deck has no fonts to change.')}</p>`);
  const faces = rb.state.designSystem?.fonts ?? [];
  const rows = fontRows(plan.fonts);
  decideState.fontRows = rows;
  const targets = new Set(plan.fonts.map((row) => row.to));
  const one = targets.size === 1 ? [...targets][0] ?? '' : '';
  const count = plan.fonts.length;
  const flag = one
    ? flagHtml(count === 1 ? t('1 becomes {face}', { face: one }) : t('{count} become {face}', { count, face: one }))
    : flagHtml(String(count));
  const title = readableTitle(rb.derived?.slides.map((slide) => slide.title).find((text) => readableTitle(text)));
  let body = one
    ? `<div class="lp-row"><span class="lp-row-icon"></span><p class="rb-font-all">${count === 1 ? t('The font becomes {face}.', { face: one }) : t('All {count} fonts become {face}.', { count, face: one })}</p></div>`
    : '';
  body += rows.map((row, index) => {
    const options = [...new Set([row.to, ...faces])]
      .map((face) => `<option value="${htmlEscape(face)}"${face === row.to ? ' selected' : ''}>${htmlEscape(face)}</option>`)
      .join('');
    const weights = row.froms.length;
    const name = weights > 1 ? t('{family}, {count} weights', { family: row.family, count: weights }) : htmlEscape(row.froms[0] ?? row.family);
    const family = cssFamily(row.to);
    const specimen = title && family
      ? `<p class="rb-font-specimen" style="font-family:${htmlEscape(family)}" aria-hidden="true">${htmlEscape(title)}</p>`
      : '';
    return `<div class="rb-font"><span class="lp-row-icon"></span><span class="rb-src rb-font-from" title="${htmlEscape(row.froms.join(', '))}">${name}</span>`
      + `<div class="rb-font-to"><select class="field-select" data-act="font" data-row="${index}" data-key="font-${htmlEscape(row.family)}"`
      + ` aria-label="${t('Replacement for {font}', { font: row.family })}">${options}</select></div>${specimen}</div>`;
  }).join('');
  return section(rb, 'fonts', 'font', t('Fonts'), body, flag);
}

// ─── Layout ──────────────────────────────────────────────────────────────────

/** Who set the slide's layout, in one or two words, escaped for markup: the Layout band's flag. */
export function layoutFlagText(slide: Pick<SlidePlanV1, 'layout' | 'layoutSource' | 'arrangement'>, suggested: string | undefined): string {
  return htmlEscape(layoutFlagWord(slide, suggested));
}

/** The slide as Proposed shows it, from the shared cache: the picture a slide built from itself carries. */
function proposedArt(rb: RbCtx, slideId: string): string {
  const deck = rb.state.preview?.deck;
  const frame = deck ? framesForSlide(deck.frames, slideId)[0] : undefined;
  if (!deck || !frame) return '';
  return rb.compare.draw(deck, frame, rb.compare.ladder().thumbnailLongEdge, true).svg;
}

function layoutBody(rb: RbCtx, slide: SlidePlanV1, master: SlideMasterV1 | null): string {
  const ids = slideIdsOf(rb);
  const several = ids.length > 1;
  const source = sourceSlideOf(rb, slide.id);
  const suggested = suggestedLayoutOf(master, slide);
  const arranged = slide.arrangement === 'original' || slide.arrangement === 'picture' ? slide.arrangement : undefined;
  const archetypes = rb.state.designSystem?.archetypes ?? [];
  let art = '';
  let name = '';
  let why = '';
  if (arranged && !several) {
    art = proposedArt(rb, slide.id);
    name = htmlEscape(rb.chooser.arrangementName(arranged, 'state'));
    why = arranged === 'original'
      ? t('The objects stay where they were, in the colours and fonts of the design system.')
      : t('The slide stays exactly as it was.');
  } else {
    // With several slides selected the band offers the slide's suggestion for all of them.
    const shown = several && suggested ? suggested : slide.layout;
    art = master ? layoutThumb(master, shown, 96, archetypeThumbSvg) : '';
    name = master ? htmlEscape(layoutName(master, shown)) : t('Reading the slide layouts');
    const reason = slide.layoutReasons?.[0];
    if (reason && suggested === shown) why = rb.queue.message(reason);
  }
  let body = `<div class="rb-layout-now"><span class="rb-layout-art" aria-hidden="true">${art}</span>`
    + `<div class="rb-layout-words"><strong class="rb-layout-name">${name}</strong>${why ? `<span class="rb-layout-why">${why}</span>` : ''}</div></div>`;
  if (archetypes.length === 0) return body + help(t('The master has no layouts to choose.'));
  // The stage's caption and the boxes already say the text is cut off and how much; this
  // line gives only the way out, so the problem is not said a third time.
  if (!several && rb.compare.cutOff(slide.id).length > 0) body += help(t('Try another layout, or shorten the text.'));
  const button = (act: string, key: string, label: string, extra = ''): string =>
    `<button type="button" class="btn btn--ghost btn--sm rb-ctl" data-act="${act}" data-key="${key}"${extra}>${label}</button>`;
  const acts: string[] = [];
  if (several && suggested && ids.some((id) => planSlideOf(rb, id)?.layout !== suggested)) {
    acts.push(button('apply-suggested', 'layout-apply', t('Apply to {count} slides', { count: ids.length })));
  }
  // Change layout opens the chooser over this column: a door, so it carries the arrow, never a caret.
  acts.push(`<button type="button" class="btn btn--ghost btn--sm rb-ctl" data-act="change-layout" data-key="layout-change" aria-haspopup="dialog" aria-expanded="false"${master ? '' : ' disabled'}>`
    + `<span>${several ? t('Change layout for {count} slides', { count: ids.length }) : t('Change layout')}</span>${icon('arrowRight')}</button>`);
  const arranging = Boolean(rb.controller.setArrangement) && !several;
  if (arranging && arranged !== 'original') acts.push(button('arrange', 'arrange-original', t('Original arrangement'), ' data-arrangement="original"'));
  if (arranging && arranged !== 'picture' && source?.recovery?.assetRef) acts.push(button('arrange', 'arrange-picture', t('Keep as a picture'), ' data-arrangement="picture"'));
  body += wideRow(`<div class="rb-layout-acts">${acts.join('')}</div>`);
  if (several) return body;
  // Position: the same move the filmstrip's drag makes, without a drag, and whether the slide is in the deck.
  const state = rb.derived?.slides.find((one) => one.id === slide.id);
  const orders = (rb.derived?.slides ?? []).filter((one) => one.include).map((one) => one.order);
  const first = Math.min(...orders);
  const last = Math.max(...orders);
  const move = (delta: -1 | 1, label: string, off: boolean): string =>
    `<button type="button" class="btn btn--ghost btn--sm rb-ctl" data-act="move" data-delta="${delta}" data-key="move${delta}"${off ? ' disabled' : ''}>${label}</button>`;
  const include = state?.include !== false;
  const moves = include && state
    ? `${move(-1, t('Move earlier'), state.order <= first)}${move(1, t('Move later'), state.order >= last)}`
    : '';
  body += subhead(t('Position'))
    + wideRow(`<div class="rb-position">${moves ? `<div class="rb-layout-acts">${moves}</div>` : ''}`
      + `<label class="field-toggle rb-include"><input type="checkbox" class="field-check" role="switch" data-act="include" data-key="include"${include ? ' checked' : ''}>`
      + `<span>${t('In the deck')}</span></label></div>`);
  return body;
}

/**
 * The Layout band. It holds one section of its own name, so the band rule is that
 * section's head (`isBandHead`): the band's word, the rule, who set the layout (or, folded
 * under an object, the layout's name) and the caret.
 */
function layoutBand(rb: RbCtx, labelled: boolean): string {
  const slide = planSlideOf(rb, rb.sel.slideId);
  if (!slide) return '';
  const master = rb.chooser.master();
  const open = sectionOpen(rb, 'layout');
  const suggested = suggestedLayoutOf(master, slide);
  const arranged = slide.arrangement === 'original' || slide.arrangement === 'picture' ? slide.arrangement : undefined;
  const flag = open
    ? layoutFlagText(slide, suggested)
    : arranged ? htmlEscape(rb.chooser.arrangementName(arranged, 'state')) : htmlEscape(layoutName(master, slide.layout));
  const body = layoutBody(rb, slide, master);
  if (!labelled) {
    return '<div class="lp-band" data-band="layout" data-sec="layout">'
      + `<button type="button" class="lp-band-head" data-act="fold" data-fold="layout" data-key="sec-layout" aria-expanded="${open}" aria-controls="rb-sec-layout">`
      + `<span class="lp-band-name">${t('Layout')}</span>${flag ? `<em class="lp-sec-flag">${flag}</em>` : '<i></i>'}<i class="lp-caret" aria-hidden="true"></i></button>`
      + `<div class="lp-rows" id="rb-sec-layout"${open ? '' : ' hidden'}>${body}</div></div>`;
  }
  return section(rb, 'layout', 'grid', t('Layout'), body, flagHtml(flag));
}

// ─── render ──────────────────────────────────────────────────────────────────

/**
 * The column's heading for the selection as plain text, which also names the button
 * that opens the sheet. Plain text (tRaw), so each caller escapes it once for its sink.
 */
export function headName(rb: RbCtx): string {
  const pick = selected(rb);
  if (pick) {
    const name = tRaw('{noun} on slide {n}', { noun: pickNoun(rb, pick), n: pick.slideNumber });
    // The narrow sheet's head carries the pressed action, since the segment may be below the fold.
    return rb.narrow ? tRaw('{name} · {action}', { name, action: actionLabel(pick.object.action) }) : name;
  }
  const ids = slideIdsOf(rb);
  if (ids.length > 1) return tRaw('{count} slides', { count: ids.length });
  const slide = rb.derived?.slides.find((one) => one.id === rb.sel.slideId);
  // An empty box picked on the stage is named for itself ("Empty title on slide 3").
  const empty = rb.compare.placeholder();
  if (slide && empty?.name) return tRaw('{noun} on slide {n}', { noun: empty.name, n: slide.number });
  return slide ? tRaw('Slide {n} of {total}', { n: slide.number, total: rb.derived?.slides.length ?? slide.number }) : tRaw('Decision');
}

/** The word a band is shown with. */
function bandWord(band: Band): string {
  switch (band) {
    case 'content': return t('Content');
    case 'style': return t('Style');
    case 'layout': return t('Layout');
    case 'presence': return t('Presence');
    default: return t('More');
  }
}

/**
 * The sections for the selection, grouped into the bands the section vocabulary gives
 * them, in ladder order. The mount after Fonts is the deck theme's Background.
 */
function sectionsHtml(rb: RbCtx): string {
  const pick = selected(rb);
  const builders: Record<string, () => string> = {
    Decision: () => (pick ? decisionSection(rb, pick) : ''),
    Objects: () => objectsSection(rb),
    Colours: () => coloursSection(rb),
    Fonts: () => fontsSection(rb),
    Background: () => '<div class="rb-style-mount" data-style-mount></div>',
  };
  const names = [...(pick ? ['Decision'] : []), 'Objects', 'Colours', 'Fonts', 'Background', 'Layout'];
  const bands = resolveBands(names);
  const order: Band[] = [];
  const byBand = new Map<Band, string[]>();
  for (const name of names) {
    const band = bands.get(name) ?? 'content';
    if (!byBand.has(band)) {
      byBand.set(band, []);
      order.push(band);
    }
    byBand.get(band)?.push(name);
  }
  return order.map((band) => {
    const inBand = byBand.get(band) ?? [];
    if (inBand.includes('Layout')) {
      const others = inBand.filter((name) => name !== 'Layout').map((name) => builders[name]?.() ?? '').join('');
      if (isBandHead(band, inBand)) return layoutBand(rb, false);
      const label = `<p class="lp-band-label">${bandWord(band)}</p>`;
      return `<div class="lp-band" data-band="${band}">${label}${others}${layoutBand(rb, true)}</div>`;
    }
    const inner = inBand.map((name) => builders[name]?.() ?? '').join('');
    return inner ? `<div class="lp-band" data-band="${band}"><p class="lp-band-label">${bandWord(band)}</p>${inner}</div>` : '';
  }).join('');
}

/** Draw one crop slot from the shared cache. A picture still loading draws again on the next state change. */
function fillCrop(rb: RbCtx, slot: HTMLElement): void {
  const objectId = slot.dataset.crop;
  if (!objectId) return;
  const drawn = rb.compare.crop(objectId, 4 / 3);
  if (drawn.missing) rb.memo.decide = '';
  slot.innerHTML = drawn.svg;
}

/** Fill the object rows' crops as they scroll into the column, or the first few where nothing observes. */
function fillCrops(rb: RbCtx): void {
  const state = stateOf(rb);
  const scroller = rb.els.decide.querySelector<HTMLElement>('.lp-scroll');
  const slots = [...rb.els.decide.querySelectorAll<HTMLElement>('.rb-obj-pic[data-crop]')];
  state.observer?.disconnect();
  state.observer = null;
  if (slots.length === 0) return;
  if (typeof IntersectionObserver === 'function' && scroller) {
    state.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const slot = entry.target as HTMLElement;
        if (entry.isIntersecting && !slot.firstChild) fillCrop(rb, slot);
      }
    }, { root: scroller, rootMargin: '200px' });
    for (const slot of slots) state.observer.observe(slot);
    return;
  }
  for (const slot of slots.slice(0, 24)) fillCrop(rb, slot);
}

/** The object list is one Tab stop: the current row, else the first. */
function setRove(rb: RbCtx): void {
  const rows = [...rb.els.decide.querySelectorAll<HTMLElement>('.rb-objs [data-rove]')].filter((row) => !row.closest('[hidden]'));
  const stop = rows.find((row) => row.getAttribute('aria-current') === 'true') ?? rows[0];
  for (const row of rows) row.tabIndex = row === stop ? 0 : -1;
}

export function renderDecide(rb: RbCtx): void {
  const state = stateOf(rb);
  const region = rb.els.decide;
  if (!rb.derived) return;
  if (state.forObject !== rb.sel.objectId) {
    state.forObject = rb.sel.objectId;
    state.scope = 'one';
    state.includeCorrected = false;
    state.chooser = false;
  }
  if (!rb.narrow) state.sheet = false;
  const sheet = rb.narrow ? (state.sheet ? 'open' : 'closed') : '';
  if (sheet) region.dataset.sheet = sheet;
  else delete region.dataset.sheet;
  if (sheet === 'open') {
    region.setAttribute('role', 'dialog');
    region.setAttribute('aria-modal', 'false');
  } else {
    region.removeAttribute('role');
    region.removeAttribute('aria-modal');
  }
  // The head names the column; aria-label="Decision" stays on the aside as the fallback.
  region.setAttribute('aria-labelledby', 'rb-decide-name');
  const key = [
    rb.derived.plan.revision,
    rb.sel.objectId,
    rb.sel.slideId,
    rb.sel.itemId,
    rb.compare.placeholder()?.layerId ?? '',
    slideIdsOf(rb).join(','),
    rb.narrow,
    sheet,
    state.scope,
    state.includeCorrected,
    state.chooser,
    state.busy,
    [...state.openSlide].join(','),
    [...state.openObject].join(','),
    [...state.openGroups].join(','),
    state.textNotBuilt,
    Boolean(rb.chooser.master()),
    rb.state.designSystem?.id ?? '',
    rb.state.source?.source.instanceId ?? '',
    rb.state.preview ? `${rb.state.preview.planRevision}:${rb.state.preview.deck.tray.length}` : '',
  ].join('|');
  if (rb.memo.decide === key && lastPlan.get(rb) === rb.derived.plan) {
    rb.chooser.sync();
    return;
  }
  rb.memo.decide = key;
  lastPlan.set(rb, rb.derived.plan);
  const memo = rb.keys.capture(region, '[data-key], [data-object]', 'key');
  // A correction being typed survives a redraw that comes from somewhere else.
  const typing = region.querySelector<HTMLTextAreaElement>('textarea[data-object-text]');
  const draft = typing && typing.value !== typing.defaultValue ? { id: typing.dataset.objectText ?? '', value: typing.value } : null;
  const scroll = region.querySelector<HTMLElement>('.lp-scroll')?.scrollTop ?? 0;
  const close = rb.narrow
    ? `<button type="button" class="lp-iconbtn" data-act="close-sheet" data-key="close-sheet" aria-label="${t('Close')}">${icon('close')}</button>`
    : '';
  const grip = rb.narrow ? '<span class="rb-sheet-grip" aria-hidden="true"></span>' : '';
  region.innerHTML = `<div class="lp rb-lp">${grip}`
    + `<div class="lp-head"><h2 class="lp-head-name" id="rb-decide-name">${htmlEscape(headName(rb))}</h2>${close}</div>`
    + '<div class="lp-scroll">'
    + sectionsHtml(rb)
    + '</div></div>';
  const style = region.querySelector<HTMLElement>('[data-style-mount]');
  if (style) rb.theme.renderStyle(style);
  const field = region.querySelector<HTMLTextAreaElement>('textarea[data-object-text]');
  if (draft && field && field.dataset.objectText === draft.id) field.value = draft.value;
  setRove(rb);
  fillCrops(rb);
  const scroller = region.querySelector<HTMLElement>('.lp-scroll');
  if (scroller) scroller.scrollTop = scroll;
  rb.keys.restore(region, '[data-key], [data-object]', 'key', memo);
  returnToChange(rb);
  rb.chooser.sync();
}

/**
 * After a pick in the chooser Change layout opened, the redraw for the new plan replaced
 * the button the popover gives focus back to; focus goes to its successor, or to the
 * Layout band's head when the band is folded, rather than being left on the page.
 */
function returnToChange(rb: RbCtx): void {
  const state = stateOf(rb);
  if (!state.changeOpener || rb.chooser.isOpen()) return;
  state.changeOpener = false;
  const active = typeof document === 'undefined' ? null : document.activeElement;
  if (active && active !== document.body && active.isConnected) return;
  const change = rb.els.decide.querySelector<HTMLElement>('[data-key="layout-change"]');
  (change && !change.closest('[hidden]') ? change : rb.els.decide.querySelector<HTMLElement>('[data-key="sec-layout"]'))?.focus();
}

/** The plan a decide render last drew, so a new plan always redraws. */
const lastPlan = new WeakMap<RbCtx, object>();

// ─── commands ────────────────────────────────────────────────────────────────

/** Run one controller command, keep the column quiet while it runs, then say how it went. */
async function run(rb: RbCtx, command: () => Promise<RebrandEditOutcomeV1>, success: (outcome: RebrandEditOutcomeV1) => string): Promise<void> {
  const state = stateOf(rb);
  if (state.busy) {
    rb.announce(t('Still working. Try again in a moment.'));
    return;
  }
  state.busy = true;
  renderDecide(rb);
  try {
    const outcome = await command();
    announceOutcome(rb, outcome, outcome.ok ? success(outcome) : '');
  } finally {
    state.busy = false;
    renderDecide(rb);
  }
}

/**
 * Keep, Replace or Remove over the selected object or its group, as the scope says. A
 * group apply always includes the object the person is looking at (unless it is
 * locked), and says how many members stayed as they were, counting the locked and
 * hand-changed ones the view left out.
 */
async function decide(rb: RbCtx, action: PlanActionV1, replacement?: ReplacementV1): Promise<void> {
  const state = stateOf(rb);
  const pick = selected(rb);
  if (!pick) return;
  const group = state.scope === 'group' && isGroup(pick.item) ? pick.item : null;
  let input: { objectIds: string[]; action: PlanActionV1; scope?: string; includeCorrected: boolean };
  if (group) {
    const targets = groupTargets(group, state.includeCorrected);
    const own = pick.object.id;
    const ownLeftOut = !pick.object.locked && !targets.includes(own);
    // The only member the filter took out on account of a hand change is the one on
    // screen, so it can go in with includeCorrected set: every other target passed.
    input = ownLeftOut
      ? { objectIds: [own, ...targets], action, scope: group.id, includeCorrected: true }
      : { objectIds: targets, action, scope: group.id, includeCorrected: state.includeCorrected };
  } else {
    input = { objectIds: [pick.object.id], action, includeCorrected: true };
  }
  const withReplacement = replacement ? { ...input, replacement } : input;
  const members = group ? group.objectIds.length : 1;
  const itemId = rb.sel.itemId;
  state.chooser = false;
  await run(
    rb,
    async () => {
      const outcome = await rb.controller.decide(withReplacement);
      return outcome.ok && group ? { ...outcome, skipped: Math.max(0, members - outcome.touched) } : outcome;
    },
    (outcome) => decidedText(action, outcome.touched),
  );
  nextAfterSettled(rb, itemId);
}

/**
 * Once the selected queue item has nothing left waiting it leaves the To review list
 * (settled, or gone, as a newer version's card of changed objects goes once each has
 * its answer), so the selection moves on to the next item that still needs a person,
 * in queue order.
 */
function nextAfterSettled(rb: RbCtx, itemId: string | null): void {
  const derived = rb.derived;
  if (!derived || !itemId || rb.sel.itemId !== itemId) return;
  const waiting = new Set(rb.foot.reviewItems().map((one) => one.id));
  if (waiting.has(itemId)) return;
  const at = derived.queue.findIndex((item) => item.id === itemId);
  const rest = at === -1 ? derived.queue : [...derived.queue.slice(at + 1), ...derived.queue.slice(0, at)];
  const next = rest.find((one) => one.section === 'attention' && waiting.has(one.id));
  if (!next) return;
  rb.select({ itemId: next.id, objectId: next.exemplar, slideId: derived.objects.get(next.exemplar)?.slideId ?? next.slideIds[0] ?? null });
}

/** The replacement one chooser option stands for, asking what it needs first. */
async function replacementFor(rb: RbCtx, kind: string): Promise<ReplacementV1 | null> {
  switch (kind) {
    case 'brand-logo':
      return { kind: 'brand-logo', variant: 'auto' };
    case 'filter':
      return { kind: 'filter', toolId: 'filter' };
    case 'darkroom':
      return { kind: 'filter', toolId: 'darkroom' };
    case 'asset': {
      if (rb.state.phase !== 'review') {
        rb.announce(t('Wait for the deck to finish reading, then choose a picture.'));
        return null;
      }
      const ref = await rb.host.assets.pick({ title: t('Choose a picture'), allowUpload: true });
      if (!ref) return null;
      return ref.source === 'user' ? { kind: 'supplied-picture', assetRef: ref.id } : { kind: 'asset', id: ref.id };
    }
    case 'placeholder': {
      const pick = selected(rb);
      const label = await promptDialog({
        title: t('Label the stand-in'),
        message: t('The label shows on the slide where the picture goes.'),
        value: pick ? pickNoun(rb, pick) : '',
        confirmLabel: t('Use stand-in'),
      });
      const text = label?.trim();
      return text ? { kind: 'placeholder', label: text } : null;
    }
    default:
      return null;
  }
}

function focusIn(rb: RbCtx, key: string): void {
  [...rb.els.decide.querySelectorAll<HTMLElement>('[data-key]')].find((el) => el.dataset.key === key)?.focus();
}

function toggleSection(rb: RbCtx, id: string | undefined): void {
  if (id !== 'decision' && id !== 'objects' && id !== 'colours' && id !== 'fonts' && id !== 'layout') return;
  const state = stateOf(rb);
  const open = selected(rb) ? state.openObject : state.openSlide;
  if (open.has(id)) open.delete(id);
  else open.add(id);
  renderDecide(rb);
}

async function onClick(rb: RbCtx, e: MouseEvent): Promise<void> {
  const state = stateOf(rb);
  const origin = e.target as Element;
  const scopeButton = origin.closest<HTMLElement>('[data-scope]');
  if (scopeButton && rb.els.decide.contains(scopeButton)) {
    if (scopeButton.getAttribute('aria-disabled') === 'true') return;
    state.scope = scopeButton.dataset.scope === 'group' ? 'group' : 'one';
    renderDecide(rb);
    rb.els.decide.querySelector<HTMLElement>(`[data-scope="${state.scope}"]`)?.focus();
    return;
  }
  const target = origin.closest<HTMLElement>('[data-act]');
  if (!target || !rb.els.decide.contains(target)) return;
  const act = target.dataset.act;
  if (act === 'fold') {
    toggleSection(rb, target.dataset.fold);
    return;
  }
  if (act === 'pick-object') {
    const objectId = target.dataset.object;
    if (!objectId) return;
    rb.select({ objectId, slideId: rb.derived?.objects.get(objectId)?.slideId ?? rb.sel.slideId, itemId: rb.derived?.itemOfObject.get(objectId) ?? null });
    return;
  }
  if (act === 'pick-group') {
    const key = target.dataset.group ?? '';
    const first = target.dataset.first ?? '';
    const members = [...(target.parentElement?.querySelectorAll<HTMLElement>('.rb-objs--sub [data-object]') ?? [])].map((row) => row.dataset.object);
    // Unfolded around the current object: fold it. Otherwise open it on its first member.
    if (target.getAttribute('aria-expanded') === 'true' && members.includes(rb.sel.objectId ?? '')) {
      state.openGroups.delete(key);
      rb.select({ objectId: null, itemId: null });
      return;
    }
    state.openGroups.add(key);
    rb.select({ objectId: first, slideId: rb.derived?.objects.get(first)?.slideId ?? rb.sel.slideId, itemId: rb.derived?.itemOfObject.get(first) ?? null });
    return;
  }
  if (act === 'decide') {
    const action = target.dataset.action;
    if (action === 'keep' || action === 'remove') await decide(rb, action);
    return;
  }
  if (act === 'open-chooser') {
    state.chooser = !state.chooser;
    renderDecide(rb);
    if (state.chooser) rb.els.decide.querySelector<HTMLElement>('[data-chooser] button:not([disabled])')?.focus();
    else focusIn(rb, 'act-replace');
    return;
  }
  if (act === 'replace-with') {
    const replacement = await replacementFor(rb, target.dataset.kind ?? '');
    if (!replacement) return;
    await decide(rb, 'replace', replacement);
    focusIn(rb, 'act-replace');
    return;
  }
  if (act === 'close-sheet') {
    closeSheet(rb);
    return;
  }
  if (act === 'object-text-reset') {
    const objectId = rb.sel.objectId;
    if (objectId) await correctText(rb, objectId, null);
    return;
  }
  if (act === 'change-layout') {
    const ids = slideIdsOf(rb);
    // Docked over this column, so the Proposed pane its hover previews into stays in view.
    if (ids.length > 0) {
      state.changeOpener = true;
      rb.chooser.open(ids, 'inline', target);
    }
    return;
  }
  if (act === 'apply-suggested') {
    const slide = planSlideOf(rb, rb.sel.slideId);
    const layout = slide ? suggestedLayoutOf(rb.chooser.master(), slide) : undefined;
    if (layout) await rb.chooser.apply(slideIdsOf(rb), layout);
    return;
  }
  if (act === 'arrange') {
    const arrangement = target.dataset.arrangement;
    const slideId = rb.sel.slideId;
    if (slideId && (arrangement === 'original' || arrangement === 'picture')) await rb.chooser.arrange([slideId], arrangement);
    return;
  }
  if (act === 'move') {
    const slide = rb.derived?.slides.find((one) => one.id === rb.sel.slideId);
    const delta = Number(target.dataset.delta);
    if (!slide || (delta !== -1 && delta !== 1)) return;
    const position = Math.max(1, slide.order + 1 + delta);
    await run(rb, () => rb.controller.move(slide.id, delta), () => t('Moved slide {n} to position {position}.', { n: slide.number, position }));
    return;
  }
  if (act === 'shuffle') {
    await run(rb, () => rb.controller.shuffleColours(), () => t('Shuffled the colours. Locked colours stayed.'));
    return;
  }
  if (act === 'swatches') {
    openSwatches(rb, Number(target.dataset.row), target);
    return;
  }
  if (act === 'lock') {
    const colour = state.colourRows[Number(target.dataset.row)];
    const row = colour?.head;
    if (!colour || !row?.to) return;
    const lock = row.locked !== true;
    const hexTarget = row.toPath ? { hex: row.to, path: row.toPath } : { hex: row.to };
    await run(rb, () => rb.controller.setColour(colour.useIds, hexTarget, lock), () => (lock ? t('Colour locked.') : t('Colour unlocked.')));
  }
}

/** Up, Down, Home and End move along the object list, which is one Tab stop. */
function onKeydown(rb: RbCtx, e: KeyboardEvent): void {
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
  const current = (e.target as Element).closest<HTMLElement>('.rb-objs [data-rove]');
  if (!current || !rb.els.decide.contains(current)) return;
  const rows = [...rb.els.decide.querySelectorAll<HTMLElement>('.rb-objs [data-rove]')].filter((row) => !row.closest('[hidden]'));
  const at = rows.indexOf(current);
  if (at < 0) return;
  const next = e.key === 'Home' ? rows[0] : e.key === 'End' ? rows[rows.length - 1] : rows[Math.max(0, Math.min(rows.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))];
  e.preventDefault();
  e.stopPropagation();
  if (!next) return;
  for (const row of rows) row.tabIndex = row === next ? 0 : -1;
  next.focus();
}

/**
 * Put a text object's words right, or back to what was read (`null`). One controller
 * command, so one undo step. A build that does not carry corrections out yet is
 * named as such, and the field is disabled with that reason from then on.
 */
async function correctText(rb: RbCtx, objectId: string, text: string | null): Promise<void> {
  const state = stateOf(rb);
  const command = rb.controller.setObjectText;
  if (!command) return;
  await run(rb, async () => {
    const outcome = await command(objectId, text);
    if (!outcome.ok && outcome.refusal === 'not-built') state.textNotBuilt = true;
    return outcome;
  }, () => (text === null ? t('The text is back to what was read.') : t('Text corrected.')));
  if (state.textNotBuilt) rb.announce(t('Correcting text is not available yet.'));
}

async function onChange(rb: RbCtx, e: Event): Promise<void> {
  const state = stateOf(rb);
  const target = e.target;
  // Read by tag, not by constructor: a textarea is the one control here without a global in every host.
  if (target instanceof HTMLElement && target.tagName === 'TEXTAREA' && target.dataset.act === 'object-text') {
    const field = target as HTMLTextAreaElement;
    const objectId = field.dataset.objectText ?? '';
    const object = rb.sel.slideId ? sourceObjectOf(rb, objectId, rb.sel.slideId) : undefined;
    const read = readText(object);
    const next = field.value === read ? null : field.value;
    if (!objectId || next === (textOverrideOf(rb, objectId) ?? null)) return;
    await correctText(rb, objectId, next);
    return;
  }
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
  const act = target.dataset.act;
  if (act === 'include-corrected' && target instanceof HTMLInputElement) {
    state.includeCorrected = target.checked;
    renderDecide(rb);
    return;
  }
  if (act === 'include' && target instanceof HTMLInputElement) {
    const slideId = rb.sel.slideId;
    const slide = slideId ? rb.derived?.slides.find((one) => one.id === slideId) : undefined;
    if (!slideId || !slide) return;
    const include = target.checked;
    await run(rb, () => rb.controller.include([slideId], include), () => (include
      ? t('Slide {n} is in the deck again.', { n: slide.number })
      : t('Slide {n} is left out.', { n: slide.number })));
    return;
  }
  if (act === 'colour' && target instanceof HTMLSelectElement) {
    const colour = state.colourRows[Number(target.dataset.row)];
    if (colour) await setColourRow(rb, colour, target.value);
    return;
  }
  if (act === 'font' && target instanceof HTMLSelectElement) {
    const row = state.fontRows[Number(target.dataset.row)];
    const to = target.value;
    if (!row) return;
    const froms = row.froms;
    // One command per face; a family of several faces says its family once.
    await run(rb, async () => {
      let touched = 0;
      for (const from of froms) {
        const outcome = await rb.controller.setFont(from, to);
        if (!outcome.ok) return outcome;
        touched += outcome.touched;
      }
      return { ok: true, touched, skipped: 0 };
    }, () => tRaw('Text in {from} now uses {to}.', { from: froms.length > 1 ? row.family : froms[0] ?? row.family, to }));
  }
}

export function wireDecide(rb: RbCtx): void {
  const region = rb.els.decide;
  const click = (e: MouseEvent): void => { void onClick(rb, e); };
  const change = (e: Event): void => { void onChange(rb, e); };
  const keydown = (e: KeyboardEvent): void => { onKeydown(rb, e); };
  region.addEventListener('click', click);
  region.addEventListener('change', change);
  region.addEventListener('keydown', keydown);
  wireHelpTips(region);
  rb.disposers.push(() => {
    region.removeEventListener('click', click);
    region.removeEventListener('change', change);
    region.removeEventListener('keydown', keydown);
    unwireHelpTips(region);
    const state = stateOf(rb);
    state.trap?.release();
    state.swatches?.close();
    state.observer?.disconnect();
  });
}

// ─── overlays: the choosers and the narrow sheet ─────────────────────────────

/** True while a chooser over or in the column is open: the swatch grid, the Replace choices, or the layout chooser. */
export function chooserOpen(rb: RbCtx): boolean {
  const state = stateOf(rb);
  return Boolean(state.swatches?.isOpen()) || state.chooser || rb.chooser.isOpen();
}

/** Close the topmost chooser: the swatch grid, the layout popover, then the Replace choices. */
export function closeChooser(rb: RbCtx): void {
  const state = stateOf(rb);
  if (state.swatches?.isOpen()) {
    state.swatches.close(true);
    state.swatches = null;
    return;
  }
  if (rb.chooser.isOpen()) {
    rb.chooser.close();
    return;
  }
  if (!state.chooser) return;
  state.chooser = false;
  renderDecide(rb);
  focusIn(rb, 'act-replace');
}

export function sheetOpen(rb: RbCtx): boolean {
  return rb.narrow && stateOf(rb).sheet;
}

/**
 * Open the narrow sheet for the selection: an object, or a slide alone (its Layout,
 * Colours and Fonts sections). `opener` gets focus back when it closes. Tab stays in
 * the sheet while it is open, so nothing it covers takes focus unseen.
 */
export function openSheet(rb: RbCtx, opener?: HTMLElement): void {
  const state = stateOf(rb);
  if (!rb.narrow || (!rb.sel.objectId && !rb.sel.slideId)) return;
  const active = typeof document === 'undefined' ? null : document.activeElement;
  state.sheetOpener = opener ?? (active instanceof HTMLElement ? active : null);
  state.sheet = true;
  rb.render();
  state.trap?.release();
  state.trap = trapFocus(rb.els.decide, { inertBackground: false });
  focusIn(rb, 'close-sheet');
}

export function closeSheet(rb: RbCtx): void {
  const state = stateOf(rb);
  if (!state.sheet) return;
  state.sheet = false;
  state.chooser = false;
  state.trap?.release();
  state.trap = null;
  rb.render();
  const back = state.sheetOpener;
  state.sheetOpener = null;
  if (back?.isConnected) {
    back.focus();
    return;
  }
  // What opened the sheet went with a redraw: the current queue row, else the first.
  const queue = rb.els.queue;
  const target = queue.querySelector<HTMLElement>('[aria-current="true"]')
    ?? queue.querySelector<HTMLElement>('.rb-q-item, .rb-q-chip');
  if (target) target.focus();
  else {
    queue.tabIndex = -1;
    queue.focus();
  }
}

export function decideOps(rb: RbCtx) {
  return {
    wire: bindOp(rb, wireDecide),
    render: bindOp(rb, renderDecide),
    announceOutcome: bindOp(rb, announceOutcome),
    chooserOpen: bindOp(rb, chooserOpen),
    closeChooser: bindOp(rb, closeChooser),
    sheetOpen: bindOp(rb, sheetOpen),
    headName: bindOp(rb, headName),
    openSheet: bindOp(rb, openSheet),
    closeSheet: bindOp(rb, closeSheet),
  };
}
