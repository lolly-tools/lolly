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
var LIVE_MAX = 1080;  // raster output, so keep the live working canvas near the export
                      // size — the camera frame is requested at high res (render.liveMaxEdge)
                      // and overlapping frames are dropped, so this trades fps for sharpness.

// Default source image until the user picks one: a Lolly tool URL (bag-video → PNG),
// resolved via host.compose. A plain catalog id still works (see resolver below).
// Same default as the sibling filter-* tools, kept in sync deliberately.
var DEFAULT_IMAGE_ID = 'https://lolly.tools/tool/bag-video.png';

var _imgCache = { url: null, promise: null };
var _defaultUrl = null;
var _memoKey = null;
var _memoResult = null;
var _lastOutSrc = null; // previous composed bitmap, sent as prevSrc for seamless swaps
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

// ── colour-treatment blend (separable modes; matches CSS/SVG feBlend keywords) ──
function _bl(mode, b, s) {
  switch (mode) {
    case 'multiply': return b * s;
    case 'screen': return b + s - b * s;
    case 'overlay': return b < 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
    case 'hard-light': return s < 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
    case 'soft-light': return s <= 0.5 ? b - (1 - 2 * s) * b * (1 - b)
      : b + (2 * s - 1) * ((b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b)) - b);
    case 'darken': return b < s ? b : s;
    case 'lighten': return b > s ? b : s;
    case 'color-dodge': return s >= 1 ? 1 : Math.min(1, b / (1 - s));
    case 'color-burn': return s <= 0 ? 0 : Math.max(0, 1 - (1 - b) / s);
    case 'difference': return b > s ? b - s : s - b;
    case 'exclusion': return b + s - 2 * b * s;
    default: return s; // normal
  }
}
function _hex2rgb(hex) {
  var s = (typeof hex === 'string' ? hex : '').trim().replace(/^#/, '');
  if (s.length === 3) s = s[0]+s[0]+s[1]+s[1]+s[2]+s[2];
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return { r: parseInt(s.slice(0,2),16), g: parseInt(s.slice(2,4),16), b: parseInt(s.slice(4,6),16) };
}
// ── non-separable blend modes (hue/saturation/colour/luminosity) — W3C Compositing.
// These mix the WHOLE rgb triple, so they can't go through the per-channel _bl above.
// Cb/Cs are [r,g,b] in 0..1; _blendNonSep returns [r,g,b] or null for separable modes.
function _lum(c) { return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; }
function _clipColor(c) {
  var l = _lum(c), mn = Math.min(c[0], c[1], c[2]), mx = Math.max(c[0], c[1], c[2]), o = [c[0], c[1], c[2]], i;
  if (mn < 0) for (i = 0; i < 3; i++) o[i] = l + (o[i] - l) * l / (l - mn);
  if (mx > 1) for (i = 0; i < 3; i++) o[i] = l + (o[i] - l) * (1 - l) / (mx - l);
  return o;
}
function _setLum(c, l) { var d = l - _lum(c); return _clipColor([c[0] + d, c[1] + d, c[2] + d]); }
function _sat(c) { return Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]); }
function _setSat(c, s) {
  var ix = [0, 1, 2].sort(function (a, b) { return c[a] - c[b]; }), lo = ix[0], mid = ix[1], hi = ix[2], o = [0, 0, 0];
  if (c[hi] > c[lo]) { o[mid] = (c[mid] - c[lo]) * s / (c[hi] - c[lo]); o[hi] = s; }
  return o;
}
function _blendNonSep(mode, Cb, Cs) {
  switch (mode) {
    case 'hue':        return _setLum(_setSat(Cs, _sat(Cb)), _lum(Cb));
    case 'saturation': return _setLum(_setSat(Cb, _sat(Cs)), _lum(Cb));
    case 'color':      return _setLum(Cs, _lum(Cb));
    case 'luminosity': return _setLum(Cb, _lum(Cs));
    default:           return null;
  }
}
// Treatment state parsed once from inputs. ov=null or amt<=0 ⇒ treatment off.
function treatmentFrom(inputs) {
  var ov = _hex2rgb(inputs.treatmentColor);
  var amt = clamp(n(inputs.treatmentIntensity, 20), 0, 100) / 100;
  var mode = typeof inputs.blendMode === 'string' ? inputs.blendMode : 'multiply';
  return { ov: ov, amt: amt, mode: mode, on: !!(ov && amt > 0) };
}

// Adjust hue/saturation/lightness in place, then blend the colour treatment over the
// result (same pass). No-op at defaults; silently skips a tainted canvas (cross-origin
// asset) so the still/live render still shows.
function applyHsl(ctx, W, H, p) {
  if (p.hue === 0 && p.sat === 1 && p.light === 0 && p.contrast === 0 && !(p.treat && p.treat.on)) return;
  var image;
  try { image = ctx.getImageData(0, 0, W, H); } catch (e) { return; }
  var d = image.data, light = p.light;
  var m = hueSatMatrix(p.hue, p.sat);
  var m00 = m[0], m01 = m[1], m02 = m[2], m10 = m[3], m11 = m[4], m12 = m[5], m20 = m[6], m21 = m[7], m22 = m[8];
  // Contrast LUT about mid-grey (same cf curve as the sibling filters). Identity at 0,
  // so it's a no-op for existing sessions; applied per-channel BEFORE the hue/sat matrix.
  // Uint8ClampedArray clamps+rounds each entry on assignment.
  var cf = (259 * (p.contrast + 255)) / (255 * (259 - p.contrast));
  var clut = new Uint8ClampedArray(256);
  for (var v = 0; v < 256; v++) clut[v] = cf * (v - 128) + 128;
  for (var i = 0; i < d.length; i += 4) {
    var r = clut[d[i]], g = clut[d[i + 1]], b = clut[d[i + 2]];
    var nr = m00 * r + m01 * g + m02 * b;
    var ng = m10 * r + m11 * g + m12 * b;
    var nb = m20 * r + m21 * g + m22 * b;
    if (light > 0) { nr += (255 - nr) * light; ng += (255 - ng) * light; nb += (255 - nb) * light; }
    else if (light < 0) { var k = 1 + light; nr *= k; ng *= k; nb *= k; }
    if (p.treat && p.treat.on) {
      var A = p.treat.amt, ov = p.treat.ov, mo = p.treat.mode;
      var Cb = [nr / 255, ng / 255, nb / 255], ns = _blendNonSep(mo, Cb, [ov.r / 255, ov.g / 255, ov.b / 255]);
      nr = (Cb[0] * (1 - A) + (ns ? ns[0] : _bl(mo, Cb[0], ov.r / 255)) * A) * 255;
      ng = (Cb[1] * (1 - A) + (ns ? ns[1] : _bl(mo, Cb[1], ov.g / 255)) * A) * 255;
      nb = (Cb[2] * (1 - A) + (ns ? ns[2] : _bl(mo, Cb[2], ov.b / 255)) * A) * 255;
    }
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

// Compose the stretch over the base. Three regions along the stretch axis, from the
// frozen line `t` outward in the chosen direction:
//   HEAD  — the photo before the freeze line, untouched (it's just the base).
//   SMEAR — the 1px slice at `t` stretched (smoothing off → crisp streaks) across [a,b).
//   TAIL  — the photo from the freeze line onward, SLID along in the stretch direction
//           by the smear width and drawn at its NATURAL 1:1 aspect (no squeeze); whatever
//           runs past the far edge is clipped. So the image keeps its proportions and
//           simply continues from where it froze. (Earlier this squeezed the whole
//           remaining photo into the leftover gap, which distorted it.)
// `spread` sets how much of the post-threshold space the smear claims; the tail fills the
// remainder at 1:1. spread=100 ⇒ tail width 0 ⇒ smear fills to the edge (the old default,
// byte-identical). spread=0 ⇒ identity. Mirrored for left/up. Feather math is unchanged;
// its far seam cross-fades the smear into the tail (both are real photo, both keyed at `t`).
function composeSmear(src, W, H, p) {
  var out = document.createElement('canvas'); out.width = W; out.height = H;
  var octx = out.getContext('2d'); if (!octx) return null;
  octx.drawImage(src, 0, 0); // base = framed, colour-adjusted photo (this IS the untouched HEAD)
  if (p.spread <= 0) return out;

  var horiz = (p.direction === 'right' || p.direction === 'left');
  var axis = horiz ? W : H;
  var t = clamp(Math.round(p.threshold * (axis - 1)), 0, axis - 1); // frozen-line position
  var ascending = (p.direction === 'right' || p.direction === 'down');
  var a, b;                       // smear band [a,b) in ascending coordinate order
  var tSrc0, tSrcLen, tDst0, tDstLen; // squeezed-tail source span → dest span
  if (ascending) {                // right / down — smear toward the higher coordinate
    a = t;
    b = clamp(t + Math.round(p.spread * (axis - t)), t, axis);
    tDst0 = b;  tDstLen = axis - b;          // tail fills the leftover [b .. axis)
    tSrc0 = t;  tSrcLen = tDstLen;           // …with photo[t .. t+leftover) at 1:1 (slides, clipped)
  } else {                        // left / up — mirror, smear toward the lower coordinate
    b = t;
    a = clamp(t - Math.round(p.spread * t), 0, t);
    tDst0 = 0;      tDstLen = a;              // tail fills the leftover [0 .. a)
    tSrc0 = t - a;  tSrcLen = tDstLen;        // …with photo[t-a .. t) at 1:1 (slides, clipped)
  }
  var len = b - a;

  // TAIL first, so the smear's feathered far edge can blend over it. The tail's leading
  // sample is the frozen line `t`, so the smear→tail seam is colour-continuous by design.
  if (tDstLen >= 1 && tSrcLen >= 1) {
    octx.imageSmoothingEnabled = true;
    if (octx.imageSmoothingQuality) octx.imageSmoothingQuality = 'high';
    if (horiz) octx.drawImage(src, tSrc0, 0, tSrcLen, H, tDst0, 0, tDstLen, H);
    else       octx.drawImage(src, 0, tSrc0, W, tSrcLen, 0, tDst0, W, tDstLen);
  }

  if (len <= 0) return out;

  var layer = document.createElement('canvas'); layer.width = W; layer.height = H;
  var lctx = layer.getContext('2d'); if (!lctx) return out;
  lctx.imageSmoothingEnabled = false;
  if (horiz) lctx.drawImage(src, t, 0, 1, H, a, 0, len, H);   // stretch the column at t across [a,b)
  else       lctx.drawImage(src, 0, t, W, 1, 0, a, W, len);   // stretch the row at t across [a,b)

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
    contrast: clamp(n(inputs.contrast, 0), -100, 100),
    hue: clamp(n(inputs.hue, 0), -180, 180),
    sat: clamp(n(inputs.saturation, 100), 0, 200) / 100,
    light: clamp(n(inputs.lightness, 0), -100, 100) / 100,
    treat: treatmentFrom(inputs),
    zoom: clamp(n(fr.zoom, 100), 100, 800) / 100,
    px: clamp(n(fr.x, 50), 0, 100) / 100,
    py: clamp(n(fr.y, 50), 0, 100) / 100,
    W: clamp(Math.round(n(inputs.width, 1080)), 1, 8000),
    H: clamp(Math.round(n(inputs.height, 1080)), 1, 8000),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Brand overlay — optional SUSE logo + gently-animated "lower third" name card.
//
// Kept BYTE-IDENTICAL across every filter-* tool (paste target). Emits SVG children
// so the overlay survives ALL export paths — raster (png/webp/jpg), motion
// (gif/webm/mp4) AND vector (svg/pdf). Everything is OFF by default → overlayActive()
// is false → buildOverlaySvg() returns '' (zero markup / zero cost).
//
// Animation is ATTRIBUTE-BAKED (computed transform/opacity per render), never CSS
// @keyframes or SMIL: the tool's whole SVG is replaced on every paint / every live
// camera frame, which would reset a CSS/SMIL animation to t=0 each frame. Baking the
// pose means it looks identical in the live preview, in each captured video frame,
// and in a static vector snapshot. In live mode the gentle intro is driven by the
// camera clock (elapsed since the overlay first appeared).
//
// Module state used: _logoCache, _profileHeadshotUrl, _liveOvStart. Depends on `host`
// (host.assets.get / host.profile.get) being in scope.
// ══════════════════════════════════════════════════════════════════════════════
var LOGO_ASPECT = 210.179 / 37.666;   // SUSE horizontal lockup, from its own viewBox
var _logoCache = {};                  // variantId -> url | null (resolved once per variant)
var _profileHeadshotUrl;              // undefined = not looked up; null = none; string = url
var _liveOvStart = null;              // frame.t when the overlay first became active while live

function ovEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;';
  });
}
function ovNum(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
function ovClamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function ovF2(v) { return Math.round(v * 100) / 100; }
function ovEaseOut(p) { p = ovClamp(p, 0, 1); return 1 - Math.pow(1 - p, 3); }

// Normalise the overlay-related inputs into one flat object (reused by still + live).
function overlayInputs(inp) {
  return {
    noFilter: !!inp.noFilter,
    showLogo: !!inp.showLogo,
    logoPosition: inp.logoPosition || 'top-right',
    logoStyle: inp.logoStyle || 'white',
    logoScale: inp.logoScale,
    lowerThird: !!inp.lowerThird,
    ltTheme: inp.ltTheme || 'bar',
    ltPosition: inp.ltPosition || 'left',
    firstname: inp.firstname,
    lastname: inp.lastname,
    title: inp.title,
  };
}
function overlayActive(o) { return !!(o.showLogo || o.lowerThird); }

// One of the 8 shipped SUSE logo ids. white → on-dark mono, green → on-dark colour,
// black → on-light mono. Horizontal lockup only (reads best over a strip/corner).
function logoVariantId(style) {
  return style === 'green' ? 'suse/logo/hor-neg-green'
    : style === 'black' ? 'suse/logo/hor-pos-black'
      : 'suse/logo/hor-neg-white';
}
// Resolve the chosen logo variant to a URL, cached per-variant. Safe to await in
// compute/onInit; call WITHOUT await from onFrame — it just warms the cache.
function resolveLogoUrl(style) {
  var id = logoVariantId(style);
  if (_logoCache[id] !== undefined) return Promise.resolve(_logoCache[id]);
  return host.assets.get(id)
    .then(function (r) { return (_logoCache[id] = (r && r.url) || null); })
    .catch(function () { return (_logoCache[id] = null); });
}
function cachedLogoUrl(style) { return _logoCache[logoVariantId(style)] || ''; }

// Resolve the user's PROFILE headshot to a URL once (async). Used as the auto default
// for the lower-third chip when the headshot input is empty. null = none / unavailable.
function resolveProfileHeadshot() {
  if (_profileHeadshotUrl !== undefined) return Promise.resolve(_profileHeadshotUrl);
  _profileHeadshotUrl = null;
  if (!host.profile || !host.profile.get) return Promise.resolve(null);
  return host.profile.get().then(function (p) {
    if (p && p.headshot && p.headshot.id) {
      return host.assets.get(p.headshot.id).then(function (r) { _profileHeadshotUrl = (r && r.url) || null; });
    }
  }).catch(function () { }).then(function () { return _profileHeadshotUrl; });
}

// Build the overlay SVG children. OW/OH = the output coordinate box (viewBox units).
// o = normalised overlay inputs + { logoUrl, headshotUrl, mode:'still'|'live', elapsed }.
function buildOverlaySvg(OW, OH, o) {
  if (!overlayActive(o)) return '';
  var live = o.mode === 'live';
  var elapsed = live ? ovNum(o.elapsed, 1e9) : 1e9;
  var out = '';

  // ── SUSE logo ──────────────────────────────────────────────────────────────
  if (o.showLogo && o.logoUrl) {
    var pos = o.logoPosition || 'top-right';
    var m = OW * 0.045;
    var scale = ovClamp(ovNum(o.logoScale, 1), 0.25, 3);
    var w = pos === 'full' ? ovClamp(OW * 0.72 * scale, 40, OW)
      : ovClamp(OW * 0.2 * scale, 24, OW - m * 2);
    var h = w / LOGO_ASPECT;
    var x = (pos === 'top-left' || pos === 'bottom-left') ? m
      : (pos === 'top-right' || pos === 'bottom-right') ? OW - m - w
        : (OW - w) / 2;
    var y = (pos === 'top-left' || pos === 'top-right' || pos === 'top') ? m
      : (pos === 'bottom-left' || pos === 'bottom-right' || pos === 'bottom') ? OH - m - h
        : (OH - h) / 2;
    var lop = live ? ovEaseOut(elapsed / 460) : 1;
    out += '<image href="' + ovEsc(o.logoUrl) + '" x="' + ovF2(x) + '" y="' + ovF2(y)
      + '" width="' + ovF2(w) + '" height="' + ovF2(h) + '" preserveAspectRatio="xMidYMid meet"'
      + (lop < 1 ? ' opacity="' + ovF2(lop) + '"' : '') + '/>';
  }

  // ── lower-third name card ────────────────────────────────────────────────────
  if (o.lowerThird) {
    var name = [String(o.firstname || '').trim(), String(o.lastname || '').trim()].filter(Boolean).join(' ') || 'Your name';
    var title = String(o.title || '').trim();
    var theme = o.ltTheme || 'bar';
    var lp = o.ltPosition || 'left';
    var hasShot = !!o.headshotUrl;

    var p = live ? ovEaseOut(elapsed / 560) : 1;
    var mg = OW * 0.045;
    var padX = OH * 0.032, padY = OH * 0.028;
    var nameSize = OH * 0.045, titleSize = OH * 0.028;
    var lineH = nameSize + (title ? titleSize * 1.5 : 0);
    var cardH = lineH + padY * 2;
    var chip = hasShot ? cardH - padY * 0.9 : 0;
    var gap = hasShot ? padX * 0.7 : 0;
    var nameW = name.length * nameSize * 0.6;
    var titleW = title.length * titleSize * 0.58;
    var textW = Math.max(nameW, titleW, OW * 0.14);
    var cardW = ovClamp(padX + (hasShot ? chip + gap : 0) + textW + padX, OW * 0.22, OW - mg * 2);

    var cx = lp === 'center' ? (OW - cardW) / 2 : lp === 'right' ? OW - mg - cardW : mg;
    var cy = OH - mg - cardH;
    var dy = (1 - p) * (OH * 0.035);

    var accent = '#30ba78';
    var r = Math.min(cardH * 0.2, 22);
    var g = '<g transform="translate(' + ovF2(cx) + ' ' + ovF2(cy + dy) + ')"'
      + (p < 1 ? ' opacity="' + ovF2(p) + '"' : '') + '>';

    if (theme === 'bar') {
      g += ovRRect(0, 0, cardW, cardH, r, '#0c322c', 0.97);
    } else if (theme === 'glass') {
      g += ovRRect(0, 0, cardW, cardH, r, '#0b1512', 0.34);
      g += '<rect x="0.75" y="0.75" width="' + ovF2(cardW - 1.5) + '" height="' + ovF2(cardH - 1.5)
        + '" rx="' + ovF2(r) + '" ry="' + ovF2(r) + '" fill="none" stroke="#ffffff" stroke-opacity="0.3" stroke-width="1.4"/>';
    } // 'minimal' → no plate; text carries a soft outline for legibility

    var textX = padX + (hasShot ? chip + gap : 0);
    var blockTop = (cardH - lineH) / 2;
    var nameY = blockTop + nameSize * 0.82;
    var titleY = nameY + titleSize * 1.4;
    var titleColor = theme === 'bar' ? '#a9e3c8' : '#e6f0ec';
    var shadow = theme === 'minimal'
      ? ' style="paint-order:stroke;stroke:#0b1512;stroke-opacity:0.55;stroke-width:' + ovF2(nameSize * 0.14) + 'px;stroke-linejoin:round"'
      : '';
    var titleShadow = theme === 'minimal'
      ? ' style="paint-order:stroke;stroke:#0b1512;stroke-opacity:0.55;stroke-width:' + ovF2(titleSize * 0.16) + 'px;stroke-linejoin:round"'
      : '';
    var FONT = 'SUSE, system-ui, -apple-system, sans-serif';

    if (hasShot) {
      var cxs = padX + chip / 2, cys = cardH / 2, rad = chip / 2;
      g += '<clipPath id="lollyShot"><circle cx="' + ovF2(cxs) + '" cy="' + ovF2(cys) + '" r="' + ovF2(rad) + '"/></clipPath>';
      g += '<image href="' + ovEsc(o.headshotUrl) + '" x="' + ovF2(padX) + '" y="' + ovF2(cys - rad)
        + '" width="' + ovF2(chip) + '" height="' + ovF2(chip) + '" preserveAspectRatio="xMidYMid slice" clip-path="url(#lollyShot)"/>';
      g += '<circle cx="' + ovF2(cxs) + '" cy="' + ovF2(cys) + '" r="' + ovF2(rad) + '" fill="none" stroke="' + accent + '" stroke-width="' + ovF2(rad * 0.09) + '"/>';
    }

    g += '<text x="' + ovF2(textX) + '" y="' + ovF2(nameY) + '" font-family="' + FONT + '" font-size="' + ovF2(nameSize)
      + '" font-weight="700" fill="#ffffff"' + shadow + '>' + ovEsc(name) + '</text>';
    if (title) {
      g += '<text x="' + ovF2(textX) + '" y="' + ovF2(titleY) + '" font-family="' + FONT + '" font-size="' + ovF2(titleSize)
        + '" font-weight="500" fill="' + titleColor + '"' + titleShadow + '>' + ovEsc(title) + '</text>';
    }
    var ulY = (title ? titleY : nameY) + (title ? titleSize * 0.55 : nameSize * 0.4);
    var ulW = Math.min(nameW, cardW - textX - padX) * (live ? p : 1);
    g += '<rect x="' + ovF2(textX) + '" y="' + ovF2(ulY) + '" width="' + ovF2(Math.max(0, ulW)) + '" height="' + ovF2(Math.max(2, nameSize * 0.08)) + '" rx="' + ovF2(nameSize * 0.04) + '" fill="' + accent + '"/>';

    g += '</g>';
    out += g;
  }

  return out;
}
// A rounded rect (rx clamped) shared by the overlay themes.
function ovRRect(x, y, w, h, r, fill, op) {
  r = Math.min(r, w / 2, h / 2);
  return '<rect x="' + ovF2(x) + '" y="' + ovF2(y) + '" width="' + ovF2(w) + '" height="' + ovF2(h)
    + '" rx="' + ovF2(r) + '" ry="' + ovF2(r) + '" fill="' + fill + '"'
    + (op != null && op < 1 ? ' fill-opacity="' + ovF2(op) + '"' : '') + '/>';
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

  // Brand overlay — resolve logo + headshot URLs (cached) before building so the still
  // render already carries them, and the RESOLVED ov (incl. noFilter + overlay inputs)
  // is folded into the memo key → editing an overlay control re-renders the still.
  var ovi = overlayInputs(inputs);
  if (ovi.showLogo) await resolveLogoUrl(ovi.logoStyle);
  var headUrl = (inputs.ltHeadshot && inputs.ltHeadshot.url) || '';
  if (ovi.lowerThird && !headUrl) headUrl = (await resolveProfileHeadshot()) || '';
  var ov = Object.assign({}, ovi, { logoUrl: cachedLogoUrl(ovi.logoStyle), headshotUrl: headUrl, mode: 'still' });

  var memoKey = JSON.stringify({ url: url, p: p, d: dims, ov: ov });
  if (memoKey === _memoKey) return _memoResult;

  var overlaySvg = buildOverlaySvg(p.W, p.H, ov);

  var outSrc;
  try {
    var img = await getImage(url);
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return { outSrc: null, note: 'Could not read this image' };

    // Cache the colour-adjusted base so tweaking only the smear (threshold / spread /
    // feather / direction) skips the expensive cover + HSL re-render.
    var srcKey = JSON.stringify({ url: url, d: dims, zoom: p.zoom, px: p.px, py: p.py, hue: p.hue, sat: p.sat, light: p.light, contrast: p.contrast, treat: p.treat });
    var src;
    if (_srcCache.key === srcKey && _srcCache.canvas) { src = _srcCache.canvas; }
    else { src = makeSrc(img, iw, ih, dims.w, dims.h, p); _srcCache = { key: srcKey, canvas: src }; }
    if (!src) return { outSrc: null, note: 'Preview renders in the browser' };

    // No-filter: show the raw cover-framed source (overlay composites over it via the
    // template child); otherwise apply the pixel-stretch smear.
    if (ovi.noFilter) {
      outSrc = src.toDataURL('image/jpeg', 0.9);
    } else {
      var cv = composeSmear(src, dims.w, dims.h, p);
      outSrc = cv ? cv.toDataURL('image/jpeg', 0.9) : null;
    }
  } catch (e) {
    if (host.log) host.log('warn', 'filter-pixel-stretch: render failed', { error: String(e) });
    return { outSrc: null, note: 'Could not read this image' };
  }
  if (!outSrc) return { outSrc: null, note: 'Preview renders in the browser' };

  // Hand the PREVIOUS bitmap to the template as a base layer so the new one can decode
  // underneath it without the old frame flashing through (see template.html). Only when
  // it actually changed — an unchanged frame needs no buffer.
  var prev = (_lastOutSrc && _lastOutSrc !== outSrc) ? _lastOutSrc : null;
  _lastOutSrc = outSrc;
  _memoKey = memoKey;
  _memoResult = { outSrc: outSrc, prevSrc: prev, overlaySvg: overlaySvg };
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
  var inputs = inputsFrom(ctx.model);
  var p = paramsFrom(inputs);
  var dims = workDims(p.W, p.H, LIVE_MAX);
  var srcFrame;
  try {
    srcFrame = document.createElement('canvas');
    srcFrame.width = frame.width; srcFrame.height = frame.height;
    srcFrame.getContext('2d').putImageData(new ImageData(frame.data, frame.width, frame.height), 0, 0);
  } catch (e) { return null; }
  var src = makeSrc(srcFrame, frame.width, frame.height, dims.w, dims.h, p);
  if (!src) return null;

  // Brand overlay (live): warm caches without awaiting; drive the intro from camera time.
  var ovi = overlayInputs(inputs);
  if (overlayActive(ovi)) { if (_liveOvStart == null) _liveOvStart = frame.t; }
  else _liveOvStart = null;
  if (ovi.showLogo && _logoCache[logoVariantId(ovi.logoStyle)] === undefined) resolveLogoUrl(ovi.logoStyle);
  if (ovi.lowerThird && _profileHeadshotUrl === undefined) resolveProfileHeadshot();
  var headUrl = (inputs.ltHeadshot && inputs.ltHeadshot.url) || _profileHeadshotUrl || '';
  var ov = Object.assign({}, ovi, {
    logoUrl: cachedLogoUrl(ovi.logoStyle), headshotUrl: headUrl,
    mode: 'live', elapsed: frame.t - (_liveOvStart == null ? frame.t : _liveOvStart),
  });
  var overlaySvg = buildOverlaySvg(p.W, p.H, ov);

  // No-filter: hand back the raw cover-framed camera frame WITHOUT the smear; the overlay
  // is a template child, so it composites over it either way.
  var outCanvas;
  if (ovi.noFilter) {
    outCanvas = src;
  } else {
    outCanvas = composeSmear(src, dims.w, dims.h, p);
    if (!outCanvas) return null;
  }
  _memoKey = null; _srcCache = { key: null, canvas: null }; // a live frame supersedes the still caches
  var outSrc;
  try { outSrc = outCanvas.toDataURL('image/jpeg', 0.82); } catch (e) { return null; }
  // No prevSrc base in live mode — frames are continuous, so a per-frame buffer would
  // just double the DOM each tick; keep _lastOutSrc current so the next still render
  // (e.g. on stop) buffers cleanly against the last live frame.
  _lastOutSrc = outSrc;
  return { outSrc: outSrc, prevSrc: null, overlaySvg: overlaySvg };
}
