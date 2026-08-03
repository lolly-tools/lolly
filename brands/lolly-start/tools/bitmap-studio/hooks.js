/**
 * Bitmap Studio — hooks.
 *
 * A professional photo-grading darkroom in one deterministic canvas pipeline:
 *
 *   frame → [ colour pipeline ] → [ texture pass ] → one composed bitmap
 *
 * The COLOUR pipeline (white balance → exposure → tone → saturation/vibrance →
 * film-look preset → third-party LUT → brand treatment) is never run per pixel
 * directly. Instead it is baked into a single 3D lookup table (33³ by default)
 * by evaluating the full stack over an identity grid, and that table is applied
 * to the pixels with tetrahedral interpolation — the same architecture a
 * grading suite uses. Two payoffs: applying N stacked adjustments costs the
 * same as applying one, and the "Download look as .cube" bake IS the very
 * table the preview used, so what a user sees on canvas is byte-for-byte what
 * their NLE will do with the exported LUT.
 *
 * Third-party LUTs: Adobe/IRIDAS .cube (LUT_1D_SIZE / LUT_3D_SIZE, DOMAIN_MIN/
 * MAX, red-fastest) and Autodesk .3dl (mesh line + integer triples,
 * blue-fastest) are parsed from the `lutFile` file input entirely on-device.
 *
 * Film-look presets are ORIGINAL, procedural recipes (channel curves + split
 * tones + saturation moves defined as data below) — inspired by classic
 * stocks but sampled from nothing, so they are licence-clean.
 *
 * Brand treatments (duotone / gradient map / split tone / wash) seed their
 * colours from host.tokens (the brand's DTCG palette): darkest swatch for
 * shadows, most chromatic for mids, lightest for highlights — each
 * overridable by a colour input. Mapping runs in OKLab so ramps stay
 * perceptually smooth (same maths as engine/src/brand-derive.ts; tools can't
 * import from the engine, so the matrices live here).
 *
 * The TEXTURE pass (sharpen, chromatic aberration, bloom, halation, grain,
 * dust & scratches, vignette) is spatial — it can't live in a LUT — and runs
 * after colour, seeded by a mulberry32 PRNG so the same seed always renders
 * the same frame. Pixel work needs a real <canvas>; in a headless shell the
 * still path degrades to a note. The .cube BAKE itself is pure maths (no
 * canvas), but its delivery rides host.export.file, which the CLI bridge
 * deliberately stubs out — so baking is a web/Tauri affordance and a headless
 * bake logs a clear warning instead of failing silently.
 */

/* global onInit, onInput, onFrame, host */

var STILL_MAX = 1440; // working-canvas long edge for stills — snappy on slider drag
var LIVE_MAX = 900;   // live camera frames trade a little size for frame rate
var MAX_EDGE = 8000;
var LUT_N = 33;       // grid size of the internal pipeline LUT (also the bake default)

var _memoKey = null;
var _memoResult = null;
var _lastOutSrc = null;                        // previous composed bitmap (template double-buffer)
var _imgCache = { url: null, promise: null };  // decoded user image
var _demoCanvas = null;                        // procedural demo scene, drawn once
var _framedCache = { key: null, canvas: null };// cover-framed source
var _pipeLutCache = { key: null, lut: null };  // baked colour-pipeline LUT
var _userLutCache = { id: null, lut: null };   // parsed .cube/.3dl (keyed by file identity)
var _brandStops = null;                        // resolved brand palette stops (once per mount)
var _bakeBusy = false;                         // re-entrancy guard for the .cube download

// ── helpers ──────────────────────────────────────────────────────────────────

function inputsFrom(model) { var o = {}; model.forEach(function (i) { o[i.id] = i.value; }); return o; }
function n(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
// === lolly:shared clamp — generated from community/_shared/math.js; edit there and run npm run sync:shared ===
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
// === /lolly:shared clamp ===
// === lolly:shared canRaster — generated from community/_shared/raster.js; edit there and run npm run sync:shared ===
function canRaster() {
  if (typeof document === 'undefined' || !document.createElement) return false;
  try { var c = document.createElement('canvas'); return !!(c.getContext && c.getContext('2d')); }
  catch (e) { return false; }
}
// === /lolly:shared canRaster ===
// crossOrigin so the canvas isn't tainted — a tainted canvas makes both
// toDataURL (preview) and the export's canvas read throw.
// === lolly:shared loadImage — generated from community/_shared/raster.js; edit there and run npm run sync:shared ===
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
// === /lolly:shared loadImage ===

function getImage(url) {
  if (_imgCache.url === url && _imgCache.promise) return _imgCache.promise;
  var promise = loadImage(url);
  _imgCache = { url: url, promise: promise };
  promise.catch(function () { if (_imgCache.url === url) _imgCache = { url: null, promise: null }; });
  return promise;
}

// Deterministic PRNG — drives grain and dust so a seed always reproduces.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// FNV-1a over bytes → 32-bit uint. Identifies a loaded LUT file for caching.
function fnvBytes(bytes) {
  var h = 2166136261;
  for (var i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Working-canvas dimensions: export aspect, long edge capped.
function workDims(W, H, maxEdge) {
  W = clamp(Math.round(W), 1, MAX_EDGE); H = clamp(Math.round(H), 1, MAX_EDGE);
  var longest = Math.max(W, H);
  if (longest <= maxEdge) return { w: W, h: H };
  var k = maxEdge / longest;
  return { w: Math.max(1, Math.round(W * k)), h: Math.max(1, Math.round(H * k)) };
}

// object-fit:cover + object-position + zoom (1 = exactly cover).
function drawCover(ctx, source, iw, ih, W, H, zoom, px, py) {
  var s = Math.max(W / iw, H / ih) * zoom;
  var dw = iw * s, dh = ih * s;
  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, -px * (dw - W), -py * (dh - H), dw, dh);
}

// ── colour maths ─────────────────────────────────────────────────────────────

function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function linearToSrgb(c) { return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }

function hexToRgb01(hex) {
  var h = (typeof hex === 'string' ? hex : '').trim().replace(/^#/, '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length === 8) h = h.slice(0, 6); // ignore alpha
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  var v = parseInt(h, 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

// OKLab (Björn Ottosson's reference matrices, ported like the sibling filter
// tools do — tools never import from the engine).
function rgb01ToOklab(r, g, b) {
  r = srgbToLinear(r); g = srgbToLinear(g); b = srgbToLinear(b);
  var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function oklabToRgb01(L, a, b) {
  var l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  var m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  var s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    clamp(linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), 0, 1),
    clamp(linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), 0, 1),
    clamp(linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s), 0, 1),
  ];
}

var LUM_R = 0.2126, LUM_G = 0.7152, LUM_B = 0.0722; // Rec.709 luma

// Monotone-cubic curve through control points [[x,y]…] (Fritsch–Carlson), the
// classic photo-curve interpolator: passes through every point, never
// overshoots. Returns an evaluator over [0,1].
function makeCurve(points) {
  var xs = points.map(function (p) { return p[0]; });
  var ys = points.map(function (p) { return p[1]; });
  var np = xs.length;
  if (np === 0) return function (x) { return x; };
  if (np === 1) return function () { return ys[0]; };
  var dx = [], dy = [], m = [];
  for (var i = 0; i < np - 1; i++) { dx.push(xs[i + 1] - xs[i]); dy.push(ys[i + 1] - ys[i]); m.push(dy[i] / dx[i]); }
  var c1 = [m[0]];
  for (i = 1; i < np - 1; i++) {
    if (m[i - 1] * m[i] <= 0) c1.push(0);
    else {
      var common = dx[i - 1] + dx[i];
      c1.push(3 * common / ((common + dx[i]) / m[i - 1] + (common + dx[i - 1]) / m[i]));
    }
  }
  c1.push(m[np - 2]);
  return function (x) {
    if (x <= xs[0]) return ys[0] + c1[0] * (x - xs[0]);
    if (x >= xs[np - 1]) return ys[np - 1] + c1[np - 1] * (x - xs[np - 1]);
    var lo = 0, hi = np - 2;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid - 1; }
    var h = dx[lo], t = (x - xs[lo]) / h;
    var t2 = t * t, t3 = t2 * t;
    var h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    return h00 * ys[lo] + h10 * h * c1[lo] + h01 * ys[lo + 1] + h11 * h * c1[lo + 1];
  };
}

function smoothstep(a, b, x) {
  var t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// ── film-look presets ────────────────────────────────────────────────────────
// Each look is DATA: per-channel + master curves (control points), a
// saturation multiplier, an optional monochrome mix, and an optional split
// tone { shadow, highlight, amt } in OKLab a/b. All original recipes.

var ID = [[0, 0], [1, 1]];
var PRESETS = {
  'chrome': { // punchy slide film: deep S, rich colour, cool clean shadows
    l: [[0, 0], [0.18, 0.12], [0.5, 0.52], [0.82, 0.90], [1, 1]],
    r: ID, g: ID, b: [[0, 0.02], [0.5, 0.5], [1, 0.98]],
    sat: 1.18, mono: 0,
    split: { shadow: '#1c3448', highlight: '#f5e9d2', amt: 0.10 },
  },
  'portrait': { // warm, soft highlight rolloff, gentle lift
    l: [[0, 0.02], [0.25, 0.24], [0.6, 0.64], [0.9, 0.93], [1, 0.97]],
    r: [[0, 0], [0.5, 0.53], [1, 1]], g: ID, b: [[0, 0.01], [0.5, 0.48], [1, 0.97]],
    sat: 1.04, mono: 0,
    split: { shadow: '#3a2e26', highlight: '#ffe9cf', amt: 0.08 },
  },
  'teal-orange': { // blockbuster: shadows to teal, skin/highlights to orange
    l: [[0, 0], [0.2, 0.15], [0.5, 0.52], [0.85, 0.9], [1, 1]],
    r: ID, g: ID, b: ID,
    sat: 1.08, mono: 0,
    split: { shadow: '#0e5e63', highlight: '#ff9b3d', amt: 0.28 },
  },
  'bleach': { // bleach bypass: silver retained — desaturated, harsh
    l: [[0, 0], [0.25, 0.16], [0.5, 0.5], [0.75, 0.85], [1, 1]],
    r: ID, g: ID, b: ID,
    sat: 0.42, mono: 0,
    split: { shadow: '#20242a', highlight: '#e8e4da', amt: 0.08 },
  },
  'matte': { // faded matte: lifted blacks, capped whites, mellow colour
    l: [[0, 0.09], [0.3, 0.33], [0.7, 0.72], [1, 0.94]],
    r: ID, g: ID, b: [[0, 0.06], [0.5, 0.5], [1, 0.96]],
    sat: 0.88, mono: 0,
    split: { shadow: '#2c3040', highlight: '#efe6d8', amt: 0.10 },
  },
  'cross': { // cross process: green-cyan shadows, yellow highlights, hot contrast
    l: [[0, 0], [0.22, 0.14], [0.55, 0.6], [1, 1]],
    r: [[0, 0.03], [0.5, 0.47], [1, 0.99]],
    g: [[0, 0.02], [0.5, 0.54], [1, 1]],
    b: [[0, 0.1], [0.5, 0.44], [1, 0.86]],
    sat: 1.12, mono: 0,
    split: { shadow: '#1e4d3a', highlight: '#f2e04c', amt: 0.16 },
  },
  'night': { // blue hour: cool, crushed, quiet colour
    l: [[0, 0], [0.3, 0.2], [0.6, 0.55], [1, 0.92]],
    r: [[0, 0], [0.5, 0.46], [1, 0.95]], g: ID, b: [[0, 0.04], [0.5, 0.55], [1, 1]],
    sat: 0.82, mono: 0,
    split: { shadow: '#16264d', highlight: '#b8c8e8', amt: 0.18 },
  },
  'bw': { // classic pan film: orange-filterish mix, gentle S
    l: [[0, 0], [0.2, 0.16], [0.5, 0.52], [0.8, 0.86], [1, 1]],
    r: ID, g: ID, b: ID,
    sat: 1, mono: 1, monoMix: [0.35, 0.5, 0.15],
    split: null,
  },
  'bw-hard': { // push-processed: steep S, bright grain-ready mids
    l: [[0, 0], [0.22, 0.08], [0.5, 0.52], [0.78, 0.94], [1, 1]],
    r: ID, g: ID, b: ID,
    sat: 1, mono: 1, monoMix: [0.4, 0.45, 0.15],
    split: null,
  },
  'sepia': { // warm mono print
    l: [[0, 0.02], [0.3, 0.28], [0.7, 0.75], [1, 0.97]],
    r: ID, g: ID, b: ID,
    sat: 1, mono: 1, monoMix: [LUM_R, LUM_G, LUM_B],
    split: { shadow: '#4a3620', highlight: '#e9d3ae', amt: 0.5 },
  },
};

// Compile a preset into fast evaluators once per pipeline build.
function compilePreset(name) {
  var p = PRESETS[name];
  if (!p) return null;
  var cl = makeCurve(p.l), cr = makeCurve(p.r), cg = makeCurve(p.g), cb = makeCurve(p.b);
  var sSh = p.split ? hexToRgb01(p.split.shadow) : null;
  var sHi = p.split ? hexToRgb01(p.split.highlight) : null;
  return {
    sat: p.sat, mono: p.mono || 0, monoMix: p.monoMix || null,
    splitAmt: p.split ? p.split.amt : 0,
    shLab: sSh ? rgb01ToOklab(sSh[0], sSh[1], sSh[2]) : null,
    hiLab: sHi ? rgb01ToOklab(sHi[0], sHi[1], sHi[2]) : null,
    curveL: cl, curveR: cr, curveG: cg, curveB: cb,
  };
}

// ── LUT parsing (.cube / .3dl) ───────────────────────────────────────────────

// Adobe/IRIDAS .cube. Returns { kind:'1d'|'3d', size, data:Float32Array,
// domainMin:[3], domainMax:[3], title } or throws with a friendly message.
// Data order for 3D is red-fastest (the .cube spec).
function parseCube(text) {
  var lines = String(text).split(/\r?\n/);
  var size = 0, kind = null, title = '';
  var domainMin = [0, 0, 0], domainMax = [1, 1, 1];
  var data = [], i, line;
  for (i = 0; i < lines.length; i++) {
    line = lines[i].trim();
    if (!line || line[0] === '#') continue;
    var up = line.toUpperCase();
    if (up.indexOf('TITLE') === 0) { var m = line.match(/"(.*)"/); title = m ? m[1] : line.slice(5).trim(); continue; }
    if (up.indexOf('LUT_1D_SIZE') === 0) { kind = '1d'; size = parseInt(line.split(/\s+/)[1], 10); continue; }
    if (up.indexOf('LUT_3D_SIZE') === 0) { kind = '3d'; size = parseInt(line.split(/\s+/)[1], 10); continue; }
    if (up.indexOf('DOMAIN_MIN') === 0) { domainMin = line.split(/\s+/).slice(1, 4).map(Number); continue; }
    if (up.indexOf('DOMAIN_MAX') === 0) { domainMax = line.split(/\s+/).slice(1, 4).map(Number); continue; }
    if (up.indexOf('LUT_') === 0 || up.indexOf('TITLE') === 0) continue; // unknown keyword
    var parts = line.split(/\s+/);
    if (parts.length < 3) continue;
    var r = Number(parts[0]), g = Number(parts[1]), b = Number(parts[2]);
    if (!isFinite(r) || !isFinite(g) || !isFinite(b)) continue;
    data.push(r, g, b);
  }
  if (!kind || !(size >= 2)) throw new Error('Not a .cube LUT (no LUT_1D_SIZE / LUT_3D_SIZE)');
  if (size > 129) throw new Error('LUT grid too large (max 129)');
  var expect = kind === '3d' ? size * size * size * 3 : size * 3;
  if (data.length < expect) throw new Error('LUT is truncated (' + (data.length / 3) + ' of ' + (expect / 3) + ' rows)');
  return {
    kind: kind, size: size, data: new Float32Array(data.slice(0, expect)),
    domainMin: domainMin, domainMax: domainMax, title: title,
  };
}

// Autodesk .3dl: a mesh line of grid input levels, then size³ integer triples,
// BLUE-fastest (red slowest — the opposite of .cube), on a 0..(2^depth − 1)
// output scale detected from the data. Reordered here to red-fastest so one
// sampler serves both formats.
function parse3dl(text) {
  var lines = String(text).split(/\r?\n/);
  var mesh = null, rows = [], i;
  for (i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line || line[0] === '#' || /^[A-Za-z]/.test(line)) continue; // skip keywords/comments
    var parts = line.split(/\s+/).map(Number);
    if (parts.some(function (v) { return !isFinite(v); })) continue;
    if (!mesh && parts.length > 3) { mesh = parts; continue; } // the mesh line
    if (parts.length >= 3) rows.push(parts.slice(0, 3));
  }
  var size = mesh ? mesh.length : Math.round(Math.pow(rows.length, 1 / 3));
  if (!(size >= 2) || rows.length < size * size * size) throw new Error('Not a .3dl LUT');
  if (size > 65) throw new Error('LUT grid too large (max 65 for .3dl)');
  var peak = 0;
  for (i = 0; i < rows.length; i++) peak = Math.max(peak, rows[i][0], rows[i][1], rows[i][2]);
  var scale = peak > 4095 ? 65535 : peak > 1023 ? 4095 : peak > 255 ? 1023 : 255;
  var data = new Float32Array(size * size * size * 3);
  var k = 0;
  for (var rI = 0; rI < size; rI++) for (var gI = 0; gI < size; gI++) for (var bI = 0; bI < size; bI++) {
    var row = rows[k++];
    var out = ((bI * size + gI) * size + rI) * 3; // red-fastest destination
    data[out] = row[0] / scale; data[out + 1] = row[1] / scale; data[out + 2] = row[2] / scale;
  }
  return { kind: '3d', size: size, data: data, domainMin: [0, 0, 0], domainMax: [1, 1, 1], title: '' };
}

// Parse the lutFile input (InputFile) → LUT record or { error }.
function parseLutFile(file) {
  var text;
  try {
    if (typeof TextDecoder !== 'undefined') text = new TextDecoder().decode(file.bytes);
    else { // last-ditch: bytes are ASCII in practice for both formats
      var s = ''; for (var i = 0; i < file.bytes.length; i++) s += String.fromCharCode(file.bytes[i]);
      text = s;
    }
    var name = String(file.name || '').toLowerCase();
    if (name.slice(-4) === '.3dl') return parse3dl(text);
    // .cube first; a .3dl renamed .txt still parses via the fallback below.
    try { return parseCube(text); } catch (e) { return parse3dl(text); }
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
}

// Sample a parsed LUT at r,g,b (0..1). 3D uses tetrahedral interpolation —
// the standard for grading (exact on the grid, best diagonal behaviour);
// 1D interpolates each channel linearly. Returns [r,g,b].
function sampleLut(lut, r, g, b) {
  var dm = lut.domainMin, dM = lut.domainMax;
  r = clamp((r - dm[0]) / (dM[0] - dm[0] || 1), 0, 1);
  g = clamp((g - dm[1]) / (dM[1] - dm[1] || 1), 0, 1);
  b = clamp((b - dm[2]) / (dM[2] - dm[2] || 1), 0, 1);
  var N = lut.size, d = lut.data;
  if (lut.kind === '1d') {
    var out = [r, g, b];
    for (var c = 0; c < 3; c++) {
      var x = out[c] * (N - 1);
      var i0 = Math.floor(x); var f = x - i0;
      var i1 = Math.min(i0 + 1, N - 1);
      out[c] = d[i0 * 3 + c] * (1 - f) + d[i1 * 3 + c] * f;
    }
    return out;
  }
  var x = r * (N - 1), y = g * (N - 1), z = b * (N - 1);
  var x0 = Math.min(Math.floor(x), N - 2), y0 = Math.min(Math.floor(y), N - 2), z0 = Math.min(Math.floor(z), N - 2);
  if (N === 2) { x0 = 0; y0 = 0; z0 = 0; }
  var fx = x - x0, fy = y - y0, fz = z - z0;
  function at(xi, yi, zi, c) { return d[((zi * N + yi) * N + xi) * 3 + c]; } // red-fastest
  // Tetrahedral: pick the tetrahedron of the cube cell containing (fx,fy,fz)
  // and barycentric-blend its four corners.
  var out3 = [0, 0, 0];
  for (var ch = 0; ch < 3; ch++) {
    var c000 = at(x0, y0, z0, ch), c111 = at(x0 + 1, y0 + 1, z0 + 1, ch);
    var v;
    if (fx >= fy) {
      if (fy >= fz) { // x ≥ y ≥ z
        v = (1 - fx) * c000 + (fx - fy) * at(x0 + 1, y0, z0, ch) + (fy - fz) * at(x0 + 1, y0 + 1, z0, ch) + fz * c111;
      } else if (fx >= fz) { // x ≥ z > y
        v = (1 - fx) * c000 + (fx - fz) * at(x0 + 1, y0, z0, ch) + (fz - fy) * at(x0 + 1, y0, z0 + 1, ch) + fy * c111;
      } else { // z > x ≥ y
        v = (1 - fz) * c000 + (fz - fx) * at(x0, y0, z0 + 1, ch) + (fx - fy) * at(x0 + 1, y0, z0 + 1, ch) + fy * c111;
      }
    } else {
      if (fz >= fy) { // z ≥ y > x
        v = (1 - fz) * c000 + (fz - fy) * at(x0, y0, z0 + 1, ch) + (fy - fx) * at(x0, y0 + 1, z0 + 1, ch) + fx * c111;
      } else if (fz >= fx) { // y > z ≥ x
        v = (1 - fy) * c000 + (fy - fz) * at(x0, y0 + 1, z0, ch) + (fz - fx) * at(x0, y0 + 1, z0 + 1, ch) + fx * c111;
      } else { // y > x > z
        v = (1 - fy) * c000 + (fy - fx) * at(x0, y0 + 1, z0, ch) + (fx - fz) * at(x0 + 1, y0 + 1, z0, ch) + fz * c111;
      }
    }
    out3[ch] = v;
  }
  return out3;
}

// ── brand palette stops ──────────────────────────────────────────────────────

// Resolve the brand's treatment seeds from host.tokens once per mount:
//   shadow    = darkest swatch, highlight = lightest, mid = most chromatic.
// Falls back to neutral ink/paper + a slate blue when tokens are unavailable.
function resolveBrandStops() {
  if (_brandStops) return Promise.resolve(_brandStops);
  var fallback = { shadow: '#1c2230', mid: '#5c7cfa', highlight: '#f4f2ec' };
  if (!host.tokens || !host.tokens.colors) return Promise.resolve((_brandStops = fallback));
  return host.tokens.colors().then(function (swatches) {
    var best = { shadow: null, mid: null, highlight: null };
    var minL = 2, maxL = -1, maxC = -1;
    (swatches || []).forEach(function (sw) {
      var rgb = hexToRgb01(sw && sw.value);
      if (!rgb) return;
      var lab = rgb01ToOklab(rgb[0], rgb[1], rgb[2]);
      var C = Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]);
      if (lab[0] < minL) { minL = lab[0]; best.shadow = sw.value; }
      if (lab[0] > maxL) { maxL = lab[0]; best.highlight = sw.value; }
      if (C > maxC) { maxC = C; best.mid = sw.value; }
    });
    _brandStops = {
      shadow: best.shadow || fallback.shadow,
      mid: best.mid || fallback.mid,
      highlight: best.highlight || fallback.highlight,
    };
    return _brandStops;
  }).catch(function () { return (_brandStops = fallback); });
}

// ── the colour pipeline ──────────────────────────────────────────────────────

// Normalise every input into one params object (also the memo/cache key).
function paramsFrom(inputs) {
  var fr = inputs.imageFraming || {};
  var lutFileId = null;
  var lf = inputs.lutFile;
  if (lf && lf.bytes && lf.bytes.length) lutFileId = (lf.name || 'lut') + ':' + lf.size + ':' + fnvBytes(lf.bytes);
  return {
    // colour stages (baked into the pipeline LUT — also the .cube bake)
    temperature: clamp(n(inputs.temperature, 0), -100, 100) / 100,
    tint: clamp(n(inputs.tint, 0), -100, 100) / 100,
    exposure: clamp(n(inputs.exposure, 0), -3, 3),
    contrast: clamp(n(inputs.contrast, 0), -100, 100) / 100,
    highlights: clamp(n(inputs.highlights, 0), -100, 100) / 100,
    shadows: clamp(n(inputs.shadows, 0), -100, 100) / 100,
    saturation: clamp(n(inputs.saturation, 100), 0, 200) / 100,
    vibrance: clamp(n(inputs.vibrance, 0), -100, 100) / 100,
    preset: PRESETS[inputs.preset] ? inputs.preset : 'none',
    presetStrength: clamp(n(inputs.presetStrength, 100), 0, 100) / 100,
    lutFileId: lutFileId,
    lutIntensity: clamp(n(inputs.lutIntensity, 100), 0, 100) / 100,
    treatment: ['tint', 'duotone', 'gradient', 'split'].indexOf(inputs.treatment) !== -1 ? inputs.treatment : 'none',
    treatmentAmount: clamp(n(inputs.treatmentAmount, 80), 0, 100) / 100,
    treatShadow: hexToRgb01(inputs.treatShadow) ? inputs.treatShadow : '',
    treatMid: hexToRgb01(inputs.treatMid) ? inputs.treatMid : '',
    treatHighlight: hexToRgb01(inputs.treatHighlight) ? inputs.treatHighlight : '',
    // texture stages (spatial)
    grain: clamp(n(inputs.grain, 0), 0, 100) / 100,
    grainSize: clamp(n(inputs.grainSize, 1.6), 1, 4),
    vignette: clamp(n(inputs.vignette, 0), 0, 100) / 100,
    bloom: clamp(n(inputs.bloom, 0), 0, 100) / 100,
    halation: clamp(n(inputs.halation, 0), 0, 100) / 100,
    fringe: clamp(n(inputs.fringe, 0), 0, 100) / 100,
    sharpen: clamp(n(inputs.sharpen, 0), 0, 100) / 100,
    dust: clamp(n(inputs.dust, 0), 0, 100) / 100,
    seed: clamp(Math.round(n(inputs.seed, 7)), 1, 9999),
    // view / framing
    splitPreview: !!inputs.splitPreview,
    histogram: !!inputs.histogram,
    zoom: clamp(n(fr.zoom, 100), 100, 800) / 100,
    px: clamp(n(fr.x, 50), 0, 100) / 100,
    py: clamp(n(fr.y, 50), 0, 100) / 100,
    W: clamp(Math.round(n(inputs.width, 1080)), 1, MAX_EDGE),
    H: clamp(Math.round(n(inputs.height, 1080)), 1, MAX_EDGE),
    bakeSize: inputs.bakeSize === '17' ? 17 : inputs.bakeSize === '65' ? 65 : 33,
  };
}

// The key of everything the COLOUR pipeline depends on (drives the LUT cache).
function colorKey(P, stops) {
  return JSON.stringify([
    P.temperature, P.tint, P.exposure, P.contrast, P.highlights, P.shadows,
    P.saturation, P.vibrance, P.preset, P.presetStrength, P.lutFileId,
    P.lutIntensity, P.treatment, P.treatmentAmount,
    P.treatShadow, P.treatMid, P.treatHighlight, stops,
  ]);
}

// Build the full colour transfer function: sRGB [0,1]³ → sRGB [0,1]³.
// This is evaluated ~N³ times to bake the pipeline LUT, so it can afford to
// be honest (real linear-light exposure, OKLab treatment maths) rather than
// approximated.
function makeColorFn(P, stops, userLut) {
  var pre = P.preset !== 'none' ? compilePreset(P.preset) : null;
  var expGain = Math.pow(2, P.exposure);
  // White balance channel gains in linear light (simple but effective dual-axis).
  var wr = 1 + 0.28 * P.temperature - 0.06 * P.tint;
  var wg = 1 - 0.06 * Math.abs(P.temperature) - 0.22 * P.tint;
  var wb = 1 - 0.30 * P.temperature - 0.06 * P.tint;
  // Contrast S-curve steepness (tanh-normalised so ±100 stays smooth).
  var ck = P.contrast >= 0 ? 1 + 2.2 * P.contrast : 1 / (1 - 0.75 * P.contrast);
  var ctNorm = Math.tanh(ck * 0.5) * 2;
  // Treatment stops in OKLab.
  var tSh = hexToRgb01(P.treatShadow || stops.shadow);
  var tMd = hexToRgb01(P.treatMid || stops.mid);
  var tHi = hexToRgb01(P.treatHighlight || stops.highlight);
  var labSh = tSh ? rgb01ToOklab(tSh[0], tSh[1], tSh[2]) : null;
  var labMd = tMd ? rgb01ToOklab(tMd[0], tMd[1], tMd[2]) : null;
  var labHi = tHi ? rgb01ToOklab(tHi[0], tHi[1], tHi[2]) : null;

  return function (r, g, b) {
    // 1. white balance + exposure in linear light
    var lr = srgbToLinear(r) * wr * expGain;
    var lg = srgbToLinear(g) * wg * expGain;
    var lb = srgbToLinear(b) * wb * expGain;
    r = clamp(linearToSrgb(lr), 0, 1); g = clamp(linearToSrgb(lg), 0, 1); b = clamp(linearToSrgb(lb), 0, 1);

    // 2. tone: contrast S-curve about mid-grey, then highlight/shadow recovery
    if (P.contrast !== 0) {
      r = clamp(0.5 + Math.tanh(ck * (r - 0.5)) / ctNorm, 0, 1);
      g = clamp(0.5 + Math.tanh(ck * (g - 0.5)) / ctNorm, 0, 1);
      b = clamp(0.5 + Math.tanh(ck * (b - 0.5)) / ctNorm, 0, 1);
    }
    var luma = LUM_R * r + LUM_G * g + LUM_B * b;
    if (P.highlights !== 0) {
      var hw = smoothstep(0.45, 0.95, luma) * 0.6 * P.highlights;
      r = clamp(r + hw * (1 - r), 0, 1); g = clamp(g + hw * (1 - g), 0, 1); b = clamp(b + hw * (1 - b), 0, 1);
    }
    if (P.shadows !== 0) {
      var sw2 = (1 - smoothstep(0.05, 0.55, luma)) * 0.6 * P.shadows;
      if (sw2 >= 0) { r = clamp(r + sw2 * (1 - r) * 0.8, 0, 1); g = clamp(g + sw2 * (1 - g) * 0.8, 0, 1); b = clamp(b + sw2 * (1 - b) * 0.8, 0, 1); }
      else { var kk = 1 + sw2; r = clamp(r * kk + (1 - kk) * r * luma, 0, 1); g = clamp(g * kk + (1 - kk) * g * luma, 0, 1); b = clamp(b * kk + (1 - kk) * b * luma, 0, 1); }
    }

    // 3. saturation + vibrance about luma
    luma = LUM_R * r + LUM_G * g + LUM_B * b;
    var sat = P.saturation;
    if (P.vibrance !== 0) {
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      var have = mx <= 0 ? 0 : (mx - mn) / mx; // rough current saturation
      sat += P.vibrance * (P.vibrance > 0 ? (1 - have) : have) * 0.9;
    }
    if (sat !== 1) {
      sat = clamp(sat, 0, 3);
      r = clamp(luma + (r - luma) * sat, 0, 1);
      g = clamp(luma + (g - luma) * sat, 0, 1);
      b = clamp(luma + (b - luma) * sat, 0, 1);
    }

    // 4. film-look preset (curves + mono mix + split tone), blended by strength
    if (pre && P.presetStrength > 0) {
      var pr = r, pg = g, pb = b;
      if (pre.mono) {
        var mix = pre.monoMix;
        var mV = clamp(mix[0] * pr + mix[1] * pg + mix[2] * pb, 0, 1);
        pr = mV; pg = mV; pb = mV;
      }
      pr = clamp(pre.curveR(pr), 0, 1); pg = clamp(pre.curveG(pg), 0, 1); pb = clamp(pre.curveB(pb), 0, 1);
      var pl = LUM_R * pr + LUM_G * pg + LUM_B * pb;
      var nl = clamp(pre.curveL(pl), 0, 1);
      if (pl > 1e-5) { var lk = nl / pl; pr = clamp(pr * lk, 0, 1); pg = clamp(pg * lk, 0, 1); pb = clamp(pb * lk, 0, 1); }
      if (pre.sat !== 1) {
        var pluma = LUM_R * pr + LUM_G * pg + LUM_B * pb;
        pr = clamp(pluma + (pr - pluma) * pre.sat, 0, 1);
        pg = clamp(pluma + (pg - pluma) * pre.sat, 0, 1);
        pb = clamp(pluma + (pb - pluma) * pre.sat, 0, 1);
      }
      if (pre.splitAmt > 0 && pre.shLab && pre.hiLab) {
        var lab = rgb01ToOklab(pr, pg, pb);
        var shW = (1 - smoothstep(0.15, 0.7, lab[0])) * pre.splitAmt;
        var hiW = smoothstep(0.45, 0.95, lab[0]) * pre.splitAmt;
        lab[1] += (pre.shLab[1] - lab[1]) * shW + (pre.hiLab[1] - lab[1]) * hiW;
        lab[2] += (pre.shLab[2] - lab[2]) * shW + (pre.hiLab[2] - lab[2]) * hiW;
        var prgb = oklabToRgb01(lab[0], lab[1], lab[2]);
        pr = prgb[0]; pg = prgb[1]; pb = prgb[2];
      }
      var t = P.presetStrength;
      r += (pr - r) * t; g += (pg - g) * t; b += (pb - b) * t;
    }

    // 5. third-party LUT, blended by intensity
    if (userLut && P.lutIntensity > 0) {
      var lo = sampleLut(userLut, r, g, b);
      var ti = P.lutIntensity;
      r = clamp(r + (lo[0] - r) * ti, 0, 1);
      g = clamp(g + (lo[1] - g) * ti, 0, 1);
      b = clamp(b + (lo[2] - b) * ti, 0, 1);
    }

    // 6. brand treatment in OKLab, blended by amount
    if (P.treatment !== 'none' && P.treatmentAmount > 0 && labSh && labHi) {
      var lab2 = rgb01ToOklab(r, g, b);
      var L = lab2[0];
      var out;
      if (P.treatment === 'duotone') {
        out = [labSh[0] + (labHi[0] - labSh[0]) * L,
          labSh[1] + (labHi[1] - labSh[1]) * L,
          labSh[2] + (labHi[2] - labSh[2]) * L];
      } else if (P.treatment === 'gradient' && labMd) {
        out = L < 0.5
          ? [labSh[0] + (labMd[0] - labSh[0]) * (L * 2), labSh[1] + (labMd[1] - labSh[1]) * (L * 2), labSh[2] + (labMd[2] - labSh[2]) * (L * 2)]
          : [labMd[0] + (labHi[0] - labMd[0]) * (L * 2 - 1), labMd[1] + (labHi[1] - labMd[1]) * (L * 2 - 1), labMd[2] + (labHi[2] - labMd[2]) * (L * 2 - 1)];
      } else if (P.treatment === 'split') {
        var shW2 = 1 - smoothstep(0.2, 0.65, L);
        var hiW2 = smoothstep(0.45, 0.9, L);
        out = [L,
          lab2[1] + (labSh[1] - lab2[1]) * shW2 * 0.6 + (labHi[1] - lab2[1]) * hiW2 * 0.6,
          lab2[2] + (labSh[2] - lab2[2]) * shW2 * 0.6 + (labHi[2] - lab2[2]) * hiW2 * 0.6];
      } else { // tint: pull chroma toward the shadow stop's hue, keep L
        out = [L,
          lab2[1] + (labSh[1] - lab2[1]) * 0.75,
          lab2[2] + (labSh[2] - lab2[2]) * 0.75];
      }
      var trgb = oklabToRgb01(out[0], out[1], out[2]);
      var ta = P.treatmentAmount;
      r = r + (trgb[0] - r) * ta; g = g + (trgb[1] - g) * ta; b = b + (trgb[2] - b) * ta;
    }
    return [r, g, b];
  };
}

// Bake the colour pipeline over an identity grid → Float32Array(N³·3),
// red-fastest (the .cube layout, and what applyPipelineLut expects).
function buildPipelineLut(P, stops, userLut, N) {
  var fn = makeColorFn(P, stops, userLut);
  var data = new Float32Array(N * N * N * 3);
  var k = 0;
  for (var bI = 0; bI < N; bI++) {
    var bv = bI / (N - 1);
    for (var gI = 0; gI < N; gI++) {
      var gv = gI / (N - 1);
      for (var rI = 0; rI < N; rI++) {
        var out = fn(rI / (N - 1), gv, bv);
        data[k++] = out[0]; data[k++] = out[1]; data[k++] = out[2];
      }
    }
  }
  return { kind: '3d', size: N, data: data, domainMin: [0, 0, 0], domainMax: [1, 1, 1], title: '' };
}

// True when the colour pipeline is an identity (skip the whole pass).
function colorActive(P, userLut) {
  return P.temperature !== 0 || P.tint !== 0 || P.exposure !== 0 || P.contrast !== 0
    || P.highlights !== 0 || P.shadows !== 0 || P.saturation !== 1 || P.vibrance !== 0
    || (P.preset !== 'none' && P.presetStrength > 0)
    || (!!userLut && P.lutIntensity > 0)
    || (P.treatment !== 'none' && P.treatmentAmount > 0);
}

// Apply the baked pipeline LUT to an ImageData in place (tetrahedral, inlined
// flat math — this is the per-pixel hot loop).
function applyPipelineLut(imageData, lut) {
  var d = imageData.data, tab = lut.data, N = lut.size, N1 = N - 1;
  for (var i = 0; i < d.length; i += 4) {
    var x = (d[i] / 255) * N1, y = (d[i + 1] / 255) * N1, z = (d[i + 2] / 255) * N1;
    var x0 = x | 0, y0 = y | 0, z0 = z | 0;
    if (x0 > N - 2) x0 = N - 2; if (y0 > N - 2) y0 = N - 2; if (z0 > N - 2) z0 = N - 2;
    var fx = x - x0, fy = y - y0, fz = z - z0;
    var base = ((z0 * N + y0) * N + x0) * 3;
    var sx = 3, sy = N * 3, sz = N * N * 3;
    var i000 = base, i111 = base + sx + sy + sz;
    var w0, w1, w2, w3, ia, ib;
    if (fx >= fy) {
      if (fy >= fz) { w0 = 1 - fx; w1 = fx - fy; w2 = fy - fz; w3 = fz; ia = i000 + sx; ib = i000 + sx + sy; }
      else if (fx >= fz) { w0 = 1 - fx; w1 = fx - fz; w2 = fz - fy; w3 = fy; ia = i000 + sx; ib = i000 + sx + sz; }
      else { w0 = 1 - fz; w1 = fz - fx; w2 = fx - fy; w3 = fy; ia = i000 + sz; ib = i000 + sx + sz; }
    } else {
      if (fz >= fy) { w0 = 1 - fz; w1 = fz - fy; w2 = fy - fx; w3 = fx; ia = i000 + sz; ib = i000 + sy + sz; }
      else if (fz >= fx) { w0 = 1 - fy; w1 = fy - fz; w2 = fz - fx; w3 = fx; ia = i000 + sy; ib = i000 + sy + sz; }
      else { w0 = 1 - fy; w1 = fy - fx; w2 = fx - fz; w3 = fz; ia = i000 + sy; ib = i000 + sx + sy; }
    }
    d[i]     = 255 * (w0 * tab[i000]     + w1 * tab[ia]     + w2 * tab[ib]     + w3 * tab[i111]);
    d[i + 1] = 255 * (w0 * tab[i000 + 1] + w1 * tab[ia + 1] + w2 * tab[ib + 1] + w3 * tab[i111 + 1]);
    d[i + 2] = 255 * (w0 * tab[i000 + 2] + w1 * tab[ia + 2] + w2 * tab[ib + 2] + w3 * tab[i111 + 2]);
  }
}

// ── .cube bake ───────────────────────────────────────────────────────────────

function f6(v) { return (Math.round(clamp(v, 0, 1) * 1e6) / 1e6).toFixed(6); }

// Serialise the current colour pipeline as an Adobe/IRIDAS .cube.
function bakeCubeText(P, stops, userLut, N) {
  var lut = buildPipelineLut(P, stops, userLut, N);
  var lines = [
    '# Baked by Lolly Bitmap Studio',
    '# Colour pipeline: develop + film look (' + P.preset + ') + LUT + brand treatment (' + P.treatment + ')',
    'TITLE "Lolly Bitmap Studio look"',
    'LUT_3D_SIZE ' + N,
    'DOMAIN_MIN 0.0 0.0 0.0',
    'DOMAIN_MAX 1.0 1.0 1.0',
  ];
  var d = lut.data;
  for (var i = 0; i < d.length; i += 3) {
    lines.push(f6(d[i]) + ' ' + f6(d[i + 1]) + ' ' + f6(d[i + 2]));
  }
  return lines.join('\n') + '\n';
}

// Deliver the baked .cube via the transform path (host.export.file — never
// watermarked, no provenance; the bytes are the user's own look). The bake is
// pure maths, but delivery needs a shell that implements export.file (web,
// Tauri); the CLI's stub rejects, which lands in the catch below as a warning.
function deliverBake(P, stops, userLut) {
  if (_bakeBusy) return Promise.resolve();
  _bakeBusy = true;
  var text;
  try { text = bakeCubeText(P, stops, userLut, P.bakeSize); }
  catch (e) { _bakeBusy = false; if (host.log) host.log('warn', 'bitmap-studio: LUT bake failed', { error: String(e) }); return Promise.resolve(); }
  var name = 'bitmap-studio-look-' + P.bakeSize + '.cube';
  var deliver;
  try {
    var blob = typeof Blob !== 'undefined' ? new Blob([text], { type: 'text/plain' }) : text;
    if (host.export && host.export.file) deliver = host.export.file(blob, { filename: name });
    else if (host.export && host.export.download) deliver = host.export.download(blob, name);
    else deliver = Promise.resolve();
  } catch (e) { deliver = Promise.resolve(); }
  return Promise.resolve(deliver).catch(function (e) {
    if (host.log) host.log('warn', 'bitmap-studio: LUT download needs a shell with export.file (web or desktop) — ' + String(e));
  }).then(function () { _bakeBusy = false; });
}

// ── demo scene ───────────────────────────────────────────────────────────────

// A deterministic, asset-free landscape drawn once at 1600² — full tonal range
// (bright sun → deep shadow), warm/cool hues and fine ridge detail, so every
// preset, LUT and treatment has something honest to bite on.
function makeDemoScene() {
  if (_demoCanvas) return _demoCanvas;
  var S = 1600;
  var c = document.createElement('canvas'); c.width = S; c.height = S;
  var ctx = c.getContext('2d'); if (!ctx) return null;

  var sky = ctx.createLinearGradient(0, 0, 0, S * 0.66);
  sky.addColorStop(0, '#27346c');
  sky.addColorStop(0.45, '#7a6ea8');
  sky.addColorStop(0.78, '#e0885e');
  sky.addColorStop(1, '#f6c976');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, S, S * 0.66);

  var sunX = S * 0.62, sunY = S * 0.52, sunR = S * 0.075;
  var glow = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 5);
  glow.addColorStop(0, 'rgba(255,240,200,0.95)');
  glow.addColorStop(0.25, 'rgba(255,210,140,0.45)');
  glow.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, S, S * 0.66);
  ctx.fillStyle = '#fff3d8';
  ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();

  // Three ridge lines, deterministic sine sums, darker as they come forward.
  var ridges = [
    { base: 0.52, amp: 0.05, f1: 2.1, f2: 5.3, color: '#8c6e93' },
    { base: 0.58, amp: 0.06, f1: 1.4, f2: 7.1, color: '#5c4a72' },
    { base: 0.64, amp: 0.05, f1: 2.8, f2: 3.7, color: '#2e2643' },
  ];
  ridges.forEach(function (rd, ri) {
    ctx.fillStyle = rd.color;
    ctx.beginPath();
    ctx.moveTo(0, S);
    for (var x = 0; x <= S; x += 8) {
      var t = x / S;
      var y = rd.base + rd.amp * (Math.sin(t * Math.PI * rd.f1 + ri * 1.7) * 0.6 + Math.sin(t * Math.PI * rd.f2 + ri * 4.1) * 0.4);
      ctx.lineTo(x, y * S);
    }
    ctx.lineTo(S, S);
    ctx.closePath(); ctx.fill();
  });

  // Water: mirrored dusk gradient + a broken sun streak.
  var wy = S * 0.66;
  var water = ctx.createLinearGradient(0, wy, 0, S);
  water.addColorStop(0, '#d8925e');
  water.addColorStop(0.3, '#7a5878');
  water.addColorStop(1, '#161a30');
  ctx.fillStyle = water; ctx.fillRect(0, wy, S, S - wy);
  ctx.fillStyle = 'rgba(255,226,170,0.5)';
  for (var i = 0; i < 26; i++) {
    var yy = wy + (i / 26) * (S - wy) * 0.75;
    var ww = S * 0.10 * (1 - i / 30) * (0.6 + 0.4 * Math.sin(i * 2.4));
    ctx.fillRect(sunX - ww / 2, yy, ww, Math.max(2, S * 0.004));
  }
  // Foreground bank silhouette, near-black for true shadows.
  ctx.fillStyle = '#0b0d16';
  ctx.beginPath();
  ctx.moveTo(0, S);
  for (var x2 = 0; x2 <= S; x2 += 8) {
    var t2 = x2 / S;
    ctx.lineTo(x2, S * (0.9 + 0.05 * Math.sin(t2 * Math.PI * 1.7 + 0.6) - 0.06 * smoothstep(0, 0.4, t2)));
  }
  ctx.lineTo(S, S);
  ctx.closePath(); ctx.fill();

  _demoCanvas = c;
  return c;
}

// ── texture pass ─────────────────────────────────────────────────────────────

function textureActive(P) {
  return P.grain > 0 || P.vignette > 0 || P.bloom > 0 || P.halation > 0
    || P.fringe > 0 || P.sharpen > 0 || P.dust > 0;
}

// Separable box blur ×2 over an offscreen canvas (≈ gaussian; radius px).
function blurCanvas(src, radius) {
  var c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  var ctx = c.getContext('2d'); if (!ctx) return src;
  if (ctx.filter !== undefined) {
    ctx.filter = 'blur(' + radius + 'px)';
    ctx.drawImage(src, 0, 0);
    return c;
  }
  // No ctx.filter (old WebKit): cheap approximation via downscale-upscale.
  var k = Math.max(1, radius / 2);
  var small = document.createElement('canvas');
  small.width = Math.max(1, Math.round(src.width / k)); small.height = Math.max(1, Math.round(src.height / k));
  var sctx = small.getContext('2d');
  sctx.drawImage(src, 0, 0, small.width, small.height);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(small, 0, 0, c.width, c.height);
  return c;
}

// Chromatic aberration: resample R outward / B inward radially. O(px), bilinear.
function applyFringe(ctx, W, H, amt) {
  var img;
  try { img = ctx.getImageData(0, 0, W, H); } catch (e) { return; }
  var src = new Uint8ClampedArray(img.data);
  var d = img.data;
  var cx = W / 2, cy = H / 2;
  var maxShift = amt * 0.012; // fraction of half-diagonal at the corner
  function sampleCh(x, y, ch) {
    x = clamp(x, 0, W - 1.001); y = clamp(y, 0, H - 1.001);
    var x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
    var x1 = Math.min(x0 + 1, W - 1), y1 = Math.min(y0 + 1, H - 1);
    var a = src[(y0 * W + x0) * 4 + ch], b = src[(y0 * W + x1) * 4 + ch];
    var c = src[(y1 * W + x0) * 4 + ch], e = src[(y1 * W + x1) * 4 + ch];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy;
  }
  for (var y = 0; y < H; y++) {
    for (var x = 0; x < W; x++) {
      var dx = (x - cx), dy = (y - cy);
      var rr = Math.sqrt(dx * dx + dy * dy) / Math.sqrt(cx * cx + cy * cy);
      var k = maxShift * rr * rr; // grows toward corners
      if (k < 1e-5) continue;
      var i4 = (y * W + x) * 4;
      d[i4]     = sampleCh(x - dx * k, y - dy * k, 0); // R pulled in ⇒ appears pushed out
      d[i4 + 2] = sampleCh(x + dx * k, y + dy * k, 2); // B pushed out ⇒ appears pulled in
    }
  }
  ctx.putImageData(img, 0, 0);
}

// Sharpen (unsharp mask), grain, dust and vignette — one combined ImageData
// pass where possible, canvas composites where cheaper.
function applyTexture(out, P) {
  var W = out.width, H = out.height;
  var ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  // Chromatic aberration first (a lens artefact — everything else sits on top).
  if (P.fringe > 0) applyFringe(ctx, W, H, P.fringe);

  // Sharpen: out += (out − blur) · k
  if (P.sharpen > 0) {
    var blurred = blurCanvas(out, Math.max(1, Math.round(Math.min(W, H) / 600)) * 1.2);
    var bctx = blurred.getContext('2d', { willReadFrequently: true });
    if (bctx) {
      try {
        var oi = ctx.getImageData(0, 0, W, H);
        var bi = bctx.getImageData(0, 0, W, H);
        var od = oi.data, bd = bi.data;
        var k = P.sharpen * 1.1;
        for (var i = 0; i < od.length; i += 4) {
          od[i] += (od[i] - bd[i]) * k;
          od[i + 1] += (od[i + 1] - bd[i + 1]) * k;
          od[i + 2] += (od[i + 2] - bd[i + 2]) * k;
        }
        ctx.putImageData(oi, 0, 0);
      } catch (e) { /* tainted — skip */ }
    }
  }

  // Bloom + halation: bright-pass → blur → additive composite. Bright pass is
  // built at half resolution (the blur destroys detail anyway) for speed.
  if (P.bloom > 0 || P.halation > 0) {
    var hw = Math.max(1, W >> 1), hh = Math.max(1, H >> 1);
    var bp = document.createElement('canvas'); bp.width = hw; bp.height = hh;
    var bpx = bp.getContext('2d', { willReadFrequently: true });
    if (bpx) {
      bpx.drawImage(out, 0, 0, hw, hh);
      try {
        var bimg = bpx.getImageData(0, 0, hw, hh);
        var bdd = bimg.data;
        for (var j = 0; j < bdd.length; j += 4) {
          var lum = (LUM_R * bdd[j] + LUM_G * bdd[j + 1] + LUM_B * bdd[j + 2]) / 255;
          var w = smoothstep(0.68, 0.95, lum);
          bdd[j] *= w; bdd[j + 1] *= w; bdd[j + 2] *= w;
        }
        bpx.putImageData(bimg, 0, 0);
        var soft = blurCanvas(bp, Math.max(2, Math.round(Math.min(hw, hh) * 0.02)));
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        if (P.bloom > 0) {
          ctx.globalAlpha = P.bloom * 0.55;
          ctx.drawImage(soft, 0, 0, W, H);
        }
        if (P.halation > 0) {
          // Halation is the red-orange print halo: tint the same soft pass.
          var tintC = document.createElement('canvas'); tintC.width = hw; tintC.height = hh;
          var tctx = tintC.getContext('2d');
          if (tctx) {
            tctx.drawImage(soft, 0, 0);
            tctx.globalCompositeOperation = 'multiply';
            tctx.fillStyle = '#ff5a28';
            tctx.fillRect(0, 0, hw, hh);
            tctx.globalCompositeOperation = 'destination-in';
            tctx.drawImage(soft, 0, 0); // restore the soft alpha shape
            ctx.globalAlpha = P.halation * 0.6;
            ctx.drawImage(tintC, 0, 0, W, H);
          }
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      } catch (e) { /* tainted — skip */ }
    }
  }

  // Grain + vignette in one ImageData pass. Grain is value noise on a lattice
  // (grainSize px cells, bilinear), luminance-weighted like real stock.
  if (P.grain > 0 || P.vignette > 0) {
    try {
      var gi = ctx.getImageData(0, 0, W, H);
      var gd = gi.data;
      var cx2 = W / 2, cy2 = H / 2;
      var maxR2 = cx2 * cx2 + cy2 * cy2;
      var cell = P.grainSize;
      var gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2;
      var lattice = null;
      if (P.grain > 0) {
        lattice = new Float32Array(gw * gh);
        var rng = mulberry32(P.seed * 2654435761 >>> 0 || 1);
        for (var li = 0; li < lattice.length; li++) lattice[li] = rng() * 2 - 1;
      }
      var gAmt = P.grain * 34;
      var vAmt = P.vignette;
      for (var y2 = 0; y2 < H; y2++) {
        var gy = y2 / cell, gy0 = gy | 0, gfy = gy - gy0;
        for (var x3 = 0; x3 < W; x3++) {
          var i5 = (y2 * W + x3) * 4;
          var r5 = gd[i5], g5 = gd[i5 + 1], b5 = gd[i5 + 2];
          if (lattice) {
            var gx = x3 / cell, gx0 = gx | 0, gfx = gx - gx0;
            var l00 = lattice[gy0 * gw + gx0], l10 = lattice[gy0 * gw + gx0 + 1];
            var l01 = lattice[(gy0 + 1) * gw + gx0], l11 = lattice[(gy0 + 1) * gw + gx0 + 1];
            var nv = (l00 * (1 - gfx) + l10 * gfx) * (1 - gfy) + (l01 * (1 - gfx) + l11 * gfx) * gfy;
            var lum2 = (LUM_R * r5 + LUM_G * g5 + LUM_B * b5) / 255;
            var gw2 = 4 * lum2 * (1 - lum2); // midtone-weighted (peaks at 0.5)
            var add = nv * gAmt * (0.35 + 0.65 * gw2);
            r5 += add; g5 += add; b5 += add;
          }
          if (vAmt > 0) {
            var dx2 = x3 - cx2, dy2 = y2 - cy2;
            var vr = (dx2 * dx2 + dy2 * dy2) / maxR2;
            var vk = 1 - vAmt * smoothstep(0.28, 1.05, vr) * 0.82;
            r5 *= vk; g5 *= vk; b5 *= vk;
          }
          gd[i5] = r5; gd[i5 + 1] = g5; gd[i5 + 2] = b5;
        }
      }
      ctx.putImageData(gi, 0, 0);
    } catch (e) { /* tainted — skip */ }
  }

  // Dust & scratches: seeded specks, fibres, and vertical hairlines drawn as
  // vector strokes over the raster (soft-light-ish alpha).
  if (P.dust > 0) {
    var rng2 = mulberry32((P.seed * 40503 + 977) >>> 0 || 1);
    var count = Math.round(6 + P.dust * 70);
    ctx.save();
    for (var s2 = 0; s2 < count; s2++) {
      var lightFleck = rng2() < 0.78;
      ctx.fillStyle = lightFleck ? 'rgba(255,252,240,' + (0.18 + rng2() * 0.4).toFixed(3) + ')'
        : 'rgba(20,16,12,' + (0.15 + rng2() * 0.3).toFixed(3) + ')';
      var px2 = rng2() * W, py2 = rng2() * H;
      var kind = rng2();
      if (kind < 0.72) { // speck
        var rad = 0.4 + rng2() * rng2() * Math.min(W, H) * 0.004;
        ctx.beginPath(); ctx.arc(px2, py2, rad, 0, Math.PI * 2); ctx.fill();
      } else if (kind < 0.92) { // curled fibre
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 0.5 + rng2() * 0.9;
        ctx.beginPath();
        ctx.moveTo(px2, py2);
        var fl = Math.min(W, H) * (0.01 + rng2() * 0.03);
        var a1 = rng2() * Math.PI * 2, a2 = a1 + (rng2() - 0.5) * 2.2;
        ctx.quadraticCurveTo(px2 + Math.cos(a1) * fl, py2 + Math.sin(a1) * fl,
          px2 + Math.cos(a2) * fl * 1.6, py2 + Math.sin(a2) * fl * 1.6);
        ctx.stroke();
      } else { // vertical hairline scratch
        ctx.strokeStyle = 'rgba(255,250,235,' + (0.1 + rng2() * 0.2).toFixed(3) + ')';
        ctx.lineWidth = 0.5 + rng2() * 0.7;
        var sl = H * (0.1 + rng2() * 0.5);
        ctx.beginPath();
        ctx.moveTo(px2, py2 - sl / 2);
        ctx.lineTo(px2 + (rng2() - 0.5) * 6, py2 + sl / 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

// ── histogram ────────────────────────────────────────────────────────────────

// 64-bin RGB+luma histogram of the composed frame, as a small SVG string the
// template shows in a screen-only overlay ([data-export-hide]).
function buildHistogramSvg(canvas) {
  var ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '';
  var img;
  try { img = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch (e) { return ''; }
  var d = img.data;
  var BINS = 64;
  var hr = new Float32Array(BINS), hg = new Float32Array(BINS), hb = new Float32Array(BINS), hl = new Float32Array(BINS);
  var step = Math.max(4, Math.round(d.length / 4 / 60000)) * 4; // ≤ ~60k samples
  for (var i = 0; i < d.length; i += step) {
    var r = d[i], g = d[i + 1], b = d[i + 2];
    hr[(r * BINS / 256) | 0]++; hg[(g * BINS / 256) | 0]++; hb[(b * BINS / 256) | 0]++;
    hl[((LUM_R * r + LUM_G * g + LUM_B * b) * BINS / 256) | 0]++;
  }
  var peak = 1;
  for (i = 0; i < BINS; i++) peak = Math.max(peak, hr[i], hg[i], hb[i], hl[i]);
  function poly(h) {
    var pts = '0,40 ';
    for (var j2 = 0; j2 < BINS; j2++) {
      pts += (j2 * 100 / (BINS - 1)).toFixed(1) + ',' + (40 - 38 * Math.sqrt(h[j2] / peak)).toFixed(1) + ' ';
    }
    return pts + '100,40';
  }
  return '<svg viewBox="0 0 100 40" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">'
    + '<polygon points="' + poly(hl) + '" fill="rgba(255,255,255,0.30)"/>'
    + '<polygon points="' + poly(hr) + '" fill="none" stroke="#ff6b6b" stroke-width="0.7"/>'
    + '<polygon points="' + poly(hg) + '" fill="none" stroke="#51cf66" stroke-width="0.7"/>'
    + '<polygon points="' + poly(hb) + '" fill="none" stroke="#74b9ff" stroke-width="0.7"/>'
    + '</svg>';
}

// ── compose ──────────────────────────────────────────────────────────────────

// Resolve (and cache) the parsed user LUT for the current lutFile input.
function currentUserLut(inputs, P) {
  if (!P.lutFileId) { _userLutCache = { id: null, lut: null }; return { lut: null, error: null }; }
  if (_userLutCache.id === P.lutFileId) return { lut: _userLutCache.lut, error: _userLutCache.error || null };
  var parsed = parseLutFile(inputs.lutFile);
  if (parsed && parsed.error) {
    _userLutCache = { id: P.lutFileId, lut: null, error: parsed.error };
    return { lut: null, error: parsed.error };
  }
  _userLutCache = { id: P.lutFileId, lut: parsed, error: null };
  return { lut: parsed, error: null };
}

// The full render: framed source → colour LUT → texture. Returns a canvas.
function renderFrame(source, iw, ih, dims, P, stops, userLut) {
  var key = null;
  var framed;
  if (source.__frameKey) { // live frames pass a canvas straight through
    framed = source;
  } else {
    key = JSON.stringify([source.__srcId, dims.w, dims.h, P.zoom, P.px, P.py]);
    if (_framedCache.key === key && _framedCache.canvas) framed = _framedCache.canvas;
    else {
      framed = document.createElement('canvas'); framed.width = dims.w; framed.height = dims.h;
      var fctx = framed.getContext('2d', { willReadFrequently: true });
      if (!fctx) return null;
      drawCover(fctx, source, iw, ih, dims.w, dims.h, P.zoom, P.px, P.py);
      _framedCache = { key: key, canvas: framed };
    }
  }

  var out = document.createElement('canvas'); out.width = dims.w; out.height = dims.h;
  var octx = out.getContext('2d', { willReadFrequently: true });
  if (!octx) return null;
  octx.drawImage(framed, 0, 0);

  if (colorActive(P, userLut)) {
    try {
      var img = octx.getImageData(0, 0, dims.w, dims.h);
      applyPipelineLut(img, getPipelineLut(P, userLut));
      octx.putImageData(img, 0, 0);
    } catch (e) { /* tainted canvas — leave uncoloured rather than blank */ }
  }
  if (textureActive(P)) applyTexture(out, P);

  // Before/after split: restore the untouched left half with a hairline seam.
  if (P.splitPreview) {
    var half = Math.round(dims.w / 2);
    octx.drawImage(framed, 0, 0, half, dims.h, 0, 0, half, dims.h);
    octx.fillStyle = 'rgba(255,255,255,0.9)';
    octx.fillRect(half - 1, 0, 2, dims.h);
  }
  return out;
}

// The pipeline LUT for the current colour params (one-entry cache).
var _stopsForKey = null;
function getPipelineLut(P, userLut) {
  var key = colorKey(P, _stopsForKey);
  if (_pipeLutCache.key === key && _pipeLutCache.lut) return _pipeLutCache.lut;
  var lut = buildPipelineLut(P, _stopsForKey, userLut, LUT_N);
  _pipeLutCache = { key: key, lut: lut };
  return lut;
}

async function compute(model) {
  var inputs = inputsFrom(model);
  var P = paramsFrom(inputs);

  var stops = await resolveBrandStops();
  _stopsForKey = stops;

  var lutRes = currentUserLut(inputs, P);
  var lutNote = lutRes.error ? 'LUT not readable: ' + lutRes.error : null;
  var lutLabel = lutRes.lut
    ? ((lutRes.lut.title || (inputs.lutFile && inputs.lutFile.name) || 'LUT')
      + ' · ' + (lutRes.lut.kind === '1d' ? lutRes.lut.size + '-step 1D' : lutRes.lut.size + '³'))
    : null;

  // The .cube bake is pure maths — it works even headless, and must run
  // before the raster guard so the CLI can bake with --bakeLut=true.
  if (inputs.bakeLut) {
    await deliverBake(P, stops, lutRes.lut);
    // Fall through to the normal render; the patch below resets the switch.
  }

  if (!canRaster()) {
    return { outSrc: null, note: 'Preview renders in the browser', bakeLut: false, lutNote: lutNote, lutLabel: lutLabel, histSvg: '' };
  }

  // Resolve the source: the user's pick, else the procedural demo scene.
  var ref = inputs.image;
  var url = ref && typeof ref === 'object' ? ref.url : null;

  var dims = workDims(P.W, P.H, STILL_MAX);
  var memoKey = JSON.stringify({ url: url, P: P, d: dims, stops: stops });
  if (memoKey === _memoKey) {
    // Still reset the bake switch on a repeated render.
    return inputs.bakeLut ? Object.assign({}, _memoResult, { bakeLut: false }) : _memoResult;
  }

  var source, iw, ih;
  try {
    if (url) {
      var img = await getImage(url);
      iw = img.naturalWidth || img.width; ih = img.naturalHeight || img.height;
      if (!iw || !ih) return { outSrc: null, note: 'Could not read this image', bakeLut: false, lutNote: lutNote, lutLabel: lutLabel, histSvg: '' };
      source = img; source.__srcId = url;
    } else {
      source = makeDemoScene();
      if (!source) return { outSrc: null, note: 'Preview renders in the browser', bakeLut: false, lutNote: lutNote, lutLabel: lutLabel, histSvg: '' };
      iw = source.width; ih = source.height; source.__srcId = 'demo';
    }
  } catch (e) {
    if (host.log) host.log('warn', 'bitmap-studio: image load failed', { error: String(e) });
    return { outSrc: null, note: 'Could not read this image', bakeLut: false, lutNote: lutNote, lutLabel: lutLabel, histSvg: '' };
  }

  var out = renderFrame(source, iw, ih, dims, P, stops, lutRes.lut);
  if (!out) return { outSrc: null, note: 'Preview renders in the browser', bakeLut: false, lutNote: lutNote, lutLabel: lutLabel, histSvg: '' };

  var outSrc;
  try { outSrc = out.toDataURL('image/jpeg', 0.92); }
  catch (e) {
    if (host.log) host.log('warn', 'bitmap-studio: canvas read failed (tainted image?)', { error: String(e) });
    return { outSrc: null, note: 'Could not read this image', bakeLut: false, lutNote: lutNote, lutLabel: lutLabel, histSvg: '' };
  }

  var histSvg = P.histogram ? buildHistogramSvg(out) : '';

  // Previous bitmap as a decode buffer (see template.html), only when changed.
  var prev = (_lastOutSrc && _lastOutSrc !== outSrc) ? _lastOutSrc : null;
  _lastOutSrc = outSrc;
  _memoKey = memoKey;
  _memoResult = {
    outSrc: outSrc, prevSrc: prev, note: null,
    histSvg: histSvg, lutNote: lutNote, lutLabel: lutLabel,
    bakeLut: false, split: P.splitPreview,
  };
  return _memoResult;
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }

// Live camera (engine v1.4): grade every frame through the same pipeline. The
// pipeline LUT is cached across frames (params rarely change mid-stream), so
// per-frame cost is the tetrahedral apply + texture pass at LIVE_MAX.
function onFrame(ctx) {
  var frame = ctx.frame;
  if (!frame || !frame.data || !frame.width || !frame.height) return null;
  if (!canRaster() || typeof ImageData === 'undefined') return null;
  var inputs = inputsFrom(ctx.model);
  var P = paramsFrom(inputs);
  var stops = _brandStops || { shadow: '#1c2230', mid: '#5c7cfa', highlight: '#f4f2ec' };
  _stopsForKey = stops;
  if (!_brandStops) resolveBrandStops(); // warm for the next frame, don't await

  var lutRes = currentUserLut(inputs, P);
  var dims = workDims(P.W, P.H, LIVE_MAX);
  var srcFrame, live;
  try {
    srcFrame = document.createElement('canvas');
    srcFrame.width = frame.width; srcFrame.height = frame.height;
    srcFrame.getContext('2d').putImageData(new ImageData(frame.data, frame.width, frame.height), 0, 0);
    live = document.createElement('canvas'); live.width = dims.w; live.height = dims.h;
    var lctx = live.getContext('2d', { willReadFrequently: true });
    drawCover(lctx, srcFrame, frame.width, frame.height, dims.w, dims.h, P.zoom, P.px, P.py);
    live.__frameKey = true;
  } catch (e) { return null; }

  var out = renderFrame(live, dims.w, dims.h, dims, P, stops, lutRes.lut);
  if (!out) return null;
  _memoKey = null; _framedCache = { key: null, canvas: null }; // live supersedes still caches
  var outSrc;
  try { outSrc = out.toDataURL('image/jpeg', 0.85); } catch (e) { return null; }
  _lastOutSrc = outSrc;
  return {
    outSrc: outSrc, prevSrc: null, note: null,
    histSvg: P.histogram ? buildHistogramSvg(out) : '',
    bakeLut: false, split: P.splitPreview,
  };
}
