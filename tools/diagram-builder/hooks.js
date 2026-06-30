/* global onInit, onInput, host */

/**
 * Diagram Builder — org / tree / mindmap / layercake / process / timeline /
 * cycle / pyramid / funnel / kanban / matrix / gantt, from visual cards, a typed
 * text DSL, ASCII art, a Mermaid subset, or a pasted CSV/table.
 *
 * SVG-rooted tool: the whole scene is built as an <svg> STRING here and rendered
 * verbatim by the template ({{{diagramSvg}}}). Layout is pure JS, so it renders
 * identically in the browser and headless in the CLI. The one browser-only touch is
 * optional card images: in a browser they're embedded as a self-contained data URL
 * and measured for aspect; headless degrades gracefully.
 *
 * EXPORT SAFETY (verified 2026-06-30 against shells/web/src/bridge/export.js +
 * engine/src/{svg-path,emf}.js, correcting the older note here):
 *   - PDF walker (drawSvgVectorsInRegion) honours <path> (full M/L/H/V/C/S/Q/T/A/Z,
 *     fill + stroke + fill-rule + opacity), <line> (stroke ONLY, own attr), <rect>
 *     (fill + stroke), <circle> (fill + stroke), <text> (anchors start/mid/end, one
 *     run, SUSE/Helvetica), <image>. It DROPS <ellipse>/<polygon>/<polyline>/
 *     <marker>, stroke-dasharray, leaf transforms, and gradients.
 *   - EMF/EPS walker adds ellipse/polygon/polyline but is RGB-only, solid-pen only
 *     (no dasharray), skips <image>, and THROWS on non-SUSE fonts / letter-spacing.
 *   - SVG export is a verbatim passthrough; PNG is faithful (browser raster).
 * The portable subset we therefore stick to: shapes are fill+own-stroke <path>
 * (rounded-rect cards/bands, trapezoids, circle dots via 4 cubics), connectors are
 * <line>/<path> with own stroke, dashes/dots are REAL segment geometry (never
 * dasharray), arrowheads are computed filled <path>/<line> (never <marker> or
 * transforms), text is one SUSE run per line. No <ellipse>/<polygon>/<polyline>.
 *
 * Links are free-text IDs (not row indexes): a card references its parent/layer/
 * arrow endpoint by ID, resolved here. Unknown refs degrade gracefully.
 */

// ── SUSE palette (canonical: shells/web/src/palette.js) ───────────────────────
var PINE = '#0c322c', FOG = '#efefef', WHITE = '#ffffff', DETAIL = '#6f6f6f';
var BAND_PALETTE = ['#90ebcd', '#bff1ea', '#d8f3ec', '#efefef'];

// Theme / density / preset tables (seed inputs via the hook-patch mechanism).
var THEMES = {
  'suse-light': { nodeFill: '#ffffff', nodeStroke: '#0c322c', nodeText: '#0c322c', edgeColor: '#0c322c', background: '#ffffff', detail: '#6f6f6f', bandPalette: ['#90ebcd', '#bff1ea', '#d8f3ec', '#efefef'] },
  'suse-dark':  { nodeFill: '#0c322c', nodeStroke: '#90ebcd', nodeText: '#ffffff', edgeColor: '#90ebcd', background: '#0c322c', detail: '#9fc7bb', bandPalette: ['#14463d', '#1c5a4e', '#247060', '#2e8573'] },
  'blueprint':  { nodeFill: '#0a2540', nodeStroke: '#7fd4ff', nodeText: '#eaf6ff', edgeColor: '#7fd4ff', background: '#0a2540', detail: '#9fc2dd', bandPalette: ['#10314f', '#163c5e', '#1c476d', '#22527c'] },
  'mono':       { nodeFill: '#ffffff', nodeStroke: '#111111', nodeText: '#111111', edgeColor: '#111111', background: '#ffffff', detail: '#666666', bandPalette: ['#eeeeee', '#e2e2e2', '#d6d6d6', '#cacaca'] },
  'mint':       { nodeFill: '#ffffff', nodeStroke: '#0c322c', nodeText: '#0c322c', edgeColor: '#0c322c', background: '#eafaf4', detail: '#6f6f6f', bandPalette: ['#90ebcd', '#bff1ea', '#d8f3ec', '#effbf7'] }
};
var DENSITY = {
  compact:     { rowGap: 34,  siblingGap: 16, cardScale: 0.85 },
  cozy:        { rowGap: 56,  siblingGap: 30, cardScale: 1.0 },
  comfortable: { rowGap: 84,  siblingGap: 44, cardScale: 1.1 },
  spacious:    { rowGap: 120, siblingGap: 64, cardScale: 1.25 }
};
var PRESETS = {
  'org-classic':    { diagramType: 'org', orgDir: 'down', theme: 'suse-light', density: 'cozy' },
  'layercake-mint': { diagramType: 'layercake', theme: 'mint', density: 'cozy' },
  'process-lr':     { diagramType: 'process', flowDir: 'right', theme: 'suse-light', arrowHead: 'triangle', density: 'cozy' },
  'blueprint':      { diagramType: 'process', theme: 'blueprint', gridBg: 'grid', density: 'comfortable' },
  'mono':           { theme: 'mono', density: 'cozy' }
};
var VALID_TYPES = { org: 1, layercake: 1, process: 1, timeline: 1, cycle: 1, pyramid: 1, kanban: 1, matrix: 1, mindmap: 1, gantt: 1 };

// ── small helpers ─────────────────────────────────────────────────────────────
function inputsFrom(model) { var o = {}; model.forEach(function (i) { o[i.id] = i.value; }); return o; }
function num(v, d) { var x = Number(v); return isFinite(x) ? x : d; }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function f2(v) { return Math.round(v * 100) / 100; }
function arr(v) { return Array.isArray(v) ? v : []; }
function trim(v) { return String(v == null ? '' : v).trim(); }
function lerp(a, b, t) { return a + (b - a) * t; }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function color(v, fallback) {
  var s = (typeof v === 'string' ? v : '').trim();
  if (s.toLowerCase() === 'transparent') return 'transparent';
  return /^#[0-9a-f]{3,8}$/i.test(s) || /^(rgb|hsl)a?\([\d%.,\s/]+\)$/i.test(s) ? s : fallback;
}
function slug(s) { return trim(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function titleize(s) { s = String(s == null ? '' : s).replace(/[-_]+/g, ' ').trim(); return s.replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

// Greedy word-wrap into at most `maxLines` lines of ~maxChars each.
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
function textWidth(str, fontSize) { return String(str).length * fontSize * 0.62; }

// ── SVG primitives (baseline computed; export-safe subset only) ──────────────────
var FONT = "SUSE, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
function textEl(x, y, str, size, weight, fill, anchor) {
  return '<text x="' + f2(x) + '" y="' + f2(y) + '" font-family="' + FONT + '"'
    + ' font-size="' + f2(size) + '" font-weight="' + weight + '" fill="' + esc(fill) + '"'
    + ' text-anchor="' + (anchor || 'middle') + '">' + esc(str) + '</text>';
}
// Rounded-rect as a path (M/L/C/Z only). r is clamped.
function roundedRectPath(x, y, w, h, r) {
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
function trapezoidPath(xTL, xTR, xBL, xBR, yT, yB) {
  return 'M' + f2(xTL) + ' ' + f2(yT) + 'L' + f2(xTR) + ' ' + f2(yT)
    + 'L' + f2(xBR) + ' ' + f2(yB) + 'L' + f2(xBL) + ' ' + f2(yB) + 'Z';
}
// Circle as 4 cubic beziers (we never emit <ellipse>; <circle> is safe but a path is
// portable everywhere and matches the card discipline). Used for dots + arrowheads.
function circlePath(cx, cy, r) {
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
function shaft(x1, y1, x2, y2, style, col, width) {
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

// ── card images: embed as a data URL + measure aspect (browser only) ────────────
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
function rectRx(shape, w, h, S) {
  var lim = Math.min(w, h) / 2;
  if (shape === 'pill') return lim;
  if (shape === 'box') return Math.min(4, lim);
  return Math.min(S ? S.cornerRadius : 14, lim); // rounded
}
function computeCardH(S, lines, hasDetail) {
  return Math.max(Math.round(40 * S.scale), S.cardPadV * 2 + (S.imgBand || 0) + lines * S.labelLH + (hasDetail ? S.detailLH + 3 : 0));
}

// Render one card <g> with a click-to-focus hook (focuses block `idx` of `nodes`).
function renderCard(n, S) {
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
  for (var i = 0; i < lines.length; i++) {
    g += textEl(cx, top + i * S.labelLH + S.labelSize * 0.8, lines[i], S.labelSize, 500, S.nodeText, 'middle');
  }
  if (detail) {
    g += textEl(cx, top + lines.length * S.labelLH + S.detailSize * 0.8 + 3, detail, S.detailSize, 400, S.detailColor, 'middle');
  }
  return g + '</g>';
}

// ── normalise the nodes list (assign ids, dedupe, carry per-type fields) ─────────
function normaliseNodes(rawNodes) {
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
      score: (Array.isArray(b.score) && b.score.length === 2) ? b.score : null,
      _start: num(b.ganttStart, NaN), _len: num(b.ganttLen, NaN),
      x: 0, y: 0, w: 0, h: 0
    });
  });
  return nodes;
}

// ── shared tree build (org / tree-LR / mindmap) ──────────────────────────────────
function buildTree(nodes) {
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

// ── org / tree layout: tidy tree, top-down (dir 'down') or left-to-right ('right') ──
function layoutOrg(nodes, S, dir) {
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
function layoutMindmap(nodes, S, inp) {
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

// ── layercake layout: stacked layer bands ───────────────────────────────────────
function layoutLayercake(nodes, rawLayers, S) {
  var layers = [], layerById = {};
  rawLayers.forEach(function (b, i) {
    if (!b) return;
    var id = slug(b.layerId) || ('layer-' + (i + 1));
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

  var gutter = 168, padX = 20, padY = 18, bandGap = Math.round(S.rowGap * 0.29), cardGap = Math.round(S.siblingGap * 0.53), innerW = 1120;
  var capMax = Math.max(140, S.cardWidth + 68);
  function cwFor(n) { return n > 0 ? Math.max(1, Math.min(capMax, (innerW - cardGap * (n - 1)) / n)) : capMax; }

  var maxLines = 1, hasDetail = false;
  layers.forEach(function (L) {
    L._cw = cwFor(L._cards.length);
    L._cards.forEach(function (c) {
      if (estLineCount(c.label, maxCharsFor(L._cw, S.labelSize)) > 1) maxLines = 2;
      if (trim(c.detail)) hasDetail = true;
    });
  });
  var cardH = computeCardH(S, maxLines, hasDetail);
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
      if (right > maxRight) maxRight = right;
    }
    y += bandH + bandGap;
  });
  var bandW = Math.max(gutter + innerW + padX * 2, maxRight + padX);
  layers.forEach(function (L) { L.w = bandW; });
  return { autoEdges: [], bands: layers, layerById: layerById, gutter: gutter };
}

// ── kanban layout: side-by-side columns of cards ─────────────────────────────────
function layoutKanban(nodes, rawColumns, S, inp) {
  var cols = [], byId = {};
  arr(rawColumns).forEach(function (b, i) {
    if (!b) return;
    var id = slug(b.layerId) || ('col-' + (i + 1));
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

// ── process layout: ranked flow (a DAG layered by longest path) ──────────────────
function layoutProcess(nodes, rawArrows, S, dir) {
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
function layoutTimeline(nodes, S, dir, bb) {
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
function layoutCycle(nodes, S, inp, bb) {
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
        var mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2, rn = Math.hypot(mx, my) || 1, bow = R * 0.18;
        var cxp = mx + (mx / rn) * bow, cyp = my + (my / rn) * bow;
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
function layoutPyramid(nodes, S, style, bb) {
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
      behind += textEl(cx, midY + S.labelSize * 0.3, lab, S.labelSize, 600, S.nodeText, 'middle');
      if (trim(nd.detail)) behind += textEl(cx, midY + S.labelSize * 0.3 + S.detailLH, nd.detail, S.detailSize, 400, S.detailColor, 'middle');
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
function quadFromText(s) {
  s = String(s == null ? '' : s).toLowerCase();
  if (/^(tl|tr|bl|br)$/.test(s)) return s;
  var top = /top|upper|high/.test(s), bot = /bottom|lower|low/.test(s), left = /left/.test(s), right = /right/.test(s);
  if (top && left) return 'tl'; if (top && right) return 'tr'; if (bot && left) return 'bl'; if (bot && right) return 'br';
  return '';
}
function layoutMatrix(nodes, S, inp, bb) {
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
function layoutGantt(nodes, S, inp, bb) {
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
    if (trim(n.detail) && barW > textWidth(n.detail, S.detailSize) + 12) behind += textEl(barX + barW / 2, rowY + rowH / 2 + S.detailSize * 0.3, n.detail, S.detailSize, 400, S.nodeText, 'middle');
  });
  bb.add(0, 0, gutter, totalH);
  return { autoEdges: [], bands: [], layerById: {}, behind: behind, skipCards: true };
}

// ── explicit arrows ──────────────────────────────────────────────────────────────
function anchorOf(id, nodeById, layerById) {
  var n = nodeById[id];
  if (n) return { cx: n.x + n.w / 2, cy: n.y + n.h / 2, hw: n.w / 2, hh: n.h / 2 };
  var L = layerById[id];
  if (L && L.w != null) return { cx: L.x + L.w / 2, cy: L.y + L.h / 2, hw: L.w / 2, hh: L.h / 2 };
  return null;
}
function nested(a, b) {
  function inside(o, i) {
    return (o.cx - o.hw <= i.cx - i.hw + 0.5) && (i.cx + i.hw <= o.cx + o.hw + 0.5)
      && (o.cy - o.hh <= i.cy - i.hh + 0.5) && (i.cy + i.hh <= o.cy + o.hh + 0.5);
  }
  return inside(a, b) || inside(b, a);
}
function borderPoint(a, tx, ty) {
  var dx = tx - a.cx, dy = ty - a.cy;
  if (dx === 0 && dy === 0) return { x: a.cx, y: a.cy };
  var sx = dx !== 0 ? a.hw / Math.abs(dx) : Infinity;
  var sy = dy !== 0 ? a.hh / Math.abs(dy) : Infinity;
  var t = Math.min(sx, sy);
  return { x: a.cx + dx * t, y: a.cy + dy * t };
}
// How far to pull the shaft back from the tip so it doesn't poke through the head.
function headInset(kind, s) {
  if (kind === 'none' || kind === 'open' || kind === 'bar') return 0;
  if (kind === 'diamond') return 2 * s;
  if (kind === 'circle') return 2 * (0.42 * s);
  return s * 0.9; // triangle / default
}
// One arrowhead at `tip` pointing along unit (ux,uy). All export-safe geometry.
function arrowHead(tip, ux, uy, s, fill, kind, w) {
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
function renderArrows(rawArrows, nodeById, layerById, bg, bb, S) {
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

// ── empty-state placeholder (type + source aware, faint sample sketch) ────────────
var EMPTY_HINTS = {
  org: 'Add cards — set each card\'s “Reports to” to build the tree',
  mindmap: 'Add cards — set “Parent” to branch out from the centre',
  layercake: 'Add cards and layers to stack your layercake',
  process: 'Add cards and flow arrows to lay out your process',
  timeline: 'Add cards in order — each one is a milestone on the spine',
  cycle: 'Add stages in order — they loop around a ring',
  pyramid: 'Add tiers top→bottom to stack a pyramid / funnel',
  kanban: 'Add cards and set each card\'s “Group” to a column',
  matrix: 'Add items and place each in a quadrant',
  gantt: 'Add tasks with a start + length to lay bars on a time axis'
};
var SOURCE_HINTS = { text: 'Type a diagram — the field shows the syntax', ascii: 'Draw boxes with +  -  | and arrows with ->  ^  v', mermaid: 'Paste Mermaid: graph LR  /  A[Client] --> B(API)', table: 'Paste rows: id,label,parent  (or from,to,label)' };
function placeholder(mode, source) {
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
function errPlaceholder(msg) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760" width="1200" height="760"'
    + ' style="width:100%;height:auto;display:block;"><rect width="100%" height="100%" fill="' + WHITE + '"/>'
    + '<path d="' + roundedRectPath(380, 300, 440, 160, 16) + '" fill="none" stroke="' + FOG + '" stroke-width="2"/>'
    + textEl(600, 390, msg, 22, 500, '#8a9a95', 'middle') + '</svg>';
}

// ── text DSL parsing ─────────────────────────────────────────────────────────────
function dslLines(text) { return String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n'); }
function isComment(t) { return !t || t.indexOf('//') === 0; }
function leadIndent(s) { var n = 0; for (var i = 0; i < s.length; i++) { var c = s.charAt(i); if (c === ' ') n++; else if (c === '\t') n += 4; else break; } return n; }
function stripBullet(s) { return s.replace(/^[-*•]\s+/, ''); }
function splitDetail(s) { var i = s.indexOf('::'); return i >= 0 ? { label: s.slice(0, i).trim(), detail: s.slice(i + 2).trim() } : { label: s.trim(), detail: '' }; }
function splitArrowLabel(s) { var m = s.match(/\s:\s+(.+)$/); return m ? { body: s.slice(0, m.index), label: m[1].trim() } : { body: s, label: '' }; }
function imageRef(s) {
  s = trim(s);
  if (!s) return '';
  var m = s.match(/^([a-z][a-z0-9+.-]*):/i);
  if (m) { var sch = m[1].toLowerCase(); return (sch === 'http' || sch === 'https' || sch === 'data') ? s : ''; }
  return (s.indexOf('/') >= 0 || /\.(png|jpe?g|gif|svg|webp|avif|bmp|ico)$/i.test(s)) ? s : '';
}
// `Label :: Detail @ image #hex` plus shape wrappers ([Box] (Rounded) ([Pill]) {…}).
function splitToken(s) {
  s = String(s == null ? '' : s);
  var image = '', m = s.match(/\s@\s*([^@]+)$/);
  if (m) { var ref = imageRef(m[1]); if (ref) { image = ref; s = s.slice(0, m.index); } }
  var fill = '', fm = s.match(/\s(#[0-9a-fA-F]{3,8})\s*$/);
  if (fm) { fill = fm[1]; s = s.slice(0, fm.index); }
  var shape = '', t = s.trim();
  if (/^\(\[[\s\S]*\]\)$/.test(t)) { shape = 'pill'; t = t.slice(2, -2); }
  else if (/^\[\([\s\S]*\)\]$/.test(t)) { shape = 'rounded'; t = t.slice(2, -2); }
  else if (/^\[\[[\s\S]*\]\]$/.test(t)) { shape = 'box'; t = t.slice(2, -2); }
  else if (/^\([\s\S]*\)$/.test(t)) { shape = 'rounded'; t = t.slice(1, -1); }
  else if (/^\[[\s\S]*\]$/.test(t)) { shape = 'box'; t = t.slice(1, -1); }
  else if (/^\{[\s\S]*\}$/.test(t)) { shape = 'box'; t = t.slice(1, -1); }
  var d = splitDetail(t);
  return { label: d.label, detail: d.detail, image: image, shape: shape, fill: fill };
}
// Map an edge operator string to style/head/width/double.
function edgeOp(op) {
  var o = { style: 'solid', head: '', width: 0, double: false };
  if (op.indexOf('<') >= 0) o.double = true;
  if (op.indexOf('.') >= 0) o.style = 'dotted';
  if (op.indexOf('=') >= 0) o.width = 3.5;
  if (op.indexOf('>') < 0 && !o.double) o.head = 'none'; // --- or -.-
  return o;
}
// Parse a chain like `A --> B -.-> C : label` (or mermaid `A -->|x| B`) into arrows.
// resolve(token) → node id (process/mermaid create nodes); null = resolve by slug.
function parseEdges(content, resolve, arrows) {
  var al = splitArrowLabel(content), body = al.body, chainLabel = al.label;
  // mermaid `-- text -->` / `-. text .->` → normalise to `-->|text|`
  body = body.replace(/--\s+([^|>][^>]*?)\s+-->/g, '-->|$1|').replace(/-\.\s+([^|>][^>]*?)\s+\.->/g, '-.->|$1|');
  var OPRE = /(<-->|<-+>|<->|-\.->|-\.\.->|\.\.>|===>|==>|=>|--->|-->|->|---|-\.-)/g;
  var parts = [], ops = [], last = 0, m;
  while ((m = OPRE.exec(body))) { parts.push(body.slice(last, m.index)); ops.push(m[1]); last = m.index + m[1].length; }
  parts.push(body.slice(last));
  if (ops.length === 0) { var only = parts[0].trim(); if (only && resolve) resolve(only); return; }
  var labels = [];
  for (var i = 1; i < parts.length; i++) {
    var pm = parts[i].match(/^\s*\|([^|]*)\|/);
    if (pm) { labels[i - 1] = pm[1].trim(); parts[i] = parts[i].replace(/^\s*\|[^|]*\|/, ''); }
  }
  var ids = parts.map(function (p) { return resolve ? resolve(p.trim()) : slug(splitToken(p.trim()).label); });
  for (var j = 0; j < ops.length; j++) {
    var o = edgeOp(ops[j]);
    var lbl = labels[j] || (j === ops.length - 1 ? chainLabel : '');
    arrows.push({ from: ids[j], to: ids[j + 1], label: lbl, style: o.style, head: o.head, width: o.width, double: o.double, color: '' });
  }
}
function collectArrows(content, arrows, addNode) { parseEdges(content, addNode, arrows); }

function parseOrg(lines) {
  var nodes = [], arrows = [], used = {}, stack = [];
  function uid(label) { var b = slug(label) || 'node', id = b, k = 2; while (used[id]) { id = b + '-' + k; k++; } used[id] = 1; return id; }
  lines.forEach(function (raw) {
    var t = raw.trim();
    if (isComment(t) || t.charAt(0) === '#') return;
    if (/-->|->|==>/.test(t)) { collectArrows(stripBullet(t), arrows, null); return; }
    var indent = leadIndent(raw), d = splitToken(stripBullet(t));
    if (!d.label) return;
    var id = uid(d.label);
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    nodes.push({ shape: d.shape || 'rounded', nodeId: id, label: d.label, detail: d.detail, image: d.image, fill: d.fill, parent: stack.length ? stack[stack.length - 1].id : '', layer: '' });
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
    if (/-->|->|==>/.test(c)) { collectArrows(c, arrows, null); return; }
    var d = splitToken(c);
    if (!d.label) return;
    nodes.push({ shape: d.shape || 'rounded', nodeId: uid(usedN, d.label, 'node'), label: d.label, detail: d.detail, image: d.image, fill: d.fill, parent: '', layer: cur });
  });
  return { nodes: nodes, layers: layers, arrows: arrows };
}
function parseProcess(lines) {
  var nodes = [], arrows = [], seen = {};
  function addNode(rawPart) {
    var d = splitToken(rawPart), key = slug(d.label) || 'step';
    if (seen[key]) {
      if (d.detail && !seen[key].detail) seen[key].detail = d.detail;
      if (d.image && !seen[key].image) seen[key].image = d.image;
      if (d.shape && seen[key].shape === 'rounded') seen[key].shape = d.shape;
      return key;
    }
    var node = { shape: d.shape || 'rounded', nodeId: key, label: d.label, detail: d.detail, image: d.image, fill: d.fill, parent: '', layer: '' };
    seen[key] = node; nodes.push(node);
    return key;
  }
  lines.forEach(function (raw) {
    var t = stripBullet(raw.trim());
    if (isComment(t) || t.charAt(0) === '#') return;
    if (/-->|->|==>|---/.test(t)) collectArrows(t, arrows, addNode);
    else addNode(t);
  });
  return { nodes: nodes, layers: [], arrows: arrows };
}
function parseList(lines) {
  var nodes = [], used = {};
  function uid(l) { var b = slug(l) || 'item', id = b, k = 2; while (used[id]) { id = b + '-' + k; k++; } used[id] = 1; return id; }
  lines.forEach(function (raw) {
    var t = stripBullet(raw.trim());
    if (isComment(t) || t.charAt(0) === '#') return;
    var d = splitToken(t); if (!d.label) return;
    nodes.push({ shape: d.shape || 'rounded', nodeId: uid(d.label), label: d.label, detail: d.detail, image: d.image, fill: d.fill, parent: '', layer: '' });
  });
  return { nodes: nodes, layers: [], arrows: [] };
}
function parseMatrix(lines) {
  var nodes = [], used = {}, cur = 'tr';
  function uid(l) { var b = slug(l) || 'item', id = b, k = 2; while (used[id]) { id = b + '-' + k; k++; } used[id] = 1; return id; }
  lines.forEach(function (raw) {
    var t = stripBullet(raw.trim());
    if (isComment(t)) return;
    if (t.charAt(0) === '#') { var q = quadFromText(t.replace(/^#+\s*/, '')); if (q) cur = q; return; }
    var score = null, sm = t.match(/@\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*\)\s*$/);
    if (sm) { score = [parseFloat(sm[1]), parseFloat(sm[2])]; t = t.slice(0, sm.index).trim(); }
    var d = splitToken(t); if (!d.label) return;
    nodes.push({ shape: d.shape || 'pill', nodeId: uid(d.label), label: d.label, detail: d.detail, image: d.image, fill: d.fill, parent: '', layer: '', quadrant: cur, score: score });
  });
  return { nodes: nodes, layers: [], arrows: [] };
}
function parseGantt(lines) {
  var nodes = [], arrows = [], used = {}, seq = 0;
  function uid(l) { var b = slug(l) || 'task', id = b, k = 2; while (used[id]) { id = b + '-' + k; k++; } used[id] = 1; return id; }
  lines.forEach(function (raw) {
    var t = stripBullet(raw.trim());
    if (isComment(t) || t.charAt(0) === '#') return;
    if (/-->|->|==>/.test(t)) { collectArrows(t, arrows, null); return; }
    var al = splitArrowLabel(t), body = al.body, spec = al.label, start = NaN, len = NaN;
    if (spec) {
      var r = spec.match(/^([\d.]+)\s*(?:\.\.|to|-)\s*([\d.]+)$/i), p = spec.match(/^([\d.]+)\s*\+\s*([\d.]+)$/);
      if (r) { start = parseFloat(r[1]); len = parseFloat(r[2]) - start; }
      else if (p) { start = parseFloat(p[1]); len = parseFloat(p[2]); }
    }
    var d = splitToken(body); if (!d.label) return;
    if (!isFinite(start)) start = seq; if (!isFinite(len) || len <= 0) len = 1; seq = Math.max(seq, start + len);
    nodes.push({ shape: d.shape || 'rounded', nodeId: uid(d.label), label: d.label, detail: d.detail, image: d.image, fill: d.fill, parent: '', layer: '', ganttStart: start, ganttLen: len });
  });
  return { nodes: nodes, layers: [], arrows: arrows };
}
function parseDsl(text, mode) {
  var lines = dslLines(text);
  if (mode === 'layercake' || mode === 'kanban') return parseLayercake(lines);
  if (mode === 'process') return parseProcess(lines);
  if (mode === 'timeline' || mode === 'cycle' || mode === 'pyramid') return parseList(lines);
  if (mode === 'matrix') return parseMatrix(lines);
  if (mode === 'gantt') return parseGantt(lines);
  return parseOrg(lines); // org + mindmap
}

// ── Mermaid subset → {nodes, layers, arrows, diagramType, dir} ────────────────────
function parseMermaid(text) {
  var lines = dslLines(text), nodes = [], byId = {}, layers = [], arrows = [], usedL = {}, order = 0;
  var diagramType = 'process', dir = 'down', sub = null;
  function ensure(id, label, shape) {
    id = slug(id) || ('n-' + (++order));
    if (!byId[id]) { byId[id] = { shape: shape || 'rounded', nodeId: id, label: label || titleize(id), detail: '', image: '', fill: '', parent: '', layer: sub || '' }; nodes.push(byId[id]); }
    else { if (label && (byId[id].label === titleize(id) || !byId[id].label)) byId[id].label = label; if (shape && byId[id].shape === 'rounded') byId[id].shape = shape; if (sub && !byId[id].layer) byId[id].layer = sub; }
    return id;
  }
  function defOf(tok) {
    tok = tok.trim();
    var m = tok.match(/^([A-Za-z0-9_]+)\s*(\(\[[\s\S]*\]\)|\[\([\s\S]*\)\]|\(\([\s\S]*\)\)|\{\{[\s\S]*\}\}|\{[\s\S]*\}|\[\[[\s\S]*\]\]|\[[\s\S]*\]|\([\s\S]*\))\s*$/);
    if (m) {
      var id = m[1], body = m[2], label = '', shape = 'rounded';
      if (/^\(\[[\s\S]*\]\)$/.test(body)) { shape = 'pill'; label = body.slice(2, -2); }
      else if (/^\(\([\s\S]*\)\)$/.test(body)) { shape = 'pill'; label = body.slice(2, -2); }
      else if (/^\[\([\s\S]*\)\]$/.test(body)) { shape = 'rounded'; label = body.slice(2, -2); }
      else if (/^\{\{[\s\S]*\}\}$/.test(body)) { shape = 'box'; label = body.slice(2, -2); }
      else if (/^\[\[[\s\S]*\]\]$/.test(body)) { shape = 'box'; label = body.slice(2, -2); }
      else if (/^\{[\s\S]*\}$/.test(body)) { shape = 'box'; label = body.slice(1, -1); }
      else if (/^\[[\s\S]*\]$/.test(body)) { shape = 'box'; label = body.slice(1, -1); }
      else { shape = 'rounded'; label = body.slice(1, -1); }
      return ensure(id, label.replace(/^["']|["']$/g, '').trim(), shape);
    }
    return ensure(tok, null, null);
  }
  lines.forEach(function (raw) {
    var t = raw.trim();
    if (!t || t.indexOf('%%') === 0) return;
    var h = t.match(/^(graph|flowchart)\s+(TB|TD|BT|RL|LR)\b/i);
    if (h) { var d = h[2].toUpperCase(); dir = (d === 'LR' || d === 'RL') ? 'right' : 'down'; return; }
    var sg = t.match(/^subgraph\s+(.+)$/i);
    if (sg) {
      diagramType = 'layercake';
      var lab = sg[1].replace(/\[[\s\S]*\]$/, '').replace(/^["']|["']$/g, '').trim();
      var lid = slug(lab) || ('layer-' + (layers.length + 1));
      if (!usedL[lid]) { usedL[lid] = 1; layers.push({ kind: 'layer', layerId: lid, label: lab, bandFill: BAND_PALETTE[layers.length % BAND_PALETTE.length] }); }
      sub = lid; return;
    }
    if (/^end$/i.test(t)) { sub = null; return; }
    if (/^(classDef|class|click|style|linkStyle|direction)\b/i.test(t)) { if (host && host.log) host.log('info', 'diagram-builder: mermaid line skipped: ' + t); return; }
    if (/(-->|---|-\.->|==>|<-->|<->|-\.-|\bo--|--o|x--|--x)/.test(t)) { parseEdges(t, defOf, arrows); return; }
    defOf(t);
  });
  return { nodes: nodes, layers: layers, arrows: arrows, diagramType: diagramType, dir: dir };
}

// ── CSV / table → {nodes, layers, arrows} ────────────────────────────────────────
function parseTable(text, mode) {
  var rows = dslLines(text).filter(function (l) { return trim(l); });
  var nodes = [], arrows = [], used = {};
  function splitRow(l) { return (l.indexOf('\t') >= 0 ? l.split('\t') : l.split(',')).map(function (c) { return c.trim(); }); }
  function uid(l) { var b = slug(l) || 'row', id = b, k = 2; while (used[id]) { id = b + '-' + k; k++; } used[id] = 1; return id; }
  function ensure(label) { var id = slug(label) || 'n'; if (!used[id]) { used[id] = 1; nodes.push({ shape: 'rounded', nodeId: id, label: label, detail: '', image: '', fill: '', parent: '', layer: '' }); } return id; }
  if (!rows.length) return { nodes: [], layers: [], arrows: [] };
  var header = splitRow(rows[0]).map(function (c) { return c.toLowerCase(); });
  var hasHeader = /^(id|label|name|from|source)$/.test(header[0] || '');
  var start = hasHeader ? 1 : 0;
  var edgeMode = (mode === 'process');
  for (var i = start; i < rows.length; i++) {
    var c = splitRow(rows[i]);
    if (edgeMode) {
      if (c.length >= 2 && c[0] && c[1]) arrows.push({ from: ensure(c[0]), to: ensure(c[1]), label: c[2] || '', style: 'solid', head: '', width: 0, color: '' });
      else if (c[0]) ensure(c[0]);
    } else if (mode === 'timeline' || mode === 'cycle' || mode === 'pyramid') {
      if (c[0]) nodes.push({ shape: 'rounded', nodeId: uid(c[0]), label: c[0], detail: c[1] || '', image: '', fill: '', parent: '', layer: '' });
    } else {
      if (!c[0] && !c[1]) continue;
      var id = slug(c[0]) || uid(c[1] || c[0]); used[id] = 1;
      nodes.push({ shape: 'rounded', nodeId: id, label: c[1] || c[0], detail: c[2] || '', image: '', fill: '', parent: slug(c[3] || ''), layer: slug(c[3] || '') });
    }
  }
  return { nodes: nodes, layers: [], arrows: arrows };
}

// ── grid / dot background (real geometry, capped) ────────────────────────────────
function gridBg(kind, vbX, vbY, vbW, vbH, col) {
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

// ── compose the whole scene ─────────────────────────────────────────────────────
async function buildDiagram(inp) {
  var mode = VALID_TYPES[inp.diagramType] ? inp.diagramType : 'org';
  var source = ['text', 'ascii', 'mermaid', 'table'].indexOf(inp.source) >= 0 ? inp.source : 'visual';
  var bg = color(inp.background, WHITE);

  var src, asciiPos = null, overrideDir = null;
  if (source === 'text') src = parseDsl(inp.dsl, mode);
  else if (source === 'ascii') { var pa = parseAscii(inp.asciiArt); src = { nodes: pa.nodes, layers: [], arrows: pa.arrows }; asciiPos = pa.pos; }
  else if (source === 'mermaid') { var pm = parseMermaid(inp.mermaid); src = { nodes: pm.nodes, layers: pm.layers, arrows: pm.arrows }; if (VALID_TYPES[pm.diagramType]) mode = pm.diagramType; overrideDir = pm.dir; }
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
    if (layout.kanbanHeader) {
      var lbl = L.label + (layout.showCount ? ' (' + L._cards.length + ')' : '');
      var llab = wrapLines(lbl, maxCharsFor(L.w - 20, S.labelSize), 1);
      if (llab.length) bandsSvg += textEl(L.x + L.w / 2, L.y + 24, llab[0], Math.round(S.labelSize * 0.95), 600, S.nodeText, 'middle');
    } else {
      var gw = (layout.gutter || 168) - 28;
      var llab2 = wrapLines(L.label, maxCharsFor(gw, 15), 1);
      if (llab2.length) bandsSvg += textEl(L.x + 20, L.y + L.h / 2 + 5, llab2[0], 15, 600, S.nodeText, 'start');
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

// ── literal ASCII-art tracing → raw {nodes, arrows} + drawn positions ─────────────
function parseAscii(text) {
  var rows = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n').slice(0, 240);
  var H = rows.length, W = 0, i;
  for (i = 0; i < H; i++) { if (rows[i].length > W) W = rows[i].length; }
  W = Math.min(W, 400);
  function ch(r, c) { if (r < 0 || r >= H || c < 0) return ' '; var ln = rows[r]; return c < ln.length ? ln.charAt(c) : ' '; }
  function K(r, c) { return r + ',' + c; }

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

  boxes.forEach(function (b) {
    var lines = [], s, rr2, cc2, im;
    for (rr2 = b.r0 + 1; rr2 < b.r1; rr2++) {
      s = '';
      for (cc2 = b.c0 + 1; cc2 < b.c1; cc2++) s += ch(rr2, cc2);
      s = s.trim();
      if (!s) continue;
      im = s.match(/^@\s*(.+)$/);
      if (im && imageRef(im[1])) { b.image = imageRef(im[1]); continue; }
      lines.push(s);
    }
    b.label = lines[0] || '';
    b.detail = lines.slice(1).join(' ');
  });

  var CW = 11, CH = 26, nodes = [], pos = [], used = {};
  boxes.forEach(function (b, bi) {
    var base = slug(b.label) || ('box-' + (bi + 1)), id = base, k = 2;
    while (used[id]) { id = base + '-' + k; k++; }
    used[id] = 1; b.id = id;
    nodes.push({ shape: 'rounded', nodeId: id, label: b.label, detail: b.detail, image: b.image || '', fill: '', parent: '', layer: '' });
    pos.push({ x: b.c0 * CW, y: b.r0 * CH, w: Math.max(96, (b.c1 - b.c0) * CW), h: Math.max(44, (b.r1 - b.r0) * CH) });
  });

  function isWire(rr3, cc3) { var x = ch(rr3, cc3); return '-|+/\\><^v'.indexOf(x) >= 0 && owner[K(rr3, cc3)] === undefined; }
  function isHead(x) { return x === '>' || x === '<' || x === '^' || x === 'v'; }
  var OFF = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
  var CARD = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  function boxAt(pr, pc) {
    var d, o;
    for (d = 0; d < 8; d++) { o = owner[K(pr + OFF[d][0], pc + OFF[d][1])]; if (o !== undefined) return o; }
    for (d = 0; d < 4; d++) {
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
      arrows.push({ from: nodes[fromI].nodeId, to: nodes[toI].nodeId, label: '', style: 'solid', head: '', width: 0, color: '' });
    }
  }
  return { nodes: nodes, arrows: arrows, pos: pos };
}

// ── preset / theme / density seeding (one-shot hook patches) ──────────────────────
var _applied = { preset: null, theme: null, density: null };
function resolvePatches(inp) {
  var patch = {};
  if (inp.preset && inp.preset !== 'custom' && inp.preset !== _applied.preset) {
    var p = PRESETS[inp.preset];
    if (p) Object.keys(p).forEach(function (k) { patch[k] = p[k]; });
    _applied.preset = inp.preset;
  }
  var theme = patch.theme || inp.theme;
  if (theme && theme !== 'custom' && theme !== _applied.theme) {
    var t = THEMES[theme];
    if (t) { patch.nodeFill = t.nodeFill; patch.nodeStroke = t.nodeStroke; patch.nodeText = t.nodeText; patch.edgeColor = t.edgeColor; patch.background = t.background; }
    _applied.theme = theme;
  }
  var density = patch.density || inp.density;
  if (density && density !== 'custom' && density !== _applied.density) {
    var d = DENSITY[density];
    if (d) { patch.rowGap = d.rowGap; patch.siblingGap = d.siblingGap; patch.cardScale = d.cardScale; }
    _applied.density = density;
  }
  return patch;
}

// ── lifecycle ────────────────────────────────────────────────────────────────────
async function compute(model) {
  var inp = inputsFrom(model);
  var patch = resolvePatches(inp);
  Object.keys(patch).forEach(function (k) { inp[k] = patch[k]; });
  var svg;
  try { svg = await buildDiagram(inp); }
  catch (e) {
    if (host && host.log) host.log('warn', 'diagram-builder: build failed', { error: String(e) });
    svg = errPlaceholder('Could not build this diagram.');
  }
  return Object.assign({ diagramSvg: svg }, patch);
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }
