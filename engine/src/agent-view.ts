// SPDX-License-Identifier: MPL-2.0
/**
 * agent-view.ts - helpers that let an agent LOOK at a render in the render's own
 * coordinates: frame a region of it, lay a labelled grid over it, read colours
 * at points, and name the nearest design-system colour (plans/289 section 6).
 *
 * An agent that edits a Design document by layer id still has to decide where a
 * caption goes or whether two things overlap, and a small picture with no
 * scale makes it guess. The grid's labels are in the document's own units -
 * the SVG viewBox, which for Design is the artboard's pixel space, so the
 * numbers on the grid are the numbers in a layer's x, y, w and h.
 *
 * DOM-free and dependency-free: the SVG work is string work and the sampling
 * reads an RGBA buffer. Whoever rasterises (resvg in the MCP server and the CLI)
 * owns the pixels. The grid's numbers are drawn as stroked vector digits, not
 * text, so they render the same on a server that has no fonts installed.
 */

import { deltaEOkSrgb, linearSrgbToOklab, srgbToLinear } from './brand-derive.ts';

/** A rectangle in document units. */
export interface ViewRegion { x: number; y: number; w: number; h: number }

const NUM = '-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][-+]?\\d+)?';

/** The root `<svg ...>` start tag: its span and its raw attribute text. */
function rootTag(svg: string): { start: number; end: number; attrs: string } | null {
  const m = /<svg\b/i.exec(svg);
  if (!m) return null;
  let i = m.index + 4, quote = '';
  for (; i < svg.length; i++) {
    const c = svg[i]!;
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '>') break;
  }
  if (i >= svg.length) return null;
  const selfClosing = svg[i - 1] === '/';
  return { start: m.index, end: i + 1, attrs: svg.slice(m.index + 4, selfClosing ? i - 1 : i) };
}

function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(attrs);
  return m ? (m[2] ?? m[3] ?? '') : null;
}

function length(v: string | null): number | null {
  if (v == null) return null;
  const m = new RegExp(`^\\s*(${NUM})\\s*(px)?\\s*$`).exec(v);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * The coordinate space an SVG document draws in: its viewBox, or its width and
 * height when it has none. Null when neither is usable.
 */
export function svgDocumentFrame(svg: string): ViewRegion | null {
  const tag = rootTag(svg);
  if (!tag) return null;
  const vb = attr(tag.attrs, 'viewBox');
  if (vb != null) {
    const n = vb.trim().split(/[\s,]+/).map(Number);
    if (n.length === 4 && n.every(Number.isFinite) && n[2]! > 0 && n[3]! > 0) return { x: n[0]!, y: n[1]!, w: n[2]!, h: n[3]! };
  }
  const w = length(attr(tag.attrs, 'width')), h = length(attr(tag.attrs, 'height'));
  return w && h ? { x: 0, y: 0, w, h } : null;
}

/**
 * A region clamped inside the document frame. No region, or one that misses the
 * frame entirely, is the whole frame. A sliver is widened to one unit.
 */
export function clampRegion(frame: ViewRegion, region?: Partial<ViewRegion> | null): ViewRegion {
  if (!region) return { ...frame };
  const rx = Number(region.x), ry = Number(region.y), rw = Number(region.w), rh = Number(region.h);
  if (![rx, ry, rw, rh].every(Number.isFinite) || rw <= 0 || rh <= 0) return { ...frame };
  const x0 = Math.max(frame.x, rx), y0 = Math.max(frame.y, ry);
  const x1 = Math.min(frame.x + frame.w, rx + rw), y1 = Math.min(frame.y + frame.h, ry + rh);
  if (x1 <= x0 || y1 <= y0) return { ...frame };
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

/** How many pixels a region is drawn at. The whole document is never enlarged;
 *  a region is enlarged to fill `maxSide` (so small type becomes readable), up
 *  to `maxZoom` times the document's own scale. */
export function viewSize(frame: ViewRegion, region: ViewRegion, maxSide = 1024, maxZoom = 8): { width: number; height: number; pxPerUnit: number } {
  const side = Math.max(16, Math.min(4096, Math.round(maxSide)));
  const whole = region.w >= frame.w && region.h >= frame.h;
  const fit = side / Math.max(region.w, region.h);
  const pxPerUnit = whole ? Math.min(1, fit) : Math.min(fit, maxZoom);
  return {
    width: Math.max(1, Math.round(region.w * pxPerUnit)),
    height: Math.max(1, Math.round(region.h * pxPerUnit)),
    pxPerUnit,
  };
}

const fmt = (v: number): string => String(Math.round(v * 1000) / 1000);

/**
 * The same SVG document, drawn to show only `region` at `width` x `height`
 * pixels, with `overlay` (SVG markup in document units) drawn on top. Only the
 * root element's viewBox, width, height and preserveAspectRatio change; the
 * drawing itself is untouched.
 */
export function reframeSvg(svg: string, region: ViewRegion, width: number, height: number, overlay = ''): string {
  const tag = rootTag(svg);
  if (!tag) throw new Error('Not an SVG document.');
  // A size given in the root's style (Filter writes `width:100%;height:auto`)
  // would compete with the frame's, so those two declarations go as well.
  const kept = tag.attrs
    .replace(/\s(viewBox|width|height|preserveAspectRatio)\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/(\sstyle\s*=\s*)(["'])([^"']*)\2/i, (_m, pre: string, q: string, css: string) =>
      `${pre}${q}${css.replace(/(^|;)\s*(width|height)\s*:[^;]*/gi, '$1').replace(/^;+|;+(?=;)/g, '')}${q}`)
    .replace(/\s+$/, '');
  const open = `<svg${kept} viewBox="${fmt(region.x)} ${fmt(region.y)} ${fmt(region.w)} ${fmt(region.h)}" width="${Math.round(width)}" height="${Math.round(height)}" preserveAspectRatio="none">`;
  const selfClosing = svg[tag.end - 2] === '/';
  const body = selfClosing ? `${overlay}</svg>` : (() => {
    const close = svg.lastIndexOf('</svg>');
    if (close < tag.end) throw new Error('SVG root is not closed.');
    return `${svg.slice(tag.end, close)}${overlay}${svg.slice(close)}`;
  })();
  return svg.slice(0, tag.start) + open + body;
}

/** A raster image as an SVG document whose units are its pixels, so a PNG,
 *  JPEG, GIF or WebP render can be framed and gridded like a vector one. */
export function rasterAsSvg(mime: string, base64: string, width: number, height: number): string {
  if (!/^image\/[a-z0-9.+-]+$/i.test(mime)) throw new Error(`Not an image type: ${mime}`);
  if (!/^[A-Za-z0-9+/=]*$/.test(base64)) throw new Error('Image data is not base64.');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`
    + `<image href="data:${mime};base64,${base64}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none"/></svg>`;
}

/** A round grid step (1, 2 or 5 times a power of ten) giving about `lines`
 *  divisions across `extent`. */
export function niceGridSpacing(extent: number, lines = 10): number {
  if (!(extent > 0)) return 1;
  const raw = extent / Math.max(1, lines);
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

/* Digits as strokes on a 4 x 6 cell, so a label needs no font. */
const GLYPHS: Record<string, string> = {
  '0': 'M1 0L3 0L4 1L4 5L3 6L1 6L0 5L0 1Z',
  '1': 'M1 1L2 0L2 6M1 6L3 6',
  '2': 'M0 1L1 0L3 0L4 1L4 2L0 6L4 6',
  '3': 'M0 0L4 0L2 2.5L3 2.5L4 3.5L4 5L3 6L1 6L0 5',
  '4': 'M3 6L3 0L0 4L4 4',
  '5': 'M4 0L0 0L0 2.8L3 2.6L4 3.6L4 5L3 6L0 6',
  '6': 'M3.5 0L1.5 1L0 3.5L0 5L1 6L3 6L4 5L4 4L3 3L1 3L0 4',
  '7': 'M0 0L4 0L1.5 6',
  '8': 'M1 0L3 0L4 1L4 2L3 3L1 3L0 2L0 1ZM1 3L3 3L4 4L4 5L3 6L1 6L0 5L0 4Z',
  '9': 'M0.5 6L2.5 5L4 2.5L4 1L3 0L1 0L0 1L0 2L1 3L3 3L4 2',
  '-': 'M0.5 3L3.5 3',
  '.': 'M2 5.6L2 6',
};

/** A number's label as one path `d`, drawn from (x, y) top-left with digits
 *  `size` units tall. */
function labelPath(text: string, x: number, y: number, size: number): string {
  const s = size / 6, adv = 5.5 * s;
  let d = '';
  [...text].forEach((ch, i) => {
    const g = GLYPHS[ch];
    if (!g) return;
    d += g.replace(/([ML])(-?[\d.]+) (-?[\d.]+)/g, (_m, op: string, gx: string, gy: string) =>
      `${op}${fmt(x + i * adv + Number(gx) * s)} ${fmt(y + Number(gy) * s)}`);
  });
  return d;
}

const label = (v: number): string => fmt(Math.round(v * 100) / 100);

/**
 * A labelled grid over `region`, in document units, at a whole multiple of
 * `spacing`. Every line is drawn twice (a dark line under a light one) so it
 * reads on any picture. Labels sit on the top and left edges, spaced so they
 * never touch: a line without room for its number is drawn but not labelled.
 */
export function gridOverlaySvg(region: ViewRegion, spacing: number, pxPerUnit: number): string {
  if (!(spacing > 0) || !(pxPerUnit > 0)) return '';
  const u = 1 / pxPerUnit; // one output pixel, in document units
  const first = (v0: number) => Math.ceil(v0 / spacing - 1e-9) * spacing;
  const xs: number[] = [], ys: number[] = [];
  for (let x = first(region.x); x <= region.x + region.w + 1e-9 && xs.length < 400; x += spacing) xs.push(x);
  for (let y = first(region.y); y <= region.y + region.h + 1e-9 && ys.length < 400; y += spacing) ys.push(y);
  let lines = '';
  for (const x of xs) lines += `M${fmt(x)} ${fmt(region.y)}V${fmt(region.y + region.h)}`;
  for (const y of ys) lines += `M${fmt(region.x)} ${fmt(y)}H${fmt(region.x + region.w)}`;
  const digit = 9 * u, pad = 3 * u, charW = 5.5 * (digit / 6);
  const widest = Math.max(...[...xs, ...ys].map(v => label(v).length), 1) * charW;
  const step = (gap: number) => Math.max(1, Math.ceil((widest + 4 * pad) / gap));
  const everyX = step(spacing), everyY = Math.max(1, Math.ceil((digit + 4 * pad) / spacing));
  let labels = '';
  xs.forEach((x, i) => { if (i % everyX === 0) labels += labelPath(label(x), x + pad, region.y + pad, digit); });
  ys.forEach((y, i) => { if (i % everyY === 0 && y > region.y + digit + 2 * pad) labels += labelPath(label(y), region.x + pad, y + pad, digit); });
  const w = (px: number) => fmt(px * u);
  return `<g data-lolly-view-grid="" fill="none" stroke-linecap="round" stroke-linejoin="round" pointer-events="none">`
    + `<path d="${lines}" stroke="#000" stroke-opacity=".5" stroke-width="${w(2)}"/>`
    + `<path d="${lines}" stroke="#fff" stroke-opacity=".75" stroke-width="${w(0.75)}"/>`
    + (labels ? `<path d="${labels}" stroke="#fff" stroke-width="${w(4)}"/><path d="${labels}" stroke="#000" stroke-width="${w(1.4)}"/>` : '')
    + '</g>';
}

// ── colours ──────────────────────────────────────────────────────────────────

/** An RGBA pixel buffer, row-major, 4 bytes per pixel. */
export interface PixelImage { data: ArrayLike<number>; width: number; height: number; premultiplied?: boolean }

export interface SampledColor {
  /** `#rrggbb`, or null where every pixel in the disc was transparent. */
  hex: string | null;
  rgb: [number, number, number] | null;
  /** Average opacity across the disc, 0..1. */
  alpha: number;
  /** OKLab [L, a, b]; null when transparent. */
  oklab: [number, number, number] | null;
}

const hex2 = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');

/**
 * The colour at (cx, cy) in pixel coordinates, averaged over a disc of radius
 * `radius` pixels (0 reads the one pixel under the point). Weighted by opacity,
 * so a half-transparent edge pixel counts half, and a premultiplied buffer
 * (resvg's) is read correctly.
 */
export function sampleDisc(img: PixelImage, cx: number, cy: number, radius: number): SampledColor {
  const r = Math.max(0, radius);
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(img.width - 1, Math.floor(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(img.height - 1, Math.floor(cy + r));
  let sr = 0, sg = 0, sb = 0, sa = 0, n = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (r > 0 && dx * dx + dy * dy > (r + 0.5) * (r + 0.5)) continue;
      if (r === 0 && (x !== Math.floor(cx) || y !== Math.floor(cy))) continue;
      const i = (y * img.width + x) * 4;
      const a = img.data[i + 3]!;
      const k = img.premultiplied ? 1 : a / 255;
      sr += img.data[i]! * k; sg += img.data[i + 1]! * k; sb += img.data[i + 2]! * k; sa += a; n++;
    }
  }
  if (!n || sa === 0) return { hex: null, rgb: null, alpha: 0, oklab: null };
  const scale = 255 / sa;
  const rgb: [number, number, number] = [Math.round(sr * scale), Math.round(sg * scale), Math.round(sb * scale)];
  const lab = linearSrgbToOklab(srgbToLinear(rgb[0] / 255), srgbToLinear(rgb[1] / 255), srgbToLinear(rgb[2] / 255));
  return {
    hex: `#${hex2(rgb[0])}${hex2(rgb[1])}${hex2(rgb[2])}`,
    rgb,
    alpha: Math.round((sa / n / 255) * 1000) / 1000,
    oklab: [Math.round(lab[0] * 1e4) / 1e4, Math.round(lab[1] * 1e4) / 1e4, Math.round(lab[2] * 1e4) / 1e4],
  };
}

/** One design-system colour, in the shape `host.tokens.colors()` returns. */
export interface ColorSwatch { value: string; name?: string | null; path?: string | null; ref?: string | null }

export interface SwatchMatch {
  swatch: ColorSwatch;
  /** ΔEOK: 0 identical, about 0.02 just noticeable, 1 black to white. */
  deltaE: number;
  /** 'match' within a just-noticeable difference, 'close' within 0.06, else 'different'. */
  verdict: 'match' | 'close' | 'different';
}

function hexRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1]!.length === 3 ? [...m[1]!].map(c => c + c).join('') : m[1]!;
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

/** The design-system colour nearest to `hex` in OKLab, or null when there are
 *  no readable swatches. */
export function nearestSwatch(hex: string, swatches: readonly ColorSwatch[]): SwatchMatch | null {
  const target = hexRgb(hex);
  if (!target) return null;
  let best: SwatchMatch | null = null;
  for (const swatch of swatches) {
    const rgb = typeof swatch?.value === 'string' ? hexRgb(swatch.value) : null;
    if (!rgb) continue;
    const deltaE = deltaEOkSrgb(target, rgb);
    if (!best || deltaE < best.deltaE) best = { swatch, deltaE, verdict: 'different' };
  }
  if (!best) return null;
  best.deltaE = Math.round(best.deltaE * 1e4) / 1e4;
  best.verdict = best.deltaE <= 0.02 ? 'match' : best.deltaE <= 0.06 ? 'close' : 'different';
  return best;
}
