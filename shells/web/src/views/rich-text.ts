// SPDX-License-Identifier: MPL-2.0
// rich-text.js - the tiny per-character rich-text model behind Design's
// WYSIWYG inline text editing (free-canvas.js).
//
// The contenteditable shows the RENDERED rich text (what hooks.js richText emits:
// <strong>/<em> runs, literal \n line breaks under white-space:pre-wrap, and "•  "
// bullet / "1.  " number prefixes as plain characters). Every formatting operation
// round-trips through this model: parse the DOM into a flat array of {ch, b, i, c, w}
// characters, mutate flags over a [start, end) character range, and re-render to
// HTML. On commit the same model serialises back to the tool's stored markdown-subset
// source (**bold**, *italic*, "- " bullets, "1. " numbers, {#hex|…} colour runs and
// {w600|…} weight runs) - the storage format, the URL encoding, and the engine render
// path are unchanged; only the editing UX is.
//
// Each char carries an OPTIONAL numeric font-weight `w` (per-selection weight, e.g.
// 300 or 800). It is mutually exclusive with the `b` bold flag: setting an explicit
// weight clears bold, and vice versa - so a weight span never wraps a <strong> (which
// would win the CSS cascade and defeat the chosen weight). Runs with no `w` inherit
// the box's weight.
//
// Literal * and _ typed by the user are backslash-escaped in the serialised
// source (and hooks.js inlineMd unescapes them), so WYSIWYG text can never
// accidentally italicise "5 * 3 * 2".
//
// DOM-agnostic on purpose: charsFromDom only touches nodeType/nodeName/
// childNodes/nodeValue (plus getAttribute/style for colour+weight), so node:test can
// feed it plain object trees (see rich-text.test.js) - no jsdom needed.

// Per-run font face. A CLOSED enum, never a free font-family string: 'mono' forces
// the monospace face, 'suse' forces the sans face (so a run can opt BACK to sans inside
// a mono block), null inherits the block/document font. rich-text.ts stays brand-neutral
// - it only emits the semantic token + a `fc-ff-*` class; the real family lives in CSS
// (the editable) and the tool's hooks FONTS map (the render/export).
export type FontId = 'mono' | 'suse' | null;

// One character in the flat model: the glyph plus its inline formatting axes.
// b/i/u/s are boolean toggles; c is a #hex colour; w an explicit numeric weight
// (mutually exclusive with b); f the per-run font face.
interface Char {
  ch: string;
  b: boolean;
  i: boolean;
  c: string | null;
  w: number | null;
  u: boolean;
  s: boolean;
  f: FontId;
}

// The run-level formatting shape (a Char without its glyph) used by the HTML/source flushers.
interface RunFormat {
  b: boolean;
  i: boolean;
  c: string | null;
  w: number | null;
  u: boolean;
  s: boolean;
  f: FontId;
}

// The inherited formatting state threaded down through charsFromDom's walk.
interface WalkFormat {
  b: boolean;
  i: boolean;
  color: string | null;
  weight: number | null;
  u: boolean;
  s: boolean;
  font: FontId;
}

// The nested-list bookkeeping threaded through <ul>/<ol>/<li>.
interface ListState {
  type: 'ol' | 'ul';
  n: number;
  depth: number;
}

// A minimal DOM-node shape: charsFromDom only touches these members, so plain object
// trees (node:test) satisfy it without jsdom, and real DOM nodes are structurally assignable.
interface DomNodeLike {
  nodeType: number;
  nodeName: string;
  nodeValue?: string | null;
  childNodes: Iterable<DomNodeLike>;
  getAttribute?: (name: string) => string | null;
  style?: { color?: string; fontWeight?: string; fontFamily?: string } | null;
}

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE']);
// Never emit these as text (their content isn't copy - matters for pasted HTML).
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'HEAD', 'TITLE', 'TEMPLATE']);

// Ordered-list marker: up to 3 digits so a numbered list (1–999) is recognised but
// a paragraph opening on a year ("2024. The year …") is NOT mistaken for a list.
const OL_RE = /^(\s*)(\d{1,3})\.\s+/;
const UL_RE = /^(\s*)•\s+/;

/** Parse a contenteditable's (or a pasted fragment's) DOM into the flat char model. */
export function charsFromDom(root: DomNodeLike): Char[] {
  const out: Char[] = [];
  const pushNl = (f: WalkFormat) => {
    if (out.length && out[out.length - 1]!.ch !== '\n') out.push({ ch: '\n', b: f.b, i: f.i, c: f.color || null, w: f.weight ?? null, u: f.u, s: f.s, f: f.font });
  };
  const walk = (node: DomNodeLike, f: WalkFormat, list: ListState | null) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        const text = String(child.nodeValue || '').replace(/\u00a0/g, ' ');
        // An explicit numeric weight wins over an inherited bold flag (they're the
        // same axis) - so ingested runs keep the mutual-exclusion invariant.
        for (const ch of text) out.push({ ch, b: f.weight != null ? false : f.b, i: f.i, c: f.color || null, w: f.weight ?? null, u: f.u, s: f.s, f: f.font });
        continue;
      }
      if (child.nodeType !== 1) continue;
      const tag = String(child.nodeName).toUpperCase();
      if (SKIP_TAGS.has(tag)) continue;
      if (tag === 'BR') { out.push({ ch: '\n', b: f.b, i: f.i, c: f.color || null, w: f.weight ?? null, u: f.u, s: f.s, f: f.font }); continue; }
      const cf: WalkFormat = {
        b: f.b || tag === 'B' || tag === 'STRONG',
        i: f.i || tag === 'I' || tag === 'EM',
        // U/INS carry underline, S/STRIKE/DEL strikethrough (our render emits <u>/<s>;
        // pasted markup may use any of these). Both are simple inherited booleans.
        u: f.u || tag === 'U' || tag === 'INS',
        s: f.s || tag === 'S' || tag === 'STRIKE' || tag === 'DEL',
        color: nodeColor(child) || f.color,
        weight: nodeWeight(child) ?? f.weight,
        font: nodeFont(child) || f.font,
      };
      // Pasted lists: <ul>/<ol> children (<li>) get literal "•  " / "N.  " prefixes,
      // matching how our own render + toggleBullets/toggleNumbers express lists.
      if (tag === 'UL' || tag === 'OL') {
        pushNl(cf);
        walk(child, cf, { type: tag === 'OL' ? 'ol' : 'ul', n: 1, depth: (list ? list.depth : 0) + 1 });
        continue;
      }
      if (tag === 'LI') {
        pushNl(cf);
        const depth = list ? list.depth : 1;
        for (let s = 1; s < depth; s++) out.push({ ch: ' ', b: false, i: false, c: null, w: null, u: false, s: false, f: null }, { ch: ' ', b: false, i: false, c: null, w: null, u: false, s: false, f: null });
        const marker = list && list.type === 'ol' ? `${list.n++}.  ` : '•  ';
        for (const ch of marker) out.push({ ch, b: false, i: false, c: null, w: null, u: false, s: false, f: null });
        walk(child, cf, list);
        continue;
      }
      // A block element starts on its own line (contenteditable Enter is
      // intercepted into literal \n, but pasted/legacy markup may carry these).
      if (BLOCK_TAGS.has(tag)) pushNl(cf);
      walk(child, cf, list);
    }
  };
  walk(root, { b: false, i: false, color: null, weight: null, u: false, s: false, font: null }, null);
  return out;
}

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// An element's own text colour, as a #hex. htmlFromChars stamps a canonical `data-fc-color`
// so our own re-renders round-trip exactly; anything else (pasted markup) falls back to
// parsing the inline `style.color` (rgb()/hex → hex). Returns null for no explicit colour.
function nodeColor(el: DomNodeLike): string | null {
  const dc = el.getAttribute && el.getAttribute('data-fc-color');
  if (dc) return /^#[0-9a-fA-F]{3,8}$/.test(dc) ? dc : null;
  const sc = el.style && el.style.color;
  return sc ? cssColorToHex(sc) : null;
}
// An element's own explicit numeric font-weight (100–900), or null. Only NUMERIC
// weights become per-run weights; keyword bold/normal is left to <strong>/<b> tags so
// pasted body copy (which routinely sets font-weight:normal) doesn't stamp weight runs.
function nodeWeight(el: DomNodeLike): number | null {
  const dw = el.getAttribute && el.getAttribute('data-fc-weight');
  if (dw && /^[1-9]00$/.test(dw)) return parseInt(dw, 10);
  const sw = el.style && el.style.fontWeight;
  if (sw && /^[1-9]00$/.test(String(sw).trim())) return parseInt(String(sw).trim(), 10);
  return null;
}
// An element's own per-run font face, as the closed 'mono'|'suse' token (or null).
// htmlFromChars stamps a canonical `data-fc-font` so our own re-renders round-trip
// exactly; pasted markup falls back to sniffing the inline `style.fontFamily` - a
// family naming "mono" maps to 'mono', anything else is left to inherit (we never
// force 'suse' off arbitrary pasted copy, only off our own data-fc-font stamp).
function nodeFont(el: DomNodeLike): FontId {
  const df = el.getAttribute && el.getAttribute('data-fc-font');
  if (df === 'mono' || df === 'suse') return df;
  const ff = el.style && el.style.fontFamily;
  if (ff && /mono/i.test(String(ff))) return 'mono';
  return null;
}
function cssColorToHex(s: string): string | null {
  const v = String(s || '').trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(v)) return v;
  const m = v.match(/^rgba?\(([^)]+)\)/i);
  if (m) {
    const p = m[1]!.split(',').map((x) => parseFloat(x));
    if (p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) {
      return '#' + p.slice(0, 3).map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
    }
  }
  return null;
}
const isHex = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c);
const clampWeight = (w: number) => Math.max(100, Math.min(900, Math.round(w / 100) * 100));

/** Render the char model to the HTML shown in the editable (and by the tool). */
export function htmlFromChars(chars: Char[]): string {
  let html = '';
  let run = '';
  let cur: RunFormat | null = null;
  const flush = () => {
    if (cur == null || run === '') { run = ''; return; }
    let piece = escHtml(run);
    if (cur.i) piece = '<em>' + piece + '</em>';
    if (cur.b) piece = '<strong>' + piece + '</strong>';
    if (cur.u) piece = '<u>' + piece + '</u>';
    if (cur.s) piece = '<s>' + piece + '</s>';
    // A single span carries colour, explicit weight and/or font (outermost, matching
    // the {#hex w600 mono|…} source order); data-fc-* let charsFromDom read the exact
    // values back without re-parsing rgb()/inherited weights/families. Font uses a
    // cosmetic `fc-ff-*` class (family lives in CSS) so this file stays brand-neutral.
    const attrs: string[] = [];
    const styles: string[] = [];
    let cls = '';
    if (isHex(cur.c)) { attrs.push('data-fc-color="' + cur.c + '"'); styles.push('color:' + cur.c); }
    if (cur.w != null) { attrs.push('data-fc-weight="' + cur.w + '"'); styles.push('font-weight:' + cur.w); }
    if (cur.f) { attrs.push('data-fc-font="' + cur.f + '"'); cls = ' class="fc-ff-' + cur.f + '"'; }
    if (attrs.length) {
      const styleAttr = styles.length ? ' style="' + styles.join(';') + '"' : '';
      piece = '<span ' + attrs.join(' ') + cls + styleAttr + '>' + piece + '</span>';
    }
    html += piece;
    run = '';
  };
  for (const c of chars) {
    if (!cur || c.b !== cur.b || c.i !== cur.i || (c.c || null) !== (cur.c || null) || (c.w ?? null) !== (cur.w ?? null) || !!c.u !== !!cur.u || !!c.s !== !!cur.s || (c.f || null) !== (cur.f || null)) {
      flush(); cur = { b: c.b, i: c.i, c: c.c || null, w: c.w ?? null, u: !!c.u, s: !!c.s, f: c.f || null };
    }
    run += c.ch;
  }
  flush();
  return html;
}

// One rendered line back to markdown-subset source. Runs never span lines, so
// **/*/ markers stay per-line (matching how hooks.js inlineMd parses them).
function lineToMarkdown(line: Char[]): string {
  let src = '';
  const text = line.map((c) => c.ch).join('');
  let start = 0;
  const mb = text.match(UL_RE);
  if (mb) { src += mb[1]! + '- '; start = mb[0].length; }
  else {
    const mo = text.match(OL_RE);
    if (mo) { src += mo[1]! + mo[2]! + '. '; start = mo[0].length; }
  }
  let run = '';
  let cur: RunFormat | null = null;
  const flush = () => {
    if (cur == null || run === '') { run = ''; return; }
    // Formatting on whitespace is invisible - keep leading/trailing whitespace
    // outside the markers so the source stays clean for the render-side regexes.
    const mm = run.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
    const lead = mm[1]!, core = mm[2]!, tail = mm[3]!;
    const esc = core.replace(/([*_])/g, '\\$1');
    src += lead;
    if (!core) { run = ''; return; }
    let inner;
    if (cur.b && cur.i) inner = '***' + esc + '***';
    else if (cur.b) inner = '**' + esc + '**';
    else if (cur.i) inner = '*' + esc + '*';
    else inner = esc;
    // Colour, weight, font and decoration fold into ONE space-separated token that
    // wraps the (already emphasised) run: {#rrggbb w600 mono u s|…}. Underline and
    // strike have no markdown marker, so they can ONLY live in this token. The inner
    // cannot nest braces (the render regex forbids it), which is why co-occurring
    // attributes share one token. Weight and bold are mutually exclusive, so {w…|…}
    // never wraps a ** run.
    const attrs: string[] = [];
    if (isHex(cur.c)) attrs.push(cur.c);
    if (cur.w != null) attrs.push('w' + cur.w);
    if (cur.f) attrs.push(cur.f);   // 'mono' | 'suse'
    if (cur.u) attrs.push('u');
    if (cur.s) attrs.push('s');
    if (attrs.length) inner = '{' + attrs.join(' ') + '|' + inner + '}';
    src += inner + tail;
    run = '';
  };
  for (let k = start; k < line.length; k++) {
    const c = line[k]!;
    if (!cur || c.b !== cur.b || c.i !== cur.i || (c.c || null) !== (cur.c || null) || (c.w ?? null) !== (cur.w ?? null) || !!c.u !== !!cur.u || !!c.s !== !!cur.s || (c.f || null) !== (cur.f || null)) {
      flush(); cur = { b: c.b, i: c.i, c: c.c || null, w: c.w ?? null, u: !!c.u, s: !!c.s, f: c.f || null };
    }
    run += c.ch;
  }
  flush();
  return src;
}

function splitLines(chars: Char[]): Char[][] {
  const lines: Char[][] = [[]];
  for (const c of chars) {
    if (c.ch === '\n') lines.push([]);
    else lines[lines.length - 1]!.push(c);
  }
  return lines;
}

/** Serialise the char model to the stored markdown-subset source text. */
export function markdownFromChars(chars: Char[]): string {
  // Browsers leave one trailing newline in a contenteditable; drop exactly one
  // (same normalisation the previous plaintext editor applied via innerText).
  const trimmed = chars.length && chars[chars.length - 1]!.ch === '\n' ? chars.slice(0, -1) : chars;
  return splitLines(trimmed).map(lineToMarkdown).join('\n');
}

/** True when every non-newline char in [a, b) carries the flag. */
export function rangeHasFlag(chars: Char[], a: number, b: number, flag: 'b' | 'i' | 'u' | 's'): boolean {
  let seen = false;
  for (let k = Math.max(0, a); k < Math.min(chars.length, b); k++) {
    if (chars[k]!.ch === '\n') continue;
    seen = true;
    if (!chars[k]![flag]) return false;
  }
  return seen;
}

/** Return a copy with the flag set/cleared over [a, b) (newlines untouched). */
export function setFlag(chars: Char[], a: number, b: number, flag: 'b' | 'i' | 'u' | 's', on: boolean): Char[] {
  return chars.map((c, k) => {
    if (k < a || k >= b || c.ch === '\n') return c;
    // Turning bold ON drops any explicit weight on the run (bold IS the weight axis).
    if (flag === 'b' && on) return { ...c, b: true, w: null };
    return { ...c, [flag]: on };
  });
}

/** Return a copy with text colour set (or cleared, when color is falsy) over [a, b). */
export function setColor(chars: Char[], a: number, b: number, color: string | null): Char[] {
  const c = isHex(color) ? color : null;
  return chars.map((ch, k) => {
    if (k < a || k >= b || ch.ch === '\n') return ch;
    return { ...ch, c };
  });
}

/**
 * Return a copy with all inline character formatting - bold, italic, underline,
 * strike, explicit weight, per-run font and text colour - stripped over [a, b).
 * Paragraph structure (bullets / numbers) is left untouched; those have their own
 * toggles. Newlines untouched.
 */
export function clearFormatting(chars: Char[], a: number, b: number): Char[] {
  return chars.map((ch, k) => {
    if (k < a || k >= b || ch.ch === '\n') return ch;
    return { ...ch, b: false, i: false, w: null, c: null, u: false, s: false, f: null };
  });
}

/** Return a copy with the per-run font set (or cleared, when font is null) over [a, b). */
export function setFont(chars: Char[], a: number, b: number, font: FontId): Char[] {
  const f: FontId = font === 'mono' || font === 'suse' ? font : null;
  return chars.map((ch, k) => {
    if (k < a || k >= b || ch.ch === '\n') return ch;
    return { ...ch, f };
  });
}

/** The common per-run font over [a, b), or null if unset or mixed. */
export function rangeFont(chars: Char[], a: number, b: number): FontId {
  let val: FontId | undefined; let seen = false;
  for (let k = Math.max(0, a); k < Math.min(chars.length, b); k++) {
    if (chars[k]!.ch === '\n') continue;
    const f = chars[k]!.f || null;
    if (!seen) { val = f; seen = true; }
    else if (f !== val) return null; // mixed
  }
  return seen ? (val ?? null) : null;
}

/** The common colour over [a, b), or null if the run is uncoloured or mixed. */
export function rangeColor(chars: Char[], a: number, b: number): string | null {
  let val: string | null | undefined; let seen = false;
  for (let k = Math.max(0, a); k < Math.min(chars.length, b); k++) {
    if (chars[k]!.ch === '\n') continue;
    const c = chars[k]!.c || null;
    if (!seen) { val = c; seen = true; }
    else if (c !== val) return null; // mixed
  }
  return seen ? (val || null) : null;
}

/**
 * Return a copy with an explicit per-run weight over [a, b). A finite weight is
 * clamped to a 100-step 100–900 value and clears the bold flag on those chars
 * (weight and bold are the same axis); a null/NaN weight clears the run weight so
 * the box weight shows through. Newlines are untouched.
 */
export function setWeight(chars: Char[], a: number, b: number, weight: number | null | undefined): Char[] {
  const w = Number.isFinite(weight) ? clampWeight(weight as number) : null;
  return chars.map((ch, k) => {
    if (k < a || k >= b || ch.ch === '\n') return ch;
    return { ...ch, w, b: w != null ? false : ch.b };
  });
}

/** The common explicit weight over [a, b), or null if unset or mixed. */
export function rangeWeight(chars: Char[], a: number, b: number): number | null {
  let val: number | null | undefined; let seen = false;
  for (let k = Math.max(0, a); k < Math.min(chars.length, b); k++) {
    if (chars[k]!.ch === '\n') continue;
    const w = chars[k]!.w ?? null;
    if (!seen) { val = w; seen = true; }
    else if (w !== val) return null; // mixed
  }
  return seen ? (val ?? null) : null;
}

/** Expand a collapsed caret offset to the word around it ([a, a] if none). */
export function wordRangeAt(chars: Char[], at: number): [number, number] {
  const isWord = (c: Char | undefined) => c && c.ch !== '\n' && /\S/.test(c.ch);
  let a = Math.max(0, Math.min(at, chars.length));
  let b = a;
  while (a > 0 && isWord(chars[a - 1])) a--;
  while (b < chars.length && isWord(chars[b])) b++;
  return [a, b];
}

/** True when every non-blank line starts with a "• " bullet prefix. */
export function allBulleted(chars: Char[]): boolean {
  const lines = splitLines(chars).filter((l) => l.some((c) => /\S/.test(c.ch)));
  if (!lines.length) return false;
  return lines.every((l) => UL_RE.test(l.map((c) => c.ch).join('')));
}

/** True when every non-blank line starts with an "N. " ordered prefix. */
export function allNumbered(chars: Char[]): boolean {
  const lines = splitLines(chars).filter((l) => l.some((c) => /\S/.test(c.ch)));
  if (!lines.length) return false;
  return lines.every((l) => OL_RE.test(l.map((c) => c.ch).join('')));
}

// Strip a leading "•  " or "N.  " marker from a line's char array, keeping indent.
function stripMarker(line: Char[]): Char[] {
  const text = line.map((c) => c.ch).join('');
  const mb = text.match(UL_RE);
  if (mb) return line.slice(0, mb[1]!.length).concat(line.slice(mb[0].length));
  const mo = text.match(OL_RE);
  if (mo) return line.slice(0, mo[1]!.length).concat(line.slice(mo[0].length));
  return line;
}

// Re-marker every non-blank line: 'ul' → "•  ", 'ol' → sequential "1.  2.  …",
// null → strip any existing marker. A box is one logical list, so bullets and
// numbers are mutually exclusive (switching kinds strips the other first).
function relist(chars: Char[], kind: 'ul' | 'ol' | null): Char[] {
  const lines = splitLines(chars);
  const out: Char[] = [];
  let n = 1;
  lines.forEach((line, li) => {
    if (li > 0) out.push({ ch: '\n', b: false, i: false, c: null, w: null, u: false, s: false, f: null });
    const text = line.map((c) => c.ch).join('');
    if (!text.trim()) { out.push(...line); return; }
    const stripped = stripMarker(line);
    if (!kind) { out.push(...stripped); return; }
    const indent = (stripped.map((c) => c.ch).join('').match(/^\s*/) || [''])[0]!.length;
    out.push(...stripped.slice(0, indent));
    const marker = kind === 'ol' ? `${n++}.  ` : '•  ';
    for (const ch of marker) out.push({ ch, b: false, i: false, c: null, w: null, u: false, s: false, f: null });
    out.push(...stripped.slice(indent));
  });
  return out;
}

/** Toggle "•  " bullet prefixes on every non-blank line (whole-box list). */
export function toggleBullets(chars: Char[]): Char[] {
  return relist(chars, allBulleted(chars) ? null : 'ul');
}

/** Toggle "1.  " ordered-number prefixes on every non-blank line (whole-box list). */
export function toggleNumbers(chars: Char[]): Char[] {
  return relist(chars, allNumbered(chars) ? null : 'ol');
}
