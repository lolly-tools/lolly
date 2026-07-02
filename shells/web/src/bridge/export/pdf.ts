// SPDX-License-Identifier: MPL-2.0
/**
 * PDF export — vector output via jsPDF (artwork) + pdf-lib (print finishing).
 *
 * Two DOM walkers do the drawing:
 *   drawSvgVectorsInRegion — an SVG element (or SVG-rooted tool canvas) into a
 *     rectangular region of the page, as true vectors;
 *   drawHtmlVectors — the live HTML DOM as jsPDF vector objects:
 *     • background-color → filled rect / roundedRect
 *     • border-top → thin filled rect (used for divider lines)
 *     • <svg> subtrees → drawSvgVectorsInRegion
 *     • <img> → addImage (circular headshots pre-clipped to a canvas)
 *     • block-level leaf text → pdf.text() with computed font/color/align
 *
 * drawHtmlVectors mirrors the HTML→SVG walker (export/svg.ts) in structure;
 * changes to one should be reflected in the other.
 *
 * Font: custom webfonts (e.g. SUSE) are embedded when available, else
 * approximated with Helvetica. Text stays selectable/searchable vector.
 * Transparency: jsPDF fills are opaque; semi-transparent CSS colors are
 * approximated (GState where available).
 */

import { toPoints, insetCorners, roundedRectPath } from '@lolly/engine';
import type { HostV1, PrintGeometry, ExportMeta, CornerRadii, CornerPair } from '@lolly/engine';
import type { jsPDF } from 'jspdf';
import type { PDFPage } from 'pdf-lib';
import { exportDims, blobToDataUrl } from './dom.ts';
import { printGeometry, provenanceLabels } from './print-geometry.ts';
import type { ProvenanceLabels } from './print-geometry.ts';
import {
  isSvgRooted, pureRotationDeg, rotationPivot, parseCssColor, parseCssColorFull,
  parseCssLen, resolveRadii, sampleGradientMidpoint, n2, visualLines, fontMetricsPx,
  applyTextTransform, pseudoDescriptor, bakeImageFilter, circularClipImage,
  inlineSvgFromImg, rasterizeSvgElement, svgLen, resolveStyleProp, computedPaint,
  parseSvgColor, resolveColor, blendSvgWithWhite, objectPositionFractions,
  parseSvgPathArgs, svgArcToBeziers,
} from './dom-vectors.ts';
import type { RootRect, Rgba } from './dom-vectors.ts';
import { resolveSuseFontUrl, canVectoriseText } from '../text-svg.ts';
import { suseFontFile, SUSE_FONT_DIR } from '../text-svg.ts';
import type { FormatAdapter, RenderContext, ExportOptions } from './types.ts';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// The published jspdf typings declare GState and Matrix as plain methods, but at
// runtime both are constructor functions hung off the instance (see jsPDF's
// AcroForm/GState plugins). These are the honest constructor shapes; the single
// cast below is a library-typing correction, not an escape hatch.
interface GStateCtor {
  new (parameters: { opacity?: number; 'stroke-opacity'?: number }): Parameters<jsPDF['setGState']>[0];
}
interface MatrixCtor {
  new (a: number, b: number, c: number, d: number, e: number, f: number): Parameters<jsPDF['setCurrentTransformationMatrix']>[0];
}

// The SVG walker accepts any element that MAY carry an SVG viewBox — a real
// SVGSVGElement has one; a parsed/detached root may not expose baseVal.
interface SvgRootLike extends Element {
  viewBox?: SVGAnimatedRect;
}

async function loadJsPdf(): Promise<typeof jsPDF> {
  const mod = await import('jspdf');
  // ESM builds export the class both named and as default; prefer the named one.
  return mod.jsPDF ?? mod.default;
}

// Render the artwork to a jsPDF blob. Without geometry the page is the trim size
// and the design fills it (unchanged legacy behaviour, incl. optional jsPDF
// encryption). With geometry the page is the full sheet and the design is drawn
// (scaled) into the bleed box; page boxes + marks are added later in pdf-lib.
export async function renderArtworkPdf(node: HTMLElement, opts: ExportOptions, geo: PrintGeometry | null, host: HostV1 | null): Promise<Blob> {
  const JsPdf = await loadJsPdf();

  // Page size in points (1/72"). Physical units convert exactly; px maps via
  // the CSS 96-DPI convention, preserving existing pixel-based tools.
  const d = exportDims(node, opts);
  const trimW = toPoints(d.w);
  const trimH = toPoints(d.h);
  const pageW = geo ? geo.page.w : trimW;
  const pageH = geo ? geo.page.h : trimH;
  const art   = geo ? geo.artwork : { x: 0, y: 0, w: trimW, h: trimH };

  // orientation must be derived from the actual dimensions — jsPDF's default
  // 'portrait' mode swaps format[0] and format[1] when width > height, which
  // would produce an inverted page with all drawHtmlVectors coordinates wrong.
  const orientation = pageW >= pageH ? 'landscape' : 'portrait';

  // A non-empty opts.password locks the PDF on open via jsPDF's standard security
  // handler (user = owner password; printing-only permissions). Only the plain
  // RGB path with NO print finishing encrypts — print marks/boxes are applied in
  // pdf-lib, which can't write encrypted PDFs, so the two are mutually exclusive
  // (the UI hides the password field when marks/bleed are on). `undefined` is a
  // no-op (jsPDF treats it as unencrypted).
  const encryption = (opts.password && !geo)
    ? { userPassword: opts.password, ownerPassword: opts.password, userPermissions: ['print' as const] }
    : undefined;
  const pdf = new JsPdf({ unit: 'pt', format: [pageW, pageH], orientation, encryption });
  applyPdfMeta(pdf, opts.meta);

  // SVG-rooted canvas (the node IS an <svg>, or its only meaningful child is) →
  // walk the SVG element directly as vectors. This avoids drawHtmlVectors, which
  // skips SVG elements that have `display:inline` (the HTML default), resulting
  // in a blank page for tools like the QR code generator whose template is just
  // a bare <svg> with no explicit display:block.
  const svgRoot = node.tagName.toLowerCase() === 'svg' ? node
    : isSvgRooted(node) ? node.querySelector('svg') : null;
  if (svgRoot) {
    await drawSvgVectorsInRegion(pdf, svgRoot, art.x, art.y, art.w, art.h, new Set());
  } else {
    await drawHtmlVectors(pdf, node, art.x, art.y, art.w, art.h, opts.convertPaths !== false, host);
  }

  return pdf.output('blob');
}

// Stamp the document-info dictionary (creator/author/title/…) onto a jsPDF
// instance. Shared by the single-page and multi-page paths.
function applyPdfMeta(pdf: jsPDF, m: ExportMeta | undefined): void {
  const creator = m?.software || 'Lolly';
  pdf.setProperties({
    creator,                               // the producing app always
    author: m?.author || creator,          // the user if known, else the app
    ...(m?.tool ? { title: m.tool } : {}),
    ...(m?.description ? { subject: m.description } : {}),
    ...(m ? { keywords: [m.software, m.source, m.contact].filter(Boolean).join(', ') } : {}),
  });
}

async function renderPdf(node: HTMLElement, opts: ExportOptions, host: HostV1 | null): Promise<Blob> {
  // Multi-page: a tool can flag page boxes with [data-pdf-page]; each becomes its
  // own PDF page sized to that element's own CSS box. This is independent of the
  // print-geometry (marks/bleed) path, which stays single-page. Falls through to
  // the legacy single-page renderer when no page boxes are present.
  const pageEls = [...node.querySelectorAll('[data-pdf-page]')];
  if (pageEls.length > 0) return await renderMultiPagePdf(pageEls, opts, host);

  const geo = printGeometry(node, opts);
  const artBlob = await renderArtworkPdf(node, opts, geo, host);
  if (!geo) return artBlob;                       // legacy path (may be encrypted)
  // RGB PDF: marks are black; page boxes declare trim/bleed for the RIP.
  return finishPrintPdf(artBlob, geo, { space: 'rgb', labels: provenanceLabels(opts.meta) });
}

// Render a sequence of [data-pdf-page] DOM nodes into one multi-page PDF. Each
// page is sized to its own CSS box (layout px → PDF points at the CSS 96-DPI
// convention), so a tool that lays out fixed-size page boxes — the height
// matching the export page height — gets one true PDF page per box. Each box is
// drawn at (0,0) in its own page via drawHtmlVectors, whose coordinate origin is
// the node it's handed, so a page is rendered correctly regardless of where it
// sits in the scrolled/stacked document. A password locks the document on open
// (this path never goes through pdf-lib, so — unlike the single-page print path —
// it can always encrypt). Print marks/bleed are not applied here; a tool that
// emits page boxes opts out of the print-finishing card (render.printMarks:false).
async function renderMultiPagePdf(pageEls: Element[], opts: ExportOptions, host: HostV1 | null): Promise<Blob> {
  const JsPdf = await loadJsPdf();
  const convert = opts.convertPaths !== false;
  const firstEl = pageEls[0];
  if (!firstEl) throw new Error('renderMultiPagePdf requires at least one page element');

  // Page size in points from the element's own box. getBoundingClientRect matches
  // the reference drawHtmlVectors uses internally (so the px→pt scale is uniform);
  // the live CSS transform is removed by the shell before export (exportUnscaled).
  const sizeOf = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { w: toPoints({ value: r.width || 1, unit: 'px' }), h: toPoints({ value: r.height || 1, unit: 'px' }) };
  };
  const orientOf = (w: number, h: number) => (w >= h ? 'landscape' as const : 'portrait' as const);

  // Lock on open via jsPDF's standard security handler (user = owner password;
  // printing-only permissions). undefined is a no-op (unencrypted).
  const encryption = opts.password
    ? { userPassword: opts.password, ownerPassword: opts.password, userPermissions: ['print' as const] }
    : undefined;
  const first = sizeOf(firstEl);
  const pdf = new JsPdf({ unit: 'pt', format: [first.w, first.h], orientation: orientOf(first.w, first.h), encryption });
  applyPdfMeta(pdf, opts.meta);

  for (let i = 0; i < pageEls.length; i++) {
    const el = pageEls[i];
    if (!el) continue;
    const { w, h } = i === 0 ? first : sizeOf(el);
    if (i > 0) pdf.addPage([w, h], orientOf(w, h));
    // An SVG-rooted page walks as vectors (mirrors renderArtworkPdf); otherwise the
    // HTML page walks via drawHtmlVectors. Common case here is HTML page boxes.
    const svgRoot = el.tagName.toLowerCase() === 'svg' ? el
      : isSvgRooted(el) ? el.querySelector('svg') : null;
    if (svgRoot) await drawSvgVectorsInRegion(pdf, svgRoot, 0, 0, w, h, new Set());
    else await drawHtmlVectors(pdf, el, 0, 0, w, h, convert, host);
  }
  return pdf.output('blob');
}

// Re-save a jsPDF artwork blob through pdf-lib to set the print page boxes and
// draw the marks. Used by the plain RGB pdf path; the CMYK path inlines the same
// steps after its colour conversion (see pdf-cmyk.ts renderCmykPdf).
async function finishPrintPdf(blob: Blob, geo: PrintGeometry, { space, labels }: { space: 'rgb' | 'cmyk'; labels: ProvenanceLabels | null }): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
  const page = pdfDoc.getPage(0);
  setPageBoxes(page, geo);
  await drawPrintMarks(page, geo, { space, labels });
  const out = await pdfDoc.save();
  return new Blob([new Uint8Array(out)], { type: 'application/pdf' });
}

// Declare the print page boxes so a RIP / print shop knows the cut (trim) and
// bleed extents: Media ⊇ Bleed ⊇ Trim (= Art); CropBox = Media. The engine's
// geometry is top-left origin; PDF boxes are bottom-left, so flip y.
export function setPageBoxes(page: PDFPage, geo: PrintGeometry): void {
  const H = geo.page.h;
  const box = (b: { x: number; y: number; w: number; h: number }): [number, number, number, number] =>
    [b.x, H - (b.y + b.h), b.w, b.h]; // → [x, y(bottom-left), w, h]
  page.setMediaBox(...box(geo.boxes.media));
  page.setCropBox(...box(geo.boxes.media));
  page.setBleedBox(...box(geo.boxes.bleed));
  page.setTrimBox(...box(geo.boxes.trim));
  page.setArtBox(...box(geo.boxes.trim));
}

// Draw the crop / bleed / registration marks, colour bar and provenance labels
// in the page margin. Line marks use registration colour (DeviceCMYK 1,1,1,1 on
// the CMYK path so they print on every plate; black on the RGB path). Colour-bar
// cells follow their own `ink`: brand pairs force 'rgb' (the unconverted
// reference swatch) and 'cmyk' (the substitution) regardless of page space, so
// the two sit side by side for comparison; the generic bar's 'page' cells follow
// the page space. `labels` (optional) maps each engine label slot → its string.
// Engine coords are top-left; flip y.
export async function drawPrintMarks(page: PDFPage, geo: PrintGeometry, { space = 'rgb', labels }: { space?: 'rgb' | 'cmyk'; labels?: ProvenanceLabels | null } = {}): Promise<void> {
  const { rgb, cmyk, degrees, StandardFonts } = await import('pdf-lib');
  const H = geo.page.h;
  const fy = (y: number) => H - y;
  const markColor = space === 'cmyk' ? cmyk(1, 1, 1, 1) : rgb(0, 0, 0);
  const w = geo.strokeWeight;
  for (const ln of geo.primitives.lines) {
    page.drawLine({ start: { x: ln.x1, y: fy(ln.y1) }, end: { x: ln.x2, y: fy(ln.y2) }, thickness: w, color: markColor });
  }
  for (const c of geo.primitives.circles) {
    // borderColor without `color` strokes a ring (no fill) — see pdf-lib drawEllipse.
    page.drawCircle({ x: c.cx, y: fy(c.cy), size: c.r, borderWidth: w, borderColor: markColor });
  }
  for (const b of geo.primitives.bars) {
    const ink = b.ink === 'page' || !b.ink ? space : b.ink;
    const fill = ink === 'cmyk' ? cmyk(...b.cmyk) : rgb(...b.rgb);
    page.drawRectangle({ x: b.x, y: fy(b.y + b.h), width: b.w, height: b.h, color: fill });
  }
  // Provenance text — only the engine's anchors that the caller supplied a string
  // for. Helvetica (a standard-14 font: referenced, not embedded) keeps it light.
  const slots = (geo.primitives.labels ?? [])
    .map(l => ({ anchor: l, text: labels?.[l.slot] }))
    .filter((s): s is { anchor: typeof s.anchor; text: string } => Boolean(s.text));
  if (slots.length) {
    const font = await page.doc.embedFont(StandardFonts.Helvetica);
    const textColor = space === 'cmyk' ? cmyk(0, 0, 0, 0.7) : rgb(0.35, 0.35, 0.35);
    for (const { anchor: l, text } of slots) {
      // Right-aligned horizontal text shifts left by its measured width; rotated
      // text (read-up) starts at its anchor and climbs, so no shift needed.
      const shift = (l.rotation === 0 && l.align === 'right') ? font.widthOfTextAtSize(text, l.size) : 0;
      page.drawText(text, {
        x: l.x - shift, y: fy(l.y), size: l.size, font, color: textColor, rotate: degrees(l.rotation),
      });
    }
  }
}

// Renders an SVG element into a rectangular region of the PDF page.
// ox/oy are the PDF-space top-left offsets (pt); regionW/regionH are the
// target dimensions (pt). Used both by the full-page SVG canvas path and by
// drawHtmlVectors when it encounters an inline <svg> element.
async function drawSvgVectorsInRegion(pdf: jsPDF, svgEl: SvgRootLike, ox: number, oy: number, regionW: number, regionH: number, registeredFonts: Set<string> | null = null): Promise<void> {
  const vb = svgEl.viewBox?.baseVal;
  const vbW = (vb && vb.width  > 0) ? vb.width  : svgEl.getBoundingClientRect().width;
  const vbH = (vb && vb.height > 0) ? vb.height : svgEl.getBoundingClientRect().height;
  const vbX = (vb && vb.width  > 0) ? vb.x : 0;
  const vbY = (vb && vb.height > 0) ? vb.y : 0;
  const sx = regionW / vbW;
  const sy = regionH / vbH;

  async function visit(el: Element, tx: number, ty: number, sX: number, sY: number): Promise<void> {
    if (!el.tagName) return;
    const tag = el.tagName.toLowerCase().replace(/^svg:/, '');

    // Map an SVG user-space coord (inside this element's inherited group transform)
    // into PDF points: apply the accumulated translate+scale, shift by the viewBox
    // origin, then scale into the target region. LW/LH scale a length.
    const gAvg = (sX + sY) / 2, rAvg = (sx + sy) / 2;
    const PX = (v: number) => ox + ((tx + sX * v) - vbX) * sx;
    const PY = (v: number) => oy + ((ty + sY * v) - vbY) * sy;
    const LW = (v: number) => v * sX * sx;
    const LH = (v: number) => v * sY * sy;
    // Stroke width / font scaling: group scale × region scale — EXCEPT for
    // vector-effect:non-scaling-stroke (e.g. street-map roads), whose stroke keeps
    // its user-unit width through the group transform, so region scale only.
    const strokeMul = (e: Element) =>
      ((e.getAttribute('vector-effect') || resolveStyleProp(e, 'vector-effect')) === 'non-scaling-stroke' ? 1 : gAvg) * rAvg;

    // Resolve fill + stroke (with opacity) for a basic shape, mirroring the
    // <path> branch — so a stroked <rect>/<circle> keeps its border in PDF.
    // (Previously rect/circle were fill-only: a card whose fill matches the page,
    // distinguished only by its border, exported as an invisible box. The EMF/EPS
    // walker in svg-ir.js already routes rect/circle through its path logic, so
    // this brings the PDF sink to parity.) Returns null when nothing is paintable.
    const shapePaint = (e: Element) => {
      let fillRgb = resolveColor(e);                 // own-attr → inline style → computed
      let strokeStr = e.getAttribute('stroke') ?? resolveStyleProp(e, 'stroke') ?? 'none';
      if (strokeStr === 'currentColor') strokeStr = computedPaint(e, 'stroke') || 'none';
      let strokeRgb = (strokeStr && strokeStr !== 'none') ? parseSvgColor(strokeStr) : null;
      const elemOp = parseFloat(e.getAttribute('opacity') ?? '1');
      const fillOp = elemOp * parseFloat(e.getAttribute('fill-opacity') ?? '1');
      const strkOp = elemOp * parseFloat(e.getAttribute('stroke-opacity') ?? '1');
      if (fillOp < 0.01) fillRgb = null;
      if (strkOp < 0.01) strokeRgb = null;
      if (!fillRgb && !strokeRgb) return null;
      if (fillRgb   && fillOp < 0.999) fillRgb   = blendSvgWithWhite(fillRgb,   fillOp);
      if (strokeRgb && strkOp < 0.999) strokeRgb = blendSvgWithWhite(strokeRgb, strkOp);
      const lw = Math.max(0.1, parseFloat(e.getAttribute('stroke-width') ?? '1') * strokeMul(e));
      return { fillRgb, strokeRgb, lw };
    };

    if (tag === 'defs' || tag === 'clippath' || tag === 'lineargradient' ||
        tag === 'radialgradient' || tag === 'symbol') return;

    if (tag === 'g') {
      // Compose this group's transform onto the inherited one. Supports the
      // translate(+scale) that d3.zoom emits (street-map pan/zoom lives here): SVG
      // order is translate-then-scale, so the local translate is taken in the
      // PARENT's scale and the scales multiply. Rotation/skew are not handled.
      let ntx = tx, nty = ty, nsX = sX, nsY = sY;
      const t = el.getAttribute('transform') ?? '';
      if (t) {
        const tm = t.match(/translate\(\s*([+-]?\d*\.?\d+)[,\s]\s*([+-]?\d*\.?\d+)\s*\)/) ??
                   t.match(/translate\(\s*([+-]?\d*\.?\d+)\s*\)/);
        const sm = t.match(/scale\(\s*([+-]?\d*\.?\d+)(?:[,\s]\s*([+-]?\d*\.?\d+))?\s*\)/);
        if (tm?.[1] !== undefined) { ntx += sX * parseFloat(tm[1]); nty += sY * parseFloat(tm[2] ?? '0'); }
        if (sm?.[1] !== undefined) { nsX = sX * parseFloat(sm[1]); nsY = sY * parseFloat(sm[2] ?? sm[1]); }
      }
      for (const child of el.children) await visit(child, ntx, nty, nsX, nsY);
      return;
    }

    if (tag === 'rect') {
      const x = PX(svgLen(el.getAttribute('x'), vbW));
      const y = PY(svgLen(el.getAttribute('y'), vbH));
      const w = LW(svgLen(el.getAttribute('width'), vbW));
      const h = LH(svgLen(el.getAttribute('height'), vbH));
      if (w <= 0 || h <= 0) return;
      const paint = shapePaint(el);
      if (!paint) return;
      const rx = LW(parseFloat(el.getAttribute('rx') || el.getAttribute('ry') || '0'));
      const ry = LH(parseFloat(el.getAttribute('ry') || el.getAttribute('rx') || '0'));
      if (paint.fillRgb)   pdf.setFillColor(paint.fillRgb[0], paint.fillRgb[1], paint.fillRgb[2]);
      if (paint.strokeRgb) { pdf.setDrawColor(paint.strokeRgb[0], paint.strokeRgb[1], paint.strokeRgb[2]); pdf.setLineWidth(paint.lw); }
      const style = (paint.fillRgb && paint.strokeRgb) ? 'FD' : (paint.fillRgb ? 'F' : 'S');
      if (rx > 0 || ry > 0) pdf.roundedRect(x, y, w, h, rx, ry, style);
      else pdf.rect(x, y, w, h, style);
      return;
    }

    if (tag === 'circle') {
      const cx = PX(svgLen(el.getAttribute('cx'), vbW));
      const cy = PY(svgLen(el.getAttribute('cy'), vbH));
      const r  = LW(svgLen(el.getAttribute('r'), vbW));
      if (r <= 0) return;
      const paint = shapePaint(el);
      if (!paint) return;
      if (paint.fillRgb)   pdf.setFillColor(paint.fillRgb[0], paint.fillRgb[1], paint.fillRgb[2]);
      if (paint.strokeRgb) { pdf.setDrawColor(paint.strokeRgb[0], paint.strokeRgb[1], paint.strokeRgb[2]); pdf.setLineWidth(paint.lw); }
      const style = (paint.fillRgb && paint.strokeRgb) ? 'FD' : (paint.fillRgb ? 'F' : 'S');
      pdf.circle(cx, cy, r, style);
      return;
    }

    if (tag === 'line') {
      const strokeStr = el.getAttribute('stroke') ?? '';
      let rgb = (strokeStr && strokeStr !== 'none') ? parseSvgColor(strokeStr) : null;
      if (!rgb) return;
      const opacity = parseFloat(el.getAttribute('opacity') ?? el.getAttribute('stroke-opacity') ?? '1');
      if (opacity < 0.01) return;
      if (opacity < 0.999) rgb = blendSvgWithWhite(rgb, opacity);
      const lx1 = PX(svgLen(el.getAttribute('x1'), vbW));
      const ly1 = PY(svgLen(el.getAttribute('y1'), vbH));
      const lx2 = PX(svgLen(el.getAttribute('x2'), vbW));
      const ly2 = PY(svgLen(el.getAttribute('y2'), vbH));
      const lw  = parseFloat(el.getAttribute('stroke-width') ?? '1') * strokeMul(el);
      pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
      pdf.setLineWidth(Math.max(0.1, lw));
      pdf.line(lx1, ly1, lx2, ly2, 'S');
      return;
    }

    if (tag === 'text') {
      let fillStr = el.getAttribute('fill');
      if (!fillStr || fillStr === 'currentColor') fillStr = computedPaint(el, 'fill') || '#000000';
      let rgb = parseSvgColor(fillStr);
      if (!rgb) return;
      const opacity = parseFloat(el.getAttribute('opacity') ?? el.getAttribute('fill-opacity') ?? '1');
      if (opacity < 0.01) return;
      if (opacity < 0.999) rgb = blendSvgWithWhite(rgb, opacity);
      const text = (el.textContent ?? '').trim();
      if (!text) return;
      const xt = PX(svgLen(el.getAttribute('x'), vbW));
      const yt = PY(svgLen(el.getAttribute('y'), vbH));
      const fs = parseFloat(el.getAttribute('font-size') ?? '16') * gAvg * rAvg;
      const fw = parseInt(el.getAttribute('font-weight') ?? '400') || 400;
      const italic  = el.getAttribute('font-style') === 'italic';
      const anchor  = el.getAttribute('text-anchor') ?? 'start';
      const family  = (el.getAttribute('font-family') ?? '').toLowerCase();
      pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
      pdf.setFontSize(Math.max(1, fs));
      let fontSet = false;
      if (family.includes('suse') && registeredFonts) {
        const suseStyle = await embedSuseFont(pdf, registeredFonts, fw, italic);
        if (suseStyle) { pdf.setFont('SUSE', suseStyle); fontSet = true; }
      }
      if (!fontSet) {
        pdf.setFont('helvetica', fw >= 600 ? (italic ? 'bolditalic' : 'bold') : (italic ? 'italic' : 'normal'));
      }
      const align = anchor === 'middle' ? 'center' as const : anchor === 'end' ? 'right' as const : 'left' as const;
      pdf.text(text, xt, yt, { align });
      return;
    }

    if (tag === 'path') {
      const d = el.getAttribute('d') ?? '';
      if (!d.trim()) return;
      // Fill/stroke fall back to the COMPUTED paint (not a literal black), so a path
      // that inherits its colour from an ancestor group (e.g. logo-wall's one-ink
      // <g fill="ink">) or uses currentColor resolves correctly in PDF instead of
      // rendering black. getComputedStyle resolves SVG inheritance on the live DOM.
      let fillStr = el.getAttribute('fill') ?? resolveStyleProp(el, 'fill');
      if (!fillStr || fillStr === 'currentColor') fillStr = computedPaint(el, 'fill') || 'black';
      let strokeStr = el.getAttribute('stroke') ?? resolveStyleProp(el, 'stroke') ?? 'none';
      if (strokeStr === 'currentColor') strokeStr = computedPaint(el, 'stroke') || 'none';
      const elemOp  = parseFloat(el.getAttribute('opacity') ?? '1');
      const fillOp  = elemOp * parseFloat(el.getAttribute('fill-opacity')   ?? '1');
      const strkOp  = elemOp * parseFloat(el.getAttribute('stroke-opacity') ?? '1');
      let fillRgb   = (fillStr   && fillStr   !== 'none') ? parseSvgColor(fillStr)   : null;
      let strokeRgb = (strokeStr && strokeStr !== 'none') ? parseSvgColor(strokeStr) : null;
      if (fillOp   < 0.01) fillRgb   = null;
      if (strkOp   < 0.01) strokeRgb = null;
      if (!fillRgb && !strokeRgb) return;
      if (fillRgb   && fillOp   < 0.999) fillRgb   = blendSvgWithWhite(fillRgb,   fillOp);
      if (strokeRgb && strkOp   < 0.999) strokeRgb = blendSvgWithWhite(strokeRgb, strkOp);
      if (fillRgb)   pdf.setFillColor(fillRgb[0], fillRgb[1], fillRgb[2]);
      if (strokeRgb) {
        pdf.setDrawColor(strokeRgb[0], strokeRgb[1], strokeRgb[2]);
        const lw = parseFloat(el.getAttribute('stroke-width') ?? '1') * strokeMul(el);
        pdf.setLineWidth(Math.max(0.1, lw));
      }
      drawSvgPathToPdf(pdf, d, v => PX(v), v => PY(v));
      const fillRule = el.getAttribute('fill-rule') ?? 'nonzero';
      if (fillRgb && strokeRgb) pdf.fillStroke();
      else if (fillRgb) { if (fillRule === 'evenodd') pdf.fillEvenOdd(); else pdf.fill(); }
      else pdf.stroke();
      return;
    }

    if (tag === 'image') {
      const href = el.getAttribute('href') || el.getAttribute('xlink:href') || '';
      if (!href) return;
      const x = PX(svgLen(el.getAttribute('x'), vbW));
      const y = PY(svgLen(el.getAttribute('y'), vbH));
      const w = LW(svgLen(el.getAttribute('width'), vbW));
      const h = LH(svgLen(el.getAttribute('height'), vbH));
      if (w <= 0 || h <= 0) return;

      // An <image> pointing at an SVG (e.g. the brand logo) must stay VECTOR —
      // jsPDF.addImage can't embed SVG. Inline it and recurse, honouring the
      // <image>'s preserveAspectRatio (meet → fit the whole mark, centred).
      // SVG-ness is detected from the bytes (asset URLs are blob: with no hint).
      {
        let inner: SVGSVGElement | null = null;
        try {
          inner = await inlineSvgFromImg(href);
          if (inner) {
            inner.setAttribute('style', `position:absolute;left:-99999px;top:0;width:${Math.max(1, Math.round(w))}px;height:${Math.max(1, Math.round(h))}px`);
            document.body.appendChild(inner);
            const ivb  = inner.viewBox.baseVal;
            const ivbW = (ivb && ivb.width  > 0) ? ivb.width  : w;
            const ivbH = (ivb && ivb.height > 0) ? ivb.height : h;
            const par  = (el.getAttribute('preserveAspectRatio') || 'xMidYMid meet').trim();
            let fx = x, fy = y, fw = w, fh = h;
            if (!/^none/i.test(par)) {                 // meet: preserve aspect, centre
              const s = Math.min(w / ivbW, h / ivbH);
              fw = ivbW * s; fh = ivbH * s;
              fx = x + (w - fw) / 2; fy = y + (h - fh) / 2;
            }
            await drawSvgVectorsInRegion(pdf, inner, fx, fy, fw, fh, registeredFonts);
          }
        } catch { /* fall through to raster */ }
        finally { inner?.remove(); }
        if (inner) return;
      }

      try {
        const dataUrl = href.startsWith('data:') ? href : await blobToDataUrl(href);
        const { src: imgSrc, fmt } = await imageForPdf(dataUrl);
        pdf.addImage(imgSrc, fmt, x, y, w, h);
      } catch { /* skip unresolvable images */ }
      return;
    }

    for (const child of el.children) await visit(child, tx, ty, sX, sY);
  }

  await visit(svgEl, 0, 0, 1, 1);
}

// Fill ('F') or stroke ('S') a rounded rect into the PDF using the fast
// jsPDF.roundedRect when corners are uniform (or sharp), else a four-corner path
// (so e.g. top-only rounding keeps square bottom corners). Coords are already in
// pt; the caller sets fill/draw colour, line width and any GState first.
function pdfRoundedRect(pdf: jsPDF, x: number, y: number, w: number, h: number, radii: CornerRadii, uniform: CornerPair | null, op: 'F' | 'S'): void {
  if (uniform) {
    if (uniform[0] > 0 || uniform[1] > 0) pdf.roundedRect(x, y, w, h, uniform[0], uniform[1], op);
    else pdf.rect(x, y, w, h, op);
  } else {
    drawSvgPathToPdf(pdf, roundedRectPath(x, y, w, h, radii), v => v, v => v);
    if (op === 'S') pdf.stroke(); else pdf.fill();
  }
}

// Run `draw` with a uniform fill+stroke alpha applied via jsPDF GState, then
// reset to opaque (GState is sticky and would otherwise leak onto every later
// element). No-op when alpha is 1 or GState is unavailable.
function withPdfAlpha(pdf: jsPDF, a: number, draw: () => void): void {
  const on = a < 1 && typeof pdf.GState === 'function' && typeof pdf.setGState === 'function';
  // See GStateCtor above — the published typing is a method, the runtime a constructor.
  const GState = pdf.GState as unknown as GStateCtor;
  if (on) pdf.setGState(new GState({ opacity: a, 'stroke-opacity': a }));
  try { draw(); }
  finally { if (on) pdf.setGState(new GState({ opacity: 1, 'stroke-opacity': 1 })); }
}

// Run `draw` with drawing clipped to the rect (x, y, w, h) in pt, then restore.
// `rect(...,null)` adds the path with no paint op; clip()+discardPath() set it as
// the clip region (W n). Used for object-fit: cover, where the fitted image/SVG
// overflows the box and the spill must be cropped. `draw` may be async.
async function withPdfClipRect(pdf: jsPDF, x: number, y: number, w: number, h: number, draw: () => void | Promise<void>): Promise<void> {
  pdf.saveGraphicsState();
  pdf.rect(x, y, w, h, null);
  pdf.clip();
  pdf.discardPath();
  try { await draw(); }
  finally { pdf.restoreGraphicsState(); }
}

// Run `draw` with a CSS-clockwise rotation of `deg` about the point (cx, cy) in the
// jsPDF drawing space (pt, top-left origin). Used so free-canvas boxes with a CSS
// rotate() export rotated (not flattened to their bounding box). Applied via jsPDF's
// transformation matrix; if that API is missing or throws we degrade gracefully to
// an unrotated draw inside the saved/restored graphics state (never a broken PDF).
async function withPdfRotation(pdf: jsPDF, deg: number, cx: number, cy: number, draw: () => void | Promise<void>): Promise<void> {
  const canMatrix = deg !== 0 && typeof pdf.setCurrentTransformationMatrix === 'function' && typeof pdf.Matrix === 'function';
  if (!canMatrix) { await draw(); return; }
  const r = deg * Math.PI / 180, cos = Math.cos(r), sin = Math.sin(r);
  // Rotate about (cx,cy): M = T(cx,cy)·R·T(-cx,-cy). jsPDF's Matrix is (a,b,c,d,e,f).
  const a = cos, b = sin, c = -sin, d = cos;
  const e = cx - (a * cx + c * cy);
  const f = cy - (b * cx + d * cy);
  pdf.saveGraphicsState();
  // See MatrixCtor above — the published typing is a method, the runtime a constructor.
  const Matrix = pdf.Matrix as unknown as MatrixCtor;
  try { pdf.setCurrentTransformationMatrix(new Matrix(a, b, c, d, e, f)); }
  catch (err) { console.warn('[export] PDF rotation unavailable, flattening this element:', err); }
  try { await draw(); }
  finally { pdf.restoreGraphicsState(); }
}

// Emits jsPDF path operations (moveTo/lineTo/curveTo/close) for an SVG `d` string.
// tx/ty are coordinate-transform functions: SVG user units → jsPDF pt (top-left origin).
// Caller must call fill()/stroke()/fillStroke() after this returns.
function drawSvgPathToPdf(pdf: jsPDF, d: string, tx: (v: number) => number, ty: (v: number) => number): void {
  const cmdRe = /([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g;
  let cx = 0, cy = 0;
  let sx = 0, sy = 0;   // current subpath start — Z returns the current point here (SVG spec)
  let lastCmd = '';
  let lastCpx = 0, lastCpy = 0;
  let m: RegExpExecArray | null;

  while ((m = cmdRe.exec(d)) !== null) {
    const cmd  = m[1] ?? '';
    const nums = parseSvgPathArgs(m[2] ?? '');
    const abs  = cmd === cmd.toUpperCase();
    const C    = cmd.toUpperCase();
    // Indexed reads are guarded by each case's loop bound, so in-range `?? 0` is inert.
    const ax   = (i: number) => abs ? (nums[i] ?? 0) : cx + (nums[i] ?? 0);
    const ay   = (i: number) => abs ? (nums[i] ?? 0) : cy + (nums[i] ?? 0);

    switch (C) {
      case 'M':
        for (let i = 0; i + 1 < nums.length; i += 2) {
          const x = ax(i), y = ay(i + 1);
          if (i === 0) { pdf.moveTo(tx(x), ty(y)); sx = x; sy = y; } // remember subpath start
          else pdf.lineTo(tx(x), ty(y));
          cx = x; cy = y;
        }
        break;
      case 'L':
        for (let i = 0; i + 1 < nums.length; i += 2) {
          const x = ax(i), y = ay(i + 1);
          pdf.lineTo(tx(x), ty(y)); cx = x; cy = y;
        }
        break;
      case 'H':
        for (let i = 0; i < nums.length; i++) {
          cx = abs ? (nums[i] ?? 0) : cx + (nums[i] ?? 0);
          pdf.lineTo(tx(cx), ty(cy));
        }
        break;
      case 'V':
        for (let i = 0; i < nums.length; i++) {
          cy = abs ? (nums[i] ?? 0) : cy + (nums[i] ?? 0);
          pdf.lineTo(tx(cx), ty(cy));
        }
        break;
      case 'C':
        for (let i = 0; i + 5 < nums.length; i += 6) {
          const x1 = ax(i),     y1 = ay(i + 1);
          const x2 = ax(i + 2), y2 = ay(i + 3);
          const x  = ax(i + 4), y  = ay(i + 5);
          pdf.curveTo(tx(x1), ty(y1), tx(x2), ty(y2), tx(x), ty(y));
          lastCpx = x2; lastCpy = y2; cx = x; cy = y;
        }
        break;
      case 'S':
        for (let i = 0; i + 3 < nums.length; i += 4) {
          const r1x = (lastCmd === 'C' || lastCmd === 'S') ? 2 * cx - lastCpx : cx;
          const r1y = (lastCmd === 'C' || lastCmd === 'S') ? 2 * cy - lastCpy : cy;
          const x2  = ax(i),     y2 = ay(i + 1);
          const x   = ax(i + 2), y  = ay(i + 3);
          pdf.curveTo(tx(r1x), ty(r1y), tx(x2), ty(y2), tx(x), ty(y));
          lastCpx = x2; lastCpy = y2; cx = x; cy = y;
        }
        break;
      case 'Q':
        for (let i = 0; i + 3 < nums.length; i += 4) {
          const qx1 = ax(i), qy1 = ay(i + 1);
          const x   = ax(i + 2), y = ay(i + 3);
          const x1  = cx + 2 / 3 * (qx1 - cx), y1 = cy + 2 / 3 * (qy1 - cy);
          const x2  = x  + 2 / 3 * (qx1 - x),  y2 = y  + 2 / 3 * (qy1 - y);
          pdf.curveTo(tx(x1), ty(y1), tx(x2), ty(y2), tx(x), ty(y));
          lastCpx = qx1; lastCpy = qy1; cx = x; cy = y;
        }
        break;
      case 'T':
        for (let i = 0; i + 1 < nums.length; i += 2) {
          const qx1 = (lastCmd === 'Q' || lastCmd === 'T') ? 2 * cx - lastCpx : cx;
          const qy1 = (lastCmd === 'Q' || lastCmd === 'T') ? 2 * cy - lastCpy : cy;
          const x   = ax(i), y = ay(i + 1);
          const x1  = cx + 2 / 3 * (qx1 - cx), y1 = cy + 2 / 3 * (qy1 - cy);
          const x2  = x  + 2 / 3 * (qx1 - x),  y2 = y  + 2 / 3 * (qy1 - y);
          pdf.curveTo(tx(x1), ty(y1), tx(x2), ty(y2), tx(x), ty(y));
          lastCpx = qx1; lastCpy = qy1; cx = x; cy = y;
        }
        break;
      case 'A':
        for (let i = 0; i + 6 < nums.length; i += 7) {
          const rx = Math.abs(nums[i] ?? 0);
          const ry = Math.abs(nums[i + 1] ?? 0);
          const xRot = (nums[i + 2] ?? 0) * Math.PI / 180;
          const la   = nums[i + 3] ? 1 : 0;
          const sw   = nums[i + 4] ? 1 : 0;
          const x    = ax(i + 5), y = ay(i + 6);
          if (rx < 1e-6 || ry < 1e-6) {
            pdf.lineTo(tx(x), ty(y));
          } else {
            for (const [bx1, by1, bx2, by2, bx, by] of svgArcToBeziers(cx, cy, rx, ry, xRot, la, sw, x, y)) {
              pdf.curveTo(tx(bx1), ty(by1), tx(bx2), ty(by2), tx(bx), ty(by));
            }
          }
          cx = x; cy = y;
          lastCpx = cx; lastCpy = cy;
        }
        break;
      case 'Z':
        pdf.close();
        // SVG: after closepath the current point returns to the subpath's start, so a
        // following relative command (`z m…`) is offset from there — not the last drawn
        // point. Without this the mono-white SUSE wordmark mangled (hourglass 'S').
        cx = sx; cy = sy;
        break;
    }

    lastCmd = C;
    // Preserve the stored control point after curve commands so the next smooth
    // command can reflect it: C/S keep the cubic control point, Q/T the quadratic
    // one. Everything else has no control point, so it collapses to the current
    // point. (Resetting after Q/T here was the bug that mangled smooth-quad glyphs.)
    if (C !== 'C' && C !== 'S' && C !== 'Q' && C !== 'T') { lastCpx = cx; lastCpy = cy; }
  }
}

// Draws the live DOM as PDF vectors into the rectangular region (ox, oy, regionW,
// regionH) in page points (top-left origin). Callers pass the full page for an
// ordinary export, or the bleed box for a print export (so the design bleeds).
async function drawHtmlVectors(pdf: jsPDF, node: Element, ox: number, oy: number, regionW: number, regionH: number, convertPaths: boolean, host: HostV1 | null): Promise<void> {
  const rect0 = node.getBoundingClientRect();
  const scaleX = regionW / rect0.width;
  const scaleY = regionH / rect0.height;
  // CSS px → PDF pt — accounts for the CSS transform scale applied to the
  // canvas node. node.clientWidth is the layout width before the transform.
  const cssToPt = regionW / (node.clientWidth || rect0.width);
  // Virtual origin: shifting the reference top-left by the region offset bakes it
  // into every (rect − rootRect)·scale below, so the artwork lands at (ox, oy)
  // without touching the inline-text / pseudo-content helpers downstream.
  const rootRect: RootRect = {
    left: rect0.left - ox / scaleX, top: rect0.top - oy / scaleY,
  };
  // Tracks which font variants have been registered in this PDF instance.
  const registeredFonts = new Set<string>();

  async function visit(el: Element): Promise<void> {
    if (el.nodeType !== 1) return;
    const tag = el.tagName.toLowerCase();
    if (tag === 'style' || tag === 'script') return;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    if (parseFloat(style.opacity ?? '1') === 0) return;

    // CSS rotate(): neutralise it, walk the axis-aligned subtree, and wrap the draw
    // in a jsPDF rotation about the transform-origin. Additive (no-op unrotated).
    const rotDeg = pureRotationDeg(style.transform);
    if (rotDeg && (el instanceof HTMLElement || el instanceof SVGElement)) {
      const prevInline = el.style.transform;
      el.style.transform = 'none';
      const unrot = el.getBoundingClientRect();     // reading forces the reflow
      const pivot = rotationPivot(style, unrot, rootRect);
      try { await withPdfRotation(pdf, rotDeg, pivot.x * scaleX, pivot.y * scaleY, () => visit(el)); }
      finally { el.style.transform = prevInline; }
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width < 0.5 || rect.height < 0.5) return;

    const x = (rect.left - rootRect.left) * scaleX;
    const y = (rect.top  - rootRect.top)  * scaleY;
    const w = rect.width  * scaleX;
    const h = rect.height * scaleY;

    // ── Background fill ───────────────────────────────────────────────────────
    // CSS corner-overlap clamped (→ pill, not ellipse) via the shared engine math,
    // resolved in CSS px then scaled per axis. Uniform corners take jsPDF's fast
    // roundedRect; differing corners take a four-corner path.
    const { radii: radiiCss, uniform: uniformCss } = resolveRadii(style, rect.width, rect.height);
    const scaleRadii = (r: CornerRadii): CornerRadii => ({
      topLeft:     [r.topLeft[0]     * scaleX, r.topLeft[1]     * scaleY],
      topRight:    [r.topRight[0]    * scaleX, r.topRight[1]    * scaleY],
      bottomRight: [r.bottomRight[0] * scaleX, r.bottomRight[1] * scaleY],
      bottomLeft:  [r.bottomLeft[0]  * scaleX, r.bottomLeft[1]  * scaleY],
    });
    const radii = scaleRadii(radiiCss);
    const uniform: CornerPair | null = uniformCss ? [uniformCss[0] * scaleX, uniformCss[1] * scaleY] : null;
    const bgImg = style.backgroundImage;
    const bgRgb = (bgImg && bgImg !== 'none')
      ? sampleGradientMidpoint(bgImg)
      : parseCssColor(style.backgroundColor);
    if (bgRgb) {
      pdf.setFillColor(bgRgb[0], bgRgb[1], bgRgb[2]);
      pdfRoundedRect(pdf, x, y, w, h, radii, uniform, 'F');
    }

    // ── Borders ───────────────────────────────────────────────────────────────
    // A uniform border is stroked as one rect/path (so a radius is honoured); a
    // divider (border-top only) or mixed border fills per edge. Colours keep their
    // alpha via GState (jsPDF GState is sticky, so withPdfAlpha resets it).
    const bSide = (wVal: string, cVal: string) => {
      const bw = parseFloat(wVal) || 0;
      return { bw, rgb: bw > 0 ? parseCssColorFull(cVal) : null };
    };
    const bT = bSide(style.borderTopWidth,    style.borderTopColor);
    const bR = bSide(style.borderRightWidth,  style.borderRightColor);
    const bB = bSide(style.borderBottomWidth, style.borderBottomColor);
    const bL = bSide(style.borderLeftWidth,   style.borderLeftColor);
    const eqRgb = (a: Rgba | null, b: Rgba | null) =>
      Boolean(a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]);
    const uniformBorder = bT.rgb && bT.bw === bR.bw && bT.bw === bB.bw && bT.bw === bL.bw
      && eqRgb(bT.rgb, bR.rgb) && eqRgb(bT.rgb, bB.rgb) && eqRgb(bT.rgb, bL.rgb);
    if (uniformBorder && bT.rgb) {
      const rgb = bT.rgb;
      const lw = bT.bw * scaleY;
      pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
      pdf.setLineWidth(lw);
      // CSS border-box: the border sits inside w×h; jsPDF strokes centred, so inset by lw/2.
      const innerUniform: CornerPair | null = uniform ? [Math.max(0, uniform[0] - lw / 2), Math.max(0, uniform[1] - lw / 2)] : null;
      withPdfAlpha(pdf, rgb[3], () =>
        pdfRoundedRect(pdf, x + lw / 2, y + lw / 2, w - lw, h - lw,
          insetCorners(radii, lw / 2), innerUniform, 'S'));
    } else {
      const edge = (rgb: Rgba, dx: number, dy: number, ew: number, eh: number) => withPdfAlpha(pdf, rgb[3], () => {
        pdf.setFillColor(rgb[0], rgb[1], rgb[2]); pdf.rect(dx, dy, ew, eh, 'F');
      });
      if (bT.rgb) edge(bT.rgb, x, y, w, bT.bw * scaleY);
      if (bB.rgb) edge(bB.rgb, x, y + h - bB.bw * scaleY, w, bB.bw * scaleY);
      if (bL.rgb) edge(bL.rgb, x, y, bL.bw * scaleX, h);
      if (bR.rgb) edge(bR.rgb, x + w - bR.bw * scaleX, y, bR.bw * scaleX, h);
    }

    // ── SVG subtree → vector region (or raster for gradient illustrations) ─────
    if (tag === 'svg' && el instanceof SVGElement) {
      // Gradient / filter illustrations (e.g. the bag-video Geeko) can't be
      // reproduced by the vector walker: drawSvgVectorsInRegion has no axial /
      // radial shading and reads fills only from attributes or inline style, so
      // url(#gradient) fills disappear and CSS-class fills (declared in an inner
      // <style>) fall back to black — a solid silhouette. The SVG export keeps
      // these vector by cloning the node verbatim; for PDF we rasterise just this
      // subtree to a PNG (alpha preserved) so it keeps its shading, and reserve
      // the crisp vector walk for solid-fill SVGs (qr, lockup, …).
      if (el.querySelector('linearGradient, radialGradient, filter, pattern')) {
        try {
          // Resolution from the OUTPUT region (points → px at ~150dpi), not the
          // on-screen box — so it's independent of the preview zoom and bounded.
          const dpr = 150 / 72;
          const pxW = Math.max(2, Math.min(2000, Math.round(w * dpr)));
          const pxH = Math.max(2, Math.min(2000, Math.round(h * dpr)));
          // Honour a scaleX(-1) flip (computed transform's matrix a-component < 0).
          const tm = String(style.transform || '').match(/matrix\(\s*(-?[\d.]+)/);
          const flipX = tm?.[1] !== undefined ? parseFloat(tm[1]) < 0 : el.classList.contains('flip');
          const png = await rasterizeSvgElement(el, pxW, pxH, flipX);
          pdf.addImage(png, 'PNG', x, y, w, h);
          return;
        } catch { /* fall through to the vector walk */ }
      }
      await drawSvgVectorsInRegion(pdf, el, x, y, w, h, registeredFonts);
      return;
    }

    // ── Image (raster, or inlined SVG → vectors) ──────────────────────────────
    if (el instanceof HTMLImageElement) {
      const src = el.src || el.getAttribute('src') || '';
      if (!src || w <= 0 || h <= 0) return;

      // SVG images (e.g. the corner brand logo) must stay VECTOR — rasterising
      // them breaks true CMYK output and looks soft. Inline the SVG and draw it
      // through the same vector path as an inline <svg>, honouring object-fit:
      // "cover" slice-fits (fills the box, clipping the overflow — e.g. an SVG
      // hero/masthead), everything else "meet"-fits (whole mark, centred = contain).
      // SVG-ness is detected from the bytes (asset URLs are blob: with no hint).
      {
        let svgEl2: SVGSVGElement | null = null;
        try {
          svgEl2 = await inlineSvgFromImg(src);
          if (svgEl2) {
            // Off-screen so viewBox.baseVal + any computed fills resolve.
            svgEl2.setAttribute('style', `position:absolute;left:-99999px;top:0;width:${Math.round(rect.width)}px;height:${Math.round(rect.height)}px`);
            document.body.appendChild(svgEl2);
            const vb2 = svgEl2.viewBox.baseVal;
            const vbW2 = (vb2 && vb2.width  > 0) ? vb2.width  : rect.width;
            const vbH2 = (vb2 && vb2.height > 0) ? vb2.height : rect.height;
            const cover = style.objectFit === 'cover';
            const s = cover ? Math.max(w / vbW2, h / vbH2) : Math.min(w / vbW2, h / vbH2);
            const fw = vbW2 * s, fh = vbH2 * s;
            const [px, py] = objectPositionFractions(style.objectPosition);
            const dx = x + (w - fw) * px, dy = y + (h - fh) * py;
            const inner = svgEl2;
            if (cover) {
              await withPdfClipRect(pdf, x, y, w, h, () => drawSvgVectorsInRegion(pdf, inner, dx, dy, fw, fh, registeredFonts));
            } else {
              await drawSvgVectorsInRegion(pdf, inner, dx, dy, fw, fh, registeredFonts);
            }
          }
        } catch { /* fall through to the raster path */ }
        finally { svgEl2?.remove(); }
        if (svgEl2) return;
      }

      {
        try {
          const dataUrl0 = src.startsWith('data:') ? src
            : src.startsWith('blob:') ? await blobToDataUrl(src) : src;
          // Bake any CSS filter() into the bitmap (browser canvas) so PDF matches
          // screen/PNG; no-op + graceful fallback when filter is none.
          const dataUrl = await bakeImageFilter(el, dataUrl0, style.filter);

          // Clip circular images (headshots with border-radius: 50%)
          const rTL = parseCssLen(style.borderTopLeftRadius,     rect.width);
          const rTR = parseCssLen(style.borderTopRightRadius,    rect.width);
          const rBL = parseCssLen(style.borderBottomLeftRadius,  rect.width);
          const rBR = parseCssLen(style.borderBottomRightRadius, rect.width);
          const minR  = Math.min(rTL, rTR, rBL, rBR);
          const halfMin = Math.min(rect.width, rect.height) * 0.45;
          const isCircle = minR >= halfMin;

          // circularClipImage prefers the live (unfiltered) <img>; when a filter was
          // baked, clip the filtered data URL instead so the treatment survives.
          const imgUrl = isCircle
            ? await circularClipImage(style.filter && style.filter !== 'none' ? null : el, dataUrl).catch(() => dataUrl)
            : dataUrl;
          const { src: imgSrc, fmt } = await imageForPdf(imgUrl);
          // Honour object-fit against the image's natural aspect (matches screen/PNG):
          //   contain → meet-fit the whole image into the box, centred (logo-wall tiles);
          //   cover   → fill the box, scaling up by the LARGER ratio and clipping the
          //             overflow (hero/masthead images — see multi-page-pdf);
          //   else    → stretch to the box (the prior default).
          // objectPosition fractions place the fitted image; the same `(box-fit)*frac`
          // offset works for both: it's a positive inset for contain, a negative one
          // (the cropped overflow) for cover.
          const nw = el.naturalWidth || 0, nh = el.naturalHeight || 0;
          const fit = style.objectFit;
          if (!isCircle && (fit === 'contain' || fit === 'cover') && nw > 0 && nh > 0) {
            const r = w / nw, R = h / nh;
            const s = fit === 'cover' ? Math.max(r, R) : Math.min(r, R);
            const fw = nw * s, fh = nh * s;
            const [px, py] = objectPositionFractions(style.objectPosition);
            const dx = x + (w - fw) * px, dy = y + (h - fh) * py;
            if (fit === 'cover') {
              await withPdfClipRect(pdf, x, y, w, h, () => { pdf.addImage(imgSrc, fmt, dx, dy, fw, fh); });
            } else {
              pdf.addImage(imgSrc, fmt, dx, dy, fw, fh);
            }
          } else {
            pdf.addImage(imgSrc, fmt, x, y, w, h);
          }
        } catch { /* skip unloadable images */ }
      }
      return;
    }

    // ── Recurse into block-level children only ────────────────────────────────
    // Inline children (<strong>, <em>, <span> …) are intentionally skipped here.
    // Their content is rendered by renderInlineContent below, where each fragment
    // gets its own computed style (preserving bold, color, etc.).
    for (const child of el.children) {
      const cd = window.getComputedStyle(child).display;
      if (cd === 'inline' || cd === 'inline-block' || cd === 'inline-flex') continue;
      await visit(child);
    }

    // ── Inline text content ───────────────────────────────────────────────────
    await renderInlineContent(pdf, el, style, rootRect, scaleX, scaleY, cssToPt, registeredFonts, convertPaths, host);

    // ── CSS generated content (::before/::after markers) ──────────────────────
    await pdfPseudoContent(pdf, el, rootRect, scaleX, scaleY, cssToPt, registeredFonts, convertPaths, host);
  }

  await visit(node);
}

// Walks text nodes and inline elements within blockEl, rendering each fragment
// at its own getBoundingClientRect position with its own computed style.
// This preserves inline formatting (<strong> bold, <em> italic, color spans, etc.)
// that would be lost by reading the block's innerText as a flat string.
//
// Block-level children are skipped — the main visit() loop already handles them.
// <br> is skipped — the line break is implicit in the text nodes' y positions.
async function renderInlineContent(
  pdf: jsPDF, blockEl: Element, blockStyle: CSSStyleDeclaration, rootRect: RootRect,
  scaleX: number, scaleY: number, cssToPt: number, registeredFonts: Set<string>,
  convertPaths: boolean, host: HostV1 | null,
): Promise<void> {
  async function walk(node: Node, nodeStyle: CSSStyleDeclaration): Promise<void> {
    if (node instanceof Text) {
      const text = node.textContent;
      if (!text || !text.trim()) return;

      // Set font (color, size, SUSE embedding) first — feeds the <text> fallback.
      await applyPdfTextStyle(pdf, nodeStyle, cssToPt, registeredFonts);

      const fontSizePx = parseFloat(nodeStyle.fontSize) || 16;
      const fontUrl = resolveSuseFontUrl(nodeStyle);
      const textApi = host?.text;
      const outline = convertPaths && fontUrl != null && Boolean(textApi)
        && canVectoriseText(nodeStyle, fontUrl, true);
      const textRgb = parseCssColor(nodeStyle.color) || [0, 0, 0];
      const ascentPt = fontMetricsPx(nodeStyle, fontSizePx).ascent * cssToPt;

      // Use the browser's actual line breaks + per-line positions (exact match to
      // on-screen and the SVG output), NOT jsPDF's splitTextToSize — which re-measures
      // with the embedded font's metrics and can wrap a word a character or two early
      // when they differ slightly from the browser's. 'Convert paths' ON outlines each
      // line via host.text.toPath; OFF (or any shape failure) draws embedded pdf.text
      // at the same position, so output is never worse than before.
      const segs = text.split('\n');
      let offset = 0;
      for (const seg of segs) {
        if (seg.trim().length > 0) {
          for (const line of visualLines(node, offset, offset + seg.length)) {
            const r = line.rect;
            if (r.width < 0.5 || r.height < 0.5) continue;
            const x = (r.left - rootRect.left) * scaleX;
            const top = (r.top - rootRect.top) * scaleY;
            const shown = applyTextTransform(line.text, nodeStyle.textTransform);
            let drawn = false;
            if (outline && textApi && fontUrl != null) {
              try {
                const { d } = await textApi.toPath({ text: shown, fontUrl, fontSize: fontSizePx });
                if (d) {
                  pdf.setFillColor(textRgb[0], textRgb[1], textRgb[2]);
                  drawSvgPathToPdf(pdf, d,
                    sx => x + sx * cssToPt,
                    sy => top + ascentPt + sy * cssToPt);
                  pdf.fill();
                  drawn = true;
                }
              } catch (e) {
                host?.log('warn', `pdf: text-to-path failed, using embedded text — ${errMsg(e)}`);
              }
            }
            if (!drawn) pdf.text(shown, x, top, { baseline: 'top' });
          }
        }
        offset += seg.length + 1; // +1 for the '\n'
      }

    } else if (node instanceof Element) {
      if (node.tagName.toLowerCase() === 'br') return;
      const s = window.getComputedStyle(node);
      if (s.display === 'none') return;
      // Only descend into inline-level elements; block children are visited by
      // the main visit() loop.
      if (s.display !== 'inline' && s.display !== 'inline-block' && s.display !== 'inline-flex') return;
      for (const child of node.childNodes) await walk(child, s);
    }
  }

  for (const child of blockEl.childNodes) await walk(child, blockStyle);
}

// Emit any ::before/::after markers of `el` into the PDF (mirrors svgPseudoContent).
async function pdfPseudoContent(
  pdf: jsPDF, el: Element, rootRect: RootRect, scaleX: number, scaleY: number,
  cssToPt: number, registeredFonts: Set<string>, convertPaths: boolean, host: HostV1 | null,
): Promise<void> {
  for (const name of ['::before', '::after'] as const) {
    const ds = pseudoDescriptor(el, name);
    if (!ds) continue;
    const x = (ds.x - rootRect.left) * scaleX;
    const y = (ds.y - rootRect.top)  * scaleY;
    if (ds.bg && ds.w > 0.5 && ds.h > 0.5) {
      const w = ds.w * scaleX, h = ds.h * scaleY;
      const radii: CornerRadii = {
        topLeft:     [ds.radii.topLeft[0]     * scaleX, ds.radii.topLeft[1]     * scaleY],
        topRight:    [ds.radii.topRight[0]    * scaleX, ds.radii.topRight[1]    * scaleY],
        bottomRight: [ds.radii.bottomRight[0] * scaleX, ds.radii.bottomRight[1] * scaleY],
        bottomLeft:  [ds.radii.bottomLeft[0]  * scaleX, ds.radii.bottomLeft[1]  * scaleY],
      };
      const uniform: CornerPair | null = ds.uniform ? [ds.uniform[0] * scaleX, ds.uniform[1] * scaleY] : null;
      pdf.setFillColor(ds.bg[0], ds.bg[1], ds.bg[2]);
      pdfRoundedRect(pdf, x, y, w, h, radii, uniform, 'F');
    }
    if (!ds.text.trim()) continue;
    const fontSizePx = parseFloat(ds.ps.fontSize) || 16;
    const fontUrl = resolveSuseFontUrl(ds.ps);
    const textRgb = parseCssColor(ds.ps.color) || [0, 0, 0];
    let drawn = false;
    const textApi = host?.text;
    if (convertPaths && textApi && fontUrl != null && canVectoriseText(ds.ps, fontUrl, true)) {
      try {
        const { d } = await textApi.toPath({ text: ds.text, fontUrl, fontSize: fontSizePx });
        if (d) {
          const ascentPt = fontMetricsPx(ds.ps, fontSizePx).ascent * cssToPt;
          pdf.setFillColor(textRgb[0], textRgb[1], textRgb[2]);
          drawSvgPathToPdf(pdf, d, sx => x + sx * cssToPt, sy => y + ascentPt + sy * cssToPt);
          pdf.fill();
          drawn = true;
        }
      } catch (e) { host?.log('warn', `pdf: pseudo text-to-path failed — ${errMsg(e)}`); }
    }
    if (!drawn) {
      await applyPdfTextStyle(pdf, ds.ps, cssToPt, registeredFonts);
      pdf.text(ds.text, x, y, { baseline: 'top' });
    }
  }
}

// Sets jsPDF text color, font size, and font family from a computed style object.
// Embeds the SUSE TTF for the required weight/style if needed.
async function applyPdfTextStyle(pdf: jsPDF, style: CSSStyleDeclaration, cssToPt: number, registeredFonts: Set<string>): Promise<void> {
  const textRgb = parseCssColor(style.color) || [0, 0, 0];
  pdf.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
  const pdfSize = parseFloat(style.fontSize) * cssToPt;
  pdf.setFontSize(pdfSize);
  const weight = parseInt(style.fontWeight) || 400;
  const italic  = style.fontStyle === 'italic' || style.fontStyle === 'oblique';
  const family  = (style.fontFamily || '').toLowerCase();
  if (family.includes('suse')) {
    const suseStyle = await embedSuseFont(pdf, registeredFonts, weight, italic);
    if (suseStyle) { pdf.setFont('SUSE', suseStyle); return; }
  }
  const fallback = weight >= 600 ? (italic ? 'bolditalic' : 'bold') : (italic ? 'italic' : 'normal');
  pdf.setFont('helvetica', fallback);
}

// ── SUSE font embedding ───────────────────────────────────────────────────────

// Module-level cache: font URL → base64 string. Survives across export calls
// within a session so the TTF files are fetched at most once.
const _fontBase64Cache = new Map<string, string>();

async function loadFontBase64(url: string): Promise<string> {
  const cached = _fontBase64Cache.get(url);
  if (cached !== undefined) return cached;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Font fetch failed: ${url}`);
  const buf = await resp.arrayBuffer();
  // FileReader is the safest way to base64-encode arbitrary binary in a browser.
  // btoa(String.fromCharCode(...uint8)) blows the stack on large font files.
  const b64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(new Blob([buf]));
  });
  _fontBase64Cache.set(url, b64);
  return b64;
}

// Embeds a SUSE weight+style variant into the jsPDF instance and returns the
// jsPDF fontStyle key to use with pdf.setFont('SUSE', key).
// registeredFonts is a per-PDF-instance Set that avoids re-registering.
// Font-file naming is shared with the SVG path emitter (text-svg.ts) so the two
// export paths never resolve the same weight to different files.
async function embedSuseFont(pdf: jsPDF, registeredFonts: Set<string>, weight: number, italic: boolean): Promise<string | null> {
  const style = italic ? `wi${weight}` : `w${weight}`;
  if (!registeredFonts.has(style)) {
    const file = suseFontFile(weight, italic);
    const url  = SUSE_FONT_DIR + file;
    try {
      const b64 = await loadFontBase64(url);
      pdf.addFileToVFS(file, b64);
      pdf.addFont(file, 'SUSE', style);
      registeredFonts.add(style);
    } catch {
      return null; // fetch failed; caller falls back to helvetica
    }
  }
  return style;
}

// ── Image format resolution for jsPDF.addImage ────────────────────────────────

// Pick the jsPDF.addImage format from a data: URL's REAL MIME (the previous
// `.includes('image/png')` guess silently misclassified WebP/AVIF/GIF user images
// as PNG, so jsPDF dropped them). PNG/JPEG/WebP are passed through as the formats
// jsPDF accepts; anything else jsPDF can't embed (AVIF/GIF/BMP…) is rasterised to
// PNG via a canvas first. Non-data / unrecognised sources keep the old PNG fallback.
async function imageForPdf(src: string): Promise<{ src: string; fmt: 'PNG' | 'JPEG' | 'WEBP' }> {
  const mime = (/^data:([^;,]+)/i.exec(src)?.[1] || '').toLowerCase();
  if (mime === 'image/png')  return { src, fmt: 'PNG' };
  if (mime === 'image/jpeg' || mime === 'image/jpg') return { src, fmt: 'JPEG' };
  if (mime === 'image/webp') return { src, fmt: 'WEBP' };
  if (mime.startsWith('image/')) {
    try { return { src: await rasterizeToPng(src), fmt: 'PNG' }; }
    catch { return { src, fmt: 'PNG' }; }
  }
  return { src, fmt: 'PNG' };
}

// Decode any image source the browser understands and re-encode it as a PNG data
// URL, so a format jsPDF can't embed natively can still be placed.
async function rasterizeToPng(src: string): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const canvas = document.createElement('canvas');
  canvas.width  = img.naturalWidth  || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PNG rasterise needs a 2D canvas context');
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}

export const pdfAdapter: FormatAdapter = {
  formats: ['pdf'],
  render(ctx: RenderContext): Promise<Blob> {
    return renderPdf(ctx.node, ctx.opts, ctx.host);
  },
};
