// SPDX-License-Identifier: MPL-2.0
/**
 * Guest-mark checks: a Design document's partner marks against the partner kit's rules
 * (Lolly Work plan 82 M8). A sibling of `brand-check.ts`, pure and DOM-free, so the app's
 * checks and export pre-flight, `lolly check --kit` and Lolly Work's server read the same
 * answer from the same boxes.
 *
 * Three rules, each only when the kit states it:
 *
 * - Minimum size: the mark's drawn height in export pixels and, on a document measured in
 *   a physical unit, in millimetres, against `rules.minSize`.
 * - Clear space: the mark inflated on every side by `clearSpace.value` times its height.
 *   Any other painted layer that overlaps that band is pointed out, except one beneath the
 *   mark that holds the whole mark, which is its background. Another kit mark is never a
 *   background, so two kit marks check each other.
 * - Treatment: a mark recoloured by a photo treatment or an icon theme is classified from
 *   the catalog's own colours (one colour, or recoloured); a mark whose nearest painted
 *   layer beneath, the artboard included, is a picture sits on a photo. A treatment the kit
 *   does not list is pointed out. `reverse` is in the vocabulary and is not measured: the
 *   logo for dark surfaces is the reverse by construction.
 *
 * The check claims a result only from layers made of what it models (`GUEST_MARK_FIELDS`).
 * A layer that uses anything else (a layout, keyframes, an entrance or exit, a hold, a
 * build, depth or tilt, a connector, or a field the list does not know) could be anywhere
 * at some moment, so every check it could touch is not measured. A shape other than a
 * rectangle, a turn, a mask, a stroke, a shadow, a blur or a pen path on a neighbour, and a
 * blend or a backdrop blur beneath a mark, leave the check they touch not measured when
 * the layer comes near the mark. Whatever the check cannot measure is listed, never passed
 * in silence: in `unmeasured` as a stable code with its counts, for an app to say in the
 * reader's language, and in `notMeasured` as the same entries in English, for the CLI and
 * Work's server. Text is taken to paint inside its box.
 *
 * Findings are reviews and never refusals: nothing here blocks an export, a render or a
 * save, and no finding carries an automatic fix, because sizing a mark is the person's
 * call. Geometry follows the Design renderer: boxes on whole pixels, at least one pixel
 * each way; a mark's picture placed by the draw compiler (`compileDesignRow`,
 * `pictureRect`) with its fit, framing, border, turn and mirror; layers painted in Design's
 * stack order, groups at their stack slot, an artboard beneath everything on the artboard,
 * and `z` as depth, not stacking. Opacity is 0 to 100 and reaches a layer through the groups
 * and the artboard that hold the layer. Timing is Design's: a timed layer is on screen from
 * its played start for its duration, and what a mark sits on is read for each stretch of
 * time. The work is capped (`MAX_WORK` layer comparisons); marks past the cap are counted
 * as not measured. A tool's logo input has no geometry without a render, so only Design
 * documents are measured.
 */
import type { PartnerKitTreatmentV1, PartnerKitV1 } from '@lolly-tools/core/partner-kit-v1';
import type { DesignBoxRowV1 } from '@lolly-tools/core';
import type { BrandFinding } from './brand-check.ts';
import { parseThemedAssetId, parseTreatedAssetId, stripAssetModifiers } from './asset-modifiers.ts';
import { AUTO_ASSET_THEME, parseIconThemesDoc } from './icon-theme.ts';
import { parsePhotoTreatmentsDoc } from './photo-treatment.ts';
import { colorToHexString, parseColor } from './css-color.ts';
import { gradientSpecStops, parseGradientSpec } from './gradient-spec.ts';
import { compileDesignRow, designBool as rendererBool, pictureRect, resolveDrawColor, type DrawPicture } from './design-draw.ts';
import { partnerKitLogoIds } from './partner-kit.ts';
import { CSS_DPI, isUnit } from './units.ts';
import { designHierarchyIndex } from './design-hierarchy.ts';

/** How the document's CSS pixels become export pixels and millimetres. */
export interface GuestMarkMeasure {
  /** The document's unit (`px`, `mm`, `cm`, `in`, `pt`, `pc`). Default `px`. */
  unit?: string;
  /** Raster resolution for a physical unit. Default 300. */
  dpi?: number;
  /** For a pixel document exported at another width than it was laid out at: export px per CSS px. Default 1. */
  scale?: number;
  /** A logo's width over its height, so a contained mark is measured where it is drawn rather than by its box. */
  logoAspect?: (assetId: string) => number | null | undefined;
  /**
   * A logo's own size in CSS pixels. A mark Design draws at its own size (`fit` `none`,
   * or `scale-down`) needs the size; every other fit needs only the logo's proportions.
   */
  logoSize?: (assetId: string) => { width: number; height: number } | null | undefined;
  /** Whether an asset is a raster picture or a vector drawing. Unknown counts as a picture. */
  pictureKind?: (assetId: string) => 'raster' | 'vector' | null | undefined;
  /**
   * What a mark's colour modifier draws it in: `mono` for one colour, `other` for any
   * other recolouring, null when the catalog does not say. `guestRecolourFrom` builds one
   * from the catalog's icon themes and photo treatments. Without one, a recoloured mark's
   * treatment is reported as not measured.
   */
  recolour?: (modifier: { theme?: string; treatment?: string }) => 'mono' | 'other' | null | undefined;
  /**
   * A linked colour (`{token}` or `var(...)`) as the theme being checked paints the colour. A fill
   * that does not resolve is not taken to cover what lies beneath.
   */
  resolveColor?: (value: string) => string | null;
  /**
   * The document's own CSS (Design's `customCss`). It can restyle any layer: a layer with a
   * class it may target is followed nowhere, and the report says the CSS was not read.
   */
  customCss?: string;
}

/**
 * Classify colour modifiers from the catalog's palette documents: an icon theme whose two
 * colours are one colour, or a greyscale photo treatment, is one colour; any other theme or
 * treatment the catalog declares recolours the mark; an id it does not declare is unknown.
 * When the catalog declares an id twice the first wins, which is the one the renderer picks.
 */
export function guestRecolourFrom(catalog: { iconThemes?: unknown; photoTreatments?: unknown } | null | undefined): NonNullable<GuestMarkMeasure['recolour']> {
  const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const firstById = <T extends { id: string }>(list: T[]): Map<string, T> => {
    const out = new Map<string, T>();
    for (const item of list) if (!out.has(item.id)) out.set(item.id, item);
    return out;
  };
  const themes = firstById(parseIconThemesDoc(rec(catalog?.iconThemes) ? catalog!.iconThemes as never : null));
  const looks = firstById(parsePhotoTreatmentsDoc(rec(catalog?.photoTreatments) ? catalog!.photoTreatments as never : null));
  return ({ theme, treatment }) => {
    if (treatment) {
      const look = looks.get(treatment);
      if (!look) return null;
      return look.kind === 'greyscale' ? 'mono' : 'other';
    }
    if (theme) {
      const pair = themes.get(theme);
      if (!pair) return null;
      const c1 = parseColor(String(pair.c1)), c2 = parseColor(String(pair.c2));
      if (!c1 || !c2) return null;
      return colorToHexString(c1).toLowerCase() === colorToHexString(c2).toLowerCase() ? 'mono' : 'other';
    }
    return null;
  };
}

/**
 * Why part of a kit was not measured. `reverse`: reversed use, never measured.
 * `mm-in-pixels`: a minimum in millimetres on a document measured in pixels. `layer-tree`:
 * the layer tree could not be read. `layer-limit`: layers past the first `limit`.
 * `not-drawn`: marks Design draws no picture for. `size`, `clear-space`, `ground`: a mark's
 * drawn height, clear space, or whether it sits on a photo, left open by what is not known
 * of the logo or by paint that covers only part of the mark. `treatment`: a recolouring the
 * catalog does not describe. `surface`: a mark that takes its colours from the surface
 * beneath. `size-unmodelled`, `clear-space-unmodelled`, `ground-unmodelled`: the same three,
 * left open by a layer using what the check does not model. `treatment-unmodelled`: a mark
 * mixed with what lies beneath by a blend, its own or a group's or an artboard's. `work-limit`:
 * marks past the work cap. `findings-limit`: findings past `limit`. `custom-css`: the
 * document's own CSS, which can restyle any layer, was not read.
 */
export type GuestMarkUnmeasuredCode =
  | 'reverse' | 'mm-in-pixels' | 'layer-tree' | 'layer-limit' | 'not-drawn' | 'size'
  | 'clear-space' | 'ground' | 'treatment' | 'surface' | 'size-unmodelled' | 'clear-space-unmodelled'
  | 'ground-unmodelled' | 'treatment-unmodelled' | 'work-limit' | 'findings-limit' | 'custom-css';

export interface GuestMarkUnmeasured {
  code: GuestMarkUnmeasuredCode;
  /** How many marks (or, for `findings-limit`, findings) the entry is about. */
  count?: number;
  /** The cap, for `layer-limit` and `findings-limit`. */
  limit?: number;
}

export interface GuestMarkReport {
  /** `kind: 'mark'`, `status: 'review'`, one per mark and rule. */
  findings: BrandFinding[];
  /** Marks measured, and the kit rules they were measured against. */
  checked: { marks: number; rules: Array<'min-size' | 'clear-space' | 'treatment'> };
  /** What the kit states and this check does not measure, as codes with their counts. */
  unmeasured: GuestMarkUnmeasured[];
  /** The same entries in English, in the same order. */
  notMeasured: string[];
}

/** One `unmeasured` entry in English, the sentence `notMeasured` carries. */
export function guestUnmeasuredText(entry: GuestMarkUnmeasured): string {
  const n = entry.count ?? 1;
  switch (entry.code) {
    case 'reverse': return 'reversed use: the logo for dark surfaces is the reverse, so a reversed mark is not measured';
    case 'mm-in-pixels': return 'the minimum size in millimetres: the document is measured in pixels';
    case 'layer-tree': return 'artboards, groups and paint order: the document\'s layer tree could not be read, so each layer is placed by its own fields and its place in the list';
    case 'layer-limit': return `layers past the first ${(entry.limit ?? MAX_ROWS).toLocaleString('en')}`;
    case 'not-drawn': return `${marksText(n)}: Design draws no picture for the layer as written, so its size, clear space and ground were not measured`;
    case 'size': return `the drawn height of ${marksText(n)}: the logo's proportions or size were not given, so a mark in a box at least the minimum may still draw smaller`;
    case 'clear-space': return `the clear space of ${marksText(n)}: the logo's proportions or size were not given, and a layer lies where the clear space may reach`;
    case 'ground': return `whether ${marksText(n, 'one partner mark sits', 'partner marks sit')} on a photo: what lies beneath is translucent, covers only part of the mark or depends on the logo's proportions`;
    case 'treatment': return `the treatment of ${marksText(n, 'one recoloured mark', 'recoloured marks')}: the catalog does not say what colours its theme or treatment gives`;
    case 'surface': return `the colours of ${marksText(n)} set to follow the surface: the variant is chosen from what is drawn beneath when the page is drawn`;
    case 'size-unmodelled': return `the drawn height of ${marksText(n)}: the mark moves, is placed by a layout or uses a field this check does not model`;
    case 'clear-space-unmodelled': return `the clear space of ${marksText(n)}: the mark or a layer near the mark uses a shape, turn, mask, stroke, effect, layout or movement this check does not model`;
    case 'ground-unmodelled': return `whether ${marksText(n, 'one partner mark sits', 'partner marks sit')} on a photo: the mark or a layer beneath the mark uses a layout, movement, mask, blend or effect this check does not model`;
    case 'treatment-unmodelled': return `the colours of ${marksText(n)}: a blend mixes the mark with what lies beneath`;
    case 'work-limit': return `${marksText(n)}: the document has more layers and marks than the check compares, so the rest were not measured`;
    case 'findings-limit': return `${n === 1 ? 'one more finding' : `${n} more findings`} past the first ${entry.limit ?? MAX_FINDINGS}, which are not listed`;
    case 'custom-css': return 'the document\'s own CSS: the CSS can restyle any layer, and the check reads each layer as Design draws the layer without that CSS';
  }
}

type Row = Record<string, unknown>;
interface Rect { x: number; y: number; w: number; h: number }
/**
 * How far the check can follow a layer. `exact`: its paint is its box, which the check
 * models. `local`: it paints only within its box grown by `margin`, but not exactly where
 * (a shape, turn, mask, stroke, shadow, blur or pen path). `anywhere`: it moves, is placed by
 * a layout or a connector, is lifted or tilted, or uses a field the check does not know.
 */
type Reach = 'exact' | 'local' | 'anywhere';
interface Layer {
  row: Row; id: string; order: number; rect: Rect; label: string; kind: string; image: string;
  start: number; end: number; frame: string; page: string;
  /** How much of what lies beneath this layer covers, 0 to 1; NaN when that cannot be read. */
  cover: number;
  /** Paints something: a picture, a fill, text, a stroke, a shadow, or a kind of its own. */
  paints: boolean;
  reach: Reach;
  /** How far a `local` layer may paint past its box. */
  margin: number;
  /** Beneath a mark, whether it can hold the mark for certain: unturned, unmasked, unblurred. */
  solid: boolean;
  /** Beneath a mark, what it paints cannot be read (a web page, a scene, an unknown kind). */
  unknownPaint: boolean;
  /** A blend mixes it with what lies beneath. */
  blend: boolean;
}
/** Where a mark is drawn: exactly, or only within a region with its height between two bounds. */
interface Placement { exact: boolean; region: Rect; lo: number; hi: number; visibleH: number }

const MAX_ROWS = 5000;
const MAX_FINDINGS = 200;
const MAX_TIME_S = 3600;
/** Layer comparisons the check makes at most; marks past the cap are counted as not measured. */
export const MAX_WORK = 200_000;
/** Layers that are pages, sound or a camera path, never a neighbour on the page. */
const NOT_ON_PAGE = new Set(['frame', 'audio', 'camera']);
/** Kinds whose paint the check models: a box, a picture, text, an artboard and a group (which paints nothing). */
const MODELLED_KINDS = new Set(['box', 'image', 'text', 'frame', 'group']);
const TREATMENT_WORDS: Record<PartnerKitTreatmentV1, string> = { colour: 'full colour', mono: 'one colour', reverse: 'reversed', 'on-photo': 'on a photo' };

/**
 * Every Design row field the check knows. A field outside this list, set to anything, could
 * move the layer, so the layer is followed nowhere (`anywhere`). The fields that change
 * where or how a known layer paints are read by `reachOf`; the rest (text and its styling,
 * sound, names, notes, presentation and layout settings that only apply with a layout) do
 * not change where a layer paints for these checks.
 */
export const GUEST_MARK_FIELDS: ReadonlySet<string> = new Set([
  'id', 'kind', 'x', 'y', 'w', 'h', 'rot', 'shape', 'radius', 'bg', 'opacity', 'image', 'fit', 'blend', 'text', 'fg', 'fontSize',
  'align', 'valign', 'weight', 'font', 'lineHeight', 'tracking', 'ligatures', 'alternates', 'group', 'clip', 'pad', 'shadow',
  'shadowColor', 'shadowX', 'shadowY', 'shadowBlur', 'imgpos', 'fitText', 'path', 'stroke', 'strokeW', 'fillRule', 'start', 'dur',
  'clipIn', 'speed', 'enter', 'exit', 'enterMs', 'exitMs', 'mute', 'lane', 'strokeDash', 'strokeCap', 'strokeJoin', 'grad', 'blur',
  'strokeDashLen', 'strokeGapLen', 'bgBlur', 'enterEase', 'exitEase', 'frame', 'order', 'clipChildren', 'headStart', 'headEnd',
  'strokeDashArray', 'dashFit', 'bindStart', 'bindEnd', 'route', 'z', 'kf', 'linkOf', 'presentAudio', 'build', 'state', 'matchOf',
  'notes', 'flipH', 'flipV', 'cls', 'gain', 'name', 'ignored', 'split', 'stagger', 'splitOrder', 'hold', 'holdRate', 'rx', 'ry',
  'pan', 'duck', 'pitch', 'varispeed', 'fx', 'stackOf', 'hidden', 'locked', 'slideTransition', 'plainText', 'scene', 'animationId',
  'animationEdits', 'textStory', 'textFrame', 'pathPaint', 'vectorSource', 'textWrap', 'master', 'role', 'furniture', 'archetype',
  'textDirection', 'tokenLinks', 'web', 'webView', 'webLoad', 'webCss', 'webHideCookies', 'interact', 'interactOpts', 'layout',
  'layoutOwner', 'layoutOrder', 'layoutDirection', 'layoutWrap', 'layoutGapX', 'layoutGapY', 'layoutPadTop', 'layoutPadRight',
  'layoutPadBottom', 'layoutPadLeft', 'layoutAlign', 'layoutAlignContent', 'layoutJustify', 'layoutJustifyItems', 'layoutW',
  'layoutH', 'layoutMinW', 'layoutMaxW', 'layoutMinH', 'layoutMaxH', 'layoutMarginTop', 'layoutMarginRight', 'layoutMarginBottom',
  'layoutMarginLeft', 'layoutAbsolute', 'layoutSelf', 'layoutJustifySelf', 'layoutRow', 'layoutColumn', 'layoutRowSpan',
  'layoutColumnSpan', 'layoutArea', 'layoutX', 'layoutY', 'layoutAngle', 'pageId', 'strokeAlign', 'strokeTop', 'strokeRight',
  'strokeBottom', 'strokeLeft', 'imageFraming',
]);

const record = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
/**
 * The renderer's `num`: a number, or `parseFloat` of anything else, so "310px" and
 * ["310px"] are 310; what does not read is `fallback`. A value whose text conversion
 * throws reads as `fallback` here, where the renderer would stop.
 */
const designNum = (v: unknown, fallback: number): number => {
  let n: number;
  try {
    n = typeof v === 'number' ? v : Number.parseFloat(v as string);
  } catch {
    n = Number.NaN;
  }
  return Number.isFinite(n) ? n : fallback;
};
/** Every number in a row is read the way the renderer reads numbers. */
const num = (v: unknown, fallback = 0): number => designNum(v, fallback);
/** The renderer's `isFiniteNum`: authored, and a number. */
const designHasNum = (v: unknown): boolean => v !== '' && Number.isFinite(designNum(v, Number.NaN));
/**
 * The renderer's `boolVal`, through the draw compiler's own copy, so `["yes"]` is true, as
 * in the renderer. A value whose text conversion throws reads as `fallback` here.
 */
const designBool = (v: unknown, fallback: boolean): boolean => {
  try {
    return rendererBool(v, fallback);
  } catch {
    return fallback;
  }
};
/** A field set to something: not absent, empty, false, zero or `none`. */
const isSet = (v: unknown): boolean => !(v === undefined || v === null || v === '' || v === false || v === 0 || v === 'none' || (typeof v === 'string' && !v.trim()));
/** An id or reference as a key, without calling a stranger's `toString`. */
const keyOf = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const imageId = (v: unknown): string => (typeof v === 'string' ? v : record(v) && typeof v.id === 'string' ? v.id : '');
const hidden = (row: Row): boolean => designBool(row.hidden, false) || row.__offPage === true;
/** A layer's own opacity as the renderer reads it, 0 to 100 authored, here 0 to 1. */
const opacityOf = (row: Row): number => clamp(designNum(row.opacity, 100), 0, 100) / 100;
const turnedRow = (row: Row): boolean => Math.round(num(row.rot) * 10) % 3600 !== 0;
const strokeWidths = (row: Row): number[] => [row.strokeW, row.strokeTop, row.strokeRight, row.strokeBottom, row.strokeLeft].map((v) => Math.max(0, num(v)));
const stroked = (row: Row): boolean => typeof row.stroke === 'string' && row.stroke.trim() !== '' && strokeWidths(row).some((w) => w > 0);
const shadowed = (row: Row): boolean => isSet(row.shadow);
const shapeOf = (row: Row): string => (typeof row.shape === 'string' && row.shape !== '' ? row.shape : 'rect');
const blended = (row: Row): boolean => typeof row.blend === 'string' && row.blend !== '' && row.blend !== 'normal';

/** More fields than a Design row has: a row this wide is followed nowhere without being read. */
const MAX_ROW_FIELDS = 512;
/** Keys that change an object's prototype when the renderer copies the row, never metadata. */
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Whether a row could be anywhere at some moment, for a reason of its own: it moves (keyframes,
 * an entrance or exit, a hold, a text split, a build, a morph or an animation), is placed by
 * a layout or a connector, is lifted or tilted out of the page, carries a class the
 * document's own CSS may restyle, carries a key that changes its prototype when the renderer
 * copies the row, or uses a field the check does not know. A row with more fields than
 * `MAX_ROW_FIELDS` is followed nowhere unread, so each row costs at most that many reads.
 */
function movesOrFloats(row: Row, styled: boolean): boolean {
  const keys = Object.keys(row);
  if (keys.length > MAX_ROW_FIELDS) return true;
  if (styled && isSet(row.cls)) return true;
  // Composed text flows through its frames, and text on a pen path follows the curve: either can paint past the box.
  if (isSet(row.textStory) || isSet(row.textFrame)) return true;
  if ((row.kind === 'path' || isSet(row.path)) && typeof row.text === 'string' && row.text.trim() !== '') return true;
  if (isSet(row.kf) || isSet(row.hold) || isSet(row.split) || designNum(row.build, 0) >= 1 || isSet(row.matchOf) || isSet(row.animationId) || isSet(row.animationEdits)) return true;
  if (isSet(row.enter) || isSet(row.exit)) return true;
  if (designNum(row.z, 0) !== 0 || designNum(row.rx, 0) !== 0 || designNum(row.ry, 0) !== 0) return true;
  if (isSet(row.route) || isSet(row.bindStart) || isSet(row.bindEnd) || isSet(row.headStart) || isSet(row.headEnd)) return true;
  if (row.layout === 'flex' || row.layout === 'grid' || isSet(row.layoutOwner) || (row.kind === 'group' && (row.layoutW === 'hug' || row.layoutH === 'hug'))) return true;
  for (const key of keys) {
    if (PROTOTYPE_KEYS.has(key)) return true;
    if (!GUEST_MARK_FIELDS.has(key) && !key.startsWith('__') && isSet(row[key])) return true;
  }
  return false;
}

/** How far the check can follow a layer as a neighbour, and how far past its box it may paint. */
function reachOf(row: Row, kind: string, ancestors: Row[], floats: (row: Row) => boolean): { reach: Reach; margin: number } {
  // An artboard is a page: it is never a neighbour, and whatever moves it moves what is drawn on it too.
  if (kind === 'frame') return { reach: 'exact', margin: 0 };
  if (floats(row) || ancestors.some((a) => a.kind !== 'frame' && floats(a))) return { reach: 'anywhere', margin: 0 };
  const margin = (stroked(row) ? Math.max(...strokeWidths(row)) : 0)
    + (shadowed(row) ? Math.abs(num(row.shadowX)) + Math.abs(num(row.shadowY)) + 3 * Math.max(0, num(row.shadowBlur, 10)) : 0)
    + 3 * Math.max(0, num(row.blur));
  const local = margin > 0 || turnedRow(row) || shapeOf(row) !== 'rect' || isSet(row.clip) || kind === 'path' || isSet(row.path) || !MODELLED_KINDS.has(kind);
  return { reach: local ? 'local' : 'exact', margin };
}

/** How much a colour covers: its alpha, or NaN for a linked colour the theme does not resolve. */
function colourCover(value: unknown, resolve: GuestMarkMeasure['resolveColor']): number {
  if (record(value)) return Number.NaN;
  if (typeof value !== 'string' || !value.trim()) return 0;
  const drawn = resolveDrawColor(value, resolve);
  if (drawn) return clamp(drawn.opacity, 0, 1);
  return /var\(|^\s*\{/i.test(value) ? Number.NaN : 0;
}

/** How much a gradient covers: 1 when every stop is opaque, NaN when any is not, 0 when unreadable. */
function gradientCover(value: unknown): number {
  if (typeof value !== 'string' || !value.trim()) return 0;
  const spec = parseGradientSpec(value);
  if (!spec) return 0;
  const stops = gradientSpecStops(spec);
  if (!stops.length) return 0;
  return stops.every((s) => s.color.alpha >= 1) ? 1 : Number.NaN;
}

/**
 * How much of what lies beneath a layer's own paint covers, before its opacity: a picture
 * covers, an artboard is a board (white when it has no fill), a fill by its alpha, and a
 * pen shape, which does not fill its bounding box, a blend or a backdrop blur cannot be read.
 */
function paintCover(row: Row, kind: string, image: string, resolve: GuestMarkMeasure['resolveColor']): number {
  if (image) return 1;
  if (kind === 'frame') {
    const drawn = typeof row.bg === 'string' && row.bg.trim() ? resolveDrawColor(row.bg, resolve) : null;
    return drawn ? clamp(drawn.opacity, 0, 1) : 1;
  }
  const bg = colourCover(row.bg, resolve);
  const grad = gradientCover(row.grad);
  const both = bg === 1 || grad === 1 ? 1 : Number.isNaN(bg) || Number.isNaN(grad) ? Number.NaN : 1 - (1 - bg) * (1 - grad);
  return (kind === 'path' || isSet(row.path) || blended(row) || num(row.bgBlur) > 0) && both !== 0 ? Number.NaN : both;
}

/** Choices in a sentence: "A, B or C", with no comma before the last. */
function orList(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`;
}

/** A number for a sentence: whole pixels, millimetres to one place. */
const pxText = (n: number): string => `${Math.round(n)}`;
const mmText = (n: number): string => `${Math.round(n * 10) / 10}`;
/** "one partner mark", or "3 partner marks". */
const marksText = (n: number, one = 'one partner mark', many = 'partner marks'): string => (n === 1 ? one : `${n} ${many}`);

/** The axis-aligned bounds of a rectangle turned by `rot` degrees about the point (cx, cy). */
function turnedBounds(r: Rect, rot: number, cx: number, cy: number): Rect {
  if (!(rot % 360)) return r;
  const a = (rot * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const xs: number[] = [], ys: number[] = [];
  for (const [px, py] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]] as const) {
    xs.push(cx + (px - cx) * c - (py - cy) * s);
    ys.push(cy + (px - cx) * s + (py - cy) * c);
  }
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** A box as Design places it: on whole pixels, at least one pixel each way. */
function boxOf(row: Row): Rect {
  return { x: Math.round(num(row.x)), y: Math.round(num(row.y)), w: Math.max(1, Math.round(num(row.w, 1))), h: Math.max(1, Math.round(num(row.h, 1))) };
}

/** The axis-aligned bounds of a box, turned about its centre. */
function boundsOf(row: Row): Rect {
  const box = boxOf(row);
  return turnedBounds(box, Math.round(num(row.rot) * 10) / 10, box.x + box.w / 2, box.y + box.h / 2);
}

/**
 * Whether a layer's own outline holds a whole rectangle: a rectangle, a rounded one, a pill
 * or an ellipse, as Design's `radiusFor` outlines the box. Each is convex, so it holds the
 * rectangle when it holds the rectangle's four corners.
 */
function outlineHolds(row: Row, box: Rect, r: Rect): boolean {
  if (!holds(box, r)) return false;
  const shape = shapeOf(row);
  const corners = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]] as const;
  if (shape === 'ellipse' || shape === 'circle') {
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2, rx = box.w / 2, ry = box.h / 2;
    return corners.every(([px, py]) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1 + 1e-9);
  }
  const radius = shape === 'pill' ? Math.min(box.w, box.h) / 2 : shape === 'rounded' ? clamp(num(row.radius, 16), 0, Math.min(box.w, box.h) / 2) : 0;
  if (!radius) return true;
  return corners.every(([px, py]) => {
    const qx = clamp(px, box.x + radius, box.x + box.w - radius), qy = clamp(py, box.y + radius, box.y + box.h - radius);
    return (px - qx) ** 2 + (py - qy) ** 2 <= radius * radius + 1e-9;
  });
}

function intersect(a: Rect, b: Rect | undefined): Rect {
  if (!b) return a;
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  return { x, y, w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x), h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y) };
}
const inflate = (r: Rect, pad: number): Rect => ({ x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 });
/** A rectangle mirrored about the point (cx, cy), across and down as asked. */
const mirrored = (r: Rect, flipH: boolean, flipV: boolean, cx: number, cy: number): Rect => ({
  x: flipH ? 2 * cx - (r.x + r.w) : r.x, y: flipV ? 2 * cy - (r.y + r.h) : r.y, w: r.w, h: r.h,
});

/** The fields the draw compiler reads as numbers, which the renderer reads as leading numbers. */
const NUMBER_FIELDS = ['x', 'y', 'w', 'h', 'rot', 'radius', 'strokeW', 'strokeTop', 'strokeRight', 'strokeBottom', 'strokeLeft', 'opacity'];
/** A copy of a row with each number field read as the renderer reads it ("310px" and ["310px"] are 310), or left out when it reads as none. */
function rendererNumbers(row: Row): Row {
  const out: Row = { ...row };
  for (const key of NUMBER_FIELDS) {
    if (out[key] === undefined || typeof out[key] === 'number') continue;
    const n = designNum(out[key], Number.NaN);
    if (Number.isFinite(n)) out[key] = n;
    else delete out[key];
  }
  return out;
}

/**
 * Where Design draws a mark's picture, from the draw compiler: exactly, when the fit can
 * be placed from what is known of the logo, or only the region it lies within and bounds
 * on its height. The region is mirrored and turned about the box's centre, as the pose
 * draws it (`rotate()` after the mirror), and given as its bounds on the page. Null when the
 * renderer draws no picture for the row.
 */
function placeMark(row: Row, base: string, measure: GuestMarkMeasure): Placement | null {
  let op: ReturnType<typeof compileDesignRow>;
  try {
    op = compileDesignRow(rendererNumbers(row) as DesignBoxRowV1, { x: 0, y: 0 });
  } catch {
    return null;
  }
  const picture = (op as { picture?: DrawPicture }).picture;
  if (!picture) return null;
  const cx = op.box.x + op.box.w / 2, cy = op.box.y + op.box.h / 2;
  const onPage = (r: Rect): Rect => turnedBounds(mirrored(r, !!op.pose?.flipH, !!op.pose?.flipV, cx, cy), op.pose?.rot ?? 0, cx, cy);
  const visible = (r: Rect): Rect => intersect(intersect(r, picture.element.box), picture.clip?.box);
  const bound = visible(picture.element.box);
  const size = measure.logoSize?.(base);
  const aspect = measure.logoAspect?.(base);
  const sized = !!size && Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0;
  const proportioned = sized || (typeof aspect === 'number' && Number.isFinite(aspect) && aspect > 0);
  const ownSize = picture.fit === 'none' || picture.fit === 'scale-down';
  const natural = sized ? { width: size.width, height: size.height } : proportioned ? { width: aspect! * 1000, height: 1000 } : null;
  if (picture.fit === 'fill' || (natural && (sized || !ownSize))) {
    const drawn = pictureRect(picture, natural ?? { width: 1, height: 1 });
    const region = visible(drawn);
    return { exact: true, region: onPage(region), lo: drawn.h, hi: drawn.h, visibleH: region.h };
  }
  // The logo's height is known only to lie between two bounds: a contained or scaled-down
  // logo is at most as tall as its box, a covering one at least, one at its own size anything.
  const boxH = picture.area.h * picture.zoom;
  const containH = natural ? pictureRect({ ...picture, fit: 'contain' }, natural).h : boxH;
  const lo = picture.fit === 'cover' ? boxH : 0;
  const hi = picture.fit === 'none' || picture.fit === 'cover' ? Number.POSITIVE_INFINITY : picture.fit === 'scale-down' ? containH : boxH;
  return { exact: false, region: onPage(bound), lo, hi, visibleH: bound.h };
}

const EPS = 0.01;
const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS;
function holds(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x - EPS && inner.y >= outer.y - EPS && inner.x + inner.w <= outer.x + outer.w + EPS && inner.y + inner.h <= outer.y + outer.h + EPS;
}
/** Two timed layers that are never on screen together are not neighbours. */
const together = (a: Layer, b: Layer): boolean => a.start < b.end && b.start < a.end;
/** Layers on two artboards, or on two pages, never share a page, whatever their coordinates. */
const samePlace = (a: Layer, b: Layer): boolean => !(a.frame && b.frame && a.frame !== b.frame) && !(a.page && b.page && a.page !== b.page);

function layerLabel(row: Row, id: string): string {
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (name) return name;
  const text = typeof row.text === 'string' ? row.text.trim().replace(/\s+/g, ' ') : '';
  if (text) return text.length > 40 ? `${text.slice(0, 39)}…` : text;
  return id || 'Layer';
}

/**
 * When a layer is on screen, as the renderer plays the piece: a timed layer (on the
 * sequence lane, or with a start) from its played start, which closes up behind clips set
 * aside earlier, for its duration; a layer that is not timed throughout. Null for a timed
 * layer set aside, which is not played.
 */
function timingOf(rows: Row[]): (row: Row) => { start: number; end: number } | null {
  const startOf = (row: Row): number => clamp(designNum(row.start, 0), 0, MAX_TIME_S);
  const durOf = (row: Row): number => clamp(designNum(row.dur, 0), 0.1, MAX_TIME_S);
  // The clips set aside, by start, with the time removed before each, so a lookup is a search.
  const spans = rows.filter((r) => designBool(r.ignored, false) && r.lane === 'seq' && designHasNum(r.dur)).map((r) => ({ s: startOf(r), d: durOf(r) })).sort((a, b) => a.s - b.s);
  const removed = [0];
  for (const sp of spans) removed.push(removed[removed.length - 1]! + sp.d);
  const removedBefore = (t: number): number => {
    let lo = 0, hi = spans.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (spans[mid]!.s < t - 1e-6) lo = mid + 1; else hi = mid; }
    return removed[lo]!;
  };
  return (row) => {
    if (!(row.lane === 'seq' || designHasNum(row.start))) return { start: 0, end: Number.POSITIVE_INFINITY };
    if (designBool(row.ignored, false)) return null;
    const authored = startOf(row);
    const start = row.lane === 'seq' ? Math.max(0, authored - removedBefore(authored)) : authored;
    return { start, end: designHasNum(row.dur) ? start + durOf(row) : Number.POSITIVE_INFINITY };
  };
}

/**
 * Design's paint order, as the renderer's `hierarchyPaintIndices` walks it: a group's members
 * follow the group, each group at its stack slot (the earlier of its own place and its top
 * member's), and everything else in list order.
 */
function paintOrder(rows: Row[]): number[] {
  const order = new Array<number>(rows.length).fill(Number.POSITIVE_INFINITY);
  if (!rows.some((r) => r.kind === 'group')) { rows.forEach((_r, n) => { order[n] = n; }); return order; }
  const groups = new Set<string>();
  rows.forEach((r) => { if (r.kind === 'group' && keyOf(r.id)) groups.add(keyOf(r.id)); });
  const members = new Map<string, number[]>();
  const roots: number[] = [];
  rows.forEach((r, n) => {
    const parent = keyOf(r.group);
    if (parent && groups.has(parent)) { const list = members.get(parent) ?? []; list.push(n); members.set(parent, list); } else roots.push(n);
  });
  // Each row's stack slot, worked out once: a group sits at the earlier of its own place and its top member's.
  const slots = rows.map((r, n) => {
    const children = r.kind === 'group' ? members.get(keyOf(r.id)) : undefined;
    return children?.length ? Math.min(n, children.reduce((m, c) => Math.max(m, c), 0)) : n;
  });
  const bySlot = (a: number, b: number): number => slots[a]! - slots[b]!;
  roots.sort(bySlot);
  for (const list of members.values()) list.sort(bySlot);
  const pending = roots.slice().reverse();
  const seen = new Set<number>();
  let next = 0;
  while (pending.length) {
    const n = pending.pop()!;
    if (seen.has(n)) continue;
    seen.add(n);
    order[n] = next++;
    const children = rows[n]!.kind === 'group' ? members.get(keyOf(rows[n]!.id)) ?? [] : [];
    for (let j = children.length - 1; j >= 0; j--) pending.push(children[j]!);
  }
  return order;
}

type Ground = 'photo' | 'other' | 'unknown';
interface GroundLayer { certain: boolean; cover: number; photo: boolean; unknown: boolean }

/**
 * What a mark can be sitting on, read from the painted layers beneath it, top first: a
 * photo, something else, or a photo seen through a veil (unknown). A layer that may or may
 * not lie under the whole mark leaves both answers open.
 */
function groundOutcomes(list: GroundLayer[]): Set<Ground> {
  const veiled = (s: Set<Ground>): Set<Ground> => new Set([...s].map((g) => (g === 'photo' ? 'unknown' : g)));
  let below = new Set<Ground>(['other']);
  for (let i = list.length - 1; i >= 0; i--) {
    const l = list[i]!;
    const own: Set<Ground> = l.unknown ? new Set(['unknown']) : l.photo ? new Set(['photo']) : l.cover >= 1 ? new Set(['other']) : veiled(below);
    below = l.certain ? own : new Set([...own, ...below]);
  }
  return below;
}

/** The layers Design draws, with their place, paint, paint order, time and how far the check follows them. */
function drawnLayers(capped: Row[], measure: GuestMarkMeasure, unmeasured: GuestMarkUnmeasured[]): Layer[] {
  // Each row is classified once, however many members ask about their group.
  const styled = typeof measure.customCss === 'string' && measure.customCss.trim() !== '';
  const classified = new Map<Row, boolean>();
  const floats = (row: Row): boolean => {
    let known = classified.get(row);
    if (known === undefined) { known = movesOrFloats(row, styled); classified.set(row, known); }
    return known;
  };
  // A layer's own flag, and a hidden artboard, group or layout container takes its members
  // with it, from the hierarchy Design paints.
  let hierarchy: ReturnType<typeof designHierarchyIndex> | null = null;
  try {
    hierarchy = designHierarchyIndex(capped);
  } catch {
    unmeasured.push({ code: 'layer-tree' });
  }
  const ancestorsOf = (id: string): Row[] => {
    const out: Row[] = [];
    const seen = new Set<string>([id]);
    let owner = id ? hierarchy?.parent.get(id) : undefined;
    while (owner && !seen.has(owner) && out.length < 65) {
      seen.add(owner);
      const row = hierarchy?.byId.get(owner);
      if (row) out.push(row);
      owner = hierarchy?.parent.get(owner);
    }
    return out;
  };
  const order = paintOrder(capped);
  const timing = timingOf(capped);
  const layers: Layer[] = [];
  capped.forEach((row, index) => {
    const id = keyOf(row.id);
    if (hidden(row) || (id && hierarchy?.flags.get(id)?.hidden === true)) return;
    const ancestors = ancestorsOf(id);
    // A hidden owner hides what it holds, read as the renderer reads `hidden` ('yes', 'on', 1 and so on).
    if (ancestors.some(hidden)) return;
    // A layer at no opacity draws nothing. A group and an artboard wrap what they hold, so
    // their opacity is their members' too; a layout container's is its own artwork's.
    const opacity = ancestors.filter((a) => a.kind === 'group' || a.kind === 'frame').reduce((o, a) => o * opacityOf(a), opacityOf(row));
    if (opacity <= 0) return;
    const time = timing(row);
    if (!time) return;
    const kind = typeof row.kind === 'string' && row.kind ? row.kind : 'box';
    // The artboard a layer is drawn on: its own, an ancestor's through groups and layout
    // owners, or the one it names.
    const owner = ancestors.find((a) => a.kind === 'frame');
    const frame = kind === 'frame' ? id : (owner ? keyOf(owner.id) : keyOf(row.frame));
    const page = (id && hierarchy?.pageById.get(id)) || keyOf(row.pageId);
    const image = imageId(row.image);
    // A group's or an artboard's blend mixes everything it holds with what lies beneath.
    const blend = blended(row) || ancestors.some((a) => (a.kind === 'group' || a.kind === 'frame') && blended(a));
    const own = paintCover(row, kind, image, measure.resolveColor) * opacity;
    const cover = blend && own !== 0 ? Number.NaN : own;
    const { reach, margin } = reachOf(row, kind, ancestors, floats);
    // A row that changes its prototype when the renderer copies the row may paint whatever the prototype holds.
    const paints = !!image || cover !== 0 || (typeof row.text === 'string' && row.text.trim() !== '') || isSet(row.textStory) || isSet(row.textFrame)
      || stroked(row) || shadowed(row) || !MODELLED_KINDS.has(kind) || Object.keys(row).some((k) => PROTOTYPE_KEYS.has(k));
    layers.push({
      row, id, order: Number.isFinite(order[index]!) ? order[index]! : capped.length + index, rect: boundsOf(row), label: layerLabel(row, id), kind, image,
      ...time, frame, page, cover, paints, reach, margin,
      solid: !turnedRow(row) && !isSet(row.clip) && !(num(row.blur) > 0),
      unknownPaint: !MODELLED_KINDS.has(kind) && kind !== 'path',
      blend,
    });
  });
  return layers;
}

/**
 * Check a Design document's partner marks against a kit. `boxes` is Design's flat boxes
 * value; `kit` a kit `readPartnerKit` accepted. A mark is an image layer whose asset is one
 * of the kit's logos, by id: the pinned version does not matter, so a mark placed from an
 * older revision is still the partner's mark.
 */
export function checkGuestMarks(boxes: unknown, kit: Pick<PartnerKitV1, 'label' | 'logos' | 'rules'>, measure: GuestMarkMeasure = {}): GuestMarkReport {
  const rules = kit.rules ?? {};
  const company = typeof kit.label === 'string' && kit.label ? kit.label : 'The partner';
  const logos = new Set(partnerKitLogoIds(kit));
  const unit = typeof measure.unit === 'string' && isUnit(measure.unit) ? measure.unit : 'px';
  const physical = unit !== 'px';
  const dpi = num(measure.dpi, 300) > 0 ? num(measure.dpi, 300) : 300;
  const scale = num(measure.scale, 1) > 0 ? num(measure.scale, 1) : 1;
  const exportPx = (cssPx: number): number => (physical ? (cssPx / CSS_DPI) * dpi : cssPx * scale);
  const millimetres = (cssPx: number): number => (cssPx / CSS_DPI) * 25.4;

  const checkedRules: GuestMarkReport['checked']['rules'] = [];
  if (rules.minSize && (rules.minSize.px !== undefined || rules.minSize.mm !== undefined)) checkedRules.push('min-size');
  if (rules.clearSpace) checkedRules.push('clear-space');
  if (rules.treatments?.length) checkedRules.push('treatment');
  const said: GuestMarkUnmeasured[] = [];
  if (rules.treatments?.length) said.push({ code: 'reverse' });
  if (rules.minSize?.mm !== undefined && !physical) said.push({ code: 'mm-in-pixels' });
  if (typeof measure.customCss === 'string' && measure.customCss.trim() !== '' && checkedRules.length) said.push({ code: 'custom-css' });

  const rows = Array.isArray(boxes) ? boxes.filter(record) : [];
  const layers = drawnLayers(rows.slice(0, MAX_ROWS), measure, said);
  if (rows.length > MAX_ROWS) said.push({ code: 'layer-limit', limit: MAX_ROWS });

  const isMark = (l: Layer): boolean => l.kind !== 'frame' && !NOT_ON_PAGE.has(l.kind) && !!l.image && logos.has(stripAssetModifiers(l.image));
  const marks = layers.filter(isMark);
  const findings: BrandFinding[] = [];
  let dropped = 0;
  const add = (mark: Layer, rule: 'min-size' | 'clear-space' | 'treatment', part: string, message: string, extra: Partial<BrandFinding> = {}): void => {
    if (findings.length >= MAX_FINDINGS) { dropped++; return; }
    findings.push({
      id: `brand.mark.${mark.id}.${rule}${part ? `.${part}` : ''}`,
      kind: 'mark', status: 'review', layerId: mark.id, label: mark.label, field: rule === 'clear-space' ? undefined : 'image',
      rule, message, company, ...extra,
    });
  };
  // Design paints in its stack order (see above): an artboard beneath what is drawn on the artboard.
  const beneath = (a: Layer, b: Layer): boolean => (a.kind === 'frame' ? a.id === b.frame : a.order < b.order);
  const neighbour = (l: Layer, mark: Layer): boolean => l !== mark && together(l, mark) && samePlace(l, mark);
  const count: Partial<Record<GuestMarkUnmeasuredCode, number>> = {};
  const note = (code: GuestMarkUnmeasuredCode): void => { count[code] = (count[code] ?? 0) + 1; };
  // Layer comparisons made so far, against `MAX_WORK`.
  let work = 0;
  const afford = (cost: number): boolean => {
    if (work + cost > MAX_WORK) return false;
    work += cost;
    return true;
  };

  for (const mark of marks) {
    const base = stripAssetModifiers(mark.image);
    const placed = placeMark(mark.row, base, measure);
    if (!placed) { note('not-drawn'); continue; }
    // A mark that moves or is placed by a layout is followed nowhere, so nothing about its place is measured.
    const adrift = mark.reach === 'anywhere';
    const region = placed.region;
    let overBudget = false;
    if (rules.minSize) {
      const min = rules.minSize;
      const short = (cssPx: number): { px: boolean; mm: boolean } => ({
        px: min.px !== undefined && exportPx(cssPx) + 0.5 < min.px,
        mm: physical && min.mm !== undefined && millimetres(cssPx) + 0.05 < min.mm,
      });
      if (adrift) note('size-unmodelled');
      else {
        // Under the minimum for certain at the tallest it can be drawn; met for certain at the shortest.
        const atMost = short(placed.hi), atLeast = short(placed.lo);
        const prefix = placed.exact ? '' : 'at most ';
        if (atMost.px) add(mark, 'min-size', 'px', `${company}'s mark is ${prefix}${pxText(exportPx(placed.hi))} px high; the kit asks for at least ${pxText(min.px!)} px.`, { value: `${pxText(exportPx(placed.hi))} px`, expected: `${pxText(min.px!)} px` });
        if (atMost.mm) add(mark, 'min-size', 'mm', `${company}'s mark is ${prefix}${mmText(millimetres(placed.hi))} mm high; the kit asks for at least ${mmText(min.mm!)} mm.`, { value: `${mmText(millimetres(placed.hi))} mm`, expected: `${mmText(min.mm!)} mm` });
        if ((atLeast.px && !atMost.px) || (atLeast.mm && !atMost.mm)) note('size');
      }
    }
    if (rules.clearSpace) {
      if (adrift) note('clear-space-unmodelled');
      else if (!afford(layers.length)) overBudget = true;
      else {
        // Exactly placed, the band is the mark inflated by its clear space; otherwise the
        // widest band it could have, and a layer in that band leaves the rule not measured.
        const band = inflate(region, rules.clearSpace.value * placed.visibleH);
        // A layer beneath the mark whose own outline holds the whole mark is its background.
        // Another kit mark is never a background.
        const background = (l: Layer): boolean => !isMark(l) && l.reach !== 'anywhere' && l.solid && beneath(l, mark) && outlineHolds(l.row, boxOf(l.row), region);
        const near = layers.filter((l) => neighbour(l, mark) && l.kind !== 'frame' && !NOT_ON_PAGE.has(l.kind) && l.kind !== 'group' && l.paints
          && (l.reach === 'anywhere' || overlaps(inflate(l.rect, l.margin), band)) && !background(l));
        const exact = near.filter((l) => l.reach === 'exact');
        if (exact.length && placed.exact) {
          const first = exact[0]!;
          const message = exact.length === 1
            ? `“${first.label}” sits inside ${company}'s clear space.`
            : `“${first.label}” and ${exact.length - 1} other ${exact.length === 2 ? 'layer sit' : 'layers sit'} inside ${company}'s clear space.`;
          add(mark, 'clear-space', '', message, { value: first.label, expected: `${rules.clearSpace.value} of the mark's height`, related: exact.map((l) => l.id).filter(Boolean) });
        } else if (near.some((l) => l.reach !== 'exact')) note('clear-space-unmodelled');
        else if (near.length) note('clear-space');
      }
    }
    const allowed = rules.treatments;
    if (allowed?.length) {
      const rest = allowed.map((t) => TREATMENT_WORDS[t]);
      const treatment = parseTreatedAssetId(mark.image).treatment ?? undefined;
      const theme = parseThemedAssetId(mark.image).theme ?? undefined;
      // A colour modifier is judged by the colours the catalog gives it, never assumed. A
      // surface-aware mark takes its variant from what is drawn beneath, so it is not judged
      // here, and a blend mixes the mark with what lies beneath.
      const recolour = mark.blend ? 'blend' : theme === AUTO_ASSET_THEME ? 'auto' : treatment || theme ? (measure.recolour?.({ ...(theme ? { theme } : {}), ...(treatment ? { treatment } : {}) }) ?? null) : undefined;
      if (recolour === 'blend') note('treatment-unmodelled');
      else if (recolour === 'auto') note('surface');
      else if (recolour === null) note('treatment');
      else if (recolour === 'other') {
        add(mark, 'treatment', 'recoloured', `${company}'s mark is recoloured; the kit allows ${orList(rest)}.`, { value: 'recoloured', expected: allowed.join(', ') });
      } else {
        const drawnAs: PartnerKitTreatmentV1 = recolour === 'mono' ? 'mono' : 'colour';
        if (!allowed.includes(drawnAs)) {
          add(mark, 'treatment', drawnAs, `${company}'s mark is drawn in ${TREATMENT_WORDS[drawnAs]}; the kit allows ${orList(rest)}.`, { value: drawnAs, expected: allowed.join(', ') });
        }
      }
      if (!allowed.includes('on-photo')) {
        if (adrift) note('ground-unmodelled');
        else {
          const ground = groundOf(mark, region);
          if (ground === 'budget') overBudget = true;
          else if (ground.photo) {
            add(mark, 'treatment', 'on-photo', `${company}'s mark sits on a photo; the kit allows ${orList(rest)}.`, { value: 'on-photo', expected: allowed.join(', '), related: ground.photo.id ? [ground.photo.id] : [] });
          } else if (ground.doubt) note(ground.unmodelled ? 'ground-unmodelled' : 'ground');
        }
      }
    }
    if (overBudget) note('work-limit');
  }

  /**
   * What a mark sits on, for each stretch of time its neighbours come and go in: the photo
   * it certainly sits on at some time, or doubt when a stretch leaves the answer open (from
   * a layer the check does not model, when `unmodelled`). `budget` when the work cap stops the search.
   */
  function groundOf(mark: Layer, region: Rect): { photo?: Layer; doubt: boolean; unmodelled: boolean } | 'budget' {
    if (!afford(layers.length)) return 'budget';
    const under = layers
      .filter((l) => neighbour(l, mark) && !isMark(l) && !NOT_ON_PAGE.has(l.kind === 'frame' ? '' : l.kind) && l.kind !== 'group' && l.cover !== 0 && beneath(l, mark)
        && (l.reach === 'anywhere' || overlaps(l.rect, region)))
      .sort((a, b) => (a.kind === 'frame' ? 1 : 0) - (b.kind === 'frame' ? 1 : 0) || b.order - a.order);
    // A layer beneath that moves or floats could come under the mark at any time.
    if (under.some((l) => l.reach === 'anywhere')) return { doubt: true, unmodelled: true };
    // Each time a layer beneath arrives or leaves while the mark is on screen starts a stretch.
    const times = [...new Set([mark.start, ...under.flatMap((l) => [l.start, l.end])])].filter((t) => t >= mark.start && t < mark.end).sort((a, b) => a - b);
    if (!afford(times.length * under.length)) return 'budget';
    const photoOf = (l: Layer): boolean => !!l.image && measure.pictureKind?.(stripAssetModifiers(l.image)) !== 'vector';
    const facts = under.map((l): GroundLayer => ({
      // Under the whole mark for certain only when the layer's own outline, unturned,
      // unmasked and unblurred, holds the region the mark is drawn in (or, placed only
      // roughly, the region it lies within).
      certain: l.solid && outlineHolds(l.row, boxOf(l.row), region),
      cover: l.cover,
      photo: photoOf(l),
      unknown: l.unknownPaint,
    }));
    // Beneath a mark the check models a box's outline, fill and picture; a turn, a mask, a
    // blur, a blend, a backdrop blur, a pen path or a kind of its own it does not.
    const unmodelled = under.some((l) => !l.solid || l.unknownPaint || l.blend || num(l.row.bgBlur) > 0 || l.kind === 'path' || isSet(l.row.path));
    let doubt = false;
    for (const t of times) {
      const now: GroundLayer[] = [];
      under.forEach((l, n) => { if (l.start <= t && t < l.end) now.push(facts[n]!); });
      const outcomes = groundOutcomes(now);
      if (outcomes.size === 1 && outcomes.has('photo')) {
        const photo = under.find((l, n) => facts[n]!.photo && l.start <= t && t < l.end && facts[n]!.certain) ?? under.find((l, n) => facts[n]!.photo && l.start <= t && t < l.end);
        return { photo, doubt: false, unmodelled };
      }
      if (outcomes.has('photo') || outcomes.has('unknown')) doubt = true;
    }
    return { doubt, unmodelled };
  }

  const order: GuestMarkUnmeasuredCode[] = ['not-drawn', 'size', 'size-unmodelled', 'clear-space', 'clear-space-unmodelled', 'ground', 'ground-unmodelled', 'treatment', 'treatment-unmodelled', 'surface', 'work-limit'];
  for (const code of order) if (count[code]) said.push({ code, count: count[code] });
  if (dropped) said.push({ code: 'findings-limit', count: dropped, limit: MAX_FINDINGS });
  return { findings, checked: { marks: marks.length, rules: checkedRules }, unmeasured: said, notMeasured: said.map(guestUnmeasuredText) };
}
