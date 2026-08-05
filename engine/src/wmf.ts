// SPDX-License-Identifier: MPL-2.0
/**
 * WMF (Windows Metafile, 16-bit) emitter — pure, DOM-free, platform-agnostic.
 *
 * The old-world sibling of emf.ts: same normalized vector IR in, a classic
 * Windows 3.x metafile out. This writes the PLACEABLE variant (the 22-byte Aldus
 * header with the 0x9AC6CDD7 key, so importers know the bounding rect + inch
 * scale) followed by the standard METAHEADER and a stream of 16-bit records.
 *
 * Where emf.ts owns 32-bit GDI paths, this owns the 16-bit record dialect. It is
 * the format authority — it imports only units.ts (+ shared IR types from emf.ts)
 * and touches no Handlebars, ajv, or DOM, so it is fully node:test-able.
 *
 * Scope (v1): solid-fill / solid-stroke paths, device RGB only. WMF has NO bezier
 * record and NO path-bracket (BeginPath/EndPath), so every cubic is flattened to a
 * polyline (the DXF strategy) and each subpath becomes a Polygon (filled+outlined,
 * auto-closed) or a Polyline (outline only). Gradients/images/alpha are resolved
 * to solids by the IR producer before they reach here; raster `image` prims are
 * dropped (WMF's DIB blits are out of scope for a first cut — see the note by the
 * prim loop). Text is expected to be outlined to paths upstream, so this writes NO
 * text or font records; outlining text to WMF Polygons is a follow-up.
 *
 * All multi-byte fields are little-endian. Every record is WORD-aligned by
 * construction (the metafile unit is the 16-bit WORD).
 *
 * opts = { width, height, unit, dpi } — the PHYSICAL output size, carried by the
 * placeable header's bounding rect + `inch` scale. Absent ⇒ the px canvas at the
 * CSS 96-DPI convention. `attribution` is honoured as documented on VectorEmitOpts
 * but is effectively a no-op here: WMF has no comment/generator record, so there is
 * nothing to add or strip either way.
 */

import { parseDimension, toInches, CSS_DPI } from './units.ts';
import type {
  Rgb,
  VectorIr,
  VectorEmitOpts,
  VectorPathPrim,
} from './emf.ts';
import type { PathSegment } from './svg-path.ts';

// ─── WMF record function codes (RecordType enumeration, MS-WMF §2.1.1.1) ───────
const META_EOF                = 0x0000;
const META_SETPOLYFILLMODE    = 0x0106;
const META_SETWINDOWORG       = 0x020b;
const META_SETWINDOWEXT       = 0x020c;
const META_POLYGON            = 0x0324;
const META_POLYLINE           = 0x0325;
const META_SELECTOBJECT       = 0x012d;
const META_DELETEOBJECT       = 0x01f0;
const META_CREATEPENINDIRECT  = 0x02fa;
const META_CREATEBRUSHINDIRECT = 0x02fc;

// Polygon-fill modes (same 1/2 meaning as GDI): ALTERNATE = SVG evenodd.
const ALTERNATE = 1;
const WINDING   = 2;

// Pen styles
const PS_SOLID = 0;
const PS_NULL  = 5;   // "draw no outline"
// Brush styles
const BS_SOLID  = 0;
const BS_HOLLOW = 1;  // "fill nothing" (a.k.a. BS_NULL)

// Placeable header + metafile-header constants.
const PLACEABLE_KEY   = 0x9ac6cdd7;
const METAFILE_MEMORY = 1;       // mtType: 1 = in-memory metafile
const MHDR_WORDS      = 9;        // METAHEADER is 9 WORDs (18 bytes)
const MHDR_VERSION    = 0x0300;   // Windows 3.0

// int16 clamp so a large canvas can't overflow a coordinate/point-count field.
const INT16_MIN = -32768;
const INT16_MAX = 32767;
const clampI16 = (v: number): number => {
  const r = Math.round(v);
  return r < INT16_MIN ? INT16_MIN : r > INT16_MAX ? INT16_MAX : r;
};
// Polygon/Polyline count is a signed 16-bit — cap points defensively (hostile IR
// with millions of segments in one subpath must not emit an invalid record).
const MAX_POLY_POINTS = INT16_MAX;

interface Pt { x: number; y: number }

// COLORREF 0x00BBGGRR split into its two little-endian WORDs.
const colorWords = ({ r, g, b }: Rgb): [number, number] => [
  ((r & 0xff) | ((g & 0xff) << 8)) & 0xffff,
  (b & 0xff) & 0xffff,
];

/**
 * Build one WMF record: [RecordSize u32 (in WORDs)][Function u16][params…].
 * `params` are 16-bit words (signed or unsigned — masked to 16 bits on write, so
 * negative coordinates and 0xNNNN colour halves both serialise correctly).
 */
function rec(func: number, params: number[]): Uint8Array {
  const sizeWords = 3 + params.length; // 2 (size u32) + 1 (func u16) + params
  const buf = new ArrayBuffer(sizeWords * 2);
  const dv = new DataView(buf);
  dv.setUint32(0, sizeWords, true);
  dv.setUint16(4, func & 0xffff, true);
  let o = 6;
  for (const w of params) {
    dv.setUint16(o, w & 0xffff, true);
    o += 2;
  }
  return new Uint8Array(buf);
}

// ─── Records ───────────────────────────────────────────────────────────────────
// SetWindowOrg/Ext store the Y field before X (MS-WMF §2.3.5.30 / §2.3.5.29).
const recSetWindowOrg = (x: number, y: number): Uint8Array =>
  rec(META_SETWINDOWORG, [clampI16(y), clampI16(x)]);
const recSetWindowExt = (w: number, h: number): Uint8Array =>
  rec(META_SETWINDOWEXT, [clampI16(h), clampI16(w)]);

const recSetPolyFillMode = (mode: number): Uint8Array =>
  rec(META_SETPOLYFILLMODE, [mode]);

// Pen object: Style, Width (a PointS: x = width, y unused), ColorRef.
const recCreatePen = (style: number, width: number, color: Rgb): Uint8Array =>
  rec(META_CREATEPENINDIRECT, [style, clampI16(Math.max(1, width)), 0, ...colorWords(color)]);

// Brush object: Style, ColorRef, Hatch.
const recCreateBrush = (style: number, color: Rgb): Uint8Array =>
  rec(META_CREATEBRUSHINDIRECT, [style, ...colorWords(color), 0]);

const recSelectObject = (idx: number): Uint8Array => rec(META_SELECTOBJECT, [idx]);
const recDeleteObject = (idx: number): Uint8Array => rec(META_DELETEOBJECT, [idx]);

// Polygon (0x0324) / Polyline (0x0325): NumberOfPoints, then aPoints[] {x,y}.
function recPoly(func: number, pts: Pt[]): Uint8Array {
  const n = Math.min(pts.length, MAX_POLY_POINTS);
  const params: number[] = [n];
  for (let i = 0; i < n; i++) { params.push(clampI16(pts[i]!.x), clampI16(pts[i]!.y)); }
  return rec(func, params);
}

const recEof = (): Uint8Array => rec(META_EOF, []);

// ─── Cubic-bézier flattening (same recursive de Casteljau as dxf.ts) ───────────
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// Subdivide one cubic to line segments whose deviation from the chord is ≤ tol
// (source px), depth-capped so a degenerate control net can't recurse forever.
// Appends the interior + end points (the caller has already emitted p0).
function flattenCubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, tol: number, out: Pt[], depth = 0): void {
  const dx = p3.x - p0.x, dy = p3.y - p0.y;
  const d1 = Math.abs((p1.x - p3.x) * dy - (p1.y - p3.y) * dx);
  const d2 = Math.abs((p2.x - p3.x) * dy - (p2.y - p3.y) * dx);
  if (depth >= 16 || (d1 + d2) * (d1 + d2) <= tol * tol * (dx * dx + dy * dy)) {
    out.push({ x: p3.x, y: p3.y });
    return;
  }
  const p01 = mid(p0, p1), p12 = mid(p1, p2), p23 = mid(p2, p3);
  const p012 = mid(p01, p12), p123 = mid(p12, p23), p0123 = mid(p012, p123);
  flattenCubic(p0, p01, p012, p0123, tol, out, depth + 1);
  flattenCubic(p0123, p123, p23, p3, tol, out, depth + 1);
}

// One subpath → ordered vertex list (device-px), béziers flattened to lines.
function subpathVertices(segments: PathSegment[], tol: number): Pt[] {
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

// ─── Path prim → records ────────────────────────────────────────────────────────
// WMF has an IMPLICIT object table: a Create* record drops its object into the
// lowest free slot. We create brush (→ slot 0) then pen (→ slot 1), select both,
// draw, then delete both — so the table is empty between prims and the indices
// stay predictable (brush 0, pen 1). Max concurrent objects is therefore 2.
const OBJ_BRUSH = 0;
const OBJ_PEN   = 1;
// Stock-object handles for META_SELECTOBJECT: bit 15 (0x8000) flags a GDI stock
// object, the low bits its id (NULL_BRUSH = 5, NULL_PEN = 8). Selecting these
// DESELECTS our slot-0 brush / slot-1 pen before we delete them — GDI's DeleteObject
// is a no-op on a still-selected object, so without this each prim leaks a pen + a
// brush handle during PlayMetaFile and a complex file (thousands of prims) exhausts
// the process GDI handle limit and renders incompletely. The EMF sibling does the
// same with NULL_BRUSH/NULL_PEN (engine/src/emf.ts).
const STOCK_NULL_BRUSH = 0x8000 | 0x0005;
const STOCK_NULL_PEN   = 0x8000 | 0x0008;

function emitPathPrim(prim: VectorPathPrim, out: Uint8Array[], tol: number): void {
  const { subpaths, fill, stroke, fillRule } = prim;
  if (!subpaths?.length) return;

  out.push(recSetPolyFillMode(fillRule === 'evenodd' ? ALTERNATE : WINDING));

  // Brush → slot 0. A NULL/hollow brush is what makes a stroke-only Polygon not
  // flood-fill with the default WHITE_BRUSH.
  out.push(fill ? recCreateBrush(BS_SOLID, fill) : recCreateBrush(BS_HOLLOW, { r: 0, g: 0, b: 0 }));
  out.push(recSelectObject(OBJ_BRUSH));

  // Pen → slot 1. PS_NULL when there is no stroke.
  out.push(stroke ? recCreatePen(PS_SOLID, stroke.width, stroke) : recCreatePen(PS_NULL, 1, { r: 0, g: 0, b: 0 }));
  out.push(recSelectObject(OBJ_PEN));

  for (const sub of subpaths) {
    const first = sub.segments[0];
    if (!first || first.op !== 'M') continue;
    const pts = subpathVertices(sub.segments, tol);
    if (pts.length < 2) continue;
    // Polygon fills (brush) AND outlines (pen), auto-closing; use it whenever the
    // shape is filled or explicitly closed. A stroke-only OPEN subpath is a
    // Polyline so its ends don't join.
    if (fill || sub.closed) out.push(recPoly(META_POLYGON, pts));
    else out.push(recPoly(META_POLYLINE, pts));
  }

  // Deselect (→ stock objects) before deleting, so GDI actually frees the handles
  // rather than leaking one pen + one brush per prim. Then the slots are free and the
  // next prim's Create* lands back in slot 0/1, keeping the table at 2 objects.
  out.push(recSelectObject(STOCK_NULL_PEN));
  out.push(recSelectObject(STOCK_NULL_BRUSH));
  out.push(recDeleteObject(OBJ_PEN));
  out.push(recDeleteObject(OBJ_BRUSH));
}

// ─── Placeable + metafile header ────────────────────────────────────────────────

interface HeaderMath {
  Wpx: number;
  Hpx: number;
  inch: number; // metafile units per inch (drives physical scale)
}

function headerMath(ir: VectorIr, opts: VectorEmitOpts): HeaderMath {
  const Wpx = Math.max(1, Math.round(ir.width));
  const Hpx = Math.max(1, Math.round(ir.height));

  // Physical width → `inch` (units-per-inch) so that Wpx / inch = physical inches.
  // Fall back to the CSS 96-DPI convention when no physical size is given. Square
  // pixels ⇒ Hpx / inch = physical height as well.
  const wDim = parseDimension(opts.width, opts.unit || 'px');
  const wIn = wDim ? toInches(wDim) : Wpx / CSS_DPI;
  const inch = wIn > 0 ? Math.max(1, Math.round(Wpx / wIn)) : CSS_DPI;

  return { Wpx, Hpx, inch };
}

// 22-byte Aldus placeable header. Checksum = XOR of the ten preceding WORDs.
function writePlaceable(h: HeaderMath): Uint8Array {
  const buf = new ArrayBuffer(22);
  const dv = new DataView(buf);
  dv.setUint32(0, PLACEABLE_KEY, true);   // Key
  dv.setUint16(4, 0, true);               // HWmf (unused, 0)
  dv.setInt16(6, 0, true);                // BoundingBox.Left
  dv.setInt16(8, 0, true);                // BoundingBox.Top
  dv.setInt16(10, clampI16(h.Wpx), true); // BoundingBox.Right
  dv.setInt16(12, clampI16(h.Hpx), true); // BoundingBox.Bottom
  dv.setUint16(14, h.inch & 0xffff, true);// Inch (units per inch)
  dv.setUint32(16, 0, true);              // Reserved
  let checksum = 0;
  for (let i = 0; i < 10; i++) checksum ^= dv.getUint16(i * 2, true);
  dv.setUint16(20, checksum & 0xffff, true);
  return new Uint8Array(buf);
}

// 18-byte METAHEADER. mtSize is the WHOLE metafile in WORDs (header + records),
// EXCLUDING the placeable prefix; mtMaxRecord is the largest record in WORDs.
function writeMetaHeader(totalWords: number, maxRecordWords: number, nObjects: number): Uint8Array {
  const buf = new ArrayBuffer(18);
  const dv = new DataView(buf);
  dv.setUint16(0, METAFILE_MEMORY, true);   // mtType
  dv.setUint16(2, MHDR_WORDS, true);        // mtHeaderSize (WORDs)
  dv.setUint16(4, MHDR_VERSION, true);      // mtVersion
  dv.setUint32(6, totalWords >>> 0, true);  // mtSize (WORDs)
  dv.setUint16(10, nObjects & 0xffff, true);// mtNoObjects
  dv.setUint32(12, maxRecordWords >>> 0, true); // mtMaxRecord (WORDs)
  dv.setUint16(16, 0, true);                // mtNoParameters
  return new Uint8Array(buf);
}

/**
 * Serialize an IR to placeable-WMF bytes.
 * @param ir   { width, height, prims }
 * @param opts { width, height, unit, dpi } — physical output size
 */
export function emitWmf(ir: VectorIr, opts: VectorEmitOpts = {}): Uint8Array {
  const h = headerMath(ir, opts);
  const tol = 0.2; // flatness tolerance in source px, matching the DXF emitter

  const body: Uint8Array[] = [];
  // Map device-px straight onto logical units (default MM_TEXT: y grows down, as
  // SVG/device px do — no flip). The placeable rect + `inch` carry physical scale.
  body.push(recSetWindowOrg(0, 0));
  body.push(recSetWindowExt(h.Wpx, h.Hpx));

  let hasPath = false;
  for (const prim of ir.prims || []) {
    if (prim?.type === 'path') { emitPathPrim(prim, body, tol); hasPath = true; }
    // `image` (raster escape-hatch) prims are dropped: WMF's DIB blits are out of
    // scope for this first cut. The IR producer already vectorises everything it
    // can, so this only loses the last-resort rasterised node.
  }
  body.push(recEof());

  // mtSize / mtMaxRecord accounting (all in WORDs).
  let bodyWords = 0;
  let maxRecordWords = 0;
  for (const r of body) {
    const w = r.length / 2;
    bodyWords += w;
    if (w > maxRecordWords) maxRecordWords = w;
  }
  const totalWords = MHDR_WORDS + bodyWords;
  const nObjects = hasPath ? 2 : 1; // brush + pen live at once (≥1 for readers)

  const placeable = writePlaceable(h);
  const metaHeader = writeMetaHeader(totalWords, maxRecordWords, nObjects);

  const out = new Uint8Array(placeable.length + totalWords * 2);
  let off = 0;
  out.set(placeable, off); off += placeable.length;
  out.set(metaHeader, off); off += metaHeader.length;
  for (const r of body) { out.set(r, off); off += r.length; }
  return out;
}
