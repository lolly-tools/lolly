/* global host */
/**
 * Palette Lab hooks.
 *
 * All colour math comes from host.color (engine >= 1.40; schemes() >= 1.60):
 * OKLCH harmony accents, perceptual OKLab ramps, and WCAG 2.1 + APCA
 * readability. Older shells degrade to a compact local fallback (HSL hue
 * rotation, sRGB lerp, WCAG-only badges) so the sheet still renders anywhere.
 *
 * The whole sheet is data: compute() emits positioned swatch/ramp extras the
 * logic-less SVG template iterates (a native <svg> root so the CLI's DOM-free
 * svg export works), the same palette flattened as csvRows (template.csv), a
 * DTCG tokens fragment (tokensJson) for the copyable on-canvas panel AND the
 * template.json export, and a flat paletteSwatches list that host.color turns
 * into palette-exchange files (engine >= 1.108): CSS variables/classes
 * (template.css), SCSS (template.scss), a GIMP palette (template.gpl) and a
 * binary Adobe .ase (via the exportStill hook). Parity with the catalog view's
 * Swatches download - all six formats from one seed. Older shells (no
 * host.color.paletteExport) degrade to empty CSS/SCSS/GPL and decline .ase.
 *
 * Two review aids sit on top of that, both off by default so the plain sheet is
 * unchanged: `vision` repaints every swatch, ramp cell and grid cell as a
 * colour-blind or greyscale viewer sees it (labels keep the real hex), and
 * `grid` appends a foreground-on-background contrast matrix of the base
 * colours. Every REPORTED number - the row badges, the CSV, the DTCG tokens and
 * the palette-exchange files - always describes the real palette: a simulation
 * repaints, it never re-measures.
 */

// === lolly:shared cvd - generated from community/_shared/vision.js; edit there and run npm run sync:shared ===
// Colour-vision-deficiency simulation - Machado, Oliveira & Fernandes (2009),
// "A Physiologically-based Model for Simulation of Color Vision Deficiency",
// IEEE TVCG 15(6), pp. 1291-1298. Severity 1.0 only: protanopia, deuteranopia,
// tritanopia. Plus a Rec.709 greyscale and the WCAG level namer.
//
// This mirrors engine/src/color-vision.ts and must stay numerically identical
// to it. Two conventions carried over from there:
//  - the matrix multiplies the GAMMA-ENCODED sRGB channels, with no
//    linearisation, which is what the authors' own reference code does;
//  - channels are clamped to [0,1] after the multiply and rounded to 8 bits.
// Row-major 3x3, copied verbatim from the published table. Do not tidy them.
var CVD_MATRICES = {
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};

// '#abc' / '#aabbcc' / '#aabbccdd' (alpha dropped) -> [r,g,b] 0..255, or null.
function cvdHexToRgb(hex) {
  var s = String(hex == null ? '' : hex).trim();
  var m3 = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (m3) s = '#' + m3[1] + m3[1] + m3[2] + m3[2] + m3[3] + m3[3];
  var m6 = /^#?([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(s);
  if (!m6) return null;
  var n = parseInt(m6[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function cvdRgbToHex(rgb) {
  var out = '#';
  for (var i = 0; i < 3; i++) {
    var v = Math.round(rgb[i]);
    v = v < 0 ? 0 : (v > 255 ? 255 : v);
    out += (v < 16 ? '0' : '') + v.toString(16);
  }
  return out;
}

// Hex in, hex out. `type` is 'protan' | 'deutan' | 'tritan'. Null on bad input.
function cvdSimulateHex(hex, type) {
  var m = CVD_MATRICES[type];
  var rgb = cvdHexToRgb(hex);
  if (!m || !rgb) return null;
  var r = rgb[0] / 255;
  var g = rgb[1] / 255;
  var b = rgb[2] / 255;
  var ch = function (a, bb, c) {
    var v = a * r + bb * g + c * b;
    v = v < 0 ? 0 : (v > 1 ? 1 : v);
    return Math.round(v * 255);
  };
  return cvdRgbToHex([ch(m[0], m[1], m[2]), ch(m[3], m[4], m[5]), ch(m[6], m[7], m[8])]);
}

// Rec.709 luma (0.2126 / 0.7152 / 0.0722) of the gamma-encoded channels.
function cvdGreyscaleHex(hex) {
  var rgb = cvdHexToRgb(hex);
  if (!rgb) return null;
  var y = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  y = y < 0 ? 0 : (y > 1 ? 1 : y);
  var v = Math.round(y * 255);
  return cvdRgbToHex([v, v, v]);
}

// The best WCAG 2.1 level a ratio reaches. Normal text: AA 4.5, AAA 7. Large
// text (18pt, or 14pt bold): AA 3, AAA 4.5. Below the AA bar for normal text,
// 3:1 still carries UI components and graphical objects, reported as 'UI'.
function cvdWcagLevel(ratio, large) {
  if (!(ratio >= 1)) return 'Fail';
  if (ratio >= (large ? 4.5 : 7)) return 'AAA';
  if (ratio >= (large ? 3 : 4.5)) return 'AA';
  return ratio >= 3 ? 'UI' : 'Fail';
}
// === /lolly:shared cvd ===

// Sheet geometry (matches the template's fixed viewBox).
var W = 1600;
var H = 1000;
var M = 56;
var ROWS_TOP = 150;
var ROWS_BOTTOM = 944;
var ROW_GAP = 18;
var SWATCH_W = 400;
var RAMP_X = 480;
var RAMP_W = W - M - RAMP_X; // ramp strip ends on the right margin
var CELL_GAP = 8;

// Harmony table - ids/labels mirror the engine's SCHEME_KINDS (brand-schemes.ts);
// the rotations are only the pre-1.60 fallback path, host.color.schemes() wins.
var SCHEMES = {
  complement: { label: 'Complementary', rot: [180] },
  'adjacent-3': { label: 'Adjacent', rot: [-30, 30] },
  'triad-3': { label: 'Triad', rot: [120, 240] },
  'tetrad-4': { label: 'Tetrad', rot: [90, 180, 270] },
  'free-2': { label: 'Free (2)', rot: [180] },
  'free-3': { label: 'Free (3)', rot: [120, 240] },
  'free-4': { label: 'Free (4)', rot: [90, 180, 270] },
};

// Contrast-mode curves - each is a [lowLc, highLc] span that gets sampled to one
// target APCA Lc per ramp step (dark end … light end). 'even' spreads the whole
// legibility range; 'text' keeps every step body-readable; 'ui' stays in the
// non-text/large-text band for borders, fills and disabled states.
var CURVES = {
  even: [15, 90],
  text: [45, 100],
  ui: [8, 66],
};

// Whole-sheet colour-vision preview. 'normal' is the real palette; the rest
// repaint through the shared `cvd` region above.
var VISIONS = {
  protan: 'Protanopia',
  deutan: 'Deuteranopia',
  tritan: 'Tritanopia',
  gray: 'Greyscale',
};

// Contrast grid geometry (the `grid` input). The sheet keeps its fixed 1600x1000
// viewBox, so switching the grid on moves the ramp rows up instead of growing
// the page - ROWS_BOTTOM_GRID is where the rows stop once the grid is there.
var ROWS_BOTTOM_GRID = 620;
var GRID_X = 300;      // cells start here; the gutter left of it carries row names
var GRID_RIGHT = 1544;
var GRID_TOP = 700;
var GRID_BOTTOM = 952;
var GRID_HEAD_Y = 666; // column-header chip top; its name sits on the 683 baseline

// Pass/fail marks, drawn in the cell's foreground colour so the verdict is never
// carried by colour alone (the level word says it too).
var TICK = 'M3 9.5 L7 13.5 L15 4.5';
var CROSS = 'M4 4 L14 14 M14 4 L4 14';

function _num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : d; }
function _clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }
function _r1(n) { return Math.round(n * 10) / 10; }

// A comma list of Lc magnitudes → a clean numeric array (blank/junk dropped).
function _parseLc(s) {
  if (s == null) return [];
  // Trim + drop EMPTY entries before Number(): '' would coerce to 0, so a blank
  // lcTargets (the default) must yield [] here - not [0] - or it would zero every
  // target and shadow the contrastCurve preset. Also drops empties in '15,,45'.
  return String(s).split(',')
    .map(function (x) { return String(x).trim(); })
    .filter(function (x) { return x !== ''; })
    .map(Number)
    .filter(function (n) { return Number.isFinite(n) && n >= 0; });
}
// Resample an arbitrary target list to exactly `steps` entries by linear
// interpolation, so a user's `lcTargets` need not match the ramp length. An
// exact-length list round-trips unchanged; a single value fills every step.
function _fitTargets(list, steps) {
  if (list.length === 1) {
    var flat = [];
    for (var i = 0; i < steps; i++) flat.push(list[0]);
    return flat;
  }
  var out = [];
  for (var j = 0; j < steps; j++) {
    var t = steps <= 1 ? 0 : j / (steps - 1);
    var pos = t * (list.length - 1);
    var lo = Math.floor(pos);
    var hi = Math.min(list.length - 1, lo + 1);
    out.push(_r1(list[lo] + (list[hi] - list[lo]) * (pos - lo)));
  }
  return out;
}
// The per-step target Lc array: a custom list wins, else the named curve sampled
// dark→light across `steps`.
function _targets(curveKey, steps, custom) {
  var list = _parseLc(custom);
  if (list.length) return _fitTargets(list, steps);
  var ends = CURVES[curveKey] || CURVES.even;
  var out = [];
  for (var i = 0; i < steps; i++) {
    var t = steps <= 1 ? 0 : i / (steps - 1);
    out.push(_r1(ends[0] + (ends[1] - ends[0]) * t));
  }
  return out;
}

// Colour values can arrive via URL params and land raw inside SVG attributes -
// accept only a real hex form (an unresolved token alias flattens to '').
function _hex(v, fb) {
  v = (v == null ? '' : String(v)).trim().toLowerCase();
  var m3 = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (m3) return '#' + m3[1] + m3[1] + m3[2] + m3[2] + m3[3] + m3[3];
  var m6 = /^#?([0-9a-f]{6})$/.exec(v);
  return m6 ? '#' + m6[1] : fb;
}
function _rgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
function _toHex(r, g, b) {
  var s = function (v) { v = _clamp(Math.round(v), 0, 255).toString(16); return v.length === 1 ? '0' + v : v; };
  return '#' + s(r) + s(g) + s(b);
}
// sRGB mix - only used to derive ramp ENDPOINTS (near-black / near-white
// anchors around a colour); the perceptual interpolation between them is
// host.color.ramp's job.
function _mix(a, b, t) {
  var x = _rgb(a); var y = _rgb(b);
  return _toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

// ── local fallbacks (host.color absent - engines < 1.40 / schemes < 1.60) ────

function _lum(hex) {
  var c = _rgb(hex).map(function (v) {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function _wcagLocal(a, b) {
  var x = _lum(a) + 0.05; var y = _lum(b) + 0.05;
  return x > y ? x / y : y / x;
}
function _hsl(hex) {
  var c = _rgb(hex).map(function (v) { return v / 255; });
  var max = Math.max(c[0], c[1], c[2]); var min = Math.min(c[0], c[1], c[2]);
  var l = (max + min) / 2; var d = max - min;
  var s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  var h = 0;
  if (d !== 0) {
    if (max === c[0]) h = ((c[1] - c[2]) / d) % 6;
    else if (max === c[1]) h = (c[2] - c[0]) / d + 2;
    else h = (c[0] - c[1]) / d + 4;
    h *= 60;
  }
  return { h: (h + 360) % 360, s: s, l: l };
}
function _hslHex(h, s, l) {
  var c = (1 - Math.abs(2 * l - 1)) * s;
  var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  var m = l - c / 2;
  var r = [c, x, 0, 0, x, c][Math.floor(h / 60) % 6];
  var g = [x, c, c, x, 0, 0][Math.floor(h / 60) % 6];
  var b = [0, 0, x, c, c, x][Math.floor(h / 60) % 6];
  return _toHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
function _rampLocal(stops, n) {
  if (n <= 1) return [stops[0]];
  var out = [];
  for (var i = 0; i < n; i++) {
    var t = (i / (n - 1)) * (stops.length - 1);
    var k = Math.min(stops.length - 2, Math.floor(t));
    out.push(_mix(stops[k], stops[k + 1], t - k));
  }
  return out;
}

// ── host.color with graceful degradation ─────────────────────────────────────

function _api() {
  return typeof host !== 'undefined' && host && host.color ? host.color : null;
}
function _ramp(stops, n) {
  var c = _api();
  if (c && c.ramp) {
    try { return c.ramp(stops, n, { correctLightness: true }); } catch (e) { /* fall through */ }
  }
  return _rampLocal(stops, n);
}
function _contrast(a, b) {
  var c = _api();
  if (c && c.contrast) {
    var r = c.contrast(a, b);
    if (Number.isFinite(r)) return r;
  }
  return _wcagLocal(a, b);
}
function _apca(text, bg) {
  var c = _api();
  if (c && c.apca) {
    var r = c.apca(text, bg);
    if (Number.isFinite(r)) return r;
  }
  return null; // no local APCA - the badge just omits Lc on old shells
}
// Read a colour's OKLCH axes (engine >= 1.69). Null on older shells / bad input;
// callers supply their own neutral fallback so Contrast mode still degrades.
function _oklch(hex) {
  var c = _api();
  if (c && c.oklch) {
    try { var o = c.oklch(hex); if (o) return o; } catch (e) { /* fall through */ }
  }
  return null;
}
// Inverse APCA (engine >= 1.107): the tone of a given hue/chroma that reads at
// `targetLc` on `bg`. Returns the solver result ({ hex, lc, target, reachable })
// or null when the host can't solve - the caller then falls back to _ramp.
function _solve(hue, chroma, targetLc, bg) {
  var c = _api();
  if (c && c.solveApca) {
    try {
      var r = c.solveApca(hue, chroma, targetLc, bg);
      if (r && typeof r.hex === 'string' && r.hex) return r;
    } catch (e) { /* fall through */ }
  }
  return null;
}
function _accents(seed, kind) {
  var c = _api();
  if (c && c.schemes) {
    try {
      var got = c.schemes(seed, kind);
      if (got && got.length) return got.map(function (x) { return x.hex; });
    } catch (e) { /* fall through */ }
  }
  var base = _hsl(seed);
  return SCHEMES[kind].rot.map(function (d) { return _hslHex((base.h + d + 360) % 360, base.s, base.l); });
}

// ── the sheet ─────────────────────────────────────────────────────────────────

function _pickOn(bg) {
  return _contrast(bg, '#ffffff') >= _contrast(bg, '#111111') ? '#ffffff' : '#111111';
}
function _level(ratio) {
  return ratio >= 7 ? 'AAA' : ratio >= 4.5 ? 'AA' : ratio >= 3 ? 'AA18' : 'Low';
}

// Paint one colour as the chosen viewer sees it. 'normal' and anything the
// simulation cannot parse return the colour untouched, so a bad value degrades
// to the real sheet rather than to a blank fill.
function _see(hex, vision) {
  if (!VISIONS[vision]) return hex;
  var out = vision === 'gray' ? cvdGreyscaleHex(hex) : cvdSimulateHex(hex, vision);
  return out || hex;
}

// The contrast grid: every base colour as a foreground row on every base colour
// as a background column. Each cell states its own WCAG ratio, the level word
// and a tick/cross. Ratios are measured on the REAL colours - the simulation
// only repaints - and the diagonal is a colour on itself, so it reads 1.00:1
// 'Low' and is deliberately invisible: that is the finding.
function _grid(entries, vision) {
  var n = entries.length;
  var cellW = (GRID_RIGHT - GRID_X) / n;
  var cellH = (GRID_BOTTOM - GRID_TOP) / n;
  var rSize = _clamp(Math.min(cellW / 12, cellH / 3), 11, 20);
  var lSize = _r1(_clamp(rSize * 0.8, 10.5, 16));
  var cells = [];
  var rowHeads = [];
  var colHeads = [];

  entries.forEach(function (col, j) {
    colHeads.push({
      name: col.name,
      paint: _see(col.hex, vision),
      x: _r1(GRID_X + j * cellW + 4),
      y: GRID_HEAD_Y,
      textX: _r1(GRID_X + j * cellW + 34),
      textY: GRID_HEAD_Y + 17,
    });
  });

  entries.forEach(function (row, i) {
    var cy = GRID_TOP + i * cellH + cellH / 2;
    rowHeads.push({
      name: row.name,
      paint: _see(row.hex, vision),
      y: _r1(cy - 13),
      textY: _r1(cy + 5),
    });
    entries.forEach(function (col, j) {
      var x = GRID_X + j * cellW;
      var ratio = _contrast(row.hex, col.hex);
      var level = _level(ratio);
      cells.push({
        fg: row.hex,
        bg: col.hex,
        fgPaint: _see(row.hex, vision),
        bgPaint: _see(col.hex, vision),
        ratio: ratio.toFixed(2),
        ratioText: ratio.toFixed(2) + ':1',
        level: level,
        mark: (level === 'AA' || level === 'AAA') ? TICK : CROSS,
        x: _r1(x),
        y: _r1(GRID_TOP + i * cellH),
        w: _r1(cellW - 3),
        h: _r1(cellH - 3),
        markX: _r1(x + 14),
        markY: _r1(cy - 9),
        ratioX: _r1(x + 40),
        levelX: _r1(x + cellW - 17),
        textY: _r1(cy + rSize / 3),
        rSize: _r1(rSize),
        lSize: lSize,
      });
    });
  });
  return { cells: cells, rowHeads: rowHeads, colHeads: colHeads };
}

var _memoKey = null;
var _memoResult = null;
// The last computed flat swatch list, stashed for the exportStill hook - whose
// ctx carries { node, format, opts, host } but NOT the input model, so it can't
// recompute. onInit/onInput always run before any export, so this is current.
var _lastSwatches = [];
// Mirrors the transparentBg input for beforeExport, which (like exportStill)
// gets no input model - only { format, opts }.
var _transparentBg = false;

function compute(model) {
  var a = Object.fromEntries(model.map(function (i) { return [i.id, i.value]; }));

  // Neutral mid-blue fallback seed - an unresolved {color.semantic.primary}
  // alias flattens to '' on brands without tokens.
  var seed = _hex(a.seed, '#2d6bd8');
  var kind = SCHEMES[a.harmony] ? a.harmony : 'triad-3';
  var steps = _clamp(Math.round(_num(a.steps, 7)), 3, 11);
  var withNeutrals = !(a.neutrals === false || a.neutrals === 'false' || a.neutrals === 0);

  // Contrast mode: solve every ramp step to a target APCA Lc against `bg`. Only
  // taken when the host actually carries the inverse solver (engine >= 1.107) -
  // older shells fall back to the perceptual OKLab ramp. `bg` defaults to white
  // when its {color.semantic.surface} token doesn't resolve (neutral brands).
  var contrast = (a.mode === 'contrast') && Boolean(_api() && _api().solveApca);
  var bg = _hex(a.bg, '#ffffff');
  var curveKey = (a.contrastCurve && CURVES[a.contrastCurve]) ? a.contrastCurve : 'even';
  var lcCustom = (a.lcTargets == null ? '' : String(a.lcTargets)).trim();
  var targets = contrast ? _targets(curveKey, steps, lcCustom) : null;
  // 'classes' emits bg/text/border utility classes, else CSS custom properties.
  var cssStyle = a.cssStyle === 'classes' ? 'classes' : 'variables';

  // Review aids. Both default off, and both only touch what is PAINTED.
  var vision = VISIONS[a.vision] ? a.vision : 'normal';
  // An allowlist, not a truthiness test: `grid` is default-off, and it arrives
  // through URL params, so only an explicit yes turns it on.
  var showGrid = a.grid === true || a.grid === 'true' || a.grid === 1 || a.grid === '1';
  // The sheet's own backdrop only - swatches and ramp cells always stay opaque.
  var transparentBg = Boolean(a.transparentBg);
  _transparentBg = transparentBg;
  // The grid takes the bottom third of the fixed viewBox, so the ramp rows stop
  // higher up and their three text lines close up to match.
  var rowsBottom = showGrid ? ROWS_BOTTOM_GRID : ROWS_BOTTOM;

  // cssStyle is in the key so flipping variables↔classes re-emits the CSS export.
  var key = JSON.stringify([seed, kind, steps, withNeutrals, contrast, bg, curveKey, lcCustom, cssStyle, vision, showGrid, transparentBg]);
  if (key === _memoKey) return _memoResult;

  // Seed-tinted near-black / near-white anchors: paper & ink for the sheet
  // itself, and the endpoints of the neutral ramp.
  var nDark = _mix(seed, '#0b0c0e', 0.92);
  var nLight = _mix(seed, '#fbfaf8', 0.94);
  var paper = _mix(seed, '#fdfdfb', 0.96);
  var ink = _mix(seed, '#101114', 0.92);

  var entries = [{ name: 'Seed', key: 'seed', hex: seed, stops: null }];
  _accents(seed, kind).forEach(function (hx, i) {
    entries.push({ name: 'Accent ' + (i + 1), key: 'accent-' + (i + 1), hex: _hex(hx, seed), stops: null });
  });
  var neutralRamp = _ramp([nDark, nLight], steps);
  if (withNeutrals) {
    entries.push({
      name: 'Neutral',
      key: 'neutral',
      hex: neutralRamp[Math.floor((steps - 1) / 2)],
      ramp: neutralRamp,
    });
  }

  var rows = entries.length;
  var rowH = Math.min(220, (rowsBottom - ROWS_TOP - (rows - 1) * ROW_GAP) / rows);
  var blockH = rows * rowH + (rows - 1) * ROW_GAP;
  var startY = ROWS_TOP + (rowsBottom - ROWS_TOP - blockH) / 2;
  var cellW = (RAMP_W - (steps - 1) * CELL_GAP) / steps;
  // Name / hex / badge are three fixed-size lines. At the roomy offsets the hex
  // sits on y+78 and the badge on y+rowH-24, so their clearance is rowH-102: the
  // badge needs about 24px of it to stay off the hex descender, which puts the
  // switch at 126, not 102. Below that they close up (clearance rowH-61). The
  // shortest row the sheet can produce without the grid is 144, so the default
  // geometry never reaches this.
  var tight = rowH < 126;

  var perceptual = Boolean(_api() && _api().ramp);
  var swatches = [];
  var csvRows = [];
  // Flat swatch rows for host.color palette exchange. The keys mirror the DTCG
  // tokens tree below EXACTLY (base 'color.<key>', ramp 'color.ramp.<key>.<step>')
  // so the CSS/SCSS/GIMP/ASE files and the tokens JSON describe the same palette.
  var paletteSwatches = [];
  var tokenColors = { $type: 'color' };
  var tokenRamps = {};

  entries.forEach(function (e, i) {
    var y = startY + i * (rowH + ROW_GAP);
    var on = _pickOn(e.hex);
    var ratio = _contrast(e.hex, on);
    var lc = _apca(on, e.hex);
    // `paint` is what the rect is filled with; `hex` stays the real colour the
    // label prints. `onPaint` keeps that label legible against the paint.
    var paint = _see(e.hex, vision);
    var onPaint = _pickOn(paint);

    // Build this entry's ramp. Contrast mode reads the entry's hue+chroma and
    // solves each step to its target Lc against `bg` (recording achieved Lc + a
    // reachability flag); otherwise it's the perceptual OKLab tonal ramp (a
    // neutrals entry brings its own pre-built ramp).
    var hexes;
    var cellMeta = null;
    if (contrast) {
      var base = _oklch(e.hex) || { l: 0.5, c: 0.08, h: 0 };
      cellMeta = targets.map(function (tg) {
        var r = _solve(base.h, base.c, tg, bg);
        var hx = r ? _hex(r.hex, e.hex) : e.hex;
        var achieved = r && Number.isFinite(r.lc) ? Math.abs(r.lc) : null;
        return { hex: hx, target: Math.abs(tg), achieved: achieved, reachable: r ? !!r.reachable : false };
      });
      hexes = cellMeta.map(function (m) { return m.hex; });
    } else {
      hexes = e.ramp || _ramp([_mix(e.hex, '#0b0c0e', 0.85), e.hex, _mix(e.hex, '#ffffff', 0.9)], steps);
    }

    // Row badge: OKLab shows the swatch's own WCAG ratio + APCA Lc; Contrast
    // summarises the ramp's target span and how many steps had to be capped
    // (target beyond what this hue can carry against the background).
    var badges;
    if (contrast) {
      var capped = cellMeta.filter(function (m) { return !m.reachable; }).length;
      var tlo = Math.round(Math.min.apply(null, cellMeta.map(function (m) { return m.target; })));
      var thi = Math.round(Math.max.apply(null, cellMeta.map(function (m) { return m.target; })));
      badges = 'APCA on ' + bg + ' · Lc ' + tlo + '-' + thi + (capped ? ' · ' + capped + ' capped' : ' · all reached');
    } else {
      badges = ratio.toFixed(1) + ':1 ' + _level(ratio) + (lc == null ? '' : ' · Lc ' + Math.round(Math.abs(lc)));
    }

    // Base row first so each colour groups with its own ramp cells in the CSV.
    // The base swatch describes its own-label legibility in both modes; the
    // target/reach columns belong to the solved ramp cells below.
    csvRows.push({
      name: e.key,
      hex: e.hex,
      on: on,
      wcag: ratio.toFixed(2),
      level: _level(ratio),
      apca: lc == null ? '' : String(Math.round(Math.abs(lc))),
      target: '',
      reach: '',
    });
    paletteSwatches.push({ key: 'color.' + e.key, name: e.name, group: 'Palette', hex: e.hex });

    var cells = hexes.map(function (hx, j) {
      var x = RAMP_X + j * (cellW + CELL_GAP);
      var cOn = _pickOn(hx);
      var cRatio = _contrast(hx, cOn);
      var meta = cellMeta ? cellMeta[j] : null;
      // Contrast: the meaningful Lc is against the BACKGROUND (what was targeted),
      // from the solver; OKLab: against the cell's own label, as before.
      var cLc;
      if (meta) { cLc = meta.achieved; }
      else { var raw = _apca(cOn, hx); cLc = raw == null ? null : Math.abs(raw); }
      csvRows.push({
        name: e.key + '-' + (j + 1) * 100,
        hex: hx,
        on: cOn,
        wcag: cRatio.toFixed(2),
        level: _level(cRatio),
        apca: cLc == null ? '' : String(Math.round(cLc)),
        target: meta ? String(Math.round(meta.target)) : '',
        reach: meta ? (meta.reachable ? 'yes' : 'no') : '',
      });
      paletteSwatches.push({ key: 'color.ramp.' + e.key + '.' + (j + 1) * 100, name: e.name + ' ' + (j + 1) * 100, group: e.name + ' ramp', hex: hx });
      var cPaint = _see(hx, vision);
      return { hex: hx, paint: cPaint, on: _pickOn(cPaint), x: _r1(x), w: _r1(cellW), cx: _r1(x + cellW / 2) };
    });

    tokenColors[e.key] = { $value: e.hex };
    var group = {};
    hexes.forEach(function (hx, j) {
      var tok = { $value: hx };
      // Contrast mode carries the per-step solve as a namespaced DTCG extension so
      // the copied tokens record what each tone was solved to reach, and whether
      // it did (a capped step is the closest achievable, flagged not the target).
      if (cellMeta) {
        var m = cellMeta[j];
        tok.$extensions = {
          'org.lolly.apca': { targetLc: m.target, achievedLc: m.achieved, reachable: m.reachable, bg: bg },
        };
      }
      group[String((j + 1) * 100)] = tok;
    });
    tokenRamps[e.key] = group;

    swatches.push({
      name: e.name,
      hex: e.hex,
      paint: paint,
      on: onPaint,
      badges: badges,
      y: _r1(y),
      h: _r1(rowH),
      nameY: _r1(y + (tight ? 28 : 44)),
      hexY: _r1(y + (tight ? 52 : 78)),
      badgeY: _r1(y + rowH - (tight ? 9 : 24)),
      cellLabelY: _r1(y + rowH / 2 + 5),
      ramp: cells,
    });
  });

  // baseSubtitle describes the palette itself and is what the tokens document
  // records; the sheet's own line adds the simulation note on top, so a preview
  // never rewrites the exported tokens.
  var baseSubtitle = contrast
    ? 'Seed ' + seed + ' · ' + SCHEMES[kind].label + ' · Contrast (APCA) on ' + bg + ' · ' + steps + '-step'
    : 'Seed ' + seed + ' · ' + SCHEMES[kind].label + ' · ' + steps + '-step ' + (perceptual ? 'OKLab ramps' : 'ramps');
  var subtitle = baseSubtitle + (vision === 'normal' ? '' : ' · ' + VISIONS[vision] + ' preview, labels show the real hex');
  tokenColors.ramp = tokenRamps;
  var tokensJson = JSON.stringify({ $description: 'Palette Lab - ' + baseSubtitle, color: tokenColors }, null, 2);

  // The grid runs over the BASE colours (seed, accents, neutral mid) plus the
  // sheet's own paper and ink - a matrix over every ramp cell would be
  // unreadable at this size. Paper and ink are in it because harmony accents all
  // share a lightness by construction: a grid of accents alone is every-cell-Low
  // for any seed, which teaches nothing. Against the palette's own near-white
  // and near-black it answers the question people actually have - which of these
  // colours can carry text, and on what.
  var gridEntries = entries.concat([
    { name: 'Paper', hex: paper },
    { name: 'Ink', hex: ink },
  ]);
  var grid = showGrid ? _grid(gridEntries, vision) : { cells: [], rowHeads: [], colHeads: [] };
  var gridCsvRows = grid.cells.map(function (c) {
    return { fg: c.fg, bg: c.bg, ratio: c.ratio, level: c.level };
  });

  // Palette-exchange files, from the flat swatch list via host.color (engine
  // >= 1.108). css-vars vs css-classes follows the cssStyle input. Feature-
  // detected: on an older shell these stay empty (the CSS/SCSS/GIMP exports
  // download blank rather than fail), and .ase is declined in exportStill.
  var paletteName = 'Palette Lab';
  var paletteCss = '';
  var paletteScss = '';
  var paletteGpl = '';
  var capi = _api();
  if (capi && capi.paletteExport) {
    try {
      paletteCss = capi.paletteExport(paletteSwatches, cssStyle === 'classes' ? 'css-classes' : 'css-vars', { paletteName: paletteName }) || '';
      paletteScss = capi.paletteExport(paletteSwatches, 'scss', { paletteName: paletteName }) || '';
      paletteGpl = capi.paletteExport(paletteSwatches, 'gpl', { paletteName: paletteName }) || '';
    } catch (e) { /* degrade to empty */ }
  }
  _lastSwatches = paletteSwatches;

  _memoKey = key;
  _memoResult = {
    // paperFill paints the sheet's own backdrop rect (none when transparent);
    // paper stays the real tint the grid's own "Paper" swatch shows and measures.
    paperFill: transparentBg ? 'none' : paper,
    ink: ink,
    hairline: ink + '22',
    subtitle: subtitle,
    swatches: swatches,
    gridOn: showGrid,
    gridTitle: 'Contrast grid - ' + gridEntries.length + ' colours, foreground rows on background columns (WCAG 2.1)',
    gridCells: grid.cells,
    gridRowHeads: grid.rowHeads,
    gridColHeads: grid.colHeads,
    gridCsvRows: gridCsvRows,
    csvRows: csvRows,
    tokensJson: tokensJson,
    paletteSwatches: paletteSwatches,
    paletteCss: paletteCss,
    paletteScss: paletteScss,
    paletteGpl: paletteGpl,
  };
  return _memoResult;
}

async function onInit(ctx) { return Object.assign({}, compute(ctx.model), await resolvedFonts()); }
function onInput(ctx) { return onInit(ctx); }

function beforeExport({ format, opts }) {
  // Clear the container background for alpha-capable raster formats so the
  // sheet's fill:none backdrop rect isn't composited onto an opaque canvas.
  // (svg carries the fill:none straight through; jpg/csv/json/css/scss/gpl/ase
  // have no alpha channel to preserve.)
  var alphaFormats = ['png', 'webp'];
  if (_transparentBg && alphaFormats.includes(format)) {
    opts.background = 'transparent';
  }
}

// Own the binary Adobe .ase export: build the swatch file from the last computed
// palette via host.color.paletteExportBytes (engine >= 1.108) and return its
// bytes, short-circuiting the DOM raster path. Every other format (svg/png/csv/
// json/css/scss/gpl) declines (null) and falls through unchanged. Guarded on the
// host primitive so an older shell simply doesn't offer a working .ase.
function exportStill(ctx) {
  if (!ctx || ctx.format !== 'ase') return null;
  var capi = (ctx.host && ctx.host.color) || _api();
  if (!capi || !capi.paletteExportBytes || !_lastSwatches.length) return null;
  try {
    var bytes = capi.paletteExportBytes(_lastSwatches, 'ase');
    return bytes && bytes.length ? { bytes: bytes, mime: 'application/octet-stream' } : null;
  } catch (e) { return null; }
}

// Carry concrete font families in the template too: headless SVG has no CSS cascade.
async function resolvedFonts() {
  var fonts = { _fontBrand: 'SUSE', _fontMono: 'SUSE Mono' };
  if (host && host.tokens && host.tokens.resolve) {
    for (var pair of [['_fontBrand', 'brand'], ['_fontMono', 'mono']]) {
      try {
        var value = await host.tokens.resolve('{font.' + pair[1] + '}');
        if (Array.isArray(value)) value = value.join(', ');
        if (typeof value === 'string' && value.trim() && value[0] !== '{') fonts[pair[0]] = value;
      } catch (e) { /* retain the shell-served fallback face */ }
    }
  }
  return fonts;
}
