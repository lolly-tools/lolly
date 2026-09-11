// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas-pen.ts - the pure half of the canvas editor's pen tool (Stage D).
 *
 * DOM-free and synchronous, like free-canvas-math.ts and vector-ops.ts, and for the same
 * reason: free-canvas.ts owns gestures and chrome, this owns geometry, and only geometry
 * can be unit-tested. It may import the engine - shell code is allowed to, tools are not.
 *
 * ## Three coordinate spaces, and which functions live in which
 *
 *   - NATIVE - canvas pixels, what a pointer maps to. A path being DRAWN lives here,
 *     because it has no box yet.
 *   - BOX-LOCAL - pixels inside an unrotated box frame, `0..w` × `0..h`. This is the space
 *     `hooks.js` lowers in (a `viewBox` whose user units are `0..w` × `0..h`, grown by the
 *     stroke pad so an outline is not clipped), so it is the space every edit has to agree
 *     with. The frame is kept EQUAL to the curve's tight bbox - see `refitFrame`, which is
 *     the invariant selection chrome, hit-testing, align/distribute and export all read.
 *   - NORMALISED - the stored form: fractions of the frame, legally outside `[0,1]`. This
 *     is what buys move/resize/rotate for free (see the plan's coordinate convention).
 *
 * `frameToLocal`/`localToFrame` cross the native↔box-local boundary through the frame's
 * rotation; `denormNodes`/`normNodes` cross box-local↔normalised. Everything else operates
 * on a DENORMALISED path (box-local px), because that is the only space in which a
 * distance in the user's pixels means the same thing on both axes - a `w≠h` frame makes
 * "within 8px of the curve" incoherent in normalised space.
 *
 * ## One wire format, and it quantises
 *
 * The `path` sub-field is the engine's compact form (`engine/src/geom/authored-url.ts`,
 * reached by tools as `host.geom.encodeAuthored` and by vector-ops.ts through its own thin
 * wrappers). This module goes through vector-ops' wrappers so the whole overlay reads and
 * writes one thing.
 *
 * It rounds every coordinate to SIX DECIMALS OF A FRACTION of the box frame, which is
 * deliberate - a fixed precision is what keeps a share link's bytes stable across a
 * decode/encode round trip - and it is the reason nothing here may assert exactness across
 * a persist. On a 1000px frame six decimals is a thousandth of a pixel, so it is invisible;
 * on a stored *unit* it is 1e-6, which is coarser than a collinearity test written at 1e-9.
 * Geometry claims that must be exact (an insert that splits a cubic) are therefore made
 * against the in-memory path, before it is written.
 */
import {
  type AuthoredPath, type Continuity, type Cubic, type GeomPath, type HyperbezierSolution,
  type SplineKind, type SplineNode,
  colorToHexString, enforceContinuity, hyperbezierCubics,
  nearestOnCubic, parseColor, pathBounds, solveHyperbezier, splitCubic, toCubics,
} from '@lolly/engine';
// The `path` sub-field's codec, via the wrappers the rest of the overlay already uses - one
// codec, one set of shell-side signatures. See the file header on what it quantises.
import { decodeAuthoredPath as decodeAuthoredPaths, encodeAuthoredPath as encodeAuthoredPaths } from './vector-ops.ts';
import type { InputValue } from '../../../../engine/src/inputs.ts';

/**
 * The kinds the switcher offers, in menu order.
 *
 * `'spiro'` (Levien's Euler-spiral spline, the one Inkscape ships) is now a real solver
 * - `spiroCubics` in the engine - so it joins the switcher, requested by users who know
 * it from Inkscape. It is knot-only like `hyperbezier`, a different curve family, and
 * defaults its nodes to `'smooth'`. Kept LAST in the list (Andy, 2026-08-06): it is the
 * specialist option, so it sits at the bottom below the everyday kinds.
 */
export const PEN_KINDS: SplineKind[] = ['hyperbezier', 'cubic', 'catmull-rom', 'bspline', 'line', 'spiro'];

/** New paths default to this - per the plan, and because its node default is `'smooth'`,
 *  so plain click-click-click draws a curve rather than a polyline. */
export const PEN_DEFAULT_KIND: SplineKind = 'hyperbezier';

/**
 * A kind whose lowering READS a node's handles, and therefore the only kinds whose handle
 * chrome is worth showing.
 *
 * The two that qualify mean different things by it and both are honest: `cubic` takes the
 * handle as the control point, `hyperbezier` takes its DIRECTION as a tangent pin and
 * discards the length (see `hbPin` - the solve owns arm length, because arm length is what
 * it spends on curvature continuity). `catmull-rom`, `bspline` and `line` ignore handles
 * entirely, so a handle drawn on one would be a control that changes nothing.
 */
export function kindReadsHandles(kind: SplineKind): boolean {
  return kind === 'cubic' || kind === 'hyperbezier';
}

/** A node's continuity default depends on the kind: the knot-only curvature-continuous
 *  splines (`hyperbezier`, `spiro`) say `'smooth'` so plain click-click-click draws a
 *  curve; everything else follows `enforceContinuity`'s `'corner'`. */
export function defaultContinuity(kind: SplineKind): Continuity {
  return kind === 'hyperbezier' || kind === 'spiro' ? 'smooth' : 'corner';
}

// ── the box frame ─────────────────────────────────────────────────────────────

/** A path box's frame as the RENDERER sees it - the same rounding `boxCss`/`pathHtmlFor`
 *  apply, so an edit lands on the painted pixels rather than near them. Deliberately
 *  identical to vector-ops' `boxFrame`: the two must not disagree about where a path is. */
export interface PenFrame { x: number; y: number; w: number; h: number; rot: number }

function fnum(v: InputValue | undefined, fallback: number): number {
  const n = typeof v === 'number' ? v : parseFloat(v as string);
  return Number.isFinite(n) ? n : fallback;
}

export interface PenFrameFields { xField: string; yField: string; wField: string; hField: string; rotationField: string }

export function penFrame(box: Record<string, InputValue | undefined> | undefined, f: PenFrameFields): PenFrame {
  return {
    x: Math.round(fnum(box?.[f.xField], 0)),
    y: Math.round(fnum(box?.[f.yField], 0)),
    w: Math.max(1, Math.round(fnum(box?.[f.wField], 1))),
    h: Math.max(1, Math.round(fnum(box?.[f.hField], 1))),
    rot: Math.round(fnum(box?.[f.rotationField], 0) * 10) / 10,
  };
}

/** Box-local px → native canvas px, honouring `rot` about the frame centre (CSS
 *  `transform: rotate()` with the default origin, clockwise in screen y-down). */
export function localToFrame(fr: PenFrame, x: number, y: number): { x: number; y: number } {
  if (!fr.rot) return { x: fr.x + x, y: fr.y + y };
  const r = (fr.rot * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  const cx = fr.w / 2, cy = fr.h / 2;
  const dx = x - cx, dy = y - cy;
  return { x: fr.x + cx + dx * c - dy * s, y: fr.y + cy + dx * s + dy * c };
}

/** The exact inverse of `localToFrame` - a pointer in native px → box-local px. */
export function frameToLocal(fr: PenFrame, nx: number, ny: number): { x: number; y: number } {
  if (!fr.rot) return { x: nx - fr.x, y: ny - fr.y };
  const r = (-fr.rot * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  const cx = fr.w / 2, cy = fr.h / 2;
  const dx = nx - fr.x - cx, dy = ny - fr.y - cy;
  return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
}

// ── normalised ↔ box-local ────────────────────────────────────────────────────

/** Stored fractions → box-local px. Mirrors `hooks.js` `pathHtmlFor` term for term,
 *  including that a handle scales on the axis it points along. */
export function denormNodes(p: AuthoredPath, w: number, h: number): AuthoredPath {
  return { ...p, nodes: p.nodes.map((n) => scaleNode(n, w, h)) };
}

/** Box-local px → stored fractions. `w`/`h` are floored at 1 by `penFrame`, so this
 *  never divides by zero. */
export function normNodes(p: AuthoredPath, w: number, h: number): AuthoredPath {
  return { ...p, nodes: p.nodes.map((n) => scaleNode(n, 1 / w, 1 / h)) };
}

function scaleNode(n: SplineNode, sx: number, sy: number): SplineNode {
  const out: SplineNode = { x: n.x * sx, y: n.y * sy };
  if (n.hInX !== undefined) out.hInX = n.hInX * sx;
  if (n.hInY !== undefined) out.hInY = n.hInY * sy;
  if (n.hOutX !== undefined) out.hOutX = n.hOutX * sx;
  if (n.hOutY !== undefined) out.hOutY = n.hOutY * sy;
  if (n.continuity !== undefined) out.continuity = n.continuity;
  return out;
}

// ── the wire format ───────────────────────────────────────────────────────────

/**
 * Every contour in the field, in order. Empty when the value is unreadable or too big - the
 * caller's answer to both is the same ("there is no path here I can edit"), so the
 * distinction vector-ops keeps for a REFUSAL message is collapsed here.
 *
 * Node editing operates on ONE of them (the first): editing is defined on a single `nodes`
 * run - that is what an `AuthoredPath` is. But the caller must hold the others rather than
 * decode them away, on two counts: the write has to re-encode every contour or editing one
 * loop of four would delete the other three, and `refitFrame` has to fit every contour or
 * editing one would clip the rest.
 */
export function decodePathContours(raw: InputValue | undefined): AuthoredPath[] {
  if (raw == null) return [];
  const res = decodeAuthoredPaths(raw);
  return typeof res === 'string' ? [] : res;
}

/** One authored path → the field value. `''` for a path the codec cannot represent (a
 *  non-finite coordinate), which reads as "no shape" rather than as corrupt geometry. */
export function encodePathField(p: AuthoredPath): string {
  try {
    return encodeAuthoredPaths(p);
  } catch {
    return '';
  }
}

/** Every contour → the field value, keeping the singular form for a single contour so a
 *  one-contour payload stays byte-identical to what `encodePathField` has always written.
 *  This is what a caller that EDITS one contour of a boolean result has to use: encoding
 *  only the edited one would silently drop the holes. */
export function encodePathFields(paths: AuthoredPath[]): string {
  if (!paths.length) return '';
  if (paths.length === 1) return encodePathField(paths[0]!);
  try {
    return encodeAuthoredPaths(paths);
  } catch {
    return '';
  }
}

// ── lowering, with the warm start ─────────────────────────────────────────────

/**
 * Lower an authored path to cubics, keeping the hyperbezier solution.
 *
 * `toCubics` takes a `warm` solution but discards the one it computes, which is exactly
 * wrong for a drag: re-converging a 40-node solve from the chord-bend guess on every
 * pointermove is an O(n) Newton run per frame, where reusing the previous frame's answer
 * converges in one or two steps. So the pen path calls the two halves itself and hands the
 * solution back for the next frame.
 *
 * `'spiro'` (and any future declared-but-unlowerable kind) returns no cubics rather than
 * throwing: a pen tool that renders nothing is recoverable, one that throws out of a
 * pointermove is not.
 */
export interface LoweredPath { cubics: Cubic[]; solution: HyperbezierSolution | null }

export function lowerAuthored(p: AuthoredPath, warm?: HyperbezierSolution | null): LoweredPath {
  if (p.nodes.length < 2) return { cubics: [], solution: null };
  if (p.kind === 'hyperbezier') {
    const solution = solveHyperbezier(p.nodes, p.closed, warm ?? undefined);
    return { cubics: hyperbezierCubics(p.nodes, p.closed, solution), solution };
  }
  try {
    return { cubics: toCubics(p), solution: null };
  } catch {
    return { cubics: [], solution: null };
  }
}

/** One authored path as a single-contour `GeomPath` - the form every engine operator and
 *  `toSvgPathData` takes. */
export function authoredToPath(p: AuthoredPath, warm?: HyperbezierSolution | null): { path: GeomPath; solution: HyperbezierSolution | null } {
  const low = lowerAuthored(p, warm);
  return {
    path: low.cubics.length ? [{ curves: low.cubics, closed: p.closed }] : [],
    solution: low.solution,
  };
}

// ── the refit: the frame IS the curve's tight bbox ────────────────────────────

/**
 * A refitted frame and the same contours re-expressed in it (still box-local px).
 *
 * `paths` is in the NEW frame's local space, so a caller normalises it against
 * `frame.w`/`frame.h` and writes `frame.x`/`y`/`w`/`h` alongside - the two halves are one
 * answer and using one without the other moves the shape.
 */
export interface PenRefit { frame: PenFrame; paths: AuthoredPath[] }

/**
 * Refit a path box's frame to its curve, keeping the RENDERED shape exactly where it is.
 *
 * ## The invariant
 *
 * The frame equals the LOWERED curve's tight bounding box, over EVERY contour. That is the
 * single claim the rest of the editor reads: selection chrome, marquee hit-testing,
 * align/distribute, group bounds and the export bbox all address `x`/`y`/`w`/`h`, and
 * `hooks.js` clips the shape to it (`pathHtmlFor` emits a `viewBox` of exactly that size).
 * So a frame that is too small clips the curve and a frame that is too big makes every one
 * of those features address empty space.
 *
 * `pathBounds` is the TIGHT bbox - the kernel takes it from the derivative's roots - and
 * that is deliberate rather than convenient: a smooth node's handle legitimately sits
 * outside the frame without the curve following it there, so fitting the CONTROL HULL
 * instead would make every curved shape's box visibly too big and would grow it every time
 * a handle was pulled. Handles outside `[0,1]` stay legal; the curve never leaves it.
 *
 * ## Why this is not called per frame
 *
 * A refit during a drag would make the box chase the pointer and jump under it, so callers
 * refit once, when the gesture COMMITS. Which means the live gesture must paint somewhere
 * that does not clip - free-canvas.ts draws it on the overlay's native pen layer and hides
 * the box's own `<svg>` for the duration (`setPathSvgHidden`).
 *
 * ## Rotation
 *
 * `w`/`h` describe the UNROTATED frame and `rot` spins it about its own centre, so changing
 * `w`/`h` moves the centre of rotation and a naive refit makes a rotated shape jump. The
 * compensation is exact: with `R` the rotation, `c`/`c'` the old/new half-sizes and `b` the
 * bbox origin in old local px, the new frame origin is
 *
 *     (x', y') = (x, y) + (I − R)(c − c') + R·b
 *
 * which is just "solve `localToFrame(fr, l) === localToFrame(fr', l − b)` for `fr'`".
 *
 * ## Rounding, and why the offset is solved rather than assumed
 *
 * `boxCss`/`penFrame` round `x`/`y` and force `w`/`h` to `Math.max(1, round(v))`, so the
 * renderer reads a rounded frame and normalising against the un-rounded bbox would be off
 * by up to half a pixel per side. Since a refit runs on EVERY edit, that error would
 * accumulate. So the frame is rounded FIRST and the local offset is then back-solved from
 * the rounded numbers (`off = R⁻¹[(x', y') − (x, y) − (I − R)(c − c')]`): the shape is then
 * unmoved to floating point regardless of how the rounding fell, and the only residue left
 * is the wire format's six decimals of a fraction. The frame is consequently tight to
 * within half a pixel rather than exactly, and the second refit of an unchanged shape is a
 * fixed point - `round` of an already-rounded frame plus a sub-half-pixel nudge is itself.
 *
 * ## A degenerate axis
 *
 * A straight horizontal line has a zero-height bbox, as do a two-coincident-node path and
 * any all-collinear one. `w`/`h` clamp up to 1 (they must: the renderer divides by them),
 * and on such an axis the curve is CENTRED in the pixel it was given rather than pinned to
 * the frame's leading edge - a hairline down the middle of its own box reads as the shape
 * it is, and a 0.5px offset is invisible either way. No division by an extent ever happens,
 * so nothing here can produce a `NaN` from a degenerate axis.
 *
 * Returns null when there is no curve to fit (fewer than two nodes, an unlowerable kind, a
 * non-finite bound) - the caller's answer to that is to leave the frame alone.
 */
export function refitFrame(paths: AuthoredPath[], fr: PenFrame, warm?: HyperbezierSolution | null): PenRefit | null {
  const geom: GeomPath = [];
  for (let i = 0; i < paths.length; i++) {
    // Only the first contour is the one being edited, so it is the only one the warm start
    // belongs to; handing a 40-node solution to a 4-node hole would be worse than nothing.
    const low = lowerAuthored(paths[i]!, i === 0 ? warm : null);
    if (low.cubics.length) geom.push({ curves: low.cubics, closed: paths[i]!.closed });
  }
  if (!geom.length) return null;
  const bb = pathBounds(geom);
  if (!bb || ![bb.x0, bb.y0, bb.x1, bb.y1].every((v) => Number.isFinite(v))) return null;

  const ew = bb.x1 - bb.x0, eh = bb.y1 - bb.y0;
  const w = Math.max(1, Math.round(ew));
  const h = Math.max(1, Math.round(eh));
  // Where the bbox origin sits inside the new frame: the origin, except on an axis whose
  // extent is under a pixel and was therefore clamped up to 1 - see the degenerate note.
  const ox = ew < 1 ? (w - ew) / 2 : 0;
  const oy = eh < 1 ? (h - eh) / 2 : 0;
  const bx = bb.x0 - ox, by = bb.y0 - oy;

  const r = (fr.rot * Math.PI) / 180;
  const cs = fr.rot ? Math.cos(r) : 1, sn = fr.rot ? Math.sin(r) : 0;
  // (I − R)(c − c'): how far the centre of rotation travels when the frame resizes.
  const kx = fr.w / 2 - w / 2, ky = fr.h / 2 - h / 2;
  const gx = kx - (kx * cs - ky * sn), gy = ky - (kx * sn + ky * cs);
  const x = Math.round(fr.x + gx + (bx * cs - by * sn));
  const y = Math.round(fr.y + gy + (bx * sn + by * cs));
  // The offset the ROUNDED frame actually implies, R⁻¹ = [[c, s], [−s, c]].
  const vx = x - fr.x - gx, vy = y - fr.y - gy;
  const offX = vx * cs + vy * sn;
  const offY = -vx * sn + vy * cs;

  return {
    frame: { x, y, w, h, rot: fr.rot },
    // Handles are OFFSETS from their node, so a frame translation never touches one.
    paths: paths.map((p) => ({ ...p, nodes: p.nodes.map((n) => ({ ...n, x: n.x - offX, y: n.y - offY })) })),
  };
}

// ── drawing → a box ───────────────────────────────────────────────────────────

/** The frame + normalised path a finished draw commits. */
export interface PenCommit { x: number; y: number; w: number; h: number; path: AuthoredPath }

/**
 * A path drawn in NATIVE px → the frame it fits in plus its nodes normalised into it.
 *
 * This is `refitFrame` against the identity frame - native px ARE box-local px for a box
 * at the origin with no rotation - which is the point: a draw and every later edit have to
 * agree about where a path's frame is, and they do because it is one function. See it for
 * the tight-bbox invariant, the rounding, and what a degenerate axis gets.
 *
 * Returns null for anything that is not yet a path (fewer than two nodes, or a kind with
 * no lowering).
 */
export function penCommitFromNative(drawn: AuthoredPath): PenCommit | null {
  if (drawn.nodes.length < 2) return null;
  const fit = refitFrame([drawn], { x: 0, y: 0, w: 1, h: 1, rot: 0 });
  if (!fit) return null;
  const { x, y, w, h } = fit.frame;
  return { x, y, w, h, path: normNodes(fit.paths[0]!, w, h) };
}

// ── hit testing ───────────────────────────────────────────────────────────────

/** Where on a path a point lands: which segment, at what parameter, and how far off. */
export interface PathHit { segment: number; t: number; point: { x: number; y: number }; distance: number }

/** The nearest point on a lowered path. Segment `i` runs node `i` → node `i+1`, wrapping
 *  on the last segment of a closed path - the same indexing `pairs` uses in spline.ts, so
 *  a hit can be turned straight into a node insertion. */
export function nearestOnPath(cubics: Cubic[], x: number, y: number): PathHit | null {
  let best: PathHit | null = null;
  for (let i = 0; i < cubics.length; i++) {
    const r = nearestOnCubic(cubics[i]!, x, y);
    if (!best || r.distance < best.distance) best = { segment: i, t: r.t, point: r.point, distance: r.distance };
  }
  return best;
}

/** The index of the node within `tol` of a point, preferring the LAST one so a node
 *  placed on top of an earlier one is the one you grab. -1 when none. */
export function nodeAt(p: AuthoredPath, x: number, y: number, tol: number): number {
  let best = -1, bestD = tol;
  for (let i = p.nodes.length - 1; i >= 0; i--) {
    const n = p.nodes[i]!;
    const d = Math.hypot(n.x - x, n.y - y);
    if (d <= bestD) { bestD = d; best = i; }
  }
  return best;
}

/** The absolute position of a node's handle, or null when it has none. */
export function handlePoint(n: SplineNode, which: 'in' | 'out'): { x: number; y: number } | null {
  const dx = which === 'in' ? n.hInX : n.hOutX;
  const dy = which === 'in' ? n.hInY : n.hOutY;
  if (dx === undefined && dy === undefined) return null;
  return { x: n.x + (dx ?? 0), y: n.y + (dy ?? 0) };
}

// ── editing one node ──────────────────────────────────────────────────────────

/** Translate a set of nodes together, carrying their handles - handles are OFFSETS, so a
 *  node move is a field write and never a recomputation. `from` is the drag's STARTING
 *  nodes, so a live drag accumulates no error from applying deltas to deltas. */
export function moveNodes(p: AuthoredPath, indices: Iterable<number>, dx: number, dy: number, from?: SplineNode[]): AuthoredPath {
  const set = new Set(indices);
  const src = from ?? p.nodes;
  return {
    ...p,
    nodes: p.nodes.map((n, k) => (set.has(k) ? { ...n, x: (src[k] ?? n).x + dx, y: (src[k] ?? n).y + dy } : n)),
  };
}

/** Which edge of the selection's own bounding box `alignNodes` snaps to. Deliberately the
 *  same six names the box-level `AlignEdge` uses, so one menu can drive either. */
export type NodeAlignEdge = 'left' | 'hcentre' | 'right' | 'top' | 'vcentre' | 'bottom';

/** The selected indices, deduplicated, in range, and in path order. */
function selIdx(p: AuthoredPath, indices: Iterable<number>): number[] {
  return [...new Set(indices)].filter((i) => Number.isInteger(i) && i >= 0 && i < p.nodes.length).sort((a, b) => a - b);
}

/**
 * Align the selected nodes to an edge of THEIR OWN bounding box.
 *
 * Nodes have no size, so unlike boxes there is no edge-versus-centre distinction to get
 * wrong: "align left" is exactly "give them all the selection's minimum x". Handles are
 * offsets and ride along untouched, which is the point - straightening a row of points
 * must not also flatten the curves passing through them.
 *
 * The reference is the SELECTION's box, never the whole path's and never the canvas's.
 * Aligning two points should move at most one of them, and a reference the user did not
 * select is how an align becomes a surprise.
 */
export function alignNodes(p: AuthoredPath, indices: Iterable<number>, edge: NodeAlignEdge): AuthoredPath {
  return alignPoints(p, selIdx(p, indices).map((i) => ({ node: i })), edge);
}

/**
 * Space the selected nodes evenly along an axis, holding the two extremes still.
 *
 * Equal SPACING rather than equal gaps, because a point has no width and the two are the
 * same thing for points - which is why this needs no AABB per item the way
 * `distributeBoxes` does. Ordering is by coordinate, NOT by index: the nodes a user rubber-
 * bands across a traced outline are rarely consecutive along the path, and distributing
 * them in path order would shuffle them past each other.
 */
export function distributeNodes(p: AuthoredPath, indices: Iterable<number>, axis: 'h' | 'v'): AuthoredPath {
  return distributePoints(p, selIdx(p, indices).map((i) => ({ node: i })), axis);
}

// ── nodes AND control points (handles) ─────────────────────────────────────────
//
// Align/distribute over a MIXED selection of nodes and control points. A control point
// is a node's in/out handle; unlike `alignNodes` (which leaves handles alone), here a
// SELECTED handle is a point in its own right - its absolute position is aligned, which
// means changing its OFFSET from the node. Only `cubic`/`hyperbezier` paths have handles
// to select; the other kinds are handle-free, so this degrades to node-only there.

/** A selectable point: a node, or one of its handles. */
export interface PenPointRef { node: number; handle?: 'in' | 'out' }

export const penRefKey = (r: PenPointRef): string => (r.handle ? `${r.node}:${r.handle}` : `${r.node}`);

/** Absolute position of a point ref, or null (out-of-range node, or a handle a node
 *  doesn't have - handles are OPTIONAL, an absent one is "no handle", not (0,0)). */
function refAbs(nodes: SplineNode[], r: PenPointRef): { x: number; y: number } | null {
  const n = nodes[r.node];
  if (!n) return null;
  if (!r.handle) return { x: n.x, y: n.y };
  const hx = r.handle === 'in' ? n.hInX : n.hOutX;
  const hy = r.handle === 'in' ? n.hInY : n.hOutY;
  if (hx == null || hy == null) return null;
  return { x: n.x + hx, y: n.y + hy };
}

/** Apply per-ref absolute-coordinate targets (only the aligned/distributed axis is set;
 *  the other keeps its value). A node target moves the node; a handle target changes its
 *  offset, computed against the node's FINAL position, so a node+handle both selected stay
 *  coincident on the aligned axis. */
function applyRefTargets(p: AuthoredPath, targets: Map<string, { x?: number; y?: number }>): AuthoredPath {
  if (!targets.size) return p;
  return {
    ...p,
    nodes: p.nodes.map((n, k) => {
      const nt = targets.get(`${k}`);
      const nx = nt?.x ?? n.x, ny = nt?.y ?? n.y;
      const out: SplineNode = { ...n, x: nx, y: ny };
      const it = targets.get(`${k}:in`);
      if (it && n.hInX != null && n.hInY != null) {
        out.hInX = (it.x ?? n.x + n.hInX) - nx;
        out.hInY = (it.y ?? n.y + n.hInY) - ny;
      }
      const ot = targets.get(`${k}:out`);
      if (ot && n.hOutX != null && n.hOutY != null) {
        out.hOutX = (ot.x ?? n.x + n.hOutX) - nx;
        out.hOutY = (ot.y ?? n.y + n.hOutY) - ny;
      }
      return out;
    }),
  };
}

/** The valid, deduplicated refs with a resolvable absolute position, and that AABB. */
function refPositions(p: AuthoredPath, refs: PenPointRef[]): { key: string; x: number; y: number }[] {
  const seen = new Set<string>();
  const out: { key: string; x: number; y: number }[] = [];
  for (const r of refs) {
    const key = penRefKey(r);
    if (seen.has(key)) continue;
    const pos = refAbs(p.nodes, r);
    if (!pos) continue;
    seen.add(key);
    out.push({ key, x: pos.x, y: pos.y });
  }
  return out;
}

/** Align selected nodes AND control points to an edge of their shared bounding box. */
export function alignPoints(p: AuthoredPath, refs: PenPointRef[], edge: NodeAlignEdge): AuthoredPath {
  const pts = refPositions(p, refs);
  if (pts.length < 2) return p;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const q of pts) { if (q.x < minX) minX = q.x; if (q.x > maxX) maxX = q.x; if (q.y < minY) minY = q.y; if (q.y > maxY) maxY = q.y; }
  const t: { x?: number; y?: number } =
    edge === 'left' ? { x: minX } : edge === 'right' ? { x: maxX } : edge === 'hcentre' ? { x: (minX + maxX) / 2 }
    : edge === 'top' ? { y: minY } : edge === 'bottom' ? { y: maxY } : { y: (minY + maxY) / 2 };
  const targets = new Map<string, { x?: number; y?: number }>();
  for (const q of pts) targets.set(q.key, t);
  return applyRefTargets(p, targets);
}

/** Space selected nodes AND control points evenly along an axis, holding the extremes. */
export function distributePoints(p: AuthoredPath, refs: PenPointRef[], axis: 'h' | 'v'): AuthoredPath {
  const pts = refPositions(p, refs);
  if (pts.length < 3) return p;
  const co = (q: { x: number; y: number }): number => (axis === 'h' ? q.x : q.y);
  const order = pts.map((q, i) => ({ q, i })).sort((a, b) => co(a.q) - co(b.q) || a.i - b.i).map((e) => e.q);
  const first = co(order[0]!), last = co(order[order.length - 1]!);
  const step = (last - first) / (order.length - 1);
  const targets = new Map<string, { x?: number; y?: number }>();
  order.forEach((q, k) => targets.set(q.key, axis === 'h' ? { x: first + step * k } : { y: first + step * k }));
  return applyRefTargets(p, targets);
}

/**
 * Point one of node `i`'s handles at an absolute position, then re-apply the node's
 * continuity constraint.
 *
 * `enforceContinuity` is the whole reason `Continuity` is stored rather than inferred, and
 * this is its one call site on the drag path: `smooth` holds the two handles collinear,
 * `symmetric` holds them collinear AND equal in length, `corner` leaves the other alone.
 */
export function dragHandle(p: AuthoredPath, i: number, which: 'in' | 'out', x: number, y: number): AuthoredPath {
  if (i < 0 || i >= p.nodes.length) return p;
  const n = p.nodes[i]!;
  const moved: SplineNode = which === 'in'
    ? { ...n, hInX: x - n.x, hInY: y - n.y }
    : { ...n, hOutX: x - n.x, hOutY: y - n.y };
  const next = enforceContinuity(moved, which);
  return { ...p, nodes: p.nodes.map((m, k) => (k === i ? next : m)) };
}

/** Set a node's continuity and immediately satisfy it, so the constraint is true of the
 *  geometry and not merely declared. The OUT handle is treated as the authority - it is
 *  the one a pen drag pulls - so `in` is what moves to comply. */
export function setNodeContinuity(p: AuthoredPath, indices: Iterable<number>, c: Continuity): AuthoredPath {
  const set = new Set(indices);
  return {
    ...p,
    nodes: p.nodes.map((n, k) => (set.has(k) ? enforceContinuity({ ...n, continuity: c }, 'out') : n)),
  };
}

/**
 * Insert a node ON the curve at the nearest point to (x, y).
 *
 * For `'cubic'` this is EXACT: de Casteljau's split at `t` gives two cubics that together
 * are the original, so the shape does not move by a float - the new node's handles and its
 * two neighbours' facing handles are read straight out of the split. For every other kind
 * the handles are derived (or solved), so all that can be done is to put a node at the
 * point: the curve then passes through it and the shape shifts by however much the
 * neighbouring knot spacing changed. Documented rather than hidden, because "insert
 * changed my curve" is otherwise read as a bug.
 *
 * `p` is a DENORMALISED path (box-local px) and so is the returned one.
 */
export interface InsertResult { path: AuthoredPath; index: number; point: { x: number; y: number }; distance: number }

export function insertNodeOnCurve(p: AuthoredPath, x: number, y: number, warm?: HyperbezierSolution | null): InsertResult | null {
  const { cubics } = lowerAuthored(p, warm);
  const hit = nearestOnPath(cubics, x, y);
  if (!hit) return null;
  const n = p.nodes.length;
  const at = hit.segment;                 // segment `at` runs node `at` → node (at+1) % n
  const nextIx = (at + 1) % n;
  const P = hit.point;
  const cont = defaultContinuity(p.kind);

  if (p.kind !== 'cubic') {
    const nodes = p.nodes.slice();
    nodes.splice(at + 1, 0, { x: P.x, y: P.y, continuity: cont });
    return { path: { ...p, nodes }, index: at + 1, point: P, distance: hit.distance };
  }

  const [A, B] = splitCubic(cubics[at]!, hit.t);
  const nodes = p.nodes.slice();
  nodes[at] = { ...nodes[at]!, hOutX: A[2] - nodes[at]!.x, hOutY: A[3] - nodes[at]!.y };
  nodes[nextIx] = { ...nodes[nextIx]!, hInX: B[4] - nodes[nextIx]!.x, hInY: B[5] - nodes[nextIx]!.y };
  const mid: SplineNode = {
    x: A[6], y: A[7],
    hInX: A[4] - A[6], hInY: A[5] - A[7],
    hOutX: B[2] - A[6], hOutY: B[3] - A[7],
    // The split's two arms are collinear by construction, so 'smooth' is a true statement
    // about the geometry rather than a constraint that would immediately move it.
    continuity: 'smooth',
  };
  nodes.splice(at + 1, 0, mid);
  return { path: { ...p, nodes }, index: at + 1, point: P, distance: hit.distance };
}

/** Remove nodes. Returns null when fewer than two would be left - a one-node path is not
 *  a path, and the caller's answer to that is to delete the box, not to store a stub. */
export function deleteNodes(p: AuthoredPath, indices: Iterable<number>): AuthoredPath | null {
  const set = new Set(indices);
  const nodes = p.nodes.filter((_, k) => !set.has(k));
  return nodes.length >= 2 ? { ...p, nodes } : null;
}

// ── switching spline kind ─────────────────────────────────────────────────────

/**
 * Convert a path to another kind, reporting whether authored work was discarded.
 *
 * The asymmetry the plan insists on is real and it runs this way round:
 *
 *   - **to `'cubic'` is lossless.** The current kind's lowering is BAKED into explicit
 *     handles, so the shape after the switch is the shape before it, to rounding. A
 *     hyperbezier's solved arms become authored arms and are then the user's to drag.
 *   - **to `'hyperbezier'` (or any derived kind) is lossy.** Authored handles are
 *     DROPPED, not kept: `hbPin` reads a handle as a hard tangent pin, so carrying them
 *     over would pin every tangent on the path and turn the global curvature solve into a
 *     chain of independent single-segment runs - the exact opposite of what switching to
 *     hyperbezier is for. Once dropped, the lengths cannot be recovered, which is why the
 *     UI has to say so BEFORE it happens.
 *
 * So `hyperbezier → cubic → hyperbezier` returns the original path: the bake adds handles,
 * the drop removes them, and the nodes and continuities never moved.
 */
export interface KindSwitch { path: AuthoredPath; lossy: boolean }

export function convertKind(p: AuthoredPath, to: SplineKind, warm?: HyperbezierSolution | null): KindSwitch {
  if (to === p.kind) return { path: p, lossy: false };
  if (to === 'cubic') return { path: bakeToCubic(p, warm), lossy: false };
  const hadHandles = p.nodes.some((n) => n.hInX !== undefined || n.hInY !== undefined || n.hOutX !== undefined || n.hOutY !== undefined);
  const nodes = p.nodes.map((n) => {
    const out: SplineNode = { x: n.x, y: n.y };
    if (n.continuity !== undefined) out.continuity = n.continuity;
    return out;
  });
  return { path: { ...p, kind: to, nodes }, lossy: hadHandles };
}

/** True when switching to `to` would discard authored handles - what the UI warns on. */
export function kindSwitchIsLossy(p: AuthoredPath, to: SplineKind): boolean {
  return convertKind(p, to).lossy;
}

/** Bake whatever the current kind lowers to into explicit `cubic` handles. `bspline` is
 *  the one kind whose curve does not pass through its nodes, so its baked form has the
 *  lowering's own endpoints as nodes rather than the old control points. */
function bakeToCubic(p: AuthoredPath, warm?: HyperbezierSolution | null): AuthoredPath {
  const { cubics } = lowerAuthored(p, warm);
  if (!cubics.length) return { ...p, kind: 'cubic' };
  const closed = p.closed && cubics.length > 2;
  const nodes: SplineNode[] = [];
  for (let i = 0; i < cubics.length; i++) {
    const k = cubics[i]!;
    const node: SplineNode = { x: k[0], y: k[1], hOutX: k[2] - k[0], hOutY: k[3] - k[1] };
    const prev = i > 0 ? cubics[i - 1] : (closed ? cubics[cubics.length - 1] : undefined);
    if (prev) { node.hInX = prev[4] - k[0]; node.hInY = prev[5] - k[1]; }
    // Continuity comes from the SOURCE node where the counts line up (they do for every
    // kind whose lowering is one cubic per segment); otherwise the honest answer is the
    // kind's own default rather than a claim about handles we just computed.
    node.continuity = p.nodes[i]?.continuity ?? defaultContinuity(p.kind);
    nodes.push(node);
  }
  if (!closed) {
    const last = cubics[cubics.length - 1]!;
    nodes.push({
      x: last[6], y: last[7], hInX: last[4] - last[6], hInY: last[5] - last[7],
      continuity: p.nodes[nodes.length]?.continuity ?? defaultContinuity(p.kind),
    });
  }
  return { kind: 'cubic', nodes, closed: p.closed };
}

// ── drawing state ─────────────────────────────────────────────────────────────

/**
 * Pull a node's handles out symmetrically, the universal click-DRAG idiom: the outgoing
 * handle follows the pointer and the incoming one mirrors it. `corner` skips both, which
 * is what the modifier during drawing selects.
 */
export function pullHandles(node: SplineNode, dx: number, dy: number): SplineNode {
  if ((node.continuity ?? 'smooth') === 'corner') return node;
  return { ...node, hOutX: dx, hOutY: dy, hInX: -dx, hInY: -dy };
}

/** Is the cursor over the draft's FIRST node, i.e. would a click close the path? */
export function closesOnClick(nodes: SplineNode[], x: number, y: number, tol: number): boolean {
  if (nodes.length < 3) return false;
  const first = nodes[0]!;
  return Math.hypot(first.x - x, first.y - y) <= tol;
}

// ── paint on a newly drawn path ───────────────────────────────────────────────
//
// A drawn path has to be BORN with paint. Editing one never loses it (penEditWrite
// spreads the existing box and rewrites only the path and the frame), but the commit
// that creates it starts from an empty object, so whatever it does not seed is simply
// absent - and a path with no fill and no stroke renders as nothing at all. That is
// not a hypothetical: a tool may declare `canvas.pathField` (which is what offers the
// pen) without declaring a `path` add-kind (which is what carries a brand's idea of
// what a path looks like), and Sequence Studio does exactly that.
//
// So paint is resolved per FIELD from a priority list rather than taken wholesale from
// one seed: the paint the user last put on a path wins, then the tool's `path` seed,
// then any other seed that has an opinion. Per-field because the two are genuinely
// partial - lolly-start's path seed is stroke-only, SUSE's is fill-only - and a
// wholesale "first non-empty seed" would drop the half the winner does not mention.

/** The paint sub-field NAMES a path box can carry: a narrow view of the canvas config. */
export interface PathPaintFields {
  fill?: string | undefined;
  stroke?: string | undefined;
  strokeW?: string | undefined;
  fillRule?: string | undefined;
}

type PaintBox = Record<string, InputValue | undefined>;

/** Does this source actually express this paint field? `''`/null/undefined do not, and
 *  neither does a zero stroke width - both are how a seed says "no stroke", which must
 *  not out-rank a later source that does have one. */
function statesPaint(src: PaintBox, field: string | undefined, isWidth: boolean): boolean {
  if (!field) return false;
  const v = src[field];
  if (v == null || v === '') return false;
  return isWidth ? Number(v) > 0 : true;
}

/**
 * The paint a newly drawn path should be born with, resolved field by field from
 * `sources` in priority order (earlier wins). Sources may be null and may each speak
 * to only some of the fields.
 *
 * Stroke colour and stroke width travel TOGETHER: a stroke colour with no width paints
 * nothing, and a width with no colour is just as invisible, so whichever source supplies
 * the colour supplies the width too (falling back to `strokeWFallback`). Deciding them
 * independently produced exactly those two dead states.
 */
export function pathPaintSeed(
  f: PathPaintFields,
  sources: ReadonlyArray<PaintBox | null | undefined>,
  strokeWFallback = 4,
): PaintBox {
  const out: PaintBox = {};
  const live = sources.filter((s): s is PaintBox => !!s);
  if (f.fill) {
    const src = live.find((s) => statesPaint(s, f.fill, false));
    if (src) out[f.fill] = src[f.fill!];
  }
  if (f.stroke) {
    const src = live.find((s) => statesPaint(s, f.stroke, false));
    if (src) {
      out[f.stroke] = src[f.stroke!];
      if (f.strokeW) {
        const w = Number(src[f.strokeW]);
        out[f.strokeW] = Number.isFinite(w) && w > 0 ? w : strokeWFallback;
      }
    }
  }
  if (f.fillRule) {
    const src = live.find((s) => statesPaint(s, f.fillRule, false));
    if (src) out[f.fillRule] = src[f.fillRule!];
  }
  return out;
}

/** Would this paint render as something a user can actually see? */
export function pathPaintIsVisible(f: PathPaintFields, paint: PaintBox): boolean {
  const fill = f.fill ? paint[f.fill] : undefined;
  if (fill != null && fill !== '' && String(fill) !== 'none') return true;
  const stroke = f.stroke ? paint[f.stroke] : undefined;
  if (stroke == null || stroke === '' || String(stroke) === 'none') return false;
  return !f.strokeW || Number(paint[f.strokeW]) > 0;
}

/**
 * The ink a paint-less path should be stroked in, from the pen preview's own resolved
 * colour (`getComputedStyle(penLayer).color` - the brand primary, i.e. the colour the user
 * literally just watched the curve being drawn in).
 *
 * Resolved to a concrete hex because a box field has to render headlessly, where a CSS
 * variable cannot. `fallback` covers the case where the colour cannot be read at all - no
 * stylesheet applied, a detached layer - which a real browser does not reach but a jsdom
 * test does, and where a shape with no paint is still worse than a shape in the wrong one.
 */
export function resolveDrawnInk(computedColor: string | null | undefined, fallback = '#000000'): string {
  const c = computedColor ? parseColor(computedColor) : null;
  if (!c) return fallback;
  // Alpha is dropped deliberately: the preview is translucent chrome, the committed shape
  // is artwork, and a 60%-alpha stroke would look like a rendering bug rather than a choice.
  const hex = colorToHexString({ ...c, alpha: 1 });
  return hex || fallback;
}

/** Just the paint fields of a box, for remembering what the user last used. */
export function pickPathPaint(f: PathPaintFields, box: PaintBox | null | undefined): PaintBox | null {
  if (!box) return null;
  const out: PaintBox = {};
  for (const field of [f.fill, f.stroke, f.strokeW, f.fillRule]) {
    if (field && box[field] != null) out[field] = box[field];
  }
  return Object.keys(out).length > 0 ? out : null;
}
