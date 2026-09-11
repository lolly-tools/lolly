// SPDX-License-Identifier: MPL-2.0
// `flythrough` tool hooks. Fold the input model into one config object and hand it to the
// template as the `_state` extra (the underscore keeps annotateTemplate off it, so it stays
// valid JSON inside <script type="application/json">). The template's WebGL renderer reads
// it. Mirrors tools/3d/hooks.js, plus a host.lift call for depth layers (M1).
//
// UNLIKE the 3d hook this one is ASYNC and uses the host bridge: it calls host.lift.svg to
// enumerate an SVG shot into layers (real parallax). onInit is awaited (5 s budget); onInput
// (2 s) reuses a per-URL cache so moving the fov/move controls never re-fetches the SVG.

function safeJson(obj) {
  // Only < needs escaping for safe embedding in <script type="application/json">;
  // JSON.parse handles U+2028/U+2029 natively.
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function num(v, fallback) {
  var n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

// Lift is expensive (fetch + sanitise + enumerate) and only depends on the SHOT, so cache
// it by URL at module scope - the hook closure persists across onInit/onInput calls, so a
// slider tick reuses this instead of re-lifting. Only a new shot re-fetches.
var _lift = { url: null, layers: [], viewBox: null };

async function liftLayers(host, shotUrl) {
  if (_lift.url === shotUrl) return _lift;
  var out = { url: shotUrl, layers: [], viewBox: null };
  if (host && host.lift && typeof host.lift.svg === 'function') {
    try {
      var lifted = await host.lift.svg(shotUrl);
      if (lifted && lifted.layers && lifted.layers.length >= 2) {
        out.layers = lifted.layers.map(function (l) { return { svg: l.svg }; });
        out.viewBox = lifted.viewBox || null;
      }
    } catch (e) { /* a non-SVG, an unliftable shot, or no host.lift → fly one flat plane */ }
  }
  _lift = out;
  return out;
}

async function compute(ctx) {
  var model = (ctx && ctx.model) || [];
  var host = ctx && ctx.host;
  var inp = {};
  for (var i = 0; i < model.length; i++) inp[model[i].id] = model[i].value;

  // The shot: an uploaded/catalog asset resolves to a ref { url, ... }; a bare string is
  // taken as-is; nothing picked falls back to the bundled sample (a static tool file at
  // /tools/flythrough/assets/, no {{asset}} needed) so the tool always renders something.
  var shot = inp.shot;
  var shotUrl = (shot && typeof shot === 'object' && shot.url)
    ? shot.url
    : (typeof shot === 'string' && shot ? shot : '/tools/flythrough/assets/sample.svg');

  var lift = await liftLayers(host, shotUrl);

  // A custom camera PATH in the engine's kf wire (URL-shareable, same format as the Design
  // tool). Sampled through host.keyframes so the interpolation + easing are the engine's;
  // the template maps the pose channels onto its real-3D camera. Overrides `move` when set.
  var cameraSamples = null;
  var camKf = (typeof inp.camera === 'string') ? inp.camera.trim() : '';
  if (camKf && host && host.keyframes && typeof host.keyframes.sample === 'function') {
    try {
      var poses = await host.keyframes.sample(camKf, 120);
      if (poses && poses.length >= 2) cameraSamples = poses;
    } catch (e) { /* a bad track → fall back to the parametric `move` preset */ }
  }

  // POSES model: the move is a list of keyframe poses (first = start, last = end, any number
  // in between, drag to reorder). Each pose carries the FULL animatable state; the template
  // tweens across them (Loop reverses home). `move` is the flight (a preset, or "custom" =
  // drive the camera distance/height from the poses). depth/opacity/extrude/scale/tilt/
  // rotate/fov animate under ANY flight.
  var op = function (v) { return Math.max(0, Math.min(1, num(v, 1))); };   // 0 = fully invisible (forming effect)
  var poseState = function (b) {
    b = b || {};
    return {
      depth: Math.max(0.04, num(b.depth, 1)),   // never coplanar (depth 0 → layers z-fight)
      opacity: op(b.opacity),
      fov: Math.max(10, Math.min(89, num(b.fov, 42))),
      extrude: Math.max(0, Math.min(1, num(b.extrude, 0))),
      // 3-axis subject orientation (any flight): X pitch (lie back), Y yaw (turn), Z roll (bank).
      tiltX: Math.max(-180, Math.min(180, num(b.tiltX, 0))),
      tiltY: Math.max(-180, Math.min(180, num(b.tiltY, 0))),
      tiltZ: Math.max(-180, Math.min(180, num(b.tiltZ, 0))),
      offsetX: Math.max(-3, Math.min(3, num(b.offsetX, 0))),   // slide subject in the frame (any flight)
      offsetY: Math.max(-3, Math.min(3, num(b.offsetY, 0))),
      distance: Math.max(0.15, Math.min(2, num(b.distance, 1))),
      height: Math.max(-1.5, Math.min(1.5, num(b.height, 0))),
      scale: Math.max(0.1, Math.min(4, num(b.scale, 1))),      // GLOBAL subject scale (any flight)
    };
  };

  // The blocks value is an array of pose objects keyed by field id (numbers may arrive as
  // strings - poseState coerces). Guard the degenerate shapes: none → the two-pose default;
  // one → duplicate so the template can tween trivially (a single held pose).
  var rawPoses = Array.isArray(inp.poses) ? inp.poses : [];
  var poses = rawPoses.map(poseState);
  if (poses.length === 0) poses = [poseState({ depth: 0.8 }), poseState({ depth: 1.6, extrude: 0.15, fov: 58, distance: 0.42, height: -0.32 })];
  if (poses.length === 1) poses = [poses[0], poses[0]];
  // Reverse: play the poses back to front (one-click fix for a move built backwards).
  if (inp.reverse === true) poses.reverse();

  var cfg = {
    shotUrl: shotUrl,
    layers: lift.layers,          // [] when the shot can't be lifted → single flat plane
    viewBox: lift.viewBox,
    // The EXPORT dimensions reach the hook as the reserved width/height (same as the 3d
    // tool), so the WebGL buffer tracks the export panel live - hard-coding 1280×720 left
    // the canvas the wrong size until a refresh happened to re-fit it.
    width: Math.max(16, Math.round(num(inp.width, 1280))),
    height: Math.max(16, Math.round(num(inp.height, 720))),
    move: inp.move || 'immersive',
    iso: inp.iso === true,          // orthographic projection toggle (FOV is hidden when on)
    cameraSamples: cameraSamples,  // a kf path, if given, overrides everything below
    background: inp.background || '#0e1726',
    duration: Math.max(0.5, num(inp.duration, 6)),
    loop: inp.loop !== false,
    light: Math.max(0, Math.min(2.5, num(inp.light, 1))),
    shadow: Math.max(0, Math.min(1, num(inp.shadow, 0.35))),
    floor: Math.max(0, Math.min(1, num(inp.floor, 0))),   // studio-floor showroom shadow (0 = off)
    floorViewport: inp.floorViewport === true,            // true = fixed ground; false = rides the subject
    poses: poses,
  };

  return { _state: safeJson(cfg) };
}

async function onInit(ctx) { return compute(ctx); }
async function onInput(ctx) { return compute(ctx); }
