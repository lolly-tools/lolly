/**
 * ExportAPI — converts a rendered DOM node to a file format.
 *
 * The host owns the renderer choice. Tools call host.export.render(node, fmt)
 * and get back a Blob. This file is where format support is added/swapped —
 * one place, not 50.
 *
 * Watermarking: applied when the tool is 'experimental' OR opts.watermark is true.
 * The watermark is a corner overlay clone-injected into the node before rasterisation.
 * For SVG we inject an <text> element instead.
 */

import {
  parseDimension, isPhysical, toPixels, toPoints, toCssPx, toCssLength, CSS_DPI,
  iccProfileBytes, rgbToCmyk, cmykCondition, computePrintGeometry, emitEmf,
} from '@lolly/engine';
import {
  suseFontFile, SUSE_FONT_DIR,
  resolveSuseFontUrl, canVectoriseText, textBaselineY,
} from './text-svg.js';
import { svgDomToIr } from './svg-ir.js';

let domToImageMore = null;

// The host is captured once at bridge construction so the SVG text vectoriser can
// reach host.text.toPath without threading it through every render function. The
// reference is stable; host.text is attached just after createExportAPI runs (see
// bridge/index.js ordering), so read it lazily at render time, not here.
let _host = null;

/**
 * Resolve the requested output size for an export.
 *
 * opts.width / opts.height may be numbers (CSS px) or unit strings ("210mm",
 * "8.5in", "595pt", "800px"); absent falls back to the node's on-screen size.
 * Physical units need a resolution for raster output — opts.dpi wins, else 300
 * (print) when any physical unit is in play, else 96 (CSS). Vector formats
 * (PDF/SVG) ignore the DPI; they convert exactly.
 */
function exportDims(node, opts) {
  const r = node.getBoundingClientRect();
  const node_ = { w: r.width || 1, h: r.height || 1 };
  const w = parseDimension(opts.width) ?? { value: node_.w, unit: 'px' };
  const h = parseDimension(opts.height) ?? { value: node_.h, unit: 'px' };
  const physical = isPhysical(w) || isPhysical(h);
  const dpi = (opts.dpi > 0) ? opts.dpi : (physical ? 300 : CSS_DPI);
  return { node: node_, w, h, dpi, physical };
}

async function getDomToImage() {
  if (!domToImageMore) {
    const mod = await import('dom-to-image-more');
    domToImageMore = mod.default ?? mod;
  }
  return domToImageMore;
}

export function createExportAPI(host) {
  _host = host;
  return {
    async render(node, format, opts = {}) {
      const watermark = Boolean(opts.watermark);

      // Watermark via a live overlay on the original node, not a detached clone.
      // Detached clones lose getComputedStyle context: CSS variables don't resolve,
      // animations don't run, getBoundingClientRect returns zero — everything breaks.
      const removeWatermark = watermark ? addWatermarkOverlay(node) : null;

      try {
        return await renderFormat(node, format, opts);
      } finally {
        removeWatermark?.();
      }
    },

    async download(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },

    // Transform-path delivery: a blob the tool produced itself (a transformed
    // user file from the exportFile hook). On the web this is just a download —
    // but it's deliberately a distinct verb from render(): no watermark and no
    // provenance metadata are ever applied, because the bytes are the user's own
    // content. (Tauri/CLI route this to a real save target.)
    async file(blob, opts = {}) {
      await this.download(blob, opts.filename || 'file');
    },
  };
}

// Dispatch one format → Blob. Split out from the watermark wrapper above so the
// ZIP bundler can reuse it per sub-format without re-applying the overlay (the
// outer render() already watermarked the live node once).
async function renderFormat(node, format, opts = {}) {
  switch (format) {
    case 'png':
      return await renderRaster(node, 'png', opts);
    case 'jpg':
    case 'jpeg':
      return await renderRaster(node, 'jpeg', opts);
    case 'webp':
      return await renderBitmap(node, 'image/webp', opts);
    case 'avif':
      return await renderBitmap(node, 'image/avif', opts);
    case 'cmyk-tiff':
      return await renderCmykTiff(node, opts);
    case 'svg':
      return await renderSvg(node, opts);
    case 'emf':
      return await renderEmf(node, opts);
    case 'pdf':
      return await renderPdf(node, opts);
    case 'pdf-cmyk':
      return await renderCmykPdf(node, opts);
    case 'html':
      return renderStaticHtml(node);
    case 'md':
      return renderMarkdown(node);
    case 'txt':
      return renderPlainText(node);
    case 'json':
    case 'csv':
    case 'ics':
    case 'vcf':
      // Engine already hydrated the payload (runtime.export → buildDataPayload);
      // the host just wraps it with the right MIME.
      return new Blob([opts.dataText ?? ''], { type: opts.dataMime ?? 'text/plain' });
    case 'ico':
      return await renderIco(node, opts);
    case 'zip':
      return await renderZip(node, opts);
    case 'webm':
      return await renderVideo(node, opts, 'webm');
    case 'mp4':
      return await renderVideo(node, opts, 'mp4');
    case 'gif':
      return await renderGif(node, opts);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

async function renderRaster(node, format, opts) {
  const lib = await getDomToImage();
  const d = exportDims(node, opts);
  const dtoOpts = rasterStyle(d, opts);
  // Mutate blob: URLs to data URLs on the live node so dom-to-image-more can
  // serialise them inside the SVG foreignObject. Restore immediately after so
  // the canvas stays clean. The live node MUST be passed (not a clone) so that
  // dom-to-image reads computed styles from elements that are in the document.
  const restore = await swapBlobUrls(node);
  try {
    const dataUrl = await (format === 'jpeg'
      ? lib.toJpeg(node, { quality: opts.quality ?? 0.92, ...dtoOpts })
      : lib.toPng(node, dtoOpts));
    const res = await fetch(dataUrl);
    let blob = await res.blob();
    // Stamp the DPI (physical size) + provenance metadata + colour profile in a
    // SINGLE parse/serialise cycle: read the encoded bytes once, splice every
    // chunk/segment in order, rebuild the Blob once. (Each stamp was previously
    // its own arrayBuffer()→Blob round-trip — three full multi-MB copies for a
    // high-DPI PNG.) Insertion order is preserved, so the output is byte-identical.
    const icc = iccWanted(opts) ? iccProfileBytes(opts.colorProfile) : null;
    if (format === 'png' && (d.dpi > 0 || opts.meta || icc)) {
      let bytes = new Uint8Array(await blob.arrayBuffer());
      if (d.dpi > 0) bytes = insertPngPhys(bytes, d.dpi) || bytes;
      bytes = insertPngMeta(bytes, opts.meta);
      if (icc) bytes = await insertPngIcc(bytes, icc);
      blob = new Blob([bytes], { type: 'image/png' });
    } else if (format === 'jpeg' && (d.dpi > 0 || opts.meta || icc)) {
      let bytes = new Uint8Array(await blob.arrayBuffer());
      bytes = patchJpegDpi(bytes, d.dpi);
      bytes = insertJpegExif(bytes, opts.meta);
      if (icc) bytes = insertJpegIcc(bytes, icc);
      blob = new Blob([bytes], { type: 'image/jpeg' });
    }
    return blob;
  } finally {
    restore();
  }
}

async function renderBitmap(node, mimeType, opts) {
  const lib = await getDomToImage();
  const d = exportDims(node, opts);
  const dtoOpts = rasterStyle(d, opts);
  const restore = await swapBlobUrls(node);
  let raw;
  try {
    raw = await lib.toCanvas(node, dtoOpts);
  } finally {
    restore();
  }
  const canvas = normalizeCanvas(raw, dtoOpts.width, dtoOpts.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error(`Encoding failed for ${mimeType}`)),
      mimeType,
      opts.quality ?? 0.9,
    );
  });
}

// ── DeviceCMYK TIFF export (print-ready) ────────────────────────────────────
//
// A print-grade CMYK TIFF, written by hand (no browser TIFF encoder exists; this
// is the same hand-rolled-binary approach used for PNG chunks / EXIF / ICC). The
// canvas is rasterised like the other raster formats, its sRGB pixels converted
// per-pixel to *device* CMYK via the engine's rgbToCmyk (Path 1: no ICC transform,
// no brand-palette substitution — incidental colours only), stored uncompressed in
// a single strip.
//
// Print finishing mirrors the Print PDF, on the same engine geometry
// (computePrintGeometry): when bleed/marks are requested the design is stretched to
// COVER the bleed box on an enlarged white sheet, and the crop / bleed / registration
// marks + colour bar are rasterised straight into the CMYK buffer AFTER the
// conversion — so the line marks land on every plate (C=M=Y=K=255, the raster
// analogue of the PDF's 1 1 1 1 registration ink) instead of being remapped by the
// naive per-pixel pass. The bar is the generic process/overprint/tint control strip
// (the raster does no exact substitution, so there's nothing to verify).
//
// Deliberately untagged DeviceCMYK: there is NO embedded output profile (a real
// profile over the naive conversion would mislabel the file). The chosen press
// condition is recorded only as provenance in ImageDescription — naming the intended
// viewing condition without claiming colour management. A colour-managed variant
// (real ICC separation + embedded press profile) is a separate, heavier project —
// see cmykTiffSupport, which keeps the format off environments where it can't be
// produced or delivered.
async function renderCmykTiff(node, opts) {
  const lib = await getDomToImage();
  const d = exportDims(node, opts);
  // Print finishing geometry — same engine source of truth as the PDF path. Pass
  // no palette: the raster is a flat per-pixel conversion with no exact brand
  // substitution to verify, so the colour bar stays the generic control strip.
  const geo = printGeometry(node, opts, []);
  const ptPx  = (v) => Math.round(v * d.dpi / 72);        // points → device px (offset)
  const ptDim = (v) => Math.max(1, ptPx(v));              // points → device px (size)

  const restore = await swapBlobUrls(node);
  let artCanvas;
  try {
    // With geometry the design is stretched to COVER the bleed box (mirrors the
    // PDF's scale-to-bleed); without it, the plain trim-size raster as before.
    const dtoOpts = geo
      ? coverRasterStyle(d, opts, ptDim(geo.artwork.w), ptDim(geo.artwork.h))
      : rasterStyle(d, opts);
    const raw = await lib.toCanvas(node, dtoOpts);
    artCanvas = normalizeCanvas(raw, dtoOpts.width, dtoOpts.height);
  } finally {
    restore();
  }

  // Compose the artwork onto the full white sheet (print stock) when there's a margin.
  let canvas = artCanvas;
  if (geo) {
    const sheet = document.createElement('canvas');
    sheet.width  = ptDim(geo.page.w);
    sheet.height = ptDim(geo.page.h);
    const sctx = sheet.getContext('2d', { willReadFrequently: true });
    sctx.fillStyle = '#ffffff';
    sctx.fillRect(0, 0, sheet.width, sheet.height);
    sctx.drawImage(artCanvas, ptPx(geo.artwork.x), ptPx(geo.artwork.y), ptDim(geo.artwork.w), ptDim(geo.artwork.h));
    canvas = sheet;
  }

  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const rgba = ctx.getImageData(0, 0, W, H).data;   // sRGB, straight (un-premultiplied)
  const cmyk = await rgbaToDeviceCmyk(rgba, W, H, opts.onProgress);

  // Marks drawn AFTER conversion → registration/crop/bleed land on every plate;
  // provenance credit text is composited as K-only ink (see drawPrintMarksCmyk).
  if (geo) drawPrintMarksCmyk(cmyk, W, H, geo, d.dpi, provenanceLabels(opts.meta));

  const tiff = encodeCmykTiff(cmyk, W, H, d.dpi, opts.meta, pressConditionLabel(opts.colorProfile));
  return new Blob([tiff], { type: 'image/tiff' });
}

// RGBA (0–255, sRGB) → packed CMYK bytes (0=no ink … 255=full ink), one tight
// numeric pass over the typed array. Transparency is flattened onto white (CMYK
// has no alpha channel and print stock is white). ~tens of ms for 1080², but a
// large print-DPI sheet runs long on the main thread, so the pass yields to the
// event loop every YIELD_ROWS scanlines (keeping the tab responsive) and reports
// row progress through opts.onProgress. The arithmetic is unchanged — same bytes.
const YIELD_ROWS = 256;
async function rgbaToDeviceCmyk(rgba, W, H, onProgress) {
  const out = new Uint8Array(W * H * 4);
  for (let row = 0; row < H; row++) {
    const base = row * W * 4;
    for (let i = base, end = base + W * 4; i < end; i += 4) {
      const a = rgba[i + 3];
      let r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
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

// Assemble a baseline little-endian CMYK TIFF: 8-byte header → IFD → out-of-line
// values → one uncompressed strip. Entries are gathered, then sorted by tag (a
// TIFF requirement) with ≤4-byte values inlined and larger ones placed after the
// IFD. Mirrors buildExifTiff, scaled up to a full image + provenance + DPI.
function encodeCmykTiff(cmyk, W, H, dpi, meta, condition) {
  const enc = new TextEncoder();
  const SHORT = 3, LONG = 4, RATIONAL = 5, ASCII = 2;
  const TYPE_SIZE = { 2: 1, 3: 2, 4: 4, 5: 8 };
  const entries = [];
  const num   = (tag, type, n) => entries.push({ tag, type, count: 1, n });
  const asciiTag = (tag, s) => { if (s) { const a = enc.encode(String(s)); const d = new Uint8Array(a.length + 1); d.set(a, 0); entries.push({ tag, type: ASCII, count: d.length, data: d }); } };

  const bps = new Uint8Array(8); { const dv = new DataView(bps.buffer); for (let i = 0; i < 4; i++) dv.setUint16(i * 2, 8, true); }
  const rational = (n2, den) => { const d = new Uint8Array(8); const dv = new DataView(d.buffer); dv.setUint32(0, n2, true); dv.setUint32(4, den, true); return d; };
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
    const bytes = e.data ? e.data.length : e.count * TYPE_SIZE[e.type];
    if (bytes > 4) { e.offset = ext; ext += bytes + (bytes & 1); } // keep word alignment
  }
  const stripOffset = ext + (ext & 1);
  entries.find(e => e.tag === 273).n = stripOffset;   // patch StripOffsets

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
    const bytes = e.data ? e.data.length : e.count * TYPE_SIZE[e.type];
    if (bytes > 4) { dv.setUint32(o + 8, e.offset, true); out.set(e.data, e.offset); }
    else if (e.data) out.set(e.data, o + 8);          // small inline value (e.g. short ASCII)
    else if (e.type === SHORT) dv.setUint16(o + 8, e.n, true);
    else dv.setUint32(o + 8, e.n, true);
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
function drawPrintMarksCmyk(cmyk, W, H, geo, dpi, labels) {
  const pt = (v) => v * dpi / 72;
  const REG = [255, 255, 255, 255];                       // all plates (registration black)
  const stroke = Math.max(1, Math.round(pt(geo.strokeWeight)));

  const put = (x, y, ink) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const o = (y * W + x) * 4;
    cmyk[o] = ink[0]; cmyk[o + 1] = ink[1]; cmyk[o + 2] = ink[2]; cmyk[o + 3] = ink[3];
  };
  const fill = (x0, y0, w, h, ink) => {
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
  const slots = (geo.primitives.labels ?? []).filter(l => labels?.[l.slot]);
  if (slots.length) {
    // Stamp the credits onto a canvas no bigger than the labels' union bounding
    // box, not the full W×H sheet — the old path allocated an image-sized canvas
    // and ran a second whole-image getImageData + per-pixel loop just to composite
    // a few glyphs. The bbox is padded generously (ascent/descent + side overhang,
    // rotation-aware) so no covered pixel is ever clipped → byte-identical output.
    const measure = document.createElement('canvas').getContext('2d');
    measure.textBaseline = 'alphabetic';
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const l of slots) {
      const size = pt(l.size);
      measure.font = `${size}px Helvetica, Arial, sans-serif`;
      const tw = measure.measureText(labels[l.slot]).width;
      const baseX = (l.align === 'right') ? -tw : 0;     // fillText anchor offset
      const lx0 = baseX - size * 0.3, lx1 = baseX + tw + size * 0.3;
      const ly0 = -size * 1.3,        ly1 = size * 0.5;  // generous ascent/descent
      const theta = l.rotation ? -l.rotation * Math.PI / 180 : 0;
      const cos = Math.cos(theta), sin = Math.sin(theta);
      const ax = pt(l.x), ay = pt(l.y);
      for (const [lx, ly] of [[lx0, ly0], [lx1, ly0], [lx1, ly1], [lx0, ly1]]) {
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
      tctx.fillStyle = '#000';
      tctx.textBaseline = 'alphabetic';
      tctx.translate(-bx0, -by0);                        // draw in absolute device px
      for (const l of slots) {
        tctx.save();
        tctx.translate(pt(l.x), pt(l.y));
        if (l.rotation) tctx.rotate(-l.rotation * Math.PI / 180);
        tctx.textAlign = l.align === 'right' ? 'right' : 'left';
        tctx.font = `${pt(l.size)}px Helvetica, Arial, sans-serif`;
        tctx.fillText(labels[l.slot], 0, 0);
        tctx.restore();
      }
      const tpx = tctx.getImageData(0, 0, bw, bh).data;
      for (let ry = 0; ry < bh; ry++) {
        let p = ry * bw * 4 + 3;                         // alpha byte, region row ry
        let o = ((by0 + ry) * W + bx0) * 4;              // matching sheet pixel
        for (let rx = 0; rx < bw; rx++, p += 4, o += 4) {
          const t = (tpx[p] / 255) * 0.7;                // glyph coverage → 70% K ink
          if (!t) continue;
          cmyk[o]     = (cmyk[o]     * (1 - t) + 0.5) | 0;
          cmyk[o + 1] = (cmyk[o + 1] * (1 - t) + 0.5) | 0;
          cmyk[o + 2] = (cmyk[o + 2] * (1 - t) + 0.5) | 0;
          cmyk[o + 3] = (cmyk[o + 3] * (1 - t) + 255 * t + 0.5) | 0;
        }
      }
    }
  }
}

// The human-readable press condition recorded as TIFF provenance (ImageDescription).
// Mirrors the PDF OutputIntent's purpose — naming the condition the DeviceCMYK values
// target — but as metadata only: the pixels stay untagged (no embedded profile), so
// the file is never mislabelled. 'none' opts out; anything else resolves via the
// engine registry (unknown / 'srgb' fall back to the default condition).
function pressConditionLabel(profile) {
  if (profile === 'none') return null;
  return cmykCondition(profile).info;
}

// Can this environment both PRODUCE and DELIVER a DeviceCMYK TIFF? Memoised.
// Production needs canvas pixel readback (blocked by Tor / Firefox RFP, which
// breaks every raster export). Delivery is the TIFF-specific catch: the browser
// can't preview a CMYK TIFF, and mobile Safari / in-app WebViews route blob
// downloads to an in-page view — a dead end for a non-displayable file. So the
// format is offered on desktop only, until a previewable / colour-managed path
// exists. The shell calls this from keepFormat to hide the option where unusable.
let _cmykTiff = null;
export function cmykTiffSupport() {
  if (_cmykTiff !== null) return _cmykTiff;
  _cmykTiff = false;
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return _cmykTiff;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 2;
    const ctx = c.getContext('2d');
    if (!ctx) return _cmykTiff;
    ctx.fillRect(0, 0, 1, 1);
    ctx.getImageData(0, 0, 1, 1);                     // throws if readback is blocked
  } catch { return _cmykTiff; }
  const ua = navigator.userAgent || '';
  const iOS = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  const mobile = iOS || /Android/.test(ua) || (/Mobi/.test(ua) && (navigator.maxTouchPoints || 0) > 0);
  _cmykTiff = !mobile;
  return _cmykTiff;
}

// dom-to-image options: render the node at its native CSS size then scale it up
// (via CSS transform) to the target output resolution. The target is the
// requested dimension converted to pixels at the chosen DPI; if none was
// requested we fall back to the canvas at its default 2× scale.
function rasterStyle(d, opts) {
  const requested = (opts.width != null && opts.width !== '') || (opts.height != null && opts.height !== '');
  const scale = opts.scale ?? 2;
  const targetW = requested ? toPixels(d.w, d.dpi) : Math.round(d.node.w * scale);
  const targetH = requested ? toPixels(d.h, d.dpi) : Math.round(d.node.h * scale);
  const renderScale = targetW / d.node.w;
  const result = {
    width: targetW,
    height: targetH,
    style: {
      transform: `scale(${renderScale})`,
      transformOrigin: 'top left',
      width: `${d.node.w}px`,
      height: `${d.node.h}px`,
    },
  };
  if (opts.background === 'transparent') {
    result.style.background = 'transparent';
  } else if (opts.background != null) {
    result.bgcolor = opts.background;
  }
  return result;
}

// dom-to-image options that stretch the node to exactly cover a target pixel box
// (the bleed box) — non-uniform scale, matching the PDF's scale-to-bleed. Used by
// the print-finished CMYK TIFF; any transparency is flattened onto the white sheet
// by the CMYK pass, so the background is immaterial here.
function coverRasterStyle(d, opts, targetW, targetH) {
  const result = {
    width: targetW,
    height: targetH,
    style: {
      transform: `scale(${targetW / d.node.w}, ${targetH / d.node.h})`,
      transformOrigin: 'top left',
      width: `${d.node.w}px`,
      height: `${d.node.h}px`,
    },
  };
  if (opts.background === 'transparent') result.style.background = 'transparent';
  else if (opts.background != null) result.bgcolor = opts.background;
  return result;
}

// ── PNG physical-resolution metadata ────────────────────────────────────────
//
// dom-to-image PNGs carry no DPI, so they're assumed 96 — a 2480px-wide A4
// raster would print ~26 inches wide. insertPngPhys (below) injects a pHYs chunk
// recording the real DPI so print/layout software places the image at its
// intended physical size. All the byte-level stampers here take and return a
// Uint8Array (the caller reads/writes the Blob once) and are best-effort: any
// parse hiccup returns the input bytes untouched.

// JPEG carries DPI in the JFIF APP0 segment (right after SOI). Browsers emit one
// with no/72 density; patch the density-unit + X/Y density so placing apps size
// it physically. Best-effort: anything unexpected returns the bytes untouched.
function patchJpegDpi(b, dpi) {
  if (!(dpi > 0)) return b;
  try {
    // FFD8 (SOI) FFE0 (APP0) … "JFIF\0" at byte 6.
    if (b[0] !== 0xFF || b[1] !== 0xD8 || b[2] !== 0xFF || b[3] !== 0xE0) return b;
    if (!(b[6] === 0x4A && b[7] === 0x46 && b[8] === 0x49 && b[9] === 0x46 && b[10] === 0x00)) return b;
    const out = b.slice();
    const d = Math.min(0xFFFF, Math.round(dpi));
    out[13] = 1;                // density units: dots per inch
    out[14] = (d >> 8) & 0xFF;  // Xdensity
    out[15] = d & 0xFF;
    out[16] = (d >> 8) & 0xFF;  // Ydensity
    out[17] = d & 0xFF;
    return out;
  } catch {
    return b;
  }
}

const readU32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
function writeU32(b, o, v) { b[o] = (v >>> 24) & 255; b[o + 1] = (v >>> 16) & 255; b[o + 2] = (v >>> 8) & 255; b[o + 3] = v & 255; }

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const chunk = new Uint8Array(12 + data.length);
  writeU32(chunk, 0, data.length);
  for (let i = 0; i < 4; i++) chunk[4 + i] = type.charCodeAt(i);
  chunk.set(data, 8);
  writeU32(chunk, 8 + data.length, crc32(chunk.subarray(4, 8 + data.length)));
  return chunk;
}

// Splice a pHYs chunk (pixels-per-metre, unit=metre) in right after IHDR.
function insertPngPhys(png, dpi) {
  const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (png[i] !== SIG[i]) return null;
  const ihdrLen = readU32(png, 8);
  const insertAt = 8 + 12 + ihdrLen; // sig + (len+type+data+crc) of IHDR
  const ppm = Math.round(dpi / 0.0254); // px per inch → px per metre
  const data = new Uint8Array(9);
  writeU32(data, 0, ppm);
  writeU32(data, 4, ppm);
  data[8] = 1; // unit specifier: metres
  const phys = pngChunk('pHYs', data);
  const out = new Uint8Array(png.length + phys.length);
  out.set(png.subarray(0, insertAt), 0);
  out.set(phys, insertAt);
  out.set(png.subarray(insertAt), insertAt + phys.length);
  return out;
}

// ── Provenance metadata (authorship embedded per format) ─────────────────────
//
// A generic record assembled by the engine (engine/src/metadata.js) is mapped
// here onto each format's native mechanism: PNG iTXt, JPEG EXIF (IFD0), PDF info
// dict (in renderPdf/renderCmykPdf), SVG <metadata>+<title>/<desc>, GIF comment.
// All best-effort: anything unexpected returns the input untouched.

const xmlEsc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// PNG: one UTF-8 iTXt chunk per metadata field, spliced in after IHDR.
function iTXtChunk(keyword, text) {
  const enc = new TextEncoder();
  const kw = enc.encode(keyword);
  const txt = enc.encode(text);
  const data = new Uint8Array(kw.length + 5 + txt.length);
  let o = 0;
  data.set(kw, o); o += kw.length;
  data[o++] = 0; // keyword terminator
  data[o++] = 0; // compression flag (uncompressed)
  data[o++] = 0; // compression method
  data[o++] = 0; // language tag (empty) terminator
  data[o++] = 0; // translated keyword (empty) terminator
  data.set(txt, o);
  return pngChunk('iTXt', data);
}

function insertPngMeta(png, meta) {
  if (!meta) return png;
  try {
    const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) if (png[i] !== SIG[i]) return png;
    const pairs = [
      ['Software', meta.software], ['Author', meta.author],
      ['Source', meta.source], ['Description', meta.description], ['Comment', meta.contact],
    ].filter(([, v]) => v);
    if (!pairs.length) return png;
    const chunks = pairs.map(([k, v]) => iTXtChunk(k, v));
    const at = 8 + 12 + readU32(png, 8); // after IHDR
    const extra = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(png.length + extra);
    out.set(png.subarray(0, at), 0);
    let o = at;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    out.set(png.subarray(at), o);
    return out;
  } catch {
    return png;
  }
}

// JPEG: a minimal little-endian EXIF TIFF (IFD0, ASCII tags) in an APP1 segment,
// inserted after the JFIF APP0. Tags: ImageDescription, Software, Artist.
function buildExifTiff(fields) {
  const enc = new TextEncoder();
  const entries = fields.map(f => {
    const s = enc.encode(f.value);
    const data = new Uint8Array(s.length + 1); data.set(s, 0); // NUL-terminated
    return { tag: f.tag, count: data.length, data };
  }).filter(e => e.count > 1);
  const n = entries.length;
  if (!n) return null;
  const dataStart = 8 + 2 + n * 12 + 4; // header + IFD(count + entries + next)
  const dataLen = entries.reduce((s, e) => s + (e.count > 4 ? e.count : 0), 0);
  const tiff = new Uint8Array(dataStart + dataLen);
  const dv = new DataView(tiff.buffer);
  tiff[0] = 0x49; tiff[1] = 0x49;            // "II" little-endian
  dv.setUint16(2, 0x002A, true);
  dv.setUint32(4, 8, true);                  // IFD0 offset
  dv.setUint16(8, n, true);
  let entryOff = 10, dataOff = dataStart;
  for (const e of entries) {
    dv.setUint16(entryOff, e.tag, true);
    dv.setUint16(entryOff + 2, 2, true);     // type ASCII
    dv.setUint32(entryOff + 4, e.count, true);
    if (e.count <= 4) tiff.set(e.data, entryOff + 8);
    else { dv.setUint32(entryOff + 8, dataOff, true); tiff.set(e.data, dataOff); dataOff += e.count; }
    entryOff += 12;
  }
  dv.setUint32(10 + n * 12, 0, true);        // next IFD = none
  return tiff;
}

function insertJpegExif(b, meta) {
  if (!meta) return b;
  try {
    const desc = [meta.description, meta.contact].filter(Boolean).join(' · ');
    const tiff = buildExifTiff([
      { tag: 0x010E, value: desc },          // ImageDescription
      { tag: 0x0131, value: meta.software }, // Software
      { tag: 0x013B, value: meta.author },   // Artist
    ].filter(f => f.value));
    if (!tiff) return b;
    const id = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
    const segLen = 2 + id.length + tiff.length;       // length field includes itself
    if (segLen > 0xFFFF) return b;
    const app1 = new Uint8Array(2 + segLen);
    app1[0] = 0xFF; app1[1] = 0xE1;
    app1[2] = (segLen >> 8) & 0xFF; app1[3] = segLen & 0xFF;
    app1.set(id, 4); app1.set(tiff, 4 + id.length);

    if (b[0] !== 0xFF || b[1] !== 0xD8) return b; // not JPEG
    let at = 2; // after SOI; skip an APP0 (JFIF) if present so order stays valid
    if (b[2] === 0xFF && b[3] === 0xE0) at = 4 + ((b[4] << 8) | b[5]);
    const out = new Uint8Array(b.length + app1.length);
    out.set(b.subarray(0, at), 0);
    out.set(app1, at);
    out.set(b.subarray(at), at + app1.length);
    return out;
  } catch {
    return b;
  }
}

// ── ICC colour profile embedding ─────────────────────────────────────────────
//
// Tags raster output with the colour space its pixels were rendered in (sRGB —
// what the browser canvas produces), so colour-managed software reproduces them
// faithfully instead of guessing. Profile bytes come from the engine (the single
// source of truth); the shell only splices them into each format's native slot:
// PNG iCCP chunk, JPEG APP2 segment. Best-effort: any hiccup returns the blob.

// Embed when a profile is requested (default 'srgb') and this isn't a thumbnail.
function iccWanted(opts) {
  return opts.colorProfile !== 'none' && !opts.thumbnail;
}

// PNG: an iCCP chunk (profile name + compression method 0 + zlib-deflated
// profile) spliced in right after IHDR, before IDAT — where the spec requires it.
async function insertPngIcc(png, iccBytes) {
  try {
    const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) if (png[i] !== SIG[i]) return png;
    const name = new TextEncoder().encode('sRGB'); // 1–79 bytes, Latin-1
    const compressed = await deflateBytes(iccBytes);
    const data = new Uint8Array(name.length + 2 + compressed.length);
    data.set(name, 0);
    data[name.length] = 0;     // name terminator
    data[name.length + 1] = 0; // compression method: zlib/deflate
    data.set(compressed, name.length + 2);
    const chunk = pngChunk('iCCP', data);
    const at = 8 + 12 + readU32(png, 8); // after IHDR
    const out = new Uint8Array(png.length + chunk.length);
    out.set(png.subarray(0, at), 0);
    out.set(chunk, at);
    out.set(png.subarray(at), at + chunk.length);
    return out;
  } catch {
    return png;
  }
}

// JPEG: one or more APP2 "ICC_PROFILE\0" segments (the profile is split across
// 65 519-byte chunks when large), inserted after the leading APP0/APP1 segments.
function insertJpegIcc(b, iccBytes) {
  try {
    if (b[0] !== 0xFF || b[1] !== 0xD8) return b; // not JPEG
    const id = [0x49, 0x43, 0x43, 0x5F, 0x50, 0x52, 0x4F, 0x46, 0x49, 0x4C, 0x45, 0x00]; // "ICC_PROFILE\0"
    const MAX = 0xFFFF - 2 - id.length - 2; // payload room per APP2 (after len + id + seq/count)
    const count = Math.ceil(iccBytes.length / MAX);
    if (count > 255) return b; // ICC caps at 255 chunks
    const segs = [];
    for (let i = 0; i < count; i++) {
      const part = iccBytes.subarray(i * MAX, i * MAX + MAX);
      const segLen = 2 + id.length + 2 + part.length; // length field includes itself
      const app2 = new Uint8Array(2 + segLen);
      app2[0] = 0xFF; app2[1] = 0xE2;
      app2[2] = (segLen >> 8) & 0xFF; app2[3] = segLen & 0xFF;
      app2.set(id, 4);
      app2[4 + id.length] = i + 1;   // chunk sequence number (1-based)
      app2[5 + id.length] = count;   // total chunks
      app2.set(part, 6 + id.length);
      segs.push(app2);
    }
    // Insert after a leading APP0 (JFIF) and/or APP1 (EXIF) so marker order stays valid.
    let at = 2;
    while (b[at] === 0xFF && (b[at + 1] === 0xE0 || b[at + 1] === 0xE1)) {
      at += 2 + ((b[at + 2] << 8) | b[at + 3]);
    }
    const extra = segs.reduce((n, s) => n + s.length, 0);
    const out = new Uint8Array(b.length + extra);
    out.set(b.subarray(0, at), 0);
    let o = at;
    for (const s of segs) { out.set(s, o); o += s.length; }
    out.set(b.subarray(at), o);
    return out;
  } catch {
    return b;
  }
}

// SVG: <title>/<desc> + a Dublin-Core <metadata> block, injected right after the
// opening <svg> tag of the serialized markup (avoids DOM-namespace gymnastics).
function svgMetaBlock(meta) {
  const lines = [];
  if (meta.tool) lines.push(`<title>${xmlEsc(meta.tool)}</title>`);
  const desc = [meta.description, meta.contact].filter(Boolean).join(' · ');
  if (desc) lines.push(`<desc>${xmlEsc(desc)}</desc>`);
  lines.push(
    '<metadata>',
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '<rdf:Description rdf:about="">',
  );
  if (meta.author) lines.push(`<dc:creator>${xmlEsc(meta.author)}</dc:creator>`);
  lines.push(`<dc:publisher>${xmlEsc(meta.software)}</dc:publisher>`);
  lines.push(`<dc:source>${xmlEsc(meta.source)}</dc:source>`, '</rdf:Description>', '</rdf:RDF>', '</metadata>');
  return lines.join('\n');
}

function injectSvgMeta(xml, meta) {
  if (!meta) return xml;
  const m = xml.match(/<svg\b[^>]*?>/);
  if (!m) return xml;
  const at = m.index + m[0].length;
  return xml.slice(0, at) + '\n' + svgMetaBlock(meta) + xml.slice(at);
}

// GIF: a Comment Extension (0x21 0xFE …) inserted right after the header + LSD +
// global colour table, before the first frame.
function withGifComment(bytes, text) {
  if (!text || bytes.length < 13) return bytes;
  const packed = bytes[10];
  const gctSize = (packed & 0x80) ? 3 * (1 << ((packed & 0x07) + 1)) : 0;
  const at = 13 + gctSize;
  const txt = new TextEncoder().encode(text);
  const subs = [];
  for (let i = 0; i < txt.length; i += 255) {
    const chunk = txt.subarray(i, i + 255);
    subs.push(chunk.length, ...chunk);
  }
  const ext = new Uint8Array(2 + subs.length + 1);
  ext[0] = 0x21; ext[1] = 0xFE; ext.set(subs, 2); ext[ext.length - 1] = 0x00;
  const out = new Uint8Array(bytes.length + ext.length);
  out.set(bytes.subarray(0, at), 0);
  out.set(ext, at);
  out.set(bytes.subarray(at), at + ext.length);
  return out;
}

async function renderSvg(node, opts = {}) {
  if (!isSvgRooted(node)) return renderSvgFromHtml(node, opts);
  const svg = node.tagName?.toLowerCase() === 'svg' ? node : node.querySelector('svg');
  const clone = svg.cloneNode(true);
  // Apply the requested size in its native unit (e.g. "210mm") — SVG is
  // resolution-independent. Ensure a viewBox so the original coordinates scale
  // into the new physical size.
  const d = exportDims(node, opts);
  if (parseDimension(opts.width) || parseDimension(opts.height)) {
    if (!clone.getAttribute('viewBox')) {
      const ow = svg.getBoundingClientRect();
      clone.setAttribute('viewBox', `0 0 ${ow.width || d.node.w} ${ow.height || d.node.h}`);
    }
    clone.setAttribute('width', toCssLength(d.w));
    clone.setAttribute('height', toCssLength(d.h));
  }
  await inlineBlobUrlsInEl(clone);
  const xml = injectSvgMeta(new XMLSerializer().serializeToString(clone), opts.meta);
  return new Blob(['<?xml version="1.0" standalone="no"?>\n' + xml], { type: 'image/svg+xml' });
}

// ── EMF (Enhanced Metafile) — vector, always text-as-paths ──────────────────
//
// EMF is a third sink on the SVG vector pipeline (alongside SVG and PDF): obtain
// an SVG whose text is already outlined — the tool's own <svg>, or an outlined
// SVG synthesised from an HTML layout via renderSvgFromHtml — walk it into the
// engine IR (svgDomToIr), and serialize to bytes (emitEmf). Device RGB only;
// gradients/images/alpha are flattened to solids upstream. See
// plans/emf-support.md. The text-as-paths guarantee is enforced in svgDomToIr,
// which throws on any run it can't vectorise rather than dropping it.
async function renderEmf(node, opts = {}) {
  let svgEl = node.tagName?.toLowerCase() === 'svg' ? node : node.querySelector?.('svg');
  if (!svgEl) {
    // HTML-layout tool with no inline <svg>: synthesise an outlined SVG first.
    const svgBlob = await renderSvgFromHtml(node, { ...opts, convertPaths: true });
    const xml = await svgBlob.text();
    svgEl = new DOMParser().parseFromString(xml, 'image/svg+xml').documentElement;
  }
  const ir = await svgDomToIr(svgEl, {
    host: _host,
    getComputedStyle: (el) => window.getComputedStyle(el),
    background: opts.background,
  });
  const bytes = emitEmf(ir, { width: opts.width, height: opts.height, unit: opts.unit, dpi: opts.dpi });
  return new Blob([bytes], { type: 'image/emf' });
}

// ── SVG from HTML DOM ─────────────────────────────────────────────────────
//
// Decomposes the live DOM into SVG primitives. Mirrors drawHtmlVectors (the
// PDF DOM walker) in structure; changes to one should be reflected in the other.
//
// Tools whose canvas IS an SVG element (lockup, qr-code) use the fast-path
// clone in renderSvg above. This path handles all HTML-DOM tools.

function isSvgRooted(node) {
  if (node.tagName?.toLowerCase() === 'svg') return true;
  for (const child of node.children) {
    const t = child.tagName.toLowerCase();
    if (t === 'style' || t === 'script') continue;
    return t === 'svg';
  }
  return false;
}

async function renderSvgFromHtml(node, opts) {
  const NS = 'http://www.w3.org/2000/svg';
  // Text → vector <path> by default (self-contained, font-independent SVG). The
  // 'Convert paths' export toggle (opts.convertPaths) turns this off, falling back
  // to <text> elements everywhere for selectable, editable output.
  const vectorText = opts.convertPaths !== false;
  const { width: nodeW, height: nodeH } = node.getBoundingClientRect();
  const d = exportDims(node, opts);
  // viewBox lives in CSS px (physical units at 96dpi); the width/height carry
  // the real unit so the SVG renders at the correct physical size.
  const vbW = toCssPx(d.w);
  const vbH = toCssPx(d.h);
  const scaleX  = vbW / nodeW;
  const scaleY  = vbH / nodeH;

  const svgEl = document.createElementNS(NS, 'svg');
  svgEl.setAttribute('xmlns',   NS);
  svgEl.setAttribute('width',   toCssLength(d.w));
  svgEl.setAttribute('height',  toCssLength(d.h));
  svgEl.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);

  const defs     = document.createElementNS(NS, 'defs');
  svgEl.appendChild(defs);

  const rootRect = node.getBoundingClientRect();
  let uid = 0;

  const rootG = document.createElementNS(NS, 'g');
  if (Math.abs(scaleX - 1) > 1e-4 || Math.abs(scaleY - 1) > 1e-4) {
    rootG.setAttribute('transform', `scale(${scaleX.toFixed(6)},${scaleY.toFixed(6)})`);
  }
  svgEl.appendChild(rootG);

  async function visitSvgNode(el, parentG) {
    if (el.nodeType !== 1) return;
    const tag = el.tagName.toLowerCase();
    if (tag === 'style' || tag === 'script') return;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    const opacity = parseFloat(style.opacity ?? '1');
    if (opacity === 0) return;

    const rect = el.getBoundingClientRect();
    if (rect.width < 0.5 || rect.height < 0.5) return;

    const x = rect.left - rootRect.left;
    const y = rect.top  - rootRect.top;
    const w = rect.width;
    const h = rect.height;

    const g = document.createElementNS(NS, 'g');
    if (opacity < 0.999) g.setAttribute('opacity', opacity.toFixed(4));
    parentG.appendChild(g);

    // ── Border radius ───────────────────────────────────────────────────────
    const rx = Math.max(
      parseCssLen(style.borderTopLeftRadius,     w),
      parseCssLen(style.borderTopRightRadius,    w),
      parseCssLen(style.borderBottomLeftRadius,  w),
      parseCssLen(style.borderBottomRightRadius, w),
    );

    // ── Background ──────────────────────────────────────────────────────────
    const bgImg = style.backgroundImage;
    if (bgImg && bgImg !== 'none') {
      const gradEl = buildLinearGradientEl(NS, bgImg, x, y, w, h, ++uid);
      if (gradEl) {
        defs.appendChild(gradEl);
        g.appendChild(makeSvgRect(NS, x, y, w, h, rx, `url(#svggrad-${uid})`));
      }
    } else {
      const bgRgb = parseCssColorFull(style.backgroundColor);
      if (bgRgb) {
        const fill = bgRgb[3] < 1
          ? `rgba(${bgRgb[0]},${bgRgb[1]},${bgRgb[2]},${bgRgb[3]})`
          : `rgb(${bgRgb[0]},${bgRgb[1]},${bgRgb[2]})`;
        g.appendChild(makeSvgRect(NS, x, y, w, h, rx, fill));
      }
    }

    // ── Borders ─────────────────────────────────────────────────────────────
    // Mirror the PDF walker: a uniform border becomes one stroked <rect> (radius
    // honoured); a divider (border-top only) or mixed border fills per edge.
    const bSide = (wKey, cKey) => {
      const bw = parseFloat(style[wKey]) || 0;
      return { bw, rgb: bw > 0 ? parseCssColor(style[cKey]) : null };
    };
    const bT = bSide('borderTopWidth',    'borderTopColor');
    const bR = bSide('borderRightWidth',  'borderRightColor');
    const bB = bSide('borderBottomWidth', 'borderBottomColor');
    const bL = bSide('borderLeftWidth',   'borderLeftColor');
    const eqRgb = (a, b) => a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    const rgbStr = c => `rgb(${c[0]},${c[1]},${c[2]})`;
    const uniformBorder = bT.rgb && bT.bw === bR.bw && bT.bw === bB.bw && bT.bw === bL.bw
      && eqRgb(bT.rgb, bR.rgb) && eqRgb(bT.rgb, bB.rgb) && eqRgb(bT.rgb, bL.rgb);
    if (uniformBorder) {
      const lw = bT.bw;
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', String(x + lw / 2));
      r.setAttribute('y', String(y + lw / 2));
      r.setAttribute('width',  String(Math.max(0, w - lw)));
      r.setAttribute('height', String(Math.max(0, h - lw)));
      if (rx > 0) r.setAttribute('rx', String(Math.max(0, rx - lw / 2)));
      r.setAttribute('fill', 'none');
      r.setAttribute('stroke', rgbStr(bT.rgb));
      r.setAttribute('stroke-width', String(lw));
      g.appendChild(r);
    } else {
      if (bT.rgb) g.appendChild(makeSvgRect(NS, x, y, w, bT.bw, 0, rgbStr(bT.rgb)));
      if (bB.rgb) g.appendChild(makeSvgRect(NS, x, y + h - bB.bw, w, bB.bw, 0, rgbStr(bB.rgb)));
      if (bL.rgb) g.appendChild(makeSvgRect(NS, x, y, bL.bw, h, 0, rgbStr(bL.rgb)));
      if (bR.rgb) g.appendChild(makeSvgRect(NS, x + w - bR.bw, y, bR.bw, h, 0, rgbStr(bR.rgb)));
    }

    // ── Inline SVG passthrough ──────────────────────────────────────────────
    if (tag === 'svg') {
      const clone = el.cloneNode(true);
      clone.setAttribute('x',      String(x));
      clone.setAttribute('y',      String(y));
      clone.setAttribute('width',  String(w));
      clone.setAttribute('height', String(h));
      await inlineBlobUrlsInEl(clone);
      g.appendChild(clone);
      return;
    }

    // ── Image (SVG source → inline vector; bitmap → raster <image>) ───────────
    if (tag === 'img') {
      const src = el.src || el.getAttribute('src') || '';
      if (src && w > 0 && h > 0) {
        // SVG sources stay VECTOR — inline them as a nested <svg>, fitted "meet"
        // (object-fit: contain), instead of a raster <image>. SVG-ness is sniffed
        // from the bytes (asset URLs are blob: with no extension/MIME hint). Mirrors
        // the PDF walker; real bitmaps fall through to the <image> path below.
        let inlineSvg = null;
        try { inlineSvg = await inlineSvgFromImg(src); } catch { inlineSvg = null; }
        if (inlineSvg) {
          await inlineBlobUrlsInEl(inlineSvg);
          // Nested-<svg> scaling needs a viewBox; synthesise one from width/height
          // if the source omitted it, so the mark still fits its box.
          if (!inlineSvg.getAttribute('viewBox')) {
            const iw = parseFloat(inlineSvg.getAttribute('width'));
            const ih = parseFloat(inlineSvg.getAttribute('height'));
            if (iw > 0 && ih > 0) inlineSvg.setAttribute('viewBox', `0 0 ${iw} ${ih}`);
          }
          inlineSvg.setAttribute('x',      String(x));
          inlineSvg.setAttribute('y',      String(y));
          inlineSvg.setAttribute('width',  String(w));
          inlineSvg.setAttribute('height', String(h));
          if (!inlineSvg.getAttribute('preserveAspectRatio')) {
            inlineSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          }
          g.appendChild(inlineSvg);
          return;
        }
        try {
          const dataUrl = src.startsWith('data:') ? src
            : src.startsWith('blob:') ? await blobToDataUrl(src) : src;
          const rMin = Math.min(
            parseCssLen(style.borderTopLeftRadius,     w),
            parseCssLen(style.borderTopRightRadius,    w),
            parseCssLen(style.borderBottomLeftRadius,  w),
            parseCssLen(style.borderBottomRightRadius, w),
          );
          const isCircle = rMin >= Math.min(w, h) * 0.45;
          const img = document.createElementNS(NS, 'image');
          img.setAttribute('href',   dataUrl);
          img.setAttribute('x',      String(x));
          img.setAttribute('y',      String(y));
          img.setAttribute('width',  String(w));
          img.setAttribute('height', String(h));
          if (isCircle) {
            const clipId = `imgclip-${++uid}`;
            const cp = document.createElementNS(NS, 'clipPath');
            cp.setAttribute('id', clipId);
            const circle = document.createElementNS(NS, 'circle');
            circle.setAttribute('cx', String(x + w / 2));
            circle.setAttribute('cy', String(y + h / 2));
            circle.setAttribute('r',  String(Math.min(w, h) / 2));
            cp.appendChild(circle);
            defs.appendChild(cp);
            img.setAttribute('clip-path',           `url(#${clipId})`);
            img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
          }
          g.appendChild(img);
        } catch { /* skip unloadable images */ }
      }
      return;
    }

    // ── Recurse block-level children ────────────────────────────────────────
    for (const child of el.children) {
      const cd = window.getComputedStyle(child).display;
      if (cd !== 'inline' && cd !== 'inline-block' && cd !== 'inline-flex') {
        await visitSvgNode(child, g);
      }
    }

    // ── Inline text ─────────────────────────────────────────────────────────
    await emitInlineTextSvg(NS, el, style, rootRect, g, vectorText);

    // ── CSS generated content (::before/::after markers) ──────────────────────
    await svgPseudoContent(NS, g, rootRect, el, vectorText);
  }

  await visitSvgNode(node, rootG);
  const xml = injectSvgMeta(new XMLSerializer().serializeToString(svgEl), opts.meta);
  return new Blob(['<?xml version="1.0" standalone="no"?>\n' + xml], { type: 'image/svg+xml' });
}

// Walks text nodes and inline elements, emitting one node per text line.
//
// By default each line becomes a true vector <path> (host.text.toPath, HarfBuzz
// shaped) so the SVG is self-contained and renders identically without the font
// installed — no bitmap, no <foreignObject>. Runs we can't vectorise faithfully
// (non-SUSE font, no host.text, letter-spacing) fall back to a positioned <text>
// element. Line positions come from Range.getBoundingClientRect, same strategy as
// renderInlineContent for PDF.
async function emitInlineTextSvg(NS, blockEl, blockStyle, rootRect, parentG, vectorText) {
  const textApi = vectorText ? _host?.text : null;

  async function walk(node, nodeStyle) {
    if (node.nodeType === 3) {
      const text = node.textContent;
      if (!text || !text.trim()) return;
      const col = parseCssColorFull(nodeStyle.color);
      const fillAttr  = col ? `rgb(${col[0]},${col[1]},${col[2]})` : null;
      const alphaAttr = col && col[3] < 1 ? String(col[3]) : null;
      const fontSizePx = parseFloat(nodeStyle.fontSize) || 16;
      const fontUrl = resolveSuseFontUrl(nodeStyle);
      const vectorise = canVectoriseText(nodeStyle, fontUrl, Boolean(textApi));

      // Emit one run, positioned at its own line box `r`. Used per visual line.
      const placeLine = async (lineText, r) => {
        const x = r.left - rootRect.left;
        const top = r.top - rootRect.top;
        if (vectorise) {
          try {
            const { d } = await textApi.toPath({ text: lineText, fontUrl, fontSize: fontSizePx });
            if (d) {
              const { ascent, descent } = fontMetricsPx(nodeStyle, fontSizePx);
              const by = textBaselineY(top, r.height, ascent, descent);
              const p = document.createElementNS(NS, 'path');
              p.setAttribute('d', d);
              p.setAttribute('transform', `translate(${n2(x)},${n2(by)})`);
              if (fillAttr)  p.setAttribute('fill', fillAttr);
              if (alphaAttr) p.setAttribute('fill-opacity', alphaAttr);
              parentG.appendChild(p);
              return;
            }
          } catch (e) {
            _host?.log?.('warn', `svg: text-to-path failed, using <text> — ${e.message}`);
          }
        }
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x',                 String(n2(x)));
        t.setAttribute('y',                 String(n2(top)));
        t.setAttribute('dominant-baseline', 'text-before-edge');
        t.setAttribute('font-size',         nodeStyle.fontSize);
        t.setAttribute('font-weight',       nodeStyle.fontWeight);
        t.setAttribute('font-style',        nodeStyle.fontStyle);
        t.setAttribute('font-family',       nodeStyle.fontFamily);
        if (nodeStyle.letterSpacing && nodeStyle.letterSpacing !== 'normal') {
          t.setAttribute('letter-spacing', nodeStyle.letterSpacing);
        }
        if (fillAttr)  t.setAttribute('fill',         fillAttr);
        if (alphaAttr) t.setAttribute('fill-opacity', alphaAttr);
        t.textContent = lineText;
        parentG.appendChild(t);
      };

      // Split on explicit newlines first, then on soft wraps within each segment
      // (CSS-wrapped text has no '\n'). Each visual line is shaped and placed on
      // its own baseline; without this a wrapped run collapses onto one line.
      const segs = text.split('\n');
      let offset = 0;
      for (const seg of segs) {
        if (seg.trim().length > 0) {
          for (const line of visualLines(node, offset, offset + seg.length)) {
            if (line.rect.width > 0.5 && line.rect.height > 0.5) {
              await placeLine(line.text, line.rect);
            }
          }
        }
        offset += seg.length + 1; // +1 for the '\n'
      }

    } else if (node.nodeType === 1) {
      if (node.tagName.toLowerCase() === 'br') return;
      const s = window.getComputedStyle(node);
      if (s.display === 'none') return;
      if (s.display !== 'inline' && s.display !== 'inline-block' && s.display !== 'inline-flex') return;
      for (const child of node.childNodes) await walk(child, s);
    }
  }
  for (const child of blockEl.childNodes) await walk(child, blockStyle);
}

// Round to 2dp — keeps emitted path transforms compact (toPath already rounds d).
function n2(v) { return Math.round(v * 100) / 100; }

// Split a text node's [start,end) offset range into visual lines, so CSS soft
// wrapping (which inserts no '\n') is honoured. We walk characters and start a
// new line whenever a glyph's top jumps; each line's edge whitespace is trimmed
// so its rect.left aligns with the first rendered glyph (collapsed leading spaces
// would otherwise shift the shaped run). Returns [{ text, rect }] per line.
function visualLines(node, start, end) {
  const probe = document.createRange();
  const breaks = [start];
  let prevTop = null;
  for (let i = start; i < end; i++) {
    probe.setStart(node, i);
    probe.setEnd(node, i + 1);
    const rects = probe.getClientRects();
    if (!rects.length) continue; // collapsed whitespace contributes no box
    const top = rects[rects.length - 1].top;
    if (prevTop === null) prevTop = top;
    else if (Math.abs(top - prevTop) > 0.5) { breaks.push(i); prevTop = top; }
  }
  breaks.push(end);

  const full = node.textContent;
  const out = [];
  for (let k = 0; k + 1 < breaks.length; k++) {
    let s = breaks[k], e = breaks[k + 1];
    const slice = full.slice(s, e);
    s += slice.length - slice.replace(/^\s+/, '').length; // drop leading ws
    e -= slice.length - slice.replace(/\s+$/, '').length; // drop trailing ws
    if (e <= s) continue;
    probe.setStart(node, s);
    probe.setEnd(node, e);
    out.push({ text: full.slice(s, e), rect: probe.getBoundingClientRect() });
  }
  return out;
}

// Font ascent/descent in px for a computed style, via a reused canvas 2D context.
// fontBoundingBox* are font-level (sample text doesn't matter); the actualBounding
// and ratio fallbacks cover the rare engine without the fontBoundingBox metrics.
let _measureCtx = null;
function fontMetricsPx(style, fontSizePx) {
  if (!_measureCtx) _measureCtx = document.createElement('canvas').getContext('2d');
  _measureCtx.font =
    `${style.fontStyle || 'normal'} ${style.fontWeight || 400} ${fontSizePx}px ${style.fontFamily || 'sans-serif'}`;
  const m = _measureCtx.measureText('Mg');
  const ascent  = m.fontBoundingBoxAscent  ?? m.actualBoundingBoxAscent  ?? fontSizePx * 0.8;
  const descent = m.fontBoundingBoxDescent ?? m.actualBoundingBoxDescent ?? fontSizePx * 0.2;
  return { ascent, descent };
}

// Resolve a CSS generated-content pseudo-element (::before/::after) into a drawable
// descriptor, or null if it has nothing visible. The DOM walkers only see real
// nodes, so list markers / arrows authored as ::before content (e.g. dynamic-layout's
// bullet dots and → arrows) are otherwise dropped from SVG/PDF. Scoped to the
// absolutely-positioned marker idiom — a pseudo has no getBoundingClientRect, so its
// box is computed from its containing block (nearest positioned ancestor) padding box
// + the pseudo's own left/top/size. Inline/static generated content isn't modelled.
function pseudoDescriptor(el, name) {
  const ps = window.getComputedStyle(el, name);
  const content = ps.content;
  if (!content || content === 'none' || content === 'normal') return null;
  if (ps.position !== 'absolute') return null;
  const w = parseFloat(ps.width)  || 0;
  const h = parseFloat(ps.height) || 0;
  const bg = parseCssColorFull(ps.backgroundColor);
  // getComputedStyle returns the resolved string with real chars (e.g. '"→"'),
  // already quoted; unwrap it. counter()/attr() values won't match and are skipped.
  const m = content.match(/^["'](.*)["']$/s);
  const text = m ? m[1] : '';
  if (!text.trim() && !(bg && w > 0.5 && h > 0.5)) return null;

  let cb = el;
  while (cb && window.getComputedStyle(cb).position === 'static') cb = cb.parentElement;
  cb = cb || el;
  const cbRect = cb.getBoundingClientRect();
  const cbStyle = window.getComputedStyle(cb);
  const ox = cbRect.left + (parseFloat(cbStyle.paddingLeft) || 0);
  const oy = cbRect.top  + (parseFloat(cbStyle.paddingTop)  || 0);
  const left = parseFloat(ps.left);
  const top  = parseFloat(ps.top);
  const rx = Math.max(
    parseCssLen(ps.borderTopLeftRadius,     w), parseCssLen(ps.borderTopRightRadius,    w),
    parseCssLen(ps.borderBottomLeftRadius,  w), parseCssLen(ps.borderBottomRightRadius, w),
  );
  return {
    text, bg, rx, w, h, ps,
    x: ox + (isFinite(left) ? left : 0),
    y: oy + (isFinite(top)  ? top  : 0),
  };
}

// Emit any ::before/::after markers of `el` into the SVG group `parentG`.
async function svgPseudoContent(NS, parentG, rootRect, el, vectorText) {
  for (const name of ['::before', '::after']) {
    const ds = pseudoDescriptor(el, name);
    if (!ds) continue;
    const x = ds.x - rootRect.left;
    const y = ds.y - rootRect.top;
    if (ds.bg && ds.w > 0.5 && ds.h > 0.5) {
      const f = ds.bg[3] < 1
        ? `rgba(${ds.bg[0]},${ds.bg[1]},${ds.bg[2]},${ds.bg[3]})`
        : `rgb(${ds.bg[0]},${ds.bg[1]},${ds.bg[2]})`;
      parentG.appendChild(makeSvgRect(NS, x, y, ds.w, ds.h, ds.rx, f));
    }
    if (!ds.text.trim()) continue;
    const fontSizePx = parseFloat(ds.ps.fontSize) || 16;
    const fontUrl = resolveSuseFontUrl(ds.ps);
    const col = parseCssColorFull(ds.ps.color);
    const fillAttr  = col ? `rgb(${col[0]},${col[1]},${col[2]})` : null;
    const alphaAttr = col && col[3] < 1 ? String(col[3]) : null;
    const lineH = parseFloat(ds.ps.lineHeight) || fontSizePx * 1.2;
    let placed = false;
    if (vectorText && canVectoriseText(ds.ps, fontUrl, Boolean(_host?.text))) {
      try {
        const { d } = await _host.text.toPath({ text: ds.text, fontUrl, fontSize: fontSizePx });
        if (d) {
          const { ascent, descent } = fontMetricsPx(ds.ps, fontSizePx);
          const by = textBaselineY(y, lineH, ascent, descent);
          const p = document.createElementNS(NS, 'path');
          p.setAttribute('d', d);
          p.setAttribute('transform', `translate(${n2(x)},${n2(by)})`);
          if (fillAttr)  p.setAttribute('fill', fillAttr);
          if (alphaAttr) p.setAttribute('fill-opacity', alphaAttr);
          parentG.appendChild(p);
          placed = true;
        }
      } catch (e) { _host?.log?.('warn', `svg: pseudo text-to-path failed — ${e.message}`); }
    }
    if (!placed) {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('x',                 String(n2(x)));
      t.setAttribute('y',                 String(n2(y)));
      t.setAttribute('dominant-baseline', 'text-before-edge');
      t.setAttribute('font-size',         ds.ps.fontSize);
      t.setAttribute('font-weight',       ds.ps.fontWeight);
      t.setAttribute('font-style',        ds.ps.fontStyle);
      t.setAttribute('font-family',       ds.ps.fontFamily);
      if (fillAttr)  t.setAttribute('fill',         fillAttr);
      if (alphaAttr) t.setAttribute('fill-opacity', alphaAttr);
      t.textContent = ds.text;
      parentG.appendChild(t);
    }
  }
}

function makeSvgRect(NS, x, y, w, h, rx, fill) {
  const r = document.createElementNS(NS, 'rect');
  r.setAttribute('x',      String(x));
  r.setAttribute('y',      String(y));
  r.setAttribute('width',  String(w));
  r.setAttribute('height', String(h));
  if (rx > 0) { r.setAttribute('rx', String(rx)); r.setAttribute('ry', String(rx)); }
  r.setAttribute('fill', fill);
  return r;
}

// Builds a <linearGradient> SVG element from a CSS linear-gradient() value.
// Uses gradientUnits="userSpaceOnUse" so coordinates match the canvas space.
// Returns null if the value is not a parseable linear gradient.
function buildLinearGradientEl(NS, bgImage, elX, elY, elW, elH, uid) {
  const m = bgImage.match(/^linear-gradient\((.+)\)$/s);
  if (!m) return null;
  const parts = splitCssArgs(m[1]);
  if (parts.length < 2) return null;

  let angleRad = Math.PI; // default: to bottom
  let stopsStart = 0;
  const first = parts[0].trim();
  if (/^to\s|deg$|turn$|rad$|grad$/.test(first)) {
    angleRad  = parseGradientAngle(first);
    stopsStart = 1;
  }

  const stops = parts.slice(stopsStart);
  if (stops.length < 2) return null;

  // Gradient line through the element centre; length guarantees full coverage
  // at any angle via: |w·sin(A)| + |h·cos(A)| / 2.
  const sinA = Math.sin(angleRad);
  const cosA = Math.cos(angleRad);
  const cx   = elX + elW / 2;
  const cy   = elY + elH / 2;
  const len  = (Math.abs(elW * sinA) + Math.abs(elH * cosA)) / 2;

  const grad = document.createElementNS(NS, 'linearGradient');
  grad.setAttribute('id',            `svggrad-${uid}`);
  grad.setAttribute('gradientUnits', 'userSpaceOnUse');
  grad.setAttribute('x1', String(cx - sinA * len));
  grad.setAttribute('y1', String(cy + cosA * len));
  grad.setAttribute('x2', String(cx + sinA * len));
  grad.setAttribute('y2', String(cy - cosA * len));

  const n = stops.length;
  stops.forEach((raw, i) => {
    const { colorStr, opacity, offset } = parseGradientStop(raw.trim(), i, n);
    if (!colorStr) return;
    const s = document.createElementNS(NS, 'stop');
    s.setAttribute('offset',     offset);
    s.setAttribute('stop-color', colorStr);
    if (opacity < 1) s.setAttribute('stop-opacity', String(opacity));
    grad.appendChild(s);
  });

  return grad.childNodes.length >= 2 ? grad : null;
}

// Splits a CSS argument string on top-level commas, respecting nested parens.
function splitCssArgs(str) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i < str.length; i++) {
    if      (str[i] === '(') depth++;
    else if (str[i] === ')') depth--;
    else if (str[i] === ',' && depth === 0) {
      parts.push(str.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(str.slice(start).trim());
  return parts;
}

// Converts a CSS gradient angle token to radians (SVG y-down convention).
function parseGradientAngle(token) {
  const t = token.trim().toLowerCase();
  if (t === 'to top')          return 0;
  if (t === 'to top right')    return Math.PI * 0.25;
  if (t === 'to right')        return Math.PI * 0.5;
  if (t === 'to bottom right') return Math.PI * 0.75;
  if (t === 'to bottom')       return Math.PI;
  if (t === 'to bottom left')  return Math.PI * 1.25;
  if (t === 'to left')         return Math.PI * 1.5;
  if (t === 'to top left')     return Math.PI * 1.75;
  if (t.endsWith('deg'))  return parseFloat(t) * Math.PI / 180;
  if (t.endsWith('turn')) return parseFloat(t) * 2 * Math.PI;
  if (t.endsWith('rad'))  return parseFloat(t);
  if (t.endsWith('grad')) return parseFloat(t) * Math.PI / 200;
  return Math.PI;
}

// Parses one gradient colour-stop into { colorStr, opacity, offset }.
// Supports hex, rgb/rgba, and "transparent". Named colours return colorStr: null.
function parseGradientStop(raw, index, total) {
  const parts   = splitCssArgs(raw);
  const last    = parts[parts.length - 1].trim();
  const hasPos  = /^[\d.]+(px|%)$/.test(last);
  const colorRaw = (hasPos && parts.length > 1 ? parts.slice(0, -1) : parts).join(',').trim().toLowerCase();
  const offset  = hasPos
    ? (last.endsWith('%') ? last : parseFloat(last) + 'px')
    : `${((index / Math.max(total - 1, 1)) * 100).toFixed(2)}%`;

  if (colorRaw === 'transparent') return { colorStr: 'rgba(0,0,0,0)', opacity: 0, offset };
  if (colorRaw.startsWith('#'))   return { colorStr: colorRaw, opacity: 1, offset };
  if (colorRaw.startsWith('rgb')) {
    const am = colorRaw.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);
    return { colorStr: colorRaw, opacity: am ? parseFloat(am[1]) : 1, offset };
  }
  return { colorStr: null, opacity: 1, offset };
}

// Returns an averaged [r,g,b] sample of a linear-gradient's first and last
// stops. Used by drawHtmlVectors as an approximation for PDF output.
function sampleGradientMidpoint(bgImage) {
  const m = bgImage.match(/^linear-gradient\((.+)\)$/s);
  if (!m) return null;
  const parts = splitCssArgs(m[1]);
  let start = 0;
  if (parts[0] && /^to\s|deg$|turn$|rad$|grad$/.test(parts[0].trim())) start = 1;
  const stops = parts.slice(start).filter(Boolean);
  if (!stops.length) return null;
  const c1 = gradStopToRgb(stops[0].trim(), 0, stops.length);
  const c2 = gradStopToRgb(stops[stops.length - 1].trim(), stops.length - 1, stops.length);
  if (!c1 && !c2) return null;
  if (!c1) return c2;
  if (!c2) return c1;
  return [
    Math.round((c1[0] + c2[0]) / 2),
    Math.round((c1[1] + c2[1]) / 2),
    Math.round((c1[2] + c2[2]) / 2),
  ];
}

function gradStopToRgb(raw, index, total) {
  const { colorStr } = parseGradientStop(raw, index, total);
  if (!colorStr) return null;
  const s = colorStr.trim().toLowerCase();
  if (s.startsWith('#')) {
    const h = s.slice(1);
    if (h.length === 3) return [parseInt(h[0]+h[0],16), parseInt(h[1]+h[1],16), parseInt(h[2]+h[2],16)];
    if (h.length === 6) return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }
  const mm = s.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/);
  if (mm) return [+mm[1], +mm[2], +mm[3]];
  return null;
}

// Like parseCssColor but preserves the alpha channel as a 4th element [r,g,b,a].
// Returns null for fully transparent colours.
function parseCssColorFull(cssColor) {
  if (!cssColor || cssColor === 'transparent') return null;
  const m = cssColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
  if (a === 0) return null;
  return [+m[1], +m[2], +m[3], a];
}

// Resolve the print-marks geometry for a PDF export, or null when no bleed and
// no marks are requested (the legacy "page == trim, art fills it" path). The
// geometry (page boxes + mark primitives, in points, top-left origin) is the
// engine's single source of truth — see engine/src/print-marks.js.
function printGeometry(node, opts, paletteSource = opts.palette) {
  const bleedDim = parseDimension(opts.bleed);
  const bleedPt = bleedDim ? toPoints(bleedDim) : 0;
  const marks = {
    crop:         Boolean(opts.cropMarks),
    registration: Boolean(opts.registrationMarks),
    bleed:        Boolean(opts.bleedMarks),
    colorBars:    Boolean(opts.colorBars),
    provenance:   Boolean(opts.provenance),
  };
  const anyMark = marks.crop || marks.registration || marks.bleed || marks.colorBars || marks.provenance;
  if (bleedPt <= 0 && !anyMark) return null;
  const d = exportDims(node, opts);
  // Brand swatches drive the verification half of the colour bar (RGB reference
  // beside CMYK substitution). The CMYK PDF passes only the inks that actually
  // substituted (see renderCmykPdf); the plain RGB PDF has no palette and gets
  // the generic process/overprint/tint bar.
  const palette = marks.colorBars ? brandSwatchPalette(paletteSource) : [];
  return computePrintGeometry({ trimWpt: toPoints(d.w), trimHpt: toPoints(d.h), bleedPt, marks, palette });
}

// Normalise the shell's brand palette (hex + CMYK 0–100) into the engine's
// colour-bar form: { rgb, cmyk } both 0–1, plus a label. Only entries with a
// declared CMYK substitution qualify (the others fall back to generic RGB→CMYK
// at render time and so have nothing to verify). Deduped by hex+ink, since the
// palette repeats Black/White as ramp endpoints; order is preserved so the
// primary brand hues lead and survive the flat cell cap.
function brandSwatchPalette(palette) {
  const out = [], seen = new Set();
  for (const { hex, cmyk, label } of palette ?? []) {
    if (!hex || !cmyk || cmyk.length !== 4) continue;
    const h = hex.replace('#', '').toLowerCase();
    if (h.length !== 6) continue;                         // skips 'transparent' etc.
    const key = `${h}:${cmyk.join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    out.push({ rgb: [r, g, b], cmyk: cmyk.map(v => v / 100), label });
  }
  return out;
}

// Render the artwork to a jsPDF blob. Without geometry the page is the trim size
// and the design fills it (unchanged legacy behaviour, incl. optional jsPDF
// encryption). With geometry the page is the full sheet and the design is drawn
// (scaled) into the bleed box; page boxes + marks are added later in pdf-lib.
async function renderArtworkPdf(node, opts, geo) {
  const mod = await import('jspdf');
  const jsPDF = mod.jsPDF ?? mod.default?.jsPDF ?? mod.default;

  // Page size in points (1/72"). Physical units convert exactly; px maps via
  // the CSS 96-DPI convention, preserving existing pixel-based tools.
  const d = exportDims(node, opts);
  const trimW = toPoints(d.w);
  const trimH = toPoints(d.h);
  const pageW = geo ? geo.page.w : trimW;
  const pageH = geo ? geo.page.h : trimH;
  const art   = geo ? geo.artwork : { x: 0, y: 0, w: trimW, h: trimH };

  // orientation must be derived from the actual dimensions — jsPDF's default
  // 'portrait' mode swaps format[0] and format[1] when width > height, which
  // would produce an inverted page with all drawHtmlVectors coordinates wrong.
  const orientation = pageW >= pageH ? 'landscape' : 'portrait';

  // A non-empty opts.password locks the PDF on open via jsPDF's standard security
  // handler (user = owner password; printing-only permissions). Only the plain
  // RGB path with NO print finishing encrypts — print marks/boxes are applied in
  // pdf-lib, which can't write encrypted PDFs, so the two are mutually exclusive
  // (the UI hides the password field when marks/bleed are on). `undefined` is a
  // no-op (jsPDF treats it as unencrypted).
  const encryption = (opts.password && !geo)
    ? { userPassword: opts.password, ownerPassword: opts.password, userPermissions: ['print'] }
    : undefined;
  const pdf = new jsPDF({ unit: 'pt', format: [pageW, pageH], orientation, encryption });
  const m = opts.meta;
  const creator = m?.software || 'Lolly';
  pdf.setProperties({
    creator,                               // the producing app always
    author: m?.author || creator,          // the user if known, else the app
    title: m?.tool || undefined,
    subject: m?.description || undefined,
    keywords: m ? [m.software, m.source, m.contact].filter(Boolean).join(', ') : undefined,
  });

  // SVG-rooted canvas (the node IS an <svg>, or its only meaningful child is) →
  // walk the SVG element directly as vectors. This avoids drawHtmlVectors, which
  // skips SVG elements that have `display:inline` (the HTML default), resulting
  // in a blank page for tools like the QR code generator whose template is just
  // a bare <svg> with no explicit display:block.
  const svgRoot = node.tagName?.toLowerCase() === 'svg' ? node
    : isSvgRooted(node) ? node.querySelector('svg') : null;
  if (svgRoot) {
    await drawSvgVectorsInRegion(pdf, svgRoot, art.x, art.y, art.w, art.h, new Set());
  } else {
    await drawHtmlVectors(pdf, node, art.x, art.y, art.w, art.h, opts.convertPaths !== false);
  }

  return pdf.output('blob');
}

async function renderPdf(node, opts) {
  const geo = printGeometry(node, opts);
  const artBlob = await renderArtworkPdf(node, opts, geo);
  if (!geo) return artBlob;                       // legacy path (may be encrypted)
  // RGB PDF: marks are black; page boxes declare trim/bleed for the RIP.
  return finishPrintPdf(artBlob, geo, { space: 'rgb', labels: provenanceLabels(opts.meta) });
}

// Re-save a jsPDF artwork blob through pdf-lib to set the print page boxes and
// draw the marks. Used by the plain RGB pdf path; the CMYK path inlines the same
// steps after its colour conversion (see renderCmykPdf).
async function finishPrintPdf(blob, geo, { space, labels } = {}) {
  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.load(new Uint8Array(await blob.arrayBuffer()));
  const page = pdfDoc.getPage(0);
  setPageBoxes(page, geo);
  await drawPrintMarks(page, geo, { space, labels });
  const out = await pdfDoc.save();
  return new Blob([out], { type: 'application/pdf' });
}

// Compose the proof-margin credit strings from the export's provenance metadata.
// topLeft: export timestamp; topRight: platform attribution; bottomLeftUp: tool
// + author. Anything missing is dropped, so the line stays clean when the user
// isn't opted into personal details. Keyed by the engine's label slots (see
// print-marks.js).
function provenanceLabels(meta) {
  if (!meta) return null;
  const topLeft  = formatStamp(new Date());
  const topRight = meta.source ? `Made with ${meta.source}` : '';
  const credit = [meta.tool, meta.author && `by ${meta.author}`].filter(Boolean).join(' ');
  return { topLeft, topRight, bottomLeftUp: meta.tool ? credit : '' };
}

// Local export timestamp as "YYYY-MM-DD HH:MM".
function formatStamp(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Declare the print page boxes so a RIP / print shop knows the cut (trim) and
// bleed extents: Media ⊇ Bleed ⊇ Trim (= Art); CropBox = Media. The engine's
// geometry is top-left origin; PDF boxes are bottom-left, so flip y.
function setPageBoxes(page, geo) {
  const H = geo.page.h;
  const box = (b) => [b.x, H - (b.y + b.h), b.w, b.h]; // → [x, y(bottom-left), w, h]
  page.setMediaBox(...box(geo.boxes.media));
  page.setCropBox(...box(geo.boxes.media));
  page.setBleedBox(...box(geo.boxes.bleed));
  page.setTrimBox(...box(geo.boxes.trim));
  page.setArtBox(...box(geo.boxes.trim));
}

// Draw the crop / bleed / registration marks, colour bar and provenance labels
// in the page margin. Line marks use registration colour (DeviceCMYK 1,1,1,1 on
// the CMYK path so they print on every plate; black on the RGB path). Colour-bar
// cells follow their own `ink`: brand pairs force 'rgb' (the unconverted
// reference swatch) and 'cmyk' (the substitution) regardless of page space, so
// the two sit side by side for comparison; the generic bar's 'page' cells follow
// the page space. `labels` (optional) maps each engine label slot → its string.
// Engine coords are top-left; flip y.
async function drawPrintMarks(page, geo, { space = 'rgb', labels } = {}) {
  const { rgb, cmyk, degrees, StandardFonts } = await import('pdf-lib');
  const H = geo.page.h;
  const fy = (y) => H - y;
  const markColor = space === 'cmyk' ? cmyk(1, 1, 1, 1) : rgb(0, 0, 0);
  const w = geo.strokeWeight;
  for (const ln of geo.primitives.lines) {
    page.drawLine({ start: { x: ln.x1, y: fy(ln.y1) }, end: { x: ln.x2, y: fy(ln.y2) }, thickness: w, color: markColor });
  }
  for (const c of geo.primitives.circles) {
    // borderColor without `color` strokes a ring (no fill) — see pdf-lib drawEllipse.
    page.drawCircle({ x: c.cx, y: fy(c.cy), size: c.r, borderWidth: w, borderColor: markColor });
  }
  for (const b of geo.primitives.bars) {
    const ink = b.ink === 'page' || !b.ink ? space : b.ink;
    const fill = ink === 'cmyk' ? cmyk(...b.cmyk) : rgb(...b.rgb);
    page.drawRectangle({ x: b.x, y: fy(b.y + b.h), width: b.w, height: b.h, color: fill });
  }
  // Provenance text — only the engine's anchors that the caller supplied a string
  // for. Helvetica (a standard-14 font: referenced, not embedded) keeps it light.
  const slots = (geo.primitives.labels ?? []).filter(l => labels?.[l.slot]);
  if (slots.length) {
    const font = await page.doc.embedFont(StandardFonts.Helvetica);
    const textColor = space === 'cmyk' ? cmyk(0, 0, 0, 0.7) : rgb(0.35, 0.35, 0.35);
    for (const l of slots) {
      const text = labels[l.slot];
      // Right-aligned horizontal text shifts left by its measured width; rotated
      // text (read-up) starts at its anchor and climbs, so no shift needed.
      const shift = (l.rotation === 0 && l.align === 'right') ? font.widthOfTextAtSize(text, l.size) : 0;
      page.drawText(text, {
        x: l.x - shift, y: fy(l.y), size: l.size, font, color: textColor, rotate: degrees(l.rotation),
      });
    }
  }
}

// Renders an SVG element into a rectangular region of the PDF page.
// ox/oy are the PDF-space top-left offsets (pt); regionW/regionH are the
// target dimensions (pt). Used both by the full-page SVG canvas path and by
// drawHtmlVectors when it encounters an inline <svg> element.
async function drawSvgVectorsInRegion(pdf, svgEl, ox, oy, regionW, regionH, registeredFonts = null) {
  const vb = svgEl.viewBox?.baseVal;
  const vbW = (vb && vb.width  > 0) ? vb.width  : svgEl.getBoundingClientRect().width;
  const vbH = (vb && vb.height > 0) ? vb.height : svgEl.getBoundingClientRect().height;
  const vbX = (vb && vb.width  > 0) ? vb.x : 0;
  const vbY = (vb && vb.height > 0) ? vb.y : 0;
  const sx = regionW / vbW;
  const sy = regionH / vbH;

  async function visit(el, tx, ty, sX, sY) {
    if (!el.tagName) return;
    const tag = el.tagName.toLowerCase().replace(/^svg:/, '');

    // Map an SVG user-space coord (inside this element's inherited group transform)
    // into PDF points: apply the accumulated translate+scale, shift by the viewBox
    // origin, then scale into the target region. LW/LH scale a length.
    const gAvg = (sX + sY) / 2, rAvg = (sx + sy) / 2;
    const PX = (v) => ox + ((tx + sX * v) - vbX) * sx;
    const PY = (v) => oy + ((ty + sY * v) - vbY) * sy;
    const LW = (v) => v * sX * sx;
    const LH = (v) => v * sY * sy;
    // Stroke width / font scaling: group scale × region scale — EXCEPT for
    // vector-effect:non-scaling-stroke (e.g. street-map roads), whose stroke keeps
    // its user-unit width through the group transform, so region scale only.
    const strokeMul = (e) =>
      ((e.getAttribute('vector-effect') || resolveStyleProp(e, 'vector-effect')) === 'non-scaling-stroke' ? 1 : gAvg) * rAvg;

    if (tag === 'defs' || tag === 'clippath' || tag === 'lineargradient' ||
        tag === 'radialgradient' || tag === 'symbol') return;

    if (tag === 'g') {
      // Compose this group's transform onto the inherited one. Supports the
      // translate(+scale) that d3.zoom emits (street-map pan/zoom lives here): SVG
      // order is translate-then-scale, so the local translate is taken in the
      // PARENT's scale and the scales multiply. Rotation/skew are not handled.
      let ntx = tx, nty = ty, nsX = sX, nsY = sY;
      const t = el.getAttribute('transform') ?? '';
      if (t) {
        const tm = t.match(/translate\(\s*([+-]?\d*\.?\d+)[,\s]\s*([+-]?\d*\.?\d+)\s*\)/) ??
                   t.match(/translate\(\s*([+-]?\d*\.?\d+)\s*\)/);
        const sm = t.match(/scale\(\s*([+-]?\d*\.?\d+)(?:[,\s]\s*([+-]?\d*\.?\d+))?\s*\)/);
        if (tm) { ntx += sX * parseFloat(tm[1]); nty += sY * parseFloat(tm[2] ?? '0'); }
        if (sm) { nsX = sX * parseFloat(sm[1]); nsY = sY * parseFloat(sm[2] ?? sm[1]); }
      }
      for (const child of el.children) await visit(child, ntx, nty, nsX, nsY);
      return;
    }

    if (tag === 'rect') {
      const rgb = resolveColor(el);
      if (!rgb) return;
      const x = PX(svgLen(el.getAttribute('x'), vbW));
      const y = PY(svgLen(el.getAttribute('y'), vbH));
      const w = LW(svgLen(el.getAttribute('width'), vbW));
      const h = LH(svgLen(el.getAttribute('height'), vbH));
      if (w <= 0 || h <= 0) return;
      const rx = LW(parseFloat(el.getAttribute('rx') || '0'));
      const ry = LH(parseFloat(el.getAttribute('ry') || el.getAttribute('rx') || '0'));
      pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
      (rx > 0 || ry > 0)
        ? pdf.roundedRect(x, y, w, h, rx, ry, 'F')
        : pdf.rect(x, y, w, h, 'F');
      return;
    }

    if (tag === 'circle') {
      const rgb = resolveColor(el);
      if (!rgb) return;
      const cx = PX(svgLen(el.getAttribute('cx'), vbW));
      const cy = PY(svgLen(el.getAttribute('cy'), vbH));
      const r  = LW(svgLen(el.getAttribute('r'), vbW));
      pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
      pdf.circle(cx, cy, r, 'F');
      return;
    }

    if (tag === 'line') {
      const strokeStr = el.getAttribute('stroke') ?? '';
      let rgb = (strokeStr && strokeStr !== 'none') ? parseSvgColor(strokeStr) : null;
      if (!rgb) return;
      const opacity = parseFloat(el.getAttribute('opacity') ?? el.getAttribute('stroke-opacity') ?? '1');
      if (opacity < 0.01) return;
      if (opacity < 0.999) rgb = blendSvgWithWhite(rgb, opacity);
      const lx1 = PX(svgLen(el.getAttribute('x1'), vbW));
      const ly1 = PY(svgLen(el.getAttribute('y1'), vbH));
      const lx2 = PX(svgLen(el.getAttribute('x2'), vbW));
      const ly2 = PY(svgLen(el.getAttribute('y2'), vbH));
      const lw  = parseFloat(el.getAttribute('stroke-width') ?? '1') * strokeMul(el);
      pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
      pdf.setLineWidth(Math.max(0.1, lw));
      pdf.line(lx1, ly1, lx2, ly2, 'S');
      return;
    }

    if (tag === 'text') {
      const fillStr = el.getAttribute('fill') ?? '#000000';
      let rgb = parseSvgColor(fillStr);
      if (!rgb) return;
      const opacity = parseFloat(el.getAttribute('opacity') ?? el.getAttribute('fill-opacity') ?? '1');
      if (opacity < 0.01) return;
      if (opacity < 0.999) rgb = blendSvgWithWhite(rgb, opacity);
      const text = (el.textContent ?? '').trim();
      if (!text) return;
      const xt = PX(svgLen(el.getAttribute('x'), vbW));
      const yt = PY(svgLen(el.getAttribute('y'), vbH));
      const fs = parseFloat(el.getAttribute('font-size') ?? '16') * gAvg * rAvg;
      const fw = parseInt(el.getAttribute('font-weight') ?? '400') || 400;
      const italic  = el.getAttribute('font-style') === 'italic';
      const anchor  = el.getAttribute('text-anchor') ?? 'start';
      const family  = (el.getAttribute('font-family') ?? '').toLowerCase();
      pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
      pdf.setFontSize(Math.max(1, fs));
      let fontSet = false;
      if (family.includes('suse') && registeredFonts) {
        const suseStyle = await embedSuseFont(pdf, registeredFonts, fw, italic);
        if (suseStyle) { pdf.setFont('SUSE', suseStyle); fontSet = true; }
      }
      if (!fontSet) {
        pdf.setFont('helvetica', fw >= 600 ? (italic ? 'bolditalic' : 'bold') : (italic ? 'italic' : 'normal'));
      }
      const align = anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left';
      pdf.text(text, xt, yt, { align });
      return;
    }

    if (tag === 'path') {
      const d = el.getAttribute('d') ?? '';
      if (!d.trim()) return;
      const fillStr   = el.getAttribute('fill')   ?? resolveStyleProp(el, 'fill')   ?? 'black';
      const strokeStr = el.getAttribute('stroke') ?? resolveStyleProp(el, 'stroke') ?? 'none';
      const elemOp  = parseFloat(el.getAttribute('opacity') ?? '1');
      const fillOp  = elemOp * parseFloat(el.getAttribute('fill-opacity')   ?? '1');
      const strkOp  = elemOp * parseFloat(el.getAttribute('stroke-opacity') ?? '1');
      let fillRgb   = (fillStr   && fillStr   !== 'none') ? parseSvgColor(fillStr)   : null;
      let strokeRgb = (strokeStr && strokeStr !== 'none') ? parseSvgColor(strokeStr) : null;
      if (fillOp   < 0.01) fillRgb   = null;
      if (strkOp   < 0.01) strokeRgb = null;
      if (!fillRgb && !strokeRgb) return;
      if (fillRgb   && fillOp   < 0.999) fillRgb   = blendSvgWithWhite(fillRgb,   fillOp);
      if (strokeRgb && strkOp   < 0.999) strokeRgb = blendSvgWithWhite(strokeRgb, strkOp);
      if (fillRgb)   pdf.setFillColor(fillRgb[0], fillRgb[1], fillRgb[2]);
      if (strokeRgb) {
        pdf.setDrawColor(strokeRgb[0], strokeRgb[1], strokeRgb[2]);
        const lw = parseFloat(el.getAttribute('stroke-width') ?? '1') * strokeMul(el);
        pdf.setLineWidth(Math.max(0.1, lw));
      }
      const ptx = v => PX(v);
      const pty = v => PY(v);
      drawSvgPathToPdf(pdf, d, ptx, pty);
      const fillRule = el.getAttribute('fill-rule') ?? 'nonzero';
      if (fillRgb && strokeRgb) pdf.fillStroke();
      else if (fillRgb) { fillRule === 'evenodd' ? pdf.fillEvenOdd() : pdf.fill(); }
      else pdf.stroke();
      return;
    }

    if (tag === 'image') {
      const href = el.getAttribute('href') || el.getAttribute('xlink:href') || '';
      if (!href) return;
      const x = PX(svgLen(el.getAttribute('x'), vbW));
      const y = PY(svgLen(el.getAttribute('y'), vbH));
      const w = LW(svgLen(el.getAttribute('width'), vbW));
      const h = LH(svgLen(el.getAttribute('height'), vbH));
      if (w <= 0 || h <= 0) return;

      // An <image> pointing at an SVG (e.g. the brand logo) must stay VECTOR —
      // jsPDF.addImage can't embed SVG. Inline it and recurse, honouring the
      // <image>'s preserveAspectRatio (meet → fit the whole mark, centred).
      // SVG-ness is detected from the bytes (asset URLs are blob: with no hint).
      {
        let inner = null;
        try {
          inner = await inlineSvgFromImg(href);
          if (inner) {
            inner.setAttribute('style', `position:absolute;left:-99999px;top:0;width:${Math.max(1, Math.round(w))}px;height:${Math.max(1, Math.round(h))}px`);
            document.body.appendChild(inner);
            const ivb  = inner.viewBox?.baseVal;
            const ivbW = (ivb && ivb.width  > 0) ? ivb.width  : w;
            const ivbH = (ivb && ivb.height > 0) ? ivb.height : h;
            const par  = (el.getAttribute('preserveAspectRatio') || 'xMidYMid meet').trim();
            let fx = x, fy = y, fw = w, fh = h;
            if (!/^none/i.test(par)) {                 // meet: preserve aspect, centre
              const s = Math.min(w / ivbW, h / ivbH);
              fw = ivbW * s; fh = ivbH * s;
              fx = x + (w - fw) / 2; fy = y + (h - fh) / 2;
            }
            await drawSvgVectorsInRegion(pdf, inner, fx, fy, fw, fh, registeredFonts);
          }
        } catch { /* fall through to raster */ }
        finally { inner?.remove(); }
        if (inner) return;
      }

      try {
        const dataUrl = href.startsWith('data:') ? href : await blobToDataUrl(href);
        const { src: imgSrc, fmt } = await imageForPdf(dataUrl);
        pdf.addImage(imgSrc, fmt, x, y, w, h);
      } catch { /* skip unresolvable images */ }
      return;
    }

    for (const child of el.children) await visit(child, tx, ty, sX, sY);
  }

  await visit(svgEl, 0, 0, 1, 1);
}

// Reads a CSS property from an element's style attribute (not computed style).
// Used to extract fill/stroke when they are set via style="" rather than as attributes.
function resolveStyleProp(el, prop) {
  const styleAttr = el.getAttribute('style') ?? '';
  const m = styleAttr.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)'));
  return m ? m[1].trim() : null;
}

// Approximate SVG opacity by blending with white, used since jsPDF lacks per-element opacity.
function blendSvgWithWhite(rgb, opacity) {
  return [
    Math.round(rgb[0] * opacity + 255 * (1 - opacity)),
    Math.round(rgb[1] * opacity + 255 * (1 - opacity)),
    Math.round(rgb[2] * opacity + 255 * (1 - opacity)),
  ];
}

// Parse numeric args from an SVG path data segment string.
function parseSvgPathArgs(str) {
  const m = str.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g);
  return m ? m.map(Number) : [];
}

// Emits jsPDF path operations (moveTo/lineTo/curveTo/close) for an SVG `d` string.
// tx/ty are coordinate-transform functions: SVG user units → jsPDF pt (top-left origin).
// Caller must call fill()/stroke()/fillStroke() after this returns.
function drawSvgPathToPdf(pdf, d, tx, ty) {
  const cmdRe = /([MLHVCSQTAZmlhvcsqtaz])([^MLHVCSQTAZmlhvcsqtaz]*)/g;
  let cx = 0, cy = 0;
  let sx = 0, sy = 0;   // current subpath start — Z returns the current point here (SVG spec)
  let lastCmd = '';
  let lastCpx = 0, lastCpy = 0;
  let m;

  while ((m = cmdRe.exec(d)) !== null) {
    const cmd  = m[1];
    const nums = parseSvgPathArgs(m[2]);
    const abs  = cmd === cmd.toUpperCase();
    const C    = cmd.toUpperCase();
    const ax   = i => abs ? nums[i] : cx + nums[i];
    const ay   = i => abs ? nums[i] : cy + nums[i];

    switch (C) {
      case 'M':
        for (let i = 0; i + 1 < nums.length; i += 2) {
          const x = ax(i), y = ay(i + 1);
          if (i === 0) { pdf.moveTo(tx(x), ty(y)); sx = x; sy = y; } // remember subpath start
          else pdf.lineTo(tx(x), ty(y));
          cx = x; cy = y;
        }
        break;
      case 'L':
        for (let i = 0; i + 1 < nums.length; i += 2) {
          const x = ax(i), y = ay(i + 1);
          pdf.lineTo(tx(x), ty(y)); cx = x; cy = y;
        }
        break;
      case 'H':
        for (let i = 0; i < nums.length; i++) {
          cx = abs ? nums[i] : cx + nums[i];
          pdf.lineTo(tx(cx), ty(cy));
        }
        break;
      case 'V':
        for (let i = 0; i < nums.length; i++) {
          cy = abs ? nums[i] : cy + nums[i];
          pdf.lineTo(tx(cx), ty(cy));
        }
        break;
      case 'C':
        for (let i = 0; i + 5 < nums.length; i += 6) {
          const x1 = ax(i),     y1 = ay(i + 1);
          const x2 = ax(i + 2), y2 = ay(i + 3);
          const x  = ax(i + 4), y  = ay(i + 5);
          pdf.curveTo(tx(x1), ty(y1), tx(x2), ty(y2), tx(x), ty(y));
          lastCpx = x2; lastCpy = y2; cx = x; cy = y;
        }
        break;
      case 'S':
        for (let i = 0; i + 3 < nums.length; i += 4) {
          const r1x = (lastCmd === 'C' || lastCmd === 'S') ? 2 * cx - lastCpx : cx;
          const r1y = (lastCmd === 'C' || lastCmd === 'S') ? 2 * cy - lastCpy : cy;
          const x2  = ax(i),     y2 = ay(i + 1);
          const x   = ax(i + 2), y  = ay(i + 3);
          pdf.curveTo(tx(r1x), ty(r1y), tx(x2), ty(y2), tx(x), ty(y));
          lastCpx = x2; lastCpy = y2; cx = x; cy = y;
        }
        break;
      case 'Q':
        for (let i = 0; i + 3 < nums.length; i += 4) {
          const qx1 = ax(i), qy1 = ay(i + 1);
          const x   = ax(i + 2), y = ay(i + 3);
          const x1  = cx + 2 / 3 * (qx1 - cx), y1 = cy + 2 / 3 * (qy1 - cy);
          const x2  = x  + 2 / 3 * (qx1 - x),  y2 = y  + 2 / 3 * (qy1 - y);
          pdf.curveTo(tx(x1), ty(y1), tx(x2), ty(y2), tx(x), ty(y));
          lastCpx = qx1; lastCpy = qy1; cx = x; cy = y;
        }
        break;
      case 'T':
        for (let i = 0; i + 1 < nums.length; i += 2) {
          const qx1 = (lastCmd === 'Q' || lastCmd === 'T') ? 2 * cx - lastCpx : cx;
          const qy1 = (lastCmd === 'Q' || lastCmd === 'T') ? 2 * cy - lastCpy : cy;
          const x   = ax(i), y = ay(i + 1);
          const x1  = cx + 2 / 3 * (qx1 - cx), y1 = cy + 2 / 3 * (qy1 - cy);
          const x2  = x  + 2 / 3 * (qx1 - x),  y2 = y  + 2 / 3 * (qy1 - y);
          pdf.curveTo(tx(x1), ty(y1), tx(x2), ty(y2), tx(x), ty(y));
          lastCpx = qx1; lastCpy = qy1; cx = x; cy = y;
        }
        break;
      case 'A':
        for (let i = 0; i + 6 < nums.length; i += 7) {
          const rx = Math.abs(nums[i]);
          const ry = Math.abs(nums[i + 1]);
          const xRot = nums[i + 2] * Math.PI / 180;
          const la   = nums[i + 3] ? 1 : 0;
          const sw   = nums[i + 4] ? 1 : 0;
          const x    = ax(i + 5), y = ay(i + 6);
          if (rx < 1e-6 || ry < 1e-6) {
            pdf.lineTo(tx(x), ty(y));
          } else {
            for (const [bx1, by1, bx2, by2, bx, by] of svgArcToBeziers(cx, cy, rx, ry, xRot, la, sw, x, y)) {
              pdf.curveTo(tx(bx1), ty(by1), tx(bx2), ty(by2), tx(bx), ty(by));
            }
          }
          cx = x; cy = y;
          lastCpx = cx; lastCpy = cy;
        }
        break;
      case 'Z':
        pdf.close();
        // SVG: after closepath the current point returns to the subpath's start, so a
        // following relative command (`z m…`) is offset from there — not the last drawn
        // point. Without this the mono-white SUSE wordmark mangled (hourglass 'S').
        cx = sx; cy = sy;
        break;
    }

    lastCmd = C;
    // Preserve the stored control point after curve commands so the next smooth
    // command can reflect it: C/S keep the cubic control point, Q/T the quadratic
    // one. Everything else has no control point, so it collapses to the current
    // point. (Resetting after Q/T here was the bug that mangled smooth-quad glyphs.)
    if (C !== 'C' && C !== 'S' && C !== 'Q' && C !== 'T') { lastCpx = cx; lastCpy = cy; }
  }
}

// Converts an SVG arc command to cubic bezier curve segments.
// Returns array of [cp1x, cp1y, cp2x, cp2y, endX, endY] per segment.
// Algorithm from SVG spec appendix F.6.
function svgArcToBeziers(x1, y1, rx, ry, phi, fa, fs, x2, y2) {
  if (x1 === x2 && y1 === y2) return [];

  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);

  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p =  cosP * dx + sinP * dy;
  const y1p = -sinP * dx + cosP * dy;

  let rx2 = rx * rx, ry2 = ry * ry;
  const x1p2 = x1p * x1p, y1p2 = y1p * y1p;
  const lam = x1p2 / rx2 + y1p2 / ry2;
  if (lam > 1) {
    const sl = Math.sqrt(lam);
    rx *= sl; ry *= sl; rx2 = rx * rx; ry2 = ry * ry;
  }

  const num  = Math.max(0, rx2 * ry2 - rx2 * y1p2 - ry2 * x1p2);
  const den  = rx2 * y1p2 + ry2 * x1p2;
  const coef = (fa === fs ? -1 : 1) * Math.sqrt(num / den);
  const cxp  =  coef * rx * y1p / ry;
  const cyp  = -coef * ry * x1p / rx;

  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2;
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2;

  const angV = (ux, uy, vx, vy) => {
    const sign = (ux * vy - uy * vx) < 0 ? -1 : 1;
    const dot  = ux * vx + uy * vy;
    const len  = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy));
    return sign * Math.acos(Math.max(-1, Math.min(1, dot / len)));
  };

  const theta1 = angV(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dtheta   = angV((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dtheta > 0) dtheta -= 2 * Math.PI;
  if (fs  && dtheta < 0) dtheta += 2 * Math.PI;

  const n  = Math.max(1, Math.ceil(Math.abs(dtheta) / (Math.PI / 2)));
  const dt = dtheta / n;
  const results = [];

  for (let i = 0; i < n; i++) {
    const t1 = theta1 + i * dt;
    const t2 = theta1 + (i + 1) * dt;
    const alpha = (4 / 3) * Math.tan(dt / 4);

    const cos1 = Math.cos(t1), sin1 = Math.sin(t1);
    const cos2 = Math.cos(t2), sin2 = Math.sin(t2);

    const ep1x = cosP * (rx * cos1) - sinP * (ry * sin1) + cx;
    const ep1y = sinP * (rx * cos1) + cosP * (ry * sin1) + cy;
    const dp1x = cosP * (-rx * sin1) - sinP * (ry * cos1);
    const dp1y = sinP * (-rx * sin1) + cosP * (ry * cos1);
    const ep2x = cosP * (rx * cos2) - sinP * (ry * sin2) + cx;
    const ep2y = sinP * (rx * cos2) + cosP * (ry * sin2) + cy;
    const dp2x = cosP * (-rx * sin2) - sinP * (ry * cos2);
    const dp2y = sinP * (-rx * sin2) + cosP * (ry * cos2);

    results.push([
      ep1x + alpha * dp1x, ep1y + alpha * dp1y,
      ep2x - alpha * dp2x, ep2y - alpha * dp2y,
      ep2x, ep2y,
    ]);
  }

  return results;
}

// Walks the live DOM tree and emits jsPDF vector objects:
//   • background-color → filled rect / roundedRect
//   • border-top → thin filled rect (used for divider lines)
//   • <svg> subtrees → drawSvgVectorsInRegion
//   • <img> → addImage (circular headshots pre-clipped to a canvas)
//   • block-level leaf text → pdf.text() with computed font/color/align
//
// Font: custom webfonts (e.g. SUSE) are approximated with Helvetica. Text is
// still selectable/searchable vector — only the typeface differs from screen.
// Transparency: jsPDF fills are opaque; semi-transparent CSS colors render at
// full opacity (acceptable approximation for brand colours).
// Rasterise a live <svg> subtree (inner <style> + gradients intact) to a PNG
// data URL, alpha preserved. The PDF walker uses this for gradient / filter
// illustrations the vector path can't reproduce faithfully (no shading; CSS-class
// fills). `flipX` mirrors horizontally to honour a scaleX(-1) CSS transform.
async function rasterizeSvgElement(svgEl, pxW, pxH, flipX = false) {
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width',  String(pxW));
  clone.setAttribute('height', String(pxH));
  await inlineBlobUrlsInEl(clone);
  const xml = new XMLSerializer().serializeToString(clone);
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = () => rej(new Error('svg rasterise failed'));
    img.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width  = pxW;
  canvas.height = pxH;
  const ctx = canvas.getContext('2d');
  if (flipX) { ctx.translate(pxW, 0); ctx.scale(-1, 1); }
  ctx.drawImage(img, 0, 0, pxW, pxH);
  return canvas.toDataURL('image/png');
}

// Draws the live DOM as PDF vectors into the rectangular region (ox, oy, regionW,
// regionH) in page points (top-left origin). Callers pass the full page for an
// ordinary export, or the bleed box for a print export (so the design bleeds).
async function drawHtmlVectors(pdf, node, ox, oy, regionW, regionH, convertPaths = true) {
  const rect0 = node.getBoundingClientRect();
  const scaleX = regionW / rect0.width;
  const scaleY = regionH / rect0.height;
  // CSS px → PDF pt — accounts for the CSS transform scale applied to the
  // canvas node. node.clientWidth is the layout width before the transform.
  const cssToPt = regionW / (node.clientWidth || rect0.width);
  // Virtual origin: shifting the reference top-left by the region offset bakes it
  // into every (rect − rootRect)·scale below, so the artwork lands at (ox, oy)
  // without touching the inline-text / pseudo-content helpers downstream.
  const rootRect = {
    left: rect0.left - ox / scaleX, top: rect0.top - oy / scaleY,
    width: rect0.width, height: rect0.height, right: rect0.right, bottom: rect0.bottom,
  };
  // Tracks which font variants have been registered in this PDF instance.
  const registeredFonts = new Set();

  async function visit(el) {
    if (el.nodeType !== 1) return;
    const tag = el.tagName.toLowerCase();
    if (tag === 'style' || tag === 'script') return;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    if (parseFloat(style.opacity ?? '1') === 0) return;

    const rect = el.getBoundingClientRect();
    if (rect.width < 0.5 || rect.height < 0.5) return;

    const x = (rect.left - rootRect.left) * scaleX;
    const y = (rect.top  - rootRect.top)  * scaleY;
    const w = rect.width  * scaleX;
    const h = rect.height * scaleY;

    // ── Background fill ───────────────────────────────────────────────────────
    const rTL = parseCssLen(style.borderTopLeftRadius,     rect.width)  * scaleX;
    const rTR = parseCssLen(style.borderTopRightRadius,    rect.width)  * scaleX;
    const rBL = parseCssLen(style.borderBottomLeftRadius,  rect.width)  * scaleX;
    const rBR = parseCssLen(style.borderBottomRightRadius, rect.width)  * scaleX;
    const rx  = Math.max(rTL, rTR, rBL, rBR);
    const bgImg = style.backgroundImage;
    const bgRgb = (bgImg && bgImg !== 'none')
      ? sampleGradientMidpoint(bgImg)
      : parseCssColor(style.backgroundColor);
    if (bgRgb) {
      pdf.setFillColor(bgRgb[0], bgRgb[1], bgRgb[2]);
      rx > 0
        ? pdf.roundedRect(x, y, w, h, rx, rx, 'F')
        : pdf.rect(x, y, w, h, 'F');
    }

    // ── Borders ───────────────────────────────────────────────────────────────
    // A uniform border is stroked as one rectangle (so a radius is honoured); a
    // divider (border-top only) or mixed border fills per edge. Previously only
    // border-top was emitted, so framed elements (e.g. the track chips) lost their
    // left/right/bottom edges in PDF while bitmap exports drew all four.
    const bSide = (wKey, cKey) => {
      const bw = parseFloat(style[wKey]) || 0;
      return { bw, rgb: bw > 0 ? parseCssColor(style[cKey]) : null };
    };
    const bT = bSide('borderTopWidth',    'borderTopColor');
    const bR = bSide('borderRightWidth',  'borderRightColor');
    const bB = bSide('borderBottomWidth', 'borderBottomColor');
    const bL = bSide('borderLeftWidth',   'borderLeftColor');
    const eqRgb = (a, b) => a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    const uniformBorder = bT.rgb && bT.bw === bR.bw && bT.bw === bB.bw && bT.bw === bL.bw
      && eqRgb(bT.rgb, bR.rgb) && eqRgb(bT.rgb, bB.rgb) && eqRgb(bT.rgb, bL.rgb);
    if (uniformBorder) {
      const lw = bT.bw * scaleY;
      pdf.setDrawColor(bT.rgb[0], bT.rgb[1], bT.rgb[2]);
      pdf.setLineWidth(lw);
      // CSS border-box: the border sits inside w×h; jsPDF strokes centred, so inset by lw/2.
      rx > 0
        ? pdf.roundedRect(x + lw / 2, y + lw / 2, w - lw, h - lw, rx, rx, 'S')
        : pdf.rect(x + lw / 2, y + lw / 2, w - lw, h - lw, 'S');
    } else {
      if (bT.rgb) { pdf.setFillColor(bT.rgb[0], bT.rgb[1], bT.rgb[2]); pdf.rect(x, y, w, bT.bw * scaleY, 'F'); }
      if (bB.rgb) { pdf.setFillColor(bB.rgb[0], bB.rgb[1], bB.rgb[2]); pdf.rect(x, y + h - bB.bw * scaleY, w, bB.bw * scaleY, 'F'); }
      if (bL.rgb) { pdf.setFillColor(bL.rgb[0], bL.rgb[1], bL.rgb[2]); pdf.rect(x, y, bL.bw * scaleX, h, 'F'); }
      if (bR.rgb) { pdf.setFillColor(bR.rgb[0], bR.rgb[1], bR.rgb[2]); pdf.rect(x + w - bR.bw * scaleX, y, bR.bw * scaleX, h, 'F'); }
    }

    // ── SVG subtree → vector region (or raster for gradient illustrations) ─────
    if (tag === 'svg') {
      // Gradient / filter illustrations (e.g. the bag-video Geeko) can't be
      // reproduced by the vector walker: drawSvgVectorsInRegion has no axial /
      // radial shading and reads fills only from attributes or inline style, so
      // url(#gradient) fills disappear and CSS-class fills (declared in an inner
      // <style>) fall back to black — a solid silhouette. The SVG export keeps
      // these vector by cloning the node verbatim; for PDF we rasterise just this
      // subtree to a PNG (alpha preserved) so it keeps its shading, and reserve
      // the crisp vector walk for solid-fill SVGs (qr, lockup, …).
      if (el.querySelector('linearGradient, radialGradient, filter, pattern')) {
        try {
          // Resolution from the OUTPUT region (points → px at ~150dpi), not the
          // on-screen box — so it's independent of the preview zoom and bounded.
          const dpr = 150 / 72;
          const pxW = Math.max(2, Math.min(2000, Math.round(w * dpr)));
          const pxH = Math.max(2, Math.min(2000, Math.round(h * dpr)));
          // Honour a scaleX(-1) flip (computed transform's matrix a-component < 0).
          const tm = String(style.transform || '').match(/matrix\(\s*(-?[\d.]+)/);
          const flipX = tm ? parseFloat(tm[1]) < 0 : el.classList.contains('flip');
          const png = await rasterizeSvgElement(el, pxW, pxH, flipX);
          pdf.addImage(png, 'PNG', x, y, w, h);
          return;
        } catch { /* fall through to the vector walk */ }
      }
      await drawSvgVectorsInRegion(pdf, el, x, y, w, h, registeredFonts);
      return;
    }

    // ── Image (raster, or inlined SVG → vectors) ──────────────────────────────
    if (tag === 'img') {
      const src = el.src || el.getAttribute('src') || '';
      if (!src || w <= 0 || h <= 0) return;

      // SVG images (e.g. the corner brand logo) must stay VECTOR — rasterising
      // them breaks true CMYK output and looks soft. Inline the SVG and draw it
      // through the same vector path as an inline <svg>, fitted "meet" (aspect
      // preserved, centred) so the whole mark shows — matching object-fit: contain.
      // SVG-ness is detected from the bytes (asset URLs are blob: with no hint).
      {
        let svgEl = null;
        try {
          svgEl = await inlineSvgFromImg(src);
          if (svgEl) {
            // Off-screen so viewBox.baseVal + any computed fills resolve.
            svgEl.setAttribute('style', `position:absolute;left:-99999px;top:0;width:${Math.round(rect.width)}px;height:${Math.round(rect.height)}px`);
            document.body.appendChild(svgEl);
            const vb = svgEl.viewBox?.baseVal;
            const vbW = (vb && vb.width  > 0) ? vb.width  : rect.width;
            const vbH = (vb && vb.height > 0) ? vb.height : rect.height;
            const s  = Math.min(w / vbW, h / vbH);            // meet: fit whole mark
            const fw = vbW * s, fh = vbH * s;
            await drawSvgVectorsInRegion(pdf, svgEl, x + (w - fw) / 2, y + (h - fh) / 2, fw, fh, registeredFonts);
          }
        } catch { /* fall through to the raster path */ }
        finally { svgEl?.remove(); }
        if (svgEl) return;
      }

      {
        try {
          const dataUrl = src.startsWith('data:') ? src
            : src.startsWith('blob:') ? await blobToDataUrl(src) : src;

          // Clip circular images (headshots with border-radius: 50%)
          const rTL = parseCssLen(style.borderTopLeftRadius,     rect.width);
          const rTR = parseCssLen(style.borderTopRightRadius,    rect.width);
          const rBL = parseCssLen(style.borderBottomLeftRadius,  rect.width);
          const rBR = parseCssLen(style.borderBottomRightRadius, rect.width);
          const minR  = Math.min(rTL, rTR, rBL, rBR);
          const halfMin = Math.min(rect.width, rect.height) * 0.45;
          const isCircle = minR >= halfMin;

          const imgUrl = isCircle ? await circularClipImage(el, dataUrl).catch(() => dataUrl) : dataUrl;
          const { src: imgSrc, fmt } = await imageForPdf(imgUrl);
          pdf.addImage(imgSrc, fmt, x, y, w, h);
        } catch { /* skip unloadable images */ }
      }
      return;
    }

    // ── Recurse into block-level children only ────────────────────────────────
    // Inline children (<strong>, <em>, <span> …) are intentionally skipped here.
    // Their content is rendered by renderInlineContent below, where each fragment
    // gets its own computed style (preserving bold, color, etc.).
    for (const child of el.children) {
      const cd = window.getComputedStyle(child).display;
      if (cd === 'inline' || cd === 'inline-block' || cd === 'inline-flex') continue;
      await visit(child);
    }

    // ── Inline text content ───────────────────────────────────────────────────
    await renderInlineContent(pdf, el, style, rootRect, scaleX, scaleY, cssToPt, registeredFonts, convertPaths);

    // ── CSS generated content (::before/::after markers) ──────────────────────
    await pdfPseudoContent(pdf, el, rootRect, scaleX, scaleY, cssToPt, registeredFonts, convertPaths);
  }

  await visit(node);
}

// Walks text nodes and inline elements within blockEl, rendering each fragment
// at its own getBoundingClientRect position with its own computed style.
// This preserves inline formatting (<strong> bold, <em> italic, color spans, etc.)
// that would be lost by reading the block's innerText as a flat string.
//
// Block-level children are skipped — the main visit() loop already handles them.
// <br> is skipped — the line break is implicit in the text nodes' y positions.
async function renderInlineContent(pdf, blockEl, blockStyle, rootRect, scaleX, scaleY, cssToPt, registeredFonts, convertPaths = true) {
  async function walk(node, nodeStyle) {
    if (node.nodeType === 3) {
      const text = node.textContent;
      if (!text || !text.trim()) return;

      // Set font (color, size, SUSE embedding) first — feeds the <text> fallback.
      await applyPdfTextStyle(pdf, nodeStyle, cssToPt, registeredFonts);

      const fontSizePx = parseFloat(nodeStyle.fontSize) || 16;
      const fontUrl = resolveSuseFontUrl(nodeStyle);
      const outline = convertPaths && canVectoriseText(nodeStyle, fontUrl, Boolean(_host?.text));
      const textRgb = parseCssColor(nodeStyle.color) || [0, 0, 0];
      const ascentPt = fontMetricsPx(nodeStyle, fontSizePx).ascent * cssToPt;

      // Use the browser's actual line breaks + per-line positions (exact match to
      // on-screen and the SVG output), NOT jsPDF's splitTextToSize — which re-measures
      // with the embedded font's metrics and can wrap a word a character or two early
      // when they differ slightly from the browser's. 'Convert paths' ON outlines each
      // line via host.text.toPath; OFF (or any shape failure) draws embedded pdf.text
      // at the same position, so output is never worse than before.
      const segs = text.split('\n');
      let offset = 0;
      for (const seg of segs) {
        if (seg.trim().length > 0) {
          for (const line of visualLines(node, offset, offset + seg.length)) {
            const r = line.rect;
            if (r.width < 0.5 || r.height < 0.5) continue;
            const x = (r.left - rootRect.left) * scaleX;
            const top = (r.top - rootRect.top) * scaleY;
            let drawn = false;
            if (outline) {
              try {
                const { d } = await _host.text.toPath({ text: line.text, fontUrl, fontSize: fontSizePx });
                if (d) {
                  pdf.setFillColor(textRgb[0], textRgb[1], textRgb[2]);
                  drawSvgPathToPdf(pdf, d,
                    sx => x + sx * cssToPt,
                    sy => top + ascentPt + sy * cssToPt);
                  pdf.fill();
                  drawn = true;
                }
              } catch (e) {
                _host?.log?.('warn', `pdf: text-to-path failed, using embedded text — ${e.message}`);
              }
            }
            if (!drawn) pdf.text(line.text, x, top, { baseline: 'top' });
          }
        }
        offset += seg.length + 1; // +1 for the '\n'
      }

    } else if (node.nodeType === 1) {
      if (node.tagName.toLowerCase() === 'br') return;
      const s = window.getComputedStyle(node);
      if (s.display === 'none') return;
      // Only descend into inline-level elements; block children are visited by
      // the main visit() loop.
      if (s.display !== 'inline' && s.display !== 'inline-block' && s.display !== 'inline-flex') return;
      for (const child of node.childNodes) await walk(child, s);
    }
  }

  for (const child of blockEl.childNodes) await walk(child, blockStyle);
}

// Emit any ::before/::after markers of `el` into the PDF (mirrors svgPseudoContent).
async function pdfPseudoContent(pdf, el, rootRect, scaleX, scaleY, cssToPt, registeredFonts, convertPaths) {
  for (const name of ['::before', '::after']) {
    const ds = pseudoDescriptor(el, name);
    if (!ds) continue;
    const x = (ds.x - rootRect.left) * scaleX;
    const y = (ds.y - rootRect.top)  * scaleY;
    if (ds.bg && ds.w > 0.5 && ds.h > 0.5) {
      const w = ds.w * scaleX, h = ds.h * scaleY, rx = ds.rx * scaleX;
      pdf.setFillColor(ds.bg[0], ds.bg[1], ds.bg[2]);
      rx > 0 ? pdf.roundedRect(x, y, w, h, rx, rx, 'F') : pdf.rect(x, y, w, h, 'F');
    }
    if (!ds.text.trim()) continue;
    const fontSizePx = parseFloat(ds.ps.fontSize) || 16;
    const fontUrl = resolveSuseFontUrl(ds.ps);
    const textRgb = parseCssColor(ds.ps.color) || [0, 0, 0];
    let drawn = false;
    if (convertPaths && canVectoriseText(ds.ps, fontUrl, Boolean(_host?.text))) {
      try {
        const { d } = await _host.text.toPath({ text: ds.text, fontUrl, fontSize: fontSizePx });
        if (d) {
          const ascentPt = fontMetricsPx(ds.ps, fontSizePx).ascent * cssToPt;
          pdf.setFillColor(textRgb[0], textRgb[1], textRgb[2]);
          drawSvgPathToPdf(pdf, d, sx => x + sx * cssToPt, sy => y + ascentPt + sy * cssToPt);
          pdf.fill();
          drawn = true;
        }
      } catch (e) { _host?.log?.('warn', `pdf: pseudo text-to-path failed — ${e.message}`); }
    }
    if (!drawn) {
      await applyPdfTextStyle(pdf, ds.ps, cssToPt, registeredFonts);
      pdf.text(ds.text, x, y, { baseline: 'top' });
    }
  }
}

// Sets jsPDF text color, font size, and font family from a computed style object.
// Embeds the SUSE TTF for the required weight/style if needed.
async function applyPdfTextStyle(pdf, style, cssToPt, registeredFonts) {
  const textRgb = parseCssColor(style.color) || [0, 0, 0];
  pdf.setTextColor(textRgb[0], textRgb[1], textRgb[2]);
  const pdfSize = parseFloat(style.fontSize) * cssToPt;
  pdf.setFontSize(pdfSize);
  const weight = parseInt(style.fontWeight) || 400;
  const italic  = style.fontStyle === 'italic' || style.fontStyle === 'oblique';
  const family  = (style.fontFamily || '').toLowerCase();
  if (family.includes('suse')) {
    const suseStyle = await embedSuseFont(pdf, registeredFonts, weight, italic);
    if (suseStyle) { pdf.setFont('SUSE', suseStyle); return; }
  }
  const fallback = weight >= 600 ? (italic ? 'bolditalic' : 'bold') : (italic ? 'italic' : 'normal');
  pdf.setFont('helvetica', fallback);
}

// Parse a computed CSS color (always rgb/rgba from getComputedStyle).
// Returns null for transparent or fully-transparent rgba.
function parseCssColor(cssColor) {
  if (!cssColor || cssColor === 'transparent') return null;
  const m = cssColor.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
  return [+m[1], +m[2], +m[3]];
}

// Parse a CSS length value (px or %). refPx is used for percentage resolution.
function parseCssLen(val, refPx) {
  if (!val || val === '0' || val === '0px') return 0;
  const s = String(val).trim();
  if (s.endsWith('%')) return (parseFloat(s) / 100) * refPx;
  return parseFloat(s) || 0;
}

// Clips an image to a circle via an offscreen canvas. Used for headshots that
// carry border-radius: 50%. Returns a PNG data URL.
async function circularClipImage(imgEl, dataUrl) {
  const img = (imgEl.naturalWidth > 0) ? imgEl : await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const size = Math.min(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, 0, 0, size, size);
  return canvas.toDataURL('image/png');
}

// Fetch + parse an image source into a live <svg> element IFF it is SVG, so it
// can be drawn as true PDF vectors (jsPDF.addImage rejects SVG). Detection is by
// CONTENT, not URL — asset URLs are blob: with no extension or MIME hint, so we
// fetch the bytes and sniff for "<svg". Known raster MIME types are skipped fast.
// Handles blob:, http(s) and data: sources; returns null for non-SVG/unfetchable.
async function inlineSvgFromImg(src) {
  if (!src) return null;
  let text = null;
  if (/^data:/i.test(src)) {
    if (!/^data:(image\/svg|text\/|application\/(xml|svg))/i.test(src)) return null;
    const comma  = src.indexOf(',');
    const header = src.slice(0, comma);
    const body   = src.slice(comma + 1);
    text = /;base64/i.test(header) ? atob(body) : decodeURIComponent(body);
  } else {
    let blob;
    try {
      const resp = await fetch(src);
      if (!resp.ok) return null;
      blob = await resp.blob();
    } catch { return null; }
    // Skip obvious rasters without reading them; sniff svg/xml/unknown types.
    if (/^image\/(png|jpe?g|webp|gif|avif|bmp|x-icon|vnd)/i.test(blob.type || '')) return null;
    try { text = await blob.text(); } catch { return null; }
  }
  if (!text || !/<svg[\s>]/i.test(text)) return null;
  const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
  return (svg && svg.tagName && svg.tagName.toLowerCase() === 'svg') ? svg : null;
}

// ── SUSE font embedding ───────────────────────────────────────────────────────

// Module-level cache: font URL → base64 string. Survives across export calls
// within a session so the TTF files are fetched at most once.
const _fontBase64Cache = new Map();

async function loadFontBase64(url) {
  if (_fontBase64Cache.has(url)) return _fontBase64Cache.get(url);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Font fetch failed: ${url}`);
  const buf = await resp.arrayBuffer();
  // FileReader is the safest way to base64-encode arbitrary binary in a browser.
  // btoa(String.fromCharCode(...uint8)) blows the stack on large font files.
  const b64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(/** @type {string} */(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(new Blob([buf]));
  });
  _fontBase64Cache.set(url, b64);
  return b64;
}

// Embeds a SUSE weight+style variant into the jsPDF instance and returns the
// jsPDF fontStyle key to use with pdf.setFont('SUSE', key).
// registeredFonts is a per-PDF-instance Set that avoids re-registering.
// Font-file naming is shared with the SVG path emitter (text-svg.js) so the two
// export paths never resolve the same weight to different files.
async function embedSuseFont(pdf, registeredFonts, weight, italic) {
  const style = italic ? `wi${weight}` : `w${weight}`;
  if (!registeredFonts.has(style)) {
    const file = suseFontFile(weight, italic);
    const url  = SUSE_FONT_DIR + file;
    try {
      const b64 = await loadFontBase64(url);
      pdf.addFileToVFS(file, b64);
      pdf.addFont(file, 'SUSE', style);
      registeredFonts.add(style);
    } catch {
      return null; // fetch failed; caller falls back to helvetica
    }
  }
  return style;
}

// ── CMYK PDF export ───────────────────────────────────────────────────────────
//
// Post-processes a jsPDF-rendered PDF to convert RGB colour operators to CMYK.
// The pipeline: render with jsPDF → load into pdf-lib → decompress each content
// stream → swap `rg`/`RG` operators → recompress → save.
//
// Raster images embedded by jsPDF remain RGB (their pixel data is not touched).
// Fills, strokes, and text colours become DeviceCMYK.
//
// If opts.palette is provided (array of { hex, cmyk: [C,M,Y,K] } entries with
// values 0–100), brand colours are looked up before generic conversion, giving
// exact ink values for registered swatches.

async function renderCmykPdf(node, opts) {
  // Artwork only (no marks/boxes here) — print finishing is applied below, after
  // the RGB→CMYK conversion, so the marks stay DeviceCMYK (incl. registration).
  const geo = printGeometry(node, opts);
  const rgbBlob = await renderArtworkPdf(node, opts, geo);
  const rgbBytes = new Uint8Array(await rgbBlob.arrayBuffer());

  const { PDFDocument, PDFName, PDFNumber, PDFString } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.load(rgbBytes);
  const m = opts.meta;
  const creator = m?.software || 'Lolly';
  pdfDoc.setCreator(creator);
  pdfDoc.setProducer(creator);
  pdfDoc.setAuthor(m?.author || creator); // the user if known, else the app
  if (m) {
    if (m.tool) pdfDoc.setTitle(m.tool);
    if (m.description) pdfDoc.setSubject(m.description);
    const kw = [m.software, m.source, m.contact].filter(Boolean);
    if (kw.length) pdfDoc.setKeywords(kw);
  }
  const paletteMap = buildCmykPaletteMap(opts.palette ?? []);
  const usedKeys = new Set();   // brand palette keys actually hit during substitution

  // Declare the press condition the DeviceCMYK values are meant to be read under,
  // so a RIP/print shop knows the intended output. Referenced by registered name
  // (no heavy destination profile embedded) — valid for a standard condition.
  if (opts.colorProfile !== 'none') {
    addCmykOutputIntent(pdfDoc, opts.colorProfile, PDFName, PDFString);
  }

  for (const [, obj] of pdfDoc.context.enumerateIndirectObjects()) {
    if (!(obj.contents instanceof Uint8Array)) continue;

    const dict = obj.dict;
    if (!dict?.get) continue;

    // Image XObjects contain pixel data, not PDF operators — skip them.
    const sub = dict.get(PDFName.of('Subtype'));
    if (sub && String(sub).includes('Image')) continue;

    // jsPDF uses /FlateDecode; skip other filters (e.g. /DCTDecode for JPEG XObjects).
    const filter = dict.get(PDFName.of('Filter'));
    if (filter && !String(filter).includes('FlateDecode')) continue;

    let raw;
    try {
      raw = filter ? await inflateBytes(obj.contents) : obj.contents;
    } catch { continue; }

    const text = new TextDecoder('latin1').decode(raw);
    if (!/\brg\b|\bRG\b/.test(text)) continue;

    const modified = substitutePdfRgb(text, paletteMap, usedKeys);
    if (modified === text) continue;

    const modBytes = Uint8Array.from(modified, c => c.charCodeAt(0));
    const recompressed = await deflateBytes(modBytes);

    // PDFRawStream.contents is readonly in TypeScript but a plain own property
    // at runtime — assign directly.
    obj.contents = recompressed;
    dict.set(PDFName.of('Length'), PDFNumber.of(recompressed.length));
    if (!filter) dict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
  }

  // Print finishing in DeviceCMYK, drawn after the colour swap so registration
  // marks land on every plate (1 1 1 1) and aren't re-mapped by the RGB→CMYK pass.
  // The verification bar shows pairs for only the brand inks that actually
  // substituted in this artwork — rebuild the marks geometry from that used set
  // now that the substitution pass has run (page size is palette-independent).
  if (geo) {
    const page = pdfDoc.getPage(0);
    setPageBoxes(page, geo);
    const usedPalette = (opts.palette ?? []).filter(p => usedKeys.has(paletteHitKey(p)));
    const marksGeo = printGeometry(node, opts, usedPalette) ?? geo;
    await drawPrintMarks(page, marksGeo, { space: 'cmyk', labels: provenanceLabels(opts.meta) });
  }

  const out = await pdfDoc.save();
  return new Blob([out], { type: 'application/pdf' });
}

// Builds a lookup map from quantised RGB keys (derived from palette hex values)
// to CMYK 4-tuples in 0–1 range. Used by substitutePdfRgb for exact brand matches.
function buildCmykPaletteMap(palette) {
  const map = new Map();
  for (const { hex, cmyk } of palette) {
    if (!hex || !cmyk || cmyk.length !== 4) continue;
    const h = hex.replace('#', '').toLowerCase();
    if (h.length !== 6) continue;
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    map.set(cmykKey(r, g, b), cmyk.map(v => v / 100));
  }
  return map;
}

// Quantise an RGB triple (0–1) to a brand-match key. The precision MUST match
// what jsPDF writes into the content stream: it emits colour operators at two
// decimals (254/255 → "1.", 124/255 → "0.49"), so the palette side has to bucket
// to two decimals too — a 3-decimal key never matches jsPDF's "0.49" against the
// hex-exact 0.486, and every brand colour silently falls through to the generic
// conversion. No 0–255 channel lands on a .5 boundary at ×100, so jsPDF's
// toFixed(2) and Math.round always agree.
function cmykKey(r, g, b) {
  return `${Math.round(r * 100)},${Math.round(g * 100)},${Math.round(b * 100)}`;
}

// The quantised key a palette entry is matched on (mirrors buildCmykPaletteMap),
// so usedKeys recorded during substitution can be filtered back to entries.
function paletteHitKey(p) {
  const h = (p?.hex ?? '').replace('#', '').toLowerCase();
  if (h.length !== 6) return null;
  return cmykKey(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
}

// Adds an OutputIntent declaring the target CMYK press condition to the document
// catalog. The condition descriptor (registered name / info / registry) comes
// from the engine; 'srgb'/undefined falls back to the default press condition.
function addCmykOutputIntent(pdfDoc, name, PDFName, PDFString) {
  const cond = cmykCondition(name === 'srgb' ? undefined : name);
  const intent = pdfDoc.context.obj({
    Type: 'OutputIntent',
    S: 'GTS_PDFX',
    OutputConditionIdentifier: PDFString.of(cond.identifier),
    OutputCondition: PDFString.of(cond.info),
    Info: PDFString.of(cond.info),
    RegistryName: PDFString.of(cond.registry),
  });
  const catalog = pdfDoc.catalog;
  const key = PDFName.of('OutputIntents');
  let arr = catalog.lookup(key);
  if (!arr) { arr = pdfDoc.context.obj([]); catalog.set(key, arr); }
  arr.push(intent);
}

// Converts PDF-space RGB (0–1) to CMYK (0–1), preferring an exact palette match
// (measured brand inks) before the engine's generic device-CMYK conversion. On a
// brand match the matched key is recorded in `used`, so the verification colour
// bar can show only the inks that were actually substituted.
function pdfRgbToCmyk(r, g, b, paletteMap, used) {
  const key = cmykKey(r, g, b);
  const hit = paletteMap.get(key);
  if (hit) { used?.add(key); return hit; }
  return rgbToCmyk(r, g, b);
}

// Formats a CMYK component (0–1) as a compact decimal string for PDF output.
function cmykN(v) {
  return v.toFixed(4).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') || '0';
}

// Replaces `r g b rg` and `r g b RG` operators with their CMYK equivalents.
// `used` (optional) collects the brand palette keys that matched.
function substitutePdfRgb(text, paletteMap, used) {
  const N = '([+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)';
  const W = '[\\s]+';
  return text
    .replace(new RegExp(`${N}${W}${N}${W}${N}${W}\\brg\\b`, 'g'), (_, r, g, b) => {
      const [c, m, y, k] = pdfRgbToCmyk(+r, +g, +b, paletteMap, used);
      return `${cmykN(c)} ${cmykN(m)} ${cmykN(y)} ${cmykN(k)} k`;
    })
    .replace(new RegExp(`${N}${W}${N}${W}${N}${W}\\bRG\\b`, 'g'), (_, r, g, b) => {
      const [c, m, y, k] = pdfRgbToCmyk(+r, +g, +b, paletteMap, used);
      return `${cmykN(c)} ${cmykN(m)} ${cmykN(y)} ${cmykN(k)} K`;
    });
}

// Decompresses a zlib/FlateDecode byte buffer using the browser Streams API.
async function inflateBytes(data) {
  return pipeThroughTransform(new DecompressionStream('deflate'), data);
}

// Compresses bytes to zlib/FlateDecode format using the browser Streams API.
async function deflateBytes(data) {
  return pipeThroughTransform(new CompressionStream('deflate'), data);
}

async function pipeThroughTransform(transform, data) {
  const writer = transform.writable.getWriter();
  writer.write(data);
  writer.close();
  const reader = transform.readable.getReader();
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let i = 0;
  for (const c of chunks) { out.set(c, i); i += c.length; }
  return out;
}


function svgLen(val, total) {
  if (!val) return 0;
  const s = String(val);
  if (s.endsWith('%')) return (parseFloat(s) / 100) * total;
  return parseFloat(s) || 0;
}

function resolveColor(el) {
  const attr = el.getAttribute('fill');
  if (attr && attr !== 'currentColor') return parseSvgColor(attr);
  const styleAttr = el.getAttribute('style') ?? '';
  const styleMatch = styleAttr.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/);
  if (styleMatch) return parseSvgColor(styleMatch[1].trim());
  const computed = typeof window !== 'undefined' ? window.getComputedStyle(el).fill : null;
  return computed ? parseSvgColor(computed) : null;
}

function parseSvgColor(color) {
  if (!color) return null;
  const lc = color.toLowerCase().trim();
  if (lc === 'none' || lc === 'transparent') return null;
  if (lc === 'white') return [255, 255, 255];
  if (lc === 'black') return [0, 0, 0];
  if (lc.startsWith('#')) {
    const h = lc.slice(1);
    if (h.length === 3) return [
      parseInt(h[0]+h[0], 16), parseInt(h[1]+h[1], 16), parseInt(h[2]+h[2], 16),
    ];
    if (h.length === 6) return [
      parseInt(h.slice(0,2), 16), parseInt(h.slice(2,4), 16), parseInt(h.slice(4,6), 16),
    ];
  }
  const m = lc.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]];
  return null;
}

// Ensures a canvas is exactly w×h logical pixels. dom-to-image-more may return
// a physical-pixel canvas (canvas.width = w * devicePixelRatio) on HiDPI screens,
// which causes toBlob and getImageData to encode/read only a zoomed-in crop.
// Drawing through an intermediate canvas normalises to the requested dimensions.
function normalizeCanvas(src, w, h) {
  if (src.width === w && src.height === h) return src;
  const out = document.createElement('canvas');
  out.width  = w;
  out.height = h;
  out.getContext('2d').drawImage(src, 0, 0, w, h);
  return out;
}

// Replaces blob: URLs in-place on the live node and returns a function that
// restores the originals. Used for raster exports so dom-to-image-more receives
// the fully styled live node rather than a detached clone.
async function swapBlobUrls(node) {
  const swaps = [];
  await Promise.all([...node.querySelectorAll('image, img')].map(async el => {
    for (const attr of ['href', 'src']) {
      const url = el.getAttribute(attr);
      if (url?.startsWith('blob:')) {
        try {
          el.setAttribute(attr, await blobToDataUrl(url));
          swaps.push({ el, attr, url });
        } catch { /* leave as-is */ }
      }
    }
  }));
  return () => swaps.forEach(({ el, attr, url }) => el.setAttribute(attr, url));
}

// Replaces blob: URLs in-place on a detached clone. Used by renderSvg which
// owns its clone and just needs self-contained data URLs in the saved file.
async function inlineBlobUrlsInEl(el) {
  const candidates = el.querySelectorAll('image, img');
  await Promise.all([...candidates].map(async img => {
    for (const attr of ['href', 'src']) {
      const url = img.getAttribute(attr);
      if (url?.startsWith('blob:')) {
        try {
          img.setAttribute(attr, await blobToDataUrl(url));
        } catch { /* leave as-is; export will degrade gracefully */ }
      }
    }
  }));
}

async function blobToDataUrl(url) {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(/** @type {string} */(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Pick the jsPDF.addImage format from a data: URL's REAL MIME (the previous
// `.includes('image/png')` guess silently misclassified WebP/AVIF/GIF user images
// as PNG, so jsPDF dropped them). PNG/JPEG/WebP are passed through as the formats
// jsPDF accepts; anything else jsPDF can't embed (AVIF/GIF/BMP…) is rasterised to
// PNG via a canvas first. Non-data / unrecognised sources keep the old PNG fallback.
async function imageForPdf(src) {
  const mime = (/^data:([^;,]+)/i.exec(src)?.[1] || '').toLowerCase();
  if (mime === 'image/png')  return { src, fmt: 'PNG' };
  if (mime === 'image/jpeg' || mime === 'image/jpg') return { src, fmt: 'JPEG' };
  if (mime === 'image/webp') return { src, fmt: 'WEBP' };
  if (mime.startsWith('image/')) {
    try { return { src: await rasterizeToPng(src), fmt: 'PNG' }; }
    catch { return { src, fmt: 'PNG' }; }
  }
  return { src, fmt: 'PNG' };
}

// Decode any image source the browser understands and re-encode it as a PNG data
// URL, so a format jsPDF can't embed natively can still be placed.
async function rasterizeToPng(src) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const canvas = document.createElement('canvas');
  canvas.width  = img.naturalWidth  || img.width;
  canvas.height = img.naturalHeight || img.height;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
}

const WEBM_CODECS = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
const MP4_CODECS  = ['video/mp4;codecs=h264', 'video/mp4;codecs=avc1', 'video/mp4'];

// True only if this browser's MediaRecorder pipeline is usable at all (it also
// needs canvas.captureStream).
function canRecord() {
  return typeof MediaRecorder !== 'undefined' &&
         typeof HTMLCanvasElement !== 'undefined' &&
         typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

// Which video containers this browser can actually record. Safari/iOS = mp4 only;
// Firefox = webm only; recent Chrome = both. The view uses this to gate the format
// picker so users only see formats their browser can produce.
export function videoSupport() {
  const ok = t => canRecord() && (MediaRecorder.isTypeSupported?.(t) ?? false);
  return { webm: WEBM_CODECS.some(ok), mp4: MP4_CODECS.some(ok) };
}

// Best recorder mime, preferring the requested container ('webm' | 'mp4') but
// falling back to the other so a deep-link/CLI request still produces a video.
// Returns null when no container is recordable.
export function videoMimeType(preferred) {
  if (!canRecord()) return null;
  const order = preferred === 'mp4' ? [...MP4_CODECS, ...WEBM_CODECS] : [...WEBM_CODECS, ...MP4_CODECS];
  return order.find(t => MediaRecorder.isTypeSupported?.(t)) ?? null;
}

// Container MIME for the output Blob, derived from the chosen recorder mime.
function videoContainer(mime) {
  return mime && mime.includes('mp4') ? 'video/mp4' : 'video/webm';
}

const NO_VIDEO_MSG = 'Video recording is not supported in this browser. Use GIF instead, or try Chrome or Firefox for WebM.';

// A FrameSource turns a live DOM node into a sequence of rendered frames that
// share ONE capture timeline. Motion encoders (webm/mp4 via renderVideo, gif via
// renderGif — and future apng / image-sequence / spritesheet / favicon) consume it
// instead of each re-implementing the capture loop.
//
// Capture semantics match the original per-encoder loops: blob: URLs are swapped
// to data URLs once up front (so dom-to-image can inline them), CSS animations get
// `opts.wait` seconds to settle before the first frame, then each frame() renders
// the CURRENT animation state via dom-to-image toCanvas(). Sequential frame() calls
// advance the animation in real time (the await between them is the spacing), so
// every frame is a distinct moment — no duplicate or skipped frames.
//
//   width / height — target pixel size (defaults to the node's box)
//   frame()        — Promise<HTMLCanvasElement> for the current moment
//   dispose()      — restore the blob:-URL swap; call once capture is done
async function createFrameSource(node, opts = {}) {
  const lib = await getDomToImage();
  const { width: nodeW, height: nodeH } = node.getBoundingClientRect();
  const targetW = (opts.width  > 0) ? opts.width  : nodeW;
  const targetH = (opts.height > 0) ? opts.height : nodeH;
  const dtoOpts = {
    width:  targetW,
    height: targetH,
    style: {
      transform:       `scale(${targetW / nodeW})`,
      transformOrigin: 'top left',
      width:  `${nodeW}px`,
      height: `${nodeH}px`,
    },
  };
  const restore = await swapBlobUrls(node);
  const waitMs = (opts.wait ?? 1) * 1000;
  let settled = false;
  return {
    width: targetW,
    height: targetH,
    async frame() {
      if (!settled) { await new Promise(r => setTimeout(r, waitMs)); settled = true; }
      return lib.toCanvas(node, dtoOpts);
    },
    dispose() { restore(); },
  };
}

// ── Favicon / ICO ─────────────────────────────────────────────────────────────
// Renders the node into a multi-resolution .ico (16/32/48 px PNG entries). Best
// suited to square marks/logos; non-square content is scaled to the box.
const ICO_SIZES = [16, 32, 48];
async function renderIco(node, opts) {
  const sizes = opts.icoSizes ?? ICO_SIZES;
  const entries = [];
  for (const size of sizes) {
    // wait:0 — favicons are static, so there's no animation to settle.
    const src = await createFrameSource(node, { width: size, height: size, wait: 0 });
    let canvas;
    try { canvas = await src.frame(); } finally { src.dispose(); }
    const blob = await new Promise((res, rej) =>
      canvas.toBlob(b => b ? res(b) : rej(new Error('ICO frame encode failed')), 'image/png'));
    entries.push({ size, bytes: new Uint8Array(await blob.arrayBuffer()) });
  }
  return packIco(entries);
}

// Pack PNG entries into an ICO container: ICONDIR + ICONDIRENTRY[] + PNG data.
function packIco(entries) {
  const count = entries.length;
  const header = new Uint8Array(6 + count * 16);
  const dv = new DataView(header.buffer);
  dv.setUint16(0, 0, true);      // reserved
  dv.setUint16(2, 1, true);      // type 1 = icon
  dv.setUint16(4, count, true);  // image count
  let offset = header.length;
  entries.forEach((e, i) => {
    const o = 6 + i * 16;
    header[o]     = e.size >= 256 ? 0 : e.size; // width  (0 ⇒ 256)
    header[o + 1] = e.size >= 256 ? 0 : e.size; // height (0 ⇒ 256)
    dv.setUint16(o + 4, 1, true);               // colour planes
    dv.setUint16(o + 6, 32, true);              // bits per pixel
    dv.setUint32(o + 8, e.bytes.length, true);  // bytes in resource
    dv.setUint32(o + 12, offset, true);         // offset to data
    offset += e.bytes.length;
  });
  const out = new Uint8Array(offset);
  out.set(header, 0);
  let p = header.length;
  for (const e of entries) { out.set(e.bytes, p); p += e.bytes.length; }
  return new Blob([out], { type: 'image/x-icon' });
}

// ── ZIP bundle ────────────────────────────────────────────────────────────────
// Bundles several of the tool's render formats into one archive. The shell passes
// opts.bundleFormats (visual formats only — data/video are excluded). Each entry
// renders through renderFormat on the already-watermarked node, then is zipped.
async function renderZip(node, opts) {
  const { zipSync } = await import('fflate');
  const base = (opts.filename || 'export').replace(/\.[a-z0-9]+$/i, '') || 'export';
  const files = {};
  for (const f of (opts.bundleFormats ?? []).filter(x => x !== 'zip')) {
    const blob = await renderFormat(node, f, opts);
    const name = f === 'pdf-cmyk' ? `${base}-print.pdf` : `${base}.${f === 'jpeg' ? 'jpg' : f}`;
    files[name] = new Uint8Array(await blob.arrayBuffer());
  }
  return new Blob([zipSync(files)], { type: 'application/zip' });
}

// Renders the DOM node into a video using captureStream() + MediaRecorder.
//
// Two-phase approach to guarantee stable frame rate regardless of render speed:
//   Phase 1 — render: each frame is captured sequentially via toCanvas() and
//     stored as an ImageBitmap (GPU memory). Takes longer than real-time on
//     slow machines but ensures every frame is visually unique.
//   Phase 2 — replay: pre-rendered frames are painted to an offscreen canvas
//     at exactly the target fps while MediaRecorder encodes the stream.
//
// opts.wait     — seconds to let CSS animations settle before recording starts (default 1)
// opts.duration — length of the recorded clip in seconds (default 5)
//
// Hard ceiling on buffered frames (Phase 1 holds one ImageBitmap each). A normal
// clip is well under this; it exists to bound memory when duration/fps are pushed
// past the UI limits via the URL, which would otherwise OOM a mobile WebView.
const MAX_VIDEO_FRAMES = 600;
async function renderVideo(node, opts, preferred) {
  const mimeType = videoMimeType(preferred);
  if (!mimeType) throw new Error(NO_VIDEO_MSG);

  if (typeof node.captureStream === 'function') {
    // node itself is a canvas — use it directly (rare but possible)
    const waitMs     = (opts.wait     ?? 1) * 1000;
    const durationMs = (opts.duration ?? 5) * 1000;
    await new Promise(r => setTimeout(r, waitMs));
    return recordStream(node.captureStream(30), { durationMs, mimeType });
  }

  const fps        = opts.fps ?? 24;
  const frameMs    = 1000 / fps;
  const durationMs = (opts.duration ?? 5) * 1000;
  let   frameCount = Math.ceil(durationMs / frameMs);

  // Phase 1 buffers every frame as an ImageBitmap before replay, so the frame
  // count is the memory ceiling. Clamp it so a long/high-fps request (the duration
  // limit is bypassable via the URL) can't queue hundreds of bitmaps and OOM a
  // mobile WebView. The cap is generous for normal clips; beyond it the clip is
  // truncated and we warn through the log channel.
  if (frameCount > MAX_VIDEO_FRAMES) {
    _host?.log?.('warn', `Video capped at ${MAX_VIDEO_FRAMES} frames (requested ${frameCount}); lower the duration or frame rate for a longer clip.`);
    frameCount = MAX_VIDEO_FRAMES;
  }

  // Phase 1: render all frames sequentially through the shared FrameSource.
  // Animation advances in real time between frames, so each captures a unique
  // state — recording takes longer than real-time but never duplicates/skips.
  const source  = await createFrameSource(node, opts);
  const targetW = source.width, targetH = source.height;
  const frames  = [];
  try {
    for (let i = 0; i < frameCount; i++) {
      frames.push(await createImageBitmap(await source.frame()));
      // Progress for a slow N-frame render (no-op when no listener is wired).
      opts.onProgress?.(i + 1, frameCount);
    }
  } finally {
    source.dispose();
  }

  // Phase 2: replay pre-rendered frames at target fps into captureStream.
  // drawImage(bitmap) is near-instant so the replay timing is stable.
  const offscreen = document.createElement('canvas');
  offscreen.width  = targetW;
  offscreen.height = targetH;
  const ctx    = offscreen.getContext('2d');
  const stream = offscreen.captureStream(fps);

  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks   = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise((resolve, reject) => {
    recorder.onerror = e => reject(e.error ?? new Error('MediaRecorder error'));
    recorder.onstop  = () => {
      stream.getTracks().forEach(t => t.stop());
      frames.forEach(b => b.close());
      resolve(new Blob(chunks, { type: videoContainer(mimeType) }));
    };

    let fi = 0;
    recorder.start();

    function paintNext() {
      if (fi >= frames.length) { recorder.stop(); return; }
      ctx.drawImage(frames[fi++], 0, 0);
      setTimeout(paintNext, frameMs);
    }
    paintNext();
  });
}

function recordStream(stream, { durationMs = 5000, mimeType = videoMimeType() } = {}) {
  if (!mimeType) throw new Error(NO_VIDEO_MSG);
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks   = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise((resolve, reject) => {
    recorder.onerror = e => reject(e.error ?? new Error('MediaRecorder error'));
    recorder.onstop  = () => resolve(new Blob(chunks, { type: videoContainer(mimeType) }));
    recorder.start();
    setTimeout(() => recorder.stop(), durationMs);
  });
}

// Renders the DOM node as an animated GIF.
//
// Each frame is rendered sequentially via toCanvas() so every GIF frame
// captures a unique animation state — no duplicate or stale frames.
// Recording takes longer than real-time on slow machines, but the output
// plays back at the intended speed because timing is in the GIF delay metadata.
//
// opts.wait     — seconds before capture starts (default 1)
// opts.duration — clip length in seconds (default 5)
// opts.dither   — Floyd-Steinberg dithering (default false)
async function renderGif(node, opts) {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');

  const fps           = 15;
  const frameInterval = Math.round(1000 / fps); // 67ms → rounds to 70ms in GIF centiseconds
  const durationMs    = (opts.duration ?? 5) * 1000;
  const frameCount    = Math.max(1, Math.round(durationMs / frameInterval));
  const dither        = Boolean(opts.dither);

  // Shared FrameSource: same sequential, real-time capture as the video path.
  const source  = await createFrameSource(node, opts);
  const targetW = source.width, targetH = source.height;

  const offscreen = document.createElement('canvas');
  offscreen.width  = targetW;
  offscreen.height = targetH;
  const offCtx = offscreen.getContext('2d');

  try {
    const gif = GIFEncoder();
    let palette = null;

    // Dither scratch buffers are allocated ONCE and reused for every frame: the
    // global palette is fixed after frame 0, so the per-frame ~14MB error buffer
    // and the 64KB nearest-colour cache (previously re-allocated and re-cleared each
    // frame) can persist for the whole clip. The cache stays valid because the
    // palette never changes; output is byte-identical to per-frame allocation.
    const ditherState = dither ? createDitherState(targetW, targetH) : null;

    const encodeFrame = (pixels) => dither
      ? ditherFloydSteinberg(pixels, targetW, targetH, palette, ditherState)
      : applyPalette(pixels, palette);

    for (let i = 0; i < frameCount; i++) {
      const canvas = await source.frame();
      offCtx.clearRect(0, 0, targetW, targetH);
      offCtx.drawImage(canvas, 0, 0, targetW, targetH);
      const pixels = offCtx.getImageData(0, 0, targetW, targetH).data;

      if (i === 0) {
        // Build global palette from the first frame; reuse for all subsequent frames.
        palette = quantize(pixels, 256);
        gif.writeFrame(encodeFrame(pixels), targetW, targetH, { palette, delay: frameInterval, repeat: opts.repeat != null ? opts.repeat : 0 });
      } else {
        gif.writeFrame(encodeFrame(pixels), targetW, targetH, { delay: frameInterval });
      }
      // Progress for a slow N-frame render (no-op when no listener is wired).
      opts.onProgress?.(i + 1, frameCount);
    }

    gif.finish();
    let bytes = gif.bytesView();
    if (opts.meta) {
      const credit = [opts.meta.description, opts.meta.contact, opts.meta.source].filter(Boolean).join(' · ');
      bytes = withGifComment(bytes, credit);
    }
    return new Blob([bytes], { type: 'image/gif' });
  } finally {
    source.dispose();
  }
}

// Allocates the reusable scratch buffers for the Floyd-Steinberg path. Hoisted out
// of ditherFloydSteinberg so an animated GIF can keep ONE set of buffers across all
// frames: the error buffer is re-seeded from each frame's pixels, and the nearest
// -colour cache is carried over (the palette is fixed after frame 0, so cached
// lookups stay correct). `out` is fully overwritten every frame, so no reset needed.
function createDitherState(width, height) {
  const n = width * height;
  return {
    out:   new Uint8Array(n),
    buf:   new Float32Array(n * 3),       // diffused error, may exceed [0,255]
    cache: new Int16Array(32768).fill(-1), // 15-bit (5 bits/channel) nearest cache
  };
}

// Floyd-Steinberg ordered dithering.
// Quantizes pixels to the given palette while propagating quantisation error
// to neighbouring pixels to reduce colour banding. Returns a Uint8Array of
// palette indices, matching the layout expected by gifenc's writeFrame().
//
// Cache note: nearest-palette lookups are memoised by a 15-bit colour key
// (5 bits per channel). This trades a tiny amount of precision for a large
// speed improvement — especially effective for flat-colour brand graphics.
//
// `state` (from createDitherState) lets a multi-frame caller reuse the buffers
// across frames; absent, a fresh set is allocated for this single call.
function ditherFloydSteinberg(data, width, height, palette, state) {
  const n   = width * height;
  const st  = state ?? createDitherState(width, height);
  const out = st.out;

  // Float RGB buffer — accumulates diffused error beyond [0,255]. Re-seeded from
  // this frame's pixels (so a reused buffer carries no error from the prior frame).
  const buf = st.buf;
  for (let i = 0; i < n; i++) {
    buf[i * 3]     = data[i * 4];
    buf[i * 3 + 1] = data[i * 4 + 1];
    buf[i * 3 + 2] = data[i * 4 + 2];
  }

  // Nearest-palette memoisation keyed on a 5-bit-per-channel approximation.
  // Persisted across frames via `state` — valid because the palette is fixed.
  const cache = st.cache;
  function nearest(r, g, b) {
    const key = (r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10);
    if (cache[key] >= 0) return cache[key];
    let best = 0, bestD = Infinity;
    for (let c = 0; c < palette.length; c++) {
      const pc = palette[c];
      const d  = (r - pc[0]) ** 2 + (g - pc[1]) ** 2 + (b - pc[2]) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    return (cache[key] = best);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const p = i * 3;

      const r = Math.round(Math.max(0, Math.min(255, buf[p])));
      const g = Math.round(Math.max(0, Math.min(255, buf[p + 1])));
      const b = Math.round(Math.max(0, Math.min(255, buf[p + 2])));

      const idx    = nearest(r, g, b);
      out[i]       = idx;

      const pc = palette[idx];
      const er = r - pc[0];
      const eg = g - pc[1];
      const eb = b - pc[2];

      // Diffuse error: right=7/16, bottom-left=3/16, bottom=5/16, bottom-right=1/16
      if (x + 1 < width) {
        const q = p + 3;
        buf[q] += er * 0.4375; buf[q+1] += eg * 0.4375; buf[q+2] += eb * 0.4375;
      }
      if (y + 1 < height) {
        if (x > 0) {
          const q = p + width * 3 - 3;
          buf[q] += er * 0.1875; buf[q+1] += eg * 0.1875; buf[q+2] += eb * 0.1875;
        }
        const q0 = p + width * 3;
        buf[q0] += er * 0.3125; buf[q0+1] += eg * 0.3125; buf[q0+2] += eb * 0.3125;
        if (x + 1 < width) {
          const q1 = p + width * 3 + 3;
          buf[q1] += er * 0.0625; buf[q1+1] += eg * 0.0625; buf[q1+2] += eb * 0.0625;
        }
      }
    }
  }

  return out;
}

// Injects a watermark stamp directly on the live node and returns a cleanup fn.
// Using a live overlay (not a detached clone) keeps getComputedStyle working,
// which is required by dom-to-image-more and captureStream-based video capture.
function addWatermarkOverlay(node) {
  const stamp = document.createElement('div');
  stamp.textContent = 'EXPERIMENTAL — NOT BRAND APPROVED';
  Object.assign(stamp.style, {
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    padding: '4px 8px',
    background: 'rgba(255, 255, 255, 0.85)',
    color: '#c0392b',
    font: 'bold 10px monospace',
    border: '1px solid #c0392b',
    pointerEvents: 'none',
    zIndex: '9999',
  });
  const prevPosition = node.style.position;
  if (!node.style.position) node.style.position = 'relative';
  node.appendChild(stamp);
  return () => {
    stamp.remove();
    node.style.position = prevPosition;
  };
}

// ── Text-based export formats ─────────────────────────────────────────────────

// Standalone HTML document with the tool's template CSS and baked-in content.
// The fitting script is stripped — the computed font-size is already on the element.
function renderStaticHtml(node) {
  const styles = [...node.querySelectorAll('style')].map(s => s.textContent).join('\n');
  const clone = node.cloneNode(true);
  clone.querySelectorAll('style, script').forEach(el => el.remove());
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100dvh; background: #555; padding: 16px; }
${styles}
</style>
</head>
<body>
${clone.outerHTML}
</body>
</html>`;
  return new Blob([doc], { type: 'text/html' });
}

// Recursive DOM walker shared by markdown and plain-text exports.
// Skips aria-hidden elements, <style>, <script>, and <img>.
function walkDom(node, handlers) {
  if (node.nodeType === 3) return handlers.text(node.textContent);
  if (node.nodeType !== 1) return '';
  if (node.getAttribute('aria-hidden') === 'true') return '';
  const tag = node.tagName.toLowerCase();
  if (tag === 'style' || tag === 'script' || tag === 'img') return '';
  if (tag === 'br') return handlers.br?.() ?? '\n';
  const inner = [...node.childNodes].map(n => walkDom(n, handlers)).join('');
  return handlers.element?.(tag, inner, node) ?? inner;
}

function renderMarkdown(node) {
  const handlers = {
    text: t => t,
    br: () => '\n',
    element(tag, inner) {
      const s = inner.trim();
      switch (tag) {
        case 'strong': case 'b': return s ? `**${s}**` : '';
        case 'em':     case 'i': return s ? `*${s}*`   : '';
        case 'p':   return s ? s + '\n\n' : '';
        case 'h1':  return s ? `# ${s}\n\n` : '';
        case 'h2':  return s ? `## ${s}\n\n` : '';
        case 'h3':  return s ? `### ${s}\n\n` : '';
        case 'blockquote': return s ? `> ${s.replace(/\n/g, '\n> ')}\n\n` : '';
        case 'a':   return inner; // href not useful without context
        default:    return inner;
      }
    },
  };
  const md = walkDom(node, handlers).replace(/\n{3,}/g, '\n\n').trim();
  return new Blob([md + '\n'], { type: 'text/markdown' });
}

function renderPlainText(node) {
  const handlers = {
    text: t => t,
    br: () => '\n',
    element(tag, inner) {
      const s = inner.trim();
      switch (tag) {
        case 'p':  return s ? s + '\n\n' : '';
        case 'h1': case 'h2': case 'h3': return s ? s + '\n\n' : '';
        case 'blockquote': return s ? s + '\n\n' : '';
        default:   return inner;
      }
    },
  };
  const text = walkDom(node, handlers).replace(/\n{3,}/g, '\n\n').trim();
  return new Blob([text + '\n'], { type: 'text/plain' });
}
