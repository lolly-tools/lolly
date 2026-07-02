// SPDX-License-Identifier: MPL-2.0
/**
 * CMYK PDF export.
 *
 * Post-processes a jsPDF-rendered PDF to convert RGB colour operators to CMYK.
 * The pipeline: render with jsPDF → load into pdf-lib → decompress each content
 * stream → swap `rg`/`RG` operators → recompress → save.
 *
 * Raster images embedded by jsPDF remain RGB (their pixel data is not touched).
 * Fills, strokes, and text colours become DeviceCMYK.
 *
 * If opts.palette is provided (array of { hex, cmyk: [C,M,Y,K] } entries with
 * values 0–100), brand colours are looked up before generic conversion, giving
 * exact ink values for registered swatches.
 */

import { rgbToCmyk, cmykCondition } from '@lolly/engine';
import type { HostV1, Cmyk } from '@lolly/engine';
import type { PDFDocument } from 'pdf-lib';
import { inflateBytes, deflateBytes } from './metadata.ts';
import { printGeometry, provenanceLabels } from './print-geometry.ts';
import { renderArtworkPdf, setPageBoxes, drawPrintMarks } from './pdf.ts';
import type { FormatAdapter, RenderContext, ExportOptions, PaletteSwatch } from './types.ts';

// The pdf-lib module namespace — dynamically imported (heavy), statically typed.
type PdfLib = typeof import('pdf-lib');

async function renderCmykPdf(node: HTMLElement, opts: ExportOptions, host: HostV1 | null): Promise<Blob> {
  // Artwork only (no marks/boxes here) — print finishing is applied below, after
  // the RGB→CMYK conversion, so the marks stay DeviceCMYK (incl. registration).
  const geo = printGeometry(node, opts);
  const rgbBlob = await renderArtworkPdf(node, opts, geo, host);
  const rgbBytes = new Uint8Array(await rgbBlob.arrayBuffer());

  const lib: PdfLib = await import('pdf-lib');
  const { PDFDocument, PDFName, PDFNumber, PDFRawStream } = lib;
  const pdfDoc = await PDFDocument.load(rgbBytes);
  const m = opts.meta;
  const creator = m?.software || 'Lolly';
  pdfDoc.setCreator(creator);
  pdfDoc.setProducer(creator);
  pdfDoc.setAuthor(m?.author || creator); // the user if known, else the app
  if (m) {
    if (m.tool) pdfDoc.setTitle(m.tool);
    if (m.description) pdfDoc.setSubject(m.description);
    const kw = [m.software, m.source, m.contact].filter(Boolean);
    if (kw.length) pdfDoc.setKeywords(kw);
  }
  const paletteMap = buildCmykPaletteMap(opts.palette ?? []);
  const usedKeys = new Set<string>();   // brand palette keys actually hit during substitution

  // Declare the press condition the DeviceCMYK values are meant to be read under,
  // so a RIP/print shop knows the intended output. Referenced by registered name
  // (no heavy destination profile embedded) — valid for a standard condition.
  if (opts.colorProfile !== 'none') {
    addCmykOutputIntent(pdfDoc, opts.colorProfile, lib);
  }

  for (const [, obj] of pdfDoc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;

    const dict = obj.dict;

    // Image XObjects contain pixel data, not PDF operators — skip them.
    const sub = dict.get(PDFName.of('Subtype'));
    if (sub && String(sub).includes('Image')) continue;

    // jsPDF uses /FlateDecode; skip other filters (e.g. /DCTDecode for JPEG XObjects).
    const filter = dict.get(PDFName.of('Filter'));
    if (filter && !String(filter).includes('FlateDecode')) continue;

    let raw: Uint8Array;
    try {
      raw = filter ? await inflateBytes(obj.contents) : obj.contents;
    } catch { continue; }

    const text = new TextDecoder('latin1').decode(raw);
    if (!/\brg\b|\bRG\b/.test(text)) continue;

    const modified = substitutePdfRgb(text, paletteMap, usedKeys);
    if (modified === text) continue;

    const modBytes = Uint8Array.from(modified, c => c.charCodeAt(0));
    const recompressed = await deflateBytes(modBytes);

    // PDFRawStream.contents is readonly in the published typings but a plain own
    // property at runtime — Object.assign writes it without an escape hatch.
    Object.assign(obj, { contents: recompressed });
    dict.set(PDFName.of('Length'), PDFNumber.of(recompressed.length));
    if (!filter) dict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
  }

  // Print finishing in DeviceCMYK, drawn after the colour swap so registration
  // marks land on every plate (1 1 1 1) and aren't re-mapped by the RGB→CMYK pass.
  // The verification bar shows pairs for only the brand inks that actually
  // substituted in this artwork — rebuild the marks geometry from that used set
  // now that the substitution pass has run (page size is palette-independent).
  if (geo) {
    const page = pdfDoc.getPage(0);
    setPageBoxes(page, geo);
    const usedPalette = (opts.palette ?? []).filter(p => {
      const key = paletteHitKey(p);
      return key !== null && usedKeys.has(key);
    });
    const marksGeo = printGeometry(node, opts, usedPalette) ?? geo;
    await drawPrintMarks(page, marksGeo, { space: 'cmyk', labels: provenanceLabels(opts.meta) });
  }

  const out = await pdfDoc.save();
  return new Blob([new Uint8Array(out)], { type: 'application/pdf' });
}

// Builds a lookup map from quantised RGB keys (derived from palette hex values)
// to CMYK 4-tuples in 0–1 range. Used by substitutePdfRgb for exact brand matches.
function buildCmykPaletteMap(palette: readonly PaletteSwatch[]): Map<string, Cmyk> {
  const map = new Map<string, Cmyk>();
  for (const { hex, cmyk } of palette) {
    if (!hex || !cmyk || cmyk.length !== 4) continue;
    const h = hex.replace('#', '').toLowerCase();
    if (h.length !== 6) continue;
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const [c = 0, m = 0, y = 0, k = 0] = cmyk;
    map.set(cmykKey(r, g, b), [c / 100, m / 100, y / 100, k / 100]);
  }
  return map;
}

// Quantise an RGB triple (0–1) to a brand-match key. The precision MUST match
// what jsPDF writes into the content stream: it emits colour operators at two
// decimals (254/255 → "1.", 124/255 → "0.49"), so the palette side has to bucket
// to two decimals too — a 3-decimal key never matches jsPDF's "0.49" against the
// hex-exact 0.486, and every brand colour silently falls through to the generic
// conversion. No 0–255 channel lands on a .5 boundary at ×100, so jsPDF's
// toFixed(2) and Math.round always agree.
function cmykKey(r: number, g: number, b: number): string {
  return `${Math.round(r * 100)},${Math.round(g * 100)},${Math.round(b * 100)}`;
}

// The quantised key a palette entry is matched on (mirrors buildCmykPaletteMap),
// so usedKeys recorded during substitution can be filtered back to entries.
function paletteHitKey(p: PaletteSwatch): string | null {
  const h = (p.hex ?? '').replace('#', '').toLowerCase();
  if (h.length !== 6) return null;
  return cmykKey(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
}

// Adds an OutputIntent declaring the target CMYK press condition to the document
// catalog. The condition descriptor (registered name / info / registry) comes
// from the engine; 'srgb'/undefined falls back to the default press condition.
function addCmykOutputIntent(pdfDoc: PDFDocument, name: string | undefined, lib: PdfLib): void {
  const { PDFName, PDFString, PDFArray } = lib;
  const cond = cmykCondition(name === 'srgb' ? undefined : name);
  const intent = pdfDoc.context.obj({
    Type: 'OutputIntent',
    S: 'GTS_PDFX',
    OutputConditionIdentifier: PDFString.of(cond.identifier),
    OutputCondition: PDFString.of(cond.info),
    Info: PDFString.of(cond.info),
    RegistryName: PDFString.of(cond.registry),
  });
  const catalog = pdfDoc.catalog;
  const key = PDFName.of('OutputIntents');
  const existing = catalog.lookup(key);
  const arr = existing instanceof PDFArray ? existing : pdfDoc.context.obj([]);
  if (!(existing instanceof PDFArray)) catalog.set(key, arr);
  arr.push(intent);
}

// Converts PDF-space RGB (0–1) to CMYK (0–1), preferring an exact palette match
// (measured brand inks) before the engine's generic device-CMYK conversion. On a
// brand match the matched key is recorded in `used`, so the verification colour
// bar can show only the inks that were actually substituted.
function pdfRgbToCmyk(r: number, g: number, b: number, paletteMap: Map<string, Cmyk>, used: Set<string> | undefined): Cmyk {
  const key = cmykKey(r, g, b);
  const hit = paletteMap.get(key);
  if (hit) { used?.add(key); return hit; }
  return rgbToCmyk(r, g, b);
}

// Formats a CMYK component (0–1) as a compact decimal string for PDF output.
function cmykN(v: number): string {
  return v.toFixed(4).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') || '0';
}

// Replaces `r g b rg` and `r g b RG` operators with their CMYK equivalents.
// `used` (optional) collects the brand palette keys that matched.
function substitutePdfRgb(text: string, paletteMap: Map<string, Cmyk>, used?: Set<string>): string {
  const N = '([+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)';
  const W = '[\\s]+';
  return text
    .replace(new RegExp(`${N}${W}${N}${W}${N}${W}\\brg\\b`, 'g'), (_, r: string, g: string, b: string) => {
      const [c, m, y, k] = pdfRgbToCmyk(+r, +g, +b, paletteMap, used);
      return `${cmykN(c)} ${cmykN(m)} ${cmykN(y)} ${cmykN(k)} k`;
    })
    .replace(new RegExp(`${N}${W}${N}${W}${N}${W}\\bRG\\b`, 'g'), (_, r: string, g: string, b: string) => {
      const [c, m, y, k] = pdfRgbToCmyk(+r, +g, +b, paletteMap, used);
      return `${cmykN(c)} ${cmykN(m)} ${cmykN(y)} ${cmykN(k)} K`;
    });
}

export const pdfCmykAdapter: FormatAdapter = {
  formats: ['pdf-cmyk'],
  render(ctx: RenderContext): Promise<Blob> {
    return renderCmykPdf(ctx.node, ctx.opts, ctx.host);
  },
};
