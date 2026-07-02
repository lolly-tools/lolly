// SPDX-License-Identifier: MPL-2.0
/**
 * Scope a tool stylesheet under a container selector — the ONE shared
 * implementation (finding 3/4: the previous regex versions in views/tool.js and
 * pro/render-export.js corrupted nested rules, forcing tool-side workarounds in
 * tools/digi-ad/hooks.js and tools/strip-data/styles.css).
 *
 * This is a small real parser, not a regex: a character scanner that respects
 * strings, comments and url() tokens, with a recursive walk over rule blocks.
 *
 * Rules:
 * - style rule preludes get each comma-separated selector prefixed with the
 *   scope; `:root` / `html` / `body` as the left-most compound map to the scope
 *   root itself (`:root {}` → `#s {}`, `body.dark .x` → `#s.dark .x`).
 * - conditional group at-rules (@media, @supports, @container, @layer, @scope)
 *   keep their prelude and recurse into their body.
 * - @keyframes, @font-face, @page, @property and any other non-group at-rule
 *   pass through verbatim (frame selectors like `50%` must never be scoped).
 * - statement at-rules (@import, @charset, …) and raw declarations pass through.
 * - nested CSS (`&` rules) lives inside a style rule's body, which is emitted
 *   verbatim — nesting resolves against the (now scoped) parent selector.
 */

const GROUP_AT_RULES = new Set(['media', 'supports', 'container', 'layer', 'scope']);

/** Compounds that mean "the render root" and collapse onto the scope selector. */
const ROOT_COMPOUND = /^(?::root|html|body)(?![\w-])/i;

export function scopeCss(css: string, scopeSelector: string): string {
  return scopeBlock(css, scopeSelector);
}

/** Scan `src` (the inside of a conditional block, or the top level) and scope it. */
function scopeBlock(src: string, scope: string): string {
  let out = '';
  let i = 0;
  let chunkStart = 0; // start of the pending prelude / statement text

  while (i < src.length) {
    const skipped = skipInert(src, i);
    if (skipped > i) { i = skipped; continue; }

    const ch = src[i];
    if (ch === ';') {
      // Statement (an @import / @charset or stray declaration): emit verbatim.
      out += src.slice(chunkStart, i + 1);
      i += 1;
      chunkStart = i;
      continue;
    }
    if (ch === '{') {
      const prelude = src.slice(chunkStart, i);
      const close = matchBrace(src, i);
      const body = src.slice(i + 1, close);
      out += emitRule(prelude, body, scope);
      i = close + 1;
      chunkStart = i;
      continue;
    }
    if (ch === '}') {
      // Unbalanced close at this level (malformed sheet): keep it, stay lossless.
      out += src.slice(chunkStart, i + 1);
      i += 1;
      chunkStart = i;
      continue;
    }
    i += 1;
  }
  out += src.slice(chunkStart); // trailing whitespace / comments
  return out;
}

/** Emit one `prelude { body }` rule, scoped per its kind. */
function emitRule(prelude: string, body: string, scope: string): string {
  const { lead, text } = splitLeading(prelude);
  if (text.startsWith('@')) {
    const name = (/^@([\w-]+)/.exec(text)?.[1] ?? '').toLowerCase();
    if (GROUP_AT_RULES.has(name)) {
      return `${lead}${text} {${scopeBlock(body, scope)}}`;
    }
    // @keyframes, @font-face, @page, @property, unknown at-rules: verbatim.
    return `${lead}${text} {${body}}`;
  }
  return `${lead}${scopeSelectorList(text, scope)} {${body}}`;
}

/** Split leading whitespace/comments off a prelude so they re-emit verbatim. */
function splitLeading(prelude: string): { lead: string; text: string } {
  let i = 0;
  while (i < prelude.length) {
    if (prelude[i] === '/' && prelude[i + 1] === '*') {
      const end = prelude.indexOf('*/', i + 2);
      i = end === -1 ? prelude.length : end + 2;
      continue;
    }
    if (/\s/.test(prelude[i] ?? '')) { i += 1; continue; }
    break;
  }
  return { lead: prelude.slice(0, i), text: prelude.slice(i).trim() };
}

/** Prefix each top-level comma-separated selector with the scope. */
function scopeSelectorList(selectors: string, scope: string): string {
  return splitTopLevel(selectors).map(sel => {
    const s = sel.trim();
    if (s === '') return s;
    const root = ROOT_COMPOUND.exec(s);
    if (root) {
      // `:root`/`html`/`body` (plus any attached classes/pseudos, then any
      // descendant part) collapse onto the scope root itself.
      return `${scope}${s.slice(root[0].length)}`;
    }
    return `${scope} ${s}`;
  }).join(', ');
}

/** Split a selector list on commas not nested in parens/brackets/strings. */
function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  while (i < s.length) {
    const skipped = skipInert(s, i);
    if (skipped > i) { i = skipped; continue; }
    const ch = s[i];
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
    i += 1;
  }
  parts.push(s.slice(start));
  return parts;
}

/** Index of the `}` matching the `{` at `open`, or end of string if unbalanced. */
function matchBrace(src: string, open: number): number {
  let depth = 0;
  let i = open;
  while (i < src.length) {
    const skipped = skipInert(src, i);
    if (skipped > i) { i = skipped; continue; }
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return src.length;
}

/**
 * If `i` sits at the start of a token whose contents must never be parsed
 * (comment, string, or unquoted url(…)), return the index just past it;
 * otherwise return `i` unchanged.
 */
function skipInert(src: string, i: number): number {
  const ch = src[i];
  if (ch === '/' && src[i + 1] === '*') {
    const end = src.indexOf('*/', i + 2);
    return end === -1 ? src.length : end + 2;
  }
  if (ch === '"' || ch === "'") {
    let j = i + 1;
    while (j < src.length) {
      if (src[j] === '\\') j += 2;
      else if (src[j] === ch) return j + 1;
      else j += 1;
    }
    return src.length;
  }
  // Unquoted url(...) may legally contain characters that would otherwise be
  // structural. Quoted url("...") is already covered by the string case above.
  if ((ch === 'u' || ch === 'U') && /^url\(/i.test(src.slice(i, i + 4))) {
    const close = src.indexOf(')', i + 4);
    return close === -1 ? src.length : close + 1;
  }
  return i;
}
