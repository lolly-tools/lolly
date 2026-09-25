// SPDX-License-Identifier: MPL-2.0
/**
 * Design frames to a native PowerPoint deck (plan 274 work package 6, plan 95 route a).
 *
 * The input is Design's own authored rows - the same `DesignBoxRowV1` values the
 * compile writes and the tool serialises into `<script data-penpot-doc>` - not a DOM
 * and not a rendered page. One frame row plus its member layers becomes one
 * `PptxSlide`; a frame that carries a slide-master binding (`master` + `archetype`)
 * also gets a real `PptxLayout` built from that archetype, and its role-bound text
 * lowers to `PptxText.ph`, which is what makes Outline view and Reset Slide work in
 * PowerPoint.
 *
 * Frames with no binding lower from the same geometry the deck-model path uses, so a
 * hand-drawn deck still exports as editable text, rectangles and pictures.
 *
 * DOM-free and shell-free on purpose: this is the half the CLI needs to write a
 * native .pptx without launching a browser. Picture bytes arrive through injected
 * callbacks, so nothing here fetches, reads a file or reads a clock.
 *
 * KNOWN LIMIT, stated rather than hidden: the engine's `PptxFill` has no scheme
 * colour reference, so a fill that maps to a design-system token is written with the
 * token's resolved hex and the slot it maps to is reported in `schemeRefs`. The
 * theme part still carries the token values, so a later rebrand in PowerPoint moves
 * the theme; it does not yet move the shapes. Adding `{ scheme }` to `PptxFill` in
 * `engine/src/pptx.ts` is what closes that, and this module already computes the slot.
 */

import {
  EMU_PER_PX,
  type PptxFill,
  type PptxLayout,
  type PptxPath,
  type PptxMedia,
  type PptxPara,
  type PptxPhType,
  type PptxPic,
  type PptxPlaceholder,
  type PptxRun,
  type PptxShape,
  type PptxSlide,
  type PptxSlideTransition,
  type PptxText,
  type PptxTheme,
} from '../../../engine/src/pptx.ts';
import type {
  ArchetypeRefV1,
  ArchetypeRoleV1,
  ArchetypeV1,
  DesignBoxRowV1,
  FurnitureLayerV1,
  MasterBoxV1,
  MasterTextStyleV1,
  PlaceholderLayerV1,
  SlideMasterV1,
} from '@lolly-tools/core';
import { findArchetype, roleFontSize } from '@lolly-tools/core';
import { hasDesignMarkup, parseDesignText, THEME_SLOT_TOKENS as ENGINE_THEME_SLOT_TOKENS } from '@lolly/engine';
import { decodeAuthoredPaths } from '../../../engine/src/geom/authored-url.ts';
import { contourArea, toSvgPathData, type Contour } from '../../../engine/src/geom/path.ts';
import { toCubics } from '../../../engine/src/geom/spline.ts';
import { deckColor, deckTransition, type DeckColorResolver, type DeckNotes } from './pptx-deck.ts';

// ─── the pieces a caller hands in ─────────────────────────────────────────────

/** One frame row and the layers that name it in their `frame` field, in paint order. */
export interface DesignFrameV1 {
  row: DesignBoxRowV1;
  layers: DesignBoxRowV1[];
}

/** Bytes for one picture layer, by whatever reference the row carries. */
export type DesignAssetResolver = (ref: string) => Promise<{ bytes: Uint8Array; mime: string } | null>;

/** Turns a design-system token path into a colour value. */
export type DesignTokenResolver = (path: string) => string | undefined;

export interface DesignPptxOptsV1 {
  frames: DesignFrameV1[];
  /** The master a bound frame names. A frame naming another master lowers unbound. */
  master?: SlideMasterV1;
  tokens?: DesignTokenResolver;
  /** CSS custom properties, for a row whose colour is still written as `var(--brand-x)`. */
  cssVars?: DeckColorResolver;
  resolveAsset?: DesignAssetResolver;
  /** Raster bytes for an SVG picture. Without one an SVG layer is reported, not drawn. */
  rasterizeSvg?: (bytes: Uint8Array, w: number, h: number) => Promise<Uint8Array | null>;
  /** Theme font names. Design names a slot; only the caller knows the family. */
  fonts?: { major?: string; minor?: string };
  /** Slide size, when the first frame does not state one. */
  size?: { w: number; h: number };
  /**
   * The transition each slide leaves on, already resolved against the document-level
   * one, in slide order. The document-level value is an input, not a row, so it is not
   * in the rows this module reads; the tool resolves it into its own deck model and
   * both shells hand that list over. A frame that states its own still wins.
   */
  slideTransitions?: ReadonlyArray<string | undefined>;
}

/** The ten DrawingML colour slots this lowering maps. `hlink` and `folHlink` are
 *  left to the engine's own theme defaults. */
export const SCHEME_SLOTS = [
  'dk1', 'lt1', 'dk2', 'lt2',
  'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6',
] as const;
export type SchemeSlotV1 = (typeof SCHEME_SLOTS)[number];

/**
 * Which design-system token each theme slot is built from.
 *
 * The table itself lives in the engine (`engine/src/rebrand-design-system.ts`),
 * because the renovation first pass reads the same table to map a source colour
 * that named a slot onto the same slot, and two copies would drift. This is that
 * table, typed to the ten slots this lowering writes.
 *
 * Only `color.semantic.*` is listed, because that is what the shipped resolvers
 * answer: both shells read the `--brand-<slot>` custom property the canvas carries.
 * The four slots with no entry (`lt2`, `accent4`, `accent5`, `accent6`) take the
 * engine's own theme defaults rather than a token path nothing can resolve. Adding a
 * ramp resolver is what fills them in, and the engine table is what it would extend.
 */
export const THEME_SLOT_TOKENS: Readonly<Partial<Record<SchemeSlotV1, string>>> = ENGINE_THEME_SLOT_TOKENS;

/**
 * The bounds this lowering works inside, matching the ones the deck-model path already
 * applies in shells/web/src/bridge/export-pptx.ts. Rows and asset references are
 * document-controlled, so a deck of 40,000 frames or a slide carrying a gigabyte of
 * pictures is refused in part rather than turned into a run that never ends.
 */
export const MAX_SLIDES = 500;
export const MAX_LAYERS_PER_SLIDE = 1200;
export const MAX_PICTURE_BYTES = 32 * 1024 * 1024;

/** One fill that maps to a theme slot, and how it got there. */
export interface SchemeRefV1 {
  layerId: string;
  slot: SchemeSlotV1;
  hex: string;
  /** `token` when the row named the token path; `value` when its hex matched a slot. */
  via: 'token' | 'value';
}

export interface DesignPptxResultV1 {
  slides: PptxSlide[];
  layouts: PptxLayout[];
  theme?: PptxTheme;
  size: { w: number; h: number };
  /** Layout index per archetype, so a caller can say which slide sits on which. */
  layoutOfArchetype: Array<{ archetype: ArchetypeRefV1; index: number }>;
  schemeRefs: SchemeRefV1[];
  /** One line per thing that was not carried across, deduped, in first-seen order. */
  notes: string[];
}

// ─── reading a row ────────────────────────────────────────────────────────────

const num = (row: DesignBoxRowV1, key: string, fallback = 0): number => {
  const v = row[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
};

const str = (row: DesignBoxRowV1, key: string): string => {
  const v = row[key];
  return typeof v === 'string' ? v : '';
};

/**
 * A boolean off a row, the way Design's own `boolVal` reads one.
 *
 * Block booleans travel over the URL wire and through a `?z=` document as '1'/'0', so
 * a mirrored layer that came back from a share link states `flipH: '1'`, not `true`.
 * Reading only the real boolean is what let a flipped box export unflipped.
 */
const bool = (row: DesignBoxRowV1, key: string, fallback = false): boolean => {
  const v = row[key];
  if (v === true || v === false) return v;
  if (v === 1) return true;
  if (v === 0) return false;
  if (typeof v !== 'string' || v === '') return fallback;
  const t = v.toLowerCase();
  if (t === 'true' || t === '1' || t === 'yes' || t === 'on') return true;
  if (t === 'false' || t === '0' || t === 'no' || t === 'off') return false;
  return fallback;
};

const emu = (px: number): number => Math.round(px * EMU_PER_PX);

/** A token path looks like `color.semantic.text`: dotted, no spaces, no `#` or `(`. */
const TOKEN_PATH_RE = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+$/i;

// ─── roles to placeholder bindings ────────────────────────────────────────────

/** The placeholder type each archetype role binds to. Roles with no type of their own
 *  bind to `body`, which is what PowerPoint's outline and re-layout read. A `number`
 *  is a figure or a step number on the slide (42%, 1, 2, 3), not the page number, so
 *  it is `body` too: a `sldNum` placeholder is header and footer furniture, and three
 *  of them on one layout would share idx 12 and read as slide-number fields. */
const ROLE_PH_TYPE: Readonly<Record<ArchetypeRoleV1, PptxPhType>> = {
  title: 'title',
  subtitle: 'subTitle',
  body: 'body',
  visual: 'body',
  data: 'body',
  caption: 'body',
  number: 'body',
  label: 'body',
  quote: 'body',
  attribution: 'body',
};

/** The conventional idx for a slide-number placeholder, matching the engine's note.
 *  No role binds to it; the counter steps over it so it stays free for one. */
const SLD_NUM_IDX = 12;

interface PhBinding {
  type: PptxPhType;
  idx?: number;
}

/**
 * The placeholder binding for every text placeholder of one archetype, keyed by
 * `<role>#<ordinal>` so the slide side and the layout side cannot disagree.
 *
 * Assignment is by declared order, which is what makes it reproducible: a title takes
 * no idx and everything else takes the next free counter from 1, stepping over the
 * slide-number idx 12, so every idx is unique within the layout.
 */
function bindingsFor(archetype: ArchetypeV1): Map<string, PhBinding> {
  const out = new Map<string, PhBinding>();
  const seen = new Map<ArchetypeRoleV1, number>();
  let next = 1;
  for (const ph of archetype.placeholders) {
    const ordinal = (seen.get(ph.role) ?? 0) + 1;
    seen.set(ph.role, ordinal);
    const type = ROLE_PH_TYPE[ph.role];
    let binding: PhBinding;
    if (type === 'title' && ordinal === 1) binding = { type };
    else {
      if (next === SLD_NUM_IDX) next += 1;
      binding = { type: type === 'title' ? 'body' : type, idx: next };
      next += 1;
    }
    out.set(`${ph.role}#${ordinal}`, binding);
  }
  return out;
}

// ─── colour ───────────────────────────────────────────────────────────────────

interface ColourHit {
  hex: string;
  alpha?: number;
  slot?: SchemeSlotV1;
  via?: 'token' | 'value';
}

class Palette {
  /** Slot hex values, resolved once from the token callback. */
  readonly bySlot = new Map<SchemeSlotV1, string>();
  /** Hex to the FIRST slot that claims it, so two slots sharing a value stay stable. */
  private readonly byHex = new Map<string, SchemeSlotV1>();
  private readonly byPath = new Map<string, SchemeSlotV1>();

  private readonly tokens?: DesignTokenResolver;
  private readonly cssVars?: DeckColorResolver;

  constructor(tokens?: DesignTokenResolver, cssVars?: DeckColorResolver) {
    this.tokens = tokens;
    this.cssVars = cssVars;
    for (const slot of SCHEME_SLOTS) {
      const path = THEME_SLOT_TOKENS[slot];
      if (!path) continue;
      const raw = tokens?.(path);
      const hit = raw ? deckColor(raw, cssVars) : null;
      if (!hit) continue;
      this.bySlot.set(slot, hit.hex);
      if (!this.byHex.has(hit.hex)) this.byHex.set(hit.hex, slot);
      if (!this.byPath.has(path)) this.byPath.set(path, slot);
    }
  }

  /** One authored colour value, resolved, with its theme slot when it has one. */
  resolve(raw: unknown): ColourHit | null {
    if (typeof raw === 'string' && TOKEN_PATH_RE.test(raw)) {
      const value = this.tokens?.(raw);
      const hit = value ? deckColor(value, this.cssVars) : null;
      if (!hit) return null;
      const slot = this.byPath.get(raw) ?? this.byHex.get(hit.hex);
      return { ...hit, ...(slot ? { slot, via: 'token' as const } : {}) };
    }
    const hit = deckColor(raw, this.cssVars);
    if (!hit) return null;
    const slot = this.byHex.get(hit.hex);
    return { ...hit, ...(slot ? { slot, via: 'value' as const } : {}) };
  }

  theme(fonts?: { major?: string; minor?: string }): PptxTheme | undefined {
    const colors: NonNullable<PptxTheme['colors']> = {};
    for (const [slot, hex] of this.bySlot) colors[slot] = hex;
    const out: PptxTheme = {};
    if (Object.keys(colors).length) out.colors = colors;
    const major = fonts?.major;
    const minor = fonts?.minor;
    if (major || minor) out.fonts = { ...(major ? { major } : {}), ...(minor ? { minor } : {}) };
    return Object.keys(out).length ? out : undefined;
  }
}

// ─── text ─────────────────────────────────────────────────────────────────────

const ALIGN: Readonly<Record<string, PptxPara['align']>> = {
  left: 'l', center: 'ctr', centre: 'ctr', right: 'r', justify: 'just',
  l: 'l', ctr: 'ctr', r: 'r', just: 'just',
};
const ANCHOR: Readonly<Record<string, PptxText['anchor']>> = {
  top: 't', middle: 'ctr', center: 'ctr', centre: 'ctr', bottom: 'b',
  t: 't', ctr: 'ctr', b: 'b',
};

/** Design states a font SLOT; only the caller knows which family that is. */
function familyOf(slot: string, fonts?: { major?: string; minor?: string }): string | undefined {
  if (!slot) return undefined;
  if (slot === 'display') return fonts?.major;
  if (slot === 'sans' || slot === 'mono') return fonts?.minor;
  return slot;
}

/** A run colour Design text states (`#rgb` or `#rrggbb`), as six hex digits with the `#`. */
function longHex(color: string): string | undefined {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?$/.exec(color.trim());
  if (!m?.[1]) return undefined;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return `#${h.toLowerCase()}`;
}

/** A line that starts with two or more spaces before its words: an outline level Design draws as indent. */
const INDENTED_LINE = /(^|\n) {2,}\S/;

/**
 * Paragraphs for one text row. Plain text is one paragraph per line with one run
 * each, as it always was. Text in Design's subset (plan 275 section 7.2) is read
 * through the engine's `parseDesignText`: a `- ` line is a bullet, an `N. ` line a
 * number, two leading spaces a level, and each run keeps bold, italic, underline,
 * strike and colour, so no marker reaches the deck as a character. A line with no
 * marker keeps its level too: its leading spaces become the paragraph's level
 * rather than characters in its text, which is how a plain paragraph of an outline
 * and the line after a soft break travel. The weight model is Design's: an
 * explicit `{wNNN|...}` decides a run, otherwise `**` or the row. `onRestart` hears
 * of a numbered list that starts past 1, which the pptx writer numbers from 1.
 */
function parasOf(
  text: string,
  run: Omit<PptxRun, 'text'>,
  align: PptxPara['align'],
  resolveColour?: (hex: string) => string | undefined,
  onRestart?: () => void,
): PptxPara[] {
  if (!hasDesignMarkup(text) && !INDENTED_LINE.test(text)) {
    return text.split('\n').map((line) => ({
      runs: [{ ...run, text: line }],
      ...(align ? { align } : {}),
    }));
  }
  const lines = parseDesignText(text);
  const listed = lines.some((line) => line.list !== undefined);
  let previous: (typeof lines)[number] | undefined;
  return lines.map((line) => {
    const opensList = line.list === 'number' && !(previous?.list === 'number' && previous.level === line.level);
    if (opensList && line.number !== undefined && line.number !== 1) onRestart?.();
    previous = line;
    // A plain line's indent is its level, so the spaces leave its words.
    let strip = line.list ? 0 : line.level * 2;
    const runs: PptxRun[] = [];
    for (const part of line.runs) {
      let partText = part.text;
      if (strip > 0) {
        const cut = Math.min(strip, partText.length - partText.replace(/^ +/, '').length);
        partText = partText.slice(cut);
        strip = cut < part.text.length ? 0 : strip - cut;
        if (!partText) continue;
      }
      const out: PptxRun = { ...run, text: partText };
      if (part.weight !== undefined) {
        if (part.weight >= 600) out.bold = true;
        else delete out.bold;
      } else if (part.bold) out.bold = true;
      if (part.italic) out.italic = true;
      if (part.underline) out.underline = true;
      if (part.strike) out.strike = true;
      const hex = part.color ? longHex(part.color) : undefined;
      if (hex) out.color = resolveColour?.(hex) ?? hex;
      runs.push(out);
    }
    const para: PptxPara = { runs: runs.length > 0 ? runs : [{ ...run, text: '' }], ...(align ? { align } : {}) };
    if (line.list === 'bullet') para.bullet = true;
    else if (line.list === 'number') para.bullet = 'number';
    else if (listed || line.level > 0) para.bullet = false;
    if (line.level > 0) para.level = Math.min(8, line.level);
    return para;
  });
}

// ─── geometry ─────────────────────────────────────────────────────────────────

/** A master box as EMU at the slide size, which is what a layout placeholder wants. */
function boxEmu(box: MasterBoxV1, w: number, h: number): { x: number; y: number; cx: number; cy: number } {
  return {
    x: emu(box.x * w),
    y: emu(box.y * h),
    cx: Math.max(1, emu(box.w * w)),
    cy: Math.max(1, emu(box.h * h)),
  };
}

/**
 * How far this slide is scaled from the master's own reference size.
 *
 * Boxes are fractions and carry themselves; a px type size does not, so it is scaled
 * by the width ratio. Width alone, because the type scale is one number per role and a
 * slide whose aspect differs from the master's has no single factor to offer.
 */
function typeFactor(master: SlideMasterV1, size: { w: number; h: number }): number {
  const ref = master.size?.width;
  if (typeof ref !== 'number' || !Number.isFinite(ref) || ref <= 0) return 1;
  return size.w / ref;
}

// ─── the lowering ─────────────────────────────────────────────────────────────

/** Deduped note sink, so one limit reported per deck rather than per layer. */
class Notes {
  readonly lines: string[] = [];
  add(line: string): void {
    if (!this.lines.includes(line)) this.lines.push(line);
  }
}

interface SlideSink {
  shapes: PptxShape[];
  media: PptxMedia[];
}

const addMedia = (sink: SlideSink, bytes: Uint8Array, ext: PptxMedia['ext']): number => {
  sink.media.push({ bytes, ext });
  return sink.media.length - 1;
};

const EXT_OF_MIME: Readonly<Record<string, PptxMedia['ext']>> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/svg+xml': 'svg',
};

/**
 * The blend keywords Design paints with. `normal` is the OFF value the Blend control
 * writes when someone picks it back, so it is not in here: treating it as a blend
 * dropped every layer whose Blend had ever been touched.
 */
const BLEND_MODES: ReadonlySet<string> = new Set([
  'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
]);

/** The row fields that state motion: an entrance, an exit, a keyframe track, a hold
 *  effect or a morph match key. None of them survives into a .pptx here. */
const MOTION_FIELDS = ['enter', 'exit', 'kf', 'hold', 'matchOf'] as const;

/** What a Design shadow can be cast on. `none` is the OFF value, so it is not here. */
const SHADOW_TARGETS: ReadonlySet<string> = new Set(['box', 'text', 'content', 'depth']);

/** What Design paints text with when the row and the master both state nothing. Same
 *  two values the deck lowering uses, so the two paths agree on an unstyled layer. */
const DEFAULT_TEXT_WEIGHT = 700;
const DEFAULT_TEXT_HEX = '11141F';

/**
 * Effects a flat deck element cannot state. A row wearing one is left out, with a note.
 *
 * This mirrors `deckInexpressible` in community/design/hooks.js one for one, and it has
 * to: a guard missing here does not make the layer export better, it makes it export
 * WRONG - flat where the canvas is tilted, unmasked where the canvas is clipped.
 * `byId` is the frame's own rows, which a clip mask names.
 */
function inexpressible(row: DesignBoxRowV1, byId?: ReadonlySet<string>): string | null {
  const kind = str(row, 'kind') || 'box';
  // A box, a path and a text row turn in the deck as on the canvas, about their centre;
  // a box's mirror changes nothing the flat rectangle draws, and a path's mirror is
  // written into its outline (plan 275 decision 32: a turned or mirrored chart).
  if (num(row, 'rot') !== 0 && !TURNS.has(kind)) return 'a rotated object';
  if ((bool(row, 'flipH') || bool(row, 'flipV')) && !MIRRORS.has(kind)) return 'a flipped object';
  if (num(row, 'rx') !== 0 || num(row, 'ry') !== 0) return 'a perspective tilt';
  // A box, a path or a text row states its opacity as the alpha of its own colours,
  // which a deck element does carry (plan 275 decision 32: a chart's translucent
  // labels and gridlines); a picture has no colour to fold it into.
  if (num(row, 'opacity', 100) !== 100 && !FOLDS_OPACITY.has(str(row, 'kind') || 'box')) return 'partial opacity';
  if (str(row, 'grad').trim() !== '') return 'a gradient fill';
  if (num(row, 'blur') > 0 || num(row, 'bgBlur') > 0) return 'a blur';
  if (BLEND_MODES.has(str(row, 'blend'))) return 'a blend mode';
  if (SHADOW_TARGETS.has(str(row, 'shadow'))) return 'a shadow';
  const clip = str(row, 'clip').trim();
  if (clip && clip !== str(row, 'id') && byId?.has(clip)) return 'a clip mask';
  return null;
}

/** Row kinds whose opacity folds into the alpha of their fill, line or text colour. */
const FOLDS_OPACITY: ReadonlySet<string> = new Set(['box', 'path', 'text']);
/** Row kinds a deck shape turns as the canvas does, by the `rot` on its transform. */
const TURNS: ReadonlySet<string> = new Set(['box', 'path', 'text']);
/** Row kinds whose mirror the lowering can draw: a box is symmetric, a path's outline takes it. */
const MIRRORS: ReadonlySet<string> = new Set(['box', 'path']);

/** The turn a row states, in degrees, for a deck shape's transform; absent when it has none. */
function rotOf(row: DesignBoxRowV1): { rot?: number } {
  const rot = num(row, 'rot');
  return rot !== 0 && Number.isFinite(rot) ? { rot } : {};
}

/** A row's opacity, 0 to 1. */
function opacityOf(row: DesignBoxRowV1): number {
  return Math.max(0, Math.min(1, num(row, 'opacity', 100) / 100));
}

/** A colour's alpha times the row's opacity, or undefined when the result is opaque. */
function foldAlpha(alpha: number | undefined, opacity: number): number | undefined {
  const a = (alpha ?? 1) * opacity;
  return a < 1 ? Math.round(a * 1000) / 1000 : undefined;
}

/**
 * A path row's authored nodes (fractions of its box) as SVG path data in its own
 * EMU box, lowered to cubics the way Design draws them. Null when the value does
 * not decode.
 */
function pathDataOf(row: DesignBoxRowV1, cx: number, cy: number): { d: string; contours: Contour[] } | null {
  const paths = decodeAuthoredPaths(str(row, 'path'));
  if (!paths || paths.length === 0) return null;
  // A mirrored row is drawn mirrored within its own box, so the deck shape needs no flip.
  const fx = bool(row, 'flipH') ? -1 : 1;
  const fy = bool(row, 'flipV') ? -1 : 1;
  const contours: Contour[] = [];
  for (const path of paths) {
    const nodes = path.nodes.map((n) => ({
      ...n,
      x: (fx < 0 ? 1 - n.x : n.x) * cx,
      y: (fy < 0 ? 1 - n.y : n.y) * cy,
      ...(n.hInX !== undefined ? { hInX: n.hInX * cx * fx } : {}),
      ...(n.hInY !== undefined ? { hInY: n.hInY * cy * fy } : {}),
      ...(n.hOutX !== undefined ? { hOutX: n.hOutX * cx * fx } : {}),
      ...(n.hOutY !== undefined ? { hOutY: n.hOutY * cy * fy } : {}),
    }));
    try {
      const curves = toCubics({ ...path, nodes });
      if (curves.length) contours.push({ curves, closed: path.closed });
    } catch {
      return null;
    }
  }
  // One decimal, not none: `toSvgPathData` trims trailing zeros, and at no decimals it
  // trims them off whole numbers too, so 1524000 EMU would be written as 1524.
  return contours.length ? { d: toSvgPathData(contours, 1), contours } : null;
}

/** `true` for a row the render does not paint at all. */
const hidden = (row: DesignBoxRowV1): boolean => bool(row, 'hidden');

interface LowerCtx {
  palette: Palette;
  fonts?: { major?: string; minor?: string };
  notes: Notes;
  schemeRefs: SchemeRefV1[];
  resolveAsset?: DesignAssetResolver;
  rasterizeSvg?: DesignPptxOptsV1['rasterizeSvg'];
}

/** The fill for one row's background, recording the theme slot when it has one. */
function fillOf(ctx: LowerCtx, row: DesignBoxRowV1, key = 'bg'): PptxFill | undefined {
  const hit = ctx.palette.resolve(row[key]);
  if (!hit) return undefined;
  if (hit.slot && hit.via) {
    ctx.schemeRefs.push({ layerId: str(row, 'id'), slot: hit.slot, hex: hit.hex, via: hit.via });
  }
  return { solid: hit.hex, ...(hit.alpha != null ? { alpha: hit.alpha } : {}) };
}

/** One picture row to a `PptxPic`, or null when the bytes are not reachable here. */
async function picOf(
  ctx: LowerCtx,
  sink: SlideSink,
  row: DesignBoxRowV1,
  box: { x: number; y: number; cx: number; cy: number },
): Promise<PptxPic | null> {
  // A row's picture is either the reference as authored or, once the runtime has
  // resolved it, the `{ type, url }` the render draws from. Both reach here.
  const raw: unknown = row.image;
  const ref = typeof raw === 'string'
    ? raw
    : (raw && typeof raw === 'object' && typeof (raw as { url?: unknown }).url === 'string'
      ? (raw as { url: string }).url
      : '');
  if (!ref) return null;
  if (!ctx.resolveAsset) {
    ctx.notes.add('a picture was left out because this run has no way to read asset bytes');
    return null;
  }
  let got: { bytes: Uint8Array; mime: string } | null = null;
  try {
    got = await ctx.resolveAsset(ref);
  } catch {
    got = null;
  }
  if (!got?.bytes.length) {
    ctx.notes.add('a picture was left out because its bytes could not be read');
    return null;
  }
  if (got.bytes.length > MAX_PICTURE_BYTES) {
    ctx.notes.add(`a picture over ${Math.round(MAX_PICTURE_BYTES / (1024 * 1024))} MB was left out`);
    return null;
  }
  const ext = EXT_OF_MIME[got.mime.toLowerCase().split(';')[0] ?? ''];
  if (!ext) {
    ctx.notes.add(`a picture in ${got.mime} was left out (PowerPoint reads PNG, JPEG and SVG)`);
    return null;
  }
  if (ext === 'svg') {
    // svgBlip needs a raster fallback beside it, which only a caller with a rasteriser
    // can supply. Without one the vector is reported rather than drawn wrong.
    const w = Math.max(1, Math.round(box.cx / EMU_PER_PX));
    const h = Math.max(1, Math.round(box.cy / EMU_PER_PX));
    const png = ctx.rasterizeSvg ? await ctx.rasterizeSvg(got.bytes, w, h) : null;
    if (!png) {
      ctx.notes.add('a vector picture was left out because this run cannot render its PNG fallback');
      return null;
    }
    const svgIdx = addMedia(sink, got.bytes, 'svg');
    const pngIdx = addMedia(sink, png, 'png');
    return { kind: 'pic', ...box, media: pngIdx, svg: svgIdx, name: str(row, 'name') || undefined };
  }
  if (str(row, 'fit') === 'cover') {
    ctx.notes.add('a picture set to cover was placed whole, because its crop needs the rendered page');
  }
  return { kind: 'pic', ...box, media: addMedia(sink, got.bytes, ext), name: str(row, 'name') || undefined };
}

/**
 * One member layer to one shape on the slide.
 *
 * `binding` is set when the layer carries a role the archetype has a placeholder for,
 * and it is what turns the text box into placeholder-bound text.
 */
async function lowerLayer(
  ctx: LowerCtx,
  sink: SlideSink,
  row: DesignBoxRowV1,
  origin: { x: number; y: number },
  binding: PhBinding | undefined,
  masterStyle: MasterTextStyleV1 | undefined,
  master: SlideMasterV1 | undefined,
  siblings: ReadonlySet<string>,
): Promise<void> {
  if (hidden(row)) return;
  const limit = inexpressible(row, siblings);
  if (limit) {
    ctx.notes.add(`${limit} was left out of the deck; this lowering emits flat, axis-aligned objects with a solid fill`);
    return;
  }
  // Motion is a deck-model citizen, not a row one: `deckAnimFor` builds it in the tool
  // and this lowering reads rows. A built slide that arrives in place is worth one
  // reported line rather than nothing at all.
  if (MOTION_FIELDS.some((field) => str(row, field).trim() !== '')) {
    ctx.notes.add('an animation was left out of the deck, so its objects arrive in place');
  }
  const kind = str(row, 'kind');
  const box = {
    x: emu(num(row, 'x') - origin.x),
    y: emu(num(row, 'y') - origin.y),
    cx: Math.max(1, emu(num(row, 'w', 1))),
    cy: Math.max(1, emu(num(row, 'h', 1))),
  };
  const opacity = opacityOf(row);

  if (kind === 'path') {
    // A path row is custom geometry in the deck (plan 275 decision 32): its nodes
    // lowered to cubics in the shape's own EMU box, its fill and line kept, and its
    // opacity folded into both colours' alpha.
    if (str(row, 'pathPaint').trim() !== '') {
      ctx.notes.add('a multi-colour vector was left out of the deck; ungroup it in Design first');
      return;
    }
    const data = pathDataOf(row, box.cx, box.cy);
    if (!data) {
      ctx.notes.add('a path whose outline could not be read was left out of the deck');
      return;
    }
    if (str(row, 'fillRule') === 'evenodd' && data.contours.length > 1) {
      const signs = new Set(data.contours.map((c) => Math.sign(contourArea(c))));
      if (signs.size === 1) ctx.notes.add('an even-odd fill was drawn with the one fill rule PowerPoint has, so an overlap may fill where the canvas leaves a hole');
    }
    const fill = fillOf(ctx, row);
    const strokeHit = ctx.palette.resolve(row.stroke);
    const strokeW = num(row, 'strokeW');
    noteDash(ctx, row);
    const shape: PptxPath = {
      kind: 'path', ...box, ...rotOf(row),
      paths: [{ d: data.d }],
      ...(fill ? { fill: withFillAlpha(fill, opacity) } : {}),
      ...(strokeHit && strokeW > 0 ? { line: lineOf(strokeHit, strokeW, opacity) } : {}),
    };
    sink.shapes.push(shape);
    return;
  }

  if (kind === 'image') {
    const pic = await picOf(ctx, sink, row, box);
    if (pic) sink.shapes.push(pic);
    return;
  }

  if (kind === 'text') {
    const role = str(row, 'role') as ArchetypeRoleV1 | '';
    const sizePx = num(row, 'fontSize', 0)
      || (role && master ? roleFontSize(master, role as ArchetypeRoleV1, masterStyle) : 0)
      || 48;
    // An empty `fg` is absent, not black: the blocks wire format round-trips a cleared
    // colour as '', and `??` would let that shadow the master's own style.
    const colour = ctx.palette.resolve(str(row, 'fg') || masterStyle?.fg || masterStyle?.fgTokenPath);
    // Design paints an absent weight as 700 (`weightOf`), so a master-seeded title with
    // no weight of its own is BOLD on the canvas and has to be bold in the deck too.
    const weight = num(row, 'weight', 0) || Number(str(row, 'weight'))
      || Number(masterStyle?.weight) || DEFAULT_TEXT_WEIGHT;
    const textAlpha = foldAlpha(colour?.alpha, opacity);
    const run: Omit<PptxRun, 'text'> = {
      sizePt: Math.round(sizePx * 0.75 * 100) / 100,
      color: colour?.hex ?? DEFAULT_TEXT_HEX,
      ...(weight >= 600 ? { bold: true } : {}),
      ...(textAlpha !== undefined ? { alpha: textAlpha } : {}),
    };
    const family = familyOf(str(row, 'font') || masterStyle?.font || '', ctx.fonts);
    if (family) run.font = family;
    const align = ALIGN[str(row, 'align') || masterStyle?.align || ''];
    const anchor = ANCHOR[str(row, 'valign') || masterStyle?.valign || ''];
    const text: PptxText = {
      kind: 'text', ...box, ...rotOf(row),
      paras: parasOf(str(row, 'text'), run, align, (hex) => ctx.palette.resolve(hex)?.hex,
        () => ctx.notes.add('a numbered list that starts past 1 was numbered from 1')),
      ...(anchor ? { anchor } : {}),
      ...(binding ? { ph: binding } : {}),
    };
    sink.shapes.push(text);
    return;
  }

  // Everything else is the rectangle: a box, a bar, a shape with a flat fill.
  const fill = fillOf(ctx, row);
  const strokeHit = ctx.palette.resolve(row.stroke);
  const strokeW = num(row, 'strokeW');
  noteDash(ctx, row);
  const rect: PptxShape = {
    kind: 'rect', ...box, ...rotOf(row),
    ...(fill ? { fill: withFillAlpha(fill, opacity) } : {}),
    ...(strokeHit && strokeW > 0 ? { line: lineOf(strokeHit, strokeW, opacity) } : {}),
    ...(str(row, 'shape') === 'rounded' ? { radius: emu(num(row, 'radius')) } : {}),
  };
  sink.shapes.push(rect);
}

/** A dashed or dotted outline is written solid, since this lowering writes solid lines only, and the notes name it. */
function noteDash(ctx: LowerCtx, row: DesignBoxRowV1): void {
  const dash = str(row, 'strokeDash');
  if ((dash === 'dashed' || dash === 'dotted') && num(row, 'strokeW') > 0 && str(row, 'stroke').trim() !== '') {
    ctx.notes.add('a dashed outline was drawn solid in the deck');
  }
}

/** A solid fill with the row's opacity folded into its alpha. A gradient is returned as it is. */
function withFillAlpha(fill: PptxFill, opacity: number): PptxFill {
  if (!('solid' in fill)) return fill;
  const alpha = foldAlpha(fill.alpha, opacity);
  return { solid: fill.solid, ...(alpha !== undefined ? { alpha } : {}) };
}

/** A solid line, its width in EMU and its alpha folded with the row's opacity. */
function lineOf(hit: ColourHit, strokeW: number, opacity: number): { color: string; w: number; alpha?: number } {
  const alpha = foldAlpha(hit.alpha, opacity);
  return { color: hit.hex, w: emu(strokeW), ...(alpha !== undefined ? { alpha } : {}) };
}

/** The layout for one archetype: its placeholders, plus its furniture as static shapes. */
function layoutFor(
  ctx: LowerCtx,
  archetype: ArchetypeV1,
  master: SlideMasterV1,
  size: { w: number; h: number },
  bindings: Map<string, PhBinding>,
): PptxLayout {
  // A placeholder's box is a fraction of the master size and scales with the slide;
  // its type size is stated in px AT THE MASTER SIZE, so it has to be scaled by the
  // same factor or a deck drawn at another size gets placeholders whose text no longer
  // matches the text on the slide.
  const typeScale = typeFactor(master, size);
  const placeholders: PptxPlaceholder[] = [];
  const seen = new Map<ArchetypeRoleV1, number>();
  for (const ph of archetype.placeholders) {
    const ordinal = (seen.get(ph.role) ?? 0) + 1;
    seen.set(ph.role, ordinal);
    if (ph.kind === 'image') continue;         // a picture slot is not a text placeholder
    const bind = bindings.get(`${ph.role}#${ordinal}`);
    if (!bind) continue;
    const style = ph.style;
    const colour = ctx.palette.resolve(style?.fg ?? style?.fgTokenPath);
    const entry: PptxPlaceholder = {
      ...bind,
      ...boxEmu(ph.box, size.w, size.h),
      ...(style?.valign && ANCHOR[style.valign] ? { anchor: ANCHOR[style.valign] } : {}),
      ...(ph.prompt ? { prompt: ph.prompt } : {}),
    };
    const family = familyOf(style?.font ?? '', ctx.fonts);
    const sizePt = Math.round(roleFontSize(master, ph.role, style) * typeScale * 0.75 * 100) / 100;
    const align = style?.align ? ALIGN[style.align] : undefined;
    entry.style = {
      sizePt,
      ...(family ? { font: family } : {}),
      ...(colour ? { color: colour.hex } : {}),
      ...(align === 'l' || align === 'ctr' || align === 'r' ? { align } : {}),
    };
    placeholders.push(entry);
  }

  // Furniture rides the layout too, so the exported deck doubles as a template: a new
  // slide built from the gallery in PowerPoint arrives with the bars and the footer.
  const shapes: PptxShape[] = [];
  for (const id of archetype.furniture ?? []) {
    const f = master.furniture.find((item) => item.id === id);
    if (!f) continue;
    const shape = furnitureShape(ctx, f, master, size);
    if (shape) shapes.push(shape);
  }

  const bgHit = ctx.palette.resolve(archetype.background?.hex ?? archetype.background?.tokenPath);
  return {
    name: archetype.name,
    ...(bgHit ? { bg: { solid: bgHit.hex } as PptxFill } : {}),
    shapes,
    media: [],
    placeholders,
  };
}

/** One piece of master furniture as a flat shape. A logo needs bytes, so it is a slide
 *  layer rather than layout furniture and is left to the frame's own rows. */
function furnitureShape(
  ctx: LowerCtx,
  f: FurnitureLayerV1,
  master: SlideMasterV1,
  size: { w: number; h: number },
): PptxShape | null {
  const box = boxEmu(f.box, size.w, size.h);
  const typeScale = typeFactor(master, size);
  if (f.kind === 'bar' || f.kind === 'rect') {
    const hit = ctx.palette.resolve(f.hex ?? f.tokenPath);
    return hit ? { kind: 'rect', ...box, fill: { solid: hit.hex } } : null;
  }
  if (f.kind === 'logo') return null;
  const role: ArchetypeRoleV1 = f.kind === 'page-number' ? 'number' : 'label';
  const colour = ctx.palette.resolve(f.style?.fg || f.style?.fgTokenPath);
  const weight = Number(f.style?.weight) || DEFAULT_TEXT_WEIGHT;
  const run: Omit<PptxRun, 'text'> = {
    sizePt: Math.round(roleFontSize(master, role, f.style) * typeScale * 0.75 * 100) / 100,
    color: colour?.hex ?? DEFAULT_TEXT_HEX,
    ...(weight >= 600 ? { bold: true } : {}),
  };
  const family = familyOf(f.style?.font ?? '', ctx.fonts);
  if (family) run.font = family;
  const align = f.style?.align ? ALIGN[f.style.align] : undefined;
  const anchor = f.style?.valign ? ANCHOR[f.style.valign] : undefined;
  return {
    kind: 'text', ...box,
    paras: parasOf(f.text ?? '', run, align),
    ...(anchor ? { anchor } : {}),
  };
}

/** Frame order: the `order` field, then x, which is what the Design render uses. */
function orderedFrames(frames: DesignFrameV1[]): DesignFrameV1[] {
  return frames
    .map((f, index) => ({ f, index }))
    .sort((a, b) => (num(a.f.row, 'order') - num(b.f.row, 'order'))
      || (num(a.f.row, 'x') - num(b.f.row, 'x'))
      || (a.index - b.index))
    .map((e) => e.f);
}

/**
 * Design frames to slides, layouts and a theme.
 *
 * A frame naming the given master and one of its archetypes is bound: it takes a
 * layout built from that archetype and its role-carrying text lowers to
 * placeholder-bound text. Every other frame lowers from its geometry alone.
 */
export async function designFramesToPptx(opts: DesignPptxOptsV1): Promise<DesignPptxResultV1> {
  const visible = orderedFrames(opts.frames.filter((f) => !hidden(f.row)));
  const frames = visible.slice(0, MAX_SLIDES);
  const first = frames[0]?.row;
  const size = {
    w: Math.max(1, Math.round(first ? num(first, 'w', opts.size?.w ?? 1280) : opts.size?.w ?? 1280)),
    h: Math.max(1, Math.round(first ? num(first, 'h', opts.size?.h ?? 720) : opts.size?.h ?? 720)),
  };

  const palette = new Palette(opts.tokens, opts.cssVars);
  const ctx: LowerCtx = {
    palette,
    fonts: opts.fonts,
    notes: new Notes(),
    schemeRefs: [],
    resolveAsset: opts.resolveAsset,
    rasterizeSvg: opts.rasterizeSvg,
  };

  if (visible.length > frames.length) {
    ctx.notes.add(`this deck was cut to the first ${MAX_SLIDES} slides`);
  }

  const master = opts.master;
  const layouts: PptxLayout[] = [];
  const layoutIndex = new Map<ArchetypeRefV1, number>();
  const bindingCache = new Map<ArchetypeRefV1, Map<string, PhBinding>>();

  const archetypeOf = (row: DesignBoxRowV1): ArchetypeV1 | null => {
    if (!master) return null;
    if (str(row, 'master') !== master.id) return null;
    const id = str(row, 'archetype');
    return id ? findArchetype(master, id) ?? null : null;
  };

  const slides: PptxSlide[] = [];
  const transitionNotes: DeckNotes = { mapped: [], dropped: [] };

  for (let i = 0; i < frames.length; i++) {
    const entry = frames[i]!;
    const frameRow = entry.row;
    const archetype = archetypeOf(frameRow);
    let bindings: Map<string, PhBinding> | undefined;
    if (archetype && master) {
      let index = layoutIndex.get(archetype.id);
      bindings = bindingCache.get(archetype.id);
      if (index === undefined || !bindings) {
        bindings = bindingsFor(archetype);
        bindingCache.set(archetype.id, bindings);
        index = layouts.length;
        layouts.push(layoutFor(ctx, archetype, master, size, bindings));
        layoutIndex.set(archetype.id, index);
      }
    }

    const sink: SlideSink = { shapes: [], media: [] };
    const bg = fillOf(ctx, frameRow);
    if (bg) sink.shapes.push({ kind: 'rect', x: 0, y: 0, cx: emu(size.w), cy: emu(size.h), fill: bg });

    const origin = { x: num(frameRow, 'x'), y: num(frameRow, 'y') };

    // Ordinals per role, counted in DOCUMENT order, because that is the order
    // `roleOrdinals`/`applyArchetype` count in (engine/src/slide-master.ts). Counting
    // them in paint order instead would bind two same-role layers to different
    // placeholders than Reset Slide and Apply archetype do, whenever someone changed a
    // layer's paint order without moving it in the document.
    const ordinalOf = new Map<DesignBoxRowV1, number>();
    const used = new Map<string, number>();
    for (const row of entry.layers) {
      const role = str(row, 'role');
      if (!role) continue;
      const ordinal = (used.get(role) ?? 0) + 1;
      used.set(role, ordinal);
      ordinalOf.set(row, ordinal);
    }

    const siblings = new Set<string>();
    for (const row of entry.layers) {
      const id = str(row, 'id');
      if (id) siblings.add(id);
    }

    const layers = entry.layers
      .map((row, index) => ({ row, index }))
      .sort((a, b) => (num(a.row, 'order') - num(b.row, 'order')) || (a.index - b.index))
      .map((e) => e.row)
      .slice(0, MAX_LAYERS_PER_SLIDE);
    if (entry.layers.length > layers.length) {
      ctx.notes.add(`a slide was cut to its first ${MAX_LAYERS_PER_SLIDE} objects`);
    }

    for (const row of layers) {
      const role = str(row, 'role');
      let binding: PhBinding | undefined;
      let masterStyle: MasterTextStyleV1 | undefined;
      if (role && archetype && bindings) {
        const ordinal = ordinalOf.get(row) ?? 1;
        binding = bindings.get(`${role}#${ordinal}`);
        masterStyle = placeholderStyle(archetype, role as ArchetypeRoleV1, ordinal);
      }
      await lowerLayer(ctx, sink, row, origin, binding, masterStyle, master, siblings);
    }

    const slide: PptxSlide = { shapes: sink.shapes, media: sink.media };
    const layoutIdx = archetype ? layoutIndex.get(archetype.id) : undefined;
    if (layoutIdx !== undefined) slide.layout = layoutIdx;
    const notes = str(frameRow, 'notes').trim();
    if (notes) slide.notes = notes;
    // A Lolly frame states how it leaves INTO the next one; a PowerPoint slide states
    // how the deck arrives ON it, so slide k plays what frame k-1 authored.
    const prior = i > 0 ? frames[i - 1]!.row : null;
    const priorResolved = opts.slideTransitions?.length === frames.length
      ? opts.slideTransitions[i - 1] ?? ''
      : '';
    const tr: PptxSlideTransition | undefined = prior
      ? deckTransition(
        str(prior, 'slideTransition') || str(prior, 'transition') || priorResolved,
        transitionNotes,
      )
      : undefined;
    if (tr) slide.transition = tr;
    slides.push(slide);
  }

  for (const line of transitionNotes.dropped) ctx.notes.add(line);

  // Only one master is loaded per deck, so a frame that names a second one lowers with
  // no layout and no placeholders. Say which, rather than let the export quietly stop
  // being a template for those slides.
  const otherMasters = new Set<string>();
  for (const f of frames) {
    const id = str(f.row, 'master');
    if (id && id !== master?.id) otherMasters.add(id);
  }
  if (otherMasters.size) {
    ctx.notes.add(
      `${[...otherMasters].sort().join(', ')} could not be honoured, so those slides carry no layout`
      + ' (one deck is lowered against one slide master)',
    );
  }

  return {
    slides,
    layouts,
    theme: palette.theme(opts.fonts),
    size,
    layoutOfArchetype: [...layoutIndex].map(([archetype, index]) => ({ archetype, index })),
    schemeRefs: ctx.schemeRefs,
    notes: ctx.notes.lines,
  };
}

/** The archetype's own style for the nth placeholder of a role, when it states one. */
function placeholderStyle(
  archetype: ArchetypeV1,
  role: ArchetypeRoleV1,
  ordinal: number,
): MasterTextStyleV1 | undefined {
  const list: PlaceholderLayerV1[] = archetype.placeholders.filter((p) => p.role === role);
  return list[ordinal - 1]?.style;
}

// ─── reading Design's own document script ─────────────────────────────────────

/** What `<script data-penpot-doc>` carries: the document background and the raw rows. */
export interface DesignDocV1 {
  background?: string;
  boxes: DesignBoxRowV1[];
}

/** Parse that script's text, or null when it is blank, not JSON, or carries no rows. */
export function parseDesignDoc(raw: string | null | undefined): DesignDocV1 | null {
  const s = raw?.trim();
  if (!s) return null;
  try {
    const doc = JSON.parse(s) as { background?: unknown; boxes?: unknown };
    if (!doc || typeof doc !== 'object' || !Array.isArray(doc.boxes)) return null;
    const boxes = doc.boxes.filter((b): b is DesignBoxRowV1 => !!b && typeof b === 'object' && !Array.isArray(b));
    if (!boxes.length) return null;
    return {
      ...(typeof doc.background === 'string' ? { background: doc.background } : {}),
      boxes,
    };
  } catch {
    return null;
  }
}

/** The document's frames, each with the layers that name it, in document order. */
export function framesOfDesignDoc(doc: DesignDocV1): DesignFrameV1[] {
  const frames: DesignFrameV1[] = [];
  const byId = new Map<string, DesignFrameV1>();
  for (const row of doc.boxes) {
    if (str(row, 'kind') !== 'frame') continue;
    const entry: DesignFrameV1 = { row, layers: [] };
    frames.push(entry);
    const id = str(row, 'id');
    if (id) byId.set(id, entry);
  }
  for (const row of doc.boxes) {
    if (str(row, 'kind') === 'frame') continue;
    const entry = byId.get(str(row, 'frame'));
    if (entry) entry.layers.push(row);
  }
  return frames;
}

/**
 * The per-slide transitions Design already resolved, read off its `[data-pptx-deck]`
 * model. Null when there is no model, which is the answer for a composed render.
 *
 * The tool resolves the document-level transition into each slide before it writes that
 * model (`resolveFrameTransition`), so reading it is how the native lowering learns a
 * value that was set once for the whole document rather than per frame.
 */
export function transitionsOfDeckModel(raw: string | null | undefined): Array<string | undefined> | null {
  const text = raw?.trim();
  if (!text) return null;
  try {
    const model = JSON.parse(text) as { slides?: unknown };
    if (!Array.isArray(model?.slides)) return null;
    return model.slides.map((slide) => {
      const v = (slide as { transition?: unknown } | null)?.transition;
      return typeof v === 'string' && v ? v : undefined;
    });
  } catch {
    return null;
  }
}

/** Does this document carry slide-master bindings, which is what the native path needs? */
export function hasMasterBindings(doc: DesignDocV1): boolean {
  return doc.boxes.some((row) => str(row, 'kind') === 'frame' && !!str(row, 'master') && !!str(row, 'archetype'));
}
