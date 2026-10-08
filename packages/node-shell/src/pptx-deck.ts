// SPDX-License-Identifier: MPL-2.0
/**
 * Authored-deck-model lowering - the PURE, DOM-free half of the tool→native-pptx path.
 *
 * It lives here rather than in the web shell (plan 274 WP 6) so the CLI and the MCP
 * server reach it too: nothing in it touches a document, and a terminal run that can
 * write a native .pptx without launching a browser needs exactly this half.
 * `shells/web/src/bridge/pptx-deck.ts` re-exports it, so every web caller is unchanged.
 *
 * A tool may emit its own deck as inline JSON (a `[data-pptx-deck]` <script>) so it gets
 * NATIVE PowerPoint objects - editable text, real `a:tbl` tables, a brand theme - rather
 * than pictures from the DOM walk. This module lowers that (UNTRUSTED, tool-authored)
 * JSON into the engine's `PptxSlide`/`PptxShape` model: CSS colours → hex, the deck's own
 * px space → EMU, everything coerced defensively so a hostile/typo'd field degrades to a
 * safe default instead of emitting invalid OOXML. Image elements are the ONLY async part
 * (they fetch bytes) and stay in export-pptx.ts; everything here is synchronous and
 * node-testable. The engine (buildPptxParts) frames the OOXML; this never touches a DOM.
 *
 * Contract (the deck model a tool emits) - all positions/sizes in the deck's px space:
 *   { size?:{w,h}, theme?:DeckTheme, layouts?:[DeckLayout], slides:[ { bg?:DeckFill, layout?:number, notes?, elements:[DeckEl] } ] }
 *   DeckEl.t ∈ 'rect' | 'text' | 'table' | 'image'   (image handled by the caller)
 *   A text DeckEl may carry ph:{type,idx} to bind to a layout placeholder.
 *   DeckLayout = { name, bg?:DeckFill, elements?:[DeckEl], placeholders?:[{type,idx?,x,y,w,h,anchor?,style?,prompt?}] }
 *   - the branded layout gallery (engine PptxLayout); slide.layout indexes into it.
 *   colours are CSS strings: '#30BA78', '#3bfa', 'rrggbb', 'rgb(…)', 'rgba(…)'.
 *   ...or a brand token, `var(--brand-surface, #ffffff)`, resolved through an injected
 *   DeckColorResolver (plan 179 A12; see resolveDeckColorValue).
 *
 * EMITTER OBLIGATION (the tool, not this module): when serialising the deck INTO the
 * `<script type="application/json" data-pptx-deck>` node, escape '<' so a deck string value
 * (text, notes, cell text, bullet char, theme name, image src) containing '</script>'
 * can't close the tag and break out into HTML. Use
 *   JSON.stringify(deck).replace(/</g, '\\u003c')
 * This module's reader (parseDeckModel) is safe either way - a truncated model just fails
 * JSON.parse and falls back to the DOM walk - but the un-escaped emit is a stored-XSS /
 * DOM-breakout hole in the tool's OWN render, so it is mandatory on the emit side.
 */
import { EMU_PER_PX, MAX_TABLE_COLS, MAX_TABLE_ROWS } from "../../../engine/src/pptx.ts";
import { parseColorToSrgb8 } from "../../../engine/src/css-color.ts";
import { parseSvgPath } from "../../../engine/src/svg-path.ts";
import { gradientSpecStops, parseGradientSpec } from "../../../engine/src/gradient-spec.ts";
import { colorToHexString } from "../../../engine/src/css-color.ts";
import { SUSE_FONT_DIR } from "./text-svg.ts";
import type { PptxAnim, PptxEffect, PptxFill, PptxPara, PptxRect, PptxRun, PptxShape, PptxSlideTransition, PptxTable, PptxTableCell, PptxLine, PptxPic, PptxTheme, PptxPhType, PptxPlaceholder, PptxLayout } from "../../../engine/src/pptx.ts";

export type DeckBox = { x: number; y: number; cx: number; cy: number };

// ECMA-376 ST_Coordinate bound - an EMU past this is schema-invalid (→ PowerPoint repair),
// so an absurd px value gets clamped rather than emitted. Gradient stops are also capped.
const ST_COORD_MAX = 27273042316900;
const MAX_GRAD_STOPS = 64;

// ── defensive coercion (every field is untrusted tool JSON) ───────────────────
export const asStr = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
export const asFinite = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
export const asBool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
export const emuOf = (v: unknown, d = 0): number => Math.max(-ST_COORD_MAX, Math.min(ST_COORD_MAX, Math.round(asFinite(v, d) * EMU_PER_PX)));
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);

// NaN-safe: a malformed rgb() channel ('.', '1.2.3') parses to NaN, which must never reach
// the hex string as the literal "NAN" (invalid ST_HexColorRGB → repair).
const hex2 = (n: number): string => Math.max(0, Math.min(255, Math.round(Number.isFinite(n) ? n : 0))).toString(16).padStart(2, '0').toUpperCase();

// ── brand tokens in a deck colour (plan 179 A12) ─────────────────────────────
//
// A Design artboard's fill is whatever the canvas paints, and on a branded document
// that is a token: `var(--brand-surface, #ffffff)`. The parser below understands hex
// and rgb() only, so before this every token-valued fill became null and the slide
// exported with NO background rect at all. The fix is not a colour table baked in
// here - the values live in the page's stylesheets - but an injected lookup: the
// shell hands in a resolver reading the live canvas's computed custom properties,
// and a node-side caller hands in a plain map (or nothing, in which case the
// literal fallback inside the var() stands).

/** Look one CSS custom property (`--brand-surface`) up; '' / undefined = not defined. */
export type DeckColorResolver = (name: string) => string | undefined;

/** The line ends a deck path may ask for (the engine's PptxLineEnd). */
const LINE_END_NAMES = ['triangle', 'arrow', 'oval', 'diamond', 'stealth'] as const;

/** Generic CSS families and stack keywords: never a typeface PowerPoint can install. */
const GENERIC_FAMILY = /^(?:serif|sans-serif|monospace|cursive|fantasy|math|emoji|fangsong|system-ui|ui-[\w-]+|-apple-system|blinkmacsystemfont|inherit|initial|unset)$/i;

/** The first concrete family of a CSS font stack, unquoted, or undefined for a stack
 *  of generics only. A pptx run carries ONE typeface name, never a stack. */
export function firstFontFamily(stack: string | undefined): string | undefined {
  for (const part of String(stack ?? '').split(',')) {
    const name = part.trim().replace(/^(['"])(.*)\1$/, '$2').trim();
    if (!name || name.startsWith('var(')) continue;
    if (GENERIC_FAMILY.test(name)) return undefined;
    return name;
  }
  return undefined;
}

/**
 * A run's typeface. A plain name passes through. A `var(--font-x)` reference (how a tool
 * points at its brand's mono or display face without knowing the family) resolves
 * through the exported node's cascade, the same lookup brand colours use, to that
 * stack's first family; a reference that resolves to nothing is left off, so the theme
 * font applies.
 */
export function deckFontName(v: unknown, resolve?: DeckColorResolver): string | undefined {
  const raw = asStr(v)?.trim();
  if (!raw) return undefined;
  if (!/^var\(/i.test(raw)) return raw;
  // The colour path's own var() reader: one linear scan per hop, at most MAX_VAR_HOPS
  // hops, so a nested fallback resolves and a hostile string cannot make it backtrack.
  return firstFontFamily(resolveDeckColorValue(raw, resolve));
}

/**
 * The theme a deck exports with, with the brand's own faces filled in when the tool's
 * deck model gives none. Without this a run with no face of its own (Design's default
 * `sans`) is drawn in PowerPoint's Calibri, because the theme font is the only route
 * from the brand family to such a run. `--font-display` heads the major (heading) font
 * when a brand declares one; both otherwise take `--font-brand`.
 */
export function withBrandFonts(theme: PptxTheme | undefined, resolve?: DeckColorResolver): PptxTheme | undefined {
  if (theme?.fonts?.major && theme.fonts.minor) return theme;
  const brand = firstFontFamily(resolve?.('--font-brand'));
  if (!brand) return theme;
  const display = firstFontFamily(resolve?.('--font-display')) ?? brand;
  return { ...theme, fonts: { major: theme?.fonts?.major ?? display, minor: theme?.fonts?.minor ?? brand } };
}

/** A resolved DTCG `fontFamily` value (a string or an array of names) as a CSS stack;
 *  alias residue (`{font.brand}` that never resolved) and anything else is ''. A name
 *  must be a plain family name, the rule the web shell's `brandFontStack` applies, so a
 *  release's internal 'Lolly Release <sha256>' alias, or any other odd value, is never
 *  written as a PowerPoint face. */
export function tokenFontStack(value: unknown): string {
  const names = (Array.isArray(value) ? value : [value])
    .filter((v): v is string => typeof v === 'string' && !v.trim().startsWith('{'))
    .flatMap((v) => v.split(','))
    .map((v) => v.trim().replace(/^(['"])(.*)\1$/, '$2').trim())
    .filter((v) => FACE_FAMILY_RE.test(v));
  return names.join(', ');
}

/** The fonts a Design deck is lowered with: the theme's major and minor faces, and the
 *  mono face, which a run in the `mono` slot names and the theme never carries. */
export interface DeckBrandFonts { major?: string; minor?: string; mono?: string }

/**
 * The theme fonts a brand's token document names, by the same rule `withBrandFonts`
 * reads off the canvas: `font.display` heads the major font when the brand declares
 * one, `font.brand` fills the rest, and a stack of generics only gives none (a generic
 * family is never written as a PowerPoint face). `font.mono` is returned as `mono` for
 * the runs in that slot. `resolve` answers one `font.<slot>` token, as a host's
 * `tokens.resolve` does; one that throws counts as absent.
 */
export async function tokenBrandFonts(
  resolve: (slot: 'brand' | 'display' | 'mono') => unknown,
): Promise<DeckBrandFonts | undefined> {
  const stack = async (slot: 'brand' | 'display' | 'mono'): Promise<string> => {
    try { return tokenFontStack(await resolve(slot)); } catch { return ''; }
  };
  const vars: Record<string, string> = { '--font-brand': await stack('brand'), '--font-display': await stack('display') };
  const fonts = withBrandFonts(undefined, (name) => vars[name])?.fonts;
  const mono = firstFontFamily(await stack('mono'));
  const out: DeckBrandFonts = {
    ...(fonts?.major && fonts.minor ? { major: fonts.major, minor: fonts.minor } : {}),
    ...(mono ? { mono } : {}),
  };
  return Object.keys(out).length ? out : undefined;
}

// ── weights PowerPoint cannot state (plan 291 decision D3) ───────────────────
//
// A run in PowerPoint is Regular or Bold: `b` is a flag, not a weight. So a Medium 500
// headline written as the family with b=0 opens Regular. The way out is the static
// face's own family name ("SUSE Medium"), which PowerPoint resolves to that file. It is
// named ONLY when the brand pack ships that static file: naming a face nobody has
// installed swaps the brand face for the viewer's fallback, which is worse than Regular.
//
// The lowerings carry the weight on each run (`weight`, beside the engine's own flag),
// and one pass just before buildPptxParts decides the face and strips the field.

/** The suffix each static face file carries, by weight. 400 and 700 are absent:
 *  those are the family itself, the second one with b=1. */
const STATIC_WEIGHT_NAMES: Readonly<Record<number, string>> = {
  100: 'Thin', 200: 'ExtraLight', 300: 'Light', 500: 'Medium',
  600: 'SemiBold', 800: 'ExtraBold', 900: 'Black',
};

/** A family name that can safely become part of a catalog file name. */
const FACE_FAMILY_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$/;

/** A run's weight before the face pass: CSS 100 to 900, in steps of 100. */
export type WeightedRun = PptxRun & { weight?: number };

/** A weight off untrusted JSON, rounded to the nearest 100 within 100 to 900. */
export function deckWeight(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return undefined;
  return Math.max(100, Math.min(900, Math.round(n / 100) * 100));
}

/**
 * The static file a weight of a family would ship as, under the catalog's
 * `/catalog/fonts/ttf/` folder: `SUSE-Medium.ttf`, `SUSEMono-SemiBoldItalic.ttf`. Null
 * for 400 and 700, which keep the family name, and for a family that is not a plain name.
 */
export function staticFaceFile(family: string | undefined, weight: number | undefined, italic?: boolean): string | null {
  const w = deckWeight(weight);
  const name = w === undefined ? undefined : STATIC_WEIGHT_NAMES[w];
  const fam = family?.trim();
  if (!name || !fam || !FACE_FAMILY_RE.test(fam)) return null;
  return `${fam.replace(/ /g, '')}-${name}${italic ? 'Italic' : ''}.ttf`;
}

/**
 * The typeface and bold flag one run should carry in PowerPoint (plan 291 D3).
 *
 * 400 keeps the family; 700 keeps the family with b=1. Any other weight becomes
 * "<Family> <WeightName>" with b=0, but only when `shipped` holds that static file;
 * otherwise the family stays and the bold flag is the old `weight >= 600`. Italic is
 * left to the caller's own flag, which PowerPoint applies to the named face.
 */
export function staticFaceFor(
  family: string | undefined,
  weight: number | undefined,
  italic: boolean | undefined,
  shipped: ReadonlySet<string>,
): { face: string | undefined; bold: boolean } {
  const w = deckWeight(weight) ?? 400;
  const file = staticFaceFile(family, w, italic);
  if (file && shipped.has(file)) return { face: `${family!.trim()} ${STATIC_WEIGHT_NAMES[w]}`, bold: false };
  return { face: family, bold: w >= 600 };
}

/** The catalog folder the static faces ship in, as a site URL: `/catalog/fonts/ttf/`. */
export const STATIC_FACE_DIR = SUSE_FONT_DIR;

/** Does the brand pack ship this static face file? Answered by the shell, which knows where the catalog lives. */
export type ShipsFace = (file: string) => boolean | Promise<boolean>;

/** The parts of a lowered deck the face pass reads: slides and layouts as the engine takes them. */
export interface FaceNamingModel {
  /** `layout` is the 0-based layout index the engine binds the slide to (absent = 0). */
  slides: ReadonlyArray<{ shapes: PptxShape[]; layout?: number }>;
  layouts?: ReadonlyArray<PptxLayout> | null;
}

type WeightedStyle = NonNullable<PptxPlaceholder['style']> & { weight?: number };
type WeightedCell = PptxTableCell & { weight?: number };

/** The theme font a run with no typeface of its own draws in: title text takes the major font. */
const themeFamily = (ph: { type?: PptxPhType } | undefined, fonts?: { major?: string; minor?: string }): string | undefined =>
  (ph?.type === 'title' || ph?.type === 'ctrTitle' ? fonts?.major : fonts?.minor) || undefined;

/**
 * Name the static face of every run whose weight PowerPoint cannot state, in place.
 *
 * `fonts` is the theme's major and minor family, used only to name the family of a run
 * that states none; it is never written anywhere. `ships` is asked once per distinct
 * file. Every `weight` field is removed whether or not a face was named, so a deck whose
 * brand ships no static faces (or a caller with no `ships`) builds exactly the bytes it
 * built before weights were carried.
 */
export async function nameStaticFaces(
  model: FaceNamingModel,
  fonts: { major?: string; minor?: string } | undefined,
  ships?: ShipsFace,
): Promise<void> {
  type Site = { family: string | undefined; weight: number; italic: boolean; apply: (face: { face: string | undefined; bold: boolean }) => void };
  const sites: Site[] = [];

  const visitRun = (run: WeightedRun, fallback: string | undefined): void => {
    const weight = run.weight;
    delete run.weight;
    if (weight === undefined) return;
    sites.push({
      family: run.font ?? fallback, weight, italic: !!run.italic,
      apply: (got) => {
        if (got.face === undefined || got.face === (run.font ?? fallback)) return;
        run.font = got.face;
        if (got.bold) run.bold = true; else delete run.bold;
      },
    });
  };
  const visitParas = (paras: readonly PptxPara[] | undefined, fallback: string | undefined): void => {
    for (const para of paras ?? []) for (const run of para.runs ?? []) visitRun(run as WeightedRun, fallback);
  };
  const visitShapes = (shapes: readonly PptxShape[] | undefined): void => {
    for (const shape of shapes ?? []) {
      if (shape.kind === 'text') visitParas(shape.paras, themeFamily(shape.ph, fonts));
      else if (shape.kind === 'table') {
        for (const row of shape.rows ?? []) {
          for (const cell of (row.cells ?? []) as WeightedCell[]) {
            visitParas(cell.paras, fonts?.minor);
            const weight = cell.weight;
            delete cell.weight;
            if (weight === undefined) continue;
            const family = cell.font ?? fonts?.minor;
            sites.push({
              family, weight, italic: false,
              apply: (got) => {
                if (got.face === undefined || got.face === family) return;
                cell.font = got.face;
                if (got.bold) cell.bold = true; else delete cell.bold;
              },
            });
          }
        }
      }
    }
  };

  for (const slide of model.slides) visitShapes(slide.shapes);
  // A layout placeholder style named as a face, and the family it stated before.
  const renamed = new Map<PptxPlaceholder, string | undefined>();
  for (const layout of model.layouts ?? []) {
    visitShapes(layout.shapes);
    for (const ph of layout.placeholders ?? []) {
      const style = ph.style as WeightedStyle | undefined;
      if (!style) continue;
      const weight = style.weight;
      delete style.weight;
      if (weight === undefined) continue;
      const family = style.font ?? themeFamily(ph, fonts);
      const before = style.font;
      // A placeholder style states no bold flag, so only a named face carries the weight.
      sites.push({
        family, weight, italic: false,
        apply: (got) => {
          if (got.face === undefined || got.face === family) return;
          style.font = got.face;
          renamed.set(ph, before ?? family);
        },
      });
    }
  }

  if (!sites.length) return;
  const files = new Set<string>();
  for (const site of sites) {
    const file = ships ? staticFaceFile(site.family, site.weight, site.italic) : null;
    if (file) files.add(file);
  }
  const shipped = new Set<string>();
  await Promise.all([...files].map(async (file) => {
    try { if (await ships!(file)) shipped.add(file); } catch { /* a probe that fails is a face that is not there */ }
  }));
  for (const site of sites) site.apply(staticFaceFor(site.family, site.weight, site.italic, shipped));
  if (renamed.size) pinInheritedFamilies(model, renamed);
}

/** The layout placeholder a slide placeholder inherits from: by idx, else by type. */
function layoutPlaceholderFor(
  ph: { type: PptxPhType; idx?: number },
  placeholders: readonly PptxPlaceholder[],
): PptxPlaceholder | undefined {
  const titleish = (t: PptxPhType): boolean => t === 'title' || t === 'ctrTitle';
  if (ph.idx !== undefined) {
    const byIdx = placeholders.find((p) => p.idx === ph.idx);
    if (byIdx) return byIdx;
  }
  return placeholders.find((p) => p.idx === undefined && (p.type === ph.type || (titleish(p.type) && titleish(ph.type))));
}

/**
 * Once a layout placeholder style is set to a face ("SUSE Medium"), every slide run bound to
 * it that states no typeface would inherit that face, so a 700 title draws as a faux-bold
 * Medium and a 400 title as Medium. Each such run is given the family the layout stated
 * before, which is the face it drew in before the layout was renamed. A run that was
 * given its own face, or states a typeface already, is left alone.
 */
function pinInheritedFamilies(model: FaceNamingModel, renamed: ReadonlyMap<PptxPlaceholder, string | undefined>): void {
  const layouts = model.layouts ?? [];
  if (!layouts.length) return;
  for (const slide of model.slides) {
    const raw = Number.isFinite(slide.layout) ? Math.round(slide.layout!) : 0;
    const layout = layouts[Math.max(0, Math.min(layouts.length - 1, raw))];
    const placeholders = layout?.placeholders ?? [];
    for (const shape of slide.shapes ?? []) {
      if (shape.kind !== 'text' || !shape.ph) continue;
      const bound = layoutPlaceholderFor(shape.ph, placeholders);
      if (!bound || !renamed.has(bound)) continue;
      const family = renamed.get(bound);
      if (!family) continue;
      for (const para of shape.paras ?? []) {
        for (const run of para.runs ?? []) if (run.font === undefined) run.font = family;
      }
    }
  }
}

// A custom-property name: '--' plus anything that is not whitespace, a paren or a comma.
const CUSTOM_PROP_RE = /^--[^\s(),]+$/;
// `var(--a, var(--b, #fff))` is 2 hops. A token defined as another var() chains; the cap
// is what stops `--a: var(--a)` (or a resolver that lies) from looping forever.
const MAX_VAR_HOPS = 4;

// Split ONE top-level `var(name, fallback)` call, or null when `s` is not exactly that.
// The fallback may itself contain commas and parens - `var(--x, rgb(1, 2, 3))` - so the
// name ends at the FIRST comma and everything after it is the fallback, verbatim.
function varCall(s: string): { name: string; fallback: string } | null {
  if (!/^var\(/i.test(s)) return null;
  let depth = 0, end = -1;
  for (let i = 3; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) { end = i; break; }
  }
  if (end !== s.length - 1) return null;                      // unbalanced, or trailing junk
  const inner = s.slice(4, end);
  const comma = inner.indexOf(',');
  const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
  if (!CUSTOM_PROP_RE.test(name)) return null;
  return { name, fallback: comma < 0 ? '' : inner.slice(comma + 1).trim() };
}

/**
 * A deck colour value with every `var()` resolved to a literal CSS colour string, or ''
 * when it resolves to nothing (an undefined token with no fallback, a self-reference, or
 * a chain deeper than MAX_VAR_HOPS). A plain colour is returned trimmed and untouched, so
 * this is a no-op on every deck that was already literal.
 */
export function resolveDeckColorValue(v: unknown, resolve?: DeckColorResolver): string {
  let s = (typeof v === 'string' ? v : '').trim();
  for (let hop = 0; hop < MAX_VAR_HOPS; hop++) {
    const call = varCall(s);
    if (!call) return s;
    const got = resolve?.(call.name);
    const next = (typeof got === 'string' ? got.trim() : '') || call.fallback;
    if (!next || next === s) return '';
    s = next;
  }
  return '';
}

// A CSS colour string → { hex:'RRGGBB', alpha? } or null (none/transparent/unparseable),
// with `var(--token, fallback)` resolved through `resolve` first.
//
// The BARE hex form ('30ba78', no '#') is handled here because no CSS parser accepts it -
// it is the pptxgenjs convention an authored deck may use. Everything else goes through the
// engine's CSS Color 4 parser, the same one the SVG and PDF walkers use.
//
// That last part is not a widening for its own sake (plan 179 A12): a brand swatch is
// stored in its AUTHORED notation, the brand editor's colour wheel writes `oklch()`, and
// `applyBrandVars` puts that string on the canvas verbatim. So a hand-rolled comma-form
// `rgb()` regex meant the resolver SUCCEEDED and then handed back a literal nothing could
// read - the slide lost its background with the var()'s own '#ffffff' fallback already
// consumed, so it could not even degrade to white. `hsl()`, `color-mix()` and the modern
// space-separated `rgb(48 186 120)` had the same hole.
export function deckColor(v: unknown, resolve?: DeckColorResolver): { hex: string; alpha?: number } | null {
  const s = resolveDeckColorValue(v, resolve);
  if (!s || s === 'transparent') return null;
  const hm = /^#?([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(s);
  if (hm) {
    let h = hm[1]!;
    if (h.length === 3 || h.length === 4) h = h.split('').map(ch => ch + ch).join('');
    const hex = h.slice(0, 6).toUpperCase();
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return a <= 0.01 ? null : { hex, alpha: a < 1 ? a : undefined };
  }
  const c = parseColorToSrgb8(s);            // null for junk AND for fully transparent
  if (!c) return null;
  const a = c[3];
  return a <= 0.01 ? null : { hex: hex2(c[0]) + hex2(c[1]) + hex2(c[2]), alpha: a < 1 ? a : undefined };
}

// ── Design gradient specs (plan 291 M4, W7) ───────────────────────────────────
//
// A Design box's `grad` is a spec string (`lin_90_102030f2-0_10203000-62`, see
// engine/src/gradient-spec.ts). A LINEAR spec lowers to a native gradFill with one alpha
// per stop, which is what a scrim over a photo is. Radial and conic specs have no
// lowering here and stay out of the deck, with their note, in both tiers.

/** The longest grad spec a deck element may carry; a real spec is a few dozen characters. */
const MAX_GRAD_SPEC_CHARS = 4096;

/**
 * Whether a grad spec is a linear gradient, judged on its head the way
 * `parseGradientSpec` reads it (`lin`, `linear`, with any `.space` modifier). Lexical on
 * purpose: the renderer's `deckLinearGrad` makes the same call without the engine, and
 * the two tiers must agree on which rows they let through.
 */
export function isLinearGradSpec(spec: unknown): boolean {
  const s = typeof spec === 'string' ? spec.trim() : '';
  const first = s.split('_').filter((p) => p.length > 0)[0] ?? '';
  const head = first.toLowerCase().split('.')[0];
  return head === 'lin' || head === 'linear';
}

/**
 * A linear grad spec as a native gradient fill, or null when the spec is not linear or
 * cannot be read.
 *
 * Stops are the engine's baked sRGB stops, so an OKLab spec keeps the curve the canvas
 * paints. `opacity` (0..1, the box's own) folds into every stop's alpha. A mirror folds
 * into the angle, because a flipped rectangle is the same rectangle: flipH maps the CSS
 * angle a to 360 - a, flipV to 180 - a, and both to a + 180.
 */
export function gradSpecFill(spec: string, opts: { opacity?: number; flipH?: boolean; flipV?: boolean } = {}): PptxFill | null {
  if (typeof spec !== 'string' || spec.length > MAX_GRAD_SPEC_CHARS) return null;
  const g = parseGradientSpec(spec);
  if (g?.kind !== 'linear') return null;
  const op = typeof opts.opacity === 'number' && Number.isFinite(opts.opacity) ? Math.max(0, Math.min(1, opts.opacity)) : 1;
  const grad = gradientSpecStops(g).map((s) => {
    const hex = colorToHexString({ ...s.color, alpha: 1 }).slice(1, 7).toUpperCase();
    const a = Math.max(0, Math.min(1, (s.color.alpha ?? 1) * op));
    return a < 1 ? { pos: Math.max(0, Math.min(1, s.pos / 100)), color: hex, alpha: a } : { pos: Math.max(0, Math.min(1, s.pos / 100)), color: hex };
  });
  if (grad.length < 2) return null;
  let angle = g.angle;
  if (opts.flipH === true) angle = (360 - angle) % 360;
  if (opts.flipV === true) angle = (540 - angle) % 360;
  return { grad, angle };
}

// A DeckFill - a CSS colour string, { grad:{ stops:[{pos,color}], angle } }, or a Design
// grad spec { gradSpec, flipH?, flipV?, opacity? } (plan 291 M4).
export function deckFill(f: unknown, resolve?: DeckColorResolver): PptxFill | undefined {
  if (typeof f === 'string') { const c = deckColor(f, resolve); return c ? { solid: c.hex, alpha: c.alpha } : undefined; }
  const gs = f && typeof f === 'object' ? f as { gradSpec?: unknown; flipH?: unknown; flipV?: unknown; opacity?: unknown } : null;
  if (gs && typeof gs.gradSpec === 'string') {
    return gradSpecFill(gs.gradSpec, { opacity: asFinite(gs.opacity, 1), flipH: gs.flipH === true, flipV: gs.flipV === true }) ?? undefined;
  }
  const g = (f as { grad?: { stops?: unknown; angle?: unknown } } | null)?.grad;
  if (!g) return undefined;
  const stops = (Array.isArray(g.stops) ? g.stops : []).slice(0, MAX_GRAD_STOPS);
  const grad = stops.flatMap((s: { pos?: unknown; color?: unknown }) => {
    const c = deckColor(s?.color, resolve);
    return c ? [{ pos: Math.max(0, Math.min(1, asFinite(s?.pos))), color: c.hex, alpha: c.alpha }] : [];
  });
  return grad.length >= 2 ? { grad, angle: asFinite(g.angle, 180) } : undefined;
}

const deckLine = (l: unknown, resolve?: DeckColorResolver): PptxLine | undefined => {
  const c = deckColor((l as { color?: unknown } | null)?.color, resolve);
  return c ? { color: c.hex, w: Math.max(0, emuOf((l as { w?: unknown }).w, 1)) } : undefined;
};

/** A rect's outline, keeping the alpha its colour states (a translucent box folds its opacity into it). */
const deckRectLine = (l: unknown, resolve?: DeckColorResolver): PptxRect['line'] => {
  const c = deckColor((l as { color?: unknown } | null)?.color, resolve);
  if (!c) return undefined;
  const line: NonNullable<PptxRect['line']> = { color: c.hex, w: Math.max(0, emuOf((l as { w?: unknown }).w, 1)) };
  if (c.alpha !== undefined) line.alpha = c.alpha;
  return line;
};

/** A run's opacity: its colour's own alpha times the `alpha` a translucent text box folds into it. */
function runAlpha(colour: { alpha?: number } | null, alpha: unknown): number | undefined {
  const a = (colour?.alpha ?? 1) * (typeof alpha === 'number' && Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1);
  return a < 1 ? Math.round(a * 1000) / 1000 : undefined;
}

export function deckRun(r: Record<string, unknown>, resolve?: DeckColorResolver): PptxRun {
  const colour = deckColor(r?.color, resolve);
  const run: PptxRun = {
    text: asStr(r?.text) ?? '', sizePt: asFinite(r?.sizePt, 12),
    color: colour?.hex, bold: asBool(r?.bold), italic: asBool(r?.italic),
    underline: asBool(r?.underline), strike: asBool(r?.strike), font: deckFontName(r?.font, resolve),
  };
  const alpha = runAlpha(colour, r?.alpha);
  if (alpha !== undefined) run.alpha = alpha;
  // Carried for nameStaticFaces, which removes it again before the engine sees the run.
  const weight = deckWeight(r?.weight);
  if (weight !== undefined) (run as WeightedRun).weight = weight;
  return run;
}

// NB every `.map(deckX)` below is written as an arrow: passing the lowering function
// itself would hand Array#map's INDEX in as `resolve`, which is not a function to call.
export function deckPara(p: Record<string, unknown>, resolve?: DeckColorResolver): PptxPara {
  const para: PptxPara = { runs: Array.isArray(p?.runs) ? p.runs.map((r: Record<string, unknown>) => deckRun(r, resolve)) : [] };
  const align = oneOf(p?.align, ['l', 'ctr', 'r', 'just'] as const); if (align) para.align = align;
  if (typeof p?.level === 'number' && Number.isFinite(p.level)) para.level = p.level;
  const b = p?.bullet;
  if (b === true || b === false || b === 'number') para.bullet = b;
  else if (b && typeof b === 'object' && typeof (b as { char?: unknown }).char === 'string') para.bullet = { char: (b as { char: string }).char };
  const bc = deckColor(p?.bulletColor, resolve); if (bc) para.bulletColor = bc.hex;
  for (const k of ['lineSpacingPct', 'lineSpacingPt', 'spaceBeforePt', 'spaceAfterPt'] as const)
    if (typeof p?.[k] === 'number' && Number.isFinite(p[k])) para[k] = p[k] as number;
  return para;
}

function deckCell(c: Record<string, unknown>, resolve?: DeckColorResolver): PptxTableCell {
  const cell: PptxTableCell = {};
  if (Array.isArray(c?.paras)) cell.paras = c.paras.map((p: Record<string, unknown>) => deckPara(p, resolve));
  else { const t = asStr(c?.text); if (t != null) cell.text = t; }
  cell.fill = deckColor(c?.fill, resolve)?.hex;
  cell.color = deckColor(c?.color, resolve)?.hex;
  const align = oneOf(c?.align, ['l', 'ctr', 'r', 'just'] as const); if (align) cell.align = align;
  const anchor = oneOf(c?.anchor, ['t', 'ctr', 'b'] as const); if (anchor) cell.anchor = anchor;
  if (typeof c?.colSpan === 'number') cell.colSpan = c.colSpan;
  if (typeof c?.rowSpan === 'number') cell.rowSpan = c.rowSpan;
  if (typeof c?.bold === 'boolean') cell.bold = c.bold;
  const weight = deckWeight(c?.weight); if (weight !== undefined) (cell as WeightedCell).weight = weight;
  if (typeof c?.sizePt === 'number') cell.sizePt = c.sizePt;
  const font = deckFontName(c?.font, resolve); if (font) cell.font = font;
  if (typeof c?.margin === 'number') cell.margin = emuOf(c.margin);
  const bs = c?.borders as Record<string, unknown> | undefined;
  if (bs && typeof bs === 'object') {
    const b: NonNullable<PptxTableCell['borders']> = {};
    for (const side of ['l', 'r', 't', 'b'] as const) { const ln = deckLine(bs[side], resolve); if (ln) b[side] = ln; }
    if (Object.keys(b).length) cell.borders = b;
  }
  return cell;
}

export const deckSrcRect = (s: unknown): PptxPic['srcRect'] => {
  if (!s || typeof s !== 'object') return undefined;
  const o = s as Record<string, unknown>;
  const f = (k: string) => Math.max(0, Math.min(0.99, asFinite(o[k])));
  const l = f('l'), t = f('t'), r = f('r'), b = f('b');
  return l || t || r || b ? { l, t, r, b } : undefined;
};

export const deckBox = (el: Record<string, unknown>): DeckBox => ({
  x: emuOf(el?.x), y: emuOf(el?.y), cx: Math.max(1, emuOf(el?.w, 1)), cy: Math.max(1, emuOf(el?.h, 1)),
});

// ── pictures placed the way Design's canvas places them (plan 291 M3, shared in M4) ──
//
// Both tiers read the same keys off a Design row or off the renderer's image element:
// `fit`, `imgpos`, `imageFraming {x, y, zoom}`, `flipH`, `flipV`, `name`. So Tier A
// (design-pptx.ts, rows) and Tier B (export-pptx.ts, deck elements) crop, letterbox and
// mirror a picture alike.

/** A source crop, as fractions 0..1 cut off each edge. */
export type PptxSrcRect = { l: number; t: number; r: number; b: number };

/** The object-fit values the Design renderer accepts (`FITS` in design-renderer.js). */
export const PICTURE_FITS = ['cover', 'contain', 'fill', 'none', 'scale-down'] as const;
export type PictureFit = typeof PICTURE_FITS[number];

/**
 * A picture's own size: `w` and `h` give its aspect, and `natural` says whether they
 * are also a size in CSS pixels (a raster's pixels, or an SVG's absolute width and
 * height). An SVG with only a viewBox has an aspect and no size.
 */
export interface DeckIntrinsicSize { w: number; h: number; natural: boolean }

/**
 * A picture's place on the slide: the shape's box, the part of the picture cut off
 * each edge, and the size the whole picture is drawn at before any cut.
 */
export interface DeckPicturePlacement {
  box: { x: number; y: number; cx: number; cy: number };
  srcRect: PptxSrcRect | null;
  drawn: { cx: number; cy: number };
}

/** A boolean as Design's `boolVal` reads one: true, 1, '1', 'true', 'yes' or 'on'. */
function truthy(v: unknown): boolean {
  if (v === true || v === 1) return true;
  if (typeof v !== 'string') return false;
  const t = v.toLowerCase();
  return t === '1' || t === 'true' || t === 'yes' || t === 'on';
}

/** CSS pixels per unit for the absolute lengths an SVG root's width and height can carry. */
const SVG_UNIT_PX: Record<string, number> = { '': 1, px: 1, pt: 4 / 3, pc: 16, in: 96, cm: 96 / 2.54, mm: 96 / 25.4 };

/**
 * An SVG's intrinsic size, read the way an `<img>` reads one: absolute width and
 * height first, then the viewBox for the aspect. Unrounded, because a wordmark's
 * viewBox (210.179 by 37.666) loses a percent of its aspect when rounded to pixels.
 */
export function deckSvgIntrinsicSize(bytes: Uint8Array): DeckIntrinsicSize | null {
  const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 8192)));
  const tag = /<svg\b([^>]*)>/i.exec(head);
  if (!tag) return null;
  const attr = (name: string): string | undefined => {
    const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag[1]!);
    return m ? (m[1] ?? m[2]) : undefined;
  };
  const length = (value: string | undefined): number => {
    const m = /^\s*([0-9]*\.?[0-9]+(?:e[+-]?\d+)?)\s*(px|pt|pc|in|cm|mm)?\s*$/i.exec(value ?? '');
    if (!m) return 0;
    const n = parseFloat(m[1]!) * (SVG_UNIT_PX[(m[2] ?? '').toLowerCase()] ?? 0);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const vb = (attr('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  const vbW = vb.length === 4 && Number.isFinite(vb[2]) && vb[2]! > 0 ? vb[2]! : 0;
  const vbH = vb.length === 4 && Number.isFinite(vb[3]) && vb[3]! > 0 ? vb[3]! : 0;
  const w = length(attr('width'));
  const h = length(attr('height'));
  if (w && h) return { w, h, natural: true };
  if (w && vbW && vbH) return { w, h: (w * vbH) / vbW, natural: true };
  if (h && vbW && vbH) return { w: (h * vbW) / vbH, h, natural: true };
  if (vbW && vbH) return { w: vbW, h: vbH, natural: false };
  return null;
}

/** A position keyword (`left top`, `center`) or `x% y%` as fractions, read the way CSS object-position reads a value. */
function positionFractions(value: string): [number, number] {
  let fx = 0.5;
  let fy = 0.5;
  const pct: number[] = [];
  for (const tok of value.trim().toLowerCase().split(/\s+/).slice(0, 2)) {
    if (tok === 'left') fx = 0;
    else if (tok === 'right') fx = 1;
    else if (tok === 'top') fy = 0;
    else if (tok === 'bottom') fy = 1;
    else if (tok.endsWith('%') && Number.isFinite(parseFloat(tok))) pct.push(parseFloat(tok) / 100);
  }
  if (pct.length === 1) fx = pct[0]!;
  else if (pct.length === 2) [fx, fy] = [pct[0]!, pct[1]!];
  return [Math.min(1, Math.max(0, fx)), Math.min(1, Math.max(0, fy))];
}

/** A picture's anchor in its box (`imgpos`, or a framing's x and y) and its zoom, as the canvas reads them. */
export function deckPictureAnchor(row: Record<string, unknown>): { fx: number; fy: number; zoom: number } {
  const framing = row.imageFraming && typeof row.imageFraming === 'object'
    ? row.imageFraming as { x?: unknown; y?: unknown; zoom?: unknown }
    : null;
  const pctOf = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) / 100 : 0.5;
  };
  const [fx, fy] = framing
    ? [pctOf(framing.x ?? 50), pctOf(framing.y ?? 50)]
    : positionFractions(typeof row.imgpos === 'string' ? row.imgpos : '');
  const zoomRaw = framing ? Number(framing.zoom ?? 100) : 100;
  return { fx, fy, zoom: Math.max(1, Number.isFinite(zoomRaw) ? zoomRaw : 100) / 100 };
}

/**
 * The source crop that shows a `fit: cover` picture the way the canvas does, as
 * fractions cut off each edge, or null when nothing is cut.
 *
 * The canvas draws `object-fit: cover` placed by `imgpos` (or by a framing's x and y),
 * then scales a framing's zoom about that same point (`imgCss` in the Design renderer).
 * PowerPoint keeps the whole picture in the file and crops only the view, so the
 * person can still re-crop it there. `box` and `pixels` need only share their own units.
 */
export function deckCoverSrcRect(
  row: Record<string, unknown>,
  box: { w: number; h: number },
  pixels: { width: number; height: number },
): PptxSrcRect | null {
  if (!(pixels.width > 0 && pixels.height > 0 && box.w > 0 && box.h > 0)) return null;
  const { fx, fy, zoom } = deckPictureAnchor(row);

  const imgA = pixels.width / pixels.height;
  const boxA = box.w / box.h;
  // The part of the picture the cover fit shows, on each axis, before any zoom.
  let l = 0;
  let r = 0;
  let t = 0;
  let b = 0;
  if (Math.abs(imgA - boxA) >= 1e-3) {
    if (imgA > boxA) {
      const crop = 1 - boxA / imgA;
      l = crop * fx;
      r = crop * (1 - fx);
    } else {
      const crop = 1 - imgA / boxA;
      t = crop * fy;
      b = crop * (1 - fy);
    }
  }
  if (zoom > 1) {
    // A scale about the point (fx, fy) of the box shows the box span from
    // f * (1 - 1/zoom) to that plus 1/zoom, within the window the fit left.
    const narrow = (lo: number, hi: number, f: number): [number, number] => {
      const span = 1 - lo - hi;
      const start = f * (1 - 1 / zoom);
      return [lo + start * span, hi + (1 - start - 1 / zoom) * span];
    };
    [l, r] = narrow(l, r, fx);
    [t, b] = narrow(t, b, fy);
  }
  const tidy = (v: number): number => (Math.abs(v) < 1e-9 ? 0 : v);
  [l, r, t, b] = [tidy(l), tidy(r), tidy(t), tidy(b)];
  return l || r || t || b ? { l, t, r, b } : null;
}

/**
 * A picture placed the way the canvas places it for every fit but cover: `contain`
 * letterboxes it at its own aspect, `none` draws it at its own pixel size,
 * `scale-down` takes the smaller of those two, and `fill` stretches it over the box.
 * `imgpos` (or a framing's x and y) places it in the space left over, a framing's zoom
 * scales it about that same point, and the box clips what overflows. The shape shrinks
 * to the visible part and a source crop cuts the rest. `box` is in EMU.
 */
export function deckFittedPlacement(
  row: Record<string, unknown>,
  box: { x: number; y: number; cx: number; cy: number },
  intrinsic: DeckIntrinsicSize,
  fit: Exclude<PictureFit, 'cover'>,
): DeckPicturePlacement {
  const { fx, fy, zoom } = deckPictureAnchor(row);
  let dw = box.cx;
  let dh = box.cy;
  if (fit !== 'fill') {
    const containScale = Math.min(box.cx / intrinsic.w, box.cy / intrinsic.h);
    // An SVG with no size of its own has nothing to draw at in `none`, so it fits.
    const scale = !intrinsic.natural || fit === 'contain'
      ? containScale
      : fit === 'none' ? EMU_PER_PX : Math.min(containScale, EMU_PER_PX);
    dw = intrinsic.w * scale;
    dh = intrinsic.h * scale;
  }
  // object-position puts the given fraction of the leftover space before the picture,
  // and the zoom scales about the same point of the box.
  let x0 = (box.cx - dw) * fx;
  let y0 = (box.cy - dh) * fy;
  if (zoom > 1) {
    const px = box.cx * fx;
    const py = box.cy * fy;
    x0 = px + (x0 - px) * zoom;
    y0 = py + (y0 - py) * zoom;
    dw *= zoom;
    dh *= zoom;
  }
  const vx0 = Math.max(0, x0);
  const vy0 = Math.max(0, y0);
  const vx1 = Math.min(box.cx, x0 + dw);
  const vy1 = Math.min(box.cy, y0 + dh);
  if (!(vx1 > vx0 && vy1 > vy0 && dw > 0 && dh > 0)) return { box, srcRect: null, drawn: { cx: box.cx, cy: box.cy } };
  const tidy = (v: number): number => (Math.abs(v) < 1e-9 ? 0 : v);
  const l = tidy((vx0 - x0) / dw);
  const r = tidy((x0 + dw - vx1) / dw);
  const t = tidy((vy0 - y0) / dh);
  const b = tidy((y0 + dh - vy1) / dh);
  const left = Math.round(vx0);
  const top = Math.round(vy0);
  return {
    box: {
      x: box.x + left,
      y: box.y + top,
      cx: Math.max(1, Math.round(vx1) - left),
      cy: Math.max(1, Math.round(vy1) - top),
    },
    srcRect: l || r || t || b ? { l, t, r, b } : null,
    drawn: { cx: dw, cy: dh },
  };
}

/**
 * A picture placed for its fit, then mirrored inside its own box when the row is
 * flipped. The canvas flips the whole box (a negative scale about its centre), so a
 * letterboxed picture anchored left shows on the right of a mirrored box; the slide
 * shape, which PowerPoint flips in place, has to move there itself. A cover picture
 * fills its box and does not move. The crop needs no swap: DrawingML applies srcRect
 * in source space before the flip, as CSS applies object-fit before the scale.
 * `intrinsic` null (a size that could not be read) places it over the whole box.
 */
export function deckPlacePicture(
  row: Record<string, unknown>,
  box: { x: number; y: number; cx: number; cy: number },
  intrinsic: DeckIntrinsicSize | null,
  fit: PictureFit,
): DeckPicturePlacement {
  let placed: DeckPicturePlacement = { box, srcRect: null, drawn: { cx: box.cx, cy: box.cy } };
  if (intrinsic) {
    if (fit === 'cover') {
      // The whole picture is drawn at its own aspect, scaled up to cover the box and then
      // by the framing zoom, so a raster drawn at this size (an SVG's PNG fallback) takes
      // the same source crop as the vector instead of being letterboxed and cut again.
      const { zoom } = deckPictureAnchor(row);
      const cover = intrinsic.w > 0 && intrinsic.h > 0 ? Math.max(box.cx / intrinsic.w, box.cy / intrinsic.h) : 0;
      const drawn = cover > 0
        ? { cx: intrinsic.w * cover * zoom, cy: intrinsic.h * cover * zoom }
        : { cx: box.cx, cy: box.cy };
      placed = { box, srcRect: deckCoverSrcRect(row, { w: box.cx, h: box.cy }, { width: intrinsic.w, height: intrinsic.h }), drawn };
    } else {
      placed = deckFittedPlacement(row, box, intrinsic, fit);
    }
  }
  const fh = truthy(row.flipH);
  const fv = truthy(row.flipV);
  if (!fh && !fv) return placed;
  const b = { ...placed.box };
  if (fh) b.x = 2 * box.x + box.cx - placed.box.x - placed.box.cx;
  if (fv) b.y = 2 * box.y + box.cy - placed.box.y - placed.box.cy;
  return { ...placed, box: b };
}

/**
 * The look a picture carries onto its slide shape: its layer name, its mirrors and its
 * opacity (0..1, as alphaModFix), each set only when stated, so a plain picture lowers
 * exactly as it did. Reads a Design row (`opacity` 0..100) or a deck element (`alpha`).
 */
export function deckPicLook(el: Record<string, unknown>): Pick<PptxPic, 'name' | 'flipH' | 'flipV' | 'alpha'> {
  const out: Pick<PptxPic, 'name' | 'flipH' | 'flipV' | 'alpha'> = {};
  const name = typeof el.name === 'string' ? el.name.trim().slice(0, 255) : '';
  if (name) out.name = name;
  if (truthy(el.flipH)) out.flipH = true;
  if (truthy(el.flipV)) out.flipV = true;
  const raw = typeof el.alpha === 'number' ? el.alpha
    : (el.opacity !== undefined && el.opacity !== null && el.opacity !== '' ? Number(el.opacity) / 100 : 1);
  if (Number.isFinite(raw) && raw < 1) out.alpha = Math.round(Math.max(0, raw) * 1000) / 1000;
  return out;
}

/**
 * The raster an SVG picture has to travel as, or null when it can travel as a vector.
 *
 * A brand photo treatment arrives as an SVG wrapper whose embedded photo is drawn
 * through a `<filter>` (`wrapRasterWithTreatment`). PowerPoint's own SVG renderer is not
 * known to honour feColorMatrix or feComponentTransfer, so an svgBlip would show the
 * photo ungraded in one viewer and graded in another. Such a picture is baked to one
 * raster at its own size (the longest side capped at `maxPx`): JPEG when the photo
 * inside is a JPEG, PNG otherwise, and the slide carries no svg part for the picture.
 */
export function deckSvgBakeRaster(bytes: Uint8Array, maxPx = 4096): { w: number; h: number; mime: 'image/jpeg' | 'image/png' } | null {
  const text = new TextDecoder().decode(bytes);
  if (!/<filter\b/i.test(text) || !/<image\b[^>]*\bfilter\s*=/i.test(text)) return null;
  const size = deckSvgIntrinsicSize(bytes);
  if (!size) return null;
  const scale = Math.min(1, maxPx / Math.max(size.w, size.h, 1));
  const mime = /<image\b[^>]*\bhref\s*=\s*["']data:image\/jpe?g[;,]/i.test(text) ? 'image/jpeg' as const : 'image/png' as const;
  return { w: Math.max(1, Math.round(size.w * scale)), h: Math.max(1, Math.round(size.h * scale)), mime };
}

// A placeholder binding on a deck text element: { type, idx? }. Whitelisted types only
// (the engine drops unknowns too; filtering here keeps the model honest at the boundary).
const DECK_PH_TYPES = ['title', 'ctrTitle', 'subTitle', 'body', 'sldNum'] as const;
export function deckPh(v: unknown): { type: PptxPhType; idx?: number } | undefined {
  const type = oneOf((v as { type?: unknown } | null)?.type, DECK_PH_TYPES);
  if (!type) return undefined;
  const idx = (v as { idx?: unknown }).idx;
  return typeof idx === 'number' && Number.isFinite(idx) && idx >= 0 ? { type, idx: Math.round(idx) } : { type };
}

// One layout placeholder: binding + a px-space box + role text style + prompt.
export function deckPlaceholder(p: unknown, resolve?: DeckColorResolver): PptxPlaceholder | null {
  if (!p || typeof p !== 'object') return null;
  const el = p as Record<string, unknown>;
  const bind = deckPh(el);
  if (!bind) return null;
  const st = el.style as Record<string, unknown> | undefined;
  const out: PptxPlaceholder = { ...bind, ...deckBox(el) };
  const anchor = oneOf(el.anchor, ['t', 'ctr', 'b'] as const); if (anchor) out.anchor = anchor;
  const prompt = asStr(el.prompt); if (prompt) out.prompt = prompt;
  if (st && typeof st === 'object') {
    const style: NonNullable<PptxPlaceholder['style']> = {};
    const font = deckFontName(st.font, resolve); if (font) style.font = font;
    if (typeof st.sizePt === 'number' && Number.isFinite(st.sizePt)) style.sizePt = st.sizePt;
    style.color = deckColor(st.color, resolve)?.hex;
    const align = oneOf(st.align, ['l', 'ctr', 'r'] as const); if (align) style.align = align;
    const bullet = asBool(st.bullet); if (bullet != null) style.bullet = bullet;
    const weight = deckWeight(st.weight); if (weight !== undefined) (style as WeightedStyle).weight = weight;
    out.style = style;
  }
  return out;
}

// ── native animation (plans/175 WP-E) ─────────────────────────────────────────
//
// Maps Lolly's animation vocabulary (the design tool's enter/exit kinds + split
// text fields, carried raw on a deck element's `anim`) onto the engine's SUPPORTED
// OOXML subset. Everything Lolly can say that PowerPoint cannot degrades to the
// nearest listed preset with a note pushed into `notes` - one logged substitution
// line, never a silent difference, never a refusal of the export.

const ANIM_KIND_MAP: Record<string, { preset: PptxEffect['preset']; dir?: PptxEffect['dir']; note?: string }> = {
  fade: { preset: 'fade' },
  pop: { preset: 'zoom', note: 'pop → Zoom' },
  grow: { preset: 'zoom', note: 'grow → Zoom' },
  rise: { preset: 'fly', dir: 'b', note: 'rise → Fly In from bottom' },
  drop: { preset: 'fly', dir: 't', note: 'drop → Fly In from top' },
  'slide-left': { preset: 'fly', dir: 'r' },
  'slide-right': { preset: 'fly', dir: 'l' },
  'slide-up': { preset: 'fly', dir: 'b' },
  'slide-down': { preset: 'fly', dir: 't' },
  'zoom-in': { preset: 'zoom' },
  'zoom-out': { preset: 'zoomOut' },
  tilt: { preset: 'fly', dir: 'b', note: 'tilt → Fly In from bottom' },
  swoop: { preset: 'fly', dir: 'r', note: 'swoop → Fly In from right' },
  spin: { preset: 'zoom', note: 'spin → Zoom' },
  drift: { preset: 'fade', note: 'drift → Fade' },
};

// Named easing → (accel, decel) in 1000ths of a percent of the duration. The default -
// unauthored, or a custom bezier PPTX cannot carry - is the ease-out every kind was
// born with (lib/transitions.ts easeOutCubic).
const EASE_TO_ACCEL: Record<string, readonly [number, number]> = {
  linear: [0, 0],
  'ease-out': [0, 80000],
  'ease-in': [80000, 0],
  'ease-in-out': [50000, 50000],
  smooth: [50000, 50000],
  snappy: [30000, 10000],
  overshoot: [0, 60000],
  anticipate: [30000, 30000],
};
const DEFAULT_EASE: readonly [number, number] = [0, 80000];

const finiteMs = (v: unknown, lo: number, hi: number, d: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : d;
  return Math.max(lo, Math.min(hi, Math.round(n)));
};

/**
 * The two things a lowering can have to say about an effect it could not carry across.
 *
 *   • `mapped` - it exports, as a DIFFERENT PowerPoint effect (a swoop becomes Fly In).
 *     The slide still moves the way the author meant, near enough. Logged at info.
 *   • `dropped` - PowerPoint has no form for it at all, so the shape sits still. That is
 *     a difference the author can see, so it is logged at warn.
 *
 * A caller that wants one flat list may keep passing a plain `string[]`, and BOTH kinds
 * append to it. That is how this parameter was first written and it stays supported, so
 * a caller who only wants "name everything you changed" writes no more code than before.
 */
export interface DeckNotes { mapped: string[]; dropped: string[] }
export type DeckNoteSink = string[] | DeckNotes;

/**
 * One deck element's `anim` (untrusted tool JSON, Lolly vocabulary) → the engine's
 * PptxAnim, or undefined when nothing animates. Degrades are pushed into `notes`.
 */
export function deckAnim(v: unknown, notes?: DeckNoteSink): PptxAnim | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const a = v as Record<string, unknown>;
  const into = (list: string[] | undefined, s: string): void => { if (list && !list.includes(s)) list.push(s); };
  const note = (s: string): void => into(Array.isArray(notes) ? notes : notes?.mapped, s);
  const drop = (s: string): void => into(Array.isArray(notes) ? notes : notes?.dropped, s);

  // Split text: letter/word ride OOXML's own iterate; line has no per-line iterate on
  // a single-paragraph text box (our deck text is one paragraph by construction).
  let by: 'letter' | 'word' | '' = a.split === 'letter' || a.split === 'word' ? a.split : '';
  if (a.split === 'line') { by = 'word'; drop('split by line → by word (PPTX iterates letters or words)'); }
  const order = typeof a.order === 'string' ? a.order : '';
  if (order === 'center' || order === 'random') note(`text order ${order} → first-to-last (no OOXML form)`);
  // The hold/loop bucket (plans/175 WP-B) has no OOXML form at all - the shape
  // exports still, and the export log says why it is not moving.
  if (typeof a.hold === 'string' && a.hold) drop(`hold effect ${a.hold} → not exported (no PowerPoint form)`);
  // Three more the deck model carries ONLY so the export can say they were left behind
  // (plans/179 M4): a keyframe track, a morph match key, and the frame's own state
  // token. None of them has an OOXML form, and none of them changes a shape here - they
  // are read for the log and nothing else.
  if (a.kf) drop('a keyframe track → not exported (PowerPoint animates presets, not per-property keyframes)');
  if (a.matchOf) drop('a morph match key → not exported (matching boxes are only tweened live in present mode)');
  if (a.state) drop('a frame state → not exported (state tokens drive Custom CSS, which PowerPoint does not read)');
  const iterate: PptxEffect['iterate'] = by
    ? { by, staggerMs: finiteMs(a.stagger, 1, 2000, 60), ...(order === 'reverse' ? { backwards: true } : {}) }
    : undefined;

  const click = finiteMs(a.click, 0, 999, 0);

  const effect = (kindRaw: unknown, msRaw: unknown, easeRaw: unknown, delayRaw: unknown, entering: boolean): PptxEffect | undefined => {
    const kind = typeof kindRaw === 'string' ? kindRaw : '';
    let mapped = Object.hasOwn(ANIM_KIND_MAP, kind) ? ANIM_KIND_MAP[kind] : undefined;
    if (!mapped) {
      // 'none' (the Cut) is an effect worth exporting only when something needs a
      // trigger to hang off: split units (the typewriter) or a click build (a
      // fragment must Appear on its click). A bare cut with neither is no animation.
      if (!entering || (!iterate && click < 1)) return undefined;
      if (kind !== '' && kind !== 'none') return undefined; // junk kind - not an effect
      mapped = { preset: 'appear' };
    }
    if (mapped.note) note(mapped.note);
    const ease = typeof easeRaw === 'string' && Object.hasOwn(EASE_TO_ACCEL, easeRaw)
      ? EASE_TO_ACCEL[easeRaw] as readonly [number, number] : DEFAULT_EASE;
    const fx: PptxEffect = {
      preset: mapped.preset,
      ms: finiteMs(msRaw, 100, 3000, 400),
      delayMs: finiteMs(delayRaw, 0, 600_000, 0),
    };
    if (mapped.dir) fx.dir = mapped.dir;
    if (iterate) fx.iterate = iterate;
    if (mapped.preset !== 'appear') {
      if (ease[0] > 0) fx.accel = ease[0];
      if (ease[1] > 0) fx.decel = ease[1];
    }
    return fx;
  };

  const enter = effect(a.enter, a.enterMs, a.enterEase, a.delayMs, true);
  // Exits are exported ONLY with a derived delay (the hook computes one from a timed
  // box's own end). An exit firing at t=0 would hide content the moment it appeared.
  let exit: PptxEffect | undefined;
  if (a.exitDelayMs != null && typeof a.exitDelayMs === 'number' && Number.isFinite(a.exitDelayMs)) {
    exit = effect(a.exit, a.exitMs, a.exitEase, a.exitDelayMs, false);
  } else if (typeof a.exit === 'string' && a.exit && a.exit !== 'none') {
    note('exit without timing → not exported (needs a timed box)');
  }

  if (!enter && !exit) return undefined;
  const out: PptxAnim = {};
  if (enter) out.enter = enter;
  if (exit) out.exit = exit;
  if (click > 0) out.click = click;
  return out;
}

/**
 * A deck slide's `transition` (the Lolly vocabulary, already resolved against the
 * document's own by the emitter) → the engine's slide transition, or undefined for a
 * slide that simply cuts.
 *
 * Two of the five map exactly. `fade` is PowerPoint's Fade. `slide` is Push, and 'l' is
 * the direction that reads the same way Lolly's does: the new slide arrives from the
 * right and everything moves leftwards.
 *
 * `morph` and `flight` do not exist here, so they fall back to a fade and Report it. This
 * writer emits no PowerPoint Morph: a real Morph needs matched shape ids across two
 * slides, which the deck model has no way to declare, and a wrong match animates the
 * wrong object rather than failing visibly. A flight is a camera move over the canvas
 * with no PowerPoint form at all.
 *
 * `custom` returns undefined: it means the frame's own timeline enter/exit are the
 * truth, and a slide-level transition cannot express a per-box timeline. The emitter
 * already resolves both '' and 'custom' to the document's transition before this is
 * called, so reaching here with either is a deck written by some other tool.
 */
export function deckTransition(v: unknown, notes?: DeckNoteSink): PptxSlideTransition | undefined {
  const drop = (s: string): void => {
    const list = Array.isArray(notes) ? notes : notes?.dropped;
    if (list && !list.includes(s)) list.push(s);
  };
  switch (typeof v === 'string' ? v : '') {
    case 'fade': return { kind: 'fade' };
    case 'slide': return { kind: 'push', dir: 'l' };
    case 'morph':
      drop('the Morph transition → a fade (a PowerPoint Morph needs matched shape ids the deck cannot declare)');
      return { kind: 'fade' };
    case 'flight':
      drop('Fly between artboards → a fade (the camera move over the canvas has no PowerPoint form)');
      return { kind: 'fade' };
    default: return undefined;   // 'none' (a cut), 'custom', '' and anything unknown
  }
}

/**
 * The whole deck's slide transitions, one per slide, in slide order.
 *
 * THE INDEX SHIFT, the one place this can go wrong. A Lolly slide's `transition` says
 * how it changes INTO the next one; a PowerPoint slide's transition says how the
 * deck arrives ON it. Same move, named from either end - so slide k plays what slide
 * k-1 authored, and slide 0, having no predecessor, never gets one.
 */
export function deckSlideTransitions(
  slides: ReadonlyArray<Record<string, unknown>> | null | undefined,
  notes?: DeckNoteSink,
): Array<PptxSlideTransition | undefined> {
  const arr = Array.isArray(slides) ? slides : [];
  return arr.map((_, k) => (k === 0 ? undefined : deckTransition(arr[k - 1]?.transition, notes)));
}

/** The longest outline a deck path element may state, the SVG tokenizer's own ceiling. */
export const MAX_DECK_PATH_CHARS = 400_000;

/**
 * A path element (plan 275 decision 32) to native custom geometry. The tool states its
 * outline as SVG path data in the element's own px box; the points move to EMU here, and
 * the fill and line keep the alpha the tool folded the element's opacity into.
 */
function deckPathShape(el: Record<string, unknown>, box: ReturnType<typeof deckBox>, resolve?: DeckColorResolver): PptxShape | null {
  const d = asStr(el.d);
  if (!d || d.length > MAX_DECK_PATH_CHARS) return null;
  const n = (v: number): string => String(Math.round(v * EMU_PER_PX));
  let scaled = '';
  for (const sub of parseSvgPath(d)) {
    for (const seg of sub.segments) {
      scaled += seg.op === 'C'
        ? `C${n(seg.x1)} ${n(seg.y1)} ${n(seg.x2)} ${n(seg.y2)} ${n(seg.x)} ${n(seg.y)}`
        : `${seg.op}${n(seg.x)} ${n(seg.y)}`;
    }
    if (sub.closed) scaled += 'Z';
  }
  if (!scaled) return null;
  const fill = deckFill(el.fill, resolve);
  const lineIn = el.line as { color?: unknown; w?: unknown; head?: unknown; tail?: unknown } | undefined;
  const lc = deckColor(lineIn?.color, resolve);
  const head = oneOf(lineIn?.head, LINE_END_NAMES);
  const tail = oneOf(lineIn?.tail, LINE_END_NAMES);
  return {
    kind: 'path', ...box, paths: [{ d: scaled }],
    ...(fill ? { fill } : {}),
    ...(lc ? { line: { color: lc.hex, w: Math.max(0, Math.round(asFinite(lineIn?.w, 1) * EMU_PER_PX)), ...(lc.alpha !== undefined ? { alpha: lc.alpha } : {}), ...(head ? { head } : {}), ...(tail ? { tail } : {}) } } : {}),
  };
}

// The synchronous shapes (rect / text / table / path). Returns null for 'image' (the
// caller resolves those async) and for any unknown/malformed element. `animNotes`, when
// given, collects the animation mapping's degrade notes (plans/175 WP-E).
export function deckSyncShape(el: Record<string, unknown>, animNotes?: DeckNoteSink, resolve?: DeckColorResolver): PptxShape | null {
  if (!el || typeof el !== 'object') return null;
  const box = deckBox(el);
  const anim = deckAnim(el.anim, animNotes);
  const withAnim = <T extends PptxShape>(s: T): T => (anim ? { ...s, anim } : s);
  // A rect, a text box and a path turn about their centre by the `rot` (degrees) a tool
  // states on them, as the canvas draws them (plan 275 decision 32).
  const rot = typeof el.rot === 'number' && Number.isFinite(el.rot) && el.rot !== 0 ? { rot: el.rot } : {};
  // A dashed outline is drawn solid: the writer has no dash, and the export notes name it.
  const dash = (el.line as { dash?: unknown } | null | undefined)?.dash;
  if ((dash === 'dashed' || dash === 'dotted') && animNotes) {
    const list = Array.isArray(animNotes) ? animNotes : animNotes.dropped;
    const note = 'a dashed outline → drawn solid (PowerPoint shapes here carry solid lines)';
    if (!list.includes(note)) list.push(note);
  }
  switch (el.t) {
    case 'rect':
      return withAnim({ kind: 'rect', ...box, ...rot, fill: deckFill(el.fill, resolve), line: deckRectLine(el.line, resolve), radius: el.radius != null ? emuOf(el.radius) : undefined, ...(el.geom === 'ellipse' ? { geom: 'ellipse' as const } : {}) });
    case 'text':
      return withAnim({ kind: 'text', ...box, ...rot, anchor: oneOf(el.anchor, ['t', 'ctr', 'b'] as const), paras: (Array.isArray(el.paras) ? el.paras : []).map((p: Record<string, unknown>) => deckPara(p, resolve)), ph: deckPh(el.ph) });
    case 'table': {
      // Cap rows/cols at the engine's own limits (the engine slices too, but doing it
      // here avoids building a huge intermediate - a 5000×200 table is 1e6 cell objects).
      const cols = (Array.isArray(el.cols) ? el.cols : []).slice(0, MAX_TABLE_COLS).map((w: unknown) => emuOf(w, 100));
      const rows = (Array.isArray(el.rows) ? el.rows : []).slice(0, MAX_TABLE_ROWS).map((row: Record<string, unknown>) => ({
        h: row?.h != null ? emuOf(row.h) : undefined,
        cells: (Array.isArray(row?.cells) ? row.cells : []).slice(0, MAX_TABLE_COLS).map((c: Record<string, unknown>) => deckCell(c, resolve)),
      }));
      return withAnim({ kind: 'table', ...box, cols, rows, firstRow: asBool(el.firstRow) } as PptxTable);
    }
    case 'path': {
      const path = deckPathShape(el, box, resolve);
      return path ? withAnim({ ...path, ...rot }) : null;
    }
    default:
      return null; // 'image' → caller; unknown → dropped
  }
}

export function deckTheme(t: unknown, resolve?: DeckColorResolver): PptxTheme | undefined {
  if (!t || typeof t !== 'object') return undefined;
  const src = t as Record<string, unknown>;
  const out: PptxTheme = {};
  const name = asStr(src.name); if (name) out.name = name;
  const cIn = src.colors as Record<string, unknown> | undefined;
  if (cIn && typeof cIn === 'object') {
    const colors: NonNullable<PptxTheme['colors']> = {};
    for (const k of ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'] as const) {
      const c = deckColor(cIn[k], resolve); if (c) colors[k] = c.hex;
    }
    if (Object.keys(colors).length) out.colors = colors;
  }
  const fIn = src.fonts as Record<string, unknown> | undefined;
  if (fIn && typeof fIn === 'object') {
    const fonts: NonNullable<PptxTheme['fonts']> = {};
    const major = asStr(fIn.major); if (major) fonts.major = major;
    const minor = asStr(fIn.minor); if (minor) fonts.minor = minor;
    if (Object.keys(fonts).length) out.fonts = fonts;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * A slide's speaker note (plan 179 P1): plain text, trimmed, or undefined when there is
 * none. A pptx notesSlide is a TEXT body, so the value travels VERBATIM - no escaping,
 * no markup - and a blank note must stay undefined: the engine emits the notesSlide /
 * notesMaster parts only for slides carrying a non-blank note, so a deck without notes
 * is byte-for-byte the deck it was before notes existed.
 */
export const deckNotes = (v: unknown): string | undefined => asStr(v)?.trim() || undefined;

/* ── per-slide narration (plans/180 M-C) ─────────────────────────────────────── */

/**
 * Which sound container a slide's narration clip is in.
 *
 * The bytes are sniffed FIRST and the URL only as a fallback, because a narration clip is
 * normally a `blob:` URL with no extension at all - and because the container decides the
 * `[Content_Types]` Default the engine writes, so guessing it from a name PowerPoint
 * would then contradict is how a deck ends up in the repair dialog.
 *
 * Only the three the writer supports (`PptxAudio['ext']`). Anything else answers null and
 * the slide simply carries no audio - a deck that plays nothing beats a deck that repairs.
 */
export function deckAudioExt(bytes: Uint8Array | null | undefined, src?: unknown): 'wav' | 'mp3' | 'm4a' | null {
  const b = bytes;
  if (b && b.length >= 12) {
    // RIFF....WAVE
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
      && b[8] === 0x57 && b[9] === 0x41 && b[10] === 0x56 && b[11] === 0x45) return 'wav';
    // ....ftyp - an ISO base media file: M4A, and what an AAC export produces.
    if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'm4a';
    // ID3 tag, or a bare MPEG audio frame sync (0xFF 0xEx/0xFx).
    if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'mp3';
    if (b[0] === 0xff && (b[1]! & 0xe0) === 0xe0) return 'mp3';
  }
  const s = asStr(src) ?? '';
  const ext = (/\.([a-z0-9]+)(?:[?#]|$)/i.exec(s)?.[1] ?? '').toLowerCase();
  if (ext === 'wav' || ext === 'wave') return 'wav';
  if (ext === 'mp3') return 'mp3';
  if (ext === 'm4a' || ext === 'mp4' || ext === 'aac') return 'm4a';
  return null;
}

/** A slide's narration marker as the page renders it: the clip's URL and, when the
 *  source's own length is known, its duration in ms. */
export interface DeckNarrationMark { src: string; durationMs: number }

/**
 * The narration clip on one rendered slide, from the audio markers inside it.
 *
 * The contract is the `narration:<frameId>` group (plans/180 section 2), but the group
 * VALUE is model state and never reaches the markup: the Design hook stamps
 * `data-narration="1"` instead, on the marker, and `speaksOnItsSlide` in present-mode.ts
 * reads exactly that. Reading a `data-audio-group` attribute nothing writes left this
 * function taking the first ungrouped marker in DOM order - and since a narration clip is
 * appended LAST, a sound effect dropped on the same slide won, was embedded as the
 * slide's narration and the actual voice was dropped from the file.
 *
 * So: the flag wins. Failing that, a single audio marker that opted into present audio is
 * still accepted (a hand-authored deck with one sound per slide and no narrate run), but
 * two unflagged sounds on one page are not guessed between - a slide is left silent
 * rather than labelled `isNarration` over the wrong clip.
 *
 * Elements are read through a tiny structural interface rather than lib.dom's `Element`,
 * so this stays in the DOM-free half and the suite can hand it plain objects.
 */
export interface DeckMarkEl {
  getAttribute(name: string): string | null;
  /** Optional, so a plain test object stays legal. Used to read the two marks off the
   *  `.lolly-box` wrapper as well, exactly as present-mode.ts does. */
  closest?(selectors: string): DeckMarkEl | null;
}

/** Is this marker (or its box wrapper) flagged with `attr`? */
function markFlag(m: DeckMarkEl, attr: string): boolean {
  let box: DeckMarkEl | null = null;
  try { box = m.closest?.('.lolly-box') ?? null; } catch { box = null; }
  for (const el of [m, box]) {
    const v = el?.getAttribute?.(attr);
    if (v != null && v !== '' && v !== '0' && v !== 'false') return true;
  }
  return false;
}

export function deckNarrationMark(marks: readonly DeckMarkEl[]): DeckNarrationMark | null {
  const audible: DeckNarrationMark[] = [];
  for (const m of marks) {
    const src = (m?.getAttribute?.('data-audio-src') ?? '').trim();
    if (!src) continue;
    const durRaw = Number(m.getAttribute('data-audio-dur'));
    const durationMs = Number.isFinite(durRaw) && durRaw > 0 ? Math.round(durRaw) : 0;
    if (markFlag(m, 'data-narration')) return { src, durationMs };
    const group = (m.getAttribute('data-audio-group') ?? '').trim();
    if (group.startsWith('narration:')) return { src, durationMs };
    if (!group && markFlag(m, 'data-present-audio')) audible.push({ src, durationMs });
  }
  return audible.length === 1 ? audible[0]! : null;
}

// Parse + validate a deck-model JSON string. Returns null (→ DOM-walk fallback) when the
// string is blank, not JSON, or lacks a non-empty `slides` array.
export function parseDeckModel(raw: string | null | undefined): Record<string, unknown> | null {
  const s = raw?.trim();
  if (!s) return null;
  try {
    const m = JSON.parse(s) as Record<string, unknown>;
    return m && typeof m === 'object' && Array.isArray(m.slides) && m.slides.length ? m : null;
  } catch { return null; }
}
