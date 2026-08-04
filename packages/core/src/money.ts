// SPDX-License-Identifier: MPL-2.0
/**
 * Money: the currency-formatting helper and the serialised money-bearing artifact
 * shape. The pure, transport-neutral, UI-free pieces the surfaces consume.
 *
 * ## Why this is a SIBLING of `preflight.ts`, never inside it
 *
 * `preflight.ts` states, in its own header and again on `PreflightReport`, that
 * there is no currency, rate, price or monetary field anywhere in it and none may
 * be added. That is load-bearing: the moment a *report* can carry a number that
 * looks like money, an unqualified ceiling gets read as a quote. So money attaches
 * as a SEPARATE object that consumes `Count`/`Bound` values and carries its own
 * provenance caveats — it never lands inside `PreflightReport`. This module is that
 * separate object, and it lives beside preflight (same package, `type`-only import)
 * rather than in the engine or a shell for two reasons:
 *
 *   - The web export panel and `lolly preflight --json` must print BYTE-IDENTICAL
 *     figures. Both already depend on `@lolly-tools/core` (the engine does too), so
 *     this is the one place all three render paths reach with no new dependency edge.
 *   - The minor-unit exponent a formatter reads (via `Intl`) is the SAME value the
 *     Logic phase's `parseRateCard` must use to convert a rate string to integer
 *     minor units. Exporting `minorUnitExponent` here lets the parser import it, so
 *     parse and format can never disagree about how many minor units a currency has.
 *     There is deliberately no hardcoded exponent table anywhere: `Intl` is the
 *     single source of truth (JPY -> 0, EUR -> 2, BHD -> 3).
 *
 * ## The one invariant above all: never invent money
 *
 * There is NO default currency and NO fallback symbol in this file. `currency` is a
 * required argument on every entry point; a missing or invalid code THROWS a typed
 * `CurrencyError` rather than degrading to `$` or `0`. A currency always comes from
 * the rate card the user supplied. See `plans/65-preflight-and-cost.md` §6.
 *
 * All amounts crossing this module are INTEGER minor units. No float ever touches a
 * subtotal: the only division is the display-time `minorUnits / 10 ** exponent`
 * handed straight to `Intl.NumberFormat`, which rounds to exactly `exponent`
 * fraction digits, so no float artefact can survive into rendered text.
 */

import type { Bound, QuantityKind, QuantityUnit } from './preflight.ts';

// ─── Errors ───────────────────────────────────────────────────────────────────

/**
 * A currency code that `Intl` cannot use. Thrown, never swallowed: the callers of
 * this module have a rate card in hand by construction, so an unusable currency is
 * a corrupt card, not a case to paper over with a default symbol.
 */
export class CurrencyError extends Error {
  readonly currency: string;
  constructor(currency: string, cause?: unknown) {
    super(
      `Unusable currency code ${JSON.stringify(currency)}. A currency must come ` +
        `from the rate card; there is no default and no fallback symbol.`,
    );
    this.name = 'CurrencyError';
    this.currency = currency;
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

/** A minor-unit amount that is not a safe integer. A float that reached here is a
 *  bug upstream (money maths is integer minor units), so it is refused loudly
 *  rather than formatted into a plausible-looking figure. */
export class MinorUnitError extends Error {
  readonly minorUnits: number;
  constructor(minorUnits: number) {
    super(
      `Money must be integer minor units; got ${minorUnits}. A non-integer amount ` +
        `means a float leaked into a subtotal.`,
    );
    this.name = 'MinorUnitError';
    this.minorUnits = minorUnits;
  }
}

// ─── The exponent: one source of truth, shared with the parser ─────────────────

/**
 * How many minor units this currency has, straight from `Intl` (JPY -> 0, EUR -> 2,
 * BHD -> 3). This is the ONE function both the display formatter and the Logic
 * phase's rate-string parser call, so parse and format can never disagree.
 *
 * @throws CurrencyError if `currency` is empty or not a code `Intl` accepts.
 */
export function minorUnitExponent(currency: string, locale?: string): number {
  return exponentOf(currencyFormatter(currency, locale), currency);
}

/** Read a currency formatter's exponent. `Intl` types `maximumFractionDigits` as
 *  optional, but for `style: 'currency'` it is always present at runtime; if it ever
 *  is not, that is refused (as a corrupt currency), never defaulted to 2. */
function exponentOf(fmt: Intl.NumberFormat, currency: string): number {
  const exp = fmt.resolvedOptions().maximumFractionDigits;
  if (typeof exp !== 'number') throw new CurrencyError(currency);
  return exp;
}

/** Build an `Intl.NumberFormat` for a currency, turning `Intl`'s `RangeError` (and
 *  a missing code) into our typed `CurrencyError`. */
function currencyFormatter(currency: string, locale?: string): Intl.NumberFormat {
  if (typeof currency !== 'string' || currency.length === 0) throw new CurrencyError(currency);
  try {
    // Locale is `undefined` by default: the READER's locale, matching the date rule
    // at `views/valid.ts`. The currency is the card's, always.
    return new Intl.NumberFormat(locale ?? undefined, { style: 'currency', currency });
  } catch (e) {
    throw new CurrencyError(currency, e);
  }
}

// ─── Formatting ────────────────────────────────────────────────────────────────

/** Input to {@link formatMoney}: integer minor units plus the required currency. */
export interface MoneyInput {
  /** Integer minor units (e.g. EUR 4210.50 -> 421050). No float, no major units. */
  readonly minorUnits: number;
  /** ISO 4217 code, FROM THE CARD. Required; there is no default. */
  readonly currency: string;
  /** The reader's locale. Omit for the runtime default (the reader's own). */
  readonly locale?: string;
}

/**
 * Format integer minor units as a localised currency string.
 *
 * The currency is required and comes from the card; the locale defaults to the
 * reader's. Never returns a bare number: the output always carries the currency
 * `Intl` renders for the code (symbol or ISO letters, per the reader's locale).
 *
 * @throws CurrencyError  if `currency` is missing or unusable.
 * @throws MinorUnitError if `minorUnits` is not a safe integer.
 */
export function formatMoney({ minorUnits, currency, locale }: MoneyInput): string {
  if (!Number.isSafeInteger(minorUnits)) throw new MinorUnitError(minorUnits);
  const fmt = currencyFormatter(currency, locale);
  const exponent = exponentOf(fmt, currency);
  // The only division in the module. Handed straight to `Intl`, which rounds to
  // `exponent` digits, so no float artefact survives into the string.
  const major = minorUnits / 10 ** exponent;
  return fmt.format(major);
}

/** Format a self-describing {@link MonetaryFigure} (the serialised shape). The
 *  figure already carries its currency, so only the reader's locale is optional. */
export function formatFigure(figure: MonetaryFigure, locale?: string): string {
  return formatMoney({ minorUnits: figure.minorUnits, currency: figure.currency, locale });
}

// ─── The self-describing figure ────────────────────────────────────────────────

/**
 * A monetary amount that carries everything needed to read it correctly, so a naive
 * `--json` consumer can never mistake `421050` for major units and never sees a
 * float. This is the ONLY shape a monetary total takes in a serialised artifact.
 */
export interface MonetaryFigure {
  /** Integer minor units. */
  readonly minorUnits: number;
  /** ISO 4217, from the card. */
  readonly currency: string;
  /** Minor-unit exponent for `currency` (from `Intl`), so `minorUnits / 10**exponent`
   *  is the major amount with no exponent table needed at the far end. */
  readonly exponent: number;
}

/**
 * Build a {@link MonetaryFigure}, reading the exponent from `Intl` so the serialised
 * figure and the display formatter agree by construction.
 *
 * @throws CurrencyError  if `currency` is unusable.
 * @throws MinorUnitError if `minorUnits` is not a safe integer.
 */
export function monetaryFigure(minorUnits: number, currency: string): MonetaryFigure {
  if (!Number.isSafeInteger(minorUnits)) throw new MinorUnitError(minorUnits);
  return { minorUnits, currency, exponent: minorUnitExponent(currency) };
}

// ─── The serialised money-bearing artifact (rule 9) ────────────────────────────
//
// A monetary figure may never appear in a serialised artifact without its caveats
// as SIBLING FIELDS in the same object. A caveat that lives only in a UI string is
// a bug — the zip's `preflight.json` and `--json` are the copies that travel, and a
// client mailed the whole job zip opens that file. So this object exists to make
// the hedge inseparable from the figure.
//
// Key rules embedded in the type:
//   - There is NO field named `total`. The figure is `estimatedTotalFromSuppliedRates`,
//     and it is `null` unless every counted line is priced (rule 2).
//   - The member is named `cost`, and the file `preflight.json` — never `budget.json`
//     or `quote.json`.
//   - It is a SIBLING of `PreflightReport`, never nested in it (see this file's header).

/**
 * The rate card's issuer, as REPORTED SPEECH. `verified` is a frozen `false`: this
 * is a claim typed inside a file the user dropped, and Lolly verifies none of it.
 * `plans/65-preflight-and-cost.md` §5.
 */
export interface CostRatesFrom {
  /** The issuer name the file claims. Reported, never asserted. */
  readonly issuer: string;
  /** The date the file claims it was issued. A string, as written. */
  readonly issued: string;
  /** The expiry the file claims, or `null` if it declares none. */
  readonly validUntil: string | null;
  /** The file's content digest — a fact Lolly DID compute. */
  readonly digest: string;
  /** Always `false`. Lolly does not verify a dropped file's claims. */
  readonly verified: false;
}

/** One priced multiplication, JSON-safe. Amounts are integer minor units under the
 *  enclosing object's `currency` (never their own float). The Logic phase fills
 *  these; this type fixes their serialised shape now so consumers can code against
 *  it before the arithmetic exists. */
export interface SerializedWorkingRow {
  /** The rate-card line id this row priced: `'plate-setup'`, `'run'`, … */
  readonly lineId: string;
  /** The rate kind, e.g. `'perPlate'`. Kept as a string for forward-compatibility
   *  with rate kinds the Logic phase may add without a breaking change here. */
  readonly kind: string;
  /**
   * Which quantity it multiplied. A `QuantityKind` for the counted lines, plus the
   * two NON-counted multipliers the model has: `'job'` for a `perJob` fixed charge
   * (an implicit single job), and `'runLength'` for a `perUnit` line's user-entered
   * run length. Neither is a preflight count, so neither is a `QuantityKind`.
   */
  readonly quantityKind: QuantityKind | 'job' | 'runLength';
  /** The counted multiplier (a `Count.value`). */
  readonly quantity: number;
  /** Inherited from the `Count`: a ceiling quantity yields a ceiling subtotal. */
  readonly bound: Bound;
  /** Echoed from the `Count`, so the row can print `x 0.065 m2-sheet`. Absent on a
   *  `perJob`/`perUnit` row, whose multiplier is not a counted quantity. */
  readonly unit?: QuantityUnit;
  /** Present iff `quantityKind === 'area'`. */
  readonly box?: 'trim' | 'bleed' | 'media';
  /** The card's rate, in minor units. FROM THE CARD; never defaulted. */
  readonly unitRate: number;
  /** The line total, in minor units. */
  readonly subtotal: number;
  /** `=== bound` (rule 4). */
  readonly subtotalBound: Bound;
}

/** An adjustment that changes the total, rendered as its own visible row (rule 3),
 *  never a silent floor. The minimum charge is the only one known today. */
export interface SerializedAdjustmentRow {
  readonly lineId: string;
  readonly kind: 'adjustment';
  /** Why the adjustment applied, e.g. `'minimumCharge'`. */
  readonly reason: string;
  /** The priced subtotal before the adjustment, in minor units. */
  readonly from: number;
  /** The amount after it, in minor units. */
  readonly to: number;
  /** `to - from`, in minor units (the visible `+…` row). */
  readonly delta: number;
}

/** A counted line the card could not price, and why. */
export interface SerializedUncostedLine {
  /** The card line id, or the counted `QuantityKind` when no line matched. */
  readonly lineId: string;
  /** Machine-readable reason, e.g. `'no-rate'`, `'empty-rate'`, `'no-sheet-size'`. */
  readonly reason: string;
}

/**
 * The serialised money object — a SIBLING member named `cost`, beside `findings`/
 * `counts`/`gaps` in the artifact, never inside `PreflightReport`.
 *
 * With no rate card, this member is ABSENT ENTIRELY (not `null`, not `{}`). When
 * money is suppressed (expired without opt-in, degrade-to-counts, a confidential
 * card reached via a link), it is likewise absent and an `info` finding carries the
 * reason — because rule 9 forbids a currency figure sitting in a serialised artifact
 * even one that is being hidden.
 */
export interface SerializedCost {
  /** Always `'estimate'`. Never the bare noun to a user (§6): the figure is always
   *  rendered with its source inline. Here it is the machine tag. */
  readonly kind: 'estimate';
  /** Always `false`. Lolly never produces a quote. */
  readonly isQuote: false;
  /**
   * The headline figure, self-describing (minor units + currency + exponent), or
   * `null` when any counted line is uncosted (rule 2). NEVER `0` and never a partial
   * scalar: the gap is the headline, not a confident-looking under-estimate.
   *
   * Deliberately NOT named `total`.
   */
  readonly estimatedTotalFromSuppliedRates: MonetaryFigure | null;
  /** `'ceiling'` iff any contributing line is a ceiling (rule 4). */
  readonly bound: Bound;
  /** Counted lines that produced a priced row. */
  readonly coversLines: number;
  /** Counted lines a rate card could price. */
  readonly ofLines: number;
  /** `!card.taxIncluded` — from the card, never assumed. */
  readonly excludesTax: boolean;
  /**
   * `true` iff this figure was computed from rates PAST the card's `validUntil`,
   * because the user explicitly opted in ("Use these rates anyway", `--use-expired-rates`).
   * A material caveat (§5: the opt-in "stamps every resulting figure with the expiry
   * date"), carried as a sibling so a `--json`/`preflight.json` consumer never has to
   * compare `ratesFrom.validUntil` to "now" itself to learn the figure is lapsed.
   * `false` on a live card.
   */
  readonly usedExpiredRates: boolean;
  /** Rule 6's sentence, verbatim ({@link COST_DISCLAIMER}), carried as a sibling so
   *  it travels with the copy. */
  readonly disclaimer: string;
  /** The card's issuer, as reported speech (§5). */
  readonly ratesFrom: CostRatesFrom;
  /** The counted lines the card could not price. Empty on full coverage. */
  readonly uncosted: readonly SerializedUncostedLine[];
  /** One row per priced multiplication (rule 3). Populated by the Logic phase. */
  readonly workingRows: readonly SerializedWorkingRow[];
  /** Visible adjustment rows (e.g. minimum charge). Populated by the Logic phase. */
  readonly adjustments: readonly SerializedAdjustmentRow[];
}

/**
 * Rule 6's disclaimer, verbatim. Carried as the serialised `SerializedCost.disclaimer`
 * AND rendered under every displayed total, so the two are the same sentence.
 *
 * No em-dashes, no currency symbol.
 */
export const COST_DISCLAIMER =
  'Arithmetic done here from the rates you supplied. It is not a quote, and only your printer can give you one.';

/** The serialised member's name. Never `budget` or `quote` (rule 9). */
export const COST_MEMBER = 'cost';
