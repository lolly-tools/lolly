// SPDX-License-Identifier: MPL-2.0
/**
 * Stroke position and per-side stroke widths for Design rows.
 *
 * Two fields, read here exactly as the Design renderer reads them
 * (`community/_shared/design-renderer.js`, `strokeAlignOf`, `strokeSidesOf` and
 * `strokeOutsetOf`), so the canvas, the exporters and the editor's live gestures agree
 * on where a stroke lies:
 *
 * - `strokeAlign` is `inside`, `center` or `outside`. Empty keeps the default every
 *   document drew before the field existed: a box's stroke is a CSS border inside the
 *   box, and a pen path's is centred on the curve. A board (frame) always strokes inside
 *   its page, because the page edge is the export edge.
 * - `strokeTop`, `strokeRight`, `strokeBottom` and `strokeLeft` are per-side widths for a
 *   rectangle, rounded box, pill or board. Empty uses `strokeW`; 0 hides that side.
 *
 * The geometry is the CSS border model, which is also what Penpot 2.19 draws for strokes
 * per side (render-wasm `per_side_geometry`, MPL-2.0): the border box is the frame grown
 * by the part of each side's width that lies outside, the padding box is the frame shrunk
 * by the part inside, a rounded corner grows or shrinks by the adjacent widths on each
 * axis, and a sharp corner stays sharp.
 *
 * Pure: no DOM, no clock, no network, no filesystem, no randomness.
 */
import type { DrawArea, DrawBox, DrawShape } from './design-draw.ts';
import { lineToCubic, type Cubic } from './geom/bezier.ts';
import type { Contour } from './geom/path.ts';

/** A stroke's position on its outline: inside, centred or outside. */
export type DesignStrokeAlign = 'inside' | 'center' | 'outside';
/** Stroke widths in px, `[top, right, bottom, left]`, the CSS `border-width` order. */
export type DesignStrokeSides = [number, number, number, number];
/** Corner radii clockwise from the top left, each across then down: TL x, TL y, TR x, TR y, BR x, BR y, BL x, BL y. */
export type DesignCornerRadii = [number, number, number, number, number, number, number, number];
type Outline = Exclude<DrawShape, { kind: 'path' }>;
/** A Design row, or any record that carries its stroke fields. */
type Row = Readonly<Record<string, unknown>>;

const ALIGNS: ReadonlySet<string> = new Set(['inside', 'center', 'outside']);
const text = (value: unknown): string => (value == null ? '' : String(value));
/** The renderer's `num`: a leading number, or the fallback. */
function leading(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : fallback;
}

/** The position a row's stroke takes, with the shape's own default when the field is empty or unknown. */
export function designStrokeAlign(row: Row): DesignStrokeAlign {
  const kind = text(row.kind);
  if (kind === 'frame') return 'inside';
  const align = text(row.strokeAlign);
  if (ALIGNS.has(align)) return align as DesignStrokeAlign;
  return kind === 'path' ? 'center' : 'inside';
}

/** How far past the outline a stroke reaches, as a fraction of its width. */
export function strokeOutFraction(align: DesignStrokeAlign | undefined): number {
  return align === 'outside' ? 1 : align === 'center' ? 0.5 : 0;
}

/** Whether per-side widths apply: a rectangle-like outline, not an ellipse, a circle or a pen path. */
export function designStrokeSidesApply(row: Row): boolean {
  if (text(row.kind) === 'path') return false;
  const shape = text(row.shape);
  return shape !== 'ellipse' && shape !== 'circle';
}

function sideOf(value: unknown, fallback: number): number {
  const s = text(value).trim();
  if (s === '') return fallback;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? Math.min(400, Math.max(0, n)) : fallback;
}

/**
 * The row's stroke widths `[top, right, bottom, left]`. An empty side uses `strokeW`, so
 * a row with no side of its own reads four copies of its one width.
 */
export function designStrokeSides(row: Row): DesignStrokeSides {
  const w = leading(row.strokeW, 0);
  if (!designStrokeSidesApply(row)) return [w, w, w, w];
  return [sideOf(row.strokeTop, w), sideOf(row.strokeRight, w), sideOf(row.strokeBottom, w), sideOf(row.strokeLeft, w)];
}

export const strokeSidesEqual = (s: readonly number[]): boolean => s[0] === s[1] && s[0] === s[2] && s[0] === s[3];

/** Whether a row sets any side of its own, so a row that sets none is read exactly as before the fields existed. */
export function designStrokeHasSides(row: Row): boolean {
  return ['strokeTop', 'strokeRight', 'strokeBottom', 'strokeLeft'].some((key) => text(row[key]).trim() !== '');
}

/**
 * How far a box's stroke pushes its border box past its frame, `[top, right, bottom,
 * left]` in px: the renderer grows the box element by this much. All zero for an inside
 * stroke, a pen path, a board, a row without a stroke colour or a row that paints nothing.
 */
export function designStrokeOutset(row: Row): DesignStrokeSides {
  const kind = text(row.kind);
  if (kind === 'path' || kind === 'frame' || kind === 'group' || kind === 'audio' || kind === 'camera') return [0, 0, 0, 0];
  const frac = strokeOutFraction(designStrokeAlign(row));
  if (!frac || !text(row.stroke).trim()) return [0, 0, 0, 0];
  const s = designStrokeSides(row).map((v) => Math.max(0, v));
  if (!(Math.max(...s) > 0)) return [0, 0, 0, 0];
  return [s[0]! * frac, s[1]! * frac, s[2]! * frac, s[3]! * frac];
}

/** The border box and the padding box of a stroked outline, as CSS draws them. */
export interface StrokeRing {
  /** The stroke's outer edge, where the border box ends. */
  outer: DrawArea;
  /** The stroke's inner edge, where the fill, the picture and the words sit; null once the stroke fills the whole box. */
  inner: DrawArea | null;
}

const corners = (shape: Extract<DrawShape, { kind: 'rect' }>): DesignCornerRadii => {
  const r = shape.radius;
  return shape.corners ? [...shape.corners] as DesignCornerRadii : [r, r, r, r, r, r, r, r];
};

/** A rectangle outline from eight radii: a plain radius when all eight agree, so a uniform outline draws as it always has. */
function rectWith(c: DesignCornerRadii): Extract<DrawShape, { kind: 'rect' }> {
  return c.every((v) => v === c[0]) ? { kind: 'rect', radius: c[0] } : { kind: 'rect', radius: Math.min(...c), corners: c };
}

/**
 * The stroke's two edges for an outline drawn at `align` with `sides` widths. A sharp
 * corner stays sharp; a rounded corner grows outward by the outside part of each
 * adjacent width and its inner edge is the outer radius less the width on that axis,
 * never below zero, the CSS `border-radius` rule.
 */
export function strokeRing(box: DrawBox, shape: Outline, align: DesignStrokeAlign, sides: readonly number[]): StrokeRing {
  const o = strokeOutFraction(align), i = 1 - o;
  const [t, r, b, l] = sides.map((v) => Math.max(0, v)) as DesignStrokeSides;
  const outerBox: DrawBox = { x: box.x - l * o, y: box.y - t * o, w: box.w + (l + r) * o, h: box.h + (t + b) * o };
  const innerBox: DrawBox = { x: box.x + l * i, y: box.y + t * i, w: box.w - (l + r) * i, h: box.h - (t + b) * i };
  const hole = innerBox.w > 0 && innerBox.h > 0;
  if (shape.kind === 'ellipse') return { outer: { box: outerBox, shape }, inner: hole ? { box: innerBox, shape } : null };
  const c = corners(shape);
  // Adjacent widths per corner: across from the left or right side, down from the top or bottom.
  const across = [l, r, r, l], down = [t, t, b, b];
  const out = c.map((v, k) => (v > 0 ? v + (k % 2 === 0 ? across[k >> 1]! : down[k >> 1]!) * o : 0)) as DesignCornerRadii;
  const inn = out.map((v, k) => Math.max(0, v - (k % 2 === 0 ? across[k >> 1]! : down[k >> 1]!))) as DesignCornerRadii;
  return { outer: { box: outerBox, shape: rectWith(out) }, inner: hole ? { box: innerBox, shape: rectWith(inn) } : null };
}

/** The circle-arc constant: a quarter ellipse as one cubic with handles this far along its tangents. */
const KAPPA = 0.5522847498307936;

/** One clockwise quarter of an ellipse of radii (rx, ry) around (cx, cy), from angle a (0 = right, y down) a quarter turn on. */
function quarter(cx: number, cy: number, rx: number, ry: number, quadrant: number): Cubic {
  const pts: Array<[number, number]> = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const [ax, ay] = pts[quadrant % 4]!, [bx, by] = pts[(quadrant + 1) % 4]!;
  const x0 = cx + ax * rx, y0 = cy + ay * ry, x3 = cx + bx * rx, y3 = cy + by * ry;
  return [x0, y0, x0 + bx * rx * KAPPA, y0 + by * ry * KAPPA, x3 + ax * rx * KAPPA, y3 + ay * ry * KAPPA, x3, y3];
}

/**
 * An outline as one closed contour, clockwise on screen: an ellipse as four quarters, a
 * rectangle as its sides and each rounded corner's quarter ellipse.
 */
export function outlineAreaContour(area: DrawArea): Contour {
  const { x, y, w, h } = area.box;
  if (area.shape.kind === 'ellipse') {
    const cx = x + w / 2, cy = y + h / 2;
    return { closed: true, curves: [0, 1, 2, 3].map((q) => quarter(cx, cy, w / 2, h / 2, q)) };
  }
  const [tlx, tly, trx, try_, brx, bry, blx, bly] = corners(area.shape).map((v) => Math.max(0, v)) as DesignCornerRadii;
  const curves: Cubic[] = [];
  const line = (x0: number, y0: number, x1: number, y1: number) => { if (x0 !== x1 || y0 !== y1) curves.push(lineToCubic(x0, y0, x1, y1)); };
  const corner = (cx: number, cy: number, rx: number, ry: number, q: number) => { if (rx > 0 && ry > 0) curves.push(quarter(cx, cy, rx, ry, q)); };
  // Each corner with a zero radius on either axis is sharp: its two sides meet at the box corner.
  const tl = tlx > 0 && tly > 0, tr = trx > 0 && try_ > 0, br = brx > 0 && bry > 0, bl = blx > 0 && bly > 0;
  line(x + (tl ? tlx : 0), y, x + w - (tr ? trx : 0), y);
  corner(x + w - trx, y + try_, trx, try_, 3);
  line(x + w, y + (tr ? try_ : 0), x + w, y + h - (br ? bry : 0));
  corner(x + w - brx, y + h - bry, brx, bry, 0);
  line(x + w - (br ? brx : 0), y + h, x + (bl ? blx : 0), y + h);
  corner(x + blx, y + h - bly, blx, bly, 1);
  line(x, y + h - (bl ? bly : 0), x, y + (tl ? tly : 0));
  corner(x + tlx, y + tly, tlx, tly, 2);
  return { closed: true, curves };
}

/** A contour run backwards, so a hole winds against its outline and either fill rule leaves it open. */
function reversed(c: Contour): Contour {
  return { closed: c.closed, curves: c.curves.slice().reverse().map((q) => [q[6], q[7], q[4], q[5], q[2], q[3], q[0], q[1]] as Cubic) };
}

/** The region a stroke paints: its outer edge and, wound the other way, its inner edge. */
export function strokeRingContours(ring: StrokeRing): Contour[] {
  return ring.inner ? [outlineAreaContour(ring.outer), reversed(outlineAreaContour(ring.inner))] : [outlineAreaContour(ring.outer)];
}

/**
 * A uniform stroke's centre line: the outline moved out by the part of the width outside
 * it, less half the width. Drawn with a stroke of the full width it paints the ring
 * `strokeRing` describes.
 */
export function strokeCentreArea(box: DrawBox, shape: Outline, align: DesignStrokeAlign, width: number): DrawArea {
  const ring = strokeRing(box, shape, align, [width, width, width, width]);
  const half = width / 2, b = ring.outer.box;
  const centre: DrawBox = { x: b.x + half, y: b.y + half, w: Math.max(0, b.w - width), h: Math.max(0, b.h - width) };
  if (ring.outer.shape.kind === 'ellipse') return { box: centre, shape: ring.outer.shape };
  return { box: centre, shape: rectWith(corners(ring.outer.shape).map((v) => Math.max(0, v - half)) as DesignCornerRadii) };
}
