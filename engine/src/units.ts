// SPDX-License-Identifier: MPL-2.0
/**
 * Physical unit conversions for output dimensions — platform-agnostic, no DOM.
 *
 * The platform's design canvas is measured in CSS pixels (the web standard
 * `1px = 1/96 inch`). Output media, though, are physical: a PDF page is points
 * (1/72 inch), print rasters are pixels at some DPI, an SVG can carry real
 * units. This module is the single source of truth for turning a dimension the
 * user typed (e.g. "210mm", "8.5in", "595pt", "1080" / "1080px") into whatever
 * the chosen export format needs.
 *
 * Canonical intermediate: inches.
 *
 *   parseDimension("210mm")     → { value: 210, unit: 'mm' }
 *   toPixels({value:210,unit:'mm'}, 300) → 2480   (raster @ 300 DPI)
 *   toPoints({value:210,unit:'mm'})      → 595.28 (PDF page, resolution-free)
 *   toCssLength(...)            → "210mm" (SVG width/height)
 */

export const CSS_DPI = 96;

/** A CSS length unit understood by this module. */
export type Unit = 'px' | 'pt' | 'pc' | 'mm' | 'cm' | 'in';

/** A parsed output dimension: a positive magnitude plus its unit. */
export interface Dimension {
  value: number;
  unit: Unit;
}

export const UNITS: readonly Unit[] = ['px', 'pt', 'pc', 'mm', 'cm', 'in'];

// How many of each unit fit in one inch.
const PER_INCH: Record<Unit, number> = { px: 96, pt: 72, pc: 6, mm: 25.4, cm: 2.54, in: 1 };

export const isUnit = (u: string): u is Unit =>
  Object.hasOwn(PER_INCH, u);

/**
 * Parse a dimension into { value, unit }. Accepts a number (treated as px) or a
 * string like "210mm" / "8.5in" / "1080" / "1080px". Returns null for empty or
 * invalid input so callers can fall back to a default.
 * @param input
 * @param defaultUnit unit to assume when the string has none (default 'px')
 */
export function parseDimension(
  input: string | number | null | undefined,
  defaultUnit: string = 'px',
): Dimension | null {
  if (input == null || input === '') return null;
  if (typeof input === 'number') {
    return Number.isFinite(input) && input > 0 ? { value: input, unit: 'px' } : null;
  }
  const m = String(input).trim().match(/^([0-9]*\.?[0-9]+)\s*([a-z]+)?$/i);
  if (!m || m[1] === undefined) return null;
  const value = parseFloat(m[1]);
  if (!(value > 0)) return null;
  const unit = (m[2] || defaultUnit).toLowerCase();
  return isUnit(unit) ? { value, unit } : null;
}

/** Physical length of a dimension, in inches. */
export const toInches = (dim: Dimension): number => dim.value / PER_INCH[dim.unit];

/** True for any unit that carries a physical size (everything but raw px). */
export const isPhysical = (dim: Dimension | null | undefined): boolean =>
  dim != null && dim.unit !== 'px';

/**
 * Output pixel count for a raster at `dpi`. A px dimension is already a pixel
 * count (DPI-independent); physical units scale by the DPI.
 */
export function toPixels(dim: Dimension, dpi: number = CSS_DPI): number {
  return dim.unit === 'px' ? Math.round(dim.value) : Math.round(toInches(dim) * dpi);
}

/**
 * Output points for vector formats (PDF). px maps through the CSS 96-DPI
 * convention so existing pixel-based tools keep their current page size.
 */
export function toPoints(dim: Dimension): number {
  return dim.unit === 'px' ? (dim.value * 72) / CSS_DPI : toInches(dim) * 72;
}

/** CSS pixels (for an SVG viewBox / on-screen size) — physical units at 96 DPI. */
export function toCssPx(dim: Dimension): number {
  return dim.unit === 'px' ? dim.value : toInches(dim) * CSS_DPI;
}

/** Re-express a dimension in another unit (e.g. native px → mm for a placeholder). */
export function toUnit(dim: Dimension, unit: Unit): number {
  return toInches(dim) * PER_INCH[unit];
}

/** A CSS length string for SVG width/height — keeps the physical unit if any. */
export function toCssLength(dim: Dimension): string {
  return dim.unit === 'px' ? `${dim.value}px` : `${dim.value}${dim.unit}`;
}
