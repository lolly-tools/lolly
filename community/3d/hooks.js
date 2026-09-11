// SPDX-License-Identifier: MPL-2.0
// `3d` tool hooks - pure, DOM-free (sandboxed: no window/document/fetch).
// Fold the input model into one config object and hand it to the template as the
// `_state` extra (underscore prefix keeps annotateTemplate from touching it, so it
// stays valid JSON inside <script type="application/json">). The template's WebGL
// renderer reads it. Mirrors tools/chart/hooks.js.

function safeJson(obj) {
  // Only < needs escaping for safe embedding in <script type="application/json">;
  // JSON.parse handles U+2028/U+2029 natively, so no separator escaping needed.
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function num(v, fallback) {
  var n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function compute(model) {
  var inp = {};
  for (var i = 0; i < model.length; i++) inp[model[i].id] = model[i].value;

  // Model URL: an uploaded file (in-memory blob URL) wins over the bundled sample.
  // A `file` value is a FileRef {__file, url, ...}; tool-local samples live at
  // /tools/3d/assets/<id>.glb (served as a static tool file, no {{asset}} needed).
  var up = inp.modelUpload;
  var modelUrl = (up && typeof up === 'object' && up.url)
    ? up.url
    : '/tools/3d/assets/' + (inp.model || 'duck') + '.glb';

  var cam = (inp.camera && typeof inp.camera === 'object') ? inp.camera : {};
  var rot = (inp.modelRotate && typeof inp.modelRotate === 'object') ? inp.modelRotate : {};
  var mov = (inp.modelTranslate && typeof inp.modelTranslate === 'object') ? inp.modelTranslate : {};
  var scl = (inp.modelScale && typeof inp.modelScale === 'object') ? inp.modelScale : {};

  var cfg = {
    modelUrl: modelUrl,
    width: Math.round(num(inp.width, 1280)),
    height: Math.round(num(inp.height, 1280)),
    scene: inp.scene || 'natural',
    envIntensity: num(inp.envIntensity, 1),
    envRotation: num(inp.envRotation, 0),
    background: inp.background || '#0f1115',
    bgColor2: inp.bgColor2 || '#30ba78',
    transparentBg: inp.transparentBg === true,
    exposure: num(inp.exposure, 1),
    shadows: inp.shadows !== false,
    camera: {
      fov: num(cam.fov, 45),
      rotation: num(cam.rotation, 35),
      tilt: num(cam.tilt, 12),
      zoom: num(cam.zoom, 1),
      pan: num(cam.pan, 0),
    },
    // Free-form model pose, applied about the model's visual centre. All-identity
    // (0/0/0, 0/0/0, 1) reproduces the auto-framed render byte-for-byte.
    transform: {
      pitch: num(rot.pitch, 0),
      yaw: num(rot.yaw, 0),
      tilt: num(rot.tilt, 0),
      tx: num(mov.x, 0),
      ty: num(mov.y, 0),
      tz: num(mov.z, 0),
      scale: Math.max(0.01, num(scl.scale, 1)),
    },
    cameraMove: inp.cameraMove || 'orbit',
    duration: Math.max(0.5, num(inp.duration, 5)),
    fps: Math.round(num(inp.fps, 30)),
    loop: inp.loop !== false,
    easing: inp.easing || 'ease-in-out',
    // Sorted by time: the template's keyframe sampler assumes ascending times
    // (a user can add rows in any order), so a negative/zero span can't freeze it.
    keyframes: (Array.isArray(inp.cameraKeyframes) ? inp.cameraKeyframes : [])
      .map(function (k) {
        return {
          time: num(k.time, 0),
          fov: num(k.fov, 45),
          rotation: num(k.rotation, 0),
          zoom: num(k.zoom, 1),
          pan: num(k.pan, 0),
          tilt: num(k.tilt, 12),
          easing: k.easing || 'ease-in-out',
        };
      })
      .sort(function (a, b) { return a.time - b.time; }),
    playClip: inp.playClip !== false,
    clipIndex: Math.max(0, Math.round(num(inp.clipIndex, 0))),
    applyTint: inp.applyTint === true,
    tint: inp.tint || '#30ba78',
  };

  return { _state: safeJson(cfg) };
}

function onInit(ctx) { return compute(ctx.model); }
function onInput(ctx) { return compute(ctx.model); }
