// SPDX-License-Identifier: MPL-2.0
/**
 * Authored-deck-model lowering - the PURE, DOM-free half of the tool→native-pptx path.
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
import { EMU_PER_PX, MAX_TABLE_COLS, MAX_TABLE_ROWS } from "../../../../engine/src/pptx.ts";
import { parseColorToSrgb8 } from "../../../../engine/src/css-color.ts";
import type { PptxAnim, PptxEffect, PptxFill, PptxPara, PptxRun, PptxShape, PptxSlideTransition, PptxTable, PptxTableCell, PptxLine, PptxPic, PptxTheme, PptxPhType, PptxPlaceholder } from "../../../../engine/src/pptx.ts";

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

// A DeckFill - a CSS colour string OR { grad:{ stops:[{pos,color}], angle } }.
export function deckFill(f: unknown, resolve?: DeckColorResolver): PptxFill | undefined {
  if (typeof f === 'string') { const c = deckColor(f, resolve); return c ? { solid: c.hex, alpha: c.alpha } : undefined; }
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

export function deckRun(r: Record<string, unknown>, resolve?: DeckColorResolver): PptxRun {
  return {
    text: asStr(r?.text) ?? '', sizePt: asFinite(r?.sizePt, 12),
    color: deckColor(r?.color, resolve)?.hex, bold: asBool(r?.bold), italic: asBool(r?.italic),
    underline: asBool(r?.underline), strike: asBool(r?.strike), font: asStr(r?.font),
  };
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
  for (const k of ['lineSpacingPct', 'spaceBeforePt', 'spaceAfterPt'] as const)
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
  if (typeof c?.sizePt === 'number') cell.sizePt = c.sizePt;
  const font = asStr(c?.font); if (font) cell.font = font;
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
    const font = asStr(st.font); if (font) style.font = font;
    if (typeof st.sizePt === 'number' && Number.isFinite(st.sizePt)) style.sizePt = st.sizePt;
    style.color = deckColor(st.color, resolve)?.hex;
    const align = oneOf(st.align, ['l', 'ctr', 'r'] as const); if (align) style.align = align;
    const bullet = asBool(st.bullet); if (bullet != null) style.bullet = bullet;
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
    let mapped = Object.prototype.hasOwnProperty.call(ANIM_KIND_MAP, kind) ? ANIM_KIND_MAP[kind] : undefined;
    if (!mapped) {
      // 'none' (the Cut) is an effect worth exporting only when something needs a
      // trigger to hang off: split units (the typewriter) or a click build (a
      // fragment must Appear on its click). A bare cut with neither is no animation.
      if (!entering || (!iterate && click < 1)) return undefined;
      if (kind !== '' && kind !== 'none') return undefined; // junk kind - not an effect
      mapped = { preset: 'appear' };
    }
    if (mapped.note) note(mapped.note);
    const ease = typeof easeRaw === 'string' && Object.prototype.hasOwnProperty.call(EASE_TO_ACCEL, easeRaw)
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
  const exit = a.exitDelayMs != null && typeof a.exitDelayMs === 'number' && Number.isFinite(a.exitDelayMs)
    ? effect(a.exit, a.exitMs, a.exitEase, a.exitDelayMs, false)
    : (typeof a.exit === 'string' && a.exit && a.exit !== 'none'
      ? (note('exit without timing → not exported (needs a timed box)'), undefined)
      : undefined);

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
 * `morph` and `flight` do not exist here, so they fall back to a fade and SAY so. This
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

// The synchronous shapes (rect / text / table). Returns null for 'image' (the caller
// resolves those async) and for any unknown/malformed element. `animNotes`, when
// given, collects the animation mapping's degrade notes (plans/175 WP-E).
export function deckSyncShape(el: Record<string, unknown>, animNotes?: DeckNoteSink, resolve?: DeckColorResolver): PptxShape | null {
  if (!el || typeof el !== 'object') return null;
  const box = deckBox(el);
  const anim = deckAnim(el.anim, animNotes);
  const withAnim = <T extends PptxShape>(s: T): T => (anim ? { ...s, anim } : s);
  switch (el.t) {
    case 'rect':
      return withAnim({ kind: 'rect', ...box, fill: deckFill(el.fill, resolve), line: deckLine(el.line, resolve), radius: el.radius != null ? emuOf(el.radius) : undefined });
    case 'text':
      return withAnim({ kind: 'text', ...box, anchor: oneOf(el.anchor, ['t', 'ctr', 'b'] as const), paras: (Array.isArray(el.paras) ? el.paras : []).map((p: Record<string, unknown>) => deckPara(p, resolve)), ph: deckPh(el.ph) });
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
