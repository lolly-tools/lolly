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
 * Vector mode ("Render as vector") flattens every logo to one ink colour:
 *   - a raster logo is decoded on an offscreen <canvas>, thresholded to 1-bit,
 *     and traced — marching-squares boundary → Douglas–Peucker simplify →
 *     corner-aware cubic Béziers (smooth real paths, holes via even-odd fill);
 *   - an SVG logo is inlined verbatim and recoloured (no trace), so it stays
 *     pixel-perfect.
 * Every logo is composed into ONE inline <svg> laid out as the same grid; the
 * template is then SVG-rooted ({{{vectorSvg}}}), so SVG/PDF export is true vector.
 *
 * Efficiency, since a wall can hold many logos:
 *   - decoded images, traced paths, inlined SVGs and weights are each cached per
 *     URL, so dragging a size/opacity slider re-composes but never re-traces;
 *   - the whole SVG is memoised on every render-affecting input;
 *   - each logo's traced grid is capped (MAX_CELLS_PER_LOGO);
 *   - stale caches are pruned to the logos currently on the wall.
 *
 * Pixel decoding needs a real browser <canvas>. In a headless shell (CLI/jsdom)
 * there's none, so vector mode degrades to a friendly placeholder rather than
 * throwing — this is a browser-rendered effect.
 */

// The wall's coordinate space — matches render.width/height so vector and raster
// modes frame the logos identically.
var WALL_W = 1280, WALL_H = 720;
// Upper bound on a single logo's sampling grid, so a high Detail on a big logo
// can't blow up tracing time/output (≈ a 330×330 grid).
var MAX_CELLS_PER_LOGO = 110000;
// Floor on a computed cell size, so a huge column/row count can't invert geometry.
var MIN_CELL = 8;

// Decoded-image cache: url -> in-flight Promise<Image> (shared across re-renders).
var _imgCache = {};
// Traced-path cache: key -> { d, cols, rows } in grid-unit coords.
var _traceCache = {};
// Optical-weight cache: url -> density (0..1), for size balancing.
var _weightCache = {};
// Inlined-SVG cache: url -> Promise<{ inner, vbx, vby, vbw, vbh }> for vector
// logos, which are inlined (and recoloured) rather than traced.
var _svgCache = {};
// One-entry memo of the last SVG, keyed on every render-affecting input.
var _memoKey = null, _memoResult = null;
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
  for (var i = 0, p = 0; i < lum.length; i++, p += 4) {
    lum[i] = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) | 0;
    alpha[i] = data[p + 3];
  }
  return { lum: lum, alpha: alpha, cols: cols, rows: rows };
}

// Optical weight of a logo: mean over a small aspect-correct sample of
// (opacity × darkness), i.e. how much ink-mass it carries (0 = blank, 1 = solid
// black). Used to balance sizes — heavier logos shrink, lighter ones grow.
// Independent of the vector threshold, so dragging Threshold doesn't re-weigh.
function measureWeight(url, img) {
  if (_weightCache[url] != null) return _weightCache[url];
  var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;
  var cols, rows, S = 72;                   // small fixed sample, longest edge S
  if (iw >= ih) { cols = S; rows = Math.max(1, Math.round(S * ih / iw)); }
  else { rows = S; cols = Math.max(1, Math.round(S * iw / ih)); }
  var g = sampleRGBA(img, cols, rows);
  if (!g) return null;
  var lum = g.lum, alpha = g.alpha, sum = 0;
  for (var i = 0; i < lum.length; i++) sum += (alpha[i] / 255) * (1 - lum[i] / 255);
  var den = sum / lum.length;
  _weightCache[url] = den;
  return den;
}

// ── SVG logos: inline instead of trace ───────────────────────────────────────
// A logo that's already a vector (SVG) is inlined verbatim and recoloured to the
// ink colour — no rasterise-and-trace round-trip, so it stays pixel-perfect. The
// uploaded SVG was sanitised at ingest (DOMPurify, scripts stripped), so the
// markup is safe to inline.

// Drop fill/stroke paint from every element so the wrapping group's ink fill
// shows through (a flat monochrome logo). Geometry is left untouched.
function stripPaint(el) {
  var all = el.querySelectorAll('*');
  for (var i = 0; i < all.length; i++) {
    var e = all[i];
    e.removeAttribute('fill');
    e.removeAttribute('stroke');
    var st = e.getAttribute('style');
    if (st) {
      st = st.replace(/(?:^|;)\s*(?:fill|stroke)\s*:[^;]*/gi, '');
      if (st.replace(/[;\s]/g, '')) e.setAttribute('style', st); else e.removeAttribute('style');
    }
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
  var bad = svg.querySelectorAll('script, foreignObject, animate, animateTransform, animateMotion, set');
  for (var i = bad.length - 1; i >= 0; i--) { if (bad[i].parentNode) bad[i].parentNode.removeChild(bad[i]); }
  var all = svg.querySelectorAll('*');
  for (var j = 0; j < all.length; j++) {
    var e = all[j], attrs = e.attributes;
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

// Threshold the sampled image into a 1-bit ink mask (1 = ink).
function binarize(img, cols, rows, cutoff, invert) {
  var g = sampleRGBA(img, cols, rows);
  if (!g) return null;
  var lum = g.lum, alpha = g.alpha;
  var mask = new Uint8Array(cols * rows);
  for (var i = 0; i < mask.length; i++) {
    var present = alpha[i] >= 128;          // (near-)transparent pixels are never ink
    var dark = lum[i] < cutoff;             // ink where darker than the cut-off
    mask[i] = (present && (invert ? !dark : dark)) ? 1 : 0;
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

  var mask = binarize(img, cols, rows, cutoff, invert);
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
  Object.keys(_weightCache).forEach(function (u) { if (!keep[u]) delete _weightCache[u]; });
  Object.keys(_svgCache).forEach(function (u) { if (!keep[u]) delete _svgCache[u]; });
  Object.keys(_traceCache).forEach(function (k) {
    var u = k.slice(0, k.indexOf('|'));
    if (!keep[u]) delete _traceCache[k];
  });
}

function svgOpen() {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" '
    + 'viewBox="0 0 ' + WALL_W + ' ' + WALL_H + '" preserveAspectRatio="xMidYMid meet">';
}

function placeholder(message) {
  return svgOpen()
    + '<rect width="' + WALL_W + '" height="' + WALL_H + '" fill="#f4f4f5"/>'
    + '<text x="' + (WALL_W / 2) + '" y="' + (WALL_H / 2) + '" text-anchor="middle" '
    + 'dominant-baseline="middle" font-family="sans-serif" font-size="34" fill="#9ca3af">'
    + esc(message) + '</text></svg>';
}

// ── compose the vector wall ──────────────────────────────────────────────────

async function buildVectorWall(inputs, items) {
  var used = items.filter(function (it) { return it.url; });
  if (!used.length) return placeholder('Pick a logo image for each row to build your wall.');

  var cols = clamp(Math.round(num(inputs.columns, 4)), 1, 12);
  var rows = Math.max(1, Math.ceil(used.length / cols));
  var gap = clamp(num(inputs.gap, 32), 0, 400);
  var pad = clamp(num(inputs.padding, 48), 0, 400);
  var ink = color(inputs.inkColor, '#0c322c');
  var cutoff = clamp(num(inputs.threshold, 55), 1, 99) / 100 * 255;
  var invert = Boolean(inputs.invert);
  var detail = clamp(Math.round(num(inputs.detail, 200)), 24, 360);
  // Smoothing → simplification tolerance + the angle past which a vertex stays a
  // hard corner. Low: faithful, near-polygonal, every turn kept crisp. High:
  // flowing curves, only steep turns survive as corners.
  var sm = clamp(num(inputs.smoothing, 60), 0, 100) / 100;
  var eps = 0.4 + sm * 1.8;
  var cornerCos = 0.92 - sm * 1.25;

  var cellW = Math.max(MIN_CELL, (WALL_W - 2 * pad - (cols - 1) * gap) / cols);
  var cellH = Math.max(MIN_CELL, (WALL_H - 2 * pad - (rows - 1) * gap) / rows);

  // Resolve each logo to a placed <g> in parallel: SVG logos are inlined and
  // recoloured (no trace); rasters are decoded, thresholded and traced. Each
  // group carries data-canvas-input so a click on the canvas focuses its block.
  function fit(aspect, scale) {
    var ca = cellW / cellH, dw, dh;
    if (aspect >= ca) { dw = cellW; dh = cellW / aspect; } else { dh = cellH; dw = cellH * aspect; }
    return { w: dw * scale, h: dh * scale };
  }
  var pieces = await Promise.all(used.map(async function (it, i) {
    var rowI = Math.floor(i / cols), colI = i % cols;
    var cellX = pad + colI * (cellW + gap), cellY = pad + rowI * (cellH + gap);
    var scale = clamp(num(it.size, 100), 5, 600) / 100;
    var op = it.opacity;
    var tag = '<g data-canvas-input="logos:' + it.index + '"' + (op < 1 ? ' opacity="' + f2(op) + '"' : '');

    if (it.vector) {
      var svg = await getSvg(it.url).catch(function () { return null; });
      if (!svg || !svg.inner) return '';
      var f = fit(svg.vbw / svg.vbh, scale), s = f.w / svg.vbw;
      var ox = cellX + (cellW - f.w) / 2, oy = cellY + (cellH - f.h) / 2;
      return tag + ' transform="translate(' + f2(ox) + ' ' + f2(oy) + ') scale(' + f2(s) + ') '
        + 'translate(' + f2(-svg.vbx) + ' ' + f2(-svg.vby) + ')">' + svg.inner + '</g>';
    }

    var img = await getImage(it.url).catch(function () { return null; });
    if (!img) return '';
    var tr = traceLogo(it.url, img, detail, cutoff, invert, eps, cornerCos);
    if (!tr || !tr.d) return '';
    var fr = fit(tr.cols / tr.rows, scale);
    var oxr = cellX + (cellW - fr.w) / 2, oyr = cellY + (cellH - fr.h) / 2;
    return tag + ' fill-rule="evenodd" transform="translate(' + f2(oxr) + ' ' + f2(oyr) + ') scale('
      + f2(fr.w / tr.cols) + ' ' + f2(fr.h / tr.rows) + ')"><path d="' + tr.d + '"/></g>';
  }));

  var bg = _transparent ? null : color(inputs.background, '#ffffff');
  var out = svgOpen();
  if (bg) out += '<rect width="' + WALL_W + '" height="' + WALL_H + '" fill="' + esc(bg) + '"/>';
  out += '<g fill="' + esc(ink) + '">' + pieces.join('') + '</g></svg>';
  return out;
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
      vector: !!(ref && (ref.type === 'vector' || ref.format === 'svg')),
      opacity: clamp(num(b && b.opacity, 1), 0, 1),
      filter: (b && b.filter) || 'none',
      scale: s,
      size: s,
    };
  });

  if (!balance || !canRaster()) return items;
  var withUrl = items.filter(function (it) { return it.url; });
  if (withUrl.length < 2) return items;           // nothing to balance against

  var imgs = await Promise.all(withUrl.map(function (it) {
    return getImage(it.url).catch(function () { return null; });
  }));
  var n = 0, logSum = 0;
  for (var i = 0; i < withUrl.length; i++) {
    var d = imgs[i] ? measureWeight(withUrl[i].url, imgs[i]) : null;
    // Floor a measured density so a white / very pale logo (density ≈ 0) counts as
    // "very light" and grows, rather than being treated as unknown (factor 1).
    withUrl[i]._den = (d != null) ? Math.max(d, 0.01) : null;
    if (withUrl[i]._den) { n++; logSum += Math.log(withUrl[i]._den); }
  }
  if (n < 2) { withUrl.forEach(function (it) { delete it._den; }); return items; }
  var refDen = Math.exp(logSum / n);              // geometric mean
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

  // Per-logo items (size folds in balancing). Raster mode renders these directly
  // from the template; vector mode feeds them to the SVG wall builder.
  var items = await buildItems(inputs, balance);

  if (!inputs.vectorize) {
    pruneCaches(items.map(function (it) { return it.url; }));
    return { wallItems: items };
  }

  if (!canRaster()) {
    return { wallItems: items, vectorSvg: placeholder('Vector preview renders in the browser.') };
  }

  var memoKey = JSON.stringify({
    c: inputs.columns, g: inputs.gap, p: inputs.padding, bg: _bg, ink: inputs.inkColor,
    th: inputs.threshold, inv: inputs.invert, det: inputs.detail, sm: inputs.smoothing, tr: _transparent, bal: balance,
    L: items.map(function (it) { return { u: it.url, v: it.vector, s: f2(it.size), o: it.opacity, i: it.index }; }),
  });
  if (memoKey === _memoKey) return _memoResult;

  var svg;
  try { svg = await buildVectorWall(inputs, items); }
  catch (e) {
    if (host.log) host.log('warn', 'logo-wall: vector build failed', { error: String(e) });
    svg = placeholder('Could not vectorise these logos.');
  }

  pruneCaches(items.map(function (it) { return it.url; }));
  _memoKey = memoKey;
  _memoResult = { wallItems: items, vectorSvg: svg };
  return _memoResult;
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
