/* global host, onInit, onInput, exportFile */
/**
 * Annotate - marks drawn over the user's own picture, on their device.
 *
 * The whole tool is one overlay: a single SVG string built here from the
 * `annotations` rows, drawn over the picture in the preview and rasterised over the
 * picture at its NATIVE size on export. One builder, so the file that
 * downloads is the drawing the person approved rather than a second
 * implementation of it.
 *
 * Coordinates are PERCENTAGES of the picture, not pixels. That is the
 * difference from redact, whose bars must name exact pixels because it destroys
 * them; a mark only sits on top, so a percentage keeps the same annotation
 * correct when the source is replaced with a bigger grab, keeps URL mode short,
 * and lets the shipped examples draw over a generated placeholder with no photo
 * bundled anywhere.
 *
 * The overlay's own space is a viewBox 100 wide by 100/aspect tall, so one
 * vb unit is 1% of the picture's WIDTH on both axes. Uniform, which is what
 * lets a stroke width, a pin radius and an arrowhead be single numbers.
 *
 * Nothing is embedded and nothing is signed: this is a picture transform, the
 * user's own file in and out. No provenance, no watermark, no upload.
 *
 * PDF is deliberately out of scope (Redact owns the page-rebuild path); an
 * animated GIF is flattened to its first frame.
 */

// === lolly:shared canRaster - generated from community/_shared/raster.js; edit there and run npm run sync:shared ===
function canRaster() {
  return !!(host.raster && host.raster.canRaster());
}
// === /lolly:shared canRaster ===

// `loadImage` is named for a URL but takes any RasterSource, so the file
// input's in-memory bytes and the overlay Blob both go through it unchanged.
// === lolly:shared loadImage - generated from community/_shared/raster.js; edit there and run npm run sync:shared ===
function loadImage(url) {
  if (!host.raster) return Promise.reject(new Error('no raster'));
  return host.raster.decode(url);
}
// === /lolly:shared loadImage ===

// === lolly:shared rasterCanvas - generated from community/_shared/raster.js; edit there and run npm run sync:shared ===
// A realm-appropriate 2D drawing surface for an onFrame kernel: a document
// <canvas> on the main thread (keeps the existing toDataURL fast path
// byte-identical), an OffscreenCanvas inside a Worker (no document there, but
// OffscreenCanvas works). getContext('2d')/getImageData/putImageData/drawImage
// are identical on both, so a kernel that draws through this is realm-agnostic.
function rasterCanvas(w, h) {
  if (typeof document !== 'undefined' && document.createElement) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  return new OffscreenCanvas(w, h);
}
// === /lolly:shared rasterCanvas ===

var HEADLESS_MSG = 'Annotating a picture needs a browser canvas. Open this tool in the Lolly web app.';

// A blank brand leaves a semantic token unresolved, so every colour read needs
// a literal to fall back to.
var ACCENT_FALLBACK = '#2563eb';
var DIM_INK = '#0b0e14';

// The generated placeholder's shape. Also the aspect used while a real
// picture's own size is still being measured.
var PLACEHOLDER_W = 1600;
var PLACEHOLDER_H = 1000;

var KINDS = ['arrow', 'box', 'pin', 'callout', 'highlight', 'spotlight'];

// ─── small helpers ───────────────────────────────────────────────────────────

function inputsFrom(model) {
  var o = {};
  for (var i = 0; i < model.length; i++) o[model[i].id] = model[i].value;
  return o;
}

function num(v, d) { var n = Number(v); return isFinite(n) ? n : d; }
function f2(n) { return Math.round(n * 100) / 100; }

// === lolly:shared clamp - generated from community/_shared/math.js; edit there and run npm run sync:shared ===
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
// === /lolly:shared clamp ===

// Every value this escapes goes into a double-quoted SVG attribute or a text
// node, so the canonical four are the whole set.
// === lolly:shared esc - generated from community/_shared/text.js; edit there and run npm run sync:shared ===
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// === /lolly:shared esc ===

function fmtBytes(n) {
  if (!isFinite(n) || n <= 0) return '0 B';
  var units = ['B', 'KB', 'MB', 'GB'];
  var i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  var v = n / Math.pow(1024, i);
  return (v >= 100 || i === 0 ? Math.round(v) : Math.round(v * 10) / 10) + ' ' + units[i];
}

// Only a literal hex is accepted. A colour reaches the SVG as an attribute
// value and can arrive from a shared link, so anything else falls back rather
// than being sanitised into something half-trusted.
function hex(v, fb) {
  var s = String(v == null ? '' : v).trim();
  var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (!m) return fb;
  if (m[1].length === 3) {
    return '#' + m[1][0] + m[1][0] + m[1][1] + m[1][1] + m[1][2] + m[1][2];
  }
  return '#' + m[1].toLowerCase();
}

// Black or white, whichever reads better on the accent. sRGB relative
// luminance against a threshold a shade above redact's 0.4, because a pin's
// number is small type on a filled disc rather than a wide bar.
function inkOn(hexColor) {
  var r = parseInt(hexColor.slice(1, 3), 16) / 255;
  var g = parseInt(hexColor.slice(3, 5), 16) / 255;
  var b = parseInt(hexColor.slice(5, 7), 16) / 255;
  function lin(c) { return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  var L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.42 ? '#14161a' : '#ffffff';
}

// ─── marks: one normalised row shape, and the pin ordinals ───────────────────

// Rows arrive from the blocks editor, from a share link (strings) or from the
// canvas. Everything is coerced, and EVERY row survives with its own index:
// the canvas commits the whole array back on each edit, so a row this pass
// cannot draw (an unrecognised kind from a hand-edited link, say) has to keep
// its place rather than being dropped under the person's cursor. An undrawable
// row carries kind '' and renders nothing.
//
// An ARROW keeps its signed w/h - they are the run from its tail to its point,
// so an arrow drawn up and to the left is negative on both axes. Every other
// kind is a box, so a negative extent is folded back into x/y and the row comes
// out with a positive size.
//
// `n` is the STEP NUMBER of a pin: its position among the pins, counted here so
// nobody has to type it and so deleting the second of five renumbers the rest.
function normaliseMarks(v) {
  if (!Array.isArray(v)) return [];
  var out = [];
  var pin = 0;
  for (var i = 0; i < v.length; i++) {
    var row = (v[i] && typeof v[i] === 'object') ? v[i] : {};
    var kind = String(row.kind == null ? '' : row.kind);
    if (KINDS.indexOf(kind) === -1) kind = '';
    var x = num(row.x, 0);
    var y = num(row.y, 0);
    var w = num(row.w, 0);
    var h = num(row.h, 0);
    if (kind === 'pin') { w = 0; h = 0; }
    if (kind !== 'arrow' && kind !== 'pin') {
      if (w < 0) { x = x + w; w = -w; }
      if (h < 0) { y = y + h; h = -h; }
    }
    out.push({
      i: i,
      kind: kind,
      x: f2(x), y: f2(y), w: f2(w), h: f2(h),
      text: String(row.text == null ? '' : row.text),
      n: kind === 'pin' ? ++pin : 0,
    });
  }
  return out;
}

// ─── sketchy: a wobble that is the same every time ───────────────────────────

// A small LCG seeded by the mark's position in the list. No randomness API is
// involved, so the preview, the export and a re-render a week later all draw
// the same line - which is the only reason a hand-drawn look is usable on a
// document that gets re-exported.
function rng(seed) {
  var s = ((seed + 1) * 1664525 + 1013904223) >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// A polyline through `pts` with each INTERIOR point nudged by up to `amp`.
// Endpoints are exact so an arrow still points where it was aimed.
function wobble(pts, amp, seed, close) {
  var r = rng(seed);
  var d = '';
  for (var i = 0; i < pts.length; i++) {
    var p = pts[i];
    var edge = !close && (i === 0 || i === pts.length - 1);
    var dx = edge ? 0 : (r() - 0.5) * 2 * amp;
    var dy = edge ? 0 : (r() - 0.5) * 2 * amp;
    d += (i ? 'L' : 'M') + f2(p[0] + dx) + ' ' + f2(p[1] + dy) + ' ';
  }
  return d.trim() + (close ? ' Z' : '');
}

// Points along a segment, for wobbling a straight line into a drawn one.
function samples(x0, y0, x1, y1, n) {
  var pts = [];
  for (var i = 0; i <= n; i++) {
    var t = i / n;
    pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
  }
  return pts;
}

// The four sides of a box, sampled so a wobble reads as a drawn rectangle.
function boxPoints(x, y, w, h, per) {
  var pts = [];
  var corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  for (var c = 0; c < 4; c++) {
    var a = corners[c], b = corners[(c + 1) % 4];
    for (var i = 0; i < per; i++) {
      var t = i / per;
      pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return pts;
}

// ─── shapes ──────────────────────────────────────────────────────────────────

// A rounded rectangle as a path, so a spotlight hole and a solid box are the
// same primitive and the evenodd cut-out below can hold any number of them.
function rrPath(x, y, w, h, r) {
  var rad = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!rad) {
    return 'M' + f2(x) + ' ' + f2(y) + 'H' + f2(x + w) + 'V' + f2(y + h) + 'H' + f2(x) + 'Z';
  }
  return 'M' + f2(x + rad) + ' ' + f2(y) +
    'H' + f2(x + w - rad) + 'A' + f2(rad) + ' ' + f2(rad) + ' 0 0 1 ' + f2(x + w) + ' ' + f2(y + rad) +
    'V' + f2(y + h - rad) + 'A' + f2(rad) + ' ' + f2(rad) + ' 0 0 1 ' + f2(x + w - rad) + ' ' + f2(y + h) +
    'H' + f2(x + rad) + 'A' + f2(rad) + ' ' + f2(rad) + ' 0 0 1 ' + f2(x) + ' ' + f2(y + h - rad) +
    'V' + f2(y + rad) + 'A' + f2(rad) + ' ' + f2(rad) + ' 0 0 1 ' + f2(x + rad) + ' ' + f2(y) + 'Z';
}

// Naive word wrap against an average glyph advance. A hook has no way to
// measure text, so the estimate is deliberately generous (0.55em) and the box
// is the user's own drag, which they can widen if a word looks tight.
function wrapText(text, maxWidth, size) {
  var words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  var per = size * 0.55;
  var lines = [];
  var line = '';
  for (var i = 0; i < words.length; i++) {
    var next = line ? line + ' ' + words[i] : words[i];
    if (line && next.length * per > maxWidth) { lines.push(line); line = words[i]; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// The widest line, on the same estimate wrapText breaks by. A line only comes
// back wider than the box when it is ONE word with nowhere to break - a URL, a
// long compound - and that is the case shrinking by height alone never catches.
function widestLine(lines, size) {
  var max = 0;
  for (var i = 0; i < lines.length; i++) max = Math.max(max, lines[i].length);
  return max * size * 0.55;
}

// One mark, in overlay units. `g` carries the resolved look; `m` is a
// normalised row with its coordinates already mapped into the viewBox.
function markSvg(m, g) {
  var sw = g.sw;
  var accent = g.accent;
  var amp = g.sketchy ? sw * 0.55 : 0;
  var head = 'stroke-linecap="round" stroke-linejoin="round"';
  var open = '<g class="an-mark" data-idx="' + m.i + '" data-kind="' + m.kind + '">';

  if (m.kind === 'arrow') {
    var x1 = m.x + m.w, y1 = m.y + m.h;
    var len = Math.sqrt(m.w * m.w + m.h * m.h) || 1;
    var ux = m.w / len, uy = m.h / len;
    // The head is never longer than the arrow: a stray 1% drag would otherwise
    // put its base behind the tail and draw the shaft backwards.
    var hl = Math.min(len * 0.9, Math.max(sw * 3.2, Math.min(len * 0.34, sw * 6)));
    var baseX = x1 - ux * hl, baseY = y1 - uy * hl;
    // The shaft stops at the head's base so a translucent accent never shows
    // the line through the point.
    var shaft = g.sketchy
      ? wobble(samples(m.x, m.y, baseX, baseY, 6), amp, m.i * 7 + 1, false)
      : 'M' + f2(m.x) + ' ' + f2(m.y) + 'L' + f2(baseX) + ' ' + f2(baseY);
    var wing = hl * 0.42;
    var tri = 'M' + f2(x1) + ' ' + f2(y1) +
      'L' + f2(baseX - uy * wing) + ' ' + f2(baseY + ux * wing) +
      'L' + f2(baseX + uy * wing) + ' ' + f2(baseY - ux * wing) + 'Z';
    return open +
      '<path d="' + shaft + '" fill="none" stroke="' + accent + '" stroke-width="' + f2(sw) + '" ' + head + '/>' +
      '<path d="' + tri + '" fill="' + accent + '"/></g>';
  }

  if (m.kind === 'box') {
    var bd = g.sketchy
      ? wobble(boxPoints(m.x, m.y, m.w, m.h, 3), amp, m.i * 7 + 2, true)
      : rrPath(m.x, m.y, m.w, m.h, sw * 0.9);
    return open + '<path d="' + bd + '" fill="none" stroke="' + accent +
      '" stroke-width="' + f2(sw) + '" ' + head + '/></g>';
  }

  if (m.kind === 'highlight') {
    // A highlighter is a wash, not a line, so the sketchy style leaves it
    // alone: a wobbling edge on a translucent block reads as a mistake.
    return open + '<path d="' + rrPath(m.x, m.y, m.w, m.h, sw * 0.5) +
      '" fill="' + accent + '" fill-opacity="0.3"/></g>';
  }

  if (m.kind === 'pin') {
    var r = 1.6 + sw * 0.9;
    var fs = f2(r * 1.15);
    var label = m.text
      ? '<text x="' + f2(m.x + r + r * 0.5) + '" y="' + f2(m.y) + '" font-size="' + f2(r * 0.95) +
        '" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="600" dominant-baseline="central"' +
        ' fill="' + accent + '" stroke="#ffffff" stroke-width="' + f2(r * 0.32) +
        '" paint-order="stroke" stroke-linejoin="round">' + esc(m.text) + '</text>'
      : '';
    return open +
      '<circle cx="' + f2(m.x) + '" cy="' + f2(m.y) + '" r="' + f2(r) + '" fill="' + accent +
      '" stroke="#ffffff" stroke-width="' + f2(sw * 0.35) + '"/>' +
      '<text x="' + f2(m.x) + '" y="' + f2(m.y) + '" font-size="' + fs +
      '" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700" text-anchor="middle"' +
      ' dominant-baseline="central" fill="' + g.pinInk + '">' + m.n + '</text>' + label + '</g>';
  }

  if (m.kind === 'callout') {
    var pad = sw * 1.2 + 0.5;
    var innerW = Math.max(1, m.w - pad * 2);
    var innerH = Math.max(1, m.h - pad * 2);
    // Shrink to fit rather than overflow: the box is the user's own drag, so
    // the words go inside it. Each pass wraps at the current size and scales by
    // whichever overflow is worse, the stack of lines against the box's height
    // or the widest unbreakable word against its width. A re-wrap at the
    // smaller size can only produce fewer lines and can only narrow that word,
    // so three passes settle. Slack is left rather than chased - a callout
    // reading slightly small is better than one that grows and re-wraps on
    // every keystroke.
    var size = clamp(Math.min(m.h * 0.3, 3.4), 1.4, 6);
    var lines = wrapText(m.text, innerW, size);
    for (var pass = 0; pass < 3 && lines.length; pass++) {
      var need = lines.length * size * 1.25;
      var wide = widestLine(lines, size);
      var ratio = Math.min(need > 0 ? innerH / need : 1, wide > 0 ? innerW / wide : 1);
      if (ratio >= 1) break;
      size = Math.max(0.4, size * ratio);
      lines = wrapText(m.text, innerW, size);
    }
    // Down to the two places the attribute is written at, never up: rounding a
    // size that exactly fills the box to the nearest hundredth puts it back
    // outside by a hair, and the fit above would be a fit on paper only.
    size = Math.max(0.4, Math.floor(size * 100) / 100);
    var plate = g.sketchy
      ? wobble(boxPoints(m.x, m.y, m.w, m.h, 3), amp, m.i * 7 + 3, true)
      : rrPath(m.x, m.y, m.w, m.h, sw * 1.1);
    var body = '';
    var top = m.y + m.h / 2 - (lines.length - 1) * size * 0.625;
    for (var li = 0; li < lines.length; li++) {
      body += '<text x="' + f2(m.x + m.w / 2) + '" y="' + f2(top + li * size * 1.25) +
        '" font-size="' + f2(size) + '" font-family="ui-sans-serif, system-ui, sans-serif"' +
        ' font-weight="500" text-anchor="middle" dominant-baseline="central" fill="' + g.pinInk + '">' +
        esc(lines[li]) + '</text>';
    }
    return open + '<path d="' + plate + '" fill="' + accent + '" fill-opacity="0.94"/>' + body + '</g>';
  }

  return '';
}

// Every spotlight row becomes a hole in ONE dim path: an outer rectangle over
// the whole picture plus a rounded subpath per row, cut out by fill-rule
// evenodd. One path rather than one overlay per row, so two overlapping
// spotlights do not double the dim between them.
function spotlightSvg(rows, g) {
  var holes = rows.filter(function (m) { return m.kind === 'spotlight' && m.w > 0 && m.h > 0; });
  if (!holes.length) return '';
  var d = 'M0 0H' + f2(g.vbW) + 'V' + f2(g.vbH) + 'H0Z';
  for (var i = 0; i < holes.length; i++) {
    var m = holes[i];
    d += rrPath(m.x, m.y, m.w, m.h, g.sw * 1.2);
  }
  return '<path class="an-dim" d="' + d + '" fill="' + DIM_INK +
    '" fill-opacity="0.55" fill-rule="evenodd"/>';
}

// The whole overlay. `size` (export only) pins the SVG to the picture's real
// pixels so the rasteriser has something to scale to; the preview leaves it off
// and lets CSS size it to the frame.
function buildOverlay(rows, g, size) {
  var body = spotlightSvg(rows, g);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].kind === 'spotlight' || !rows[i].kind) continue;
    body += markSvg(rows[i], g);
  }
  var dim = size ? ' width="' + size.w + '" height="' + size.h + '"' : '';
  return '<svg class="an-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
    f2(g.vbW) + ' ' + f2(g.vbH) + '"' + dim + '>' + body + '</svg>';
}

// Rows mapped from percentages into overlay units. x and w are already
// percentages of the width, which IS the unit; y and h are percentages of the
// height, so they scale by the frame's own vbH.
function toOverlayUnits(rows, vbH) {
  return rows.map(function (m) {
    return {
      i: m.i, kind: m.kind, text: m.text, n: m.n,
      x: m.x, w: m.w,
      y: m.y * vbH / 100, h: m.h * vbH / 100,
    };
  });
}

// ─── measuring the picture (one job per file) ────────────────────────────────
//
// The overlay's aspect comes from the picture's real pixels, so a mark drawn at
// 40% down is 40% down in the downloaded file too. `host.raster.measure` is
// cheap but not free, so it runs once per file and the pass that cannot wait
// for it publishes `pending` and is nudged again by the canvas - the same shape
// redact's page-preview job uses.

var MEASURE_BUDGET_MS = 250;
var _measure = { key: '', promise: null, result: null };

// The blob URL leads, exactly as redact's rasterKey does: name + size alone
// collide between two different pictures saved under the same name at the same
// byte count, and a colliding key would hand a leftover text-read request to a
// file nobody asked it about.
function fileKeyOf(f) { return f ? (f.url || '') + '|' + f.name + '|' + f.size : ''; }

function measureJob(f, key) {
  if (_measure.key === key && _measure.promise) return _measure;
  var job = { key: key, promise: null, result: null, done: false };
  job.promise = Promise.resolve()
    .then(function () { return host.raster.measure(f.bytes); })
    .then(function (info) {
      if (info && info.width > 0 && info.height > 0) job.result = { w: info.width, h: info.height };
      job.done = true;
    })
    // Unreadable here: the placeholder aspect stands, and the job is DONE so
    // the canvas stops polling for an answer that is never coming.
    .catch(function () { job.done = true; });
  _measure = job;
  return job;
}

function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// ─── OCR anchors (the M7 pattern, copied from community/redact/hooks.js) ─────
//
// The contract redact documents and this tool reuses verbatim:
//   1. feature-detect `host.ocr`; absent means the affordance is never
//      published, so a shell without a reader renders exactly as before;
//   2. a canvas control asks for a run by writing a NONCE into a data-only
//      input, and the request is bound to the file it was made on, so the next
//      picture someone drops is never read without being asked for;
//   3. the read happens in a job keyed to file + nonce; the pass publishes
//      `pending` and the canvas polls, rather than awaiting past its budget;
//   4. the result is a PROPOSAL. Here it is a set of text-line anchors: click
//      one and the armed mark is placed on that line, through the ordinary
//      commit, so undo, URL mode and save behave as usual. Nothing is applied
//      on the tool's own initiative.
//
// Reading text embeds nothing and signs nothing: `host.ocr` produces no pixels,
// no asset and no provenance.

var OCR_MAX_EDGE = 2000;
var OCR_BUDGET_MS = 400;

var _ocrJob = { key: '', promise: null, result: null, error: '', abort: null };
var _ocrReq = { req: '', file: '' };

function cancelOcrJob() {
  if (_ocrJob.abort) { try { _ocrJob.abort.abort(); } catch (e) { /* already settled */ } }
  _ocrJob = { key: '', promise: null, result: null, error: '', abort: null };
}

// A fresh nonce claims whatever file is loaded when it first arrives; the same
// nonce seen later against a DIFFERENT file is a leftover, not a request.
function ocrRequestOwns(req, key) {
  if (_ocrReq.req !== req) _ocrReq = { req: req, file: key };
  return _ocrReq.file === key;
}

// Line boxes in source pixels become anchors in the tool's own percentages.
// Pure, so the mapping is testable without a reader.
function anchorsFrom(res, scale, W, H) {
  var lines = (res && Array.isArray(res.lines)) ? res.lines : [];
  var k = (isFinite(scale) && scale > 0) ? scale : 1;
  var out = [];
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i];
    if (!ln || !ln.box) continue;
    var x = clamp(ln.box.x * k, 0, W);
    var y = clamp(ln.box.y * k, 0, H);
    var w = Math.min(W - x, ln.box.w * k);
    var h = Math.min(H - y, ln.box.h * k);
    if (!(w > 0) || !(h > 0)) continue;
    out.push({
      x: f2(x / W * 100), y: f2(y / H * 100),
      w: f2(w / W * 100), h: f2(h / H * 100),
      text: String(ln.text == null ? '' : ln.text),
    });
  }
  return out;
}

async function readAnchors(f, dims, signal) {
  if (!host.ocr || typeof host.ocr.run !== 'function') {
    throw new Error('Reading the text in a picture is not available in this app.');
  }
  if (!canRaster()) throw new Error(HEADLESS_MSG);
  var img = await loadImage(f.bytes);
  var W = img.width || img.naturalWidth || dims.w;
  var H = img.height || img.naturalHeight || dims.h;
  if (!(W > 0) || !(H > 0)) throw new Error('That file could not be decoded as a picture.');

  var maxEdge = OCR_MAX_EDGE;
  if (typeof host.ocr.canRun === 'function') {
    var fit = await host.ocr.canRun({ width: W, height: H });
    if (fit && fit.ok === false) {
      if (fit.suggestedMaxEdge > 0) maxEdge = Math.min(maxEdge, fit.suggestedMaxEdge);
      else throw new Error(fit.message || 'This picture is too large for this device to read.');
    }
  }
  var k = Math.min(1, maxEdge / Math.max(W, H));
  var rw = Math.max(1, Math.round(W * k));
  var rh = Math.max(1, Math.round(H * k));
  var canvas = rasterCanvas(rw, rh);
  var ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(HEADLESS_MSG);
  ctx.drawImage(img, 0, 0, rw, rh);
  var frame = { width: rw, height: rh, data: ctx.getImageData(0, 0, rw, rh).data };
  var res = await host.ocr.run(frame, { signal: signal });
  return anchorsFrom(res, rw > 0 ? W / rw : 1, W, H);
}

function ocrJobFor(f, dims, key) {
  if (_ocrJob.key === key && _ocrJob.promise) return _ocrJob;
  cancelOcrJob();
  var job = { key: key, promise: null, result: null, error: '', abort: null };
  if (typeof AbortController === 'function') job.abort = new AbortController();
  job.promise = Promise.resolve()
    .then(function () { return readAnchors(f, dims, job.abort ? job.abort.signal : undefined); })
    .then(function (list) { job.result = list; })
    .catch(function (e) {
      job.error = (e && e.message) ? String(e.message) : 'The text in this picture could not be read.';
    });
  _ocrJob = job;
  return job;
}

// ─── lifecycle ───────────────────────────────────────────────────────────────

async function patch(ctx) {
  var model = ctx.model;
  var inputs = inputsFrom(model);
  var f = (inputs.source && inputs.source.bytes) ? inputs.source : null;
  var key = fileKeyOf(f);

  var rows = normaliseMarks(inputs.annotations);
  var drawn = rows.filter(function (m) { return !!m.kind; }).length;
  var accent = hex(inputs.accent, ACCENT_FALLBACK);
  var sw = clamp(num(inputs.strokeWidth, 4), 1, 12) * 0.25;
  var sketchy = String(inputs.annotStyle) === 'sketchy';

  // The picture's own aspect, or the placeholder's until it is known.
  var dims = { w: PLACEHOLDER_W, h: PLACEHOLDER_H };
  var pending = false;
  if (f && host.raster && typeof host.raster.measure === 'function') {
    var mj = measureJob(f, key);
    if (!mj.done) await Promise.race([mj.promise, wait(MEASURE_BUDGET_MS)]);
    if (mj.result) dims = mj.result;
    else pending = !mj.done;
  }
  var vbH = 100 * dims.h / dims.w;

  var g = {
    accent: accent, sw: sw, sketchy: sketchy,
    vbW: 100, vbH: vbH, pinInk: inkOn(accent),
  };
  var overlay = buildOverlay(toOverlayUnits(rows, vbH), g);

  // Text-line anchors: offered only where a reader exists and only for a
  // request made on THIS file.
  var ocrAvailable = !!(host.ocr && typeof host.ocr.isAvailable === 'function' && host.ocr.isAvailable());
  var req = String(inputs.ocr == null ? '' : inputs.ocr).trim();
  var anchors = [];
  var ocrPending = false;
  var ocrError = '';
  var ocrRead = false;
  if (req === 'off') {
    cancelOcrJob();
  } else if (ocrAvailable && f && req && ocrRequestOwns(req, key)) {
    var job = ocrJobFor(f, dims, key + '|' + req);
    if (!job.result && !job.error) await Promise.race([job.promise, wait(OCR_BUDGET_MS)]);
    if (job.result) { anchors = job.result; ocrRead = true; }
    else if (job.error) ocrError = job.error;
    else ocrPending = true;
  }

  return {
    hasFile: !!f,
    fileName: f ? f.name : '',
    fileSize: f ? fmtBytes(f.size) : '',
    previewUrl: (f && f.url) ? f.url : '',
    sourceKey: key,
    aspectCss: dims.w + ' / ' + dims.h,
    // The same ratio as a bare number, for the CSS width cap (see styles.css).
    // Four places, not two: the cap has to stay under the height the frame is
    // allowed, and a rounded-up ratio would let a tall picture spill past it.
    aspectNum: Math.floor(dims.w / dims.h * 10000) / 10000,
    overlay: overlay,
    // Exactly the declared fields, in row order. The canvas commits this array
    // straight back into `annotations`, so a derived value (the pin's step
    // number) must not ride along: it would be stored in the person's own rows,
    // shared in every link, and go stale the moment a pin above it is deleted.
    marksJson: JSON.stringify(rows.map(function (m) {
      return { kind: m.kind, x: m.x, y: m.y, w: m.w, h: m.h, text: m.text };
    })),
    geomJson: JSON.stringify({ vbH: f2(vbH), sw: f2(sw), accent: accent, kinds: KINDS }),
    markCount: drawn,
    markPlural: drawn !== 1,
    hasMarks: drawn > 0,
    pending: pending || ocrPending,
    ocrAvailable: ocrAvailable,
    ocrPending: ocrPending,
    ocrError: ocrError,
    ocrRead: ocrRead,
    anchorsJson: JSON.stringify(anchors),
    anchorCount: anchors.length,
    hasAnchors: anchors.length > 0,
    anchorPlural: anchors.length !== 1,
    downloadLabel: 'Download annotated picture',
  };
}

function onInit(ctx) { return patch(ctx); }
function onInput(ctx) { return patch(ctx); }

// ─── export: the picture, then the same overlay, at native resolution ────────

var OUT_MIME = { 'image/jpeg': 'image/jpeg', 'image/png': 'image/png', 'image/webp': 'image/webp' };
var OUT_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

// A file's declared type is data, so it is looked up as an OWN key. A plain
// object literal answers 'constructor' and 'toString' with functions, and one
// of those reaching the encoder as a MIME type is a whole class of bug this
// catalog has already paid for once.
function pick(table, key, fb) {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : fb;
}

function outName(name, ext) {
  var base = String(name || 'picture');
  var dot = base.lastIndexOf('.');
  var stem = dot > 0 ? base.slice(0, dot) : base;
  return stem + '-annotated' + ext;
}

function encodeCanvas(canvas, mime, quality) {
  if (typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type: mime, quality: quality });
  }
  return new Promise(function (resolve, reject) {
    if (typeof canvas.toBlob !== 'function') { reject(new Error(HEADLESS_MSG)); return; }
    canvas.toBlob(function (b) {
      b ? resolve(b) : reject(new Error('The browser could not encode the annotated picture.'));
    }, mime, quality);
  });
}

// Marks are percentages, so the overlay is resolution-independent: it is built
// once at the picture's real size and drawn over it. The alternative - drawing
// each shape again with canvas commands - would be a second implementation of
// every arrowhead, and the two would drift.
async function exportFile(ctx) {
  var inputs = inputsFrom(ctx.model);
  var f = (inputs.source && inputs.source.bytes) ? inputs.source : null;
  if (!f) throw new Error('Choose a picture first.');
  if (!canRaster()) throw new Error(HEADLESS_MSG);

  var img = await loadImage(f.bytes);
  var W = img.width || img.naturalWidth;
  var H = img.height || img.naturalHeight;
  if (!(W > 0) || !(H > 0)) throw new Error('That file could not be decoded as a picture.');

  var rows = normaliseMarks(inputs.annotations);
  // Rows that draw nothing (an unrecognised kind from a hand-edited link) are
  // still rows, so the count that decides whether to rasterise an overlay at
  // all has to be the DRAWN one - otherwise a picture with no marks on it is
  // re-encoded through a second overlay pass for no reason.
  var drawn = rows.filter(function (m) { return !!m.kind; }).length;
  var accent = hex(inputs.accent, ACCENT_FALLBACK);
  var sw = clamp(num(inputs.strokeWidth, 4), 1, 12) * 0.25;
  var vbH = 100 * H / W;
  var overlay = buildOverlay(toOverlayUnits(rows, vbH), {
    accent: accent, sw: sw,
    sketchy: String(inputs.annotStyle) === 'sketchy',
    vbW: 100, vbH: vbH, pinInk: inkOn(accent),
  }, { w: W, h: H });

  var canvas = rasterCanvas(W, H);
  var c2d = canvas.getContext('2d');
  if (!c2d) throw new Error(HEADLESS_MSG);
  c2d.drawImage(img, 0, 0, W, H);
  if (drawn) {
    var over = await loadImage(new Blob([overlay], { type: 'image/svg+xml' }));
    c2d.drawImage(over, 0, 0, W, H);
    if (typeof over.close === 'function') over.close();
  }
  if (typeof img.close === 'function') img.close();

  // Same family out where the browser can encode it (a screenshot stays a PNG),
  // PNG for everything else - a GIF or an SVG has no annotated equivalent of
  // itself, and PNG is the lossless answer.
  var mime = pick(OUT_MIME, String(f.mime || '').toLowerCase(), 'image/png');
  var quality = mime === 'image/jpeg' ? 0.92 : (mime === 'image/webp' ? 1 : undefined);
  var blob = await encodeCanvas(canvas, mime, quality);
  if (blob.type && blob.type !== mime) {
    mime = 'image/png';
    blob = await encodeCanvas(canvas, mime, undefined);
  }
  var bytes = new Uint8Array(await blob.arrayBuffer());
  if (!bytes.length) throw new Error('The annotated picture came back empty. Nothing was downloaded.');
  return { bytes: bytes, mime: mime, filename: outName(f.name, pick(OUT_EXT, mime, '.png')) };
}
