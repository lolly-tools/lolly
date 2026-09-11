// SPDX-License-Identifier: MPL-2.0
// `synth` tool hooks - pure, DOM-free. Fold the whole input model into one
// `_state` extra (the underscore keeps annotateTemplate away, so it stays valid
// JSON inside <script type="application/json">) which the template's WebGL2
// instrument reads. Mirrors community/3d/hooks.js.
//
// Every user-settable value is clamped HERE, not in the shader: the sim is fed
// straight from a URL, so a hostile `?intensity=1e9` has to die at the door.

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

// mulberry32 - the seeded PRNG the whole tool runs on. Never Math.random: a
// shared URL has to replay the same piece, on any machine, forever.
function _mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The scene's forcing table: where ink is injected, and how each emitter orbits.
 *
 * `turns` is a whole number of orbits per loop, which is what makes the loop
 * seamless - the forcing at loop phase 1 is identical to phase 0, so a field in
 * its periodic attractor arrives back where it started. Sampled positions are
 * part of the visual contract: change the draw order or the count and every
 * shared seed renders a different piece, so extend this append-only.
 */
function _emitters(seed, count) {
  var rnd = _mulberry32(seed);
  var out = [];
  for (var i = 0; i < count; i++) {
    out.push({
      x: 0.18 + rnd() * 0.64,
      y: 0.18 + rnd() * 0.64,
      radius: 0.06 + rnd() * 0.14,
      phase: rnd(),
      turns: 1 + Math.floor(rnd() * 3),
      tone: rnd(),
      push: 320 + rnd() * 380
    });
  }
  return out;
}

/* ── Swarm targets ───────────────────────────────────────────────────────────
 *
 * The swarm flies at target points sampled from the headline's glyph outlines
 * or from a picked logo. Sampling is deterministic BY CONSTRUCTION: a fixed
 * raster size, a fixed threshold, a fixed sample stride and a fixed point
 * budget, so the same asset always yields the same points on any machine.
 *
 * Sampled positions are part of the visual contract a shared URL replays, so
 * these constants are append-only - changing one re-renders every piece anyone
 * ever shared. They are the SAME rules community/growth traces a logo with
 * (plans/157 section 2.5): change them in both files or in neither.
 */
var TARGET_RASTER = 256;    // growth's LOGO_RASTER
var TARGET_ALPHA = 0.5;     // growth's LOGO_ALPHA
var TARGET_LUMA = 0.5;      // growth's LOGO_LUMA
var TARGET_STRIDE = 2;      // growth's LOGO_STRIDE
var TARGET_COUNT = 2048;    // points packed into _state, 4 bytes each
var TARGET_FIT = 0.72;      // of the frame's SHORTER side, so the fit is square
var CURVE_STEPS = 8;        // host.text.toPath emits absolute M/L/C/Q/Z only
var MAX_TEXT = 60;          // mirrors the manifest's maxLength
var MAX_PARTICLES = 200000;
var PARTICLE_MIN = 1000;

var FALLBACK_FAMILY = 'sans-serif';   // the export font resolver maps generics to the brand role

function _text(v) {
  return (v == null ? '' : String(v)).replace(/[\r\n\t]+/g, ' ').trim().slice(0, MAX_TEXT);
}

/** SVG path data to one closed flat polyline per subpath. A glyph's counters
 *  are separate subpaths, so an "O" yields two rings and the swarm traces both.
 *  Lifted from community/growth's flattenPath - same emitter, same parser. */
function _flattenPath(d) {
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
            v * v * v * cy + 3 * v * v * t * b1y + 3 * v * t * t * b2y + t * t * t * c3y
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

function _loopLen(L) {
  var n = L.length / 2, per = 0;
  for (var i = 0; i < n; i++) {
    var j = (i + 1) % n;
    per += Math.hypot(L[j * 2] - L[i * 2], L[j * 2 + 1] - L[i * 2 + 1]);
  }
  return per;
}

/**
 * TARGET_COUNT points spread evenly along the total arc length of `loops`.
 *
 * By arc length, not by vertex: a flattened curve carries far more vertices per
 * millimetre than a straight run, so sampling vertices would crowd every corner
 * and leave the stems bare. The budget is fixed, so a one-letter headline and a
 * whole logo hand the shader the same number of targets.
 */
function _walkLoops(loops) {
  var per = 0, i, k;
  for (i = 0; i < loops.length; i++) per += _loopLen(loops[i]);
  if (!(per > 0)) return [];
  var step = per / TARGET_COUNT;
  var out = [], acc = 0, next = 0;
  for (i = 0; i < loops.length && out.length < TARGET_COUNT * 2; i++) {
    var L = loops[i], n = L.length / 2;
    for (k = 0; k < n && out.length < TARGET_COUNT * 2; k++) {
      var j = (k + 1) % n;
      var x1 = L[k * 2], y1 = L[k * 2 + 1];
      var dx = L[j * 2] - x1, dy = L[j * 2 + 1] - y1;
      var len = Math.hypot(dx, dy);
      while (next <= acc + len && out.length < TARGET_COUNT * 2) {
        var f = len > 0 ? (next - acc) / len : 0;
        out.push(x1 + dx * f, y1 + dy * f);
        next += step;
      }
      acc += len;
    }
  }
  return out;
}

/**
 * Fit sampled points into the canvas as [0,1] uv pairs.
 *
 * Uniform scale, so a headline is never stretched by the frame's aspect: the
 * fit is computed in units of the SHORTER side and only then divided into uv
 * x. Y is flipped because both sources count rows downward (glyph outlines and
 * getImageData alike) while the canvas counts uv upward.
 */
function _fitUv(pts, aspect) {
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, i;
  for (i = 0; i < pts.length; i += 2) {
    if (pts[i] < minX) minX = pts[i];
    if (pts[i] > maxX) maxX = pts[i];
    if (pts[i + 1] < minY) minY = pts[i + 1];
    if (pts[i + 1] > maxY) maxY = pts[i + 1];
  }
  var w = maxX - minX, h = maxY - minY;
  if (!Number.isFinite(minX) || !(w > 0 || h > 0)) return [];
  var s = TARGET_FIT / Math.max(w, h);
  var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  var out = [];
  for (i = 0; i < pts.length; i += 2) {
    out.push(
      _clamp(0.5 + ((pts[i] - cx) * s) / aspect, 0, 1),
      _clamp(0.5 - (pts[i + 1] - cy) * s, 0, 1)
    );
  }
  return out;
}

/** The target of last resort. A ring is never blank and never wrong: it is what
 *  the swarm flies at with no headline, no logo, or a source that would not
 *  sample. */
function _ringUv(aspect) {
  var out = [];
  for (var i = 0; i < TARGET_COUNT; i++) {
    var a = (i / TARGET_COUNT) * Math.PI * 2;
    out.push(0.5 + (Math.cos(a) * TARGET_FIT * 0.5) / aspect, 0.5 + Math.sin(a) * TARGET_FIT * 0.5);
  }
  return out;
}

/** Pack uv pairs 16 bits a coordinate. Eight bits would quantise a 1280-wide
 *  frame to 5px steps, which is visible as a stepped outline. */
function _packTargets(uv) {
  var bytes = new Uint8Array(uv.length * 2);
  for (var i = 0; i < uv.length; i++) {
    var v = Math.round(_clamp(uv[i], 0, 1) * 65535);
    bytes[i * 2] = (v >> 8) & 255;
    bytes[i * 2 + 1] = v & 255;
  }
  return { count: uv.length / 2, data: _b64(bytes) };
}

async function _familyFor(h) {
  try {
    if (h && h.tokens && h.tokens.resolve) {
      var fam = await h.tokens.resolve('{font.brand}');
      if (typeof fam === 'string' && fam && fam.indexOf('{') !== 0) return fam;
    }
  } catch (e) { /* fall back to the generic, which the resolver maps to the brand role */ }
  return FALLBACK_FAMILY;
}

async function _textUv(h, text, aspect) {
  if (!h || !h.text || !h.text.fontUrl || !h.text.toPath) throw new Error('this host cannot resolve fonts');
  var family = await _familyFor(h);
  var f = await h.text.fontUrl(family, { weight: 700 });
  if (!f || !f.url) throw new Error('no font file found for "' + family + '"');
  var run = await h.text.toPath({ text: text, fontUrl: f.url, fontSize: 200, variations: f.variations });
  if (!run || !run.d) throw new Error('nothing to outline');
  var uv = _fitUv(_walkLoops(_flattenPath(run.d)), aspect);
  if (!uv.length) throw new Error('nothing to outline');
  return uv;
}

// An asset ref may arrive already carrying its url, or as an id the host still
// has to resolve - the community convention from growth / link-card.
async function _logoUrl(h, ref) {
  if (!ref) return '';
  if (typeof ref.url === 'string' && ref.url) return ref.url;
  try {
    if (h && h.assets && h.assets.get && ref.id) {
      var full = await h.assets.get(ref.id);
      if (full && typeof full.url === 'string') return full.url;
    }
  } catch (e) { /* fall through to the ring */ }
  return '';
}

/** Rasterise the logo once at TARGET_RASTER and sample its silhouette on a
 *  fixed grid. Offscreen only - nothing here is ever attached to a document. */
async function _logoUv(url, aspect) {
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
  cv.width = TARGET_RASTER;
  cv.height = TARGET_RASTER;
  var ctx = cv.getContext('2d');
  if (!ctx) throw new Error('this host cannot rasterise a logo');
  var iw = img.naturalWidth || img.width || 1;
  var ih = img.naturalHeight || img.height || 1;
  var s = Math.min(TARGET_RASTER / iw, TARGET_RASTER / ih);
  ctx.drawImage(img, (TARGET_RASTER - iw * s) / 2, (TARGET_RASTER - ih * s) / 2, iw * s, ih * s);
  var data = ctx.getImageData(0, 0, TARGET_RASTER, TARGET_RASTER).data;
  var cells = [];
  for (var y = 0; y < TARGET_RASTER; y += TARGET_STRIDE) {
    for (var x = 0; x < TARGET_RASTER; x += TARGET_STRIDE) {
      var p = (y * TARGET_RASTER + x) * 4;
      var alpha = data[p + 3] / 255;
      var luma = (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) / 255;
      if (alpha > TARGET_ALPHA && luma < TARGET_LUMA) cells.push(x, y);
    }
  }
  if (!cells.length) throw new Error('the logo sampled to nothing');
  // Decimate by a whole stride rather than by picking: the kept points stay
  // evenly spread over the mark, and which ones are kept does not depend on how
  // many there happened to be beyond the ratio.
  var keep = Math.ceil(cells.length / 2 / TARGET_COUNT);
  var pts = [];
  for (var i = 0; i < cells.length / 2; i += keep) pts.push(cells[i * 2], cells[i * 2 + 1]);
  var uv = _fitUv(pts, aspect);
  if (!uv.length) throw new Error('the logo sampled to nothing');
  return uv;
}

var _targets = null;   // { key, packed } - the sampled points for the current source
var _tpending = null;  // { key, promise } - a sampling already in flight for it

function _resolveTargets(h, key, text, logoRef, aspect) {
  if (_tpending && _tpending.key === key) return _tpending.promise;
  var failed = false;
  var promise = Promise.resolve()
    .then(function () {
      if (logoRef) {
        return _logoUrl(h, logoRef).then(function (url) {
          if (!url) throw new Error('that logo has no file to sample');
          return _logoUv(url, aspect);
        });
      }
      if (text) return _textUv(h, text, aspect);
      return _ringUv(aspect);
    })
    .catch(function (err) {
      // A host with no font resolver, an undecodable logo, a headline of pure
      // spaces: all normal outcomes. Say so once and fly the ring.
      if (h && h.log) h.log('info', 'synth: the swarm target could not be sampled, flying a ring', { error: err && err.message ? err.message : String(err) });
      failed = true;
      return _ringUv(aspect);
    })
    .then(function (uv) {
      var packed = _packTargets(uv && uv.length >= 2 ? uv : _ringUv(aspect));
      // Only a real sample is cached. Caching the ring under this key would pin it
      // for the life of the mount, so a transient font or logo failure would survive
      // re-typing the same headline.
      if (!failed) _targets = { key: key, packed: packed };
      return packed;
    })
    .then(function (out) { if (_tpending && _tpending.key === key) _tpending = null; return out; });
  _tpending = { key: key, promise: promise };
  return promise;
}

var _SCENES = ['ink', 'swarm', 'field', 'camera'];

/* ── Camera ──────────────────────────────────────────────────────────────────
 *
 * The `camera` scene reads the live feed through host.media: the runtime
 * subscribes on startLive() and calls onFrame once per frame with plain RGBA
 * bytes. Progressive enhancement, exactly as the schema requires of an onFrame
 * tool - it "must NOT be declared as a required 'camera' capability", because a
 * declared capability is a hard gate that would make every OTHER scene of this
 * tool unavailable in a shell without a camera (the CLI refuses such a tool
 * outright). A shell with no camera therefore still runs this scene; it just
 * runs it un-driven, and says so on the canvas.
 *
 * The frame is sampled to a FIXED small luma grid and handed to the instrument
 * as a property on the realm - the same handoff community/growth uses for its
 * sim. It is NOT returned as a patch: a patch re-renders the tool's DOM, which
 * drops the WebGL context, so a per-frame patch would build and leak one context
 * a frame against a browser cap of about 16.
 *
 * onFrame is not time-boxed and the runtime drops frames that arrive while the
 * previous one is still in the hook, so this sampler self-throttles. It must not
 * queue frames of its own.
 */
var CAM_W = 96;   // the camera grid, matched by CAM_W/CAM_H in lib/synth.js
var CAM_H = 54;   // fixed, so the texture never resizes and the cost per frame is fixed
var _cam = { w: CAM_W, h: CAM_H, lum: new Uint8Array(CAM_W * CAM_H), n: 0 };

/**
 * Sample one camera frame to the fixed luma grid.
 *
 * `frame.data` is valid only for the synchronous duration of the call (the shell
 * may reuse the buffer afterwards), so the pixels are read and copied HERE, never
 * retained. Nearest sampling rather than an area average: the grid is a
 * displacement source, not a photograph, and a box filter over a 720p frame is
 * real work on every frame.
 */
function _sampleFrame(frame, out) {
  var d = frame.data, w = frame.width | 0, h = frame.height | 0;
  if (!d || !(w > 0) || !(h > 0) || d.length < w * h * 4) return false;
  for (var y = 0; y < CAM_H; y++) {
    var sy = Math.min(h - 1, Math.floor(((y + 0.5) * h) / CAM_H));
    for (var x = 0; x < CAM_W; x++) {
      var sx = Math.min(w - 1, Math.floor(((x + 0.5) * w) / CAM_W));
      var p = (sy * w + sx) * 4;
      out[y * CAM_W + x] = (0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2]) | 0;
    }
  }
  return true;
}

function onFrame(ctx) {
  var frame = ctx && ctx.frame;
  if (!frame || !_sampleFrame(frame, _cam.lum)) return;
  _cam.n++;
  if (typeof window !== 'undefined') window.__lollySynthCam = _cam;
  // No patch on purpose: see above. The instrument reads _cam off the realm.
}

/* ── Audio ───────────────────────────────────────────────────────────────────
 *
 * host.audio.analyse turns the picked clip into a per-frame track the scene
 * reads as its Signals record. It runs ONCE per clip: the result is cached in
 * module state (hooks share one module instance per mount, the pattern
 * audiogram uses for its analysed length), so dragging a slider re-folds the
 * state without re-decoding the audio.
 *
 * The call is async and the hook budget is real (onInit 5s, onInput 2s). A cold
 * decode can outrun it; the runtime then applies no patch now and LATE-APPLIES
 * the same patch when it lands (engine 1.146). So a miss costs a late frame,
 * never a hang - and a clip that cannot be decoded at all leaves the scene
 * un-reactive rather than failing the render.
 */
var AUDIO_BANDS = 32;      // the Signals contract's spectrum length - packed as-is
var AUDIO_FPS = 24;        // signal-track rate; the sim runs at 60 and reads nearest
var AUDIO_FPS_MIN = 1;     // the analyse contract's own floor
// Payload ceiling: 37 bytes a frame, so 1800 frames is ~67 KB raw (~89 KB after
// base64). Enforced on BOTH axes, which is what actually makes it a ceiling: past
// ~75 s the rate drops, and once even the floor rate would overrun (past
// AUDIO_MAX_FRAMES seconds) the analysed WINDOW is capped instead. Rate alone
// leaves the payload growing linearly again - an hour-long mix packed 14,400
// frames, eight times this, re-parsed and un-base64'd on every single paint.
var AUDIO_MAX_FRAMES = 1800;

var _track = null;    // { key, audio } - the packed analysis for the current clip
var _pending = null;  // { key, promise } - an analyse already in flight for it
var _dur = 0;         // analysed length in seconds; 0 when there is no clip

/** Identity of a picked asset, for the analysis cache. */
function _srcKey(src) {
  if (!src) return '';
  if (typeof src === 'string') return src;
  return String(src.id || src.url || '');
}

/** The analyse options for a clip of `sec` seconds - 0 when the length is not
 *  known yet, which plans the bounded first pass that finds it out. Never more
 *  than AUDIO_MAX_FRAMES frames: fps x window is the frame count. */
function _plan(sec) {
  var fps = sec > 0
    ? Math.max(AUDIO_FPS_MIN, Math.min(AUDIO_FPS, Math.floor(AUDIO_MAX_FRAMES / sec)))
    : AUDIO_FPS;
  var span = AUDIO_MAX_FRAMES / fps;
  return { fps: fps, bands: AUDIO_BANDS, window: sec > 0 ? Math.min(sec, span) : span };
}

function _byte(v) {
  var n = Math.round((Number.isFinite(v) ? v : 0) * 255);
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

var _B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 a byte array by hand: hooks run in whatever realm the shell gives
 *  them (a browser window, a Node context under the CLI), and this is shorter
 *  than reasoning about which globals exist where. Same helper as audiogram. */
function _b64(bytes) {
  var out = '';
  for (var i = 0; i < bytes.length; i += 3) {
    var a = bytes[i];
    var b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    var c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    var n = (a << 16) | (b << 8) | c;
    out += _B64[(n >> 18) & 63] + _B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? _B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? _B64[n & 63] : '=';
  }
  return out;
}

/**
 * Pack an AudioAnalysis into the track the lib unpacks.
 *
 * Section order is the contract with lib/synth.js unpackAudio():
 *   rms, bass, mid, treb, flux - `count` bytes each, then magnitude (count x bands).
 * Changing it here changes it there.
 *
 * `bpm: null` is carried through UNTOUCHED. Null is a real answer - speech,
 * ambience and pads have no tempo to find - and a visual built on a wrong beat
 * grid looks far worse than one built on none. Never substitute 120.
 */
function _pack(a) {
  var f = a.frames;
  var bands = f.bands > 0 ? f.bands | 0 : AUDIO_BANDS;
  var bytes = new Uint8Array(f.count * 5 + f.count * bands);
  var at = 0;
  var tracks = [f.rms, f.bass, f.mid, f.treb, f.flux];
  for (var t = 0; t < tracks.length; t++) {
    for (var i = 0; i < f.count; i++) bytes[at++] = _byte(tracks[t][i]);
  }
  for (var m = 0; m < f.count * bands; m++) bytes[at++] = _byte(f.magnitude[m]);
  return {
    fps: a.fps,
    count: f.count,
    bands: bands,
    dur: a.window,
    bpm: a.bpm === null || !Number.isFinite(a.bpm) ? null : a.bpm,
    beats: a.bpm === null || !a.beats ? [] : Array.prototype.map.call(a.beats, function (s) { return Math.round(s * 1000) / 1000; }),
    data: _b64(bytes)
  };
}

function _analyse(h, src, key) {
  if (_pending && _pending.key === key) return _pending.promise;
  // The rate has to be chosen BEFORE the analysis, so the clip length is guessed
  // from the asset's own metadata where it has any; with no hint the first pass is
  // window-capped, which bounds its cost and reports the real length.
  var hintMs = src && src.meta ? Number(src.meta.durationMs) : 0;
  var promise = Promise.resolve()
    .then(function () { return h.audio.analyse(src, _plan(hintMs > 0 ? hintMs / 1000 : 0)); })
    .then(function (a) {
      // `duration` is the whole source; `window` is what was actually read.
      var plan = _plan(a.duration > 0 ? a.duration : a.window);
      // A second decode is real work (audiogram's rule), so it only happens when
      // the first pass was badly wrong: the rate off by more than 2x, or a span
      // short of what the plan would have covered.
      var short = a.window + 0.05 < plan.window;
      return (plan.fps * 2 <= a.fps || short) ? h.audio.analyse(src, plan) : a;
    })
    .then(function (a) {
      var packed = _pack(a);
      _track = { key: key, audio: packed };
      return packed;
    })
    .catch(function (err) {
      // An undecodable clip is a normal outcome, not a bug - codec support really
      // does differ between browsers, and Node has almost none. Say so once and
      // leave the scene running un-reactive.
      if (h.log) h.log('info', 'synth: could not analyse the audio, playing un-reactive', { error: err && err.message ? err.message : String(err) });
      _track = { key: key, audio: null };
      return null;
    })
    .then(function (out) { if (_pending && _pending.key === key) _pending = null; return out; });
  _pending = { key: key, promise: promise };
  return promise;
}

function _compute(model, h) {
  var inp = {};
  for (var i = 0; i < model.length; i++) inp[model[i].id] = model[i].value;

  // indexOf over a literal list, never a lookup on an object: an enum read as a
  // map key lets `constructor`/`__proto__` through as a "valid" option.
  var scene = _SCENES.indexOf(inp.scene) >= 0 ? inp.scene : 'ink';
  var seed = Math.round(_clamp(_num(inp.seed, 7), 0, 999999));

  var cfg = {
    scene: scene,
    // The canvas backing store, and so the export resolution. Pinned to the
    // manifest's render.width/height - a hook cannot read the manifest, and
    // `width`/`height` are RESERVED url params that never become inputs.
    width: 1280,
    height: 720,
    // The manifest's render.video.duration, for the same reason: the scene needs a
    // loop length when the exporter renders frames without declaring one (gif,
    // apng, webp-anim), and a fixed guess in the lib plays the loop in slow motion.
    durationSec: 6,
    colors: [
      _color(inp.color1, '#30ba78'),
      _color(inp.color2, '#2453ff'),
      _color(inp.color3, '#efefef')
    ],
    // Degrees around the OKLab hue circle. Clamped rather than wrapped: a turn
    // past a full circle is a typo or a hostile URL, not a request for two turns.
    rampRotate: _clamp(_num(inp.rampRotate, 0), 0, 360),
    intensity: _clamp(_num(inp.intensity, 1.35), 0, 2),
    speed: _clamp(_num(inp.speed, 1), 0.05, 4),
    // Whole wedges only: half a wedge does not meet its mirror, and the count
    // arrives off a URL.
    symmetry: Math.round(_clamp(_num(inp.symmetry, 6), 1, 12)),
    seed: seed,
    live: inp.live === true,
    particles: Math.round(_clamp(_num(inp.particles, 160000), PARTICLE_MIN, MAX_PARTICLES)),
    // Whether this shell could open a camera at all, so the camera scene can say
    // which of the two it is - "press Go live" or "not here" - instead of leaving
    // an unexplained picture that is not the one that was asked for.
    cameraReady: !!(h && h.media && typeof h.media.isAvailable === 'function' && h.media.isAvailable()),
    emitters: _emitters(seed, 7)
  };

  var key = _srcKey(inp.audio);
  var canAnalyse = key && h && h.audio && h.audio.isAvailable && h.audio.isAvailable();
  var withAudio = function () {
    if (!canAnalyse) {
      _dur = 0;
      return { _state: _safeJson(cfg) };
    }
    var done = function (audio) {
      cfg.audio = audio || null;
      _dur = audio && audio.dur > 0 ? audio.dur : 0;
      return { _state: _safeJson(cfg) };
    };
    // Cache hit: fold synchronously, so no budget applies at all and a slider
    // drag never waits on audio that is already in hand.
    if (_track && _track.key === key) return done(_track.audio);
    return _analyse(h, inp.audio, key).then(done);
  };

  if (scene !== 'swarm') return withAudio();

  // A logo wins when one is picked, else the headline, else the ring. One rule,
  // no extra select to keep in step with what is actually filled in.
  var logoRef = inp.logo && typeof inp.logo === 'object' ? inp.logo : null;
  var text = _text(inp.text);
  var tKey = logoRef ? 'logo:' + String(logoRef.url || logoRef.id || '') : 'text:' + text;
  if (_targets && _targets.key === tKey) {
    cfg.targets = _targets.packed;
    return withAudio();
  }
  return _resolveTargets(h, tKey, text, logoRef, cfg.width / cfg.height).then(function (packed) {
    cfg.targets = packed;
    return withAudio();
  });
}

function _host(ctx) {
  return ctx.host || (typeof host !== 'undefined' ? host : null);
}

function onInit(ctx) { return _compute(ctx.model, _host(ctx)); }
function onInput(ctx) { return _compute(ctx.model, _host(ctx)); }

/**
 * Make the loop as long as the audio it is playing.
 *
 * The scene's own forcing is periodic, so without a clip any duration comes out
 * seamless and the manifest's default stands. With a clip the picture is walked
 * across the analysis, and the export's audio bed is that same clip - so a
 * duration that isn't the clip's length would drift the two apart by
 * construction. A duration the user typed is a deliberate instruction and wins.
 */
function beforeExport(ctx) {
  if (!ctx || !ctx.opts) return;
  var ANIMATED = { webm: 1, mp4: 1, gif: 1, apng: 1, 'webp-anim': 1 };
  if (!ANIMATED[ctx.format]) return;
  if (ctx.opts.durationUserSet) return;
  if (_dur > 0.5) ctx.opts.duration = Math.round(_dur * 100) / 100;
}
