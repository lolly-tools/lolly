// SPDX-License-Identifier: MPL-2.0
/**
 * Where an SVG document's own Content Credential lives: a `<c2pa:manifest>` element in a
 * `<metadata>` element that is a direct child of the root `<svg>` (C2PA specification,
 * Appendix A, the SVG embedding). c2pa-rs reads that path and no other, so a manifest
 * further down the tree belongs to a nested piece of artwork, such as an inlined catalog
 * logo, and not to the file.
 *
 * The scan is byte-wise over ASCII structural characters, so it works on the binary
 * string of UTF-8 bytes without decoding them. It skips comments, CDATA sections and
 * processing instructions, reads attribute values with their quotes, and stops at the
 * root's own end tag. One pass, linear in the input, and it never throws: a document it
 * cannot follow reports what it found up to that point.
 */

/** What {@link locateSvgCredential} found below the root `<svg>`. */
export interface SvgCredentialSite {
  /** Index of the `<` that opens the root `<svg>`. */
  rootStart: number;
  /** Index of the `>` that closes the root's open tag. */
  rootTagEnd: number;
  /** Index just past the open tag of the root's first direct `<metadata>` child, or null. */
  metadataOpenEnd: number | null;
  /**
   * The text of the first `<c2pa:manifest>` in a direct `<metadata>` child of the root:
   * from just past its open tag to its `</c2pa:manifest>`, or `end: -1` when that close
   * tag never comes. Null when there is none.
   */
  manifest: { start: number; end: number } | null;
}

/** The root `<svg …>` open tag: the first `<svg` followed by whitespace or `>`, read to its quote-aware `>`. */
function rootTag(s: string): { start: number; end: number } | null {
  const open = /<svg(?=[\s>])/.exec(s);
  if (!open) return null;
  let q: string | null = null;
  for (let i = open.index + 4; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === q) q = null; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (ch === '>') return { start: open.index, end: i };
  }
  return null;
}

/** Index of the `>` that ends the tag opening at `at`, reading quoted attribute values whole; -1 when unterminated. */
function tagEnd(s: string, at: number): number {
  let q: string | null = null;
  for (let i = at + 1; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === q) q = null; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (ch === '>') return i;
  }
  return -1;
}

const NAME_END = /[\s/>]/;
function tagName(s: string, from: number): string {
  let i = from;
  while (i < s.length && !NAME_END.test(s[i]!)) i++;
  return s.slice(from, i);
}

/**
 * Find the root `<svg>` and its own credential site in `s`, the SVG as a binary string.
 * Null when there is no root `<svg>` open tag, or it never closes.
 */
export function locateSvgCredential(s: string): SvgCredentialSite | null {
  const root = rootTag(s);
  if (!root) return null;
  const site: SvgCredentialSite = { rootStart: root.start, rootTagEnd: root.end, metadataOpenEnd: null, manifest: null };
  if (s[root.end - 1] === '/') return site; // <svg/> has no children
  // depth 0 = a direct child of the root. `inMeta` is true while inside a direct <metadata>.
  let depth = 0;
  let inMeta = false;
  let i = root.end + 1;
  while (i < s.length) {
    const lt = s.indexOf('<', i);
    if (lt < 0) break;
    if (s.startsWith('<!--', lt)) { const e = s.indexOf('-->', lt + 4); if (e < 0) break; i = e + 3; continue; }
    if (s.startsWith('<![CDATA[', lt)) { const e = s.indexOf(']]>', lt + 9); if (e < 0) break; i = e + 3; continue; }
    if (s.startsWith('<?', lt)) { const e = s.indexOf('?>', lt + 2); if (e < 0) break; i = e + 2; continue; }
    if (s.startsWith('<!', lt)) { const e = s.indexOf('>', lt + 2); if (e < 0) break; i = e + 1; continue; }
    const end = tagEnd(s, lt);
    if (end < 0) break;
    i = end + 1;
    if (s[lt + 1] === '/') {
      depth--;
      if (depth < 0) break; // the root's own end tag
      if (depth === 0) inMeta = false;
      continue;
    }
    if (s[end - 1] === '/') continue; // self-closing: no children, no depth change
    const name = tagName(s, lt + 1);
    if (depth === 0 && name === 'metadata') {
      inMeta = true;
      if (site.metadataOpenEnd === null) site.metadataOpenEnd = end + 1;
    } else if (depth === 1 && inMeta && name === 'c2pa:manifest') {
      site.manifest = { start: end + 1, end: s.indexOf('</c2pa:manifest>', end + 1) };
      return site;
    }
    depth++;
  }
  return site;
}
