// SPDX-License-Identifier: MPL-2.0
// SVG primitives (baseline computed; export-safe subset only) + the bounding-box
// accumulator + the empty-state / error placeholders built from them.
import { esc, f2 } from './util.js';
import { WHITE, FOG, EMPTY_HINTS, SOURCE_HINTS } from './constants.js';

export var FONT = "SUSE, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export function textEl(x, y, str, size, weight, fill, anchor) {
  return '<text x="' + f2(x) + '" y="' + f2(y) + '" font-family="' + FONT + '"'
    + ' font-size="' + f2(size) + '" font-weight="' + weight + '" fill="' + esc(fill) + '"'
    + ' text-anchor="' + (anchor || 'middle') + '">' + esc(str) + '</text>';
}
// Rounded-rect as a path (M/L/C/Z only). r is clamped.
export function roundedRectPath(x, y, w, h, r) {
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
// Trapezoid (4 straight segments) — funnel/pyramid tiers; fill + own stroke = PDF/EMF safe.
export function trapezoidPath(xTL, xTR, xBL, xBR, yT, yB) {
  return 'M' + f2(xTL) + ' ' + f2(yT) + 'L' + f2(xTR) + ' ' + f2(yT)
    + 'L' + f2(xBR) + ' ' + f2(yB) + 'L' + f2(xBL) + ' ' + f2(yB) + 'Z';
}
// Circle as 4 cubic beziers (we never emit <ellipse>; <circle> is safe but a path is
// portable everywhere and matches the card discipline). Used for dots + arrowheads.
export function circlePath(cx, cy, r) {
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
export function shaft(x1, y1, x2, y2, style, col, width) {
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

// ── grid / dot background (real geometry, capped) ────────────────────────────────
export function gridBg(kind, vbX, vbY, vbW, vbH, col) {
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

// ── bounding box over drawn content ──────────────────────────────────────────────
export function bounds() {
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
export function placeholder(mode, source) {
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
export function errPlaceholder(msg) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760" width="1200" height="760"'
    + ' style="width:100%;height:auto;display:block;"><rect width="100%" height="100%" fill="' + WHITE + '"/>'
    + '<path d="' + roundedRectPath(380, 300, 440, 160, 16) + '" fill="none" stroke="' + FOG + '" stroke-width="2"/>'
    + textEl(600, 390, msg, 22, 500, '#8a9a95', 'middle') + '</svg>';
}
