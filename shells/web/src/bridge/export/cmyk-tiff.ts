// SPDX-License-Identifier: MPL-2.0
/**
 * DeviceCMYK TIFF export (print-ready).
 *
 * A print-grade CMYK TIFF, written by hand (no browser TIFF encoder exists; this
 * is the same hand-rolled-binary approach used for PNG chunks / EXIF / ICC). The
 * canvas is rasterised like the other raster formats, its sRGB pixels converted
 * per-pixel to *device* CMYK via the engine's rgbToCmyk (Path 1: no ICC transform,
 * no brand-palette substitution — incidental colours only), stored uncompressed in
 * a single strip.
 *
 * Print finishing mirrors the Print PDF, on the same engine geometry
 * (computePrintGeometry): when bleed/marks are requested the design is stretched to
 * COVER the bleed box on an enlarged white sheet, and the crop / bleed / registration
 * marks + colour bar are rasterised straight into the CMYK buffer AFTER the
 * conversion — so the line marks land on every plate (C=M=Y=K=255, the raster
 * analogue of the PDF's 1 1 1 1 registration ink) instead of being remapped by the
 * naive per-pixel pass. The bar is the generic process/overprint/tint control strip
 * (the raster does no exact substitution, so there's nothing to verify).
 *
 * Deliberately untagged DeviceCMYK: there is NO embedded output profile (a real
 * profile over the naive conversion would mislabel the file). The chosen press
 * condition is recorded only as provenance in ImageDescription — naming the intended
 * viewing condition without claiming colour management. A colour-managed variant
 * (real ICC separation + embedded press profile) is a separate, heavier project —
 * see capabilities.ts cmykTiffSupport, which keeps the format off environments where
 * it can't be produced or delivered.
 */

import {
  getDomToImage, exportDims, swapBlobUrls, normalizeCanvas, rasterStyle, coverRasterStyle,
} from './dom.ts';
import { printGeometry, provenanceLabels, pressConditionLabel } from './print-geometry.ts';
import { rgbaToDeviceCmyk, drawPrintMarksCmyk, encodeCmykTiff } from './print-marks-cmyk.ts';
import type { FormatAdapter, RenderContext, ExportOptions } from './types.ts';

async function renderCmykTiff(node: HTMLElement, opts: ExportOptions): Promise<Blob> {
  const lib = await getDomToImage();
  const d = exportDims(node, opts);
  // Print finishing geometry — same engine source of truth as the PDF path. Pass
  // no palette: the raster is a flat per-pixel conversion with no exact brand
  // substitution to verify, so the colour bar stays the generic control strip.
  const geo = printGeometry(node, opts, []);
  const ptPx  = (v: number) => Math.round(v * d.dpi / 72);   // points → device px (offset)
  const ptDim = (v: number) => Math.max(1, ptPx(v));         // points → device px (size)

  const restore = await swapBlobUrls(node);
  let artCanvas: HTMLCanvasElement;
  try {
    // With geometry the design is stretched to COVER the bleed box (mirrors the
    // PDF's scale-to-bleed); without it, the plain trim-size raster as before.
    const dtoOpts = geo
      ? coverRasterStyle(d, opts, ptDim(geo.artwork.w), ptDim(geo.artwork.h))
      : rasterStyle(d, opts);
    const raw = await lib.toCanvas(node, dtoOpts);
    artCanvas = normalizeCanvas(raw, dtoOpts.width, dtoOpts.height);
  } finally {
    restore();
  }

  // Compose the artwork onto the full white sheet (print stock) when there's a margin.
  let canvas = artCanvas;
  if (geo) {
    const sheet = document.createElement('canvas');
    sheet.width  = ptDim(geo.page.w);
    sheet.height = ptDim(geo.page.h);
    const sctx = sheet.getContext('2d', { willReadFrequently: true });
    if (!sctx) throw new Error('CMYK TIFF export needs a 2D canvas context');
    sctx.fillStyle = '#ffffff';
    sctx.fillRect(0, 0, sheet.width, sheet.height);
    sctx.drawImage(artCanvas, ptPx(geo.artwork.x), ptPx(geo.artwork.y), ptDim(geo.artwork.w), ptDim(geo.artwork.h));
    canvas = sheet;
  }

  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('CMYK TIFF export needs a 2D canvas context');
  const rgba = ctx.getImageData(0, 0, W, H).data;   // sRGB, straight (un-premultiplied)
  const cmyk = await rgbaToDeviceCmyk(rgba, W, H, opts.onProgress);

  // Marks drawn AFTER conversion → registration/crop/bleed land on every plate;
  // provenance credit text is composited as K-only ink (see drawPrintMarksCmyk).
  if (geo) drawPrintMarksCmyk(cmyk, W, H, geo, d.dpi, provenanceLabels(opts.meta));

  const tiff = encodeCmykTiff(cmyk, W, H, d.dpi, opts.meta, pressConditionLabel(opts.colorProfile));
  return new Blob([new Uint8Array(tiff)], { type: 'image/tiff' });
}

export const cmykTiffAdapter: FormatAdapter = {
  formats: ['cmyk-tiff'],
  render(ctx: RenderContext): Promise<Blob> {
    return renderCmykTiff(ctx.node, ctx.opts);
  },
};
