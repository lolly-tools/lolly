// SPDX-License-Identifier: MPL-2.0
/**
 * The one numeric clamp. Twenty-seven local copies of this line lived across the engine
 * and the web shell until 2026-09-09; a bound that reads `lo <= hi` is the only contract.
 */

/** `v` held within `[lo, hi]`. NaN passes through as NaN, like `Math.min`/`Math.max` do. */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
