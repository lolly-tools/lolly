// SPDX-License-Identifier: MPL-2.0
/**
 * DOM-free multi-page PDF walk: bytes → per-page interpreted nodes.
 *
 * The engine owns the hard part. `interpretPdfPage` (engine/src/pdf-map.ts) is a pure
 * content-stream interpreter that returns positioned nodes IN PAINT ORDER, and every
 * higher pass this repo has — reading order (`extractPageText`), failed-redaction
 * detection (`findHiddenTextInPages`), design import (`finalizeBoxes`) — is written
 * against those nodes. What the engine deliberately does NOT do is parse a PDF's object
 * graph: it takes a content string plus already-resolved resources. Somebody has to walk
 * pdf-lib and hand it those, and until now that walk existed twice, in
 * `shells/web/src/views/pdf-import.ts` and `shells/tui/src/import/pdf.ts`, both first-page
 * only. This is the third caller's worth of evidence that it belongs in one place.
 *
 * What this module adds over those two: every page (bounded), and never throwing. An
 * inspection command is pointed at files precisely because they might be broken or
 * hostile, so a page that cannot be read degrades to one entry in `errors` and the walk
 * carries on. Fewer findings, never a crash.
 *
 * Bounds, all deliberate and all reported back to the caller so a report can say what it
 * did not look at:
 *   • `maxPages` (default 25) — pages interpreted; the rest are counted, not read.
 *   • `maxContentBytes` — a single page's content streams, past which the page is skipped.
 *   • resource recursion depth 8, matching the two shells this replaces.
 */

import {
  PDFDocument, PDFName, PDFArray, PDFDict, PDFNumber, PDFRawStream, decodePDFRawStream,
} from 'pdf-lib';
import type { PDFContext, PDFObject } from 'pdf-lib';
import { interpretPdfPage, parseToUnicode, toUnicodeDecoder } from '@lolly/engine';
import type { PdfNode, PdfFontInfo, PdfXObject } from '@lolly/engine';

export interface PdfPageScan {
  /** 0-based page index in the document. */
  index: number;
  /** MediaBox size in points. */
  width: number;
  height: number;
  /** Interpreted content, in paint order — safe to hand straight to the engine passes. */
  nodes: PdfNode[];
  /** Distinct base font names referenced by the page's resources, subset tag removed. */
  fonts: string[];
  /** Image XObjects the page's resources name (referenced, not necessarily painted). */
  images: number;
  /** Form XObjects the page's resources name. */
  forms: number;
  /** Annotations on the page (links, widgets, comments) — count only. */
  annotations: number;
}

export interface PdfScan {
  /** Pages in the document. */
  pageCount: number;
  /** Pages actually interpreted — `pages.length <= pageCount`. */
  pages: PdfPageScan[];
  /** True when `maxPages` (or a per-page skip) stopped this short of the document. */
  truncated: boolean;
  /** The document declares encryption. pdf-lib is loaded with ignoreEncryption. */
  encrypted: boolean;
  /** Info-dictionary + XMP facts, for the report's "what the file says about itself". */
  info: PdfInfo;
  /** Anything that went wrong, one line each. A non-empty list means fewer findings. */
  errors: string[];
}

export interface PdfInfo {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  created?: string;
  modified?: string;
  /** An XMP packet is present in the catalog (its contents are not parsed here). */
  xmp: boolean;
}

export interface PdfScanOptions {
  /** Pages to interpret. Default 25. */
  maxPages?: number;
  /** Per-page content-stream budget in bytes. Default 8 MiB. */
  maxContentBytes?: number;
}

const DEFAULT_MAX_PAGES = 25;
const DEFAULT_MAX_CONTENT = 8 * 1024 * 1024;

/**
 * Walk a PDF's pages. Never throws: a document that cannot be loaded at all comes back
 * with `pageCount: 0` and one entry in `errors`.
 */
export async function scanPdfPages(bytes: Uint8Array, opts: PdfScanOptions = {}): Promise<PdfScan> {
  const maxPages = Math.max(1, opts.maxPages ?? DEFAULT_MAX_PAGES);
  const maxContent = Math.max(1, opts.maxContentBytes ?? DEFAULT_MAX_CONTENT);
  const out: PdfScan = {
    pageCount: 0, pages: [], truncated: false, encrypted: false,
    info: { xmp: false }, errors: [],
  };

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, {
      ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false,
    });
  } catch (err) {
    out.errors.push(`this PDF could not be parsed (${msg(err)})`);
    return out;
  }

  out.encrypted = isEncrypted(doc);
  out.info = readInfo(doc);
  try { out.pageCount = doc.getPageCount(); } catch (err) { out.errors.push(`page tree unreadable (${msg(err)})`); }
  if (!out.pageCount) return out;

  const limit = Math.min(out.pageCount, maxPages);
  out.truncated = limit < out.pageCount;
  const ctx = doc.context;

  for (let i = 0; i < limit; i++) {
    try {
      const page = doc.getPage(i);
      const node = page.node;
      const mb = safeMediaBox(page);
      const content = contentString(ctx, node);
      if (content.length > maxContent) {
        out.errors.push(`page ${i + 1}: content stream over the ${Math.round(maxContent / 1024 / 1024)} MiB budget, not read`);
        out.truncated = true;
        continue;
      }
      const resources = extractResources(ctx, getKey(ctx, node, 'Resources'), 0);
      const nodes = interpretPdfPage({
        content, width: mb.width, height: mb.height, originX: mb.x, originY: mb.y,
        fonts: resources.fonts, xobjects: resources.xobjects,
        extgstates: resources.extgstates, ocgs: resources.ocgs,
      });
      out.pages.push({
        index: i,
        width: mb.width,
        height: mb.height,
        nodes,
        fonts: [...new Set(Object.values(resources.fontNames).filter(Boolean))].sort(),
        images: Object.values(resources.xobjects).filter((x) => x.kind === 'image').length,
        forms: Object.values(resources.xobjects).filter((x) => x.kind === 'form').length,
        annotations: countAnnotations(ctx, node),
      });
    } catch (err) {
      out.errors.push(`page ${i + 1}: ${msg(err)}`);
      out.truncated = true;
    }
  }
  return out;
}

// ── document-level facts ──────────────────────────────────────────────────────

function isEncrypted(doc: PDFDocument): boolean {
  try {
    const t = (doc.context as unknown as { trailerInfo?: Record<string, unknown> }).trailerInfo;
    return !!(t && t.Encrypt);
  } catch { return false; }
}

function readInfo(doc: PDFDocument): PdfInfo {
  const info: PdfInfo = { xmp: false };
  const str = (fn: () => string | undefined): string | undefined => {
    try { const v = fn(); return v && String(v).trim() ? String(v) : undefined; } catch { return undefined; }
  };
  const date = (fn: () => Date | undefined): string | undefined => {
    try { const d = fn(); return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined; }
    catch { return undefined; }
  };
  const t = str(() => doc.getTitle()); if (t) info.title = t;
  const a = str(() => doc.getAuthor()); if (a) info.author = a;
  const s = str(() => doc.getSubject()); if (s) info.subject = s;
  const k = str(() => { const v = doc.getKeywords(); return Array.isArray(v) ? v.join(', ') : v; });
  if (k) info.keywords = k;
  const c = str(() => doc.getCreator()); if (c) info.creator = c;
  const p = str(() => doc.getProducer()); if (p) info.producer = p;
  const cd = date(() => doc.getCreationDate()); if (cd) info.created = cd;
  const md = date(() => doc.getModificationDate()); if (md) info.modified = md;
  try { info.xmp = !!doc.catalog.get(PDFName.of('Metadata')); } catch { /* none */ }
  return info;
}

function countAnnotations(ctx: PDFContext, pageNode: Ref): number {
  try {
    const a = ctx.lookup(getKey(ctx, pageNode, 'Annots'));
    return a instanceof PDFArray ? a.size() : 0;
  } catch { return 0; }
}

function safeMediaBox(page: { getMediaBox(): { x: number; y: number; width: number; height: number } }):
  { x: number; y: number; width: number; height: number } {
  try {
    const mb = page.getMediaBox();
    const w = Number(mb.width), h = Number(mb.height);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      return { x: Number(mb.x) || 0, y: Number(mb.y) || 0, width: w, height: h };
    }
  } catch { /* fall through to US Letter */ }
  return { x: 0, y: 0, width: 612, height: 792 };
}

// ── pdf-lib access helpers (pure) ─────────────────────────────────────────────
// Ported verbatim in behaviour from shells/tui/src/import/pdf.ts, which was itself a
// port of shells/web/src/views/pdf-import.ts. Both should now call this module.

type Ref = PDFObject | null | undefined;
interface Resources {
  fonts: Record<string, PdfFontInfo>;
  /** Resource name → base font name, kept separately so a report can list real families. */
  fontNames: Record<string, string>;
  xobjects: Record<string, PdfXObject>;
  extgstates: Record<string, { ca?: number; CA?: number }>;
  ocgs: Record<string, string>;
}

function msg(err: unknown): string { return String((err && (err as Error).message) || err); }
function dictOf(ctx: PDFContext, o: Ref): PDFDict | null {
  o = ctx.lookup(o as PDFObject | undefined);
  return (o instanceof PDFRawStream) ? o.dict : (o instanceof PDFDict ? o : null);
}
function getKey(ctx: PDFContext, o: Ref, key: string): PDFObject | undefined {
  const d = dictOf(ctx, o); return d ? d.get(PDFName.of(key)) : undefined;
}
function numOf(ctx: PDFContext, o: Ref): number | null {
  o = ctx.lookup(o as PDFObject | undefined); return o instanceof PDFNumber ? o.asNumber() : null;
}
function nameOf(ctx: PDFContext, o: Ref): string | null {
  o = ctx.lookup(o as PDFObject | undefined);
  return o instanceof PDFName ? o.asString().replace(/^\//, '') : null;
}
function dictEntries(ctx: PDFContext, o: Ref): [string, PDFObject][] {
  const d = dictOf(ctx, o);
  return d ? [...d.entries()].map(([k, v]): [string, PDFObject] => [k.asString().replace(/^\//, ''), v]) : [];
}
function decodedText(ctx: PDFContext, o: Ref): string | null {
  o = ctx.lookup(o as PDFObject | undefined);
  if (o instanceof PDFRawStream) {
    try { return new TextDecoder('latin1').decode(decodePDFRawStream(o).decode()); } catch { return null; }
  }
  return null;
}
function contentString(ctx: PDFContext, pageNode: Ref): string {
  const c = ctx.lookup(getKey(ctx, pageNode, 'Contents'));
  const parts: string[] = [];
  const add = (ref: Ref): void => { const t = decodedText(ctx, ref); if (t != null) parts.push(t); };
  if (c instanceof PDFArray) c.asArray().forEach(add); else add(getKey(ctx, pageNode, 'Contents'));
  return parts.join('\n');
}

function extractResources(ctx: PDFContext, resDict: Ref, depth: number): Resources {
  const res: Resources = { fonts: {}, fontNames: {}, xobjects: {}, extgstates: {}, ocgs: {} };
  if (!dictOf(ctx, resDict) || depth > 8) return res;

  for (const [name, ref] of dictEntries(ctx, getKey(ctx, resDict, 'ExtGState'))) {
    const ca = numOf(ctx, getKey(ctx, ref, 'ca')), CA = numOf(ctx, getKey(ctx, ref, 'CA'));
    res.extgstates[name] = {};
    if (ca != null) res.extgstates[name]!.ca = ca;
    if (CA != null) res.extgstates[name]!.CA = CA;
  }
  for (const [name, ref] of dictEntries(ctx, getKey(ctx, resDict, 'Font'))) {
    const { info, base } = buildFontInfo(ctx, ref);
    res.fonts[name] = info;
    res.fontNames[name] = base;
  }
  for (const [name, ref] of dictEntries(ctx, getKey(ctx, resDict, 'XObject'))) {
    const subtype = nameOf(ctx, getKey(ctx, ref, 'Subtype'));
    if (subtype === 'Image') {
      res.xobjects[name] = { kind: 'image', imageKey: `img${name}` };
    } else if (subtype === 'Form') {
      const mtx = ctx.lookup(getKey(ctx, ref, 'Matrix'));
      const sub = extractResources(ctx, getKey(ctx, ref, 'Resources'), depth + 1);
      res.xobjects[name] = {
        kind: 'form',
        content: decodedText(ctx, ref) || '',
        matrix: mtx instanceof PDFArray ? mtx.asArray().map((v) => numOf(ctx, v) ?? 0) : undefined,
        resources: sub,
      };
      // A form's fonts are the page's fonts as far as a report is concerned.
      for (const [k, v] of Object.entries(sub.fontNames)) if (!res.fontNames[`${name}/${k}`]) res.fontNames[`${name}/${k}`] = v;
    }
  }
  for (const [name, ref] of dictEntries(ctx, getKey(ctx, resDict, 'Properties'))) {
    const label = pdfString(ctx, getKey(ctx, ref, 'Name'));
    if (label) res.ocgs[name] = label;
  }
  return res;
}

function pdfString(ctx: PDFContext, o: Ref): string {
  o = ctx.lookup(o as PDFObject | undefined);
  if (!o) return '';
  const s = o as { asString?: () => string; decodeText?: () => string };
  if (typeof s.asString === 'function' && !(o instanceof PDFName)) { try { return s.asString(); } catch { /* */ } }
  if (typeof s.decodeText === 'function') { try { return s.decodeText(); } catch { /* */ } }
  return '';
}

function buildFontInfo(ctx: PDFContext, fontRef: Ref): { info: PdfFontInfo; base: string } {
  const subtype = nameOf(ctx, getKey(ctx, fontRef, 'Subtype')) || '';
  const twoByte = subtype === 'Type0';
  const base = (nameOf(ctx, getKey(ctx, fontRef, 'BaseFont')) || '').replace(/^[A-Z]{6}\+/, '');
  const info: PdfFontInfo = { twoByte, family: base, weight: weightFromName(base) };
  const tuText = decodedText(ctx, getKey(ctx, fontRef, 'ToUnicode'));
  if (tuText) { try { info.decode = toUnicodeDecoder(parseToUnicode(tuText), twoByte); } catch { /* Latin-1 fallback */ } }
  return { info, base };
}

function weightFromName(name: string): number {
  const s = String(name || '');
  if (/thin|hairline/i.test(s)) return 100;
  if (/extra[\s-]*light|ultra[\s-]*light/i.test(s)) return 200;
  if (/semi[\s-]*bold|demi/i.test(s)) return 600;
  if (/extra[\s-]*bold|ultra[\s-]*bold/i.test(s)) return 800;
  if (/black|heavy/i.test(s)) return 900;
  if (/bold/i.test(s)) return 700;
  if (/medium/i.test(s)) return 500;
  if (/light/i.test(s)) return 300;
  return 400;
}
