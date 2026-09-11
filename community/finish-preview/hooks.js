/**
 * Finish Preview - hooks.
 *
 * Simulates physical print finishes (foil, spot UV, emboss/deboss, soft-touch
 * matte) over the user's artwork, and - the actual deliverable - exports the
 * finish MASK PLATE as pure black shapes on white for the print house.
 *
 * The whole scene is emitted as one inline <svg> (extra `finishSvg`) so exports
 * take the verbatim SVG fast path: the artwork stays an <image> at native
 * resolution, the finish materials are real SVG gradients/filters, and the
 * plate view is a filter-free black-on-white raster inside the SVG (PDF-safe).
 *
 * The finish mask is computed per-pixel in OKLab - lightness thresholds use
 * OKLab L and the by-colour mode uses OKLab distance, never naive sRGB - via
 * the self-contained colour port below (Björn Ottosson's reference matrices).
 * Metallic foil ramps are interpolated in OKLab too; the holographic foil is
 * an OKLCH hue sweep.
 *
 * Pixel decoding needs a real <canvas> (browser only). In a headless shell
 * (CLI/jsdom) there's no 2D context, so the hook degrades to a friendly
 * placeholder instead of throwing - this is a browser-rendered tool.
 *
 * Deterministic by construction: no unseeded randomness anywhere (the grain
 * uses a fixed feTurbulence seed; the sheen is a fixed-period loop that stills
 * to its centred pose for stills / reduced motion).
 */

/* global onInit, onInput, beforeExport, host */

// DEFAULT viewBox edge when the tool has no explicit size yet (a square frame
// matching render.width/height). Once an image is picked, the auto-fit <script> in
// template.html snaps the export Width/Height to the artwork's native size, so the
// canvas takes the photo's own aspect ratio - dimW/dimH read those inputs, and the
// whole scene is emitted at W×H rather than the old fixed 1000² square.
var VIEW = 1000;
var MAX_EDGE = 8000;                 // matches the auto-fit cap in template.html + the width/height input max
var _lastW = VIEW, _lastH = VIEW;    // most recent canvas size - read by setSheenPhase (export sweep range)
// The default source image shown until the user picks one (a Lolly tool URL,
// resolved lazily via host.compose - same convention as the other filter tools).
var DEFAULT_IMAGE_ID = 'lolly/demo/lolly-spin';

// Decoded-image cache (keyed by URL); holds the in-flight PROMISE so re-renders
// during the first decode share one load.
var _imgCache = { url: null, promise: null };
var _defaultUrl = null;
// One-entry memo of the last rendered SVG, keyed on every input that affects it.
var _memoKey = null;
var _memoResult = null;
// Separate, narrower memo for the EXPENSIVE half: the per-pixel OKLab mask
// rasterisation + its two PNG encodes, keyed only on the inputs computeMasks
// actually reads. Everything else is string assembly.
var _maskKey = null;
var _maskVal = null;
// Long-edge cap for the mask/plate raster grid (px). See the comment at its use.
var MASK_LONG_EDGE = 2048;
// Remembered for beforeExport (which only gets format/opts): the export-margin fill.
var _bgColor = '#ffffff';

// ── small helpers ────────────────────────────────────────────────────────────

function inputsFrom(model) {
  var o = {};
  model.forEach(function (i) { o[i.id] = i.value; });
  return o;
}
function n(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
// === lolly:shared clamp - generated from community/_shared/math.js; edit there and run npm run sync:shared ===
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
// === /lolly:shared clamp ===
function f2(v) { return Math.round(v * 100) / 100; }
// FNV-1a → base36. Derives a CONTENT-DERIVED prefix for every SVG def id this
// tool emits: two instances mounted in ONE document (the /multi view, a composed
// board, "render everything") must not resolve url(#…) to whichever defs happen
// to sit first in document order - here the mask IS the deliverable, so a
// cross-wired mask means approving a plate that belongs to different artwork.
// Content-derived rather than a counter: each mount gets its own hooks module
// scope, so a per-module counter would restart at 1 and collide anyway. Equal
// content ⇒ equal prefix ⇒ identical defs, which is harmless, and the SVG stays
// byte-stable for identical inputs.
function hash32(s) {
  var h = 2166136261;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
// === lolly:shared esc - generated from community/_shared/text.js; edit there and run npm run sync:shared ===
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// === /lolly:shared esc ===

// A valid CSS colour string, or a fallback. Keeps stray input out of the SVG.
function color(v, fallback) {
  var s = (typeof v === 'string' ? v : '').trim();
  return s ? s : fallback;
}

// The canvas size, in viewBox units, from the export-group width/height inputs. Both
// default to VIEW so a fresh mount (before any image) is the old 1000² square.
function dimW(inputs) { return clamp(Math.round(n(inputs.width, VIEW)), 1, MAX_EDGE); }
function dimH(inputs) { return clamp(Math.round(n(inputs.height, VIEW)), 1, MAX_EDGE); }

// `extra` carries the auto-fit anchor attributes (data-img-key etc.) onto the root
// <svg> - the template.html <script> reads them. Stamped on the root (not a child)
// so the single-root-<svg> CLI vector path is preserved, exactly like filter-imperfections.
function svgOpen(W, H, extra) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" '
    + 'viewBox="0 0 ' + W + ' ' + H + '" '
    + 'preserveAspectRatio="xMidYMid meet"' + (extra || '') + '>';
}

function placeholder(message, W, H) {
  W = W || VIEW; H = H || VIEW;
  return svgOpen(W, H)
    + '<rect width="' + W + '" height="' + H + '" fill="#f4f4f5"/>'
    + '<text x="' + (W / 2) + '" y="' + (H / 2) + '" text-anchor="middle" '
    + 'dominant-baseline="middle" font-family="sans-serif" font-size="34" '
    + 'fill="#9ca3af">' + esc(message) + '</text>'
    + '</svg>';
}

// ── image decoding ───────────────────────────────────────────────────────────

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

// === lolly:shared canRaster - generated from community/_shared/raster.js; edit there and run npm run sync:shared ===
function canRaster() {
  return !!(host.raster && host.raster.canRaster());
}
// === /lolly:shared canRaster ===

// ── OKLab colour port (Björn Ottosson's reference matrices) ──────────────────
// sRGB <-> OKLab, plus OKLCH construction. Used for the mask (perceptual
// lightness thresholds + colour distance) and the metallic foil ramps
// (perceptual interpolation - no muddy sRGB lerps).

function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function linearToSrgb(c) { return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }

// 8-bit → linear lookup. The mask loop runs srgbToLinear three times per pixel
// over a multi-megapixel grid; the byte values are exactly the 256 table entries,
// so this is the same number, not an approximation. Only the alpha-composited
// path (a < 1) produces off-table values and falls back to the real function.
var SRGB_LUT = (function () {
  var t = new Float64Array(256);
  for (var i = 0; i < 256; i++) t[i] = srgbToLinear(i / 255);
  return t;
})();

function hexToRgb(hex) {
  var h = String(hex == null ? '' : hex).trim().replace(/^#/, '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  var v = parseInt(h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function rgbToHex(r, g, b) {
  function hx(v) { v = clamp(Math.round(v), 0, 255); var s = v.toString(16); return s.length < 2 ? '0' + s : s; }
  return '#' + hx(r) + hx(g) + hx(b);
}

function linearSrgbToOklab(r, g, b) {
  var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function oklabToLinearSrgb(L, a, b) {
  var l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  var m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  var s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function hexToOklab(hex) {
  var rgb = hexToRgb(hex);
  if (!rgb) return null;
  return linearSrgbToOklab(srgbToLinear(rgb[0] / 255), srgbToLinear(rgb[1] / 255), srgbToLinear(rgb[2] / 255));
}
function oklabToHex(lab) {
  var lin = oklabToLinearSrgb(lab[0], lab[1], lab[2]);
  return rgbToHex(
    clamp(linearToSrgb(clamp(lin[0], 0, 1)), 0, 1) * 255,
    clamp(linearToSrgb(clamp(lin[1], 0, 1)), 0, 1) * 255,
    clamp(linearToSrgb(clamp(lin[2], 0, 1)), 0, 1) * 255
  );
}
// Perceptual lerp between two OKLab triples.
function lerpLab(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
// OKLCH → hex (the holographic hue sweep). h in degrees.
function oklchToHex(L, C, h) {
  var rad = h * Math.PI / 180;
  return oklabToHex([L, C * Math.cos(rad), C * Math.sin(rad)]);
}

// Expand a list of anchor hexes into a smooth stop list ((anchors-1)*perSeg + 1
// stops), interpolated in OKLab so metallic banding blends perceptually.
function rampStops(anchors, perSeg) {
  var labs = [];
  for (var i = 0; i < anchors.length; i++) labs.push(hexToOklab(anchors[i]));
  var out = [];
  var total = (anchors.length - 1) * perSeg;
  for (var k = 0; k <= total; k++) {
    var pos = k / total;
    var seg = Math.min(anchors.length - 2, Math.floor(pos * (anchors.length - 1)));
    var t = pos * (anchors.length - 1) - seg;
    out.push({ offset: pos, hex: oklabToHex(lerpLab(labs[seg], labs[seg + 1], t)) });
  }
  return out;
}

// ── finish material definitions ──────────────────────────────────────────────

// Foil anchor colours: dark → bright banding pairs so the OKLab ramp reads as
// rolled metal, not a flat tint.
var FOIL_ANCHORS = {
  'foil-gold': ['#6b4e0e', '#d9ab2e', '#fff2bf', '#a8791a', '#f3d96d', '#7d5c12'],
  'foil-silver': ['#5f6670', '#e8ecf1', '#ffffff', '#9aa2ad', '#f2f5f8', '#6e757f'],
};
// Holographic: an OKLCH hue sweep at constant perceptual lightness/chroma.
function holoStops() {
  var out = [];
  var steps = 12;
  for (var i = 0; i <= steps; i++) {
    out.push({ offset: i / steps, hex: oklchToHex(0.82, 0.13, (i * 360 / steps) % 360) });
  }
  return out;
}

var FINISH_LABELS = {
  'foil-gold': 'Foil - gold',
  'foil-silver': 'Foil - silver',
  'foil-holographic': 'Foil - holographic',
  'spot-uv-gloss': 'Spot UV gloss',
  'emboss': 'Emboss',
  'deboss': 'Deboss',
  'soft-touch-matte': 'Soft-touch matte',
};
function finishKind(finish) {
  if (finish === 'spot-uv-gloss') return 'uv';
  if (finish === 'emboss' || finish === 'deboss') return 'bevel';
  if (finish === 'soft-touch-matte') return 'matte';
  return 'foil';
}

// ── mask computation (per-pixel OKLab) ───────────────────────────────────────

function sstep(edge0, edge1, x) {
  if (edge1 <= edge0) return x < edge0 ? 0 : 1;
  var t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Rasterise the artwork into the mask working grid and derive two data-URI PNGs:
//   maskUrl  - white with per-pixel ALPHA = mask coverage (luminance×alpha in an
//              SVG <mask> ⇒ soft, feathered finish edges in the preview);
//   plateUrl - the printer plate: hard-thresholded pure black on white (opaque,
//              filter-free, so the plate view survives every export path).
// Returns null when pixels can't be read (headless / tainted canvas).
function computeMasks(img, cw, ch, fit, source, thr, soft, maskLab) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  var c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  var ctx = c.getContext && c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';

  var iw = img.naturalWidth || img.width;
  var ih = img.naturalHeight || img.height;
  if (!iw || !ih) return null;
  if (fit === 'cover') {
    var s = Math.max(cw / iw, ch / ih);
    ctx.drawImage(img, (cw - iw * s) / 2, (ch - ih * s) / 2, iw * s, ih * s);
  } else {
    // 'contain': the grid already carries the image's aspect ratio.
    ctx.drawImage(img, 0, 0, cw, ch);
  }

  var data;
  try { data = ctx.getImageData(0, 0, cw, ch).data; }
  catch (e) { return null; } // tainted canvas (cross-origin asset)

  var maskPx = ctx.createImageData(cw, ch);
  var m = maskPx.data;
  var platePx = ctx.createImageData(cw, ch);
  var q = platePx.data;

  // Threshold semantics: light/dark compare OKLab L (0..1, scaled to 0..100)
  // with a smoothstep of ±softness L-units around it; by-colour compares OKLab
  // DISTANCE to the target with radius thr/100·0.5 and feather soft/100·0.25.
  var tL = thr;               // OKLab L × 100
  var featherL = soft;        // in L × 100 units
  var radius = (thr / 100) * 0.5;
  var featherD = (soft / 100) * 0.25;

  for (var i = 0, p = 0; p < data.length; i++, p += 4) {
    var al = data[p + 3];
    var lab;
    if (al === 255) {
      lab = linearSrgbToOklab(SRGB_LUT[data[p]], SRGB_LUT[data[p + 1]], SRGB_LUT[data[p + 2]]);
    } else {
      // Composite transparency onto white so cut-out PNGs don't read as black.
      var a = al / 255;
      var R = (data[p] / 255) * a + (1 - a);
      var G = (data[p + 1] / 255) * a + (1 - a);
      var B = (data[p + 2] / 255) * a + (1 - a);
      lab = linearSrgbToOklab(srgbToLinear(R), srgbToLinear(G), srgbToLinear(B));
    }
    var v;
    if (source === 'light') {
      v = sstep(tL - featherL, tL + featherL, lab[0] * 100);
    } else if (source === 'dark') {
      v = 1 - sstep(tL - featherL, tL + featherL, lab[0] * 100);
    } else { // 'colour'
      var dL = lab[0] - maskLab[0], dA = lab[1] - maskLab[1], dB = lab[2] - maskLab[2];
      var d = Math.sqrt(dL * dL + dA * dA + dB * dB);
      v = 1 - sstep(radius - featherD, radius + featherD, d);
    }
    // Preview mask: white, alpha = coverage (soft edges survive).
    m[p] = 255; m[p + 1] = 255; m[p + 2] = 255; m[p + 3] = Math.round(v * 255);
    // Plate: hard 1-bit - black where the finish prints, white elsewhere.
    var ink = v >= 0.5 ? 0 : 255;
    q[p] = ink; q[p + 1] = ink; q[p + 2] = ink; q[p + 3] = 255;
  }

  ctx.putImageData(maskPx, 0, 0);
  var maskUrl = c.toDataURL('image/png');
  ctx.putImageData(platePx, 0, 0);
  var plateUrl = c.toDataURL('image/png');
  return { maskUrl: maskUrl, plateUrl: plateUrl };
}

// ── SVG construction ─────────────────────────────────────────────────────────

function gradientStopsMarkup(stops) {
  var out = '';
  for (var i = 0; i < stops.length; i++) {
    out += '<stop offset="' + f2(stops[i].offset * 100) + '%" stop-color="' + stops[i].hex + '"'
      + (stops[i].opacity != null ? ' stop-opacity="' + f2(stops[i].opacity) + '"' : '') + '/>';
  }
  return out;
}

// The sheen sweep gradient: a soft light band across the finish, rotated to the
// sweep angle. Animated with SMIL (additive translate along the gradient axis)
// only when `animate` is true; otherwise it rests, centred - a still or a
// reduced-motion preview never shows a mid-sweep pose.
function sheenGradient(id, angle, opacity, sharp, animate, W, H) {
  var stops = sharp
    ? [{ offset: 0, hex: '#ffffff', opacity: 0 }, { offset: 0.46, hex: '#ffffff', opacity: 0 },
       { offset: 0.5, hex: '#ffffff', opacity: opacity }, { offset: 0.54, hex: '#ffffff', opacity: 0 },
       { offset: 1, hex: '#ffffff', opacity: 0 }]
    : [{ offset: 0, hex: '#ffffff', opacity: 0 }, { offset: 0.38, hex: '#ffffff', opacity: 0 },
       { offset: 0.5, hex: '#ffffff', opacity: opacity }, { offset: 0.62, hex: '#ffffff', opacity: 0 },
       { offset: 1, hex: '#ffffff', opacity: 0 }];
  // Sweep range spans the LONGER edge so the light band crosses the whole frame at any
  // aspect (matches setSheenPhase, which drives the export sweep off the same max(W,H)).
  var M = Math.max(W, H);
  return '<linearGradient id="' + id + '" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="' + W + '" y2="0" '
    + 'gradientTransform="rotate(' + f2(angle) + ' ' + (W / 2) + ' ' + (H / 2) + ')">'
    + gradientStopsMarkup(stops)
    + (animate
      ? '<animateTransform attributeName="gradientTransform" type="translate" additive="sum" '
        + 'from="-' + M + ' 0" to="' + M + ' 0" dur="5s" repeatCount="indefinite"/>'
      : '')
    + '</linearGradient>';
}

function buildSvg(args) {
  var W = args.W || VIEW, H = args.H || VIEW;
  var region = args.region;
  var rx = f2(region.x), ry = f2(region.y), rw = f2(region.w), rh = f2(region.h);
  var label = FINISH_LABELS[args.finish] || args.finish;
  // Auto-fit anchor stamped on the root <svg> - the demo default carries an empty key
  // (never resizes); the decoded native size rides along for the fast path. See template.html.
  var rootExtra = args.imgKey != null
    ? ' data-img-key="' + esc(args.imgKey) + '"'
      + (args.imgW > 0 && args.imgH > 0 ? ' data-img-w="' + args.imgW + '" data-img-h="' + args.imgH + '"' : '')
    : '';

  // ── plate view: the printer deliverable - pure black mask on white + label ──
  // Filter-free by construction (the plate PNG is already black-on-white), so
  // it survives PDF export and any strict vector path unchanged.
  if (args.plate) {
    var pl = svgOpen(W, H, rootExtra);
    pl += '<rect width="' + W + '" height="' + H + '" fill="#ffffff"/>';
    if (args.wholeMask) {
      pl += '<rect x="' + rx + '" y="' + ry + '" width="' + rw + '" height="' + rh + '" fill="#000000"/>';
    } else {
      // image-rendering:pixelated, NOT optimizeQuality: computeMasks hard-thresholds
      // the plate to exactly 0 or 255 so it is 1-bit by construction. Smoothed
      // resampling at any scale other than 1:1 would turn every plate edge into a
      // grey ramp, which a RIP then re-thresholds at its own arbitrary cut-off -
      // the foil die would no longer match the mask the user approved on screen.
      pl += '<image href="' + esc(args.plateUrl) + '" x="' + rx + '" y="' + ry + '" width="' + rw
        + '" height="' + rh + '" preserveAspectRatio="none" image-rendering="crisp-edges" '
        + 'style="image-rendering:crisp-edges;image-rendering:pixelated"/>';
    }
    // The overprint label is an ANNOTATION, never plate ink. It used to be #111111
    // (a second tone for the separator, not solid spot ink) with a 6px white
    // paint-order stroke, which punched a white halo straight through the black
    // plate underneath - physically cutting the foil/UV shape away along the
    // label. Solid #000000, no knockout, in a documented strippable group: never
    // paint white over plate geometry.
    pl += '<g id="fp-plate-annotation">'
      + '<text x="24" y="' + (H - 20) + '" font-family="SUSE, system-ui, sans-serif" font-size="22" fill="#000000">'
      + esc(label + ' · prints as spot plate - overprint') + '</text></g>';
    pl += '</svg>';
    return pl;
  }

  // ── preview ─────────────────────────────────────────────────────────────────
  var k = clamp(n(args.strength, 80), 0, 100) / 100;
  var kind = finishKind(args.finish);
  var angle = clamp(n(args.angle, 35), 0, 360);
  var animate = !!args.animate && (kind === 'foil' || kind === 'uv');
  // Per-render def-id prefix (see hash32). args.maskHash stands in for the mask
  // PNG itself - same finish settings over DIFFERENT artwork must not collide,
  // because it is the mask that would get cross-wired.
  var U = 'fp' + hash32(JSON.stringify([
    args.finish, k, angle, animate, args.cover, args.wholeMask, args.bg, args.maskHash || '',
    region.x, region.y, region.w, region.h,
  ])) + '-';
  // NB every filter below pins color-interpolation-filters="sRGB". The SVG
  // default is linearRGB, and each of these curves is authored in sRGB terms:
  // fp-matte's tone curve pivots at 0.5 (linear-light 0.5 is sRGB ~0.735, so in
  // linearRGB the "gentle softening" pivots near white and lifts the whole
  // image), its grain floods RGB to 0.5 expecting neutral mid-grey, and
  // fp-gloss's negative intercept eats far more shadow in linear light. Same
  // rule as every other filter in this repo (see community/filter-imperfections
  // and engine/src/photo-treatment.ts, which documents why).

  var artHref = esc(args.url);
  var artImg = args.cover
    ? '<image href="' + artHref + '" x="0" y="0" width="' + W + '" height="' + H + '" preserveAspectRatio="xMidYMid slice"/>'
    : '<image href="' + artHref + '" x="' + rx + '" y="' + ry + '" width="' + rw + '" height="' + rh + '" preserveAspectRatio="none"/>';
  var maskImg = args.wholeMask ? null
    : '<image href="' + esc(args.maskUrl) + '" x="' + rx + '" y="' + ry + '" width="' + rw + '" height="' + rh + '" preserveAspectRatio="none"/>';
  var regionRect = function (fill, extra) {
    return '<rect x="' + rx + '" y="' + ry + '" width="' + rw + '" height="' + rh + '" fill="' + fill + '"' + (extra || '') + '/>';
  };

  var defs = '';
  // The finish mask (luminance × alpha of the white/alpha mask PNG).
  defs += '<mask id="' + U + 'm" maskUnits="userSpaceOnUse" x="0" y="0" width="' + W + '" height="' + H + '">'
    + (args.wholeMask ? regionRect('#ffffff') : maskImg)
    + '</mask>';

  if (kind === 'matte') {
    // Inverse mask: everything in the region EXCEPT the finish areas. Built by
    // painting the mask black (fp-black keeps alpha, zeroes RGB) over white.
    defs += '<filter id="' + U + 'black" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" '
      + 'values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/></filter>';
    defs += '<mask id="' + U + 'mi" maskUnits="userSpaceOnUse" x="0" y="0" width="' + W + '" height="' + H + '">'
      + regionRect('#ffffff')
      + (args.wholeMask ? regionRect('#000000')
        : '<g filter="url(#' + U + 'black)">' + maskImg + '</g>')
      + '</mask>';
    // Soft-touch look: gentle desaturate, softened tone with a slight lift, and
    // a fine deterministic grain (fixed feTurbulence seed) blended on top.
    var slope = 1 - 0.14 * k;
    var icpt = f2(0.5 - 0.5 * slope + 0.04 * k);
    slope = f2(slope);
    defs += '<filter id="' + U + 'matte" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">'
      + '<feColorMatrix in="SourceGraphic" type="saturate" values="' + f2(1 - 0.4 * k) + '" result="des"/>'
      + '<feComponentTransfer in="des" result="tone">'
      + '<feFuncR type="linear" slope="' + slope + '" intercept="' + icpt + '"/>'
      + '<feFuncG type="linear" slope="' + slope + '" intercept="' + icpt + '"/>'
      + '<feFuncB type="linear" slope="' + slope + '" intercept="' + icpt + '"/>'
      + '</feComponentTransfer>'
      + '<feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="7" result="noise"/>'
      + '<feColorMatrix in="noise" type="matrix" '
      + 'values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 ' + f2(0.08 + 0.14 * k) + ' 0" result="grain"/>'
      + '<feBlend in="grain" in2="tone" mode="overlay" result="blended"/>'
      + '<feComposite in="blended" in2="SourceAlpha" operator="in"/>'
      + '</filter>';
  }

  if (kind === 'foil') {
    var stops = args.finish === 'foil-holographic'
      ? holoStops()
      : rampStops(FOIL_ANCHORS[args.finish] || FOIL_ANCHORS['foil-gold'], 4);
    defs += '<linearGradient id="' + U + 'metal" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="' + W + '" y2="0" '
      + 'gradientTransform="rotate(' + f2(angle) + ' ' + (W / 2) + ' ' + (H / 2) + ')">'
      + gradientStopsMarkup(stops) + '</linearGradient>';
    defs += sheenGradient(U + 'sheen', angle, 0.1 + 0.45 * k, false, animate, W, H);
  }

  if (kind === 'uv') {
    // Spot UV: the masked artwork itself, gloss-boosted, plus a sharp specular band.
    defs += '<filter id="' + U + 'gloss" color-interpolation-filters="sRGB">'
      + '<feColorMatrix type="saturate" values="' + f2(1 + 0.15 * k) + '"/>'
      + '<feComponentTransfer>'
      + '<feFuncR type="linear" slope="' + f2(1 + 0.1 * k) + '" intercept="' + f2(-0.04 * k) + '"/>'
      + '<feFuncG type="linear" slope="' + f2(1 + 0.1 * k) + '" intercept="' + f2(-0.04 * k) + '"/>'
      + '<feFuncB type="linear" slope="' + f2(1 + 0.1 * k) + '" intercept="' + f2(-0.04 * k) + '"/>'
      + '</feComponentTransfer></filter>';
    defs += sheenGradient(U + 'sheen', angle, 0.15 + 0.35 * k, true, animate, W, H);
  }

  if (kind === 'bevel') {
    // Emboss/deboss: light + dark edge bands from the mask's own alpha,
    // offset in opposite directions (the classic paper-relief illusion).
    var e = f2(2 + 2 * k);
    var eo = f2(0.3 + 0.55 * k);
    var raised = args.finish === 'emboss';
    // INNER bands: each band is SourceAlpha minus a displaced copy of itself, so
    // it sits just inside the shape edge. The outer form (offset copy minus
    // SourceAlpha) draws strictly OUTSIDE the shape, which is invisible whenever
    // the mask is the whole region - the bands land outside the viewBox and are
    // clipped away, so the finish did nothing at all. Inner bands are always in
    // frame, for a shaped mask and a full-bleed one alike.
    // Displacing the copy DOWN-RIGHT leaves the TOP-LEFT inner edge uncovered,
    // hence the positive offset carries the light band when the shape is raised.
    var liteD = raised ? e : -e;
    var darkD = raised ? -e : e;
    defs += '<filter id="' + U + 'bevel" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">'
      + '<feOffset in="SourceAlpha" dx="' + liteD + '" dy="' + liteD + '" result="oL"/>'
      + '<feComposite in="SourceAlpha" in2="oL" operator="out" result="bandL"/>'
      + '<feFlood flood-color="#ffffff" flood-opacity="' + eo + '" result="fw"/>'
      + '<feComposite in="fw" in2="bandL" operator="in" result="lite"/>'
      + '<feOffset in="SourceAlpha" dx="' + darkD + '" dy="' + darkD + '" result="oD"/>'
      + '<feComposite in="SourceAlpha" in2="oD" operator="out" result="bandD"/>'
      + '<feFlood flood-color="#000000" flood-opacity="' + eo + '" result="fb"/>'
      + '<feComposite in="fb" in2="bandD" operator="in" result="dark"/>'
      + '<feMerge><feMergeNode in="lite"/><feMergeNode in="dark"/></feMerge>'
      + '</filter>';
  }

  var out = svgOpen(W, H, rootExtra);
  out += '<defs>' + defs + '</defs>';
  out += '<rect width="' + W + '" height="' + H + '" fill="' + esc(args.bg) + '"/>';
  out += artImg;

  if (kind === 'matte') {
    out += '<g mask="url(#' + U + 'mi)"><g filter="url(#' + U + 'matte)">' + artImg + '</g></g>';
  } else if (kind === 'foil') {
    out += '<g mask="url(#' + U + 'm)" opacity="' + f2(0.25 + 0.7 * k) + '">'
      + regionRect('url(#' + U + 'metal)')
      + regionRect('url(#' + U + 'sheen)')
      + '</g>';
  } else if (kind === 'uv') {
    out += '<g mask="url(#' + U + 'm)"><g filter="url(#' + U + 'gloss)">' + artImg + '</g>'
      + regionRect('url(#' + U + 'sheen)')
      + '</g>';
  } else if (kind === 'bevel') {
    out += args.wholeMask
      ? '<g filter="url(#' + U + 'bevel)">' + regionRect('#ffffff') + '</g>'
      : '<g filter="url(#' + U + 'bevel)">' + maskImg + '</g>';
  }

  out += '</svg>';
  return out;
}

// ── reduced-motion: the OS media query ONLY. Deliberately does NOT read the
// shell's `data-a11y-motion` attribute - that is chrome-private state which is
// documented as never reaching inside the tool canvas, and a tool is data, not
// chrome. The OS query is a platform API any renderer may consult.
// Exports are unaffected either way: beforeExport pins the sheen to its rest
// pose (or drives it from the frame clock), so a rendered file is determined by
// the URL alone regardless of who is looking at the preview. ──
function prefersReducedMotion() {
  try {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
  } catch (e) { /* ignore */ }
  return false;
}

// ── lifecycle ────────────────────────────────────────────────────────────────

async function compute(model) {
  var inputs = inputsFrom(model);
  var plate = Boolean(inputs.plateView);
  var bg = color(inputs.bgColor, '#ffffff');
  // Export-margin fill for beforeExport: the plate is always on white.
  _bgColor = plate ? '#ffffff' : bg;

  if (!canRaster()) return { finishSvg: placeholder('Preview renders in the browser') };

  // Resolve the artwork URL: the user's pick, else the demo default (cached).
  var ref = inputs.image;
  var url = ref && typeof ref === 'object' ? ref.url : null;
  // Only a user-chosen image drives the auto-fit (template.html); the demo default
  // must never resize the canvas on first load.
  var isUserPick = !!url;
  if (!url) {
    if (!_defaultUrl) {
      try {
        var def = (DEFAULT_IMAGE_ID.indexOf('://') !== -1)
          ? (host.compose && host.compose.renderUrl ? await host.compose.renderUrl(DEFAULT_IMAGE_ID) : null)
          : await host.assets.get(DEFAULT_IMAGE_ID);
        _defaultUrl = def && def.url;
      } catch (e) {
        if (host.log) host.log('warn', 'finish-preview: default image unavailable', { error: String(e) });
      }
    }
    url = _defaultUrl;
  }
  if (!url) return { finishSvg: placeholder('Choose artwork to preview a finish') };

  var maskSource = ['whole', 'light', 'dark', 'colour'].indexOf(inputs.maskSource) !== -1
    ? inputs.maskSource : 'light';
  var maskColorHex = color(inputs.maskColor, '#30ba78');
  var animate = Boolean(inputs.sheen) && !plate && !prefersReducedMotion();
  // Canvas size from the export-group width/height inputs - the whole scene is emitted
  // at W×H, so a picked image's aspect (auto-fit) or a manual resize reflows it.
  var W = dimW(inputs), H = dimH(inputs);

  var params = {
    url: url, plate: plate, bg: bg, W: W, H: H,
    finish: inputs.finish, strength: inputs.strength, animate: animate,
    angle: inputs.angle, maskSource: maskSource, maskColor: maskColorHex,
    threshold: inputs.threshold, softness: inputs.softness, fit: inputs.fit,
  };
  var memoKey = JSON.stringify(params);
  if (memoKey === _memoKey) return _memoResult;

  var finishSvg;
  try {
    var img = await getImage(url);
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) throw new Error('image has no size');

    // Region the artwork occupies in the W×H canvas: 'contain' letterboxes to the
    // image's aspect (centred); 'cover' fills the frame (centre crop). With auto-fit
    // on, the canvas already matches the photo, so 'contain' fills it edge-to-edge.
    var cover = inputs.fit === 'cover';
    var region;
    if (cover) {
      region = { x: 0, y: 0, w: W, h: H };
    } else {
      var fitS = Math.min(W / iw, H / ih);
      var frw = iw * fitS, frh = ih * fitS;
      region = { x: (W - frw) / 2, y: (H - frh) / 2, w: frw, h: frh };
    }

    var wholeMask = maskSource === 'whole';
    var masks = null;
    if (!wholeMask) {
      var thrV = clamp(n(inputs.threshold, 60), 0, 100);
      var softV = clamp(n(inputs.softness, 4), 0, 20);
      // Second, NARROWER memo: only these six inputs reach computeMasks. Without
      // it every strength / sweep-angle / sheen / background / plate-view change
      // re-ran a multi-megapixel OKLab loop plus two PNG encodes - the sweep-angle
      // slider alone has 73 stops, and past HOOK_BUDGET_MS.onInput (2s) the
      // runtime abandons the patch, so the preview silently stops updating while
      // the hook keeps burning CPU. Those inputs now only re-run buildSvg (string
      // concatenation, sub-millisecond).
      var maskKey = JSON.stringify([url, maskSource, maskColorHex, thrV, softV, cover]);
      if (_maskKey === maskKey && _maskVal) {
        masks = _maskVal;
      } else {
        // Plate resolution: the plate is a PRINT deliverable, so the mask grid is
        // sized from the artwork, not from the 1000-unit viewBox - a 4000px logo
        // used to be thrown away at ~85 dpi on a business card, exactly where edge
        // fidelity matters most. Capped at MASK_LONG_EDGE: the per-pixel OKLab
        // loop and the two PNG encodes have to stay inside the onInput budget on
        // a mid-range phone, and 2048 is ~4× today's detail at ~4× the cost.
        var ar = region.w / region.h;
        // Long edge of the mask grid: the artwork's own resolution, but at least the
        // canvas long edge (so a small manual size isn't grainy) and at most the cap.
        var LONG = clamp(Math.round(Math.max(iw, ih)), Math.min(MASK_LONG_EDGE, Math.max(W, H)), MASK_LONG_EDGE);
        var cw = ar >= 1 ? LONG : Math.max(1, Math.round(LONG * ar));
        var ch = ar >= 1 ? Math.max(1, Math.round(LONG / ar)) : LONG;
        var maskLab = hexToOklab(maskColorHex) || hexToOklab('#30ba78');
        masks = computeMasks(img, cw, ch, cover ? 'cover' : 'contain', maskSource, thrV, softV, maskLab);
        if (!masks) throw new Error('cannot read pixels');
        // Identifies this mask for the def-id prefix without re-hashing the
        // multi-megabyte data URI on every re-render.
        masks.hash = hash32(masks.plateUrl);
        _maskKey = maskKey;
        _maskVal = masks;
      }
    }

    _lastW = W; _lastH = H;   // read by setSheenPhase (export sweep range)
    finishSvg = buildSvg({
      url: url, plate: plate, bg: bg, cover: cover, region: region,
      W: W, H: H, imgKey: isUserPick ? url : '', imgW: iw, imgH: ih,
      wholeMask: wholeMask,
      maskUrl: masks && masks.maskUrl, plateUrl: masks && masks.plateUrl,
      maskHash: masks && masks.hash,
      finish: inputs.finish, strength: inputs.strength,
      animate: animate, angle: inputs.angle,
    });
  } catch (e) {
    if (host.log) host.log('warn', 'finish-preview: render failed', { error: String(e) });
    finishSvg = placeholder('Could not read this image', W, H);
  }

  _memoKey = memoKey;
  _memoResult = { finishSvg: finishSvg };
  return _memoResult;
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }

// ── Export-time sheen determinism ────────────────────────────────────────────
// The live preview sweeps the sheen with SMIL, and the export pipeline cannot
// scrub SMIL: `scrubAnimations()` walks getAnimations({subtree:true}), which in
// Blink returns CSSAnimation/CSSTransition/script animations and never SVG SMIL,
// and `__lollyFrameRender` is a canvas hook this tool has no reason to own for
// its still path. So a PNG exported at t=2.0s and the same URL at t=4.3s used to
// differ - a determinism violation, and for gif/apng/webm/mp4 the sweep was
// paced by capture jitter, the exact drift the frame clock exists to remove.
//
// beforeExport therefore takes the animation OUT of the DOM for the duration of
// the export and pins gradientTransform itself:
//   • stills (png/svg/pdf/…) get the documented centred REST pose - and the
//     exported SVG file carries no infinite SMIL loop for downstream tools;
//   • motion formats get one exact sweep per clip, driven by the export frame
//     clock, so frame N is the same image every run.
// Attribute-baked, not state-based: it survives the clone-and-serialise capture
// path (which would restart a SMIL clock at t=0 in the cloned document) as well
// as a real screenshot.
var SHEEN_MOTION_FORMATS = { gif: 1, apng: 1, webm: 1, mp4: 1 };
var _sheenPinned = null;   // [{ el, anim, base }] while an export is in flight
var _clockEl = null;       // mounted frame-clock anchor (motion formats only)

function pinSheen(node) {
  _sheenPinned = [];
  if (!node || !node.querySelectorAll) return;
  // id is `<prefix>-sheen` for every instance (see the def-id prefix in buildSvg).
  var els = node.querySelectorAll('linearGradient[id$="-sheen"]');
  for (var i = 0; i < els.length; i++) {
    var el = els[i];
    var anim = el.querySelector ? el.querySelector('animateTransform') : null;
    var base = el.getAttribute('gradientTransform') || '';
    if (anim && anim.parentNode === el) el.removeChild(anim);
    el.setAttribute('gradientTransform', base);   // rest pose: rotate only
    _sheenPinned.push({ el: el, anim: anim, base: base });
  }
}
// t ∈ [0,1): normalised loop time from the export frame clock. Reproduces the
// SMIL sweep exactly - additive translate from -max(W,H) to +max(W,H) along the axis.
function setSheenPhase(t) {
  if (!_sheenPinned) return;
  // Sweep range spans the longer edge (matches sheenGradient's from/to = ±max(W,H)).
  var M = Math.max(_lastW, _lastH);
  var dx = -M + 2 * M * clamp(n(t, 0), 0, 1);
  for (var i = 0; i < _sheenPinned.length; i++) {
    var p = _sheenPinned[i];
    p.el.setAttribute('gradientTransform', p.base + ' translate(' + f2(dx) + ' 0)');
  }
}
function unpinSheen() {
  if (!_sheenPinned) return;
  for (var i = 0; i < _sheenPinned.length; i++) {
    var p = _sheenPinned[i];
    p.el.setAttribute('gradientTransform', p.base);
    if (p.anim) p.el.appendChild(p.anim);   // live preview resumes sweeping
  }
  _sheenPinned = null;
}
// A 0×0 absolutely-positioned canvas is the only channel the capture loop drives
// a frame time through (export.ts: frameClockCanvas scans ctx.node for a <canvas>
// carrying __lollyFrameRender). Zero backing store + out of flow: it paints
// nothing, shifts no layout, and the shell's static-chrome fast path skips it.
function mountClock(node) {
  if (!node || !node.ownerDocument || !node.appendChild) return null;
  var el = node.ownerDocument.createElement('canvas');
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('data-fp-clock', '');
  el.setAttribute('style', 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none');
  el.width = 0; el.height = 0;
  el.__lollyFrameRender = function (t) { setSheenPhase(t); };
  node.appendChild(el);
  return (_clockEl = el);
}
function unmountClock() {
  if (_clockEl && _clockEl.parentNode) _clockEl.parentNode.removeChild(_clockEl);
  _clockEl = null;
}

function beforeExport(ctx) {
  // Alpha-capable raster formats: fill the exported frame's margins with the
  // canvas background (white in plate view) so a non-square export has no
  // transparent gutter around the square scene.
  var alpha = ['png', 'webp', 'avif'];
  if (alpha.indexOf(ctx.format) !== -1) {
    ctx.opts.background = _bgColor;
  }
  pinSheen(ctx.node);
  if (SHEEN_MOTION_FORMATS[ctx.format]) mountClock(ctx.node);
}

function afterExport() {
  unmountClock();
  unpinSheen();
}
