// SPDX-License-Identifier: MPL-2.0
/**
 * Unpack - the format router.
 *
 * `#/unpack` (Unpack, alias `#/pdf`) grew from a PDF-only surface into a door onto every design
 * container the app already knows how to parse. This module is the sniff-and-route
 * layer: it reads a file's leading bytes, decides what it is, and hands back a
 * `PdfHandle`-shaped opener for that format. The view (`views/pdf-extract.ts`) then
 * runs whatever passes the handle offers, so it never needs to know one format from
 * another - a new format is a branch here plus an opener, never a special case there.
 *
 * The sniff logic mirrors `views/design-import.ts parseDesignFile` byte-for-byte,
 * but this is a SEPARATE path on purpose: design-import parses a file into Layout
 * Studio boxes and pulls in the heavy Kiwi/zstd decoders at module scope, while
 * Unpack only wants a reader. So the pure magic-byte checks are copied here (they
 * are a handful of stable lines) and every real opener is a LAZY import, so a PDF
 * drop never loads the .pptx code and vice versa.
 *
 * Everything stays on-device: the openers read bytes already in memory and never
 * fetch a linked or external resource of any kind.
 */

import { strFromU8 } from 'fflate';
import { isPptx } from '@lolly/engine';
import { unzipAsync } from '../lib/zip.ts';
import { t } from '../i18n.ts';
import type { PdfHandle } from './pdf-import.ts';

/** An opened container. Type alias so a caller can name the reader without knowing
 *  it is a PDF handle underneath - do NOT move `PdfHandle`, which stays canonical. */
export type UnpackHandle = PdfHandle;

// Byte bounds reused verbatim from design-import.ts - the classic zip bomb hides
// behind a tiny compressed payload, so each entry's declared inflated size and
// their sum are both capped far above any real design export.
const MAX_ZIP_ENTRY_BYTES = 128 * 1024 * 1024;
const MAX_ZIP_TOTAL_BYTES = 512 * 1024 * 1024;

// ── format sniffing (mirror of design-import.ts; keep in step) ─────────────────

/** A PDF (and a PDF-compatible .ai) begins with "%PDF-" within the first bytes - 
 *  the spec permits a little leading junk, so scan a small window. */
function isPdf(buf: Uint8Array): boolean {
  const limit = Math.min(buf.length - 4, 1024);
  for (let i = 0; i <= limit; i++) {
    if (buf[i] === 0x25 && buf[i + 1] === 0x50 && buf[i + 2] === 0x44 && buf[i + 3] === 0x46) return true; // %PDF
  }
  return false;
}

// InDesign .indd documents open with a fixed 16-byte master-page GUID.
const INDD_MAGIC = [0x06, 0x06, 0xed, 0xf5, 0xd8, 0x1d, 0x46, 0xe5, 0xbd, 0x31, 0xef, 0xe7, 0xfe, 0x74, 0xb7, 0x1d];
function isIndd(buf: Uint8Array, name?: unknown): boolean {
  if (buf.length >= 16 && INDD_MAGIC.every((b, i) => buf[i] === b)) return true;
  return typeof name === 'string' && /\.indd$/i.test(name.trim());
}

/** Photoshop PSD/PSB ("8BPS") or GIMP XCF ("gimp xcf ") - layered bitmaps. */
function isLayeredBitmap(buf: Uint8Array): boolean {
  return (buf.length >= 4 && buf[0] === 0x38 && buf[1] === 0x42 && buf[2] === 0x50 && buf[3] === 0x53)
    || (buf.length >= 9 && String.fromCharCode(...buf.subarray(0, 9)) === 'gimp xcf ');
}

/** ZIP magic "PK\x03\x04" - Penpot, Figma .fig, InDesign .idml and .pptx are all zips. */
function isZip(buf: Uint8Array): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
}

/** An IDML package is a ZIP with a root `designmap.xml` (and a `mimetype` naming it). */
function isIdml(files: Record<string, Uint8Array>): boolean {
  if (files['designmap.xml']) return true;
  const mt = files['mimetype'];
  if (mt) { try { return /indesign-idml|idml/i.test(strFromU8(mt)); } catch { /* */ } }
  return false;
}

// ── errors ─────────────────────────────────────────────────────────────────────

/**
 * A per-format opener chunk failed to load - a stale chunk after a deploy or a
 * wiped dev dep cache, NOT a problem with the user's file. Carries the same
 * "reload the page" wording the view's own outer catch uses, so whichever module
 * went stale the person is told to reload rather than blamed for a good file.
 */
function readerFailed(cause: unknown): Error {
  return Object.assign(
    new Error(t('The reader failed to load. Your file is fine; reload the page and try again.')),
    { cause },
  );
}

/** Lazy-import an opener chunk, turning a load failure into `readerFailed`. */
async function importOr<T>(imp: () => Promise<T>): Promise<T> {
  try { return await imp(); }
  catch (err) { throw readerFailed(err); }
}

// ── the router ──────────────────────────────────────────────────────────────────

/**
 * Sniff `file` and return a reader for it, or throw a user-facing Error the view
 * shows verbatim. A thrown message is always translated and safe to display; the
 * low-level cause rides along on `.cause` for logging.
 */
export async function openDesignFile(file: File | Blob): Promise<UnpackHandle> {
  const name = (file as File).name;
  const buf = new Uint8Array(await file.arrayBuffer());

  // PDF / Adobe Illustrator: a modern .ai saved with PDF compatibility IS a PDF.
  if (isPdf(buf)) {
    const { openPdfFile } = await importOr(() => import('./pdf-import.ts'));
    try { return await openPdfFile(file); }
    catch (err) {
      throw Object.assign(
        new Error(t('That file could not be opened as a PDF. If it is password-protected, remove the password first.')),
        { cause: err },
      );
    }
  }

  // Raw InDesign .indd has no open parser - guide the user to IDML instead.
  if (isIndd(buf, name)) {
    throw new Error(t('A raw .indd file cannot be read directly. In InDesign choose File then Export then InDesign Markup (.idml) and open the .idml.'));
  }

  // Layered bitmaps (Photoshop PSD/PSB, GIMP XCF): every layer + the composite.
  if (isLayeredBitmap(buf)) {
    const { openPsdFile } = await importOr(() => import('./psd-import.ts'));
    try { return await openPsdFile(file); }
    catch (err) {
      throw Object.assign(new Error(t('That layered image could not be opened.')), { cause: err });
    }
  }

  // ZIP containers: Penpot, Figma .fig, InDesign .idml, PowerPoint .pptx.
  if (isZip(buf)) {
    const files = await unzipAsync(buf, {
      maxEntryBytes: MAX_ZIP_ENTRY_BYTES,
      maxTotalBytes: MAX_ZIP_TOTAL_BYTES,
      tooLarge: (n) => t('This archive expands too large to take apart ({name}).', { name: n }),
    });
    if (isIdml(files)) {
      const { openIdmlFile } = await importOr(() => import('./idml-import.ts'));
      try { return await openIdmlFile(files); }
      catch (err) {
        throw Object.assign(new Error(t('That InDesign (.idml) file could not be opened. Re-export it from InDesign as IDML and try again.')), { cause: err });
      }
    }
    if (isPptx(files)) {
      const { openPptxFile } = await importOr(() => import('./pptx-import.ts'));
      try { return await openPptxFile(file); }
      catch (err) {
        throw Object.assign(new Error(t('That PowerPoint file could not be opened.')), { cause: err });
      }
    }
    // Figma .fig (reverse-engineered Kiwi binary).
    if (files['canvas.fig']) {
      const { openFigFile } = await importOr(() => import('./design-import.ts'));
      try { return await openFigFile(files); }
      catch (err) {
        throw Object.assign(new Error(t('That Figma .fig could not be opened. Figma may have changed its format; export the frame as SVG and open that.')), { cause: err });
      }
    }
    // Otherwise treat the archive as a Penpot export.
    const { openPenpotFile } = await importOr(() => import('./penpot-import.ts'));
    try { return await openPenpotFile(files); }
    catch (err) {
      throw Object.assign(new Error(t('That Penpot file could not be opened. In Penpot use Export as .penpot and open that.')), { cause: err });
    }
  }

  // Otherwise treat the bytes as SVG text. The opener re-reads the file, so a file
  // that decodes but is not SVG throws its own "not readable as SVG" message.
  const { openSvgFile } = await importOr(() => import('./svg-unpack.ts'));
  try { return await openSvgFile(file); }
  catch (err) {
    throw Object.assign(
      new Error(t('This file is not something Unpack can take apart. Open a PDF or SVG, and more formats are on the way.')),
      { cause: err },
    );
  }
}
