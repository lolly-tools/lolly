// SPDX-License-Identifier: MPL-2.0
/**
 * recolor-logo.ts - derived logo variants by pure SVG recolour (plan 97 section 7.3).
 *
 * From a placed colour SVG the Logos room offers two GENERATED marks, added
 * only on tap: a **mono** version (every paint becomes one ink) and a
 * **reverse** version (dark ink flipped to white so the mark reads on a dark
 * ground). SVG only in v1 - a raster recolour is a different job with different
 * failure modes, and this module is the one that must stay pure.
 *
 * Three properties hold, and the tests pin all three:
 *
 * 1. **Nothing but paint values change.** The source text is edited in place,
 *    one value span at a time, so whitespace, ids, `viewBox`, attribute order,
 *    comments and `!important` all come back byte-for-byte. No DOM, no
 *    re-serialisation, no reformatting.
 * 2. **A gradient or pattern makes the mark ineligible.** A single-ink recolour
 *    that silently flattened a `url(#…)` paint would lie about the mark, so any
 *    paint-server reference returns null from both derivations rather than a
 *    plausible-looking wrong answer.
 * 3. **Only values we can actually read as colours are rewritten.** Anything
 *    else (a keyword like `none`, a malformed value, someone's hostile string)
 *    is left exactly as authored, and every value we DO write is a normalised
 *    hex produced by the engine, never text that came in.
 *
 * COVERAGE mirrors the engine's `extractSvgColors` (`engine/src/svg-colors.ts`):
 * the same six paint properties (`fill` `stroke` `stop-color` `flood-color`
 * `lighting-color` `color`), the same presentation-attribute + CSS-declaration
 * split, the same `!important` peel, the same `url(…)`/keyword exclusions. One
 * deliberate difference: that module does not bother telling a `style="…"`
 * attribute apart from a `<style>` block or from any other run of text, because
 * it only READS. A rewrite must tell them apart - otherwise a `<text>` node that
 * happens to read "fill: red" would be edited, which is a visible corruption of
 * the artwork. So the declaration pass here runs only inside real CSS containers
 * (a `style` attribute value, a `<style>` element body), and skips comments.
 * On real SVGs the two scans see the same set of paints; on adversarial ones
 * this one edits strictly less.
 */

import { parseColor, colorToHexString, hexToOklch } from '@lolly/engine';
import type { CssColor } from '@lolly/engine';

/** OKLCH lightness below this is dark ink, i.e. ink that needs a light ground. */
const DARK_L_MAX = 0.35;

/** The light ink a reverse variant paints with. */
const REVERSE_INK: CssColor = { space: 'srgb', components: [1, 1, 1], alpha: 1, missing: 0 };

/** Upper bound on regex matches scanned per call, shared by every pass, so a
 *  pathological input cannot spin - same guard convention as svg-colors.ts. */
const MATCH_CAP = 100_000;

/** Syntactically paint-shaped keywords that name no colour. Left verbatim: they
 *  are the author saying "do not paint this" (or "paint it like the parent"),
 *  which a recolour has no business overruling. */
const KEEP = new Set<string>([
  'none', 'transparent',
  'inherit', 'initial', 'unset', 'revert',
  'context-fill', 'context-stroke',
]);

const PAINT_PROPS = 'fill|stroke|stop-color|flood-color|lighting-color|color';

/** Presentation attributes. The `(?<![-\w])` guard is svg-colors.ts's: it stops
 *  `data-color=` and hyphenated props like `stop-color` from matching the bare
 *  `color` alternative twice. */
const ATTR_RE = new RegExp(`(?<![-\\w])(?:${PAINT_PROPS})\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'gi');
/** The CSS declaration form, run only over CSS containers (see the header). */
const DECL_RE = new RegExp(`(?<![-\\w])(?:${PAINT_PROPS})\\s*:\\s*([^;}"']+)`, 'gi');

const STYLE_ATTR_RE = /(?<![-\w])style\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const OPEN_STYLE_RE = /<style\b[^>]*>/gi;
const COMMENT_RE = /<!--[\s\S]*?-->/g;
const IMPORTANT_RE = /\s*!important\s*$/i;

/** One rewritable paint value: the half-open span of the value TOKEN in the
 *  source (leading/trailing whitespace and any `!important` already excluded). */
interface PaintSite { start: number; end: number; value: string }

interface Scan {
  /** True when the text carries an `<svg>` root at all. */
  isSvg: boolean;
  /** True when any paint references a paint server - gradient, pattern, `<use>`
   *  paint. Blocks both derivations. */
  paintServer: boolean;
  sites: PaintSite[];
}

/** A paint we can read, with what the derivations need to judge it. `lightness`
 *  and `hex` are null for `currentColor`, whose value is not knowable from the
 *  text. `hex` is the engine's NORMALISED form of the authored value, which is
 *  what a derivation compares its own output against: `#FFF`, `#ffffff` and
 *  `white` are the same ink, and the raw source token is not comparable to a
 *  generated one. */
interface PaintRead {
  site: PaintSite;
  alpha: number;
  lightness: number | null;
  hex: string | null;
}

interface Edit { start: number; end: number; text: string }

/** Half-open [start, end) ranges of every comment, so nothing inside one is
 *  treated as live markup and rewritten. */
function commentRanges(text: string): [number, number][] {
  const out: [number, number][] = [];
  const re = new RegExp(COMMENT_RE.source, 'g');
  let m: RegExpExecArray | null;
  let guard = 0;
  while ((m = re.exec(text)) && guard++ < MATCH_CAP) out.push([m.index, m.index + m[0].length]);
  return out;
}

/**
 * Trim a raw captured value down to its colour token, returning the token plus
 * how many characters were dropped from the front - the caller turns that into
 * an absolute span. A trailing `!important` is peeled (declarations only, but
 * harmless on an attribute value), exactly as svg-colors.ts does.
 */
function coreOf(raw: string): { value: string; offset: number } {
  let end = raw.length;
  const imp = IMPORTANT_RE.exec(raw);
  if (imp) end = imp.index;
  let start = 0;
  while (start < end && /\s/.test(raw[start]!)) start++;
  while (end > start && /\s/.test(raw[end - 1]!)) end--;
  return { value: raw.slice(start, end), offset: start };
}

/**
 * Every paint value in the text, in source order, with paint-server references
 * flagged. Never throws: unreadable input simply yields no sites.
 */
function scanPaints(svgText: string): Scan {
  const empty: Scan = { isSvg: false, paintServer: false, sites: [] };
  if (typeof svgText !== 'string' || svgText.length === 0) return empty;
  if (!/<svg[\s/>]/i.test(svgText)) return empty;

  const comments = commentRanges(svgText);
  const inComment = (pos: number): boolean => comments.some(([a, b]) => pos >= a && pos < b);

  const sites: PaintSite[] = [];
  let paintServer = false;
  let guard = 0;

  const consider = (raw: string, rawStart: number): void => {
    const { value, offset } = coreOf(raw);
    if (value.length === 0) return;
    const start = rawStart + offset;
    if (inComment(start)) return;
    if (value.toLowerCase().startsWith('url(')) { paintServer = true; return; }
    sites.push({ start, end: start + value.length, value });
  };

  // (a) presentation attributes. The match ends at the closing quote, so the
  // captured value starts one character before that.
  const attrRe = new RegExp(ATTR_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(svgText)) && guard++ < MATCH_CAP) {
    const raw = m[1] ?? m[2] ?? '';
    consider(raw, m.index + m[0].length - 1 - raw.length);
  }

  // (b) CSS declarations, inside CSS containers only.
  const regions: [number, number][] = [];
  const styleAttrRe = new RegExp(STYLE_ATTR_RE.source, 'gi');
  while ((m = styleAttrRe.exec(svgText)) && guard++ < MATCH_CAP) {
    const raw = m[1] ?? m[2] ?? '';
    const start = m.index + m[0].length - 1 - raw.length;
    regions.push([start, start + raw.length]);
  }
  const lower = svgText.toLowerCase();
  const openStyleRe = new RegExp(OPEN_STYLE_RE.source, 'gi');
  while ((m = openStyleRe.exec(svgText)) && guard++ < MATCH_CAP) {
    const start = m.index + m[0].length;
    const close = lower.indexOf('</style', start);
    regions.push([start, close === -1 ? svgText.length : close]);
  }

  for (const [from, to] of regions) {
    const css = svgText.slice(from, to);
    const declRe = new RegExp(DECL_RE.source, 'gi');
    while ((m = declRe.exec(css)) && guard++ < MATCH_CAP) {
      const raw = m[1] ?? '';
      consider(raw, from + m.index + m[0].length - raw.length);
    }
  }

  sites.sort((a, b) => a.start - b.start);
  // A style attribute is scanned by both passes only if a paint property also
  // names it, which cannot happen; the overlap filter is belt and braces so a
  // future pass can never emit two edits over one span.
  const deduped: PaintSite[] = [];
  for (const site of sites) {
    const prev = deduped[deduped.length - 1];
    if (prev && site.start < prev.end) continue;
    deduped.push(site);
  }

  return { isSvg: true, paintServer, sites: deduped };
}

/** The paints a derivation may rewrite, skipping keywords and anything the
 *  engine cannot read as a colour. */
function readablePaints(scan: Scan): PaintRead[] {
  const out: PaintRead[] = [];
  for (const site of scan.sites) {
    const lc = site.value.toLowerCase();
    if (KEEP.has(lc)) continue;
    if (lc === 'currentcolor') {
      // Paints with the inherited `color`, which the `color` declaration sites
      // in this same scan may themselves rewrite. Recolourable, unjudgeable.
      out.push({ site, alpha: 1, lightness: null, hex: null });
      continue;
    }
    const parsed = parseColor(site.value);
    if (!parsed) continue;                 // not a colour: leave the author's text alone
    if (!(parsed.alpha > 0)) continue;     // invisible paint stays invisible
    const hex = colorToHexString(parsed);
    const lch = hexToOklch(hex);
    out.push({ site, alpha: parsed.alpha, lightness: lch ? lch.l : null, hex });
  }
  return out;
}

/** Splice non-overlapping, ascending edits into the text. */
function applyEdits(text: string, edits: Edit[]): string {
  let out = '';
  let cursor = 0;
  for (const edit of edits) {
    out += text.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  return out + text.slice(cursor);
}

/**
 * Single-ink recolour: every readable paint becomes `ink`, keeping the paint's
 * own alpha so a mark that uses a translucent tone keeps that tone. Returns
 * null when `ink` is not a colour, when the mark uses a gradient or pattern,
 * when there is no readable paint, or when the result would be the input
 * unchanged (the mark is already this one ink, so there is no variant to offer).
 */
export function deriveMonoSvg(svgText: string, ink: string): string | null {
  const inkColor = parseColor(ink);
  if (!inkColor || !(inkColor.alpha > 0)) return null;

  const scan = scanPaints(svgText);
  if (!scan.isSvg || scan.paintServer) return null;

  const edits: Edit[] = [];
  for (const paint of readablePaints(scan)) {
    const next = colorToHexString({ ...inkColor, alpha: inkColor.alpha * paint.alpha });
    // Against the NORMALISED source colour, never the authored token: `#0B1F3A`,
    // `#0b1f3a` and `rgb(11 31 58)` are one ink, and comparing raw text would
    // emit a no-op edit for two of the three (and then claim a variant exists).
    // `currentColor` has no hex and is always rewritten.
    if (paint.hex !== null && next === paint.hex) continue;
    edits.push({ start: paint.site.start, end: paint.site.end, text: next });
  }
  if (edits.length === 0) return null;
  return applyEdits(svgText, edits);
}

/**
 * Light-for-dark recolour: dark ink becomes white, mid and light ink is kept, so
 * the mark reads on a dark ground. `currentColor` is kept too - its lightness is
 * not knowable from the text, and guessing would be the kind of silent lie this
 * module refuses elsewhere. Returns null when the mark uses a gradient or
 * pattern, and when nothing changes.
 */
export function deriveReverseSvg(svgText: string): string | null {
  const scan = scanPaints(svgText);
  if (!scan.isSvg || scan.paintServer) return null;

  const edits: Edit[] = [];
  for (const paint of readablePaints(scan)) {
    if (paint.lightness == null || paint.lightness >= DARK_L_MAX) continue;
    const next = colorToHexString({ ...REVERSE_INK, alpha: paint.alpha });
    // Same rule as deriveMonoSvg: compare normalised hex, not authored text.
    if (next === paint.hex) continue;
    edits.push({ start: paint.site.start, end: paint.site.end, text: next });
  }
  if (edits.length === 0) return null;
  return applyEdits(svgText, edits);
}

export interface DerivedEligibility {
  mono: boolean;
  reverse: boolean;
  /** Present only when something is unavailable: a short chip-sized English
   *  fragment naming what stopped it. */
  reason?: string;
}

/**
 * What the Logos room may offer for this file, and why not when it may not.
 *
 * `mono: true` means there is a paint to recolour, not that any given ink will
 * produce a different mark: `deriveMonoSvg` can still return null when the
 * requested ink is already the mark's only ink.
 */
export function eligibleForDerivedVariants(svgText: string): DerivedEligibility {
  const scan = scanPaints(svgText);
  if (!scan.isSvg) return { mono: false, reverse: false, reason: 'not readable as an SVG' };
  if (scan.paintServer) {
    return { mono: false, reverse: false, reason: 'painted with a gradient or pattern' };
  }

  const paints = readablePaints(scan);
  if (paints.length === 0) return { mono: false, reverse: false, reason: 'no paints found' };

  const dark = paints.some(p => p.lightness != null && p.lightness < DARK_L_MAX);
  if (!dark) return { mono: true, reverse: false, reason: 'no dark ink to reverse' };
  return { mono: true, reverse: true };
}
