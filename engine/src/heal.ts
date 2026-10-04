// SPDX-License-Identifier: MPL-2.0
/**
 * Spot healing (plans/289 M4): Compositor's `spot_heal` (HealPixels.c, MIT,
 * Wonder Assembly LLC), ported line for line and held to the original by
 * tests/heal.test.ts, whose goldens come from the C itself
 * (scripts/build-heal-goldens.ts, tests/fixtures/heal/).
 *
 *   - content-aware: copies texture from the nearby patch whose surrounding ring
 *     of pixels best matches the ring around the spot (5 distances x 24 angles,
 *     then a +/-3 px nudge so repeating texture lines up);
 *   - proximity: the same search, weighted towards the nearest patch;
 *   - texture: no patch; fills smoothly from the spot's edge and adds seeded
 *     grain matching the fine detail around the spot.
 *
 * Every mode blends with a membrane: the difference along the spot's edge between
 * the picture and the patch is spread smoothly across the spot (a successive
 * over-relaxation, coarse to fine), so the copied texture meets the surrounding
 * tone exactly. The C keeps that membrane in 32-bit floats, so the port rounds
 * with `Math.fround` at each of the same steps.
 *
 * `spotHealPremultiplied` is the C's own contract: premultiplied RGBA in place,
 * every painted pixel one spot. `healFrame` is what Retouch calls: straight alpha,
 * each separate painted area healed on its own, and every unpainted byte left as
 * it was. Pure: no clock, no randomness beyond the seed, no IO.
 */

/** A frame with straight (not premultiplied) alpha, as Retouch holds one. */
export interface HealFrame {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type HealMode = 'content-aware' | 'texture' | 'proximity';

export interface HealOptions {
  mode: HealMode;
  /** 0 to 1 (default 1): how much of the healed result replaces the picture. */
  opacity?: number;
  /** Grain seed for `texture` (default 1). The same seed gives the same grain. */
  seed?: number;
}

const OUTSIDE = 0, RING = 1, HOLE = 2;
const MODE_NUMBER: Record<HealMode, number> = { 'content-aware': 0, texture: 1, proximity: 2 };
const f32 = Math.fround;
/** C's lround: half away from zero. */
const lround = (v: number): number => (v < 0 ? -Math.round(-v) : Math.round(v));

function healHash(x: number): number {
  x = (x ^ (x >>> 16)) >>> 0; x = Math.imul(x, 0x7feb352d) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0; x = Math.imul(x, 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}
const healUnit = (key: number): number => (healHash(key) >>> 8) / 16777216.0;

/** Half-open bounds of nonzero coverage; all zero when empty. */
export function healCoverageBounds(coverage: Uint8Array, width: number, height: number): [number, number, number, number] {
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (!coverage[row + x]) continue;
      if (x < x0) x0 = x;
      if (x + 1 > x1) x1 = x + 1;
      if (y < y0) y0 = y;
      if (y + 1 > y1) y1 = y + 1;
    }
  }
  return x1 <= x0 || y1 <= y0 ? [0, 0, 0, 0] : [x0, y0, x1, y1];
}

/** Mean squared ring difference against the patch at (dx, dy); Infinity when it overlaps or leaves. */
function score(rgba: ArrayLike<number>, W: number, H: number, role: Uint8Array, wx0: number, wy0: number, ww: number, wh: number, dx: number, dy: number): number {
  if (Math.abs(dx) < ww && Math.abs(dy) < wh) return Infinity;
  if (wx0 + dx < 0 || wy0 + dy < 0 || wx0 + ww + dx > W || wy0 + wh + dy > H) return Infinity;
  let sum = 0, n = 0;
  for (let y = 0; y < wh; y++) {
    for (let x = 0; x < ww; x++) {
      if (role[y * ww + x] !== RING) continue;
      const t = ((wy0 + y) * W + (wx0 + x)) * 4;
      const s = ((wy0 + y + dy) * W + (wx0 + x + dx)) * 4;
      for (let c = 0; c < 4; c++) { const d = rgba[t + c]! - rgba[s + c]!; sum += d * d; }
      n++;
    }
  }
  return n ? sum / n : Infinity;
}

/** Smooth values over HOLE pixels, fixed to the RING values, coarse to fine. */
function solve(value: Float32Array, role: Uint8Array, w: number, h: number, depth: number): void {
  let iterations = 300;
  if (w > 32 && h > 32 && depth < 16) {
    const cw = (w + 1) >> 1, ch = (h + 1) >> 1;
    const coarse = new Float32Array(cw * ch * 4);
    const coarseRole = new Uint8Array(cw * ch);
    const knownSum = new Float32Array(4), holeSum = new Float32Array(4);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        let known = 0, hole = 0;
        knownSum.fill(0); holeSum.fill(0);
        for (let j = 0; j < 2; j++) {
          for (let i = 0; i < 2; i++) {
            const fx = x * 2 + i, fy = y * 2 + j;
            if (fx >= w || fy >= h) continue;
            const p = fy * w + fx;
            if (role[p] === RING) { known++; for (let c = 0; c < 4; c++) knownSum[c] = f32(knownSum[c]! + value[p * 4 + c]!); }
            else if (role[p] === HOLE) { hole++; for (let c = 0; c < 4; c++) holeSum[c] = f32(holeSum[c]! + value[p * 4 + c]!); }
          }
        }
        const q = y * cw + x;
        if (known) { coarseRole[q] = RING; for (let c = 0; c < 4; c++) coarse[q * 4 + c] = f32(knownSum[c]! / known); }
        else if (hole) { coarseRole[q] = HOLE; for (let c = 0; c < 4; c++) coarse[q * 4 + c] = f32(holeSum[c]! / hole); }
      }
    }
    solve(coarse, coarseRole, cw, ch, depth + 1);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x, q = (y >> 1) * cw + (x >> 1);
        if (role[p] === HOLE && coarseRole[q] === HOLE) value.set(coarse.subarray(q * 4, q * 4 + 4), p * 4);
      }
    }
    iterations = 40;
  }
  const omega = f32(1.8);
  const sum = new Float32Array(4);
  for (let it = 0; it < iterations; it++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        if (role[p] !== HOLE) continue;
        sum.fill(0);
        let n = 0;
        for (let k = 0; k < 4; k++) {
          const nx = k === 0 ? x - 1 : k === 1 ? x + 1 : x;
          const ny = k === 2 ? y - 1 : k === 3 ? y + 1 : y;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (role[q] === OUTSIDE) continue;
          for (let c = 0; c < 4; c++) sum[c] = f32(sum[c]! + value[q * 4 + c]!);
          n++;
        }
        if (!n) continue;
        for (let c = 0; c < 4; c++) {
          const v = value[p * 4 + c]!;
          value[p * 4 + c] = f32(v + f32(omega * f32(f32(sum[c]! / n) - v)));
        }
      }
    }
  }
}

/**
 * Heal premultiplied RGBA in place where `coverage` (0 to 255 per pixel) is set:
 * every covered pixel is one spot, as in Compositor's `spot_heal`.
 */
export function spotHealPremultiplied(rgba: Uint8Array | Uint8ClampedArray, coverage: Uint8Array, width: number, height: number, opts: HealOptions): void {
  const W = width, H = height;
  const mode = MODE_NUMBER[opts.mode];
  const opacity = f32(Math.max(0, Math.min(1, opts.opacity ?? 1)));
  const seed = (opts.seed ?? 1) >>> 0;
  const [bx0, by0, bx1, by1] = healCoverageBounds(coverage, width, height);
  if (bx1 <= bx0) return;
  const bw = bx1 - bx0, bh = by1 - by0, size = Math.max(bw, bh);
  const ring = Math.min(16, Math.max(2, Math.trunc(size / 8)));
  const wx0 = Math.max(0, bx0 - ring), wy0 = Math.max(0, by0 - ring);
  const wx1 = Math.min(W, bx1 + ring), wy1 = Math.min(H, by1 + ring);
  const ww = wx1 - wx0, wh = wy1 - wy0, wn = ww * wh;

  const role = new Uint8Array(wn), near = new Uint8Array(wn);
  const prefix = new Int32Array(Math.max(ww, wh) + 1);
  const value = new Float32Array(wn * 4);
  for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) role[y * ww + x] = coverage[(wy0 + y) * width + (wx0 + x)] ? HOLE : OUTSIDE;
  // The ring: pixels within `ring` of the spot (a square dilation, rows then columns).
  for (let y = 0; y < wh; y++) {
    prefix[0] = 0;
    for (let x = 0; x < ww; x++) prefix[x + 1] = prefix[x]! + (role[y * ww + x] === HOLE ? 1 : 0);
    for (let x = 0; x < ww; x++) {
      const lo = Math.max(0, x - ring), hi = Math.min(ww, x + ring + 1);
      near[y * ww + x] = prefix[hi]! - prefix[lo]! > 0 ? 1 : 0;
    }
  }
  for (let x = 0; x < ww; x++) {
    prefix[0] = 0;
    for (let y = 0; y < wh; y++) prefix[y + 1] = prefix[y]! + near[y * ww + x]!;
    for (let y = 0; y < wh; y++) {
      const lo = Math.max(0, y - ring), hi = Math.min(wh, y + ring + 1);
      if (role[y * ww + x] === OUTSIDE && prefix[hi]! - prefix[lo]! > 0) role[y * ww + x] = RING;
    }
  }
  let ringCount = 0;
  for (let p = 0; p < wn; p++) if (role[p] === RING) ringCount++;
  if (!ringCount) return;

  // The source patch, for content-aware and proximity.
  let ox = 0, oy = 0, haveSource = false;
  if (mode !== 1) {
    const factors = [1.05, 1.35, 1.75, 2.25, 2.8];
    const count = mode === 2 ? 2 : 5;
    let best = Infinity;
    for (let f = 0; f < count; f++) {
      for (let a = 0; a < 24; a++) {
        const angle = (a * Math.PI) / 12.0;
        const dx = lround(Math.cos(angle) * factors[f]! * ww), dy = lround(Math.sin(angle) * factors[f]! * wh);
        let s = score(rgba, W, H, role, wx0, wy0, ww, wh, dx, dy);
        if (!Number.isFinite(s)) continue;
        s *= mode === 2 ? 1.0 + 0.6 * f : 1.0 + 0.1 * f; // nearer patches win ties
        if (s < best) { best = s; ox = dx; oy = dy; }
      }
    }
    if (Number.isFinite(best)) {
      const cx = ox, cy = oy;
      let refined = score(rgba, W, H, role, wx0, wy0, ww, wh, cx, cy);
      for (let j = -3; j <= 3; j++) {
        for (let i = -3; i <= 3; i++) {
          const s = score(rgba, W, H, role, wx0, wy0, ww, wh, cx + i, cy + j);
          if (s < refined) { refined = s; ox = cx + i; oy = cy + j; }
        }
      }
      haveSource = true;
    }
  }

  // The membrane: the edge difference between the picture and the patch (or the
  // picture itself for a smooth fill), spread across the spot.
  const mean = [0, 0, 0, 0], detail = [0, 0, 0];
  for (let y = 0; y < wh; y++) {
    for (let x = 0; x < ww; x++) {
      const p = y * ww + x;
      if (role[p] !== RING) { value[p * 4] = value[p * 4 + 1] = value[p * 4 + 2] = value[p * 4 + 3] = 0; continue; }
      const ix = wx0 + x, iy = wy0 + y;
      const t = (iy * W + ix) * 4;
      const s = haveSource ? ((iy + oy) * W + (ix + ox)) * 4 : -1;
      for (let c = 0; c < 4; c++) {
        value[p * 4 + c] = f32(rgba[t + c]! - (s >= 0 ? rgba[s + c]! : 0));
        mean[c] = mean[c]! + value[p * 4 + c]!;
      }
      if (!haveSource) {
        for (let c = 0; c < 3; c++) {
          let around = 0, n = 0;
          for (let k = 0; k < 4; k++) {
            const nx = k === 0 ? ix - 1 : k === 1 ? ix + 1 : ix;
            const ny = k === 2 ? iy - 1 : k === 3 ? iy + 1 : iy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            around += rgba[(ny * W + nx) * 4 + c]!;
            n++;
          }
          if (n) { const d = rgba[t + c]! - around / n; detail[c] = detail[c]! + d * d; }
        }
      }
    }
  }
  for (let c = 0; c < 4; c++) mean[c] = mean[c]! / ringCount;
  for (let p = 0; p < wn; p++) if (role[p] === HOLE) for (let c = 0; c < 4; c++) value[p * 4 + c] = f32(mean[c]!);
  solve(value, role, ww, wh, 0);
  for (let c = 0; c < 3; c++) detail[c] = Math.sqrt(detail[c]! / ringCount) * 0.9;

  for (let y = 0; y < wh; y++) {
    for (let x = 0; x < ww; x++) {
      const p = y * ww + x;
      if (role[p] !== HOLE) continue;
      const ix = wx0 + x, iy = wy0 + y;
      const t = (iy * W + ix) * 4;
      const s = haveSource ? ((iy + oy) * W + (ix + ox)) * 4 : -1;
      const amount = (coverage[iy * width + ix]! / 255.0) * opacity;
      let grain = 0;
      if (!haveSource) {
        const key = healHash((seed ^ healHash((iy * W + ix) >>> 0)) >>> 0);
        const u1 = healUnit(key), u2 = healUnit((key ^ 0x68e31da4) >>> 0);
        grain = Math.sqrt(-2.0 * Math.log(1.0 - u1)) * Math.cos(2.0 * Math.PI * u2);
      }
      const out = [0, 0, 0, 0];
      for (let c = 0; c < 4; c++) {
        const healed = (s >= 0 ? rgba[s + c]! : 0) + value[p * 4 + c]! + (c < 3 ? grain * detail[c]! : 0);
        out[c] = rgba[t + c]! + (healed - rgba[t + c]!) * amount;
      }
      const alpha = lround(Math.max(0, Math.min(255, out[3]!)));
      rgba[t + 3] = alpha;
      for (let c = 0; c < 3; c++) rgba[t + c] = lround(Math.max(0, Math.min(alpha, out[c]!)));
    }
  }
}

/** The separate painted areas of a mask (8-connected), each as its own coverage map. */
function paintedAreas(mask: Uint8Array, width: number, height: number): Uint8Array[] {
  const label = new Int32Array(width * height).fill(-1);
  const areas: Uint8Array[] = [];
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || label[start] !== -1) continue;
    const id = areas.length;
    const area = new Uint8Array(width * height);
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const p = stack.pop()!;
      area[p] = mask[p]!;
      const x = p % width, y = (p - x) / width;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const q = ny * width + nx;
          if (mask[q] && label[q] === -1) { label[q] = id; stack.push(q); }
        }
      }
    }
    areas.push(area);
  }
  return areas;
}

/**
 * Heal a straight-alpha frame where `mask` (0 to 255) is painted, each separate
 * painted area as its own spot, in reading order of where each area starts. Pixels
 * outside the mask come back byte for byte; the input is not changed.
 */
export function healFrame(frame: HealFrame, mask: Uint8Array, opts: HealOptions): HealFrame {
  const { width, height, data } = frame;
  const work = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const a = data[i * 4 + 3]!;
    work[i * 4] = Math.round((data[i * 4]! * a) / 255);
    work[i * 4 + 1] = Math.round((data[i * 4 + 1]! * a) / 255);
    work[i * 4 + 2] = Math.round((data[i * 4 + 2]! * a) / 255);
    work[i * 4 + 3] = a;
  }
  for (const area of paintedAreas(mask, width, height)) spotHealPremultiplied(work, area, width, height, opts);
  const out = new Uint8ClampedArray(data);
  for (let i = 0; i < width * height; i++) {
    if (!mask[i]) continue;
    const a = work[i * 4 + 3]!;
    out[i * 4 + 3] = a;
    for (let c = 0; c < 3; c++) out[i * 4 + c] = a ? Math.round((work[i * 4 + c]! * 255) / a) : 0;
  }
  return { width, height, data: out };
}
