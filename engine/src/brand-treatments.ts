// SPDX-License-Identifier: MPL-2.0
/**
 * Brand-derived photo treatments + icon duo themes.
 *
 * The photo-treatment (photo-treatment.ts) and icon-theme (icon-theme.ts)
 * machinery is generic: shells discover a palette-type asset tagged
 * "photo-treatments" / "icon-themes" and offer its entries on every photo and
 * themable icon. Historically those docs were hand-authored per brand, so a
 * freshly ingested (or blank starter) brand shipped inert strips. This module
 * derives serviceable docs from a brand token document — or its resolved
 * swatches — so every brand gets the same one-tap treatments a hand-tuned
 * catalog has. The tuning constants are calibrated against the hand-authored
 * SUSE docs (duotone shadows ≈ L 0.2–0.3 / C ≤ 0.075, highlights ≈ L 0.93).
 *
 * Pure and deterministic (no Date/random/IO): same input, byte-identical docs.
 * Tolerant of thin palettes — with no chromatic swatch the treatments doc still
 * carries greyscale, and the themes list comes back EMPTY: callers must skip
 * writing an icon-themes asset then (the catalog validator rejects a doc whose
 * themes[] is empty). Both outputs parse cleanly through the runtime readers
 * (parsePhotoTreatmentsDoc / parseIconThemesDoc) — a test enforces it.
 */

import type { PhotoTreatment } from './photo-treatment.ts';
import type { IconTheme } from './icon-theme.ts';
import type { BrandSwatch } from './brand-map.ts';
import { hexToOklch, oklchToHex } from './brand-derive.ts';
import { colorToHex, createTokenSet } from './tokens.ts';

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
// untrusted JSON — a pathological doc must not turn selection quadratic.
const MAX_SWATCHES = 1024;

// Below this OKLCH chroma a swatch reads as grey — never an accent.
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

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
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
   * scoring. Structural only — free-text descriptions would false-positive
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
 * Normalise the source — a DTCG token document (aliases/themes resolved via
 * createTokenSet) or an already-resolved BrandSwatch[] — into deduped OKLCH
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
      // Token path (or a BrandSwatch's declared role) — a swatch NAME scores
      // only when no structural hint exists at all.
      role: (sw.role ?? sw.name ?? '').toLowerCase(),
    });
  }
  return out;
}

// Accent hues, most-brandful first: role score, then chroma, then hex (a total
// order, so selection never depends on sort stability), greedily hue-clustered
// so each 30° neighbourhood contributes one representative.
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

// The darkest swatch dark enough to serve as an icon base ("ink"), preferring
// chromatic darks (SUSE's ink is a dark pine, not a grey) — or null.
function pickInk(cands: Cand[]): Cand | null {
  const dark = cands.filter(c => c.l <= 0.45);
  if (!dark.length) return null;
  return dark.sort((a, b) => a.l - b.l || b.c - a.c || a.hex.localeCompare(b.hex))[0]!;
}

// The soft duotone shadow for an accent hue — deep, chroma-tamed so the wash
// stays a treatment rather than a colour cast.
function duotoneShadow(a: Cand): string {
  return oklchToHex({ l: 0.26, c: clamp(a.c * 0.5, 0.02, 0.075), h: a.h });
}

/**
 * Derive a photo-treatments palette doc from a brand token document (or
 * resolved BrandSwatch[]): greyscale, one soft duotone wash per selected
 * accent hue (the brand primary first), and — when any accent exists — a
 * three-stop "deep" tritone (black → primary shadow → primary accent).
 * Every entry survives parsePhotoTreatmentsDoc unchanged.
 */
export function derivePhotoTreatmentsDoc(source: unknown): DerivedPhotoTreatments {
  const accents = pickAccents(toCandidates(source));
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
    // A dark primary would invert the ramp (highlight below mid) — lift it.
    const highlight = p.l < 0.55 ? oklchToHex({ l: 0.62, c: p.c, h: p.h }) : p.hex;
    treatments.push({
      id: 'deep', label: 'Deep', kind: 'duotone',
      shadow: '#000000', mid, highlight, previewBg: mid,
    });
  }
  return {
    name: 'Photo Colour Treatments',
    description:
      'Colour treatments for photo assets, derived from the brand palette: greyscale plus soft two-colour duotone washes (shadow maps to shadows, highlight to highlights) and a three-stop deep tritone. Chosen at pick time and baked into a self-contained SVG at resolve. \'None\' is the plain photo (no id suffix).',
    treatments,
  };
}

/**
 * Derive an icon-themes palette doc from a brand token document (or resolved
 * BrandSwatch[]). First pairing is 'brand' (primary accent over the brand
 * ink) — the default pairing contract — then a light 'tint' of the primary,
 * one pairing per extra accent hue, and 'paper' (white on light grey, with
 * the ink as previewBg). Empty `themes` when the palette has no accent —
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
      // A light accent IS its own tint — pairing it with itself says nothing.
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
