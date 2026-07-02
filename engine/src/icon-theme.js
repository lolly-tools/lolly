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

const THEME_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const THEME_SUFFIX = '?theme=';
const DEFAULT_STYLE_RE = /<defs><style>\.c1\{fill:([^}]*)\}\.c2\{fill:([^}]*)\}<\/style><\/defs>/;

/**
 * Split `<baseId>?theme=<themeId>` into its parts.
 * Returns { baseId, theme } — theme is null when the id carries none.
 * Full URLs (tool embeds) are never themed ids; they pass through untouched.
 */
export function parseThemedAssetId(id) {
  if (typeof id !== 'string' || id.includes('://')) return { baseId: id, theme: null };
  const i = id.indexOf(THEME_SUFFIX);
  if (i <= 0) return { baseId: id, theme: null };
  const baseId = id.slice(0, i);
  const theme = id.slice(i + THEME_SUFFIX.length);
  if (baseId.includes('?') || !THEME_ID_RE.test(theme)) return { baseId: id, theme: null };
  return { baseId, theme };
}

/** Compose a themed id; a falsy theme returns the base id unchanged. */
export function buildThemedAssetId(baseId, themeId) {
  if (!themeId) return baseId;
  if (!THEME_ID_RE.test(themeId)) throw new Error(`Bad icon theme id: ${themeId}`);
  return `${baseId}${THEME_SUFFIX}${themeId}`;
}

/** Is this theme id valid for use in a themed asset id? */
export function isValidThemeId(themeId) {
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
export function parseIconThemesDoc(doc) {
  if (!doc || !Array.isArray(doc.themes)) return [];
  return doc.themes.filter(t =>
    t && isValidThemeId(t.id) && safeCssColor(t.c1) && safeCssColor(t.c2),
  );
}

/** Does this SVG text follow the themable two-colour contract? */
export function isThemableIconSvg(svgText) {
  return typeof svgText === 'string' && DEFAULT_STYLE_RE.test(svgText);
}

/**
 * Bake a theme into a standalone copy of a themable icon: strip the default
 * style block and turn every class="c1"/"c2" into a literal fill attribute.
 * Returns the baked SVG text, or null when the input doesn't follow the
 * contract (callers fall back to the untouched asset).
 * @param {string} svgText
 * @param {{ c1: string, c2: string }} theme  fill values (any CSS colour)
 */
export function applyIconTheme(svgText, theme) {
  if (!isThemableIconSvg(svgText)) return null;
  const c1 = safeCssColor(theme?.c1);
  const c2 = safeCssColor(theme?.c2);
  if (!c1 || !c2) return null;
  return svgText
    .replace(DEFAULT_STYLE_RE, '')
    .replaceAll('class="c1"', `fill="${c1}"`)
    .replaceAll('class="c2"', `fill="${c2}"`);
}

/**
 * Re-style (not bake) a themable icon: keep the class contract but swap the
 * default fills. Used for live previews where the result stays a single icon
 * per document (e.g. picker thumbnails).
 */
export function restyleIconTheme(svgText, theme) {
  if (!isThemableIconSvg(svgText)) return null;
  const c1 = safeCssColor(theme?.c1);
  const c2 = safeCssColor(theme?.c2);
  if (!c1 || !c2) return null;
  return svgText.replace(DEFAULT_STYLE_RE, `<defs><style>.c1{fill:${c1}}.c2{fill:${c2}}</style></defs>`);
}

// Colour values land inside attribute/style text of SVG we hand to the DOM and
// exporters — allow only simple colour tokens, nothing that can close a quote.
function safeCssColor(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|rgba?\([\d\s.,%]+\))$/.test(s) ? s : null;
}
