// SPDX-License-Identifier: MPL-2.0
/**
 * Colour schemes for the visualizer - the brand's palette used as several distinct
 * combinations rather than one.
 *
 * SUSE ships pine, jungle and mint (close, supporting), plus persimmon, waterhole and
 * midnight (opposite, contrasting). Locking the visualizer to a single family uses a
 * fraction of that. A SCHEME picks one family as the field and one distant hue as its
 * counterpoint, so cycling schemes moves the whole picture between genuinely different
 * colour moods while every one of them stays made of the brand's own colours.
 *
 * THE RULE THAT MAKES THIS SAFE. A ramp is only ever built WITHIN one hue family; the
 * contrasting colour enters as a separate role (rim light, linework, accent) and is
 * never interpolated into the ramp. That distinction is the whole design: an early
 * version built one ramp across the entire palette, and interpolating green→blue→orange
 * produced washed-out pinks that looked nothing like SUSE. Contrast belongs BESIDE the
 * ramp, not inside it.
 *
 * Schemes are scored and filtered, not merely enumerated - "good contrast" is measured
 * (hue separation + perceptual distance + tonal range), so a brand whose colours are all
 * muddy variations of each other gets fewer schemes rather than bad ones.
 */
import { deltaEOk, hexToOklch } from '@lolly/engine';
import {
  buildVizPalette, hexToVizRgb, liveAccentHint, type VizPalette, type VizPaletteHost,
} from './viz-palette.ts';

export interface VizScheme {
  /** Stable id - persisted, so it must not change for a given brand. */
  id: string;
  /** Human label for the menu, e.g. 'Jungle' or 'Jungle / Persimmon'. */
  name: string;
  /** The palette this scheme resolves to. */
  palette: VizPalette;
  /** How strongly the field and its counterpoint separate. Higher is punchier. */
  score: number;
}

/** Below this a "contrast" pairing is too close to read as a counterpoint. */
const MIN_SCHEME_SCORE = 0.28;
/** Two heroes closer than this in hue are the same family - one scheme, not two. */
const FAMILY_HUE_GAP = 45;
/** Enough schemes to keep cycling interesting; more become indistinguishable. */
const MAX_SCHEMES = 6;
/** A hero needs real colour; greys are handled by the monochrome path in viz-palette. */
const MIN_HERO_CHROMA = 0.04;
/** The OKLCH lightness a field hero reads best at - bright enough to carry the image,
 *  far enough from white to leave the ramp somewhere to go. */
const IDEAL_HERO_L = 0.65;

interface Candidate { hex: string; l: number; c: number; h: number; name: string }

/** Pretty name for a colour, so the menu reads 'Jungle' rather than '#30ba78'. Falls
 *  back to a coarse hue name for a brand that doesn't label its tokens. */
function hueName(h: number, l: number, c: number): string {
  if (c < MIN_HERO_CHROMA) return l < 0.4 ? 'Charcoal' : l > 0.75 ? 'Chalk' : 'Slate';
  // Upper bound of each band, in OKLCH hue degrees. Boundaries chosen against real
  // brand colours rather than evenly: SUSE's Jungle sits at 157 and must read as Green,
  // not Teal, and Waterhole at 265 as Blue, not Violet.
  const names: Array<[number, string]> = [
    [20, 'Crimson'], [50, 'Amber'], [80, 'Gold'], [115, 'Lime'], [168, 'Green'],
    [195, 'Teal'], [225, 'Cyan'], [285, 'Blue'], [315, 'Violet'], [345, 'Magenta'], [360, 'Crimson'],
  ];
  for (const [max, name] of names) if (h < max) return name;
  return 'Crimson';
}

/**
 * Collapse the brand's swatches into one representative per hue family.
 *
 * Scored on chroma plus a MID-LIGHTNESS preference, and both parts matter:
 *   - chroma alone picks the dark brick #bd3314 over the actual Persimmon #fe7c3f,
 *     because a darker red carries more chroma than a brighter orange;
 *   - chroma plus a linear lightness bonus then over-corrects and picks Mint #90ebcd
 *     over Jungle #30ba78, and a near-white hero is as unusable as a near-black one.
 * A curve peaking around L 0.65 picks the member a person would point at and name.
 */
function families(values: readonly string[], labels?: readonly (string | undefined)[]): Candidate[] {
  const seen = new Set<string>();
  const all: Candidate[] = [];
  values.forEach((v, i) => {
    const hex = /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toLowerCase() : null;
    if (!hex || seen.has(hex)) return;
    seen.add(hex);
    const o = hexToOklch(hex);
    if (!o || o.c < MIN_HERO_CHROMA) return;
    all.push({ hex, l: o.l, c: o.c, h: o.h, name: labels?.[i] ?? hueName(o.h, o.l, o.c) });
  });
  const rep = (x: Candidate): number => x.c + 0.35 * (1 - Math.abs(x.l - IDEAL_HERO_L) / IDEAL_HERO_L);
  all.sort((a, b) => rep(b) - rep(a));
  const reps: Candidate[] = [];
  for (const cand of all) {
    const clash = reps.some((r) => {
      const d = Math.abs(r.h - cand.h) % 360;
      return Math.min(d, 360 - d) < FAMILY_HUE_GAP;
    });
    if (!clash) reps.push(cand);
  }
  return reps;
}

/**
 * Score a field/counterpoint pairing. Combines how far apart the two hues sit, how
 * perceptually distinct they are (ΔEOK, which catches "far in hue but both mud"), and
 * how bright the counterpoint is - it's drawn as a highlight over a dark field, so a
 * dark counterpoint contributes nothing however opposite its hue.
 */
function scorePair(field: Candidate, counter: Candidate): number {
  const d = Math.abs(field.h - counter.h) % 360;
  const hueGap = Math.min(d, 360 - d) / 180;
  const perceptual = Math.min(deltaEOk(field.hex, counter.hex), 0.5) / 0.5;
  return hueGap * 0.45 + perceptual * 0.35 + counter.l * 0.2;
}

/**
 * Derive the schemes a brand supports.
 *
 * Every chromatic family becomes a field; each is paired with the best-scoring distant
 * family as its counterpoint. Pairings below `MIN_SCHEME_SCORE` are dropped rather than
 * shipped - a scheme that doesn't actually contrast is worse than one fewer scheme.
 *
 * A single-hue or monochrome brand yields exactly one scheme, which is correct: it has
 * one look, and `buildVizPalette` already keeps monochrome brands in their own greys.
 */
export function deriveVizSchemes(
  values: readonly string[],
  labels?: readonly (string | undefined)[],
  accentHint?: string | null,
): VizScheme[] {
  const reps = families(values, labels);
  if (reps.length === 0) {
    const palette = buildVizPalette(values);
    return [{ id: 'brand', name: 'Brand', palette, score: 0 }];
  }
  const out: VizScheme[] = [];
  for (const field of reps) {
    const others = reps.filter((r) => r !== field);
    let best: { c: Candidate; score: number } | null = null;
    for (const c of others) {
      const score = scorePair(field, c);
      if (!best || score > best.score) best = { c, score };
    }
    const palette = buildVizPalette(values, field.hex);
    if (!best || best.score < MIN_SCHEME_SCORE) {
      // No usable counterpoint - still a valid single-family scheme.
      out.push({ id: field.hex.slice(1), name: field.name, palette, score: 0 });
      continue;
    }
    // The counterpoint overrides whatever viz-palette picked on its own: this scheme's
    // whole identity is that pairing.
    const contrast = hexToVizRgb(best.c.hex) ?? palette.contrast;
    out.push({
      id: `${field.hex.slice(1)}-${best.c.hex.slice(1)}`,
      name: `${field.name} / ${best.c.name}`,
      palette: { ...palette, contrast },
      score: best.score,
    });
  }
  // Strongest pairings first, so cycling starts from the brand's best foot…
  out.sort((a, b) => b.score - a.score);
  // …except that the brand's OWN accent family leads when we know it. SUSE is a green
  // brand; opening on Persimmon/Waterhole because that pair scores highest would be a
  // more striking image of the wrong brand.
  const accentHue = accentHint ? hexToOklch(accentHint)?.h : undefined;
  if (accentHue !== undefined) {
    const isAccentFamily = (s: VizScheme): boolean => {
      const o = hexToOklch(hexOf(s.palette.hero));
      if (!o) return false;
      const d = Math.abs(o.h - accentHue) % 360;
      return Math.min(d, 360 - d) < FAMILY_HUE_GAP;
    };
    out.sort((a, b) => Number(isAccentFamily(b)) - Number(isAccentFamily(a)));
  }
  return out.slice(0, MAX_SCHEMES);
}

/** A 0–1 triple back to '#rrggbb', for the hue comparisons above. */
function hexOf(c: readonly [number, number, number]): string {
  return `#${c.map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('')}`;
}

let cached: Promise<VizScheme[]> | null = null;

/** The session's schemes, derived from the brand's tokens once and cached. */
export function vizSchemes(host?: VizPaletteHost): Promise<VizScheme[]> {
  cached ??= Promise.resolve(host?.tokens?.colors?.())
    .then((cs) => {
      // Keep the CHARTS/DATA-VIZ-ONLY spectrum out of the visualiser's colour moods (Andy,
      // plans/147): SUSE's `color.spectrum.*` (Lilac, Teal, …) are for infographics, and
      // their token names carry that whole note - which would otherwise show as a scheme
      // label. The visualiser rides the brand's CORE colours (jungle/waterhole/persimmon/…).
      const usable = (cs ?? []).filter((c) => !isDataVizOnly(c));
      return deriveVizSchemes(usable.map((c) => c.value), usable.map((c) => nameOf(c)), liveAccentHint());
    })
    .catch(() => deriveVizSchemes([]));
  return cached;
}

/** True for a swatch the brand designates charts/infographics-only, by its token path/group
 *  (`color.spectrum.*`) or a "data viz only / infographics" note in its description. */
function isDataVizOnly(c: { value: string } & { path?: unknown; group?: unknown; description?: unknown }): boolean {
  const path = typeof c.path === 'string' ? c.path.toLowerCase() : '';
  const group = typeof c.group === 'string' ? c.group.toLowerCase() : '';
  const desc = typeof c.description === 'string' ? c.description.toLowerCase() : '';
  return path.startsWith('color.spectrum.') || group === 'spectrum' || /data\s?viz|infographic/.test(desc);
}

/** Swatches carry a display `name` in the full host contract; the narrow slice this
 *  module accepts may not, so read it defensively. */
function nameOf(c: { value: string } & { name?: unknown }): string | undefined {
  return typeof c.name === 'string' && c.name.trim() ? c.name.trim() : undefined;
}

/** Drop the cache - tests, and a live token edit. */
export function invalidateVizSchemes(): void {
  cached = null;
}

/** Look up a scheme by id, falling back to the first (the strongest pairing). */
export function vizSchemeById(schemes: readonly VizScheme[], id: string | null | undefined): VizScheme {
  return schemes.find((s) => s.id === id) ?? schemes[0]!;
}

/** The scheme after `id`, wrapping - for deterministic stepping (menus, tests). */
export function nextVizSchemeId(schemes: readonly VizScheme[], id: string): string {
  if (schemes.length === 0) return id;
  const at = schemes.findIndex((s) => s.id === id);
  return schemes[(at + 1) % schemes.length]!.id;
}

/**
 * A DIFFERENT scheme at random - what auto-cycling uses.
 *
 * Random rather than sequential because the schemes are few: stepping them in order
 * makes the rotation obviously periodic after one lap, and the brand's colours arriving
 * unpredictably is the point. Guaranteed to differ from `id` whenever there's more than
 * one to choose from, so a cycle never appears to do nothing.
 */
export function randomVizSchemeId(schemes: readonly VizScheme[], id: string): string {
  if (schemes.length <= 1) return schemes[0]?.id ?? id;
  const others = schemes.filter((s) => s.id !== id);
  return others[Math.floor(Math.random() * others.length)]!.id;
}
