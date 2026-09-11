// SPDX-License-Identifier: MPL-2.0
/**
 * Wobbly windows - the MESH tier (WOBBLY_MESH_FLAG). The real compiz billow: a snapshot
 * of the dragged panel is warped as a textured spring mesh on the GPU, so the surface
 * genuinely CURVES (the affine skew tier can only shear). Opt-in and capability-gated -
 * Chromium/Blink + WebGL - and it degrades to the affine wobble (lib/wobble.ts) anywhere
 * it cannot run, so nobody without the hardware is worse off.
 *
 * How it works, per gesture:
 *   grab   -> snapshot the panel to a texture (dom-to-image-more .toCanvas, un-tainted
 *             same-origin foreignObject), size the shared overlay canvas to the viewport,
 *             seed a vertex grid over the panel's rect, and once the texture is ready hide
 *             the real panel (opacity:0, so its captured pointer drag keeps working) and
 *             show the warped mesh.
 *   drag   -> the frame translates with the drag; each vertex lags by its distance from
 *             the grab point, and a membrane (neighbour-smoothing) spring propagates that
 *             as a smooth wave - a coherent curve, never the turbulence crinkle.
 *   settle -> the mesh rings down flat at the panel's final position, then the real panel
 *             is shown again and the overlay hidden. No jump, because the mesh's flat state
 *             renders the panel exactly where its own drag code left it.
 *
 * Chrome only, transient, and it warps a SNAPSHOT - it never touches the tool canvas or an
 * export. One shared GL context + overlay is reused across gestures; only one runs at once.
 */

import { isFlagOnSync, WOBBLY_FLAG, WOBBLY_MESH_FLAG } from '../feature-flags.ts';

// Grid + spring tunables. GRID = cells per side (so (GRID+1)^2 vertices). K_MESH is the
// membrane (neighbour-averaging) spring that keeps the warp smooth and propagates the wave;
// K_HOME pulls each vertex back to flat; DAMP is friction. LAG scales the per-drag lag kick.
const M = {
  GRID: 10,
  K_MESH: 180,
  K_HOME: 120,
  DAMP: 20,
  LAG: 1,
  DT_MAX: 0.025,    // small enough that the explicit membrane integration stays stable
  SETTLE_O: 0.4,    // px offset
  SETTLE_V: 0.6,
  MAX_OFF: 600,     // hard clamp so a numerical blip can never explode the mesh
  MAX_VEL: 8000,
  MAX_FRAMES: 900,  // ~15s safety: force a restore if a gesture never settles
  SNAP_MS: 700,     // abandon the mesh (drag without a wobble) if the snapshot is too slow
  PAD: 56,          // px captured beyond the panel box so its drop shadow rides in the texture
};

let blink: boolean | null = null;
let webglOk: boolean | null = null;

function isBlink(): boolean {
  if (blink === null) {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    blink = /Chrome\/\d/i.test(ua) && !/(iPhone|iPad|iPod)/i.test(ua);
  }
  return blink;
}
function hasWebGL(): boolean {
  if (webglOk === null) {
    try {
      const c = document.createElement('canvas');
      webglOk = !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
    } catch { webglOk = false; }
  }
  return webglOk;
}

/** Capability only (Blink + WebGL) - the flags are checked by meshWobbleActive(). */
export function meshWobbleCapable(): boolean {
  return typeof document !== 'undefined' && isBlink() && hasWebGL();
}

/** Both flags on AND capable. attachWobble uses this to pick the mesh path over the skew. */
export function meshWobbleActive(): boolean {
  return isFlagOnSync(WOBBLY_FLAG) && isFlagOnSync(WOBBLY_MESH_FLAG) && meshWobbleCapable();
}

// ── shared GL overlay (created once, reused) ─────────────────────────────────────
interface Gl {
  canvas: HTMLCanvasElement;
  ctx: WebGLRenderingContext;
  prog: WebGLProgram;
  loc: { pos: number; uv: number; res: WebGLUniformLocation; tex: WebGLUniformLocation };
  posBuf: WebGLBuffer;
  uvBuf: WebGLBuffer;
  idxBuf: WebGLBuffer;
  tex: WebGLTexture;
  idxCount: number;
}
let GL: Gl | null = null;

/** Symmetric clamp to +/-lim, so a numerical blow-up can never leave finite bounds. */
function cl(v: number, lim: number): number { return v < -lim ? -lim : v > lim ? lim : v; }

// The computed properties worth inlining for a transient wobble snapshot. Reading a CURATED
// set (not iterating all ~350 per node) is what keeps the SYNCHRONOUS capture under a frame,
// so it does not hitch the drag - the earlier full/diff versions read every property, which
// was the delay. Fonts are not embedded (the slow part): text falls back to a system face,
// imperceptible mid-billow. External/cross-origin images render blank, also fine.
const SNAP_PROPS: readonly string[] = [
  'box-sizing', 'display', 'position', 'flex-direction', 'flex-wrap', 'flex-grow', 'flex-shrink',
  'flex-basis', 'align-items', 'align-self', 'align-content', 'justify-content', 'justify-items', 'justify-self',
  'gap', 'order', 'grid-template-columns', 'grid-template-rows', 'grid-auto-flow', 'grid-auto-rows',
  'grid-column', 'grid-row', 'aspect-ratio', 'float', 'clear', 'object-fit', 'object-position',
  '-webkit-line-clamp', '-webkit-box-orient',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'top', 'left', 'right', 'bottom',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
  'background-color', 'background-image', 'background-size', 'background-position', 'background-repeat',
  'background-clip', '-webkit-background-clip', 'background-origin',
  'box-shadow', 'opacity', 'overflow', 'overflow-x', 'overflow-y', 'filter', 'clip-path', 'mix-blend-mode',
  'color', '-webkit-text-fill-color', 'font-family', 'font-size', 'font-weight', 'font-style',
  'line-height', 'letter-spacing', 'text-align', 'text-transform', 'text-decoration-line',
  'text-decoration-color', 'text-shadow', 'white-space', 'text-overflow', 'vertical-align',
  'transform', 'transform-origin', 'fill', 'stroke', 'stroke-width', 'visibility',
];

/** Copy the curated computed styles from a live subtree onto its clone, so the clone renders
 *  correctly inside an isolated foreignObject (page stylesheets do not reach there). */
function inlineComputedStyles(src: Element, dst: Element): void {
  const cs = getComputedStyle(src);
  let css = '';
  for (const p of SNAP_PROPS) { const v = cs.getPropertyValue(p); if (v) css += `${p}:${v};`; }
  (dst as HTMLElement).style.cssText = css;
  const sc = src.children, dc = dst.children;
  for (let i = 0; i < sc.length && i < dc.length; i++) inlineComputedStyles(sc[i]!, dc[i]!);
}

/**
 * Snapshot a live panel to a same-origin (un-tainted) SVG image usable as a WebGL texture.
 * foreignObject-based, minus font embedding, so it is fast and cannot hang the main thread.
 * External/cross-origin images inside the panel render blank (fine for a transient wobble).
 */
export async function captureToImage(el: HTMLElement, w: number, h: number, dpr: number, pad = 0): Promise<HTMLImageElement> {
  const pw = w + 2 * pad, ph = h + 2 * pad;
  const clone = el.cloneNode(true) as HTMLElement;
  // A <details> renders only its <summary> unless open; force any in the clone open so the
  // collapsible bodies (e.g. a panel's expandable sections) appear in the snapshot.
  if (clone.tagName === 'DETAILS') (clone as HTMLDetailsElement).open = true;
  for (const d of clone.querySelectorAll('details')) (d as HTMLDetailsElement).open = true;
  inlineComputedStyles(el, clone);
  // Neutralise the panel's own positioning and sit it at (pad,pad) in the padded holder, so
  // its drop shadow has room around it inside the foreignObject.
  clone.style.position = 'absolute';
  clone.style.left = `${pad}px`;
  clone.style.top = `${pad}px`;
  clone.style.right = clone.style.bottom = 'auto';
  clone.style.margin = '0';
  clone.style.transform = 'none';
  clone.style.width = `${w}px`;
  clone.style.height = `${h}px`;
  const holder = document.createElement('div');
  holder.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  holder.style.cssText = `position:relative;width:${pw}px;height:${ph}px;overflow:hidden`;
  holder.appendChild(clone);
  const html = new XMLSerializer().serializeToString(holder);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(pw * dpr)}" height="${Math.round(ph * dpr)}" viewBox="0 0 ${pw} ${ph}">` +
    `<foreignObject x="0" y="0" width="${pw}" height="${ph}">${html}</foreignObject></svg>`;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  return img;
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn('wobble-mesh: shader compile failed', gl.getShaderInfoLog(s));
  }
  return s;
}

function ensureGl(): Gl | null {
  if (GL) return GL;
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '2147483000', display: 'none',
  } as CSSStyleDeclaration);
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = (canvas.getContext('webgl', { premultipliedAlpha: true, antialias: true, depth: false, stencil: false })
    || canvas.getContext('experimental-webgl', { premultipliedAlpha: true })) as WebGLRenderingContext | null;
  if (!ctx) return null;
  const prog = ctx.createProgram()!;
  ctx.attachShader(prog, compile(ctx, ctx.VERTEX_SHADER, `
    attribute vec2 a_pos; attribute vec2 a_uv; uniform vec2 u_res; varying vec2 v_uv;
    void main() { vec2 c = a_pos / u_res * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); v_uv = a_uv; }`));
  ctx.attachShader(prog, compile(ctx, ctx.FRAGMENT_SHADER, `
    precision mediump float; uniform sampler2D u_tex; varying vec2 v_uv;
    void main() { gl_FragColor = texture2D(u_tex, v_uv); }`));
  ctx.linkProgram(prog);
  if (!ctx.getProgramParameter(prog, ctx.LINK_STATUS)) {
    console.warn('wobble-mesh: link failed', ctx.getProgramInfoLog(prog));
    return null;
  }
  ctx.useProgram(prog);
  ctx.enable(ctx.BLEND);
  ctx.blendFunc(ctx.ONE, ctx.ONE_MINUS_SRC_ALPHA);   // premultiplied source-over: clean edges
  const tex = ctx.createTexture()!;
  ctx.bindTexture(ctx.TEXTURE_2D, tex);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.LINEAR);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);

  document.body.appendChild(canvas);
  GL = {
    canvas, ctx, prog,
    loc: {
      pos: ctx.getAttribLocation(prog, 'a_pos'),
      uv: ctx.getAttribLocation(prog, 'a_uv'),
      res: ctx.getUniformLocation(prog, 'u_res')!,
      tex: ctx.getUniformLocation(prog, 'u_tex')!,
    },
    posBuf: ctx.createBuffer()!, uvBuf: ctx.createBuffer()!, idxBuf: ctx.createBuffer()!,
    tex, idxCount: 0,
  };
  return GL;
}

// ── one gesture ──────────────────────────────────────────────────────────────────
export interface MeshSession {
  drag(dx: number, dy: number): void;
  release(): void;
  dispose(): void;
}

let active: MeshSession | null = null;

/**
 * Begin a mesh wobble for `el` grabbed at (clientX, clientY). Returns a session, or null
 * if not active/capable so the caller falls back to the affine wobble. Cancels any prior
 * session (only one panel wobbles at a time).
 */
export function startMeshWobble(
  el: HTMLElement,
  clientX: number,
  clientY: number,
  opts: { onReady?: () => void } = {},
): MeshSession | null {
  if (!meshWobbleActive()) return null;
  const gl = ensureGl();
  if (!gl) return null;
  active?.dispose();

  const N = M.GRID + 1;
  const PAD = M.PAD;
  const rect = el.getBoundingClientRect();
  const w = rect.width, h = rect.height;
  if (w < 1 || h < 1) return null;
  // Capture + mesh a region padded on all sides, so the panel's drop shadow (drawn OUTSIDE
  // its box) sits inside the texture and warps with it. The mesh origin and grid span the
  // padded rect; the panel content lives at (PAD,PAD) within it.
  const pw = w + 2 * PAD, ph = h + 2 * PAD;
  const originLeft = rect.left - PAD, originTop = rect.top - PAD;         // padded-region top-left, viewport px
  const grabX = (clientX - rect.left) + PAD, grabY = (clientY - rect.top) + PAD;   // grab in padded-local px
  const diag = Math.hypot(pw, ph) || 1;

  // Per-vertex state (flat arrays). rest = grid cell in panel-local px; off = current offset
  // from home (home = rest + totalDrag); vel = its velocity; lag = how much this vertex
  // trails the drag (0 at the grab point, ~1 at the far corner).
  const restX = new Float32Array(N * N), restY = new Float32Array(N * N);
  const offX = new Float32Array(N * N), offY = new Float32Array(N * N);
  const velX = new Float32Array(N * N), velY = new Float32Array(N * N);
  const lag = new Float32Array(N * N);
  const uv = new Float32Array(N * N * 2);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      restX[k] = (i / M.GRID) * pw;
      restY[k] = (j / M.GRID) * ph;
      lag[k] = Math.min(1, Math.hypot(restX[k] - grabX, restY[k] - grabY) / diag);
      uv[k * 2] = i / M.GRID;
      uv[k * 2 + 1] = 1 - j / M.GRID;   // FLIP_Y on upload, so v=1 is the top row
    }
  }
  // Triangle indices (two per cell), built once.
  const idx: number[] = [];
  for (let j = 0; j < M.GRID; j++) {
    for (let i = 0; i < M.GRID; i++) {
      const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }

  let totalDX = 0, totalDY = 0;
  let dragging = true;
  let ready = false, disposed = false, rafId = 0, lastT = 0, frames = 0;
  const posArr = new Float32Array(N * N * 2);

  el.style.willChange = 'opacity';

  // Snapshot -> texture (async). el is left visible until the texture arrives, so the panel
  // drags normally in the meantime and the handoff has no blank frame. We deliberately do
  // NOT use dom-to-image here: its @font-face embedding (fetch + base64 every app font)
  // synchronously blocks the main thread on this font-heavy app. captureToImage inlines the
  // small panel subtree's computed styles into a foreignObject and skips fonts entirely; the
  // text falls back to a system face for the ~0.5s wobble, which is imperceptible mid-billow.
  (async () => {
    // Yield first, so grab() returns and the affine wobble paints its first frame BEFORE the
    // snapshot's synchronous work runs. Otherwise the capture (clone + style read + serialise)
    // executes inside grab and blocks that first frame - which was the "delay before it moves".
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    if (disposed) return;
    try {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const img = await Promise.race([
        captureToImage(el, w, h, dpr, PAD),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('snapshot timeout')), M.SNAP_MS)),
      ]);
      if (disposed) return;
      const g = gl.ctx;
      g.bindTexture(g.TEXTURE_2D, gl.tex);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
      g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img);
      g.bindBuffer(g.ARRAY_BUFFER, gl.uvBuf);
      g.bufferData(g.ARRAY_BUFFER, uv, g.STATIC_DRAW);
      g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, gl.idxBuf);
      g.bufferData(g.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), g.STATIC_DRAW);
      gl.idxCount = idx.length;
      ready = true;
      el.style.opacity = '0';   // hide the real panel; its captured pointer drag keeps working
      showCanvas();
      wake();
      opts.onReady?.();          // tell the caller the mesh has taken over (stop the affine bridge)
    } catch (err) {
      // Snapshot failed (e.g. a tainting cross-origin image): abandon the mesh for this
      // gesture. The panel just drags without a wobble; not worth a fallback dance.
      console.warn('wobble-mesh: snapshot failed, no wobble this drag', err);
      dispose();
    }
  })();

  function showCanvas(): void {
    gl!.canvas.width = window.innerWidth;
    gl!.canvas.height = window.innerHeight;
    gl!.canvas.style.display = 'block';
    gl!.ctx.viewport(0, 0, gl!.canvas.width, gl!.canvas.height);
  }

  function neighbourAvg(k: number, i: number, j: number, arr: Float32Array): number {
    let sum = 0, n = 0;
    if (i > 0) { sum += arr[k - 1]!; n++; }
    if (i < N - 1) { sum += arr[k + 1]!; n++; }
    if (j > 0) { sum += arr[k - N]!; n++; }
    if (j < N - 1) { sum += arr[k + N]!; n++; }
    return n ? sum / n : 0;
  }

  function step(t: number): void {
    rafId = 0;
    if (disposed) return;
    if (++frames > M.MAX_FRAMES) { restore(); return; }   // hard safety net
    const dt = lastT ? Math.min(M.DT_MAX, (t - lastT) / 1000) : 1 / 60;
    lastT = t;
    let maxE = 0;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        const mx = neighbourAvg(k, i, j, offX) - offX[k]!;
        const my = neighbourAvg(k, i, j, offY) - offY[k]!;
        velX[k] = cl(velX[k]! + (M.K_MESH * mx - M.K_HOME * offX[k]! - M.DAMP * velX[k]!) * dt, M.MAX_VEL);
        velY[k] = cl(velY[k]! + (M.K_MESH * my - M.K_HOME * offY[k]! - M.DAMP * velY[k]!) * dt, M.MAX_VEL);
      }
    }
    for (let k = 0; k < N * N; k++) {
      offX[k] = cl(offX[k]! + velX[k]! * dt, M.MAX_OFF);
      offY[k] = cl(offY[k]! + velY[k]! * dt, M.MAX_OFF);
      const e = Math.abs(offX[k]!) + Math.abs(offY[k]!) + Math.abs(velX[k]!) + Math.abs(velY[k]!);
      if (e > maxE) maxE = e;
    }
    if (!Number.isFinite(maxE)) { restore(); return; }   // never loop on a NaN blow-up
    render();
    if (!dragging && maxE < M.SETTLE_O + M.SETTLE_V) { restore(); return; }
    rafId = raf(step);
  }

  function render(): void {
    const gg = gl!.ctx;
    for (let k = 0; k < N * N; k++) {
      posArr[k * 2] = originLeft + totalDX + restX[k]! + offX[k]!;
      posArr[k * 2 + 1] = originTop + totalDY + restY[k]! + offY[k]!;
    }
    gg.clear(gg.COLOR_BUFFER_BIT);
    gg.useProgram(gl!.prog);
    gg.uniform2f(gl!.loc.res, gl!.canvas.width, gl!.canvas.height);
    gg.uniform1i(gl!.loc.tex, 0);
    gg.activeTexture(gg.TEXTURE0);
    gg.bindTexture(gg.TEXTURE_2D, gl!.tex);
    gg.bindBuffer(gg.ARRAY_BUFFER, gl!.posBuf);
    gg.bufferData(gg.ARRAY_BUFFER, posArr, gg.DYNAMIC_DRAW);
    gg.enableVertexAttribArray(gl!.loc.pos);
    gg.vertexAttribPointer(gl!.loc.pos, 2, gg.FLOAT, false, 0, 0);
    gg.bindBuffer(gg.ARRAY_BUFFER, gl!.uvBuf);
    gg.enableVertexAttribArray(gl!.loc.uv);
    gg.vertexAttribPointer(gl!.loc.uv, 2, gg.FLOAT, false, 0, 0);
    gg.bindBuffer(gg.ELEMENT_ARRAY_BUFFER, gl!.idxBuf);
    gg.drawElements(gg.TRIANGLES, gl!.idxCount, gg.UNSIGNED_SHORT, 0);
  }

  function raf(cb: FrameRequestCallback): number { return requestAnimationFrame(cb); }
  function wake(): void { if (ready && !rafId && !disposed) { lastT = 0; rafId = raf(step); } }

  function restore(): void {
    el.style.opacity = '';
    el.style.willChange = '';
    if (GL) GL.canvas.style.display = 'none';
    cleanup();
  }
  function cleanup(): void {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0; disposed = true;
    if (active === session) active = null;
  }
  function dispose(): void {
    if (disposed) { return; }
    el.style.opacity = '';
    el.style.willChange = '';
    if (GL && ready) GL.canvas.style.display = 'none';
    cleanup();
  }

  const session: MeshSession = {
    drag(dx: number, dy: number): void {
      if (disposed) return;
      totalDX += dx; totalDY += dy;
      // Each vertex lags the frame's move by its distance from the grab point; the membrane
      // spring then smooths that into a coherent trailing curve.
      for (let k = 0; k < N * N; k++) {
        offX[k]! -= dx * lag[k]! * M.LAG;
        offY[k]! -= dy * lag[k]! * M.LAG;
      }
      wake();
    },
    release(): void {
      if (disposed) return;
      dragging = false;
      wake();
    },
    dispose,
  };
  active = session;
  return session;
}
