// SPDX-License-Identifier: MPL-2.0
/**
 * EPUB 3 writer - pure, DOM-free, platform-agnostic.
 *
 * An .epub is an OCF ZIP with one hard rule the reader relies on: the FIRST entry
 * must be an uncompressed (STORED) `mimetype` file holding exactly
 * `application/epub+zip`, with no extra fields - that's the "magic" a reader sniffs
 * before it trusts the container. Everything after it is ordinary DEFLATEd XML.
 *
 * We build the minimal EPUB 3 spine:
 *   mimetype                 STORED, first
 *   META-INF/container.xml   → points at the OPF
 *   OEBPS/content.opf        metadata + manifest + spine (reading order)
 *   OEBPS/nav.xhtml          the EPUB 3 navigation document (toc nav)
 *   OEBPS/chapter-N.xhtml    one per chapter, the caller's body wrapped in XHTML
 *
 * Deterministic: no timestamps or randomness reach the bytes (fflate zips with a
 * fixed mtime of 0), so the same `doc` always yields the same bytes. The caller's
 * `xhtml` is treated as trusted body markup and passed through verbatim - text we
 * generate (titles, author, ids) is XML-escaped. Chapter files are content-safe by
 * construction; the caller owns the correctness of the XHTML fragment it supplies.
 *
 * Only dependency is fflate's `zipSync` (already a workspace dep; the engine has
 * `deflateRaw` but no pure inflate, and zipSync gives us STORED + DEFLATE framing
 * and the correct local/central headers for free). No DOM, no fs, no network.
 */

import { zipSync } from 'fflate';

export interface EpubChapter {
  /** Chapter title - used in the nav TOC and the chapter's <title>. */
  title: string;
  /** XHTML body markup (the inner content of <body>). Trusted, passed through verbatim. */
  xhtml: string;
}

export interface EpubDoc {
  title: string;
  author?: string;
  chapters: EpubChapter[];
  /** BCP-47 language tag for dc:language / xml:lang. Defaults to 'en'. */
  lang?: string;
}

const enc = new TextEncoder();

/** Fixed timestamp for deterministic output - the earliest date the zip DOS format admits. */
const EPOCH_1980 = new Date(Date.UTC(1980, 0, 1, 0, 0, 0));

/** Escape the five XML metacharacters for text that lands in element content or attributes. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Zero-padded chapter file stem, so lexical order matches spine order (chapter-001…). */
function chapterName(i: number): string {
  return `chapter-${String(i + 1).padStart(3, '0')}`;
}

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`;

function chapterXhtml(chapter: EpubChapter, lang: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${esc(lang)}" lang="${esc(lang)}">
  <head>
    <meta charset="utf-8"/>
    <title>${esc(chapter.title)}</title>
  </head>
  <body>
${chapter.xhtml}
  </body>
</html>
`;
}

function navXhtml(doc: EpubDoc, lang: string): string {
  const items = doc.chapters
    .map((c, i) => `        <li><a href="${chapterName(i)}.xhtml">${esc(c.title)}</a></li>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${esc(lang)}" lang="${esc(lang)}">
  <head>
    <meta charset="utf-8"/>
    <title>${esc(doc.title)}</title>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>${esc(doc.title)}</h1>
      <ol>
${items}
      </ol>
    </nav>
  </body>
</html>
`;
}

function contentOpf(doc: EpubDoc, lang: string): string {
  // Stable per-document identifier derived from the title only (no timestamp/random) so
  // the bytes stay deterministic; a real publishing flow would pass a persistent UUID/ISBN.
  const bookId = `urn:lolly:${esc(doc.title).replace(/\s+/g, '-').toLowerCase() || 'untitled'}`;
  const author = doc.author
    ? `\n    <dc:creator id="author">${esc(doc.author)}</dc:creator>`
    : '';

  const manifestItems = [
    '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    ...doc.chapters.map(
      (_, i) =>
        `    <item id="${chapterName(i)}" href="${chapterName(i)}.xhtml" media-type="application/xhtml+xml"/>`,
    ),
  ].join('\n');

  const spineItems = doc.chapters
    .map((_, i) => `    <itemref idref="${chapterName(i)}"/>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${esc(lang)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${bookId}</dc:identifier>
    <dc:title>${esc(doc.title)}</dc:title>
    <dc:language>${esc(lang)}</dc:language>${author}
    <meta property="dcterms:modified">1970-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
${manifestItems}
  </manifest>
  <spine>
${spineItems}
  </spine>
</package>
`;
}

/**
 * Build EPUB 3 bytes for `doc`. The mimetype entry is written first and STORED; every
 * other entry is DEFLATEd. Deterministic for a given input.
 */
export function writeEpub(doc: EpubDoc): Uint8Array {
  const lang = doc.lang && doc.lang.trim() ? doc.lang.trim() : 'en';

  // Insertion order is preserved by zipSync, so `mimetype` stays the first local entry.
  const files: Record<string, [Uint8Array, { level: 0 | 6 }]> = {
    // STORED (level 0), no extra fields - the OCF "magic" the reader sniffs first.
    mimetype: [enc.encode('application/epub+zip'), { level: 0 }],
    'META-INF/container.xml': [enc.encode(CONTAINER_XML), { level: 6 }],
    'OEBPS/content.opf': [enc.encode(contentOpf(doc, lang)), { level: 6 }],
    'OEBPS/nav.xhtml': [enc.encode(navXhtml(doc, lang)), { level: 6 }],
  };

  doc.chapters.forEach((c, i) => {
    files[`OEBPS/${chapterName(i)}.xhtml`] = [enc.encode(chapterXhtml(c, lang)), { level: 6 }];
  });

  // A fixed 1980-01-01 mtime keeps the bytes stable (zip's DOS date epoch is 1980, so 0
  // is out of range); zipSync writes the local dir in insertion order.
  return zipSync(files as Parameters<typeof zipSync>[0], { mtime: EPOCH_1980 });
}
