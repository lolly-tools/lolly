// SPDX-License-Identifier: MPL-2.0
/**
 * Pure, DOM-free colour extraction from raw SVG source text.
 *
 * Scans an SVG string. It uses no DOMParser and no XML library, only string
 * and regex work, in the spirit of the sibling raw-text parsers svg-path.ts,
 * media-sniff.ts, and css-box.ts. It returns the distinct colours the SVG
 * paints with, so a shell can offer "the colours in this artwork" without a
 * renderer. Two families of source:
 *
 *   (a) presentation ATTRIBUTES - fill= stroke= stop-color= flood-color=
 *       lighting-color= color= (quoted with " or ').
 *   (b) the equivalent CSS DECLARATIONS - fill: stroke: stop-color: flood-color:
 *       lighting-color: color: - wherever they live. A `style="..."` attribute
 *       value and a `<style>...</style>` block are both just CSS text, so one
 *       regex family covers both. This module deliberately does not try to
 *       tell the two containers apart.
 *
 * Each raw candidate is trimmed, has a trailing `!important` stripped, is rejected
 * if it references a paint server (`url(…)`) or is a keyword that names no colour
 * (none/transparent/currentColor/inherit/…), is shape-checked against the same
 * CSS-injection-hardened SAFE_CSS_COLOR gate the web colour field uses, then run
 * through the engine's colorToHex normaliser. A BARE IDENT must additionally be a
 * real CSS3 named colour, not just any lowercase word, so a stray value leaking
 * from a font-family, class name, or id can't be misread as a colour.
 *
 * Output is deduplicated, first-seen order preserved. Hex/rgb()/hsl()/... inputs
 * come back as normalised hex. A valid named colour comes back as its verbatim
 * name: colorToHex passes idents through untouched, and the name is only
 * validated (against css-color.ts's table) here, never converted.
 */

import { colorToHex } from './tokens.ts';
import { isNamedColor } from './css-color.ts';

// Copied verbatim from shells/web/src/components/color-field.ts:113 (SAFE_CSS_COLOR).
// Must stay in sync with that file. It is the shared CSS-injection shape gate:
// bare hex, a colour function whose args carry no nested parens/quotes/semicolons/
// braces, or a plain ident. This code cannot import across the engine/shell
// boundary, so the literal is duplicated here on purpose.
const SAFE_CSS_COLOR = /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([^();"'{}<>\\]*\)|[a-z][a-z0-9-]*)$/i;

// A bare CSS ident (i.e. not a #hex, not a fn()). Such a value is only trusted as a
// colour if css-color.ts's table also knows it as a real CSS named colour.
const BARE_IDENT = /^[a-z][a-z0-9-]*$/i;

// Keywords that are syntactically colour-shaped but name no paint. colorToHex does
// NOT drop these (colorToHex("none") === "none"), so extraction needs its own list.
const EXCLUDE = new Set<string>([
  'none', 'transparent', 'currentcolor',
  'inherit', 'initial', 'unset', 'revert',
  'context-fill', 'context-stroke',
]);


// Upper bound on regex matches scanned per call (both passes share it), so a
// pathological input can't spin. This mirrors the guard-counter convention in
// media-sniff.ts, whose GIF/PNG walk loops bail at a fixed count.
const MATCH_CAP = 100_000;

/**
 * Extract the distinct colours an SVG paints with, as a deduplicated array in
 * first-seen order. Never throws on malformed, partial, or non-SVG input;
 * anything it can't read as a real colour is simply skipped.
 */
export function extractSvgColors(svgText: string): string[] {
  const out: string[] = [];
  if (typeof svgText !== 'string' || svgText.length === 0) return out;

  const seen = new Set<string>();

  const consider = (raw: string | undefined): void => {
    if (raw == null) return;
    // Trim, then peel a trailing `!important` (CSS declarations only, but harmless
    // on an attribute value that never has one), then trim again.
    let v = raw.trim().replace(/\s*!important\s*$/i, '').trim();
    if (v.length === 0) return;
    const lc = v.toLowerCase();
    if (lc.startsWith('url(')) return;          // paint-server reference, not a colour
    if (EXCLUDE.has(lc)) return;                // none / transparent / currentColor / etc.
    if (!SAFE_CSS_COLOR.test(v)) return;        // CSS-injection shape gate (original value)
    if (BARE_IDENT.test(v) && !isNamedColor(lc)) return; // stray word, not a real colour
    const hex = colorToHex(v);
    if (hex == null || hex === 'transparent') return; // colorToHex couldn't read it
    // colorToHex already normalises hex/rgb()/hsl()/etc. to lowercase hex, but a
    // bare named colour passes through verbatim, with casing preserved. Dedupe on
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
  // stops `data-color=` / `fill-opacity`-style names, and hyphen-prefixed props like
  // `background-color`, from matching the bare `color` alternative.
  const attrRe =
    /(?<![-\w])(?:fill|stroke|stop-color|flood-color|lighting-color|color)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  while ((m = attrRe.exec(svgText)) && guard++ < MATCH_CAP) {
    consider(m[1] ?? m[2]);
  }

  // (b) CSS declarations: name: value (terminated by ; } or a quote). Covers both a
  // style="..." attribute value and a <style>...</style> block, since both are plain CSS text.
  const declRe =
    /(?<![-\w])(?:fill|stroke|stop-color|flood-color|lighting-color|color)\s*:\s*([^;}"']+)/gi;
  while ((m = declRe.exec(svgText)) && guard++ < MATCH_CAP) {
    consider(m[1]);
  }

  return out;
}
