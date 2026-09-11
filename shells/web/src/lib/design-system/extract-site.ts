// SPDX-License-Identifier: MPL-2.0
/**
 * extract-site.ts - the pure HTML/CSS → `DesignCensus` parser behind the Design
 * System studio's website source (plan 97 section 9 / SS9).
 *
 * Transport-agnostic on purpose: the Tauri native fetch and the Chrome extension
 * both hand this module the same three things - the page's HTML, the text of the
 * stylesheets they resolved, and the address they fetched - and get back a census
 * plus the logo candidates and the site's own name. Nothing here fetches, and
 * nothing here touches the DOM: no DOMParser, no `document`, no network. Pure
 * string/regex work, in the spirit of `engine/src/svg-colors.ts`, whose three
 * habits this file keeps deliberately:
 *
 *   1. A shared MATCH_CAP budget across every scan, so a hostile page degrades to
 *      partial output instead of spinning. Fonts are scanned BEFORE colours - 
 *      colour declarations outnumber font ones by an order of magnitude on a real
 *      page, so scanning them first would let them starve the rarer, more valuable
 *      type signal when the budget runs out.
 *   2. Every raw candidate goes through the engine's own colour authority
 *      (`parseColor` → `colorToHexString`); a BARE IDENT must additionally be a
 *      real CSS named colour, so a class name or a font token leaking into a value
 *      can't be misread as paint.
 *   3. Malformed input is skipped, never thrown on. An unterminated attribute
 *      quote drops that one tag; an unclosed `<style>` reads to end of document.
 *
 * Known, accepted limits: markup inside HTML comments is read as markup (a
 * commented-out `<link rel=icon>` becomes a logo candidate); a selector further
 * than SELECTOR_LOOKBACK characters from its declaration is read truncated; and
 * `@media`/`@supports` wrappers are not modelled - only the innermost selector
 * text is consulted, which is all the heading heuristic needs.
 */

import { colorToHexString, isNamedColor, parseColor } from '@lolly/engine';
import type { CensusColor, CensusFont, CensusGradient, DesignCensus } from './census.ts';

export interface SiteInput {
  /** The page's HTML source, as fetched or as serialised from the live DOM. */
  html: string;
  /** Text of the stylesheets the transport resolved, in document order. */
  cssTexts?: string[];
  /** The address the HTML came from; relative URLs resolve against it. */
  baseUrl?: string;
}

export interface SiteExtract {
  census: DesignCensus;
  /** Absolute (where resolvable) logo candidates, best-quality first. */
  logoUrls: string[];
  siteName?: string;
  /** Families a `fonts.googleapis.com` link asks for, in discovery order. */
  googleFamilies: string[];
}

// ─── Caps ─────────────────────────────────────────────────────────────────────

/** Regex matches scanned per call, shared by every pass (svg-colors' MATCH_CAP). */
const MATCH_CAP = 100_000;
const MAX_LOGO_CANDIDATES = 200;
const MAX_LOGOS = 10;
const MAX_COLORS = 400;
const MAX_GRADIENTS = 60;
const MAX_FONTS = 120;
const MAX_GOOGLE_FAMILIES = 40;
const MAX_STYLE_BLOCKS = 200;
const MAX_STYLE_ATTRS = 2_000;
const MAX_ATTRS_PER_TAG = 64;
const MAX_TOKENS_PER_VALUE = 64;
const MAX_GRADIENTS_PER_VALUE = 8;
/** How far back from a declaration we look for its selector, in characters. */
const SELECTOR_LOOKBACK = 400;
const MAX_NAME_LEN = 200;
const MAX_URL_LEN = 2_048;

// ─── Patterns ─────────────────────────────────────────────────────────────────

// An element's open tag: name + attribute blob. Quoted attribute values may hold
// `>`, hence the three-way alternation; an UNTERMINATED quote makes the whole tag
// fail to match, which is the tolerant outcome we want (drop one tag, not the page).
const TAG_RE = /<([a-zA-Z][a-zA-Z0-9:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
const CLOSE_STYLE_RE = /<\/style\s*>/gi;
const CLOSE_TITLE_RE = /<\/title\s*>/gi;
const CLOSE_SCRIPT_RE = /<\/script\s*>/gi;

// name, name="v", name='v', name=v - a valueless attribute reads as "".
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;

// The colour-bearing declarations, plus any custom property. The lookbehind stops
// `-webkit-text-fill-color` / `background-image` / `fill-opacity` from matching a
// shorter alternative. Values stop at `;` `{` `}` or a stray `<`/`>`.
const COLOR_DECL_RE =
  /(?<![-\w])(--[a-zA-Z0-9_-]+|background-color|background|border-(?:top|right|bottom|left)(?:-color)?|border-color|border|color|fill)\s*:\s*([^;{}<>]+)/gi;

const FONT_DECL_RE = /(?<![-\w])font-family\s*:\s*([^;{}<>]+)/gi;

// A colour-shaped token inside a declaration value. `[^()]*` (no nesting) is
// deliberate: it keeps a colour function from swallowing the rest of a shorthand.
const VALUE_TOKEN_RE =
  /(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^()]*\)|#[0-9a-fA-F]{3,8}(?![0-9a-fA-F])|[a-zA-Z][a-zA-Z0-9-]*/g;

// One level of nesting so `linear-gradient(90deg, rgb(0 0 0), #fff)` reads whole.
// The two alternatives are disjoint on their first character, so this cannot
// backtrack catastrophically.
const GRADIENT_RE =
  /(?:repeating-)?(?:linear|radial|conic)-gradient\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi;

const URL_FN_RE = /url\([^)]*\)/gi;
const BARE_IDENT = /^[a-z][a-z0-9-]*$/i;
const LEADING_ANGLE_RE = /^\s*(-?\d+(?:\.\d+)?)\s*deg(?![a-z])/i;
// `h1`/`h2`/`h3` as a whole selector token - `.hero-h1` and `#h1x` must not match.
const HEADING_SEL_RE = /(?:^|[^\w-])h[1-3](?![\w-])/i;

/** Syntactically colour-shaped, but naming no paint. */
const NON_PAINT = new Set<string>([
  'transparent', 'currentcolor', 'none', 'auto',
  'inherit', 'initial', 'unset', 'revert', 'revert-layer',
]);

/** Generic and system families - real faces, but never a design system's own. */
const GENERIC_FAMILIES = new Set<string>([
  'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'math', 'emoji', 'fangsong',
  'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded',
  'blinkmacsystemfont', 'inherit', 'initial', 'unset', 'revert', 'none', 'auto',
]);

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '-', ndash: '–', hellip: '…', middot: '·',
  copy: '©', reg: '®', trade: '™', times: '×',
  laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘',
};

// ─── Small pure helpers ───────────────────────────────────────────────────────

interface Budget { left: number }

function scan(re: RegExp, text: string, budget: Budget, fn: (m: RegExpExecArray) => void): void {
  if (text.length === 0) return;
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while (budget.left > 0 && (m = re.exec(text)) !== null) {
    budget.left -= 1;
    fn(m);
  }
}

function decodeEntities(s: string): string {
  if (s.indexOf('&') < 0) return s;
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,10});/g, (whole, body: string) => {
    if (body.charCodeAt(0) === 35 /* # */) {
      const hex = body.charAt(1) === 'x' || body.charAt(1) === 'X';
      const code = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      return String.fromCodePoint(code);
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

const cleanText = (s: string): string => decodeEntities(s).replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LEN);

/** Attributes of one open tag, lowercased names, entity-decoded values, first wins. */
function tagAttrs(blob: string, budget: Budget): Map<string, string> {
  const out = new Map<string, string>();
  if (blob.length === 0) return out;
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while (out.size < MAX_ATTRS_PER_TAG && budget.left > 0 && (m = ATTR_RE.exec(blob)) !== null) {
    budget.left -= 1;
    const name = (m[1] ?? '').toLowerCase();
    if (out.has(name)) continue;
    out.set(name, decodeEntities(m[2] ?? m[3] ?? m[4] ?? ''));
  }
  return out;
}

/**
 * The body of the element whose open tag `openRe` just matched, advancing
 * `openRe` past the close tag so the body is never rescanned as markup.
 */
function sliceBody(text: string, openRe: RegExp, closeRe: RegExp): string {
  const start = openRe.lastIndex;
  closeRe.lastIndex = start;
  const c = closeRe.exec(text);
  const end = c ? c.index : text.length;
  openRe.lastIndex = c ? closeRe.lastIndex : text.length;
  return text.slice(start, end);
}

/**
 * The selector text a declaration at `idx` sits under, read from a bounded window
 * so a pathological stylesheet can't make this quadratic.
 */
function selectorFor(css: string, idx: number): string {
  const head = css.slice(Math.max(0, idx - SELECTOR_LOOKBACK), idx);
  const brace = head.lastIndexOf('{');
  if (brace < 0) return '';
  const sel = head.slice(0, brace);
  const cut = Math.max(sel.lastIndexOf('}'), sel.lastIndexOf('{'), sel.lastIndexOf(';'));
  return cut >= 0 ? sel.slice(cut + 1) : sel;
}

/** A raw CSS value token as a normalised hex, or null when it names no paint. */
function normalizeColor(raw: string): string | null {
  const v = raw.trim().replace(/\s*!important\s*$/i, '').trim();
  if (v.length === 0) return null;
  const lc = v.toLowerCase();
  if (NON_PAINT.has(lc)) return null;
  if (BARE_IDENT.test(v) && !isNamedColor(lc)) return null;
  const c = parseColor(v);
  if (!c || c.alpha <= 0) return null;
  return colorToHexString(c);
}

/** Every colour a declaration value paints with, in written order. */
function colorTokens(value: string): string[] {
  const out: string[] = [];
  if (value.length === 0) return out;
  VALUE_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while (n < MAX_TOKENS_PER_VALUE && (m = VALUE_TOKEN_RE.exec(value)) !== null) {
    n += 1;
    const hex = normalizeColor(m[0]);
    if (hex != null) out.push(hex);
  }
  return out;
}

function gradientsIn(value: string): { stops: string[]; angle?: number }[] {
  const out: { stops: string[]; angle?: number }[] = [];
  if (value.indexOf('gradient(') < 0) return out;
  GRADIENT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  let n = 0;
  while (n < MAX_GRADIENTS_PER_VALUE && (m = GRADIENT_RE.exec(value)) !== null) {
    n += 1;
    const inner = m[1] ?? '';
    const stops = colorTokens(inner);
    if (stops.length < 2) continue;
    const angle = LEADING_ANGLE_RE.exec(inner);
    out.push(angle ? { stops, angle: Number(angle[1]) } : { stops });
  }
  return out;
}

/** The first real family in a stack, unquoted; null for generics and `var()`. */
function firstFamily(stack: string): string | null {
  const first = stack.split(',')[0] ?? '';
  let f = first.trim().replace(/\s*!important\s*$/i, '').trim();
  if (f.length >= 2 && ((f.startsWith('"') && f.endsWith('"')) || (f.startsWith("'") && f.endsWith("'")))) {
    f = f.slice(1, -1).trim();
  }
  if (f.length === 0 || f.length > 64) return null;
  if (GENERIC_FAMILIES.has(f.toLowerCase())) return null;
  // Shape gate: a family name, not a `var()` reference or leaked markup.
  if (!/^[A-Za-z0-9][A-Za-z0-9 ._'’&+-]*$/.test(f)) return null;
  return f;
}

type Usage = CensusFont['usage'];
const USAGE_PRIORITY: readonly Usage[] = ['heading', 'mono', 'body', 'unknown'];

function dominantUsage(usages: Map<Usage, number>): Usage {
  let best: Usage = 'body';
  let bestN = 0;
  for (const u of USAGE_PRIORITY) {
    const n = usages.get(u) ?? 0;
    if (n > bestN) { best = u; bestN = n; }
  }
  return best;
}

// ─── The parser ───────────────────────────────────────────────────────────────

/**
 * Read a fetched page into a design census plus its logo candidates, name, and
 * requested Google families. Never throws: any input that isn't readable simply
 * contributes nothing.
 */
export function extractSite(input: SiteInput): SiteExtract {
  const budget: Budget = { left: MATCH_CAP };
  const html = typeof input?.html === 'string' ? input.html : '';
  const baseUrl = typeof input?.baseUrl === 'string' && input.baseUrl.length > 0 ? input.baseUrl : undefined;
  const cssTexts = Array.isArray(input?.cssTexts) ? input.cssTexts.filter(t => typeof t === 'string') : [];

  const colorMap = new Map<string, { hex: string; weight: number; kind: CensusColor['kind']; order: number }>();
  const gradientMap = new Map<string, { stops: string[]; angle?: number; weight: number; order: number }>();
  const fontMap = new Map<string, { family: string; total: number; usages: Map<Usage, number>; order: number }>();
  const logoSeen = new Set<string>();
  const logoCandidates: { url: string; rank: number; order: number }[] = [];
  const googleFamilies: string[] = [];
  const styleBlocks: string[] = [];
  const styleAttrs: { tag: string; css: string }[] = [];
  let titleText = '';
  let ogSiteName = '';
  let ogTitle = '';

  const tallyColor = (hex: string, kind: CensusColor['kind']): void => {
    const e = colorMap.get(hex);
    if (e) { e.weight += 1; return; }
    if (colorMap.size >= MAX_COLORS) return;
    colorMap.set(hex, { hex, weight: 1, kind, order: colorMap.size });
  };

  const addColor = (raw: string, kind: CensusColor['kind']): void => {
    const hex = normalizeColor(raw);
    if (hex != null) tallyColor(hex, kind);
  };

  const addValue = (raw: string, kind: CensusColor['kind']): void => {
    const value = raw.replace(URL_FN_RE, ' ');
    for (const hex of colorTokens(value)) tallyColor(hex, kind);
    for (const g of gradientsIn(value)) {
      const key = `${g.angle ?? ''}|${g.stops.join(',')}`;
      const e = gradientMap.get(key);
      if (e) { e.weight += 1; continue; }
      if (gradientMap.size >= MAX_GRADIENTS) continue;
      gradientMap.set(key, { ...g, weight: 1, order: gradientMap.size });
    }
  };

  const resolveUrl = (raw: string): string | null => {
    const v = raw.trim();
    if (v.length === 0 || v.length > MAX_URL_LEN || v.startsWith('#')) return null;
    if (/^javascript:/i.test(v)) return null;
    try {
      return baseUrl != null ? new URL(v, baseUrl).href : new URL(v).href;
    } catch {
      return v; // unresolvable relative path - still the truest thing we know
    }
  };

  const pushLogo = (raw: string, rank: number): void => {
    if (logoCandidates.length >= MAX_LOGO_CANDIDATES) return;
    const url = resolveUrl(raw);
    if (url == null || logoSeen.has(url)) return;
    logoSeen.add(url);
    logoCandidates.push({ url, rank, order: logoCandidates.length });
  };

  const addGoogleFamilies = (href: string): void => {
    const q = href.indexOf('?');
    if (q < 0) return;
    for (const part of href.slice(q + 1).split('&')) {
      const eq = part.indexOf('=');
      if (eq < 0 || part.slice(0, eq).toLowerCase() !== 'family') continue;
      for (const spec of part.slice(eq + 1).split('|')) {
        const name = (spec.split(':')[0] ?? '').replace(/\+/g, ' ');
        let family: string;
        try { family = decodeURIComponent(name).trim(); } catch { family = name.trim(); }
        if (family.length === 0 || family.length > 64) continue;
        if (googleFamilies.length >= MAX_GOOGLE_FAMILIES || googleFamilies.includes(family)) continue;
        googleFamilies.push(family);
      }
    }
  };

  // ── Pass 1: the markup - name, logos, theme colour, Google links, inline CSS ──
  TAG_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while (budget.left > 0 && (m = TAG_RE.exec(html)) !== null) {
    budget.left -= 1;
    const tag = (m[1] ?? '').toLowerCase();

    if (tag === 'style') {
      const body = sliceBody(html, TAG_RE, CLOSE_STYLE_RE);
      if (styleBlocks.length < MAX_STYLE_BLOCKS) styleBlocks.push(body);
      continue;
    }
    if (tag === 'title') {
      const body = sliceBody(html, TAG_RE, CLOSE_TITLE_RE);
      if (titleText.length === 0) titleText = cleanText(body);
      continue;
    }
    if (tag === 'script') { sliceBody(html, TAG_RE, CLOSE_SCRIPT_RE); continue; }

    const a = tagAttrs(m[2] ?? '', budget);
    const style = a.get('style');
    if (style != null && style.length > 0 && styleAttrs.length < MAX_STYLE_ATTRS) {
      styleAttrs.push({ tag, css: style });
    }

    if (tag === 'meta') {
      const key = (a.get('name') ?? a.get('property') ?? a.get('itemprop') ?? '').trim().toLowerCase();
      const content = a.get('content') ?? '';
      if (key === 'theme-color') addColor(content, 'fill');
      else if (key === 'og:site_name' && ogSiteName.length === 0) ogSiteName = cleanText(content);
      else if (key === 'og:title' && ogTitle.length === 0) ogTitle = cleanText(content);
      else if (key === 'og:image' || key === 'og:image:url') pushLogo(content, 0);
      continue;
    }

    if (tag === 'link') {
      const href = a.get('href') ?? '';
      if (href.includes('fonts.googleapis.com')) addGoogleFamilies(href);
      const rel = (a.get('rel') ?? '').toLowerCase().split(/\s+/);
      if (rel.includes('apple-touch-icon') || rel.includes('apple-touch-icon-precomposed')) pushLogo(href, 0);
      else if (rel.includes('icon') || rel.includes('mask-icon') || rel.includes('fluid-icon')) pushLogo(href, 1);
      continue;
    }

    if (tag === 'img') {
      const src = a.get('src') ?? a.get('data-src') ?? '';
      if (/logo/i.test(`${src} ${a.get('alt') ?? ''} ${a.get('class') ?? ''}`)) pushLogo(src, 2);
    }
  }

  // ── Pass 2: type, then colour (see the header note on scan order) ────────────
  const scanFonts = (css: string, tagSelector: string): void => {
    scan(FONT_DECL_RE, css, budget, mm => {
      const stack = mm[1] ?? '';
      const family = firstFamily(stack);
      if (family == null) return;
      const sel = tagSelector.length > 0 ? tagSelector : selectorFor(css, mm.index);
      const usage: Usage = HEADING_SEL_RE.test(sel) ? 'heading' : /mono/i.test(stack) ? 'mono' : 'body';
      const key = family.toLowerCase();
      let e = fontMap.get(key);
      if (!e) {
        if (fontMap.size >= MAX_FONTS) return;
        e = { family, total: 0, usages: new Map(), order: fontMap.size };
        fontMap.set(key, e);
      }
      e.total += 1;
      e.usages.set(usage, (e.usages.get(usage) ?? 0) + 1);
    });
  };

  const scanColors = (css: string): void => {
    scan(COLOR_DECL_RE, css, budget, mm => {
      addValue(mm[2] ?? '', (mm[1] ?? '').toLowerCase() === 'color' ? 'text' : 'fill');
    });
  };

  for (const css of cssTexts) scanFonts(css, '');
  for (const css of styleBlocks) scanFonts(css, '');
  for (const s of styleAttrs) scanFonts(s.css, s.tag);

  for (const css of cssTexts) scanColors(css);
  for (const css of styleBlocks) scanColors(css);
  for (const s of styleAttrs) scanColors(s.css);

  // ── Assemble ────────────────────────────────────────────────────────────────
  const colors: CensusColor[] = [...colorMap.values()]
    .sort((x, y) => y.weight - x.weight || x.order - y.order)
    .map(e => ({ hex: e.hex, weight: e.weight, kind: e.kind }));

  const gradients: CensusGradient[] = [...gradientMap.values()]
    .sort((x, y) => y.weight - x.weight || x.order - y.order)
    .map(e => (e.angle === undefined
      ? { stops: e.stops, weight: e.weight }
      : { stops: e.stops, angle: e.angle, weight: e.weight }));

  const fonts: CensusFont[] = [...fontMap.values()]
    .sort((x, y) => y.total - x.total || x.order - y.order)
    .map(e => ({ family: e.family, usage: dominantUsage(e.usages), count: e.total }));

  let label = 'site';
  if (baseUrl != null) {
    try { label = new URL(baseUrl).hostname || 'site'; } catch { /* not an address - stay generic */ }
  }

  const siteName = ogSiteName || ogTitle || titleText;
  const census: DesignCensus = { colors, gradients, fonts, source: { kind: 'site', label } };
  if (siteName.length > 0) census.name = siteName;

  const logoUrls = logoCandidates
    .sort((x, y) => x.rank - y.rank || x.order - y.order)
    .slice(0, MAX_LOGOS)
    .map(c => c.url);

  const out: SiteExtract = { census, logoUrls, googleFamilies };
  if (siteName.length > 0) out.siteName = siteName;
  return out;
}
