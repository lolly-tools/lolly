// SPDX-License-Identifier: MPL-2.0
/**
 * OpenDocument Text (.odt) writer — pure, DOM-free, platform-agnostic.
 *
 * An .odt is an OpenDocument OCF ZIP, the same container discipline as EPUB: the
 * FIRST entry must be an uncompressed (STORED) `mimetype` file holding exactly
 * `application/vnd.oasis.opendocument.text`, with no extra fields — the magic a
 * reader (LibreOffice, Word, Google Docs) sniffs before it trusts the package.
 * Everything after it is ordinary DEFLATEd XML.
 *
 * We build the minimal package OpenDocument 1.2 requires for editable text:
 *   mimetype               STORED, first
 *   content.xml            office:document-content → office:body/office:text
 *   styles.xml             office:document-styles (minimal styles + defaults)
 *   META-INF/manifest.xml  the OCF manifest listing every part
 *
 * Headings become `<text:h text:outline-level="N">`, paragraphs `<text:p>`, both
 * carrying a named paragraph style (`Heading_20_N` / `Standard`) declared in
 * content.xml's automatic styles — so the output is real editable text the reader
 * can re-flow and re-style, NOT a picture. All caller text is XML-escaped.
 *
 * Deterministic: `storeZip` writes a fixed DOS date and no data descriptors, so
 * the same `doc` always yields the same bytes. Reuses the shared `storeZip`
 * primitive (`mimetypeFirst`) — no DOM, no fs, no network, no new zip framing.
 */

import { storeZip, type ZipStoreEntry } from './zip.ts';

/** One block of document body content. */
export interface OdtBlock {
  type: 'heading' | 'paragraph';
  /** Outline level for headings (1-based, default 1). Ignored for paragraphs. */
  level?: number;
  /** The block's plain text. XML-escaped on write. */
  text: string;
}

export interface OdtDoc {
  /** Document title. When set, written to `meta.xml` as `<dc:title>` (shown in a
   *  reader's document properties); omitted from the package when absent. */
  title?: string;
  blocks: OdtBlock[];
}

const MIMETYPE = 'application/vnd.oasis.opendocument.text';

const enc = new TextEncoder();

/** ODF namespace URIs, declared once on each document root. */
const NS_OFFICE = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
const NS_TEXT = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
const NS_STYLE = 'urn:oasis:names:tc:opendocument:xmlns:style:1.0';
const NS_FO = 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0';
const NS_MANIFEST = 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0';
const NS_META = 'urn:oasis:names:tc:opendocument:xmlns:meta:1.0';
const NS_DC = 'http://purl.org/dc/elements/1.1/';

/** Escape the five XML metacharacters for text landing in element content or attributes. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Clamp a heading level into the 1..10 range ODF outlines admit. */
function clampLevel(level: number | undefined): number {
  const n = Math.trunc(level ?? 1);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n > 10 ? 10 : n;
}

/**
 * ODF encodes a paragraph's spaces beyond the first as `<text:s/>` runs and keeps
 * lone spaces as text; we take the simple, always-valid route of escaping the run
 * verbatim (readers collapse insignificant whitespace on display but preserve the
 * characters), which is enough for editable heading/paragraph text.
 */
function bodyBlock(block: OdtBlock): string {
  const text = esc(block.text);
  if (block.type === 'heading') {
    const level = clampLevel(block.level);
    return `      <text:h text:style-name="Heading_20_${level}" text:outline-level="${level}">${text}</text:h>`;
  }
  return `      <text:p text:style-name="Standard">${text}</text:p>`;
}

/** The distinct heading levels present, so we declare a style for each used level. */
function usedHeadingLevels(blocks: OdtBlock[]): number[] {
  const levels = new Set<number>();
  for (const b of blocks) {
    if (b.type === 'heading') levels.add(clampLevel(b.level));
  }
  return [...levels].sort((a, b) => a - b);
}

function contentXml(doc: OdtDoc): string {
  const body = doc.blocks.map(bodyBlock).join('\n');

  // Automatic styles: one paragraph style per used heading level, plus Standard.
  // Larger, bold type for headings so the outline is visible; nothing exotic, so
  // every reader renders it and the text stays fully editable.
  const headingStyles = usedHeadingLevels(doc.blocks)
    .map((level) => {
      const size = Math.max(12, 22 - (level - 1) * 2);
      return `    <style:style style:name="Heading_20_${level}" style:family="paragraph" style:parent-style-name="Standard" style:default-outline-level="${level}">
      <style:text-properties fo:font-size="${size}pt" fo:font-weight="bold"/>
    </style:style>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="${NS_OFFICE}" xmlns:text="${NS_TEXT}" xmlns:style="${NS_STYLE}" xmlns:fo="${NS_FO}" office:version="1.2">
  <office:automatic-styles>
    <style:style style:name="Standard" style:family="paragraph" style:class="text"/>
${headingStyles}
  </office:automatic-styles>
  <office:body>
    <office:text>
${body}
    </office:text>
  </office:body>
</office:document-content>
`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="${NS_OFFICE}" xmlns:text="${NS_TEXT}" xmlns:style="${NS_STYLE}" xmlns:fo="${NS_FO}" office:version="1.2">
  <office:styles>
    <style:default-style style:family="paragraph">
      <style:paragraph-properties style:writing-mode="page"/>
      <style:text-properties fo:font-size="12pt"/>
    </style:default-style>
    <style:style style:name="Standard" style:family="paragraph" style:class="text"/>
  </office:styles>
</office:document-styles>
`;

/** `meta.xml` carrying the document title as Dublin Core `<dc:title>`. */
function metaXml(title: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="${NS_OFFICE}" xmlns:meta="${NS_META}" xmlns:dc="${NS_DC}" office:version="1.2">
  <office:meta>
    <dc:title>${esc(title)}</dc:title>
  </office:meta>
</office:document-meta>
`;
}

/** The OCF manifest listing the root document and every part. `hasMeta` adds the
 *  optional meta.xml entry only when a title produced one. */
function manifestXml(hasMeta: boolean): string {
  const entry = (path: string, mediaType: string) =>
    `  <manifest:file-entry manifest:full-path="${path}" manifest:media-type="${mediaType}"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="${NS_MANIFEST}" manifest:version="1.2">
${entry('/', MIMETYPE)}
${entry('content.xml', 'text/xml')}
${entry('styles.xml', 'text/xml')}
${hasMeta ? `${entry('meta.xml', 'text/xml')}\n` : ''}</manifest:manifest>
`;
}

/**
 * Build .odt bytes for `doc`. The `mimetype` entry is written first and STORED
 * (OCF requirement); every other part is DEFLATEd. Deterministic for a given
 * input. Text is XML-escaped and stays editable in LibreOffice/Word/Google Docs.
 */
export function writeOdt(doc: OdtDoc): Uint8Array {
  const title = doc.title?.trim();
  const entries: ZipStoreEntry[] = [
    { name: 'mimetype', bytes: enc.encode(MIMETYPE) },
    { name: 'content.xml', bytes: enc.encode(contentXml(doc)) },
    { name: 'styles.xml', bytes: enc.encode(STYLES_XML) },
  ];
  if (title) entries.push({ name: 'meta.xml', bytes: enc.encode(metaXml(title)) });
  entries.push({ name: 'META-INF/manifest.xml', bytes: enc.encode(manifestXml(!!title)) });
  return storeZip(entries, { mimetypeFirst: true });
}
