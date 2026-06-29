/**
 * Logo Wall — vector hook.
 *
 * Raster mode (the default) renders a grid of <img> tiles. The hook builds the
 * per-logo list (buildItems): url, opacity, grayscale and an effective size that
 * folds in optical-weight balancing (heavier logos shrink, lighter grow). Sizes
 * are inline styles + a baked grayscale filter, which the SVG/PDF export walker
 * reproduces faithfully. Pixels are only sampled when balancing is on (a small
 * weight measurement), not for the visual itself.
 *
 * "Render as vector" is a PER-LOGO block setting: each logo is independently an
 * <img> (raster) or flattened to one ink colour. The wall is always the same CSS
 * grid of cells; a vectorised cell holds a small inline <svg> instead of an <img>,
 * sized identically (the balanced size%) so toggling a logo never reflows the wall.
 *   - a raster logo is decoded on an offscreen <canvas>, thresholded to 1-bit (the
 *     background dropped first so a solid tile never traces as a square), and traced —
 *     marching-squares boundary → Douglas–Peucker simplify → corner-aware cubic
 *     Béziers (smooth real paths, holes via even-odd fill);
 *   - an SVG logo is inlined verbatim and recoloured (no trace), so it stays
 *     pixel-perfect; <style>/class paint is stripped so the single ink always wins.
 * Each cell's inline <svg> is solid-fill, so SVG export keeps it vector and the PDF
 * walker draws it as true vector (only gradient/filter SVGs would rasterise).
 *
 * Each logo is fitted to its own CONTENT box (margins trimmed, measured at a fixed
 * sample size) so huge and tiny copies normalise alike; optical-weight balancing
 * then sizes by artwork footprint so the wall reads evenly.
 *
 * Efficiency: decoded images, traced paths, inlined SVGs and content boxes are each
 * cached per URL; each logo's traced grid is capped (MAX_CELLS_PER_LOGO); stale
 * caches are pruned to the logos currently on the wall.
 *
 * Pixel decoding needs a real browser <canvas>. In a headless shell (CLI/jsdom)
 * there's none, so a vectorised logo falls back to its raster <img>.
 */

// Upper bound on a single logo's sampling grid, so a high Detail on a big logo
// can't blow up tracing time/output (≈ a 330×330 grid).
var MAX_CELLS_PER_LOGO = 110000;

// Decoded-image cache: url -> in-flight Promise<Image> (shared across re-renders).
var _imgCache = {};
// Traced-path cache: key -> { d, cols, rows } in grid-unit coords.
var _traceCache = {};
// Content-box cache: url -> { fx, fy, fw, fh, weight } — the artwork's bounding box
// as fractions of the image (margins trimmed) plus its ink coverage, both measured
// at a fixed sample size so source resolution doesn't matter. Drives layout + balance.
var _boxCache = {};
// Inlined-SVG cache: url -> Promise<{ inner, vbx, vby, vbw, vbh }> for vector
// logos, which are inlined (and recoloured) rather than traced.
var _svgCache = {};
// Remembered for beforeExport (which only sees format/opts).
var _transparent = false, _bg = '#ffffff';

// ── small helpers ────────────────────────────────────────────────────────────

function inputsFrom(model) { var o = {}; model.forEach(function (i) { o[i.id] = i.value; }); return o; }
function num(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function f2(v) { return Math.round(v * 100) / 100; }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// A valid-ish CSS colour string, or a fallback. Keeps stray input out of the SVG.
function color(v, fallback) { var s = (typeof v === 'string' ? v : '').trim(); return s ? s : fallback; }

// Whether this shell can decode pixels (a real browser canvas with a 2D context).
function canRaster() {
  if (typeof document === 'undefined' || !document.createElement) return false;
  try { var c = document.createElement('canvas'); return !!(c.getContext && c.getContext('2d')); }
  catch (e) { return false; }
}

function loadImage(url) {
  return new Promise(function (resolve, reject) {
    if (typeof Image === 'undefined') { reject(new Error('no Image')); return; }
    var im = new Image();
    im.onload = function () { resolve(im); };
    im.onerror = function () { reject(new Error('image load failed')); };
    try { im.crossOrigin = 'anonymous'; } catch (e) { /* ignore */ }
    im.src = url;
  });
}

function getImage(url) {
  if (_imgCache[url]) return _imgCache[url];
  var promise = loadImage(url);
  _imgCache[url] = promise;
  // Drop a failed load so a later attempt can retry rather than reuse the reject.
  promise.catch(function () { if (_imgCache[url] === promise) delete _imgCache[url]; });
  return promise;
}

// Sample an image into a cols×rows grid of raw luminance (0..255) + alpha (0..255).
// Raw (not composited onto white) so the threshold can treat transparency as
// "not ink" regardless of the underlying colour. Returns null with no 2D canvas.
function sampleRGBA(img, cols, rows) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  var c = document.createElement('canvas');
  c.width = cols; c.height = rows;
  var ctx = c.getContext && c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
  var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;
  ctx.clearRect(0, 0, cols, rows);
  ctx.drawImage(img, 0, 0, cols, rows);
  var data;
  try { data = ctx.getImageData(0, 0, cols, rows).data; }
  catch (e) { return null; } // tainted canvas (cross-origin asset)
  var lum = new Uint8Array(cols * rows), alpha = new Uint8Array(cols * rows);
  var r = new Uint8Array(cols * rows), g2 = new Uint8Array(cols * rows), b2 = new Uint8Array(cols * rows);
  for (var i = 0, p = 0; i < lum.length; i++, p += 4) {
    r[i] = data[p]; g2[i] = data[p + 1]; b2[i] = data[p + 2];
    lum[i] = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) | 0;
    alpha[i] = data[p + 3];
  }
  return { lum: lum, alpha: alpha, r: r, g: g2, b: b2, cols: cols, rows: rows };
}

// Resolution-independent CONTENT box + optical weight of a logo.
//
// Samples the image at a fixed longest edge S (so a 4000px and an 80px copy of the
// same logo measure identically), then finds the artwork's bounding box — trimming
// transparent margins, or, when the logo sits on a flat colour, margins matching
// that background. Returns the box as fractions of the image plus the ink coverage
// over that box (mean opacity×darkness), so layout fits each logo by its real
// content and balancing weighs heavy vs light artwork fairly regardless of how the
// source was cropped or exported. Weight is independent of the vector threshold, so
// dragging Threshold doesn't re-weigh. Cached per url.
function measureContent(url, img) {
  if (_boxCache[url]) return _boxCache[url];
  if (typeof document === 'undefined' || !document.createElement) return null;
  var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;
  var S = 96, cols, rows;                   // fixed sample, longest edge S
  if (iw >= ih) { cols = S; rows = Math.max(1, Math.round(S * ih / iw)); }
  else { rows = S; cols = Math.max(1, Math.round(S * iw / ih)); }

  var c = document.createElement('canvas');
  c.width = cols; c.height = rows;
  var ctx = c.getContext && c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, cols, rows);
  ctx.drawImage(img, 0, 0, cols, rows);
  var data;
  try { data = ctx.getImageData(0, 0, cols, rows).data; }
  catch (e) { return null; }                // tainted canvas (cross-origin asset)

  // A flat background fills every edge, so its colour shows in ALL four corners; if
  // even one corner is (near-)transparent the logo is alpha-keyed and alpha alone
  // marks content. The colour reference is the per-channel MEDIAN of the corners, so
  // a logo that runs into one corner doesn't poison it the way a mean would.
  function corner(x, y) { var p = (y * cols + x) * 4; return [data[p], data[p + 1], data[p + 2], data[p + 3]]; }
  var cs = [corner(0, 0), corner(cols - 1, 0), corner(0, rows - 1), corner(cols - 1, rows - 1)];
  function med4(a) { var s = a.slice().sort(function (m, n) { return m - n; }); return (s[1] + s[2]) / 2; }
  var bgOpaque = cs.filter(function (q) { return q[3] >= 32; }).length === 4;
  var bg = [0, 1, 2].map(function (k) { return med4([cs[0][k], cs[1][k], cs[2][k], cs[3][k]]); });

  var minX = cols, minY = rows, maxX = -1, maxY = -1, presence = 0, lumSum = 0;
  for (var y = 0; y < rows; y++) {
    for (var x = 0; x < cols; x++) {
      var p = (y * cols + x) * 4, a = data[p + 3];
      if (a < 24) continue;                 // transparent → background
      var content;
      if (!bgOpaque) {
        content = true;                     // any opaque pixel is artwork
      } else {
        var dr = data[p] - bg[0], dg = data[p + 1] - bg[1], db = data[p + 2] - bg[2];
        content = (dr * dr + dg * dg + db * db) > 1200;  // differs from the flat bg
      }
      if (!content) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      var cov = a / 255;
      presence += cov;                      // footprint of the artwork (any colour)
      lumSum += cov * (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]);
    }
  }

  var box;
  if (maxX < minX) {                        // nothing distinct from the bg → whole image
    box = { fx: 0, fy: 0, fw: 1, fh: 1, weight: 0.01, contentLum: 128, bgOpaque: bgOpaque, bg: bg };
  } else {
    var bw = maxX - minX + 1, bh = maxY - minY + 1, sq = Math.max(bw, bh);
    box = {
      fx: minX / cols, fy: minY / rows, fw: bw / cols, fh: bh / rows,
      // Optical weight = how much of the bounding SQUARE the artwork covers, by ANY
      // colour (not just darkness) — so a thin/tall mark reads light and a white or
      // reverse (light-on-dark) mark is weighed by its real footprint, fair under
      // invert and on dark backgrounds.
      weight: Math.max(0.01, presence / (sq * sq)),
      contentLum: presence ? lumSum / presence : 128,   // mean brightness of the artwork
      bgOpaque: bgOpaque, bg: bg,                        // reused by the trace to drop the background
    };
  }
  _boxCache[url] = box;
  return box;
}

// ── SVG logos: inline instead of trace ───────────────────────────────────────
// A logo that's already a vector (SVG) is inlined verbatim and recoloured to the
// ink colour — no rasterise-and-trace round-trip, so it stays pixel-perfect. The
// uploaded SVG was sanitised at ingest (DOMPurify, scripts stripped), so the
// markup is safe to inline.

// Drop fill/stroke paint from every element so the wrapping group's single ink
// shows through (a flat monochrome logo). Geometry is left untouched. Two shapes
// are preserved: a `fill:none` stays none (so an open line-art path doesn't flood
// into a blob), and an element that WAS stroked keeps a stroke set to currentColor
// (which the wrapper resolves to the ink) so stroke-only marks don't vanish.
function stripPaint(el) {
  var all = el.querySelectorAll('*');
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    var style = e.getAttribute('style') || '';
    var fillNone = /(?:^|;)\s*fill\s*:\s*none/i.test(style)
      || (e.getAttribute('fill') || '').trim().toLowerCase() === 'none';
    var strokeStyled = /(?:^|;)\s*stroke\s*:/i.test(style) && !/(?:^|;)\s*stroke\s*:\s*none/i.test(style);
    var strokeAttr = e.hasAttribute('stroke') && (e.getAttribute('stroke') || '').trim().toLowerCase() !== 'none';
    var hadStroke = strokeStyled || strokeAttr;
    e.removeAttribute('fill');
    e.removeAttribute('stroke');
    if (style) {
      style = style.replace(/(?:^|;)\s*(?:fill|stroke)\s*:[^;]*/gi, '');
      if (style.replace(/[;\s]/g, '')) e.setAttribute('style', style); else e.removeAttribute('style');
    }
    if (fillNone) e.setAttribute('fill', 'none');
    if (hadStroke) e.setAttribute('stroke', 'currentColor');
  }
}

// Resolve an SVG length attribute to user units; "%" is taken of `pctOf`.
function svgLen(v, fallback, pctOf) {
  if (v == null || v === '') return fallback;
  v = String(v).trim();
  if (v.charAt(v.length - 1) === '%') {
    var pct = parseFloat(v);
    return isFinite(pct) ? (pct / 100) * pctOf : fallback;
  }
  var num = parseFloat(v);
  return isFinite(num) ? num : fallback;
}

// Drop a full-bleed backing <rect>. Recolouring everything to one ink colour
// would otherwise turn a logo's background rectangle (often white or transparent
// originally) into a solid ink block over the artwork — the user only wants the
// logo's own shapes filled. We remove any <rect> that covers ~the whole viewBox
// (untransformed top-level case, which is how backing rects are nearly always
// authored). A rect using width/height="100%" is caught via svgLen.
function removeBackgroundRects(svg, vbx, vby, vbw, vbh) {
  if (!vbw || !vbh) return;
  var tol = 0.04;
  var rects = svg.querySelectorAll('rect');
  for (var i = 0; i < rects.length; i++) {
    var r = rects[i];
    var w = svgLen(r.getAttribute('width'), 0, vbw);
    var h = svgLen(r.getAttribute('height'), 0, vbh);
    var x = svgLen(r.getAttribute('x'), 0, vbw);
    var y = svgLen(r.getAttribute('y'), 0, vbh);
    var coversW = w >= vbw * (1 - tol) && x <= vbx + vbw * tol;
    var coversH = h >= vbh * (1 - tol) && y <= vby + vbh * tol;
    if (coversW && coversH && r.parentNode) r.parentNode.removeChild(r);
  }
}

// A width/height attribute as a plain number ONLY when unitless or px — %/em/etc.
// carry context we don't have, so reject them (→ 0, caller falls back to the
// viewBox guess) rather than mis-scale (parseFloat('1em') would yield 1).
function svgDim(v) {
  if (v == null) return 0;
  v = String(v).trim().replace(/px$/i, '');
  if (/[a-z%]/i.test(v)) return 0;
  var n = parseFloat(v);
  return isFinite(n) && n > 0 ? n : 0;
}

// Defence-in-depth: strip anything executable from inlined SVG markup, whatever
// its source (uploads are DOMPurify-sanitised at ingest; this also covers library
// SVGs and any post-ingest tampering). We only ever inline static geometry.
function hardenSvg(svg) {
  // <style> is dropped too: a class-based fill (the common Illustrator/Inkscape
  // "CSS"/"Style Elements" export, e.g. .st0{fill:#e2231a}) would otherwise beat the
  // wrapping group's ink and leak the source colour — breaking the one-ink wall — and
  // an @import / url() inside it would fetch off-device. Removing <style> + every
  // class attribute leaves the group ink the only paint source.
  var bad = svg.querySelectorAll('script, foreignObject, animate, animateTransform, animateMotion, set, style');
  for (var i = bad.length - 1; i >= 0; i--) { if (bad[i].parentNode) bad[i].parentNode.removeChild(bad[i]); }
  var all = svg.querySelectorAll('*');
  for (var j = 0; j < all.length; j++) {
    var e = all[j], attrs = e.attributes;
    e.removeAttribute('class');
    for (var k = attrs.length - 1; k >= 0; k--) {
      var name = attrs[k].name, low = name.toLowerCase(), val = attrs[k].value || '';
      if (low.indexOf('on') === 0) { e.removeAttribute(name); continue; }              // event handlers
      if ((low === 'href' || low === 'xlink:href' || low === 'src') && !/^\s*#/.test(val)) {
        e.removeAttribute(name); continue;                                             // keep only #fragment refs
      }
      if (/url\(\s*['"]?\s*(?:https?:|\/\/|data:text|javascript:)/i.test(val)) e.removeAttribute(name);
    }
  }
}

// Convert shapes the SVG→PDF path walker doesn't render (polygon, polyline,
// ellipse) into <path>, so inlined logos survive every export format.
// circle/rect/line are already handled by the walker.
function normalizeShapes(svg) {
  var doc = svg.ownerDocument, NS = 'http://www.w3.org/2000/svg';
  function repl(el, d) {
    if (!d) return;
    var path = doc.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    var tf = el.getAttribute('transform'); if (tf) path.setAttribute('transform', tf);
    if (el.parentNode) el.parentNode.replaceChild(path, el);
  }
  function ptsToPath(el, close) {
    var nums = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number).filter(isFinite);
    if (nums.length < 4) return '';
    var d = 'M' + nums[0] + ' ' + nums[1];
    for (var i = 2; i + 1 < nums.length; i += 2) d += 'L' + nums[i] + ' ' + nums[i + 1];
    return d + (close ? 'Z' : '');
  }
  var polys = svg.querySelectorAll('polygon');
  for (var a = polys.length - 1; a >= 0; a--) repl(polys[a], ptsToPath(polys[a], true));
  var lines = svg.querySelectorAll('polyline');
  for (var b = lines.length - 1; b >= 0; b--) repl(lines[b], ptsToPath(lines[b], false));
  var ells = svg.querySelectorAll('ellipse');
  for (var c = ells.length - 1; c >= 0; c--) {
    var e = ells[c];
    var cx = parseFloat(e.getAttribute('cx')) || 0, cy = parseFloat(e.getAttribute('cy')) || 0;
    var rx = parseFloat(e.getAttribute('rx')) || 0, ry = parseFloat(e.getAttribute('ry')) || 0;
    if (rx <= 0 || ry <= 0) continue;
    var kx = rx * 0.5522847498307936, ky = ry * 0.5522847498307936;
    repl(e, 'M' + (cx - rx) + ' ' + cy
      + 'C' + (cx - rx) + ' ' + (cy - ky) + ' ' + (cx - kx) + ' ' + (cy - ry) + ' ' + cx + ' ' + (cy - ry)
      + 'C' + (cx + kx) + ' ' + (cy - ry) + ' ' + (cx + rx) + ' ' + (cy - ky) + ' ' + (cx + rx) + ' ' + cy
      + 'C' + (cx + rx) + ' ' + (cy + ky) + ' ' + (cx + kx) + ' ' + (cy + ry) + ' ' + cx + ' ' + (cy + ry)
      + 'C' + (cx - kx) + ' ' + (cy + ry) + ' ' + (cx - rx) + ' ' + (cy + ky) + ' ' + (cx - rx) + ' ' + cy + 'Z');
  }
}

function parseSvg(text) {
  var out = { inner: '', vbx: 0, vby: 0, vbw: 0, vbh: 0 };
  if (typeof DOMParser === 'undefined') return out;
  var svg = new DOMParser().parseFromString(text, 'image/svg+xml').querySelector('svg');
  if (!svg) return out;
  var vb = svg.getAttribute('viewBox');
  if (vb) {
    var p = vb.split(/[\s,]+/).map(Number);
    if (p.length === 4) { out.vbx = p[0]; out.vby = p[1]; out.vbw = p[2]; out.vbh = p[3]; }
  }
  if (!out.vbw || !out.vbh) {
    out.vbw = svgDim(svg.getAttribute('width')) || out.vbw;
    out.vbh = svgDim(svg.getAttribute('height')) || out.vbh;
  }
  if (!out.vbw || !out.vbh) { out.vbw = out.vbw || 100; out.vbh = out.vbh || 100; }
  hardenSvg(svg);                                            // strip anything executable
  normalizeShapes(svg);                                      // polygon/polyline/ellipse → path
  removeBackgroundRects(svg, out.vbx, out.vby, out.vbw, out.vbh); // drop full-bleed backing rect
  stripPaint(svg);                                           // recolour to the ink fill
  out.inner = svg.innerHTML;
  return out;
}

function getSvg(url) {
  if (_svgCache[url]) return _svgCache[url];
  var promise = (typeof fetch === 'function'
    ? fetch(url).then(function (r) { return r.text(); })
    : Promise.reject(new Error('no fetch'))
  ).then(parseSvg);
  _svgCache[url] = promise;
  promise.catch(function () { if (_svgCache[url] === promise) delete _svgCache[url]; });
  return promise;
}

// ── raster → vector tracing ──────────────────────────────────────────────────
// Turn a logo's 1-bit ink mask into smooth filled paths rather than a grid of
// rectangles (which scales up looking pixelated): marching-squares boundary
// extraction → Douglas–Peucker simplification → corner-aware cubic-Bézier
// fitting. Output is real M / L / C / Z path data, with holes handled by
// even-odd fill — so it stays crisp at any size.

// Threshold the sampled image into a 1-bit ink mask (1 = ink). Only the artwork can
// become ink: transparent pixels never do, and on an opaque flat background, pixels
// matching that background colour never do either — so a logo delivered on a solid
// tile (white, black or a brand colour) traces to its mark, never a filled square.
function binarize(img, cols, rows, cutoff, invert, bgOpaque, bg) {
  var g = sampleRGBA(img, cols, rows);
  if (!g) return null;
  var lum = g.lum, alpha = g.alpha, r = g.r, gg = g.g, b = g.b;
  var mask = new Uint8Array(cols * rows);
  for (var i = 0; i < mask.length; i++) {
    var content;
    if (alpha[i] < 128) content = false;            // (near-)transparent → background
    else if (bgOpaque) {
      var dr = r[i] - bg[0], dg = gg[i] - bg[1], db = b[i] - bg[2];
      content = (dr * dr + dg * dg + db * db) > 1200; // differs from the flat background
    } else content = true;
    if (!content) { mask[i] = 0; continue; }
    var dark = lum[i] < cutoff;             // ink where darker than the cut-off
    mask[i] = (invert ? !dark : dark) ? 1 : 0;
  }
  return mask;
}

// Follow every ink/non-ink boundary into closed loops of integer grid corners.
// One directed unit edge per ink-cell side that faces a non-ink cell (or the
// image edge); edges chain head-to-tail into closed rings — outer outlines and
// holes alike (even-odd fill sorts out which is which).
function traceContours(mask, cols, rows) {
  function ink(cx, cy) {
    return (cx < 0 || cy < 0 || cx >= cols || cy >= rows) ? 0 : mask[cy * cols + cx];
  }
  var edges = new Map();                    // "x,y" → [endKey, ...]
  function add(x1, y1, x2, y2) {
    var k = x1 + ',' + y1, a = edges.get(k);
    if (!a) { a = []; edges.set(k, a); }
    a.push(x2 + ',' + y2);
  }
  for (var cy = 0; cy < rows; cy++) {
    for (var cx = 0; cx < cols; cx++) {
      if (!mask[cy * cols + cx]) continue;
      if (!ink(cx, cy - 1)) add(cx + 1, cy, cx, cy);            // top
      if (!ink(cx, cy + 1)) add(cx, cy + 1, cx + 1, cy + 1);    // bottom
      if (!ink(cx - 1, cy)) add(cx, cy, cx, cy + 1);            // left
      if (!ink(cx + 1, cy)) add(cx + 1, cy + 1, cx + 1, cy);    // right
    }
  }
  function pop(fromKey) {
    var a = edges.get(fromKey);
    if (!a || !a.length) return null;
    var to = a.pop();
    if (!a.length) edges.delete(fromKey);
    return to;
  }
  var loops = [], keys = Array.from(edges.keys()), maxSteps = cols * rows * 4 + 32;
  for (var ki = 0; ki < keys.length; ki++) {
    var startKey = keys[ki];
    while (edges.has(startKey)) {
      var loop = [], cur = startKey, steps = 0, closed = false;
      while (cur && steps++ < maxSteps) {
        var c = cur.split(',');
        loop.push({ x: +c[0], y: +c[1] });
        var nxt = pop(cur);
        if (nxt === startKey) { closed = true; break; }   // ring closed
        if (!nxt) break;                                  // dead-end: drop this chain
        cur = nxt;
      }
      if (closed && loop.length >= 3) loops.push(loop);   // only keep proper rings
    }
  }
  return loops;
}

// Signed area (shoelace); magnitude is used to drop specks.
function polyArea(pts) {
  var a = 0;
  for (var i = 0, n = pts.length; i < n; i++) {
    var p = pts[i], q = pts[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

// Ramer–Douglas–Peucker over an index range [lo, hi] of a ring (hi read mod n,
// so a range can wrap past the end). Marks kept indices in `keep`.
function rdpRange(pts, lo, hi, eps, keep) {
  var n = pts.length, stack = [[lo, hi]];
  while (stack.length) {
    var s = stack.pop(), a = s[0], b = s[1];
    if (b - a < 2) continue;
    var A = pts[a % n], B = pts[b % n];
    var dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
    var maxD = -1, idx = -1;
    for (var i = a + 1; i < b; i++) {
      var P = pts[i % n];
      var d = Math.abs((P.x - A.x) * dy - (P.y - A.y) * dx) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > eps && idx > -1) { keep[idx % n] = 1; stack.push([a, idx], [idx, b]); }
  }
}

// Ramer–Douglas–Peucker on a closed ring. Anchored at pts[0] AND the point
// farthest from it, so neither RDP baseline is zero-length (a single-point
// closure would collapse the whole ring).
function simplifyClosed(pts, eps) {
  var n = pts.length;
  if (n < 4) return pts.slice();
  var far = 0, maxd = -1;
  for (var i = 1; i < n; i++) {
    var ex = pts[i].x - pts[0].x, ey = pts[i].y - pts[0].y, dd = ex * ex + ey * ey;
    if (dd > maxd) { maxd = dd; far = i; }
  }
  var keep = new Uint8Array(n);
  keep[0] = 1; keep[far] = 1;
  rdpRange(pts, 0, far, eps, keep);         // pts[0] … pts[far]
  rdpRange(pts, far, n, eps, keep);         // pts[far] … pts[0] (wraps)
  var out = [];
  for (var j = 0; j < n; j++) if (keep[j]) out.push(pts[j]);
  return out;
}

// A closed ring of points → smooth path. Interior vertices become cubic Béziers
// (Catmull-Rom handles); a vertex whose turn is sharper than the corner cut-off
// stays crisp (handles zeroed / straight line). Emits M, C, L and Z.
function ringPath(pts, cornerCos) {
  var n = pts.length;
  var d = 'M' + f2(pts[0].x) + ' ' + f2(pts[0].y);
  if (n < 3) {
    for (var t = 1; t < n; t++) d += 'L' + f2(pts[t].x) + ' ' + f2(pts[t].y);
    return d + 'Z';
  }
  var corner = new Uint8Array(n);
  for (var i = 0; i < n; i++) {
    var p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    var ax = p1.x - p0.x, ay = p1.y - p0.y, bx = p2.x - p1.x, by = p2.y - p1.y;
    var la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1;
    corner[i] = ((ax * bx + ay * by) / (la * lb)) < cornerCos ? 1 : 0;
  }
  var K = 1 / 6;
  for (var s = 0; s < n; s++) {
    var i0 = (s - 1 + n) % n, i1 = s, i2 = (s + 1) % n, i3 = (s + 2) % n;
    var P0 = pts[i0], P1 = pts[i1], P2 = pts[i2], P3 = pts[i3];
    if (corner[i1] && corner[i2]) { d += 'L' + f2(P2.x) + ' ' + f2(P2.y); continue; }
    var c1x = corner[i1] ? P1.x : P1.x + (P2.x - P0.x) * K;
    var c1y = corner[i1] ? P1.y : P1.y + (P2.y - P0.y) * K;
    var c2x = corner[i2] ? P2.x : P2.x - (P3.x - P1.x) * K;
    var c2y = corner[i2] ? P2.y : P2.y - (P3.y - P1.y) * K;
    d += 'C' + f2(c1x) + ' ' + f2(c1y) + ' ' + f2(c2x) + ' ' + f2(c2y) + ' ' + f2(P2.x) + ' ' + f2(P2.y);
  }
  return d + 'Z';
}

// Trace one logo to smooth vector path data in grid-unit coords. Cached on every
// input that changes the geometry (scale / opacity don't, so they never bust it).
function traceLogo(url, img, detail, cutoff, invert, eps, cornerCos) {
  var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;
  // Sampling grid keeps the logo's own aspect, longest edge = detail.
  var cols, rows;
  if (iw >= ih) { cols = detail; rows = Math.max(1, Math.round(detail * ih / iw)); }
  else { rows = detail; cols = Math.max(1, Math.round(detail * iw / ih)); }
  if (cols * rows > MAX_CELLS_PER_LOGO) {
    var k = Math.sqrt(MAX_CELLS_PER_LOGO / (cols * rows));
    cols = Math.max(1, Math.floor(cols * k));
    rows = Math.max(1, Math.floor(rows * k));
  }

  var key = url + '|' + cols + 'x' + rows + '|' + cutoff + '|' + (invert ? 1 : 0)
    + '|' + f2(eps) + '|' + f2(cornerCos);
  if (_traceCache[key]) return _traceCache[key];

  // Drop the background (transparent, or a flat opaque tile) so it never traces as a
  // filled square. The reference comes from measureContent, cached per url.
  var mc = measureContent(url, img);
  var mask = binarize(img, cols, rows, cutoff, invert, mc ? mc.bgOpaque : false, mc ? mc.bg : [0, 0, 0]);
  if (!mask) return null;
  var loops = traceContours(mask, cols, rows);
  // Speck floor scales with grid resolution so low-detail logos don't lose small
  // but real marks (dots, diacritics, ™) while high-detail still drops noise.
  var minArea = Math.max(0.6, cols / 200 * 1.5);
  var d = '';
  for (var li = 0; li < loops.length; li++) {
    var simp = simplifyClosed(loops[li], eps);
    if (simp.length < 3 || Math.abs(polyArea(simp)) < minArea) continue;
    d += ringPath(simp, cornerCos);
  }

  var out = { d: d, cols: cols, rows: rows };
  _traceCache[key] = out;
  return out;
}

// Drop cached images/traces for logos no longer on the wall, so a long session of
// adding/replacing logos doesn't accumulate decoded bitmaps for stale blob URLs.
function pruneCaches(activeUrls) {
  var keep = {};
  activeUrls.forEach(function (u) { if (u) keep[u] = true; });
  Object.keys(_imgCache).forEach(function (u) { if (!keep[u]) delete _imgCache[u]; });
  Object.keys(_boxCache).forEach(function (u) { if (!keep[u]) delete _boxCache[u]; });
  Object.keys(_svgCache).forEach(function (u) { if (!keep[u]) delete _svgCache[u]; });
  Object.keys(_traceCache).forEach(function (k) {
    var u = k.slice(0, k.indexOf('|'));
    if (!keep[u]) delete _traceCache[k];
  });
}

// ── compose the vector wall ──────────────────────────────────────────────────

// Resolve one logo's tracing parameters from threshold (1–99), invert, detail and
// smoothing. Smoothing → simplification tolerance + the angle past which a vertex
// stays a hard corner. Low: faithful, near-polygonal, every turn kept crisp. High:
// flowing curves, only steep turns survive as corners. Used for the wall-wide
// defaults and, per logo, when a block opts into its own "tune" settings.
function traceParams(threshold, invert, detail, smoothing) {
  var sm = clamp(num(smoothing, 60), 0, 100) / 100;
  return {
    cutoff: clamp(num(threshold, 55), 1, 99) / 100 * 255,
    invert: Boolean(invert),
    detail: clamp(Math.round(num(detail, 200)), 24, 360),
    eps: 0.4 + sm * 1.8,
    cornerCos: 0.92 - sm * 1.25,
  };
}

// Build the inline one-ink <svg> for ONE vectorised logo. It's sized by the balanced
// size% and fitted (preserveAspectRatio) exactly like the raster <img>, so vector and
// raster cells lay out identically through the same CSS grid. The viewBox is the
// logo's own content box (margins trimmed), so huge, tiny, tightly- or loosely-cropped
// logos all fill their cell consistently. A raster logo is thresholded + contour-
// traced; an SVG logo is inlined verbatim and recoloured. Returns '' when it can't be
// produced (the caller then keeps the raster <img>); pixel work needs a browser canvas.
async function buildVectorLogo(it, ink, globalTP) {
  var sizeStyle = 'width:' + f2(it.size) + '%;height:' + f2(it.size) + '%'
    + (it.opacity < 1 ? ';opacity:' + f2(it.opacity) : '');
  function wrap(vbx, vby, vbw, vbh, inner) {
    return '<svg class="lw-vec" xmlns="http://www.w3.org/2000/svg" style="' + sizeStyle + '" '
      + 'viewBox="' + f2(vbx) + ' ' + f2(vby) + ' ' + f2(vbw) + ' ' + f2(vbh) + '" '
      + 'preserveAspectRatio="xMidYMid meet">' + inner + '</svg>';
  }

  if (it.isSvg) {
    var svg = await getSvg(it.url).catch(function () { return null; });
    if (!svg || !svg.inner) return '';
    var simg = await getImage(it.url).catch(function () { return null; });
    var sbox = simg ? measureContent(it.url, simg) : null;
    var cbx = svg.vbx, cby = svg.vby, cbw = svg.vbw, cbh = svg.vbh;
    if (sbox) {
      cbx = svg.vbx + sbox.fx * svg.vbw; cby = svg.vby + sbox.fy * svg.vbh;
      cbw = Math.max(1e-3, sbox.fw * svg.vbw); cbh = Math.max(1e-3, sbox.fh * svg.vbh);
    }
    // `color` carries the ink so any stroke="currentColor" (preserved line art) inks too.
    return wrap(cbx, cby, cbw, cbh, '<g fill="' + esc(ink) + '" color="' + esc(ink) + '">' + svg.inner + '</g>');
  }

  var img = await getImage(it.url).catch(function () { return null; });
  if (!img) return '';
  var box = measureContent(it.url, img) || { fx: 0, fy: 0, fw: 1, fh: 1, contentLum: 0 };
  var tp = it.tune ? traceParams(it.oThreshold, it.oInvert, it.oDetail, it.oSmoothing) : globalTP;
  // Auto-invert a logo whose artwork is, on average, lighter than the cut-off (a white
  // / reversed mark) so it doesn't trace to nothing — unless it's tuned or global
  // Invert is already on.
  var inv = tp.invert || (!it.tune && box.contentLum != null && box.contentLum > tp.cutoff);
  var tr = traceLogo(it.url, img, tp.detail, tp.cutoff, inv, tp.eps, tp.cornerCos);
  if (!tr || !tr.d) return '';
  var bx = box.fx * tr.cols, by = box.fy * tr.rows;
  var bw = Math.max(1e-3, box.fw * tr.cols), bh = Math.max(1e-3, box.fh * tr.rows);
  // Ink on the path itself so the PDF path-walker (which reads the fill attribute) inks
  // it too rather than falling back to black.
  return wrap(bx, by, bw, bh, '<path fill="' + esc(ink) + '" fill-rule="evenodd" d="' + tr.d + '"/>');
}

// Build the per-logo render list: url, name, opacity, filter, vector-ness, and an
// effective size%. With "Balance sizes" on (the default), each size folds in an
// optical-weight factor — heavier logos shrink, lighter ones grow — normalised
// around the set's geometric-mean weight, so the wall reads as evenly weighted.
// The block's own Size % rides on top as a manual nudge.
async function buildItems(inputs, balance) {
  var logos = Array.isArray(inputs.logos) ? inputs.logos : [];
  var items = logos.map(function (b, i) {
    var ref = b && b.logo;
    var s = clamp(num(b && b.scale, 100), 5, 400);
    return {
      index: i,
      url: ref && ref.url ? ref.url : '',
      name: ref && ref.meta && ref.meta.name ? ref.meta.name : '',
      isSvg: !!(ref && (ref.type === 'vector' || ref.format === 'svg')),
      vectorize: !!(b && b.vectorize),          // per-logo "Render as vector"
      opacity: clamp(num(b && b.opacity, 1), 0, 1),
      filter: (b && b.filter) || 'none',
      scale: s,
      size: s,
      // Per-logo vector overrides (only applied when `tune` is on; see buildVectorLogo).
      tune: !!(b && b.tune),
      oThreshold: clamp(num(b && b.threshold, 55), 1, 99),
      oInvert: !!(b && b.invert),
      oDetail: clamp(Math.round(num(b && b.detail, 200)), 24, 360),
      oSmoothing: clamp(num(b && b.smoothing, 60), 0, 100),
    };
  });

  if (!balance || !canRaster()) return items;
  var withUrl = items.filter(function (it) { return it.url; });
  if (withUrl.length < 2) return items;           // nothing to balance against

  var imgs = await Promise.all(withUrl.map(function (it) {
    return getImage(it.url).catch(function () { return null; });
  }));
  var dens = [];
  for (var i = 0; i < withUrl.length; i++) {
    var box = imgs[i] ? measureContent(withUrl[i].url, imgs[i]) : null;
    // Weight is the artwork's footprint over its bounding square (any colour), so a
    // sparse mark is "light" and a solid one "heavy" regardless of margin, colour or
    // invert. Floor it so a near-empty logo still counts as light and grows.
    withUrl[i]._den = (box && box.weight != null) ? Math.max(box.weight, 0.01) : null;
    if (withUrl[i]._den) dens.push(withUrl[i]._den);
  }
  if (dens.length < 2) { withUrl.forEach(function (it) { delete it._den; }); return items; }
  // Reference = MEDIAN weight, so one mis-measured logo can't drag the whole wall the
  // way a geometric mean would.
  dens.sort(function (a, b) { return a - b; });
  var mid = dens.length >> 1;
  var refDen = dens.length % 2 ? dens[mid] : (dens[mid - 1] + dens[mid]) / 2;
  withUrl.forEach(function (it) {
    var factor = it._den ? clamp(Math.sqrt(refDen / it._den), 0.55, 1.7) : 1;
    it.size = clamp(it.scale * factor, 5, 600);
    delete it._den;
  });
  return items;
}

// ── lifecycle ────────────────────────────────────────────────────────────────

async function compute(model) {
  var inputs = inputsFrom(model);
  _transparent = Boolean(inputs.transparentBg);
  _bg = color(inputs.background, '#ffffff');
  var balance = inputs.balance !== false;         // optical-weight balancing, default on

  // One render list for both modes — the template lays them out in a single CSS grid,
  // each cell an <img> (raster) or a one-ink inline <svg> (per-logo "Render as vector").
  var items = await buildItems(inputs, balance);

  // Build the inline SVG for each vectorised logo. Pixel tracing needs a real browser
  // canvas; in a headless shell (or on failure) the logo keeps its <img>.
  if (canRaster()) {
    var ink = color(inputs.inkColor, '#0c322c');
    var globalTP = traceParams(inputs.threshold, inputs.invert, inputs.detail, inputs.smoothing);
    await Promise.all(items.map(async function (it) {
      if (!it.vectorize || !it.url) return;
      try { it.cellSvg = await buildVectorLogo(it, ink, globalTP); }
      catch (e) { if (host.log) host.log('warn', 'logo-wall: vectorise failed', { error: String(e) }); }
    }));
  }

  pruneCaches(items.map(function (it) { return it.url; }));
  // Only blocks with an image occupy a cell (each keeps its original index for
  // canvas click-to-focus), so an imageless block never leaves a gap and both modes
  // lay out the same.
  return { wallItems: items.filter(function (it) { return it.url; }) };
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }

function beforeExport(ctx) {
  // Alpha-capable raster formats: honour the "No BG" toggle so a transparent wall
  // exports with real transparency; otherwise fill with the chosen background so a
  // non-matching export aspect has no transparent margins. (Vector SVG keeps its
  // own background rect / transparency by design.)
  var alpha = ['png', 'webp'];
  if (alpha.indexOf(ctx.format) !== -1) {
    ctx.opts.background = _transparent ? 'transparent' : _bg;
  } else if (ctx.format === 'jpg' || ctx.format === 'jpeg') {
    // JPEG has no alpha — a "No background" wall would otherwise fall back to the
    // exporter's default (white). Give it an explicit colour instead.
    ctx.opts.background = _bg;
  }
}
