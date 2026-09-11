/* global host */
/**
 * Mesh Gradient hooks.
 *
 * Five methods behind one `mode` select (the filter tool's badged-select
 * pattern):
 *
 *  - blend (vector, default): stacked radial gradients over a base fill -
 *    the whole SVG built here as a string (qr-code pattern), with optional
 *    blur/grain via an SVG filter and optional CSS-keyframe drift for video
 *    exports. Gradients use gradientUnits="userSpaceOnUse" so the template
 *    script can move a point live during a drag by setting cx/cy on its
 *    <radialGradient>.
 *  - subdivide (vector): a real Coons-patch mesh (rows x cols of colour
 *    nodes, Catmull-Rom tangents) subdivided into flat-shaded SVG quads -
 *    the Inkscape / SVG-2 mesh fallback technique (w3c/svgwg#377). Same-colour
 *    strokes seal the anti-aliasing seams; `detail` trades smoothness for
 *    path count (capped well under the dom-to-image node cliff).
 *  - mesh (raster): the same Coons-patch model rendered per-pixel by the
 *    template script (gouraud triangles into a canvas) - the professional
 *    smooth finish. Hooks only emit the canvas + the mesh model as JSON.
 *  - flow (raster, animated): whatamesh-style flowing gradient in a WebGL
 *    fragment shader, painted by the template script. Seamlessly loops;
 *    exports drive it deterministically via the shell's __lollyFrameRender
 *    frame clock.
 *  - warp (raster): freeform colour points (photogradient / Illustrator
 *    freeform-gradient style) - Shepard inverse-distance interpolation in a
 *    WebGL shader, reusing blend's dots, spread and drift controls.
 *
 * The mesh math lives in the shared `mesh-core` region (canonical source:
 * community/_shared/mesh.js) so the template script - and, later, other
 * tools like design's gradient paths - use byte-identical code.
 */

var VBW = 1600;
var VBH = 900;

// Brand-agnostic fallbacks for when a semantic token alias doesn't resolve
// (an unresolved alias flattens to '') - one per colour slot.
var FALLBACK = ['#6d5bd8', '#e0679f', '#2fb6a3', '#f6f1e7', '#f2a65a', '#5b8def'];
var DEF_POS = [[14, 20], [85, 18], [80, 82], [18, 78], [52, 10], [50, 88]];

// Drift = one closed orbit per blob, passing through its set position.
// Everything derives deterministically from the blob index (golden-angle
// rotation, alternating spin, 3–10% amplitude) - no Math.random, so the memo
// key stays honest and video restarts / URL renders land identical poses.
var GOLDEN = 137.508;

// mix-blend-mode whitelist for the colour blobs (the "blend" select).
var BLOB_BLENDS = ['normal', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light', 'lighten', 'darken', 'luminosity'];

var MODES = ['blend', 'subdivide', 'flow', 'mesh', 'warp'];

function _num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : d; }
function _clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

// Colour values land raw inside the SVG string (and can arrive via URL
// params), so allow only colour-function characters - never markup.
function _safeColor(v, fb) {
  v = (v == null ? '' : String(v)).trim();
  return v && /^[#a-zA-Z0-9(),.%\s\/-]+$/.test(v) ? v : fb;
}

// Strict 6-digit hex (expanding #rgb) for the paths that need parseable
// colour bytes: mesh node colours and the flow shader/CSS-gradient fallback.
function _hex6(v, fb) {
  v = (v == null ? '' : String(v)).trim().toLowerCase();
  var m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (m3) return '#' + m3[1] + m3[1] + m3[2] + m3[2] + m3[3] + m3[3];
  return /^#[0-9a-f]{6}$/.test(v) ? v : fb;
}

// A vector input's value is an { x, y } object everywhere (URL mode uses
// per-field params - pos1.x= / pos1.y= - never a packed string).
function _pos(v, d) {
  var x = d[0], y = d[1];
  if (v && typeof v === 'object') { x = _num(v.x, x); y = _num(v.y, y); }
  return { x: _clamp(x, 0, 100), y: _clamp(y, 0, 100) };
}

function _filterDef(blur, grain, blend) {
  if (!(blur > 0) && !(grain > 0)) return '';
  var f = '<filter id="mg-f" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">';
  var base = 'SourceGraphic';
  if (blur > 0) {
    f += '<feGaussianBlur in="SourceGraphic" stdDeviation="' + (blur * 3) + '" result="mgb"/>';
    base = 'mgb';
  }
  if (grain > 0) {
    f += '<feTurbulence type="fractalNoise" baseFrequency="0.66" numOctaves="2" seed="7" stitchTiles="stitch" result="mgn0"/>'
      + '<feColorMatrix in="mgn0" type="saturate" values="0" result="mgn1"/>'
      + '<feComponentTransfer in="mgn1" result="mgn2"><feFuncA type="linear" slope="' + (grain / 100 * 0.55).toFixed(3) + '" intercept="0"/></feComponentTransfer>'
      + '<feBlend in="mgn2" in2="' + base + '" mode="' + blend + '"/>';
  }
  return f + '</filter>';
}

function _animCss(count, speed, distancePct) {
  var css = '';
  var STEPS = 8; // waypoints per orbit - smooth with linear timing
  var distanceScale = distancePct / 100;
  for (var i = 0; i < count; i++) {
    // Orbit rotated by the golden angle so no two blobs ever drift the same
    // way; alternating spin direction; amplitude (max displacement, = the
    // orbit diameter) spans 3–10% of the frame per blob at the default 100%
    // float distance - the "distance" input scales that range up or down.
    var theta = (i * GOLDEN + 23) * Math.PI / 180;
    var ampPct = (3 + ((i * 53) % 71) / 10) * distanceScale;
    var dir = i % 2 === 0 ? 1 : -1;
    var rx = ampPct / 200 * VBW;
    var ry = ampPct / 200 * VBH;
    var ox = rx * Math.cos(theta), oy = ry * Math.sin(theta); // orbit centre
    var frames = '';
    for (var s = 0; s <= STEPS; s++) {
      var t = s / STEPS;
      // Phase chosen so t=0 sits exactly on the set position (translate 0,0)
      // - static exports freeze there and restarts are clean.
      var a = theta + Math.PI + dir * 2 * Math.PI * t;
      frames += (t * 100).toFixed(1) + '%{transform:translate('
        + (ox + rx * Math.cos(a)).toFixed(1) + 'px,' + (oy + ry * Math.sin(a)).toFixed(1) + 'px)}';
    }
    css += '@keyframes mg-d' + (i + 1) + '{' + frames + '}';
    // Linear timing = constant orbital speed (continuous float, not
    // ease pulses); negative delays desync the blobs while keeping one
    // seamless loop of `speed` seconds - and stop every blob crossing its
    // set position at the same instant.
    css += '.mg-blob-' + (i + 1) + '{animation:mg-d' + (i + 1) + ' ' + speed + 's linear infinite;'
      + 'animation-delay:' + (-(speed * i) / count).toFixed(2) + 's}';
  }
  css += '.mg-frozen .mg-blob{animation:none!important}';
  // Reduce-motion calms the LIVE canvas only; an explicit webm/mp4 export
  // still animates (beforeExport adds .mg-export for the capture window) -
  // otherwise those users would silently get an all-identical-frames video.
  css += '@media (prefers-reduced-motion:reduce){svg.mg-svg:not(.mg-export) .mg-blob{animation:none}}';
  return '<style>' + css + '</style>';
}

// === lolly:shared mesh-core - generated from community/_shared/mesh.js; edit there and run npm run sync:shared ===
function mgmClamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

function mgmHexRgb(hex) {
  var m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return [128, 128, 128];
  var n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mgmRgbHex(rgb) {
  var s = '#';
  for (var i = 0; i < 3; i++) {
    var v = mgmClamp(Math.round(rgb[i]), 0, 255).toString(16);
    s += v.length < 2 ? '0' + v : v;
  }
  return s;
}

// Evenly spaced grid; colours cycle diagonally through the swatches so every
// swatch shows up and neighbouring nodes differ.
function mgmDefaultMesh(rows, cols, colors) {
  rows = mgmClamp(Math.round(rows) || 3, 2, 8);
  cols = mgmClamp(Math.round(cols) || 3, 2, 8);
  var nodes = [];
  for (var r = 0; r < rows; r++) {
    for (var c = 0; c < cols; c++) {
      nodes.push({
        x: cols > 1 ? c * 100 / (cols - 1) : 50,
        y: rows > 1 ? r * 100 / (rows - 1) : 50,
        color: colors[(r + c) % colors.length] || '#808080',
      });
    }
  }
  return { rows: rows, cols: cols, nodes: nodes };
}

// Compact, URL-friendly serialisation: "R.C:x,y,hex[,Edx~dy][,Wdx~dy]...;..."
// (hex without '#'; handle offsets in %, one decimal). Round-trips through
// mgmParseMesh exactly.
function mgmNum1(v) { return String(Math.round(v * 10) / 10); }
function mgmSerializeMesh(mesh) {
  var out = [];
  for (var i = 0; i < mesh.nodes.length; i++) {
    var n = mesh.nodes[i];
    var s = mgmNum1(n.x) + ',' + mgmNum1(n.y) + ',' + mgmRgbHex(mgmHexRgb(n.color)).slice(1);
    if (n.h) {
      for (var k = 0; k < 4; k++) {
        var dir = 'EWNS'[k];
        var h = n.h[dir];
        if (h) s += ',' + dir + mgmNum1(h[0]) + '~' + mgmNum1(h[1]);
      }
    }
    out.push(s);
  }
  return mesh.rows + '.' + mesh.cols + ':' + out.join(';');
}

// Returns a mesh or null; null on any malformation or a node-count mismatch
// (so a stale string from an older rows/cols setting falls back to defaults).
function mgmParseMesh(str) {
  var m = /^(\d+)\.(\d+):(.*)$/.exec(String(str || '').trim());
  if (!m) return null;
  var rows = parseInt(m[1], 10), cols = parseInt(m[2], 10);
  if (!(rows >= 2 && rows <= 8 && cols >= 2 && cols <= 8)) return null;
  var toks = m[3].split(';');
  if (toks.length !== rows * cols) return null;
  var nodes = [];
  for (var i = 0; i < toks.length; i++) {
    var parts = toks[i].split(',');
    if (parts.length < 3) return null;
    var x = Number(parts[0]), y = Number(parts[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (!/^[0-9a-f]{6}$/i.test(parts[2])) return null;
    var node = { x: mgmClamp(x, 0, 100), y: mgmClamp(y, 0, 100), color: '#' + parts[2].toLowerCase() };
    for (var j = 3; j < parts.length; j++) {
      var hm = /^([EWNS])(-?\d+(?:\.\d+)?)~(-?\d+(?:\.\d+)?)$/.exec(parts[j]);
      if (!hm) return null;
      if (!node.h) node.h = {};
      node.h[hm[1]] = [mgmClamp(Number(hm[2]), -60, 60), mgmClamp(Number(hm[3]), -60, 60)];
    }
    nodes.push(node);
  }
  return { rows: rows, cols: cols, nodes: nodes };
}

// Per-node Bezier control offsets toward each existing neighbour, [dx,dy] in %.
// Auto = Catmull-Rom (central difference /6, one-sided /3) scaled so
// curvature 50 is classic Catmull-Rom and 0 is straight; an `h` override wins.
function mgmMeshTangents(mesh, curvature) {
  var k = mgmClamp(Number(curvature) || 0, 0, 100) / 50;
  var R = mesh.rows, C = mesh.cols, nodes = mesh.nodes;
  function at(r, c) { return nodes[r * C + c]; }
  function diff(a, b, f) { return [(a.x - b.x) * f, (a.y - b.y) * f]; }
  var out = [];
  for (var r = 0; r < R; r++) {
    for (var c = 0; c < C; c++) {
      var n = at(r, c), t = { E: null, W: null, N: null, S: null };
      if (c < C - 1) t.E = (n.h && n.h.E) || (c > 0 ? diff(at(r, c + 1), at(r, c - 1), k / 6) : diff(at(r, c + 1), n, k / 3));
      if (c > 0) t.W = (n.h && n.h.W) || (c < C - 1 ? diff(at(r, c - 1), at(r, c + 1), k / 6) : diff(at(r, c - 1), n, k / 3));
      if (r > 0) t.N = (n.h && n.h.N) || (r < R - 1 ? diff(at(r - 1, c), at(r + 1, c), k / 6) : diff(at(r - 1, c), n, k / 3));
      if (r < R - 1) t.S = (n.h && n.h.S) || (r > 0 ? diff(at(r + 1, c), at(r - 1, c), k / 6) : diff(at(r + 1, c), n, k / 3));
      out.push(t);
    }
  }
  return out;
}

// One Coons patch per grid cell. Boundaries are cubics [p0,p1,p2,p3]
// ([x,y] each): top nw->ne and bottom sw->se run in u; left nw->sw and
// right ne->se run in v. colors = corner RGBs [nw, ne, sw, se].
function mgmMeshPatches(mesh, curvature) {
  var tg = mgmMeshTangents(mesh, curvature);
  var C = mesh.cols, nodes = mesh.nodes, patches = [];
  function P(n) { return [n.x, n.y]; }
  function off(n, h) { return [n.x + h[0], n.y + h[1]]; }
  for (var r = 0; r < mesh.rows - 1; r++) {
    for (var c = 0; c < C - 1; c++) {
      var iA = r * C + c, iB = iA + 1, iC = iA + C, iD = iC + 1;
      var A = nodes[iA], B = nodes[iB], Cn = nodes[iC], D = nodes[iD];
      patches.push({
        top: [P(A), off(A, tg[iA].E), off(B, tg[iB].W), P(B)],
        bottom: [P(Cn), off(Cn, tg[iC].E), off(D, tg[iD].W), P(D)],
        left: [P(A), off(A, tg[iA].S), off(Cn, tg[iC].N), P(Cn)],
        right: [P(B), off(B, tg[iB].S), off(D, tg[iD].N), P(D)],
        colors: [mgmHexRgb(A.color), mgmHexRgb(B.color), mgmHexRgb(Cn.color), mgmHexRgb(D.color)],
      });
    }
  }
  return patches;
}

function mgmBez(p, t) {
  var s = 1 - t, a = s * s * s, b = 3 * s * s * t, c2 = 3 * s * t * t, d = t * t * t;
  return [a * p[0][0] + b * p[1][0] + c2 * p[2][0] + d * p[3][0],
          a * p[0][1] + b * p[1][1] + c2 * p[2][1] + d * p[3][1]];
}

// Bilinearly blended Coons surface point (standard formula: ruled surfaces in
// u and v minus the bilinear of the corners).
function mgmCoonsPoint(patch, u, v) {
  var T = mgmBez(patch.top, u), Bo = mgmBez(patch.bottom, u);
  var L = mgmBez(patch.left, v), R = mgmBez(patch.right, v);
  var nw = patch.top[0], ne = patch.top[3], sw = patch.bottom[0], se = patch.bottom[3];
  var bu0 = 1 - u, bv0 = 1 - v;
  var out = [0, 0];
  for (var i = 0; i < 2; i++) {
    out[i] = bv0 * T[i] + v * Bo[i] + bu0 * L[i] + u * R[i]
      - (bu0 * bv0 * nw[i] + u * bv0 * ne[i] + bu0 * v * sw[i] + u * v * se[i]);
  }
  return out;
}

// Sample a patch on an (n+1)x(n+1) grid: positions via mgmCoonsPoint, colours
// bilinear across the corners. Row-major, v-major: index = iv*(n+1)+iu.
function mgmPatchGrid(patch, n) {
  var pts = [], cols = [], cs = patch.colors;
  for (var iv = 0; iv <= n; iv++) {
    var v = iv / n;
    for (var iu = 0; iu <= n; iu++) {
      var u = iu / n;
      pts.push(mgmCoonsPoint(patch, u, v));
      var c = [0, 0, 0];
      for (var i = 0; i < 3; i++) {
        var topc = cs[0][i] + (cs[1][i] - cs[0][i]) * u;
        var botc = cs[2][i] + (cs[3][i] - cs[2][i]) * u;
        c[i] = topc + (botc - topc) * v;
      }
      cols.push(c);
    }
  }
  return { n: n, pts: pts, cols: cols };
}
// === /lolly:shared mesh-core ===

// Module state beforeExport/afterExport need: the rendered mode, whether the
// current blend render drifts and its loop length, and the flow loop length
// (mirrors digi-ad's _animated/_totalDuration).
var _mode = 'blend';
var _animate = false;
var _speed = 12;
var _distance = 100;
var _flowSpeed = 20;

var _memoKey = null;
var _memoResult = null;

// ── blend (the original method) ─────────────────────────────────────────────

function computeBlend(a) {
  var count = _clamp(Math.round(_num(a.count, 5)), 2, 6); // fallback = the manifest default; clamp ceiling = the declared color1–6/pos1–6 inputs
  var pts = [];
  for (var i = 0; i < count; i++) {
    var p = _pos(a['pos' + (i + 1)], DEF_POS[i]);
    pts.push({ color: _safeColor(a['color' + (i + 1)], FALLBACK[i]), x: p.x, y: p.y });
  }
  var spread = _clamp(_num(a.spread, 75), 30, 140);
  var blur = _clamp(_num(a.blur, 0), 0, 40);
  var grain = _clamp(_num(a.grain, 0), 0, 100);
  var blend = ['soft-light', 'overlay', 'luminosity'].indexOf(a.grainBlend) >= 0 ? a.grainBlend : 'soft-light';
  var blobBlend = BLOB_BLENDS.indexOf(a.blend) >= 0 ? a.blend : 'normal';

  var R = spread / 100 * VBH;
  var defs = '<defs>';
  var blobs = [];
  pts.forEach(function (pt, idx) {
    var n = idx + 1;
    defs += '<radialGradient id="mg-g' + n + '" gradientUnits="userSpaceOnUse"'
      + ' cx="' + (pt.x * VBW / 100).toFixed(1) + '" cy="' + (pt.y * VBH / 100).toFixed(1) + '" r="' + R.toFixed(1) + '">'
      + '<stop offset="0" stop-color="' + pt.color + '"/>'
      + '<stop offset="0.5" stop-color="' + pt.color + '" stop-opacity="0.55"/>'
      + '<stop offset="1" stop-color="' + pt.color + '" stop-opacity="0"/>'
      + '</radialGradient>';
    blobs.push('<g class="mg-blob mg-blob-' + n + '"' + (blobBlend !== 'normal' ? ' style="mix-blend-mode:' + blobBlend + '"' : '') + '>'
      + '<rect x="-400" y="-500" width="2400" height="1900" fill="url(#mg-g' + n + ')"/></g>');
  });
  // Blob 1 paints LAST: over the opaque colour-1 base it would otherwise be a
  // pixel-perfect no-op (colour over itself), leaving pos1 a dead control.
  // On top it re-asserts the base colour into the mix, so dot 1 means something.
  var body = blobs.slice(1).join('') + blobs[0];
  var filter = _filterDef(blur, grain, blend);
  defs += filter + '</defs>';

  // Rects overscan the viewBox so drift and blur never pull in bare edges;
  // preserveAspectRatio="none" keeps every point visible at any export size.
  var svg = '<svg class="mg-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VBW + ' ' + VBH + '"'
    + ' width="100%" height="100%" preserveAspectRatio="none">'
    + (_animate ? _animCss(count, _speed, _distance) : '')
    + defs
    + '<g' + (filter ? ' filter="url(#mg-f)"' : '') + '>'
    + '<rect x="-400" y="-500" width="2400" height="1900" fill="' + pts[0].color + '"/>'
    + body
    + '</g></svg>';

  return {
    svgContent: svg,
    dotsJson: JSON.stringify(pts.map(function (pt) { return { x: pt.x, y: pt.y, color: pt.color }; })),
    meshJson: '',
  };
}

// ── subdivide + mesh (the Coons-patch methods) ──────────────────────────────

// The subdivide SVG must stay well under the dom-to-image node-count cliff
// (the filter tool froze a tab at ~28k nodes); 4096 flat quads is smooth at
// detail 4 and renders instantly everywhere.
var MAX_QUADS = 4096;

function _seedColors(a, count) {
  var colors = [];
  for (var i = 0; i < count; i++) colors.push(_hex6(a['color' + (i + 1)], FALLBACK[i]));
  return colors;
}

// Effective mesh for the current inputs: a valid meshData string wins;
// anything stale (unparseable, or a node count from an older rows/cols) falls
// back to the swatch-seeded default grid and asks the runtime to clear the
// input so the URL/save state stays honest.
function _effectiveMesh(a, rows, cols, colors) {
  var mesh = mgmParseMesh(a.meshData);
  var stale = false;
  if (mesh && (mesh.rows !== rows || mesh.cols !== cols)) { mesh = null; stale = true; }
  if (!mesh && String(a.meshData == null ? '' : a.meshData).trim()) stale = !stale ? true : stale;
  if (!mesh) mesh = mgmDefaultMesh(rows, cols, colors);
  return { mesh: mesh, stale: stale };
}

function _subdivSvg(mesh, curvature, detail, blur, grain, grainBlend) {
  var patches = mgmMeshPatches(mesh, curvature);
  var n = 1 << _clamp(Math.round(detail), 1, 4); // 2/4/8/16 quads per patch axis
  while (n > 1 && patches.length * n * n > MAX_QUADS) n >>= 1;
  // Base rect = mean node colour, overscanned like blend so a blur filter
  // never pulls transparent edges in.
  var mean = [0, 0, 0];
  mesh.nodes.forEach(function (nd) {
    var c = mgmHexRgb(nd.color);
    mean[0] += c[0]; mean[1] += c[1]; mean[2] += c[2];
  });
  var base = mgmRgbHex([mean[0] / mesh.nodes.length, mean[1] / mesh.nodes.length, mean[2] / mesh.nodes.length]);
  var body = '';
  var sx = VBW / 100, sy = VBH / 100;
  patches.forEach(function (patch) {
    var g = mgmPatchGrid(patch, n);
    var stride = n + 1;
    for (var iv = 0; iv < n; iv++) {
      for (var iu = 0; iu < n; iu++) {
        var i00 = iv * stride + iu, i10 = i00 + 1, i01 = i00 + stride, i11 = i01 + 1;
        var fill = mgmRgbHex([
          (g.cols[i00][0] + g.cols[i10][0] + g.cols[i01][0] + g.cols[i11][0]) / 4,
          (g.cols[i00][1] + g.cols[i10][1] + g.cols[i01][1] + g.cols[i11][1]) / 4,
          (g.cols[i00][2] + g.cols[i10][2] + g.cols[i01][2] + g.cols[i11][2]) / 4,
        ]);
        var d = 'M' + (g.pts[i00][0] * sx).toFixed(1) + ' ' + (g.pts[i00][1] * sy).toFixed(1)
          + 'L' + (g.pts[i10][0] * sx).toFixed(1) + ' ' + (g.pts[i10][1] * sy).toFixed(1)
          + 'L' + (g.pts[i11][0] * sx).toFixed(1) + ' ' + (g.pts[i11][1] * sy).toFixed(1)
          + 'L' + (g.pts[i01][0] * sx).toFixed(1) + ' ' + (g.pts[i01][1] * sy).toFixed(1) + 'Z';
        // Stroke = fill seals the hairline anti-aliasing seams between quads.
        body += '<path d="' + d + '" fill="' + fill + '" stroke="' + fill + '" stroke-width="1.2"/>';
      }
    }
  });
  var filter = _filterDef(blur, grain, grainBlend);
  return '<svg class="mg-svg mg-sub" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + VBW + ' ' + VBH + '"'
    + ' width="100%" height="100%" preserveAspectRatio="none">'
    + (filter ? '<defs>' + filter + '</defs>' : '')
    + '<g' + (filter ? ' filter="url(#mg-f)"' : '') + '>'
    + '<rect x="-400" y="-500" width="2400" height="1900" fill="' + base + '"/>'
    + body
    + '</g></svg>';
}

function computeMeshModes(a, mode) {
  var count = _clamp(Math.round(_num(a.count, 5)), 2, 6);
  var rows = _clamp(Math.round(_num(a.rows, 3)), 2, 5);
  var cols = _clamp(Math.round(_num(a.cols, 3)), 2, 5);
  var curvature = _clamp(_num(a.curvature, 55), 0, 100);
  var detail = _clamp(Math.round(_num(a.detail, 3)), 1, 4);
  var blur = _clamp(_num(a.blur, 0), 0, 40);
  var grain = _clamp(_num(a.grain, 0), 0, 100);
  var grainBlend = ['soft-light', 'overlay', 'luminosity'].indexOf(a.grainBlend) >= 0 ? a.grainBlend : 'soft-light';
  var eff = _effectiveMesh(a, rows, cols, _seedColors(a, count));
  var out = {
    dotsJson: '[]',
    meshJson: JSON.stringify({ rows: rows, cols: cols, curvature: curvature, nodes: eff.mesh.nodes }),
    svgContent: mode === 'subdivide'
      ? _subdivSvg(eff.mesh, curvature, detail, blur, grain, grainBlend)
      : '<canvas class="mg-mesh-canvas" width="' + VBW + '" height="' + VBH + '"></canvas>',
  };
  // Self-heal: a stale string would otherwise sit in the sidebar/URL while the
  // render ignores it.
  if (eff.stale) out.meshData = '';
  return out;
}

// ── flow (the whatamesh-style animated method) ──────────────────────────────

function computeFlow(a) {
  var count = _clamp(Math.round(_num(a.count, 5)), 2, 6);
  var colors = _seedColors(a, count);
  var speed = _clamp(Math.round(_num(a.flowSpeed, 20)), 4, 60);
  var scale = _clamp(_num(a.waveScale, 120), 30, 300);
  var amp = _clamp(_num(a.waveAmp, 60), 0, 100);
  var angle = _clamp(_num(a.angle, 25), 0, 360);
  var seed = _clamp(Math.round(_num(a.seed, 7)), 1, 999);
  // The CSS gradient backdrop is the no-WebGL / lost-context fallback: a GL
  // canvas that can't paint is transparent, so the backdrop shows through.
  var bg = 'linear-gradient(' + Math.round(angle + 90) + 'deg,' + colors.join(',') + ')';
  var cfg = JSON.stringify({ colors: colors, speed: speed, scale: scale, amp: amp, angle: angle, seed: seed });
  return {
    dotsJson: '[]',
    meshJson: '',
    svgContent: '<canvas class="mg-flow-canvas" width="' + VBW + '" height="' + VBH + '"'
      + ' style="background:' + bg + '" data-flow=\'' + cfg + '\'></canvas>',
  };
}

// ── warp (freeform points - photogradient / Illustrator freeform style) ─────

// Same control set as blend (colour points + positions + spread + drift), but
// rendered per-pixel by the template's WebGL shader as Shepard inverse-
// distance colour interpolation - the smooth "warped field" finish. Drift
// reuses blend's deterministic golden-angle orbits, evaluated in the shader
// from the loop phase, so exports are frame-exact via __lollyFrameRender.
function computeWarp(a) {
  var count = _clamp(Math.round(_num(a.count, 5)), 2, 6);
  var pts = [];
  var cssLayers = [];
  for (var i = 0; i < count; i++) {
    var p = _pos(a['pos' + (i + 1)], DEF_POS[i]);
    var c = _hex6(a['color' + (i + 1)], FALLBACK[i]);
    pts.push({ color: c, x: p.x, y: p.y });
    cssLayers.push('radial-gradient(circle at ' + p.x + '% ' + p.y + '%,' + c + ' 0%,transparent 60%)');
  }
  var spread = _clamp(_num(a.spread, 75), 30, 140);
  var cfg = JSON.stringify({
    colors: pts.map(function (pt) { return pt.color; }),
    pts: pts.map(function (pt) { return [pt.x, pt.y]; }),
    spread: spread, animate: _animate, speed: _speed, distance: _distance,
  });
  // Layered radial gradients = the no-WebGL / lost-context CSS fallback.
  var bg = cssLayers.join(',') + ',linear-gradient(' + pts[0].color + ',' + pts[0].color + ')';
  return {
    dotsJson: JSON.stringify(pts),
    meshJson: '',
    svgContent: '<canvas class="mg-warp-canvas" width="' + VBW + '" height="' + VBH + '"'
      + ' style="background:' + bg + '" data-warp=\'' + cfg + '\'></canvas>',
  };
}

// ── dispatch ────────────────────────────────────────────────────────────────

function compute(model) {
  var a = Object.fromEntries(model.map(function (i) { return [i.id, i.value]; }));
  var mode = MODES.indexOf(a.mode) >= 0 ? a.mode : 'blend';
  // Export-state module vars are set HERE, before the memo check - a memo hit
  // skips the per-mode compute functions, and beforeExport still needs these.
  _mode = mode;
  _animate = (mode === 'blend' || mode === 'warp') && Boolean(a.animate);
  _speed = _clamp(Math.round(_num(a.speed, 12)), 4, 24);
  _distance = _clamp(Math.round(_num(a.distance, 100)), 0, 200);
  _flowSpeed = _clamp(Math.round(_num(a.flowSpeed, 20)), 4, 60);

  var key = JSON.stringify([mode, a.count, a.color1, a.color2, a.color3, a.color4, a.color5, a.color6,
    a.pos1, a.pos2, a.pos3, a.pos4, a.pos5, a.pos6, a.spread, a.blur, a.grain, a.grainBlend, a.blend,
    a.animate, a.speed, a.distance, a.rows, a.cols, a.curvature, a.detail, a.meshData,
    a.flowSpeed, a.waveScale, a.waveAmp, a.angle, a.seed]);
  if (key === _memoKey) return _memoResult;

  var result;
  if (mode === 'subdivide' || mode === 'mesh') result = computeMeshModes(a, mode);
  else if (mode === 'flow') result = computeFlow(a);
  else if (mode === 'warp') result = computeWarp(a);
  else result = computeBlend(a);
  // The template reads the mode from this EXTRA, never from {{mode}} directly:
  // an input reference inside the wrap tag would make annotateTemplate map
  // every canvas click to a sidebar control popover (and its greedy matcher
  // picks whichever input id appears last in the expression).
  result.modeAttr = mode;

  _memoKey = key;
  _memoResult = result;
  return result;
}

// Brand palette for the canvas "shuffle colours" button and the mesh node
// colour picker - the same swatch set the colour picker offers
// (host.tokens.colors()), fetched once. The shuffle itself writes concrete
// values into the inputs, so a shuffled state stays deterministic /
// URL-expressible.
var _paletteJson = JSON.stringify(FALLBACK);
var _paletteLoaded = false;

async function _loadPalette(h) {
  if (_paletteLoaded) return;
  _paletteLoaded = true;
  try {
    if (h && h.tokens && h.tokens.colors) {
      var sw = await h.tokens.colors();
      var hex = [];
      (sw || []).forEach(function (s) {
        var v = String((s && s.value) || '').trim().toLowerCase();
        if (/^#[0-9a-f]{6}$/.test(v) && hex.indexOf(v) < 0) hex.push(v);
      });
      if (hex.length >= 2) _paletteJson = JSON.stringify(hex.slice(0, 32));
    }
  } catch (e) { /* keep the literal fallback palette */ }
}

async function onInit(ctx) {
  await _loadPalette((ctx && ctx.host) || (typeof host !== 'undefined' ? host : null));
  return Object.assign({}, compute(ctx.model), { paletteJson: _paletteJson });
}
function onInput(ctx) {
  return Object.assign({}, compute(ctx.model), { paletteJson: _paletteJson });
}

// Motion formats play the drift/flow; every other format freezes the base pose
// so a mid-loop transform never bakes into a "static" SVG/PNG. GIF samples the
// same live DOM as webm/mp4, just through the raster frame path at a fixed rate.
var ANIMATED_FORMATS = { webm: 1, mp4: 1, gif: 1 };
// Seconds. The GIF encoder runs at a fixed 15 fps and ignores opts.fps, and its
// frame ceiling is a function of device memory (as low as 200 frames on a small
// phone), so a whole 24s loop would be truncated mid-clip with only a bridge
// warning - and 1600x900 is a lot of pixels to quantise 360 times over. Same
// bound the digi-ad tools put on their GIF exports.
var GIF_CAP = 16;
var _exportSvg = null;

function _warnLoopCap(loop, cap) {
  if (cap >= loop || typeof host === 'undefined' || !host || typeof host.log !== 'function') return;
  try {
    host.log('warn', 'gradient: ' + loop + 's loop shortened to ' + cap
      + 's (export frame budget) - the seam will jump; shorten the loop, or lower the frame rate, for a clip that repeats cleanly.');
  } catch (e) { /* logging must never break an export */ }
}

function beforeExport(ctx) {
  if (_mode === 'warp') {
    // The warp canvas registers __lollyFrameRender too; a static warp needs
    // nothing, an animated one just needs the one-loop clip length.
    if (!_animate || !ANIMATED_FORMATS[ctx.format]) return;
    ctx.opts.wait = 0;
    if (ctx.opts.thumbnail || ctx.opts.durationUserSet) return;
    var wfps = ctx.opts.fps > 0 ? ctx.opts.fps : 24;
    var wcap = ctx.format === 'gif' ? GIF_CAP : Math.floor(595 / wfps);
    ctx.opts.duration = Math.min(_speed, wcap);
    _warnLoopCap(_speed, wcap);
    return;
  }
  if (_mode === 'flow') {
    // The flow canvas registers __lollyFrameRender, so the capture drives the
    // exact loop phase per frame - all that's left here is the clip length.
    if (!ANIMATED_FORMATS[ctx.format]) return;
    ctx.opts.wait = 0;
    if (ctx.opts.thumbnail || ctx.opts.durationUserSet) return;
    var ffps = ctx.opts.fps > 0 ? ctx.opts.fps : 24;
    var fcap = ctx.format === 'gif' ? GIF_CAP : Math.floor(595 / ffps);
    ctx.opts.duration = Math.min(_flowSpeed, fcap);
    _warnLoopCap(_flowSpeed, fcap);
    return;
  }
  if (_mode !== 'blend') return; // subdivide/mesh are static - nothing to stage
  var node = ctx.node;
  if (!_animate || !node || !node.querySelector) return;
  var svg = node.querySelector('svg.mg-svg');
  if (!svg) return;
  _exportSvg = svg;
  if (ANIMATED_FORMATS[ctx.format]) {
    // .mg-export lets the drift run during capture even under
    // prefers-reduced-motion (an explicit video export should move), then a
    // deterministic restart at t=0 (freeze → reflow → unfreeze) so the clip
    // opens at the loop origin.
    svg.classList.add('mg-export');
    svg.classList.add('mg-frozen'); void node.offsetWidth;
    svg.classList.remove('mg-frozen'); void node.offsetWidth;
    ctx.opts.wait = 0;
    // A composed child (host.compose - the "paste this tool's link into another
    // tool's picker" path) already has a length its caller chose and bounded,
    // and its clip is inlined into the parent's export. Keep the drift, keep the
    // caller's length: stretching it to a whole loop would embed a clip several
    // times the size the parent asked for.
    if (ctx.opts.thumbnail) return;
    // A length the user typed in the export bar wins (durationUserSet is the
    // shell's cross-agent flag for exactly that); otherwise the clip is one
    // drift loop, so it plays seamlessly on repeat.
    if (ctx.opts.durationUserSet) return;
    // 595 = the bridge's fps-aware frame ceiling (digi-ad precedent); GIF is
    // bounded in seconds instead, see GIF_CAP.
    var fps = ctx.opts.fps > 0 ? ctx.opts.fps : 24;
    var cap = ctx.format === 'gif' ? GIF_CAP : Math.floor(595 / fps);
    ctx.opts.duration = Math.min(_speed, cap);
    // The export can't fit a whole loop - say so instead of silently shipping a
    // clip that pops at the seam. host.log is a (level, msg) FUNCTION, not an
    // object of level methods.
    _warnLoopCap(_speed, cap);
  } else {
    svg.classList.add('mg-frozen');
  }
}

function afterExport(ctx) {
  var svg = _exportSvg;
  if (!svg) return;
  _exportSvg = null;
  svg.classList.remove('mg-export');
  // Restart the drift on the way out rather than just unfreezing it. A motion
  // capture PAUSES every CSS animation so it can scrub them frame by frame and
  // never resumes them, so the live canvas would sit still after an export.
  // Taking the animation property away across a reflow and putting it back
  // cancels those paused animations and starts fresh ones (the same restart
  // beforeExport uses), and clears the freeze a still export left behind.
  svg.classList.add('mg-frozen');
  if (ctx && ctx.node) void ctx.node.offsetWidth;
  else if (svg.getBoundingClientRect) svg.getBoundingClientRect();
  svg.classList.remove('mg-frozen');
}
