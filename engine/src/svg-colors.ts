// SPDX-License-Identifier: MPL-2.0
/**
 * Pure, DOM-free colour extraction from raw SVG source text.
 *
 * Scans an SVG string (NO DOMParser, no XML library — just string/regex work, in
 * the spirit of the sibling raw-text parsers svg-path.ts / media-sniff.ts /
 * css-box.ts) and returns the distinct colours it paints with, so a shell can
 * offer "the colours in this artwork" without a renderer. Two families of source:
 *
 *   (a) presentation ATTRIBUTES — fill= stroke= stop-color= flood-color=
 *       lighting-color= color= (quoted with " or ').
 *   (b) the equivalent CSS DECLARATIONS — fill: stroke: stop-color: flood-color:
 *       lighting-color: color: — wherever they live. A `style="…"` attribute value
 *       and a `<style>…</style>` block are both just CSS text, so one regex family
 *       covers both; we deliberately do NOT try to tell the two containers apart.
 *
 * Each raw candidate is trimmed, has a trailing `!important` stripped, is rejected
 * if it references a paint server (`url(…)`) or is a keyword that names no colour
 * (none/transparent/currentColor/inherit/…), is shape-checked against the same
 * CSS-injection-hardened SAFE_CSS_COLOR gate the web colour field uses, then run
 * through the engine's colorToHex normaliser. A BARE IDENT must additionally be a
 * real CSS3 named colour (not just any lowercase word) so a stray value leaking
 * from a font-family / class name / id can't be misread as a colour.
 *
 * Output is deduplicated, first-seen order preserved. Hex/rgb()/hsl()/… inputs
 * come back as normalised hex; a valid named colour comes back as its (verbatim)
 * name — colorToHex passes idents through untouched and the named-colour data here
 * is a membership Set (validation only), not an RGB table.
 */

import { colorToHex } from './tokens.ts';

// Copied verbatim from shells/web/src/components/color-field.ts:113 (SAFE_CSS_COLOR).
// MUST stay in sync with that file — it is the shared CSS-injection shape gate
// (bare hex, a colour function whose args carry no nested parens/quotes/semicolons/
// braces, or a plain ident). We cannot import across the engine/shell boundary, so
// the literal is duplicated here on purpose.
const SAFE_CSS_COLOR = /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([^();"'{}<>\\]*\)|[a-z][a-z0-9-]*)$/i;

// A bare CSS ident (i.e. not a #hex, not a fn()). Such a value is only trusted as a
// colour if it is also in NAMED_COLORS below.
const BARE_IDENT = /^[a-z][a-z0-9-]*$/i;

// Keywords that are syntactically colour-shaped but name no paint. colorToHex does
// NOT drop these (colorToHex("none") === "none"), so extraction needs its own list.
const EXCLUDE = new Set<string>([
  'none', 'transparent', 'currentcolor',
  'inherit', 'initial', 'unset', 'revert',
  'context-fill', 'context-stroke',
]);

// The 147 CSS3 extended named colours, copied verbatim (as a membership Set — we
// only need to know a bare ident IS a real colour name; colorToHex handles the
// value) from the SVG_NAMED_COLORS table in
// shells/web/src/bridge/export.ts (~lines 4772-4823). MUST stay in sync with it.
const NAMED_COLORS = new Set<string>([
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige',
  'bisque', 'black', 'blanchedalmond', 'blue', 'blueviolet', 'brown',
  'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue',
  'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan', 'darkgoldenrod',
  'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki', 'darkmagenta', 'darkolivegreen',
  'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen', 'darkslateblue',
  'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue',
  'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen',
  'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray',
  'green', 'greenyellow', 'grey', 'honeydew', 'hotpink', 'indianred',
  'indigo', 'ivory', 'khaki', 'lavender', 'lavenderblush', 'lawngreen',
  'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow', 'lightgray',
  'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon', 'lightseagreen', 'lightskyblue',
  'lightslategray', 'lightslategrey', 'lightsteelblue', 'lightyellow', 'lime', 'limegreen',
  'linen', 'magenta', 'maroon', 'mediumaquamarine', 'mediumblue', 'mediumorchid',
  'mediumpurple', 'mediumseagreen', 'mediumslateblue', 'mediumspringgreen', 'mediumturquoise', 'mediumvioletred',
  'midnightblue', 'mintcream', 'mistyrose', 'moccasin', 'navajowhite', 'navy',
  'oldlace', 'olive', 'olivedrab', 'orange', 'orangered', 'orchid',
  'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff',
  'peru', 'pink', 'plum', 'powderblue', 'purple', 'rebeccapurple',
  'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown',
  'seagreen', 'seashell', 'sienna', 'silver', 'skyblue', 'slateblue',
  'slategray', 'slategrey', 'snow', 'springgreen', 'steelblue', 'tan',
  'teal', 'thistle', 'tomato', 'turquoise', 'violet', 'wheat',
  'white', 'whitesmoke', 'yellow', 'yellowgreen',
]);

// Upper bound on regex matches scanned per call (both passes share it), so a
// pathological input can't spin — mirrors the guard-counter convention in
// media-sniff.ts (its GIF/PNG walk loops bail at a fixed count).
const MATCH_CAP = 100_000;

/**
 * Extract the distinct colours an SVG paints with, as a deduplicated array in
 * first-seen order. Never throws on malformed/partial/non-SVG input — anything it
 * can't read as a real colour is simply skipped.
 */
export function extractSvgColors(svgText: string): string[] {
  const out: string[] = [];
  if (typeof svgText !== 'string' || svgText.length === 0) return out;

  const seen = new Set<string>();

  const consider = (raw: string | undefined): void => {
    if (raw == null) return;
    // Trim, then peel a trailing `!important` (CSS declarations only, but harmless
    // on an attribute value that never has one) and trim again.
    let v = raw.trim().replace(/\s*!important\s*$/i, '').trim();
    if (v.length === 0) return;
    const lc = v.toLowerCase();
    if (lc.startsWith('url(')) return;          // paint-server reference, not a colour
    if (EXCLUDE.has(lc)) return;                // none / transparent / currentColor / …
    if (!SAFE_CSS_COLOR.test(v)) return;        // CSS-injection shape gate (original value)
    if (BARE_IDENT.test(v) && !NAMED_COLORS.has(lc)) return; // stray word, not a real colour
    const hex = colorToHex(v);
    if (hex == null || hex === 'transparent') return; // colorToHex couldn't read it
    // colorToHex already normalises hex/rgb()/hsl()/… to lowercase hex, but a
    // bare named colour passes through VERBATIM (preserved casing) — dedupe on
    // a lowercased key so "RED" and "red" in the same file collapse to one
    // entry (whichever casing was seen first), while still returning that
    // first-seen casing in `out`.
    const key = hex.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(hex);
  };

  let guard = 0;
  let m: RegExpExecArray | null;

  // (a) presentation attributes: name="value" | name='value'. The (?<![-\w]) guard
  // stops `data-color=` / `fill-opacity`-style names (and hyphen-prefixed props like
  // `background-color`) from matching the bare `color` alternative.
  const attrRe =
    /(?<![-\w])(?:fill|stroke|stop-color|flood-color|lighting-color|color)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  while ((m = attrRe.exec(svgText)) && guard++ < MATCH_CAP) {
    consider(m[1] ?? m[2]);
  }

  // (b) CSS declarations: name: value (terminated by ; } or a quote). Covers both a
  // style="…" attribute value and a <style>…</style> block — both are plain CSS text.
  const declRe =
    /(?<![-\w])(?:fill|stroke|stop-color|flood-color|lighting-color|color)\s*:\s*([^;}"']+)/gi;
  while ((m = declRe.exec(svgText)) && guard++ < MATCH_CAP) {
    consider(m[1]);
  }

  return out;
}
