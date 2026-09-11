// SPDX-License-Identifier: MPL-2.0
/**
 * The **PDF source** (plan 97 section 8 gap 2, M5) - a guidelines PDF as design-system
 * material: the palette its artwork paints with, the marks themselves, and the
 * font programs it embeds.
 *
 * section 8 states the structure of this milestone exactly: "`PdfHandle` is already
 * view-agnostic - the work is adapters + affordances, not extraction". So there
 * is no PDF parsing here at all. `views/pdf-import.ts` opens the document and
 * `listVectors`/`listFonts` do the reading; this module is the two things that
 * were missing between that handle and the tray - a census adapter, and the
 * per-candidate shaping (deduped faces with honest chips, a capped set of named
 * marks).
 *
 * Split in two on purpose:
 *
 *  - **The pure half** ({@link pdfScanToCensus}, {@link pdfFontCandidates},
 *    {@link pdfLogoPicks}) takes the handle's RESULT SHAPES as plain data and
 *    imports no PDF machinery whatsoever. It runs under bare node, which is what
 *    makes the fills aggregation, the face dedupe and the honesty chips testable
 *    without a fixture document and a pdf-lib load.
 *  - **The browser half** ({@link scanPdfForDesignSystem}) is the only part that
 *    touches a file. It lazily imports `openPdfFile`, feature-detects the two
 *    optional handle methods, and returns a machine `reason` on every failure - 
 *    a dropped PDF must never throw into the source picker.
 *
 * Copy is the caller's, as in `sources/file.ts`: refusals and progress come back
 * as machine tokens the caller renders through its own `t()`. The one exception
 * is a mark's default `name`, which has nowhere else to be formed (see
 * {@link pdfLogoPicks}).
 *
 * **Nothing leaves the device.** The whole read is local - no network call is
 * made or possible from this module.
 */

import type { HostV1 } from '@lolly-tools/core/host-v1';

import { censusFromPdfVectors } from '../census.ts';
import type { CensusFont, DesignCensus } from '../census.ts';
import { describeFaceSource, parseFaceName } from '../font-resolve.ts';

// ── The shapes this module speaks ────────────────────────────────────────────
// Structural, not imported: `ExtractedVector` and `EmbeddedFont` live in a VIEW
// module, and a `lib/` file that names them in its signatures drags the whole
// pdf-lib import graph into every bundle that touches the tray. Both real types
// are assignable to these, and the browser half checks that by passing them
// straight through.

/** One mark as `listVectors` reports it. `fills` is the only field the census
 *  reads; the rest are what a logo pick needs. */
export interface PdfScanVector {
  /** Distinct fill colours, most-used first - the extractor's own ordering. */
  fills: string[];
  /** Self-contained SVG of the mark, cropped to itself. */
  svg?: string;
  /** 0-based page it was found on. */
  page?: number;
  /** How many shapes make up the mark. */
  shapes?: number;
}

/** One embedded font program as `listFonts` reports it. */
export interface PdfScanFont {
  /** `/FontName`, subset prefix and all - "ABCDEF+Inter-Regular". */
  name: string;
  /** The family with the subset prefix removed, when the reader supplied one. */
  family?: string;
  /** The document embedded only the glyphs it printed. */
  subset?: boolean;
  /** Whether the bytes are a font a system can actually install. */
  installable?: boolean;
  bytes?: Uint8Array;
  /** The font's own `OS/2.fsType` statement, when it has one. */
  embedding?: { permission?: string };
}

/** Everything the pure half needs to build a census - the two lists plus the
 *  document's own title, where a reader can supply one. */
export interface PdfScan {
  vectors: readonly PdfScanVector[];
  fonts: readonly PdfScanFont[];
  title?: string;
}

/** A face worth offering to install: the bytes, the name they came under, and
 *  the chips that say what is and is not known about them. */
export interface PdfFontCandidate {
  /** Family as `parseFaceName` reads it - the label and the compare-stage key. */
  family: string;
  /** The document's own spelling, kept verbatim so a report can quote it. */
  raw: string;
  bytes: Uint8Array;
  /** `describeFaceSource` chips, in display order. */
  chips: string[];
}

/** One mark offered as a logo candidate. */
export interface PdfLogoPick {
  svg: string;
  /** Default English label - see the note on {@link pdfLogoPicks}. */
  name: string;
  /** 0-based, exactly as the extractor reported it. The `name` shows the human
   *  1-based page number; this field stays in the source's own numbering so a
   *  caller can index back into the scan. */
  page: number;
  /**
   * Where this pick sat in the list handed to {@link pdfLogoPicks}, 0-based.
   *
   * Picks are filtered and re-ranked, so their order is not the document's. A
   * caller that has to name a mark after the row it came from (the `#/pdf`
   * tiles do - the filename is what makes an arriving mark traceable) needs the
   * ORIGINAL position, and recovering it by matching the SVG text back into the
   * scan silently collapses a mark repeated verbatim on two pages onto one name.
   */
  index: number;
}

// ── Caps ─────────────────────────────────────────────────────────────────────

/** A design-system PDF is a document, not a video. Same cap the zip branch of
 *  `sources/file.ts` applies, and checked from `Blob.size` before a byte is read. */
export const PDF_MAX_BYTES = 64 * 1024 * 1024;

/** Pages scanned for artwork by default. Follows the `REDACTION_PAGE_CAP`
 *  precedent in `views/valid.ts`: a brand book runs to hundreds of pages, the
 *  marks and the palette are near the front, and a scan that blocks the picker
 *  for a minute is worse than one that says how far it got. */
export const PDF_PAGE_CAP = 30;

/** How many marks reach the tray. A page of icons is not thirty logo decisions,
 *  and the tray is a shopping list rather than a dump of the document. Hard,
 *  including against a caller asking for more. */
export const MAX_LOGO_PICKS = 8;

/** A title longer than this is a sentence from the front page, not a name. */
const MAX_TITLE_CHARS = 120;

// ── Pure half ────────────────────────────────────────────────────────────────

/** The family a face name states, falling back to the name itself when the
 *  parser has nothing left (a name that is only style words). */
function faceFamily(font: PdfScanFont): string {
  const raw = String(font?.family ?? font?.name ?? '').trim();
  if (!raw) return '';
  return parseFaceName(raw).family || raw;
}

/**
 * A document title fit to propose as a design system's name, or undefined.
 *
 * Whitespace is collapsed and the length is capped; nothing else is cleaned up.
 * A PDF `/Title` is routinely the authoring app's leftovers ("Microsoft Word -
 * brand.docx"), and rewriting that into something prettier would be inventing a
 * name the document never gave. It is offered as a candidate, which the person
 * can decline.
 */
function cleanTitle(title: unknown): string | undefined {
  if (typeof title !== 'string') return undefined;
  const trimmed = title.replace(/\s+/g, ' ').trim();
  if (!trimmed || trimmed.length > MAX_TITLE_CHARS) return undefined;
  return trimmed;
}

/**
 * A PDF scan as a `DesignCensus`.
 *
 * Colours go through `censusFromPdfVectors` unchanged - the per-mark
 * most-used-first ordering, the ink/ground split and the implied paper ground
 * are all its judgement, and duplicating any of it here would give two adapters
 * two answers about the same document.
 *
 * Fonts are one entry per distinct family, `count: 1`, `usage: 'unknown'`. Every
 * part of that is a refusal to overclaim:
 *
 *  - **One per family, not per program.** A document embeds Regular, Bold and
 *    Italic as three programs; that is one family in a design system, and the
 *    weight it was set at is a fact about the pages, not about the font table.
 *  - **`count: 1` is presence, not usage.** The census weights everywhere else
 *    are occurrence counts. A font table has none - a face embedded for one
 *    footnote sits beside the display face with identical evidence - so every
 *    family weighs the same and the ranking stays honestly flat.
 *  - **`usage` stays `'unknown'`.** The sibling adapters read a role off a
 *    design tool's own text runs. Nothing here saw a text run; which face is the
 *    heading face is a question about the pages, and the Type room asks it.
 *
 * `name` comes only from a title the document actually carries. The file name is
 * NOT a fallback: it is provenance (the census `label`), and promoting it to a
 * name would propose "brand-guidelines-v4-FINAL" as somebody's design system.
 */
export function pdfScanToCensus(scan: PdfScan, label: string): DesignCensus {
  // Copied, not passed through: `censusFromPdfVectors` takes a mutable array,
  // and widening a shared signature from here to save one shallow copy of a
  // handful of marks would be the tail wagging the dog.
  const base = censusFromPdfVectors([...(scan?.vectors ?? [])], label);

  const fonts: CensusFont[] = [];
  const seen = new Set<string>();
  for (const font of scan?.fonts ?? []) {
    const family = faceFamily(font);
    if (!family) continue;
    const key = family.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    fonts.push({ family, usage: 'unknown', count: 1 });
  }

  const name = cleanTitle(scan?.title);
  return { ...base, fonts, ...(name ? { name } : {}) };
}

/**
 * The faces worth offering to install, deduped and ordered.
 *
 * One row per (family, weight, slant): those three are what makes a face a
 * different PROGRAM, and a design system that wants Inter wants its Bold as well
 * as its Regular. Folding by family alone would silently drop weights someone
 * paid for; not folding at all would offer the same file twice, since a document
 * can embed one program under two subset prefixes.
 *
 * A duplicate replaces the row already kept when it is strictly better to
 * install: installable beats not-installable, and (all else equal) a full
 * program beats a subset. Nothing else reorders - first seen wins ties, so the
 * document's own order survives.
 *
 * Bytes are required. A face with none cannot be installed, and a row that
 * cannot act on the one action it offers is worse than no row.
 *
 * Chips come from `describeFaceSource`, which is where the honesty rules live:
 * `SUBSET` only when the source said so, exactly one embedding chip, and
 * `unknown` whenever the source stated nothing we recognise. `installable` ranks
 * the list but is deliberately NOT a chip - it is our reading of the bytes, and
 * the chips report what the SOURCE stated.
 */
export function pdfFontCandidates(fonts: readonly PdfScanFont[]): PdfFontCandidate[] {
  interface Kept { row: PdfFontCandidate; installable: boolean; subset: boolean }
  const byFace = new Map<string, Kept>();

  for (const font of fonts ?? []) {
    const bytes = font?.bytes;
    if (!bytes?.length) continue;
    const raw = String(font.family ?? font.name ?? '').trim();
    const parsed = parseFaceName(raw);
    const family = parsed.family || raw;
    if (!family) continue;

    const key = `${family.toLowerCase()}|${parsed.weight}|${parsed.italic ? 'i' : ''}`;
    const installable = font.installable === true;
    const subset = font.subset === true;
    const next: Kept = {
      row: {
        family,
        raw: String(font.name ?? font.family ?? ''),
        bytes,
        chips: describeFaceSource({ subset: font.subset, embedding: font.embedding?.permission }).chips,
      },
      installable,
      subset,
    };

    const kept = byFace.get(key);
    if (!kept) { byFace.set(key, next); continue; }
    const better = (installable && !kept.installable)
      || (installable === kept.installable && kept.subset && !subset);
    if (better) byFace.set(key, next);
  }

  const rows = [...byFace.values()];
  // Two stable passes rather than a comparator: the only ordering claim being
  // made is "installable first", and everything else keeps document order.
  return [...rows.filter(r => r.installable), ...rows.filter(r => !r.installable)].map(r => r.row);
}

/**
 * The marks worth offering as logos, capped.
 *
 * Ranked by shape count, descending. A real mark is a group of paths; a stray
 * rule, a bullet or a page-furniture box is one shape, and the extractor already
 * refuses the obvious non-artwork, so shape count is the cheapest honest
 * tiebreak between "a logo" and "a decoration". Sorting is stable, so marks with
 * equal shape counts keep document order (page, then position on the page).
 *
 * `name` is the one piece of user-facing text this module forms, because there
 * is nowhere else to form it: the mark has no name of its own, and a candidate
 * with a blank label is unusable. It is a default the caller may replace with
 * its own localised label - the numbering is the required part, and the page
 * number in it is 1-based (`page` itself is not; see {@link PdfLogoPick}).
 */
export function pdfLogoPicks(
  vectors: readonly PdfScanVector[],
  opts: { max?: number } = {},
): PdfLogoPick[] {
  const asked = Number(opts?.max);
  const max = Number.isFinite(asked)
    ? Math.max(0, Math.min(Math.trunc(asked), MAX_LOGO_PICKS))
    : MAX_LOGO_PICKS;
  if (max === 0) return [];

  // The original position rides along from here on: the filter and the sort both
  // move rows, and it is the only thing that survives them intact.
  const usable = (vectors ?? [])
    .map((v, index) => ({ v, index }))
    .filter(({ v }) => typeof v?.svg === 'string' && v.svg.trim() !== '');
  const ranked = [...usable].sort((a, b) => (Number(b.v.shapes) || 0) - (Number(a.v.shapes) || 0));

  return ranked.slice(0, max).map(({ v, index }, i) => {
    const page = Number.isFinite(v.page) ? Math.max(0, Math.trunc(Number(v.page))) : 0;
    return { svg: String(v.svg), name: `Mark ${i + 1} (page ${page + 1})`, page, index };
  });
}

// ── Browser half ─────────────────────────────────────────────────────────────

/** Why a file could not be scanned. The caller maps each to its own copy. */
export type PdfScanRefusal =
  /** Bigger than {@link PDF_MAX_BYTES} (`limit` repeats the cap). */
  | 'too-large'
  /** pdf-lib would not open it: corrupt, encrypted, or not a PDF at all. */
  | 'unreadable-pdf';

/** A part of the scan that did not happen, as a machine token: the handle did
 *  not offer the method (`-unavailable`) or the call failed (`-failed`). The
 *  detail goes to `host.log`, never into the returned value. */
export type PdfScanWarning =
  | 'vectors-unavailable' | 'vectors-failed'
  | 'fonts-unavailable' | 'fonts-failed';

/** What one PDF had to say. `kind` discriminates exactly as `DesignFileRoute`
 *  does in `sources/file.ts`, so the two sources refuse the same way. */
export type PdfScanResult =
  | {
      kind: 'scanned';
      census: DesignCensus;
      fontCandidates: PdfFontCandidate[];
      logoPicks: PdfLogoPick[];
      /** Pages the document has. */
      pageCount: number;
      /**
       * The page window the artwork scan was given, so a caller can say where
       * the marks and colours could have come from rather than implying the
       * whole file was read.
       *
       * It is a BOUND, not a count of pages walked. `listVectors` also stops at
       * its own cap on marks (`MAX_VECTORS` in views/pdf-import.ts), so a
       * document with icon grids at the front can hit that within a page or
       * three and never reach the end of this window - which is why the copy
       * built from it must claim the window ("taken from the first n pages")
       * and never the reading ("read the first n pages").
       *
       * It bounds the ARTWORK half only: fonts are a document-wide table with
       * no page window to speak of, and are always read whole.
       */
      pageWindow: number;
      /** Empty when both halves ran. */
      warnings: PdfScanWarning[];
    }
  | { kind: 'refused'; reason: PdfScanRefusal; limit?: number; detail?: string };

/** The PDF view module, named as a TYPE only - erased at build time, so the
 *  dynamic import below stays the sole real edge into `views/`. */
type PdfImportModule = typeof import('../../../views/pdf-import.ts');
type OpenedPdf = Awaited<ReturnType<PdfImportModule['openPdfFile']>>;

const EXT = /\.[^./\\]+$/;

const errText = (err: unknown): string => String((err as { message?: unknown })?.message ?? err);

/**
 * The document's own title, when the handle offers one.
 *
 * Today's `PdfHandle` offers neither `getTitle()` nor `title`, so this returns
 * undefined for every real document and the census carries no name - which is
 * the truthful answer, and better than the file name dressed up as one. The
 * feature detect is here so the day the handle grows document metadata the
 * census picks it up without a second adapter, and it is guarded because the
 * getter would be reading an untrusted document.
 */
function readTitle(handle: unknown): string | undefined {
  try {
    const h = handle as { getTitle?: () => unknown; title?: unknown };
    const value = typeof h?.getTitle === 'function' ? h.getTitle() : h?.title;
    return typeof value === 'string' ? value : undefined;
  } catch { return undefined; }
}

/**
 * Scan one PDF into design-system material: census, font candidates, logo picks.
 *
 * `openPdfFile` is imported LAZILY, and that is a size decision rather than a
 * style one - `views/pdf-import.ts` pulls in pdf-lib and the whole PDF
 * interpreter, and the source picker must not pay for that until somebody
 * actually drops a PDF. `lib/pdf-vector-shot.ts` already imports the same
 * function from the same view (as `lib/upload-dropzone.ts` does with
 * `views/picker.ts`'s `storeUserUpload`), so the direction is established; the
 * dynamic form additionally means no module-init edge exists from `lib/` back
 * into `views/`, whichever way a future import runs.
 *
 * Every failure is a return value. A source picker that throws on a malformed
 * file is a source picker that loses the drop.
 *
 * @param host  used only for diagnostic logging; may be null
 * @param file  the dropped/picked PDF (or .ai, which is a PDF)
 */
export async function scanPdfForDesignSystem(
  host: HostV1 | null | undefined,
  file: File | Blob,
  opts: { maxPages?: number; onProgress?: (msg: string) => void } = {},
): Promise<PdfScanResult> {
  // A caller's progress reporter must not be able to abort the scan.
  const progress = (phase: string): void => {
    try { opts.onProgress?.(phase); } catch { /* a reporter's problem, not the scan's */ }
  };
  const log = (level: 'warn' | 'debug', msg: string, ctx?: object): void => {
    try { host?.log?.(level, msg, ctx); } catch { /* logging must never be fatal */ }
  };

  const size = Number((file as Blob)?.size ?? 0);
  if (size > PDF_MAX_BYTES) return { kind: 'refused', reason: 'too-large', limit: PDF_MAX_BYTES };

  const name = String((file as File)?.name ?? '');
  const label = name.replace(EXT, '') || name || 'PDF';

  progress('open');
  let handle: OpenedPdf;
  try {
    const { openPdfFile } = await import('../../../views/pdf-import.ts');
    handle = await openPdfFile(file);
  } catch (err) {
    log('warn', 'pdf source: document would not open', { detail: errText(err) });
    return { kind: 'refused', reason: 'unreadable-pdf', detail: errText(err) };
  }

  const pageCount = Math.max(0, Math.trunc(Number(handle.pageCount) || 0));
  const asked = Number(opts.maxPages);
  const cap = Number.isFinite(asked) ? Math.max(0, Math.trunc(asked)) : PDF_PAGE_CAP;
  const pageWindow = Math.min(pageCount, cap);

  const warnings: PdfScanWarning[] = [];

  progress('vectors');
  let vectors: PdfScanVector[] = [];
  if (typeof handle.listVectors === 'function') {
    try {
      vectors = await handle.listVectors({ maxPages: pageWindow });
    } catch (err) {
      warnings.push('vectors-failed');
      log('warn', 'pdf source: vector scan failed', { detail: errText(err) });
    }
  } else {
    warnings.push('vectors-unavailable');
  }

  progress('fonts');
  let fonts: PdfScanFont[] = [];
  if (typeof handle.listFonts === 'function') {
    try {
      fonts = handle.listFonts();
    } catch (err) {
      warnings.push('fonts-failed');
      log('warn', 'pdf source: font scan failed', { detail: errText(err) });
    }
  } else {
    warnings.push('fonts-unavailable');
  }

  progress('done');
  return {
    kind: 'scanned',
    census: pdfScanToCensus({ vectors, fonts, title: readTitle(handle) }, label),
    fontCandidates: pdfFontCandidates(fonts),
    logoPicks: pdfLogoPicks(vectors),
    pageCount,
    pageWindow,
    warnings,
  };
}
