// SPDX-License-Identifier: MPL-2.0
/**
 * Raster export via dom-to-image-more: PNG/JPEG (with DPI + provenance + ICC
 * stamped into the encoded bytes) and WebP/AVIF (canvas-encoded).
 */

import { iccProfileBytes } from '@lolly/engine';
import {
  getDomToImage, exportDims, rasterStyle, swapBlobUrls, normalizeCanvas,
} from './dom.ts';
import {
  insertPngPhys, insertPngMeta, insertPngIcc,
  patchJpegDpi, insertJpegExif, insertJpegIcc,
} from './metadata.ts';
import type { FormatAdapter, RenderContext, ExportOptions } from './types.ts';

// Embed a colour profile when one is requested (default 'srgb') and this isn't a
// thumbnail.
function iccWanted(opts: ExportOptions): boolean {
  return opts.colorProfile !== 'none' && !opts.thumbnail;
}

async function renderRaster(node: HTMLElement, format: 'png' | 'jpeg', opts: ExportOptions): Promise<Blob> {
  const lib = await getDomToImage();
  const d = exportDims(node, opts);
  const dtoOpts = rasterStyle(d, opts);
  // Mutate blob: URLs to data URLs on the live node so dom-to-image-more can
  // serialise them inside the SVG foreignObject. Restore immediately after so
  // the canvas stays clean. The live node MUST be passed (not a clone) so that
  // dom-to-image reads computed styles from elements that are in the document.
  const restore = await swapBlobUrls(node);
  try {
    const dataUrl = await (format === 'jpeg'
      ? lib.toJpeg(node, { quality: opts.quality ?? 0.92, ...dtoOpts })
      : lib.toPng(node, dtoOpts));
    const res = await fetch(dataUrl);
    let blob = await res.blob();
    // Stamp the DPI (physical size) + provenance metadata + colour profile in a
    // SINGLE parse/serialise cycle: read the encoded bytes once, splice every
    // chunk/segment in order, rebuild the Blob once. Insertion order is preserved,
    // so the output is byte-identical to the previous per-stamp round-trips.
    const icc = iccWanted(opts) ? iccProfileBytes(opts.colorProfile) : null;
    if (format === 'png' && (d.dpi > 0 || opts.meta || icc)) {
      let bytes: Uint8Array = new Uint8Array(await blob.arrayBuffer());
      if (d.dpi > 0) bytes = insertPngPhys(bytes, d.dpi) ?? bytes;
      bytes = insertPngMeta(bytes, opts.meta);
      if (icc) bytes = await insertPngIcc(bytes, icc);
      blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
    } else if (format === 'jpeg' && (d.dpi > 0 || opts.meta || icc)) {
      let bytes: Uint8Array = new Uint8Array(await blob.arrayBuffer());
      bytes = patchJpegDpi(bytes, d.dpi);
      bytes = insertJpegExif(bytes, opts.meta);
      if (icc) bytes = insertJpegIcc(bytes, icc);
      blob = new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });
    }
    return blob;
  } finally {
    restore();
  }
}

async function renderBitmap(node: HTMLElement, mimeType: string, opts: ExportOptions): Promise<Blob> {
  const lib = await getDomToImage();
  const d = exportDims(node, opts);
  const dtoOpts = rasterStyle(d, opts);
  const restore = await swapBlobUrls(node);
  let raw: HTMLCanvasElement;
  try {
    raw = await lib.toCanvas(node, dtoOpts);
  } finally {
    restore();
  }
  const canvas = normalizeCanvas(raw, dtoOpts.width, dtoOpts.height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error(`Encoding failed for ${mimeType}`)),
      mimeType,
      opts.quality ?? 0.9,
    );
  });
}

export const rasterAdapter: FormatAdapter = {
  formats: ['png', 'jpg', 'jpeg', 'webp', 'avif'],
  render(ctx: RenderContext): Promise<Blob> {
    switch (ctx.format) {
      case 'png':  return renderRaster(ctx.node, 'png', ctx.opts);
      case 'jpg':
      case 'jpeg': return renderRaster(ctx.node, 'jpeg', ctx.opts);
      case 'webp': return renderBitmap(ctx.node, 'image/webp', ctx.opts);
      default:     return renderBitmap(ctx.node, 'image/avif', ctx.opts);
    }
  },
};
