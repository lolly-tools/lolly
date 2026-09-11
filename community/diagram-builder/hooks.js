/* global onInit, onInput, host */

/**
 * Diagram Builder - org / tree / mindmap / layercake / process / timeline /
 * cycle / pyramid / funnel / kanban / matrix / gantt, from visual cards, a typed
 * text DSL, ASCII art, a Mermaid subset, or a pasted CSV/table.
 *
 * SVG-rooted tool: the whole scene is built as an <svg> STRING here and rendered
 * verbatim by the template ({{{diagramSvg}}}). Layout is pure JS, so it renders
 * identically in the browser and headless in the CLI. The one browser-only touch is
 * optional card images: in a browser they're embedded as a self-contained data URL
 * and measured for aspect; headless degrades gracefully.
 *
 * EXPORT SAFETY (verified 2026-06-30 against shells/web/src/bridge/export.js +
 * engine/src/{svg-path,emf}.js, correcting the older note here):
 *   - PDF walker (drawSvgVectorsInRegion) honours <path> (full M/L/H/V/C/S/Q/T/A/Z,
 *     fill + stroke + fill-rule + opacity), <line> (stroke ONLY, own attr), <rect>
 *     (fill + stroke), <circle> (fill + stroke), <text> (anchors start/mid/end, one
 *     run, brand face/Helvetica), <image>. It DROPS <ellipse>/<polygon>/<polyline>/
 *     <marker>, stroke-dasharray, leaf transforms, and gradients.
 *   - EMF/EPS walker adds ellipse/polygon/polyline but is RGB-only, solid-pen only
 *     (no dasharray), skips <image>, and THROWS on unresolvable fonts / letter-spacing.
 *   - SVG export is a verbatim passthrough; PNG is faithful (browser raster).
 * The portable subset we therefore stick to: shapes are fill+own-stroke <path>
 * (rounded-rect cards/bands, trapezoids, circle dots via 4 cubics), connectors are
 * <line>/<path> with own stroke, dashes/dots are REAL segment geometry (never
 * dasharray), arrowheads are computed filled <path>/<line> (never <marker> or
 * transforms), text is one font run per line. No <ellipse>/<polygon>/<polyline>.
 *
 * Links are free-text IDs (not row indexes): a card references its parent/layer/
 * arrow endpoint by ID, resolved here. Unknown refs degrade gracefully.
 */

// ── Static palette fallbacks (overwritten by the brand's own tokens below) ────
var PINE = '#0c322c', FOG = '#efefef', WHITE = '#ffffff', DETAIL = '#6f6f6f';
var BAND_PALETTE = ['#90ebcd', '#bff1ea', '#d8f3ec', '#efefef'];

// Theme / density / preset tables (seed inputs via the hook-patch mechanism).
// 'brand-light'/'brand-dark' start out as the static hexes below and are
// overwritten in place by ensureBrandThemes() with the active brand's own
// color.semantic.* tokens - so every brand's diagram follows its own palette
// instead of staying on the shipped green forever.
var THEMES = {
  'brand-light': { nodeFill: '#ffffff', nodeStroke: '#0c322c', nodeText: '#0c322c', edgeColor: '#0c322c', background: '#ffffff', detail: '#6f6f6f', bandPalette: ['#90ebcd', '#bff1ea', '#d8f3ec', '#efefef'] },
  'brand-dark':  { nodeFill: '#0c322c', nodeStroke: '#90ebcd', nodeText: '#ffffff', edgeColor: '#90ebcd', background: '#0c322c', detail: '#9fc7bb', bandPalette: ['#14463d', '#1c5a4e', '#247060', '#2e8573'] },
  'blueprint':  { nodeFill: '#0a2540', nodeStroke: '#7fd4ff', nodeText: '#eaf6ff', edgeColor: '#7fd4ff', background: '#0a2540', detail: '#9fc2dd', bandPalette: ['#10314f', '#163c5e', '#1c476d', '#22527c'] },
  'mono':       { nodeFill: '#ffffff', nodeStroke: '#111111', nodeText: '#111111', edgeColor: '#111111', background: '#ffffff', detail: '#666666', bandPalette: ['#eeeeee', '#e2e2e2', '#d6d6d6', '#cacaca'] },
  'mint':       { nodeFill: '#ffffff', nodeStroke: '#0c322c', nodeText: '#0c322c', edgeColor: '#0c322c', background: '#eafaf4', detail: '#6f6f6f', bandPalette: ['#90ebcd', '#bff1ea', '#d8f3ec', '#effbf7'] }
};
var DENSITY = {
  compact:     { rowGap: 34,  siblingGap: 16, cardScale: 0.85 },
  cozy:        { rowGap: 56,  siblingGap: 30, cardScale: 1.0 },
  comfortable: { rowGap: 84,  siblingGap: 44, cardScale: 1.1 },
  spacious:    { rowGap: 120, siblingGap: 64, cardScale: 1.25 }
};
var PRESETS = {
  'org-classic':    { diagramType: 'org', orgDir: 'down', theme: 'brand-light', density: 'cozy' },
  'layercake-mint': { diagramType: 'layercake', theme: 'mint', density: 'cozy' },
  'process-lr':     { diagramType: 'process', flowDir: 'right', theme: 'brand-light', arrowHead: 'triangle', density: 'cozy' },
  'blueprint':      { diagramType: 'process', theme: 'blueprint', gridBg: 'grid', density: 'comfortable' },
  'mono':           { theme: 'mono', density: 'cozy' }
};

// ── dynamic brand theme (color.semantic.* → THEMES['brand-light'/'brand-dark']) ──
// host.tokens.colors() (unlike host.tokens.resolve()) always comes back hex-
// normalised regardless of the brand doc's native colour format (hex, oklch,
// rgb, …) - see engine/src/tokens.ts toSwatch() - so this needs no colour-math
// of its own; tools never import the engine. Runs once per mount; a brand with
// no resolvable semantic slots (or a shell with no tokens support) leaves the
// static defaults above untouched.
var _brandThemesReady = null;
function mixHex(a, b, t) {
  var ar = parseInt(a.slice(1), 16), br = parseInt(b.slice(1), 16);
  var ch = function (shift) {
    var av = (ar >> shift) & 255, bv = (br >> shift) & 255;
    return clamp(Math.round(lerp(av, bv, t)), 0, 255);
  };
  var r = ch(16), g = ch(8), bl = ch(0);
  return '#' + [r, g, bl].map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
}
async function ensureBrandThemes() {
  if (_brandThemesReady) return _brandThemesReady;
  _brandThemesReady = (async function () {
    try {
      if (!host || !host.tokens || !host.tokens.colors) return;
      var swatches = await host.tokens.colors({ theme: 'light' });
      var byPath = {};
      swatches.forEach(function (s) { if (s && s.path) byPath[s.path] = s.value; });
      var slot = function (name) {
        var hex = byPath['color.semantic.' + name];
        return typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex) ? hex : null;
      };
      var light = { primary: slot('primary'), onPrimary: slot('on-primary'), secondary: slot('secondary'), surface: slot('surface'), text: slot('text'), muted: slot('muted') };
      if (light.primary && light.onPrimary && light.secondary && light.surface && light.text) {
        THEMES['brand-light'] = {
          nodeFill: light.surface, nodeStroke: light.primary, nodeText: light.text, edgeColor: light.primary,
          background: light.surface, detail: light.muted || THEMES['brand-light'].detail,
          bandPalette: [mixHex(light.secondary, light.surface, 0.15), mixHex(light.secondary, light.surface, 0.45), mixHex(light.secondary, light.surface, 0.7), mixHex(light.secondary, light.surface, 0.9)]
        };
      }
      var darkSet = await host.tokens.colors({ theme: 'dark' });
      var byPathDark = {};
      darkSet.forEach(function (s) { if (s && s.path) byPathDark[s.path] = s.value; });
      var dslot = function (name) {
        var hex = byPathDark['color.semantic.' + name];
        return typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex) ? hex : null;
      };
      var dark = { primary: dslot('primary'), onPrimary: dslot('on-primary'), secondary: dslot('secondary'), surface: dslot('surface'), text: dslot('text'), muted: dslot('muted') };
      if (dark.primary && dark.onPrimary && dark.secondary && dark.surface && dark.text) {
        THEMES['brand-dark'] = {
          nodeFill: dark.surface, nodeStroke: dark.primary, nodeText: dark.text, edgeColor: dark.primary,
          background: dark.surface, detail: dark.muted || THEMES['brand-dark'].detail,
          bandPalette: [mixHex(dark.surface, dark.secondary, 0.25), mixHex(dark.surface, dark.secondary, 0.5), mixHex(dark.surface, dark.secondary, 0.75), mixHex(dark.surface, dark.secondary, 0.95)]
        };
      }
    } catch (e) {
      if (host && host.log) host.log('warn', 'diagram-builder: brand theme resolution failed', { error: String(e) });
    }
  })();
  return _brandThemesReady;
}
var VALID_TYPES = { org: 1, layercake: 1, process: 1, timeline: 1, cycle: 1, pyramid: 1, kanban: 1, matrix: 1, mindmap: 1, gantt: 1 };

// ── small helpers ─────────────────────────────────────────────────────────────
function inputsFrom(model) { var o = {}; model.forEach(function (i) { o[i.id] = i.value; }); return o; }
function num(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
// === lolly:shared clamp - generated from community/_shared/math.js; edit there and run npm run sync:shared ===
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
// === /lolly:shared clamp ===
function f2(v) { return Math.round(v * 100) / 100; }
function arr(v) { return Array.isArray(v) ? v : []; }
function trim(v) { return String(v == null ? '' : v).trim(); }
function lerp(a, b, t) { return a + (b - a) * t; }
// === lolly:shared esc - generated from community/_shared/text.js; edit there and run npm run sync:shared ===
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// === /lolly:shared esc ===
function color(v, fallback) {
  var s = (typeof v === 'string' ? v : '').trim();
  if (s.toLowerCase() === 'transparent') return 'transparent';
  return /^#[0-9a-f]{3,8}$/i.test(s) || /^(rgb|hsl)a?\([\d%.,\s/]+\)$/i.test(s) ? s : fallback;
}
function slug(s) { return trim(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function titleize(s) { s = String(s == null ? '' : s).replace(/[-_]+/g, ' ').trim(); return s.replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

// Non-fatal notes about the data (a date we could not read, rows we had to mix on
// one axis). They travel out as the `ganttWarning` extra and the console, never as
// ink: an exported roadmap must not carry our diagnostics. Reset per build.
var _notes = [];
function note(msg) { if (_notes.length < 6 && _notes.indexOf(msg) < 0) _notes.push(msg); }

// ── auto-contrast text (house pattern: shells/web/src/palette.js + sibling tools) ──
// WCAG relative luminance of a #hex; null for transparent/rgb()/invalid (unmeasurable).
function relLuminance(hex) {
  var s = String(hex == null ? '' : hex).replace('#', '');
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(s)) return null;
  var h = s.length === 3 ? s.replace(/(.)/g, '$1$1') : s;
  function lin(i) { var v = parseInt(h.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  return 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
}
function contrastRatio(l1, l2) { var hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); }
// Text ink for a coloured fill: keep the chosen `prefer` colour while it stays
// readable on `fill`, otherwise flip to white (dark fill) or brand pine (light fill).
// A non-hex fill (transparent / rgb() / gradient) keeps `prefer` unchanged.
function inkOn(fill, prefer) {
  var lf = relLuminance(fill);
  if (lf == null) return prefer;
  var lp = relLuminance(prefer);
  if (lp != null && contrastRatio(lf, lp) >= 3) return prefer;
  return lf < 0.5 ? '#ffffff' : '#0c322c';
}

// Greedy word-wrap into at most `maxLines` lines of ~maxChars each.
function wrapLines(text, maxChars, maxLines, quiet) {
  maxChars = Math.max(4, Math.floor(maxChars));
  var words = trim(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  var lines = [], cur = '', i = 0;
  for (; i < words.length; i++) {
    var w = words[i];
    if (w.length > maxChars) {
      words.splice(i + 1, 0, w.slice(maxChars)); w = w.slice(0, maxChars);
    }
    var cand = cur ? cur + ' ' + w : w;
    if (!cur || cand.length <= maxChars) { cur = cand; }
    else {
      lines.push(cur); cur = w;
      if (lines.length === maxLines) { cur = ''; break; }
    }
  }
  if (cur) lines.push(cur);
  if ((i < words.length) || lines.length > maxLines) {
    if (!quiet) note('Some text is shortened. Increase Card width or reduce Label size in Layout / Style, or shorten the card text.');
    lines = lines.slice(0, maxLines);
    var k = lines.length - 1;
    if (k >= 0) {
      var l = lines[k];
      if (l.length > maxChars - 1) l = l.slice(0, Math.max(1, maxChars - 1));
      if (!/…$/.test(l)) l += '…';
      lines[k] = l;
    }
  }
  return lines;
}
function estLineCount(text, maxChars) { return wrapLines(text, maxChars, 6, true).length; }
function maxCharsFor(width, fontSize) { return Math.max(4, Math.floor((width - 18) / (fontSize * 0.56))); }
function textWidth(str, fontSize) { return String(str).length * fontSize * 0.62; }

// ── SVG primitives (baseline computed; export-safe subset only) ──────────────────
// Standalone-file fallback only: the DECIDING rule is `svg text` in styles.css,
// which points at the active brand's face via --font-brand. The vector export
// walker reads a run's COMPUTED font-family, so outlining picks up that rule.
var FONT = 'SUSE', FONT_MONO = 'SUSE Mono';
function textEl(x, y, str, size, weight, fill, anchor, cls) {
  return '<text ' + (cls ? 'class="' + cls + '" ' : '') + 'x="' + f2(x) + '" y="' + f2(y) + '" font-family="' + esc(cls === 'db-axis' ? FONT_MONO : FONT) + '"'
    + ' font-size="' + f2(size) + '" font-weight="' + weight + '" fill="' + esc(fill) + '"'
    + ' text-anchor="' + (anchor || 'middle') + '">' + esc(str) + '</text>';
}
// Rounded-rect as a path (M/L/C/Z only). r is clamped.
function roundedRectPath(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  var x2 = x + w, y2 = y + h;
  if (r <= 0.01) {
    return 'M' + f2(x) + ' ' + f2(y) + 'L' + f2(x2) + ' ' + f2(y)
      + 'L' + f2(x2) + ' ' + f2(y2) + 'L' + f2(x) + ' ' + f2(y2) + 'Z';
  }
  var k = r * 0.5523;
  return 'M' + f2(x + r) + ' ' + f2(y)
    + 'L' + f2(x2 - r) + ' ' + f2(y)
    + 'C' + f2(x2 - r + k) + ' ' + f2(y) + ' ' + f2(x2) + ' ' + f2(y + r - k) + ' ' + f2(x2) + ' ' + f2(y + r)
    + 'L' + f2(x2) + ' ' + f2(y2 - r)
    + 'C' + f2(x2) + ' ' + f2(y2 - r + k) + ' ' + f2(x2 - r + k) + ' ' + f2(y2) + ' ' + f2(x2 - r) + ' ' + f2(y2)
    + 'L' + f2(x + r) + ' ' + f2(y2)
    + 'C' + f2(x + r - k) + ' ' + f2(y2) + ' ' + f2(x) + ' ' + f2(y2 - r + k) + ' ' + f2(x) + ' ' + f2(y2 - r)
    + 'L' + f2(x) + ' ' + f2(y + r)
    + 'C' + f2(x) + ' ' + f2(y + r - k) + ' ' + f2(x + r - k) + ' ' + f2(y) + ' ' + f2(x + r) + ' ' + f2(y)
    + 'Z';
}
// Trapezoid (4 straight segments) - funnel/pyramid tiers; fill + own stroke = PDF/EMF safe.
function trapezoidPath(xTL, xTR, xBL, xBR, yT, yB) {
  return 'M' + f2(xTL) + ' ' + f2(yT) + 'L' + f2(xTR) + ' ' + f2(yT)
    + 'L' + f2(xBR) + ' ' + f2(yB) + 'L' + f2(xBL) + ' ' + f2(yB) + 'Z';
}
// Circle as 4 cubic beziers (we never emit <ellipse>; <circle> is safe but a path is
// portable everywhere and matches the card discipline). Used for dots + arrowheads.
function circlePath(cx, cy, r) {
  var k = 0.5523 * r;
  return 'M' + f2(cx + r) + ' ' + f2(cy)
    + 'C' + f2(cx + r) + ' ' + f2(cy + k) + ' ' + f2(cx + k) + ' ' + f2(cy + r) + ' ' + f2(cx) + ' ' + f2(cy + r)
    + 'C' + f2(cx - k) + ' ' + f2(cy + r) + ' ' + f2(cx - r) + ' ' + f2(cy + k) + ' ' + f2(cx - r) + ' ' + f2(cy)
    + 'C' + f2(cx - r) + ' ' + f2(cy - k) + ' ' + f2(cx - k) + ' ' + f2(cy - r) + ' ' + f2(cx) + ' ' + f2(cy - r)
    + 'C' + f2(cx + k) + ' ' + f2(cy - r) + ' ' + f2(cx + r) + ' ' + f2(cy - k) + ' ' + f2(cx + r) + ' ' + f2(cy)
    + 'Z';
}
// A straight / dashed / dotted run between two points, as real <line> geometry
// (NOT stroke-dasharray, which every vector export drops).
function shaft(x1, y1, x2, y2, style, col, width) {
  var len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 0.5) return '';
  if (style !== 'dashed' && style !== 'dotted') {
    return '<line x1="' + f2(x1) + '" y1="' + f2(y1) + '" x2="' + f2(x2) + '" y2="' + f2(y2)
      + '" stroke="' + esc(col) + '" stroke-width="' + f2(width) + '"/>';
  }
  var ux = (x2 - x1) / len, uy = (y2 - y1) / len, out = '', pos = 0;
  var dash = style === 'dotted' ? Math.max(width, 1.2) : 8;
  var gap = style === 'dotted' ? width * 2 + 2 : 5;
  var cap = style === 'dotted' ? ' stroke-linecap="round"' : '';
  while (pos < len) {
    var a = pos, b = Math.min(pos + dash, len);
    out += '<line x1="' + f2(x1 + ux * a) + '" y1="' + f2(y1 + uy * a) + '" x2="' + f2(x1 + ux * b)
      + '" y2="' + f2(y1 + uy * b) + '" stroke="' + esc(col) + '" stroke-width="' + f2(width) + '"' + cap + '/>';
    pos += dash + gap;
  }
  return out;
}

// ── real card shapes (all export-safe: straight segments + cubic beziers, own
// fill + own stroke, never <ellipse>/<marker>/dasharray) ─────────────────────────
// Ellipse as 4 cubic beziers (portable everywhere, matches the circlePath discipline).
function ellipsePath(cx, cy, rx, ry) {
  var kx = 0.5523 * rx, ky = 0.5523 * ry;
  return 'M' + f2(cx + rx) + ' ' + f2(cy)
    + 'C' + f2(cx + rx) + ' ' + f2(cy + ky) + ' ' + f2(cx + kx) + ' ' + f2(cy + ry) + ' ' + f2(cx) + ' ' + f2(cy + ry)
    + 'C' + f2(cx - kx) + ' ' + f2(cy + ry) + ' ' + f2(cx - rx) + ' ' + f2(cy + ky) + ' ' + f2(cx - rx) + ' ' + f2(cy)
    + 'C' + f2(cx - rx) + ' ' + f2(cy - ky) + ' ' + f2(cx - kx) + ' ' + f2(cy - ry) + ' ' + f2(cx) + ' ' + f2(cy - ry)
    + 'C' + f2(cx + kx) + ' ' + f2(cy - ry) + ' ' + f2(cx + rx) + ' ' + f2(cy - ky) + ' ' + f2(cx + rx) + ' ' + f2(cy)
    + 'Z';
}
// The set of shapes the renderer understands (also the normaliseNodes allow-list).
var SHAPES = { box: 1, rounded: 1, pill: 1, oval: 1, circle: 1, ellipse: 1, cylinder: 1, file: 1, diamond: 1, hexagon: 1, text: 1 };
// shapeGeom(shape,x,y,w,h,S) → { outline, decor, tb } where outline is a path `d`
// filled+stroked as the card body, decor is ready-to-emit non-filled detail lines
// (cylinder lip, file fold) with their OWN stroke, and tb is the centred text box.
function shapeGeom(shape, x, y, w, h, S, strokeCol, strokeW) {
  var cx = x + w / 2, cy = y + h / 2, x2 = x + w, y2 = y + h;
  var full = { x: x, y: y, w: w, h: h };
  var stroke = strokeW > 0 ? strokeW : (S && S.cardBorderWidth > 0) ? S.cardBorderWidth : 1.3;
  var scol = strokeCol || (S ? S.nodeStroke : PINE);
  function decorPath(d) { return '<path d="' + d + '" fill="none" stroke="' + esc(scol) + '" stroke-width="' + f2(stroke) + '" stroke-linejoin="round"/>'; }

  if (shape === 'text') return { outline: '', decor: '', tb: full };
  if (shape === 'pill' || shape === 'oval') {
    var pr = Math.min(w, h) / 2, pin = Math.min(w, h) * 0.14;
    return { outline: roundedRectPath(x, y, w, h, pr), decor: '', tb: { x: x + pin, y: y, w: Math.max(8, w - pin * 2), h: h } };
  }
  if (shape === 'circle' || shape === 'ellipse') {
    return { outline: ellipsePath(cx, cy, w / 2, h / 2), decor: '', tb: { x: cx - w * 0.355, y: cy - h * 0.355, w: w * 0.71, h: h * 0.71 } };
  }
  if (shape === 'cylinder') {
    var cap = clamp(Math.min(h * 0.16, w * 0.42), 4, 16), ky = 0.5523 * cap, kx = 0.5523 * (w / 2);
    var yb = y2 - cap;
    var out = 'M' + f2(x) + ' ' + f2(y + cap)
      + 'L' + f2(x) + ' ' + f2(yb)
      + 'C' + f2(x) + ' ' + f2(yb + ky) + ' ' + f2(cx - kx) + ' ' + f2(y2) + ' ' + f2(cx) + ' ' + f2(y2)
      + 'C' + f2(cx + kx) + ' ' + f2(y2) + ' ' + f2(x2) + ' ' + f2(yb + ky) + ' ' + f2(x2) + ' ' + f2(yb)
      + 'L' + f2(x2) + ' ' + f2(y + cap)
      + 'C' + f2(x2) + ' ' + f2(y + cap - ky) + ' ' + f2(cx + kx) + ' ' + f2(y) + ' ' + f2(cx) + ' ' + f2(y)
      + 'C' + f2(cx - kx) + ' ' + f2(y) + ' ' + f2(x) + ' ' + f2(y + cap - ky) + ' ' + f2(x) + ' ' + f2(y + cap) + 'Z';
    var lip = 'M' + f2(x) + ' ' + f2(y + cap)
      + 'C' + f2(x) + ' ' + f2(y + cap + ky) + ' ' + f2(cx - kx) + ' ' + f2(y + 2 * cap) + ' ' + f2(cx) + ' ' + f2(y + 2 * cap)
      + 'C' + f2(cx + kx) + ' ' + f2(y + 2 * cap) + ' ' + f2(x2) + ' ' + f2(y + cap + ky) + ' ' + f2(x2) + ' ' + f2(y + cap);
    return { outline: out, decor: decorPath(lip), tb: { x: x, y: y + 2 * cap, w: w, h: Math.max(8, h - 3 * cap) } };
  }
  if (shape === 'file') {
    var fs = clamp(Math.min(w, h) * 0.24, 8, 20);
    var o = 'M' + f2(x) + ' ' + f2(y) + 'L' + f2(x2 - fs) + ' ' + f2(y) + 'L' + f2(x2) + ' ' + f2(y + fs)
      + 'L' + f2(x2) + ' ' + f2(y2) + 'L' + f2(x) + ' ' + f2(y2) + 'Z';
    var fold = 'M' + f2(x2 - fs) + ' ' + f2(y) + 'L' + f2(x2 - fs) + ' ' + f2(y + fs) + 'L' + f2(x2) + ' ' + f2(y + fs);
    return { outline: o, decor: decorPath(fold), tb: { x: x, y: y + fs * 0.6, w: w, h: Math.max(8, h - fs * 0.6) } };
  }
  if (shape === 'diamond') {
    var dm = 'M' + f2(cx) + ' ' + f2(y) + 'L' + f2(x2) + ' ' + f2(cy) + 'L' + f2(cx) + ' ' + f2(y2) + 'L' + f2(x) + ' ' + f2(cy) + 'Z';
    return { outline: dm, decor: '', tb: { x: x + w * 0.25, y: y + h * 0.25, w: w * 0.5, h: h * 0.5 } };
  }
  if (shape === 'hexagon') {
    var cut = clamp(Math.min(w * 0.2, h * 0.5), 6, 44);
    var hx = 'M' + f2(x + cut) + ' ' + f2(y) + 'L' + f2(x2 - cut) + ' ' + f2(y) + 'L' + f2(x2) + ' ' + f2(cy)
      + 'L' + f2(x2 - cut) + ' ' + f2(y2) + 'L' + f2(x + cut) + ' ' + f2(y2) + 'L' + f2(x) + ' ' + f2(cy) + 'Z';
    return { outline: hx, decor: '', tb: { x: x + cut * 0.6, y: y, w: Math.max(8, w - cut * 1.2), h: h } };
  }
  // box / rounded - full rectangle, radius from rectRx (unchanged behaviour).
  return { outline: roundedRectPath(x, y, w, h, rectRx(shape, w, h, S)), decor: '', tb: full };
}

// ── card images: embed as a data URL + measure aspect (browser only) ────────────
var _imgCache = {};
function resolveImage(url) {
  if (_imgCache[url]) return _imgCache[url];
  var p = (async function () {
    var dataUrl = url, aspect = 0;
    try {
      if (String(url).indexOf('data:') !== 0 && (typeof fetch !== 'undefined' || (host.assets && host.assets.bytes))) {
        // Portable read (v1.183) first; the page's fetch is the fallback.
        var blob = (host.assets && host.assets.bytes)
          ? new Blob([await host.assets.bytes(url)])
          : await (await fetch(url)).blob();
        dataUrl = await new Promise(function (res, rej) {
          var fr = new FileReader();
          fr.onload = function () { res(fr.result); };
          fr.onerror = function () { rej(new Error('read failed')); };
          fr.readAsDataURL(blob);
        });
      }
    } catch (e) { dataUrl = url; }
    try {
      if (typeof Image !== 'undefined') {
        aspect = await new Promise(function (res) {
          var im = new Image();
          im.onload = function () { res(im.naturalHeight ? im.naturalWidth / im.naturalHeight : 0); };
          im.onerror = function () { res(0); };
          im.src = dataUrl;
        });
      }
    } catch (e) { aspect = 0; }
    return { dataUrl: dataUrl, aspect: aspect };
  })();
  _imgCache[url] = p;
  return p;
}

// ── card geometry ──────────────────────────────────────────────────────────────
function rectRx(shape, w, h, S) {
  var lim = Math.min(w, h) / 2;
  if (shape === 'pill') return lim;
  if (shape === 'box') return Math.min(4, lim);
  return Math.min(S ? S.cornerRadius : 14, lim); // rounded
}
function computeCardH(S, lines, hasDetail) {
  var textH = lines * S.labelLH + (hasDetail ? (S.detailLines || 1) * S.detailLH + 3 : 0);
  // Row layout sets the image beside the text, so height is the taller of the two
  // (not text + image band). Stacked adds the image band on top of the text.
  var content = S.cardLayout === 'row' ? Math.max(textH, S.rowImgSide || 0) : (S.imgBand || 0) + textH;
  return Math.max(Math.round(40 * S.scale), S.cardPadV * 2 + content);
}

// Render one card <g> with a click-to-focus hook (focuses block `idx` of `nodes`).
function renderCard(n, S) {
  var scol = n.stroke ? color(n.stroke, S.nodeStroke) : S.nodeStroke;
  var bw = (n.strokeWidth > 0) ? n.strokeWidth : S.cardBorderWidth;
  var geom = shapeGeom(n.shape, n.x, n.y, n.w, n.h, S, scol, bw);
  var fill = color(n.fill, S.nodeFill);
  var cx = n.x + n.w / 2;
  var tb = geom.tb;

  var g = '<g data-canvas-input="nodes:' + n.idx + '">';
  if (geom.outline) {
    g += '<path d="' + geom.outline + '" fill="' + esc(fill) + '"'
      + (bw > 0 ? ' stroke="' + esc(scol) + '" stroke-width="' + f2(bw) + '" stroke-linejoin="round"' : '') + '/>';
  }
  if (geom.decor) g += geom.decor;

  // Side-by-side: image (avatar) on the left, text left-aligned in the width that
  // remains. A card with no image starts its text at the left edge, so it takes the
  // whole card - a missing headshot simply gives the text more room.
  if (S.cardLayout === 'row') {
    var rink = inkOn(fill, S.nodeText), rdink = inkOn(fill, S.detailColor);
    var rpad = S.cardPadV, rside = S.rowImgSide, rHasImg = n.image && rside > 0;
    if (rHasImg) {
      var rdW = rside, rdH = rside;
      if (!n._imgIsSvg && n._imgAspect > 0) {
        var raw = rside * n._imgAspect;
        if (raw <= rside) { rdH = rside; rdW = raw; } else { rdW = rside; rdH = rside / n._imgAspect; }
      }
      var rax = n.x + rpad + (rside - rdW) / 2, ray = n.y + (n.h - rdH) / 2;
      g += '<image href="' + esc(n.image) + '" x="' + f2(rax) + '" y="' + f2(ray) + '"'
        + ' width="' + f2(rdW) + '" height="' + f2(rdH) + '" preserveAspectRatio="xMidYMid meet"/>';
    }
    var rtx = n.x + rpad + (rHasImg ? rside + S.imgGap : 0);
    var rtw = Math.max(8, (n.x + n.w - rpad) - rtx);
    var rlines = wrapLines(n.label, maxCharsFor(rtw, S.labelSize), S.labelLines);
    var rdl = wrapLines(n.detail, maxCharsFor(rtw, S.detailSize), S.detailLines || 1);
    var rbh = rlines.length * S.labelLH + (rdl.length ? rdl.length * S.detailLH + 3 : 0);
    var rtop = n.y + (n.h - rbh) / 2;
    for (var ri = 0; ri < rlines.length; ri++) {
      g += textEl(rtx, rtop + ri * S.labelLH + S.labelSize * 0.8, rlines[ri], S.labelSize, S.labelWeight, rink, 'start');
    }
    rdl.forEach(function (line, i) {
      g += textEl(rtx, rtop + rlines.length * S.labelLH + i * S.detailLH + S.detailSize * 0.8 + 3, line, S.detailSize, 400, rdink, 'start');
    });
    return g + '</g>';
  }

  if (n.image && S.imgBand > 0) {
    var areaW = Math.max(8, n.w - S.cardPadV * 2), areaH = S.imgH;
    var dispW = areaW, dispH = areaH;
    if (!n._imgIsSvg && n._imgAspect > 0) {
      var bwi = areaH * n._imgAspect;
      if (bwi <= areaW) { dispH = areaH; dispW = bwi; } else { dispW = areaW; dispH = areaW / n._imgAspect; }
    }
    var imgX = n.x + (n.w - dispW) / 2, imgY = n.y + S.cardPadV + (areaH - dispH) / 2;
    g += '<image href="' + esc(n.image) + '" x="' + f2(imgX) + '" y="' + f2(imgY) + '"'
      + ' width="' + f2(dispW) + '" height="' + f2(dispH) + '" preserveAspectRatio="xMidYMid meet"/>';
  }

  var lines = wrapLines(n.label, maxCharsFor(tb.w, S.labelSize), S.labelLines);
  var details = wrapLines(n.detail, maxCharsFor(tb.w, S.detailSize), S.detailLines || 1);
  var blockH = lines.length * S.labelLH + (details.length ? details.length * S.detailLH + 3 : 0);
  var top;
  if (S.imgBand > 0) {
    var textTop = n.y + S.cardPadV + S.imgH + S.imgGap;
    var region = (n.y + n.h - S.cardPadV) - textTop;
    top = textTop + Math.max(0, (region - blockH) / 2);
  } else {
    top = tb.y + (tb.h - blockH) / 2;
  }
  var ink = inkOn(fill, S.nodeText), dink = inkOn(fill, S.detailColor);
  for (var i = 0; i < lines.length; i++) {
    g += textEl(cx, top + i * S.labelLH + S.labelSize * 0.8, lines[i], S.labelSize, S.labelWeight, ink, 'middle');
  }
  details.forEach(function (line, i) {
    g += textEl(cx, top + lines.length * S.labelLH + i * S.detailLH + S.detailSize * 0.8 + 3, line, S.detailSize, 400, dink, 'middle');
  });
  return g + '</g>';
}

// ── normalise the nodes list (assign ids, dedupe, carry per-type fields) ─────────
function normaliseNodes(rawNodes) {
  var nodes = [], used = {};
  rawNodes.forEach(function (b, i) {
    if (!b) return;
    var label = trim(b.label);
    var detail = trim(b.detail);
    var id = slug(b.nodeId) || slug(label) || ('node-' + (i + 1));
    if (used[id]) { var k = 2; while (used[id + '-' + k]) k++; id = id + '-' + k; }
    used[id] = 1;
    var ref = b.image;
    var imgUrl = (typeof ref === 'string') ? trim(ref) : ((ref && ref.url) ? ref.url : '');
    var startDay = parseDay(b.startDate), endDay = parseDay(b.endDate);
    nodes.push({
      idx: i, id: id,
      shape: SHAPES[b.shape] ? b.shape : 'rounded',
      label: label, detail: detail,
      parentId: slug(b.parent), layerId: slug(b.layer),
      fill: trim(b.fill),
      image: imgUrl,
      _imgIsSvg: !!(ref && (ref.type === 'vector' || ref.format === 'svg' || /\.svg(\?|$)/i.test(imgUrl))),
      _imgAspect: 0,
      quadrant: slug(b.quadrant),
      score: (Array.isArray(b.score) && b.score.length === 2 && isFinite(b.score[0]) && isFinite(b.score[1])) ? b.score : null,
      _start: num(b.ganttStart, NaN), _len: num(b.ganttLen, NaN),
      _sd: startDay ? startDay.day : NaN, _ed: endDay ? endDay.day : NaN,
      _milestone: b.milestone === true,
      _dateNotes: dateNotes(startDay, endDay, label || id),
      stroke: trim(b.stroke), strokeWidth: num(b.strokeWidth, NaN),
      x: 0, y: 0, w: 0, h: 0
    });
  });
  return nodes;
}

// ── shared tree build (org / tree-LR / mindmap) ──────────────────────────────────
function buildTree(nodes) {
  var byId = {};
  nodes.forEach(function (n) { if (n.id && byId[n.id] === undefined) byId[n.id] = n; });
  nodes.forEach(function (n) { n._children = []; });
  nodes.forEach(function (n) {
    var p = (n.parentId && byId[n.parentId] !== undefined && byId[n.parentId] !== n) ? byId[n.parentId] : null;
    n._parent = p;
  });
  nodes.forEach(function (n) { if (n._parent) n._parent._children.push(n); });
  var visited = {};
  function dfsMark(start) {
    var st = [start];
    while (st.length) {
      var c = st.pop();
      if (visited[c.idx]) continue;
      visited[c.idx] = 1;
      for (var i = 0; i < c._children.length; i++) st.push(c._children[i]);
    }
  }
  var roots = nodes.filter(function (n) { return !n._parent; });
  roots.forEach(dfsMark);
  nodes.forEach(function (n) {
    if (visited[n.idx]) return;
    if (n._parent) { var sib = n._parent._children, k = sib.indexOf(n); if (k >= 0) sib.splice(k, 1); n._parent = null; }
    roots.push(n); dfsMark(n);
  });
  return roots;
}

// ── org / tree layout: tidy tree, top-down (dir 'down') or left-to-right ('right') ──
function layoutOrg(nodes, S, dir) {
  var cardW = S.cardWidth, sib = S.siblingGap, flow = S.rowGap, cardH = S.cardH;
  var right = dir === 'right';
  var roots = buildTree(nodes);
  var slot = 0;
  var crossLeaf = right ? (cardH + sib) : (cardW + sib);
  roots.forEach(function (r, ri) {
    if (ri > 0) slot++;
    var st = [{ n: r, depth: 0, done: false }];
    while (st.length) {
      var f = st[st.length - 1], n = f.n;
      if (!f.done) {
        n.w = cardW; n.h = cardH;
        if (right) n.x = f.depth * (cardW + flow); else n.y = f.depth * (cardH + flow);
        f.done = true;
        for (var i = n._children.length - 1; i >= 0; i--) st.push({ n: n._children[i], depth: f.depth + 1, done: false });
      } else {
        st.pop();
        if (!n._children.length) { if (right) n.y = slot * crossLeaf; else n.x = slot * crossLeaf; slot++; }
        else if (right) n.y = (n._children[0].y + n._children[n._children.length - 1].y) / 2;
        else n.x = (n._children[0].x + n._children[n._children.length - 1].x) / 2;
      }
    }
  });
  var edges = [];
  nodes.forEach(function (n) {
    if (!n._parent) return;
    var p = n._parent;
    if (right) {
      var px = p.x + p.w, py = p.y + p.h / 2, cxx = n.x, cy = n.y + n.h / 2, midX = (px + cxx) / 2;
      edges.push('M' + f2(px) + ' ' + f2(py) + 'L' + f2(midX) + ' ' + f2(py) + 'L' + f2(midX) + ' ' + f2(cy) + 'L' + f2(cxx) + ' ' + f2(cy));
    } else {
      var px2 = p.x + p.w / 2, py2 = p.y + p.h, cxx2 = n.x + n.w / 2, cy2 = n.y, midY = (py2 + cy2) / 2;
      edges.push('M' + f2(px2) + ' ' + f2(py2) + 'L' + f2(px2) + ' ' + f2(midY) + 'L' + f2(cxx2) + ' ' + f2(midY) + 'L' + f2(cxx2) + ' ' + f2(cy2));
    }
  });
  return { autoEdges: edges, bands: [], layerById: {} };
}

// ── mindmap layout: balanced (or right-only) tree with curved branches ───────────
function mindEdge(p, n) {
  var pcx = p.x + p.w / 2, goingRight = (n.x + n.w / 2) >= pcx;
  var px = goingRight ? p.x + p.w : p.x, py = p.y + p.h / 2;
  var cx = goingRight ? n.x : n.x + n.w, cy = n.y + n.h / 2;
  var mx = (px + cx) / 2;
  return 'M' + f2(px) + ' ' + f2(py) + 'C' + f2(mx) + ' ' + f2(py) + ' ' + f2(mx) + ' ' + f2(cy) + ' ' + f2(cx) + ' ' + f2(cy);
}
function layoutMindmap(nodes, S, inp) {
  var roots = buildTree(nodes), primary = roots[0];
  var cardW = S.cardWidth, depthGap = S.rowGap + 30, leafGap = S.siblingGap;
  roots.forEach(function (r) {
    var st = [{ n: r, d: 0 }];
    while (st.length) { var f = st.pop(); f.n._depth = f.d; for (var i = 0; i < f.n._children.length; i++) st.push({ n: f.n._children[i], d: f.d + 1 }); }
  });
  var slot = 0;
  roots.forEach(function (r, ri) {
    if (ri > 0) slot++;
    var st = [{ n: r, done: false }];
    while (st.length) {
      var f = st[st.length - 1], n = f.n;
      if (!f.done) { n.w = cardW; n.h = S.cardH; n.x = n._depth * (cardW + depthGap); f.done = true; for (var i = n._children.length - 1; i >= 0; i--) st.push({ n: n._children[i], done: false }); }
      else { st.pop(); if (!n._children.length) { n.y = slot * (S.cardH + leafGap); slot++; } else n.y = (n._children[0].y + n._children[n._children.length - 1].y) / 2; }
    }
  });
  var balanced = inp.mindmapStyle !== 'right';
  if (primary && balanced && primary._children.length > 1) {
    var kids = primary._children, half = Math.ceil(kids.length / 2), leftSet = {};
    for (var ki = half; ki < kids.length; ki++) {
      var st2 = [kids[ki]];
      while (st2.length) { var c = st2.pop(); leftSet[c.idx] = 1; for (var j = 0; j < c._children.length; j++) st2.push(c._children[j]); }
    }
    var rootCx = primary.x + primary.w / 2;
    nodes.forEach(function (n) { if (leftSet[n.idx]) n.x = 2 * rootCx - n.x - n.w; });
  }
  if (inp.branchColors !== false && primary) {
    var idxOf = {};
    primary._children.forEach(function (c, i) { idxOf[c.idx] = i; });
    nodes.forEach(function (n) {
      if (n === primary || !n._parent) return;
      var top = n, guard = 0;
      while (top._parent && top._parent !== primary && guard < 400) { top = top._parent; guard++; }
      var bi = idxOf[top.idx]; if (bi == null) bi = 0;
      if (!trim(n.fill)) n.fill = S.bandPalette[bi % S.bandPalette.length];
    });
  }
  var edges = [];
  nodes.forEach(function (n) { if (n._parent) edges.push(mindEdge(n._parent, n)); });
  return { autoEdges: edges, bands: [], layerById: {} };
}

// ── layercake layout: stacked layer bands ───────────────────────────────────────
function layoutLayercake(nodes, rawLayers, S) {
  var layers = [], layerById = {};
  rawLayers.forEach(function (b, i) {
    if (!b) return;
    // slug(layerId) || slug(label) || ordinal - mirrors the shell reference picker
    // (deriveBlockKeys) so a band's id matches whatever a card's Group dropdown stored.
    var id = slug(b.layerId) || slug(b.label) || ('layer-' + (i + 1));
    if (layerById[id] !== undefined) return;
    var L = { idx: i, id: id, label: trim(b.label) || id, bandFill: color(b.bandFill, FOG), _cards: [] };
    layerById[id] = L; layers.push(L);
  });
  nodes.forEach(function (n) {
    if (n.layerId && layerById[n.layerId] === undefined) {
      var L = { idx: layers.length, id: n.layerId, label: titleize(n.layerId), bandFill: S.bandPalette[layers.length % S.bandPalette.length], _cards: [] };
      layerById[n.layerId] = L; layers.push(L);
    }
  });
  var unassigned = null;
  nodes.forEach(function (n) {
    var L = (n.layerId && layerById[n.layerId] !== undefined) ? layerById[n.layerId] : null;
    if (!L) {
      if (!unassigned) { unassigned = { idx: layers.length, id: '__unassigned__', label: 'Unassigned', bandFill: FOG, _cards: [] }; layers.push(unassigned); }
      L = unassigned;
    }
    L._cards.push(n);
  });

  // Bands fit their CONTENT: cards keep a uniform width and the inner area is sized
  // to the busiest band - so a sparse layercake isn't stretched to a fixed width.
  // Cards only shrink if the busiest band would exceed capW.
  var padX = 20, padY = 18, bandGap = Math.round(S.rowGap * 0.29), cardGap = Math.round(S.siblingGap * 0.53);
  var maxLabelW = 0;
  layers.forEach(function (L) { maxLabelW = Math.max(maxLabelW, textWidth(L.label, 15)); });
  var gutter = clamp(maxLabelW + 44, 120, 240);
  var maxN = 0;
  layers.forEach(function (L) { if (L._cards.length > maxN) maxN = L._cards.length; });
  var capW = 1320, cw = S.cardWidth;
  if (maxN > 0) {
    var totalDesired = maxN * cw + cardGap * (maxN - 1);
    if (totalDesired > capW) cw = Math.max(120, (capW - cardGap * (maxN - 1)) / maxN);
  }
  var innerW = maxN > 0 ? (maxN * cw + cardGap * (maxN - 1)) : cw;

  var maxLines = 1, hasDetail = false;
  layers.forEach(function (L) {
    L._cards.forEach(function (c) {
      if (estLineCount(c.label, maxCharsFor(cw, S.labelSize)) > 1) maxLines = 2;
      if (trim(c.detail)) hasDetail = true;
    });
  });
  var cardH = computeCardH(S, maxLines, hasDetail);
  S.cardH = cardH; S.labelLines = maxLines;

  var bandH = cardH + padY * 2, y = 0, bandW = gutter + innerW + padX * 2;
  layers.forEach(function (L) {
    L.x = 0; L.y = y; L.h = bandH; L.w = bandW;
    var cards = L._cards, n = cards.length;
    if (n > 0) {
      var totalW = cw * n + cardGap * (n - 1);
      var startX = gutter + padX + Math.max(0, (innerW - totalW) / 2);
      cards.forEach(function (c, ci) { c.w = cw; c.h = cardH; c.x = startX + ci * (cw + cardGap); c.y = y + padY; });
    }
    y += bandH + bandGap;
  });
  return { autoEdges: [], bands: layers, layerById: layerById, gutter: gutter };
}

// ── kanban layout: side-by-side columns of cards ─────────────────────────────────
function layoutKanban(nodes, rawColumns, S, inp) {
  var cols = [], byId = {};
  arr(rawColumns).forEach(function (b, i) {
    if (!b) return;
    // slug(layerId) || slug(label) || ordinal - mirror the shell picker (deriveBlockKeys).
    var id = slug(b.layerId) || slug(b.label) || ('col-' + (i + 1));
    if (byId[id]) return;
    byId[id] = { idx: i, id: id, label: trim(b.label) || titleize(id), bandFill: color(b.bandFill, S.bandPalette[cols.length % S.bandPalette.length]), _cards: [] };
    cols.push(byId[id]);
  });
  nodes.forEach(function (n) {
    if (n.layerId && !byId[n.layerId]) {
      byId[n.layerId] = { idx: cols.length, id: n.layerId, label: titleize(n.layerId), bandFill: S.bandPalette[cols.length % S.bandPalette.length], _cards: [] };
      cols.push(byId[n.layerId]);
    }
  });
  var un = null;
  nodes.forEach(function (n) {
    var c = (n.layerId && byId[n.layerId]) ? byId[n.layerId] : null;
    if (!c) { if (!un) { un = { idx: cols.length, id: '__un__', label: 'Unassigned', bandFill: S.bandPalette[cols.length % S.bandPalette.length], _cards: [] }; cols.push(un); } c = un; }
    c._cards.push(n);
  });
  var colW = Math.max(180, S.cardWidth + 40), colGap = S.siblingGap, headerH = Math.round(40 * S.scale);
  var cardGap = Math.round(S.siblingGap * 0.5 + 4), padX = 12, padTop = headerH + 12, maxH = padTop + 8;
  cols.forEach(function (c, j) {
    c.x = j * (colW + colGap); c.y = 0; c.w = colW;
    var cy = padTop;
    c._cards.forEach(function (n) { n.w = colW - padX * 2; n.h = S.cardH; n.x = c.x + padX; n.y = cy; cy += S.cardH + cardGap; });
    c._contentH = cy + 8;
    if (c._contentH > maxH) maxH = c._contentH;
  });
  cols.forEach(function (c) { c.h = maxH; });
  return { autoEdges: [], bands: cols, layerById: byId, kanbanHeader: true, showCount: inp.kanbanCount === true };
}

// ── process layout: ranked flow (a DAG layered by longest path) ──────────────────
function layoutProcess(nodes, rawArrows, S, dir) {
  var byId = {};
  nodes.forEach(function (n) { if (byId[n.id] === undefined) byId[n.id] = n; });
  var edges = [];
  arr(rawArrows).forEach(function (a) {
    if (!a) return;
    var f = slug(a.from), t = slug(a.to);
    if (byId[f] === undefined || byId[t] === undefined || f === t) return;
    edges.push([f, t]);
  });
  var rank = {};
  nodes.forEach(function (n) { rank[n.id] = 0; });
  for (var iter = 0; iter < nodes.length; iter++) {
    var changed = false;
    for (var e = 0; e < edges.length; e++) {
      if (rank[edges[e][1]] < rank[edges[e][0]] + 1) { rank[edges[e][1]] = rank[edges[e][0]] + 1; changed = true; }
    }
    if (!changed) break;
  }
  nodes.forEach(function (n) { if (rank[n.id] > nodes.length) rank[n.id] = nodes.length; });
  var ranks = {};
  nodes.forEach(function (n) { (ranks[rank[n.id]] || (ranks[rank[n.id]] = [])).push(n); });
  var keys = Object.keys(ranks).map(Number).sort(function (a, b) { return a - b; });
  var cardW = S.cardWidth, cardH = S.cardH, right = dir === 'right';
  var mainGap = Math.round(S.rowGap * 1.3), crossGap = Math.round(right ? S.siblingGap * 0.87 : S.siblingGap * 1.33);
  keys.forEach(function (rk, ri) {
    var row = ranks[rk], n = row.length;
    var crossSize = right ? cardH : cardW;
    var start = -(n * crossSize + crossGap * (n - 1)) / 2;
    row.forEach(function (c, ci) {
      c.w = cardW; c.h = cardH;
      var cross = start + ci * (crossSize + crossGap);
      var main = ri * ((right ? cardW : cardH) + mainGap);
      if (right) { c.x = main; c.y = cross; } else { c.x = cross; c.y = main; }
    });
  });
  return { autoEdges: [], bands: [], layerById: {} };
}

// ── timeline layout: a spine with alternating dated cards ────────────────────────
function layoutTimeline(nodes, S, dir, bb) {
  var cardW = S.cardWidth, gap = S.siblingGap + 24, spineGap = Math.round(30 * S.scale), col = S.edgeColor;
  var spineW = Math.max(2, S.connectorWidth), stubW = Math.max(1.2, S.connectorWidth * 0.7), behind = '';
  if (dir === 'down') {
    nodes.forEach(function (c, i) { c.w = cardW; c.h = S.cardH; c.y = i * (S.cardH + gap); c.x = (i % 2 === 0) ? -spineGap - cardW : spineGap; });
    var first = nodes[0].y + nodes[0].h / 2, last = nodes[nodes.length - 1].y + nodes[nodes.length - 1].h / 2;
    behind += shaft(0, first, 0, last, 'solid', col, spineW);
    nodes.forEach(function (c) {
      var cyc = c.y + c.h / 2, edge = (c.x < 0) ? c.x + c.w : c.x;
      behind += shaft(edge, cyc, 0, cyc, 'solid', col, stubW);
      behind += '<path d="' + circlePath(0, cyc, 5) + '" fill="' + esc(col) + '"/>';
    });
    bb.add(0, first - 6, 0, 0); bb.add(0, last + 6, 0, 0);
  } else {
    nodes.forEach(function (c, i) { c.w = cardW; c.h = S.cardH; c.x = i * (cardW + gap); c.y = (i % 2 === 0) ? -spineGap - S.cardH : spineGap; });
    var f = nodes[0].x + nodes[0].w / 2, l = nodes[nodes.length - 1].x + nodes[nodes.length - 1].w / 2;
    behind += shaft(f, 0, l, 0, 'solid', col, spineW);
    nodes.forEach(function (c) {
      var cxc = c.x + c.w / 2, edge = (c.y < 0) ? c.y + c.h : c.y;
      behind += shaft(cxc, edge, cxc, 0, 'solid', col, stubW);
      behind += '<path d="' + circlePath(cxc, 0, 5) + '" fill="' + esc(col) + '"/>';
    });
    bb.add(f - 6, 0, 0, 0); bb.add(l + 6, 0, 0, 0);
  }
  return { autoEdges: [], bands: [], layerById: {}, behind: behind };
}

// ── cycle layout: stages on a ring, arrows around the loop ───────────────────────
function layoutCycle(nodes, S, inp, bb) {
  var n = nodes.length;
  var cardW = Math.min(S.cardWidth, 180);
  var R = Math.max(150, (n * (cardW + S.siblingGap + 20)) / (2 * Math.PI));
  var step = 2 * Math.PI / n, start = -Math.PI / 2;
  nodes.forEach(function (c, i) {
    var th = start + i * step, ctrX = R * Math.cos(th), ctrY = R * Math.sin(th);
    c.w = cardW; c.h = S.cardH; c.x = ctrX - cardW / 2; c.y = ctrY - S.cardH / 2;
  });
  var front = '';
  if (inp.cycleArrows !== false && n > 1) {
    var curved = inp.cycleCurved !== false, col = S.edgeColor;
    var kind = S.arrowHead === 'none' ? 'triangle' : S.arrowHead;
    var s = Math.max(S.arrowHeadSize, S.arrowWidth * 4);
    for (var i = 0; i < n; i++) {
      var a = nodes[i], bn = nodes[(i + 1) % n];
      var A = { cx: a.x + a.w / 2, cy: a.y + a.h / 2, hw: a.w / 2, hh: a.h / 2 };
      var B = { cx: bn.x + bn.w / 2, cy: bn.y + bn.h / 2, hw: bn.w / 2, hh: bn.h / 2 };
      var p1 = borderPoint(A, B.cx, B.cy), p2 = borderPoint(B, A.cx, A.cy);
      if (curved) {
        var mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2, bow = R * 0.18;
        // Bow outward along the radius from the ring centre. For a 2-stage ring the
        // chord midpoint IS the centre (radius ≈ 0), so the two opposing edges would
        // collapse onto the same arc - fall back to a per-edge horizontal offset.
        var radial = Math.hypot(mx, my), bx, by;
        if (radial > 1e-6) { bx = (mx / radial) * bow; by = (my / radial) * bow; }
        else { bx = (i % 2 === 0 ? bow : -bow); by = 0; }
        var cxp = mx + bx, cyp = my + by;
        front += '<path d="M' + f2(p1.x) + ' ' + f2(p1.y) + 'Q' + f2(cxp) + ' ' + f2(cyp) + ' ' + f2(p2.x) + ' ' + f2(p2.y) + '" fill="none" stroke="' + esc(col) + '" stroke-width="' + f2(S.arrowWidth) + '"/>';
        var tx = p2.x - cxp, ty = p2.y - cyp, tl = Math.hypot(tx, ty) || 1;
        front += arrowHead({ x: p2.x, y: p2.y }, tx / tl, ty / tl, s, col, kind, S.arrowWidth);
        bb.add(cxp, cyp, 0, 0);
      } else {
        var dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, ins = headInset(kind, s);
        front += shaft(p1.x, p1.y, p2.x - ux * ins, p2.y - uy * ins, 'solid', col, S.arrowWidth);
        front += arrowHead({ x: p2.x, y: p2.y }, ux, uy, s, col, kind, S.arrowWidth);
      }
    }
  }
  return { autoEdges: [], bands: [], layerById: {}, front: front };
}

// ── pyramid / funnel layout: stacked trapezoids ──────────────────────────────────
function layoutPyramid(nodes, S, style, bb) {
  var n = nodes.length, baseW = Math.max(420, S.cardWidth * 2.6), tierH = Math.round(S.cardH + 24 * S.scale), cx = 0;
  var apex = Math.max(40, baseW * 0.12), funnel = style === 'funnel', inverted = style === 'inverted';
  function wAt(t) {
    if (funnel || inverted) return lerp(baseW, apex, t); // wide top → narrow base
    return lerp(apex, baseW, t); // pyramid: narrow top → wide base
  }
  var behind = '';
  nodes.forEach(function (nd, i) {
    var yT = i * tierH, yB = yT + tierH - Math.round(6 * S.scale);
    var wT = wAt(i / n), wB = wAt((i + 1) / n);
    var fill = color(nd.fill, S.bandPalette[i % S.bandPalette.length]);
    behind += '<path d="' + trapezoidPath(cx - wT / 2, cx + wT / 2, cx - wB / 2, cx + wB / 2, yT, yB) + '" fill="' + esc(fill) + '"'
      + (S.cardBorderWidth > 0 ? ' stroke="' + esc(S.nodeStroke) + '" stroke-width="' + f2(S.cardBorderWidth) + '"' : '') + '/>';
    var midY = (yT + yB) / 2, narrow = Math.min(wT, wB), lab = trim(nd.label);
    if (narrow > textWidth(lab, S.labelSize) + 16) {
      behind += textEl(cx, midY + S.labelSize * 0.3, lab, S.labelSize, 600, inkOn(fill, S.nodeText), 'middle');
      if (trim(nd.detail)) behind += textEl(cx, midY + S.labelSize * 0.3 + S.detailLH, nd.detail, S.detailSize, 400, inkOn(fill, S.detailColor), 'middle');
    } else {
      var lx = cx + baseW / 2 + 14;
      behind += shaft(cx + Math.max(wT, wB) / 2, midY, lx - 2, midY, 'solid', S.nodeStroke, 1);
      behind += textEl(lx, midY + S.labelSize * 0.3, lab, S.labelSize, 600, S.nodeText, 'start');
      bb.add(lx + textWidth(lab, S.labelSize) + 8, midY, 0, 0);
    }
    nd.x = cx - baseW / 2; nd.y = yT; nd.w = baseW; nd.h = tierH;
  });
  bb.add(cx - baseW / 2, 0, baseW, n * tierH);
  return { autoEdges: [], bands: [], layerById: {}, behind: behind, skipCards: true };
}

// ── matrix / 2×2 quadrant layout ─────────────────────────────────────────────────
function quadFromText(s) {
  s = String(s == null ? '' : s).toLowerCase();
  if (/^(tl|tr|bl|br)$/.test(s)) return s;
  var top = /top|upper|high/.test(s), bot = /bottom|lower|low/.test(s), left = /left/.test(s), right = /right/.test(s);
  if (top && left) return 'tl'; if (top && right) return 'tr'; if (bot && left) return 'bl'; if (bot && right) return 'br';
  return '';
}
function layoutMatrix(nodes, S, inp, bb) {
  var side = Math.max(440, S.cardWidth * 2.6), cx = side / 2, cy = side / 2, behind = '', front = '';
  var qfill = ['#f3faf7', '#eafaf4', '#fef6ee', '#f6f1fb'];
  var rects = [{ x: 0, y: 0 }, { x: cx, y: 0 }, { x: 0, y: cy }, { x: cx, y: cy }];
  rects.forEach(function (r, i) { behind += '<path d="' + roundedRectPath(r.x, r.y, cx, cy, 0) + '" fill="' + qfill[i] + '"/>'; });
  behind += shaft(cx, 0, cx, side, 'solid', S.edgeColor, 1.2);
  behind += shaft(0, cy, side, cy, 'solid', S.edgeColor, 1.2);
  bb.add(0, 0, side, side);
  var xl = trim(inp.matrixXLow), xh = trim(inp.matrixXHigh), yl = trim(inp.matrixYLow), yh = trim(inp.matrixYHigh);
  if (xh) { front += textEl(side + 10, cy + 5, xh, 13, 600, S.nodeText, 'start'); bb.add(side + 10 + textWidth(xh, 13), cy, 0, 0); }
  if (xl) { front += textEl(-10, cy + 5, xl, 13, 600, S.nodeText, 'end'); bb.add(-10 - textWidth(xl, 13), cy, 0, 0); }
  if (yh) { front += textEl(cx, -12, yh, 13, 600, S.nodeText, 'middle'); bb.add(cx, -30, 0, 0); }
  if (yl) { front += textEl(cx, side + 22, yl, 13, 600, S.nodeText, 'middle'); bb.add(cx, side + 30, 0, 0); }

  var quads = { tl: [], tr: [], bl: [], br: [] };
  nodes.forEach(function (n) {
    if (n.score) { n._scored = true; }
    else { var qd = quadFromText(n.quadrant) || 'tr'; (quads[qd] || quads.tr).push(n); }
  });
  var pillW = Math.min(160, S.cardWidth * 0.85), pillH = S.cardH;
  Object.keys(quads).forEach(function (k) {
    var list = quads[k]; if (!list.length) return;
    var ox = (k === 'tl' || k === 'bl') ? 0 : cx, oy = (k === 'tl' || k === 'tr') ? 0 : cy;
    var cols = Math.max(1, Math.ceil(Math.sqrt(list.length))), rows = Math.ceil(list.length / cols);
    var gapx = 14, gapy = 10, totalW = cols * pillW + (cols - 1) * gapx, totalH = rows * pillH + (rows - 1) * gapy;
    var sx = ox + (cx - totalW) / 2, sy = oy + (cy - totalH) / 2;
    list.forEach(function (n, idx) {
      var r = Math.floor(idx / cols), c = idx % cols;
      n.shape = 'pill'; n.w = pillW; n.h = pillH; n.x = sx + c * (pillW + gapx); n.y = sy + r * (pillH + gapy);
    });
  });
  nodes.forEach(function (n) {
    if (!n._scored) return;
    n.shape = 'pill'; n.w = pillW; n.h = pillH;
    n.x = clamp(n.score[0], 0, 1) * side - pillW / 2;
    n.y = (1 - clamp(n.score[1], 0, 1)) * side - pillH / 2;
  });
  return { autoEdges: [], bands: [], layerById: {}, behind: behind, front: front };
}

// ── dates (gantt / roadmap) ──────────────────────────────────────────────────────
// A date is a whole-day number counted from 1970-01-01 in UTC, so bar maths never
// touches local time or DST and the browser and the CLI agree to the pixel.
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var SCALE_DAYS = { days: 1, weeks: 7, months: 30.44, quarters: 91.31 };
function dayFromYMD(y, m, d) { return Math.round(Date.UTC(y, m - 1, d) / 86400000); }
function ymdFromDay(day) { var t = new Date(Math.round(day) * 86400000); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; }
// 'yyyy-mm-dd' (what a date input stores), tolerating 'd/m/yyyy' and 'd.m.yyyy'.
// → null for empty, else { day, text, loose }; day is NaN when it is not a date.
// Blocks have no date sub-field type, so a card's dates arrive here as free text.
function parseDay(v) {
  var s = trim(v);
  if (!s) return null;
  var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  var loose = iso ? null : s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  var y, m, d;
  if (iso) { y = +iso[1]; m = +iso[2]; d = +iso[3]; }
  else if (loose) { d = +loose[1]; m = +loose[2]; y = +loose[3]; }
  else return { day: NaN, text: s, loose: false };
  var day = dayFromYMD(y, m, d), back = ymdFromDay(day);
  // Round-trip check, so 2026-02-31 is refused rather than rolled into March.
  if (back.y !== y || back.m !== m || back.d !== d) return { day: NaN, text: s, loose: false };
  return { day: day, text: s, loose: !!loose };
}
function fmtDay(day) { var t = ymdFromDay(day); return t.d + ' ' + MONTHS[t.m - 1] + ' ' + t.y; }
function dateNotes(sd, ed, who) {
  var out = [];
  [sd, ed].forEach(function (p) {
    if (!p) return;
    if (!isFinite(p.day)) out.push('“' + p.text + '” on ' + who + ' is not a date - use yyyy-mm-dd');
    else if (p.loose) out.push('read “' + p.text + '” on ' + who + ' as ' + fmtDay(p.day) + ' (day/month/year)');
  });
  if (sd && ed && isFinite(sd.day) && isFinite(ed.day) && ed.day < sd.day) out.push(who + ' ends before it starts - drawn as one day');
  // A bar is placed by its start, so an end date on its own cannot be drawn. Say it,
  // rather than let a typed date vanish with no sign.
  if (!(sd && isFinite(sd.day)) && ed && isFinite(ed.day)) out.push(who + ' has an end date but no start date - the end date is ignored');
  return out;
}
// Which tick spacing suits a span, when the user leaves the scale on Auto.
function pickScale(spanDays) {
  if (spanDays <= 21) return 'days';
  if (spanDays <= 120) return 'weeks';
  if (spanDays <= 800) return 'months';
  return 'quarters';
}
// Tick days at NATURAL boundaries inside [from,to]: each day, each Monday, each 1st
// of the month, each quarter start. 1970-01-05 was a Monday, hence day % 7 === 4.
// A span too long for one tick per unit takes every Nth unit instead, so the axis
// still reaches its own end; a stopping-short axis mislabels the whole chart. Under
// CAP units the multiplier is 1 and the ticks are exactly one per unit as before.
var TICK_CAP = 4000;
function axisTicks(from, to, scale) {
  var out = [], i, span = to - from;
  if (scale === 'days') {
    var ds = Math.max(1, Math.ceil(span / TICK_CAP));
    for (i = Math.ceil(from); i <= to; i += ds) out.push(i);
    return out;
  }
  if (scale === 'weeks') {
    var ws = 7 * Math.max(1, Math.ceil(span / (7 * TICK_CAP)));
    for (i = Math.ceil((from - 4) / 7) * 7 + 4; i <= to; i += ws) out.push(i);
    return out;
  }
  var a = ymdFromDay(Math.ceil(from)), y = a.y, m = a.m;
  var step = (scale === 'quarters' ? 3 : 1) * Math.max(1, Math.ceil(span / 30.44 / TICK_CAP));
  if (a.d > 1) { m++; if (m > 12) { m = 1; y++; } }
  if (scale === 'quarters') { while ((m - 1) % 3 !== 0) { m++; if (m > 12) { m = 1; y++; } } }
  for (i = 0; i <= TICK_CAP; i++) {
    var dd = dayFromYMD(y, m, 1);
    if (dd > to) break;
    if (dd >= from) out.push(dd);
    m += step; while (m > 12) { m -= 12; y++; }
  }
  return out;
}
function tickLabel(day, scale) {
  var t = ymdFromDay(day), yy = String(t.y).slice(2);
  if (scale === 'quarters') return 'Q' + (Math.floor((t.m - 1) / 3) + 1) + ' ' + yy;
  if (scale === 'months') return MONTHS[t.m - 1] + (t.m === 1 ? ' ' + yy : '');
  return t.d + ' ' + MONTHS[t.m - 1];
}

// ── gantt / roadmap layout: time-axis bars ───────────────────────────────────────
function layoutGantt(nodes, rawLayers, S, inp, bb) {
  nodes.forEach(function (n) { arr(n._dateNotes).forEach(note); });
  // One readable start date anywhere switches the whole chart to a date axis;
  // with none, the unitless bars below are exactly what they always were.
  if (nodes.some(function (n) { return isFinite(n._sd); })) return layoutGanttDates(nodes, rawLayers, S, inp, bb);
  var seq = 0;
  nodes.forEach(function (n) { if (!isFinite(n._start)) n._start = seq; if (!isFinite(n._len) || n._len <= 0) n._len = 1; seq = Math.max(seq, n._start + n._len); });
  var minT = Infinity, maxT = -Infinity;
  nodes.forEach(function (n) { minT = Math.min(minT, n._start); maxT = Math.max(maxT, n._start + n._len); });
  if (!isFinite(minT)) { minT = 0; maxT = 1; }
  var span = Math.max(1, maxT - minT);
  var gutter = Math.max(140, S.cardWidth * 0.9), chartW = Math.max(360, 90 * span), pxU = chartW / span;
  var rowH = S.cardH + Math.round(12 * S.scale), pad = Math.round(5 * S.scale), behind = '';
  var grid = inp.ganttGrid !== false, unit = trim(inp.ganttUnit), totalH = nodes.length * rowH;

  if (grid) {
    var ticks = Math.min(40, Math.ceil(span));
    for (var t = 0; t <= ticks; t++) {
      var tx = gutter + (t / ticks) * chartW, val = f2(minT + (t / ticks) * span);
      behind += shaft(tx, -6, tx, totalH, 'solid', S.edgeColor, 0.4);
      behind += textEl(tx, -12, String(val) + (unit ? ' ' + unit : ''), 10, 400, S.detailColor, 'middle');
    }
    bb.add(gutter, -28, chartW, 0);
  }
  nodes.forEach(function (n, i) {
    var rowY = i * rowH, barX = gutter + (n._start - minT) * pxU, barW = Math.max(8, n._len * pxU);
    n.x = barX; n.y = rowY + pad; n.w = barW; n.h = S.cardH - pad * 2;
    var fill = color(n.fill, S.bandPalette[i % S.bandPalette.length]);
    behind += '<path d="' + roundedRectPath(n.x, n.y, n.w, n.h, Math.min(6, S.cornerRadius)) + '" fill="' + esc(fill) + '"'
      + (S.cardBorderWidth > 0 ? ' stroke="' + esc(S.nodeStroke) + '" stroke-width="' + f2(S.cardBorderWidth) + '"' : '') + '/>';
    var lab = wrapLines(n.label, maxCharsFor(gutter - 14, S.labelSize), 2), ly = rowY + (rowH - lab.length * S.labelLH) / 2 + S.labelSize * 0.8;
    lab.forEach(function (line, li) { behind += textEl(gutter - 10, ly + li * S.labelLH, line, S.labelSize, S.labelWeight, S.nodeText, 'end'); });
    if (trim(n.detail) && barW > textWidth(n.detail, S.detailSize) + 12) behind += textEl(barX + barW / 2, rowY + rowH / 2 + S.detailSize * 0.3, n.detail, S.detailSize, 400, inkOn(fill, S.nodeText), 'middle');
  });
  bb.add(0, 0, gutter, totalH);
  return { autoEdges: [], bands: [], layerById: {}, behind: behind, skipCards: true };
}

// ── dated roadmap: real dates on the axis, swimlanes, milestones, today-line ─────
// Additive to the unitless bars above and reached only from there. Cards group into
// swimlanes by the SAME “Group” field the layercake bands use (there is no second
// lane field), and the bands render through the shared band pass in buildDiagram.
function layoutGanttDates(nodes, rawLayers, S, inp, bb) {
  var minT = Infinity, maxT = -Infinity, dated = [], undated = [];
  nodes.forEach(function (n) {
    if (!isFinite(n._sd)) { undated.push(n); return; }
    var s = n._sd;
    // An end date is INCLUSIVE, so the bar runs to the end of that day; a task with
    // only a start is one day; a milestone is a point, not a span.
    n._t0 = s;
    n._t1 = n._milestone ? s : ((isFinite(n._ed) && n._ed >= s) ? n._ed + 1 : s + 1);
    minT = Math.min(minT, n._t0); maxT = Math.max(maxT, n._t1);
    dated.push(n);
  });
  if (maxT <= minT) maxT = minT + 1;
  var scale = SCALE_DAYS[inp.ganttScale] ? inp.ganttScale : pickScale(maxT - minT);

  // Mixed rows: cards with no date keep their unitless start/length, one unit read
  // as one step of the chosen scale from the chart start. The two are not the same
  // measurement, so it is said out loud rather than quietly drawn as fact.
  if (undated.length) {
    var step = SCALE_DAYS[scale], seq = 0;
    undated.forEach(function (n) {
      var s0 = isFinite(n._start) ? n._start : seq, len = (isFinite(n._len) && n._len > 0) ? n._len : 1;
      seq = Math.max(seq, s0 + len);
      n._t0 = minT + s0 * step; n._t1 = n._t0 + len * step;
      maxT = Math.max(maxT, n._t1);
    });
    note(undated.length + ' card(s) have no start date - kept on the unitless scale at the bottom');
  }

  // Lanes, in first-use order, taking their label + fill from the Layers list when
  // that card's group is declared there. A lane is only created once a card uses it.
  // Both maps are keyed by a user-typed group name, so they have no prototype: a
  // lane called "constructor" must be a lane, not Object.prototype.constructor.
  var declared = Object.create(null), lanes = [], laneById = Object.create(null);
  arr(rawLayers).forEach(function (b, i) {
    if (!b) return;
    var did = slug(b.layerId) || slug(b.label) || ('layer-' + (i + 1));
    if (!declared[did]) declared[did] = { label: trim(b.label) || titleize(did), bandFill: trim(b.bandFill) };
  });
  var useLanes = nodes.some(function (n) { return !!n.layerId; });
  function lane(id, forcedLabel) {
    if (!laneById[id]) {
      var d = declared[id];
      laneById[id] = {
        id: id, label: forcedLabel || (d && d.label) || titleize(id),
        bandFill: color(d ? d.bandFill : '', S.bandPalette[lanes.length % S.bandPalette.length]),
        _cards: [], _rows: []
      };
      lanes.push(laneById[id]);
    }
    return laneById[id];
  }
  var rows = [];
  if (useLanes) {
    dated.forEach(function (n) { (n.layerId ? lane(n.layerId, '') : lane('__ungrouped__', 'Ungrouped'))._rows.push(n); });
    undated.forEach(function (n) { lane('__undated__', 'Undated')._rows.push(n); });
    lanes.forEach(function (L) { L._rows.forEach(function (n) { rows.push(n); }); });
  } else {
    dated.forEach(function (n) { rows.push(n); });
    undated.forEach(function (n) { rows.push(n); });
  }

  var span = maxT - minT;
  var ticks = axisTicks(minT, maxT, scale);
  if (ticks.length > 40) {
    var stride = Math.ceil(ticks.length / 40);
    ticks = ticks.filter(function (t, i) { return i % stride === 0; });
  }
  var maxLaneW = 0;
  lanes.forEach(function (L) { maxLaneW = Math.max(maxLaneW, textWidth(L.label, 15)); });
  var laneW = useLanes ? clamp(maxLaneW + 44, 96, 220) : 0;
  var taskW = Math.max(140, S.cardWidth * 0.9), gutter = laneW + taskW;
  var chartW = clamp(Math.max(4, ticks.length) * 78, 360, 2600), pxU = chartW / span;
  function xOf(t) { return gutter + (t - minT) * pxU; }
  var rowH = S.cardH + Math.round(12 * S.scale), pad = Math.round(5 * S.scale);
  var laneGap = useLanes ? Math.round(S.rowGap * 0.2) : 0, behind = '', y = 0;

  lanes.forEach(function (L) {
    L.x = 0; L.y = y; L.w = gutter + chartW; L.h = L._rows.length * rowH;
    L._rows.forEach(function (n, i) { n._rowY = y + i * rowH; });
    y += L.h + laneGap;
  });
  if (!useLanes) rows.forEach(function (n, i) { n._rowY = i * rowH; });
  var totalH = useLanes ? Math.max(0, y - laneGap) : rows.length * rowH;

  if (inp.ganttGrid !== false) {
    ticks.forEach(function (t) {
      var tx = xOf(t);
      behind += shaft(tx, -6, tx, totalH, 'solid', S.edgeColor, 0.4);
      behind += textEl(tx, -12, tickLabel(t, scale), 10, 400, S.detailColor, 'middle', 'db-axis');
    });
    bb.add(gutter, -28, chartW, 0);
  }

  rows.forEach(function (n, i) {
    var rowY = n._rowY, lab = wrapLines(n.label, maxCharsFor(taskW - 14, S.labelSize), 2);
    var ly = rowY + (rowH - lab.length * S.labelLH) / 2 + S.labelSize * 0.8;
    lab.forEach(function (line, li) { behind += textEl(gutter - 10, ly + li * S.labelLH, line, S.labelSize, S.labelWeight, S.nodeText, 'end'); });
    var stroke = S.cardBorderWidth > 0 ? ' stroke="' + esc(S.nodeStroke) + '" stroke-width="' + f2(S.cardBorderWidth) + '"' : '';
    if (n._milestone) {
      // Zero-length: a diamond centred on the start date. Its box is the node box, so
      // dependency arrows meet it on the rhombus like any other diamond card.
      var r = Math.min(rowH, S.cardH) * 0.34, mx = xOf(n._t0), my = rowY + rowH / 2;
      n.shape = 'diamond'; n.x = mx - r; n.y = my - r; n.w = r * 2; n.h = r * 2;
      behind += '<path d="M' + f2(mx) + ' ' + f2(my - r) + 'L' + f2(mx + r) + ' ' + f2(my)
        + 'L' + f2(mx) + ' ' + f2(my + r) + 'L' + f2(mx - r) + ' ' + f2(my) + 'Z" fill="'
        + esc(color(n.fill, S.nodeStroke)) + '"' + stroke + '/>';
      if (trim(n.detail)) {
        behind += textEl(mx + r + 6, my + S.detailSize * 0.34, n.detail, S.detailSize, 400, S.detailColor, 'start');
        bb.add(mx + r + 6, my, textWidth(n.detail, S.detailSize), 0);
      }
      return;
    }
    // With lanes the band carries the colour and a bar is a card on it, as in the
    // layercake; with no lanes the bar keeps the palette rotation it always had.
    var fill = color(n.fill, useLanes ? S.nodeFill : S.bandPalette[i % S.bandPalette.length]);
    n.x = xOf(n._t0); n.y = rowY + pad; n.w = Math.max(8, (n._t1 - n._t0) * pxU); n.h = S.cardH - pad * 2;
    behind += '<path d="' + roundedRectPath(n.x, n.y, n.w, n.h, Math.min(6, S.cornerRadius)) + '" fill="' + esc(fill) + '"' + stroke + '/>';
    if (trim(n.detail) && n.w > textWidth(n.detail, S.detailSize) + 12) {
      behind += textEl(n.x + n.w / 2, rowY + rowH / 2 + S.detailSize * 0.3, n.detail, S.detailSize, 400, inkOn(fill, S.nodeText), 'middle');
    }
  });

  var today = parseDay(inp.ganttToday);
  if (today && !isFinite(today.day)) note('“' + today.text + '” is not a date - the today-line is off');
  if (today && isFinite(today.day) && today.day >= minT && today.day <= maxT) {
    var tx2 = xOf(today.day);
    behind += shaft(tx2, -6, tx2, totalH, 'solid', S.nodeText, Math.max(1.4, S.connectorWidth * 0.7));
    behind += textEl(tx2, totalH + 16, 'Today', 10, 500, S.nodeText, 'middle', 'db-axis');
    bb.add(tx2 - 22, totalH + 22, 44, 0);
  }

  bb.add(0, 0, gutter + chartW, totalH);
  return {
    autoEdges: [], bands: useLanes ? lanes : [], layerById: useLanes ? laneById : {},
    behind: behind, skipCards: true, gutter: laneW
  };
}

// ── explicit arrows ──────────────────────────────────────────────────────────────
function anchorOf(id, nodeById, layerById) {
  var n = nodeById[id];
  if (n) return { cx: n.x + n.w / 2, cy: n.y + n.h / 2, hw: n.w / 2, hh: n.h / 2, shape: n.shape };
  var L = layerById[id];
  if (L && L.w != null) return { cx: L.x + L.w / 2, cy: L.y + L.h / 2, hw: L.w / 2, hh: L.h / 2, shape: 'box' };
  return null;
}
function nested(a, b) {
  function inside(o, i) {
    return (o.cx - o.hw <= i.cx - i.hw + 0.5) && (i.cx + i.hw <= o.cx + o.hw + 0.5)
      && (o.cy - o.hh <= i.cy - i.hh + 0.5) && (i.cy + i.hh <= o.cy + o.hh + 0.5);
  }
  return inside(a, b) || inside(b, a);
}
function borderPoint(a, tx, ty) {
  var dx = tx - a.cx, dy = ty - a.cy;
  if (dx === 0 && dy === 0) return { x: a.cx, y: a.cy };
  var sh = a.shape;
  // Round shapes: intersect the direction with the ellipse boundary.
  if (sh === 'circle' || sh === 'ellipse' || sh === 'pill' || sh === 'oval') {
    var nx = dx / a.hw, ny = dy / a.hh, m = Math.hypot(nx, ny);
    if (m === 0) return { x: a.cx, y: a.cy };
    return { x: a.cx + dx / m, y: a.cy + dy / m };
  }
  // Diamond: intersect with the rhombus |x|/hw + |y|/hh = 1.
  if (sh === 'diamond') {
    var td = 1 / (Math.abs(dx) / a.hw + Math.abs(dy) / a.hh);
    return { x: a.cx + dx * td, y: a.cy + dy * td };
  }
  var sx = dx !== 0 ? a.hw / Math.abs(dx) : Infinity;
  var sy = dy !== 0 ? a.hh / Math.abs(dy) : Infinity;
  var t = Math.min(sx, sy);
  return { x: a.cx + dx * t, y: a.cy + dy * t };
}
// How far to pull the shaft back from the tip so it doesn't poke through the head.
function headInset(kind, s) {
  if (kind === 'none' || kind === 'open' || kind === 'bar') return 0;
  if (kind === 'diamond') return 2 * s;
  if (kind === 'circle') return 2 * (0.42 * s);
  return s * 0.9; // triangle / default
}
// One arrowhead at `tip` pointing along unit (ux,uy). All export-safe geometry.
function arrowHead(tip, ux, uy, s, fill, kind, w) {
  if (kind === 'double') kind = 'triangle';
  if (kind === 'none') return '';
  var px = -uy, py = ux, hw = s * 0.52, B = { x: tip.x - ux * s, y: tip.y - uy * s };
  if (kind === 'open') {
    var sw = Math.max(1.2, w);
    return '<line x1="' + f2(B.x + px * hw) + '" y1="' + f2(B.y + py * hw) + '" x2="' + f2(tip.x) + '" y2="' + f2(tip.y) + '" stroke="' + esc(fill) + '" stroke-width="' + f2(sw) + '"/>'
      + '<line x1="' + f2(B.x - px * hw) + '" y1="' + f2(B.y - py * hw) + '" x2="' + f2(tip.x) + '" y2="' + f2(tip.y) + '" stroke="' + esc(fill) + '" stroke-width="' + f2(sw) + '"/>';
  }
  if (kind === 'diamond') {
    var Mc = { x: tip.x - ux * s, y: tip.y - uy * s }, Bk = { x: tip.x - ux * 2 * s, y: tip.y - uy * 2 * s };
    return '<path d="M' + f2(tip.x) + ' ' + f2(tip.y) + 'L' + f2(Mc.x + px * hw) + ' ' + f2(Mc.y + py * hw)
      + 'L' + f2(Bk.x) + ' ' + f2(Bk.y) + 'L' + f2(Mc.x - px * hw) + ' ' + f2(Mc.y - py * hw) + 'Z" fill="' + esc(fill) + '"/>';
  }
  if (kind === 'circle') {
    var r = 0.42 * s, C = { x: tip.x - ux * r, y: tip.y - uy * r };
    return '<path d="' + circlePath(C.x, C.y, r) + '" fill="' + esc(fill) + '"/>';
  }
  if (kind === 'bar') {
    var sw2 = Math.max(1.4, w);
    return '<line x1="' + f2(tip.x + px * hw) + '" y1="' + f2(tip.y + py * hw) + '" x2="' + f2(tip.x - px * hw) + '" y2="' + f2(tip.y - py * hw) + '" stroke="' + esc(fill) + '" stroke-width="' + f2(sw2) + '"/>';
  }
  // triangle (default)
  return '<path d="M' + f2(tip.x) + ' ' + f2(tip.y) + 'L' + f2(B.x + px * hw) + ' ' + f2(B.y + py * hw)
    + 'L' + f2(B.x - px * hw) + ' ' + f2(B.y - py * hw) + 'Z" fill="' + esc(fill) + '"/>';
}
function renderArrows(rawArrows, nodeById, layerById, bg, bb, S) {
  var lines = '', heads = '', labels = '', unresolved = 0, degenerate = 0;
  arr(rawArrows).forEach(function (b) {
    if (!b) return;
    var A = anchorOf(slug(b.from), nodeById, layerById), B = anchorOf(slug(b.to), nodeById, layerById);
    if (!A || !B) { unresolved++; return; }
    if (nested(A, B)) { degenerate++; return; }
    var p1 = borderPoint(A, B.cx, B.cy), p2 = borderPoint(B, A.cx, A.cy);
    var dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy);
    if (len < 1) { degenerate++; return; }
    var ux = dx / len, uy = dy / len;
    var col = color(b.color, S.edgeColor);
    var kind = (b.head && b.head !== 'default' && b.head !== '') ? b.head : (S.arrowHead || 'triangle');
    var dbl = b.double === true || kind === 'double'; if (kind === 'double') kind = 'triangle';
    var style = (b.style === 'dashed' || b.style === 'dotted' || b.style === 'solid') ? b.style : (S.arrowStyle || 'solid');
    var w = num(b.width, 0) > 0 ? num(b.width, 0) : (S.arrowWidth || 2);
    var s = Math.max(S.arrowHeadSize || 11, w * 4);
    var endIn = headInset(kind, s), startIn = dbl ? headInset(kind, s) : 0;
    lines += shaft(p1.x + ux * startIn, p1.y + uy * startIn, p2.x - ux * endIn, p2.y - uy * endIn, style, col, w);
    heads += arrowHead(p2, ux, uy, s, col, kind, w);
    if (dbl) heads += arrowHead(p1, -ux, -uy, s, col, kind, w);
    bb.add(p2.x, p2.y, 0, 0); bb.add(p1.x, p1.y, 0, 0);
    var lab = trim(b.label);
    if (lab) {
      var mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      var lw = Math.max(12, textWidth(lab, 11.5)) + 12, lh = 19;
      var lx = mx - lw / 2, ly = my - lh / 2;
      labels += '<path d="' + roundedRectPath(lx, ly, lw, lh, 4) + '" fill="' + esc(bg === 'transparent' ? WHITE : bg) + '" stroke="' + esc(col) + '" stroke-width="1"/>';
      labels += textEl(mx, my + 4, lab, 11.5, 500, col, 'middle');
      bb.add(lx, ly, lw, lh);
    }
  });
  return { svg: lines + heads + labels, unresolved: unresolved, degenerate: degenerate };
}

// ── bounding box over everything drawn ──────────────────────────────────────────
function bounds() {
  return {
    minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity,
    add: function (x, y, w, h) {
      if (x < this.minX) this.minX = x; if (y < this.minY) this.minY = y;
      if (x + w > this.maxX) this.maxX = x + w; if (y + h > this.maxY) this.maxY = y + h;
    },
    empty: function () { return !isFinite(this.minX); }
  };
}

// ── empty-state placeholder (type + source aware, faint sample sketch) ────────────
var EMPTY_HINTS = {
  org: 'Add cards - set each card\'s “Reports to” to build the tree',
  mindmap: 'Add cards - set “Parent” to branch out from the centre',
  layercake: 'Add cards and layers to stack your layercake',
  process: 'Add cards and flow arrows to lay out your process',
  timeline: 'Add cards in order - each one is a milestone on the spine',
  cycle: 'Add stages in order - they loop around a ring',
  pyramid: 'Add tiers top→bottom to stack a pyramid / funnel',
  kanban: 'Add cards and set each card\'s “Group” to a column',
  matrix: 'Add items and place each in a quadrant',
  gantt: 'Add tasks with real dates (or a start + length) to lay bars on a time axis'
};
var SOURCE_HINTS = { text: 'Type a diagram - the field shows the syntax', ascii: 'Draw boxes with +  -  | and arrows with ->  ^  v', mermaid: 'Paste Mermaid: graph LR  /  A[Client] --> B(API)', dot: 'Paste DOT: digraph { a -> b -> c }', pikchr: 'Paste Pikchr: box "A"; arrow; box "B"', table: 'Paste rows: id,label,parent  (or from,to,label)' };
function placeholder(mode, source) {
  var msg = (source && SOURCE_HINTS[source]) ? SOURCE_HINTS[source] : (EMPTY_HINTS[mode] || EMPTY_HINTS.org);
  var ghost = '#cfe6dd';
  var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760" width="1200" height="760"'
    + ' style="width:100%;height:auto;display:block;"><rect width="100%" height="100%" fill="' + WHITE + '"/>';
  // faint sample sketch
  s += '<path d="' + roundedRectPath(520, 250, 160, 60, 14) + '" fill="none" stroke="' + ghost + '" stroke-width="2"/>';
  s += '<path d="' + roundedRectPath(420, 380, 160, 60, 14) + '" fill="none" stroke="' + ghost + '" stroke-width="2"/>';
  s += '<path d="' + roundedRectPath(620, 380, 160, 60, 14) + '" fill="none" stroke="' + ghost + '" stroke-width="2"/>';
  s += '<path d="M600 310L600 345L500 345L500 378" fill="none" stroke="' + ghost + '" stroke-width="2"/>';
  s += '<path d="M600 345L700 345L700 378" fill="none" stroke="' + ghost + '" stroke-width="2"/>';
  s += textEl(600, 200, msg, 22, 600, '#5b756c', 'middle');
  return s + '</svg>';
}
function errPlaceholder(msg) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760" width="1200" height="760"'
    + ' style="width:100%;height:auto;display:block;"><rect width="100%" height="100%" fill="' + WHITE + '"/>'
    + '<path d="' + roundedRectPath(380, 300, 440, 160, 16) + '" fill="none" stroke="' + FOG + '" stroke-width="2"/>'
    + textEl(600, 390, msg, 22, 500, '#8a9a95', 'middle') + '</svg>';
}

// ── text DSL parsing ─────────────────────────────────────────────────────────────
function dslLines(text) { return String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n'); }
function isComment(t) { return !t || t.indexOf('//') === 0; }
function leadIndent(s) { var n = 0; for (var i = 0; i < s.length; i++) { var c = s.charAt(i); if (c === ' ') n++; else if (c === '\t') n += 4; else break; } return n; }
function stripBullet(s) { return s.replace(/^[-*•]\s+/, ''); }
function splitDetail(s) { var i = s.indexOf('::'); return i >= 0 ? { label: s.slice(0, i).trim(), detail: s.slice(i + 2).trim() } : { label: s.trim(), detail: '' }; }
function splitArrowLabel(s) { var m = s.match(/\s:\s+(.+)$/); return m ? { body: s.slice(0, m.index), label: m[1].trim() } : { body: s, label: '' }; }
function imageRef(s) {
  s = trim(s);
  if (!s) return '';
  var m = s.match(/^([a-z][a-z0-9+.-]*):/i);
  if (m) { var sch = m[1].toLowerCase(); return (sch === 'http' || sch === 'https' || sch === 'data') ? s : ''; }
  return (s.indexOf('/') >= 0 || /\.(png|jpe?g|gif|svg|webp|avif|bmp|ico)$/i.test(s)) ? s : '';
}
// `Label :: Detail @ image #hex` plus shape wrappers ([Box] (Rounded) ([Pill]) {…}).
function splitToken(s) {
  s = String(s == null ? '' : s);
  var image = '', m = s.match(/\s@\s*([^@]+)$/);
  if (m) { var ref = imageRef(m[1]); if (ref) { image = ref; s = s.slice(0, m.index); } }
  var fill = '', fm = s.match(/\s(#[0-9a-fA-F]{3,8})\s*$/);
  if (fm) {
    // Only treat a trailing #hex as a card fill if it's a real colour length (6/8) or
    // a 3/4 shorthand containing a hex letter - so "Issue #1234" / "Room #500" stay as
    // labels instead of being eaten as a colour.
    var hx = fm[1].slice(1), hl = hx.length, hasLetter = /[a-f]/i.test(hx);
    if (hl === 6 || hl === 8 || ((hl === 3 || hl === 4) && hasLetter)) { fill = fm[1]; s = s.slice(0, fm.index); }
  }
  var shape = '', t = s.trim();
  if (/^\(\[[\s\S]*\]\)$/.test(t)) { shape = 'pill'; t = t.slice(2, -2); }
  else if (/^\[\([\s\S]*\)\]$/.test(t)) { shape = 'rounded'; t = t.slice(2, -2); }
  else if (/^\[\[[\s\S]*\]\]$/.test(t)) { shape = 'box'; t = t.slice(2, -2); }
  else if (/^\([\s\S]*\)$/.test(t)) { shape = 'rounded'; t = t.slice(1, -1); }
  else if (/^\[[\s\S]*\]$/.test(t)) { shape = 'box'; t = t.slice(1, -1); }
  else if (/^\{[\s\S]*\}$/.test(t)) { shape = 'box'; t = t.slice(1, -1); }
  var d = splitDetail(t);
  return { label: d.label, detail: d.detail, image: image, shape: shape, fill: fill };
}
// Map an edge operator string to style/head/width/double.
function edgeOp(op) {
  var o = { style: 'solid', head: '', width: 0, double: false };
  if (op.indexOf('<') >= 0) o.double = true;
  if (op.indexOf('.') >= 0) o.style = 'dotted';
  if (op.indexOf('=') >= 0) o.width = 3.5;
  if (op.indexOf('o') >= 0) o.head = 'circle';        // mermaid circle edge --o
  else if (op.indexOf('x') >= 0) o.head = 'none';     // mermaid cross edge --x (no cross head)
  else if (op.indexOf('>') < 0 && !o.double) o.head = 'none'; // --- or -.-
  return o;
}
// Split on a top-level delimiter: brackets, braces, quotes and a mermaid |edge
// label| protect a delimiter that belongs to a label.
function splitTop(s, ch) {
  var out = [], depth = 0, q = '', pipe = false, cur = '';
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (q) { cur += c; if (c === q) q = ''; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === '|') { pipe = !pipe; cur += c; continue; }
    if (c === '[' || c === '(' || c === '{') depth++;
    else if (c === ']' || c === ')' || c === '}') depth--;
    else if (c === ch && depth <= 0 && !pipe) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  var kept = out.filter(function (p) { return p.trim(); });
  return kept.length ? kept : [''];
}
// Split a mermaid fan-out group `A & B` into its members, so an ampersand inside a
// node label (`A[R & D]`) stays part of the label.
function splitAmp(s) { return splitTop(s, '&'); }
// Mermaid wraps any label that carries punctuation in quotes; they are syntax.
function unquote(s) { return String(s == null ? '' : s).replace(/^["']|["']$/g, '').trim(); }
// Parse a chain like `A --> B -.-> C : label` (or mermaid `A -->|x| B`) into arrows.
// resolve(token) → node id (process/mermaid create nodes); null = resolve by slug.
// `amp` opts into mermaid fan-out (`A --> B & C`): off for the text DSL, where an
// ampersand in a bare line is part of the label ("Sales & Marketing").
function parseEdges(content, resolve, arrows, amp) {
  var al = splitArrowLabel(content), body = al.body, chainLabel = al.label;
  // mermaid `-- text -->` / `-. text .->` → normalise to `-->|text|`
  body = body.replace(/--\s+([^|>][^>]*?)\s+-->/g, '-->|$1|').replace(/-\.\s+([^|>][^>]*?)\s+\.->/g, '-.->|$1|');
  var OPRE = /(<-->|<-+>|<->|-\.->|-\.\.->|\.\.>|===>|==>|=>|o--o|x--x|--->|-->|->|--o|--x|o--|x--|---|-\.-)/g;
  var parts = [], ops = [], last = 0, m;
  while ((m = OPRE.exec(body))) { parts.push(body.slice(last, m.index)); ops.push(m[1]); last = m.index + m[1].length; }
  parts.push(body.slice(last));
  if (ops.length === 0) {
    var only = parts[0].trim();
    if (only && resolve) (amp ? splitAmp(only) : [only]).forEach(function (p) { if (p.trim()) resolve(p.trim()); });
    return;
  }
  var labels = [];
  for (var i = 1; i < parts.length; i++) {
    var pm = parts[i].match(/^\s*\|([^|]*)\|/);
    if (pm) { labels[i - 1] = amp ? unquote(pm[1]) : pm[1].trim(); parts[i] = parts[i].replace(/^\s*\|[^|]*\|/, ''); }
  }
  var groups = parts.map(function (p) {
    return (amp ? splitAmp(p) : [p]).map(function (tk) {
      return resolve ? resolve(tk.trim()) : slug(splitToken(tk.trim()).label);
    });
  });
  for (var j = 0; j < ops.length; j++) {
    var o = edgeOp(ops[j]);
    var lbl = labels[j] || (j === ops.length - 1 ? chainLabel : '');
    var from = groups[j], to = groups[j + 1];
    for (var a = 0; a < from.length; a++) {
      for (var b = 0; b < to.length; b++) {
        arrows.push({ from: from[a], to: to[b], label: lbl, style: o.style, head: o.head, width: o.width, double: o.double, color: '' });
      }
    }
  }
}
function collectArrows(content, arrows, addNode) { parseEdges(content, addNode, arrows); }

function parseOrg(lines) {
  var nodes = [], arrows = [], used = {}, stack = [];
  function uid(label) { var b = slug(label) || 'node', id = b, k = 2; while (used[id]) { id = b + '-' + k; k++; } used[id] = 1; return id; }
  lines.forEach(function (raw) {
    var t = raw.trim();
    if (isComment(t) || t.charAt(0) === '#') return;
    if (/-->|->|==>/.test(t)) { collectArrows(stripBullet(t), arrows, null); return; }
    var indent = leadIndent(raw), d = splitToken(stripBullet(t));
    if (!d.label) return;
    var id = uid(d.label);
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    nodes.push({ shape: d.shape || 'rounded', nodeId: id, label: d.label, detail: d.detail, image: d.image, fill: d.fill, parent: stack.length ? stack[stack.length - 1].id : '', layer: '' });
    stack.push({ indent: indent, id: id });
  });
  return { nodes: nodes, layers: [], arrows: arrows };
}
function parseLayercake(lines) {
  var nodes = [], layers = [], arrows = [], usedN = {}, usedL = {}, cur = '', bi = 0;
  function uid(used, label, pre) { var b = slug(label) || pre, id = b, k = 2; while (used[id]) { id = b + '-' + k; k++; } used[id] = 1; return id; }
  lines.forEach(function (raw) {
    var t = raw.trim();
    if (isComment(t)) return;
    if (t.charAt(0) === '#') {
      var lab = t.replace(/^#+\s*/, '').trim();
      if (!lab) return;
      var lid = uid(usedL, lab, 'layer');
      layers.push({ kind: 'layer', layerId: lid, label: lab, bandFill: BAND_PALETTE[bi % BAND_PALETTE.length] });
      bi++; cur = lid; return;
    }
    var c = stripBullet(t);
    if (/-->|->|==>/.test(c)) { collectArrows(c, arrows, null); return; }
    var d = splitToken(c);
    if (!d.label) return;
    nodes.push({ shape: d.shape || 'rounded', nodeId: uid(usedN, d.label, 'node'), label: d.label, detail: d.detail, image: d.image, fill: d.fill, parent: '', layer: cur });
  });
  return { nodes: nodes, layers: layers, arrows: arrows };
}
function parseProcess(lines) {
  var nodes = [], arrows = [], seen = {};
  function addNode(rawPart) {
    var d = splitToken(rawPart), key = slug(d.label) || 'step';
    if (seen[key]) {
      if (d.detail && !seen[key].detail) seen[key].detail = d.detail;
      if (d.image && !seen[key].image) seen[key].image = d.image;
      if (d.shape && seen[key].shape === 'rounded') seen[key].shape = d.shape;
      return key;
    }
    var node = { shape: d.shape || 'rounded', nodeId: key, label: d.label, detail: d.detail, image: d.image, fill: d.fill, parent: '', layer: '' };
    seen[key] = node; nodes.push(node);
    return key;
  }
  lines.forEach(function (raw) {
    var t = stripBullet(raw.trim());
    if (isComment(t) || t.charAt(0) === '#') return;
    if (/-->|->|==>|---/.test(t)) collectArrows(t, arrows, addNode);
    else addNode(t);
  });
  return { nodes: nodes, layers: [], arrows: arrows };
}
function parseList(lines) {
  var nodes = [], used = {};
  function uid(l) { var b = slug(l) || 'item', id = b, k = 2; while (used[id]) { id = b + '-' + k; k++; } used[id] = 1; return id; }
  lines.forEach(function (raw) {
    var t = stripBullet(raw.trim());
    if (isComment(t) || t.charAt(0) === '#') return;
    var d = splitToken(t); if (!d.label) return;
    nodes.push({ shape: d.shape || 'rounded', nodeId: uid(d.label), label: d.label, detail: d.detail, image: d.image, fill: d.fill, parent: '', layer: '' });
  });
  return { nodes: nodes, layers: [], arrows: [] };
}
function parseMatrix(lines) {
  var nodes = [], used = {}, cur = 'tr';
  function uid(l) { var b = slug(l) || 'item', id = b, k = 2; while (used[id]) { id = b + '-' + k; k++; } used[id] = 1; return id; }
  lines.forEach(function (raw) {
    var t = stripBullet(raw.trim());
    if (isComment(t)) return;
    if (t.charAt(0) === '#') { var q = quadFromText(t.replace(/^#+\s*/, '')); if (q) cur = q; return; }
    var score = null, sm = t.match(/@\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)\s*$/);
    if (sm) { score = [parseFloat(sm[1]), parseFloat(sm[2])]; t = t.slice(0, sm.index).trim(); }
    var d = splitToken(t); if (!d.label) return;
    nodes.push({ shape: d.shape || 'pill', nodeId: uid(d.label), label: d.label, detail: d.detail, image: d.image, fill: d.fill, parent: '', layer: '', quadrant: cur, score: score });
  });
  return { nodes: nodes, layers: [], arrows: [] };
}
function parseGantt(lines) {
  var nodes = [], arrows = [], used = {}, seq = 0;
  function uid(l) { var b = slug(l) || 'task', id = b, k = 2; while (used[id]) { id = b + '-' + k; k++; } used[id] = 1; return id; }
  lines.forEach(function (raw) {
    var t = stripBullet(raw.trim());
    if (isComment(t) || t.charAt(0) === '#') return;
    if (/-->|->|==>/.test(t)) { collectArrows(t, arrows, null); return; }
    var al = splitArrowLabel(t), body = al.body, spec = al.label, start = NaN, len = NaN;
    if (spec) {
      var r = spec.match(/^([\d.]+)\s*(?:\.\.|to|-)\s*([\d.]+)$/i), p = spec.match(/^([\d.]+)\s*\+\s*([\d.]+)$/);
      if (r) { start = parseFloat(r[1]); len = parseFloat(r[2]) - start; }
      else if (p) { start = parseFloat(p[1]); len = parseFloat(p[2]); }
    }
    var d = splitToken(body); if (!d.label) return;
    if (!isFinite(start)) start = seq; if (!isFinite(len) || len <= 0) len = 1; seq = Math.max(seq, start + len);
    nodes.push({ shape: d.shape || 'rounded', nodeId: uid(d.label), label: d.label, detail: d.detail, image: d.image, fill: d.fill, parent: '', layer: '', ganttStart: start, ganttLen: len });
  });
  return { nodes: nodes, layers: [], arrows: arrows };
}
function parseDsl(text, mode) {
  var lines = dslLines(text);
  if (mode === 'layercake' || mode === 'kanban') return parseLayercake(lines);
  if (mode === 'process') return parseProcess(lines);
  if (mode === 'timeline' || mode === 'cycle' || mode === 'pyramid') return parseList(lines);
  if (mode === 'matrix') return parseMatrix(lines);
  if (mode === 'gantt') return parseGantt(lines);
  return parseOrg(lines); // org + mindmap
}

// ── Mermaid sequenceDiagram → participants as cards, messages as arrows ──────────
// Lifelines are APPROXIMATED, not drawn: the diagram has no time axis, so each
// participant becomes one card laid out left to right and each message a numbered
// arrow between two cards. Repeated messages in the same direction merge into one
// arrow so the labels stay readable.
// ponytail: a message pair in both directions still draws two arrows over the same
// line; give sequence its own layout (lifeline columns + stacked rows) if people
// paste long conversations.
function parseSequence(lines) {
  var nodes = [], byId = {}, arrows = [], byPair = {}, warns = [], seq = 0;
  function warn(msg) { if (warns.length < 40) warns.push(msg); }
  function ensure(rawName, rawLabel) {
    var name = unquote(rawName);
    var id = slug(name) || ('p-' + (nodes.length + 1));
    if (!byId[id]) { byId[id] = { shape: 'rounded', nodeId: id, label: rawLabel || name || titleize(id), detail: '', image: '', fill: '', parent: '', layer: '' }; nodes.push(byId[id]); }
    else if (rawLabel) byId[id].label = rawLabel;
    return id;
  }
  lines.forEach(function (raw) {
    var t = raw.trim();
    if (!t || t.indexOf('%%') === 0 || /^sequenceDiagram\b/i.test(t)) return;
    var p = t.match(/^(?:participant|actor)\s+(.+)$/i);
    if (p) {
      var as = p[1].split(/\s+as\s+/i);
      ensure(as[0], as.length > 1 ? unquote(as.slice(1).join(' as ')) : '');
      return;
    }
    var ci = t.indexOf(':');
    var head = ci >= 0 ? t.slice(0, ci) : t;
    var body = ci >= 0 ? t.slice(ci + 1).trim() : '';
    var om = head.match(/(-->>|->>|-->|->|--x|-x|--\)|-\))/);
    if (om && !/^(note|loop|alt|else|opt|par|and|critical|break|rect|box)\b/i.test(t)) {
      var from = ensure(head.slice(0, om.index), '');
      // `A->>+B` / `B-->>-A`: the + and - are Mermaid's activation shorthand, not part
      // of the participant's name.
      var to = ensure(head.slice(om.index + om[0].length).replace(/^\s*[+-]/, ''), '');
      var op = om[1];
      var style = op.indexOf('--') === 0 ? 'dashed' : 'solid';
      var headKind = (op.indexOf('x') >= 0) ? 'none' : (op.indexOf(')') >= 0 ? 'open' : '');
      seq++;
      var label = body ? (seq + '. ' + body) : String(seq);
      var key = from + '>' + to;
      if (byPair[key]) { byPair[key].label += ' · ' + label; return; }
      byPair[key] = { from: from, to: to, label: label, style: style, head: headKind, width: 0, double: false, color: '' };
      arrows.push(byPair[key]);
      return;
    }
    if (/^(note|loop|alt|else|opt|par|and|critical|break|rect|box|end|activate|deactivate|autonumber|title|link|links|create|destroy)\b/i.test(t)) { warn(t.slice(0, 48)); return; }
    warn(t.slice(0, 48));
  });
  return { nodes: nodes, layers: [], arrows: arrows, diagramType: 'process', dir: 'right', warns: warns };
}

// ── Mermaid subset → {nodes, layers, arrows, diagramType, dir} ────────────────────
function parseMermaid(text) {
  var lines = dslLines(text), nodes = [], byId = {}, layers = [], arrows = [], usedL = {}, order = 0;
  var diagramType = 'process', dir = 'down', sub = null, subStack = [], warns = [];
  for (var li = 0; li < lines.length; li++) {
    var first = lines[li].trim();
    if (!first || first.indexOf('%%') === 0) continue;
    if (/^sequenceDiagram\b/i.test(first)) return parseSequence(lines);
    break;
  }
  function warn(msg) { if (warns.length < 40) warns.push(msg); }
  function ensure(id, label, shape) {
    id = slug(id) || ('n-' + (++order));
    if (!byId[id]) { byId[id] = { shape: shape || 'rounded', nodeId: id, label: label || titleize(id), detail: '', image: '', fill: '', parent: '', layer: sub || '' }; nodes.push(byId[id]); }
    else { if (label && (byId[id].label === titleize(id) || !byId[id].label)) byId[id].label = label; if (shape && byId[id].shape === 'rounded') byId[id].shape = shape; if (sub && !byId[id].layer) byId[id].layer = sub; }
    return id;
  }
  function defOf(tok) {
    tok = tok.trim();
    // `A:::className` assigns a CSS class. The class is not supported, but the node
    // reference in front of it is real - drop the suffix instead of inventing a node
    // called "A Big" out of it.
    var cls = tok.match(/^([\s\S]*?):::[A-Za-z0-9_-]+$/);
    if (cls && cls[1].trim()) tok = cls[1].trim();
    var m = tok.match(/^([A-Za-z0-9_]+)\s*(\(\[[\s\S]*\]\)|\[\([\s\S]*\)\]|\(\([\s\S]*\)\)|\{\{[\s\S]*\}\}|\{[\s\S]*\}|\[\[[\s\S]*\]\]|\[[\s\S]*\]|\([\s\S]*\))\s*$/);
    if (m) {
      var id = m[1], body = m[2], label = '', shape = 'rounded';
      if (/^\(\[[\s\S]*\]\)$/.test(body)) { shape = 'pill'; label = body.slice(2, -2); }        // ([text]) stadium
      else if (/^\(\([\s\S]*\)\)$/.test(body)) { shape = 'circle'; label = body.slice(2, -2); }  // ((text)) circle
      else if (/^\[\([\s\S]*\)\]$/.test(body)) { shape = 'cylinder'; label = body.slice(2, -2); } // [(text)] database
      else if (/^\{\{[\s\S]*\}\}$/.test(body)) { shape = 'hexagon'; label = body.slice(2, -2); }  // {{text}} hexagon
      else if (/^\[\[[\s\S]*\]\]$/.test(body)) { shape = 'box'; label = body.slice(2, -2); }      // [[text]] subroutine
      else if (/^\{[\s\S]*\}$/.test(body)) { shape = 'diamond'; label = body.slice(1, -1); }      // {text} decision
      else if (/^\[[\s\S]*\]$/.test(body)) { shape = 'box'; label = body.slice(1, -1); }
      else { shape = 'rounded'; label = body.slice(1, -1); }
      return ensure(id, unquote(label), shape);
    }
    return ensure(tok, null, null);
  }
  // A semicolon separates statements, so `graph TD;A-->B;B-->C` is one line and three
  // statements (the form every Mermaid doc opens with). A `%%` comment owns its whole
  // line, so it is dropped before the split.
  var stmts = [];
  lines.forEach(function (raw) {
    if (raw.trim().indexOf('%%') === 0) return;
    splitTop(raw, ';').forEach(function (s) { stmts.push(s); });
  });
  stmts.forEach(function (raw) {
    var t = raw.trim();
    if (!t) return;
    var h = t.match(/^(graph|flowchart)\s+(TB|TD|BT|RL|LR)\b/i);
    if (h) { var d = h[2].toUpperCase(); dir = (d === 'LR' || d === 'RL') ? 'right' : 'down'; return; }
    var sg = t.match(/^subgraph\b\s*(.*)$/i);
    if (sg) {
      // Mermaid "subgraph id[Title]" - id is referenced by edges, the bracket is the
      // display title. Bare "subgraph Title" uses the whole token as the label.
      var sgRaw = unquote(sg[1]);
      var mb = sgRaw.match(/^([A-Za-z0-9_]+)\s*\[([\s\S]*)\]$/);
      var lab = mb ? unquote(mb[2]) : sgRaw.replace(/\[[\s\S]*\]$/, '').trim();
      var lid = slug(mb ? mb[1] : lab) || ('layer-' + (layers.length + 1));
      // A nested subgraph folds into the band already open - one band per outermost
      // group, since layercake stacks bands and cannot nest them.
      if (subStack.length) { warn('nested subgraph folded into the outer band: ' + t.slice(0, 40)); subStack.push(lid); return; }
      diagramType = 'layercake';
      if (!usedL[lid]) { usedL[lid] = 1; layers.push({ kind: 'layer', layerId: lid, label: lab || titleize(lid), bandFill: BAND_PALETTE[layers.length % BAND_PALETTE.length] }); }
      subStack.push(lid); sub = lid; return;
    }
    if (/^end$/i.test(t)) { subStack.pop(); sub = subStack.length ? subStack[0] : null; return; }
    if (/^(classDef|class|click|style|linkStyle|direction)\b/i.test(t)) { warn(t.slice(0, 48)); return; }
    if (/(-->|---|-\.->|==>|<-->|<->|-\.-|\bo--|--o|x--|--x)/.test(t)) { parseEdges(t, defOf, arrows, true); return; }
    defOf(t);
  });
  return { nodes: nodes, layers: layers, arrows: arrows, diagramType: diagramType, dir: dir, warns: warns };
}

// ── DOT / Graphviz subset → {nodes, layers, arrows, diagramType, dir} ────────────
var DOT_SHAPES = {
  box: 'box', rect: 'box', rectangle: 'box', square: 'box', box3d: 'box', record: 'box', mrecord: 'box',
  ellipse: 'ellipse', oval: 'ellipse', egg: 'ellipse',
  circle: 'circle', doublecircle: 'circle',
  diamond: 'diamond', mdiamond: 'diamond',
  cylinder: 'cylinder', hexagon: 'hexagon',
  note: 'file', folder: 'file', tab: 'file', component: 'file',
  plaintext: 'text', plain: 'text', none: 'text'
};
var DOT_HEADS = { none: 'none', normal: 'triangle', empty: 'triangle', vee: 'open', open: 'open', diamond: 'diamond', odiamond: 'diamond', dot: 'circle', odot: 'circle', tee: 'bar' };

// Split DOT source into statements. Quotes, [attribute lists] and <HTML labels> are
// opaque; // # and /* */ comments are dropped; a `{` that opens a graph or subgraph
// body becomes its own statement, while one inside a statement (`a -> {b c}`) stays
// part of it.
function dotStatements(text) {
  var s = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
  var out = [], cur = '', i = 0, n = s.length, q = false, brk = 0, html = 0, brace = 0;
  function flush() { if (cur.trim()) out.push(cur.trim()); cur = ''; }
  while (i < n) {
    var c = s.charAt(i);
    if (q) { cur += c; if (c === '\\' && i + 1 < n) { cur += s.charAt(i + 1); i += 2; continue; } if (c === '"') q = false; i++; continue; }
    if (c === '"') { q = true; cur += c; i++; continue; }
    if (html > 0) { if (c === '<') html++; else if (c === '>') html--; cur += c; i++; continue; }
    if (c === '<' && brk > 0) { html++; cur += c; i++; continue; }
    if (c === '/' && s.charAt(i + 1) === '/') { while (i < n && s.charAt(i) !== '\n') i++; continue; }
    if (c === '#' && !cur.trim()) { while (i < n && s.charAt(i) !== '\n') i++; continue; }
    if (c === '/' && s.charAt(i + 1) === '*') { i += 2; while (i < n && !(s.charAt(i) === '*' && s.charAt(i + 1) === '/')) i++; i += 2; continue; }
    if (c === '[') { brk++; cur += c; i++; continue; }
    if (c === ']') { brk--; cur += c; i++; continue; }
    if (brk <= 0) {
      if (c === '{' && brace === 0 && (!cur.trim() || /^(strict\s+)?(di)?graph\b/i.test(cur.trim()) || /^subgraph\b/i.test(cur.trim()))) { flush(); out.push('{'); i++; continue; }
      if (c === '{') { brace++; cur += c; i++; continue; }
      if (c === '}' && brace > 0) { brace--; cur += c; i++; continue; }
      if (c === '}') { flush(); out.push('}'); i++; continue; }
      if (c === ';' || c === '\n') { flush(); i++; continue; }
    }
    cur += c; i++;
  }
  flush();
  return out;
}
// One [k=v, k=v] list. Values may be quoted, <HTML>, or bare.
function dotAttrs(s) {
  var out = {}, i = 0, n = s.length;
  while (i < n) {
    while (i < n && /[\s,;]/.test(s.charAt(i))) i++;
    var km = /^([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(s.slice(i));
    if (!km) { var nx = s.indexOf(',', i); if (nx < 0) break; i = nx + 1; continue; }
    var key = km[1].toLowerCase();
    i += km[0].length;
    while (i < n && /\s/.test(s.charAt(i))) i++;
    var c = s.charAt(i), val = '';
    if (c === '"') {
      i++;
      while (i < n) { var ch = s.charAt(i); if (ch === '\\' && i + 1 < n) { val += ch + s.charAt(i + 1); i += 2; continue; } if (ch === '"') { i++; break; } val += ch; i++; }
    } else if (c === '<') {
      var d = 0;
      while (i < n) { var h = s.charAt(i); val += h; i++; if (h === '<') d++; else if (h === '>') { d--; if (d <= 0) break; } }
    } else {
      while (i < n && !/[\s,;\]]/.test(s.charAt(i))) { val += s.charAt(i); i++; }
    }
    out[key] = val;
  }
  return out;
}
function dotText(s) {
  return String(s == null ? '' : s).replace(/\\"/g, '"')
    .replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ').trim();
}
// A DOT label into the card's label + detail: \n \l \r (or <br> in an HTML label)
// break the lines, the first is the title and the rest the subtitle.
function dotSplitLabel(v) {
  var s = String(v == null ? '' : v);
  if (s.charAt(0) === '<') {
    if (s.charAt(s.length - 1) === '>') s = s.slice(1, -1);
    s = s.replace(/<br\s*\/?>/gi, '\\n').replace(/<[^>]*>/g, '');
  }
  var parts = s.split(/\\[nlr]/).map(dotText).filter(function (p) { return p; });
  return { label: parts.length ? parts[0] : '', detail: parts.slice(1).join(' ') };
}
function dotName(tok) {
  var s = String(tok == null ? '' : tok).trim();
  if (s.charAt(0) === '"' && s.charAt(s.length - 1) === '"' && s.length > 1) s = s.slice(1, -1).replace(/\\"/g, '"');
  return s.trim();
}
// Split `a, b` (and, inside a { } group, `a b`) into endpoint tokens.
function dotSplitList(s, ws) {
  var out = [], cur = '', q = false;
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (q) { cur += c; if (c === '"') q = false; continue; }
    if (c === '"') { q = true; cur += c; continue; }
    if (c === ',' || c === ';' || (ws && /\s/.test(c))) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
// Split an edge statement body on -> / -- , leaving quoted ids alone.
function dotEdgeSplit(s) {
  var segs = [], ops = [], cur = '', q = false, i = 0;
  while (i < s.length) {
    var c = s.charAt(i);
    if (q) { cur += c; if (c === '\\') { cur += (s.charAt(i + 1) || ''); i += 2; continue; } if (c === '"') q = false; i++; continue; }
    if (c === '"') { q = true; cur += c; i++; continue; }
    if (c === '-' && (s.charAt(i + 1) === '>' || s.charAt(i + 1) === '-')) { segs.push(cur); ops.push(s.substr(i, 2)); cur = ''; i += 2; continue; }
    cur += c; i++;
  }
  segs.push(cur);
  return { segs: segs, ops: ops };
}
function parseDot(text) {
  var nodes = [], byId = {}, layers = [], arrows = [], usedL = {}, warns = [];
  var dir = 'down', nodeDefaults = {}, edgeDefaults = {}, scopes = [], bands = [];
  function warn(m) { if (warns.length < 40) warns.push(m); }
  function band() { return bands.length ? bands[0] : ''; }
  function merged(a) { var o = {}; Object.keys(edgeDefaults).forEach(function (k) { o[k] = edgeDefaults[k]; }); Object.keys(a).forEach(function (k) { o[k] = a[k]; }); return o; }
  function shapeOf(a) {
    var st = String(a.style || '').toLowerCase();
    var sh = DOT_SHAPES[String(a.shape || '').toLowerCase()];
    if (!sh) return st.indexOf('rounded') >= 0 ? 'rounded' : '';
    if (sh === 'box' && st.indexOf('rounded') >= 0) return 'rounded';
    return sh;
  }
  function paintOf(a) {
    var st = String(a.style || '').toLowerCase();
    var fc = pikColor(a.fillcolor || ''), cl = pikColor(a.color || '');
    var fill = fc || (st.indexOf('filled') >= 0 ? cl : '');
    return { fill: fill === 'none' ? '' : fill, stroke: cl === 'none' ? '' : cl };
  }
  function ensureNode(tok, attrs) {
    var name = dotName(tok);
    // `a:port` / `a:port:compass` addresses a field of node `a`. An unquoted DOT id
    // cannot contain a colon, so everything from the first one is the port.
    if (String(tok).trim().charAt(0) !== '"' && name.indexOf(':') > 0) name = name.split(':')[0].trim();
    if (!name) return '';
    var id = slug(name) || ('n-' + (nodes.length + 1));
    var a = {};
    Object.keys(nodeDefaults).forEach(function (k) { a[k] = nodeDefaults[k]; });
    Object.keys(attrs || {}).forEach(function (k) { a[k] = attrs[k]; });
    var lab = a.label !== undefined ? dotSplitLabel(a.label) : { label: name, detail: '' };
    if (!byId[id]) {
      var shape = shapeOf(a), paint = paintOf(a);
      byId[id] = { shape: shape || 'rounded', nodeId: id, label: lab.label || name, detail: lab.detail, image: '', fill: paint.fill, parent: '', layer: band(), stroke: paint.stroke };
      nodes.push(byId[id]);
    } else {
      // Only THIS statement's own attributes update a node that already exists - a
      // later `a -> b` carries the graph defaults, which must not overwrite the
      // shape or colour the node was declared with.
      var own = attrs || {}, nd = byId[id], oshape = shapeOf(own), opaint = paintOf(own);
      if (own.label !== undefined && lab.label) { nd.label = lab.label; nd.detail = lab.detail; }
      if (oshape) nd.shape = oshape;
      if (opaint.fill) nd.fill = opaint.fill;
      if (opaint.stroke) nd.stroke = opaint.stroke;
      if (!nd.layer) nd.layer = band();
    }
    return id;
  }
  function endpointIds(seg) {
    var s = String(seg == null ? '' : seg).trim();
    var braced = /^\{[\s\S]*\}$/.test(s);
    if (braced) s = s.slice(1, -1);
    var out = [];
    dotSplitList(s, braced).forEach(function (t) {
      // Same rule the node statements use: a bare run of unquoted words is not a DOT
      // id, so it is prose around the graph, not an endpoint. Skip it, never invent a
      // node from it.
      if (t.charAt(0) !== '"' && /\s/.test(t)) { warn('skipped: ' + t.slice(0, 40)); return; }
      var id = ensureNode(t, {});
      if (id) out.push(id);
    });
    return out;
  }
  function openScope(headTxt) {
    var sgm = String(headTxt || '').trim().match(/^subgraph\b\s*(.*)$/i);
    var sc = { layer: null };
    if (sgm) {
      var nm = dotName(sgm[1]);
      if (/^cluster/i.test(nm)) {
        // Clusters become layercake bands. Bands stack and cannot nest, so a cluster
        // inside a cluster folds into the one already open.
        if (bands.length) warn('nested cluster folded into the outer band: ' + nm);
        else {
          var lid = slug(nm) || ('layer-' + (layers.length + 1));
          if (!usedL[lid]) {
            usedL[lid] = 1;
            var entry = { kind: 'layer', layerId: lid, label: titleize(nm.replace(/^cluster[_-]?/i, '')) || titleize(lid), bandFill: BAND_PALETTE[layers.length % BAND_PALETTE.length] };
            layers.push(entry); sc.layer = entry;
          } else sc.layer = layers.filter(function (l) { return l.layerId === lid; })[0] || null;
          bands.push(lid);
        }
      }
    }
    scopes.push(sc);
  }
  var pending = null;
  dotStatements(text).forEach(function (st) {
    if (st === '{') { openScope(pending); pending = null; return; }
    if (st === '}') { var sc = scopes.pop(); if (sc && sc.layer) bands.pop(); return; }
    if (/^(strict\s+)?(di)?graph\b/i.test(st) && st.indexOf('[') < 0) { pending = st; return; }
    if (/^subgraph\b/i.test(st)) { pending = st; return; }
    var defm = st.match(/^(node|edge|graph)\s*\[([\s\S]*)\]\s*$/i);
    if (defm) {
      var target = defm[1].toLowerCase(), da = dotAttrs(defm[2]);
      if (target === 'node') Object.keys(da).forEach(function (k) { nodeDefaults[k] = da[k]; });
      else if (target === 'edge') Object.keys(da).forEach(function (k) { edgeDefaults[k] = da[k]; });
      else if (da.rankdir) { var gd = String(dotName(da.rankdir)).toUpperCase(); dir = (gd === 'LR' || gd === 'RL') ? 'right' : 'down'; }
      else warn('skipped: ' + st.slice(0, 40));
      return;
    }
    var asg = st.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([\s\S]+)$/);
    if (asg && st.indexOf('[') < 0 && !/->|--/.test(st)) {
      var k = asg[1].toLowerCase(), v = dotName(asg[2]);
      if (k === 'rankdir') { var rd = v.toUpperCase(); dir = (rd === 'LR' || rd === 'RL') ? 'right' : 'down'; return; }
      if (k === 'label') {
        for (var z = scopes.length - 1; z >= 0; z--) {
          if (scopes[z].layer) { scopes[z].layer.label = dotSplitLabel(v).label || scopes[z].layer.label; return; }
        }
      }
      warn('skipped: ' + st.slice(0, 40)); return;
    }
    var am = st.match(/^([\s\S]*?)\[([\s\S]*)\]\s*$/);
    var bodyTxt = (am ? am[1] : st).trim(), attrs = am ? dotAttrs(am[2]) : {};
    var es = dotEdgeSplit(bodyTxt);
    if (es.ops.length) {
      var ea = merged(attrs);
      var stl = String(ea.style || '').toLowerCase();
      if (stl.indexOf('invis') >= 0) { warn('skipped invisible edge: ' + st.slice(0, 40)); return; }
      var style = stl.indexOf('dashed') >= 0 ? 'dashed' : (stl.indexOf('dotted') >= 0 ? 'dotted' : 'solid');
      var width = stl.indexOf('bold') >= 0 ? 3.5 : num(ea.penwidth, 0);
      var d = String(ea.dir || '').toLowerCase();
      var lab = ea.label !== undefined ? dotSplitLabel(ea.label) : (ea.xlabel !== undefined ? dotSplitLabel(ea.xlabel) : { label: '', detail: '' });
      var text2 = [lab.label, lab.detail].filter(Boolean).join(' ');
      var col = pikColor(ea.color || '');
      for (var j = 0; j < es.ops.length; j++) {
        var L = endpointIds(es.segs[j]), R = endpointIds(es.segs[j + 1]);
        if (!L.length || !R.length) { warn('skipped: ' + st.slice(0, 40)); continue; }
        var hd = DOT_HEADS[String(ea.arrowhead || '').toLowerCase()] || '';
        if (!hd && (es.ops[j] === '--' || d === 'none')) hd = 'none';
        for (var x = 0; x < L.length; x++) {
          for (var y = 0; y < R.length; y++) {
            var a1 = d === 'back' ? R[y] : L[x], b1 = d === 'back' ? L[x] : R[y];
            arrows.push({ from: a1, to: b1, label: text2, style: style, head: hd, width: width, double: d === 'both', color: col === 'none' ? '' : col });
          }
        }
      }
      return;
    }
    // A node statement is one id, or a comma list of them. A bare run of words is
    // not a DOT id, so it is prose or syntax outside the subset: skip and log it.
    var toks = dotSplitList(bodyTxt, false);
    var ok = toks.length > 0 && toks.every(function (tk) { return tk.charAt(0) === '"' || !/\s/.test(tk); });
    if (!ok) { warn('skipped: ' + st.slice(0, 40)); return; }
    toks.forEach(function (tk) { ensureNode(tk, attrs); });
  });
  return { nodes: nodes, layers: layers, arrows: arrows, diagramType: layers.length ? 'layercake' : 'process', dir: dir, warns: warns };
}

// ── CSV / table → {nodes, layers, arrows} ────────────────────────────────────────
function parseTable(text, mode) {
  var rows = dslLines(text).filter(function (l) { return trim(l); });
  var nodes = [], arrows = [], used = {};
  function splitRow(l) { return (l.indexOf('\t') >= 0 ? l.split('\t') : l.split(',')).map(function (c) { return c.trim(); }); }
  function uid(l) { var b = slug(l) || 'row', id = b, k = 2; while (used[id]) { id = b + '-' + k; k++; } used[id] = 1; return id; }
  function ensure(label) { var id = slug(label) || 'n'; if (!used[id]) { used[id] = 1; nodes.push({ shape: 'rounded', nodeId: id, label: label, detail: '', image: '', fill: '', parent: '', layer: '' }); } return id; }
  if (!rows.length) return { nodes: [], layers: [], arrows: [] };
  var header = splitRow(rows[0]).map(function (c) { return c.toLowerCase(); });
  var hasHeader = /^(id|label|name|from|source)$/.test(header[0] || '');
  var start = hasHeader ? 1 : 0;
  var edgeMode = (mode === 'process');
  for (var i = start; i < rows.length; i++) {
    var c = splitRow(rows[i]);
    if (edgeMode) {
      if (c.length >= 2 && c[0] && c[1]) arrows.push({ from: ensure(c[0]), to: ensure(c[1]), label: c[2] || '', style: 'solid', head: '', width: 0, color: '' });
      else if (c[0]) ensure(c[0]);
    } else if (mode === 'timeline' || mode === 'cycle' || mode === 'pyramid') {
      if (c[0]) nodes.push({ shape: 'rounded', nodeId: uid(c[0]), label: c[0], detail: c[1] || '', image: '', fill: '', parent: '', layer: '' });
    } else {
      if (!c[0] && !c[1]) continue;
      var id = slug(c[0]) || uid(c[1] || c[0]); used[id] = 1;
      nodes.push({ shape: 'rounded', nodeId: id, label: c[1] || c[0], detail: c[2] || '', image: '', fill: '', parent: slug(c[3] || ''), layer: slug(c[3] || '') });
    }
  }
  return { nodes: nodes, layers: [], arrows: arrows };
}

// ── grid / dot background (real geometry, capped) ────────────────────────────────
function gridBg(kind, vbX, vbY, vbW, vbH, col) {
  if (kind !== 'dots' && kind !== 'grid') return '';
  var step = 32, out = '', n = 0;
  var x0 = Math.floor(vbX / step) * step, y0 = Math.floor(vbY / step) * step, x1 = vbX + vbW, y1 = vbY + vbH;
  if (kind === 'grid') {
    for (var x = x0; x <= x1 && n < 160; x += step) { out += '<line x1="' + f2(x) + '" y1="' + f2(vbY) + '" x2="' + f2(x) + '" y2="' + f2(y1) + '" stroke="' + esc(col) + '" stroke-width="0.5" opacity="0.16"/>'; n++; }
    for (var y = y0; y <= y1 && n < 360; y += step) { out += '<line x1="' + f2(vbX) + '" y1="' + f2(y) + '" x2="' + f2(x1) + '" y2="' + f2(y) + '" stroke="' + esc(col) + '" stroke-width="0.5" opacity="0.16"/>'; n++; }
  } else {
    for (var yy = y0; yy <= y1 && n < 2500; yy += step) { for (var xx = x0; xx <= x1 && n < 2500; xx += step) { out += '<path d="' + circlePath(xx, yy, 1.3) + '" fill="' + esc(col) + '" opacity="0.26"/>'; n++; } }
  }
  return out;
}

// ── Pikchr (PIC-style) parser + mini geometric layout engine ─────────────────────
// A practical subset of https://pikchr.org. Objects flow in a layout direction and
// attach by compass points; we lay everything out in inches (y-up, like PIC), map
// closed objects → themed cards and open objects → export-safe connectors, then flip
// to screen pixels. Unsupported constructs (macros, [blocks], expressions, splines)
// are skipped and logged - never eval'd.
var PIK_U = 96; // pixels per inch
var PIK_COLORS = {
  black: '#000000', white: '#ffffff', red: '#e5484d', green: '#1a7f4b', blue: '#2264d1',
  cyan: '#1ea7b6', magenta: '#c026d3', yellow: '#f5c542', orange: '#e8833a', purple: '#8a4fd6',
  pink: '#e86ea4', brown: '#9a6a3a', gray: '#8a8f8c', grey: '#8a8f8c', lightgray: '#d7dcd9',
  lightgrey: '#d7dcd9', lightblue: '#cfe0f5', lightgreen: '#cfeddc', lightyellow: '#f6efc9',
  lightpink: '#f6d7e4', lightcyan: '#d3eef1', darkgray: '#5b625f', darkgrey: '#5b625f',
  gold: '#e8c34a', silver: '#c3c9c6', navy: '#1b3a6b', teal: '#1f8f86', olive: '#7c7a2e',
  maroon: '#8a2b2b', lime: '#5bbf46', aqua: '#39c2d0', fuchsia: '#d63ac0', none: 'none'
};
function pikColor(tok) {
  if (!tok) return '';
  var t = String(tok).trim();
  if (/^0x[0-9a-fA-F]{6}$/.test(t)) return '#' + t.slice(2);
  if (/^0x[0-9a-fA-F]{3}$/.test(t)) return '#' + t.slice(2);
  if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return t;
  var k = t.toLowerCase();
  return PIK_COLORS[k] !== undefined ? PIK_COLORS[k] : '';
}
// Tokenise one statement: strings, numbers+unit, 0xhex, <->/->/<-, ., ( ) , + - identifiers.
function pikTokenize(s) {
  var toks = [], i = 0, n = s.length;
  while (i < n) {
    var c = s.charAt(i);
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '"') {
      var j = i + 1, str = '';
      while (j < n) { var d = s.charAt(j); if (d === '\\' && j + 1 < n) { str += s.charAt(j + 1); j += 2; continue; } if (d === '"') break; str += d; j++; }
      toks.push({ t: 'str', v: str }); i = j + 1; continue;
    }
    if (c === '<' && s.substr(i, 3) === '<->') { toks.push({ t: 'op', v: '<->' }); i += 3; continue; }
    if (c === '-' && s.charAt(i + 1) === '>') { toks.push({ t: 'op', v: '->' }); i += 2; continue; }
    if (c === '<' && s.charAt(i + 1) === '-') { toks.push({ t: 'op', v: '<-' }); i += 2; continue; }
    if (c === '(' || c === ')' || c === ',' || c === '.' || c === '+' || c === '*' || c === '/' || c === ':') { toks.push({ t: 'p', v: c }); i++; continue; }
    if (c === '-') { toks.push({ t: 'p', v: '-' }); i++; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s.charAt(i + 1)))) {
      var m = /^0x[0-9a-fA-F]+|^\d*\.?\d+(?:e-?\d+)?(?:%|px|pt|in|cm|mm)?/.exec(s.slice(i));
      if (m) { toks.push({ t: 'num', v: m[0] }); i += m[0].length; continue; }
    }
    var im = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
    if (im) { toks.push({ t: 'id', v: im[0] }); i += im[0].length; continue; }
    i++; // skip anything else
  }
  return toks;
}
function pikScalar(v, U, defInch) {
  // → { inch } or { pct } (percent of a caller-supplied default)
  var m = /^(-?\d*\.?\d+)(%|px|pt|in|cm|mm)?$/.exec(v);
  if (!m) return null;
  var x = parseFloat(m[1]), u = m[2];
  if (u === '%') return { pct: x / 100 };
  if (u === 'px') return { inch: x / U };
  if (u === 'pt') return { inch: x / 72 };
  if (u === 'cm') return { inch: x / 2.54 };
  if (u === 'mm') return { inch: x / 25.4 };
  return { inch: x };
}
var PIK_OBJ = { box: 1, circle: 1, ellipse: 1, oval: 1, cylinder: 1, file: 1, dot: 1, line: 1, arrow: 1, spline: 1, arc: 1, move: 1, text: 1 };
var PIK_SHAPE = { box: 'box', circle: 'circle', ellipse: 'ellipse', oval: 'pill', cylinder: 'cylinder', file: 'file', text: 'text' };
var PIK_DIR = { right: 1, left: 1, up: 1, down: 1 };
function pikDirUnit(d) { return d === 'right' ? { x: 1, y: 0 } : d === 'left' ? { x: -1, y: 0 } : d === 'up' ? { x: 0, y: 1 } : { x: 0, y: -1 }; }

function parsePikchr(text, labelPx) {
  var U = PIK_U;
  labelPx = labelPx > 0 ? labelPx : 15;
  var objs = [], named = {}, warns = [];
  var dir = 'right', cur = { x: 0, y: 0 };
  var lastByType = {};
  var vars = {
    boxwid: 0.75, boxht: 0.5, circlerad: 0.25, ellipsewid: 0.75, ellipseht: 0.5,
    ovalwid: 1.0, ovalht: 0.5, cylwid: 0.75, cylht: 0.5, filewid: 0.75, fileht: 0.75,
    linewid: 0.5, lineht: 0.5, movewid: 0.5, dotrad: 0.06, textwid: 0.5, textht: 0.3
  };
  function warn(msg) { if (warns.length < 40) warns.push(msg); }

  // Split into statements: strip comments, honour \ continuation, split on ; and \n.
  var raw = String(text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/\/\*[\s\S]*?\*\//g, ' ');
  var lines = raw.split('\n'), joined = [];
  for (var li = 0; li < lines.length; li++) {
    var ln = lines[li];
    // strip line comments (# or //) outside strings
    ln = stripLineComment(ln);
    while (/\\\s*$/.test(ln) && li + 1 < lines.length) { ln = ln.replace(/\\\s*$/, ' ') + stripLineComment(lines[++li]); }
    ln.split(';').forEach(function (part) { if (trim(part)) joined.push(trim(part)); });
  }

  function bbox(o) {
    if (o._kind === 'closed') return { x0: o.cx - o.w / 2, x1: o.cx + o.w / 2, y0: o.cy - o.h / 2, y1: o.cy + o.h / 2 };
    var xs = o.pts.map(function (p) { return p.x; }), ys = o.pts.map(function (p) { return p.y; });
    return { x0: Math.min.apply(0, xs), x1: Math.max.apply(0, xs), y0: Math.min.apply(0, ys), y1: Math.max.apply(0, ys) };
  }
  function compass(o, name) {
    if (o._kind === 'closed') {
      var hw = o.w / 2, hh = o.h / 2, cx = o.cx, cy = o.cy;
      switch (name) {
        case 'n': case 't': case 'top': return { x: cx, y: cy + hh };
        case 's': case 'b': case 'bot': case 'bottom': return { x: cx, y: cy - hh };
        case 'e': case 'right': return { x: cx + hw, y: cy };
        case 'w': case 'left': return { x: cx - hw, y: cy };
        case 'ne': return { x: cx + hw, y: cy + hh };
        case 'nw': return { x: cx - hw, y: cy + hh };
        case 'se': return { x: cx + hw, y: cy - hh };
        case 'sw': return { x: cx - hw, y: cy - hh };
      }
      return { x: cx, y: cy };
    }
    var b = bbox(o), mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
    switch (name) {
      case 'start': return o.pts[0];
      case 'end': return o.pts[o.pts.length - 1];
      case 'n': case 't': case 'top': return { x: mx, y: b.y1 };
      case 's': case 'b': case 'bot': case 'bottom': return { x: mx, y: b.y0 };
      case 'e': case 'right': return { x: b.x1, y: my };
      case 'w': case 'left': return { x: b.x0, y: my };
      case 'ne': return { x: b.x1, y: b.y1 };
      case 'nw': return { x: b.x0, y: b.y1 };
      case 'se': return { x: b.x1, y: b.y0 };
      case 'sw': return { x: b.x0, y: b.y0 };
    }
    return { x: mx, y: my };
  }
  // Chop a segment endpoint back to an object's border, aimed at `toward`.
  function chopBorder(o, toward) {
    if (o._kind !== 'closed') return { x: o.cx, y: o.cy };
    var a = { cx: o.cx, cy: o.cy, hw: o.w / 2, hh: o.h / 2, shape: o.shape };
    // reuse the screen-space math in inch space (sign of y is irrelevant to |.|)
    return borderPoint(a, toward.x, toward.y);
  }

  // Resolve an object reference starting at token i → { obj, next } or null.
  function refAt(tk, i) {
    var ord = null; // 1-based from front, or negative from back
    function typeMatch(o, ty) { return !ty || o.type === ty; }
    if (tk[i] && tk[i].t === 'id') {
      var w = tk[i].v.toLowerCase();
      if (w === 'previous' || (w === 'last' && !(tk[i + 1] && tk[i + 1].t === 'id' && PIK_OBJ[tk[i + 1].v.toLowerCase()]))) { return objs.length ? { obj: objs[objs.length - 1], next: i + 1 } : null; }
      if (w === 'last') { ord = -1; i++; }
      else if (w === 'first') { ord = 1; i++; }
      else {
        var om = /^(\d+)(st|nd|rd|th)$/.exec(w);
        if (om) { ord = parseInt(om[1], 10); i++; if (tk[i] && tk[i].t === 'id' && tk[i].v.toLowerCase() === 'last') { ord = -ord; i++; } }
      }
      if (ord !== null) {
        var ty = (tk[i] && tk[i].t === 'id' && PIK_OBJ[tk[i].v.toLowerCase()]) ? tk[i].v.toLowerCase() : null;
        if (ty) i++;
        var pool = objs.filter(function (o) { return typeMatch(o, ty); });
        var pick = ord < 0 ? pool[pool.length + ord] : pool[ord - 1];
        return pick ? { obj: pick, next: i } : null;
      }
      // named object (capitalised handle)
      if (named[tk[i].v]) return { obj: named[tk[i].v], next: i + 1 };
    }
    return null;
  }
  // Parse a position expression at token i → { pos:{x,y,obj?}, next } or null.
  function posAt(tk, i) {
    var base = null;
    if (tk[i] && tk[i].t === 'p' && tk[i].v === '(') {
      var sx = scalarAt(tk, i + 1); if (!sx) return null;
      var j = sx.next; if (!(tk[j] && tk[j].v === ',')) return null;
      var sy = scalarAt(tk, j + 1); if (!sy) return null;
      j = sy.next; if (tk[j] && tk[j].v === ')') j++;
      base = { x: sx.val, y: sy.val }; i = j;
    } else {
      var r = refAt(tk, i);
      if (!r) return null;
      i = r.next;
      if (tk[i] && tk[i].t === 'p' && tk[i].v === '.' && tk[i + 1] && tk[i + 1].t === 'id') {
        var cp = compass(r.obj, tk[i + 1].v.toLowerCase()); base = { x: cp.x, y: cp.y }; i += 2;
      } else { base = { x: r.obj.cx, y: r.obj.cy, obj: r.obj }; }
    }
    // optional ± (dx,dy) offsets
    while (tk[i] && tk[i].t === 'p' && (tk[i].v === '+' || tk[i].v === '-') && tk[i + 1] && tk[i + 1].v === '(') {
      var sign = tk[i].v === '-' ? -1 : 1;
      var dx = scalarAt(tk, i + 2); if (!dx) break; var k = dx.next; if (!(tk[k] && tk[k].v === ',')) break;
      var dy = scalarAt(tk, k + 1); if (!dy) break; k = dy.next; if (tk[k] && tk[k].v === ')') k++;
      base.x += sign * dx.val; base.y += sign * dy.val; base.obj = null; i = k;
    }
    return { pos: base, next: i };
  }
  // A scalar (inches) - a number, or an object's .x/.y coordinate.
  function scalarAt(tk, i) {
    if (tk[i] && tk[i].t === 'num') { var s = pikScalar(tk[i].v, U, 0); if (s && s.inch !== undefined) return { val: s.inch, next: i + 1 }; if (s && s.pct !== undefined) return { val: s.pct, next: i + 1 }; }
    if (tk[i] && tk[i].t === 'p' && tk[i].v === '-' && tk[i + 1] && tk[i + 1].t === 'num') { var s2 = pikScalar(tk[i + 1].v, U, 0); if (s2 && s2.inch !== undefined) return { val: -s2.inch, next: i + 2 }; }
    var r = refAt(tk, i);
    if (r && tk[r.next] && tk[r.next].v === '.' && tk[r.next + 1] && /^[xy]$/i.test(tk[r.next + 1].v)) {
      var ax = tk[r.next + 1].v.toLowerCase(); return { val: ax === 'x' ? r.obj.cx : r.obj.cy, next: r.next + 2 };
    }
    return null;
  }

  joined.forEach(function (stmt) {
    // Sub-blocks [ … ] and their positioned form  Name: [ … ]  aren't supported - skip
    // the whole statement rather than mis-parsing the first object inside it.
    if (/^\s*(?:[A-Za-z_][A-Za-z0-9_]*\s*:\s*)?\[/.test(stmt) || /^\s*\]/.test(stmt)) { warn('skipped [block]'); return; }
    var tk = pikTokenize(stmt);
    if (!tk.length) return;
    var name = null, i = 0;
    // Label prefix  Name:
    if (tk[0].t === 'id' && tk[1] && tk[1].t === 'p' && tk[1].v === ':') { name = tk[0].v; i = 2; if (!tk[i]) return; }
    // Assignment  var = number  (only known layout vars affect anything). '=' isn't
    // tokenised as its own op, so detect it on the raw statement text.
    if (/^\s*[A-Za-z_][A-Za-z0-9_]*\s*(=|\+=|\*=|-=)/.test(stmt) && !(tk[1] && tk[1].v === ':')) {
      var am = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(=|\+=|\*=|-=)\s*([0-9][0-9.]*(?:%|px|pt|in|cm|mm)?)/.exec(stmt);
      if (am && vars[am[1]] !== undefined) { var sc = pikScalar(am[3], U, 0); if (sc && sc.inch !== undefined) vars[am[1]] = am[2] === '=' ? sc.inch : am[2] === '+=' ? vars[am[1]] + sc.inch : am[2] === '-=' ? vars[am[1]] - sc.inch : vars[am[1]] * sc.inch; }
      return;
    }
    var head = tk[i].t === 'id' ? tk[i].v.toLowerCase() : (tk[i].t === 'str' ? 'text' : null);
    // bare direction statement
    if (head && PIK_DIR[head] && !PIK_OBJ[head] && (!tk[i + 1] || tk[i + 1].t === 'num')) { dir = head; return; }
    if (head === 'define' || head === 'print' || head === 'assert') { warn('skipped: ' + head); return; }
    if (tk[i].t === 'p' && tk[i].v === '[') { warn('skipped [block]'); return; }
    if (!head || (!PIK_OBJ[head] && tk[i].t === 'id')) {
      // maybe a bare direction with attributes, else unknown → skip
      if (head && PIK_DIR[head]) { dir = head; return; }
      warn('skipped: ' + stmt.slice(0, 40)); return;
    }

    var isStr = tk[i].t === 'str';
    var type = isStr ? 'text' : head;
    if (!isStr) i++;
    var open = (type === 'line' || type === 'arrow' || type === 'spline' || type === 'arc' || type === 'move');

    // shared attribute state
    var labels = [], fill = '', stroke = '', sw = 0, dashed = false, dotted = false, invis = false;
    var explicitW = null, explicitH = null, radv = null, sameType = false, fit = false;
    var headStart = (type === 'line' || type === 'spline' || type === 'arc') ? false : false;
    var headEnd = (type === 'arrow') ? true : false;
    var ops = [], fromPos = null, atPos = null, withCmp = null, withAt = null, chop = false, refFail = false;

    while (i < tk.length) {
      var T = tk[i];
      if (T.t === 'str') { labels.push(T.v); i++; continue; }
      if (T.t === 'op') { if (T.v === '->') headEnd = true; else if (T.v === '<-') headStart = true; else if (T.v === '<->') { headStart = true; headEnd = true; } i++; continue; }
      var kw = T.t === 'id' ? T.v.toLowerCase() : null;
      if (kw && PIK_DIR[kw]) {
        dir = kw;
        if (open) { var seg = { dir: kw, len: null }; if (tk[i + 1] && tk[i + 1].t === 'num') { seg.raw = tk[i + 1].v; i++; } ops.push(seg); }
        i++; continue;
      }
      if (kw === 'fill') { i++; if (tk[i]) { fill = pikColor(tk[i].t === 'id' ? tk[i].v : tk[i].v); i++; } continue; }
      if (kw === 'color') { i++; if (tk[i]) { stroke = pikColor(tk[i].t === 'id' ? tk[i].v : tk[i].v); i++; } continue; }
      if (kw === 'dashed') { dashed = true; i++; if (tk[i] && tk[i].t === 'num') i++; continue; }
      if (kw === 'dotted') { dotted = true; i++; if (tk[i] && tk[i].t === 'num') i++; continue; }
      if (kw === 'solid') { dashed = dotted = false; i++; continue; }
      if (kw === 'thick') { sw = Math.max(sw, 2.6); i++; continue; }
      if (kw === 'thin') { sw = 1; i++; continue; }
      if (kw === 'thickness') { i++; if (tk[i] && tk[i].t === 'num') { var tv = pikScalar(tk[i].v, U, 0); if (tv && tv.inch !== undefined) sw = tv.inch * U; i++; } continue; }
      if (kw === 'invis' || kw === 'invisible') { invis = true; i++; continue; }
      if (kw === 'wid' || kw === 'width') { i++; var wv = tk[i] && tk[i].t === 'num' ? pikScalar(tk[i].v, U, 0) : null; if (wv && wv.inch !== undefined) explicitW = wv.inch; if (tk[i] && tk[i].t === 'num') i++; continue; }
      if (kw === 'ht' || kw === 'height') { i++; var hv = tk[i] && tk[i].t === 'num' ? pikScalar(tk[i].v, U, 0) : null; if (hv && hv.inch !== undefined) explicitH = hv.inch; if (tk[i] && tk[i].t === 'num') i++; continue; }
      if (kw === 'rad' || kw === 'radius') { i++; var rv = tk[i] && tk[i].t === 'num' ? pikScalar(tk[i].v, U, 0) : null; if (rv && rv.inch !== undefined) radv = rv.inch; if (tk[i] && tk[i].t === 'num') i++; continue; }
      if (kw === 'diameter') { i++; var dv = tk[i] && tk[i].t === 'num' ? pikScalar(tk[i].v, U, 0) : null; if (dv && dv.inch !== undefined) { explicitW = dv.inch; explicitH = dv.inch; } if (tk[i] && tk[i].t === 'num') i++; continue; }
      if (kw === 'same') { sameType = true; i++; if (tk[i] && tk[i].t === 'id' && tk[i].v.toLowerCase() === 'as') { i++; var rr = refAt(tk, i); if (rr) { i = rr.next; explicitW = rr.obj.w; explicitH = rr.obj.h; } } continue; }
      if (kw === 'fit') { fit = true; i++; continue; }
      if (kw === 'chop') { chop = true; i++; if (tk[i] && tk[i].t === 'num') i++; continue; }
      if (kw === 'from') { i++; var pf = posAt(tk, i); if (pf) { fromPos = pf.pos; i = pf.next; } else { refFail = true; warn('unresolved "from" in: ' + stmt.slice(0, 40)); } continue; }
      if (kw === 'to') { i++; var pt = posAt(tk, i); if (pt) { ops.push({ to: pt.pos }); i = pt.next; } else { refFail = true; warn('unresolved "to" in: ' + stmt.slice(0, 40)); } continue; }
      if (kw === 'at') { i++; var pa = posAt(tk, i); if (pa) { atPos = pa.pos; i = pa.next; } else { refFail = true; warn('unresolved "at" in: ' + stmt.slice(0, 40)); } continue; }
      if (kw === 'then') { i++; continue; }
      if (kw === 'go') { i++; continue; }
      if (kw === 'with') {
        i++; var cmp = null;
        if (tk[i] && tk[i].t === 'p' && tk[i].v === '.') { i++; }
        if (tk[i] && tk[i].t === 'id' && /^(n|s|e|w|ne|nw|se|sw|c|center|top|bottom|left|right)$/i.test(tk[i].v)) { cmp = tk[i].v.toLowerCase(); i++; }
        if (tk[i] && tk[i].t === 'id' && tk[i].v.toLowerCase() === 'at') { i++; var pw = posAt(tk, i); if (pw) { withCmp = cmp || 'c'; withAt = pw.pos; i = pw.next; } }
        continue;
      }
      // font/label-placement words we accept-and-ignore
      if (kw && /^(big|small|bold|italic|aligned|above|below|ljust|rjust|cw|ccw|mono|monospace)$/.test(kw)) { i++; continue; }
      if (kw === 'arrow') { headEnd = true; i++; continue; }
      i++; // unknown token - skip
    }

    // ── build the object ─────────────────────────────────────────────
    if (open) {
      var start = fromPos ? { x: fromPos.x, y: fromPos.y, obj: fromPos.obj } : { x: cur.x, y: cur.y };
      var pts = [{ x: start.x, y: start.y }];
      var startObj = fromPos && fromPos.obj ? fromPos.obj : null, endObj = null;
      var defLen = type === 'move' ? vars.movewid : vars.linewid;
      if (!ops.length) ops.push({ dir: dir, len: null });
      ops.forEach(function (op) {
        if (op.to) { pts.push({ x: op.to.x, y: op.to.y }); endObj = op.to.obj || null; if (op.to.obj) endObj = op.to.obj; return; }
        var u = pikDirUnit(op.dir), len = defLen;
        if (op.raw != null) { var sv = pikScalar(op.raw, U, 0); if (sv) len = sv.pct !== undefined ? sv.pct * defLen : sv.inch; }
        var last = pts[pts.length - 1];
        pts.push({ x: last.x + u.x * len, y: last.y + u.y * len });
        endObj = null;
      });
      // chop endpoints to referenced object borders
      if (startObj && pts.length > 1) { var b0 = chopBorder(startObj, pts[1]); pts[0] = b0; }
      if (endObj && pts.length > 1) { var bn = chopBorder(endObj, pts[pts.length - 2]); pts[pts.length - 1] = bn; }
      var o = {
        _kind: 'open', type: type, pts: pts, headStart: headStart, headEnd: headEnd,
        color: stroke, sw: sw, dashed: dashed, dotted: dotted, invis: invis || type === 'move' || refFail,
        labels: labels, isMove: type === 'move'
      };
      objs.push(o); if (name) named[name] = o; lastByType[type] = o;
      cur = { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
      return;
    }

    // closed / text object
    var dw, dh;
    if (type === 'circle') { var r = radv != null ? radv : vars.circlerad; dw = dh = 2 * r; }
    else if (type === 'dot') { var dr = radv != null ? radv : vars.dotrad; dw = dh = 2 * dr; }
    else if (type === 'ellipse') { dw = vars.ellipsewid; dh = vars.ellipseht; }
    else if (type === 'oval') { dw = vars.ovalwid; dh = vars.ovalht; }
    else if (type === 'cylinder') { dw = vars.cylwid; dh = vars.cylht; }
    else if (type === 'file') { dw = vars.filewid; dh = vars.fileht; }
    else if (type === 'text') { dw = vars.textwid; dh = vars.textht; }
    else { dw = vars.boxwid; dh = vars.boxht; }
    if (sameType && lastByType[type]) { dw = lastByType[type].w; dh = lastByType[type].h; }
    // auto-fit width/height to the label text at its real display size (grow-only;
    // explicit wid/ht stay exact). Round shapes get extra room for their inset text box.
    var labelText = labels.join(' '), nLines = Math.max(1, labels.length);
    var longest = labels.reduce(function (a, b) { return b.length > a.length ? b : a; }, '');
    var fw = type === 'circle' ? 1.42 : type === 'ellipse' ? 1.18 : type === 'oval' ? 1.12 : 1;
    var fh = type === 'circle' ? 1.42 : type === 'cylinder' ? 1.7 : type === 'file' ? 1.12 : 1;
    if (explicitW != null) dw = explicitW;
    else if (labelText && type !== 'dot') {
      var need = fw * (textWidth(longest, labelPx) + labelPx * 2.2) / U;
      if (fit || need > dw) dw = Math.max(dw, need);
    }
    if (explicitH != null) dh = explicitH;
    else if (type !== 'dot') {
      var needH = fh * (nLines * labelPx * 1.5 + labelPx * 1.4) / U;
      if (fit || (labelText && needH > dh)) dh = Math.max(dh, needH);
    }

    var o2 = {
      _kind: 'closed', type: type, shape: PIK_SHAPE[type] || 'box', w: dw, h: dh,
      labels: labels, fill: type === 'dot' ? (stroke || '#0c322c') : fill, stroke: stroke,
      sw: sw, dashed: dashed, dotted: dotted, invis: invis, rad: radv, cx: 0, cy: 0
    };
    // position
    if (atPos) { o2.cx = atPos.x; o2.cy = atPos.y; }
    else if (withAt) { var cp2 = compass(o2, withCmp); /* o2 not placed yet; compute offset from center */ var off = compassOffset(withCmp, dw, dh); o2.cx = withAt.x - off.x; o2.cy = withAt.y - off.y; }
    else {
      var u2 = pikDirUnit(dir), half = (dir === 'right' || dir === 'left') ? dw / 2 : dh / 2;
      o2.cx = cur.x + u2.x * half; o2.cy = cur.y + u2.y * half;
    }
    // advance cursor to the exit side
    var u3 = pikDirUnit(dir), half2 = (dir === 'right' || dir === 'left') ? dw / 2 : dh / 2;
    cur = { x: o2.cx + u3.x * half2, y: o2.cy + u3.y * half2 };
    objs.push(o2); if (name) named[name] = o2; lastByType[type] = o2;
  });

  // ── finalise: inch/y-up → screen px/y-down; split into nodes + primitives ─────
  function X(x) { return x * U; }
  function Y(y) { return -y * U; }
  var nodes = [], pos = [], prims = [], maxLines = 1;
  objs.forEach(function (o) {
    if (o._kind === 'closed') {
      if (o.type === 'dot') { prims.push({ kind: 'dot', x: X(o.cx), y: Y(o.cy), r: Math.max(2.5, o.w / 2 * U), color: o.fill }); return; }
      if (o.invis) return;
      var w = o.w * U, h = o.h * U;
      // All strings are equal-weight lines (PIC has no title/subtitle) - join them and
      // let the card wrap; width was fit to the longest string so breaks land per-line.
      maxLines = Math.max(maxLines, o.labels.length || 1);
      nodes.push({ shape: o.shape, nodeId: '', label: o.labels.join(' '), detail: '', image: '', fill: o.fill && o.fill !== 'none' ? o.fill : '', parent: '', layer: '', quadrant: '', stroke: o.stroke, strokeWidth: o.sw });
      pos.push({ x: X(o.cx) - w / 2, y: Y(o.cy) - h / 2, w: w, h: h });
    } else {
      if (o.isMove) return;
      var scr = o.pts.map(function (p) { return { x: X(p.x), y: Y(p.y) }; });
      prims.push({
        kind: 'line', pts: scr, style: o.dotted ? 'dotted' : o.dashed ? 'dashed' : 'solid',
        headStart: o.headStart, headEnd: o.headEnd, color: o.color, width: o.sw,
        labels: o.labels, invis: o.invis
      });
    }
  });
  return { nodes: nodes, pos: pos, prims: prims, warns: warns, maxLines: maxLines };
}
// offset of a compass point from a box centre (inches, y-up)
function compassOffset(name, w, h) {
  var hw = w / 2, hh = h / 2;
  switch (name) {
    case 'n': case 'top': return { x: 0, y: hh };
    case 's': case 'bottom': return { x: 0, y: -hh };
    case 'e': case 'right': return { x: hw, y: 0 };
    case 'w': case 'left': return { x: -hw, y: 0 };
    case 'ne': return { x: hw, y: hh };
    case 'nw': return { x: -hw, y: hh };
    case 'se': return { x: hw, y: -hh };
    case 'sw': return { x: -hw, y: -hh };
  }
  return { x: 0, y: 0 };
}
function stripLineComment(s) {
  var out = '', inStr = false;
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (c === '"' && s.charAt(i - 1) !== '\\') inStr = !inStr;
    if (!inStr && (c === '#' || (c === '/' && s.charAt(i + 1) === '/'))) break;
    out += c;
  }
  return out;
}
// Render Pikchr open primitives (lines/arrows/dots) as export-safe geometry.
function renderPikchrPrims(prims, S, bg, bb) {
  var out = '';
  arr(prims).forEach(function (p) {
    if (p.kind === 'dot') { out += '<path d="' + circlePath(p.x, p.y, p.r) + '" fill="' + esc(p.color || S.edgeColor) + '"/>'; bb.add(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2); return; }
    var pts = p.pts; if (!pts || pts.length < 2) return;
    var col = color(p.color, S.edgeColor);
    var w = p.width > 0 ? p.width : (S.arrowWidth || 2);
    var s = Math.max(S.arrowHeadSize || 11, w * 4);
    var kind = S.arrowHead && S.arrowHead !== 'none' ? S.arrowHead : 'triangle';
    if (kind === 'double') kind = 'triangle';
    if (!p.invis) {
      // shaft: trim the extreme ends so the heads sit cleanly
      for (var k = 0; k < pts.length - 1; k++) {
        var a = pts[k], b = pts[k + 1];
        var ax = a.x, ay = a.y, bx2 = b.x, by2 = b.y;
        var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
        if (k === 0 && p.headStart) { var si = headInset(kind, s); ax = a.x + ux * si; ay = a.y + uy * si; }
        if (k === pts.length - 2 && p.headEnd) { var ei = headInset(kind, s); bx2 = b.x - ux * ei; by2 = b.y - uy * ei; }
        out += shaft(ax, ay, bx2, by2, p.style, col, w);
      }
      var e0 = pts[pts.length - 1], e1 = pts[pts.length - 2];
      if (p.headEnd) { var ed = Math.hypot(e0.x - e1.x, e0.y - e1.y) || 1; out += arrowHead(e0, (e0.x - e1.x) / ed, (e0.y - e1.y) / ed, s, col, kind, w); }
      var s0 = pts[0], s1 = pts[1];
      if (p.headStart) { var sd = Math.hypot(s0.x - s1.x, s0.y - s1.y) || 1; out += arrowHead(s0, (s0.x - s1.x) / sd, (s0.y - s1.y) / sd, s, col, kind, w); }
    }
    pts.forEach(function (pt) { bb.add(pt.x, pt.y, 0, 0); });
    // Labels: plain stacked text sitting just off the midpoint segment (Pikchr-style),
    // NOT a boxed pill - a labelled arrow should still read as an arrow.
    var labs = arr(p.labels).map(trim).filter(Boolean);
    if (labs.length) {
      var half = (pts.length - 1) / 2;
      var m1 = pts[Math.floor(half)], m2 = pts[Math.ceil(half)];
      var mx = (m1.x + m2.x) / 2, my = (m1.y + m2.y) / 2;
      var sx = m2.x - m1.x, sy = m2.y - m1.y, sl = Math.hypot(sx, sy) || 1;
      var horiz = Math.abs(sx) >= Math.abs(sy);
      var fs = Math.max(11, S.labelSize * 0.85), lh = Math.round(fs * 1.25);
      var block = labs.length * lh;
      if (horiz) {
        var ty = my - 7 - block; // above the arrow
        labs.forEach(function (t, k) { out += textEl(mx, ty + k * lh + fs * 0.85, t, fs, 500, col, 'middle'); });
        bb.add(mx - textWidth(labs[0], fs) / 2, ty, textWidth(labs[0], fs), block + 6);
      } else {
        var lx = mx + 9;
        var ty2 = my - block / 2;
        labs.forEach(function (t, k) { out += textEl(lx, ty2 + k * lh + fs * 0.85, t, fs, 500, col, 'start'); });
        bb.add(lx, ty2, textWidth(labs[0], fs) + 6, block);
      }
    }
  });
  return out;
}

// ── compose the whole scene ─────────────────────────────────────────────────────
async function buildDiagram(inp) {
  _notes = [];
  var fonts = await resolvedFonts(); FONT = fonts._fontBrand; FONT_MONO = fonts._fontMono;
  var mode = VALID_TYPES[inp.diagramType] ? inp.diagramType : 'org';
  var source = ['text', 'ascii', 'mermaid', 'dot', 'pikchr', 'table'].indexOf(inp.source) >= 0 ? inp.source : 'visual';
  var bg = color(inp.background, WHITE);

  var src, asciiPos = null, pikchrPos = null, pikchrPrims = null, overrideDir = null;
  if (source === 'text') src = parseDsl(inp.dsl, mode);
  else if (source === 'ascii') { var pa = parseAscii(inp.asciiArt); src = { nodes: pa.nodes, layers: [], arrows: pa.arrows }; asciiPos = pa.pos; }
  else if (source === 'mermaid' || source === 'dot') {
    var pm = source === 'dot' ? parseDot(inp.dot) : parseMermaid(inp.mermaid);
    src = { nodes: pm.nodes, layers: pm.layers, arrows: pm.arrows };
    if (VALID_TYPES[pm.diagramType]) mode = pm.diagramType;
    overrideDir = pm.dir;
    if (pm.warns.length && host && host.log) host.log('info', 'diagram-builder: ' + pm.warns.length + ' ' + source + ' line(s) skipped (unsupported): ' + pm.warns.slice(0, 4).join(' · '));
  }
  else if (source === 'pikchr') {
    var pkLabelPx = clamp(num(inp.labelSize, 15), 10, 28) * clamp(num(inp.cardScale, 1), 0.6, 1.6);
    var pk = parsePikchr(inp.pikchr, pkLabelPx); src = { nodes: pk.nodes, layers: [], arrows: [] }; pikchrPos = pk.pos; pikchrPrims = pk.prims;
    if (pk.warns.length && host && host.log) host.log('info', 'diagram-builder: ' + pk.warns.length + ' Pikchr line(s) skipped (unsupported): ' + pk.warns.slice(0, 4).join(' · '));
  }
  else if (source === 'table') src = parseTable(inp.table, mode);
  else src = { nodes: arr(inp.nodes), layers: arr(inp.layers), arrows: arr(inp.arrows) };

  var nodes = normaliseNodes(src.nodes);
  if (!nodes.length && !(source === 'pikchr' && pikchrPrims && pikchrPrims.length)) return placeholder(mode, source === 'visual' ? null : source);

  // S: colours + sized constants derived from the slider/scale/theme inputs.
  var theme = THEMES[inp.theme] || null;
  var scale = clamp(num(inp.cardScale, 1), 0.6, 1.6);
  var labelSize = clamp(num(inp.labelSize, 15), 10, 28) * scale;
  var S = {
    nodeFill: color(inp.nodeFill, theme ? theme.nodeFill : WHITE),
    nodeStroke: color(inp.nodeStroke, theme ? theme.nodeStroke : PINE),
    nodeText: color(inp.nodeText, theme ? theme.nodeText : PINE),
    edgeColor: color(inp.edgeColor, theme ? theme.edgeColor : PINE),
    detailColor: theme ? theme.detail : DETAIL,
    bandPalette: theme ? theme.bandPalette : BAND_PALETTE,
    scale: scale,
    labelSize: labelSize,
    labelWeight: clamp(num(inp.labelWeight, 500), 100, 900),
    labelLH: Math.round(labelSize * 1.33),
    detailSize: Math.round(labelSize * 0.8),
    detailLH: Math.round(labelSize * 1.07),
    cardPadV: Math.round(12 * scale),
    imgH: Math.round(52 * scale),
    imgGap: Math.round(10 * scale),
    cardBorderWidth: clamp(num(inp.cardBorderWidth, 1.5), 0, 6),
    cornerRadius: clamp(num(inp.cornerRadius, 14), 0, 28),
    connectorWidth: clamp(num(inp.connectorWidth, 1.6), 0.3, 6),
    arrowWidth: clamp(num(inp.arrowWidth, 2), 0.5, 8),
    arrowHeadSize: clamp(num(inp.arrowHeadSize, 11), 6, 28),
    arrowHead: inp.arrowHead || 'triangle',
    arrowStyle: inp.arrowStyle || 'solid',
    cardWidth: clamp(num(inp.cardWidth, 196), 120, 320) * scale,
    rowGap: clamp(num(inp.rowGap, 56), 0, 200),
    siblingGap: clamp(num(inp.siblingGap, 30), 0, 160),
    cardLayout: inp.cardLayout === 'row' ? 'row' : 'stacked',
    cardH: 46, labelLines: 1, imgBand: 0, rowImgSide: 0
  };

  // Images: stacked reserves a uniform band ON TOP of the text; row reserves a
  // square avatar column to the LEFT. Only one is non-zero. Embed + measure below.
  var anyImage = nodes.some(function (n) { return n.image; });
  S.imgBand = (S.cardLayout !== 'row' && anyImage) ? (S.imgH + S.imgGap) : 0;
  S.rowImgSide = (S.cardLayout === 'row' && anyImage) ? S.imgH : 0;
  if (anyImage) {
    await Promise.all(nodes.filter(function (n) { return n.image; }).map(function (n) {
      return resolveImage(n.image).then(function (r) { n.image = r.dataUrl; n._imgAspect = r.aspect; }, function () { });
    }));
  }

  var bb = bounds();
  var layout;

  // cardH (uniform) - computed up front from the active reference width; layercake
  // sets its own (per-band widths vary) and ascii preserves the drawn boxes.
  function setCardH(refW) {
    // In row mode an image card's text is only as wide as what's left beside the
    // avatar, so measure each card against its own available width.
    var rowTextW = Math.max(40, refW - S.rowImgSide - S.imgGap);
    S.labelLines = Math.max(1, ...nodes.map(function (n) {
      var w = (S.cardLayout === 'row' && n.image && S.rowImgSide) ? rowTextW : refW;
      return estLineCount(n.label, maxCharsFor(w, S.labelSize));
    }));
    S.detailLines = Math.min(3, Math.max(1, ...nodes.map(function (n) {
      var w = (S.cardLayout === 'row' && n.image && S.rowImgSide) ? rowTextW : refW;
      return estLineCount(n.detail, maxCharsFor(w, S.detailSize));
    })));
    var hd = nodes.some(function (n) { return trim(n.detail); });
    S.cardH = computeCardH(S, S.labelLines, hd);
  }

  if (source === 'pikchr') {
    // positions + connectors come straight from the layout engine (like ascii). PIC
    // centres its labels, so force the stacked (centred) card layout regardless of the
    // Style › Card layout control (which is an image-avatar option for the other modes).
    S.labelLines = Math.min(4, Math.max(2, pk.maxLines || 1));
    S.cardLayout = 'stacked'; S.rowImgSide = 0;
    nodes.forEach(function (n, i) { var p = pikchrPos[i]; if (!p) return; n.x = p.x; n.y = p.y; n.w = p.w; n.h = p.h; });
    layout = { autoEdges: [], bands: [], layerById: {}, front: renderPikchrPrims(pikchrPrims, S, bg, bb) };
  } else if (source === 'ascii') {
    S.labelLines = 3;
    setCardH(S.cardWidth);
    nodes.forEach(function (n, i) {
      var p = asciiPos[i]; if (!p) return;
      n.x = p.x; n.y = p.y; n.w = p.w;
      n.h = n.image ? Math.max(p.h, S.cardPadV * 2 + S.imgBand + S.labelLH) : p.h;
    });
    layout = { autoEdges: [], bands: [], layerById: {} };
  } else if (mode === 'layercake') {
    layout = layoutLayercake(nodes, src.layers, S);
  } else if (mode === 'kanban') {
    setCardH(Math.max(180, S.cardWidth + 40) - 24);
    layout = layoutKanban(nodes, src.layers, S, inp);
  } else if (mode === 'process') {
    setCardH(S.cardWidth);
    layout = layoutProcess(nodes, src.arrows, S, (overrideDir || inp.flowDir) === 'right' ? 'right' : 'down');
  } else if (mode === 'mindmap') {
    setCardH(S.cardWidth);
    layout = layoutMindmap(nodes, S, inp);
  } else if (mode === 'timeline') {
    setCardH(S.cardWidth);
    layout = layoutTimeline(nodes, S, (overrideDir || inp.timelineDir) === 'down' ? 'down' : 'right', bb);
  } else if (mode === 'cycle') {
    setCardH(Math.min(S.cardWidth, 180));
    layout = layoutCycle(nodes, S, inp, bb);
  } else if (mode === 'pyramid') {
    setCardH(S.cardWidth);
    layout = layoutPyramid(nodes, S, inp.pyramidStyle || 'pyramid', bb);
  } else if (mode === 'matrix') {
    setCardH(160);
    layout = layoutMatrix(nodes, S, inp, bb);
  } else if (mode === 'gantt') {
    setCardH(S.cardWidth);
    layout = layoutGantt(nodes, src.layers, S, inp, bb);
  } else {
    setCardH(S.cardWidth);
    layout = layoutOrg(nodes, S, (overrideDir || inp.orgDir) === 'right' ? 'right' : 'down');
  }

  var nodeById = {};
  nodes.forEach(function (n) { if (nodeById[n.id] === undefined) nodeById[n.id] = n; });

  var bandsSvg = '', cardsSvg = '', edgesSvg = '';

  layout.bands.forEach(function (L) {
    bb.add(L.x, L.y, L.w, L.h);
    bandsSvg += '<path d="' + roundedRectPath(L.x, L.y, L.w, L.h, 10) + '" fill="' + esc(L.bandFill) + '"/>';
    var bandInk = inkOn(L.bandFill, S.nodeText);
    if (layout.kanbanHeader) {
      var lbl = L.label + (layout.showCount ? ' (' + L._cards.length + ')' : '');
      var llab = wrapLines(lbl, maxCharsFor(L.w - 20, S.labelSize), 1);
      if (llab.length) bandsSvg += textEl(L.x + L.w / 2, L.y + 24, llab[0], Math.round(S.labelSize * 0.95), 600, bandInk, 'middle');
    } else {
      var gw = (layout.gutter || 168) - 28;
      var llab2 = wrapLines(L.label, maxCharsFor(gw, 15), 1);
      if (llab2.length) bandsSvg += textEl(L.x + 20, L.y + L.h / 2 + 5, llab2[0], 15, 600, bandInk, 'start');
    }
  });

  layout.autoEdges.forEach(function (d) {
    edgesSvg += '<path d="' + d + '" fill="none" stroke="' + esc(S.edgeColor) + '" stroke-width="' + f2(S.connectorWidth) + '"/>';
  });

  nodes.forEach(function (n) {
    if (!n.w || !n.h) { n.w = n.w || S.cardWidth; n.h = n.h || S.cardH; }
    bb.add(n.x, n.y, n.w, n.h);
    if (!layout.skipCards) cardsSvg += renderCard(n, S);
  });

  var arrows = renderArrows(src.arrows, nodeById, layout.layerById, bg, bb, S);
  if (host && host.log) {
    if (arrows.unresolved) host.log('warn', 'diagram-builder: ' + arrows.unresolved + ' arrow(s) skipped - unresolved From/To ID');
    if (arrows.degenerate) host.log('warn', 'diagram-builder: ' + arrows.degenerate + ' arrow(s) skipped - endpoints coincide or one contains the other');
  }

  if (bb.empty()) bb.add(0, 0, 1200, 760);

  var title = trim(inp.title), titleH = title ? 50 : 0;
  var contentMinY = bb.minY, contentCx = bb.minX + (bb.maxX - bb.minX) / 2;
  if (title) { var tw = textWidth(title, 26); bb.add(contentCx - tw / 2, contentMinY, tw, 0); }

  var pad = clamp(num(inp.canvasPadding, 44), 0, 200);
  var vbX = bb.minX - pad, vbY = contentMinY - pad - titleH;
  var vbW = (bb.maxX - bb.minX) + pad * 2, vbH = (bb.maxY - contentMinY) + pad * 2 + titleH;

  // Click-to-focus: a card jumps to whichever input is the active data source;
  // the background and title jump to their own sidebar controls.
  var sourceInput = source === 'text' ? 'dsl' : source === 'ascii' ? 'asciiArt'
                  : source === 'mermaid' ? 'mermaid' : source === 'dot' ? 'dot'
                  : source === 'pikchr' ? 'pikchr' : source === 'table' ? 'table' : 'nodes';
  var out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + f2(vbX) + ' ' + f2(vbY) + ' ' + f2(vbW) + ' ' + f2(vbH) + '"'
    + ' width="' + f2(vbW) + '" height="' + f2(vbH) + '"'
    + ' style="width:100%;height:auto;max-height:100%;display:block;" preserveAspectRatio="xMidYMid meet">';
  if (bg !== 'transparent') out += '<rect x="' + f2(vbX) + '" y="' + f2(vbY) + '" width="' + f2(vbW) + '" height="' + f2(vbH) + '" fill="' + esc(bg) + '" data-canvas-input="background" pointer-events="all"/>';
  out += gridBg(inp.gridBg, vbX, vbY, vbW, vbH, S.nodeStroke);
  out += bandsSvg + (layout.behind || '') + edgesSvg + '<g data-canvas-input="' + sourceInput + '">' + cardsSvg + '</g>' + (layout.front || '') + arrows.svg;
  if (title) out += '<g data-canvas-input="title">' + textEl(contentCx, contentMinY - pad - titleH / 2 + 10, title, 26, 600, theme ? theme.nodeText : PINE, 'middle') + '</g>';
  out += '</svg>';
  return out;
}

// ── literal ASCII-art tracing → raw {nodes, arrows} + drawn positions ─────────────
function parseAscii(text) {
  var rows = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n').slice(0, 240);
  var H = rows.length, W = 0, i;
  for (i = 0; i < H; i++) { if (rows[i].length > W) W = rows[i].length; }
  W = Math.min(W, 400);
  function ch(r, c) { if (r < 0 || r >= H || c < 0) return ' '; var ln = rows[r]; return c < ln.length ? ln.charAt(c) : ' '; }
  function K(r, c) { return r + ',' + c; }

  var boxes = [], owner = {}, r, c, cc, rr;
  for (r = 0; r < H; r++) {
    for (c = 0; c < W; c++) {
      if (ch(r, c) !== '+') continue;
      var c2 = c + 1; while (c2 < W && ch(r, c2) === '-') c2++;
      if (c2 >= W || c2 === c + 1 || ch(r, c2) !== '+') continue;
      var r2 = r + 1; while (r2 < H && ch(r2, c2) === '|') r2++;
      if (r2 >= H || r2 === r + 1 || ch(r2, c2) !== '+' || ch(r2, c) !== '+') continue;
      var ok = true;
      for (cc = c + 1; cc < c2 && ok; cc++) if (ch(r2, cc) !== '-') ok = false;
      for (rr = r + 1; rr < r2 && ok; rr++) if (ch(rr, c) !== '|') ok = false;
      if (!ok) continue;
      var bi = boxes.length;
      boxes.push({ r0: r, c0: c, r1: r2, c1: c2, label: '', detail: '', id: '' });
      for (cc = c; cc <= c2; cc++) { owner[K(r, cc)] = bi; owner[K(r2, cc)] = bi; }
      for (rr = r; rr <= r2; rr++) { owner[K(rr, c)] = bi; owner[K(rr, c2)] = bi; }
    }
  }
  if (!boxes.length) return { nodes: [], arrows: [], pos: [] };

  boxes.forEach(function (b) {
    var lines = [], s, rr2, cc2, im;
    for (rr2 = b.r0 + 1; rr2 < b.r1; rr2++) {
      s = '';
      for (cc2 = b.c0 + 1; cc2 < b.c1; cc2++) s += ch(rr2, cc2);
      s = s.trim();
      if (!s) continue;
      im = s.match(/^@\s*(.+)$/);
      if (im && imageRef(im[1])) { b.image = imageRef(im[1]); continue; }
      lines.push(s);
    }
    b.label = lines[0] || '';
    b.detail = lines.slice(1).join(' ');
  });

  var CW = 11, CH = 26, nodes = [], pos = [], used = {};
  boxes.forEach(function (b, bi) {
    var base = slug(b.label) || ('box-' + (bi + 1)), id = base, k = 2;
    while (used[id]) { id = base + '-' + k; k++; }
    used[id] = 1; b.id = id;
    nodes.push({ shape: 'rounded', nodeId: id, label: b.label, detail: b.detail, image: b.image || '', fill: '', parent: '', layer: '' });
    pos.push({ x: b.c0 * CW, y: b.r0 * CH, w: Math.max(96, (b.c1 - b.c0) * CW), h: Math.max(44, (b.r1 - b.r0) * CH) });
  });

  function isWire(rr3, cc3) { var x = ch(rr3, cc3); return '-|+/\\><^v'.indexOf(x) >= 0 && owner[K(rr3, cc3)] === undefined; }
  function isHead(x) { return x === '>' || x === '<' || x === '^' || x === 'v'; }
  var OFF = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
  var CARD = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  function boxAt(pr, pc) {
    var d, o;
    for (d = 0; d < 8; d++) { o = owner[K(pr + OFF[d][0], pc + OFF[d][1])]; if (o !== undefined) return o; }
    for (d = 0; d < 4; d++) {
      var mr = pr + CARD[d][0], mc = pc + CARD[d][1];
      if (ch(mr, mc) === ' ' && owner[K(mr, mc)] === undefined) { o = owner[K(mr + CARD[d][0], mc + CARD[d][1])]; if (o !== undefined) return o; }
    }
    return undefined;
  }
  var seen = {}, arrows = [], pairSeen = {};
  for (r = 0; r < H; r++) {
    for (c = 0; c < W; c++) {
      if (!isWire(r, c) || seen[K(r, c)]) continue;
      var stack = [[r, c]], comp = [], heads = [];
      while (stack.length) {
        var p = stack.pop(), pr = p[0], pc = p[1];
        if (seen[K(pr, pc)] || !isWire(pr, pc)) continue;
        seen[K(pr, pc)] = 1;
        comp.push(p);
        if (isHead(ch(pr, pc))) heads.push(p);
        for (var d = 0; d < 8; d++) { var nr = pr + OFF[d][0], nc = pc + OFF[d][1]; if (isWire(nr, nc) && !seen[K(nr, nc)]) stack.push([nr, nc]); }
      }
      var touch = {};
      comp.forEach(function (cell) { var o = boxAt(cell[0], cell[1]); if (o !== undefined) touch[o] = 1; });
      var tb = Object.keys(touch).map(Number);
      if (tb.length < 2) continue;
      var fromI = tb[0], toI = tb[1];
      if (heads.length) { var hb = boxAt(heads[heads.length - 1][0], heads[heads.length - 1][1]); if (hb !== undefined) { toI = hb; fromI = (tb[0] === hb ? tb[1] : tb[0]); } }
      if (fromI === toI) continue;
      var pkey = fromI + '>' + toI;
      if (pairSeen[pkey]) continue;
      pairSeen[pkey] = 1;
      arrows.push({ from: nodes[fromI].nodeId, to: nodes[toI].nodeId, label: '', style: 'solid', head: '', width: 0, color: '' });
    }
  }
  return { nodes: nodes, arrows: arrows, pos: pos };
}

// ── preset / theme / density seeding ─────────────────────────────────────────────
// Seeds run ONLY in reaction to the user changing the preset/theme/density select
// (compute is told the changed input id) - never on reload/onInit. So a seed never
// clobbers a manual edit the user made afterwards: re-opening a saved/shared diagram
// renders the persisted values as-is. The preset→theme→density cascade still resolves
// in a single change because each step reads `patch.X || inp.X`.
function resolvePatches(inp, changedId) {
  var patch = {};
  if (changedId === 'diagramPreset' && inp.diagramPreset && inp.diagramPreset !== 'custom') {
    var p = PRESETS[inp.diagramPreset];
    if (p) Object.keys(p).forEach(function (k) { patch[k] = p[k]; });
  }
  if (changedId === 'diagramPreset' || changedId === 'theme') {
    var theme = patch.theme || inp.theme;
    if (theme && theme !== 'custom') {
      var t = THEMES[theme];
      if (t) { patch.nodeFill = t.nodeFill; patch.nodeStroke = t.nodeStroke; patch.nodeText = t.nodeText; patch.edgeColor = t.edgeColor; patch.background = t.background; }
    }
  }
  if (changedId === 'diagramPreset' || changedId === 'density') {
    var density = patch.density || inp.density;
    if (density && density !== 'custom') {
      var d = DENSITY[density];
      if (d) { patch.rowGap = d.rowGap; patch.siblingGap = d.siblingGap; patch.cardScale = d.cardScale; }
    }
  }
  return patch;
}

// ── lifecycle ────────────────────────────────────────────────────────────────────
async function compute(model, changedId) {
  await ensureBrandThemes();
  var inp = inputsFrom(model);
  var patch = (changedId === 'diagramPreset' || changedId === 'theme' || changedId === 'density') ? resolvePatches(inp, changedId) : {};
  Object.keys(patch).forEach(function (k) { inp[k] = patch[k]; });
  var svg;
  try { svg = await buildDiagram(inp); }
  catch (e) {
    if (host && host.log) host.log('warn', 'diagram-builder: build failed', { error: String(e) });
    svg = errPlaceholder('Could not build this diagram.');
  }
  // Always present, so a cleared warning clears the extra instead of going stale.
  var warning = _notes.join(' · ');
  if (warning && host && host.log) host.log('warn', 'diagram-builder: ' + warning);
  return Object.assign({ diagramSvg: svg, ganttWarning: warning }, patch);
}

function onInit(ctx) { return compute(ctx.model, null); }
function onInput(ctx) { return compute(ctx.model, ctx.id); }

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
