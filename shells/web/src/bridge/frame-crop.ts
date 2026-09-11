// SPDX-License-Identifier: MPL-2.0
/**
 * The cover-crop of a source picture into a target frame: the largest centred source
 * rectangle with the TARGET's aspect ratio, so drawing it into the whole target neither
 * stretches nor letterboxes. Pure integer-free maths, shared by the recorder's framed
 * camera take (bridge/recorder.ts, RecordOpts.frame) and its test.
 */
export interface CropRect { sx: number; sy: number; sw: number; sh: number }

export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number): CropRect {
  if (!(srcW > 0) || !(srcH > 0) || !(dstW > 0) || !(dstH > 0)) return { sx: 0, sy: 0, sw: Math.max(0, srcW), sh: Math.max(0, srcH) };
  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;
  if (srcAspect > dstAspect) {
    // Source is wider than the frame: full height, trim the sides.
    const sw = srcH * dstAspect;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }
  // Source is taller (or equal): full width, trim top and bottom.
  const sh = srcW / dstAspect;
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
}

/** A usable frame request: two positive integers, capped so a typo cannot ask for a
 *  gigapixel canvas. */
export function validFrame(frame: unknown): { width: number; height: number } | null {
  const f = frame as { width?: unknown; height?: unknown } | null | undefined;
  const w = Math.round(Number(f?.width));
  const h = Math.round(Number(f?.height));
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 16 || h < 16 || w > 8192 || h > 8192) return null;
  return { width: w, height: h };
}
