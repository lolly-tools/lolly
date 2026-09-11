// SPDX-License-Identifier: MPL-2.0
/**
 * "Use as a new image" - baking a framing into real pixels (plans/148 WP-E).
 *
 * The framing itself is non-destructive and stays that way: it lives in the
 * input values, travels in the URL, and undoes. This is the OTHER outcome the
 * plan offers, taken only on an explicit click - the user has decided the
 * cropped/straightened/corrected image is the image they want, and wants it in
 * their library as its own asset.
 *
 * The placement maths is the engine's (frameRect / projectFramingPoint), the
 * same functions the live preview and every export path use, so the baked file
 * matches what was on screen. The provenance is lib/derived-asset.ts's, the same
 * signed path the catalog crop takes. Nothing new is invented here: this module
 * is only the pixels.
 */
import { frameRect, projectFramingPoint, normalizeFraming, isTilted, FRAMING_PERSPECTIVE } from '@lolly/engine';
import type { Framing, FramingFit } from '@lolly/engine';

/** Subdivision of a tilted plane. Canvas 2-D has no projective transform, so the
 *  perspective is approximated by affine tiles - the same technique the hook-side
 *  twin uses, and the same one the vector piecewise-affine path will.
 *
 *  32 measured against the exact projection at a hard 12 degree pitch / 9 degree
 *  yaw on a 1080 frame: 8 tiles is 11.0px out at the worst corner, 16 is 2.9,
 *  24 is 1.3 and 32 is 0.74 - under a pixel, which is where it stops being
 *  visible. 1024 draws is fine for a bake (it runs once, on a click). */
const TILES = 32;
/** Never bake something a browser cannot open or a phone cannot hold. */
const MAX_EDGE = 8000;

export interface BakedFraming { blob: Blob; format: string; width: number; height: number }

/**
 * Choose the baked size.
 *
 * The frame's own pixel size is the natural answer, but it is the wrong one when
 * a 6000px photo has been framed into a 600px slot: baking at 600 would throw
 * away detail the user still owns, and the copy is a LIBRARY asset that may be
 * placed somewhere larger next time. So the output is scaled up toward the
 * source's own density - never past it, because inventing pixels is what
 * upscaling is, and this path must not do that.
 */
function bakeScale(iw: number, ih: number, W: number, H: number, framing: Framing, fit: FramingFit): number {
  const r = frameRect(iw, ih, W, H, framing, fit);
  const density = r.dw > 0 ? r.dw / iw : 1;          // frame px per source px
  const want = density > 0 ? 1 / density : 1;
  const scale = Math.min(4, Math.max(1, want));
  const longest = Math.max(W, H) * scale;
  return longest > MAX_EDGE ? MAX_EDGE / Math.max(W, H) : scale;
}

/**
 * Draw a framed image into a 2-D context sized `W`x`H`.
 *
 * Flat framings are one `drawImage` with the roll applied about the pan point.
 * A tilted one draws a mesh: each tile is placed by the affine map through three
 * of its projected corners, with a half-pixel overlap so adjacent patches do not
 * leave hairline seams. Exported because the same drawing is wanted anywhere the
 * shell composites a framed image itself, not only in the bake.
 */
export function drawFramed(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  source: CanvasImageSource, iw: number, ih: number, W: number, H: number,
  framing?: Framing | null, fit: FramingFit = 'cover', perspective = FRAMING_PERSPECTIVE,
): void {
  const r = frameRect(iw, ih, W, H, framing, fit);
  const f = normalizeFraming(framing);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (!isTilted(framing)) {
    if (r.rotate) {
      ctx.save();
      ctx.translate(r.originX, r.originY);
      ctx.rotate((r.rotate * Math.PI) / 180);
      ctx.translate(-r.originX, -r.originY);
    }
    ctx.drawImage(source, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
    if (r.rotate) ctx.restore();
    return;
  }
  const tw = r.sw / TILES, th = r.sh / TILES;
  const dw = r.dw / TILES, dh = r.dh / TILES;
  const over = 0.5;
  for (let j = 0; j < TILES; j++) {
    for (let i = 0; i < TILES; i++) {
      const x0 = r.dx + i * dw, y0 = r.dy + j * dh;
      const p00 = projectFramingPoint(x0, y0, r.originX, r.originY, f, perspective);
      const p10 = projectFramingPoint(x0 + dw, y0, r.originX, r.originY, f, perspective);
      const p01 = projectFramingPoint(x0, y0 + dh, r.originX, r.originY, f, perspective);
      const a = (p10.x - p00.x) / dw, b = (p10.y - p00.y) / dw;
      const c = (p01.x - p00.x) / dh, d = (p01.y - p00.y) / dh;
      if (![a, b, c, d].every(Number.isFinite)) continue;
      ctx.save();
      ctx.transform(a, b, c, d, p00.x, p00.y);
      ctx.drawImage(source, r.sx + i * tw, r.sy + j * th, tw, th, 0, 0, dw + over, dh + over);
      ctx.restore();
    }
  }
}

/** The minimum host surface the bake needs. */
export interface BakeHost {
  raster?: {
    canRaster(): boolean;
    decode(src: string): Promise<ImageBitmap>;
    encode(source: ImageBitmap, opts: { format: string; quality?: number }): Promise<{ bytes: Uint8Array; mime: string; width: number; height: number }>;
  };
}

/**
 * Render `url` through `framing` into a `frameW`x`frameH` frame and encode it.
 *
 * PNG unless the source is a JPEG with no transparency to protect, in which case
 * the bake stays JPEG so a photo does not quadruple in size on the way into the
 * library. A tilted framing always goes PNG: the corners outside the projected
 * quad are transparent, and JPEG has nowhere to put that.
 */
export async function bakeFraming(
  host: BakeHost, url: string, framing: Framing | null | undefined, fit: FramingFit,
  frameW: number, frameH: number, sourceFormat?: string,
): Promise<BakedFraming | null> {
  if (!host.raster?.canRaster()) return null;
  const bitmap = await host.raster.decode(url);
  try {
    const iw = bitmap.width, ih = bitmap.height;
    if (!(iw > 0) || !(ih > 0) || !(frameW > 0) || !(frameH > 0)) return null;
    const scale = bakeScale(iw, ih, frameW, frameH, framing ?? {}, fit);
    const W = Math.max(1, Math.round(frameW * scale));
    const H = Math.max(1, Math.round(frameH * scale));
    const canvas = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(W, H)
      : Object.assign(document.createElement('canvas'), { width: W, height: H });
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (!ctx) return null;
    drawFramed(ctx, bitmap, iw, ih, W, H, framing, fit);
    // A tilt or a `contain` fit leaves transparent ground, so those must keep an
    // alpha channel; a plain cover crop of a JPEG can stay a JPEG.
    const opaque = !isTilted(framing) && fit === 'cover';
    const jpegSource = /^jpe?g$/i.test(String(sourceFormat ?? ''));
    const format = opaque && jpegSource ? 'jpeg' : 'png';
    const shot = await createImageBitmap(canvas as unknown as ImageBitmapSource);
    try {
      const out = await host.raster.encode(shot, { format, quality: format === 'jpeg' ? 0.92 : undefined });
      return {
        blob: new Blob([out.bytes as unknown as BlobPart], { type: out.mime }),
        // The encoder may fall back (no WebP support, say); believe the mime it
        // actually produced, never the format that was asked for.
        format: out.mime.includes('jpeg') ? 'jpg' : out.mime.split('/')[1] ?? format,
        width: out.width, height: out.height,
      };
    } finally { shot.close?.(); }
  } finally { bitmap.close?.(); }
}
