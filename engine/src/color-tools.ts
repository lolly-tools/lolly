// SPDX-License-Identifier: MPL-2.0
/**
 * Colour tools — perceptual metrics and ramp math on top of brand-derive's
 * OKLab core. The adopt/port decision behind this module is
 * plans/chroma-eval.md: the handful of load-bearing algorithms from chroma.js
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
import type { ColorAPI } from './bridge/host-v1.ts';

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
 * point once per centroid (plans/chroma-eval.md §5).
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
 * plans/chroma-eval.md: a structured candidate pool around the anchor's
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
  };
}
