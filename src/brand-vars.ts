// SPDX-License-Identifier: MPL-2.0
/**
 * Brand semantic CSS variables - the web half of the brand token contract
 * (plans/archive/brand-token-contract.md section 3/section 5).
 *
 * applyBrandVars(el, host) resolves the seven `color.semantic.*` slots from the
 * active brand tokens (host.tokens) and mirrors them onto the tool-canvas root
 * as namespaced CSS custom properties, so tool templates can consume
 * `var(--brand-primary, #4f84ba)` - always with a fallback. A missing slot
 * REMOVES the property (it is never set to '') so the template fallback stays
 * in charge. Best-effort and async: it never throws and mounting never waits
 * on it (though exports may - see views/tool.ts brandVarsReady).
 *
 * Why `--brand-*`, not bare `--primary` (contract section 3): the web shell's
 * styles/tokens.css defines `--primary`/`--muted`/… on `:root` as shadcn HSL
 * *triples*, and community utilities (compress-pdf, strip-data, text-helper)
 * deliberately consume that vocabulary inside the tool canvas as
 * `hsl(var(--primary, …))` - injecting full-colour values under the same names
 * would make those declarations invalid-at-computed-value-time, and would also
 * leak user brand colours into SUSE tools that use bare `var(--primary)` as a
 * private internal. The namespace removes both collision classes at zero cost
 * to template authors.
 */

// Deep engine imports, NOT the `@lolly/engine` barrel: this module is on the
// boot path, and engine/src/index.ts is one shared facade whose retained export
// set is the UNION over every importer - touching it here drags createRuntime
// (Handlebars) + loadTool/validate (Ajv) + c2pa onto first paint. See
// scripts/check-bundle-budget.ts.
import { colorToHex, isAlias } from '../../../engine/src/tokens.ts';
import { parseOklch, oklchToHex, hexToOklch, parseHex } from '../../../engine/src/brand-derive.ts';
import { chromeFollowsDesignSystem } from './lib/chrome-follow.ts';

/** The seven semantic slots (token leaf under `color.semantic`) → CSS var. */
const SLOTS = [
  ['primary', '--brand-primary'],
  ['on-primary', '--brand-on-primary'],
  ['secondary', '--brand-secondary'],
  ['surface', '--brand-surface'],
  ['text', '--brand-text'],
  ['muted', '--brand-muted'],
  ['edge', '--brand-edge'],
] as const;

/** A resolvable tokens document - the head, or a published design-system version
 *  (plans/97 section 6a). Both answer the same two reads, which is the point. */
interface BrandTokens {
  resolve(ref: string, opts?: { theme?: string }): Promise<unknown>;
  colors?(opts?: { theme?: string }): Promise<Array<{ value: string }>>;
}

/** The host slice this module reads - the (optional) tokens resolver, plus
 * `colors()` for the warm-accent scan (see nearestWarmHex).
 *
 * No version reads: the web bridge's own `resolve`/`colors` already answer for
 * whatever the section 6a ladder lands on (bridge/tokens.ts), so both painters here - 
 * app chrome and the tool canvas - read one surface and cannot disagree about
 * which design system is live. A shell or test host whose tokens API has no
 * versioning is on the head, which is what an unversioned system resolves to. */
interface BrandVarsHost {
  tokens?: BrandTokens;
}

// ── Lolly UI token overrides ────────────────────────────────────────────────
// A design system may carry the optional `lolly.ui.*` set exported by the
// component library. These are application SEMANTICS, distinct from a brand's
// identity tokens: only this allowlist can alter the shell, every value is
// validated before it reaches CSSOM, and a missing/invalid leaf removes the
// inline override so the generated Lolly default wins again.
export type UiTokenKind = 'color' | 'length' | 'shadow' | 'font' | 'duration' | 'easing' | 'number';
const UI_SLOTS: ReadonlyArray<readonly [path: string, css: string, kind: UiTokenKind]> = [
  ['color.text.default', '--ui-color-text-default', 'color'],
  ['color.text.muted', '--ui-color-text-muted', 'color'],
  ['color.surface.canvas', '--ui-color-surface-canvas', 'color'],
  ['color.surface.raised', '--ui-color-surface-raised', 'color'],
  ['color.surface.overlay', '--ui-color-surface-overlay', 'color'],
  ['color.surface.muted', '--ui-color-surface-muted', 'color'],
  ['color.action.primary', '--ui-color-action-primary', 'color'],
  ['color.action.on-primary', '--ui-color-action-on-primary', 'color'],
  ['color.selection.surface', '--ui-color-selection-surface', 'color'],
  ['color.selection.border', '--ui-color-selection-border', 'color'],
  ['color.border.default', '--ui-color-border-default', 'color'],
  ['color.focus.ring', '--ui-color-focus-ring', 'color'],
  ['color.syntax.keyword', '--ui-color-syntax-keyword', 'color'],
  ['color.syntax.string', '--ui-color-syntax-string', 'color'],
  ['color.syntax.comment', '--ui-color-syntax-comment', 'color'],
  ['color.syntax.number', '--ui-color-syntax-number', 'color'],
  ['color.syntax.function', '--ui-color-syntax-function', 'color'],
  ['color.syntax.type', '--ui-color-syntax-type', 'color'],
  ['color.syntax.operator', '--ui-color-syntax-operator', 'color'],
  ['space.control-inline', '--ui-space-control-inline', 'length'],
  ['space.control-block', '--ui-space-control-block', 'length'],
  ['space.panel', '--ui-space-panel', 'length'],
  ['space.page', '--ui-space-page', 'length'],
  ['radius.control', '--ui-radius-control', 'length'],
  ['radius.choice', '--ui-radius-choice', 'length'],
  ['radius.choice-round', '--ui-radius-choice-round', 'length'],
  ['radius.surface', '--ui-radius-surface', 'length'],
  ['radius.card', '--ui-radius-card', 'length'],
  ['radius.panel', '--ui-radius-panel', 'length'],
  ['radius.pill', '--ui-radius-pill', 'length'],
  ['elevation.control', '--ui-elevation-control', 'shadow'],
  ['elevation.panel', '--ui-elevation-panel', 'shadow'],
  ['elevation.floating', '--ui-elevation-floating', 'shadow'],
  ['elevation.sheet', '--ui-elevation-sheet', 'shadow'],
  ['elevation.overlay', '--ui-elevation-overlay', 'shadow'],
  ['edge.default', '--ui-edge-default', 'shadow'],
  ['edge.faint', '--ui-edge-faint', 'shadow'],
  ['edge.strong', '--ui-edge-strong', 'shadow'],
  ['effect.bevel', '--ui-effect-bevel', 'shadow'],
  ['effect.focus-halo', '--ui-effect-focus-halo', 'shadow'],
  ['effect.selected', '--ui-effect-selected', 'shadow'],
  ['type.body', '--ui-type-body', 'length'],
  ['type.label', '--ui-type-label', 'length'],
  ['type.title', '--ui-type-title', 'length'],
  ['type.ui-family', '--ui-type-ui-family', 'font'],
  ['type.mono-family', '--ui-type-mono-family', 'font'],
  ['motion.feedback', '--ui-motion-feedback', 'duration'],
  ['motion.overlay', '--ui-motion-overlay', 'duration'],
  ['motion.navigation', '--ui-motion-navigation', 'duration'],
  ['motion.standard', '--ui-motion-standard', 'easing'],
  ['layer.chrome', '--ui-layer-chrome', 'number'],
  ['layer.overlay', '--ui-layer-overlay', 'number'],
  ['layer.toast', '--ui-layer-toast', 'number'],
];

const UI_LENGTH_RE = /^\d+(?:\.\d+)?(?:px|rem|em)$/;
const UI_SIGNED_LENGTH_RE = /^-?\d+(?:\.\d+)?(?:px|rem|em)$/;
const UI_DURATION_RE = /^\d+(?:\.\d+)?(?:ms|s)$/;
const UI_HEX_RE = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function uiShadowValue(value: unknown): string | null {
  const one = (raw: unknown): string | null => {
    if (!isRecord(raw)) return null;
    const x = typeof raw.offsetX === 'string' ? raw.offsetX.trim() : '';
    const y = typeof raw.offsetY === 'string' ? raw.offsetY.trim() : '';
    const blur = typeof raw.blur === 'string' ? raw.blur.trim() : '';
    const spread = typeof raw.spread === 'string' ? raw.spread.trim() : '';
    const color = typeof raw.color === 'string' ? raw.color.trim() : '';
    if (![x, y, blur, spread].every(v => UI_SIGNED_LENGTH_RE.test(v)) || !UI_HEX_RE.test(color)) return null;
    return `${x} ${y} ${blur} ${spread} ${color}`;
  };
  if (Array.isArray(value)) {
    const values = value.map(one);
    return values.length && values.every((v): v is string => v !== null) ? values.join(', ') : null;
  }
  return one(value);
}

/** The only conversion path from imported `lolly.ui.*` DTCG values into CSS. */
export function uiTokenCssValue(kind: UiTokenKind, value: unknown): string | null {
  if (isAlias(value)) return null;
  switch (kind) {
    case 'color': return tokenValueToHex(value);
    case 'length': return typeof value === 'string' && UI_LENGTH_RE.test(value.trim()) ? value.trim() : null;
    case 'shadow': return uiShadowValue(value);
    case 'font': return brandFontStack(value, 'ui-sans-serif, system-ui, sans-serif');
    case 'duration': return typeof value === 'string' && UI_DURATION_RE.test(value.trim()) ? value.trim() : null;
    case 'easing': {
      if (!Array.isArray(value) || value.length !== 4 || value.some(v => typeof v !== 'number' || !Number.isFinite(v) || v < -5 || v > 5)) return null;
      return `cubic-bezier(${value.map(v => String(v).replace(/^0\./, '.')).join(', ')})`;
    }
    case 'number': return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100000 ? String(value) : null;
  }
}

async function applyUiTokenOverrides(tokens: BrandTokens | undefined): Promise<void> {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  await Promise.all(UI_SLOTS.map(async ([path, css, kind]) => {
    let value: string | null = null;
    try { value = uiTokenCssValue(kind, await tokens?.resolve(`{lolly.ui.${path}}`)); } catch { /* missing is stock Lolly */ }
    if (value) root.setProperty(css, value); else root.removeProperty(css);
  }));
}

// ── Chrome (app UI) brand accent ─────────────────────────────────────────────
// The second half of the contract: the SHELL's own chrome follows the brand's
// primary. tokens.css hardcodes shadcn HSL-triple accents per theme; when the
// active brand resolves `color.semantic.primary`, we override the accent
// triples (--primary / --primary-foreground / --ring - deliberately nothing
// else: backgrounds, borders and text stay the shell's own) via one injected
// <style>, per shell theme so light/dark each take their brand-theme value.
// No semantic slots (the SUSE doc has none) → the style is removed and the
// hardcoded chrome stands. lolly-start's starter tokens alias primary to the
// neutral ink ramp, so the out-of-the-box chrome accent is black until the
// user installs a brand (#/start wizard / ingest).

const CHROME_STYLE_ID = 'brand-chrome-vars';

// ── Brand fonts ──────────────────────────────────────────────────────────────
// The platform's default faces are SUSE (UI/body) and SUSE Mono (code) - 
// shell-served @font-face registrations (styles/fonts.css) behind the :root
// --font-brand / --font-mono stacks in tokens.css. When the active brand's
// tokens declare `font.brand` / `font.mono` (DTCG fontFamily), the resolved
// families are applied INLINE on <html> (style attribute beats the :root
// stylesheet default at equal cascade origin), with the default stack kept as
// the tail so an unloadable family degrades to the platform face. The applied
// stacks are cached in localStorage so index.html's pre-boot script can restore
// them before first paint (same trick as the theme flash guard) - without it,
// a branded profile would flash the platform SUSE face on every load until
// boot JS runs.

/** slot in the tokens doc (`font.<slot>`) → CSS var → default stack tail.
 *  display (h1/h2) and italic degrade to the brand face, so a brand that sets
 *  only those still reads coherently, and the tail also catches a font that
 *  fails to load. Their consumers (base.css) also `var(--font-display,
 *  var(--font-brand))`, so an UNSET slot falls through to the primary too. */
const FONT_SLOTS = [
  ['brand', '--font-brand', "'SUSE', ui-sans-serif, system-ui, sans-serif"],
  ['mono', '--font-mono', "'SUSE Mono', 'Roboto Mono', ui-monospace, monospace"],
  ['display', '--font-display', 'var(--font-brand)'],
  ['italic', '--font-italic', 'var(--font-brand)'],
] as const;

/**
 * The brand token PATH a semantic CSS custom property names, or null for one that
 * is not a brand token (plans/222). The inverse of the SLOTS / FONT_SLOTS tables
 * above, so the `.penpot` export binds a box painted `var(--brand-primary)` to
 * `color.semantic.primary` off the SAME table `applyBrandVars` paints from -
 * never a second, drifting copy. Accepts the bare property name (`--brand-primary`).
 */
export function brandVarTokenPath(cssVar: string): string | null {
  const name = cssVar.trim();
  for (const [slot, v] of SLOTS) if (v === name) return `color.semantic.${slot}`;
  for (const [role, v] of FONT_SLOTS) if (v === name) return `font.${role}`;
  if (name === '--radius') return 'shape.radius';
  if (name === '--space') return 'space.base';
  return null;
}

const FONT_CACHE_KEY = 'brand-fonts';

// Family names come from an untrusted imported tokens doc and land in a style
// value - allow only plain name characters (letters/digits/space/_/-), so no
// quotes, braces, url() or declaration smuggling can pass. Same stance as
// SAFE_CSS_COLOR in color-field.ts.
const FONT_FAMILY_RE = /^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$/;

/**
 * A resolved `font.*` token value → a safe CSS font-family stack ending in the
 * platform default `tail`, or null when nothing usable resolved. Accepts a
 * string or a DTCG fontFamily array; strips optional quotes; rejects any
 * family that isn't a plain name (see FONT_FAMILY_RE). Exported for tests.
 */
export function brandFontStack(value: unknown, tail: string): string | null {
  const fams = (Array.isArray(value) ? value : [value])
    .filter((f): f is string => typeof f === 'string' && !isAlias(f))
    .map(f => f.trim().replace(/^['"]+|['"]+$/g, '').trim())
    .filter(f => FONT_FAMILY_RE.test(f));
  if (!fams.length) return null;
  // A brand naming a platform default (SUSE's font.mono is 'SUSE Mono') would
  // otherwise emit the family twice - once from the token, again leading the
  // tail. Drop tail entries whose family the token already names.
  const named = new Set(fams.map(f => f.toLowerCase()));
  const restTail = tail.split(',')
    .filter(part => !named.has(part.trim().replace(/^['"]+|['"]+$/g, '').trim().toLowerCase()))
    .map(part => part.trim()).join(', ');
  return `${fams.map(f => `'${f}'`).join(', ')}${restTail ? `, ${restTail}` : ''}`;
}

/** Resolve the brand font slots and apply/clear them inline on <html>. */
async function applyBrandFonts(host: { tokens?: BrandTokens }): Promise<void> {
  const applied: Record<string, string> = {};
  for (const [slot, cssVar, tail] of FONT_SLOTS) {
    let stack: string | null = null;
    try {
      stack = brandFontStack(await host.tokens?.resolve(`{font.${slot}}`), tail);
    } catch { /* no tokens / broken doc → platform default */ }
    if (stack) {
      document.documentElement.style.setProperty(cssVar, stack);
      applied[cssVar] = stack;
    } else {
      document.documentElement.style.removeProperty(cssVar);
    }
  }
  try {
    if (Object.keys(applied).length) localStorage.setItem(FONT_CACHE_KEY, JSON.stringify(applied));
    else localStorage.removeItem(FONT_CACHE_KEY);
  } catch { /* storage unavailable - pre-boot restore just won't happen */ }
}

// ── Brand shape (corner radius) ──────────────────────────────────────────────
// The one "shape" token: how rounded the app's OWN chrome (cards, buttons,
// panels - never a tool canvas; no template consumes var(--radius)) reads.
// Lives at `shape.radius` (DTCG dimension), applied to --radius on <html>
// exactly like the font stacks above - inline style beats the :root default
// at equal cascade origin - and cached in localStorage so index.html's
// pre-boot script restores it before first paint. Reserved for UNLOCKED
// brands (profile.ts gates the whole "Adjust your brand" card on brandLocked)
// - a locked catalog's shape is part of its fixed identity like its colours
// and fonts.

const RADIUS_CACHE_KEY = 'brand-radius';
const SPACE_CACHE_KEY = 'brand-space';

// A DTCG dimension value as this app will ever emit or accept for --radius: a
// non-negative number (optional decimal) in rem/px/em only. Same defense-in-
// depth stance as FONT_FAMILY_RE/SAFE_CSS_COLOR above - an untrusted imported
// tokens doc's string lands directly in a CSSOM setProperty call.
const RADIUS_RE = /^\d+(\.\d+)?(rem|px|em)$/;

/** A resolved `shape.radius` token value → a safe CSS length, or null when it
 *  isn't one (missing slot, alias residue, or an unsafe/malformed string). */
export function brandRadiusValue(value: unknown): string | null {
  const v = typeof value === 'string' ? value.trim() : '';
  return v && !isAlias(v) && RADIUS_RE.test(v) ? v : null;
}

/** A resolved `space.base` dimension → a safe CSS length, or null. Space and
 * radius deliberately share the narrow dimension grammar: both values reach
 * CSSOM, and imports must never turn a token string into an injection path. */
export function brandSpaceValue(value: unknown): string | null {
  const v = typeof value === 'string' ? value.trim() : '';
  return v && !isAlias(v) && RADIUS_RE.test(v) ? v : null;
}

/** Resolve `shape.radius` and apply/clear it inline on <html>, caching the
 *  applied value (or clearing the cache) for index.html's pre-boot restore. */
async function applyBrandRadius(host: { tokens?: BrandTokens }): Promise<void> {
  let radius: string | null = null;
  try {
    radius = brandRadiusValue(await host.tokens?.resolve('{shape.radius}'));
  } catch { /* no tokens / broken doc → platform default */ }
  if (radius) {
    document.documentElement.style.setProperty('--radius', radius);
    try { localStorage.setItem(RADIUS_CACHE_KEY, radius); } catch { /* storage unavailable */ }
  } else {
    document.documentElement.style.removeProperty('--radius');
    try { localStorage.removeItem(RADIUS_CACHE_KEY); } catch { /* storage unavailable */ }
  }
}

/** Resolve `space.base` into the single spacing rhythm that drives `--sp-*`.
 * As with radius, a missing token removes only the inline override, restoring
 * Lolly's own 8px default without mutating the underlying stylesheet. */
async function applyBrandSpace(host: { tokens?: BrandTokens }): Promise<void> {
  let space: string | null = null;
  try {
    space = brandSpaceValue(await host.tokens?.resolve('{space.base}'));
  } catch { /* no tokens / broken doc → platform default */ }
  if (space) {
    document.documentElement.style.setProperty('--space', space);
    try { localStorage.setItem(SPACE_CACHE_KEY, space); } catch { /* storage unavailable */ }
  } else {
    document.documentElement.style.removeProperty('--space');
    try { localStorage.removeItem(SPACE_CACHE_KEY); } catch { /* storage unavailable */ }
  }
}

/** #rrggbb → a shadcn "H S% L%" triple (so hsl(var(--x) / α) keeps working). */
export function hexToHslTriple(hex: string): string | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return null;
  const r = parseInt(m[1]!, 16) / 255, g = parseInt(m[2]!, 16) / 255, b = parseInt(m[3]!, 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  const rnd = (v: number) => Math.round(v * 10) / 10;
  return `${rnd(h)} ${rnd(s * 100)}% ${rnd(l * 100)}%`;
}

/** A resolved token value → #rrggbb, or null when it isn't a usable colour.
 * Ramps store raw `oklch()` strings - the browser resolves those in var()
 * injection, but anything needing real RGB (the HSL-triple convention here,
 * the confetti chip pairs in lib/particles.ts) gamut-maps them through the
 * engine (the same path deriveBrandTokens uses). */
export function tokenValueToHex(value: unknown): string | null {
  if (typeof value === 'string' && /^(oklch|lch)\(/i.test(value.trim())) {
    const o = parseOklch(value);
    return o ? oklchToHex(o) : null;
  }
  const hex = colorToHex(typeof value === 'string' && isAlias(value) ? null : value);
  return typeof hex === 'string' && /^#[0-9a-f]{6}/i.test(hex) ? hex.slice(0, 7) : null;
}

/**
 * Black or white - whichever reads on `hex`. Perceptual luminance threshold.
 *
 * **This is the ONE inversion rule for ink sitting on a colour**, app-wide: the
 * flip point Andy picked from the colour picker's dial disc (the full history
 * lives with the picker surfaces in components/color-field.ts, which re-exports
 * this). It is defined HERE because the chrome accent below is on the boot path
 * and color-field.ts pulls in the engine barrel.
 *
 * The chrome's `--primary-foreground` is COMPUTED with it from the brand
 * primary rather than taken from the authored `on-primary` token: authored
 * pairs kept shipping dark inks on mid-tone accents (SUSE's near-black teal on
 * Jungle green) that sat on the wrong side of the flip point every other
 * surface uses. The authored `on-primary` still reaches tool templates
 * untouched via `--brand-on-primary` (applyBrandVars), so exported pixels
 * never move; the high-contrast accent keeps its own APCA search, which
 * outranks this rule.
 */
export function contrastText(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
  if (!m) return '#000000';
  const r = parseInt(m[1]!, 16), g = parseInt(m[2]!, 16), b = parseInt(m[3]!, 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#000000' : '#ffffff';
}

// ── Warm accent (--brand-warn) ───────────────────────────────────────────────
// "Needs attention" UI (the render pill / editor toolbar's unsaved cue) used to
// hard-code an amber. Instead, scan the active brand's own colours (ramps,
// spectrum, semantic roles - whatever resolves) and pick whichever sits closest
// to the red→amber→yellow arc in OKLCH hue, so the cue is always ON BRAND and
// automatically follows any colour the user changes. Near-neutral swatches
// (low chroma) are skipped - a grey has no real hue to judge.
const WARM_TARGET_HUE = 50;   // OKLCH degrees - the red/amber/yellow arc's centre
const MIN_WARM_CHROMA = 0.04; // below this a swatch reads as grey, not warm

function hueDistance(h: number, target: number): number {
  const d = Math.abs(h - target) % 360;
  return Math.min(d, 360 - d);
}

/** Among `swatches`, the resolved hex whose OKLCH hue is nearest red/yellow,
 * plus whichever of black/white reads legibly on top of it - or null when none
 * resolve to a usable, sufficiently-chromatic colour (caller keeps its own
 * static fallback, e.g. `var(--brand-warn, #b28727)`). */
export function nearestWarmHex(swatches: ReadonlyArray<{ value: unknown }>): { hex: string; ink: string } | null {
  let best: { hex: string; dist: number } | null = null;
  const seen = new Set<string>();
  for (const s of swatches) {
    const hex = tokenValueToHex(s.value);
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    const o = hexToOklch(hex);
    if (!o || o.c < MIN_WARM_CHROMA) continue;
    const dist = hueDistance(o.h, WARM_TARGET_HUE);
    if (!best || dist < best.dist) best = { hex, dist };
  }
  if (!best) return null;
  return { hex: best.hex, ink: contrastText(best.hex) };
}

// ── High contrast: the accent has to clear the bar too ───────────────────────
// tokens.css's high-contrast blocks deliberately leave --primary /
// --primary-foreground alone, because this module owns them at runtime for an
// arbitrary brand (see the "WHAT IS DELIBERATELY NOT TOUCHED" note there). That
// ownership argument is right, but it leaves the ONE control the user came to
// press as the only thing the pref doesn't touch: SUSE's Jungle #30ba78 pairs
// at APCA Lc 53 with its dark ink and 54 with white or black - under even the
// Lc 60 large-text floor, in the dark and brand themes. So the fix belongs
// here, where the accent is constructed.
//
// The move is a HUE-PRESERVING lightness search: hold the primary's OKLCH hue
// and chroma, walk its LIGHTNESS away from the authored value until the paired
// ink clears the bar, and take whichever of the two directions converges with
// the smaller move - so a brand's accent shifts as little as it can, and a
// purple brand stays purple. Only --primary/--primary-foreground are emitted:
// --ring is deliberately NOT re-pointed at the brand, because tokens.css's
// high-contrast blocks force the theme's brightest ink there on purpose (a dim
// brand primary can be an invisible focus ring), and that decision outranks
// brand identity.
//
// Unlike brandMarkPrimary, a near-neutral primary cannot be declined here - a
// CTA still has to be legible - and it doesn't need to be: the search moves
// along L with chroma HELD, so a starter brand's ink (OKLCH chroma ~0.012)
// stays neutral and its unstable hue never becomes visible.

/** The bar a CTA label must clear. Lc 75 is APCA's body-text minimum and the bar
 *  the contrast pass set itself (tokens.css header) - but the bisection below
 *  converges on the MINIMUM clearing lightness, so a target of 75 lands every
 *  repaired pair at Lc 75.0-75.4: a tenth of a point of headroom on a floor,
 *  for a 13px/600 button label. 80 buys real margin for a few hundredths of
 *  OKLCH lightness, and still leaves the fill recognisably the brand's. */
export const HC_TARGET_LC = 80;
/** Lightness resolution of the search - finer than the eye, and 24 bisection
 *  steps get there regardless, so this only guards the loop. */
const HC_L_EPSILON = 0.001;

// APCA-W3 (APCA-1.0.98G), the minimum needed to SCORE a pair. Ported from the
// engine's own apcaContrast (engine/src/color-tools.ts, itself ported from
// chroma.js - BSD-3-Clause, © 2011-2025 Gregor Aisch; algorithm by Andrew
// Somers / Myndex) rather than imported, because this module is on the boot
// path and color-tools.ts drags gamut/icc/brand-schemes/css-color with it - 
// exactly the ~37 KB that a dedicated perf pass moved OFF boot (see the deep-
// import note at the top of this file, and scripts/check-bundle-budget.ts).
// The constants are the spec's magic numbers; do not "clean them up".
// brand-vars.test.ts pins this port against the engine function so the two
// cannot drift.
const HC_APCA = {
  mainTRC: 2.4, normBG: 0.56, normTXT: 0.57, revTXT: 0.62, revBG: 0.65,
  sRco: 0.2126729, sGco: 0.7151522, sBco: 0.072175,
  blkThrs: 0.022, blkClmp: 1.414, loClip: 0.1, deltaYmin: 0.0005,
  scale: 1.14, offset: 0.027,
} as const;

function apcaY(rgb: [number, number, number]): number {
  const { mainTRC, sRco, sGco, sBco, blkThrs, blkClmp } = HC_APCA;
  const y = sRco * (rgb[0] / 255) ** mainTRC + sGco * (rgb[1] / 255) ** mainTRC
    + sBco * (rgb[2] / 255) ** mainTRC;
  return y > blkThrs ? y : y + (blkThrs - y) ** blkClmp;
}

/**
 * |Lc| between two opaque #rrggbb colours - the magnitude only, since every
 * caller here compares against a band floor and APCA's sign is just polarity.
 * NaN for anything unparseable, so every `>= floor` check honestly fails
 * (the contrastRatio convention). Exported for the drift test.
 */
export function apcaLcAbs(textHex: string, bgHex: string): number {
  const t = parseHex(textHex);
  const b = parseHex(bgHex);
  if (!t || !b) return NaN;
  const ytxt = apcaY([t[0], t[1], t[2]]);
  const ybg = apcaY([b[0], b[1], b[2]]);
  const { normBG, normTXT, revTXT, revBG, loClip, deltaYmin, scale, offset } = HC_APCA;
  if (Math.abs(ybg - ytxt) < deltaYmin) return 0;
  const sapc = ybg > ytxt
    ? (ybg ** normBG - ytxt ** normTXT) * scale
    : (ybg ** revBG - ytxt ** revTXT) * scale;
  return Math.abs(sapc) < loClip ? 0 : (Math.abs(sapc) - offset) * 100;
}

/** The primary/ink pair a theme would use at lightness `l`, if any ink clears
 *  the bar there. `dir` is the search direction (-1 darker, +1 lighter), which
 *  fixes the pure ink; the brand's OWN on-primary is preferred when it sits on
 *  the right side of the fill, so a brand keeps its authored ink where it can. */
function hcPairAt(
  l: number,
  base: { l: number; c: number; h: number },
  dir: -1 | 1,
  onPrimary: string | null,
  onPrimaryL: number | null,
): { fill: string; ink: string } | null {
  const fill = oklchToHex({ l, c: base.c, h: base.h });
  const inks: string[] = [];
  if (onPrimary && onPrimaryL != null && (dir < 0 ? onPrimaryL > l : onPrimaryL < l)) inks.push(onPrimary);
  inks.push(dir < 0 ? '#ffffff' : '#000000');
  for (const ink of inks) if (apcaLcAbs(ink, fill) >= HC_TARGET_LC) return { fill, ink };
  return null;
}

/**
 * The high-contrast replacement for one theme's accent pair, or null when the
 * authored pair already clears Lc 75 (nothing to fix - the brand's colour
 * stands) or when no lightness of this hue can (a fully saturated hue whose
 * whole L range fails, which sRGB doesn't actually contain, but the search
 * refuses to guess rather than emit a pair it can't justify).
 *
 * `onPrimary` null means the ink is whatever tokens.css statically pairs with
 * this theme's accent - unknowable from here - so the search runs anyway and
 * the returned block always states its ink explicitly.
 *
 * Exported for tests.
 */
export function highContrastAccent(
  primary: string | null,
  onPrimary: string | null,
): { fill: string; ink: string } | null {
  const base = primary ? hexToOklch(primary) : null;
  if (!primary || !base) return null;
  if (onPrimary && apcaLcAbs(onPrimary, primary) >= HC_TARGET_LC) return null;
  const onPrimaryL = onPrimary ? (hexToOklch(onPrimary)?.l ?? null) : null;

  const found: Array<{ fill: string; ink: string; move: number }> = [];
  for (const dir of [-1, 1] as const) {
    // The authored lightness first: when only the INK was wrong, the fill must
    // not move at all (move 0 beats every other candidate).
    const here = hcPairAt(base.l, base, dir, onPrimary, onPrimaryL);
    if (here) { found.push({ ...here, move: 0 }); continue; }
    // |Lc| grows monotonically as the fill moves away from the ink's own
    // luminance, and the max of the two candidate inks is monotone too, so the
    // smallest clearing move is a boundary - bisect for it. If the extreme
    // itself fails, no lightness in this direction can.
    const bound = dir < 0 ? 0 : 1;
    if (!hcPairAt(bound, base, dir, onPrimary, onPrimaryL)) continue;
    let fail = base.l, pass = bound;
    for (let i = 0; i < 24 && Math.abs(pass - fail) > HC_L_EPSILON; i++) {
      const mid = (fail + pass) / 2;
      if (hcPairAt(mid, base, dir, onPrimary, onPrimaryL)) pass = mid; else fail = mid;
    }
    const pair = hcPairAt(pass, base, dir, onPrimary, onPrimaryL);
    if (pair) found.push({ ...pair, move: Math.abs(pass - base.l) });
  }
  // Smallest lightness move wins; a tie keeps the darker direction (searched
  // first), so the emitted CSS is deterministic.
  const best = found.sort((a, b) => a.move - b.move)[0];
  return best ? { fill: best.fill, ink: best.ink } : null;
}

/**
 * The `html[data-a11y-contrast="high"]`-gated accent pair for one theme, or ''
 * when the theme's authored pair already clears the bar.
 *
 * SPECIFICITY, and why the selectors are shaped like tokens.css's: this sheet
 * is generated at runtime and cannot know the attribute's future state, so it
 * emits BOTH blocks and lets the cascade choose. The gated block therefore has
 * to beat the ungated one it sits beside in the SAME stylesheet - and source
 * order is not enough to rely on, because the ungated light block is spelled
 * `:root, [data-theme="light"]` and would otherwise be reached by a dark
 * document too. Leading with the `html` type selector plus the contrast
 * attribute makes each gated block (0,2,1) - or (0,3,1) for light's two
 * :not()s - against the ungated (0,1,0), so it wins on specificity alone,
 * independently of order. The light selector is spelled "neither dark nor
 * brand" for the same reason tokens.css spells it that way: a document with no
 * [data-theme] at all is light, and the block must not leak into the two
 * themes that carry their own.
 */
function hcAccentBlock(selector: string, primary: string | null, onPrimary: string | null): string {
  const hc = highContrastAccent(primary, onPrimary);
  const p = hc && hexToHslTriple(hc.fill);
  const fg = hc && hexToHslTriple(hc.ink);
  if (!p || !fg) return '';
  return `${selector} {\n  --primary: ${p};\n  --primary-foreground: ${fg};\n}`;
}

/** One shell theme's accent overrides, or '' when primary didn't resolve. The
 * ink is COMPUTED from the fill via the app-wide inversion rule (contrastText),
 * not taken from the brand's authored on-primary - see contrastText's note. */
function accentBlock(selector: string, primary: string | null): string {
  const p = primary && hexToHslTriple(primary);
  if (!p) return '';
  const fg = hexToHslTriple(contrastText(primary));
  return `${selector} {\n  --primary: ${p};\n  --ring: ${p};\n  --primary-foreground: ${fg};\n}`;
}

/**
 * Construct the `brand` theme - the mid-toned colored chrome - from the brand's
 * two primaries. The recipe is the old SUSE theme reverse-engineered into OKLCH
 * (its static block in tokens.css remains the SUSE-palette instance of exactly
 * this): SURFACES take the light primary's hue at low chroma across fixed
 * mid-dark lightness stops (Pine-tinted panels, in SUSE terms); the ACCENT is
 * the dark primary verbatim (Jungle). Chroma is anchored to the light primary's
 * own chroma, so a neutral starter brand (ink primary) yields a tastefully
 * grey chrome and a vivid brand yields a tinted one - never garish: surface
 * chroma is capped at 0.08.
 */
export function brandThemeCss(lightPrimaryHex: string, darkPrimaryHex: string): string {
  const surf = hexToOklch(lightPrimaryHex);
  const acc = hexToOklch(darkPrimaryHex);
  if (!surf || !acc) return '';
  const h = surf.h;
  const cBase = Math.min(Math.max(surf.c, 0.008), 0.055); // background chroma anchor
  const t = (l: number, cMul: number, hue = h) =>
    hexToHslTriple(oklchToHex({ l, c: Math.min(cBase * cMul, 0.08), h: hue }));
  const accent = hexToHslTriple(darkPrimaryHex);
  // The accent ink follows the fill by the app-wide inversion rule, same as the
  // accent blocks - never the authored on-primary (see contrastText's note).
  const accentFg = hexToHslTriple(contrastText(darkPrimaryHex));
  const v = (name: string, val: string | null) => (val ? `  --${name}: ${val};\n` : '');
  // Lightness stops lifted from the SUSE construction: bg .29, card .35,
  // muted .38, secondary .39, accent-surface .40, border .51; body ink .95,
  // secondary (muted-foreground) ink .90 - raised from .84 (OKLCH), which sat
  // at APCA Lc ~62 on the lightest surface for every hue, under the Lc 75 body
  // floor; .90 clears it (~75) while staying below the body ink for hierarchy.
  // --foreground-canvas repeats --foreground on purpose: it is the ink the render
  // canvas keeps when the high-contrast preference re-points --foreground, so a
  // comfort setting cannot move exported pixels (styles/tokens.css carries the
  // full note, and the static theme blocks there declare the same pair). It must
  // be emitted HERE too - this block reconstructs the brand theme at runtime and
  // would otherwise leave the canvas pinned to the static SUSE ink.
  return `[data-theme="brand"] {
  color-scheme: dark;
${v('background', t(0.29, 1))}${v('foreground', t(0.95, 0.35))}${v('foreground-canvas', t(0.95, 0.35))}${v('card', t(0.35, 1.18))}${v('card-foreground', t(0.95, 0.35))}${v('popover', t(0.35, 1.18))}${v('popover-foreground', t(0.95, 0.35))}${v('primary', accent)}${v('primary-foreground', accentFg)}${v('secondary', t(0.39, 1.27))}${v('secondary-foreground', t(0.95, 0.35))}${v('muted', t(0.38, 1.2))}${v('muted-foreground', t(0.90, 0.55))}${v('accent', t(0.40, 1.3))}${v('accent-foreground', t(0.95, 0.35))}${v('border', t(0.51, 1.45))}${v('input', t(0.51, 1.45))}${v('ring', accent)}${v('store-1', t(0.65, 0.75, acc.h))}${v('store-2', t(0.70, 0.75, acc.h))}${v('store-3', t(0.74, 0.75, acc.h))}${v('store-4', t(0.79, 0.75, acc.h))}${v('store-other', t(0.62, 0.4))}}`;
}

// ── Lolly's own mark, recoloured to the guest brand ──────────────────────────
// Lolly's IDENTITY (the green-and-white lollipop) is not a verdict - so when a
// guest brand is active it takes on the brand's hue. The mark exists as a raster
// bitmap (the app icon / Verify hero / favicon) and as a line-glyph + wordmark
// (the "Made with Lolly" badge):
//  • BITMAP - the actual /icons/icon-192.png swirl is recoloured PROPERLY by a
//    canvas hue-remap (tintLogo): each green pixel takes the brand hue but keeps
//    its own saturation/lightness, the white swirl stays white. One data URL
//    drives the Verify hero (via --lolly-logo) AND the browser favicon.
//  • GLYPH/TEXT - the badge glyph + wordmark + the medallion's outer glow wear
//    --lolly-mark, Lolly's identity-green TONE hue-shifted to the brand.
// Everything falls back to Lolly green (bitmap: the plain swirl) when no brand is
// active, so an unbranded Lolly is unchanged. The green VERDICT signals (the
// "Credential intact" pill, the scorecard pips) deliberately stay green.

/** Lolly's identity-green tone in OKLCH, measured from the two `.lolly-badge`
 * greens (hsl 145 58% 34% / 145 52% 60%). The mark keeps this L/C and takes the
 * brand's hue. */
const LOLLY_TONE = { light: { l: 0.5586, c: 0.1286 }, dark: { l: 0.772, c: 0.1338 } } as const;
// Below this OKLCH chroma a "primary" has no hue worth adopting - a greyscale or
// near-black ink (the blank starter's ink, ~0.012) reads as no brand colour at
// all, so we leave Lolly its own green rather than tint it an arbitrary hue.
const MARK_MIN_CHROMA = 0.03;

/**
 * The chosen brand primary for the mark: the MORE CHROMATIC of the two primaries
 * wins, because a dark near-neutral ink has an unstable hue (SUSE's near-black
 * Pine measures teal ~181°, while its vivid Jungle green is the true ~157°). Null
 * when neither primary is chromatic enough to read as a real brand colour.
 */
export function brandMarkPrimary(lightHex: string | null, darkHex: string | null): string | null {
  const best = [lightHex, darkHex]
    .map((hex) => (hex ? { hex, o: hexToOklch(hex) } : null))
    .filter((x): x is { hex: string; o: { l: number; c: number; h: number } } =>
      !!x && !!x.o && x.o.c >= MARK_MIN_CHROMA)
    .sort((a, b) => b.o.c - a.o.c)[0];
  return best ? best.hex : null;
}

/** The brand's dominant OKLCH hue (for the tinted glyph/text tone), or null. */
export function brandMarkHue(lightHex: string | null, darkHex: string | null): number | null {
  const hex = brandMarkPrimary(lightHex, darkHex);
  const o = hex ? hexToOklch(hex) : null;
  return o ? o.h : null;
}

/** The brand-hued Lolly mark hex for one theme (Lolly's tone at the brand hue). */
export function lollyMarkHex(hue: number, theme: 'light' | 'dark'): string {
  return oklchToHex({ ...LOLLY_TONE[theme], h: hue });
}

/**
 * The `--lolly-*` block for the GLYPH/TEXT surfaces: `--lolly-mark` (the badge
 * glyph + wordmark, theme-adaptive) and `--lolly-coin-glow` (the made-with-Lolly
 * medallion's outer glow, so it matches the recoloured logo swirl filling it).
 * '' when the brand has no real hue, so the green fallbacks in valid.css /
 * catalog.css stand. The bitmap recolour (`--lolly-logo`) is handled separately
 * by applyBrandLogo, since it needs a canvas at runtime.
 */
export function lollyMarkCss(lightHex: string | null, darkHex: string | null): string {
  const hue = brandMarkHue(lightHex, darkHex);
  if (hue == null) return '';
  const markLight = lollyMarkHex(hue, 'light');
  return [
    `:root, [data-theme="light"] {\n  --lolly-mark: ${markLight};\n  --lolly-coin-glow: ${markLight}45;\n}`,
    `[data-theme="dark"], [data-theme="brand"] {\n  --lolly-mark: ${lollyMarkHex(hue, 'dark')};\n}`,
  ].join('\n');
}

/** The full injected stylesheet text. Exported for tests. Under the suse
 * PROFILE no semantic slots resolve, nothing is emitted, and the static
 * tokens.css blocks (including the brand theme's SUSE-palette defaults)
 * stand untouched. */
export function chromeBrandCss(
  light: { primary: string | null; onPrimary: string | null },
  dark: { primary: string | null; onPrimary: string | null },
): string {
  return [
    accentBlock(':root, [data-theme="light"]', light.primary),
    accentBlock('[data-theme="dark"]', dark.primary),
    // The brand theme is CONSTRUCTED, not accent-patched: surfaces from the
    // light primary's hue, accent from the dark primary (see brandThemeCss).
    light.primary && dark.primary ? brandThemeCss(light.primary, dark.primary) : '',
    // Lolly's own mark follows the brand hue (identity, not verdict).
    lollyMarkCss(light.primary, dark.primary),
    // High contrast, per theme and gated on the attribute, so a user with no
    // prefs set gets exactly the blocks above and nothing else can match.
    // Each theme is judged on its OWN pair - a brand whose light accent already
    // clears Lc 75 (SUSE's Pine does, at 98) emits no light block at all.
    hcAccentBlock('html[data-a11y-contrast="high"]:not([data-theme="dark"]):not([data-theme="brand"])',
      light.primary, light.onPrimary),
    hcAccentBlock('html[data-a11y-contrast="high"][data-theme="dark"]', dark.primary, dark.onPrimary),
    // The brand theme wears the DARK primary as its accent (brandThemeCss), so
    // it takes the same adjustment - but only when that constructed theme was
    // emitted at all. Without it the static tokens.css brand block is in
    // charge, and patching its accent from a brand that didn't produce it would
    // pair a colour with an ink neither of them chose.
    light.primary && dark.primary
      ? hcAccentBlock('html[data-a11y-contrast="high"][data-theme="brand"]', dark.primary, dark.onPrimary)
      : '',
  ].filter(Boolean).join('\n');
}

/**
 * Inject/refresh the chrome override stylesheet from already-resolved primary
 * (+ on-primary) hexes, per theme. The shared tail of applyChromeBrandVars
 * (below) - split out so the brand editor's live, in-memory DRAFT preview
 * (not yet installed, so nothing to resolve via host.tokens) can paint the
 * same chrome accent without going through the host at all.
 */
export function applyChromeAccent(
  light: { primary: string | null; onPrimary: string | null },
  dark: { primary: string | null; onPrimary: string | null },
): void {
  if (typeof document === 'undefined') return;
  const css = chromeBrandCss(light, dark);
  let styleEl = document.getElementById(CHROME_STYLE_ID);
  if (!css) { styleEl?.remove(); return; }
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = CHROME_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;
}

const FAVICON_ID = 'brand-favicon';
const LOGO_SRC = '/icons/icon-192.png'; // the green-and-white Lolly swirl (same origin)

/** HSL hue (degrees) of a #rrggbb, or null. Reuses the shell's hex→"H S% L%". */
function hexHslHue(hex: string): number | null {
  const triple = hexToHslTriple(hex);
  if (!triple) return null;
  const h = parseFloat(triple);
  return Number.isFinite(h) ? h : null;
}

/** HSL (h∈0..360, s,l∈0..1) → [r,g,b] each 0..255. */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/**
 * Recolour the green-and-white Lolly logo bitmap to `hue` (HSL degrees, the
 * brand's main colour): every chromatic pixel keeps its OWN saturation &
 * lightness but takes the brand hue, so the swirl still reads as a glossy candy
 * in the brand colour; the white half and its anti-aliased edges are left
 * untouched. Returns a PNG data URL usable as an <img>/background AND a favicon,
 * or null if the canvas/image is unavailable. Best-effort: never throws.
 */
async function tintLogo(hue: number): Promise<string | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  try {
    const img = new Image();
    img.src = LOGO_SRC;
    await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return null;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h); // same-origin → not tainted
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] === 0) continue; // transparent
      const r = (px[i] ?? 0) / 255, g = (px[i + 1] ?? 0) / 255, b = (px[i + 2] ?? 0) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
      if (d < 0.08) continue; // white / near-grey → keep it white
      const l = (max + min) / 2;
      const s = d / (1 - Math.abs(2 * l - 1));
      const [nr, ng, nb] = hslToRgb(hue, s, l);
      px[i] = nr; px[i + 1] = ng; px[i + 2] = nb;
    }
    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

/**
 * Paint the brand-recoloured logo everywhere it's a bitmap: the `--lolly-logo`
 * var (the Verify hero, via background-image) and the browser tab favicon (a
 * PNG <link rel=icon>, preferred over the static .ico). Null → the override is
 * removed and the default green swirl / .ico stand. Best-effort: never throws.
 */
function applyBrandLogo(dataUrl: string | null): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  let link = document.getElementById(FAVICON_ID) as HTMLLinkElement | null;
  if (!dataUrl) {
    root.removeProperty('--lolly-logo');
    link?.remove();
    return;
  }
  root.setProperty('--lolly-logo', `url("${dataUrl}")`);
  if (!link) {
    link = document.createElement('link');
    link.id = FAVICON_ID;
    link.rel = 'icon';
    link.type = 'image/png';
    document.head.appendChild(link);
  }
  link.href = dataUrl;
}

/**
 * Resolve the brand primary per theme and inject/refresh the chrome override
 * stylesheet (appended to <head>, so it wins the tokens.css cascade at equal
 * specificity). Call at boot and again after installUserTokens - the bridge's
 * bust() empties the token caches but nothing re-paints chrome by itself.
 * Best-effort like applyBrandVars: never throws, removes the style when the
 * brand has no resolvable primary.
 *
 * The colour half is gated on the Appearance pref (lib/chrome-follow.ts): the
 * app taking the design system's accent is a preference, not a token. Fonts and
 * radius are not - see the note at the gate.
 */
/** localStorage twin of `--brand-primary` (hex, or removed): the static /info
 *  landing shares the app's origin but not its runtime, and its Cover Flow
 *  (lib/covers-flow.ts) opens on the cover nearest the reader's accent - this is
 *  how it learns that accent. Same FOUC-mirror pattern as brand-fonts/brand-radius
 *  above: a cached string read by a page that never installs it as markup. */
export const ACCENT_CACHE_KEY = 'brand-accent';
function mirrorAccent(hex: string | null): void {
  try {
    if (hex) localStorage.setItem(ACCENT_CACHE_KEY, hex);
    else localStorage.removeItem(ACCENT_CACHE_KEY);
  } catch { /* storage unavailable - the live chrome is already right */ }
}

/** Which call of applyChromeBrandVars is the newest. Two paints in a row (a
 *  design-system switch racing boot's own paint, or two quick switches) must
 *  let the LATER one win everywhere, including the fire-and-forget logo tint
 *  at the end, which used to be able to resolve last and paint the previous
 *  system's favicon (plans/186 section 3.4 step 5). */
let paintGeneration = 0;

export async function applyChromeBrandVars(host: BrandVarsHost): Promise<void> {
  // Nothing here to do without a document (a DOM-free shell / test bridge) - 
  // and every branch below writes to documentElement, so bail before any of
  // them can throw a ReferenceError. This is the "never throws" contract: a
  // caller like setPrimaryFont must be able to await this unconditionally.
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  const gen = ++paintGeneration;
  const stale = (): boolean => gen !== paintGeneration;

  // `host.tokens` IS the render surface (plans/97 section 6a): the web bridge resolves
  // the version ladder behind its own reads, so chrome and the tool canvas below
  // paint from one answer and cannot disagree. Nothing to resolve here, and
  // nothing published means the head, exactly as before section 6a.
  const tk: BrandTokens | undefined = host.tokens;

  const resolveHex = async (slot: string, theme: string): Promise<string | null> => {
    try {
      return tokenValueToHex(await tk?.resolve(`{color.semantic.${slot}}`, { theme }));
    } catch { return null; }
  };
  // Fonts, shape and spacing first, independently of the colour blocks below - a brand
  // may declare these tokens without semantic colour slots (the SUSE doc)
  // or vice versa. Both are outside the Appearance pref below: a face and a
  // corner are what the design system says the app should LOOK like, and neither
  // is the app helping itself to a colour (lib/chrome-follow.ts).
  await applyBrandFonts({ tokens: tk }).catch(() => { /* never breaks boot */ });
  await applyBrandRadius({ tokens: tk }).catch(() => { /* never breaks boot */ });
  await applyBrandSpace({ tokens: tk }).catch(() => { /* never breaks boot */ });
  if (stale()) return;
  // "Interface follows the design system" (plan 182 section 5.6), off: every
  // chrome COLOUR this function paints is removed and the app's own accent
  // stands. Not a skip - a re-entry has to undo what an earlier one applied,
  // because this is also the path a flip of the pref repaints through.
  // UI-token overrides are an explicit design-system decision, not the older
  // “chrome follows brand colours” preference. Apply them before that colour
  // branch so a profile can tune spacing/radius/elevation while retaining
  // Lolly's stock accent if it chooses.
  await applyUiTokenOverrides(tk).catch(() => { /* invalid/missing leaves keep stock aliases */ });
  if (stale()) return;
  if (!chromeFollowsDesignSystem()) {
    applyChromeAccent({ primary: null, onPrimary: null }, { primary: null, onPrimary: null });
    root.removeProperty('--brand-primary');
    mirrorAccent(null);
    root.removeProperty('--brand-warn');
    root.removeProperty('--brand-warn-ink');
    applyBrandLogo(null);
    return;
  }
  // The warm "needs attention" accent scans every resolved colour (ramps,
  // spectrum, roles) - independent of the semantic primary/on-primary block
  // below, so it still finds SUSE's Persimmon even though that catalog
  // declares no color.semantic.* slots at all. The catch must NOT touch the
  // DOM (a resolve() rejection still leaves documentElement writable, but
  // keeping the handler pure means it can never itself throw).
  let warn: { hex: string; ink: string } | null = null;
  try {
    warn = nearestWarmHex(await tk?.colors?.() ?? []);
  } catch { warn = null; }
  if (stale()) return;
  if (warn) {
    root.setProperty('--brand-warn', warn.hex);
    root.setProperty('--brand-warn-ink', warn.ink);
  } else {
    root.removeProperty('--brand-warn');
    root.removeProperty('--brand-warn-ink');
  }
  try {
    const [lp, lop, dp, dop] = await Promise.all([
      resolveHex('primary', 'light'), resolveHex('on-primary', 'light'),
      resolveHex('primary', 'dark'), resolveHex('on-primary', 'dark'),
    ]);
    if (stale()) return;
    applyChromeAccent({ primary: lp, onPrimary: lop }, { primary: dp, onPrimary: dop });
    // Expose the brand primary GLOBALLY on :root (not just the tool canvas that
    // applyBrandVars paints) so app chrome outside a tool - the gallery's
    // preview-loading trace, say - can wear it via var(--brand-primary, <fallback>).
    // Same precedent as --brand-warn above; a brand with no resolvable primary
    // (the SUSE catalog declares no semantic slots) removes it so the CSS
    // fallback stays in charge.
    if (lp) root.setProperty('--brand-primary', lp);
    else root.removeProperty('--brand-primary');
    mirrorAccent(lp);
    // Recolour the actual Lolly logo bitmap to the brand's MAIN colour (the
    // chosen primary's HSL hue) and use it for the Verify hero + tab favicon.
    // Async (canvas + image load) and fire-and-forget: the chrome accent above
    // is already applied, and a null result just restores the plain green swirl.
    const primary = brandMarkPrimary(lp, dp);
    const hslHue = primary ? hexHslHue(primary) : null;
    if (hslHue == null) applyBrandLogo(null);
    else void tintLogo(hslHue).then(url => { if (!stale()) applyBrandLogo(url); }).catch(() => { if (!stale()) applyBrandLogo(null); });
  } catch { /* cosmetic only - never break boot */ }
}

/**
 * Resolve each semantic slot and set/remove its custom property on `el`.
 * Injection rules (contract section 3, identical to the CLI's applyBrandVars):
 * a resolved string passes through (hex or a raw `oklch()` string are both
 * valid CSS colours the browser resolves natively) - UNLESS it is alias
 * residue (a `{path}` that never resolved is a missing slot, not a colour);
 * a structured DTCG colour object is normalised via the engine's colorToHex
 * (null ⇒ missing slot). Missing slots remove the property.
 *
 * The per-TOOL-CANVAS painter, and the reason `host.tokens` had to become the
 * render surface rather than the head (plans/97 section 6a): under an active version
 * this must paint that version's colours, and there is no per-mount hook here to
 * resolve a ladder in - the same reason the picker's swatches, the engine's
 * token-bound inputs and the export palette all read the bridge directly.
 */
export async function applyBrandVars(el: HTMLElement, host: BrandVarsHost): Promise<void> {
  await Promise.all(SLOTS.map(async ([slot, cssVar]) => {
    let value: unknown;
    try {
      // TokenSet.resolve accepts the `{alias}` form or a bare dotted path - 
      // both hit the same lookup (engine/src/tokens.ts strips the braces), so
      // the alias form alone covers both spellings.
      value = await host.tokens?.resolve(`{color.semantic.${slot}}`);
    } catch { /* no tokens / broken doc → treat the slot as missing */ }
    try {
      const css = typeof value === 'string' && value
        ? (isAlias(value) ? null : value)
        : colorToHex(value);
      if (css) el.style.setProperty(cssVar, css);
      else el.style.removeProperty(cssVar);
    } catch { /* cosmetic only - never break mounting */ }
  }));
}
