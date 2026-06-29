/* global onInit, onInput, host */

/**
 * Diagram Builder — org charts + layered "layercake" architecture diagrams.
 *
 * SVG-rooted tool: the whole scene is built as an <svg> STRING here and rendered
 * verbatim by the template ({{{diagramSvg}}}). Layout is pure JS, so it renders
 * identically in the browser and headless in the CLI. The one browser-only touch is
 * optional card images (headshot / icon / logo): in a browser they're embedded as a
 * self-contained data URL and measured for aspect; headless degrades gracefully.
 *
 * Two modes share one set of card/arrow primitives:
 *   • org       — a tidy top-down tree laid out from each card's `parent` (ID ref).
 *                 Structural connectors are AUTO elbow lines parent→child.
 *   • layercake — cards stacked into horizontal layer bands (`layers`, top→bottom),
 *                 each card assigned to a band by its `layer` (ID ref).
 * On top of either, an optional `arrows` list draws explicit flow arrows by ID.
 *
 * Why ID references (not row indexes): blocks don't nest and a block `select`
 * can't read sibling rows, so a card can't pick its parent/layer from a live list.
 * Indexes would silently corrupt on drag-reorder/delete, so every link is a
 * free-text ID resolved here. Unknown refs degrade gracefully (orphan→root,
 * unresolved arrow→skipped+logged) rather than throwing.
 *
 * EXPORT SAFETY (the PDF/EMF walkers are a strict subset, and — verified against
 * shells/web/src/bridge/export.js — the PDF <rect> branch is FILL-ONLY and the
 * PDF <path> branch only honours paint declared as that element's OWN attribute,
 * never group inheritance or computed CSS). So:
 *   - Cards and bands are drawn as <path> (rounded-rect via M/L/C/Z), NOT <rect>,
 *     with fill AND stroke set as own attributes — so borders survive PDF.
 *   - Connectors carry their own stroke attribute (no reliance on a <g> stroke).
 *   - Dashed arrows are real <line> segments (geometry), not stroke-dasharray,
 *     which the PDF line branch ignores.
 *   - Arrowheads are filled <path> triangles whose vertices are computed here
 *     (never <marker>/marker-end, which PDF/EMF drop).
 *   - No <polygon>/<polyline>/<ellipse>, gradients, leaf transforms, or
 *     dominant-baseline. Every user string is escaped; every colour validated.
 */

// ── SUSE palette (canonical: shells/web/src/palette.js) ───────────────────────
var PINE = '#0c322c', FOG = '#efefef', WHITE = '#ffffff', DETAIL = '#6f6f6f'; // Fog 4

// ── small helpers ─────────────────────────────────────────────────────────────
function inputsFrom(model) { var o = {}; model.forEach(function (i) { o[i.id] = i.value; }); return o; }
function num(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function f2(v) { return Math.round(v * 100) / 100; }
function arr(v) { return Array.isArray(v) ? v : []; }
function trim(v) { return String(v == null ? '' : v).trim(); }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// A safe-ish CSS colour, or a fallback — keeps stray input (e.g. a crafted share
// URL) out of raw fill=/stroke= attributes. Mirrors the sibling filter tools.
function color(v, fallback) {
  var s = (typeof v === 'string' ? v : '').trim();
  if (s.toLowerCase() === 'transparent') return 'transparent';
  return /^#[0-9a-f]{3,8}$/i.test(s) || /^(rgb|hsl)a?\([\d%.,\s/]+\)$/i.test(s) ? s : fallback;
}
function slug(s) { return trim(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

// Greedy word-wrap into at most `maxLines` lines of ~maxChars each; a too-long
// single word is hard-truncated; overflow gets an ellipsis on the last line.
function wrapLines(text, maxChars, maxLines) {
  maxChars = Math.max(4, Math.floor(maxChars));
  var words = trim(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  var lines = [], cur = '', i = 0;
  for (; i < words.length; i++) {
    var w = words[i];
    if (w.length > maxChars) w = w.slice(0, Math.max(1, maxChars - 1)) + '…';
    var cand = cur ? cur + ' ' + w : w;
    if (!cur || cand.length <= maxChars) { cur = cand; }
    else {
      lines.push(cur); cur = w;
      if (lines.length === maxLines) { cur = ''; break; }
    }
  }
  if (cur) lines.push(cur);
  if ((i < words.length) || lines.length > maxLines) {
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
function estLineCount(text, maxChars) { return wrapLines(text, maxChars, 6).length; }
function maxCharsFor(width, fontSize) { return Math.max(4, Math.floor((width - 18) / (fontSize * 0.56))); }
function textWidth(str, fontSize) { return String(str).length * fontSize * 0.62; } // rough advance

// ── SVG primitives (baseline computed; no dominant-baseline for export safety) ──
var FONT = "SUSE, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
function textEl(x, y, str, size, weight, fill, anchor) {
  return '<text x="' + f2(x) + '" y="' + f2(y) + '" font-family="' + FONT + '"'
    + ' font-size="' + size + '" font-weight="' + weight + '" fill="' + esc(fill) + '"'
    + ' text-anchor="' + (anchor || 'middle') + '">' + esc(str) + '</text>';
}
// Rounded-rect as a path (M/L/C/Z only — every command is honoured by the PDF
// and EMF walkers, unlike <rect rx> whose stroke is dropped in PDF). r is clamped.
function roundedRectPath(x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  var x2 = x + w, y2 = y + h;
  if (r <= 0.01) {
    return 'M' + f2(x) + ' ' + f2(y) + 'L' + f2(x2) + ' ' + f2(y)
      + 'L' + f2(x2) + ' ' + f2(y2) + 'L' + f2(x) + ' ' + f2(y2) + 'Z';
  }
  var k = r * 0.5523; // cubic approximation of a quarter circle
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
// A straight or dashed run between two points, as real <line> geometry.
function shaft(x1, y1, x2, y2, dashed, col, width) {
  var len = Math.hypot(x2 - x1, y2 - y1);
  if (len < 0.5) return '';
  if (!dashed) {
    return '<line x1="' + f2(x1) + '" y1="' + f2(y1) + '" x2="' + f2(x2) + '" y2="' + f2(y2)
      + '" stroke="' + esc(col) + '" stroke-width="' + width + '"/>';
  }
  var ux = (x2 - x1) / len, uy = (y2 - y1) / len, dash = 8, gap = 5, out = '', pos = 0;
  while (pos < len) {
    var a = pos, b = Math.min(pos + dash, len);
    out += '<line x1="' + f2(x1 + ux * a) + '" y1="' + f2(y1 + uy * a) + '" x2="' + f2(x1 + ux * b)
      + '" y2="' + f2(y1 + uy * b) + '" stroke="' + esc(col) + '" stroke-width="' + width + '"/>';
    pos += dash + gap;
  }
  return out;
}

// ── card images: embed as a data URL (so the image is self-contained in EVERY
// export — SVG/PNG/PDF) and measure its aspect (the PDF raster path fills the box
// rather than letterboxing, so the box must match the image's own aspect). All
// browser-only; headless resolves to the bare url + aspect 0 (square fallback).
var _imgCache = {};
function resolveImage(url) {
  if (_imgCache[url]) return _imgCache[url];
  var p = (async function () {
    var dataUrl = url, aspect = 0;
    try {
      if (typeof fetch !== 'undefined' && String(url).indexOf('data:') !== 0) {
        var blob = await (await fetch(url)).blob();
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
var LABEL_SIZE = 15, LABEL_LH = 20, DETAIL_SIZE = 12, DETAIL_LH = 16, CARD_PAD_V = 12;
var IMG_H = 52, IMG_GAP = 10; // top image band reserved on every card when any card has an image

function rectRx(shape, w, h) {
  var lim = Math.min(w, h) / 2;
  if (shape === 'pill') return lim;
  if (shape === 'rounded') return Math.min(14, lim);
  return Math.min(4, lim); // box
}

// Render one card <g> with a click-to-focus hook (focuses block `idx` of `nodes`).
function renderCard(n, S) {
  var rx = rectRx(n.shape, n.w, n.h);
  var fill = color(n.fill, S.nodeFill);
  var cx = n.x + n.w / 2;

  var g = '<g data-canvas-input="nodes:' + n.idx + '">';
  // Card body as a stroked path so the border survives PDF export.
  g += '<path d="' + roundedRectPath(n.x, n.y, n.w, n.h, rx) + '" fill="' + esc(fill)
    + '" stroke="' + esc(S.nodeStroke) + '" stroke-width="1.5"/>';

  // Optional image (headshot / icon / logo) in a reserved top band; text sits below.
  // Raster boxes are sized to the measured aspect (the PDF raster path fills the box,
  // so a mismatched box would stretch it); SVG/unknown use the full band + meet-fit.
  if (n.image && S.imgBand > 0) {
    var areaW = Math.max(8, n.w - CARD_PAD_V * 2), areaH = IMG_H;
    var dispW = areaW, dispH = areaH;
    if (!n._imgIsSvg && n._imgAspect > 0) {
      var bw = areaH * n._imgAspect;
      if (bw <= areaW) { dispH = areaH; dispW = bw; } else { dispW = areaW; dispH = areaW / n._imgAspect; }
    }
    var imgX = n.x + (n.w - dispW) / 2, imgY = n.y + CARD_PAD_V + (areaH - dispH) / 2;
    g += '<image href="' + esc(n.image) + '" x="' + f2(imgX) + '" y="' + f2(imgY) + '"'
      + ' width="' + f2(dispW) + '" height="' + f2(dispH) + '" preserveAspectRatio="xMidYMid meet"/>';
  }

  var lines = wrapLines(n.label, maxCharsFor(n.w, LABEL_SIZE), S.labelLines);
  var detail = trim(n.detail);
  if (detail) {
    var dl = wrapLines(detail, maxCharsFor(n.w, DETAIL_SIZE), 1);
    detail = dl.length ? dl[0] : '';
  }
  var blockH = lines.length * LABEL_LH + (detail ? DETAIL_LH + 3 : 0);
  // With an image band, text is centred in the region BELOW it (so baselines line up
  // across imaged and image-less cards in the same row); otherwise centred in the card.
  var top;
  if (S.imgBand > 0) {
    var textTop = n.y + CARD_PAD_V + IMG_H + IMG_GAP;
    var region = (n.y + n.h - CARD_PAD_V) - textTop;
    top = textTop + Math.max(0, (region - blockH) / 2);
  } else {
    top = n.y + (n.h - blockH) / 2;
  }
  for (var i = 0; i < lines.length; i++) {
    g += textEl(cx, top + i * LABEL_LH + LABEL_SIZE * 0.8, lines[i], LABEL_SIZE, 500, S.nodeText, 'middle');
  }
  if (detail) {
    g += textEl(cx, top + lines.length * LABEL_LH + DETAIL_SIZE * 0.8 + 3, detail, DETAIL_SIZE, 400, S.detailColor, 'middle');
  }
  return g + '</g>';
}

// ── normalise the nodes list (assign ids, dedupe) ──────────────────────────────
function normaliseNodes(rawNodes) {
  var nodes = [], used = {};
  rawNodes.forEach(function (b, i) {
    if (!b) return;
    var label = trim(b.label);
    var detail = trim(b.detail);
    var id = slug(b.nodeId) || slug(label) || ('node-' + (i + 1));
    if (used[id]) { var k = 2; while (used[id + '-' + k]) k++; id = id + '-' + k; } // dedupe
    used[id] = 1;
    var ref = b.image; // resolved asset ref { url, type, format, meta } — visual editor only
    var imgUrl = (ref && ref.url) ? ref.url : '';
    nodes.push({
      idx: i, id: id,
      shape: (b.shape === 'box' || b.shape === 'pill') ? b.shape : 'rounded',
      label: label, detail: detail,
      parentId: slug(b.parent), layerId: slug(b.layer),
      fill: trim(b.fill),
      image: imgUrl,
      _imgIsSvg: !!(ref && (ref.type === 'vector' || ref.format === 'svg' || /\.svg(\?|$)/i.test(imgUrl))),
      _imgAspect: 0,
      x: 0, y: 0, w: 0, h: 0
    });
  });
  return nodes;
}

// ── org layout: tidy top-down tree ──────────────────────────────────────────────
function layoutOrg(nodes, S) {
  var cardW = 196, hGap = 30, vGap = 56;
  var byId = {};
  nodes.forEach(function (n) { if (n.id && byId[n.id] === undefined) byId[n.id] = n; });
  nodes.forEach(function (n) { n._children = []; });
  nodes.forEach(function (n) {
    var p = (n.parentId && byId[n.parentId] !== undefined && byId[n.parentId] !== n) ? byId[n.parentId] : null;
    n._parent = p;
  });
  nodes.forEach(function (n) { if (n._parent) n._parent._children.push(n); });

  // Roots + cycle break: anything unreachable from a root (a parent loop) is
  // detached and promoted to a root so layout always terminates.
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

  // Iterative post-order placement (no recursion → no stack blow-up on a long
  // parent chain): assign y by depth on the way down, x on the way up — leaves
  // take sequential slots left→right, parents centre over their children.
  var cardH = S.cardH, slot = 0;
  roots.forEach(function (r, ri) {
    if (ri > 0) slot++; // a blank slot of separation between root subtrees
    var st = [{ n: r, depth: 0, done: false }];
    while (st.length) {
      var f = st[st.length - 1], n = f.n;
      if (!f.done) {
        n.w = cardW; n.h = cardH; n.y = f.depth * (cardH + vGap);
        f.done = true;
        for (var i = n._children.length - 1; i >= 0; i--) st.push({ n: n._children[i], depth: f.depth + 1, done: false });
      } else {
        st.pop();
        if (!n._children.length) { n.x = slot * (cardW + hGap); slot++; }
        else { n.x = (n._children[0].x + n._children[n._children.length - 1].x) / 2; }
      }
    }
  });

  // Auto connectors: elbow parent→child, each carrying its own stroke (M/L only).
  var edges = [];
  nodes.forEach(function (n) {
    if (!n._parent) return;
    var p = n._parent;
    var px = p.x + p.w / 2, py = p.y + p.h, cxx = n.x + n.w / 2, cy = n.y;
    var midY = (py + cy) / 2;
    edges.push('M' + f2(px) + ' ' + f2(py) + 'L' + f2(px) + ' ' + f2(midY)
      + 'L' + f2(cxx) + ' ' + f2(midY) + 'L' + f2(cxx) + ' ' + f2(cy));
  });
  return { autoEdges: edges, bands: [], layerById: {} };
}

// ── layercake layout: stacked layer bands ───────────────────────────────────────
function layoutLayercake(nodes, rawLayers, S) {
  var layers = [], layerById = {};
  rawLayers.forEach(function (b, i) {
    if (!b) return;
    var id = slug(b.layerId) || ('layer-' + (i + 1));
    if (layerById[id] !== undefined) return; // first wins on dupe id
    var L = { idx: i, id: id, label: trim(b.label) || id, bandFill: color(b.bandFill, FOG), _cards: [] };
    layerById[id] = L; layers.push(L);
  });
  // Referenced-but-undefined layers → implicit bands (appended in first-seen order).
  nodes.forEach(function (n) {
    if (n.layerId && layerById[n.layerId] === undefined) {
      var L = { idx: layers.length, id: n.layerId, label: n.layerId, bandFill: FOG, _cards: [] };
      layerById[n.layerId] = L; layers.push(L);
    }
  });
  // Unassigned cards → a trailing band, only if any exist.
  var unassigned = null;
  nodes.forEach(function (n) {
    var L = (n.layerId && layerById[n.layerId] !== undefined) ? layerById[n.layerId] : null;
    if (!L) {
      if (!unassigned) {
        unassigned = { idx: layers.length, id: '__unassigned__', label: 'Unassigned', bandFill: FOG, _cards: [] };
        layers.push(unassigned);
      }
      L = unassigned;
    }
    L._cards.push(n);
  });

  var gutter = 168, padX = 20, padY = 18, bandGap = 16, cardGap = 16, innerW = 1120;
  function cwFor(n) { return n > 0 ? Math.max(1, Math.min(264, (innerW - cardGap * (n - 1)) / n)) : 264; }

  // Card height is uniform; size it from the TIGHTEST band so a label that wraps
  // to two lines at its (possibly narrow) width is never silently truncated.
  var maxLines = 1, hasDetail = false;
  layers.forEach(function (L) {
    L._cw = cwFor(L._cards.length);
    L._cards.forEach(function (c) {
      if (estLineCount(c.label, maxCharsFor(L._cw, LABEL_SIZE)) > 1) maxLines = 2;
      if (trim(c.detail)) hasDetail = true;
    });
  });
  var cardH = Math.max(46, CARD_PAD_V * 2 + (S.imgBand || 0) + maxLines * LABEL_LH + (hasDetail ? DETAIL_LH + 3 : 0));
  S.cardH = cardH; S.labelLines = maxLines;

  var bandH = cardH + padY * 2, y = 0, maxRight = gutter + innerW + padX;
  layers.forEach(function (L) {
    L.x = 0; L.y = y; L.h = bandH;
    var cards = L._cards, n = cards.length, cw = L._cw;
    if (n > 0) {
      var areaX = gutter + padX, areaW = innerW;
      var totalW = cw * n + cardGap * (n - 1);
      var startX = areaX + Math.max(0, (areaW - totalW) / 2);
      cards.forEach(function (c, ci) { c.w = cw; c.h = cardH; c.x = startX + ci * (cw + cardGap); c.y = y + padY; });
      var right = startX + totalW;
      if (right > maxRight) maxRight = right; // dense bands overflow innerW
    }
    y += bandH + bandGap;
  });
  // Uniform band width that always encloses the widest band's cards.
  var bandW = Math.max(gutter + innerW + padX * 2, maxRight + padX);
  layers.forEach(function (L) { L.w = bandW; });

  return { autoEdges: [], bands: layers, layerById: layerById, gutter: gutter };
}

// ── process layout: ranked flow (a DAG layered by longest path) ──────────────────
// Steps are positioned by their distance from a start node; the explicit `arrows`
// list IS the flow and is drawn by renderArrows (no auto connectors). dir 'right'
// lays ranks left→right (siblings spread vertically); otherwise 'down' top→bottom
// (siblings spread horizontally). Cycle-safe: ranks are relaxed a bounded number of
// times and capped, so a loop can't run the layout away.
function layoutProcess(nodes, rawArrows, S, dir) {
  var byId = {};
  nodes.forEach(function (n) { if (byId[n.id] === undefined) byId[n.id] = n; });

  // Real edges only (both endpoints resolve to distinct cards).
  var edges = [];
  arr(rawArrows).forEach(function (a) {
    if (!a) return;
    var f = slug(a.from), t = slug(a.to);
    if (byId[f] === undefined || byId[t] === undefined || f === t) return;
    edges.push([f, t]);
  });

  // Longest-path ranking by bounded relaxation (|nodes| passes max → cycle-safe).
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

  // Bucket by rank, preserving input order within a rank.
  var ranks = {};
  nodes.forEach(function (n) { (ranks[rank[n.id]] || (ranks[rank[n.id]] = [])).push(n); });
  var keys = Object.keys(ranks).map(Number).sort(function (a, b) { return a - b; });

  var cardW = 200, cardH = S.cardH, right = dir === 'right';
  var mainGap = right ? 88 : 72;    // gap between ranks (along the flow)
  var crossGap = right ? 26 : 40;   // gap between siblings within a rank
  keys.forEach(function (rk, ri) {
    var row = ranks[rk], n = row.length;
    var crossSize = right ? cardH : cardW;
    var start = -(n * crossSize + crossGap * (n - 1)) / 2;   // centre the rank on 0
    row.forEach(function (c, ci) {
      c.w = cardW; c.h = cardH;
      var cross = start + ci * (crossSize + crossGap);
      var main = ri * ((right ? cardW : cardH) + mainGap);
      if (right) { c.x = main; c.y = cross; } else { c.x = cross; c.y = main; }
    });
  });

  return { autoEdges: [], bands: [], layerById: {} };
}

// ── explicit arrows ──────────────────────────────────────────────────────────────
function anchorOf(id, nodeById, layerById) {
  var n = nodeById[id];
  if (n) return { cx: n.x + n.w / 2, cy: n.y + n.h / 2, hw: n.w / 2, hh: n.h / 2 };
  var L = layerById[id];
  if (L && L.w != null) return { cx: L.x + L.w / 2, cy: L.y + L.h / 2, hw: L.w / 2, hh: L.h / 2 };
  return null;
}
// True if either box fully contains the other (e.g. a card inside its own band).
function nested(a, b) {
  function inside(o, i) {
    return (o.cx - o.hw <= i.cx - i.hw + 0.5) && (i.cx + i.hw <= o.cx + o.hw + 0.5)
      && (o.cy - o.hh <= i.cy - i.hh + 0.5) && (i.cy + i.hh <= o.cy + o.hh + 0.5);
  }
  return inside(a, b) || inside(b, a);
}
// Point where the ray from box centre toward (tx,ty) crosses the box border.
function borderPoint(a, tx, ty) {
  var dx = tx - a.cx, dy = ty - a.cy;
  if (dx === 0 && dy === 0) return { x: a.cx, y: a.cy };
  var sx = dx !== 0 ? a.hw / Math.abs(dx) : Infinity;
  var sy = dy !== 0 ? a.hh / Math.abs(dy) : Infinity;
  var t = Math.min(sx, sy);
  return { x: a.cx + dx * t, y: a.cy + dy * t };
}
function arrowHead(tip, ux, uy, size, fill) {
  var bx = tip.x - ux * size, by = tip.y - uy * size, pxp = -uy, pyp = ux, hw = size * 0.52;
  return '<path d="M' + f2(tip.x) + ' ' + f2(tip.y) + 'L' + f2(bx + pxp * hw) + ' ' + f2(by + pyp * hw)
    + 'L' + f2(bx - pxp * hw) + ' ' + f2(by - pyp * hw) + 'Z" fill="' + esc(fill) + '"/>';
}
// Draws arrows; merges arrowhead/label extents into bb so nothing clips.
function renderArrows(rawArrows, nodeById, layerById, bg, bb) {
  var lines = '', heads = '', labels = '', unresolved = 0, degenerate = 0;
  rawArrows.forEach(function (b) {
    if (!b) return;
    var A = anchorOf(slug(b.from), nodeById, layerById), B = anchorOf(slug(b.to), nodeById, layerById);
    if (!A || !B) { unresolved++; return; }
    if (nested(A, B)) { degenerate++; return; } // a card and its own band, etc.
    var p1 = borderPoint(A, B.cx, B.cy), p2 = borderPoint(B, A.cx, A.cy);
    var dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy);
    if (len < 1) { degenerate++; return; }
    var ux = dx / len, uy = dy / len, head = 11;
    var col = color(b.color, PINE);
    // Stop the shaft short of the tip so it doesn't poke through the arrowhead.
    var ex = p2.x - ux * (head * 0.9), ey = p2.y - uy * (head * 0.9);
    lines += shaft(p1.x, p1.y, ex, ey, b.style === 'dashed', col, 2);
    heads += arrowHead(p2, ux, uy, head, col);
    bb.add(p2.x, p2.y, 0, 0);
    var lab = trim(b.label);
    if (lab) {
      var mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      var lw = Math.max(12, textWidth(lab, 11.5)) + 12, lh = 19;
      var lx = mx - lw / 2, ly = my - lh / 2;
      labels += '<path d="' + roundedRectPath(lx, ly, lw, lh, 4) + '" fill="' + esc(bg === 'transparent' ? WHITE : bg)
        + '" stroke="' + esc(col) + '" stroke-width="1"/>';
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

function placeholder(msg) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760" width="1200" height="760"'
    + ' style="width:100%;height:auto;display:block;">'
    + '<rect width="100%" height="100%" fill="' + WHITE + '"/>'
    + '<path d="' + roundedRectPath(380, 300, 440, 160, 16) + '" fill="none" stroke="' + FOG + '" stroke-width="2"/>'
    + textEl(600, 390, msg, 22, 500, '#8a9a95', 'middle') + '</svg>';
}

// ── text DSL → raw {nodes, layers, arrows} (the same shape the blocks produce) ────
// Type-aware and forgiving: ORG uses indentation for hierarchy, LAYERCAKE uses '#'
// layer headings with cards listed below, PROCESS uses 'A -> B -> C' flow lines.
// Shared niceties: '::' adds a card subtitle, a trailing ' : text' labels an arrow,
// '//' (and, outside layercake, a leading '#') is a comment, and a leading -, * or •
// bullet is ignored. Parsed here, then fed through the EXACT same normaliseNodes +
// layout + renderArrows path as the visual editor — so output stays identical.
var BAND_PALETTE = ['#90ebcd', '#bff1ea', '#d8f3ec', '#efefef'];

function dslLines(text) { return String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n'); }
function isComment(t) { return !t || t.indexOf('//') === 0; }
function leadIndent(s) { var n = 0; for (var i = 0; i < s.length; i++) { var c = s.charAt(i); if (c === ' ') n++; else if (c === '\t') n += 4; else break; } return n; }
function stripBullet(s) { return s.replace(/^[-*•]\s+/, ''); }
function splitDetail(s) { var i = s.indexOf('::'); return i >= 0 ? { label: s.slice(0, i).trim(), detail: s.slice(i + 2).trim() } : { label: s.trim(), detail: '' }; }
function splitArrowLabel(s) { var m = s.match(/\s:\s+(.+)$/); return m ? { body: s.slice(0, m.index), label: m[1].trim() } : { body: s, label: '' }; }

// Push the arrows of a `A -> B -> C` chain. addNode (process) creates/returns a node
// id per endpoint; without it (org/layercake) endpoints resolve by slug to existing
// cards. A trailing ' : label' applies to the chain's last edge.
function collectArrows(content, arrows, addNode) {
  var al = splitArrowLabel(content);
  var parts = al.body.split('->').map(function (s) { return s.trim(); }).filter(Boolean);
  if (parts.length < 2) { if (addNode && parts.length === 1) addNode(parts[0]); return; }
  for (var i = 0; i < parts.length - 1; i++) {
    var aId = addNode ? addNode(parts[i]) : slug(splitDetail(parts[i]).label);
    var bId = addNode ? addNode(parts[i + 1]) : slug(splitDetail(parts[i + 1]).label);
    arrows.push({ from: aId, to: bId, label: (i === parts.length - 2 ? al.label : ''), style: 'solid', color: '' });
  }
}

function parseOrg(lines) {
  var nodes = [], arrows = [], used = {}, stack = [];
  function uid(label) { var b = slug(label) || 'node', id = b, k = 2; while (used[id]) { id = b + '-' + k; k++; } used[id] = 1; return id; }
  lines.forEach(function (raw) {
    var t = raw.trim();
    if (isComment(t) || t.charAt(0) === '#') return;
    if (t.indexOf('->') >= 0) { collectArrows(stripBullet(t), arrows, null); return; }
    var indent = leadIndent(raw), d = splitDetail(stripBullet(t));
    if (!d.label) return;
    var id = uid(d.label);
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    nodes.push({ shape: 'rounded', nodeId: id, label: d.label, detail: d.detail, parent: stack.length ? stack[stack.length - 1].id : '', layer: '', fill: '' });
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
    if (c.indexOf('->') >= 0) { collectArrows(c, arrows, null); return; }
    var d = splitDetail(c);
    if (!d.label) return;
    nodes.push({ shape: 'rounded', nodeId: uid(usedN, d.label, 'node'), label: d.label, detail: d.detail, parent: '', layer: cur, fill: '' });
  });
  return { nodes: nodes, layers: layers, arrows: arrows };
}

function parseProcess(lines) {
  var nodes = [], arrows = [], seen = {};
  function addNode(rawPart) {
    var d = splitDetail(rawPart), key = slug(d.label) || 'step';
    if (seen[key]) { if (d.detail && !seen[key].detail) seen[key].detail = d.detail; return key; } // a later line can annotate
    var node = { shape: 'rounded', nodeId: key, label: d.label, detail: d.detail, parent: '', layer: '', fill: '' };
    seen[key] = node; nodes.push(node);
    return key;
  }
  lines.forEach(function (raw) {
    var t = stripBullet(raw.trim());
    if (isComment(t) || t.charAt(0) === '#') return;
    if (t.indexOf('->') >= 0) collectArrows(t, arrows, addNode);
    else addNode(t);
  });
  return { nodes: nodes, layers: [], arrows: arrows };
}

function parseDsl(text, mode) {
  var lines = dslLines(text);
  if (mode === 'layercake') return parseLayercake(lines);
  if (mode === 'process') return parseProcess(lines);
  return parseOrg(lines);
}

// ── literal ASCII-art tracing → raw {nodes, arrows} + drawn positions ─────────────
// Detects +--+ / | | rectangles as cards, reads their interior text as label/detail,
// and walks the connecting - | + / \ runs (with > < ^ v arrowheads) into flow arrows.
// The drawn arrangement is PRESERVED — positions come straight from the character
// grid, then re-styled as clean cards: "what you sketch is where it goes".
function parseAscii(text) {
  var rows = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n').slice(0, 240);
  var H = rows.length, W = 0, i;
  for (i = 0; i < H; i++) { if (rows[i].length > W) W = rows[i].length; }
  W = Math.min(W, 400);
  function ch(r, c) { if (r < 0 || r >= H || c < 0) return ' '; var ln = rows[r]; return c < ln.length ? ln.charAt(c) : ' '; }
  function K(r, c) { return r + ',' + c; }

  // 1) rectangles: a '+' whose +--+ / | | / +--+ traces closed back to itself.
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

  // 2) interior text → label (first non-blank line) + detail (the rest joined).
  boxes.forEach(function (b) {
    var lines = [], s, rr2, cc2;
    for (rr2 = b.r0 + 1; rr2 < b.r1; rr2++) {
      s = '';
      for (cc2 = b.c0 + 1; cc2 < b.c1; cc2++) s += ch(rr2, cc2);
      s = s.trim();
      if (s) lines.push(s);
    }
    b.label = lines[0] || '';
    b.detail = lines.slice(1).join(' ');
  });

  // 3) nodes (stable slug ids) + drawn positions scaled from the grid.
  var CW = 11, CH = 26, nodes = [], pos = [], used = {};
  boxes.forEach(function (b, bi) {
    var base = slug(b.label) || ('box-' + (bi + 1)), id = base, k = 2;
    while (used[id]) { id = base + '-' + k; k++; }
    used[id] = 1; b.id = id;
    nodes.push({ shape: 'rounded', nodeId: id, label: b.label, detail: b.detail, parent: '', layer: '', fill: '' });
    pos.push({ x: b.c0 * CW, y: b.r0 * CH, w: Math.max(96, (b.c1 - b.c0) * CW), h: Math.max(44, (b.r1 - b.r0) * CH) });
  });

  // 4) connectors: 8-connected runs of wire chars (not owned by a box) become arrows
  // between the boxes they reach. A box is "reached" by touching (incl. diagonally)
  // OR across a single in-line space gap — diagrams routinely write "| a | -> | b |"
  // with padding. A > < ^ v head, if present, names the target end.
  function isWire(rr3, cc3) { var x = ch(rr3, cc3); return '-|+/\\><^v'.indexOf(x) >= 0 && owner[K(rr3, cc3)] === undefined; }
  function isHead(x) { return x === '>' || x === '<' || x === '^' || x === 'v'; }
  var OFF = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
  var CARD = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  function boxAt(pr, pc) {
    var d, o;
    for (d = 0; d < 8; d++) { o = owner[K(pr + OFF[d][0], pc + OFF[d][1])]; if (o !== undefined) return o; }
    for (d = 0; d < 4; d++) {                                  // across one space, in line
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
      arrows.push({ from: nodes[fromI].nodeId, to: nodes[toI].nodeId, label: '', style: 'solid', color: '' });
    }
  }
  return { nodes: nodes, arrows: arrows, pos: pos };
}

// ── compose the whole scene ─────────────────────────────────────────────────────
async function buildDiagram(inp) {
  var mode = (inp.diagramType === 'layercake' || inp.diagramType === 'process') ? inp.diagramType : 'org';
  var bg = color(inp.background, WHITE);
  var source = inp.source === 'text' ? 'text' : (inp.source === 'ascii' ? 'ascii' : 'visual');

  // Three ways in, ONE renderer. Visual blocks and the text DSL both parse to the
  // same raw {nodes,layers,arrows}; ASCII art additionally carries drawn positions
  // (its layout is the sketch itself), which we apply instead of running a layouter.
  var src, asciiPos = null;
  if (source === 'text') {
    src = parseDsl(inp.dsl, mode);
  } else if (source === 'ascii') {
    var pa = parseAscii(inp.asciiArt);
    src = { nodes: pa.nodes, layers: [], arrows: pa.arrows };
    asciiPos = pa.pos;
  } else {
    src = { nodes: arr(inp.nodes), layers: arr(inp.layers), arrows: arr(inp.arrows) };
  }

  var nodes = normaliseNodes(src.nodes);

  if (!nodes.length) {
    if (source === 'text') return placeholder('Type a diagram — the field shows the syntax');
    if (source === 'ascii') return placeholder('Draw boxes with +  -  | and arrows with ->  ^  v');
    return placeholder(mode === 'layercake' ? 'Add cards and layers to build your layercake'
      : mode === 'process' ? 'Add cards and flow arrows to build your process'
      : 'Add cards to build your org chart');
  }

  var S = {
    nodeFill: color(inp.nodeFill, WHITE),
    nodeStroke: color(inp.nodeStroke, PINE),
    nodeText: color(inp.nodeText, PINE),
    edgeColor: color(inp.edgeColor, PINE),
    detailColor: DETAIL,
    cardH: 46, labelLines: 1, imgBand: 0
  };

  // Reserve a uniform top image-band on every card when any card carries an image,
  // so rows (org), bands (layercake) and ranks (process) stay aligned. Embed each
  // image as a data URL and measure its aspect (browser only) before layout, since
  // the band height feeds cardH below.
  var anyImage = nodes.some(function (n) { return n.image; });
  S.imgBand = anyImage ? (IMG_H + IMG_GAP) : 0;
  if (anyImage) {
    await Promise.all(nodes.filter(function (n) { return n.image; }).map(function (n) {
      return resolveImage(n.image).then(function (r) { n.image = r.dataUrl; n._imgAspect = r.aspect; }, function () { });
    }));
  }

  var layout;
  if (source === 'ascii') {
    // Preserve the sketch: positions come straight from the grid (no layouter),
    // and labels may wrap to fit whatever box the user drew.
    S.labelLines = 3;
    nodes.forEach(function (n, i) { var p = asciiPos[i]; if (p) { n.x = p.x; n.y = p.y; n.w = p.w; n.h = p.h; } });
    layout = { autoEdges: [], bands: [], layerById: {} };
  } else if (mode === 'layercake') {
    layout = layoutLayercake(nodes, src.layers, S); // sets S.cardH / S.labelLines
  } else if (mode === 'process') {
    // process: ranked flow; uniform card width like org, so the wrap estimate is exact.
    var pChars = maxCharsFor(200, LABEL_SIZE);
    S.labelLines = nodes.some(function (n) { return estLineCount(n.label, pChars) > 1; }) ? 2 : 1;
    var pDetail = nodes.some(function (n) { return trim(n.detail); });
    S.cardH = Math.max(46, CARD_PAD_V * 2 + S.imgBand + S.labelLines * LABEL_LH + (pDetail ? DETAIL_LH + 3 : 0));
    layout = layoutProcess(nodes, src.arrows, S, inp.flowDir === 'right' ? 'right' : 'down');
  } else {
    // org: fixed card width, so the wrap estimate is exact up front.
    var orgChars = maxCharsFor(196, LABEL_SIZE);
    S.labelLines = nodes.some(function (n) { return estLineCount(n.label, orgChars) > 1; }) ? 2 : 1;
    var hasDetail = nodes.some(function (n) { return trim(n.detail); });
    S.cardH = Math.max(46, CARD_PAD_V * 2 + S.imgBand + S.labelLines * LABEL_LH + (hasDetail ? DETAIL_LH + 3 : 0));
    layout = layoutOrg(nodes, S);
  }

  var nodeById = {};
  nodes.forEach(function (n) { if (nodeById[n.id] === undefined) nodeById[n.id] = n; });

  var bandsSvg = '', cardsSvg = '', edgesSvg = '';
  var bb = bounds();

  // Bands (layercake) — drawn as rounded paths so corners survive PDF too.
  layout.bands.forEach(function (L) {
    bb.add(L.x, L.y, L.w, L.h);
    bandsSvg += '<path d="' + roundedRectPath(L.x, L.y, L.w, L.h, 10) + '" fill="' + esc(L.bandFill) + '"/>';
    var gw = (layout.gutter || 168) - 28; // clamp the band label to the gutter
    var llab = wrapLines(L.label, maxCharsFor(gw, 15), 1);
    if (llab.length) bandsSvg += textEl(L.x + 20, L.y + L.h / 2 + 5, llab[0], 15, 600, PINE, 'start');
  });

  // Auto connectors (org) — each path carries its own stroke (no <g> inheritance).
  layout.autoEdges.forEach(function (d) {
    edgesSvg += '<path d="' + d + '" fill="none" stroke="' + esc(S.edgeColor) + '" stroke-width="1.6"/>';
  });

  nodes.forEach(function (n) {
    if (!n.w || !n.h) { n.w = n.w || 196; n.h = n.h || S.cardH; } // safety for any unplaced node
    bb.add(n.x, n.y, n.w, n.h);
    cardsSvg += renderCard(n, S);
  });

  var arrows = renderArrows(src.arrows, nodeById, layout.layerById, bg, bb);
  if (host && host.log) {
    if (arrows.unresolved) host.log('warn', 'diagram-builder: ' + arrows.unresolved + ' arrow(s) skipped — unresolved From/To ID');
    if (arrows.degenerate) host.log('warn', 'diagram-builder: ' + arrows.degenerate + ' arrow(s) skipped — endpoints coincide or one contains the other');
  }

  if (bb.empty()) bb.add(0, 0, 1200, 760);

  // Title sits above the content; reserve a band for it AND widen the box to its
  // width so a long title isn't clipped left/right by the viewBox.
  var title = trim(inp.title);
  var titleH = title ? 50 : 0;
  var contentMinY = bb.minY, contentCx = bb.minX + (bb.maxX - bb.minX) / 2;
  if (title) {
    var tw = textWidth(title, 26);
    bb.add(contentCx - tw / 2, contentMinY, tw, 0);
  }

  var pad = 44;
  var vbX = bb.minX - pad;
  var vbY = contentMinY - pad - titleH;
  var vbW = (bb.maxX - bb.minX) + pad * 2;
  var vbH = (bb.maxY - contentMinY) + pad * 2 + titleH;

  var out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + f2(vbX) + ' ' + f2(vbY) + ' ' + f2(vbW) + ' ' + f2(vbH) + '"'
    + ' width="' + f2(vbW) + '" height="' + f2(vbH) + '"'
    + ' style="width:100%;height:auto;max-height:100%;display:block;" preserveAspectRatio="xMidYMid meet">';
  if (bg !== 'transparent') out += '<rect x="' + f2(vbX) + '" y="' + f2(vbY) + '" width="' + f2(vbW) + '" height="' + f2(vbH) + '" fill="' + esc(bg) + '"/>';
  if (title) out += textEl(contentCx, contentMinY - pad - titleH / 2 + 10, title, 26, 600, PINE, 'middle');
  out += bandsSvg + edgesSvg + cardsSvg + arrows.svg;
  out += '</svg>';
  return out;
}

// ── lifecycle ────────────────────────────────────────────────────────────────────
async function compute(model) {
  var svg;
  try { svg = await buildDiagram(inputsFrom(model)); }
  catch (e) {
    if (host && host.log) host.log('warn', 'diagram-builder: build failed', { error: String(e) });
    svg = placeholder('Could not build this diagram.');
  }
  return { diagramSvg: svg };
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }
