// SPDX-License-Identifier: MPL-2.0
/**
 * sequence-gl.ts - a hand-rolled WebGL2 quad compositor for the TILT export tier
 * (plans/104 section 6.4, P2b; plan 98 section 9.1 Phase C).
 *
 * THE PROBLEM IT SOLVES. A tilted camera projects each screen-parallel layer through
 * a HOMOGRAPHY (`KfProjection.m`, the element-local 3×3 the engine already computes),
 * and `CanvasRenderingContext2D.setTransform` is affine by definition - six numbers,
 * no perspective divide. So `drawItem` (sequence-render.worker.ts) cannot draw tilt at
 * all, and the shipped fallback (P2a) photographs the live artboard once per frame with
 * dom-to-image: 127 independent full-frame rasters that flicker, because each is a
 * separate serialise → SVG → raster pass with its own sub-pixel rounding.
 *
 * P2b's answer: capture each layer's CLEAN plate ONCE (the existing plate pipeline in
 * sequence-render.ts already does this - the tilt gate sits BEFORE it, so plates were
 * simply never built under tilt), upload each plate as a GL texture, and resample every
 * plate coherently on the GPU through its per-quad homography. One texture per layer,
 * one draw per layer per frame, sampled with a single consistent filter - no flicker.
 *
 * WHAT THIS MODULE IS, AND IS NOT. It is a THIN quad rasteriser: it knows how to place
 * one textured quad through the composed transform `[m3 | translate] · rotate · scale`
 * about the box centre, and how to blend it premultiplied over what is already on the
 * framebuffer. It knows NOTHING about the timeline, the plan, cameras, plates, DOF, or
 * the mux - sequence-render.ts's `renderGlComposite` owns all of that and drives this.
 * The engine supplies the projection MATH (`projectLayer` → `m3`); this file is pure
 * shell-side rendering, zero new dependencies, and imports only the `KfMatrix3` TYPE
 * from the engine (a row-major 3×3). Engine purity is unaffected - the guard scans
 * engine/src only, and nothing here reaches back into it.
 *
 * ── THE PER-QUAD TRANSFORM (the one thing that must be exactly right) ──────────
 *
 * The DOM oracle P2b matches is `composeTransform` (sequence-dom.ts): about
 * transform-origin = the authored box centre, the transform list is
 *
 *     [ m3 (as matrix3d) ELSE translate(dx, dy) ] → authored → rotate(rot) → scale(sc)
 *
 * `drawItem` folds `authored`'s rotation into `rot` (`item.rot = rect.rot + fold.rot`)
 * and applies `translate → rotate → scale` about the box centre. This shader does the
 * same, with the homography spliced in where the translate sat. For a box-local point
 * `p` (unscaled px, relative to the box centre - the quad's own coordinate), the
 * pipeline is:
 *
 *     pk        = R(rot) · S(scale) · p              // rotate+scale, INSIDE the matrix
 *     [X,Y,W]   = M · vec3(pk, 1)                    // M = m3, or translate(dx,dy)
 *     device.xy = S · ( boxCentre + [X/W, Y/W] )     // perspective divide, then × export scale
 *
 * At `m3 = null` we set `M = translate(dx, dy)` (unscaled), whose `W ≡ 1` collapses the
 * divide to the affine case and reproduces `drawItem`'s `translate(boxCentre·S + dx·S) ·
 * rotate · scale` byte-for-byte in ℝ. At `m3 ≠ null` the same expression IS the
 * homography. One code path, two behaviours, no branch in the hot loop - and the engine
 * already divided the centre magnification out of `m3` (see `localMatrix` in
 * keyframes.ts) so `scale` still carries `eff` and composes exactly as it does affine.
 *
 * PERSPECTIVE-CORRECT UVs, FOR FREE. Rather than divide by W ourselves and hand the
 * rasteriser a flat `gl_Position.w = 1` (which would interpolate the texture affinely
 * across a warped quad - the classic wrong-texture-on-a-tilt artefact), we emit the
 * homogeneous clip position with `gl_Position.w = W`. The GPU then interpolates the UV
 * varying divided by W and multiplies back per-fragment - exactly the `q = 1/w`
 * perspective correction, done in hardware, and identical to sampling the plate as a
 * texture mapped onto the tilted plane. For the affine case W ≡ 1, so it is inert.
 *
 * ROW-MAJOR → COLUMN-MAJOR. `KfMatrix3` is ROW-MAJOR (`[a,b,c, d,e,f, g,h,i]` maps
 * `[x,y,1]ᵀ → [X,Y,W]ᵀ`); a GLSL `mat3` is COLUMN-MAJOR. `m3ColMajor` transposes once
 * in JS before `uniformMatrix3fv(loc, false, …)` - getting this wrong silently
 * mirrors/shears every tilted quad, so it is the reference reordering, mirrored from
 * `kfMatrix3dCss` (keyframes.ts), and asserted in the unit test.
 *
 * ── THE ALPHA MODEL (must match P2a pixel-for-pixel) ──────────────────────────
 *
 * The context is created `{alpha:true, premultipliedAlpha:false, preserveDrawingBuffer:
 * true}` and cleared to (0,0,0,0), so the transparent artboard is preserved exactly as
 * the 2D paths' `clearRect` preserves it. Plate textures are uploaded with
 * `UNPACK_PREMULTIPLY_ALPHA_WEBGL = true` (so the sampled texel is PREMULTIPLIED), the
 * fragment shader scales that premultiplied texel by the layer alpha, and the blend
 * func is premultiplied source-over `(ONE, ONE_MINUS_SRC_ALPHA)` - the only blend that
 * does NOT fringe a blurred/anti-aliased cut-out at its edge. `preserveDrawingBuffer`
 * is mandatory: the readback (`readInto`) happens in the SAME synchronous tick as the
 * draw, but the frame sink that consumes it (`mux.addFrame`) is async, and a cleared
 * drawing buffer would hand the encoder black.
 *
 * SCOPE (first cut, plans/104 section 6.4). Static / image / lifted-SVG layers, in-thread
 * only. Non-`source-over` blend modes and video-under-tilt are explicit follow-ups; the
 * caller keeps the `SEQ_TILT_UNSUPPORTED` video refusal reachable, and the six epic
 * shots this tier targets use neither.
 */

import type { KfMatrix3 } from '@lolly/engine';

/** The per-quad animation state a draw needs - the `PlanItem` fields that place it. */
export interface GlQuadTransform {
  /** Projected centre offset from the authored centre, stage-native px (`item.dx/dy`). */
  dx: number;
  dy: number;
  /** Transition × keyframe × eff magnification (`item.scale`) - carries the depth eff. */
  scale: number;
  /** Authored + transition + keyframe rotation, DEGREES (`item.rot`). */
  rot: number;
  /** Authored opacity × transition alpha × behind-camera guard, 0–1 (`item.alpha`). */
  alpha: number;
  /**
   * The layer's blend mode. HONOURED only for `''`/`source-over`/`normal` in this cut;
   * any other value composes as source-over (a documented first-cut limitation - the
   * caller notes it, and the epic shots use none).
   */
  blend: string;
  /**
   * The element-local homography (row-major `KfMatrix3`) a TILTED camera produced, or
   * null for an untilted frame/layer - in which case the draw is the affine
   * `translate(dx, dy)` the divide collapses to.
   */
  m3: KfMatrix3 | null;
}

/** One quad to draw: a plate texture placed at a box through a `GlQuadTransform`. */
export interface GlQuadDraw {
  /** The plate (or DOF/live variant) texture, from `uploadPlate`/`setDofVariant`. */
  texture: WebGLTexture;
  /** The RESOLVED box, stage-native px: `{x,y}` = authored origin, `{w,h}` = draw size. */
  rect: { x: number; y: number; w: number; h: number };
  /** Export pixels per stage-native px (`job.scale`). */
  S: number;
  /** The animation state that places this quad. */
  item: GlQuadTransform;
  /**
   * The margin, stage-native px, the plate was captured with (`SeqJobLayer.platePad`):
   * the plate's origin is `(-platePad, -platePad)` in box space, so the quad extends
   * that far past the box on every side. 0 on an unpadded plate.
   */
  platePad: number;
  /**
   * The resolution the plate was captured at, over `S` (`SeqJobLayer.plateEff`).
   * INFORMATIONAL to the draw - the quad is placed at `S` regardless and the GPU
   * minifies the higher-resolution texture down to it; the caller uses `plateEff` to
   * bake the DOF blur at the plate's own resolution so the scaling law holds.
   */
  plateEff: number;
}

/** The compositor handle `renderGlComposite` drives. */
export interface GlQuadCompositor {
  /**
   * Upload (once, cached by `idx` + source identity) a layer's static plate as a
   * texture. Returns null when this realm cannot make the texture at all.
   */
  uploadPlate(idx: number, source: CanvasImageSource): WebGLTexture | null;
  /**
   * Upload a PER-FRAME variant texture for `idx` - a DOF-blurred plate, or a live
   * (Lottie/size-tween) re-raster - re-uploaded every frame into a texture reserved for
   * this layer. The source is consumed synchronously, so a POOLED scratch (e.g.
   * `renderFx`'s output) is safe to `releaseStage` the instant this returns.
   */
  setDofVariant(idx: number, source: CanvasImageSource): WebGLTexture | null;
  /** Clear the framebuffer to transparent (0,0,0,0) at the start of a frame. */
  beginFrame(): void;
  /** Composite one quad over what is already on the framebuffer. */
  drawQuad(d: GlQuadDraw): void;
  /** Blit the finished GL frame into a 2D readback context (clears it first). */
  readInto(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): void;
  /** Drop every texture and the GL context (`WEBGL_lose_context`). Idempotent. */
  dispose(): void;
  /** The GL canvas - a valid `drawImage` source for `readInto`. */
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  /** `MAX_TEXTURE_SIZE`, exposed so a caller can reason about a plate it must fit. */
  readonly maxTextureSize: number;
}

// ── the shaders ───────────────────────────────────────────────────────────────

/**
 * The whole per-quad transform lives here (see the header). `a_position` is the unit
 * quad in [0,1]²; `u_lo`/`u_hi` map it onto the plate's box-local extents (which include
 * the capture pad) so the same VBO draws every quad. `v_uv = a_position` is interpolated
 * perspective-correctly because `gl_Position.w = W`.
 */
const VERT = `#version 300 es
precision highp float;
in vec2 a_position;              // unit quad, [0,1]^2
uniform vec2 u_lo;               // box-local lo corner (rel. box centre), unscaled px
uniform vec2 u_hi;               // box-local hi corner, unscaled px
uniform float u_rot;             // radians
uniform float u_scale;
uniform mat3 u_m3;               // element-local homography (col-major); translate when affine
uniform vec2 u_boxCentre;        // authored box centre, unscaled px
uniform float u_S;               // export scale
uniform vec2 u_out;              // (outW, outH), device px
out vec2 v_uv;
void main() {
  vec2 local = mix(u_lo, u_hi, a_position);          // unscaled, relative to box centre
  vec2 sc = local * u_scale;                          // scale (innermost)
  float c = cos(u_rot);
  float s = sin(u_rot);
  vec2 pk = vec2(c * sc.x - s * sc.y, s * sc.x + c * sc.y);   // rotate (canvas y-down)
  vec3 hv = u_m3 * vec3(pk, 1.0);                     // homography, or translate (W==1)
  float X = hv.x;
  float Y = hv.y;
  float W = hv.z;
  // device = S * (boxCentre + [X/W, Y/W]); emit as homogeneous clip with w = W so the
  // rasteriser divides for us AND interpolates v_uv perspective-correctly.
  float cx = (2.0 * u_S / u_out.x) * (u_boxCentre.x * W + X) - W;   // = (2*device.x/outW - 1) * W
  float cy = W - (2.0 * u_S / u_out.y) * (u_boxCentre.y * W + Y);   // y flip: canvas top → clip +1
  gl_Position = vec4(cx, cy, 0.0, W);
  v_uv = a_position;
}`;

/**
 * Sample the premultiplied plate and scale by the layer alpha. Multiplying a
 * premultiplied colour by a scalar alpha scales both its RGB and its A, which is exactly
 * the layer opacity applied premultiplied - no un-premultiply, no fringe.
 */
const FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_tex;
uniform float u_alpha;
in vec2 v_uv;
out vec4 fragColor;
void main() {
  vec4 texel = texture(u_tex, v_uv);   // premultiplied (UNPACK_PREMULTIPLY_ALPHA_WEBGL)
  fragColor = texel * u_alpha;
}`;

// ── construction ──────────────────────────────────────────────────────────────

const DEG2RAD = Math.PI / 180;

/**
 * Row-major `KfMatrix3` → the column-major `Float32Array(9)` a GLSL `mat3` uniform
 * wants, or the translate matrix `translate(dx, dy)` when there is no homography.
 *
 * Row-major `m = [a,b,c, d,e,f, g,h,i]` (rows of `M`) transposes to column-major
 * `[a,d,g, b,e,h, c,f,i]`. `translate(dx,dy)` is row-major `[1,0,dx, 0,1,dy, 0,0,1]`,
 * i.e. column-major `[1,0,0, 0,1,0, dx,dy,1]`.
 */
export function m3ColMajor(m3: KfMatrix3 | null, dx: number, dy: number): Float32Array {
  if (m3) {
    return new Float32Array([
      m3[0], m3[3], m3[6],
      m3[1], m3[4], m3[7],
      m3[2], m3[5], m3[8],
    ]);
  }
  return new Float32Array([
    1, 0, 0,
    0, 1, 0,
    dx, dy, 1,
  ]);
}

/** A blend mode this cut composites normally (everything else is source-over too, noted). */
function isNormalBlend(blend: string): boolean {
  return !blend || blend === 'source-over' || blend === 'normal';
}

type GlCanvas = HTMLCanvasElement | OffscreenCanvas;

/** Make a canvas of this realm's own kind at `w × h`, or null where the realm has none. */
function makeCanvas(w: number, h: number): GlCanvas | null {
  const cw = Math.max(1, Math.floor(w));
  const ch = Math.max(1, Math.floor(h));
  if (typeof OffscreenCanvas !== 'undefined') {
    try { return new OffscreenCanvas(cw, ch); } catch { /* fall through */ }
  }
  if (typeof document !== 'undefined') {
    try {
      const el = document.createElement('canvas');
      el.width = cw;
      el.height = ch;
      return el;
    } catch { /* none */ }
  }
  return null;
}

/**
 * The context attributes P2b needs (see the ALPHA MODEL note). NOT
 * `failIfMajorPerformanceCaveat`: an export is a surface the user explicitly asked for
 * (behind the opt-in flag), and a slow correct render on a software rasteriser beats
 * refusing it - the same "strict where ambient, lax where asked for" reasoning
 * `vizPossible` (viz-support.ts) uses for a tapped visualiser.
 */
const GL_ATTRS: WebGLContextAttributes = {
  alpha: true,
  premultipliedAlpha: false,
  preserveDrawingBuffer: true,
  antialias: false,   // the plate carries its own edge AA in its alpha; MSAA would double it
  depth: false,
  stencil: false,
};

let supportCache: boolean | null = null;

/**
 * Can this realm create the WebGL2 quad compositor at all? Cheap, cached - the answer
 * cannot change within a session. Mirrors `viz-support.ts`'s probe shape.
 */
export function glQuadCompositorSupported(): boolean {
  if (supportCache !== null) return supportCache;
  if (typeof document === 'undefined' && typeof OffscreenCanvas === 'undefined') {
    supportCache = false;
    return supportCache;
  }
  try {
    const probe = makeCanvas(1, 1);
    const gl = probe
      ? (probe.getContext('webgl2', GL_ATTRS) as WebGL2RenderingContext | null)
      : null;
    supportCache = gl !== null;
    // Drop the probe context immediately so it does not hold a GPU slot.
    try { gl?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* ok */ }
  } catch {
    supportCache = false;
  }
  return supportCache;
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[sequence-gl] shader compile failed:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

/**
 * Build the compositor for an `outW × outH` frame, or null when WebGL2 / the program /
 * the geometry could not be set up (the caller then falls back to the P2a capture tier).
 *
 * The GL boilerplate SHAPE follows `lib/shutter.ts` (compile → COMPILE_STATUS,
 * attach×2 → linkProgram → LINK_STATUS → useProgram, unit-quad VBO bound to
 * `a_position`); the WebGL2 context, attributes and premultiply handling are P2b's own.
 */
export function createGlQuadCompositor(outW: number, outH: number): GlQuadCompositor | null {
  const W = Math.max(1, Math.floor(outW));
  const H = Math.max(1, Math.floor(outH));
  const canvas = makeCanvas(W, H);
  if (!canvas) return null;
  canvas.width = W;
  canvas.height = H;

  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext('webgl2', GL_ATTRS) as WebGL2RenderingContext | null;
  } catch {
    gl = null;
  }
  if (!gl) return null;

  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('[sequence-gl] program link failed:', gl.getProgramInfoLog(program));
    return null;
  }
  gl.useProgram(program);

  // Unit quad, two triangles. a_position is both the geometry (mapped onto box-local
  // extents by u_lo/u_hi in the vertex shader) and the UV (v_uv = a_position).
  const quad = new Float32Array([
    0, 0, 1, 0, 0, 1,
    0, 1, 1, 0, 1, 1,
  ]);
  const vbo = gl.createBuffer();
  if (!vbo) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = {
    lo: gl.getUniformLocation(program, 'u_lo'),
    hi: gl.getUniformLocation(program, 'u_hi'),
    rot: gl.getUniformLocation(program, 'u_rot'),
    scale: gl.getUniformLocation(program, 'u_scale'),
    m3: gl.getUniformLocation(program, 'u_m3'),
    boxCentre: gl.getUniformLocation(program, 'u_boxCentre'),
    S: gl.getUniformLocation(program, 'u_S'),
    out: gl.getUniformLocation(program, 'u_out'),
    tex: gl.getUniformLocation(program, 'u_tex'),
    alpha: gl.getUniformLocation(program, 'u_alpha'),
  };

  // Premultiplied source-over: the ONLY fringe-free blend for a transparent cut-out.
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);   // plate row 0 is its top; v_uv agrees
  gl.viewport(0, 0, W, H);
  gl.clearColor(0, 0, 0, 0);
  gl.uniform1i(u.tex, 0);
  gl.uniform2f(u.out, W, H);
  gl.uniform1f(u.S, 1);   // overwritten per quad

  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;

  // idx → { tex, source } for the CACHED static plate (identity-checked so a re-upload
  // of the same plate is free); idx → tex for the PER-FRAME variant (DOF/live), reused.
  const plateTex = new Map<number, { tex: WebGLTexture; source: CanvasImageSource }>();
  const frameTex = new Map<number, WebGLTexture>();
  // A scratch used only to downscale a source that exceeds MAX_TEXTURE_SIZE (rare).
  let fitScratch: GlCanvas | null = null;
  let disposed = false;

  function makeTexture(): WebGLTexture | null {
    if (!gl) return null;
    const tex = gl.createTexture();
    if (!tex) return null;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  /** A source small enough for `texImage2D`, downscaling into a scratch when it is not. */
  function fitSource(source: CanvasImageSource): CanvasImageSource {
    const sw = (source as { width?: number }).width ?? 0;
    const sh = (source as { height?: number }).height ?? 0;
    if (sw <= maxTextureSize && sh <= maxTextureSize) return source;
    const scale = maxTextureSize / Math.max(sw, sh);
    const dw = Math.max(1, Math.floor(sw * scale));
    const dh = Math.max(1, Math.floor(sh * scale));
    if (!fitScratch) fitScratch = makeCanvas(dw, dh);
    if (!fitScratch) return source;
    fitScratch.width = dw;
    fitScratch.height = dh;
    const sctx = fitScratch.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!sctx) return source;
    sctx.clearRect(0, 0, dw, dh);
    sctx.drawImage(source, 0, 0, dw, dh);
    return fitScratch as CanvasImageSource;
  }

  function upload(tex: WebGLTexture, source: CanvasImageSource): void {
    if (!gl) return;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // UNPACK_PREMULTIPLY_ALPHA_WEBGL is set at construction and never toggled.
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE,
      fitSource(source) as unknown as TexImageSource,
    );
  }

  return {
    canvas,
    maxTextureSize,

    uploadPlate(idx, source) {
      if (disposed || !gl) return null;
      const cached = plateTex.get(idx);
      if (cached && cached.source === source) return cached.tex;
      const tex = cached?.tex ?? makeTexture();
      if (!tex) return null;
      upload(tex, source);
      plateTex.set(idx, { tex, source });
      return tex;
    },

    setDofVariant(idx, source) {
      if (disposed || !gl) return null;
      const tex = frameTex.get(idx) ?? makeTexture();
      if (!tex) return null;
      upload(tex, source);
      frameTex.set(idx, tex);
      return tex;
    },

    beginFrame() {
      if (disposed || !gl) return;
      gl.clear(gl.COLOR_BUFFER_BIT);
    },

    drawQuad(d) {
      if (disposed || !gl) return;
      const { rect, S, item, platePad } = d;
      // The box-local extents the plate covers: the box, grown by the capture pad.
      const hx = rect.w / 2 + platePad;
      const hy = rect.h / 2 + platePad;
      gl.uniform2f(u.lo, -hx, -hy);
      gl.uniform2f(u.hi, hx, hy);
      gl.uniform1f(u.rot, item.rot * DEG2RAD);
      gl.uniform1f(u.scale, item.scale);
      gl.uniformMatrix3fv(u.m3, false, m3ColMajor(item.m3, item.dx, item.dy));
      gl.uniform2f(u.boxCentre, rect.x + rect.w / 2, rect.y + rect.h / 2);
      gl.uniform1f(u.S, S);
      gl.uniform1f(u.alpha, item.alpha < 0 ? 0 : item.alpha > 1 ? 1 : item.alpha);
      // First-cut: only source-over is honoured; any other mode composites the same.
      void isNormalBlend(item.blend);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, d.texture);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },

    readInto(ctx) {
      if (disposed) return;
      gl?.flush();
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(canvas as CanvasImageSource, 0, 0);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      if (!gl) return;
      try {
        for (const { tex } of plateTex.values()) gl.deleteTexture(tex);
        for (const tex of frameTex.values()) gl.deleteTexture(tex);
        plateTex.clear();
        frameTex.clear();
        gl.deleteBuffer(vbo);
        gl.deleteProgram(program);
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      } catch { /* context already gone */ }
      gl = null;
    },
  };
}
