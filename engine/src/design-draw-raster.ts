// SPDX-License-Identifier: MPL-2.0
/** Internal P3f admission. This detached evaluation is never stored in an authored document. */
import { DESIGN_DRAW_VERSION, paddingArea, type DesignDrawPage, type DrawBox, type DrawOp, type DrawShape } from './design-draw.ts';
import * as pmath from './geom/portable-math.ts';
import { parseSvgPath } from './svg-path.ts';
import { lineToCubic, type Cubic } from './geom/bezier.ts';
import { selfUnionChecked } from './geom/boolean.ts';
import { pathBounds, pathFromSubPaths, type Contour, type GeomPath } from './geom/path.ts';
import { strokeToPath, type CapStyle } from './geom/stroke.ts';
import type { JoinStyle } from './geom/offset.ts';

export const DESIGN_RASTER_VERSION = 1;
/**
 * Primitives keep their Skia-matched edge coverage; paths and outlined words are filled
 * by exact per-pixel area over edges flattened to 1/32 output pixel; gradients colour a
 * primitive's coverage per pixel, interpolated premultiplied.
 */
export const DESIGN_RASTER_RECIPE = 'design-static-primitives-edge-aa-area-fills-gradients-rgba8-v3';
export const DESIGN_RASTER_MAX_PIXELS = 16 * 1024 * 1024;
export const DESIGN_RASTER_MAX_OPS = 1024;
export const DESIGN_RASTER_MAX_DIMENSION = 8192;
/** Edges across every fill of one page, and of one fill. */
export const DESIGN_RASTER_MAX_EDGES = 262_144;
export const DESIGN_RASTER_MAX_FILL_EDGES = 65_536;
/** Stops in one gradient. */
export const DESIGN_RASTER_MAX_STOPS = 256;
/** How far a flattened edge may stray from its curve, in output pixels. */
const FLATTEN_TOLERANCE_PX = 1 / 32;

export interface DesignRasterFinding { id: string; feature: string }
export interface DesignRasterPrimitive {
  readonly id: string;
  readonly box: readonly [number, number, number, number];
  readonly shape: 'rect' | 'ellipse';
  readonly radius: number;
  /** Straight sRGB, with the single paint's alpha multiplied by group opacity. */
  readonly color: readonly [number, number, number, number];
  readonly pose: readonly [number, boolean, boolean];
}
/**
 * A filled outline: its edges as straight segments in page coordinates (CSS px), after
 * the operation's pose, closed per contour. `evenOdd` picks the fill rule; the paint is
 * one straight sRGB colour whose alpha already carries the operation's opacity. A stroke
 * arrives here as the outline of the region it paints.
 */
export interface DesignRasterFill {
  readonly id: string;
  /** x0, y0, x1, y1 for each edge. */
  readonly edges: readonly number[];
  readonly evenOdd: boolean;
  readonly color: readonly [number, number, number, number];
  /** The edges' bounds: x0, y0, x1, y1. */
  readonly bounds: readonly [number, number, number, number];
}
/**
 * A gradient over a primitive's outline, as CSS paints a background image: on the box
 * inside the border and repeated across the box. `geometry` is the gradient line's two
 * ends (linear) or the ellipse's centre and radii (radial, to the farthest corner), and
 * `tile` the box it repeats, both in page coordinates before the primitive's pose.
 * `stops` holds, per stop, its offset then straight sRGB and alpha, the alpha already
 * carrying the operation's opacity. Colours interpolate premultiplied, as CSS does.
 */
export interface DesignRasterGradient {
  readonly id: string;
  /** The primitive whose box, outline and pose the gradient paints. */
  readonly primitive: number;
  readonly kind: 'linear' | 'radial';
  readonly geometry: readonly [number, number, number, number];
  readonly tile: readonly [number, number, number, number];
  readonly stops: readonly number[];
}
/** One step of the paint order: a primitive, a fill or a gradient, by index. */
export type DesignRasterPaint = readonly ['primitive' | 'fill' | 'gradient', number];

export interface DesignRasterEvaluation {
  readonly version: typeof DESIGN_RASTER_VERSION;
  readonly drawingVersion: typeof DESIGN_DRAW_VERSION;
  readonly recipe: typeof DESIGN_RASTER_RECIPE;
  readonly width: number;
  readonly height: number;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly dpi: number;
  /** Empty in this slice: pictures and fonts refuse admission rather than inventing resource identities. */
  readonly resources: readonly [];
  readonly ops: readonly DesignRasterPrimitive[];
  readonly fills: readonly DesignRasterFill[];
  readonly gradients: readonly DesignRasterGradient[];
  /** Primitives, fills and gradients in paint order. */
  readonly paint: readonly DesignRasterPaint[];
}
export type DesignRasterAdmission = { ok: true; evaluation: DesignRasterEvaluation } | { ok: false; findings: DesignRasterFinding[] };

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const size = (n: unknown): n is number => finite(n) && Number.isInteger(n) && n >= 1 && n <= DESIGN_RASTER_MAX_DIMENSION;
const keys = (v: object, admitted: readonly string[]) => Object.keys(v).every(k => admitted.includes(k));
const exact = (v: object, admitted: readonly string[]) => Object.keys(v).length === admitted.length && keys(v, admitted);
const unit = (n: unknown): n is number => finite(n) && n >= 0 && n <= 1;
const dense = (value: readonly unknown[]) => { for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) return false; return true; };

function primitive(op: DrawOp, findings: DesignRasterFinding[]): DesignRasterPrimitive | null {
  const reject = (feature: string): null => { findings.push({ id: typeof op?.id === 'string' ? op.id.slice(0, 256) : '', feature }); return null; };
  if (op?.op !== 'shape') return reject('raster-op');
  if (!keys(op, ['id', 'op', 'box', 'shape', 'fills', 'stroke', 'opacity', 'pose', 'words'])) return reject('raster-feature');
  const b = op.box, s = op.shape;
  if (typeof op.id !== 'string' || op.id.length > 256 || !b || !keys(b, ['x', 'y', 'w', 'h'])
    || ![b.x, b.y, b.w, b.h].every(finite) || b.w <= 0 || b.h <= 0
    || Math.max(Math.abs(b.x), Math.abs(b.y), b.w, b.h) > 1e6) return reject('raster-geometry');
  if (!s || (s.kind !== 'rect' && s.kind !== 'ellipse')) return reject('raster-path');
  if (!keys(s, s.kind === 'rect' ? ['kind', 'radius'] : ['kind'])) return reject('raster-shape');
  const radius = s.kind === 'rect' ? s.radius : 0;
  if (!finite(radius) || radius < 0 || radius > Math.min(b.w, b.h) / 2) return reject('raster-radius');
  // At most a colour, then a gradient over it, as Design paints `bg` under `grad`.
  if (!finite(op.opacity) || op.opacity < 0 || op.opacity > 100 || !Array.isArray(op.fills) || op.fills.length > 2 || !dense(op.fills)
    || !op.fills.every(f => f && typeof f === 'object')
    || op.fills.length === 2 && (op.fills[0]!.kind !== 'color' || op.fills[1]!.kind === 'color')) return reject('raster-paint');
  const paint = op.fills[0]?.kind === 'color' ? op.fills[0] : undefined;
  if (paint && (!keys(paint, ['kind', 'color', 'opacity']) || !/^#[\da-f]{6}$/i.test(paint.color)
    || paint.opacity !== undefined && !unit(paint.opacity))) return reject('raster-paint');
  const pose = op.pose;
  if (pose !== undefined && (!pose || typeof pose !== 'object' || !keys(pose, ['rot', 'flipH', 'flipV']) || !finite(pose.rot) || Math.abs(pose.rot) > 1e6
    || typeof pose.flipH !== 'boolean' || typeof pose.flipV !== 'boolean')) return reject('raster-pose');
  const rgb = paint?.kind === 'color' ? [1, 3, 5].map(i => Number.parseInt(paint.color.slice(i, i + 2), 16) / 255) : [0, 0, 0];
  return Object.freeze({ id: op.id, box: Object.freeze([b.x, b.y, b.w, b.h]) as DesignRasterPrimitive['box'],
    shape: s.kind, radius, color: Object.freeze([...rgb, paint ? ((paint as { opacity?: number }).opacity ?? 1) * op.opacity / 100 : 0]) as DesignRasterPrimitive['color'],
    pose: Object.freeze([pose?.rot ?? 0, pose?.flipH ?? false, pose?.flipV ?? false]) as DesignRasterPrimitive['pose'] });
}

/** The operation's pose about its box centre, as SVG composes it: translate, rotate, scale, translate back. */
function poseOf(op: DrawOp): (x: number, y: number) => [number, number] {
  const p = op.pose;
  if (!p || (!p.rot && !p.flipH && !p.flipV)) return (x, y) => [x, y];
  const cx = op.box.x + op.box.w / 2, cy = op.box.y + op.box.h / 2;
  const a = (p.rot * Math.PI) / 180, c = pmath.cos(a), s = pmath.sin(a), sx = p.flipH ? -1 : 1, sy = p.flipV ? -1 : 1;
  return (x, y) => { const dx = (x - cx) * sx, dy = (y - cy) * sy; return [cx + c * dx - s * dy, cy + s * dx + c * dy]; };
}

/** Straight edges for a cubic, enough of them that none strays further than `tolerance` (Wang's bound). */
function flattenCubic(edges: number[], q: readonly number[], tolerance: number, map: (x: number, y: number) => [number, number]): void {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = q as [number, number, number, number, number, number, number, number];
  const ax = x0 - 2 * x1 + x2, ay = y0 - 2 * y1 + y2, bx = x1 - 2 * x2 + x3, by = y1 - 2 * y2 + y3;
  const second = Math.sqrt(Math.max(ax * ax + ay * ay, bx * bx + by * by));
  const n = Math.min(256, Math.max(1, Math.ceil(Math.sqrt((0.75 * second) / tolerance))));
  let [px, py] = map(x0, y0);
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    const x = u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3;
    const y = u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3;
    const [qx, qy] = map(x, y);
    edges.push(px, py, qx, qy);
    px = qx; py = qy;
  }
}

function boundsOf(edges: readonly number[]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < edges.length; i += 2) {
    x0 = Math.min(x0, edges[i]!); x1 = Math.max(x1, edges[i]!);
    y0 = Math.min(y0, edges[i + 1]!); y1 = Math.max(y1, edges[i + 1]!);
  }
  return [x0, y0, x1, y1];
}

const still = (x: number, y: number): [number, number] => [x, y];
const inRange = (path: GeomPath) => path.every(contour => contour.curves.every(q => q.every(n => Math.abs(n) <= 1e6)));
const curveCount = (path: GeomPath) => path.reduce((n, c) => n + c.curves.length, 0);

/**
 * Closed straight edges for a filled path, posed into page pixels. Overlapping contours are
 * merged first: the fill shader sums each edge's winding over a pixel, which counts an
 * overlap twice where it meets a partly covered pixel, and variable-font glyphs keep their
 * overlaps. Null for a coordinate out of range, or when the merge cannot finish within
 * its bounded work.
 */
function fillEdges(path: GeomPath, evenOdd: boolean, tolerance: number, map: (x: number, y: number) => [number, number]): number[] | null {
  if (!inRange(path)) return null;
  // The pose is affine, so posing the control points poses the curves exactly.
  const posed: GeomPath = path.map(contour => ({ closed: true, curves: contour.curves.map(q => {
    const [ax, ay] = map(q[0], q[1]), [bx, by] = map(q[2], q[3]), [cx, cy] = map(q[4], q[5]), [dx, dy] = map(q[6], q[7]);
    return [ax, ay, bx, by, cx, cy, dx, dy] as Cubic;
  }) }));
  const merged = selfUnionChecked(posed, { fillRule: evenOdd ? 'evenodd' : 'nonzero' });
  if (!merged) return null;
  const edges: number[] = [];
  for (const contour of merged) {
    const start = edges.length;
    for (const q of contour.curves) flattenCubic(edges, q, tolerance, still);
    if (edges.length > start) edges.push(edges[edges.length - 2]!, edges[edges.length - 1]!, edges[start]!, edges[start + 1]!);
  }
  return edges;
}

/** Curves one fill may carry into the merge, the bound `selfUnion` answers within. */
const MAX_FILL_CURVES = 8000;

/** Whether a box lies wholly inside a rectangle or ellipse outline (both convex, so its corners decide). */
function boxInside(b: readonly [number, number, number, number], box: DrawBox, shape: Exclude<DrawShape, { kind: 'path' }>): boolean {
  const corners: Array<[number, number]> = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]];
  return corners.every(([x, y]) => {
    if (x < box.x || y < box.y || x > box.x + box.w || y > box.y + box.h) return false;
    if (shape.kind === 'ellipse') {
      const dx = (x - box.x - box.w / 2) / (box.w / 2), dy = (y - box.y - box.h / 2) / (box.h / 2);
      return dx * dx + dy * dy <= 1;
    }
    const r = shape.radius;
    const cx = Math.min(Math.max(x, box.x + r), box.x + box.w - r), cy = Math.min(Math.max(y, box.y + r), box.y + box.h - r);
    return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;
  });
}

const rgbOf = (hex: string): [number, number, number] | null =>
  /^#[\da-f]{6}$/i.test(hex) ? [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number] : null;

/** A pen shape's fill: its contours flattened, posed and closed. Undefined for a shape without one. */
function pathFill(op: DrawOp, tolerance: number, findings: DesignRasterFinding[]): DesignRasterFill | null | undefined {
  const reject = (feature: string): null => { findings.push({ id: op.id.slice(0, 256), feature }); return null; };
  if (op.op !== 'shape' || op.shape.kind !== 'path') return reject('raster-path');
  if (!keys(op, ['id', 'op', 'box', 'shape', 'fills', 'stroke', 'opacity', 'pose'])) return reject('raster-feature');
  if (!finite(op.opacity) || op.opacity < 0 || op.opacity > 100 || !Array.isArray(op.fills) || op.fills.length > 1) return reject('raster-paint');
  if (!op.fills.length) return undefined;
  const paint = op.fills[0]!;
  const rgb = paint.kind === 'color' ? rgbOf(paint.color) : null;
  if (!rgb || (paint.kind === 'color' && paint.opacity !== undefined && !unit(paint.opacity))) return reject('raster-paint');
  // A fill closes every contour, open or not.
  const path: GeomPath = op.shape.contours.map(contour => ({ closed: true, curves: contour.curves.map(q => [...q] as Cubic) }));
  if (curveCount(path) > MAX_FILL_CURVES) return reject('raster-budget');
  const edges = fillEdges(path, op.shape.evenOdd, tolerance, poseOf(op));
  if (!edges) return reject('raster-budget');
  if (!edges.length) return reject('raster-path');
  if (edges.length / 4 > DESIGN_RASTER_MAX_FILL_EDGES || !edges.every(n => Math.abs(n) <= 1e6)) return reject('raster-budget');
  const alpha = ((paint.kind === 'color' ? paint.opacity : undefined) ?? 1) * op.opacity / 100;
  return Object.freeze({ id: op.id, edges: Object.freeze(edges), evenOdd: op.shape.evenOdd, color: Object.freeze([...rgb, alpha]) as DesignRasterFill['color'], bounds: Object.freeze(boundsOf(edges)) as DesignRasterFill['bounds'] });
}

/** Arcs of a quarter turn are split this many ways, so that the cubic strays under `tolerance` (about 2.7e-4 of the radius over n^6). */
function arcSteps(radius: number, tolerance: number): number {
  let n = 1;
  while (n < 64 && 2.7e-4 * radius > tolerance * n ** 6) n++;
  return n;
}

/** One cubic along an ellipse from angle a0 to a1, in radians with y pointing down. */
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): Cubic {
  const k = (4 / 3) * pmath.tan((a1 - a0) / 4);
  const c0 = pmath.cos(a0), s0 = pmath.sin(a0), c1 = pmath.cos(a1), s1 = pmath.sin(a1);
  return [cx + rx * c0, cy + ry * s0, cx + rx * (c0 - k * s0), cy + ry * (s0 + k * c0),
    cx + rx * (c1 + k * s1), cy + ry * (s1 - k * c1), cx + rx * c1, cy + ry * s1];
}

/** A rectangle, rounded rectangle or ellipse as one closed contour, clockwise on screen. */
function outlineContour(b: DrawBox, shape: Exclude<DrawShape, { kind: 'path' }>, tolerance: number): Contour {
  const curves: Cubic[] = [];
  const quarter = Math.PI / 2;
  if (shape.kind === 'ellipse') {
    const rx = b.w / 2, ry = b.h / 2, n = arcSteps(Math.max(rx, ry), tolerance);
    for (let i = 0; i < 4 * n; i++) curves.push(arc(b.x + rx, b.y + ry, rx, ry, (i * quarter) / n, ((i + 1) * quarter) / n));
    return { closed: true, curves };
  }
  const r = Math.min(shape.radius, b.w / 2, b.h / 2), x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
  const n = r > 0 ? arcSteps(r, tolerance) : 0;
  // Each side, then the corner it runs into: centre and starting angle.
  const sides: Array<[number, number, number, number, number, number, number]> = [
    [x0 + r, y0, x1 - r, y0, x1 - r, y0 + r, -quarter], [x1, y0 + r, x1, y1 - r, x1 - r, y1 - r, 0],
    [x1 - r, y1, x0 + r, y1, x0 + r, y1 - r, quarter], [x0, y1 - r, x0, y0 + r, x0 + r, y0 + r, 2 * quarter],
  ];
  for (const [ax, ay, bx, by, cx, cy, start] of sides) {
    if (ax !== bx || ay !== by) curves.push(lineToCubic(ax, ay, bx, by));
    for (let i = 0; i < n; i++) curves.push(arc(cx, cy, r, r, start + (i * quarter) / n, start + ((i + 1) * quarter) / n));
  }
  return { closed: true, curves };
}

const CAPS: readonly string[] = ['butt', 'round', 'square'];
const JOINS: readonly string[] = ['miter', 'round', 'bevel'];

/**
 * A shape's stroke as the fill of the region it paints, drawn over the shape's fills. A
 * box's stroke is a CSS border: the ring between the box and the box inside the border.
 * A pen shape's stroke is centred on its path and outlined by `strokeToPath` with its cap,
 * its join and SVG's mitre limit. Dashes are refused, and so is a stroke over a fill or
 * words when the operation fades as a group. Undefined when the stroke paints nothing.
 */
function strokeFill(op: DrawOp, tolerance: number, findings: DesignRasterFinding[]): DesignRasterFill | null | undefined {
  const reject = (feature: string): null => { findings.push({ id: op.id.slice(0, 256), feature }); return null; };
  const s = op.op === 'shape' ? op.stroke : undefined;
  if (op.op !== 'shape' || !s || typeof s !== 'object' || !keys(s, ['color', 'opacity', 'width', 'cap', 'join', 'dash', 'align'])) return reject('raster-stroke');
  if (s.dash !== undefined) return reject('raster-dash');
  const rgb = typeof s.color === 'string' ? rgbOf(s.color) : null;
  if (!rgb || (s.opacity !== undefined && !unit(s.opacity)) || !finite(s.width) || s.width <= 0 || s.width > 1e4) return reject('raster-stroke');
  if (op.opacity < 100 && (op.fills.length || op.words)) return reject('raster-group');
  let outline: GeomPath, evenOdd = false;
  if (op.shape.kind === 'path') {
    const cap = s.cap ?? 'butt', join = s.join ?? 'miter';
    if (s.align !== undefined || !CAPS.includes(cap) || !JOINS.includes(join)) return reject('raster-stroke');
    const path: GeomPath = op.shape.contours.map(contour => ({ closed: contour.closed === true, curves: contour.curves.map(q => [...q] as Cubic) }));
    if (curveCount(path) > MAX_FILL_CURVES || !inRange(path)) return reject('raster-budget');
    // The pose turns and mirrors without scaling, so outlining before it gives the same region.
    outline = strokeToPath(path, s.width, { cap: cap as CapStyle, join: join as JoinStyle, miterLimit: 4, tol: tolerance });
  } else {
    // A centred stroke on a box is the preview reading, which this renderer does not draw.
    if (s.align !== 'inside' || s.cap !== undefined || s.join !== undefined) return reject('raster-stroke');
    const inner = paddingArea(op.box, op.shape, s);
    outline = [outlineContour(op.box, op.shape, tolerance), ...(inner.box.w > 0 && inner.box.h > 0 ? [outlineContour(inner.box, inner.shape, tolerance)] : [])];
    evenOdd = true;
  }
  if (curveCount(outline) > MAX_FILL_CURVES) return reject('raster-budget');
  const edges = fillEdges(outline, evenOdd, tolerance, poseOf(op));
  if (!edges) return reject('raster-budget');
  if (!edges.length) return undefined;
  if (edges.length / 4 > DESIGN_RASTER_MAX_FILL_EDGES || !edges.every(n => Math.abs(n) <= 1e6)) return reject('raster-budget');
  return Object.freeze({ id: `${op.id}:stroke`.slice(0, 256), edges: Object.freeze(edges), evenOdd: false,
    color: Object.freeze([...rgb, (s.opacity ?? 1) * op.opacity / 100]) as DesignRasterFill['color'], bounds: Object.freeze(boundsOf(edges)) as DesignRasterFill['bounds'] });
}

/**
 * An operation's outlined words as fills, one per run, in paint order. Words the box
 * clip would cut, words over a box that fades as a group, and runs left as live text
 * are refused rather than drawn differently.
 */
function wordFills(op: DrawOp, tolerance: number, findings: DesignRasterFinding[]): DesignRasterFill[] | null {
  const words = op.words, layout = words?.layout;
  if (!words) return [];
  const reject = (feature: string): null => { findings.push({ id: op.id.slice(0, 256), feature }); return null; };
  if (!layout || !words.outlines) return reject('raster-live-text');
  const shape: Exclude<DrawShape, { kind: 'path' }> | null = op.op === 'shape' && op.shape.kind !== 'path' ? op.shape : op.op === 'shape' ? null : { kind: 'rect', radius: 0 };
  if (!shape) return reject('raster-words');
  if (op.opacity < 100 && op.op === 'shape' && op.fills.length) return reject('raster-group');
  const ink = rgbOf(words.ink);
  if (!ink) return reject('raster-paint');
  const clip = op.op === 'shape' && op.stroke?.align === 'inside' ? paddingArea(op.box, shape, op.stroke) : { box: op.box, shape };
  const map = poseOf(op), fills: DesignRasterFill[] = [];
  for (const [li, line] of layout.lines.entries()) {
    for (const [ri, run] of line.runs.entries()) {
      const d = words.outlines[li]?.[ri];
      if (d === '' || (d === undefined && !run.text.trim())) continue;
      if (typeof d !== 'string') return reject('raster-live-text');
      const ox = op.box.x + line.x + run.x, oy = op.box.y + line.baseline;
      const local: GeomPath = pathFromSubPaths(parseSvgPath(d)).map(contour => ({ closed: true,
        curves: contour.curves.map(q => [q[0] + ox, q[1] + oy, q[2] + ox, q[3] + oy, q[4] + ox, q[5] + oy, q[6] + ox, q[7] + oy] as Cubic) }));
      const box = pathBounds(local);
      if (!box) continue;
      // The canvas clips words to the box inside its border; only words it would not cut are admitted.
      if (!boxInside([box.x0, box.y0, box.x1, box.y1], clip.box, clip.shape)) return reject('raster-clip');
      if (curveCount(local) > MAX_FILL_CURVES) return reject('raster-budget');
      const edges = fillEdges(local, false, tolerance, map);
      if (!edges) return reject('raster-budget');
      if (!edges.length) continue;
      if (edges.length / 4 > DESIGN_RASTER_MAX_FILL_EDGES || !edges.every(n => Math.abs(n) <= 1e6)) return reject('raster-budget');
      const own = run.color ? rgbOf(run.color) : null;
      const alpha = (own ? 1 : words.inkOpacity ?? 1) * op.opacity / 100;
      fills.push(Object.freeze({ id: `${op.id}:${li}.${ri}`.slice(0, 256), edges: Object.freeze(edges), evenOdd: false,
        color: Object.freeze([...(own ?? ink), alpha]) as DesignRasterFill['color'], bounds: Object.freeze(boundsOf(edges)) as DesignRasterFill['bounds'] }));
    }
  }
  return fills;
}

/**
 * A box's gradient, over the primitive at `primitive`. The gradient sits on the box inside
 * the border and CSS repeats it across the box; a radial gradient is an ellipse at the
 * centre of that box reaching its farthest corner. A gradient over a colour, or under words,
 * is refused when the operation fades as a group.
 */
function gradientOf(op: DrawOp, primitive: number, findings: DesignRasterFinding[]): DesignRasterGradient | null | undefined {
  const reject = (feature: string): null => { findings.push({ id: op.id.slice(0, 256), feature }); return null; };
  const paint = op.op === 'shape' ? op.fills.find(f => f.kind !== 'color') : undefined;
  if (!paint || op.op !== 'shape' || op.shape.kind === 'path') return undefined;
  if (op.opacity < 100 && (op.fills.length > 1 || op.words)) return reject('raster-group');
  const stops = paint.stops;
  if (!Array.isArray(stops) || stops.length < 2 || stops.length > DESIGN_RASTER_MAX_STOPS || !dense(stops)) return reject('raster-paint');
  const flat: number[] = [];
  for (const stop of stops) {
    const rgb = stop && typeof stop === 'object' && exact(stop, ['offset', 'color', 'opacity']) && typeof stop.color === 'string' ? rgbOf(stop.color) : null;
    if (!rgb || !unit(stop.offset) || !unit(stop.opacity) || (flat.length && stop.offset < flat[flat.length - 5]!)) return reject('raster-paint');
    flat.push(stop.offset, ...rgb, stop.opacity * op.opacity / 100);
  }
  const area = op.stroke?.align === 'inside' ? paddingArea(op.box, op.shape, op.stroke) : { box: op.box, shape: op.shape };
  const tile = area.box;
  if (![tile.x, tile.y, tile.w, tile.h].every(finite) || tile.w <= 0 || tile.h <= 0) return reject('raster-paint');
  let geometry: [number, number, number, number];
  if (paint.kind === 'linear') {
    if (!keys(paint, ['kind', 'x1', 'y1', 'x2', 'y2', 'stops'])) return reject('raster-paint');
    geometry = [paint.x1, paint.y1, paint.x2, paint.y2];
    if (!geometry.every(n => finite(n) && Math.abs(n) <= 1e6) || (paint.x1 === paint.x2 && paint.y1 === paint.y2)) return reject('raster-paint');
  } else if (paint.kind === 'radial') {
    if (!keys(paint, ['kind', 'stops'])) return reject('raster-paint');
    geometry = [tile.x + tile.w / 2, tile.y + tile.h / 2, tile.w * Math.SQRT1_2, tile.h * Math.SQRT1_2];
  } else return reject('raster-paint');
  return Object.freeze({ id: `${op.id}:gradient`.slice(0, 256), primitive, kind: paint.kind, geometry: Object.freeze(geometry) as DesignRasterGradient['geometry'],
    tile: Object.freeze([tile.x, tile.y, tile.w, tile.h]) as DesignRasterGradient['tile'], stops: Object.freeze(flat) });
}

/** Whole-page admission is synchronous, before any device acquisition or asynchronous work. */
export function prepareDesignRaster(page: DesignDrawPage, output?: { width: number; height: number; dpi?: number }): DesignRasterAdmission {
  const findings: DesignRasterFinding[] = [];
  if (!page || page.version !== DESIGN_DRAW_VERSION) return { ok: false, findings: [{ id: '', feature: 'raster-version' }] };
  if (!keys(page, ['version', 'width', 'height', 'background', 'frame', 'clip', 'ops', 'findings'])) findings.push({ id: '', feature: 'raster-page' });
  const pixelWidth = output?.width ?? page.width, pixelHeight = output?.height ?? page.height, dpi = output?.dpi ?? 96;
  if (!size(page.width) || !size(page.height) || !size(pixelWidth) || !size(pixelHeight)
    || pixelWidth * pixelHeight > DESIGN_RASTER_MAX_PIXELS || !finite(dpi) || dpi < 1 || dpi > 9600) findings.push({ id: '', feature: 'raster-size' });
  if (!Array.isArray(page.ops) || page.ops.length > DESIGN_RASTER_MAX_OPS || !dense(page.ops) || !Array.isArray(page.findings) || page.findings.length > DESIGN_RASTER_MAX_OPS || !dense(page.findings)) return { ok: false, findings: [...findings, { id: '', feature: 'raster-budget' }] };
  findings.push(...page.findings.map(f => ({ id: typeof f?.id === 'string' ? f.id.slice(0, 256) : '', feature: typeof f?.feature === 'string' ? f.feature.slice(0, 128) : 'raster-finding' })));
  if (page.clip !== undefined) findings.push({ id: page.frame?.id ?? '', feature: 'raster-page-clip' });
  const frame = page.frame;
  if (frame?.shape?.kind !== 'rect' || frame.shape.radius !== 0 || !frame.box || frame.box.x !== 0 || frame.box.y !== 0
    || frame.box.w !== page.width || frame.box.h !== page.height || frame.opacity !== 100 || frame.pose) findings.push({ id: frame?.id ?? '', feature: 'raster-frame' });
  const tolerance = FLATTEN_TOLERANCE_PX / Math.max(pixelWidth / (page.width || 1), pixelHeight / (page.height || 1));
  const ops: DesignRasterPrimitive[] = [], fills: DesignRasterFill[] = [], gradients: DesignRasterGradient[] = [], paint: DesignRasterPaint[] = [];
  for (const op of [...(frame ? [frame] : []), ...page.ops]) {
    const addFill = (fill: DesignRasterFill) => { paint.push(Object.freeze(['fill', fills.length]) as DesignRasterPaint); fills.push(fill); };
    if (op?.op === 'shape' && op.shape?.kind === 'path') {
      const fill = pathFill(op, tolerance, findings);
      if (fill === null) continue;
      if (fill) addFill(fill);
      const stroke = op.stroke ? strokeFill(op, tolerance, findings) : undefined;
      if (stroke) addFill(stroke);
      continue;
    }
    const p = primitive(op, findings);
    if (!p) continue;
    paint.push(Object.freeze(['primitive', ops.length]) as DesignRasterPaint); ops.push(p);
    const gradient = gradientOf(op, ops.length - 1, findings);
    if (gradient) { paint.push(Object.freeze(['gradient', gradients.length]) as DesignRasterPaint); gradients.push(gradient); }
    // A CSS border paints over the background and under the words.
    const stroke = op.op === 'shape' && op.stroke ? strokeFill(op, tolerance, findings) : undefined;
    if (stroke) addFill(stroke);
    const words = wordFills(op, tolerance, findings);
    for (const fill of words ?? []) addFill(fill);
  }
  if (fills.reduce((n, f) => n + f.edges.length / 4, 0) > DESIGN_RASTER_MAX_EDGES) findings.push({ id: '', feature: 'raster-budget' });
  if (findings.length) return { ok: false, findings };
  return { ok: true, evaluation: Object.freeze({ version: DESIGN_RASTER_VERSION, drawingVersion: DESIGN_DRAW_VERSION, recipe: DESIGN_RASTER_RECIPE,
    width: page.width, height: page.height, pixelWidth, pixelHeight, dpi, resources: Object.freeze([]) as readonly [], ops: Object.freeze(ops),
    fills: Object.freeze(fills), gradients: Object.freeze(gradients), paint: Object.freeze(paint) }) };
}

/** A handed-off fill, checked field by field. */
function readFill(f: unknown): DesignRasterFill | null {
  if (!f || typeof f !== 'object') return null;
  const v = f as DesignRasterFill;
  if (!exact(v, ['id', 'edges', 'evenOdd', 'color', 'bounds']) || typeof v.id !== 'string' || v.id.length > 256 || typeof v.evenOdd !== 'boolean'
    || !Array.isArray(v.edges) || !v.edges.length || v.edges.length % 4 || v.edges.length / 4 > DESIGN_RASTER_MAX_FILL_EDGES || !dense(v.edges)
    || !v.edges.every(n => finite(n) && Math.abs(n) <= 1e6) || !Array.isArray(v.color) || v.color.length !== 4 || !v.color.every(unit)
    || !Array.isArray(v.bounds) || v.bounds.length !== 4) return null;
  const b = boundsOf(v.edges);
  if (b.some((n, i) => n !== v.bounds[i])) return null;
  return Object.freeze({ id: v.id, edges: Object.freeze([...v.edges]), evenOdd: v.evenOdd, color: Object.freeze([...v.color]) as DesignRasterFill['color'], bounds: Object.freeze(b) as DesignRasterFill['bounds'] });
}

/** A handed-off gradient, checked field by field against the primitives it may paint. */
function readGradient(g: unknown, primitives: number): DesignRasterGradient | null {
  if (!g || typeof g !== 'object') return null;
  const v = g as DesignRasterGradient;
  if (!exact(v, ['id', 'primitive', 'kind', 'geometry', 'tile', 'stops']) || typeof v.id !== 'string' || v.id.length > 256
    || !Number.isInteger(v.primitive) || v.primitive < 0 || v.primitive >= primitives || (v.kind !== 'linear' && v.kind !== 'radial')
    || !Array.isArray(v.geometry) || v.geometry.length !== 4 || !v.geometry.every(n => finite(n) && Math.abs(n) <= 1e6)
    || !Array.isArray(v.tile) || v.tile.length !== 4 || !v.tile.every(n => finite(n) && Math.abs(n) <= 1e6) || v.tile[2] <= 0 || v.tile[3] <= 0
    || !Array.isArray(v.stops) || !dense(v.stops) || v.stops.length % 5 || v.stops.length < 10 || v.stops.length > DESIGN_RASTER_MAX_STOPS * 5
    || !v.stops.every(unit)) return null;
  for (let i = 5; i < v.stops.length; i += 5) if (v.stops[i]! < v.stops[i - 5]!) return null;
  if (v.kind === 'linear' && v.geometry[0] === v.geometry[2] && v.geometry[1] === v.geometry[3]) return null;
  if (v.kind === 'radial' && (v.geometry[2] <= 0 || v.geometry[3] <= 0)) return null;
  return Object.freeze({ id: v.id, primitive: v.primitive, kind: v.kind, geometry: Object.freeze([...v.geometry]) as DesignRasterGradient['geometry'],
    tile: Object.freeze([...v.tile]) as DesignRasterGradient['tile'], stops: Object.freeze([...v.stops]) });
}

/** Validate a worker handoff without trusting a structured clone's former freeze or TypeScript type. */
export function readDesignRasterEvaluation(value: unknown): DesignRasterEvaluation | null {
  if (!value || typeof value !== 'object') return null;
  const e = value as DesignRasterEvaluation;
  if (!exact(e, ['version', 'drawingVersion', 'recipe', 'width', 'height', 'pixelWidth', 'pixelHeight', 'dpi', 'resources', 'ops', 'fills', 'gradients', 'paint'])
    || e.version !== DESIGN_RASTER_VERSION || e.drawingVersion !== DESIGN_DRAW_VERSION || e.recipe !== DESIGN_RASTER_RECIPE
    || !size(e.pixelWidth) || !size(e.pixelHeight) || !finite(e.dpi) || e.dpi < 1 || e.dpi > 9600
    || !Array.isArray(e.resources) || e.resources.length || !Array.isArray(e.ops) || !e.ops.length || e.ops.length > DESIGN_RASTER_MAX_OPS + 1
    || !Array.isArray(e.fills) || !dense(e.fills) || e.fills.length > DESIGN_RASTER_MAX_OPS * 64 || !Array.isArray(e.paint) || !dense(e.paint)
    || !Array.isArray(e.gradients) || !dense(e.gradients) || e.gradients.length > e.ops.length
    || e.paint.length !== e.ops.length + e.fills.length + e.gradients.length) return null;
  const fills: DesignRasterFill[] = [];
  for (const f of e.fills) { const read = readFill(f); if (!read) return null; fills.push(read); }
  const gradients: DesignRasterGradient[] = [];
  for (const g of e.gradients) { const read = readGradient(g, e.ops.length); if (!read) return null; gradients.push(read); }
  if (fills.reduce((n, f) => n + f.edges.length / 4, 0) > DESIGN_RASTER_MAX_EDGES) return null;
  // Every primitive, fill and gradient appears once, each kind in its own order, the frame
  // first, and a gradient straight after the primitive it paints.
  const next = { primitive: 0, fill: 0, gradient: 0 };
  let previous: unknown;
  for (const step of e.paint as unknown[]) {
    if (!Array.isArray(step) || step.length !== 2 || (step[0] !== 'primitive' && step[0] !== 'fill' && step[0] !== 'gradient')) return null;
    const kind: 'primitive' | 'fill' | 'gradient' = step[0];
    if (step[1] !== next[kind]) return null;
    if (kind === 'gradient' && (!Array.isArray(previous) || previous[0] !== 'primitive' || previous[1] !== gradients[step[1]]!.primitive)) return null;
    next[kind]++; previous = step;
  }
  if (e.paint[0]?.[0] !== 'primitive') return null;
  const rows: DrawOp[] = [];
  for (const p of e.ops) {
    if (!p || !exact(p, ['id', 'box', 'shape', 'radius', 'color', 'pose']) || !Array.isArray(p.box) || p.box.length !== 4
      || !Array.isArray(p.color) || p.color.length !== 4 || ![0, 1, 2, 3].every(i => unit(p.color[i])) || !Array.isArray(p.pose) || p.pose.length !== 3
      || !finite(p.pose[0]) || typeof p.pose[1] !== 'boolean' || typeof p.pose[2] !== 'boolean'
      || p.shape !== 'rect' && p.shape !== 'ellipse' || p.shape === 'ellipse' && p.radius !== 0) return null;
    const color = '#' + p.color.slice(0, 3).map((n: number) => { const v = n * 255, rounded = Math.round(v); return Math.abs(v - rounded) < 1e-10 ? rounded.toString(16).padStart(2, '0') : '!'; }).join('');
    rows.push({ id: p.id, op: 'shape', box: { x: p.box[0], y: p.box[1], w: p.box[2], h: p.box[3] },
      shape: p.shape === 'rect' ? { kind: 'rect', radius: p.radius } : { kind: 'ellipse' },
      fills: [{ kind: 'color', color, opacity: p.color[3] }], opacity: 100,
      ...(p.pose[0] || p.pose[1] || p.pose[2] ? { pose: { rot: p.pose[0], flipH: p.pose[1], flipV: p.pose[2] } } : {}) });
  }
  const result = prepareDesignRaster({ version: DESIGN_DRAW_VERSION, width: e.width, height: e.height, background: '', frame: rows[0] as DesignDrawPage['frame'], ops: rows.slice(1), findings: [] }, { width: e.pixelWidth, height: e.pixelHeight, dpi: e.dpi });
  if (!result.ok) return null;
  return Object.freeze({ ...result.evaluation, fills: Object.freeze(fills), gradients: Object.freeze(gradients),
    paint: Object.freeze(e.paint.map(([kind, index]) => Object.freeze([kind, index]) as DesignRasterPaint)) });
}

/** The identity names semantic input and output geometry, never an adapter or GPU resource. */
export const designRasterIdentity = (evaluation: DesignRasterEvaluation): string => JSON.stringify(evaluation);
