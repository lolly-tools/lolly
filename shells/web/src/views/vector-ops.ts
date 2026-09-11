// SPDX-License-Identifier: MPL-2.0
/**
 * vector-ops.ts - the pure operations behind the canvas editor's vector-operations
 * context menu: boolean combine, offset, outline-stroke and simplify on a selection.
 *
 * DOM-free and synchronous, like free-canvas-math.ts, and for the same reason: the
 * overlay (free-canvas.ts) owns gestures and chrome, this module owns geometry, and only
 * geometry can be unit-tested. It may import the engine - shell code is allowed to, tools
 * are not - so the whole cubic kernel is available here without a bridge.
 *
 * Everything operates on a FLAT array of "box" records (rows of a `blocks` input) in
 * NATIVE canvas pixels. Array order is z-order: later = on top.
 *
 * ## boxToPath has to agree with the renderer, exactly
 *
 * A selection is arbitrary boxes - rects with a corner radius, pills, ellipses, rotated
 * anything, and pen paths. Each is lowered to a contour before it can be combined, and if
 * the lowering disagrees with what `hooks.js` paints even slightly, a union visibly does
 * not match the shapes the user selected. So `boxToPath` reproduces `boxCss`/`radiusFor`
 * in brands/<brand>/tools/design/hooks.js term for term, including the parts that
 * look like noise:
 *
 * - `x`/`y` are rounded to whole px and `w`/`h` are `max(1, round(v))` - a zero-width box
 *   paints as a 1px sliver, so that is what it lowers to.
 * - `rot` is rounded to one decimal, because the hook writes `rotate(<1dp>deg)`.
 * - `border-radius` is CLAMPED by CSS, and the clamp is the whole reason `pill` works:
 *   the hook emits `9999px` and the browser scales every radius by
 *   `f = min(side / sum of that side's two radii)`, which for a uniform radius is
 *   `min(w,h) / 2r`, so the painted radius is `min(r, min(w,h)/2)`. `pill` is therefore
 *   not a special shape at all, it is `min(9999, min(w,h)/2)`. See the repo note on the
 *   border-radius pill clamp - this has bitten before.
 * - `ellipse`/`circle` are `border-radius: 50%`, i.e. a true inscribed ellipse (the 50%
 *   radii sum to exactly the side length, so nothing clamps).
 *
 * Corners and ellipses are EXACT cubic arc approximations with the standard kappa
 * constant, never sampled: the kernel's premise is that no algorithm flattens, and
 * feeding it a 48-gon (which is what `clipCss` does for its clip-path polygon, because a
 * CSS polygon cannot curve) would throw that away at the first step.
 *
 * ## What has no outline
 *
 * `kind: 'text'` and `kind: 'image'` lower to NULL, not to their frame rectangle. Their
 * silhouette is glyph outlines or an image's alpha, and neither is available here; a
 * frame rect would union in a rectangle the user cannot see, which is exactly the
 * "silently wrong path" this module must never return. Callers get an explicit
 * `no-outline` failure (or a `skipped` list) instead - see `boxOutlineKind`.
 *
 * ## Coordinate convention for path boxes (fixed by plans/57-pen-tool-and-vector-ops.md)
 *
 * A path box's nodes are stored NORMALISED to the box frame: `x`/`y`/`w`/`h` is the
 * reference rectangle and node coordinates are fractions of it, legally outside [0,1].
 * That is what makes every existing gesture work unchanged - move writes x/y, resize
 * writes w/h, rotate writes rot, and the path follows.
 *
 * Nodes are scaled into box-local PIXELS first and lowered second. For `cubic`, `line`
 * and `bspline` the two orders agree exactly (those lowerings are affine), so this only
 * matters for `catmull-rom`, whose centripetal knot spacing is measured on real chord
 * lengths: lowering in normalised space and then applying a non-uniform box scale gives a
 * different curve. Stage C's `hooks.js` must lower in box-local pixels too (a
 * `viewBox="0 0 w h"`), or a resized Catmull-Rom path will render differently from what
 * the editor combined. Boolean output is always stored as `kind: 'cubic'`, which is
 * affine-invariant, so results round-trip regardless.
 */
import {
  type AuthoredPath, type CapStyle, type Contour, type Cubic, type FillRule, type GeomPath,
  type JoinStyle, type SplineNode,
  GeomLimitError, closeContour, decodeAuthoredPathsResult, differencePath, encodeAuthoredPaths,
  intersectPath, lineToCubic, offsetPath, pathBounds, selfUnion, simplifyCubics, strokeToPath,
  toCubics, unionPath, xorPath,
} from '@lolly/engine';
import type { Box } from './free-canvas-math.ts';
import type { InputValue } from '../../../../engine/src/inputs.ts';

export type { Box };

/**
 * Which box sub-fields this module reads and writes. Every name is optional so a caller
 * can hand over the overlay's own resolved `cfg` (a superset) unchanged; anything absent
 * falls back to the Design manifest's name.
 *
 * `pathField`/`strokeField`/`strokeWField`/`fillRuleField` are the sub-fields Stage C
 * appends to the `boxes` blocks input. They are read defensively: a box that predates
 * them simply has no path.
 */
export interface VectorFieldConfig {
  idField?: string;
  xField?: string;
  yField?: string;
  wField?: string;
  hField?: string;
  rotationField?: string;
  kindField?: string;
  shapeField?: string;
  radiusField?: string;
  fillField?: string;
  opacityField?: string;
  blendField?: string;
  groupField?: string;
  clipField?: string;
  pathField?: string;
  strokeField?: string;
  strokeWField?: string;
  fillRuleField?: string;
  strokeDashField?: string;
  strokeCapField?: string;
  strokeJoinField?: string;
}

type ResolvedFields = Required<VectorFieldConfig>;

export const DEFAULT_VECTOR_FIELDS: ResolvedFields = {
  idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
  kindField: 'kind', shapeField: 'shape', radiusField: 'radius',
  fillField: 'bg', opacityField: 'opacity', blendField: 'blend',
  groupField: 'group', clipField: 'clip',
  pathField: 'path', strokeField: 'stroke', strokeWField: 'strokeW', fillRuleField: 'fillRule',
  strokeDashField: 'strokeDash', strokeCapField: 'strokeCap', strokeJoinField: 'strokeJoin',
};

function fields(cfg: VectorFieldConfig | undefined): ResolvedFields {
  if (!cfg) return DEFAULT_VECTOR_FIELDS;
  const out = { ...DEFAULT_VECTOR_FIELDS };
  for (const key of Object.keys(DEFAULT_VECTOR_FIELDS) as (keyof ResolvedFields)[]) {
    const v = cfg[key];
    if (typeof v === 'string' && v) out[key] = v;
  }
  return out;
}

/** The one control-arm length that makes a cubic best-approximate a quarter circle:
 *  4(√2 − 1)/3 = 0.5522847498307936. The approximation is high on radius by ~2.7e-4·r at
 *  its worst, which is finer than any raster device and finer than `toSvgPathData`
 *  prints - but it is NOT zero, so an area assertion against πr² needs a tolerance. */
const KAPPA = (4 * (Math.SQRT2 - 1)) / 3;

/** Shorter than this and an edge is not an edge. A square with `pill` has zero-length
 *  straight sides between its arcs, and emitting them as degenerate cubics gives the
 *  intersector curves with no tangent to reason about. */
const EDGE_EPS = 1e-9;

/** Coerce a possibly-stringy field (URL mode round-trips numbers as strings). */
function num(v: InputValue | undefined, fallback: number): number {
  const n = typeof v === 'number' ? v : parseFloat(v as string);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: InputValue | undefined): string {
  return v == null || typeof v === 'object' ? '' : String(v);
}

/** The closed set the kernel accepts. A box's `strokeJoin` is whatever the model holds (a
 *  URL wrote it), so it is matched against this rather than passed on: an unrecognised
 *  value means "the kernel's default", never a rejected operation. */
const JOIN_STYLES: readonly JoinStyle[] = ['miter', 'round', 'bevel'];

// ── the box frame ─────────────────────────────────────────────────────────────

/** A box's geometry as the RENDERER sees it: the same rounding `boxCss` applies, so the
 *  lowered path lands on the painted pixels rather than near them. */
interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
}

function boxFrame(box: Box | undefined, f: ResolvedFields): Frame {
  return {
    x: Math.round(num(box?.[f.xField], 0)),
    y: Math.round(num(box?.[f.yField], 0)),
    w: Math.max(1, Math.round(num(box?.[f.wField], 1))),
    h: Math.max(1, Math.round(num(box?.[f.hField], 1))),
    rot: Math.round(num(box?.[f.rotationField], 0) * 10) / 10,
  };
}

/** Painted corner radius, CSS clamp included - see the file header. */
function paintedRadius(box: Box | undefined, f: ResolvedFields, w: number, h: number): number {
  const shape = str(box?.[f.shapeField]);
  const half = Math.min(w, h) / 2;
  if (shape === 'pill') return Math.min(9999, half);
  if (shape === 'rounded') return Math.min(Math.max(0, num(box?.[f.radiusField], 0)), half);
  return 0;
}

/** Local (box-relative, unrotated) → world, honouring `rot` about the box centre. This is
 *  `transform: rotate()` with the default 50%/50% origin, clockwise in screen y-down - 
 *  the same convention as free-canvas-math's `rotateVec`. */
function framePlacer(fr: Frame): (x: number, y: number) => [number, number] {
  if (!fr.rot) return (x, y) => [fr.x + x, fr.y + y];
  const r = (fr.rot * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  const cx = fr.w / 2, cy = fr.h / 2;
  return (x, y) => {
    const dx = x - cx, dy = y - cy;
    return [fr.x + cx + dx * c - dy * s, fr.y + cy + dx * s + dy * c];
  };
}

/** Map every control point of a path through an AFFINE transform. Exact: an affine map of
 *  a Bézier's control points is the Bézier of the mapped curve, so nothing is resampled. */
function mapPath(p: GeomPath, fn: (x: number, y: number) => [number, number]): GeomPath {
  return p.map((c) => ({
    closed: c.closed,
    curves: c.curves.map((k) => {
      const a = fn(k[0], k[1]), b = fn(k[2], k[3]), d = fn(k[4], k[5]), e = fn(k[6], k[7]);
      return [a[0], a[1], b[0], b[1], d[0], d[1], e[0], e[1]] as Cubic;
    }),
  }));
}

function finitePath(p: GeomPath): boolean {
  return p.every((c) => c.curves.every((k) => k.every((v) => Number.isFinite(v))));
}

// ── primitive shapes as exact cubics ──────────────────────────────────────────
// Built in local coordinates with the top-left at (0,0), traversed clockwise on screen
// (TL→TR→BR→BL), which is positive signed area under `contourArea`'s y-up convention.
// One consistent handedness for every primitive means the boolean pass never has to
// guess which of two rects is meant to be a hole.

function roundedRectCurves(w: number, h: number, r: number): Cubic[] {
  const out: Cubic[] = [];
  const line = (x0: number, y0: number, x1: number, y1: number): void => {
    if (Math.hypot(x1 - x0, y1 - y0) > EDGE_EPS) out.push(lineToCubic(x0, y0, x1, y1));
  };
  if (!(r > 0)) {
    line(0, 0, w, 0); line(w, 0, w, h); line(w, h, 0, h); line(0, h, 0, 0);
    return out;
  }
  const k = r * KAPPA;
  line(r, 0, w - r, 0);
  out.push([w - r, 0, w - r + k, 0, w, r - k, w, r]);
  line(w, r, w, h - r);
  out.push([w, h - r, w, h - r + k, w - r + k, h, w - r, h]);
  line(w - r, h, r, h);
  out.push([r, h, r - k, h, 0, h - r + k, 0, h - r]);
  line(0, h - r, 0, r);
  out.push([0, r, 0, r - k, r - k, 0, r, 0]);
  return out;
}

function ellipseCurves(w: number, h: number): Cubic[] {
  const rx = w / 2, ry = h / 2;
  const kx = rx * KAPPA, ky = ry * KAPPA;
  // Right → bottom → left → top, i.e. clockwise on screen.
  return [
    [2 * rx, ry, 2 * rx, ry + ky, rx + kx, 2 * ry, rx, 2 * ry],
    [rx, 2 * ry, rx - kx, 2 * ry, 0, ry + ky, 0, ry],
    [0, ry, 0, ry - ky, rx - kx, 0, rx, 0],
    [rx, 0, rx + kx, 0, 2 * rx, ry - ky, 2 * rx, ry],
  ];
}

// ── the authored-path sub-field ───────────────────────────────────────────────

/**
 * What the `path` sub-field carries: one `AuthoredPath`, or an array of them.
 *
 * The plan names a single `AuthoredPath`, which is right for a pen-drawn shape, but a
 * boolean result generally is not one contour - a subtract punches a hole, an xor of two
 * rings is four loops - and an `AuthoredPath` holds exactly one `nodes` run. So the array
 * form is the superset, and accepting both is a convenience for the caller: on the WIRE
 * there is one form, and a one-path value is byte-identical whichever way it was passed.
 */
export type PathPayload = AuthoredPath | AuthoredPath[];

/**
 * ONE codec, and it is the engine's (`engine/src/geom/authored-url.ts`).
 *
 * This file used to carry its own - percent-encoded JSON - written independently of the
 * engine's under the same two names. They did not interoperate, so a path the editor
 * wrote would not decode in `hooks.js` and a path from a share link would not decode in
 * the editor: a pen shape that draws fine and renders as nothing. Nothing failed to
 * compile, because each side tested its own codec against itself.
 *
 * The engine's form wins on the merits, not just by seniority. JSON is nothing but
 * commas, and `encodeBlocksCompact` refuses to emit a compact string at all when any
 * value contains `,` or `~` (they cannot be escaped - `URLSearchParams` percent-DECODES
 * the query before the block splitter runs), so a JSON path field would silently push
 * EVERY design link containing one pen shape onto the lossless JSON fallback: the
 * whole `boxes` array, every field of every box, re-encoded. The engine's grammar emits
 * only unreserved characters minus `~`, so it costs zero bytes to percent-encode.
 *
 * These two wrappers exist only to keep the shell-side signatures - `InputValue` in,
 * `'malformed'` / `'too-complex'` out - that the overlay is written against.
 */
export function encodeAuthoredPath(payload: PathPayload): string {
  return encodeAuthoredPaths(Array.isArray(payload) ? payload : [payload]);
}

type DecodeFail = 'malformed' | 'too-complex';

/**
 * Decode the `path` sub-field, always to a LIST (a boolean result with a hole is several
 * contours and one `AuthoredPath` holds one `nodes` run).
 *
 * The two refusals stay apart because they are two different things to tell a user: the
 * field is not a path at all, versus it is a path past what this engine will read. The
 * engine's `decodeAuthoredPathsResult` makes exactly that distinction, so neither side
 * has to guess where the boundary is.
 */
export function decodeAuthoredPath(raw: InputValue | undefined): AuthoredPath[] | DecodeFail {
  const s = typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : '';
  if (!s.trim()) return 'malformed';
  return decodeAuthoredPathsResult(s);
}

/** Nodes scaled from box fractions into box-local pixels - see the header on why this
 *  happens BEFORE lowering. */
function denormalise(p: AuthoredPath, w: number, h: number): AuthoredPath {
  return {
    ...p,
    nodes: p.nodes.map((n) => {
      const out: SplineNode = { x: n.x * w, y: n.y * h };
      if (n.hInX !== undefined) out.hInX = n.hInX * w;
      if (n.hInY !== undefined) out.hInY = n.hInY * h;
      if (n.hOutX !== undefined) out.hOutX = n.hOutX * w;
      if (n.hOutY !== undefined) out.hOutY = n.hOutY * h;
      if (n.continuity !== undefined) out.continuity = n.continuity;
      return out;
    }),
  };
}

// ── lowering a box ────────────────────────────────────────────────────────────

/** What a box can contribute to a vector operation. */
export type OutlineKind =
  /** A primitive frame shape (rect/rounded/pill/ellipse/circle). */
  | 'shape'
  /** An authored pen path in the `path` sub-field. */
  | 'path'
  /** Nothing this module can express - a text or image box (see the header). */
  | 'none';

export function boxOutlineKind(box: Box | undefined, cfg?: VectorFieldConfig): OutlineKind {
  const f = fields(cfg);
  const kind = str(box?.[f.kindField]);
  if (kind === 'path' || (str(box?.[f.pathField]) && kind !== 'text' && kind !== 'image')) return 'path';
  if (kind === 'text' || kind === 'image') return 'none';
  return 'shape';
}

type Lowered = { path: GeomPath } | { fail: 'no-outline' | DecodeFail };

function lowerBox(box: Box | undefined, f: ResolvedFields): Lowered {
  const kind = boxOutlineKind(box, f);
  if (kind === 'none') return { fail: 'no-outline' };
  const fr = boxFrame(box, f);
  const place = framePlacer(fr);

  if (kind === 'path') {
    const decoded = decodeAuthoredPath(box?.[f.pathField]);
    if (typeof decoded === 'string') return { fail: decoded };
    const contours: GeomPath = [];
    for (const p of decoded) {
      let curves: Cubic[];
      try {
        curves = toCubics(denormalise(p, fr.w, fr.h));
      } catch {
        return { fail: 'no-outline' };   // an unimplemented kind (spiro) has no outline yet
      }
      if (curves.length) contours.push({ curves, closed: p.closed });
    }
    if (!contours.length) return { fail: 'no-outline' };
    const world = mapPath(contours, place);
    return finitePath(world) ? { path: world } : { fail: 'malformed' };
  }

  const shape = str(box?.[f.shapeField]);
  const curves = shape === 'ellipse' || shape === 'circle'
    ? ellipseCurves(fr.w, fr.h)
    : roundedRectCurves(fr.w, fr.h, paintedRadius(box, f, fr.w, fr.h));
  return { path: mapPath([{ curves, closed: true }], place) };
}

/**
 * A box's painted outline in native canvas coordinates, or `null` when it has none.
 *
 * `null` is the sentinel for "this box does not bound a region I can express" - a text or
 * image box, an unusable `path` sub-field, or a spline kind with no lowering. It is never
 * a fallback rectangle. Callers that need to tell those cases apart (to explain a refusal)
 * should ask `boxOutlineKind` first; the operations below do exactly that.
 */
export function boxToPath(box: Box | undefined, cfg?: VectorFieldConfig): GeomPath | null {
  const r = lowerBox(box, fields(cfg));
  return 'path' in r ? r.path : null;
}

// ── path → box ────────────────────────────────────────────────────────────────

/** One contour → an authored `cubic` path, handles as offsets from each node. */
function authoredFromContour(c: Contour, toFrame: (x: number, y: number) => [number, number]): AuthoredPath | null {
  // An implicitly-closed contour gets its closing edge made explicit first, so the node
  // count matches the curve count and the wrap segment is a real curve rather than a gap
  // `toCubics` would have to invent.
  const src = c.closed ? closeContour(c) : c;
  const curves = src.curves;
  if (!curves.length) return null;
  const nodes: SplineNode[] = [];
  for (let i = 0; i < curves.length; i++) {
    const k = curves[i]!;
    const [px, py] = toFrame(k[0], k[1]);
    const [c1x, c1y] = toFrame(k[2], k[3]);
    const node: SplineNode = { x: px, y: py, hOutX: c1x - px, hOutY: c1y - py, continuity: 'corner' };
    if (i > 0) {
      const prev = curves[i - 1]!;
      const [c2x, c2y] = toFrame(prev[4], prev[5]);
      node.hInX = c2x - px;
      node.hInY = c2y - py;
    }
    nodes.push(node);
  }
  const last = curves[curves.length - 1]!;
  const [lc2x, lc2y] = toFrame(last[4], last[5]);
  if (src.closed) {
    // The last curve ends at node 0, so its second control is node 0's incoming handle.
    const first = nodes[0]!;
    first.hInX = lc2x - first.x;
    first.hInY = lc2y - first.y;
  } else {
    const [ex, ey] = toFrame(last[6], last[7]);
    nodes.push({ x: ex, y: ey, hInX: lc2x - ex, hInY: lc2y - ey, continuity: 'corner' });
  }
  if (nodes.length < 2) return null;
  return { kind: 'cubic', nodes, closed: src.closed };
}

export interface PathToBoxOptions {
  cfg?: VectorFieldConfig;
  /** Id for the new record. The caller owns id allocation (free-canvas's `freshId`
   *  collision-checks against the live array), so this is left unset when omitted. */
  id?: string;
}

/**
 * A geometry result → a new box record whose frame is the path's bounding box and whose
 * nodes are normalised into that frame.
 *
 * The frame is written ROUNDED, because `boxCss` rounds it and `boxToPath` therefore reads
 * it rounded: normalising against the un-rounded bbox would put the round trip off by up
 * to half a pixel per side. Paint (`bg`, `opacity`, `blend`, `stroke`, `strokeW`,
 * `fillRule`) is inherited from `template`; text, image, shadow, clip and group are NOT - 
 * the result is a new vector object, and inheriting a `clip` that points at a box this
 * operation is about to consume is precisely the dangling reference `replaceBoxes` exists
 * to resolve.
 */
export function pathToBox(path: GeomPath, template: Box | null | undefined, opts: PathToBoxOptions = {}): Box | null {
  const f = fields(opts.cfg);
  if (!path.length || !finitePath(path)) return null;
  const bb = pathBounds(path);
  if (!bb || !Number.isFinite(bb.x0) || !Number.isFinite(bb.y0) || !Number.isFinite(bb.x1) || !Number.isFinite(bb.y1)) return null;
  const x = Math.round(bb.x0), y = Math.round(bb.y0);
  const w = Math.max(1, Math.round(bb.x1 - bb.x0));
  const h = Math.max(1, Math.round(bb.y1 - bb.y0));
  const toFrame = (px: number, py: number): [number, number] => [(px - x) / w, (py - y) / h];

  const paths: AuthoredPath[] = [];
  for (const c of path) {
    const a = authoredFromContour(c, toFrame);
    if (a) paths.push(a);
  }
  if (!paths.length) return null;

  const box: Box = {};
  if (opts.id != null && opts.id !== '') box[f.idField] = opts.id;
  box[f.kindField] = 'path';
  // `shape` is meaningless for a path box, but it is not inert: the hook turns it into a
  // border-radius on the element the path renders inside, so a stale 'circle' would clip
  // the result. Pinned to 'rect'.
  box[f.shapeField] = 'rect';
  box[f.xField] = x;
  box[f.yField] = y;
  box[f.wField] = w;
  box[f.hField] = h;
  box[f.rotationField] = 0;
  // The codec THROWS on a path it cannot represent - for this caller that is only ever
  // the node ceiling (a result with more than 20k nodes across all its contours), since
  // the kind is `cubic` and every coordinate was checked finite above. A result too big
  // to persist is not a box: `null` is what every other refusal here returns, and the
  // operation turns it into a failure the UI can show rather than an exception mid-menu.
  try {
    box[f.pathField] = encodeAuthoredPath(paths.length === 1 ? paths[0]! : paths);
  } catch {
    return null;
  }
  // The result wears the template's PAINT. Stroke decoration (dash / ends / corners) is
  // part of that paint, not of the geometry: a dashed outline that came back solid from
  // Unite looks like the operation silently restyled the shape.
  for (const key of [
    f.fillField, f.opacityField, f.blendField, f.strokeField, f.strokeWField, f.fillRuleField,
    f.strokeDashField, f.strokeCapField, f.strokeJoinField,
  ]) {
    const v = template?.[key];
    if (v !== undefined) box[key] = v;
  }
  return box;
}

// ── operation results ─────────────────────────────────────────────────────────

/** Why an operation refused. Each maps to one thing a UI can tell a human, and the three
 *  the plan insists stay apart do:
 *  - `too-complex` - the kernel's `GeomLimitError`: bounded work ran out, so there is no
 *    honest answer (as opposed to an empty one).
 *  - `no-outline` - the selected boxes bound no region (text/image, or a spline kind with
 *    no lowering yet).
 *  - `internal` - a bug here or in the kernel. Never used for either of the above. */
export type VectorOpReason =
  | 'no-outline'
  | 'not-applicable'
  | 'needs-two'
  | 'empty-result'
  | 'too-complex'
  | 'bad-input'
  | 'internal';

export interface VectorOpSuccess {
  ok: true;
  /** The new record(s) to insert. One box for every operation except `simplifyBoxes`,
   *  which returns one per simplified operand, in operand order. */
  boxes: Box[];
  /** Indices into the operand array that were left alone (no outline, or nothing to
   *  simplify) - so the UI can say what it ignored instead of quietly dropping it. */
  skipped: number[];
  /** The result geometry, for a preview or a follow-up operation. */
  path: GeomPath;
}

export interface VectorOpFailure {
  ok: false;
  reason: VectorOpReason;
  /** Diagnostic English. The UI should render its own translated string keyed on
   *  `reason`; this exists so a log or a dev build says something useful. */
  message: string;
  /** Indices into the operand array the refusal is about, where that is meaningful. */
  indices?: number[];
}

export type VectorOpResult = VectorOpSuccess | VectorOpFailure;

/** Common options. `id` is the new record's id (the caller allocates it); `tol` is the
 *  kernel's positional/fit tolerance. */
export interface VectorOpOptions {
  cfg?: VectorFieldConfig;
  id?: string;
  tol?: number;
}

function fail(reason: VectorOpReason, message: string, indices?: number[]): VectorOpFailure {
  return indices ? { ok: false, reason, message, indices } : { ok: false, reason, message };
}

interface Operand {
  index: number;
  box: Box;
  path: GeomPath;
}

/**
 * Lower every operand, canonicalising each one under ITS OWN fill rule.
 *
 * Per-operand `selfUnion` is not redundant with the one inside `booleanPath`: that one
 * applies a single rule to both operands, and a selection may mix an even-odd path with a
 * nonzero one. Resolving each first means both arrive nonzero-canonical, which is the
 * only form the pairwise pass is entitled to assume.
 */
function lowerOperands(boxes: Box[], f: ResolvedFields, tol: number | undefined): {
  operands: Operand[];
  skipped: number[];
  bad: number[];
} {
  const operands: Operand[] = [];
  const skipped: number[] = [];
  const bad: number[] = [];
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    if (!box) { skipped.push(i); continue; }
    const low = lowerBox(box, f);
    if ('fail' in low) {
      (low.fail === 'no-outline' ? skipped : bad).push(i);
      continue;
    }
    const rule = str(box[f.fillRuleField]) === 'evenodd' ? 'evenodd' : 'nonzero';
    const canonical = selfUnion(low.path, { fillRule: rule as FillRule, tol });
    if (!canonical.length) { skipped.push(i); continue; }
    operands.push({ index: i, box, path: canonical });
  }
  return { operands, skipped, bad };
}

/** Wrap a kernel call so `GeomLimitError` stays distinguishable from a real bug. */
function attempt(run: () => GeomPath): { path: GeomPath } | VectorOpFailure {
  try {
    const path = run();
    if (!finitePath(path)) return fail('internal', 'the result carried a non-finite coordinate');
    return { path };
  } catch (err) {
    if (err instanceof GeomLimitError) {
      return fail('too-complex', err.message);
    }
    return fail('internal', err instanceof Error ? err.message : String(err));
  }
}

function finish(path: GeomPath, template: Box | undefined, skipped: number[], opts: VectorOpOptions): VectorOpResult {
  if (!path.length) return fail('empty-result', 'the operation left nothing to draw');
  const box = pathToBox(path, template, { cfg: opts.cfg, id: opts.id });
  if (!box) return fail('internal', 'the result could not be expressed as a box');
  return { ok: true, boxes: [box], skipped, path };
}

// ── the operations ────────────────────────────────────────────────────────────

export type BooleanOpName = 'union' | 'intersect' | 'difference' | 'xor';

/**
 * Combine a selection. `boxes` is in z-order (later = on top).
 *
 * **Difference subtracts everything above from the bottommost shape.** That is what
 * Illustrator's Minus Front and Figma's Subtract both do, and it is the only order that
 * matches what the user sees: the material that survives is the bottom shape's, so the
 * bottom shape's paint is what the result keeps. Union/intersect/xor fold bottom-to-top
 * and take the TOPMOST operand's paint, which is Illustrator's rule for those.
 *
 * A `GeomLimitError` from the kernel surfaces as `too-complex`, never as a plausible
 * wrong answer - difference, intersection and xor have nothing honest to return past the
 * bounded-work ceiling, which is exactly why they throw.
 */
export function booleanBoxes(boxes: Box[], op: BooleanOpName, opts: VectorOpOptions = {}): VectorOpResult {
  const f = fields(opts.cfg);
  const { operands, skipped, bad } = lowerOperands(boxes, f, opts.tol);
  if (bad.length) return fail('bad-input', 'a selected shape has an unreadable path', bad);
  if (operands.length < 2) {
    return operands.length + skipped.length < 2
      ? fail('needs-two', 'a boolean needs two shapes', skipped)
      : fail('no-outline', 'these shapes have no outline to combine', skipped);
  }
  const bopts = { tol: opts.tol };
  const run = (): GeomPath => {
    let acc = operands[0]!.path;
    for (let i = 1; i < operands.length; i++) {
      const b = operands[i]!.path;
      acc = op === 'union' ? unionPath(acc, b, bopts)
        : op === 'intersect' ? intersectPath(acc, b, bopts)
        : op === 'difference' ? differencePath(acc, b, bopts)
        : xorPath(acc, b, bopts);
      if (!acc.length) return [];
    }
    return acc;
  };
  const r = attempt(run);
  if ('ok' in r) return r;
  const template = (op === 'difference' ? operands[0] : operands[operands.length - 1])!.box;
  return finish(r.path, template, skipped, opts);
}

export interface OffsetBoxesOptions extends VectorOpOptions {
  join?: JoinStyle;
  miterLimit?: number;
}

/**
 * Grow (positive) or shrink (negative) the selection's region by `distance`.
 *
 * Multiple operands are unioned first, so "offset the selection" offsets the silhouette
 * the user is looking at rather than each shape separately (which would leave seams
 * wherever two shapes overlap). An inward offset deeper than the local inradius erodes to
 * nothing and comes back as `empty-result` - it must never come back as a shape that grew,
 * which is what the kernel's fold-handedness defect used to produce.
 */
export function offsetBoxes(boxes: Box[], distance: number, opts: OffsetBoxesOptions = {}): VectorOpResult {
  const f = fields(opts.cfg);
  if (!Number.isFinite(distance)) return fail('bad-input', 'the offset distance is not a number');
  const { operands, skipped, bad } = lowerOperands(boxes, f, opts.tol);
  if (bad.length) return fail('bad-input', 'a selected shape has an unreadable path', bad);
  if (!operands.length) return fail('no-outline', 'these shapes have no outline to offset', skipped);
  const merged = attempt(() => mergeRegions(operands, opts.tol));
  if ('ok' in merged) return merged;
  const template = operands[operands.length - 1]!.box;
  if (distance === 0) return finish(merged.path, template, skipped, opts);
  const r = attempt(() => offsetPath(merged.path, distance, {
    join: opts.join ?? 'miter', miterLimit: opts.miterLimit, tol: opts.tol,
  }));
  if ('ok' in r) return r;
  return finish(r.path, template, skipped, opts);
}

export interface StrokeBoxesOptions extends VectorOpOptions {
  /** Outline width. Defaults to the topmost operand's `strokeW`, then to 1. */
  width?: number;
  cap?: CapStyle;
  join?: JoinStyle;
  miterLimit?: number;
}

/**
 * The outline of the selection's stroked edges, as a filled path - "outline stroke".
 *
 * Each operand is stroked on its OWN boundary and the outlines are then unioned: stroking
 * the merged silhouette instead would drop the strokes along edges that happen to be
 * inside the union, which is not what the user drew.
 */
export function strokeBoxesToPath(boxes: Box[], opts: StrokeBoxesOptions = {}): VectorOpResult {
  const f = fields(opts.cfg);
  const { operands, skipped, bad } = lowerOperands(boxes, f, opts.tol);
  if (bad.length) return fail('bad-input', 'a selected shape has an unreadable path', bad);
  if (!operands.length) return fail('no-outline', 'these shapes have no outline to stroke', skipped);
  const top = operands[operands.length - 1]!;
  const width = opts.width ?? num(top.box[f.strokeWField], 1);
  if (!Number.isFinite(width) || width <= 0) return fail('bad-input', 'the stroke width must be a positive number');
  // CORNERS default to the top operand's own `strokeJoin`, so the outline has the
  // silhouette the user was looking at rather than the kernel's (miter). Read through a
  // whitelist: the box carries whatever the model holds - a URL can write anything into
  // it - and an unrecognised value means "the default", never a refused operation.
  //
  // ENDS deliberately do NOT get the same treatment. `lowerOperands` canonicalises every
  // operand through `selfUnion`, so each one is a CLOSED region by the time it is stroked
  // and there are no ends for a cap to describe. Inheriting `strokeCap` here would be
  // inert code implying a behaviour that cannot happen; `opts.cap` stays for a caller that
  // knows better.
  const join = opts.join ?? (JOIN_STYLES.includes(str(top.box[f.strokeJoinField]) as JoinStyle)
    ? (str(top.box[f.strokeJoinField]) as JoinStyle) : undefined);
  const r = attempt(() => {
    const outlines = operands.map((o) => strokeToPath(o.path, width, {
      cap: opts.cap, join, miterLimit: opts.miterLimit, tol: opts.tol,
    }));
    let acc = outlines[0]!;
    for (let i = 1; i < outlines.length; i++) acc = unionPath(acc, outlines[i]!, { tol: opts.tol });
    return acc;
  });
  if ('ok' in r) return r;
  // The outline is new material: it takes the stroke colour as its fill, because that is
  // the paint the user was looking at. Nothing else about the source box describes it.
  const template: Box = { ...top.box };
  const strokeColor = top.box[f.strokeField];
  if (strokeColor !== undefined && strokeColor !== '') template[f.fillField] = strokeColor;
  template[f.strokeField] = '';
  template[f.strokeWField] = 0;
  // `strokeToPath` outlines the whole centreline, so a DASHED stroke outlines as one
  // continuous shape (the kernel has no dash stage). Either way the dash describes nothing
  // about the result, so it is dropped rather than left waiting to reappear the moment
  // someone gives the filled result a stroke of its own.
  template[f.strokeDashField] = '';
  return finish(r.path, template, skipped, opts);
}

/**
 * Fewer curves, within `tolerance`, on path boxes only.
 *
 * Primitive shape boxes are reported in `skipped` rather than simplified: a rect and an
 * ellipse are already exact and minimal, and converting one to a path box to "simplify"
 * it would trade an exact primitive for an approximation of itself.
 *
 * One result box per simplified operand, in operand order - so the caller applies them
 * one at a time (`replaceBoxes` with that operand's id) and every box keeps its own place
 * in the stack. `id` is therefore only used for the FIRST result; ids for the rest are the
 * caller's to allocate.
 */
export function simplifyBoxes(boxes: Box[], tolerance: number, opts: VectorOpOptions = {}): VectorOpResult {
  const f = fields(opts.cfg);
  if (!Number.isFinite(tolerance) || tolerance <= 0) return fail('bad-input', 'the tolerance must be a positive number');
  const skipped: number[] = [];
  const out: Box[] = [];
  const combined: GeomPath = [];
  let any = false;
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    if (!box || boxOutlineKind(box, f) !== 'path') { skipped.push(i); continue; }
    const low = lowerBox(box, f);
    if ('fail' in low) {
      if (low.fail === 'too-complex') return fail('too-complex', 'that path is too complex to simplify', [i]);
      if (low.fail === 'malformed') return fail('bad-input', 'a selected shape has an unreadable path', [i]);
      skipped.push(i);
      continue;
    }
    any = true;
    const r = attempt(() => low.path.map((c) => ({ closed: c.closed, curves: simplifyCubics(c.curves, tolerance) })));
    if ('ok' in r) return r;
    const nb = pathToBox(r.path, box, { cfg: opts.cfg, id: out.length === 0 ? opts.id : undefined });
    if (!nb) { skipped.push(i); continue; }
    out.push(nb);
    for (const c of r.path) combined.push(c);
  }
  if (!any) return fail('not-applicable', 'only pen paths can be simplified', skipped);
  if (!out.length) return fail('empty-result', 'simplifying left nothing to draw', skipped);
  return { ok: true, boxes: out, skipped, path: combined };
}

/** Union every operand's region into one. Union is the one operator with an exact escape
 *  past the work ceiling, so this cannot throw `GeomLimitError`. */
function mergeRegions(operands: Operand[], tol: number | undefined): GeomPath {
  let acc = operands[0]!.path;
  for (let i = 1; i < operands.length; i++) acc = unionPath(acc, operands[i]!.path, { tol });
  return acc;
}

// ── committing the result ─────────────────────────────────────────────────────

/** Mirrors free-canvas's `idOf`: the id field's value, or the array index as a string when
 *  it is empty - which is how a box with no id is addressed everywhere else in the
 *  overlay, so it has to be how it is addressed here. */
function boxId(box: Box | undefined, i: number, f: ResolvedFields): string {
  const v = box?.[f.idField];
  return v != null && v !== '' ? String(v) : String(i);
}

export interface ReplaceBoxesOptions {
  cfg?: VectorFieldConfig;
  /** What to do with a SURVIVING box whose `clip` names a consumed box.
   *  `'retarget'` (default) points it at the result; `'clear'` unclips it. */
  clip?: 'retarget' | 'clear';
}

/**
 * Swap the consumed boxes for the result - the array edit a menu entry commits.
 *
 * Three things this has to decide, all of which the plan names:
 *
 * **z-order.** The result takes the position of the TOPMOST consumed box, so a union of
 * two shapes stays above whatever the upper one was above. `insertAt` is an index into the
 * ORIGINAL array; pass a negative number (or a non-index) to mean "topmost consumed".
 *
 * **Dangling clips.** `clip` holds another box's id, and consuming that box leaves the
 * reference pointing at nothing. Default is to RETARGET it to the result box: `hooks.js`
 * treats an unresolvable clip id as no clip at all, so clearing it and doing nothing look
 * identical to the renderer - both dump the full, unmasked artwork onto the canvas, which
 * is the loudest possible surprise and the hardest to undo by hand. Retargeting keeps the
 * masking relationship the user set up, aimed at the shape that now describes the same
 * region. It is only wrong when the result's region genuinely differs from the old mask's
 * (a difference, say), and in that case the mask visibly changed anyway. Callers who want
 * the other behaviour pass `clip: 'clear'`, which writes an empty string so at least the
 * data says what happened.
 *
 * **Group membership.** A consumed box may have been in a group. The result inherits the
 * group of the topmost consumed box - the same box whose z-position it takes - unless the
 * consumed boxes all shared one group, in which case that group wins regardless of order.
 * Groups left with a single surviving member are NOT touched: a one-member group selects
 * and drags exactly like an ungrouped box, so dissolving it would be an edit to boxes the
 * user did not select.
 */
export function replaceBoxes(
  boxes: Box[],
  removeIds: string[],
  insertAt: number,
  newBox: Box | Box[],
  opts: ReplaceBoxesOptions = {},
): Box[] {
  const f = fields(opts.cfg);
  const inserts = (Array.isArray(newBox) ? newBox : [newBox]).filter((b): b is Box => !!b);
  const remove = new Set(removeIds.filter((id) => id != null).map((id) => String(id)));
  const removedIdx: number[] = [];
  for (let i = 0; i < boxes.length; i++) if (remove.has(boxId(boxes[i], i, f))) removedIdx.push(i);

  const topIdx = removedIdx.length ? removedIdx[removedIdx.length - 1]! : boxes.length;
  const at = Number.isInteger(insertAt) && insertAt >= 0 ? Math.min(insertAt, boxes.length) : topIdx;

  // Group: one shared group wins; otherwise the topmost consumed box's.
  const groups = removedIdx.map((i) => str(boxes[i]?.[f.groupField]));
  const shared = groups.length && groups.every((g) => g && g === groups[0]) ? groups[0]! : '';
  const group = shared || (removedIdx.length ? groups[groups.length - 1]! : '');

  const resolved = inserts.map((b) => {
    const nb: Box = { ...b };
    if (group && nb[f.groupField] === undefined) nb[f.groupField] = group;
    return nb;
  });
  // Retarget to the result's REAL id, never to `boxId`'s index fallback: `clipCss` indexes
  // masks by the id field only, so an index-derived id would resolve to nothing and read
  // as "no clip" - the same silent unmasking clearing it causes, but disguised as a fix.
  const resultId = resolved.length ? str(resolved[0]![f.idField]) : '';
  const retarget = (opts.clip ?? 'retarget') === 'retarget' ? resultId : '';

  const kept: Box[] = [];
  const removedSet = new Set(removedIdx);
  for (let i = 0; i < boxes.length; i++) {
    if (i === at) for (const r of resolved) kept.push(r);
    if (removedSet.has(i)) continue;
    const b = boxes[i]!;
    const clip = str(b[f.clipField]);
    kept.push(clip && remove.has(clip) ? { ...b, [f.clipField]: retarget } : b);
  }
  if (at >= boxes.length) for (const r of resolved) kept.push(r);
  return kept;
}
