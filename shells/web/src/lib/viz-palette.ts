// SPDX-License-Identifier: MPL-2.0
/**
 * The MilkDrop visualizer's brand palette - the LOADED brand's colours reduced to
 * the handful of numbers a butterchurn preset can actually be seeded with.
 *
 * A butterchurn preset expresses colour as separate 0–1 `r`/`g`/`b` scalars (wave
 * colour, motion vectors, borders, per-shape fills), so what the visualizer needs
 * from a brand isn't "the palette" - it's an ORDERED perceptual ramp it can index
 * into, plus a few hue-distinct accents for shapes. We build both here:
 *
 *   - `ramp` - RAMP_STEPS colours dark→light through the brand's most chromatic
 *                anchors, interpolated in OKLab (engine `rampOklab`) so the
 *                gradient a preset sweeps through stays perceptually even.
 *   - `accents` - up to ACCENT_MAX hue-distinct brand colours, for shape fills that
 *                want to read as DIFFERENT rather than as steps of one hue.
 *   - `deep`/`hero`/`tip` - the ramp's dark end, chromatic middle, and light end,
 *                named because presets reach for those three constantly.
 *
 * Colour here is SEEDING, not reproduction: a preset's own equations and blending
 * push hues around at runtime, so the goal is that the visualizer reads as
 * unmistakably this brand's, not that any frame matches a token exactly.
 *
 * Same host slice + caching shape as lib/particles.ts's chip palette (a tokenless
 * catalog falls back rather than rendering a drab visualizer), and the same
 * `tokenValueToHex` normalisation, since swatch values may be hex OR raw oklch().
 */
import { hexToOklch, oklchToHex, rampOklab } from '@lolly/engine';
import { tokenValueToHex } from '../brand-vars.ts';

/** An `r`,`g`,`b` triple in butterchurn's 0–1 scale. */
export type VizRgb = readonly [number, number, number];

export interface VizPalette {
  /**
   * Dark→light, perceptually even, and LOCKED TO ONE HUE FAMILY - see `HUE_WINDOW`.
   * Presets sweep this per-frame, so it has to be a family the brand owns (SUSE:
   * dark pine → pine → jungle → mint) and never a path between distant hues.
   */
  ramp: readonly VizRgb[];
  /**
   * The brand's CORE family, dark→light - for SUSE: dark pine, pine, jungle, mint.
   * This is what effects are drawn with. Variety comes from LIGHTNESS within the
   * brand's own hue, not from reaching for a different hue.
   */
  accents: readonly VizRgb[];
  /**
   * Off-family brand hues (SUSE: persimmon, waterhole), strongest first - for
   * SUPPORTING roles only: a thin border, a small highlight. Never a fill, never the
   * subject. May be empty for a single-hue brand, so every use must cope with that.
   */
  support: readonly VizRgb[];
  /** The ramp's dark end - the ground's centre. */
  deep: VizRgb;
  /** Darker than `deep` and nearly neutral: the ground's outer edge, so the field
   *  falls off to something that still belongs to the brand rather than to black. */
  deepest: VizRgb;
  /** The most chromatic anchor - the colour the brand is "about". */
  hero: VizRgb;
  /** The ramp's light end - highlights, wave crests. */
  tip: VizRgb;
  /**
   * A CONTRASTING colour from a different part of the brand's wheel - persimmon against
   * jungle, say. Deliberately NOT a ramp stop: interpolating a ramp between distant
   * hues is what produced the off-brand mud the hue window exists to prevent. This
   * enters as a separate role (rim lights, edge highlights, accent marks) where it
   * reads as deliberate contrast rather than as a muddy transition.
   *
   * Falls back to the ramp's light end for a brand with only one hue, so consumers
   * never have to special-case it.
   */
  contrast: VizRgb;
}

/** How many steps the ramp carries. 8 is enough for a preset to walk a gradient
 *  per-frame without banding, and small enough to stay cheap to build. */
export const RAMP_STEPS = 8;
const ACCENT_MAX = 4;
/** Below this OKLCH chroma a swatch reads as grey - no hue to seed a visual with. */
const MIN_CHROMA = 0.045;
/**
 * The far lower bar an explicit accent HINT has to clear.
 *
 * MIN_CHROMA exists to keep greys out of the ramp and the accent list. Applying it to
 * the hint too was a real bug: SUSE's Pine (#0c322c) has chroma 0.0437 - 0.0013 under
 * the gate - so the brand's own declared primary was rejected as "grey", the code fell
 * through to most-chromatic, picked Waterhole blue (0.2576), and the entire visualizer
 * came out navy.
 *
 * The hint only contributes its HUE (lightness is synthesised around it), so the only
 * thing that actually disqualifies one is having no hue at all.
 */
const MIN_HINT_CHROMA = 0.012;
/** Support hues must differ by at least this many OKLCH hue degrees to count as distinct. */
const MIN_HUE_SEPARATION = 25;
/** Core accents are separated by LIGHTNESS (they share a hue); below this gap two
 *  picks read as the same tone. */
const MIN_ACCENT_LIGHTNESS_GAP = 0.12;

/**
 * How far, in OKLCH hue degrees, a swatch may sit from the hero and still join the
 * ramp.
 *
 * This exists because the first version didn't have it. A real brand palette spans
 * distant hues - SUSE carries jungle green, persimmon orange AND waterhole blue - and
 * a perceptual ramp built across all of them interpolates green→orange→blue straight
 * through PINK. The visualizer looked nothing like the brand. Restricting the ramp to
 * one family around the hero means SUSE yields dark pine → pine → jungle → mint,
 * which is what someone expects "the SUSE visualizer" to look like. The distant hues
 * are still available, deliberately, via `accents`.
 */
const HUE_WINDOW = 45;
/** A contrast colour must sit at least this far around the wheel from the hero to read
 *  as a deliberate counterpoint rather than a near-miss of the same family. */
const MIN_CONTRAST_HUE_GAP = 60;

/**
 * The LAST-RESORT ramp, reached only when there is no live theme accent AND no usable
 * chromatic token anywhere - a brand-new or deliberately monochrome pack.
 *
 * Deliberately a neutral slate-teal and NOT any real brand's colours. This module ships
 * in the public, brand-agnostic web shell and serves whatever brand is loaded; baking
 * SUSE's greens in as the platform default would make every unbranded install look
 * like SUSE. It only needs to demonstrate the three roles the derivation looks for - 
 * a dark chromatic base, a mid hero, a pale tip - with enough chroma that
 * `brandRamp` isn't grey.
 */
const FALLBACK_ANCHORS = ['#10242b', '#1f4c57', '#3f8b96', '#a8d8de'] as const;
const FALLBACK_ACCENTS = ['#3f8b96', '#a8d8de', '#1f4c57'] as const;

/** The host slice this needs - the same optional tokens resolver the brand-var
 *  modules and the confetti palette use. */
export interface VizPaletteHost {
  tokens?: { colors(): Promise<Array<{ value: string }>> };
}

/** '#rrggbb' → butterchurn's 0–1 triple. Returns null for anything unparseable. */
export function hexToVizRgb(hex: string): VizRgb | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1]!, 16);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

interface Swatch { hex: string; l: number; c: number; h: number }

/** Normalise + measure the brand's swatches, dropping duplicates and unparseables.
 *  Sorted dark→light so anchor picking can read positionally. */
function measure(values: readonly string[]): Swatch[] {
  const seen = new Set<string>();
  const out: Swatch[] = [];
  for (const v of values) {
    const hex = tokenValueToHex(v);
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    const o = hexToOklch(hex);
    if (!o) continue;
    out.push({ hex, l: o.l, c: o.c, h: o.h });
  }
  return out.sort((a, b) => a.l - b.l);
}

/** Shift a colour's OKLCH lightness/chroma while KEEPING its hue. Used to synthesise
 *  ramp ends for a brand that has only one colour in the hero's family. */
function reLightness(hex: string, l: number, chromaScale = 1): string {
  const o = hexToOklch(hex);
  if (!o) return hex;
  return oklchToHex({ l, c: Math.max(0, o.c * chromaScale), h: o.h }) ?? hex;
}

/**
 * Pick the ramp's anchors, all within one hue family.
 *
 * Only swatches within `HUE_WINDOW` of the hero take part, sorted dark→light, so the
 * ramp travels through hues the brand actually owns instead of cutting across the
 * colour wheel. Near-neutral swatches are excluded entirely - a grey anchor both
 * desaturates the ramp and has no hue to be "in the family" in the first place.
 *
 * A brand with only one colour in that family (or a monochrome pack) still gets a
 * usable ramp: the ends are synthesised from the hero at fixed lightnesses with its
 * hue preserved, which is strictly better than borrowing an off-brand hue.
 */
function pickAnchors(swatches: readonly Swatch[], heroHex: string): string[] {
  const hero = hexToOklch(heroHex);
  const family = hero
    ? swatches.filter((s) => s.c >= MIN_CHROMA && hueDistance(s.h, hero.h) <= HUE_WINDOW)
    : [];
  // A MONOCHROME brand keeps its own blacks, greys and whites. Inventing a hue for it
  // would be putting a colour on screen the brand does not own - a greyscale visualizer
  // is the honest, on-brand result. Only a brand with NOTHING usable gets the
  // synthesised neutral, and that's a last resort, not a preference.
  if (family.length === 0 && !isChromatic(swatches)) {
    const mono = monoAnchors(swatches);
    if (mono.length >= 2) return mono;
  }
  // Always bookend with synthesised ends at the hero's hue: it guarantees real range
  // dark→light even when the brand's in-family swatches all sit at similar lightness.
  // The dark end goes NEARLY to black, deliberately. Black is fine in a visualizer - 
  // majority black is not - and a ramp that bottoms out at a mid-dark tone has no deep end
  // to fall into, which is what made earlier passes read as flat. Low-intensity regions
  // now land on something almost black but still brand-hued, so contrast comes from the
  // ramp's own range instead of from a black background.
  const stops = [reLightness(heroHex, 0.14, 0.6)];
  for (const s of family) {
    if (s.l > 0.28 && s.l < 0.86) stops.push(s.hex);
  }
  stops.push(reLightness(heroHex, 0.9, 0.55));
  // Dedupe while preserving the dark→light order (family is already L-sorted).
  return [...new Set(stops)];
}

/** Does this brand have any real colour at all, or is it blacks-and-whites? */
function isChromatic(swatches: readonly Swatch[]): boolean {
  return swatches.some((s) => s.c >= MIN_CHROMA);
}

/**
 * Ramp stops for a monochrome brand: its own swatches, dark→light, thinned so the ramp
 * spans the full tonal range rather than bunching wherever the brand happens to have
 * lots of near-identical greys. Ends are pushed to the brand's true darkest/lightest so
 * the visualizer uses the actual black and white it ships.
 */
function monoAnchors(swatches: readonly Swatch[]): string[] {
  if (swatches.length === 0) return [];
  const picked: Swatch[] = [];
  for (const s of swatches) {
    if (picked.every((q) => Math.abs(q.l - s.l) >= 0.1)) picked.push(s);
  }
  const last = swatches[swatches.length - 1]!;
  if (picked[picked.length - 1] !== last) picked.push(last);
  return picked.map((s) => s.hex);
}

/** Smallest angular distance between two hues, in degrees. */
function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

/**
 * The core-family accents: the brand's OWN hue at several lightnesses.
 *
 * The first version picked the most chromatic HUE-DISTINCT swatches, which inverted
 * the brief - for SUSE that returns waterhole blue and persimmon orange ahead of
 * jungle green, so the effects were dominated by exactly the colours that should only
 * ever support. Effects should be pine/jungle/mint; variety comes from lightness.
 *
 * Spaced by lightness so the picks read as genuinely different tones rather than four
 * near-identical greens, and topped up from the ramp when the brand is thin here.
 */
function pickAccents(swatches: readonly Swatch[], heroHex: string): string[] {
  const hero = hexToOklch(heroHex);
  const family = hero
    ? swatches.filter((s) => s.c >= MIN_CHROMA && hueDistance(s.h, hero.h) <= HUE_WINDOW)
    : [];
  const picked: Swatch[] = [];
  for (const s of family) {
    if (picked.every((q) => Math.abs(q.l - s.l) >= MIN_ACCENT_LIGHTNESS_GAP)) picked.push(s);
    if (picked.length >= ACCENT_MAX) break;
  }
  const out = picked.map((s) => s.hex);
  if (!out.includes(heroHex)) out.push(heroHex);
  // Thin family? Synthesise more tones of the SAME hue rather than borrowing another.
  for (const l of [0.35, 0.62, 0.85]) {
    if (out.length >= ACCENT_MAX) break;
    const syn = reLightness(heroHex, l);
    if (!out.includes(syn)) out.push(syn);
  }
  return out.length ? out : [...FALLBACK_ACCENTS];
}

/** Off-family brand hues, strongest chroma first - supporting accents only. */
function pickSupport(swatches: readonly Swatch[], heroHex: string): string[] {
  const hero = hexToOklch(heroHex);
  if (!hero) return [];
  const picked: Swatch[] = [];
  for (const s of [...swatches].filter((x) => x.c >= MIN_CHROMA).sort((a, b) => b.c - a.c)) {
    if (hueDistance(s.h, hero.h) <= HUE_WINDOW) continue;
    if (picked.every((q) => hueDistance(q.h, s.h) >= MIN_HUE_SEPARATION)) picked.push(s);
    if (picked.length >= 2) break;
  }
  return picked.map((s) => s.hex);
}

/**
 * The colour the brand is "about".
 *
 * `heroHint` - the app's own live accent - wins whenever it's chromatic enough,
 * because that is by definition the colour this brand presents itself with. The
 * fallback, most-chromatic-swatch, was the original heuristic and it is WRONG on real
 * palettes: OKLCH chroma is not "brand importance", and for SUSE it picked Waterhole
 * blue (#2453ff, chroma 0.24) over Jungle green (#30ba78, chroma 0.15), so the whole
 * visualizer came out blue. It stays only as a last resort for a brand whose accent
 * can't be read.
 */
function pickHero(swatches: readonly Swatch[], heroHint?: string | null): string {
  if (heroHint) {
    const o = hexToOklch(heroHint);
    if (o && o.c >= MIN_HINT_CHROMA) return heroHint;
  }
  let best: Swatch | null = null;
  for (const s of swatches) if (!best || s.c > best.c) best = s;
  if (best && best.c >= MIN_CHROMA) return best.hex;
  // Monochrome brand: its own mid tone is the hero. Reaching for FALLBACK_ANCHORS here
  // would paint a teal onto a black-and-white brand.
  if (swatches.length > 0) return swatches[Math.floor(swatches.length / 2)]!.hex;
  return FALLBACK_ANCHORS[1];
}

/** `h s% l%` (the form the theme's custom properties carry) → '#rrggbb'. */
function hslTripletToHex(triplet: string): string | null {
  const m = /^\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*$/.exec(triplet);
  if (!m) return null;
  const h = Number(m[1]) / 360;
  const sat = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  const f = (n: number): number => {
    const k = (n + h * 12) % 12;
    return l - sat * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const to = (v: number): string => Math.round(clamp01v(v) * 255).toString(16).padStart(2, '0');
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}
const clamp01v = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The live accent the app is currently wearing, as hex.
 *
 * Prefers `--brand-primary` (set by brand-vars.ts when the brand declares a semantic
 * primary slot) and falls back to the theme's `--primary`, which every Lolly theme
 * defines as an `h s% l%` triplet. This is the most honest available answer to "what
 * colour is this brand", and notably it's the ONLY one that works for SUSE, whose
 * catalog declares no semantic slots at all - so there's no primary token to read,
 * but the theme still says Pine Green.
 */
/** The live brand accent, exported so scheme derivation can lead with the brand's own
 *  family rather than whichever pairing merely scores highest. */
export function liveAccentHint(): string | null {
  return liveAccentHex();
}

function liveAccentHex(): string | null {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return null;
  const cs = getComputedStyle(document.documentElement);
  // `--primary` FIRST, and deliberately. brand-vars.ts patches it per theme
  // (`:root, [data-theme="light"]` and `[data-theme="dark"]` blocks via
  // chromeBrandCss), so it is the brand's accent FOR THE THEME ON SCREEN - SUSE dark
  // mode resolves Jungle. `--brand-primary` is only ever the LIGHT primary (Pine for
  // SUSE), so preferring it would tint a dark-mode visualizer with the light accent.
  const theme = cs.getPropertyValue('--primary').trim();
  if (theme) {
    const hex = hslTripletToHex(theme) ?? tokenValueToHex(theme);
    if (hex) {
      lastAccentSource = `--primary ${JSON.stringify(theme)} -> ${hex}`;
      return hex;
    }
    lastAccentSource = `--primary unparseable: ${JSON.stringify(theme)}`;
  }
  const brand = cs.getPropertyValue('--brand-primary').trim();
  if (brand) {
    const hex = tokenValueToHex(brand);
    if (hex) {
      lastAccentSource = `--brand-primary ${JSON.stringify(brand)} -> ${hex}`;
      return hex;
    }
    lastAccentSource = `--brand-primary unparseable: ${JSON.stringify(brand)}`;
    return null;
  }
  lastAccentSource = 'neither --primary nor --brand-primary resolved on :root';
  return null;
}

/**
 * Why the palette came out the way it did. Reported once per session by the visualizer,
 * because a wrong hero is invisible in the code and unmistakable on screen: the whole
 * field simply comes out the wrong colour, with nothing logged to say why. Cheap enough
 * to keep permanently.
 */
let lastAccentSource = 'not resolved';
export function vizPaletteDiagnostics(p: VizPalette): string {
  const hex = (c: VizRgb): string =>
    `#${c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
  return `accent: ${lastAccentSource} | hero ${hex(p.hero)} | ramp ${p.ramp.map(hex).join(' ')}`
    + ` | accents ${p.accents.map(hex).join(' ')} | support ${p.support.map(hex).join(' ') || '(none)'}`;
}

/** Build the palette from raw swatch values. Pure - the unit-testable core. */
export function buildVizPalette(values: readonly string[], heroHint?: string | null): VizPalette {
  const swatches = measure(values);
  const heroHex = pickHero(swatches, heroHint);
  const anchors = pickAnchors(swatches, heroHex);
  // correctLightness so the ramp's steps are perceptually even rather than
  // bunching wherever the brand happens to cluster its anchors.
  let hexes: string[];
  try {
    hexes = rampOklab(anchors, RAMP_STEPS, { correctLightness: true });
  } catch {
    hexes = rampOklab([...FALLBACK_ANCHORS], RAMP_STEPS, { correctLightness: true });
  }
  const ramp = hexes.map(hexToVizRgb).filter((c): c is VizRgb => c !== null);
  const accents = pickAccents(swatches, heroHex).map(hexToVizRgb).filter((c): c is VizRgb => c !== null);
  const support = pickSupport(swatches, heroHex).map(hexToVizRgb).filter((c): c is VizRgb => c !== null);
  const hero = hexToVizRgb(heroHex) ?? [0, 0.53, 0.47];
  // The ground's outer edge: the hero's hue taken almost to black, so the field falls
  // off into something that still belongs to the brand instead of into neutral black.
  const deepest = hexToVizRgb(reLightness(heroHex, 0.13, 0.55)) ?? [0.02, 0.07, 0.06];
  const contrastHex = pickContrast(swatches, heroHex);
  return {
    ramp,
    accents: accents.length ? accents : [hero],
    support,
    deep: ramp[0] ?? [0.05, 0.2, 0.17],
    deepest,
    hero,
    tip: ramp[ramp.length - 1] ?? [0.56, 0.92, 0.8],
    contrast: (contrastHex ? hexToVizRgb(contrastHex) : null)
      ?? ramp[ramp.length - 1] ?? [0.56, 0.92, 0.8],
  };
}

/**
 * The best contrasting brand colour for a given hero: far around the wheel, chromatic,
 * and light enough to read against the ramp it will sit on.
 *
 * Scored on hue distance, LIGHTNESS and CHROMA - deliberately not on WCAG contrast
 * against the hero. WCAG measures legibility of one colour on another, and optimising
 * it here picks the darkest opposite hue (for SUSE, Midnight over Persimmon), which is
 * exactly wrong: this colour is drawn as a highlight over a DARK field, so it has to be
 * bright and vivid to register at all. Hue distance is normalised so 180° scores 1.
 *
 * Null for a single-hue brand; callers fall back to the ramp's light end.
 */
function pickContrast(swatches: readonly Swatch[], heroHex: string): string | null {
  const hero = hexToOklch(heroHex);
  if (!hero) return null;
  let best: { hex: string; score: number } | null = null;
  for (const s of swatches) {
    if (s.c < MIN_CHROMA) continue;
    const gap = hueDistance(s.h, hero.h);
    if (gap < MIN_CONTRAST_HUE_GAP) continue;
    // Chroma is doubled because vividness is what separates an accent from the field;
    // an opposite hue that's washed out just reads as a lighter patch of the ramp.
    const score = gap / 180 + s.l + s.c * 2;
    if (!best || score > best.score) best = { hex: s.hex, score };
  }
  return best?.hex ?? null;
}

let cached: Promise<VizPalette> | null = null;

/**
 * The session's visualizer palette - derived from the loaded brand's tokens once,
 * then cached; a design-system switch calls invalidateVizPalette (plans/186
 * section 3.4). A tokenless host resolves to the SUSE-shaped fallback immediately.
 */
export function vizPalette(host?: VizPaletteHost): Promise<VizPalette> {
  const accent = liveAccentHex();
  if (!host?.tokens) return Promise.resolve(buildVizPalette(FALLBACK_ANCHORS, accent));
  cached ??= host.tokens
    .colors()
    .then((cs) => buildVizPalette(cs.map((c) => c.value), accent))
    .catch(() => buildVizPalette(FALLBACK_ANCHORS, accent));
  return cached;
}

/** Drop the cached palette - for tests, and for a live token edit that should
 *  re-seed an open visualizer. */
export function invalidateVizPalette(): void {
  cached = null;
}
