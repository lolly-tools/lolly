// SPDX-License-Identifier: MPL-2.0
/** Internal P3f admission. This detached evaluation is never stored in an authored document. */
import { DESIGN_DRAW_VERSION, type DesignDrawPage, type DrawBox, type DrawOp, type DrawShape } from './design-draw.ts';
import * as pmath from './geom/portable-math.ts';
import { parseSvgPath } from './svg-path.ts';
import type { Cubic } from './geom/bezier.ts';
import { selfUnionChecked } from './geom/boolean.ts';
import { pathBounds, pathFromSubPaths, type GeomPath } from './geom/path.ts';

export const DESIGN_RASTER_VERSION = 1;
/**
 * Primitives keep their Skia-matched edge coverage; paths and outlined words are filled
 * by exact per-pixel area over edges flattened to 1/32 output pixel.
 */
export const DESIGN_RASTER_RECIPE = 'design-static-primitives-edge-aa-area-fills-rgba8-v2';
export const DESIGN_RASTER_MAX_PIXELS = 16 * 1024 * 1024;
export const DESIGN_RASTER_MAX_OPS = 1024;
export const DESIGN_RASTER_MAX_DIMENSION = 8192;
/** Edges across every fill of one page, and of one fill. */
export const DESIGN_RASTER_MAX_EDGES = 262_144;
export const DESIGN_RASTER_MAX_FILL_EDGES = 65_536;
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
 * one straight sRGB colour whose alpha already carries the operation's opacity.
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
/** One step of the paint order: a primitive or a fill, by index. */
export type DesignRasterPaint = readonly ['primitive' | 'fill', number];

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
  /** Primitives and fills in paint order. */
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
  if (op.op === 'shape' && op.stroke) return reject('raster-stroke');
  if (!keys(op, ['id', 'op', 'box', 'shape', 'fills', 'opacity', 'pose', 'words'])) return reject('raster-feature');
  const b = op.box, s = op.shape;
  if (typeof op.id !== 'string' || op.id.length > 256 || !b || !keys(b, ['x', 'y', 'w', 'h'])
    || ![b.x, b.y, b.w, b.h].every(finite) || b.w <= 0 || b.h <= 0
    || Math.max(Math.abs(b.x), Math.abs(b.y), b.w, b.h) > 1e6) return reject('raster-geometry');
  if (!s || (s.kind !== 'rect' && s.kind !== 'ellipse')) return reject('raster-path');
  if (!keys(s, s.kind === 'rect' ? ['kind', 'radius'] : ['kind'])) return reject('raster-shape');
  const radius = s.kind === 'rect' ? s.radius : 0;
  if (!finite(radius) || radius < 0 || radius > Math.min(b.w, b.h) / 2) return reject('raster-radius');
  if (!finite(op.opacity) || op.opacity < 0 || op.opacity > 100 || !Array.isArray(op.fills) || op.fills.length > 1) return reject('raster-paint');
  const paint = op.fills[0];
  if (op.fills.length && (!paint || typeof paint !== 'object' || paint.kind !== 'color' || !keys(paint, ['kind', 'color', 'opacity']) || !/^#[\da-f]{6}$/i.test(paint.color)
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

/**
 * Closed straight edges for a filled path, posed into page pixels. Overlapping contours are
 * merged first: the fill shader sums each edge's winding over a pixel, which counts an
 * overlap twice where it meets a partly covered pixel, and variable-font glyphs keep their
 * overlaps. Null when the merge cannot finish within its bounded work.
 */
function fillEdges(path: GeomPath, evenOdd: boolean, tolerance: number, map: (x: number, y: number) => [number, number]): number[] | null {
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

/** A pen shape's fill: its contours flattened, posed and closed. */
function pathFill(op: DrawOp, tolerance: number, findings: DesignRasterFinding[]): DesignRasterFill | null {
  const reject = (feature: string): null => { findings.push({ id: op.id.slice(0, 256), feature }); return null; };
  if (op.op !== 'shape' || op.shape.kind !== 'path') return reject('raster-path');
  if (op.stroke) return reject('raster-stroke');
  if (!keys(op, ['id', 'op', 'box', 'shape', 'fills', 'opacity', 'pose'])) return reject('raster-feature');
  if (!finite(op.opacity) || op.opacity < 0 || op.opacity > 100 || op.fills.length !== 1) return reject('raster-paint');
  const paint = op.fills[0]!;
  const rgb = paint.kind === 'color' ? rgbOf(paint.color) : null;
  if (!rgb || (paint.kind === 'color' && paint.opacity !== undefined && !unit(paint.opacity))) return reject('raster-paint');
  // A fill closes every contour, open or not.
  const path: GeomPath = op.shape.contours.map(contour => ({ closed: true, curves: contour.curves.map(q => [...q] as Cubic) }));
  if (path.reduce((n, c) => n + c.curves.length, 0) > MAX_FILL_CURVES) return reject('raster-budget');
  const edges = fillEdges(path, op.shape.evenOdd, tolerance, poseOf(op));
  if (!edges) return reject('raster-budget');
  if (!edges.length) return reject('raster-path');
  if (edges.length / 4 > DESIGN_RASTER_MAX_FILL_EDGES || !edges.every(n => Math.abs(n) <= 1e6)) return reject('raster-budget');
  const alpha = ((paint.kind === 'color' ? paint.opacity : undefined) ?? 1) * op.opacity / 100;
  return Object.freeze({ id: op.id, edges: Object.freeze(edges), evenOdd: op.shape.evenOdd, color: Object.freeze([...rgb, alpha]) as DesignRasterFill['color'], bounds: Object.freeze(boundsOf(edges)) as DesignRasterFill['bounds'] });
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
      // The canvas clips words to the box; only words it would not cut are admitted.
      if (!boxInside([box.x0, box.y0, box.x1, box.y1], op.box, shape)) return reject('raster-clip');
      if (local.reduce((n, c) => n + c.curves.length, 0) > MAX_FILL_CURVES) return reject('raster-budget');
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
  const ops: DesignRasterPrimitive[] = [], fills: DesignRasterFill[] = [], paint: DesignRasterPaint[] = [];
  for (const op of [...(frame ? [frame] : []), ...page.ops]) {
    if (op?.op === 'shape' && op.shape?.kind === 'path') {
      const fill = pathFill(op, tolerance, findings);
      if (fill) { paint.push(Object.freeze(['fill', fills.length]) as DesignRasterPaint); fills.push(fill); }
      continue;
    }
    const p = primitive(op, findings);
    if (!p) continue;
    paint.push(Object.freeze(['primitive', ops.length]) as DesignRasterPaint); ops.push(p);
    const words = wordFills(op, tolerance, findings);
    for (const fill of words ?? []) { paint.push(Object.freeze(['fill', fills.length]) as DesignRasterPaint); fills.push(fill); }
  }
  if (fills.reduce((n, f) => n + f.edges.length / 4, 0) > DESIGN_RASTER_MAX_EDGES) findings.push({ id: '', feature: 'raster-budget' });
  if (findings.length) return { ok: false, findings };
  return { ok: true, evaluation: Object.freeze({ version: DESIGN_RASTER_VERSION, drawingVersion: DESIGN_DRAW_VERSION, recipe: DESIGN_RASTER_RECIPE,
    width: page.width, height: page.height, pixelWidth, pixelHeight, dpi, resources: Object.freeze([]) as readonly [], ops: Object.freeze(ops),
    fills: Object.freeze(fills), paint: Object.freeze(paint) }) };
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

/** Validate a worker handoff without trusting a structured clone's former freeze or TypeScript type. */
export function readDesignRasterEvaluation(value: unknown): DesignRasterEvaluation | null {
  if (!value || typeof value !== 'object') return null;
  const e = value as DesignRasterEvaluation;
  if (!exact(e, ['version', 'drawingVersion', 'recipe', 'width', 'height', 'pixelWidth', 'pixelHeight', 'dpi', 'resources', 'ops', 'fills', 'paint'])
    || e.version !== DESIGN_RASTER_VERSION || e.drawingVersion !== DESIGN_DRAW_VERSION || e.recipe !== DESIGN_RASTER_RECIPE
    || !size(e.pixelWidth) || !size(e.pixelHeight) || !finite(e.dpi) || e.dpi < 1 || e.dpi > 9600
    || !Array.isArray(e.resources) || e.resources.length || !Array.isArray(e.ops) || !e.ops.length || e.ops.length > DESIGN_RASTER_MAX_OPS + 1
    || !Array.isArray(e.fills) || !dense(e.fills) || e.fills.length > DESIGN_RASTER_MAX_OPS * 64 || !Array.isArray(e.paint) || !dense(e.paint)
    || e.paint.length !== e.ops.length + e.fills.length) return null;
  const fills: DesignRasterFill[] = [];
  for (const f of e.fills) { const read = readFill(f); if (!read) return null; fills.push(read); }
  if (fills.reduce((n, f) => n + f.edges.length / 4, 0) > DESIGN_RASTER_MAX_EDGES) return null;
  // Every primitive and fill appears once, primitives and fills each in their own order, the frame first.
  const next = { primitive: 0, fill: 0 };
  for (const step of e.paint as unknown[]) {
    if (!Array.isArray(step) || step.length !== 2 || (step[0] !== 'primitive' && step[0] !== 'fill')) return null;
    const kind: 'primitive' | 'fill' = step[0];
    if (step[1] !== next[kind]) return null;
    next[kind]++;
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
  return Object.freeze({ ...result.evaluation, fills: Object.freeze(fills), paint: Object.freeze(e.paint.map(([kind, index]) => Object.freeze([kind, index]) as DesignRasterPaint)) });
}

/** The identity names semantic input and output geometry, never an adapter or GPU resource. */
export const designRasterIdentity = (evaluation: DesignRasterEvaluation): string => JSON.stringify(evaluation);
