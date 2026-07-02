// SPDX-License-Identifier: MPL-2.0
// Hierarchy-based layouts: org / tree, and mindmap.
import { f2, trim } from './util.js';
import { buildTree } from './shapes.js';

// ── org / tree layout: tidy tree, top-down (dir 'down') or left-to-right ('right') ──
export function layoutOrg(nodes, S, dir) {
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
export function layoutMindmap(nodes, S, inp) {
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
