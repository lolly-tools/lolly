/* global onInit, onInput, beforeExport, host */

/**
 * Filter: Posterise Bitmap — trace a photo into flat vector colour separations.
 *
 * Reuses the logo-wall tracer wholesale (decode on an offscreen <canvas> →
 * marching-squares boundary → Douglas–Peucker simplify → corner-aware cubic
 * Béziers, holes via even-odd fill) but swaps its 1-bit threshold for an N-level
 * POSTERISE: the image's luminance is split into `steps` tonal bands; each band
 * becomes one traced separation, filled with its own colour, and the bands are
 * stacked darkest-on-top over the lightest "paper" band so coverage is gap-free.
 *
 * Colours are sampled automatically from the photo (each separation = the mean
 * colour of its tonal band, so the poster resembles the source on load), then the
 * `colors` block list is populated so every separation's swatch can be hand-edited.
 * The lightest separation is the background/paper colour (last swatch).
 *
 * The whole pipeline needs a real browser <canvas>; in a headless shell (CLI/jsdom)
 * it degrades to a friendly placeholder rather than throwing — a browser effect.
 *
 * Demo image: unlike the sibling filters (filter-duotone/-halftone/-scanline),
 * which share the flat bag-video graphic, posterise splits LUMINANCE into bands
 * and fills each with its band's mean colour — so a tonally flat source (the
 * Geeko on a solid dark-green field) collapses to a muddy near-monochrome poster.
 * It needs a tonally rich, high-contrast PHOTO (cf. tool.json: "Headshots and
 * high-contrast photos trace best"), so it defaults to a catalog headshot instead.
 */

var DEFAULT_IMAGE_ID = 'suse/headshots/andy-fitzsimon';
var _defaultUrl = null;

// Sampling grid is capped so a high quality on a big photo can't blow up tracing
// time/output (≈ a 640×640 grid across all layers, since one decode feeds them all).
// Raised with the Quality slider's reach to 200 so a top-quality square photo isn't
// immediately clamped back down below its requested detail.
var MAX_CELLS = 410000;

// Caches (per render, survive slider drags). Pruned to the active photo each
// compute (see compute) so swapping photos / sweeping Quality never accumulates
// stale decoded bitmaps + grids — mirrors logo-wall's pruneCaches.
var _imgCache = {};       // url -> Promise<Image>
var _sampleCache = {};    // url|cols x rows -> { lum, alpha, r, g, b, cols, rows }
var _bandCache = { key: null, paths: null }; // geometry-only traced band paths (palette-independent)
var _memoKey = null, _memoResult = null;
var _transparent = false, _paper = '#ffffff';
// Auto-then-manual palette state: what we last auto-seeded, and from which photo,
// so we can tell an untouched seed from a real manual edit (and reseed on a photo
// change only when the user hasn't recoloured). _prevSteps distinguishes a Colour-
// steps change (reseed) from a stray +Add/remove (reconcile, don't wipe).
var _seedUrl = null, _seedPalette = null, _prevSteps = null, _seedTone = null;

// ── small helpers (mirrors logo-wall) ─────────────────────────────────────────
function inputsFrom(model) { var o = {}; model.forEach(function (i) { o[i.id] = i.value; }); return o; }
function num(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function f2(v) { return Math.round(v * 100) / 100; }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// A safe-ish CSS colour, or a fallback — keeps stray input out of the SVG.
function color(v, fallback) {
  var s = (typeof v === 'string' ? v : '').trim();
  return /^#[0-9a-f]{3,8}$/i.test(s) || /^(rgb|hsl)a?\([\d%.,\s/]+\)$/i.test(s) ? s : fallback;
}
function hex2(n) { var h = clamp(Math.round(n), 0, 255).toString(16); return h.length < 2 ? '0' + h : h; }
function rgbHex(r, g, b) { return '#' + hex2(r) + hex2(g) + hex2(b); }

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
  var p = loadImage(url);
  _imgCache[url] = p;
  p.catch(function () { if (_imgCache[url] === p) delete _imgCache[url]; });
  return p;
}

// Decode the photo into a cols×rows grid of luminance + alpha + raw RGB. One
// decode feeds every separation (threshold + mean-colour passes), so it's cached.
function sampleRGBA(url, img, cols, rows) {
  var key = url + '|' + cols + 'x' + rows;
  if (_sampleCache[key]) return _sampleCache[key];
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
  var n = cols * rows;
  var lum = new Uint8Array(n), alpha = new Uint8Array(n);
  var r = new Uint8Array(n), g = new Uint8Array(n), b = new Uint8Array(n);
  for (var i = 0, p = 0; i < n; i++, p += 4) {
    r[i] = data[p]; g[i] = data[p + 1]; b[i] = data[p + 2];
    lum[i] = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) | 0;
    alpha[i] = data[p + 3];
  }
  var out = { lum: lum, alpha: alpha, r: r, g: g, b: b, cols: cols, rows: rows };
  _sampleCache[key] = out;
  return out;
}

// ── tone adjust: brightness + contrast (pre-separation) ───────────────────────

// A 256-entry tone curve combining Brightness (additive) and Contrast (scale about
// mid-grey). Both sliders are -100…100, 0 = identity. Contrast uses a tan() ramp so
// 0 leaves tones untouched, negatives flatten toward grey, positives push them apart
// (and near +100 approach a hard threshold — fitting for a screenprint look).
function toneLUT(brightness, contrast) {
  var b = clamp(num(brightness, 0), -100, 100) * 2.55;          // ±255 px offset
  var c = clamp(num(contrast, 0), -100, 100);
  var f = Math.tan(clamp(c / 100 + 1, 0, 1.98) * Math.PI / 4);  // 0 (flat) … 1 (none) … ~64 (max)
  var lut = new Uint8Array(256);
  for (var i = 0; i < 256; i++) {
    var v = (i - 128) * f + 128 + b;                            // contrast about mid-grey, then brightness
    lut[i] = v < 0 ? 0 : v > 255 ? 255 : v | 0;
  }
  return lut;
}

// Apply the tone curve to every channel and recompute luminance, so adjustments move
// BOTH which band a pixel falls into (thresholds/geometry) and the auto-sampled
// separation colours. Built fresh — the decoded sample cache stays the raw photo.
function applyTone(g, lut) {
  var n = g.lum.length;
  var r = new Uint8Array(n), gg = new Uint8Array(n), b = new Uint8Array(n), lum = new Uint8Array(n);
  for (var i = 0; i < n; i++) {
    var R = lut[g.r[i]], G = lut[g.g[i]], B = lut[g.b[i]];
    r[i] = R; gg[i] = G; b[i] = B;
    lum[i] = (0.299 * R + 0.587 * G + 0.114 * B) | 0;
  }
  return { lum: lum, alpha: g.alpha, r: r, g: gg, b: b, cols: g.cols, rows: g.rows };
}

// ── posterise: thresholds + per-band mean colour ──────────────────────────────

// Split luminance into `steps` bands by HISTOGRAM QUANTILE (equal opaque-pixel
// count per band), so tonal regions with more information get more separations —
// faces posterise far better this way than with evenly-spaced cut-offs. Returns
// the steps-1 interior thresholds (ascending). Falls back to even spacing if the
// image is (near-)flat.
function quantileThresholds(grid, steps) {
  var hist = new Uint32Array(256), total = 0;
  var lum = grid.lum, alpha = grid.alpha, n = lum.length;
  for (var i = 0; i < n; i++) { if (alpha[i] >= 128) { hist[lum[i]]++; total++; } }
  if (!total) return evenThresholds(steps);
  var thr = [], target = total / steps, cum = 0, k = 1;
  for (var Lv = 0; Lv < 256 && k < steps; Lv++) {
    cum += hist[Lv];
    while (k < steps && cum >= target * k) { thr.push(Lv); k++; }
  }
  var N = steps - 1;                                       // number of interior thresholds
  while (thr.length < N) thr.push(255);                    // pad if a band collapsed
  // Force STRICTLY-ascending thresholds that leave EVERY band non-empty, even when a
  // flat/solid region (studio black or white backdrop) spikes the histogram and
  // collapses quantiles. band 0 = [0,thr[0]) needs thr[0]>=1 (so pure-black pixels
  // land in the darkest separation, not band 1 — the darkest swatch must control
  // ink); band steps-1 = [thr[N-1],255] needs thr[N-1]<=254. Each slot is clamped to
  // [j+1, 254-(N-1-j)] (room left for the rest) then bumped past its predecessor —
  // which stays within the upper clamp since the bounds step by 1. No coincident
  // cut-offs ⇒ no dead swatches and no redundant overlapping hidden layers.
  for (var j = 0; j < N; j++) {
    var lo = j + 1, hi = 254 - (N - 1 - j), v = thr[j];
    if (v < lo) v = lo;
    if (v > hi) v = hi;
    if (j > 0 && v <= thr[j - 1]) v = thr[j - 1] + 1;
    thr[j] = v;
  }
  return thr;
}
function evenThresholds(steps) {
  var thr = [];
  for (var k = 1; k < steps; k++) thr.push(Math.round(255 * k / steps));
  return thr;
}

// Mean colour of the opaque pixels whose luminance falls in each band → the
// auto palette (index 0 = darkest band … last = lightest/paper). So the poster
// resembles the photo before any manual recolour.
function autoPalette(grid, thr, steps) {
  var sumR = new Float64Array(steps), sumG = new Float64Array(steps), sumB = new Float64Array(steps);
  var cnt = new Float64Array(steps);
  var lum = grid.lum, alpha = grid.alpha, r = grid.r, g = grid.g, b = grid.b, n = lum.length;
  for (var i = 0; i < n; i++) {
    if (alpha[i] < 128) continue;
    var L = lum[i], band = 0;
    while (band < thr.length && L >= thr[band]) band++;     // 0..steps-1
    sumR[band] += r[i]; sumG[band] += g[i]; sumB[band] += b[i]; cnt[band]++;
  }
  var pal = [];
  for (var k = 0; k < steps; k++) {
    if (cnt[k] > 0) pal.push(rgbHex(sumR[k] / cnt[k], sumG[k] / cnt[k], sumB[k] / cnt[k]));
    else { var t = steps > 1 ? k / (steps - 1) : 0; pal.push(rgbHex(t * 255, t * 255, t * 255)); } // empty band → grey ramp
  }
  return pal;
}

// ── tracing (lifted from logo-wall) ───────────────────────────────────────────

// One luminance band's mask: opaque pixels darker than `cutoff`.
function maskBelow(grid, cutoff) {
  var lum = grid.lum, alpha = grid.alpha, n = lum.length, mask = new Uint8Array(n);
  for (var i = 0; i < n; i++) mask[i] = (alpha[i] >= 128 && lum[i] < cutoff) ? 1 : 0;
  return mask;
}

function traceContours(mask, cols, rows) {
  function ink(cx, cy) { return (cx < 0 || cy < 0 || cx >= cols || cy >= rows) ? 0 : mask[cy * cols + cx]; }
  var edges = new Map();
  function add(x1, y1, x2, y2) {
    var k = x1 + ',' + y1, a = edges.get(k);
    if (!a) { a = []; edges.set(k, a); }
    a.push(x2 + ',' + y2);
  }
  for (var cy = 0; cy < rows; cy++) {
    for (var cx = 0; cx < cols; cx++) {
      if (!mask[cy * cols + cx]) continue;
      if (!ink(cx, cy - 1)) add(cx + 1, cy, cx, cy);
      if (!ink(cx, cy + 1)) add(cx, cy + 1, cx + 1, cy + 1);
      if (!ink(cx - 1, cy)) add(cx, cy, cx, cy + 1);
      if (!ink(cx + 1, cy)) add(cx + 1, cy + 1, cx + 1, cy);
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
        if (nxt === startKey) { closed = true; break; }
        if (!nxt) break;
        cur = nxt;
      }
      if (closed && loop.length >= 3) loops.push(loop);
    }
  }
  return loops;
}

function polyArea(pts) {
  var a = 0;
  for (var i = 0, n = pts.length; i < n; i++) { var p = pts[i], q = pts[(i + 1) % n]; a += p.x * q.y - q.x * p.y; }
  return a / 2;
}
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
  rdpRange(pts, 0, far, eps, keep);
  rdpRange(pts, far, n, eps, keep);
  var out = [];
  for (var j = 0; j < n; j++) if (keep[j]) out.push(pts[j]);
  return out;
}
function ringPath(pts, cornerCos) {
  var n = pts.length;
  var d = 'M' + f2(pts[0].x) + ' ' + f2(pts[0].y);
  if (n < 3) { for (var t = 1; t < n; t++) d += 'L' + f2(pts[t].x) + ' ' + f2(pts[t].y); return d + 'Z'; }
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

// Trace one band mask into smooth path data (grid-unit coords).
function tracePath(grid, cutoff, eps, cornerCos, minArea) {
  var mask = maskBelow(grid, cutoff);
  var loops = traceContours(mask, grid.cols, grid.rows);
  var d = '';
  for (var li = 0; li < loops.length; li++) {
    var simp = simplifyClosed(loops[li], eps);
    if (simp.length < 3 || Math.abs(polyArea(simp)) < minArea) continue;
    d += ringPath(simp, cornerCos);
  }
  return d;
}

// ── compose the poster SVG ────────────────────────────────────────────────────

// Quality (90–200) → sampling RESOLUTION only; Smoothing (0–100) → curve fitting,
// using the same mapping as logo-wall so the two controls are independent (one for
// detail, one for how flowing the outlines are). The 90–100 band is left exactly as
// it was (256..368 longest edge) so existing sessions/URLs don't shift; 100–200
// extends the reach for much finer traces (368..640, gated by MAX_CELLS).
function traceParams(quality, smoothing) {
  var Q = clamp(num(quality, 95), 90, 200);
  var detail;
  if (Q <= 100) detail = Math.round(256 + (Q - 90) / 10 * 112);    // 256..368 (unchanged)
  else detail = Math.round(368 + (Q - 100) / 100 * 272);           // 368..640 longest edge
  var sm = clamp(num(smoothing, 60), 0, 100) / 100;    // 0..1 smoothing (matches logo-wall)
  return {
    detail: detail,
    eps: 0.4 + sm * 1.8,                                // faithful (low) … flowing (high)
    cornerCos: 0.92 - sm * 1.25,                         // low smoothing keeps every turn crisp
  };
}

function gridSize(img, detail) {
  var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;
  var cols, rows;
  if (iw >= ih) { cols = detail; rows = Math.max(1, Math.round(detail * ih / iw)); }
  else { rows = detail; cols = Math.max(1, Math.round(detail * iw / ih)); }
  if (cols * rows > MAX_CELLS) {
    var k = Math.sqrt(MAX_CELLS / (cols * rows));
    cols = Math.max(1, Math.floor(cols * k));
    rows = Math.max(1, Math.floor(rows * k));
  }
  return { cols: cols, rows: rows };
}

function placeholder(msg) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">'
    + '<rect width="100%" height="100%" fill="#f3f5f4"/>'
    + '<text x="540" y="540" text-anchor="middle" font-family="SUSE, system-ui, sans-serif" '
    + 'font-size="34" fill="#6b7c77">' + esc(msg) + '</text></svg>';
}

// Build the stacked-separation poster. `palette` is the EFFECTIVE colours
// (index 0 darkest … last lightest/paper); thresholds split the bands.
function buildPoster(url, img, W, H, grid, thr, palette) {
  var tp = grid.tp;
  var steps = palette.length;
  // Speck floor scales with grid resolution so fine but real marks survive while
  // noise is dropped.
  var minArea = Math.max(0.8, grid.cols / 220 * 1.6);

  // COVER-fit the trace grid into the export canvas, centred (faces stay centred);
  // overflow is clipped by the outer SVG viewport.
  var scale = Math.max(W / grid.cols, H / grid.rows);
  var tx = (W - grid.cols * scale) / 2, ty = (H - grid.rows * scale) / 2;

  var paper = palette[steps - 1];
  _paper = paper;
  var out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" '
    + 'width="' + W + '" height="' + H + '" style="width:100%;height:auto;display:block;">';
  if (!_transparent) out += '<rect width="100%" height="100%" fill="' + esc(paper) + '"/>';

  // Layers darkest-on-top: append j = steps-2 … 0 so the smallest (darkest) region
  // paints last. Each layer's mask = lum < thr[j], filled palette[j].
  out += '<g transform="translate(' + f2(tx) + ' ' + f2(ty) + ') scale(' + f2(scale) + ')" fill-rule="evenodd">';
  // Band geometry depends only on the photo + grid + quality params + thresholds —
  // never the palette — so cache the traced paths and re-stitch fills on a recolour
  // or background toggle instead of re-running N marching-squares passes.
  var geomKey = url + '|' + grid.cols + 'x' + grid.rows + '|' + tp.detail
    + '|' + f2(tp.eps) + '|' + f2(tp.cornerCos) + '|' + (grid.invert ? 'i' : '')
    + '|' + (grid.tone || '0,0') + '|' + thr.join(',');
  var paths;
  if (_bandCache.key === geomKey) {
    paths = _bandCache.paths;
  } else {
    paths = [];
    for (var j = steps - 2; j >= 0; j--) paths[j] = tracePath(grid.g, thr[j], tp.eps, tp.cornerCos, minArea);
    _bandCache = { key: geomKey, paths: paths };
  }
  for (var k = steps - 2; k >= 0; k--) {
    if (paths[k]) out += '<path d="' + paths[k] + '" fill="' + esc(palette[k]) + '"/>';
  }
  out += '</g></svg>';
  return out;
}

// ── lifecycle ─────────────────────────────────────────────────────────────────

async function resolveDefault() {
  if (_defaultUrl) return _defaultUrl;
  try {
    var def = (DEFAULT_IMAGE_ID.indexOf('://') !== -1)
      ? (host.compose && host.compose.renderUrl ? await host.compose.renderUrl(DEFAULT_IMAGE_ID) : null)
      : await host.assets.get(DEFAULT_IMAGE_ID);
    _defaultUrl = def && def.url;
  } catch (e) { if (host.log) host.log('warn', 'filter-posterize: default image unavailable', { error: String(e) }); }
  return _defaultUrl;
}

async function compute(model) {
  var inputs = inputsFrom(model);
  _transparent = Boolean(inputs.transparentBg);
  var steps = clamp(Math.round(num(inputs.steps, 8)), 2, 12);
  var invert = Boolean(inputs.invert);
  var brightness = clamp(Math.round(num(inputs.brightness, 0)), -100, 100);
  var contrast = clamp(Math.round(num(inputs.contrast, 0)), -100, 100);
  var toneKey = brightness + ',' + contrast;
  var W = clamp(Math.round(num(inputs.width, 1080)), 1, 8000);
  var H = clamp(Math.round(num(inputs.height, 1080)), 1, 8000);

  // Resolve the photo: the user's pick, else the shared demo image.
  var ref = inputs.photo;
  var url = (ref && ref.url) ? ref.url : await resolveDefault();
  if (!url) return { posterSvg: placeholder('Pick a photo to posterise.') };

  if (!canRaster()) return { posterSvg: placeholder('Posterise renders in the browser.') };

  // Keep only the active photo's decoded image + sample grids (Quality sweeps reuse
  // same-photo grids); drop every prior photo so a session of swaps can't accumulate
  // bitmaps. Mirrors logo-wall's pruneCaches.
  Object.keys(_imgCache).forEach(function (u) { if (u !== url) delete _imgCache[u]; });
  Object.keys(_sampleCache).forEach(function (key) { if (key.slice(0, key.indexOf('|')) !== url) delete _sampleCache[key]; });
  if (_bandCache.key && _bandCache.key.slice(0, _bandCache.key.indexOf('|')) !== url) _bandCache = { key: null, paths: null };

  var img = await getImage(url).catch(function () { return null; });
  if (!img) return { posterSvg: placeholder('Could not load that image.') };

  var tp = traceParams(inputs.quality, inputs.smoothing);
  var gs = gridSize(img, tp.detail);
  if (!gs) return { posterSvg: placeholder('Could not read that image.') };
  var g = sampleRGBA(url, img, gs.cols, gs.rows);
  if (!g) return { posterSvg: placeholder('Could not read that image (cross-origin).') };

  // Brightness/Contrast: re-tone the photo before separating. Skip the pass entirely
  // when both are neutral so the common case stays a no-op on the cached sample grid.
  var gTone = (brightness || contrast) ? applyTone(g, toneLUT(brightness, contrast)) : g;

  // Invert tones: trace from a negative of the (toned) luminance, so its bright
  // regions become the foreground separations. RGB is untouched (separations keep
  // their real photo colours), so it only reorders which tones group/stack. Built
  // fresh rather than mutating the cached sample grid.
  var gEff = gTone;
  if (invert) {
    var iv = new Uint8Array(gTone.lum.length);
    for (var ii = 0; ii < iv.length; ii++) iv[ii] = 255 - gTone.lum[ii];
    gEff = { lum: iv, alpha: gTone.alpha, r: gTone.r, g: gTone.g, b: gTone.b, cols: gTone.cols, rows: gTone.rows };
  }

  var thr = quantileThresholds(gEff, steps);
  var auto = autoPalette(gEff, thr, steps);

  // ── Auto-then-manual palette ────────────────────────────────────────────────
  // Seed every separation's colour from the photo, then let the user recolour any
  // swatch. RESEED from the photo only when: the list is empty (first load), the user
  // pressed Re-sample, the Colour-steps slider changed (documented), or the photo
  // changed while the swatches were still the untouched auto seed. Otherwise RECONCILE
  // the user's swatches to `steps` by index — so a manual recolour survives a photo
  // swap, and a stray +Add / remove (the generic blocks UI always offers them) only
  // re-pins the count instead of wiping every colour.
  var blocks = Array.isArray(inputs.colors) ? inputs.colors : [];
  var resample = Boolean(inputs.resample);
  var stepsChanged = _prevSteps !== null && _prevSteps !== steps;
  var photoChanged = _seedUrl !== null && _seedUrl !== url;
  var toneChanged = _seedTone !== null && _seedTone !== toneKey;       // brightness/contrast moved
  var untouched = !!_seedPalette && blocks.length === _seedPalette.length
    && blocks.every(function (b, i) { return color(b && b.color, '').toLowerCase() === String(_seedPalette[i]).toLowerCase(); });
  var palette, patch = {};
  // Re-tone is treated like editing the photo: reseed the swatches from the newly
  // toned image when they're still the untouched auto seed; keep manual recolours.
  if (resample || blocks.length === 0 || stepsChanged || ((photoChanged || toneChanged) && untouched)) {
    palette = auto.slice();
    patch.colors = palette.map(function (c) { return { color: c }; });  // seed/replace the editable swatches
    if (resample) patch.resample = false;                               // one-shot button
    _seedPalette = palette.slice();                                     // remember this auto seed
    _seedTone = toneKey;                                                // …and the tone it was sampled at
  } else {
    palette = [];
    for (var pi = 0; pi < steps; pi++) palette.push(color(blocks[pi] && blocks[pi].color, auto[pi]));
    if (blocks.length !== steps) patch.colors = palette.map(function (c) { return { color: c }; }); // re-pin count, keep edits
  }
  _seedUrl = url;
  _prevSteps = steps;

  var grid = { g: gEff, cols: g.cols, rows: g.rows, tp: tp, invert: invert, tone: toneKey };

  // Memoise the SVG on everything that changes the pixels — palette, steps, size,
  // quality, tone, transparency, photo — so dragging an unrelated control is cheap.
  var memoKey = JSON.stringify({ url: url, steps: steps, q: inputs.quality, sm: inputs.smoothing, inv: invert, tone: toneKey, W: W, H: H, t: _transparent, pal: palette });
  if (memoKey === _memoKey) { patch.posterSvg = _memoResult; return patch; }

  var svg;
  try { svg = buildPoster(url, img, W, H, grid, thr, palette); }
  catch (e) {
    if (host.log) host.log('warn', 'filter-posterize: build failed', { error: String(e) });
    svg = placeholder('Could not posterise this photo.');
  }
  _memoKey = memoKey; _memoResult = svg;
  patch.posterSvg = svg;
  return patch;
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }

function beforeExport(ctx) {
  // Raster formats: honour "No background" for alpha-capable formats, else flat the
  // paper colour so a non-matching export aspect has no transparent margins. (SVG/PDF
  // keep their own paper rect / transparency from the markup.)
  var alpha = ['png', 'webp'];
  if (alpha.indexOf(ctx.format) !== -1) ctx.opts.background = _transparent ? 'transparent' : _paper;
  else if (ctx.format === 'jpg' || ctx.format === 'jpeg') ctx.opts.background = _paper;
}
