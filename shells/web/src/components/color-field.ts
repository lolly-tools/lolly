// SPDX-License-Identifier: MPL-2.0
/**
 * Shared colour picker - the ONE colour field used across the app.
 *
 * Renders the palette swatches + value entry + alpha + native picker + current
 * swatch, and wires their behaviour. Both the single-tool sidebar (views/tool.ts)
 * and the /pro batch grid use this, so there is a single implementation to
 * maintain (no per-view variations).
 *
 * Markup styling lives in styles/parts/color-field.css (`.color-picker-field`,
 * `.color-popover`, `.color-swatch`, `.color-trigger`, …) - global, so it applies
 * wherever this markup is mounted.
 *
 *   colorFieldHtml(id, value, { float, modes, dials })   → HTML string for one field
 *   wireColorField(scopeEl, { onChange, onInteractStart, onInteractEnd })
 *
 * `float` makes the popover position itself (fixed) anchored to the trigger and
 * close on outside-click - for hosts where the field sits inside a clipping /
 * scrolling container (the /pro grid). Every popover is viewport-bounded;
 * block-colour fields keep their sidebar-spanning width.
 *
 * ── ONE CssColor per field ───────────────────────────────────────────────────
 * A field's truth is a single `CssColor` in `STATE`, in the space it was authored
 * in. Everything on screen is a projection of it, and every space is DATA (see
 * color-spaces.ts) rather than a hand-written state machine. What that replaced:
 * an sRGB-hex spine - `genFromHex`/`genToHex` round-tripped every HSL/RGB/CMYK
 * drag through `#rrggbb`, which is precisely why a wide-gamut or perceptual space
 * could not exist here. A `color(display-p3 1 0 0)` handed to the picker came back
 * as `#ff0b0c`, so Colour Lab reported every colour as sRGB.
 *
 * What is EMITTED is unchanged: `onChange(id, value)`'s `value` is still a
 * lowercase `#rrggbb` / `#rrggbbaa` / `'transparent'` (or `{ref, value}` for a
 * token swatch). The canonical colour rides along in an additive third argument,
 * `detail`, so consumers upgrade one at a time. Widening the emitted string would
 * corrupt data today: `engine/src/url-mode.ts` prefixes a non-`#` colour param
 * with `'#'` on every compact-URL round trip, and three consumers silently
 * DISCARD a non-hex rather than erroring.
 *
 * Exactly one function emits - `emit()` - and it is called only from a pointer /
 * keyboard / `input` / click handler. Never from `selectMode`, `onSelect`, any
 * `seed*` or any `paint*`. A mount-time emit is the bug that made every Colour Lab
 * colour read "sRGB", and jsdom never fires `input`, so the only guard against
 * reintroducing it is the zero-calls-after-wiring test in color-field.test.ts.
 */
import { deltaEOk, parseColor, formatColor, convertColor, colorToHexString, BEYOND_TIER } from '@lolly/engine';
import type { CssColor } from '@lolly/engine';
import { PALETTE } from '../palette.ts';
import { contrastText } from '../brand-vars.ts';
import { escape } from '../utils.ts';
import { t } from '../i18n.ts';
import { icon } from '../lib/icons.ts';
import { nameColor } from '../lib/color-namer.ts';

// The attribute selectors below quote a channel or mode id. Browsers expose
// CSS.escape for that; jsdom (the test host for every view that mounts a colour
// field) has no CSS global at all, and the wire-time panel seed reaches these
// lines on every mount - so the fallback escapes the same way for identifiers.
const cssEscape = (value: string): string =>
  (typeof CSS !== 'undefined' && typeof CSS.escape === 'function')
    ? CSS.escape(value)
    : value.replace(/[^\w-]/g, ch => `\\${ch}`);
import { wireTabs } from '../lib/tabs.ts';
import {
  colorSpaces, getColorSpace, composeColor, decomposeColor, channelRuns, pinValue,
  spaceText, spaceParse, spaceExactness, spaceInGamut, spaceInkCoverage, limitLabel,
  notationHasAlpha, hueOf, slugMode, DEFAULT_COLOR_MODE,
} from './color-spaces.ts';
import type { ChannelSpec, ChannelRun, ColorMode, ColorModeFamily, SpaceSpec } from './color-spaces.ts';

export type { ColorMode, ColorModeFamily, ChannelSpec, SpaceSpec } from './color-spaces.ts';

/** One swatch as the picker renders it (see SWATCHES below). */
export interface ColorSwatchOption {
  value: string;
  label?: string | null;
  group?: string | null;
  /** canonical token reference ('{color.brand.jungle}') - null for plain colours */
  ref?: string | null;
}

/** What onChange receives: a plain colour string, or a token-linked value. */
export type ColorFieldValue = string | { ref: string; value: string };

/**
 * The additive second half of a change: the colour the user actually authored.
 *
 * `value` (onChange's first payload) is a gamut-mapped sRGB hex and always will
 * be - that is the contract 23 call sites and the compact-URL format depend on.
 * `css` / `color` are the unflattened truth, for a host that wants to persist it.
 * `baked` says whether the two differ, so a consumer never has to guess.
 */
export interface ColorChangeDetail {
  /** `formatColor(canonical)` - 'oklch(64.857% 0.29949 28.96)', 'color(display-p3 1 0 0)'. */
  css: string;
  /** The canonical colour. Treat as frozen; it is cloned on the way out. */
  color: CssColor;
  /** The space the user was editing in. */
  mode: ColorMode;
  /** True when `value` is a gamut-mapped approximation of `color`. */
  baked: boolean;
  ref: string | null;
}

export interface WireColorFieldOpts {
  onChange?(id: string, value: ColorFieldValue, detail: ColorChangeDetail): void;
  onInteractStart?(): void;
  onInteractEnd?(): void;
}

// The swatch source the picker renders. Defaults to the built-in brand palette
// (so the picker works before - and without - tokens), and is replaced at runtime
// by setSwatches() with swatches resolved from design tokens. Shape per swatch:
//   { value: '#rrggbb' | 'transparent', label, group, ref|null }
// `ref` is the canonical token reference ('{color.brand.jungle}'); choosing such a
// swatch stores a token value so the colour stays linked to the token.
let SWATCHES: ColorSwatchOption[] = PALETTE.map(s => ({ value: s.hex, label: s.label, group: s.group ?? null, ref: null }));

/** Replace the picker's swatches (e.g. with tokens). Ignored if empty/invalid. */
export function setSwatches(list: ColorSwatchOption[]): void {
  if (Array.isArray(list) && list.length) SWATCHES = list;
}

/**
 * Repopulate the already-visible swatch grids under `scope` from the current
 * SWATCHES - call after setSwatches() when the brand palette changed so open
 * pickers (the dashboard/start inline primary) reflect added/deleted swatches
 * live. Closed popovers rebuild lazily on next open, so only touch grids that
 * are already built (or belong to an always-open inline field). Clicks are
 * delegated to the persistent box, so no re-wiring is needed here.
 */
export function refreshSwatches(scope: HTMLElement): void {
  scope.querySelectorAll<HTMLElement>('[data-color-field]').forEach(field => {
    // No box = an inline field (they carry no palette) or one whose popover has
    // never been opened; either way there's nothing built to refresh.
    const box = field.querySelector<HTMLElement>('.color-swatches');
    if (box && box.childElementCount) box.innerHTML = swatchButtonsHtml(field.dataset.colorField!);
  });
}

// A colour value may be a token value object ({ ref, value }); the field UI works
// in plain colour strings, so coerce to the (cached) colour for display.
function toHex(value: unknown): string {
  const o = value as { ref?: unknown; value?: unknown };
  return ((value && typeof value === 'object' && typeof o.ref === 'string') ? (o.value ?? '') : value) as string;
}

/** `#abc` → `#aabbcc`, `#rrggbbaa` → `#rrggbb`, everything else lowercased as-is.
 *  Alpha is ignored when naming: a 40%-opacity Pine is still Pine. */
function nameKey(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  if (/^#[0-9a-f]{8}$/.test(v)) return v.slice(0, 7);
  return v;
}

/**
 * The name a colour is announced and labelled by.
 *
 * A value that IS a palette swatch takes that swatch's own name ("Persimmon 3"),
 * matched on the RGB channels against the active swatch list (the brand palette, or
 * tokens once setSwatches() has run). The FIRST matching swatch wins, so a hex shared
 * by several ramps takes its primary name (e.g. #0c322c → "Pine", not "Jungle 1").
 *
 * Anything else is named PERCEPTUALLY - nearest hue anchor by circular OKLCH distance,
 * with a lightness/chroma qualifier (`lib/color-namer.ts`) - rather than left blank or,
 * worse, given the label of a swatch it merely sits next to in a list. That second
 * failure is what plan 179 A17 reported: a pink `#ffa3e9` announced as "aqua". Naming
 * by distance in a perceptual space is the only lookup that cannot do that, and the hue
 * wheel is walked circularly, so a hue at 359° is named by the anchor at 8° and not by
 * whatever happens to be numerically closest.
 *
 * Returns '' for `transparent` and for anything that is not a hex (a `var()` token, a
 * mid-paste fragment): a name we cannot compute is better absent than guessed.
 */
export function swatchName(value: unknown): string {
  const raw = toHex(value);
  if (typeof raw !== 'string' || !raw) return '';
  const v = nameKey(raw);
  for (const s of SWATCHES) {
    const sv = typeof s.value === 'string' ? nameKey(s.value) : '';
    if (sv && sv === v) return s.label || '';
  }
  if (!/^#[0-9a-f]{6}$/.test(v)) return '';
  return nameColor(v);
}

/**
 * The perceptually nearest swatch to a custom colour (ΔEOK over the active
 * swatch list, alpha ignored) - the "snap back to the brand" hint. Returns the
 * winning swatch + its distance; the caller decides whether the distance is
 * close enough to be worth showing. Transparent and non-hex swatch values
 * (token aliases mid-resolve) are skipped.
 */
function nearestSwatch(value: string): { value: string; ref: string | null; label: string; d: number } | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(raw)) return null;
  const rgb = raw.slice(0, 7);
  let best: ColorSwatchOption | null = null;
  let bestD = Infinity;
  for (const s of SWATCHES) {
    const sv = typeof s.value === 'string' ? s.value : '';
    if (!/^#[0-9a-f]{6}$/i.test(sv)) continue;
    const d = deltaEOk(rgb, sv);
    if (Number.isFinite(d) && d < bestD) { bestD = d; best = s; }
  }
  return best ? { value: best.value, ref: best.ref ?? null, label: best.label || best.value, d: bestD } : null;
}

// ── var() colour values (plan 179 A2) ─────────────────────────────────────────
//
// A tool may store a colour as a design-token reference - `var(--brand-primary,
// #0b1220)` - and the picker has no way to guess what that paints. Seeded raw, the
// swatch went BLACK (parseColor refuses the string, so the field fell back to its
// neutral seed), the sliders showed the seed's own blue, and the text field showed
// the `var(` string itself. All three were lies about a pink artboard.
//
// So the host RESOLVES the reference before seeding: `var(--x)` is read off a real
// element's computed style (the cascade is the only thing that knows what a token
// paints right now), falling back to the literal fallback the author wrote, and only
// then to the raw string. The MODEL is untouched - resolution is a read for display,
// and the stored `var()` survives until the user picks a different colour.

/** `var(--x)` / `var(--x, fallback)` split into its two halves, or null. */
export function parseColorVar(raw: unknown): { name: string; fallback: string } | null {
  const s = typeof raw === 'string' ? raw.trim() : '';
  const m = /^var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,([\s\S]*))?\)$/.exec(s);
  return m ? { name: m[1]!, fallback: (m[2] ?? '').trim() } : null;
}

/** One custom property off `scope`'s computed style (the document element when no
 *  scope is given). Never throws: a detached node, a display:none host or a test
 *  environment with no layout engine is a "don't know", not a crash. */
function readCustomProp(name: string, scope?: Element | null): string {
  try {
    const el = scope ?? (typeof document !== 'undefined' ? document.documentElement : null);
    if (!el || typeof getComputedStyle !== 'function') return '';
    return (getComputedStyle(el).getPropertyValue(name) || '').trim();
  } catch { return ''; }
}

/** Longest `var()` chain resolved - `var(--a, var(--b, var(--c, #fff)))` and stop. */
const VAR_HOPS = 4;

/**
 * A colour value as it should be SHOWN: a `var()` resolved through the cascade at
 * `scope`, else its literal fallback, else the raw string unchanged. Anything that is
 * not a `var()` comes back untouched, so this is safe to wrap every seed in.
 */
export function resolveColorVar(raw: unknown, scope?: Element | null): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  let cur = s;
  for (let hop = 0; hop < VAR_HOPS; hop++) {
    const v = parseColorVar(cur);
    if (!v) return cur;                       // a plain colour (or the fallback we hopped to)
    const got = readCustomProp(v.name, scope);
    if (got) return got;
    if (!v.fallback) return s;                // unresolvable and no fallback: say what is stored
    cur = v.fallback;
  }
  return s;
}

/** Brand tokens wear a prefix; anything else is a private variable with no public name. */
const BRAND_VAR = /^--(?:brand|lolly)-/;

/**
 * The human name of a brand token used as a colour: `var(--brand-primary)` → "Primary",
 * `var(--brand-on-primary, #fff)` → "On Primary". '' for a non-token `var()` and for
 * every ordinary colour - the caller then falls back to `swatchName`.
 */
export function colorVarLabel(raw: unknown): string {
  const v = parseColorVar(raw);
  if (!v || !BRAND_VAR.test(v.name)) return '';
  return v.name.replace(BRAND_VAR, '').split('-').filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// A colour value is only interpolated into an inline `style="…"` attribute after
// passing this shape test: a bare hex, a colour function (rgb()/hsl()/oklch()/…)
// whose arguments contain no nested parens/quotes/semicolons/braces, or a plain
// ident ('rebeccapurple', 'transparent'). Swatch values can come from a
// user-IMPORTED tokens document (setSwatches ← host.tokens.colors(), fed by the
// #/start wizard), and escape() doesn't neutralise CSS metacharacters - so a
// malicious $value like `#000; background-image:url(https://evil.example/x)`
// would otherwise smuggle a live declaration into the attribute and fire an
// external request. The engine's colour parser is the primary gate upstream; this
// is the defense-in-depth at the sink.
const SAFE_CSS_COLOR = /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([^();"'{}<>\\]*\)|[a-z][a-z0-9-]*)$/i;

/** `v` when it's a safely inlinable CSS colour, else '' (paints nothing). */
function safeCssColor(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  return SAFE_CSS_COLOR.test(s) ? s : '';
}

// ── One field's state ────────────────────────────────────────────────────────

interface FieldColorState {
  /** 'transparent' is NOT expressible as a CssColor - the engine's parseColor maps
   *  it to opaque-black-at-alpha-0, which loses the sentinel. Any code path that
   *  reads `color` without checking `kind` resurrects the black-transparent bug. */
  kind: 'color' | 'transparent';
  /** Authored space + components + alpha (0–1). The ONE truth. */
  color: CssColor;
  /** Active tab. */
  mode: ColorMode;
  /** Hue memory, degrees. ONE number shared by every space that has a hue: it is
   *  written from whichever hue slider moved last (so it is in that space's
   *  degrees) and read only when a conversion reports the hue POWERLESS, i.e. for
   *  a grey - where any hue is as good as any other. */
  lastHue: number;
  /** Token ref from the last swatch pick, cleared by any manual edit. */
  ref: string | null;
}

const STATE = new WeakMap<HTMLElement, FieldColorState>();

/** One space panel's DISPLAY values. Held per panel rather than re-derived from
 *  the colour, so a lossy space stays stable while dragging: CMYK↔RGB is
 *  many-to-one on K, and re-decomposing mid-drag would make K jump. */
const PANEL_VALS = new WeakMap<HTMLElement, Record<string, number>>();

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

const TRANSPARENT: CssColor = { space: 'srgb', components: [0, 0, 0], alpha: 0, missing: 0 };
const BLACK: CssColor = { space: 'srgb', components: [0, 0, 0], alpha: 1, missing: 0 };

/** Slider ranges. C's ceiling is CSS Color 4's practical sRGB chroma maximum. */
export const LCH_MAX = { l: 100, c: 0.4, h: 360 } as const;

/** The sliders' fallback when the value has no colour to seed from ('transparent',
 *  or an unparsable string): a pleasant mid-blue, not black - black sits at C=0
 *  where the H slider does nothing, a dead-feeling start. */
const SEED: CssColor = { space: 'oklch', components: [0.62, 0.11, 250], alpha: 1, missing: 0 };

/** The colour a field's SLIDERS start from. Same as the state's colour once the
 *  field has one; the neutral seed while it does not, so an empty field opens on a
 *  live-feeling blue instead of black's dead hue axis. */
function panelSeed(field: HTMLElement, st: FieldColorState): CssColor {
  if (st.kind === 'transparent') return SEED;       // alpha 0 black has no axes worth showing
  return (field.dataset.colorCanon ?? '') ? st.color : SEED;
}

/** The field's emitted value: a gamut-mapped sRGB hex, or the transparent sentinel. */
function bakedHex(st: FieldColorState): string {
  return st.kind === 'transparent' ? 'transparent' : colorToHexString(st.color).toLowerCase();
}

// How far outside [0,1] an sRGB component may sit before the emitted hex counts
// as an approximation rather than rounding noise.
const BAKED_SLACK = 1e-4;

/** The single value+detail production site - every emit goes through it. */
function bake(st: FieldColorState): { value: string; detail: ColorChangeDetail } {
  const srgb = convertColor(st.color, 'srgb').components;
  return {
    value: bakedHex(st),
    detail: {
      css: st.kind === 'transparent' ? 'transparent' : formatColor(st.color),
      color: { ...st.color, components: [...st.color.components] as [number, number, number] },
      mode: st.mode,
      baked: st.kind !== 'transparent' && srgb.some(v => v < -BAKED_SLACK || v > 1 + BAKED_SLACK),
      ref: st.ref,
    },
  };
}

/** Do these two land on the same screen colour? Compared in sRGB, because that is
 *  where a pseudo-space (CMYK, a press profile) composes. */
function sameColor(a: CssColor, b: CssColor): boolean {
  const x = convertColor(a, 'srgb').components;
  const y = convertColor(b, 'srgb').components;
  return x.every((v, i) => Math.abs(v - (y[i] ?? 0)) < 1e-6);
}

// ── Track and dial ramps ─────────────────────────────────────────────────────
// An axis's ramp is generated ONCE, as runs (see channelRuns), and poured into two
// shapes: a linear-gradient (the slider track) and a conic-gradient (the dial).
// Same runs, same positions, so the dial can never disagree with the slider
// beneath it - gaps included.

const linearStops = (stops: readonly string[]): string => `linear-gradient(to right, ${stops.join(', ')})`;
/** `from 0deg` puts the range's start at 12 o'clock and sweeps it clockwise - 
 *  which is exactly how the needle angle (frac × 360°) is measured. */
const conicStops = (stops: readonly string[]): string => `conic-gradient(from 0deg, ${stops.join(', ')})`;

/**
 * Onion rings: the alpha token for a run's tier.
 *
 * Tier 0 is the active limit and paints opaque; each ring out is fainter, so an
 * unreachable stretch reads as "the axis continues, this limit cannot reach it"
 * rather than as a hole. The VALUES live in CSS (`--track-tier-*` on `:root` in
 * styles/tokens.css - on :root because lib/gamut-slider.ts's segments read the same
 * scale) so the wash brightness is tunable without touching this - the judgement of
 * when a wash starts to look *available* is a design one.
 */
const tierVar = (t: number): string => (t === BEYOND_TIER ? '--track-tier-beyond' : `--track-tier-${t}`);

/**
 * Can this browser parse a `color-mix()` inside a gradient stop?
 *
 * Asked once, in JS, because it has to be: the tiers are stops inside the single
 * `background` shorthand this module assigns, and if the wrapper fails to parse the
 * WHOLE declaration is dropped - the track would lose even its rail, which is worse
 * than today. `@supports` in the stylesheet cannot guard a value built here.
 * Verified true in Chromium; when it is false the tiers paint `transparent`, which
 * is exactly the behaviour that shipped before them.
 *
 * The probe carries a LITERAL percentage, not the `var()` the shipped stops use, and
 * that is the whole point: a declaration containing `var()` cannot be validated
 * before substitution, so `CSS.supports` answers TRUE for it unconditionally - it
 * says yes to `totally-not-a-color(in oklab, red var(--x), transparent)` as well,
 * which made the earlier form of this probe unable to fail. The literal form
 * discriminates (verified both ways in Chromium 149), and it is a sound proxy: a
 * `var()` is accepted syntactically wherever a value is, so if `color-mix` parses at
 * all the shipped form parses too.
 */
let tiersOk: boolean | null = null;
const tiersSupported = (): boolean => {
  // Asked on first paint rather than at import: `CSS` is not guaranteed to exist
  // yet when this module is evaluated (it does not under the jsdom harness), and an
  // import-time probe would then latch "unsupported" for the whole session.
  if (tiersOk === null) {
    tiersOk = typeof CSS === 'undefined' || CSS.supports?.(
      'background', 'linear-gradient(to right, color-mix(in oklab, red 28%, transparent), blue)',
    ) !== false;
  }
  return tiersOk;
};

/**
 * One stop's CSS at its tier's opacity.
 *
 * `color-mix` rather than the two alternatives, deliberately:
 *
 * - element `opacity` is unavailable - there is no element per band, and a conic
 *   ring cannot be split into positioned children the way `.gsl-seg` can without
 *   giving the dial and the slider two different paint paths.
 * - relative colour syntax is wrong here: `rgb(from X r g b / var(--a))` CLIPS a
 *   wide-gamut stop to sRGB, and a tier-1 band's whole point is that it is a P3
 *   colour. `oklch(from …)` avoids the clip but the channel keywords differ per
 *   space, and `stopCss` legitimately emits `oklch()`, `lab()`,
 *   `color(display-p3 …)` or a hex.
 *
 * `in oklab` takes any of those notations unchanged and keeps the result out of
 * sRGB. Gradient interpolation is premultiplied, so an opaque tier-0 stop meeting a
 * translucent tier-1 stop at the same position is a clean hard stop with no grey
 * mud between them.
 */
const wash = (css: string, t: number): string => {
  if (t === 0) return css;
  if (!tiersSupported()) return 'transparent';
  return `color-mix(in oklab, ${css} var(${tierVar(t)}, 0%), transparent)`;
};

/**
 * Positioned stops for a run list: each run's colours across its own stretch.
 *
 * `washed` is what separates the two shapes this feeds. A TRACK washes the rings
 * out by their tier's token (the onion), because a slider is the control of record
 * and the form of its solid band is the information. A DIAL does not: Andy asked
 * for the full colour on both sides of the boundary there, with the crossing
 * carried by a hairline instead (see dialEdgesHtml) - so the same run list, at the
 * same fractions, pours into the ring at full strength.
 */
function runParts(runs: readonly ChannelRun[], washed = true): string[] {
  const at = (f: number): string => `${(clamp01(f) * 100).toFixed(2)}%`;
  const paint = (css: string, tier: number): string => (washed ? wash(css, tier) : css);
  const parts: string[] = [];
  let cursor = 0;
  for (const run of runs) {
    // Dead defence: `channelRuns` covers [0,1] by construction now. Kept so a
    // caller that hands over a sparse list still gets a well-formed gradient.
    if (run.from > cursor) parts.push(`transparent ${at(cursor)}`, `transparent ${at(run.from)}`);
    const n = run.stops.length;
    // A single-sample run still spans its (bisected) stretch, so state its one
    // colour at BOTH ends - otherwise the band fades into the transparent gap
    // beside it instead of reading as the solid sliver of reachable colour it is.
    if (n < 2) {
      const one = paint(String(run.stops[0]), run.tier);
      parts.push(`${one} ${at(run.from)}`, `${one} ${at(run.to)}`);
    } else run.stops.forEach((css, i) => {
      parts.push(`${paint(css, run.tier)} ${at(run.from + (run.to - run.from) * (i / (n - 1)))}`);
    });
    cursor = Math.max(cursor, run.to);
  }
  if (cursor < 1) parts.push(`transparent ${at(cursor)}`, 'transparent 100%');
  return parts;
}

/**
 * Every tier crossing along an axis, as 0–1 fractions - the boundaries the dial
 * hairlines stand on.
 *
 * Read off the SAME run list the ramp is poured from, which is the whole point: a
 * boundary computed any other way (a second bisection, a fresh gamut test) would
 * land a hair off the fraction the gradient actually breaks at, and the hairline
 * would sit beside its own edge on the dial while the slider beneath disagreed.
 * `channelRuns` makes adjacent runs share their boundary exactly and only opens a
 * run where the tier CHANGES, so every interior `from` is a crossing.
 *
 * There is deliberately no "first boundary" special case: a hue ring at high
 * chroma leaves and re-enters a gamut several times, and each of those crossings
 * is a place the display stops. 0 and 1 are excluded - the axis ends there, it does
 * not cross there.
 */
export function runBoundaries(runs: readonly ChannelRun[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < runs.length; i++) {
    const f = runs[i]!.from;
    if (f > 0 && f < 1 && !out.includes(f)) out.push(f);
  }
  return out;
}

/** The rail the gaps read against, as the BOTTOM background layer - the axis
 *  carries on there, the gamut just cannot reach it. It rides in the same
 *  `background` shorthand as the runs because that shorthand is what JS assigns:
 *  a `background-color` from the stylesheet would be wiped by it, and an inset
 *  box-shadow (which paints over the background) veiled the gradient it framed.
 *  The colour itself stays in CSS, as --track-rail. */
const RAIL = 'linear-gradient(var(--track-rail, transparent), var(--track-rail, transparent))';

const trackFromRuns = (runs: readonly ChannelRun[]): string =>
  runs.length ? `${linearStops(runParts(runs))}, ${RAIL}` : RAIL;
const dialFromRuns = (runs: readonly ChannelRun[]): string =>
  runs.length ? `${conicStops(runParts(runs, false))}, ${RAIL}` : RAIL;

/**
 * The three OKLCH axis ramps as stop lists - the ORIGINAL full-range builder,
 * kept because `lchTrackGradients` is a public export with pinned output (see
 * color-field.test.ts). The picker's own tracks come from `channelRuns`, which
 * breaks the ramp where the colour stops being displayable; this one never does.
 */
function lchTrackStops(l: number, c: number, h: number): { l: string[]; c: string[]; h: string[] } {
  const ramp = (n: number, at: (t: number) => string): string[] =>
    Array.from({ length: n }, (_, i) => at(i / (n - 1)));
  const pct = (v: number): string => `${Math.round(v * 1000) / 10}%`;
  return {
    l: ramp(9, t => `oklch(${pct(t)} ${c} ${h})`),
    c: ramp(9, t => `oklch(${pct(l)} ${t * LCH_MAX.c} ${h})`),
    h: ramp(13, t => `oklch(${pct(l)} ${Math.max(c, 0.08)} ${t * 360})`), // floor C so the hue sweep stays visible near grey
  };
}

/** The three slider-track gradients for the current colour. Exported for tests. */
export function lchTrackGradients(l: number, c: number, h: number): { l: string; c: string; h: string } {
  const s = lchTrackStops(l, c, h);
  return { l: linearStops(s.l), c: linearStops(s.c), h: linearStops(s.h) };
}

/**
 * Black or white - whichever reads on `hex`. Perceptual luminance threshold.
 *
 * **This is the ONE inversion rule for ink sitting on a colour**, and every surface
 * that flips ink must use it: the dial's output disc, the value pill, the swatch
 * tips, and Colour Lab's big swatch and ramp step labels. There were three
 * different rules before - this luma threshold, a WCAG-ratio winner, and a
 * `>= 4.5 against white` test - and the last two both flip around relative
 * luminance 0.18, far darker than this one. The visible result was ink flipping to
 * black on the pill and the swatch while the disc beside them was still white:
 * `#CF6CA9` (luma 144.6) and `#DD79B6` (157.9) sit either side of THIS threshold
 * but on the same side of the other two. Andy asked for the disc's flip point
 * everywhere, so this is it.
 *
 * Why the luma threshold rather than the WCAG ratio: the ratio's crossover is where
 * the two ratios are numerically equal, which is a contrast-compliance question, not
 * a legibility one - it hands black to almost every mid-tone. 0.299/0.587/0.114 at
 * 150 flips where the eye flips.
 *
 * The implementation lives in brand-vars.ts now (re-exported here unchanged):
 * the app chrome's accent ink is computed with the same rule, and that module
 * is on the boot path where this file's engine-barrel import is off-limits.
 */
export { contrastText };

// ── Dials ────────────────────────────────────────────────────────────────────
// A ring per channel, sitting above the sliders: the axis's ramp poured into a
// conic gradient, with a needle at value → angle. A `circular` channel (a genuine
// hue) is the real form of that axis; the others are a sweep whose two ends meet
// at 12 o'clock, which is why there is a visible seam there - that is the range's
// edge, not an artefact.
//
// The dials are painted from the CURRENT colour, so they carry the context the
// sliders do. Dragging one is a convenience - the slider under it stays the
// control of record (it is the accessible one, and the precise one), and a dial
// drag simply drives it. Hence aria-hidden + tabindex="-1" on every ring.
//
// The fourth disc is the OUTPUT: the colour these axes currently make. It's split
// in half - the top picks a colour off the screen (eyedropper), the bottom opens
// the swatch menu - with the glyphs struck through it in its own contrast colour.
//
// Whether they render at all is the caller's `dials` option. It DEFAULTS to
// `inline` (the spacious always-open panel), which is what it used to be hard-wired
// to; a float popover can now ask for them.

/** `runs: null` = "leave this ring's gradient alone, only move its needle" - what a
 *  repaint of the channel being dragged asks for, since that axis's own ramp did not
 *  change. The needle must still move, or the ring stops following the finger. */
interface DialSpec { ch: string; label: string; aria: string; frac: number; runs: ChannelRun[] | null }

/** The needle's angle for a 0–1 position on the axis. Matches conicStops' `from 0deg`. */
const needleDeg = (frac: number): string => `${(clamp01(frac) * 360).toFixed(1)}deg`;

/**
 * The boundary hairlines for one ring - one radial line per tier crossing.
 *
 * The colour continues at full strength on BOTH sides of it (see runParts' `washed`):
 * this marks where a display stops, it does not withhold anything. The dials'
 * counterpart to the sliders' opacity ladder, not a replacement for it.
 *
 * ELEMENTS rather than stops inside the conic gradient, for three reasons, in order
 * of weight:
 *
 * - a gradient stop pair spans an ANGLE, so its mark is a wedge - hair-thin at the
 *   hub and several pixels wide at the rim. A rotated element carries one width at
 *   every radius, which is what "hairline" means, and it is the geometry the needle
 *   beside it already uses.
 * - the appearance then lives entirely in CSS. JS writes one `transform` per
 *   crossing and nothing else, so the colour, the width and the length are tunable
 *   the way the tier opacities are. Stops would have to be assembled here, in the
 *   one `background` shorthand this module assigns - where a stylesheet
 *   `background-color` is wiped, which is exactly why the rail rides in the
 *   shorthand as a layer (see RAIL).
 * - interpolation would fight it: gradient stops premultiply, so a mark meeting a
 *   translucent wash smears rather than staying a line.
 *
 * They go in their own container, and that container is the innerHTML target - 
 * never the dial, which hosts the needle and the hub.
 */
function dialEdgesHtml(runs: readonly ChannelRun[] | null): string {
  return (runs ? runBoundaries(runs) : [])
    .map(f => `<span class="color-dial-edge" style="transform:rotate(${needleDeg(f)})"></span>`)
    .join('');
}

const EDIT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

/** The dial row: one ring per channel + the output disc. `outHex` is machine-made
 *  (colorToHexString), so it's always a safe `#rrggbb` for a CSS context.
 *
 *  `slots` is how many discs the row must SIZE for - the widest space's channel
 *  count + the output disc, not this row's own count. The rings share the width by
 *  slot rather than by sibling count, so a 3-channel space and a 4-channel one draw
 *  the same size ring and the band's height stops depending on which tab is open
 *  (see `--dial-slots` in styles/parts/color-field.css). */
function dialsHtml(dials: readonly DialSpec[], outHex: string, slots: number): string {
  const ring = (d: DialSpec): string => `
      <button type="button" class="color-dial" data-dial-ch="${escape(d.ch)}" tabindex="-1"
              style="background:${dialFromRuns(d.runs ?? [])}" title="${escape(d.aria)}" aria-hidden="true">
        <span class="color-dial-edges" data-dial-edges>${dialEdgesHtml(d.runs)}</span>
        <span class="color-dial-needle" style="transform:rotate(${needleDeg(d.frac)})"></span>
        <span class="color-dial-hub">${escape(d.label)}</span>
      </button>`;
  return `<div class="color-dials" style="--dial-slots:${Math.max(1, Math.round(slots))}">
      ${dials.map(ring).join('')}
      <div class="color-dial-out" data-dial-out style="--out:${outHex};--out-fg:${contrastText(outHex)}">
        <button type="button" class="color-dial-act" data-dial-act="eyedropper"
                title="Pick a colour from your screen" aria-label="Pick a colour from your screen">${EYEDROPPER_ICON}</button>
        <button type="button" class="color-dial-act" data-dial-act="native"
                title="More colours" aria-label="More colours">${EDIT_ICON}</button>
      </div>
    </div>`;
}

/** Repaint a panel's dials + output disc. */
function paintDials(panel: HTMLElement, dials: readonly DialSpec[], outHex: string): void {
  for (const d of dials) {
    const dial = panel.querySelector<HTMLElement>(`.color-dial[data-dial-ch="${cssEscape(d.ch)}"]`);
    if (!dial) continue;
    if (d.runs) {
      dial.style.background = dialFromRuns(d.runs);
      // Only when this axis's ramp changed - `runs: null` is the dragged channel,
      // whose own boundaries stand where they were. The container holds nothing but
      // these spans, so it is a safe innerHTML target; the dial itself is not (the
      // needle and the hub live there).
      const edges = dial.querySelector<HTMLElement>('[data-dial-edges]');
      if (edges) edges.innerHTML = dialEdgesHtml(d.runs);
    }
    const needle = dial.querySelector<HTMLElement>('.color-dial-needle');
    if (needle) needle.style.transform = `rotate(${needleDeg(d.frac)})`;
  }
  const out = panel.querySelector<HTMLElement>('[data-dial-out]');
  if (out) {
    out.style.setProperty('--out', outHex);
    out.style.setProperty('--out-fg', contrastText(outHex));
  }
}

// Pipette glyph for the screen eyedropper button (stroke follows the input's
// contrast-flipped text colour via currentColor).
const EYEDROPPER_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z"/></svg>';

// The value input doubles as a live swatch of the current colour: the colour
// itself (alpha included, over the .color-input--painted checkerboard so a
// translucent value previews its opacity) as background, a contrast-tinted
// edge of the same colour as border, and the text flipped to whichever of
// white/black reads with more contrast (WCAG ratio, engine brand-derive math).
// Delivered as custom properties (--color-input-*) rather than style longhands
// so the stylesheet's :focus ring still outranks the border tint.
const CHECKER_AVG = 0xe6; // the checkerboard's average grey (#fff / #ccc squares)
function colorInputPaint(hex: string): Record<string, string> {
  const rgb = hex.slice(0, 7);
  const a = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
  // Judge contrast against what the eye actually sees: a translucent colour
  // composites over the checkerboard, so blend toward its average grey first.
  const eff = '#' + [1, 3, 5].map((i) => {
    const c = parseInt(rgb.slice(i, i + 2), 16);
    return Math.round(c * a + CHECKER_AVG * (1 - a)).toString(16).padStart(2, '0');
  }).join('');
  // The shared inversion rule - see contrastText. The compositing above still
  // matters (a translucent value is judged as the eye sees it, over the
  // checkerboard); only the black/white DECISION is now shared.
  const fg = contrastText(eff);
  return {
    '--color-input-bg': hex,
    '--color-input-border': `color-mix(in oklab, ${rgb}, ${fg} 25%)`,
    '--color-input-fg': fg,
  };
}

/** (Re)paint a value input as the given colour's swatch - or back to the
 *  neutral chrome when the value has no colour (transparent / mid-edit junk).
 *  The custom props land on the .color-input-wrap (they inherit), so the
 *  eyedropper button beside the input flips contrast along with the text. */
function paintColorInput(input: HTMLInputElement | null, value: string): void {
  if (!input) return;
  const hex = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(value) ? value : null;
  const paint = hex ? colorInputPaint(hex) : null;
  input.classList.toggle('color-input--painted', Boolean(paint));
  const holder = input.closest<HTMLElement>('.color-input-wrap') ?? input;
  for (const p of ['--color-input-bg', '--color-input-border', '--color-input-fg']) {
    if (paint) holder.style.setProperty(p, paint[p]!);
    else holder.style.removeProperty(p);
  }
}

/** Past this many characters the value field's 17px mono text no longer fits the
 *  narrow hosts (a 316px brand-studio swatch editor cuts `oklch(61.374% 0.13585 260.14)`
 *  off at the hue), and an input gives no ellipsis of its own. The stylesheet steps
 *  the type down at this class, and the full string also rides in a `title`. */
const LONG_VALUE = 22;

/** The #rrggbb an alpha track fades out from. A non-hex value ('transparent', an
 *  ident, a token that has not resolved) has no colour to fade, so it falls back to
 *  a neutral rather than rendering as an accidental black. */
function alphaTrackHex(v: string | null | undefined): string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}/.test(v) ? v.slice(0, 7) : '#808080';
}

// ── Space panels ─────────────────────────────────────────────────────────────
// One `.color-space` per registered mode: a channel row per ChannelSpec, plus the
// optional dial row. There is no `switch (space)` anywhere in this path - the rows
// come from the registry's data and the ramps from `channelRuns`, so a press
// profile mounted at runtime renders with no new code.

/** Numbers land in `value`/`style` attributes, so keep them short and finite. */
const num = (v: number): string => (Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6) : '0');

function channelRowHtml(eid: string, ch: ChannelSpec, vals: Record<string, number>, runs: ChannelRun[]): string {
  const raw = vals[ch.ch] ?? ch.min;
  const { at, pinned } = pinValue(ch, raw);
  return `
      <div class="color-lch-row">
        <span class="color-lch-label" aria-hidden="true">${escape(ch.label)}</span>
        <input type="range" class="color-lch-slider color-mode-slider" data-mode-ch="${escape(ch.ch)}"
               min="${num(ch.min)}" max="${num(ch.max)}" step="${num(ch.step)}" value="${num(at)}"
               style="background:${trackFromRuns(runs)}" aria-label="${escape(ch.aria)}">
        <span class="color-lch-val${pinned ? ' is-clamped' : ''}" data-mode-val="${escape(ch.ch)}"
              aria-describedby="${eid}-note"${pinned ? ` title="${escape(PIN_TITLE)}"` : ''}>${escape(ch.fmt(raw))}</span>
      </div>`;
}

// The readout carrying this sits inside its own space's panel, so "this space" is
// unambiguous there; the shared caution line names the space instead (pinNote).
const PIN_TITLE = 'Outside this space - the slider is pinned, the value is unchanged';
const pinNote = (label: string): string => `Outside ${label} - the slider is pinned, the value is unchanged`;

/**
 * One space's panel. `tabbed` adds the tabpanel ARIA that only makes sense when
 * there is a tab strip above it; the non-modes popover renders the same panel
 * bare.
 *
 * The OKLCH panel keeps `.color-lch` alongside `.color-space`: views/color-lab.test.ts
 * asserts it is mounted. (The old focus-to-expand reveal keyed on
 * `.color-popover > .color-lch[hidden]` is gone - the whole fine section now
 * sits behind the popover's Fine-tune fold, so the panel renders visible inside
 * it.) The other panels keep the legacy `.color-modegroup` so components.css's
 * height reservation still applies to them.
 */
function spacePanelHtml(
  eid: string, spec: SpaceSpec, seed: CssColor, lastHue: number,
  o: { hidden: boolean; dials: boolean; tabbed: boolean; rows?: number },
): string {
  const vals = decomposeColor(spec, seed, lastHue);
  const runs = spec.channels.map(ch => channelRuns(spec, ch, vals, seed.alpha));
  // Every panel in a tab strip carries the same number of row slots - the widest
  // space's - so switching a 3-channel space ↔ a 4-channel one moves nothing below
  // the panel. The fillers are real (empty) rows rather than a CSS min-height
  // guess: the reservation is then exactly one row tall at any width or font size,
  // which the guessed 18px-per-row constant never was (a row is 2em).
  const slots = Math.max(o.rows ?? spec.channels.length, spec.channels.length);
  const rows = spec.channels.map((ch, i) => channelRowHtml(eid, ch, vals, runs[i]!)).join('')
    + '<div class="color-lch-row color-lch-row--filler" aria-hidden="true"></div>'.repeat(slots - spec.channels.length);
  const dials = o.dials
    ? dialsHtml(
        spec.channels.map((ch, i) => {
          const { at } = pinValue(ch, vals[ch.ch] ?? ch.min);
          return { ch: ch.ch, label: ch.label, aria: ch.aria, frac: (at - ch.min) / (ch.max - ch.min || 1), runs: runs[i]! };
        }),
        colorToHexString(composeColor(spec, vals, 1)),
        slots + 1,
      )
    : '';
  const slug = slugMode(spec.mode);
  const cls = `color-space ${spec.mode === 'oklch' ? 'color-lch' : 'color-modegroup'}`;
  const aria = o.tabbed
    ? ` role="tabpanel" id="${eid}-grp-${slug}" aria-labelledby="${eid}-tab-${slug}" tabindex="-1"`
    : '';
  return `<div class="${cls}" data-space-group="${escape(spec.mode)}"${aria}${o.hidden ? ' hidden' : ''}>${dials}${rows}</div>`;
}

const FAMILY_LABEL: Record<ColorModeFamily, string> = {
  perceptual: 'Perceptual', device: 'Device', output: 'Output',
};

/** One tab. Profile entries are two-line full-width rows - section 11.6b wants the
 *  profile name ON the tab, and a bare "CMYK" pill cannot carry it. */
function modeTabHtml(eid: string, spec: SpaceSpec, active: boolean): string {
  const slug = slugMode(spec.mode);
  const wide = String(spec.mode).startsWith('icc:');
  const aria = `${spec.label}, ${spec.family}${spec.ariaSuffix ? `, ${spec.ariaSuffix}` : spec.sub ? `, ${spec.sub}` : ''}`;
  return `<button type="button" class="color-mode-tab${wide ? ' color-mode-tab--wide' : ''}" role="tab"
              id="${eid}-tab-${slug}" data-mode="${escape(spec.mode)}" data-mode-family="${spec.family}"
              aria-selected="${active}" tabindex="${active ? 0 : -1}" aria-controls="${eid}-grp-${slug}"
              aria-label="${escape(aria)}">
        <span class="color-mode-tab-label">${escape(spec.label)}</span>${
    spec.sub ? `<span class="color-mode-tab-sub">${escape(spec.sub)}</span>` : ''}
      </button>`;
}

/**
 * The grouped tab strip + every space panel + the field's one caution line.
 *
 * ONE flat `role="tablist"`, visually grouped into three labelled rows. A
 * two-level shape (family tabs → space tabs) was worked through and rejected:
 * `wireTabs` scopes its roving tabindex to one container, so three inner
 * instances would need a hand-written coordinator to clear the other two
 * families' aria-selected, and an arrow press at a family boundary would land
 * focus inside a `hidden` panel. One tablist gets one tab stop, arrows that walk
 * every entry in visual order across group boundaries, and the grouping stays
 * VISIBLE as headings - which serves "the grouping is real information" better
 * than a control that hides two thirds of it.
 *
 * The family names reach assistive tech through each tab's aria-label
 * ("OKLCH, perceptual"), because a `role="presentation"` wrapper cannot
 * contribute a group name to a flat tablist.
 */
function colorModesHtml(eid: string, seed: CssColor, lastHue: number, active: ColorMode, dials: boolean, allSpaces: boolean): string {
  const specs = allSpaces ? colorSpaces() : [getColorSpace('hsl')!, getColorSpace('oklch')!];
  const families = !allSpaces ? specs.map(s => modeTabHtml(eid, s, s.mode === active)).join('') : (['perceptual', 'device', 'output'] as const).map(family => {
    const rows = specs.filter(s => s.family === family);
    if (!rows.length) return '';
    const wide = family === 'output' && rows.some(s => String(s.mode).startsWith('icc:'));
    return `<div class="color-mode-fam${wide ? ' color-mode-fam--wide' : ''}" role="presentation" data-mode-family="${family}">
        <span class="color-mode-fam-label" aria-hidden="true">${FAMILY_LABEL[family]}</span>
        ${rows.map(s => modeTabHtml(eid, s, s.mode === active)).join('')}
      </div>`;
  }).join('');
  const widest = Math.max(...specs.map(s => s.channels.length));
  const panels = specs
    .map(s => spacePanelHtml(eid, s, seed, lastHue, { hidden: s.mode !== active, dials, tabbed: true, rows: widest }))
    .join('');
  return `<div class="color-modes${allSpaces ? '' : ' color-modes--simple'}" data-color-modes="${eid}" data-active-mode="${escape(active)}">
      <div class="color-mode-tabs" role="tablist" aria-label="Colour space">${families}</div>
      ${panels}
      ${noteHtml(eid)}
    </div>`;
}

/**
 * The field's one caution line. `role="status"` so a mode switch or a gamut change
 * is announced without stealing focus; written at most every 300ms and never with
 * text it already carries, so a slider drag does not turn it into a firehose.
 *
 * It starts `hidden` and unhides when it has something to say: styling an empty
 * live region is the stylesheet's business, and this component must not leave an
 * empty paragraph taking up space before that CSS lands.
 */
const noteHtml = (eid: string): string =>
  `<p class="color-space-note" data-color-note="${eid}" id="${eid}-note" role="status" aria-live="polite" hidden></p>`;

/**
 * The trigger's accessible name.
 *
 * `label` is WHICH PROPERTY this field paints, and it exists because a host can lay
 * several of these out in one panel: the Design inspector shows Fill, Stroke, shadow
 * Colour and Text colour on a single box, and its row labels are `<span>`s in a `<div>`,
 * so nothing associated them with the control. Every one of the four then announced
 * itself as the identical "Colour: #000000" - the trigger carried the value and no hint
 * of what the value was FOR. Given a label the name leads with it; without one the
 * wording is byte-identical to what it has always been.
 *
 * Not translated here: this component has always written this string in English (the
 * "Colour: " prefix below), and the label arrives already translated by its host.
 */
function triggerAria(label: string, name: string, hex: string): string {
  const value = `${name ? name + ' ' : ''}${hex}`;
  return label ? `${label}: ${value}` : `Colour: ${value}`;
}

export function colorFieldHtml(id: string, value: unknown, { float = false, swatchesOnly = false, block = false, inline = false, modes = false, palette = false, dials, progressive = false, name: nameOverride, label = '', initialMode }: { float?: boolean; swatchesOnly?: boolean; block?: boolean; inline?: boolean; modes?: boolean; palette?: boolean; dials?: boolean; progressive?: boolean; name?: string; label?: string; initialMode?: ColorMode } = {}): string {
  const rawVal = toHex(value) ?? '';
  const isTransparent = String(rawVal).trim().toLowerCase() === 'transparent';
  // Seeding is strictly WIDENED: anything the engine's parseColor accepts (hex,
  // named, rgb(), hsl(), hwb(), lab(), lch(), oklab(), oklch(), color(<space> …))
  // is kept in its AUTHORED space. Everything that parsed before parses to the
  // same colour, so nothing regresses; a host that persists `detail.css` now gets
  // a lossless reopen.
  const parsed = isTransparent ? null : parseColor(String(rawVal));
  const color = isTransparent ? TRANSPARENT : (parsed ?? BLACK);
  const st: FieldColorState = {
    kind: isTransparent ? 'transparent' : 'color',
    color,
    // The space the field opens in. The default is the familiar one (HSL); a
    // surface whose job is colour itself - the Colour Lab - opens in OKLCH so a
    // wide-gamut seed is described unclamped and its report reads in that space.
    mode: initialMode && getColorSpace(initialMode) ? initialMode : DEFAULT_COLOR_MODE,
    lastHue: hueOf(color) ?? SEED.components[2],
    ref: null,
  };
  const seed = parsed ? color : SEED;               // no colour yet ⇒ the neutral seed
  const canon = isTransparent ? 'transparent' : (parsed ? formatColor(color) : '');

  const hex = bakedHex(st);
  const rgbHex = isTransparent ? '#000000' : hex.slice(0, 7);
  const alphaInt = isTransparent ? 0 : Math.round(clamp01(color.alpha) * 255);
  const alphaPct = Math.round(alphaInt / 255 * 100);
  // The value field shows the colour in the active space (with modes) or as a hex
  // (without). An unparsable value keeps its own text - mid-edit junk is held, not
  // silently replaced.
  const shown = isTransparent ? 'transparent'
    : parsed ? (modes ? spaceText(getColorSpace(st.mode)!, color) : hex)
    : (String(rawVal) || '#000000');
  const painted = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(shown);
  // The trigger preview paints the BAKED hex, matching what updateTrigger writes
  // on every later edit - a wide-gamut colour previews as the colour a screen can
  // actually show, in one notation, rather than as `color(srgb …)` here and a hex
  // a moment later.
  const previewBg = isTransparent ? '' : `style="background:${escape(safeCssColor(parsed ? hex : String(rawVal)) || '#000000')}"`;
  const previewClass = `color-trigger-preview${isTransparent ? ' color-swatch--transparent' : ''}`;
  const eid = escape(id);
  // `name` overrides the computed one for a host that knows something the value alone
  // cannot say - a token-backed fill seeds the field with the RESOLVED colour and passes
  // the token's own name ("Primary") here, so the trigger reads "Primary #ff8fbe" rather
  // than naming the resolved hex a second time. The moment the user picks a new colour
  // the override stops applying (updateTrigger computes the name again from the value),
  // which is right: the value is no longer that token's.
  const name = nameOverride || swatchName(value);
  const wantDials = dials ?? (inline && !palette);

  // Swatches are NOT rendered here - they're the heaviest part (the whole
  // palette per field) and are built lazily on first popover open (see
  // buildSwatches in wireColorField). Keeps the initial grid DOM light.
  //
  // The trigger shows the swatch circle + the colour NAME (small, muted SUSE Mono) - 
  // NOT the hex; the hex value lives only inside the popover picker. A CSS container
  // query on the button collapses the name away, leaving just the circle, when the
  // field is squeezed in next to other controls (see .color-trigger in components.css).
  // The name span is always present (:empty hides it) so live edits can fill/clear it
  // without a rebuild. The hex still rides in the aria-label for screen readers.
  // `block` marks a field living inside a block-editor row: positionPopover's
  // block-color-field branch spans the popover across the sidebar, and the block
  // host routes its onChange by the composite id ("blockId:idx:fieldId").
  // `inline` drops the trigger entirely and keeps the popover always-open, laid
  // out in flow (no floating/positioning) - for hosts with room to spare that
  // want the picker as a spacious inline panel, not a click-to-open popover (the
  // brand editor's Primary colour and swatch editor). CSS (.color-field--inline)
  // turns the popover static and gives the dials the full width.
  //
  // Inline editors omit the always-open palette by default. `palette: true`
  // exposes the same swatch grid above Fine-tune for an embedded picker.
  //
  // `data-color-canon` is the server-render → wire handoff: the canonical colour
  // as a CSS Color 4 string (or 'transparent', or empty for "no colour yet").
  // wireColorField re-parses it with the engine's strict parseColor, which is why
  // the hidden native input is now WRITE-ONLY - it is the OS picker's own control
  // and can only speak `#rrggbb`, so it cannot be the authority.
  // A first-contact inline picker should feel like choosing a colour, not
  // opening a colour-science console. Its editable value and two visual pick
  // routes stay in sight; modes, dials and opacity wait behind Fine-tune. The
  // ordinary inline editor remains byte-for-byte expanded unless its caller
  // explicitly opts into this progressive pose.
  const progressiveInline = inline && progressive;
  const folded = !inline || progressiveInline || palette;
  const inputRow = `<div class="color-input-wrap"${painted ? ` style="${Object.entries(colorInputPaint(shown)).map(([k, v]) => `${k}:${v}`).join(';')}"` : ''}>
      ${/* NO maxlength: this field takes any CSS colour ('rebeccapurple',
            'color(display-p3 1 0 0)'), and the 9-character hex cap silently
            truncated every one of them mid-paste. What it SHOWS is still a hex
            where there are no space tabs to say otherwise - see writeValueField. */''}
      <input type="text" class="color-input${painted ? ' color-input--painted' : ''}${shown.length > LONG_VALUE ? ' color-input--long' : ''}" data-color-hex="${eid}"
             value="${escape(shown)}" placeholder="${modes ? 'colour value' : '#rrggbbaa'}" title="${escape(shown)}"
             spellcheck="false" autocomplete="off" aria-label="Colour value">
      <button type="button" class="color-eyedropper" data-color-eyedropper="${eid}" aria-label="Pick a colour from your screen" title="Pick a colour from your screen">${EYEDROPPER_ICON}</button>
      ${progressiveInline ? `<button type="button" class="color-native-button" data-color-native-button="${eid}" aria-label="Open colour picker" title="Open colour picker">${icon('palette', { size: 16 })}</button>` : ''}
      </div>`;
  const fineToggle = `<button type="button" class="color-fine-toggle" data-color-fine-toggle="${eid}" aria-expanded="false">${icon('sliders', { size: 13 })}<span>${escape(t('Fine-tune'))}</span>${icon('chevronDown', { className: 'color-fine-chev', size: 14 })}</button>`;
  const cls = `color-picker-field${float ? ' color-field--float' : ''}${block ? ' block-color-field' : ''}${inline ? ' color-field--inline' : ''}${progressiveInline ? ' color-field--progressive' : ''}${palette ? ' color-field--palette' : ''}`;
  return `<div class="${cls}" data-color-field="${eid}" data-color-canon="${escape(canon)}" data-color-notation="${modes ? 'space' : 'hex'}"${label ? ` data-color-label="${escape(label)}"` : ''}>
    ${inline ? '' : `<button type="button" class="color-trigger" data-color-trigger="${eid}" aria-haspopup="true" aria-expanded="false" aria-label="${escape(triggerAria(label, name, hex))}">
      <span class="color-trigger-name">${escape(name)}</span>
      <span class="${previewClass}" ${previewBg} aria-hidden="true"></span>
    </button>`}
    <div class="color-popover" role="group" aria-label="Colour options"${inline ? '' : ' hidden'}>
      ${inline && !palette
        // Inline has no always-open palette (the brand editor's own tiles ARE the
        // palette). The swatch grid instead lives in a menu the result disc's edit
        // action opens - "the swatch context menu" - so presets stay one click away.
        ? '<div class="color-swatch-menu" data-swatch-menu hidden><div class="color-swatches" role="group" aria-label="Brand colour swatches" tabindex="0"></div></div>'
        // In a click-to-open popover the PALETTE leads: most picks are a brand
        // swatch, so the grid is the whole first screen and the fine controls
        // (value/eyedropper/sliders/alpha) wait behind the Fine-tune fold below.
        : '<div class="color-swatches" role="group" aria-label="Brand colour swatches" tabindex="0"></div>'}
      ${swatchesOnly ? '' : `${progressiveInline ? inputRow : ''}${folded ? fineToggle : ''}
      <div class="color-fine"${folded ? ' data-color-fine hidden' : ''}>
      ${progressiveInline ? '' : inputRow}
      ${colorModesHtml(eid, seed, st.lastHue, st.mode, wantDials, modes)}
      <div class="color-alpha-row">
        <span class="color-alpha-label" aria-hidden="true">A</span>
        ${/* The gradient ends are emitted HERE as well as repainted from JS: nothing
              calls writeValueField on first render, so a field that is never
              touched would otherwise show the CSS fallback grey instead of its own
              colour fading out. */''}
        <input type="range" class="color-alpha-slider" data-color-alpha="${eid}"
               style="--alpha-from:${alphaTrackHex(rgbHex)}00;--alpha-to:${alphaTrackHex(rgbHex)}ff"
               min="0" max="255" value="${alphaInt}" aria-label="Opacity">
        <span class="color-alpha-pct" data-alpha-pct="${eid}">${alphaPct}%</span>
      </div>
      <input type="color" class="color-popover-native" data-input-id="${eid}" value="${escape(rgbHex)}" aria-label="Pick a custom colour">
      <button type="button" class="color-nearest" data-color-nearest="${eid}" hidden></button>
      </div>`}
    </div>
  </div>`;
}

/** The palette swatch buttons for a field - built lazily on first popover open. */
function swatchButtonsHtml(id: string): string {
  const eid = escape(id);
  return SWATCHES.map(s => {
    const isTrans = s.value === 'transparent';
    const refAttr = s.ref ? ` data-swatch-ref="${escape(s.ref)}"` : '';
    const name = s.label || s.value;
    const aria = s.group && s.label ? `${s.group} · ${s.label}` : name;
    // Each swatch carries its own colour (--sw-c) + a black/white contrast colour
    // (--sw-fg) as inline custom props; the floating hover tooltip paints itself in
    // those (see showSwatchTip). Transparent has no colour of its own, so give the
    // tooltip a neutral chip. No native `title` - the graphical tip replaces it.
    // safeCssColor: this is a CSS context, so attribute-escaping alone isn't
    // enough - an unvalidated token value could smuggle extra declarations.
    const val = safeCssColor(s.value);
    const tip = isTrans ? '--sw-c:#c9ccd1;--sw-fg:#1d1d1d' : `--sw-c:${escape(val || '#c9ccd1')};--sw-fg:${contrastText(val)};background:${escape(val)}`;
    return `<button type="button"
      class="color-swatch${isTrans ? ' color-swatch--transparent' : ''}"
      data-swatch-for="${eid}" data-swatch-value="${escape(s.value)}"${refAttr}
      data-name="${escape(name)}" style="${tip}"
      aria-label="${escape(aria)}"></button>`;
  }).join('');
}

// ── Swatch name tooltip (a single shared, floating chip) ─────────────────────────
// A graphical hover label for the palette swatches: a little chip painted in the
// swatch's OWN colour with a contrasting black/white name. It lives on document.body
// as position:fixed, so the swatch grid's own scroll/overflow never clips it (a CSS
// ::after would be), pops in after a tiny delay, and is pointer-events:none - hovering
// it never steals a click, so you can slide straight onto the next swatch. One shared
// element + delegated listeners cover every field's (lazily built) swatches.
let swatchTip: HTMLElement | null = null;
let swatchTipTimer: ReturnType<typeof setTimeout> | undefined;
let swatchTipArmed = false;

function showSwatchTip(swatch: HTMLElement): void {
  const name = swatch.dataset.name;
  if (!name) return;
  if (!swatchTip) {
    swatchTip = document.createElement('div');
    swatchTip.className = 'swatch-name-tip';
    swatchTip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(swatchTip);
  }
  const tip = swatchTip;
  tip.textContent = name;
  tip.style.background = swatch.style.getPropertyValue('--sw-c').trim() || '#333';
  tip.style.color = swatch.style.getPropertyValue('--sw-fg').trim() || '#fff';
  const r = swatch.getBoundingClientRect();
  tip.style.left = `${Math.round(r.left + r.width / 2)}px`;
  tip.style.top = `${Math.round(r.top - 6)}px`;
  clearTimeout(swatchTipTimer);
  // The swatch can leave the DOM inside the delay (picking a colour closes the
  // grid), and a removed node fires no mouseout - so a tip must never appear
  // for a swatch that is no longer on the page.
  swatchTipTimer = setTimeout(() => { if (swatch.isConnected) tip.classList.add('is-shown'); }, 240);
}

function hideSwatchTip(): void {
  clearTimeout(swatchTipTimer);
  swatchTip?.classList.remove('is-shown');
}

/** Arm the delegated swatch-tooltip listeners once (idempotent across every wireColorField). */
function armSwatchTip(): void {
  if (swatchTipArmed) return;
  swatchTipArmed = true;
  document.addEventListener('mouseover', (e) => {
    const sw = (e.target as Element | null)?.closest<HTMLElement>('.color-swatch');
    if (sw) showSwatchTip(sw);
  });
  document.addEventListener('mouseout', (e) => {
    if ((e.target as Element | null)?.closest('.color-swatch')) hideSwatchTip();
  });
  // Picking a colour removes the swatch grid, and a removed node fires no
  // mouseout - the tip would strand over whatever the page shows next. Any
  // press drops it (capture, so it wins even when the click unmounts the
  // grid), and so does Esc closing the picker.
  document.addEventListener('pointerdown', hideSwatchTip, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideSwatchTip(); });
  // A fixed chip doesn't follow a scrolling swatch grid - drop it rather than strand it.
  window.addEventListener('scroll', hideSwatchTip, true);
}

/**
 * The viewport origin of the box a `position:fixed` descendant of `el` is laid out
 * against. `fixed` is viewport-relative ONLY when no ancestor establishes a containing
 * block - a `transform`, the individual `translate`/`scale`/`rotate` properties,
 * `perspective`, `filter`, `backdrop-filter`, `will-change`, or `contain` on an ancestor
 * all make `fixed` resolve against THAT box's padding edge instead. Two traps bite here:
 * the sidebar carries `backdrop-filter: blur()`, and every `.input-row` keeps a computed
 * `translate: 0px` from the `card-in` enter animation's `both` fill-mode - and a non-`none`
 * `translate` establishes a containing block even at zero (a computed value other than
 * `none`, not a visible offset, is the trigger). Either way a popover portalled to `fixed`
 * lands on the controls below its trigger. Callers subtract this origin so their
 * viewport-space coords stay correct; returns {0,0} (a no-op) when nothing traps `fixed`.
 */
export function fixedContainingBlockOrigin(el: HTMLElement): { x: number; y: number } {
  for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
    const s = getComputedStyle(a);
    const backdrop = s.backdropFilter || s.getPropertyValue('-webkit-backdrop-filter');
    // container-type: size/inline-size applies layout containment - a fixed containing
    // block - but computed `contain` does NOT reflect it, so it needs its own check
    // (e.g. the record tool's `.tool-stage.has-record { container-type: inline-size }`).
    const ctype = s.getPropertyValue('container-type');
    if (s.transform !== 'none' || s.translate !== 'none' || s.scale !== 'none' || s.rotate !== 'none' ||
        s.perspective !== 'none' || s.filter !== 'none' ||
        (backdrop && backdrop !== 'none') ||
        (ctype && ctype !== 'normal') ||
        /\b(transform|perspective|filter|translate|scale|rotate)\b/.test(s.willChange) ||
        /\b(strict|content|layout|paint)\b/.test(s.contain)) {
      const r = a.getBoundingClientRect();
      // Containing block is the ancestor's padding box, not its border box.
      return { x: r.left + (parseFloat(s.borderLeftWidth) || 0), y: r.top + (parseFloat(s.borderTopWidth) || 0) };
    }
  }
  return { x: 0, y: 0 };
}

// ── Repaint scheduling ───────────────────────────────────────────────────────
// A panel's tracks cost up to 4 channels × 24 samples × a conversion + a gamut
// test. The dragged channel's OWN track never changes (the other channels are
// held), so it is skipped - the old paintLch repainted all three for nothing - 
// and the rest is coalesced to one paint per frame. The state write and the emit
// stay synchronous with the event; only pixels wait.

interface PaintJob { spec: SpaceSpec; alpha: number; dials: boolean; skip?: string }
const PAINT_QUEUE = new Map<HTMLElement, PaintJob>();
let paintScheduled = false;

const nextFrame = (fn: () => void): void => {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fn);
  else setTimeout(fn, 0);
};

function schedulePaint(panel: HTMLElement, job: PaintJob): void {
  PAINT_QUEUE.set(panel, job);
  if (paintScheduled) return;
  paintScheduled = true;
  nextFrame(() => {
    paintScheduled = false;
    const jobs = [...PAINT_QUEUE];
    PAINT_QUEUE.clear();
    for (const [p, j] of jobs) paintTracks(p, j);
  });
}

/** Repaint a panel's channel tracks (and its dials) from PANEL_VALS. */
function paintTracks(panel: HTMLElement, { spec, alpha, dials, skip }: PaintJob): void {
  const vals = PANEL_VALS.get(panel);
  if (!vals) return;
  const runs = spec.channels.map(ch => (ch.ch === skip ? null : channelRuns(spec, ch, vals, alpha)));
  spec.channels.forEach((ch, i) => {
    const r = runs[i];
    if (!r) return;
    const slider = panel.querySelector<HTMLInputElement>(`[data-mode-ch="${cssEscape(ch.ch)}"]`);
    if (slider) slider.style.background = trackFromRuns(r);
  });
  if (!dials) return;
  // Every channel goes to paintDials, the skipped one included - with `runs: null`,
  // which repaints its needle and leaves its gradient. Dropping it here is how the
  // dragged channel's needle used to freeze while its slider moved, and how a dial
  // drag stopped following the finger on the very ring being dragged.
  paintDials(
    panel,
    spec.channels.map((ch, i) => {
      const { at } = pinValue(ch, vals[ch.ch] ?? ch.min);
      return { ch: ch.ch, label: ch.label, aria: ch.aria, frac: (at - ch.min) / (ch.max - ch.min || 1), runs: runs[i] ?? null };
    }),
    colorToHexString(composeColor(spec, vals, 1)),
  );
}

/** Sync the readouts (and the pin flag) - cheap, so it runs synchronously. */
function paintReadouts(panel: HTMLElement, spec: SpaceSpec, vals: Record<string, number>): boolean {
  let anyPinned = false;
  for (const ch of spec.channels) {
    const raw = vals[ch.ch] ?? ch.min;
    const { pinned } = pinValue(ch, raw);
    anyPinned = anyPinned || pinned;
    const out = panel.querySelector<HTMLElement>(`[data-mode-val="${cssEscape(ch.ch)}"]`);
    if (!out) continue;
    out.textContent = ch.fmt(raw);
    out.classList.toggle('is-clamped', pinned);
    out.title = pinned ? PIN_TITLE : '';
  }
  return anyPinned;
}

/**
 * Wire every colour field within `scope`. Calls onChange(id, value, detail) with
 * an sRGB value string (#rrggbb, #rrggbbaa, or 'transparent') plus the canonical
 * colour. The trigger preview + sibling controls are kept in sync so the field
 * reflects changes without the host needing to re-render.
 */
export function wireColorField(scope: HTMLElement, { onChange = () => {}, onInteractStart, onInteractEnd }: WireColorFieldOpts = {}): void {
  const interact = (on: boolean): void => { (on ? onInteractStart : onInteractEnd)?.(); };
  /** Fields whose FOCUS opened an interaction - so the matching release fires once,
   *  wherever inside the field the focus wandered first (see the focusout handler). */
  const FOCUS_HELD = new WeakSet<HTMLElement>();
  armSwatchTip();

  const stateOf = (field: HTMLElement | null): FieldColorState | null => (field ? STATE.get(field) ?? null : null);

  /** The space the field is currently editing in. */
  const activeSpec = (field: HTMLElement): SpaceSpec => {
    const st = STATE.get(field);
    return getColorSpace(st?.mode ?? DEFAULT_COLOR_MODE) ?? getColorSpace('oklch')!;
  };

  /** The panel for the field's active mode - NOT `:not([hidden])`: a popover whose
   *  sliders have not been expanded yet still has to be kept in step, or opening
   *  them later shows a stale colour. */
  const activePanel = (field: HTMLElement, spec: SpaceSpec): HTMLElement | null =>
    field.querySelector<HTMLElement>(`[data-space-group="${cssEscape(spec.mode)}"]`);

  const wantsDials = (panel: HTMLElement): boolean => Boolean(panel.querySelector('.color-dials'));

  /** A panel's display values - cached, because re-decomposing mid-drag makes a
   *  lossy space (CMYK's K) jump under the user's hand. */
  const panelVals = (panel: HTMLElement, spec: SpaceSpec, st: FieldColorState): Record<string, number> => {
    const cached = PANEL_VALS.get(panel);
    if (cached) return cached;
    const vals = decomposeColor(spec, st.color, st.lastHue);
    PANEL_VALS.set(panel, vals);
    return vals;
  };

  /** Re-seed a panel from a colour: display values, slider positions (pinned),
   *  readouts, tracks, dials. Never emits. */
  const seedPanel = (panel: HTMLElement, spec: SpaceSpec, color: CssColor, lastHue: number): void => {
    const vals = decomposeColor(spec, color, lastHue);
    PANEL_VALS.set(panel, vals);
    for (const ch of spec.channels) {
      const slider = panel.querySelector<HTMLInputElement>(`[data-mode-ch="${cssEscape(ch.ch)}"]`);
      if (slider) slider.value = num(pinValue(ch, vals[ch.ch] ?? ch.min).at);
    }
    paintReadouts(panel, spec, vals);
    paintTracks(panel, { spec, alpha: clamp01(color.alpha), dials: wantsDials(panel) });
  };

  // ── The caution line ───────────────────────────────────────────────────────
  const NOTE_MS = 300;
  const NOTES = new WeakMap<HTMLElement, { last: string; at: number; timer?: ReturnType<typeof setTimeout> }>();

  const noteText = (spec: SpaceSpec, st: FieldColorState, pinned: boolean): string => {
    if (st.kind === 'transparent') return `${spec.label} - transparent`;
    // The pin explains what the user can SEE, so it leads.
    if (pinned) return pinNote(spec.label);
    if (!spaceInGamut(spec, st.color)) {
      const ink = spaceInkCoverage(spec, st.color);
      const label = limitLabel(spec.limit);
      return ink == null ? `Outside ${label}` : `Outside ${label} - ${Math.round(ink * 100)}% ink`;
    }
    return `${spec.label} - ${spaceExactness(spec, st.color) === 'exact' ? 'exact' : 'approximated from a wider colour'}`;
  };

  /**
   * Write the caution line. A slider drag is throttled to one update every NOTE_MS;
   * a SPACE SWITCH passes `now` and jumps the queue, because the line names the space
   * and it is `role="status"` - deferring it makes assistive tech announce the space
   * the user just left, and an arrow-key walk across the strip announces nothing but
   * the first step.
   *
   * Two orderings matter. A pending write is cancelled BEFORE the identical-text
   * early return: without that, going out of gamut → in → out inside 300ms left the
   * superseded "exact" write queued, and it landed on top of a colour that is not
   * exact and stayed there. And `at` is stamped only by a THROTTLED write, so an
   * immediate one cannot prime the throttle against the next switch.
   */
  const setNote = (field: HTMLElement, text: string, now = false): void => {
    const el = field.querySelector<HTMLElement>('[data-color-note]');
    if (!el) return;
    let rec = NOTES.get(field);
    if (!rec) { rec = { last: '', at: 0 }; NOTES.set(field, rec); }
    const r = rec;
    if (r.timer) { clearTimeout(r.timer); r.timer = undefined; }
    if (text === r.last) return;
    const write = (throttled: boolean): void => {
      r.timer = undefined;
      if (text === r.last) return;
      r.last = text;
      if (throttled) r.at = Date.now();
      el.hidden = text.length === 0;
      el.textContent = text;
    };
    const wait = now ? 0 : NOTE_MS - (Date.now() - r.at);
    if (wait <= 0) write(!now);
    else r.timer = setTimeout(() => write(true), wait);
  };

  // ── Projections of the state ──────────────────────────────────────────────
  /**
   * Paint the alpha track: this colour fading to nothing, over the checkerboard.
   *
   * The slider is otherwise identical to its channel siblings above it, and it used
   * to be a 4px native rail with `accent-color` - which made the one control whose
   * subject IS transparency the only one that showed you nothing about it. The two
   * custom properties are the gradient's ends; the checkerboard lives in CSS
   * because it never changes.
   */
  const paintAlphaTrack = (field: HTMLElement, fullHex: string): void => {
    const slider = field.querySelector<HTMLElement>('.color-alpha-slider');
    if (!slider) return;
    const rgb = alphaTrackHex(fullHex);
    slider.style.setProperty('--alpha-from', `${rgb}00`);
    slider.style.setProperty('--alpha-to', `${rgb}ff`);
  };

  /**
   * The text the value field shows.
   *
   * Advanced editors use the ACTIVE space's notation.
   * Compact pickers retain a hex: those hosts (the sidebar, the /pro grid, free-canvas) render
   * a ~150px field whose placeholder is `#rrggbbaa`, and writing `oklch(70.085%
   * 0.15123 157.2 / 0.7843)` into it left the user unable to re-enter the string the
   * component itself had just written.
   *
   * `textFrom` wins where a space has one and the panel is holding display values:
   * CMYK→RGB is many-to-one, so a fresh decomposition would state a different ink
   * split from the sliders the user is looking at.
   */
  const valueText = (field: HTMLElement, st: FieldColorState): string => {
    if (st.kind === 'transparent') return 'transparent';
    if (field.dataset.colorNotation !== 'space') return bakedHex(st);
    const spec = activeSpec(field);
    const panel = activePanel(field, spec);
    const vals = panel ? PANEL_VALS.get(panel) : undefined;
    return spec.textFrom && vals ? spec.textFrom(vals, clamp01(st.color.alpha)) : spaceText(spec, st.color);
  };

  /** Flag text that did not parse. Live-marked while typing rather than only on
   *  commit, and cleared the moment something readable arrives; the field keeps the
   *  characters either way (mid-edit text is the user's, not ours to rewrite). */
  const markInvalid = (input: HTMLInputElement | null, on: boolean): void => {
    if (!input) return;
    if (on) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
    input.classList.toggle('color-input--invalid', on);
  };

  /** Write the value field - in the notation valueText picks. Never clobbers its
   *  TEXT while the user is typing in it, but always repaints its swatch chrome. */
  const writeValueField = (field: HTMLElement, st: FieldColorState): void => {
    const input = field.querySelector<HTMLInputElement>('.color-input[data-color-hex]');
    const hex = bakedHex(st);
    paintColorInput(input, hex);
    paintAlphaTrack(field, hex);
    if (!input || input === document.activeElement) return;
    const text = valueText(field, st);
    input.value = text;
    input.title = text;
    input.classList.toggle('color-input--long', text.length > LONG_VALUE);
    markInvalid(input, false);       // whatever was in there, this text parses
  };

  const syncNative = (field: HTMLElement, st: FieldColorState): void => {
    // Write-only: the OS picker's own control can hold nothing but #rrggbb, so it
    // is kept in step for the (never-opened) native dialog and never READ back.
    const native = field.querySelector<HTMLInputElement>('input.color-popover-native');
    if (native) native.value = bakedHex(st).slice(0, 7);
  };

  const syncAlphaRow = (field: HTMLElement, st: FieldColorState): void => {
    const byte = st.kind === 'transparent' ? 0 : Math.round(clamp01(st.color.alpha) * 255);
    const slider = field.querySelector<HTMLInputElement>('.color-alpha-slider');
    const pct = field.querySelector<HTMLElement>('.color-alpha-pct');
    if (slider) slider.value = String(byte);
    if (pct) pct.textContent = `${Math.round(byte / 255 * 100)}%`;
  };

  function updateTrigger(field: HTMLElement, value: string): void {
    const preview = field.querySelector<HTMLElement>('.color-trigger-preview');
    const nameText = field.querySelector<HTMLElement>('.color-trigger-name');
    const isTrans = value === 'transparent';
    if (preview) {
      preview.classList.toggle('color-swatch--transparent', isTrans);
      preview.style.background = isTrans ? '' : (value || '#000000');
    }
    const name = swatchName(value);
    if (nameText) nameText.textContent = name;             // :empty CSS hides it for custom colours
    const trigger = field.querySelector('.color-trigger');
    // The host's own label rides on the field (data-color-label) rather than in a
    // closure, so this rewrite - which runs on every edit - cannot drop it.
    if (trigger) trigger.setAttribute('aria-label', triggerAria(field.dataset.colorLabel || '', name, value || '#000000'));
    updateNearest(field, value);
  }

  // ── Nearest-brand hint ("Snap to Jungle") ────────────────────────────────────
  // A custom colour that lands NEAR a brand swatch is usually a drifted brand
  // colour - offer the snap. Shown only when the value is not already a swatch
  // (ΔEOK > a rounding hair) and the nearest one is close enough to be the
  // intended colour (≤ 0.12 ≈ clearly-related); clicking re-emits through
  // applySwatch, so a token-backed swatch RE-LINKS the value to its ref.
  function updateNearest(field: HTMLElement, value: string): void {
    const btn = field.querySelector<HTMLElement>('.color-nearest');
    if (!btn) return;
    const near = value && value !== 'transparent' ? nearestSwatch(value) : null;
    if (!near || near.d < 0.005 || near.d > 0.12) { btn.hidden = true; return; }
    btn.hidden = false;
    btn.dataset.nearValue = near.value;
    btn.dataset.nearRef = near.ref ?? '';
    const chip = safeCssColor(near.value) || '#c9ccd1';
    btn.innerHTML = `<span class="color-nearest-chip" style="background:${escape(chip)}" aria-hidden="true"></span><span>Snap to ${escape(near.label)}</span>`;
    btn.title = `Nearest brand colour (ΔE ${near.d.toFixed(3)}) - use ${near.label}`;
  }

  // ── THE one emit ──────────────────────────────────────────────────────────
  /**
   * The ONLY place onChange is called. Reachable exclusively from a pointer /
   * keyboard / `input` / click handler - never from selectMode, onSelect, a seed*
   * or a paint*. See the module header: a mount-time emit made every Colour Lab
   * colour report "sRGB", and jsdom cannot catch it for us.
   */
  const emit = (field: HTMLElement): void => {
    const st = STATE.get(field);
    if (!st) return;
    const { value, detail } = bake(st);
    onChange(field.dataset.colorField ?? '', st.ref ? { ref: st.ref, value } : value, detail);
  };

  /**
   * Everything that follows a real edit, once the state has been written: the
   * handoff attribute, the sibling controls, the trigger, the visible panel, the
   * caution line, then the emit. `owner` is the panel currently being dragged - 
   * it owns its own display values, so it must not be re-seeded from the colour
   * (that is what makes a lossy space stable under the hand). Every other
   * projection is idempotent, so it is written unconditionally.
   */
  const afterEdit = (field: HTMLElement, st: FieldColorState, owner?: HTMLElement): void => {
    const { value, detail } = bake(st);
    field.dataset.colorCanon = detail.css;
    syncNative(field, st);
    syncAlphaRow(field, st);
    writeValueField(field, st);
    updateTrigger(field, value);
    const spec = activeSpec(field);
    const panel = activePanel(field, spec);
    let pinned = false;
    // panelSeed, not st.color: a transparent state has no axes worth showing, and
    // seeding the sliders from its alpha-0 black is the dead-hue start panelSeed
    // exists to avoid. The mode-switch path already went through it, so a
    // transparent field showed two different slider sets depending on which path
    // re-seeded it last.
    if (panel && panel !== owner) seedPanel(panel, spec, panelSeed(field, st), st.lastHue);
    if (panel) {
      const vals = PANEL_VALS.get(panel);
      pinned = vals ? spec.channels.some(ch => pinValue(ch, vals[ch.ch] ?? ch.min).pinned) : false;
    }
    setNote(field, noteText(spec, st, pinned));
    emit(field);
  };

  /** Replace the field's colour wholesale (swatch, typed value, eyedropper, native). */
  const applyColor = (field: HTMLElement, next: { kind: 'color' | 'transparent'; color: CssColor; ref: string | null }): void => {
    const st = STATE.get(field);
    if (!st) return;
    st.kind = next.kind;
    st.color = next.color;
    st.ref = next.ref;
    const h = hueOf(next.color);
    if (h != null) st.lastHue = h;
    afterEdit(field, st);
  };

  scope.querySelectorAll<HTMLElement>('.color-nearest').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.closest<HTMLElement>('[data-color-field]');
      const value = btn.dataset.nearValue;
      if (field && value) applySwatch(field, value, btn.dataset.nearRef || null);
    });
  });

  /** Seed the nearest-brand hint from the field's own colour when the popover
   *  opens - updateTrigger only runs on later edits. */
  function seedNearest(field: HTMLElement | null): void {
    const st = stateOf(field);
    if (field && st) updateNearest(field, bakedHex(st));
  }

  // ── Palette swatches (lazy) ──────────────────────────────────────────────────
  // Apply a swatch's colour to the field, syncing the popover controls + trigger.
  // A swatch carrying a token `ref` emits a token value ({ ref, value }) so the
  // colour stays linked to the token; a plain swatch emits the value string.
  // Editing the value/native/alpha afterwards clears the ref, de-linking.
  function applySwatch(field: HTMLElement, value: string, ref: string | null = null): void {
    const transparent = String(value).trim().toLowerCase() === 'transparent';
    const parsed = transparent ? TRANSPARENT : parseColor(value);
    if (!parsed) return;
    applyColor(field, { kind: transparent ? 'transparent' : 'color', color: parsed, ref });
  }

  // Build the swatch grid the first time a field's popover opens - deferring the
  // whole palette (the heaviest part of each colour cell) until it's needed.
  // Clicks are DELEGATED to the (persistent) box, so the grid can be repopulated
  // later (refreshSwatches, when the brand palette changes) without re-wiring.
  function buildSwatches(field: HTMLElement, force = false): void {
    const box = field.querySelector<HTMLElement>('.color-swatches');
    if (!box || (!force && box.childElementCount)) return; // already built
    box.innerHTML = swatchButtonsHtml(field.dataset.colorField!);
    if (!box.dataset.wired) {
      box.dataset.wired = '1';
      box.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-swatch-value]');
        if (!btn) return;
        applySwatch(field, btn.dataset.swatchValue!, btn.dataset.swatchRef || null);
        // Picking from the disc's swatch menu closes it - a menu, not a panel.
        closeSwatchMenu(field);
      });
    }
  }

  // ── The result disc's swatch menu (inline pickers) ───────────────────────────
  // The disc's edit action opens the brand swatch grid as a floating menu below
  // the disc, reusing buildSwatches/applySwatch. Anchored via offsetTop/Left, so
  // the popover it lives in is the positioned ancestor (CSS makes it relative).
  let swatchMenuOff: (() => void) | null = null;
  function closeSwatchMenu(field: HTMLElement): void {
    const menu = field.querySelector<HTMLElement>('[data-swatch-menu]');
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    // Every space panel carries its own disc, so clear the flag on all of them.
    field.querySelectorAll('[data-dial-act="native"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    if (swatchMenuOff) { swatchMenuOff(); swatchMenuOff = null; }
  }
  function toggleSwatchMenu(field: HTMLElement, menu: HTMLElement, btn: HTMLElement): void {
    if (!menu.hidden) { closeSwatchMenu(field); return; }
    buildSwatches(field);
    // Anchor to the VISIBLE panel's disc - a hidden panel's offsets are zero.
    const disc = field.querySelector<HTMLElement>('[data-space-group]:not([hidden]) [data-dial-out]')
      ?? field.querySelector<HTMLElement>('[data-dial-out]');
    if (disc) { menu.style.top = `${disc.offsetTop + disc.offsetHeight + 6}px`; menu.style.left = `${disc.offsetLeft}px`; }
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    // Close on Escape or a click outside the menu (not on the toggle, which handles
    // its own toggle). Deferred so THIS opening click doesn't immediately close it.
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { closeSwatchMenu(field); e.stopPropagation(); } };
    const onDown = (e: PointerEvent): void => {
      const tgt = e.target as Node;
      if (!menu.contains(tgt) && !btn.contains(tgt)) closeSwatchMenu(field);
    };
    setTimeout(() => {
      document.addEventListener('pointerdown', onDown, true);
      document.addEventListener('keydown', onKey, true);
    }, 0);
    swatchMenuOff = () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }

  // ── Seed each field's state from the server-render handoff ───────────────────
  // data-color-canon is the authority (S1–S4/S7 used to be: the native input, the
  // hex text, the alpha slider, the OKLCH dataset - four places to disagree).
  // Re-parsed with the engine's STRICT parseColor, so an unreadable attribute
  // yields black rather than a guess.
  scope.querySelectorAll<HTMLElement>('[data-color-field]').forEach(field => {
    const canon = (field.dataset.colorCanon ?? '').trim();
    const transparent = canon.toLowerCase() === 'transparent';
    const parsed = transparent ? TRANSPARENT : (canon ? parseColor(canon) : null);
    const color = parsed ?? BLACK;
    const modesEl = field.querySelector<HTMLElement>('.color-modes');
    const mode = (modesEl?.dataset.activeMode as ColorMode | undefined) ?? DEFAULT_COLOR_MODE;
    STATE.set(field, {
      kind: transparent ? 'transparent' : 'color',
      color,
      mode: getColorSpace(mode) ? mode : DEFAULT_COLOR_MODE,
      lastHue: hueOf(color) ?? SEED.components[2],
      ref: null,
    });
  });

  // Inline fields have no trigger, so the on-open hooks below never fire - seed
  // their nearest-brand hint and any explicitly requested palette up front.
  scope.querySelectorAll<HTMLElement>('.color-field--inline[data-color-field]').forEach(f => {
    seedNearest(f);
    if (f.classList.contains('color-field--palette')) buildSwatches(f);
  });

  // ── The Fine-tune fold ───────────────────────────────────────────────────────
  // The popover leads with the palette; value/eyedropper/sliders/alpha wait
  // behind this fold. No reposition on toggle: positioning already reserved the
  // expanded height (measuredFullHeight), so the section grows into held space.
  const setFine = (field: HTMLElement, open: boolean): void => {
    const fine = field.querySelector<HTMLElement>('[data-color-fine]');
    const toggle = field.querySelector<HTMLElement>('[data-color-fine-toggle]');
    if (!fine || !toggle) return;
    fine.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  };
  scope.querySelectorAll<HTMLElement>('[data-color-fine-toggle]').forEach(toggle => {
    const field = toggle.closest<HTMLElement>('[data-color-field]');
    if (!field) return;
    toggle.addEventListener('click', () => {
      const fine = field.querySelector<HTMLElement>('[data-color-fine]');
      if (fine) setFine(field, fine.hidden);
    });
  });
  // A colour the palette cannot produce opens the fold by itself: that user is
  // already in fine territory, and a grid with nothing selected explains less
  // than the value field does. Sticky - an expanded fold never re-collapses on
  // reopen (same instance rule the old slider reveal had).
  const autoExpandFine = (field: HTMLElement): void => {
    const fine = field.querySelector<HTMLElement>('[data-color-fine]');
    if (!fine || !fine.hidden) return;                 // absent (swatchesOnly) or already open
    const st = STATE.get(field);
    const v = st ? (st.kind === 'transparent' ? 'transparent' : bakedHex(st)) : (field.dataset.colorCanon ?? '');
    const isSwatch = v === 'transparent' || (!!v && (nearestSwatch(v)?.d ?? 1) < 0.005);
    if (!SWATCHES.length || !isSwatch) setFine(field, true);
  };

  // ── Trigger: open/close the popover ──────────────────────────────────────────
  scope.querySelectorAll<HTMLElement>('[data-color-trigger]').forEach(trigger => {
    const field = trigger.closest<HTMLElement>('[data-color-field]');
    trigger.addEventListener('click', () => {
      const popover = field?.querySelector<HTMLElement>('.color-popover');
      if (!popover) return;
      scope.querySelectorAll<HTMLElement>('.color-popover:not([hidden])').forEach(p => {
        if (p !== popover && !p.closest('.color-field--inline')) {
          p.hidden = true; p.style.cssText = '';
          p.closest('[data-color-field]')?.querySelector('.color-trigger')?.setAttribute('aria-expanded', 'false');
        }
      });
      popover.hidden = !popover.hidden;
      trigger.setAttribute('aria-expanded', String(!popover.hidden));
      if (popover.hidden) { popover.style.cssText = ''; disarmOutside(); }
      else { buildSwatches(field!); seedNearest(field); autoExpandFine(field!); positionPopover(field!, trigger, popover); }
    });

    // Escape closes this field's open popover and returns focus to the trigger.
    // Bound to the field (re-created on each render) - not the persistent scope - 
    // so re-wiring on re-render doesn't accumulate listeners.
    field?.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const popover = field.querySelector<HTMLElement>('.color-popover:not([hidden])');
      if (!popover) return;
      popover.hidden = true; popover.style.cssText = ''; disarmOutside();
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
      e.stopPropagation();
    });
  });

  // Off-screen height of the popover measured as if the collapsed sliders were EXPANDED.
  // Positioning uses this so the popover opens in the direction its full (expanded) size fits
  // and reserves that room - then revealing the sliders (value-field focus) grows into the
  // reserved space and NEVER re-positions. Repositioning on reveal was the cause of both the
  // "swatch component jumps" flip and the "clicking a slider closes the picker" miss (the
  // popover moved out from under the pointer between press and release).
  function measuredFullHeight(popover: HTMLElement, width: number): number {
    const fine = popover.querySelector<HTMLElement>('[data-color-fine][hidden]');
    if (fine) fine.hidden = false;                     // measure the expanded height
    const prev = popover.style.cssText;
    popover.style.cssText = `position:fixed;visibility:hidden;left:-9999px;top:0;width:${width}px;`;
    const h = popover.offsetHeight;
    popover.style.cssText = prev;
    if (fine) fine.hidden = true;                      // restore the collapsed render
    return h;
  }

  function positionPopover(field: HTMLElement, trigger: HTMLElement, popover: HTMLElement): void {
    // Force-settle any in-flight entrance cascade on the field's ancestors first: while
    // `card-in` is running, the animated `translate` makes that ancestor the popover's
    // containing block - mispositioned AND clipped by the section - and the trap would
    // flip anyway (a visible jump) the moment the animation ends. Stripping .reveal-item
    // cancels the animation and snaps the item straight to its natural (settled) state.
    for (let a = field.closest<HTMLElement>('.reveal-item'); a;
         a = a.parentElement ? a.parentElement.closest<HTMLElement>('.reveal-item') : null) {
      a.classList.remove('reveal-item');
      a.style.removeProperty('--reveal-delay');
    }
    // We compute viewport-space coords below, then translate into the box `fixed`
    // is actually laid out against (the sidebar's backdrop-filter traps it - see
    // fixedContainingBlockOrigin). `cb` is {0,0} when `fixed` is truly viewport-relative.
    const cb = fixedContainingBlockOrigin(popover);
    const sidebar = scope.closest('.sidebar-body') || scope.closest('.sidebar');
    const isFloat = field.classList.contains('color-field--float');
    const isBlock = field.classList.contains('block-color-field');
    const anchor = (isFloat ? trigger.closest('td') || trigger : field).getBoundingClientRect();
    const side = isBlock ? sidebar?.getBoundingClientRect() : null;
    // Even a dot-only toolbar button opens a usable picker. All three hosts share
    // viewport bounds; the full panel can scroll on a short screen.
    const width = Math.min(Math.max(264, side ? side.width - 28 : Math.round(anchor.width)), Math.max(1, window.innerWidth - 16));
    const left = Math.max(8, Math.min(side ? side.left + 14 : anchor.left, window.innerWidth - width - 8));
    const height = Math.min(measuredFullHeight(popover, width), window.innerHeight - 16);
    const bottomLimit = Math.min(window.innerHeight, sidebar?.getBoundingClientRect().bottom ?? window.innerHeight);
    const openUp = bottomLimit - anchor.bottom < height + 10;
    const proposedTop = isFloat ? anchor.top : openUp ? anchor.top - 4 - height : anchor.bottom + 4;
    const top = Math.max(8, Math.min(proposedTop, window.innerHeight - height - 8));
    const docked = isFloat && Math.abs(top - anchor.top) < 1;
    popover.style.cssText = `position:fixed;top:${Math.round(top - cb.y)}px;left:${Math.round(left - cb.x)}px;width:${width}px;max-height:${Math.max(1, window.innerHeight - top - 8)}px;right:auto;z-index:10001;${docked ? 'border-top-left-radius:0;' : ''}`;
    armOutside(field, popover);
  }

  // Outside-click / scroll close (float + regular sidebar fields, both position:fixed).
  let outside: ((e: PointerEvent) => void) | null = null;
  let onScroll: ((e: Event) => void) | null = null;
  let onDocKey: ((e: KeyboardEvent) => void) | null = null;
  function armOutside(field: HTMLElement, popover: HTMLElement): void {
    disarmOutside();
    const close = (): void => { popover.hidden = true; popover.style.cssText = ''; field.querySelector('.color-trigger')?.setAttribute('aria-expanded', 'false'); disarmOutside(); };
    outside = (e) => { if (!field.contains(e.target as Node | null)) close(); };
    // A fixed popover doesn't follow the field - close it on scroll rather than leave it
    // stranded over unrelated controls (capture catches the sidebar's own scroll). BUT don't
    // close while the user is actively inside the popover: pressing a range slider (or the value
    // input) can trigger a browser scroll-into-view, and closing on THAT dropped the picker
    // out from under a slider drag ("clicking the sliders just closes it"). Focus inside the
    // popover ⇒ the scroll is the interaction's own, not a dismiss.
    onScroll = (e) => {
      // Wheel/touch scrolling does not necessarily focus a swatch. Test the scroll
      // source itself so the palette never dismisses its own popover.
      if (e.target instanceof Node && popover.contains(e.target)) return;
      if (popover.contains(document.activeElement)) return;
      close();
    };
    // Escape closes even when focus never entered the field - the canvas-anchored
    // popover opens from a control-point tap that leaves focus on the canvas, so
    // the field-level Escape handler above cannot see the key. Bubble phase, so
    // the field handler (which also restores focus to the trigger) wins when
    // focus IS inside and stops propagation before this one runs.
    onDocKey = (e) => { if (e.key === 'Escape') close(); };
    setTimeout(() => {
      // CAPTURE, not bubble: canvas control-point layers stop pointerdown
      // propagation for their own drag handling, which starved a bubble-phase
      // listener and left the popover stranded on the last selected point.
      document.addEventListener('pointerdown', outside!, true);
      document.addEventListener('keydown', onDocKey!);
      window.addEventListener('scroll', onScroll!, true);
    }, 0);
  }
  function disarmOutside(): void {
    if (outside) { document.removeEventListener('pointerdown', outside, true); outside = null; }
    if (onDocKey) { document.removeEventListener('keydown', onDocKey); onDocKey = null; }
    if (onScroll) { window.removeEventListener('scroll', onScroll, true); onScroll = null; }
  }

  // ── Channel sliders (every space, one handler) ───────────────────────────────
  // A drag reads the panel's display values, writes the dragged channel, composes
  // straight to a CssColor and assigns it. There is no hex in this path, which is
  // why the old low-chroma hue drift cannot come back - and why it cannot appear
  // in any of the other spaces with a hue either.
  scope.querySelectorAll<HTMLElement>('[data-space-group]').forEach(panel => {
    const field = panel.closest<HTMLElement>('[data-color-field]');
    const spec = getColorSpace(panel.dataset.spaceGroup ?? '');
    if (!field || !spec) return;
    const dials = wantsDials(panel);
    panel.querySelectorAll<HTMLInputElement>('input[data-mode-ch]').forEach(slider => {
      const ch = spec.channels.find(c => c.ch === slider.dataset.modeCh);
      if (!ch) return;
      slider.addEventListener('pointerdown', () => interact(true));
      slider.addEventListener('pointerup', () => interact(false));
      slider.addEventListener('input', () => {
        const st = STATE.get(field);
        if (!st) return;
        const vals = { ...panelVals(panel, spec, st) };
        const raw = parseFloat(slider.value);
        vals[ch.ch] = Number.isFinite(raw) ? raw : ch.min;
        PANEL_VALS.set(panel, vals);
        // Hue memory is written from the hue slider, and only ever READ for a
        // colour whose hue is powerless. Never the other way round.
        if (ch.hue) st.lastHue = vals[ch.ch]!;
        st.kind = 'color';
        st.color = composeColor(spec, vals, st.color.alpha);
        st.ref = null;                                   // a manual edit de-links from the token
        paintReadouts(panel, spec, vals);
        schedulePaint(panel, { spec, alpha: clamp01(st.color.alpha), dials, skip: ch.ch });
        afterEdit(field, st, panel);
      });
    });
  });

  // ── Dials ────────────────────────────────────────────────────────────────────
  // A dial never emits a colour itself: it converts the pointer's angle to a value
  // and drives the slider for that channel, whose `input` handler already owns the
  // whole path. One control of record per channel; the dial is a second way to move
  // it. The output disc's two halves delegate to the eyedropper button the popover
  // already carries and to the swatch menu. No-ops where no dials render - the row
  // simply isn't there.
  scope.querySelectorAll<HTMLElement>('.color-dials').forEach(row => {
    const field = row.closest<HTMLElement>('[data-color-field]');
    const panel = row.closest<HTMLElement>('[data-space-group]');

    row.querySelectorAll<HTMLElement>('.color-dial').forEach(dial => {
      const ch = dial.dataset.dialCh!;
      const slider = panel?.querySelector<HTMLInputElement>(`[data-mode-ch="${cssEscape(ch)}"]`);
      if (!slider) return;
      const min = parseFloat(slider.min || '0');
      const max = parseFloat(slider.max || '1');

      // Angle → value, measured the same way the needle and the conic are: 0° at
      // 12 o'clock, clockwise. A non-circular range's two ends meet at the top, so
      // a drag across that seam jumps min↔max - inherent to putting a linear axis
      // on a ring, and precisely why the slider stays.
      const setFromPointer = (e: PointerEvent): void => {
        const r = dial.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        let ang = Math.atan2(dx, -dy) * 180 / Math.PI;
        if (ang < 0) ang += 360;
        slider.value = String(min + (ang / 360) * (max - min)); // the range input snaps to its own step
        slider.dispatchEvent(new Event('input'));
      };

      dial.addEventListener('pointerdown', e => {
        dial.setPointerCapture(e.pointerId);
        interact(true);
        setFromPointer(e);
        e.preventDefault(); // don't take focus off the slider / start a text selection
      });
      dial.addEventListener('pointermove', e => {
        if (dial.hasPointerCapture(e.pointerId)) setFromPointer(e);
      });
      const release = (e: PointerEvent): void => {
        if (!dial.hasPointerCapture(e.pointerId)) return;
        dial.releasePointerCapture(e.pointerId);
        interact(false);
      };
      dial.addEventListener('pointerup', release);
      dial.addEventListener('pointercancel', release);
    });

    row.querySelectorAll<HTMLElement>('.color-dial-act').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.dialAct === 'eyedropper') { field?.querySelector<HTMLButtonElement>('.color-eyedropper')?.click(); return; }
        // The edit half opens the swatch context menu. Dials render only where that
        // menu exists (the inline panel), so there is no other case to fall back to.
        const menu = field?.querySelector<HTMLElement>('[data-swatch-menu]');
        if (menu && field) toggleSwatchMenu(field, menu, btn);
      });
    });
  });

  // ── The space tab strip ──────────────────────────────────────────────────────
  // ONE wireTabs call for the whole strip: one tab stop, one roving tabindex, and
  // arrows that cross family boundaries in DOM order. A mode switch is cheap and,
  // critically, emits NOTHING - it changes which numbers you are looking at, not
  // the colour.
  scope.querySelectorAll<HTMLElement>('.color-modes[data-color-modes]').forEach(modes => {
    const field = modes.closest<HTMLElement>('[data-color-field]');
    if (!field) return;
    const panels = [...modes.querySelectorAll<HTMLElement>('[data-space-group]')];
    const selectMode = wireTabs(modes, {
      key: 'mode',
      onSelect: (value) => {
        const st = STATE.get(field);
        const spec = getColorSpace(value);
        if (!st || !spec) return;
        st.mode = spec.mode;
        modes.dataset.activeMode = spec.mode;
        for (const p of panels) p.hidden = p.dataset.spaceGroup !== spec.mode;
        const panel = panels.find(p => p.dataset.spaceGroup === spec.mode);
        if (panel) {
          // Re-decompose only when the panel's cached display values no longer
          // describe the colour. CMYK→RGB is many-to-one, so discarding them on
          // every switch rewrote a dragged ink split (c=m=y=100% k=38% became
          // 0/0/0/100%) on a round trip in which the user edited nothing.
          const cached = PANEL_VALS.get(panel);
          const describes = cached && st.kind === 'color'
            && sameColor(composeColor(spec, cached, clamp01(st.color.alpha)), st.color);
          if (describes) {
            paintReadouts(panel, spec, cached!);
            paintTracks(panel, { spec, alpha: clamp01(st.color.alpha), dials: wantsDials(panel) });
          } else {
            PANEL_VALS.delete(panel);
            seedPanel(panel, spec, panelSeed(field, st), st.lastHue);
          }
        }
        writeValueField(field, st);                 // reformat the value field into the new space
        const vals = panel ? PANEL_VALS.get(panel) : undefined;
        setNote(field, noteText(spec, st, vals ? spec.channels.some(c => pinValue(c, vals[c.ch] ?? c.min).pinned) : false), true);
      },
    });
    // Establish the roving tabindex for the server-rendered active mode and seed
    // that panel. This runs at WIRE time, so it must not emit - and does not.
    selectMode(modes.dataset.activeMode ?? DEFAULT_COLOR_MODE);
  });

  // ── Native colour input ──────────────────────────────────────────────────────
  // The progressive inline pose surfaces a button for this OS picker; the input
  // itself remains visually hidden so browser-native chrome never disrupts the
  // component layout. Every other pose continues to treat it as write-only.
  scope.querySelectorAll<HTMLButtonElement>('[data-color-native-button]').forEach(btn => {
    const field = btn.closest<HTMLElement>('[data-color-field]');
    const native = field?.querySelector<HTMLInputElement>('input.color-popover-native');
    if (!native) { btn.remove(); return; }
    btn.addEventListener('click', () => native.click());
  });
  scope.querySelectorAll<HTMLInputElement>('input.color-popover-native[data-input-id]').forEach(native => {
    const field = native.closest<HTMLElement>('[data-color-field]');
    if (!field) return;
    native.addEventListener('pointerdown', () => interact(true));
    native.addEventListener('pointerup', () => interact(false));
    native.addEventListener('input', () => {
      const st = STATE.get(field);
      const parsed = parseColor(native.value);
      if (!st || !parsed) return;
      applyColor(field, { kind: 'color', color: { ...parsed, alpha: st.kind === 'transparent' ? 1 : st.color.alpha }, ref: null });
    });
  });

  // ── Screen eyedropper ────────────────────────────────────────────────────────
  // The EyeDropper API's overlay samples ANYWHERE on screen - other windows and
  // the desktop included, not just this page (Chromium; secure contexts). Where
  // it doesn't exist the action opens the system colour picker instead. The picked colour applies exactly like a swatch: current
  // alpha kept, sliders re-seeded, trigger + host notified. The OS overlay swallows
  // pointer events, so the popover's close-on-outside never fires mid-pick;
  // interact() still brackets it like a slider drag so hosts hold their
  // popover/undo grouping open.
  scope.querySelectorAll<HTMLButtonElement>('.color-eyedropper[data-color-eyedropper]').forEach(btn => {
    const field = btn.closest<HTMLElement>('[data-color-field]');
    if (!field) return;
    btn.addEventListener('click', async () => {
      // Decide at click time so a tool canvas that mounted after this field still
      // counts. Where the browser has NO EyeDropper (iOS/Android/every WebView) AND
      // there is no creative surface to sample, keep the button useful by opening
      // the OS colour panel rather than doing nothing (plan 216 item 8). Otherwise
      // pickColor uses native EyeDropper when present, else the loupe over the
      // tool canvas - the phone path: a colour off your own artwork.
      const hasNative = typeof (window as { EyeDropper?: unknown }).EyeDropper === 'function';
      if (!hasNative && !document.querySelector('#tool-canvas, .tool-canvas, #tool-content')) {
        field.querySelector<HTMLInputElement>('input.color-popover-native')?.click();
        return;
      }
      interact(true);
      try {
        const { pickColor } = await import('../lib/eyedropper.ts');
        const hex = await pickColor();
        const picked = hex ? parseColor(hex) : null;
        const st = STATE.get(field);
        if (picked && st) {
          applyColor(field, { kind: 'color', color: { ...picked, alpha: st.kind === 'transparent' ? 1 : st.color.alpha }, ref: null });
        }
      } catch { /* dismissed / no surface - nothing picked */ }
      finally { interact(false); }
    });
  });

  // ── Value text entry ─────────────────────────────────────────────────────────
  scope.querySelectorAll<HTMLInputElement>('.color-input[data-color-hex]').forEach(input => {
    const field = input.closest<HTMLElement>('[data-color-field]');
    if (!field) return;
    input.addEventListener('focus', () => {
      if (!FOCUS_HELD.has(field)) { FOCUS_HELD.add(field); interact(true); }
      // The old reveal-on-focus of the collapsed sliders is gone: the whole fine
      // section (value input included) now sits behind the explicit Fine-tune
      // fold, so by the time this input can take focus the section is open.
    });
    // The release is bracketed on the FIELD, not on the input. Moving focus to another
    // control INSIDE the picker (grabbing a slider, or a space tab, right after the value
    // input revealed them) must NOT end the interaction: interact(false) there drops the
    // host's drag-suppression (tool-inputs' _sliderDragging), so the slider's very first
    // change rebuilds the sidebar row and the picker vanishes mid-drag. But a blur handler
    // on the input alone can only fire when focus goes STRAIGHT from it to the outside
    // world - hop via a tab or a swatch first and the release never came at all, leaving
    // the host latched and its sidebar frozen until some unrelated drag freed it.
    // `focusout` on the field sees every hop and fires once, when focus really leaves.
    field.addEventListener('focusout', (e) => {
      const to = (e as FocusEvent).relatedTarget;
      if (to instanceof Node && field.contains(to)) return;
      if (FOCUS_HELD.delete(field)) interact(false);
      // Text that never parsed is left on screen while typing - deliberately, so the
      // user can keep going - but on the way out it would sit there claiming to be a
      // colour it is not. Put the colour's own notation back; the invalid flag was
      // the warning, not a state to leave behind.
      const st = STATE.get(field);
      if (st && input.hasAttribute('aria-invalid')) writeValueField(field, st);
    });
    input.addEventListener('input', () => {
      const st = STATE.get(field);
      if (!st) return;
      const raw = input.value.trim();
      if (/^transparent$/i.test(raw)) { applyColor(field, { kind: 'transparent', color: TRANSPARENT, ref: null }); return; }
      // The active space's own notation first, then a bare component list in its
      // display units, then the FULL CSS parser - so a hex pasted while OKLCH is
      // active, or an `oklch()`/`color(display-p3 …)` pasted anywhere, lands
      // instead of being silently held as unparseable.
      const parsed = spaceParse(activeSpec(field), raw);
      if (!parsed) { markInvalid(input, true); return; }   // hold the last good colour, and say so
      markInvalid(input, false);
      // A notation with no alpha of its own keeps the alpha the slider is showing - 
      // typing `#30ba78` over a 60% colour must not make it opaque. An alpha it DID
      // state is an instruction, `ff` / `/ 1` included: inferring "stated nothing"
      // from `alpha === 1` made the field a one-way ratchet downward, with no typed
      // notation able to bring a colour back to full opacity. A transparent field has
      // no alpha worth inheriting, so a colour typed over it arrives opaque.
      const alpha = notationHasAlpha(raw) ? parsed.alpha : (st.kind === 'transparent' ? 1 : st.color.alpha);
      applyColor(field, { kind: 'color', color: { ...parsed, alpha }, ref: null });
    });
  });

  // ── Alpha slider ─────────────────────────────────────────────────────────────
  scope.querySelectorAll<HTMLInputElement>('.color-alpha-slider[data-color-alpha]').forEach(alphaSlider => {
    const field = alphaSlider.closest<HTMLElement>('[data-color-field]');
    if (!field) return;
    alphaSlider.addEventListener('pointerdown', () => interact(true));
    alphaSlider.addEventListener('pointerup', () => interact(false));
    alphaSlider.addEventListener('input', () => {
      const st = STATE.get(field);
      if (!st) return;
      const byte = parseInt(alphaSlider.value, 10);
      // Byte-exact both ways: alpha = byte/255 in, Math.round(alpha*255) out.
      st.color = { ...st.color, alpha: clamp01((Number.isFinite(byte) ? byte : 255) / 255) };
      // Touching the alpha of a transparent swatch turns it into a real colour at
      // that opacity (black, since that is what transparent's components are) - 
      // the same thing it did when the native input was the source.
      st.kind = 'color';
      st.ref = null;
      afterEdit(field, st);
    });
  });
}

export interface MountColorFieldOpts {
  /** Initial colour (#rrggbb / #rrggbbaa / any CSS colour / 'transparent' / token value). */
  value?: unknown;
  /** Called with the sRGB value string on every change; `detail` carries the
   *  canonical (possibly wider-than-sRGB) colour and is safe to ignore. */
  onChange(value: string, detail?: ColorChangeDetail): void;
  float?: boolean;
  swatchesOnly?: boolean;
  inline?: boolean;
  /** Show the full colour-space registry; otherwise HSL and OKLCH. */
  modes?: boolean;
  /** Show the palette above Fine-tune in an always-open inline panel. */
  palette?: boolean;
  /** The colour space the picker opens in (default: the familiar DEFAULT_COLOR_MODE). */
  initialMode?: ColorMode;
  /** Show the conic dials. Defaults to `inline` - a float popover can opt in. */
  dials?: boolean;
  /** Keep an inline first-contact field compact until Fine-tune is opened. */
  progressive?: boolean;
  onInteractStart?(): void;
  onInteractEnd?(): void;
}

/**
 * Mount our colour picker into `container`, in place of a native
 * `<input type=color>` - every colour surface routes through this component,
 * with a system picker fallback when screen sampling is unavailable. Fills the container with a
 * single field and wires it; `onChange` gets the canonical value string
 * (#rrggbb / #rrggbbaa / 'transparent'). Returns the field element so callers
 * can find its trigger for styling. Safe to call again on the same container to
 * re-seed (it replaces the contents).
 */
export function mountColorField(container: HTMLElement, id: string, opts: MountColorFieldOpts): HTMLElement {
  container.innerHTML = colorFieldHtml(id, opts.value ?? '', {
    float: opts.float, swatchesOnly: opts.swatchesOnly, inline: opts.inline, modes: opts.modes, dials: opts.dials,
    progressive: opts.progressive, palette: opts.palette, initialMode: opts.initialMode,
  });
  wireColorField(container, {
    // A token-backed swatch emits a token value OBJECT ({ ref, value }) so the sidebar can keep
    // the colour linked to its brand token. mountColorField's callers all speak plain colour
    // STRINGS (MountColorFieldOpts.onChange(value: string)), so unwrap to the hex here - a bare
    // String() would hand them "[object Object]", which then stores as an invalid CSS colour.
    onChange: (_id, value, detail) => opts.onChange(
      value && typeof value === 'object' ? String((value as { value?: unknown }).value ?? '') : String(value),
      detail,
    ),
    onInteractStart: opts.onInteractStart,
    onInteractEnd: opts.onInteractEnd,
  });
  return container.querySelector<HTMLElement>('[data-color-field]') ?? container;
}
