// SPDX-License-Identifier: MPL-2.0
/**
 * DXF (AutoCAD Drawing Interchange) emitter — pure, DOM-free, platform-agnostic.
 *
 * Fourth sink on the SVG vector pipeline (alongside SVG, EMF and EPS): turns the
 * same normalized device-px IR that emf.ts / eps.ts serialize into an ASCII DXF
 * R12 (AC1009) document — the lingua franca for CAD / laser-cut / vinyl / CNC
 * software, most of which predates newer DXF flavours. The only drawing entity is
 * the POLYLINE: every fill/stroke path is flattened to line segments (cubic béziers
 * subdivided to a flatness tolerance) so a cutter's path planner sees clean vertex
 * chains. Text is outlined to paths upstream (the "always text-as-paths" rule), so
 * this writes no TEXT entities and needs no fonts.
 *
 * DXF modelspace is y-UP (like PostScript), unitless coordinates whose meaning is
 * set by the header — so the IR's top-left / y-down / device-px space is flipped and
 * scaled to the physical output size in millimetres ($INSUNITS = 4). Colour is
 * carried as an AutoCAD Color Index (ACI) nearest-match (group code 62): DXF R12 has
 * no 24-bit colour, and for a cut/engrave file the index typically drives the tool
 * operation, not an exact hue — geometry is what matters. The raster escape-hatch
 * (`image` prim) has no line-art representation and is dropped; the shell warns.
 *
 * Like emf.ts / eps.ts this is a format authority: it imports only units.ts. No DOM,
 * no Handlebars, no ajv — fully node:test-able.
 */
import { parseDimension, toInches, CSS_DPI } from './units.ts';
import type { Rgb, VectorIr, VectorPathPrim, VectorEmitOpts } from './emf.ts';

const MM_PER_INCH = 25.4;

// Compact number: up to 4 decimals, no negative zero, no exponent (DXF group-code
// values are plain decimals — a "1e-7" would break strict parsers).
function num(v: number): string {
  if (!Number.isFinite(v)) return '0.0';
  let r = Math.round(v * 1e4) / 1e4;
  if (Object.is(r, -0)) r = 0;
  return Number.isInteger(r) ? r.toFixed(1) : String(r);
}

// One DXF "group": a code line then a value line. The whole file is a flat stream
// of these pairs; structure is entirely in the codes/values, not indentation.
function g(out: string[], code: number, value: string | number): void {
  out.push(String(code), String(value));
}

// ─── ACI (AutoCAD Color Index) nearest-match ──────────────────────────────────
// The stable, universally-recognised low indices only: 1–6 primaries, 8/9 greys,
// and 7 (the default fg/bg colour, which renders BLACK on a light canvas) matching
// both near-black and near-white. Enough to keep distinct brand colours visually
// separable in a CAD viewer without shipping the full 256-entry palette.
const ACI: Array<{ i: number; r: number; g: number; b: number }> = [
  { i: 7, r: 0, g: 0, b: 0 },       // default (black on light bg)
  { i: 7, r: 255, g: 255, b: 255 }, // default (white index → also black on light bg)
  { i: 1, r: 255, g: 0, b: 0 },
  { i: 2, r: 255, g: 255, b: 0 },
  { i: 3, r: 0, g: 255, b: 0 },
  { i: 4, r: 0, g: 255, b: 255 },
  { i: 5, r: 0, g: 0, b: 255 },
  { i: 6, r: 255, g: 0, b: 255 },
  { i: 8, r: 128, g: 128, b: 128 },
  { i: 9, r: 192, g: 192, b: 192 },
];
function nearestAci(c: Rgb): number {
  let best = 7, bestD = Infinity;
  for (const e of ACI) {
    const dr = c.r - e.r, dg = c.g - e.g, db = c.b - e.b;
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) { bestD = d; best = e.i; }
  }
  return best;
}

// ─── Cubic-bézier flattening ───────────────────────────────────────────────────
interface Pt { x: number; y: number }

// Subdivide one cubic to line segments whose deviation from the chord is ≤ tol
// (source px). Recursive de Casteljau, depth-capped so a degenerate control net
// can't recurse forever. Appends only the interior + end points (the caller has
// already emitted p0).
function flattenCubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, tol: number, out: Pt[], depth = 0): void {
  // Flatness: max distance of the two control points from the p0→p3 chord.
  const dx = p3.x - p0.x, dy = p3.y - p0.y;
  const d1 = Math.abs((p1.x - p3.x) * dy - (p1.y - p3.y) * dx);
  const d2 = Math.abs((p2.x - p3.x) * dy - (p2.y - p3.y) * dx);
  if (depth >= 16 || (d1 + d2) * (d1 + d2) <= tol * tol * (dx * dx + dy * dy)) {
    out.push({ x: p3.x, y: p3.y });
    return;
  }
  // de Casteljau split at t = 0.5.
  const p01 = mid(p0, p1), p12 = mid(p1, p2), p23 = mid(p2, p3);
  const p012 = mid(p01, p12), p123 = mid(p12, p23), p0123 = mid(p012, p123);
  flattenCubic(p0, p01, p012, p0123, tol, out, depth + 1);
  flattenCubic(p0123, p123, p23, p3, tol, out, depth + 1);
}
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// One subpath → the ordered vertex list (device-px), béziers flattened.
function subpathVertices(segments: VectorPathPrim['subpaths'][number]['segments'], tol: number): Pt[] {
  const pts: Pt[] = [];
  let cur: Pt = { x: 0, y: 0 };
  for (const s of segments) {
    if (s.op === 'M') { cur = { x: s.x, y: s.y }; pts.push(cur); }
    else if (s.op === 'L') { cur = { x: s.x, y: s.y }; pts.push(cur); }
    else if (s.op === 'C') {
      flattenCubic(cur, { x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }, { x: s.x, y: s.y }, tol, pts);
      cur = { x: s.x, y: s.y };
    }
  }
  return pts;
}

/**
 * Serialize an IR to DXF text.
 * @param ir   { width, height, prims }
 * @param opts { width, height, unit, dpi } — physical output size (millimetres in DXF)
 *
 * Returns { text, droppedImages } — droppedImages counts raster escape-hatch prims
 * that DXF can't carry, so the shell can warn rather than silently lose an effect.
 */
export function emitDxf(ir: VectorIr, opts: VectorEmitOpts = {}): { text: string; droppedImages: number } {
  const Wpx = Math.max(1, Math.round(ir.width));
  const Hpx = Math.max(1, Math.round(ir.height));
  // Physical size → mm; fall back to px at the CSS 96-DPI convention (matches EMF/EPS).
  const wDim = parseDimension(opts.width, opts.unit || 'px');
  const hDim = parseDimension(opts.height, opts.unit || 'px');
  const Wmm = (wDim ? toInches(wDim) : Wpx / CSS_DPI) * MM_PER_INCH;
  const Hmm = (hDim ? toInches(hDim) : Hpx / CSS_DPI) * MM_PER_INCH;
  const sx = Wmm / Wpx, sy = Hmm / Hpx;
  // Map a device-px point to modelspace mm, flipping y (device y-down → model y-up).
  const MX = (x: number): number => x * sx;
  const MY = (y: number): number => Hmm - y * sy;
  // Flatness tolerance in source px (≈0.2 px ⇒ sub-0.1 mm on a typical export).
  const tol = 0.2;

  const ent: string[] = [];
  let droppedImages = 0;
  for (const prim of ir.prims || []) {
    if (!prim) continue;
    if (prim.type === 'image') { droppedImages++; continue; }
    if (prim.type !== 'path' || !prim.subpaths?.length) continue;
    const paint = prim.fill ?? prim.stroke;
    const aci = paint ? nearestAci(paint) : 7;
    for (const sub of prim.subpaths) {
      const pts = subpathVertices(sub.segments, tol);
      if (pts.length < 2) continue;
      g(ent, 0, 'POLYLINE');
      g(ent, 8, '0');            // layer
      g(ent, 62, aci);           // colour (ACI)
      g(ent, 66, 1);             // vertices-follow (required for R12 POLYLINE)
      g(ent, 70, sub.closed ? 1 : 0); // 1 = closed polyline
      for (const p of pts) {
        g(ent, 0, 'VERTEX');
        g(ent, 8, '0');
        g(ent, 10, num(MX(p.x)));
        g(ent, 20, num(MY(p.y)));
        g(ent, 30, '0.0');
      }
      g(ent, 0, 'SEQEND');
    }
  }

  const out: string[] = [];
  // HEADER — version + drawing units + extents (min/max of the whole model box).
  g(out, 0, 'SECTION');
  g(out, 2, 'HEADER');
  g(out, 9, '$ACADVER'); g(out, 1, 'AC1009');
  g(out, 9, '$INSUNITS'); g(out, 70, 4);   // 4 = millimetres
  g(out, 9, '$EXTMIN'); g(out, 10, '0.0'); g(out, 20, '0.0'); g(out, 30, '0.0');
  g(out, 9, '$EXTMAX'); g(out, 10, num(Wmm)); g(out, 20, num(Hmm)); g(out, 30, '0.0');
  g(out, 0, 'ENDSEC');
  // TABLES — one LAYER ("0"), the minimum a strict reader expects.
  g(out, 0, 'SECTION');
  g(out, 2, 'TABLES');
  g(out, 0, 'TABLE'); g(out, 2, 'LAYER'); g(out, 70, 1);
  g(out, 0, 'LAYER'); g(out, 2, '0'); g(out, 70, 0); g(out, 62, 7); g(out, 6, 'CONTINUOUS');
  g(out, 0, 'ENDTAB');
  g(out, 0, 'ENDSEC');
  // ENTITIES.
  g(out, 0, 'SECTION');
  g(out, 2, 'ENTITIES');
  for (const line of ent) out.push(line);
  g(out, 0, 'ENDSEC');
  g(out, 0, 'EOF');

  return { text: out.join('\n') + '\n', droppedImages };
}
