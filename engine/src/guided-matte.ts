// SPDX-License-Identifier: MPL-2.0
/**
 * Matte edges pulled onto the photo (plans/289 M4): a guided filter (He, Sun and
 * Tang), adapted from Compositor's GuidedMatte.swift (MIT, Wonder Assembly LLC).
 * A segmentation model cuts straight through hair and fur; the filter moves the
 * mask's edges to the edges in the photo it came from.
 *
 * Compositor filters a reduced copy and draws the result back up, which softens
 * the very strands the filter found. This module uses the fast form of the same
 * filter instead (He and Sun, 2015): the linear coefficients are worked out on the
 * reduced copy, only the coefficients are scaled back up, and they are applied to
 * the full-size photo, so full-size detail comes from the photo itself.
 *
 * After the filter, two plain controls: `shift` moves the edge out (positive) or
 * in (negative) by shifting the alpha level, and `contrast` hardens a soft edge.
 *
 * Also here: `resizeMask`, the one bilinear mask scaler both the web and the Node
 * matte use, so a mask comes back to full size the same way on every shell. Pure:
 * no DOM, no clock, no IO; planes are float32, as in the Swift original.
 */

export interface MatteRefineOptions {
  /** Reach of the filter in pixels of the full-size image, 0 to 40 (default 12). 0 skips the filter. */
  radius?: number;
  /** How much of an edge in the photo counts; smaller follows finer strands (default 1e-4). */
  epsilon?: number;
  /** Moves the edge: -1 (in) to 1 (out), as a shift of the alpha level (default 0). */
  shift?: number;
  /** Hardens the edge, 1 (as filtered) to 10 (default 1). */
  contrast?: number;
  /** Longest side the coefficients are worked out at (default 1024). */
  limit?: number;
  /** Local variance of the photo at which the filtered and the model's edge count
   *  equally (default 4e-4); flatter areas keep the model's edge. 0 is the plain filter everywhere. */
  textureFloor?: number;
}

/** See `MatteRefineOptions.textureFloor`. About a 5-level spread in an 8-bit photo. */
const TEXTURE_FLOOR = 4e-4;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Mean over a (2r+1) square with edge pixels repeated, as two running-sum passes: the cost does not grow with r. */
export function boxMean(src: Float32Array, width: number, height: number, radius: number): Float32Array {
  // Running sums in doubles: a float32 sum carried along a long row drifts.
  const span = radius * 2 + 1;
  const pass = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let sum = 0;
    for (let x = -radius; x <= radius; x++) sum += src[row + Math.min(width - 1, Math.max(0, x))]!;
    for (let x = 0; x < width; x++) {
      pass[row + x] = sum / span;
      sum -= src[row + Math.min(width - 1, Math.max(0, x - radius))]!;
      sum += src[row + Math.min(width - 1, Math.max(0, x + radius + 1))]!;
    }
  }
  const out = new Float32Array(width * height);
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) sum += pass[Math.min(height - 1, Math.max(0, y)) * width + x]!;
    for (let y = 0; y < height; y++) {
      out[y * width + x] = sum / span;
      sum -= pass[Math.min(height - 1, Math.max(0, y - radius)) * width + x]!;
      sum += pass[Math.min(height - 1, Math.max(0, y + radius + 1)) * width + x]!;
    }
  }
  return out;
}

/**
 * The guided filter's linear coefficients: per pixel, the mean slope `a` and
 * offset `b` such that the refined mask is a x guide + b. Both inputs 0 to 1.
 */
export function guidedCoefficients(mask: Float32Array, guide: Float32Array, width: number, height: number, radius: number, epsilon: number): { a: Float32Array; b: Float32Array; variance: Float32Array } {
  const n = width * height;
  const meanI = boxMean(guide, width, height, radius);
  const meanP = boxMean(mask, width, height, radius);
  const sq = new Float32Array(n), prod = new Float32Array(n);
  for (let i = 0; i < n; i++) { sq[i] = guide[i]! * guide[i]!; prod[i] = guide[i]! * mask[i]!; }
  const meanII = boxMean(sq, width, height, radius);
  const meanIP = boxMean(prod, width, height, radius);
  const a = new Float32Array(n), b = new Float32Array(n), v = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const variance = meanII[i]! - meanI[i]! * meanI[i]!;
    const covariance = meanIP[i]! - meanI[i]! * meanP[i]!;
    a[i] = covariance / (variance + epsilon);
    b[i] = meanP[i]! - a[i]! * meanI[i]!;
    v[i] = Math.max(0, variance);
  }
  return { a: boxMean(a, width, height, radius), b: boxMean(b, width, height, radius), variance: boxMean(v, width, height, radius) };
}

/**
 * The colour form of the coefficients (He, Sun and Tang, section 3.5): the guide is
 * RGB, so two regions of one brightness but different hue (a cream sweater on a
 * grey wall) still count as an edge. Per pixel, a = (cov(I) + eps U)^-1 cov(I, p),
 * a 3 x 3 solve. Returns the mean of `a` per channel, the mean of `b`, and the
 * local variance (the trace of cov(I)), all at the given size.
 */
export function guidedCoefficientsColor(mask: Float32Array, r: Float32Array, g: Float32Array, bl: Float32Array, width: number, height: number, radius: number, epsilon: number): { ar: Float32Array; ag: Float32Array; ab: Float32Array; b: Float32Array; variance: Float32Array } {
  const n = width * height;
  const box = (src: Float32Array) => boxMean(src, width, height, radius);
  const prod = (x: Float32Array, y: Float32Array) => { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = x[i]! * y[i]!; return o; };
  const mR = box(r), mG = box(g), mB = box(bl), mP = box(mask);
  const mRP = box(prod(r, mask)), mGP = box(prod(g, mask)), mBP = box(prod(bl, mask));
  const vRR = box(prod(r, r)), vRG = box(prod(r, g)), vRB = box(prod(r, bl)), vGG = box(prod(g, g)), vGB = box(prod(g, bl)), vBB = box(prod(bl, bl));
  const ar = new Float32Array(n), ag = new Float32Array(n), ab = new Float32Array(n), b = new Float32Array(n), v = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const mr = mR[i]!, mg = mG[i]!, mb = mB[i]!, mp = mP[i]!;
    // Covariance of the guide (symmetric) plus eps on the diagonal, and its covariance with the mask.
    const rr = vRR[i]! - mr * mr + epsilon, rg = vRG[i]! - mr * mg, rb = vRB[i]! - mr * mb;
    const gg = vGG[i]! - mg * mg + epsilon, gb = vGB[i]! - mg * mb, bb = vBB[i]! - mb * mb + epsilon;
    const cr = mRP[i]! - mr * mp, cg = mGP[i]! - mg * mp, cb = mBP[i]! - mb * mp;
    // Inverse by cofactors.
    const i00 = gg * bb - gb * gb, i01 = rb * gb - rg * bb, i02 = rg * gb - rb * gg;
    const i11 = rr * bb - rb * rb, i12 = rb * rg - rr * gb, i22 = rr * gg - rg * rg;
    const det = rr * i00 + rg * i01 + rb * i02;
    if (Math.abs(det) < 1e-20) { ar[i] = ag[i] = ab[i] = 0; b[i] = mp; }
    else {
      ar[i] = (i00 * cr + i01 * cg + i02 * cb) / det;
      ag[i] = (i01 * cr + i11 * cg + i12 * cb) / det;
      ab[i] = (i02 * cr + i12 * cg + i22 * cb) / det;
      b[i] = mp - ar[i]! * mr - ag[i]! * mg - ab[i]! * mb;
    }
    v[i] = Math.max(0, rr + gg + bb - 3 * epsilon);
  }
  return { ar: box(ar), ag: box(ag), ab: box(ab), b: box(b), variance: box(v) };
}

/** Compositor's filter as it stands: `mask` refined by `guide`, both 0 to 1 and the same size. */
export function guidedFilter(mask: Float32Array, guide: Float32Array, width: number, height: number, radius: number, epsilon: number): Float32Array {
  const { a, b } = guidedCoefficients(mask, guide, width, height, radius, epsilon);
  const out = new Float32Array(width * height);
  for (let i = 0; i < out.length; i++) out[i] = clamp01(a[i]! * guide[i]! + b[i]!);
  return out;
}

/** Bilinear scale of a single-channel plane, pixel centres aligned. */
function resizePlane(src: Float32Array, sw: number, sh: number, dw: number, dh: number): Float32Array {
  if (sw === dw && sh === dh) return src.slice();
  const out = new Float32Array(dw * dh);
  const fx = sw / dw, fy = sh / dh;
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.max(0, (y + 0.5) * fy - 0.5));
    const y0 = Math.floor(sy), y1 = Math.min(sh - 1, y0 + 1), ty = sy - y0;
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.max(0, (x + 0.5) * fx - 0.5));
      const x0 = Math.floor(sx), x1 = Math.min(sw - 1, x0 + 1), tx = sx - x0;
      const top = src[y0 * sw + x0]! + (src[y0 * sw + x1]! - src[y0 * sw + x0]!) * tx;
      const bottom = src[y1 * sw + x0]! + (src[y1 * sw + x1]! - src[y1 * sw + x0]!) * tx;
      out[y * dw + x] = top + (bottom - top) * ty;
    }
  }
  return out;
}

/** Area average down to `dw` x `dh` (each target pixel the mean of the source pixels it covers). */
function shrinkPlane(src: Float32Array, sw: number, sh: number, dw: number, dh: number): Float32Array {
  if (sw === dw && sh === dh) return src.slice();
  const out = new Float32Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    const ya = Math.floor((y * sh) / dh), yb = Math.max(ya + 1, Math.floor(((y + 1) * sh) / dh));
    for (let x = 0; x < dw; x++) {
      const xa = Math.floor((x * sw) / dw), xb = Math.max(xa + 1, Math.floor(((x + 1) * sw) / dw));
      let s = 0;
      for (let yy = ya; yy < yb; yy++) for (let xx = xa; xx < xb; xx++) s += src[yy * sw + xx]!;
      out[y * dw + x] = s / ((yb - ya) * (xb - xa));
    }
  }
  return out;
}

/**
 * A mask scaled to `dw` x `dh` (bytes in, bytes out), bilinear. The one scaler the
 * web and Node mattes both use for the model's mask, so neither depends on its
 * own canvas or image library for the result.
 */
export function resizeMask(mask: ArrayLike<number>, sw: number, sh: number, dw: number, dh: number): Uint8Array {
  const plane = new Float32Array(sw * sh);
  for (let i = 0; i < plane.length; i++) plane[i] = mask[i]!;
  const scaled = resizePlane(plane, sw, sh, dw, dh);
  const out = new Uint8Array(dw * dh);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(Math.min(255, Math.max(0, scaled[i]!)));
  return out;
}

/** Straight RGBA as three 0 to 1 planes. */
function channelsOf(rgba: ArrayLike<number>, n: number): [Float32Array, Float32Array, Float32Array] {
  const r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n);
  for (let i = 0; i < n; i++) { r[i] = rgba[i * 4]! / 255; g[i] = rgba[i * 4 + 1]! / 255; b[i] = rgba[i * 4 + 2]! / 255; }
  return [r, g, b];
}

/**
 * `alpha` (one byte per pixel) refined against the photo `rgba` of the same size,
 * then shifted and hardened. Returns a new alpha plane; neither input is changed.
 */
export function refineMatte(alpha: ArrayLike<number>, rgba: ArrayLike<number>, width: number, height: number, opts: MatteRefineOptions = {}): Uint8Array {
  const n = width * height;
  const radius = Math.max(0, Math.min(40, Math.round(opts.radius ?? 12)));
  const epsilon = opts.epsilon ?? 1e-4;
  const shift = Math.max(-1, Math.min(1, opts.shift ?? 0));
  const contrast = Math.max(1, Math.min(10, opts.contrast ?? 1));
  const limit = Math.max(64, opts.limit ?? 1024);

  let refined = new Float32Array(n);
  for (let i = 0; i < n; i++) refined[i] = alpha[i]! / 255;
  if (radius > 0 && width > 1 && height > 1) {
    const [gr, gg, gb] = channelsOf(rgba, n);
    const factor = Math.min(1, limit / Math.max(width, height));
    const sw = Math.max(1, Math.round(width * factor)), sh = Math.max(1, Math.round(height * factor));
    const r = Math.max(1, Math.round(radius * factor));
    const small = (p: Float32Array) => shrinkPlane(p, width, height, sw, sh);
    const c = guidedCoefficientsColor(small(refined), small(gr), small(gg), small(gb), sw, sh, r, epsilon);
    const up = (p: Float32Array) => resizePlane(p, sw, sh, width, height);
    const arU = up(c.ar), agU = up(c.ag), abU = up(c.ab), bU = up(c.b), vU = up(c.variance);
    const floor = opts.textureFloor ?? TEXTURE_FLOOR;
    const model = refined;
    refined = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      // Where the photo is flat the filter can only blur, which spreads a halo
      // into a plain background; there the model's own edge stands. Where the
      // photo has structure (hair, lettering) the filtered edge takes over.
      const w = floor > 0 ? vU[i]! / (vU[i]! + floor) : 1;
      const q = arU[i]! * gr[i]! + agU[i]! * gg[i]! + abU[i]! * gb[i]! + bU[i]!;
      refined[i] = clamp01(w * q + (1 - w) * model[i]!);
    }
  }
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const v = clamp01((refined[i]! - 0.5) * contrast + 0.5 + shift * 0.5);
    out[i] = Math.round(v * 255);
  }
  return out;
}
