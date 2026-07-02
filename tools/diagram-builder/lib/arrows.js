// SPDX-License-Identifier: MPL-2.0
// ── explicit arrows: anchoring, geometry, arrowheads, and the render pass ─────────
import { arr, color, esc, f2, num, slug, textWidth, trim } from './util.js';
import { WHITE } from './constants.js';
import { roundedRectPath, shaft, textEl, circlePath } from './svg.js';

export function anchorOf(id, nodeById, layerById) {
  var n = nodeById[id];
  if (n) return { cx: n.x + n.w / 2, cy: n.y + n.h / 2, hw: n.w / 2, hh: n.h / 2 };
  var L = layerById[id];
  if (L && L.w != null) return { cx: L.x + L.w / 2, cy: L.y + L.h / 2, hw: L.w / 2, hh: L.h / 2 };
  return null;
}
export function nested(a, b) {
  function inside(o, i) {
    return (o.cx - o.hw <= i.cx - i.hw + 0.5) && (i.cx + i.hw <= o.cx + o.hw + 0.5)
      && (o.cy - o.hh <= i.cy - i.hh + 0.5) && (i.cy + i.hh <= o.cy + o.hh + 0.5);
  }
  return inside(a, b) || inside(b, a);
}
export function borderPoint(a, tx, ty) {
  var dx = tx - a.cx, dy = ty - a.cy;
  if (dx === 0 && dy === 0) return { x: a.cx, y: a.cy };
  var sx = dx !== 0 ? a.hw / Math.abs(dx) : Infinity;
  var sy = dy !== 0 ? a.hh / Math.abs(dy) : Infinity;
  var t = Math.min(sx, sy);
  return { x: a.cx + dx * t, y: a.cy + dy * t };
}
// How far to pull the shaft back from the tip so it doesn't poke through the head.
export function headInset(kind, s) {
  if (kind === 'none' || kind === 'open' || kind === 'bar') return 0;
  if (kind === 'diamond') return 2 * s;
  if (kind === 'circle') return 2 * (0.42 * s);
  return s * 0.9; // triangle / default
}
// One arrowhead at `tip` pointing along unit (ux,uy). All export-safe geometry.
export function arrowHead(tip, ux, uy, s, fill, kind, w) {
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
export function renderArrows(rawArrows, nodeById, layerById, bg, bb, S) {
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
