// SPDX-License-Identifier: MPL-2.0
/**
 * Section alignment (plans/103 M0) - the bridge between the /info search index
 * and the full-text markdown twins.
 *
 * The search index (docs/build.ts indexSections) is built from RENDERED HTML and
 * caps each section body at 240 chars - enough to find a section, not enough to
 * answer from. The `.md` twins at /info/<slug>.md carry the verbatim full body.
 * Both derive from the same headings, so a record `{h, a}` can be matched back to
 * its full section text here, and the Ask surface answers from the whole section
 * instead of the snippet.
 *
 * Alignment is by DOCUMENT ORDER, forward-scanned and fold-guarded, NOT by anchor
 * slug: docs/build.ts's headingId does not deduplicate identical headings, so two
 * `## Notes` sections share different positional anchors but the same folded
 * text - matching in order is unambiguous where slug matching is not. A record
 * whose heading can't be found (a page rendered by a non-markdown path, e.g. the
 * landing page) maps to null and the caller falls back to the snippet.
 *
 * This module is dependency-light on purpose - it is imported by the browser
 * (lib/ask/answer.ts), by the Node vectors build script (plans/103 M1), and by
 * the drift test. Its only import is the pure matcher fold().
 */
import { fold } from '../search/match.ts';

/** One markdown section. `heading` is null for the pre-first-heading intro. */
export interface MdSection { heading: string | null; body: string }

/** The minimum an index record needs to be aligned - its heading text and
 *  anchor (the anchor is unused by the matcher but names the record). */
export interface AlignableRecord { h: string; a: string }

/**
 * Strip markdown inline syntax so a source heading compares equal to the index's
 * heading text, which is the rendered HTML flattened to plain text (docs/build.ts
 * htmlToText). htmlToText replaces every HTML TAG with a space, so an inline code
 * span renders `<code>...</code>` and flattens with a space on each side - the
 * markers must become SPACES, not vanish, or "(tool.json)" won't equal
 * "( tool.json )". Splitting on backticks also keeps an underscore or star INSIDE
 * a code span literal (it is not emphasis - `community/_shared/` keeps its `_`).
 * Images collapse to a space (htmlToText drops the alt attribute); links keep
 * their text surrounded by spaces; whitespace is then collapsed as htmlToText
 * collapses it.
 */
function stripInlineMd(s: string): string {
  const parts = s.split('`');
  const out = parts.map((part, i) => {
    if (i % 2 === 1) return ` ${part} `; // odd index = inside a code span (verbatim)
    return part
      .replace(/<!--i:[a-z-]+-->/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, ' $1 ')
      .replace(/\*\*/g, ' ')
      .replace(/[*_~]/g, ' ');
  });
  return out.join('').replace(/\s+/g, ' ').trim();
}

/** Remove HTML comments (provenance plumbing, authoring notes, icon tokens)
 *  fence-aware and multi-line - mirrors docs/build.ts stripAuthoringComments,
 *  but drops the `<!--i:name-->` icon tokens too since answers show prose, not
 *  the list renderer's glyph markup. */
function stripHtmlComments(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inFence = false;
  let inComment = false;
  for (const line of lines) {
    const t = line.trimStart();
    if (!inComment && (t.startsWith('```') || t.startsWith('~~~'))) { inFence = !inFence; out.push(line); continue; }
    if (inFence) { out.push(line); continue; }
    if (inComment) {
      const close = line.indexOf('-->');
      if (close === -1) continue;
      inComment = false;
      const rest = line.slice(close + 3);
      if (rest.trim()) out.push(rest);
      continue;
    }
    let kept = line.replace(/<!--[\s\S]*?-->/g, '');
    const open = kept.indexOf('<!--');
    if (open !== -1) { inComment = true; kept = kept.slice(0, open); }
    if (kept !== line && !kept.trim()) continue; // a line that was only a comment
    out.push(kept);
  }
  return out.join('\n');
}

/**
 * Split a markdown twin into sections at every h2-h4 heading (fence-aware, so a
 * `#` inside a code block is not a boundary). The first element is always the
 * intro (heading=null); its body is the text before the first h2-h4 (which
 * includes any h1 title - the index counts that as the page-intro record too).
 * `::: cols` / `::: timeline` fence markers are dropped (they are layout, not
 * content), but the `##` headings inside them ARE boundaries, exactly as the
 * rendered page anchors them.
 */
export function parseMdSections(md: string): MdSection[] {
  const lines = stripHtmlComments(md).split('\n');
  const sections: MdSection[] = [];
  let heading: string | null = null;
  let buf: string[] = [];
  let inFence = false;
  const flush = (): void => { sections.push({ heading, body: buf.join('\n').trim() }); buf = []; };
  for (const line of lines) {
    const t = line.trimStart();
    if (t.startsWith('```') || t.startsWith('~~~')) { inFence = !inFence; buf.push(line); continue; }
    if (inFence) { buf.push(line); continue; }
    if (t.startsWith(':::')) continue; // column/timeline fence markers - not content
    const m = /^(#{2,4})\s+(.+?)\s*#*\s*$/.exec(t);
    if (m) { flush(); heading = stripInlineMd(m[2]!.trim()); continue; }
    buf.push(line);
  }
  flush();
  return sections;
}

/**
 * Align a page's index records to its markdown twin, returning the full section
 * body for each record (or null where it can't be matched). Records must be in
 * the index's document order for one page (intro record first when present).
 *
 * The intro record (h==='') maps to the intro block; each heading record is
 * matched to the next same-heading section at or after the last match, so
 * duplicate headings resolve by order. An unmatched record is null - the caller
 * keeps the 240-char snippet for it.
 */
export function alignPage(md: string, records: readonly AlignableRecord[]): (string | null)[] {
  const sections = parseMdSections(md);
  const intro = sections.find((s) => s.heading === null) ?? null;
  const headingSecs = sections.filter((s): s is { heading: string; body: string } => s.heading !== null);
  const out: (string | null)[] = records.map(() => null);
  let cursor = 0;
  for (let ri = 0; ri < records.length; ri++) {
    const rec = records[ri]!;
    if (rec.h === '') {
      if (intro && intro.body.trim()) out[ri] = intro.body;
      continue;
    }
    const want = fold(rec.h);
    let found = -1;
    for (let k = cursor; k < headingSecs.length; k++) {
      if (fold(headingSecs[k]!.heading) === want) { found = k; break; }
    }
    if (found >= 0) { out[ri] = headingSecs[found]!.body; cursor = found + 1; }
  }
  return out;
}
