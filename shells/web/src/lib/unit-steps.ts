// SPDX-License-Identifier: MPL-2.0
/**
 * Per-unit steps and display precision for a length a person reads or nudges in the
 * editor (plans/184 R10, R12). The engine's units.ts owns the conversion maths; this
 * is only how many decimals each unit deserves on screen and how far one arrow key or
 * one scrub pixel moves it. One table, read by the export bar's fields, its unit switch
 * and the scrub, so px cannot quietly become the only unit with a sensible step again.
 *
 * DISPLAY decimals are chosen so a round trip px -> unit -> px loses under half a CSS
 * pixel: 0.1 mm is 0.38 px, 0.001 in is 0.096 px, 0.1 pt is 0.13 px. px itself keeps
 * two decimals on the bar, so a 793.7 px A4 board reads back as stored, not as 794.
 */
import { UNITS, isUnit, toUnit } from '@lolly/engine';
import type { Unit } from '../../../../engine/src/units.js';

const STEP: Record<Unit, number> = { px: 1, pt: 0.5, pc: 0.1, mm: 0.1, cm: 0.01, in: 0.01 };
const DECIMALS: Record<Unit, number> = { px: 2, pt: 1, pc: 2, mm: 1, cm: 2, in: 3 };

/** What one arrow key or one scrub pixel moves a length by, in `unit`. */
export function stepFor(unit: string): number { return isUnit(unit) ? STEP[unit] : 1; }
/** Decimals a length in `unit` is shown with. */
export function decimalsFor(unit: string): number { return isUnit(unit) ? DECIMALS[unit] : 0; }
/** Snap a value in `unit` to that unit's display precision. */
export function roundIn(value: number, unit: string): number {
  const q = 10 ** decimalsFor(unit);
  const r = Math.round(value * q) / q;
  return Object.is(r, -0) ? 0 : r;
}
/** Re-express a length, unrounded. The same unit, or one this table does not know, passes through. */
export function convertLength(value: number, from: string, to: string): number {
  if (from === to || !isUnit(from) || !isUnit(to)) return value;
  return toUnit({ value, unit: from }, to);
}
/** A stored CSS-px length as the number the bar shows in `unit`. */
export function displayIn(px: number, unit: string): number { return roundIn(convertLength(px, 'px', unit), unit); }
export { UNITS };
