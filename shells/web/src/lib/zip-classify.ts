// SPDX-License-Identifier: MPL-2.0
/**
 * Disambiguate a PK-zip upload before anything explodes it.
 *
 * engine `sniffContainer` returns a GENERIC 'zip' for every PK package - an OOXML
 * document (.pptx/.xlsx/.docx), an OCF package (.epub/.odt), a dotLottie (.lottie),
 * a Penpot/Figma design bundle, AND a plain archive all share the same local-header
 * magic. So a "drop a .zip → explode it into member assets" path MUST first ask
 * "what kind of zip is this?" - or it would shred a PowerPoint into raw XML parts.
 *
 * The ladder, most-specific first:
 *   1. a sync name/MIME rung (`classifyZipName`) - the common case, no bytes read;
 *      it reproduces `isPptxUpload`'s contract and extends it to the sibling formats.
 *   2. a byte-peek (`classifyZipBytes`) for a blank-MIME / wrong-extension file:
 *      an OCF `mimetype` first entry, then `[Content_Types].xml` OOXML part names,
 *      then a dotLottie's `manifest.json` + `animations/`, else a plain 'archive'.
 *
 * Only 'archive' means "safe to explode". Every other verdict routes to a dedicated
 * reader (or, for a format Lolly can't yet read, a clear unsupported message). An
 * unrecognised / non-zip / unreadable input returns null.
 */

import { readZip, sniffContainer, type ZipEntry } from '@lolly/engine';

/** What a PK-zip upload actually is. Only 'archive' is safe to explode to members. */
export type ZipKind = 'pptx' | 'xlsx' | 'docx' | 'epub' | 'odt' | 'lottie' | 'archive';

/** OCF `mimetype` values we recognise (the first, stored entry of an OCF package). */
const OCF_MIMETYPE: Record<string, ZipKind> = {
  'application/epub+zip': 'epub',
  'application/vnd.oasis.opendocument.text': 'odt',
};

/** OOXML/OCF MIME types, for the sync name/MIME rung. */
const CONTAINER_MIME: Record<string, Exclude<ZipKind, 'archive'>> = {
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/epub+zip': 'epub',
  'application/vnd.oasis.opendocument.text': 'odt',
};

/**
 * Name/MIME classification - sync, no bytes. Mirrors `isPptxUpload` and extends it
 * to the sibling office/OCF/lottie formats. Returns null when neither the extension
 * nor the MIME identifies a known container (so the caller falls through to the
 * byte-peek, which can still catch a blank-MIME file). Never returns 'archive':
 * a plain archive is not identifiable by name alone.
 */
export function classifyZipName(file: { name: string; type: string }): Exclude<ZipKind, 'archive'> | null {
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase();
  if (ext === 'pptx') return 'pptx';
  if (ext === 'xlsx') return 'xlsx';
  if (ext === 'docx') return 'docx';
  if (ext === 'epub') return 'epub';
  if (ext === 'odt') return 'odt';
  if (ext === 'lottie') return 'lottie';
  const mime = file.type?.toLowerCase();
  return (mime && CONTAINER_MIME[mime]) || null;
}

const dec = new TextDecoder();

/**
 * Byte-level classification - the authoritative disambiguation. Returns null when
 * the bytes are not a readable zip at all; otherwise the specific kind, or 'archive'
 * for a plain multi-file zip that carries none of the OOXML/OCF/lottie markers.
 */
export function classifyZipBytes(bytes: Uint8Array): ZipKind | null {
  if (sniffContainer(bytes) !== 'zip') return null;
  let entries: ZipEntry[];
  try {
    entries = readZip(bytes);
  } catch {
    return null; // a malformed / unsupported (ZIP64, encrypted) zip - not safe to explode
  }
  return classifyZipEntries(entries);
}

/**
 * Classify entries that a caller has already extracted under its own budgets.
 * This avoids inflating a dropped archive twice merely to distinguish it from an
 * OOXML/OCF container before import.
 */
export function classifyZipEntries(entries: readonly ZipEntry[]): ZipKind | null {
  const byName = new Map(entries.map((e) => [e.name, e.bytes]));

  // OCF: the first entry is an uncompressed `mimetype`. Trust its value.
  const mimetype = byName.get('mimetype');
  if (mimetype) {
    const kind = OCF_MIMETYPE[dec.decode(mimetype).trim()];
    if (kind) return kind;
  }

  // OOXML: identified by [Content_Types].xml, then the defining part per family.
  if (byName.has('[Content_Types].xml')) {
    if (byName.has('ppt/presentation.xml')) return 'pptx';
    if (byName.has('xl/workbook.xml')) return 'xlsx';
    if (byName.has('word/document.xml')) return 'docx';
    return null; // an unknown OOXML family - do NOT explode it as a plain archive
  }

  // dotLottie: a manifest.json beside an animations/ directory.
  if (byName.has('manifest.json') && entries.some((e) => e.name.startsWith('animations/'))) {
    return 'lottie';
  }

  return 'archive';
}

/**
 * Full classification: the sync name/MIME rung first, then the byte-peek. `bytes`
 * is optional - pass it when the caller already has the file's bytes to avoid a
 * re-read; otherwise the file is read only when the name rung is inconclusive.
 */
export async function classifyZipContainer(file: File, bytes?: Uint8Array): Promise<ZipKind | null> {
  const named = classifyZipName(file);
  if (named) return named;
  const raw = bytes ?? new Uint8Array(await file.arrayBuffer());
  return classifyZipBytes(raw);
}
