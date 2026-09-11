/* global host */
/**
 * Screenshot Frame hooks.
 *
 * Everything the logic-less template cannot express: the backdrop paint, the
 * window-button glyphs, the frame flags, the address text and the shadow.
 *
 * The glyphs are built here as inline-SVG STRINGS with explicit fill/stroke
 * colours (never currentColor), the same rule snippet follows: the SVG
 * export path clones inline <svg> verbatim with no inherited colour, so a glyph
 * that relies on inheritance comes out black or blank. Building them as strings
 * rather than with document APIs keeps the hook DOM-free, so the CLI and the
 * node tests render exactly what the browser does.
 *
 * No host.* API is required. The hook never throws: every path returns a patch,
 * and a failure surfaces as the `sfError` extra the template prints.
 */

// Brand-agnostic fallbacks. A semantic token alias that does not resolve
// flattens to '', so every colour read needs a literal to fall back to. These
// two are light neutrals, matching the tool's light-by-default look.
var FALLBACK_1 = '#dfe6f0';
var FALLBACK_2 = '#f4f1ec';

var FRAMES = ['browser', 'phone', 'laptop', 'none'];
var CHROMES = ['nuremberg', 'cupertino', 'redmond'];

function _num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : d; }
function _clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
function _pick(v, list, d) { var s = String(v == null ? '' : v); return list.indexOf(s) >= 0 ? s : d; }

// Colour values land raw inside a style attribute and can arrive from a URL
// param, so allow only colour-function characters - never markup. The slash is
// allowed because modern colour syntax needs it (rgb(0 0 0 / 50%)), which also
// means `url(//host/x.png)` clears the allowlist on characters alone: reject any
// url() outright so a shared link can never make the render fetch a third party.
function _safeColor(v, fb) {
  v = (v == null ? '' : String(v)).trim();
  if (!v || /url\s*\(/i.test(v)) return fb;
  return /^[#a-zA-Z0-9(),.%\s\/-]+$/.test(v) ? v : fb;
}

// Strip the protocol and any trailing slash for the address pill.
function _displayHost(u) {
  var s = String(u == null ? '' : u).trim();
  if (!s) return '';
  return s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/+$/, '');
}

function _svg(box, body) {
  return '<svg viewBox="0 0 ' + box + ' ' + box + '" width="' + box + '" height="' + box + '">' + body + '</svg>';
}

function _line(x1, y1, x2, y2, stroke, w) {
  return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
    '" stroke="' + stroke + '" stroke-width="' + w + '" stroke-linecap="round"/>';
}

// Cupertino: three coloured dots, left of the title.
function _dots() {
  var fill = ['#ff5f56', '#febc2e', '#28c840'];
  var out = '';
  for (var i = 0; i < 3; i++) {
    out += '<span class="sf-dot">' + _svg(12, '<circle cx="6" cy="6" r="6" fill="' + fill[i] + '"/>') + '</span>';
  }
  return out;
}

// Redmond: flat monochrome minimise / maximise / close captions, right-aligned.
function _caps(ink) {
  var min = _line(0, 5, 10, 5, ink, 1.2);
  var max = '<rect x="0.6" y="0.6" width="8.8" height="8.8" rx="1.4" fill="none" stroke="' + ink + '" stroke-width="1.2"/>';
  var close = _line(0.6, 0.6, 9.4, 9.4, ink, 1.2) + _line(9.4, 0.6, 0.6, 9.4, ink, 1.2);
  return '<span class="sf-cap">' + _svg(10, min) + '</span>' +
    '<span class="sf-cap">' + _svg(10, max) + '</span>' +
    '<span class="sf-cap">' + _svg(10, close) + '</span>';
}

// Nuremberg: one round close button, the Adwaita shape. The disc is a real
// <circle> rather than a border-radius box so vector export keeps it round
// without depending on the walker's corner handling.
function _close(ink, chip) {
  var body = '<circle cx="13" cy="13" r="13" fill="' + chip + '"/>' +
    _line(8.6, 8.6, 17.4, 17.4, ink, 1.6) + _line(17.4, 8.6, 8.6, 17.4, ink, 1.6);
  return '<span class="sf-close">' + _svg(26, body) + '</span>';
}

// One-entry memo keyed on the input JSON: the same values re-render the same
// strings, and a re-render that touched nothing skips the rebuild.
var _memoKey = null;
var _memoResult = null;

// beforeExport reads the last known transparency, exactly as qr-code does.
var _noBackdrop = false;

function compute(args) {
  var key = JSON.stringify(args);
  if (key === _memoKey) return _memoResult;

  var out;
  try {
    var frame = _pick(args.frame, FRAMES, 'browser');
    // Same id and same three values as snippet's `windowStyle`, so /batch
    // merges the two tools onto one column.
    var windowStyle = _pick(args.windowStyle, CHROMES, 'nuremberg');
    var backdrop = _pick(args.backdrop, ['gradient', 'solid', 'transparent'], 'gradient');
    var dark = Boolean(args.dark);
    var clear = backdrop === 'transparent' || Boolean(args.transparentBg);
    _noBackdrop = clear;

    var c1 = _safeColor(args.background, FALLBACK_1);
    var c2 = _safeColor(args.color2, FALLBACK_2);

    var backdropCss = '';
    if (!clear) {
      backdropCss = backdrop === 'solid' ? c1
        : 'radial-gradient(90% 80% at 12% 6%, ' + c2 + ' 0%, rgba(0,0,0,0) 62%),' +
          'radial-gradient(85% 85% at 92% 96%, ' + c1 + ' 0%, rgba(0,0,0,0) 58%),' +
          'linear-gradient(135deg, ' + c1 + ' 0%, ' + c2 + ' 100%)';
    }

    var sh = _clamp(_num(args.shadow, 55), 0, 100);
    var shadowCss = sh <= 0 ? 'none'
      : '0 ' + (sh * 0.34).toFixed(1) + 'px ' + (sh * 0.9).toFixed(1) + 'px rgba(15,23,42,' +
        (0.06 + sh * 0.0038).toFixed(3) + ')';

    var ink = dark ? 'rgba(255,255,255,0.86)' : 'rgba(17,24,39,0.72)';
    var chip = dark ? 'rgba(255,255,255,0.14)' : 'rgba(17,24,39,0.10)';
    var glyphs = '';
    if (frame === 'browser') {
      glyphs = windowStyle === 'cupertino' ? _dots()
        : windowStyle === 'redmond' ? _caps(ink) : _close(ink, chip);
    }

    out = {
      frameClass: 'sf-frame--' + frame,
      chromeClass: 'sf-chrome--' + windowStyle,
      isBrowser: frame === 'browser',
      isPhone: frame === 'phone',
      isLaptop: frame === 'laptop',
      chromeGlyphs: glyphs,
      displayHost: _displayHost(args.url),
      backdropCss: backdropCss,
      shadowCss: shadowCss,
      padPx: Math.round(_clamp(_num(args.padding, 72), 0, 200)),
      radiusPx: Math.round(_clamp(_num(args.radius, 16), 0, 48)),
      scalePct: Math.round(_clamp(_num(args.scale, 78), 50, 100)),
      sfError: '',
    };
  } catch (err) {
    // A patch is always returned, so a bad value shows a note instead of a
    // blank canvas. The frame falls back to the plain padded shot.
    out = {
      frameClass: 'sf-frame--none',
      chromeClass: 'sf-chrome--nuremberg',
      isBrowser: false, isPhone: false, isLaptop: false,
      chromeGlyphs: '', displayHost: '', backdropCss: '', shadowCss: 'none',
      padPx: 72, radiusPx: 16, scalePct: 78,
      sfError: (err && err.message) ? String(err.message) : 'Could not build the frame',
    };
  }

  _memoKey = key;
  _memoResult = out;
  return out;
}

function _args(model) {
  var o = {};
  for (var i = 0; i < model.length; i++) o[model[i].id] = model[i].value;
  return o;
}

function onInit({ model }) { return compute(_args(model)); }

function onInput({ model }) { return compute(_args(model)); }

function beforeExport({ format, opts }) {
  // Clear the container background for the alpha-capable formats so a
  // transparent backdrop is not composited onto an opaque canvas.
  if (_noBackdrop && ['png', 'webp', 'avif', 'svg'].indexOf(format) >= 0) {
    opts.background = 'transparent';
  }
}
