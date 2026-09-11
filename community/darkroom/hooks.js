/**
 * Bitmap Studio - hooks.
 *
 * A professional photo-grading darkroom in one deterministic canvas pipeline:
 *
 *   frame → [ colour pipeline ] → [ texture pass ] → one composed bitmap
 *
 * The COLOUR pipeline (white balance → exposure → tone → saturation/vibrance →
 * film-look preset → third-party LUT → brand treatment) is never run per pixel
 * directly. Instead it is baked into a single 3D lookup table (33³ by default)
 * by evaluating the full stack over an identity grid, and that table is applied
 * to the pixels with tetrahedral interpolation - the same architecture a
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
 * tones + saturation moves defined as data below) - inspired by classic
 * stocks but sampled from nothing, so they are licence-clean.
 *
 * Brand treatments (duotone / gradient map / split tone / wash) seed their
 * colours from host.tokens (the brand's DTCG palette): darkest swatch for
 * shadows, most chromatic for mids, lightest for highlights - each
 * overridable by a colour input. Mapping runs in OKLab so ramps stay
 * perceptually smooth (same maths as engine/src/brand-derive.ts; tools can't
 * import from the engine, so the matrices live here).
 *
 * The TEXTURE pass (sharpen, chromatic aberration, bloom, halation, grain,
 * dust & scratches, vignette) is spatial - it can't live in a LUT - and runs
 * after colour, seeded by a mulberry32 PRNG so the same seed always renders
 * the same frame. Pixel work needs a real <canvas>; in a headless shell the
 * still path degrades to a note. The .cube BAKE itself is pure maths (no
 * canvas), but its delivery rides host.export.file, which the CLI bridge
 * deliberately stubs out - so baking is a web/Tauri affordance and a headless
 * bake logs a clear warning instead of failing silently.
 *
 * The pipeline LUT is also PUBLISHED continuously as the `videoLook` extra - a
 * small JSON envelope carrying the preview's own 33³ table as .cube text, plus
 * an `on` flag saying whether the pipeline is anything but an identity - so a
 * shell can hand this exact grade to something the tool never sees, notably
 * applying the look to a video clip frame by frame. It serialises the table the
 * still is graded through rather than baking a second one, so publishing costs
 * the write and not the bake; the bakeSize control stays what it says it is, the
 * grid of the .cube DOWNLOAD. Nothing about the extra is canvas-bound, so it is
 * emitted before the raster guard alongside the download bake, and it is
 * key-guarded on the colour identity so a texture or framing tweak never pays
 * for a re-serialise.
 */

/* global onInit, onInput, onFrame, host */

var STILL_MAX = 1440; // working-canvas long edge for stills - snappy on slider drag
var LIVE_MAX = 900;   // live camera frames trade a little size for frame rate
var MAX_EDGE = 8000;
var LUT_N = 33;       // grid size of the internal pipeline LUT (also the bake default)
// Untrusted-input bounds (the lutFile bytes are user-supplied; fuzzed by
// tests/fuzz - target 'lut-parse'). A grid of N costs N³ float triples, so the
// cap is what bounds parse memory: 129³·3 floats ≈ 25 MB, the practical
// ceiling shipping .cube files use; .3dl grids top out at 64+1 in the wild.
var CUBE_MAX_N = 129;
var TDL_MAX_N = 65;
// The shipped open preset LUTs - see assets/luts/NOTICE.md. The film-emulation
// looks are CC0; suse7-slog3-heavy is CC BY 4.0 (© SUSE, by Peter Chamalian). Keys
// are the served .cube basenames; this doubles as the whitelist for the untrusted
// lutPreset select value (never interpolate an unvalidated id into the URL).
var PRESET_LUTS = { 'slide-standard': 1, 'slide-vivid': 1, 'chrome-muted': 1, 'mono-fine': 1, 'suse7-slog3-heavy': 1 };
var PRESET_LUT_BASE = '/tools/darkroom/assets/luts/';

var _memoKey = null;
var _memoResult = null;
var _lastOutSrc = null;                        // previous composed bitmap (template double-buffer)
var _imgCache = { url: null, promise: null };  // decoded user image
// First-state subject when nothing is picked: the lorikeet portrait (a real photo
// to grade - the starter catalog's demo raster, AI-generated and declared so), then
// the animated Lolly swirl (an SVG, rasterised on decode like any vector) for a
// catalog that ships without the photo. Tried in order; _defaultUrl caches the
// first that resolves; the procedural demo scene stays as the fallback if none do.
var DEFAULT_IMAGE_IDS = ['lolly/demo/lorikeet-lollipop', 'lolly/demo/lolly-spin'];
var _defaultUrl = null;
var _demoCanvas = null;                        // procedural demo scene, drawn once
var _framedCache = { key: null, canvas: null };// cover-framed source
var _beforeCache = { key: null, src: null };   // framed source as a data URL (split "before" layer)
var _pipeLutCache = { key: null, lut: null };  // baked colour-pipeline LUT
var _userLutCache = { id: null, lut: null };   // parsed .cube/.3dl (keyed by file identity)
var _brandStops = null;                        // resolved brand palette stops (once per mount)
var _bakeBusy = false;                         // re-entrancy guard for the .cube download
var _presetLutCache = { id: null, lut: null, error: null }; // parsed preset .cube (keyed 'preset:<id>')
var _presetInflight = { id: null, promise: null };          // in-flight preset fetch (shared)
var _presetDlBusy = false;                                  // re-entrancy guard for preset download
var _deepState = null;                                      // last still render's resolved inputs (for exportStill)
var _videoLookKey = null;                                   // colour identity of the last published `videoLook` extra

// ── helpers ──────────────────────────────────────────────────────────────────

function inputsFrom(model) { var o = {}; model.forEach(function (i) { o[i.id] = i.value; }); return o; }
function n(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
// === lolly:shared clamp - generated from community/_shared/math.js; edit there and run npm run sync:shared ===
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
// === /lolly:shared clamp ===
// === lolly:shared canRaster - generated from community/_shared/raster.js; edit there and run npm run sync:shared ===
function canRaster() {
  return !!(host.raster && host.raster.canRaster());
}
// === /lolly:shared canRaster ===
// crossOrigin so the canvas isn't tainted - a tainted canvas makes both
// toDataURL (preview) and the export's canvas read throw.
// === lolly:shared loadImage - generated from community/_shared/raster.js; edit there and run npm run sync:shared ===
function loadImage(url) {
  if (!host.raster) return Promise.reject(new Error('no raster'));
  return host.raster.decode(url);
}
// === /lolly:shared loadImage ===

function getImage(url) {
  if (_imgCache.url === url && _imgCache.promise) return _imgCache.promise;
  var promise = loadImage(url);
  _imgCache = { url: url, promise: promise };
  promise.catch(function () { if (_imgCache.url === url) _imgCache = { url: null, promise: null }; });
  return promise;
}

// ── Layered mode (plan 106 - the Layers fold) ────────────────────────────────
// A non-empty `layers` stack replaces the single image: the visible rows are
// composited bottom-to-top at the document size, and the composite feeds the
// grade pipeline like any other source. The stored blend values are CSS
// keywords, which the canvas blend-op set shares ('' means source-over).
var _layerImgCache = {};                          // url → decode promise (small per-layer images)
var _layerStackCache = { key: null, canvas: null };

/** URL-string tolerant boolean: false / 'false' / '0' / '' → false. */
function truthy(v, dflt) {
  if (v === undefined || v === null || v === '') return dflt;
  return !(v === false || v === 'false' || v === '0' || v === 0);
}

function layerRows(inputs) {
  return Array.isArray(inputs.layers) ? inputs.layers : [];
}

/** The composite's identity: every row field that changes the drawn stack. */
function layerStackKey(rows, W, H) {
  return JSON.stringify([W, H, rows.map(function (r) {
    var ref = r && r.img;
    return [(ref && (ref.id || ref.url)) || '', n(r && r.x, 0), n(r && r.y, 0),
      n(r && r.o, 100), truthy(r && r.v, true), (r && r.b) || ''];
  })]);
}

/** Resolve a row's `img` asset ref to a decoded image (null when it can't be). */
function layerImage(ref) {
  var url = ref && ref.url;
  var id = ref && ref.id;
  var urlP = url ? Promise.resolve(url)
    : id && host.assets && host.assets.get
      ? host.assets.get(id).then(function (res) { return res && res.url; })
      : Promise.resolve(null);
  return urlP.then(function (u) {
    if (!u) return null;
    if (!_layerImgCache[u]) {
      _layerImgCache[u] = loadImage(u).catch(function () { delete _layerImgCache[u]; return null; });
    }
    return _layerImgCache[u];
  });
}

/** Composite the visible rows at the document size. Rows whose image can't be
 *  resolved are skipped (the row stays a Lolly-side note, like the PSD export). */
function composeLayerStack(rows, W, H) {
  var key = layerStackKey(rows, W, H);
  if (_layerStackCache.key === key && _layerStackCache.canvas) return Promise.resolve(_layerStackCache.canvas);
  return Promise.all(rows.map(function (r) { return layerImage(r && r.img); })).then(function (imgs) {
    var canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    var drew = false;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      var img = imgs[i];
      if (!img || !truthy(r.v, true)) continue;
      ctx.globalAlpha = clamp(n(r.o, 100), 0, 100) / 100;
      ctx.globalCompositeOperation = r.b || 'source-over';
      try { ctx.drawImage(img, Math.round(n(r.x, 0)), Math.round(n(r.y, 0))); drew = true; }
      catch (e) { /* undecodable layer - skip */ }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    if (!drew) return null;
    canvas.__srcId = key;
    _layerStackCache = { key: key, canvas: canvas };
    return canvas;
  });
}

// Deterministic PRNG - drives grain and dust so a seed always reproduces.
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

// Image framing (plans/148): ONE placement shared with every other tool and with
// the DOM {{framing}} recipe, so the graded photo sits exactly where the sidebar
// and the on-canvas overlay say it does. Synced from community/_shared/framing.js.
// === lolly:shared frameRect - generated from community/_shared/framing.js; edit there and run npm run sync:shared ===
// Where an iw×ih image lands inside a W×H frame, as CSS would place it:
// object-fit + object-position + transform:scale about the pan point. Returns
// source/destination rects for one drawImage, plus the roll and its origin.
function frameRect(iw, ih, W, H, framing, fit) {
  var f = framing || {};
  var nz = Number(f.zoom); var zoom = isFinite(nz) ? Math.max(1, nz) : 100;
  var nx = Number(f.x); var px = (isFinite(nx) ? nx : 50) / 100;
  var ny = Number(f.y); var py = (isFinite(ny) ? ny : 50) / 100;
  var nr = Number(f.rotate); var rotate = isFinite(nr) ? nr : 0;
  if (!(iw > 0) || !(ih > 0) || !(W > 0) || !(H > 0)) {
    return { sx: 0, sy: 0, sw: Math.max(1, iw), sh: Math.max(1, ih),
      dx: 0, dy: 0, dw: W, dh: H, rotate: rotate, originX: W / 2, originY: H / 2 };
  }
  var base = fit === 'contain' ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih);
  var s = base * (zoom / 100);
  var dw = iw * s, dh = ih * s;
  return { sx: 0, sy: 0, sw: iw, sh: ih,
    dx: (W - dw) * px, dy: (H - dh) * py, dw: dw, dh: dh,
    rotate: rotate, originX: W * px, originY: H * py };
}
// === /lolly:shared frameRect ===

// === lolly:shared projectFraming - generated from community/_shared/framing.js; edit there and run npm run sync:shared ===
// The CSS perspective projection, expanded by hand: roll about Z, then yaw about
// Y, then pitch about X, then the perspective divide - all about the pan origin.
// 1200 is the same viewing distance the {{framing}} helper writes into
// `perspective(...)`, so the canvas and the DOM tilt identically.
var FRAMING_PERSPECTIVE = 1200;
function projectFraming(px, py, originX, originY, framing, persp) {
  var f = framing || {};
  var d = isFinite(Number(persp)) && Number(persp) > 0 ? Number(persp) : FRAMING_PERSPECTIVE;
  var roll = Number(f.rotate) || 0, pitch = Number(f.pitch) || 0, yaw = Number(f.yaw) || 0;
  var X = px - originX, Y = py - originY, Z = 0;
  var rad = Math.PI / 180, c, s, nx, ny, nz;
  if (roll) {
    c = Math.cos(roll * rad); s = Math.sin(roll * rad);
    nx = X * c - Y * s; ny = X * s + Y * c; X = nx; Y = ny;
  }
  if (yaw) {
    c = Math.cos(yaw * rad); s = Math.sin(yaw * rad);
    nx = X * c + Z * s; nz = -X * s + Z * c; X = nx; Z = nz;
  }
  if (pitch) {
    c = Math.cos(pitch * rad); s = Math.sin(pitch * rad);
    ny = Y * c - Z * s; nz = Y * s + Z * c; Y = ny; Z = nz;
  }
  var w = 1 - Z / d;
  var k = 1 / (w > 1e-3 ? w : 1e-3);
  return { x: originX + X * k, y: originY + Y * k };
}
// === /lolly:shared projectFraming ===

// === lolly:shared drawFramed - generated from community/_shared/framing.js; edit there and run npm run sync:shared ===
// Draw `source` into the current context's W×H frame with the given framing.
// Needs frameRect() and projectFraming() in scope.
//
// No tilt: one drawImage, with roll applied about the pan point (matching CSS
// transform-origin). Tilted: a mesh of small quads, each drawn with the affine
// map through three of its projected corners - canvas 2-D has no projective
// transform, so perspective emerges from the subdivision. Tiles are drawn with a
// half-pixel overlap because adjacent affine patches otherwise leave hairline
// seams where their edges disagree.
// Measured against the exact projection at a hard 12 degree pitch / 9 degree yaw
// on a 1080 frame: 8 tiles is 11.0px out at the worst corner, 16 is 2.9, 24 is
// 1.3. 24 is the live-preview compromise - a canvas tool redraws this per frame,
// and 576 draws is affordable where 1024 starts to cost. The shell's one-off bake
// (lib/framing-bake.ts) uses 32 for the extra half-pixel.
var FRAMING_TILES = 24;
function drawFramed(ctx, source, iw, ih, W, H, framing, fit) {
  var r = frameRect(iw, ih, W, H, framing, fit);
  var f = framing || {};
  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
  if (!Number(f.pitch) && !Number(f.yaw)) {
    if (r.rotate) {
      ctx.save();
      ctx.translate(r.originX, r.originY);
      ctx.rotate(r.rotate * Math.PI / 180);
      ctx.translate(-r.originX, -r.originY);
    }
    ctx.drawImage(source, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
    if (r.rotate) ctx.restore();
    return;
  }
  var n = FRAMING_TILES;
  var tw = r.sw / n, th = r.sh / n;       // source tile
  var dw = r.dw / n, dh = r.dh / n;       // destination tile, before projection
  var over = 0.5;
  for (var j = 0; j < n; j++) {
    for (var i = 0; i < n; i++) {
      var x0 = r.dx + i * dw, y0 = r.dy + j * dh;
      var p00 = projectFraming(x0, y0, r.originX, r.originY, f);
      var p10 = projectFraming(x0 + dw, y0, r.originX, r.originY, f);
      var p01 = projectFraming(x0, y0 + dh, r.originX, r.originY, f);
      // The affine that carries the tile's own unit square onto its projected
      // corners: columns are the two edge vectors, translation is the corner.
      var a = (p10.x - p00.x) / dw, b = (p10.y - p00.y) / dw;
      var c = (p01.x - p00.x) / dh, d = (p01.y - p00.y) / dh;
      if (!isFinite(a) || !isFinite(b) || !isFinite(c) || !isFinite(d)) continue;
      ctx.save();
      // transform(), not setTransform(): the caller may already have a transform
      // on the context (a translate into a panel, a device-pixel scale), and
      // replacing it would move every tile out of that space.
      ctx.transform(a, b, c, d, p00.x, p00.y);
      // In tile space the destination is the un-projected tile at the origin.
      ctx.drawImage(source,
        r.sx + i * tw, r.sy + j * th, tw, th,
        0, 0, dw + over, dh + over);
      ctx.restore();
    }
  }
}
// === /lolly:shared drawFramed ===

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
// tools do - tools never import from the engine).
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

// ── HSL colour mixer (Lightroom-style per-hue-band Hue/Saturation/Luminance) ──
// Eight named bands like the classic HSL panel. The weighting below is a smooth
// partition of unity, so ANY centre set works - these uneven perceptual centres
// or an evenly-spaced set (the door left open for a future "number of stops"
// control). The order here is the manifest's band order and the swatch order the
// injected sidebar CSS paints (template.html).
var HSL_BAND_NAMES = ['Red', 'Orange', 'Yellow', 'Green', 'Aqua', 'Blue', 'Purple', 'Magenta'];
var HSL_BAND_HUES = [0, 30, 60, 120, 180, 225, 280, 320]; // degrees on the hue wheel

function rgbToHsl(r, g, b) {
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  var L = (mx + mn) / 2, H = 0, S = 0;
  if (d > 1e-9) {
    S = L > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) H = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) H = (b - r) / d + 2;
    else H = (r - g) / d + 4;
    H *= 60;
  }
  return [H, S, L];
}
function hslHue2rgb(p, q, t) {
  t = t - Math.floor(t);
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
function hslToRgb(H, S, L) {
  H = ((H % 360) + 360) % 360;
  if (S <= 1e-9) return [L, L, L];
  var q = L < 0.5 ? L * (1 + S) : L + S - L * S, p = 2 * L - q, h = H / 360;
  return [hslHue2rgb(p, q, h + 1 / 3), hslHue2rgb(p, q, h), hslHue2rgb(p, q, h - 1 / 3)];
}

// Partition-of-unity band weights for a hue: the two centres bracketing the hue
// share weight 1 via a raised-cosine ease (C¹-smooth, no banding at boundaries),
// everything else 0. Handles wrap-around and any centre set.
function hslBandWeights(H, centres) {
  var N = centres.length, w = new Array(N);
  for (var k = 0; k < N; k++) w[k] = 0;
  for (var i = 0; i < N; i++) {
    var a = centres[i], b = (i + 1 < N) ? centres[i + 1] : centres[0] + 360;
    var hh = H;
    if (hh < a) hh += 360;                       // wrap into the final [last, first+360] segment
    if (hh >= a && hh <= b) {
      var t = (b > a) ? (hh - a) / (b - a) : 0;
      var e = 0.5 - 0.5 * Math.cos(Math.PI * t); // 0→1 across the segment
      w[i] += 1 - e;
      w[(i + 1) % N] += e;
      return w;
    }
  }
  return w; // segments cover the whole ring - unreached in practice
}

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
  'bleach': { // bleach bypass: silver retained - desaturated, harsh
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
  if (size > CUBE_MAX_N) throw new Error('LUT grid too large (max ' + CUBE_MAX_N + ')');
  var expect = kind === '3d' ? size * size * size * 3 : size * 3;
  if (data.length < expect) throw new Error('LUT is truncated (' + (data.length / 3) + ' of ' + (expect / 3) + ' rows)');
  return {
    kind: kind, size: size, data: new Float32Array(data.slice(0, expect)),
    domainMin: domainMin, domainMax: domainMax, title: title,
  };
}

// Autodesk .3dl: a mesh line of grid input levels, then size³ integer triples,
// BLUE-fastest (red slowest - the opposite of .cube), on a 0..(2^depth − 1)
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
  if (size > TDL_MAX_N) throw new Error('LUT grid too large (max ' + TDL_MAX_N + ' for .3dl)');
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

// ── preset LUTs (shipped, open/CC0) ──────────────────────────────────────────

function fetchText(url) {
  // Portable read (v1.183): the same call answers in a page, a Worker and a headless shell.
  if (host.assets && host.assets.bytes) return host.assets.bytes(url).then(function (b) { return new TextDecoder().decode(b); });
  if (typeof fetch !== 'function') return Promise.reject(new Error('no fetch in this shell'));
  return fetch(url).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  });
}

// Load + parse a shipped preset .cube by id (whitelisted). Cached across renders;
// one in-flight fetch is shared. A browser/Tauri affordance - a shell without
// fetch (headless CLI) rejects and the preset simply isn't applied, exactly like
// the upload path needs a File. Returns a Promise<{ lut, error }>.
function loadPresetLut(id) {
  if (!PRESET_LUTS[id]) return Promise.resolve({ lut: null, error: 'unknown preset' });
  var cid = 'preset:' + id;
  if (_presetLutCache.id === cid) return Promise.resolve({ lut: _presetLutCache.lut, error: _presetLutCache.error });
  if (_presetInflight.id === cid && _presetInflight.promise) return _presetInflight.promise;
  var promise = fetchText(PRESET_LUT_BASE + id + '.cube').then(function (text) {
    var lut = parseCube(text);
    _presetLutCache = { id: cid, lut: lut, error: null };
    _presetInflight = { id: null, promise: null };
    return { lut: lut, error: null };
  }).catch(function (e) {
    var msg = String((e && e.message) || e);
    _presetLutCache = { id: cid, lut: null, error: msg };
    _presetInflight = { id: null, promise: null };
    return { lut: null, error: msg };
  });
  _presetInflight = { id: cid, promise: promise };
  return promise;
}

// Deliver the raw shipped preset .cube to the user via the transform path
// (host.export.file - never watermarked; the bytes are a public-domain LUT).
function deliverPresetDownload(id) {
  if (_presetDlBusy || !PRESET_LUTS[id]) return Promise.resolve();
  _presetDlBusy = true;
  return fetchText(PRESET_LUT_BASE + id + '.cube').then(function (text) {
    var name = 'darkroom-' + id + '.cube';
    var blob = typeof Blob !== 'undefined' ? new Blob([text], { type: 'text/plain' }) : text;
    if (host.export && host.export.file) return host.export.file(blob, { filename: name });
    if (host.export && host.export.download) return host.export.download(blob, name);
    return null;
  }).catch(function (e) {
    if (host.log) host.log('warn', 'darkroom: preset LUT download needs a shell with export.file (web or desktop) - ' + String(e));
  }).then(function () { _presetDlBusy = false; });
}

// Sample a parsed LUT at r,g,b (0..1). 3D uses tetrahedral interpolation -
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
// Read the 24 HSL-mixer sliders (8 bands × Hue/Sat/Lum) into normalised bands:
// hue as a ±40° rotation, saturation/luminance as ±1 amounts. `active` is false
// when every slider is centred, so the whole stage (and its LUT rebuild) is skipped.
function hslBandsFrom(inputs) {
  var bands = [], active = false;
  for (var i = 0; i < HSL_BAND_NAMES.length; i++) {
    var nm = HSL_BAND_NAMES[i];
    var hv = clamp(n(inputs['hslHue' + nm], 0), -100, 100);
    var sv = clamp(n(inputs['hslSat' + nm], 0), -100, 100);
    var lv = clamp(n(inputs['hslLum' + nm], 0), -100, 100);
    if (hv || sv || lv) active = true;
    bands.push({ h: hv * 0.4, s: sv / 100, l: lv / 100 });
  }
  return { bands: bands, active: active };
}

function paramsFrom(inputs) {
  var fr = inputs.imageFraming || {};
  var lutFileId = null;
  var lf = inputs.lutFile;
  if (lf && lf.bytes && lf.bytes.length) lutFileId = (lf.name || 'lut') + ':' + lf.size + ':' + fnvBytes(lf.bytes);
  var lutSource = ['none', 'preset', 'custom'].indexOf(inputs.lutSource) !== -1 ? inputs.lutSource : 'none';
  var lutPreset = PRESET_LUTS[inputs.lutPreset] ? inputs.lutPreset : 'slide-standard';
  // One id for the active LUT - drives the pipeline-LUT cache + colour key,
  // whichever source it comes from. null when no LUT is active.
  var lutId = lutSource === 'custom' ? lutFileId
    : lutSource === 'preset' ? 'preset:' + lutPreset
      : null;
  return {
    // colour stages (baked into the pipeline LUT - also the .cube bake)
    temperature: clamp(n(inputs.temperature, 0), -100, 100) / 100,
    tint: clamp(n(inputs.tint, 0), -100, 100) / 100,
    exposure: clamp(n(inputs.exposure, 0), -3, 3),
    contrast: clamp(n(inputs.contrast, 0), -100, 100) / 100,
    highlights: clamp(n(inputs.highlights, 0), -100, 100) / 100,
    shadows: clamp(n(inputs.shadows, 0), -100, 100) / 100,
    saturation: clamp(n(inputs.saturation, 100), 0, 200) / 100,
    vibrance: clamp(n(inputs.vibrance, 0), -100, 100) / 100,
    hsl: hslBandsFrom(inputs),
    preset: PRESETS[inputs.filmLook] ? inputs.filmLook : 'none',
    presetStrength: clamp(n(inputs.presetStrength, 100), 0, 100) / 100,
    lutSource: lutSource,
    lutPreset: lutPreset,
    lutFileId: lutFileId,
    lutId: lutId,
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
    // The whole framing compound, straight through to the shared frameRect - the
    // engine already clamped each field to the manifest's declared range, so a
    // second clamp here could only DISAGREE with the slider (it used to: 100-800
    // against a slider that stopped at 400).
    framing: {
      zoom: n(fr.zoom, 100), x: n(fr.x, 50), y: n(fr.y, 50),
      rotate: n(fr.rotate, 0), pitch: n(fr.pitch, 0), yaw: n(fr.yaw, 0),
    },
    fit: inputs.imageFit === 'contain' ? 'contain' : 'cover',
    W: clamp(Math.round(n(inputs.width, 1080)), 1, MAX_EDGE),
    H: clamp(Math.round(n(inputs.height, 1080)), 1, MAX_EDGE),
    bakeSize: inputs.bakeSize === '17' ? 17 : inputs.bakeSize === '65' ? 65 : 33,
  };
}

// The key of everything the COLOUR pipeline depends on (drives the LUT cache).
function colorKey(P, stops) {
  return JSON.stringify([
    P.temperature, P.tint, P.exposure, P.contrast, P.highlights, P.shadows,
    P.saturation, P.vibrance, P.hsl.active ? P.hsl.bands : 0,
    P.preset, P.presetStrength, P.lutId,
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
  // HSL colour mixer bands (see hslBandsFrom).
  var hslBands = P.hsl.bands, hslActive = P.hsl.active;

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

    // 3.5 HSL colour mixer - per-hue-band hue rotation, saturation and luminance.
    // Weighted across the bands the pixel's hue straddles and gated by its own
    // saturation, so near-greys (no meaningful hue) are left untouched.
    if (hslActive) {
      var hsl = rgbToHsl(r, g, b);
      var Hh = hsl[0], Ss = hsl[1], Ll = hsl[2];
      var gate = smoothstep(0.04, 0.16, Ss);
      if (gate > 0) {
        var wts = hslBandWeights(Hh, HSL_BAND_HUES);
        var dH = 0, mS = 0, dL = 0;
        for (var bi = 0; bi < wts.length; bi++) {
          var wv = wts[bi]; if (!wv) continue;
          var bnd = hslBands[bi];
          dH += wv * bnd.h; mS += wv * bnd.s; dL += wv * bnd.l;
        }
        if (dH !== 0 || mS !== 0 || dL !== 0) {
          Hh += dH * gate;
          Ss = clamp(Ss * (1 + mS * gate), 0, 1);
          if (dL !== 0) { var dd = dL * gate; Ll = clamp(dd >= 0 ? Ll + dd * (1 - Ll) : Ll + dd * Ll, 0, 1); }
          var mrgb = hslToRgb(Hh, Ss, Ll);
          r = mrgb[0]; g = mrgb[1]; b = mrgb[2];
        }
      }
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
    || P.hsl.active
    || (P.preset !== 'none' && P.presetStrength > 0)
    || (!!userLut && P.lutIntensity > 0)
    || (P.treatment !== 'none' && P.treatmentAmount > 0);
}

// Apply the baked pipeline LUT to an ImageData in place (tetrahedral, inlined
// flat math - this is the per-pixel hot loop).
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

// Serialise an ALREADY-BUILT pipeline LUT as Adobe/IRIDAS .cube text.
// Split out of bakeCubeText because the `videoLook` extra publishes the render's
// own cached 33³ lattice rather than baking a second one - the two must agree
// down to the last digit, so they share this writer instead of each formatting
// rows their own way.
function cubeTextFromLut(lut, P) {
  var lines = [
    '# Baked by Lolly Bitmap Studio',
    '# Colour pipeline: develop + film look (' + P.preset + ') + LUT + brand treatment (' + P.treatment + ')',
    'TITLE "Lolly Bitmap Studio look"',
    'LUT_3D_SIZE ' + lut.size,
    'DOMAIN_MIN 0.0 0.0 0.0',
    'DOMAIN_MAX 1.0 1.0 1.0',
  ];
  var d = lut.data;
  for (var i = 0; i < d.length; i += 3) {
    lines.push(f6(d[i]) + ' ' + f6(d[i + 1]) + ' ' + f6(d[i + 2]));
  }
  return lines.join('\n') + '\n';
}

// Bake the current colour pipeline at grid N and serialise it as a .cube.
function bakeCubeText(P, stops, userLut, N) {
  return cubeTextFromLut(buildPipelineLut(P, stops, userLut, N), P);
}

// Deliver the baked .cube via the transform path (host.export.file - never
// watermarked, no provenance; the bytes are the user's own look). The bake is
// pure maths, but delivery needs a shell that implements export.file (web,
// Tauri); the CLI's stub rejects, which lands in the catch below as a warning.
function deliverBake(P, stops, userLut) {
  if (_bakeBusy) return Promise.resolve();
  _bakeBusy = true;
  var text;
  try { text = bakeCubeText(P, stops, userLut, P.bakeSize); }
  catch (e) { _bakeBusy = false; if (host.log) host.log('warn', 'darkroom: LUT bake failed', { error: String(e) }); return Promise.resolve(); }
  var name = 'darkroom-look-' + P.bakeSize + '.cube';
  var deliver;
  try {
    var blob = typeof Blob !== 'undefined' ? new Blob([text], { type: 'text/plain' }) : text;
    if (host.export && host.export.file) deliver = host.export.file(blob, { filename: name });
    else if (host.export && host.export.download) deliver = host.export.download(blob, name);
    else deliver = Promise.resolve();
  } catch (e) { deliver = Promise.resolve(); }
  return Promise.resolve(deliver).catch(function (e) {
    if (host.log) host.log('warn', 'darkroom: LUT download needs a shell with export.file (web or desktop) - ' + String(e));
  }).then(function () { _bakeBusy = false; });
}

// ── demo scene ───────────────────────────────────────────────────────────────

// A deterministic, asset-free landscape drawn once at 1600² - full tonal range
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

// Sharpen (unsharp mask), grain, dust and vignette - one combined ImageData
// pass where possible, canvas composites where cheaper.
function applyTexture(out, P) {
  var W = out.width, H = out.height;
  var ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  // Chromatic aberration first (a lens artefact - everything else sits on top).
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
      } catch (e) { /* tainted - skip */ }
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
      } catch (e) { /* tainted - skip */ }
    }
  }

  // Grain + vignette in one ImageData pass (shared with the float export path).
  if (P.grain > 0 || P.vignette > 0) {
    try {
      var gi = ctx.getImageData(0, 0, W, H);
      grainVignettePass(gi.data, W, H, P);
      ctx.putImageData(gi, 0, 0);
    } catch (e) { /* tainted - skip */ }
  }

  // Dust & scratches (shared with the float export path).
  if (P.dust > 0) drawDust(ctx, W, H, P);
}

// Grain + vignette over an RGBA buffer, in place. Grain is value noise on a
// lattice of grainSize-px cells, bilinearly sampled and luminance-weighted so it
// peaks in the midtones and fades out of the blacks and highlights the way real
// stock does; the vignette is a smoothstep on squared radius from the centre, so
// it stays a soft falloff rather than a visible ring.
//
// Both texture paths call this: the still over ImageData.data, whose clamped
// writes hold the result to 0..255, and the deep export over its Float32 buffer,
// where the same arithmetic is left unclamped until the encode boundary. One
// function rather than two transcriptions, because a noise field written twice
// drifts into two different textures for the same seed and nothing in the
// picture says which one is right.
//
// Named, rather than inlined where it is used, for the same reason once removed:
// engine/src/grade.ts carries a port of this pass so a shell can grade a video
// with it (tools cannot import the engine), and tests/grade-drift.test.ts lifts
// THIS function out of the hook source and compares it against that port byte
// for byte. An inline block has no name to lift, so the guard would have nothing
// to pin.
function grainVignettePass(gd, W, H, P) {
  if (!(P.grain > 0 || P.vignette > 0)) return;
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
}

// Seeded specks, fibres, and vertical hairline scratches drawn as vector strokes
// (soft-light-ish alpha). Factored out so the still preview (over the composed
// canvas) and the deep export (over a transparent layer, composited into the
// float buffer) draw the SAME dust for a given seed.
function drawDust(ctx, W, H, P) {
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

// ── float compose (deep export) ──────────────────────────────────────────────
// The export twin of renderFrame + applyTexture, kept in a Float32 buffer the
// whole way so a 16-bit / EXR / Radiance master carries REAL precision instead of
// the 8-bit canvas the interactive preview is capped to. Values stay in the same
// sRGB-ENCODED 0..255 domain the canvas texture math uses (so the constants are
// identical and the look matches), and are converted to linear light only at the
// DeepFrame boundary. Deterministic PER SHELL: it renders at the full export W×H,
// the noise is seeded, and the blur is the JS separable box (NEVER ctx.filter,
// whose gaussian is platform-dependent) - so the same params + seed always yield
// the same master on a given device. It is NOT byte-identical across shells: the
// source draw (drawFramed's ctx.drawImage resampling) and the dust layer (drawDust
// rasterised on a canvas, then read back) still go through the platform canvas,
// whose resampling/antialiasing differ - inherent, since this tool's pixels ARE a
// canvas artefact. So the canonical output is "a pure function of the params on
// this device". The preview may differ further (accepted, per-device best effort);
// the export is the canonical result.

// Float tetrahedral apply of a pipeline LUT to an sRGB-0..255 Float32 RGBA buffer.
function applyPipelineLutFloat(buf, lut) {
  var tab = lut.data, N = lut.size, N1 = N - 1;
  for (var i = 0; i < buf.length; i += 4) {
    var x = (buf[i] / 255) * N1, y = (buf[i + 1] / 255) * N1, z = (buf[i + 2] / 255) * N1;
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
    buf[i]     = 255 * (w0 * tab[i000]     + w1 * tab[ia]     + w2 * tab[ib]     + w3 * tab[i111]);
    buf[i + 1] = 255 * (w0 * tab[i000 + 1] + w1 * tab[ia + 1] + w2 * tab[ib + 1] + w3 * tab[i111 + 1]);
    buf[i + 2] = 255 * (w0 * tab[i000 + 2] + w1 * tab[ia + 2] + w2 * tab[ib + 2] + w3 * tab[i111 + 2]);
  }
}

// Separable box blur (two passes ≈ gaussian) over the RGB of a Float32 RGBA
// buffer. Deterministic replacement for ctx.filter='blur()'. radius in px.
function boxBlurFloat(src, W, H, radius) {
  var r = Math.max(1, Math.round(radius));
  var tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  var inv = 1 / (2 * r + 1);
  // Horizontal
  for (var y = 0; y < H; y++) {
    for (var c = 0; c < 3; c++) {
      var row = y * W * 4 + c, sum = 0, k;
      for (k = -r; k <= r; k++) sum += src[row + 4 * clamp(k, 0, W - 1)];
      for (var x = 0; x < W; x++) {
        tmp[row + 4 * x] = sum * inv;
        var add = row + 4 * clamp(x + r + 1, 0, W - 1);
        var sub = row + 4 * clamp(x - r, 0, W - 1);
        sum += src[add] - src[sub];
      }
    }
  }
  // Vertical
  for (var x2 = 0; x2 < W; x2++) {
    for (var c2 = 0; c2 < 3; c2++) {
      var col = x2 * 4 + c2, sum2 = 0, k2;
      for (k2 = -r; k2 <= r; k2++) sum2 += tmp[col + W * 4 * clamp(k2, 0, H - 1)];
      for (var y2 = 0; y2 < H; y2++) {
        out[col + W * 4 * y2] = sum2 * inv;
        var add2 = col + W * 4 * clamp(y2 + r + 1, 0, H - 1);
        var sub2 = col + W * 4 * clamp(y2 - r, 0, H - 1);
        sum2 += tmp[add2] - tmp[sub2];
      }
    }
  }
  return out;
}

// Render the full colour + texture pipeline into a Float32 RGBA buffer (sRGB
// 0..255) at W×H. Mirrors renderFrame+applyTexture but never round-trips through
// an 8-bit canvas after the source draw. Returns Float32Array(W*H*4) or null.
function composeFloat(source, iw, ih, W, H, P, stops, userLut) {
  if (!canRaster()) return null;
  var framed = document.createElement('canvas'); framed.width = W; framed.height = H;
  var fctx = framed.getContext('2d', { willReadFrequently: true });
  if (!fctx) return null;
  drawFramed(fctx, source, iw, ih, W, H, P.framing, P.fit);
  var img;
  try { img = fctx.getImageData(0, 0, W, H); } catch (e) { return null; }
  var buf = new Float32Array(W * H * 4);
  for (var i = 0; i < buf.length; i++) buf[i] = img.data[i];

  // Colour: a fine 65³ pipeline LUT (near-exact; negligible interp error) applied
  // in float - this is where the deep bits are actually earned.
  if (colorActive(P, userLut)) {
    var lut = buildPipelineLut(P, stops, userLut, 65);
    applyPipelineLutFloat(buf, lut);
  }
  // Texture, in float, same maths/constants as applyTexture.
  composeTextureFloat(buf, W, H, P);
  return buf;
}

// Float port of the spatial texture pass (fringe → sharpen → bloom/halation →
// grain/vignette → dust). Dust rides a canvas layer composited back (sparse
// specks - 8-bit is imperceptible there and reuses the exact vector code).
function composeTextureFloat(buf, W, H, P) {
  // Chromatic aberration
  if (P.fringe > 0) {
    var src = new Float32Array(buf); var cx = W / 2, cy = H / 2, maxShift = P.fringe * 0.012;
    var diag = Math.sqrt(cx * cx + cy * cy);
    function samp(x, y, ch) {
      x = clamp(x, 0, W - 1.001); y = clamp(y, 0, H - 1.001);
      var x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
      var x1 = Math.min(x0 + 1, W - 1), y1 = Math.min(y0 + 1, H - 1);
      var a = src[(y0 * W + x0) * 4 + ch], b = src[(y0 * W + x1) * 4 + ch];
      var c = src[(y1 * W + x0) * 4 + ch], e = src[(y1 * W + x1) * 4 + ch];
      return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy;
    }
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var dx = x - cx, dy = y - cy, rr = Math.sqrt(dx * dx + dy * dy) / diag, k = maxShift * rr * rr;
      if (k < 1e-5) continue;
      var o = (y * W + x) * 4;
      buf[o] = samp(x - dx * k, y - dy * k, 0);
      buf[o + 2] = samp(x + dx * k, y + dy * k, 2);
    }
  }
  // Sharpen (unsharp mask)
  if (P.sharpen > 0) {
    var bl = boxBlurFloat(buf, W, H, Math.max(1, Math.round(Math.min(W, H) / 600)) * 1.2);
    var ks = P.sharpen * 1.1;
    for (var s = 0; s < buf.length; s += 4) {
      buf[s] += (buf[s] - bl[s]) * ks; buf[s + 1] += (buf[s + 1] - bl[s + 1]) * ks; buf[s + 2] += (buf[s + 2] - bl[s + 2]) * ks;
    }
  }
  // Bloom + halation: bright-pass → blur → additive (bloom) / red-orange tint (halation)
  if (P.bloom > 0 || P.halation > 0) {
    var bp = new Float32Array(buf.length);
    for (var j = 0; j < buf.length; j += 4) {
      var lum = (LUM_R * buf[j] + LUM_G * buf[j + 1] + LUM_B * buf[j + 2]) / 255;
      var wgt = smoothstep(0.68, 0.95, lum);
      bp[j] = buf[j] * wgt; bp[j + 1] = buf[j + 1] * wgt; bp[j + 2] = buf[j + 2] * wgt; bp[j + 3] = 255;
    }
    var soft = boxBlurFloat(bp, W, H, Math.max(2, Math.round(Math.min(W, H) * 0.02)));
    var hr = 0xff / 255, hg = 0x5a / 255, hb = 0x28 / 255; // #ff5a28 halation tint
    for (var m = 0; m < buf.length; m += 4) {
      if (P.bloom > 0) {
        var ba = P.bloom * 0.55;
        buf[m] += soft[m] * ba; buf[m + 1] += soft[m + 1] * ba; buf[m + 2] += soft[m + 2] * ba;
      }
      if (P.halation > 0) {
        var ha = P.halation * 0.6;
        buf[m] += soft[m] * hr * ha; buf[m + 1] += soft[m + 1] * hg * ha; buf[m + 2] += soft[m + 2] * hb * ha;
      }
    }
  }
  // Grain + vignette: the canvas still's own pass, over the float buffer. It was
  // a second copy of the lattice maths until the drift guard needed a name to
  // lift; the Float32 buffer changes nothing but where the writes are clamped.
  grainVignettePass(buf, W, H, P);
  // Dust: draw on a transparent canvas with the exact vector code, composite back.
  if (P.dust > 0) {
    var dc = document.createElement('canvas'); dc.width = W; dc.height = H;
    var dctx = dc.getContext('2d', { willReadFrequently: true });
    if (dctx) {
      drawDust(dctx, W, H, P);
      var di;
      try { di = dctx.getImageData(0, 0, W, H).data; } catch (e) { di = null; }
      if (di) for (var p = 0; p < buf.length; p += 4) {
        var da = di[p + 3] / 255;
        if (da > 0) { buf[p] = buf[p] * (1 - da) + di[p] * da; buf[p + 1] = buf[p + 1] * (1 - da) + di[p + 1] * da; buf[p + 2] = buf[p + 2] * (1 - da) + di[p + 2] * da; }
      }
    }
  }
  // Clamp to the sRGB byte range the source domain implies (encode boundary
  // clamps again, but keeping the buffer sane avoids NaNs feeding srgbToLinear).
  for (var q = 0; q < buf.length; q += 4) {
    buf[q] = clamp(buf[q], 0, 255); buf[q + 1] = clamp(buf[q + 1], 0, 255); buf[q + 2] = clamp(buf[q + 2], 0, 255); buf[q + 3] = 255;
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

// Resolve the active LUT for the current source: preset (async fetch+parse of a
// shipped .cube), custom upload (sync), or none. Returns Promise<{ lut, error }>.
function resolveLut(inputs, P) {
  if (P.lutSource === 'custom') return Promise.resolve(currentUserLut(inputs, P));
  if (P.lutSource === 'preset') return loadPresetLut(P.lutPreset);
  return Promise.resolve({ lut: null, error: null });
}

// Sync accessor for the per-frame live path: the cached LUT without awaiting. A
// preset not yet cached warms in the background and applies once loaded (the
// still render before "Go live" has normally already cached it).
function resolvedLutSync(inputs, P) {
  if (P.lutSource === 'custom') return currentUserLut(inputs, P);
  if (P.lutSource === 'preset') {
    if (_presetLutCache.id === 'preset:' + P.lutPreset) return { lut: _presetLutCache.lut, error: _presetLutCache.error };
    loadPresetLut(P.lutPreset); // warm, don't await
    return { lut: null, error: null };
  }
  return { lut: null, error: null };
}

// The full render: framed source → colour LUT → texture. Returns a canvas.
function renderFrame(source, iw, ih, dims, P, stops, userLut) {
  var key = null;
  var framed;
  if (source.__frameKey) { // live frames pass a canvas straight through
    framed = source;
  } else {
    key = JSON.stringify([source.__srcId, dims.w, dims.h, P.framing, P.fit]);
    if (_framedCache.key === key && _framedCache.canvas) framed = _framedCache.canvas;
    else {
      framed = document.createElement('canvas'); framed.width = dims.w; framed.height = dims.h;
      var fctx = framed.getContext('2d', { willReadFrequently: true });
      if (!fctx) return null;
      drawFramed(fctx, source, iw, ih, dims.w, dims.h, P.framing, P.fit);
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
    } catch (e) { /* tainted canvas - leave uncoloured rather than blank */ }
  }
  if (textureActive(P)) applyTexture(out, P);

  // Hand the untouched framed source back on the canvas. The before/after split
  // is NOT baked into the bitmap any more: the still/live paths emit `framed` as
  // a separate "before" layer that the template composites in the SVG behind a
  // drag/rotate-able divider (a screen-only overlay - see template.html). That
  // keeps `out` the full graded result (so the histogram and every non-split
  // export read the true grade) while the divider still rasterises "as shown".
  try { out.__bsFramed = framed; } catch (e) { /* frozen canvas - split just skips */ }
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

  var lutRes = await resolveLut(inputs, P);
  var lutNote = lutRes.error ? 'LUT not readable: ' + lutRes.error : null;
  var lutLabel = lutRes.lut
    ? ((lutRes.lut.title || (inputs.lutFile && inputs.lutFile.name) || 'LUT')
      + ' · ' + (lutRes.lut.kind === '1d' ? lutRes.lut.size + '-step 1D' : lutRes.lut.size + '³'))
    : null;

  // The .cube bake is pure maths - it works even headless, and must run
  // before the raster guard so the CLI can bake with --bakeLut=true.
  if (inputs.bakeLut) {
    await deliverBake(P, stops, lutRes.lut);
    // Fall through to the normal render; the patch below resets the switch.
  }
  // Hand over the raw shipped preset .cube on request (separate from the bake).
  if (inputs.downloadPresetLut && P.lutSource === 'preset') {
    await deliverPresetDownload(P.lutPreset);
  }

  // The `videoLook` extra: the render's own colour pipeline, published rather
  // than downloaded. A shell reads it to apply THIS grade to something the tool
  // itself never touches - the catalog's "Apply to video" runs the cube over a
  // clip frame by frame - so the look travels as data instead of being
  // re-derived from the inputs by a second implementation that would drift. It
  // sits here, before the raster guard, for the bake's reason exactly: the maths
  // is canvas-free, so the CLI and any headless shell publish the look too.
  //
  // It is the PREVIEW's lattice, taken from getPipelineLut - the same 33³ table
  // the still is about to be graded through, cached under the same colour key -
  // so what a shell replays over a clip is byte-for-byte what the user approved
  // on the canvas, and the marginal cost of publishing is the serialisation, not
  // a second bake. bakeSize is deliberately NOT part of this: that control is the
  // DOWNLOAD grid, for whatever an NLE wants to be handed, and paying 150 ms and
  // a 7 MB string on every slider tick to publish a 65³ video look nobody asked
  // for is a preview-latency bill for a download preference.
  //
  // Guarded on the colour identity because serialising 107,811 formatted rows is
  // still work, and most input traffic (grain, vignette, framing, the histogram
  // toggle) does not change the look at all. When the key is unchanged the local
  // stays `undefined`, which the engine's mergePatch skips outright, so the extra
  // already published stands untouched rather than being recomputed or cleared.
  // Every return below this point carries the local out, so a look change
  // followed by a failed image load cannot strand the extra at the old look (the
  // key has already advanced - the retry would otherwise skip the bake).
  //
  // `on` says whether the pipeline actually does anything. A neutral darkroom
  // still bakes a perfectly good identity cube, and a shell cannot tell that
  // apart from a real grade by looking at the text - it would re-encode a clip
  // through a table that changes nothing and stamp a colour-grade credential on
  // the result. So the answer travels with the look.
  var videoLook;
  var vlKey = colorKey(P, stops);
  if (vlKey !== _videoLookKey) {
    try {
      videoLook = JSON.stringify({
        v: 1,
        on: colorActive(P, lutRes.lut) ? 1 : 0,
        cube: cubeTextFromLut(getPipelineLut(P, lutRes.lut), P),
        key: vlKey,
      });
      _videoLookKey = vlKey;
    } catch (e) {
      if (host.log) host.log('warn', 'darkroom: video look bake failed', { error: String(e) });
    }
  }

  if (!canRaster()) {
    return { outSrc: null, note: 'Preview renders in the browser', bakeLut: false, downloadPresetLut: false, lutNote: lutNote, lutLabel: lutLabel, histSvg: '', videoLook: videoLook };
  }

  // Resolve the source: a non-empty layer stack composites into the document
  // (the Layers fold), else the user's pick, else the first default subject the
  // catalog can supply (the lorikeet photo, then the animated Lolly swirl - SVG →
  // bitmap on decode), else the procedural demo scene.
  var rows = layerRows(inputs);
  var ref = inputs.image;
  var url = ref && typeof ref === 'object' ? ref.url : null;
  if (!url && !rows.length) {
    if (_defaultUrl === null) {
      _defaultUrl = '';
      for (var di = 0; di < DEFAULT_IMAGE_IDS.length && !_defaultUrl; di++) {
        try { var def = await host.assets.get(DEFAULT_IMAGE_IDS[di]); _defaultUrl = (def && def.url) || ''; }
        catch (e) { _defaultUrl = ''; }
      }
    }
    if (_defaultUrl) url = _defaultUrl;
  }

  var dims = workDims(P.W, P.H, STILL_MAX);
  var stackKey = rows.length ? layerStackKey(rows, P.W, P.H) : null;
  var memoKey = JSON.stringify({ url: url, stack: stackKey, P: P, d: dims, stops: stops });
  if (memoKey === _memoKey) {
    // Still reset the transient action switches on a repeated render.
    var patch = {};
    if (inputs.bakeLut) patch.bakeLut = false;
    if (inputs.downloadPresetLut) patch.downloadPresetLut = false;
    return Object.keys(patch).length ? Object.assign({}, _memoResult, patch) : _memoResult;
  }

  var source, iw, ih;
  try {
    if (rows.length) {
      source = await composeLayerStack(rows, P.W, P.H);
      if (!source) return { outSrc: null, note: 'None of the layers could be read as images', bakeLut: false, downloadPresetLut: false, lutNote: lutNote, lutLabel: lutLabel, histSvg: '', videoLook: videoLook };
      iw = source.width; ih = source.height;
    } else if (url) {
      var img = await getImage(url);
      iw = img.naturalWidth || img.width; ih = img.naturalHeight || img.height;
      if (!iw || !ih) return { outSrc: null, note: 'Could not read this image', bakeLut: false, downloadPresetLut: false, lutNote: lutNote, lutLabel: lutLabel, histSvg: '', videoLook: videoLook };
      source = img; source.__srcId = url;
    } else {
      source = makeDemoScene();
      if (!source) return { outSrc: null, note: 'Preview renders in the browser', bakeLut: false, downloadPresetLut: false, lutNote: lutNote, lutLabel: lutLabel, histSvg: '', videoLook: videoLook };
      iw = source.width; ih = source.height; source.__srcId = 'demo';
    }
  } catch (e) {
    if (host.log) host.log('warn', 'darkroom: image load failed', { error: String(e) });
    return { outSrc: null, note: 'Could not read this image', bakeLut: false, downloadPresetLut: false, lutNote: lutNote, lutLabel: lutLabel, histSvg: '', videoLook: videoLook };
  }

  var out = renderFrame(source, iw, ih, dims, P, stops, lutRes.lut);
  if (!out) return { outSrc: null, note: 'Preview renders in the browser', bakeLut: false, downloadPresetLut: false, lutNote: lutNote, lutLabel: lutLabel, histSvg: '', videoLook: videoLook };

  var outSrc;
  // Lossless PNG, not JPEG: the preview is the export SOURCE on the ordinary
  // 8-bit raster path, so a lossy intermediate would bake chroma artefacts into
  // every PNG/WebP. (Deep formats bypass this via exportStill + composeFloat.)
  try { outSrc = out.toDataURL('image/png'); }
  catch (e) {
    if (host.log) host.log('warn', 'darkroom: canvas read failed (tainted image?)', { error: String(e) });
    return { outSrc: null, note: 'Could not read this image', bakeLut: false, downloadPresetLut: false, lutNote: lutNote, lutLabel: lutLabel, histSvg: '', videoLook: videoLook };
  }

  // Stash everything the deep export needs to re-render at full resolution in
  // float - exportStill's ctx carries no input model, so the last still render
  // hands its resolved params/source forward (mirrors _memoResult's lifetime).
  _deepState = { P: P, source: source, iw: iw, ih: ih, stops: stops, userLut: lutRes.lut };

  var histSvg = P.histogram ? buildHistogramSvg(out) : '';

  // "Before" layer for the split overlay - the framed source encoded losslessly,
  // cached against the frame key so colour/texture drags don't re-encode it (only
  // a source/framing/size change does). Only produced while the split is on.
  var beforeSrc = null;
  if (P.splitPreview && out.__bsFramed) {
    var fkey = _framedCache.key;
    if (fkey && _beforeCache.key === fkey && _beforeCache.src) beforeSrc = _beforeCache.src;
    else {
      try { beforeSrc = out.__bsFramed.toDataURL('image/png'); }
      catch (e) { beforeSrc = null; }
      if (beforeSrc && fkey) _beforeCache = { key: fkey, src: beforeSrc };
    }
  }

  // Previous bitmap as a decode buffer (see template.html), only when changed.
  var prev = (_lastOutSrc && _lastOutSrc !== outSrc) ? _lastOutSrc : null;
  _lastOutSrc = outSrc;
  _memoKey = memoKey;
  _memoResult = {
    outSrc: outSrc, prevSrc: prev, note: null,
    histSvg: histSvg, lutNote: lutNote, lutLabel: lutLabel,
    bakeLut: false, downloadPresetLut: false, split: P.splitPreview, beforeSrc: beforeSrc,
    videoLook: videoLook,
  };
  return _memoResult;
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }

// Deep still export (engine 1.100 exportStill + host.codec): OWN the float
// MASTER formats - OpenEXR and Radiance .hdr - by rendering the whole pipeline in
// float at the full export size and encoding it directly, instead of letting the
// shell rasterise the 8-bit preview DOM. These are the formats a grader actually
// wants (DaVinci/Nuke read EXR), and neither carries a C2PA container, so
// owning them costs no provenance. Decline (return null) for everything else -
// including plain and 16-bit PNG - so those keep flowing through the shell's
// stamped raster path (a tool-owned PNG would silently shed the default-on
// Content Credential; real-precision 16-bit PNG waits on a stamp-preserving
// exportStill path). The float compose is DETERMINISTIC per shell: full-res,
// seeded, and blurred with the JS box (never ctx.filter), so a given params+seed
// always yields the same master on that device. It is NOT byte-identical across
// shells - the source draw and the dust layer go through the platform canvas -
// and this tool's pixels are a browser-canvas artefact, so the CLI (no canvas)
// declines here and the export is a web/desktop affordance.
function exportStill(ctx) {
  var h = (ctx && ctx.host) || host;
  if (!h || !h.codec) return null;                 // no deep codecs in this shell → 8-bit path
  var fmt = String((ctx && ctx.format) || '').toLowerCase();
  var opts = (ctx && ctx.opts) || {};
  var isExr = fmt === 'exr';
  var isHdr = fmt === 'hdr' || fmt === 'rgbe';
  if (!(isExr || isHdr)) return null;              // not a float master we own → shell's path
  if (!_deepState || !canRaster()) return null;    // nothing rendered yet / headless → decline
  var st = _deepState;

  var W = clamp(Math.round(n(opts.width, st.P.W)), 1, MAX_EDGE);
  var Hh = clamp(Math.round(n(opts.height, st.P.H)), 1, MAX_EDGE);
  var srgb;
  try {
    srgb = composeFloat(st.source, st.iw, st.ih, W, Hh, st.P, st.stops, st.userLut);
  } catch (e) {
    if (host.log) host.log('warn', 'darkroom: deep compose failed', { error: String(e) });
    return null;
  }
  if (!srgb) return null;

  // sRGB-encoded 0..255 float → linear-light RGBA float (the DeepFrame contract).
  var lin = new Float32Array(W * Hh * 4);
  for (var i = 0; i < srgb.length; i += 4) {
    lin[i] = srgbToLinear(clamp(srgb[i], 0, 255) / 255);
    lin[i + 1] = srgbToLinear(clamp(srgb[i + 1], 0, 255) / 255);
    lin[i + 2] = srgbToLinear(clamp(srgb[i + 2], 0, 255) / 255);
    lin[i + 3] = 1;
  }
  var frame = { width: W, height: Hh, data: lin, space: 'srgb-linear' };

  if (isExr) {
    return Promise.resolve(h.codec.exr(frame, { pixelType: opts.depth === 'float' ? 'float' : 'half' }))
      .then(function (bytes) { return { bytes: bytes, mime: 'image/x-exr' }; });
  }
  // isHdr (the only remaining owned format)
  return Promise.resolve(h.codec.radiance(frame, {}))
    .then(function (bytes) { return { bytes: bytes, mime: 'image/vnd.radiance' }; });
}

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

  var lutRes = resolvedLutSync(inputs, P);
  var dims = workDims(P.W, P.H, LIVE_MAX);
  var srcFrame, live;
  try {
    srcFrame = document.createElement('canvas');
    srcFrame.width = frame.width; srcFrame.height = frame.height;
    srcFrame.getContext('2d').putImageData(new ImageData(frame.data, frame.width, frame.height), 0, 0);
    live = document.createElement('canvas'); live.width = dims.w; live.height = dims.h;
    var lctx = live.getContext('2d', { willReadFrequently: true });
    drawFramed(lctx, srcFrame, frame.width, frame.height, dims.w, dims.h, P.framing, P.fit);
    live.__frameKey = true;
  } catch (e) { return null; }

  var out = renderFrame(live, dims.w, dims.h, dims, P, stops, lutRes.lut);
  if (!out) return null;
  _memoKey = null; _framedCache = { key: null, canvas: null }; // live supersedes still caches
  var outSrc;
  try { outSrc = out.toDataURL('image/jpeg', 0.85); } catch (e) { return null; }
  _lastOutSrc = outSrc;
  var beforeSrc = null;
  if (P.splitPreview && out.__bsFramed) {
    try { beforeSrc = out.__bsFramed.toDataURL('image/jpeg', 0.85); } catch (e) { beforeSrc = null; }
  }
  return {
    outSrc: outSrc, prevSrc: null, note: null,
    histSvg: P.histogram ? buildHistogramSvg(out) : '',
    bakeLut: false, downloadPresetLut: false, split: P.splitPreview, beforeSrc: beforeSrc,
  };
}

// ── Layered PSD export (from the retired Layers tool) ────────────────────────

/** Resolve a row's asset to RGBA pixels + natural size (browser realm only). */
function layerPixels(ref) {
  return layerImage(ref).then(function (img) {
    if (!img) return null;
    var w = img.naturalWidth || img.width;
    var h = img.naturalHeight || img.height;
    if (!w || !h) return null;
    var canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    try {
      ctx.drawImage(img, 0, 0);
      var data = ctx.getImageData(0, 0, w, h).data;
      return { width: w, height: h, pixels: new Uint8Array(data.buffer.slice(0)) };
    } catch (e) {
      return null; // tainted canvas or decode failure - skip this layer
    }
  });
}

/** Rebuild a layered Photoshop file from the rows via `host.layers.writePsd`
 *  (the engine's PSD writer behind a lazy bridge facade). Pixels come back from
 *  each row's stored asset - the import stored every layer as its own library
 *  PNG, so this is a decode of small per-layer images, not one giant buffer.
 *  Feature-detected: no host.layers, no button action. */
async function exportFile(ctx) {
  var inputs = inputsFrom(ctx.model);
  var rows = layerRows(inputs);
  if (!rows.length) throw new Error('Add at least one layer first.');
  if (!host || !host.layers || typeof host.layers.writePsd !== 'function') {
    throw new Error('Layered PSD export isn\'t available in this app.');
  }
  var docW = Math.max(1, Math.round(n(inputs.width, 1080)));
  var docH = Math.max(1, Math.round(n(inputs.height, 1080)));

  var layers = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var px = await layerPixels(r.img);
    if (!px) continue; // no pixels, no PSD layer - the row stays a Lolly-side note
    layers.push({
      name: (r.n || r.g || 'Layer ' + (i + 1)) + '',
      x: Math.round(n(r.x, 0)),
      y: Math.round(n(r.y, 0)),
      width: px.width,
      height: px.height,
      pixels: px.pixels,
      opacity: clamp(n(r.o, 100), 0, 100) / 100,
      blend: r.b || 'normal',
      visible: truthy(r.v, true)
    });
  }
  if (!layers.length) throw new Error('None of the layers could be read back as images.');

  var bytes = await host.layers.writePsd({ width: docW, height: docH, layers: layers });
  return { bytes: bytes, mime: 'image/vnd.adobe.photoshop', filename: 'darkroom-layers.psd' };
}
