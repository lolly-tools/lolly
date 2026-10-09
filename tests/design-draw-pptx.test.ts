// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { designFramesToPptx, type DesignPptxOptsV1, type DesignPptxResultV1 } from '../packages/node-shell/src/design-pptx.ts';
import { EMU_PER_PX, buildPptxParts, type PptxRect } from '../engine/src/pptx.ts';
import { neutralSlideMaster } from '../engine/src/rebrand-design-system.ts';
import { seedFrame } from '../engine/src/slide-master.ts';
import { packPng } from '../engine/src/png.ts';
import type { DesignBoxRowV1 } from '@lolly-tools/core';
import { compileDesignDraw, compileDesignRow, type DrawShapeOp } from '../engine/src/design-draw.ts';
import { designDrawPptx, isPptxPrimitiveRow } from '../engine/src/design-draw-pptx.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';

/** Complete producer before P3e-3. This retained source imports no drawing compiler or consumer. */
const legacySource = `// SPDX-License-Identifier: MPL-2.0
/**
 * Design frames to a native PowerPoint deck (plan 274 work package 6, plan 95 route a).
 *
 * The input is Design's own authored rows - the same \`DesignBoxRowV1\` values the
 * compile writes and the tool serialises into \`<script data-penpot-doc>\` - not a DOM
 * and not a rendered page. One frame row plus its member layers becomes one
 * \`PptxSlide\`; a frame that carries a slide-master binding (\`master\` + \`archetype\`)
 * also gets a real \`PptxLayout\` built from that archetype, and its role-bound text
 * lowers to \`PptxText.ph\`, which is what makes Outline view and Reset Slide work in
 * PowerPoint.
 *
 * Frames with no binding lower from the same geometry the deck-model path uses, so a
 * hand-drawn deck still exports as editable text, rectangles and pictures.
 *
 * DOM-free and shell-free on purpose: this is the half the CLI needs to write a
 * native .pptx without launching a browser. Picture bytes arrive through injected
 * callbacks, so nothing here fetches, reads a file or reads a clock.
 *
 * KNOWN LIMIT, stated rather than hidden: the engine's \`PptxFill\` has no scheme
 * colour reference, so a fill that maps to a design-system token is written with the
 * token's resolved hex and the slot it maps to is reported in \`schemeRefs\`. The
 * theme part still carries the token values, so a later rebrand in PowerPoint moves
 * the theme; it does not yet move the shapes. Adding \`{ scheme }\` to \`PptxFill\` in
 * \`engine/src/pptx.ts\` is what closes that, and this module already computes the slot.
 */

import {
  EMU_PER_PX,
  type PptxFill,
  type PptxLayout,
  type PptxLineEnd,
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
import { imageDimensions, neutralSlideMaster, slotOrdinalOf, withSlideLayoutComponents } from '@lolly/engine';
import { bgIsDark } from '@lolly/engine';
import { decodeAuthoredPaths } from '../../../engine/src/geom/authored-url.ts';
import { contourArea, toSvgPathData, type Contour } from '../../../engine/src/geom/path.ts';
import { toCubics } from '../../../engine/src/geom/spline.ts';
import { deltaEOkSrgb } from '../../../engine/src/brand-derive.ts';
import { deckColor, deckTransition, deckWeight, nameStaticFaces, type DeckColorResolver, type DeckNotes, type ShipsFace, type WeightedRun } from './pptx-deck.ts';
import { deckPicLook, deckPlacePicture, deckSvgBakeRaster, deckSvgIntrinsicSize, gradSpecFill, isLinearGradSpec, PICTURE_FITS, type DeckIntrinsicSize, type PictureFit } from './pptx-deck.ts';

// ─── the pieces a caller hands in ─────────────────────────────────────────────

/** One frame row and the layers that name it in their \`frame\` field, in paint order. */
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
  /** CSS custom properties, for a row whose colour is still written as \`var(--brand-x)\`. */
  cssVars?: DeckColorResolver;
  resolveAsset?: DesignAssetResolver;
  /** Raster bytes for an SVG picture. Without one an SVG layer is reported, not drawn. */
  rasterizeSvg?: (bytes: Uint8Array, w: number, h: number) => Promise<Uint8Array | null>;
  /**
   * Theme font names. Design names a slot; only the caller knows the family. \`mono\` is
   * the family for a run in the \`mono\` slot. The theme never carries \`mono\`, and a mono
   * run takes \`minor\` when no \`mono\` family is given.
   */
  fonts?: { major?: string; minor?: string; mono?: string };
  /** Slide size, when the first frame does not state one. */
  size?: { w: number; h: number };
  /**
   * The transition each slide leaves on, already resolved against the document-level
   * one, in slide order. The document-level value is an input, not a row, so it is not
   * in the rows this module reads; the tool resolves it into its own deck model and
   * both shells hand that list over. A frame that states its own still wins.
   */
  slideTransitions?: ReadonlyArray<string | undefined>;
  /**
   * Does the brand pack ship this static face file (\`SUSE-Medium.ttf\`)? A run whose
   * weight is neither 400 nor 700 is written as that face ("SUSE Medium", b=0) only when
   * it answers yes (plan 291 D3). Without one, every run keeps its family and the bold
   * flag stays \`weight >= 600\`, as it always did.
   */
  shipsFace?: ShipsFace;
  /**
   * The families a run with no face of its own draws in, used only to pick its static face.
   * Never written to the theme; \`fonts\` wins when both are given.
   */
  faceFonts?: { major?: string; minor?: string };
  /**
   * The design system's colour tokens, path and resolved value, in the order the design
   * system states them. A theme slot no \`color.semantic.*\` token fills (\`lt2\`, and
   * \`accent3\` to \`accent6\` on most brands) takes one of these (\`themeSlotFills\`), so
   * PowerPoint's colour picker offers brand colours only. Without them those slots keep
   * the engine's defaults, as they always did.
   */
  tokenColors?: ReadonlyArray<{ path: string; value: string }>;
}

/** The ten DrawingML colour slots this lowering maps. \`hlink\` and \`folHlink\` are
 *  left to the engine's own theme defaults. */
export const SCHEME_SLOTS = [
  'dk1', 'lt1', 'dk2', 'lt2',
  'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6',
] as const;
export type SchemeSlotV1 = (typeof SCHEME_SLOTS)[number];

/**
 * Which design-system token each theme slot is built from.
 *
 * The table itself lives in the engine (\`engine/src/rebrand-design-system.ts\`),
 * because the renovation first pass reads the same table to map a source colour
 * that named a slot onto the same slot, and two copies would drift. This is that
 * table, typed to the ten slots this lowering writes.
 *
 * Only \`color.semantic.*\` is listed, because that is what the shipped resolvers
 * answer: both shells read the \`--brand-<slot>\` custom property the canvas carries.
 * The four slots with no entry (\`lt2\`, \`accent4\`, \`accent5\`, \`accent6\`), and any
 * listed slot whose token the design system does not state, take a brand colour from
 * \`DesignPptxOptsV1.tokenColors\` (\`themeSlotFills\`) when the caller hands that list
 * over, and the engine's own theme defaults when it does not.
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
  /** \`token\` when the row named the token path; \`value\` when its hex matched a slot. */
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

/**
 * A number off a row. A row imported from a data file (\`--boxes-data=rows.csv\`) carries
 * every field as text (\`x: '44'\`), so a finite numeric string counts too, the way \`bool\`
 * takes '1'/'0'. Reading only real numbers put every such shape at 0,0 with a 1px box.
 */
const num = (row: DesignBoxRowV1, key: string, fallback = 0): number => {
  const v = row[key];
  if (typeof v === 'number') return Number.isFinite(v) ? v : fallback;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
};

const str = (row: DesignBoxRowV1, key: string): string => {
  const v = row[key];
  return typeof v === 'string' ? v : '';
};

/**
 * A boolean off a row, the way Design's own \`boolVal\` reads one.
 *
 * Block booleans travel over the URL wire and through a \`?z=\` document as '1'/'0', so
 * a mirrored layer that came back from a share link states \`flipH: '1'\`, not \`true\`.
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

/** A token path looks like \`color.semantic.text\`: dotted, no spaces, no \`#\` or \`(\`. */
const TOKEN_PATH_RE = /^[a-z][a-z0-9-]*(?:\\.[a-z0-9-]+)+$/i;

// ─── roles to placeholder bindings ────────────────────────────────────────────

/** The placeholder type each archetype role binds to. Roles with no type of their own
 *  bind to \`body\`, which is what PowerPoint's outline and re-layout read. A \`number\`
 *  is a figure or a step number on the slide (42%, 1, 2, 3), not the page number, so
 *  it is \`body\` too: a \`sldNum\` placeholder is header and footer furniture, and three
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
 * \`<role>#<ordinal>\` so the slide side and the layout side cannot disagree.
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
    out.set(\`\${ph.role}#\${ordinal}\`, binding);
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

  theme(fonts?: { major?: string; minor?: string }, tokenColors?: ReadonlyArray<{ path: string; value: string }>): PptxTheme | undefined {
    const colors: NonNullable<PptxTheme['colors']> = {};
    for (const [slot, hex] of this.bySlot) colors[slot] = hex;
    // The slots no semantic token fills take brand colours, for the theme part only: a
    // row's colour still maps to a slot through the semantic tokens alone.
    if (tokenColors?.length) {
      const fills = themeSlotFills(this.bySlot, tokenColors.flatMap((t) => {
        const hit = deckColor(t.value, this.cssVars);
        // A theme slot is opaque, so a translucent token is no candidate.
        return hit && hit.alpha === undefined ? [{ path: t.path, hex: hit.hex }] : [];
      }));
      for (const [slot, hex] of Object.entries(fills)) colors[slot as SchemeSlotV1] = hex;
    }
    const out: PptxTheme = {};
    if (Object.keys(colors).length) out.colors = colors;
    const major = fonts?.major;
    const minor = fonts?.minor;
    if (major || minor) out.fonts = { ...(major ? { major } : {}), ...(minor ? { minor } : {}) };
    return Object.keys(out).length ? out : undefined;
  }
}

/**
 * The design system's colour tokens as a canvas carries them: every
 * \`--brand-token-<utf-8 hex of the path>\` custom property on \`style\` (the form
 * \`tokenColorVar\` writes), in declaration order, as \`{ path, value }\`. For
 * \`DesignPptxOptsV1.tokenColors\` where only the canvas is at hand.
 */
export function tokenColorsFromStyle(style: { readonly length: number; item(index: number): string; getPropertyValue(name: string): string }): Array<{ path: string; value: string }> {
  const out: Array<{ path: string; value: string }> = [];
  const decoder = new TextDecoder('utf-8', { fatal: true });
  for (let i = 0; i < style.length && out.length < 4096; i++) {
    const name = style.item(i);
    const m = /^--brand-token-((?:[0-9a-f]{2})+)$/i.exec(name);
    if (!m) continue;
    let path: string;
    try {
      path = decoder.decode(Uint8Array.from(m[1]!.match(/../g)!.map((b) => Number.parseInt(b, 16))));
    } catch { continue; }
    const value = style.getPropertyValue(name).trim();
    if (path && value) out.push({ path, value });
  }
  return out;
}

/** The order token groups are offered to the empty theme slots in: the brand's own first. */
const SLOT_FILL_GROUPS = ['color.brand.', 'color.spectrum.', 'color.ramp.', 'color.role.', 'color.semantic.', 'color.'];

/** A colour's relative luminance, 0 to 1, from an uppercase \`RRGGBB\`. */
function slotLuminance(hex: string): number {
  const channel = (at: number): number => {
    const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

/**
 * Brand colours for the theme slots no semantic token fills (plan 291 section 6).
 *
 * \`lt2\` ("Background 2") takes the candidate nearest \`lt1\` (OKLab distance) that is
 * not \`lt1\` itself, on the same side of mid grey, so a dark theme's second ground is
 * dark too. \`accent3\` to \`accent6\` take, in order, the candidates
 * no slot holds yet: the \`color.brand.*\` group first, then spectrum, ramp, role and
 * semantic tokens, each in the order the design system states them. When the brand
 * runs out of distinct colours the slots repeat the accents already set, so no slot
 * ever falls back to a colour the brand does not have. Slots \`filled\` already holds
 * are left alone. Deterministic: the same tokens give the same theme.
 */
export function themeSlotFills(
  filled: ReadonlyMap<SchemeSlotV1, string>,
  candidates: ReadonlyArray<{ path: string; hex: string }>,
): Partial<Record<SchemeSlotV1, string>> {
  const out: Partial<Record<SchemeSlotV1, string>> = {};
  const rank = (path: string): number => {
    const at = SLOT_FILL_GROUPS.findIndex((g) => path.startsWith(g));
    return at < 0 ? SLOT_FILL_GROUPS.length : at;
  };
  const seen = new Set<string>();
  const ordered = candidates
    .map((c, index) => ({ ...c, hex: c.hex.toUpperCase(), index }))
    .filter((c) => /^[0-9A-F]{6}$/.test(c.hex))
    .sort((a, b) => rank(a.path) - rank(b.path) || a.index - b.index)
    .filter((c) => {
      if (seen.has(c.hex)) return false;
      seen.add(c.hex);
      return true;
    });
  if (!ordered.length) return out;
  const used = new Set<string>(filled.values());

  if (!filled.has('lt2')) {
    // Background 2 is a second ground: the candidate nearest Background 1 (OKLab
    // distance), on the same side of mid grey, so a dark theme gets a dark one.
    const lt1 = filled.get('lt1') ?? 'FFFFFF';
    const rgb = (hex: string): [number, number, number] => [0, 2, 4].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)) as [number, number, number];
    const light = slotLuminance(lt1) >= 0.5;
    let best: { hex: string; gap: number } | null = null;
    for (const c of ordered) {
      if (c.hex === lt1) continue;
      if ((slotLuminance(c.hex) >= 0.5) !== light) continue;
      const gap = deltaEOkSrgb(rgb(c.hex), rgb(lt1));
      if (!best || gap < best.gap) best = { hex: c.hex, gap };
    }
    const lt2 = best?.hex ?? lt1;
    if (lt2) {
      out.lt2 = lt2;
      used.add(lt2);
    }
  }

  const fresh = ordered.filter((c) => !used.has(c.hex)).map((c) => c.hex);
  const accents = (['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'] as const)
    .map((slot) => filled.get(slot))
    .filter((hex): hex is string => typeof hex === 'string');
  const repeat = accents.length ? accents : ordered.map((c) => c.hex);
  let k = 0;
  for (const slot of ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'] as const) {
    if (filled.has(slot)) continue;
    const hex = fresh.shift() ?? repeat[k++ % repeat.length]!;
    out[slot] = hex;
  }
  return out;
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
function familyOf(slot: string, fonts?: { major?: string; minor?: string; mono?: string }): string | undefined {
  if (!slot) return undefined;
  if (slot === 'display') return fonts?.major;
  if (slot === 'mono') return fonts?.mono || fonts?.minor;
  if (slot === 'sans') return fonts?.minor;
  return slot;
}

/** A run colour Design text states (\`#rgb\` or \`#rrggbb\`), as six hex digits with the \`#\`. */
function longHex(color: string): string | undefined {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})(?:[0-9a-fA-F]{2})?$/.exec(color.trim());
  if (!m?.[1]) return undefined;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  return \`#\${h.toLowerCase()}\`;
}

/** A line that starts with two or more spaces before its words: an outline level Design draws as indent. */
const INDENTED_LINE = /(^|\\n) {2,}\\S/;

/**
 * Paragraphs for one text row. Plain text is one paragraph per line with one run
 * each, as it always was. Text in Design's subset (plan 275 section 7.2) is read
 * through the engine's \`parseDesignText\`: a \`- \` line is a bullet, an \`N. \` line a
 * number, two leading spaces a level, and each run keeps bold, italic, underline,
 * strike and colour, so no marker reaches the deck as a character. A line with no
 * marker keeps its level too: its leading spaces become the paragraph's level
 * rather than characters in its text, which is how a plain paragraph of an outline
 * and the line after a soft break travel. The weight model is Design's: an
 * explicit \`{wNNN|...}\` decides a run, otherwise \`**\` or the row. \`onRestart\` hears
 * of a numbered list that starts past 1, which the pptx writer numbers from 1.
 */
function parasOf(
  text: string,
  run: Omit<WeightedRun, 'text'>,
  align: PptxPara['align'],
  resolveColour?: (hex: string) => string | undefined,
  onRestart?: () => void,
): PptxPara[] {
  if (!hasDesignMarkup(text) && !INDENTED_LINE.test(text)) {
    return text.split('\\n').map((line) => ({
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
      const out: WeightedRun = { ...run, text: partText };
      if (part.weight !== undefined) {
        if (part.weight >= 600) out.bold = true;
        else delete out.bold;
      } else if (part.bold) out.bold = true;
      // The weight the face pass reads: \`**\` is Bold 700 even inside a Medium row, so it
      // keeps the family and b=1 rather than being named the row's Medium face.
      const weight = deckWeight(part.weight ?? (part.bold ? 700 : run.weight));
      if (weight !== undefined) out.weight = weight;
      else delete out.weight;
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
 * The blend keywords Design paints with. \`normal\` is the OFF value the Blend control
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

/** What a Design shadow can be cast on. \`none\` is the OFF value, so it is not here. */
const SHADOW_TARGETS: ReadonlySet<string> = new Set(['box', 'text', 'content', 'depth']);

/** What Design paints text with when the row and the master both state nothing. Same
 *  two values the deck lowering uses, so the two paths agree on an unstyled layer. */
const DEFAULT_TEXT_WEIGHT = 700;
const DEFAULT_TEXT_HEX = '11141F';
/** Design's line height when a row states none (\`num(cb.lineHeight, 1.12)\` in the renderer). */
const DEFAULT_LINE_HEIGHT = 1.12;

/**
 * Design's arrowheads as DrawingML line ends, the same map as the renderer's
 * \`DECK_LINE_ENDS\`. A \`bar\` has no DrawingML form; it is left off with a note.
 */
const LINE_ENDS_OF_HEADS: Readonly<Record<string, PptxLineEnd>> = { triangle: 'triangle', open: 'arrow', circle: 'oval', diamond: 'diamond' };

/** One head field as a line end. An own-property lookup, so an inherited key never matches. */
function lineEndOf(ctx: LowerCtx, row: DesignBoxRowV1, key: 'headStart' | 'headEnd'): PptxLineEnd | undefined {
  const head = str(row, key);
  if (head === 'bar') ctx.notes.add('a bar arrowhead has no PowerPoint line end, so it was left off');
  return Object.hasOwn(LINE_ENDS_OF_HEADS, head) ? LINE_ENDS_OF_HEADS[head] : undefined;
}

/**
 * Effects a flat deck element cannot state. A row wearing one is left out, with a note.
 *
 * This mirrors \`deckInexpressible\` in community/design/hooks.js one for one, and it has
 * to: a guard missing here does not make the layer export better, it makes it export
 * WRONG - flat where the canvas is tilted, unmasked where the canvas is clipped.
 * \`byId\` is the frame's own rows, which a clip mask names.
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
  // A linear gradient on a flat, unturned box is a native gradFill (plan 291 M4: a scrim
  // over a photo). Radial and conic have no lowering, a turned gradient would need the
  // fill to turn with its shape, and a translucent gradient over a fill of its own
  // cannot be split into two shapes without changing how the two blend.
  const grad = str(row, 'grad').trim();
  if (grad !== '') {
    if (!linearGradBox(row)) return 'a gradient fill';
    if (num(row, 'opacity', 100) !== 100 && str(row, 'bg').trim() !== '') return 'partial opacity';
  }
  if (num(row, 'blur') > 0 || num(row, 'bgBlur') > 0) return 'a blur';
  if (BLEND_MODES.has(str(row, 'blend'))) return 'a blend mode';
  if (SHADOW_TARGETS.has(str(row, 'shadow'))) return 'a shadow';
  const clip = str(row, 'clip').trim();
  if (clip && clip !== str(row, 'id') && byId?.has(clip)) return 'a clip mask';
  return null;
}

/** Row kinds whose opacity folds into the alpha of their fill, line or text colour, or, for a picture, its alphaModFix. */
const FOLDS_OPACITY: ReadonlySet<string> = new Set(['box', 'path', 'text', 'image']);
/** Row kinds a deck shape turns as the canvas does, by the \`rot\` on its transform. */
const TURNS: ReadonlySet<string> = new Set(['box', 'path', 'text']);
/** Row kinds whose mirror the lowering can draw: a box is symmetric, a path's outline takes it, a picture flips on its xfrm. */
const MIRRORS: ReadonlySet<string> = new Set(['box', 'path', 'image']);

/**
 * A row whose \`grad\` lowers natively: a box (not text, a picture or a path) that is not
 * turned, with a linear spec. The renderer's \`deckLinearGrad\` is the same predicate.
 */
function linearGradBox(row: DesignBoxRowV1): boolean {
  const kind = str(row, 'kind') || 'box';
  return kind === 'box' && num(row, 'rot') === 0 && isLinearGradSpec(str(row, 'grad'));
}

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
 * not decode. \`open\` says the value is one open contour, the only shape with two
 * ends for arrowheads, judged on the decoded value the way the renderer judges a value.
 */
function pathDataOf(row: DesignBoxRowV1, cx: number, cy: number): { d: string; contours: Contour[]; open: boolean } | null {
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
  // One decimal, not none: \`toSvgPathData\` trims trailing zeros, and at no decimals it
  // trims them off whole numbers too, so 1524000 EMU would be written as 1524.
  return contours.length ? { d: toSvgPathData(contours, 1), contours, open: paths.length === 1 && paths[0]!.closed !== true } : null;
}

/** \`true\` for a row the render does not paint at all. */
const hidden = (row: DesignBoxRowV1): boolean => bool(row, 'hidden');

interface LowerCtx {
  palette: Palette;
  fonts?: { major?: string; minor?: string; mono?: string };
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

/** One picture row to a \`PptxPic\`, or null when the bytes are not reachable here. */
async function picOf(
  ctx: LowerCtx,
  sink: SlideSink,
  row: DesignBoxRowV1,
  box: { x: number; y: number; cx: number; cy: number },
): Promise<PptxPic | null> {
  // A row's picture is either the reference as authored or, once the runtime has
  // resolved it, the \`{ type, url }\` the render draws from. Both reach here.
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
    ctx.notes.add(\`a picture over \${Math.round(MAX_PICTURE_BYTES / (1024 * 1024))} MB was left out\`);
    return null;
  }
  const ext = EXT_OF_MIME[got.mime.toLowerCase().split(';')[0] ?? ''];
  if (!ext) {
    ctx.notes.add(\`a picture in \${got.mime} was left out (PowerPoint reads PNG, JPEG and SVG)\`);
    return null;
  }
  // The fit the canvas draws: \`imgCss\` in the Design renderer reads an unset or unknown
  // fit as contain, so a logo or a photo in a contain slot is letterboxed there, and the
  // deck places it the same way instead of stretching it over the whole box.
  const fitRaw = str(row, 'fit');
  const fit: PictureFit = (PICTURE_FITS as readonly string[]).includes(fitRaw) ? fitRaw as PictureFit : 'contain';
  const intrinsic = ext === 'svg' ? deckSvgIntrinsicSize(got.bytes) : rasterIntrinsicSize(got.bytes, got.mime);
  if (!intrinsic && fit !== 'fill') {
    ctx.notes.add(\`a picture set to \${fit} was placed over its whole box, because its size could not be read\`);
  }
  // Mirrored inside its own box when the row is flipped, as the canvas mirrors the box
  // (plan 291 M4); the flips and the opacity ride on the picture itself.
  const placed = deckPlacePicture(row, box, intrinsic, fit);
  const look = deckPicLook({ name: str(row, 'name'), flipH: bool(row, 'flipH'), flipV: bool(row, 'flipV'), opacity: opacityOf(row) * 100 });
  const srcRect = placed.srcRect;
  // A treated photo (an SVG wrapper that draws a raster through a filter) travels as one
  // baked raster with no svg part, because PowerPoint's SVG renderer is not known to
  // honour the filter (plan 291 M4). The rasteriser gives PNG.
  const bake = ext === 'svg' ? deckSvgBakeRaster(got.bytes, MAX_FALLBACK_PX) : null;
  if (bake) {
    const baked = ctx.rasterizeSvg ? await ctx.rasterizeSvg(got.bytes, bake.w, bake.h) : null;
    if (!baked) {
      ctx.notes.add('a treated picture was left out because this run cannot render it to a raster');
      return null;
    }
    return { kind: 'pic', ...placed.box, media: addMedia(sink, baked, 'png'), ...look, ...(srcRect ? { srcRect } : {}) };
  }
  if (ext === 'svg') {
    // svgBlip needs a raster fallback beside it, which only a caller with a rasteriser
    // can supply. Without one the vector is reported rather than drawn wrong. The
    // fallback is drawn at twice the size the picture shows at, as the web export draws
    // its own, so it keeps the vector's aspect and stays sharp where a viewer shows the
    // PNG; a source crop applies to it the same way it applies to the vector.
    const scale = Math.min(FALLBACK_SCALE, MAX_FALLBACK_PX / Math.max(placed.drawn.cx / EMU_PER_PX, placed.drawn.cy / EMU_PER_PX, 1));
    const w = Math.max(1, Math.round((placed.drawn.cx / EMU_PER_PX) * scale));
    const h = Math.max(1, Math.round((placed.drawn.cy / EMU_PER_PX) * scale));
    const png = ctx.rasterizeSvg ? await ctx.rasterizeSvg(got.bytes, w, h) : null;
    if (!png) {
      ctx.notes.add('a vector picture was left out because this run cannot render its PNG fallback');
      return null;
    }
    const svgIdx = addMedia(sink, got.bytes, 'svg');
    const pngIdx = addMedia(sink, png, 'png');
    return {
      kind: 'pic', ...placed.box, media: pngIdx, svg: svgIdx, name: str(row, 'name') || undefined,
      ...look, ...(srcRect ? { srcRect } : {}),
    };
  }
  return {
    kind: 'pic', ...placed.box, media: addMedia(sink, got.bytes, ext), name: str(row, 'name') || undefined,
    ...look, ...(srcRect ? { srcRect } : {}),
  };
}

/** The longest side, in pixels, an SVG picture's PNG fallback is drawn at. */
const MAX_FALLBACK_PX = 4096;
/** Pixels of PNG fallback per pixel the picture shows at. */
const FALLBACK_SCALE = 2;

function rasterIntrinsicSize(bytes: Uint8Array, mime: string): DeckIntrinsicSize | null {
  const dims = imageDimensions(bytes, mime);
  return dims && dims.w > 0 && dims.h > 0 ? { w: dims.w, h: dims.h, natural: true } : null;
}

/**
 * One member layer to one shape on the slide.
 *
 * \`binding\` is set when the layer carries a role the archetype has a placeholder for,
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
    ctx.notes.add(\`\${limit} was left out of the deck; this lowering emits flat, axis-aligned objects with a solid fill\`);
    return;
  }
  // Motion is a deck-model citizen, not a row one: \`deckAnimFor\` builds it in the tool
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
    const line: PptxPath['line'] = strokeHit && strokeW > 0 ? lineOf(strokeHit, strokeW, opacity) : undefined;
    // Arrowheads ride the line's own ends, on the terms the canvas and the deck model
    // draw them: a stroked single open contour only (plan 291 W5).
    if (line && data.open) {
      const head = lineEndOf(ctx, row, 'headStart');
      const tail = lineEndOf(ctx, row, 'headEnd');
      if (head) line.head = head;
      if (tail) line.tail = tail;
    }
    const shape: PptxPath = {
      kind: 'path', ...box, ...rotOf(row),
      paths: [{ d: data.d }],
      ...(fill ? { fill: withFillAlpha(fill, opacity) } : {}),
      ...(line ? { line } : {}),
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
    // An empty \`fg\` is absent, not black: the blocks wire format round-trips a cleared
    // colour as '', and \`??\` would let that shadow the master's own style.
    const colour = ctx.palette.resolve(str(row, 'fg') || masterStyle?.fg || masterStyle?.fgTokenPath);
    // Design paints an absent weight as 700 (\`weightOf\`), so a master-seeded title with
    // no weight of its own is BOLD on the canvas and has to be bold in the deck too.
    const weight = num(row, 'weight', 0) || Number(str(row, 'weight'))
      || Number(masterStyle?.weight) || DEFAULT_TEXT_WEIGHT;
    const textAlpha = foldAlpha(colour?.alpha, opacity);
    const run: Omit<WeightedRun, 'text'> = {
      sizePt: Math.round(sizePx * 0.75 * 100) / 100,
      color: colour?.hex ?? DEFAULT_TEXT_HEX,
      ...(weight >= 600 ? { bold: true } : {}),
      ...(textAlpha !== undefined ? { alpha: textAlpha } : {}),
    };
    const runWeight = deckWeight(weight);
    if (runWeight !== undefined) run.weight = runWeight;
    const family = familyOf(str(row, 'font') || masterStyle?.font || '', ctx.fonts);
    if (family) run.font = family;
    const align = ALIGN[str(row, 'align') || masterStyle?.align || ''];
    const anchor = ANCHOR[str(row, 'valign') || masterStyle?.valign || ''];
    // The canvas line height is a multiple of the font size, so it travels as an exact
    // pitch in points, as the deck model writes it: a percentage would scale PowerPoint's
    // own single spacing, which differs by face and by platform (plan 291 W5).
    const lineHeight = Math.min(4, Math.max(0.5, num(row, 'lineHeight', DEFAULT_LINE_HEIGHT)));
    const lineSpacingPt = Math.round(lineHeight * sizePx * 0.75 * 100) / 100;
    const text: PptxText = {
      kind: 'text', ...box, ...rotOf(row),
      paras: parasOf(str(row, 'text'), run, align, (hex) => ctx.palette.resolve(hex)?.hex,
        () => ctx.notes.add('a numbered list that starts past 1 was numbered from 1'))
        .map((para) => ({ ...para, lineSpacingPt })),
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
  const radius = str(row, 'shape') === 'rounded' ? { radius: emu(num(row, 'radius')) } : {};
  // A linear gradient (plan 291 M4). CSS paints the flat fill under the gradient, so a
  // box with both is two rectangles, the fill first; the outline rides the top one. The
  // mirror folds into the gradient's angle and the opacity into its stops.
  const gradFill = linearGradBox(row)
    ? gradSpecFill(str(row, 'grad').trim(), { flipH: bool(row, 'flipH'), flipV: bool(row, 'flipV') })
    : null;
  if (gradFill && fill) {
    sink.shapes.push({ kind: 'rect', ...box, ...rotOf(row), fill: withFillAlpha(fill, opacity), ...radius });
  }
  const top = gradFill ?? fill;
  const rect: PptxShape = {
    kind: 'rect', ...box, ...rotOf(row),
    ...(top ? { fill: withFillAlpha(top, opacity) } : {}),
    ...(strokeHit && strokeW > 0 ? { line: lineOf(strokeHit, strokeW, opacity) } : {}),
    ...radius,
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

/** A fill with the row's opacity folded into its alpha: a solid's own, or every gradient stop's. */
function withFillAlpha(fill: PptxFill, opacity: number): PptxFill {
  if (!('solid' in fill)) {
    if (opacity >= 1) return fill;
    return {
      grad: fill.grad.map((stop) => {
        const alpha = foldAlpha(stop.alpha, opacity);
        return { pos: stop.pos, color: stop.color, ...(alpha !== undefined ? { alpha } : {}) };
      }),
      angle: fill.angle,
    };
  }
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
  kept?: ReadonlySet<string>,
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
    const bind = bindings.get(\`\${ph.role}#\${ordinal}\`);
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
    const styleWeight = deckWeight(Number(style?.weight) || undefined);
    const phStyle: NonNullable<PptxPlaceholder['style']> & { weight?: number } = {
      sizePt,
      ...(family ? { font: family } : {}),
      ...(colour ? { color: colour.hex } : {}),
      ...(align === 'l' || align === 'ctr' || align === 'r' ? { align } : {}),
      // For the face pass only; it is removed before the engine sees the style.
      ...(styleWeight !== undefined ? { weight: styleWeight } : {}),
    };
    entry.style = phStyle;
    placeholders.push(entry);
  }

  // Furniture rides the layout too, so the exported deck doubles as a template: a new
  // slide built from the gallery in PowerPoint arrives with the bars and the footer.
  const shapes: PptxShape[] = [];
  // A piece a slide of this layout left out (compose's \`omit\`, or a layer someone
  // deleted) is left off the layout too: PowerPoint draws the layout under the slide,
  // so the piece would come back on that slide, and on every new slide from the layout.
  for (const id of archetype.furniture ?? []) {
    if (kept && !kept.has(id)) continue;
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

/**
 * The context a layout is built in. A slide that is dark by design (a title, a full-page
 * picture, a closing slide) stays dark in every theme of a composed document, which
 * holds it at the master's colours (plan 291 M4); a master whose ground is a
 * theme-following token (\`color.semantic.text\`) would still give it a light layout in a
 * dark theme, so a slide reset or added in PowerPoint came back inverted. When the
 * theme turns such an archetype's ground light while the frame's own ground is dark,
 * the layout takes the frame's ground and the colours of its role and furniture layers
 * for the master's token paths. Every other layout is built as before.
 */
function heldLayoutCtx(ctx: LowerCtx, archetype: ArchetypeV1, master: SlideMasterV1, frame: DesignFrameV1): LowerCtx {
  const ground = archetype.background;
  if (ground?.dark !== true || ground.hex) return ctx;
  const themed = ctx.palette.resolve(ground.tokenPath);
  if (!themed || bgIsDark(themed.hex) || !frameGroundIsDark(frame.row)) return ctx;
  const byPath = new Map<string, string>();
  const take = (path: string | undefined, value: unknown): void => {
    if (path && typeof value === 'string' && value && !byPath.has(path) && ctx.palette.resolve(value)) byPath.set(path, value);
  };
  take(ground.tokenPath, frame.row.bg);
  const seen = new Map<string, number>();
  for (const ph of archetype.placeholders) {
    const nth = (seen.get(ph.role) ?? 0) + 1;
    seen.set(ph.role, nth);
    if (ph.kind === 'image' || ph.style?.fg) continue;
    take(ph.style?.fgTokenPath, frame.layers.filter((l) => l.role === ph.role && !l.furniture)[nth - 1]?.fg);
  }
  for (const id of archetype.furniture ?? []) {
    const f = master.furniture.find((item) => item.id === id);
    const layer = frame.layers.find((l) => l.furniture === id);
    if (!f || !layer) continue;
    if (!f.hex) take(f.tokenPath, layer.bg);
    if (!f.style?.fg) take(f.style?.fgTokenPath, layer.fg);
  }
  if (!byPath.has(ground.tokenPath ?? '')) return ctx;
  const base = ctx.palette;
  const held = Object.create(base) as Palette;
  held.resolve = (raw: unknown): ColourHit | null => (typeof raw === 'string' && byPath.has(raw) ? base.resolve(byPath.get(raw)) : base.resolve(raw));
  return { ...ctx, palette: held };
}

/**
 * The furniture ids every frame bound to one archetype carries as a layer (each
 * seeded furniture layer gives its piece's id in \`furniture\`). A layout carries only these,
 * so it never shows a piece one of its slides left out.
 */
function furnitureOnEvery(frames: readonly DesignFrameV1[], archetypeId: string, masterId: string): Set<string> {
  let common: Set<string> | undefined;
  for (const frame of frames) {
    if (str(frame.row, 'master') !== masterId || str(frame.row, 'archetype') !== archetypeId) continue;
    const here = new Set<string>();
    for (const row of frame.layers) {
      const id = str(row, 'furniture');
      if (id && !hidden(row)) here.add(id);
    }
    const prior: Set<string> | undefined = common;
    common = prior ? new Set([...prior].filter((id: string) => here.has(id))) : here;
  }
  return common ?? new Set<string>();
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
    // A translucent bar (a caption scrim is \`#1d1d1db8\`) keeps its alpha on the layout.
    return hit ? { kind: 'rect', ...box, fill: { solid: hit.hex, ...(hit.alpha !== undefined ? { alpha: hit.alpha } : {}) } } : null;
  }
  if (f.kind === 'logo') return null;
  const role: ArchetypeRoleV1 = f.kind === 'page-number' ? 'number' : 'label';
  const colour = ctx.palette.resolve(f.style?.fg || f.style?.fgTokenPath);
  const weight = Number(f.style?.weight) || DEFAULT_TEXT_WEIGHT;
  const run: Omit<WeightedRun, 'text'> = {
    sizePt: Math.round(roleFontSize(master, role, f.style) * typeScale * 0.75 * 100) / 100,
    color: colour?.hex ?? DEFAULT_TEXT_HEX,
    ...(weight >= 600 ? { bold: true } : {}),
  };
  const runWeight = deckWeight(weight);
  if (runWeight !== undefined) run.weight = runWeight;
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

/** Frame order: the \`order\` field, then x, which is what the Design render uses. */
function orderedFrames(frames: DesignFrameV1[]): DesignFrameV1[] {
  return frames
    .map((f, index) => ({ f, index }))
    .sort((a, b) => (num(a.f.row, 'order') - num(b.f.row, 'order'))
      || (num(a.f.row, 'x') - num(b.f.row, 'x'))
      || (a.index - b.index))
    .map((e) => e.f);
}

/** Does a frame's own ground read dark: its \`bg\` hex, or the fallback of a \`var(--brand-*, #hex)\`. */
function frameGroundIsDark(row: DesignBoxRowV1): boolean {
  const bg = typeof row.bg === 'string' ? row.bg : '';
  const hex = /#[0-9a-f]{6}\\b|#[0-9a-f]{3}\\b/i.exec(bg)?.[0];
  return !!hex && bgIsDark(hex);
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
    ctx.notes.add(\`this deck was cut to the first \${MAX_SLIDES} slides\`);
  }

  // A content-sized recipe (\`flow-cards-4-2\`, \`flow-columns-3-3\`) is not in the master's
  // own list: \`seedFrame\` builds it from the content archetype on demand, so the same
  // expansion is what finds it here. Without it those frames lowered with no layout.
  const master = opts.master
    ? withSlideLayoutComponents(opts.master, frames
      .filter((f) => str(f.row, 'master') === opts.master!.id)
      .map((f) => str(f.row, 'archetype'))
      .filter(Boolean))
    : undefined;
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
  // Slides of a light archetype drawn dark (compose's Dark theme), by number, with the layout names.
  const drawnDark: number[] = [];
  const drawnDarkLayouts = new Set<string>();

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
        layouts.push(layoutFor(heldLayoutCtx(ctx, archetype, master, entry), archetype, master, size, bindings, furnitureOnEvery(frames, archetype.id, master.id)));
        layoutIndex.set(archetype.id, index);
      }
    }

    const sink: SlideSink = { shapes: [], media: [] };
    if (archetype && archetype.background?.dark !== true && frameGroundIsDark(frameRow)) {
      drawnDark.push(i + 1);
      drawnDarkLayouts.add(archetype.name || archetype.id);
    }
    const bg = fillOf(ctx, frameRow);
    if (bg) sink.shapes.push({ kind: 'rect', x: 0, y: 0, cx: emu(size.w), cy: emu(size.h), fill: bg });

    const origin = { x: num(frameRow, 'x'), y: num(frameRow, 'y') };

    // The slot each role-bound layer fills, by the engine's own rule (\`slotOrdinalOf\`,
    // engine/src/slide-master.ts), which is what Reset Slide and Apply archetype relay
    // by: the seeded id first, so \`body-2\` stays the second body when \`body\` was
    // dropped, then the lowest free slot in DOCUMENT order. Paint order would bind two
    // same-role layers differently whenever someone restacked a layer in place.
    const ordinalOf = new Map<DesignBoxRowV1, number>();
    if (archetype) {
      for (const row of entry.layers) {
        if (!str(row, 'role')) continue;
        const ordinal = slotOrdinalOf(row, entry.layers);
        if (ordinal > 0) ordinalOf.set(row, ordinal);
      }
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
      ctx.notes.add(\`a slide was cut to its first \${MAX_LAYERS_PER_SLIDE} objects\`);
    }

    for (const row of layers) {
      const role = str(row, 'role');
      let binding: PhBinding | undefined;
      let masterStyle: MasterTextStyleV1 | undefined;
      const ordinal = ordinalOf.get(row);
      if (role && archetype && bindings && ordinal !== undefined) {
        binding = bindings.get(\`\${role}#\${ordinal}\`);
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
  // Plan 291 M4: a dark layout for each themed archetype is not written yet, so the
  // light layout is bound and the slide carries its own dark ground and ink.
  if (drawnDark.length) {
    const which = drawnDark.length === 1 ? \`slide \${drawnDark[0]} is\` : \`slides \${drawnDark.slice(0, -1).join(', ')} and \${drawnDark[drawnDark.length - 1]} are\`;
    ctx.notes.add(
      \`\${which} drawn dark on a light layout (\${[...drawnDarkLayouts].join(', ')}): the dark ground and ink are set on the slide itself,\`
      + ' so Reset Slide in PowerPoint, or a new slide from that layout, comes back light',
    );
  }

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
      \`\${[...otherMasters].sort().join(', ')} could not be honoured, so those slides carry no layout\`
      + ' (one deck is lowered against one slide master)',
    );
  }

  // PowerPoint states Regular or Bold only, so a weight between them becomes the static
  // face the brand ships, or stays the family when it ships none. This also removes the
  // weight every run carried to get here.
  await nameStaticFaces({ slides, layouts }, { ...opts.faceFonts, ...opts.fonts }, opts.shipsFace);

  return {
    slides,
    layouts,
    theme: palette.theme(opts.fonts, opts.tokenColors),
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

/** What \`<script data-penpot-doc>\` carries: the document background and the raw rows. */
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
 * The per-slide transitions Design already resolved, read off its \`[data-pptx-deck]\`
 * model. Null when there is no model, which is the answer for a composed render.
 *
 * The tool resolves the document-level transition into each slide before it writes that
 * model (\`resolveFrameTransition\`), so reading it is how the native lowering learns a
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

/**
 * The slide master a bound document is lowered against, given what the active catalog
 * answered for the id its frames name (plan 291 M3, B5).
 *
 * The catalog's own master wins. When the catalog has none and the id is the engine's
 * neutral master (\`lolly/slides/neutral\`, which \`lolly compose\` falls back to when a
 * design system ships no master), the engine's copy is used and \`note\` says so, so a
 * neutral deck still exports Tier A under a profile whose catalog carries another
 * master. Null for any other id the catalog cannot answer: the caller keeps to the
 * deck model, as before.
 */
export function slideMasterForExport(
  id: string,
  fromCatalog: SlideMasterV1 | null | undefined,
): { master: SlideMasterV1; note?: string } | null {
  if (fromCatalog) return { master: fromCatalog };
  const neutral = neutralSlideMaster();
  if (!id || id !== neutral.id) return null;
  return {
    master: neutral,
    note: \`\${id} is not in this profile's catalog, so the engine's own neutral slide master \${neutral.version} gave the layouts\`,
  };
}
`;

assert.equal(createHash('sha256').update(legacySource).digest('hex'), 'f8e7c1b606bd4ac2ae9f5926357c5e4bd117f5a2b32b8d26cd4483e34804b88a', 'the retained producer source is immutable');
const bundled = await build({ stdin: { contents: legacySource, resolveDir: fileURLToPath(new URL('../packages/node-shell/src/', import.meta.url)), sourcefile: 'legacy-design-pptx.ts', loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'esm' });
const legacy = (await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles![0]!.text).toString('base64')}`)).designFramesToPptx as typeof designFramesToPptx;
const NOW = '2026-10-09T12:00:00.000Z';
const master = neutralSlideMaster();
const tokens: Record<string, string> = { 'color.semantic.text': '#11141f', 'color.semantic.surface': '#ffffff', 'color.semantic.primary': '#30ba78', 'color.semantic.muted': '#889999' };
const picture = packPng(new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]), { width: 2, height: 2 });
function fixture(trace: string[]): DesignPptxOptsV1 {
  const seeded = seedFrame(master, 'content', { frameId: 'seeded', x: 100.25, y: -20.125, resolveToken: path => tokens[path] })!;
  const ordinary = { id: 'ordinary', kind: 'box', frame: 'seeded', x: 120.5, y: 40.25, w: 220.5, h: 110.75, bg: 'color.semantic.primary', stroke: 'var(--edge, #abcdef80)', strokeW: 2.125, opacity: 42.5, rot: 12.345, shape: 'rounded', radius: 24.125, flipH: '1' };
  return {
    frames: [{ row: { ...seeded.frame, x: 100.25, y: -20.125, notes: 'A fixed speaker note.', transition: 'fade' }, layers: [
      ...seeded.layers.map(row => row.kind === 'text' ? { ...row, text: String(row.role || 'text'), weight: 500 } : row),
      ordinary,
      { id: 'tiny', kind: 'box', x: 100.25, y: -20.125, w: 0.000001, h: -5, bg: '#12345680', stroke: '#abcdef', strokeW: 0.000001, shape: 'rounded', radius: 0 },
      { id: 'numeric', kind: 'box', x: '0x10', y: '50%', w: '12.5', h: '7px', radius: '-3', shape: 'rounded', bg: '#abcdef' },
      { id: 'hidden', kind: 'box', hidden: 'yes', bg: '#ff0000', w: 100, h: 100 },
      { id: 'picture', kind: 'image', image: 'fixture-picture', x: 200, y: 100, w: 20, h: 20, fit: 'contain' },
    ] }, { row: { id: 'unbound', kind: 'frame', x: 1500.75, y: 0, w: 1280, h: 720, order: 1 }, layers: [
      { id: 'unbound-box', kind: 'box', x: 1510.5, y: 5.75, w: 15.5, h: 8.25, bg: '#334455', shape: 'circle' },
    ] }], master,
    tokens(path) { trace.push(`token:${path}`); return tokens[path]; },
    cssVars(css) { trace.push(`css:${css}`); return css === '--edge' ? '#abcdef80' : undefined; },
    resolveAsset: async ref => { trace.push(`asset:${ref}`); return { bytes: picture, mime: 'image/png' }; },
    fonts: { major: 'SUSE', minor: 'SUSE' }, shipsFace: async name => { trace.push(`face:${name}`); return true; },
    tokenColors: [{ path: 'color.brand.green', value: '#30ba78' }],
  };
}
function parts(result: DesignPptxResultV1) {
  return buildPptxParts(result.slides, { emuW: result.size.w * EMU_PER_PX, emuH: result.size.h * EMU_PER_PX,
    theme: result.theme, layouts: result.layouts, now: NOW, meta: { title: 'Primitive compatibility' } });
}
test('the complete frozen producer characterizes native IR, parts and resolver order with independent controls', async () => {
  const oldTrace: string[] = [], newTrace: string[] = [];
  const expected = await legacy(fixture(oldTrace)), actual = await designFramesToPptx(fixture(newTrace));
  assert.deepEqual(actual, expected);
  assert.deepEqual(parts(actual), parts(expected));
  assert.deepEqual(newTrace, oldTrace);
  assert.ok(oldTrace.some(item => item.startsWith('css:')));
  assert.ok(oldTrace.some(item => item.startsWith('asset:')));
  assert.ok(oldTrace.some(item => item.startsWith('face:')));
  const shapeIndex = expected.slides[0]!.shapes.findIndex(shape => shape.kind === 'rect' && shape.x === Math.round(20.25 * EMU_PER_PX));
  assert.ok(shapeIndex >= 0);
  const shape = expected.slides[0]!.shapes[shapeIndex]! as PptxRect;
  assert.equal(shape.y, Math.round(60.375 * EMU_PER_PX));
  assert.equal(shape.rot, 12.345);
  assert.equal(shape.radius, Math.round(24.125 * EMU_PER_PX));
  assert.equal(shape.fill && 'solid' in shape.fill ? shape.fill.alpha : undefined, 0.425);
  assert.equal(shape.line!.alpha, 0.213);
  assert.equal(expected.slides[0]!.shapes.filter(item => item.kind === 'rect' && item.fill && 'solid' in item.fill && item.fill.solid === 'FF0000').length, 0);
  for (const mutation of ['missing', 'shifted', 'paint', 'radius', 'stroke'] as const) {
    const changed = structuredClone(expected);
    const changedShape = changed.slides[0]!.shapes[shapeIndex]! as PptxRect;
    if (mutation === 'missing') changed.slides[0]!.shapes.splice(shapeIndex, 1);
    if (mutation === 'shifted') changedShape.x += 1;
    if (mutation === 'paint') changedShape.fill = { solid: 'FF0000' };
    if (mutation === 'radius') changedShape.radius = EMU_PER_PX;
    if (mutation === 'stroke') changedShape.line!.w += 1;
    assert.throws(() => assert.deepEqual(changed, expected), mutation);
    assert.throws(() => assert.deepEqual(parts(changed), parts(expected)), mutation);
  }
});

test('native primitive emission reads evaluated facts, retaining EMU geometry and radius presence', () => {
  const row = { id: 'owned', kind: 'box', shape: 'rounded', x: '0x10', y: -0.75, w: 0.000001, h: -1, rot: 12.345, radius: -3, flipH: '1', opacity: 42.5 };
  const supplied = { fills: [{ kind: 'color' as const, color: '#123456', opacity: 0.213 }], stroke: { color: '#ABCDEF', width: 0.000001, opacity: 0.213 } };
  const op = compileDesignRow(row, { x: 0.25, y: -0.125 }, { semantics: 'pptx-compat', pptxCompat: supplied }) as DrawShapeOp;
  const expected = designDrawPptx(op), before = structuredClone(op);
  assert.deepEqual(expected, { kind: 'rect', x: Math.round(15.75 * EMU_PER_PX), y: Math.round(-0.625 * EMU_PER_PX), cx: 1, cy: 1,
    rot: 12.345, fill: { solid: '123456', alpha: 0.213 }, line: { color: 'ABCDEF', w: 0, alpha: 0.213 }, radius: -3 * EMU_PER_PX });
  assert.equal(op.opacity, 100, 'paint alpha is already folded, so no second group opacity is applied');
  row.x = '100'; row.radius = 1;
  supplied.fills[0]!.color = '#ff0000'; supplied.stroke.width = 8;
  assert.deepEqual(designDrawPptx(op), expected);
  assert.deepEqual(op, before);
  const shifted = structuredClone(op); shifted.box.x += 1 / EMU_PER_PX;
  assert.notDeepEqual(designDrawPptx(shifted), expected);
  for (const value of [-0, 0, -3, 500]) {
    const rounded = compileDesignRow({ kind: 'box', shape: 'rounded', radius: value, w: 20, h: 10 }, { x: 0, y: 0 }, { semantics: 'pptx-compat', pptxCompat: { fills: [] } }) as DrawShapeOp;
    assert.equal(Object.hasOwn(designDrawPptx(rounded), 'radius'), true);
    assert.equal(designDrawPptx(rounded).radius, Math.round(value * EMU_PER_PX));
  }
  const plain = compileDesignRow({ kind: 'box', radius: 500, w: 20, h: 10 }, { x: 0, y: 0 }, { semantics: 'pptx-compat', pptxCompat: { fills: [] } }) as DrawShapeOp;
  assert.equal(Object.hasOwn(designDrawPptx(plain), 'radius'), false);
  const design = compileDesignRow({ kind: 'box', shape: 'rounded', x: 1.25, w: 20.5, h: 10.75, radius: 50, rot: 12.345, stroke: '#123456', strokeW: 2, flipH: '1' }, { x: 0, y: 0 }) as DrawShapeOp;
  assert.deepEqual(design.box, { x: 1, y: 0, w: 21, h: 11 });
  assert.equal(design.pose!.rot, 12.3);
  assert.equal(design.stroke!.align, 'inside');
  assert.throws(() => designDrawPptx(design), /named native-primitive/);
  assert.throws(() => designDrawPptx({ ...op, compatibility: 'penpot-native-v1' }), /named native-primitive/);
  assert.throws(() => designDrawPptx({ ...op, compatibility: 'lottie-native-v1' }), /named native-primitive/);
});

test('the native primitive policy leaves unsupported rows legacy and refuses malformed operations', () => {
  const row = { kind: 'box', w: 20, h: 10 };
  const options = { semantics: 'pptx-compat' as const, pptxCompat: { fills: [{ kind: 'color' as const, color: '#123456' }] } };
  const unhandled: DesignBoxRowV1[] = [
    { kind: 'text' }, { kind: 'image' }, { kind: 'path' }, { kind: 'frame' }, { kind: 'web' },
    { shape: 'ellipse' }, { shape: 'pill' }, { shape: 'polygon' }, { grad: 'invalid-but-present' }, { clip: 'missing' },
    { text: 'Ordinary box text' }, { pathPaint: '{}' }, { shadow: 'depth' }, { blend: 'multiply' },
    { blur: 0.1 }, { bgBlur: -1 }, { rx: 1 }, { ry: 1 }, { strokeDash: 'dashed' }, { strokeDashArray: '1 2' },
    { headStart: 'triangle' }, { headEnd: 'open' }, { kf: '0:1' }, { enter: 'fade' }, { hold: '1' }, { matchOf: 'another' },
    { start: 0 }, { dur: 0 }, { lane: 'seq' }, { w: 1e308 }, { strokeW: 1e308 },
  ];
  for (const fields of unhandled) {
    const input = { ...row, ...fields };
    assert.equal(isPptxPrimitiveRow(input), false, JSON.stringify(fields));
    assert.throws(() => compileDesignRow(input, { x: 0, y: 0 }, options), /legacy native PPTX producer/);
  }
  assert.equal(isPptxPrimitiveRow({ ...row, flipH: 'yes', hidden: '1', strokeCap: 'round', fillRule: 'evenodd', shadow: 'none', blend: 'normal' }), true);
  assert.throws(() => compileDesignRow(row, { x: 0, y: 0 }, { semantics: 'pptx-compat' }), /resolved paints/);
  assert.throws(() => compileDesignDraw([row], { width: 20, height: 10 }, options), /native PPTX producer owns page selection/);
  const op = compileDesignRow(row, { x: 0, y: 0 }, options) as DrawShapeOp;
  for (const fields of [
    { nativePptx: { rounded: 'true' } }, { nativePptx: {} }, { nativePptx: Object.create({ rounded: true }) },
    { opacity: 50 }, { box: { ...op.box, x: NaN } }, { box: { ...op.box, w: 0 } }, { box: { ...op.box, x: 1e308 } },
    { shape: { kind: 'ellipse' as const } }, { shape: { kind: 'rect' as const, radius: NaN } },
    { pose: { rot: 0, flipH: true, flipV: false } }, { blur: 1 }, { blend: 'multiply' },
    { fills: [{ kind: 'radial' as const, stops: [] }] }, { fills: [...op.fills, ...op.fills] },
    { fills: [{ kind: 'color' as const, color: 'var(--private)' }] }, { fills: [{ kind: 'color' as const, color: '#123456', opacity: 2 }] },
    { stroke: { color: '#123456', width: 1, align: 'inside' as const } },
    { stroke: { color: '#123456', width: 1, dash: [1, 2] as [number, number] } },
    { stroke: { color: '#123456', width: 1, cap: 'round' } },
  ]) assert.throws(() => designDrawPptx({ ...op, ...fields }));
});

test('mixed native decks retain guards, notes, bindings, theme and complete archive parts', async () => {
  const path = makeGeomApi().encodeAuthored([{ kind: 'line', closed: true, nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }] }]);
  assert.ok(path.ok);
  const configured = (trace: string[]): DesignPptxOptsV1 => {
    const out = fixture(trace);
    out.frames[0]!.layers.push(
      { id: 'linear', kind: 'box', w: 80, h: 40, bg: '#ffffff', grad: 'lin.srgb_90_ff000080-0_0000ff-100', stroke: '#112233', strokeW: 2 },
      { id: 'dash', kind: 'box', w: 80, h: 30, bg: '#123456', stroke: '#456789', strokeW: 3, strokeDash: 'dashed' },
      { id: 'path', kind: 'path', path: path.value, w: 30, h: 20, bg: '#abcdef', rot: 20, flipH: '1' },
      { id: 'bad-path', kind: 'path', path: '%invalid', w: 20, h: 20 },
      { id: 'motion', kind: 'box', w: 20, h: 20, bg: '#123456', enter: 'fade' },
      { id: 'shadow', kind: 'box', w: 20, h: 20, shadow: 'depth' },
      { id: 'clip', kind: 'box', w: 20, h: 20, clip: 'ordinary' },
      { id: 'radial', kind: 'box', w: 20, h: 20, grad: 'rad.srgb_ff0000-0_0000ff-100' },
      { id: 'pill', kind: 'box', w: 30, h: 20, shape: 'pill', radius: 50, bg: '#abcdef' },
      { id: 'ellipse', kind: 'box', w: 30, h: 20, shape: 'ellipse', bg: '#abcdef' },
      { id: 'unknown', kind: 'web', w: 30, h: 20, bg: '#123456' },
      { id: 'missing-clip', kind: 'box', w: 20, h: 20, clip: 'not-present', bg: '#112233' },
    );
    return out;
  };
  const oldTrace: string[] = [], newTrace: string[] = [];
  const expected = await legacy(configured(oldTrace)), actual = await designFramesToPptx(configured(newTrace));
  assert.deepEqual(actual, expected); assert.deepEqual(parts(actual), parts(expected)); assert.deepEqual(newTrace, oldTrace);
  assert.ok(actual.notes.some(note => note.includes('dashed outline')));
  assert.ok(actual.notes.some(note => note.includes('animation')));
  assert.ok(actual.notes.some(note => note.includes('clip mask')));
  assert.ok(actual.slides[0]!.shapes.some(shape => shape.kind === 'path'));
  assert.ok(actual.slides[0]!.shapes.some(shape => shape.kind === 'rect' && shape.fill && 'grad' in shape.fill));
});

test('seeded numeric and paint corpus keeps exact native results, source rows and complete parts', async () => {
  let state = 0x295e3;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const weird = [null, '', ' ', '9.75px', '50%', '0x10', '1e2', true, false, Infinity, NaN, -0, 0.0000001, -1, 1e308];
  const rows: DesignBoxRowV1[] = [];
  for (let index = 0; index < 512; index++) {
    rows.push({ id: `native-${index}`, kind: index % 7 ? 'box' : '', shape: ['', 'rect', 'rounded', 'pill', 'ellipse'][index % 5]!,
      x: index % 9 ? random() * 900 - 100 : weird[index % weird.length]!, y: random() * 400 - 50,
      w: index % 7 ? random() * 100 - 3 : weird[index % weird.length]!, h: random() * 70 - 2,
      radius: index % 3 ? random() * 150 - 20 : weird[index % weird.length]!,
      opacity: index % 4 ? random() * 180 - 40 : weird[index % weird.length]!,
      rot: index % 6 ? random() * 800 - 400 : weird[index % weird.length]!, hidden: [true, '1', 'yes', false, '0', 'off'][index % 6]!,
      bg: ['#123456', '#abcdef80', 'transparent', 'none', 'invalid', 'var(--brand-primary, #112233)'][index % 6]!,
      stroke: index % 3 ? '#2468ac80' : '', strokeW: index % 4 ? random() * 15 - 3 : weird[index % weird.length]!,
      flipH: ['1', 'yes', true, '0'][index % 4]!, strokeCap: ['round', 'square', '', 'unknown'][index % 4]!,
      fillRule: index % 2 ? 'evenodd' : '' });
  }
  const before = structuredClone(rows);
  const configured = (subset: DesignBoxRowV1[]): DesignPptxOptsV1 => ({ frames: [{ row: { id: 'corpus', kind: 'frame', x: 20.125, y: -1.75, w: 1280, h: 720 }, layers: subset }] });
  for (const row of rows) {
    assert.deepEqual(await designFramesToPptx(configured([row])), await legacy(configured([row])), String(row.id));
  }
  const expected = await legacy(configured(rows)), actual = await designFramesToPptx(configured(rows));
  assert.deepEqual(actual, expected); assert.deepEqual(parts(actual), parts(expected)); assert.deepEqual(rows, before);
});

test('palette callbacks retain the original early geometry and opacity capture while later radius and rotation remain live', async () => {
  const configured = (trace: string[]): DesignPptxOptsV1 => {
    const out = fixture(trace), original = out.tokens!;
    const row = out.frames[0]!.layers.find(layer => layer.id === 'ordinary')!;
    let hits = 0;
    out.tokens = path => {
      const result = original(path);
      if (path === 'color.semantic.primary' && ++hits === 2) {
        trace.push('mutate:geometry-and-late-style');
        row.x = 5000; row.y = 5000; row.w = 5000; row.h = 5000; row.opacity = 99; row.radius = 2; row.rot = 30;
      }
      return result;
    };
    return out;
  };
  const oldTrace: string[] = [], newTrace: string[] = [];
  const expected = await legacy(configured(oldTrace)), actual = await designFramesToPptx(configured(newTrace));
  assert.deepEqual(actual, expected); assert.deepEqual(parts(actual), parts(expected)); assert.deepEqual(newTrace, oldTrace);
  assert.equal(oldTrace.filter(item => item === 'mutate:geometry-and-late-style').length, 1);
  const shape = actual.slides[0]!.shapes.find(item => item.kind === 'rect' && item.x === Math.round(20.25 * EMU_PER_PX)) as PptxRect;
  assert.ok(shape);
  assert.equal(shape.cx, Math.round(220.5 * EMU_PER_PX));
  assert.equal(shape.radius, 2 * EMU_PER_PX); assert.equal(shape.rot, 30);
  assert.equal(shape.fill && 'solid' in shape.fill ? shape.fill.alpha : undefined, 0.425);
});

test('native paint keeps explicit rounded alpha one, zero and boundary values without a second opacity fold', async () => {
  const rows: DesignBoxRowV1[] = [99.999, 100, 0.0499, 0.05, 42.5, -1, 101].map((opacity, index) => ({
    id: `alpha-${index}`, kind: 'box', x: index * 20, w: 10, h: 10, bg: '#123456', stroke: '#abcdef80', strokeW: 1, opacity,
  }));
  const configured: DesignPptxOptsV1 = { frames: [{ row: { id: 'alpha', kind: 'frame', w: 1280, h: 720 }, layers: rows }] };
  const expected = await legacy(configured), actual = await designFramesToPptx(configured);
  assert.deepEqual(actual, expected); assert.deepEqual(parts(actual), parts(expected));
  const fill = (index: number) => (actual.slides[0]!.shapes[index]! as PptxRect).fill;
  assert.deepEqual(fill(0), { solid: '123456', alpha: 1 });
  assert.deepEqual(fill(1), { solid: '123456' });
  assert.deepEqual(fill(2), { solid: '123456', alpha: 0 });
  assert.deepEqual(fill(3), { solid: '123456', alpha: 0.001 });
  assert.equal((actual.slides[0]!.shapes[4]! as PptxRect).line!.alpha, 0.213);
});

test('the native bridge reads only the row fields it owns rather than enumerating arbitrary source properties', async () => {
  const row: DesignBoxRowV1 = { id: 'bounded', kind: 'box', x: 1.25, y: 2.75, w: 30, h: 20, bg: '#123456', shape: 'rounded', radius: 5 };
  Object.defineProperty(row, 'unrelated', { enumerable: true, get() { throw new Error('Unrelated fields must not be read.'); } });
  const configured: DesignPptxOptsV1 = { frames: [{ row: { id: 'bounded-frame', kind: 'frame', w: 1280, h: 720 }, layers: [row] }] };
  const expected = await legacy(configured), actual = await designFramesToPptx(configured);
  assert.deepEqual(actual, expected); assert.deepEqual(parts(actual), parts(expected));
  const captured = { x: 1.25, y: 2.75, w: 30, h: 20 };
  const op = compileDesignRow(row, { x: 0, y: 0 }, { semantics: 'pptx-compat', pptxCompat: { fills: [], geometry: captured } }) as DrawShapeOp;
  const before = designDrawPptx(op); captured.x = 100;
  assert.deepEqual(designDrawPptx(op), before);
});
