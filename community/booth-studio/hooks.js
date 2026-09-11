// SPDX-License-Identifier: MPL-2.0
// `booth-studio` tool hooks - pure, DOM-free.
// Fold the input model into one config object and hand it to the template as the
// `_state` extra (underscore prefix keeps annotateTemplate from touching it, so it
// stays valid JSON inside <script type="application/json">). The template's WebGL
// renderer reads it. Mirrors tools/3d/hooks.js.

// The panel roles the renderer knows how to dress. These ids are a permanent
// contract: they match both the `asset` input ids in tool.json and the role keys
// in the template's DESIGNS table. Role-based (rather than panel1..N) is what lets
// artwork survive a design switch - a back wall stays a back wall.
var ROLES = ['backWall', 'leftWing', 'rightWing', 'header', 'counter', 'tower', 'screen', 'floor'];

function safeJson(obj) {
  // Only < needs escaping for safe embedding in <script type="application/json">;
  // JSON.parse handles U+2028/U+2029 natively, so no separator escaping needed.
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function num(v, fallback) {
  var n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

// An `asset` input's value arrives already resolved by the runtime
// (resolveAssetRefs) as a full AssetRef object - so read `.url` off it. Anything
// else (unset, or a bare id the runtime could not resolve) means "empty panel",
// which the renderer draws as a labelled placeholder rather than failing.
function panelFrom(v, fit, framing) {
  if (!v || typeof v !== 'object' || !v.url) return null;
  var meta = (v.meta && typeof v.meta === 'object') ? v.meta : {};
  return {
    url: v.url,
    // Per-panel, from the role's `<id>Fit` companion input (the sidebar's
    // icon-toggle). A wordmark on the fascia and a photo on the back wall want
    // opposite answers, so one global fit was never right.
    fit: fit === 'contain' ? 'contain' : 'cover',
    // The canonical framing compound for this surface (plans/148), fed straight
    // to the shared frameRect - the same values, ranges and maths every other
    // tool's image slot uses.
    framing: framingFrom(framing),
    name: typeof meta.name === 'string' ? meta.name : '',
    width: num(v.width, 0),
    height: num(v.height, 0),
  };
}

// A framing vector's raw model value → plain numbers. The engine has already
// clamped each field to its declared range, so this only fills the gaps.
function framingFrom(v) {
  var f = (v && typeof v === 'object') ? v : {};
  return {
    zoom: num(f.zoom, 100), x: num(f.x, 50), y: num(f.y, 50),
    rotate: num(f.rotate, 0), pitch: num(f.pitch, 0), yaw: num(f.yaw, 0),
  };
}

// Blend modes we hand to canvas 2D globalCompositeOperation. Allow-listed rather
// than passed through: an unknown value there silently falls back to source-over,
// so a typo would look like the blend simply not working.
var BLENDS = [
  'source-over', 'multiply', 'screen', 'overlay', 'soft-light', 'hard-light',
  'lighten', 'darken', 'color-dodge', 'difference', 'luminosity', 'color',
];

// The background slot. Unlike a panel this may be a VIDEO (or a Lolly tool link,
// which the runtime has already resolved to an image via compose.renderUrl), so
// carry the asset's type through - the renderer needs it to decide between an
// <img> and a <video>. A `lottie` ref's url is animation JSON that no canvas can
// draw, so fall back to its poster frame if the host minted one.
function bgFrom(v) {
  if (!v || typeof v !== 'object' || !v.url) return null;
  var meta = (v.meta && typeof v.meta === 'object') ? v.meta : {};
  var kind = v.type === 'video' ? 'video' : 'image';
  var url = v.url;
  if (v.type === 'lottie') {
    if (typeof meta.posterUrl !== 'string' || !meta.posterUrl) return null;
    url = meta.posterUrl;
    kind = 'image';
  }
  return { url: url, kind: kind, name: typeof meta.name === 'string' ? meta.name : '' };
}

function compute(model) {
  var inp = {};
  for (var i = 0; i < model.length; i++) inp[model[i].id] = model[i].value;

  var panels = {};
  for (var r = 0; r < ROLES.length; r++) panels[ROLES[r]] = panelFrom(inp[ROLES[r]], inp[ROLES[r] + 'Fit'], inp[ROLES[r] + 'Framing']);

  var cam = (inp.camera && typeof inp.camera === 'object') ? inp.camera : {};
  var bgPos = (inp.bgPosition && typeof inp.bgPosition === 'object') ? inp.bgPosition : {};

  var cfg = {
    design: inp.design || 'corner',
    structure: inp.structure || '#1c1f26',
    panelBase: inp.panelBase || '#30ba78',
    panels: panels,
    padding: Math.max(0, Math.min(25, num(inp.padding, 6))),

    scene: inp.scene || 'expo',
    // Fallbacks only - the manifest defaults normally win. Kept in step with them.
    background: inp.background || '#0d1014',
    bgColor2: inp.bgColor2 || '#242c3a',
    gradientBg: inp.gradientBg !== false,
    transparentBg: inp.transparentBg === true,

    bg: bgFrom(inp.bgImage),
    bgFit: inp.bgImageFit === 'contain' ? 'contain' : 'cover',
    bgBlur: Math.max(0, Math.min(60, num(inp.bgBlur, 12))),
    // 0–1, per the canonical `bgOpacity` in schemas/canonical-inputs.json.
    bgOpacity: Math.max(0, Math.min(1, num(inp.bgOpacity, 0.7))),
    bgBlend: BLENDS.indexOf(inp.bgBlend) >= 0 ? inp.bgBlend : 'source-over',
    // The backdrop's framing. `bgPosition` keeps its id (a permanent URL
    // contract) and simply grew the rest of the canonical field set.
    bgPosition: framingFrom(bgPos),
    exposure: num(inp.exposure, 1),
    shadows: inp.shadows !== false,
    people: inp.people !== false,

    camera: {
      fov: num(cam.fov, 38),
      rotation: num(cam.rotation, 32),
      tilt: num(cam.tilt, 8),
      zoom: num(cam.zoom, 1),
      pan: num(cam.pan, 0),
    },
    cameraMove: inp.cameraMove || 'static',
    duration: Math.max(0.5, num(inp.duration, 6)),
    loop: true,
    easing: inp.easing || 'ease-in-out',
  };

  return { _state: safeJson(cfg) };
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }
