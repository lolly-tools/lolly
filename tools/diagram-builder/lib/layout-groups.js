// SPDX-License-Identifier: MPL-2.0
// Group/band-based layouts: layercake (stacked bands) and kanban (side-by-side columns).
import { arr, clamp, color, estLineCount, maxCharsFor, slug, textWidth, titleize, trim } from './util.js';
import { FOG } from './constants.js';
import { computeCardH } from './shapes.js';

// ── layercake layout: stacked layer bands ───────────────────────────────────────
export function layoutLayercake(nodes, rawLayers, S) {
  var layers = [], layerById = {};
  rawLayers.forEach(function (b, i) {
    if (!b) return;
    // slug(layerId) || slug(label) || ordinal — mirrors the shell reference picker
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
  // to the busiest band — so a sparse layercake isn't stretched to a fixed width.
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
export function layoutKanban(nodes, rawColumns, S, inp) {
  var cols = [], byId = {};
  arr(rawColumns).forEach(function (b, i) {
    if (!b) return;
    // slug(layerId) || slug(label) || ordinal — mirror the shell picker (deriveBlockKeys).
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
