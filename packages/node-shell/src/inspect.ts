// SPDX-License-Identifier: MPL-2.0
/**
 * "What is actually in this file, and is it safe to share?" — one implementation, for
 * the CLI (`lolly validate --metadata`), the TUI and MCP.
 *
 * Everything here is a thin, honest wrapper over engine primitives that are already
 * DOM-free and already tested:
 *
 *   extractFileMetadata      what the container says about itself (EXIF/XMP/IPTC, GPS,
 *                            an AI source-type declaration, bytes appended past the
 *                            container's end)
 *   hasResidualMetadata      whether a strip pass would actually find something to
 *                            remove, i.e. is the "clean this" advice real
 *   scanPdfPages             pdf-lib → interpretPdfPage, per page (this package)
 *   extractPageText/joinPageText   the text a recipient can copy back out
 *   findHiddenTextInPages    text present in the file but NOT visible on the page
 *   verifyC2pa + resolveVerdict     Content Credentials, when the caller asks for them
 *
 * ### The honesty rules this module is built around
 *
 * 1. **Absence of a finding is never proof of absence.** Every report carries that
 *    sentence, and `limits` enumerates what was not examined (page caps, format limits,
 *    the passes that need a browser). A clean report means "these checks found nothing",
 *    which is a much smaller claim than "this file is clean".
 * 2. **No invisible-watermark claim of any kind.** This module does not detect SynthID,
 *    and it says so. It reads DECLARED AI provenance (the IPTC DigitalSourceType tag a
 *    generator writes in plain metadata) and nothing more; that tag is trivially removed,
 *    so its presence is a genuine declaration and its absence proves nothing. The neural
 *    pixel-watermark decoders (TrustMark / Content Seal / Lolly's own durable mark) live
 *    behind `lolly validate --deep`, need a browser, and are not run here.
 * 3. **Hidden text is described, never accused.** The measurement is "present in the
 *    file, not visible on the page". It could be a failed redaction or a layering
 *    mistake, and this module has no way to tell which, so it does not imply either.
 * 4. **A hostile or broken file degrades to fewer findings, never to a crash.** Every
 *    pass is individually guarded; what failed lands in `errors` and the rest still runs.
 */

import { readFile } from 'node:fs/promises';
import {
  extractFileMetadata, hasResidualMetadata, isStrippableFormat,
  extractPageText, joinPageText, findHiddenTextInPages, describeHiddenText,
  verifyC2pa, resolveVerdict, defaultTrustAnchors,
} from '@lolly/engine';
import type { FileMetadata, MetaField, HiddenTextFinding, C2paVerdict, PageText } from '@lolly/engine';
import { scanPdfPages } from './pdf-pages.ts';
import type { PdfInfo } from './pdf-pages.ts';
import { sniffFormat } from './format-sniff.ts';

// ── result shape (JSON-serialisable; this is what --json emits under `files[]`) ──

export interface CredentialSection {
  /** The engine's resolved verdict state: lolly/delivered/trusted/valid/expired/likelyLolly/invalid/none. */
  state: C2paVerdict['state'];
  tone: C2paVerdict['tone'];
  /** The chain verified to a pinned trust anchor. */
  trusted: boolean;
  /** CA-verified identity, when there is one. */
  identity: C2paVerdict['identity'];
  /** The raw verifier report, unchanged — codes mirror c2patool. */
  report: unknown;
}

export interface MetadataSection {
  /** Container as the metadata reader identifies it ("JPEG", "PNG", …), '' if unknown. */
  format: string;
  fields: MetaField[];
  /** Fields flagged personally identifying by the engine. */
  sensitiveCount: number;
  gps?: { lat: number; lon: number };
  mapUrl?: string;
  /** DECLARED AI provenance only (IPTC DigitalSourceType). Never a watermark scan. */
  ai?: FileMetadata['ai'];
  /** Bytes riding after the container's end. `declared` marks the legitimate cases. */
  appended?: FileMetadata['appended'];
  /**
   * What a strip pass would still find to remove, as a short human phrase, or null when
   * this module can verify there is nothing of the kind left. `null` for formats the
   * stripper does not handle — read `strippable` first.
   */
  residual: string | null;
  /** Whether a clean copy can be produced at all for this container. */
  strippable: boolean;
}

export interface PdfPageSummary {
  page: number;
  width: number;
  height: number;
  fonts: string[];
  images: number;
  forms: number;
  annotations: number;
  /** Characters of extractable text on the page. */
  textChars: number;
  /** The page paints no text and is mostly one image: a scan, needing OCR. */
  scanned: boolean;
}

export interface PdfSection {
  pageCount: number;
  pagesScanned: number;
  encrypted: boolean;
  info: PdfInfo;
  pages: PdfPageSummary[];
  /** Extracted text, markdown, present only when `text: true` was requested. */
  text?: string;
}

export interface HiddenTextSection {
  /** One line summarising the scan, from the engine (`describeHiddenText`). */
  summary: string;
  /** Pages the scan actually covered. */
  pagesScanned: number;
  findings: HiddenTextFinding[];
}

export interface Inspection {
  /** The path or label the caller gave. '-' for stdin. */
  path: string;
  bytes: number;
  /** Container sniffed from the bytes ('pdf', 'png', …), or null when unrecognised. */
  format: string | null;
  credential: CredentialSection | null;
  metadata: MetadataSection | null;
  pdf: PdfSection | null;
  hiddenText: HiddenTextSection | null;
  /** Named passes that ran, so a report can say what "nothing found" is about. */
  checked: string[];
  /** What was NOT examined. Always non-empty: the last line is the absence caveat. */
  limits: string[];
  /** Passes that failed. A non-empty list means the report is INCOMPLETE. */
  errors: string[];
}

export interface InspectOptions {
  /** Label used in the report. Defaults to the path passed to `inspectPath`. */
  path?: string;
  /** PDF pages to interpret. Default 25. */
  maxPages?: number;
  /** Include the extracted document text in the result. Off: it can be the whole file. */
  text?: boolean;
  /**
   * Reporting floor for the hidden-text pass, 0–1. Unset means the engine's own default
   * (0.7 today), which is what every caller should use unless it has a reason.
   *
   * Worth knowing when tuning it: the engine measures coverage against a text node's
   * BOX, and `interpretPdfPage` gives a single line of 12pt text a 24pt-tall box
   * (fontSize x lineHeight). A redaction bar drawn tightly around the glyphs therefore
   * covers ~0.6 of that box and falls under the default floor. See the "a bar that
   * covers only the glyphs" test in tests/inspect-file.test.ts, which pins the
   * under-report rather than hiding it.
   */
  minCoverage?: number;
  /**
   * Verify Content Credentials too. Off by default because `lolly validate` already
   * holds a verified report and passes it in via `credentialReport`; MCP and the TUI,
   * which want one call, turn it on.
   */
  credential?: { trustAnchors?: string[]; includeLollyRoot?: boolean } | false;
  /** An already-computed verifier report, to avoid verifying the bytes twice. */
  credentialReport?: Parameters<typeof resolveVerdict>[0];
}

/** The sentence every report ends on. It is not decoration; it is the accuracy of the claim. */
export const ABSENCE_CAVEAT =
  'Nothing found is not the same as nothing there: these checks cover the cases listed above and no others.';

const DEFAULT_MAX_PAGES = 25;

/** Read a path (or '-' for stdin) and inspect it. Throws only if the bytes cannot be read. */
export async function inspectPath(path: string, opts: InspectOptions = {}): Promise<Inspection> {
  const bytes = path === '-' ? await readAllStdin() : new Uint8Array(await readFile(path));
  return inspectBytes(bytes, { ...opts, path: opts.path ?? path });
}

/**
 * Inspect bytes. Never throws: every pass is guarded, and a pass that fails becomes an
 * entry in `errors` rather than ending the report.
 */
export async function inspectBytes(bytes: Uint8Array, options: InspectOptions = {}): Promise<Inspection> {
  const opts = options;
  const maxPages = Math.max(1, opts.maxPages ?? DEFAULT_MAX_PAGES);
  const out: Inspection = {
    path: opts.path ?? '(bytes)',
    bytes: bytes.length,
    format: sniffSafe(bytes),
    credential: null,
    metadata: null,
    pdf: null,
    hiddenText: null,
    checked: [],
    limits: [],
    errors: [],
  };

  // ── Content Credentials ─────────────────────────────────────────────────────
  let report = opts.credentialReport ?? null;
  if (!report && opts.credential) {
    try {
      const anchors = defaultTrustAnchors({
        includeLollyRoot: opts.credential.includeLollyRoot ?? false,
        extra: opts.credential.trustAnchors ?? [],
      });
      report = await verifyC2pa(bytes, { trustAnchors: anchors });
    } catch (err) {
      out.errors.push(`Content Credentials could not be checked (${msg(err)})`);
    }
  }
  if (report) {
    try {
      const v = resolveVerdict(report);
      out.credential = {
        state: v.state, tone: v.tone, trusted: v.trusted, identity: v.identity, report,
      };
      out.checked.push('Content Credentials (C2PA manifest, signature, hard binding)');
    } catch (err) {
      out.errors.push(`the credential verdict could not be resolved (${msg(err)})`);
    }
  }

  // ── container metadata ──────────────────────────────────────────────────────
  // Deliberately attempted for every format: the reader is a byte scanner that returns
  // an empty field list for anything it does not know, which is a truthful answer.
  try {
    const meta = extractFileMetadata(bytes);
    const strippable = isStrippableFormat(meta.format);
    const section: MetadataSection = {
      format: meta.format,
      fields: meta.fields,
      sensitiveCount: meta.fields.filter((f) => f.sensitive).length,
      residual: residualFor(bytes, meta.format),
      strippable,
    };
    if (meta.gps) section.gps = meta.gps;
    if (meta.mapUrl) section.mapUrl = meta.mapUrl;
    if (meta.ai) section.ai = meta.ai;
    if (meta.appended) section.appended = meta.appended;
    out.metadata = section;
    out.checked.push('embedded metadata (EXIF, XMP, IPTC, GPS, appended bytes)');
  } catch (err) {
    out.errors.push(`metadata could not be read (${msg(err)})`);
  }

  // ── PDF structure, text, and hidden text ────────────────────────────────────
  if (out.format === 'pdf') {
    try {
      const scan = await scanPdfPages(bytes, { maxPages });
      const pageTexts: PageText[] = [];
      const pages: PdfPageSummary[] = scan.pages.map((p) => {
        let pt: PageText | null = null;
        try { pt = extractPageText(p.nodes, { width: p.width, height: p.height }); }
        catch (err) { out.errors.push(`page ${p.index + 1}: text could not be read (${msg(err)})`); }
        if (pt) pageTexts.push(pt);
        return {
          page: p.index + 1,
          width: Math.round(p.width),
          height: Math.round(p.height),
          fonts: p.fonts,
          images: p.images,
          forms: p.forms,
          annotations: p.annotations,
          textChars: pt ? pt.text.length : 0,
          scanned: pt ? pt.scanned : false,
        };
      });
      const section: PdfSection = {
        pageCount: scan.pageCount,
        pagesScanned: scan.pages.length,
        encrypted: scan.encrypted,
        info: scan.info,
        pages,
      };
      if (opts.text) {
        try { section.text = joinPageText(pageTexts, { markdown: true }); }
        catch (err) { out.errors.push(`document text could not be assembled (${msg(err)})`); }
      }
      out.pdf = section;
      out.errors.push(...scan.errors);
      if (scan.pages.length) {
        out.checked.push(`PDF structure and text (${scan.pages.length} of ${scan.pageCount} page${scan.pageCount === 1 ? '' : 's'})`);
      }
      if (scan.encrypted) {
        out.limits.push('This PDF declares encryption. It was read with encryption ignored, so some streams may be unreadable and findings may be incomplete.');
      }
      if (scan.pageCount > scan.pages.length) {
        out.limits.push(`Only ${scan.pages.length} of ${scan.pageCount} pages were examined (page cap ${maxPages}). Nothing is claimed about the rest.`);
      }

      // The killer pass: text under an opaque shape painted after it.
      // Skipped entirely when no page could be read — `hiddenText: null` means "this
      // was not established", and printing "nothing hidden found (0 pages scanned)"
      // would be a reassurance nobody earned.
      if (!scan.pages.length) {
        out.limits.push('No page could be read, so the hidden-text pass did not run. Nothing is claimed about this file’s contents.');
      } else {
        try {
          const opts = options.minCoverage === undefined ? {} : { minCoverage: options.minCoverage };
          const findings = findHiddenTextInPages(scan.pages.map((p) => p.nodes), opts);
          out.hiddenText = {
            summary: describeHiddenText(findings),
            pagesScanned: scan.pages.length,
            findings,
          };
          out.checked.push('text present in the file but covered by an opaque shape');
          out.limits.push('The hidden-text pass covers one case: text painted over by an opaque shape, covering most of the line. Text hidden by invisible render mode, by a clip path, by white-on-white colouring, or under a bar that covers only part of the line is not reported.');
        } catch (err) {
          out.errors.push(`the hidden-text pass failed (${msg(err)})`);
        }
      }
    } catch (err) {
      out.errors.push(`this PDF could not be examined (${msg(err)})`);
    }
  } else if (out.format) {
    out.limits.push(`Page structure, document text and hidden-text detection run on PDF only. This file is ${out.format}.`);
  } else {
    out.limits.push('The container was not recognised from its bytes, so only the metadata scan ran.');
  }

  out.limits.push('No invisible or neural watermark detection ran. SynthID is not detected by Lolly at all; the TrustMark, Content Seal and Lolly durable pixel marks need a browser (lolly validate --deep).');
  if (out.metadata?.ai) {
    out.limits.push('The AI provenance below is a DECLARATION written into plain metadata. It can be removed with one command, so its absence in another file proves nothing.');
  }
  out.limits.push(ABSENCE_CAVEAT);
  return out;
}

/**
 * True when the inspection found something a person would want to know about before
 * sharing the file. Used for `--strict` exit-code promotion; deliberately narrow, and
 * deliberately NOT including "this file has metadata" (almost every file does).
 */
export function hasShareRisk(r: Inspection): boolean {
  if (r.hiddenText && r.hiddenText.findings.length > 0) return true;
  if (r.metadata?.gps) return true;
  if (r.metadata?.appended && !r.metadata.appended.declared) return true;
  return false;
}

// ── internals ─────────────────────────────────────────────────────────────────

function msg(err: unknown): string { return String((err && (err as Error).message) || err); }

function sniffSafe(bytes: Uint8Array): string | null {
  try { return sniffFormat(bytes); } catch { return null; }
}

/**
 * `hasResidualMetadata` answers "would a strip pass still find this?" — asked of the
 * ORIGINAL bytes it answers "is there anything here worth stripping?", which is the
 * question an inspection report needs. It only knows jpeg/png/svg; PDF metadata is
 * covered by the Info/XMP facts in the PDF section instead.
 */
function residualFor(bytes: Uint8Array, format: string): string | null {
  const f = format.toUpperCase();
  const stripFormat = f === 'JPEG' ? 'jpeg' : f === 'PNG' ? 'png' : f === 'SVG' ? 'svg' : null;
  if (!stripFormat) return null;
  try { return hasResidualMetadata(bytes, stripFormat); } catch { return null; }
}

async function readAllStdin(): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(Buffer.from(c as Buffer));
  return new Uint8Array(Buffer.concat(chunks));
}
