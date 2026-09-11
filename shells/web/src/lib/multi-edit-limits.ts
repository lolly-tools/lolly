// SPDX-License-Identifier: MPL-2.0
/**
 * The multi-edit selection bounds, in ONE place - the guard in views/multi-edit.ts,
 * the Projects "Edit together" gate, and the gallery "Make copies" dialog all read
 * these so a cap change applies everywhere at once.
 *
 * The upper bound used to be 8, when every cell created its runtime eagerly on
 * mount. views/multi-edit.ts now creates runtimes lazily (per cell, as it nears the
 * viewport) and freezes off-screen cells' previews, so the ceiling is a UX call
 * (how many designs stay legible in one grid), not a rendering-cost one.
 */
export const MULTI_EDIT_MIN = 2;
export const MULTI_EDIT_MAX = 50;
