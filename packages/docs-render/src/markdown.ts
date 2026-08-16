// The shared docs markdown renderer. In M0b this file grows to hold the block loop
// (mdToHtml) and inline pass (inline); it starts with the pure leaf helpers those
// depend on. Everything here is DOM-free string-in/string-out; build-time vs runtime
// differences are injected via DocsRenderContext (context.ts). See plan
// this-is-a-very-sparkling-eich, M0b.

// The seal glyph inside a `%sig{}` pill. A signature names a person, so it gets its
// own mark, not just a colour. Used by inline()'s provenance-pill pass and the
// credential assembly.
export const PROV_SEAL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="prov-seal"><path d="M12 2 4 5.5v6c0 4.5 3.2 8.6 8 10.5 4.8-1.9 8-6 8-10.5v-6L12 2Z"/><path d="m9 12 2 2 4-4"/></svg>`;

/** Split a markdown table row on `|`, trimming the optional leading/trailing pipe. */
export function parseCells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|'))   s = s.slice(0, -1);
  return s.split('|').map(c => c.trim());
}

/**
 * The id a heading gets in the rendered HTML. This is also the anchor the
 * search index links to.
 *
 * Latin headings keep the historical derivation byte for byte. A heading that
 * strips to nothing falls back to its position on the page: the character class
 * is `[a-z0-9]`, so EVERY heading in a non-Latin locale (zh, ja, ko, ar, hi, bn,
 * ur, uk, bg, …) used to render `id=""` - the same empty id on all of them. That
 * id is invalid and it makes every deep link into those pages dead. The fallback
 * is positional, not transliterated, so it stays stable and script-agnostic.
 */
export function headingId(text: string, ordinal: number): string {
  // A `<!--l:key-->` mark in the heading is decoration, not part of its name. The
  // id must be the one the heading had before the mark was added. Otherwise, adding
  // a decorative glyph later breaks every existing deep link and every sidebar or
  // search anchor into that section.
  const named = text.replace(/<!--l:[a-z0-9-]+-->/g, ' ');
  const slug = named.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || `section-${ordinal}`;
}

/** The content tokens stripAuthoringComments must NOT eat, because they render:
 *  `<!--i:name-->` (bullet icon), `<!--l:name-->` (inline mark), `<!--lb:a b-->` (block). */
export const CONTENT_TOKEN = 'i:[a-z-]+-->|l:[a-z0-9-]+-->|lb:[a-z0-9 -]+-->';

/**
 * Authoring comments (shot notes, capture instructions) are working metadata, never
 * page content. If left unstripped, the escaper renders one as VISIBLE text. Stripped
 * in a pre-pass because the figure builder consumes comment lines that trail an image
 * before the line loop can skip them. Fence-aware (a ``` example may SHOW a comment),
 * and the CONTENT tokens survive.
 */
export function stripAuthoringComments(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inFence = false;
  let inComment = false;
  for (const line of lines) {
    if (!inComment && line.startsWith('```')) { inFence = !inFence; out.push(line); continue; }
    if (inFence) { out.push(line); continue; }
    if (inComment) {
      const close = line.indexOf('-->');
      if (close === -1) continue;
      inComment = false;
      const rest = line.slice(close + 3);
      if (rest.trim()) out.push(rest);
      continue;
    }
    // Inline complete comments: drop all except the content tokens.
    let kept = line.replace(new RegExp(`<!--(?!${CONTENT_TOKEN})[\\s\\S]*?-->`, 'g'), '');
    // An unclosed opener (not a content token) starts a multi-line comment.
    const open = kept.search(new RegExp(`<!--(?!${CONTENT_TOKEN})`));
    if (open !== -1) {
      inComment = true;
      kept = kept.slice(0, open);
    }
    if (kept !== line && !kept.trim()) continue; // a line that was ONLY comment
    out.push(kept);
  }
  return out.join('\n');
}

// localeNum/approxCount take htmlLang explicitly. build.ts's copies read the module
// global activeLang; the package cannot, so the credential assembly passes ctx.htmlLang.

/** A number formatted for a locale. `htmlLang` is the BCP-47 tag (e.g. "zh-Hans"). */
export function localeNum(v: number, htmlLang: string): string {
  try { return v.toLocaleString(htmlLang); }
  catch { return String(v); }
}

/**
 * A big count shown as an easy-to-read magnitude: exact below 1,000, then ~1.5k, ~15k,
 * ~999k, and ~1.0m from there up. The node count on a text-heavy shot runs to tens
 * of thousands. An exact "14,108" takes time to read; "~14k" reads at a glance.
 */
export function approxCount(n: number, htmlLang: string): string {
  if (n < 1000) return localeNum(n, htmlLang);
  if (n < 999_500) {
    const k = n / 1000;
    // One decimal below 10k (~1.5k, ~9.9k), whole thousands above (~15k, ~999k).
    const oneDec = Math.round(k * 10) / 10;
    return `~${oneDec < 10 ? oneDec.toFixed(1) : String(Math.round(k))}k`;
  }
  return `~${(n / 1_000_000).toFixed(1)}m`;
}
