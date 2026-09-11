// SPDX-License-Identifier: MPL-2.0
/**
 * Lolly's own MilkDrop presets, seeded from the active brand's palette.
 *
 * Why author our own instead of shipping the stock butterchurn preset library:
 *
 *  1. COLOUR. Two thirds of the ~1750 converted community presets compute their
 *     final colour inside an HLSL `comp` shader, and another third assign the
 *     colour variables from their own per-frame equations - so overriding a
 *     preset's `baseVals` colours (the only hook there is) gets silently ignored
 *     by most of them. A brand-coloured visualizer has to come from presets whose
 *     equations we wrote.
 *  2. PROVENANCE. The `butterchurn-presets` package's MIT notice covers the
 *     converter; the presets themselves are community MilkDrop works, mostly
 *     without an explicit licence. Ours carry no such question.
 *  3. NO `new Function`. `loadPreset` only string-compiles equations when
 *     `init_eqs` isn't already a function (butterchurn 2.6.7) - so authoring the
 *     equations as REAL functions means the whole visualizer runs without
 *     `unsafe-eval`, keeps type-checking, and stays lintable like any other module.
 *  4. WEIGHT. Five presets as code cost a couple of KB; the stock packs are 12 MB.
 *
 * Colour is SEEDED, not reproduced - see lib/viz-palette.ts. Each preset closes
 * over the palette and walks it per-frame, so the same preset reads green under
 * SUSE and reads whatever the loaded brand is otherwise.
 *
 * MilkDrop variable conventions used below: `bass`/`mid`/`treb` (and the smoothed
 * `*_att`) sit near 1.0 at average loudness and climb with energy; `time` is
 * seconds; `decay` is feedback persistence (higher = longer trails); `zoom` > 1
 * flows outward, < 1 inward.
 */
import type { VizPalette, VizRgb } from './viz-palette.ts';
import {
  compBrandTone, compBrandEcho, compBrandRadial, compBrandEdge, compBrandRelief,
  compBrandStreak, compBrandClouds, compBrandMosaic, compBrandBump, compBrandWatercolour,
  compBrandPrism,
  warpBrandFlow, warpBrandRadial, warpBrandVolume, warpBrandTile, warpBrandWatercolour, warpPlain,
} from './viz-glsl.ts';

// ── The slice of butterchurn's preset shape we author ────────────────────────
// Deliberately loose on baseVals (butterchurn merges ours over its own defaults,
// so every key is optional) and precise about the equation callbacks, which are
// the part that has to be functions rather than source strings.

/** The mutable variable bag MilkDrop equations read and write. Audio scalars and
 *  `time`/`frame` come in; anything assigned back out becomes that frame's state. */
export interface MdVars {
  [key: string]: unknown;
  time: number;
  frame: number;
  fps: number;
  bass: number;
  bass_att: number;
  mid: number;
  mid_att: number;
  treb: number;
  treb_att: number;
}

type Eqs = (m: MdVars) => MdVars;

interface PresetPart {
  baseVals: Record<string, number>;
  init_eqs: Eqs;
  frame_eqs: Eqs;
  /** Waves only; '' when the wave needs no per-point pass. */
  point_eqs?: Eqs | '';
}

export interface VizPreset {
  baseVals: Record<string, number>;
  init_eqs: Eqs;
  frame_eqs: Eqs;
  /** '' when the preset needs no per-pixel pass - butterchurn tests for it. */
  pixel_eqs: Eqs | '';
  /**
   * Custom HLSL warp shader source, or '' to use butterchurn's built-in warp path.
   *
   * REQUIRED, and required as a STRING, because butterchurn's renderer does a bare
   * `this.preset.warp.trim()` with no guard - omitting the key throws inside
   * `loadPreset` before a single frame renders, which presents as a black canvas
   * with no console error anywhere near the cause. '' selects the built-in path;
   * ours carry generated GLSL from lib/viz-glsl.ts.
   *
   * Note the collision: this `warp` is shader SOURCE, while `baseVals.warp` is the
   * numeric warp amount the equations animate. Same word, different level, and only
   * one of them is a string.
   */
  warp: string;
  /** Custom HLSL composite shader source, or '' for the built-in path. Same
   *  unguarded `.trim()` as `warp` - see above. */
  comp: string;
  shapes: PresetPart[];
  waves: PresetPart[];
}

/**
 * Shorthand for a preset's shader pair. Every Lolly preset now carries REAL GLSL (see
 * lib/viz-glsl.ts) rather than '' - '' selects butterchurn's built-in path, which is
 * the limited look the first version was stuck with.
 *
 * `comp` re-derives colour from luminance through the brand ramp, so the picture can't
 * drift off-brand; `warp` shapes the feedback loop's texture and MUST apply `decay`.
 */
function shaders(warp: string, comp: string): { warp: string; comp: string } {
  return { warp, comp };
}

// ── Palette helpers ──────────────────────────────────────────────────────────

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Sample the brand ramp at `t`, wrapping and interpolating between steps so a
 * preset can sweep the palette smoothly instead of stepping through it. `t` is
 * treated modulo 1, so callers can feed an ever-increasing `time * speed`.
 */
export function rampAt(p: VizPalette, t: number): VizRgb {
  const n = p.ramp.length;
  if (n === 0) return p.hero;
  if (n === 1) return p.ramp[0]!;
  const x = ((t % 1) + 1) % 1 * n;
  const i = Math.floor(x) % n;
  const j = (i + 1) % n;
  const f = x - Math.floor(x);
  const a = p.ramp[i]!;
  const b = p.ramp[j]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** Pick a CORE accent by index, wrapping - shapes index this so a thin palette still
 *  fills every shape. These are the brand's own hue at different lightnesses. */
export function accentAt(p: VizPalette, i: number): VizRgb {
  const n = p.accents.length;
  return n ? p.accents[((i % n) + n) % n]! : p.hero;
}

/**
 * A SUPPORTING colour - an off-family brand hue (SUSE: persimmon, waterhole), or the
 * palette's light end when the brand has none. Only for accents that trim a shape
 * rather than fill it: the core family carries the effects, and these are the "if they
 * can play a supporting role" colours, kept to edges and highlights.
 */
export function supportAt(p: VizPalette, i: number): VizRgb {
  const n = p.support.length;
  return n ? p.support[((i % n) + n) % n]! : p.tip;
}

/** Scale a colour's brightness, staying in butterchurn's 0–1 range. */
function shade(c: VizRgb, k: number): VizRgb {
  return [clamp01(c[0] * k), clamp01(c[1] * k), clamp01(c[2] * k)];
}

/** Assign a colour onto the `<prefix>_r/g/b` triple the equations write to. */
function paint(m: MdVars, prefix: string, c: VizRgb): void {
  m[`${prefix}_r`] = c[0];
  m[`${prefix}_g`] = c[1];
  m[`${prefix}_b`] = c[2];
}

/** Spread a colour across the bare `r`/`g`/`b` keys a shape or wave uses. */
function paintBare(vals: Record<string, number>, c: VizRgb, suffix = ''): void {
  vals[`r${suffix}`] = c[0];
  vals[`g${suffix}`] = c[1];
  vals[`b${suffix}`] = c[2];
}

/**
 * Bridge per-frame audio into the shaders.
 *
 * butterchurn copies `mdVSFrame.q1`..`q32` into the `_qa`..`_qh` uniforms every frame,
 * which is the supported way to get a number from a preset's equations into its GLSL.
 * Using it means the audio logic stays here - typed, readable and unit-tested - while
 * the shader just consumes three scalars:
 *
 *   q1  exposure push      (composite: lifts the whole field)
 *   q2  echo scale         (composite: video-echo nesting depth)
 *   q3  warp displacement  (warp: how hard the flow field pushes)
 *   q4  relief light angle (composite: which way the emboss is lit, radians)
 *   q5  streak reach       (composite: how far the radial rays march)
 *   q6  mosaic cell scale  (composite: grid density, as a multiplier)
 *   q7  light elevation    (composite: how steeply the bump light sits, -1..1)
 *   q8  prism split        (composite: chromatic dispersion width)
 *
 * All six are written every frame even when a preset's shaders ignore them: an unset q
 * reaches the uniform as 0 via `mdVSFrame.q1 || 0`, and a 0 that MEANT something (a
 * mosaic with zero cells, say) is far harder to spot than an explicit value.
 */
interface ShaderQs {
  exposure?: number;
  echo?: number;
  warp?: number;
  reliefAngle?: number;
  streak?: number;
  mosaic?: number;
  lightElevation?: number;
  prismSplit?: number;
}
function setShaderQs(m: MdVars, q: ShaderQs): void {
  m.q1 = q.exposure ?? 0;
  m.q2 = q.echo ?? 0;
  m.q3 = q.warp ?? 0;
  m.q4 = q.reliefAngle ?? 0;
  m.q5 = q.streak ?? 0;
  m.q6 = q.mosaic ?? 0;
  m.q7 = q.lightElevation ?? 0;
  m.q8 = q.prismSplit ?? 0;
}

/** A shape/wave that needs no equations of its own - static baseVals only.
 *  `frame_eqs` is called unguarded by the renderer, so it can't be omitted. */
function staticPart(baseVals: Record<string, number>, wave = false): PresetPart {
  const part: PresetPart = { baseVals, init_eqs: (m) => m, frame_eqs: (m) => m };
  if (wave) part.point_eqs = '';
  return part;
}

/**
 * MilkDrop's fixed slot count. The renderer builds `range(4)` custom-shape and
 * custom-waveform objects ONCE and then iterates THOSE, indexing into the preset:
 * `this.customShapes.forEach((shape, i) => shape.drawCustomShape(…, preset.shapes[i], …))`.
 * So a preset that declares fewer than four hands `undefined` to the draw call and
 * throws mid-frame - which kills the render loop, i.e. another silent black screen.
 * (It's why every stock converted preset carries exactly 4 shapes and 4 waves,
 * most of them `enabled: 0`.)
 */
const SLOTS = 4;

/** Pad shapes/waves out to the renderer's fixed slot count with disabled parts. */
function padSlots(parts: PresetPart[], wave: boolean): PresetPart[] {
  const out = parts.slice(0, SLOTS);
  while (out.length < SLOTS) out.push(staticPart({ enabled: 0 }, wave));
  return out;
}

/** Normalise a hand-authored preset into exactly what the renderer requires. Every
 *  preset goes through this, so no factory has to remember the slot padding. */
function normalize(preset: VizPreset): VizPreset {
  return {
    ...preset,
    shapes: padSlots(preset.shapes, false),
    waves: padSlots(preset.waves, true),
  };
}

// ── Making a preset FILL the screen ──────────────────────────────────────────
//
// MilkDrop's field starts black and each frame is: warp the PREVIOUS frame (zoom,
// rotate, translate, warp-field) and redraw it multiplied by `decay`, then draw this
// frame's marks on top. So "fills the screen" is not about drawing bigger - it's
// about the feedback loop:
//
//   decay near 1        trails persist instead of dying within a few frames
//   zoom away from 1    every frame pushes the image outward (or inward), smearing
//                       marks across the whole field rather than leaving them put
//   warp                bends that flow so it doesn't just look like a zoom
//   gammaadj > 1        a straight multiply in the composite shader - lifts everything
//   brighten            `ret = sqrt(ret)` in the composite: pulls midtones up hard
//   darken_center: 0    the default 1 punches a permanent dark hole in the middle
//
// The first pass at these presets was far too timid on every one of them (zoom 1.004,
// decay 0.955, darken_center 1), which is why the visuals sat in the middle of a black
// screen instead of filling it.
const FILL: Record<string, number> = {
  // Crisper than the previous pass. decay 0.982 + brighten made everything a bright
  // grey haze - "smokey". Pulling decay down and dropping `brighten` (which is
  // `ret = sqrt(ret)`, lifting every dark pixel towards white) trades fog for
  // contrast: fewer, brighter, more separated marks over a dark brand ground.
  decay: 0.955,
  // NOTE gammaadj / brighten / darken / solarize / invert are read by butterchurn's
  // BUILT-IN composite shader. Every Lolly preset now ships its own comp shader, which
  // replaces that body - so these are inert and exposure/contrast live in the shader's
  // CompOptions instead. Left at neutral values so nothing depends on them.
  gammaadj: 1.0,
  brighten: 0,
  // Still live: darken_center is drawn as its own pass, not in the comp shader.
  darken_center: 0,
  warp: 0.35,
  warpscale: 1.3,
  warpanimspeed: 0.8,
  // Bigger INK rather than more fog: the waveform itself is drawn large and thick, so
  // the preset fills the frame with actual strokes instead of smear.
  wave_thick: 1,
  wave_a: 0.95,
  wave_scale: 4.4,
  wave_smoothing: 0.45,
  // Borders eat the edges of a full-bleed image; off unless a preset wants a frame.
  ob_size: 0, ob_a: 0, ib_size: 0, ib_a: 0,
  mv_a: 0,
};

/**
 * A full-bleed brand ground - the reason the field reads as the brand instead of as
 * black.
 *
 * There is no way to tint MilkDrop's composite globally: the built-in composite
 * shader's `hue_shader` comes from the warp mesh's vertex colours, and butterchurn
 * hardcodes those to white, so `fshader` can't carry a brand colour. The only thing
 * that puts colour into the field is geometry drawn into it.
 *
 * Custom shapes render BEFORE the waveform (motion vectors → shapes → custom waves →
 * basic waveform), so shape slot 0 makes an ideal ground: an oversized radial
 * gradient, brand hero at the centre falling to the ramp's dark end at the edge,
 * redrawn every frame under everything else. Alpha stays well below 1 so the decay
 * trails still show through and accumulate - an opaque ground would wipe the feedback
 * loop and flatten the whole preset.
 *
 * `rad` is 2.0: a shape radius of ~0.71 would only just touch the corners of the
 * normalised field, so this is deliberately far past the edge to avoid a visible
 * circular seam on wide screens.
 */
function brandGround(p: VizPalette, opts: { alpha?: number; edgeAlpha?: number; sides?: number } = {}): PresetPart {
  const { alpha = 0.34, edgeAlpha = 0.6, sides = 48 } = opts;
  const vals: Record<string, number> = {
    enabled: 1, sides, rad: 2.0, ang: 0, x: 0.5, y: 0.5,
    a: alpha, a2: edgeAlpha, border_a: 0, additive: 0, thickoutline: 0,
  };
  paintBare(vals, p.deep);
  paintBare(vals, p.deepest, '2');
  return {
    baseVals: vals,
    init_eqs: (m) => m,
    frame_eqs: (m) => {
      // Deliberately STABLE. The previous version walked the ground's hue every frame,
      // which is what made the colour visibly "jump to other colours" a second after a
      // preset loaded. The ground is the brand's dark end and it stays there; the
      // MARKS are what move through the palette.
      const c = p.deep;
      m.r = c[0]; m.g = c[1]; m.b = c[2];
      m.r2 = p.deepest[0]; m.g2 = p.deepest[1]; m.b2 = p.deepest[2];
      // Alpha still breathes: a dark ground drawn OVER the decay trails suppresses the
      // haze, so pulsing it with the mids is what gives the field its contrast rhythm.
      m.a = clamp01(alpha * (0.85 + 0.3 * Math.min(1.4, m.mid_att)));
      return m;
    },
  };
}

/** An additive accent ring - the marks that pop against the ground. */
function accentRing(p: VizPalette, i: number, opts: { rad?: number; sides?: number; alpha?: number; swell?: number; spin?: number } = {}): PresetPart {
  const { rad = 0.3, sides = 6, alpha = 0.5, swell = 0.22, spin = 0.06 } = opts;
  const inner = accentAt(p, i);
  const outer = shade(accentAt(p, i + 1), 0.4);
  const vals: Record<string, number> = {
    enabled: 1, sides, rad, ang: i * 0.5, x: 0.5, y: 0.5,
    a: alpha, a2: 0, border_a: 0.3, additive: 1, thickoutline: i === 0 ? 1 : 0,
  };
  paintBare(vals, inner);
  paintBare(vals, outer, '2');
  // Fill is core-family; only the thin outline may borrow an off-family brand hue.
  const trim = supportAt(p, i);
  vals.border_r = trim[0]; vals.border_g = trim[1]; vals.border_b = trim[2];
  return {
    baseVals: vals,
    init_eqs: (m) => m,
    frame_eqs: (m) => {
      const bass = Math.max(0, m.bass_att - 0.8);
      m.rad = rad + bass * swell;
      m.ang = i * 0.5 + m.time * spin;
      m.a = clamp01(alpha * (0.5 + 0.7 * Math.min(1.3, m.bass_att)));
      return m;
    },
  };
}

// ── The presets ──────────────────────────────────────────────────────────────

/**
 * Brand Pulse - the default. A centred waveform over the brand ground, with the warp
 * field and zoom both swelling hard on bass so each beat throws the image outward and
 * fills the frame. Colour walks the ramp, nudged by treble.
 */
function brandPulse(p: VizPalette): VizPreset {
  return {
    baseVals: { ...FILL, wave_mode: 2, wave_scale: 2.8, wave_mystery: -0.15, zoomexp: 1 },
    init_eqs: (m) => m,
    frame_eqs: (m) => {
      const bass = m.bass_att;
      m.zoom = 1.014 + 0.05 * Math.max(0, bass - 0.75);
      m.warp = 0.35 + 0.9 * Math.max(0, bass - 0.7);
      m.rot = 0.012 * Math.sin(m.time * 0.11);
      m.wave_scale = 2.2 + 1.4 * Math.max(0, bass - 0.85);
      // Treble drives BRIGHTNESS, never hue: feeding it into the ramp position made
      // the colour flicker between palette entries on every transient.
      paint(m, 'wave', shade(rampAt(p, m.time * 0.02 + 0.55), 1 + 0.25 * Math.min(1, m.treb_att)));
      setShaderQs(m, { exposure: 0.3 * Math.max(0, bass - 0.8), warp: 1.3 * Math.max(0, bass - 0.75) });
      return m;
    },
    // Warp harder towards the edges: the centre stays readable while the rim churns.
    pixel_eqs: (m) => {
      m.warp = (m.warp as number) + (m.rad as number) * 0.5;
      return m;
    },
    ...shaders(warpBrandFlow(p, { strength: 0.007, scale: 2.4, swirl: 0.7 }), compBrandTone(p, { glow: 0.6, contrast: 1.4, vignette: 0.38 })),
    shapes: [brandGround(p)],
    waves: [],
  };
}

/**
 * Tunnel - a constant hard outward zoom that accelerates with radius, so the field
 * reads as flying down a brand-coloured tube. The most literally screen-filling of
 * the set: everything drawn is immediately dragged to the edges.
 */
function tunnel(p: VizPalette): VizPreset {
  return {
    baseVals: { ...FILL, wave_mode: 0, wave_scale: 1.8, decay: 0.99, warp: 0.1, warpscale: 2.4 },
    init_eqs: (m) => m,
    frame_eqs: (m) => {
      m.zoom = 1.03 + 0.035 * Math.max(0, m.bass_att - 0.8);
      m.rot = 0.006 * Math.sin(m.time * 0.07);
      m.warp = 0.1 + 0.25 * Math.max(0, m.mid_att - 0.85);
      paint(m, 'wave', p.tip);
      setShaderQs(m, {
        exposure: 0.18 * Math.max(0, m.bass_att - 0.85),
        warp: 0.9 * Math.max(0, m.mid_att - 0.85),
        // Rays reach further on a beat - the tunnel appears to lengthen.
        streak: 0.9 * Math.max(0, m.bass_att - 0.8),
      });
      return m;
    },
    pixel_eqs: (m) => {
      // Zoom grows with radius - the depth cue that makes it a tunnel, not a zoom.
      m.zoom = (m.zoom as number) + (m.rad as number) * 0.045;
      return m;
    },
    ...shaders(warpBrandRadial(p, { strength: 0.01, scale: 3.2 }), compBrandStreak(p, { taps: 12, reach: 0.32, contrast: 1.28 })),
    shapes: [brandGround(p, { alpha: 0.26 })],
    waves: [],
  };
}

/**
 * Vortex - heavy rotation against a slow inward pull, which winds every mark into
 * brand-coloured spiral arms that reach the corners.
 */
function vortex(p: VizPalette): VizPreset {
  return {
    baseVals: { ...FILL, wave_mode: 1, wave_scale: 2.6, decay: 0.988, warp: 0.4, additivewave: 1 },
    init_eqs: (m) => m,
    frame_eqs: (m) => {
      const bass = m.bass_att;
      m.rot = 0.03 + 0.05 * Math.max(0, bass - 0.8);
      m.zoom = 0.992 - 0.012 * Math.max(0, bass - 0.9);
      m.warp = 0.4 + 0.5 * Math.max(0, m.treb_att - 0.85);
      paint(m, 'wave', shade(rampAt(p, m.time * 0.012), 1.2));
      setShaderQs(m, { exposure: 0.24 * Math.max(0, bass - 0.8), warp: 1.6 * Math.max(0, m.treb_att - 0.85) });
      return m;
    },
    pixel_eqs: (m) => {
      // Rotate faster near the centre: shear is what makes the arms curl.
      m.rot = (m.rot as number) * (1.6 - (m.rad as number));
      return m;
    },
    ...shaders(warpBrandFlow(p, { strength: 0.009, scale: 1.8, swirl: 1.4 }), compBrandRadial(p, { glow: 0.6, contrast: 1.42 })),
    shapes: [brandGround(p, { alpha: 0.28 })],
    waves: [],
  };
}

/**
 * Kaleidoscope - the composite shader's echo, blended at half strength against a
 * rotating field, so the image nests inside itself. Fills the frame by construction:
 * the echo copy is always covering whatever the main copy isn't.
 */
function kaleidoscope(p: VizPalette): VizPreset {
  return {
    baseVals: {
      ...FILL, wave_mode: 2, wave_scale: 2.2, decay: 0.985,
      echo_alpha: 0.5, echo_zoom: 1.6, echo_orient: 3, warp: 0.25,
    },
    init_eqs: (m) => m,
    frame_eqs: (m) => {
      m.zoom = 1.008 + 0.02 * Math.max(0, m.bass_att - 0.85);
      m.rot = 0.014 + 0.02 * Math.sin(m.time * 0.09);
      // Drift the echo's scale so the nesting depth keeps changing.
      m.echo_zoom = 1.45 + 0.35 * Math.sin(m.time * 0.05);
      m.echo_alpha = 0.42 + 0.16 * Math.min(1, m.mid_att);
      paint(m, 'wave', shade(rampAt(p, m.time * 0.01 + 0.6), 1.2));
      setShaderQs(m, {
        exposure: 0.16 * Math.max(0, m.bass_att - 0.85),
        // Echo scale drifts on its own clock and swells with the mids.
        echo: 0.45 + 0.3 * Math.sin(m.time * 0.05) + 0.2 * Math.min(1, m.mid_att),
        warp: 0.5 * Math.max(0, m.mid_att - 0.9),
      });
      return m;
    },
    pixel_eqs: '',
    ...shaders(warpBrandTile(p, { strength: 0.005, scale: 3.0, swirl: 1.1 }), compBrandEcho(p, { glow: 0.45, contrast: 1.28 })),
    shapes: [brandGround(p, { alpha: 0.24, sides: 6 })],
    waves: [],
  };
}


/**
 * Aurora - the field stretched vertically and drifting upward, with a wide additive
 * line low in the frame. Reads as slow brand-coloured curtains rather than a beat
 * response.
 */
function aurora(p: VizPalette): VizPreset {
  return {
    baseVals: {
      ...FILL, wave_mode: 7, wave_scale: 3.2, wave_a: 0.55, additivewave: 1,
      decay: 0.991, sy: 1.02, sx: 0.998, dy: -0.006, warp: 0.2, warpscale: 3.6,
      wave_y: 0.62, gammaadj: 1.7,
    },
    init_eqs: (m) => m,
    frame_eqs: (m) => {
      m.zoom = 1.004;
      m.dy = -0.004 - 0.006 * Math.max(0, m.bass_att - 0.85);
      m.dx = 0.0016 * Math.sin(m.time * 0.06);
      m.sy = 1.015 + 0.02 * Math.max(0, m.mid_att - 0.9);
      m.wave_a = 0.4 + 0.4 * Math.min(1, Math.max(0, m.mid_att - 0.8));
      paint(m, 'wave', shade(rampAt(p, m.time * 0.009 + 0.8), 1.25));
      setShaderQs(m, { exposure: 0.22 * Math.max(0, m.mid_att - 0.85), warp: 0.6 * Math.min(1.2, m.mid_att) });
      return m;
    },
    pixel_eqs: '',
    ...shaders(warpBrandVolume(p, { strength: 0.005, scale: 0.8 }), compBrandClouds(p, { glow: 0.75, contrast: 1.14, vignette: 0.44, scale: 1.2 })),
    shapes: [brandGround(p, { alpha: 0.34, edgeAlpha: 0.5 })],
    waves: [],
  };
}


/**
 * Bloom - three additive accent rings opening on bass over the ground. The most
 * explicitly "brand palette" preset: each ring is a different brand accent rather
 * than another step of one ramp.
 */
function bloom(p: VizPalette): VizPreset {
  return {
    baseVals: { ...FILL, wave_mode: 0, wave_a: 0.2, wave_scale: 1.6, decay: 0.984, warp: 0.22 },
    init_eqs: (m) => m,
    frame_eqs: (m) => {
      m.zoom = 1.01 + 0.03 * Math.max(0, m.bass_att - 0.8);
      m.rot = 0.008 * Math.sin(m.time * 0.09);
      paint(m, 'wave', p.tip);
      setShaderQs(m, {
        exposure: 0.34 * Math.max(0, m.bass_att - 0.8),
        // Sweep the emboss light around slowly so the relief keeps changing direction.
        reliefAngle: m.time * 0.25,
      });
      return m;
    },
    pixel_eqs: '',
    ...shaders(warpPlain(p), compBrandRelief(p, { depth: 3.2, contrast: 1.12 })),
    shapes: [
      brandGround(p, { alpha: 0.28 }),
      accentRing(p, 0, { rad: 0.24, sides: 5, alpha: 0.55, swell: 0.26 }),
      accentRing(p, 1, { rad: 0.42, sides: 7, alpha: 0.42, swell: 0.3, spin: -0.05 }),
      accentRing(p, 2, { rad: 0.62, sides: 9, alpha: 0.3, swell: 0.34, spin: 0.035 }),
    ],
    waves: [],
  };
}


/**
 * Lattice - the motion-vector grid turned up and lit in brand colours, over a dotted
 * waveform. A structured, textural fill instead of a flowing one.
 */
function lattice(p: VizPalette): VizPreset {
  return {
    baseVals: {
      ...FILL, wave_mode: 3, wave_dots: 1, wave_a: 0.5, wave_scale: 2.0,
      decay: 0.976, warp: 0.16, mv_x: 30, mv_y: 20, mv_a: 0.7, mv_l: 0.85,
    },
    init_eqs: (m) => m,
    frame_eqs: (m) => {
      m.zoom = 1.006 + 0.02 * Math.max(0, m.bass_att - 0.85);
      m.rot = 0.005 * Math.sin(m.time * 0.06);
      m.mv_a = 0.45 + 0.45 * Math.min(1, Math.max(0, m.mid_att - 0.75));
      m.mv_x = 24 + 10 * Math.sin(m.time * 0.04);
      m.mv_dy = 0.5 + 0.3 * Math.sin(m.time * 0.17);
      paint(m, 'mv', shade(rampAt(p, m.time * 0.009 + 0.25), 1.25));
      paint(m, 'wave', p.tip);
      setShaderQs(m, {
        exposure: 0.2 * Math.max(0, m.mid_att - 0.8),
        // Cells coarsen on the beat, so the grid visibly pulses.
        mosaic: -0.35 * Math.min(1, Math.max(0, m.bass_att - 0.8)),
      });
      return m;
    },
    pixel_eqs: '',
    ...shaders(warpPlain(p), compBrandMosaic(p, { cells: 56, contrast: 1.3 })),
    shapes: [brandGround(p, { alpha: 0.3 })],
    waves: [],
  };
}

/**
 * Spectrum - the literal one: a dotted frequency-domain wave with the motion-vector
 * grid behind it. Reads as an instrument rather than as art, which is what some
 * listeners actually want. Calm enough for reduced motion.
 */
function spectrum(p: VizPalette): VizPreset {
  const barVals: Record<string, number> = {
    enabled: 1, samples: 256, spectrum: 1, usedots: 1, thick: 1, additive: 1,
    scaling: 1.9, smoothing: 0.35, a: 0.95,
  };
  paintBare(barVals, p.tip);
  return {
    baseVals: {
      ...FILL, wave_mode: 0, wave_a: 0, decay: 0.94, warp: 0.02, zoom: 1.001,
      mv_x: 24, mv_y: 14, mv_a: 0.4, mv_l: 0.6, gammaadj: 1.4,
    },
    init_eqs: (m) => m,
    frame_eqs: (m) => {
      m.mv_a = 0.25 + 0.35 * Math.min(1, Math.max(0, m.mid_att - 0.8));
      m.mv_dy = 0.5 + 0.25 * Math.sin(m.time * 0.2);
      paint(m, 'mv', rampAt(p, m.time * 0.007 + 0.25));
      setShaderQs(m, { exposure: 0.16 * Math.max(0, m.mid_att - 0.8) });
      return m;
    },
    pixel_eqs: '',
    ...shaders(warpPlain(p), compBrandEdge(p, { spread: 1.2, ink: 1.8, contrast: 1.22, vignette: 0.2 })),
    shapes: [brandGround(p, { alpha: 0.34, edgeAlpha: 0.5 })],
    waves: [staticPart(barVals, true)],
  };
}

/**
 * Drift - the quiet one, and what reduced motion opens on: a brand-coloured field
 * that fills the screen and barely moves. Bass lifts brightness only; the geometry is
 * deliberately audio-INDEPENDENT so nothing ever lurches.
 */
function drift(p: VizPalette): VizPreset {
  return {
    baseVals: {
      ...FILL, wave_mode: 1, wave_a: 0.3, wave_scale: 2.0, additivewave: 1,
      decay: 0.994, warp: 0.05, warpscale: 5, warpanimspeed: 0.15,
      gammaadj: 1.5, wave_smoothing: 0.9, wave_thick: 0,
    },
    init_eqs: (m) => m,
    frame_eqs: (m) => {
      // No audio term on zoom/warp/rot - only alpha responds.
      m.zoom = 1.0025;
      m.rot = 0.0015;
      m.wave_a = 0.22 + 0.2 * Math.min(1, Math.max(0, m.bass_att - 0.9));
      paint(m, 'wave', shade(rampAt(p, m.time * 0.005 + 0.6), 1.2));
      setShaderQs(m, { exposure: 0.1 * Math.min(1, Math.max(0, m.bass_att - 0.9)), warp: 0.2 });
      return m;
    },
    pixel_eqs: '',
    ...shaders(warpBrandFlow(p, { strength: 0.0025, scale: 0.8, swirl: 0.15 }), compBrandTone(p, { glow: 0.62, contrast: 1.22, grain: 0.008, vignette: 0.45, lift: 0.05 })),
    // The ground carries this preset almost entirely - it's what's on screen.
    shapes: [brandGround(p, { alpha: 0.44, edgeAlpha: 0.55 })],
    waves: [],
  };
}

/**
 * Foil - bump-mapped lighting over a slow flow, so the field reads as a brushed metallic
 * surface catching a moving light. The only preset that reconstructs a surface normal,
 * which is what makes it feel physical rather than luminous.
 */
function foil(p: VizPalette): VizPreset {
  return {
    baseVals: {
      ...FILL, wave_mode: 1, wave_a: 0.5, wave_scale: 3.0, wave_thick: 1,
      decay: 0.975, warp: 0.18, warpscale: 2.6, warpanimspeed: 0.5, zoom: 1.004,
    },
    init_eqs: (m) => m,
    frame_eqs: (m) => {
      m.zoom = 1.004 + 0.014 * Math.max(0, m.bass_att - 0.85);
      m.rot = 0.005 * Math.sin(m.time * 0.06);
      m.wave_a = 0.35 + 0.4 * Math.max(0, m.mid_att - 0.85);
      paint(m, 'wave', shade(rampAt(p, m.time * 0.007 + 0.3), 1.2));
      setShaderQs(m, {
        exposure: 0.14 * Math.max(0, m.bass_att - 0.85),
        warp: 0.5 * Math.max(0, m.mid_att - 0.9),
        // The light orbits steadily and its elevation breathes with the bass, so the
        // relief keeps catching the light from a new angle.
        reliefAngle: m.time * 0.35,
        lightElevation: 0.4 * Math.sin(m.time * 0.11) + 0.3 * Math.min(1, m.bass_att),
      });
      return m;
    },
    pixel_eqs: '',
    ...shaders(warpBrandFlow(p, { strength: 0.004, scale: 1.6, swirl: 0.35 }),
      compBrandBump(p, { depth: 6.5, shine: 0.6, contrast: 1.06 })),
    shapes: [brandGround(p, { alpha: 0.3, edgeAlpha: 0.5 })],
    waves: [],
  };
}

/**
 * Solar - the solarize curve, where midtones peak and BOTH ends fall away, so the field
 * separates into hard bands instead of a smooth gradient. Inverted as well, which makes
 * the bright core read as ink. Nothing else in the set looks remotely like it.
 */
function solar(p: VizPalette): VizPreset {
  return {
    baseVals: {
      ...FILL, wave_mode: 2, wave_a: 0.8, wave_scale: 3.6, wave_thick: 1,
      decay: 0.968, warp: 0.5, warpscale: 1.6, warpanimspeed: 1.1,
    },
    init_eqs: (m) => m,
    frame_eqs: (m) => {
      const bass = m.bass_att;
      m.zoom = 1.01 + 0.03 * Math.max(0, bass - 0.8);
      m.rot = 0.016 * Math.sin(m.time * 0.08);
      m.warp = 0.4 + 0.7 * Math.max(0, bass - 0.75);
      paint(m, 'wave', shade(rampAt(p, m.time * 0.014 + 0.15), 1.25));
      setShaderQs(m, {
        exposure: 0.2 * Math.max(0, bass - 0.8),
        warp: 1.1 * Math.max(0, m.treb_att - 0.85),
      });
      return m;
    },
    pixel_eqs: (m) => {
      m.warp = (m.warp as number) + (m.rad as number) * 0.4;
      return m;
    },
    ...shaders(warpBrandFlow(p, { strength: 0.008, scale: 2.0, swirl: 0.9 }),
      compBrandTone(p, { glow: 0.5, contrast: 1.2, solarize: true, invert: true, vignette: 0.24 })),
    shapes: [brandGround(p, { alpha: 0.22 })],
    waves: [],
  };
}

/**
 * Watercolour - pigment bleeding along the gradient of its own blurred self, curling as it
 * goes, with dark rims pooling at the edges. The softest and slowest of the set, and the
 * only one that reads as a painted surface rather than a lit one. Calm enough for reduced
 * motion: no audio term touches its geometry, only the wash's exposure.
 */
function watercolour(p: VizPalette): VizPreset {
  return {
    baseVals: {
      ...FILL, wave_mode: 6, wave_a: 0.42, wave_scale: 3.4, wave_thick: 1,
      additivewave: 1, wave_smoothing: 0.82,
      // Very long feedback: a wash needs many frames to develop.
      decay: 0.993, warp: 0.04, warpscale: 4.2, warpanimspeed: 0.2, zoom: 1.001,
    },
    init_eqs: (m) => m,
    frame_eqs: (m) => {
      // Geometry is audio-INDEPENDENT - the paint's own motion is the subject, and a
      // beat-driven lurch would break the illusion of a wet surface.
      m.zoom = 1.0015;
      m.rot = 0.0022 * Math.sin(m.time * 0.037);
      m.wave_a = 0.3 + 0.28 * Math.min(1, Math.max(0, m.mid_att - 0.85));
      paint(m, 'wave', shade(rampAt(p, m.time * 0.006 + 0.45), 1.15));
      setShaderQs(m, {
        exposure: 0.12 * Math.max(0, m.bass_att - 0.88),
        // The bleed breathes gently with the mids rather than snapping on the beat.
        warp: 0.35 * Math.min(1, Math.max(0, m.mid_att - 0.8)),
      });
      return m;
    },
    pixel_eqs: '',
    ...shaders(warpBrandWatercolour(p, { bleed: 0.012, curl: 0.55, pool: 0.15 }),
      compBrandWatercolour(p, { wash: 0.58, paper: 0.24, contrast: 1.1 })),
    shapes: [brandGround(p, { alpha: 0.3, edgeAlpha: 0.46 })],
    waves: [],
  };
}

/**
 * Negative - the edge composite with its tone INVERTED, so the field reads as dark ink on a
 * pale brand ground rather than light on dark. The only preset that inverts, and it changes
 * the whole character: graphic and printed instead of luminous.
 */
function negative(p: VizPalette): VizPreset {
  return {
    baseVals: {
      ...FILL, wave_mode: 2, wave_a: 0.85, wave_scale: 3.2, wave_thick: 1,
      decay: 0.945, warp: 0.3, warpscale: 2.0, warpanimspeed: 0.9,
    },
    init_eqs: (m) => m,
    frame_eqs: (m) => {
      m.zoom = 1.008 + 0.022 * Math.max(0, m.bass_att - 0.8);
      m.rot = 0.009 * Math.cos(m.time * 0.07);
      paint(m, 'wave', shade(rampAt(p, m.time * 0.01 + 0.7), 1.15));
      setShaderQs(m, {
        exposure: 0.18 * Math.max(0, m.bass_att - 0.82),
        warp: 0.8 * Math.max(0, m.treb_att - 0.85),
      });
      return m;
    },
    pixel_eqs: '',
    ...shaders(warpBrandFlow(p, { strength: 0.005, scale: 2.6, swirl: 0.5 }),
      compBrandEdge(p, { spread: 1.5, ink: 1.5, contrast: 1.15, vignette: 0.18, invert: true })),
    shapes: [brandGround(p, { alpha: 0.2, edgeAlpha: 0.34 })],
    waves: [],
  };
}

/**
 * Prism - chromatic dispersion: three radial taps, each read at its own point on the brand
 * ramp, so edges fringe through the palette like light through glass. Splits wider on the
 * beat, which makes transients read as the image separating rather than merely brightening.
 */
function prism(p: VizPalette): VizPreset {
  return {
    baseVals: {
      ...FILL, wave_mode: 0, wave_a: 0.8, wave_scale: 3.0, wave_thick: 1,
      decay: 0.972, warp: 0.28, warpscale: 1.9, warpanimspeed: 0.85,
    },
    init_eqs: (m) => m,
    frame_eqs: (m) => {
      const bass = m.bass_att;
      m.zoom = 1.012 + 0.026 * Math.max(0, bass - 0.8);
      m.rot = 0.011 * Math.sin(m.time * 0.05);
      paint(m, 'wave', shade(rampAt(p, m.time * 0.009 + 0.2), 1.2));
      setShaderQs(m, {
        exposure: 0.2 * Math.max(0, bass - 0.8),
        warp: 0.9 * Math.max(0, m.mid_att - 0.85),
        // Dispersion widens hard on a transient - the image pulls apart, then knits back.
        prismSplit: 2.4 * Math.max(0, m.treb_att - 0.78),
      });
      return m;
    },
    pixel_eqs: (m) => {
      m.warp = (m.warp as number) + (m.rad as number) * 0.3;
      return m;
    },
    ...shaders(warpBrandRadial(p, { strength: 0.007, scale: 2.6 }),
      compBrandPrism(p, { split: 0.007, contrast: 1.18 })),
    shapes: [brandGround(p, { alpha: 0.24 })],
    waves: [],
  };
}

/** A preset's identity + factory. `calm` marks the ones safe to offer first when
 *  the user has asked for reduced motion. */
export interface VizPresetDef {
  id: string;
  name: string;
  calm: boolean;
  build(p: VizPalette): VizPreset;
}

/** Register a preset, routing its factory through `normalize` so the renderer's
 *  fixed-slot requirement is satisfied without every factory restating it. */
function define(id: string, name: string, calm: boolean, make: (p: VizPalette) => VizPreset): VizPresetDef {
  return { id, name, calm, build: (p) => normalize(make(p)) };
}

/** Every Lolly preset, in menu order - Pulse first because it's the default.
 *  Deliberately spread across characters: beat-reactive (pulse, radiate, bloom),
 *  flowing (tunnel, vortex, plasma), slow (aurora, ribbon, drift), and structural
 *  (lattice, spectrum), so auto-cycling keeps finding something different. */
export const VIZ_PRESETS: readonly VizPresetDef[] = [
  define('pulse', 'Brand Pulse', false, brandPulse),
  define('tunnel', 'Tunnel', false, tunnel),
  define('vortex', 'Vortex', false, vortex),
  define('kaleido', 'Kaleidoscope', false, kaleidoscope),
  define('aurora', 'Aurora', true, aurora),
  define('bloom', 'Bloom', false, bloom),
  define('lattice', 'Lattice', false, lattice),
  define('watercolour', 'Watercolour', true, watercolour),
  define('prism', 'Prism', false, prism),
  define('negative', 'Negative', false, negative),
  define('foil', 'Foil', false, foil),
  define('solar', 'Solar', false, solar),
  define('spectrum', 'Spectrum', true, spectrum),
  define('drift', 'Drift', true, drift),
];

/** Look up a preset by id, falling back to the first (Brand Pulse). */
export function vizPresetById(id: string | null | undefined): VizPresetDef {
  return VIZ_PRESETS.find((d) => d.id === id) ?? VIZ_PRESETS[0]!;
}

/** The preset to open with: the calmest one under reduced motion, else the default. */
export function defaultVizPresetId(reducedMotion: boolean): string {
  if (!reducedMotion) return VIZ_PRESETS[0]!.id;
  return (VIZ_PRESETS.find((d) => d.calm) ?? VIZ_PRESETS[0]!).id;
}

/**
 * The preset to cycle to after `current`. Under reduced motion it only ever offers
 * the calm ones - auto-cycling through Vortex would be exactly the motion that mode
 * exists to avoid. Sequential rather than random so the rotation is predictable and
 * every preset gets seen.
 */
export function nextVizPresetId(current: string, reducedMotion: boolean): string {
  const pool = reducedMotion ? VIZ_PRESETS.filter((d) => d.calm) : VIZ_PRESETS;
  if (pool.length === 0) return VIZ_PRESETS[0]!.id;
  const at = pool.findIndex((d) => d.id === current);
  return pool[(at + 1) % pool.length]!.id;
}
