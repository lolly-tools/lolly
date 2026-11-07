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
 *   Any other drawn layer that overlaps that band is named, except one beneath the mark
 *   that holds the whole mark, which is its background. Another kit mark is never a
 *   background, so two kit marks check each other.
 * - Treatment: a mark recoloured by a photo treatment or an icon theme is classified from
 *   the catalog's own colours (one colour, or recoloured); a mark whose nearest painted
 *   layer beneath, the artboard included, is a picture sits on a photo. A treatment the kit
 *   does not list is pointed out. `reverse` is in the vocabulary and is not measured: the
 *   logo for dark surfaces is the reverse by construction.
 *
 * Whatever the check cannot measure is listed in `notMeasured`, never passed in silence.
 * Findings are reviews and never refusals: nothing here blocks an export, a render or a
 * save, and no finding carries an automatic fix, because sizing a mark is the person's
 * call. Geometry follows the Design renderer: a mark's picture is placed by the draw
 * compiler (`compileDesignRow`, `pictureRect`), with its fit, framing and border; layers
 * paint in the layer tree's order, an artboard beneath everything on the artboard, and
 * `z` is depth, not stacking. Opacity is 0 to 100 and reaches a layer through the groups
 * and the artboard that hold the layer. Timing is Design's: a timed layer is on screen from its
 * played start for its duration, and what a mark sits on is read for each stretch of time.
 * A rotated neighbour is placed by its bounding box. A tool's logo input has no geometry
 * without a render, so only Design documents are measured.
 */
import type { PartnerKitTreatmentV1, PartnerKitV1 } from '@lolly-tools/core/partner-kit-v1';
import type { DesignBoxRowV1 } from '@lolly-tools/core';
import type { BrandFinding } from './brand-check.ts';
import { parseThemedAssetId, parseTreatedAssetId, stripAssetModifiers } from './asset-modifiers.ts';
import { AUTO_ASSET_THEME, parseIconThemesDoc } from './icon-theme.ts';
import { parsePhotoTreatmentsDoc } from './photo-treatment.ts';
import { colorToHexString, parseColor } from './css-color.ts';
import { gradientSpecStops, parseGradientSpec } from './gradient-spec.ts';
import { compileDesignRow, pictureRect, resolveDrawColor, type DrawPicture } from './design-draw.ts';
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

export interface GuestMarkReport {
  /** `kind: 'mark'`, `status: 'review'`, one per mark and rule. */
  findings: BrandFinding[];
  /** Marks measured, and the kit rules they were measured against. */
  checked: { marks: number; rules: Array<'min-size' | 'clear-space' | 'treatment'> };
  /** What the kit states and this check does not measure, in words. */
  notMeasured: string[];
}

type Row = Record<string, unknown>;
interface Rect { x: number; y: number; w: number; h: number }
interface Layer {
  row: Row; id: string; order: number; rect: Rect; label: string; kind: string; image: string;
  start: number; end: number; frame: string; page: string;
  /** How much of what lies beneath this layer covers, 0 to 1; NaN when that cannot be read. */
  cover: number;
  /** Turned, so its bounding box is larger than what it paints. */
  turned: boolean;
  /** Keyframes or an entrance or exit move, fade or build it over time. */
  moving: boolean;
}
/** Where a mark is drawn: exactly, or only within a region with its height between two bounds. */
interface Placement { exact: boolean; region: Rect; lo: number; hi: number; visibleH: number }

const MAX_ROWS = 5000;
const MAX_FINDINGS = 200;
const MAX_TIME_S = 3600;
/** Layers that are pages, sound or a camera path, never a neighbour on the page. */
const NOT_ON_PAGE = new Set(['frame', 'audio', 'camera']);
const TREATMENT_WORDS: Record<PartnerKitTreatmentV1, string> = { colour: 'full colour', mono: 'one colour', reverse: 'reversed', 'on-photo': 'on a photo' };

const record = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
};
/** The renderer's `num`: a number, or the leading number of a string; anything else is `fallback`. */
const designNum = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number.parseFloat(v) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
};
/** The renderer's `isFiniteNum`: authored, and a number. */
const designHasNum = (v: unknown): boolean => v !== '' && Number.isFinite(designNum(v, Number.NaN));
/** The renderer's `boolVal`: true, 1, yes or on, and false, 0, no or off, in any case. */
const designBool = (v: unknown, fallback: boolean): boolean => {
  if (v === true || v === false) return v;
  if (typeof v !== 'string' && typeof v !== 'number') return fallback;
  const s = String(v).toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on' ? true : s === 'false' || s === '0' || s === 'no' || s === 'off' ? false : fallback;
};
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const imageId = (v: unknown): string => (typeof v === 'string' ? v : record(v) && typeof v.id === 'string' ? v.id : '');
const hidden = (row: Row): boolean => designBool(row.hidden, false) || row.__offPage === true;
/** A layer's own opacity as the renderer reads it, 0 to 100 authored, here 0 to 1. */
const opacityOf = (row: Row): number => clamp(designNum(row.opacity, 100), 0, 100) / 100;
const transition = (v: unknown): boolean => typeof v === 'string' && v !== '' && v !== 'none';
const turnedRow = (row: Row): boolean => Math.round(num(row.rot) * 10) % 3600 !== 0;

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
 * pen shape, which does not fill its bounding box, cannot be read.
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
  return kind === 'path' && both !== 0 ? Number.NaN : both;
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

/** The axis-aligned bounds of a box, rotated about its centre. */
function boundsOf(row: Row): Rect {
  const x = num(row.x), y = num(row.y), w = Math.max(0, num(row.w)), h = Math.max(0, num(row.h));
  return turnedBounds({ x, y, w, h }, num(row.rot), x + w / 2, y + h / 2);
}

function intersect(a: Rect, b: Rect | undefined): Rect {
  if (!b) return a;
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  return { x, y, w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x), h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y) };
}
const inflate = (r: Rect, pad: number): Rect => ({ x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 });

/**
 * Where Design draws a mark's picture, from the draw compiler: exactly, when the fit can
 * be placed from what is known of the logo, or only the region it lies within and bounds
 * on its height. Null when the renderer draws no picture for the row.
 */
function placeMark(row: Row, base: string, measure: GuestMarkMeasure): (Placement & { rot: number; cx: number; cy: number }) | null {
  let op: ReturnType<typeof compileDesignRow>;
  try {
    op = compileDesignRow(row as DesignBoxRowV1, { x: 0, y: 0 });
  } catch {
    return null;
  }
  const picture = (op as { picture?: DrawPicture }).picture;
  if (!picture) return null;
  const rot = op.pose?.rot ?? 0;
  const cx = op.box.x + op.box.w / 2, cy = op.box.y + op.box.h / 2;
  const visible = (r: Rect): Rect => intersect(intersect(r, picture.element.box), picture.clip?.box);
  const bound = visible(picture.element.box);
  const size = measure.logoSize?.(base);
  const aspect = measure.logoAspect?.(base);
  const sized = !!size && Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0;
  const proportioned = sized || (typeof aspect === 'number' && Number.isFinite(aspect) && aspect > 0);
  const ownSize = picture.fit === 'none' || picture.fit === 'scale-down';
  const natural = sized ? { width: size.width, height: size.height } : proportioned ? { width: aspect! * 1000, height: 1000 } : null;
  const place = { rot, cx, cy };
  if (picture.fit === 'fill' || (natural && (sized || !ownSize))) {
    const drawn = pictureRect(picture, natural ?? { width: 1, height: 1 });
    const region = visible(drawn);
    return { exact: true, region, lo: drawn.h, hi: drawn.h, visibleH: region.h, ...place };
  }
  // The logo's height is known only to lie between two bounds: a contained or scaled-down
  // logo is at most as tall as its box, a covering one at least, one at its own size anything.
  const boxH = picture.area.h * picture.zoom;
  const containH = natural ? pictureRect({ ...picture, fit: 'contain' }, natural).h : boxH;
  const lo = picture.fit === 'cover' ? boxH : 0;
  const hi = picture.fit === 'none' ? Number.POSITIVE_INFINITY : picture.fit === 'cover' ? Number.POSITIVE_INFINITY : picture.fit === 'scale-down' ? containH : boxH;
  return { exact: false, region: bound, lo, hi, visibleH: bound.h, ...place };
}

const EPS = 0.01;
const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS;
const holds = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x - EPS && inner.y >= outer.y - EPS && inner.x + inner.w <= outer.x + outer.w + EPS && inner.y + inner.h <= outer.y + outer.h + EPS;
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
  const spans = rows.filter((r) => designBool(r.ignored, false) && r.lane === 'seq' && designHasNum(r.dur)).map((r) => ({ s: startOf(r), d: durOf(r) }));
  return (row) => {
    if (!(row.lane === 'seq' || designHasNum(row.start))) return { start: 0, end: Number.POSITIVE_INFINITY };
    if (designBool(row.ignored, false)) return null;
    const authored = startOf(row);
    const start = row.lane === 'seq' ? Math.max(0, authored - spans.reduce((sum, sp) => sum + (sp.s < authored - 1e-6 ? sp.d : 0), 0)) : authored;
    return { start, end: designHasNum(row.dur) ? start + durOf(row) : Number.POSITIVE_INFINITY };
  };
}

type Ground = 'photo' | 'other' | 'unknown';
interface GroundLayer { certain: boolean; cover: number; picture: boolean; photo: boolean }

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
    const own: Set<Ground> = l.photo ? new Set(['photo']) : l.cover >= 1 ? new Set(['other']) : veiled(below);
    below = l.certain ? own : new Set([...own, ...below]);
  }
  return below;
}

/** The layers Design draws, with their place, paint, paint order and time. */
function drawnLayers(capped: Row[], measure: GuestMarkMeasure, notMeasured: string[]): Layer[] {
  // A layer's own flag, and a hidden artboard, group or layout container takes its members
  // with it, from the hierarchy Design paints.
  let hierarchy: ReturnType<typeof designHierarchyIndex> | null = null;
  try {
    hierarchy = designHierarchyIndex(capped);
  } catch {
    notMeasured.push('artboards, groups and paint order: the document\'s layer tree could not be read, so each layer is placed by its own fields and its place in the list');
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
  // Design's paint order: the layer tree walked in list order, each owner (an artboard, a
  // group, a layout container) beneath what it holds. Without a tree, the list order.
  const order = new Map<string, number>();
  if (hierarchy) {
    let next = 0;
    const visit = (id: string, depth: number): void => {
      if (order.has(id) || depth > 65) return;
      order.set(id, next++);
      for (const child of hierarchy!.children.get(id) ?? []) visit(child, depth + 1);
    };
    for (const row of capped) {
      const id = typeof row.id === 'string' ? row.id : '';
      if (id && !hierarchy.parent.has(id)) visit(id, 0);
    }
  }
  const timing = timingOf(capped);
  const layers: Layer[] = [];
  capped.forEach((row, index) => {
    const id = typeof row.id === 'string' ? row.id : '';
    if (hidden(row) || (id && hierarchy?.flags.get(id)?.hidden === true)) return;
    const ancestors = ancestorsOf(id);
    // A layer at no opacity draws nothing. A group and an artboard wrap what they hold, so
    // their opacity is their members' too; a layout container's is its own artwork's.
    const opacity = ancestors.filter((a) => a.kind === 'group' || a.kind === 'frame').reduce((o, a) => o * opacityOf(a), opacityOf(row));
    if (opacity <= 0) return;
    const time = timing(row);
    if (!time) return;
    const kind = typeof row.kind === 'string' && row.kind ? row.kind : 'box';
    const rect = boundsOf(row);
    if (!(rect.w > 0) || !(rect.h > 0)) return;
    // The artboard a layer is drawn on: its own, an ancestor's through groups and layout
    // owners, or the one it names.
    const owner = ancestors.find((a) => a.kind === 'frame');
    const frame = kind === 'frame' ? id : (owner && typeof owner.id === 'string' ? owner.id : (typeof row.frame === 'string' ? row.frame : ''));
    const page = (id && hierarchy?.pageById.get(id)) || (typeof row.pageId === 'string' ? row.pageId : '');
    const image = imageId(row.image);
    const moving = (kind !== 'frame' && typeof row.kf === 'string' && row.kf.trim() !== '') || transition(row.enter) || transition(row.exit);
    layers.push({
      row, id, order: (id ? order.get(id) : undefined) ?? index, rect, label: layerLabel(row, id), kind, image,
      ...time, frame, page, cover: paintCover(row, kind, image, measure.resolveColor) * opacity, turned: turnedRow(row), moving,
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
  const notMeasured: string[] = [];
  if (rules.treatments?.length) notMeasured.push('reversed use: the logo for dark surfaces is the reverse, so a reversed mark is not measured');
  if (rules.minSize?.mm !== undefined && !physical) notMeasured.push('the minimum size in millimetres: the document is measured in pixels');

  const rows = Array.isArray(boxes) ? boxes.filter(record) : [];
  const layers = drawnLayers(rows.slice(0, MAX_ROWS), measure, notMeasured);
  if (rows.length > MAX_ROWS) notMeasured.push(`layers past the first ${MAX_ROWS.toLocaleString('en')}`);

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
  // Design paints in the tree's order (see above): an artboard beneath what is drawn on the artboard.
  const beneath = (a: Layer, b: Layer): boolean => (a.kind === 'frame' ? a.id === b.frame : a.order < b.order);
  const neighbour = (l: Layer, mark: Layer): boolean => l !== mark && together(l, mark) && samePlace(l, mark);
  const unmeasured = { size: 0, space: 0, ground: 0, treatment: 0, auto: 0, placed: 0, motion: 0 };

  for (const mark of marks) {
    const base = stripAssetModifiers(mark.image);
    const placed = placeMark(mark.row, base, measure);
    if (!placed) { unmeasured.placed++; continue; }
    // The region turns with the mark; its height, which rotation does not change, does not.
    const region = turnedBounds(placed.region, placed.rot, placed.cx, placed.cy);
    let moving = mark.moving;
    if (rules.minSize) {
      const min = rules.minSize;
      const short = (cssPx: number): { px: boolean; mm: boolean } => ({
        px: min.px !== undefined && exportPx(cssPx) + 0.5 < min.px,
        mm: physical && min.mm !== undefined && millimetres(cssPx) + 0.05 < min.mm,
      });
      // Under the minimum for certain at the tallest it can be drawn; met for certain at the shortest.
      const atMost = short(placed.hi), atLeast = short(placed.lo);
      const prefix = placed.exact ? '' : 'at most ';
      if (atMost.px) add(mark, 'min-size', 'px', `${company}'s mark is ${prefix}${pxText(exportPx(placed.hi))} px high; the kit asks for at least ${pxText(min.px!)} px.`, { value: `${pxText(exportPx(placed.hi))} px`, expected: `${pxText(min.px!)} px` });
      if (atMost.mm) add(mark, 'min-size', 'mm', `${company}'s mark is ${prefix}${mmText(millimetres(placed.hi))} mm high; the kit asks for at least ${mmText(min.mm!)} mm.`, { value: `${mmText(millimetres(placed.hi))} mm`, expected: `${mmText(min.mm!)} mm` });
      if ((atLeast.px && !atMost.px) || (atLeast.mm && !atMost.mm)) unmeasured.size++;
    }
    if (rules.clearSpace) {
      // Exactly placed, the band is the mark inflated by its clear space; otherwise the
      // widest band it could have, and a layer in that band leaves the rule not measured.
      const band = inflate(region, rules.clearSpace.value * placed.visibleH);
      // A layer beneath the mark that holds the whole mark is its background. Another kit
      // mark is never a background.
      const background = (l: Layer): boolean => !isMark(l) && beneath(l, mark) && holds(l.rect, region);
      const inside = layers.filter((l) => neighbour(l, mark) && l.kind !== 'frame' && !NOT_ON_PAGE.has(l.kind) && l.kind !== 'group' && overlaps(l.rect, band) && !background(l));
      if (inside.some((l) => l.moving)) moving = true;
      if (inside.length && !placed.exact) unmeasured.space++;
      else if (inside.length) {
        const first = inside[0]!;
        const message = inside.length === 1
          ? `“${first.label}” sits inside ${company}'s clear space.`
          : `“${first.label}” and ${inside.length - 1} other ${inside.length === 2 ? 'layer sit' : 'layers sit'} inside ${company}'s clear space.`;
        add(mark, 'clear-space', '', message, { value: first.label, expected: `${rules.clearSpace.value} of the mark's height`, related: inside.map((l) => l.id).filter(Boolean) });
      }
    }
    const allowed = rules.treatments;
    if (allowed?.length) {
      const rest = allowed.map((t) => TREATMENT_WORDS[t]);
      const treatment = parseTreatedAssetId(mark.image).treatment ?? undefined;
      const theme = parseThemedAssetId(mark.image).theme ?? undefined;
      // A colour modifier is judged by the colours the catalog gives it, never assumed. A
      // surface-aware mark takes its variant from what is drawn beneath, so it is not judged here.
      const recolour = theme === AUTO_ASSET_THEME ? 'auto' : treatment || theme ? (measure.recolour?.({ ...(theme ? { theme } : {}), ...(treatment ? { treatment } : {}) }) ?? null) : undefined;
      if (recolour === 'auto') unmeasured.auto++;
      else if (recolour === null) unmeasured.treatment++;
      else if (recolour === 'other') {
        add(mark, 'treatment', 'recoloured', `${company}'s mark is recoloured; the kit allows ${orList(rest)}.`, { value: 'recoloured', expected: allowed.join(', ') });
      } else {
        const drawnAs: PartnerKitTreatmentV1 = recolour === 'mono' ? 'mono' : 'colour';
        if (!allowed.includes(drawnAs)) {
          add(mark, 'treatment', drawnAs, `${company}'s mark is drawn in ${TREATMENT_WORDS[drawnAs]}; the kit allows ${orList(rest)}.`, { value: drawnAs, expected: allowed.join(', ') });
        }
      }
      if (!allowed.includes('on-photo')) {
        const ground = groundOf(mark, region);
        if (ground.moving) moving = true;
        if (ground.photo) {
          add(mark, 'treatment', 'on-photo', `${company}'s mark sits on a photo; the kit allows ${orList(rest)}.`, { value: 'on-photo', expected: allowed.join(', '), related: ground.photo.id ? [ground.photo.id] : [] });
        } else if (ground.doubt) unmeasured.ground++;
      }
    }
    if (moving) unmeasured.motion++;
  }

  /**
   * What a mark sits on, for each stretch of time its neighbours come and go in: the
   * photo it certainly sits on at some time, or doubt when a stretch leaves the answer open.
   */
  function groundOf(mark: Layer, region: Rect): { photo?: Layer; doubt: boolean; moving: boolean } {
    const under = layers
      .filter((l) => neighbour(l, mark) && !isMark(l) && !NOT_ON_PAGE.has(l.kind === 'frame' ? '' : l.kind) && l.kind !== 'group' && l.cover !== 0 && beneath(l, mark) && overlaps(l.rect, region))
      .sort((a, b) => (a.kind === 'frame' ? 1 : 0) - (b.kind === 'frame' ? 1 : 0) || b.order - a.order);
    // Each time a layer beneath arrives or leaves while the mark is on screen starts a stretch.
    const times = [...new Set([mark.start, ...under.flatMap((l) => [l.start, l.end])])].filter((t) => t >= mark.start && t < mark.end).sort((a, b) => a - b);
    const photoOf = (l: Layer): boolean => !!l.image && measure.pictureKind?.(stripAssetModifiers(l.image)) !== 'vector';
    let doubt = false;
    for (const t of times) {
      const now = under.filter((l) => l.start <= t && t < l.end);
      const outcomes = groundOutcomes(now.map((l) => ({
        // Under the whole mark for certain only when the layer, unturned, holds the region the
        // mark is drawn in (or, placed only roughly, the region it lies within).
        certain: !l.turned && holds(l.rect, region),
        cover: l.cover,
        picture: !!l.image,
        photo: photoOf(l),
      })));
      if (outcomes.size === 1 && outcomes.has('photo')) {
        const photo = now.find((l) => photoOf(l) && holds(l.rect, region)) ?? now.find(photoOf);
        return { photo, doubt: false, moving: under.some((l) => l.moving) };
      }
      if (outcomes.has('photo') || outcomes.has('unknown')) doubt = true;
    }
    return { doubt, moving: under.some((l) => l.moving) };
  }

  if (unmeasured.placed) notMeasured.push(`${marksText(unmeasured.placed)}: Design draws no picture for the layer as written, so its size, clear space and ground were not measured`);
  if (unmeasured.size) notMeasured.push(`the drawn height of ${marksText(unmeasured.size)}: the logo's proportions or size were not given, so a mark in a box at least the minimum may still draw smaller`);
  if (unmeasured.space) notMeasured.push(`the clear space of ${marksText(unmeasured.space)}: the logo's proportions or size were not given, and a layer lies where the clear space may reach`);
  if (unmeasured.ground) notMeasured.push(`whether ${marksText(unmeasured.ground, 'one partner mark sits', 'partner marks sit')} on a photo: what lies beneath is translucent, covers only part of the mark or depends on the logo's proportions`);
  if (unmeasured.treatment) notMeasured.push(`the treatment of ${marksText(unmeasured.treatment, 'one recoloured mark', 'recoloured marks')}: the catalog does not say what colours its theme or treatment gives`);
  if (unmeasured.auto) notMeasured.push(`the colours of ${marksText(unmeasured.auto)} set to follow the surface: the variant is chosen from what is drawn beneath when the page is drawn`);
  if (unmeasured.motion) notMeasured.push(`${marksText(unmeasured.motion)} while the piece plays: the mark or a layer near it moves, fades or builds over time, and each layer was measured where it was placed`);
  if (dropped) notMeasured.push(`${dropped === 1 ? 'one more finding' : `${dropped} more findings`} past the first ${MAX_FINDINGS}, which are not listed`);
  return { findings, checked: { marks: marks.length, rules: checkedRules }, notMeasured };
}
