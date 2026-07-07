// SPDX-License-Identifier: MPL-2.0
/**
 * Two-colour themable icons.
 *
 * A themable icon is an SVG asset whose shapes carry class="c1" (accent) or
 * class="c2" (base) and whose only styling is one overridable default block:
 *
 *   <defs><style>.c1{fill:#…}.c2{fill:#…}</style></defs>
 *
 * Inlined into a page, the defaults lose to any outside `.c1/.c2 { fill: … !important }`
 * rule — that is the authoring contract, not an accident. For everything that
 * travels as bytes (picker refs, exports, saved sessions) a theme is instead
 * *baked*: the style block is removed and each class becomes a literal fill
 * attribute. Baking keeps two differently-themed copies safe inside a single
 * exported SVG document, where shared class rules would collide.
 *
 * The chosen theme must survive URL-mode round-trips, and an asset value
 * serialises to its id alone — so the theme rides inside the id:
 * `<baseId>?theme=<themeId>`. Shell bridges call parseThemedAssetId() before
 * catalog lookup and bake at resolve time. Theme definitions themselves are
 * catalog data (a palette-type asset tagged "icon-themes"), never engine code.
 */

/** A single icon theme entry from the "icon-themes" palette document. */
export interface IconTheme {
  id: string;
  label?: string;
  c1: string;
  c2: string;
  previewBg?: string;
}

/** The JSON payload shape of a palette-type asset tagged "icon-themes". */
export interface IconThemesDoc {
  themes?: unknown;
}

/** Result of splitting a possibly-themed asset id. */
export interface ParsedThemedAssetId {
  baseId: string;
  theme: string | null;
}

const THEME_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const THEME_SUFFIX = '?theme=';
const DEFAULT_STYLE_RE = /<defs><style>\.c1\{fill:([^}]*)\}\.c2\{fill:([^}]*)\}<\/style><\/defs>/;

/**
 * Split `<baseId>?theme=<themeId>` into its parts.
 * Returns { baseId, theme } — theme is null when the id carries none.
 * Full URLs (tool embeds) are never themed ids; they pass through untouched.
 */
export function parseThemedAssetId(id: string): ParsedThemedAssetId {
  if (typeof id !== 'string' || id.includes('://')) return { baseId: id, theme: null };
  const i = id.indexOf(THEME_SUFFIX);
  if (i <= 0) return { baseId: id, theme: null };
  const baseId = id.slice(0, i);
  const theme = id.slice(i + THEME_SUFFIX.length);
  if (baseId.includes('?') || !THEME_ID_RE.test(theme)) return { baseId: id, theme: null };
  return { baseId, theme };
}

/** Compose a themed id; a falsy theme returns the base id unchanged. */
export function buildThemedAssetId(baseId: string, themeId: string | null | undefined): string {
  if (!themeId) return baseId;
  if (!THEME_ID_RE.test(themeId)) throw new Error(`Bad icon theme id: ${themeId}`);
  return `${baseId}${THEME_SUFFIX}${themeId}`;
}

/** Is this theme id valid for use in a themed asset id? */
export function isValidThemeId(themeId: unknown): themeId is string {
  return typeof themeId === 'string' && THEME_ID_RE.test(themeId);
}

/**
 * Extract the theme list from an icon-themes palette document (the JSON
 * payload of a palette-type asset tagged "icon-themes"). This is the single
 * shape contract both shell bridges and the catalog validator share:
 * `{ themes: [{ id, label?, c1, c2, previewBg? }, …] }`, first entry = the
 * default pairing (must match the fills baked into every themable icon).
 * Entries with an invalid id or unusable colours are dropped.
 */
export function parseIconThemesDoc(doc: IconThemesDoc | null | undefined): IconTheme[] {
  if (!doc || !Array.isArray(doc.themes)) return [];
  return (doc.themes as unknown[]).filter((t): t is IconTheme =>
    !!t && isValidThemeId((t as IconTheme).id) && !!safeCssColor((t as IconTheme).c1) && !!safeCssColor((t as IconTheme).c2),
  );
}

/** Does this SVG text follow the themable two-colour contract? */
export function isThemableIconSvg(svgText: unknown): svgText is string {
  return typeof svgText === 'string' && DEFAULT_STYLE_RE.test(svgText);
}

/**
 * Bake a theme into a standalone copy of a themable icon: strip the default
 * style block and turn every class="c1"/"c2" into a literal fill attribute.
 * Returns the baked SVG text, or null when the input doesn't follow the
 * contract (callers fall back to the untouched asset).
 * @param svgText
 * @param theme  fill values (any CSS colour)
 */
export function applyIconTheme(svgText: string, theme: { c1?: unknown; c2?: unknown } | null | undefined): string | null {
  const c1 = safeCssColor(theme?.c1);
  const c2 = safeCssColor(theme?.c2);
  if (!c1 || !c2) return null;
  if (isThemableIconSvg(svgText)) {
    return svgText
      .replace(DEFAULT_STYLE_RE, '')
      .replaceAll('class="c1"', `fill="${c1}"`)
      .replaceAll('class="c2"', `fill="${c2}"`);
  }
  // A rich multi-colour SVG (e.g. a brand illustration) can't be reduced to two
  // classes without losing its depth. Instead theme it MONOCHROMATICALLY: every
  // fill/stroke becomes a shade of the theme's accent hue at its own original
  // lightness — so highlights stay light, outlines stay dark, and the whole piece
  // reads as one hue. The picker/bridge already route themable picks through here,
  // so illustrations bake with no extra plumbing. Null when it isn't SVG at all.
  return monochromeRecolor(svgText, c1);
}

/**
 * Re-style (not bake) a themable icon: keep the class contract but swap the
 * default fills. Used for live previews where the result stays a single icon
 * per document (e.g. picker thumbnails).
 */
export function restyleIconTheme(svgText: string, theme: { c1?: unknown; c2?: unknown } | null | undefined): string | null {
  const c1 = safeCssColor(theme?.c1);
  const c2 = safeCssColor(theme?.c2);
  if (!c1 || !c2) return null;
  if (isThemableIconSvg(svgText)) {
    return svgText.replace(DEFAULT_STYLE_RE, `<defs><style>.c1{fill:${c1}}.c2{fill:${c2}}</style></defs>`);
  }
  // Illustration (no class contract to preserve): the preview IS the baked monochrome.
  return monochromeRecolor(svgText, c1);
}

// Colour values land inside attribute/style text of SVG we hand to the DOM and
// exporters — allow only simple colour tokens, nothing that can close a quote.
function safeCssColor(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgba?\([\d\s.,%]+\))$/.test(s) ? s : null;
}

// ── Monochromatic recolour (illustrations) ──────────────────────────────────
// Every #hex colour token in the SVG (fills + strokes, whether inline or in a
// <style> block) is re-hued to `baseColor`: the token keeps its own LIGHTNESS but
// adopts the base hue + saturation. HSL naturally neutralises the extremes (a near-
// white fill stays near-white, a near-black outline stays near-black), so only the
// midtones carry the hue — a clean monochrome that preserves the artwork's shading.
// A base with zero saturation (e.g. white/paper) yields a greyscale version.
const HEX_TOKEN_RE = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-fA-F])/g;

function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  let r: number, g: number, b: number;
  if (!s) { r = g = b = l; } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue = (t: number): number => {
      t = (t % 1 + 1) % 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    r = hue(h + 1 / 3); g = hue(h); b = hue(h - 1 / 3);
  }
  const to = (x: number): string => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function monochromeRecolor(svgText: unknown, baseColor: string): string | null {
  if (typeof svgText !== 'string' || !svgText.includes('<svg')) return null;
  const rgb = hexToRgb(baseColor);
  if (!rgb) return null;
  const [bh, bs] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  return svgText.replace(HEX_TOKEN_RE, (tok) => {
    const c = hexToRgb(tok);
    if (!c) return tok;
    const l = rgbToHsl(c[0], c[1], c[2])[2];
    return hslToHex(bh, bs, l);
  });
}
