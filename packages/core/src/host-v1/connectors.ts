// SPDX-License-Identifier: MPL-2.0

// ─── Perceptual colour tools (optional, v1.40) ──────────────────────────────────

/**
 * All methods are pure and synchronous. Colour arguments accept hex
 * (`#rgb…#rrggbbaa`) or `oklch()`/`lch()` strings - the forms token values
 * take; metrics return NaN on unparseable input, `ramp` throws (an authoring
 * error). Every emitted colour is a gamut-mapped `#rrggbb`.
 */
/** A native-px rectangle carrying a connector endpoint (a box, or a 0×0 free point).
 *  Structurally identical to the engine's EdgeRect; kept as its own copy so
 *  @lolly-tools/core carries no dependency on @lolly/engine. */
export interface ConnectorRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Field names + per-field defaults an edge is read through, plus the wrapping `<svg>`
 *  size. Mirrors the engine's ConnectorRenderOpts exactly. */
export interface ConnectorRenderOpts {
  fromField?: string;
  toField?: string;
  styleField?: string;
  arrowField?: string;
  headField?: string;
  colorField?: string;
  dashField?: string;
  widthField?: string;
  /** v1.111 - per-END head shapes (an `AuthoredPath` box's `headStart`/`headEnd`). Naming
   *  either switches a row off the `arrow` + shared-`head` edge reading onto the path one,
   *  so a bound path and a legacy edge render through one builder. */
  headStartField?: string;
  headEndField?: string;
  /** v1.111 - an AUTHORED dash pattern (array, or a space/comma-separated string). Set →
   *  the shaft is drawn as real `<line>` dash segments fitted to the route's corners, and
   *  the `dash` keyword is not read for that row. */
  dashArrayField?: string;
  /** v1.111 - opt out of the corner FIT while keeping the authored pattern (default on). */
  dashFitField?: string;
  defaultStyle?: string;
  defaultArrow?: string;
  defaultHead?: string;
  defaultColor?: string;
  defaultWidth?: number;
  width: number;
  height: number; // canvas size for the wrapping <svg> viewBox
  layerClass?: string; // class on the <svg> (default 'lolly-connectors')
}

/** A head at the tip of an authored path (v1.110) - see {@link ConnectorsAPI.pathHeadSvg}.
 *  Structurally identical to the engine's PathHeadOpts; a copy, so @lolly-tools/core
 *  carries no dependency on @lolly/engine. */
export interface PathHeadOpts {
  tipX: number;
  tipY: number;
  /** Tangent at the tip in RADIANS, pointing OUT of the path - `Math.atan2(dy, dx)` of
   *  the last segment at an end head, of the REVERSED first segment at a start head. */
  angle: number;
  /** none · open · triangle · diamond · circle · bar (anything else draws a triangle). */
  head: string;
  color: string;
  /** The path's stroke width; the head size derives from it (`max(9, width × 4)`). */
  width: number;
}

/** A dash interval in absolute distance along a path, in native px (v1.110). */
export interface DashSegment {
  start: number;
  end: number;
}

/** Scale band for the per-span corner fit (v1.110). Outside it a span keeps the
 *  authored pattern unscaled. */
export interface DashFitOpts {
  /** Most the pattern may shrink, default 0.66 (clamped into (0, 1]). */
  minScale?: number;
  /** Most the pattern may grow, default 1.5 (clamped into [1, 16]). */
  maxScale?: number;
}

/**
 * Dash entry + Illustrator-style corner fitting (v1.110) - see
 * {@link ConnectorsAPI.dashFit}. Pure + synchronous.
 */
export interface DashFitAPI {
  /**
   * Parse a user-typed dash string (`"6 4"`, `"6,4,2,4"`) into a canonical, even-length
   * array of NUMBERS, or `null` when it is not one. At most 16 numbers, each 0…1000, at
   * least one above zero; an odd-length list is doubled (the SVG rule). Numbers only, by
   * contract: never put the user's raw text on `stroke-dasharray` - serialize THIS.
   */
  parse(text: string): number[] | null;
  /**
   * One explicit dash array covering the WHOLE path, with the pattern grown/shrunk
 * slightly per span so a dash is centred on every corner (Illustrator's "align
   * dashes to corners and path ends"). `spanLengths` are the path's corner-to-corner run
   * lengths in order - include the closing span for a closed path. Even-length and
   * summing to exactly the path length, so the pattern never wraps.
   */
  cornerFitDashArray(spanLengths: number[], pattern: number[], opts?: DashFitOpts): number[];
  /**
   * The same fit as absolute `[start, end]` dash intervals along the path - for the
   * committed/export render, which draws real geometry and never `stroke-dasharray`.
   * Inked length agrees exactly with `cornerFitDashArray`'s dash entries.
   */
  dashSegments(spanLengths: number[], pattern: number[], opts?: DashFitOpts): DashSegment[];
}

/** Committed connector/line/arrow render (v1.106; path decorations + dash fit v1.110) -
 *  see {@link HostV1.connectors}. */
export interface ConnectorsAPI {
  /** Render the committed connector layer as an export-safe SVG string: every edge
   *  routed + decorated, wrapped in a canvas-sized `<svg>`. `rectById` maps a box id to
   *  its native rect; a free-point endpoint (`@x,y`) resolves without it. Pure + sync. */
  build(
    edges: Record<string, unknown>[],
    rectById: Map<string, ConnectorRect>,
    opts: ConnectorRenderOpts
  ): string;
  /**
   * An arrowhead/decoration SVG fragment for ONE path tip (v1.110): the same shapes
   * `build` draws on a connector, addressed by tip + outward tangent, so a spline, a
   * line and a connector decorate identically. Baked coordinates, no transform, no
   * `<marker>` - it drops into any `<svg>` and survives the vector walkers.
   * Optional/additive: feature-detect it.
   */
  pathHeadSvg?(opts: PathHeadOpts): string;
  /** How far to pull the shaft back off `head` at stroke `width`, so a filled head is
   *  not stabbed through by its own line (v1.110). The pair for `pathHeadSvg`. */
  pathHeadInset?(head: string, width: number): number;
  /** Manual dash entry + corner-fit dash geometry (v1.110). Optional/additive. */
  dashFit?: DashFitAPI;
  /**
   * The route a BOUND path is drawn with, from its own spline kind (v1.111). A path box
   * with an endpoint attached to another box is a connector, and connector management
   * picks its route - `line`→straight (an authored polyline of 3+ nodes→elbow),
   * `spiro`→arc, every other kind→the smooth curved S. `override` is the box's explicit
   * `route` field and wins whenever it names one of `routeStyles`; that override is what
   * makes the plan-90 edge migration lossless (six kinds cannot name thirteen routes).
   * Pure; feature-detect it.
   */
  routeStyleForKind?(kind: string, override?: string, nodeCount?: number): string;
  /** The thirteen route styles `build` understands, in menu order (v1.111) - so a pack
   *  control and the editor offer one list rather than each spelling it out. */
  routeStyles?: string[];
}
