// SPDX-License-Identifier: MPL-2.0
// Sequence/axis-based layouts: process (ranked flow), timeline, cycle, pyramid /
// funnel, matrix (2x2 quadrant), and gantt / roadmap.
import { arr, clamp, color, esc, f2, inkOn, lerp, maxCharsFor, quadFromText, slug, textWidth, trim, wrapLines } from './util.js';
import { circlePath, roundedRectPath, shaft, textEl, trapezoidPath } from './svg.js';
import { arrowHead, borderPoint, headInset } from './arrows.js';

// ── process layout: ranked flow (a DAG layered by longest path) ──────────────────
export function layoutProcess(nodes, rawArrows, S, dir) {
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
export function layoutTimeline(nodes, S, dir, bb) {
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
export function layoutCycle(nodes, S, inp, bb) {
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
        // collapse onto the same arc — fall back to a per-edge horizontal offset.
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
export function layoutPyramid(nodes, S, style, bb) {
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
export function layoutMatrix(nodes, S, inp, bb) {
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

// ── gantt / roadmap layout: time-axis bars ───────────────────────────────────────
export function layoutGantt(nodes, S, inp, bb) {
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
    lab.forEach(function (line, li) { behind += textEl(gutter - 10, ly + li * S.labelLH, line, S.labelSize, 500, S.nodeText, 'end'); });
    if (trim(n.detail) && barW > textWidth(n.detail, S.detailSize) + 12) behind += textEl(barX + barW / 2, rowY + rowH / 2 + S.detailSize * 0.3, n.detail, S.detailSize, 400, inkOn(fill, S.nodeText), 'middle');
  });
  bb.add(0, 0, gutter, totalH);
  return { autoEdges: [], bands: [], layerById: {}, behind: behind, skipCards: true };
}
