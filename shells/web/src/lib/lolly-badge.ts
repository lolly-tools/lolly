// SPDX-License-Identifier: MPL-2.0
/**
 * The "Made with Lolly" mark - the lollipop glyph + wordmark, shared so the catalog
 * (its details modal) and the Verify view read identically instead of the glyph being
 * trapped inline in valid.ts. Styled by `.lolly-badge` in styles/parts/catalog.css.
 *
 * The claim is only honest when a credential actually records a Lolly export - the
 * catalog reveals the `lg` lockup lazily, gated on `verifyC2pa(...).madeWithLolly`
 * (the same signal the Verify checker's green "Made with Lolly" coin uses).
 */

/** The lollipop line-glyph (a round sweet on a stick) - Lolly's own mark, matching the
 *  Verify scorecard's `lollipop`. `px` sizes both the box and the rendered glyph. */
export const LOLLY_ICON = (px = 16): string =>
  `<svg viewBox="0 0 24 24" width="${px}" height="${px}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="9" r="7"/><path d="M9 5a4 4 0 0 1 0 8 2 2 0 0 1 0-4"/><path d="m14 14 6 6"/></svg>`;

/** The "Made with Lolly" lockup - icon + wordmark. `size:'lg'` is the prominent
 *  catalog-details treatment; `sm` (default) is an inline pill. */
export function lollyBadge(size: 'sm' | 'lg' = 'sm'): string {
  // `.chip` (styles/parts/chips.css) supplies the shared inline-flex/gap layout
  // (component audit rec 3); `.lolly-badge` explicitly zeroes the pill's
  // padding/background/radius back out - this is a plain icon+wordmark
  // lockup, not a boxed pill, and its --lolly-accent stays its own.
  return `<span class="chip lolly-badge lolly-badge--${size}">${LOLLY_ICON(size === 'lg' ? 22 : 15)}<span class="lolly-badge-lbl">Made with Lolly</span></span>`;
}
