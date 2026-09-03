// SPDX-License-Identifier: MPL-2.0
/**
 * PDF redaction for the Node shells (host.pdf.redact) - rasterise-and-rebuild.
 *
 * The Node twin of shells/web/src/bridge/pdf-redact.ts, and deliberately the
 * same shape: render every page with the app's OWN interpreter (pdf-pages.ts
 * openPdfForRender → the engine's interpretPdfPage + pdfNodesToSvg, never an
 * external PDF renderer), burn the bars in as fully opaque fills, and construct
 * a BRAND-NEW pdf-lib document whose pages contain only those images. Nothing is
 * copied from the source, so covered text, fonts, annotations, attachments,
 * layers, scripts and metadata cannot survive by construction.
 *
 * WHAT IS SHARED, and why that matters: every number - the DPI clamp, the
 * point→pixel bar mapping, the radius inflation, the stamp layout, the
 * grayscale weights, the rebuild - comes from pdf-redact-core.ts, which both
 * halves import. So a bar burned here covers exactly the pixels the browser
 * would have covered, at the same page raster size. Only the plumbing differs:
 * resvg rasterises the page SVG (the same Tier-A rasteriser every other
 * browser-free export uses) and @napi-rs/canvas paints the bars.
 *
 * Attachment is conditional. `createNodePdfRedact()` returns null when
 * @napi-rs/canvas is absent, and the caller must then leave `pdf.redact`
 * undefined - the contract's own "this shell cannot" signal, which a tool
 * feature-detects.
 */
import type { PdfPagesResult, PdfRedactOpts, PdfRedactResult } from '@lolly-tools/core/host-v1';
import {
  BAR_INFLATE_PX,
  buildImagePdf, barToPixels, clampDpi, clampMaxPages, collectPages, grayscaleInPlace,
} from './pdf-redact-core.ts';
import type { PixelRect, RedactedPageImage } from './pdf-redact-core.ts';
import { openPdfForRender } from './pdf-pages.ts';
import { isCanvasAvailable, nodeCanvas } from './canvas.ts';
import { paintBars } from './image-redact.ts';
import { rasterizeSvgToRgba } from './raster.ts';

/** JPEG quality for the rebuilt page images - the web half's exact number. */
const PAGE_JPEG_QUALITY = 92;

/**
 * host.pdf.pages - each page as a self-contained SVG document, the preview a
 * bar-drawing surface measures against. Same recipe as redactPdf's per-page
 * render, but the SVG string IS the product: no raster, no JPEG. The viewBox is
 * in PDF points with the origin TOP-LEFT, the exact space PdfRedactBar lives in.
 *
 * A page that fails to render is SKIPPED but reported in `failed`, so a missing
 * preview never passes silently; when every page fails this throws, so a caller
 * shows its render-failure state rather than "previews aren't available here".
 */
export async function pdfPages(bytes: Uint8Array, opts?: { maxPages?: number }): Promise<PdfPagesResult> {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const maxPages = clampMaxPages(opts?.maxPages);
  const handle = await openPdfForRender(input);

  const res = await collectPages(handle.sizes.length, maxPages, async (i) => {
    // Several page SVGs can land in one document - the ids must not collide.
    const page = await handle.pageToSvg(i, { idPrefix: `rdpg${i}-`, dedupePaths: true });
    return { svg: page.svg, page: page.page, widthPt: page.widthPt, heightPt: page.heightPt };
  });
  if (!res.pages.length) {
    throw new Error('None of the pages in this PDF could be rendered. It may be encrypted or damaged.');
  }
  return { pages: res.pages, truncated: res.truncated, ...(res.failed.length ? { failed: res.failed } : {}) };
}

/** host.pdf.redact - the rasterise-and-rebuild pass. See the module header. */
export async function redactPdf(bytes: Uint8Array, opts: PdfRedactOpts): Promise<PdfRedactResult> {
  const mod = await nodeCanvas();
  if (!mod) throw new Error('PDF redaction needs a canvas, which this install does not provide.');
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dpi = clampDpi(opts?.dpi);
  const bars = Array.isArray(opts?.bars) ? opts.bars : [];

  // Page sizes come from the ORIGINAL MediaBoxes - the rebuilt document must
  // reproduce them exactly, in points.
  const handle = await openPdfForRender(input);
  const sizes = handle.sizes;

  const warnings: string[] = [];
  const pages: RedactedPageImage[] = [];
  for (let i = 0; i < sizes.length; i++) {
    const { width: wPt, height: hPt } = sizes[i]!;
    const cw = Math.max(1, Math.round((wPt * dpi) / 72));
    const ch = Math.max(1, Math.round((hPt * dpi) / 72));
    const canvas = mod.createCanvas(cw, ch);
    const cx = canvas.getContext('2d');
    // Opaque white first: kills alpha-hidden content and lets the JPEG encode be
    // unconditional (no transparency to preserve).
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, cw, ch);
    try {
      // The page SVG paints its own white plate too, so the raster is opaque and
      // resvg's straight-alpha bytes drop straight in with no compositing pass.
      const page = await handle.pageToSvg(i, { idPrefix: `redact${i}-`, background: '#ffffff', dedupePaths: true });
      const raster = await rasterizeSvgToRgba(page.svg, cw, ch);
      const px = new Uint8ClampedArray(raster.data.buffer, raster.data.byteOffset, raster.data.byteLength);
      cx.putImageData(new mod.ImageData(px, raster.width, raster.height), 0, 0);
    } catch {
      warnings.push(`Page ${i + 1} could not be rendered. It ships as a blank page with its bars burned in.`);
    }
    // Grayscale BEFORE the bars, not after: "scanned page" mode is about the
    // source's colour (the yellow channel colour lasers hide tracking dots in),
    // and the bars are our own mark, not source content.
    if (opts?.grayscale) {
      const img = cx.getImageData(0, 0, cw, ch);
      grayscaleInPlace(img.data);
      cx.putImageData(img, 0, 0);
    }
    // Bars for THIS page, mapped from points into this raster. The mark itself is
    // painted by image-redact.ts's shared painter, so a bar on a page and a bar on
    // a photo can never differ in shape, colour or stamp placement. Radius and the
    // stamp cap convert from points to device pixels here, where the DPI is known.
    const rects: PixelRect[] = [];
    for (const bar of bars) {
      if (Math.floor(Number(bar?.page)) !== i + 1) continue;
      const r = barToPixels(bar, dpi, cw, ch);
      if (r) rects.push(r);
    }
    paintBars(cx, rects, {
      color: opts?.color,
      labelColor: opts?.labelColor,
      radius: Math.max(0, Math.round(((Number(opts?.radius) || 0) * dpi) / 72)),
      label: String(opts?.label || '').trim(),
      labelMaxSize: Math.round((14 * dpi) / 72),
    }, cw, ch);
    const jpeg = canvas.toBuffer('image/jpeg', PAGE_JPEG_QUALITY);
    if (!jpeg?.length) throw new Error(`Page ${i + 1} could not be encoded as an image.`);
    pages.push({ jpeg: new Uint8Array(jpeg.buffer, jpeg.byteOffset, jpeg.byteLength), widthPt: wPt, heightPt: hPt });
  }

  const out = await buildImagePdf(pages);
  return { bytes: out, pages: sizes.length, ...(warnings.length ? { warnings } : {}) };
}

/** The two optional PdfAPI members this module implements, or null when there is
 *  no canvas here. A shell attaches what it gets and omits the rest. */
export function createNodePdfRedact(): {
  redact: (bytes: Uint8Array, opts: PdfRedactOpts) => Promise<PdfRedactResult>;
  pages: (bytes: Uint8Array, opts?: { maxPages?: number }) => Promise<PdfPagesResult>;
} | null {
  if (!isCanvasAvailable()) return null;
  return { redact: redactPdf, pages: pdfPages };
}

export { BAR_INFLATE_PX };
