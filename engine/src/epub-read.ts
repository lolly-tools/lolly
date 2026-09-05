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

/** EPUB ingest is for prose corpora, so it intentionally uses tighter ZIP budgets. */
export const EPUB_READ_MAX_INPUT_BYTES = 64 * 1024 * 1024;
export const EPUB_READ_MAX_PARTS = 4_096;
export const EPUB_READ_MAX_PART_BYTES = 16 * 1024 * 1024;
export const EPUB_READ_MAX_TOTAL_BYTES = 64 * 1024 * 1024;
export const EPUB_READ_MAX_MANIFEST_ITEMS = 10_000;
export const EPUB_READ_MAX_SPINE_ITEMS = 4_096;
export const EPUB_READ_MAX_NAV_LABELS = 4_096;
export const EPUB_READ_MAX_TITLE_CHARS = 4_096;
export const EPUB_READ_MAX_OUTPUT_CHARS = 64 * 1024 * 1024;

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
  for (const e of readZip(bytes, {
    maxInputBytes: EPUB_READ_MAX_INPUT_BYTES,
    maxEntries: EPUB_READ_MAX_PARTS,
    maxEntryBytes: EPUB_READ_MAX_PART_BYTES,
    maxTotalBytes: EPUB_READ_MAX_TOTAL_BYTES,
  })) {
    if (parts.has(e.name)) throw new Error(`readEpub: duplicate part "${e.name}"`);
    parts.set(e.name, e.bytes);
  }

  const mimetype = textOf(parts, 'mimetype');
  if (mimetype !== undefined && mimetype.trim() !== 'application/epub+zip') {
    throw new Error('readEpub: invalid OCF mimetype (not an EPUB)');
  }

  const containerXml = textOf(parts, 'META-INF/container.xml');
  if (containerXml === undefined) {
    throw new Error('readEpub: META-INF/container.xml not found (not an EPUB)');
  }
  const opfPath = attr(firstStartTag(containerXml, 'rootfile') ?? '', 'full-path');
  if (!opfPath) throw new Error('readEpub: no rootfile in container.xml');

  const opf = textOf(parts, opfPath);
  if (opf === undefined) throw new Error(`readEpub: OPF package "${opfPath}" not found`);
  const opfDir = dirOf(opfPath);

  const bookTitle = boundedTitle(firstElementText(opf, 'title'), 'book title');

  // manifest: id → { href (resolved), mediaType, properties }
  const manifest = new Map<string, { href: string; mediaType: string; properties: string }>();
  let navPath = '';
  for (const tag of matchTags(opf, 'item', EPUB_READ_MAX_MANIFEST_ITEMS, 'manifest items')) {
    const id = attr(tag, 'id');
    const href = attr(tag, 'href');
    if (!id || !href) continue;
    const resolved = resolvePath(opfDir, href);
    const properties = attr(tag, 'properties');
    if (manifest.has(id)) throw new Error(`readEpub: duplicate manifest id "${id}"`);
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
  let outputChars = bookTitle.length;
  for (const itemref of matchTags(opf, 'itemref', EPUB_READ_MAX_SPINE_ITEMS, 'spine items')) {
    const idref = attr(itemref, 'idref');
    if (!idref) continue;
    const item = manifest.get(idref);
    if (!item) continue;
    if (item.mediaType && !/xhtml|html/i.test(item.mediaType)) continue;
    const xhtml = textOf(parts, item.href);
    if (xhtml === undefined) continue;

    const body = extractBody(xhtml);
    const markdown = htmlToMarkdown(body);
    const title = boundedTitle(
      firstHeadingText(body) ||
      navLabels.get(item.href) ||
      firstElementText(xhtml, 'title') ||
      `Chapter ${chapters.length + 1}`,
      'chapter title',
    );
    outputChars += title.length + markdown.length;
    if (!Number.isSafeInteger(outputChars) || outputChars > EPUB_READ_MAX_OUTPUT_CHARS) {
      throw new Error(`readEpub: recovered text exceeds ${EPUB_READ_MAX_OUTPUT_CHARS} characters`);
    }
    chapters.push({ title, markdown });
  }

  return { title: bookTitle, chapters };
}

// ── HTML → markdown ──────────────────────────────────────────────────────────

/** Convert a `<body>` inner-HTML fragment to markdown, discarding non-text structure. */
function htmlToMarkdown(html: string): string {
  const out: string[] = [];
  let cursor = 0;
  let suppressed: 'script' | 'style' | undefined;
  for (;;) {
    const tag = nextHtmlTag(html, cursor);
    if (!tag) {
      if (!suppressed) out.push(html.slice(cursor));
      break;
    }
    if (!suppressed) out.push(html.slice(cursor, tag.start));
    const name = localName(tag.name);
    if (suppressed) {
      if (tag.closing && name === suppressed) suppressed = undefined;
      cursor = tag.end;
      continue;
    }
    if (!tag.closing && (name === 'script' || name === 'style')) {
      suppressed = name;
      cursor = tag.end;
      continue;
    }
    if (name === 'strong' || name === 'b') out.push('**');
    else if (name === 'em' || name === 'i') out.push('_');
    else if (/^h[1-6]$/.test(name)) {
      out.push(tag.closing ? '\n\n' : `\n\n${'#'.repeat(Number(name[1]))} `);
    } else if (name === 'li' && !tag.closing) out.push('\n- ');
    else if (name === 'p') out.push('\n\n');
    else if (name === 'br' && !tag.closing) out.push('\n');
    cursor = tag.end;
  }

  let s = out.join('');
  // Decode entities, then tidy whitespace.
  s = decodeEntities(s);
  s = s
    .replace(/[ \t]+\n/g, '\n') // trailing spaces
    .replace(/[ \t]{2,}/g, ' ') // runs of spaces
    .replace(/\n{3,}/g, '\n\n'); // at most one blank line
  return s.trim();
}

/** The text of the first heading in a fragment, tags stripped and entities decoded. */
function firstHeadingText(body: string): string {
  const inner = firstElementInner(body, (name) => /^h[1-6]$/.test(localName(name)));
  return inner === undefined ? '' : plainText(inner);
}

/** Extract a nav document's anchor labels, keyed by resolved content path. */
function collectNavLabels(navHtml: string, navDir: string, out: Map<string, string>): void {
  let cursor = 0;
  let anchors = 0;
  let active: { href: string; labelStart: number } | undefined;
  for (;;) {
    const tag = nextHtmlTag(navHtml, cursor);
    if (!tag) return;
    if (localName(tag.name) === 'a') {
      if (!tag.closing) {
        anchors++;
        if (anchors > EPUB_READ_MAX_NAV_LABELS) {
          throw new Error(`readEpub: navigation has more than ${EPUB_READ_MAX_NAV_LABELS} labels`);
        }
        active = { href: attr(navHtml.slice(tag.start, tag.end), 'href'), labelStart: tag.end };
      } else if (active) {
        const label = plainText(navHtml.slice(active.labelStart, tag.start));
        const resolved = resolvePath(navDir, active.href);
        if (label.length > EPUB_READ_MAX_TITLE_CHARS) {
          throw new Error(`readEpub: navigation label exceeds ${EPUB_READ_MAX_TITLE_CHARS} characters`);
        }
        if (resolved && label && !out.has(resolved)) out.set(resolved, label);
        active = undefined;
      }
    }
    cursor = tag.end;
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
  return firstElementInner(xhtml, (name) => localName(name) === 'body') ?? xhtml;
}

/** Text of the first element with this local name, or `''`. */
function firstElementText(s: string, name: string): string {
  const inner = firstElementInner(s, (candidate) => localName(candidate) === name);
  return inner === undefined ? '' : plainText(inner);
}

/** The first whole `<name …>` (or `<name …/>`) start-tag in `s`, or `undefined`. */
function firstStartTag(s: string, name: string): string | undefined {
  let cursor = 0;
  for (;;) {
    const tag = nextHtmlTag(s, cursor);
    if (!tag) return undefined;
    if (!tag.closing && localName(tag.name) === name) return s.slice(tag.start, tag.end);
    cursor = tag.end;
  }
}

/** Every `<name …>` start-tag in `s`, in document order. */
function matchTags(s: string, name: string, max: number, label: string): string[] {
  const out: string[] = [];
  let cursor = 0;
  for (;;) {
    const tag = nextHtmlTag(s, cursor);
    if (!tag) return out;
    if (!tag.closing && localName(tag.name) === name) {
      out.push(s.slice(tag.start, tag.end));
      if (out.length > max) throw new Error(`readEpub: more than ${max} ${label}`);
    }
    cursor = tag.end;
  }
}

interface HtmlTag {
  start: number;
  end: number;
  name: string;
  closing: boolean;
}

/** Find the next complete tag with a bounded, forward-only scan. */
function nextHtmlTag(s: string, from: number): HtmlTag | undefined {
  let cursor = from;
  while (cursor < s.length) {
    const start = s.indexOf('<', cursor);
    if (start < 0) return undefined;
    const close = s.indexOf('>', start + 1);
    if (close < 0) return undefined;
    let i = start + 1;
    while (i < close && /\s/.test(s[i]!)) i++;
    const closing = s[i] === '/';
    if (closing) {
      i++;
      while (i < close && /\s/.test(s[i]!)) i++;
    }
    const nameStart = i;
    while (i < close && /[A-Za-z0-9:_-]/.test(s[i]!)) i++;
    if (i > nameStart) {
      return { start, end: close + 1, name: s.slice(nameStart, i).toLowerCase(), closing };
    }
    cursor = close + 1;
  }
  return undefined;
}

/** Extract the first matched element body without backtracking regular expressions. */
function firstElementInner(s: string, wanted: (name: string) => boolean): string | undefined {
  let cursor = 0;
  let open: { name: string; contentStart: number } | undefined;
  for (;;) {
    const tag = nextHtmlTag(s, cursor);
    if (!tag) return undefined;
    if (!open && !tag.closing && wanted(tag.name)) open = { name: tag.name, contentStart: tag.end };
    else if (open && tag.closing && tag.name === open.name) return s.slice(open.contentStart, tag.start);
    cursor = tag.end;
  }
}

/** Strip complete tags and normalize the remaining text in one forward pass. */
function plainText(s: string): string {
  const out: string[] = [];
  let cursor = 0;
  for (;;) {
    const tag = nextHtmlTag(s, cursor);
    if (!tag) {
      out.push(s.slice(cursor));
      break;
    }
    out.push(s.slice(cursor, tag.start));
    cursor = tag.end;
  }
  return decodeEntities(out.join('')).replace(/\s+/g, ' ').trim();
}

function localName(name: string): string {
  return name.slice(name.lastIndexOf(':') + 1);
}

function boundedTitle(title: string, label: string): string {
  if (title.length > EPUB_READ_MAX_TITLE_CHARS) {
    throw new Error(`readEpub: ${label} exceeds ${EPUB_READ_MAX_TITLE_CHARS} characters`);
  }
  return title;
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
