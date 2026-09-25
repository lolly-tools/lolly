// SPDX-License-Identifier: MPL-2.0
/**
 * rebrand: the layout chooser (plan 275 section 4, decisions 27, 28, 30 and 31; close-out
 * section 3.6).
 *
 * One grid of layout wireframes, the one Design shows (`lib/slide-structures-ui.ts`),
 * shown as one thing: a popover that `rb.chooser.open` docks over the decision column, so
 * the Proposed pane it previews into stays in view beside it. Four places open it: the
 * column's Change layout button (`inline`), the L key and the filmstrip's menu (`menu`),
 * and a thumbnail's layout pill (`chip`). It closes on Escape, a pick or a click outside,
 * and the focus goes back to what opened it.
 *
 * The first group is "This slide": the ways back to the slide as it was, drawn from the
 * slide itself (Original arrangement, the kept objects where the source had them in the
 * colours and fonts of the design system, and Keep as a picture, the slide exactly as it
 * was, with a picture badge so the two differ at a glance), then Current, the matcher's
 * Suggested and its Also fits. The bands follow. Every tile follows one rule: flat on the
 * popover, a ring on hover, and the current one ringed and tinted with a check in its
 * caption. A layout that would pour the slide onto more slides than the current one does
 * carries the count as a muted suffix on its name ("Title slide +2"), measured by
 * compiling the slide alone for each layout; the words stay as its description. A slide
 * built one of the arrangement ways keeps its layout on the row, pinned as Last used, and
 * picking that tile goes back to it.
 *
 * Resting the pointer or the focus on a tile previews it in the Proposed pane after a
 * short wait, without writing to the plan: the slide is compiled alone, in the view,
 * through the same engine compile the controller's stage runs, and drawn in the design
 * system's faces once they are loaded (close-out section 9.2). Escape, or leaving the
 * grid, puts the committed slide back. A click or Enter applies at once through
 * `rb.controller.setLayout`, as one undo step, and the pane keeps showing that layout
 * until the controller's own preview of the new plan arrives, so the slide changes on
 * the next render rather than after the whole deck recompiles.
 *
 * Auto-match layouts has its row under the search, once the controller carries it: the
 * layouts it would set as small wireframes, each with its count and unit, and the button
 * that runs it as one undo step. Resting on the button previews the slide on screen under
 * its match. It is the one action that applies a match; without it a match stays a
 * suggestion. A controller with no such command shows no Auto-match anywhere, the
 * filmstrip included.
 *
 * The Proposed pane is `compare.ts`'s region. The preview is one element this module
 * puts beside the pane's frames while it shows and takes away after, and the pane's
 * frames are hidden meanwhile; nothing of compare's own is redrawn from here.
 */
import { mountBodyPopover, pointAnchor, type BodyPopoverHandle, type PopoverAnchor } from '../../components/body-popover.ts';
import {
  autoMatchPreview,
  compileRenovated,
  framePreviewSvg,
  neutralSlideMaster,
  resolveRebrandDesignSystem,
  slidesSharingSourceLayout,
  type RebrandDesignSystemV1,
} from '@lolly/engine';
import type { ArchetypeRefV1, CompiledFrameV1, RenovationPlanV1, SlideArrangementV1, SlideMasterV1, SlidePlanV1 } from '@lolly-tools/core';
import { t, tRaw } from '../../i18n.ts';
import { icon } from '../../lib/icons.ts';
import { previewPlanOf } from '../../lib/rebrand/controller.ts';
import { resolveActiveDesignSystem } from '../../lib/rebrand/design-system.ts';
import {
  PREVIEW_DELAY_MS,
  buildLayoutChooser,
  layoutName,
  layoutThumb,
  layoutTiles,
  svgNode,
  tileIdOf,
  type LayoutChooserHandle,
  type LayoutTile,
  type LeadingTile,
  type LayoutTileExtra,
  type LayoutTileMark,
} from '../../lib/slide-structures-ui.ts';
import { archetypeThumbSvg } from '../free-canvas/archetype-thumb.ts';
import { bindOp, type RbCtx } from './context.ts';
import { framesForSlide, suggestedLayoutOf } from './shared.ts';

/**
 * Where the chooser was opened from: the column's Change layout button (`inline`), the
 * filmstrip's menu or the L key (`menu`), or a thumbnail's layout pill (`chip`). Each opens
 * the same popover, and the focus goes back to the opener when it closes.
 */
export type RbChooserEntry = 'inline' | 'menu' | 'chip';

/** The tile width the chooser draws its wireframes at, in px. */
const TILE_WIDTH = 96;

/** The width of a wireframe in the Auto-match tally, in px: small enough to draw no marks. */
const TALLY_WIDTH = 40;

/** A drawing this long or shorter, in px, is drawn at the engine's thumbnail detail. */
const THUMB_DETAIL_MAX = 200;

/** Compiled previews kept at once: every layout of one slide, twice over. */
const COMPILE_CACHE_MAX = 160;

interface SystemSlot {
  key: string;
  value: RebrandDesignSystemV1 | null | undefined;
}

interface PopoverSlot {
  handle: BodyPopoverHandle;
  slideIds: string[];
  entry: RbChooserEntry;
  chooser: LayoutChooserHandle | null;
}

interface ChooserState {
  system: SystemSlot | null;
  pop: PopoverSlot | null;
  query: string;
  /** "Also the N slides like this one", ticked, and the slide whose toggle it was. */
  similar: boolean;
  similarFor: string | null;
  /** The layout under the pointer or the focus, shown in the Proposed pane. */
  preview: { slideId: string; key: string } | null;
  /** A layout or an arrangement just applied (a tile key), shown until the controller's preview of the new plan arrives. */
  pending: { slideId: string; layout: string; revision: number } | null;
  compiled: Map<string, CompiledFrameV1[] | null>;
  /** Learned from the controller's answer: the build does not carry Auto-match out yet. */
  autoMatchNotBuilt: boolean;
  busy: boolean;
  /** Bumped whenever the marks being measured no longer belong to the grid on show. */
  marksRun: number;
  /** The popover drew before the design system or its faces were ready, so it draws again once they are. */
  drewWaiting: boolean;
  /** The wait before resting on the Match button previews, or before leaving it restores. */
  matchTimer: ReturnType<typeof setTimeout> | null;
  /** What Auto-match would do, kept for the plan, deck, census and master it was read from. */
  auto: AutoMemo | null;
}

const states = new WeakMap<RbCtx, ChooserState>();

function stateOf(rb: RbCtx): ChooserState {
  let state = states.get(rb);
  if (!state) {
    state = {
      system: null,
      pop: null,
      query: '',
      similar: false,
      similarFor: null,
      preview: null,
      pending: null,
      compiled: new Map(),
      autoMatchNotBuilt: false,
      busy: false,
      marksRun: 0,
      drewWaiting: false,
      matchTimer: null,
      auto: null,
    };
    states.set(rb, state);
  }
  return state;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function iconNode(name: Parameters<typeof icon>[0]): Element | null {
  return svgNode(icon(name));
}

/** Text of markup another module returns, read through a parser rather than assigned. */
function textOf(html: string): string {
  const parser = (globalThis as { DOMParser?: typeof DOMParser }).DOMParser;
  if (!parser) return html;
  return new parser().parseFromString(html, 'text/html').body.textContent ?? '';
}

// ─── the design system and its master ────────────────────────────────────────

function systemKey(rb: RbCtx): string {
  return `${rb.state.designSystem?.id ?? ''}|${rb.state.plan?.designSystem.tokenHash ?? ''}`;
}

/**
 * The design system the controller compiles with, resolved once per design system in
 * the view, so a preview compiles one slide the way the stage compiles the deck.
 * Undefined while it is being read; null when the host cannot say.
 */
function systemOf(rb: RbCtx): RebrandDesignSystemV1 | null | undefined {
  const state = stateOf(rb);
  const key = systemKey(rb);
  if (state.system?.key === key) return state.system.value;
  const slot: SystemSlot = { key, value: undefined };
  state.system = slot;
  void (async (): Promise<RebrandDesignSystemV1 | null> => {
    try {
      const resolved = await resolveActiveDesignSystem(rb.host);
      return resolved ? await resolveRebrandDesignSystem(resolved.input) : null;
    } catch {
      return null;
    }
  })().then((value) => {
    if (state.system !== slot) return;
    slot.value = value;
    state.compiled.clear();
    // The column drew without the master; draw it again now there is one.
    rb.memo.decide = '';
    rb.decide.render();
  });
  return undefined;
}

/** The master the tiles are drawn from: the resolved design system's, else the neutral one. */
export function masterOf(rb: RbCtx): SlideMasterV1 | null {
  const system = systemOf(rb);
  if (system) return system.input.master;
  if (system === null || rb.state.designSystem?.neutralMaster) return neutralSlideMaster();
  return null;
}

/** The tiles for this design system: the master's layouts the design system offers. */
function tilesOf(rb: RbCtx, master: SlideMasterV1): LayoutTile[] {
  const offered = new Set(rb.state.designSystem?.archetypes ?? []);
  if (offered.size === 0) return layoutTiles(master);
  const kept = layoutTiles(master, offered);
  return kept.length > 0 ? kept : layoutTiles(master);
}

// ─── one slide's facts ───────────────────────────────────────────────────────

function planSlide(rb: RbCtx, slideId: string): SlidePlanV1 | undefined {
  return rb.derived?.plan.slides.find((one) => one.id === slideId);
}

function slideNumber(rb: RbCtx, slideId: string): number {
  return rb.derived?.slides.find((one) => one.id === slideId)?.number ?? 0;
}

// ─── the ways back: Original arrangement and Keep as a picture ───────────────

/** The two arrangements a leading tile stands for, in the order the chooser shows them. */
const ARRANGEMENT_TILES = ['original', 'picture'] as const;
type ArrangedV1 = (typeof ARRANGEMENT_TILES)[number];

/** The tile key a leading tile reports: `leading:original`, `leading:picture`. */
function leadingKey(arrangement: ArrangedV1): string {
  return `leading:${arrangement}`;
}

/** The arrangement a tile key names, or undefined for a layout's key. */
function arrangementOfKey(key: string): ArrangedV1 | undefined {
  const rest = key.startsWith('leading:') ? key.slice('leading:'.length) : '';
  return (ARRANGEMENT_TILES as readonly string[]).includes(rest) ? rest as ArrangedV1 : undefined;
}

/** How a slide is built now, as the key of the tile that stands for it. */
function keyOfSlide(slide: SlidePlanV1 | undefined): string | undefined {
  if (!slide) return undefined;
  const arranged = slide.arrangement;
  return arranged === 'original' || arranged === 'picture' ? leadingKey(arranged) : slide.layout;
}

/**
 * The name of an arrangement. `action` is the tile's and the button's name, a command
 * ("Keep as a picture", the words the empty frame's button and the report use too);
 * `state` is how the Slide section and the filmstrip name a slide already built that way
 * ("Kept as a picture").
 */
export function arrangementName(arrangement: SlideArrangementV1, as: 'action' | 'state' = 'action'): string {
  if (arrangement === 'original') return t('Original arrangement');
  if (arrangement === 'picture') return as === 'state' ? t('Kept as a picture') : t('Keep as a picture');
  return t('Layout');
}

/** What choosing an arrangement does, in one sentence. */
function arrangementSentence(arrangement: ArrangedV1, hasPicture: boolean): string {
  if (arrangement === 'original') return t('The objects stay where they were, in the colours and fonts of the design system.');
  return hasPicture ? t('The slide stays exactly as it was, as one picture.') : t('The slide stays exactly as it was, as one group of objects.');
}

/** The name a tile key stands for: an arrangement's, else the layout's. */
function nameOfKey(master: SlideMasterV1 | null, key: string): string {
  const arranged = arrangementOfKey(key);
  return arranged ? arrangementName(arranged) : layoutName(master, key);
}

/** True for a slide built in its original arrangement or kept as it was, not poured into a layout. */
function isArranged(slide: SlidePlanV1 | undefined): boolean {
  return slide?.arrangement === 'original' || slide?.arrangement === 'picture';
}

/**
 * The slides "Also the N slides like this one" adds: the included slides the matcher read
 * with the same structure signature, else those built on the same source layout, less
 * the ones already on `layout`, and never one a person set by hand or built in its
 * original arrangement or as it was.
 */
export function similarSlides(rb: RbCtx, slideId: string, layout?: string): string[] {
  const plan = rb.derived?.plan;
  const slide = planSlide(rb, slideId);
  if (!plan || !slide) return [];
  const signature = slide.layoutMatch?.signature;
  const sharing = signature
    ? plan.slides.filter((one) => one.layoutMatch?.signature === signature).map((one) => one.id)
    : rb.state.source ? slidesSharingSourceLayout(rb.state.source, slideId) : [];
  const byId = new Map(plan.slides.map((one) => [one.id, one]));
  return sharing.filter((id) => {
    const one = byId.get(id);
    return id !== slideId && one !== undefined && one.include && one.layoutSource !== 'user' && !isArranged(one) && one.layout !== layout;
  });
}

// ─── compiling one slide ─────────────────────────────────────────────────────

/**
 * The frames one slide compiles to under `layout`, compiled alone in the view with every
 * proposal applied, the way the Proposed pane's own compile applies them. Null when the
 * design system is not resolved or the compile refuses (a plan for another pack).
 */
function framesUnder(rb: RbCtx, slideId: string, tileKey: string): CompiledFrameV1[] | null {
  const state = stateOf(rb);
  const { plan, source, census } = rb.state;
  const system = systemOf(rb);
  if (!plan || !source || !system) return null;
  const key = `${plan.revision}|${slideId}|${tileKey}`;
  if (state.compiled.has(key)) return state.compiled.get(key) ?? null;
  let frames: CompiledFrameV1[] | null = null;
  try {
    const slide = plan.slides.find((one) => one.id === slideId);
    const sourceSlide = source.slides.find((one) => one.id === slideId);
    if (slide && sourceSlide) {
      // A layout's tile pours the slide into that layout; an arrangement's keeps the
      // slide's layout on the row and builds it the other way.
      const arranged = arrangementOfKey(tileKey);
      const one: SlidePlanV1 = arranged
        ? { ...slide, include: true, arrangement: arranged }
        : { ...slide, include: true, layout: tileKey, layoutSource: 'user' };
      if (!arranged) delete one.arrangement;
      const alone = previewPlanOf({ ...plan, slides: [one] });
      const deck = compileRenovated({
        source: { ...source, slides: [sourceSlide] },
        ...(census ? { census } : {}),
        plan: alone,
        master: system.input.master,
        designSystem: system.compile,
        opts: { applyUnreviewed: true, applyNeedsAttention: true },
      });
      frames = framesForSlide(deck.frames, slideId);
    }
  } catch {
    frames = null;
  }
  state.compiled.set(key, frames);
  while (state.compiled.size > COMPILE_CACHE_MAX) {
    const oldest = state.compiled.keys().next().value;
    if (oldest === undefined) break;
    state.compiled.delete(oldest);
  }
  return frames;
}

/** How many slides past the first a pour continues on: 0 when it fits, or when nothing compiled. */
function moreOf(frames: CompiledFrameV1[] | null): number {
  return Math.max(0, (frames?.length ?? 1) - 1);
}

/**
 * The note on a layout whose pour continues on more slides: the words as its description
 * ("Continues on 2 more slides.") whenever it continues, and the "+2" suffix on its name
 * only when that differs from what the slide's current layout adds, so a deck where every
 * layout continues once shows no suffix at all (close-out copy L2).
 */
export function continuationMark(more: number, currentMore: number): LayoutTileMark {
  if (more <= 0) return { text: '', describe: '' };
  const describe = more === 1 ? t('Continues on 1 more slide.') : tRaw('Continues on {count} more slides.', { count: more });
  return { text: more === currentMore ? '' : `+${more}`, describe };
}

/**
 * Measure the continuation notes in small batches after the grid is on screen, so
 * opening the chooser never waits on forty compiles. The slide's current way of being
 * built is measured first, since every suffix is read against it.
 */
function measureMarks(rb: RbCtx, chooser: LayoutChooserHandle, slideId: string): void {
  const state = stateOf(rb);
  const run = ++state.marksRun;
  const ids = chooser.tiles().map((tile) => tile.dataset.layout).filter((id): id is string => Boolean(id));
  const marks: Record<string, LayoutTileMark> = {};
  let currentMore = -1;
  let at = 0;
  const step = (): void => {
    if (run !== state.marksRun || !chooser.root.isConnected) return;
    if (systemOf(rb) === undefined) {
      setTimeout(step, 50);
      return;
    }
    if (currentMore < 0) {
      const now = keyOfSlide(planSlide(rb, slideId));
      currentMore = now ? moreOf(framesUnder(rb, slideId, now)) : 0;
    }
    for (const end = Math.min(ids.length, at + 6); at < end; at += 1) {
      const id = ids[at];
      if (id) marks[id] = continuationMark(moreOf(framesUnder(rb, slideId, id)), currentMore);
    }
    chooser.setMarks(marks);
    if (at < ids.length) setTimeout(step, 0);
  };
  setTimeout(step, 0);
}

// ─── drawing into the Proposed pane ──────────────────────────────────────────

/**
 * True once a proposed drawing can be set in the design system's faces: the design
 * system is resolved and the controller does not say its faces are still loading. Until
 * then the chooser draws stand-ins, never a fallback face that swaps a moment later.
 */
function drawable(rb: RbCtx): boolean {
  return Boolean(systemOf(rb)) && rb.compare.fontsReady();
}

function frameSvg(rb: RbCtx, frame: CompiledFrameV1, longEdge: number, proposed: boolean): string {
  const assetHref = (ref: string): string | undefined => rb.controller.mediaHref(ref);
  // Every text of a proposed drawing is set in the design system's faces (close-out 9.2):
  // the brand face, and its mono face for runs the source marked as code.
  const { brand, mono } = proposed ? rb.compare.fonts() : {};
  const fonts = { ...(brand ? { brand } : {}), ...(mono ? { mono } : {}) };
  // A tile's picture is drawn at the thumbnail detail: a chart's outlined labels are
  // most of its bytes and cannot be read at 96 px (close-out a11y-perf review).
  const detail = longEdge <= THUMB_DETAIL_MAX ? { detail: 'thumbnail' as const, longEdge } : {};
  const svg = framePreviewSvg(frame, { assetHref, ...(brand || mono ? { fonts } : {}), ...detail });
  const long = Math.max(frame.width, frame.height, 1);
  const w = Math.max(1, Math.round((frame.width * longEdge) / long));
  const h = Math.max(1, Math.round((frame.height * longEdge) / long));
  return svg.replace(/^<svg([^>]*?) width="[^"]*" height="[^"]*"/, `<svg$1 width="${w}" height="${h}"`);
}

function frameNode(svg: string, width: number, height: number): HTMLElement {
  const frame = el('div', 'rb-frame');
  const stage = el('div', 'rb-stage');
  stage.style.aspectRatio = `${width} / ${height}`;
  stage.style.setProperty('--rb-ratio', height > 0 ? (width / height).toFixed(4) : '1.7778');
  const art = el('div', 'rb-art');
  const node = svgNode(svg);
  if (node) art.append(node);
  stage.append(art);
  frame.append(stage);
  return frame;
}

/** What the pane should show instead of the committed slide, or null to show the committed slide. */
function wanted(rb: RbCtx): { slideId: string; key: string; label: boolean } | null {
  const state = stateOf(rb);
  const plan = rb.derived?.plan;
  const pending = state.pending;
  if (pending && plan) {
    const slide = planSlide(rb, pending.slideId);
    const caughtUp = (rb.state.preview?.planRevision ?? -1) > pending.revision && !rb.state.previewStale;
    // Once the plan has moved past the apply, a slide built another way means it was undone.
    const undone = plan.revision > pending.revision && keyOfSlide(slide) !== pending.layout;
    if (caughtUp || !slide || undone) state.pending = null;
  }
  const preview = state.preview;
  if (preview && preview.slideId === rb.sel.slideId) return { ...preview, label: true };
  if (state.pending && state.pending.slideId === rb.sel.slideId) {
    return { slideId: state.pending.slideId, key: state.pending.layout, label: false };
  }
  return null;
}

/**
 * The Proposed caption while the chooser draws into the pane: "Preview: Three boxes" in
 * place of the layout name while a tile is rested on, or the name alone after a pick
 * until the controller catches up, then "Continues on 2 more slides" when the drawing
 * does. The caption's own parts speak for the committed slide, so the sheet hides them
 * while it carries `data-chooser-previewing` (rebrand-chooser.css). Null gives it back.
 */
function captionPreview(pane: HTMLElement, shown: { name: string; pill: boolean; more: number } | null): void {
  const cap = pane.querySelector<HTMLElement>('.rb-pane-cap');
  if (!cap) return;
  for (const part of cap.querySelectorAll('[data-chooser-part]')) part.remove();
  if (!shown) {
    delete cap.dataset.chooserPreviewing;
    return;
  }
  cap.dataset.chooserPreviewing = '';
  const parts: HTMLElement[] = [];
  if (shown.pill) {
    const pill = el('span', 'rb-lc-preview-label');
    pill.dataset.chooserLabel = '';
    const glyph = iconNode('eye');
    if (glyph) {
      glyph.setAttribute('aria-hidden', 'true');
      pill.append(glyph);
    }
    pill.append(el('span', '', tRaw('Preview: {layout}', { layout: shown.name })));
    parts.push(pill);
  } else {
    parts.push(el('span', 'rb-lc-preview-name', shown.name));
  }
  if (shown.more > 0) {
    parts.push(el('span', 'rb-lc-preview-more', shown.more === 1
      ? t('Continues on 1 more slide')
      : tRaw('Continues on {count} more slides', { count: shown.more })));
  }
  for (const part of parts) part.dataset.chooserPart = '';
  const anchor = cap.querySelector(':scope > strong');
  if (anchor) anchor.after(...parts);
  else cap.prepend(...parts);
}

/** Show the preview in the Proposed pane, or take it away. Called after every render of the column. */
export function syncPreview(rb: RbCtx): void {
  const state = stateOf(rb);
  // A popover drawn while the design system or its faces were loading draws again now they are in.
  if (state.pop && state.drewWaiting && drawable(rb)) refreshPopover(rb);
  const pane = rb.els.compare.querySelector<HTMLElement>('[data-pane="proposed"]');
  const holder = pane?.querySelector<HTMLElement>('[data-frames]');
  if (!pane || !holder) return;
  const existing = pane.querySelector<HTMLElement>('[data-chooser-preview]');
  const want = wanted(rb);
  if (!want) {
    existing?.remove();
    captionPreview(pane, null);
    holder.hidden = false;
    return;
  }
  const ready = drawable(rb);
  const key = `${want.slideId}|${want.key}|${want.label}|${rb.derived?.plan.revision ?? ''}|${ready ? rb.compare.fonts().brand ?? 1 : 0}`;
  const master = masterOf(rb);
  const name = nameOfKey(master, want.key);
  // Until the faces are in, the layout's wireframe stands in for the compiled slide.
  const frames = ready ? framesUnder(rb, want.slideId, want.key) : null;
  const [main, ...more] = frames ?? [];
  // The caption is compare's and may have been drawn again since, so it is set every time.
  captionPreview(pane, { name, pill: want.label, more: more.length });
  if (existing?.dataset.previewKey === key) return;
  const box = el('div', 'rb-frames rb-lc-preview');
  box.dataset.chooserPreview = '';
  box.dataset.previewKey = key;
  const edge = rb.compare.ladder().previewLongEdge;
  // The first part only, at the hero's size, so the caption row under it stays in view;
  // the caption says how many more slides the pour continues on.
  if (main) {
    box.append(frameNode(frameSvg(rb, main, edge, true), main.width, main.height));
  } else if (master && !arrangementOfKey(want.key)) {
    // No compile to show (the design system or its faces are still loading): the layout's wireframe.
    const size = master.size;
    box.append(frameNode(layoutThumb(master, want.key, 640, archetypeThumbSvg), size.width, size.height));
  }
  if (existing) existing.replaceWith(box);
  else holder.after(box);
  holder.hidden = true;
}

function setPreview(rb: RbCtx, slideId: string, key: string | null): void {
  const state = stateOf(rb);
  // The way the slide is built already is what the pane shows: nothing to preview.
  const current = keyOfSlide(planSlide(rb, slideId));
  state.preview = key && key !== current ? { slideId, key } : null;
  syncPreview(rb);
}

// ─── the chooser ─────────────────────────────────────────────────────────────

/** The first group's tiles, extras and notes for one slide. */
function slideParts(rb: RbCtx, master: SlideMasterV1, tiles: LayoutTile[], slideId: string): {
  current: string;
  pinned: string[];
  extras: Record<string, LayoutTileExtra>;
  notes: Array<{ id: string; text: string }>;
} {
  const slide = planSlide(rb, slideId);
  // A picture layout folded into a box tile is marked on that tile, so each id is read
  // as the tile that shows it.
  const canon = (id: string | undefined): string | undefined => (id ? tileIdOf(tiles, id) : undefined);
  // A slide kept in its original arrangement or as it was is current on that tile, not on its layout's.
  const arranged = isArranged(slide);
  const current = arranged ? '' : canon(slide?.layout) ?? '';
  const listed = new Set(tiles.flatMap((tile) => (tile.flip ? [tile.id, tile.flip] : [tile.id])));
  const suggested = canon(slide ? suggestedLayoutOf(master, slide) : undefined);
  const alternative = canon(slide?.layoutAlternative);
  const extras: Record<string, LayoutTileExtra> = {};
  const pinned: string[] = [];
  if (current && listed.has(current)) {
    pinned.push(current);
    extras[current] = { caption: t('Current') };
  }
  // The layout an arranged slide keeps on its row, first, so the way back to it is in view.
  const retained = arranged ? canon(slide?.layout) : undefined;
  if (retained && listed.has(retained)) {
    pinned.push(retained);
    extras[retained] = { caption: t('Last used'), describe: t('The layout this slide used before. Choosing it builds the slide in that layout again.') };
  }
  const notes: Array<{ id: string; text: string }> = [];
  const reasons = (slide?.layoutReasons ?? []).map((reason) => textOf(rb.queue.message(reason))).filter(Boolean);
  if (suggested && listed.has(suggested)) {
    if (suggested !== current && suggested !== retained) {
      pinned.push(suggested);
      extras[suggested] = { caption: slide?.layoutMatch?.band === 'likely' ? t('Suggested, check it') : t('Suggested'), suggested: true };
    }
    if (reasons[0]) {
      const id = `rb-lc-why-${slideId}`;
      notes.push({ id, text: reasons[0] });
      extras[suggested] = { ...(extras[suggested] ?? {}), describe: reasons[0] };
    }
  }
  if (alternative && listed.has(alternative) && alternative !== current && alternative !== suggested && alternative !== retained) {
    pinned.push(alternative);
    extras[alternative] = { caption: t('Also fits'), suggested: true, ...(reasons[1] ? { describe: reasons[1] } : {}) };
    if (reasons[1]) notes.push({ id: `rb-lc-alt-${slideId}`, text: reasons[1] });
  }
  return { current, pinned, extras, notes };
}

/** A tile picture drawn from a compiled frame, at the tile width, once the faces are in. */
function tileArt(rb: RbCtx, frame: CompiledFrameV1, slideId: string): string {
  return rb.compare.fontsReady() ? frameSvg(rb, frame, TILE_WIDTH, true) : tileArtWaiting(rb, slideId);
}

/** A neutral stand-in while the slide is being compiled: the slide's own picture when it has one. */
function tileArtWaiting(rb: RbCtx, slideId: string): string {
  const slide = rb.state.source?.slides.find((one) => one.id === slideId);
  const w = slide && slide.width > 0 ? slide.width : 16;
  const h = slide && slide.height > 0 ? slide.height : 9;
  const tall = Math.max(1, Math.round((TILE_WIDTH * h) / w));
  const ref = slide?.recovery?.assetRef;
  const href = ref ? rb.controller.mediaHref(ref) : undefined;
  const inner = href
    ? `<image href="${href.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`
    // Chrome, not slide content: the stylesheet paints it in the muted surface of the theme.
    : `<rect class="rb-lc-wait" width="${w}" height="${h}" fill="none"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${TILE_WIDTH}" height="${tall}">${inner}</svg>`;
}

/**
 * The ways back to the slide as it was, first in every chooser (plan 275 section 4):
 * Original arrangement and Keep as it was, each drawn from the slide itself by
 * compiling it that way. None while the controller cannot carry them out.
 */
function leadingTiles(rb: RbCtx, slideId: string): LeadingTile[] {
  if (!rb.controller.setArrangement) return [];
  const slide = planSlide(rb, slideId);
  const hasPicture = Boolean(rb.state.source?.slides.find((one) => one.id === slideId)?.recovery?.assetRef);
  return ARRANGEMENT_TILES.map((arrangement): LeadingTile => {
    const frame = framesUnder(rb, slideId, leadingKey(arrangement))?.[0];
    const current = slide?.arrangement === arrangement;
    return {
      key: arrangement,
      name: arrangementName(arrangement),
      svg: frame ? tileArt(rb, frame, slideId) : tileArtWaiting(rb, slideId),
      describe: arrangementSentence(arrangement, hasPicture),
      // The two ways back draw the same slide; the badge is what tells the picture apart.
      ...(arrangement === 'picture' ? { badge: 'picture' as const } : {}),
      ...(current ? { caption: t('Current'), current: true } : {}),
    };
  });
}

/**
 * The slide a chooser acts on first and previews: the slide the comparison shows when it
 * is one of them (the one a Shift+arrow selection ends on), else the first of them.
 */
function primarySlide(rb: RbCtx, slideIds: string[]): string {
  const shown = rb.sel.slideId;
  return shown && slideIds.includes(shown) ? shown : slideIds[0] ?? '';
}

/**
 * Build the grid for these slides, wired to apply and preview. `widen` says whether a
 * pick also takes the slides like this one: true only where this chooser showed the
 * "Also the N slides like this one" toggle, and it was ticked. `between` are rows placed
 * over the tiles (the Auto-match row); `notes` shows the matcher's sentences under the
 * first group, which the popover leaves to each tile's description instead.
 */
function chooserFor(
  rb: RbCtx,
  master: SlideMasterV1,
  slideIds: string[],
  keyPrefix: string,
  widen: () => boolean,
  place: { between?: HTMLElement[]; notes?: boolean } = {},
): LayoutChooserHandle {
  const state = stateOf(rb);
  const slideId = primarySlide(rb, slideIds);
  const tiles = tilesOf(rb, master);
  const parts = slideParts(rb, master, tiles, slideId);
  const chooser = buildLayoutChooser({
    master,
    draw: archetypeThumbSvg,
    tiles,
    current: parts.current,
    pinned: parts.pinned,
    leading: leadingTiles(rb, slideId),
    leadingName: slideIds.length > 1 ? tRaw('These {count} slides', { count: slideIds.length }) : t('This slide'),
    ...(place.notes === false ? {} : { leadingNotes: parts.notes }),
    ...(place.between ? { between: place.between } : {}),
    extras: parts.extras,
    query: state.query,
    width: TILE_WIDTH,
    keyPrefix,
    onQuery: (query) => { state.query = query; },
    onPreview: (key) => setPreview(rb, slideId, key),
    onAnnounce: (text) => rb.announce(text),
    onPick: (layout) => { void applyLayout(rb, slideIds, layout, widen()); },
    // The toggle widens an arrangement the way it widens a layout.
    onLeading: (key) => {
      const arranged = arrangementOfKey(`leading:${key}`);
      if (!arranged) return;
      const ids = widen() ? [...new Set([...slideIds, ...similarSlides(rb, slideId)])] : slideIds;
      void applyArrangement(rb, ids, arranged);
    },
  });
  chooser.root.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    closeChooser(rb);
  });
  measureMarks(rb, chooser, slideId);
  return chooser;
}

/**
 * The toggle that widens a click to the slides like this one, when there are any. It
 * belongs to one slide: shown for another, it starts unticked.
 */
function similarToggle(rb: RbCtx, slideId: string): HTMLElement | null {
  const state = stateOf(rb);
  if (state.similarFor !== slideId) {
    state.similar = false;
    state.similarFor = slideId;
  }
  const count = similarSlides(rb, slideId).length;
  if (count === 0) return null;
  const label = el('label', 'rb-choice rb-lc-similar');
  const box = el('input', '');
  box.type = 'checkbox';
  box.checked = state.similar;
  box.dataset.key = 'layout-similar';
  box.addEventListener('change', () => { state.similar = box.checked; });
  label.append(box, el('span', '', count === 1
    ? t('Also the 1 slide like this one')
    : tRaw('Also the {count} slides like this one', { count })));
  return label;
}

// ─── Auto-match ──────────────────────────────────────────────────────────────

export interface AutoMatchCounts {
  /** Slides the action would set. */
  count: number;
  /** Of those, the ones the matcher is only fairly sure of. */
  likely: number;
  /** Any slide at all carries a match. */
  anyMatch: boolean;
  /** Slides passed by because the layout their read names has too few cells for them. */
  tooSmall?: number;
  /** Slides passed by because they already carry the layout their read names. */
  settled?: number;
  /**
   * The layouts it would set and how many slides each, most first, then in deck order:
   * the chooser's tally. The counts sum to `count`.
   */
  byLayout?: Array<{ layout: ArchetypeRefV1; count: number }>;
}

/** One Auto-match reading, and the plan, deck, census, master and selection it was read from. */
interface AutoMemo {
  plan: RenovationPlanV1;
  source: unknown;
  census: unknown;
  master: SlideMasterV1;
  ids: string;
  counts: AutoMatchCounts;
  /** The layout each slide it would set goes to. */
  layoutOf: Map<string, ArchetypeRefV1>;
}

/**
 * What Auto-match would do with `bands: 'likely'`, read once per plan, deck, census,
 * master and selection from the engine's own `autoMatchPreview`, the reading the command
 * itself acts on, so the number on the button is the number the command sets.
 */
function autoReading(rb: RbCtx, slideIds?: string[]): AutoMemo | null {
  const plan = rb.derived?.plan;
  const source = rb.state.source;
  const census = rb.state.census ?? undefined;
  const master = masterOf(rb);
  if (!plan || !source || !master) return null;
  const state = stateOf(rb);
  const ids = slideIds ? JSON.stringify(slideIds) : '';
  const memo = state.auto;
  if (memo && memo.plan === plan && memo.source === source && memo.census === census && memo.master === master && memo.ids === ids) return memo;
  const preview = autoMatchPreview(plan, source, census, { bands: 'likely', master, ...(slideIds ? { slideIds } : {}) });
  const tally = new Map<ArchetypeRefV1, number>();
  const layoutOf = new Map<string, ArchetypeRefV1>();
  let likely = 0;
  for (const row of preview.slides) {
    if (row.band === 'likely') likely += 1;
    tally.set(row.layout, (tally.get(row.layout) ?? 0) + 1);
    layoutOf.set(row.slideId, row.layout);
  }
  const passed = (reason: string): number => preview.skipped.filter((row) => row.reason === reason).length;
  // A stable sort keeps deck order among layouts with the same count.
  const byLayout = [...tally].map(([layout, count]) => ({ layout, count })).sort((a, b) => b.count - a.count);
  const counts: AutoMatchCounts = {
    count: preview.slides.length,
    likely,
    // The engine's own rule (`autoMatchCount`): any slide in the plan carries a read, or one would be set.
    anyMatch: plan.slides.some((slide) => slide.layoutMatch !== undefined) || preview.slides.length > 0,
    tooSmall: passed('capacity'),
    settled: passed('unchanged'),
    byLayout,
  };
  const next: AutoMemo = { plan, source, census, master, ids, counts, layoutOf };
  state.auto = next;
  return next;
}

/**
 * What Auto-match would do with `bands: 'likely'`, before it runs. Every included slide a
 * person or a preset has not set, whose arrangement a person has not chosen and with no
 * locked row, whose clear or likely read names a layout (the master's, or its nearest)
 * with cells enough for it, unless the slide already carries that layout. `slideIds`
 * narrows it to a filmstrip selection.
 */
export function autoMatchCounts(rb: RbCtx, slideIds?: string[]): AutoMatchCounts {
  return autoReading(rb, slideIds)?.counts ?? { count: 0, likely: 0, anyMatch: false, byLayout: [] };
}

/**
 * Whether Auto-match is on offer at all, and why it cannot run when it is shown but
 * cannot. `shown` is false when the controller carries no such command, and then no
 * surface offers it. `reason` is set once this build refused it, and every surface that
 * offers it (the chooser, the filmstrip's bar and its bulk menu) disables it with that
 * sentence.
 */
export function autoMatchState(rb: RbCtx): { shown: boolean; reason: string } {
  if (!rb.controller.autoMatchLayouts) return { shown: false, reason: '' };
  return { shown: true, reason: stateOf(rb).autoMatchNotBuilt ? t('Auto-match is not available yet.') : '' };
}

/** Learn from a refusal that this build does not carry Auto-match out, so every surface disables it. */
export function noteAutoMatchRefused(rb: RbCtx): void {
  stateOf(rb).autoMatchNotBuilt = true;
}

/**
 * Why Auto-match cannot run over a filmstrip selection, in one sentence, or '' when it
 * can: this build refuses it, or it would set none of these slides.
 */
export function autoMatchBlockedFor(rb: RbCtx, slideIds: string[], counts: AutoMatchCounts): string {
  const offer = autoMatchState(rb);
  if (offer.reason) return offer.reason;
  if (counts.count > 0) return '';
  const small = tooSmallText(counts);
  if (small) return small;
  const wanted = new Set(slideIds);
  const suggested = (rb.derived?.plan.slides ?? []).some((one) => wanted.has(one.id) && one.layoutMatch !== undefined && one.layoutMatch.band !== 'none');
  if (slideIds.length === 1) return suggested ? t('This slide already uses its suggested layout.') : t('This slide has no suggested layout.');
  return suggested ? t('These slides already use their suggested layouts.') : t('None of these slides has a suggested layout.');
}

/**
 * Why Auto-match sets none of the slides it could otherwise have set: the layouts their
 * reads name have too few cells for them. '' when that is not why.
 */
function tooSmallText(counts: AutoMatchCounts): string {
  const n = counts.tooSmall ?? 0;
  if (n <= 0) return '';
  return n === 1
    ? t('1 suggested layout has too few boxes, so that slide is left for you.')
    : t('{count} suggested layouts have too few boxes, so those slides are left for you.', { count: n });
}

/**
 * The action's own label: how many slides it sets. `Match layouts` when it cannot run,
 * the same verb with no count.
 */
export function matchLabel(count: number, blocked = false): string {
  if (blocked) return t('Match layouts');
  return count === 1 ? t('Match 1 slide') : tRaw('Match {count} slides', { count });
}

/** How many of the slides Auto-match would set are only likely matches, in one sentence. */
export function likelyText(counts: AutoMatchCounts): string {
  if (counts.likely <= 0) return counts.count === 1 ? t('It is a clear match.') : t('All are clear matches.');
  if (counts.count === 1) return t('It is a likely match. Check it after.');
  return counts.likely === 1
    ? t('1 is a likely match. Check it after.')
    : tRaw('{count} are likely matches. Check them after.', { count: counts.likely });
}

/**
 * How many of the slides Auto-match would set are only likely matches, as the Match
 * button's hover text and description (close-out copy Q8): "3 of the 8 are likely
 * matches. Check them after." Empty when every one is a clear match, which needs no words.
 */
export function likelyTitle(counts: AutoMatchCounts): string {
  if (counts.likely <= 0 || counts.count <= 0) return '';
  if (counts.count === 1) return t('It is a likely match. Check it after.');
  if (counts.likely >= counts.count) return tRaw('All {count} are likely matches. Check them after.', { count: counts.count });
  return counts.likely === 1
    ? tRaw('1 of the {count} is a likely match. Check it after.', { count: counts.count })
    : tRaw('{likely} of the {count} are likely matches. Check them after.', { likely: counts.likely, count: counts.count });
}

/** Why Match is retired: every slide with a match already uses it (close-out copy Q9). */
export function settledText(counts: AutoMatchCounts): string {
  const n = counts.settled ?? 0;
  if (n === 1) return t('1 slide already uses its suggested layout.');
  if (n > 1) return tRaw('All {count} slides already use their suggested layout.', { count: n });
  return t('No slide is left to match.');
}

/** "6 slides" with the number in its own element, so it can carry the weight, in any word order. */
function slidesCount(count: number): HTMLElement {
  const words = count === 1 ? t('1 slide') : tRaw('{count} slides', { count });
  const out = el('span', 'rb-lc-tally-count');
  for (const part of words.split(/(\d+)/)) {
    if (!part) continue;
    out.append(/^\d+$/.test(part) ? el('b', '', part) : document.createTextNode(part));
  }
  return out;
}

/**
 * The tally of what Auto-match would set: each layout as a small wireframe with its count
 * and unit, most first, the counts summing to the button's. The whole row is titled with
 * the same facts in words, which a screen reader hears as its name.
 */
function tallyNode(master: SlideMasterV1, counts: AutoMatchCounts): HTMLElement | null {
  const rows = counts.byLayout ?? [];
  if (rows.length === 0) return null;
  const box = el('span', 'rb-lc-tally');
  const words: string[] = [];
  for (const { layout, count } of rows) {
    const item = el('span', 'rb-lc-tally-item');
    const wire = el('span', 'rb-lc-tally-wire');
    const art = svgNode(layoutThumb(master, layout, TALLY_WIDTH, archetypeThumbSvg));
    if (art) wire.append(art);
    item.append(wire, slidesCount(count));
    box.append(item);
    words.push(tRaw('{layout}, {slides}', { layout: layoutName(master, layout), slides: count === 1 ? t('1 slide') : tRaw('{count} slides', { count }) }));
  }
  const said = `${words.join('. ')}.`;
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', said);
  box.title = said;
  return box;
}

/**
 * Rest on the Match button to see the slide on screen under the layout Auto-match would
 * give it, after the same wait a tile takes; leave it and the committed slide comes back
 * after that wait. Nothing is written.
 */
function previewMatch(rb: RbCtx, slideId: string, layout: string | null): void {
  const state = stateOf(rb);
  if (state.matchTimer !== null) clearTimeout(state.matchTimer);
  state.matchTimer = setTimeout(() => {
    state.matchTimer = null;
    if (state.pop) setPreview(rb, slideId, layout);
  }, PREVIEW_DELAY_MS);
}

/**
 * The popover's Auto-match row, under the search, or null where there is none (no such
 * command, or no slide in the deck carries a match). While it would set slides: the tally
 * and "Match 8 slides", the likely count as its hover text and description. When it would
 * set none, the button stays in its place and says why: "Layouts match" once every slide
 * uses its match, "Match layouts" with the reason otherwise; either way `aria-disabled`,
 * so the reason can still be reached and read.
 */
function autoMatchRow(rb: RbCtx, master: SlideMasterV1, slideId: string): HTMLElement | null {
  const offer = autoMatchState(rb);
  if (!offer.shown) return null;
  const counts = autoMatchCounts(rb);
  if (!counts.anyMatch && !offer.reason) return null;
  const row = el('div', 'rb-lc-auto-row');
  const button = el('button', 'btn btn--ghost btn--sm rb-lc-auto-btn');
  button.type = 'button';
  button.dataset.key = 'layout-pop-auto';
  button.dataset.act = 'auto-match';
  // The same plain ghost button as the queue's Match: one action, one look in both homes.
  let label = matchLabel(counts.count);
  let why = '';
  if (offer.reason) {
    label = matchLabel(0, true);
    why = offer.reason;
  } else if (counts.count === 0) {
    const small = tooSmallText(counts);
    label = small ? matchLabel(0, true) : t('Layouts match');
    why = small || settledText(counts);
  } else {
    const tally = tallyNode(master, counts);
    if (tally) row.append(tally);
  }
  button.append(el('span', '', label));
  const said = why || likelyTitle(counts);
  if (said) {
    const note = el('span', 'visually-hidden', said);
    note.id = 'rb-lc-auto-said';
    button.setAttribute('aria-describedby', note.id);
    button.title = said;
    row.append(note);
  }
  const blocked = Boolean(why) || stateOf(rb).busy;
  if (blocked) button.setAttribute('aria-disabled', 'true');
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    if (button.getAttribute('aria-disabled') === 'true') return;
    void runAutoMatch(rb);
  });
  // The slide on screen, under the layout Auto-match gives it, while the button is rested on.
  const layout = blocked ? undefined : autoReading(rb)?.layoutOf.get(slideId);
  if (layout) {
    button.addEventListener('pointerenter', () => previewMatch(rb, slideId, layout));
    button.addEventListener('focus', () => previewMatch(rb, slideId, layout));
    button.addEventListener('pointerleave', () => previewMatch(rb, slideId, null));
    button.addEventListener('blur', () => previewMatch(rb, slideId, null));
  }
  row.append(button);
  return row;
}

async function runAutoMatch(rb: RbCtx): Promise<void> {
  const state = stateOf(rb);
  const command = rb.controller.autoMatchLayouts;
  if (!command || state.busy) return;
  state.busy = true;
  try {
    const before = rb.controller.getState().plan;
    const outcome = await command('likely');
    if (!outcome.ok && outcome.refusal === 'not-built') {
      state.autoMatchNotBuilt = true;
      rb.announce(t('Auto-match is not available yet.'));
      return;
    }
    rb.decide.announceOutcome(outcome, matchedText(outcome.touched, likelySet(before, rb.controller.getState().plan)));
  } finally {
    state.busy = false;
    rb.memo.decide = '';
    rb.decide.render();
    // The filmstrip's bar and bulk menu offer the same action, so they learn a refusal too.
    rb.memo.strip = '';
    rb.strip.render();
    refreshPopover(rb);
  }
}

/**
 * Of the slides an Auto-match run set, the ones it set on a likely match: read from the
 * plan before and after, the slides now on Auto-match's layout that were not before (or
 * were on another one), by the band their match carries. The same figure the CLI
 * envelope reports, so the sentence after a run counts what the run did, not what the
 * count before it expected.
 */
export function likelySet(before: RenovationPlanV1 | null | undefined, after: RenovationPlanV1 | null | undefined): number {
  if (!after) return 0;
  const was = new Map((before?.slides ?? []).map((one) => [one.id, one]));
  let likely = 0;
  for (const slide of after.slides) {
    if (slide.layoutSource !== 'auto') continue;
    const old = was.get(slide.id);
    if (old && old.layoutSource === 'auto' && old.layout === slide.layout) continue;
    if (slide.layoutMatch?.band === 'likely') likely += 1;
  }
  return likely;
}

/** What an Auto-match run did: "Matched 23 slides. 4 were likely matches." */
export function matchedText(touched: number, likely: number): string {
  if (touched <= 0) return t('No slide changed.');
  const few = Math.min(likely, touched);
  if (touched === 1) return few > 0 ? t('Matched 1 slide. It was a likely match.') : t('Matched 1 slide.');
  const done = tRaw('Matched {count} slides.', { count: touched });
  if (few <= 0) return done;
  return `${done} ${few === 1 ? t('1 was a likely match.') : tRaw('{count} were likely matches.', { count: few })}`;
}

// ─── applying ────────────────────────────────────────────────────────────────

/**
 * After a pick, the redraws for the new plan can replace the control the popover gave the
 * focus back to (a filmstrip thumbnail, its layout pill). When the focus is left on the
 * page, it goes to Change layout where the column shows it, else to the slide's
 * thumbnail, never to nowhere (close-out section 5, Focus).
 */
function settleFocus(rb: RbCtx, slideId: string): void {
  if (typeof document === 'undefined') return;
  const active = document.activeElement;
  if (active && active !== document.body && active.isConnected) return;
  const change = rb.els.decide.querySelector<HTMLElement>('[data-key="layout-change"]');
  if (change && !change.closest('[hidden]') && !change.matches(':disabled') && change.getClientRects().length > 0) {
    change.focus();
    return;
  }
  rb.strip.focus(slideId);
}

/**
 * Apply one layout to the slides the chooser is for, and, with `widen`, to the slides
 * like the one it previews (the chooser that showed the ticked toggle says so): one
 * controller command, so one undo step. The chooser closes, and the pane keeps the new
 * layout until the controller's preview catches up.
 */
export async function applyLayout(rb: RbCtx, slideIds: string[], layout: ArchetypeRefV1, widen = false): Promise<void> {
  const state = stateOf(rb);
  const slideId = primarySlide(rb, slideIds);
  const plan = rb.derived?.plan;
  if (!slideId || !plan) return;
  const current = keyOfSlide(planSlide(rb, slideId));
  const ids = [...new Set([...slideIds, ...(widen ? similarSlides(rb, slideId, layout) : [])])];
  // A slide kept in its original arrangement or as a picture changes too: the pick pours it into the layout.
  const changing = ids.filter((id) => keyOfSlide(planSlide(rb, id)) !== layout);
  state.preview = null;
  closeChooser(rb);
  if (changing.length === 0 || (ids.length === 1 && current === layout)) {
    syncPreview(rb);
    return;
  }
  // Every slide going back to the layout it kept on its row (the Last used tile): that is
  // switching the arrangement back, one step the Undo names as such.
  const back = rb.controller.setArrangement !== undefined && changing.every((id) => {
    const one = planSlide(rb, id);
    return isArranged(one) && one?.layout === layout;
  });
  if (back) {
    await applyArrangement(rb, changing, 'layout');
    return;
  }
  state.pending = { slideId, layout, revision: plan.revision };
  syncPreview(rb);
  const name = layoutName(masterOf(rb), layout);
  const outcome = await rb.controller.setLayout(changing, layout);
  if (!outcome.ok) state.pending = null;
  rb.decide.announceOutcome(outcome, changing.length === 1
    ? tRaw('Slide {n} now uses the {layout} layout.', { n: slideNumber(rb, changing[0] ?? slideId), layout: name })
    : tRaw('{count} slides now use the {layout} layout.', { count: changing.length, layout: name }));
  syncPreview(rb);
  settleFocus(rb, slideId);
}

/**
 * Keep these slides in their original arrangement or as a picture, through the
 * controller, as one undo step. The chooser closes and the pane keeps the new build
 * until the controller's preview catches up, as a layout's does.
 */
export async function applyArrangement(rb: RbCtx, slideIds: string[], arrangement: SlideArrangementV1): Promise<void> {
  const state = stateOf(rb);
  const command = rb.controller.setArrangement;
  const slideId = primarySlide(rb, slideIds);
  const plan = rb.derived?.plan;
  if (!command || !slideId || !plan) return;
  const key = arrangement === 'layout' ? planSlide(rb, slideId)?.layout ?? '' : leadingKey(arrangement);
  const changing = slideIds.filter((id) => (planSlide(rb, id)?.arrangement ?? 'layout') !== arrangement);
  state.preview = null;
  closeChooser(rb);
  if (changing.length === 0) {
    syncPreview(rb);
    return;
  }
  state.pending = { slideId, layout: key, revision: plan.revision };
  syncPreview(rb);
  const outcome = await command(changing, arrangement);
  if (!outcome.ok) state.pending = null;
  // The count is what the controller changed, which the filter above only expects.
  const count = outcome.ok ? outcome.touched : changing.length;
  rb.decide.announceOutcome(outcome, arrangedText(arrangement, count, slideNumber(rb, changing[0] ?? slideId)));
  syncPreview(rb);
  settleFocus(rb, slideId);
}

/** What an arrangement did, in one sentence: "Slide 4 is kept as a picture." */
export function arrangedText(arrangement: SlideArrangementV1, count: number, n: number): string {
  if (arrangement === 'picture') {
    return count === 1 ? tRaw('Slide {n} is kept as a picture.', { n }) : tRaw('{count} slides are kept as pictures.', { count });
  }
  if (arrangement === 'original') {
    return count === 1
      ? tRaw('Slide {n} keeps its original arrangement.', { n })
      : tRaw('{count} slides keep their original arrangement.', { count });
  }
  return count === 1 ? tRaw('Slide {n} uses its layout again.', { n }) : tRaw('{count} slides use their layout again.', { count });
}

// ─── the popover ─────────────────────────────────────────────────────────────

/** What the popover is for, beside its title: "Slide 3", or "3 slides" for a selection. */
function popoverSubject(rb: RbCtx, slideIds: string[]): string {
  if (slideIds.length > 1) return tRaw('{count} slides', { count: slideIds.length });
  return tRaw('Slide {n}', { n: slideNumber(rb, slideIds[0] ?? '') });
}

function popoverContent(rb: RbCtx, box: HTMLDivElement, slot: PopoverSlot): HTMLElement | null {
  const state = stateOf(rb);
  const master = masterOf(rb);
  box.replaceChildren();
  const head = el('div', 'rb-lc-pop-head');
  const title = el('h2', 'rb-lc-pop-title', t('Change layout'));
  title.id = 'rb-lc-pop-title';
  const close = el('button', 'lp-iconbtn rb-lc-pop-close');
  close.type = 'button';
  close.dataset.key = 'layout-pop-close';
  close.setAttribute('aria-label', t('Close'));
  close.title = t('Close');
  const glyph = iconNode('close');
  if (glyph) close.append(glyph);
  close.addEventListener('click', () => closeChooser(rb));
  head.append(title, el('span', 'rb-lc-pop-subject', popoverSubject(rb, slot.slideIds)), close);
  box.append(head);
  box.setAttribute('aria-labelledby', title.id);
  box.removeAttribute('aria-label');
  state.drewWaiting = !drawable(rb);
  if (!master) {
    box.append(el('p', 'lp-help', t('Reading the slide layouts')));
    slot.chooser = null;
    return close;
  }
  const slideId = primarySlide(rb, slot.slideIds);
  const between: HTMLElement[] = [];
  const auto = autoMatchRow(rb, master, slideId);
  if (auto) between.push(auto);
  const toggle = slot.slideIds.length === 1 ? similarToggle(rb, slideId) : null;
  if (toggle) between.push(toggle);
  const chooser = chooserFor(rb, master, slot.slideIds, 'layout-pop', () => toggle !== null && state.similar, { between, notes: false });
  slot.chooser?.dispose();
  slot.chooser = chooser;
  box.append(chooser.root);
  const start = chooser.tiles().find((tile) => tile.tabIndex === 0);
  return start ?? close;
}

/**
 * Draw the popover's content again (after Auto-match ran, or once the design system and
 * its faces are in), keeping the focus on the control that had it and the list where it
 * was scrolled.
 */
function refreshPopover(rb: RbCtx): void {
  const slot = stateOf(rb).pop;
  if (!slot) return;
  const box = document.querySelector<HTMLDivElement>('.rb-lc-pop');
  if (!box) return;
  const active = document.activeElement;
  const key = active instanceof HTMLElement && box.contains(active) ? active.dataset.key ?? '' : '';
  const scroll = box.querySelector<HTMLElement>('.arch-groups')?.scrollTop ?? 0;
  popoverContent(rb, box, slot);
  const groups = box.querySelector<HTMLElement>('.arch-groups');
  if (groups) groups.scrollTop = scroll;
  if (key) [...box.querySelectorAll<HTMLElement>('[data-key]')].find((one) => one.dataset.key === key)?.focus();
}

/** Centre a popover opened with no element to hang from (a key press). */
function centred(box: HTMLDivElement): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  box.style.left = `${Math.max(8, Math.round((vw - box.offsetWidth) / 2))}px`;
  box.style.top = `${Math.max(8, Math.round((vh - box.offsetHeight) / 3))}px`;
}

/** Below the anchor, flipped above it when it would run off the bottom, clamped into the viewport. */
function anchorBelow(box: HTMLDivElement, anchor: PopoverAnchor): void {
  const r = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = box.offsetWidth;
  const h = box.offsetHeight;
  let top = r.bottom + 8;
  if (top + h > vh - 8) top = r.top - h - 8 >= 8 ? r.top - h - 8 : Math.max(8, vh - h - 8);
  box.style.right = 'auto';
  box.style.left = `${Math.round(Math.max(8, Math.min(r.left, vw - w - 8)))}px`;
  box.style.top = `${Math.round(top)}px`;
}

/** The decision column narrower than this, in CSS px, is no place to dock the grid. */
const DOCK_MIN_WIDTH = 280;

/**
 * Dock the popover over the decision column, so the Proposed pane the hover preview
 * draws into stays in view beside it. True when it docked; false where the column is
 * hidden or too narrow (the narrow layout's sheet), and the caller places it instead.
 */
function dockOverColumn(rb: RbCtx, box: HTMLDivElement): boolean {
  const column = rb.els.decide.getBoundingClientRect();
  const top = Math.max(8, column.top);
  const bottom = Math.min(window.innerHeight - 8, column.bottom);
  if (rb.narrow || column.width < DOCK_MIN_WIDTH || bottom - top < 200) return false;
  box.style.right = 'auto';
  box.style.left = `${Math.round(column.left)}px`;
  box.style.top = `${Math.round(top)}px`;
  box.style.width = `${Math.round(column.width)}px`;
  box.style.maxHeight = `${Math.round(bottom - top)}px`;
  box.dataset.docked = 'true';
  return true;
}

/**
 * Open the chooser for these slides, selecting the slide first when it is one: a popover
 * docked over the decision column from every entry (the Change layout button, the L key,
 * the filmstrip's menu, a thumbnail's layout pill), or, where that column is hidden, on
 * `anchor`, or centred when nothing is given to hang it from. Closing it gives the focus
 * back to `anchor`, else to what had the focus when it opened.
 */
export function openChooser(rb: RbCtx, slideIds: string[], entry: RbChooserEntry, anchor?: HTMLElement): void {
  const state = stateOf(rb);
  const ids = slideIds.filter((id) => planSlide(rb, id));
  const slideId = primarySlide(rb, ids);
  if (!slideId) return;
  const before = document.activeElement;
  closeChooser(rb, false);
  if (ids.length === 1 && rb.sel.slideId !== slideId) rb.select({ slideId, objectId: null, itemId: null });
  state.query = '';
  state.similar = false;
  // A key press has no element to hang the popover from: it docks or centres, and the
  // focus goes back to what had it.
  const point = pointAnchor(0, 0);
  if (!anchor && before instanceof HTMLElement && before !== document.body) point.delegate = before;
  const at: PopoverAnchor = anchor ?? point;
  // The popover draws its content on open(), which runs after `slot` is set below.
  let slot: PopoverSlot | null = null;
  const handle = mountBodyPopover(at, (box) => (slot ? popoverContent(rb, box, slot) : null), {
    className: 'rb-lc-pop',
    role: 'dialog',
    ariaLabel: t('Change layout'),
    position: (box: HTMLDivElement, at2: PopoverAnchor) => {
      if (dockOverColumn(rb, box)) return;
      if (anchor) anchorBelow(box, at2);
      else centred(box);
    },
    onClose: () => {
      if (state.matchTimer !== null) clearTimeout(state.matchTimer);
      state.matchTimer = null;
      slot?.chooser?.dispose();
      if (state.pop === slot) state.pop = null;
      state.preview = null;
      state.marksRun += 1;
      syncPreview(rb);
    },
  });
  slot = { handle, slideIds: ids, entry, chooser: null };
  state.pop = slot;
  handle.open();
}

/** True while the chooser is open as a popover, over the rest of the view. */
export function chooserPopoverOpen(rb: RbCtx): boolean {
  return stateOf(rb).pop !== null;
}

/**
 * Close the chooser and put the committed slide back in the pane. The popover returns
 * focus to what opened it.
 */
export function closeChooser(rb: RbCtx, returnFocus = true): void {
  const state = stateOf(rb);
  if (state.matchTimer !== null) clearTimeout(state.matchTimer);
  state.matchTimer = null;
  state.preview = null;
  state.similar = false;
  state.marksRun += 1;
  if (state.pop) {
    const slot = state.pop;
    state.pop = null;
    slot.handle.close(returnFocus);
  }
  syncPreview(rb);
}

export function chooserOps(rb: RbCtx) {
  return {
    open: bindOp(rb, openChooser),
    close: bindOp(rb, closeChooser),
    isOpen: bindOp(rb, chooserPopoverOpen),
    popoverOpen: bindOp(rb, chooserPopoverOpen),
    sync: bindOp(rb, syncPreview),
    apply: bindOp(rb, applyLayout),
    arrange: bindOp(rb, applyArrangement),
    arrangementName: bindOp(rb, (_rb: RbCtx, arrangement: SlideArrangementV1, as: 'action' | 'state' = 'action') => arrangementName(arrangement, as)),
    master: bindOp(rb, masterOf),
    autoMatchCounts: bindOp(rb, autoMatchCounts),
    matchedText: bindOp(rb, (_rb: RbCtx, touched: number, likely: number) => matchedText(touched, likely)),
    likelySet: bindOp(rb, (_rb: RbCtx, before: RenovationPlanV1 | null | undefined, after: RenovationPlanV1 | null | undefined) => likelySet(before, after)),
    matchLabel: bindOp(rb, (_rb: RbCtx, count: number, blocked?: boolean) => matchLabel(count, blocked)),
    autoMatchBlockedFor: bindOp(rb, autoMatchBlockedFor),
    autoMatchState: bindOp(rb, autoMatchState),
    noteAutoMatchRefused: bindOp(rb, noteAutoMatchRefused),
    similar: bindOp(rb, similarSlides),
  };
}
