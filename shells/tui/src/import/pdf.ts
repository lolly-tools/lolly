// SPDX-License-Identifier: MPL-2.0
/**
 * PDF / Adobe Illustrator (.ai) design import for the TUI - a DOM-free port of the web
 * shell's pdf-import.ts. It uses pdf-lib to walk the first page's content stream +
 * resources, hands them to the PURE engine interpreter (`interpretPdfPage`, no DOM), and
 * `finalizeBoxes` into a Design boxes array. Text frames import as editable text;
 * vector paths and embedded images become positioned COLOUR BOXES (the web resolves those
 * to stored SVG/PNG assets via a canvas - not available in Node, so we keep the geometry
 * and fill and drop the pixels). Enough to re-lay-out and re-edit a design in the terminal.
 */
import {
  PDFDocument, PDFName, PDFArray, PDFDict, PDFNumber, PDFRawStream, decodePDFRawStream,
} from 'pdf-lib';
import type { PDFContext, PDFObject } from 'pdf-lib';
import { interpretPdfPage, parseToUnicode, toUnicodeDecoder, finalizeBoxes, safeColor } from '@lolly/engine';
import type { PdfNode, PdfFontInfo, PdfXObject, DesignMapOptions } from '@lolly/engine';

export interface DesignImport { boxes: object[]; width: number; height: number; background: string }

type Ref = PDFObject | null | undefined;
interface ImportNode extends PdfNode { image?: unknown }
interface Resources { fonts: Record<string, PdfFontInfo>; xobjects: Record<string, PdfXObject>; extgstates: Record<string, { ca?: number; CA?: number }>; ocgs: Record<string, string> }

/** Parse PDF/.ai bytes into a Design boxes array (first page). `map` is the
 *  target tool's brand vocabulary (font select values + addKinds seed colours) - 
 *  see designMapFromManifest in import-design.ts; unset fields fall back to the
 *  engine's neutral lolly-start defaults. */
export async function parsePdfBytes(bytes: Uint8Array, warn: (m: string) => void = () => {}, map?: DesignMapOptions): Promise<DesignImport> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false });
  } catch (err) {
    throw new Error('Couldn’t read this PDF/.ai - it may be encrypted or damaged. (' + msg(err) + ')');
  }
  const pageCount = doc.getPageCount();
  if (!pageCount) throw new Error('This PDF has no pages.');
  if (pageCount > 1) warn(`Imported the first of ${pageCount} pages.`);

  const page = doc.getPage(0);
  const ctx = doc.context;
  const node = page.node;
  const mb = page.getMediaBox();

  const resources = extractResources(ctx, getKey(ctx, node, 'Resources'), 0);
  const content = contentString(ctx, node);

  const nodes = interpretPdfPage({
    content, width: mb.width, height: mb.height, originX: mb.x || 0, originY: mb.y || 0,
    fonts: resources.fonts, xobjects: resources.xobjects, extgstates: resources.extgstates, ocgs: resources.ocgs,
  }) as ImportNode[];
  if (!nodes.length) throw new Error('Couldn’t find any importable artwork on the first page.');

  // No canvas/host in Node: vector paths + images collapse to positioned colour boxes.
  for (const n of nodes) {
    if (n._vectorPath) { n.kind = 'box'; n.fill = firstColor(n._vectorFill); clearVector(n); }
    else if (n._imageXObject) { n.kind = 'box'; n.fill = ''; delete n._imageXObject; }
  }

  const boxes = finalizeBoxes(nodes, { prefix: 'p', ...map });
  if (!boxes.length) throw new Error('Couldn’t find any importable artwork on the first page.');
  return { boxes, width: Math.max(1, Math.round(mb.width)), height: Math.max(1, Math.round(mb.height)), background: '#ffffff' };
}

// ── pdf-lib access helpers (pure) ──────────────────────────────────────────────
function msg(err: unknown): string { return String((err && (err as Error).message) || err); }
function dictOf(ctx: PDFContext, o: Ref): PDFDict | null { o = ctx.lookup(o as PDFObject | undefined); return (o instanceof PDFRawStream) ? o.dict : (o instanceof PDFDict ? o : null); }
function getKey(ctx: PDFContext, o: Ref, key: string): PDFObject | undefined { const d = dictOf(ctx, o); return d ? d.get(PDFName.of(key)) : undefined; }
function numOf(ctx: PDFContext, o: Ref): number | null { o = ctx.lookup(o as PDFObject | undefined); return o instanceof PDFNumber ? o.asNumber() : null; }
function nameOf(ctx: PDFContext, o: Ref): string | null { o = ctx.lookup(o as PDFObject | undefined); return o instanceof PDFName ? o.asString().replace(/^\//, '') : null; }
function dictEntries(ctx: PDFContext, o: Ref): [string, PDFObject][] {
  const d = dictOf(ctx, o);
  return d ? [...d.entries()].map(([k, v]): [string, PDFObject] => [k.asString().replace(/^\//, ''), v]) : [];
}
function decodedText(ctx: PDFContext, o: Ref): string | null {
  o = ctx.lookup(o as PDFObject | undefined);
  if (o instanceof PDFRawStream) { try { return new TextDecoder('latin1').decode(decodePDFRawStream(o).decode()); } catch { return null; } }
  return null;
}
function contentString(ctx: PDFContext, pageNode: Ref): string {
  const c = ctx.lookup(getKey(ctx, pageNode, 'Contents'));
  const parts: string[] = [];
  const add = (ref: Ref) => { const t = decodedText(ctx, ref); if (t != null) parts.push(t); };
  if (c instanceof PDFArray) c.asArray().forEach(add); else add(getKey(ctx, pageNode, 'Contents'));
  return parts.join('\n');
}

// ── resource extraction (pure) ─────────────────────────────────────────────────
function extractResources(ctx: PDFContext, resDict: Ref, depth: number): Resources {
  const res: Resources = { fonts: {}, xobjects: {}, extgstates: {}, ocgs: {} };
  if (!dictOf(ctx, resDict) || depth > 8) return res;

  for (const [name, ref] of dictEntries(ctx, getKey(ctx, resDict, 'ExtGState'))) {
    const ca = numOf(ctx, getKey(ctx, ref, 'ca')), CA = numOf(ctx, getKey(ctx, ref, 'CA'));
    res.extgstates[name] = {};
    if (ca != null) res.extgstates[name]!.ca = ca;
    if (CA != null) res.extgstates[name]!.CA = CA;
  }
  for (const [name, ref] of dictEntries(ctx, getKey(ctx, resDict, 'Font'))) res.fonts[name] = buildFontInfo(ctx, ref);
  for (const [name, ref] of dictEntries(ctx, getKey(ctx, resDict, 'XObject'))) {
    const subtype = nameOf(ctx, getKey(ctx, ref, 'Subtype'));
    if (subtype === 'Image') {
      res.xobjects[name] = { kind: 'image', imageKey: `img${name}` };
    } else if (subtype === 'Form') {
      const mtx = ctx.lookup(getKey(ctx, ref, 'Matrix'));
      res.xobjects[name] = {
        kind: 'form',
        content: decodedText(ctx, ref) || '',
        matrix: mtx instanceof PDFArray ? mtx.asArray().map((v) => numOf(ctx, v) ?? 0) : undefined,
        resources: extractResources(ctx, getKey(ctx, ref, 'Resources'), depth + 1),
      };
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

// ── fonts (pure) ────────────────────────────────────────────────────────────────
function buildFontInfo(ctx: PDFContext, fontRef: Ref): PdfFontInfo {
  const subtype = nameOf(ctx, getKey(ctx, fontRef, 'Subtype')) || '';
  const twoByte = subtype === 'Type0';
  const base = (nameOf(ctx, getKey(ctx, fontRef, 'BaseFont')) || '').replace(/^[A-Z]{6}\+/, '');
  const info: PdfFontInfo = { twoByte, family: base, weight: weightFromName(base) };
  const tuText = decodedText(ctx, getKey(ctx, fontRef, 'ToUnicode'));
  if (tuText) { try { info.decode = toUnicodeDecoder(parseToUnicode(tuText), twoByte); } catch { /* Latin-1 fallback */ } }
  return info;
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

function firstColor(v: unknown): string { const s = safeColor(v, ''); return (s && s.toLowerCase() !== 'none') ? s : ''; }
function clearVector(n: ImportNode): void { delete n._vectorPath; delete n._vectorFill; delete n._vectorStroke; delete n._vectorViewBox; }
