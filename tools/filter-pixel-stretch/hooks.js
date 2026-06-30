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
 * Output is one composed bitmap (cover-framed photo + smear) handed to the template
 * as the `outSrc` data URL. Pixel work needs a real <canvas> (browser only); in a
 * headless shell (CLI/jsdom) there's no 2D context, so the hook degrades to a note.
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

// Compose the effect: cover-frame the source into a W×H canvas, then overdraw the
// smear — a 1px slice at the threshold stretched (smoothing off → crisp streaks) the
// `spread` fraction of the way to the edge in the chosen direction. `source` is an
// HTMLImageElement (still) or a <canvas> (live frame); iw/ih are its intrinsic size.
function renderSmear(source, iw, ih, W, H, p) {
  if (typeof document === 'undefined') return null;
  var src = document.createElement('canvas'); src.width = W; src.height = H;
  var sctx = src.getContext('2d'); if (!sctx) return null;
  drawCover(sctx, source, iw, ih, W, H, p.zoom, p.px, p.py);

  var out = document.createElement('canvas'); out.width = W; out.height = H;
  var octx = out.getContext('2d'); if (!octx) return null;
  octx.drawImage(src, 0, 0); // base = framed photo

  if (p.spread > 0) {
    octx.imageSmoothingEnabled = false; // the 1px slice must stretch into hard streaks
    if (p.direction === 'right' || p.direction === 'left') {
      var sx = clamp(Math.round(p.threshold * (W - 1)), 0, W - 1);
      var ax, bx;
      if (p.direction === 'right') { ax = sx; bx = sx + Math.round(p.spread * (W - sx)); }
      else                         { bx = sx; ax = sx - Math.round(p.spread * sx); }
      if (bx - ax > 0) octx.drawImage(src, sx, 0, 1, H, ax, 0, bx - ax, H);
    } else {
      var sy = clamp(Math.round(p.threshold * (H - 1)), 0, H - 1);
      var ay, by;
      if (p.direction === 'down') { ay = sy; by = sy + Math.round(p.spread * (H - sy)); }
      else                        { by = sy; ay = sy - Math.round(p.spread * sy); }
      if (by - ay > 0) octx.drawImage(src, 0, sy, W, 1, 0, ay, W, by - ay);
    }
  }
  return out;
}

function paramsFrom(inputs) {
  var fr = inputs.imageFraming || {};
  var dir = inputs.direction;
  return {
    direction: (dir === 'left' || dir === 'down' || dir === 'up') ? dir : 'right',
    threshold: clamp(n(inputs.threshold, 42), 0, 100) / 100,
    spread: clamp(n(inputs.spread, 100), 0, 100) / 100,
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
    var cv = renderSmear(img, iw, ih, dims.w, dims.h, p);
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
// pixels. Wrap the frame in a canvas and run the SAME compose pipeline so the smear
// tracks motion. No URL load, no memo (every frame is new). null = keep last frame.
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
  var cv = renderSmear(srcFrame, frame.width, frame.height, dims.w, dims.h, p);
  if (!cv) return null;
  _memoKey = null; // a live frame supersedes the still memo
  var outSrc;
  try { outSrc = cv.toDataURL('image/jpeg', 0.82); } catch (e) { return null; }
  return { outSrc: outSrc };
}
