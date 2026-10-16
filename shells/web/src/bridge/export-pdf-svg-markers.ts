// SPDX-License-Identifier: MPL-2.0
/**
 * Markers for the PDF SVG painter (export-pdf-svg.ts). This module works out where
 * marker-start, marker-mid and marker-end go on a path, line, polyline or polygon and
 * which way each one faces. It also gives the transform and clip that place a
 * `<marker>`'s content there. The rules are SVG 2's, as Chromium draws them; the
 * painter draws the content itself.
 *
 * Vertices come from the path's own commands rather than from the cubics the shared
 * path reader produces, because an arc becomes several cubics there and a mid marker
 * belongs only at the ends of the arc. A vertex faces along the path: out of the first
 * segment at the start, into the last at the end and on the bisector of the two
 * segments that meet anywhere else. A closed subpath also bisects at its start and end,
 * where the closing segment meets the first.
 */
import { parseSvgPathArgs, svgArcToBeziers } from '@lolly/engine';
import { IDENT, len, mul, point, translate, viewBoxMatrix, viewBoxOf, type Box, type Mat, type Viewport } from './export-pdf-svg-geom.ts';

type Vec = [number, number];

/** One marker position: where it goes, which way auto faces in degrees and which marker property applies. */
export interface MarkerVertex { x: number; y: number; angle: number; kind: 'start' | 'mid' | 'end' }

/** A segment's ends, the direction it leaves its start and the direction it arrives at its end. */
interface Segment { to: Vec; out: Vec; in: Vec }
interface Subpath { start: Vec; segments: Segment[]; closed: boolean }

const ZERO: Vec = [0, 0];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
const isZero = (v: Vec): boolean => Math.abs(v[0]) < 1e-9 && Math.abs(v[1]) < 1e-9;
/** The first direction that has a length, or none. */
const firstDir = (...dirs: Vec[]): Vec => dirs.find(d => !isZero(d)) ?? ZERO;

/** Arc arguments: radii, rotation, two flags that may be written without separators and the end point. */
function arcArgs(body: string): number[] {
  const out: number[] = [];
  const num = /^[\s,]*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/;
  const flag = /^[\s,]*([01])/;
  let rest = body;
  for (;;) {
    const at = out.length % 7;
    const m = (at === 3 || at === 4 ? flag : num).exec(rest);
    if (!m) return out;
    out.push(Number(m[1]));
    rest = rest.slice(m[0].length);
  }
}

/** A path's subpaths, one segment per command, so arcs and curves keep their own vertices. */
export function pathSubpaths(d: string): Subpath[] {
  const subs: Subpath[] = [];
  let cur: Subpath | null = null;
  let c: Vec = [0, 0], start: Vec = [0, 0];
  let ctrl: Vec | null = null;          // the last control point, for S and T reflection
  let ctrlKind = '';
  const open = (p: Vec): void => { cur = { start: p, segments: [], closed: false }; subs.push(cur); start = p; };
  const seg = (to: Vec, out: Vec, inDir: Vec): void => {
    // A drawing command after Z starts a new subpath where the closed one started.
    if (!cur || cur.closed) open(start);
    cur!.segments.push({ to, out, in: inDir });
    c = to;
  };
  const line = (to: Vec): void => { const dir = sub(to, c); seg(to, dir, dir); };
  const cubic = (c1: Vec, c2: Vec, to: Vec): void => {
    seg(to, firstDir(sub(c1, c), sub(c2, c), sub(to, c)), firstDir(sub(to, c2), sub(to, c1), sub(to, c)));
  };
  for (const m of d.matchAll(/([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g)) {
    const cmd = m[1]!;
    const up = cmd.toUpperCase();
    const rel = cmd !== up;
    const a = up === 'A' ? arcArgs(m[2] ?? '') : parseSvgPathArgs(m[2] ?? '');
    const P = (x: number, y: number): Vec => (rel ? [c[0] + x, c[1] + y] : [x, y]);
    switch (up) {
      case 'M':
        for (let i = 0; i + 1 < a.length; i += 2) {
          const p = P(a[i]!, a[i + 1]!);
          if (i === 0) { open(p); c = p; } else line(p);
        }
        break;
      case 'L': for (let i = 0; i + 1 < a.length; i += 2) line(P(a[i]!, a[i + 1]!)); break;
      case 'H': for (const v of a) line([rel ? c[0] + v : v, c[1]]); break;
      case 'V': for (const v of a) line([c[0], rel ? c[1] + v : v]); break;
      case 'C':
        for (let i = 0; i + 5 < a.length; i += 6) {
          const c1 = P(a[i]!, a[i + 1]!), c2 = P(a[i + 2]!, a[i + 3]!), to = P(a[i + 4]!, a[i + 5]!);
          cubic(c1, c2, to);
          ctrl = c2;
        }
        break;
      case 'S':
        for (let i = 0; i + 3 < a.length; i += 4) {
          const c1: Vec = ctrl && (ctrlKind === 'C' || ctrlKind === 'S') ? [2 * c[0] - ctrl[0], 2 * c[1] - ctrl[1]] : c;
          const c2 = P(a[i]!, a[i + 1]!), to = P(a[i + 2]!, a[i + 3]!);
          cubic(c1, c2, to);
          ctrl = c2;
          ctrlKind = 'S';
        }
        break;
      case 'Q':
        for (let i = 0; i + 3 < a.length; i += 4) {
          const q = P(a[i]!, a[i + 1]!), to = P(a[i + 2]!, a[i + 3]!);
          seg(to, firstDir(sub(q, c), sub(to, c)), firstDir(sub(to, q), sub(to, c)));
          ctrl = q;
        }
        break;
      case 'T':
        for (let i = 0; i + 1 < a.length; i += 2) {
          const q: Vec = ctrl && (ctrlKind === 'Q' || ctrlKind === 'T') ? [2 * c[0] - ctrl[0], 2 * c[1] - ctrl[1]] : c;
          const to = P(a[i]!, a[i + 1]!);
          seg(to, firstDir(sub(q, c), sub(to, c)), firstDir(sub(to, q), sub(to, c)));
          ctrl = q;
          ctrlKind = 'T';
        }
        break;
      case 'A':
        for (let i = 0; i + 6 < a.length; i += 7) {
          const to = P(a[i + 5]!, a[i + 6]!);
          const rx = Math.abs(a[i]!), ry = Math.abs(a[i + 1]!);
          const parts = rx > 1e-6 && ry > 1e-6 ? svgArcToBeziers(c[0], c[1], rx, ry, (a[i + 2]! * Math.PI) / 180, a[i + 3] ? 1 : 0, a[i + 4] ? 1 : 0, to[0], to[1]) : [];
          if (!parts.length) { line(to); continue; }
          const first = parts[0]!, last = parts[parts.length - 1]!;
          seg(to, firstDir(sub([first[0], first[1]], c), sub([first[4], first[5]], c)),
            firstDir(sub(to, [last[2], last[3]]), sub(to, [last[0], last[1]])));
        }
        break;
      case 'Z':
        if (cur && !(cur as Subpath).closed) {
          // The closing segment counts even at zero length: its end is the end vertex.
          line(start);
          (cur as Subpath).closed = true;
        }
        c = start;
        break;
    }
    if (up === 'C' || up === 'Q') ctrlKind = up;
    else if (up !== 'S' && up !== 'T') { ctrl = null; ctrlKind = ''; }
  }
  // A lone moveto keeps its subpath: Chromium marks its one vertex.
  return subs;
}

/** The subpaths of a line, polyline or polygon. One point is a vertex with no segment. */
function pointSubpaths(pts: Vec[], closed: boolean): Subpath[] {
  if (!pts.length) return [];
  const segments: Segment[] = [];
  for (let i = 1; i < pts.length; i++) { const dir = sub(pts[i]!, pts[i - 1]!); segments.push({ to: pts[i]!, out: dir, in: dir }); }
  if (closed) { const dir = sub(pts[0]!, pts[pts.length - 1]!); segments.push({ to: pts[0]!, out: dir, in: dir }); }
  return [{ start: pts[0]!, segments, closed }];
}

const deg = (v: Vec): number => (Math.atan2(v[1], v[0]) * 180) / Math.PI;

/**
 * The bisecting angle by Chromium's rule: the incoming angle turned by half the signed
 * turn to the outgoing one, the turn taken between -180 and 180 degrees. Where a path
 * doubles back on itself the turn is -180, which is the way Chromium faces the marker.
 */
function bisect(inDir: Vec, outDir: Vec): number {
  if (isZero(inDir)) return deg(outDir);
  if (isZero(outDir)) return deg(inDir);
  const a = deg(inDir), b = deg(outDir);
  const turn = ((((b - a + 180) % 360) + 360) % 360) - 180;
  return a + turn / 2;
}

/** Where a markable shape's markers go, or null when the element takes none. */
export function markerVertices(el: Element, vp: Viewport): MarkerVertex[] | null {
  let subs: Subpath[];
  switch (el.localName) {
    case 'path': subs = pathSubpaths(el.getAttribute('d') ?? ''); break;
    case 'line':
      subs = pointSubpaths([[len(el.getAttribute('x1'), vp.w), len(el.getAttribute('y1'), vp.h)], [len(el.getAttribute('x2'), vp.w), len(el.getAttribute('y2'), vp.h)]], false);
      break;
    case 'polyline':
    case 'polygon': {
      const n = (el.getAttribute('points') ?? '').match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g)?.map(Number) ?? [];
      const pts: Vec[] = [];
      for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i]!, n[i + 1]!]);
      subs = pointSubpaths(pts, el.localName === 'polygon');
      break;
    }
    default: return null;
  }
  const out: MarkerVertex[] = [];
  subs.forEach((s, si) => {
    const segs = s.segments, n = segs.length;
    const first = si === 0, last = si === subs.length - 1;
    if (!n) {
      // One vertex: the start and the end of a path that draws nothing else, as Chromium marks the vertex.
      if (first) out.push({ x: s.start[0], y: s.start[1], angle: 0, kind: 'start' });
      if (last) out.push({ x: s.start[0], y: s.start[1], angle: 0, kind: 'end' });
      if (!first && !last) out.push({ x: s.start[0], y: s.start[1], angle: 0, kind: 'mid' });
      return;
    }
    // The nearest direction with a length that arrives at or before each segment's end,
    // and the nearest that leaves at or after each segment's start. Two passes, so a long
    // run of zero-length segments costs no more than its length.
    const into: Vec[] = new Array(n), from: Vec[] = new Array(n);
    let dir = ZERO;
    for (let j = 0; j < n; j++) { if (!isZero(segs[j]!.in)) dir = segs[j]!.in; into[j] = dir; }
    dir = ZERO;
    for (let j = n - 1; j >= 0; j--) { if (!isZero(segs[j]!.out)) dir = segs[j]!.out; from[j] = dir; }
    out.push({ x: s.start[0], y: s.start[1], angle: s.closed ? bisect(into[n - 1]!, from[0]!) : deg(from[0]!), kind: first ? 'start' : 'mid' });
    segs.forEach((g, k) => {
      const end = k === n - 1;
      const angle = !end ? bisect(into[k]!, from[k + 1]!) : s.closed ? bisect(into[k]!, from[0]!) : deg(into[k]!);
      out.push({ x: g.to[0], y: g.to[1], angle, kind: end && last ? 'end' : 'mid' });
    });
  });
  return out;
}

/** The `<marker>` a marker property points at, or null. */
export function markerRef(value: string, find: (id: string) => Element | null): Element | null {
  const ref = /url\(\s*["']?[^"')]*#([^"')]+)["']?\s*\)/.exec(value);
  const el = ref ? find(ref[1]!) : null;
  return el?.localName === 'marker' ? el : null;
}

/**
 * A marker's placement: `matrix` puts its viewport at the vertex; `viewBox` maps its
 * content into that viewport; `content` is the two together.
 */
export interface MarkerLayout { matrix: Mat; viewBox: Mat; content: Mat; clip: Box | null; vp: Viewport }

/** An orient angle in degrees: a number with an optional deg, rad, grad or turn unit. */
function fixedAngle(raw: string): number {
  const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(deg|rad|grad|turn)?\s*$/i.exec(raw);
  if (!m) return 0;
  const v = Number(m[1]);
  const unit = (m[2] ?? 'deg').toLowerCase();
  return unit === 'rad' ? (v * 180) / Math.PI : unit === 'grad' ? v * 0.9 : unit === 'turn' ? v * 360 : v;
}


/**
 * Lay a marker out at a vertex: SVG 2's translate to the vertex, rotate to the
 * orientation, scale by the stroke width (markerUnits), then shift so the reference
 * point sits on the vertex. `clipped` is whether the marker's overflow hides what
 * falls outside its viewport, which is the default.
 */
export function markerLayout(marker: Element, v: MarkerVertex, strokeWidth: number, vp: Viewport, clipped: boolean): MarkerLayout | null {
  const scale = marker.getAttribute('markerUnits') === 'userSpaceOnUse' ? 1 : strokeWidth;
  const mw = len(marker.getAttribute('markerWidth') ?? '3', vp.w), mh = len(marker.getAttribute('markerHeight') ?? '3', vp.h);
  if (!(mw > 0) || !(mh > 0) || !(scale > 0)) return null;
  const vb = viewBoxOf(marker);
  const vbm = vb ? viewBoxMatrix(vb, { x: 0, y: 0, w: mw, h: mh }, marker.getAttribute('preserveAspectRatio')) : IDENT;
  // refX and refY as Chromium reads them: a length or a percentage of the shape's own
  // viewport. Chromium does not read SVG 2's left, center and right keywords, which
  // count as 0 there, so they count as 0 here too.
  const ref = point(vbm, len(marker.getAttribute('refX'), vp.w), len(marker.getAttribute('refY'), vp.h));
  const orient = (marker.getAttribute('orient') ?? '0').trim();
  const angle = orient === 'auto' ? v.angle
    : orient === 'auto-start-reverse' ? (v.kind === 'start' ? v.angle + 180 : v.angle)
    : fixedAngle(orient);
  const r = (angle * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
  let matrix = mul(translate(v.x, v.y), { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 });
  matrix = mul(matrix, { a: scale, b: 0, c: 0, d: scale, e: 0, f: 0 });
  matrix = mul(matrix, translate(-ref[0], -ref[1]));
  return { matrix, viewBox: vbm, content: mul(matrix, vbm), clip: clipped ? { x: 0, y: 0, w: mw, h: mh } : null, vp: vb ? { w: vb.w, h: vb.h } : { w: mw, h: mh } };
}

/** How far a marker's clipped viewport reaches from its vertex, in the shape's user units. */
export function markerReach(marker: Element, strokeWidth: number, vp: Viewport): number {
  const lay = markerLayout(marker, { x: 0, y: 0, angle: 0, kind: 'mid' }, strokeWidth, vp, true);
  if (!lay?.clip) return 0;
  const { w, h } = lay.clip;
  return Math.max(...[[0, 0], [w, 0], [0, h], [w, h]].map(([x, y]) => { const p = point(lay.matrix, x!, y!); return Math.hypot(p[0], p[1]); }));
}
