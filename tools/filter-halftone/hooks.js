/**
 * Halftone Filter — hooks.
 *
 * Turns a raster image into a *vector* halftone: a grid of dots whose size
 * tracks the local lightness of the photo. The whole thing is emitted as an
 * inline <svg> (extra `svgContent`) so the template is SVG-rooted — which means
 * the SVG export is a true, scalable vector of <circle>/<rect>/<path> dots, and
 * the raster exports (PNG/WebP/AVIF) rasterise that same SVG (with optional
 * transparency).
 *
 * The sampling pipeline mirrors the classic canvas halftone effect:
 *   decode image → downsample to a cols×rows luminance grid → brightness /
 *   contrast / gamma → optional box-blur smoothing → optional 1-bit dithering →
 *   draw one dot per cell sized by (1 - lightness).
 *
 * Pixel decoding needs a real <canvas> (browser only). In a headless shell
 * (CLI/jsdom) there's no 2D context, so the hook degrades to a friendly
 * placeholder instead of throwing — this is a browser-rendered tool.
 */

// The viewBox the dots live in — matches render.width/height (a square frame).
var VIEW = 1000;
// Upper bound on the dot grid so a tiny grid size can't emit a runaway SVG.
var MAX_CELLS = 26000;
// The default source image shown until the user picks one. A Lolly tool URL (the
// bag-video tool rendered to a PNG), resolved lazily via host.compose so the tool
// shows a real halftone on first paint. A plain catalog id still works too — the
// resolver below branches on whether this is a URL (see compute()).
var DEFAULT_IMAGE_ID = 'https://lolly.tools/tool/bag-video.png';

// Decoded-image cache (keyed by URL). Holds the in-flight PROMISE, not just the
// resolved image, so re-renders during the first decode share one load instead
// of starting a second decode of the same URL.
var _imgCache = { url: null, promise: null };
// Resolved URL of the demo default asset, cached so the no-image state doesn't
// re-read it from storage on every keystroke.
var _defaultUrl = null;
// One-entry memo of the last rendered SVG, keyed on every input that affects it.
var _memoKey = null;
var _memoResult = null;
// Remembered for beforeExport (which only gets format/opts): the transparency
// toggle and the resolved background colour.
var _transparent = false;
var _bgColor = '#ffffff';

// ── small helpers ────────────────────────────────────────────────────────────

function inputsFrom(model) {
  var o = {};
  model.forEach(function (i) { o[i.id] = i.value; });
  return o;
}
function n(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function f2(v) { return Math.round(v * 100) / 100; }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// A valid CSS colour string, or a fallback. Keeps stray input out of the SVG.
function color(v, fallback) {
  var s = (typeof v === 'string' ? v : '').trim();
  return s ? s : fallback;
}

function svgOpen() {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" '
    + 'viewBox="0 0 ' + VIEW + ' ' + VIEW + '" '
    + 'preserveAspectRatio="xMidYMid meet">';
}

function placeholder(message) {
  return svgOpen()
    + '<rect width="' + VIEW + '" height="' + VIEW + '" fill="#f4f4f5"/>'
    + '<text x="' + (VIEW / 2) + '" y="' + (VIEW / 2) + '" text-anchor="middle" '
    + 'dominant-baseline="middle" font-family="sans-serif" font-size="34" '
    + 'fill="#9ca3af">' + esc(message) + '</text>'
    + '</svg>';
}

// ── image decoding ───────────────────────────────────────────────────────────

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
  if (_imgCache.url === url && _imgCache.promise) return _imgCache.promise;
  var promise = loadImage(url);
  _imgCache = { url: url, promise: promise };
  // Drop a failed load so a later attempt can retry rather than reusing the reject.
  promise.catch(function () { if (_imgCache.url === url) _imgCache = { url: null, promise: null }; });
  return promise;
}

// Whether this shell can decode pixels at all (real browser canvas with a 2D
// context). Headless shells (CLI/jsdom) can't, and their <img> never fires load,
// so we probe up front and skip image loading entirely rather than hang to the
// hook timeout.
function canRaster() {
  if (typeof document === 'undefined' || !document.createElement) return false;
  try {
    var c = document.createElement('canvas');
    return !!(c.getContext && c.getContext('2d'));
  } catch (e) { return false; }
}

// Downsample the image into a cols×rows grid. Returns an object carrying the
// per-cell luminance (0..255, transparency composited over white — drives dot
// size) AND the raw per-cell RGB (drives dot colour for the "from image" path).
// Returns null when there's no usable 2D canvas (headless shells).
function sampleGrid(img, cols, rows, fit) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  var c = document.createElement('canvas');
  c.width = cols; c.height = rows;
  var ctx = c.getContext && c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';

  var iw = img.naturalWidth || img.width;
  var ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;

  if (fit === 'cover') {
    // Scale the source to fill the grid, centre-cropping the overflow.
    var s = Math.max(cols / iw, rows / ih);
    var dw = iw * s, dh = ih * s;
    ctx.drawImage(img, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
  } else {
    // 'contain': the grid already carries the image's aspect ratio (see geometry
    // below), so a straight stretch into it preserves proportions.
    ctx.drawImage(img, 0, 0, cols, rows);
  }

  var data;
  try { data = ctx.getImageData(0, 0, cols, rows).data; }
  catch (e) { return null; } // tainted canvas (cross-origin asset)

  var lumArr = new Float32Array(cols * rows);
  var rArr = new Uint8ClampedArray(cols * rows);
  var gArr = new Uint8ClampedArray(cols * rows);
  var bArr = new Uint8ClampedArray(cols * rows);
  for (var i = 0, p = 0; i < lumArr.length; i++, p += 4) {
    var a = data[p + 3] / 255;
    var R = data[p], G = data[p + 1], B = data[p + 2];
    var lum = 0.299 * R + 0.587 * G + 0.114 * B;
    // Composite transparency onto white so cut-out PNGs don't read as pure black.
    if (a < 1) lum = lum * a + 255 * (1 - a);
    lumArr[i] = lum;
    rArr[i] = R; gArr[i] = G; bArr[i] = B;
  }
  return { lum: lumArr, r: rArr, g: gArr, b: bArr, cols: cols, rows: rows };
}

// ── tone + texture (ported from the reference canvas halftone) ────────────────

function applyTone(grid, brightness, contrast, gamma) {
  var cf = (259 * (contrast + 255)) / (255 * (259 - contrast));
  var invG = 1 / (gamma > 0 ? gamma : 0.0001);
  for (var i = 0; i < grid.length; i++) {
    var v = cf * (grid[i] - 128) + 128 + brightness;
    v = clamp(v, 0, 255);
    grid[i] = 255 * Math.pow(v / 255, invG);
  }
}

// One 3×3 box-blur pass (full 9-tap neighbourhood average) → a fresh array.
function onePass(src, cols, rows) {
  var t = new Float32Array(src.length);
  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < cols; col++) {
      var sum = 0, count = 0;
      for (var dy = -1; dy <= 1; dy++) {
        for (var dx = -1; dx <= 1; dx++) {
          var r = row + dy, cc = col + dx;
          if (r >= 0 && r < rows && cc >= 0 && cc < cols) { sum += src[r * cols + cc]; count++; }
        }
      }
      t[row * cols + col] = sum / count;
    }
  }
  return t;
}

// Box-blur the cell grid by `strength` passes. The fractional part cross-fades
// the last full pass toward ONE MORE pass, so blur increases monotonically across
// the whole slider — a fractional step always *adds* blur (the earlier version
// blended toward the unblurred grid, which made smoothing non-monotonic).
function boxBlur(grid, cols, rows, strength) {
  var passes = Math.floor(strength);
  var frac = strength - passes;
  var base = grid;
  for (var p = 0; p < passes; p++) base = onePass(base, cols, rows);
  if (frac > 0) {
    var extra = onePass(base, cols, rows);
    var out = new Float32Array(base.length); // never mutate the caller's grid in place
    for (var i = 0; i < base.length; i++) out[i] = base[i] * (1 - frac) + extra[i] * frac;
    return out;
  }
  return base;
}

function ditherFloyd(grid, cols, rows) {
  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < cols; col++) {
      var idx = row * cols + col;
      var oldV = grid[idx];
      var newV = oldV < 128 ? 0 : 255;
      var err = oldV - newV;
      grid[idx] = newV;
      if (col + 1 < cols) grid[idx + 1] += err * 7 / 16;
      if (row + 1 < rows) {
        if (col - 1 >= 0) grid[idx + cols - 1] += err * 3 / 16;
        grid[idx + cols] += err * 5 / 16;
        if (col + 1 < cols) grid[idx + cols + 1] += err * 1 / 16;
      }
    }
  }
}

function ditherOrdered(grid, cols, rows) {
  var bayer = [[0, 2], [3, 1]];
  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < cols; col++) {
      var t = (bayer[row % 2][col % 2] + 0.5) * (255 / 4);
      var idx = row * cols + col;
      grid[idx] = grid[idx] < t ? 0 : 255;
    }
  }
}

// Noise dithering uses an index-seeded pseudo-random so the texture is stable
// across re-renders (Math.random would shimmer on every keystroke / export).
function ditherNoise(grid, cols, rows) {
  for (var i = 0; i < grid.length; i++) {
    var s = Math.sin(i * 12.9898) * 43758.5453;
    var rnd = s - Math.floor(s);              // 0..1, deterministic
    var v = grid[i] + (rnd - 0.5) * 50;
    grid[i] = v < 128 ? 0 : 255;
  }
}

// ── dot geometry → SVG ───────────────────────────────────────────────────────

function dotMarkup(shape, cx, cy, r) {
  cx = f2(cx); cy = f2(cy); r = f2(r);
  if (shape === 'square') {
    var s = f2(r * 1.7724);                    // match a circle's area (√π)
    return '<rect x="' + f2(cx - s / 2) + '" y="' + f2(cy - s / 2) + '" width="' + s + '" height="' + s + '"/>';
  }
  if (shape === 'diamond') {
    var d = f2(r * 1.2533);                     // match a circle's area (√(π/2))
    return '<path d="M' + cx + ' ' + f2(cy - d) + 'L' + f2(cx + d) + ' ' + cy
      + 'L' + cx + ' ' + f2(cy + d) + 'L' + f2(cx - d) + ' ' + cy + 'Z"/>';
  }
  return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>';
}

// ── HSL: luma-preserving hue∘saturation matrices (sRGB .213/.715/.072) + lightness ─
function _mul3(a, b) {
  var o = new Array(9);
  for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++)
    o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
}
function _hueSatMatrix(hueDeg, sat) {
  var h = hueDeg * Math.PI / 180, c = Math.cos(h), s = Math.sin(h);
  var hm = [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
  ];
  var sm = [
    0.213 + 0.787 * sat, 0.715 - 0.715 * sat, 0.072 - 0.072 * sat,
    0.213 - 0.213 * sat, 0.715 + 0.285 * sat, 0.072 - 0.072 * sat,
    0.213 - 0.213 * sat, 0.715 - 0.715 * sat, 0.072 + 0.928 * sat,
  ];
  return _mul3(sm, hm);
}
function hslIdentity(hueDeg, sat, light) { return hueDeg === 0 && sat === 1 && light === 0; }
// Transform the sample's r/g/b in place AND recompute lum from them, so lightness
// affects dot SIZE too. No-op when HSL is at its identity (hue 0 · sat 1 · light 0).
function applyHslSample(sm, hueDeg, sat, light) {
  if (hslIdentity(hueDeg, sat, light)) return;
  var m = _hueSatMatrix(hueDeg, sat), m00=m[0],m01=m[1],m02=m[2],m10=m[3],m11=m[4],m12=m[5],m20=m[6],m21=m[7],m22=m[8];
  for (var i=0;i<sm.lum.length;i++){var R=sm.r[i],G=sm.g[i],B=sm.b[i];var nr=m00*R+m01*G+m02*B,ng=m10*R+m11*G+m12*B,nb=m20*R+m21*G+m22*B;
    if(light>0){nr+=(255-nr)*light;ng+=(255-ng)*light;nb+=(255-nb)*light;}else if(light<0){var k=1+light;nr*=k;ng*=k;nb*=k;}
    R=nr<0?0:nr>255?255:nr;G=ng<0?0:ng>255?255:ng;B=nb<0?0:nb>255?255:nb;sm.r[i]=R;sm.g[i]=G;sm.b[i]=B;sm.lum[i]=0.299*R+0.587*G+0.114*B;}
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
function _hx(v) { v = v < 0 ? 0 : v > 255 ? 255 : Math.round(v); var h = v.toString(16); return h.length < 2 ? '0' + h : h; }
// Reduce a channel to L evenly-spaced levels (L<2 ⇒ untouched / full colour).
function _q(c, L) { return L >= 2 ? Math.round(Math.round(c / 255 * (L - 1)) / (L - 1) * 255) : c; }
// Treatment state parsed once from inputs. ov=null or amt<=0 ⇒ treatment off.
function treatmentFrom(inputs) {
  var ov = _hex2rgb(inputs.treatmentColor);
  var amt = clamp(n(inputs.treatmentIntensity, 20), 0, 100) / 100;
  var mode = typeof inputs.blendMode === 'string' ? inputs.blendMode : 'multiply';
  return { ov: ov, amt: amt, mode: mode, on: !!(ov && amt > 0) };
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
// Blend the treatment colour over a base hex → new hex (or unchanged if off / unparseable).
function treatHex(baseHex, t) {
  if (!t || !t.on) return baseHex;
  var b = _hex2rgb(baseHex); if (!b) return baseHex;
  var Cb = [b.r / 255, b.g / 255, b.b / 255], Cs = [t.ov.r / 255, t.ov.g / 255, t.ov.b / 255];
  var ns = _blendNonSep(t.mode, Cb, Cs), o = [0, 0, 0], i;
  for (i = 0; i < 3; i++) o[i] = Cb[i] * (1 - t.amt) + (ns ? ns[i] : _bl(t.mode, Cb[i], Cs[i])) * t.amt;
  return '#' + _hx(o[0] * 255) + _hx(o[1] * 255) + _hx(o[2] * 255);
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

function buildSvg(args) {
  // No-filter bypass: show the raw source (still image or live camera frame) with the
  // overlay composited on top — "just how it is", plus optional logo / lower-third.
  if (args.noFilter) {
    var bgnf = args.transparent ? null : color(args.bgColor, '#ffffff');
    var onf = svgOpen();
    if (bgnf) onf += '<rect width="' + VIEW + '" height="' + VIEW + '" fill="' + esc(bgnf) + '"/>';
    if (args.rawSrc) onf += '<image href="' + ovEsc(args.rawSrc) + '" x="0" y="0" width="' + VIEW + '" height="' + VIEW + '" preserveAspectRatio="xMidYMid slice"/>';
    onf += buildOverlaySvg(VIEW, VIEW, args._ov || {});
    onf += '</svg>';
    return onf;
  }
  var img = args.img;
  var cell = clamp(n(args.gridSize, 10), 1, 70);
  var fit = args.fit === 'cover' ? 'cover' : 'contain';

  var iw = img.naturalWidth || img.width;
  var ih = img.naturalHeight || img.height;
  var ar = iw / ih;

  // Region the dots occupy inside the square viewBox. 'contain' fits the whole
  // image (letterboxed by the background); 'cover' fills the frame.
  var regionW, regionH;
  if (fit === 'cover') {
    regionW = VIEW; regionH = VIEW;
  } else if (ar >= 1) {
    regionW = VIEW; regionH = VIEW / ar;
  } else {
    regionH = VIEW; regionW = VIEW * ar;
  }

  var cols = Math.max(1, Math.round(regionW / cell));
  var rows = Math.max(1, Math.round(regionH / cell));
  // Clamp total dots so a fine grid on a big region stays bounded.
  if (cols * rows > MAX_CELLS) {
    var k = Math.sqrt(MAX_CELLS / (cols * rows));
    cols = Math.max(1, Math.floor(cols * k));
    rows = Math.max(1, Math.floor(rows * k));
  }

  var sm = sampleGrid(img, cols, rows, fit);
  if (!sm) return null; // headless / tainted — caller falls back to placeholder

  // HSL colour-grade the sampled RGB first; this also recomputes per-cell lum so
  // lightness flows through to dot SIZE. Identity HSL leaves the sample untouched.
  applyHslSample(sm, args.hueDeg, args.sat, args.light);

  var grid = sm.lum; // luminance drives dot size; sm.r/g/b drive dot colour
  applyTone(grid, clamp(n(args.brightness, 0), -100, 100),
    clamp(n(args.contrast, 0), -100, 100), clamp(n(args.gamma, 1), 0.1, 3));

  var smoothing = clamp(n(args.smoothing, 0), 0, 5);
  if (smoothing > 0) grid = boxBlur(grid, cols, rows, smoothing);

  if (args.dither === 'floyd') ditherFloyd(grid, cols, rows);
  else if (args.dither === 'ordered') ditherOrdered(grid, cols, rows);
  else if (args.dither === 'noise') ditherNoise(grid, cols, rows);

  var offX = (VIEW - regionW) / 2;
  var offY = (VIEW - regionH) / 2;
  var cellW = regionW / cols;
  var cellH = regionH / rows;
  var maxR = (Math.min(cellW, cellH) / 2) * clamp(n(args.dotScale, 1), 0.2, 3);
  var invert = Boolean(args.invert);
  var shape = args.shape || 'circle';

  // Colour source + reduction + treatment. Default 'image' tints each dot with the
  // photo pixel under it (optionally reduced to `levels` per channel); 'solid'
  // reproduces the original single-ink halftone.
  var colorSource = args.colorSource === 'solid' ? 'solid' : 'image';
  var levels = parseInt(args.colorLevels, 10) || 0;
  var _t = treatmentFrom(args);
  var solidHex = colorSource === 'solid' ? treatHex(color(args.fgColor, '#0c322c'), _t) : null;

  // Group dots by fill colour: one <g fill> for solid, many for a full-colour photo.
  var groups = {};
  var order = [];
  function push(hex, markup) {
    var arr = groups[hex];
    if (!arr) { arr = groups[hex] = []; order.push(hex); }
    arr.push(markup);
  }

  for (var row = 0; row < rows; row++) {
    for (var col = 0; col < cols; col++) {
      var idx = row * cols + col;
      var norm = clamp(grid[idx] / 255, 0, 1);
      var coverage = invert ? norm : (1 - norm); // dark → big dot (unless inverted)
      var r = maxR * coverage;
      if (r < 0.3) continue;                      // skip invisibly small dots
      var markup = dotMarkup(shape, offX + (col + 0.5) * cellW, offY + (row + 0.5) * cellH, r);
      var hex;
      if (colorSource === 'solid') {
        hex = solidHex;
      } else {
        hex = treatHex('#' + _hx(_q(sm.r[idx], levels)) + _hx(_q(sm.g[idx], levels)) + _hx(_q(sm.b[idx], levels)), _t);
      }
      push(hex, markup);
    }
  }

  var bg = args.transparent ? null : color(args.bgColor, '#ffffff');
  if (bg) bg = treatHex(bg, _t);
  var out = svgOpen();
  if (bg) out += '<rect width="' + VIEW + '" height="' + VIEW + '" fill="' + esc(bg) + '"/>';
  for (var gi = 0; gi < order.length; gi++) {
    out += '<g fill="' + esc(order[gi]) + '">' + groups[order[gi]].join('') + '</g>';
  }
  out += buildOverlaySvg(VIEW, VIEW, args._ov || {});
  out += '</svg>';
  return out;
}

// ── lifecycle ────────────────────────────────────────────────────────────────

async function compute(model) {
  var inputs = inputsFrom(model);
  _transparent = Boolean(inputs.transparentBg);
  // Bake any colour treatment into the remembered bg so beforeExport fills a
  // non-square export's margins with the SAME colour as the SVG's own bg rect
  // (buildSvg treats the bg too) — no seam when a treatment is active. No-op when
  // the treatment is off (treatHex returns the bg unchanged).
  _bgColor = treatHex(color(inputs.bgColor, '#ffffff'), treatmentFrom(inputs));

  // No canvas pixel access (headless CLI/jsdom): skip image loading (its <img>
  // would never resolve) and show the placeholder. This is a browser tool.
  if (!canRaster()) return { svgContent: placeholder('Preview renders in the browser') };

  // Resolve the image URL: the user's pick, else the demo default asset (resolved
  // from storage once, then cached so keystrokes don't re-read it).
  var ref = inputs.image;
  var url = ref && typeof ref === 'object' ? ref.url : null;
  if (!url) {
    if (!_defaultUrl) {
      try {
        // A Lolly tool URL ("…://…") means "render that tool as the image" — go
        // through host.compose; a plain catalog id resolves via host.assets.
        var def = (DEFAULT_IMAGE_ID.indexOf('://') !== -1)
          ? (host.compose && host.compose.renderUrl ? await host.compose.renderUrl(DEFAULT_IMAGE_ID) : null)
          : await host.assets.get(DEFAULT_IMAGE_ID);
        _defaultUrl = def && def.url;
      } catch (e) {
        if (host.log) host.log('warn', 'filter-halftone: default image unavailable', { error: String(e) });
      }
    }
    url = _defaultUrl;
  }
  if (!url) return { svgContent: placeholder('Choose an image to halftone') };

  // Brand overlay — resolve logo + headshot URLs (cached) before building so the
  // still render already carries them.
  var ovi = overlayInputs(inputs);
  if (ovi.showLogo) await resolveLogoUrl(ovi.logoStyle);
  var headUrl = (inputs.ltHeadshot && inputs.ltHeadshot.url) || '';
  if (ovi.lowerThird && !headUrl) headUrl = (await resolveProfileHeadshot()) || '';
  var ov = Object.assign({}, ovi, { logoUrl: cachedLogoUrl(ovi.logoStyle), headshotUrl: headUrl, mode: 'still' });

  // One params object is the single source of truth for both the memo key and the
  // render, so a render-affecting input can't drift out of the memo (and silently
  // cache a stale preview). The overlay fields (via `ov`) + noFilter + rawSrc are in
  // the key so the still preview re-renders on any overlay edit.
  var params = {
    url: url, noFilter: ovi.noFilter, rawSrc: url, ov: ov,
    gridSize: inputs.gridSize, dotScale: inputs.dotScale, shape: inputs.shape,
    fgColor: inputs.fgColor, bgColor: inputs.bgColor, invert: inputs.invert, fit: inputs.fit,
    brightness: inputs.brightness, contrast: inputs.contrast, gamma: inputs.gamma,
    smoothing: inputs.smoothing, dither: inputs.dither, transparent: _transparent,
    colorSource: inputs.colorSource, colorLevels: inputs.colorLevels,
    hueDeg: clamp(n(inputs.hue, 0), -180, 180),
    sat: clamp(n(inputs.saturation, 100), 0, 200) / 100,
    light: clamp(n(inputs.lightness, 0), -100, 100) / 100,
    treatmentColor: inputs.treatmentColor, blendMode: inputs.blendMode,
    treatmentIntensity: inputs.treatmentIntensity,
  };
  var memoKey = JSON.stringify(params);
  params._ov = ov;
  if (memoKey === _memoKey) return _memoResult;

  var svgContent;
  try {
    params.img = await getImage(url);
    svgContent = buildSvg(params);
    if (!svgContent) svgContent = placeholder('Preview renders in the browser');
  } catch (e) {
    if (host.log) host.log('warn', 'filter-halftone: render failed', { error: String(e) });
    svgContent = placeholder('Could not read this image');
  }

  _memoKey = memoKey;
  _memoResult = { svgContent: svgContent };
  return _memoResult;
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }

// Live camera (engine v1.4): when the shell drives a camera, the runtime calls this
// once per frame with raw RGBA pixels. We wrap the frame in a canvas the existing
// buildSvg pipeline can sample exactly like a decoded image — so a live frame goes
// through the SAME tone/blur/dither/dot path as a still, and the dots track motion.
// No memo (every frame is new pixels) and no URL load; degrades to null (no patch,
// last frame stays) on a headless shell or a malformed frame.
function onFrame(ctx) {
  var frame = ctx.frame;
  if (!frame || !frame.data || !frame.width || !frame.height) return null;
  if (!canRaster() || typeof ImageData === 'undefined') return null;
  var inputs = inputsFrom(ctx.model);
  _transparent = Boolean(inputs.transparentBg);
  // Match the still path: bake the treatment into the export-margin bg colour.
  _bgColor = treatHex(color(inputs.bgColor, '#ffffff'), treatmentFrom(inputs));

  var src;
  try {
    src = document.createElement('canvas');
    src.width = frame.width;
    src.height = frame.height;
    var sctx = src.getContext('2d');
    sctx.putImageData(new ImageData(frame.data, frame.width, frame.height), 0, 0);
  } catch (e) { return null; }

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

  var svg = buildSvg({
    img: src, noFilter: ovi.noFilter, rawSrc: ovi.noFilter ? src.toDataURL('image/jpeg', 0.85) : null, _ov: ov,
    gridSize: inputs.gridSize, dotScale: inputs.dotScale, shape: inputs.shape,
    fgColor: inputs.fgColor, bgColor: inputs.bgColor, invert: inputs.invert, fit: inputs.fit,
    brightness: inputs.brightness, contrast: inputs.contrast, gamma: inputs.gamma,
    smoothing: inputs.smoothing, dither: inputs.dither, transparent: _transparent,
    colorSource: inputs.colorSource, colorLevels: inputs.colorLevels,
    hueDeg: clamp(n(inputs.hue, 0), -180, 180),
    sat: clamp(n(inputs.saturation, 100), 0, 200) / 100,
    light: clamp(n(inputs.lightness, 0), -100, 100) / 100,
    treatmentColor: inputs.treatmentColor, blendMode: inputs.blendMode,
    treatmentIntensity: inputs.treatmentIntensity,
  });
  // A live frame supersedes the still memo, so a later still re-render (e.g. after
  // stopping) recomputes rather than returning a stale cached frame.
  _memoKey = null;
  return { svgContent: svg || placeholder('Preview renders in the browser') };
}

function beforeExport(ctx) {
  // Alpha-capable raster formats: for "No BG" clear the canvas so it exports with
  // real transparency (the SVG already omits its background rect); otherwise fill
  // the whole exported frame with the chosen background, so a non-square export
  // has no transparent margins around the square halftone (the SVG's own bg rect
  // only covers its square viewBox). SVG stays transparent / square by design.
  var alpha = ['png', 'webp', 'avif'];
  if (alpha.indexOf(ctx.format) !== -1) {
    ctx.opts.background = _transparent ? 'transparent' : _bgColor;
  }
}
