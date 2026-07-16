// SPDX-License-Identifier: MPL-2.0
/**
 * Brand mapper — the "make a foreign document look intentionally on-brand"
 * primitives (plan track E3, plans/fable-new-potential-pptx.md §E3). Given an
 * imported artefact's literal colours + font families, map each onto the active
 * brand's swatches/fonts so a rebrand reads as deliberate rather than
 * nearest-neighbour-random.
 *
 * Pure and deterministic: no DOM, no IO, no Date/Math.random. All colour maths
 * is reused from the engine's OKLab core — `deltaEOk` (color-tools.ts) for the
 * perceptual metric, `hexToOklch` (brand-derive.ts) for the chroma gate, and
 * `colorToHex` (tokens.ts) to normalise any imported colour form to hex first.
 * Nothing here re-derives colour maths.
 *
 * Scope: this is Stage 2 of the plan's two-stage scheme — the *perceptual*
 * residue mapper. Stage 1 (exact re-linking against an old theme's lumMod/lumOff
 * variant grid) and lightness-ordering-preserving slot+transform output are
 * DEFERRED to the pptx rewrite track; this module deliberately does nearest by
 * ΔEOK with the intentional-output guard rails (chroma gate, role hints,
 * many-to-one collapse, review threshold).
 *
 * Untrusted-input regime: colours/fonts arrive from hostile documents. Every
 * entry is validated (unparseable → dropped, never trusted downstream), and
 * input list lengths are capped so a malicious deck with millions of literals
 * cannot force unbounded work or allocation.
 */

import { deltaEOk } from './color-tools.ts';
import { hexToOklch } from './brand-derive.ts';
import type { Oklch } from './brand-derive.ts';
import { colorToHex } from './tokens.ts';

// ─── Caps (a hostile input is the threat model) ───────────────────────────────

// Brand swatch sets are author-controlled and small; an imported palette /
// font list is not. Bound both so mapPaletteToBrand's O(palette × swatches)
// work and every output Map stay finite.
const MAX_SWATCHES = 1024;
const MAX_PALETTE = 8192;
const MAX_FONTS = 4096;

// OKLCH chroma below this reads as achromatic ("neutral"). Greys sit at c≈0;
// even a faint tint clears it. Keeps a grey from ever snapping to a saturated
// accent, and a saturated source from collapsing onto a brand grey.
const NEUTRAL_CHROMA = 0.03;

// ΔEOK above this is flagged for human review instead of silently mapped
// (black↔white = 1; a just-noticeable difference ≈ 0.02, so 0.12 is a loose
// "same-ish colour" bound).
const DEFAULT_THRESHOLD = 0.12;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrandSwatch {
  name?: string;
  hex: string;
  role?: string;
}

export type RoleHint = 'bg' | 'ink' | 'accent' | 'neutral';

export interface NearestBrandColorOptions {
  /** Prefer swatches whose declared role matches this family, when roles are
   *  present (bg/ink/accent/neutral). Ignored if no swatch matches. */
  roleHint?: RoleHint;
  /** ΔEOK above which the result is marked `review:true`. Default 0.12. */
  threshold?: number;
}

export interface NearestBrandColor {
  hex: string;
  name?: string;
  role?: string;
  deltaE: number;
  review: boolean;
}

export interface BrandFonts {
  brand?: string;
  serif?: string;
  mono?: string;
}

// Role-family aliases: a brand may label swatches "surface"/"lt1"/"paper" etc.
// A hint matches a swatch role by substring, case-insensitive, so "accent-2"
// and "accentTeal" both count as an accent.
const ROLE_ALIASES: Record<RoleHint, string[]> = {
  bg: ['bg', 'background', 'surface', 'canvas', 'paper', 'base', 'lt1', 'lt2'],
  ink: ['ink', 'text', 'fg', 'foreground', 'body', 'dk1', 'dk2'],
  accent: ['accent', 'primary', 'secondary', 'brand', 'highlight'],
  neutral: ['neutral', 'grey', 'gray', 'muted', 'mono'],
};

// ─── Colour normalisation ─────────────────────────────────────────────────────

/**
 * Any imported colour form → a `#rrggbb(aa)` hex the OKLab core can read, or
 * null. Handles bare `RRGGBB` (the DrawingML `srgbClr val=` form, no `#`),
 * `#hex`, `rgb()/hsl()/oklch()`, and strips surrounding quotes; everything
 * `colorToHex` rejects (named idents, `transparent`, injection strings) is
 * treated as "no colour" so nothing untrusted flows downstream.
 */
function toBrandHex(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let s = input.trim().replace(/^['"]+|['"]+$/g, '').trim();
  if (!s) return null;
  // Bare hex (no leading '#') — the DrawingML literal form.
  if (/^[0-9a-fA-F]{3,4}$/.test(s) || /^[0-9a-fA-F]{6}$/.test(s) || /^[0-9a-fA-F]{8}$/.test(s)) {
    s = `#${s}`;
  }
  const hx = colorToHex(s);
  // Only a real hex is usable by hexToOklch/deltaEOk; reject idents/transparent.
  return typeof hx === 'string' && hx.startsWith('#') ? hx : null;
}

interface Candidate {
  hex: string; // normalised
  name?: string;
  role?: string;
  chroma: number;
}

function toCandidate(sw: BrandSwatch): Candidate | null {
  if (!sw || typeof sw !== 'object') return null;
  const hex = toBrandHex(sw.hex);
  if (!hex) return null;
  const oklch = hexToOklch(hex);
  if (!oklch) return null;
  const c: Candidate = { hex, chroma: oklch.c };
  if (typeof sw.name === 'string') c.name = sw.name;
  if (typeof sw.role === 'string') c.role = sw.role;
  return c;
}

function roleMatches(role: string, wanted: string[]): boolean {
  const r = role.trim().toLowerCase();
  if (!r) return false;
  return wanted.some(w => r === w || r.includes(w));
}

// ─── 1. nearestBrandColor ─────────────────────────────────────────────────────

/**
 * The nearest brand swatch to `hex` by OKLab ΔE, with the guard rails that make
 * a rebrand look intentional:
 *
 *  - **Chroma gate** — a neutral source (chroma < 0.03) only ever considers
 *    low-chroma brand swatches, and a chromatic source only chromatic swatches,
 *    so a grey never jumps to a saturated accent (or vice-versa). If a side of
 *    the gate is empty, it falls back to the full set (and the review threshold
 *    catches the stretch).
 *  - **Role hint** — with `opts.roleHint`, swatches whose declared role matches
 *    the family (bg/ink/accent/neutral) are preferred, when any match.
 *  - **Review flag** — `review:true` when the best ΔEOK exceeds
 *    `opts.threshold` (default 0.12), so the caller can surface it for a human
 *    instead of silently mapping a poor match.
 *
 * Returns null when the source or every swatch is unparseable.
 */
export function nearestBrandColor(
  hex: string,
  swatches: BrandSwatch[],
  opts: NearestBrandColorOptions = {},
): NearestBrandColor | null {
  const srcHex = toBrandHex(hex);
  if (!srcHex) return null;
  const srcOklch = hexToOklch(srcHex);
  if (!srcOklch) return null;

  if (!Array.isArray(swatches) || swatches.length === 0) return null;
  const cands: Candidate[] = [];
  for (const sw of swatches) {
    if (cands.length >= MAX_SWATCHES) break;
    const c = toCandidate(sw);
    if (c) cands.push(c);
  }
  if (cands.length === 0) return null;

  const threshold = Number.isFinite(opts.threshold)
    ? Math.max(0, opts.threshold as number)
    : DEFAULT_THRESHOLD;

  // Chroma gate: partition neutral vs chromatic; fall back to all if one side
  // is empty so we always return *something* (flagged for review if it's a
  // stretch) rather than null.
  const srcNeutral = srcOklch.c < NEUTRAL_CHROMA;
  let pool = cands.filter(c => (c.chroma < NEUTRAL_CHROMA) === srcNeutral);
  if (pool.length === 0) pool = cands;

  // Role hint: prefer role-matching swatches when any exist in the pool.
  const hint = opts.roleHint;
  if (hint && ROLE_ALIASES[hint]) {
    const wanted = ROLE_ALIASES[hint];
    const roled = pool.filter(c => c.role != null && roleMatches(c.role, wanted));
    if (roled.length > 0) pool = roled;
  }

  let best: Candidate | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const c of pool) {
    const d = deltaEOk(srcHex, c.hex);
    if (!Number.isFinite(d)) continue;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (!best || !Number.isFinite(bestD)) return null;

  const out: NearestBrandColor = { hex: best.hex, deltaE: bestD, review: bestD > threshold };
  if (best.name != null) out.name = best.name;
  if (best.role != null) out.role = best.role;
  return out;
}

// ─── 2. mapPaletteToBrand ─────────────────────────────────────────────────────

/**
 * Map every source colour in `palette` to its nearest brand swatch, returning
 * `originalHex -> brandHex`. Near-duplicate sources collapse many-to-one on the
 * value side (they resolve to the same brand hex). Unparseable / unmappable
 * sources are omitted. Exact-duplicate source strings are computed once.
 */
export function mapPaletteToBrand(
  palette: string[],
  swatches: BrandSwatch[],
  opts: NearestBrandColorOptions = {},
): Map<string, string> {
  const out = new Map<string, string>();
  if (!Array.isArray(palette)) return out;
  let seen = 0;
  for (const raw of palette) {
    if (seen >= MAX_PALETTE) break;
    seen++;
    if (typeof raw !== 'string') continue;
    if (out.has(raw)) continue;
    const res = nearestBrandColor(raw, swatches, opts);
    if (res) out.set(raw, res.hex);
  }
  return out;
}

// ─── 3. mapFontsToBrand ───────────────────────────────────────────────────────

// Static classification of the Office/common font universe. Keyed by the
// lower-cased, quote-stripped family name.
type FontClass = 'sans' | 'serif' | 'mono';
const FONT_CLASS: Record<string, FontClass> = {
  // Sans → brand
  calibri: 'sans',
  arial: 'sans',
  'arial narrow': 'sans',
  'segoe ui': 'sans',
  helvetica: 'sans',
  'helvetica neue': 'sans',
  verdana: 'sans',
  tahoma: 'sans',
  aptos: 'sans',
  'aptos display': 'sans',
  // Serif → serif (fallback brand)
  cambria: 'serif',
  'times new roman': 'serif',
  georgia: 'serif',
  garamond: 'serif',
  'book antiqua': 'serif',
  // Mono → mono
  consolas: 'mono',
  'courier new': 'mono',
  'lucida console': 'mono',
  monaco: 'mono',
};

// Normalise a family entry for classification: take the first family of a CSS
// stack, strip surrounding quotes, collapse internal whitespace, lower-case.
function normFamilyKey(family: string): string {
  let s = family.trim();
  const comma = s.indexOf(',');
  if (comma >= 0) s = s.slice(0, comma);
  s = s.trim().replace(/^['"]+|['"]+$/g, '').trim();
  return s.replace(/\s+/g, ' ').toLowerCase();
}

function targetForClass(cls: FontClass, fonts: BrandFonts): string | undefined {
  if (cls === 'serif') return fonts.serif ?? fonts.brand;
  if (cls === 'mono') return fonts.mono ?? fonts.brand;
  return fonts.brand; // sans + unknown
}

/**
 * Map source font families onto brand fonts via a static classification table
 * (case-insensitive, quotes trimmed): sans faces (Calibri/Arial/Segoe UI/…) and
 * anything unrecognised → `brand`; serif faces (Cambria/Times New Roman/…) →
 * `serif`, falling back to `brand`; mono faces (Consolas/Courier New/…) →
 * `mono`, falling back to `brand`.
 *
 * Returns `originalFamily -> brandFamily`. An entry is omitted when its resolved
 * target font is absent (e.g. no `brand` configured) so the Map only carries
 * real substitutions.
 */
export function mapFontsToBrand(families: string[], brandFonts: BrandFonts): Map<string, string> {
  const out = new Map<string, string>();
  if (!Array.isArray(families) || !brandFonts || typeof brandFonts !== 'object') return out;
  let seen = 0;
  for (const raw of families) {
    if (seen >= MAX_FONTS) break;
    seen++;
    if (typeof raw !== 'string') continue;
    if (out.has(raw)) continue;
    const key = normFamilyKey(raw);
    if (!key) continue;
    const cls = FONT_CLASS[key] ?? 'sans'; // unknown → brand (sans path)
    const target = targetForClass(cls, brandFonts);
    if (typeof target === 'string' && target.length > 0) out.set(raw, target);
  }
  return out;
}
