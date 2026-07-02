// SPDX-License-Identifier: MPL-2.0
// Card geometry + rendering, the normalised node model, and the shared tree build
// (parent/child linking used by the org / mindmap layouts).
import { color, esc, f2, inkOn, maxCharsFor, num, slug, trim, wrapLines } from './util.js';
import { roundedRectPath, textEl } from './svg.js';

// ── card geometry ──────────────────────────────────────────────────────────────
function rectRx(shape, w, h, S) {
  var lim = Math.min(w, h) / 2;
  if (shape === 'pill') return lim;
  if (shape === 'box') return Math.min(4, lim);
  return Math.min(S ? S.cornerRadius : 14, lim); // rounded
}
export function computeCardH(S, lines, hasDetail) {
  return Math.max(Math.round(40 * S.scale), S.cardPadV * 2 + (S.imgBand || 0) + lines * S.labelLH + (hasDetail ? S.detailLH + 3 : 0));
}

// Render one card <g> with a click-to-focus hook (focuses block `idx` of `nodes`).
export function renderCard(n, S) {
  var rx = rectRx(n.shape, n.w, n.h, S);
  var fill = color(n.fill, S.nodeFill);
  var cx = n.x + n.w / 2;
  var bw = S.cardBorderWidth;

  var g = '<g data-canvas-input="nodes:' + n.idx + '">';
  g += '<path d="' + roundedRectPath(n.x, n.y, n.w, n.h, rx) + '" fill="' + esc(fill) + '"'
    + (bw > 0 ? ' stroke="' + esc(S.nodeStroke) + '" stroke-width="' + f2(bw) + '"' : '') + '/>';

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

  var lines = wrapLines(n.label, maxCharsFor(n.w, S.labelSize), S.labelLines);
  var detail = trim(n.detail);
  if (detail) {
    var dl = wrapLines(detail, maxCharsFor(n.w, S.detailSize), 1);
    detail = dl.length ? dl[0] : '';
  }
  var blockH = lines.length * S.labelLH + (detail ? S.detailLH + 3 : 0);
  var top;
  if (S.imgBand > 0) {
    var textTop = n.y + S.cardPadV + S.imgH + S.imgGap;
    var region = (n.y + n.h - S.cardPadV) - textTop;
    top = textTop + Math.max(0, (region - blockH) / 2);
  } else {
    top = n.y + (n.h - blockH) / 2;
  }
  var ink = inkOn(fill, S.nodeText), dink = inkOn(fill, S.detailColor);
  for (var i = 0; i < lines.length; i++) {
    g += textEl(cx, top + i * S.labelLH + S.labelSize * 0.8, lines[i], S.labelSize, 500, ink, 'middle');
  }
  if (detail) {
    g += textEl(cx, top + lines.length * S.labelLH + S.detailSize * 0.8 + 3, detail, S.detailSize, 400, dink, 'middle');
  }
  return g + '</g>';
}

// ── normalise the nodes list (assign ids, dedupe, carry per-type fields) ─────────
export function normaliseNodes(rawNodes) {
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
    nodes.push({
      idx: i, id: id,
      shape: (b.shape === 'box' || b.shape === 'pill') ? b.shape : 'rounded',
      label: label, detail: detail,
      parentId: slug(b.parent), layerId: slug(b.layer),
      fill: trim(b.fill),
      image: imgUrl,
      _imgIsSvg: !!(ref && (ref.type === 'vector' || ref.format === 'svg' || /\.svg(\?|$)/i.test(imgUrl))),
      _imgAspect: 0,
      quadrant: slug(b.quadrant),
      score: (Array.isArray(b.score) && b.score.length === 2 && isFinite(b.score[0]) && isFinite(b.score[1])) ? b.score : null,
      _start: num(b.ganttStart, NaN), _len: num(b.ganttLen, NaN),
      x: 0, y: 0, w: 0, h: 0
    });
  });
  return nodes;
}

// ── shared tree build (org / tree-LR / mindmap) ──────────────────────────────────
export function buildTree(nodes) {
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
