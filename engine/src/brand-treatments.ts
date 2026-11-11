// SPDX-License-Identifier: MPL-2.0
/**
 * Brand-derived photo treatments + icon duo themes.
 *
 * The photo-treatment (photo-treatment.ts) and icon-theme (icon-theme.ts)
 * machinery is generic: shells discover a palette-type asset tagged
 * "photo-treatments" / "icon-themes" and offer its entries on every photo and
 * themable icon. Historically those docs were hand-authored per brand, so a
 * freshly ingested (or blank starter) brand shipped with no working strip.
 * This module derives usable docs from a brand token document (or its
 * resolved swatches), so every brand gets the same one-tap treatments a
 * hand-tuned catalog has. The tuning constants are calibrated against the
 * hand-authored SUSE docs (duotone shadows ≈ L 0.2–0.3 / C ≤ 0.075,
 * highlights ≈ L 0.93).
 *
 * Pure and deterministic (no Date/random/IO): same input, byte-identical docs.
 * Tolerant of thin palettes: with no chromatic swatch the treatments doc still
 * carries greyscale, and the themes list comes back EMPTY. Callers must skip
 * writing an icon-themes asset in that case (the catalog validator rejects a
 * doc whose themes[] is empty). Both outputs parse cleanly through the
 * runtime readers (parsePhotoTreatmentsDoc / parseIconThemesDoc); a test
 * enforces this.
 */

import type { PhotoTreatment } from './photo-treatment.ts';
import type { IconTheme } from './icon-theme.ts';
import type { BrandSwatch } from './brand-map.ts';
import { contrastRatio, hexToOklch, oklchToHex } from './brand-derive.ts';
import { colorToHex, createTokenSet } from './tokens.ts';
import { clamp } from './clamp.ts';
import { canonicalFirst, colourwayAxis } from './colourway.ts';
import { modeAxis, readTokenAxes } from './token-axes.ts';

/** The JSON payload written as a palette asset tagged "photo-treatments". */
export interface DerivedPhotoTreatments {
  name: string;
  description: string;
  treatments: PhotoTreatment[];
}

/** The JSON payload written as a palette asset tagged "icon-themes". */
export interface DerivedIconThemes {
  name: string;
  description: string;
  themes: IconTheme[];
}

// Bound the work: token documents are author-controlled but arrive as
// untrusted JSON - a pathological doc must not turn selection quadratic.
const MAX_SWATCHES = 1024;

// Below this OKLCH chroma a swatch reads as grey - never an accent.
const ACCENT_MIN_CHROMA = 0.06;

// Accents must sit at least one hue bucket apart (see HUE_NAMES); equal to the
// bucket width, so no two selected accents can share a bucket name.
const HUE_APART_DEG = 30;

// Treatment strip size mirrors the hand-authored SUSE docs: greyscale +
// up to MAX_ACCENTS duotones + one tritone; themes cap at brand/tint/paper +
// the extra accents.
const MAX_ACCENTS = 4;

// 30°-wide OKLCH hue buckets → deterministic ids/labels for non-primary
// accents. Centres line up with brand-derive's SPECTRUM hues (amber 75,
// green 145, teal 190, blue 250, violet 300, rose 355).
const HUE_NAMES = [
  'red', 'ember', 'amber', 'gold', 'green', 'jade',
  'teal', 'sky', 'blue', 'indigo', 'violet', 'rose',
] as const;
const hueDist = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};
const hueName = (h: number): string =>
  HUE_NAMES[Math.floor((((h % 360) + 360) % 360) / 30) % 12]!;
const titleCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

interface Cand {
  hex: string; // normalised lowercase #rrggbb
  l: number;
  c: number;
  h: number;
  /** lowercased token path / role hint (name only as fallback) for role
   * scoring. Structural only - free-text descriptions would false-positive
   * (lolly-start's spectrum tokens all *mention* "the primary"). */
  role: string;
}

// A brand's own "this is the colour" swatches should lead selection even when
// a spectrum/utility token happens to carry more chroma.
function roleScore(role: string): number {
  if (role.includes('semantic.primary')) return 3;
  if (/(^|[^a-z])(primary|brand)([^a-z]|$)/.test(role)) return 2;
  if (/(^|[^a-z])(accent|secondary|highlight)([^a-z]|$)/.test(role)) return 1;
  return 0;
}

/**
 * Normalise the source - a DTCG token document (aliases/themes resolved via
 * createTokenSet) or an already-resolved BrandSwatch[] - into deduped OKLCH
 * candidates. Unparseable and translucent colours are dropped.
 */
function toCandidates(source: unknown): Cand[] {
  let swatches: BrandSwatch[];
  if (Array.isArray(source)) {
    swatches = (source as BrandSwatch[]).slice(0, MAX_SWATCHES);
  } else {
    swatches = createTokenSet(source)
      .colors()
      .slice(0, MAX_SWATCHES)
      .map(s => ({ hex: s.value, name: s.name, role: s.path }));
  }
  const out: Cand[] = [];
  const seen = new Set<string>();
  for (const sw of swatches) {
    if (!sw || typeof sw !== 'object') continue;
    const norm = colorToHex(sw.hex);
    if (typeof norm !== 'string' || !norm.startsWith('#')) continue;
    const ok = hexToOklch(norm);
    if (!ok || (ok.alpha != null && ok.alpha < 1)) continue; // translucent ≠ treatment ink
    const hex = (norm.length === 9 ? norm.slice(0, 7) : norm).toLowerCase();
    if (seen.has(hex)) continue;
    seen.add(hex);
    out.push({
      hex, l: ok.l, c: ok.c, h: ok.h,
      // Token path (or a BrandSwatch's declared role) - a swatch NAME scores
      // only when no structural hint exists at all.
      role: (sw.role ?? sw.name ?? '').toLowerCase(),
    });
  }
  return out;
}

// Accent hues, most brand-relevant first: sort by role score, then chroma,
// then hex (a total order, so selection never depends on sort stability).
// Selection is greedy and hue-clustered, so each 30° neighbourhood
// contributes one representative.
function pickAccents(cands: Cand[]): Cand[] {
  const sorted = cands
    .filter(c => c.c >= ACCENT_MIN_CHROMA)
    .sort((a, b) =>
      roleScore(b.role) - roleScore(a.role) || b.c - a.c || a.hex.localeCompare(b.hex));
  const out: Cand[] = [];
  for (const c of sorted) {
    if (out.length >= MAX_ACCENTS) break;
    if (out.every(o => hueDist(o.h, c.h) >= HUE_APART_DEG)) out.push(c);
  }
  return out;
}

// The darkest swatch dark enough to serve as an icon base ("ink"). Prefers a
// chromatic dark colour over a grey (SUSE's ink is a dark pine green, not a
// grey). Returns null if no swatch is dark enough.
function pickInk(cands: Cand[]): Cand | null {
  const dark = cands.filter(c => c.l <= 0.45);
  if (!dark.length) return null;
  return dark.sort((a, b) => a.l - b.l || b.c - a.c || a.hex.localeCompare(b.hex))[0]!;
}

// The soft duotone shadow for an accent hue - deep, chroma-tamed so the wash
// stays a treatment rather than a colour cast.
function duotoneShadow(a: Cand): string {
  return oklchToHex({ l: 0.26, c: clamp(a.c * 0.5, 0.02, 0.075), h: a.h });
}

/**
 * Derive a photo-treatments palette doc from a brand token document (or
 * resolved BrandSwatch[]): greyscale, one soft duotone wash per selected
 * accent hue (the brand primary first), and - when any accent exists - a
 * three-stop "deep" tritone (black → primary shadow → primary accent).
 * Every entry survives parsePhotoTreatmentsDoc unchanged.
 */
export function derivePhotoTreatmentsDoc(source: unknown): DerivedPhotoTreatments {
  const cands = toCandidates(source);
  const accents = pickAccents(cands);
  const treatments: PhotoTreatment[] = [
    { id: 'greyscale', label: 'Greyscale', kind: 'greyscale', previewBg: '#f0f0f0' },
  ];
  accents.forEach((a, i) => {
    // Hue-cluster spacing (≥ one bucket) keeps bucket names unique; 'brand'
    // frees the primary's own bucket for a later accent.
    const id = i === 0 ? 'brand' : hueName(a.h);
    treatments.push({
      id,
      label: i === 0 ? 'Brand' : titleCase(id),
      kind: 'duotone',
      shadow: duotoneShadow(a),
      highlight: oklchToHex({ l: 0.93, c: clamp(a.c * 0.4, 0.015, 0.055), h: a.h }),
    });
  });
  if (accents.length) {
    const p = accents[0]!;
    const mid = duotoneShadow(p);
    // A dark primary would invert the ramp (highlight below mid) - lift it.
    const highlight = p.l < 0.55 ? oklchToHex({ l: 0.62, c: p.c, h: p.h }) : p.hex;
    treatments.push({
      id: 'deep', label: 'Deep', kind: 'duotone',
      shadow: '#000000', mid, highlight, previewBg: mid,
    });
  }
  treatments.push(toneLook(cands, accents[0]));
  return {
    name: 'Photo Colour Treatments',
    description:
      'Colour treatments for photo assets, derived from the brand palette: greyscale plus soft two-colour duotone washes (shadow maps to shadows, highlight to highlights), a three-stop deep tritone and a Tone photo look (an OKLab gradient map from the brand ink to a soft light tone that keeps white type legible, with a darker variant for a dark theme). Chosen at pick time and baked at resolve. \'None\' is the plain photo (no id suffix).',
    treatments,
  };
}

/**
 * The derived photo look (plan 291 W7): an OKLab gradient map from a deep ink through a
 * mid tone to a soft light tone, all in the hue of the brand ink (grey for a colourless
 * palette) with the mid leaning to the primary accent when there is one, and a low-key
 * variant for a `dark` theme. Every stop is computed in OKLCH, so no brand swatch is
 * copied verbatim.
 *
 * The light end stops at L 0.76 rather than paper, so a white title over a sky stays
 * legible: on the public twin's cover (tests/fixtures/rebrand/recreate.pptx) the sky under
 * the title measures 0.29 luminance at the 90th percentile, 3.1:1 against white, where the
 * earlier paper-ended look gave 0.64 (1.5:1). The dark variant ends at L 0.52 and averages
 * a quarter of the light grade's luminance over that photo (0.045 against 0.18).
 */
function toneLook(cands: Cand[], primary: Cand | undefined): PhotoTreatment {
  const ink = pickInk(cands);
  const inkHue = ink && ink.c >= 0.02 ? ink.h : primary?.h ?? 0;
  const inkChroma = ink && ink.c >= 0.02 ? clamp(ink.c, 0.02, 0.05) : 0;
  const midHue = primary?.h ?? inkHue;
  const midChroma = primary ? clamp(primary.c * 0.5, 0.03, 0.09) : inkChroma;
  const paperChroma = inkChroma ? 0.012 : 0;
  const stop = (l: number, c: number, h: number): string => oklchToHex({ l, c, h });
  return {
    id: 'tone', label: 'Tone', kind: 'gradient-map',
    stops: [stop(0.18, inkChroma, inkHue), stop(0.5, midChroma, midHue), stop(0.76, paperChroma, inkHue)],
    amount: 100, contrast: 16, lightness: -4,
    previewBg: stop(0.18, inkChroma, inkHue),
    themes: {
      dark: { stops: [stop(0.1, inkChroma, inkHue), stop(0.26, inkChroma, inkHue), stop(0.52, midChroma, midHue)], amount: 100, contrast: 18, lightness: 0 },
    },
  };
}

/**
 * Derive an icon-themes palette doc from a brand token document (or resolved
 * BrandSwatch[]). First pairing is 'brand' (primary accent over the brand
 * ink) - the default pairing contract - then a light 'tint' of the primary,
 * one pairing per extra accent hue, and 'paper' (white on light grey, with
 * the ink as previewBg). Empty `themes` when the palette has no accent -
 * callers must not write an icon-themes asset then.
 */
export function deriveIconThemesDoc(source: unknown): DerivedIconThemes {
  const cands = toCandidates(source);
  const accents = pickAccents(cands);
  const themes: IconTheme[] = [];
  if (accents.length) {
    const p = accents[0]!;
    const ink = pickInk(cands);
    // The ink must sit clearly below the accent; a same-swatch or too-close
    // pick falls back to a derived dark of the primary hue.
    const inkHex = ink && ink.hex !== p.hex && p.l - ink.l >= 0.15
      ? ink.hex
      : oklchToHex({ l: clamp(p.l - 0.35, 0.14, 0.3), c: clamp(p.c * 0.5, 0.01, 0.06), h: p.h });
    themes.push({ id: 'brand', label: 'Brand', c1: p.hex, c2: inkHex });
    if (p.l < 0.78) {
      // A light accent IS its own tint - pairing it with itself says nothing.
      themes.push({
        id: 'tint', label: 'Tint',
        c1: oklchToHex({ l: 0.87, c: clamp(p.c * 0.8, 0.02, 0.1), h: p.h }),
        c2: p.hex,
      });
    }
    for (const a of accents.slice(1)) {
      const id = hueName(a.h);
      themes.push({
        id, label: titleCase(id),
        c1: a.hex,
        c2: oklchToHex({ l: clamp(a.l - 0.35, 0.14, 0.45), c: clamp(a.c * 0.6, 0.01, 0.075), h: a.h }),
      });
    }
    themes.push({ id: 'paper', label: 'Paper', c1: '#ffffff', c2: '#f0f0f0', previewBg: inkHex });
  }
  return {
    name: 'Icon Duo Themes',
    description:
      'Colour pairings for themable two-colour icons, derived from the brand palette: c1 = accent, c2 = base. \'brand\' is the default pairing. previewBg is the surface a light pairing needs behind it to stay visible in pickers/previews.',
    themes,
  };
}

// ─── Colourway looks ──────────────────────────────────────────────────────────

/*
 * The icon colours and photo washes a design system offers come from its colourways
 * (colourway.ts): one icon pairing and one gradient map per colourway, canonical first,
 * each named as its colourway is. A manager who adds, renames or recolours a colourway
 * changes what is offered, with no other file to keep in step, and a system with no
 * colourways offers none.
 *
 * The ids carry a prefix of their own, so a look made from a colourway never meets an
 * id a catalog's hand-written "icon-themes" or "photo-treatments" palette declared.
 * Hosts still resolve those older ids, so a piece made with one keeps its colours; they
 * are no longer offered.
 *
 * Every colour is a value the colourway already holds, except a photo's highlight,
 * which is the accent moved toward the colourway's surface in whole 8-bit steps, so
 * the same document gives the same bytes on every host.
 */

/** The prefix of an icon theme or photo treatment id made from a colourway. */
export const COLOURWAY_LOOK_PREFIX = 'colourway-';

/** The most colourways a strip offers. */
const MAX_COLOURWAY_LOOKS = 32;

/** An icon's base is its outline: it must hold on the colourway's surface. WCAG asks 3:1
 *  of a graphic; a thin icon stroke needs the 4.5:1 text asks for. */
const BASE_ON_SURFACE = 4.5;

/** A pairing's two tones must stand apart, or the icon reads as one colour. */
const TONES_APART = 2;

/** On a dark ground an icon's outline is a graphic: WCAG's 3:1 for non-text contrast. */
const ON_DARK_GROUND = 3;

/** On a dark ground the two tones are both light, so they need only this much apart. */
const ON_DARK_APART = 1.5;

/** The suffix of a colourway's pairing for dark grounds and photographs. */
export const ON_DARK_SUFFIX = '--on-dark';

/** A photo's shadow must be dark enough to hold the picture's depth. */
const SHADOW_ON_SURFACE = 7;

/** How far a photo's highlight moves from the accent toward the surface, out of 255. */
const HIGHLIGHT_TOWARD_SURFACE = 214;

/** The look id for a colourway: its option id, lowercased, each run of anything else one
 *  hyphen. A slug never holds two hyphens together, so `--on-dark` cannot meet one. */
export function colourwayLookId(option: string): string | null {
  const slug = option.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  return slug ? `${COLOURWAY_LOOK_PREFIX}${slug}` : null;
}

/** Is this theme or treatment id one made from a colourway? */
export const isColourwayLookId = (id: unknown): boolean => typeof id === 'string' && id.startsWith(COLOURWAY_LOOK_PREFIX);

/** One colourway's colours, as the looks read them. */
export interface ColourwayInks {
  /** The look id (`colourway-<option>`). */
  id: string;
  /** The colourway's name. */
  name: string;
  /** The icon accent (c1). */
  accent: string;
  /** The icon base (c2). */
  base: string;
  /** The icon pairing for a dark ground or a photograph: accent (c1) and base (c2). */
  onDarkAccent: string;
  onDarkBase: string;
  /** The photo gradient map, shadow to highlight. */
  shadow: string;
  mid: string;
  highlight: string;
}

const luminanceOrder = (hex: string): number => contrastRatio(hex, '#000000');
const chromaOf = (hex: string): number => hexToOklch(hex)?.c ?? 0;

/** Move `from` toward `to` by `step` out of 255, per 8-bit channel, in whole numbers. */
function towards(from: string, to: string, step: number): string {
  const ch = (hex: string, i: number): number => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => {
    const a = ch(from, i), b = ch(to, i);
    return Math.round(a + ((b - a) * step) / 255).toString(16).padStart(2, '0');
  }).join('')}`;
}

/** A deep tone of the accent's own hue, for a colourway with no text colour. */
const deepOf = (hex: string): string => {
  const c = hexToOklch(hex);
  return c ? oklchToHex({ l: 0.24, c: clamp(c.c * 0.5, 0.01, 0.06), h: c.h }) : '#111111';
};

/** The light and dark look selections of the document's mode group (both empty when it has none). */
function lookSelections(doc: unknown): { light: Record<string, string>; dark: Record<string, string> } {
  const mode = modeAxis(readTokenAxes(doc).axes);
  if (!mode?.options.length) return { light: {}, dark: {} };
  const named = (word: string) => mode.options.find((o) => o.id.toLowerCase() === word || o.name.toLowerCase() === word);
  const light = named('light') ?? mode.options.find((o) => o.id === mode.canonical) ?? mode.options[0]!;
  const dark = named('dark') ?? mode.options.find((o) => o !== light) ?? light;
  return { light: { [mode.group]: light.id }, dark: { [mode.group]: dark.id } };
}

/**
 * Each colourway's inks, canonical first. The icon pair: when the colourway's deeper
 * lead (light or dark look) holds as an outline on its surface and stands apart from the
 * lighter lead, the lighter lead is the accent and the deeper one the base, the way a
 * brand's own two-colour icons usually sit. Otherwise the more vivid lead is the accent
 * and the colourway's text colour (its ink) is the base. The photo map runs from the
 * deeper lead, or the ink when that lead is not dark enough, through the more vivid lead
 * to a pale tint of it on the colourway's surface. Empty when the document has no
 * colourways. A colourway whose lead does not resolve to a colour is left out.
 */
export function colourwayInks(doc: unknown): ColourwayInks[] {
  const axis = colourwayAxis(doc);
  if (!axis) return [];
  const looks = lookSelections(doc);
  const out: ColourwayInks[] = [];
  const seen = new Set<string>();
  for (const option of canonicalFirst(axis)) {
    if (out.length >= MAX_COLOURWAY_LOOKS) break;
    const id = colourwayLookId(option.id);
    if (!id || seen.has(id)) continue;
    const read = (look: Record<string, string>) => {
      const swatches = createTokenSet(doc, { selection: { ...look, [axis.group]: option.id } }).colors();
      return (...roles: string[]): string | null => {
        for (const role of roles) {
          const value = swatches.find((s) => s.path === `color.semantic.${role}`)?.value;
          const hex = typeof value === 'string' ? colorToHex(value) : null;
          if (hex && /^#[0-9a-f]{6}$/i.test(hex)) return hex.toLowerCase();
        }
        return null;
      };
    };
    const light = read(looks.light);
    const dark = looks.dark === looks.light ? light : read(looks.dark);
    const lead = light('primary');
    if (!lead) continue;
    const other = dark('primary') ?? lead;
    const surface = light('surface', 'background') ?? '#ffffff';
    const [lighter, deeper] = luminanceOrder(lead) >= luminanceOrder(other) ? [lead, other] : [other, lead];
    const vivid = chromaOf(other) > chromaOf(lead) ? other : lead;
    const ink = light('text', 'on-surface', 'foreground', 'on-background');
    const inkFor = (accent: string): string => (ink && contrastRatio(ink, accent) >= TONES_APART ? ink : deepOf(accent));
    const twoLeads = contrastRatio(deeper, surface) >= BASE_ON_SURFACE && contrastRatio(lighter, deeper) >= TONES_APART;
    const accent = twoLeads ? lighter : vivid;
    const base = twoLeads ? deeper : inkFor(accent);
    const shadow = contrastRatio(deeper, surface) >= SHADOW_ON_SURFACE ? deeper : inkFor(vivid);
    // A lead that is also the shadow would flatten the map's lower half: the other lead
    // carries the middle instead (a midnight lead with a mint partner runs midnight > mint).
    const mid = vivid === shadow ? lighter : vivid;
    // On a dark ground the base is the dark look's lead, when it holds there; the accent
    // is the colourway's own partner when that stands apart, else its text colour, else
    // whichever of the two stands further from the base.
    const ground = dark('surface', 'background') ?? '#000000';
    const onDarkBase = [other, lighter, dark('text', 'on-surface') ?? '#ffffff'].find((c) => contrastRatio(c, ground) >= ON_DARK_GROUND) ?? '#ffffff';
    const candidates = [dark('secondary'), dark('text', 'on-surface') ?? '#ffffff'].filter((c): c is string => !!c && c !== onDarkBase);
    const onDarkAccent = candidates.find((c) => contrastRatio(c, ground) >= ON_DARK_GROUND && contrastRatio(c, onDarkBase) >= ON_DARK_APART)
      ?? [...candidates].sort((a, b) => contrastRatio(b, onDarkBase) - contrastRatio(a, onDarkBase))[0] ?? '#ffffff';
    seen.add(id);
    out.push({ id, name: option.name || option.id, accent, base, onDarkAccent, onDarkBase, shadow, mid, highlight: towards(mid, surface, HIGHLIGHT_TOWARD_SURFACE) });
  }
  return out;
}

/** The icon themes a design system offers: one per colourway, canonical first. */
export function colourwayIconThemes(doc: unknown): IconTheme[] {
  return colourwayInks(doc).map((c) => ({ id: c.id, label: c.name, c1: c.accent, c2: c.base }));
}

/**
 * The colourway a render selection chose, as an option id: the selection's choice for the
 * colourway group, else a theme it names as active. Null when it names none, which reads
 * as the canonical colourway.
 */
export function activeColourwayOf(doc: unknown, selection?: { activeThemes?: readonly string[]; choices?: Readonly<Record<string, string>> } | null): string | null {
  const axis = colourwayAxis(doc);
  if (!axis || !selection) return null;
  const chosen = selection.choices?.[axis.group];
  if (chosen && axis.options.some((o) => o.id === chosen)) return chosen;
  const named = new Set(selection.activeThemes ?? []);
  return axis.options.find((o) => named.has(o.id) || named.has(o.name) || named.has(`${axis.group}/${o.name}`) || named.has(`${axis.group}/${o.id}`))?.id ?? null;
}

/**
 * Every colourway icon pairing an id can name, each with the grounds it is for: the
 * offered pairing (`surfaces: ['light']`) and, after it, the pairing for a dark ground or a
 * photograph (`<id>--on-dark`, `surfaces: ['dark', 'photo']`). An icon written as
 * `<id>?theme=auto` takes the first pairing for the ground under it (surface-variant.ts),
 * so the colourway named by `first` (the piece's own) leads; the rest follow canonical
 * first. Hosts resolve every id here; strips offer only `colourwayIconThemes`.
 */
export function colourwaySurfaceIconThemes(doc: unknown, first?: string | null): Array<IconTheme & { surfaces: string[] }> {
  const inks = colourwayInks(doc);
  const lead = first ? colourwayLookId(first) : null;
  const ordered = lead ? [...inks.filter((c) => c.id === lead), ...inks.filter((c) => c.id !== lead)] : inks;
  return ordered.flatMap((c) => [
    { id: c.id, label: c.name, c1: c.accent, c2: c.base, surfaces: ['light'] },
    { id: `${c.id}${ON_DARK_SUFFIX}`, label: `${c.name} on dark`, c1: c.onDarkAccent, c2: c.onDarkBase, surfaces: ['dark', 'photo'] },
  ]);
}

/** The photo treatments a design system offers: one gradient map per colourway, canonical first. */
export function colourwayPhotoTreatments(doc: unknown): PhotoTreatment[] {
  return colourwayInks(doc).map((c) => ({ id: c.id, label: c.name, kind: 'duotone', shadow: c.shadow, mid: c.mid, highlight: c.highlight }));
}

/**
 * Catalog facts with the colourway looks in front: each list holds the design system's
 * colourway looks, then whatever the pack's own palettes declare under another id. For the
 * readers that judge or redraw a piece already made (brand checks, partner recolours): the
 * icon list holds the dark-ground pairings too. What is offered is `colourwayIconThemes` alone.
 */
export function withColourwayLooks<T extends { iconThemes?: unknown; photoTreatments?: unknown }>(catalog: T | null | undefined, doc: unknown): T {
  const base = (catalog ?? {}) as T;
  const listOf = (raw: unknown, key: 'themes' | 'treatments'): unknown[] => {
    const v = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>)[key] : undefined;
    return Array.isArray(v) ? v : [];
  };
  let themes: IconTheme[] = [];
  let treatments: PhotoTreatment[] = [];
  try { themes = colourwaySurfaceIconThemes(doc); treatments = colourwayPhotoTreatments(doc); } catch { /* a document the reader cannot read adds nothing */ }
  if (!themes.length && !treatments.length) return base;
  const after = <L extends { id: string }>(ours: L[], theirs: unknown[]): unknown[] => {
    const ids = new Set(ours.map((x) => x.id));
    return [...ours, ...theirs.filter((x) => !(x && typeof x === 'object' && ids.has((x as { id?: unknown }).id as string)))];
  };
  return {
    ...base,
    iconThemes: { ...(base.iconThemes && typeof base.iconThemes === 'object' ? base.iconThemes : {}), themes: after(themes, listOf(base.iconThemes, 'themes')) },
    photoTreatments: { ...(base.photoTreatments && typeof base.photoTreatments === 'object' ? base.photoTreatments : {}), treatments: after(treatments, listOf(base.photoTreatments, 'treatments')) },
  };
}
