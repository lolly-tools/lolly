// SPDX-License-Identifier: MPL-2.0
/**
 * The cost panel's chrome strings - the minimum set (plans/65-preflight-and-cost.md section 6
 * "Minimum chrome string set"), defined once as `t()` call sites so the surfaces
 * that render money import them from here rather than re-spelling them.
 *
 * ## For translators (this is a house rule, not a suggestion)
 *
 * English is the key (see i18n.ts). Two things are BUGS in a translation of any
 * string below:
 *
 *   1. A currency symbol. `$`, `€`, `£`, `¥` - none of these belong in a translated
 *      string. Every figure is formatted by `Intl.NumberFormat` from the card's own
 *      currency and interpolated as `{total}` / `{amount}` AFTER formatting. A
 *      symbol typed into a string would override the reader's currency with a wrong
 *      one.
 *   2. Splitting the figure from its source. In `'{total} using {issuer} rates dated
 *      {date}'` the amount, the issuer and the date MUST stay in one sentence.
 *      Splitting them across strings is exactly how the hedge gets lost and a
 *      count-times-a-rate starts reading like a quote. Keep them together.
 *
 * Numbers, dates and amounts are formatted first and interpolated second, so no
 * string here contains a literal figure. Mirrors the `Finding.message` house rule
 * in packages/core/src/preflight.ts.
 *
 * The disclaimer (string 4) is asserted identical to `COST_DISCLAIMER` from
 * `@lolly-tools/core` by cost-strings.test.ts, so the sentence rendered under a
 * total and the one serialised into `preflight.json` can never drift.
 */

import { t, tRaw } from '../i18n.ts';

// ── The 11 minimum strings ─────────────────────────────────────────────────────

/** 1. Panel heading (section 6). */
export const costHeading = (): string => t('Cost, worked out from your rate card');

/** 2. Rule 1 body, shown when no rate card is attached. No money is shown at all. */
export const noCardBody = (): string =>
  t(
    'Lolly counted the work. It has no prices, so it shows none. Attach a rate card from your printer and the same counts become an estimate you can check.',
  );

/** 3. The figure sentence. `total` is formatted (currency + amount) BEFORE it is
 *  interpolated here; issuer and date stay in the same sentence as the figure. */
export const figureLine = (total: string, issuer: string, date: string): string =>
  tRaw('{total} using {issuer} rates dated {date}', { total, issuer, date });

/** 4. Rule 6 disclaimer, under every total. Identical to `COST_DISCLAIMER`. */
export const disclaimerLine = (): string =>
  t('Arithmetic done here from the rates you supplied. It is not a quote, and only your printer can give you one.');

/** 5. The `<details>` summary that reveals the arithmetic. */
export const showArithmetic = (): string => t('Show the arithmetic');

/** 6. Rule 2 headline (partial coverage): no total is shown. `pressRun` appends the
 *  "including the press run" clause only when a perSheet line is uncosted. */
export const partialCoverageHeadline = (unpriced: number, lines: number): string =>
  t('{unpriced} of {lines} cost lines are not priced by this card, including the press run. Lolly is not showing a total.', {
    unpriced,
    lines,
  });

/** 7. Rule 4 ceiling prefix. `amount` is formatted BEFORE interpolation. */
export const upTo = (amount: string): string => t('up to {amount}', { amount });

/** 8. Rule 4 exact-plus-headroom split. `amount` is formatted BEFORE interpolation. */
export const headroom = (amount: string): string =>
  t('Depends on the final separation: up to {amount} more', { amount });

/** 9. section 5 reported speech: the card's claims, never a bare attribution beside a figure. */
export const reportedSource = (issuer: string, issued: string): string =>
  tRaw('The file says: {issuer}, {issued}. Lolly has not verified this.', { issuer, issued });

/** 10. The adjustment row label. The `+{amount}` renders as a string-free amount cell. */
export const minimumChargeApplied = (): string => t('minimum charge applied');

/** 11. Phase 5 per-device reveal action. Never carried in a URL. */
export const showCostsPrompt = (): string => t('You hold rates for this job. Show costs?');

// ── The two expiry strings (only if the expiry UI ships; still within budget) ──

/** Shown when the card's `validUntil` has passed and the user has not opted in. */
export const ratesExpired = (date: string): string =>
  tRaw('These rates expired on {date}. Showing counts only.', { date });

/** The opt-in action that stamps every resulting figure with the expiry date (section 5). */
export const useExpiredAnyway = (): string => t('Use these rates anyway');

/** The stamp on a figure computed from opted-in expired rates (section 5): the expiry date
 *  rides WITH the total so a lapsed figure is never read as a current one. */
export const figureExpiredNote = (date: string): string =>
  tRaw('These rates expired on {date}. This figure was computed from lapsed prices.', { date });
