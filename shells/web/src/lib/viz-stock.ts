// SPDX-License-Identifier: MPL-2.0
/**
 * The artist MilkDrop presets - community work, run as authored, with the brand's colours
 * pushed through them.
 *
 * WHY THESE EXIST ALONGSIDE OURS. The community presets (Geiss, Flexi, Rovastar, Aderrasi,
 * martin and ~110 others) are twenty years of accumulated craft: camera moves, overlay
 * elements and layered effects well beyond what our hand-authored set reaches. Ours stay
 * for guaranteed brand fidelity and a licence-clean default; these are the range.
 *
 * PROVENANCE. Never committed to this repo. `scripts/copy-viz-presets.ts` stages a curated
 * selection out of the `butterchurn-presets` dependency at build time into a gitignored
 * public directory, and `scripts/viz-preset-list.json` holds identifiers only. So the
 * dependency declares provenance rather than our source tree absorbing it. A clone without
 * the dependency installed simply gets an empty artist list and the brand-native presets.
 *
 * BRAND INFLUENCE - the technique that makes this work. These presets compute their colour
 * inside their own composite shaders, so `baseVals` overrides are ignored and any
 * after-the-fact tint just flattens them. Instead we WRAP the shader: our brand header goes
 * before theirs, their body runs untouched, and a blend toward the brand ramp is appended
 * as the last statement. Verified across the whole pack - every one of the 1122 composite
 * shaders assigns `ret` in its body, so there is always something to blend.
 *
 *   [our header: BRAND_* consts, brandRamp, brandTone, lolLum]
 *   [their header, verbatim]
 *   shader_body { [their body, verbatim] ret = <brand blend>; }
 *
 * The blend keeps their luminance structure - which is where the motion and the modelling
 * live - and drives hue and saturation from the brand. Deliberately allowed to push past
 * "tasteful": Andy's brief is that the brand should INFLUENCE these, not merely tint them,
 * and over- or under-saturation is fine in service of that.
 *
 * COST TO KNOW: these carry their equations as source strings, so butterchurn compiles them
 * with `new Function`. That reintroduces the `unsafe-eval` dependency our own presets avoid
 * (see lib/viz-presets.ts). Nothing breaks today - the shell sets no CSP - but a future
 * `script-src` would have to exempt the visualizer or drop this list.
 */
import { brandGlslHeader } from './viz-glsl.ts';
import type { VizPalette } from './viz-palette.ts';
import type { MdVars, VizPreset } from './viz-presets.ts';

/** Where copy-viz-presets.ts stages the pack. */
const BASE = '/viz-presets';

export interface StockPresetInfo {
  id: string;
  name: string;
  author: string;
  /** In butterchurn's minimal pack - the 29 butterchurnviz.com opens with. */
  popular: boolean;
  /**
   * Popularity tier, 1 (best) … 6. Which of butterchurn's own packs ships a preset is the
   * only real popularity signal that exists for MilkDrop - there is no download count or
   * rating - and the packs were chosen by people who know the corpus:
   * 1 minimal, 2 the rest of the default pack, 3 extra, 4 extra2, 5 the MilkDrop 1
   * originals, 6 in no pack at all (kept only so an id already in someone's saved session
   * keeps resolving). Sort by this; `popular` is just `tier === 1`.
   * Optional because an index staged before tiers existed does not carry it.
   */
  tier?: number;
  /**
   * False for a preset that was measured rendering nothing usable - pure black, or blown
   * out to a flat white field. Do not OFFER these in a picker or include them in a cycle;
   * they are still staged and still resolve by id, because an id already saved in someone's
   * session has to keep working.
   *
   * Pack membership says a preset is admired, not that it renders: 31 of the 452 fail, and
   * they fail identically with the brand wrapper bypassed, so this is how butterchurn draws
   * them rather than something the brand blend does. The blacks are pure feedback
   * amplifiers with no light source - they come alive only by inheriting the previous
   * preset's field, which means they can look fine in a cycling overlay and render black in
   * an export, which always starts cold.
   *
   * Optional for the same reason as `tier`; treat a missing value as true.
   */
  ok?: boolean;
  /**
   * Measured mean luminance, 0..255, on a real GPU with the brand wrapper bypassed.
   *
   * Distinct from `ok`, which only rules out the pure blacks and the blown-out whites. A
   * FIFTH of the presets that pass that gate still measure under 25 - sparse wireframes
   * that are perfectly good once you have chosen them and a poor thing to hand someone
   * unasked, because a near-black field is indistinguishable from a visualiser that
   * failed to start. Use it to weight what opens, never to hide anything: every preset
   * stays reachable by stepping, and one already saved in a cover must keep resolving.
   *
   * Optional for the same reason as `tier` - an index staged before it existed omits it.
   */
  luma?: number;
}

/**
 * How strongly the brand overrides the artist's colour. `off` runs them exactly as
 * authored; `full` reads colour almost entirely from the brand ramp and keeps only their
 * luminance structure. `strong` is the default because the brief is influence, not tint.
 */
export type BrandTint = 'off' | 'subtle' | 'strong' | 'full';
export const BRAND_TINTS: readonly BrandTint[] = ['off', 'subtle', 'strong', 'full'];
const TINT_MIX: Record<BrandTint, number> = { off: 0, subtle: 0.35, strong: 0.7, full: 0.94 };

/** The shape a converted community preset arrives in. Equations are SOURCE STRINGS here - 
 *  unlike our own presets, whose equations are real functions. */
interface StockPresetJson {
  baseVals?: Record<string, number>;
  shapes?: unknown[];
  waves?: unknown[];
  warp?: string;
  comp?: string;
  init_eqs_str?: string;
  frame_eqs_str?: string;
  pixel_eqs_str?: string;
  [k: string]: unknown;
}

let indexPromise: Promise<StockPresetInfo[]> | null = null;

/**
 * The staged artist presets. Resolves to an empty list when the pack isn't present - a
 * clone that skipped the dependency, or a deploy that didn't run the prebuild - so every
 * caller must cope with there being none.
 */
export function stockPresetIndex(): Promise<StockPresetInfo[]> {
  indexPromise ??= fetch(`${BASE}/index.json`)
    .then((r) => (r.ok ? r.json() as Promise<StockPresetInfo[]> : []))
    .then((list) => (Array.isArray(list) ? list : []))
    .catch(() => []);
  return indexPromise;
}

// One preset is ~4 KB, and switching back and forth is common; caching the parsed JSON
// avoids a refetch per cycle without ever holding the whole 12 MB pack.
const cache = new Map<string, StockPresetJson>();

async function fetchStock(id: string): Promise<StockPresetJson | null> {
  const hit = cache.get(id);
  if (hit) return hit;
  try {
    const r = await fetch(`${BASE}/${encodeURIComponent(id)}.json`);
    if (!r.ok) return null;
    const json = await r.json() as StockPresetJson;
    cache.set(id, json);
    return json;
  } catch {
    return null;
  }
}

/**
 * The blend appended as the final statement of a composite shader.
 *
 * `brandTone(lolLum(ret))` re-reads the artist's own brightness through the brand ramp, so
 * their modelling survives and only the palette changes. Saturation is then pushed past the
 * ramp deliberately (`* (0.85 + 0.5 * l)` plus a contrast-hue lift on highlights) because
 * the brief is that the brand should influence the image, and a strictly in-gamut mix reads
 * as a wash rather than as a recolour.
 */
function brandBlend(mix: number): string {
  if (mix <= 0) return '';
  return `
  {
    float lolL = lolLum(ret);
    vec3 lolBrand = brandTone(lolL) * (0.85 + 0.5 * lolL);
    // Highlights pick up the counterpoint hue, which is what stops a strong mix from
    // looking monochrome once the artist's own hue variety is overridden.
    lolBrand += BRAND_CONTRAST * clamp(lolL - 0.68, 0.0, 1.0) * 0.55;
    ret = mix(ret, lolBrand, ${mix.toFixed(3)});
  }`;
}

/**
 * butterchurn's BUILT-IN composite, reproduced so a preset that ships no `comp` of its own
 * can still be brand-influenced. 632 of the pack have no composite shader and would
 * otherwise fall through to the engine's internal path, where there is nothing to append
 * to. Mirrors the engine's own default body (echo blend, gamma, hue shader, then the
 * brighten/darken/solarize/invert flags) so those presets look unchanged at `off`.
 */
const BUILT_IN_COMP = `
  float lolOrientH = mod(echo_orientation, 2.0);
  vec2 lolEchoUv = ((uv - 0.5) * (1.0 / echo_zoom)
    * vec2(lolOrientH != 0.0 ? -1.0 : 1.0, echo_orientation >= 2.0 ? -1.0 : 1.0)) + 0.5;
  ret = mix(texture(sampler_main, uv).rgb, texture(sampler_main, lolEchoUv).rgb, echo_alpha);
  ret *= gammaAdj;
  if (fShader >= 1.0) ret *= hue_shader;
  else if (fShader > 0.001) ret *= (1.0 - fShader) + (fShader * hue_shader);
  if (brighten != 0) ret = sqrt(ret);
  if (darken != 0) ret = ret * ret;
  if (solarize != 0) ret = ret * (1.0 - ret) * 4.0;
  if (invert != 0) ret = 1.0 - ret;`;

/**
 * Wrap an artist composite shader so the brand gets the last word.
 *
 * `shaderUtils.getShaderParts` splits on `shader_body` and takes everything between the
 * FIRST `{` and the LAST `}`, so appending inside that outermost block is safe even for
 * shaders with nested braces. Their header (anything before `shader_body`) is preserved
 * ahead of the body, after ours.
 */
export function wrapCompShader(comp: string | undefined, palette: VizPalette, mix: number): string {
  const blend = brandBlend(mix);
  // Our header must declare a blur level of 0: the artist's own shader requests whatever
  // blur it needs by naming the samplers itself, and adding unused helpers would make
  // getHighestBlur allocate passes nobody reads.
  const ourHeader = brandGlslHeader(palette, { blur: 0 });
  const src = (comp ?? '').trim();
  if (!src) {
    // No composite of their own - supply the engine's default and blend onto it.
    return `${ourHeader}\nshader_body {\n${BUILT_IN_COMP}\n${blend}\n}\n`;
  }
  const marker = src.indexOf('shader_body');
  if (marker === -1) {
    // Bodies without the marker are treated by butterchurn as a bare body.
    return `${ourHeader}\nshader_body {\n${src}\n${blend}\n}\n`;
  }
  const theirHeader = src.slice(0, marker);
  const rest = src.slice(marker);
  const open = rest.indexOf('{');
  const close = rest.lastIndexOf('}');
  if (open === -1 || close <= open) {
    return `${ourHeader}\nshader_body {\n${src}\n${blend}\n}\n`;
  }
  const body = rest.slice(open + 1, close);
  return `${ourHeader}\n${theirHeader}\nshader_body {\n${body}\n${blend}\n}\n`;
}

/**
 * Load an artist preset, brand-influenced, in the shape butterchurn wants.
 *
 * Their equations stay as `*_eqs_str` strings so butterchurn compiles them itself - we do
 * NOT convert them to functions, because that string path is exactly what runs their
 * authored behaviour. Shapes and waves pass through untouched: they already carry the four
 * slots the renderer indexes, since every converted preset does.
 *
 * Returns null when the pack isn't staged or the file is missing, so callers can fall back
 * to a brand-native preset rather than showing a black frame.
 */
export async function loadStockPreset(
  id: string,
  palette: VizPalette,
  tint: BrandTint,
): Promise<VizPreset | null> {
  const json = await fetchStock(id);
  if (!json) return null;
  const mix = TINT_MIX[tint] ?? TINT_MIX.strong;
  return {
    ...(json as unknown as VizPreset),
    baseVals: { ...(json.baseVals ?? {}) },
    // `warp` is left exactly as authored - it shapes motion, not colour, and it is where
    // the camera moves these are wanted for actually live.
    warp: (json.warp ?? '').trim(),
    comp: wrapCompShader(json.comp, palette, mix),
    shapes: (json.shapes ?? []) as VizPreset['shapes'],
    waves: (json.waves ?? []) as VizPreset['waves'],
    // Not real functions: butterchurn sees `typeof init_eqs !== 'function'` and compiles
    // the *_eqs_str strings, which is the authored path for these.
    init_eqs: undefined as unknown as (m: MdVars) => MdVars,
    frame_eqs: undefined as unknown as (m: MdVars) => MdVars,
    pixel_eqs: '' as VizPreset['pixel_eqs'],
  };
}

/** Read/write the saved tint. */
const TINT_KEY = 'lolly:vizBrandTint';
export function readBrandTint(): BrandTint {
  try {
    const v = localStorage.getItem(TINT_KEY);
    if (v && (BRAND_TINTS as readonly string[]).includes(v)) return v as BrandTint;
  } catch { /* private mode */ }
  return 'strong';
}
export function writeBrandTint(t: BrandTint): void {
  try { localStorage.setItem(TINT_KEY, t); } catch { /* best-effort */ }
}
