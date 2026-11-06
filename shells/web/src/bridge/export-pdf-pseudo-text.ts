// SPDX-License-Identifier: MPL-2.0
/**
 * The PDF walker's pseudo-element text and the live text style both its text paths set,
 * moved here from export.ts with the right-to-left work. export.ts imports from here; this
 * file never imports export.ts.
 */
import type { CornerPair, CornerRadii } from '../../../../engine/src/css-box.ts';
import { hasRtlText } from '@lolly-tools/node-shell/text-bidi';
import { embedResolvedFont } from './export-font-data.ts';
import { parseCssColor } from './export-css.ts';
import type { PdfDoc } from './export-pdf-doc.ts';
import { embedSuseFont, pdfFontEmbed, suseFontName } from './export-pdf-fonts.ts';
import { clipsBackgroundToText } from './export-pdf-text-paint.ts';
import { TEXT_PICTURE_DPI, liveTextWouldGarble, notePicturedText, textPicture, undrawableTextError } from './export-pdf-text-picture.ts';
import { drawSvgPathToPdf, pdfRoundedRect } from './export-pdf-vector.ts';
import { _host, fontMetricsPx } from './export-shared.ts';
import { pseudoDescriptor } from './export-svg-walker.ts';
import { resolveExportFont, extendsChain } from './font-fill.ts';
import { canVectoriseText, textBaselineY } from './text-svg.ts';

type Rgb = [number, number, number];

// What a pictured run shows through its letters when its box has `background-clip: text`:
// the box's own background, placed so a line of the box sees its part of that background.
export function clipOfRun(el: Element | null, r: DOMRect, toLayout: number): NonNullable<Parameters<typeof textPicture>[0]['clip']> | undefined {
  for (let cur = el; cur; cur = cur.parentElement) {
    const s = getComputedStyle(cur);
    if (!clipsBackgroundToText(s)) continue;
    const b = cur.getBoundingClientRect();
    return {
      image: s.backgroundImage,
      size: s.backgroundSize === 'auto' || !s.backgroundSize ? `${b.width * toLayout}px ${b.height * toLayout}px` : s.backgroundSize,
      position: `${(b.left - r.left) * toLayout}px ${(b.top - r.top) * toLayout}px`,
      repeat: s.backgroundRepeat,
    };
  }
  return undefined;
}

// Emit any ::before/::after markers of `el` into the PDF (mirrors svgPseudoContent).
export async function pdfPseudoContent(pdf: PdfDoc, el: Element, rootRect: { left: number; top: number }, scaleX: number, scaleY: number, cssToPt: number, registeredFonts: Set<unknown>, convertPaths: boolean, rasterFallback = true): Promise<void> {
  for (const name of ['::before', '::after']) {
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
    const vf = _host?.text ? await resolveExportFont(ds.ps, ds.text, el) : null;
    const fontUrl = vf?.url ?? null;
    const embedUrl = convertPaths ? null : await pdfFontEmbed(vf);
    const hasResolvedFont = Boolean(vf);
    const textRgb = parseCssColor(ds.ps.color) || ([0, 0, 0] as Rgb);
    // Baseline within the marker's line box (half-leading + ascent), matching the SVG
    // pseudo path's textBaselineY - so a bullet/arrow lines up with the main text (which
    // is now also centred), not riding the top of its box.
    const lineHPx = parseFloat(ds.ps.lineHeight) || fontSizePx * 1.2;
    const { ascent: pAsc, descent: pDesc } = fontMetricsPx(ds.ps, fontSizePx);
    const baselinePt = textBaselineY(ds.y - rootRect.top, lineHPx, pAsc, pDesc) * scaleY;
    let drawn = false;
    const rtl = ds.ps.direction === 'rtl';
    const ordered = rtl || hasRtlText(ds.text);
    const garbled = liveTextWouldGarble(ds.text, rtl);
    // Outline in convert-paths mode, or for a user font live text can't carry faithfully.
    if (canVectoriseText(ds.ps, fontUrl, Boolean(_host?.text)) && (convertPaths || (hasResolvedFont && !embedUrl) || garbled || extendsChain(vf))) {
      try {
        const { d, notdef, advanceWidth } = await _host!.text!.toPath({ text: ds.text, fontUrl: fontUrl!, fontSize: fontSizePx, variations: vf!.variations, fallbackFonts: vf!.fallbacks, ...(ordered ? { direction: rtl ? 'rtl' as const : 'ltr' as const } : {}) });
        if (d && !notdef) {
          const left = rtl ? x + ds.w * scaleX - advanceWidth * cssToPt : x;
          pdf.setFillColor(textRgb[0], textRgb[1], textRgb[2]);
          drawSvgPathToPdf(pdf, d, (sx: number) => left + sx * cssToPt, (sy: number) => baselinePt + sy * cssToPt);
          pdf.fill();
          drawn = true;
        }
      } catch (e) { _host?.log?.('warn', `pdf: pseudo text-to-path failed - ${(e as Error).message}`); }
    }
    if (!drawn) {
      await applyPdfTextStyle(pdf, ds.ps, cssToPt, registeredFonts, embedUrl);
      if (garbled || !pdf.canSetText(ds.text)) {
        const pic = rasterFallback ? await textPicture({ text: ds.text, style: ds.ps, direction: rtl ? 'rtl' : 'ltr', box: { w: ds.w, h: lineHPx }, scale: (TEXT_PICTURE_DPI / 72) * cssToPt }) : null;
        if (!pic) throw undrawableTextError(ds.text);
        pdf.addImage(pic.src, 'PNG', x - pic.pad * cssToPt, y - pic.pad * cssToPt, (pic.w + 2 * pic.pad) * cssToPt, (pic.h + 2 * pic.pad) * cssToPt);
        notePicturedText(pdf, ds.text);
      } else pdf.text(ds.text, x, baselinePt, { baseline: 'alphabetic' });
    }
  }
}

// Sets the text color, font size, and the font to draw pdf.text() with. The
// font is chosen in order: a faithfully-embeddable user font (its sfnt URL,
// pre-decided by pdfFontEmbed) → the SUSE static for the weight/style →
// Helvetica. Embeds whichever it picks into the PDF (once) as a side effect.
export async function applyPdfTextStyle(pdf: PdfDoc, style: CSSStyleDeclaration, cssToPt: number, registeredFonts: Set<unknown>, userEmbedUrl: string | null = null): Promise<void> {
  const textRgb = parseCssColor(style.color) || ([0, 0, 0] as Rgb);
  pdf.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
  const pdfSize = parseFloat(style.fontSize) * cssToPt;
  pdf.setFontSize(pdfSize);
  const weight = parseInt(style.fontWeight, 10) || 400;
  const italic  = style.fontStyle === 'italic' || style.fontStyle === 'oblique';
  const family  = (style.fontFamily || '').toLowerCase();
  if (userEmbedUrl) {
    const name = await embedResolvedFont(pdf, registeredFonts, userEmbedUrl);
    if (name) { pdf.setFont(name, 'normal'); return; }
  }
  if (family.includes('suse')) {
    const mono = family.includes('mono');
    const suseStyle = await embedSuseFont(pdf, registeredFonts, weight, italic, mono);
    if (suseStyle) { pdf.setFont(suseFontName(mono), suseStyle); return; }
  }
  const fallback = weight >= 600 ? (italic ? 'bolditalic' : 'bold') : (italic ? 'italic' : 'normal');
  pdf.setFont('helvetica', fallback);
}
