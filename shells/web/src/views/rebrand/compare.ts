// SPDX-License-Identifier: MPL-2.0
/**
 * rebrand: the stage (plan 274 section 4 "Comparison", plan 275 close-out section 3.4).
 *
 * Owns `rb.els.compare`. Three rows: the Original inset with its caption and the
 * `Original | Proposed | Both` segment, the hero, and the hero's caption. The hero shows
 * the Proposed slide by default; the inset beside the segment shows the other side, and
 * a press on it swaps the two. `Both` sets the two panes side by side at equal size with
 * a caption under each. The hero is sized to its column through the grid and
 * `--rb-ratio`, never to fixed pixels, so it follows when the columns are resized.
 *
 * Both panes are drawn through the engine's `framePreviewSvg` with
 * `rb.controller.mediaHref` for pictures, so they share one renderer. A slide rebuilt
 * from its picture (plan 275 decision 29) is the exception: its Original is that
 * untouched picture, with the rebuilt objects as the overlay's invisible buttons over
 * it. The Proposed drawing is set in the design system's faces (`proposedFonts`), and
 * it waits for the controller's `fontsReady` when the controller reports one, so the
 * slide is drawn once with the real face rather than a fallback that then swaps.
 *
 * Hold to compare (section 5): a pointer held on the hero, not on an object, shows the
 * Original after 250 ms (300 ms on touch) until it is released; 6 px of movement before
 * that cancels it, the click that follows a completed hold is swallowed, and holding
 * the backslash key does the same from the keyboard. The Original pane is mounted on
 * idle while the Proposed shows, from the same cached string, so the first hold swaps
 * at once.
 *
 * Each pane's caption states what is not fine in a few words: "2 drawn roughly",
 * "Left out", "Text is cut off in 2 boxes" (with the cut-off idiom on each box from the
 * compile's `text.overflow` entries), "Preparing". A slide whose objects were all
 * removed says so inside its frame and offers Keep as a picture. A slide that continues
 * carries the part pager at the end of its caption. Objects the compile could place on
 * no slide are the tray under the pane, each row with its crop.
 *
 * This module also owns the drawing cache the queue, the filmstrip, the decision column
 * and the report share (`rb.compare.draw`, `rb.compare.crop`): one SVG string per deck,
 * plan revision, frame and side, sized where it is mounted, and evicted by string bytes
 * against a budget of its own (24 MB on a desktop, 6 MB on a phone). A crop is that
 * same string with a `viewBox` of its own and, when asked, one appended outline, never a
 * drawing of its own.
 */
import '../../styles/parts/panel.css';
import {
  designTextFit,
  framePreviewSvg,
  plainOfDesignText,
  type FramePreviewOptsV1,
  type ReviewFidelityV1,
} from '@lolly/engine';
import type { CompiledDeckV1, CompiledFrameV1, DesignBoxRowV1, SlideSourceV1, SourceObjectV1 } from '@lolly-tools/core/rebrand-v1';
import { t, tRaw } from '../../i18n.ts';
import { decodeBudgetFor, resolutionLadder, type ResolutionLadderV1 } from '../../lib/rebrand/budget.ts';
import { icon } from '../../lib/icons.ts';
import { segHtml } from '../../lib/seg.ts';
import { layoutName, layoutThumb, svgNode } from '../../lib/slide-structures-ui.ts';
import { escape as htmlEscape } from '../../utils.ts';
import { archetypeThumbSvg } from '../free-canvas/archetype-thumb.ts';
import { bindOp, type RbCtx } from './context.ts';
import { framesForSlide, layoutFlagWord, objectSnippet, readableTitle, suggestedLayoutOf, unplacedOf, type RbCompareSide } from './shared.ts';

/** The drawing cache's own budget, in bytes of SVG string (UTF-16, two bytes a character). */
export const DRAW_BUDGET_BYTES = 24 * 1024 * 1024;
/** The same on a phone. */
export const DRAW_BUDGET_BYTES_NARROW = 6 * 1024 * 1024;

/** A stale preview is said once when it lasts longer than this, so a quick edit is heard once, in its own words. */
export const STALE_SAY_MS = 1500;

/** How long a held pointer waits before the Original shows: a fine pointer, then touch or pen. */
export const HOLD_ARM_MS = 250;
export const TOUCH_ARM_MS = 300;
/** Movement before the arm fires that reads as a drag or a scroll, not a hold. */
export const HOLD_SLOP_PX = 6;

/** An object under this share of its slide leads its card with its own crop (plan 275 close-out principle 6). */
export const SMALL_OBJECT_SHARE = 0.08;

/** The Original inset's width and the part pager's thumbnail width, in CSS px (rebrand-compare.css). */
const INSET_EDGE = 176;
const PART_EDGE = 48;

/** Remembered once a person has held the slide, so the hint under the hero goes away. */
const HOLD_SEEN_KEY = 'lolly-rebrand-hold-seen';

export interface CachedDrawing {
  svg: string;
  /** A picture reference had no drawable URL yet, so the next ask draws again. */
  missing: boolean;
}

/** What a crop draws. */
export interface CropOptions {
  /** Outline the object's box with one appended rectangle. */
  outline?: boolean;
  /** The whole slide rather than the object's region (with `outline`, the slide with the box outlined). */
  slide?: boolean;
  /**
   * The object's own layers alone on its slide's ground, with nothing the slide draws
   * over or beside it: for a mark, whose card must show the mark even where the source
   * slide covers it (a picture or a panel drawn on top).
   */
  alone?: boolean;
  /**
   * The long edge, in CSS px, of the cell the crop is mounted in. When the region shown
   * is drawn no larger than the thumbnail size at that cell, the crop cuts from the
   * slide's thumbnail drawing rather than the full one. Absent: the full drawing.
   */
  longEdge?: number;
}

/** An empty box on the Proposed slide: a placeholder the compile authored, or a slot left empty. */
export interface RbPlaceholder {
  slideId: string;
  layerId: string;
  /** "Empty title", for the decision column's head. */
  name: string;
}

/** One box whose text the compile estimates runs past its box. */
export interface RbCutOff {
  layerId: string;
  /** Words the box clips, at least 1. */
  words: number;
  /** The edge Design clips at, from the row's vertical alignment. */
  edge: 'top' | 'bottom' | 'both';
}

interface CacheRow extends CachedDrawing {
  bytes: number;
}

interface HoldArm {
  timer: ReturnType<typeof setTimeout> | null;
  x: number;
  y: number;
  dispose: () => void;
}

interface CompareState {
  cache: Map<string, CacheRow>;
  bytes: number;
  ladder: { key: string; value: ResolutionLadderV1 } | null;
  /** What each part last drew, so a redraw with nothing new leaves the DOM alone. */
  originalKey: string;
  proposedKey: string;
  insetKey: string;
  overlayKey: string;
  /** Source object id to output layer ids, per deck. */
  forward: WeakMap<CompiledDeckV1, Map<string, string[]>>;
  /** A part still waits on a picture, so the next render may not skip. */
  pending: boolean;
  /** The Original shows because a pointer or the backslash key is held on the hero. */
  held: boolean;
  arm: HoldArm | null;
  /** The click that ends a completed hold is not a pick. */
  swallow: boolean;
  /** Which part of a continuing slide the hero shows. */
  part: { slideId: string; index: number };
  placeholder: RbPlaceholder | null;
  /** The Original pane's mount on idle while the Proposed shows. */
  idle: { cancel: () => void; key: string } | null;
  /** A stale period that has lasted long enough to be said, once. */
  stale: ReturnType<typeof setTimeout> | null;
  staleSaid: boolean;
}

/** A short stable number per deck object, so the memo key changes when a deck is replaced. */
const DECK_IDS = new WeakMap<CompiledDeckV1, number>();
let deckSeq = 0;
function deckIdentity(deck: CompiledDeckV1): number {
  let id = DECK_IDS.get(deck);
  if (id === undefined) {
    deckSeq += 1;
    id = deckSeq;
    DECK_IDS.set(deck, id);
  }
  return id;
}

/** Projects where a person has picked an object on the slide this session, so the first-run line goes. */
const pickedIn = new Set<string>();

let holdSeen = readHoldSeen();

function readHoldSeen(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(HOLD_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markHoldSeen(): void {
  if (holdSeen) return;
  holdSeen = true;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(HOLD_SEEN_KEY, '1');
  } catch {
    /* a private window or blocked storage keeps the hint for this session only */
  }
}

const states = new WeakMap<RbCtx, CompareState>();

function stateOf(rb: RbCtx): CompareState {
  let state = states.get(rb);
  if (!state) {
    state = {
      cache: new Map(),
      bytes: 0,
      ladder: null,
      originalKey: '',
      proposedKey: '',
      insetKey: '',
      overlayKey: '',
      forward: new WeakMap(),
      pending: false,
      held: false,
      arm: null,
      swallow: false,
      part: { slideId: '', index: 0 },
      placeholder: null,
      idle: null,
      stale: null,
      staleSaid: false,
    };
    states.set(rb, state);
  }
  return state;
}

// ─── the shared drawing cache ────────────────────────────────────────────────

/** Thumbnail and preview sizes for this deck on this device. */
export function ladderFor(rb: RbCtx): ResolutionLadderV1 {
  const state = stateOf(rb);
  const slides = rb.state.source?.slides.length ?? 1;
  const key = `${slides}|${rb.narrow}`;
  if (state.ladder?.key === key) return state.ladder.value;
  const nav: (Navigator & { deviceMemory?: number }) | undefined = typeof navigator === 'undefined' ? undefined : navigator;
  const hints: Parameters<typeof decodeBudgetFor>[0] = { isMobile: rb.narrow };
  if (typeof nav?.deviceMemory === 'number') hints.deviceMemoryGb = nav.deviceMemory;
  if (typeof nav?.hardwareConcurrency === 'number') hints.hardwareConcurrency = nav.hardwareConcurrency;
  const value = resolutionLadder(decodeBudgetFor(hints), slides);
  state.ladder = { key, value };
  return value;
}

/**
 * The design system's faces for a proposed drawing (close-out section 9.2): the brand
 * face for every run, and its mono face for runs the source marked as code when the
 * design system declares one. Reads `designSystem.faces` when the controller carries it,
 * else the first face and the first one named as a mono face.
 */
export function proposedFonts(rb: RbCtx): { brand?: string; mono?: string } {
  const system = rb.state.designSystem;
  if (!system) return {};
  const out: { brand?: string; mono?: string } = {};
  if ('faces' in system) {
    const faces: unknown = system.faces;
    if (faces && typeof faces === 'object') {
      if ('brand' in faces && typeof faces.brand === 'string' && faces.brand) out.brand = faces.brand;
      if ('mono' in faces && typeof faces.mono === 'string' && faces.mono) out.mono = faces.mono;
    }
  }
  const [first] = system.fonts;
  if (!out.brand && first) out.brand = first;
  if (!out.mono) {
    const mono = system.fonts.find((face) => /mono|code/i.test(face));
    if (mono) out.mono = mono;
  }
  return out;
}

/**
 * False while the controller says the design system's faces are still loading
 * (`fontsReady`, when it reports it). The Proposed pane waits for it rather than drawing
 * a fallback face that swaps a moment later.
 */
export function fontsReady(rb: RbCtx): boolean {
  const state = rb.state;
  return !('fontsReady' in state) || state.fontsReady !== false;
}

function budgetOf(rb: RbCtx): number {
  return rb.narrow ? DRAW_BUDGET_BYTES_NARROW : DRAW_BUDGET_BYTES;
}

/**
 * One frame drawn as an SVG string, from the cache when it was drawn before for the
 * same deck, plan revision, frame and side, with whether a picture in it is still
 * loading. The string carries the frame's own size; where it is mounted, CSS sizes it
 * (`width: 100%; height: 100%`), so every small picture shares one string and the hero
 * and the Original pane share another. `proposed` draws in the design system's faces.
 *
 * `longEdge` is the size, in CSS px, the caller mounts the drawing at. Up to this
 * device's thumbnail size (`ladder().thumbnailLongEdge`) the drawing is the engine's
 * thumbnail level, drawn once at that size for every small picture (the filmstrip, the
 * queue, All slides, the report, the part pager, the inset): it leaves out what cannot
 * be seen at that size, so a chart slide's thumbnail holds tens of kilobytes rather than
 * the megabyte its outlined labels take in full. 0, or anything larger, is the full
 * drawing the hero shows. The two levels are cached apart.
 */
export function drawEntry(rb: RbCtx, deck: CompiledDeckV1, frame: CompiledFrameV1, longEdge: number, proposed: boolean): CachedDrawing {
  const state = stateOf(rb);
  const fonts = proposed ? proposedFonts(rb) : {};
  const thumbEdge = ladderFor(rb).thumbnailLongEdge;
  const thumb = longEdge > 0 && longEdge <= thumbEdge;
  const key = `${proposed ? 'p' : 'o'}|${deckIdentity(deck)}|${deck.source.instanceId}|${deck.planRevision}|${frame.id}|${fonts.brand ?? ''}|${fonts.mono ?? ''}|${thumb ? 't' : 'f'}`;
  const hit = state.cache.get(key);
  if (hit && !hit.missing) {
    // Most recently used last, so eviction takes the oldest first.
    state.cache.delete(key);
    state.cache.set(key, hit);
    return hit;
  }
  let missing = false;
  const assetHref = (ref: string): string | undefined => {
    const href = rb.controller.mediaHref(ref);
    if (href === undefined) missing = true;
    return href;
  };
  // The stage draws its own empty boxes over the hero (`.rb-ph`: an empty title hatched
  // at rest, the other slots on hover), so the shared drawing leaves them out; the
  // strip and the queue show the slide as it will read.
  const opts: FramePreviewOptsV1 = { assetHref, emptySlots: false };
  if (thumb) {
    opts.detail = 'thumbnail';
    opts.longEdge = thumbEdge;
  }
  if (fonts.brand || fonts.mono) opts.fonts = { ...(fonts.brand ? { brand: fonts.brand } : {}), ...(fonts.mono ? { mono: fonts.mono } : {}) };
  const svg = framePreviewSvg(frame, opts);
  const row: CacheRow = { svg, missing, bytes: svg.length * 2 };
  if (hit) {
    state.cache.delete(key);
    state.bytes -= hit.bytes;
  }
  state.cache.set(key, row);
  state.bytes += row.bytes;
  const budget = budgetOf(rb);
  for (const [oldest, old] of state.cache) {
    if (state.bytes <= budget || oldest === key) break;
    state.cache.delete(oldest);
    state.bytes -= old.bytes;
  }
  return { svg, missing };
}

/** One frame drawn as an SVG string; see `drawEntry`. */
export function drawFrame(rb: RbCtx, deck: CompiledDeckV1, frame: CompiledFrameV1, longEdge: number, proposed: boolean): string {
  return drawEntry(rb, deck, frame, longEdge, proposed).svg;
}

/** What the cache holds, for tests and the performance HUD. */
export function drawCacheInfo(rb: RbCtx): { entries: number; bytes: number; budget: number } {
  const state = stateOf(rb);
  return { entries: state.cache.size, bytes: state.bytes, budget: budgetOf(rb) };
}

/** Round to hundredths, for a viewBox. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Replace the root element's size and viewBox. Everything after the root tag is the drawing's own. */
function withView(svg: string, view: number[], aspect: string): string {
  return svg.replace(/^<svg([^>]*)>/, (_whole, attrs: string) => {
    const kept = attrs
      .replace(/\s(?:width|height|viewBox|preserveAspectRatio)="[^"]*"/g, '')
      .replace(/\s(?:role|aria-label)="[^"]*"/g, '');
    return `<svg${kept} viewBox="${view.map(r2).join(' ')}" preserveAspectRatio="${aspect}" aria-hidden="true">`;
  });
}

/** What a crop cuts from: the object's box on its Original slide, the slide's size, and the drawing at a size. */
interface CropSource {
  box: { x: number; y: number; w: number; h: number };
  width: number;
  height: number;
  /** The slide's drawing, at the thumbnail level when `longEdge` is at or under the thumbnail size. */
  draw: (longEdge: number) => CachedDrawing;
}

/**
 * The Original of a slide as a crop can cut from it: the faithful frame's drawing, or
 * for a slide rebuilt from its picture, that picture set on the slide's own box. The
 * box is where the object's layers are on the faithful frame, or its source box. With
 * `alone`, the drawing is the frame's ground and the object's own layers, nothing else.
 */
function cropSource(rb: RbCtx, objectId: string, alone: boolean): CropSource | null {
  const slideId = rb.derived?.objects.get(objectId)?.slideId;
  const slide = rb.state.source?.slides.find((one) => one.id === slideId);
  const object = slide?.objects.find((one) => one.id === objectId);
  if (!slide || !object) return null;
  const picture = recoveryRefOf(slide);
  if (picture) {
    const href = rb.controller.mediaHref(picture);
    const w = slide.width > 0 ? slide.width : 1;
    const h = slide.height > 0 ? slide.height : 1;
    const image = href ? `<image href="${htmlEscape(href)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>` : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${image}</svg>`;
    return { box: object.box, width: w, height: h, draw: () => ({ svg, missing: !href }) };
  }
  const faithful = rb.state.faithful;
  const frame = faithful && slideId ? framesForSlide(faithful.frames, slideId)[0] : undefined;
  if (!faithful || !frame) return null;
  const head = frame.layers[0];
  const ox = head && head.kind === 'frame' ? num(head, 'x') : 0;
  const oy = head && head.kind === 'frame' ? num(head, 'y') : 0;
  const ids = new Set(layersOf(rb, faithful, objectId));
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const row of frame.layers) {
    if (!ids.has(String(row.id ?? '')) || row === head) continue;
    const x = num(row, 'x') - ox;
    const y = num(row, 'y') - oy;
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + num(row, 'w'));
    y1 = Math.max(y1, y + num(row, 'h'));
  }
  const box = Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : object.box;
  // The object alone: the frame's own row (its ground) and the object's layers, as a
  // frame of its own id, so the cache keeps it apart from the whole slide.
  const shown: CompiledFrameV1 = alone && ids.size > 0
    ? { ...frame, id: `${frame.id}~${objectId}`, layers: frame.layers.filter((row) => row === head || ids.has(String(row.id ?? ''))) }
    : frame;
  return { box, width: frame.width, height: frame.height, draw: (longEdge) => drawEntry(rb, faithful, shown, longEdge, false) };
}

/**
 * One object shown from its Original slide, from the cached string of that slide: its
 * own region widened to `ratio` around its centre and held inside the slide, so the
 * slide's ground fills the box rather than a letterbox. `{ slide: true }` shows the whole
 * slide instead, and `{ outline: true }` draws the object's box as one appended
 * rectangle (`.rb-crop-mark`), so a region reads as a place on its slide; `{ alone: true }`
 * draws the object without what the slide paints over it. A slide rebuilt from its
 * picture crops the picture itself. `missing` says a picture in it is still loading, so
 * the caller draws it again on the next state change. Empty when the object or its slide
 * is not known. Never stored: the slide's string is, and a crop is that string with a
 * new first tag. With `longEdge`, a crop whose region shows the slide small enough cuts
 * from the thumbnail drawing, so a cell of 32 px never holds a chart's full outlines.
 */
export function crop(rb: RbCtx, objectId: string, ratio: number, opts: CropOptions = {}): CachedDrawing {
  const source = cropSource(rb, objectId, opts.alone === true);
  if (!source) return { svg: '', missing: false };
  const { box, width, height } = source;
  let view: number[];
  if (opts.slide) {
    view = [0, 0, width, height];
  } else {
    const pad = Math.max(4, box.w * 0.08, box.h * 0.08);
    let w = box.w + pad * 2;
    let h = box.h + pad * 2;
    const want = ratio > 0 ? ratio : 4 / 3;
    if (w / h > want) h = w / want;
    else w = h * want;
    // Held inside the slide when it fits, so the crop never shows the page behind it.
    if (w > width && width > 0) {
      w = width;
      h = w / want;
    }
    if (h > height && height > 0) {
      h = height;
      w = h * want;
    }
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const x = Math.min(Math.max(cx - w / 2, Math.min(0, width - w)), Math.max(0, width - w));
    const y = Math.min(Math.max(cy - h / 2, Math.min(0, height - h)), Math.max(0, height - h));
    view = [x, y, w, h];
  }
  // The whole slide's long edge as the cell shows it: the cell's edge scaled by how much
  // of the slide the view takes. At or under the thumbnail size, the thumbnail drawing.
  const cell = opts.longEdge ?? 0;
  const [, , viewW = width, viewH = height] = view;
  const scale = Math.max(viewW > 0 ? width / viewW : 1, viewH > 0 ? height / viewH : 1);
  const drawn = source.draw(cell > 0 ? Math.ceil(cell * scale) : 0);
  let svg = withView(drawn.svg, view, 'xMidYMid meet');
  if (opts.outline) {
    const mark = `<rect class="rb-crop-mark" x="${r2(box.x)}" y="${r2(box.y)}" width="${r2(Math.max(1, box.w))}" height="${r2(Math.max(1, box.h))}"`
      + ' fill="none" vector-effect="non-scaling-stroke"/>';
    svg = svg.replace(/<\/svg>\s*$/, `${mark}</svg>`);
  }
  return { svg, missing: drawn.missing };
}

/** The share of its slide an object's box covers, 0 when the slide has no size. */
export function objectShare(rb: RbCtx, objectId: string): number {
  const slideId = rb.derived?.objects.get(objectId)?.slideId;
  const slide = rb.state.source?.slides.find((one) => one.id === slideId);
  const object = slide?.objects.find((one) => one.id === objectId);
  if (!slide || !object || !(slide.width > 0) || !(slide.height > 0)) return 0;
  return (Math.max(0, object.box.w) * Math.max(0, object.box.h)) / (slide.width * slide.height);
}

/** Output layer ids for one source object in a compiled deck, through its lineage. */
export function layersOf(rb: RbCtx, deck: CompiledDeckV1, objectId: string): string[] {
  const state = stateOf(rb);
  let map = state.forward.get(deck);
  if (!map) {
    map = new Map(deck.lineage.forward.map((row) => [row.sourceObjectId, row.layerIds]));
    state.forward.set(deck, map);
  }
  return map.get(objectId) ?? [];
}

// ─── wording ─────────────────────────────────────────────────────────────────

/** Objects on a slide by fidelity. */
function tallyOf(rb: RbCtx, slide: SlideSourceV1): Record<ReviewFidelityV1, number> {
  const tally: Record<ReviewFidelityV1, number> = { editable: 0, picture: 0, approximate: 0, unavailable: 0 };
  for (const object of slide.objects) tally[rb.derived?.objects.get(object.id)?.fidelity ?? 'editable'] += 1;
  return tally;
}

/**
 * What the Proposed slide cannot show as it is, in a few words, or nothing when it is
 * fine: "2 drawn roughly", "1 not drawn". A picture kept as a picture is fine. A slide
 * rebuilt from its picture says nothing here: every object on it was read from that
 * picture, which the Original line already says, and its real problem (text cut off)
 * has a line of its own.
 */
function fidelitySentence(rb: RbCtx, slideId: string): string {
  const slide = rb.state.source?.slides.find((one) => one.id === slideId);
  if (!slide || recoveryRefOf(slide)) return '';
  const tally = tallyOf(rb, slide);
  if (tally.unavailable > 0) return tRaw('{n} not drawn', { n: tally.unavailable });
  if (tally.approximate > 0) return tRaw('{n} drawn roughly', { n: tally.approximate });
  return '';
}

/**
 * What was read from the original slide, with the numbers in it: "22 objects",
 * "11 objects, 1 picture", "9 objects, 2 not drawn". A slide rebuilt from its picture
 * says where its objects came from instead, since the pane shows that picture.
 */
function originalSentence(rb: RbCtx, slideId: string): string {
  const slide = rb.state.source?.slides.find((one) => one.id === slideId);
  const count = slide?.objects.length ?? 0;
  if (!slide || count === 0) return tRaw('No objects');
  if (recoveryRefOf(slide)) {
    return count === 1 ? tRaw('1 object read from the picture') : tRaw('{count} objects read from the picture', { count });
  }
  const tally = tallyOf(rb, slide);
  const objects = count === 1 ? tRaw('1 object') : tRaw('{count} objects', { count });
  if (tally.unavailable > 0) return tRaw('{objects}, {n} not drawn', { objects, n: tally.unavailable });
  if (tally.approximate > 0) return tRaw('{objects}, {n} drawn roughly', { objects, n: tally.approximate });
  if (tally.picture === 1) return tRaw('{objects}, 1 picture', { objects });
  if (tally.picture > 0) return tRaw('{objects}, {n} pictures', { objects, n: tally.picture });
  return objects;
}

/** The slide's name for a drawing's accessible name: its readable title, else "Slide 3". */
function slideName(rb: RbCtx, slideId: string): string {
  const state = rb.derived?.slides.find((one) => one.id === slideId);
  return readableTitle(state?.title) ?? tRaw('Slide {n}', { n: state?.number ?? 1 });
}

/** A drawing named for its pane: "Original: MEDDPICC-based Selling". Only the root tag changes. */
function named(svg: string, name: string): string {
  return svg.replace(/^<svg([^>]*)>/, (_whole, attrs: string) => {
    const kept = attrs.replace(/\s(?:role|aria-label|aria-hidden)="[^"]*"/g, '');
    return `<svg${kept} role="img" aria-label="${htmlEscape(name)}">`;
  });
}

/** True when the device's main pointer is coarse: "Tap" rather than "Click". */
function coarsePointer(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

// ─── the skeleton ────────────────────────────────────────────────────────────

function skeleton(side: RbCompareSide): string {
  const seg = segHtml('rb-side', [
    { id: 'original', label: t('Original') },
    { id: 'proposed', label: t('Proposed') },
    { id: 'both', label: t('Both') },
  ], side, t('Show'), { variant: 'panel', attr: 'data-side', extraClass: 'rb-cmp-seg' });
  return `<div class="rb-cmp" data-side="${side}" data-show="${side}">
    <h2 class="visually-hidden">${t('Original and proposed slide')}</h2>
    <div class="rb-cmp-row" data-bar>
      <div class="rb-inset" data-inset>
        <button type="button" class="rb-inset-art" data-inset-art></button>
        <p class="rb-inset-cap"><strong data-inset-name></strong><span data-inset-note></span><span class="rb-inset-first" data-first-run hidden></span></p>
      </div>
      ${seg}
    </div>
    <div class="rb-cmp-panes">
      <figure class="rb-pane" data-pane="original">
        <div class="rb-cell">
          <div class="rb-stage rb-hero" data-stage>
            <div class="rb-art" data-art></div>
            <div class="rb-ov-layer" data-overlay role="group" aria-label="${t('Objects on this slide')}"></div>
          </div>
        </div>
        <figcaption class="rb-pane-cap"><strong>${t('Original')}</strong><span class="rb-pane-note" data-note></span></figcaption>
      </figure>
      <figure class="rb-pane" data-pane="proposed">
        <div class="rb-frames rb-cell" data-frames></div>
        <figcaption class="rb-pane-cap">
          <strong>${t('Proposed')}</strong><span class="rb-pane-layout" data-layout></span><span class="rb-pane-note" data-note></span>
          <span class="rb-pane-busy" data-busy hidden>${t('Updating')}</span>
          <span class="rb-pane-hint" data-hold-hint hidden></span>
          <button type="button" class="rb-part" data-part hidden><span class="rb-part-art" data-part-art aria-hidden="true"></span><span data-part-name></span>${icon('chevronRight')}</button>
        </figcaption>
        <div class="rb-tray" data-unplaced-list hidden></div>
      </figure>
    </div>
    <div class="rb-cmp-layout" data-layout-row hidden>
      <button type="button" class="rb-cmp-layout-open" data-layout-open aria-haspopup="dialog">
        <span class="rb-cmp-layout-wire" data-layout-wire aria-hidden="true"></span>
        <span class="rb-cmp-layout-name" data-layout-name></span>
        <span class="rb-cmp-layout-flag" data-layout-flag></span>
      </button>
      <button type="button" class="btn btn--ghost btn--sm rb-cmp-layout-change" data-layout-change aria-haspopup="dialog">${t('Change')}${icon('arrowRight')}</button>
    </div>
  </div>`;
}

function part(rb: RbCtx, selector: string): HTMLElement | null {
  return rb.els.compare.querySelector<HTMLElement>(selector);
}

/**
 * A pane's slide proportions, which size its hero, its caption and its tray together
 * (rebrand-compare.css `--rb-hero-w`). Set on the pane, since a 4:3 deck's Original and
 * its 16:9 Proposed differ.
 */
function paneRatio(rb: RbCtx, side: 'original' | 'proposed', ratio: string): void {
  const pane = part(rb, `[data-pane="${side}"]`);
  if (pane && pane.style.getPropertyValue('--rb-ratio') !== ratio) pane.style.setProperty('--rb-ratio', ratio);
}

// ─── geometry ────────────────────────────────────────────────────────────────

type OverlayBox = { x: number; y: number; w: number; h: number; rot: number };

/** Percentages of the slide for one box, the overlay's geometry. */
function boxStyle(box: { x: number; y: number; w: number; h: number; rot?: number }, width: number, height: number): string {
  const pct = (value: number, of: number): string => `${of > 0 ? Math.round((value / of) * 10000) / 100 : 0}%`;
  return `--x:${pct(box.x + box.w / 2, width)};--y:${pct(box.y + box.h / 2, height)};--w:${pct(box.w, width)};--h:${pct(box.h, height)};--r:${Math.round(box.rot ?? 0)}deg`;
}

function num(row: DesignBoxRowV1, key: string): number {
  const value = Number(row[key]);
  return Number.isFinite(value) ? value : 0;
}

/** A layer's box on its frame, the frame's own origin taken off. */
function rowBox(frame: CompiledFrameV1, row: DesignBoxRowV1): OverlayBox {
  const head = frame.layers[0];
  const ox = head && head.kind === 'frame' ? num(head, 'x') : 0;
  const oy = head && head.kind === 'frame' ? num(head, 'y') : 0;
  return { x: num(row, 'x') - ox, y: num(row, 'y') - oy, w: num(row, 'w'), h: num(row, 'h'), rot: num(row, 'rot') };
}

/** The frame's width over its height. */
function ratioOf(frame: { width: number; height: number }): string {
  return frame.height > 0 ? (frame.width / frame.height).toFixed(4) : '1.7778';
}

function nounOf(rb: RbCtx, object: SourceObjectV1): string {
  const klass = rb.derived?.objects.get(object.id)?.class ?? 'unknown';
  return rb.queue.noun(klass, 'one', true, object.kind);
}

/** The overlay's name for one object: what it is and what was decided, never a command. */
function overlayLabel(noun: string, action: string): string {
  if (action === 'replace') return tRaw('{noun}, replaced', { noun });
  if (action === 'remove') return tRaw('{noun}, removed', { noun });
  return tRaw('{noun}, kept', { noun });
}

/**
 * The words a box whose text is cut off adds to its object's name, so a screen reader
 * finds the boxes the caption counts: ", text cut off, 2 words".
 */
function cutName(name: string, words: number): string {
  return words === 1 ? tRaw('{name}, text cut off, 1 word', { name }) : tRaw('{name}, text cut off, {n} words', { name, n: words });
}

function overlayButton(rb: RbCtx, objectId: string, object: SourceObjectV1 | undefined, style: string, cut = 0): string {
  const action = rb.derived?.objects.get(objectId)?.action ?? 'keep';
  const said = overlayLabel(object ? nounOf(rb, object) : rb.queue.noun('unknown', 'one', true), action);
  const label = cut > 0 ? cutName(said, cut) : said;
  return `<button type="button" class="rb-ov" data-object="${htmlEscape(objectId)}" data-action="${action}" tabindex="-1"`
    + ` style="${style}" aria-label="${htmlEscape(label)}"></button>`;
}

/** The Original overlay: one button per source object, largest first so a small one sits on top. */
function drawOverlay(rb: RbCtx, slideId: string): void {
  const layer = part(rb, '[data-overlay]');
  const slide = rb.state.source?.slides.find((one) => one.id === slideId);
  if (!layer) return;
  if (!slide) {
    layer.innerHTML = '';
    return;
  }
  const objects = [...slide.objects].sort((a, b) => (b.box.w * b.box.h) - (a.box.w * a.box.h));
  layer.innerHTML = objects.map((object) => overlayButton(rb, object.id, object, boxStyle(object.box, slide.width, slide.height))).join('');
}

/**
 * A slide kept as it was and drawn as its one picture: every object on it maps to that
 * one layer, so the layer says nothing about where each object is. Each object's box is
 * its source box moved into the place the picture takes on the frame, the same box the
 * Original pane's overlay puts it in. Empty for every other frame.
 */
function keptPictureBoxes(rb: RbCtx, deck: CompiledDeckV1, frame: CompiledFrameV1): Map<string, OverlayBox> {
  const out = new Map<string, OverlayBox>();
  const slide = rb.state.source?.slides.find((one) => one.id === frame.sourceSlideId);
  const arrangement = rb.derived?.plan.slides.find((one) => one.id === frame.sourceSlideId)?.arrangement;
  const recovery = slide?.recovery?.assetRef;
  if (!slide || arrangement !== 'picture' || !recovery || !(slide.width > 0) || !(slide.height > 0)) return out;
  const traced = new Set(deck.lineage.backward.filter((edge) => !edge.derived && edge.sourceObjectIds.length > 0).map((edge) => edge.layerId));
  const picture = frame.layers.find((row) => row.kind === 'image' && row.image === recovery && traced.has(String(row.id ?? '')));
  if (!picture) return out;
  const at = rowBox(frame, picture);
  const sx = at.w / slide.width;
  const sy = at.h / slide.height;
  for (const object of slide.objects) {
    const { x, y, w, h } = object.box;
    out.set(object.id, { x: at.x + x * sx, y: at.y + y * sy, w: w * sx, h: h * sy, rot: object.box.rot ?? 0 });
  }
  return out;
}

/** The name an empty slot goes by: "Empty title". */
function emptyName(role: string): string {
  if (role === 'title') return tRaw('Empty title');
  if (role === 'subtitle') return tRaw('Empty subtitle');
  if (role === 'body' || role === 'text') return tRaw('Empty text box');
  if (role === 'image' || role === 'picture') return tRaw('Empty picture box');
  return tRaw('Empty box');
}

/** One empty box on a proposed frame, as the overlay places it. */
export interface RbEmptyBox {
  layerId: string;
  box: OverlayBox;
  /** The source object the placeholder stands for, when it stands for one. */
  objectId: string | null;
  name: string;
  /** The drawing hatches it already (an authored placeholder); a bare slot is hatched by the overlay. */
  drawn: boolean;
  /** The slot's role on the layout ("title", "body", "label"), or empty. */
  role: string;
}

/**
 * The empty boxes on a proposed frame: each placeholder the compile authored (its box,
 * not its label) with the source object it stands for, and each text slot the layout
 * left with no words. The drawing hatches the first kind; the overlay hatches the second,
 * and is the target over both.
 */
export function placeholdersOf(deck: CompiledDeckV1, frame: CompiledFrameV1): RbEmptyBox[] {
  const authored = new Set(frame.placeholderLayerIds);
  const furniture = new Set(frame.furnitureLayerIds);
  const source = new Map<string, string>();
  for (const edge of deck.lineage.backward) {
    const first = edge.sourceObjectIds[0];
    if (first) source.set(edge.layerId, first);
  }
  const out: RbEmptyBox[] = [];
  const head = frame.layers[0];
  for (const row of frame.layers) {
    if (row === head || row.hidden === true) continue;
    const id = String(row.id ?? '');
    const box = rowBox(frame, row);
    if (!(box.w > 0) || !(box.h > 0)) continue;
    const role = typeof row.role === 'string' ? row.role : '';
    if (authored.has(id)) {
      if (id.endsWith('.label')) continue;
      out.push({ layerId: id, box, objectId: source.get(id) ?? null, name: emptyName(role), drawn: true, role });
      continue;
    }
    if (furniture.has(id) || row.kind !== 'text' || !role) continue;
    if (plainOfDesignText(String(row.text ?? '')).trim()) continue;
    out.push({ layerId: id, box, objectId: null, name: emptyName(role), drawn: false, role });
  }
  return out;
}

/**
 * The boxes on a proposed frame whose text the compile estimates runs past the box
 * (`text.overflow`), each with an estimate of the words cut, from the same average
 * glyph width the compile measures with.
 */
export function cutOffOf(deck: CompiledDeckV1, frame: CompiledFrameV1): RbCutOff[] {
  const rows = new Map(frame.layers.map((row) => [String(row.id ?? ''), row]));
  const out: RbCutOff[] = [];
  const seen = new Set<string>();
  for (const entry of deck.report.entries) {
    if (entry.code !== 'text.overflow' || !entry.layerId || seen.has(entry.layerId)) continue;
    const row = rows.get(entry.layerId);
    if (!row) continue;
    seen.add(entry.layerId);
    out.push({ layerId: entry.layerId, ...wordsCut(row) });
  }
  return out;
}

/**
 * The words a text box clips and the edge it clips them at, from the engine's own
 * Design layout (`designTextFit`), the one the compile fits with and the preview
 * draws, so the count is what the drawing shows. Design clips a top-aligned box at
 * its foot, a bottom-aligned one at its head, and a centred one at both. At least 1,
 * since the compile only reports a box that runs past its edge.
 */
function wordsCut(row: DesignBoxRowV1): { words: number; edge: RbCutOff['edge'] } {
  const valign = typeof row.valign === 'string' ? row.valign : '';
  const edge: RbCutOff['edge'] = valign === 'top' ? 'bottom' : valign === 'bottom' ? 'top' : 'both';
  return { words: Math.max(1, designTextFit(row).wordsCut), edge };
}

/**
 * The overlay on the proposed slide: one button per source object that reached it,
 * placed on the largest layer the lineage maps back to that object, largest first so a
 * small one sits on top, then the empty boxes as targets of their own. Layers the master
 * or the compile added belong to no object. A slide kept as its one picture places each
 * object at its own place in the picture instead.
 */
function proposedOverlay(rb: RbCtx, deck: CompiledDeckV1, frame: CompiledFrameV1, cuts: RbCutOff[] = []): string {
  const slide = rb.state.source?.slides.find((one) => one.id === frame.sourceSlideId);
  const kept = keptPictureBoxes(rb, deck, frame);
  // The words each object's cut-off boxes lose, through the lineage, for its name.
  const cutBy = new Map<string, number>();
  if (cuts.length > 0) {
    const words = new Map(cuts.map((cut) => [cut.layerId, cut.words]));
    for (const edge of deck.lineage.backward) {
      const lost = words.get(edge.layerId);
      const first = edge.sourceObjectIds[0];
      if (lost && first) cutBy.set(first, (cutBy.get(first) ?? 0) + lost);
    }
  }
  let buttons = '';
  if (kept.size > 0) {
    buttons = [...kept.entries()]
      .sort(([, a], [, b]) => b.w * b.h - a.w * a.h)
      .map(([objectId, box]) => overlayButton(rb, objectId, slide?.objects.find((one) => one.id === objectId), boxStyle(box, frame.width, frame.height), cutBy.get(objectId)))
      .join('');
  } else {
    const owner = new Map<string, string>();
    for (const edge of deck.lineage.backward) {
      const first = edge.sourceObjectIds[0];
      if (first && !edge.derived) owner.set(edge.layerId, first);
    }
    const head = frame.layers[0];
    const best = new Map<string, DesignBoxRowV1>();
    for (const row of frame.layers) {
      const objectId = owner.get(String(row.id ?? ''));
      if (!objectId || row === head) continue;
      const held = best.get(objectId);
      if (!held || num(row, 'w') * num(row, 'h') > num(held, 'w') * num(held, 'h')) best.set(objectId, row);
    }
    buttons = [...best.entries()]
      .sort(([, a], [, b]) => num(b, 'w') * num(b, 'h') - num(a, 'w') * num(a, 'h'))
      .map(([objectId, row]) => overlayButton(rb, objectId, slide?.objects.find((one) => one.id === objectId), boxStyle(rowBox(frame, row), frame.width, frame.height), cutBy.get(objectId)))
      .join('');
  }
  const empties = placeholdersOf(deck, frame).map((one) => {
    const target = one.objectId ? ` data-object="${htmlEscape(one.objectId)}"` : '';
    const slot = one.drawn ? '' : ` data-slot="${htmlEscape(one.role)}"`;
    return `<button type="button" class="rb-ph" data-ph="${htmlEscape(one.layerId)}" data-ph-name="${htmlEscape(one.name)}"${target}${slot} tabindex="-1"`
      + ` style="${boxStyle(one.box, frame.width, frame.height)}" aria-label="${htmlEscape(one.name)}"></button>`;
  }).join('');
  const all = buttons + empties;
  return all ? `<div class="rb-ov-layer" role="group" aria-label="${t('Objects on this slide')}">${all}</div>` : '';
}

/** The cut-off idiom on each box: a thin band at the clipped edge and its count. */
function cutOffHtml(frame: CompiledFrameV1, cuts: RbCutOff[]): string {
  if (cuts.length === 0) return '';
  const rows = new Map(frame.layers.map((row) => [String(row.id ?? ''), row]));
  const marks = cuts.map((cut) => {
    const row = rows.get(cut.layerId);
    if (!row) return '';
    const words = cut.words === 1 ? t('1 word cut') : t('{n} words cut', { n: cut.words });
    return `<span class="rb-cut" data-cut="${htmlEscape(cut.layerId)}" data-edge="${cut.edge}" style="${boxStyle(rowBox(frame, row), frame.width, frame.height)}"><span class="rb-cut-count">${words}</span></span>`;
  }).join('');
  return `<div class="rb-cuts" aria-hidden="true">${marks}</div>`;
}

/** The selected object's outline on both panes, and the selected empty box. */
function markSelection(rb: RbCtx): void {
  const state = stateOf(rb);
  const selected = rb.sel.objectId;
  const box = state.placeholder;
  for (const button of rb.els.compare.querySelectorAll<HTMLElement>('.rb-ov, .rb-ph')) {
    const on = button.classList.contains('rb-ph')
      ? (box !== null && button.dataset.ph === box.layerId) || (selected !== null && button.dataset.object === selected)
      : button.dataset.object === selected;
    if (on) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  }
  const deck = rb.state.preview?.deck;
  for (const holder of rb.els.compare.querySelectorAll<HTMLElement>('[data-outlines]')) holder.innerHTML = '';
  if (!deck || !selected) return;
  const layerIds = new Set(layersOf(rb, deck, selected));
  if (layerIds.size === 0) return;
  for (const frameEl of rb.els.compare.querySelectorAll<HTMLElement>('[data-frame]')) {
    const frame = deck.frames.find((one) => one.id === frameEl.dataset.frame);
    const holder = frameEl.querySelector<HTMLElement>('[data-outlines]');
    if (!frame || !holder) continue;
    // A slide kept as its one picture outlines the object's own place in it, not the whole picture.
    const keptBox = keptPictureBoxes(rb, deck, frame).get(selected);
    const boxes = keptBox ? [keptBox] : frame.layers.filter((row) => layerIds.has(String(row.id ?? ''))).map((row) => rowBox(frame, row));
    holder.innerHTML = boxes.map((one) => `<span class="rb-outline" style="${boxStyle(one, frame.width, frame.height)}"></span>`).join('');
  }
}

/**
 * The untouched picture of a slide rebuilt from one (plan 275 decision 29): the
 * whole-slide picture the rebuild kept as `recovery`, a pptx slide picture or a
 * flattened PDF page alike. Undefined for every other slide.
 */
export function recoveryRefOf(slide: SlideSourceV1 | undefined): string | undefined {
  return slide?.origin.flattened === true ? slide.recovery?.assetRef : undefined;
}

// ─── the panes ───────────────────────────────────────────────────────────────

/** The side the hero shows now: the chosen side, or the Original while it is held. */
function shownSide(rb: RbCtx): RbCompareSide {
  const state = stateOf(rb);
  return state.held && rb.compareSide === 'proposed' ? 'original' : rb.compareSide;
}

/**
 * The Original's art for one slide as markup, with the key it was drawn under; empty key
 * while a picture loads. `longEdge` is the size it is mounted at (0 for a pane).
 */
function originalArt(rb: RbCtx, slideId: string, longEdge = 0): { html: string; key: string; ratio: string; wait: boolean } | null {
  const slide = rb.state.source?.slides.find((one) => one.id === slideId);
  const picture = recoveryRefOf(slide);
  if (slide && picture) {
    const href = rb.controller.mediaHref(picture);
    const ratio = slide.height > 0 ? (slide.width / slide.height).toFixed(4) : '1.7778';
    if (!href) return { html: `<span class="rb-art-wait">${t('The picture is loading.')}</span>`, key: '', ratio, wait: true };
    const alt = t('The original picture of slide {n}', { n: slide.index + 1 });
    return {
      html: `<img class="rb-art-pic" src="${htmlEscape(href)}" alt="${alt}" decoding="async" draggable="false">`,
      key: `pic|${picture}|${href}`,
      ratio,
      wait: false,
    };
  }
  const faithful = rb.state.faithful;
  const frame = faithful ? framesForSlide(faithful.frames, slideId)[0] : undefined;
  if (!faithful || !frame) return null;
  const entry = drawEntry(rb, faithful, frame, longEdge, false);
  return {
    html: named(entry.svg, tRaw('Original: {name}', { name: slideName(rb, slideId) })),
    key: entry.missing ? '' : `${deckIdentity(faithful)}|${frame.id}|${longEdge}`,
    ratio: ratioOf(frame),
    wait: false,
  };
}

/** Put the Original's art into the Original pane. */
function mountOriginal(rb: RbCtx, slideId: string): void {
  const state = stateOf(rb);
  const art = part(rb, '[data-pane="original"] [data-art]');
  const stage = part(rb, '[data-pane="original"] [data-stage]');
  if (!art || !stage) return;
  const drawn = originalArt(rb, slideId);
  const slide = rb.state.source?.slides.find((one) => one.id === slideId);
  if (slide && recoveryRefOf(slide)) stage.dataset.original = 'picture';
  else delete stage.dataset.original;
  if (!drawn) {
    state.originalKey = '';
    art.innerHTML = '';
    delete art.dataset.wait;
    return;
  }
  const key = `${slideId}|${drawn.key}`;
  paneRatio(rb, 'original', drawn.ratio);
  if (drawn.key && key === state.originalKey) return;
  if (drawn.wait) art.dataset.wait = '';
  else delete art.dataset.wait;
  art.innerHTML = drawn.html;
  state.originalKey = drawn.key ? key : '';
}

/** Run once the page is idle, or soon after where the browser has no idle callback. */
function whenIdle(run: () => void): () => void {
  const idle = typeof window !== 'undefined' ? window.requestIdleCallback : undefined;
  if (typeof idle === 'function') {
    const handle = idle.call(window, run, { timeout: 500 });
    return () => window.cancelIdleCallback?.(handle);
  }
  const timer = setTimeout(run, 32);
  return () => clearTimeout(timer);
}

/**
 * The Original pane. Mounted now when it shows; while the Proposed shows it is mounted
 * on idle from the cached string, so the first hold swaps at once.
 */
function drawOriginal(rb: RbCtx, slideId: string, shows: boolean): void {
  const state = stateOf(rb);
  const note = part(rb, '[data-pane="original"] [data-note]');
  const faithful = rb.state.faithful;
  const slide = rb.state.source?.slides.find((one) => one.id === slideId);
  const ready = Boolean(recoveryRefOf(slide)) || Boolean(faithful && framesForSlide(faithful.frames, slideId)[0]);
  if (note) note.textContent = ready ? originalSentence(rb, slideId) : tRaw('Preparing');
  if (shows) {
    state.idle?.cancel();
    state.idle = null;
    mountOriginal(rb, slideId);
    return;
  }
  if (state.idle?.key === slideId) return;
  state.idle?.cancel();
  const cancel = whenIdle(() => {
    state.idle = null;
    if (rb.sel.slideId === slideId && rb.els.compare.isConnected) mountOriginal(rb, slideId);
  });
  state.idle = { cancel, key: slideId };
}

/** The inset: the side the hero does not show, small, with its name and one line. */
function drawInset(rb: RbCtx, slideId: string, shown: RbCompareSide): void {
  const state = stateOf(rb);
  const inset = part(rb, '[data-inset]');
  const art = part(rb, '[data-inset-art]');
  const name = part(rb, '[data-inset-name]');
  const note = part(rb, '[data-inset-note]');
  if (!inset || !art || !name || !note) return;
  // Both panes show under Both; a phone shows one pane and the segment only.
  const off = shown === 'both' || rb.narrow;
  inset.hidden = off;
  if (off) {
    if (state.insetKey) art.innerHTML = '';
    state.insetKey = '';
    return;
  }
  const side: RbCompareSide = shown === 'original' ? 'proposed' : 'original';
  name.textContent = side === 'original' ? tRaw('Original') : tRaw('Proposed');
  art.setAttribute('aria-label', side === 'original' ? tRaw('Show the Original') : tRaw('Show the Proposed'));
  art.dataset.show = side;
  if (side === 'original') {
    note.textContent = originalSentence(rb, slideId);
    const drawn = originalArt(rb, slideId, INSET_EDGE);
    const key = `o|${slideId}|${drawn?.key ?? ''}`;
    if (drawn?.key && key === state.insetKey) return;
    art.style.setProperty('--rb-ratio', drawn?.ratio ?? '1.7778');
    art.innerHTML = drawn ? drawn.html.replace(/^<svg([^>]*?) role="img"/, '<svg$1 aria-hidden="true" data-role="img"') : '';
    state.insetKey = drawn?.key ? key : '';
    return;
  }
  const deck = rb.state.preview?.deck;
  const frames = deck ? framesForSlide(deck.frames, slideId) : [];
  const frame = frames[Math.min(partIndex(rb, slideId, frames.length), Math.max(0, frames.length - 1))];
  note.textContent = layoutWord(rb, slideId);
  if (!deck || !frame || !fontsReady(rb)) {
    art.innerHTML = '';
    state.insetKey = '';
    return;
  }
  const entry = drawEntry(rb, deck, frame, INSET_EDGE, true);
  const key = `p|${deckIdentity(deck)}|${frame.id}`;
  if (!entry.missing && key === state.insetKey) return;
  art.style.setProperty('--rb-ratio', ratioOf(frame));
  art.innerHTML = entry.svg;
  state.insetKey = entry.missing ? '' : key;
}

/** Which part of a continuing slide the hero shows, reset when the slide changes. */
function partIndex(rb: RbCtx, slideId: string, parts: number): number {
  const state = stateOf(rb);
  if (state.part.slideId !== slideId) state.part = { slideId, index: 0 };
  if (state.part.index >= parts) state.part.index = 0;
  return state.part.index;
}

/** The layout a slide uses, in the name the filmstrip and the chooser use. */
function layoutWord(rb: RbCtx, slideId: string): string {
  const row = rb.derived?.plan.slides.find((one) => one.id === slideId);
  if (!row) return '';
  if (row.arrangement === 'original' || row.arrangement === 'picture') return rb.chooser.arrangementName(row.arrangement, 'state');
  const master = rb.chooser.master();
  return master ? layoutName(master, row.layout) : '';
}

/**
 * Slide state, for the empty frame: how many objects the proposal keeps with something to
 * draw on the slide, and how many it removed. A kept object whose layers draw nothing (an
 * empty text box, a box of no size) or that went to the tray does not count as kept, so
 * a blank frame always says why it is blank.
 */
function keptCount(rb: RbCtx, deck: CompiledDeckV1, slideId: string): { objects: number; kept: number; removed: number } {
  const slide = rb.state.source?.slides.find((one) => one.id === slideId);
  const rows = new Map<string, DesignBoxRowV1>();
  for (const frame of framesForSlide(deck.frames, slideId)) {
    for (const row of frame.layers) rows.set(String(row.id ?? ''), row);
  }
  const draws = (row: DesignBoxRowV1 | undefined): boolean => {
    if (!row || row.hidden === true || !(num(row, 'w') > 0) || !(num(row, 'h') > 0)) return false;
    return row.kind !== 'text' || plainOfDesignText(String(row.text ?? '')).trim() !== '';
  };
  let kept = 0;
  let removed = 0;
  for (const object of slide?.objects ?? []) {
    if (rb.derived?.objects.get(object.id)?.action === 'remove') removed += 1;
    else if (layersOf(rb, deck, object.id).some((id) => draws(rows.get(id)))) kept += 1;
  }
  return { objects: slide?.objects.length ?? 0, kept, removed };
}

function drawProposed(rb: RbCtx, slideId: string): void {
  const state = stateOf(rb);
  const holder = part(rb, '[data-frames]');
  const note = part(rb, '[data-pane="proposed"] [data-note]');
  const layout = part(rb, '[data-pane="proposed"] [data-layout]');
  const busy = part(rb, '[data-busy]');
  const pager = part(rb, '[data-part]');
  // A preview that failed is not updating: the pane says so, and the band under the top
  // bar offers Try again.
  const failed = rb.state.error?.step === 'preview';
  if (busy) busy.hidden = !rb.state.previewStale || failed;
  sayStale(rb, rb.state.previewStale && !failed);
  if (!holder || !note) return;
  const slide = rb.derived?.slides.find((one) => one.id === slideId);
  const deck = rb.state.preview?.deck;
  const frames = deck ? framesForSlide(deck.frames, slideId) : [];
  const leftOut = Boolean(slide && !slide.include);
  const waiting = !fontsReady(rb);
  if (layout) layout.textContent = layoutWord(rb, slideId);
  const index = partIndex(rb, slideId, frames.length);
  const frame = frames[index];
  if (frame) paneRatio(rb, 'proposed', ratioOf(frame));
  const cuts = deck && frame && !leftOut ? cutOffOf(deck, frame) : [];
  note.replaceChildren();
  delete note.dataset.tone;
  if (failed) {
    note.textContent = tRaw('The proposed slide could not be updated.');
  } else if (leftOut) {
    note.textContent = tRaw('Left out');
  } else if (!deck || frames.length === 0 || waiting) {
    note.textContent = tRaw('Preparing');
  } else if (cuts.length > 0) {
    note.dataset.tone = 'danger';
    const glyph = svgNode(icon('alert'));
    if (glyph) note.append(glyph);
    note.append(cuts.length === 1 ? tRaw('Text is cut off in 1 box') : tRaw('Text is cut off in {n} boxes', { n: cuts.length }));
  } else {
    note.textContent = fidelitySentence(rb, slideId);
  }
  drawPager(rb, pager, deck, frames, index);
  // A slide left out keeps its picture, dimmed: the proposal when there is one, else the Original.
  if (leftOut && (!deck || !frame)) {
    const drawn = originalArt(rb, slideId);
    const key = `out|${slideId}|${drawn?.key ?? ''}`;
    if (drawn) paneRatio(rb, 'proposed', drawn.ratio);
    if (drawn?.key && key === state.proposedKey) return;
    holder.innerHTML = drawn
      ? `<div class="rb-frame" data-left-out><div class="rb-stage rb-hero" style="--rb-ratio:${drawn.ratio}"><div class="rb-art">${drawn.html}</div></div></div>`
      : '';
    state.proposedKey = drawn?.key ? key : '';
    return;
  }
  if (!deck || !frame || waiting) {
    state.proposedKey = '';
    holder.innerHTML = '';
    return;
  }
  const empty = keptCount(rb, deck, slideId);
  const key = [deckIdentity(deck), frame.id, rb.derived?.plan.revision ?? '', leftOut, cuts.map((cut) => `${cut.layerId}:${cut.words}`).join(','), empty.kept, empty.removed].join('|');
  if (key === state.proposedKey) return;
  const entry = drawEntry(rb, deck, frame, 0, true);
  const svg = named(entry.svg, tRaw('Proposed: {name}', { name: slideName(rb, slideId) }));
  let emptyNote = '';
  if (!leftOut && index === 0 && empty.removed > 0 && empty.kept === 0) {
    const sentence = empty.removed === 1
      ? t('Nothing kept on this slide. 1 object was removed.')
      : t('Nothing kept on this slide. {n} objects were removed.', { n: empty.removed });
    const offer = rb.controller.setArrangement
      ? `<button type="button" class="btn btn--ghost btn--sm" data-keep-picture>${t('Keep as a picture')}</button>`
      : '';
    emptyNote = `<div class="rb-empty"><p>${sentence}</p>${offer}</div>`;
  }
  holder.innerHTML = `<div class="rb-frame"${leftOut ? ' data-left-out' : ''} data-frame="${htmlEscape(frame.id)}">`
    + `<div class="rb-stage rb-hero" style="--rb-ratio:${ratioOf(frame)}"><div class="rb-art">${svg}</div>`
    + `${cutOffHtml(frame, cuts)}<div class="rb-outlines" data-outlines aria-hidden="true"></div><div class="rb-outlines" data-hints aria-hidden="true"></div>`
    + `${leftOut ? '' : proposedOverlay(rb, deck, frame, cuts)}${emptyNote}</div></div>`;
  state.proposedKey = entry.missing ? '' : key;
}

/**
 * "Updating the proposed slides." through the live region, once per stale period and
 * only when the period outlasts STALE_SAY_MS: a quick edit is heard once, as the footer's
 * outcome, and a slow recompile is not silent.
 */
function sayStale(rb: RbCtx, stale: boolean): void {
  const state = stateOf(rb);
  if (!stale) {
    if (state.stale !== null) clearTimeout(state.stale);
    state.stale = null;
    state.staleSaid = false;
    return;
  }
  if (state.stale !== null || state.staleSaid) return;
  state.stale = setTimeout(() => {
    state.stale = null;
    if (!rb.state.previewStale || !rb.els.compare.isConnected) return;
    state.staleSaid = true;
    rb.announce(tRaw('Updating the proposed slides.'));
  }, STALE_SAY_MS);
}

/** The part pager: the next part's thumbnail, "Part 1 of 2" and a chevron. Hidden for a slide in one part. */
function drawPager(rb: RbCtx, pager: HTMLElement | null, deck: CompiledDeckV1 | undefined, frames: CompiledFrameV1[], index: number): void {
  if (!pager) return;
  const art = pager.querySelector<HTMLElement>('[data-part-art]');
  const name = pager.querySelector<HTMLElement>('[data-part-name]');
  pager.hidden = !deck || frames.length < 2;
  if (!deck || frames.length < 2 || !art || !name) {
    if (art?.dataset.key) {
      art.replaceChildren();
      delete art.dataset.key;
    }
    return;
  }
  const next = frames[(index + 1) % frames.length];
  const words = tRaw('Part {n} of {count}', { n: index + 1, count: frames.length });
  name.textContent = words;
  pager.setAttribute('aria-label', tRaw('{part}. Show part {next}', { part: words, next: ((index + 1) % frames.length) + 1 }));
  if (!next || !fontsReady(rb)) return;
  const entry = drawEntry(rb, deck, next, PART_EDGE, true);
  const key = `${deckIdentity(deck)}|${next.id}`;
  if (art.dataset.key === key && !entry.missing) return;
  art.style.setProperty('--rb-ratio', ratioOf(next));
  const node = svgNode(entry.svg);
  if (node) art.replaceChildren(node);
  else art.replaceChildren();
  if (entry.missing) delete art.dataset.key;
  else art.dataset.key = key;
}

/** Width of the layout row's wireframe on a phone, in CSS px (close-out section 2.8). */
const LAYOUT_ROW_WIRE = 40;

/** Who set a slide's layout, in one or two words: the same word the Layout band's flag says. */
function layoutProvenance(rb: RbCtx, slideId: string): string {
  const row = rb.derived?.plan.slides.find((one) => one.id === slideId);
  return row ? layoutFlagWord(row, suggestedLayoutOf(rb.chooser.master(), row)) : '';
}

/**
 * On a phone, one row under the slide (close-out section 2.8): the layout's wireframe,
 * its name and who set it, which opens the slide's sheet, and Change, which opens the
 * layout chooser. Hidden on a wider screen, where the decision column says the same.
 */
function drawLayoutRow(rb: RbCtx, slideId: string): void {
  const row = part(rb, '[data-layout-row]');
  if (!row) return;
  const plan = rb.derived?.plan.slides.find((one) => one.id === slideId);
  const name = plan ? layoutWord(rb, slideId) : '';
  const show = rb.narrow && rb.state.mode === 'renovate' && Boolean(name);
  row.hidden = !show;
  if (!show || !plan) return;
  const flag = layoutProvenance(rb, slideId);
  const nameEl = part(rb, '[data-layout-name]');
  const flagEl = part(rb, '[data-layout-flag]');
  const wire = part(rb, '[data-layout-wire]');
  const open = part(rb, '[data-layout-open]');
  if (nameEl && nameEl.textContent !== name) nameEl.textContent = name;
  if (flagEl && flagEl.textContent !== flag) flagEl.textContent = flag;
  open?.setAttribute('aria-label', tRaw('{layout}, {flag}. Open the slide settings', { layout: name, flag }));
  const master = rb.chooser.master();
  const key = master && plan.arrangement !== 'original' && plan.arrangement !== 'picture' ? `${master.id}|${plan.layout}` : '';
  if (wire && wire.dataset.key !== key) {
    wire.dataset.key = key;
    const node = master && key ? svgNode(layoutThumb(master, plan.layout, LAYOUT_ROW_WIRE, archetypeThumbSvg)) : null;
    if (node) wire.replaceChildren(node);
    else wire.replaceChildren();
  }
}

/**
 * The objects the compile could place on no slide, from the slide on screen: the tray
 * under the Proposed pane. Each row carries its crop and its noun, and selects its
 * source object, whose decision column offers Keep, Replace and Remove as for every
 * object.
 */
function drawUnplaced(rb: RbCtx, slideId: string): void {
  const holder = part(rb, '[data-unplaced-list]');
  if (!holder) return;
  const rows = unplacedOf(rb.state.preview?.deck, rb.derived, rb.state.source).filter((one) => one.slideId === slideId);
  holder.hidden = rows.length === 0;
  if (rows.length === 0) {
    holder.innerHTML = '';
    return;
  }
  const slide = rb.state.source?.slides.find((one) => one.id === slideId);
  let missing = false;
  const items = rows.map(({ objectId }) => {
    const object = slide?.objects.find((one) => one.id === objectId);
    const klass = rb.derived?.objects.get(objectId)?.class ?? 'unknown';
    const current = rb.sel.objectId === objectId ? ' aria-current="true"' : '';
    const noun = rb.queue.noun(klass, 'one', true, object?.kind);
    const words = objectSnippet(object, 40);
    // An object with no words says where it is on its slide, so rows of one kind never read the same.
    const place = !words && object && slide ? placeOnSlide(object.box, slide.width, slide.height) : '';
    // A row with no words is a wider crop, so the picture says what the words would.
    const drawn = crop(rb, objectId, words ? 4 / 3 : 8 / 3, { longEdge: words ? 48 : 96 });
    if (drawn.missing) missing = true;
    const text = words
      ? `<span class="rb-tray-name">${noun}</span><span class="rb-tray-snip">${htmlEscape(words)}</span>`
      : `<span class="rb-tray-name">${place ? t('{noun}, {place}', { noun, place: place.toLocaleLowerCase() }) : noun}</span>`;
    return `<li><button type="button" class="rb-tray-row" data-unplaced="${htmlEscape(objectId)}"${words ? '' : ' data-wide'}${current}>`
      + `<span class="rb-tray-crop" aria-hidden="true">${drawn.svg}</span>${text}</button></li>`;
  }).join('');
  const head = t('Not placed ({count})', { count: rows.length });
  holder.innerHTML = `<p class="rb-tray-head" id="rb-unplaced-head">${head}</p>`
    + `<ul class="rb-tray-rows" role="list" aria-labelledby="rb-unplaced-head">${items}</ul>`;
  if (missing) stateOf(rb).pending = true;
}

/**
 * The part of its slide a box is in, in a word or two, by the third its centre falls in:
 * "Top left", "Middle", "Bottom right". Empty when the slide has no size.
 */
export function placeOnSlide(box: { x: number; y: number; w: number; h: number }, width: number, height: number): string {
  if (!(width > 0) || !(height > 0)) return '';
  const third = (at: number, of: number): 0 | 1 | 2 => (at < of / 3 ? 0 : at < (of * 2) / 3 ? 1 : 2);
  const col = third(box.x + box.w / 2, width);
  const row = third(box.y + box.h / 2, height);
  const names = [
    [t('Top left'), t('Top'), t('Top right')],
    [t('Left'), t('Middle'), t('Right')],
    [t('Bottom left'), t('Bottom'), t('Bottom right')],
  ];
  return names[row]?.[col] ?? '';
}

/**
 * Outline one object on both panes while its row (in the decision column or the tray)
 * has keyboard focus or a pointer over it, the way a pointer over the slide outlines it,
 * so a person moving through a list sees the place of each object.
 */
function hintObject(rb: RbCtx, objectId: string | null): void {
  for (const button of rb.els.compare.querySelectorAll<HTMLElement>('.rb-ov')) {
    if (objectId !== null && button.dataset.object === objectId) button.dataset.hint = '';
    else delete button.dataset.hint;
  }
  // An object the Proposed overlay has no button for (its layers are merged or made by
  // the compile) is outlined through its lineage instead, faintly, as a pointer over it would.
  for (const holder of rb.els.compare.querySelectorAll<HTMLElement>('[data-hints]')) holder.replaceChildren();
  const deck = rb.state.preview?.deck;
  if (!deck || objectId === null) return;
  const layerIds = new Set(layersOf(rb, deck, objectId));
  if (layerIds.size === 0) return;
  for (const frameEl of rb.els.compare.querySelectorAll<HTMLElement>('[data-frame]')) {
    if (frameEl.querySelector(`.rb-ov[data-hint]`)) continue;
    const frame = deck.frames.find((one) => one.id === frameEl.dataset.frame);
    const holder = frameEl.querySelector<HTMLElement>('[data-hints]');
    if (!frame || !holder) continue;
    for (const row of frame.layers) {
      if (!layerIds.has(String(row.id ?? ''))) continue;
      const mark = document.createElement('span');
      mark.className = 'rb-outline';
      mark.dataset.hint = '';
      mark.setAttribute('style', boxStyle(rowBox(frame, row), frame.width, frame.height));
      holder.append(mark);
    }
  }
}

/** The captions that teach: the first pick and the first hold, each shown until it has happened. */
function drawTeaching(rb: RbCtx): void {
  const first = part(rb, '[data-first-run]');
  const hint = part(rb, '[data-hold-hint]');
  const coarse = coarsePointer();
  const project = rb.state.project?.id ?? '';
  const decided = [...(rb.derived?.objects.values() ?? [])].some((one) => one.author === 'user');
  if (first) {
    // Under the Original's name only: while the inset shows the Proposed it says nothing.
    first.hidden = pickedIn.has(project) || decided || shownSide(rb) !== 'proposed';
    first.textContent = coarse ? tRaw('Tap an object to decide on it.') : tRaw('Click an object to decide on it.');
  }
  if (hint) {
    hint.hidden = holdSeen || rb.compareSide !== 'proposed';
    hint.textContent = tRaw('Hold the slide to see the Original');
    // The key is named where a keyboard is: the tooltip, never the caption.
    if (coarse) hint.removeAttribute('title');
    else hint.title = tRaw('Hold the \\ key to see the Original.');
  }
}

// ─── hold to compare ─────────────────────────────────────────────────────────

/** Show the Original on the hero while held, or restore the chosen side. */
export function setHold(rb: RbCtx, on: boolean): void {
  const state = stateOf(rb);
  if (on && rb.compareSide !== 'proposed') return;
  if (state.held === on) return;
  state.held = on;
  if (on) {
    markHoldSeen();
    // Mounted now if the idle mount has not run yet, so the swap is never an empty frame.
    if (rb.sel.slideId) mountOriginal(rb, rb.sel.slideId);
  }
  rb.memo.compare = '';
  renderCompare(rb);
}

function endArm(rb: RbCtx, completed: boolean): void {
  const state = stateOf(rb);
  const arm = state.arm;
  state.arm = null;
  if (arm) {
    if (arm.timer !== null) clearTimeout(arm.timer);
    arm.dispose();
  }
  if (state.held) {
    setHold(rb, false);
    if (completed) {
      // The click that follows the release would select the object under it.
      state.swallow = true;
      setTimeout(() => { state.swallow = false; }, 400);
    }
  }
}

function startArm(rb: RbCtx, e: PointerEvent): void {
  const state = stateOf(rb);
  endArm(rb, false);
  const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
  const onMove = (move: PointerEvent): void => {
    const arm = state.arm;
    if (!arm || state.held) return;
    if (Math.hypot(move.clientX - arm.x, move.clientY - arm.y) > HOLD_SLOP_PX) endArm(rb, false);
  };
  const onEnd = (): void => endArm(rb, true);
  const onLeave = (): void => endArm(rb, true);
  const onMenu = (menu: Event): void => {
    // A long press on touch would open the system menu over the picture.
    if (state.arm || state.held) menu.preventDefault();
  };
  const panes = part(rb, '.rb-cmp-panes');
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
  window.addEventListener('blur', onEnd);
  panes?.addEventListener('pointerleave', onLeave);
  panes?.addEventListener('contextmenu', onMenu);
  const timer = setTimeout(() => {
    if (state.arm) state.arm.timer = null;
    setHold(rb, true);
  }, touch ? TOUCH_ARM_MS : HOLD_ARM_MS);
  state.arm = {
    timer,
    x: e.clientX,
    y: e.clientY,
    dispose: () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      window.removeEventListener('blur', onEnd);
      panes?.removeEventListener('pointerleave', onLeave);
      panes?.removeEventListener('contextmenu', onMenu);
    },
  };
}

/** True when a key press belongs to a field, or to a dialog of the app's own. */
function keyIsElsewhere(e: KeyboardEvent): boolean {
  const target = e.target;
  if (target instanceof HTMLElement) {
    if (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return true;
    if (target instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(target.type)) return true;
  }
  return Boolean(document.querySelector('dialog[open], [aria-modal="true"]:not([hidden])'));
}

function wireHold(rb: RbCtx): void {
  const state = stateOf(rb);
  const onDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target instanceof Element ? e.target : null;
    if (!target || rb.compareSide !== 'proposed') return;
    // Only the hero. An object or an empty box on it arms too, since on a picture deck or
    // a slide full of text they cover the whole slide: a press shorter than the arm is
    // still the pick, and the click after a completed hold is swallowed. Other controls
    // on the hero (Keep as a picture) never arm.
    if (!target.closest('[data-pane="proposed"] [data-frames] .rb-stage')) return;
    if (target.closest('a, button:not(.rb-ov):not(.rb-ph)')) return;
    startArm(rb, e);
  };
  const onClick = (e: Event): void => {
    if (!state.swallow) return;
    state.swallow = false;
    e.preventDefault();
    e.stopPropagation();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || !rb.els.compare.isConnected) return;
    if (e.key === 'Escape' && (state.held || state.arm)) {
      endArm(rb, false);
      setHold(rb, false);
      e.preventDefault();
      return;
    }
    if (e.key !== '\\' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (keyIsElsewhere(e) || !rb.state.plan || rb.state.mode !== 'renovate') return;
    // With single-key shortcuts limited (WCAG 2.1.4), the key acts only while focus is
    // on the stage or the filmstrip.
    if (!rb.keys.singleKeys()) {
      const target = e.target instanceof Node ? e.target : null;
      if (!target || !(rb.els.compare.contains(target) || rb.els.strip.contains(target))) return;
    }
    e.preventDefault();
    if (!e.repeat) setHold(rb, true);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (e.key === '\\' && state.held && !state.arm) setHold(rb, false);
  };
  // A key hold whose key-up never arrives (the window lost focus while the key was down)
  // lets go when the window or the tab does.
  const onAway = (): void => {
    if (state.held && !state.arm) setHold(rb, false);
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') onAway();
  };
  rb.els.compare.addEventListener('pointerdown', onDown);
  rb.els.compare.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onAway);
  document.addEventListener('visibilitychange', onVisibility);
  rb.disposers.push(() => {
    endArm(rb, false);
    state.idle?.cancel();
    state.idle = null;
    if (state.stale !== null) clearTimeout(state.stale);
    state.stale = null;
    rb.els.compare.removeEventListener('pointerdown', onDown);
    rb.els.compare.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onAway);
    document.removeEventListener('visibilitychange', onVisibility);
  });
}

// ─── wiring and rendering ────────────────────────────────────────────────────

export function wireCompare(rb: RbCtx): void {
  // The hero is the Proposed slide with the Original as the inset; a phone keeps the
  // side the orchestrator chose for it.
  if (!rb.narrow && rb.compareSide === 'both') rb.compareSide = 'proposed';
  rb.els.compare.innerHTML = skeleton(rb.compareSide);
  const rowOf = (target: EventTarget | null): string | null =>
    target instanceof Element ? target.closest<HTMLElement>('.rb-obj[data-object], .rb-tray-row[data-unplaced]')?.dataset.object
      ?? target.closest<HTMLElement>('.rb-tray-row[data-unplaced]')?.dataset.unplaced ?? null : null;
  const onEnter = (e: Event): void => hintObject(rb, rowOf(e.target));
  const onLeave = (e: Event): void => {
    const related = 'relatedTarget' in e && e.relatedTarget instanceof EventTarget ? e.relatedTarget : null;
    hintObject(rb, rowOf(related));
  };
  for (const region of [rb.els.decide, rb.els.compare]) {
    region.addEventListener('focusin', onEnter);
    region.addEventListener('focusout', onLeave);
    region.addEventListener('pointerover', onEnter);
    region.addEventListener('pointerout', onLeave);
  }
  rb.disposers.push(() => {
    for (const region of [rb.els.decide, rb.els.compare]) {
      region.removeEventListener('focusin', onEnter);
      region.removeEventListener('focusout', onLeave);
      region.removeEventListener('pointerover', onEnter);
      region.removeEventListener('pointerout', onLeave);
    }
  });
  wireHold(rb);
  rb.els.compare.addEventListener('click', (e) => {
    const target = e.target as Element;
    // On a phone the decision column is a sheet. The layout row opens it on the slide,
    // and its Change opens the layout chooser.
    const change = target.closest<HTMLElement>('[data-layout-change]');
    if (change) {
      const slideId = rb.sel.slideId;
      if (slideId) rb.chooser.open([slideId], 'inline', change);
      return;
    }
    const opener = target.closest<HTMLElement>('[data-layout-open]');
    if (opener) {
      rb.decide.openSheet(opener);
      return;
    }
    // Only a segment button: `.rb-cmp` carries `data-side` too, and matching it would read
    // every click in the comparison, an overlay object included, as a pane switch.
    const side = target.closest<HTMLElement>('.rb-cmp-seg [data-side], [data-inset-art]');
    if (side) {
      const value = side.dataset.side ?? side.dataset.show;
      if (value === 'original' || value === 'proposed' || value === 'both') {
        rb.compareSide = value;
        rb.memo.compare = '';
        renderCompare(rb);
      }
      return;
    }
    const pager = target.closest<HTMLElement>('[data-part]');
    if (pager) {
      const state = stateOf(rb);
      state.part = { slideId: rb.sel.slideId ?? '', index: state.part.index + 1 };
      rb.memo.compare = '';
      renderCompare(rb);
      return;
    }
    if (target.closest('[data-keep-picture]')) {
      const slideId = rb.sel.slideId;
      if (slideId) void rb.chooser.arrange([slideId], 'picture');
      return;
    }
    const empty = target.closest<HTMLElement>('.rb-ph');
    if (empty && !empty.dataset.object) {
      // An empty slot is selected for itself: the slide stays, and the decision column
      // says which box it is ("Empty title").
      const state = stateOf(rb);
      state.placeholder = { slideId: rb.sel.slideId ?? '', layerId: empty.dataset.ph ?? '', name: empty.dataset.phName ?? '' };
      pickedIn.add(rb.state.project?.id ?? '');
      rb.select({ objectId: null, itemId: null });
      if (rb.narrow) rb.decide.openSheet(empty);
      return;
    }
    const picked = target.closest<HTMLElement>('.rb-ov, .rb-ph, [data-unplaced]');
    const objectId = picked?.dataset.object ?? picked?.dataset.unplaced;
    if (!picked || !objectId) return;
    pickedIn.add(rb.state.project?.id ?? '');
    const slideId = rb.derived?.objects.get(objectId)?.slideId ?? rb.sel.slideId;
    rb.select({ objectId, slideId, itemId: rb.derived?.itemOfObject.get(objectId) ?? null });
    if (rb.narrow) rb.decide.openSheet(picked);
  });
}

/** The empty box selected on the slide, for the decision column's head, or null. */
export function selectedPlaceholder(rb: RbCtx): RbPlaceholder | null {
  const box = stateOf(rb).placeholder;
  return box && box.slideId === rb.sel.slideId && rb.sel.objectId === null ? box : null;
}

/** The boxes cut off on the slide the hero shows, for the Layout band's line. */
export function cutOffOnSlide(rb: RbCtx, slideId: string): RbCutOff[] {
  const deck = rb.state.preview?.deck;
  if (!deck) return [];
  return framesForSlide(deck.frames, slideId).flatMap((frame) => cutOffOf(deck, frame));
}

export function renderCompare(rb: RbCtx): void {
  const state = stateOf(rb);
  const root = part(rb, '.rb-cmp');
  if (!root) return;
  // A selection anywhere else lets go of the empty box.
  if (state.placeholder && (rb.sel.objectId !== null || rb.sel.slideId !== state.placeholder.slideId)) state.placeholder = null;
  if (state.held && rb.compareSide !== 'proposed') state.held = false;
  const shown = shownSide(rb);
  root.dataset.side = rb.compareSide;
  root.dataset.show = shown;
  root.dataset.held = state.held ? 'true' : 'false';
  for (const button of root.querySelectorAll<HTMLElement>('.rb-cmp-seg [data-side]')) {
    button.setAttribute('aria-pressed', button.dataset.side === shown ? 'true' : 'false');
  }
  for (const pane of root.querySelectorAll<HTMLElement>('.rb-pane')) {
    const on = shown === 'both' || pane.dataset.pane === shown;
    pane.toggleAttribute('data-on', on);
    pane.toggleAttribute('inert', !on);
  }
  drawTeaching(rb);
  const slideId = rb.sel.slideId;
  // Everything the panes, the overlay and the outlines read. A progress tick or an
  // emit that moved nothing here leaves the DOM alone.
  const preview = rb.state.preview;
  const key = [
    slideId,
    rb.sel.objectId,
    preview ? `${deckIdentity(preview.deck)}:${preview.planRevision}` : '',
    rb.state.faithful ? deckIdentity(rb.state.faithful) : '',
    rb.derived ? rb.derived.plan.revision : '',
    rb.state.previewStale,
    rb.state.error?.step ?? '',
    rb.narrow,
    rb.compareSide,
    shown,
    state.part.index,
    state.placeholder?.layerId ?? '',
    fontsReady(rb),
    rb.state.designSystem?.id ?? '',
    rb.chooser.master() ? 'master' : '',
  ].join('|');
  if (rb.memo.compare === key && !state.pending) return;
  rb.memo.compare = key;
  if (!slideId || !rb.derived) {
    state.overlayKey = '';
    state.originalKey = '';
    state.proposedKey = '';
    state.insetKey = '';
    for (const el of rb.els.compare.querySelectorAll<HTMLElement>('[data-art], [data-frames], [data-overlay], [data-unplaced-list], [data-inset-art]')) el.innerHTML = '';
    return;
  }
  state.pending = false;
  drawInset(rb, slideId, shown);
  drawOriginal(rb, slideId, shown !== 'proposed');
  drawProposed(rb, slideId);
  drawUnplaced(rb, slideId);
  drawLayoutRow(rb, slideId);
  // A picture still loading left a part's key empty; the next render draws it again.
  if (state.proposedKey === '' || (shown !== 'proposed' && state.originalKey === '') || (shown !== 'both' && !rb.narrow && state.insetKey === '')) state.pending = true;
  const overlayKey = `${slideId}|${rb.derived.plan.revision}|${rb.state.source?.source.instanceId ?? ''}`;
  if (overlayKey !== state.overlayKey) {
    drawOverlay(rb, slideId);
    state.overlayKey = overlayKey;
  }
  markSelection(rb);
}

export function compareOps(rb: RbCtx) {
  return {
    wire: bindOp(rb, wireCompare),
    render: bindOp(rb, renderCompare),
    drawFrame: bindOp(rb, drawFrame),
    draw: bindOp(rb, drawEntry),
    layersOf: bindOp(rb, layersOf),
    ladder: bindOp(rb, ladderFor),
    crop: bindOp(rb, crop),
    objectShare: bindOp(rb, objectShare),
    fonts: bindOp(rb, proposedFonts),
    fontsReady: bindOp(rb, fontsReady),
    hold: bindOp(rb, setHold),
    placeholder: bindOp(rb, selectedPlaceholder),
    cutOff: bindOp(rb, cutOffOnSlide),
    cacheInfo: bindOp(rb, drawCacheInfo),
  };
}
