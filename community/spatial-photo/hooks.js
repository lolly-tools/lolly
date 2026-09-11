// SPDX-License-Identifier: MPL-2.0
// `spatial-photo` tool hooks - pure, DOM-free. Fold the whole input model into
// one `_state` extra (the underscore keeps annotateTemplate away, so it stays
// valid JSON inside <script type="application/json">) which the template's
// WebGL2 renderer reads. Mirrors community/synth/hooks.js.
//
// Every user-settable value is clamped HERE, not in the shader: the renderer is
// fed straight from a URL, so a hostile `?amount=1e9` has to die at the door.
//
// PROVENANCE (plans/160 section 3.6, resolved by Andy). This tool is a
// model-assisted TRANSFORMATION of the user's own photo - edge-stretch smears
// existing pixels and synthesises nothing - so it discloses in the C2PA action
// chain and carries no genAI badge and no invisible mark. The manifest leaves
// `render.c2pa` on, so an export is stamped and the placed photo rides along as
// an ingredient (the "opened" step). The two remaining steps of the agreed chain
// - depth-estimated and parallax-rendered - have NO tool-side expression today:
// ExportOpts carries no tool-authored action list (the runtime derives every
// step, e.g. c2paAiUpscale, from a placed asset's own metadata), so they need
// the shell-side wiring in plans/160 WP-E and are deliberately not faked here.

function _safeJson(obj) {
  // Only < needs escaping for embedding in <script type="application/json">;
  // JSON.parse handles U+2028/U+2029 natively.
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function _num(v, fallback) {
  var n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function _clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

function _color(v, fallback) {
  var s = (v == null ? '' : String(v)).trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s) ? s : fallback;
}

/**
 * The camera moves, and the amplitude each one survives.
 *
 * The paths themselves live in lib/spatial.js (the renderer needs them; a hook
 * cannot reach the lib). What lives HERE is the enum and the per-preset ceiling,
 * because the ceiling is an input clamp and every input clamp belongs at the
 * door. A single photo has one layer, so a move wide enough to reveal what is
 * behind a foreground edge shows a smear instead - `amount` is therefore capped
 * at what the smear survives, per preset, rather than offering the setting where
 * the effect visibly breaks. tests/spatial-photo.test.ts pins this list against
 * the renderer's, so the two cannot drift.
 */
var _MOVES = {
  'dolly-in': 1,
  'dolly-out': 0.8,
  'sway': 0.7,
  'push-tilt': 0.8,
  'vertigo': 0.6,
  'drift': 1
};

// A literal list, never a lookup on the object above: an enum read as a map key
// lets `constructor`/`__proto__` through as a "valid" option.
var _MOVE_NAMES = ['dolly-in', 'dolly-out', 'sway', 'push-tilt', 'vertigo', 'drift'];

// The clamped loop length, remembered for beforeExport (see the bottom of this file).
var _dur = 6;

function _compute(model) {
  var inp = {};
  for (var i = 0; i < model.length; i++) inp[model[i].id] = model[i].value;

  var move = _MOVE_NAMES.indexOf(inp.move) >= 0 ? inp.move : 'dolly-in';
  var maxAmount = _MOVES[move];

  // An asset input arrives resolved: { id, url, … }. No url = no picture yet,
  // and the template says so rather than rendering an empty frame.
  var photo = (inp.photo && typeof inp.photo === 'object') ? inp.photo : null;

  // The focus point, in frame fractions. Normalised to 0..1 on both axes: the
  // canvas click writes it, but a URL can carry anything, and a focus depth
  // sampled from outside the picture is a focus on nothing.
  var f = (inp.focus && typeof inp.focus === 'object') ? inp.focus : {};

  var cfg = {
    photoUrl: photo && typeof photo.url === 'string' ? photo.url : '',
    photoId: photo && typeof photo.id === 'string' ? photo.id : '',
    // The canvas backing store, and so the export resolution. Pinned to the
    // manifest's render.width/height - a hook cannot read the manifest, and
    // `width`/`height` are RESERVED url params that never become inputs.
    width: 1280,
    height: 720,
    move: move,
    amount: _clamp(_num(inp.amount, 0.6), 0, maxAmount),
    duration: _clamp(_num(inp.duration, 6), 2, 12),
    focus: [_clamp(_num(f.x, 0.5), 0, 1), _clamp(_num(f.y, 0.5), 0, 1)],
    dof: _clamp(_num(inp.dof, 0.35), 0, 1),
    fog: _color(inp.fog, '#30ba78'),
    fogAmount: _clamp(_num(inp.fogAmount, 0.2), 0, 1),
    depthContrast: _clamp(_num(inp.depthContrast, 1.25), 0.2, 3)
  };

  _dur = cfg.duration;
  return { _state: _safeJson(cfg) };
}

function onInit(ctx) { return _compute(ctx.model); }
function onInput(ctx) { return _compute(ctx.model); }

/**
 * The export bar seeds its length from the manifest's `render.video.duration`,
 * which is one fixed number - so a 12-second loop would be cut in half mid-move
 * unless the loop length the user actually set is pushed onto the export. The
 * camera path is periodic, so any length still closes; this only stops the clip
 * ending somewhere other than where the loop does. A duration the user typed
 * into the export bar is a deliberate instruction and wins. Mirrors
 * community/synth/hooks.js.
 */
var _ANIMATED = { webm: 1, mp4: 1, gif: 1, apng: 1, 'webp-anim': 1 };

function beforeExport(ctx) {
  if (!ctx || !ctx.opts || !_ANIMATED[ctx.format]) return;
  if (ctx.opts.durationUserSet) return;
  ctx.opts.duration = _dur;
}
