/* global host */
/**
 * Signature hooks.
 *
 * The tool holds ONE piece of data: `strokes`, a string of SVG move-commands,
 * one per stroke, written by the pad in the template. Everything here turns
 * that string into the paths the template draws:
 *
 *  - parse: tolerant on purpose. The value can arrive from the pad, a share
 *    link, a paste or the CLI, so both the pad's compact form
 *    ("M120,300L124,290") and hand-pasted spaced path data ("M 120 300 L 124
 *    290") read the same, and anything unreadable is COUNTED into `warning`
 *    rather than dropped in silence.
 *  - smooth: 0 keeps the recorded polyline. Above 0 a local Chaikin pass
 *    rounds the corners a pointer records as hard turns. It is arithmetic on
 *    the stored points, so every shell draws the same signature.
 *
 *    host.geom.simplify was measured first and is deliberately NOT used: it
 *    fits cubics to CURVES, and a recorded stroke is all line segments, so on
 *    hand-drawn input it returns a path with about the same segment count (60
 *    in, 57 out), unchanged from tolerance 0.6 to 6, and LONGER as text
 *    because a cubic costs six numbers where a line costs two. The jitter
 *    survives. Corner cutting is what actually smooths handwriting, and
 *    keeping one route means the CLI, the web shell and an embedding host
 *    cannot disagree about what a signature looks like.
 *  - trim: the viewBox is tightened to the ink's bounding box plus a margin
 *    that covers the pen's own width, so the signature fills the frame.
 *
 * Nothing is drawn behind the strokes: the sheet is transparent, and the
 * export bar's "No BG" toggle keeps raster exports that way (beforeExport).
 *
 * The hook never throws - a failure ends up in `warning` as plain text.
 */

// The drawing frame, and the coordinate space every stored point lives in.
// It matches render.width / render.height, so a point is a pixel at 1x.
var FRAME_W = 1200;
var FRAME_H = 400;

// Ceilings. A signature is a few dozen strokes; these exist so a pasted or
// hand-built value cannot make the template unbounded. Both are reported.
var MAX_STROKES = 400;
var MAX_POINTS = 6000;
// Past this a coordinate is not a slip of the pen, it is corrupt data.
var COORD_LIMIT = 100000;

function num(v, fb) {
  var n = typeof v === 'number' ? v : parseFloat(v);
  return isFinite(n) ? n : fb;
}

function clamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }

// One decimal is the pen's own resolution; more is bytes nobody can see.
function r1(n) {
  var v = Math.round(n * 10) / 10;
  return v === 0 ? 0 : v;
}

// Colour values land raw inside an SVG attribute, so only a real hex form is
// accepted - an unresolved {color.semantic.*} alias flattens to '' on a brand
// with no tokens, and takes the neutral ink below.
function hex(v, fb) {
  var s = (v == null ? '' : String(v)).trim().toLowerCase();
  var m3 = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(s);
  if (m3) return '#' + m3[1] + m3[1] + m3[2] + m3[2] + m3[3] + m3[3];
  var m6 = /^#?([0-9a-f]{6})$/.exec(s);
  return m6 ? '#' + m6[1] : fb;
}

// ── parse ────────────────────────────────────────────────────────────────────

/**
 * "M10,20L12,22 M40,50" -> { strokes: [[[10,20],[12,22]], [[40,50]]], … }
 *
 * Split on the move command rather than on whitespace: the pad never writes a
 * space inside a stroke, but a person pasting path data from elsewhere does,
 * and splitting on spaces would turn one readable path into a pile of junk.
 */
function parseStrokes(value) {
  var out = { strokes: [], skipped: 0, points: 0, truncated: '' };
  var raw = value == null ? '' : String(value);
  if (!raw.trim()) return out;

  var segs = raw.split(/(?=[Mm])/);
  for (var i = 0; i < segs.length; i++) {
    var seg = segs[i];
    if (!seg || !seg.trim()) continue;
    // A stroke is a move plus straight segments, which is all a pointer records.
    // Anything else in there - a curve or arc command, a relative m/l, an
    // exponent - has its numbers read as bare coordinate pairs and would put ink
    // in the wrong place, so it is counted as unreadable instead of guessed at.
    if (!/^M/.test(seg.trim()) || /[^ML0-9.,\s+-]/.test(seg)) { out.skipped++; continue; }

    var nums = seg.match(/-?(?:\d+\.?\d*|\.\d+)/g) || [];
    var pts = [];
    var bad = false;
    for (var j = 0; j + 1 < nums.length; j += 2) {
      var x = parseFloat(nums[j]);
      var y = parseFloat(nums[j + 1]);
      // A coordinate this far out is corrupt data, and the rest of the stroke
      // cannot be trusted either - so the whole stroke is counted, not thinned
      // down to the points that happened to look sane.
      if (!isFinite(x) || !isFinite(y) || Math.abs(x) > COORD_LIMIT || Math.abs(y) > COORD_LIMIT) {
        bad = true;
        break;
      }
      pts.push([r1(x), r1(y)]);
    }
    if (bad || !pts.length) { out.skipped++; continue; }

    if (out.strokes.length >= MAX_STROKES) { out.truncated = 'strokes'; break; }
    // Past the point budget the stroke is CLIPPED, not dropped: one pasted
    // stroke over the budget would otherwise leave the whole sheet blank.
    if (out.points + pts.length > MAX_POINTS) {
      pts = pts.slice(0, MAX_POINTS - out.points);
      out.truncated = 'points';
      if (!pts.length) break;
    }
    out.strokes.push(pts);
    out.points += pts.length;
    if (out.truncated) break;
  }
  return out;
}

/** The canonical text form of parsed strokes - what the pad commits back. */
function serialise(strokes) {
  var parts = [];
  for (var i = 0; i < strokes.length; i++) {
    var pts = strokes[i];
    var s = 'M';
    for (var j = 0; j < pts.length; j++) {
      s += (j ? 'L' : '') + pts[j][0] + ',' + pts[j][1];
    }
    parts.push(s);
  }
  return parts.join(' ');
}

// ── smoothing ────────────────────────────────────────────────────────────────

function polyD(pts) {
  if (!pts.length) return '';
  // A one-point stroke is a dot: a zero-length subpath under a round cap.
  if (pts.length === 1) return 'M' + pts[0][0] + ',' + pts[0][1] + 'L' + pts[0][0] + ',' + pts[0][1];
  var d = 'M' + pts[0][0] + ',' + pts[0][1];
  for (var i = 1; i < pts.length; i++) d += 'L' + pts[i][0] + ',' + pts[i][1];
  return d;
}

/**
 * Chaikin corner cutting, endpoints pinned. Every new point is a fixed blend
 * of two old ones, so it is exactly reproducible and can only move the line
 * INWARD, never outside the hull the bounding box was measured from - which is
 * what lets the trim margin be a constant rather than a function of the
 * smoothing setting.
 */
function chaikin(pts, iterations) {
  var cur = pts;
  for (var k = 0; k < iterations; k++) {
    if (cur.length < 3) break;
    var next = [cur[0]];
    for (var i = 0; i < cur.length - 1; i++) {
      var a = cur[i];
      var b = cur[i + 1];
      next.push([r1(a[0] + (b[0] - a[0]) * 0.25), r1(a[1] + (b[1] - a[1]) * 0.25)]);
      next.push([r1(a[0] + (b[0] - a[0]) * 0.75), r1(a[1] + (b[1] - a[1]) * 0.75)]);
    }
    next.push(cur[cur.length - 1]);
    cur = next;
  }
  return cur;
}

/**
 * One stroke's rendered path data, plus which route drew it. Two points have
 * no corner to cut, so they come back as recorded whatever the slider says.
 */
function smoothStroke(pts, smoothing) {
  if (smoothing <= 0 || pts.length < 3) return { d: polyD(pts), mode: 'raw' };
  // Above the halfway mark a second pass runs: one is a rounded corner, two is
  // a flowing line. More than two only adds points nobody can see.
  return { d: polyD(chaikin(pts, smoothing > 50 ? 2 : 1)), mode: 'smooth' };
}

// ── frame ────────────────────────────────────────────────────────────────────

function inkBox(strokes) {
  var x0 = Infinity;
  var y0 = Infinity;
  var x1 = -Infinity;
  var y1 = -Infinity;
  for (var i = 0; i < strokes.length; i++) {
    for (var j = 0; j < strokes[i].length; j++) {
      var p = strokes[i][j];
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    }
  }
  return isFinite(x0) ? { x0: x0, y0: y0, x1: x1, y1: y1 } : null;
}

/**
 * The trimmed viewBox. The margin is half the pen (the cap paints there, so
 * without it every export clips the outer edge of the line) plus a fixed
 * breathing space. Smoothing never widens the box: corner cutting stays inside
 * the points it was measured on.
 */
function trimmedViewBox(box, penWidth) {
  var pad = penWidth / 2 + 12;
  var x = r1(box.x0 - pad);
  var y = r1(box.y0 - pad);
  var w = r1(box.x1 - box.x0 + pad * 2);
  var h = r1(box.y1 - box.y0 + pad * 2);
  return x + ' ' + y + ' ' + w + ' ' + h;
}

// ── designed path data ───────────────────────────────────────────────────────

// A command the DRAWING PAD never writes. The pad only ever emits absolute
// M/L polylines, so any curve (c/s/q/t/a), relative move (m/l) or shorthand
// (h/v/z) means the value is a signature someone pasted or authored as real SVG
// path data - render it as given rather than reading its numbers as bare point
// pairs (which is what put a curved signature in the wrong place, unread).
var PAD_ONLY = /[CcSsQqTtAaHhVvZzml]/;
// The SVG path-data grammar. The value lands raw in a `d` attribute, so a value
// with any character outside this is refused, not rendered as garbage.
var PATH_GRAMMAR = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]*$/;

/**
 * A pasted/authored SVG path -> one verbatim path plus its trimmed frame, or
 * null when the value is plain pad polyline data (the existing point pipeline
 * handles that). The tight box comes from host.geom (curve-aware, exact); a
 * hand-typed polyline of straight segments would box fine from its points, but
 * a real signature's coordinates live on the curves between them, so points
 * would trim too tight.
 */
function richPath(value, penWidth, trim) {
  var d = (value == null ? '' : String(value)).trim();
  if (!d || !PAD_ONLY.test(d)) return null;
  if (!PATH_GRAMMAR.test(d)) {
    return { d: '', viewBox: '0 0 ' + FRAME_W + ' ' + FRAME_H, trimmed: false,
      warning: 'That signature is not readable SVG path data, so nothing is drawn.' };
  }
  var viewBox = '0 0 ' + FRAME_W + ' ' + FRAME_H;
  var trimmed = false;
  var warning = '';
  if (trim) {
    var res = typeof host !== 'undefined' && host && host.geom && host.geom.bounds
      ? host.geom.bounds(d) : null;
    var b = res && res.ok ? res.value : null;
    if (b && isFinite(b.x0) && isFinite(b.y0) && isFinite(b.x1) && isFinite(b.y1)) {
      viewBox = trimmedViewBox(b, penWidth);
      trimmed = true;
    } else {
      // ponytail: no curve-aware box without host.geom (always present in
      // web/CLI/Tauri) - fall back to the full frame rather than ship a bezier
      // flattener just for the minimal test host. Upgrade: wire host.geom there.
      warning = 'This signature could not be trimmed to the ink on this device.';
    }
  }
  return { d: d, viewBox: viewBox, trimmed: trimmed, warning: warning };
}

// ── compute ──────────────────────────────────────────────────────────────────

var memoKey = null;
var memoResult = null;
// The export bar's "No BG" state, remembered for beforeExport - which is handed
// { node, format, opts, host } and NO model, so the toggle can only be read
// here. The engine puts render.transparentBg in the input model (inputs.ts), so
// it arrives with every onInit/onInput. Set before the memo check: the toggle is
// not part of the render, so a flip must still update the flag.
var transparentBg = true;

function compute(model) {
  var a = {};
  for (var i = 0; i < model.length; i++) a[model[i].id] = model[i].value;
  transparentBg = a.transparentBg !== false;

  // Empty when the ink is unset/unresolved, so the template paints currentColor
  // and the signature follows the theme's foreground. A real pick pins the ink.
  var ink = hex(a.color, '');
  var penWidth = clamp(num(a.penWidth, 1), 0.25, 7);
  var smoothing = clamp(num(a.smoothing, 35), 0, 100);
  var trim = a.trim !== false;

  var key = JSON.stringify([a.strokes, ink, penWidth, smoothing, trim]);
  if (key === memoKey) return memoResult;

  // A pasted or authored signature (curves, relative moves) renders verbatim -
  // it is already a designed line, so it is not thinned, smoothed or reboxed
  // from points. The pad's own M/L polylines fall through to the pipeline below.
  var rich = richPath(a.strokes, penWidth, trim);
  if (rich) {
    memoKey = key;
    memoResult = {
      paths: rich.d ? [{ d: rich.d }] : [],
      viewBox: rich.viewBox,
      inkColor: ink,
      penStroke: penWidth,
      // The value is already canonical SVG path data - write it back unchanged
      // so save, share links and the pad (which appends its strokes to it) keep
      // the exact path.
      strokesValue: rich.d,
      strokeCount: rich.d ? 1 : 0,
      pointCount: 0,
      isEmpty: !rich.d,
      trimmed: rich.trimmed,
      smoothMode: 'raw',
      warning: rich.warning,
    };
    return memoResult;
  }

  var parsed = parseStrokes(a.strokes);
  var paths = [];
  var modes = {};
  for (var s = 0; s < parsed.strokes.length; s++) {
    var one = smoothStroke(parsed.strokes[s], smoothing);
    if (one.d) paths.push({ d: one.d });
    modes[one.mode] = true;
  }

  var box = inkBox(parsed.strokes);
  var viewBox = trim && box ? trimmedViewBox(box, penWidth) : '0 0 ' + FRAME_W + ' ' + FRAME_H;

  var notes = [];
  if (parsed.skipped) {
    notes.push(parsed.skipped + (parsed.skipped === 1 ? ' stroke was' : ' strokes were')
      + ' unreadable and skipped.');
  }
  if (parsed.truncated === 'strokes') {
    notes.push('Only the first ' + paths.length + ' strokes are drawn - this signature is past the '
      + MAX_STROKES + '-stroke limit.');
  } else if (parsed.truncated === 'points') {
    notes.push('This signature is past the ' + MAX_POINTS + '-point limit, so the end of it is not drawn.');
  }

  memoKey = key;
  memoResult = {
    paths: paths,
    viewBox: viewBox,
    inkColor: ink,
    penStroke: penWidth,
    // The pad appends to THIS value, so it is the parsed set written back in
    // canonical form: a drawn stroke never re-commits somebody's broken paste.
    strokesValue: serialise(parsed.strokes),
    strokeCount: paths.length,
    pointCount: parsed.points,
    isEmpty: paths.length === 0,
    trimmed: trim && !!box,
    smoothMode: modes.smooth ? 'smooth' : 'raw',
    warning: notes.join(' '),
  };
  return memoResult;
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }

// The export bar's "No BG" toggle: clear the container fill so the alpha
// formats keep the transparency the sheet already has. Every format this tool
// offers carries alpha (svg, png, webp, avif, pdf), so there is nothing to
// exclude.
function beforeExport(ctx) {
  if (transparentBg && ctx && ctx.opts) ctx.opts.background = 'transparent';
}
