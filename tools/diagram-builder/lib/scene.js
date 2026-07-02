// SPDX-License-Identifier: MPL-2.0
// ── compose the whole scene ───────────────────────────────────────────────────────
import { PINE, WHITE, DETAIL, THEMES, BAND_PALETTE, VALID_TYPES } from './constants.js';
import { arr, clamp, color, esc, estLineCount, f2, inkOn, maxCharsFor, num, textWidth, trim, wrapLines } from './util.js';
import { bounds, gridBg, placeholder, roundedRectPath, textEl } from './svg.js';
import { resolveImage } from './images.js';
import { computeCardH, normaliseNodes, renderCard } from './shapes.js';
import { layoutMindmap, layoutOrg } from './layout-tree.js';
import { layoutKanban, layoutLayercake } from './layout-groups.js';
import { layoutCycle, layoutGantt, layoutMatrix, layoutProcess, layoutPyramid, layoutTimeline } from './layout-sequence.js';
import { renderArrows } from './arrows.js';
import { parseDsl } from './parse-dsl.js';
import { parseMermaid } from './parse-mermaid.js';
import { parseTable } from './parse-table.js';
import { parseAscii } from './parse-ascii.js';

export async function buildDiagram(inp, host) {
  var mode = VALID_TYPES[inp.diagramType] ? inp.diagramType : 'org';
  var source = ['text', 'ascii', 'mermaid', 'table'].indexOf(inp.source) >= 0 ? inp.source : 'visual';
  var bg = color(inp.background, WHITE);

  var src, asciiPos = null, overrideDir = null;
  if (source === 'text') src = parseDsl(inp.dsl, mode);
  else if (source === 'ascii') { var pa = parseAscii(inp.asciiArt); src = { nodes: pa.nodes, layers: [], arrows: pa.arrows }; asciiPos = pa.pos; }
  else if (source === 'mermaid') { var pm = parseMermaid(inp.mermaid, host); src = { nodes: pm.nodes, layers: pm.layers, arrows: pm.arrows }; if (VALID_TYPES[pm.diagramType]) mode = pm.diagramType; overrideDir = pm.dir; }
  else if (source === 'table') src = parseTable(inp.table, mode);
  else src = { nodes: arr(inp.nodes), layers: arr(inp.layers), arrows: arr(inp.arrows) };

  var nodes = normaliseNodes(src.nodes);
  if (!nodes.length) return placeholder(mode, source === 'visual' ? null : source);

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
    cardH: 46, labelLines: 1, imgBand: 0
  };

  // Reserve a uniform image band when any card carries an image; embed + measure.
  var anyImage = nodes.some(function (n) { return n.image; });
  S.imgBand = anyImage ? (S.imgH + S.imgGap) : 0;
  if (anyImage) {
    await Promise.all(nodes.filter(function (n) { return n.image; }).map(function (n) {
      return resolveImage(n.image).then(function (r) { n.image = r.dataUrl; n._imgAspect = r.aspect; }, function () { });
    }));
  }

  var bb = bounds();
  var layout;

  // cardH (uniform) — computed up front from the active reference width; layercake
  // sets its own (per-band widths vary) and ascii preserves the drawn boxes.
  function setCardH(refW) {
    var mc = maxCharsFor(refW, S.labelSize);
    S.labelLines = nodes.some(function (n) { return estLineCount(n.label, mc) > 1; }) ? 2 : 1;
    var hd = nodes.some(function (n) { return trim(n.detail); });
    S.cardH = computeCardH(S, S.labelLines, hd);
  }

  if (source === 'ascii') {
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
    layout = layoutGantt(nodes, S, inp, bb);
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
    if (arrows.unresolved) host.log('warn', 'diagram-builder: ' + arrows.unresolved + ' arrow(s) skipped — unresolved From/To ID');
    if (arrows.degenerate) host.log('warn', 'diagram-builder: ' + arrows.degenerate + ' arrow(s) skipped — endpoints coincide or one contains the other');
  }

  if (bb.empty()) bb.add(0, 0, 1200, 760);

  var title = trim(inp.title), titleH = title ? 50 : 0;
  var contentMinY = bb.minY, contentCx = bb.minX + (bb.maxX - bb.minX) / 2;
  if (title) { var tw = textWidth(title, 26); bb.add(contentCx - tw / 2, contentMinY, tw, 0); }

  var pad = clamp(num(inp.canvasPadding, 44), 0, 200);
  var vbX = bb.minX - pad, vbY = contentMinY - pad - titleH;
  var vbW = (bb.maxX - bb.minX) + pad * 2, vbH = (bb.maxY - contentMinY) + pad * 2 + titleH;

  var out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + f2(vbX) + ' ' + f2(vbY) + ' ' + f2(vbW) + ' ' + f2(vbH) + '"'
    + ' width="' + f2(vbW) + '" height="' + f2(vbH) + '"'
    + ' style="width:100%;height:auto;max-height:100%;display:block;" preserveAspectRatio="xMidYMid meet">';
  if (bg !== 'transparent') out += '<rect x="' + f2(vbX) + '" y="' + f2(vbY) + '" width="' + f2(vbW) + '" height="' + f2(vbH) + '" fill="' + esc(bg) + '"/>';
  out += gridBg(inp.gridBg, vbX, vbY, vbW, vbH, S.nodeStroke);
  out += bandsSvg + (layout.behind || '') + edgesSvg + cardsSvg + (layout.front || '') + arrows.svg;
  if (title) out += textEl(contentCx, contentMinY - pad - titleH / 2 + 10, title, 26, 600, theme ? theme.nodeText : PINE, 'middle');
  out += '</svg>';
  return out;
}
