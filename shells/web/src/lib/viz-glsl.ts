// SPDX-License-Identifier: MPL-2.0
/**
 * GLSL for the visualizer's presets - the part that closes the aesthetic gap.
 *
 * WHY THIS EXISTS. The first pass at these presets used only butterchurn's built-in
 * shader path (`warp: ''`, `comp: ''`) and steered everything through `baseVals` and
 * the per-frame equations. That is a much smaller expressive space than the stock
 * community presets have, and it showed: ~63% of those compute their colour in a
 * custom composite shader and ~65% carry a custom warp shader, which is where their
 * depth, texture and glow come from. No amount of `baseVals` tuning reaches it.
 *
 * WHAT BUTTERCHURN ACTUALLY WANTS. Despite MilkDrop's shaders being authored in an
 * HLSL dialect, butterchurn does NOT translate at load time - the community packs were
 * converted offline. `shaderUtils.getShaderParts` merely splits the source on
 * `shader_body { … }` and rewrites `texture2D`/`texture3D` to `texture`. Everything
 * else is inlined verbatim into a `#version 300 es` fragment shader. So a preset
 * shader is **plain GLSL ES 3.00**, and we can write it directly - no HLSL emulation,
 * no conversion step, and it type-checks as a normal template string.
 *
 * WHAT'S IN SCOPE for a shader body:
 *   out    `ret` (vec3) - the composite writes `vec4(ret, vColor.a)`
 *   coords `uv`, `uv_orig`, `rad`, `ang` (the warp shader gets rad/ang off `uv_orig`)
 *   images `sampler_main`, `sampler_blur1..3`, `sampler_noise_lq|_lq_lite|_mq|_hq`,
 *          `sampler_noisevol_lq|_hq` (3D)
 *   audio  `bass`, `mid`, `treb`, `vol` and their `_att` (time-smoothed) forms
 *   time   `time`, `frame`, `fps`
 *   ours   `q1`..`q32` - set by the preset's own `frame_eqs`, so audio/time logic stays
 *          in typed, testable TypeScript and the shader just consumes numbers
 *   sizes  `texsize` (xy = pixels, zw = 1/pixels), `aspect`, `resolution`
 *   comp only: `lum(vec3)`, `gammaAdj`, `echo_*`, `fShader`, `hue_shader`
 *   warp only: `decay`
 *
 * TWO TRAPS worth stating once:
 *  1. Referencing `sampler_blurN` is what MAKES blur exist - 
 *     `Renderer.getHighestBlur` greps the shader source for it and allocates that many
 *     blur passes. Free bloom, but only if you mention the sampler by name.
 *  2. The built-in warp body is `ret = texture(sampler_main, uv).rgb * decay;`. A
 *     custom warp shader REPLACES that, so it must multiply by `decay` itself or the
 *     feedback loop never fades and the screen saturates to white within a second.
 *
 * BRAND COLOUR. `brandRamp()` bakes the palette in as GLSL constants, and the comp
 * shaders map the accumulated field's LUMINANCE through it. That's the durable answer
 * to brand alignment: whatever hues the feedback loop mixes on its way round, the
 * final pixel is always a point on the brand's own ramp. It cannot drift off-brand.
 */
import type { VizPalette, VizRgb } from './viz-palette.ts';

/** A GLSL `vec3(…)` literal, at a fixed precision so shader text is deterministic
 *  (identical palettes produce identical source, which keeps compiles cacheable). */
function vec3(c: VizRgb): string {
  return `vec3(${c.map((v) => v.toFixed(4)).join(', ')})`;
}

/** A GLSL float literal that always carries a decimal point - `1` is an int in GLSL
 *  and will fail to compile where a float is expected. */
export function f(n: number): string {
  return Number.isFinite(n) ? n.toFixed(4) : '0.0';
}

/**
 * The shared header: the brand palette as constants, a ramp lookup, and helpers.
 * Prepended to every Lolly shader (both warp and comp), before `shader_body`.
 *
 * `brandRamp` is a chain of `mix`es rather than an array index: it's branchless,
 * needs no dynamic indexing into a const array (which drivers have historically been
 * uneven about), and reads as a straight piecewise lerp. Each `mix` past the active
 * segment clamps to 0 and is a no-op, so only one blend is ever partial.
 *
 * `lolLum` is ours because the composite shader defines `lum()` but the WARP shader
 * does not - one name that works in both avoids a redeclaration error in one and a
 * missing symbol in the other.
 */
export function brandGlslHeader(p: VizPalette, opts: { blur?: 0 | 1 | 2 | 3 } = {}): string {
  // Emit ONLY the blur helpers a shader will use. `Renderer.getHighestBlur` decides how
  // many blur passes to allocate by GREPPING the source for `sampler_blurN`, so a helper
  // sitting unused in the header silently costs a full render pass every frame. Declaring
  // the level per shader keeps that honest.
  const blur = opts.blur ?? 0;
  const blurHelpers = [
    'float lolBlur1(vec2 at) { return lolLum(texture(sampler_blur1, at).rgb * scale1 + bias1); }',
    'float lolBlur2(vec2 at) { return lolLum(texture(sampler_blur2, at).rgb * scale2 + bias2); }',
    'float lolBlur3(vec2 at) { return lolLum(texture(sampler_blur3, at).rgb * scale3 + bias3); }',
  ].slice(0, blur).join('\n');
  // The painterly gradient reads blur level 2, so it can only be offered at blur >= 2.
  const gradientHelper = blur >= 2 ? `
// Gradient of the BLURRED field -- the engine behind a painterly look. Taken on blur
// level 2 rather than the sharp image so it describes the broad shape of the picture
// instead of its noise. Displacing ALONG this vector makes the field flow downhill like
// wet pigment; displacing along its PERPENDICULAR makes it curl the way paint does in
// water. Aspect-corrected so the flow isn't stretched on a wide frame.
vec2 lolBlurGradient(vec2 at, float reach) {
  float gx = lolBlur2(at + vec2(reach, 0.0)) - lolBlur2(at - vec2(reach, 0.0));
  float gy = lolBlur2(at + vec2(0.0, reach)) - lolBlur2(at - vec2(0.0, reach));
  return vec2(gx, gy) * aspect.xy;
}` : '';
  const stops = p.ramp.length ? p.ramp : [p.deep, p.hero, p.tip];
  const segs = Math.max(1, stops.length - 1);
  const mixes = stops.slice(1)
    .map((c, i) => `  c = mix(c, ${vec3(c)}, clamp(t - ${f(i)}, 0.0, 1.0));`)
    .join('\n');
  return `
const vec3 BRAND_DEEPEST = ${vec3(p.deepest)};
const vec3 BRAND_DEEP    = ${vec3(p.deep)};
const vec3 BRAND_HERO    = ${vec3(p.hero)};
const vec3 BRAND_TIP     = ${vec3(p.tip)};
// A colour from a DIFFERENT part of the brand's wheel (SUSE: persimmon against jungle).
// Used as rim light / linework / accent - never interpolated into the ramp, because
// interpolating between distant hues is what makes off-brand mud.
const vec3 BRAND_CONTRAST = ${vec3(p.contrast)};

// Perceptual-ish luminance. Matches the composite shader's own lum() weights so a
// warp and a comp shader agree about how bright a pixel is.
float lolLum(vec3 v) { return dot(v, vec3(0.32, 0.49, 0.29)); }

// Sample the brand ramp. t wraps, so callers can feed an ever-increasing value.
vec3 brandRamp(float t) {
  t = fract(t) * ${f(segs)};
  vec3 c = ${vec3(stops[0]!)};
${mixes}
  return c;
}

// Map an intensity to the brand ramp WITHOUT wrapping - 0 is the dark end and 1 the
// light end. This is what keeps the picture on-brand no matter what the feedback loop
// mixed: colour is re-derived from brightness every frame rather than accumulated.
vec3 brandTone(float e) {
  e = clamp(e, 0.0, 1.0);
  return brandRamp(e * ${f((segs - 0.001) / segs)});
}

// Cheap value noise from the LQ noise texture, for grain and flow fields.
float lolNoise(vec2 p) { return texture(sampler_noise_lq, p).r; }

/**
 * Screen-space grain, sampled at roughly ONE noise texel per screen pixel.
 *
 * The obvious \`uv * texsize.xy\` is wrong and silently produces no grain at all:
 * texsize is the FRAMEBUFFER size, sampler_noise_lq is only 256x256, and butterchurn
 * binds it with generateMipmap + LINEAR_MIPMAP_LINEAR. Stepping ~100 texels per pixel
 * sends the sampler to the smallest mip, which is the texture's flat average - the term
 * survives compilation, costs a fetch, and contributes a constant.
 * texsize_noise_lq.zw is 1/noiseSize, so this converts pixels to texels properly.
 */
float lolGrain(vec2 at, vec2 drift) {
  return texture(sampler_noise_lq, at * texsize.xy * texsize_noise_lq.zw + drift).r;
}

// Evolving 3D noise: the third axis is time, so the field never repeats the way a
// scrolled 2D texture eventually does. 5% of the community shaders reach for this and
// it's what gives them a genuinely organic, non-looping texture.
float lolVolNoise(vec3 p) { return texture(sampler_noisevol_hq, p).r; }

// One texel, for neighbour taps. texsize.zw is (1/width, 1/height).
#define LOL_TEXEL texsize.zw

${blurHelpers}${gradientHelper}

// Sobel-ish edge magnitude from four neighbour taps. Texel-offset sampling like this is
// the single most common idiom in the community shaders (~56% of them) and it's what
// produces crisp linework rather than soft blur.
float lolEdge(vec2 at, float spread) {
  vec2 t = LOL_TEXEL * spread;
  float l = lolLum(texture(sampler_main, at - vec2(t.x, 0.0)).rgb);
  float r = lolLum(texture(sampler_main, at + vec2(t.x, 0.0)).rgb);
  float u = lolLum(texture(sampler_main, at - vec2(0.0, t.y)).rgb);
  float d = lolLum(texture(sampler_main, at + vec2(0.0, t.y)).rgb);
  return abs(r - l) + abs(d - u);
}

// Signed directional difference - relief/emboss rather than an unsigned outline.
float lolRelief(vec2 at, vec2 dir, float spread) {
  vec2 t = LOL_TEXEL * spread * dir;
  return lolLum(texture(sampler_main, at + t).rgb) - lolLum(texture(sampler_main, at - t).rgb);
}
`;
}

/** The optional intensity curves, emitted between the contrast shaping and the brand
 *  mapping. Solarize is applied before inversion so the two compose predictably. */
function toneCurve(opts: { invert?: boolean; solarize?: boolean }): string {
  const lines: string[] = [];
  if (opts.solarize) lines.push('  e = e * (1.0 - e) * 4.0;');
  if (opts.invert) lines.push('  e = 1.0 - e;');
  return lines.join('\n');
}

/** Compose a full shader source: our header, then the body inside `shader_body`. */
function compose(header: string, body: string): string {
  return `${header}\nshader_body {\n${body}\n}\n`;
}

// ── Composite shaders ────────────────────────────────────────────────────────

export interface CompOptions {
  /** Flip the intensity before the brand mapping, so bright regions take the ramp's DARK
   *  end. Not a colour inversion - the output stays on the brand ramp, it just reads the
   *  ramp backwards, which turns a glowing field into an inked one. */
  invert?: boolean;
  /** MilkDrop's solarize curve, `e * (1 - e) * 4`: midtones peak and BOTH ends fall to
   *  black, so the image resolves into bands. The built-in composite offers this via a
   *  baseVals flag, which our own composite replaces - so we implement it here. */
  solarize?: boolean;
  /** How much bloom the blur taps contribute. 0 disables them (and the blur passes). */
  glow?: number;
  /** Contrast curve on the intensity before the brand mapping. >1 darkens midtones,
   *  which is what stops the field reading as a grey haze. */
  contrast?: number;
  /** Film-grain strength. Small values only - this is texture, not noise. */
  grain?: number;
  /** Edge darkening, 0–1. Keeps a full-bleed field from feeling flat. */
  vignette?: number;
  /** Extra intensity lift, so a preset can be brighter without touching the palette. */
  lift?: number;
}

/**
 * The workhorse composite: take the accumulated field, add bloom from the blur
 * pyramid, shape the contrast, then re-colour the whole thing through the brand ramp.
 *
 * Re-deriving colour from luminance every frame is the important part. It means the
 * feedback loop can smear and mix as much as it likes and the output still lands on
 * the brand's ramp - brand alignment becomes structural rather than something the
 * per-frame equations have to keep getting right.
 */
export function compBrandTone(p: VizPalette, opts: CompOptions = {}): string {
  const {
    glow = 0.55, contrast = 1.35, grain = 0.02, vignette = 0.35, lift = 0.0,
    invert = false, solarize = false,
  } = opts;
  const curve = toneCurve({ invert, solarize });
  const glowTaps = glow > 0
    // Naming sampler_blur1/2 is what makes butterchurn allocate the blur passes.
    ? `  float g = lolBlur1(uv) * 0.62 + lolBlur2(uv) * 0.38;
  e += g * ${f(glow)};`
    : '';
  const grainTerm = grain > 0
    ? `  e += (lolGrain(uv, vec2(time * 0.7, -time * 0.5)) - 0.5) * ${f(grain)};`
    : '';
  const vignetteTerm = vignette > 0
    ? `  e *= 1.0 - ${f(vignette)} * smoothstep(0.25, 0.72, rad);`
    : '';
  return compose(brandGlslHeader(p, { blur: glow > 0 ? 2 : 0 }), `  vec3 src = texture(sampler_main, uv).rgb;
  float e = lolLum(src) + ${f(lift)};
${glowTaps}
${grainTerm}
${vignetteTerm}
  // q1 lets a preset push the whole field's exposure from its frame equations.
  e = pow(clamp(e * (1.0 + q1), 0.0, 1.0), ${f(contrast)});
${curve}
  ret = brandTone(e);
  // A touch of the source's own structure keeps fine detail from being flattened by
  // the luminance round-trip; too much and off-ramp colour creeps back in.
  ret = mix(ret, ret * (0.75 + 0.5 * src), 0.25);`);
}

/**
 * A composite with MilkDrop's video-echo doubling, brand-toned. The echo copy is
 * scaled and blended against the main one, which nests the image inside itself.
 * `q2` drives the echo scale so the nesting depth can breathe with the music.
 */
export function compBrandEcho(p: VizPalette, opts: CompOptions = {}): string {
  const { glow = 0.4, contrast = 1.25, grain = 0.015, vignette = 0.3 } = opts;
  return compose(brandGlslHeader(p, { blur: 2 }), `  float z = 1.0 + q2;
  vec2 uv_echo = (uv - 0.5) * (1.0 / max(z, 0.05)) + 0.5;
  vec3 a = texture(sampler_main, uv).rgb;
  vec3 b = texture(sampler_main, uv_echo).rgb;
  vec3 src = mix(a, b, 0.45);
  float e = lolLum(src);
  float g = lolBlur1(uv) * 0.6 + lolBlur2(uv) * 0.4;
  e += g * ${f(glow)};
  e += (lolGrain(uv, vec2(time * 0.4, time * 0.3)) - 0.5) * ${f(grain)};
  e *= 1.0 - ${f(vignette)} * smoothstep(0.25, 0.75, rad);
  e = pow(clamp(e * (1.0 + q1), 0.0, 1.0), ${f(contrast)});
  ret = brandTone(e);`);
}

/**
 * A composite that splits the brand ramp by RADIUS as well as brightness, so the
 * centre and the rim sit at different points on the palette. Gives a preset an
 * obvious focal point instead of a uniform wash.
 */
export function compBrandRadial(p: VizPalette, opts: CompOptions = {}): string {
  const { glow = 0.5, contrast = 1.3, grain = 0.018 } = opts;
  return compose(brandGlslHeader(p, { blur: 3 }), `  vec3 src = texture(sampler_main, uv).rgb;
  float e = lolLum(src);
  float g = lolBlur1(uv) * 0.58 + lolBlur3(uv) * 0.42;
  e += g * ${f(glow)};
  e += (lolGrain(uv, vec2(-time * 0.6)) - 0.5) * ${f(grain)};
  e = pow(clamp(e * (1.0 + q1), 0.0, 1.0), ${f(contrast)});
  // Pull the rim towards the ramp's dark end and lift the core towards its light end.
  float shift = (0.5 - rad) * 0.55;
  ret = brandTone(clamp(e + shift, 0.0, 1.0));
  // A thin brand-hero rim light where intensity changes fastest reads as an edge.
  float edge = abs(e - lolBlur1(uv));
  ret += BRAND_TIP * edge * 0.35;`);
}

// ── Warp shaders ─────────────────────────────────────────────────────────────

export interface WarpOptions {
  /** How far the noise field displaces the sampled previous frame, in UV units. */
  strength?: number;
  /** Spatial frequency of the flow field. Higher = finer, more turbulent detail. */
  scale?: number;
  /** Rotational component, so the flow curls rather than just pushing. */
  swirl?: number;
}

/**
 * A noise-driven flow warp: displace where the previous frame is sampled from, which
 * makes the feedback loop churn with organic detail instead of merely zooming. This
 * is the single biggest contributor to the "real MilkDrop" texture.
 *
 * MUST multiply by `decay` - a custom warp shader replaces butterchurn's built-in
 * `ret = texture(sampler_main, uv).rgb * decay;`, so omitting it means trails never
 * fade and the field blows out to white almost immediately.
 *
 * `q3` scales the displacement per-frame, so audio reactivity lives in TypeScript.
 */
export function warpBrandFlow(p: VizPalette, opts: WarpOptions = {}): string {
  const { strength = 0.006, scale = 2.2, swirl = 0.5 } = opts;
  return compose(brandGlslHeader(p, { blur: 0 }), `  vec2 n = uv * ${f(scale)} + vec2(time * 0.05, time * -0.04);
  float nx = lolNoise(n);
  float ny = lolNoise(n + vec2(0.37, 0.71));
  vec2 flow = vec2(nx - 0.5, ny - 0.5) * 2.0;
  // Curl the flow around the centre so it spirals instead of drifting one way.
  vec2 tangent = vec2(-(uv.y - 0.5), uv.x - 0.5);
  flow += tangent * ${f(swirl)} * (nx - 0.5);
  vec2 d = flow * ${f(strength)} * (1.0 + q3);
  ret = texture(sampler_main, uv + d).rgb * decay;`);
}

/**
 * A radial warp: displacement runs along the radius, accelerating outward, which
 * reads as depth. Pairs with the Tunnel preset's zoom.
 */
export function warpBrandRadial(p: VizPalette, opts: WarpOptions = {}): string {
  const { strength = 0.008, scale = 3.0 } = opts;
  return compose(brandGlslHeader(p, { blur: 0 }), `  vec2 dir = normalize(uv - 0.5 + vec2(1e-5));
  float turb = lolNoise(vec2(ang * ${f(scale)}, rad * ${f(scale)} - time * 0.15)) - 0.5;
  // Displace along the radius, harder further out - the depth cue.
  vec2 d = dir * (turb * ${f(strength)} * (1.0 + q3)) * (0.4 + rad * 1.8);
  ret = texture(sampler_main, uv + d).rgb * decay;`);
}

/**
 * Volume-noise flow: the displacement field evolves along a THIRD axis (time) instead of
 * scrolling a 2D texture, so it never settles into a repeat. Learned from the community
 * shaders that reach for `sampler_noisevol_*`; visually the most organic of the warps.
 */
export function warpBrandVolume(p: VizPalette, opts: WarpOptions = {}): string {
  const { strength = 0.009, scale = 1.4 } = opts;
  return compose(brandGlslHeader(p, { blur: 0 }), `  vec3 n = vec3(uv * ${f(scale)}, time * 0.06);
  float a = lolVolNoise(n);
  float b = lolVolNoise(n + vec3(0.41, 0.19, 0.27));
  vec2 d = (vec2(a, b) - 0.5) * 2.0 * ${f(strength)} * (1.0 + q3);
  ret = texture(sampler_main, uv + d).rgb * decay;`);
}

/**
 * Tiling warp: samples through the WRAPPED sampler, so content leaving one edge reappears
 * at the opposite one and the field reads as an endless pattern rather than a framed
 * image. (`sampler_fw_main` is the same texture as `sampler_main` bound with
 * REPEAT instead of the default - MilkDrop's F/P × W/C sampler set.)
 */
export function warpBrandTile(p: VizPalette, opts: WarpOptions = {}): string {
  const { strength = 0.004, scale = 2.0, swirl = 0.8 } = opts;
  return compose(brandGlslHeader(p, { blur: 0 }), `  vec2 c = uv - 0.5;
  vec2 tangent = vec2(-c.y, c.x);
  float n = lolNoise(uv * ${f(scale)} + vec2(time * 0.03, 0.0)) - 0.5;
  vec2 d = (tangent * ${f(swirl)} + vec2(n)) * ${f(strength)} * (1.0 + q3);
  ret = texture(sampler_fw_main, uv + d).rgb * decay;`);
}

/** The plain warp - identical to butterchurn's built-in, but routed through our
 *  header so a preset can switch to a custom warp without restructuring. */
export function warpPlain(p: VizPalette): string {
  return compose(brandGlslHeader(p, { blur: 0 }), '  ret = texture(sampler_main, uv).rgb * decay;');
}

// ── Technique-distinct composites ────────────────────────────────────────────
// These exist so presets differ in KIND, not just in parameters. Each is built around a
// different idiom drawn from the community shaders, so switching preset changes the
// character of the image rather than its settings.

/**
 * Edge/linework: neighbour taps give a Sobel-ish outline, drawn in the CONTRAST colour
 * over a dimmed brand field. Crisp and graphic - the opposite end of the range from the
 * soft bloom presets, and the idiom ~56% of the community shaders use.
 */
export function compBrandEdge(p: VizPalette, opts: CompOptions & { spread?: number; ink?: number } = {}): string {
  const {
    contrast = 1.3, grain = 0.012, vignette = 0.3, spread = 1.4, ink = 2.2,
    invert = false, solarize = false,
  } = opts;
  const curve = toneCurve({ invert, solarize });
  return compose(brandGlslHeader(p, { blur: 0 }), `  float base = lolLum(texture(sampler_main, uv).rgb);
  float edge = lolEdge(uv, ${f(spread)}) * ${f(ink)};
  float e = base * 0.55;
  e += (lolGrain(uv, vec2(time * 0.6)) - 0.5) * ${f(grain)};
  e *= 1.0 - ${f(vignette)} * smoothstep(0.25, 0.75, rad);
  e = pow(clamp(e * (1.0 + q1), 0.0, 1.0), ${f(contrast)});
${curve}
  ret = brandTone(e);
  // Linework in the opposite hue - this is what makes the preset read as drawn.
  ret += BRAND_CONTRAST * clamp(edge, 0.0, 1.2);`);
}

/**
 * Relief/emboss: a signed directional difference lit from a rotating angle, so the field
 * looks like brushed metal catching light. Reads as a surface rather than as a glow.
 */
export function compBrandRelief(p: VizPalette, opts: CompOptions & { depth?: number } = {}): string {
  const { contrast = 1.15, vignette = 0.34, depth = 3.0 } = opts;
  return compose(brandGlslHeader(p, { blur: 0 }), `  // q4 rotates the light; the preset's equations own the sweep.
  vec2 lightDir = vec2(cos(q4), sin(q4));
  float relief = lolRelief(uv, lightDir, 1.6) * ${f(depth)};
  float base = lolLum(texture(sampler_main, uv).rgb);
  float e = base * 0.7 + relief * 0.5 + 0.12;
  e *= 1.0 - ${f(vignette)} * smoothstep(0.3, 0.8, rad);
  e = pow(clamp(e * (1.0 + q1), 0.0, 1.0), ${f(contrast)});
  ret = brandTone(e);
  // Specular glint along the lit side only, in the contrast hue.
  ret += BRAND_CONTRAST * clamp(relief, 0.0, 1.0) * 0.4;`);
}

/**
 * Radial streaks: several taps marched toward the centre and accumulated, which smears
 * bright areas into light rays. The multi-tap loop idiom, used by only ~2% of the
 * community shaders but visually unmistakable.
 */
export function compBrandStreak(p: VizPalette, opts: CompOptions & { taps?: number; reach?: number } = {}): string {
  const { contrast = 1.3, vignette = 0.2, taps = 10, reach = 0.28 } = opts;
  return compose(brandGlslHeader(p, { blur: 1 }), `  vec2 toCentre = (0.5 - uv) * ${f(reach)} * (1.0 + q5);
  float acc = 0.0;
  float wsum = 0.0;
  // Constant loop bound: GLSL ES 3.0 wants the count knowable at compile time.
  for (int i = 0; i < ${Math.round(taps)}; i++) {
    float t = float(i) / ${f(Math.max(1, taps - 1))};
    float w = 1.0 - t;
    acc += lolLum(texture(sampler_main, uv + toCentre * t).rgb) * w;
    wsum += w;
  }
  float e = acc / max(wsum, 0.001);
  e += lolBlur1(uv) * 0.35;
  e *= 1.0 - ${f(vignette)} * smoothstep(0.35, 0.9, rad);
  e = pow(clamp(e * (1.0 + q1), 0.0, 1.0), ${f(contrast)});
  ret = brandTone(e);
  // Rays pick up the contrast hue where they are strongest.
  ret = mix(ret, BRAND_CONTRAST, clamp(e - 0.72, 0.0, 1.0) * 0.5);`);
}

/**
 * Volume-noise clouds: 3D noise modulates the tone directly, so the field billows and
 * evolves instead of flowing in one direction. The softest, slowest-reading of the set.
 */
export function compBrandClouds(p: VizPalette, opts: CompOptions & { scale?: number } = {}): string {
  const { glow = 0.7, contrast = 1.1, vignette = 0.4, scale = 1.8 } = opts;
  return compose(brandGlslHeader(p, { blur: 3 }), `  float base = lolLum(texture(sampler_main, uv).rgb);
  float cloud = lolVolNoise(vec3(uv * ${f(scale)}, time * 0.05));
  float g = lolBlur2(uv) * 0.5 + lolBlur3(uv) * 0.5;
  float e = base * 0.6 + cloud * 0.34 + g * ${f(glow)};
  e *= 1.0 - ${f(vignette)} * smoothstep(0.2, 0.85, rad);
  e = pow(clamp(e * (1.0 + q1), 0.0, 1.0), ${f(contrast)});
  ret = brandTone(e);
  // A wash of the contrast hue in the densest parts, so it isn't monochrome.
  ret = mix(ret, ret * 0.6 + BRAND_CONTRAST * 0.5, clamp(cloud - 0.6, 0.0, 1.0));`);
}

/**
 * Mosaic: quantise the coordinates and sample through the POINT (nearest) sampler, so the
 * field resolves into hard cells. Uses MilkDrop's `sampler_pc_main` - same texture as
 * `sampler_main`, bound with NEAREST + CLAMP - which is what keeps the cells crisp
 * instead of interpolating them back into a blur.
 */
export function compBrandMosaic(p: VizPalette, opts: CompOptions & { cells?: number } = {}): string {
  const { contrast = 1.25, vignette = 0.26, cells = 64, glow = 0.4 } = opts;
  return compose(brandGlslHeader(p, { blur: glow > 0 ? 1 : 0 }), `  // q6 breathes the cell count so the grid pulses with the music.
  // Floored: q6 comes from a preset's equations, and n == 0 would put Inf/NaN into the
  // sample coordinate for every pixel.
  float n = max(${f(cells)} * (1.0 + q6), 4.0);
  vec2 cell = (floor(uv * n) + 0.5) / n;
  float e = lolLum(texture(sampler_pc_main, cell).rgb);
  e += lolBlur1(cell) * ${f(glow)};
  e *= 1.0 - ${f(vignette)} * smoothstep(0.3, 0.9, rad);
  e = pow(clamp(e * (1.0 + q1), 0.0, 1.0), ${f(contrast)});
  ret = brandTone(e);
  // Cell gridlines in the contrast hue give the mosaic an edge.
  vec2 g2 = abs(fract(uv * n) - 0.5);
  float line = smoothstep(0.46, 0.5, max(g2.x, g2.y));
  ret += BRAND_CONTRAST * line * 0.16 * e;`);
}

/**
 * Bump-mapped lighting: build a surface normal from the luminance gradient and light it
 * with a moving vector, so the field reads as a physical, three-dimensional surface
 * rather than as a glow. This is the technique behind MilkDrop's metallic/foil presets,
 * and it is a step beyond `compBrandRelief` - that takes one signed difference along a
 * direction, whereas this reconstructs a real normal and does Lambertian plus specular.
 *
 * `q4` rotates the light (shared with compBrandRelief), `q7` tilts its elevation.
 */
export function compBrandBump(p: VizPalette, opts: CompOptions & { depth?: number; shine?: number } = {}): string {
  const {
    contrast = 1.05, vignette = 0.32, depth = 6.0, shine = 0.55,
    invert = false, solarize = false,
  } = opts;
  const curve = toneCurve({ invert, solarize });
  return compose(brandGlslHeader(p, { blur: 0 }), `  vec2 t = LOL_TEXEL * 1.5;
  // Central differences on luminance give the height field's slope in each axis.
  float hx = lolLum(texture(sampler_main, uv + vec2(t.x, 0.0)).rgb)
           - lolLum(texture(sampler_main, uv - vec2(t.x, 0.0)).rgb);
  float hy = lolLum(texture(sampler_main, uv + vec2(0.0, t.y)).rgb)
           - lolLum(texture(sampler_main, uv - vec2(0.0, t.y)).rgb);
  // Slope -> normal. The z term is what sets how pronounced the relief looks.
  vec3 nrm = normalize(vec3(-hx * ${f(depth)}, -hy * ${f(depth)}, 1.0));
  // Light orbits on q4 with its elevation on q7; both come from the preset's equations.
  vec3 lightDir = normalize(vec3(cos(q4), sin(q4), 0.45 + 0.5 * q7));
  float diffuse = max(dot(nrm, lightDir), 0.0);
  // Blinn-ish specular against a fixed view direction.
  vec3 halfway = normalize(lightDir + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(nrm, halfway), 0.0), 24.0);
  float base = lolLum(texture(sampler_main, uv).rgb);
  float e = base * 0.5 + diffuse * 0.5;
  e *= 1.0 - ${f(vignette)} * smoothstep(0.3, 0.85, rad);
  e = pow(clamp(e * (1.0 + q1), 0.0, 1.0), ${f(contrast)});
${curve}
  ret = brandTone(e);
  // The highlight takes the CONTRAST hue, which is what makes it read as a lit surface
  // rather than simply a brighter patch of the same colour.
  ret += BRAND_CONTRAST * spec * ${f(shine)};`);
}

// ── Painterly / watercolour ──────────────────────────────────────────────────
// Technique studied from the community's painterly presets (the Aderrasi "Wanderer in
// Curved Space" lineage). Four things make wet paint rather than a blur:
//   1. flow ALONG the gradient of a BLURRED copy - pigment migrating downhill;
//   2. flow along that gradient's PERPENDICULAR - the curl that makes paint swirl in
//      water instead of merely bleeding outward;
//   3. an unsharp mask against a LARGER blur - edges gain a dark rim, which is the
//      pooling that reads unmistakably as watercolour;
//   4. a tiny constant lift, so the wash keeps breathing instead of draining to black.
// Written in our own terms and brand-toned; the idea is theirs, the expression is ours.

export interface WatercolourOptions {
  /** How far the pigment migrates along the gradient each frame. */
  bleed?: number;
  /** How much of the flow is rotational rather than downhill. */
  curl?: number;
  /** Unsharp strength - the dark rim that pools at edges. */
  pool?: number;
  /** Constant lift that keeps the wash alive. Very small. */
  lift?: number;
  /** Offset used when differencing the blurred field. Larger = broader, softer flow. */
  reach?: number;
}

/**
 * The watercolour WARP: bleed + curl + edge pooling. Samples through the wrapped sampler
 * so the wash can run off one edge and back in the other rather than piling at a border.
 * `q3` scales the whole displacement from the preset's equations.
 */
export function warpBrandWatercolour(p: VizPalette, opts: WatercolourOptions = {}): string {
  const { bleed = 0.011, curl = 0.5, pool = 0.14, lift = 0.003, reach = 0.005 } = opts;
  return compose(brandGlslHeader(p, { blur: 3 }), `  vec2 g = lolBlurGradient(uv, ${f(reach)});
  // Downhill, plus its perpendicular for rotation.
  vec2 flow = -g * ${f(bleed)} + vec2(g.y, -g.x) * ${f(curl)} * ${f(bleed)};
  vec2 at = uv + flow * (1.0 + q3);
  vec3 src = texture(sampler_fw_main, at).rgb;
  // Unsharp against a LARGER blur: edges gain a dark rim, the way pigment pools.
  float sharp = lolLum(src) - lolBlur3(at);
  vec3 pooled = src + src * sharp * ${f(pool)};
  ret = (pooled + ${f(lift)}) * decay;`);
}

/**
 * The watercolour COMPOSITE: a blur-dominant wash with a soft paper grain, edge pooling
 * kept visible, then mapped onto the brand ramp and pulled slightly toward a muted paper
 * tone. That last step stands in for the community presets' per-channel luminance mixing
 * - the same muting effect, expressed against the brand's ramp rather than raw RGB, so it
 * cannot drift off-brand.
 */
export function compBrandWatercolour(p: VizPalette, opts: CompOptions & { wash?: number; paper?: number } = {}): string {
  const { contrast = 1.12, vignette = 0.34, grain = 0.02, wash = 0.55, paper = 0.22 } = opts;
  return compose(brandGlslHeader(p, { blur: 3 }), `  float sharpL = lolLum(texture(sampler_main, uv).rgb);
  // Blur-dominant: a wash is mostly its soft body, with only a little structure.
  float body = lolBlur1(uv) * 0.45 + lolBlur2(uv) * 0.35 + lolBlur3(uv) * 0.20;
  float e = mix(sharpL, body, ${f(wash)});
  // Pooling: edges DARKEN, which is the opposite of a glow and the whole watercolour tell.
  float rim = abs(sharpL - body);
  e -= rim * 0.55;
  // Paper tooth, at one noise texel per pixel so it actually resolves.
  e += (lolGrain(uv, vec2(time * 0.02, time * 0.013)) - 0.5) * ${f(grain)};
  e *= 1.0 - ${f(vignette)} * smoothstep(0.2, 0.9, rad);
  e = pow(clamp(e * (1.0 + q1), 0.0, 1.0), ${f(contrast)});
  ret = brandTone(e);
  // Muted, like pigment soaked into paper rather than light on a screen.
  vec3 pulp = mix(BRAND_DEEP, BRAND_TIP, e);
  ret = mix(ret, pulp, ${f(paper)});
  // Pigment gathers in the rims, tinted with the counterpoint hue.
  ret = mix(ret, ret * 0.55 + BRAND_CONTRAST * 0.3, clamp(rim * 2.4, 0.0, 0.6));`);
}

/**
 * Prism: a radial chromatic split. The field is sampled at three slightly different radii
 * and each tap is mapped to a DIFFERENT point on the brand ramp, so edges fringe into the
 * palette the way light splits through glass.
 *
 * This is the one composite that reads the ramp at more than one position per pixel, which
 * is why it looks unlike anything else in the set - and because all three positions are on
 * the brand's own ramp, the fringing stays on-brand instead of going rainbow.
 *
 * `q8` drives the split width from the preset's equations.
 */
export function compBrandPrism(p: VizPalette, opts: CompOptions & { split?: number } = {}): string {
  const {
    contrast = 1.2, vignette = 0.3, grain = 0.014, glow = 0.4, split = 0.006,
    invert = false, solarize = false,
  } = opts;
  const curve = toneCurve({ invert, solarize });
  return compose(brandGlslHeader(p, { blur: glow > 0 ? 1 : 0 }), `  // Split along the radius, widening towards the rim like real lens dispersion.
  vec2 dir = normalize(uv - 0.5 + vec2(1e-5));
  float amt = ${f(split)} * (1.0 + q8) * (0.35 + rad);
  float a = lolLum(texture(sampler_main, uv - dir * amt).rgb);
  float b = lolLum(texture(sampler_main, uv).rgb);
  float c = lolLum(texture(sampler_main, uv + dir * amt).rgb);
${glow > 0 ? `  float g = lolBlur1(uv) * ${f(glow)};
  a += g; b += g; c += g;` : ''}
  float e = (a + b + c) / 3.0;
  e += (lolGrain(uv, vec2(time * 0.5, -time * 0.4)) - 0.5) * ${f(grain)};
  e *= 1.0 - ${f(vignette)} * smoothstep(0.25, 0.85, rad);
  e = pow(clamp(e * (1.0 + q1), 0.0, 1.0), ${f(contrast)});
${curve}
  // Each tap reads the ramp at its own offset - the fringe, kept inside the palette.
  vec3 lo = brandTone(clamp(a - 0.06, 0.0, 1.0));
  vec3 hi = brandTone(clamp(c + 0.06, 0.0, 1.0));
  ret = brandTone(e) * 0.55 + lo * 0.22 + hi * 0.23;
  // Where the three taps disagree most, lean into the counterpoint hue.
  ret = mix(ret, BRAND_CONTRAST, clamp(abs(c - a) * 1.8, 0.0, 0.45));`);
}
