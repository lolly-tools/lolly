// SPDX-License-Identifier: MPL-2.0
/**
 * Colour tools — perceptual metrics and ramp math on top of brand-derive's
 * OKLab core. The adopt/port decision behind this module is
 * plans/archive/chroma-eval.md: the handful of load-bearing algorithms from chroma.js
 * are ported and re-based onto OKLab (better hue uniformity than the CIELAB
 * originals, and every emitted colour rides `oklchToHex`'s chroma-reduction
 * gamut mapping instead of channel clipping); everything the engine already
 * owned (conversions, WCAG contrast, ramp *generation*) stays in
 * brand-derive.ts untouched.
 *
 * Pure and deterministic throughout: no Date, no Math.random, no IO. Colour
 * inputs accept hex (#rgb…#rrggbbaa) or `oklch()`/`lch()` strings — the two
 * forms brand tokens are stored in; normalise anything else with
 * tokens.ts#colorToHex first. Metrics return NaN on unparseable input (the
 * contrastRatio convention: every `>= floor` check honestly fails); ramp
 * generation throws (the deriveBrandTokens convention: bad input is an
 * authoring error, not a comparison).
 *
 * Ported-from-chroma.js notice (applies to apcaContrast, rampOklab's
 * lightness-correction bisection and bezier blend, and classBreaks):
 *
 *   chroma.js — Copyright (c) 2011-2025, Gregor Aisch. All rights reserved.
 *   Redistribution and use in source and binary forms, with or without
 *   modification, are permitted provided that the following conditions are
 *   met: (1) redistributions of source code must retain the above copyright
 *   notice, this list of conditions and the following disclaimer;
 *   (2) redistributions in binary form must reproduce them in the
 *   documentation and/or other materials provided with the distribution;
 *   (3) neither the name of the copyright holder nor the names of its
 *   contributors may be used to endorse or promote products derived from
 *   this software without specific prior written permission.
 *   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 *   "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES ARE DISCLAIMED. IN NO
 *   EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY DIRECT OR INDIRECT
 *   DAMAGES ARISING FROM THE USE OF THIS SOFTWARE.
 *   (Full text: https://github.com/gka/chroma.js/blob/main/LICENSE)
 */

import { hexToOklch, oklchToHex, parseOklch, parseHex, contrastRatio } from './brand-derive.ts';
import type { Oklch } from './brand-derive.ts';
import { generateSchemeAccents } from './brand-schemes.ts';
import { oklchGamut, inGamut, maxChroma, oklchSlice, sliceGamutRegion } from './gamut.ts';
import { parseColor, colorToHexString, interpolateColor } from './css-color.ts';
import { gradientSpecToCss } from './gradient-spec.ts';
import { parseIccProfile, iccGamutSource, iccGamutIntent } from './icc.ts';
import {
  paletteTokensJson, paletteCssVariables, paletteCssClasses,
  paletteScssVariables, paletteGpl, paletteAse,
} from './palette-export.ts';
import type { GamutSource, GamutLimit } from './gamut-source.ts';
import type { ColorAPI, ColorProfileGamut, ColorRenderingIntent } from './bridge/host-v1.ts';

// ─── Input parsing / OKLab plumbing ───────────────────────────────────────────

const normHue = (h: number): number => ((h % 360) + 360) % 360;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

// Hex or oklch()/lch() string → OKLCH (the stored-token forms), else null.
function toOklch(input: string): Oklch | null {
  const s = String(input).trim();
  return s.startsWith('#') ? hexToOklch(s) : parseOklch(s);
}

type Lab = [number, number, number]; // OKLab: L 0–1, a, b

// OKLCH ↔ OKLab. Exact inverses of each other; alpha is deliberately dropped
// (these tools measure and generate opaque colour).
function oklchToLab(c: Oklch): Lab {
  const hr = (c.h * Math.PI) / 180;
  return [c.l, c.c * Math.cos(hr), c.c * Math.sin(hr)];
}
function labToOklch(L: number, a: number, b: number): Oklch {
  const c = Math.hypot(a, b);
  return { l: L, c, h: c < 1e-7 ? 0 : normHue((Math.atan2(b, a) * 180) / Math.PI) };
}

function toLab(input: string): Lab | null {
  const c = toOklch(input);
  return c ? oklchToLab(c) : null;
}

// ─── ΔEOK — perceptual colour difference ──────────────────────────────────────

/**
 * ΔEOK: Euclidean distance in OKLab (CSS Color 4's deltaE for gamut mapping).
 * 0 = identical; black↔white = 1; a just-noticeable difference is ≈ 0.02.
 * Symmetric. NaN when either input is unparseable. Cheap enough to run
 * per-swatch on every picker change (a handful of multiplies).
 */
export function deltaEOk(aColor: string, bColor: string): number {
  const a = toLab(aColor);
  const b = toLab(bColor);
  if (!a || !b) return NaN;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// ─── APCA contrast (advisory) ─────────────────────────────────────────────────

// APCA-W3, APCA-1.0.98G constants — ported from chroma.js
// src/utils/contrastAPCA.js (BSD-3-Clause, see module header); algorithm by
// Andrew Somers / Myndex (https://github.com/Myndex/SAPC-APCA). The constants
// are the spec's magic numbers; do not "clean them up".
const SA98G = {
  exponents: { mainTRC: 2.4, normBG: 0.56, normTXT: 0.57, revTXT: 0.62, revBG: 0.65 },
  colorSpace: { sRco: 0.2126729, sGco: 0.7151522, sBco: 0.072175 },
  clamps: { blkThrs: 0.022, blkClmp: 1.414, loClip: 0.1, deltaYmin: 0.0005 },
  scalers: { scaleBoW: 1.14, loBoWoffset: 0.027, scaleWoB: 1.14, loWoBoffset: 0.027 },
} as const;

// Any accepted colour → sRGB bytes. Non-hex forms round-trip through the
// gamut-mapped encoder, so an out-of-sRGB oklch() is measured as the colour
// that would actually render.
function toRgbBytes(input: string): [number, number, number, number] | null {
  const s = String(input).trim();
  if (s.startsWith('#')) return parseHex(s);
  const c = parseOklch(s);
  return c ? parseHex(oklchToHex(c)) : null;
}

// APCA's screen luminance: simple 2.4-gamma (deliberately not piecewise sRGB —
// the spec models real monitors), then the soft black-level clamp.
function apcaY(r: number, g: number, b: number): number {
  const { mainTRC } = SA98G.exponents;
  const { sRco, sGco, sBco } = SA98G.colorSpace;
  const y = sRco * (r / 255) ** mainTRC + sGco * (g / 255) ** mainTRC + sBco * (b / 255) ** mainTRC;
  const { blkThrs, blkClmp } = SA98G.clamps;
  return y > blkThrs ? y : y + (blkThrs - y) ** blkClmp;
}

/**
 * APCA-W3 lightness contrast Lc between text and background (APCA-1.0.98G).
 * Signed: positive for dark-on-light, negative for light-on-dark; |Lc| 60 ≈
 * body-text comfortable, 75 ≈ small text, 90 ≈ thin fonts. Text alpha < 1 is
 * composited onto the background first (background alpha is ignored — APCA
 * assumes an opaque bg). NaN when either input is unparseable.
 *
 * ADVISORY ONLY: APCA is beta/non-normative. WCAG 2.1 (`contrastRatio` +
 * deriveBrandTokens' floors) remains the enforced compliance number — this
 * exists because WCAG 2.1 misjudges dark-mode and mid-tone pairs, exactly
 * where brand authors pick colours.
 */
export function apcaContrast(textColor: string, bgColor: string): number {
  const txt = toRgbBytes(textColor);
  const bg = toRgbBytes(bgColor);
  if (!txt || !bg) return NaN;
  // Composite translucent text onto the (opaque) background, in sRGB bytes —
  // matching chroma.js's mix-in-rgb pre-step.
  const a = txt[3];
  const t: [number, number, number] =
    a >= 1 ? [txt[0], txt[1], txt[2]]
      : [txt[0] * a + bg[0] * (1 - a), txt[1] * a + bg[1] * (1 - a), txt[2] * a + bg[2] * (1 - a)];

  const ytxt = apcaY(t[0], t[1], t[2]);
  const ybg = apcaY(bg[0], bg[1], bg[2]);
  const { normBG, normTXT, revTXT, revBG } = SA98G.exponents;
  const { loClip, deltaYmin } = SA98G.clamps;
  const { scaleBoW, loBoWoffset, scaleWoB, loWoBoffset } = SA98G.scalers;

  if (Math.abs(ybg - ytxt) < deltaYmin) return 0;
  let sapc: number;
  if (ybg > ytxt) {
    // Normal polarity: dark text on light background.
    sapc = (ybg ** normBG - ytxt ** normTXT) * scaleBoW;
    return sapc < loClip ? 0 : (sapc - loBoWoffset) * 100;
  }
  // Reverse polarity: light text on dark background (negative Lc).
  sapc = (ybg ** revBG - ytxt ** revTXT) * scaleWoB;
  return sapc > -loClip ? 0 : (sapc + loWoBoffset) * 100;
}

/**
 * A note for any UI that shows an Lc, so every surface says it the same way.
 *
 * `apcaContrast` reads hex and `oklch()` and returns **NaN** for anything else —
 * including `color(display-p3 …)`. That is not a gap to paper over: APCA is fitted
 * to sRGB and has no published extension to a wider gamut, so a wide-gamut colour
 * has to be scored on its sRGB rendering. Pass `describeColor(...).srgbHex`, which
 * also keeps the Lc describing the same colour the WCAG ratio describes.
 */
export const APCA_SRGB_ONLY =
  'APCA is defined for sRGB, so a wide-gamut colour is scored on its sRGB rendering.';

/**
 * What an Lc is good for.
 *
 * APCA's own published guidance, stated as what the pair CAN carry rather than as
 * pass/fail — its whole model is that contrast and text size trade off against each
 * other, so "fail" is not meaningful until you know the size. That is also why this
 * is a band and not a boolean: `wcagLevel` can say AA/AAA because WCAG 2 fixes the
 * sizes; APCA cannot, and inventing a pass here would misrepresent it.
 */
export type ApcaUse =
  | 'body-preferred'   // |Lc| 90+ — fluent body text, any normal size or weight
  | 'body-minimum'     // |Lc| 75+ — body text, minimum
  | 'large-text'       // |Lc| 60+ — 24px, or 16px bold
  | 'headline'         // |Lc| 45+ — 36px, or 24px bold
  | 'non-text'         // |Lc| 30+ — icons, borders, disabled states
  | 'invisible';       // under 30 — not usable for anything meaningful

/** The floor of each band, high to low. */
export const APCA_BANDS: ReadonlyArray<{ min: number; use: ApcaUse; label: string }> = [
  { min: 90, use: 'body-preferred', label: 'Body text, comfortably' },
  { min: 75, use: 'body-minimum', label: 'Body text, minimum' },
  { min: 60, use: 'large-text', label: 'Large text — 24px, or 16px bold' },
  { min: 45, use: 'headline', label: 'Headlines — 36px, or 24px bold' },
  { min: 30, use: 'non-text', label: 'Icons and borders only' },
  { min: 0, use: 'invisible', label: 'Not usable' },
];

/** The band a (signed or unsigned) Lc falls in. The sign never shifts the band. */
export function apcaUse(lc: number): ApcaUse {
  const a = Math.abs(lc);
  if (!Number.isFinite(a)) return 'invisible';
  return (APCA_BANDS.find(b => a >= b.min) ?? APCA_BANDS[APCA_BANDS.length - 1]!).use;
}

export interface ApcaVerdict {
  /** Signed Lc: positive for dark-on-light, negative for light-on-dark. */
  lc: number;
  /** Magnitude, which is what the bands are keyed on. */
  abs: number;
  /** True when the text is LIGHTER than its background. Kept because this is the
   *  one thing WCAG 2's ratio cannot tell you — it scores both polarities alike. */
  reversed: boolean;
  use: ApcaUse;
  /** A short phrase for the band, ready to show. */
  label: string;
}

/** `apcaContrast` plus its band, or null when either colour is unreadable. */
export function apcaVerdict(text: string, bg: string): ApcaVerdict | null {
  const lc = apcaContrast(text, bg);
  if (!Number.isFinite(lc)) return null;
  const use = apcaUse(lc);
  return {
    lc,
    abs: Math.abs(lc),
    reversed: lc < 0,
    use,
    label: (APCA_BANDS.find(b => b.use === use) ?? APCA_BANDS[APCA_BANDS.length - 1]!).label,
  };
}

/** The result of {@link solveLightnessForApca}. */
export interface ApcaSolveResult {
  /** Solved OKLCH lightness (0–1) — the colour whose forward APCA Lc is closest
   *  to the requested magnitude within the correct polarity branch. */
  l: number;
  /** Chroma actually used at `l`, clamped into `limit`'s gamut (≤ the request). */
  chroma: number;
  /** The hue passed through, unchanged. */
  hue: number;
  /** The solved colour, gamut-mapped hex (via `oklchToHex`). */
  hex: string;
  /** Signed forward `apcaContrast(hex, bgHex)` this colour ACTUALLY achieves —
   *  positive for dark-on-light, negative for light-on-dark. */
  lc: number;
  /** Signed target: `|targetLc|` carrying the polarity forced by the background. */
  target: number;
  /** False when the target magnitude exceeds the most this hue/chroma can reach
   *  against this background — then `hex`/`lc` are the closest achievable. */
  reachable: boolean;
}

export interface ApcaSolveOptions {
  /** Gamut the solved chroma is clamped into (default 'srgb'). */
  limit?: GamutLimit;
  /** Initial lightness-scan resolution (default 512). More = a tighter max on
   *  the unreachable path; the reachable path is exact by bisection regardless. */
  samples?: number;
}

/**
 * Invert `apcaContrast`: the OKLCH lightness at a fixed `hue`/`chroma` whose
 * forward APCA Lc against `bgHex` is closest to `|targetLc|`.
 *
 * APCA is NOT monotonic across the whole [0,1] lightness range — it flips
 * polarity where text luminance crosses the background's, and its soft
 * black-level clamp bends contrast back DOWN for near-black text, so a naive
 * bisection over all of L lands in the wrong place. So the polarity is fixed up
 * front from the background (dark text on a light bg, light text on a dark one),
 * the maximum achievable contrast is located by a lightness scan, and the target
 * is then reached by bisection on the single monotonic stretch between that
 * maximum and the zero-contrast boundary — never across the near-black dip. The
 * gentle side is chosen deliberately: the LEAST extreme lightness that meets the
 * target, i.e. the one nearest the background's own lightness.
 *
 * Chroma is clamped to `maxChroma(l, hue, limit)` at the solved lightness (the
 * `nudged()` precedent in brand-derive.ts), so the returned colour is real.
 *
 * When `|targetLc|` is beyond what this hue/chroma can carry against this
 * background (e.g. a target past the near-black floor), `reachable` is false and
 * the closest achievable colour — the contrast maximum — is returned.
 */
export function solveLightnessForApca(
  hue: number,
  chroma: number,
  targetLc: number,
  bgHex: string,
  opts: ApcaSolveOptions = {},
): ApcaSolveResult {
  const h = normHue(hue);
  const cReq = Math.max(0, chroma);
  const limit = opts.limit ?? 'srgb';
  const wantMag = Math.abs(targetLc);

  const hexAt = (L: number): string => {
    const cl = clamp(L, 0, 1);
    const c = Math.min(cReq, maxChroma(cl, h, limit));
    return oklchToHex({ l: cl, c, h });
  };
  const build = (L: number, reachable: boolean, sign: number): ApcaSolveResult => {
    const cl = clamp(L, 0, 1);
    const chr = Math.min(cReq, maxChroma(cl, h, limit));
    const hex = oklchToHex({ l: cl, c: chr, h });
    return {
      l: cl, chroma: chr, hue: h, hex,
      lc: apcaContrast(hex, bgHex),
      target: sign * wantMag,
      reachable,
    };
  };

  // Background unparseable → nothing to solve against; report unreachable.
  if (!toRgbBytes(bgHex)) {
    return { l: NaN, chroma: NaN, hue: h, hex: '', lc: NaN, target: NaN, reachable: false };
  }

  // Fix polarity from the background: whichever extreme (black or white text)
  // carries MORE contrast is the branch we solve in. On a light bg that is black
  // (dark-on-light, positive Lc); on a dark bg it is white (light-on-dark,
  // negative Lc). This is the luminance question apcaContrast already answers, so
  // we ask it rather than re-deriving a threshold.
  const cBlack = apcaContrast('#000000', bgHex);
  const cWhite = apcaContrast('#ffffff', bgHex);
  const s = Math.abs(cBlack) >= Math.abs(cWhite)
    ? (cBlack < 0 ? -1 : 1)
    : (cWhite < 0 ? -1 : 1);

  // Signed contrast projected onto our polarity: positive throughout the correct
  // branch, ≤ 0 once we cross the background's lightness into the wrong polarity.
  const g = (L: number): number => s * apcaContrast(hexAt(L), bgHex);

  // Locate the contrast MAXIMUM by scan, then refine locally. The scan is what
  // steps over the near-black dip instead of bisecting into it.
  const N = Math.max(16, Math.floor(opts.samples ?? 512));
  const argmax = (lo: number, hi: number, steps: number): { L: number; v: number } => {
    let bL = lo, bV = -Infinity;
    for (let i = 0; i <= steps; i++) {
      const L = lo + ((hi - lo) * i) / steps;
      const v = g(L);
      if (Number.isFinite(v) && v > bV) { bV = v; bL = L; }
    }
    return { L: bL, v: bV };
  };
  const coarse = argmax(0, 1, N);
  const span = 1 / N;
  const fine = argmax(Math.max(0, coarse.L - span), Math.min(1, coarse.L + span), 64);
  const peak = fine.v >= coarse.v ? fine : coarse;
  const maxContrast = peak.v;

  // Target beyond the branch's ceiling → closest achievable is the maximum.
  const TOL = 1e-3;
  if (!(maxContrast > 0) || wantMag > maxContrast + TOL) {
    return build(peak.L, false, s);
  }

  // Reachable: g is monotonic-decreasing from the peak out to the wrong-polarity
  // endpoint (L=1 for dark text, L=0 for light), passing through the target once.
  // Bisect only that stretch — never the near-black side of the peak.
  let a = peak.L;                 // g(a) = max ≥ wantMag
  let b = s > 0 ? 1 : 0;          // g(b) ≤ 0 ≤ wantMag
  for (let k = 0; k < 80; k++) {
    const mid = (a + b) / 2;
    if (g(mid) > wantMag) a = mid; else b = mid;
  }
  return build((a + b) / 2, true, s);
}

// ─── Perceptual ramps — bezier through OKLab + lightness correction ───────────

// Degree-(k−1) Bernstein blend through k control points, one component at a
// time — chroma.js's generator/bezier.js scheme run in OKLab instead of
// CIELAB. Endpoints are interpolated exactly; middle stops are CONTROL points
// (pulled toward, not through) — that is what keeps multi-hue ramps smooth.
function bezierAt(points: Lab[], t: number): Lab {
  const n = points.length - 1;
  if (n === 0) return points[0]!;
  // Pascal's row for the binomial coefficients (exact for our small degrees).
  const row: number[] = [1];
  for (let i = 1; i <= n; i++) row.push((row[i - 1]! * (n - i + 1)) / i);
  const out: Lab = [0, 0, 0];
  for (let i = 0; i <= n; i++) {
    const w = row[i]! * (1 - t) ** (n - i) * t ** i;
    out[0] += w * points[i]![0];
    out[1] += w * points[i]![1];
    out[2] += w * points[i]![2];
  }
  return out;
}

export interface RampOptions {
  /** Re-space samples so OKLab lightness steps are perceptually even between
   *  the endpoint lightnesses (chroma.js `scale().correctLightness()`, re-based
   *  onto OKLab: per-sample bisection, ≤ 20 iterations). Default false. */
  correctLightness?: boolean;
}

/**
 * `n` colours along a smooth curve through `stops` (hex or `oklch()`/`lch()`
 * strings): a Bézier through the stops' OKLab coordinates — 2 stops = linear,
 * 3 = quadratic, 4 = cubic, more = degree-(k−1). Output is gamut-mapped hex
 * (via `oklchToHex`), endpoints exact. With `correctLightness`, sample
 * positions are bisected so lightness moves in even perceptual steps —
 * chroma.js's canonical "good multi-hue scale" recipe (bezier +
 * correctLightness), in OKLab.
 *
 * Throws on an unparseable stop or an empty stop list (authoring error).
 * `n <= 0` returns `[]`; `n === 1` returns the first stop.
 */
export function rampOklab(stops: string[], n: number, opts: RampOptions = {}): string[] {
  if (!Array.isArray(stops) || stops.length === 0) {
    throw new Error('rampOklab: at least one stop is required');
  }
  const points = stops.map((s, i) => {
    const lab = toLab(s);
    if (!lab) throw new Error(`rampOklab: unparseable stop ${i}: ${JSON.stringify(s)}`);
    return lab;
  });
  const count = Math.floor(n);
  if (count <= 0) return [];

  const L0 = points[0]![0];
  const L1 = points[points.length - 1]![0];
  // Ported bisection (chroma.js generator/scale.js correctLightness): find the
  // curve position whose OKLab L matches the linear ideal between the endpoint
  // lightnesses. OKLab L is monotone in perceived lightness, so the root-find
  // transfers unchanged; tolerance 1e-4 on the 0–1 scale ≈ the original 0.01
  // on CIELAB's 0–100. Skipped when the endpoints share a lightness (a level
  // ramp has nothing to equalise).
  const correct = opts.correctLightness === true && Math.abs(L1 - L0) > 1e-6;
  const tFor = (t: number): number => {
    if (!correct) return t;
    const ideal = L0 + (L1 - L0) * t;
    let lo = 0;
    let hi = 1;
    let mid = t;
    for (let i = 0; i < 20; i++) {
      const dl = bezierAt(points, mid)[0] - ideal;
      if (Math.abs(dl) <= 1e-4) break;
      // On a descending ramp (L0 > L1) an overshoot means we are too EARLY.
      if (dl * Math.sign(L1 - L0) > 0) hi = mid;
      else lo = mid;
      mid = (lo + hi) / 2;
    }
    return mid;
  };

  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const [L, a, b] = bezierAt(points, tFor(t));
    out.push(oklchToHex(labToOklch(clamp(L, 0, 1), a, b)));
  }
  return out;
}

// ─── Class breaks — data-driven bins for chart scales ─────────────────────────

/**
 * `n + 1` class boundaries over `data` for binning values onto a colour ramp
 * (chroma.js `limits()`, the clean modes): `'e'` equal intervals, `'l'`
 * log₁₀-spaced (throws unless every value is positive), `'q'` quantiles
 * (linear interpolation between sorted ranks). Non-finite entries are
 * ignored; an empty (or all-non-finite) dataset returns `[]`. The upstream
 * k-means mode is deliberately not ported — its assignment loop counts every
 * point once per centroid (plans/archive/chroma-eval.md §5).
 */
export function classBreaks(data: number[], mode: 'e' | 'l' | 'q', n: number): number[] {
  const values = (Array.isArray(data) ? data : []).filter(v => Number.isFinite(v));
  if (values.length === 0) return [];
  const bins = Math.max(1, Math.floor(n));
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (mode === 'e') {
    return Array.from({ length: bins + 1 }, (_, i) => min + ((max - min) * i) / bins);
  }
  if (mode === 'l') {
    if (min <= 0) {
      throw new Error('classBreaks: log mode needs every value > 0');
    }
    const lmin = Math.log10(min);
    const lmax = Math.log10(max);
    return Array.from({ length: bins + 1 }, (_, i) => 10 ** (lmin + ((lmax - lmin) * i) / bins));
  }
  // 'q' — quantiles with linear interpolation between sorted ranks.
  const sorted = [...values].sort((a, b) => a - b);
  return Array.from({ length: bins + 1 }, (_, i) => {
    const pos = ((sorted.length - 1) * i) / bins;
    const lo = Math.floor(pos);
    const hi = Math.min(sorted.length - 1, lo + 1);
    return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
  });
}

// ─── Distinct categorical colours ─────────────────────────────────────────────

export interface DistinctColorsOptions {
  /** Brand anchor: the first colour verbatim, and the pool's lightness/chroma/
   *  hue base. Unparseable or absent → a neutral mid-tone default. */
  anchorHex?: string;
  /** Minimum pairwise ΔEOK. Selection stops early (returns fewer than `n`)
   *  once no remaining candidate clears it. Default 0.02 (≈ one JND). */
  minDeltaE?: number;
}

/**
 * Up to `n` visually distinct categorical colours (chart series), seeded from
 * a brand anchor. chroma.js has no equivalent (its categorical story is
 * ColorBrewer data) — this is the OKLCH generator sketched in
 * plans/archive/chroma-eval.md: a structured candidate pool around the anchor's
 * lightness/chroma (24 hues × 3 lightness × 2 chroma levels), picked by
 * greedy maximin ΔEOK. Deterministic: same inputs, same palette; the anchor
 * itself (gamut-mapped) is always the first colour.
 */
export function distinctColors(n: number, opts: DistinctColorsOptions = {}): string[] {
  const count = Math.floor(n);
  if (count <= 0) return [];
  const anchor = opts.anchorHex != null ? toOklch(opts.anchorHex) : null;
  const minDeltaE = Number.isFinite(opts.minDeltaE) ? Math.max(0, opts.minDeltaE!) : 0.02;

  // Pool base: the anchor pulled into chart-legible range — mid lightness,
  // enough chroma that hue differences read (a grey anchor still yields a
  // colourful pool; the verbatim anchor stays grey as series 1).
  const baseL = clamp(anchor?.l ?? 0.65, 0.35, 0.8);
  const baseC = clamp(anchor?.c ?? 0.12, 0.08, 0.2);
  const baseH = anchor?.h ?? 250;

  const chosen: { hex: string; lab: Lab }[] = [];
  const add = (c: Oklch) => {
    const hex = oklchToHex(c);
    // Gamut mapping can collapse near-duplicates onto one hex — re-measure in
    // OKLab of the EMITTED colour so distances reflect what renders.
    const lab = oklchToLab(hexToOklch(hex)!);
    chosen.push({ hex, lab });
  };
  add(anchor ?? { l: baseL, c: baseC, h: baseH });

  const pool: { hex: string; lab: Lab }[] = [];
  const seen = new Set<string>(chosen.map(c => c.hex));
  for (const dc of [1, 0.55]) {
    for (const dl of [0, -0.14, 0.14]) {
      for (let k = 0; k < 24; k++) {
        const c: Oklch = {
          l: clamp(baseL + dl, 0.25, 0.9),
          c: baseC * dc,
          h: normHue(baseH + k * 15),
        };
        const hex = oklchToHex(c);
        if (seen.has(hex)) continue;
        seen.add(hex);
        pool.push({ hex, lab: oklchToLab(hexToOklch(hex)!) });
      }
    }
  }

  const dist = (a: Lab, b: Lab): number =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  while (chosen.length < count && pool.length > 0) {
    let bestIdx = -1;
    let bestMin = -1;
    for (let i = 0; i < pool.length; i++) {
      let minD = Infinity;
      for (const c of chosen) minD = Math.min(minD, dist(pool[i]!.lab, c.lab));
      if (minD > bestMin) { // strict > keeps ties on the earliest (stable) candidate
        bestMin = minD;
        bestIdx = i;
      }
    }
    if (bestIdx < 0 || bestMin < minDeltaE) break;
    chosen.push(pool[bestIdx]!);
    pool.splice(bestIdx, 1);
  }
  return chosen.slice(0, count).map(c => c.hex);
}

// ─── ICC profiles as tool-facing gamut handles (v1.70) ────────────────────────

/**
 * The gamut source behind a handle a tool holds.
 *
 * The handle a tool gets is inert data — the profile's tables never cross the
 * bridge. Keeping the source here in a WeakMap rather than on the handle means
 * an object a tool assembled itself simply isn't in the map, so a forged or
 * stale handle produces the no-answer result instead of an answer computed
 * against whatever source happened to be current. Weak so a profile the tool
 * drops is collectable.
 */
const PROFILE_SOURCES = new WeakMap<ColorProfileGamut, GamutSource>();

/** Whitelist as an array, not an object: `INTENTS['constructor']` would be truthy. */
const INTENTS: readonly ColorRenderingIntent[] = ['perceptual', 'relative', 'saturation', 'absolute'];

/** The source for a handle, or null when the handle is not one we issued. */
const sourceFor = (p: ColorProfileGamut): GamutSource | null =>
  (p != null && typeof p === 'object' ? PROFILE_SOURCES.get(p) ?? null : null);

/**
 * Bytes → a handle, or null. `relative` by default: it is the intent a proof is
 * normally judged under, and the one every printer profile carries.
 */
function readIccProfile(bytes: Uint8Array, intent: ColorRenderingIntent = 'relative'): ColorProfileGamut | null {
  const want = INTENTS.includes(intent) ? intent : 'relative';
  const profile = parseIccProfile(bytes);
  if (!profile) return null;
  const source = iccGamutSource(profile, want);
  const handle: ColorProfileGamut = {
    id: source.id,
    label: source.label,
    deviceClass: profile.deviceClass,
    colourSpace: profile.dataColourSpace.trim(),
    channels: profile.nChannels,
    intent: want,
    version: profile.version,
    // The gamut gate, not `hasIntent`: a profile carrying only device → Lab (the
    // stock abstract profiles) has a transform for the intent and still cannot
    // answer a membership question, and `usable: true` there would promise an
    // answer the three queries below can only give as "nothing at all is
    // printable". See iccGamutIntent.
    usable: iccGamutIntent(profile, want),
  };
  PROFILE_SOURCES.set(handle, source);
  return handle;
}

// ─── host.color factory ───────────────────────────────────────────────────────

/**
 * The `host.color` bridge implementation (HostV1 v1.40, optional/additive).
 * Pure engine math behind short tool-facing names — every shell attaches THIS
 * (`host.color = makeColorApi()`) instead of implementing anything, so the
 * API can never drift between web, CLI, and Tauri. Synchronous throughout.
 */
export function makeColorApi(): ColorAPI {
  return {
    deltaE: deltaEOk,
    apca: apcaContrast,
    contrast: contrastRatio,
    ramp: rampOklab,
    breaks: classBreaks,
    distinct: distinctColors,
    // v1.60: the brand editor's harmony generator (brand-schemes.ts), attached
    // verbatim so tool-facing scheme accents can never drift from the editor's.
    schemes: (seedHex, kind = 'complement') => generateSchemeAccents(seedHex, kind),
    // v1.68: CSS-correct interpolation + the gradient spec. Both are thin
    // adapters over css-color.ts / gradient-spec.ts — the same code the export
    // walkers and the web shell's gradient editor use, so a tool's gradient and
    // an exported one can never be interpolated differently.
    mix: (a, b, t, opts = {}) => {
      const ca = parseColor(a);
      const cb = parseColor(b);
      if (!ca || !cb) return null;
      return colorToHexString(interpolateColor(ca, cb, t, opts));
    },
    gradientCss: spec => gradientSpecToCss(spec),
    // v1.107: the APCA inverse-solver (solveLightnessForApca), attached verbatim.
    // The forward `apca` scores a pair; this is the other direction — a tone of a
    // given hue that reads at a target Lc on a background — the one move a
    // contrast-first ramp needs. Same engine math on web, Worker, Tauri and CLI.
    solveApca: (hue, chroma, targetLc, bgHex, opts = {}) => solveLightnessForApca(hue, chroma, targetLc, bgHex, opts),
    // v1.69: display-gamut classification + the OKLCH slice planes (gamut.ts).
    // The brand studio's gamut charts and the Colour Lab tool both paint from
    // `slice`, so the studio and the tool can never disagree about where sRGB
    // ends. `gamut` takes a colour STRING like the rest of this API; the other
    // two are numeric because they run per-pixel/per-row.
    gamut: color => {
      const o = toOklch(color);
      return o ? oklchGamut(o.l, o.c, o.h) : 'none';
    },
    maxChroma: (l, h, limit = 'srgb') => maxChroma(l, h, limit),
    slice: opts => oklchSlice(opts),
    gamutRegion: (plane, fixed, limit = 'srgb', steps = 96, cMax = 0.4) =>
      sliceGamutRegion(plane, fixed, limit, steps, cMax),
    // The perceptual axes themselves. Until 1.69 a tool could ask for ramps and
    // harmonies but could not read a colour's own lightness or chroma — the one
    // conversion every colour tool needs, and the one it had to reimplement.
    oklch: color => toOklch(color),
    fromOklch: o => oklchToHex(o),
    // v1.70: the user's own ICC profile as a gamut (icc.ts + gamut-source.ts).
    // The three queries go through gamut.ts exactly as the display gamuts do —
    // a profile-backed source answers `contains` where a 3×3 matrix would — so
    // "does this print?" and "does this display?" cannot drift apart in method.
    // No-answer values (null / false / 0) for a handle we did not issue or a
    // profile with no table for its intent; never a guess.
    iccProfile: (bytes, intent) => readIccProfile(bytes, intent),
    inProfileGamut: (profile, l, c, h) => {
      const src = sourceFor(profile);
      return src ? inGamut(l, c, h, src) : false;
    },
    profileMaxChroma: (profile, l, h) => {
      const src = sourceFor(profile);
      return src ? maxChroma(l, h, src) : 0;
    },
    inkCoverage: (profile, l, c, h) => {
      const src = sourceFor(profile);
      return src?.inkCoverage?.(l, c, h) ?? null;
    },
    // v1.108: palette exchange (palette-export.ts), attached verbatim. A flat
    // swatch list → an interchange file: DTCG tokens JSON, CSS custom properties /
    // classes, SCSS variables, or a GIMP .gpl as TEXT; the binary Adobe .ase goes
    // through paletteExportBytes. The web shell's Swatches download calls the same
    // serializers, so a palette a tool exports and one the brand editor downloads
    // are byte-identical. Pure + sync, like the rest of this API.
    paletteExport: (swatches, format, opts = {}) => {
      switch (format) {
        case 'tokens-json': return paletteTokensJson(swatches);
        case 'css-vars': return paletteCssVariables(swatches);
        case 'css-classes': return paletteCssClasses(swatches);
        case 'scss': return paletteScssVariables(swatches);
        case 'gpl': return paletteGpl(swatches, opts.paletteName);
      }
    },
    paletteExportBytes: (swatches, _format) => paletteAse(swatches),
  };
}
