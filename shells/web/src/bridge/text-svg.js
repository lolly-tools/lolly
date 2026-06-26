/**
 * Pure helpers for vectorising HTML text into SVG <path> via host.text.toPath.
 *
 * DOM-free at import so it's unit-testable under node:test (see text-svg.test.js).
 * The SUSE-specific font resolution lives HERE (the shell), never in the engine —
 * the engine stays brand-agnostic. The HarfBuzz shaping itself is the engine's
 * host.text primitive; this module only decides *which* font file to feed it and
 * *where* to place the resulting baseline-relative path.
 */

// Maps a CSS numeric font-weight to the nearest SUSE static TTF filename stem.
export function suseWeightName(weight) {
  const map = [
    [100, 'Thin'], [200, 'ExtraLight'], [300, 'Light'], [400, 'Regular'],
    [500, 'Medium'], [600, 'SemiBold'], [700, 'Bold'], [800, 'ExtraBold'], [900, 'Black'],
  ];
  const w = Math.round(weight / 100) * 100;
  const entry = map.find(([n]) => n === w) ?? map.reduce((a, b) =>
    Math.abs(b[0] - weight) < Math.abs(a[0] - weight) ? b : a);
  return entry[1];
}

// Where the SUSE static TTFs live (served by the web shell from the lockup tool).
// Single source of truth shared by the SVG path emitter and the PDF embedder.
export const SUSE_FONT_DIR = '/catalog/fonts/ttf/';

export function suseFontFile(weight, italic) {
  return `SUSE-${suseWeightName(weight)}${italic ? 'Italic' : ''}.ttf`;
}

/**
 * Resolve a computed style to a SUSE TTF URL host.text.toPath can fetch, or null
 * if this run isn't set in the brand font. (Phase 2 will resolve non-SUSE/system
 * fonts via a font registry or @font-face src; until then those fall back to a
 * plain <text> element — see canVectoriseText.)
 */
export function resolveSuseFontUrl(style) {
  const family = (style.fontFamily || '').toLowerCase();
  if (!family.includes('suse')) return null;
  const weight = parseInt(style.fontWeight) || 400;
  const italic = style.fontStyle === 'italic' || style.fontStyle === 'oblique';
  return SUSE_FONT_DIR + suseFontFile(weight, italic);
}

/**
 * Can this run be faithfully turned into paths right now? We fall back to <text>
 * when there's no host.text primitive, no resolvable font file, or the run uses
 * letter-spacing — which toPath doesn't model but the <text> fallback honours via
 * the letter-spacing attribute, so falling back is strictly better there.
 */
export function canVectoriseText(style, fontUrl, hasTextApi) {
  if (!hasTextApi || !fontUrl) return false;
  if (style.letterSpacing && style.letterSpacing !== 'normal') return false;
  return true;
}

/**
 * Baseline y for one text line. host.text.toPath returns a path with the baseline
 * at y=0; to place it we need the line's baseline in canvas coordinates. Given the
 * line box (top, lineHeight) and the font's ascent/descent in px, leading is split
 * evenly above and below the font box (the CSS "normal" half-leading model).
 */
export function textBaselineY(top, lineHeight, ascent, descent) {
  const leading = lineHeight - (ascent + descent);
  return top + leading / 2 + ascent;
}
