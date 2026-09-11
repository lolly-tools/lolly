/* global host */
/**
 * Work Avatar hooks.
 *
 * A round headshot, an optional photo treatment and a ring of text: the campaign
 * badge a comms team used to ship as a slide deck (paste your photo on slide 5,
 * copy an overlay from slide 6, download as PNG), as one tool with ordinary
 * sidebar inputs, in whatever brand is active.
 *
 * What the hook computes, and why each part is a hook at all:
 *
 *   - The ring is a fan of annular sectors, one <path> each, coloured along the
 *     arc. SVG has no conic gradient and a CSS one would not survive export, so
 *     the gradient is sampled per sector - plain fills that every export path
 *     (SVG, PDF, the CLI's headless render) draws as vectors. An open ring's
 *     ends fade through a luminance <mask> holding one <linearGradient> per end:
 *     a smooth feather, where per-sector opacity steps banded visibly. The ring
 *     and the text are SEPARATE inline <svg> layers so the PDF walker, which
 *     rasterises an svg carrying a mask, still draws the glyphs as vectors.
 *   - The text is shaped by host.text.toPath (HarfBuzz) with `clusters: true`, and
 *     each cluster is stood on the ring by arc length - real outlines in the brand
 *     face, kerning intact, so the export needs no font installed. The placement
 *     maths is the shared `textOnPath` region (community/_shared/textpath.js),
 *     which the design tool's text-on-path (plans/185) is meant to reuse.
 *   - A ♥ is drawn rather than shaped: the brand face usually has no U+2665, and
 *     a tofu box in "#I ♥ OPEN SOURCE" is not a badge.
 *   - Where host.text is missing, or the face lacks a glyph, the text falls back
 *     to a live SVG <textPath> in the brand family and `waWarning` says so, the
 *     wordmark tool's posture: never silently export blanks.
 *   - The photo treatment is a CSS filter on the <img> (plus an in-document SVG
 *     <filter> for the duotone and wash). The export walker bakes an image's CSS
 *     filter through the canvas, so a treatment survives SVG/PDF as pixels that
 *     match the screen.
 *
 * The hook never throws: every path returns a patch, and a failure surfaces as
 * the `waWarning` extra the template prints (hidden from exports).
 */

// === lolly:shared esc - generated from community/_shared/text.js; edit there and run npm run sync:shared ===
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// === /lolly:shared esc ===
// === lolly:shared clamp - generated from community/_shared/math.js; edit there and run npm run sync:shared ===
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
// === /lolly:shared clamp ===
// === lolly:shared safeColor - generated from community/_shared/math.js; edit there and run npm run sync:shared ===
function safeColor(v, fallback) {
  var s = String(v == null ? '' : v).trim();
  if (!s) return fallback;
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^(rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/i.test(s)) return s;
  if (/^[a-zA-Z]+$/.test(s)) return s; // named colour (e.g. "transparent", "tomato")
  // A brand-token CSS var with an OPTIONAL literal-colour fallback - the documented
  // brand-inheritance path (brand-vars.ts injects --brand-primary/… onto the canvas root,
  // so a template can carry var(--brand-primary, #hex)). Strict on purpose: a var name and
  // at most one hex / named / rgb / hsl fallback, so nothing (no ; " ' < > { } or a nested
  // function) can break out of the style="…" property this value is interpolated into.
  if (/^var\(\s*--[a-zA-Z0-9-]+\s*(,\s*(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|(?:rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)))?\s*\)$/.test(s)) return s;
  return fallback;
}
// === /lolly:shared safeColor ===
// === lolly:shared textOnPath - generated from community/_shared/textpath.js; edit there and run npm run sync:shared ===
// A sampler maps an arc length s (px along the path, in READING order) to the
// point and heading there: { x, y, rot }, rot in SVG degrees (clockwise positive
// in the y-down plane - what a `rotate()` transform takes).
//
// arcSampler: a circle of radius r about (cx, cy). Angles are clock degrees -
// 0 at the top, clockwise positive. `startDeg` is where reading begins and `dir`
// which way it proceeds: -1 counter-clockwise, which is how text reads left to
// right along the BOTTOM of a ring (glyph tops toward the centre); +1 clockwise,
// which reads along the TOP (tops facing out). The heading follows from the
// tangent of that motion, so an inside run comes out upright and an outside run
// too - the same rule SVG's textPath applies to the path's own direction.
function arcSampler(cx, cy, r, startDeg, dir) {
  var rad = Math.PI / 180;
  return function (s) {
    var a = startDeg + dir * (s / r) / rad;
    return {
      x: cx + r * Math.sin(a * rad),
      y: cy - r * Math.cos(a * rad),
      rot: dir < 0 ? a + 180 : a,
    };
  };
}

// Place shaped clusters ({ d, x, advance }, x and advance in px from the run's
// origin, d with the baseline at y=0) along a sampler, the run's origin sitting
// at arc length s0. Each cluster stands at its own centre, so a run bends per
// letter rather than per word. Returns one record per cluster:
//   { d, pre, x, y, rot, dx } - draw as
//   <path d="{d}" transform="translate(x y) rotate(rot) translate(dx 0) {pre}"/>
// dx is the shift that puts the cluster's centre at the origin before rotating;
// `pre` is an optional innermost transform a synthetic cluster (a drawn glyph in
// its own coordinates) carries through untouched.
function placeOnPath(clusters, sampler, s0) {
  var out = [];
  for (var i = 0; i < clusters.length; i++) {
    var c = clusters[i];
    var mid = c.x + c.advance / 2;
    var p = sampler(s0 + mid);
    out.push({ d: c.d, pre: c.pre || '', x: p.x, y: p.y, rot: p.rot, dx: -mid });
  }
  return out;
}
// === /lolly:shared textOnPath ===

// The platform faces - every shell can resolve them (web: font-registry's
// PLATFORM_FACES; CLI/TUI: the node shell scans shells/web/public/fonts).
var FALLBACK_FAMILY = 'SUSE';
var FALLBACK_MONO = 'SUSE Mono';

// The ring's own coordinate system: a 1000-unit square, so the photo circle
// (CSS percent of the same square) and the ring (an SVG viewBox) share numbers.
var CX = 500;
var CY = 500;

// Where each ring style begins and how far it runs, in clock degrees (0 at the
// top, clockwise positive). The ring is drawn counter-clockwise from `start`,
// which is also where inside text starts reading - so an open ring's opening
// sits at the top and the text runs down the left and along the bottom, the
// way the slide-deck badges did.
var RINGS = {
  arc: { start: 315, sweep: 270 },
  half: { start: 270, sweep: 180 },
  full: { start: 0, sweep: 360 },
};
var STYLES = ['arc', 'half', 'full', 'none'];
var TREATMENTS = ['none', 'mono', 'duotone', 'tint', 'warm', 'cool', 'pop', 'matte'];
var WEIGHTS = ['400', '500', '600', '700', '800'];
var SIDES = ['inside', 'outside'];
var ANCHORS = ['start', 'middle', 'end'];

// Brand-agnostic fallbacks. A semantic token alias that does not resolve
// flattens to '', so every colour read needs a literal behind it.
var FB_RING = '#243447';
var FB_RING2 = '#4f6d8f';
var FB_TEXT = '#ffffff';
var FB_BG = '#ffffff';
var FB_PHOTO_BG = '#e9ecf0';

// Material's heart, in its 24-unit box. Drawn in place of ♥ ❤ ♡ ❣ ❥ (a trailing
// U+FE0F emoji selector is stripped first) at 82% of the cap height.
var HEART_D = 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
var HEART_BOX = { x: 2, y: 3, w: 20, h: 18.35 };
var HEART_RE = /([♥❤♡❣❥])/;

function num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : d; }
function bool(v, d) { return v == null || v === '' ? d : !(v === false || v === 'false' || v === 0 || v === '0'); }
function pick(v, list, d) { var s = String(v == null ? '' : v); return list.indexOf(s) >= 0 ? s : d; }
function f2(n) { return Math.round(n * 100) / 100; }
function f3(n) { return Math.round(n * 1000) / 1000; }
// 1000-unit → percent of the square, for the photo circle's CSS box.
function pct(v) { return f3(v / 10) + '%'; }
// A point on a circle about the centre, clock degrees, as "x y".
function pt(r, a) {
  var rad = Math.PI / 180;
  return f2(CX + r * Math.sin(a * rad)) + ' ' + f2(CY - r * Math.cos(a * rad));
}
function hashStr(s) {
  var h = 5381;
  for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

// ── colour ────────────────────────────────────────────────────────────────────

function hexRgb(c) {
  var m = /^#([0-9a-fA-F]{3,8})$/.exec(String(c == null ? '' : c).trim());
  if (!m) return null;
  var h = m[1];
  if (h.length === 3 || h.length === 4) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
  if (h.length !== 6 && h.length !== 8) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbHex(rgb) {
  var out = '#';
  for (var i = 0; i < 3; i++) {
    var v = clamp(Math.round(rgb[i]), 0, 255);
    out += (v < 16 ? '0' : '') + v.toString(16);
  }
  return out;
}
// host.color.mix interpolates in OKLab like CSS Color 4 (v1.68); an older host,
// or a colour that is not hex (a var() the brand-inheritance path allows), gets
// a plain sRGB lerp or, failing that, the nearer endpoint.
function mixColor(h, a, b, t) {
  try {
    if (h && h.color && typeof h.color.mix === 'function') {
      var m = h.color.mix(a, b, t, { space: 'oklab' });
      if (m) return m;
    }
  } catch (e) { /* fall through */ }
  var A = hexRgb(a);
  var B = hexRgb(b);
  if (!A || !B) return t < 0.5 ? a : b;
  return rgbHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

// ── the ring ──────────────────────────────────────────────────────────────────

// One annular sector from clock angle b0 to b1 (b1 < b0: counter-clockwise on
// screen, so the outer arc takes sweep-flag 0 and the inner arc comes back with
// sweep-flag 1). The large-arc flag follows the span, so the same path serves a
// two-degree sliver and a mask piece covering most of the ring.
function sectorPath(R, Ri, b0, b1) {
  var la = (b0 - b1) > 180 ? 1 : 0;
  return 'M' + pt(R, b0) + 'A' + f2(R) + ' ' + f2(R) + ' 0 ' + la + ' 0 ' + pt(R, b1)
    + 'L' + pt(Ri, b1) + 'A' + f2(Ri) + ' ' + f2(Ri) + ' 0 ' + la + ' 1 ' + pt(Ri, b0) + 'Z';
}

// The fan of opaque sectors that carries the colour gradient. Neighbours overlap
// by a fraction of a degree so no rasteriser leaves a hairline seam between two
// anti-aliased edges; on opaque fills the overlap is invisible.
function ringSectors(h, g, p) {
  var full = g.sweep >= 360;
  var n = Math.max(24, Math.round(g.sweep / 2));
  var ov = 0.3;
  var out = [];
  for (var i = 0; i < n; i++) {
    var t0 = i / n;
    var t1 = (i + 1) / n;
    var tm = (t0 + t1) / 2;
    var b0 = g.start - g.sweep * t0;
    var b1 = g.start - g.sweep * t1 - ((i < n - 1 || full) ? ov : 0);
    var col = p.gradient ? mixColor(h, p.c1, p.c2, middleWeight(tm, p.spread)) : p.c1;
    out.push('<path d="' + sectorPath(g.R, g.Ri, b0, b1) + '" fill="' + esc(col) + '"/>');
  }
  return out.join('');
}

// How much of the middle colour a point at fraction t along the arc gets: a
// plateau of full middle colour `spread` wide, centred, with a smoothstep blend to
// the ends colour across what is left at each end. spread 0 is a plain tent that
// only touches the middle colour at the exact centre; spread 1 is the middle
// colour throughout.
function middleWeight(t, spread) {
  var half = Math.max(0.001, (1 - clamp(spread, 0, 0.98)) / 2);   // the blend zone, each end
  var e = Math.min(t, 1 - t) / half;
  if (e >= 1) return 1;
  return e * e * (3 - 2 * e);
}

// A point on a circle about the centre, clock degrees, as numbers.
function xy(r, a) {
  var rad = Math.PI / 180;
  return [CX + r * Math.sin(a * rad), CY - r * Math.cos(a * rad)];
}

// The smoothstep feather as gradient stops: opaque at offset 0 (where the fade
// begins), clear at 1 (the ring's tip). Six stops trace the curve closely enough
// that the renderer's linear interpolation between them shows no knee.
var FADE_STOPS = [[0, 1], [0.2, 0.896], [0.4, 0.648], [0.6, 0.352], [0.8, 0.104], [1, 0]];

function fadeGradient(id, from, to) {
  var stops = '';
  for (var i = 0; i < FADE_STOPS.length; i++) {
    stops += '<stop offset="' + FADE_STOPS[i][0] + '" stop-color="#fff" stop-opacity="' + FADE_STOPS[i][1] + '"/>';
  }
  return '<linearGradient id="' + id + '" gradientUnits="userSpaceOnUse" x1="' + f2(from[0]) + '" y1="' + f2(from[1])
    + '" x2="' + f2(to[0]) + '" y2="' + f2(to[1]) + '">' + stops + '</linearGradient>';
}

// The end fade of an open ring as a luminance mask: a solid white middle piece
// and, at each end, one sector filled with a linear gradient running along the
// ring's midline from where the fade begins to the tip. A gradient's iso-lines are
// parallel where the ring's cuts are radial, so across the ring's width the fade
// front leans a few degrees - the look of the reference badges, whose fades were
// linear too - and it is one continuous ramp with no steps to band. Returns the
// <defs> markup and the attribute to put on the ring group, or empty strings when
// nothing fades (a full ring, or fade 0).
function fadeMask(g, fade, seed) {
  if (g.sweep >= 360 || fade <= 0) return { defs: '', attr: '' };
  var f = g.sweep * fade;                 // degrees of arc that fade, each end
  var ov = 0.3;
  var rMid = (g.R + g.Ri) / 2;
  var a0 = g.start;                       // the reading-start tip
  var a1 = g.start - f;                   // where the start fade is fully opaque
  var b1 = g.start - g.sweep + f;         // where the end fade begins
  var b0 = g.start - g.sweep;             // the far tip
  var id = 'wa-m-' + hashStr(seed);
  var defs = '<defs>'
    + fadeGradient(id + '-a', xy(rMid, a1), xy(rMid, a0))
    + fadeGradient(id + '-b', xy(rMid, b1), xy(rMid, b0))
    + '<mask id="' + id + '" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000">'
    + '<path d="' + sectorPath(g.R, g.Ri, a1 + ov, b1 - ov) + '" fill="#fff"/>'
    + '<path d="' + sectorPath(g.R, g.Ri, a0, a1) + '" fill="url(#' + id + '-a)"/>'
    + '<path d="' + sectorPath(g.R, g.Ri, b1, b0) + '" fill="url(#' + id + '-b)"/>'
    + '</mask></defs>';
  return { defs: defs, attr: ' mask="url(#' + id + ')"' };
}

// ── the text ──────────────────────────────────────────────────────────────────

// {font.brand} / {font.mono} → family name. Unresolvable (blank brand, host
// without tokens) falls back to the platform face rather than failing.
async function familyFor(h, kind) {
  var mono = kind === 'mono';
  try {
    if (h && h.tokens && h.tokens.resolve) {
      var fam = await h.tokens.resolve(mono ? '{font.mono}' : '{font.brand}');
      if (typeof fam === 'string' && fam && fam.indexOf('{') !== 0) return fam;
    }
  } catch (e) { /* keep the fallback */ }
  return mono ? FALLBACK_MONO : FALLBACK_FAMILY;
}

// Resolved font files by family|weight|italic. A miss is not cached: the
// registry can answer null for a face that is still loading, and a second ask
// is cheap.
var _fontCache = {};
async function fontFor(h, family, weight, italic) {
  var k = family + '|' + weight + '|' + (italic ? 'i' : 'n');
  if (_fontCache[k]) return _fontCache[k];
  var f = null;
  try { f = await h.text.fontUrl(family, { weight: weight, italic: !!italic }); } catch (e) { f = null; }
  if (f && f.url) _fontCache[k] = f;
  return f && f.url ? f : null;
}

// Shaped runs by their inputs, so a ring-colour drag never re-shapes the text.
var _runCache = {};
var _runKeys = [];
async function shapeRun(h, text, font, size, spacing) {
  var k = [text, font.url, f3(size), f3(spacing), (font.variations || []).join(',')].join('');
  if (Object.prototype.hasOwnProperty.call(_runCache, k)) return _runCache[k];
  var res = await h.text.toPath({
    text: text,
    fontUrl: font.url,
    fontSize: size,
    letterSpacing: spacing,
    variations: font.variations,
    clusters: true,
  });
  _runCache[k] = res;
  _runKeys.push(k);
  if (_runKeys.length > 48) delete _runCache[_runKeys.shift()];
  return res;
}

// The ring text as placeable clusters: HarfBuzz for the words, a drawn heart for
// ♥. Every cluster's `d` plus its `pre` transform is in RUN coordinates (pen
// origin at x=0, baseline y=0), which is what placeOnPath expects. Returns
// { clusters, width, capH }, or { live: reason } when the honest answer is a
// live <text> run.
async function shapeText(h, text, family, weight, italic, size, spacing) {
  if (!h || !h.text || typeof h.text.fontUrl !== 'function' || typeof h.text.toPath !== 'function') {
    return { live: 'this host cannot outline text' };
  }
  var font = await fontFor(h, family, weight, italic);
  if (!font) return { live: 'no font file found for "' + family + '"' };

  var parts = text.replace(/\uFE0F/g, '').split(HEART_RE);
  var runs = [];
  var capH = 0;
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (!part) continue;
    if (part.length === 1 && HEART_RE.test(part)) { runs.push({ heart: true }); continue; }
    var res = await shapeRun(h, part, font, size, spacing);
    if (!res || !res.clusters) return { live: 'this host cannot shape per letter (needs engine 1.159)' };
    if (res.notdef > 0) {
      return { live: res.notdef + ' character' + (res.notdef === 1 ? '' : 's') + ' missing from ' + family };
    }
    if (res.bbox && -res.bbox.y1 > capH) capH = -res.bbox.y1;
    runs.push({ res: res });
  }
  if (!capH) capH = size * 0.7;

  var clusters = [];
  var x = 0;
  for (var j = 0; j < runs.length; j++) {
    var r = runs[j];
    if (r.heart) {
      var hh = capH * 0.82;
      var k = hh / HEART_BOX.h;
      var w = HEART_BOX.w * k;
      clusters.push({
        d: HEART_D,
        x: x,
        advance: w + spacing,
        pre: 'translate(' + f2(x - HEART_BOX.x * k) + ' ' + f2(-(capH - hh) / 2 - (HEART_BOX.y + HEART_BOX.h) * k) + ') scale(' + f3(k) + ')',
      });
      x += w + spacing;
      continue;
    }
    // A cluster's d is absolute within ITS run; the run's offset in the whole
    // line rides in `pre` so the d string is passed through untouched.
    var shift = x > 0 ? 'translate(' + f2(x) + ' 0)' : '';
    var cl = r.res.clusters;
    for (var c = 0; c < cl.length; c++) {
      clusters.push({ d: cl[c].d, x: x + cl[c].x, advance: cl[c].advance, pre: shift });
    }
    x += r.res.advanceWidth;
  }
  return { clusters: clusters, width: x, capH: capH };
}

function glyphsSvg(placed, color) {
  var out = [];
  for (var i = 0; i < placed.length; i++) {
    var p = placed[i];
    if (!p.d) continue; // a space: advance only
    out.push('<path d="' + p.d + '" transform="translate(' + f2(p.x) + ' ' + f2(p.y) + ') rotate(' + f2(p.rot) + ') translate(' + f2(p.dx) + ' 0)'
      + (p.pre ? ' ' + p.pre : '') + '"/>');
  }
  return out.length ? '<g fill="' + esc(color) + '">' + out.join('') + '</g>' : '';
}

// Honest fallback: a live <textPath> on the same baseline circle, reading the
// same way. Needs the font at view time; waWarning says so.
function liveTextSvg(text, rb, start, dir, sweep, s0, size, weight, italic, mono, spacing, color, id) {
  var flag = dir > 0 ? 1 : 0;
  var a1 = start + dir * sweep;
  var arc = 'A' + f2(rb) + ' ' + f2(rb) + ' 0 ';
  var d;
  if (sweep >= 360) {
    // One arc cannot close on itself, so two halves.
    d = 'M' + pt(rb, start) + arc + '0 ' + flag + ' ' + pt(rb, start + dir * 180) + arc + '0 ' + flag + ' ' + pt(rb, a1);
  } else {
    d = 'M' + pt(rb, start) + arc + (sweep > 180 ? 1 : 0) + ' ' + flag + ' ' + pt(rb, a1);
  }
  return '<defs><path id="' + id + '" d="' + d + '"/></defs>'
    + '<text' + (mono ? ' class="wa-mono"' : '') + ' font-size="' + f2(size) + '" font-weight="' + weight
    + (italic ? '" font-style="italic' : '') + '" letter-spacing="' + f2(spacing) + '" fill="' + esc(color) + '">'
    + '<textPath href="#' + id + '" startOffset="' + f2(s0) + '">' + esc(text) + '</textPath></text>';
}

// ── the treatment ─────────────────────────────────────────────────────────────

function unitRgb(c) {
  var r = hexRgb(c) || [0, 0, 0];
  return [r[0] / 255, r[1] / 255, r[2] / 255];
}

// Luminance → a table of 2 or 3 stops (shadow → [mid] → highlight), mixed back
// over the source by `amount`. The luminance matrix and sRGB interpolation are
// the engine's own photo-treatment recipe (engine/src/photo-treatment.ts), so a
// duotone here matches a duotone picked in the asset picker.
function tableFilter(id, stops, amount) {
  var cols = [];
  for (var i = 0; i < stops.length; i++) cols.push(unitRgb(stops[i]));
  var tv = function (ch) {
    var vals = [];
    for (var j = 0; j < cols.length; j++) vals.push(f3(cols[j][ch]));
    return vals.join(' ');
  };
  return '<svg class="wa-defs" aria-hidden="true" focusable="false">'
    + '<filter id="' + id + '" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">'
    + '<feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0" result="lum"/>'
    + '<feComponentTransfer in="lum" result="duo">'
    + '<feFuncR type="table" tableValues="' + tv(0) + '"/>'
    + '<feFuncG type="table" tableValues="' + tv(1) + '"/>'
    + '<feFuncB type="table" tableValues="' + tv(2) + '"/>'
    + '</feComponentTransfer>'
    + (amount < 0.999
      ? '<feComposite in="duo" in2="SourceGraphic" operator="arithmetic" k1="0" k2="' + f3(amount) + '" k3="' + f3(1 - amount) + '" k4="0"/>'
      : '')
    + '</filter></svg>';
}

// The <img>'s CSS filter for a treatment at `amount` (0..1), plus the in-document
// <filter> when the treatment needs one. Shorthand functions are used where they
// say the right thing (sepia IS warm); the duotone, wash and cool cast go through
// the luminance table because hue-rotate would turn skin cyan.
function filterFor(h, t, amount, p) {
  var a = amount;
  if (t === 'none' || a <= 0) return { css: '', defs: '' };
  if (t === 'mono') return { css: 'filter:grayscale(' + f3(a) + ') contrast(' + f3(1 + 0.08 * a) + ')', defs: '' };
  if (t === 'warm') return { css: 'filter:sepia(' + f3(0.45 * a) + ') saturate(' + f3(1 + 0.12 * a) + ') contrast(' + f3(1 + 0.04 * a) + ')', defs: '' };
  if (t === 'pop') return { css: 'filter:contrast(' + f3(1 + 0.25 * a) + ') saturate(' + f3(1 + 0.35 * a) + ')', defs: '' };
  if (t === 'matte') return { css: 'filter:contrast(' + f3(1 - 0.18 * a) + ') brightness(' + f3(1 + 0.06 * a) + ') saturate(' + f3(1 - 0.2 * a) + ')', defs: '' };
  var stops;
  var blend = a;
  if (t === 'duotone') {
    stops = [p.shadow, p.highlight];
  } else if (t === 'tint') {
    stops = [mixColor(h, p.tint, '#000000', 0.82), p.tint, mixColor(h, p.tint, '#ffffff', 0.78)];
  } else {
    // cool: a fixed blue-grey wash, never fully replacing the photo's colour.
    stops = ['#0f1b2b', '#6d8bb0', '#eef3fa'];
    blend = a * 0.6;
  }
  var id = 'wa-f-' + hashStr(t + '|' + stops.join('|') + '|' + f3(blend));
  return { css: 'filter:url(#' + id + ')', defs: tableFilter(id, stops, blend) };
}

// ── compute ───────────────────────────────────────────────────────────────────

var _memoKey = null;
var _memoResult = null;

async function compute(h, a) {
  var key = JSON.stringify(a);
  if (key === _memoKey) return _memoResult;

  var patch = { ringSvg: '', textSvg: '', photoStyle: '', rootStyle: '', filterCss: '', filterDefs: '', waWarning: '' };
  try {
    var margin = clamp(num(a.margin, 3), 0, 10) / 100;
    var R = 500 * (1 - margin);
    var style = pick(a.ringStyle, STYLES, 'arc');
    var ringOn = style !== 'none';
    var Ri = ringOn ? R * (1 - clamp(num(a.ringWidth, 20), 8, 40) / 100) : R;
    // Ring over the photo (the reference look): the photo's full size is the whole
    // circle and the ring sits on its edge. Off, full size is the ring's inner
    // edge. Photo size scales the disc down from there in either placement - a
    // gap to the ring, or simply a smaller headshot on its backdrop.
    var overlay = bool(a.ringOverlay, true);
    var rFull = (ringOn && !overlay) ? Ri : R;
    var rPhoto = rFull * clamp(num(a.photoSize, 100), 40, 100) / 100;
    // What shows behind the photo inside the circle: the disc a cut-out headshot
    // (background removed) sits on. A solid colour, a soft radial glow from a
    // second colour at the head, or nothing - which keeps the cut-out's alpha all
    // the way to a transparent export. CSS paint only, so the export walkers
    // reconstruct it as they do every other backdrop.
    var pb = pick(a.photoBackdrop, ['solid', 'glow', 'none'], 'solid');
    var pbc = safeColor(a.photoBg, FB_PHOTO_BG);
    var pbc2 = safeColor(a.photoBg2, FB_RING2);
    var photoBg = pb === 'none' ? 'transparent'
      : pb === 'glow' ? 'radial-gradient(circle at 50% 38%, ' + pbc2 + ', ' + pbc + ' 72%)'
      : pbc;
    patch.photoStyle = 'left:' + pct(CX - rPhoto) + ';top:' + pct(CY - rPhoto)
      + ';width:' + pct(2 * rPhoto) + ';height:' + pct(2 * rPhoto) + ';background:' + photoBg;

    // `transparentBg` is the shell's own toggle, synthesised from render.transparentBg;
    // off, the square is painted so a LinkedIn upload never flattens to black.
    if (!bool(a.transparentBg, false)) {
      patch.rootStyle = '--wa-bg:' + safeColor(a.bgColor, FB_BG);
    }

    var flt = filterFor(h, pick(a.treatment, TREATMENTS, 'none'), clamp(num(a.treatmentAmount, 100), 0, 100) / 100, {
      shadow: safeColor(a.treatShadow, FB_RING),
      highlight: safeColor(a.treatHighlight, '#ffffff'),
      tint: safeColor(a.tintColor, FB_RING2),
    });
    patch.filterCss = flt.css;
    patch.filterDefs = flt.defs;

    if (!ringOn) { _memoKey = key; _memoResult = patch; return patch; }

    var spec = RINGS[style];
    var g = { start: spec.start + clamp(num(a.ringRotate, 0), -180, 180), sweep: spec.sweep, R: R, Ri: Ri, full: spec.sweep >= 360 };
    var fade = clamp(num(a.ringFade, 12), 0, 40) / 100;
    var body = ringSectors(h, g, {
      c1: safeColor(a.ringColor, FB_RING),
      c2: safeColor(a.ringColor2, FB_RING2),
      gradient: bool(a.ringGradient, true),
      spread: clamp(num(a.ringSpread, 55), 0, 90) / 100,
    });
    var mask = fadeMask(g, fade, [g.start, g.sweep, f2(R), f2(Ri), f3(fade)].join('|'));

    var text = typeof a.text === 'string' ? a.text.trim().slice(0, 60) : '';
    if (bool(a.uppercase, true)) text = text.toUpperCase();
    var glyphs = '';
    if (text) {
      var side = pick(a.textSide, SIDES, 'inside');
      var anchor = pick(a.textAnchor, ANCHORS, 'start');
      var position = clamp(num(a.textPosition, 10), 0, 100) / 100;
      var weight = Number(pick(a.textWeight, WEIGHTS, '700'));
      var fontKind = pick(a.textFont, ['brand', 'mono'], 'brand');
      var italic = bool(a.textItalic, false);
      var color = safeColor(a.textColor, FB_TEXT);
      var thick = R - Ri;
      var size = thick * clamp(num(a.textSize, 62), 35, 90) / 100;
      var spacing = size * clamp(num(a.textTracking, 8), 0, 30) / 100;
      // Inside text reads counter-clockwise from the ring's start; outside text
      // reads clockwise from the other end (on a full ring, from the bottom, so
      // the middle of the run lands at the top).
      var dir = side === 'outside' ? 1 : -1;
      var start = dir < 0 ? g.start : (g.full ? g.start + 180 : g.start - g.sweep);
      var rMid = (R + Ri) / 2;
      var baseline = function (capH) { return side === 'outside' ? rMid - capH / 2 : rMid + capH / 2; };

      var family = await familyFor(h, fontKind);
      var shaped = await shapeText(h, text, family, weight, italic, size, spacing);
      var capH = shaped.live ? size * 0.7 : shaped.capH;
      var rb = baseline(capH);
      var L = rb * g.sweep * Math.PI / 180;
      var room = g.full ? L * 0.995 : L * 0.97;
      if (!shaped.live && shaped.width > room) {
        // Too long for the ring: shrink once to fit rather than spill past the ends.
        var k = room / shaped.width;
        size *= k;
        spacing *= k;
        shaped = await shapeText(h, text, family, weight, italic, size, spacing);
        if (!shaped.live) {
          capH = shaped.capH;
          rb = baseline(capH);
          L = rb * g.sweep * Math.PI / 180;
        }
      }
      var width = shaped.live ? text.length * (size * 0.62 + spacing) : shaped.width;
      var s0 = position * L - (anchor === 'middle' ? width / 2 : anchor === 'end' ? width : 0);
      s0 = clamp(s0, 0, Math.max(0, L - width));
      if (shaped.live) {
        glyphs = liveTextSvg(text, rb, start, dir, g.sweep, s0, size, weight, italic, fontKind === 'mono', spacing, color, 'wa-tp-' + hashStr(text + '|' + f2(rb) + '|' + f2(start)));
        patch.waWarning = 'Ring text is live text (' + shaped.live + '), so exports need the font installed.';
      } else {
        glyphs = glyphsSvg(placeOnPath(shaped.clusters, arcSampler(CX, CY, rb, start, dir), s0), color);
      }
    }
    patch.ringSvg = '<svg class="wa-layer wa-ring" viewBox="0 0 1000 1000" aria-hidden="true" focusable="false">'
      + mask.defs + '<g' + mask.attr + '>' + body + '</g></svg>';
    if (glyphs) {
      patch.textSvg = '<svg class="wa-layer wa-text" viewBox="0 0 1000 1000" aria-hidden="true" focusable="false">' + glyphs + '</svg>';
    }
  } catch (err) {
    patch.waWarning = 'Could not build the ring: ' + ((err && err.message) || 'unknown error');
  }
  _memoKey = key;
  _memoResult = patch;
  return patch;
}

function values(model) {
  var out = {};
  for (var i = 0; i < model.length; i++) out[model[i].id] = model[i].value;
  return out;
}

async function onInit(ctx) { return compute(ctx.host || host, values(ctx.model)); }
async function onInput(ctx) { return compute(ctx.host || host, values(ctx.model)); }
