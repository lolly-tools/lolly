// SPDX-License-Identifier: MPL-2.0
/**
 * Telea inpainting: fill a brushed-out region of an RGBA frame from the pixels
 * around it, by fast marching inward from the region boundary.
 *
 * The algorithm is A. Telea, "An Image Inpainting Technique Based on the Fast
 * Marching Method", Journal of Graphics Tools 9(1), 2004 - the same method
 * OpenCV ships as INPAINT_TELEA. This is a fresh port from the published
 * algorithm, not a translation of anyone's source.
 *
 * WHY A PORT, NOT A DEPENDENCY (plans/124 WP-E, Retouch Track 1 classical).
 * Retouch v1 ships with zero model weights, so the fill has to be classical.
 * The only shrink-wrapped option was opencv.js, and stock opencv.js omits
 * cv.inpaint, so using it means a custom emscripten build: a toolchain plus a
 * multi-megabyte artifact for roughly 300 lines of typed-array arithmetic. The
 * repo's precedent (the OKLab chroma key in ./chroma-key.ts, the engine's own
 * SVG renderer) is to port small algorithms into the engine, where they stay
 * DOM-free, deterministic, CLI-capable and fuzzable.
 *
 * HOW IT WORKS.
 * Every pixel carries a flag (KNOWN, BAND, INSIDE) and a distance T to the
 * original mask boundary. Masked pixels start INSIDE with T set far away;
 * everything else is KNOWN with T = 0. The unmasked pixels touching the mask
 * seed a min-heap keyed on T. Popping the smallest T marches the boundary one
 * pixel inward: each masked 4-neighbour gets a T from the upwind solution of
 * |grad T| = 1 (the quadratic update from the two smaller usable axis
 * neighbours), gets its colour, and is pushed. Because the heap always yields
 * the pixel nearest the original boundary, the region fills from the rim toward
 * the middle and a pixel is only ever painted from material that is already
 * settled.
 *
 * THE COLOUR IS A PLAIN WEIGHTED AVERAGE. A marched pixel takes the weighted
 * mean of the KNOWN pixels inside a disc of `radius` around it, with the
 * paper's three weight terms multiplied together: dir (how well the offset
 * lines up with the inpainting normal, the normalised T-gradient), dst (inverse
 * square of the geometric distance) and lev (closeness in T, so the average
 * prefers material on the same level set). The paper's optional first-order
 * term, which extrapolates each contributor along its own image gradient, is
 * deliberately NOT implemented: it sharpens some fills and makes others ring or
 * streak, and a plain average is the stable choice for a retouch brush. All
 * four channels including alpha are averaged with the same weights.
 *
 * WINDOWING. The function computes the mask bounding box, expands it by
 * 2*radius + 2 (clamped to the frame), and runs everything on that window
 * before pasting into a copy of the full frame. The margin is wide enough that
 * every masked pixel still sees its whole radius neighbourhood, so a small
 * blemish on a print-resolution photo costs the window and not the image. Only
 * masked pixels can differ from the input.
 *
 * NO KNOWN PIXELS. A mask covering the entire frame leaves nothing to fill
 * from. Rather than spin, those pixels are written as opaque mid-grey
 * (128, 128, 128, 255). The same sweep catches any pixel the march could not
 * reach, which guarantees the function terminates with every masked pixel
 * written.
 *
 * Pure and DOM-free: no Date, no Math.random, no IO. Heap ties break on pixel
 * index, so the same frame and mask give byte-identical output everywhere.
 */

/** An RGBA frame with straight (non-premultiplied) alpha. */
export interface InpaintFrame {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** Options for {@link inpaintTelea}. */
export interface InpaintOpts {
  /** Weighted-average neighbourhood radius in px (Telea's epsilon). Default 5. */
  radius?: number;
  /** Called every ~1000 filled pixels and once at the end: (filled, totalMasked). */
  onProgress?: (filled: number, total: number) => void;
}

/** Pixel states. KNOWN has final colour, BAND is on the marching front with a
 *  provisional colour, INSIDE is still to do. */
const KNOWN = 0;
const BAND = 1;
const INSIDE = 2;

/** T for a pixel the march has not reached. Large enough to lose every min(). */
const FAR_T = 1e6;

/** Progress callback cadence, in filled pixels. */
const PROGRESS_STEP = 1000;

/** What a pixel with nothing to copy from becomes. */
const GREY = 128;

/** 4-neighbourhood offsets, in the order the march visits them. */
const DX = [-1, 1, 0, 0];
const DY = [0, 0, -1, 1];

/**
 * Upwind solution of |grad T| = 1 at a pixel whose smallest usable x-neighbour
 * is at T = `a` and smallest usable y-neighbour at T = `b`. Either may be
 * Infinity when that axis has no usable neighbour.
 *
 * With both axes available the eikonal equation (T-a)^2 + (T-b)^2 = 1 has the
 * root ((a+b) + sqrt(2 - (a-b)^2)) / 2, valid while |a-b| <= 1; past that the
 * front is one-sided and the answer is min(a,b) + 1. Monotone in both
 * arguments, which is why taking the smaller neighbour per axis matches
 * minimising the paper's four quadrant solutions.
 */
function solveT(a: number, b: number): number {
  const aOk = Number.isFinite(a);
  const bOk = Number.isFinite(b);
  if (aOk && bOk) {
    const d = a - b;
    const d2 = d * d;
    if (d2 <= 1) return (a + b + Math.sqrt(2 - d2)) / 2;
    return Math.min(a, b) + 1;
  }
  if (aOk) return a + 1;
  if (bOk) return b + 1;
  return FAR_T;
}

/** Binary min-heap of pixel indices keyed on T, ties broken by index so the
 *  marching order is fixed for a given frame and mask. */
class THeap {
  private readonly idx: Int32Array;
  private readonly t: Float32Array;
  private n = 0;

  constructor(capacity: number, t: Float32Array) {
    this.idx = new Int32Array(Math.max(1, capacity));
    this.t = t;
  }

  get size(): number {
    return this.n;
  }

  /** True when pixel `a` should pop before pixel `b`. */
  private before(a: number, b: number): boolean {
    const ta = this.t[a] as number;
    const tb = this.t[b] as number;
    return ta < tb || (ta === tb && a < b);
  }

  push(p: number): void {
    const items = this.idx;
    let i = this.n++;
    items[i] = p;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.before(items[i] as number, items[parent] as number)) break;
      const tmp = items[i] as number;
      items[i] = items[parent] as number;
      items[parent] = tmp;
      i = parent;
    }
  }

  /** Removes and returns the smallest pixel. Only call with size > 0. */
  pop(): number {
    const items = this.idx;
    const top = items[0] as number;
    const last = items[--this.n] as number;
    if (this.n > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.n && this.before(items[l] as number, items[m] as number)) m = l;
        if (r < this.n && this.before(items[r] as number, items[m] as number)) m = r;
        if (m === i) break;
        const tmp = items[i] as number;
        items[i] = items[m] as number;
        items[m] = tmp;
        i = m;
      }
    }
    return top;
  }
}

/**
 * Fill every pixel where `mask[i] !== 0` from the surrounding known pixels.
 *
 * `mask` is width*height bytes, row-major, one byte per pixel. Returns a NEW
 * frame; the input frame and mask are never mutated, and an empty mask returns
 * an identical copy. Throws when the mask or the frame data length disagrees
 * with width*height.
 */
export function inpaintTelea(frame: InpaintFrame, mask: Uint8Array, opts: InpaintOpts = {}): InpaintFrame {
  const { width, height } = frame;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 0 || height < 0) {
    throw new Error(`inpaintTelea: width and height must be non-negative integers (got ${width}x${height})`);
  }
  const pixels = width * height;
  if (frame.data.length !== pixels * 4) {
    throw new Error(
      `inpaintTelea: frame data is ${frame.data.length} bytes, expected ${pixels * 4} for ${width}x${height} RGBA`,
    );
  }
  if (mask.length !== pixels) {
    throw new Error(`inpaintTelea: mask is ${mask.length} bytes, expected ${pixels} for ${width}x${height}`);
  }

  const rawRadius = opts.radius;
  const radius = Math.max(
    1,
    Math.min(64, Math.round(typeof rawRadius === 'number' && Number.isFinite(rawRadius) ? rawRadius : 5)),
  );
  const onProgress = opts.onProgress;
  const out = new Uint8ClampedArray(frame.data); // copy: never mutate the caller's frame
  const result: InpaintFrame = { width, height, data: out };

  // Mask bounding box and the masked-pixel total the progress callback reports.
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let total = 0;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (mask[row + x] === 0) continue;
      total++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (total === 0) {
    onProgress?.(0, 0);
    return result;
  }

  // The window: bbox plus enough margin that every masked pixel keeps its whole
  // radius neighbourhood, clamped to the frame.
  const margin = 2 * radius + 2;
  const wx0 = Math.max(0, minX - margin);
  const wy0 = Math.max(0, minY - margin);
  const wx1 = Math.min(width - 1, maxX + margin);
  const wy1 = Math.min(height - 1, maxY + margin);
  const ww = wx1 - wx0 + 1;
  const wh = wy1 - wy0 + 1;
  const n = ww * wh;

  const flags = new Uint8Array(n); // KNOWN (0) everywhere until a mask byte says otherwise
  const T = new Float32Array(n);
  for (let y = 0; y < wh; y++) {
    const src = (wy0 + y) * width + wx0;
    const dst = y * ww;
    for (let x = 0; x < ww; x++) {
      if (mask[src + x] === 0) continue;
      flags[dst + x] = INSIDE;
      T[dst + x] = FAR_T;
    }
  }

  // Seed the front with the unmasked pixels touching the mask. They keep the
  // KNOWN flag rather than becoming BAND: their colour is the original image, so
  // there is no reason to withhold it from the first pixels painted. Each is
  // pushed exactly once here and no other code path pushes a KNOWN pixel.
  const heap = new THeap(n, T);
  for (let y = 0; y < wh; y++) {
    const row = y * ww;
    for (let x = 0; x < ww; x++) {
      const li = row + x;
      if (flags[li] !== KNOWN) continue;
      const touches =
        (x > 0 && flags[li - 1] === INSIDE) ||
        (x < ww - 1 && flags[li + 1] === INSIDE) ||
        (y > 0 && flags[li - ww] === INSIDE) ||
        (y < wh - 1 && flags[li + ww] === INSIDE);
      if (touches) heap.push(li);
    }
  }

  const r2 = radius * radius;

  /** Paint window pixel (x,y) as the dir*dst*lev weighted mean of the KNOWN
   *  pixels within `radius`. Requires T[li] to already hold the marched value. */
  const paint = (x: number, y: number, li: number): void => {
    // Inpainting normal: the T-gradient, central where both sides are usable and
    // one-sided otherwise. An INSIDE neighbour holds no real T and is skipped.
    let gx = 0;
    let gy = 0;
    const hasL = x > 0 && flags[li - 1] !== INSIDE;
    const hasR = x < ww - 1 && flags[li + 1] !== INSIDE;
    if (hasL && hasR) gx = ((T[li + 1] as number) - (T[li - 1] as number)) / 2;
    else if (hasR) gx = (T[li + 1] as number) - (T[li] as number);
    else if (hasL) gx = (T[li] as number) - (T[li - 1] as number);
    const hasU = y > 0 && flags[li - ww] !== INSIDE;
    const hasD = y < wh - 1 && flags[li + ww] !== INSIDE;
    if (hasU && hasD) gy = ((T[li + ww] as number) - (T[li - ww] as number)) / 2;
    else if (hasD) gy = (T[li + ww] as number) - (T[li] as number);
    else if (hasU) gy = (T[li] as number) - (T[li - ww] as number);

    const glen = Math.sqrt(gx * gx + gy * gy);
    const hasNormal = glen > 1e-9;
    const nx = hasNormal ? gx / glen : 0;
    const ny = hasNormal ? gy / glen : 0;
    const tp = T[li] as number;

    let sw = 0;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let sa = 0;
    let swa = 0;
    const qx0 = Math.max(0, x - radius);
    const qx1 = Math.min(ww - 1, x + radius);
    const qy0 = Math.max(0, y - radius);
    const qy1 = Math.min(wh - 1, y + radius);
    for (let qy = qy0; qy <= qy1; qy++) {
      const dy = y - qy;
      const qrow = qy * ww;
      const frow = (wy0 + qy) * width + wx0;
      for (let qx = qx0; qx <= qx1; qx++) {
        if (flags[qrow + qx] !== KNOWN) continue;
        const dx = x - qx;
        const d2 = dx * dx + dy * dy;
        if (d2 === 0 || d2 > r2) continue; // the disc B_eps(p), self excluded
        // dir: how well the offset lines up with the inpainting normal. The floor
        // keeps a perpendicular contributor at a tiny weight instead of zero.
        const dir = hasNormal ? Math.max(Math.abs((dx * nx + dy * ny) / Math.sqrt(d2)), 1e-6) : 1;
        const dstw = 1 / d2; // geometric distance factor
        const lev = 1 / (1 + Math.abs(tp - (T[qrow + qx] as number))); // level-set distance factor
        const w = dir * dstw * lev;
        const fi = (frow + qx) * 4;
        // The frame is straight (non-premultiplied) alpha, and a transparent
        // pixel's RGB is arbitrary (getImageData returns 0,0,0,0) - so colour
        // must be weighted BY alpha too, or every transparent contributor
        // votes pure black and the fill grows a dark fringe along alpha
        // edges. Alpha itself keeps the plain weights. At constant alpha the
        // two weightings are identical, so opaque images are unaffected.
        const wa = w * (out[fi + 3] as number);
        sw += w;
        swa += wa;
        sr += wa * (out[fi] as number);
        sg += wa * (out[fi + 1] as number);
        sb += wa * (out[fi + 2] as number);
        sa += w * (out[fi + 3] as number);
      }
    }

    const fo = ((wy0 + y) * width + wx0 + x) * 4;
    if (sw > 0) {
      if (swa > 0) {
        out[fo] = Math.round(sr / swa);
        out[fo + 1] = Math.round(sg / swa);
        out[fo + 2] = Math.round(sb / swa);
      } else {
        // Every contributor is fully transparent: the result is transparent
        // too, and its RGB is as arbitrary as theirs - zero is fine.
        out[fo] = 0;
        out[fo + 1] = 0;
        out[fo + 2] = 0;
      }
      out[fo + 3] = Math.round(sa / sw);
    } else {
      out[fo] = GREY;
      out[fo + 1] = GREY;
      out[fo + 2] = GREY;
      out[fo + 3] = 255;
    }
  };

  // March. A pixel goes INSIDE to BAND exactly once and is pushed once, so the
  // loop runs at most `n` times whatever the mask looks like.
  let filled = 0;
  let nextTick = PROGRESS_STEP;
  while (heap.size > 0) {
    const li = heap.pop();
    flags[li] = KNOWN;
    const x = li % ww;
    const y = (li - x) / ww;
    for (let q = 0; q < 4; q++) {
      const px = x + (DX[q] as number);
      const py = y + (DY[q] as number);
      if (px < 0 || py < 0 || px >= ww || py >= wh) continue;
      const pi = py * ww + px;
      if (flags[pi] !== INSIDE) continue;

      const ax = Math.min(
        px > 0 && flags[pi - 1] !== INSIDE ? (T[pi - 1] as number) : Infinity,
        px < ww - 1 && flags[pi + 1] !== INSIDE ? (T[pi + 1] as number) : Infinity,
      );
      const ay = Math.min(
        py > 0 && flags[pi - ww] !== INSIDE ? (T[pi - ww] as number) : Infinity,
        py < wh - 1 && flags[pi + ww] !== INSIDE ? (T[pi + ww] as number) : Infinity,
      );
      T[pi] = solveT(ax, ay);
      paint(px, py, pi);
      flags[pi] = BAND;
      heap.push(pi);

      filled++;
      if (filled >= nextTick) {
        onProgress?.(filled, total);
        nextTick += PROGRESS_STEP;
      }
    }
  }

  // Anything the march never reached had no known pixel to copy from, which only
  // happens when the mask covers the whole window. Mid-grey, opaque.
  for (let y = 0; y < wh; y++) {
    const row = y * ww;
    const frow = (wy0 + y) * width + wx0;
    for (let x = 0; x < ww; x++) {
      if (flags[row + x] !== INSIDE) continue;
      const fo = (frow + x) * 4;
      out[fo] = GREY;
      out[fo + 1] = GREY;
      out[fo + 2] = GREY;
      out[fo + 3] = 255;
      filled++;
    }
  }

  onProgress?.(filled, total);
  return result;
}
