// SPDX-License-Identifier: MPL-2.0
/**
 * Pointer glass loupe - a WebGL magnifier for the catalog details-modal zoom stage. It turns on
 * AUTOMATICALLY the moment a pixel-peeper switches the stage to pixel-accurate (nearest-neighbour)
 * viewing - no button - so on top of the stage's own up-to-2000% zoom a big round glass lens
 * follows the cursor and magnifies further, with a gentle barrel refraction and a slight chromatic
 * fringe (the tympanus.net "square lens" effect, minus the grain/drift/movement - so there is NO
 * persistent rAF; it renders only on pointermove). Sampling is always crisp/NEAREST, because it
 * only ever runs in pixel-accurate mode and must match the stage's own pixels exactly.
 *
 * Deliberately NOT three.js: this is one textured quad + one fragment shader. Raw WebGL1,
 * modelled on lib/wobble-mesh.ts (single capability-gated context, mount/render/dispose, forced
 * loseContext on teardown). It owns a small canvas absolutely positioned in the stage with
 * pointer-events:none, so it never intercepts the stage's own wheel/drag.
 *
 * Cost to the rest of the app: nothing when not mounted (this module is lazy-imported only when a
 * peeper flips pixel-accurate on), and while mounted it is one small context + a trivial shader
 * drawn on pointermove, inside a showModal() dialog that makes everything behind it inert. The
 * texture is captured ONCE from the stage's <img> (re-captured only when the zoom changes) - never
 * per frame. If that <img> is a tainted cross-origin source the capture throws and mount() returns
 * null, so the caller falls back to plain zoom.
 *
 * ponytail: one texture capped at 4096px/side. At the very deepest loupe magnification of a
 * VECTOR asset it softens (a single raster can't hold 2000%×mag of crisp vector); raster assets
 * stay pixel-exact up to 4096 native px, which is the pixel-peeper case. Upgrade path if it ever
 * matters: re-rasterise just the lens window per move. Not worth it today.
 */

/** Extra magnification the lens applies ON TOP of the stage's current on-screen zoom. */
export const LOUPE_MAG = 2.5;
const MAX_TEX = 4096;

/**
 * Map a cursor offset (from the stage centre, as `attachZoom`'s `offsetFrom` returns) to the
 * texture UV under it, given the media's on-screen size (W,H px = base×scale) and pan (tx,ty).
 * The media sits centred at stage-centre+(tx,ty), so its top-left is (tx-W/2, ty-H/2) and the
 * cursor's fraction across it is ((ox - (tx-W/2))/W, (oy - (ty-H/2))/H). Pure - unit-tested.
 * Returns null when the cursor is off the art (any component outside 0..1).
 */
export function offsetToUv(ox: number, oy: number, W: number, H: number, tx: number, ty: number): [number, number] | null {
  if (W <= 0 || H <= 0) return null;
  const u = (ox + W / 2 - tx) / W;
  const v = (oy + H / 2 - ty) / H;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;
  return [u, v];
}

/** Half the lens window as a UV fraction, per axis: (size/MAG) screen px over the media's px. */
export function halfWindow(W: number, H: number, sizePx: number): [number, number] {
  const px = sizePx / LOUPE_MAG / 2;
  return [px / W, px / H];
}

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;      // clip -1..1 -> 0..1
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_center;   // UV under the cursor
uniform vec2 u_half;     // half lens window, UV, per axis
uniform float u_lens;    // barrel strength
uniform float u_ca;      // chromatic offset (fraction of the window)
void main() {
  vec2 p = v_uv * 2.0 - 1.0;         // -1..1 lens space
  float r = length(p);
  float mask = smoothstep(1.0, 0.93, r);   // soft round edge
  if (mask <= 0.0) discard;
  p.y = -p.y;                        // screen-up ⇒ image-up: u_center.v is top-origin, texture isn't flipped
  vec2 warp = p * (1.0 + u_lens * r * r);  // convex glass: rim bends outward
  vec2 base = u_center + warp * u_half;
  vec2 dir = r > 1e-4 ? p / r : vec2(0.0);
  vec2 ca = dir * u_ca * r * u_half;       // radial RGB split, grows to the rim
  float cr = texture2D(u_tex, base + ca).r;
  float cg = texture2D(u_tex, base).g;
  float cb = texture2D(u_tex, base - ca).b;
  vec3 col = vec3(cr, cg, cb);
  col += smoothstep(0.8, 1.0, r) * 0.12;   // faint rim highlight = glass
  gl_FragColor = vec4(col, mask);
}`;

export interface Loupe {
  /** The lens diameter in CSS px (square canvas). */
  readonly size: number;
  /** Position the lens (stage-local px for its top-left) and draw the window at (cu,cv). */
  render(leftPx: number, topPx: number, cu: number, cv: number, halfU: number, halfV: number): void;
  /** Re-capture the texture from the source <img> (call after the stage zoom changes). */
  refresh(): void;
  hide(): void;
  dispose(): void;
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { gl.deleteShader(sh); return null; }
  return sh;
}

/**
 * Create the loupe over `stage`, capturing `img` (the stage's .cat-thumb). `getSize` returns the
 * media's current on-screen [W,H] px so a vector is captured crisply at the live zoom; `sizePx` is
 * the lens diameter. Returns null if WebGL is unavailable or the source image is a tainted
 * cross-origin texture.
 */
export function mountLoupe(
  stage: HTMLElement,
  img: HTMLImageElement,
  getSize: () => [number, number],
  sizePx: number,
): Loupe | null {
  const dpr = Math.min(2, typeof devicePixelRatio === 'number' ? devicePixelRatio : 1);
  const canvas = document.createElement('canvas');
  canvas.className = 'cat-loupe';
  canvas.width = Math.round(sizePx * dpr);
  canvas.height = Math.round(sizePx * dpr);
  canvas.style.width = `${sizePx}px`;
  canvas.style.height = `${sizePx}px`;

  const gl = (canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true })
    || canvas.getContext('experimental-webgl', { premultipliedAlpha: false, alpha: true })) as WebGLRenderingContext | null;
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uTex = gl.getUniformLocation(prog, 'u_tex');
  const uCenter = gl.getUniformLocation(prog, 'u_center');
  const uHalf = gl.getUniformLocation(prog, 'u_half');
  const uLens = gl.getUniformLocation(prog, 'u_lens');
  const uCa = gl.getUniformLocation(prog, 'u_ca');

  const tex = gl.createTexture();
  const maxTex = Math.min(MAX_TEX, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
  const scratch = document.createElement('canvas');
  let lost = false;

  const onLost = (e: Event): void => { e.preventDefault(); lost = true; };
  canvas.addEventListener('webglcontextlost', onLost, false);

  // Capture the stage's media into a texture. Crisp for SVG (drawImage rasterises the vector at
  // the target size), pixel-exact for raster (smoothing off ⇒ native pixels). Always NEAREST -
  // the loupe only runs in pixel-accurate mode, so its pixels must match the stage's. Cross-origin
  // taint makes texImage2D throw ⇒ we surface it as capture failure so the caller drops the loupe.
  const capture = (): boolean => {
    if (lost) return false;
    const [W, H] = getSize();
    const isSvg = /\.svg(\?|#|$)/i.test(img.currentSrc || img.src || '');
    const natW = img.naturalWidth || 0, natH = img.naturalHeight || 0;
    let tw: number, th: number;
    if (isSvg || !natW) { tw = Math.min(maxTex, Math.max(1, Math.round(W))); th = Math.min(maxTex, Math.max(1, Math.round(H))); }
    else { tw = Math.min(maxTex, natW); th = Math.min(maxTex, natH); }
    scratch.width = tw; scratch.height = th;
    const c2d = scratch.getContext('2d');
    if (!c2d) return false;
    c2d.imageSmoothingEnabled = false;
    try { c2d.drawImage(img, 0, 0, tw, th); } catch { return false; }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    // No UNPACK_FLIP_Y: the source is stored upright (row 0 = top), so texcoord.t maps directly to
    // the top-origin v we compute. The shader negates p.y instead, which stays correct off-centre.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scratch); }
    catch { return false; }   // tainted canvas
    return true;
  };

  if (!capture()) {
    canvas.removeEventListener('webglcontextlost', onLost, false);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return null;
  }
  stage.appendChild(canvas);

  const render = (leftPx: number, topPx: number, cu: number, cv: number, halfU: number, halfV: number): void => {
    if (lost) return;
    canvas.style.display = 'block';
    canvas.style.transform = `translate(${Math.round(leftPx)}px, ${Math.round(topPx)}px)`;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1i(uTex, 0);
    gl.uniform2f(uCenter, cu, cv);
    gl.uniform2f(uHalf, halfU, halfV);
    gl.uniform1f(uLens, 0.18);
    gl.uniform1f(uCa, 0.06);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  return {
    size: sizePx,
    render,
    refresh: () => { capture(); },
    hide: () => { canvas.style.display = 'none'; },
    dispose: () => {
      canvas.removeEventListener('webglcontextlost', onLost, false);
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    },
  };
}
