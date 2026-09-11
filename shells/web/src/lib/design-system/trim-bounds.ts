// SPDX-License-Identifier: MPL-2.0
/**
 * trim-bounds.ts - pure content-bounds trim core (plan 97 SS7.3, gap 4 in SS4).
 *
 * SVG bounds are computed textually, with no DOM: the shells that need this (the
 * upload dropzone, the logo room, catalogue details) run the same computation in
 * the CLI/jsdom-free test path, so a tag/attribute scan plus the engine's exact
 * cubic-Bezier path bounds (`pathBounds`) stands in for `getBBox`. A live-mount
 * `getBBox` adapter belongs beside a DOM-owning caller, not here.
 *
 * Raster bounds are a plain RGBA alpha scan - no canvas, no image decode; callers
 * hand over already-decoded pixel bytes.
 */

import { parseSvgPath, pathFromSubPaths, pathBounds } from '@lolly/engine';

export interface Box { x: number; y: number; width: number; height: number }

/** Axis-aligned box in local shape coordinates, before any ancestor transform. */
interface LocalBox { x0: number; y0: number; x1: number; y1: number }

/** 2D affine matrix [a, b, c, d, e, f]: x' = a*x + c*y + e, y' = b*x + d*y + f. */
type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

function applyMatrix(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

const TRANSFORM_FN_RE = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;

/**
 * translate/scale/matrix are exact. rotate/skewX/skewY are folded into the same
 * matrix and then applied to a shape's four local corners - for a rotated shape
 * that yields the tight AABB of the *rotated box*, not necessarily of the shape
 * itself (a rotated thin diagonal line reports a squarer box than its ink). That
 * corner-hull approximation is the documented trade from plan 97 SS7.3.
 */
function parseTransform(value: string): Matrix {
  let m: Matrix = IDENTITY;
  TRANSFORM_FN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TRANSFORM_FN_RE.exec(value))) {
    const fn = match[1]!;
    const args = match[2]!.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    let fm: Matrix = IDENTITY;
    switch (fn) {
      case 'matrix':
        if (args.length === 6) fm = args as Matrix;
        break;
      case 'translate': {
        const [tx = 0, ty = 0] = args;
        fm = [1, 0, 0, 1, tx, ty];
        break;
      }
      case 'scale': {
        const [sx = 1, syArg] = args;
        const sy = syArg === undefined ? sx : syArg;
        fm = [sx, 0, 0, sy, 0, 0];
        break;
      }
      case 'rotate': {
        const [deg = 0, cx = 0, cy = 0] = args;
        const rad = (deg * Math.PI) / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const rot: Matrix = [cos, sin, -sin, cos, 0, 0];
        fm = (cx || cy) ? multiply(multiply([1, 0, 0, 1, cx, cy], rot), [1, 0, 0, 1, -cx, -cy]) : rot;
        break;
      }
      case 'skewX': {
        const [deg = 0] = args;
        fm = [1, 0, Math.tan((deg * Math.PI) / 180), 1, 0, 0];
        break;
      }
      case 'skewY': {
        const [deg = 0] = args;
        fm = [1, Math.tan((deg * Math.PI) / 180), 0, 1, 0, 0];
        break;
      }
    }
    m = multiply(m, fm);
  }
  return m;
}

function num(v: string | undefined, def: number): number {
  const n = v !== undefined ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : def;
}

function parsePoints(s: string): [number, number][] {
  const nums = s.trim().split(/[\s,]+/).filter(Boolean).map(Number);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    if (Number.isFinite(nums[i]) && Number.isFinite(nums[i + 1])) out.push([nums[i]!, nums[i + 1]!]);
  }
  return out;
}

/** Local (untransformed) bounds of one geometry element, or null when it has none. */
function shapeBox(name: string, attrs: Record<string, string>): LocalBox | null {
  switch (name) {
    case 'rect': {
      const w = num(attrs.width, NaN), h = num(attrs.height, NaN);
      if (!(w > 0 && h > 0)) return null;
      const x = num(attrs.x, 0), y = num(attrs.y, 0);
      return { x0: x, y0: y, x1: x + w, y1: y + h };
    }
    case 'image': {
      const w = num(attrs.width, NaN), h = num(attrs.height, NaN);
      if (!(w > 0 && h > 0)) return null;
      const x = num(attrs.x, 0), y = num(attrs.y, 0);
      return { x0: x, y0: y, x1: x + w, y1: y + h };
    }
    case 'circle': {
      const r = num(attrs.r, NaN);
      if (!(r > 0)) return null;
      const cx = num(attrs.cx, 0), cy = num(attrs.cy, 0);
      return { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r };
    }
    case 'ellipse': {
      const rx = num(attrs.rx, NaN), ry = num(attrs.ry, NaN);
      if (!(rx > 0 && ry > 0)) return null;
      const cx = num(attrs.cx, 0), cy = num(attrs.cy, 0);
      return { x0: cx - rx, y0: cy - ry, x1: cx + rx, y1: cy + ry };
    }
    case 'line': {
      const x1 = num(attrs.x1, 0), y1 = num(attrs.y1, 0), x2 = num(attrs.x2, 0), y2 = num(attrs.y2, 0);
      return { x0: Math.min(x1, x2), y0: Math.min(y1, y2), x1: Math.max(x1, x2), y1: Math.max(y1, y2) };
    }
    case 'polyline':
    case 'polygon': {
      const pts = parsePoints(attrs.points || '');
      if (!pts.length) return null;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      return { x0, y0, x1, y1 };
    }
    case 'path': {
      const d = attrs.d;
      if (!d) return null;
      try {
        const b = pathBounds(pathFromSubPaths(parseSvgPath(d)));
        return b ? { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 } : null;
      } catch {
        return null; // malformed path data - contribute nothing rather than throw
      }
    }
    default:
      return null;
  }
}

function unionBox(a: LocalBox, b: LocalBox): LocalBox {
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}

function transformedHull(box: LocalBox, m: Matrix): LocalBox {
  const corners: [number, number][] = [[box.x0, box.y0], [box.x1, box.y0], [box.x1, box.y1], [box.x0, box.y1]];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of corners) {
    const [tx, ty] = applyMatrix(m, x, y);
    x0 = Math.min(x0, tx); y0 = Math.min(y0, ty); x1 = Math.max(x1, tx); y1 = Math.max(y1, ty);
  }
  return { x0, y0, x1, y1 };
}

const ATTR_RE = /([a-zA-Z_:][\w:.-]*)\s*=\s*"([^"]*)"|([a-zA-Z_:][\w:.-]*)\s*=\s*'([^']*)'/g;

function parseAttrs(blob: string): Record<string, string> {
  const out: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(blob))) {
    if (m[1] !== undefined) out[m[1]] = m[2] ?? '';
    else if (m[3] !== undefined) out[m[3]!] = m[4] ?? '';
  }
  return out;
}

interface TagEvent { closing: boolean; name: string; attrs: Record<string, string>; selfClose: boolean }

const TAG_RE = /<(\/)?([a-zA-Z][\w:.-]*)([^>]*)>/g;

/**
 * Tag-stream tokenizer, not a real XML parser: attribute values are assumed not
 * to contain `>` (true of every real-world SVG this ships against). Good enough
 * for the fixture-driven scan below; a stricter parser is unnecessary DOM-shaped
 * weight for a pure module that must run under plain node.
 */
function* tags(svgText: string): Generator<TagEvent> {
  const stripped = svgText.replace(/<!--[\s\S]*?-->/g, '');
  const re = new RegExp(TAG_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped))) {
    const closing = m[1] === '/';
    const name = m[2]!.toLowerCase();
    let blob = m[3] ?? '';
    let selfClose = false;
    if (/\/\s*$/.test(blob)) { selfClose = true; blob = blob.replace(/\/\s*$/, ''); }
    yield { closing, name, attrs: closing ? {} : parseAttrs(blob), selfClose };
  }
}

/** Definition-only containers: content never renders unless referenced (`<use>`,
 *  a fill paint server, …), so it must not count toward visible content bounds - 
 *  the same non-render rule the task states for `<defs>` extended to its siblings. */
const NON_RENDERING = new Set(['defs', 'symbol', 'clippath', 'mask', 'pattern']);

interface Frame { name: string; matrix: Matrix; hidden: boolean; skip: boolean }

function isHiddenAttrs(attrs: Record<string, string>): boolean {
  const style = attrs.style || '';
  return attrs.display === 'none' || attrs.visibility === 'hidden'
    || /display\s*:\s*none/.test(style) || /visibility\s*:\s*hidden/.test(style);
}

export function svgContentBounds(svgText: string): Box | null {
  let box: LocalBox | null = null;
  const stack: Frame[] = [{ name: '#root', matrix: IDENTITY, hidden: false, skip: false }];

  for (const tag of tags(svgText)) {
    if (tag.closing) {
      const top = stack[stack.length - 1]!;
      if (stack.length > 1 && top.name === tag.name) stack.pop();
      continue;
    }
    const top = stack[stack.length - 1]!;
    const skip = top.skip || NON_RENDERING.has(tag.name);
    const hidden = top.hidden || isHiddenAttrs(tag.attrs);
    const matrix = tag.attrs.transform ? multiply(top.matrix, parseTransform(tag.attrs.transform)) : top.matrix;

    if (!tag.selfClose) stack.push({ name: tag.name, matrix, hidden, skip });

    if (skip || hidden) continue;
    const local = shapeBox(tag.name, tag.attrs);
    if (!local) continue;
    const hull = transformedHull(local, matrix);
    box = box ? unionBox(box, hull) : hull;
  }

  return box ? { x: box.x0, y: box.y0, width: box.x1 - box.x0, height: box.y1 - box.y0 } : null;
}

function fmt(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

/**
 * Root `<svg>`'s current extent, for the "trim would not change anything" check:
 * viewBox if present, else width/height treated as a `0 0 w h` box, else null
 * (nothing to compare against - the trim always applies).
 */
function currentRootBox(rootAttrs: Record<string, string>): Box | null {
  if (rootAttrs.viewBox) {
    const parts = rootAttrs.viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      return { x: parts[0]!, y: parts[1]!, width: parts[2]!, height: parts[3]! };
    }
  }
  const w = parseFloat(rootAttrs.width ?? '');
  const h = parseFloat(rootAttrs.height ?? '');
  if (Number.isFinite(w) && Number.isFinite(h)) return { x: 0, y: 0, width: w, height: h };
  return null;
}

const EDGE_EPS = 0.5;

function sameBox(a: Box, b: Box): boolean {
  return Math.abs(a.x - b.x) <= EDGE_EPS
    && Math.abs(a.y - b.y) <= EDGE_EPS
    && Math.abs((a.x + a.width) - (b.x + b.width)) <= EDGE_EPS
    && Math.abs((a.y + a.height) - (b.y + b.height)) <= EDGE_EPS;
}

/**
 * Runs BEFORE `storeUserUpload` normalisation (the ordering gotcha from plan 97
 * SS7.3), so this must not assume the root `<svg>` already has a viewBox or that
 * width/height are absent - both are handled directly here rather than deferred
 * to a later normalise pass.
 */
export function trimSvgToContent(svgText: string, opts?: { pad?: number }): { svg: string; box: Box } | null {
  const bounds = svgContentBounds(svgText);
  if (!bounds) return null;
  const pad = opts?.pad ?? 0;
  const box: Box = { x: bounds.x - pad, y: bounds.y - pad, width: bounds.width + pad * 2, height: bounds.height + pad * 2 };

  const rootMatch = /<svg\b[^>]*>/i.exec(svgText);
  if (!rootMatch) return null;
  const rootTag = rootMatch[0];
  const rootAttrs = parseAttrs(rootTag);

  const current = currentRootBox(rootAttrs);
  if (current && sameBox(current, box)) return null;

  const viewBoxValue = `${fmt(box.x)} ${fmt(box.y)} ${fmt(box.width)} ${fmt(box.height)}`;
  let newRootTag = rootTag
    .replace(/\s(width|height)\s*=\s*"[^"]*"/gi, '')
    .replace(/\s(width|height)\s*=\s*'[^']*'/gi, '');
  newRootTag = /\bviewBox\s*=/i.test(newRootTag)
    ? newRootTag.replace(/viewBox\s*=\s*"[^"]*"/i, `viewBox="${viewBoxValue}"`).replace(/viewBox\s*=\s*'[^']*'/i, `viewBox="${viewBoxValue}"`)
    : newRootTag.replace(/<svg\b/i, `<svg viewBox="${viewBoxValue}"`);

  const svg = svgText.slice(0, rootMatch.index) + newRootTag + svgText.slice(rootMatch.index + rootTag.length);
  return { svg, box };
}

/** Shared edge-scan: tight box over whichever pixels `hit` calls content.
 *  Scans inward and stops at the first hit per edge, never allocating a
 *  scratch buffer - this runs against full-resolution upload bytes. */
function scanBounds(width: number, height: number, hit: (x: number, y: number) => boolean): Box | null {
  let top = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (hit(x, y)) { top = y; break; }
    }
    if (top !== -1) break;
  }
  if (top === -1) return null;

  let bottom = top;
  for (let y = height - 1; y >= top; y--) {
    let found = false;
    for (let x = 0; x < width; x++) {
      if (hit(x, y)) { found = true; break; }
    }
    if (found) { bottom = y; break; }
  }

  let left = 0;
  for (let x = 0; x < width; x++) {
    let found = false;
    for (let y = top; y <= bottom; y++) {
      if (hit(x, y)) { found = true; break; }
    }
    if (found) { left = x; break; }
  }

  let right = width - 1;
  for (let x = width - 1; x >= left; x--) {
    let found = false;
    for (let y = top; y <= bottom; y++) {
      if (hit(x, y)) { found = true; break; }
    }
    if (found) { right = x; break; }
  }

  return { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

/**
 * Tight pixel box over premultiplied-agnostic alpha bytes. Alpha ONLY - an
 * opaque image always reports the whole frame. Kept for callers that really
 * mean ink-vs-transparent (brand-editor's logo classify); trims should use
 * {@link rasterContentBounds}, which also treats a flat white/black border
 * as margin.
 */
export function rasterAlphaBounds(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  opts?: { alphaMin?: number },
): Box | null {
  const alphaMin = opts?.alphaMin ?? 0;
  return scanBounds(width, height, (x, y) => data[(y * width + x) * 4 + 3]! > alphaMin);
}

/** Squared RGB distance below which a pixel still counts as the flat background.
 *  The logo-wall tool's proven constant (hooks.js measureContent): ~34 of
 *  Euclidean RGB distance, wide enough for JPEG noise on flat white, tight
 *  enough that any real ink registers as content. */
const BG_DIST2 = 1200;

/**
 * The flat border colour of an opaque image, or null when margins are not a
 * flat near-white/near-black fill. Same detection the logo-wall tool ships: a
 * flat background fills every edge, so its colour shows in ALL four corners;
 * the reference is the per-channel MEDIAN of the corners, so artwork running
 * into one corner doesn't poison it the way a mean would. Restricted to
 * near-white / near-black fills (the margins users actually mean - plan 97
 * trim, Andy 2026-08-20): a flat brand-colour card stays untouched.
 */
function flatBorderColor(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): [number, number, number] | null {
  const corner = (x: number, y: number): [number, number, number, number] => {
    const p = (y * width + x) * 4;
    return [data[p]!, data[p + 1]!, data[p + 2]!, data[p + 3]!];
  };
  const cs = [corner(0, 0), corner(width - 1, 0), corner(0, height - 1), corner(width - 1, height - 1)];
  // Any (near-)transparent corner means the image is alpha-keyed - alpha alone marks content.
  if (cs.some(c => c[3] < 200)) return null;
  const med4 = (a: number[]): number => {
    const s = a.slice().sort((m, n) => m - n);
    return (s[1]! + s[2]!) / 2;
  };
  const bg: [number, number, number] = [0, 1, 2].map(k => med4(cs.map(c => c[k]!))) as [number, number, number];
  const nearWhite = bg.every(v => v >= 243);
  const nearBlack = bg.every(v => v <= 12);
  return nearWhite || nearBlack ? bg : null;
}

/**
 * Content bounds for a TRIM: transparent pixels are margin, and - when the
 * image is opaque with a flat near-white or near-black border - pixels of that
 * background colour are margin too. A white-matted JPEG logo trims exactly
 * like its transparent-PNG twin. Detection is corner-driven (see
 * {@link flatBorderColor}); an image whose corners disagree, or whose flat
 * border is any other colour, falls back to the plain alpha scan.
 */
export function rasterContentBounds(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  opts?: { alphaMin?: number },
): Box | null {
  const alphaMin = opts?.alphaMin ?? 0;
  const bg = flatBorderColor(data, width, height);
  if (!bg) return rasterAlphaBounds(data, width, height, opts);
  return scanBounds(width, height, (x, y) => {
    const p = (y * width + x) * 4;
    if (data[p + 3]! <= alphaMin) return false;
    const dr = data[p]! - bg[0], dg = data[p + 1]! - bg[1], db = data[p + 2]! - bg[2];
    return dr * dr + dg * dg + db * db > BG_DIST2;
  });
}

