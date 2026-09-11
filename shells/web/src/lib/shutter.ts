// SPDX-License-Identifier: MPL-2.0
/* Export shutter - a candy-swirl lollipop iris that closes over the stage while
   the brief full-res resize during export (the "shake") happens, then opens
   again. Replaces the 14-blade camera iris that lived here before (kept in git
   history); that in turn replaced six skewed CSS flaps.

   WHY A SWIRL. It's the most on-brand cover we can paint: a lollipop swirl reads
   as "Lolly" instantly. Its palette follows BOTH the theme and the brand: ambient
   brightness tracks the theme background so light themes brighten the swirl and
   dark themes deepen it, and the coloured stripe leans toward the live brand accent
   in EVERY theme (light / dark / the mid-toned 'brand' theme) so the swirl wears the
   brand rather than a fixed green - the 'brand' theme just pushes that colour
   hardest. A near-neutral brand falls back to Lolly green. See toneForTheme().

   HOW IT COVERS. The swirl is drawn in a fragment shader normalised by
   min(resolution), so it is ALWAYS a circle regardless of stage aspect. Coverage
   grows from the outside in - at any progress every pixel at radius r is covered
   at least as much as the aperture edge, so the corners are covered throughout
   and at full close alpha is 1 everywhere. That is what lets it be an export
   cover. A seal plate behind it (hsl(var(--background))) fades in over the last
   sliver as belt-and-braces, and carries the whole close on its own if WebGL is
   unavailable - so the "hide the stage during the resize" contract holds even
   without a GPU.

   THE MARK. At ~70% of the close the Lolly mark pops out on top of the swirl,
   sized to 28% of the stage's smaller dimension. It is STACKED LAYER DIVS
   (lib/shutter-mark.ts, GENERATED from the repo-root icon.svg by
   scripts/gen-shutter-mark.ts) whose three spinning slices turn with a slow hue
   drift (animation in styles/parts/tool.css, on the DIVS so the spin composites
   off-thread and survives the export's main-thread stall); its coloured spiral is painted the SAME brand tone the iris
   stripe uses (--exsh-swirl ← tone.green), so mark and iris agree. Small + brief + over
   the seal, so the spin/hue costs nothing measurable even mid-export - unlike a filter on
   the full-screen iris, which is why THAT stays a shader with no CSS filter.

   PERFORMANCE. This runs during export on phones. The shader is one full-screen
   triangle pair per frame; DPR is capped (1.5 phone / 2 desktop). No CSS filter
   on the iris canvas - the shader's own lighting is the depth cue.

   THE STATUS BLOCK. A sealed shutter used to be the whole story of a long export:
   at <=640px it goes fullscreen, so a multi-minute video encode left a phone with
   an opaque plate, no progress and no way back. Any export that outlasts
   STATUS_DELAY now grows a status block over the plate - what is exporting, how
   far in, how long it has been running, and one button out: Cancel when the caller
   passed an onCancel (its export takes an abort signal), Hide otherwise. The delay
   is the whole reason a sub-second still export still looks exactly as it did. */

import { playSfx } from './sfx.ts';
import { t } from '../i18n.ts';
import { prefersReducedMotion } from './a11y-prefs.ts';
import { liveAccentHint } from './viz-palette.ts';
import { currentTheme } from '../theme.ts';
import { SHUTTER_MARK_LAYERS } from './shutter-mark.ts';

/** What the status block says, and what its one button does. */
export interface ShutterStatus {
  /** Headline - what is being exported (the tool name). */
  label: string;
  /** Second line prefix, e.g. the format. Percent and elapsed time follow it. */
  detail?: string;
  /**
   * The escape hatch when the export cannot be stopped: the button is labelled
   * Hide and this is expected to OPEN the shutter and let the export finish
   * underneath. Used whenever `onCancel` is absent.
   */
  onHide: () => void;
  /**
   * Real cancellation, when the caller has an abort signal in the export opts
   * (engine 1.141): the button reads Cancel and this aborts. It does NOT open the
   * shutter - the export rejects and its own `finally` restores the view - so the
   * two are never both wired to the same click.
   */
  onCancel?: () => void;
}

export interface Shutter {
  /** Close the iris. Resolves once it is fully sealed. Pass a status to give a
   *  slow export a visible progress block + escape hatch over the seal plate. */
  close(status?: ShutterStatus | null): Promise<void>;
  /** Open it again. Fire-and-forget. */
  open(): void;
  /** Close then open - for callers that can't await (clipboard writes). */
  play(): void;
  /** Feed the status block real progress. `total <= 0` keeps it elapsed-only. */
  progress(done: number, total: number): void;
  destroy(): void;
}

/* ── the tuned look ──────────────────────────────────────────────────────── */
const DURATION  = 375;     // ms for one direction (parity with the old iris)
const GAMMA     = 0.7;     // shapes raw progress → swirl closure (front-loaded)
const MARK_FRAC = 0.28;    // mark size as a fraction of the stage's SMALLER side (raised from
                           // 0.18 once the mark became the quality vector icon)
const POP_LO    = 0.6;     // close-progress where the mark starts to appear …
const POP_HI    = 0.8;     // … and where it has fully popped
const SEAL_LO   = 0.82;    // WebGL path: plate insurance only over the last sliver
const LOLLY_GREEN = '#11734b';   // identity green for near-neutral brands
/** How long an export must run before the status block appears. Exported so the
 *  test can pin it rather than sleeping for it (the HOOK_BUDGET_MS pattern). */
export const STATUS_DELAY = { ms: 600 };
/** Separator between the status block's meta parts (format / percent / clock). */
const META_SEP = ' · ';

/** Elapsed milliseconds as `m:ss` (an hour-long export just keeps counting minutes). */
export function clockText(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/* ── the swirl shader ────────────────────────────────────────────────────── */
const VERT = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

// The precision line is prepended at compile time (highp where supported).
const FRAG_BODY = `
uniform vec2 u_resolution;
uniform float u_progress;
uniform vec3 u_color;
uniform vec3 u_cream;
uniform vec3 u_ambLo;
uniform vec3 u_ambHi;
uniform float u_exposure;
const float PI = 3.14159265359;
const float NUM_STRIPES = 8.0;
const float TWIST = -6.0;
const float TIP_ROUNDNESS = 13.0;
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float r = max(length(uv), 0.0001);
  float theta = atan(uv.y, uv.x);
  float global_rot = u_progress * PI * 1.2;
  float phi = theta + r * TWIST + global_rot;
  float val = phi * NUM_STRIPES / (2.0 * PI);
  float segment = fract(val);
  float stripe_id = floor(mod(val, NUM_STRIPES));
  float u = segment * 2.0 - 1.0;
  float max_hole = 1.5;
  float current_hole = max_hole - u_progress * (max_hole + 2.0 / TIP_ROUNDNESS);
  float r_edge = current_hole - sqrt(max(1.0 - u*u, 0.0)) / TIP_ROUNDNESS;
  float alpha = smoothstep(r_edge - 0.005, r_edge + 0.015, r);
  if (alpha <= 0.001) { gl_FragColor = vec4(0.0); return; }
  float v = max(0.0, current_hole - r) * TIP_ROUNDNESS;
  float profile = max(1.0 - u*u - v*v, 0.0);
  float z = sqrt(profile);
  vec2 grad_phi = vec2(-uv.y, uv.x) / (r*r) + TWIST * (uv / r);
  vec2 perp = normalize(grad_phi);
  vec2 tangent = vec2(perp.y, -perp.x);
  if (dot(tangent, uv) > 0.0) tangent = -tangent;
  vec3 N = normalize(vec3(perp * u + tangent * v, z * 0.8));
  bool is_green = (mod(stripe_id, 2.0) == 0.0);
  vec3 base_color = is_green ? u_color : u_cream;
  vec3 L_main = normalize(vec3(-0.5, 0.8, 1.0));
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 H = normalize(L_main + V);
  float diffuse = pow(max(dot(N, L_main) * 0.5 + 0.5, 0.0), 1.5);
  float spec_main = pow(max(dot(N, H), 0.0), 60.0) * 1.5;
  vec2 matcapUV = N.xy * 0.5 + 0.5;
  float window1 = smoothstep(0.1,0.2,matcapUV.x) * smoothstep(0.4,0.3,matcapUV.x) * smoothstep(0.5,0.9,matcapUV.y);
  float window2 = smoothstep(0.6,0.7,matcapUV.x) * smoothstep(0.9,0.8,matcapUV.x) * smoothstep(0.4,0.8,matcapUV.y);
  vec3 fake_reflection = vec3(window1 + window2) * 0.6;
  vec3 ambient = mix(u_ambLo, u_ambHi, N.y * 0.5 + 0.5);
  float highlight_mask = is_green ? 1.0 : 0.8;
  vec3 final_color = base_color * (ambient + diffuse * 0.7);
  final_color += (vec3(1.0) * spec_main + fake_reflection) * highlight_mask;
  float crevice_shadow = smoothstep(0.0, 0.1, z);
  final_color *= mix(0.25, 1.25, crevice_shadow);
  float center_occlusion = smoothstep(0.0, 0.3, r);
  final_color *= mix(0.15, 1.0, center_occlusion);
  final_color *= u_exposure;   // per-theme overall brightness (dark themes dim it)
  gl_FragColor = vec4(final_color, alpha);
}`;

/* ── pure helpers ────────────────────────────────────────────────────────── */
type Rgb = [number, number, number];
/** One theme's swirl palette: coloured stripe, light stripe, ambient lo/hi, overall brightness. */
type Tone = { green: Rgb; cream: Rgb; ambLo: Rgb; ambHi: Rgb; exposure: number };

function hexToRgb(hex: string): Rgb | null {
  let c = hex.trim().replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  if (c.length !== 6 || /[^0-9a-fA-F]/.test(c)) return null;
  return [
    parseInt(c.slice(0, 2), 16) / 255,
    parseInt(c.slice(2, 4), 16) / 255,
    parseInt(c.slice(4, 6), 16) / 255,
  ];
}

/** HSL saturation of an rgb, used as a cheap "is this brand near-neutral" gate. */
function saturationOf([r, g, b]: Rgb): number {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  return d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
/** Push an rgb away from its own luma to change saturation (>1 more, <1 less). */
function saturate([r, g, b]: Rgb, factor: number): Rgb {
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [clamp01(l + (r - l) * factor), clamp01(l + (g - l) * factor), clamp01(l + (b - l) * factor)];
}

/** Lightness 0…1 of an `h s% l%` token triple (e.g. --background); null if unparseable. */
function tokenLightness(triple: string): number | null {
  const parts = triple.trim().split(/\s+/);
  const l = parts.length >= 3 ? parseFloat(parts[2]!.replace('%', '')) : NaN;
  return Number.isFinite(l) ? Math.max(0, Math.min(1, l / 100)) : null;
}

function bgLightness(): number {
  if (typeof getComputedStyle !== 'function') return 0.5;
  return tokenLightness(getComputedStyle(document.documentElement).getPropertyValue('--background')) ?? 0.5;
}

/* The swirl's palette follows both the theme and the brand:
   - exposure (overall brightness) tracks the theme background lightness, so the
     dark theme is unmistakably darker and the light theme brighter - continuously,
     so any future theme adapts without a new preset;
   - the coloured stripe leans toward the live brand accent in every theme (falling
     back to Lolly green only for a near-neutral brand). Light then desaturates it
     slightly (calmer); dark leaves it and lets exposure do the dimming; the
     mid-toned 'brand' theme boosts its saturation and tints the cream stripe with
     it too - the "more colour influenced" variant. */
function toneForTheme(): Tone {
  const bgL = bgLightness();
  const theme = currentTheme();

  // The coloured stripe leans toward the live brand accent in EVERY theme - the
  // swirl wears the brand, not a fixed green. It only falls back to Lolly green when
  // the brand is near-neutral (no accent worth tinting toward), so a black-and-white
  // brand keeps the lollipop identity instead of washing out to grey.
  let green = hexToRgb(LOLLY_GREEN)!;
  const accent = liveAccentHint();
  const accentRgb = accent ? hexToRgb(accent) : null;
  if (accentRgb && saturationOf(accentRgb) >= 0.12) green = mixRgb(green, accentRgb, 0.75);

  let creamTint = 0;
  if (theme === 'light') {
    green = saturate(green, 0.85);                 // calmer, less saturated on light
  } else if (theme === 'brand') {
    green = saturate(green, 1.45);                 // the "more colour influenced" pop
    creamTint = 0.4;                               // light stripes pick up the hue
  }
  // dark keeps the accent at full strength - the low exposure below does the darkening.

  let cream: Rgb = mixRgb([0.80, 0.85, 0.80], [0.97, 0.99, 0.97], bgL);
  if (creamTint) cream = mixRgb(cream, green, creamTint);

  // Overall brightness: dark << light. The brand theme is dark-toned but should
  // stay vivid, so pull its exposure back up toward neutral rather than dim it.
  let exposure = lerp(0.33, 1.08, bgL);
  if (theme === 'brand') exposure = lerp(exposure, 1.0, 0.5);

  return {
    green,
    cream,
    ambLo: mixRgb([0.05, 0.08, 0.11], [0.34, 0.38, 0.40], bgL),
    ambHi: mixRgb([0.28, 0.32, 0.36], [0.66, 0.70, 0.70], bgL),
    exposure,
  };
}

/** A 0–1 Rgb triple as a CSS colour - paints the swirl MARK the same brand tone
 *  (tone.green) the WebGL iris uses for its coloured stripe, so the two match. */
function rgbToCss([r, g, b]: Rgb): string {
  return `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// Overshoot ease for the mark pop; easeOutBack(1) === 1 so the reduced-motion
// end-state is exactly full size.
const easeOutBack = (x: number): number => {
  const c1 = 2.2, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

/* Close easing - the same cubic-bezier feel the blade iris used (ease-out). */
const bez = (p: number, a: number, b: number, cc: number, d: number): number => {
  let x = p;
  for (let i = 0; i < 6; i++) {
    const s = 1 - x;
    const bx = 3 * s * s * x * a + 3 * s * x * x * cc + x * x * x;
    x -= (bx - p) / Math.max(1e-4, 3 * s * s * a + 6 * s * x * (cc - a) + 3 * x * x * (1 - cc));
    x = Math.max(0, Math.min(1, x));
  }
  const s = 1 - x;
  return 3 * s * s * x * b + 3 * s * x * x * d + x * x * x;
};

/* ── controller ──────────────────────────────────────────────────────────── */

export function createShutter(stage: HTMLElement | null): Shutter {
  if (!stage) {
    return { close: () => Promise.resolve(), open: () => {}, play: () => {}, progress: () => {}, destroy: () => {} };
  }

  const root = document.createElement('div');
  root.className = 'export-shutter';
  // NOT aria-hidden on the root: the status block below carries a real focusable
  // button, and an aria-hidden focusable control is a trap. Each decorative
  // surface hides itself instead, and the root is display:none when inactive.
  const seal = document.createElement('div');
  seal.className = 'export-shutter__seal';
  seal.setAttribute('aria-hidden', 'true');
  const cv = document.createElement('canvas');
  cv.className = 'export-shutter__iris';
  cv.setAttribute('aria-hidden', 'true');
  const mark = document.createElement('div');
  mark.className = 'export-shutter__mark';
  mark.setAttribute('aria-hidden', 'true');
  // Inline Lolly swirl, one stacked <div> per generated layer (shutter-mark.ts,
  // derived from the repo-root icon.svg). The DIVS carry the spin: an HTML
  // transform composites off the main thread, so the mark keeps turning while
  // the export render blocks it - SVG-child transforms (the old single-SVG
  // mark) froze the instant the export started.
  mark.innerHTML = SHUTTER_MARK_LAYERS.map((l) =>
    `<div class="export-shutter__layer${l.spin ? ` export-shutter__layer--spin${l.spin}` : ''}${l.blend === 'multiply' ? ' export-shutter__layer--multiply' : ''}">${l.svg}</div>`).join('');
  const flash = document.createElement('div');
  flash.className = 'export-shutter__flash';
  flash.setAttribute('aria-hidden', 'true');
  root.append(seal, cv, mark, flash);
  stage.appendChild(root);

  // ── WebGL, created lazily on the first close so tools that never export don't
  //    hold a GPU context. If anything fails we fall back to the seal plate.
  let gl: WebGLRenderingContext | null = null;
  let uRes: WebGLUniformLocation | null = null;
  let uProg: WebGLUniformLocation | null = null;
  let uColor: WebGLUniformLocation | null = null;
  let uCream: WebGLUniformLocation | null = null;
  let uAmbLo: WebGLUniformLocation | null = null;
  let uAmbHi: WebGLUniformLocation | null = null;
  let uExposure: WebGLUniformLocation | null = null;
  let glReady = false;
  let glFailed = false;

  function compile(type: number, src: string): WebGLShader | null {
    if (!gl) return null;
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('[shutter] shader compile failed:', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function ensureGL(): void {
    if (glReady || glFailed) return;
    try {
      const opts: WebGLContextAttributes = { alpha: true, antialias: true, premultipliedAlpha: false, depth: false };
      gl = (cv.getContext('webgl', opts) || cv.getContext('experimental-webgl', opts)) as WebGLRenderingContext | null;
      if (!gl) { glFailed = true; return; }
      const hi = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
      const precision = hi && hi.precision > 0 ? 'highp' : 'mediump';
      const vs = compile(gl.VERTEX_SHADER, VERT);
      const fs = compile(gl.FRAGMENT_SHADER, `precision ${precision} float;\n${FRAG_BODY}`);
      if (!vs || !fs) { glFailed = true; gl = null; return; }
      const program = gl.createProgram();
      if (!program) { glFailed = true; gl = null; return; }
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { glFailed = true; gl = null; return; }
      gl.useProgram(program);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      uRes = gl.getUniformLocation(program, 'u_resolution');
      uProg = gl.getUniformLocation(program, 'u_progress');
      uColor = gl.getUniformLocation(program, 'u_color');
      uCream = gl.getUniformLocation(program, 'u_cream');
      uAmbLo = gl.getUniformLocation(program, 'u_ambLo');
      uAmbHi = gl.getUniformLocation(program, 'u_ambHi');
      uExposure = gl.getUniformLocation(program, 'u_exposure');
      glReady = true;
    } catch (err) {
      console.warn('[shutter] WebGL init failed, using plate fallback:', err);
      glFailed = true;
      gl = null;
    }
  }
  // A lost context drops us to the plate fallback for the rest of this session.
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); glReady = false; glFailed = true; }, false);

  let raf = 0;
  let cur = 0;
  let destroyed = false;
  // Sensible default until close() reads the live theme (matches the old fixed look).
  let tone: Tone = {
    green: hexToRgb(LOLLY_GREEN)!,
    cream: [0.95, 0.98, 0.95],
    ambLo: [0.10, 0.15, 0.20],
    ambHi: [0.40, 0.45, 0.50],
    exposure: 1,
  };

  const reduced = prefersReducedMotion;
  const fullscreen = (): boolean => window.matchMedia('(max-width: 640px)').matches;

  function paint(prog: number): void {
    if (destroyed) return;
    const r = cv.getBoundingClientRect();
    // DPR capped: the iris is a transient cover, never inspected at rest, and
    // fill rate - not geometry - is what costs on a phone.
    const dpr = Math.min(window.devicePixelRatio || 1, fullscreen() ? 1.5 : 2);
    const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
    const p = Math.max(0, Math.min(1, prog));

    ensureGL();
    if (glReady && gl) {
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      gl.viewport(0, 0, W, H);
      gl.uniform2f(uRes, W, H);
      gl.uniform1f(uProg, Math.pow(p, GAMMA));
      gl.uniform3fv(uColor, tone.green);
      gl.uniform3fv(uCream, tone.cream);
      gl.uniform3fv(uAmbLo, tone.ambLo);
      gl.uniform3fv(uAmbHi, tone.ambHi);
      gl.uniform1f(uExposure, tone.exposure);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // Seal plate. With the swirl it's insurance over the final sliver; without
    // WebGL it carries the whole close as a plain fade to the app background.
    seal.style.opacity = (glReady ? smoothstep(SEAL_LO, 1, p) : smoothstep(0, 1, p)).toFixed(3);

    // Mark: pops out on top of the swirl around 70% of the close.
    const minSide = Math.min(r.width, r.height);
    mark.style.width = (minSide * MARK_FRAC).toFixed(1) + 'px';
    const pop = smoothstep(POP_LO, POP_HI, p);
    mark.style.opacity = pop.toFixed(3);
    mark.style.transform = `translate(-50%, -50%) scale(${(0.5 + 0.5 * easeOutBack(pop)).toFixed(3)})`;
  }

  function animate(to: number): Promise<void> {
    cancelAnimationFrame(raf);
    // Motion only - the iris still opens and closes, it just jumps to the sealed
    // state instead of tweening. Nothing here touches the export: the shutter
    // paints on its own overlay, never on the tool canvas.
    if (reduced()) { cur = to; paint(cur); return Promise.resolve(); }
    const from = cur, t0 = performance.now();
    return new Promise<void>((resolve) => {
      const step = (now: number): void => {
        if (destroyed) { resolve(); return; }
        const t = Math.min(1, (now - t0) / DURATION);
        cur = from + (to - from) * bez(t, 0.33, 0.86, 0.31, 1);
        paint(cur);
        if (t < 1) raf = requestAnimationFrame(step);
        else resolve();
      };
      raf = requestAnimationFrame(step);
    });
  }

  // Removing the class alone does not reset a running CSS animation - force a
  // reflow between remove and add so a rapid second export still flashes.
  function fireFlash(): void {
    if (reduced()) return;
    flash.classList.remove('is-on');
    void flash.offsetWidth;
    flash.classList.add('is-on');
  }

  /* ── the status block ──────────────────────────────────────────────────────
     Built on FIRST use, so a tool that only ever does fast exports never pays
     for the nodes. Shown only once an export outlasts STATUS_DELAY. Every write
     is textContent/setAttribute - the module's ONE innerHTML sink is the brand
     mark's generated constant (primitive-guards.test.ts pins the count at 1). */
  let statusEl: HTMLElement | null = null;
  let labelEl: HTMLElement | null = null;
  let metaEl: HTMLElement | null = null;
  let barEl: HTMLElement | null = null;
  let fillEl: HTMLElement | null = null;
  let btnEl: HTMLButtonElement | null = null;
  let status: ShutterStatus | null = null;
  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  let clockTimer: ReturnType<typeof setInterval> | undefined;
  let closedAt = 0;
  /** Last painted integer percent; -1 while the total is unknown. */
  let lastPct = -1;

  function buildStatus(): HTMLElement {
    const box = document.createElement('div');
    box.className = 'export-shutter__status';
    labelEl = document.createElement('p');
    labelEl.className = 'export-shutter__status-label';
    metaEl = document.createElement('p');
    metaEl.className = 'export-shutter__status-meta';
    barEl = document.createElement('div');
    barEl.className = 'export-shutter__status-bar';
    barEl.setAttribute('role', 'progressbar');
    barEl.setAttribute('aria-valuemin', '0');
    barEl.setAttribute('aria-valuemax', '100');
    barEl.hidden = true;                  // only a known total earns a bar
    fillEl = document.createElement('i');
    barEl.appendChild(fillEl);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'export-shutter__status-hide';
    // The label is written per export in showStatus() - the block is built once and
    // reused, and Cancel/Hide is a property of the export, not of the block.
    btnEl = btn;
    btn.addEventListener('click', () => { dismiss(); });
    box.append(labelEl, metaEl, barEl, btn);
    root.appendChild(box);
    statusEl = box;
    // Esc dismisses an overlay everywhere else in the app, and this one covers the
    // whole screen. Registered once, with the block, and dropped in destroy() so a
    // tool view teardown can't leave it behind.
    document.addEventListener('keydown', onKey);
    return box;
  }

  /** The one way out, whichever it is - the button and Esc both come through here. */
  function dismiss(): void {
    const s = status;
    if (!s) return;
    if (s.onCancel) s.onCancel();
    else s.onHide();
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key !== 'Escape' || !status || !statusEl?.classList.contains('is-visible')) return;
    e.preventDefault();
    dismiss();
  }

  function paintStatus(): void {
    if (!statusEl || !status) return;
    const parts = [status.detail ?? '', lastPct >= 0 ? `${lastPct}%` : '', clockText(performance.now() - closedAt)];
    metaEl!.textContent = parts.filter(Boolean).join(META_SEP);
    barEl!.hidden = lastPct < 0;
    if (lastPct >= 0) {
      fillEl!.style.width = `${lastPct}%`;
      barEl!.setAttribute('aria-valuenow', String(lastPct));
    }
  }

  function showStatus(): void {
    if (destroyed || !status) return;
    const box = statusEl ?? buildStatus();
    labelEl!.textContent = status.label;
    btnEl!.textContent = status.onCancel ? t('Cancel') : t('Hide');
    box.classList.add('is-visible');
    paintStatus();
    clearInterval(clockTimer);
    clockTimer = setInterval(paintStatus, 1000);
  }

  function clearStatus(): void {
    clearTimeout(statusTimer); statusTimer = undefined;
    clearInterval(clockTimer); clockTimer = undefined;
    status = null;
    lastPct = -1;
    statusEl?.classList.remove('is-visible');
  }

  async function close(next: ShutterStatus | null = null): Promise<void> {
    if (destroyed) return;
    clearStatus();
    status = next;
    closedAt = performance.now();
    if (next) statusTimer = setTimeout(showStatus, STATUS_DELAY.ms);
    tone = toneForTheme();
    // Paint the swirl mark the same brand tone the iris stripe uses (host-profile accent
    // mixed into Lolly green) - the layers' spin + hue drift ride on top of it (tool.css).
    mark.style.setProperty('--exsh-swirl', rgbToCss(tone.green));
    /* Mobile: lift the shutter out of the stage so it covers the WHOLE screen - 
       over the sidebar sheet and export controls - while the system download or
       share sheet appears. (An ancestor's backdrop-filter is a fixed-positioning
       containing block, so moving to <body> is what actually reaches the
       viewport.) Desktop keeps it scoped to the stage. */
    if (fullscreen()) {
      document.body.appendChild(root);
      root.classList.add('export-shutter--fullscreen');
    }
    root.classList.add('is-active');
    cur = 0;
    paint(cur);
    playSfx('shutter');            // the ka-chunk, synced to the swirl closing
    await animate(1);
    fireFlash();                   // sealed - pop the primary
  }

  function open(): void {
    if (destroyed) return;
    // The status block goes with the opening, not 375ms after it - it belongs to
    // a sealed screen. Idempotent, so the Hide button and the export's own
    // finally can both call open().
    clearStatus();
    void animate(0).then(() => {
      if (destroyed) return;
      root.classList.remove('is-active');
      flash.classList.remove('is-on');
      if (root.classList.contains('export-shutter--fullscreen')) {
        root.classList.remove('export-shutter--fullscreen');
        stage!.appendChild(root);
      }
    });
  }

  return {
    close,
    open,
    play(): void { void close().then(open); },
    progress(done: number, total: number): void {
      if (destroyed || !status) return;
      const p = total > 0 ? Math.max(0, Math.min(100, Math.floor((done / total) * 100))) : -1;
      // Integer percent only, so a per-frame export callback can't thrash the DOM.
      if (p === lastPct) return;
      lastPct = p;
      if (statusEl?.classList.contains('is-visible')) paintStatus();
    },
    destroy(): void {
      destroyed = true;
      clearStatus();
      if (statusEl) document.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
      if (gl) { try { gl.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* best effort */ } }
      root.remove();
    },
  };
}
