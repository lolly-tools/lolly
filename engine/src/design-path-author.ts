// SPDX-License-Identifier: MPL-2.0
/**
 * Absolute path geometry to a stored Design path row (plan 291 W5).
 *
 * An agent states a path the way it thinks about one: points or an SVG `d` in canvas
 * pixels. Design stores something else: a frame (`x`/`y`/`w`/`h`) and the authored-path
 * codec in fractions of that frame (engine/src/geom/authored-url.ts). This module is the
 * one conversion between the two, and it fits the frame with the pen tool's own rule
 * (`refitAuthoredFrame`), so a path an agent writes and a path a person draws land on
 * the same box:
 *   - the frame is the tight bounds of the LOWERED curve, never the control hull;
 *   - x, y, w and h are whole pixels with w and h at least 1, which is how the renderer
 *     reads them, and the node offset is worked back from the rounded frame, so the
 *     drawn shape sits where it was stated to within the codec's six decimals;
 *   - an axis with no extent (a straight horizontal or vertical line) is centred in a
 *     1 px box;
 *   - the stroke never grows the stored frame. The renderer pads its svg for the stroke
 *     and for arrowheads instead, and `paint` reports that padded rectangle.
 *
 * Straight segments stay straight and store no handles: points of kind `line` and an
 * all-straight subpath of a `d` become kind `line`, and only `C` segments (or the
 * curves an `A`, `Q`, `S` or `T` expands to) carry handles.
 *
 * A `d` is untrusted input, so it passes the strict grammar gate of `host.geom`
 * (`makeGeomApi().parse`) before the lenient tokenizer reads the string. Every refusal is an
 * Error whose message starts `geom: ` and whose `code` is one of `DesignPathErrorCode`.
 *
 * Pure and synchronous; engine geometry only.
 */
import { makeGeomApi } from './geom-api.ts';
import { authoredFromSubPaths, refitAuthoredFrame, scaleAuthored } from './geom/authored-frame.ts';
import { encodeAuthoredPaths } from './geom/authored-url.ts';
import type { Cubic } from './geom/bezier.ts';
import { pathBounds, type GeomPath } from './geom/path.ts';
import { toCubics, type AuthoredPath, type SplineKind } from './geom/spline.ts';
import { parseSvgPath, SVG_PATH_MAX_CHARS, type SubPath } from './svg-path.ts';
import { pathHeadSize } from './connectors.ts';

/** Where the path is, in canvas px once `origin` is added. Exactly one of `points` and `d`. */
export interface DesignPathGeometry {
  /** On-curve points, at least two. Read as `curve` (default `line`). */
  points?: ReadonlyArray<readonly [number, number]>;
  /** SVG path data: every command, absolute or relative, several subpaths allowed. */
  d?: string;
  /** Points only: join the last point back to the first. A repeated closing point is dropped. */
  closed?: boolean;
  /** Points only: the spline the points are read as. */
  curve?: 'line' | 'cubic' | 'catmull-rom' | 'bspline' | 'hyperbezier' | 'spiro';
  /** Points with `curve: 'catmull-rom'` only: 0 uniform, 0.5 centripetal (the default), 1 chordal. */
  tension?: number;
}

/** The row's paint fields, read only to size `paint` and to note heads that will not draw. */
export interface DesignPathPaint {
  stroke?: string;
  strokeW?: number | string;
  headStart?: string;
  headEnd?: string;
  strokeCap?: string;
  strokeJoin?: string;
}

/** A placed path: the stored frame and value, plus what an agent needs to lay out other layers around the path. */
export interface DesignPathPlacement {
  /** The stored frame, whole canvas pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** The stored authored-path value, fractions of the frame. */
  path: string;
  /** The tight bounds of the curve itself, unrounded, in canvas px. */
  bounds: { x: number; y: number; w: number; h: number };
  /** The rectangle the renderer paints: the frame grown by the stroke and arrowhead pad. */
  paint: { x: number; y: number; w: number; h: number };
  /** Plain sentences about the input that did not do what it may have meant. */
  notes: string[];
}

/** Why a geometry was refused. `empty` is a path with nothing to draw. */
export type DesignPathErrorCode = 'invalid-argument' | 'invalid-path' | 'too-large' | 'empty';

/** Nodes in one value, the codec's own ceiling (engine/src/geom/authored-url.ts). */
const MAX_NODES = 20_000;
/** Characters in one stored value, the codec decoder's ceiling. */
const MAX_VALUE_CHARS = 400_000;
/** Coordinate magnitude, the same guard `host.geom` puts on path data. */
const MAX_COORD = 1e9;

const CURVES: ReadonlySet<string> = new Set<SplineKind>(['line', 'cubic', 'catmull-rom', 'bspline', 'hyperbezier', 'spiro']);
/** The renderer's head vocabulary (`HEAD_KINDS`) and caps and joins (`LINE_CAPS`, `LINE_JOINS`). */
const HEADS: ReadonlySet<string> = new Set(['none', 'triangle', 'open', 'circle', 'diamond', 'bar']);
const CAPS: ReadonlySet<string> = new Set(['butt', 'round', 'square']);
const JOINS: ReadonlySet<string> = new Set(['miter', 'round', 'bevel']);
/** The renderer emits `stroke-miterlimit="4"` on a miter join, which bounds its spike. */
const MITER_LIMIT = 4;

function refuse(code: DesignPathErrorCode, message: string): never {
  throw Object.assign(new Error(message.startsWith('geom: ') ? message : `geom: ${message}`), { code });
}

/** A coordinate: a finite number, or a numeric string as the blocks wire format carries one. */
function coord(v: unknown, where: string): number {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : Number.NaN);
  if (!Number.isFinite(n)) refuse('invalid-argument', `${where} is not a finite number`);
  if (Math.abs(n) > MAX_COORD) refuse('invalid-argument', `${where} exceeds ±${MAX_COORD}`);
  return n;
}

/** Six decimals, which drops the floating-point dust a bounds solve leaves (and a negative zero). */
const micro = (v: number): number => Math.round(v * 1e6) / 1e6 + 0;

/** Two decimals, the precision the renderer writes its svg size and viewBox at. */
const f2 = (v: number): number => Math.round(v * 100) / 100 + 0;

let geomApi: ReturnType<typeof makeGeomApi> | null = null;

function pathsFromPoints(g: DesignPathGeometry, ox: number, oy: number, notes: string[]): AuthoredPath[] {
  const pts = g.points;
  if (!Array.isArray(pts)) refuse('invalid-argument', 'points must be an array of [x, y] pairs');
  if (pts.length > MAX_NODES) refuse('too-large', `${pts.length} points (limit ${MAX_NODES})`);
  const kind = g.curve === undefined ? 'line' : g.curve;
  if (typeof kind !== 'string' || !CURVES.has(kind)) {
    refuse('invalid-argument', `curve must be one of ${[...CURVES].join(', ')}`);
  }
  if (g.closed !== undefined && typeof g.closed !== 'boolean') refuse('invalid-argument', 'closed must be true or false');
  const closed = g.closed === true;
  const nodes = pts.map((p, i) => {
    if (!Array.isArray(p) || p.length !== 2) refuse('invalid-argument', `points[${i}] must be an [x, y] pair`);
    return { x: coord(p[0], `points[${i}][0]`) + ox, y: coord(p[1], `points[${i}][1]`) + oy };
  });
  // A closed run that repeats its first point says the same shape with a zero-length edge.
  const first = nodes[0], last = nodes[nodes.length - 1];
  if (closed && nodes.length > 2 && first && last && first.x === last.x && first.y === last.y) nodes.pop();
  if (nodes.length < 2) refuse('empty', 'a path needs at least two points');
  const path: AuthoredPath = { kind: kind as SplineKind, closed, nodes };
  if (g.tension !== undefined) {
    if (typeof g.tension !== 'number' || !Number.isFinite(g.tension) || g.tension < 0 || g.tension > 1) {
      refuse('invalid-argument', 'tension must be a number from 0 to 1');
    }
    if (kind === 'catmull-rom') path.tension = g.tension;
    else notes.push(`tension only shapes a catmull-rom curve, so it was ignored for ${kind}`);
  }
  if (kind === 'cubic') {
    notes.push('points carry no handles, so a cubic drawn from points is straight between them; state curves with d (C, Q or A) or use catmull-rom or hyperbezier');
  }
  return [path];
}

function pathsFromD(g: DesignPathGeometry, ox: number, oy: number, notes: string[]): AuthoredPath[] {
  const d = g.d;
  if (typeof d !== 'string') refuse('invalid-argument', 'd must be a string of SVG path data');
  if (d.length > SVG_PATH_MAX_CHARS) refuse('too-large', `path data is ${d.length} chars (limit ${SVG_PATH_MAX_CHARS})`);
  geomApi ??= makeGeomApi();
  const checked = geomApi.parse(d);
  if (!checked.ok) refuse(checked.code === 'too-large' ? 'too-large' : 'invalid-path', checked.message);
  if (g.curve !== undefined) notes.push('curve applies to points only; the commands in d decide each segment');
  if (g.closed !== undefined) notes.push('closed applies to points only; Z closes a subpath of d');
  if (g.tension !== undefined) notes.push('tension applies to catmull-rom points only, so it was ignored for d');
  const subs: SubPath[] = parseSvgPath(d).map((sub) => ({
    closed: sub.closed,
    segments: sub.segments.map((s) => (s.op === 'C'
      ? { op: 'C' as const, x1: s.x1 + ox, y1: s.y1 + oy, x2: s.x2 + ox, y2: s.y2 + oy, x: s.x + ox, y: s.y + oy }
      : { op: s.op, x: s.x + ox, y: s.y + oy })),
  }));
  const paths = authoredFromSubPaths(subs);
  if (!paths.length) refuse('empty', 'the path data draws no segment');
  return paths;
}

/** The renderer's stroke and arrowhead pad (`pathHtmlFor`), and whether heads draw at all. */
function paintPad(paint: DesignPathPaint, paths: AuthoredPath[], notes: string[]): number {
  const stroke = typeof paint.stroke === 'string' && paint.stroke.trim() !== '';
  const rawW = paint.strokeW;
  const swNum = typeof rawW === 'number' ? rawW : (typeof rawW === 'string' && rawW.trim() !== '' ? Number(rawW) : 0);
  if (!Number.isFinite(swNum)) refuse('invalid-argument', 'strokeW is not a finite number');
  const sw = Math.min(400, Math.max(0, swNum));
  const word = (v: unknown, allowed: ReadonlySet<string>, name: string, fallback: string): string => {
    if (v === undefined || v === null || v === '') return fallback;
    if (typeof v !== 'string' || !allowed.has(v)) refuse('invalid-argument', `${name} must be one of ${[...allowed].join(', ')}`);
    return v;
  };
  const cap = word(paint.strokeCap, CAPS, 'strokeCap', 'round');
  const join = word(paint.strokeJoin, JOINS, 'strokeJoin', 'round');
  const headStart = word(paint.headStart, HEADS, 'headStart', 'none');
  const headEnd = word(paint.headEnd, HEADS, 'headEnd', 'none');
  const asked = [headStart, headEnd].filter((h) => h !== 'none');
  let headReach = 0;
  if (asked.length) {
    if (!stroke || sw <= 0) notes.push('an arrowhead needs a stroke and a strokeW above 0, so none will draw');
    else if (paths.length !== 1) notes.push('arrowheads draw only on a path of one contour, so none will draw on these several');
    else if (paths[0]!.closed) notes.push('a closed path has no ends, so its arrowheads will not draw');
    else headReach = pathHeadSize(sw) * 0.7 + sw / 2;
    if (asked.includes('bar')) notes.push('a bar head has no PowerPoint line end, so a .pptx leaves it off');
  }
  const reach = Math.max(cap === 'square' ? Math.SQRT2 / 2 : 0.5, join === 'miter' ? MITER_LIMIT / 2 : 0.5);
  return Math.max(stroke && sw > 0 ? sw * reach : 0, headReach);
}

/**
 * Geometry in canvas px once `origin` is added, to a whole-pixel frame and the codec
 * string. Throws Error('geom: <reason>') carrying a `code` for empty, malformed or
 * too-large input.
 */
export function designPathPlacement(
  geometry: DesignPathGeometry,
  opts: { origin?: { x: number; y: number } } & DesignPathPaint = {},
): DesignPathPlacement {
  if (!geometry || typeof geometry !== 'object') refuse('invalid-argument', 'geometry must be an object with points or d');
  const hasPoints = geometry.points !== undefined;
  const hasD = geometry.d !== undefined;
  if (hasPoints === hasD) refuse('invalid-argument', 'state exactly one of points and d');
  const ox = opts.origin ? coord(opts.origin.x, 'origin.x') : 0;
  const oy = opts.origin ? coord(opts.origin.y, 'origin.y') : 0;
  const notes: string[] = [];
  const paths = hasPoints ? pathsFromPoints(geometry, ox, oy, notes) : pathsFromD(geometry, ox, oy, notes);
  let total = 0;
  for (const p of paths) total += p.nodes.length;
  if (total > MAX_NODES) refuse('too-large', `${total} nodes (limit ${MAX_NODES})`);

  // The tight bounds of the curve the renderer will draw. No extent on either axis is a
  // point, which a 1 px frame would hold but which draws nothing an agent could mean.
  const geom: GeomPath = [];
  for (const p of paths) {
    let curves: Cubic[];
    try {
      curves = toCubics(p);
    } catch (err) {
      refuse('invalid-argument', `the ${p.kind} curve could not be lowered: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (curves.length) geom.push({ curves, closed: p.closed });
  }
  const bb = geom.length ? pathBounds(geom) : null;
  if (!bb || ![bb.x0, bb.y0, bb.x1, bb.y1].every((v) => Number.isFinite(v))) refuse('empty', 'the geometry lowers to no curve');
  if (bb.x1 - bb.x0 === 0 && bb.y1 - bb.y0 === 0) refuse('empty', 'every point is the same point, so there is nothing to draw');

  const fit = refitAuthoredFrame(paths, { x: 0, y: 0, w: 1, h: 1, rot: 0 });
  if (!fit) refuse('empty', 'the geometry lowers to no curve');
  // `+ 0` turns the negative zero `Math.round(-0.4)` gives into a plain 0.
  const x = fit.frame.x + 0, y = fit.frame.y + 0, { w, h } = fit.frame;
  let path: string;
  try {
    path = encodeAuthoredPaths(fit.paths.map((p) => scaleAuthored(p, 1 / w, 1 / h)));
  } catch (err) {
    refuse('too-large', `the path cannot be stored: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (path.length > MAX_VALUE_CHARS) refuse('too-large', `the stored value is ${path.length} chars (limit ${MAX_VALUE_CHARS})`);

  const pad = paintPad(opts, paths, notes);
  return {
    x, y, w, h, path,
    bounds: { x: micro(bb.x0), y: micro(bb.y0), w: micro(bb.x1 - bb.x0), h: micro(bb.y1 - bb.y0) },
    paint: { x: f2(x - pad), y: f2(y - pad), w: f2(w + pad * 2), h: f2(h + pad * 2) },
    notes,
  };
}
