/**
 * Pixel Stretch Filter — hooks.
 *
 * Freezes a photo at a threshold line and smears that 1px column of pixels across
 * the frame (the "pixel stretch" look). The original CSS technique — a 1px-wide
 * background slice blown up with `transform: scale(6000,1)` + `image-rendering:
 * pixelated` — renders crisp in Chrome/Firefox but FADES in Safari / iOS Safari:
 * WebKit doesn't honour `pixelated` on a CSS-transformed background, so it
 * bilinear-smooths the huge upscale into a washed-out band. We reproduce the exact
 * visual deterministically on a <canvas> instead — sample a 1px slice and stretch it
 * with `imageSmoothingEnabled = false` — which looks identical in every browser and
 * also gives us the live-camera + export paths for free.
 *
 * Pipeline: makeSrc() cover-frames the photo and applies the HSL colour shift (the
 * expensive part, cached); composeSmear() lays the smear over that base with an
 * optional feathered seam (the cheap part, re-run on every smear tweak). Output is
 * one composed bitmap handed to the template as the `outSrc` data URL. Pixel work
 * needs a real <canvas> (browser only); in a headless shell (CLI/jsdom) there's no
 * 2D context, so the hook degrades to a note.
 *
 * HSL is done with the standard luma-preserving colour matrices (not `ctx.filter`,
 * which older Safari ignores) so the colour shift is identical across browsers too.
 */

var STILL_MAX = 1440; // cap the working-canvas long edge for stills — snappy on slider
                      // drag; the SVG <image> scales it up to the export size.
var LIVE_MAX = 720;   // smaller working size per live frame so toDataURL keeps up.

// Default source image until the user picks one: a Lolly tool URL (bag-video → PNG),
// resolved via host.compose. A plain catalog id still works (see resolver below).
// Same default as the sibling filter-* tools, kept in sync deliberately.
var DEFAULT_IMAGE_ID = 'https://lolly.tools/tool/bag-video.png';

var _imgCache = { url: null, promise: null };
var _defaultUrl = null;
var _memoKey = null;
var _memoResult = null;
var _srcCache = { key: null, canvas: null }; // colour-adjusted base, reused when only the smear changes

// ── helpers ──────────────────────────────────────────────────────────────────

function inputsFrom(model) { var o = {}; model.forEach(function (i) { o[i.id] = i.value; }); return o; }
function n(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

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
    // crossOrigin so the canvas isn't tainted — a tainted canvas makes both
    // toDataURL (preview) and dom-to-image's canvas read (export) throw.
    try { im.crossOrigin = 'anonymous'; } catch (e) { /* ignore */ }
    im.src = url;
  });
}
function getImage(url) {
  if (_imgCache.url === url && _imgCache.promise) return _imgCache.promise;
  var promise = loadImage(url);
  _imgCache = { url: url, promise: promise };
  promise.catch(function () { if (_imgCache.url === url) _imgCache = { url: null, promise: null }; });
  return promise;
}

// Working-canvas dimensions: the export width/height aspect, scaled so the long edge
// never exceeds maxEdge (keeps the preview/export aspect exact, bounds the cost).
function workDims(W, H, maxEdge) {
  W = clamp(Math.round(W), 1, 8000); H = clamp(Math.round(H), 1, 8000);
  var longest = Math.max(W, H);
  if (longest <= maxEdge) return { w: W, h: H };
  var k = maxEdge / longest;
  return { w: Math.max(1, Math.round(W * k)), h: Math.max(1, Math.round(H * k)) };
}

// object-fit:cover + object-position, plus a zoom multiplier (1 = exactly cover).
function drawCover(ctx, source, iw, ih, W, H, zoom, px, py) {
  var s = Math.max(W / iw, H / ih) * zoom;
  var dw = iw * s, dh = ih * s;
  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, -px * (dw - W), -py * (dh - H), dw, dh);
}

// ── colour (HSL) ───────────────────────────────────────────────────────────────

function mul3(a, b) {
  var o = new Array(9);
  for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) {
    o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  }
  return o;
}
// Luma-preserving hue rotation ∘ saturation, sRGB coefficients (.213/.715/.072) —
// the same matrices SVG feColorMatrix / CSS hue-rotate()+saturate() use, so results
// match those filters exactly on browsers that have them.
function hueSatMatrix(hueDeg, sat) {
  var h = hueDeg * Math.PI / 180, c = Math.cos(h), s = Math.sin(h);
  var hueM = [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
  var satM = [
    0.213 + 0.787 * sat, 0.715 - 0.715 * sat, 0.072 - 0.072 * sat,
    0.213 - 0.213 * sat, 0.715 + 0.285 * sat, 0.072 - 0.072 * sat,
    0.213 - 0.213 * sat, 0.715 - 0.715 * sat, 0.072 + 0.928 * sat,
  ];
  return mul3(satM, hueM); // hue first, then saturation
}
// Adjust hue/saturation/lightness in place. No-op at defaults; silently skips a
// tainted canvas (cross-origin asset) so the still/live render still shows.
function applyHsl(ctx, W, H, p) {
  if (p.hue === 0 && p.sat === 1 && p.light === 0) return;
  var image;
  try { image = ctx.getImageData(0, 0, W, H); } catch (e) { return; }
  var d = image.data, light = p.light;
  var m = hueSatMatrix(p.hue, p.sat);
  var m00 = m[0], m01 = m[1], m02 = m[2], m10 = m[3], m11 = m[4], m12 = m[5], m20 = m[6], m21 = m[7], m22 = m[8];
  for (var i = 0; i < d.length; i += 4) {
    var r = d[i], g = d[i + 1], b = d[i + 2];
    var nr = m00 * r + m01 * g + m02 * b;
    var ng = m10 * r + m11 * g + m12 * b;
    var nb = m20 * r + m21 * g + m22 * b;
    if (light > 0) { nr += (255 - nr) * light; ng += (255 - ng) * light; nb += (255 - nb) * light; }
    else if (light < 0) { var k = 1 + light; nr *= k; ng *= k; nb *= k; }
    d[i]     = nr < 0 ? 0 : nr > 255 ? 255 : nr;
    d[i + 1] = ng < 0 ? 0 : ng > 255 ? 255 : ng;
    d[i + 2] = nb < 0 ? 0 : nb > 255 ? 255 : nb;
  }
  ctx.putImageData(image, 0, 0);
}

// ── compose ─────────────────────────────────────────────────────────────────

// The base layer: cover-frame the source into W×H and apply the colour shift.
function makeSrc(source, iw, ih, W, H, p) {
  var src = document.createElement('canvas'); src.width = W; src.height = H;
  var sctx = src.getContext('2d', { willReadFrequently: true }); if (!sctx) return null;
  drawCover(sctx, source, iw, ih, W, H, p.zoom, p.px, p.py);
  applyHsl(sctx, W, H, p);
  return src;
}

// Lay the smear over the base: a 1px slice at the threshold stretched (smoothing off
// → crisp streaks) the `spread` fraction toward the edge, with an optional feathered
// seam. Interior seams (the threshold edge, and the far end when spread < 100) blend
// over the feather band; edges that sit on the frame boundary stay solid.
function composeSmear(src, W, H, p) {
  var out = document.createElement('canvas'); out.width = W; out.height = H;
  var octx = out.getContext('2d'); if (!octx) return null;
  octx.drawImage(src, 0, 0); // base = framed, colour-adjusted photo
  if (p.spread <= 0) return out;

  var horiz = (p.direction === 'right' || p.direction === 'left');
  var axis = horiz ? W : H;
  var t = clamp(Math.round(p.threshold * (axis - 1)), 0, axis - 1); // sampled line position
  var a, b; // smear extent in ascending coordinate order
  if (p.direction === 'right' || p.direction === 'down') { a = t; b = t + Math.round(p.spread * (axis - t)); }
  else { b = t; a = t - Math.round(p.spread * t); }
  var len = b - a;
  if (len <= 0) return out;

  var layer = document.createElement('canvas'); layer.width = W; layer.height = H;
  var lctx = layer.getContext('2d'); if (!lctx) { octx.drawImage(out, 0, 0); return out; }
  lctx.imageSmoothingEnabled = false;
  if (horiz) lctx.drawImage(src, t, 0, 1, H, a, 0, len, H);   // stretch the column at t across [a,b]
  else       lctx.drawImage(src, 0, t, W, 1, 0, a, W, len);   // stretch the row at t across [a,b]

  // Feather: alpha-ramp the smear in/out at any seam that borders real photo.
  var featherPx = clamp((p.feather / 100) * len * 0.5, 0, len * 0.5);
  var lowerSeam = a > 0;                       // interior edge at the lower coordinate
  var upperSeam = b < axis;                    // interior edge at the upper coordinate
  if (featherPx >= 1 && (lowerSeam || upperSeam)) {
    var f = featherPx / len; // 0..0.5
    var grad = horiz ? lctx.createLinearGradient(a, 0, b, 0) : lctx.createLinearGradient(0, a, 0, b);
    grad.addColorStop(0, lowerSeam ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,1)');
    grad.addColorStop(f, 'rgba(0,0,0,1)');
    grad.addColorStop(1 - f, 'rgba(0,0,0,1)');
    grad.addColorStop(1, upperSeam ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,1)');
    lctx.globalCompositeOperation = 'destination-in';
    lctx.fillStyle = grad;
    lctx.fillRect(0, 0, W, H);
    lctx.globalCompositeOperation = 'source-over';
  }
  octx.drawImage(layer, 0, 0);
  return out;
}

function paramsFrom(inputs) {
  var fr = inputs.imageFraming || {};
  var dir = inputs.direction;
  return {
    direction: (dir === 'left' || dir === 'down' || dir === 'up') ? dir : 'right',
    threshold: clamp(n(inputs.threshold, 42), 0, 100) / 100,
    spread: clamp(n(inputs.spread, 100), 0, 100) / 100,
    feather: clamp(n(inputs.feather, 0), 0, 100),
    hue: clamp(n(inputs.hue, 0), -180, 180),
    sat: clamp(n(inputs.saturation, 100), 0, 200) / 100,
    light: clamp(n(inputs.lightness, 0), -100, 100) / 100,
    zoom: clamp(n(fr.zoom, 100), 100, 800) / 100,
    px: clamp(n(fr.x, 50), 0, 100) / 100,
    py: clamp(n(fr.y, 50), 0, 100) / 100,
    W: clamp(Math.round(n(inputs.width, 1080)), 1, 8000),
    H: clamp(Math.round(n(inputs.height, 1080)), 1, 8000),
  };
}

// ── lifecycle ────────────────────────────────────────────────────────────────

async function compute(model) {
  if (!canRaster()) return { outSrc: null, note: 'Preview renders in the browser' };
  var inputs = inputsFrom(model);

  var ref = inputs.image;
  var url = ref && typeof ref === 'object' ? ref.url : null;
  if (!url) {
    if (!_defaultUrl) {
      try {
        // Tool URL → render via compose; plain catalog id → host.assets.
        var def = (DEFAULT_IMAGE_ID.indexOf('://') !== -1)
          ? (host.compose && host.compose.renderUrl ? await host.compose.renderUrl(DEFAULT_IMAGE_ID) : null)
          : await host.assets.get(DEFAULT_IMAGE_ID);
        _defaultUrl = def && def.url;
      }
      catch (e) { if (host.log) host.log('warn', 'filter-pixel-stretch: default image unavailable', { error: String(e) }); }
    }
    url = _defaultUrl;
  }
  if (!url) return { outSrc: null, note: 'Choose an image to stretch' };

  var p = paramsFrom(inputs);
  var dims = workDims(p.W, p.H, STILL_MAX);
  var memoKey = JSON.stringify({ url: url, p: p, d: dims });
  if (memoKey === _memoKey) return _memoResult;

  var outSrc;
  try {
    var img = await getImage(url);
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return { outSrc: null, note: 'Could not read this image' };

    // Cache the colour-adjusted base so tweaking only the smear (threshold / spread /
    // feather / direction) skips the expensive cover + HSL re-render.
    var srcKey = JSON.stringify({ url: url, d: dims, zoom: p.zoom, px: p.px, py: p.py, hue: p.hue, sat: p.sat, light: p.light });
    var src;
    if (_srcCache.key === srcKey && _srcCache.canvas) { src = _srcCache.canvas; }
    else { src = makeSrc(img, iw, ih, dims.w, dims.h, p); _srcCache = { key: srcKey, canvas: src }; }
    if (!src) return { outSrc: null, note: 'Preview renders in the browser' };

    var cv = composeSmear(src, dims.w, dims.h, p);
    outSrc = cv ? cv.toDataURL('image/jpeg', 0.9) : null;
  } catch (e) {
    if (host.log) host.log('warn', 'filter-pixel-stretch: render failed', { error: String(e) });
    return { outSrc: null, note: 'Could not read this image' };
  }
  if (!outSrc) return { outSrc: null, note: 'Preview renders in the browser' };

  _memoKey = memoKey;
  _memoResult = { outSrc: outSrc };
  return _memoResult;
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }

// Live camera (engine v1.4): the runtime calls this once per frame with raw RGBA
// pixels. Run the SAME compose pipeline so the smear, feather and colour shift track
// motion. No URL load, no caching (every frame is new). null = keep last frame.
function onFrame(ctx) {
  var frame = ctx.frame;
  if (!frame || !frame.data || !frame.width || !frame.height) return null;
  if (!canRaster() || typeof ImageData === 'undefined') return null;
  var p = paramsFrom(inputsFrom(ctx.model));
  var dims = workDims(p.W, p.H, LIVE_MAX);
  var srcFrame;
  try {
    srcFrame = document.createElement('canvas');
    srcFrame.width = frame.width; srcFrame.height = frame.height;
    srcFrame.getContext('2d').putImageData(new ImageData(frame.data, frame.width, frame.height), 0, 0);
  } catch (e) { return null; }
  var src = makeSrc(srcFrame, frame.width, frame.height, dims.w, dims.h, p);
  if (!src) return null;
  var cv = composeSmear(src, dims.w, dims.h, p);
  if (!cv) return null;
  _memoKey = null; _srcCache = { key: null, canvas: null }; // a live frame supersedes the still caches
  var outSrc;
  try { outSrc = cv.toDataURL('image/jpeg', 0.82); } catch (e) { return null; }
  return { outSrc: outSrc };
}
