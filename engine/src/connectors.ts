// SPDX-License-Identifier: MPL-2.0
/**
 * Connector / line / arrow geometry — the ONE source (plan 90 R1).
 *
 * A *line* is a stroked path with decorations, made three ways (pen, the line tool, or
 * node-connect) and sharing one endpoint + decoration model. This module is DOM-free and
 * pure, so it drives:
 *   • the editor's live overlay preview + hit-test (`edgeWaypoints`, sampled),
 *   • the COMMITTED / exported render (`buildConnectorSvg`, real curves), and
 *   • the CLI/headless export (same call, via the host bridge primitive) —
 * which is why it lives in the engine and not the web shell: a shell-only render would
 * drop every connector from a `--export` on the command line.
 *
 * An endpoint is a box id (the line attaches + tracks it) OR the sentinel `@x,y` (a free
 * point). A point resolves to a ZERO-SIZE rect, which every routing function here already
 * handles — `edgeBorderPt` on a 0×0 rect returns the point itself — so no routing is
 * special-cased for points.
 *
 * EXPORT-SAFE, without exception: shafts are `<path>`, arrowheads are filled `<path>` or
 * plain `<line>` (never `<marker>`/`<polygon>`/transforms), dashes are real `<line>`
 * segments (never `stroke-dasharray`) in the committed output. This is what survives the
 * SVG/PDF/EMF vector walkers unchanged.
 */
import type { ConnectorsAPI } from './bridge/host-v1.ts';
import { cornerFitDashArray, dashSegments, parseDashArray } from './dash-fit.ts';

/** A point in native px. */
export interface Point { x: number; y: number }
/** A native-px rectangle {x,y,w,h} carrying a connector endpoint (a box, or a 0×0 point). */
export interface EdgeRect { x: number; y: number; w: number; h: number }
/** A rectangle reduced to centre + half-extents, for border-point math. */
export interface EdgeAnchor { cx: number; cy: number; hw: number; hh: number }

/** Round to 2dp — the connector coordinate precision, shared by preview + committed. */
const ef2 = (v: number): number => Math.round(v * 100) / 100;
/** Minimal attribute escaping for a colour baked into an SVG attribute. */
const escAttr = (s: string): string =>
  String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const numOr = (v: unknown, d: number): number => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

// ── endpoint model: a box id OR a free point (`@x,y`) ────────────────────────────
const EDGE_POINT_RE = /^@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/;

/** True when an endpoint string is a free point (`@x,y`) rather than a box id. */
export function isEdgePoint(v: unknown): boolean {
  return typeof v === 'string' && EDGE_POINT_RE.test(v);
}
/** Parse an `@x,y` endpoint into a point, or null when it is a box id / malformed. */
export function parseEdgePoint(v: unknown): Point | null {
  if (typeof v !== 'string') return null;
  const m = EDGE_POINT_RE.exec(v);
  return m ? { x: parseFloat(m[1]!), y: parseFloat(m[2]!) } : null;
}
/** Encode a free point as the `@x,y` endpoint sentinel (2dp, like the path output). */
export function formatEdgePoint(x: number, y: number): string {
  return `@${ef2(x)},${ef2(y)}`;
}
/**
 * Resolve an endpoint string to the rect the routing math uses: a free point → a zero-size
 * rect at that point; a box id → its rect from `rectById`, or null when the box is gone (a
 * dangling id renders to nothing, exactly as the committed render prunes deleted cards).
 */
export function edgeEndRect(v: string, rectById: Map<string, EdgeRect>): EdgeRect | null {
  const p = parseEdgePoint(v);
  if (p) return { x: p.x, y: p.y, w: 0, h: 0 };
  return rectById.get(v) ?? null;
}

// ── anchors + border projection ──────────────────────────────────────────────────
/** Centre + half-extents of an edge rect. */
export function edgeAnchor(r: EdgeRect): EdgeAnchor {
  return { cx: r.x + r.w / 2, cy: r.y + r.h / 2, hw: r.w / 2, hh: r.h / 2 };
}
/** The point on anchor `a`'s border along the ray toward (tx,ty). A 0×0 anchor returns
 *  its own centre — which is exactly what makes a free point endpoint work unchanged. */
export function edgeBorderPt(a: EdgeAnchor, tx: number, ty: number): Point {
  const dx = tx - a.cx, dy = ty - a.cy;
  if (dx === 0 && dy === 0) return { x: a.cx, y: a.cy };
  const sx = dx !== 0 ? a.hw / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? a.hh / Math.abs(dy) : Infinity;
  const t = Math.min(sx, sy);
  return { x: a.cx + dx * t, y: a.cy + dy * t };
}

// ── routing ──────────────────────────────────────────────────────────────────────
/**
 * The thirteen route styles `connectorRoute` understands, in menu order. Exported so a
 * shell control and a pack manifest offer the same list rather than each spelling it out.
 */
export const CONNECTOR_ROUTE_STYLES: readonly string[] = [
  'straight',
  'elbow', 'elbow-v', 'elbow-h', 'elbow-src', 'elbow-tgt',
  'curved', 'curved-v', 'curved-h',
  'arc', 'arc-wide', 'arc-flip', 'arc-flip-wide',
];
const ROUTE_SET: Record<string, 1> = Object.create(null);
for (const s of CONNECTOR_ROUTE_STYLES) ROUTE_SET[s] = 1;
/** True when `v` names one of the thirteen routes (own-property test — a bare index
 *  would accept `constructor`/`toString` off Object.prototype). */
export function isConnectorRouteStyle(v: unknown): boolean {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(ROUTE_SET, v);
}

/**
 * The route a BOUND path is drawn with, from its own spline kind (plan 96 P3).
 *
 * A bound path is a connector, and connector management picks the route — but the user
 * already said what shape they wanted when they picked a spline kind, so that is what
 * chooses it. The mapping, and why each pair goes together:
 *
 * | spline kind    | nodes | route      | why                                              |
 * |----------------|-------|------------|--------------------------------------------------|
 * | `line`         | 2     | `straight` | a two-point straight segment stays straight      |
 * | `line`         | ≥3    | `elbow`    | an authored polyline TURNS; the elbow is the routed polyline |
 * | `cubic`        | any   | `curved`   | authored bezier handles → the smooth S           |
 * | `hyperbezier`  | any   | `curved`   | the pen's default smooth kind → the smooth S     |
 * | `catmull-rom`  | any   | `curved`   | a curve through the points → the smooth S        |
 * | `bspline`      | any   | `curved`   | a curve near the points → the smooth S           |
 * | `spiro`        | any   | `arc`      | spiro's signature is one clean bow → the arc     |
 * | anything else  | any   | `straight` | an unknown kind cannot be guessed at             |
 *
 * The sub-variants (`-v` / `-h` / `-src` / `-tgt` / `-wide` / `-flip`) are NOT reachable
 * from a kind — six kinds cannot name thirteen routes — so a path box carries an explicit
 * `route` override for them. `override` wins whenever it names a real route, which is also
 * what makes the plan-90 edge migration lossless: an `elbow-src` edge keeps bending at its
 * source. An empty/unknown override falls through to the kind, i.e. "auto".
 */
export function pathRouteStyle(kind: unknown, override?: unknown, nodeCount?: number): string {
  if (isConnectorRouteStyle(override)) return String(override);
  const k = String(kind ?? '');
  if (k === 'line') return (Number(nodeCount) || 0) >= 3 ? 'elbow' : 'straight';
  if (k === 'spiro') return 'arc';
  if (k === 'cubic' || k === 'hyperbezier' || k === 'catmull-rom' || k === 'bspline') return 'curved';
  return 'straight';
}

// Arc variants — [depth × chord, side sign, px cap].
const ARC_VARIANTS: Record<string, [number, number, number]> = {
  arc: [0.22, 1, 70], 'arc-wide': [0.42, 1, 220], 'arc-flip': [0.22, -1, 70], 'arc-flip-wide': [0.42, -1, 220],
};
/** Where the perpendicular cross-over sits along the gap, per elbow style. */
const elbowFrac = (style: string): number =>
  style === 'elbow-src' ? 0.18 : style === 'elbow-tgt' ? 0.82 : 0.5;

/** The full route for an edge a→b: waypoints plus the curve metadata the committed render
 *  needs (arrowhead direction, arc control point, curved/orient flags). The canonical
 *  routing; `edgeWaypoints` samples this for the editor's polyline preview. */
export interface ConnectorRoute {
  pts: Point[];
  tux: number; tuy: number;    // unit direction INTO b, for the end arrowhead
  curved?: boolean;
  arc?: boolean; cpt?: Point;  // arc: a single quadratic bow through `cpt`
  orient?: 'v' | 'h';
}
export function connectorRoute(a: EdgeRect, b: EdgeRect, style: string): ConnectorRoute {
  const ca = edgeAnchor(a), cb = edgeAnchor(b);
  if (style === 'straight') {
    const p1 = edgeBorderPt(ca, cb.cx, cb.cy), p2 = edgeBorderPt(cb, ca.cx, ca.cy);
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
    return { pts: [p1, p2], tux: (p2.x - p1.x) / len, tuy: (p2.y - p1.y) / len };
  }
  const av = ARC_VARIANTS[style];
  if (av) {
    const pa = edgeBorderPt(ca, cb.cx, cb.cy), pb = edgeBorderPt(cb, ca.cx, ca.cy);
    const ax = pb.x - pa.x, ay = pb.y - pa.y, al = Math.hypot(ax, ay) || 1;
    const nx = -ay / al, ny = ax / al, bow = Math.min(av[2], al * av[0]) * av[1];
    const cpt = { x: (pa.x + pb.x) / 2 + nx * bow, y: (pa.y + pb.y) / 2 + ny * bow };
    const ex = pb.x - cpt.x, ey = pb.y - cpt.y, el = Math.hypot(ex, ey) || 1;
    return { pts: [pa, pb], tux: ex / el, tuy: ey / el, arc: true, cpt };
  }
  const dx = cb.cx - ca.cx, dy = cb.cy - ca.cy;
  const curved = style.slice(0, 6) === 'curved';
  const frac = elbowFrac(style);
  const useV = style === 'elbow-v' || style === 'curved-v' ? true
    : style === 'elbow-h' || style === 'curved-h' ? false
      : Math.abs(dy) >= Math.abs(dx);
  if (useV) {
    const down = dy >= 0;
    const s = { x: ca.cx, y: down ? a.y + a.h : a.y };
    const t = { x: cb.cx, y: down ? b.y : b.y + b.h };
    const cy = s.y + frac * (t.y - s.y);
    return { pts: [s, { x: s.x, y: cy }, { x: t.x, y: cy }, t], tux: 0, tuy: down ? 1 : -1, curved, orient: 'v' };
  }
  const right = dx >= 0;
  const s2 = { x: right ? a.x + a.w : a.x, y: ca.cy };
  const t2 = { x: right ? b.x : b.x + b.w, y: cb.cy };
  const cx = s2.x + frac * (t2.x - s2.x);
  return { pts: [s2, { x: cx, y: s2.y }, { x: cx, y: t2.y }, t2], tux: right ? 1 : -1, tuy: 0, curved, orient: 'h' };
}

/** Sample a quadratic bezier pa→pb (control cpt) into a polyline for hit-test + preview. */
function sampleQuad(pa: Point, cpt: Point, pb: Point, n = 14): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push({ x: u * u * pa.x + 2 * u * t * cpt.x + t * t * pb.x, y: u * u * pa.y + 2 * u * t * cpt.y + t * t * pb.y });
  }
  return out;
}

/** Ordered waypoints for the editor's preview + hit-test (arcs sampled into a polyline). */
export function edgeWaypoints(a: EdgeRect, b: EdgeRect, style: string): Point[] {
  const r = connectorRoute(a, b, style);
  if (r.arc && r.cpt) return sampleQuad(r.pts[0]!, r.cpt, r.pts[r.pts.length - 1]!);
  return r.pts;
}

/** True when one rect is fully inside the other (nested cards draw no connector). */
export function edgeNested(a: EdgeRect, b: EdgeRect): boolean {
  const inside = (o: EdgeRect, i: EdgeRect): boolean =>
    o.x <= i.x + 0.5 && i.x + i.w <= o.x + o.w + 0.5 &&
    o.y <= i.y + 0.5 && i.y + i.h <= o.y + o.h + 0.5;
  return inside(a, b) || inside(b, a);
}

// ── path builders (shared by preview + committed) ────────────────────────────────
const dist = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);
const along = (from: Point, toward: Point, d: number): Point => {
  const L = dist(from, toward) || 1;
  return { x: from.x + (toward.x - from.x) / L * d, y: from.y + (toward.y - from.y) / L * d };
};

/** SVG path `d` for a polyline through `pts` with rounded corners of radius `r`. */
export function roundedEdgePath(pts: Point[], r: number): string {
  if (pts.length < 2) return '';
  const D = (p: Point): string => `${ef2(p.x)} ${ef2(p.y)}`;
  if (pts.length === 2) return `M${D(pts[0]!)}L${D(pts[1]!)}`;
  let d = `M${D(pts[0]!)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1]!, cur = pts[i]!, next = pts[i + 1]!;
    const rr = Math.min(r, dist(prev, cur) / 2, dist(cur, next) / 2);
    d += `L${D(along(cur, prev, rr))}Q${ef2(cur.x)} ${ef2(cur.y)} ${D(along(cur, next, rr))}`;
  }
  return d + `L${D(pts[pts.length - 1]!)}`;
}

/** SVG path `d` for a smooth S-curve over the first + last of `pts`. `orient` forces the
 *  bend axis (curved-v/-h); omit for the auto (dominant-span) choice. */
export function smoothEdgePath(pts: Point[], orient?: 'v' | 'h'): string {
  if (pts.length < 3) return roundedEdgePath(pts, 0);
  const s = pts[0]!, t = pts[pts.length - 1]!;
  const vert = orient ? orient === 'v' : Math.abs(t.y - s.y) >= Math.abs(t.x - s.x);
  if (vert) {
    const my = (s.y + t.y) / 2;
    return `M${ef2(s.x)} ${ef2(s.y)}C${ef2(s.x)} ${ef2(my)} ${ef2(t.x)} ${ef2(my)} ${ef2(t.x)} ${ef2(t.y)}`;
  }
  const mx = (s.x + t.x) / 2;
  return `M${ef2(s.x)} ${ef2(s.y)}C${ef2(mx)} ${ef2(s.y)} ${ef2(mx)} ${ef2(t.y)} ${ef2(t.x)} ${ef2(t.y)}`;
}

/** A single quadratic bow s→t through control point `cpt` (arc style). */
function arcPath(s: Point, t: Point, cpt: Point): string {
  return `M${ef2(s.x)} ${ef2(s.y)}Q${ef2(cpt.x)} ${ef2(cpt.y)} ${ef2(t.x)} ${ef2(t.y)}`;
}

/** Real-segment dash/dot run between two points (NOT stroke-dasharray → export-safe). */
function dashRun(x1: number, y1: number, x2: number, y2: number, style: string, col: string, width: number): string {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 0.5) return '';
  const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const dash = style === 'dotted' ? Math.max(width, 1.4) : 9;
  const gap = style === 'dotted' ? width * 2 + 2 : 6;
  const cap = style === 'dotted' ? ' stroke-linecap="round"' : '';
  let out = '', pos = 0;
  while (pos < len) {
    const aa = pos, bb = Math.min(pos + dash, len);
    out += `<line x1="${ef2(x1 + ux * aa)}" y1="${ef2(y1 + uy * aa)}" x2="${ef2(x1 + ux * bb)}" y2="${ef2(y1 + uy * bb)}" stroke="${col}" stroke-width="${ef2(width)}"${cap}/>`;
    pos += dash + gap;
  }
  return out;
}

// ── arrowheads ───────────────────────────────────────────────────────────────────
/** A circle as 4 cubic beziers (never <circle>/<ellipse> — a path is PDF/EMF-portable). */
function circleEdgePath(cx: number, cy: number, r: number): string {
  const k = 0.5523 * r;
  return `M${ef2(cx + r)} ${ef2(cy)}` +
    `C${ef2(cx + r)} ${ef2(cy + k)} ${ef2(cx + k)} ${ef2(cy + r)} ${ef2(cx)} ${ef2(cy + r)}` +
    `C${ef2(cx - k)} ${ef2(cy + r)} ${ef2(cx - r)} ${ef2(cy + k)} ${ef2(cx - r)} ${ef2(cy)}` +
    `C${ef2(cx - r)} ${ef2(cy - k)} ${ef2(cx - k)} ${ef2(cy - r)} ${ef2(cx)} ${ef2(cy - r)}` +
    `C${ef2(cx + k)} ${ef2(cy - r)} ${ef2(cx + r)} ${ef2(cy - k)} ${ef2(cx + r)} ${ef2(cy)}Z`;
}
/** How far to pull a shaft back so it doesn't poke through a filled head (per shape). */
export function edgeHeadInset(kind: string, s: number): number {
  if (kind === 'none' || kind === 'open' || kind === 'bar') return 0;
  if (kind === 'diamond') return 2 * s;
  if (kind === 'circle') return 2 * (0.42 * s);
  return s * 0.9; // triangle
}
/**
 * An arrowhead SVG fragment at `tip` pointing along unit (ux,uy), size `s`, colour `fill`.
 * `kind`: none · open · triangle (default) · diamond · circle · bar. Coordinates are baked
 * in — no transform — so it drops straight into a connector <svg> in overlay or export.
 */
export function edgeArrowHead(tip: Point, ux: number, uy: number, s: number, fill: string, kind: string): string {
  if (kind === 'none') return '';
  const px = -uy, py = ux, hw = s * 0.52, B = { x: tip.x - ux * s, y: tip.y - uy * s };
  const col = escAttr(fill);
  if (kind === 'open') {
    const sw = Math.max(1.6, s * 0.22), a = s * 0.72;
    const e1x = tip.x - ux * a + px * a, e1y = tip.y - uy * a + py * a;
    const e2x = tip.x - ux * a - px * a, e2y = tip.y - uy * a - py * a;
    return `<line x1="${ef2(e1x)}" y1="${ef2(e1y)}" x2="${ef2(tip.x)}" y2="${ef2(tip.y)}" stroke="${col}" stroke-width="${ef2(sw)}" stroke-linecap="round"/>` +
      `<line x1="${ef2(e2x)}" y1="${ef2(e2y)}" x2="${ef2(tip.x)}" y2="${ef2(tip.y)}" stroke="${col}" stroke-width="${ef2(sw)}" stroke-linecap="round"/>`;
  }
  if (kind === 'diamond') {
    const M = { x: tip.x - ux * s, y: tip.y - uy * s }, Bk = { x: tip.x - ux * 2 * s, y: tip.y - uy * 2 * s };
    return `<path d="M${ef2(tip.x)} ${ef2(tip.y)}L${ef2(M.x + px * hw)} ${ef2(M.y + py * hw)}` +
      `L${ef2(Bk.x)} ${ef2(Bk.y)}L${ef2(M.x - px * hw)} ${ef2(M.y - py * hw)}Z" fill="${col}"/>`;
  }
  if (kind === 'circle') {
    const r = 0.42 * s, C = { x: tip.x - ux * r, y: tip.y - uy * r };
    return `<path d="${circleEdgePath(C.x, C.y, r)}" fill="${col}"/>`;
  }
  if (kind === 'bar') {
    const bw = s * 0.62, sw2 = Math.max(1.6, s * 0.22);
    return `<line x1="${ef2(tip.x + px * bw)}" y1="${ef2(tip.y + py * bw)}" x2="${ef2(tip.x - px * bw)}" y2="${ef2(tip.y - py * bw)}" stroke="${col}" stroke-width="${ef2(sw2)}"/>`;
  }
  return `<path d="M${ef2(tip.x)} ${ef2(tip.y)}L${ef2(B.x + px * hw)} ${ef2(B.y + py * hw)}` +
    `L${ef2(B.x - px * hw)} ${ef2(B.y - py * hw)}Z" fill="${col}"/>`;
}

// ── heads on an authored PATH (plan 96 P1) ───────────────────────────────────────
/**
 * How big a head is for a given stroke width — the ONE formula, so an arrowhead on a
 * hand-drawn spline is the same size as one on a routed connector of the same weight.
 */
export function pathHeadSize(width: number): number {
  return Math.max(9, clamp(numOr(width, 2.5), 0.5, 20) * 4);
}

/** A head at the tip of an authored path: tip point, OUTWARD tangent, shape, colour, weight. */
export interface PathHeadOpts {
  tipX: number; tipY: number;
  /** Tangent at the tip in RADIANS, pointing OUT of the path — i.e. `Math.atan2(dy, dx)`
   *  of the last segment at an end head, and of the REVERSED first segment at a start head. */
  angle: number;
  /** none · open · triangle · diamond · circle · bar (anything else draws a triangle). */
  head: string;
  color: string;
  /** The path's stroke width; the head size derives from it via {@link pathHeadSize}. */
  width: number;
}

/**
 * The head-for-a-tip primitive the unified path renderer calls (plan 96 P1): the SAME
 * shapes `edgeArrowHead` draws for a connector, addressed by tip + angle instead of a unit
 * vector, so a spline, a line and a connector all decorate identically in the editor, the
 * export and the CLI. Coordinates are baked in — no transform — so the fragment drops
 * straight into any `<svg>`.
 */
export function pathHeadSvg(o: PathHeadOpts): string {
  const kind = String(o?.head ?? 'none');
  if (!kind || kind === 'none') return '';
  const a = numOr(o?.angle, 0);
  return edgeArrowHead(
    { x: numOr(o?.tipX, 0), y: numOr(o?.tipY, 0) },
    Math.cos(a), Math.sin(a),
    pathHeadSize(o?.width), String(o?.color ?? '#000'), kind,
  );
}

/** How far to pull an authored path's shaft back off `head` at stroke `width`, so a filled
 *  head is not stabbed through by its own line. The `edgeHeadInset` pair for `pathHeadSvg`. */
export function pathHeadInset(head: string, width: number): number {
  const kind = String(head ?? 'none');
  return kind === 'none' ? 0 : edgeHeadInset(kind, pathHeadSize(width));
}

// ── committed render (the exported connector layer) ──────────────────────────────
/** Field names + defaults an edge is read through, mirroring the manifest `canvas.connect`
 *  block so one tool's edges render identically in the editor, the export, and the CLI.
 *
 *  The `headStartField`/`headEndField`/`dashArrayField` trio is the plan-96 PATH form: a
 *  bound `AuthoredPath` box carries a shape at each end (and, optionally, an authored dash
 *  pattern) instead of the edge model's `arrow` + one shared `head`. Naming either head
 *  field switches a row onto that reading; naming neither keeps the legacy edge reading, so
 *  the two models render through one builder and one geometry source. */
export interface ConnectorRenderOpts {
  fromField?: string; toField?: string;
  styleField?: string; arrowField?: string; headField?: string;
  colorField?: string; dashField?: string; widthField?: string;
  /** Plan 96: per-END head shapes (a path's `headStart`/`headEnd`). When either is named,
   *  `arrowField`/`headField` are not read for that row. */
  headStartField?: string; headEndField?: string;
  /** Plan 96: an AUTHORED dash pattern (an array of numbers, or a space/comma-separated
   *  string). Set → the shaft is drawn as real `<line>` dash segments fitted to the
   *  route's corners, and the `dash` keyword is not read. */
  dashArrayField?: string;
  /** Plan 96: opt out of the corner FIT while keeping the authored pattern (default on —
   *  a routed connector's corners are exactly where a half dash reads as a mistake). */
  dashFitField?: string;
  defaultStyle?: string; defaultArrow?: string; defaultHead?: string;
  defaultColor?: string; defaultWidth?: number;
  width: number; height: number;   // canvas size for the wrapping <svg> viewBox
  layerClass?: string;             // class on the <svg> (default 'lolly-connectors')
}
type Edge = Record<string, unknown>;

/**
 * One committed line's resolved decoration — the ONE record both readings reduce to before
 * any geometry happens, so an edge `{arrow:'end', head:'open'}` and a path
 * `{headStart:'none', headEnd:'open'}` are the same drawing by construction rather than by
 * two code paths agreeing.
 */
export interface ConnectorDecor {
  style: string;
  /** Head shape at each end; `'none'` draws no head AND takes no gap/inset pull-back. */
  headStart: string; headEnd: string;
  /** Keyword dash: `solid` · `dashed` · `dotted`. Ignored when `dashArray` is set. */
  dash: string;
  /** An AUTHORED pattern. Set → real `<line>` segments, corner-fitted unless `dashFit`
   *  is false. Never `stroke-dasharray`: this is the committed layer. */
  dashArray?: readonly number[] | null;
  dashFit?: boolean;
  /** Already attribute-escaped (see `escAttr`) — this is baked straight into markup. */
  color: string;
  width: number;
}

/** Sample a route into the polyline the dash walk measures, plus which vertices are real
 *  CORNERS (a dash gets centred on those). A sampled curve has none — its whole run is one
 *  span, exactly as `dashSpanLengths` treats a smooth spline in the pack hooks. */
function routePolyline(route: ConnectorRoute, pts: Point[]): { pts: Point[]; corners: boolean } {
  if (route.arc && route.cpt) return { pts: sampleQuad(pts[0]!, route.cpt, pts[pts.length - 1]!, 48), corners: false };
  if (route.curved && pts.length >= 3) {
    // The same cubic `smoothEdgePath` draws, sampled — so the dashes sit on the drawn curve
    // rather than on the polyline the curve only passes near.
    const s = pts[0]!, t = pts[pts.length - 1]!;
    const vert = route.orient ? route.orient === 'v' : Math.abs(t.y - s.y) >= Math.abs(t.x - s.x);
    const c1 = vert ? { x: s.x, y: (s.y + t.y) / 2 } : { x: (s.x + t.x) / 2, y: s.y };
    const c2 = vert ? { x: t.x, y: (s.y + t.y) / 2 } : { x: (s.x + t.x) / 2, y: t.y };
    const out: Point[] = [];
    for (let i = 0; i <= 48; i++) {
      const u = i / 48, m = 1 - u;
      out.push({
        x: m * m * m * s.x + 3 * m * m * u * c1.x + 3 * m * u * u * c2.x + u * u * u * t.x,
        y: m * m * m * s.y + 3 * m * m * u * c1.y + 3 * m * u * u * c2.y + u * u * u * t.y,
      });
    }
    return { pts: out, corners: false };
  }
  return { pts, corners: true };
}

/**
 * An AUTHORED dash pattern along a route, as real `<line>` segments (plan 96 P5).
 *
 * The keyword path (`dashRun`) synthesises its pattern from the stroke width and tiles it
 * per segment; this one takes the user's numbers and hands the span lengths to the engine's
 * own corner fit, so a dashed elbow lands a whole dash on each bend instead of whatever the
 * tiling happened to leave there. Segments are emitted in path order and clipped to the
 * polyline, so nothing is ever drawn past an end.
 */
function dashArrayRun(poly: Point[], corners: boolean, pattern: readonly number[], fit: boolean, col: string, width: number): string {
  if (poly.length < 2) return '';
  const segLen: number[] = [];
  let total = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    const L = dist(poly[i]!, poly[i + 1]!);
    segLen.push(L);
    total += L;
  }
  if (!(total > 0.5)) return '';
  // Corner fit divides the run at every vertex; without corners (or with the fit off) the
  // whole path is one span, which is the un-fitted tiling `dashSegments` falls back to.
  const spans = corners && fit ? segLen.filter((L) => L > 0) : [total];
  const runs = dashSegments(spans, pattern.slice());
  let out = '';
  for (const seg of runs) {
    // Walk the polyline once per dash — a dash may straddle several vertices.
    let acc = 0;
    for (let i = 0; i < segLen.length; i++) {
      const L = segLen[i]!;
      const a0 = Math.max(seg.start, acc), b0 = Math.min(seg.end, acc + L);
      if (b0 > a0 + 1e-6 && L > 0) {
        const p = poly[i]!, q = poly[i + 1]!;
        const t0 = (a0 - acc) / L, t1 = (b0 - acc) / L;
        out += `<line x1="${ef2(p.x + (q.x - p.x) * t0)}" y1="${ef2(p.y + (q.y - p.y) * t0)}"` +
          ` x2="${ef2(p.x + (q.x - p.x) * t1)}" y2="${ef2(p.y + (q.y - p.y) * t1)}"` +
          ` stroke="${col}" stroke-width="${ef2(width)}" stroke-linecap="butt"/>`;
      }
      acc += L;
      if (acc >= seg.end) break;
    }
  }
  return out;
}

/**
 * One committed line between two rects: shaft (real curve / rounded elbow / real-segment
 * dashes) plus head(s), with the shaft pulled back off a decorated end by a gap + the
 * head's inset. THE committed geometry — a plan-90 edge and a plan-96 bound path both
 * arrive here, so they cannot drift.
 */
export function routedLineSvg(a: EdgeRect, b: EdgeRect, decor: ConnectorDecor): string {
  const route = connectorRoute(a, b, decor.style);
  const pts = route.pts.map((p) => ({ x: p.x, y: p.y }));
  const n = pts.length;
  if (n < 2) return '';
  const col = decor.color;
  const width = clamp(numOr(decor.width, 2.5), 0.5, 20);
  const headStart = String(decor.headStart || 'none');
  const headEnd = String(decor.headEnd || 'none');
  const headSize = pathHeadSize(width);
  const gap = Math.max(8, headSize * 0.8);
  const last = { x: pts[n - 1]!.x, y: pts[n - 1]!.y }, first = { x: pts[0]!.x, y: pts[0]!.y };
  const lastNbr = pts[n - 2]!, firstNbr = pts[1]!;
  let endTip = last, startTip = first;
  if (headEnd !== 'none') {
    const ge = Math.min(gap, dist(last, lastNbr) * 0.55);
    endTip = along(last, lastNbr, ge);
    pts[n - 1] = along(last, lastNbr, Math.min(ge + edgeHeadInset(headEnd, headSize), dist(last, lastNbr) * 0.9));
  }
  if (headStart !== 'none') {
    const gs = Math.min(gap, dist(first, firstNbr) * 0.55);
    startTip = along(first, firstNbr, gs);
    pts[0] = along(first, firstNbr, Math.min(gs + edgeHeadInset(headStart, headSize), dist(first, firstNbr) * 0.9));
  }
  const dash = String(decor.dash || 'solid');
  const pattern = decor.dashArray && decor.dashArray.length ? decor.dashArray : null;
  let line = '';
  if (pattern) {
    const poly = routePolyline(route, pts);
    line = dashArrayRun(poly.pts, poly.corners, pattern, decor.dashFit !== false, col, width);
  } else if (dash === 'dashed' || dash === 'dotted') {
    for (let i = 0; i < pts.length - 1; i++) line += dashRun(pts[i]!.x, pts[i]!.y, pts[i + 1]!.x, pts[i + 1]!.y, dash, col, width);
  } else if (route.arc && route.cpt) {
    line = `<path d="${arcPath(pts[0]!, pts[pts.length - 1]!, route.cpt)}" fill="none" stroke="${col}" stroke-width="${ef2(width)}" stroke-linecap="round"/>`;
  } else if (route.curved) {
    line = `<path d="${smoothEdgePath(pts, route.orient)}" fill="none" stroke="${col}" stroke-width="${ef2(width)}" stroke-linejoin="round" stroke-linecap="round"/>`;
  } else {
    line = `<path d="${roundedEdgePath(pts, Math.min(16, width * 4 + 6))}" fill="none" stroke="${col}" stroke-width="${ef2(width)}" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  let heads = '';
  if (headEnd !== 'none') heads += edgeArrowHead(endTip, route.tux, route.tuy, headSize, col, headEnd);
  if (headStart !== 'none') {
    const seg = pts[1]!, L = dist(startTip, seg) || 1;
    heads += edgeArrowHead(startTip, (startTip.x - seg.x) / L, (startTip.y - seg.y) / L, headSize, col, headStart);
  }
  return line + heads;
}

/** An authored dash value off a row: a real array, or a space/comma-separated string run
 *  through the engine's own parse. Anything else is "no authored pattern". */
function rowDashArray(v: unknown): number[] | null {
  if (Array.isArray(v)) {
    const out = v.map((x) => numOr(x, -1));
    return out.length && out.every((x) => x >= 0) && out.some((x) => x > 0) ? out : null;
  }
  return typeof v === 'string' ? parseDashArray(v) : null;
}

/** Read one row's decoration through the caller's field names. Two readings, one record:
 *  the plan-96 PATH form when a head field is named, the plan-90 EDGE form otherwise. */
function decorFromRow(e: Edge, o: Required<Pick<ConnectorRenderOpts,
  'styleField' | 'arrowField' | 'headField' | 'colorField' | 'dashField' | 'widthField' |
  'defaultStyle' | 'defaultArrow' | 'defaultHead' | 'defaultColor' | 'defaultWidth'>>
  & Pick<ConnectorRenderOpts, 'headStartField' | 'headEndField' | 'dashArrayField' | 'dashFitField'>): ConnectorDecor {
  const style = String(e[o.styleField] ?? o.defaultStyle);
  const col = escAttr(String(e[o.colorField] ?? o.defaultColor).trim() || o.defaultColor);
  const width = clamp(numOr(e[o.widthField], o.defaultWidth), 0.5, 20);
  const dash = String(e[o.dashField] ?? 'solid');
  const dashArray = o.dashArrayField ? rowDashArray(e[o.dashArrayField]) : null;
  const dashFit = o.dashFitField ? e[o.dashFitField] !== false && String(e[o.dashFitField]) !== 'false' : true;
  if (o.headStartField || o.headEndField) {
    return {
      style, dash, dashArray, dashFit, color: col, width,
      headStart: o.headStartField ? String(e[o.headStartField] ?? 'none') : 'none',
      headEnd: o.headEndField ? String(e[o.headEndField] ?? 'none') : 'none',
    };
  }
  // Legacy edge reading: one shape plus WHERE it goes. `arrow:'end'` is a head at the end
  // and nothing at the start; `'both'` is the same shape at each; anything else is neither.
  const arrow = String(e[o.arrowField] ?? o.defaultArrow);
  const head = String(e[o.headField] ?? o.defaultHead);
  return {
    style, dash, dashArray, dashFit, color: col, width,
    headStart: arrow === 'both' ? head : 'none',
    headEnd: arrow === 'end' || arrow === 'both' ? head : 'none',
  };
}

/**
 * The committed connector layer as an SVG string: every edge routed, decorated, and
 * export-safe, wrapped in a canvas-sized `<svg>`. `rectById` maps a box id to its native
 * rect; an endpoint that is a free point (`@x,y`) resolves without it. A nested pair of
 * NODES draws nothing (a free point inside a box is a real endpoint, not an overlap).
 * This is the single call the host bridge primitive exposes, so web, export and CLI emit
 * identical geometry.
 */
export function buildConnectorSvg(edges: Edge[], rectById: Map<string, EdgeRect>, opts: ConnectorRenderOpts): string {
  const o = {
    fromField: opts.fromField ?? 'from', toField: opts.toField ?? 'to',
    styleField: opts.styleField ?? 'style', arrowField: opts.arrowField ?? 'arrow',
    headField: opts.headField ?? 'head', colorField: opts.colorField ?? 'color',
    dashField: opts.dashField ?? 'dash', widthField: opts.widthField ?? 'width',
    headStartField: opts.headStartField, headEndField: opts.headEndField,
    dashArrayField: opts.dashArrayField, dashFitField: opts.dashFitField,
    defaultStyle: opts.defaultStyle ?? 'straight', defaultArrow: opts.defaultArrow ?? 'end',
    defaultHead: opts.defaultHead ?? 'triangle', defaultColor: opts.defaultColor ?? '#94a3b8',
    defaultWidth: opts.defaultWidth ?? 2.5,
  };
  let body = '';
  for (const e of edges || []) {
    if (!e) continue;
    const fromV = String(e[o.fromField] ?? '');
    const toV = String(e[o.toField] ?? '');
    const a = edgeEndRect(fromV, rectById);
    const b = edgeEndRect(toV, rectById);
    if (!a || !b) continue;                          // dangling id → renders to nothing
    if (!isEdgePoint(fromV) && !isEdgePoint(toV) && edgeNested(a, b)) continue;
    body += routedLineSvg(a, b, decorFromRow(e, o));
  }
  const cls = opts.layerClass ?? 'lolly-connectors';
  return `<svg class="${escAttr(cls)}" width="${opts.width}" height="${opts.height}" viewBox="0 0 ${opts.width} ${opts.height}" preserveAspectRatio="none" aria-hidden="true">${body}</svg>`;
}

// ── the host.connectors factory ──────────────────────────────────────────────────
/**
 * The `host.connectors` bridge implementation (HostV1 v1.106, extended v1.110/v1.111).
 * Every shell attaches THIS (`host.connectors = makeConnectorsApi()`) instead of naming
 * the members itself, so the surface can never drift between web, CLI and Tauri — the way
 * `makeColorApi`/`makeGeomApi` already work. Pure + synchronous throughout.
 */
export function makeConnectorsApi(): ConnectorsAPI {
  return {
    build: buildConnectorSvg,
    // v1.110 — the unified path primitive's decoration + dash maths (plan 96).
    pathHeadSvg,
    pathHeadInset,
    dashFit: { parse: parseDashArray, cornerFitDashArray, dashSegments },
    // v1.111 — a BOUND path is routed by its own spline kind (plan 96 P3), and a pack hook
    // has to agree with the editor about which route that is, so the mapping is the
    // engine's rather than each surface's.
    routeStyleForKind: pathRouteStyle,
    routeStyles: CONNECTOR_ROUTE_STYLES.slice(),
  };
}
