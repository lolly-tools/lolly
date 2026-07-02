// SPDX-License-Identifier: MPL-2.0
/**
 * DeviceCMYK raster print finishing: RGB→CMYK conversion of the rasterised
 * artwork, the print marks composited straight into the CMYK byte buffer, and
 * the hand-rolled baseline TIFF encoder.
 */

import { rgbToCmyk } from '@lolly/engine';
import type { PrintGeometry, ExportMeta } from '@lolly/engine';
import type { ProgressFn } from './types.ts';
import type { ProvenanceLabels } from './print-geometry.ts';

// RGBA (0–255, sRGB) → packed CMYK bytes (0=no ink … 255=full ink), one tight
// numeric pass over the typed array. Transparency is flattened onto white (CMYK
// has no alpha channel and print stock is white). ~tens of ms for 1080², but a
// large print-DPI sheet runs long on the main thread, so the pass yields to the
// event loop every YIELD_ROWS scanlines (keeping the tab responsive) and reports
// row progress through opts.onProgress. The arithmetic is unchanged — same bytes.
const YIELD_ROWS = 256;
export async function rgbaToDeviceCmyk(rgba: Uint8ClampedArray, W: number, H: number, onProgress?: ProgressFn): Promise<Uint8Array> {
  const out = new Uint8Array(W * H * 4);
  for (let row = 0; row < H; row++) {
    const base = row * W * 4;
    for (let i = base, end = base + W * 4; i < end; i += 4) {
      const a = rgba[i + 3] ?? 0;
      let r = rgba[i] ?? 0, g = rgba[i + 1] ?? 0, b = rgba[i + 2] ?? 0;
      if (a < 255) {                                 // composite over white
        const t = a / 255, u = 255 * (1 - t);
        r = r * t + u; g = g * t + u; b = b * t + u;
      }
      const [c, m, y, k] = rgbToCmyk(r / 255, g / 255, b / 255);
      out[i]     = (c * 255 + 0.5) | 0;
      out[i + 1] = (m * 255 + 0.5) | 0;
      out[i + 2] = (y * 255 + 0.5) | 0;
      out[i + 3] = (k * 255 + 0.5) | 0;
    }
    if ((row + 1) % YIELD_ROWS === 0 && row + 1 < H) {
      onProgress?.(row + 1, H);
      await new Promise(r => setTimeout(r));         // unblock the UI thread
    }
  }
  onProgress?.(H, H);
  return out;
}

// One TIFF IFD entry, gathered before layout. Numeric entries carry `n`;
// out-of-line/inline byte entries carry `data`; `offset` is patched at layout.
interface TiffEntry {
  tag: number;
  type: number;
  count: number;
  n?: number;
  data?: Uint8Array;
  offset?: number;
}

// Assemble a baseline little-endian CMYK TIFF: 8-byte header → IFD → out-of-line
// values → one uncompressed strip. Entries are gathered, then sorted by tag (a
// TIFF requirement) with ≤4-byte values inlined and larger ones placed after the
// IFD. Mirrors buildExifTiff, scaled up to a full image + provenance + DPI.
export function encodeCmykTiff(cmyk: Uint8Array, W: number, H: number, dpi: number, meta: ExportMeta | undefined, condition: string | null): Uint8Array {
  const enc = new TextEncoder();
  const SHORT = 3, LONG = 4, RATIONAL = 5, ASCII = 2;
  const TYPE_SIZE: Record<number, number> = { 2: 1, 3: 2, 4: 4, 5: 8 };
  const entries: TiffEntry[] = [];
  const num   = (tag: number, type: number, n: number) => entries.push({ tag, type, count: 1, n });
  const asciiTag = (tag: number, s: string | undefined) => { if (s) { const a = enc.encode(String(s)); const d = new Uint8Array(a.length + 1); d.set(a, 0); entries.push({ tag, type: ASCII, count: d.length, data: d }); } };

  const bps = new Uint8Array(8); { const dv = new DataView(bps.buffer); for (let i = 0; i < 4; i++) dv.setUint16(i * 2, 8, true); }
  const rational = (n2: number, den: number) => { const d = new Uint8Array(8); const dv = new DataView(d.buffer); dv.setUint32(0, n2, true); dv.setUint32(4, den, true); return d; };
  const res = Math.max(1, Math.round(dpi || 72));

  num(256, LONG, W);                                  // ImageWidth
  num(257, LONG, H);                                  // ImageLength
  entries.push({ tag: 258, type: SHORT, count: 4, data: bps }); // BitsPerSample [8,8,8,8]
  num(259, SHORT, 1);                                 // Compression: none
  num(262, SHORT, 5);                                 // PhotometricInterpretation: Separated (CMYK)
  asciiTag(270, [meta?.description, condition].filter(Boolean).join(' · ')); // ImageDescription (+ press condition)
  num(273, LONG, 0);                                  // StripOffsets — patched after layout
  num(277, SHORT, 4);                                 // SamplesPerPixel
  num(278, LONG, H);                                  // RowsPerStrip (single strip)
  num(279, LONG, W * H * 4);                          // StripByteCounts
  entries.push({ tag: 282, type: RATIONAL, count: 1, data: rational(res, 1) }); // XResolution
  entries.push({ tag: 283, type: RATIONAL, count: 1, data: rational(res, 1) }); // YResolution
  num(296, SHORT, 2);                                 // ResolutionUnit: inch
  asciiTag(305, meta?.software);                      // Software
  asciiTag(315, meta?.author);                        // Artist
  num(332, SHORT, 1);                                 // InkSet: CMYK

  entries.sort((a, b) => a.tag - b.tag);

  const N = entries.length;
  const ifdStart = 8;
  let ext = ifdStart + 2 + N * 12 + 4;                // out-of-line region start
  for (const e of entries) {
    const bytes = e.data ? e.data.length : e.count * (TYPE_SIZE[e.type] ?? 0);
    if (bytes > 4) { e.offset = ext; ext += bytes + (bytes & 1); } // keep word alignment
  }
  const stripOffset = ext + (ext & 1);
  const stripEntry = entries.find(e => e.tag === 273);
  if (stripEntry) stripEntry.n = stripOffset;         // patch StripOffsets
  const out = new Uint8Array(stripOffset + W * H * 4);
  const dv = new DataView(out.buffer);
  out[0] = 0x49; out[1] = 0x49;                       // "II" little-endian
  dv.setUint16(2, 42, true);
  dv.setUint32(4, ifdStart, true);
  dv.setUint16(ifdStart, N, true);
  let o = ifdStart + 2;
  for (const e of entries) {
    dv.setUint16(o, e.tag, true);
    dv.setUint16(o + 2, e.type, true);
    dv.setUint32(o + 4, e.count, true);
    const bytes = e.data ? e.data.length : e.count * (TYPE_SIZE[e.type] ?? 0);
    if (bytes > 4 && e.data && e.offset !== undefined) { dv.setUint32(o + 8, e.offset, true); out.set(e.data, e.offset); }
    else if (e.data) out.set(e.data, o + 8);          // small inline value (e.g. short ASCII)
    else if (e.type === SHORT) dv.setUint16(o + 8, e.n ?? 0, true);
    else dv.setUint32(o + 8, e.n ?? 0, true);
    o += 12;
  }
  dv.setUint32(o, 0, true);                           // next IFD: none
  out.set(cmyk, stripOffset);
  return out;
}

// Rasterise the print marks (crop / bleed / registration / colour bar) straight
// into the DeviceCMYK byte buffer, AFTER the RGB→CMYK conversion — so the line
// marks land on all four plates (C=M=Y=K=255, the raster analogue of the PDF's
// 1 1 1 1 registration ink) instead of being remapped by the naive per-pixel pass.
// Engine geometry is points, top-left origin; convert to device pixels at dpi. All
// crop/bleed/registration lines are axis-aligned (each a filled hairline bar); the
// registration target is a stroked ring; colour-bar cells are filled rectangles in
// their own DeviceCMYK value. `labels` (optional) maps each engine label slot → its
// provenance string; those are shaped by the browser and composited as K-only ink.
export function drawPrintMarksCmyk(cmyk: Uint8Array, W: number, H: number, geo: PrintGeometry, dpi: number, labels: ProvenanceLabels | null): void {
  const pt = (v: number) => v * dpi / 72;
  const REG: readonly [number, number, number, number] = [255, 255, 255, 255]; // all plates (registration black)
  const stroke = Math.max(1, Math.round(pt(geo.strokeWeight)));

  const put = (x: number, y: number, ink: readonly number[]) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 4;
    cmyk[o] = ink[0] ?? 0; cmyk[o + 1] = ink[1] ?? 0; cmyk[o + 2] = ink[2] ?? 0; cmyk[o + 3] = ink[3] ?? 0;
  };
  const fill = (x0: number, y0: number, w: number, h: number, ink: readonly number[]) => {
    const xs = Math.round(x0), ys = Math.round(y0);
    const xe = Math.round(x0 + w), ye = Math.round(y0 + h);
    for (let y = ys; y < ye; y++) for (let x = xs; x < xe; x++) put(x, y, ink);
  };

  for (const ln of geo.primitives.lines) {
    const x1 = pt(ln.x1), y1 = pt(ln.y1), x2 = pt(ln.x2), y2 = pt(ln.y2);
    if (Math.abs(x1 - x2) < 0.5) fill(x1 - stroke / 2, Math.min(y1, y2), stroke, Math.abs(y2 - y1), REG); // vertical
    else fill(Math.min(x1, x2), y1 - stroke / 2, Math.abs(x2 - x1), stroke, REG);                          // horizontal
  }

  for (const c of geo.primitives.circles) {
    const cx = pt(c.cx), cy = pt(c.cy), r = pt(c.r), half = stroke / 2;
    const x0 = Math.floor(cx - r - half), x1 = Math.ceil(cx + r + half);
    const y0 = Math.floor(cy - r - half), y1 = Math.ceil(cy + r + half);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (Math.abs(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r) <= half) put(x, y, REG);
    }
  }

  for (const b of geo.primitives.bars) {
    const ink = b.cmyk.map(v => Math.round(v * 255));
    fill(pt(b.x), pt(b.y), pt(b.w), pt(b.h), ink);
  }

  // Provenance credit text — only the anchors the caller supplied a string for.
  // The browser shapes the glyphs on an offscreen canvas (Helvetica, mirroring the
  // PDF path), then each covered pixel is composited as 70% K ink — the raster
  // analogue of the PDF's cmyk(0,0,0,0.7) — so the credits sit on the black plate
  // only, not as registration. Engine coords are points, top-left origin (same as
  // the canvas) so there's no y-flip; rotation is CCW-positive, hence the negation.
  const withText = (geo.primitives.labels ?? [])
    .map(l => ({ anchor: l, text: labels?.[l.slot] }))
    .filter((s): s is { anchor: typeof s.anchor; text: string } => Boolean(s.text));
  if (withText.length) {
    // Stamp the credits onto a canvas no bigger than the labels' union bounding
    // box, not the full W×H sheet — the old path allocated an image-sized canvas
    // and ran a second whole-image getImageData + per-pixel loop just to composite
    // a few glyphs. The bbox is padded generously (ascent/descent + side overhang,
    // rotation-aware) so no covered pixel is ever clipped → byte-identical output.
    const measure = document.createElement('canvas').getContext('2d');
    if (!measure) return;
    measure.textBaseline = 'alphabetic';
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const { anchor: l, text } of withText) {
      const size = pt(l.size);
      measure.font = `${size}px Helvetica, Arial, sans-serif`;
      const tw = measure.measureText(text).width;
      const baseX = (l.align === 'right') ? -tw : 0;     // fillText anchor offset
      const lx0 = baseX - size * 0.3, lx1 = baseX + tw + size * 0.3;
      const ly0 = -size * 1.3,        ly1 = size * 0.5;  // generous ascent/descent
      const theta = l.rotation ? -l.rotation * Math.PI / 180 : 0;
      const cos = Math.cos(theta), sin = Math.sin(theta);
      const ax = pt(l.x), ay = pt(l.y);
      for (const [lx, ly] of [[lx0, ly0], [lx1, ly0], [lx1, ly1], [lx0, ly1]] as const) {
        const gx = ax + lx * cos - ly * sin;
        const gy = ay + lx * sin + ly * cos;
        if (gx < minX) minX = gx; if (gx > maxX) maxX = gx;
        if (gy < minY) minY = gy; if (gy > maxY) maxY = gy;
      }
    }
    const bx0 = Math.max(0, Math.floor(minX)), by0 = Math.max(0, Math.floor(minY));
    const bx1 = Math.min(W, Math.ceil(maxX)),  by1 = Math.min(H, Math.ceil(maxY));
    const bw = bx1 - bx0, bh = by1 - by0;
    if (bw > 0 && bh > 0) {
      const tcanvas = document.createElement('canvas');
      tcanvas.width = bw; tcanvas.height = bh;
      const tctx = tcanvas.getContext('2d', { willReadFrequently: true });
      if (!tctx) return;
      tctx.fillStyle = '#000';
      tctx.textBaseline = 'alphabetic';
      tctx.translate(-bx0, -by0);                        // draw in absolute device px
      for (const { anchor: l, text } of withText) {
        tctx.save();
        tctx.translate(pt(l.x), pt(l.y));
        if (l.rotation) tctx.rotate(-l.rotation * Math.PI / 180);
        tctx.textAlign = l.align === 'right' ? 'right' : 'left';
        tctx.font = `${pt(l.size)}px Helvetica, Arial, sans-serif`;
        tctx.fillText(text, 0, 0);
        tctx.restore();
      }
      const tpx = tctx.getImageData(0, 0, bw, bh).data;
      for (let ry = 0; ry < bh; ry++) {
        let p = ry * bw * 4 + 3;                         // alpha byte, region row ry
        let o = ((by0 + ry) * W + bx0) * 4;              // matching sheet pixel
        for (let rx = 0; rx < bw; rx++, p += 4, o += 4) {
          const t = ((tpx[p] ?? 0) / 255) * 0.7;         // glyph coverage → 70% K ink
          if (!t) continue;
          cmyk[o]     = ((cmyk[o] ?? 0)     * (1 - t) + 0.5) | 0;
          cmyk[o + 1] = ((cmyk[o + 1] ?? 0) * (1 - t) + 0.5) | 0;
          cmyk[o + 2] = ((cmyk[o + 2] ?? 0) * (1 - t) + 0.5) | 0;
          cmyk[o + 3] = ((cmyk[o + 3] ?? 0) * (1 - t) + 255 * t + 0.5) | 0;
        }
      }
    }
  }
}
