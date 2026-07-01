/**
 * Scanline Filter — hooks.
 *
 * Same pipeline as the halftone tool (decode image → cols×rows luminance grid →
 * emit an inline <svg> of rects), but the per-cell rule is different: every other
 * line drops out (blank), and the lines that remain posterise the image into FIVE
 * brand tones (highlight / light / mid / shade / shadow), each cell a rect. The
 * SVG-rooted template means a true vector SVG export AND clean PNG/WebP/AVIF with
 * real transparency.
 *
 * Pixel decoding needs a real <canvas> (browser only). In a headless shell
 * (CLI/jsdom) there's no 2D context, so the hook degrades to a placeholder.
 */

var VIEW = 1000;        // viewBox units (square frame; matches render.width/height)
var MAX_CELLS = 100000; // bound the total rect count so a tiny line size can't blow up the SVG
                        // (this is the real floor on detail at very small line sizes, not the input min)
// Default source image until the user picks one: a Lolly tool URL (bag-video → PNG),
// resolved via host.compose. A plain catalog id still works (see resolver below).
var DEFAULT_IMAGE_ID = 'https://lolly.tools/tool/bag-video.png';

var _imgCache = { url: null, promise: null };
var _defaultUrl = null;
var _memoKey = null;
var _memoResult = null;
var _bgTransparent = true; // for beforeExport: is the background empty (transparent)?

// ── helpers ──────────────────────────────────────────────────────────────────

function inputsFrom(model) { var o = {}; model.forEach(function (i) { o[i.id] = i.value; }); return o; }
function n(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function f2(v) { return Math.round(v * 100) / 100; }

// Colours land in raw SVG fill attributes, so validate them (a crafted shared URL
// could otherwise inject). Only hex / rgb(a) / hsl(a) / a few keywords pass.
var COLOUR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$|^(?:rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/;
var COLOUR_WORDS = { transparent: 1, black: 1, white: 1 };
function colour(v, fallback) {
  var s = (typeof v === 'string' ? v : '').trim();
  if (!s) return fallback;
  return (COLOUR_RE.test(s) || COLOUR_WORDS[s.toLowerCase()]) ? s : fallback;
}

function svgOpen() {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" '
    + 'viewBox="0 0 ' + VIEW + ' ' + VIEW + '" preserveAspectRatio="xMidYMid meet">';
}
function placeholder(message) {
  return svgOpen()
    + '<rect width="' + VIEW + '" height="' + VIEW + '" fill="#f4f4f5"/>'
    + '<text x="' + (VIEW / 2) + '" y="' + (VIEW / 2) + '" text-anchor="middle" '
    + 'dominant-baseline="middle" font-family="sans-serif" font-size="34" fill="#9ca3af">'
    + message + '</text></svg>';
}

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
  if (_imgCache.url === url && _imgCache.promise) return _imgCache.promise;
  var promise = loadImage(url);
  _imgCache = { url: url, promise: promise };
  promise.catch(function () { if (_imgCache.url === url) _imgCache = { url: null, promise: null }; });
  return promise;
}

// ── HSL colour grade (operates on the small grid canvas, before getImageData) ──
function _mul3(a,b){var o=new Array(9);for(var r=0;r<3;r++)for(var c=0;c<3;c++)o[r*3+c]=a[r*3]*b[c]+a[r*3+1]*b[3+c]+a[r*3+2]*b[6+c];return o;}
function _hueSatMatrix(hueDeg,sat){var h=hueDeg*Math.PI/180,c=Math.cos(h),s=Math.sin(h);var hm=[0.213+c*0.787-s*0.213,0.715-c*0.715-s*0.715,0.072-c*0.072+s*0.928,0.213-c*0.213+s*0.143,0.715+c*0.285+s*0.140,0.072-c*0.072-s*0.283,0.213-c*0.213-s*0.787,0.715-c*0.715+s*0.715,0.072+c*0.928+s*0.072];var sm=[0.213+0.787*sat,0.715-0.715*sat,0.072-0.072*sat,0.213-0.213*sat,0.715+0.285*sat,0.072-0.072*sat,0.213-0.213*sat,0.715-0.715*sat,0.072+0.928*sat];return _mul3(sm,hm);}
function applyHslCtx(ctx,W,H,hueDeg,sat,light){if(hueDeg===0&&sat===1&&light===0)return;var img;try{img=ctx.getImageData(0,0,W,H);}catch(e){return;}var d=img.data,m=_hueSatMatrix(hueDeg,sat),m00=m[0],m01=m[1],m02=m[2],m10=m[3],m11=m[4],m12=m[5],m20=m[6],m21=m[7],m22=m[8];for(var i=0;i<d.length;i+=4){var r=d[i],g=d[i+1],b=d[i+2];var nr=m00*r+m01*g+m02*b,ng=m10*r+m11*g+m12*b,nb=m20*r+m21*g+m22*b;if(light>0){nr+=(255-nr)*light;ng+=(255-ng)*light;nb+=(255-nb)*light;}else if(light<0){var k=1+light;nr*=k;ng*=k;nb*=k;}d[i]=nr<0?0:nr>255?255:nr;d[i+1]=ng<0?0:ng>255?255:ng;d[i+2]=nb<0?0:nb>255?255:nb;}ctx.putImageData(img,0,0);}

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

// Downsample to a cols×rows grid of luminance (0..255). null on headless/tainted.
function sampleGrid(img, cols, rows, fit, hueDeg, sat, light) {
  if (typeof document === 'undefined') return null;
  var c = document.createElement('canvas');
  c.width = cols; c.height = rows;
  var ctx = c.getContext && c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
  var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;
  if (fit === 'cover') {
    var s = Math.max(cols / iw, rows / ih), dw = iw * s, dh = ih * s;
    ctx.drawImage(img, (cols - dw) / 2, (rows - dh) / 2, dw, dh);
  } else {
    ctx.drawImage(img, 0, 0, cols, rows);
  }
  applyHslCtx(ctx, cols, rows, hueDeg, sat, light); // HSL grade before luminance read
  var data;
  try { data = ctx.getImageData(0, 0, cols, rows).data; } catch (e) { return null; }
  var g = new Float32Array(cols * rows);
  for (var i = 0, p = 0; i < g.length; i++, p += 4) {
    var a = data[p + 3] / 255;
    var lum = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    if (a < 1) lum = lum * a + 255 * (1 - a); // composite transparency onto white
    g[i] = lum;
  }
  return g;
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

// ── render ───────────────────────────────────────────────────────────────────

function buildSvg(args) {
  // No-filter bypass: show the raw source (still image or live camera frame) with the
  // overlay composited on top — "just how it is", plus optional logo / lower-third.
  if (args.noFilter) {
    var bgnf = _bgTransparent ? null : colour(args.background, '');
    var onf = svgOpen();
    if (bgnf) onf += '<rect width="' + VIEW + '" height="' + VIEW + '" fill="' + bgnf + '"/>';
    if (args.rawSrc) onf += '<image href="' + ovEsc(args.rawSrc) + '" x="0" y="0" width="' + VIEW + '" height="' + VIEW + '" preserveAspectRatio="xMidYMid slice"/>';
    onf += buildOverlaySvg(VIEW, VIEW, args._ov || {});
    onf += '</svg>';
    return onf;
  }
  var img = args.img;
  var vis = clamp(n(args.lineSize, 4), 1, 48);       // line height = cell size (square cells)
  var everyLine = Boolean(args.everyLine);
  var gap = everyLine ? 0 : clamp(n(args.gapSize, 4), 0, 48); // blank gap below each line
  var fit = args.fit === 'cover' ? 'cover' : 'contain';

  // HSL colour grade — normalized so defaults (hue 0 / sat 100 / lightness 0) are a no-op.
  var hueDeg = clamp(n(args.hue, 0), -180, 180);
  var sat = clamp(n(args.saturation, 100), 0, 200) / 100;
  var light = clamp(n(args.lightness, 0), -100, 100) / 100;

  var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  var ar = iw / ih;
  var regionW, regionH;
  if (fit === 'cover') { regionW = VIEW; regionH = VIEW; }
  else if (ar >= 1) { regionW = VIEW; regionH = VIEW / ar; }
  else { regionH = VIEW; regionW = VIEW * ar; }

  // Grid resolution depends only on the line size, never the gap — so changing the
  // gap re-thins the lines without re-sampling, and the image can't stretch or jump.
  var cols = Math.max(1, Math.round(regionW / vis));
  var rows = Math.max(1, Math.round(regionH / vis));
  if (cols * rows > MAX_CELLS) {
    var k = Math.sqrt(MAX_CELLS / (cols * rows));
    cols = Math.max(1, Math.floor(cols * k));
    rows = Math.max(1, Math.floor(rows * k));
  }

  var grid = sampleGrid(img, cols, rows, fit, hueDeg, sat, light);
  if (!grid) return null;

  // Tone bucketing on brightness/contrast-adjusted luminance → 5 brand tones.
  var brightness = clamp(n(args.brightness, 0), -100, 100);
  var contrast = clamp(n(args.contrast, 0), -100, 100);
  var cf = (259 * (contrast + 255)) / (255 * (259 - contrast));
  var fills = [
    colour(args.shadow, '#000000'),   // 0  darkest
    colour(args.shade, '#01564a'),    // 1
    colour(args.mid, '#008878'),      // 2
    colour(args.light, '#bff1ea'),    // 3
    colour(args.highlight, '#ffffff'),// 4  brightest
  ];
  // Colour treatment: blend the chosen colour over every brand tone (no-op when empty).
  var _t = treatmentFrom(args);
  for (var fi = 0; fi < fills.length; fi++) fills[fi] = treatHex(fills[fi], _t);
  function bucket(lum) {
    var v = clamp(cf * (lum - 128) + 128 + brightness, 0, 255);
    return v >= 204 ? 4 : v >= 153 ? 3 : v >= 102 ? 2 : v >= 51 ? 1 : 0;
  }

  var offX = (VIEW - regionW) / 2, offY = (VIEW - regionH) / 2;
  var cellW = regionW / cols, cellH = regionH / rows;
  // Each cell paints a band at its top; the blank remainder below is the scanline
  // gap. The band is the line's "on" fraction vis/(vis+gap) of the fixed cell, so a
  // bigger gap only thins the band — it never changes the grid. gap 0 → solid image.
  var bandH = cellH * (vis / (vis + gap));
  // "Separate pixels" insets each cell so it reads as a distinct square; otherwise
  // cells butt together horizontally (the blank strip below each band is the scanline gap).
  var gx = args.separatePixels ? cellW * 0.16 : 0;
  var gy = args.separatePixels ? bandH * 0.16 : 0;
  var rw = f2(cellW - gx), rh = f2(bandH - gy);

  var paths = ['', '', '', '', ''];
  for (var row = 0; row < rows; row++) {
    var y = f2(offY + row * cellH + gy / 2); // band sits at the top of its cell; gap follows below
    for (var col = 0; col < cols; col++) {
      var b = bucket(grid[row * cols + col]);
      var x = f2(offX + col * cellW + gx / 2);
      paths[b] += 'M' + x + ' ' + y + 'h' + rw + 'v' + rh + 'h-' + rw + 'z';
    }
  }

  var bg = _bgTransparent ? null : colour(args.background, '');
  bg = bg ? treatHex(bg, _t) : bg; // treatment also tints the background fill
  var out = svgOpen();
  if (bg) out += '<rect width="' + VIEW + '" height="' + VIEW + '" fill="' + bg + '"/>';
  for (var t = 0; t < 5; t++) if (paths[t]) out += '<path fill="' + fills[t] + '" d="' + paths[t] + '"/>';
  out += buildOverlaySvg(VIEW, VIEW, args._ov || {});
  out += '</svg>';
  return out;
}

// ── lifecycle ────────────────────────────────────────────────────────────────

async function compute(model) {
  var inputs = inputsFrom(model);
  _bgTransparent = !colour(inputs.background, ''); // empty/invalid → transparent

  if (!canRaster()) return { svgContent: placeholder('Preview renders in the browser') };

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
      catch (e) { if (host.log) host.log('warn', 'filter-scanline: default image unavailable', { error: String(e) }); }
    }
    url = _defaultUrl;
  }
  if (!url) return { svgContent: placeholder('Choose an image to scan') };

  // Brand overlay — resolve logo + headshot URLs (cached) before building so the
  // still render already carries them.
  var ovi = overlayInputs(inputs);
  if (ovi.showLogo) await resolveLogoUrl(ovi.logoStyle);
  var headUrl = (inputs.ltHeadshot && inputs.ltHeadshot.url) || '';
  if (ovi.lowerThird && !headUrl) headUrl = (await resolveProfileHeadshot()) || '';
  var ov = Object.assign({}, ovi, { logoUrl: cachedLogoUrl(ovi.logoStyle), headshotUrl: headUrl, mode: 'still' });

  var params = {
    url: url, noFilter: ovi.noFilter, rawSrc: url, ov: ov,
    lineSize: inputs.lineSize, gapSize: inputs.gapSize, separatePixels: inputs.separatePixels, everyLine: inputs.everyLine, fit: inputs.fit,
    highlight: inputs.highlight, light: inputs.light, mid: inputs.mid, shade: inputs.shade,
    shadow: inputs.shadow, background: inputs.background, brightness: inputs.brightness, contrast: inputs.contrast,
    hue: inputs.hue, saturation: inputs.saturation, lightness: inputs.lightness,
    treatmentColor: inputs.treatmentColor, blendMode: inputs.blendMode, treatmentIntensity: inputs.treatmentIntensity,
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
    if (host.log) host.log('warn', 'filter-scanline: render failed', { error: String(e) });
    svgContent = placeholder('Could not read this image');
  }

  _memoKey = memoKey;
  _memoResult = { svgContent: svgContent };
  return _memoResult;
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }

// Live camera (engine v1.4): the runtime calls this once per frame with raw RGBA
// pixels. Wrap the frame in a canvas the existing buildSvg pipeline samples like a
// decoded image, so a live frame runs the SAME tone-bucket + scanline path and the
// bands track motion. No URL load, no memo (every frame is new). null = no patch.
function onFrame(ctx) {
  var frame = ctx.frame;
  if (!frame || !frame.data || !frame.width || !frame.height) return null;
  if (!canRaster() || typeof ImageData === 'undefined') return null;
  var inputs = inputsFrom(ctx.model);
  _bgTransparent = !colour(inputs.background, '');
  var src;
  try {
    src = document.createElement('canvas');
    src.width = frame.width; src.height = frame.height;
    src.getContext('2d').putImageData(new ImageData(frame.data, frame.width, frame.height), 0, 0);
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
    lineSize: inputs.lineSize, gapSize: inputs.gapSize, separatePixels: inputs.separatePixels,
    everyLine: inputs.everyLine, fit: inputs.fit, highlight: inputs.highlight, light: inputs.light,
    mid: inputs.mid, shade: inputs.shade, shadow: inputs.shadow, background: inputs.background,
    brightness: inputs.brightness, contrast: inputs.contrast,
    hue: inputs.hue, saturation: inputs.saturation, lightness: inputs.lightness,
    treatmentColor: inputs.treatmentColor, blendMode: inputs.blendMode, treatmentIntensity: inputs.treatmentIntensity,
  });
  _memoKey = null; // a live frame supersedes the still memo
  return { svgContent: svg || placeholder('Preview renders in the browser') };
}

function beforeExport(ctx) {
  // Alpha-capable rasters: when the background is empty, export with real
  // transparency (the SVG has no background rect). SVG is transparent by construction.
  var alpha = ['png', 'webp', 'avif'];
  if (_bgTransparent && alpha.indexOf(ctx.format) !== -1) ctx.opts.background = 'transparent';
}
