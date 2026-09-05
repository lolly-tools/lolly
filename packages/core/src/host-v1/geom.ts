// SPDX-License-Identifier: MPL-2.0

// ─── Vector geometry (optional, v1.64) ───────────────────────────────────────

/**
 * Exact Bézier geometry - booleans, offsetting, stroke outlining, authored-spline
 * lowering, simplification and hit testing. The engine's geometry kernel
 * (engine/src/geom/) behind a tool-facing surface, attached verbatim by every
 * shell (`host.geom = makeGeomApi()`), so web / Tauri / CLI can never drift.
 * Pure math: DOM-free, synchronous, no platform dependency - the same shape as
 * `host.color`. Optional/additive and NOT gated by a `capabilities` flag: a tool
 * feature-detects `host.geom` and degrades where it's absent (or raises its
 * manifest `engineVersion` floor to `">=1.64"` if it genuinely cannot).
 *
 * ## The currency is SVG path data
 *
 * Every path in and out of this API is a path-data **string** - the form a tool
 * already puts in a template, stores in state and packs into a URL. Nothing here
 * asks a tool to build flat control-point tuples. `parse` / `toPathData` expose
 * the structured form (whole cubics, 8 numbers each) for callers that want to
 * walk or edit the curves themselves; `d` in, `d` out is the normal path.
 *
 * ## Errors are RETURNED, not thrown
 *
 * Every method returns a discriminated result: `{ ok: true, … }` or
 * `{ ok: false, code, message }`. Two reasons, both about what a tool can do
 * with the answer:
 *
 * - Invalid path data is *ordinary* input here, not an exceptional condition. A
 *   `d` string can arrive from a paste, a URL param or a half-finished pen drag,
 *   and "that isn't a path" is a state the tool must render something for.
 * - A throw from `onInit`/`onInput` is caught and LOGGED by the runtime, then
 * discarded - the tool's inputs simply don't update and the user sees nothing.
 *   A pen tool that silently stopped responding mid-drag is the worst possible
 *   failure mode, so failure is made a value the hook has to look at.
 *
 * `code` keeps the distinctions the kernel makes; it never collapses them:
 *
 * - `'invalid-path'` - the path data is malformed (bad command, wrong argument
 *   count, unparseable number, a non-finite or absurd coordinate). Your input
 *   was wrong. Reject it; do not retry.
 * - `'too-large'` - well-formed but past the parse ceilings (see `limits()`):
 *   too many characters, commands or curves. Retryable with a smaller path.
 * - `'limit'` - the *operation* could not be answered within bounded work (the
 *   kernel's `GeomLimitError`). The input was fine and the answer exists; this
 *   engine declines to guess at it. Retryable with simpler operands, a coarser
 *   `tolerance`, or fewer paths at once.
 * - `'invalid-argument'` - a non-path argument is wrong (a NaN distance, an
 *   unknown join style, one path where two were needed).
 * - `'unsupported'` - a declared-but-unimplemented feature, e.g. a `spline`
 *   `kind` the running engine knows the name of but cannot lower yet.
 * - `'internal'` - an unexpected engine failure. A bug; report it.
 *
 * What no code means: a silently-wrong path. There is no degraded fallback
 * anywhere in this API - every method either returns geometry it stands behind
 * or tells you it didn't.
 */
export interface GeomAPI {
  // ── boolean operations ──────────────────────────────────────────────────────
  /** Union of two or more paths - everything any operand covers. */
  union(paths: string[], opts?: GeomBooleanOpts): GeomPathResult;
  /** Intersection of two or more paths - only what EVERY operand covers, folded
   *  left to right. */
  intersect(paths: string[], opts?: GeomBooleanOpts): GeomPathResult;
  /** The first path minus every later one (`paths[0] − paths[1] − …`). */
  difference(paths: string[], opts?: GeomBooleanOpts): GeomPathResult;
  /** Symmetric difference - covered by an odd number of operands. */
  xor(paths: string[], opts?: GeomBooleanOpts): GeomPathResult;
  /**
   * Canonical form of ONE path: self-intersections resolved, contours oriented
   * so holes wind opposite their shell, overlaps merged. What a pen tool should
   * run on a freshly-closed path before filling it, and the only boolean that
   * never reports `'limit'`.
   */
  selfUnion(d: string, opts?: GeomBooleanOpts): GeomPathResult;

  // ── offset / stroke ─────────────────────────────────────────────────────────
  /**
   * Grow (`distance > 0`) or shrink (`distance < 0`) a path. Closed contours
   * offset outward/inward; an open contour yields the one-sided offset, positive
   * to the left of travel. An inward offset past the shape's inradius correctly
   * returns an EMPTY path (`ok: true`, `d: ''`), not the input.
   */
  offset(d: string, distance: number, opts?: GeomOffsetOpts): GeomPathResult;
  /**
   * The outline of `d` stroked at `width`, as a path that FILLS to the same
   * region under the nonzero rule - a real `<path fill>`, no `stroke` attribute.
   * Defaults match SVG's (`butt` cap, `miter` join, miter limit 4) so the
   * outline reproduces what a renderer would have painted.
   */
  stroke(d: string, width: number, opts?: GeomStrokeOpts): GeomPathResult;

  // ── authored splines (the pen tool's own form) ───────────────────────────────
  /**
   * Lower an authored node list to path data. `kind` is a plain STRING that the
   * ENGINE validates, so a spline kind added in a later engine needs no bridge
   * change: pass it through and read the result - an engine that doesn't know it
   * answers `'invalid-argument'`, one that knows-but-can't answers
   * `'unsupported'`.
   */
  fromNodes(path: GeomAuthoredPath): GeomPathResult;
  /**
   * Re-apply a node's continuity constraint after ONE of its handles moved
   * (`'in'` or `'out'`) - the operation a pen tool performs on every handle
   * drag. Returns the corrected node; `'corner'` nodes come back untouched.
   */
  continuity(node: GeomNode, moved: 'in' | 'out'): GeomResult<GeomNode>;
  /**
   * An authored path - or SEVERAL, which is the general case - → ONE string that
   * is safe to store in an input value, a `blocks` sub-field and a share link.
   *
   * Several, because a `GeomAuthoredPath` holds exactly one `nodes` run and a
   * great many shapes are not one run: a boolean subtract punches a hole, an xor
   * of two rings is four loops. Pass the list and lower every member (`fillRule`
   * then does its job across them). A one-element list, and a bare path, encode
   * to the same bytes.
   *
   * The reason this is on the bridge rather than left to each caller: a pen
   * shape is persisted, so it is written by an editor (shell code), read by
   * `hooks.js` (tool code, which cannot import the engine) and asserted on by
   * tests. Three copies of a codec is three codecs that drift, and a drifted
   * one silently mis-renders every link already in the wild.
   *
   * The form is delimiter-safe by construction: every character is in
   * `encodeURIComponent`'s unreserved set except `~`, so it contains no `,` and
   * no `~` - the two separators of the compact blocks-URL format, which cannot
   * be escaped (`URLSearchParams` percent-decodes the query before the block
   * splitter runs). It therefore costs zero bytes to percent-encode and never
   * pushes a blocks input onto its JSON fallback. Treat it as opaque: it is
   * versioned, and only this API is entitled to read it.
   */
  encodeAuthored(path: GeomAuthoredPath | GeomAuthoredPath[]): GeomResult<string>;
  /**
   * The inverse. ALWAYS a list, of at least one path - a one-path value decodes
   * to a one-element array rather than to a bare path, so a caller can never
   * accidentally render the first contour of a shape and drop its holes.
   *
   * A value that is not an encoded authored path - empty, garbage, hand-edited,
   * or written by a NEWER format version - answers `'invalid-argument'` rather
   * than a partially-decoded path: half a shape would render as
   * confidently-wrong artwork. One well-formed but oversized (past the node
   * ceiling `limits().maxNodes` reports, counted across the whole value) answers
   * `'too-large'`, which is the same distinction every other method makes.
   */
  decodeAuthored(value: string): GeomResult<GeomAuthoredPath[]>;

  // ── simplify ────────────────────────────────────────────────────────────────
  /**
   * Fewer segments within `tolerance` (default 0.01 px), by curve fitting.
   * Returns the path UNCHANGED when a fit wouldn't actually be shorter.
   *
   * A deliberate decision about a FINISHED path, made for file size. Do not run
   * it between booleans: a boolean's output points lie exactly on its inputs,
   * and fitting moves them off, so a simplified path can no longer be combined
   * with the shapes it came from without accumulating error.
   */
  simplify(d: string, opts?: { tolerance?: number }): GeomPathResult;

  // ── measurement / hit testing ───────────────────────────────────────────────
  /** Tight bounding box - the curves' true extent, not their control hull.
   *  An empty path has no box, so `value` is `null`. */
  bounds(d: string): GeomResult<GeomBox | null>;
  /**
   * SIGNED area, exact (Green's theorem per cubic - nothing is sampled).
   * Positive means counter-clockwise in a y-up frame, which reads as clockwise
   * on screen in SVG's y-down one. Self-overlapping input gives the algebraic,
   * winding-weighted area; run `selfUnion` first for the FILLED area.
   */
  area(d: string): GeomResult<number>;
  /** Is the point inside the filled region, under `fillRule` (default
   *  `'nonzero'`)? Ray casting against the real curves. */
  contains(
    d: string,
    x: number,
    y: number,
    opts?: { fillRule?: GeomFillRule }
  ): GeomResult<boolean>;
  /** Winding number at the point - how many times the path wraps it, signed.
   *  `contains` under the nonzero rule is `winding !== 0`. */
  winding(d: string, x: number, y: number): GeomResult<number>;
  /**
   * Nearest point ON the path to an arbitrary point, with the address that
   * located it - a pen tool's hit test, snap, and "insert a node here". The
   * point is computed from the curve, not sampled near it.
   */
  nearest(d: string, x: number, y: number): GeomResult<GeomNearest>;

  // ── structured form ─────────────────────────────────────────────────────────
  /**
   * Path data → whole cubics. Every shorthand is expanded and every curve type
   * normalised: H/V → lines, Q/T → cubics exactly, A → cubics by the SVG spec's
   * endpoint parameterisation (F.6.5), one per ≤90° sweep.
   */
  parse(d: string): GeomResult<GeomContour[]>;
  /** Whole cubics → path data. Straight pieces are written as `L`, not as a
   *  cubic with collinear controls. `decimals` defaults to 4. */
  toPathData(contours: GeomContour[], opts?: { decimals?: number }): GeomPathResult;

  /** The parse ceilings this engine enforces, so a tool can check a path before
   *  offering an operation rather than after failing one. */
  limits(): GeomLimits;
}

export type GeomFillRule = 'nonzero' | 'evenodd';

export type GeomJoinStyle = 'miter' | 'round' | 'bevel';

export type GeomCapStyle = 'butt' | 'round' | 'square';

/** Why a geometry call couldn't answer - see the `GeomAPI` doc comment. */
export type GeomErrorCode =
  | 'invalid-path'
  | 'too-large'
  | 'limit'
  | 'invalid-argument'
  | 'unsupported'
  | 'internal';

export interface GeomFailure {
  ok: false;
  code: GeomErrorCode;
  /** Human-readable, safe to log; not intended for end-user display. */
  message: string;
}

/** A path-producing result. `d` is `''` for a legitimately empty region (an
 * intersection that doesn't overlap, an over-shrunk offset) - `ok: true` with
 *  no geometry is an ANSWER, not a failure. */
export type GeomPathResult =
  | { ok: true; d: string; contours: number; curves: number }
  | GeomFailure;

/** A value-producing result. */
export type GeomResult<T> = { ok: true; value: T } | GeomFailure;

export interface GeomBooleanOpts {
  /** Positional tolerance - how far apart two coordinates may be and still count
   *  as the same point. Default 1e-9-ish (the kernel's EPS). */
  tolerance?: number;
  /** How the OPERANDS' own interiors are read. It does not describe the result:
   *  a boolean's output never self-overlaps, so both rules read it identically. */
  fillRule?: GeomFillRule;
  /** Decimal places in the emitted path data (default 4). */
  decimals?: number;
}

export interface GeomOffsetOpts {
  /** Outer-corner treatment, default `'miter'`. */
  join?: GeomJoinStyle;
  /** Miter spike ratio past which a miter becomes a bevel, default 4 (SVG's). */
  miterLimit?: number;
  /** How closely the offset curves must follow the TRUE offset, in px. Default
   * 0.01 - finer than any raster device resolves. A fitting error, not a
   *  positional tolerance. */
  tolerance?: number;
  decimals?: number;
}

export interface GeomStrokeOpts extends GeomOffsetOpts {
  /** Open-end treatment, default `'butt'`. */
  cap?: GeomCapStyle;
}

/** One contour: whole cubics, each `[x0,y0, x1,y1, x2,y2, x3,y3]`, consecutive
 *  curves sharing endpoints. `closed` means the last curve's endpoint joins the
 * first's start - the closing straight edge is implicit and not stored. */
export interface GeomContour {
  curves: number[][];
  closed: boolean;
}

export interface GeomBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface GeomNearest {
  /** The point on the path. */
  x: number;
  y: number;
  /** Distance from the queried point (always ≥ 0 - unsigned; use `contains` for
   *  which side). */
  distance: number;
/** Index of the matched contour, and of the curve within that contour. */
  contour: number;
  curve: number;
  /** Bézier parameter on that curve, 0…1 - where to split for a new node. */
  t: number;
}

/** How a node's handles behave when one is dragged. Authoring intent: it cannot
 *  be recovered from the geometry afterwards, which is why the authored form is
 *  kept alongside the lowered path. */
export type GeomContinuity = 'corner' | 'smooth' | 'symmetric';

/** One authored on-curve point. Handles are OFFSETS from the point, not absolute
 *  coordinates, so moving a node moves its handles with it. */
export interface GeomNode {
  x: number;
  y: number;
  /** Incoming handle offset (towards the previous node). */
  hInX?: number;
  hInY?: number;
  /** Outgoing handle offset (towards the next node). */
  hOutX?: number;
  hOutY?: number;
  continuity?: GeomContinuity;
}

export interface GeomAuthoredPath {
  /**
   * The spline family. A STRING, not a union, on purpose: the engine owns the
   * list and validates it, so a kind added in a later engine version reaches it
   * through an unchanged bridge. Known at v1.64: `'cubic'` (explicit handles -
   * the ordinary pen path), `'line'`, `'catmull-rom'`, `'bspline'`,
   * `'hyperbezier'` (Levien's two-parameter curve - curvature-continuous from
   * nodes alone, and the pen tool's default), plus declared-not-implemented
   * kinds that answer `'unsupported'`.
   *
   * Two notes specific to `'hyperbezier'`, because they surprise pen-tool
   * authors: a node's `continuity` defaults to `'smooth'` here rather than
   * `'corner'` (a default that broke the spline would draw polylines), and an
   * authored handle pins the tangent DIRECTION only - the solve owns arm
   * length, since that is what it spends to make curvature continuous.
   */
  kind: string;
  nodes: GeomNode[];
  closed: boolean;
  /** Catmull-Rom only: 0 uniform, 0.5 centripetal (default), 1 chordal. */
  tension?: number;
  decimals?: number;
}

/** The parse ceilings. Untrusted path data (a paste, a URL param, an imported
 *  SVG) is the normal case, so parsing is bounded rather than trusted: past any
 *  of these a call returns `'too-large'` instead of working for a long time. */
export interface GeomLimits {
  /** Characters in one `d` string. */
  maxChars: number;
  /** Path commands in one `d` string. */
  maxCommands: number;
  /** Cubics after normalisation (arcs expand to up to 4 each). */
  maxCurves: number;
  /** Largest absolute coordinate accepted. Bigger is not a bigger drawing, it is
   *  a corrupt number: past this a call returns `'invalid-path'`, because the
   *  arithmetic downstream of it overflows to Infinity. */
  maxCoordinate: number;
  /** Operand paths one boolean call may take. */
  maxPaths: number;
  /** Nodes in one `fromNodes` call. */
  maxNodes: number;
}
