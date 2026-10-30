// SPDX-License-Identifier: MPL-2.0
/**
 * The pixel box a raster export is drawn at, and how dom-to-image scales the live node
 * into that box. Moved verbatim from export.ts so the Design export route (export-route.ts,
 * plan 326) sizes its GPU pixels with the same arithmetic as the browser renderer.
 */
import { toPixels } from '@lolly/engine';
import { RASTER_DEFAULT_SCALE } from './export-scale.ts';
import { applyRasterBackdrop } from './export-backdrop.ts';
import type { DtoRenderOpts, ExportDims, ExportOpts } from './export-shared.ts';

// dom-to-image options: render the node at its native CSS size then scale it up
// (via CSS transform) to the target output resolution. The target is the
// requested dimension converted to pixels at the chosen DPI; if none was
// requested we fall back to the canvas at its default 2× scale.
// `root` is the export node: a one-artboard export keeps that page's own fill under a
// transparent request (bridge/export-backdrop.ts).
export function rasterStyle(d: ExportDims, opts: ExportOpts, root?: Element): DtoRenderOpts {
  const requested = (opts.width != null && opts.width !== '') || (opts.height != null && opts.height !== '');
  // The default factor is stated in bridge/export-scale.ts, because preflight has to
  // report the pixel count this line will produce and a second literal is how the
  // two drift apart.
  const scale = opts.scale ?? RASTER_DEFAULT_SCALE;
  const targetW = requested ? toPixels(d.w, d.dpi) : Math.round(d.node.w * scale);
  const targetH = requested ? toPixels(d.h, d.dpi) : Math.round(d.node.h * scale);
  const renderScale = targetW / d.node.w;
  const result: DtoRenderOpts = {
    width: targetW,
    height: targetH,
    style: {
      transform: `scale(${renderScale})`,
      transformOrigin: 'top left',
      width: `${d.node.w}px`,
      height: `${d.node.h}px`,
    },
  };
  applyRasterBackdrop(result, opts.background, root);
  return result;
}

// dom-to-image options that stretch the node to exactly cover a target pixel box
// (the bleed box) - non-uniform scale, matching the PDF's scale-to-bleed. Used by
// the print-finished CMYK TIFF; any transparency is flattened onto the white sheet
// by the CMYK pass, so the background is immaterial here.
export function coverRasterStyle(d: ExportDims, opts: ExportOpts, targetW: number, targetH: number, root?: Element): DtoRenderOpts {
  const result: DtoRenderOpts = {
    width: targetW,
    height: targetH,
    style: {
      transform: `scale(${targetW / d.node.w}, ${targetH / d.node.h})`,
      transformOrigin: 'top left',
      width: `${d.node.w}px`,
      height: `${d.node.h}px`,
    },
  };
  applyRasterBackdrop(result, opts.background, root);
  return result;
}
