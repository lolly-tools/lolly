// SPDX-License-Identifier: MPL-2.0
/**
 * Office package → content: the pptx/docx extraction shared by the convert view,
 * the "Add data" input source, the deck upload choice, Doc Studio's Word import
 * and /verify's docx text pass (plans/139 WP3 + WP4 consumers).
 *
 * The engine owns every parse - readPptx/deckToMarkdown for a deck, readDocx plus
 * mdFromBlocks/htmlFromBlocks for a document - and stays zip-free and DOM-free by
 * contract, so this module owns exactly the two host-side pieces: the capped unzip
 * (bridge/pptx.ts's inflatePptx caps the ARCHIVE, not the format, so a .docx rides
 * the same zip-bomb regime) and the injected DOMParser. Import it lazily: it pulls
 * fflate plus the engine readers.
 */

import {
  deckToMarkdown, htmlFromBlocks, isDocx, isPptx, mdFromBlocks, readDocx, readPptx, storeZip,
} from '@lolly/engine';
import type { DocBlock } from '@lolly/engine';
import { inflatePptx } from '../bridge/pptx.ts';

/** The OOXML wordprocessing MIME (the docx sibling of bridge/pptx.ts's PPTX_MIME). */
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
/** What a markdown-plus-media download is packed as. */
export const ZIP_MIME = 'application/zip';

/** A .docx by name or declared type - the same shape as looksLikePptxFile. */
export const looksLikeDocxFile = (file: { name?: string; type?: string }): boolean =>
  /\.docx$/i.test(file.name ?? '') || (file.type ?? '') === DOCX_MIME;

// Node shells have no DOMParser global, so the parser is constructed per call
// rather than at module scope (the rule bridge/pptx.ts's createPptxAPI follows).
const parseXml = (xml: string): Document => new DOMParser().parseFromString(xml, 'application/xml');

/** One extracted image: the name the markdown/HTML references, and its bytes. */
export interface OfficeMedia { name: string; bytes: Uint8Array }

/** Extracted content: markdown plus the images it cites. */
export interface OfficeContent { markdown: string; media: OfficeMedia[] }

/** Resolve the reader's media list (part path + emitted name) to real bytes. Both
 *  readers register each part ONCE, so this list is already deduplicated. */
function mediaBytes(
  parts: Record<string, Uint8Array | string>,
  refs: Array<{ path: string; name: string }>,
): OfficeMedia[] {
  const out: OfficeMedia[] = [];
  for (const ref of refs) {
    const part = parts[ref.path];
    if (part instanceof Uint8Array && part.length) out.push({ name: ref.name, bytes: part });
  }
  return out;
}

/** A .pptx → deck-studio-dialect markdown plus its slide images. */
export async function pptxToMarkdown(bytes: Uint8Array): Promise<OfficeContent> {
  const parts = await inflatePptx(bytes);
  if (!isPptx(parts)) throw new Error('That file is not a PowerPoint (.pptx) deck.');
  const { markdown, media } = deckToMarkdown(readPptx(parts, parseXml));
  return { markdown, media: mediaBytes(parts, media) };
}

/** A .docx → document blocks plus its images: the shape both the markdown and the
 *  editor projections start from. `sourceAuthor` is the file's own dc:creator
 *  (docProps/core.xml), so an import can credit the original author. */
async function readDocxFile(bytes: Uint8Array): Promise<{ blocks: DocBlock[]; media: OfficeMedia[]; sourceAuthor?: string }> {
  const parts = await inflatePptx(bytes);
  if (!isDocx(parts)) throw new Error('That file is not a Word (.docx) document.');
  const { blocks, media, coreProps } = readDocx(parts, parseXml);
  return { blocks, media: mediaBytes(parts, media), ...(coreProps?.creator ? { sourceAuthor: coreProps.creator } : {}) };
}

/** A .docx → GFM markdown plus its images. */
export async function docxToMarkdown(bytes: Uint8Array): Promise<OfficeContent> {
  const { blocks, media } = await readDocxFile(bytes);
  return { markdown: mdFromBlocks(blocks), media };
}

/** Either office kind → markdown, routed by filename. */
export function officeToMarkdown(bytes: Uint8Array, filename: string): Promise<OfficeContent> {
  return /\.docx$/i.test(filename) ? docxToMarkdown(bytes) : pptxToMarkdown(bytes);
}

/** The markdown alone, or - when the document carried images - a stored zip of the
 *  markdown at the root plus its `media/` entries. */
export function markdownDownload(content: OfficeContent, mdName: string): Blob {
  if (!content.media.length) return new Blob([content.markdown], { type: 'text/markdown' });
  const zip = storeZip([
    { name: mdName, bytes: new TextEncoder().encode(content.markdown) },
    ...content.media.map((m) => ({ name: m.name, bytes: m.bytes })),
  ]);
  return new Blob([zip as BlobPart], { type: ZIP_MIME });
}

// ── the editor projection (images inlined) ────────────────────────────────────

/** Formats a browser paints from a data: URI. EMF/WMF metafiles and svg are left
 *  out: the first two are unpaintable, and an inlined SVG document is markup the
 *  editor would then hold. */
const MEDIA_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
};
/** A single image bigger than this stays out of the document. */
const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
/** Whole-import budget in data-URL chars - past it, further images are dropped
 *  rather than exhausting the heap on an image-heavy document. */
const TOTAL_MEDIA_CHARS = 64 * 1024 * 1024;

function dataUrl(m: OfficeMedia): string | null {
  const mime = MEDIA_MIME[(/\.([a-z0-9]+)$/i.exec(m.name)?.[1] ?? '').toLowerCase()];
  if (!mime || m.bytes.length > MAX_MEDIA_BYTES) return null;
  let bin = '';
  for (let i = 0; i < m.bytes.length; i += 8192) bin += String.fromCharCode(...m.bytes.subarray(i, i + 8192));
  return `data:${mime};base64,${btoa(bin)}`;
}

/**
 * A .docx → the HTML Doc Studio's editor parses, images inlined as data URLs.
 *
 * The URL map is built ONCE per media part and the total is budgeted: a resolver
 * without both re-encoded a shared logo into one multi-MB string per reference and
 * exhausted the heap (the discipline deck-editor's makeMediaResolver documents).
 * An unresolvable image drops to an empty ref, which htmlFromBlocks omits.
 */
export async function docxToHtml(bytes: Uint8Array): Promise<{ html: string; dropped: number; sourceAuthor?: string }> {
  const { blocks, media, sourceAuthor } = await readDocxFile(bytes);
  const urls = new Map<string, string>();
  let chars = 0;
  let dropped = 0;
  for (const m of media) {
    const url = chars > TOTAL_MEDIA_CHARS ? null : dataUrl(m);
    if (!url) { dropped++; continue; }
    chars += url.length;
    urls.set(m.name, url);
  }
  const inlined = blocks.map((b) => (b.type === 'image' ? { ...b, ref: urls.get(b.ref) ?? '' } : b));
  return { html: htmlFromBlocks(inlined), dropped, ...(sourceAuthor ? { sourceAuthor } : {}) };
}
