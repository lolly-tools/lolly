// SPDX-License-Identifier: MPL-2.0
/**
 * Pure CSS / colour / geometry leaf helpers shared by export.ts's SVG, PDF and
 * PPTX paths. Extracted verbatim from bridge/export.ts: pure functions (regex +
 * maths + engine DOM-free primitives), no DOM and no module state, so the walkers
 * and the PPTX builder import them rather than closing over export.ts.
 *
 * The two colour entry points are thin adapters over the engine's CSS Color 4
 * parser. They USED to be a `rgba?(int,int,int)` regex commented "always
 * rgb/rgba from getComputedStyle" - false since browsers began serialising
 * non-legacy colours in their own space, which silently dropped the paint of
 * anything wearing `oklch()` / `color-mix(in oklab, …)` (plans/60-color-spaces.md section 4).
 */
import { parseCssLength, cornerRadii, uniformRadius, parseColorToSrgb8 } from "@lolly/engine";
import type { CornerRadii, CornerPair } from "../../../../engine/src/css-box.ts";

type Rgb = [number, number, number];
type Rgba = [number, number, number, number];

// Round to 2dp - keeps emitted path transforms compact (toPath already rounds d).
export function n2(v: number): number { return Math.round(v * 100) / 100; }

// Like parseCssColor but preserves the alpha channel as a 4th element [r,g,b,a].
// Returns null for fully transparent colours.
export function parseCssColorFull(cssColor: string | null | undefined): Rgba | null {
  return parseColorToSrgb8(cssColor);
}

// Serialise an [r,g,b,a] as a CSS colour string (rgb() when opaque, else rgba()).
export function rgbaCss(c: Rgba): string {
  return c[3] < 1 ? `rgba(${c[0]},${c[1]},${c[2]},${c[3]})` : `rgb(${c[0]},${c[1]},${c[2]})`;
}

// Parse a computed CSS colour, dropping alpha. Returns null for transparent or
// fully-transparent colour.
export function parseCssColor(cssColor: string | null | undefined): Rgb | null {
  const c = parseColorToSrgb8(cssColor);
  return c ? [c[0], c[1], c[2]] : null;
}

// Parse a CSS length value (px or %). refPx is used for percentage resolution.
// Delegates to the engine's DOM-free parser (single source of truth).
export function parseCssLen(val: string | null | undefined, refPx: number): number {
  return parseCssLength(val, refPx);
}

// Resolve a computed style's four border-radius corners for a w×h box into the
// CSS section 5.5 corner-overlap-clamped geometry, via the engine (the single source of
// truth shared by the SVG and PDF walkers - see engine/src/css-box.js).
//
// Returns { radii, uniform }: `radii` is the four clamped [h,v] corners; `uniform`
// is a single [rx,ry] pair when all four corners are equal (the common pill /
// ellipse / circle / rounded-rect case - emit a fast <rect rx ry> / jsPDF
// roundedRect) or null when they differ (emit a four-corner path so e.g. a
// top-only-rounded card keeps its square bottom corners instead of rounding all
// four). The uniform path is byte-identical to before, preserving the pill fix.
export function resolveRadii(style: CSSStyleDeclaration, w: number, h: number): { radii: CornerRadii; uniform: CornerPair | null } {
  const radii = cornerRadii({
    topLeft:     style.borderTopLeftRadius,
    topRight:    style.borderTopRightRadius,
    bottomRight: style.borderBottomRightRadius,
    bottomLeft:  style.borderBottomLeftRadius,
  }, w, h);
  return { radii, uniform: uniformRadius(radii) };
}

// Parse a CSS object-position into [x, y] fractions (0..1), so a meet-fitted image
// hugs the same edge in PDF as on screen (e.g. wayfinding rows use "left center" /
// "right center"). Handles keywords + percentages; falls back to centred.
export function objectPositionFractions(val: string | null | undefined): [number, number] {
  const toks = String(val || '50% 50%').trim().toLowerCase().split(/\s+/).slice(0, 2);
  let px = 0.5, py = 0.5;
  const pct: number[] = [];
  for (const t of toks) {
    if (t === 'left') px = 0; else if (t === 'right') px = 1;
    else if (t === 'top') py = 0; else if (t === 'bottom') py = 1;
    else if (t === 'center') { /* leave default */ }
    else if (t.endsWith('%')) { const p = parseFloat(t); if (isFinite(p)) pct.push(p / 100); }
  }
  if (pct.length === 1) px = pct[0]!;
  else if (pct.length === 2) { px = pct[0]!; py = pct[1]!; }
  return [px, py];
}
