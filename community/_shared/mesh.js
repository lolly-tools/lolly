/* Coons-patch gradient-mesh core.
 *
 * Canonical source for the gradient tool's Subdivide (SVG) and Mesh
 * (canvas) modes - and written tool-agnostic so a future consumer (e.g. the
 * design tool's gradient paths) can sync the same regions. Coordinates are
 * percentages of the frame (0-100 on both axes); colours are '#rrggbb'.
 *
 * Model: a rows x cols grid of nodes {x, y, color, h?}. Edges between
 * neighbouring nodes are cubic Beziers whose control offsets come from
 * Catmull-Rom tangents scaled by `curvature` (50 = classic Catmull-Rom,
 * 0 = straight lines); `h` holds per-direction overrides ({E|W|N|S: [dx,dy]})
 * set by dragging a handle. Each cell of the grid is a Coons patch; colour is
 * bilinear across its four corners (the SVG 2 / Inkscape mesh model).
 */

// === lolly:shared mesh-core - canonical source; edit here and run npm run sync:shared ===
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

// === lolly:shared mesh-raster - canonical source; edit here and run npm run sync:shared ===
// Gouraud-shaded software rasteriser for mesh patches (the canvas Mesh mode).
// Fills triangles with barycentric colour interpolation straight into an
// ImageData buffer - no per-call canvas path overhead, no seams (inclusive
// edge test paints shared edges from both sides with the same colour).
function mgmFillTri(d, W, H, x0, y0, c0, x1, y1, c1, x2, y2, c2) {
  var area = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  if (area > -1e-9 && area < 1e-9) return;
  var inv = 1 / area;
  var minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
  var maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
  var minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
  var maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
  for (var y = minY; y <= maxY; y++) {
    var py = y + 0.5, row = y * W;
    for (var x = minX; x <= maxX; x++) {
      var px = x + 0.5;
      var w0 = (x1 - px) * (y2 - py) - (x2 - px) * (y1 - py);
      var w1 = (x2 - px) * (y0 - py) - (x0 - px) * (y2 - py);
      var w2 = area - w0 - w1;
      if (area > 0 ? (w0 < 0 || w1 < 0 || w2 < 0) : (w0 > 0 || w1 > 0 || w2 > 0)) continue;
      var i4 = (row + x) * 4;
      d[i4] = (w0 * c0[0] + w1 * c1[0] + w2 * c2[0]) * inv;
      d[i4 + 1] = (w0 * c0[1] + w1 * c1[1] + w2 * c2[1]) * inv;
      d[i4 + 2] = (w0 * c0[2] + w1 * c1[2] + w2 * c2[2]) * inv;
      d[i4 + 3] = 255;
    }
  }
}

// Paint every patch into an ImageData data buffer of W x H pixels. `n` is the
// per-patch subdivision (quads per axis); patch coords are 0-100 %, scaled to
// pixels here. Each sub-quad becomes two gouraud triangles.
function mgmPaintMesh(d, W, H, patches, n) {
  var sx = W / 100, sy = H / 100;
  for (var p = 0; p < patches.length; p++) {
    var g = mgmPatchGrid(patches[p], n);
    var stride = n + 1;
    for (var iv = 0; iv < n; iv++) {
      for (var iu = 0; iu < n; iu++) {
        var i00 = iv * stride + iu, i10 = i00 + 1, i01 = i00 + stride, i11 = i01 + 1;
        var a = g.pts[i00], b = g.pts[i10], c = g.pts[i01], e = g.pts[i11];
        mgmFillTri(d, W, H, a[0] * sx, a[1] * sy, g.cols[i00], b[0] * sx, b[1] * sy, g.cols[i10], e[0] * sx, e[1] * sy, g.cols[i11]);
        mgmFillTri(d, W, H, a[0] * sx, a[1] * sy, g.cols[i00], e[0] * sx, e[1] * sy, g.cols[i11], c[0] * sx, c[1] * sy, g.cols[i01]);
      }
    }
  }
}
// === /lolly:shared mesh-raster ===
