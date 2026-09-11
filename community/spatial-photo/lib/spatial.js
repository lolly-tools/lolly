// SPDX-License-Identifier: MPL-2.0
/* Lolly Spatial - the WebGL2 parallax renderer, as one IIFE global.
 *
 * Ships as tool DATA under the tool's own lib/ (like tools/synth/lib/synth.js and
 * tools/3d/lib/three.min.js), loaded by a deduped dynamic <script> from the
 * template. Hand-written, not generated: there is no build step and no second
 * copy of this source, so the file that ships is the file that is reviewed.
 *
 * NO three.js. One textured, depth-displaced grid needs no scene graph - a
 * perspective matrix, a look-at matrix and an element buffer is the whole thing,
 * and a scene-graph dependency would be an order of magnitude more bytes than
 * the geometry it draws.
 *
 * WebGL2, deliberately - NOT WebGPU. A WebGPU canvas has no
 * `preserveDrawingBuffer` equivalent, so every raster/video export off one comes
 * out blank; WebGL2 runs the whole existing export stack today.
 *
 * DISOCCLUSION. A single photo has one layer, so what is hidden behind a
 * foreground edge does not exist. The mesh is CONTINUOUS: rather than tearing a
 * hole where a real scene would reveal new content, the triangles spanning a
 * depth cliff stretch, smearing the edge pixels across the gap. That is the
 * honest single-layer look, and it is why `amount` is clamped per preset in
 * hooks.js to the amplitude the stretch survives - the UI never offers the
 * setting where the stretch reads as a tear. (Layered matte + inpaint is v2,
 * plans/160 section 3.2.)
 *
 * DETERMINISM. Nothing here reads a wall clock: the live preview advances on the
 * rAF timestamp it is handed, and the export path drives an exact phase through
 * renderLoopFrame(t). Every camera path is periodic over t in [0,1) with the
 * phase wrapped, so path(1) IS path(0) - the loop closes by construction rather
 * than by a tuned seam.
 */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;

  /** 0 → 1 → 0 over one loop, flat at both ends, so an in-and-out move has no
   *  velocity step at the seam. */
  function swell(p) { return 0.5 - 0.5 * Math.cos(TAU * p); }

  /**
   * The camera moves. Each is a PURE function of loop phase returning a pose at
   * UNIT amplitude - the renderer scales it by `amount`, so one table serves
   * every strength and a preset can never be half-authored in the hooks.
   *
   * `camX`/`camY` are in plane half-heights, `camZ` is a fraction of the base
   * camera distance (negative = toward the picture), `tilt` is degrees of pitch,
   * and `fov` is an additive field-of-view multiplier delta (0 = unchanged).
   *
   * `fov` is the one field beyond plans/160's stated four: `vertigo` IS the
   * dolly-zoom, and a dolly-zoom without a field-of-view change is just a dolly.
   * Every other preset leaves it at 0.
   *
   * THE PHASE IS WRAPPED (`p = t - floor(t)`), which is what makes path(1)
   * EXACTLY path(0) rather than merely close: at t = 1 the expression being
   * evaluated is the t = 0 expression, so there is no float residue at the seam
   * for the frame-clock loop export to show as a jump.
   *
   * `heroT` is the poster pose - the phase a still export and the gallery thumb
   * are taken at, chosen as the most legible moment of the move rather than the
   * flat-on t = 0.
   */
  var PRESETS = [
    {
      name: 'dolly-in', heroT: 0.5,
      path: function (t) {
        var e = swell(t - Math.floor(t));
        return { camX: 0, camY: 0, camZ: -0.55 * e, tilt: 0, fov: 0 };
      }
    },
    {
      name: 'dolly-out', heroT: 0,
      path: function (t) {
        var e = swell(t - Math.floor(t));
        return { camX: 0, camY: 0, camZ: 0.5 * e, tilt: 0, fov: 0 };
      }
    },
    {
      name: 'sway', heroT: 0.25,
      path: function (t) {
        var p = t - Math.floor(t);
        return {
          camX: 0.32 * Math.sin(TAU * p),
          camY: 0.05 * Math.sin(2 * TAU * p),
          camZ: -0.06 * swell(p),
          tilt: -1.5 * Math.sin(TAU * p),
          fov: 0
        };
      }
    },
    {
      name: 'push-tilt', heroT: 0.5,
      path: function (t) {
        var e = swell(t - Math.floor(t));
        return { camX: 0, camY: 0.14 * e, camZ: -0.4 * e, tilt: 4 * e, fov: 0 };
      }
    },
    {
      // The dolly-zoom: the camera closes in while the field of view opens, so
      // the subject holds its size and everything behind it slides.
      name: 'vertigo', heroT: 0.5,
      path: function (t) {
        var e = swell(t - Math.floor(t));
        return { camX: 0, camY: 0, camZ: -0.42 * e, tilt: 0, fov: 0.5 * e };
      }
    },
    {
      name: 'drift', heroT: 0.25,
      path: function (t) {
        var p = t - Math.floor(t);
        return {
          camX: 0.16 * Math.sin(TAU * p),
          camY: 0.1 * Math.sin(2 * TAU * p),
          camZ: -0.12 * swell(p),
          tilt: 1.2 * Math.sin(TAU * p),
          fov: 0
        };
      }
    }
  ];

  function preset(name) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].name === name) return PRESETS[i];
    return PRESETS[0];
  }

  // ── mat4 (column-major, the order WebGL wants) ────────────────────────────

  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  }

  function lookAt(ex, ey, ez, cx, cy, cz) {
    var zx = ex - cx, zy = ey - cy, zz = ez - cz;
    var l = Math.sqrt(zx * zx + zy * zy + zz * zz) || 1;
    zx /= l; zy /= l; zz /= l;
    // up = (0,1,0); the camera never rolls, so the cross products stay this short.
    var xx = zz, xy = 0, xz = -zx;
    l = Math.sqrt(xx * xx + xz * xz) || 1;
    xx /= l; xz /= l;
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([
      xx, yx, zx, 0,
      xy, yy, zy, 0,
      xz, yz, zz, 0,
      -(xx * ex + xy * ey + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1
    ]);
  }

  function mul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) {
      for (var r = 0; r < 4; r++) {
        var s = 0;
        for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
    }
    return o;
  }

  // ── Shaders ───────────────────────────────────────────────────────────────

  var HEAD = '#version 300 es\nprecision highp float;\nprecision highp sampler2D;\n';

  // The grid carries NO vertex attributes: the uv is reconstructed from
  // gl_VertexID, so the only buffer uploaded is the element array.
  var MESH_VS = HEAD + [
    'uniform sampler2D uDepth;',
    'uniform mat4 uMvp;',
    'uniform vec2 uPlane;',      // plane half-extent (x = aspect, y = 1)
    'uniform vec2 uUvScale;',    // cover-fit of the picture into the frame
    'uniform vec2 uUvOffset;',
    'uniform float uRelief;',    // displacement depth, scaled by the inflate
    'uniform float uContrast;',
    'uniform int uGridN;',
    'uniform float uOverscan;',
    'out vec2 vUv;',
    'out float vDepth;',
    'float remap(float d){ return clamp(0.5 + (d - 0.5) * uContrast, 0.0, 1.0); }',
    'void main(){',
    '  int n = uGridN + 1;',
    '  vec2 g = vec2(float(gl_VertexID % n), float(gl_VertexID / n)) / float(uGridN);',
    // Overscan: the mesh reaches past the framed picture so a moving camera
    // finds stretched edge pixels there instead of the clear colour.
    '  vec2 q = g * (1.0 + 2.0 * uOverscan) - uOverscan;',
    '  vUv = q * uUvScale + uUvOffset;',
    '  float d = remap(texture(uDepth, vUv).r);',
    '  vDepth = d;',
    '  vec3 p = vec3((q.x - 0.5) * 2.0 * uPlane.x, (0.5 - q.y) * 2.0 * uPlane.y, (d - 0.5) * uRelief);',
    '  gl_Position = uMvp * vec4(p, 1.0);',
    '}'
  ].join('\n');

  // Colour + atmosphere, with the circle of confusion written into ALPHA so the
  // two blur passes can weight by it without a second render target.
  var MESH_FS = HEAD + [
    'in vec2 vUv;',
    'in float vDepth;',
    'uniform sampler2D uPhoto;',
    'uniform vec3 uFog;',
    'uniform float uFogAmount;',
    'uniform float uFocus;',
    'uniform float uDof;',
    'out vec4 fragColor;',
    'void main(){',
    '  vec3 c = texture(uPhoto, vUv).rgb;',
    // Distance haze: far (small depth) washes toward the brand colour, on a
    // falloff steep enough that the near field stays untouched.
    '  float far = 1.0 - vDepth;',
    '  c = mix(c, uFog, clamp(uFogAmount * pow(far, 1.5), 0.0, 1.0));',
    '  float coc = clamp(abs(vDepth - uFocus) * 2.4 * uDof, 0.0, 1.0);',
    '  fragColor = vec4(c, coc);',
    '}'
  ].join('\n');

  var FULL_VS = HEAD + [
    'out vec2 vUv;',
    'void main(){',
    '  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));',
    '  vUv = p;',
    '  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  /**
   * One separable pass of the depth-weighted blur. The radius is the pixel's own
   * circle of confusion, and each tap is weighted by the NEIGHBOUR's confusion
   * too, so a sharp foreground does not bleed into the blurred field behind it.
   * A gather blur, not a scatter one: cheap, and wrong at the exact silhouette
   * of a near object against a far one. That artefact is far smaller than the
   * edge-stretch it sits next to, so it stays a gather.
   */
  var BLUR_FS = HEAD + [
    'in vec2 vUv;',
    'uniform sampler2D uTex;',
    'uniform vec2 uDir;',       // texel step, one axis
    'uniform float uRadius;',
    'out vec4 fragColor;',
    'void main(){',
    '  vec4 c0 = texture(uTex, vUv);',
    '  float r = c0.a * uRadius;',
    '  if (r < 0.5) { fragColor = c0; return; }',
    '  vec3 sum = c0.rgb;',
    '  float wsum = 1.0;',
    '  for (int i = 1; i <= 8; i++){',
    '    float f = float(i) / 8.0;',
    '    vec2 off = uDir * r * f;',
    '    vec4 a = texture(uTex, vUv + off);',
    '    vec4 b = texture(uTex, vUv - off);',
    '    float g = exp(-f * f * 2.0);',
    '    float wa = g * (0.2 + a.a);',
    '    float wb = g * (0.2 + b.a);',
    '    sum += a.rgb * wa + b.rgb * wb;',
    '    wsum += wa + wb;',
    '  }',
    '  fragColor = vec4(sum / wsum, c0.a);',
    '}'
  ].join('\n');

  // ── GL helpers ────────────────────────────────────────────────────────────

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(s) || 'shader compile failed';
      gl.deleteShader(s);
      throw new Error(log);
    }
    return s;
  }

  function program(gl, vsSrc, fsSrc) {
    var p = gl.createProgram();
    var vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
    var fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      var log = gl.getProgramInfoLog(p) || 'program link failed';
      gl.deleteProgram(p);
      throw new Error(log);
    }
    var u = {};
    var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p: p, u: u };
  }

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

  function clampNum(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /**
   * Grid subdivisions for an output of W×H. A photo's relief is smooth, so the
   * grid only has to be fine enough that a depth cliff reads as an edge and not
   * as a staircase; past that it is pure vertex cost. The (capped) device pixel
   * ratio steps it down, because a phone is vertex- and fill-bound long before
   * it is detail-bound.
   */
  function gridSize(dpr) { return dpr > 1.5 ? 192 : 256; }

  var RELIEF = 0.7;       // displacement depth in plane half-heights
  /* How far past the framed picture the mesh reaches, as a fraction of the
   * frame. Anywhere it falls short, the clear colour (the fog colour, at full
   * saturation) bands the frame edge mid-move.
   *
   * The budget is the WIDEST view any preset reaches at its own `amount`
   * ceiling. Three things widen it and all three add up:
   *   - a camera that pulls BACK (`dolly-out`, camZ +0.5 at a ceiling of 0.8)
   *     scales the visible half-height by 1 + amount*camZ;
   *   - the far surface sits RELIEF/2 further away again;
   *   - `sway`/`drift` translate the camera laterally.
   * dolly-out is the binding case: (1 + 0.8*0.5) + (RELIEF/2)*tan(20°) = 1.527,
   * so the mesh half-extent 1 + 2*OVERSCAN = 1.56 must be at least that.
   * tests/spatial-photo.test.ts recomputes this per preset, so lowering it or
   * raising a preset's amplitude fails there rather than on screen.
   */
  var OVERSCAN = 0.28;
  var BASE_FOV = 40;      // degrees
  var MAX_BLUR_PX = 26;   // widest circle of confusion, in output pixels
  var INFLATE_MS = 600;   // the flat photo becoming a scene - plans/160 WP-D

  function create(canvas, cfg) {
    // preserveDrawingBuffer is THE load-bearing flag: the export path reads the
    // canvas after the frame has composited, and without it every raster and
    // video export is silently blank. It cannot be added by a later getContext -
    // the first call's attributes are the ones that stick.
    var gl = canvas.getContext('webgl2', {
      alpha: false, antialias: true, depth: true, stencil: false,
      premultipliedAlpha: false, preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    try {
      return build(gl, canvas, cfg);
    } catch (err) {
      // A shader that will not compile on some driver, or a target that will
      // not allocate, throws AFTER the context was taken - and only `dispose`
      // releases one. Nothing built means no disposer, so without this the
      // template's next paint takes another context and the tool stops
      // rendering entirely once the ~16-per-tab cap is reached.
      var lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      throw err;
    }
  }

  function build(gl, canvas, cfg) {
    var W = cfg.width, H = cfg.height;
    canvas.width = W;
    canvas.height = H;

    var dpr = Math.min(2, global.devicePixelRatio || 1);
    var N = gridSize(dpr);
    var move = preset(cfg.move);
    var fog = hexToRgb(cfg.fog);

    var meshProg = program(gl, MESH_VS, MESH_FS);
    var blurProg = program(gl, FULL_VS, BLUR_FS);

    // Element buffer only - the grid's uv comes from gl_VertexID.
    var idx = new Uint32Array(N * N * 6);
    var w = 0;
    for (var y = 0; y < N; y++) {
      for (var x = 0; x < N; x++) {
        var a = y * (N + 1) + x, b = a + 1, c = a + (N + 1), d = c + 1;
        idx[w++] = a; idx[w++] = c; idx[w++] = b;
        idx[w++] = b; idx[w++] = c; idx[w++] = d;
      }
    }
    var ebo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    var indexCount = idx.length;

    function makeTarget(tw, th) {
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      var fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { tex: tex, fbo: fbo };
    }

    var sceneRt = makeTarget(W, H);
    // The mesh self-occludes wherever it folds over a depth cliff, so the scene
    // pass needs a real depth buffer - without it the stretched skirt of a near
    // object paints over the object itself.
    var depthRb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthRb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, W, H);
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneRt.fbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRb);
    // An incomplete target draws nothing and reports nothing, which reaches the
    // user as a blank canvas with no cause. Ask while there is still somewhere
    // to say it. (makeTarget leaves its own framebuffer bound, so each check
    // reads the one just built.)
    checkTarget();
    var blurRt = makeTarget(W, H);
    checkTarget();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    function checkTarget() {
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error('This browser could not allocate the render targets.');
      }
    }

    function makeTexture(filter) {
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return tex;
    }

    var photoTex = makeTexture(gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, photoTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([32, 34, 38, 255]));

    // A flat map until the model answers: 0.5 everywhere is zero displacement,
    // so the photo shows the instant it decodes and the scene inflates later.
    // R16F rather than R32F: 16-bit float is filterable in core WebGL2, and a
    // relative depth map has nowhere near 16 bits of real signal.
    var depthTex = makeTexture(gl.LINEAR);
    gl.bindTexture(gl.TEXTURE_2D, depthTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, 1, 1, 0, gl.RED, gl.FLOAT, new Float32Array([0.5]));

    var uvScale = [1, 1], uvOffset = [0, 0];
    var hasDepth = false;
    var depthW = 1, depthH = 1, depthData = null;

    /** Cover-fit: the picture fills the frame, the overflow is cropped, and the
     *  overscan ring then reaches into the cropped-away pixels before it has to
     *  fall back to smearing the edge. */
    function fit(iw, ih) {
      var frame = W / H, img = (iw > 0 && ih > 0) ? iw / ih : frame;
      if (img > frame) {
        var sx = frame / img;
        uvScale = [sx, 1]; uvOffset = [(1 - sx) / 2, 0];
      } else {
        var sy = img / frame;
        uvScale = [1, sy]; uvOffset = [0, (1 - sy) / 2];
      }
    }

    function setPhoto(img) {
      gl.bindTexture(gl.TEXTURE_2D, photoTex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
      fit(img.naturalWidth || img.width, img.naturalHeight || img.height);
    }

    var inflate = 0;

    /** The depth map arrived. Uploading it starts the inflate: the scene rises
     *  out of the flat picture over INFLATE_MS. An export never sees a partial
     *  inflate - renderLoopFrame forces it to 1.
     *
     *  `instant` skips the rise. The template passes it for a map that was
     *  already on screen before this paint: the flourish belongs to the moment
     *  the depth first lands, not to every slider drag, which re-runs the whole
     *  template. */
    function setDepth(map, instant) {
      if (disposed || !map || !map.data || !map.width || !map.height) return;
      if (map.data.length < map.width * map.height) return;
      depthW = map.width; depthH = map.height;
      depthData = map.data;
      gl.bindTexture(gl.TEXTURE_2D, depthTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, map.width, map.height, 0, gl.RED, gl.FLOAT,
        map.data instanceof Float32Array ? map.data : new Float32Array(map.data));
      hasDepth = true;
      inflate = instant ? 1 : 0;
      draw(phase, inflate);
    }

    /** The depth under a point of the FRAME, in 0..1, for the focus pick. Falls
     *  back to the mid-plane while the map is still being computed. Applies the
     *  SAME contrast remap the vertex shader does - a focus depth read out of the
     *  raw map would drift off the surface it was picked on as contrast moves. */
    function depthAt(fx, fy) {
      if (!depthData) return 0.5;
      var u = clampNum(fx, 0, 1) * uvScale[0] + uvOffset[0];
      var v = clampNum(fy, 0, 1) * uvScale[1] + uvOffset[1];
      var x = Math.min(depthW - 1, Math.max(0, Math.round(u * (depthW - 1))));
      var y = Math.min(depthH - 1, Math.max(0, Math.round(v * (depthH - 1))));
      var d = depthData[y * depthW + x];
      if (!(typeof d === 'number' && isFinite(d))) return 0.5;
      return clampNum(0.5 + (clampNum(d, 0, 1) - 0.5) * cfg.depthContrast, 0, 1);
    }

    var aspect = W / H;
    var baseDist = 1 / Math.tan((BASE_FOV * Math.PI / 180) / 2);

    function draw(t, inflateNow) {
      // The loop is phase-SHIFTED so t = 0 is the preset's hero pose. The export
      // path's poster frame and the gallery thumb are both taken at t = 0, and a
      // still of a move should be its most legible moment, not the flat-on pose
      // every preset happens to start from. A shift of a periodic path is still
      // periodic, so the loop stays closed - unlike pinning t = 0 alone, which
      // would put a jump between the first frame and the second.
      var pose = move.path(t + move.heroT);
      var amt = cfg.amount;
      var fovDeg = BASE_FOV * (1 + amt * pose.fov);
      var dist = baseDist * (1 + amt * pose.camZ);
      var ex = amt * pose.camX, ey = amt * pose.camY;
      // Tilt is a pitch of the camera, expressed as an offset of what it looks
      // at - the same shot as rotating it, in a third of the matrix code.
      var look = Math.tan(amt * pose.tilt * Math.PI / 180) * dist;
      var mvp = mul(
        perspective(fovDeg * Math.PI / 180, aspect, 0.05, 40),
        lookAt(ex, ey, dist, ex, ey + look, 0)
      );

      var focusDepth = depthAt(cfg.focus[0], cfg.focus[1]);

      gl.bindFramebuffer(gl.FRAMEBUFFER, sceneRt.fbo);
      gl.viewport(0, 0, W, H);
      gl.enable(gl.DEPTH_TEST);
      gl.clearColor(fog[0], fog[1], fog[2], 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      gl.useProgram(meshProg.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, photoTex);
      gl.uniform1i(meshProg.u.uPhoto, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, depthTex);
      gl.uniform1i(meshProg.u.uDepth, 1);
      gl.uniformMatrix4fv(meshProg.u.uMvp, false, mvp);
      gl.uniform2f(meshProg.u.uPlane, aspect, 1);
      gl.uniform2f(meshProg.u.uUvScale, uvScale[0], uvScale[1]);
      gl.uniform2f(meshProg.u.uUvOffset, uvOffset[0], uvOffset[1]);
      gl.uniform1f(meshProg.u.uRelief, hasDepth ? RELIEF * inflateNow : 0);
      gl.uniform1f(meshProg.u.uContrast, cfg.depthContrast);
      gl.uniform1i(meshProg.u.uGridN, N);
      gl.uniform1f(meshProg.u.uOverscan, OVERSCAN);
      gl.uniform3f(meshProg.u.uFog, fog[0], fog[1], fog[2]);
      gl.uniform1f(meshProg.u.uFogAmount, cfg.fogAmount * (hasDepth ? inflateNow : 0));
      gl.uniform1f(meshProg.u.uFocus, focusDepth);
      gl.uniform1f(meshProg.u.uDof, cfg.dof * (hasDepth ? inflateNow : 0));
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
      gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_INT, 0);

      // Two separable passes: horizontal into a scratch target, vertical
      // straight onto the canvas. With dof at 0 every pixel's radius is 0 and
      // both passes are a copy, which is cheaper than branching the pipeline.
      gl.disable(gl.DEPTH_TEST);
      // The pixel's own circle of confusion already carries `dof`; the radius is
      // just the widest that confusion is allowed to reach, so multiplying by
      // dof again here would make the slider act squared.
      var radius = MAX_BLUR_PX;
      gl.useProgram(blurProg.p);
      gl.uniform1i(blurProg.u.uTex, 0);
      gl.uniform1f(blurProg.u.uRadius, radius);
      gl.activeTexture(gl.TEXTURE0);

      gl.bindFramebuffer(gl.FRAMEBUFFER, blurRt.fbo);
      gl.bindTexture(gl.TEXTURE_2D, sceneRt.tex);
      gl.uniform2f(blurProg.u.uDir, 1 / W, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, blurRt.tex);
      gl.uniform2f(blurProg.u.uDir, 0, 1 / H);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    var phase = 0;
    var lastTs = 0;
    var resumeOwed = false;
    var raf = 0;
    var disposed = false;

    /**
     * The deterministic export clock. t is normalised clip time in [0,1); the
     * camera path is periodic in it, so any clip length loops seamlessly and the
     * clip's real seconds (clipSec) change nothing about the pose - which is why
     * this signature ignores it.
     *
     * Inflation is forced complete here: the 0 → 1 rise is a mount flourish for
     * a person watching, and an export that caught it mid-way would silently
     * ship a half-flat render.
     */
    function renderLoopFrame(t01) {
      if (disposed) return;
      var t = (typeof t01 === 'number' && isFinite(t01)) ? t01 : 0;
      phase = t - Math.floor(t);
      inflate = hasDepth ? 1 : 0;
      resumeOwed = true;   // the live clock owes itself one swallowed delta
      draw(phase, inflate);
    }

    function loop(ts) {
      if (disposed) return;
      raf = global.requestAnimationFrame(loop);
      // The exporter is driving exact frames: stop advancing on wall-clock (a
      // stray repaint would clobber the phase between paint and capture), but
      // keep the loop armed so it resumes when the flag clears.
      if (canvas.__lollyFrameDriven) { resumeOwed = true; return; }
      if (global.document && global.document.hidden) return;
      if (resumeOwed) { lastTs = ts; resumeOwed = false; return; }
      var dt = lastTs ? (ts - lastTs) / 1000 : 0;
      lastTs = ts;
      if (!(dt > 0)) dt = 1 / 60;
      dt = Math.min(dt, 0.25);
      if (inflate < 1 && hasDepth) inflate = Math.min(1, inflate + dt * 1000 / INFLATE_MS);
      phase += dt / (cfg.duration > 0 ? cfg.duration : 6);
      phase -= Math.floor(phase);
      draw(phase, inflate);
    }

    // One synchronous frame now: a headless or hidden-tab host may never fire a
    // rAF, and the export path would then capture an empty canvas.
    draw(0, 0);
    raf = global.requestAnimationFrame(loop);

    return {
      renderLoopFrame: renderLoopFrame,
      setPhoto: setPhoto,
      setDepth: setDepth,
      depthAt: depthAt,
      heroT: move.heroT,
      dispose: function () {
        if (disposed) return;
        disposed = true;
        if (raf) global.cancelAnimationFrame(raf);
        gl.deleteTexture(photoTex);
        gl.deleteTexture(depthTex);
        gl.deleteTexture(sceneRt.tex);
        gl.deleteTexture(blurRt.tex);
        gl.deleteFramebuffer(sceneRt.fbo);
        gl.deleteFramebuffer(blurRt.fbo);
        gl.deleteRenderbuffer(depthRb);
        gl.deleteBuffer(ebo);
        gl.deleteProgram(meshProg.p);
        gl.deleteProgram(blurProg.p);
        // Contexts are capped around 16 per tab and are not collected promptly,
        // so a paint that leaks one is a tool that stops rendering after a while.
        var lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    };
  }

  global.LollySpatial = {
    create: create,
    PRESETS: PRESETS,
    preset: preset,
    gridSize: gridSize
  };
})(typeof window !== 'undefined' ? window : this);
