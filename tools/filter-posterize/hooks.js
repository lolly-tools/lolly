/* global onInit, onInput, onFrame, beforeExport, host */

/**
 * Filter: Posterize Bitmap — trace a photo into flat vector colour separations.
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
 * Demo image: shares the same default as the sibling filters (filter-duotone/
 * -halftone/-scanline) — the bag-video render — so every filter opens on the same
 * graphic. Note posterize splits LUMINANCE into bands and fills each with its
 * band's mean colour, so a tonally flat source (the Geeko on a solid dark-green
 * field) separates into fewer, closer tones than a photo would; high-contrast
 * PHOTOS (cf. tool.json: "Headshots and high-contrast photos trace best") still
 * give the richest separations.
 */

// A Lolly tool URL (bag-video → PNG), resolved via host.compose.renderUrl — matches
// the sibling filters so every filter opens on the same demo graphic. A plain
// catalog id still works (resolveDefault branches on '://').
var DEFAULT_IMAGE_ID = 'https://lolly.tools/tool/bag-video.png';
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

// Apply HSL (hue rotate ∘ saturation ∘ lightness) to a sample grid → a NEW grid.
// Mirrors applyTone: recomputes luminance so a lightness shift moves which band a
// pixel lands in (and the auto-sampled separation colours follow). Built fresh — the
// decoded sample cache stays the raw photo.
function applyHslGrid(g, hueDeg, sat, light) {
  var m = _hueSatMatrix(hueDeg, sat);
  var m00=m[0],m01=m[1],m02=m[2],m10=m[3],m11=m[4],m12=m[5],m20=m[6],m21=m[7],m22=m[8];
  var nn = g.lum.length, r=new Uint8Array(nn), gg=new Uint8Array(nn), b=new Uint8Array(nn), lum=new Uint8Array(nn);
  for (var i=0;i<nn;i++){var R=g.r[i],G=g.g[i],B=g.b[i];var nr=m00*R+m01*G+m02*B,ng=m10*R+m11*G+m12*B,nb=m20*R+m21*G+m22*B;
    if(light>0){nr+=(255-nr)*light;ng+=(255-ng)*light;nb+=(255-nb)*light;}else if(light<0){var k=1+light;nr*=k;ng*=k;nb*=k;}
    R=nr<0?0:nr>255?255:nr;G=ng<0?0:ng>255?255:ng;B=nb<0?0:nb>255?255:nb;r[i]=R;gg[i]=G;b[i]=B;lum[i]=(0.299*R+0.587*G+0.114*B)|0;}
  return { lum:lum, alpha:g.alpha, r:r, g:gg, b:b, cols:g.cols, rows:g.rows };
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
// Treatment state parsed once from inputs. ov=null or amt<=0 ⇒ treatment off.
function treatmentFrom(inputs) {
  var ov = _hex2rgb(inputs.treatmentColor);
  var amt = clamp(num(inputs.treatmentIntensity, 20), 0, 100) / 100;
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

// ── posterize: thresholds + per-band mean colour ──────────────────────────────

// Split luminance into `steps` bands by HISTOGRAM QUANTILE (equal opaque-pixel
// count per band), so tonal regions with more information get more separations —
// faces posterize far better this way than with evenly-spaced cut-offs. Returns
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
function buildPoster(url, img, W, H, grid, thr, palette, ov, rawSrc) {
  // No-filter bypass: show the raw source (still photo or live camera frame) with the
  // brand overlay composited on top — skip the trace/separations entirely.
  if (ov && ov.noFilter) {
    var paperNf = palette[palette.length - 1];
    _paper = paperNf;
    var onf = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" '
      + 'width="' + W + '" height="' + H + '" style="width:100%;height:auto;display:block;">';
    if (!_transparent) onf += '<rect width="100%" height="100%" fill="' + esc(paperNf) + '"/>';
    if (rawSrc) onf += '<image href="' + esc(rawSrc) + '" x="0" y="0" width="' + W + '" height="' + H + '" preserveAspectRatio="xMidYMid slice"/>';
    onf += buildOverlaySvg(W, H, ov);
    onf += '</svg>';
    return onf;
  }
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
  // Brand overlay (SUSE logo / lower-third) — emitted as SVG children between the
  // separations and the close so it survives raster + video + vector export.
  out += '</g>' + buildOverlaySvg(W, H, ov || {}) + '</svg>';
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
  var hueDeg = clamp(num(inputs.hue, 0), -180, 180);
  var sat = clamp(num(inputs.saturation, 100), 0, 200) / 100;
  var light = clamp(num(inputs.lightness, 0), -100, 100) / 100;
  // Threshold mode collapses the posterize to ONE ink over paper (2 tones) at a MANUAL
  // cut instead of the auto quantile bands — so `steps` is overridden to 2, and the cut
  // level joins the tone signature so moving it reseeds swatches + busts caches like a
  // re-tone. `steps` is hidden in this mode (tool.json showIf) but kept for toggling back.
  var threshold = Boolean(inputs.threshold);
  var thresholdLevel = clamp(Math.round(num(inputs.thresholdLevel, 50)), 1, 99);
  var effSteps = threshold ? 2 : steps;
  var toneKey = brightness + ',' + contrast + (threshold ? '|t' + thresholdLevel : '') + '|h' + hueDeg + 's' + sat + 'l' + light;
  var W = clamp(Math.round(num(inputs.width, 1080)), 1, 8000);
  var H = clamp(Math.round(num(inputs.height, 1080)), 1, 8000);

  // Resolve the photo: the user's pick, else the shared demo image.
  var ref = inputs.photo;
  var url = (ref && ref.url) ? ref.url : await resolveDefault();
  if (!url) return { posterSvg: placeholder('Pick a photo to posterize.') };

  if (!canRaster()) return { posterSvg: placeholder('Posterize renders in the browser.') };

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
  // HSL: hue rotate / saturation / lightness on the toned grid. No-op at defaults
  // (hue 0, sat 100, light 0) so a freshly-loaded tool is byte-identical to before.
  var gCol = hslIdentity(hueDeg, sat, light) ? gTone : applyHslGrid(gTone, hueDeg, sat, light);

  // Invert tones: trace from a negative of the (toned) luminance, so its bright
  // regions become the foreground separations. RGB is untouched (separations keep
  // their real photo colours), so it only reorders which tones group/stack. Built
  // fresh rather than mutating the cached sample grid.
  var gEff = gCol;
  if (invert) {
    var iv = new Uint8Array(gCol.lum.length);
    for (var ii = 0; ii < iv.length; ii++) iv[ii] = 255 - gCol.lum[ii];
    gEff = { lum: iv, alpha: gCol.alpha, r: gCol.r, g: gCol.g, b: gCol.b, cols: gCol.cols, rows: gCol.rows };
  }

  // In threshold mode the single interior cut is the user's level (lum < cut → ink),
  // clamped to [1,254] like the quantile invariant so neither ink nor paper is empty.
  var thr = threshold
    ? [clamp(Math.round(thresholdLevel / 100 * 255), 1, 254)]
    : quantileThresholds(gEff, effSteps);
  var auto = autoPalette(gEff, thr, effSteps);

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
  var stepsChanged = _prevSteps !== null && _prevSteps !== effSteps;   // incl. entering/leaving threshold
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
    for (var pi = 0; pi < effSteps; pi++) palette.push(color(blocks[pi] && blocks[pi].color, auto[pi]));
    if (blocks.length !== effSteps) patch.colors = palette.map(function (c) { return { color: c }; }); // re-pin count, keep edits
  }
  _seedUrl = url;
  _prevSteps = effSteps;

  var grid = { g: gEff, cols: g.cols, rows: g.rows, tp: tp, invert: invert, tone: toneKey };

  // Colour treatment: blend a colour over the OUTPUT separations + paper, non-
  // destructively — the stored `colors` swatches stay the true sampled colours, so
  // editing/reseeding still shows them. Off ⇒ paletteEff === palette (a no-op).
  var _t = treatmentFrom(inputs);
  var paletteEff = _t.on ? palette.map(function (c) { return treatHex(c, _t); }) : palette;

  // Brand overlay — resolve the logo + headshot URLs (cached) before building so the
  // still render already carries them. mode:'still' → the intro is settled (progress=1).
  var ovi = overlayInputs(inputs);
  if (ovi.showLogo) await resolveLogoUrl(ovi.logoStyle);
  var headUrl = (inputs.ltHeadshot && inputs.ltHeadshot.url) || '';
  if (ovi.lowerThird && !headUrl) headUrl = (await resolveProfileHeadshot()) || '';
  var ov = Object.assign({}, ovi, { logoUrl: cachedLogoUrl(ovi.logoStyle), headshotUrl: headUrl, mode: 'still' });

  // Memoise the SVG on everything that changes the pixels — palette, steps, size,
  // quality, tone, transparency, photo, treatment, overlay (+ no-filter) — so dragging an
  // unrelated control is cheap. `ov` carries the overlay inputs + noFilter + resolved URLs.
  var memoKey = JSON.stringify({ url: url, steps: effSteps, thr: thr.join(','), q: inputs.quality, sm: inputs.smoothing, inv: invert, tone: toneKey, W: W, H: H, t: _transparent, pal: palette, tc: (_t.on ? _t.ov : null), tm: _t.mode, ti: _t.amt, ov: ov });
  if (memoKey === _memoKey) { patch.posterSvg = _memoResult; return patch; }

  var svg;
  try { svg = buildPoster(url, img, W, H, grid, thr, paletteEff, ov, url); }
  catch (e) {
    if (host.log) host.log('warn', 'filter-posterize: build failed', { error: String(e) });
    svg = placeholder('Could not posterize this photo.');
  }
  _memoKey = memoKey; _memoResult = svg;
  patch.posterSvg = svg;
  return patch;
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }

// ── live camera (engine v1.4) ──────────────────────────────────────────────────

// Decode a live RGBA frame into the {lum,alpha,r,g,b,cols,rows} grid the tracer
// wants — downscaled to `maxDetail` longest edge (no URL cache; every frame is new).
function gridFromFrame(frame, maxDetail) {
  var fw = frame.width, fh = frame.height;
  var scale = Math.min(1, maxDetail / Math.max(fw, fh));
  var cols = Math.max(1, Math.round(fw * scale)), rows = Math.max(1, Math.round(fh * scale));
  var src = document.createElement('canvas'); src.width = fw; src.height = fh;
  src.getContext('2d').putImageData(new ImageData(frame.data, fw, fh), 0, 0);
  var c = document.createElement('canvas'); c.width = cols; c.height = rows;
  var ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(src, 0, 0, cols, rows);
  var data = ctx.getImageData(0, 0, cols, rows).data;
  var n = cols * rows;
  var lum = new Uint8Array(n), alpha = new Uint8Array(n), r = new Uint8Array(n), g = new Uint8Array(n), b = new Uint8Array(n);
  for (var i = 0, p = 0; i < n; i++, p += 4) {
    r[i] = data[p]; g[i] = data[p + 1]; b[i] = data[p + 2];
    lum[i] = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) | 0;
    alpha[i] = data[p + 3];
  }
  return { lum: lum, alpha: alpha, r: r, g: g, b: b, cols: cols, rows: rows };
}

// Live trace resolution scales with BOTH the Quality slider (via tp.detail) and the band
// count. Each separation is one marching-squares pass, so cost ≈ passes · cells: a 1-band
// threshold / low colour-step trace has spare per-frame budget and can run at a far finer
// grid than a 12-band one. factor ≈ 1.4/√passes (clamped 0.5…1) keeps the default 8-band
// trace near the old ~180 while letting threshold reach the photo's full Quality detail.
// This is the heaviest of the live filters (real-time vector tracing); the runtime drops
// overlapping frames, so a high Quality on a dense trace just lowers fps — motion over
// fidelity — rather than piling up. LIVE_MAX bounds the pathological (single-pass, max-Q)
// end so one frame can't take seconds (onFrame is not time-boxed).
var LIVE_MIN = 130, LIVE_MAX = 600;
function liveDetailFor(tp, passes) {
  var factor = clamp(1.4 / Math.sqrt(Math.max(1, passes)), 0.5, 1);
  return clamp(Math.round(tp.detail * factor), LIVE_MIN, LIVE_MAX);
}

function onFrame(ctx) {
  var frame = ctx.frame;
  if (!frame || !frame.data || !frame.width || !frame.height) return null;
  if (!canRaster() || typeof ImageData === 'undefined') return null;
  var inputs = inputsFrom(ctx.model);
  _transparent = Boolean(inputs.transparentBg);
  var steps = clamp(Math.round(num(inputs.steps, 8)), 2, 12);
  var invert = Boolean(inputs.invert);
  var brightness = clamp(Math.round(num(inputs.brightness, 0)), -100, 100);
  var contrast = clamp(Math.round(num(inputs.contrast, 0)), -100, 100);
  var hueDeg = clamp(num(inputs.hue, 0), -180, 180);
  var sat = clamp(num(inputs.saturation, 100), 0, 200) / 100;
  var light = clamp(num(inputs.lightness, 0), -100, 100) / 100;
  var threshold = Boolean(inputs.threshold);
  var thresholdLevel = clamp(Math.round(num(inputs.thresholdLevel, 50)), 1, 99);
  var effSteps = threshold ? 2 : steps;
  var toneKey = brightness + ',' + contrast + (threshold ? '|t' + thresholdLevel : '') + '|h' + hueDeg + 's' + sat + 'l' + light;
  var W = clamp(Math.round(num(inputs.width, 1080)), 1, 8000);
  var H = clamp(Math.round(num(inputs.height, 1080)), 1, 8000);

  // Quality (+ smoothing) up front so it can size the live grid, not just the curve fit.
  // Fewer bands → fewer trace passes → a finer grid fits the frame budget (esp. threshold).
  var tp = traceParams(inputs.quality, inputs.smoothing);
  var g;
  try { g = gridFromFrame(frame, liveDetailFor(tp, effSteps - 1)); } catch (e) { return null; }

  var gTone = (brightness || contrast) ? applyTone(g, toneLUT(brightness, contrast)) : g;
  // HSL: hue rotate / saturation / lightness on the toned grid. No-op at defaults
  // (hue 0, sat 100, light 0) so a freshly-loaded tool is byte-identical to before.
  var gCol = hslIdentity(hueDeg, sat, light) ? gTone : applyHslGrid(gTone, hueDeg, sat, light);
  var gEff = gCol;
  if (invert) {
    var iv = new Uint8Array(gCol.lum.length);
    for (var ii = 0; ii < iv.length; ii++) iv[ii] = 255 - gCol.lum[ii];
    gEff = { lum: iv, alpha: gCol.alpha, r: gCol.r, g: gCol.g, b: gCol.b, cols: gCol.cols, rows: gCol.rows };
  }
  var thr = threshold
    ? [clamp(Math.round(thresholdLevel / 100 * 255), 1, 254)]
    : quantileThresholds(gEff, effSteps);

  // FREEZE the palette: use the user's current swatches; derive from THIS frame only
  // for any swatch not yet set. NEVER patch `colors` — reseeding the auto palette every
  // frame would make the poster's colours shimmer and churn the swatch UI ~30×/sec.
  var blocks = Array.isArray(inputs.colors) ? inputs.colors : [];
  var auto = null, palette = [];
  for (var pi = 0; pi < effSteps; pi++) {
    var bc = color(blocks[pi] && blocks[pi].color, '');
    if (bc) palette.push(bc);
    else { if (!auto) auto = autoPalette(gEff, thr, effSteps); palette.push(auto[pi]); }
  }

  var grid = { g: gEff, cols: g.cols, rows: g.rows, tp: tp, invert: invert, tone: toneKey };
  // Colour treatment over the live output, identical to the still path.
  var _t = treatmentFrom(inputs);
  var paletteEff = _t.on ? palette.map(function (c) { return treatHex(c, _t); }) : palette;

  // Brand overlay (live): warm caches without awaiting; drive the intro from camera time
  // (elapsed since the overlay first became active). Frame drops keep it self-throttling.
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
  // No-filter: composite the overlay over the raw camera frame (JPEG data URL) instead
  // of the traced separations.
  var rawSrc = null;
  if (ovi.noFilter) {
    try {
      var fc = document.createElement('canvas'); fc.width = frame.width; fc.height = frame.height;
      fc.getContext('2d').putImageData(new ImageData(frame.data, frame.width, frame.height), 0, 0);
      rawSrc = fc.toDataURL('image/jpeg', 0.85);
    } catch (e) { rawSrc = null; }
  }

  var svg;
  // A unique per-frame url makes the geometry _bandCache never hit (every frame
  // retraces) and busts the still-path memo, so stopping live re-renders the still cleanly.
  try { svg = buildPoster('live:' + frame.t, null, W, H, grid, thr, paletteEff, ov, rawSrc); }
  catch (e) { return null; }
  _memoKey = null;
  return { posterSvg: svg };
}

function beforeExport(ctx) {
  // Raster formats: honour "No background" for alpha-capable formats, else flat the
  // paper colour so a non-matching export aspect has no transparent margins. (SVG/PDF
  // keep their own paper rect / transparency from the markup.)
  var alpha = ['png', 'webp'];
  if (alpha.indexOf(ctx.format) !== -1) ctx.opts.background = _transparent ? 'transparent' : _paper;
  else if (ctx.format === 'jpg' || ctx.format === 'jpeg') ctx.opts.background = _paper;
}
