/* global host, window, document, Image */
/**
 * Growth - differential growth, rendered as real SVG paths.
 *
 * The whole simulation lives here as pure functions over flat [x,y,x,y,...]
 * arrays: no DOM, no wall clock, one seeded PRNG. That is what lets
 * tests/growth.test.ts drive it directly, and what makes state(t) a pure
 * function of (params, seed, step) - the tool's contract.
 *
 * The hooks run the sim and hand the template finished <path> markup, so a
 * still render (thumbnail, preview, URL, CLI) needs no script at all. The
 * template's rAF loop and the export frame clock advance the SAME functions
 * rather than a second copy - see the realm handoff at the bottom of the file.
 */

var VBW = 1200;
var VBH = 1200;

// ponytail: hard ceilings, load-bearing not cosmetic. Every one of these bounds
// something a URL param could otherwise make unbounded - node count is DOM size,
// step count and node-steps are wall-clock inside a 2s onInput budget, loops are
// one <path> element each, and the text cap mirrors the manifest maxLength.
// Upgrade path if they ever bind: move the sim to a worker, not upward.
var MAX_NODES = 8000;
var MAX_STEPS = 2400;
var MAX_LOOPS = 400;
var MAX_TEXT = 60;
// Total node-updates one render may spend. Node count grows exponentially, so
// steps alone bound nothing useful: this is the ceiling that actually holds the
// sim inside the hook budget once the node cap saturates.
var MAX_NODE_STEPS = 2000000;

// Logo tracing is deterministic by construction: fixed raster, fixed cut, fixed
// stride, so the same asset always seeds the same nodes. Shared rules with the
// synth swarm sampler (plans/157 §2.5) - change them in both or in neither.
var LOGO_RASTER = 256;
var LOGO_ALPHA = 0.5;
var LOGO_LUMA = 0.5;
var LOGO_STRIDE = 2;

// Curve subdivision for glyph outlines. host.text.toPath emits absolute
// M/L/C/Q/Z only (shells/web/src/bridge/text.ts transformPath).
var CURVE_STEPS = 8;

var FALLBACK_FAMILY = 'SUSE';
var FALLBACK_COLORS = ['#30ba78', '#ffffff', '#00bda7'];
var FALLBACK_BG = '#0c322c';

function _num(v, d) { var n = Number(v); return Number.isFinite(n) ? n : d; }
function _clamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }
function _r2(n) { return Math.round(n * 100) / 100; }

// Colour values land raw inside the SVG string (and can arrive via URL params),
// so allow only colour-function characters - never markup.
function _safeColor(v, fb) {
  v = (v == null ? '' : String(v)).trim();
  return v && /^[#a-zA-Z0-9(),.%\s\/-]+$/.test(v) ? v : fb;
}

function clampText(v) {
  return (v == null ? '' : String(v)).replace(/[\r\n\t]+/g, ' ').trim().slice(0, MAX_TEXT);
}

function mulberry32(a) {
  a = a >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── geometry ────────────────────────────────────────────────────────────────

function perimeter(pts) {
  var n = pts.length / 2, per = 0;
  for (var i = 0; i < n; i++) {
    var j = (i + 1) % n;
    per += Math.hypot(pts[j * 2] - pts[i * 2], pts[j * 2 + 1] - pts[i * 2 + 1]);
  }
  return per;
}

/** Even-arc-length resample of a CLOSED flat polyline. Idempotent to within
 *  the sampling error, which is what keeps a re-seed stable. */
function resampleClosed(pts, spacing) {
  var n = pts.length / 2;
  if (n < 3 || !(spacing > 0)) return pts.slice();
  var per = perimeter(pts), i, j;
  if (!(per > 0)) return pts.slice();
  var count = Math.max(3, Math.round(per / spacing));
  var stepLen = per / count;
  var out = [];
  var k = 0, target = 0, acc = 0;
  for (i = 0; i < n && k < count; i++) {
    j = (i + 1) % n;
    var x1 = pts[i * 2], y1 = pts[i * 2 + 1];
    var len = Math.hypot(pts[j * 2] - x1, pts[j * 2 + 1] - y1);
    while (k < count && target <= acc + len + 1e-9) {
      var t = len > 0 ? (target - acc) / len : 0;
      out.push(x1 + (pts[j * 2] - x1) * t, y1 + (pts[j * 2 + 1] - y1) * t);
      k++;
      target = k * stepLen;
    }
    acc += len;
  }
  while (out.length < count * 2) out.push(pts[0], pts[1]);
  return out;
}

/** SVG path data -> one closed flat polyline per subpath. A glyph's counters
 *  are separate subpaths, so an "O" yields two loops and both grow. */
function flattenPath(d) {
  var loops = [], cur = null, cx = 0, cy = 0, sx = 0, sy = 0, k, t, i;
  var re = /([MLCQZ])([^MLCQZ]*)/g, m;
  function close() {
    if (cur && cur.length >= 6) loops.push(cur);
    cur = null;
  }
  while ((m = re.exec(String(d || '')))) {
    var nums = (m[2].match(/-?\d*\.?\d+(?:[eE][+-]?\d+)?/g) || []).map(Number);
    if (m[1] === 'M') {
      close();
      if (nums.length < 2) continue;
      cx = nums[0]; cy = nums[1]; sx = cx; sy = cy;
      cur = [cx, cy];
      for (k = 2; k + 1 < nums.length; k += 2) { cx = nums[k]; cy = nums[k + 1]; cur.push(cx, cy); }
    } else if (m[1] === 'L') {
      if (!cur) continue;
      for (k = 0; k + 1 < nums.length; k += 2) { cx = nums[k]; cy = nums[k + 1]; cur.push(cx, cy); }
    } else if (m[1] === 'Q') {
      if (!cur) continue;
      for (k = 0; k + 3 < nums.length; k += 4) {
        var qx = nums[k], qy = nums[k + 1], ex = nums[k + 2], ey = nums[k + 3];
        for (i = 1; i <= CURVE_STEPS; i++) {
          t = i / CURVE_STEPS;
          var u = 1 - t;
          cur.push(u * u * cx + 2 * u * t * qx + t * t * ex, u * u * cy + 2 * u * t * qy + t * t * ey);
        }
        cx = ex; cy = ey;
      }
    } else if (m[1] === 'C') {
      if (!cur) continue;
      for (k = 0; k + 5 < nums.length; k += 6) {
        var b1x = nums[k], b1y = nums[k + 1], b2x = nums[k + 2], b2y = nums[k + 3];
        var c3x = nums[k + 4], c3y = nums[k + 5];
        for (i = 1; i <= CURVE_STEPS; i++) {
          t = i / CURVE_STEPS;
          var v = 1 - t;
          cur.push(
            v * v * v * cx + 3 * v * v * t * b1x + 3 * v * t * t * b2x + t * t * t * c3x,
            v * v * v * cy + 3 * v * v * t * b1y + 3 * v * t * t * b2y + t * t * t * c3y,
          );
        }
        cx = c3x; cy = c3y;
      }
    } else {
      close();
      cx = sx; cy = sy;
    }
  }
  close();
  return loops;
}

/** Boundary loops of a 0/1 mask. Each filled cell contributes the sides whose
 *  neighbour is empty, oriented with the fill on the left; chaining those unit
 *  edges gives one closed loop per region AND one per hole. */
function maskContours(mask, mw, mh) {
  function on(x, y) { return x >= 0 && y >= 0 && x < mw && y < mh && mask[y * mw + x] ? 1 : 0; }
  var starts = new Map();
  var x, y;
  function edge(ax, ay, bx, by) {
    var key = ax + ',' + ay;
    var b = starts.get(key);
    if (b) b.push(bx, by); else starts.set(key, [bx, by]);
  }
  for (y = 0; y < mh; y++) {
    for (x = 0; x < mw; x++) {
      if (!on(x, y)) continue;
      if (!on(x, y - 1)) edge(x, y, x + 1, y);
      if (!on(x + 1, y)) edge(x + 1, y, x + 1, y + 1);
      if (!on(x, y + 1)) edge(x + 1, y + 1, x, y + 1);
      if (!on(x - 1, y)) edge(x, y + 1, x, y);
    }
  }
  var loops = [];
  starts.forEach(function (_v, key) {
    while (loops.length < MAX_LOOPS) {
      var bucket = starts.get(key);
      if (!bucket || !bucket.length) return;
      var parts = key.split(',');
      var px = Number(parts[0]), py = Number(parts[1]);
      var loop = [];
      var cx = px, cy = py;
      while (loop.length < mw * mh * 2) {
        var b = starts.get(cx + ',' + cy);
        if (!b || !b.length) break;
        loop.push(cx, cy);
        var ny = b.pop(), nx = b.pop();
        cx = nx; cy = ny;
        if (cx === px && cy === py) break;
      }
      if (loop.length >= 8) loops.push(loop);
    }
  });
  return loops;
}

/** Uniformly scale loops into the frame's safe box, centred on (cx, cy) - which
 *  is the seed's own centre, NOT the frame's: a stamped organism has to sit off
 *  the mirror axis. Stamping also halves the box, or the copies fill the frame. */
function fitLoops(loops, P, cx, cy) {
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, i, k;
  for (i = 0; i < loops.length; i++) {
    for (k = 0; k < loops[i].length; k += 2) {
      if (loops[i][k] < minX) minX = loops[i][k];
      if (loops[i][k] > maxX) maxX = loops[i][k];
      if (loops[i][k + 1] < minY) minY = loops[i][k + 1];
      if (loops[i][k + 1] > maxY) maxY = loops[i][k + 1];
    }
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return loops;
  var box = P.stamps > 1 ? P.fitBox * 0.5 : P.fitBox;
  var s = Math.min(box / (maxX - minX), box / (maxY - minY));
  var ox = cx - (minX + maxX) / 2 * s;
  var oy = cy - (minY + maxY) / 2 * s;
  return loops.map(function (L) {
    var out = new Array(L.length);
    for (var j = 0; j < L.length; j += 2) {
      out[j] = L[j] * s + ox;
      out[j + 1] = L[j + 1] * s + oy;
    }
    return out;
  });
}

function ringPoints(cx, cy, r, n) {
  var out = [];
  for (var i = 0; i < n; i++) {
    var a = i / n * Math.PI * 2;
    out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return out;
}

/**
 * Starting loops for a shape. `contours` carries the traced outlines for the
 * text/logo seeds; an empty list falls back to a ring so the canvas is never
 * silently blank.
 */
function buildSeed(shape, contours, P, rand) {
  // Symmetry simulates ONE organism and stamps it, so its seed sits off-centre
  // or the copies would land on top of each other: mirror flips about the
  // vertical axis, the radial stamps rotate about the middle.
  var nudge = P.stamps > 1 ? P.fitBox * 0.22 : 0;
  var cx = P.w / 2 - (P.stamps === 2 ? nudge : 0);
  var cy = P.h / 2 - (P.stamps > 2 ? nudge : 0);
  var loops = [];
  if ((shape === 'text' || shape === 'logo') && contours && contours.length) {
    loops = fitLoops(contours.slice(0, MAX_LOOPS), P, cx, cy);
  } else if (shape === 'line') {
    // A closed loop squashed flat: an open polyline would need pinned endpoints,
    // and a ribbon grows the same way for none of that special-casing.
    var half = P.fitBox * 0.42, thin = P.spacing * 1.2, line = [];
    for (var q = 0; q < 120; q++) {
      var ang = q / 120 * Math.PI * 2;
      line.push(cx + Math.cos(ang) * half, cy + Math.sin(ang) * thin);
    }
    loops = [line];
  } else if (shape === 'burst') {
    var R = P.fitBox * 0.30;
    for (var b = 0; b < 3; b++) {
      var a = (b / 3) * Math.PI * 2 - Math.PI / 2;
      loops.push(ringPoints(cx + Math.cos(a) * R, cy + Math.sin(a) * R, P.fitBox * 0.13, 48));
    }
  } else {
    loops = [ringPoints(cx, cy, P.fitBox * 0.30, 64)];
  }
  // The node ceiling has to bind on the SEED too, not just on injected growth: a
  // traced logo or headline carries far more contour than P.spacing would ever
  // grow into, and the sim would then spend its whole budget on an ungrown blob.
  // Coarsening the spacing keeps every contour; the running total is the backstop.
  var per = 0;
  for (var p = 0; p < loops.length && p < MAX_LOOPS; p++) per += perimeter(loops[p]);
  var spacing = Math.max(P.spacing, per / (MAX_NODES * 0.8));
  // A hair of seeded jitter: a mathematically perfect ring has no asymmetry to
  // buckle from, so it would breathe outward forever instead of folding.
  var out = [], total = 0;
  for (var i = 0; i < loops.length && out.length < MAX_LOOPS; i++) {
    var L = resampleClosed(loops[i], spacing);
    total += L.length / 2;
    if (total > MAX_NODES) break;
    for (var k = 0; k < L.length; k++) L[k] += (rand() - 0.5) * P.jitter;
    out.push(L);
  }
  return out;
}

// ── simulation ──────────────────────────────────────────────────────────────

function countNodes(loops) {
  var n = 0;
  for (var i = 0; i < loops.length; i++) n += loops[i].length / 2;
  return n;
}

function simState(seedLoops, P) {
  var loops = [];
  for (var i = 0; i < seedLoops.length; i++) loops.push(seedLoops[i].slice());
  return { loops: loops, rand: mulberry32(P.seed), step: 0, nodes: countNodes(loops), work: 0 };
}

/**
 * One fixed timestep. Three forces plus node injection, in that order:
 * neighbour attraction (a spring that only ever pulls, never pushes), a small
 * alignment pull toward the neighbours' midpoint for smoothness, and repulsion
 * from every OTHER node inside `repel` through a spatial hash - the immediate
 * neighbours are excluded, or the spring and the repulsion would just find an
 * equilibrium and the curve would stop growing.
 *
 * The lengthening is the injection, not the forces: a fixed fraction of nodes
 * per step, chosen by a step-advancing stride so it is even and deterministic.
 * Mutates `st` in a fixed iteration order - that order IS the determinism
 * guarantee.
 */
function stepOnce(st, P) {
  var loops = st.loops, li, i;
  var cell = P.repel;
  var grid = new Map();
  for (li = 0; li < loops.length; li++) {
    var L0 = loops[li];
    for (i = 0; i < L0.length; i += 2) {
      var key = Math.floor(L0[i] / cell) + ',' + Math.floor(L0[i + 1] / cell);
      var bucket = grid.get(key);
      if (bucket) bucket.push(li, i); else grid.set(key, [li, i]);
    }
  }
  var rMax2 = cell * cell;
  for (li = 0; li < loops.length; li++) {
    var L = loops[li];
    var n = L.length / 2;
    if (n < 3) continue;
    var next = new Array(L.length);
    for (i = 0; i < n; i++) {
      var x = L[i * 2], y = L[i * 2 + 1];
      var pi = (i + n - 1) % n, ni = (i + 1) % n;
      var dx = ((L[pi * 2] + L[ni * 2]) / 2 - x) * P.align;
      var dy = ((L[pi * 2 + 1] + L[ni * 2 + 1]) / 2 - y) * P.align;
      for (var s = 0; s < 2; s++) {
        var si = s ? ni : pi;
        var sx = L[si * 2] - x, sy = L[si * 2 + 1] - y;
        var sd = Math.hypot(sx, sy);
        if (sd > 0) {
          var sf = (sd - P.spacing) * P.attract / sd;
          dx += sx * sf;
          dy += sy * sf;
        }
      }
      var gx = Math.floor(x / cell), gy = Math.floor(y / cell);
      for (var ox = -1; ox <= 1; ox++) {
        for (var oy = -1; oy <= 1; oy++) {
          var b = grid.get((gx + ox) + ',' + (gy + oy));
          if (!b) continue;
          for (var bi = 0; bi < b.length; bi += 2) {
            var ol = b[bi], oi = b[bi + 1];
            if (ol === li && (oi === i * 2 || oi === pi * 2 || oi === ni * 2)) continue;
            var vx = x - loops[ol][oi], vy = y - loops[ol][oi + 1];
            var d2 = vx * vx + vy * vy;
            if (d2 >= rMax2 || d2 === 0) continue;
            var dist = Math.sqrt(d2);
            var f = (1 - dist / cell) * P.push / dist;
            dx += vx * f;
            dy += vy * f;
          }
        }
      }
      next[i * 2] = _clamp(x + dx, P.margin, P.w - P.margin);
      next[i * 2 + 1] = _clamp(y + dy, P.margin, P.h - P.margin);
    }
    loops[li] = next;
  }
  for (li = 0; li < loops.length; li++) {
    if (st.nodes >= MAX_NODES) break;
    var S = loops[li];
    var m = S.length / 2;
    var out = [];
    for (i = 0; i < m; i++) {
      var j = (i + 1) % m;
      out.push(S[i * 2], S[i * 2 + 1]);
      if (st.nodes >= MAX_NODES) continue;
      var ax = S[i * 2], ay = S[i * 2 + 1];
      var bx = S[j * 2], by = S[j * 2 + 1];
      var seg = Math.hypot(bx - ax, by - ay);
      if (seg > P.maxSeg || (seg >= P.growMin && (i + st.step) % P.growEvery === 0)) {
        out.push((ax + bx) / 2 + (st.rand() - 0.5) * P.jitter, (ay + by) / 2 + (st.rand() - 0.5) * P.jitter);
        st.nodes++;
      }
    }
    loops[li] = out;
  }
  st.work += st.nodes;
  st.step++;
  return st;
}

/** Advance to `target` steps, or until the node-step budget runs out. */
function runTo(st, P, target) {
  var limit = Math.min(_num(target, 0), MAX_STEPS);
  while (st.step < limit && st.work < MAX_NODE_STEPS) stepOnce(st, P);
  return st;
}

// ── render ──────────────────────────────────────────────────────────────────

function pathD(loop) {
  var d = '';
  for (var i = 0; i < loop.length; i += 2) {
    d += (i ? 'L' : 'M') + _r2(loop[i]) + ',' + _r2(loop[i + 1]);
  }
  return d + 'Z';
}

function flipX(loop, w) {
  var out = loop.slice();
  for (var i = 0; i < out.length; i += 2) out[i] = w - out[i];
  return out;
}

/** One transform per stamped copy of the simulated organism. Mirror is NOT a
 *  scale(-1) group: the PDF walker averages a group's x and y scale into its
 *  stroke multiplier, so a reflection exports every stroke at the 0.1pt floor.
 *  The mirrored copy carries x-flipped path data instead. */
function symmetryStamps(sym, w, h) {
  var c = (w / 2) + ',' + (h / 2);
  if (sym === 'mirror') return ['', ''];
  if (sym === 'radial-3') return ['', 'rotate(120,' + c + ')', 'rotate(240,' + c + ')'];
  if (sym === 'radial-6') {
    return ['', 'rotate(60,' + c + ')', 'rotate(120,' + c + ')', 'rotate(180,' + c + ')',
      'rotate(240,' + c + ')', 'rotate(300,' + c + ')'];
  }
  return [''];
}

// Plain attributes, no classes: the SVG walker exports these verbatim, which is
// the whole plotter claim.
function loopsToPaths(loops, colors, weight, taper) {
  var out = '';
  for (var i = 0; i < loops.length; i++) {
    var w = taper && loops.length > 1
      ? Math.max(0.3, weight * (1 - 0.55 * i / (loops.length - 1)))
      : weight;
    out += '<path data-l="' + i + '" d="' + pathD(loops[i]) + '" fill="none" stroke="'
      + colors[i % colors.length] + '" stroke-width="' + _r2(w)
      + '" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  return out;
}

/** Rotate the palette so each stamped copy leads with a different colour - the
 *  stamps already duplicate the path data, so only the stroke attribute varies
 *  and a symmetric piece weaves instead of reading as one flat repeat. */
function _rotate(arr, i) {
  i = i % arr.length;
  return arr.slice(i).concat(arr.slice(0, i));
}

function stampGroups(stamps, mk, flipIndex) {
  var out = '';
  for (var i = 0; i < stamps.length; i++) {
    var isFlip = i === flipIndex;
    out += '<g' + (stamps[i] ? ' transform="' + stamps[i] + '"' : '')
      + (isFlip ? ' data-flip="1"' : '') + '>' + mk(i, isFlip) + '</g>';
  }
  return out;
}

// ── params ──────────────────────────────────────────────────────────────────

function buildParams(a) {
  var density = _clamp(_num(a.density, 46), 20, 100);
  // Repulsion radius in px - the gap the finished pattern keeps between its own
  // strands. Node spacing sits well inside it so a strand reads as a line.
  var repel = 22 - (density - 20) / 80 * 14;
  var spacing = repel * 0.45;
  var stamps = symmetryStamps(a.symmetry, VBW, VBH).length;
  return {
    w: VBW,
    h: VBH,
    fitBox: VBW - 160,
    repel: repel,
    spacing: spacing,
    maxSeg: repel * 0.9,
    jitter: repel * 0.05,
    // The spring holds segments at exactly `spacing`, so injecting on `>= spacing`
    // would be a knife edge that never fires; a fresh half-segment stays under
    // this gate for a few steps, which is what rate-limits the growth.
    growMin: spacing * 0.8,
    attract: 0.16,
    align: 0.06,
    push: 0.45,
    growEvery: 45,
    margin: 40,
    stamps: stamps,
    seed: _clamp(Math.round(_num(a.seed, 7)), 0, 9999),
    steps: _clamp(Math.round(_num(a.steps, 300)), 0, MAX_STEPS),
  };
}

// ── seeds that need the host ────────────────────────────────────────────────

function safeJson(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

async function familyFor(h) {
  try {
    if (h && h.tokens && h.tokens.resolve) {
      var fam = await h.tokens.resolve('{font.brand}');
      if (typeof fam === 'string' && fam && fam.indexOf('{') !== 0) return fam;
    }
  } catch (e) { /* keep the platform face */ }
  return FALLBACK_FAMILY;
}

async function textContours(h, text) {
  if (!h || !h.text || !h.text.fontUrl || !h.text.toPath) {
    throw new Error('this host cannot resolve fonts');
  }
  var family = await familyFor(h);
  var f = await h.text.fontUrl(family, { weight: 700 });
  if (!f || !f.url) throw new Error('no font file found for "' + family + '"');
  var run = await h.text.toPath({ text: text, fontUrl: f.url, fontSize: 200, variations: f.variations });
  if (!run || !run.d) throw new Error('nothing to outline');
  var loops = flattenPath(run.d);
  if (!loops.length) throw new Error('nothing to outline');
  return loops;
}

// An asset ref may arrive already carrying its url, or as an id the host still
// has to resolve - the community convention from link-card / certificate.
async function logoUrl(h, ref) {
  if (!ref) return '';
  if (typeof ref.url === 'string' && ref.url) return ref.url;
  try {
    if (h && h.assets && h.assets.get && ref.id) {
      var full = await h.assets.get(ref.id);
      if (full && typeof full.url === 'string') return full.url;
    }
  } catch (e) { /* fall through to the note */ }
  return '';
}

/** Rasterise the logo once at a FIXED size and trace its silhouette. Offscreen
 *  only - nothing here is ever attached to a document. */
async function logoContours(url) {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error('this host cannot rasterise a logo');
  }
  var img = await new Promise(function (res, rej) {
    var el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = function () { res(el); };
    el.onerror = function () { rej(new Error('the logo could not be loaded')); };
    el.src = url;
  });
  var cv = document.createElement('canvas');
  cv.width = LOGO_RASTER;
  cv.height = LOGO_RASTER;
  var ctx = cv.getContext('2d');
  if (!ctx) throw new Error('this host cannot rasterise a logo');
  var iw = img.naturalWidth || img.width || 1;
  var ih = img.naturalHeight || img.height || 1;
  var s = Math.min(LOGO_RASTER / iw, LOGO_RASTER / ih);
  ctx.drawImage(img, (LOGO_RASTER - iw * s) / 2, (LOGO_RASTER - ih * s) / 2, iw * s, ih * s);
  var data = ctx.getImageData(0, 0, LOGO_RASTER, LOGO_RASTER).data;
  var mw = Math.ceil(LOGO_RASTER / LOGO_STRIDE);
  var mask = new Uint8Array(mw * mw);
  for (var my = 0; my < mw; my++) {
    for (var mx = 0; mx < mw; mx++) {
      var p = ((my * LOGO_STRIDE) * LOGO_RASTER + mx * LOGO_STRIDE) * 4;
      var alpha = data[p + 3] / 255;
      var luma = (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) / 255;
      mask[my * mw + mx] = alpha > LOGO_ALPHA && luma < LOGO_LUMA ? 1 : 0;
    }
  }
  var loops = maskContours(mask, mw, mw);
  if (!loops.length) throw new Error('the logo traced to nothing');
  return loops;
}

// ── hooks ───────────────────────────────────────────────────────────────────

var _memoKey = null;
var _memoResult = null;

async function compute(model, h) {
  var a = {};
  for (var i = 0; i < model.length; i++) a[model[i].id] = model[i].value;

  var shape = ['ring', 'line', 'burst', 'text', 'logo'].indexOf(a.seedShape) >= 0 ? a.seedShape : 'burst';
  var text = clampText(a.text) || 'GROW';
  var logoRef = a.logo && typeof a.logo === 'object' ? a.logo : null;
  var logoKey = logoRef ? String(logoRef.url || logoRef.id || '') : '';
  var colors = [
    _safeColor(a.color1, FALLBACK_COLORS[0]),
    _safeColor(a.color2, FALLBACK_COLORS[1]),
    _safeColor(a.color3, FALLBACK_COLORS[2]),
  ];
  var bg = _safeColor(a.background, FALLBACK_BG);
  var weight = _clamp(_num(a.weight, 3), 0.1, 8);
  var taper = a.taper === true;
  var grown = a.grown !== false;
  var sym = ['none', 'mirror', 'radial-3', 'radial-6'].indexOf(a.symmetry) >= 0 ? a.symmetry : 'none';
  var P = buildParams({ density: a.density, seed: a.seed, steps: a.steps, symmetry: sym });

  var key = JSON.stringify([shape, text, logoKey, colors, bg, weight, taper, grown, sym, P]);
  if (key === _memoKey) return _memoResult;

  var contours = null;
  var note = '';
  if (shape === 'text') {
    try { contours = await textContours(h, text); }
    catch (err) { note = 'Grown from a ring: ' + (err && err.message ? err.message : 'the headline could not be outlined') + '.'; }
  } else if (shape === 'logo') {
    try {
      var url = await logoUrl(h, logoRef);
      if (!url) throw new Error('pick a logo to trace');
      contours = await logoContours(url);
    } catch (err2) {
      note = 'Grown from a ring: ' + (err2 && err2.message ? err2.message : 'the logo could not be traced') + '.';
    }
  }

  var rand = mulberry32(P.seed ^ 0x9e3779b9);
  // Only the TRACED seeds may fall back to a ring (their contours can fail to
  // resolve); burst/line/ring pass through - the old check collapsed every
  // non-traced seed to a ring, so the default burst never actually ran.
  var traced = shape === 'text' || shape === 'logo';
  var seedLoops = buildSeed(traced && !(contours && contours.length) ? 'ring' : shape, contours, P, rand);
  var st = simState(seedLoops, P);
  if (grown) runTo(st, P, P.steps);

  var stamps = symmetryStamps(sym, P.w, P.h);
  var flippedLoops = sym === 'mirror'
    ? st.loops.map(function (L) { return flipX(L, P.w); })
    : null;
  _memoKey = key;
  _memoResult = {
    _paths: stampGroups(stamps, function (i, isFlip) {
      return loopsToPaths(isFlip ? flippedLoops : st.loops, _rotate(colors, i), weight, taper);
    }, sym === 'mirror' ? 1 : -1),
    _state: safeJson({ seed: seedLoops, P: P, steps: P.steps, grown: grown, flip: !!flippedLoops }),
    bgColor: bg,
    note: note,
  };
  return _memoResult;
}

function onInit(ctx) { return compute(ctx.model, (ctx && ctx.host) || (typeof host !== 'undefined' ? host : null)); }
function onInput(ctx) { return compute(ctx.model, (ctx && ctx.host) || (typeof host !== 'undefined' ? host : null)); }

// The template's rAF loop and the export frame clock advance THESE functions
// rather than a second copy of the sim: hooks run in-realm and always before the
// template hydrates, so the handoff is a plain property on the realm - the same
// mechanism `window.LollyThree` uses in the 3d tool. Absent in Node (tests) and
// in any shell that runs hooks elsewhere; the template then just keeps the
// still paths this file already rendered.
if (typeof window !== 'undefined') {
  window.__lollyGrowthSim = { simState: simState, stepOnce: stepOnce, runTo: runTo, pathD: pathD, flipX: flipX };
}
