// SPDX-License-Identifier: MPL-2.0
/**
 * Geometry for the PDF SVG painter (export-pdf-svg.ts): affine matrices, SVG lengths,
 * the viewBox mapping, every basic shape as subpaths, tight bounding boxes and path
 * emission through a matrix. It reads attributes only and draws nothing itself.
 *
 * Matrices use the SVG and PDF operand order (a b c d e f), and `mul(m, n)` applies n
 * first and then m, which is how a child's transform composes onto its parent's.
 */
import { parseSvgPath } from '@lolly/engine';
import { parseTransformList } from './svg-ir.ts';
import type { Mat } from './svg-ir.ts';
import type { PdfDoc } from './export-pdf-doc.ts';

export type { Mat };
/** One subpath, in the shape the engine's path reader returns. */
export type SubPath = ReturnType<typeof parseSvgPath>[number];
export interface Box { x: number; y: number; w: number; h: number }

export const IDENT: Mat = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

export function mul(m: Mat, n: Mat): Mat {
  return {
    a: m.a * n.a + m.c * n.b, b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d, d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e, f: m.b * n.e + m.d * n.f + m.f,
  };
}

export function invert(m: Mat): Mat | null {
  const det = m.a * m.d - m.b * m.c;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  return {
    a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det, f: (m.b * m.e - m.a * m.f) / det,
  };
}

export const translate = (x: number, y: number): Mat => ({ a: 1, b: 0, c: 0, d: 1, e: x, f: y });
export const isIdentity = (m: Mat): boolean => m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0 && m.f === 0;
export const point = (m: Mat, x: number, y: number): [number, number] => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
/** How much the matrix scales a length, as the square root of its area factor. */
export const lengthScale = (m: Mat): number => Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));

/** A transform list, or null when it is absent, unreadable or the identity. */
export function parseTransform(raw: string | null | undefined): Mat | null {
  if (!raw) return null;
  const m = parseTransformList(raw);
  return [m.a, m.b, m.c, m.d, m.e, m.f].every(Number.isFinite) && !isIdentity(m) ? m : null;
}

/** An element's own `transform` attribute (see parseTransform). */
export const transformOf = (el: Element): Mat | null => parseTransform(el.getAttribute('transform'));

/**
 * A computed CSS transform: null for none; a matrix for matrix() or for a matrix3d()
 * that has no perspective (its x and y are affine in x and y, as an SVG element is
 * drawn); 'perspective' for one that does.
 */
export function parseCssTransform(raw: string): Mat | null | 'perspective' {
  const m = /^\s*matrix(3d)?\(([^)]*)\)\s*$/.exec(raw);
  if (!m) return null;
  const v = m[2]!.split(',').map(Number);
  if (!v.every(Number.isFinite)) return null;
  if (!m[1]) return v.length === 6 ? { a: v[0]!, b: v[1]!, c: v[2]!, d: v[3]!, e: v[4]!, f: v[5]! } : null;
  if (v.length !== 16) return null;
  if (v[3] !== 0 || v[7] !== 0 || v[11] !== 0 || v[15] !== 1) return 'perspective';
  return { a: v[0]!, b: v[1]!, c: v[4]!, d: v[5]!, e: v[12]!, f: v[13]! };
}

const UNIT_PX: Record<string, number> = { px: 1, pt: 4 / 3, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 };

/** An SVG length in user units. A percentage is of `ref`; an absolute unit converts at 96 per inch. */
export function len(raw: string | null | undefined, ref: number, fallback = 0): number {
  if (raw == null) return fallback;
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(%|px|pt|pc|mm|cm|in)?\s*$/i.exec(raw);
  if (!m) return fallback;
  const v = Number(m[1]);
  const unit = (m[2] ?? '').toLowerCase();
  if (unit === '%') return (v / 100) * ref;
  return v * (UNIT_PX[unit] ?? 1);
}

/**
 * The first length of a list such as a `<text>` element's x="10 30 50", the value
 * that places the first character. One value is a list of one.
 */
export function firstLen(raw: string | null | undefined, ref: number, fallback = 0): number {
  if (raw == null) return fallback;
  return len(raw.trim().split(/[\s,]+/)[0], ref, fallback);
}

/** The viewport's reference lengths: width, height and the normalised diagonal. */
export interface Viewport { w: number; h: number }
export const diag = (vp: Viewport): number => Math.sqrt((vp.w * vp.w + vp.h * vp.h) / 2);

/** A viewBox attribute as a box, or null when absent or unusable. */
export function viewBoxOf(el: Element): Box | null {
  const v = (el.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  if (v.length !== 4 || !v.every(Number.isFinite) || !(v[2]! > 0) || !(v[3]! > 0)) return null;
  return { x: v[0]!, y: v[1]!, w: v[2]!, h: v[3]! };
}

/** The matrix that places `vb` into `box` under a preserveAspectRatio value. */
export function viewBoxMatrix(vb: Box, box: Box, par: string | null): Mat {
  let sx = box.w / vb.w, sy = box.h / vb.h;
  let ox = box.x, oy = box.y;
  const spec = (par ?? '').trim() || 'xMidYMid meet';
  if (!/^none\b/i.test(spec)) {
    const align = spec.split(/\s+/)[0] ?? 'xMidYMid';
    const s = /\bslice\b/i.test(spec) ? Math.max(sx, sy) : Math.min(sx, sy);
    ox += (box.w - vb.w * s) * (align.includes('xMax') ? 1 : align.includes('xMid') ? 0.5 : 0);
    oy += (box.h - vb.h * s) * (align.includes('YMax') ? 1 : align.includes('YMid') ? 0.5 : 0);
    sx = sy = s;
  }
  return { a: sx, b: 0, c: 0, d: sy, e: ox - vb.x * sx, f: oy - vb.y * sy };
}

export function rectSubpaths(x: number, y: number, w: number, h: number): SubPath[] {
  return parseSvgPath(`M${x} ${y}H${x + w}V${y + h}H${x}Z`);
}

const n = (el: Element, name: string, ref: number): number => len(el.getAttribute(name), ref);

/**
 * An element's outline as subpaths in its own user space, or null when it is not a
 * shape or draws nothing. Rounded corners and ellipses are arcs, which the shared
 * path reader turns into cubics.
 */
export function shapeSubpaths(el: Element, vp: Viewport): SubPath[] | null {
  switch (el.localName) {
    case 'path': {
      const d = el.getAttribute('d') ?? '';
      return d.trim() ? parseSvgPath(d) : null;
    }
    case 'rect': {
      const x = n(el, 'x', vp.w), y = n(el, 'y', vp.h), w = n(el, 'width', vp.w), h = n(el, 'height', vp.h);
      if (!(w > 0) || !(h > 0)) return null;
      const rxRaw = el.getAttribute('rx'), ryRaw = el.getAttribute('ry');
      let rx = rxRaw != null && rxRaw !== 'auto' ? len(rxRaw, vp.w) : NaN;
      let ry = ryRaw != null && ryRaw !== 'auto' ? len(ryRaw, vp.h) : NaN;
      if (Number.isNaN(rx)) rx = Number.isNaN(ry) ? 0 : ry;
      if (Number.isNaN(ry)) ry = rx;
      rx = Math.min(Math.max(0, rx), w / 2);
      ry = Math.min(Math.max(0, ry), h / 2);
      if (!(rx > 0) || !(ry > 0)) return rectSubpaths(x, y, w, h);
      return parseSvgPath(`M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}`
        + `A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}`
        + `V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`);
    }
    case 'circle':
    case 'ellipse': {
      const cx = n(el, 'cx', vp.w), cy = n(el, 'cy', vp.h);
      const rx = el.localName === 'circle' ? n(el, 'r', diag(vp)) : len(el.getAttribute('rx'), vp.w, NaN);
      const ry = el.localName === 'circle' ? rx : len(el.getAttribute('ry'), vp.h, NaN);
      const ex = Number.isNaN(rx) ? ry : rx, ey = Number.isNaN(ry) ? rx : ry;
      if (!(ex > 0) || !(ey > 0)) return null;
      return parseSvgPath(`M${cx + ex} ${cy}A${ex} ${ey} 0 1 1 ${cx - ex} ${cy}A${ex} ${ey} 0 1 1 ${cx + ex} ${cy}Z`);
    }
    case 'line':
      return parseSvgPath(`M${n(el, 'x1', vp.w)} ${n(el, 'y1', vp.h)}L${n(el, 'x2', vp.w)} ${n(el, 'y2', vp.h)}`);
    case 'polyline':
    case 'polygon': {
      const pts = (el.getAttribute('points') ?? '').match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g);
      if (!pts || pts.length < 4) return null;
      let d = `M${pts[0]} ${pts[1]}`;
      for (let i = 2; i + 1 < pts.length; i += 2) d += `L${pts[i]} ${pts[i + 1]}`;
      return parseSvgPath(el.localName === 'polygon' ? `${d}Z` : d);
    }
    default:
      return null;
  }
}

/** Roots in [0, 1] of the derivative of one cubic coordinate, where it turns. */
function cubicTurns(p0: number, p1: number, p2: number, p3: number): number[] {
  const d0 = p1 - p0, d1 = p2 - p1, d2 = p3 - p2;
  const a = d0 - 2 * d1 + d2, b = 2 * (d1 - d0), c = d0;
  const out: number[] = [];
  if (Math.abs(a) < 1e-12) { if (Math.abs(b) > 1e-12) out.push(-c / b); }
  else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) { const r = Math.sqrt(disc); out.push((-b + r) / (2 * a), (-b - r) / (2 * a)); }
  }
  return out.filter(t => t > 0 && t < 1);
}

const cubicAt = (p0: number, p1: number, p2: number, p3: number, t: number): number => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

/** The tight box of the outline after `m`: a curve counts where it turns, not at its control points. */
export function subpathsBox(subs: readonly SubPath[], m: Mat = IDENT): Box | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x: number, y: number): void => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const sub of subs) {
    let cx = 0, cy = 0;
    for (const seg of sub.segments) {
      const [x, y] = point(m, seg.x, seg.y);
      if (seg.op === 'C') {
        const [ax, ay] = point(m, seg.x1, seg.y1), [bx, by] = point(m, seg.x2, seg.y2);
        for (const t of cubicTurns(cx, ax, bx, x)) add(cubicAt(cx, ax, bx, x, t), cubicAt(cy, ay, by, y, t));
        for (const t of cubicTurns(cy, ay, by, y)) add(cubicAt(cx, ax, bx, x, t), cubicAt(cy, ay, by, y, t));
      }
      add(x, y);
      cx = x; cy = y;
    }
  }
  return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}

export function unionBox(a: Box | null, b: Box | null): Box | null {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** A box's four corners through `m`, boxed again. */
export function mapBox(box: Box, m: Mat): Box {
  const pts = [point(m, box.x, box.y), point(m, box.x + box.w, box.y), point(m, box.x, box.y + box.h), point(m, box.x + box.w, box.y + box.h)];
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Add the outline to the current path, every point through `m`. The caller paints or clips. */
export function emitSubpaths(pdf: Pick<PdfDoc, 'moveTo' | 'lineTo' | 'curveTo' | 'close'>, subs: readonly SubPath[], m: Mat = IDENT): void {
  for (const sub of subs) {
    for (const seg of sub.segments) {
      const [x, y] = point(m, seg.x, seg.y);
      if (seg.op === 'M') pdf.moveTo(x, y);
      else if (seg.op === 'L') pdf.lineTo(x, y);
      else {
        const [x1, y1] = point(m, seg.x1, seg.y1), [x2, y2] = point(m, seg.x2, seg.y2);
        pdf.curveTo(x1, y1, x2, y2, x, y);
      }
    }
    if (sub.closed) pdf.close();
  }
}
