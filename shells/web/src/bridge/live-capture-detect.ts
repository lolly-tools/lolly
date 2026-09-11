// SPDX-License-Identifier: MPL-2.0
/**
 * Stage-locating math for the live-capture export path (live-capture.ts).
 *
 * When the browser can't crop a display capture to the tool canvas itself
 * (no CropTarget - Safari/Firefox, or the user shared a window/monitor), the
 * shell flashes the stage solid magenta then solid green and finds that
 * rectangle in the incoming frames. Two colours, confirmed at the same spot,
 * so a magenta wallpaper or a green terminal can't fake a stage on its own.
 *
 * DOM-free by design - same split as video-mime.ts: the pixel math lives here
 * so the repo-root suite can assert it on synthetic frames; the <video> /
 * canvas sampling stays in live-capture.ts and needs a real browser.
 *
 * All coordinates are pixel positions in the frame handed to feed() - the
 * caller samples the capture into a small canvas and scales the result back
 * up to video coordinates with scaleRect().
 */

/** Minimal ImageData shape (avoids the DOM lib type in node tests). */
export interface FrameLike {
  data: Uint8ClampedArray;   // RGBA, 4 bytes per pixel
  width: number;
  height: number;
}

export interface Rect { x: number; y: number; w: number; h: number; }

// Calibration colours: full-saturation magenta and green sit at opposite ends of
// both chroma axes, so they survive 4:2:0 subsampling and encoder smoothing better
// than any other pair. Thresholds are deliberately loose - a captured #f0f lands
// well inside them even after colour management drift, while UI chrome (muted
// brand colours, greys) stays well outside.
export function isMagenta(r: number, g: number, b: number): boolean {
  return r > 140 && b > 140 && g < 110 && r - g > 60 && b - g > 60;
}
export function isGreen(r: number, g: number, b: number): boolean {
  return g > 140 && r < 110 && b < 110 && g - r > 60 && g - b > 60;
}

// A candidate box must be a genuinely solid rectangle, not scattered matches: at
// least MIN_AREA_FRAC of the frame (the stage is never a speck), filled to
// MIN_FILL (compression fuzzes the border pixels; the interior stays solid).
const MIN_AREA_FRAC = 0.005;
const MIN_FILL = 0.85;

/**
 * Bounding box of all pixels matching `classify`, validated as a solid
 * rectangle. Returns null when the matches are too few, too small, or too
 * scattered to be the flashed stage.
 */
export function findSolidRect(
  frame: FrameLike,
  classify: (r: number, g: number, b: number) => boolean,
): Rect | null {
  const { data, width, height } = frame;
  let minX = width, minY = height, maxX = -1, maxY = -1, count = 0;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      const i = row + x * 4;
      if (classify(data[i]!, data[i + 1]!, data[i + 2]!)) {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const w = maxX - minX + 1, h = maxY - minY + 1;
  if (w * h < width * height * MIN_AREA_FRAC) return null;
  if (count < w * h * MIN_FILL) return null;
  return { x: minX, y: minY, w, h };
}

/** Intersection-over-union - how well two candidate boxes agree. */
export function rectIoU(a: Rect, b: Rect): number {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (inter === 0) return 0;
  return inter / (a.w * a.h + b.w * b.h - inter);
}

/** Intersection of two rects, or null when they don't overlap. */
export function intersectRect(a: Rect, b: Rect): Rect | null {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  if (x2 <= x1 || y2 <= y1) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

// The two flashes must land on the SAME rectangle. 0.8 leaves room for a pixel
// or two of encoder wobble between the magenta and green reads without letting
// two different screen regions pass as one stage.
const MIN_CONFIRM_IOU = 0.8;

export interface StageLocator {
  /** 'seek-a' until magenta is seen, 'seek-b' until green confirms it. */
  readonly phase: 'seek-a' | 'seek-b' | 'done';
  /** Feed one sampled frame; returns the confirmed stage rect once, then null. */
  feed(frame: FrameLike): Rect | null;
}

/**
 * Two-phase locator: remember where the magenta flash was, then require the
 * green flash to land on (IoU ≥ 0.8 with) the same box. The result is the
 * intersection of the two reads - the pixels BOTH flashes claimed, so a stray
 * match in either colour can only shrink the crop by its overlap, never grow it.
 * A green box somewhere else entirely just re-arms the wait; a later magenta
 * sighting updates the stored box (the overlay may still be fading in when the
 * first read lands).
 */
export function createStageLocator(): StageLocator {
  let a: Rect | null = null;
  let done = false;
  return {
    get phase() { return done ? 'done' as const : a ? 'seek-b' as const : 'seek-a' as const; },
    feed(frame: FrameLike): Rect | null {
      if (done) return null;
      const m = findSolidRect(frame, isMagenta);
      if (m) { a = m; return null; }        // (re)read the magenta box; green is judged against the latest
      if (!a) return null;
      const g = findSolidRect(frame, isGreen);
      if (g && rectIoU(a, g) >= MIN_CONFIRM_IOU) {
        const both = intersectRect(a, g);
        if (both) { done = true; return both; }
      }
      return null;
    },
  };
}

/**
 * Scale a rect from sample coordinates up to video coordinates. Position
 * floors and size ceils so the crop never falls short of the detected box - 
 * a sub-pixel overshoot grabs at most a sliver of surround, while an
 * undershoot would shave the stage edge.
 */
export function scaleRect(r: Rect, sx: number, sy: number, maxW: number, maxH: number): Rect {
  const x = Math.max(0, Math.floor(r.x * sx));
  const y = Math.max(0, Math.floor(r.y * sy));
  return {
    x, y,
    w: Math.min(maxW - x, Math.ceil(r.w * sx)),
    h: Math.min(maxH - y, Math.ceil(r.h * sy)),
  };
}
