// SPDX-License-Identifier: MPL-2.0
/**
 * hdr-canvas.ts - Tier A: a LIVE HDR canvas (plan 154 WP-5), for Chromium displays
 * that expose `configureHighDynamicRange`. Where the Tier B path encodes a cICP PNG
 * per change (correct, but static, and WebKit-only-necessary), a Chromium HDR display
 * can paint HDR straight from a float drawing buffer - no encode, live during a drag.
 *
 * This renders the exposed slice (extended-range LINEAR float RGBA from
 * hdr-image.ts#hdrExposedLinearRgba) into a WebGL2 `RGBA16F` drawing buffer with
 * `configureHighDynamicRange({mode:'extended'})`, so values above 1.0 land above SDR
 * white. The transfer encode is done in the shader and TOGGLED by {@link TIER_A_ENCODE},
 * because whether the float HDR buffer wants sRGB-encoded or linear values is the one
 * thing that needs a real HDR display to confirm (see the probe finding in plan 154).
 *
 * DELIBERATELY INERT until a display both exposes the API and reports HDR - every
 * environment tested so far lacks `configureHighDynamicRange`, so `hdrCanvasSupported()`
 * is false and nothing here runs. {@link TIER_A_ENABLED} is the one-line kill switch
 * for a fast rollback if a real display shows it rendering wrong; callers then fall
 * back to the Tier B image with no other change.
 */

/** Master kill switch. Set false to disable Tier A entirely (→ Tier B everywhere). */
export const TIER_A_ENABLED = true;
/** 1 = shader sRGB-encodes the extended value; 0 = linear passthrough. Flip this if
 *  the first real-display test shows the HDR canvas is too dark/bright (i.e. the
 *  float buffer wanted the other encoding). */
const TIER_A_ENCODE = 1;

/** Live-viz boost (plan 154 WP-4): how far a full-brightness pixel is pushed ABOVE SDR
 *  white on the extended-range buffer. 2.0 ≈ two stops of headroom for the brightest brand
 *  colours; mids and shadows stay where butterchurn put them.
 *  ponytail: tuning knob - the perceived glow needs a real HDR panel to set; adjust here. */
const HDR_BOOST_HEADROOM = 2.0;
/** Brightness (max channel, 0..1) where the boost starts ramping in. Below it a pixel
 *  passes through unchanged, so dark fields stay SDR and only the punchy bits glow. */
const HDR_BOOST_KNEE = 0.5;

let supportCache: boolean | undefined;

/** True when this browser can paint a live HDR canvas: the HDR API, WebGL2, and a
 *  float drawing buffer are all present. Cached; capability does not change per session. */
export function hdrCanvasSupported(): boolean {
  if (supportCache !== undefined) return supportCache;
  let ok = false;
  try {
    ok = TIER_A_ENABLED
      && typeof HTMLCanvasElement !== 'undefined'
      && 'configureHighDynamicRange' in HTMLCanvasElement.prototype
      && typeof WebGL2RenderingContext !== 'undefined';
    if (ok) {
      // Confirm a WebGL2 context with the float-drawing-buffer method actually grants.
      const probe = document.createElement('canvas').getContext('webgl2');
      ok = !!probe && typeof (probe as unknown as { drawingBufferStorage?: unknown }).drawingBufferStorage === 'function';
    }
  } catch { ok = false; }
  supportCache = ok;
  return ok;
}

interface GlState {
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  tex: WebGLTexture;
  uEncode: WebGLUniformLocation | null;
  w: number;
  h: number;
}
const STATE = new WeakMap<HTMLCanvasElement, GlState | null>(); // null = init failed, don't retry

const VERT = `#version 300 es
out vec2 uv;
void main() {
  vec2 p = vec2(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0);
  uv = (p + 1.0) * 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D tex;
uniform float uEncode;
out vec4 o;
float enc(float v){ float s = v < 0.0 ? -1.0 : 1.0; float a = abs(v);
  return s * (a <= 0.0031308 ? 12.92 * a : 1.055 * pow(a, 1.0/2.4) - 0.055); }
void main() {
  vec4 c = texture(tex, uv);
  o = vec4(uEncode > 0.5 ? vec3(enc(c.r), enc(c.g), enc(c.b)) : c.rgb, c.a);
}`;

/** WP-4 live-viz boost shader: sample the SDR source (butterchurn's [0,1] output) and
 *  scale bright pixels ABOVE 1.0 so they land above SDR white on the extended-range buffer.
 *  A per-pixel SCALAR gain preserves the R:G:B ratio (hue/chroma), only brightness grows -
 *  the same hue-preserving intent as the stills/export glow. */
const FRAG_BOOST = `#version 300 es
precision highp float;
in vec2 uv;
uniform sampler2D tex;
uniform float uHeadroom;
uniform float uKnee;
out vec4 o;
void main() {
  vec4 c = texture(tex, uv);
  float b = max(c.r, max(c.g, c.b));
  float t = clamp((b - uKnee) / max(1e-4, 1.0 - uKnee), 0.0, 1.0);
  float gain = 1.0 + (uHeadroom - 1.0) * t * t;
  o = vec4(c.rgb * gain, c.a);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error('HDR shader: ' + log);
  }
  return s;
}

function init(canvas: HTMLCanvasElement, colorSpace: 'srgb' | 'display-p3'): GlState | null {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false });
  if (!gl) return null;
  try {
    // Bleeding-edge surface: these members are not in the DOM lib types yet.
    (canvas as unknown as { configureHighDynamicRange(o: { mode: string }): void })
      .configureHighDynamicRange({ mode: 'extended' });
    (gl as unknown as { drawingBufferColorSpace: string }).drawingBufferColorSpace = colorSpace;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('HDR link: ' + gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // ImageData is top-down; flip to match
    gl.uniform1i(gl.getUniformLocation(prog, 'tex'), 0);
    return { gl, prog, tex, uEncode: gl.getUniformLocation(prog, 'uEncode'), w: 0, h: 0 };
  } catch (e) {
    console.warn('[color-lab] HDR canvas init failed, falling back to Tier B', (e as Error)?.message ?? e);
    return null;
  }
}

/**
 * Paint an exposed slice (extended-range LINEAR float RGBA from
 * `hdrExposedLinearRgba`) into `canvas` as a live HDR image. Returns false on any
 * failure so the caller can fall back to the Tier B image. `colorSpace` matches the
 * primaries the float values are in ('display-p3' for a P3 slice).
 */
export function paintHdrCanvas(
  canvas: HTMLCanvasElement,
  linearRgba: Float32Array,
  w: number,
  h: number,
  colorSpace: 'srgb' | 'display-p3',
): boolean {
  let st = STATE.get(canvas);
  if (st === undefined) { st = init(canvas, colorSpace); STATE.set(canvas, st); }
  if (!st) return false;
  const { gl, tex } = st;
  try {
    if (st.w !== w || st.h !== h) {
      canvas.width = w; canvas.height = h;
      (gl as unknown as { drawingBufferStorage(f: number, w: number, h: number): void })
        .drawingBufferStorage(gl.RGBA16F, w, h);
      gl.viewport(0, 0, w, h);
      st.w = w; st.h = h;
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // RGBA32F texel storage, straight from the float buffer; NEAREST, one texel per pixel.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, linearRgba);
    gl.useProgram(st.prog);
    if (st.uEncode) gl.uniform1f(st.uEncode, TIER_A_ENCODE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return true;
  } catch (e) {
    console.warn('[color-lab] HDR canvas paint failed, falling back to Tier B', (e as Error)?.message ?? e);
    STATE.set(canvas, null); // stop retrying on this canvas
    return false;
  }
}

/* ── WP-4: live-viz HDR boost ─────────────────────────────────────────────────
 * A separate program from the Colour-Lab slice paint above: it samples a SOURCE
 * CANVAS (butterchurn's own WebGL2 output, an [0,1] sRGB image) rather than a float
 * array, and boosts it. Keyed on the PRESENT canvas, which is only ever used by one
 * of the two paths, never both. */
interface BoostState {
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  tex: WebGLTexture;
  uHeadroom: WebGLUniformLocation | null;
  uKnee: WebGLUniformLocation | null;
  w: number;
  h: number;
}
const BOOST = new WeakMap<HTMLCanvasElement, BoostState | null>(); // null = init failed, don't retry

function initBoost(canvas: HTMLCanvasElement, colorSpace: 'srgb' | 'display-p3'): BoostState | null {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false, antialias: false });
  if (!gl) return null;
  try {
    (canvas as unknown as { configureHighDynamicRange(o: { mode: string }): void })
      .configureHighDynamicRange({ mode: 'extended' });
    (gl as unknown as { drawingBufferColorSpace: string }).drawingBufferColorSpace = colorSpace;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG_BOOST));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('HDR boost link: ' + gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); // canvas texel row 0 is the top; flip to screen orientation
    gl.uniform1i(gl.getUniformLocation(prog, 'tex'), 0);
    return { gl, prog, tex, uHeadroom: gl.getUniformLocation(prog, 'uHeadroom'), uKnee: gl.getUniformLocation(prog, 'uKnee'), w: 0, h: 0 };
  } catch (e) {
    console.warn('[viz] HDR boost init failed, staying SDR', (e as Error)?.message ?? e);
    return null;
  }
}

/**
 * Present butterchurn's SDR frame onto `present` as a live HDR image (plan 154 WP-4):
 * upload the `source` canvas (butterchurn's [0,1] sRGB output) as a texture and run the
 * hue-preserving boost so whites and bright brand colours land ABOVE 1.0 = above SDR white
 * on the extended-range RGBA16F buffer. Returns false on any failure so the caller can
 * leave the plain SDR canvas up. Only ever call when `hdrCanvasSupported()`; upload happens
 * the same tick butterchurn rendered, so its drawing buffer is still valid to read.
 */
export function boostHdrCanvas(
  present: HTMLCanvasElement,
  source: TexImageSource,
  w: number,
  h: number,
  colorSpace: 'srgb' | 'display-p3',
): boolean {
  let st = BOOST.get(present);
  if (st === undefined) { st = initBoost(present, colorSpace); BOOST.set(present, st); }
  if (!st) return false;
  const { gl, tex } = st;
  try {
    if (st.w !== w || st.h !== h) {
      present.width = w; present.height = h;
      (gl as unknown as { drawingBufferStorage(f: number, w: number, h: number): void })
        .drawingBufferStorage(gl.RGBA16F, w, h);
      gl.viewport(0, 0, w, h);
      st.w = w; st.h = h;
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.useProgram(st.prog);
    if (st.uHeadroom) gl.uniform1f(st.uHeadroom, HDR_BOOST_HEADROOM);
    if (st.uKnee) gl.uniform1f(st.uKnee, HDR_BOOST_KNEE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return true;
  } catch (e) {
    console.warn('[viz] HDR boost paint failed, staying SDR', (e as Error)?.message ?? e);
    BOOST.set(present, null); // stop retrying on this canvas
    return false;
  }
}

/** Release a canvas's HDR context (on teardown), so the GPU resource is not held. Covers
 *  both the Colour-Lab slice paint and the WP-4 live-viz boost - a given canvas is only in
 *  one of the two maps, so the other lookup is a harmless miss. */
export function releaseHdrCanvas(canvas: HTMLCanvasElement): void {
  const a = STATE.get(canvas);
  STATE.delete(canvas);
  if (a) { try { a.gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* ignore */ } }
  const b = BOOST.get(canvas);
  BOOST.delete(canvas);
  if (b) { try { b.gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* ignore */ } }
}
