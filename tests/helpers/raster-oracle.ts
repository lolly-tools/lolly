// SPDX-License-Identifier: MPL-2.0
/** Test-side helpers for pixel oracles: a small PNG decoder and a W3C-style layer flattener. The engine has neither. */
import { inflateSync } from 'node:zlib';
import type { CssBlendMode, LayeredRasterDoc } from '../../engine/src/raster-layers.ts';

export interface Rgba { width: number; height: number; pixels: Uint8Array }

/** Decodes a non-interlaced PNG (grey, RGB, indexed, grey+alpha, RGBA; 8 or 16 bit) to un-premultiplied RGBA8. */
export function decodePng(png: Uint8Array): Rgba {
  const v = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let p = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0;
  const idat: Uint8Array[] = []; let plte: Uint8Array = new Uint8Array(0), trns: Uint8Array = new Uint8Array(0);
  while (p + 8 <= png.length) {
    const len = v.getUint32(p), name = String.fromCharCode(...png.subarray(p + 4, p + 8)), body = png.subarray(p + 8, p + 8 + len);
    if (name === 'IHDR') { width = v.getUint32(p + 8); height = v.getUint32(p + 12); depth = body[8]!; type = body[9]!; interlace = body[12]!; }
    else if (name === 'PLTE') plte = body; else if (name === 'tRNS') trns = body; else if (name === 'IDAT') idat.push(body);
    p += 12 + len;
  }
  if (interlace) throw new Error('Interlaced PNG is not supported by the oracle decoder.');
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[type]!;
  const bpp = Math.max(1, (channels * depth) >> 3), stride = (width * channels * depth + 7) >> 3;
  const raw = new Uint8Array(inflateSync(Buffer.concat(idat))), data = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)]!, row = y * stride, src = y * (stride + 1) + 1;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? data[row + i - bpp]! : 0, b = y ? data[row - stride + i]! : 0, c = y && i >= bpp ? data[row - stride + i - bpp]! : 0;
      let add = 0;
      if (f === 1) add = a; else if (f === 2) add = b; else if (f === 3) add = (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      data[row + i] = (raw[src + i]! + add) & 255;
    }
  }
  const out = new Uint8Array(width * height * 4);
  const sample = (y: number, i: number): number => { // i-th sample of row y, scaled to 0..255
    if (depth === 16) return data[y * stride + i * 2]!;
    if (depth === 8) return data[y * stride + i]!;
    const bit = i * depth, s = (data[y * stride + (bit >> 3)]! >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
    return type === 3 ? s : Math.round(s * 255 / ((1 << depth) - 1));
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const o = (y * width + x) * 4;
    if (type === 3) { const k = sample(y, x); out.set([plte[k * 3]!, plte[k * 3 + 1]!, plte[k * 3 + 2]!, k < trns.length ? trns[k]! : 255], o); }
    else if (type === 0) { const g = sample(y, x); out.set([g, g, g, 255], o); }
    else if (type === 4) { const g = sample(y, x * 2); out.set([g, g, g, sample(y, x * 2 + 1)], o); }
    else if (type === 2) out.set([sample(y, x * 3), sample(y, x * 3 + 1), sample(y, x * 3 + 2), 255], o);
    else out.set([sample(y, x * 4), sample(y, x * 4 + 1), sample(y, x * 4 + 2), sample(y, x * 4 + 3)], o);
  }
  return { width, height, pixels: out };
}

type Rgb = [number, number, number];
const lum = (c: Rgb) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
const clipColor = (c: Rgb): Rgb => {
  const l = lum(c), n = Math.min(...c), x = Math.max(...c); let r: Rgb = c;
  if (n < 0) r = r.map(v => l + (v - l) * l / (l - n)) as Rgb;
  if (x > 1) r = r.map(v => l + (v - l) * (1 - l) / (x - l)) as Rgb;
  return r;
};
const setLum = (c: Rgb, l: number): Rgb => { const d = l - lum(c); return clipColor([c[0] + d, c[1] + d, c[2] + d]); };
const sat = (c: Rgb) => Math.max(...c) - Math.min(...c);
const setSat = (c: Rgb, s: number): Rgb => {
  const idx = [0, 1, 2].sort((a, b) => c[a]! - c[b]!) as [number, number, number], r: Rgb = [0, 0, 0];
  const [lo, mid, hi] = idx;
  if (c[hi]! > c[lo]!) { r[mid] = (c[mid]! - c[lo]!) * s / (c[hi]! - c[lo]!); r[hi] = s; }
  return r;
};
const sep: Partial<Record<CssBlendMode, (b: number, s: number) => number>> = {
  normal: (_b, s) => s, multiply: (b, s) => b * s, screen: (b, s) => b + s - b * s,
  overlay: (b, s) => sep['hard-light']!(s, b), darken: Math.min, lighten: Math.max,
  'color-dodge': (b, s) => b === 0 ? 0 : s >= 1 ? 1 : Math.min(1, b / (1 - s)),
  'color-burn': (b, s) => b >= 1 ? 1 : s <= 0 ? 0 : 1 - Math.min(1, (1 - b) / s),
  'hard-light': (b, s) => s <= 0.5 ? b * 2 * s : b + (2 * s - 1) - b * (2 * s - 1),
  'soft-light': (b, s) => {
    if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
    const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
    return b + (2 * s - 1) * (d - b);
  },
  difference: (b, s) => Math.abs(b - s), exclusion: (b, s) => b + s - 2 * b * s,
};
function blend(mode: CssBlendMode, b: Rgb, s: Rgb): Rgb {
  const f = sep[mode];
  if (f) return [f(b[0], s[0]), f(b[1], s[1]), f(b[2], s[2])];
  if (mode === 'hue') return setLum(setSat(s, sat(b)), lum(b));
  if (mode === 'saturation') return setLum(setSat(b, sat(s)), lum(b));
  if (mode === 'color') return setLum(s, lum(b));
  return setLum(b, lum(s)); // luminosity
}

/**
 * Flattens a layered document the way a browser would (W3C compositing in gamma-encoded sRGB): visible layers,
 * bottom to top, each with its opacity and blend mode. A group contributes its visibility and opacity to its
 * children; group blend modes and isolation are not modelled.
 */
export function flatten(doc: LayeredRasterDoc): Rgba {
  const { width, height } = doc, acc = new Float64Array(width * height * 4); // un-premultiplied colour + alpha
  for (const layer of doc.layers) {
    if (layer.isGroup || !layer.pixels.length) continue;
    let opacity = layer.opacity, visible = layer.visible;
    for (const g of layer.groupPath) { const grp = doc.layers[g]; if (grp) { visible &&= grp.visible; opacity *= grp.opacity; } }
    if (!visible) continue;
    for (let ly = 0; ly < layer.height; ly++) for (let lx = 0; lx < layer.width; lx++) {
      const x = layer.x + lx, y = layer.y + ly;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const si = (ly * layer.width + lx) * 4, di = (y * width + x) * 4;
      const as = layer.pixels[si + 3]! / 255 * opacity;
      if (as <= 0) continue;
      const cs: Rgb = [layer.pixels[si]! / 255, layer.pixels[si + 1]! / 255, layer.pixels[si + 2]! / 255];
      const ab = acc[di + 3]!, cb: Rgb = [acc[di]!, acc[di + 1]!, acc[di + 2]!];
      const bl = blend(layer.blend, cb, cs), ar = as + ab * (1 - as);
      for (let k = 0; k < 3; k++) {
        const mixed = (1 - ab) * cs[k]! + ab * bl[k]!;
        acc[di + k] = ar > 0 ? ((1 - as) * ab * cb[k]! + as * mixed) / ar : 0;
      }
      acc[di + 3] = ar;
    }
  }
  const pixels = new Uint8Array(width * height * 4);
  for (let i = 0; i < pixels.length; i++) pixels[i] = Math.max(0, Math.min(255, Math.round(acc[i]! * 255)));
  return { width, height, pixels };
}

export interface PixelDiff { meanAbs: number; maxAbs: number; overFraction: number; compared: number }
/** Per-channel difference in 0..255 levels. Colour channels are compared only where either alpha is above zero. */
export function diffRgba(a: Rgba, b: Rgba, level: number): PixelDiff {
  if (a.width !== b.width || a.height !== b.height) throw new Error(`Size mismatch ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  let sum = 0, max = 0, over = 0, n = 0;
  for (let i = 0; i < a.pixels.length; i += 4) {
    const visible = a.pixels[i + 3]! > 0 || b.pixels[i + 3]! > 0;
    for (let k = visible ? 0 : 3; k < 4; k++) {
      const d = Math.abs(a.pixels[i + k]! - b.pixels[i + k]!); sum += d; n++; if (d > max) max = d; if (d > level) over++;
    }
  }
  return { meanAbs: sum / n, maxAbs: max, overFraction: over / n, compared: n };
}
