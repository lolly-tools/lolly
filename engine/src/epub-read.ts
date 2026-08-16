// SPDX-License-Identifier: MPL-2.0
/**
 * epub-read.ts - READ an EPUB back to titled chapters of markdown text.
 *
 * The inverse of `epub.ts`/`writeEpub`. Where the writer packs `EpubChapter`s
 * into an OCF zip, this unpacks one and recovers the reading-order chapters as
 * clean markdown. Its purpose is BRAND BOILERPLATE INGESTION - a brand's
 * body-copy corpus (an .epub of approved paragraphs) becomes managed catalog
 * text a `text`/`longtext` tool input can resolve - NOT e-book round-tripping.
 * So it favours clean text fidelity over layout: it recovers headings, running
 * paragraphs, bullet lists and bold/italic emphasis, and discards everything
 * else (styling, columns, imagery, page structure).
 *
 * ── HOW AN EPUB IS READ ──────────────────────────────────────────────────────
 *   1. `readZip` unpacks the OCF container to a name→bytes map.
 *   2. `META-INF/container.xml` names the OPF package document (`full-path`).
 *   3. The OPF `<spine>` lists `<itemref idref=…>` in READING ORDER; each idref
 *      resolves through the `<manifest>` (id → href) to an XHTML content file.
 *      Hrefs are relative to the OPF's own directory.
 *   4. Each XHTML file's `<body>` is converted to markdown (headings → `#…`,
 *      `<p>` → paragraphs, `<li>` → `- `, `<strong>/<b>` → `**…**`,
 *      `<em>/<i>` → `_…_`; every other tag is stripped, entities decoded).
 *   5. A chapter's title is its first heading, else its label in the nav/TOC
 *      document (the manifest item with `properties="nav"`).
 *
 * ── XML/HTML HANDLING ────────────────────────────────────────────────────────
 * The engine ships no XML library and stays DOM-free, so this is deliberate
 * string/regex extraction, not a parser. That is sufficient - and correct - for
 * the "recover the prose" scope: we never need the document tree, only its text
 * runs and block boundaries. A malformed part yields best-effort text rather
 * than a tree, which is exactly the failure mode we want for ingestion.
 *
 * Pure byte + string work: no DOM, no fs, no network. Structural absence
 * (no container, no OPF) throws loudly, matching `readZip`.
 */

import { readZip } from './zip.ts';

/** One recovered chapter: a title plus its body as markdown. */
export interface EpubReadChapter {
  /** First heading in the chapter, else its nav/TOC label, else a fallback. */
  title: string;
  /** The chapter body converted to markdown (headings, paragraphs, lists, emphasis). */
  markdown: string;
}

/** The recovered book: its title and chapters in spine (reading) order. */
export interface EpubReadDoc {
  title: string;
  chapters: EpubReadChapter[];
}

const decoder = new TextDecoder('utf-8');

/**
 * Read an EPUB (OCF zip) into reading-order chapters of markdown.
 *
 * @param bytes the whole .epub file.
 * @returns `{ title, chapters: [{ title, markdown }] }` in spine order.
 * @throws on a non-zip input (via `readZip`), a missing `META-INF/container.xml`,
 *         or a missing OPF package document.
 */
export function readEpub(bytes: Uint8Array): EpubReadDoc {
  const parts = new Map<string, Uint8Array>();
  for (const e of readZip(bytes)) parts.set(e.name, e.bytes);

  const containerXml = textOf(parts, 'META-INF/container.xml');
  if (containerXml === undefined) {
    throw new Error('readEpub: META-INF/container.xml not found (not an EPUB)');
  }
  const opfPath = attr(matchTag(containerXml, 'rootfile') ?? '', 'full-path');
  if (!opfPath) throw new Error('readEpub: no rootfile in container.xml');

  const opf = textOf(parts, opfPath);
  if (opf === undefined) throw new Error(`readEpub: OPF package "${opfPath}" not found`);
  const opfDir = dirOf(opfPath);

  const bookTitle = firstText(opf, /<(?:\w+:)?title\b[^>]*>([\s\S]*?)<\/(?:\w+:)?title>/i);

  // manifest: id → { href (resolved), mediaType, properties }
  const manifest = new Map<string, { href: string; mediaType: string; properties: string }>();
  let navPath = '';
  for (const tag of matchTags(opf, 'item')) {
    const id = attr(tag, 'id');
    const href = attr(tag, 'href');
    if (!id || !href) continue;
    const resolved = resolvePath(opfDir, href);
    const properties = attr(tag, 'properties');
    manifest.set(id, { href: resolved, mediaType: attr(tag, 'media-type'), properties });
    if (/\bnav\b/.test(properties)) navPath = resolved;
  }

  // nav/TOC labels: resolvedContentPath → label (hrefs are relative to the nav doc).
  const navLabels = new Map<string, string>();
  if (navPath) {
    const navHtml = textOf(parts, navPath);
    if (navHtml !== undefined) collectNavLabels(navHtml, dirOf(navPath), navLabels);
  }

  const chapters: EpubReadChapter[] = [];
  for (const itemref of matchTags(opf, 'itemref')) {
    const idref = attr(itemref, 'idref');
    if (!idref) continue;
    const item = manifest.get(idref);
    if (!item) continue;
    if (item.mediaType && !/xhtml|html/i.test(item.mediaType)) continue;
    const xhtml = textOf(parts, item.href);
    if (xhtml === undefined) continue;

    const body = extractBody(xhtml);
    const markdown = htmlToMarkdown(body);
    const title =
      firstHeadingText(body) ||
      navLabels.get(item.href) ||
      firstText(xhtml, /<title\b[^>]*>([\s\S]*?)<\/title>/i) ||
      `Chapter ${chapters.length + 1}`;
    chapters.push({ title, markdown });
  }

  return { title: bookTitle, chapters };
}

// ── HTML → markdown ──────────────────────────────────────────────────────────

/** Convert a `<body>` inner-HTML fragment to markdown, discarding non-text structure. */
function htmlToMarkdown(html: string): string {
  let s = html;
  // Drop script/style wholesale - never prose.
  s = s.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, '');
  // Inline emphasis → markdown markers, BEFORE block extraction so they survive inside.
  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, inner) => `**${inner}**`);
  s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _t, inner) => `_${inner}_`);
  // Headings h1–h6 → `#…` blocks.
  s = s.replace(
    /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi,
    (_m, lvl, inner) => `\n\n${'#'.repeat(Number(lvl))} ${inlineText(inner)}\n\n`,
  );
  // List items → `- ` (one per line); the surrounding ul/ol tags fall to the strip below.
  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, inner) => `\n- ${inlineText(inner)}`);
  // Paragraphs → blank-line-separated blocks.
  s = s.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_m, inner) => `\n\n${inlineText(inner)}\n\n`);
  // Explicit line breaks.
  s = s.replace(/<br\s*\/?>/gi, '\n');
  // Strip every remaining tag.
  s = s.replace(/<[^>]+>/g, '');
  // Decode entities, then tidy whitespace.
  s = decodeEntities(s);
  s = s
    .replace(/[ \t]+\n/g, '\n') // trailing spaces
    .replace(/[ \t]{2,}/g, ' ') // runs of spaces
    .replace(/\n{3,}/g, '\n\n'); // at most one blank line
  return s.trim();
}

/** Collapse inline content (leftover tags stripped later) to a single spaced line. */
function inlineText(html: string): string {
  return html.replace(/\s+/g, ' ').trim();
}

/** The text of the first heading in a fragment, tags stripped and entities decoded. */
function firstHeadingText(body: string): string {
  const m = body.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (!m) return '';
  return decodeEntities(m[1]!.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

/** Extract a nav document's anchor labels, keyed by resolved content path. */
function collectNavLabels(navHtml: string, navDir: string, out: Map<string, string>): void {
  const re = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(navHtml)) !== null) {
    const href = m[1] ?? m[2] ?? '';
    const label = decodeEntities(m[3]!.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    const resolved = resolvePath(navDir, href);
    if (resolved && label && !out.has(resolved)) out.set(resolved, label);
  }
}

// ── tiny string/XML helpers ──────────────────────────────────────────────────

/** Decode a part's bytes as UTF-8 text, or `undefined` if the part is absent. */
function textOf(parts: Map<string, Uint8Array>, name: string): string | undefined {
  const b = parts.get(name);
  return b === undefined ? undefined : decoder.decode(b);
}

/** The `<body>…</body>` inner HTML, or the whole document if there is no body. */
function extractBody(xhtml: string): string {
  const m = xhtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return m ? m[1]! : xhtml;
}

/** First captured group of `re` against `s`, tag-stripped and entity-decoded; `''` if none. */
function firstText(s: string, re: RegExp): string {
  const m = s.match(re);
  if (!m) return '';
  return decodeEntities(m[1]!.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

/** The first whole `<name …>` (or `<name …/>`) start-tag in `s`, or `undefined`. */
function matchTag(s: string, name: string): string | undefined {
  const m = s.match(new RegExp(`<${name}\\b[^>]*>`, 'i'));
  return m ? m[0] : undefined;
}

/** Every `<name …>` start-tag in `s`, in document order. */
function matchTags(s: string, name: string): string[] {
  const re = new RegExp(`<${name}\\b[^>]*>`, 'gi');
  return s.match(re) ?? [];
}

/** Read an attribute value (double- or single-quoted) from a start-tag; `''` if absent. */
function attr(tag: string, name: string): string {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = tag.match(new RegExp(`\\b${esc}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[1] ?? m[2] ?? '') : '';
}

/** The directory portion of a zip path, with trailing slash (`''` at the root). */
function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i + 1);
}

/** Resolve an href against a base directory, honouring `.`/`..`; drops any `#fragment`/`?query`. */
function resolvePath(baseDir: string, href: string): string {
  const clean = href.split('#')[0]!.split('?')[0]!;
  const out: string[] = [];
  for (const seg of (baseDir + clean).split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
}

/** Decode the XML/HTML entities we care about; `&amp;` last so `&amp;lt;` → `&lt;`. */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => fromCodePoint(Number.parseInt(d, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** Safe `String.fromCodePoint` - an out-of-range or non-finite value yields `''`. */
function fromCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return '';
  try {
    return String.fromCodePoint(cp);
  } catch {
    return '';
  }
}
