// SPDX-License-Identifier: MPL-2.0
/**
 * EMF (Enhanced Metafile) emitter — pure, DOM-free, platform-agnostic.
 *
 * Turns a normalized vector IR into a classic-GDI EMF `Uint8Array` whose only
 * drawing primitive is the path (filled / stroked). Text is expected to be
 * outlined to paths upstream (the "always text-as-paths" rule — see
 * plans/emf-support.md), so this writes NO text or font records.
 *
 * This is the format authority, the same way units.js owns dimension math and
 * color.js owns colour math. It imports only units.js. No Handlebars, no ajv,
 * no DOM — fully node:test-able.
 *
 * Scope (v1): solid-fill / solid-stroke cubic-or-line paths, device RGB only
 * (EMF has no ICC/CMYK channel). Gradients/images/alpha are resolved to solids
 * by the IR producer before they reach here.
 *
 * IR shape (see shells/web/src/bridge/svg-ir.js):
 *   ir = { width, height, prims: Prim[] }            // width/height = logical px canvas
 *   Prim = { type:'path', subpaths, fill, stroke, fillRule }
 *     subpaths : Array<{ segments: Segment[], closed: boolean }>   // device-px coords
 *     fill     : {r,g,b} | null        // 0–255, opaque
 *     stroke   : {r,g,b, width} | null // width in device px
 *     fillRule : 'nonzero' | 'evenodd'
 *   Segment = {op:'M',x,y} | {op:'L',x,y} | {op:'C',x1,y1,x2,y2,x,y}
 *
 * opts = { width, height, unit, dpi } — the PHYSICAL output size (carried by the
 * header's rclFrame). Absent ⇒ the px canvas at the CSS 96-DPI convention.
 */

import { parseDimension, toInches, CSS_DPI } from './units.js';

// ─── EMF record type constants (iType) ────────────────────────────────────────
const EMR_HEADER             = 0x01;
const EMR_POLYBEZIERTO       = 0x05;
const EMR_POLYLINETO         = 0x06;
const EMR_EOF                = 0x0E;
const EMR_SETPOLYFILLMODE    = 0x13;
const EMR_MOVETOEX           = 0x1B;
const EMR_SELECTOBJECT       = 0x25;
const EMR_CREATEBRUSHINDIRECT = 0x27;
const EMR_DELETEOBJECT       = 0x28;
const EMR_BEGINPATH          = 0x3B;
const EMR_ENDPATH            = 0x3C;
const EMR_CLOSEFIGURE        = 0x3D;
const EMR_FILLPATH           = 0x3E;
const EMR_STROKEANDFILLPATH  = 0x3F;
const EMR_STROKEPATH         = 0x40;
const EMR_EXTCREATEPEN       = 0x5F;

// Polygon-fill modes
const ALTERNATE = 1;   // SVG evenodd
const WINDING   = 2;   // SVG nonzero (default)

// Stock object handles (high bit set). NULL_* = "draw nothing for this aspect".
const NULL_BRUSH = 0x80000005;
const NULL_PEN   = 0x80000008;

// Brush/pen styles
const BS_SOLID        = 0;
const PS_GEOMETRIC_SOLID = 0x00010000; // PS_GEOMETRIC | PS_SOLID

const ENHMETA_SIGNATURE = 0x464D4520;  // ' EMF'
const HEADER_SIZE = 88;

// Handle slots — reused (delete-and-recreate) so the table stays tiny.
const H_BRUSH = 1;
const H_PEN   = 2;
const N_HANDLES = 3;                    // slot 0 reserved + brush + pen

const colorRef = ({ r, g, b }) =>
  ((r & 0xff) | ((g & 0xff) << 8) | ((b & 0xff) << 16)) >>> 0;

const clampInt = (v) => Math.round(v);

/** Build one fixed-size little-endian record. All bodies here are 4-aligned. */
function record(iType, bodyLen, writeBody) {
  const size = 8 + bodyLen;
  const buf = new ArrayBuffer(size);
  const dv = new DataView(buf);
  dv.setUint32(0, iType, true);
  dv.setUint32(4, size, true);
  if (writeBody) writeBody(dv, 8);
  return new Uint8Array(buf);
}

const setRect = (dv, off, b) => {
  dv.setInt32(off,      clampInt(b.left),   true);
  dv.setInt32(off + 4,  clampInt(b.top),    true);
  dv.setInt32(off + 8,  clampInt(b.right),  true);
  dv.setInt32(off + 12, clampInt(b.bottom), true);
};

// Bounding box of a set of {x,y} points (already in device px).
function bboxOf(points) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const p of points) {
    if (p.x < left) left = p.x;
    if (p.y < top) top = p.y;
    if (p.x > right) right = p.x;
    if (p.y > bottom) bottom = p.y;
  }
  if (left === Infinity) return { left: 0, top: 0, right: 0, bottom: 0 };
  return { left, top, right, bottom };
}

// ─── Path records ─────────────────────────────────────────────────────────────

function recMoveTo(x, y) {
  return record(EMR_MOVETOEX, 8, (dv, o) => {
    dv.setInt32(o, clampInt(x), true);
    dv.setInt32(o + 4, clampInt(y), true);
  });
}

// EMR_POLYBEZIERTO / EMR_POLYLINETO (32-bit): rclBounds(16) + cptl(4) + aptl[]
function recPoly(iType, pts, anchor) {
  const n = pts.length;
  const bodyLen = 16 + 4 + 8 * n;
  return record(iType, bodyLen, (dv, o) => {
    // Bounds MUST include the current position (anchor) or bounds-culling readers
    // clip the first segment.
    setRect(dv, o, bboxOf(anchor ? [anchor, ...pts] : pts));
    dv.setUint32(o + 16, n, true);
    let p = o + 20;
    for (const pt of pts) {
      dv.setInt32(p, clampInt(pt.x), true);
      dv.setInt32(p + 4, clampInt(pt.y), true);
      p += 8;
    }
  });
}

const recBeginPath  = () => record(EMR_BEGINPATH, 0);
const recEndPath    = () => record(EMR_ENDPATH, 0);
const recCloseFigure = () => record(EMR_CLOSEFIGURE, 0);

const recSetPolyFillMode = (mode) =>
  record(EMR_SETPOLYFILLMODE, 4, (dv, o) => dv.setUint32(o, mode, true));

const recSelectObject = (handle) =>
  record(EMR_SELECTOBJECT, 4, (dv, o) => dv.setUint32(o, handle >>> 0, true));

const recDeleteObject = (handle) =>
  record(EMR_DELETEOBJECT, 4, (dv, o) => dv.setUint32(o, handle >>> 0, true));

// EMR_CREATEBRUSHINDIRECT: ihBrush + LogBrushEx{ lbStyle, lbColor, lbHatch }
const recCreateBrush = (handle, color) =>
  record(EMR_CREATEBRUSHINDIRECT, 16, (dv, o) => {
    dv.setUint32(o, handle, true);
    dv.setUint32(o + 4, BS_SOLID, true);
    dv.setUint32(o + 8, colorRef(color), true);
    dv.setUint32(o + 12, 0, true);        // lbHatch
  });

// EMR_EXTCREATEPEN: ihPen, offBmi, cbBmi, offBits, cbBits, ExtLogPen{...}
const recExtCreatePen = (handle, color, width) =>
  record(EMR_EXTCREATEPEN, 44, (dv, o) => {
    dv.setUint32(o, handle, true);        // ihPen
    dv.setUint32(o + 4, 0, true);         // offBmi
    dv.setUint32(o + 8, 0, true);         // cbBmi
    dv.setUint32(o + 12, 0, true);        // offBits
    dv.setUint32(o + 16, 0, true);        // cbBits
    // ExtLogPen
    dv.setUint32(o + 20, PS_GEOMETRIC_SOLID, true);     // elpPenStyle
    dv.setUint32(o + 24, Math.max(1, clampInt(width)), true); // elpWidth (logical units)
    dv.setUint32(o + 28, BS_SOLID, true);               // elpBrushStyle
    dv.setUint32(o + 32, colorRef(color), true);        // elpColor
    dv.setUint32(o + 36, 0, true);                      // elpHatch
    dv.setUint32(o + 40, 0, true);                      // elpNumStyleEntries
  });

const recPaint = (iType, bbox) =>
  record(iType, 16, (dv, o) => setRect(dv, o, bbox));

const recEof = () =>
  record(EMR_EOF, 12, (dv, o) => {
    dv.setUint32(o, 0, true);             // nPalEntries
    dv.setUint32(o + 4, 0x10, true);      // offPalEntries
    dv.setUint32(o + 8, 20, true);        // nSizeLast (== this record's Size)
  });

// ─── Path prim → records ──────────────────────────────────────────────────────

function emitPathPrim(prim, out) {
  const { subpaths, fill, stroke, fillRule } = prim;
  if (!subpaths?.length) return;

  // Collect device-space points for the prim bbox (paint records).
  const allPts = [];

  out.push(recSetPolyFillMode(fillRule === 'evenodd' ? ALTERNATE : WINDING));

  if (fill) { out.push(recCreateBrush(H_BRUSH, fill)); out.push(recSelectObject(H_BRUSH)); }
  else out.push(recSelectObject(NULL_BRUSH));

  if (stroke) { out.push(recExtCreatePen(H_PEN, stroke, stroke.width)); out.push(recSelectObject(H_PEN)); }
  else out.push(recSelectObject(NULL_PEN));

  out.push(recBeginPath());

  for (const sub of subpaths) {
    const segs = sub.segments;
    if (!segs.length || segs[0].op !== 'M') continue;
    let anchor = { x: segs[0].x, y: segs[0].y };
    out.push(recMoveTo(anchor.x, anchor.y));
    allPts.push(anchor);

    // Coalesce consecutive L into one POLYLINETO, consecutive C into one
    // POLYBEZIERTO (3 control/end points per curve).
    let i = 1;
    while (i < segs.length) {
      const op = segs[i].op;
      if (op === 'L') {
        const pts = [];
        while (i < segs.length && segs[i].op === 'L') { pts.push({ x: segs[i].x, y: segs[i].y }); i++; }
        out.push(recPoly(EMR_POLYLINETO, pts, anchor));
        allPts.push(...pts);
        anchor = pts[pts.length - 1];
      } else if (op === 'C') {
        const pts = [];
        while (i < segs.length && segs[i].op === 'C') {
          const s = segs[i];
          pts.push({ x: s.x1, y: s.y1 }, { x: s.x2, y: s.y2 }, { x: s.x, y: s.y });
          i++;
        }
        out.push(recPoly(EMR_POLYBEZIERTO, pts, anchor));
        allPts.push(...pts);
        anchor = pts[pts.length - 1];
      } else {
        i++; // unknown op — skip defensively
      }
    }
    if (sub.closed) out.push(recCloseFigure());
  }

  out.push(recEndPath());

  const bbox = bboxOf(allPts);
  const paint = fill && stroke ? EMR_STROKEANDFILLPATH : fill ? EMR_FILLPATH : EMR_STROKEPATH;
  out.push(recPaint(paint, bbox));

  // Free the slots so the next prim's CREATE into the same index is clean.
  if (fill)   { out.push(recSelectObject(NULL_BRUSH)); out.push(recDeleteObject(H_BRUSH)); }
  if (stroke) { out.push(recSelectObject(NULL_PEN));   out.push(recDeleteObject(H_PEN)); }
}

// ─── Header ───────────────────────────────────────────────────────────────────

function headerMath(ir, opts) {
  const Wpx = Math.max(1, Math.round(ir.width));
  const Hpx = Math.max(1, Math.round(ir.height));

  // Physical size → rclFrame (.01 mm) + szlMillimeters. Fall back to px @ 96 DPI.
  const wDim = parseDimension(opts.width, opts.unit || 'px');
  const hDim = parseDimension(opts.height, opts.unit || 'px');
  const dpi = opts.dpi > 0 ? opts.dpi : CSS_DPI;
  const wIn = wDim ? toInches(wDim) : Wpx / CSS_DPI;
  const hIn = hDim ? toInches(hDim) : Hpx / CSS_DPI;
  void dpi; // dpi affects raster formats; EMF is resolution-free (frame carries size)

  return {
    Wpx, Hpx,
    rclFrame: { left: 0, top: 0, right: Math.round(wIn * 2540), bottom: Math.round(hIn * 2540) },
    mmW: Math.max(1, Math.round(wIn * 25.4)),
    mmH: Math.max(1, Math.round(hIn * 25.4)),
  };
}

function writeHeader(h, nBytes, nRecords) {
  const buf = new ArrayBuffer(HEADER_SIZE);
  const dv = new DataView(buf);
  dv.setUint32(0x00, EMR_HEADER, true);
  dv.setUint32(0x04, HEADER_SIZE, true);
  setRect(dv, 0x08, { left: 0, top: 0, right: h.Wpx - 1, bottom: h.Hpx - 1 }); // rclBounds (logical)
  setRect(dv, 0x18, h.rclFrame);                                              // rclFrame (.01 mm)
  dv.setUint32(0x28, ENHMETA_SIGNATURE, true);
  dv.setUint32(0x2C, 0x00010000, true);  // nVersion
  dv.setUint32(0x30, nBytes, true);      // nBytes (total file size)
  dv.setUint32(0x34, nRecords, true);    // nRecords (incl. header + EOF)
  dv.setUint16(0x38, N_HANDLES, true);   // nHandles
  dv.setUint16(0x3A, 0, true);           // sReserved
  dv.setUint32(0x3C, 0, true);           // nDescription
  dv.setUint32(0x40, 0, true);           // offDescription
  dv.setUint32(0x44, 0, true);           // nPalEntries
  dv.setInt32(0x48, h.Wpx, true);        // szlDevice.cx
  dv.setInt32(0x4C, h.Hpx, true);        // szlDevice.cy
  dv.setInt32(0x50, h.mmW, true);        // szlMillimeters.cx
  dv.setInt32(0x54, h.mmH, true);        // szlMillimeters.cy
  return new Uint8Array(buf);
}

/**
 * Serialize an IR to EMF bytes.
 * @param {object} ir   { width, height, prims }
 * @param {object} opts { width, height, unit, dpi } — physical output size
 * @returns {Uint8Array}
 */
export function emitEmf(ir, opts = {}) {
  const h = headerMath(ir, opts);
  const body = [];
  for (const prim of ir.prims || []) {
    if (prim?.type === 'path') emitPathPrim(prim, body);
    // 'image' prims are deferred to Phase 3 — the IR producer skips them.
  }
  body.push(recEof());

  const nRecords = body.length + 1;                 // + header
  const bodyBytes = body.reduce((n, r) => n + r.length, 0);
  const nBytes = HEADER_SIZE + bodyBytes;

  const out = new Uint8Array(nBytes);
  out.set(writeHeader(h, nBytes, nRecords), 0);
  let off = HEADER_SIZE;
  for (const r of body) { out.set(r, off); off += r.length; }
  return out;
}
