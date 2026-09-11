// SPDX-License-Identifier: MPL-2.0
/* Lolly Synth - the WebGL2 harness and the `ink` scene, as one IIFE global.
 *
 * Ships as tool DATA under the tool's own lib/ (like tools/3d/lib/three.min.js),
 * loaded by a deduped dynamic <script> from the template. Hand-written, not
 * generated: there is no build step and no second copy of this source, so the
 * file that ships is the file that is reviewed.
 *
 * WebGL2, deliberately - NOT WebGPU. A WebGPU canvas has no
 * `preserveDrawingBuffer` equivalent, so every raster/video export off one comes
 * out blank; WebGL2 runs the whole existing export stack today.
 *
 * DETERMINISM. A fluid is a feedback simulation: frame N is a function of frame
 * N-1, so there is no seeking. The export clock therefore RESETS and replays
 * from a cleared field (the viz-tool-mount precedent), stepping a fixed timestep
 * with the forcing driven by loop phase alone - never wall-clock, never a live
 * meter. All variation comes from the seeded emitter table the hooks compute, so
 * a shared URL replays the same piece. Cross-GPU float divergence still means
 * "deterministic" is stable on one device/driver, not bit-identical everywhere.
 */
(function (global) {
  'use strict';

  // The emitters' phase is periodic over exactly one loop, so the forcing at the
  // end of a loop is the forcing at its start and a field in its periodic
  // attractor arrives back where it began - that is what closes the seam. The
  // loop is however many sim frames the EXPORT turns out to span (the frame
  // clock's clipSec), so a clip of any length is seamless rather than only the
  // one length the tool guessed; live preview falls back to LOOP frames.
  var LOOP = 120;
  var SIM_HZ = 60;
  // Frames replayed from a cleared field before frame 0, so the field is already
  // in its periodic attractor when the loop starts - about 4.5 time constants of
  // the dissipation below. Measured headlessly at 640x360: the wrap from the last
  // frame back to the first costs 1.7x a normal frame-to-frame step, against 9x
  // for two unrelated frames. Doubling this to 300 only reaches 1.4x - a forced
  // fluid is chaotic, so the seam narrows but never fully closes, and the extra
  // second of mount is not worth the difference.
  var WARMUP = 150;
  // A bigger forward jump than this replays from cleared instead. Stepping
  // forward is always CORRECT (it is the same simulation continuing), so this is
  // purely a cost bound - and the replay it falls back to costs WARMUP frames, so
  // anything smaller than WARMUP would buy the more expensive path. Low-frame-rate
  // exports of a long clip land squarely in that gap.
  var MAX_STEP = WARMUP;
  var FRAME_DT = 1 / 60;  // fixed sim timestep; `speed` scales it, never a clock
  var ITER = 14;          // pressure Jacobi iterations
  var MAX_POINTS = 8;     // splat points per pass (emitters + pointer impulses)
  var SPECTRUM = 32;      // bins in a Signals record's spectrum
  // The swarm's particle budget. The ceiling is a real one: every particle is
  // 16 bytes of buffer twice over and one transform-feedback vertex a step, and
  // the count arrives off a URL.
  var MAX_PARTICLES = 200000;
  // A target row is one texel wide, so this is the ceiling a hand-written
  // _state can ask texImage2D for. Past MAX_TEXTURE_SIZE the upload fails and
  // every target blanks, so an out-of-range header falls back to one centre point.
  var MAX_TARGETS = 2048;
  var PARTICLE_MIN = 1000;
  // The camera grid the hooks' onFrame samples into. Fixed on both sides so the
  // texture is allocated once and never resized; changing it means changing
  // CAM_W/CAM_H in hooks.js too.
  var CAM_W = 96;
  var CAM_H = 54;
  var SCENES = ['ink', 'swarm', 'field', 'camera'];

  /* ── Signals: one contract, two sources ────────────────────────────────────
   *
   * A scene reads exactly one per-frame record:
   *
   *   { rms, bass, mid, treble, onset, beatPhase, spectrum[32] }   all 0..1
   *
   * DETERMINISTIC (what every export uses): the record is read out of the
   * host.audio analysis the hooks packed, indexed by the frame's own clip time.
   * The frame clock is the only clock - never a wall clock, never a live meter -
   * so the same clip and the same seed replay the same piece.
   *
   * LIVE: the same record, filled from whatever the browser realm is hearing.
   * Not wired in this build (see the tool's report): a hook patch rebuilds the
   * tool's DOM, which drops the WebGL context, so a per-sample level hook cannot
   * drive a GL canvas. Everything downstream of `signalsAt` is source-agnostic.
   *
   * IDLE is the record with no audio at all, and every reaction below is written
   * to be neutral at idle - a scene with no clip renders exactly as it did
   * before there was audio in the tool, including while an analysis is still
   * running.
   */
  var IDLE = {
    rms: 0, bass: 0, mid: 0, treble: 0, onset: 0, beatPhase: 0,
    spectrum: new Float32Array(SPECTRUM)
  };

  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function unb64(s) {
    var clean = String(s || '').replace(/[^A-Za-z0-9+/]/g, '');
    var out = new Uint8Array(Math.floor(clean.length * 3 / 4));
    var at = 0, buf = 0, bits = 0;
    for (var i = 0; i < clean.length; i++) {
      buf = (buf << 6) | B64.indexOf(clean.charAt(i));
      bits += 6;
      if (bits >= 8) { bits -= 8; out[at++] = (buf >> bits) & 255; }
    }
    return out.subarray(0, at);
  }

  /**
   * Decode the packed analysis the hooks put in the state. Section order is the
   * contract with hooks.js _pack(): the five scalar tracks, then the spectrum
   * rows. A payload that disagrees with its own header is a bug, not something
   * to animate around - it returns null and the scene plays un-reactive.
   */
  function unpackAudio(meta) {
    if (!meta || !(meta.count > 0) || !(meta.bands > 0) || !meta.data) return null;
    var count = meta.count | 0, bands = meta.bands | 0;
    var raw = unb64(meta.data);
    if (raw.length < count * 5 + count * bands) return null;
    var at = 0;
    var take = function (n) { var s = raw.subarray(at, at + n); at += n; return s; };
    var fps = meta.fps > 0 ? meta.fps : 24;
    return {
      fps: fps, count: count, bands: bands,
      dur: meta.dur > 0 ? meta.dur : count / fps,
      // A tempo is either found or it is not. `null` survives all the way to the
      // scene; nothing here invents one.
      bpm: typeof meta.bpm === 'number' && isFinite(meta.bpm) && meta.bpm > 0 ? meta.bpm : null,
      beats: Array.isArray(meta.beats) ? meta.beats : [],
      rms: take(count), bass: take(count), mid: take(count), treb: take(count), flux: take(count),
      mag: take(count * bands)
    };
  }

  /**
   * Decode the swarm's target points - 16 bits a coordinate, x then y, in the
   * order hooks.js _packTargets wrote them. A payload that disagrees with its
   * own header returns null and the swarm falls back to a single centre point
   * rather than reading past the end of the buffer.
   */
  function unpackTargets(meta) {
    if (!meta || !meta.data) return null;
    var count = meta.count | 0;
    if (!(count > 0) || count > MAX_TARGETS) return null;
    var raw = unb64(meta.data);
    if (raw.length < count * 4) return null;
    var uv = new Float32Array(count * 2);
    for (var i = 0; i < count * 2; i++) uv[i] = ((raw[i * 2] << 8) | raw[i * 2 + 1]) / 65535;
    return { count: count, uv: uv };
  }

  /**
   * Where in the current beat `t` sits, 0 at the beat and rising to 1 just
   * before the next one.
   *
   * bpm === null means the clip holds too little rhythm to call a tempo, which
   * is the common answer for speech, ambience and pads. The phase then IDLES at
   * zero for the whole clip and the beat pulse never fires. Substituting a
   * default tempo (120 is the documented trap) would put every visual accent in
   * the wrong place, which reads far worse than no accent at all.
   */
  function beatPhase(track, t) {
    var b = track.beats;
    if (track.bpm === null || !b || b.length < 2) return 0;
    if (!(t >= b[0]) || t >= b[b.length - 1]) return 0;
    var lo = 0, hi = b.length - 1;
    while (lo < hi - 1) { var mid = (lo + hi) >> 1; if (b[mid] <= t) lo = mid; else hi = mid; }
    var span = b[lo + 1] - b[lo];
    return span > 0 ? clampNum((t - b[lo]) / span, 0, 1) : 0;
  }

  /**
   * Clip time for sim frame `f` of a `period`-frame loop spanning `secs` seconds.
   *
   * PURE, and exported for the same reason signalsAt is. The frame count is
   * capped (a long clip runs the sim SLOWER rather than being cut short), so
   * `f / SIM_HZ` would stop at the cap and leave everything past it unheard: a
   * three-minute track would drive the picture from its first minute while the
   * bed played the whole thing. Loop phase always spans the whole clip.
   */
  function clipTime(f, period, secs) {
    if (!(period > 0) || !(secs > 0)) return f / SIM_HZ;
    return (f / period) * secs;
  }

  /**
   * The Signals record for clip time `tSec`. PURE: same track, same time, same
   * numbers, on any machine - which is what makes an export reproducible.
   *
   * Time indexes the track by nearest frame and clamps at both ends, so the
   * warm-up frames before t=0 read the clip's first frame and a picture longer
   * than its soundtrack holds on the last one rather than falling silent.
   */
  function signalsAt(track, tSec) {
    if (!track) return IDLE;
    var t = typeof tSec === 'number' && isFinite(tSec) && tSec > 0 ? tSec : 0;
    var i = Math.round(t * track.fps);
    if (i < 0) i = 0;
    if (i >= track.count) i = track.count - 1;
    var spectrum = new Float32Array(SPECTRUM);
    var row = i * track.bands;
    for (var b = 0; b < SPECTRUM; b++) {
      // MAX over the source bins, never a mean: a mean smears a narrow peak into
      // its neighbours and the field stops moving with the sound.
      var lo = Math.floor((b * track.bands) / SPECTRUM);
      var hi = Math.max(lo + 1, Math.floor(((b + 1) * track.bands) / SPECTRUM));
      var m = 0;
      for (var k = lo; k < hi && k < track.bands; k++) { var v = track.mag[row + k]; if (v > m) m = v; }
      spectrum[b] = m / 255;
    }
    return {
      rms: track.rms[i] / 255,
      bass: track.bass[i] / 255,
      mid: track.mid[i] / 255,
      treble: track.treb[i] / 255,
      onset: track.flux[i] / 255,
      beatPhase: beatPhase(track, t),
      spectrum: spectrum
    };
  }

  /**
   * The kaleidoscope fold: where the pixel at `u,v` reads its colour from when
   * the picture is mirrored into `sectors` wedges.
   *
   * PURE, and exported, because it is the one piece of the field scene that can
   * be checked without a GPU - the GLSL `fold` below is the same six steps in the
   * same order, and the two have to be changed together.
   *
   * Folding happens in SQUARE units (uv.x times the aspect), so a wedge of a 16:9
   * frame is a wedge and not a sheared one. Each wedge is mirrored about its own
   * middle rather than simply repeated, which is what makes neighbouring wedges
   * meet along their shared edge instead of showing a seam. The radius is
   * untouched, so nothing is magnified by the fold.
   *
   * `sectors` of 1 is symmetry OFF and returns the point unchanged - and so does
   * anything that is not a number, because the value arrives off a URL. A folded
   * point is already inside its wedge, so folding twice is folding once.
   */
  function symmetryFold(u, v, sectors, aspect) {
    var n = Math.round(Number(sectors));
    if (!(n > 1)) return [u, v];
    var ar = aspect > 0 ? aspect : 1;
    var x = (u - 0.5) * ar, y = v - 0.5;
    var r = Math.sqrt(x * x + y * y);
    var sector = (Math.PI * 2) / n;
    var a = Math.atan2(y, x);
    a = a - Math.floor(a / sector) * sector;
    if (a > sector * 0.5) a = sector - a;
    return [0.5 + (Math.cos(a) * r) / ar, 0.5 + Math.sin(a) * r];
  }

  var VERT = [
    'in vec2 aPos;',
    'out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;',
    'uniform vec2 uTexel;',
    'void main(){',
    '  vUv = aPos * 0.5 + 0.5;',
    '  vL = vUv - vec2(uTexel.x, 0.0); vR = vUv + vec2(uTexel.x, 0.0);',
    '  vT = vUv + vec2(0.0, uTexel.y); vB = vUv - vec2(0.0, uTexel.y);',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  // OKLab in GLSL. The maths is Ottosson's, the same numbers engine/src/
  // brand-derive.ts carries - ported, not imported: a tool never reaches into
  // the engine. Every colour the scene paints is a ramp through this space, so
  // brand colours blend perceptually instead of through muddy linear RGB.
  var OKLAB = [
    'vec3 srgbToLinear(vec3 c){',
    '  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));',
    '}',
    'vec3 linearToSrgb(vec3 c){',
    '  c = max(c, 0.0);',
    '  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));',
    '}',
    'vec3 srgbToOklab(vec3 s){',
    '  vec3 c = srgbToLinear(s);',
    '  vec3 lms = vec3(',
    '    0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b,',
    '    0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b,',
    '    0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b);',
    '  lms = pow(max(lms, 0.0), vec3(1.0 / 3.0));',
    '  return vec3(',
    '    0.2104542553 * lms.x + 0.7936177850 * lms.y - 0.0040720468 * lms.z,',
    '    1.9779984951 * lms.x - 2.4285922050 * lms.y + 0.4505937099 * lms.z,',
    '    0.0259040371 * lms.x + 0.7827717662 * lms.y - 0.8086757660 * lms.z);',
    '}',
    'vec3 oklabToSrgb(vec3 lab){',
    '  vec3 lms = vec3(',
    '    lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z,',
    '    lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z,',
    '    lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z);',
    '  lms = lms * lms * lms;',
    '  vec3 c = vec3(',
    '     4.0767416621 * lms.x - 3.3077115913 * lms.y + 0.2309699292 * lms.z,',
    '    -1.2684380046 * lms.x + 2.6097574011 * lms.y - 0.3413193965 * lms.z,',
    '    -0.0041960863 * lms.x - 0.7034186147 * lms.y + 1.7076147010 * lms.z);',
    '  return clamp(linearToSrgb(c), 0.0, 1.0);',
    '}'
  ].join('\n');

  var HEAD = 'precision highp float;\nprecision highp sampler2D;\nin vec2 vUv;\nin vec2 vL;\nin vec2 vR;\nin vec2 vT;\nin vec2 vB;\nout vec4 fragColor;\n';

  var FRAG = {
    // Semi-Lagrangian advection. `uSource` is velocity or dye; both are stored
    // unencoded because the harness requires a float-renderable target.
    advect: [
      'uniform sampler2D uVelocity; uniform sampler2D uSource;',
      'uniform vec2 uTexel; uniform float uDt; uniform float uDissipation;',
      'void main(){',
      '  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uTexel;',
      '  fragColor = uDissipation * texture(uSource, coord);',
      '}'
    ].join('\n'),

    // Additive gaussian splats: the periodic emitters plus any pointer impulse.
    splat: [
      'uniform sampler2D uTarget; uniform vec2 uPoints[8]; uniform vec4 uValues[8];',
      'uniform float uRadius; uniform float uAspect; uniform int uCount;',
      'void main(){',
      '  vec4 acc = vec4(0.0);',
      '  for (int i = 0; i < 8; i++){',
      '    if (i >= uCount) break;',
      '    vec2 p = vUv - uPoints[i]; p.x *= uAspect;',
      '    acc += uValues[i] * exp(-dot(p, p) / uRadius);',
      '  }',
      '  fragColor = texture(uTarget, vUv) + acc;',
      '}'
    ].join('\n'),

    curl: [
      'uniform sampler2D uVelocity;',
      'void main(){',
      '  float l = texture(uVelocity, vL).y, r = texture(uVelocity, vR).y;',
      '  float t = texture(uVelocity, vT).x, b = texture(uVelocity, vB).x;',
      '  fragColor = vec4(r - l - (t - b), 0.0, 0.0, 1.0);',
      '}'
    ].join('\n'),

    // Vorticity confinement - puts back the small eddies the grid eats, which is
    // what makes ink read as ink rather than as smoke.
    vorticity: [
      'uniform sampler2D uVelocity; uniform sampler2D uCurl;',
      'uniform float uStrength; uniform float uDt;',
      'void main(){',
      '  float l = texture(uCurl, vL).x, r = texture(uCurl, vR).x;',
      '  float t = texture(uCurl, vT).x, b = texture(uCurl, vB).x;',
      '  float c = texture(uCurl, vUv).x;',
      '  vec2 force = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));',
      '  force /= length(force) + 0.0001;',
      '  force *= uStrength * c;',
      '  force.y *= -1.0;',
      '  vec2 v = texture(uVelocity, vUv).xy + force * uDt;',
      '  fragColor = vec4(clamp(v, -4000.0, 4000.0), 0.0, 1.0);',
      '}'
    ].join('\n'),

    divergence: [
      'uniform sampler2D uVelocity;',
      'void main(){',
      '  float l = texture(uVelocity, vL).x, r = texture(uVelocity, vR).x;',
      '  float t = texture(uVelocity, vT).y, b = texture(uVelocity, vB).y;',
      '  fragColor = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);',
      '}'
    ].join('\n'),

    clear: [
      'uniform sampler2D uTexture; uniform float uValue;',
      'void main(){ fragColor = uValue * texture(uTexture, vUv); }'
    ].join('\n'),

    pressure: [
      'uniform sampler2D uPressure; uniform sampler2D uDivergence;',
      'void main(){',
      '  float l = texture(uPressure, vL).x, r = texture(uPressure, vR).x;',
      '  float t = texture(uPressure, vT).x, b = texture(uPressure, vB).x;',
      '  float d = texture(uDivergence, vUv).x;',
      '  fragColor = vec4((l + r + b + t - d) * 0.25, 0.0, 0.0, 1.0);',
      '}'
    ].join('\n'),

    gradient: [
      'uniform sampler2D uPressure; uniform sampler2D uVelocity;',
      'void main(){',
      '  float l = texture(uPressure, vL).x, r = texture(uPressure, vR).x;',
      '  float t = texture(uPressure, vT).x, b = texture(uPressure, vB).x;',
      '  vec2 v = texture(uVelocity, vUv).xy - vec2(r - l, t - b);',
      '  fragColor = vec4(v, 0.0, 1.0);',
      '}'
    ].join('\n'),

    /* The `field` and `camera` scenes, in one pass.
     *
     * A feedback buffer: each frame reads the PREVIOUS frame back through a
     * rotate/zoom warp, sharpens it, fades it, and writes it out again - so a
     * splat of dye is stretched into a trail by nothing but repetition. It reads
     * and writes the same dye encoding the ink scene uses (density in .r,
     * density*tone in .g), which is what lets all three scenes share one OKLab
     * display shader and stay brand-locked.
     *
     * `fold` is symmetryFold above, step for step. The camera arrives as a luma
     * grid: it bends the warp (a bright pixel pushes the read outward) and injects
     * density where the picture is bright, so the feed drives the field rather
     * than being pasted over it. uCamOn is 0 for `field`, which then never samples
     * it at all.
     */
    field: [
      'uniform sampler2D uField; uniform sampler2D uCam; uniform vec2 uTexel;',
      'uniform float uSectors; uniform float uAspect; uniform float uSwirl;',
      'uniform float uZoom; uniform float uSharp; uniform float uFade;',
      'uniform float uCamOn; uniform float uCamWarp; uniform float uCamInject;',
      'vec2 fold(vec2 uv){',
      '  if (uSectors < 1.5) return uv;',
      '  vec2 p = vec2((uv.x - 0.5) * uAspect, uv.y - 0.5);',
      '  float r = length(p);',
      '  float sector = 6.2831853 / uSectors;',
      '  float a = atan(p.y, p.x);',
      '  a = a - floor(a / sector) * sector;',
      '  if (a > sector * 0.5) a = sector - a;',
      '  return vec2(0.5 + cos(a) * r / uAspect, 0.5 + sin(a) * r);',
      '}',
      'void main(){',
      '  vec2 uv = fold(vUv);',
      // The camera counts rows downward while uv counts upward.
      '  float cam = uCamOn > 0.5 ? texture(uCam, vec2(uv.x, 1.0 - uv.y)).r : 0.0;',
      '  vec2 p = vec2((uv.x - 0.5) * uAspect, uv.y - 0.5);',
      // Swirl falls off with radius, so the middle turns and the rim holds still.
      '  float ang = uSwirl * (0.35 - length(p)) + (cam - 0.5) * uCamWarp;',
      '  float ca = cos(ang), sa = sin(ang);',
      '  p = mat2(ca, -sa, sa, ca) * p * uZoom;',
      '  vec2 src = vec2(p.x / uAspect, p.y) + 0.5;',
      '  vec4 c0 = texture(uField, src);',
      '  vec4 blur = 0.25 * (texture(uField, src + vec2(uTexel.x, 0.0)) + texture(uField, src - vec2(uTexel.x, 0.0))',
      '                    + texture(uField, src + vec2(0.0, uTexel.y)) + texture(uField, src - vec2(0.0, uTexel.y)));',
      // Unsharp mask: the feedback loop blurs a little every frame, and this is
      // what puts the edge back. Treble drives it, so a bright mix reads crisper.
      '  vec4 outc = (c0 + (c0 - blur) * uSharp) * uFade;',
      '  if (uCamOn > 0.5) {',
      '    float inj = smoothstep(0.35, 0.95, cam) * uCamInject;',
      '    outc.r += inj;',
      '    outc.g += inj * cam;',
      '  }',
      // A sharpen inside a feedback loop is an amplifier, so the field is bounded
      // here rather than left to blow out to white after a few hundred frames.
      '  fragColor = vec4(clamp(outc.rg, 0.0, 4.0), 0.0, 1.0);',
      '}'
    ].join('\n'),

    // Dye carries density in .r and density*tone in .g, so tone survives
    // advection as a ratio instead of bleeding to zero in the empty field.
    // Every colour on screen is that tone read through the OKLab ramp - the
    // scene has no palette of its own, which is what keeps it brand-locked.
    display: [
      OKLAB,
      'uniform sampler2D uDye; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3;',
      'uniform float uRot;',
      // Hue rotation is a rotation of the (a,b) chroma pair and nothing else, so
      // every colour keeps the lightness the palette gave it and the picture
      // keeps its contrast. Applied to the three ramp ends rather than to the
      // mixed result, so the ground tint turns with them.
      'vec3 hueRot(vec3 lab){ float cs = cos(uRot), sn = sin(uRot);',
      '  return vec3(lab.x, lab.y * cs - lab.z * sn, lab.y * sn + lab.z * cs); }',
      'void main(){',
      '  vec2 d = texture(uDye, vUv).rg;',
      '  float density = clamp(d.r, 0.0, 1.0);',
      '  float tone = clamp(d.g / max(d.r, 0.0001), 0.0, 1.0);',
      '  vec3 a = hueRot(srgbToOklab(uC1)), b = hueRot(srgbToOklab(uC2)), c = hueRot(srgbToOklab(uC3));',
      '  vec3 lab = tone < 0.5 ? mix(a, b, tone * 2.0) : mix(b, c, tone * 2.0 - 1.0);',
      // The ground is tinted by the MORE CHROMATIC ramp end, so a near-neutral
      // stop (a brand's white surface, a near-black primary) never bleaches it
      // to grey. Its lightness is fixed rather than taken from the ramp, and the
      // vignette drops it at the rim so the dye reads as lying on a lit surface.
      '  vec3 gc = dot(b.yz, b.yz) > dot(a.yz, a.yz) ? b : a;',
      '  float vig = 1.0 - 0.30 * clamp(length(vUv - 0.5) * 1.7, 0.0, 1.0);',
      '  vec3 ground = oklabToSrgb(vec3(0.30 * vig, gc.y * 0.32, gc.z * 0.32));',
      '  fragColor = vec4(mix(ground, oklabToSrgb(lab), density), 1.0);',
      '}'
    ].join('\n')
  };

  /* ── swarm ──────────────────────────────────────────────────────────────────
   *
   * A transform-feedback particle field. The update pass reads a particle's
   * position and velocity out of one buffer and writes the next pair into the
   * other with the rasteriser switched off, so no particle state ever comes
   * back to the CPU. The draw pass then renders that same buffer as additive
   * points into the SAME dye accumulation the ink scene paints through - so
   * every colour still comes out of one OKLab ramp and the display shader is
   * shared rather than copied.
   *
   * Per-particle variation is hash(index, seed): an exact integer hash, which
   * is the same number on every driver. NOT a fract(sin()) hash - that reads
   * the GPU's sin precision, and two machines would then render different
   * pieces from one URL. Never Math.random anywhere.
   */
  var HASH = [
    'uint hashU(uint x){',
    '  x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u;',
    '  return x;',
    '}',
    'float rnd(uint i, uint s){ return float(hashU(i ^ (s * 0x9e3779b9u))) / 4294967296.0; }'
  ].join('\n');

  // Positions live in uv [0,1]^2, but the forces are computed in SQUARE units
  // (uv.x times the aspect) so a swarm is not pulled harder sideways than it is
  // vertically in a 16:9 frame.
  var SWARM_UPDATE = [
    'precision highp float;',
    'precision highp int;',
    'precision highp sampler2D;',
    HASH,
    'in vec2 aPos; in vec2 aVel;',
    'out vec2 vPos; out vec2 vVel;',
    'uniform sampler2D uTargets;',
    'uniform int uTargetCount; uniform int uInit;',
    'uniform uint uSeed;',
    'uniform float uDt; uniform float uCohesion; uniform float uScatter;',
    'uniform float uPhase; uniform float uAspect; uniform float uPointerOn;',
    'uniform vec2 uPointer;',
    'void main(){',
    '  uint id = uint(gl_VertexID);',
    '  float h0 = rnd(id, uSeed);',
    '  float h1 = rnd(id + 1013904223u, uSeed);',
    '  float h2 = rnd(id + 2654435761u, uSeed);',
    '  vec2 pos = aPos; vec2 vel = aVel;',
    '  int ti = clamp(int(float(uTargetCount) * h2), 0, uTargetCount - 1);',
    '  vec2 tgt = texelFetch(uTargets, ivec2(ti, 0), 0).xy;',
    // Seed AT the target, not in a free cloud: the convergence transient is
    // large at t=0 and gone by t=1, which pops at an animated export's wrap.
    '  if (uInit == 1) { pos = tgt + (vec2(h0, h1) - 0.5) * vec2(0.06 / uAspect, 0.06); vel = vec2(0.0); }',
    '  vec2 d = tgt - pos; d.x *= uAspect;',
    '  vec2 acc = d * uCohesion;',
    // A whole number of turns per loop, the same trick the ink emitters use:
    // the scatter direction at loop phase 1 is the direction at phase 0, so the
    // wander does not leave a seam where the loop closes.
    '  float turns = floor(1.0 + 3.0 * h1);',
    '  float a = 6.2831853 * (h0 + uPhase * turns);',
    '  acc += vec2(cos(a), sin(a)) * uScatter;',
    '  if (uPointerOn > 0.5) {',
    '    vec2 pd = pos - uPointer; pd.x *= uAspect;',
    '    acc += pd * (0.05 / (dot(pd, pd) + 0.004));',
    '  }',
    '  vel = (vel + acc * uDt) * 0.94;',
    '  vec2 stepv = vel * uDt; stepv.x /= uAspect;',
    '  pos += stepv;',
    // Wrap rather than clamp: a wall would grow a bright rim of piled-up
    // particles, and a wrapped one simply flies back in.
    '  vPos = fract(pos + 1.0); vVel = vel;',
    '  gl_Position = vec4(0.0, 0.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  var SWARM_DRAW_VERT = [
    'precision highp float;',
    'precision highp int;',
    HASH,
    'in vec2 aPos; in vec2 aVel;',
    'out float vTone; out float vAmt;',
    'uniform uint uSeed; uniform float uPointSize; uniform float uTreble;',
    'void main(){',
    '  float h = rnd(uint(gl_VertexID) + 88675123u, uSeed);',
    // The ramp position is seeded per particle, so the swarm reads as a spread
    // through the palette rather than one flat colour; treble slides it up.
    '  vTone = clamp(h * 0.85 + uTreble * 0.2, 0.0, 1.0);',
    '  vAmt = 0.3 + 0.7 * clamp(length(aVel) * 1.6, 0.0, 1.0);',
    '  gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0);',
    '  gl_PointSize = uPointSize;',
    '}'
  ].join('\n');

  // The update pass runs with the rasteriser off, so nothing here ever executes.
  // A program still needs a fragment stage to link, and it cannot be the draw
  // pass's - a fragment shader's inputs have to match the vertex stage it is
  // linked against, and the update stage emits the two feedback varyings.
  var NOOP_FRAG = [
    'precision highp float;',
    'out vec4 fragColor;',
    'void main(){ fragColor = vec4(0.0); }'
  ].join('\n');

  // Density in .r and density*tone in .g - the same encoding the ink dye uses,
  // which is what lets both scenes share the display shader.
  var SWARM_DRAW_FRAG = [
    'precision highp float;',
    'in float vTone; in float vAmt;',
    'out vec4 fragColor;',
    'uniform float uGain;',
    'void main(){',
    '  float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)) * uGain * vAmt;',
    '  fragColor = vec4(a, a * vTone, 0.0, 1.0);',
    '}'
  ].join('\n');

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, '#version 300 es\n' + src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error('synth shader: ' + gl.getShaderInfoLog(sh));
    }
    return sh;
  }

  /** Link two compiled shaders and collect every active uniform's location.
   *  `varyings` is the transform-feedback capture list, which HAS to be declared
   *  before the link or the swarm's update pass writes nowhere. */
  function link(gl, p, attribs, varyings) {
    for (var a = 0; a < attribs.length; a++) gl.bindAttribLocation(p, a, attribs[a]);
    if (varyings) gl.transformFeedbackVaryings(p, varyings, gl.INTERLEAVED_ATTRIBS);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('synth link: ' + gl.getProgramInfoLog(p));
    }
    var u = {};
    var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p: p, u: u };
  }

  /** A fullscreen-quad pass: the shared vertex shader plus one fragment body. */
  function program(gl, vs, fragSrc) {
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    var fs = compile(gl, gl.FRAGMENT_SHADER, HEAD + fragSrc);
    gl.attachShader(p, fs);
    var out = link(gl, p, ['aPos'], null);
    gl.deleteShader(fs);
    return out;
  }

  /** A particle pass: both shaders given whole, and optionally a capture list. */
  function programSrc(gl, vertSrc, fragSrc, varyings) {
    var p = gl.createProgram();
    var vsh = compile(gl, gl.VERTEX_SHADER, vertSrc);
    var fsh = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
    gl.attachShader(p, vsh);
    gl.attachShader(p, fsh);
    var out = link(gl, p, ['aPos', 'aVel'], varyings);
    gl.deleteShader(vsh);
    gl.deleteShader(fsh);
    return out;
  }

  function clampNum(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function hexToRgb(hex) {
    var s = String(hex || '').trim().replace(/^#/, '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return [0.5, 0.5, 0.5];
    return [
      parseInt(s.slice(0, 2), 16) / 255,
      parseInt(s.slice(2, 4), 16) / 255,
      parseInt(s.slice(4, 6), 16) / 255
    ];
  }

  /**
   * Internal field resolutions for an output of W×H. Not an input, and not the
   * export resolution: velocity and pressure carry no detail worth resolving, so
   * they run coarse and the dye they push around runs fine. Never larger than the
   * output it will be drawn into.
   *
   * A PURE function of the output size, and of nothing else. It used to scale
   * both grids down when devicePixelRatio > 1.5, which is every Retina Mac as
   * well as every phone: a different grid is a different simulation, so the same
   * URL rendered a materially different piece on a laptop than on a desktop
   * monitor. The determinism claim at the top of this file outranks the thermal
   * saving.
   *
   * ponytail: one grid for every device, so a phone runs the full sim. If that
   * cooks one, the knob is a declared "Quality" input folded into `_state` - a
   * shared, reproducible value - never a device probe read at mount.
   */
  function fieldSizes(W, H) {
    var ar = W / H;
    var box = function (shortSide) {
      var s = Math.min(Math.min(W, H), Math.round(shortSide));
      return [Math.max(32, Math.round(ar > 1 ? s * ar : s)), Math.max(32, Math.round(ar > 1 ? s : s / ar))];
    };
    return { sim: box(192), dye: box(512) };
  }

  function create(canvas, cfg) {
    // preserveDrawingBuffer is THE load-bearing flag: the export path reads the
    // canvas after the frame has composited, and without it every raster and
    // video export is silently blank. It cannot be added by a later getContext -
    // the first call's attributes are the ones that stick.
    var gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    // Everything past here owns a context. The template only shows the error
    // message and never gets an instance to dispose, so a build that throws has
    // to drop its own context: contexts cap around 16 a tab, and a failing paint
    // repeats on every slider nudge.
    try {
      return build(canvas, cfg, gl);
    } catch (err) {
      var lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      throw err;
    }
  }

  function build(canvas, cfg, gl) {
    if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) {
      throw new Error('This browser cannot render to floating-point textures.');
    }

    var W = cfg.width, H = cfg.height;
    canvas.width = W;
    canvas.height = H;

    var sizes = fieldSizes(W, H);
    var aspect = W / H;

    // An unknown scene is `ink`, the same fallback the hooks apply: a scene name
    // arrives off a URL and must never index anything.
    var scene = SCENES.indexOf(cfg.scene) >= 0 ? cfg.scene : 'ink';
    // `camera` is `field` with the live feed wired in, so the two share the
    // whole pipeline and differ by one uniform.
    var isField = scene === 'field' || scene === 'camera';
    var useCam = scene === 'camera';

    var vs = compile(gl, gl.VERTEX_SHADER, VERT);
    var prog = {};
    // Only the passes this scene actually runs. Every scene paints through the
    // same dye accumulation, so `display` (the OKLab ramp) is always there and
    // everything else is that scene's own solver.
    var names = scene === 'swarm'
      ? ['clear', 'display']
      : isField
        ? ['splat', 'field', 'display']
        : ['advect', 'splat', 'curl', 'vorticity', 'divergence', 'clear', 'pressure', 'gradient', 'display'];
    for (var i = 0; i < names.length; i++) prog[names[i]] = program(gl, vs, FRAG[names[i]]);
    gl.deleteShader(vs);   // linked into every program already; freed with the last one
    if (scene === 'swarm') {
      prog.swarmUpdate = programSrc(gl, SWARM_UPDATE, NOOP_FRAG, ['vPos', 'vVel']);
      prog.swarmDraw = programSrc(gl, SWARM_DRAW_VERT, SWARM_DRAW_FRAG, null);
    }

    var quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    var fbos = [];
    function makeFbo(w, h, filter) {
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      var fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      var o = {
        tex: tex, fbo: fbo, w: w, h: h, texel: [1 / w, 1 / h],
        bind: function (unit) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); return unit; }
      };
      fbos.push(o);
      return o;
    }
    function makeDouble(w, h, filter) {
      var a = makeFbo(w, h, filter), b = makeFbo(w, h, filter);
      return {
        get read() { return a; }, get write() { return b; },
        swap: function () { var t = a; a = b; b = t; }
      };
    }

    // The velocity/pressure grids are the ink solver's alone - the swarm carries
    // its state in vertex buffers, so allocating them would be four unused
    // float targets on a phone.
    var velocity = null, pressure = null, divergence = null, curl = null;
    if (scene === 'ink') {
      velocity = makeDouble(sizes.sim[0], sizes.sim[1], gl.LINEAR);
      pressure = makeDouble(sizes.sim[0], sizes.sim[1], gl.NEAREST);
      divergence = makeFbo(sizes.sim[0], sizes.sim[1], gl.NEAREST);
      curl = makeFbo(sizes.sim[0], sizes.sim[1], gl.NEAREST);
    }
    var dye = makeDouble(sizes.dye[0], sizes.dye[1], gl.LINEAR);
    var screen = { w: W, h: H, texel: [1 / W, 1 / H] };

    // The live camera grid. Allocated for the `field` scene too, so the sampler
    // the shared shader declares is always bound to a real texture; `field`
    // simply never reads it. LINEAR, because the grid is far coarser than the
    // field it displaces and nearest sampling would show its 96x54 cells.
    var camTex = null, camSeq = -1;
    // The channel object outlives the instrument that filled it: navigating away
    // and back leaves a previous mount's frames on the realm with a high count.
    // Only a count that ADVANCES after this instrument started is a live camera.
    var camBase = (global.__lollySynthCam && global.__lollySynthCam.n) || 0;
    // Live frames since the last upload. 90 is about a second and a half of rAF,
    // long enough that a dropped frame or two is not a flicker of the note.
    var camIdle = 0, CAM_STALE = 90;
    if (isField) {
      camTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, camTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, CAM_W, CAM_H, 0, gl.RED, gl.UNSIGNED_BYTE,
        new Uint8Array(CAM_W * CAM_H));
    }

    /**
     * Take whatever camera frame the hooks' onFrame last sampled.
     *
     * The handoff is a property on the realm, the mechanism community/growth's
     * sim uses: hooks run in-realm and a returned patch would re-render the
     * tool's DOM, which drops this GL context. Only the LIVE loop pumps, never a
     * driven export - so an export replays against one latched frame instead of
     * whatever the camera happened to be showing partway through the replay.
     */
    function pumpCamera() {
      if (!useCam) return;
      camIdle++;
      var src = global.__lollySynthCam;
      if (!src || !src.lum || src.n === camSeq || src.n <= camBase) return;
      if (src.w !== CAM_W || src.h !== CAM_H || src.lum.length < CAM_W * CAM_H) return;
      camSeq = src.n;
      camIdle = 0;
      gl.bindTexture(gl.TEXTURE_2D, camTex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, CAM_W, CAM_H, 0, gl.RED, gl.UNSIGNED_BYTE, src.lum);
    }

    // The texel a pass works in is the TARGET's own, not one global: dye runs at
    // a finer grid than velocity, so an advection step that used the velocity
    // texel would displace the dye by the wrong distance.
    function use(pr, target) {
      var t = target || screen;
      gl.useProgram(pr.p);
      if (pr.u.uTexel) gl.uniform2f(pr.u.uTexel, t.texel[0], t.texel[1]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
      gl.viewport(0, 0, t.w, t.h);
    }
    function draw() { gl.drawArrays(gl.TRIANGLES, 0, 3); }

    var intensity = clampNum(cfg.intensity, 0, 2);
    var speed = clampNum(cfg.speed, 0.05, 4);
    // Clamped again here, not only in hooks: _state is JSON in the page and can
    // be hand-written, and a wedge count of 0 or 1e9 is a division in a shader.
    var sectors = Math.round(clampNum(Number(cfg.symmetry) > 0 ? Number(cfg.symmetry) : 1, 1, 12));
    // The manifest's declared animated-export length, carried in the state
    // because a lib cannot read a manifest. Only used when the exporter renders
    // frames without telling the tool how long the clip is.
    var defaultSecs = clampNum(cfg.durationSec > 0 ? cfg.durationSec : LOOP / SIM_HZ, 0.5, 3600);
    var emitters = cfg.emitters || [];
    var cols = cfg.colors || [];
    var c1 = hexToRgb(cols[0]), c2 = hexToRgb(cols[1]), c3 = hexToRgb(cols[2]);
    // Clamped here as well as in hooks: _state is JSON in the page.
    var rampRot = clampNum(Number(cfg.rampRotate) || 0, 0, 360) * Math.PI / 180;

    // Pointer impulses, consumed by the next sim step. Bounded so a fast drag
    // can never grow the queue without limit.
    var impulses = [];

    var track = unpackAudio(cfg.audio);

    /**
     * The Signals for sim frame `f`. The export loop spans the WHOLE clip, so a
     * frame's own time is its position in the loop times the clip's length - the
     * picture cannot drift against its soundtrack at any clip length. Warm-up
     * frames (f < 0) clamp to the clip's first frame.
     *
     * Live preview has no transport to follow and no loop length declared to it,
     * so it runs at sim rate and wraps the track - the piece keeps moving instead
     * of freezing on the last frame.
     */
    function signalsFor(f, live) {
      if (!track) return IDLE;
      var t = live ? f / SIM_HZ : clipTime(f, period, loopSecs);
      if (!(t > 0)) t = 0;
      if (live && track.dur > 0) t = t % track.dur;
      return signalsAt(track, t);
    }

    // The forcing for sim frame `f`, as splat points. Phase is a function of the
    // frame index alone (never a clock), and each emitter's orbit completes a
    // whole number of turns per loop - that periodicity is what closes the loop.
    function forcing(f, period, sig) {
      var phase = (((f % period) + period) % period) / period;
      // Every audio term below is written so that IDLE (all zeros) leaves the
      // forcing exactly as it was before the tool had audio: a clip lifts the
      // piece, it does not replace it.
      var beat = sig.beatPhase > 0 ? (1 - sig.beatPhase) : 0;
      var pulse = 1 + 0.6 * beat * beat * beat;
      var pts = [], dyeVals = [], velVals = [];
      for (var i = 0; i < emitters.length && pts.length < MAX_POINTS - 1; i++) {
        var e = emitters[i];
        var a = 2 * Math.PI * (e.turns * phase + e.phase);
        var x = e.x + e.radius * Math.cos(a);
        var y = e.y + e.radius * Math.sin(a);
        var tx = -Math.sin(a), ty = Math.cos(a);
        // Each source listens to its own part of the spectrum, picked by its
        // seeded tone - so the sources answer the music separately instead of
        // all pumping together, and which one answers what is part of the seed.
        var bandE = sig.spectrum[Math.min(SPECTRUM - 1, Math.floor(e.tone * SPECTRUM))];
        var lift = 1 + 1.2 * sig.bass + 0.8 * bandE;
        var amp = 0.35 * intensity * (0.65 + 0.35 * Math.cos(2 * Math.PI * (e.turns * phase + e.phase * 2))) * lift * pulse;
        // Treble slides the ink up the ramp toward the third colour.
        var tone = clampNum(e.tone + 0.2 * sig.treble, 0, 1);
        var push = e.push * intensity * (1 + 0.8 * sig.rms);
        pts.push([x, y]);
        dyeVals.push([amp, amp * tone, 0, 0]);
        velVals.push([tx * push, ty * push, 0, 0]);
      }
      for (var k = 0; k < impulses.length && pts.length < MAX_POINTS; k++) {
        var im = impulses[k];
        pts.push([im.x, im.y]);
        dyeVals.push([0.5 * intensity, 0.5 * intensity * im.tone, 0, 0]);
        velVals.push([im.dx, im.dy, 0, 0]);
      }
      impulses.length = 0;
      return { pts: pts, dye: dyeVals, vel: velVals };
    }

    function splat(target, source, pts, values, radius) {
      var pr = prog.splat;
      use(pr, target);
      gl.uniform1i(pr.u.uTarget, source.bind(0));
      gl.uniform1f(pr.u.uRadius, radius);
      gl.uniform1f(pr.u.uAspect, aspect);
      gl.uniform1i(pr.u.uCount, pts.length);
      var flatP = new Float32Array(MAX_POINTS * 2), flatV = new Float32Array(MAX_POINTS * 4);
      for (var i = 0; i < pts.length; i++) {
        flatP[i * 2] = pts[i][0]; flatP[i * 2 + 1] = pts[i][1];
        flatV[i * 4] = values[i][0]; flatV[i * 4 + 1] = values[i][1];
        flatV[i * 4 + 2] = values[i][2]; flatV[i * 4 + 3] = values[i][3];
      }
      gl.uniform2fv(pr.u.uPoints, flatP);
      gl.uniform4fv(pr.u.uValues, flatV);
      draw();
    }

    /**
     * The swarm's GPU state: two interleaved [pos.xy, vel.xy] buffers that
     * ping-pong through transform feedback, one static texture of target points,
     * and the two VAOs that bind them. Particle state never comes back to the
     * CPU, so the only cost per frame is one draw call with the rasteriser off.
     */
    function makeSwarm() {
      var packed = unpackTargets(cfg.targets);
      // A single centre point rather than nothing: a swarm with no target to fly
      // at is a blank canvas, and a blank export reads as a broken tool.
      var uv = packed ? packed.uv : new Float32Array([0.5, 0.5]);
      var tCount = packed ? packed.count : 1;

      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // NEAREST and never sampled between texels: a target is one point, not a
      // position interpolated between two unrelated ones.
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, tCount, 1, 0, gl.RG, gl.FLOAT, uv);

      // Clamped again here, not only in hooks: this file also has to survive a
      // hand-written _state, and the count sizes two GPU buffers.
      var count = Math.round(clampNum(cfg.particles > 0 ? cfg.particles : PARTICLE_MIN, PARTICLE_MIN, MAX_PARTICLES));
      var STRIDE = 16;   // vec2 position + vec2 velocity, tightly packed
      var seed = Number(cfg.seed) >>> 0;
      var bufs = [gl.createBuffer(), gl.createBuffer()];
      var vaos = [gl.createVertexArray(), gl.createVertexArray()];
      for (var i = 0; i < 2; i++) {
        gl.bindBuffer(gl.ARRAY_BUFFER, bufs[i]);
        gl.bufferData(gl.ARRAY_BUFFER, count * STRIDE, gl.DYNAMIC_COPY);
        gl.bindVertexArray(vaos[i]);
        gl.bindBuffer(gl.ARRAY_BUFFER, bufs[i]);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, STRIDE, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, STRIDE, 8);
      }
      gl.bindVertexArray(null);
      // The fullscreen quad's pointer is recorded in the default VAO, but the
      // ARRAY_BUFFER binding itself is global state the loop above just moved.
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);

      var cur = 0;
      var initNeeded = true;

      function update(f, period, sig) {
        var pr = prog.swarmUpdate;
        var phase = (((f % period) + period) % period) / period;
        var beat = sig.beatPhase > 0 ? (1 - sig.beatPhase) : 0;
        // Beats pull the swarm ONTO the shape, mids blow it apart. Both terms
        // sit at their base value when the record idles, so a clip lifts the
        // piece rather than replacing it.
        var cohesion = 2.0 * (0.5 + 0.75 * intensity) * (1 + 2.5 * beat * beat * beat);
        var scatter = (0.08 + 1.8 * sig.mid + 0.9 * sig.onset) * (0.4 + 0.6 * intensity);
        var ptr = impulses.length ? impulses[impulses.length - 1] : null;
        impulses.length = 0;

        gl.useProgram(pr.p);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(pr.u.uTargets, 0);
        gl.uniform1i(pr.u.uTargetCount, tCount);
        gl.uniform1i(pr.u.uInit, initNeeded ? 1 : 0);
        gl.uniform1ui(pr.u.uSeed, seed);
        gl.uniform1f(pr.u.uDt, FRAME_DT * speed);
        gl.uniform1f(pr.u.uCohesion, cohesion);
        gl.uniform1f(pr.u.uScatter, scatter);
        gl.uniform1f(pr.u.uPhase, phase);
        gl.uniform1f(pr.u.uAspect, aspect);
        gl.uniform1f(pr.u.uPointerOn, ptr ? 1 : 0);
        gl.uniform2f(pr.u.uPointer, ptr ? ptr.x : 0, ptr ? ptr.y : 0);

        gl.bindVertexArray(vaos[cur]);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, bufs[1 - cur]);
        gl.enable(gl.RASTERIZER_DISCARD);
        gl.beginTransformFeedback(gl.POINTS);
        gl.drawArrays(gl.POINTS, 0, count);
        gl.endTransformFeedback();
        gl.disable(gl.RASTERIZER_DISCARD);
        gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
        gl.bindVertexArray(null);
        cur = 1 - cur;
        initNeeded = false;
      }

      function render(sig) {
        // The trail length IS this fade. Short enough that the traced shape
        // stays readable, long enough that a fast particle draws a streak.
        use(prog.clear, dye.write);
        gl.uniform1i(prog.clear.u.uTexture, dye.read.bind(0));
        gl.uniform1f(prog.clear.u.uValue, 0.90);
        draw();
        dye.swap();

        var pr = prog.swarmDraw;
        gl.useProgram(pr.p);
        gl.bindFramebuffer(gl.FRAMEBUFFER, dye.read.fbo);
        gl.viewport(0, 0, dye.read.w, dye.read.h);
        gl.uniform1ui(pr.u.uSeed, seed);
        gl.uniform1f(pr.u.uPointSize, 2.0);
        gl.uniform1f(pr.u.uTreble, sig.treble);
        gl.uniform1f(pr.u.uGain, 0.10 + 0.10 * intensity);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.bindVertexArray(vaos[cur]);
        gl.drawArrays(gl.POINTS, 0, count);
        gl.bindVertexArray(null);
        gl.disable(gl.BLEND);
      }

      return {
        count: count,
        targets: tCount,
        step: function (f, period, sig) { update(f, period, sig); render(sig); },
        // A driven export replays from cleared, and for the swarm "cleared"
        // means every particle back on its seeded start position.
        reset: function () { initNeeded = true; },
        dispose: function () {
          gl.deleteTexture(tex);
          for (var k = 0; k < 2; k++) {
            gl.deleteBuffer(bufs[k]);
            gl.deleteVertexArray(vaos[k]);
          }
        }
      };
    }

    var swarm = scene === 'swarm' ? makeSwarm() : null;

    function step(f, period, live) {
      var sig = signalsFor(f, live);
      if (swarm) swarm.step(f, period, sig);
      else if (isField) stepField(f, period, sig);
      else stepInk(f, period, sig);
    }

    /** The loudest of a run of spectrum bins, on the same argument signalsAt
     *  takes the max rather than the mean: a mean smears a narrow peak into its
     *  neighbours and the warp stops answering the sound. */
    function band(sig, lo, hi) {
      var m = 0;
      for (var i = lo; i < hi && i < SPECTRUM; i++) if (sig.spectrum[i] > m) m = sig.spectrum[i];
      return m;
    }

    /**
     * One frame of the feedback field.
     *
     * The emitters splat dye exactly as they do for ink - same seeded table, same
     * whole-turns-per-loop periodicity, same pointer impulses - and then the whole
     * buffer is read back through the warp. Everything the audio drives is written
     * so that IDLE (no clip) leaves a slow breathing warp rather than a still
     * picture, and every term is periodic in the loop phase, so the loop closes.
     */
    function stepField(f, period, sig) {
      var force = forcing(f, period, sig);
      if (force.pts.length) { splat(dye.write, dye.read, force.pts, force.dye, 0.0022); dye.swap(); }

      var phase = (((f % period) + period) % period) / period;
      // One whole cycle per loop: the warp at phase 1 is the warp at phase 0.
      var breathe = 0.5 + 0.5 * Math.cos(2 * Math.PI * phase);
      var low = band(sig, 0, 8), mid = band(sig, 8, 20);

      var pr = prog.field;
      use(pr, dye.write);
      gl.uniform1i(pr.u.uField, dye.read.bind(0));
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, camTex);
      gl.uniform1i(pr.u.uCam, 1);
      gl.uniform1f(pr.u.uSectors, sectors);
      gl.uniform1f(pr.u.uAspect, aspect);
      // Radians per frame, so these stay small: the visible turn is this times 60.
      gl.uniform1f(pr.u.uSwirl, (0.004 + 0.045 * low + 0.02 * sig.bass) * intensity * speed * (0.4 + 0.6 * breathe));
      gl.uniform1f(pr.u.uZoom, 1 + (0.002 + 0.012 * mid) * intensity * speed);
      gl.uniform1f(pr.u.uSharp, clampNum(0.10 + 1.1 * sig.treble, 0, 2));
      gl.uniform1f(pr.u.uFade, 0.985);
      gl.uniform1f(pr.u.uCamOn, useCam ? 1 : 0);
      gl.uniform1f(pr.u.uCamWarp, 0.25 * intensity);
      gl.uniform1f(pr.u.uCamInject, 0.06 * (0.5 + 0.5 * intensity));
      draw();
      dye.swap();
    }

    function stepInk(f, period, sig) {
      var dt = FRAME_DT * speed;
      var force = forcing(f, period, sig);
      if (force.pts.length) {
        splat(velocity.write, velocity.read, force.pts, force.vel, 0.0035); velocity.swap();
        splat(dye.write, dye.read, force.pts, force.dye, 0.0022); dye.swap();
      }

      use(prog.curl, curl);
      gl.uniform1i(prog.curl.u.uVelocity, velocity.read.bind(0));
      draw();

      use(prog.vorticity, velocity.write);
      gl.uniform1i(prog.vorticity.u.uVelocity, velocity.read.bind(0));
      gl.uniform1i(prog.vorticity.u.uCurl, curl.bind(1));
      // An onset is an attack - a struck note, a beat, a consonant. Confinement
      // is what turns one into a visible curl, so that is where it lands.
      gl.uniform1f(prog.vorticity.u.uStrength, 24.0 * (1 + 1.6 * sig.onset));
      gl.uniform1f(prog.vorticity.u.uDt, dt);
      draw();
      velocity.swap();

      use(prog.divergence, divergence);
      gl.uniform1i(prog.divergence.u.uVelocity, velocity.read.bind(0));
      draw();

      use(prog.clear, pressure.write);
      gl.uniform1i(prog.clear.u.uTexture, pressure.read.bind(0));
      gl.uniform1f(prog.clear.u.uValue, 0.8);
      draw();
      pressure.swap();

      for (var i = 0; i < ITER; i++) {
        use(prog.pressure, pressure.write);
        gl.uniform1i(prog.pressure.u.uPressure, pressure.read.bind(0));
        gl.uniform1i(prog.pressure.u.uDivergence, divergence.bind(1));
        draw();
        pressure.swap();
      }

      use(prog.gradient, velocity.write);
      gl.uniform1i(prog.gradient.u.uPressure, pressure.read.bind(0));
      gl.uniform1i(prog.gradient.u.uVelocity, velocity.read.bind(1));
      draw();
      velocity.swap();

      // Dissipation is the loop's tuning knob, not just a look: it sets how long
      // the field remembers, and a memory that outlasts the loop is a seam. Both
      // constants are short enough that WARMUP frames wipe the start transient.
      use(prog.advect, velocity.write);
      gl.uniform1i(prog.advect.u.uVelocity, velocity.read.bind(0));
      gl.uniform1i(prog.advect.u.uSource, velocity.read.bind(0));
      gl.uniform1f(prog.advect.u.uDt, dt);
      gl.uniform1f(prog.advect.u.uDissipation, 0.970);
      draw();
      velocity.swap();

      use(prog.advect, dye.write);
      gl.uniform1i(prog.advect.u.uVelocity, velocity.read.bind(0));
      gl.uniform1i(prog.advect.u.uSource, dye.read.bind(1));
      gl.uniform1f(prog.advect.u.uDt, dt);
      gl.uniform1f(prog.advect.u.uDissipation, 0.975);
      draw();
      dye.swap();
    }

    function paint() {
      var pr = prog.display;
      use(pr, null);
      gl.uniform1i(pr.u.uDye, dye.read.bind(0));
      gl.uniform3f(pr.u.uC1, c1[0], c1[1], c1[2]);
      gl.uniform3f(pr.u.uC2, c2[0], c2[1], c2[2]);
      gl.uniform3f(pr.u.uC3, c3[0], c3[1], c3[2]);
      gl.uniform1f(pr.u.uRot, rampRot);
      draw();
      gl.flush();
    }

    function clearField() {
      for (var i = 0; i < fbos.length; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[i].fbo);
        gl.viewport(0, 0, fbos[i].w, fbos[i].h);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      impulses.length = 0;
      if (swarm) swarm.reset();
    }

    var cursor = -1;      // last sim frame the export clock rendered
    var period = 0;       // sim frames in the loop the export clock is walking
    var loopSecs = 0;     // clip seconds that loop spans
    var liveFrame = 0;
    var acc = 0;
    var lastTs = 0;
    var resumeOwed = false;
    var raf = 0;
    var disposed = false;

    /**
     * The deterministic export clock. t is normalised clip time in [0,1);
     * clipSec is the clip's real length, which the export decides after a frame
     * plan the tool never sees - so the loop is sized from it rather than from a
     * span guessed here, and a clip of any length closes seamlessly.
     *
     * A jump backwards, a jump further than MAX_STEP, a change of clip length,
     * or t === 0 replays the field from cleared. Without that an export would
     * inherit whatever the live preview had built up, and the same URL would
     * export differently depending on how long it had been on screen.
     */
    function renderLoopFrame(t01, clipSec) {
      if (disposed) return;
      // A live pointer impulse must never leak into a driven replay, or the same
      // URL exports differently depending on where the cursor happened to be.
      impulses.length = 0;
      var t = clampNum(typeof t01 === 'number' && isFinite(t01) ? t01 : 0, 0, 0.999999);
      // Only the video path passes clipSec; gif/apng/webp-anim and the export's
      // own static-chrome probe repaint call with the phase alone. Falling back to
      // a fixed guess there played the loop at a fraction of speed (a 6 s GIF of
      // 2 s of sim) and read only the head of the analysis, so: the last length
      // the exporter declared, else the clip's own, else the manifest's default.
      var secs = typeof clipSec === 'number' && isFinite(clipSec) && clipSec > 0
        ? clipSec
        : (loopSecs || (track && track.dur > 0 ? track.dur : defaultSecs));
      var frames = Math.max(24, Math.min(3600, Math.round(secs * SIM_HZ)));
      var target = Math.floor(t * frames);
      var jumped = cursor < 0 || frames !== period || secs !== loopSecs
        || target < cursor || target - cursor > MAX_STEP || t01 === 0;
      var f = jumped ? -WARMUP : cursor + 1;
      if (jumped) clearField();
      // Both BEFORE stepping: signalsFor reads them to place each frame in the clip.
      period = frames;
      loopSecs = secs;
      for (; f <= target; f++) step(f, frames, false);
      cursor = target;
      resumeOwed = true;   // the live clock owes itself one swallowed delta
      paint();
    }

    /**
     * Say why the camera scene is not showing a camera.
     *
     * A scene named `camera` that quietly plays its own pattern is a tool lying
     * about what it is: on a shell with no camera at all, and before the user has
     * pressed the shell's own Go live control, the picture has to account for
     * itself. `txt` of null takes the note away again, which is what the first
     * frame does.
     */
    var noteEl = null;
    function setNote(txt) {
      if (!global.document || !canvas.parentNode) return;
      if (!txt) {
        if (noteEl && noteEl.parentNode) noteEl.parentNode.removeChild(noteEl);
        noteEl = null;
        return;
      }
      if (!noteEl) {
        noteEl = global.document.createElement('div');
        noteEl.className = 'synth-msg';
        // The note sits inside the node the exporter rasterises, so without this
        // an instruction in English is baked into the user's picture.
        noteEl.setAttribute('data-export-hide', '');
        canvas.parentNode.appendChild(noteEl);
      }
      if (noteEl.textContent !== txt) noteEl.textContent = txt;
    }
    var CAM_WAITING = 'Press "Go live" to let the camera drive this scene.';
    var CAM_ABSENT = 'This shell cannot open a camera, so this scene is playing on its own.';
    function cameraNote() {
      if (!useCam) return;
      // Frames still ARRIVING, not "one arrived once": a stopped camera leaves
      // the last frame latched, and a note that never returns would claim the
      // picture is still being driven by one.
      setNote(camSeq >= 0 && camIdle < CAM_STALE ? null : (cfg.cameraReady ? CAM_WAITING : CAM_ABSENT));
    }

    function disposeAll() {
      if (disposed) return;
      disposed = true;
      if (raf) global.cancelAnimationFrame(raf);
      if (pointerHandlers) pointerHandlers();
      if (swarm) swarm.dispose();
      if (camTex) gl.deleteTexture(camTex);
      setNote(null);
      for (var i = 0; i < fbos.length; i++) {
        gl.deleteTexture(fbos[i].tex);
        gl.deleteFramebuffer(fbos[i].fbo);
      }
      for (var k in prog) if (Object.prototype.hasOwnProperty.call(prog, k)) gl.deleteProgram(prog[k].p);
      gl.deleteBuffer(quad);
      // Contexts are capped around 16 per tab and are not collected promptly,
      // so a paint that leaks one is a tool that stops rendering after a while.
      var lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    }

    function loop(ts) {
      if (disposed) return;
      // A detached canvas is a dead instrument. The tool view's teardown has no
      // hook for a disposer a template registered, and only the NEXT paint of this
      // same tool calls dispose() - so without this, navigating away leaves the
      // full solve running at 60fps, and its GL context pinned (they cap around
      // 16 a tab), for the rest of the session. Same guard audiogram uses.
      if (!canvas.isConnected) { disposeAll(); return; }
      raf = global.requestAnimationFrame(loop);
      // The exporter is driving exact frames: stop advancing on wall-clock (a
      // stray repaint would clobber the phase between paint and capture), but
      // keep the loop armed so it resumes when the flag clears.
      if (canvas.__lollyFrameDriven) { resumeOwed = true; return; }
      if (global.document && global.document.hidden) return;
      // Only the live loop takes camera frames, so a driven export replays
      // against one latched frame rather than one that moves under it.
      pumpCamera();
      cameraNote();
      if (resumeOwed) { lastTs = ts; resumeOwed = false; return; }
      var dt = lastTs ? (ts - lastTs) / 1000 : FRAME_DT;
      lastTs = ts;
      if (!(dt > 0)) dt = FRAME_DT;
      acc += Math.min(dt, 0.25);
      var n = 0;
      while (acc >= FRAME_DT && n < 4) { acc -= FRAME_DT; step(liveFrame++, LOOP, true); n++; }
      if (n) paint();
    }

    // A struck MIDI key is a live splat, exactly like a pointer tap: the pitch
    // picks the spot (and its colour) across the field, the velocity is how hard
    // the ink lands. It rides the same bounded impulse queue the pointer uses, so
    // it never touches state - a played melody is not eighty undo steps or a URL
    // that grows a param per note. No-op once the exporter owns the canvas or the
    // instrument is gone, so a note in flight can neither disturb a capture nor
    // drive a tool that has already left the page.
    function strike(note, vel) {
      if (disposed || canvas.__lollyFrameDriven) return;
      if (impulses.length >= MAX_POINTS) return;
      var x = clampNum((note - 24) / 72, 0, 1);   // C1..C7 spread across the width
      var f = clampNum(vel / 127, 0, 1) * 1800;   // a harder hit kicks harder
      impulses.push({ x: x, y: 0.32, dx: 0, dy: f, tone: x });
    }

    var pointerHandlers = null;
    function wirePointer() {
      var last = null;
      var down = function (e) { last = { x: e.clientX, y: e.clientY }; };
      var move = function (e) {
        var r = canvas.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var px = last ? e.clientX - last.x : 0;
        var py = last ? e.clientY - last.y : 0;
        last = { x: e.clientX, y: e.clientY };
        if (impulses.length >= MAX_POINTS) return;
        impulses.push({
          x: clampNum((e.clientX - r.left) / r.width, 0, 1),
          y: clampNum(1 - (e.clientY - r.top) / r.height, 0, 1),
          dx: clampNum(px * 12, -2500, 2500),
          dy: clampNum(-py * 12, -2500, 2500),
          tone: clampNum((e.clientX - r.left) / r.width, 0, 1)
        });
      };
      var up = function () { last = null; };
      canvas.addEventListener('pointerdown', down);
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointerleave', up);
      pointerHandlers = function () {
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up);
        canvas.removeEventListener('pointerleave', up);
      };
    }
    if (cfg.live) wirePointer();

    // One synchronous frame now: a headless or hidden-tab host may never fire a
    // rAF, and the export path would then capture an empty canvas.
    renderLoopFrame(0);
    // Before the first rAF, so a hidden tab or a headless host still explains an
    // undriven camera scene rather than showing an unaccounted-for picture.
    cameraNote();
    raf = global.requestAnimationFrame(loop);

    return {
      renderLoopFrame: renderLoopFrame,
      sizes: sizes,
      scene: scene,
      swarm: swarm,
      symmetry: sectors,
      rampRotate: rampRot,
      note: function () { return noteEl ? noteEl.textContent : null; },
      strike: strike,
      dispose: disposeAll
    };
  }

  // signalsAt/unpackAudio are exported for the same reason fieldSizes is: they
  // are pure and testable without a GL context, and the signals mapping is the
  // part an export's reproducibility actually rests on.
  global.LollySynth = {
    create: create, fieldSizes: fieldSizes, LOOP: LOOP, SIM_HZ: SIM_HZ, SPECTRUM: SPECTRUM,
    MAX_PARTICLES: MAX_PARTICLES, PARTICLE_MIN: PARTICLE_MIN,
    CAM_W: CAM_W, CAM_H: CAM_H, SCENES: SCENES,
    unpackAudio: unpackAudio, unpackTargets: unpackTargets, symmetryFold: symmetryFold,
    signalsAt: signalsAt, clipTime: clipTime, IDLE: IDLE
  };
})(typeof window !== 'undefined' ? window : this);
