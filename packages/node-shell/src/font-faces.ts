// SPDX-License-Identifier: MPL-2.0
/**
 * Pure CSS font helpers: split a `font-family` stack, read a `unicode-range`, pick
 * the faces a run is drawn from, and read the `@font-face` rules out of stylesheet
 * text. No DOM, no network, no Node.
 *
 * MOVED here from `shells/web/src/bridge/font-registry.ts`, which keeps re-exporting
 * the first five, so the web registry and url-shot's page walk choose faces by one
 * rule. The page walk records which faces a captured page loaded and the shell picks
 * among them here, then outlines each run with that face (page-text.ts).
 */
import type { FontStyleSlice } from './text-svg.ts';

/**
 * Split a computed CSS `font-family` into its families, in order, unquoted:
 * `"'Space Grotesk', Outfit, ui-sans-serif"` → `['Space Grotesk','Outfit','ui-sans-serif']`.
 * Commas inside quotes stay put (a family may legally contain one).
 */
export function parseFontFamilies(css: string | undefined): string[] {
  const out: string[] = [];
  let cur = '';
  let quote = '';
  for (const ch of String(css ?? '')) {
    if (quote) {
      if (ch === quote) quote = '';
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ',') {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out.filter(Boolean);
}

/**
 * Parse a CSS `unicode-range` value to inclusive codepoint pairs.
 * Handles the three grammatical forms: `U+0-7F`, `U+2212`, and the wildcard
 * `U+4??` (which spans U+400–U+4FF). An empty/absent value → `[]`, which
 * `rangesCover` treats as "covers everything" (an unsubsetted face).
 */
export function parseUnicodeRange(spec: string | undefined): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const raw of String(spec ?? '').split(',')) {
    const t = raw.trim();
    if (!/^u\+/i.test(t)) continue;
    const body = t.slice(2);
    if (body.includes('?')) {
      const lo = parseInt(body.replace(/\?/g, '0'), 16);
      const hi = parseInt(body.replace(/\?/g, 'F'), 16);
      if (Number.isFinite(lo) && Number.isFinite(hi)) out.push([lo, hi]);
      continue;
    }
    const [a, b] = body.split('-');
    const lo = parseInt(a ?? '', 16);
    const hi = b == null ? lo : parseInt(b, 16);
    if (Number.isFinite(lo) && Number.isFinite(hi)) out.push([lo, hi]);
  }
  return out;
}

/** Does this face cover every codepoint in `text`? Whitespace is ignored (it
 *  never needs a glyph in an outline), and an empty range list means "all". */
export function rangesCover(ranges: Array<[number, number]>, text: string): boolean {
  if (!ranges.length) return true;
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    const cp = ch.codePointAt(0)!;
    if (!ranges.some(([lo, hi]) => cp >= lo && cp <= hi)) return false;
  }
  return true;
}

/** How many of `text`'s visible characters this face can draw. Ranks the
 *  fallback chain: the face carrying most of the run leads. An unsubsetted
 *  face (no ranges) claims everything. */
export function coverageCount(ranges: Array<[number, number]>, text: string): number {
  let n = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    const cp = ch.codePointAt(0)!;
    if (!ranges.length || ranges.some(([lo, hi]) => cp >= lo && cp <= hi)) n++;
  }
  return n;
}

/** Is this face a variable one (a `wght` RANGE rather than a single value)? */
export const weightRange = (weight: string): [number, number] | null => {
  const parts = weight.trim().split(/\s+/).map(Number);
  return parts.length === 2 && parts.every(Number.isFinite) ? [parts[0]!, parts[1]!] : null;
};

/** The three fields of a face that choosing between faces reads. */
export interface PickableFace { weight: string; style: string; unicodeRange: string }

/**
 * Order this family's faces into a shaping chain for `text`: the face that
 * carries most of the run leads, its siblings follow to cover the rest (the
 * subsets are disjoint, so "Łódź" genuinely needs both `latin` and `latin-ext`).
 *
 * Weight is settled BEFORE coverage: a variable face can hit any weight, so all
 * variable subsets take a `wght` axis for the run; a static family narrows to
 * the nearest available weight, and faces of the other weights are dropped
 * (a bold run must never fall back into the regular file).
 *
 * Italic is deliberately strict: we never download italic faces, and outlining
 * an upright face for an italic run would silently un-slant the text. An empty
 * chain keeps the caller's honest <text> fallback. Exported for tests.
 */
export function pickFaces<F extends PickableFace>(faces: F[], style: FontStyleSlice, text: string): Array<{ face: F; variations?: string[] }> {
  const italic = style.fontStyle === 'italic' || style.fontStyle === 'oblique';
  const weight = parseInt(style.fontWeight ?? '', 10) || 400;
  const slantOk = faces.filter(f => (f.style === 'italic') === italic);
  if (!slantOk.length) return [];

  const variable = slantOk.filter(f => weightRange(f.weight));
  let candidates: Array<{ face: F; variations?: string[] }>;
  if (variable.length) {
    candidates = variable.map(f => {
      const [lo, hi] = weightRange(f.weight)!;
      return { face: f, variations: [`wght=${Math.min(hi, Math.max(lo, weight))}`] };
    });
  } else {
    const nearest = slantOk.reduce((a, b) =>
      Math.abs(parseInt(b.weight, 10) - weight) < Math.abs(parseInt(a.weight, 10) - weight) ? b : a);
    candidates = slantOk.filter(f => f.weight === nearest.weight).map(face => ({ face }));
  }

  // Rank by how much of THIS run each face can draw; a face that draws none of
  // it (the latin-ext subset of an ASCII run) has no place in the chain.
  return candidates
    .map(c => ({ ...c, n: coverageCount(parseUnicodeRange(c.face.unicodeRange), text) }))
    .filter(c => c.n > 0)
    .sort((a, b) => b.n - a.n)
    .map(({ n: _n, ...c }) => c);
}

/** One `@font-face` rule, reduced to how a face is matched and where its bytes are. */
export interface FontFaceRule extends PickableFace {
  /** As declared, unquoted. Compare lowercased. */
  family: string;
  /** Every `url()` in `src`, in order, made absolute against the sheet. */
  urls: string[];
}

/**
 * Read the `@font-face` rules out of stylesheet text, wherever they sit (inside
 * `@media` and `@supports` too). Relative `url()`s resolve against `baseUrl`, the
 * sheet's own address. `local()` sources are skipped: the bytes are on the
 * viewer's machine, not in the page.
 */
export function parseFontFaceCss(css: string, baseUrl: string): FontFaceRule[] {
  const out: FontFaceRule[] = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of text.matchAll(/@font-face\s*\{([^}]*)\}/gi)) {
    const body = m[1]!;
    const prop = (name: string): string => {
      const r = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]*)`, 'i').exec(body);
      return r ? r[1]!.trim() : '';
    };
    const family = prop('font-family').replace(/^["']|["']$/g, '').trim();
    if (!family) continue;
    const urls: string[] = [];
    for (const u of prop('src').matchAll(/url\(\s*(["']?)([^)"']+)\1\s*\)/g)) {
      try { urls.push(new URL(u[2]!.trim(), baseUrl).href); } catch { /* an unparseable url() is skipped */ }
    }
    if (!urls.length) continue;
    out.push({
      family,
      urls,
      weight: normaliseWeight(prop('font-weight') || '400'),
      style: (prop('font-style') || 'normal').split(/\s+/)[0]!.toLowerCase(),
      unicodeRange: prop('unicode-range'),
    });
  }
  return out;
}

/** `normal`/`bold`/`300 700`/`400` → the numeric form pickFaces reads. */
export function normaliseWeight(weight: string): string {
  const w = weight.trim().toLowerCase();
  if (w === 'normal') return '400';
  if (w === 'bold') return '700';
  const parts = w.split(/\s+/).map(p => (p === 'normal' ? '400' : p === 'bold' ? '700' : p));
  return parts.length === 2 && parts[0] === parts[1] ? parts[0]! : parts.join(' ');
}
