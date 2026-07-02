// SPDX-License-Identifier: MPL-2.0
/**
 * Shared DOM/raster capture helpers used across the raster, CMYK-TIFF, video,
 * GIF and favicon adapters: the lazily-loaded dom-to-image bridge, export-size
 * resolution, blob:-URL swapping, canvas normalisation, dom-to-image style
 * builders, and the frame source that motion encoders consume.
 */

import { parseDimension, isPhysical, toPixels, CSS_DPI } from '@lolly/engine';
import type { Dimension } from '@lolly/engine';
import type { DomToImage, DomToImageOptions, ExportOptions } from './types.ts';

let domToImageMore: DomToImage | null = null;

export async function getDomToImage(): Promise<DomToImage> {
  if (domToImageMore) return domToImageMore;
  const mod = await import('dom-to-image-more');
  // The package's ESM build exposes the library as the default export (with the
  // same methods also present as named exports for CJS interop); fall back to the
  // namespace itself for a build that publishes it flat.
  const lib: DomToImage = mod.default ?? mod;
  domToImageMore = lib;
  return lib;
}

export interface ExportDims {
  node: { w: number; h: number };
  w: Dimension;
  h: Dimension;
  dpi: number;
  physical: boolean;
}

/**
 * Resolve the requested output size for an export.
 *
 * opts.width / opts.height may be numbers (CSS px) or unit strings ("210mm",
 * "8.5in", "595pt", "800px"); absent falls back to the node's on-screen size.
 * Physical units need a resolution for raster output — opts.dpi wins, else 300
 * (print) when any physical unit is in play, else 96 (CSS). Vector formats
 * (PDF/SVG) ignore the DPI; they convert exactly.
 */
export function exportDims(node: HTMLElement, opts: ExportOptions): ExportDims {
  const r = node.getBoundingClientRect();
  const node_ = { w: r.width || 1, h: r.height || 1 };
  const w = parseDimension(opts.width) ?? { value: node_.w, unit: 'px' as const };
  const h = parseDimension(opts.height) ?? { value: node_.h, unit: 'px' as const };
  const physical = isPhysical(w) || isPhysical(h);
  const dpi = (opts.dpi && opts.dpi > 0) ? opts.dpi : (physical ? 300 : CSS_DPI);
  return { node: node_, w, h, dpi, physical };
}

async function blobToDataUrl(url: string): Promise<string> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export { blobToDataUrl };

// Replaces blob: URLs in-place on the live node and returns a function that
// restores the originals. Used for raster exports so dom-to-image-more receives
// the fully styled live node rather than a detached clone.
export async function swapBlobUrls(node: HTMLElement): Promise<() => void> {
  const swaps: Array<{ el: Element; attr: string; url: string }> = [];
  await Promise.all([...node.querySelectorAll('image, img')].map(async el => {
    for (const attr of ['href', 'src']) {
      const url = el.getAttribute(attr);
      if (url?.startsWith('blob:')) {
        try {
          el.setAttribute(attr, await blobToDataUrl(url));
          swaps.push({ el, attr, url });
        } catch { /* leave as-is */ }
      }
    }
  }));
  return () => swaps.forEach(({ el, attr, url }) => el.setAttribute(attr, url));
}

// Replaces blob: URLs in-place on a detached clone. Used by renderSvg which owns
// its clone and just needs self-contained data URLs in the saved file.
export async function inlineBlobUrlsInEl(el: Element): Promise<void> {
  const candidates = el.querySelectorAll('image, img');
  await Promise.all([...candidates].map(async img => {
    for (const attr of ['href', 'src']) {
      const url = img.getAttribute(attr);
      if (url?.startsWith('blob:')) {
        try {
          img.setAttribute(attr, await blobToDataUrl(url));
        } catch { /* leave as-is; export will degrade gracefully */ }
      }
    }
  }));
}

// Ensures a canvas is exactly w×h logical pixels. dom-to-image-more may return
// a physical-pixel canvas (canvas.width = w * devicePixelRatio) on HiDPI screens,
// which causes toBlob and getImageData to encode/read only a zoomed-in crop.
// Drawing through an intermediate canvas normalises to the requested dimensions.
export function normalizeCanvas(src: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  if (src.width === w && src.height === h) return src;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d')?.drawImage(src, 0, 0, w, h);
  return out;
}

// dom-to-image options: render the node at its native CSS size then scale it up
// (via CSS transform) to the target output resolution. The target is the
// requested dimension converted to pixels at the chosen DPI; if none was
// requested we fall back to the canvas at its default 2× scale.
/** dom-to-image options with the target pixel size resolved (used by normalizeCanvas). */
export type SizedDomToImageOptions = DomToImageOptions & { width: number; height: number };

export function rasterStyle(d: ExportDims, opts: ExportOptions): SizedDomToImageOptions {
  const requested = (opts.width != null && opts.width !== '') || (opts.height != null && opts.height !== '');
  const scale = opts.scale ?? 2;
  const targetW = requested ? toPixels(d.w, d.dpi) : Math.round(d.node.w * scale);
  const targetH = requested ? toPixels(d.h, d.dpi) : Math.round(d.node.h * scale);
  const renderScale = targetW / d.node.w;
  const result: SizedDomToImageOptions = {
    width: targetW,
    height: targetH,
    style: {
      transform: `scale(${renderScale})`,
      transformOrigin: 'top left',
      width: `${d.node.w}px`,
      height: `${d.node.h}px`,
    },
  };
  if (opts.background === 'transparent') {
    if (result.style) result.style.background = 'transparent';
  } else if (opts.background != null) {
    result.bgcolor = opts.background;
  }
  return result;
}

// dom-to-image options that stretch the node to exactly cover a target pixel box
// (the bleed box) — non-uniform scale, matching the PDF's scale-to-bleed. Used by
// the print-finished CMYK TIFF; any transparency is flattened onto the white sheet
// by the CMYK pass, so the background is immaterial here.
export function coverRasterStyle(d: ExportDims, opts: ExportOptions, targetW: number, targetH: number): SizedDomToImageOptions {
  const result: SizedDomToImageOptions = {
    width: targetW,
    height: targetH,
    style: {
      transform: `scale(${targetW / d.node.w}, ${targetH / d.node.h})`,
      transformOrigin: 'top left',
      width: `${d.node.w}px`,
      height: `${d.node.h}px`,
    },
  };
  if (opts.background === 'transparent') { if (result.style) result.style.background = 'transparent'; }
  else if (opts.background != null) result.bgcolor = opts.background;
  return result;
}

export interface FrameSource {
  width: number;
  height: number;
  frame(): Promise<HTMLCanvasElement>;
  dispose(): void;
}

// A FrameSource turns a live DOM node into a sequence of rendered frames that
// share ONE capture timeline. Motion encoders (webm/mp4 via renderVideo, gif via
// renderGif — and favicon/ICO) consume it instead of each re-implementing the
// capture loop.
//
// Capture semantics match the original per-encoder loops: blob: URLs are swapped
// to data URLs once up front (so dom-to-image can inline them), CSS animations get
// `opts.wait` seconds to settle before the first frame, then each frame() renders
// the CURRENT animation state via dom-to-image toCanvas(). Sequential frame() calls
// advance the animation in real time (the await between them is the spacing), so
// every frame is a distinct moment — no duplicate or skipped frames.
export async function createFrameSource(node: HTMLElement, opts: ExportOptions = {}): Promise<FrameSource> {
  const lib = await getDomToImage();
  const { width: nodeW, height: nodeH } = node.getBoundingClientRect();
  const targetW = (typeof opts.width === 'number' && opts.width > 0) ? opts.width : nodeW;
  const targetH = (typeof opts.height === 'number' && opts.height > 0) ? opts.height : nodeH;
  const dtoOpts: DomToImageOptions = {
    width: targetW,
    height: targetH,
    style: {
      transform: `scale(${targetW / nodeW})`,
      transformOrigin: 'top left',
      width: `${nodeW}px`,
      height: `${nodeH}px`,
    },
  };
  const restore = await swapBlobUrls(node);
  const waitMs = (opts.wait ?? 1) * 1000;
  let settled = false;
  return {
    width: targetW,
    height: targetH,
    async frame() {
      if (!settled) { await new Promise(r => setTimeout(r, waitMs)); settled = true; }
      return lib.toCanvas(node, dtoOpts);
    },
    dispose() { restore(); },
  };
}
