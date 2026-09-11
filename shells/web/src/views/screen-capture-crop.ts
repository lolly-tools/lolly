// SPDX-License-Identifier: MPL-2.0
/**
 * Pure crop arithmetic for the screencap tool - the design's essential math,
 * kept DOM-free so it is unit-testable without a layout engine or rasteriser
 * (screen-capture-crop.test.ts). The interactive overlay and the export-size push
 * live in screen-capture-control.ts and are verified manually in real Chromium.
 *
 * The crop is four numbers in PERCENT of the shot. The shot is never resampled:
 * the template clips it in an overflow:hidden window using percentage CSS offsets,
 * and the crop's natural pixel size drives the export bar so the export is an
 * identity blit.
 */

export interface CropRect { x: number; y: number; w: number; h: number }

/**
 * Compose a drag rect (0..1 fractions of the CURRENT crop window) against the
 * current crop, in shot-space percentages, snapped to whole natural pixels.
 *
 * `cur` is the current crop in percent of the shot; `drag` is in 0..1 of the canvas
 * (which equals the current crop window); `nw`/`nh` are the shot's natural pixels.
 * Returns the new crop in percent, or null if the drag is a tap or the shot is
 * dimensionless. Composing against the current crop keeps the result ONE rect in
 * shot-space, so repeated drags don't drift and a shared ?crop.x= means the same
 * thing regardless of drag history.
 */
export function composeCropRect(
  cur: CropRect, drag: CropRect, nw: number, nh: number,
): CropRect | null {
  if (!(nw > 0 && nh > 0)) return null;
  if (!(drag.w > 0.01 && drag.h > 0.01)) return null;   // a tap is not a crop
  let nx = cur.x + drag.x * cur.w, ny = cur.y + drag.y * cur.h;
  let ncw = cur.w * drag.w,        nch = cur.h * drag.h;
  // Snap to whole natural pixels so the derived export size is exact and stable
  // across re-drags.
  const snap = (p: number, n: number) => (Math.round(p / 100 * n) / n) * 100;
  nx = snap(nx, nw); ny = snap(ny, nh);
  ncw = Math.max(1 / nw * 100, snap(ncw, nw));
  nch = Math.max(1 / nh * 100, snap(nch, nh));
  return { x: nx, y: ny, w: ncw, h: nch };
}

/**
 * The crop's true pixel size (what the export bar is set to). Returns null when the
 * shot has no usable dimensions - never a NaN/0 the bar would choke on.
 */
export function cropPixelSize(
  crop: CropRect, nw: number, nh: number,
): { width: number; height: number } | null {
  if (!(nw > 0 && nh > 0)) return null;
  return {
    width:  Math.max(1, Math.round(crop.w / 100 * nw)),
    height: Math.max(1, Math.round(crop.h / 100 * nh)),
  };
}
